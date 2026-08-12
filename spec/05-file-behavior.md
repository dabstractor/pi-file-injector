## 5. Behavior by File Type

Given an existing regular file at `abs`, classify by extension (lowercased, no dot) and branch:

### 5.1 Text files (everything that isn't a recognized image)

1. **Read the entire file:** `const buf = await fs.readFile(abs);`
2. **Binary check** (only to route *non-image* binaries to §5.3, not to gate size): scan the first 8000 bytes for a `0x00` (NUL) byte.
   - If a NUL is found **and** the extension is not a known image type → go to §5.3 (binary note).
   - Otherwise treat as text.
3. **Decode:** `const content = buf.toString("utf8");`
4. **Inject the entire content** if it fits the remaining context budget; otherwise hand off to §5.5 (paged delivery). No silent truncation in either path. (See §6 for format.)

> The defining behavior of `#@` is that **the whole file always reaches the model**. When it fits remaining context it is injected inline; when it does not, §5.5 pages it through the model's `read` tool so the model still reads all of it.

### 5.2 Image files

Recognized image extensions (case-insensitive) and their MIME types:

| ext | mimeType |
|---|---|
| `png` | `image/png` |
| `jpg`, `jpeg` | `image/jpeg` |
| `gif` | `image/gif` |
| `webp` | `image/webp` |
| `bmp` | `image/bmp` |

For an image file:
1. `const buf = await fs.readFile(abs);`
2. **Resize to provider limits** (necessary, not configurable — providers reject oversized images): `const resized = await resizeImage(new Uint8Array(buf), mimeType);`
   - `resizeImage` returns `null` if it can't process → fall back to the raw bytes: `data = buf.toString("base64")`, `finalMime = mimeType`.
   - Otherwise: `data = resized.data`, `finalMime = resized.mimeType`.
3. **Attach:** push `{ type: "image", data, mimeType: finalMime }` into the `images` array (seeded from `event.images ?? []`).
4. **Reference note** in the text block (see §6), optionally including `formatDimensionNote(resized)`.
5. **Consume budget** (§5.6.2): subtract a conservative image-token estimate from the shared `remaining`. Images are never paged — they are resized and attached.

### 5.3 Other binary files (non-image, NUL detected)

Do **not** inject decoded garbage. Emit a clear note instead so the model knows the file exists and can use a tool if it actually needs the bytes:

```
<file name="/abs/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```

The note itself consumes a small amount of the shared budget (§5.6.2).

### 5.4 Missing / directory / read error

Leave the original `#@path` token **verbatim** in the text. No block is appended for it. The model sees the literal reference and can react (call `read`, ask the user, etc.). Never throw.

### 5.5 Oversize files: automatic paged delivery

A file larger than the model's remaining context cannot be injected whole. No mechanism puts a file bigger than the context window in front of the model at once. `#@` handles this without making the user fall back to the `read` tool by hand.

**Budget.** Compute the remaining context once, before the loop. The window comes from the `ContextUsage` object (`usage.contextWindow`), not `ctx.model.contextWindow`:
```
const usage = ctx.getContextUsage?.();
const remaining = (usage && usage.tokens !== null)
  ? Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN)
  : null;
```
When `getContextUsage()` is `undefined` or `usage.tokens` is `null`, `remaining` is `null` (see O-1 fallback).

**Decision (per text file).** Estimate the file's own cost with the chars-per-token heuristic `fileCost = Math.ceil(content.length / 4)` (O-3). If `remaining === null` (budget unknown) or `fileCost <= PAGED_THRESHOLD * remaining`, inject the whole file inline (§5.1, §6) and subtract `fileCost` from `remaining`. Otherwise page it (below). `PAGED_THRESHOLD` defaults to `0.6`: a file that would leave the model less than 40% of remaining context for reasoning trips the page path, even if it technically fits.

**Page path.** Instead of one `formatTextFileBlock(abs, content)`, emit two blocks:
1. a **head block** `formatTextFileBlock(abs, head)`, where `head` is the first `HEAD_CHARS` UTF-16 code units of the content, sliced surrogate-safe (a lone trailing high surrogate is backed up one code unit so the pair reads whole on the next page);
2. a **directive block** `formatPagedDirectiveBlock(abs, content.length, startLine, injectedLines)`, naming the path and size and telling the model to read the rest with the `read` tool at `offset:startLine, limit:READ_LIMIT`, incrementing `offset` by `READ_LIMIT` until done.

`startLine = (newlines in head) + 1` and `injectedLines = (newlines in head)`: the directive resumes at the first line after the complete lines the head delivered, so no content is skipped regardless of line length (a head ending mid-line re-reads that partial line: redundant tail, never data loss). After paging, subtract the head's estimated cost from `remaining`.

