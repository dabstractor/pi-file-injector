# Research Notes — P1.M1.T1.S1 (plan/007): Verify Done-definition reads '32' and §11 matrix has exactly 32 numbered rows

## Mission
A **read-only verification gate** (no edits). Confirm the PRD's Done-definition test-count fix is correctly
applied: (a) the Done-definition line reads "all **32** manual test cases" (not "24"), (b) the §11 Manual test
matrix has exactly 32 sequential numbered rows (#1–#32, no gaps), and (c) the two counts agree (32 == 32).
The fix is a one-token doc consistency fix, already applied in commit `1ad7b19`.

## ⭐ Baseline CONFIRMED PASS (verified this research session, working tree clean)
1. **PRD.md:1189 Done-definition** reads: `**Done-definition:** all 32 manual test cases in §11 pass; …` ✓
   (NO "24"; grep for "all 24 manual test cases" returns nothing.)
2. **§11 Manual test matrix** has exactly **32 sequential rows** (#1–#32, no gaps):
   distinct row numbers = `1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32`
   (count = 32, max = 32, first row = #1, last row = #32). ✓
3. **32 == 32** → the two counts AGREE. ✓ **GATE PASSES.**

## Git trail (the fix is landed, not pending)
- `git log --oneline -- PRD.md` shows commit `1ad7b19 Correct PRD Done-definition test count` (top of the
  PRD.md history). `git status --short PRD.md` is empty → PRD.md is clean (no uncommitted edits).
- The session-006 baseline snapshot (`plan/006_1862a6537500/prd_snapshot.md`) recorded the "before" value as
  "24" — so this delta (007) is the fix + verification.

## Verification trail (plan/007_3778406b61d6/architecture/delta_analysis.md)
The delta_analysis.md documents (all CONFIRMED by research subagents):
1. `PRD.md:1189` reads "all 32 manual test cases" ✓
2. §11 matrix has exactly 32 numbered rows (#1–#32) ✓
3. No OTHER stale "24"-as-test-count in PRD.md (the `| 24 |` at L971 is a ROW INDEX, not a count — correct,
   must NOT be touched; that broader scan is **S2**, not this subtask)
4. Commit `1ad7b19` exists in git history ✓
5. `file-injector.ts` requires ZERO changes (no function depends on the Done-definition count) ✓
6. Session-006 baseline confirms "before" was 24 ✓

## The verification commands (the whole subtask)
```bash
cd /home/dustin/projects/pi-file-injector
# (a) Done-definition reads "32" (expect ONE hit at ~L1189):
grep -n "all 32 manual test cases" PRD.md
# (a-neg) Done-definition does NOT read "24" (expect ZERO hits):
grep -n "all 24 manual test cases" PRD.md   # → no output
# (b) §11 matrix row count (expect: "1 2 3 … 32", count 32, max 32, no gaps):
awk '/^### Manual test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' '; echo
awk '/^### Manual test matrix/,/^### Automated test matrix/,/^### Automated sanity check/' PRD.md | grep -oE '^\| [0-9]+ \|' | grep -oE '[0-9]+' | sort -n -u | wc -l   # → 32
# (c) 32 == 32 → PASS.
```

## CRITICAL constraints
- **READ-ONLY.** Make NO edits. PRD.md is human-owned (the system prompt forbids modifying it; the item's
  LOGIC also says "make no edits"). The fix is already applied.
- **If (unexpectedly) the counts DISAGREE** (a regression): the item authorizes "change the count to match
  the matrix (currently 32)" — but PRD.md is human-owned, so the safer action is **HALT and report the
  regression** (the fix landed in commit 1ad7b19; a disagreement means a genuine regression needing human
  review). The precise fix, IF authorized, is the one-token edit `24 → 32` at PRD.md:1189. Do NOT widen scope.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ Broader stale-"24"-as-count scan across all of PRD.md (incl. the L971 `| 24 |` row index) = **S2**.
- ❌ typecheck + the three test suites via validate.sh (phases 1-3) = **T2.S1**.
- ❌ README.md stale-reference scan = **T3.S1**.
- ❌ PRD.md internal-consistency re-verify = **T3.S2**.
- ✅ S1 scope: ONLY (a) Done-definition reads "32", (b) §11 matrix has exactly 32 sequential rows, (c) 32==32.

## No implementation impact
`file-injector.ts` (1114 lines), the three test suites, README.md, package.json — NONE are touched by this
delta. The Done-definition count is a doc summary; no code depends on it. (Confirmed by delta_analysis §"Risk".)
