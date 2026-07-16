---
name: "P1.M2.T2.S1 (Bugfix) — Paged directive resumes past the injected head (offset:2001) + hardcoded PD1 assertion (Issue 4)"
prd_ref: "Bug-fix PRD §Issue 4 (paged directive instructs offset:0, re-reading the head), §Overview, §Testing Summary"
target_files: "./file-injector.ts (1 edit: formatPagedDirectiveBlock docstring + directive return string) + ./file-injector.test.mjs (1 edit: add a hardcoded 'offset:2001, limit:2000' assertion + comment inside PD1)"
change_type: surgical directive-string + docstring update + 1 hardcoded test assertion. Case count UNCHANGED (stays 49).
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "none code-wise — formatPagedDirectiveBlock is a self-contained pure helper. Baseline harness is 49/0 (P1.M1.T1.S1 + P1.M1.T1.S2 landed)."
fixes: "Issue 4 — the paged directive now says offset:2001 (resume PAST the injected ~2000-line head) instead of offset:0 (which, because Pi's read offset is 1-indexed with a 0-clamp, re-reads the head). Option A (smallest diff, keeps the head+directive two-block structure)."
parallel_with: "P1.M2.T1.S1 (Issue 3 notify wording) — DISJOINT regions (T1 edits the handler msg + Cases 9/12/F4/PN1; THIS task edits formatPagedDirectiveBlock + PD1). No merge conflict."
---

# PRP — P1.M2.T2.S1 (Bugfix): Paged directive resumes past the head (`offset:2001`) + PD1 pin

## Goal

**Feature Goal**: Fix Issue 4 — the paged-delivery directive emitted by `formatPagedDirectiveBlock`
instructs the model to read with `offset:0, limit:2000`. Because Pi's read tool `offset` is
**1-indexed with a 0-clamp** (`startLine = offset ? Math.max(0, offset-1) : 0`), `offset:0` and
`offset:1` are IDENTICAL — both start at line 1 — so the model **re-reads the ~2000-line head block
that was already injected**. Replace the directive string so it points the model **past** the head
(`offset:2001, limit:2000`, incrementing by 2000), and add a **hardcoded** assertion to `PD1` that
pins `offset:2001, limit:2000` (PD1/PD2 currently derive the expected directive from the helper, so
they assert *presence* not *correctness* — they pass even for `offset:banana`).

**Deliverable**: 2 surgical exact-text edits across 2 files (1 in `file-injector.ts`, 1 in
`file-injector.test.mjs`), all given verbatim below. **No new files. Case count UNCHANGED (49).**
The `HEAD_BYTES` constant (line 22) and the byte head block in `injectFiles`
(`formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))` at line 266) are UNCHANGED (item §3 contract).

**Success Definition**:
- [ ] `formatPagedDirectiveBlock` returns a directive whose offset is **`offset:2001, limit:2000`**
      (was `offset:0, limit:2000`), incrementing by 2000, with "first ~2000 lines injected above".
