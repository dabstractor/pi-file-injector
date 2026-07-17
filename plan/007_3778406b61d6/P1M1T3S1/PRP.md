---
name: "P1.M1.T3.S1 (plan/007) — Verify README.md has no stale test-count or feature references"
prd_ref: "v007 delta (documentation-only PRD Done-definition fix 24→32, already-applied commit 1ad7b19, zero code changes); PRD §1 Overview (h2.0), §2 Goals & Non-Goals (h2.1), §8 File Structure (h2.7); architecture/system_context.md (README structure + feature checklist); architecture/delta_analysis.md (zero-scope contract); plan/006 audit (research-doc-audit.md, prior README coherence confirmation)"
target_file: "(NONE — VERIFICATION-ONLY subtask. Reads README.md in full and reports PASS. Edits README.md ONLY if a genuine stale test-count reference is found, which research confirms does NOT exist. file-injector.ts, the 3 test files, package.json, tsconfig.json, PRD.md, validate.sh are all untouched.)"
target_language: "Markdown (the README under review) + the verification agent's pass/confirm report"
depends_on: "NONE for execution (README.md is complete and was audited coherent in session 006). Sibling P1.M1.T1.S1 (Done-def=32 + matrix=32 — Complete) and P1.M1.T1.S2 (no other stale-24 in PRD.md — Complete) provide the doc-consistency context this task is consistent with; P1.M1.T2.S1 (validate.sh regression gate — Implementing, parallel) is the independent code half. Neither is a dependency for T3.S1's read-only check."
consumed_by: "NONE downstream. T3.S1 is the README coherence gate for the v007 delta; P1.M1.T3.S2 (PRD.md internal consistency) is an independent read-only gate."
---

# PRP — P1.M1.T3.S1: Verify README.md has no stale test-count or feature references

> **Scope flag:** This is a **VERIFICATION-ONLY / Mode B doc-sweep subtask**, NOT implementation. The v007
> delta is documentation-only (PRD.md Done-definition `24 → 32`, commit `1ad7b19`, already-applied, **zero
> code changes** — per `architecture/delta_analysis.md` + `architecture/system_context.md`). The count fix
> lives **exclusively in `PRD.md:1189`**; README.md does not reference that prose at all. This subtask reads
> README.md (136 lines, user-facing) and confirms it is coherent with the PRD's current spec and the shipped
> features. **Expected outcome: PASS — README.md is clean; NO edits** (item §4 OUTPUT: "No edits expected").
> README.md is edited ONLY if a genuine stale test-count reference is found (item §3: "unlikely") — which
> research confirms does **not** exist.

---

## Goal

**Feature Goal:** Confirm `README.md` (136 lines, 9 sections) has **no stale test-count reference** and is
**coherent with the current PRD spec and the implemented features** after the v007 documentation-only delta.
Concretely, assert three things (item §3 LOGIC):
- **(a)** No mention of a specific test-case count (e.g. "24 tests" or "32 tests") that would now be stale.
- **(b)** No contradiction with PRD.md's current spec.
- **(c)** The syntax/behavior descriptions match the implemented features.

