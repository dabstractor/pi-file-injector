# Bug Fix Requirements

## Overview

I performed a creative end-to-end validation of the `#@file` injection extension (`file-injector.ts`) against the PRD. Testing covered: (1) the full PRD §11 acceptance matrix and §10 edge cases via the existing harness (all 43 pass), (2) live verification of the real Pi APIs the implementation depends on (`ContextUsage`, `Model.contextWindow/maxTokens`, `AutocompleteProvider`, the read tool's 1-indexed `offset`, and `AgentSession.prompt()` input-event source defaults — confirmed in `dist/core/agent-session.js` and `dist/core/extensions/types.d.ts`), and (3) adversarial probing of the actual `injectFiles` / handler against gaps the existing tests do not cover.

**Overall assessment:** The core happy path is solid — single-file injection, images, binaries, missing/dir handling, paged delivery, the Unicode word-boundary regex, loop-prevention guards, and the autocomplete provider all behave per the PRD. However, two **Major** correctness/spec bugs remain in areas the existing test suite does not exercise: (1) the dedup feature has a within-prompt gap that double-injects a file referenced more than once, and (2) failed `#@` tokens in a *mixed* prompt are stripped of their `#@` trigger, directly violating PRD §6.2. Two additional Minor deviations are documented below.

The bugs were all reproduced against the real committed `file-injector.ts` (loaded through Pi's own jiti + alias mechanism, identical to `file-injector.test.mjs`).

## Critical Issues (Must Fix)

None. No bug prevents the primary use case (single-file `#@` injection) from working, and the handler never throws or loses a prompt.

## Major Issues (Should Fix)

### Issue 1: A file referenced by more than one `#@` token in a single prompt is injected multiple times (dedup gap)
**Severity**: Major
**PRD Reference**: §6.2 (Assembly — `blocks`/dedup intent), §2 Goal 5 ("Non-destructive & loop-safe … never re-expands … injected messages"), and the code's own stated dedup contract ("PER-TOKEN DEDUP — if a `<file>` block for this exact absolute path was already injected … skip re-injecting").
**Expected Behavior**: A prompt that names the same file twice (e.g. `Compare #@a.ts with #@a.ts`, or `#@a.ts` + `#@./a.ts`, or `#@pic.png` twice) should inject the file **once**. The extension ships an explicit per-token dedup feature (exercised by tests F1/F1b/F1c/F1d) whose purpose is to prevent re-injection of an already-delivered path.
**Actual Behavior**: The file is injected **for every occurrence**. Verified live:
- `Compare #@a.ts with #@a.ts` → `injected === 2` and **two** identical `<file name="…/a.ts">` blocks appended.
- `See #@p.png and #@p.png` → `images.length === 2` (the same image is attached twice).
- Same file via two path forms (`#@a.ts` + `#@./a.ts`) → also 2 blocks.

Root cause: in `injectFiles`, the dedup set is built **once, before the loop**, from `<file name="…">` blocks already present in the *input* text:
```ts
const priorPaths = new Set<string>();
for (const m of text.matchAll(/<file name="([^"]+)">/g)) priorPaths.add(m[1]);
```
The set is **never updated** when a file is successfully injected inside the loop (`priorPaths.add(abs)` is never called after `count++`). So a repeat of the *same* path later in the same prompt sees no prior block and is injected again.
**Steps to Reproduce** (model-free, against the real module):
```js
// cwd = temp dir containing a.ts with "export const X = 1;\n"
const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], { cwd });
console.log(r.injected);                       // -> 2  (should be 1)
console.log((r.text.match(/<file name="/g)||[]).length);  // -> 2  (should be 1)
```
**Suggested Fix**: After a successful injection (each `count++` site), add the resolved path to a within-run set and check it at the top of the loop. Minimal change:
```ts
const injectedThisRun = new Set<string>();
// …inside the loop, before stat/resolve work:
if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;
// …after each successful inject (text/image/binary/empty-image/paged):
injectedThisRun.add(abs);
```
(Use a separate set so the existing "don't suppress a genuinely-new file" guarantee from F1c is unaffected.)

---

### Issue 2: In a mixed prompt, failed `#@` tokens are stripped of their `#@` trigger — violates PRD §6.2
**Severity**: Major
**PRD Reference**: §6.2 ("Tokens that did **not** inject (missing / directory / read-error) are left byte-for-byte verbatim, `#@` included") and §10 ("`#@nonexistent.txt` → Token left verbatim; no block; no error.", "`#@some/dir/` → Token left verbatim.").
**Expected Behavior**: When a prompt contains at least one *successful* `#@` token AND one or more *failed* tokens (missing file / directory / read error), the failed tokens must remain in the text **byte-for-byte, with `#@` intact**, so the model can see that a file-injection was attempted and failed (and react — call `read`, ask the user, etc.).
**Actual Behavior**: Whenever `count > 0`, the handler strips `#@` from **every** `#@` token in the prompt — including the failed ones — via a blanket replace:
```ts
const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
```
Verified live:
- `Review #@a.ts and check #@missing.ts` → `Review a.ts and check missing.ts` (the `#@missing.ts` became `missing.ts`; `text.includes("#@missing.ts") === false`).
- `Review #@a.ts and list #@src/` (a directory) → `Review a.ts and list src/` (the `#@src/` directory token became `src/`).

This directly contradicts the explicit PRD requirement. (Note: the *single*-failed-token case works correctly because `count === 0` returns the original text byte-for-byte; the bug only manifests when at least one token in the same prompt succeeds.) The existing test **F2 actually enforces this deviation** (`r.text.startsWith('<!--file-injected--> Review a.ts')` asserts the failed `#@file-injected-->` token loses its `#@`), so the test should be updated alongside the fix.
**Steps to Reproduce** (model-free):
```js
const r = await mod.injectFiles("Review #@a.ts and check #@missing.ts", [], { cwd });
console.log(r.text.includes("#@missing.ts")); // -> false  (PRD §6.2 requires true)
console.log(r.text.includes("missing.ts"));   // -> true   (the bare, stripped mention)
```
**Suggested Fix**: Strip `#@` only from tokens that actually injected, not from every match. Track the injected match substrings (or their start indices) during the loop and replace only those, e.g.:
```ts
const injectedMatches: string[] = [];   // push m[0] on each successful inject
// …after the loop, instead of the blanket replace:
let strippedText = text;
for (const whole of injectedMatches) {
  strippedText = strippedText.replace(whole, whole.slice(2)); // drop leading "#@"
}
```
(The `(^|(?<=…))` anchor is zero-width, so `m[0]` is exactly `#@<rawtoken>` — slicing 2 chars is safe and leaves failed tokens untouched.)

## Minor Issues (Nice to Fix)

### Issue 3: Notify message wording diverges from the PRD §5.5 example for all-whole prompts
**Severity**: Minor
**PRD Reference**: §5.5 ("Notify. Surface the mode … `#@ injected N whole` versus `#@ injected N whole, M paged`").
**Expected Behavior**: Per the PRD's two examples, the all-whole case (no paging) should read `#@ injected N whole`.
**Actual Behavior**: When `paged === 0` the handler emits `#@ injected N file` / `#@ injected N files` instead of `#@ injected N whole`. (The `paged > 0` branch correctly uses the `whole`/`paged` form.) Verified live: `Review #@a.ts` → notify `"#@ injected 1 file"`.
**Steps to Reproduce**: capture `ctx.ui.notify` for a single-file whole injection (see probe above).
**Suggested Fix**: Unify on the PRD wording — e.g. always use `` `#@ injected ${whole} whole${paged ? `, ${paged} paged` : ""}` `` — or explicitly document the friendlier "N file(s)" form as an intentional deviation in the PRD. Low impact either way.

### Issue 4: Paged directive instructs `offset:0`, which re-reads the already-injected head block
**Severity**: Minor
**PRD Reference**: §5.5 ("Page path" — head block of first `HEAD_BYTES`, then directive to "load the remainder with the read tool at `offset:0, limit:2000`").
**Expected Behavior**: The directive should point the model at the *remainder* (content after the head block) to avoid re-reading bytes already delivered.
**Actual Behavior**: Pi's `read` tool `offset` is **1-indexed** (`startLine = offset ? Math.max(0, offset-1) : 0` in `dist/core/tools/read.js`), so `offset:0` is treated as "start at line 1" — i.e. the model re-reads the first ~2000 lines that were already injected as the head block. The directive's own wording ("load the **rest**") also contradicts "offset:0". This is faithful to the PRD's literal `offset:0` wording, so it is a design quirk more than an implementation defect, but it causes redundant reads on every paged file. (Note also that the head is measured in **bytes** — `content.slice(0, HEAD_BYTES)` — while the read window is measured in **lines** — `limit:2000` — so the two windows don't align, compounding the overlap/skip ambiguity.)
**Steps to Reproduce**: trigger paging (tight `getContextUsage` budget) on a ~2 MB text file; inspect the directive block.
**Suggested Fix**: Either tell the model to continue from after the head (e.g. "resume reading with `offset:<approx line after the head>`, limit:2000"), or drop the head block and simply page from the start — pick one and make the directive internally consistent.

## Testing Summary
- **Total tests performed**: ~55 (43 from the existing §11/edge/guard/F1–F5/U1/A1/PD/PN harness, all passing; plus ~12 new adversarial probes against `injectFiles`/handler covering within-prompt duplicates, mixed success/fail stripping, image dedup, content-embedded `#@`, notify wording, paged-directive offset, and live Pi-API shape verification).
- **Passing**: 43 of the existing harness; ~8 of the new probes confirmed correct behavior (Unicode boundaries, single-failed-token verbatim, content-embedded `#@` not re-scanned, never-throws, loop-prevention, `-p` source = "interactive", image/binary/paged paths, autocomplete remap).
- **Failing / new findings**: 2 Major (Issue 1 dedup gap, Issue 2 failed-token stripping) + 2 Minor (Issue 3 notify wording, Issue 4 paged `offset:0`).
- **Areas with good coverage**: single/multi text injection, image attach + fallback, binary note, missing/dir/read-error (single-token), Unicode word boundaries, paged-delivery budget math + O-1 fallback, all three handler guards, headless notify suppression, format parity, autocomplete line-rewrite.
- **Areas needing more attention**: (a) **within-prompt dedup** — the existing F1/F1b/F1c/F1d suite only exercises dedup across *separate* passes/co-loads and never repeats the *same* path in one prompt (Issue 1); (b) **mixed success/fail prompts** — every existing failed-token case (§10 rows 5/6, F2) either has count===0 (single token) or, for F2, asserts the *buggy* stripping behavior, so the §6.2 "failed tokens keep `#@`" requirement is effectively untested for the mixed case (Issue 2); (c) the **paged-directive offset** is never validated against the read tool's actual 1-indexed `offset` semantics (Issue 4).