- [ ] The directive string **no longer contains `offset:0`** and **contains `offset:2001, limit:2000`**.
- [ ] The em dash (U+2014 `—`) convention is preserved (both the `<large file — …` note and the
      docstring's existing em dashes).
- [ ] `HEAD_BYTES` (line 22) and the byte head block (`content.slice(0, HEAD_BYTES)` at line 266) are
      byte-identical (untouched).
- [ ] PD1 has a NEW hardcoded assertion: `assert(r.text.includes("offset:2001, limit:2000"), …)` with a
      message explaining the directive must resume past the head (regression guard for Issue 4).
- [ ] PD2 unchanged (it still derives the directive from the helper and auto-matches); PD3/PD4 unchanged.
- [ ] `node ./file-injector.test.mjs` → **`Result: 49 passed, 0 failed.`**, exit 0. (Case count UNCHANGED.)

> **Scope boundary (read carefully):** This task edits ONLY `formatPagedDirectiveBlock` (docstring +
> return string) in `file-injector.ts` and adds ONE `assert` (+comment) inside `PD1` in
> `file-injector.test.mjs`. It does **NOT**: (a) touch `HEAD_BYTES` (line 22) or the byte head block in
> `injectFiles` (line 266) — item §3 pins them; (b) touch the handler notify msg or Cases 9/12/F4/PN1
> (that is P1.M2.T1.S1, running in PARALLEL on disjoint regions); (c) touch `injectFiles` dedup/strip
> (P1.M1.T1.S1/S2, Complete); (d) add a new `runCase` (the hardcoded pin is an extra `assert` INSIDE
> PD1; case count stays 49); (e) switch to a line-based head (architecture "Option C" — scope-expanding,
> contradicts the PRD's `HEAD_BYTES` byte pin, requires a PRD amendment — explicitly out of scope);
> (f) edit README (the directive string is model-facing, not quoted there; P1.M3 owns the final sweep).

## User Persona

**Target User**: The model (the directive is **model-facing** — it instructs the agent how to page the
rest of an oversize file) and the maintainer who relies on the harness to catch regressions of Issue 4.

**Use Case**: A user references a ~2 MB file (`#@huge.log`) under a tight context budget → the extension
injects the first `HEAD_BYTES` (8192 bytes) as an inline head block, then emits a directive telling the
model to page the REMAINDER. Today that directive says `offset:0` → the model's first `read(offset:0,
limit:2000)` returns lines 1–2000 (the head it already has) — a wasted round-trip. After the fix the
directive says `offset:2001` → the first `read` returns line 2001 onward (new content).

**Pain Points Addressed**: Redundant re-reads of the already-injected head on every paged file (Issue 4).
The fix is faithful to the PRD's literal "page path" intent ("load the **rest**") which the old
`offset:0` contradicted.

## Why

- **PRD §5.5 conformance (intent).** The PRD's paged path injects a head block then directs the model to
  "load the remainder." `offset:0` re-reads the head, contradicting "remainder." `offset:2001` resumes
  past the (≈2000-line) head, matching the intent and the PRD's own "8192 bytes ≈ 2000 lines" framing.
- **`offset:0` and `offset:1` are identical** — Pi's read tool does `startLine = offset ? Math.max(0,
  offset-1) : 0`, so both clamp to line 1. Changing `0`→`1` would be cosmetic and buy nothing. The only
  fix that avoids re-reading the head is to point PAST it (`offset:2001`). (Verified in
  `dist/core/tools/read.js` — see architecture/external_deps.md §1.)
- **Smallest-diff Option A (decided by humans).** Keep the byte head block (immediate content) + the
  two-block structure; change ONLY the directive string. Option C (exact line-based head) is
  scope-expanding and contradicts the PRD's explicit `HEAD_BYTES` byte pin — out of scope.
- **The existing PD1/PD2 are insufficient.** They derive the expected directive from
  `mod.formatPagedDirectiveBlock(…)` (presence, not correctness) — they pass for ANY offset string. The
  hardcoded `includes("offset:2001, limit:2000")` pin is required to actually catch an `offset:0`
  regression (the contract's test-quality note).

## What

2 exact-text edits (verbatim in `Implementation Blueprint → Exact source to write`):
- **Edit 1** (`file-injector.ts`, lines 121–127 — atomic block: docstring + signature + return): update
  the docstring ("read the REMAINDER past the ~2000-line head … offset:2001") and the directive return
  string (`offset:0` → `offset:2001`, "first ~2000 lines injected above", "incrementing offset by 2000").
- **Edit 2** (`file-injector.test.mjs`, inside PD1 ~line 808): insert a hardcoded
  `assert(r.text.includes("offset:2001, limit:2000"), …)` + explanatory comment, after PD1's existing
  directive-presence assertion.

### Success Criteria
- [ ] Directive string includes `offset:2001, limit:2000`; excludes `offset:0`; em dash preserved.
- [ ] `HEAD_BYTES` + byte head block untouched; PD2/PD3/PD4 untouched.
- [ ] PD1 has the hardcoded `offset:2001, limit:2000` assertion; harness 49/49; case count 49.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships both edits as unique exact-text `oldText`/`newText` pairs
> (all anchors grep-verified unique), the complete 2-edit set has been **applied to temp copies and run
> → 49/49 green** with the new directive verified to include `offset:2001, limit:2000` and exclude
> `offset:0` (research §4), and the implicit-TDD red→green ordering is spelled out (Edit 2 first → PD1
> fails on `offset:0`; Edit 1 → PD1 passes). No model/API key needed.

### Documentation & References
```yaml
# MUST READ — this task's verified research (2-edit set pre-run green 49/49)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2T2S1/research/research_notes.md
  why: "§2 the baseline (49/49; formatPagedDirectiveBlock at lines 121-128; offset:0 only at L123+L127);
        §3 the verified read-tool offset semantics; §4 the exact 2 edits + the new directive string +
        the 49/49 green verification; §5 PD1/PD2 derive-from-helper (presence not correctness); §6 the
        byte-head-vs-line-offset approximation (Option A trade-off — do NOT switch to Option C); §7 the
        disjoint scope vs P1.M2.T1.S1."
  critical: "Keep HEAD_BYTES (L22) + the byte head block (L266) UNCHANGED. PD1/PD2 derive the expected
        directive from the helper → they auto-match any string; the HARDCODED includes('offset:2001,
        limit:2000') pin is what actually guards the regression. Option C (line-based head) is OUT OF
        SCOPE (scope-expanding, contradicts PRD's HEAD_BYTES byte pin)."

# MUST READ — exact change site + verified fix options (Issue 4)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/code_changes_analysis.md
  why: "§'Issue 4 — Paged directive offset:0' pins formatPagedDirectiveBlock's location (~L126-127), the
        root cause (1-indexed offset, 0-clamp), the 3 options (A/B/C), and the explicit recommendation
        to pick Option A + add a hardcoded assertion. Confirms PD1/PD2 assert presence-not-correctness."
  section: "Issue 4 — Paged directive offset:0 re-reads the head (Minor)"

# MUST READ — the verified Pi read-tool offset semantics (the root cause)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/external_deps.md
  why: "§1 quotes the read.js source: `startLine = offset ? Math.max(0, offset - 1) : 0`. Confirms
        offset:0 ≡ offset:1 (both → line 1), limit is line-based (DEFAULT_MAX_LINES=2000), and that the
        corrected directive must say offset:2001 to resume past the ~2000-line head."
  section: "1. Read tool offset semantics — drives Issue 4"

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/prd_snapshot.md
  why: "Bug-fix PRD §Issue 4 (the paged-directive offset quirk) and §Testing Summary (why the paged-
        directive offset is a test-coverage gap)."
  section: "§Issue 4, §Testing Summary"

# MUST READ — the parallel sibling contract (DISJOINT regions — confirms no collision)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2T1S1/PRP.md
  why: "P1.M2.T1.S1 (Issue 3 notify wording) edits the handler msg + Cases 9/12/F4/PN1. It does NOT touch
        formatPagedDirectiveBlock or PD1. Confirms this task's regions are disjoint → safe to land in
        parallel. (If T1 hasn't landed yet, its edits are elsewhere — no conflict either way.)"
  critical: "Do NOT touch the handler notify msg, Cases 9/12/F4/PN1 — those are P1.M2.T1.S1's scope."

# The files being EDITED
- file: ./file-injector.ts
  why: "formatPagedDirectiveBlock (lines 121-128): the docstring (L121-125) + the return directive string
        (L127). 1 atomic edit (docstring + return merged per edit-tool guidance). HEAD_BYTES (L22) and
        the byte head block in injectFiles (L266) are UNTOUCHED."
  pattern: "Keep `export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {`
            and the close brace. Only the docstring prose + the returned string literal change. Keep the
            `\u2014` (em dash) escape inside the returned string and the literal `—` in the docstring."
  gotcha: "The returned string uses `\\u2014` (the JS escape for U+2014) — keep it as `\\u2014` in the
           SOURCE (it renders as `—` at runtime). The docstring uses a LITERAL `—` (U+2014) in 'NOT this
           helper — it is' and 'Reuses the em dash (U+2014)'. Match both byte-for-byte. Do NOT change the
           `+ abs +` / `+ totalBytes +` interpolation; DROP the `+ HEAD_BYTES +` interpolation (the new
           wording says '~2000 lines', not the byte count) — the HEAD_BYTES CONSTANT stays at L22."

- file: ./file-injector.test.mjs
  why: "PD1 (§5.5 paged, ~line 799-811) asserts the directive via mod.formatPagedDirectiveBlock (presence).
        Insert ONE hardcoded `assert(r.text.includes('offset:2001, limit:2000'), …)` + comment right after
        PD1's existing directive-presence assert. No new runCase → case count stays 49."
  pattern: "Reuse the existing `assert(cond, msg)` helper. The new assert goes INSIDE PD1's async fn,
            immediately after `assert(r.text.includes(expectedDirective), …)`. The anchor (that line) is
            unique (grep-confirmed)."
  gotcha: "Do NOT touch PD2 (it derives the directive from the helper and auto-matches — no change needed).
           Do NOT add a runCase. Do NOT change PD1's other assertions (head block, injected/paged counts,
           strip, images)."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDIT (1 edit: formatPagedDirectiveBlock docstring + directive string, L121-127). Baseline 49/0.
├── file-injector.test.mjs       # ← EDIT (1 edit: add hardcoded 'offset:2001, limit:2000' assert + comment inside PD1).
├── PRD.md / README.md           # READ-ONLY here (directive string not quoted in README; P1.M3 owns the sweep).
├── package.json                 # untouched
└── plan/002_0ac3eb160af7/bugfix/001_04217649554a/
    ├── architecture/{code_changes_analysis.md, external_deps.md, system_context.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}     # Issue 1 dedup — DONE (in file)
    ├── P1M1T1S2/{PRP.md, research/}     # Issue 2 strip — DONE (in file)
    ├── P1M2T1S1/{PRP.md, research/}     # Issue 3 notify wording — PARALLEL (disjoint regions)
    └── P1M2T2S1/
        ├── research/research_notes.md   # THIS TASK's research (2-edit set pre-verified 49/49)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
├── file-injector.ts             # MODIFIED — formatPagedDirectiveBlock: directive offset:0 → offset:2001 (+ docstring refresh).
└── file-injector.test.mjs       # MODIFIED — PD1: +1 hardcoded 'offset:2001, limit:2000' assert (+ comment).
# No new files. No HEAD_BYTES / byte-head-block / injectFiles / handler / notify-cases / PD2/PD3/PD4 / README changes.
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL — Pi's read tool offset is 1-indexed with a 0-clamp: `startLine = offset ? Math.max(0,
// offset-1) : 0`. So offset:0 ≡ offset:1 (both read from line 1). The ONLY way to resume PAST the
// ~2000-line head is offset:2001 (startLine=2000 → reads from line 2001). Changing 0→1 buys nothing.

// CRITICAL — keep HEAD_BYTES (L22) and the byte head block in injectFiles (L266:
// formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))) UNCHANGED. Item §3 pins them. Only the
// directive STRING in formatPagedDirectiveBlock changes (Option A — smallest diff).

// GOTCHA — the returned directive string uses `\u2014` (the JS escape for U+2014 em dash) inside the
// literal: `'<large file \u2014 estimated '`. Keep it as `\u2014` in the SOURCE. The docstring uses a
// LITERAL `—` (U+2014) in two places. Match both byte-for-byte in the oldText; preserve both in newText.

// GOTCHA — the new wording DROPS the `+ HEAD_BYTES +` byte interpolation ('first 8192 bytes injected
// above') and replaces it with the literal 'first ~2000 lines injected above' (line-based, to match the
// line-based offset). The HEAD_BYTES CONSTANT (L22) is untouched — only its interpolation in THIS string
// goes away. This is intentional (the directive now speaks in lines, consistent with offset/limit).

// GOTCHA (known approximation — do NOT "fix" it): the head is 8192 BYTES; the read window is LINES. For
// typical ~60-80 char lines, 8192 bytes is ~100-135 lines, NOT 2000. So offset:2001 is APPROXIMATE,
// grounded in the PRD's own "8192 bytes ≈ 2000 lines" framing (which underestimates realistic line
// length). Architecture Option C (exact line-based head) is scope-expanding + contradicts the PRD's
// HEAD_BYTES byte pin + requires a PRD amendment — OUT OF SCOPE. For the HUGE.log fixture (~69-char
// lines), offset:2001 skips some lines past the actual byte head; this is the accepted Option A trade-off.

// GOTCHA — PD1/PD2 derive the expected directive from mod.formatPagedDirectiveBlock(…) (presence, not
// correctness) → they pass for ANY offset string. The HARDCODED includes('offset:2001, limit:2000') pin
// inside PD1 is what actually guards the regression. Do NOT rely on the derived assertion alone.

// IDEMPOTENCY — if the directive already says offset:2001 (a prior pass), the source oldText anchor
// (the `offset:0` return line) will NOT be found; run Level 1 (`grep offset:2001` present, `grep offset:0`
// absent in the return line) + Level 2 (49/49) — if both hold, the task is already done.
```

## Implementation Blueprint

### Data models and structure
None. No type, signature, control-flow, or return-shape change. `formatPagedDirectiveBlock(abs, totalBytes): string`
keeps its signature; only the returned string literal (and its docstring prose) change. The test edit adds
one `assert` (no new case).

### Implementation Tasks (ordered by dependencies — IMPLICIT TDD: assertion first (red), then the string fix (green))
```yaml
PRE-FLIGHT:
  - RECORD baseline: `node ./file-injector.test.mjs` → "49 passed, 0 failed".
  - CONFIRM the directive return-line anchor exists (the current offset:0 directive):
      grep -cF 'offset:0, limit:2000, incrementing offset until the entire file is read' file-injector.ts   # → 1
  - CONFIRM the PD1 directive-presence assert anchor exists:
      grep -cF 'paged directive block must be present (full path + size + read instruction)' file-injector.test.mjs   # → 1
  - IDEMPOTENCY GUARD: if `grep -qF 'offset:2001, limit:2000' file-injector.ts` AND the harness is 49/49
    AND PD1 already has the hardcoded pin → already done; STOP. Do NOT force the edits.

# ── TEST EDIT FIRST (TDD red: PD1 fails against the unchanged offset:0 directive) ─────────
Task 1: EDIT ./file-injector.test.mjs — insert the hardcoded 'offset:2001, limit:2000' assertion + comment
        inside PD1, immediately after PD1's directive-presence assert.  [see "Exact source to write" → Edit 2]
        After this task ALONE: `node ./file-injector.test.mjs` → 48 passed, 1 FAILED (PD1) — expected red.

# ── THE FIX (TDD green) ────────────────────────────────────────────────────────────────
Task 2: EDIT ./file-injector.ts — formatPagedDirectiveBlock docstring + directive return string (atomic).
        [see "Exact source to write" → Edit 1]
        After this task: `node ./file-injector.test.mjs` → 49 passed, 0 failed — green.

POST-FLIGHT:
  - grep -qF 'offset:2001, limit:2000' file-injector.ts && echo "OK offset:2001 present" || echo "FAIL"
  - ! grep -qF 'offset:0, limit:2000, incrementing offset until the entire file is read' file-injector.ts && echo "OK old offset:0 gone" || echo "FAIL old string present"
  - grep -qF 'HEAD_BYTES = 8192' file-injector.ts && echo "OK HEAD_BYTES intact" || echo "FAIL"
  - grep -qF 'content.slice(0, HEAD_BYTES)' file-injector.ts && echo "OK byte head block intact" || echo "FAIL"
  - grep -qF 'r.text.includes("offset:2001, limit:2000")' file-injector.test.mjs && echo "OK PD1 pin present" || echo "FAIL"
  - Run the Validation Loop gates (Level 1 + Level 2).

DO NOT (out of scope):
  * touch HEAD_BYTES (L22), the byte head block (L266), injectFiles, the handler msg, Cases 9/12/F4/PN1
    (P1.M2.T1.S1), PD2/PD3/PD4, or README (P1.M3).
  * switch to a line-based head (architecture Option C — scope-expanding, contradicts the PRD, needs a PRD amendment).
  * add a new runCase (the PD1 pin is an extra assert INSIDE PD1; case count stays 49).
```

### Exact source to write (authoritative — 2 unique oldText/newText pairs, pre-verified 49/49)

> Apply as ONE `edit` call with 2 `edits[]` entries, OR 2 single edits. **Apply Edit 2 (test) before
> Edit 1 (source)** for the TDD-red→green sequence (optional — Level 2 is order-independent).
> Every `oldText` is grep-confirmed UNIQUE. Em dashes: the returned-string literal uses `\u2014` (JS
> escape); the docstring uses literal `—` (U+2014). Match both byte-for-byte.

**Edit 1 — `file-injector.ts` (formatPagedDirectiveBlock: docstring + signature + return, atomic):**
```diff
 /** PRD §5.5 — directive block for a paged (oversize) text file. Emits a <file name="abs"> note
- *  giving the full path + estimated size and instructing the model to load the rest via the read
- *  tool at offset:0, limit:2000 (the read tool's DEFAULT_MAX_LINES=2000), incrementing offset
- *  until the whole file is read. Reuses the em dash (U+2014) from formatBinaryBlock/formatEmptyImageBlock.
- *  The head block is NOT this helper — it is formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)). */
+ *  giving the full path + estimated size and instructing the model to read the REMAINDER past the
+ *  ~2000-line head via the read tool at offset:2001, limit:2000 (Pi read offset is 1-indexed, so
+ *  offset:2001 is the first line AFTER the 8192-byte head; DEFAULT_MAX_LINES=2000), incrementing
+ *  offset by 2000 until the whole file is read. Reuses the em dash (U+2014) from
+ *  formatBinaryBlock/formatEmptyImageBlock. The head block is NOT this helper — it is
+ *  formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)). */
 export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {
-  return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first ' + HEAD_BYTES + ' bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>';
+  return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first ~2000 lines injected above. Use the read tool to read the rest: offset:2001, limit:2000, incrementing offset by 2000 until the entire file is read></file>';
 }
