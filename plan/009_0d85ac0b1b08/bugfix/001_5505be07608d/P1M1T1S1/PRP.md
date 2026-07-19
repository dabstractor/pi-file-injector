# PRP — P1.M1.T1.S1 (bugfix 001_5505be07608d): Fix SEP literal + matching docstrings/comments in computeDetailOffsets

> **Scope flag:** This is a **tiny surgical bugfix** (Major): `computeDetailOffsets` uses `const SEP = "\\n\\n";`
> (a 4-char backslash-n-backslash-n literal) while the real assembly joins with `"\n\n"` (2 real newlines). The
> mismatch corrupts every file's body after the first in the expanded (`ctrl+o`) view. Fix = THREE edits
> (L354 SEP, L355 comment, L343 JSDoc): `"\\n\\n"` → `"\n\n"` so `SEP.length === 2`. **Scope = S1 ONLY.**
> Multi-file regression tests are T2; README review is T3. The model is unaffected (only the TUI expanded view).

---

## Goal

**Feature Goal:** Make `computeDetailOffsets`' separator constant match the real `blocks.join("\n\n")` assembly
so the expanded (`ctrl+o`) view shows each file's exact body (not a +2-char-per-preceding-block drifted slice).

**Deliverable:** Modified `file-injector.ts` — three edits in `computeDetailOffsets` + its JSDoc: L354
`const SEP = "\\n\\n";` → `"\n\n"`; L355 comment `blocks.join("\\n\\n")` → `blocks.join("\n\n")`; L343 JSDoc
`blocks.join("\\n\\n")` → `blocks.join("\n\n")`. No other line changes.

