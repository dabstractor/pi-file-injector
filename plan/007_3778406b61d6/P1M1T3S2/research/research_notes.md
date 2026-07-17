# Research Notes — P1.M1.T3.S2 (plan/007): Verify PRD.md internal consistency (Done-definition matches matrix, no stale counts)

## Mission

This is the **FINAL coherence gate** of the v007 delta — a **read-only, changeset-level documentation
integration gate** (Mode B). It runs LAST (after T3.S1 the README sweep, and transitively after T1.S1,
T1.S2, T2.S1) to confirm the **whole PRD.md is internally coherent** after the single-token fix
(`24 → 32` at PRD.md:1189, human commit `1ad7b19`, zero code changes). Its pass **completes the delta**
(item §5 DOCS / §4 OUTPUT).

The item's three facets (LOGIC §3):
- **(a)** Done-definition count (32) == §11 matrix row count (32) == §11 Automated sanity check expectations
      (file-injector.test.mjs covers "the full §11 matrix + §10 edges") — a **three-way agreement** that
      there are 32 manual test cases.
- **(b)** the "32 manual test cases" phrasing is internally consistent throughout PRD.md.
- **(c)** no remaining "24"-as-count anywhere.

> **Read-only / human-owned.** PRD.md is human-owned (system prompt forbids modifying it; the fix was a
> human commit `1ad7b19`). T3.S2 only ASSERTS coherence and reports a final pass/fail. NO edit is expected
> or permitted (the verified baseline is coherent). A failure is a regression → HALT and report.

## ⭐ Baseline CONFIRMED COHERENT (verified this research session, first-hand, working tree clean)

### Facet (a) — three-way agreement (32 == 32 == Automated sanity check expectations)

**(a.1) Done-definition count = 32** ✓
```bash
$ grep -c "all 32 manual test cases" PRD.md     # → 1
1
$ grep -c "all 24 manual test cases" PRD.md     # → 0 (no stale count)
0
```
PRD.md:1189 reads: `**Done-definition:** all 32 manual test cases in §11 pass; …`

