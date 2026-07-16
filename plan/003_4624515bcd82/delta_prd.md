# Delta PRD: `#@file` — Markdown Transitive Imports

**Status:** Draft · **Delta against:** `plan/002_0ac3eb160af7` (paged delivery §5.5, fully implemented) · **Artifact type:** modification to existing `file-injector.ts` (single file, no new files, no new dependencies)

---

## 1. What Actually Changed (Diff Analysis)

A structural diff of the previous PRD (`plan/002_0ac3eb160af7/prd_snapshot.md`) vs. the current PRD (`plan/003_4624515bcd82/prd_snapshot.md`) yields **one** new feature plus a cluster of reframings. Only the new feature requires implementation work.

### Change A — §5.5 paged-delivery refinements (budget source, head slicing, resolved open questions) — **ALREADY IMPLEMENTED**
The current PRD's §5.5 was *refined* relative to the 002 snapshot (budget now reads `usage.contextWindow` instead of `ctx.model.contextWindow`; `HEAD_BYTES` → `HEAD_CHARS` UTF-16 code units sliced surrogate-safe; directive now carries `startLine`/`injectedLines` derived from the real head line count; sub-head guard; `READ_LIMIT=2000` constant; O-1/O-2/O-3 marked **resolved**). **All of this is already in the code** (`file-injector.ts:198-208` budget, `headSlice` L126, `headStartLine` L141, `headCompleteLineCount` L149, `formatPagedDirectiveBlock(abs, totalBytes, startLine, injectedLines)` L163, sub-head guard inside the paged branch, O-1 `remainingBudget===null` fallback). **No delta task.**

### Change B — Markdown transitive imports (§5.6 + §4.5 + §5.6.1 + §5.6.2) ← **THE DELTA**
A new §5.6 makes a delivered markdown file (`.md`/`.markdown`) an **import source**: its decoded content is scanned for further `#@<path>` directives, each resolved import is itself delivered (and, if markdown, scanned in turn). Recursion is bounded by **dedup** — each absolute path is injected at most once across the whole prompt. Three guards: (1) imports resolve **relative to the importing markdown file's directory** and absolute/tilde imports are ignored, (2) `#@` inside fenced or inline code is **not** an import (code is the escape hatch), (3) one global `injectedSet` dedups across the whole recursion. This is the headline feature and is **not implemented** (`grep` for `MD_EXTS|injectMarkdown|computeCodeRanges|INLINE_CODE_RE` in `file-injector.ts` returns nothing).

A required companion is **total-size budget accounting (§5.6.2)**: the context-budget accumulator becomes a **single shared `remaining`** spanning every delivered file — top-level tokens *and* every transitive import — and **all three file types** (text, image, binary note) now subtract their cost so the running total never silently exceeds the window. Today only text files subtract (`file-injector.ts:300,324`); images and binary notes do not. This delta closes that gap (new `estimateImageTokens` + `IMAGE_FALLBACK_TOKENS`).

Supporting this, the current PRD's §9 pseudocode restructures the single linear `injectFiles` loop into **shared mutable `State`** (`blocks`, `images`, `injectedSet`, `remaining`, `count`, `paged`) plus recursive helpers (`scanTokens`, `processTokenStream`, `injectFile`, `injectMarkdown`, `emitText`, `subtract`). The current code's two separate dedup sets (`priorPaths` L220 + `injectedThisRun` L229) consolidate into the shared `injectedSet`; the linear `for…matchAll` loop (L237) becomes a scan-then-inject depth-first walk. **This refactor is the structural prerequisite for recursion** and is the first task below.

