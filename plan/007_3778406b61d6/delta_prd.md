# Delta PRD (v007): PRD Done-definition test-count consistency fix

**Status:** Draft · **Parent PRD:** `PRD.md` (Pi `#@file` Whole-File Injection extension) · **Delta type:** **Documentation-only consistency fix — single token, already applied (see §2)**

---

## 1. What changed in the PRD (the diff)

Comparing the session-006 baseline snapshot (`plan/006_1862a6537500/prd_snapshot.md`) against the current `PRD.md`, **exactly one line changed** — confirmed by a full `diff` of the two 93,553-byte documents (exit code 1, one hunk: `1189c1189`):

| Location | Before (006 baseline) | After (current `PRD.md`) |
|---|---|---|
| `PRD.md:1189` — Appendix A, **Done-definition** | `... all **24** manual test cases in §11 pass; ...` | `... all 32 manual test cases in §11 pass; ...` |

That is the entire delta: the word `24` → `32` (and dropping the stray bold around the number). **Nothing else in the PRD moved** — §1–§14 and Appendix A are byte-identical otherwise.

**Why it was stale, not a real count change.** §11's manual test matrix already listed **32 rows (#1–#32, no gaps)** in *both* versions; only the Done-definition summary undercounted by 8. The only other `24` in the file (`PRD.md:971`, test-row index `| 24 | top-level no fallback |`) is a row index, not a count, and is correct — it must not be touched. (Identified by session-006 research: `plan/006_1862a6537500/architecture/research-doc-audit.md`.)

---

## 2. Scope & impact (why this is a no-op implementation delta)

- **No code change.** `file-injector.ts`, the three test files, `README.md`, `package.json`, `tsconfig.json` — none are touched by this delta. No function, type, constant, regex, config source, or pipeline stage is affected.
- **No new or modified requirement.** This is a documentation *consistency* fix to the PRD's own done-criteria summary, not a feature/spec change. Goals/Non-Goals (§2), syntax (§4), behavior (§5), format (§6), algorithm (§9), edge cases (§10), and the test matrix itself (§11) are unchanged.
- **Already applied in the working tree.** Current `PRD.md:1189` reads `all 32 manual test cases` (verified), matching the "Current PRD". Git history shows the fix landed in commit `1ad7b19 Correct PRD Done-definition test count`. The 006 baseline snapshot predates that commit, which is why the diff surfaces it.

**Net delta:** one token in one doc line. No implementation work is required or possible — the change is a string correction in a markdown summary.

---

## 3. Documentation impact

- **Mode A (doc-with-work):** **none.** There is no code work for docs to ride along with.
- **Mode B (changeset-level docs):** the change **is** the documentation fix — `PRD.md`'s own Done-definition. `README.md` and the `file-injector.ts` JSDoc were already audited as coherent with the spec in session 006 (`research-doc-audit.md`, `research-config-and-resolution.md`) and are untouched by this delta. No further changeset-level doc sync is needed.

---

## 4. Remaining work (single confirmation gate)

Because the fix is already in `PRD.md`, the only legitimate work is a trivial **consistency confirmation** — verify the summary count now agrees with the matrix it summarizes. No test runs, no typecheck, no code edits are expected (and none should be manufactured).

**Acceptance — the delta is satisfied when:**
1. `PRD.md:1189` reads `all 32 manual test cases` (it does).
2. §11's manual test matrix contains exactly 32 numbered rows (#1–#32) — i.e. the Done-definition count equals the actual matrix row count.
3. No other `24`-as-a-test-count reference exists anywhere in `PRD.md` (the `| 24 |` row index at line 971 is expected and correct).

If both checks hold (they do as of this writing), the delta is complete with **zero file edits**. The only failure mode would be a regression that re-stales the count, in which case the single fix is `24` → `32` at `PRD.md:1189`.