```

**Edit 2 — `file-injector.test.mjs` (PD1: insert hardcoded assertion + comment after the directive-presence assert):**
```diff
   const expectedDirective = mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length);
   assert(r.text.includes(expectedDirective), "paged directive block must be present (full path + size + read instruction)");
+  // HARDCODED pin (Issue 4): the directive must resume PAST the injected ~2000-line head. Pi's read
+  // offset is 1-indexed (offset:0 and offset:1 BOTH start at line 1, re-reading the head), so the
+  // directive must say offset:2001 (first line after the head), not offset:0/1. Guards the regression.
+  assert(r.text.includes("offset:2001, limit:2000"),
+    "paged directive must point past the injected head (offset:2001), not re-read it (offset:0/1)");
   // #@ stripped from the injected marker; the path stays
   assert(r.text.startsWith("Summarize huge.log"), "#@huge.log must be stripped to huge.log (path stays)");
```

### Implementation Patterns & Key Details
```typescript
// PATTERN (the directive string — Option A, smallest diff). OLD vs NEW:
//   OLD suffix: "…first " + HEAD_BYTES + " bytes injected above. Use the read tool to load the rest:
//               offset:0, limit:2000, incrementing offset until the entire file is read></file>"
//   NEW suffix: "…first ~2000 lines injected above. Use the read tool to read the rest:
//               offset:2001, limit:2000, incrementing offset by 2000 until the entire file is read></file>"
// Three deltas: (1) "first <HEAD_BYTES> bytes" → "first ~2000 lines" (line-based, matches offset/limit);
// (2) "load the rest: offset:0" → "read the rest: offset:2001" (resume PAST the head); (3) "incrementing
// offset" → "incrementing offset by 2000" (explicit step, matching limit:2000).

