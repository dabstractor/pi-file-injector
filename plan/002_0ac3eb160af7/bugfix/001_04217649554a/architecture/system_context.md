# System Context — `#@file` Injector Correctness Bug Fixes (Issues 1–4)

## Executive Summary

The `#@file` Whole-File Injection extension (`file-injector.ts`, single-file Pi extension) is
PRD-compliant on its core happy path — single/multi text injection, image attach + fallback, binary
notes, missing/dir/read-error handling (single-token), paged-delivery budget math + O-1 fallback,
the Unicode word-boundary regex, the three handler guards, headless notify suppression, and the
autocomplete line-rewrite provider. The model-free harness `file-injector.test.mjs` passes **43/43**.

A creative end-to-end + adversarial validation found **2 Major** and **2 Minor** correctness/spec
bugs in areas the existing suite does NOT exercise. All four were **reproduced live against the real
committed module** (loaded through Pi's own jiti + alias mechanism, identical to the test harness).
No bug is Critical: the primary use case (single-file `#@` injection) works, and the handler never
throws or loses a prompt.

| # | Severity | One-line | PRD ref |
|---|----------|----------|---------|
| 1 | Major | A file named by >1 `#@` token in ONE prompt is injected every time (dedup set built once, never updated in-loop) | §6.2 assembly/dedup, §2 Goal 5 |
| 2 | Major | In a MIXED prompt (≥1 success + ≥1 fail), failed `#@` tokens lose their `#@` (blanket post-loop strip) | §6.2, §10 |
| 3 | Minor | Notify says `#@ injected N file(s)` for all-whole; PRD §5.5 example says `#@ injected N whole` | §5.5 Notify |
| 4 | Minor | Paged directive says `offset:0`, but read `offset` is 1-indexed → re-reads the already-injected head block | §5.5 Page path |

## Current State (verified)

- **Source file**: `file-injector.ts` (~260 lines) — PRD-compliant core + exported pure helpers
  (`cleanToken`, `expandTildeAndResolve`, `extOf`, `isBinary`, `hasValidImageMagic`,
  `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`,
  `formatPagedDirectiveBlock`) + the core `async injectFiles(text, imagesIn, ctx)` + the `default`
  factory (registers `input` + `session_start` handlers).
- **Test harness**: `file-injector.test.mjs` — model-free, zero-dependency Node ESM script. Imports
  the REAL `.ts` via Pi's jiti (`@earendil-works/pi-coding-agent` resolved globally). Prints a
  pass/fail matrix; `process.exit(0)` iff all green. Run: `node ./file-injector.test.mjs`.
- **No separate docs dir** — user-facing docs live in `README.md` (single file). No `docs/` tree,
  no CLI flags, no env vars, no config. The only "configuration" is the package.json `pi` manifest.
- **No external services** — the extension only does local `fs` reads + Pi's exported
  `resizeImage`/`formatDimensionNote`. Mocking needs are nil beyond the harness's existing
  `makeMockCtx`/`PAGED_FIX`/`captureHandler`.

## The Two Major Bugs (interrelated, both in `injectFiles`)

### Issue 1 — Within-prompt dedup gap (Major)
**Where**: `injectFiles`, the loop over `text.matchAll(FILE_INJECT_RE)`. The dedup set `priorPaths`
is populated ONCE before the loop from `<file name="…">` blocks already in the input text, and is
**never updated** when a file is successfully injected inside the loop. So the 2nd occurrence of the
SAME path later in the same prompt sees no prior block and re-injects.
**Confirmed live**: `Compare #@a.ts with #@a.ts` → `injected===2`, two `<file>` blocks; image
variant `#@p.png` twice → `images.length===2`; same file via two path forms (`#@a.ts` + `#@./a.ts`)
→ 2 blocks.

### Issue 2 — Failed-token `#@` stripping in mixed prompts (Major)
**Where**: `injectFiles`, the post-loop assembly. When `count>0`, the line
`const strippedText = text.replace(FILE_INJECT_RE, (_m,_b,path)=>path)` strips `#@` from EVERY `#@`
token — including failed ones (missing/dir/error). PRD §6.2/§10 require failed tokens to stay
byte-for-byte verbatim WITH `#@`.
**Confirmed live**: `Review #@a.ts and check #@missing.ts` → `#@missing.ts` becomes `missing.ts`
(`text.includes("#@missing.ts")===false`); directory token `#@src/` likewise loses `#@`.
**Note**: the *single*-failed-token case is already correct because `count===0` returns the original
text byte-for-byte — the bug ONLY manifests when ≥1 token in the same prompt succeeds.
**Important**: existing test **F2 asserts the buggy behavior**
(`r.text.startsWith('<!--file-injected--> Review a.ts')` — it asserts the failed
`#@file-injected-->` token lost its `#@`). F2 must be updated alongside the fix.

## The Two Minor Bugs

### Issue 3 — Notify wording (Minor)
**Where**: the `input` handler in the `default` factory. When `paged===0` it emits
`#@ injected N file` / `#@ injected N files`; PRD §5.5 examples use `#@ injected N whole`. The
`paged>0` branch is already correct (`whole`/`paged`).
**Confirmed live**: `Review #@a.ts` → notify `"#@ injected 1 file"`. Tests F4 + PN1 pin the current
wording and must update.

### Issue 4 — Paged directive `offset:0` re-reads the head (Minor)
**Where**: `formatPagedDirectiveBlock`. It instructs `offset:0, limit:2000`, but Pi's read tool
`offset` is **1-indexed** (`startLine = offset ? Math.max(0, offset-1) : 0` in
`dist/core/tools/read.js`), so `offset:0` is treated as "start at line 1" — the model re-reads the
~2000 lines already delivered as the head. Compounding ambiguity: the head is measured in **bytes**
(`content.slice(0, HEAD_BYTES)`, 8192) while the read window is measured in **lines** (`limit:2000`),
so the two windows don't align. Tests PD1/PD2 assert the directive string via the helper, so they
update with the helper.

## Scope of Work

All changes are confined to **two files**: `file-injector.ts` (the fixes) and
`file-injector.test.mjs` (update F2/F4/PN1/PD1/PD2 + add new regression cases for the gaps). No new
files, no new dependencies, no public-API surface change beyond a model-facing directive string and a
notify wording change. The implicit-TDD workflow (failing test → implement → pass) applies to every
subtask; tests are NOT separate subtasks.

## Risks & Invariants to Preserve

- **F1c multi-file safety**: the dedup must stay keyed on the EXACT absolute path and must NOT
  suppress a genuinely-new file in the same prompt. Issue 1's fix uses a SEPARATE `injectedThisRun`
  set precisely so F1c's "prior block for path X doesn't block a NEW path Y" guarantee is unaffected.
- **`count===0` byte-for-byte**: the nothing-injected path must still return the ORIGINAL `text`
  and the ORIGINAL `images` ref — unchanged.
- **Never throws**: every file is isolated in try/catch; failures leave the token verbatim.
- **Loop-prevention guards** (`source==="extension"`, `streamingBehavior==="steer"`, no-`#@`
  pre-check) are untouched.
- **Substring-collision in Issue 2's fix**: a naive `text.replace(whole, whole.slice(2))` per
  injected match can mis-replace when one injected match string is a prefix of another
  (e.g. `#@a.ts` inside `#@a.ts.bak`). Recommend an INDEX-based splice (record `m.index` per injected
  match) — see `code_changes_analysis.md`.
