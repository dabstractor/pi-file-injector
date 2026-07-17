# PRD: `#@file` Whole-File Injection & Markdown Import Extension for Pi

**Status:** Draft · **Target:** Pi `@earendil-works/pi-coding-agent` (verified against v0.80.7) · **Artifact type:** Pi TypeScript extension

---

## 1. Overview

### Problem
Pi has no simple, consistent way to say **"put this entire file into the model's context right now."**

- The existing `@file` syntax only auto-reads when passed as a **CLI argument** (`pi @file.txt "question"`). It is parsed from argv by `processFileArguments()` *before* the session starts.
- **Inside the interactive editor**, typing `@file.txt` only triggers path *autocomplete*; on submit the literal text `@file.txt` is sent and the model must call the `read` tool itself.
- Worse, `@file` is **overloaded**: it means "autocomplete a path" interactively *and* "inject a file" at the CLI. Users cannot express a clear, unconditional "inject the whole file" intent in either context without it being ambiguous.

### Solution
A new, dedicated syntax: **`#@<path>`**. It is an **unconditional file-delivery** trigger: whatever file the user names, the model receives all of it. When the user writes `#@filename.txt` anywhere in a prompt and submits, the extension reads the file and delivers it into the prompt **before** the model sees it. If the file fits the model's remaining context it is injected whole; if it exceeds the remaining context it is delivered in pages the model reads through the `read` tool (see §5.5). No configuration either way.

`#@` is deliberately a **different symbol** from `@` so there is zero ambiguity:
- `@file` → Pi's existing behavior (autocomplete interactively; inject at CLI). Left untouched.
- `#@file` → **always** delivers the whole file to the model, in every context (injected whole when it fits remaining context, paged when it exceeds it; see §5.5).

**Markdown transitive imports.** When a delivered file is markdown (`.md`/`.markdown`), the extension also scans its *contents* for further `#@<path>` directives and delivers those files too — recursively, because an imported markdown file is itself scanned. This turns a single `#@spec.md` into "spec.md plus everything spec.md points at," with no extra syntax: the import directive inside a markdown file is the **same** `#@<path>` the user types in a prompt. **Extension shorthand:** a markdown import may omit the `.md`/`.markdown` extension — `#@PRD` resolves to `PRD.md` (or `PRD.markdown`) when no bare `PRD` file exists, because `#@` is a strong import signal and an extensionless name that matches a markdown file after appending `.md`/`.markdown` is treated as an exact match (markdown imports only; top-level tokens stay exact-match). Three guards keep it sane and loop-free: (1) imports resolve **relative to the markdown file's own directory** and absolute/tilde paths are ignored (so a shared doc can't pull arbitrary home/system files), (2) **each absolute path is injected at most once across the entire prompt**, which bounds recursion for free, and (3) `#@` inside fenced or inline code is not an import — code is the escape hatch for a markdown doc that wants to *document* the `#@` syntax. Full spec in §5.6.

### Value proposition
- **One syntax, every context.** Because the extension hooks the `input` event (which fires for *every* prompt — interactive typed messages *and* the initial CLI/`-p` message), `#@file` works identically whether you launch with it or type it mid-session. (See §3.)
- **Explicit intent.** `#@` can't be confused with a path-completion trigger or an email-style `@mention`. The user is saying "give the model this whole file," and that's exactly what happens.
- **Composable for docs.** `#@spec.md` pulls in everything `spec.md` references with the *same* `#@` directive — spec-and-its-dependencies in one token, loop-safe via dedup (§5.6).
- **Zero config by default.** No setup is required — `#@` works out of the box. There is one opt-in setting (`markdownBareAtImports`, §4.6) for users who want a bare `@file.md` to import inside markdown too; without it, behavior is fixed and predictable.

### Tagline
> "`#@file`: the whole file, every time, everywhere."

---

## 2. Goals & Non-Goals

### Goals
1. **New syntax `#@<path>`** that unconditionally **delivers the entire file** into the model's context at prompt-submission time: injected whole when it fits remaining context, paged via the model's `read` tool when it does not (§5.5).
2. **Works in every input context** — interactive TUI, the initial CLI/`-p` message, and RPC — because it operates on the `input` event.
3. **No configuration required.** `#@` works with zero setup; the inline-vs-paged decision is computed automatically from the active model's context window and current usage (§5.5), and there are no knobs for format, image handling, paging, or budget. The single user-facing setting is the opt-in `markdownBareAtImports` (§4.6), off by default.
4. **Correct file-type handling** with no knobs: text → content; image → attached; other binary → a clear note (not garbage); missing/dir → left as a literal token.
5. **Non-destructive & loop-safe.** Leaves the user's original prompt intact; never breaks a prompt on an error; never re-expands its own or other extensions' injected messages.
6. **Markdown transitive imports.** A delivered markdown file (`.md`/`.markdown`) is scanned for further `#@<path>` directives; each resolves **relative to that markdown file's directory**, is delivered as its own block, and is itself scanned if markdown. **An import may omit its `.md`/`.markdown` extension** — an extensionless token (e.g. `#@PRD`) resolves to `PRD.md` or `PRD.markdown` when no bare file of that name exists, treated as an exact match (markdown imports only; top-level tokens stay exact-match, §4.4). Recursion is bounded by **dedup — each absolute path is injected at most once across the whole prompt** (including paths already present as `<file>` blocks). Absolute/tilde paths inside markdown are ignored; `#@` inside fenced or inline code is ignored. An opt-in setting (`markdownBareAtImports`, §4.6) additionally treats a bare `@<path>` (no `#`) as a markdown import, with all the same rules. All other rules (file-type handling, paging, budget) apply to imported files unchanged.
7. **Total-size context accounting.** A single shared context-budget accumulator spans the entire prompt — every top-level token **and every transitive import** — with each delivered file (text whole/head, image, binary note) subtracting its cost *before* the next file is decided, so the inline-vs-paged decision is made against the running total of all files injected so far, not per-file in isolation (§5.6.2).

