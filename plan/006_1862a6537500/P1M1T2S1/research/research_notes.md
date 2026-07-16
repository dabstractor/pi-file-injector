# Research Notes — P1.M1.T2.S1: Fix PRD.md Done-definition "all 24" → "all 32"

> One-token documentation fix. PRD.md is normally read-only, but this subtask is explicitly scoped (item
> description §1-7) to correct a stale test-count in the PRD's own Done-definition. No code, no tests,
> no other files. This is a verification-delta doc fix, not an implementation.

## 1. The defect — VERIFIED first-hand

`PRD.md:1189` (Appendix A, last line, Done-definition) currently reads:
> **Done-definition:** all 24 manual test cases in §11 pass; no uncaught errors; ...

It says "24" but §11 lists **32** cases (rows #1–#32). Stale — undercounts by 8.

## 2. §11 row count — VERIFIED first-hand (32 rows, contiguous)

- §11 "Manual test matrix" header: `PRD.md:944`
- Table header row: `PRD.md:946` (`| # | Setup | Input | Expected |`)
- First data row: `PRD.md:948` (`| 1 | ...`)
- Last data row: `PRD.md:979` (`| 32 | ...`)
- **Exactly 32 data rows, numbered #1–#32, sequential, no gaps, no duplicates.**

Verification command run:
```bash
grep -nE '^\| [0-9]+ ' PRD.md | sed -E 's/^([0-9]+):\| ([0-9]+) .*/L\1 -> row #\2/'
# Shows 36 total numeric-row-starts: 4 in the §7 import-source table (L200-203) + 32 in §11 (L948-979).
```

## 3. All "24" occurrences in PRD.md — VERIFIED (exactly two)

```bash
grep -n "24" PRD.md
# 971:| 24 | top-level no fallback | ...     ← row INDEX #24 (a row, not a count) — CORRECT, do NOT touch
# 1189:**Done-definition:** all 24 manual test cases ...   ← the stale COUNT — FIX THIS
```

Only **one** "24" references a test count (L1189). The L971 "24" is the row number of test case #24
("top-level no fallback") — that is a row index, not a count, and must stay "24".

## 4. The exact edit

`PRD.md:1189`: change `all 24 manual test cases` → `all 32 manual test cases`. Nothing else on the line
changes; nothing else in the file changes.

**Surgical oldText/newText** (for the edit tool — scoped to be unique in the file):
- oldText: `**Done-definition:** all 24 manual test cases in §11 pass;`
- newText: `**Done-definition:** all 32 manual test cases in §11 pass;`

(The prefix `**Done-definition:**` makes this string unique — "Done-definition" appears once in PRD.md.)

## 5. Post-fix verification (item §4)

```bash
# Confirm no stale "24" test-count references remain. Row #24's "24" (L971) is NOT a count, so this
# pattern (which matches "24" near "test"/"case"/"all 24") should return nothing meaningful after the fix.
grep -nE '24.*test|24.*case|all 24' PRD.md
# Expected after fix: no output (the only "24" left is L971's "| 24 | top-level no fallback |", which
# does NOT match "24.*test" or "24.*case" or "all 24" — it's "| 24 | top-level no fallback |").
#
# Double-confirm the count now matches the matrix:
grep -n "all 32 manual test cases" PRD.md   # → 1189 (the fixed line)
grep -cE '^\| [0-9]+ ' PRD.md               # → 36 (4 import-source + 32 matrix) — unchanged structural count
```

## 6. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Complete) | Run all 3 test suites → 182 passed | Provides the green gate T2.S1's fix is consistent with (32 matrix rows are exercised by the suites). T2.S1 edits PRD.md only. |
| P1.M1.T1.S2 (Complete) | tsc --strict typecheck → 0 errors | Orthogonal (source typecheck; T2.S1 is a doc fix). |
| P1.M1.T1.S3 (Implementing, parallel) | Verification: confirm 3 §1 requirements exercised in suites; edits test files ONLY if a named case is missing | T2.S1 edits PRD.md; T1.S3 references PRD.md (cites §11) but does NOT edit it. No file conflict. |
| P1.M1.T2.S2 (Planned) | README.md config-section coherence | Different file (README.md). No conflict. |
| P1.M1.T2.S3 (Planned) | readConfig/SETTINGS_KEY/injectMarkdown JSDoc coherence | Different file (file-injector.ts JSDoc). No conflict. |

**Critical no-conflict:** T2.S1 is the ONLY subtask that edits PRD.md. No other sibling touches it.
The fix is append-only-equivalent (a value substitution on one line); it cannot affect any test or build.

## 7. The PRD-is-normally-read-only caveat — and why this subtask is sanctioned

The agent prompt's FORBIDDEN OPERATIONS says "NEVER MODIFY PRD.md." HOWEVER, this subtask's item
description (§1-7) is an EXPLICIT, scoped exception: it is a doc-audit fix to the PRD's own
Done-definition (a summary doc that drifted as the §11 matrix grew from 24→32 rows). The plan owner
sanctioned this single one-token edit. The PRP must:
- Scope the edit to EXACTLY the one substitution on L1189 (oldText/newText above).
- Forbid touching any other line of PRD.md (esp. L971 row #24).
- Make the verification grep-based (item §4) so the implementer can prove no other stale count leaked.

This is the only sanctioned PRD edit in the entire delta; do not generalize it.
