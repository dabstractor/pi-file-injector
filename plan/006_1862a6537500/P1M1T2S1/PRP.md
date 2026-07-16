---
name: "P1.M1.T2.S1 (plan/006) — Fix PRD.md Done-definition: 'all 24' → 'all 32' test cases"
prd_ref: "PRD Appendix A (Done-definition, PRD.md:1189) vs §11 Manual test matrix (PRD.md:944-979, 32 rows #1-#32)"
target_file: "./PRD.md"   # EDIT IN PLACE — one-token substitution on line 1189 ONLY
target_language: Markdown (documentation; no code, no tests, no build)
depends_on: "NONE (pure doc fix; independent of T1.S1/S2/S3 green gates — though consistent with them: the 32 matrix rows ARE the cases the suites exercise)"
consumed_by: "NONE downstream. This is a doc-coherence fix; it closes a stale test-count nit found by the doc audit (plan/006/architecture/research-doc-audit.md)."
---

# PRP — P1.M1.T2.S1: Fix PRD.md Done-definition "all 24" → "all 32" test cases

> **Scope flag:** This is a **one-token documentation fix** to the PRD's own Done-definition. PRD.md is
> normally read-only, but this subtask is an **explicitly sanctioned, scoped exception** (item §1-7): the
> Done-definition drifted when the §11 manual test matrix grew from 24 → 32 rows. Change exactly one
> number on one line; touch nothing else in PRD.md; verify no other stale count leaked. No code, no tests.

---

## Goal