**Success Definition:**
1. `npm run typecheck` → 0 errors.
2. `node ./file-injector.test.mjs` → 156 passed; `relative-imports` 38 + `import-behavior` 23 (217 total, unchanged).
3. `grep 'const SEP' file-injector.ts` shows `"\n\n"` (single backslash); all five `blocks.join(` sites (343/354/355/457/1286) use single-backslash `"\n\n"`.
4. (Behavioral proof of the fix is locked in by T2's multi-file regression tests; S1 ships the corrected constant.)

## Why

- **Restores an explicit PRD acceptance criterion.** PRD §6.3 ("Expanded: each file's full delivered text renders
  below its `read` line") + §11 test #34 ("multi-file: Both expand together on `ctrl+o`"). Today the first file's
  expanded body is correct but every subsequent file is shifted +2 chars/block (missing leading chars, trailing
  garbage). For the headline transitive-import feature (`spec.md → api.md → arch.md`), every file after the first
  renders corrupted.
- **The model is unaffected; only the display.** `message.content` is the correct `blocks.join("\n\n")`;
  `convertToLlm()` sends it verbatim. Only the TUI renderer's tier-1 offset slice reads the corrupted
  `contentStart`. So this is a display-correctness fix, not a data-integrity fix — but it violates a primary-use-case acceptance criterion.
- **One-character root cause, maximally localized.** `SEP.length` is 4 but the real join separator is 2 →
  `starts[i]` accumulates `+2` too many per block. Changing the literal from `"\\n\\n"` (4) to `"\n\n"` (2) makes
  the offset tier correct for any number of files. Three sites reference the literal; all three are updated.

## What

### User-visible behavior

- Pressing `ctrl+o` on a multi-file injected box now shows each file's exact body (the first file was already
  correct; files 2..N are fixed). Single-file expansion is unchanged (it was already correct).

### Technical behavior (the contract)

- `SEP` (local to `computeDetailOffsets`) evaluates to a 2-char string (two real newlines), matching
  `"\n\n".length === 2` used by `blocks.join("\n\n")` at L1286. `starts[i]` is then the true absolute offset of
  block `i` within the assembled content.

### Success Criteria

- [ ] L354 reads `const SEP = "\n\n";` (single backslash; `SEP.length === 2`).
- [ ] L355 comment and L343 JSDoc read `blocks.join("\n\n")` (single backslash).
- [ ] L457 and L1286 UNCHANGED (already single-backslash).
- [ ] The opener/closer `\\n` in the JSDoc (block format description) UNCHANGED (out of scope).
- [ ] `npm run typecheck` → 0 errors; all 217 existing tests pass.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact three line-level edits, the escaping explanation (double→single backslash), the do-not-touch sites, and
the gate. Three one-line edits in one file.

### Documentation & References

```yaml
# MUST READ — the bug reproduction + root cause + the one-line fix
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/system_context.md
  why: "§'The Bug (Issue 1)' pins L354 `const SEP = \"\\n\\n\"` (4-char) vs the L1286 `blocks.join(\"\\n\\n\")`
        (2-char); explains the +2*i drift in starts[i]; confirms the model is unaffected and the existing
        single-block tests have zero drift; gives the standalone Node repro."
  critical: "The fix is the SEP literal (L354) + the two matching blocks.join(\"\\n\\n\") docstrings (L343, L355).
             L457 and L1286 already use the correct single-backslash form — DO NOT touch them."

# MUST READ — the PRD contract being restored
- file: PRD.md  (bugfix PRD §h3.0 Issue 1)
  why: "States §6.3 (expanded view shows each file's full text) + §11 #34 (multi-file expands together) as the
        acceptance criteria; frames the +2/block drift; notes the model is unaffected (message.content is correct)."

# The file you edit (THREE one-line edits)
- file: file-injector.ts
  why: "computeDetailOffsets at L353; SEP at L354; comment at L355; JSDoc `blocks.join(\"\\n\\n\")` at L343.
        The real assembly is L1286 `content: blocks.join(\"\\n\\n\")`; L457 documents it correctly. SEP is a LOCAL
        const used only in the `off += b.length + SEP.length` loop (L357) — no other consumer."
  pattern: "L457 and L1286 are the reference for the CORRECT form: `\"\n\n\"` (single backslash, length 2). Make
            L343/354/355 match them exactly."
  gotcha: "The source has DOUBLE backslashes (\\n) which TS parses as literal backslash+n. Change to SINGLE
           backslash (\\n → newline). It's a backslash-count change, not a content change. Do NOT also 'fix' the
           opener/closer `\\n` in the JSDoc — those are cosmetic comment text, out of scope."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. A string-literal value change (4-char → 2-char) has no type impact → clean."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (3 one-line edits: L354 SEP, L355 comment, L343 JSDoc)
├── file-injector.test.mjs    # run to confirm green (NOT edited — single-block tests, zero drift)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/
    ├── architecture/{system_context.md, regression_test_design.md, external_deps.md}
    └── P1.M1.T1.S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — L354 `const SEP = "\n\n";`; L355 + L343 `blocks.join("\n\n")`.
# No other files. No test changes in S1 (T2 adds multi-file regression cases). No new exports/imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the escaping. Source `"\\n\\n"` (DOUBLE backslash) → TS evaluates to a 4-char literal `\n\n`
//   (backslash, n, backslash, n). Source `"\n\n"` (SINGLE backslash) → TS evaluates to 2 real newlines.
//   VERIFIED: `"\n\n".length === 2`; buggy `"\\n\\n".length === 4`. The edit changes DOUBLE → SINGLE backslash
//   so SEP.length goes 4 → 2, matching `"\n\n".length === 2` at the L1286 join.

// CRITICAL — change EXACTLY 3 sites: L354 (SEP), L355 (comment), L343 (JSDoc). L457 and L1286 ALREADY use the
//   correct single-backslash `"\n\n"` — DO NOT touch them (touching L1286 would be harmless but is out of scope;
//   touching L457 likewise). The item: "Do NOT change any other line."

// GOTCHA — the computeDetailOffsets JSDoc also contains `<file name="ABS">\\n` and `\\n</file>` (the opener/
//   closer format description, around L360). Those `\\n` are in a COMMENT (no escape processing in comments;
//   no runtime effect). They are cosmetic prose, NOT the separator bug. OUT OF SCOPE — leave them. Changing
//   them would exceed the 3-edit scope and is unnecessary.

// GOTCHA — the bug only manifests for MULTI-block content (i ≥ 1: starts[i] drifts +2*i). Single-block content
//   has starts[0] === 0 regardless of SEP.length → the existing 156 tests (all single-block renderer cases) are
//   unaffected. The multi-file proof lands in T2 (REND-MULTI-OFFSET + REND-MULTI-E2E).

// LIBRARY — `SEP` is a local `const` inside computeDetailOffsets; used only in `off += b.length + SEP.length`.
//   No other symbol references it. A string-literal value change cannot affect types → typecheck stays clean.
```

## Implementation Blueprint

### Data models and structure

No data-model change. `computeDetailOffsets(blocks, details): FileDetail[]` signature unchanged. The fix is a
local-const string-literal value change (4-char → 2-char) + two matching comment/JSDoc text updates.

### Implementation Patterns & Key Details

```ts
// === computeDetailOffsets (L353-…) — THREE edits ===

// L354 BEFORE:  const SEP = "\\n\\n";              // 4-char (backslash-n-backslash-n) — BUG
// L354 AFTER:   const SEP = "\n\n";                // 2-char (two real newlines) — matches blocks.join("\n\n")

// L355 BEFORE:  // absolute char offset of each block within blocks.join("\\n\\n")
// L355 AFTER:   // absolute char offset of each block within blocks.join("\n\n")

// L343 (JSDoc) BEFORE:  *  `blocks.join("\\n\\n")` depends on every PRIOR block's length — `emitText` cannot know it at emit time.
// L343 (JSDoc) AFTER:   *  `blocks.join("\n\n")` depends on every PRIOR block's length — `emitText` cannot know it at emit time.

// The loop itself is UNCHANGED:
//   const starts: number[] = [];
//   let off = 0;
//   for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }   // SEP.length now 2 → correct offsets
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 3 one-line edits in/around computeDetailOffsets):
  - L354: `const SEP = "\\n\\n";` → `const SEP = "\n\n";`
  - L355: comment `blocks.join("\\n\\n")` → `blocks.join("\n\n")`
  - L343: JSDoc `blocks.join("\\n\\n")` → `blocks.join("\n\n")`
  - UNCHANGED: L457 (`blocks.join("\n\n")` — already correct); L1286 (`content: blocks.join("\n\n")` — the real
    assembly, the source of truth); the opener/closer `\\n` in the JSDoc (cosmetic, out of scope); everything else.