**Sub-head guard.** If the whole content fits in `HEAD_CHARS` (`content.length <= HEAD_CHARS`), inject it whole and emit no directive, even if the threshold tripped: a sub-head-sized file that paged only because of a tight budget would otherwise get a directive pointing past EOF.

The model drives the paging across the turn. The extension cannot issue tool calls itself; the `input` handler only rewrites prompt text.

**Still impossible.** The model never holds a file larger than its context window all at once. Paged delivery gets every byte read across the turn, but not simultaneously. That is a property of the medium, not of this extension.

**Multi-file prompts & imports.** `remaining` is a single shared accumulator across every delivered file in the prompt — top-level tokens **and all transitive markdown imports** (§5.6). Subtract each file's cost from `remaining` as its block is emitted, so every later decision (token or import) sees a budget that accounts for everything injected before it. See §5.6.2 for the full per-type cost table (text, image, binary note) — this is how the extension accounts for the **total** filesize of all files.

**Scope.** Paged delivery applies to text only (including markdown). Images are resized and attached (§5.2) — they are never paged, but they *do* consume budget (§5.6.2). Non-image binaries get a note instead of bytes (§5.3). All three types — text, image, binary note — subtract from the shared `remaining` so the total accounts for every file.

**Notify.** Surface the mode, guarded on `ctx.hasUI`: `#@ injected N whole` versus `#@ injected N whole, M paged`. `N` and `M` span the whole recursion — top-level files plus every transitive import.

**Constants.** `PAGED_THRESHOLD = 0.6`, `MARGIN = 8192`, `HEAD_CHARS = 8192` (UTF-16 code units, roughly the `read` tool's default 2000-line page), `READ_LIMIT = 2000` (the `read` tool's `DEFAULT_MAX_LINES`, emitted in the directive), `DEFAULT_RESERVE = 8192`, `IMAGE_FALLBACK_TOKENS = 2805`.

**Resolved questions:**
- **O-1.** `getContextUsage()` is called at `input` time. When it is `undefined` or `usage.tokens` is `null` (for example right after compaction), `remaining` is `null` and the fallback injects every text file whole. Overflow protection is best-effort, never a regression (test PD3).
- **O-2.** `getContextUsage()` returns `{ tokens, contextWindow, percent }`, so the window is read from `usage.contextWindow`. `ctx.model` is used only for `maxTokens` (the reserve); `ctx.model.contextWindow` is not read. (`DEFAULT_WINDOW` is a dead leftover in the code and is not used.)
- **O-3.** No exported string-based estimator exists (`estimateTokens` takes an `AgentMessage`), so the chars-per-token heuristic `Math.ceil(content.length / 4)` is used.

### 5.6 Markdown transitive imports

A delivered file whose lowercased extension is `md` or `markdown` is, in addition to being a text file (§5.1), an **import source**: its decoded content is scanned for `#@<path>` directives (§4.5), and each resolved import is itself delivered (and, if markdown, scanned in turn).

**Step 1 — read & decode.** Same as §5.1: read the whole file, decode UTF-8. Markdown is always treated as text (it bypasses the §5.1 NUL/binary routing so import scanning always runs). Cost estimate: `Math.ceil(content.length / 4)`.

**Step 2 — claim self.** Add the markdown file's own absolute path to the global `injectedSet` *before* scanning, so a self-import (`notes.md` containing `#@notes.md`) dedups to verbatim and cannot recurse into itself.

**Step 3 — scan for imports.** Compute the file's **code regions** (fenced blocks + inline code, approximate-CommonMark — see §5.6.1), then run `FILE_INJECT_RE` over the content and **drop any match whose start index lies inside a code region**. For each surviving match, clean the token (§4.3); if empty or if it starts with `/` or `~` → ignore (leave verbatim). **Resolve** the rest via `resolveImportPath(token, dirname(abs), tryMdExt=true)` (§4.5): try the exact path; if it is not an existing regular file **and** the token is extensionless (`path.extname(token) === ""`), try `<exact>.md` then `<exact>.markdown` — first existing regular file wins (`#@PRD` → `PRD.md`). If nothing resolves → ignore (leave verbatim). The scan helper is `async` (it stats candidate paths) and maintains a per-file `localSeen` set, checked alongside the global `injectedSet` **on the resolved abs**: if already in either → leave verbatim; otherwise add it to `localSeen` and record the resolved `abs` as a **resolved import** (encounter order is preserved for the depth-first recursion in Step 5). (Dedup keys on the *resolved* abs, so `#@PRD` and `#@PRD.md` in the same file collapse to one injection. The per-file set stops two imports of the same file within one markdown from both being injected; the global set handles cross-file and self-import dedup.) When `markdownBareAtImports` is on (§4.6), the scan additionally runs `BARE_AT_RE` over the content and unions its matches in. `#@file` is matched once (the bare regex forbids a preceding `#`), and dedup still keys on the resolved abs. **Markers are detected here only to resolve imports — they are never stripped from the content** (see §6.4 for why the extension never modifies delivered text), so no `index`/`prefixLen` bookkeeping is recorded.