### Non-Goals
- **No silent truncation.** `#@` never drops or caps file contents without telling the model. A file is either injected whole (when it fits remaining context) or delivered in full through paged reads (§5.5).
- **No manual fallback.** Oversize files are paged automatically. The user does not have to notice an overflow and switch to the `read` tool themselves.
- **No user-facing size config.** The context budget is derived from the active model and current usage. There is no threshold or setting to tune.
- **No globbing / multi-file** (`#@src/*.ts`). Single concrete path per token.
- **No directory reads.** `#@some/dir` is left as a literal token.
- **No transitive imports from non-markdown files.** Only `.md`/`.markdown` content is scanned for `#@` directives; a `#@` inside an injected `.ts`/`.json`/image/etc. is inert.
- **No absolute/tilde markdown imports.** Markdown imports are relative-only by design (portability + a shared doc can't yank arbitrary home/system paths). Top-level user-prompt `#@` still allows absolute and `~/` paths (§4.4).
- **No extension shorthand at the top level.** The `.md`/`.markdown` omission is a markdown-import convenience (authored in files, no live completion). Top-level `#@` tokens stay exact-match — the user has path autocomplete (§14) and types the full name.
- **No replacement of `@`, `read`, or any built-in.** `#@` is purely additive.
- **No custom TUI rendering.** Injected content appears in the user's message bubble normally.
- **No config required to work.** `#@` injection needs no setup; the only setting is the opt-in `markdownBareAtImports` (§4.6). There are no toggles for format, image handling, paging, or context budget — those stay derived/fixed.

---

## 3. Background: How Pi Handles Input (must-read for implementer)

Pi extensions are TypeScript modules exporting a default factory `(pi: ExtensionAPI) => void`. The correct hook is the **`input` event**, emitted from inside `AgentSession.prompt()` — the single entry point for **all** user prompts.

```
user submits prompt (interactive editor  OR  initial CLI/-p message  OR  RPC)
        │
        ▼
  AgentSession.prompt(text)
        │
        ├─► extension commands (/cmd) checked
        ├─► ★ input event ★   ← THIS EXTENSION HOOKS HERE
        │     handler may { action: "transform", text, images }
        ├─► skill (/skill:...) + prompt-template expansion
        └─► agent loop
```

The handler signature (verified in `dist/core/extensions/types.d.ts`):

```ts
pi.on("input", async (event, ctx) => {
  // event.text              -> raw user prompt (contains literal "#@path" text)
  // event.images            -> ImageContent[] already attached
  // event.source            -> "interactive" | "rpc" | "extension"
  // event.streamingBehavior -> undefined | "steer" | "followUp"

  return { action: "transform", text: newText, images: newImages }; // rewrite
  // or
  return { action: "continue" };                                     // pass through
});
```

A `transform` **replaces** the submitted prompt text and image list; the result is stored as the user message and sent to the model.

### 3.1 Why `#@` works everywhere (the key advantage)

Because the `input` event fires inside `prompt()` — and `prompt()` is called for interactive typed messages *and* the initial CLI/`-p`/RPC message — `#@file` injection happens uniformly in **all** contexts. This is something even Pi's own `@file` CLI expansion cannot claim (that expansion runs during argv parsing, *before* `prompt()`, and only at launch).

> **Canonical reference example to mirror:** `examples/extensions/inline-bash.ts` — it scans `event.text` for a regex (`!{cmd}`), expands each match, and returns `{ action: "transform", text, images: event.images }`. Structure this extension the same way, substituting the `#@path` pattern and file-reading for command execution.

### 3.2 Why `#@` is a safe, collision-free trigger

The two-character trigger `#@` (`#` immediately followed by `@`) is unambiguous against everything else in Pi and in prose:

| Existing use of `#` or `@` | Collision with `#@`? | Why |
|---|---|---|
| Pi interactive `@path` autocomplete / `@mention` | ❌ No | Requires bare `@`; `#@` has a leading `#`. |
| Pi CLI `@file` argv expansion | ❌ No | Runs pre-`prompt()` on argv; `#@file` starts with `#`, not `@`, so it's never parsed as a file arg — it reaches `prompt()` as text where we handle it. |
| `github-issue-autocomplete.ts` `#1234` | ❌ No | That matches `#` + digits; `#@` has `@` after `#`. |
| Markdown headings (`# Title`, `## Section`) | ❌ No | `#` + space/text, never `#` + `@`. |
| Email `user@host` | ❌ No | No `#`. |

So `#@` is a clean, dedicated trigger that coexists with all of the above.

### 3.3 Public vs internal utilities

The built-in CLI `@file` path uses helpers that are **not** exported from the package. This extension re-implements the thin missing pieces on top of *exported* APIs only (never import from `dist/...` internals — unstable surface):

| Built-in uses | Exported? | This extension uses |
|---|---|---|
| `resizeImage(bytes, mime)` | ✅ yes | directly (image downscale to provider limits) |
| `formatDimensionNote(resized)` | ✅ yes | directly (image dimension hint) |
| `getLanguageFromPath(path)` | ✅ yes | not used (markdown is treated as text + scanned for imports, §5.6; no per-language formatting) |
| `CONFIG_DIR_NAME` | ✅ yes | project-local config path (`<cwd>/.pi/file-injector.json`, §4.6) |
| `getAgentDir()` | ✅ yes | global config path (`~/.pi/agent/file-injector.json`, §4.6) |
| `processImage(bytes, mime)` | ❌ internal | `resizeImage` instead |
| `detectSupportedImageMimeTypeFromFile(path)` | ❌ internal | small inline MIME table (§5.2) |
| `resolveReadPath(p, cwd)` (tilde + macOS Unicode-space) | ❌ internal | inline tilde expansion via `os.homedir()` (§4) |

---

## 4. The `#@` Syntax Specification

### 4.1 Grammar

```
#@<path>
```

- The literal two-character trigger `#@`, immediately followed by a path token.
- **`<path>`** = a maximal run of non-whitespace characters (`\S+`), then trailing sentence punctuation is trimmed (see §4.3).
- The trigger must appear at **start-of-string** or **after a non-word character** (so `foo#@bar` mid-word does *not* trigger).

### 4.2 Detection regex

```ts
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
```

- `(^|(?<=\W))` — start-of-string **or** a preceding non-word char (space, `(`, `[`, etc.). Blocks mid-word `#@`.
- `#@` — the literal trigger.
- `(\S+)` — the path token (no spaces).
- **Zero-width anchor note:** `(^|(?<=\W))` consumes nothing, so the full match `m[0]` is **exactly** `#@<path>` — precise for string replacement, no leading-char bookkeeping.
- **Same regex for user prompts and markdown content.** Markdown imports reuse this exact regex; the only differences are a base-directory rule (§4.5) and a code-region filter (§5.6.1).

### 4.3 Token cleanup

For each captured raw token `r`:
1. **Trim trailing punctuation** repeatedly: remove any of `` . , ; : ! ? " ' ) ] } > `` from the end until none remain. (Preserves `file.txt`, `~/a/b`, `./x`, `../y`.)
2. If empty after trimming → skip (leave as-is in text).
3. **No escape hatch needed.** (Unlike `@`, there's no need for `##@`; if a user wants a literal `#@`, they... won't, it's not real prose. If ever needed, `#@` inside a fenced code block is still matched — document this as a known minor limitation, or note `# @` with a space avoids it.)

### 4.4 Path resolution (top-level user tokens)

For cleaned token `p` in the **user prompt**:
1. **Tilde expansion:** if `p` starts with `~`, replace a leading `~/` with `os.homedir() + "/"` (or `~` alone with homedir).
2. **Resolve:** `const abs = path.resolve(ctx.cwd, p);`
3. **`fs/promises.stat(abs)`:**
   - throws / not found → **not a file** → leave the `#@p` token verbatim in the text (no injection). *(Do not throw out of the handler.)*
   - is a directory → leave token verbatim.
   - not a regular file → leave token verbatim.
4. **No cwd restriction.** The user explicitly wrote `#@`; absolute paths, `~/...`, and `../...` are all allowed (same trust model as the built-in `read` tool with an explicit path).

> **No extension shorthand here.** Top-level user tokens are exact-match only — a `#@PRD` with no bare `PRD` file is left verbatim (it does **not** fall back to `PRD.md`). The `.md`/`.markdown` shorthand is a markdown-import convenience (§4.5); at the prompt the user has path autocomplete (§14) and types the full name.
>
> **Known limitation (document, do not fix):** paths containing spaces cannot be expressed (a space ends the token). Users with such files use the `read` tool.

### 4.5 Markdown import directives (same grammar, narrower rules)

A markdown file (`.md`/`.markdown`) may contain `#@<path>` directives using **exactly the grammar above** (§4.1–§4.3). Two rules narrow their resolution relative to a top-level user token, one adds extension shorthand, and one rule exempts code:

1. **Relative only.** An import whose cleaned token starts with `/` or `~` is **ignored** (left verbatim in the injected content, not resolved). Only relative tokens are resolved.
2. **Resolution base = the importing markdown file's directory.** `path.resolve(dirname(importingMarkdownAbs), token)`. (Top-level user tokens still resolve against `ctx.cwd`, §4.4.)
3. **Extension shorthand.** When the cleaned token has no file extension (`path.extname(token) === ""` — e.g. `PRD`, `sub/notes`), resolution tries `<exact>.md` then `<exact>.markdown` if the exact path is not an existing regular file: `#@PRD` → `PRD.md` (or `PRD.markdown`). Exact-match wins (a bare `PRD` file beats `PRD.md`); tokens already ending in `.md`/`.markdown` or any other extension are exact-only, so `#@PRD.md` never becomes `PRD.md.md`. Top-level user tokens do **not** get this fallback (exact-match only, §4.4).
4. **Code is exempt.** A `#@<path>` occurring inside a fenced code block or inline code is **not** an import — it is left verbatim and never stripped. This is the escape hatch for markdown that documents the `#@` syntax itself. Detection is approximate-CommonMark (§5.6.1).

5. **Depth-uniform, no cwd fallback.** These rules apply identically at **every** recursion level — the markdown file a top-level `#@` token points directly at is not special-cased relative to files deeper in the chain. Resolution is *always* `dirname(importingMarkdownAbs)`; `ctx.cwd` is never consulted for an in-file import. Consequently a same-named file in **both** the importing file's directory and `ctx.cwd` resolves to the importing file's directory (the cwd copy is never chosen, never falls back), and a token that is missing in the importing file's directory stays verbatim even if a same-named file happens to exist under `ctx.cwd`.

Everything else — token cleanup (§4.3), dedup, file-type handling, paging, budget — applies to imports exactly as to top-level tokens.

### 4.6 Optional bare-`@` markdown imports (config: `markdownBareAtImports`)

By default a markdown import **requires** the `#@` prefix (§4.5). Some doc conventions write file references as a bare `@file.md` (no `#`); to support those without making `#@` mandatory inside markdown, the extension exposes one opt-in setting.

**Config sources.** The setting may live in either of two forms — a dedicated extension file, or a namespaced key (`fileInjector`, distinct from the package `name`) inside Pi's own `settings.json`, co-located with the rest of the user's settings. Pi exposes no public settings accessor to extensions, so both forms are read directly from disk (same pattern as the dedicated file). `settings.json` is open-schema and Pi preserves unknown keys through `/settings` edits and flushes, so the namespaced key is stable. The setting is read from up to four locations and shallow-merged in precedence order — each row overrides the one above; project scope overrides global; within a scope the dedicated file overrides the `settings.json` key:

| # | Source | Path | Key / form | Trust |
|---|---|---|---|---|
| 1 | Global settings | `~/.pi/agent/settings.json` | `fileInjector` (object) | always |
| 2 | Global extension file | `~/.pi/agent/file-injector.json` | whole file | always |
| 3 | Project settings | `<cwd>/.pi/settings.json` | `fileInjector` (object) | trusted only |
| 4 | Project extension file | `<cwd>/.pi/file-injector.json` | whole file | trusted only |

```jsonc
// ~/.pi/agent/settings.json — namespaced key among other Pi settings
{
  "defaultModel": "anthropic/claude-sonnet-4",
  "fileInjector": { "markdownBareAtImports": true }
}
```
```json
// ~/.pi/agent/file-injector.json — dedicated file
{ "markdownBareAtImports": true }
```

**Effect.** When `markdownBareAtImports === true`, markdown import scanning (§5.6) matches **both** `#@<path>` *and* a bare `@<path>`. The bare match uses `BARE_AT_RE = /(^|(?<=[^\w#]))@(\S+)/g` — an `@` at start-of-string or after a non-word char that is **not `#`**, so `#@file` is matched once (by `#@`), never twice. Every other rule — relative-only resolution, extension shorthand (§4.5 rule 3), code-exempt (rule 4), dedup, paging, budget — applies identically. The marker is stripped to its path just like `#@` (stripping 1 char instead of 2).

**Depth-uniform (no first-file asymmetry).** Bare-`@` matching applies at **every** recursion depth, including the very first file a top-level `#@` token pulls in. There is no level at which a delivered markdown file must use `#@` while deeper files may use `@`; the scan in §5.6 step 3 runs `BARE_AT_RE` for every markdown file it processes, and the resolution base is always `dirname(abs)` of *that* file (§4.5 rule 2/5) — never `ctx.cwd` — regardless of depth.

**Scope.** Bare-`@` matching is **markdown-only**. The top-level user prompt is unaffected (always `#@`, §4.4); a bare `@path` at the prompt stays Pi's existing behavior and is never injected by this extension. Non-resolving bare tokens (e.g. `@username` with no matching file) are left verbatim, so a prose mention imports only when it happens to name a real file relative to the markdown's directory.

**Loading.** Config is read on `session_start` (which provides `ctx.cwd` and `ctx.isProjectTrusted()`) and cached for the session; the `input` handler reads the cached value. All four sources are tried in precedence order; a missing or malformed source (or a missing `fileInjector` key) is skipped → default (`markdownBareAtImports: false`), never an error.

---

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

**Step 3 — scan for imports.** Compute the file's **code regions** (fenced blocks + inline code, approximate-CommonMark — see §5.6.1), then run `FILE_INJECT_RE` over the content and **drop any match whose start index lies inside a code region**. For each surviving match, clean the token (§4.3); if empty or if it starts with `/` or `~` → ignore (leave verbatim, no strip). **Resolve** the rest via `resolveImportPath(token, dirname(abs), tryMdExt=true)` (§4.5): try the exact path; if it is not an existing regular file **and** the token is extensionless (`path.extname(token) === ""`), try `<exact>.md` then `<exact>.markdown` — first existing regular file wins (`#@PRD` → `PRD.md`). If nothing resolves → ignore (leave verbatim). The scan helper is `async` (it stats candidate paths) and maintains a per-file `localSeen` set, checked alongside the global `injectedSet` **on the resolved abs**: if already in either → leave verbatim (no strip); otherwise add it to `localSeen` and record `{ index, abs }` as a **resolved import**. (Dedup keys on the *resolved* abs, so `#@PRD` and `#@PRD.md` in the same file collapse to one injection. The per-file set stops two imports of the same file within one markdown from both being stripped; the global set handles cross-file and self-import dedup.) When `markdownBareAtImports` is on (§4.6), the scan additionally runs `BARE_AT_RE` over the content and unions its matches in; each recorded import then carries a `prefixLen` (2 for `#@`, 1 for a bare `@`) so Step 4 strips the right number of marker characters. `#@file` is matched once (the bare regex forbids a preceding `#`), and dedup still keys on the resolved abs.

**Step 4 — strip resolved markers from this file's content.** Remove the literal `#@` (two chars) from each recorded marker, highest index first, leaving the **path** as a readable reference — identical to how resolved markers are stripped from the user prompt (§6.2). The result is the **block content** for this markdown file.

**Step 5 — emit this file's block (paged decision).** Apply the §5.5 inline-vs-paged decision to the *stripped* content (so directive text the model won't see doesn't bias the budget): inject whole (`formatTextFileBlock(abs, stripped)`) if it fits, or head + directive if it exceeds. Subtract the block's cost from the shared `remaining`. Bump `paged` if paged. Imports are resolved from the **full** content regardless of whether the parent is paged (we already read all of it).

**Step 6 — recurse into imports (depth-first).** For each recorded `{ abs }` in **encounter order**, call the shared file injector on `abs`. Because each abs passed dedup at scan time and the injector re-checks the global `injectedSet`, every import is injected at most once across the whole prompt. Ordering is **pre-order depth-first**: this file's block, then each import's subtree, before the next sibling — so the model sees a parent's context before the detail it pulls in.

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

## 6. Output Format & Assembly

### 6.1 Format: Pi-native `<file>` tags

Mirror the exact format Pi's own CLI `@file` expansion emits (from `processFileArguments`), so the model sees identical structure regardless of source:

**Text file** →
```
<file name="/absolute/path/to/file.ts">
<entire file contents>
</file>
```

**Image file** → an `ImageContent` block is attached **and** a text reference tag is emitted:
```
<file name="/absolute/path/to/img.png"><optional dimension hints></file>
```

**Binary (non-image)** →
```
<file name="/absolute/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```

**Paged text** → a head block (§5.5) followed by a directive block:
```
<file name="/absolute/path/to/huge.log">
<first HEAD_CHARS of content>
</file>
<file name="/absolute/path/to/huge.log"><paged: <len> chars; head delivered <injectedLines> complete lines; read the rest with the read tool at offset:<startLine>, limit:2000, incrementing offset by 2000 until done></file>
```

Use the **absolute resolved path** as `name` (matches the CLI format).

### 6.2 Assembly

Maintain as **shared, mutable state across the entire prompt** (top-level tokens + every transitive markdown import — see §5.6):
- `blocks: string[]` — the `<file>…</file>` strings, appended in **pre-order depth-first** emission order (a file's own block, then its imports' subtrees, before the next sibling).
- `images: ImageContent[]` — seeded from `event.images ?? []`, appended to for each image.
- `injectedSet: Set<string>` — resolved absolute paths **claimed** so far; seeded with any paths already present as `<file name="…">` blocks in the text (a prior copy or `@file`), so each path is injected at most once across the whole prompt.
- `count: number` — files delivered (block appended or image attached), whole or paged, **spanning the whole recursion**; `0` means none.
- `paged: number` — subset of `count` delivered via the §5.5 page path.
- `remaining: number | null` — the single context-budget accumulator (§5.6.2); every emitted block subtracts from it.

**Final text:** **append** all blocks below the user's prompt, separated by a horizontal rule, and **strip the trigger** (`#@`, or a bare `@` when `markdownBareAtImports` is on — §4.6) from each resolved marker — the **path** stays as a readable reference (the model gets the data from the appended `<file name="abs">` blocks, so the trigger is pure noise). This stripping happens in two places: (a) resolved **top-level** markers in the user prompt, and (b) resolved **import** markers inside each markdown file's content, *before* that content becomes its block (§5.6 step 4). Markers that did **not** resolve — missing / directory / read-error / deduped / absolute-or-tilde-in-markdown / inside-code — are left byte-for-byte verbatim, `#@` included:

```
<original prompt text, unchanged>

---

<block 1>

<block 2>
...
```

> **Why append, not inline-replace?** Files can be large (this is unconditional). Appending keeps the user's prose readable in the transcript and is the least surprising transformation. The `#@` trigger is stripped from each injected reference (the path stays); failed tokens keep their `#@` verbatim.

**Final images:** the accumulated `images` array (unchanged if none).

**Return:**
- `count > 0` → `return { action: "transform", text: finalText, images: finalImages };`
- else → `return { action: "continue" };` (prompt preserved byte-for-byte).

---

## 7. Technical Reference (verified APIs)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
  resizeImage,          // (bytes: Uint8Array, mime: string, opts?) => Promise<ResizedImage | null>
  formatDimensionNote,  // (resized: ResizedImage) => string | undefined
  CONFIG_DIR_NAME,      // project-local config dir name (".pi") — §4.6 config path
  getAgentDir,          // global agent config dir (~/.pi/agent) — §4.6 config path
} from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

**`ImageContent`** (from `@earendil-works/pi-ai`): `{ type: "image"; data: string; mimeType: string }` where `data` is **base64** (no `data:` URL prefix).

**`resizeImage` / `ResizedImage`:**
```ts
interface ImageResizeOptions { maxWidth?: number; maxHeight?: number; maxBytes?: number; jpegQuality?: number; }
interface ResizedImage {
  data: string;          // base64
  mimeType: string;
  originalWidth: number; originalHeight: number;
  width: number; height: number;
  wasResized: boolean;
}
function resizeImage(inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions): Promise<ResizedImage | null>;
```
Calling `resizeImage(bytes, mime)` with no options caps to **2000×2000** (matches Pi's `images.autoResize` default). Returns `null` if it can't process. The `width`/`height` fields feed the image-token estimate (§5.6.2).

**`input` event contract:**
```ts
interface InputEvent {
  type: "input";
  text: string;
  images?: ImageContent[];
  source: "interactive" | "rpc" | "extension";
  streamingBehavior?: "steer" | "followUp";
}
type InputEventResult =
  | { action: "continue" }
  | { action: "transform"; text: string; images?: ImageContent[] }
  | { action: "handled" };
```
`transform`s chain across handlers (each sees the previous output); return `continue` when you change nothing.

---

## 8. File Structure

Single-file extension, no runtime dependencies. The repo ships two files at the root:

- **`file-injector.ts`** — the extension itself (zero npm imports beyond Pi's own packages).
- **`package.json`** — a thin `"pi"` manifest (`{ "pi": { "extensions": ["file-injector.ts"] } }`)
  that makes the **directory** a loadable pi package. This is required so `pi install .` /
  `pi install /abs/path` work, and so handing the directory to the loader (via a package
  registration or `-e <dir>`) resolves to `file-injector.ts` instead of crashing with
  `Cannot find module '<dir>'` — a directory with no manifest and no `index.ts` has no entry
  point for jiti to import.

Install locations:

- **Global:** `~/.pi/agent/extensions/file-injector.ts` (copy), or `pi install .` (package).
- **Project-local:** `.pi/extensions/file-injector.ts` (copy).

Internal sections (in order):
1. Imports (§7)
2. Constants: `FILE_INJECT_RE`, `BARE_AT_RE`, `INLINE_CODE_RE`, `FENCE_OPEN_RE`, `MIME_BY_EXT`, `MD_EXTS`, `TRAILING_PUNCT`, `SETTINGS_KEY` (settings.json key), budget constants (`PAGED_THRESHOLD`, `MARGIN`, `HEAD_CHARS`, `READ_LIMIT`, `DEFAULT_RESERVE`, `IMAGE_FALLBACK_TOKENS`)
3. Pure/IO helpers: `cleanToken`, `isAbsoluteOrTilde`, `expandTildeAndResolve`, `resolveImportPath` (exact → `.md`/`.markdown`), `isRegularFile`, `readConfig` (§4.6), `extOf`, `isBinary`, `headSlice`, `headStartLine`, `headCompleteLineCount`, `estimateImageTokens`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatPagedDirectiveBlock`
4. Markdown helpers: `computeCodeRanges(content)` → sorted `[start,end][]`; `inCode(index, ranges)` → boolean
5. Core (shared state + recursion): `scanTokens(text, baseDir, opts, state)` → `{index,prefixLen,abs}[]`; `processTokenStream(...)` → resolved indices; `injectFile(abs, state, ctx)` → bool; `injectMarkdown(abs, content, state, ctx)`; `emitText(abs, content, state)`; `subtract(state, cost)`
6. Factory: `export default function (pi: ExtensionAPI) { pi.on("session_start", …) (load `cfg`, §4.6); pi.on("input", ...) }`

Target ~300–380 lines.

---

## 9. Algorithm (pseudocode)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;       // marker "#@"; group 2 = token
const BARE_AT_RE     = /(^|(?<=[^\w#]))@(\S+)/g;    // marker "@" (markdown opt-in, §4.6); not after "#" or a word char
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};
const MD_EXTS = new Set(["md", "markdown"]);
const TRAILING_PUNCT = ".,;:!?\")]}>'";

// §5.6.2 budget constants
const PAGED_THRESHOLD = 0.6, MARGIN = 8192, HEAD_CHARS = 8192, READ_LIMIT = 2000;
const DEFAULT_RESERVE = 8192, IMAGE_FALLBACK_TOKENS = 2805;

// §4.6 config (read on session_start, cached). markdownBareAtImports: also match bare "@path" in markdown.
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

// Shared, mutable state carried across the whole prompt (top-level tokens + imports).
interface State {
  blocks: string[];
  images: ImageContent[];
  injectedSet: Set<string>;   // claimed absolute paths → dedup across the whole prompt
  remaining: number | null;   // single budget accumulator (§5.6.2)
  count: number;              // files delivered (whole + paged + image + binary note)
  paged: number;              // subset delivered via the §5.5 page path
  bareAt: boolean;            // markdown bare-"@" imports enabled? (§4.6)
}

export default function (pi: ExtensionAPI) {
  let cfg: FileInjectorConfig = {};                       // loaded on session_start (§4.6)
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });
  pi.on("input", async (event, ctx) => {
    // --- short circuits ---
    if (event.source === "extension") return { action: "continue" };        // loop prevention
    if (event.streamingBehavior === "steer") return { action: "continue" }; // latency during steering
    if (!event.text?.includes("#@")) return { action: "continue" };         // cheap pre-check

    // seed dedup with <file> blocks already present (prior copy or @file)
    const priorPaths = new Set([...event.text.matchAll(/<file name="([^"]+)">/g)].map(x => x[1]));

    // §5.6.2 budget. Window from usage.contextWindow (NOT ctx.model). O-1: if getContextUsage()
    // is undefined or usage.tokens is null → remaining = null → inject whole (fallback).
    const usage = ctx.getContextUsage?.();
    const remaining = (usage && usage.tokens !== null)
      ? Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN)
      : null;

    const state: State = {
      blocks: [], images: [...(event.images ?? [])],
      injectedSet: priorPaths, remaining, count: 0, paged: 0,
      bareAt: cfg.markdownBareAtImports === true,
    };

    // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping, bare-@ off
    const resolvedIdx = await processTokenStream(
      event.text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
    if (state.count === 0) return { action: "continue" };   // nothing delivered → byte-for-byte

    // strip '#@' from resolved top-level markers (high→low)
    let stripped = event.text;
    for (const i of [...resolvedIdx].sort((a, b) => b - a)) stripped = stripped.slice(0, i) + stripped.slice(i + 2);
    const finalText = `${stripped}\n\n---\n\n${state.blocks.join("\n\n")}`;

    const whole = state.count - state.paged;                 // §5.5 mode-aware notify
    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${whole} whole${state.paged > 0 ? `, ${state.paged} paged` : ""}`, "info");
    return { action: "transform" as const, text: finalText, images: state.images };
  });
}

