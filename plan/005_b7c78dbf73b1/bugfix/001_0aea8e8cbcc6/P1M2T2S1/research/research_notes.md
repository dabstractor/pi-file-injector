# Research Notes — P1.M2.T2.S1 (bugfix 001)

**Item:** Sweep README.md + overview docs for consistency with the verbatim-on-error fix (Mode B docs task).
**Plan:** plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6

## What the bugfix changed (so the doc review has ground truth)

- **Issue 1 (the bug):** A markdown TRANSITIVE import whose target EXISTS (stat OK, isFile OK) but is
  UNREADABLE (EACCES / I/O error on the file itself) had its `#@`/`@` marker silently STRIPPED to a bare path
  inside the parent markdown's emitted block — no `<file>` block appended, no error. This violated the explicit
  "leave verbatim on error" guarantee.
- **Fix P1.M1.T1.S1 (LANDED, commit 342bd73):** `injectMarkdown` Step 3.5 now gates marker stripping on
  READABILITY via `await fs.access(r.abs, fs.constants.R_OK)` (after `stat`+`isFile`, inside the existing
  try/catch). An unreadable import is dropped from `injectable` → marker stays verbatim, no recursion, no block.
  Behavior-change table (code_changes_analysis.md): missing/dir/readable-text/md/binary/image-resize-OK all
  BYTE-FOR-BYTE unchanged; ONLY "exists + unreadable" flips (stripped → verbatim).
- **Fix P1.M1.T1.S2 (LANDED, commit 4d76d00):** `injectFile` catch now `state.injectedSet.delete(abs)` on
  failure → `claim ⟺ delivered` (no poisoning of the dedup set on a failed read/resize).
- **Verified current code state** (file-injector.ts L837-854): the Step 3.5 comment is COMPREHENSIVE — it
  documents READABILITY gating (PRD §5.4/§10/§12.5), the pre-order emit/strip asymmetry, AND the ACCEPTED NARROW
  RESIDUAL (a READABLE image whose `resizeImage` THROWS — not returns null — still gets stripped; out of scope;
  backstopped by injectFile try/catch) + TOCTOU. So the residual is ALREADY in the code comment (S1 did this).
- **Suite:** GREEN at **122 passed, 0 failed** (E5 = R_OK regression; E6 = un-claim; T2.S1-f isolated).

## Doc surface inventory (what exists)

- `README.md` — the ONLY user-facing doc (~9.3 KB). NO `docs/` dir, NO CHANGELOG. This is the sweep target.
- `PRD.md` — READ-ONLY (never modified by this task or any task).
- `plan/.../bugfix/.../architecture/{system_context,code_changes_analysis,test_harness_analysis}.md` — internal
  PLANNING artifacts (already accurate; owned by the plan; NOT user-facing; no sweep needed).

## README.md — line-by-line analysis vs. the FIXED code + PRD §5.4/§10/§12.5/§12.16

**README L52 (the "What gets injected" table, 4th row):**
`| Missing file, directory, or permission error | Left as written. Nothing is appended. |`
- ✓ CORRECT after the fix. The table is GENERAL (all injection contexts — top-level prompt + markdown transitive).
  The fix makes the markdown-import UNREADABLE case COMPLY with this row (was stripped → now verbatim).
- No qualifying footnote needed: the table already says "permission error → Left as written"; the fix extends
  compliance to the markdown path that previously violated it. PRD §10 row "Read throws (permissions) | Caught;
  token left verbatim" + §5.4 + §12.5 + §12.16 all say the same. The code now matches the docs.

**README L58-59 (markdown-import paragraph, right after the table):**
`A delivered markdown file (.md or .markdown) is also scanned for relative #@ imports. Each import it references
is delivered as its own block, and is scanned in turn if it is also markdown — so a single #@spec.md can pull in
a whole tree of docs. The same file-type rules (text / image / binary / missing) apply to each import unchanged.`
- ✓ NOT inaccurate. "The same file-type rules ... apply to each import unchanged" SUBSUMES the full L52 table
  (including the "Missing file, directory, or permission error" row). So the permission-verbatim guarantee DOES
  apply to transitive imports, via this sentence.