**Deliverable:** A pass/confirm report for each assertion (a/b/c) plus a `git status` confirming README.md
was **not modified**. **No edits expected** (item §4). If — and only if — a genuine stale reference is found
(research says it won't be), fix that one token; otherwise leave README.md byte-for-byte unchanged.

**Success Definition:** All three assertions pass; `git status --short README.md` is empty (read-only check
did not widen scope); the report states "README.md is consistent — no edits required." If a stale reference
were found, exactly that token is fixed and nothing else.

## Why

- **Closes the README half of the v007 doc-sweep.** The delta's only change is a count in PRD.md prose.
  PRD-side consistency is handled by T1.S1 (Done-def=32 + matrix=32) and T1.S2 (no other stale count). The
  code half is T2.S1 (validate.sh regression). **T3.S1 confirms the README — the user-facing overview doc —
  doesn't reference the changed count and stays coherent** with the spec and the shipped code.
- **README.md is a known-stable artifact.** It was last meaningfully authored in session 006, where a
  read-only audit (`plan/006_1862a6537500/architecture/research-doc-audit.md` Part 3) already confirmed its
  most complex section (`### Optional: bare-@ markdown imports`) is complete and internally consistent with
  PRD §4.6. The v007 delta touched zero README content, so it is expected to remain coherent.
- **The count is inapplicable to README.md by construction.** README.md is user-facing prose (install,
  usage, syntax, limits); it deliberately does not cite test counts or the §11 matrix. So the 24→32 fix has
  nothing in README.md to invalidate. This task verifies that invariant holds.

## What

No user-visible, API, config, code, or doc change is expected (verification only). The deliverable is a
pass/confirm report. README.md is read in full; three assertions are checked; README.md is left unchanged
unless a genuine stale reference surfaces.

### Success Criteria

- [ ] **(a)** `grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md` returns **NO output**
      (no test-count reference in README.md → nothing can be stale).
- [ ] **(b)** A full read of README.md (136 lines) shows **no contradiction** with PRD §1 Overview (h2.0),
      §2 Goals & Non-Goals (h2.1), or §8 File Structure (h2.7) — every README claim traces to a PRD selector.
- [ ] **(c)** Every behavior the README describes maps to an ✅ row in `architecture/system_context.md`'s
      "Feature checklist (PRD → code — ALL IMPLEMENTED)" — README describes nothing unimplemented.
- [ ] `git status --short README.md` is **empty** (the check was read-only; README.md unchanged). *(If a
      genuine stale reference was found and fixed, exactly one token changed and the success criterion is
      "exactly the stale token fixed, nothing else.")*
- [ ] No edit to PRD.md, file-injector.ts, any `.test.mjs`, package.json, tsconfig.json, validate.sh, or
      `scripts/typecheck.mjs` (`git status` clean for all of them — this task touches none).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives: the exact README structure with verified line anchors (9 sections,
136 lines), the exact grep command for assertion (a) and its verified-empty result, a claim-by-claim
consistency table mapping every README assertion to a PRD selector (assertion b) and to an implemented-code
row (assertion c), the session-006 audit that already confirmed README coherence, the binding zero-scope
guard (delta_analysis §Risk), and the explicit "PASS = no edit" outcome. The executing agent reads one file,
runs one grep, checks three assertions, and reports — editing nothing (unless the unexpected stale-reference
branch fires, which has a defined one-token fix protocol).

### Documentation & References

```yaml
# MUST READ — the artifact under review (read it in FULL first)
- file: ./README.md
  why: "The file this subtask verifies. 136 lines, 9 sections (see structure below). Read end-to-end to
        perform assertions (a)/(b)/(c). It is user-facing prose: install, usage, syntax, limits, the
        bare-@ option, and `#@` vs `@`. It does NOT cite test counts or the §11 matrix."
  pattern: "Headings: `# `#@file`` / `## Why` / `## Install` / `## Usage` / `## What gets injected` /
            `## Syntax` / `### Optional: bare-@ markdown imports` / `## Limits` / `## `#@` versus `@``."
  gotcha: "Do NOT rewrite or 'improve' README sections. The verification is read-only; the expected outcome
           is PASS with no edit (item §4). Editing README.md to 'tighten wording' WIDENS SCOPE and violates
           the delta contract (delta_analysis §Risk)."

# MUST READ — the zero-scope contract that binds this subtask
- file: plan/007_3778406b61d6/architecture/delta_analysis.md
  why: "Confirms the v007 delta is documentation-only (PRD.md:1189 `24→32`, commit 1ad7b19, already-applied);
        zero code change; net delta = one token in one doc line. §Risk: 'Any edit to file-injector.ts, tests,
        README.md, or package.json would widen scope and violate the delta's contract.' This is why T3.S1's
        default outcome is PASS / no-edit."

# MUST READ — the README structure + the implemented-feature checklist (assertion c source)
- file: plan/007_3778406b61d6/architecture/system_context.md
  why: "'What exists' documents README.md (136 lines, user-facing). 'Feature checklist (PRD → code — ALL
        IMPLEMENTED)' marks every feature ✅ in file-injector.ts (1114 lines) — this is the reference for
        assertion (c): every README behavior must map to an ✅ row. 'Session 007 delta' confirms the count
        fix is PRD.md-only and already-applied."