### Reframings (noted for awareness — no standalone tasks)
- **Title** gains "& Markdown Import". §1 Solution/Value-prop, §2 Goals (new goals 6 & 7) & Non-Goals (two new bullets), §3.3 utilities table (`getLanguageFromPath` → "not used"), §4.2 ("same regex for prompts and markdown"), §4.4 title ("top-level user tokens"), §5.2/§5.3 (budget-consumption notes), §6.2 (shared-state assembly), §7 (`resizeImage` width/height note), §8 (target ~150–220 → ~300–380 lines), §10 (new edge cases), §11 (new cases 15–20), §12 (notes 13–17), §13.6 (new rationale), §14.4 (autocomplete scope note), Appendix A (rewritten skeleton). All describe the §5.6 mechanism — covered by the implementation tasks below and the README sync; no independent build work.
- **§14.4** merely *documents* that the autocomplete provider is top-level-only (import directives are never typed in the editor). The shipped autocomplete code (`file-injector.ts:384+`) needs **no change** — this is a doc-only clarification that lands in the README sync.

---

## 2. Scope of This Delta

Add **markdown transitive imports** to `injectFiles`: a delivered `.md`/`.markdown` file is scanned for relative `#@<path>` directives (outside code), each resolved import is delivered as its own block and recursed into, with a single shared context budget and a single global dedup set bounding the recursion. Refactor the linear core into shared mutable `State` + recursive helpers to support it, and extend budget accounting to images and binary notes. **Everything else** — detection regex, top-level path resolution, image/binary/missing handling, strip-`#@`, paged delivery, autocomplete provider — is **unchanged**.

### Verified context (no re-research needed — all from `plan/002_0ac3eb160af7/architecture/`)
- **No new Pi API is required.** Markdown imports read files via `node:fs`/`node:path` (already used) and reuse `FILE_INJECT_RE`. `estimateImageTokens` reads `ResizedImage.width`/`height`, both **VERIFIED present** (`pi_api_verification.md` §8: `width: number; height: number` on `ResizedImage`). The `read` tool's `DEFAULT_MAX_LINES = 2000` (**VERIFIED**, §6) is already pinned as `READ_LIMIT`.
- **Context budget shape is VERIFIED** (`pi_api_verification.md` §1-2): `ContextUsage = { tokens: number|null; contextWindow: number; percent: number|null }`; `getContextUsage()` returns `ContextUsage | undefined`. The existing budget code (`file-injector.ts:198-208`) already handles both `undefined` and `tokens===null` → `remaining=null` → inject-whole fallback (O-1). This delta only *shares* `remaining` across recursion and adds image/binary costs.
- **Test harness** (`test_and_docs_analysis.md` §1): zero-dependency `file-injector.test.mjs`; real `fs` against a temp dir; `buildFixtures()` writes `a.ts`, `b.ts`, `pic.png`, `data.bin`, `huge.log`, etc.; `makeMockCtx(cwd,{hasUI})` + `captureHandler()` exercise `injectFiles`/the handler directly; module-surface sanity list at L117-124 must track new exports. New markdown fixtures (e.g. `notes.md` importing `api.md`) are added the same way.
- **Single-file constraint** (`test_and_docs_analysis.md` §3): `package.json` loads only `file-injector.ts`; all markdown logic lives there. No new `dependencies`.
- **`DEFAULT_WINDOW = 200000`** (`file-injector.ts:23`) is a dead leftover (the budget reads `usage.contextWindow`); leave it — out of scope.

---

## 3. Implementation Requirements

### Requirement MI-1 — Refactor core to shared mutable `State` (prerequisite, no behavior change)
Introduce a shared `State` object carried across the whole prompt (top-level tokens + future imports) and restructure the single linear `injectFiles` loop (`file-injector.ts:237-337`) into recursive-ready helpers. **All existing tests must pass byte-for-byte after this task** — markdown recursion is added in MI-2; this task only changes internal structure.

**State interface** (mirrors PRD §9):
```ts
interface State {
  blocks: string[];
  images: ImageContent[];
  injectedSet: Set<string>;   // claimed absolute paths → dedup across whole prompt
  remaining: number | null;   // single budget accumulator (§5.6.2)
  count: number;              // files delivered (whole + paged + image + binary note)
  paged: number;              // subset delivered via the §5.5 page path
}
```