- The parenthetical "(text / image / binary / missing)" is an INFORMAL ABBREVIATION of the 4 table categories
  (Text / Image / Other binary / Missing-file-dir-permission → "missing"). It omits "directory/permission" from
  the abbreviation but "the same file-type rules apply unchanged" covers them. **This is the ONE candidate
  tightening** (OPTION B below): make the transitive permission-parity explicit, e.g. "(text / image / binary /
  missing or unreadable)". Borderline — purely cosmetic/explicitness, not a correctness fix.

**README L82-84 (Markdown imports — the 5 rules):**
- Rule 1: Relative paths only (absolute/tilde ignored → verbatim). Rule 2: Extension shorthand. Rule 3: Code is
  the escape hatch. Rule 4: Each file injected at most once (dedup, cycles terminate). Rule 5: Shared budget.
- ✓ NONE of these describe or imply the error/permission path. They cover matching + resolution + dedup + budget.
  The "leave verbatim on error" behavior is covered by L52+L59 (which the rules don't contradict). No rule implies
  a markdown import of an unreadable file would be stripped.

**README L103-111 (bare-@ markdown imports):**
- L103: "When it's on, a bare @api.md inside a delivered markdown file imports exactly like #@api.md: relative-
  only paths, extension shorthand, code-exempt, deduped against everything else, and drawing on the same shared
  budget." → "imports exactly like #@api.md" INHERITS all #@ error behavior (incl. unreadable → verbatim).
- L111 (Limits): "Markdown imports are relative-only." / "Only markdown is scanned." / "Bare-@ imports stay
  inside markdown." — none describe the error path.
- ✓ No inaccuracy. Same borderline enumeration-omission as L59 (lists matching/resolution/dedup/budget, not the
  error case) but "imports exactly like #@api.md" covers it.

## CONCLUSION: README is already consistent with the fixed code

- L52 explicitly guarantees "permission error → Left as written"; L59 says "the same file-type rules apply to each
  import unchanged" — so transitive imports inherit the permission-verbatim guarantee. The fix makes the code
  COMPLY; it introduces NO new user-facing behavior or config.
- **Expected outcome (per the item contract): NO README edit. Record the "docs already correct" decision.**
- **Optional minimal edit (only if the implementer judges explicitness adds value):** tighten L59's parenthetical
  to name the permission/unreadable case for transitive parity. Exact before/after captured in the PRP.
- **resizeImage-throw residual:** RECOMMEND NOT surfacing in README (internal detail; resizeImage is contractually
  null-on-failure, a throw is an unexpected internal error not a user workflow; surfacing would confuse the happy-
  path reader). It is ALREADY documented in the Step 3.5 code comment (file-injector.ts L848-854, by S1). The item
  contract (§3c) explicitly says: if a one-line note adds value, add it to the CODE COMMENT (already done), NOT the
  README.

## PRD.md cross-references (the spec the docs must match — all ALREADY say the now-correct behavior)
- §10 row "Read throws (permissions) | Caught; token left verbatim; other tokens still processed."
- §5.4 "Missing / directory / read error" → leave verbatim, no block.
- §12.5 "Never throw out of the handler… on any error leave the token verbatim."
- §12.16 "Strip resolved markers in both scopes… Failed/deduped/absolute/inside-code markers keep #@ verbatim everywhere."
None of these need editing (PRD is read-only); they confirm the docs were ALWAYS correct and the code now matches.

## No new behavior / no new config
This bugfix changes NO user-facing behavior and adds NO config. It makes the code match existing docs. So the doc
sweep's job is to CONFIRM consistency, not to document something new. (Contrast: the bare-@ feature WROTE new docs;
this bugfix does not.)

## Gates (the task is verification-shaped)
- `node ./file-injector.test.mjs` → 122 passed, 0 failed (unchanged — docs task doesn't touch code/tests).
- `git diff README.md` → EMPTY (primary: no edit needed) OR a 1-line minimal L59 tightening (optional fallback).
- `git diff PRD.md` → EMPTY (PRD is read-only; never modified).
- No typecheck/test change (docs-only; the suite is the regression guard that nothing broke).