# MUST READ — the prior README coherence audit (the baseline this task re-confirms)
- file: plan/006_1862a6537500/architecture/research-doc-audit.md
  why: "Part 3 already audited README.md's most complex section (`### Optional: bare-@ markdown imports`,
        README.md:88–117) against PRD §4.6 and found it complete + internally consistent (both config forms,
        4 precedence sources, trust gate, depth-uniform — all YES). Its only actionable defect was
        PRD.md:1189 (now fixed). No README defect was found. T3.S1 re-confirms that state is unchanged."
  section: "## Part 3 — README.md markdownBareAtImports config section"

# REFERENCE — the PRD selectors (the spec README.md must not contradict; assertion b)
- file: PRD.md
  why: "§1 Overview (h2.0): Solution + Value prop (unconditional delivery, paged delivery, markdown imports,
        extension shorthand, bare-@ opt-in). §2 Goals & Non-Goals (h2.1): the 7 goals + non-goals (relative-
        only imports, non-markdown inert, no top-level shorthand, dedup, shared budget). §8 File Structure
        (h2.7): file-injector.ts + package.json manifest. Cross-check every README claim against these."
  critical: "The README is USER-FACING and more concise than the PRD — its simplifications are fine as long
             as they are not WRONG. The claim-by-claim table in the research notes (§2b) is the reference."

# REFERENCE — the sibling doc-consistency gates (context, not dependencies)
- file: plan/007_3778406b61d6/P1M1T1S1/PRP.md
  why: "T1.S1 (Complete): Done-definition reads '32' + §11 matrix has exactly 32 rows. Establishes the
        doc-consistency baseline T3.S1's README check is consistent with."
- file: plan/007_3778406b61d6/P1M1T2S1/PRP.md
  why: "T2.S1 (Implementing, parallel): the code-regression half (validate.sh). Independent of T3.S1; both
        are read-only/run-only gates that share the v007 verification goal."

# EXTERNAL — n/a. README verification is plain text review; no library docs needed.
```

### Current Codebase tree (the file under review)

```bash
pi-file-injector/
├── README.md                 # ← READ IN FULL (136 lines, 9 sections). Edit ONLY if a stale count is found.
├── PRD.md                    # READ-ONLY reference for assertion (b); UNTOUCHED by this subtask.
├── file-injector.ts          # UNTOUCHED (assertion c is cross-checked via system_context.md, not by editing).
├── file-injector.test.mjs    # UNTOUCHED
├── relative-imports.test.mjs # UNTOUCHED
├── import-behavior.test.mjs  # UNTOUCHED
├── package.json              # UNTOUCHED
├── validate.sh               # UNTOUCHED (that's T2.S1's gate, not T3.S1's)
└── plan/007_3778406b61d6/
    ├── architecture/system_context.md   # ← feature checklist (assertion c) + README structure
    ├── architecture/delta_analysis.md   # ← the zero-scope contract (§Risk)
    └── P1M1T3S1/
        ├── research/research_notes.md   # ← first-hand verification + claim-by-claim table
        └── PRP.md                         # (this file)
```

### README.md structure (verified line anchors — read the file FIRST)

```text
L1   # `#@file`                              # title + intro (paged-delivery phrasing)
L5   ## Why                                  # 3 paragraphs (incl. "spec-and-its-dependencies" line)
L13  ## Install                              # pi install / pi remove
L21  ## Usage                                # examples + marker-strip + markdown-import example + completion
L45  ## What gets injected                   # 4-row table + markdown-scan note + <file> block-format + images
L66  ## Syntax                               # grammar + **Where/Trailing/Paths** + **Markdown imports:** (5 rules)
L88  ### Optional: bare-`@` markdown imports # §4.6 config (both forms, 4 precedence sources, trust gate, depth)
L119 ## Limits                               # 9 bullets
L131 ## `#@` versus `@`                      # 2 bullets + closing guidance
```

### Desired Codebase tree (files touched)

```bash
README.md   # UNCHANGED (expected). The verification is read-only. If a genuine stale count is found
            # (NOT expected — grep returns nothing), fix exactly that token; otherwise leave it byte-for-byte.