**(a.2) §11 matrix row count = 32** (sequential #1–#32, no gaps) ✓
```bash
$ awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md \
    | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32
$ ... | wc -l     # → 32
32
```

**(a.3) §11 Automated sanity check expectations are consistent with 32** ✓ — the NEW unique check for T3.S2
The §11 Automated sanity check section (PRD.md:981–1003) describes the two standalone Node test scripts:
- **`file-injector.test.mjs`** (PRD.md:985) — "the full §11 matrix + §10 edges". This references "the full
  §11 matrix" = the **32-row** manual matrix. It does NOT cite a conflicting count (no "24 cases", no "the
  24-row matrix"). The phrase "the full §11 matrix" is the same 32-row matrix the Done-definition summarizes.
- **`relative-imports.test.mjs`** (PRD.md:986) — references "cases 30–32 above". Rows 30, 31, 32 **all
  exist** in the 32-row matrix (the last three rows). No out-of-range reference (e.g. no "cases 30–40").

∴ The Automated sanity check prose agrees there are 32 manual test cases. **32 (Done-def) == 32 (matrix
rows) == "the full §11 matrix" / "cases 30–32" references (Automated sanity check).** Three-way agreement ✓.

> **Nuance (do NOT misread):** file-injector.test.mjs has **122 automated** test cases (it covers the 32
> manual matrix rows + §10 edges + unit tests). The "32" is the MANUAL matrix; the "122" is the automated
> suite. They are different things by design and are NOT required to be equal. Facet (a.3) only checks the
> Automated sanity check PROSE does not introduce a *conflicting* count — and it does not. (T2.S1 confirmed
> the 122/38/22 = 182 automated cases all pass; that is the code half, separate from this doc gate.)

### Facet (b) — "32 manual test cases" phrasing consistency

```bash
$ grep -nE "manual test cases" PRD.md     # → exactly ONE hit
1189:**Done-definition:** all 32 manual test cases in §11 pass; …
```
The phrase "manual test cases" appears **exactly once** in all of PRD.md — the Done-definition — and it
reads "all **32** manual test cases". No other occurrence can contradict it. ✓

```bash
$ grep -nE "\b32\b" PRD.md     # enumerate every "32" — classify each
979:| 32 | bare-`@` first-file + chain | …     # §11 ROW INDEX #32 (last matrix row) — NOT a count
986:… (cases 30–32 above). …                    # range reference to matrix rows 30/31/32 — NOT a count
1189:**Done-definition:** all 32 manual test cases in §11 pass; …  # THE COUNT — correct
```
All three "32" occurrences are **mutually consistent**: L979 is row index #32 (one of the 32 rows); L986 is
the range "30–32" (references existing rows); L1189 is the actual count. None is a stale or conflicting
count. ✓

### Facet (c) — no remaining "24"-as-count

```bash
$ grep -nE "\b24\b" PRD.md     # → exactly ONE hit
971:| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
```
The ONLY "24" in PRD.md is the **§11 ROW INDEX #24** ("top-level no fallback") at L971 — a table row label,
NOT a count. It is correct and must NOT be touched (the matrix has 32 rows; #24 is one of them). No stale
"24"-as-count survives. ✓ (This re-confirms T1.S2's completed finding as part of the holistic final gate.)

```bash
$ grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md     # count-word adjacency → ZERO output
(no output — clean)
```

## ∴ FINAL VERDICT: PRD.md IS INTERNALLY CONSISTENT — three-way agreement holds, phrasing is consistent,
   no stale count. **GATE PASSES. This completes the v007 delta.**

## Git trail (the fix is landed, not pending; tree is clean)

- `git log --oneline -3 -- PRD.md` → top commit `1ad7b19 Correct PRD Done-definition test count`.
- `git status --short PRD.md README.md file-injector.ts` → **empty** (clean; no uncommitted edits).
- The session-006 baseline snapshot (`plan/006_1862a6537500/prd_snapshot.md`) recorded the "before" value as
  "24", so v007 is the fix + verification.

## Relationship to the sibling/prior subtasks (the integration gate role)

T3.S2 is the **FINAL gate** — it runs after all others and re-confirms the whole picture coheres:

| Subtask | Scope (file) | Facet | Status | T3.S2's relationship |
|---|---|---|---|---|
| T1.S1 | PRD.md | (a.1) Done-def=32 + (a.2) matrix=32 | Complete | T3.S2 re-confirms these holistically as the final integration check (a regression between T1.S1 and T3.S2 would surface here). |
| T1.S2 | PRD.md | (c) no stale "24"-as-count | Complete | T3.S2 re-confirms this holistically (the L971 row index is the only "24"). |
| T2.S1 | code/tests | regression (122/38/22=182) | Complete | T3.S2's facet (a.3) cites that file-injector.test.mjs COVERS the 32-row matrix (consistent with T2.S1's green 182). Independent (code half). |
| **T3.S1** | **README.md** | README coherence | **Implementing (parallel)** | T3.S1 is the **README** half of the changeset-level doc sweep; **T3.S2 is the PRD** half. Different files — no overlap, no conflict. T3.S1's PRP explicitly defers PRD internal consistency to T3.S2. T3.S2 runs AFTER T3.S1 as the final gate. |
| **T3.S2 (THIS)** | **PRD.md** | **(a) three-way + (b) phrasing + (c) no-stale — HOLISTIC final gate** | **Researching** | The **FINAL** integration gate. Unique NEW checks: (a.3) Automated sanity check expectations, (b) phrasing consistency. Its pass **completes the delta**. |

**Key differentiator:** T1.S1/T1.S2 were focused single-facet gates during active research. **T3.S2 is the
holistic final sign-off** that (i) re-confirms T1.S1/T1.S2's facets still hold, AND (ii) adds the two NEW
checks they explicitly did NOT cover — the §11 Automated sanity check expectations (a.3) and the "32 manual
test cases" phrasing consistency (b). It is the only gate that proves the Done-definition count, the matrix
row count, AND the Automated sanity check prose all agree on "32 manual test cases" simultaneously.

## Scope boundaries (T3.S2 = PRD.md internal consistency, FINAL gate ONLY)

- ✅ Re-verify facet (a): Done-def(32) == matrix(32) == Automated sanity check expectations (three-way).
- ✅ Verify facet (b): "32 manual test cases" phrasing consistency (the NEW check).
- ✅ Re-verify facet (c): no stale "24"-as-count (only the L971 row index).
- ✅ Emit the final pass/fail coherence report → "completes the delta".
- ❌ Do NOT edit PRD.md or any file (read-only; PRD.md is human-owned; baseline is coherent → no fix needed).
- ❌ Do NOT re-run validate.sh / typecheck / test suites (that is T2.S1's completed regression gate).
- ❌ Do NOT scan/verify README.md (that is T3.S1's completed gate — different file).
- ❌ Do NOT re-author the Done-definition fix (it already landed in human commit 1ad7b19).

## Contingency (does NOT fire — baseline is coherent)

If (unexpectedly) a facet DISAGREES — e.g. Done-definition regressed to "24", the matrix lost/gained a row,
the Automated sanity check cited a conflicting count, or a stale "24"-as-count surfaced elsewhere — this is
a **genuine regression** (the fix landed in 1ad7b19; the baseline was coherent at research time). Action:
**HALT and report** the exact line + the nature of the disagreement for HUMAN review. Do NOT unilaterally
edit PRD.md (human-owned; the one-token fix was a human commit). The precise authorized fix, IF a human
re-authorizes it, is the one-token edit `24 → 32` at PRD.md:1189 only. **Moot in practice: the baseline is
coherent; the contingency does not fire.**

## Confidence: 10/10

A deterministic read-only coherence gate, and the baseline is **already verified COHERENT first-hand**
during research: Done-definition reads "all 32 manual test cases" (1 hit, no stale "24"); §11 matrix has
exactly 32 sequential rows; the Automated sanity check references "the full §11 matrix" + "cases 30–32"
(both consistent with 32, no conflicting count); "manual test cases" appears once and reads 32; the only
"24" is the L971 row index. delta_analysis.md's 6-point verification independently confirms the same. The
executing agent runs ~6 grep/awk commands, confirms each facet, and emits the final PASS — no edits, no
design risk, no code impact. The only residual is the (unexpected) regression branch, which the
HALT-and-report protocol resolves safely (PRD.md is human-owned, and the baseline proves it won't fire).
