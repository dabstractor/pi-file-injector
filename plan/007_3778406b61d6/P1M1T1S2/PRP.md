---
name: "P1.M1.T1.S2 (plan/007) — Scan PRD.md for any other stale test-count references"
prd_ref: "v007 delta PRD §'Documentation-only consistency fix'; architecture/delta_analysis.md §Verification item 3 (only legitimate '24' is the §11 row index); PRD §11 'Manual test matrix' (row #24 'top-level no fallback')"
target_file: "PRD.md"   # READ-ONLY scan target — NO edits (the scan is clean; PRD.md is human-owned)
target_language: Markdown (gate = grep substring search + classification; zero code/test impact)
depends_on: "NONE for execution (S2 is an independent read-only gate). Sibling P1.M1.T1.S1 (Done-definition=32 + matrix=32 agreement) runs in parallel; S1 explicitly defers the broader stale-'24' scan to S2. Neither consumes the other's output."
consumed_by: "P1.M1.T3.S2 (PRD internal-consistency re-verify — may cite S2's clean scan as an anchor)"
---

# PRP — P1.M1.T1.S2: Scan PRD.md for any other stale test-count references

> **Scope flag:** This is a **read-only scan + classification gate**, NOT an edit. The v007 delta fixed the
> one known stale count (PRD.md:1189 Done-definition `24 → 32`, human commit `1ad7b19`). S1 (parallel) confirms
> the Done-definition now reads "32" and the §11 matrix has exactly 32 rows. **S2's job is the BROADER scan:**
> find EVERY "24" in PRD.md and prove NONE of them is a stale test-count reference. The verified finding:
> exactly ONE "24" survives — the §11 row index `| 24 |` (test case #24), a table label, NOT a count. ∴ GATE
> PASS: zero stale test-count references. **No file is edited.**

---

## Goal

**Feature Goal:** Confirm that NO stale test-count reference (a "24" that should be "32") survives anywhere in
PRD.md after the Done-definition fix — by searching for every "24" and classifying each as either a stale
test-COUNT (→ should be 32) or a row index / unrelated number (→ correct, leave alone).

**Deliverable:** A pass/fail scan result listing every "24" occurrence with its line number + classification.
PASS = zero stale test-count references (the verified expectation). No file edits (read-only; the scan is clean).

**Success Definition:**
1. `grep -nE "24" PRD.md` → every occurrence enumerated and classified.
2. The ONLY "24" is the §11 row index `| 24 |` at ~L971 (test case #24 "top-level no fallback") — a table row
   label, NOT a count → classified CORRECT → leave alone.
3. The count-word adjacency check `grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md` → ZERO output.
4. ∴ **GATE PASS: zero stale test-count references in PRD.md.** No edit made.

## Why

- **Closes the doc-consistency loop.** The v007 delta is a documentation-only consistency fix: the §11 matrix
  grew from 24 to 32 rows (sessions 003–006: markdown imports, extension shorthand, bare-@), but the
  Appendix-A Done-definition still said "all 24". The one-token fix (`24 → 32`, commit 1ad7b19) landed. S1
  verifies the Done-definition + matrix agree (32 == 32). S2 verifies no OTHER "24"-as-count lingers anywhere
  else in the PRD — so the doc is internally consistent top-to-bottom, not just at the one known line.
- **Defense against a subtle stale-count.** A "24" could in principle appear elsewhere (a stray "the 24 test
  cases", a summary line, a rationale paragraph) that the Done-definition fix didn't touch. This scan is the
  exhaustive proof none exists.
- **Zero code impact.** This is a doc-text scan; `file-injector.ts`, the tests, README, package.json are all
  untouched. No function depends on the Done-definition count (delta_analysis §"Risk").

## What

### The scan runbook (the whole subtask — read-only)

```bash
cd /home/dustin/projects/pi-file-injector

# (1) EVERY "24" substring in PRD.md — enumerate with line numbers:
grep -nE "24" PRD.md

# (2) Count of "24" occurrences — expect 1:
grep -cE "24" PRD.md

# (3) Broader count-word adjacency check — "24" near test/case/manual/pass, or "all 24" — expect ZERO output:
grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md
```

Classify each "24" from (1) as ROW-INDEX/UNRELATED (correct → leave) or STALE-COUNT (→ should be 32). Assert
the count-word adjacency check (3) is empty. Record the result.

### Success Criteria

- [ ] `grep -nE "24" PRD.md` lists every occurrence with a line number + classification in the report.
- [ ] The ONLY "24" is `| 24 |` at ~L971 (§11 row index, test case #24) — classified ROW-INDEX (NOT a count).
- [ ] `grep -cE "24" PRD.md` → 1 (no other "24" substring anywhere — no dates, versions, other numbers).
- [ ] `grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md` → ZERO output (no count-word adjacency).
- [ ] ∴ **GATE PASS: zero stale test-count references.**
- [ ] No edit made to PRD.md or any file (read-only gate; the scan is clean).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact grep commands, the expected outputs (1 hit / count 1 / empty adjacency), the classification rule
(row-index vs stale-count), the surrounding context of the single hit (proving it is a table label), and the
read-only/HALT-and-report discipline. The baseline is already verified CLEAN during research.

### Baseline (CONFIRMED CLEAN during research — working tree unmodified)

```
(1) grep -nE "24" PRD.md →
      971:| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
(2) grep -cE "24" PRD.md → 1
(3) grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md → (no output)
classification: the single hit is the §11 ROW INDEX (test case #24), NOT a count → CORRECT, LEAVE ALONE.
git: PRD.md last commit = 1ad7b19 "Correct PRD Done-definition test count" (the human fix); clean tree.
Done-definition (L1189): "all 32 manual test cases" (correctly fixed). §11 matrix: exactly 32 rows #1–#32.
```

### Documentation & References

```yaml
# MUST READ — the verification trail + the row-index classification (item §1 cites this)
- file: plan/007_3778406b61d6/architecture/delta_analysis.md
  why: "§Verification item 3 CONFIRMS: 'No other stale \"24\"-as-test-count exists in PRD.md — CONFIRMED.
        (The `| 24 |` at line 971 is a row index, not a count — correct, must not be touched.)' Item #1–2
        confirm Done-definition=32 and matrix=32 rows (S1's facet). Item #5 confirms file-injector.ts needs
        zero changes (zero code impact)."
  critical: "The `| 24 |` at L971 is a ROW INDEX. Touching it would corrupt the §11 matrix (S1 asserts all 32
             rows present). S2's job is to prove NOTHING ELSE is a stale count — and the scan confirms exactly that."

# MUST READ — the sibling gate + the read-only/HALT-and-report discipline
- file: plan/007_3778406b61d6/P1M1T1S1/PRP.md
  why: "S1 is the read-only Done-definition=32 + matrix=32 agreement gate. It explicitly defers the broader
        stale-'24' scan to S2: 'Broader stale-24-as-count scan across all of PRD.md (incl. L971 `| 24 |` row
        index) NOT done here (S2).' It also sets the discipline: 'do NOT silently fix a disagreement by
        editing PRD.md; HALT and report' (PRD.md is human-owned)."
  critical: "Scope discipline: S2 scans for stale '24' references ONLY. Do NOT re-verify the Done-definition
             text or re-count the matrix (S1's gate). Do NOT run typecheck/tests (T2.S1). Do NOT scan README
             (T3.S1). Do NOT edit PRD.md (read-only; scan is clean)."

# The source requirement (doc-only, already applied)
- file: plan/007_3778406b61d6/delta_prd.md
  why: "States the delta is documentation-only, already applied (PRD.md:1189 reads 'all 32'), net delta = one
        token in one doc line, no implementation work required or possible. S2 is the exhaustive confirmation
        that the one-token fix was the ONLY stale count."

# The file under scan (READ-ONLY — do not edit)
- file: PRD.md
  why: "The scan target. §11 'Manual test matrix' rows #1–#32 (row #24 'top-level no fallback' at ~L971);
        Appendix-A Done-definition at L1189 (reads 'all 32'). The grep commands target the whole file."
  gotcha: "`grep -E \"24\"` is a SUBSTRING search — it would also catch '124', '2024', '24px', version strings,
           section refs. The result is count=1 (only the row index), proving NO other '24' substring exists
           anywhere. The count-word adjacency grep is the cross-check for count-like phrasings."

# The "before" baseline (proves the Done-definition fix changed something — S1's concern, cited for context)
- file: plan/006_1862a6537500/prd_snapshot.md
  why: "Session-006 snapshot recorded PRD.md:1189 as 'all 24 manual test cases' — the pre-fix value. Confirms
        the ONE known stale count was the Done-definition (now fixed). S2 proves it was the ONLY one."
```

### Current Codebase tree

```bash
pi-file-injector/
├── PRD.md                    # ← the ONLY file scanned (read-only); single "24" = §11 row index #24 at ~L971
├── file-injector.ts          # untouched (zero code impact)
├── *.test.mjs (×3)           # untouched
├── README.md / package.json  # untouched
└── plan/007_3778406b61d6/
    ├── architecture/delta_analysis.md   # ← §Verification item 3 (the row-index classification)
    ├── delta_prd.md                     # ← the source requirement (doc-only, already applied)
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (Done-definition=32 + matrix=32)
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
(none — read-only scan gate)
# ONLY if a stale count were UNEXPECTEDLY found: HALT-and-report the exact line + proposed "→ 32" fix for
# HUMAN authorization (do NOT unilaterally edit PRD.md — human-owned). The verified scan is CLEAN, so this
# branch does not fire.
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — READ-ONLY. PRD.md is human-owned (the system prompt forbids modifying it; S1 sets the same
#   discipline). The Done-definition fix was a HUMAN commit (1ad7b19). S2 only SCANS + CLASSIFIES + REPORTS.
#   The verified scan is CLEAN → no edit is needed. If a stale count were unexpectedly found, HALT-and-report
#   (do NOT unilaterally edit PRD.md).

# CRITICAL — do NOT confuse the §11 ROW INDEX "| 24 |" (PRD.md ~L971, test case #24 "top-level no fallback")
#   with a COUNT. It is a row label in a 32-row table. It is CORRECT and must NOT be touched. Touching it
#   would corrupt the matrix (S1 asserts all 32 rows #1–#32 are present). This is the ONLY "24" in PRD.md.

# CRITICAL — `grep -E "24"` is a SUBSTRING search. It catches "124", "2024", "24px", version/section strings.
#   The result is count=1 (only the row index) → this PROVES no other "24" substring exists anywhere in PRD.md
#   (no dates, no versions, no other numbers). The single hit is unambiguously the row index.

# GOTCHA — the count-word adjacency check (`grep -niE "24.{0,30}(test|case|manual|pass)|all 24"`) is the
#   cross-check for count-like phrasings ("24 test cases", "the 24 manual cases", "all 24"). It returns ZERO
#   output (clean). A non-empty result there would be a stale count → HALT-and-report.

# GOTCHA — the broader scan is the WHOLE file, not just the matrix or the Done-definition. A stale count
#   could in principle hide in a rationale paragraph, a summary, or §13. The substring grep covers all of it.

# LIBRARY — plain grep on a Markdown file. No tooling, no build, no test framework. The gate is two grep
#   commands + a human classification of each hit.
```

## Implementation Blueprint

> There is no implementation. This is the **scan + classification runbook**. (Adapted from the implementation
> template since this subtask produces no code and edits no files.)

### Classification table (the deliverable's core)

| "24" occurrence | Line | Context | Classification | Action |
|---|---|---|---|---|
| `\| 24 \|` | ~L971 | §11 "Manual test matrix" — row label for test case **#24 "top-level no fallback"** (`#@PRD` at top level → verbatim) | **ROW INDEX (table cell), NOT a count** | **LEAVE ALONE** ✓ |

(Only one row — there is exactly one "24" in PRD.md. If the scan found more, each would get its own row here.)

### Verification Tasks (ordered)

```yaml
Task 1: ENUMERATE every "24" in PRD.md
  - CMD: grep -nE "24" PRD.md
  - EXPECT: exactly ONE line → "971:| 24 | top-level no fallback | …" (the §11 row index).
  - CMD (count): grep -cE "24" PRD.md  → EXPECT "1".
  - FAIL (unexpected) if: more than one line, OR a line that reads as a count (e.g. "24 test cases", "all 24").

Task 2: CLASSIFY each hit
  - The single hit "| 24 |" at ~L971 is the §11 ROW INDEX (test case #24), NOT a count → CORRECT → LEAVE ALONE.
  - (Cross-check: it sits between row #23 and row #25 in a 32-row matrix; S1 confirms all 32 rows present.)

Task 3: COUNT-WORD ADJACENCY check (cross-check for count-like phrasings)
  - CMD: grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md
  - EXPECT: ZERO output (no "24" near test/case/manual/pass, no "all 24").
  - FAIL (unexpected) if: any output → that would be a stale count → HALT-and-report.

Task 4: RECORD the result → GATE PASS (zero stale test-count references)
  - If Tasks 1–3 all hold → record CLEAN / PASS. No edit made. Gate complete.
  - If ANY task surfaces a stale count (NOT expected per baseline) → HALT-and-report (do NOT edit PRD.md; see
    Anti-Patterns). Report the exact line + the proposed "→ 32" fix for HUMAN authorization.
```

### Failure-Diagnosis Protocol (ONLY if a stale count is found — NOT expected per baseline)

```text
1. SHOW the offending line: grep -n "<the stale 24 phrasing>" PRD.md
2. CONFIRM it is a COUNT (not a row index / version / date / unrelated number):
   - ROW INDEX: "| <N> |" table cell → NOT a count (like the L971 hit). Leave alone.
   - COUNT: "24 test cases", "all 24", "the 24 manual cases", "24 cases pass" → STALE.
3. HALT and REPORT: the exact line + the proposed one-token fix ("→ 32") for HUMAN authorization.
   Do NOT unilaterally edit PRD.md (human-owned; the Done-definition fix was human commit 1ad7b19; a stale
   count elsewhere warrants the same human-applied pattern). The implementing agent does not edit PRD.md.
4. (Moot in practice: the verified scan is CLEAN — no stale count exists.)
```

### Integration Points

```yaml
NO CHANGES (read-only scan gate): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited. PRD.md is scanned only.
```

## Validation Loop

### Level 1: The scan (the entire gate)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] every '24':";      grep -nE "24" PRD.md                                    # expect the single L971 row index
echo "[2] count:";           grep -cE "24" PRD.md                                     # expect 1
echo "[3] count-word adj:";  grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md   # expect (no output)
# Classify the [1] hit as ROW-INDEX (not a count) → GATE PASS (zero stale test-count references).
```

### Level 2: Context check — prove the single hit is a row label (not a count)

```bash
# Show the matrix rows around the hit — it is sandwiched between #23 and #25 in the 32-row table:
sed -n '968,974p' PRD.md
# Expect: rows | 21 | … | 22 | … | 23 | … | 24 | top-level no fallback | … | 25 | … | 26 | …  (a row index).
# Cross-check the matrix has all 32 rows (S1's facet, cited for context):
awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo   # expect 1 2 … 32
```

### Level 3: Substring-search sanity (proves no other "24" hides anywhere)

```bash
# `grep -E "24"` is a substring search — it would catch "124", "2024", "24px", version/section strings.
# Count=1 proves NO other "24" substring exists anywhere in PRD.md:
grep -cE "24" PRD.md   # expect 1
# (If this were >1, each additional hit would need classification — but the verified result is exactly 1.)
```

### Level 4: N/A (no creative/domain validation for a doc-text scan)

```bash
# (No performance, security, load, or MCP validation applies to a Markdown substring scan.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `grep -nE "24" PRD.md` → exactly ONE hit: `| 24 |` at ~L971 (the §11 row index).
- [ ] `grep -cE "24" PRD.md` → 1 (no other "24" substring anywhere).
- [ ] `grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md` → ZERO output.
- [ ] The single hit classified ROW-INDEX (test case #24), NOT a count → CORRECT → leave alone.

### Gate Integrity (the contract)

- [ ] No edit made to PRD.md or any file (read-only gate; scan is clean).
- [ ] No edits to file-injector.ts / tests / README.md / package.json (zero code impact).
- [ ] If a stale count were found: HALT-and-report (no unilateral PRD.md edit; human-owned). [Does not fire.]

### Scope Discipline

- [ ] Done-definition text + matrix row-count NOT re-verified here (S1's gate — Done-definition=32, matrix=32).
- [ ] typecheck + three test suites NOT run here (T2.S1).
- [ ] README.md stale-reference scan NOT done here (T3.S1).
- [ ] PRD internal-consistency broad re-verify NOT done here (T3.S2).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit PRD.md (or any file).** This is a read-only scan gate; PRD.md is human-owned (the system
  prompt forbids modifying it; S1 sets the same discipline). The Done-definition fix was a human commit
  (1ad7b19); S2 only SCANS + CLASSIFIES + REPORTS. The verified scan is CLEAN → no edit is needed.
- ❌ **Do NOT confuse the `| 24 |` row index (PRD.md ~L971, test case #24) with a stale count.** It is a row
  label in a 32-row table — CORRECT, must NOT be touched (touching it corrupts the matrix; S1 asserts all 32
  rows present). It is the ONLY "24" in PRD.md.
- ❌ **Do NOT silently "fix" a stale count by editing PRD.md.** If (unexpectedly) a stale count IS found, HALT
  and report the exact line + proposed "→ 32" fix for HUMAN authorization. The implementing agent does not
  unilaterally edit PRD.md. (Moot: the verified scan is clean.)
- ❌ **Do NOT use a narrow grep that misses count-like phrasings.** Run BOTH the substring grep
  (`grep -E "24"`) AND the count-word adjacency grep (`24.{0,30}(test|case|manual|pass)|all 24`). The substring
  grep proves no "24" substring exists at all; the adjacency grep cross-checks count phrasings specifically.
- ❌ **Do NOT widen scope.** No Done-definition/matrix re-verification (S1), no typecheck/tests (T2.S1), no
  README scan (T3.S1), no PRD broad re-verify (T3.S2). S2 is the stale-"24"-as-count scan ONLY.
- ❌ **Do NOT treat the substring search as insufficient.** `grep -E "24"` matches "24" anywhere (catches
  "124"/"2024"/"24px" too). Count=1 is the exhaustive proof no other "24" substring exists — stronger than a
  word-boundary search, not weaker.
- ❌ **Do NOT report the row index as a "stale count found."** The row index #24 is correct and mandatory
  (the matrix has 32 rows; #24 is one of them). Reporting it as stale would be a false positive that wastes a
  human review cycle.

---

## Confidence Score: 10/10

A deterministic read-only scan gate, and the baseline is **already verified CLEAN** during research: exactly
ONE "24" in all of PRD.md — the §11 row index `| 24 |` at ~L971 (test case #24 "top-level no fallback", a
table row label, NOT a count); the count-word adjacency check is empty; `grep -cE "24"` = 1 proves no other
"24" substring exists anywhere; delta_analysis §Verification item 3 independently confirms the same
classification. The executing agent runs two grep commands, classifies the single hit as a row index, and
reports CLEAN — no edits, no design risk, no code impact. The only residual is the (unexpected) stale-count
branch, which the HALT-and-report protocol resolves safely (PRD.md is human-owned, and the scan proves it
won't fire).
