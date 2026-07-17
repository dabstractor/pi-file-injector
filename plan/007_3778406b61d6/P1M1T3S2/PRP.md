---
name: "P1.M1.T3.S2 (plan/007) — Verify PRD.md internal consistency (Done-definition matches matrix, no stale counts)"
prd_ref: "v007 delta (documentation-only PRD Done-definition fix 24→32, already-applied human commit 1ad7b19, zero code changes); PRD §11 'Manual test matrix' (h3.23) + 'Automated sanity check (optional)' (h3.24); Appendix A Done-definition (h2.14, PRD.md:1189); architecture/delta_analysis.md (zero-scope contract + 6-point verification); plan/007_3778406b61d6/P1M1T3S1/PRP.md (README coherence gate — the README half of the changeset-level doc sweep); plan/007_3778406b61d6/P1M1T1S1, P1M1T1S2 (completed PRD facets re-confirmed holistically)"
target_file: "PRD.md   # READ-ONLY FINAL coherence gate — NO edits (verification-only; PRD.md is human-owned; the verified baseline is internally consistent). The fix already landed in human commit 1ad7b19; this subtask only ASSERTS whole-document coherence and emits the final pass/fail. file-injector.ts, the 3 test files, README.md, package.json, tsconfig.json, validate.sh are all untouched."
target_language: "Markdown (the document under final review) + the verification agent's final pass/fail internal-consistency report"
depends_on: "P1.M1.T3.S1 (README coherence gate — the README half of the changeset-level doc sweep; read-only, expected PASS/no-edit; checks a DIFFERENT file so there is no overlap/conflict). Transitively: P1.M1.T1.S1 (Done-def=32 + matrix=32 — Complete), P1.M1.T1.S2 (no stale '24'-as-count — Complete), P1.M1.T2.S1 (validate.sh regression 122/38/22=182 — Complete). T3.S2 runs LAST as the final integration gate, re-confirming the whole document is coherent and 'completing the delta' (item §5 DOCS)."
consumed_by: "NONE downstream. T3.S2 is the FINAL gate of the v007 delta — its PASS is the delta-completion signal (item §4 OUTPUT: 'This completes the delta'). No further subtask consumes it."
---

# PRP — P1.M1.T3.S2: Verify PRD.md internal consistency (Done-definition matches matrix, no stale counts)

> **Scope flag:** This is the **FINAL coherence gate** of the v007 delta — a **read-only, changeset-level
> documentation integration gate (Mode B)**, NOT implementation and NOT an edit. The v007 delta is
> documentation-only (PRD.md Done-definition `24 → 32` at PRD.md:1189, already-applied human commit
> `1ad7b19`, **zero code changes** — per `architecture/delta_analysis.md`). T3.S2 runs **last** (after the
> README sweep T3.S1 and all prior subtasks) and confirms the **whole PRD.md is internally coherent**: a
> **three-way agreement** that there are 32 manual test cases (Done-definition == §11 matrix row count ==
> §11 Automated sanity check expectations), the "32 manual test cases" phrasing is consistent throughout,
> and no stale "24"-as-count survives. **Expected outcome: PASS — PRD.md is internally consistent; NO edits.**
> Its pass **completes the delta** (item §5 DOCS). PRD.md is edited in NOTHING (it is human-owned; the
> verified baseline is coherent; a failure is a regression → HALT and report).

---

## Goal

**Feature Goal:** Confirm **PRD.md is internally consistent** after the v007 one-token Done-definition fix,
as the **final holistic integration gate** of the delta. Concretely, assert the item's three facets (LOGIC §3):
- **(a)** **Three-way agreement** that there are 32 manual test cases: Done-definition count (**32**) ==
      §11 manual test matrix row count (**32**) == §11 Automated sanity check expectations
      (`file-injector.test.mjs` covers "the full §11 matrix + §10 edges"; `relative-imports.test.mjs`
      references "cases 30–32 above" — both consistent with the 32-row matrix, **no conflicting count**).
- **(b)** The "**32 manual test cases**" phrasing is internally consistent throughout PRD.md (appears once,
      reads "32"; every "32" occurrence is consistent — a row index, an in-range case reference, or the count).
- **(c)** **No remaining "24"-as-count** anywhere (the only "24" is the §11 row index #24 at L971, a row
      label, NOT a count).

**Deliverable:** A **final pass/fail internal-consistency report** for each facet (a / b / c) plus a
`git status` confirming **no file was modified** (the check was read-only). **No edits expected** (item §4:
"Final pass/fail confirmation"). The report's closing line is the delta-completion signal:
**"PRD.md is internally consistent — v007 delta complete."**

**Success Definition:** All three facets pass (a PASS / b PASS / c PASS); the three-way agreement holds
(32 == 32 == Automated sanity check "full §11 matrix" reference); `git status --short PRD.md` is empty
(the read-only check did not widen scope); the report states PRD.md is coherent and the delta is complete.

## User Persona

**Target User:** The **delta reviewer / maintainer** who needs the final, holistic sign-off that the v007
documentation-only delta (one-token Done-definition fix) left PRD.md **fully self-consistent** — not just at
the one fixed line, but across the Done-definition, the §11 matrix, and the §11 Automated sanity check prose,
top-to-bottom.