**Step 4 — emit this file's block (paged decision).** Apply the §5.5 inline-vs-paged decision to the **verbatim** content (the file exactly as read from disk — import markers are *not* stripped; §6.4): inject whole (`formatTextFileBlock(abs, content)`) if it fits, or head + directive if it exceeds. Subtract the block's cost from the shared `remaining`. Bump `paged` if paged. Imports are resolved from the **full** content regardless of whether the parent is paged (we already read all of it).

**Step 5 — recurse into imports (depth-first).** For each recorded `abs` in **encounter order**, call the shared file injector on it. Because each abs passed dedup at scan time and the injector re-checks the global `injectedSet`, every import is injected at most once across the whole prompt. Ordering is **pre-order depth-first**: this file's block, then each import's subtree, before the next sibling — so the model sees a parent's context before the detail it pulls in.

**Budget sharing.** `remaining` is a single mutable accumulator shared across the entire prompt — top-level tokens and every transitive import. Each emitted block (text whole/head, image, binary note) subtracts its cost *before* the next file is decided, so the inline-vs-paged decision is made against the **running total of all files injected so far**, not per-file in isolation (§5.6.2). This is what "account for the total filesize of all files" means in practice.

**Notify.** `count` and `paged` already span the recursion, so `#@ injected N whole, M paged` reports every delivered file, imports included.

#### 5.6.1 Code-region detection (approximate CommonMark)

Compute a sorted list of `[start, end)` ranges that are code, then skip `#@` matches inside them. The two detection regexes (shown here so the backticks are unambiguous):

```ts
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;   // line-anchored; group 1 = the fence run
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;  // backtick run, same-length close
```

1. **Fenced blocks.** Walk lines with a running char offset. A line matching `FENCE_OPEN_RE` opens a block whose fence char is the first of the run (backtick or `~`) and whose length is the run length. From the next line, scan for a closing line that is ` {0,3}` + the **same** fence char repeated ≥ opening length. The range runs from the opening fence's first character through the end of the closing fence line (inclusive of its trailing newline). If no closing fence is found, the range runs to **EOF** (unterminated fences consume the rest, matching CommonMark). Fences of the other char inside a block are literal (do not reopen).
2. **Inline code.** After fenced ranges are known, run `INLINE_CODE_RE` over the full text; each match's full span (backticks included) is a code range, **unless** it already lies inside a fenced range (skip those so we don't double-count). (Approximate: does not model backslash escapes. Good enough to stop the common `` `#@file` `` doc pattern from importing.)

A match is **in code** if `start ≥ someRange[0] && start < someRange[1]` (binary search over the sorted ranges).

> **Why approximate is fine here.** The only failure mode is a `#@` that *should* be exempt but sits in malformed code, or vice versa. The former leaves a harmless verbatim token; the latter imports a file the user can see referenced. Neither corrupts data. Exact CommonMark parsing is out of scope.

#### 5.6.2 Total-size budget accounting

The budget is cumulative over **every** delivered file in the prompt, not a per-file check:

- `remaining` is computed once (§5.5) and mutated in place as blocks are emitted, in emission order (depth-first).
- Each delivered file subtracts its cost at emit time:
  - **Text (whole):** `Math.ceil(content.length / 4)`.
  - **Text (paged head):** `Math.ceil(head.length / 4)`.
  - **Image:** a conservative tile estimate from the resized dimensions, `estimateImageTokens(resized) = max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170 + 85`; when dimensions are unavailable (raw fallback) use the flat `IMAGE_FALLBACK_TOKENS = 2805` (the 2000×2000 resized worst case, 4×4 tiles). Images consume budget but are **never paged** — they are resized and attached (§5.2).
  - **Binary note:** `Math.ceil(noteString.length / 4)` (small, ~tens of tokens).
- The inline-vs-paged decision for each file is greedy/online against the *current* `remaining` (which already reflects every file emitted before it, top-level or import). When `remaining` runs low, subsequent files page rather than overflow. No look-ahead is needed: the monotonic shared accumulator guarantees the running total never silently exceeds the window, and paging degrades gracefully as the budget depletes.

---