# No other file touched. (plan/ PRP/research artifacts are the only writes, and those belong to this session.)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — this is a VERIFICATION subtask. The DEFAULT outcome is PASS with NO EDIT (item §4: "No edits
#   expected"). Do NOT rewrite, restructure, or "tighten" README sections — that WIDENS SCOPE and violates
#   the delta contract (delta_analysis §Risk: "Any edit to … README.md … would widen scope").

# CRITICAL — README.md deliberately does NOT cite test counts. It is user-facing prose (install/usage/
#   syntax/limits). The 24→32 delta lives in PRD.md Done-definition prose (PRD.md:1189), which README.md
#   does not reference. So there is NOTHING in README.md to go stale. grep (assertion a) returns empty —
#   this is the expected, correct result, NOT a sign the grep is wrong.

# CRITICAL — the only permitted edit is a ONE-TOKEN fix to a genuine stale test-count reference, and ONLY
#   if grep (a) actually returns one. Research confirms it returns nothing, so the edit branch should never
#   fire. If you find yourself editing README.md, STOP and re-confirm the stale reference is real (not a
#   row index, a version number, or a byte-size like "~8 KB").

# GOTCHA — README.md contains numbers that are NOT test counts and must NOT be "fixed":
#   - "~8 KB" (the paged head size — a real byte size, correct, leave it).
#   - any line/section reference is an anchor, not a count.
#   - there are no "24"/"32"/"122"/"38"/"22"/"182" tokens in README.md at all (grep-verified).
#   If grep DID return a number, confirm it is a TEST COUNT (not a size/version/anchor) before touching it.

# GOTCHA — README "Five rules" under **Markdown imports:** (README.md:70-86) vs older "Four rules": the
#   README is CURRENT (session-006) — it includes the 5th rule "Extension shorthand" matching PRD §4.5/§5.6.
#   Do NOT "correct" five→four or four→five; five is correct and matches the PRD.

# GOTCHA — do NOT cross into PRD.md edits here. PRD internal consistency is P1.M1.T3.S2 (a separate, planned
#   read-only gate). T3.S1 is README-only. If you spot a PRD issue, note it in the report — do not fix it
#   here (that's T3.S2's scope).

# LIBRARY — none. README verification is plain-text review + grep. No build, no runtime, no model, no network.
```

## Implementation Blueprint

> There is no implementation. This is the **verification runbook**. (Adapted from the implementation template
> since this subtask produces no code and — by design — no doc edit.)

### The claim-by-claim consistency reference (assertion b — read README.md, check each row)

| README claim (section) | PRD selector | Consistent? |
|---|---|---|
| `#@<path>` unconditional whole-file delivery (Why/Usage/Syntax) | h2.0 Solution | ✓ |
| Paged delivery: head + `read`-tool directive when oversize (Why/Table/Syntax/Limits) | h2.0 Solution, h2.1 Goal 1 (§5.5) | ✓ |
| Markdown transitive imports — same `#@` inside `.md`/`.markdown` (Why/Usage/Table/Syntax) | h2.0 Solution, h2.1 Goal 6 | ✓ |
| Extension shorthand `#@PRD` → `PRD.md`/`.markdown` (Syntax) | h2.0 Solution, h2.1 Goal 6 + Non-Goals | ✓ |
| Relative-only imports; resolve from md dir; abs/tilde ignored (Syntax/Limits) | h2.1 Goal 6 + Non-Goals | ✓ |
| Code is escape hatch (fenced/inline not an import) (Syntax) | h2.1 Goal 6 | ✓ |
| Each file injected at most once (dedup; cycles terminate) (Syntax/Why) | h2.1 Goal 6 | ✓ |
| Shared budget; imports page when running total exceeds window (Syntax) | h2.1 Goal 7 (§5.6.2) | ✓ |
| Non-markdown files are inert (only `.md`/`.markdown` scanned) (Limits) | h2.1 Non-Goals | ✓ |
| No top-level extension shorthand (top-level stays exact-match) (Limits) | h2.1 Non-Goals | ✓ |
| `markdownBareAtImports` opt-in, off by default, 4 sources, trusted-only project (Syntax §Optional/Limits) | h2.0 Value prop, h2.1 Goal 3/6 | ✓ |
| Bare-`@` imports stay inside markdown; never injected at prompt (Limits) | h2.1 Goal 6, Non-Goals | ✓ |
| File structure: `file-injector.ts` + `package.json` manifest (implied by Install) | h2.7 §8 | ✓ |