**Use Case:** As the last action of the delta, the reviewer runs this final coherence gate to prove the
Done-definition's "32 manual test cases" agrees with the matrix it summarizes (32 rows) AND the Automated
sanity check that claims to cover "the full §11 matrix" — i.e. no count disagrees anywhere. A clean PASS
closes the delta.

**User Journey:** (1) Read PRD.md's three relevant regions (Done-definition L1189; §11 matrix L944–979;
§11 Automated sanity check L981–1003). (2) Run ~6 deterministic grep/awk assertions (facets a/b/c). (3)
Confirm each facet's expected output. (4) Emit the final pass/fail report + `git status`. (5) If all PASS →
"PRD.md is internally consistent — v007 delta complete." (No file is edited.)

**Pain Points Addressed:** A focused fix to one line can leave a *different* part of the document subtly
contradicting it (e.g. the Automated sanity check citing a stale count, or a stray "24 manual cases"
somewhere). The prior focused gates (T1.S1 = Done-def/matrix two-count; T1.S2 = stale-24 scan) each proved
one facet. **This gate proves all facets AGREE simultaneously** — the integration proof the delta is coherent
end-to-end, including the two checks T1.S1/T1.S2 did *not* cover (Automated sanity check expectations + the
"32 manual test cases" phrasing consistency).

## Why

- **This is the FINAL gate — it completes the delta.** Item §5 DOCS: "[Mode B] This is the final
  changeset-level documentation gate for the v007 delta. It confirms the whole document is coherent after the
  single-token fix." Item §4 OUTPUT: "Final pass/fail confirmation that PRD.md is internally consistent. **This
  completes the delta.**" T3.S2 runs last (depends on T3.S1 + transitively T1.S1/T1.S2/T2.S1) so the
  delta-closure signal is emitted only after every prior gate has passed.
- **Integration proof, not redundant work.** T1.S1 (Complete) proved Done-def=32 + matrix=32 agree. T1.S2
  (Complete) proved no stale "24"-as-count. But neither proved the **§11 Automated sanity check prose**
  agrees (facet a.3) nor that the **"32 manual test cases" phrasing** is consistent everywhere (facet b) —
  both T1.S1 and T1.S2 explicitly deferred "PRD.md internal-consistency re-verify" to T3.S2. T3.S2 closes
  those two remaining gaps AND re-confirms the prior facets hold (a regression between T1.S1/T1.S2 and now
  would surface here), yielding the **single end-to-end coherence proof**.
- **The count fix is documentation-only with zero code impact.** No function in `file-injector.ts` depends on
  the Done-definition count (delta_analysis §"Risk"; T2.S1 confirmed the 182-case behavioral contract still
  passes). So this gate is a pure read assertion across PRD.md's three count-relevant regions — no behavior
  test, no code edit.

## What

No user-visible, API, config, code, or doc change is expected (verification only). The deliverable is a
**final pass/fail internal-consistency report**. PRD.md's three count-relevant regions are read; three facets
are checked; **PRD.md is left byte-for-byte unchanged** unless an unexpected regression surfaces (which would
trigger HALT-and-report, never a silent edit).

### Success Criteria

- [ ] **(a.1)** `grep -c "all 32 manual test cases" PRD.md` → **1** (Done-definition count = 32, at L1189).
- [ ] **(a.1-neg)** `grep -c "all 24 manual test cases" PRD.md` → **0** (no stale Done-definition count).
- [ ] **(a.2)** §11 matrix distinct row numbers = `1 2 3 … 32` (sequential, no gaps); count = **32**.
- [ ] **(a.3)** §11 Automated sanity check expectations are consistent with 32 — **the NEW unique check**:
      - `grep -n "the full §11 matrix" PRD.md` → exactly ONE hit (the `file-injector.test.mjs` line, ~L985),
        referencing the same 32-row matrix (NO conflicting count).
      - `grep -nE "cases 3[0-2]" PRD.md` → exactly ONE hit (the `relative-imports.test.mjs` line, ~L986),
        "cases 30–32 above" — all in-range of the 32-row matrix.
      - The §11 Automated sanity check region (L981–1003) cites **NO count** that conflicts with 32 (no
        "24 cases", no "the 24-row matrix", no out-of-range reference).