**Consolidate dedup.** Merge `priorPaths` (L220) + `injectedThisRun` (L229) into `state.injectedSet`, **seeded with `priorPaths`** (every `<file name="…">` already in `text`, preserving the F1/F1c validator invariants — `test_and_docs_analysis.md` §1.7). Each successful delivery adds the abs path to `injectedSet`.

**Helpers to extract** (signatures from PRD §9):
- `scanTokens(text, baseDir, opts: { allowAbsTilde: boolean; skipCode: boolean }, state): { index, abs }[]` — scan `text` with `FILE_INJECT_RE` **without injecting**; per-text `localSeen` + global `state.injectedSet` check; returns resolved markers (start index + abs). For this task `opts` is always `{ allowAbsTilde: true, skipCode: false }` (the user-prompt profile); the markdown profile lands in MI-2. `opts.skipCode` is accepted but a no-op stub here (`codeRanges = null`).
- `processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]>` — scan once (before any injection, for cross-subtree dedup), then `injectFile` each record depth-first; returns the start indices of markers that resolved (for `#@` stripping).
- `injectFile(abs, state, ctx): Promise<boolean>` — stat → classify (image/text/binary; **markdown branch deferred to MI-2**) → emit block → `state.count++`. Claims `abs` in `state.injectedSet` on success.
- `emitText(abs, content, state)` — the existing inline-vs-paged decision (L293-326), lifted verbatim into a helper that `push`es block(s) and calls `subtract`. **Behavior unchanged.**
- `subtract(state, cost)` — `if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost)`.

**Budget.** Keep budget computation where it is (top of `injectFiles`, L198-208) but store the result in `state.remaining` instead of the local `remainingBudget`. Text-file subtraction (L300, L324) moves into `emitText`/`subtract`.

**External contract unchanged.** `injectFiles` keeps its exact signature and return type `{ text, images, injected, paged }` (already present, L179-189); the handler (L384+) is untouched. `count===0` still returns the original `text`/`images` ref byte-for-byte (L338); top-level marker stripping (L350) still operates on the indices `processTokenStream` returns.

- **Mode A docs:** Update the `injectFiles` JSDoc (L162-175) to describe the shared-`State` internal structure and that the budget now spans the whole prompt (forward-reference §5.6). No README change here (Mode B is MI-3).

### Requirement MI-2 — Markdown transitive imports + total-size budget accounting
Add the markdown import feature (§5.6, §4.5, §5.6.1) and the per-type budget accounting (§5.6.2).

**New constants** (cluster near L20-25): `MD_EXTS = new Set(["md", "markdown"])`, `IMAGE_FALLBACK_TOKENS = 2805` (the 2000×2000 resized worst case = 4×4 tiles). New regexes `INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`+)/g` and `FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/` (exact forms in PRD §5.6.1).

**New helpers:**
- `isAbsoluteOrTilde(p): boolean` — `p.startsWith("/") || p.startsWith("~")`.
- `computeCodeRanges(content): [number, number][]` — approximate-CommonMark code regions (§5.6.1): walk lines for fenced blocks (`FENCE_OPEN_RE`; same fence char ≥ opening length closes; unterminated → EOF; run from opening-fence first char through end of closing line); then `INLINE_CODE_RE` spans **not** already inside a fenced range. Sort by start.
- `inCode(index, ranges): boolean` — binary search over sorted ranges; `start ≥ range[0] && start < range[1]`.
- `estimateImageTokens(resized): number` — `resized` present with numeric `width`/`height`: `max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170 + 85`; else `IMAGE_FALLBACK_TOKENS`.
- `injectMarkdown(abs, content, state, ctx): Promise<void>` — the §5.6 six-step algorithm:
  1. (read/decode already done by `injectFile`).
  2. **Claim self** in `state.injectedSet` *before* scanning (self-import dedups to verbatim → no infinite recursion).
  3. `scanTokens(content, dirname(abs), { allowAbsTilde: false, skipCode: true }, state)` → resolved records (relative-only, outside code).
  4. **Strip `#@`** from each resolved import marker (high→low index splice), leaving the path — the result is this file's block content.
  5. `emitText(abs, strippedContent, state)` — inline-vs-paged decision on the *stripped* content; `subtract` the block's cost; bump `paged` if paged.
  6. **Recurse depth-first** in encounter order: for each record, if `state.injectedSet` still lacks `r.abs`, `await injectFile(r.abs, state, ctx)`. Pre-order emission: this file's block, then each import's subtree.