// Scan a text (user prompt OR markdown content) for import markers that resolve, WITHOUT injecting.
// async because resolution stats candidate path(s); markdown also tries .md/.markdown (§4.5).
// opts.bareAt (markdown only, §4.6) additionally matches a bare "@path" via BARE_AT_RE.
// Per-text dedup via localSeen on the RESOLVED abs; global injectedSet skips already-claimed paths.
async function scanTokens(
  text: string, baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State,
): Promise<{ index: number; prefixLen: number; abs: string }[]> {
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  const localSeen = new Set<string>();
  const out: { index: number; prefixLen: number; abs: string }[] = [];
  // candidate markers: "#@" always (prefixLen 2); bare "@" when opts.bareAt (prefixLen 1).
  // BARE_AT_RE forbids a "#" before the "@", so "#@file" matches once, not twice.
  const cands: { idx: number; token: string; prefixLen: number }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue;             // §5.6.1 — code is exempt
    const token = cleanToken(c.token);
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;     // §4.5 — markdown: relative only
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // §4.5 — exact, then .md/.markdown
    if (!abs) continue;                                                // nothing resolved → leave verbatim
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;    // dedup on resolved abs
    localSeen.add(abs);
    out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
  }
  return out;
}

// Top-level processor: scan the user prompt, inject each resolved token (depth-first),
// return the start indices of markers that resolved (for '#@' stripping).
async function processTokenStream(
  text: string, baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State, ctx: any,
): Promise<number[]> {
  const records = await scanTokens(text, baseDir, opts, state);   // scan once, before any injection
  const resolved: number[] = [];
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue;             // cross-subtree dedup since scan
    const ok = await injectFile(r.abs, state, ctx);         // claims abs, emits block(s), recurses
    if (ok) resolved.push(r.index);
  }
  return resolved;
}