- [ ] **(b)** `grep -nE "manual test cases" PRD.md` → exactly ONE hit (L1189, reads "all **32**"); and every
      `\b32\b` occurrence is consistent (row index #32 at L979 / "cases 30–32" at L986 / the count at L1189).
- [ ] **(c)** `grep -nE "\b24\b" PRD.md` → exactly ONE hit: `| 24 |` at ~L971 (the §11 row index #24,
      "top-level no fallback") — classified ROW-INDEX (NOT a count) → correct → leave alone; and
      `grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md` → ZERO output.
- [ ] **THREE-WAY AGREEMENT holds:** 32 (Done-def) == 32 (matrix rows) == "the full §11 matrix" /
      "cases 30–32" references (Automated sanity check) → **GATE PASS**.
- [ ] `git status --short PRD.md` → **empty** (read-only check; PRD.md unchanged).
- [ ] `git status --short` shows NO edit to file-injector.ts, any `.test.mjs`, README.md, package.json,
      tsconfig.json, validate.sh, or scripts/typecheck.mjs (this task touches none).
- [ ] Report closing line: **"PRD.md is internally consistent — v007 delta complete."**

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives: the exact grep/awk commands for every facet (a/b/c) with their
**verified** expected outputs (1 hit / 0 hits / `1…32` / count 32 / single "24" row index / single "32"
count), the three-region map of PRD.md under review (Done-definition L1189; §11 matrix L944–979; §11
Automated sanity check L981–1003) with the exact text of the count-relevant lines, the three-way-agreement
logic, the binding read-only/HALT-and-report discipline (PRD.md is human-owned), the relationship to all
sibling gates (so no scope overlap), and the explicit "PASS = no edit, report = delta-complete" outcome. The
executing agent reads three PRD regions, runs ~6 grep/awk assertions, and reports — editing nothing (unless
the unexpected regression branch fires, which has a defined HALT-and-report protocol).

### Documentation & References

```yaml
# MUST READ — the document under final review (read the THREE count-relevant regions)
- file: PRD.md
  why: "The file this FINAL gate verifies. Three regions matter: (1) Appendix-A Done-definition at L1189
        ('all 32 manual test cases'); (2) §11 'Manual test matrix' table at L944–979 (32 rows #1–#32); (3) §11
        'Automated sanity check (optional)' at L981–1003 (the two Node test scripts' descriptions). The
        grep/awk commands target exactly these regions."
  pattern: "Done-definition (L1189) names the count. §11 matrix (L944–979) IS the count (32 data rows).
            Automated sanity check (L981–1003) references 'the full §11 matrix' (L985) + 'cases 30–32 above'
            (L986) — both consistent with 32, no conflicting count."
  gotcha: "Do NOT edit PRD.md (human-owned; system-prompt-forbidden). The fix already landed (commit 1ad7b19);
           the verified baseline is coherent. Editing PRD.md to 'reconcile' a perceived inconsistency WIDENS
           SCOPE and violates ownership. If a facet DISAGREES, HALT and report (a genuine regression)."

# MUST READ — the zero-scope contract + the 6-point verification trail
- file: plan/007_3778406b61d6/architecture/delta_analysis.md
  why: "Confirms the v007 delta is documentation-only (PRD.md:1189 '24→32', commit 1ad7b19, already-applied);
        zero code change; net delta = one token in one doc line. §Verification lists 6 CONFIRMED points
        (Done-definition=32; matrix=32 rows; no other stale '24'-as-count — the L971 '| 24 |' is a row index;
        commit 1ad7b19 exists; file-injector.ts needs zero changes; session-006 baseline was 24). §Risk: 'Any
        edit to file-injector.ts, tests, README.md, or package.json would widen scope and violate the delta's
        contract.' This is why T3.S2's default outcome is PASS / no-edit."

# MUST READ — the source requirement (the delta itself)
- file: plan/007_3778406b61d6/delta_prd.md
  why: "States the delta is documentation-only, already applied (PRD.md:1189 reads 'all 32'); net delta = one
        token; no implementation work required or possible. §4 lists the three acceptance facets — Done-def
        reads 32, matrix has 32 rows, no other '24'-as-count — which T3.S2 verifies holistically (plus the
        Automated sanity check expectations + phrasing consistency facets the item adds)."

# MUST READ — the sibling README gate (the OTHER half of the changeset-level doc sweep)
- file: plan/007_3778406b61d6/P1M1T3S1/PRP.md
  why: "T3.S1 is the README coherence gate (a DIFFERENT file). T3.S1's PRP explicitly defers PRD internal
        consistency to T3.S2: 'PRD internal consistency is P1.M1.T3.S2 ... T3.S1 is README-only. If you spot a
        PRD issue, note it in the report — do not fix it here (that's T3.S2's scope).' T3.S2 runs AFTER T3.S1
        as the final gate. Treat T3.S1's PRP as a CONTRACT: assume T3.S1 will pass README clean (expected
        PASS / no-edit); T3.S2 does NOT duplicate or conflict with it — different files."
  critical: "Boundary: T3.S1 = README.md; T3.S2 = PRD.md. No overlap, no conflict. T3.S2 must NOT scan/verify
             README (T3.S1's completed work) and T3.S1 must NOT verify PRD internal consistency (T3.S2's scope)."

# MUST READ — the completed PRD-facet gates (T3.S2 re-confirms these holistically)
- file: plan/007_3778406b61d6/P1M1T1S1/PRP.md
  why: "T1.S1 (Complete) proved Done-definition=32 + §11 matrix=32 agree (facets a.1 + a.2). T3.S2 re-confirms
        these as the final integration check AND adds the Automated sanity check expectations (a.3) + phrasing
        consistency (b). T1.S1's awk range anchors are reused: '^### Manual test matrix' … '^### Automated
        sanity check'."
- file: plan/007_3778406b61d6/P1M1T1S2/PRP.md
  why: "T1.S2 (Complete) proved no stale '24'-as-count (facet c). T3.S2 re-confirms this holistically (the
        L971 '| 24 |' is still the only '24', a row index). T1.S2's count-word adjacency grep is reused."

# REFERENCE — the code-regression half (independent; T3.S2 cites its coverage for facet a.3 context)
- file: plan/007_3778406b61d6/P1M1T2S1/PRP.md
  why: "T2.S1 (Complete) ran validate.sh phases 1–3: typecheck 0 errors; 122/38/22 = 182 automated cases pass;
        manifest valid. file-injector.test.mjs has 122 AUTOMATED cases that COVER the 32 manual matrix rows +
        §10 edges + unit tests. Facet (a.3) cites this: the Automated sanity check says file-injector.test.mjs
        covers 'the full §11 matrix' (= the 32 manual rows) — consistent. Do NOT conflate 122 (automated) with
        32 (manual); they are different by design and need not be equal."

# REFERENCE — the "before" baseline (proves the fix changed something)
- file: plan/006_1862a6537500/prd_snapshot.md
  why: "Session-006 snapshot recorded PRD.md:1189 as 'all 24 manual test cases' — the pre-fix value. Confirms
        commit 1ad7b19 changed 24 → 32 (the one known stale count, now fixed). T3.S2 proves it was the ONLY
        inconsistency and the whole document now coheres."

# EXTERNAL — n/a. PRD internal-consistency verification is plain-text review + grep/awk. No library docs needed.
```

### Current Codebase tree (the document under final review)

```bash
pi-file-injector/
├── PRD.md                    # ← READ the THREE count-relevant regions (Done-def L1189; §11 matrix L944-979;
│                             #    §11 Automated sanity check L981-1003). Edit NOTHING (human-owned).
├── README.md                 # UNTOUCHED (T3.S1's gate; different file — do NOT verify it here).
├── file-injector.ts          # UNTOUCHED (zero code impact; T2.S1's regression gate).
├── file-injector.test.mjs    # UNTOUCHED (the 122-case suite; cited for facet a.3 context only)
├── relative-imports.test.mjs # UNTOUCHED
├── import-behavior.test.mjs  # UNTOUCHED
├── package.json              # UNTOUCHED
├── validate.sh               # UNTOUCHED (T2.S1's gate)
└── plan/007_3778406b61d6/
    ├── architecture/delta_analysis.md   # ← the zero-scope contract + 6-point verification trail
    ├── delta_prd.md                     # ← the source requirement (doc-only, already applied)
    ├── prd_index.txt                    # ← the PRD section map (h3.23 Manual matrix, h3.24 Automated sanity)
    ├── P1M1T1S1/{research,PRP.md}       # ← Completed facet a.1+a.2 (Done-def=32 + matrix=32)
    ├── P1M1T1S2/{research,PRP.md}       # ← Completed facet c (no stale "24"-as-count)
    ├── P1M1T2S1/{research,PRP.md}       # ← Completed regression gate (122/38/22=182)
    ├── P1M1T3S1/{research,PRP.md}       # ← README coherence gate (the other half of the doc sweep)
    └── P1M1T3S2/
        ├── research/research_notes.md   # ← first-hand verification of facets a/b/c + three-region map
        └── PRP.md                         # (this file)
```

### The three count-relevant regions of PRD.md (read these FIRST)

```text
REGION 1 — Appendix-A Done-definition (PRD.md:1189):
  "**Done-definition:** all 32 manual test cases in §11 pass; …"
  → THE count. Must read "32" (facet a.1). Must be the ONLY "manual test cases" phrasing (facet b).

REGION 2 — §11 "Manual test matrix" table (PRD.md:944–979):
  32 data rows #1–#32, delimited by '### Manual test matrix' … '### Automated sanity check'.
  Row #24 (L971) = "top-level no fallback"; Row #32 (L979) = "bare-@ first-file + chain".
  → IS the count (32 rows). Must be sequential 1–32, no gaps (facet a.2). The "| 24 |" at L971 is a ROW INDEX
    (facet c — the only "24", leave alone).

REGION 3 — §11 "Automated sanity check (optional)" (PRD.md:981–1003):
  - file-injector.test.mjs (L985): "the full §11 matrix + §10 edges"
  - relative-imports.test.mjs (L986): "… (cases 30–32 above)."
  → References the SAME 32-row matrix; no conflicting count; "30–32" are in-range (facet a.3 — the NEW check).
```

### Desired Codebase tree (files touched)

```bash
(none — READ-ONLY final coherence gate)
PRD.md   # UNCHANGED (expected). The verification is read-only. If (NOT expected) a facet DISAGREES, that is a
         # regression → HALT-and-report (do NOT edit PRD.md; human-owned). The one-token fix (24→32 at L1189)
         # already landed in human commit 1ad7b19; the baseline is coherent, so no fix is needed.
# No other file touched. (plan/ PRP/research artifacts are the only writes, and those belong to this session.)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — READ-ONLY. PRD.md is human-owned (the system prompt forbids modifying it; the Done-definition fix
#   was a HUMAN commit 1ad7b19). This FINAL gate only ASSERTS whole-document coherence and reports pass/fail.
#   The verified baseline is coherent → NO edit is needed. Do NOT "reconcile" or "tighten" any PRD line —
#   that WIDENS SCOPE and violates ownership (delta_analysis §Risk).

# CRITICAL — the ONLY permitted action on a DISAGREEMENT is HALT-and-report. If any facet fails (a regression
#   — the fix landed in 1ad7b19, so a failure is genuine), report the exact line + the nature of the
#   disagreement for HUMAN review. Do NOT unilaterally edit PRD.md. The precise authorized fix, IF a human
#   re-authorizes it, is the one-token edit 24→32 at PRD.md:1189 ONLY. (Moot: the baseline is coherent.)

# CRITICAL — do NOT confuse the §11 ROW INDEX "| 24 |" (PRD.md L971, test case #24 "top-level no fallback")
#   with a COUNT. It is a row label in a 32-row table — CORRECT, must NOT be touched (touching it corrupts
#   the matrix). It is the ONLY "24" in PRD.md. Likewise "| 32 |" at L979 is row index #32, NOT a count.

# CRITICAL — do NOT conflate the MANUAL count (32) with the AUTOMATED count (122). The Done-definition's
#   "32 manual test cases" = the 32-row manual matrix. file-injector.test.mjs has 122 AUTOMATED cases that
#   COVER those 32 rows + §10 edges + unit tests. Facet (a.3) only checks the Automated sanity check PROSE
#   does not introduce a CONFLICTING count (e.g. "24 cases") — it does NOT require 32 == 122. The prose says
#   "the full §11 matrix" (= 32 rows) and "cases 30–32" (in-range). That is the consistency check.

# GOTCHA — anchor the §11 matrix awk range on the EXACT headings '^### Manual test matrix' … '^### Automated
#   sanity check' so it captures only the 32-row table (not the Automated sanity check prose below it, which
#   has no data rows). If the PRD re-uses "matrix" elsewhere, the exact-heading anchor keeps the range tight.

# GOTCHA — count DISTINCT row numbers (sort -n -u), not raw table lines. A wrapped/malformed row could inflate
#   the raw count; the distinct-number check detects both gaps AND duplicates.

# GOTCHA — the Automated sanity check region is L981–1003 (between '### Automated sanity check' and '## 12').
#   It contains a fenced ```ts code block (the sharp-at-test command) — that code is illustrative, NOT a count.
#   Do NOT grep the code block for numbers; the count-relevant lines are the two bullet descriptions (L985/L986).

# GOTCHA — do NOT cross into README.md here. README coherence is T3.S1's completed gate (different file).
#   Do NOT re-run validate.sh/typecheck/tests (T2.S1's completed gate). T3.S2 is PRD.md internal consistency ONLY.

# LIBRARY — plain grep/awk on a Markdown file. No build, no runtime, no model, no network, no test framework.
```

## Implementation Blueprint

> There is no implementation. This is the **final coherence-gate runbook**. (Adapted from the implementation
> template since this subtask produces no code and — by design — no doc edit.)

### The three-way agreement logic (facet a — the heart of the gate)

```text
There are 32 manual test cases. Three independent PRD regions must AGREE on that number:

  Done-definition (L1189):  "all 32 manual test cases in §11 pass"   → 32
  §11 matrix (L944–979):    32 numbered data rows #1–#32             → 32
  §11 Automated sanity check (L985/L986):
        file-injector.test.mjs covers "the full §11 matrix"          → the SAME 32-row matrix
        relative-imports.test.mjs references "cases 30–32 above"     → rows 30,31,32 (all in the 32-row matrix)

  ∴ 32 == 32 == "the full §11 matrix" / "cases 30–32"   → THREE-WAY AGREEMENT. PRD.md is internally consistent.
```

### Verification Tasks (ordered — run all; each facet is independent)

```yaml
Task 1: READ the three count-relevant regions of PRD.md (set the context for facets a/b/c)
  - REGION 1: Done-definition at L1189. REGION 2: §11 matrix at L944–979. REGION 3: §11 Automated sanity
    check at L981–1003. (See the three-region map above.)
  - CONFIRM the region boundaries match: Done-def line, the '### Manual test matrix' / '### Automated sanity
    check' headings, and the two test-script bullet lines (L985 file-injector.test.mjs, L986 relative-imports).

Task 2: FACET (a.1) — Done-definition count = 32
  - CMD: grep -c "all 32 manual test cases" PRD.md        → EXPECT 1
  - CMD: grep -c "all 24 manual test cases" PRD.md        → EXPECT 0 (no stale count)
  - FAIL if: a.1 is 0 (regression to "24") or >1 (ambiguous); OR a.1-neg is ≥1 (stale "24" still present).

Task 3: FACET (a.2) — §11 matrix row count = 32 (sequential, no gaps)
  - CMD (distinct rows): awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md \
        | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
      → EXPECT "1 2 3 … 32" (no gaps).
  - CMD (count): … | wc -l  → EXPECT 32.
  - FAIL if: count != 32, OR max != 32, OR any gap/duplicate in the sequence.

Task 4: FACET (a.3) — §11 Automated sanity check expectations consistent with 32  [THE NEW UNIQUE CHECK]
  - CMD: grep -n "the full §11 matrix" PRD.md             → EXPECT exactly ONE hit (the file-injector.test.mjs
            bullet, ~L985) — it references the SAME 32-row matrix; NO conflicting count in that bullet.
  - CMD: grep -nE "cases 3[0-2]" PRD.md                   → EXPECT exactly ONE hit (the relative-imports.test.mjs
            bullet, ~L986) — "cases 30–32 above"; rows 30/31/32 ALL exist in the 32-row matrix (in-range).
  - CMD (no-conflicting-count sweep of the Automated sanity check region):
        awk '/^### Automated sanity check/,/^## [0-9]/' PRD.md \
          | grep -niE "\b(24|23|25|30|31)\b|test cases|rows" 
      → EXPECT only the benign "cases 30–32" reference; NO "24/23/25 test cases", NO "N-row matrix" count.
  - FAIL if: "the full §11 matrix" hit is missing/changed to a conflicting count; OR "cases 30–32" references
    a row > 32 (out-of-range); OR a conflicting count surfaces in the region. (NOT expected — verified clean.)

Task 5: FACET (b) — "32 manual test cases" phrasing consistency
  - CMD: grep -nE "manual test cases" PRD.md             → EXPECT exactly ONE hit (L1189), reading "all 32 …".
  - CMD: grep -nE "\b32\b" PRD.md                        → EXPECT exactly THREE hits, ALL consistent:
            L979 "| 32 |" (row index #32), L986 "cases 30–32" (in-range reference), L1189 "all 32 …" (the count).
            None is a stale or conflicting count.
  - FAIL if: "manual test cases" appears elsewhere with a different number (e.g. "24 manual test cases"); OR a
    "32" occurrence reads as a stale count (NOT expected — verified all three are consistent).

Task 6: FACET (c) — no remaining "24"-as-count
  - CMD: grep -nE "\b24\b" PRD.md                        → EXPECT exactly ONE hit: "| 24 |" at ~L971 (§11 row
            index #24 "top-level no fallback") → classified ROW-INDEX (NOT a count) → CORRECT → leave alone.
  - CMD: grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md   → EXPECT ZERO output (no count-word
            adjacency). (This is T1.S2's check, re-confirmed holistically.)
  - FAIL if: more than one "24" substring; OR a "24" near test/case/manual/pass (a stale count). (NOT expected.)

Task 7: CONFIRM the THREE-WAY AGREEMENT → GATE PASS
  - If Tasks 2–6 all hold → 32 (Done-def) == 32 (matrix) == Automated sanity check ("the full §11 matrix" +
    "cases 30–32", no conflicting count) → three-way agreement → record PASS for facets a/b/c → gate PASS.
  - If ANY task fails → HALT and report (do NOT edit PRD.md; see Anti-Patterns). The fix landed in commit
    1ad7b19; a failure means a genuine regression needing human review.

Task 8: VERIFY no scope was widened (git-clean) + EMIT the final report
  - CMD: git status --short PRD.md                       → EXPECT empty (read-only; PRD.md unchanged).
  - CMD: git status --short                              → EXPECT NO edit to file-injector.ts, *.test.mjs (×3),
            package.json, tsconfig.json, README.md, validate.sh, scripts/typecheck.mjs.
  - EMIT: facet-by-facet pass/fail (a PASS / b PASS / c PASS) + the three-way-agreement confirmation + the
            grep outputs + git status. Closing line: "PRD.md is internally consistent — v007 delta complete."
```

### Implementation Patterns & Key Details

```bash
# The verification is ~6 deterministic grep/awk assertions across THREE PRD regions + ONE git status. No edit
# is the success state. The whole gate is the integration proof that the count fix (24→32 at L1189) left the
# Done-definition, the §11 matrix, and the §11 Automated sanity check prose all agreeing on "32 manual cases".
#
# PATTERN — facet (a.2) matrix count (reuse T1.S1's exact awk range):
#   awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' ...
#   The EXACT-heading anchor captures only the 32-row table. sort -n -u on distinct row numbers detects gaps
#   AND duplicates (robust to a wrapped row inflating the raw line count).
#
# PATTERN — facet (a.3) Automated sanity check (the NEW check): grep the two test-script bullet lines for
#   "the full §11 matrix" (→ the same 32-row matrix) and "cases 3[0-2]" (→ "cases 30–32", in-range). Then a
#   no-conflicting-count sweep of the region for any \b(24|23|25)\b near "test cases"/"rows" — must be empty
#   (only the benign "30–32" reference is allowed). This proves the prose agrees there are 32 manual cases.
#
# GOTCHA — do NOT grep the fenced ```ts code block in the Automated sanity check region for numbers; it is the
#   illustrative sharp-at-test command, not a count. The count-relevant lines are the two bullet descriptions.
#
# GOTCHA — the substring grep "\b32\b" / "\b24\b" with word boundaries avoids matching "132", "2024", etc.
#   But the "manual test cases" phrasing grep is the authoritative count-phrase check (facet b): it appears
#   ONCE (L1189, reads "32"). That single-occurrence result is the strongest phrasing-consistency proof.
#
# PATTERN — the report: state each facet's result (a PASS / b PASS / c PASS), the three-way-agreement line,
#   the key grep outputs (1 / 0 / "1…32" / 32 / single "24" row index / single "32" count phrasing), and
#   git status (empty). The closing line "PRD.md is internally consistent — v007 delta complete." IS the
#   delta-completion signal (item §4 OUTPUT / §5 DOCS).
```

### Integration Points

```yaml
NO CHANGES (read-only final coherence gate): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited (expected). PRD.md is READ (three regions); README.md is NOT read (T3.S1's gate); the
    architecture/ + sibling PRPs are READ for cross-reference. The only write is the PRP/research in plan/.
```

## Validation Loop

### Level 1: Facet (a) — the three-way agreement (Done-def == matrix == Automated sanity check)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[a.1] Done-def=32 (expect 1):";        grep -c "all 32 manual test cases" PRD.md
echo "[a.1-] no stale all-24 (expect 0):";   grep -c "all 24 manual test cases" PRD.md
echo "[a.2] matrix distinct rows:";          awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
echo "[a.2] matrix count (expect 32):";      awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | wc -l
echo "[a.3] 'the full §11 matrix' ref:";     grep -n "the full §11 matrix" PRD.md
echo "[a.3] 'cases 30-32' ref:";             grep -nE "cases 3[0-2]" PRD.md
echo "[a.3] no conflicting count in region:"; awk '/^### Automated sanity check/,/^## [0-9]/' PRD.md | grep -niE "\b(24|23|25)\b.*(test case|row)|\b[0-9]+ (test cases|manual)" ; echo "(empty above = clean)"
# Expected: a.1=1, a.1-=0, a.2="1 2 … 32", a.2-count=32, a.3="the full §11 matrix" hit @L985, a.3="cases 30–32" @L986, a.3-no-conflict=empty.
```

### Level 2: Facet (b) — "32 manual test cases" phrasing consistency

```bash
cd /home/dustin/projects/pi-file-injector
echo "[b] 'manual test cases' phrasing (expect 1 hit @L1189, reads 32):";  grep -nE "manual test cases" PRD.md
echo "[b] every '32' (expect 3 consistent hits: L979 rowidx / L986 cases-30-32 / L1189 count):"; grep -nE "\b32\b" PRD.md
# Expected: "manual test cases" = exactly ONE hit (L1189, "all 32 …"); three "32" hits, all consistent (none stale).
```

### Level 3: Facet (c) — no remaining "24"-as-count

```bash
cd /home/dustin/projects/pi-file-injector
echo "[c] every '24' (expect 1 hit: the §11 row index #24 @L971):";  grep -nE "\b24\b" PRD.md
echo "[c] count-word adjacency (expect ZERO output):";              grep -niE "24.{0,30}(test|case|manual|pass)|all 24" PRD.md; echo "(empty above = clean)"
# Expected: exactly ONE "24" → "| 24 |" @L971 (row index #24, NOT a count → leave alone); adjacency check empty.
```

### Level 4: Scope discipline + the three-way-agreement verdict (the proof the gate was read-only)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[scope] PRD.md unchanged (expect empty):"; git status --short PRD.md
echo "[scope] no other file touched:";          git status --short file-injector.ts file-injector.test.mjs relative-imports.test.mjs import-behavior.test.mjs package.json tsconfig.json README.md validate.sh scripts/typecheck.mjs
echo "[trail] PRD.md top commit:";              git log --oneline -1 -- PRD.md
# Expected: git status --short PRD.md = empty; the other-files status = empty; top commit = "1ad7b19 Correct PRD Done-definition test count".
#
# VERDICT — if Level 1 (a.1=1, a.1-=0, a.2=32, a.3 consistent), Level 2 (1 phrasing + 3 consistent 32s),
#   and Level 3 (1 row-index "24" + empty adjacency) all hold → THREE-WAY AGREEMENT → facets a/b/c PASS →
#   "PRD.md is internally consistent — v007 delta complete."
```

## Final Validation Checklist

### Technical Validation (the three facets)

- [ ] **(a.1)** `grep -c "all 32 manual test cases" PRD.md` → 1; `grep -c "all 24 manual test cases"` → 0.
- [ ] **(a.2)** §11 matrix distinct rows = `1…32` (sequential, no gaps); count = 32.
- [ ] **(a.3)** "the full §11 matrix" present (1 hit, ~L985); "cases 30–32" present (1 hit, ~L986, in-range);
      no conflicting count in the Automated sanity check region.
- [ ] **(b)** "manual test cases" appears once (L1189, reads "32"); every `\b32\b` is consistent.
- [ ] **(c)** exactly one "24" (the §11 row index #24 @L971, a row label NOT a count); count-word adjacency empty.
- [ ] **THREE-WAY AGREEMENT:** 32 (Done-def) == 32 (matrix) == Automated sanity check "full §11 matrix" ref → PASS.

### Gate Integrity (the read-only contract)

- [ ] `git status --short PRD.md` → empty (read-only; PRD.md unchanged — the success state).
- [ ] No edit to file-injector.ts / *.test.mjs / package.json / tsconfig.json / README.md / validate.sh /
      scripts/typecheck.mjs (`git status` clean for all).
- [ ] PRD.md NOT edited (human-owned; the fix landed in commit 1ad7b19; baseline is coherent). If a facet
      failed: HALT-and-report (no unilateral PRD.md edit).

### Scope Discipline (no overlap with sibling gates)

- [ ] README.md NOT verified here (T3.S1's completed gate — different file).
- [ ] validate.sh / typecheck / test suites NOT run here (T2.S1's completed regression gate).
- [ ] Done-def/matrix two-count + stale-24 scan re-confirmed holistically here (ties to T1.S1/T1.S2), PLUS the
      two NEW checks (a.3 Automated sanity check expectations + b phrasing consistency) only T3.S2 covers.

### Feature Validation

- [ ] The three PRD regions (Done-def L1189; §11 matrix L944–979; §11 Automated sanity check L981–1003) read
      and cross-checked against each other.
- [ ] No stale count, no conflicting count, no out-of-range reference anywhere in the three regions.
- [ ] The §11 row index #24 (L971) correctly classified as a row label (NOT touched).

### Documentation

- [ ] Final report states each facet's result (a PASS / b PASS / c PASS) + the three-way-agreement line +
      key grep outputs + git status.
- [ ] Closing line: **"PRD.md is internally consistent — v007 delta complete."** (the delta-completion signal)

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit PRD.md (or any file).** This is the read-only FINAL coherence gate; PRD.md is human-owned
  (the system prompt forbids modifying it; the Done-definition fix was a HUMAN commit `1ad7b19`). The verified
  baseline is coherent → NO edit is needed. Editing PRD.md to "reconcile" a perceived inconsistency WIDENS
  SCOPE and violates ownership (delta_analysis §Risk).
- ❌ **Do NOT silently "fix" a disagreement by editing PRD.md.** If (unexpectedly) a facet DISAGREES, that is a
  genuine regression (the fix landed in `1ad7b19`; the baseline was coherent at research time). HALT and report
  the exact line + the nature of the disagreement for HUMAN review. The implementing agent does NOT
  unilaterally edit PRD.md. (Moot: the baseline is coherent; the branch does not fire.)
- ❌ **Do NOT confuse the `| 24 |` row index (PRD.md L971, test case #24 "top-level no fallback") with a stale
  count.** It is a row label in a 32-row table — CORRECT, must NOT be touched (touching it corrupts the matrix).
  It is the ONLY "24" in PRD.md. Likewise `| 32 |` at L979 is row index #32, not a count.
- ❌ **Do NOT conflate the MANUAL count (32) with the AUTOMATED count (122).** The Done-definition's "32 manual
  test cases" = the 32-row manual matrix. `file-injector.test.mjs` has 122 AUTOMATED cases that COVER those 32
  rows + §10 edges + unit tests. Facet (a.3) only checks the Automated sanity check PROSE does not introduce a
  CONFLICTING count — it does NOT require 32 == 122. The prose says "the full §11 matrix" (= 32 rows) and
  "cases 30–32" (in-range). That is the consistency check.
- ❌ **Do NOT widen scope.** No README.md verification (T3.S1's completed gate), no validate.sh/typecheck/test
  run (T2.S1's completed gate), no re-authoring of the fix (it already landed in commit `1ad7b19`). T3.S2 is
  the PRD.md internal-consistency FINAL gate ONLY.
- ❌ **Do NOT grep the fenced ```ts code block in the Automated sanity check region for numbers.** It is the
  illustrative `sharp-at-test` command, not a count. The count-relevant lines are the two test-script bullet
  descriptions (L985 `file-injector.test.mjs`, L986 `relative-imports.test.mjs`).
- ❌ **Do NOT count raw §11 matrix lines instead of distinct row numbers.** A wrapped/malformed row could inflate
  the raw count. Use `sort -n -u` on the distinct row numbers to detect gaps AND duplicates.
- ❌ **Do NOT anchor the awk range on a loose word like "matrix".** Use the EXACT headings
  `^### Manual test matrix` … `^### Automated sanity check` so the range captures only the 32-row table.
- ❌ **Do NOT report the row index #24 (or #32) as a "stale/conflicting count."** Both are correct, mandatory
  row labels in the 32-row matrix. Reporting them as defects would be a false positive that wastes a human
  review cycle and undermines the delta-completion signal.
- ❌ **Do NOT emit a PASS without confirming all three facets AGREE simultaneously.** The value of this FINAL
  gate is the three-way-agreement integration proof (Done-def 32 == matrix 32 == Automated sanity check "full
  §11 matrix"). A facet-by-facet PASS that skips the agreement confirmation is an incomplete sign-off.

---

## Confidence Score: 10/10

This is a deterministic read-only FINAL coherence gate, and the baseline is **already verified COHERENT
first-hand** during research: Done-definition reads "all 32 manual test cases" (1 hit, no stale "24"); the §11
matrix has exactly 32 sequential rows #1–#32 (no gaps); the §11 Automated sanity check references "the full
§11 matrix" + "cases 30–32" (both consistent with 32, no conflicting count); "manual test cases" appears once
and reads "32"; the only "24" is the L971 row index #24. The three-way agreement holds. `delta_analysis.md`'s
6-point verification independently confirms the same. The executing agent reads three PRD regions, runs ~6
grep/awk assertions, confirms the three-way agreement, and emits the final PASS — no edits, no design risk, no
code impact. The only residual is the (unexpected) regression branch, which the HALT-and-report protocol
resolves safely (PRD.md is human-owned, and the baseline proves it won't fire). This gate's pass **completes
the v007 delta**.