**Wire markdown into `injectFile`:** after stat/claim, when `MD_EXTS.has(ext)`, read the file and call `injectMarkdown(abs, buf.toString("utf8"), state, ctx)` instead of the plain-text branch. Markdown bypasses the §5.1 NUL/binary routing (always treated as text so import scanning runs). `state.count++` exactly once per claimed file.

**Total-size budget (§5.6.2):** make images and binary notes consume the shared `remaining` (text already does via MI-1):
- Image attach: `subtract(state, estimateImageTokens(resized))` (images are never paged — resized & attached).
- Binary note: `subtract(state, Math.ceil(noteString.length / 4))`.
- `emitText` already subtracts text whole/head cost (MI-1).

**Dedup semantics (critical):** `scanTokens` checks both a per-text `localSeen` and the global `state.injectedSet`; a resolved abs in either is left verbatim (no strip). This stops two imports of the same file within one markdown both being stripped, and bounds recursion (cycles terminate, shared deps inject once). `processTokenStream` re-checks `state.injectedSet` before each `injectFile` (cross-subtree dedup since scan).

**Never throw.** All `stat`/`readFile`/`resizeImage` stay in try/catch; on error leave the token verbatim and continue (PRD §12.5). Recursion depth is bounded by the finite set of injectable files, each claimed once — no separate depth counter (PRD §12.13).

- **Mode A docs:** JSDoc on `injectMarkdown`/`injectFile` describing the recursion contract (relative-only, code-exempt, dedup-bounded, pre-order). Update the `file-injector.test.mjs` module-surface sanity list (L117-124) to include any newly-exported helpers (`scanTokens`, `computeCodeRanges`, `inCode`, `injectMarkdown`, `isAbsoluteOrTilde`, `estimateImageTokens` as appropriate — export the pure ones the tests assert).