NO_CHANGES: the three .mjs suites, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports/imports. NO test edits (T2 owns the multi-file regression cases).
```

### Implementation Tasks (ordered)

```yaml
Task 1: FIX the SEP literal (L354)
  - CHANGE: `const SEP = "\\n\\n";` → `const SEP = "\n\n";` (double → single backslash; SEP.length 4 → 2).
  - This is the load-bearing edit — the actual bug fix.

Task 2: FIX the inline comment (L355)
  - CHANGE: `blocks.join("\\n\\n")` → `blocks.join("\n\n")` in the comment immediately below SEP.

Task 3: FIX the JSDoc (L343)
  - CHANGE: `blocks.join("\\n\\n")` → `blocks.join("\n\n")` in the JSDoc line.

Task 4: VERIFY scope + gates
  - grep 'const SEP' file-injector.ts → shows `"\n\n"` (single backslash).
  - grep 'blocks.join(' file-injector.ts → ALL FIVE sites (343/354/355/457/1286) use single-backslash `"\n\n"`.
  - Confirm L457 and L1286 are UNCHANGED (they were already correct).
  - Confirm the opener/closer `\\n` in the JSDoc is UNCHANGED (out of scope).
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 156 passed; relative-imports 38; import-behavior 23 (217 total).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# A string-literal value change has no type impact.
```

### Level 2: The Regression Gate (all 217 tests stay green — single-block, zero drift)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 156 passed, 0 failed
node ./relative-imports.test.mjs     # →  38 passed, 0 failed
node ./import-behavior.test.mjs      # →  23 passed, 0 failed
# Expected: all green, unchanged. The renderer offset tests are all single-block (starts[0]===0, drift zero),
# so changing SEP.length 4→2 does not flip any. If a case flips, the edit over-reached (re-check only 3 sites changed).
```

### Level 3: Scope verification (all five join sites consistent; do-not-touch sites intact)

