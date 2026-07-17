# Research Notes — P1.M1.T1.S2 (plan/007): Scan PRD.md for any other stale test-count references

> First-hand read of: the S1 PRP (parallel sibling — read-only Done-definition/matrix agreement gate;
> explicitly defers the broader stale-"24" scan to S2), `architecture/delta_analysis.md` (§Verification
> item 3), and a LIVE grep of PRD.md. **Result: CLEAN — exactly ONE "24" in all of PRD.md, and it is the
> §11 row index (test case #24), NOT a count.**

---

## 1. Starting state + the relationship to S1

The v007 delta is a **documentation-only consistency fix**: the PRD Appendix-A Done-definition previously
said "all **24** manual test cases" but the §11 matrix grew to 32 rows across sessions 003–006. A human
applied the one-token fix `24 → 32` in commit `1ad7b19` (PRD.md:1189 now reads "all **32** manual test cases").

- **S1 (parallel)** is a READ-ONLY gate: it confirms (a) Done-definition reads "32", (b) no "all 24 manual
  test cases" remains, (c) §11 matrix has exactly 32 sequential rows, (d) 32 == 32. S1 explicitly states
  "READ-ONLY. PRD.md is human-owned" and defers the broader scan to S2: "Broader stale-24-as-count scan
  across all of PRD.md (incl. L971 `| 24 |` row index) NOT done here (S2)."
- **S2 (THIS task)** is that broader scan: search ALL of PRD.md for every "24" and classify each as
  (a) stale test-COUNT (→ should be 32) or (b) row index / unrelated number (correct → leave alone).

S1 and S2 are independent read-only sibling gates. S2 consumes nothing from S1's output; both confirm
different facets of the same doc-consistency fix.

---

## 2. The scan result (CONFIRMED CLEAN during research — working tree unmodified)

```bash
$ grep -nE "24" PRD.md            # every "24" substring in PRD.md
971:| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
$ grep -cE "24" PRD.md            # count
1
```

**Exactly ONE "24"** in all of PRD.md. Classification:

| Line | Occurrence | Context | Classification | Action |
|---|---|---|---|---|
| 971 | `\| 24 \|` | §11 "Manual test matrix" — the row label for test case **#24 "top-level no fallback"** | **ROW INDEX (table cell), NOT a count** | **LEAVE ALONE** ✓ |

The row sits in a matrix that (per S1 + verified below) has exactly 32 sequential rows #1–#32. Row #24 is
just one of the 32; its presence is correct and expected — it is a row LABEL, not a count of anything.

**No stale test-COUNT reference exists.** The only stale "24"-as-count (the Done-definition at L1189) was
fixed by a human in commit 1ad7b19 (now reads "all 32 manual test cases"). The broader count-word adjacency
check is also clean:

```bash
$ grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md
(no output — clean)
```

∴ **GATE PASS: zero stale test-count references in PRD.md.**

---

## 3. Why "24" as a substring search is sufficient (and bulletproof)

The item says "Search PRD.md for all occurrences of the string '24'." `grep -E "24"` matches "24" as a
SUBSTRING anywhere — so it would also catch "124", "2024", "24px", "v0.80.24", section "§24", etc. The
result is **count = 1** (only the row index). This proves there are NO other "24" substrings anywhere in
PRD.md — no dates, no version strings, no other numbers containing "24". The single hit is unambiguously
the §11 row index. (Cross-checked with the count-word adjacency grep, also clean.)

---

## 4. Surrounding context of the single hit (proves it is a row label)

PRD.md L968–973 (the §11 matrix around the hit):
```
| 21 | md ext-shorthand   | …
| 22 | md ext exact-wins  | …
| 23 | md ext `.markdown` | …
| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
| 25 | bare-`@` off (default) | …
| 26 | bare-`@` on        | …
```
Row #24 is the "top-level no fallback" test case (PRD §11 case 24) — sandwiched between #23 and #25. It is a
row number in a 32-row table, not a count. The table's distinct row numbers are `1 2 3 … 32` (count 32, no
gaps — verified), so #24 being present is correct and mandatory (S1 asserts the matrix has all 32 rows).

---

## 5. The forbidden/ownership resolution (PRD.md is human-owned)

- The system-prompt FORBIDDEN OPERATIONS (directed at the PRP-research agent) and S1's stance both treat
  PRD.md as **read-only / human-owned**.
- The item §4 says "If any stale count is found, fix it to 32. If none found (expected), report clean."
- **The verified outcome is "none found"** → NO PRD.md edit is needed. S2 is a READ-ONLY scan + classify +
  report gate.
- **Contingency (does not fire):** if a stale count were UNEXPECTEDLY found, the safe action — matching S1's
  "do NOT silently fix a disagreement by editing PRD.md; HALT and report" — is to HALT and report the exact
  stale line + the proposed `→ 32` fix for HUMAN authorization (the Done-definition fix was a human commit,
  1ad7b19; a stale count elsewhere would warrant the same human-applied pattern). The implementing agent
  does NOT unilaterally edit PRD.md. (This honors the item's intent — the correct count is 32 — while
  respecting PRD.md ownership. It is moot anyway: the scan is clean.)

---

## 6. Scope discipline (what S2 does NOT do)

- Does NOT verify the Done-definition text or re-count the matrix (S1's gate — already confirmed: 32 / 32).
- Does NOT run typecheck or the three test suites (T2.S1's gate).
- Does NOT scan README.md for stale references (T3.S1).
- Does NOT re-verify PRD internal consistency broadly (T3.S2).
- Does NOT edit PRD.md or any file (read-only; the scan is clean, so no fix is needed).

---

## 7. Confidence: 10/10

A deterministic read-only scan gate, and the baseline is **already verified CLEAN** during research: exactly
one "24" in all of PRD.md (the §11 row index #24, a table label, not a count); the count-word adjacency check
is also clean; delta_analysis §Verification item 3 independently confirms the same classification. The
executing agent runs two grep commands, confirms the single hit is the row index, and reports CLEAN — no edits,
no design risk, no code impact. The only residual is the (unexpected) stale-count branch, which the
HALT-and-report protocol resolves safely (PRD.md is human-owned, and the scan proves it won't fire).