**Expected verdict: all rows ✓ — no contradiction.** (This table is reproduced from the research notes §2b,
where each row was verified first-hand against the PRD selectors.)

### Verification Tasks (ordered)

```yaml
Task 1: READ README.md IN FULL (all 136 lines)
  - WHY: assertions (b) and (c) require reading every section, not just grepping. Absorb the content so you
    can cross-check it against the PRD selectors and the feature checklist.
  - CONFIRM: the 9 sections + their line anchors match the structure table above (re-grep
    `grep -nE "^#{1,3} " README.md` if a prior edit shifted them — the ANCHOR is the heading text).

Task 2: ASSERTION (a) — stale test-count grep
  - CMD: grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md
  - EXPECT: NO output. (README.md has no test-count reference; the 24→32 delta is inapplicable to it.)
  - IF EMPTY → assertion (a) PASSES (nothing to go stale). This is the expected, correct result.
  - IF NON-EMPTY (NOT expected): examine each hit. If it is a genuine TEST-COUNT reference that is now stale
    (e.g. "24 tests"), apply the Edit Protocol below (one-token fix). If it is a byte-size ("~8 KB"), a
    version, an anchor, or a row index — it is NOT a test count; leave it and note why in the report.

Task 3: ASSERTION (b) — no PRD contradiction
  - READ: every README section against the PRD selectors h2.0 / h2.1 / h2.7.
  - USE: the claim-by-claim table above as the checklist. Every row should be ✓ (consistent).
  - EXPECT: no README claim contradicts any PRD selector. README is more concise (user-facing) but never wrong.
  - IF a contradiction is found (NOT expected): note it in the report. Do NOT rewrite the README section here
    unless it is the one-token stale-count case from Task 2 — a substantive rewording WIDENS SCOPE (delta
    contract). Flag it for a follow-up plan instead.

Task 4: ASSERTION (c) — behavior matches implemented features
  - CROSS-CHECK: each behavior the README describes against `architecture/system_context.md` "Feature
    checklist (PRD → code — ALL IMPLEMENTED)". Every described behavior must map to an ✅ row.
  - EXPECT: all ✅. README describes nothing unimplemented or speculative.
  - IF a README behavior is NOT in the checklist (NOT expected): note it — but do NOT edit README.md (that
    would be a scope change). The checklist is the reference of record; flag the discrepancy.

Task 5: VERIFY no scope was widened (git-clean)
  - CMD: git status --short README.md
  - EXPECT: empty (the check was read-only; README unchanged). If empty → the verification passed clean and
    the report is "README.md is consistent — no edits required."
  - ALSO: git status --short   # confirm NO edit to PRD.md, file-injector.ts, *.test.mjs, package.json,
            # tsconfig.json, validate.sh, scripts/typecheck.mjs. All must be absent (this task touches none).

### Edit Protocol (ONLY if Task 2's grep returns a genuine stale test-count — NOT expected)
# - Fix EXACTLY the stale token (e.g. "24 tests" → "32 tests"), mirroring the PRD.md:1189 fix.
# - Do NOT rewrite the surrounding sentence, section, or any other README content.
# - Do NOT touch PRD.md, file-injector.ts, tests, package.json, tsconfig.json, validate.sh.
# - Re-run Task 5: git status --short README.md should show ONLY the one-token change.
# - Note the fix + its justification in the report.
# (Research confirms this branch does NOT fire: grep (a) returns empty.)
```