// WHY offset:2001 (not offset:1 or offset:2000): Pi read offset is 1-indexed: startLine = offset ?
// Math.max(0, offset-1) : 0. offset:0 ≡ offset:1 (both → startLine 0 → line 1, the head). offset:2001 →
// startLine 2000 → reads from line 2001 (the first line AFTER a 2000-line head). Consistent with the
// PRD's "8192 bytes ≈ 2000 lines" framing. (See architecture/external_deps.md §1.)

// WHY the hardcoded pin is required: PD1/PD2 do `mod.formatPagedDirectiveBlock(HUGE, …)` to BUILD the
// expected string, then assert r.text.includes(it). So ANY change to the helper auto-matches — they pass
// for offset:0, offset:2001, or offset:banana. Only `assert(r.text.includes("offset:2001, limit:2000"))`
// actually pins the CORRECT offset (the contract's test-quality note).

// TDD ORDERING: Edit 2 (test pin) first → PD1 fails (directive still offset:0 → includes("offset:2001…
// is false) → 48 passed, 1 failed (the red). Edit 1 (source string) → directive offset:2001 → PD1
// passes → 49/49 (the green). Simulated end-to-end in research §4.

// GOTCHA (em dash glyphs): the returned string literal uses `\u2014` (JS escape) — keep it as `\u2014`.
// The docstring uses a literal `—` (U+2014) — keep it literal. Both render as the same glyph at runtime;
// they are different SOURCE bytes. Do not convert one to the other.
```

### Integration Points
```yaml
NO INTEGRATION CHANGE:
  - "Internal directive-string fix + 1 test assertion. No new imports, config, API/type-signature change,
    no docs (README does not quote the directive string). formatPagedDirectiveBlock keeps its signature;
    the paged branch in injectFiles (L265-267) is UNCHANGED (it still pushes the byte head block + this helper)."
  - "Disjoint from P1.M2.T1.S1 (handler msg + notify cases) and P1.M1.T1.S1/S2 (injectFiles). Lands cleanly in parallel."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — a single-file Pi extension validated by a