// stat → classify → emit block → (if markdown) scan+strip+recurse. Claims abs on success.
async function injectFile(abs: string, state: State, ctx: any): Promise<boolean> {
  let st;
  try { st = await fs.stat(abs); } catch { return false; }             // missing → leave verbatim
  if (!st.isFile()) return false;                                      // dir → leave verbatim
  state.injectedSet.add(abs);                                          // CLAIM (dedup, incl. self-import)

  const ext = extOf(abs);
  const mime = MIME_BY_EXT[ext];
  try {
    const buf = await fs.readFile(abs);
    if (mime) {
      // IMAGE (§5.2) — consumes budget, never paged
      const resized = await resizeImage(new Uint8Array(buf), mime);
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"),
        mimeType: resized?.mimeType ?? mime,
      });
      state.blocks.push(formatImageBlock(abs, resized));
      subtract(state, estimateImageTokens(resized));                   // §5.6.2
    } else if (MD_EXTS.has(ext)) {
      // MARKDOWN (§5.6) — text block + transitive imports
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
    } else if (isBinary(buf)) {
      // BINARY NOTE (§5.3)
      const note = formatBinaryBlock(abs);
      state.blocks.push(note);
      subtract(state, Math.ceil(note.length / 4));
    } else {
      // PLAIN TEXT (§5.1 + §5.5)
      emitText(abs, buf.toString("utf8"), state);
    }
    state.count++;                                                     // exactly one delivery per claimed file
    return true;
  } catch {
    return false;                                                      // read/processing error → leave verbatim
  }
}

// §5.6 markdown branch: scan → strip resolved markers → emit this block → recurse imports.
async function injectMarkdown(abs: string, content: string, state: State, ctx: any): Promise<void> {
  const dir = path.dirname(abs);

  // Step 3: scan for imports (relative only, outside code; extension shorthand on; bare-@ per state.bareAt)
  const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 4: strip '#@' from resolved import markers (high→low) → block content
  let stripped = content;
  for (const r of [...records].sort((a, b) => b.index - a.index))
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);

  // Step 5: emit this file's block (paged decision on STRIPPED content)
  emitText(abs, stripped, state);

  // Step 6: recurse into imports, depth-first, encounter order (pre-order)
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue;           // belt-and-suspenders (cross-file dedup)
    await injectFile(r.abs, state, ctx);
  }
}

