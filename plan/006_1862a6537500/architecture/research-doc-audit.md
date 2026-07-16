# Doc Audit — PRD.md & README.md

Source: reviewer subagent analysis (read-only audit, no source documents modified).

## Part 1 — The "24 manual test cases" / Done-definition (PRD.md)

### Location
- Done-definition lives in **Appendix A**, last line of the file:
  **`PRD.md:1189`**
  > **Done-definition:** all **24** manual test cases in §11 pass; ...

### The defect
Says "all **24**" but §11 lists **32** cases. Stale, undercounts by 8. Fix: `all 24` → `all 32`.

### All occurrences of "24" referencing test counts
Only **one**: `PRD.md:1189`. The other "24" at `PRD.md:971` is row #24 (a row index, not a count).

## Part 2 — §11 Manual test matrix row count

- Section header: `PRD.md:944` — `### Manual test matrix`
- First data row: `PRD.md:948` — `| 1 | ...`
- Last data row: `PRD.md:979` — `| 32 | ...`
- **32 data rows**, numbered #1–#32, sequential with no gaps.

## Part 3 — README.md markdownBareAtImports config section

Section: `### Optional: bare-@ markdown imports`, begins at **`README.md:88`** (content spans 88–117).

### (1) Both config forms documented? YES
- `README.md:92` — introduces both forms
- `README.md:94–97` — dedicated file example
- `README.md:98–104` — settings.json namespaced-key example

### (2) All four precedence locations listed? YES
- `README.md:106–111` — four sources in precedence order, with merge semantics at 106

### (3) Trust gate mentioned? YES
- `README.md:110–111` — both project sources marked "trusted project only"
- `README.md:113` — explicit statement

### (4) Depth-uniform resolution mentioned? YES
- `README.md:115` — "This is uniform at every depth..."

### README config-section verdict
Complete and internally consistent with PRD §4.6. **No gaps found.**

## Summary
| # | Question | Finding |
|---|---|---|
| 1 | PRD "24 test cases" | `PRD.md:1189` — stale; should be 32. Only stale count in file. |
| 2 | §11 row count | 32 rows, #1–#32, no gaps. |
| 3a | README both forms? | Yes |
| 3b | README four locations? | Yes |
| 3c | README trust gate? | Yes |
| 3d | README depth-uniform? | Yes |

**Single actionable defect:** `PRD.md:1189` — "all 24" → "all 32".
