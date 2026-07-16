# Research Notes — P1.M2.T2.S1 (Bugfix): Paged directive resumes past the head (Issue 4)

## 1. Task contract (verbatim from the work item)

Fix Issue 4: the paged-delivery directive in `formatPagedDirectiveBlock` says `offset:0`, which (because
Pi's read tool `offset` is **1-indexed with a 0-clamp**) re-reads the already-injected head block.

- **RESEARCH NOTE (decided by humans):** Pi read tool: `startLine = offset ? Math.max(0, offset-1) : 0`
  → `offset:0` and `offset:1` are IDENTICAL (both start at line 1). The head is `content.slice(0,
  HEAD_BYTES)` (8192 BYTES); the read window is line-based (`limit:2000`). An EXACT line offset to skip
  a byte head is impossible, BUT the PRD frames `HEAD_BYTES = 8192 (about 2000 lines)`, so an
  APPROXIMATE line offset is consistent with the PRD's own equivalence. **Pick Option A** (resume past
  the head, smallest diff, keeps the head+directive two-block structure).
- **LOGIC:** Change ONLY the directive string in `formatPagedDirectiveBlock` to point the model past the
  ~2000-line head. Keep `HEAD_BYTES` and the byte head block in `injectFiles` UNCHANGED. Recommended
  wording: "estimated `<totalBytes>` bytes; first ~2000 lines injected above … read the rest with
  `offset:2001, limit:2000`, incrementing offset by 2000 until the entire file is read." Keep the em
  dash (U+2014) convention.
- **OUTPUT:** `formatPagedDirectiveBlock` emits a directive whose offset resumes AFTER the injected head.
  PD1/PD2 keep passing (they derive the expected string from the helper — presence, not correctness).
  **ADD a hardcoded-string assertion to PD1** pinning `'offset:2001, limit:2000'` with a message
  explaining the directive must resume past the head, not re-read it.
- **DOCS:** none (the directive string is model-facing, not quoted in README).

## 2. Baseline state of the repo (read & verified)

- `node ./file-injector.test.mjs` → **49 passed, 0 failed** (baseline, confirmed by running it).
- `formatPagedDirectiveBlock` is at `file-injector.ts` lines **121–128**:
  - **Docstring:** lines 121–125 (says "offset:0, limit:2000 (the read tool's DEFAULT_MAX_LINES=2000)").
  - **Signature:** line 126 `export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {`
  - **Return:** line 127 (the directive string, currently ending `…offset:0, limit:2000, incrementing offset until the entire file is read></file>`).
  - **Close brace:** line 128.
- `HEAD_BYTES = 8192;` at line 22 (UNCHANGED — do NOT touch).
- The paged branch in `injectFiles` (lines 265–267): `blocks.push(formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)));` then
  `blocks.push(formatPagedDirectiveBlock(abs, content.length));` — UNCHANGED (do NOT touch the byte head block).
- `offset:0` appears ONLY at lines 123 (docstring) + 127 (return) in `file-injector.ts`. The test file
  hardcodes `offset:0` NOWHERE (PD1/PD2 derive the expected directive from `mod.formatPagedDirectiveBlock`).
- Current directive (verified by importing the live .ts):
  `"<file name="…"><large file — estimated 2097152 bytes; first 8192 bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>"`
  → includes `offset:0, limit:2000`; does NOT include `offset:2001, limit:2000`.

## 3. Verified Pi read-tool offset semantics (drives the fix)

From `architecture/external_deps.md §1` (verified against `dist/core/tools/read.js`):
```js
offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
// execute():
const startLine = offset ? Math.max(0, offset - 1) : 0;   // 1-indexed → 0-indexed array access
```
- `offset:0` is falsy → `startLine = 0` → reads from line 1 (the top). `offset:1` ALSO reads from line 1.
- So `0`→`1` is cosmetic (buys nothing). The corrected directive must say `offset:2001` (the first line
  AFTER the ~2000-line head) to avoid re-reading it. `offset:2001` → `startLine = 2000` → reads from
  line 2001 onward. Consistent with the PRD's "8192 bytes ≈ 2000 lines" framing.

## 4. The exact edits (3 edits; case count UNCHANGED at 49) — pre-verified GREEN

Applied all 3 edits to temp copies of both files and ran the full harness → **49 passed, 0 failed**.