```bash
cd /home/dustin/projects/pi-file-injector
echo "=== all blocks.join( sites must be single-backslash \"\\n\\n\" ==="
grep -n 'blocks.join(' file-injector.ts
# Expected: L343/355 (now fixed) + L457/1286 (already correct) all show blocks.join("\n\n") — NONE show "\\n\\n".
echo "=== SEP ==="
grep -n 'const SEP' file-injector.ts
# Expected: `const SEP = "\n\n";` (single backslash).
echo "=== opener/closer \\n in JSDoc (must STILL be double-backslash — out of scope) ==="
grep -n '<file name="ABS">\\\\n\|\\\\n</file>' file-injector.ts   # adjust to match; confirm UNCHANGED
```

### Level 4: Multi-file behavioral proof (lands in T2; S1 ships the corrected constant)

```bash
# S1 does NOT add the multi-file regression test (that is T2.S1 REND-MULTI-OFFSET + T2.S2 REND-MULTI-E2E).
# The in-S1 proof is Level 3 (the constant is corrected) + Level 2 (no regression). The authoritative
# behavioral proof — that a 2-file/3-file expanded view slices each body correctly — is T2's job.
# (Ad-hoc, optional: the standalone Node repro in system_context.md §'The Bug' can be re-run to confirm
#  b.ts now slices to "function b() { return 2; }" instead of "nction b() { return 2; }\n<".)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 156 passed; `relative-imports` 38 + `import-behavior` 23 (217 total).
- [ ] L354 `const SEP = "\n\n";` (single backslash; `SEP.length === 2`).
- [ ] L355 + L343 `blocks.join("\n\n")` (single backslash).

### Scope Discipline

- [ ] L457 UNCHANGED; L1286 UNCHANGED (both already correct single-backslash).
- [ ] The opener/closer `\\n` in the JSDoc UNCHANGED (cosmetic, out of scope).
- [ ] No other line changed; no test edits; no new exports/imports.

### Code Quality Validation

- [ ] All five `blocks.join(` sites (343/354/355/457/1286) now consistent (single-backslash `"\n\n"`).
- [ ] SEP matches the L1286 assembly exactly (`SEP.length === "\n\n".length === 2`).
- [ ] The fix is the literal + its two docstring mirrors; the loop body is unchanged.

### Documentation

- [ ] No README/user-facing change (internal separator-literal fix; README L41 already describes the expanded view correctly).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch L457 or L1286.** They already use the correct single-backslash `"\n\n"`. L1286 is the real
  assembly (the source of truth SEP must match); editing it is harmless but out of scope and muddies the diff.
- ❌ **Do NOT "fix" the opener/closer `\\n` in the JSDoc.** `<file name="ABS">\\n` and `\\n</file>` are cosmetic
  comment text describing the block format (comments have no escape processing; zero runtime effect). They are
  NOT the separator bug. The item scopes exactly 3 edits — leave them.
- ❌ **Do NOT change the loop body.** `for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }`
  is correct; only the SEP VALUE (4→2) is wrong. Changing `SEP.length` by fixing the literal makes the loop correct.
- ❌ **Do NOT add the multi-file regression test in S1.** REND-MULTI-OFFSET (T2.S1) and REND-MULTI-E2E (T2.S2)
  are separate subtasks. S1 ships the corrected constant; T2 locks in the behavioral proof.
- ❌ **Do NOT confuse double-vs-single backslash.** The source currently has `"\\n\\n"` (DOUBLE backslash → 4-char
  literal). It must become `"\n\n"` (SINGLE backslash → 2 real newlines). It's a backslash-COUNT change. If you
  write `"\n\n"` but the file ends up with real newlines inside the quotes (a multi-line string), that's wrong —
  it must be backslash-n-backslash-n SOURCE that TS parses into two newlines.
- ❌ **Do NOT claim the bug is "verified fixed" by the existing 156 tests.** They are all single-block (zero
  drift) — they prove NO REGRESSION, not that the multi-file bug is fixed. The multi-file proof is T2.

---

## Confidence Score: 10/10

A three-one-line-edit fix with the root cause, the exact old→new text, the escaping explained and verified
(`"\n\n".length === 2` vs buggy `"\\n\\n".length === 4`), the do-not-touch sites enumerated, and the gate
confirmed green. The architecture doc and the PRD both pin L354 as the single defect; the model is unaffected
and the existing single-block tests have zero drift, so the regression risk is nil. The only thing S1 does NOT
do is add the multi-file regression test (T2's job) — S1 ships the corrected constant and proves no regression.