### Implementation Patterns & Key Details

```bash
# The verification is THREE READS + ONE GREP + ONE git status. No edit is the success state.
#
# PATTERN — assertion (a) grep:
#   grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md
#   -i : case-insensitive (catches "Tests", "TEST").  -n : line numbers.  -E : extended regex.
#   The \b(24|32)\b with word boundaries avoids matching substrings; "test"/"cases"/"matrix"/"done-definition"
#   catch any prose reference to the test plan. Empty output = assertion (a) PASS.
#
# GOTCHA — do NOT use a grep that would false-positive on byte sizes. "~8 KB" is the paged head size
#   (README.md Limits) — it is correct and must NOT be edited. The grep above does NOT match "8" or "KB",
#   so it stays out of scope. If you broaden the grep, mentally filter sizes/versions/anchors.
#
# PATTERN — assertion (b)/(c): read README.md once, then walk the claim-by-claim table. Do NOT open a diff
#   tool against an old README snapshot — the README is the current-of-record; compare it to the PRD selectors
#   + the feature checklist, not to history.
#
# PATTERN — the report: state each assertion's result (a PASS / b PASS / c PASS), the grep output (empty),
#   and `git status --short README.md` (empty). That four-line report IS the deliverable.
```

### Integration Points

```yaml
NO CHANGES (verification only): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited (expected). README.md is READ; PRD.md is READ for cross-check; system_context.md is
    READ for the feature checklist. The only write is the PRP/research in plan/ (this session's artifacts).
```

## Validation Loop

### Level 1: The stale-count grep (assertion a)

```bash
cd /home/dustin/projects/pi-file-injector
grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md
# Expected: NO output (exit code 1 from grep = no match = the desired result).
# If empty → assertion (a) PASSES: README.md has no test-count reference, so nothing can be stale.
# If a line prints → examine it (see Task 2 / Edit Protocol). Research says this returns nothing.
```

### Level 2: Full-read coherence (assertions b + c)

```bash
# Read README.md end-to-end (136 lines). Then cross-check:
#   (b) every README claim → a PRD selector (h2.0 / h2.1 / h2.7) with no contradiction (claim-by-claim table).
#   (c) every README behavior → an ✅ row in system_context.md's feature checklist.
# Expected: all claims consistent; all behaviors implemented. No README content is stale or contradicted.
# Reference: plan/007_3778406b61d6/P1M1T3S1/research/research_notes.md §2b (the verified table) + §2c.
```