> **model-free Node ESM harness** (`file-injector.test.mjs`, run via `node`). The `pytest`/`mypy`/`ruff`
> gates DO NOT APPLY. Gates below are project-specific and **verified on this machine**: the full 2-edit
> set was applied to temp copies → **49/49 green**, new directive verified (research §4).

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. Directive now resumes past the head (offset:2001); old offset:0 directive string GONE.
grep -qF 'offset:2001, limit:2000, incrementing offset by 2000' file-injector.ts && echo "OK: offset:2001 directive" || echo "FAIL: new directive missing"
! grep -qF 'offset:0, limit:2000, incrementing offset until the entire file is read' file-injector.ts && echo "OK: old offset:0 directive gone" || echo "FAIL: old directive still present"

# 1b. ZERO 'offset:0' remains in the returned directive (the docstring was updated too).
grep -qF 'offset:0, limit:2000 (the read tool' file-injector.ts && echo "FAIL: stale docstring offset:0" || echo "OK: docstring updated"

# 1c. UNTOUCHED invariants: HEAD_BYTES constant + byte head block in injectFiles.
grep -qF 'const HEAD_BYTES = 8192;' file-injector.ts && echo "OK: HEAD_BYTES intact" || echo "FAIL"
grep -qF 'blocks.push(formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)));' file-injector.ts && echo "OK: byte head block intact" || echo "FAIL"