### Edit 1 — `file-injector.ts` (ONE combined edit: docstring + signature + return, lines 121–127)
Atomic block (docstring + return change in the same function; merged per edit-tool "merge nearby
changes" guidance). Em dashes (U+2014 `—`) preserved byte-for-byte.
- **oldText** = the current 5-line docstring + `export function …{` + the current `return '…offset:0…';` line.
- **newText** = updated docstring ("read the REMAINDER past the ~2000-line head … offset:2001, limit:2000
  (Pi read offset is 1-indexed …)") + the SAME signature + the new `return '…offset:2001…';` line.

New directive (verified): `"<file name="…"><large file — estimated 2097152 bytes; first ~2000 lines
injected above. Use the read tool to read the rest: offset:2001, limit:2000, incrementing offset by 2000
until the entire file is read></file>"`.
- includes `offset:2001, limit:2000` ✓
- does NOT include `offset:0` ✓
- includes `first ~2000 lines` ✓ ; includes `incrementing offset by 2000` ✓

### Edit 2 — `file-injector.test.mjs` PD1 (ONE edit: insert a hardcoded assertion + comment)
Insert immediately AFTER PD1's existing directive-presence assert
(`assert(r.text.includes(expectedDirective), "paged directive block must be present …")`):
```js
  // HARDCODED pin (Issue 4): the directive must resume PAST the injected ~2000-line head. Pi's read
  // offset is 1-indexed (offset:0 and offset:1 BOTH start at line 1, re-reading the head), so the
  // directive must say offset:2001 (first line after the head), not offset:0/1. Guards the regression.
  assert(r.text.includes("offset:2001, limit:2000"),
    "paged directive must point past the injected head (offset:2001), not re-read it (offset:0/1)");
```
- This is an EXTRA `assert` INSIDE PD1 — **no new `runCase`**, so the case count stays 49.
- The anchor (PD1's directive-presence assert) is **unique** in the file (grep-confirmed: the string
  `"paged directive block must be present (full path + size + read instruction)"` appears once).

### TDD ordering (red → green, confirmed by simulation)
- **Red:** apply Edit 2 (test) ONLY → PD1 fails (`1 failed`): the directive still says `offset:0` so
  `r.text.includes("offset:2001, limit:2000")` is false. (Simulated: `48 passed, 1 failed` — exactly PD1.)
- **Green:** apply Edit 1 (source) → directive now says `offset:2001` → PD1 passes. (Simulated: `49/49`.)

## 5. Harness conventions / scope notes

- PD1 (`§5.5 paged: huge.log under tight budget`) and PD2 (`§5.5 mixed: small whole + large paged`) BOTH
  derive the expected directive from `mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length)` → any
  helper-string change is AUTO-MATCHED (they pass for any offset value, even `offset:banana`). That is
  exactly why the **hardcoded** `includes("offset:2001, limit:2000")` pin is required (the contract's
  test-quality note). The pin is added to PD1 only (the contract says "PD1 and/or PD2" — one suffices;
  PD2 uses the same helper output, so a second pin would be redundant).
- `HUGE`/`HUGE_LOG_CONTENT`/`PAGED_FIX` (tight budget ctx) are existing fixtures; no new fixture needed.

## 6. Known approximation (document, do NOT try to "fix" it here)

The head block is the first `HEAD_BYTES` (8192 **bytes**) of content; the read window is **line**-based.
For typical ~60–80 char lines, 8192 bytes is ~100–135 lines, NOT 2000. So `offset:2001` is an
**approximation** grounded in the PRD's own "8192 bytes ≈ 2000 lines" framing (the PRD underestimates
realistic line length). The architecture's Option C (a truly exact, line-based head) is explicitly
**scope-expanding** (it changes `content.slice(0, HEAD_BYTES)` to a line split and contradicts the PRD's
explicit `HEAD_BYTES` byte pin — requires a PRD amendment). The contract chose **Option A** (approximate,
smallest diff) deliberately. The implementer should NOT switch to Option C — it is out of scope and the
PRP/contract pin `HEAD_BYTES` and the byte head block as UNCHANGED. For the HUGE.log fixture (≈69-char
lines), `offset:2001` will skip some lines past the actual byte head — this is the accepted trade-off of
Option A, consistent with the PRD's framing. Document this in the PRP as a Known Gotcha.

## 7. Scope boundaries (disjoint from sibling tasks)

This task edits `formatPagedDirectiveBlock` (file-injector.ts lines 121–127) + adds one assert to PD1
(file-injector.test.mjs ~line 808). It does **NOT**:

- (a) touch `HEAD_BYTES` (line 22) or the byte head block in `injectFiles` (line 266) — contract pins them.
- (b) touch the handler notify msg or Cases 9/12/F4/PN1 — that is **P1.M2.T1.S1** (running in PARALLEL on
      DISJOINT regions: the handler factory + the notify test cases; neither touches `formatPagedDirectiveBlock`
      or PD1). No merge conflict.
- (c) touch `injectFiles` dedup/strip — that is P1.M1.T1.S1/S2 (Complete).
- (d) edit README (the directive string is model-facing, not quoted there; P1.M3 owns the final sweep).
- (e) change PD2/PD3/PD4 (PD2 auto-matches via the helper; PD3/PD4 don't assert the directive string).
- (f) add a new `runCase` (the hardcoded pin is an extra `assert` INSIDE PD1; case count stays 49).

## 8. Risk / confidence

- **Risk:** minimal. 1 source edit (docstring + directive string, atomic) + 1 test insertion. Every edit
  is a unique exact-text anchor. The complete edit set was applied to temp copies → **49/49 green**, new
  directive verified to include `offset:2001, limit:2000` and exclude `offset:0`.
- **Idempotency:** if the directive already says `offset:2001` (a prior pass), the source oldText anchor
  (the `offset:0` return line) won't be found; the PD1 anchor (the directive-presence assert) still
  matches but the hardcoded pin may already be present. The pre-flight guard detects this.
- **Confidence: 9.5/10.** Residual 0.5 is for a possible em-dash/whitespace byte-slip in the multi-line
  source oldText — fully caught by Level 1 (`grep offset:2001` / no `offset:0`) + Level 2 (49/49).