### Level 3: Scope discipline (git-clean — the proof the check was read-only)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short README.md
# Expected: EMPTY (README.md unchanged — the verification was read-only). This is the success state.
git status --short PRD.md file-injector.ts file-injector.test.mjs relative-imports.test.mjs import-behavior.test.mjs package.json tsconfig.json validate.sh scripts/typecheck.mjs
# Expected: EMPTY (this task touches none of them).
#
# (If the Edit Protocol fired for a genuine stale count — NOT expected — then `git status --short README.md`
#  shows exactly the one-token change and NOTHING else. That is the only permitted non-empty result.)
```

### Level 4: Cross-check against the prior audit (optional belt-and-suspenders)

```bash
# The session-006 audit already confirmed README.md coherence (esp. the bare-@ config section). Re-confirm
# the most error-prone section is still intact:
cd /home/dustin/projects/pi-file-injector
sed -n '88,117p' README.md | grep -E "markdownBareAtImports|trusted project only|every depth|settings.json|file-injector.json"
# Expected: hits for the config key, both file forms, the trust gate, and depth-uniform — confirming the
# §4.6 section is still complete (matches research-doc-audit.md Part 3). This is optional; Level 1-3 are the gate.
```

## Final Validation Checklist

### Technical Validation

- [ ] `grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md` → **no output** (assertion a PASS).
- [ ] Full read of README.md (136 lines): every claim traces to a PRD selector, no contradiction (assertion b PASS).
- [ ] Every README behavior maps to an ✅ row in `system_context.md`'s feature checklist (assertion c PASS).
- [ ] `git status --short README.md` → **empty** (read-only check; README unchanged).

### Scope-Discipline Validation (the binding constraint)

- [ ] `git status --short` shows NO edit to PRD.md, file-injector.ts, any `.test.mjs`, package.json,
      tsconfig.json, validate.sh, or scripts/typecheck.mjs.
- [ ] README.md was NOT rewritten/restructured/"tightened" — only the one-token stale-count Edit Protocol
      (if it fired, which it doesn't) is permitted. Default = no edit.
- [ ] No PRD.md edit made here (PRD consistency is T3.S2's scope; T3.S1 is README-only).

### Feature Validation

- [ ] README's 9 sections all present and intact (re-grep headings if unsure).
- [ ] README "Five rules" under **Markdown imports:** still reads "Five" (current; matches PRD §4.5/§5.6).
- [ ] No stale size phrases ("no size limit" / "entire contents no truncation") — README is plan-002-current.

### Documentation

- [ ] Report states each assertion's result (a PASS / b PASS / c PASS) + the grep output + git status.
- [ ] If (unexpectedly) a stale reference was fixed: the one-token change + justification is documented.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit README.md by default.** The expected outcome is PASS with NO edit (item §4: "No edits
  expected"). The verification is read-only. Editing README.md to "improve" or "tighten" wording WIDENS SCOPE
  and violates the delta contract (delta_analysis §Risk).
- ❌ **Do NOT touch PRD.md, file-injector.ts, tests, package.json, tsconfig.json, validate.sh, or
  scripts/typecheck.mjs.** This task touches NONE of them. PRD internal consistency is T3.S2's scope; the
  regression gate is T2.S1's. T3.S1 is README-only.
- ❌ **Do NOT mistake a non-count number for a stale test count.** "~8 KB" (paged head size), version numbers,
  and line anchors are NOT test counts — leave them. The grep for assertion (a) deliberately excludes them.
- ❌ **Do NOT rewrite a README section if you find a contradiction.** A substantive rewording WIDENS SCOPE.
  Note the contradiction in the report; flag it for a follow-up plan. The ONLY permitted edit is the
  one-token stale-count fix (and only if grep (a) returns one — which it doesn't).
- ❌ **Do NOT widen the grep to "fix" a false perception.** If `grep -niE "\b(24|32)\b..."` returns nothing,
  that is the CORRECT result (README has no test counts), not a broken grep. Do not "broaden the search to be
  safe" and then edit a byte size you matched.
- ❌ **Do NOT add a test-count reference to README "for completeness".** README.md deliberately omits test
  counts (it is user-facing prose). Adding one would invent a future stale-reference risk AND widen scope.
- ❌ **Do NOT duplicate T3.S2's work.** T3.S1 verifies README.md only. If you spot a PRD internal-consistency
  issue, note it in the report — do not fix it here (that's T3.S2's read-only gate).
- ❌ **Do NOT re-run validate.sh as part of T3.S1.** That is T2.S1's regression gate (Implementing, parallel).
  T3.S1's deliverable is the README coherence report; it has no test-run step.

---

## Confidence Score: 10/10

This is a deterministic read-only verification, and the baseline is **already verified during research**: I
read README.md in full (136 lines, 9 sections), ran the assertion-(a) grep (it returned **no output**),
cross-checked every README claim against the PRD selectors h2.0/h2.1/h2.7 (all consistent — see the
claim-by-claim table), and confirmed every described behavior maps to an ✅ row in the feature checklist.
The session-006 audit already confirmed README coherence (esp. the §4.6 config section). The v007 delta
touched zero README content. **Expected result: PASS — README.md unchanged, `git status --short README.md`
empty.** The only residual is the (unexpected) stale-reference branch, which the Edit Protocol resolves as a
single one-token fix — but research confirms it does not fire. No design risk, no ambiguity, no code change.