# 1d. PD1 has the hardcoded pin; em dash preserved in the returned directive.
grep -qF 'r.text.includes("offset:2001, limit:2000")' file-injector.test.mjs && echo "OK: PD1 pin present" || echo "FAIL: PD1 pin missing"
grep -qF '<large file \u2014 estimated' file-injector.ts && echo "OK: em dash \\u2014 preserved in directive" || echo "FAIL: em dash lost"

# 1e. Case count UNCHANGED (the pin is an extra assert inside PD1, not a new runCase).
[ "$(grep -cE 'await runCase\(' file-injector.test.mjs)" = "49" ] && echo "OK: 49 cases" || echo "FAIL: case count != 49"

# Expected: every line prints OK.
```

### Level 2: Full Harness (PRIMARY GATE)
```bash
cd /home/dustin/projects/pi-auto-reader
node ./file-injector.test.mjs
# Expected: "Result: 49 passed, 0 failed." exit 0. (Count UNCHANGED — no cases added/removed.)
# PD1 prints with the new hardcoded pin green; PD2 still derives the directive from the helper (auto-match).
# If PD1 FAILS after Edit 2 (test) but BEFORE Edit 1 (source) → that's the expected TDD-red state; apply
#   Edit 1 to go green. If PD1 STILL fails after Edit 1 → the directive string wasn't updated to
#   offset:2001 (re-check `grep -F 'offset:2001, limit:2000' file-injector.ts`).
# If a NON-paged case fails → you over-edited (e.g. touched injectFiles or HEAD_BYTES). Re-read the diff.
```

### Level 3: Directive String Inspection (NON-INTERACTIVE, NO MODEL — optional confidence)
The new directive string was verified by importing the live .ts after the edit (research §4). To re-confirm:
```bash
cd /home/dustin/projects/pi-auto-reader
node --input-type=module -e '
import * as path from "node:path";
import { execSync } from "node:child_process";
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
  "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
}});
const mod = await jiti.import(path.resolve(process.cwd(), "file-injector.ts"));
const d = mod.formatPagedDirectiveBlock("/x/huge.log", 2097152);
console.log(d);
console.log("includes offset:2001, limit:2000:", d.includes("offset:2001, limit:2000"));
console.log("includes offset:0            :", d.includes("offset:0"));
'
# Expected: directive printed; includes 'offset:2001, limit:2000' = true; includes 'offset:0' = false.
```

### Level 4: (none — no live-Pi scenario needed)
The directive is a model-facing string fully covered by the model-free harness (PD1 exercises the paged
branch end-to-end: injectFiles with PAGED_FIX → head block + directive). No live-Pi run adds signal beyond Level 2/3.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: offset:2001 directive present; old offset:0 directive gone; docstring updated; HEAD_BYTES +
      byte head block intact; PD1 pin present; em dash `\u2014` preserved; case count 49.
- [ ] Level 2: `node ./file-injector.test.mjs` → **49 passed, 0 failed**, exit 0.
- [ ] Level 3 (optional): live directive includes `offset:2001, limit:2000`, excludes `offset:0`.

### Feature Validation
- [ ] `formatPagedDirectiveBlock(abs, totalBytes)` returns a directive with `offset:2001, limit:2000`,
      incrementing by 2000, "first ~2000 lines injected above".
- [ ] The directive no longer contains `offset:0` (would re-read the head).
- [ ] PD1 asserts `r.text.includes("offset:2001, limit:2000")` (the regression guard).
- [ ] PD2/PD3/PD4 unchanged; PD2 still derives the directive from the helper (auto-matches).

### Code Quality Validation
- [ ] Only the 2 specified edits (1 source docstring+string, 1 PD1 assert); nothing else.
- [ ] HEAD_BYTES (L22) + byte head block (L266) + injectFiles + handler + notify cases UNTOUCHED.
- [ ] Em dash (`\u2014` in the literal, `—` in the docstring) preserved; signature + close brace unchanged.
- [ ] Docstring updated to match the new directive (no stale "offset:0" / "load the rest" claims).
- [ ] No new runCase (case count 49); no README change (P1.M3 owns the sweep).

### Documentation & Deployment
- [ ] No new env vars / config / API surface (internal directive-string fix).
- [ ] README not edited (the directive string is not quoted there; P1.M3 owns the final sweep).

---

## Anti-Patterns to Avoid
- ❌ Don't change `offset:0` → `offset:1` — they are **identical** (Pi's 0-clamp makes both read from line
  1). The only fix that resumes past the head is `offset:2001`. (See architecture/external_deps.md §1.)
- ❌ Don't touch `HEAD_BYTES` (L22) or the byte head block `content.slice(0, HEAD_BYTES)` (L266) — item §3
  pins them. Only the directive STRING in `formatPagedDirectiveBlock` changes (Option A, smallest diff).
- ❌ Don't switch to a line-based head (architecture "Option C") — it is scope-expanding, contradicts the
  PRD's explicit `HEAD_BYTES` byte pin, and requires a PRD amendment. Explicitly out of scope.
- ❌ Don't rely on PD1/PD2's derived assertion alone — they build the expected string from the helper
  (presence, not correctness) and pass for ANY offset. The **hardcoded** `includes("offset:2001,
  limit:2000")` pin is what actually guards the regression.
- ❌ Don't convert `\u2014` (in the returned-string literal) to a literal `—`, or vice versa in the
  docstring — they are different SOURCE bytes; match each byte-for-byte in oldText and preserve each in newText.
- ❌ Don't drop the `+ abs +` / `+ totalBytes +` interpolation — keep interpolating the path and byte size.
  Only the `+ HEAD_BYTES +` byte interpolation goes away (replaced by the literal "~2000 lines"); the
  HEAD_BYTES CONSTANT itself stays.
- ❌ Don't touch the handler notify msg or Cases 9/12/F4/PN1 (P1.M2.T1.S1, parallel on disjoint regions)
  or injectFiles (P1.M1.T1.S1/S2, Complete).
- ❌ Don't add a new `runCase` — the PD1 pin is an extra `assert` INSIDE PD1; the case count stays 49.
- ❌ Don't edit PD2/PD3/PD4 — PD2 auto-matches the helper; PD3/PD4 don't assert the directive string.
- ❌ Don't apply the source edit (Edit 1) BEFORE the test pin (Edit 2) if you want the TDD-red→green
  signal — but the final 49/49 is identical either way (Level 2 is order-independent).

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a 2-edit surgical fix (1 source docstring+directive-string change in
`formatPagedDirectiveBlock`, 1 hardcoded assertion inserted inside PD1), every edit given as a unique
exact-text anchor (grep-verified). The **complete 2-edit set was applied to temp copies of both files and
the harness run → 49/49 green**, with the new directive verified to include `offset:2001, limit:2000` and
exclude `offset:0`, the em dash (`\u2014`) preserved, and HEAD_BYTES + the byte head block confirmed
intact (research §4). The TDD-red→green sequence was also simulated (Edit 2 alone → `48 passed, 1 failed`
on PD1; +Edit 1 → `49/49`). The runtime change is a single string literal (jiti transpiles it trivially);
the function signature, the paged branch caller, and all other cases are untouched. The scope is cleanly
disjoint from the parallel sibling P1.M2.T1.S1 (handler msg + notify cases) and from P1.M1.T1.S1/S2
(injectFiles) — no merge-conflict surface. Residual 0.5 is for a possible em-dash/whitespace byte-slip in
the multi-line source oldText (the docstring has two literal `—` glyphs + the `\u2014` escape in the
return line) — fully caught by Level 1 (1a–1e) + Level 2 (49/49) + Level 3 (directive includes/excludes).