**Feature Goal:** Correct the stale test-count in PRD.md's Done-definition (Appendix A, L1189) from
"all 24 manual test cases" to "all 32 manual test cases" so the PRD's acceptance summary matches its own
§11 manual test matrix, which lists exactly 32 rows (#1–#32, contiguous, no gaps).

**Deliverable:** Modified `./PRD.md` where line 1189 reads `**Done-definition:** all 32 manual test cases in §11 pass; ...`
(was `all 24`). Every other line of PRD.md is byte-for-byte unchanged — especially `PRD.md:971`
(`| 24 | top-level no fallback |`), which is row **index** #24 (a row, not a count) and must stay "24".

**Success Definition:** `git diff PRD.md` shows exactly ONE one-character change (`24` → `32`) on line 1189
and nothing else. A post-fix grep confirms no remaining stale "24" test-count reference (`grep -nE '24.*test|24.*case|all 24' PRD.md` returns nothing meaningful). No test suite or build is affected (PRD.md is documentation only).

## User Persona

**Target User:** PRD reader (maintainer, reviewer, implementer) who relies on the Done-definition as the
acceptance summary and would be misled by a count that doesn't match the §11 matrix.

**Use Case:** A reviewer reads the Done-definition ("all 24 manual test cases pass") then opens §11 and
counts 32 rows — the mismatch erodes trust in the doc. The fix makes the summary internally consistent.

**Pain Points Addressed:** Documentation drift. The matrix grew (cases #25–#32 added for bare-`@` + relative
disambiguation + deep resolution) but the Done-definition wasn't updated, leaving a stale "24".

## Why

- **Doc coherence.** The Done-definition is the PRD's single-sentence acceptance summary; it must agree
  with the §11 matrix it references. A 24-vs-32 mismatch is a visible inconsistency that undermines the
  doc's authority and can cause a reviewer to think cases are missing (or extra).
- **Closes the doc-audit finding.** `plan/006_1862a6537500/architecture/research-doc-audit.md` Part 1
  identified this as the **single actionable defect** in PRD.md ("`PRD.md:1189` — 'all 24' → 'all 32'").
  This subtask lands exactly that fix.
- **Sanctioned PRD edit.** PRD.md is normally read-only (the agent prompt forbids modifying it), but this
  subtask is the one explicitly-scoped exception in the v006 delta — a verification/doc-coherence fix to
  the PRD's own summary, not a requirement change. The edit is bounded to one token on one line.

## What

A single number changed on one line of PRD.md. No user-facing or runtime behavior change (PRD.md is not
loaded by any code or test — it is pure documentation).

### Success Criteria

- [ ] `PRD.md:1189` reads `**Done-definition:** all 32 manual test cases in §11 pass; ...` (was `all 24`).
- [ ] `git diff PRD.md` shows exactly ONE change: `24` → `32` on line 1189. No other line is modified.
- [ ] `PRD.md:971` (`| 24 | top-level no fallback |`) is UNCHANGED — that "24" is row index #24, not a count.
- [ ] Post-fix `grep -nE '24.*test|24.*case|all 24' PRD.md` returns no stale-count matches (the only
      remaining "24" is L971's row index, which doesn't match this pattern).
- [ ] No other file is touched. No test suite is run as a gate (PRD.md isn't loaded by code/tests).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives the exact line (1189), the exact current text, the exact replacement,
the unique oldText anchor for the edit tool, the explicit "do NOT touch L971" disambiguation (the only
other "24" in the file), the verified §11 row count (32, at L948–L979), and the grep-based post-fix
verification. The implementer makes one surgical edit and runs one grep.

### Documentation & References

```yaml
# MUST READ — the audit that found this defect (confirms it's the ONLY stale count in PRD.md)
- file: plan/006_1862a6537500/architecture/research-doc-audit.md
  why: "Part 1 locates the defect (PRD.md:1189, 'all 24' → 'all 32'), confirms it's the ONLY stale
        test-count reference (the other '24' at L971 is row #24, not a count), and Part 2 confirms §11
        has exactly 32 rows (#1-#32, no gaps). This is the authoritative finding this subtask lands."
  section: "Part 1 — The '24 manual test cases' / Done-definition + Part 2 — §11 row count"
  critical: "Part 1 is explicit: 'Only one: PRD.md:1189. The other 24 at PRD.md:971 is row #24 (a row
             index, not a count).' Do NOT touch L971."

# MUST READ — the file you edit (the ONLY change)
- file: PRD.md
  why: "1189 lines. Line 1189 (last line, Appendix A Done-definition) is the fix site. Line 971 is row #24
        (DO NOT TOUCH). §11 manual test matrix is L944 (header) / L946 (table header) / L948-979 (32 data
        rows). Use the edit tool with a unique oldText anchor (see Implementation Blueprint)."
  pattern: "The Done-definition line is unique in the file (the string 'Done-definition' appears once), so
            oldText: '**Done-definition:** all 24 manual test cases in §11 pass;' is a safe unique anchor."
  gotcha: "There are exactly TWO lines in PRD.md containing the literal '24': L971 (row index #24 — KEEP)
           and L1189 (the stale count — FIX). Do not grep-and-replace '24' globally — that would corrupt
           L971. Use the precise oldText anchor that includes 'Done-definition:' and 'manual test cases'."

# Cross-check context — the §11 matrix the count must match (read-only; do not edit)
- file: PRD.md
  why: "§11 Manual test matrix (L944-979) is the source of truth: 32 rows #1-#32. The Done-definition count
        (L1189) must equal this. Verified: `grep -cE '^\\| [0-9]+ ' PRD.md` = 36 (4 import-source rows at
        L200-203 + 32 matrix rows at L948-979); the matrix alone is 32."
  section: "## 11. Acceptance Criteria & Test Plan → ### Manual test matrix"
```

### Current Codebase tree

```bash
pi-file-injector/
├── PRD.md                    # ← THE ONLY FILE EDITED (line 1189: 'all 24' → 'all 32'; line 971 UNCHANGED)
├── README.md                 # untouched (coherence = P1.M1.T2.S2)
├── file-injector.ts          # untouched (JSDoc coherence = P1.M1.T2.S3)
├── file-injector.test.mjs    # untouched
├── relative-imports.test.mjs # untouched
└── plan/006_1862a6537500/
    ├── architecture/research-doc-audit.md   # ← the audit finding this fix lands (Part 1)
    └── P1M1T2S1/
        ├── research/research_notes.md       # ← line/row-count verification + edit spec (this subtask)
        └── PRP.md                            # (this file)
```

### Desired Codebase tree (files touched)

```bash
PRD.md    # MODIFIED — one token on line 1189: 'all 24' → 'all 32'.
# No other files. No new files. No code/test changes.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — there are EXACTLY TWO lines in PRD.md containing the literal "24":
     L971: "| 24 | top-level no fallback | ..."   ← row INDEX #24 (a row, not a count) — KEEP AS-IS
     L1189: "**Done-definition:** all 24 manual test cases ..."   ← the stale COUNT — FIX TO 32
     Do NOT grep-and-replace "24" globally — that would corrupt L971. Use a precise oldText anchor that
     includes "Done-definition:" and "manual test cases" so it matches ONLY L1189. -->

<!-- CRITICAL — PRD.md is normally READ-ONLY (the agent prompt forbids modifying it). This subtask is the
     ONE explicitly-sanctioned exception in the v006 delta (item §1-7): a doc-coherence fix to the PRD's
     own Done-definition. Do NOT generalize this — scope the edit to exactly the one substitution on L1189.
     No requirement text, no §11 rows, no other section changes. -->

<!-- GOTCHA — PRD.md is NOT loaded by any code or test (file-injector.ts/.test.mjs don't import it). So this
     doc edit cannot break any build or test. There is no test gate for this subtask — validation is
     `git diff` scope (one token) + the post-fix grep (no stale count remains). -->

<!-- GOTCHA — the §11 matrix row count is the source of truth, not the Done-definition. Verified first-hand:
     32 rows at L948-979 (#1-#32, contiguous, no gaps/dups). The fix makes the SUMMARY match the MATRIX,
     not the other way around. Do not "fix" the matrix to be 24 — that would delete 8 valid test cases. -->
```

## Implementation Blueprint

### The exact edit (PRD.md line 1189)

**Current text (the full line, for context):**
```markdown
**Done-definition:** all 24 manual test cases in §11 pass; no uncaught errors; the model receives whole-file contents with **zero** `read` tool calls for `#@`-injected files that fit remaining context; markdown imports resolve relative to the importing file's directory (with `.md`/`.markdown` extension shorthand for extensionless tokens), skip code blocks, terminate on cycles, and dedup across the whole prompt; the context budget accounts for the total filesize of all delivered files (top-level + imports); prompts without `#@` (including bare `@file`) are byte-for-byte unchanged; `#@` works in both interactive and initial `-p` messages.
```

**Surgical edit (edit tool — oldText is unique because "Done-definition" appears once in PRD.md):**

```yaml
oldText: "**Done-definition:** all 24 manual test cases in §11 pass;"
newText: "**Done-definition:** all 32 manual test cases in §11 pass;"
```

Only `24` → `32` changes; the rest of the line (and the entire rest of the file) is untouched.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT PRD.md line 1189 — 'all 24' → 'all 32'
  - USE the edit tool with oldText: "**Done-definition:** all 24 manual test cases in §11 pass;"
            newText: "**Done-definition:** all 32 manual test cases in §11 pass;"
  - WHY this anchor: "Done-definition" appears EXACTLY ONCE in PRD.md (L1189), so the oldText is unique and
            cannot accidentally match L971 (which is "| 24 | top-level no fallback |").
  - DO NOT: grep-and-replace "24" globally (corrupts L971). DO NOT touch any other line.

Task 2: VERIFY — git diff scope + post-fix grep (item §4)
  - RUN: `git diff PRD.md`
    EXPECT: exactly ONE hunk on L1189, changing `24` → `32`. No other line touched.
  - RUN: `grep -nE '24.*test|24.*case|all 24' PRD.md`
    EXPECT: no output (the only remaining "24" is L971's "| 24 | top-level no fallback |", which does NOT
            match "24.*test" / "24.*case" / "all 24"). If anything prints, a stale count remains — investigate.
  - RUN: `grep -n "all 32 manual test cases" PRD.md`
    EXPECT: `1189:` (the fixed line).
  - OPTIONAL: `grep -cE '^\| [0-9]+ ' PRD.md` → `36` (4 import-source + 32 matrix) — confirms the matrix
            row count is unchanged (the fix is to the SUMMARY, not the matrix).
```

### Integration Points

```yaml
FILE_EDITS (PRD.md — exactly one token):
  - line 1189: "all 24 manual test cases" → "all 32 manual test cases"

NO_CHANGES:
  - line 971 ("| 24 | top-level no fallback |") — row index #24, NOT a count. UNCHANGED.
  - every other line of PRD.md — UNCHANGED.
  - README.md, file-injector.ts, *.test.mjs, package.json, all plan/ files — UNCHANGED.

NO_CODE / NO_TESTS / NO_NEW_FILES: documentation only. PRD.md is not loaded by any code or test.
```

## Validation Loop

### Level 1: Edit scope (git diff — the primary check)

```bash
cd /home/dustin/projects/pi-file-injector
git diff PRD.md
# Expected: exactly ONE hunk:
#   -**Done-definition:** all 24 manual test cases in §11 pass; ...
#   +**Done-definition:** all 32 manual test cases in §11 pass; ...
# If the diff touches ANY other line (esp. L971 "| 24 | top-level no fallback |"), the edit was too broad —
# re-scope to the exact "Done-definition:" anchor. The only acceptable diff is the single 24→32 substitution.
```

### Level 2: No stale count remains (item §4 verification)

```bash
cd /home/dustin/projects/pi-file-injector
grep -nE '24.*test|24.*case|all 24' PRD.md
# Expected: NO output. The only remaining "24" in PRD.md is L971's "| 24 | top-level no fallback |",
# which does not match this pattern (no "test"/"case" near it, and it's not "all 24").
#
# Confirm the fix landed:
grep -n "all 32 manual test cases" PRD.md
# Expected: 1189:**Done-definition:** all 32 manual test cases in §11 pass; ...
```

### Level 3: Source-of-truth consistency (the count now matches the matrix)

```bash
cd /home/dustin/projects/pi-file-injector
# The §11 manual test matrix is the source of truth. Confirm it has 32 rows (and the Done-definition now says 32):
echo "matrix rows:"; grep -cE '^\| [0-9]+ ' PRD.md   # → 36 (4 import-source L200-203 + 32 matrix L948-979)
echo "matrix row range:"; grep -nE '^\| [0-9]+ ' PRD.md | tail -1   # → L979 row #32
echo "done-definition count:"; grep -oE 'all [0-9]+ manual test cases' PRD.md   # → "all 32 manual test cases"
# All three must agree: matrix ends at #32; Done-definition says 32. ✓
```

### Level 4: No regression to code/tests (PRD.md isn't loaded — sanity)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# Expected: only " M PRD.md". No source/test file appears (this is a doc-only change).
# (Optional sanity — PRD.md is not imported by the harnesses, so the suites are unaffected. Not required,
#  but if you want belt-and-suspenders: `node ./file-injector.test.mjs` still prints "182 passed, 0 failed."
#  from P1.M1.T1.S1 — this subtask cannot have changed that.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `git diff PRD.md` shows exactly ONE change: `24` → `32` on line 1189; no other line touched.
- [ ] `git status --short` shows ONLY `M PRD.md` (no source/test file accidentally edited).
- [ ] `grep -nE '24.*test|24.*case|all 24' PRD.md` returns no stale-count matches.

### Feature Validation

- [ ] `PRD.md:1189` reads `**Done-definition:** all 32 manual test cases in §11 pass; ...`.
- [ ] The count (32) matches the §11 manual test matrix (32 rows #1–#32 at L948–979).
- [ ] `PRD.md:971` (`| 24 | top-level no fallback |`) is byte-for-byte UNCHANGED (row index #24, not a count).

### Code Quality Validation

- [ ] The edit used the unique "Done-definition:" anchor (NOT a global "24" replace).
- [ ] No requirement text, no §11 rows, no other PRD section modified (scoped exception only).
- [ ] No other file touched.

### Documentation

- [ ] This subtask IS the Mode B doc fix (item §5) — the PRD's own Done-definition is the summary doc that drifted.
- [ ] No README/JSDoc change (those are P1.M1.T2.S2 / P1.M1.T2.S3).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT grep-and-replace "24" globally.** There are two "24" lines; only L1189 is the count. L971 is
  row index #24. A global replace corrupts L971. Use the precise "Done-definition:" + "manual test cases" anchor.
- ❌ **Do NOT touch `PRD.md:971`.** That "24" is the row number of test case #24 ("top-level no fallback"),
  not a count. It must stay "24".
- ❌ **Do NOT edit anything beyond line 1189.** This is a one-token fix. No requirement text, no §11 rows,
  no other section. PRD.md is normally read-only; this is the one sanctioned exception — keep it surgical.
- ❌ **Do NOT "fix" the §11 matrix to 24 rows.** The matrix (32 rows) is the source of truth; the
  Done-definition (stale "24") is what drifted. The fix makes the summary match the matrix, not vice versa.
- ❌ **Do NOT run a test suite expecting it to validate the PRD.** PRD.md isn't loaded by code/tests.
  Validation is `git diff` scope + the post-fix grep. (Running the suite is optional belt-and-suspenders only.)
- ❌ **Do NOT generalize the PRD-edit sanction.** This subtask is the ONE allowed PRD edit in the v006 delta.
  Other doc-coherence subtasks (T2.S2 README, T2.S3 JSDoc) edit OTHER files, not PRD.md.
- ❌ **Do NOT touch any other file.** README.md (T2.S2), file-injector.ts JSDoc (T2.S3), test files (T1.S3),
  package.json — all untouched by T2.S1.

---

## Confidence Score: 10/10

A one-token documentation fix with every fact verified first-hand: the exact line (1189), the exact current
text, the unique edit-tool anchor ("Done-definition:" appears once), the explicit L971-vs-L1189
disambiguation (the only two "24" lines), the verified §11 row count (32, at L948–979, contiguous), the
grep-based post-fix verification, and the confirmed no-conflict with all sibling subtasks (T2.S1 is the only
PRD.md editor). The implementing agent makes one surgical edit and runs one grep. There is no code path, no
test, no build, and no ambiguity. PRD.md is not loaded by any code or test, so the change cannot break anything.