// §5.5 inline-vs-paged decision; pushes block(s); subtracts cost; bumps paged (NOT count).
function emitText(abs: string, content: string, state: State) {
  const fileCost = Math.ceil(content.length / 4);
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    state.blocks.push(formatTextFileBlock(abs, content));               // whole
    subtract(state, fileCost);
  } else if (content.length <= HEAD_CHARS) {
    state.blocks.push(formatTextFileBlock(abs, content));               // sub-head-sized → whole
    subtract(state, fileCost);
  } else {
    const head = headSlice(content);                                   // first HEAD_CHARS, surrogate-safe
    state.blocks.push(formatTextFileBlock(abs, head));
    state.blocks.push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head)));
    state.paged++;
    subtract(state, Math.ceil(head.length / 4));
  }
}

function subtract(state: State, cost: number) {
  if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost);
}

// ---------- helpers ----------------------------------------------------------
function cleanToken(raw: string): string {
  let t = raw;
  while (t.length && TRAILING_PUNCT.includes(t[t.length - 1])) t = t.slice(0, -1);
  return t;
}
function isAbsoluteOrTilde(p: string): boolean {
  return p.startsWith("/") || p.startsWith("~");
}
function expandTildeAndResolve(p: string, baseDir: string): string {
  const home = os.homedir();
  const expanded = p === "~" ? home : p.startsWith("~/") ? path.join(home, p.slice(2)) : p;
  return path.resolve(baseDir, expanded);
}
// §4.5 resolution: exact path first; if markdown import + extensionless token + exact not a file,
// try <exact>.md then <exact>.markdown. Returns the first existing regular file, or null.
async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);
  if (await isRegularFile(abs)) return abs;                            // exact match wins
  if (tryMdExt && path.extname(token) === "") {                        // extensionless shorthand
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;
}
async function isRegularFile(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isFile(); } catch { return false; }
}
// §4.6 — read config from settings.json (namespaced key) + file-injector.json, global then project.
// Precedence (later wins): global settings key → global file → project settings key → project file.
const SETTINGS_KEY = "fileInjector";   // the settings.json key
async function readConfig(ctx: any): Promise<FileInjectorConfig> {
  const tryRead = async (p: string) => {
    try { return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}"); } catch { return {}; }
  };
  const namespaced = (raw: any): FileInjectorConfig =>
    raw && typeof raw === "object" && raw[SETTINGS_KEY] && typeof raw[SETTINGS_KEY] === "object"
      ? raw[SETTINGS_KEY] : {};
  let cfg: FileInjectorConfig = {};
  cfg = { ...cfg, ...namespaced(await tryRead(path.join(getAgentDir(), "settings.json"))) };
  cfg = { ...cfg, ...(await tryRead(path.join(getAgentDir(), "file-injector.json"))) };
  if (ctx.isProjectTrusted()) {
    cfg = { ...cfg, ...namespaced(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json"))) };
    cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  }
  return cfg;
}
function extOf(abs: string): string {
  const base = path.basename(abs);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}
function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
function estimateImageTokens(resized: any): number {
  if (resized && typeof resized.width === "number" && typeof resized.height === "number") {
    const tiles = Math.max(1, Math.ceil(resized.width / 512)) * Math.max(1, Math.ceil(resized.height / 512));
    return tiles * 170 + 85;
  }
  return IMAGE_FALLBACK_TOKENS;
}

// §5.6.1 code-region detection (approximate CommonMark)
function computeCodeRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  // 1) fenced blocks, line by line, with running char offset
  let pos = 0;
  while (pos < content.length) {
    const nl = content.indexOf("\n", pos);
    const lineEnd = nl === -1 ? content.length : nl;
    const line = content.slice(pos, lineEnd);
    const open = FENCE_OPEN_RE.exec(line);
    if (open) {
      const fenceChar = open[1][0];
      const fenceLen = open[1].length;
      const start = pos;
      let k = lineEnd + 1;                       // first char after the opening line's newline
      let end = content.length;                  // default: unterminated → EOF
      while (k < content.length) {
        const nl2 = content.indexOf("\n", k);
        const le2 = nl2 === -1 ? content.length : nl2;
        const trimmed = content.slice(k, le2).replace(/^ {0,3}/, "");
        let r = 0;
        while (r < trimmed.length && trimmed[r] === fenceChar) r++;
        if (r >= fenceLen) { end = nl2 === -1 ? content.length : nl2 + 1; break; } // closing fence found
        if (nl2 === -1) { end = content.length; break; }
        k = nl2 + 1;
      }
      ranges.push([start, end]);
      pos = end;
      continue;
    }
    pos = nl === -1 ? content.length : nl + 1;
  }
  // 2) inline code spans not already inside a fenced range
  INLINE_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_CODE_RE.exec(content)) !== null) {
    if (!inCode(m.index, ranges)) ranges.push([m.index, m.index + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}
function inCode(index: number, ranges: [number, number][]): boolean {
  let lo = 0, hi = ranges.length - 1;            // binary search over sorted ranges
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index < ranges[mid][0]) hi = mid - 1;
    else if (index >= ranges[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}
function headSlice(content: string): string {
  let head = content.slice(0, HEAD_CHARS);       // UTF-16 code units
  if (head.length === HEAD_CHARS) {              // back up one if ending on a lone high surrogate
    const code = head.charCodeAt(head.length - 1);
    if (code >= 0xd800 && code <= 0xdbff) head = head.slice(0, -1);
  }
  return head;
}
function headStartLine(head: string): number { return (head.match(/\n/g)?.length ?? 0) + 1; }
function headCompleteLineCount(head: string): number { return head.match(/\n/g)?.length ?? 0; }
function formatTextFileBlock(abs: string, content: string): string {
  return `<file name="${abs}">\n${content}\n</file>`;
}
function formatImageBlock(abs: string, resized: any): string {
  const hint = resized ? formatDimensionNote(resized) : "";
  return `<file name="${abs}">${hint ?? ""}</file>`;
}
function formatBinaryBlock(abs: string): string {
  return `<file name="${abs}"><binary file — contents not injected; use the read tool if needed></file>`;
}
function formatPagedDirectiveBlock(abs: string, len: number, startLine: number, injectedLines: number): string {
  return `<file name="${abs}"><paged: ${len} chars; head delivered ${injectedLines} complete lines; ` +
    `read the rest with the read tool at offset:${startLine}, limit:${READ_LIMIT}, ` +
    `incrementing offset by ${READ_LIMIT} until done></file>`;
}
```

`state.count` is the number of files delivered (≥ 0, whole + paged + image + binary note); the handler treats `0` as "nothing injected" and returns `continue`.

---

## 10. Edge Cases (implementer checklist)

| Case | Expected behavior |
|---|---|
| No `#@` in prompt | `continue` (no work). |
| `#@nonexistent.txt` | Token left verbatim; no block; no error. |
| `#@some/dir/` (directory) | Token left verbatim. |
| `text #@a.txt more` | File injected, appended below; inline marker becomes `a.txt` (`#@` stripped, path stays). |
| Multiple `#@a.txt #@b.md` | Both injected; blocks appended in order; notify `2 whole`. |
| Same path twice (`#@a.ts` + `#@./a.ts`, or `#@a.md` that imports `a.ts`) | Injected once across the **whole prompt** (shared `injectedSet`, including imports); repeats left verbatim. |
| `#@huge.log` (50 MB) | If it fits remaining context: injected whole. If it exceeds it: head block + paged directive (§5.5). Never silently truncated. |
| `#@data.bin` (binary, NUL) | Binary note block appended; no garbage. |
| `#@pic.png` | Image attached as `ImageContent` (resized); reference block appended. |
| `#@~/notes.md` | Tilde-expanded; resolved; injected. |
| `#@/etc/hosts` (absolute) | Resolved; injected (explicit user intent). |
| `#@file.txt.` (trailing period) | Period trimmed → `file.txt`; injected. |
| `(#@file.txt)` | `(` is non-word → matches; token `file.txt)` → trimmed to `file.txt`; injected. |
| `foo#@bar` (mid-word) | **Not matched** (`#@` preceded by word char `o`). |
| `# @file` (space between) | **Not matched** (trigger is `#@`, not `# @`). |
| Markdown `# Heading` / issue `#1234` | **Not matched** (no `#@`). |
| `#@file` inside a fenced code block (user prompt) | Still matched/injected (known minor limitation; use `# @` or rephrase to avoid). |
| Read throws (permissions) | Caught; token left verbatim; other tokens still processed. |
| `resizeImage` returns `null` | Fall back to raw base64 of original image bytes. |
| Empty file (0 bytes) | Injected as empty `<file name="…">\n\n</file>` — correct and cheap. |
| `source === "extension"` | Skipped entirely (loop prevention). |
| Mid-stream steering | Skipped entirely (latency). |
| RPC / print mode (`ctx.hasUI === false`) | Still injects; skip the `notify`. |
| Initial CLI/`-p` message containing `#@file` | **Also injected** (input event fires in `prompt()`). |
| `#@spec.md` that imports `#@api.md` | Both injected: `spec.md` block (import marker stripped to `api.md`), then `api.md` block. Notify `2 whole`. |
| Markdown import is itself markdown (`a.md`→`b.md`→`c.md`) | All three injected, pre-order: `a.md`, `b.md`, `c.md`. Each once. |
| Cycle (`a.md`→`b.md`→`a.md`) | `a.md` injected once (claimed before its own scan); `b.md`'s `#@a.md` left verbatim. No infinite loop. |
| Markdown import with absolute/tilde (`#@/etc/hosts` inside `a.md`) | Ignored (relative-only); left verbatim as `#@/etc/hosts` in injected content. |
| `#@path` inside fenced/inline code in `a.md` | Not an import; left verbatim. (Escape hatch for documenting `#@`.) |
| `#@notes.md` where `notes.md` imports a missing `api.md` | `notes.md` injected (marker stripped); `#@api.md` left verbatim in `notes.md` content. |
| `#@notes.md` where `notes.md` imports a 50 MB `big.log` | `big.log` evaluated against the shared budget; paged if it exceeds remaining. Counted in notify. |
| Markdown import resolves outside cwd (`#@../shared/api.md` inside `notes.md`) | Allowed (relative to the markdown's dir); injected. |
| Markdown import with a same-named file in BOTH the md's dir AND cwd (`#@b.md` inside `dir/a.md`; both `dir/b.md` and `./b.md` exist) | `dir/b.md` injected (md's dir wins); cwd-root `./b.md` never chosen. Resolution is file-relative at every depth. |
| Markdown import missing in the md's dir but present under cwd (`#@ghost.md` inside `dir/a.md`; only `./ghost.md` exists) | Left verbatim (`#@ghost.md`); **no** cwd fallback — the cwd copy is never injected. |
| Markdown import w/o extension (`#@PRD` in `a.md`; `PRD.md` exists) | Resolves to `PRD.md` (extension shorthand); injected & scanned. Marker stripped to `PRD`. |
| Markdown import w/o extension, `.markdown` (`#@PRD`; only `PRD.markdown`) | Resolves to `PRD.markdown`; injected. |
| Markdown import, exact beats shorthand (`#@readme`; both `readme` and `readme.md`) | Bare `readme` (exact) wins; `readme.md` not imported. |
| Markdown import w/o extension, no match (`#@ghost`; no `ghost`/`ghost.md`/`ghost.markdown`) | Not resolved; left verbatim (`#@ghost`). |
| Markdown import already extended (`#@PRD.md` in `a.md`; missing) | Exact-only (no `PRD.md.md`); left verbatim. |
| Markdown dedup across shorthand (`#@PRD` + `#@PRD.md` in same file) | Same resolved abs → injected once; second marker left verbatim. |
| Top-level extensionless (`#@PRD` in prompt; only `PRD.md`) | Exact-only at top level; left verbatim. |
| Missing `.md` at top level (`#@nope.md`) | Token left verbatim (missing); no scanning. |
| Markdown imports push total over budget | Later files page against the running total; never silently exceed (§5.6.2). |
| `markdownBareAtImports` off (default); `@api.md` in `a.md` | Bare `@` not matched; left verbatim. Only `#@` imports. |
| `markdownBareAtImports` on; `@api.md` in `a.md` (file exists) | Imported (bare-`@`); marker stripped to `api.md`. Same rules as `#@`. |
| `markdownBareAtImports` on; bare `@` in the FIRST imported file (prompt `#@a.md`; `a.md` contains `@b.md`) | `b.md` imported — the first file is not special-cased; bare-`@` is honored at depth 0→1 just like deeper levels. No `#@` required inside `a.md`. |
| `markdownBareAtImports` on; bare-`@` chain across depths (prompt `#@a.md`; `a.md`→`@b.md`→`@c.md`) | `a.md`, `b.md`, `c.md` all injected; every level honored (no asymmetry between first and deeper files). |
| `#@api.md` with the option on | Matched once by `#@` (bare regex skips a `#`-preceded `@`); never double-matched. |
| `@username` in prose (option on; no `username.md`) | Not resolved → left verbatim. Prose imports only if it names a real file. |
| `@api.md` at the top level (option on) | Unaffected — top-level is `#@`-only; Pi's normal `@` behavior. |
| `user@host.com` in markdown (option on) | Not matched (`@` mid-word); left verbatim. |
| Project `markdownBareAtImports: true` in an **untrusted** project | Ignored (`isProjectTrusted()` false); global value used. |
| Missing/malformed config (settings key or `file-injector.json`) | Defaults to `false`; no error, no behavior change. |
| `markdownBareAtImports` under `fileInjector` in `settings.json` | Read like the dedicated file; co-located with the user's other Pi settings. |
| Both `settings.json` key and `file-injector.json` set in the same scope | Dedicated `file-injector.json` wins within that scope; project overrides global. |

---

## 11. Acceptance Criteria & Test Plan

Load the extension:
```bash
pi -e ./file-injector.ts            # quick test (file)
pi -e .                             # quick test (directory — resolves via package.json manifest)
# or install as a package:  pi install .
# or copy to ~/.pi/agent/extensions/file-injector.ts and use /reload
```

### Manual test matrix

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | small `a.ts` (~50 words) | `Review #@a.ts` | Prompt sent to model already contains `a.ts` contents in a `<file name="…">` block; **no `read` tool call**. Original prompt text unchanged; block appended after `---`. |
| 2 | `huge.log` (50 MB) | `Summarize #@huge.log` | If it fits remaining context: injected whole, no `read` call. If it exceeds it: head block + paged directive (§5.5); the model pages the rest via `read`. Notify reflects the mode. |
| 3 | `pic.png` | `Describe #@pic.png` | `ImageContent` attached; `<file name="…">…</file>` reference appended; inline marker becomes `pic.png` (`#@` stripped). |
| 4 | `data.bin` (binary) | `Inspect #@data.bin` | Binary note block appended; no decoded garbage. |
| 5 | missing | `Fix #@nope.ts` | Token left verbatim; prompt otherwise unchanged; model handles. |
| 6 | directory | `List #@src/` | Token left verbatim. |
| 7 | mid-word | `the foo#@bar thing` | **No** expansion (`#@` preceded by word char). |
| 8 | markdown/issue | `# Heading and #1234` | **No** expansion (no `#@`). |
| 9 | multi | `Diff #@a.ts vs #@b.ts` | Both injected; notify says `2 whole`. |
| 10 | tilde | `Read #@~/notes.md` | Expanded; injected. |
| 11 | trailing punct | `See #@a.ts.` | Period trimmed; `a.ts` injected. |
| 12 | initial CLI message | `pi -p "Review #@a.ts"` (extension loaded) | `a.ts` injected in the `-p` run too (input event fires for initial message). |
| 13 | format parity | compare `#@a.ts` output vs `pi @a.ts "x"` CLI output | Both emit `<file name="/abs/a.ts">\n<content>\n</file>` with identical content. |
| 14 | `@` unaffected | `Review @a.ts` (interactive) | `@a.ts` left as literal text (Pi's existing behavior preserved); no injection by this extension. |
| 15 | md import | `notes.md` containing `#@api.md`; `#@notes.md` | `notes.md` block (marker→`api.md`) then `api.md` block; notify `2 whole`; no `read` calls. |
| 16 | md code-exempt | `notes.md` with `` `#@example.ts` `` in a fenced block + a real `#@api.md` | Only `api.md` imported; `#@example.ts` left verbatim in code. |
| 17 | md cycle | `a.md`→`#@b.md`, `b.md`→`#@a.md`; `#@a.md` | `a.md` + `b.md` injected once each; `b.md`'s `#@a.md` verbatim; no loop; notify `2 whole`. |
| 18 | md abs rejected | `notes.md` with `#@/etc/hosts`; `#@notes.md` | `/etc/hosts` not imported; marker verbatim; only `notes.md` injected. |
| 19 | md relative base | `sub/notes.md` imports `api.md` (sibling); `#@sub/notes.md` | `api.md` resolved as `sub/api.md` (relative to the md's dir), injected. |
| 20 | budget total | `#@a.md` importing 3 files + `#@big.log` (huge) | Imports share budget with top-level; `big.log` pages when total exceeds remaining; notify counts all delivered files. |
| 21 | md ext-shorthand | `notes.md` imports `#@api` (`api.md` exists); `#@notes.md` | `notes.md` block (marker→`api`) then `api.md` block; notify `2 whole`. |
| 22 | md ext exact-wins | `notes.md` imports `#@readme` where both `readme` and `readme.md` exist; `#@notes.md` | Bare `readme` (exact) injected, not `readme.md`; notify `2 whole`. |
| 23 | md ext `.markdown` | `#@api` where only `api.markdown` exists; `#@notes.md` | Resolves to `api.markdown`; injected. |
| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
| 25 | bare-`@` off (default) | `notes.md` with `@api.md` (exists); `#@notes.md` | `api.md` **not** imported (default); only `notes.md`; `@api.md` left verbatim. |
| 26 | bare-`@` on | config `markdownBareAtImports:true`; `notes.md` with `@api.md` (exists); `#@notes.md` | `notes.md` block (marker→`api.md`) then `api.md` block; notify `2 whole`. |
| 27 | bare-`@` on, `#@` still works | config on; `notes.md` with `#@api.md`; `#@notes.md` | `#@api.md` matched once, injected once; notify `2 whole`. |
| 28 | bare-`@` on, top-level unaffected | config on; prompt `#@notes.md` (notes imports `@x.md`); also type `@other.md` in prompt | `@other.md` at top level left as Pi's `@` behavior (not injected); only the `#@` chain runs. |
| 29 | bare-`@` via settings.json | `markdownBareAtImports:true` under `fileInjector` in settings.json; `notes.md` with `@api.md` (exists); `#@notes.md` | Same as #26 but via the settings.json key: `api.md` imported (bare), notify `2 whole`. |
| 30 | md relative disambiguation | `dir/a.md` imports `#@b.md`; **both** `dir/b.md` and `./b.md` exist; `#@dir/a.md` | `dir/b.md` injected (the md's dir wins); cwd-root `./b.md` has zero blocks. Proves resolution is file-relative, not cwd-relative. |
| 31 | md relative, deep + cwd-indep. | `directory/otherdir/some/file.md` imports `#@file2.md`; only `…/some/file2.md` exists; also a stray `./file2.md`; `#@directory/otherdir/some/file.md` | `…/some/file2.md` injected (the importing file's dir), never `./file2.md`. |
| 32 | bare-`@` first-file + chain | config on; prompt `#@a.md`; `a.md`→`@b.md`→`@c.md` (all bare `@`) | `a.md`, `b.md`, `c.md` all injected; the first imported file's bare-`@` is honored (no asymmetry vs. deeper files); notify `3 whole`. |

### Automated sanity check (optional)

Beyond the in-process `sharp-at-test` command above, two standalone Node scripts (zero-dep, load the real extension via Pi's jiti loader) pin the behaviors in this section as runnable regression gates:

- **`file-injector.test.mjs`** — the full §11 matrix + §10 edges (the project's `npm test`).
- **`relative-imports.test.mjs`** — focused on the two properties that are easiest to regress: **(a)** every `[#]@path` inside a delivered markdown resolves relative to that file's directory at every depth (never `ctx.cwd`; a same-named cwd-root file never wins, and a missing-in-dir import never falls back to cwd), and **(b)** with `markdownBareAtImports` on, bare-`@` is honored at **every** depth including the very first imported file (cases 30–32 above). Covers four layers: `resolveImportPath`, `scanTokens`, `injectFiles`, and the real `input` handler with a hermetic project config.

```ts
pi.registerCommand("sharp-at-test", {
  description: "Self-test for #@ injection",
  handler: async (_args, ctx) => {
    // create temp text + binary + markdown (with imports) files; run scanTokens/injectFile
    // on sample strings; assert: text injected, binary noted, missing left, email/mid-word
    // not matched, markdown imports resolved relative to the md's dir, code-block imports
    // skipped, cycle terminates, each path injected once.
    ctx.ui.notify("sharp-at self-test passed", "info");
  },
});
```

---

## 12. Implementation Notes & Gotchas

1. **Loop prevention is mandatory.** Always `return { action: "continue" }` for `event.source === "extension"`. Without it, any extension (including this one via `sendUserMessage` paths) that re-feeds `#@` text would loop infinitely.
2. **Skip steering for latency.** `event.streamingBehavior === "steer"` mid-stream → `continue` (mirrors `input-transform-streaming.ts`). `followUp` and normal idle input are processed.
3. **Zero-width anchor.** `m[0]` is exactly `#@<path>`; the `(^|(?<=\W))` consumes nothing. No leading-char bookkeeping.
4. **`includes("#@")` pre-check.** Cheap guard before touching the regex / doing I/O for the common no-`#@` case.
5. **Never throw out of the handler.** Wrap all `stat`/`readFile`/`resizeImage` in try/catch; on any error leave the token verbatim and continue. A prompt must never be lost.
6. **`resizeImage` takes `Uint8Array`.** Wrap explicitly: `new Uint8Array(buf)`.
7. **Images are base64, no data-URL prefix.** `ImageContent.data` is raw base64.
8. **Image resize is a necessity, not a config.** Providers reject oversized images; `resizeImage` (2000×2000 default) is hardcoded so injection actually succeeds. This does not contradict "no config" — it's required for correctness, and the user still gets "the whole image" (downscaled to fit).
9. **Binary detection is for routing, not gating.** Use the NUL-byte heuristic *only* to avoid injecting decoded garbage from non-image binaries. Image files skip this check entirely (handled by MIME type first). Markdown skips it too (always treated as text so import scanning runs).
10. **Append, don't inline-replace; strip the trigger.** Large files would wreck the transcript bubble. Append blocks below a `---`, and strip `#@` from each resolved marker (the path stays). Failed tokens are left verbatim, `#@` included.
11. **Whole file always reaches the model.** Never silently truncate or cap a file. When it fits remaining context, inject inline; when it exceeds it, page via §5.5. The contract is "the model gets all of it," not "all of it in one block."
12. **Don't touch `@`.** This extension must not match or transform bare `@path`. Only `#@path`. Verify with test #14.
13. **Markdown recursion is bounded by dedup, not depth.** Each absolute path is claimed in `injectedSet` *before* its content is scanned (self-imports dedup to verbatim). Termination is guaranteed because the set of injectable files is finite and each is processed at most once. No separate depth limit is needed.
14. **Code-region detection is approximate CommonMark.** Only fenced blocks and inline code are exempted (§5.6.1). The failure modes are benign (a verbatim token left, or an unexpected import) and never corrupt data. Don't pull in a full MD parser.
15. **Budget is one shared accumulator.** `remaining` is mutated in emission order across top-level tokens and every transitive import; every block (text/image/binary) subtracts its cost. The inline-vs-paged decision is greedy against the running total — that is how the total filesize of all files is accounted for (§5.6.2).
16. **Strip resolved markers in both scopes.** Top-level resolved markers are stripped from the user prompt; resolved import markers are stripped from each markdown file's content *before* it becomes a block (§5.6 step 4). Failed/deduped/absolute/inside-code markers keep `#@` verbatim everywhere.
17. **Scan before inject (top-level).** `processTokenStream` runs `scanTokens` once over the whole prompt *before* injecting anything, so a later top-level token whose path an earlier token's import already claimed is left verbatim (cross-subtree dedup). Markdown does its own scan+strip+emit+recurse in `injectMarkdown`.
18. **Extension shorthand is markdown-only and keyed on the resolved abs.** `resolveImportPath` tries exact → `.md` → `.markdown` only for *extensionless* markdown-import tokens (`tryMdExt: true`); top-level tokens pass `tryMdExt: false` (exact-only — the user has §14 autocomplete and types the full name). Dedup runs on the *resolved* abs, so `#@PRD` and `#@PRD.md` in one file collapse to one injection — which is why `scanTokens` is `async` (it stats candidate paths before checking `injectedSet`/`localSeen`).
19. **The bare-`@` option is markdown-only, opt-in, and never double-matches `#@`.** `markdownBareAtImports` (default `false`, read from `file-injector.json` or the `fileInjector` key in `settings.json` (§4.6) on `session_start`, project sources honored only when `ctx.isProjectTrusted()`) adds bare-`@` matching to markdown scanning only — never the top-level prompt (Pi's `@` is left untouched, §3.2). `BARE_AT_RE` uses `(?<=[^\w#])` so an `@` preceded by `#` is not matched, hence `#@file` fires once. Each match carries `prefixLen` (2 for `#@`, 1 for `@`); Step 4 strips `slice(index, index + prefixLen)`. Non-resolving bare tokens (prose `@mentions`) stay verbatim.

---

## 13. Design Rationale & Tradeoffs

### 13.1 Why unconditional delivery (no silent size gate)
The user wants **"inject the entire file every time. No maxWords, no config."** The earlier framing of this as "no size gate, accept that huge files blow the context" was dishonest: the model's context window is a hard limit, and a file larger than the remaining context cannot be injected whole by anyone. The honest contract is "the whole file always reaches the model": injected inline when it fits, paged through the model's `read` tool when it does not (§5.5). There is still no silent truncation and no size knob for the user.

### 13.2 The tradeoff (be honest about it)
For files that fit remaining context, behavior is unchanged: the whole file is injected inline. For files that exceed it, the tradeoff is that the file arrives **paged** rather than in one block:
- The model reads the file across the turn via the `read` tool, so it sees all of it but never holds all of it simultaneously (impossible past the context window).
- Paging is model-driven: the extension emits a directive, the model issues the reads. This is reliable for typical `#@` tasks (review, summarize, diff) but not guaranteed, because the `input` handler can only rewrite prompt text; it cannot force a tool call.
- The alternatives are worse: silently truncating the file (the model works from a partial file with no signal), or letting the request fail (the user gets an error and must retry by hand).

### 13.3 Why a separate symbol instead of reusing `@`
- `@` is overloaded (autocomplete + CLI inject). Overloading it further with "inject whole file interactively" would be ambiguous and would change existing behavior.
- `#@` is unambiguous, collision-free (§3.2), and signals stronger intent — the `#` reads as "force/sharp/inject."
- The `#` does **not** piggyback on Pi's `@` autocomplete on its own — Pi's file-completion gate only fires for `@` at a token boundary, and `#` glued in front closes it. Path completion for `#@` is provided by a separate autocomplete provider (see §14).

### 13.4 Why (almost) no user-facing config
There is still no configuration *required*, and no knobs for the things that should just work: the inline-vs-paged decision is computed from the active model's context window and the current usage estimate (§5.5), and there are no toggles for format, image handling, paging, or the context budget — those stay derived/fixed. The one opt-in is `markdownBareAtImports` (§4.6): a bare `@file.md` is a widespread doc convention, and forcing `#@` inside markdown would fight existing docs. It is opt-in (default off) precisely so the default stays zero-setup and unambiguous — `#@` remains the only thing that ever triggers injection at the prompt, and bare-`@` matching never escapes markdown content. Knobs for anything else would reintroduce the complexity the user asked to remove.

### 13.5 Relationship to a size-gated `@`
With §5.5, `#@` itself covers both the inline and the oversize cases, so a separate size-gated `@` extension is no longer needed for token-economy reasons. `@` stays as Pi's built-in autocomplete and CLI argument handling, unchanged. If a future feature wants `@` to inline small files interactively (which `#@` already does), it can be built independently; it does not compete with this PRD.

### 13.6 Why markdown transitive imports, and why these guards

`#@` already delivers a whole file; markdown files are the one format that commonly *references other files by path* in-band. Letting `#@spec.md` pull in everything `spec.md` points at matches user intent ("give me the spec and its dependencies") with **no new syntax** — the import directive is the same `#@<path>`.

The three guards are deliberate:
- **Relative-only + resolve-from-the-md's-dir** makes imports portable and stops a shared markdown doc from silently pulling `/etc/passwd` or `~/.ssh/id_rsa`. Top-level user tokens stay unrestricted (the user typed them deliberately).
- **Dedup (each abs once)** bounds recursion for free — cycles terminate, shared dependencies are injected once. No fragile depth counter.
- **Code is exempt** because markdown's primary use of `#@` in the wild is *documenting* `#@`. Without the exemption, every doc that shows a `#@` example would import a stray file. Fenced/inline code is the natural escape hatch.

The cost is real: a single `#@` can now balloon to many files. That is why imports share the single context budget (§5.6.2) and page when the running total exceeds remaining — the model never silently receives more than fits, and the total filesize of every file (top-level plus imports) is accounted for in one accumulator.

**Why extension shorthand, and why markdown-only.** Markdown imports are authored in files where there is no live path completion (§14 is prompt-only), so a bare `#@PRD` is a natural way to reference the `PRD.md` doc — `#@` is a strong enough import signal that an extensionless name matching a markdown file after appending `.md`/`.markdown` should be treated as an exact match. The fallback is deliberately scoped to markdown imports and to *extensionless* tokens: exact-match always wins (a bare `PRD` file beats `PRD.md`), an explicit `#@PRD.md` never becomes `PRD.md.md`, and top-level prompt tokens stay exact-only (the user has autocomplete there). Dedup keys on the resolved abs, so `#@PRD` and `#@PRD.md` in the same file inject once.

---

## 14. Interactive Path Autocomplete (TUI)

`#@` is a two-character trigger, and Pi's built-in `@` file-completion (gitignore-aware, powered by
`fd`) only fires when `@` sits at a token boundary. A `#` glued immediately in front of the `@`
closes that gate, so — out of the box — typing `#@` yields **no** path suggestions; the user must
type the full path by hand.

### 14.1 Hook

Pi exposes `ctx.ui.addAutocompleteProvider(factory)` (TUI/RPC modes only; see Pi's
`docs/extensions.md` → "Autocomplete Providers"). The factory wraps the built-in provider (received
as `current`) and can override three levers: `getSuggestions`, `applyCompletion`, and
`shouldTriggerFileCompletion` (the gate). The extension registers it on `session_start`, guarded for
headless print/json modes. This is purely a TUI affordance — headless `pi -p "...#@file..."` is
unaffected (the user types the full path; injection still runs via the `input` handler).

### 14.2 Implementation (shipped) — line-rewrite reuse (Option 1)

**Option 2 (gate override) was tried first and rejected.** Overriding only
`shouldTriggerFileCompletion` to return `true` at `#@<partial>` (delegating the rest to the built-in)
produced **no suggestions**: Pi's built-in `@`-query extraction is itself boundary-strict
(`CombinedAutocompleteProvider.extractAtPrefix` requires `@` at a token boundary), so opening the
gate alone is insufficient. Reverted.

**Shipped: Option 1 — line-rewrite reuse.** In `getSuggestions`, detect `#@<partial>` at the cursor,
rewrite that one `#` into a space (so the built-in sees a clean `@<partial>` at a valid boundary),
delegate to `current.getSuggestions(...)`, then remap the result back to `#@`: `prefix "@<partial>"`
→ `"#@<partial>"` and each item value `@<path>` → `#@<path>`. `applyCompletion` is implemented
inline for `#@` prefixes (deterministic replace, cursor placed after the inserted value) and
delegates otherwise; `shouldTriggerFileCompletion` delegates to the built-in unchanged. This reuses
Pi's entire file engine — gitignore-aware `fd` listing, sorting, fuzzy matching — with **zero**
reimplementation; only a one-character line rewrite and a prefix/value remap are added.

A last-resort **Option 4** (reimplement file listing via `fd`/`git ls-files`, à la Pi's
`github-issue-autocomplete` example) remains documented but was **not** needed — reuse through
`current` works.

### 14.3 Non-goal

No suffix-style `@<file>#` trigger. It would inherit Pi's `@` completion for free but demands a
trailing `#` the user must type (and often backspace an inserted boundary for), and it makes `#` a
suffix marker that collides with prose. `#@` (prefix) with a completion provider is strictly better.

### 14.4 Scope note (markdown imports are injection-only)

The autocomplete provider (§14.2) only helps the user type a **top-level** `#@path` in the prompt.
Import directives **inside** an injected markdown file are never typed in the editor, so they get no
autocomplete — and they need none (the markdown author writes them by hand in the file, where normal
file-path completion in their editor applies). The import path is resolved relative to the markdown
file's directory (§4.5), not the prompt cwd; an extensionless import token also tries `.md`/`.markdown`
(§4.5).

---

## Appendix A — Minimal skeleton

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const BARE_AT_RE     = /(^|(?<=[^\w#]))@(\S+)/g;    // §4.6
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};
const MD_EXTS = new Set(["md", "markdown"]);
const TRAILING_PUNCT = ".,;:!?\")]}>'";
const PAGED_THRESHOLD = 0.6, MARGIN = 8192, HEAD_CHARS = 8192, READ_LIMIT = 2000;
const DEFAULT_RESERVE = 8192, IMAGE_FALLBACK_TOKENS = 2805;

interface FileInjectorConfig { markdownBareAtImports?: boolean; }
interface State {
  blocks: string[]; images: ImageContent[];
  injectedSet: Set<string>; remaining: number | null; count: number; paged: number; bareAt: boolean;
}

export default function (pi: ExtensionAPI) {
  let cfg: FileInjectorConfig = {};
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text?.includes("#@")) return { action: "continue" };

    const priorPaths = new Set([...event.text.matchAll(/<file name="([^"]+)">/g)].map(x => x[1]));
    const usage = ctx.getContextUsage?.();
    const remaining = (usage && usage.tokens !== null)
      ? Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN)
      : null;
    const state: State = {
      blocks: [], images: [...(event.images ?? [])],
      injectedSet: priorPaths, remaining, count: 0, paged: 0,
      bareAt: cfg.markdownBareAtImports === true,
    };

    const resolvedIdx = await processTokenStream(event.text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
    if (state.count === 0) return { action: "continue" };

    let stripped = event.text;
    for (const i of [...resolvedIdx].sort((a, b) => b - a)) stripped = stripped.slice(0, i) + stripped.slice(i + 2);
    const whole = state.count - state.paged;
    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${whole} whole${state.paged > 0 ? `, ${state.paged} paged` : ""}`, "info");
    return { action: "transform" as const, text: `${stripped}\n\n---\n\n${state.blocks.join("\n\n")}`, images: state.images };
  });
}

// ... scanTokens (async) / processTokenStream / injectFile / injectMarkdown / emitText / subtract
//     + helpers (incl. resolveImportPath, isRegularFile, readConfig) + BARE_AT_RE + computeCodeRanges / inCode  per §9 ...
```

**Companion file — `package.json`:** the skeleton above is the whole extension, but the repo also
needs a `package.json` with a `"pi"` manifest so the *directory* is loadable (see §8). Without it,
`pi install .` / `-e <dir>` / a package registration all fail with `Cannot find module '<dir>'`:

```json
{ "name": "pi-file-injector", "version": "0.1.0", "private": true, "type": "module",
  "pi": { "extensions": ["file-injector.ts"] } }
```

**Done-definition:** all 32 manual test cases in §11 pass; no uncaught errors; the model receives whole-file contents with **zero** `read` tool calls for `#@`-injected files that fit remaining context; markdown imports resolve relative to the importing file's directory (with `.md`/`.markdown` extension shorthand for extensionless tokens), skip code blocks, terminate on cycles, and dedup across the whole prompt; the context budget accounts for the total filesize of all delivered files (top-level + imports); prompts without `#@` (including bare `@file`) are byte-for-byte unchanged; `#@` works in both interactive and initial `-p` messages.