### Requirement MI-3 — Sync changeset-level documentation (Mode B, final task)
`README.md` currently has **no mention** of markdown imports (it was synced for paged delivery only). Add the feature coherently across its sections, depending on MI-1 + MI-2 landing first:
- **Why:** add a line that `#@spec.md` pulls in everything `spec.md` references with the *same* `#@` directive — spec-and-its-dependencies in one token.
- **Usage:** add a markdown-import example (a prompt `#@spec.md` where `spec.md` contains `#@api.md`).
- **What gets injected:** note that a delivered markdown file is also scanned for relative `#@` imports (each delivered as its own block, recursed if markdown).
- **Syntax:** add a **Markdown imports** subsection stating the contract: relative paths only (resolve from the markdown file's directory; absolute/`~` ignored); `#@` inside fenced/inline code is **not** an import (escape hatch); each file is injected at most once (cycles/shared deps dedup); imports share the context budget and page when the running total is exceeded.
- **Limits:** add bullets — markdown imports are relative-only; imports inside non-markdown files are inert; no autocomplete for in-file import directives (the provider is top-level-only, §14.4).
- Leave the paged-delivery wording, image/binary/missing rows, and `#@`-versus-`@` section as-is (they remain accurate).

---

## 4. Acceptance — New Cases

The existing 14 manual cases + all edge/guard cases (F1–F5, U1, A1, etc.) must still pass unchanged after MI-1 (regression gate). MI-2 adds these (PRD §11 cases 15–20):

| # | Setup | Input | Expected |
|---|---|---|---|
| 15 | `notes.md` containing `#@api.md`; `api.md` exists | `#@notes.md` | `notes.md` block (its `#@api.md` marker stripped → `api.md`), then `api.md` block; `injected===2`; notify `2 whole`; **no `read` calls**. |
| 16 | `notes.md` with `` `#@example.ts` `` inside a fenced block + a real `#@api.md` | `#@notes.md` | Only `api.md` imported; `#@example.ts` left **verbatim** in the code block; `injected===2`. |
| 17 | `a.md`→`#@b.md`, `b.md`→`#@a.md` (cycle) | `#@a.md` | `a.md` + `b.md` injected **once each**; `b.md`'s `#@a.md` left verbatim; **no loop**; `injected===2`. |
| 18 | `notes.md` with `#@/etc/hosts` | `#@notes.md` | `/etc/hosts` **not** imported (relative-only); marker verbatim; only `notes.md` injected (`injected===1`). |
| 19 | `sub/notes.md` imports `api.md` (sibling) | `#@sub/notes.md` | `api.md` resolved as `sub/api.md` (relative to the md's dir); injected. |
| 20 | `a.md` importing 3 files + `big.log` (huge) | `#@a.md` + `#@big.log` | Imports share the budget with the top-level token; `big.log` **pages** when the running total exceeds remaining; notify counts every delivered file (whole + paged). |

**Done-definition for this delta:** MI-1 lands with **zero** behavior change (all existing tests green byte-for-byte); MI-2 passes cases 15–20 with no uncaught errors; markdown imports resolve relative to the importing file's directory, skip code blocks, terminate on cycles, and dedup across the whole prompt; the context budget accounts for the total filesize of all delivered files (text + image + binary + imports); prompts without `#@` (and bare `@file`) remain byte-for-byte unchanged.

---

## 5. Documentation Impact

**Mode A — doc-with-work:**
- *MI-1:* `injectFiles` JSDoc (`file-injector.ts:162-175`) — describe shared `State` and that the budget spans the whole prompt.
- *MI-2:* JSDoc on the new `injectMarkdown`/`injectFile` (recursion contract); update the `file-injector.test.mjs` module-surface sanity list (L117-124) to include the newly-exported pure helpers.

**Mode B — changeset-level (final requirement, depends on MI-1 + MI-2):** `README.md` is stale (no markdown-import mention). MI-3 above is the cross-cutting sync — it becomes the final task.

---

## 6. Proposed Breakdown (for the breakdown agent)

**One phase, one milestone, three tasks** — proportionate to a single-file medium feature (new recursive capability + the shared-state refactor it requires + README sync):

- **Phase MI1 — Markdown Transitive Imports (PRD §5.6)**
  - **Milestone MI1.M1 — Implement & Validate Markdown Imports**
    - **Task MI1.M1.T1 — Refactor core to shared mutable `State` (MI-1, no behavior change).** Introduce `State`, consolidate `priorPaths`+`injectedThisRun` → `injectedSet`, extract `scanTokens`/`processTokenStream`/`injectFile` (text/image/binary only)/`emitText`/`subtract`; move text budget into `state.remaining`. Regression gate: every existing test passes byte-for-byte. ~2-3 subtasks (State+dedup consolidation; scan/emit/subtract extraction; full-suite green).
    - **Task MI1.M1.T2 — Markdown transitive imports + total-size budget accounting (MI-2).** `MD_EXTS`/regexes, `isAbsoluteOrTilde`, `computeCodeRanges`/`inCode`, `injectMarkdown` (6-step scan→strip→emit→recurse), `estimateImageTokens`/`IMAGE_FALLBACK_TOKENS` so images & binary notes consume the shared budget; wire markdown into `injectFile`. Add cases 15–20 + markdown fixtures. ~3-4 subtasks (code-region detection; markdown scan/strip/recurse; image/binary budget; new test cases).
    - **Task MI1.M1.T3 — Sync README for markdown imports (MI-3, Mode B).** Why, Usage, What gets injected, Syntax (Markdown imports subsection), Limits. Depends on T1 + T2. ~1 subtask.
