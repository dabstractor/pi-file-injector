# PRP — P1.M1.T1.S1 (plan/007): Verify Done-definition reads '32' and §11 matrix has exactly 32 numbered rows

> **Scope flag:** This is a **read-only verification gate** — NO edits. The PRD's Done-definition test-count
> fix (one token: `24 → 32`) was already applied in commit `1ad7b19`. This subtask confirms it is correctly
> landed: (a) Done-definition reads "all **32** manual test cases", (b) the §11 Manual test matrix has exactly
> 32 sequential rows (#1–#32), (c) the two counts agree (32 == 32). **Scope = S1 ONLY.** No code, no tests,
> no other doc lines are touched here.

---

## Goal

**Feature Goal:** Confirm the PRD's Done-definition count is consistent with the §11 matrix row count — both
equal 32 — proving the v007 documentation consistency fix is correctly applied (not regressed).

**Deliverable:** A pass/fail confirmation. PASS = Done-definition contains "all 32 manual test cases" AND
§11 matrix has exactly 32 sequential numbered rows (#1–#32, no gaps) AND 32 == 32. No file edits (read-only).

**Success Definition:**
1. `grep -n "all 32 manual test cases" PRD.md` → exactly ONE hit (the Done-definition, ~L1189).
2. `grep -n "all 24 manual test cases" PRD.md` → ZERO hits (no stale "24").
3. The §11 "Manual test matrix" table has exactly **32** distinct sequential row numbers `1 2 3 … 32` (count 32, max 32, no gaps).
4. The two counts AGREE: 32 == 32 → **GATE PASS**.

## Why

- **Doc/code consistency.** The §11 matrix grew from 24 to 32 rows across sessions 003–006 (markdown imports,
  extension shorthand, bare-@). The Done-definition summary in Appendix A still said "all 24" — a stale
  self-contradiction in the PRD. Session 007 is the one-token fix (`24 → 32`) plus this verification.
- **The fix is documentation-only with zero code impact.** No function in `file-injector.ts` depends on the
  Done-definition count (confirmed by delta_analysis §"Risk"). So the gate is a pure read assertion, not a
  behavior test.
- **Closes the one known stale-doc nit from session 006.** Session-006's system_context flagged PRD.md:1189
  as the single stale test-count; this session fixes + verifies it.

## What

### The verification runbook (the whole subtask — read-only)

```bash
cd /home/dustin/projects/pi-file-injector

# (a) Done-definition reads "32" — expect exactly ONE hit at ~L1189:
grep -n "all 32 manual test cases" PRD.md

# (a-neg) Done-definition does NOT read "24" — expect ZERO output:
grep -n "all 24 manual test cases" PRD.md

# (b) §11 matrix: distinct sequential row numbers — expect "1 2 3 … 32" (no gaps):
awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md \
  | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo

# (b-count) §11 matrix row count — expect "32":
awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md \
  | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | wc -l

# (c) The two counts agree: 32 == 32 → PASS.
```

Record pass/fail. If all four assertions hold → **gate complete**. (Baseline is green, so this is the expected path.)

### Success Criteria

- [ ] `grep "all 32 manual test cases" PRD.md` → 1 hit (Done-definition, ~L1189).
- [ ] `grep "all 24 manual test cases" PRD.md` → 0 hits (no stale "24").
- [ ] §11 matrix distinct row numbers = `1 2 3 … 32` (sequential, no gaps).
- [ ] §11 matrix row COUNT = 32.
- [ ] 32 == 32 (Done-definition count == matrix row count) → PASS.
- [ ] No edits made to PRD.md or any file (read-only gate).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact grep/awk commands, the expected outputs (1 hit / 0 hits / `1…32` / count 32), the pass criterion
(32 == 32), and the git trail (commit 1ad7b19, clean tree). One read-only command sequence; no design risk.

### Baseline (CONFIRMED PASS during research — working tree clean)

```
(a)  PRD.md:1189 → "**Done-definition:** all 32 manual test cases in §11 pass; …"     ✓ (1 hit)
(a-neg) "all 24 manual test cases" → (no output)                                       ✓ (0 hits)
(b)  §11 matrix distinct rows → 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
                              21 22 23 24 25 26 27 28 29 30 31 32                      ✓ (32, max 32, no gaps)
(b-count) §11 matrix row count → 32                                                    ✓
(c)  32 == 32 → PASS                                                                   ✓
git:  PRD.md top commit = 1ad7b19 "Correct PRD Done-definition test count"; `git status --short PRD.md` empty (clean).
```

### Documentation & References

```yaml
# MUST READ — the verification trail + the "no code impact" risk assessment
- file: plan/007_3778406b61d6/architecture/delta_analysis.md
  why: "Documents this as a documentation-only consistency fix (no-op implementation), already applied in the
        working tree. Lists 6 CONFIRMED verification points (Done-definition=32, matrix=32 rows, no other stale
        24-as-count, commit 1ad7b19 exists, file-injector.ts needs zero changes, session-006 baseline was 24)."
  critical: "Item #3: the `| 24 |` at PRD.md L971 is a ROW INDEX (test case #24), NOT a count — it is correct and
             must NOT be touched. That broader stale-count scan is S2, not this subtask."

# The delta PRD (the source requirement)
- file: plan/007_3778406b61d6/delta_prd.md
  why: "States the delta is documentation-only, already applied (PRD.md:1189 reads 'all 32'), net delta = one
        token in one doc line, no implementation work required or possible."

# The "before" baseline (proves the fix actually changed something)
- file: plan/006_1862a6537500/prd_snapshot.md
  why: "Session-006 snapshot recorded PRD.md:1189 as 'all 24 manual test cases' — the pre-fix value. Confirms
        commit 1ad7b19 changed 24 → 32 (not a no-op rewrite)."

# The file under verification (READ-ONLY — do not edit)
- file: PRD.md
  why: "Appendix A Done-definition at L1189; §11 'Manual test matrix' table (rows #1–#32). The grep/awk
        commands above target exactly these two regions."
  gotcha: "The matrix is delimited by '### Manual test matrix' … '### Automated sanity check'. The awk range
           captures only the table; the row-number regex '^\| [0-9]+ \|' matches only data rows (skips the
           header separator). Count distinct numbers, sorted numerically, to detect gaps."
```

### Current Codebase tree

```bash
pi-file-injector/
├── PRD.md                    # ← the ONLY file inspected (read-only); Done-definition L1189 + §11 matrix
├── file-injector.ts          # untouched (no code impact — delta is doc-only)
├── *.test.mjs (×3)           # untouched
├── README.md / package.json  # untouched
└── plan/007_3778406b61d6/
    ├── architecture/delta_analysis.md   # ← the verification trail + risk assessment
    ├── delta_prd.md                     # ← the source requirement (doc-only, already applied)
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — READ-ONLY. PRD.md is human-owned (the system prompt forbids modifying it; item LOGIC says "make
#   no edits"). The fix is already applied (commit 1ad7b19, clean tree). This gate only ASSERTS it landed.

# CRITICAL — do NOT confuse the §11 ROW INDEX "| 24 |" (PRD.md L971, test case #24) with a COUNT. It is a row
#   number, correct as-is. The ONLY stale "24"-as-COUNT was the Done-definition at L1189 (now "32"). The
#   broader scan for any other stale counts is S2, NOT this subtask.

# GOTCHA — the matrix-table awk range is '### Manual test matrix' … '### Automated sanity check'. If the PRD
#   re-uses the word "matrix" elsewhere, anchor on these EXACT heading lines so the range stays the table only.

# GOTCHA — count DISTINCT row numbers (sort -n -u), not raw data-row lines. A malformed table (e.g. a wrapped
#   row) could inflate the raw line count; the distinct-number check detects both gaps AND duplicates.

# GOTCHA — if the counts DISAGREE (a regression), do NOT silently edit PRD.md (human-owned). HALT and report:
#   the fix landed in commit 1ad7b19, so a disagreement is a genuine regression needing human review. The
#   precise fix (IF the orchestrator authorizes it) is the one-token edit `24 → 32` at PRD.md:1189.
```

## Implementation Blueprint

> There is no implementation. This is the **verification runbook**. (Adapted from the implementation template
> since this subtask produces no code and edits no files.)

### Verification Tasks (ordered)

```yaml
Task 1: ASSERT Done-definition reads "32"
  - CMD: grep -n "all 32 manual test cases" PRD.md
  - EXPECT: exactly ONE hit at ~L1189 (the "**Done-definition:** all 32 manual test cases in §11 pass; …" line).
  - FAIL if: zero hits (regression — "24" returned) OR more than one hit (ambiguous).

Task 2: ASSERT no stale "24"-as-count in the Done-definition
  - CMD: grep -n "all 24 manual test cases" PRD.md
  - EXPECT: ZERO output (no stale count).
  - FAIL if: any hit (the old "24" is still present).

Task 3: COUNT §11 matrix numbered rows
  - CMD: awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
  - EXPECT: "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 " (sequential, no gaps).
  - CMD (count): … | wc -l  → EXPECT "32".
  - FAIL if: count != 32, OR max != 32, OR any gap in the sequence (e.g. missing #17, or a duplicate).

Task 4: CONFIRM the two counts AGREE → 32 == 32 → GATE PASS.
  - If Tasks 1–3 all hold → record PASS, gate complete.
  - If ANY task fails → HALT and report (do NOT edit PRD.md; see Anti-Patterns). The fix landed in commit
    1ad7b19; a failure means a genuine regression requiring human review.
```

### Integration Points

```yaml
NO CHANGES (read-only verification gate): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited. PRD.md is inspected only.
```

## Validation Loop

### Level 1: The four assertions (the entire gate)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[a]  Done-definition reads 32:";     grep -c "all 32 manual test cases" PRD.md        # expect 1
echo "[a-] stale 24 absent:";              grep -c "all 24 manual test cases" PRD.md        # expect 0
echo "[b]  matrix row numbers:";           awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
echo "[b-count]";                          awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | wc -l   # expect 32
```

### Level 2: Disagreement diagnosis (ONLY if a task fails — NOT expected)

```bash
# If [a] is 0: the Done-definition regressed to "24" (or was reworded). Show the actual line:
grep -n "Done-definition" PRD.md
# If [b-count] != 32 or there's a gap: the matrix itself was edited. Show the row numbers:
awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n
# Decision: HALT and report. The fix is doc-only (commit 1ad7b19); a regression here is human-review
# territory. Do NOT widen scope by editing code/tests.
```

### Level 3: Zero-code-impact spot-check (optional — confirms the doc fix touched nothing else)

```bash
# The fix was doc-only; confirm file-injector.ts + tests are untouched vs the fix commit:
git show --stat 1ad7b19 -- PRD.md file-injector.ts README.md package.json 2>/dev/null | tail -8
# Expect: only PRD.md changed in 1ad7b19 (one line). No file-injector.ts / test / README churn.
```

### Level 4: N/A (no creative/domain validation for a doc-count check)

```bash
# (No performance, security, load, or MCP validation applies to a one-token doc-count assertion.)
```

## Final Validation Checklist

### Technical Validation

- [ ] Task 1: `grep -c "all 32 manual test cases" PRD.md` → 1.
- [ ] Task 2: `grep -c "all 24 manual test cases" PRD.md` → 0.
- [ ] Task 3: §11 matrix distinct rows = `1…32` (sequential, no gaps); count = 32.
- [ ] Task 4: 32 == 32 → PASS.

### Gate Integrity (the contract)

- [ ] No edits made to PRD.md or any file (read-only gate).
- [ ] No edits to file-injector.ts / tests / README.md / package.json (zero code impact).
- [ ] If a task failed: HALT-and-report (no unilateral PRD.md edit; human-owned).

### Scope Discipline

- [ ] Broader stale-"24"-as-count scan across all of PRD.md (incl. L971 `| 24 |` row index) NOT done here (S2).
- [ ] typecheck + three test suites via validate.sh NOT done here (T2.S1).
- [ ] README.md stale-reference scan NOT done here (T3.S1).
- [ ] PRD.md internal-consistency re-verify NOT done here (T3.S2).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit PRD.md (or any file).** This is a read-only assertion gate; PRD.md is human-owned. The fix
  is already applied (commit 1ad7b19, clean tree). The gate only ASSERTS it landed.
- ❌ **Do NOT confuse the `| 24 |` row index (PRD.md L971, test case #24) with a stale count.** It is a row
  number, correct as-is. The only stale "24"-as-COUNT was the Done-definition (now "32"). Scanning for other
  stale counts is S2, not S1.
- ❌ **Do NOT silently "fix" a disagreement by editing PRD.md.** If the counts disagree, HALT and report — the
  fix landed in commit 1ad7b19, so a disagreement is a genuine regression needing human review (the system
  prompt forbids modifying PRD.md). The precise authorized fix, if needed, is `24 → 32` at L1189 only.
- ❌ **Do NOT widen scope.** No code, no tests, no other doc lines, no typecheck, no test-suite run here
  (those are S2 / T2.S1 / T3.* subtasks). S1 is the two-count agreement check ONLY.
- ❌ **Do NOT count raw table lines instead of distinct row numbers.** A wrapped/malformed row could inflate
  the raw count. Use `sort -n -u` on the distinct row numbers to detect gaps AND duplicates.
- ❌ **Do NOT anchor the awk range on a loose word like "matrix".** Use the EXACT headings
  `### Manual test matrix` … `### Automated sanity check` so the range captures only the table.

---

## Confidence Score: 10/10

A deterministic read-only assertion gate, and the baseline is **already verified PASS** during research
(Done-definition = "all 32 manual test cases" at L1189; §11 matrix = exactly 32 sequential rows #1–#32; 32 == 32;
PRD.md clean at commit 1ad7b19). The executing agent runs four grep/awk commands, confirms the expected outputs,
and is done — no edits, no design risk, no code impact. The only residual is the (unexpected) disagreement
branch, which the HALT-and-report protocol resolves safely (PRD.md is human-owned).
