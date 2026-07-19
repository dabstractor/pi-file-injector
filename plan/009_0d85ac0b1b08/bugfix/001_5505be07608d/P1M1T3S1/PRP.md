---
name: "P1.M1.T3.S1 (bugfix 001_5505be07608d) — Review README.md for expanded-view multi-file documentation accuracy"
prd_ref: "bugfix PRD §h2.0 Overview (display-only bug; model delivery always correct), §h2.2/§h3.0 Issue 1 (the SEP-literal fix in computeDetailOffsets + §11 acceptance #34 'Both expand together on ctrl+o'), §h2.4 Testing Summary; architecture/system_context.md §'Documentation Surface' (README L41 already describes correct behavior; no CHANGELOG/docs dir)"
target_file: "(NONE expected — DOCUMENTATION REVIEW. Reads README.md and CONFIRMS accuracy. README.md is edited ONLY if a stale expanded-view/multi-file statement is found, which research confirms does NOT exist. PRD.md, file-injector.ts, the 3 test files, package.json, tsconfig.json, validate.sh are all untouched.)"
target_language: "Markdown (the README under review) + the reviewer's accuracy-confirmation note (commit message / PR description)"
depends_on: "P1.M1.T1.S1 (COMPLETE, LANDED b1f0727: the SEP literal fix '\\n\\n'→'\\n\\n' that restores correct ctrl+o expansion for every file). P1.M1.T2.S1 (COMPLETE: REND-MULTI-OFFSET unit test) + P1.M1.T2.S2 (Implementing, parallel: REND-MULTI-E2E integration test) are the regression coverage the docs review is consistent with. T3.S1 consumes the LANDED fix's outcome (correct expanded rendering) — it does not depend on the tests existing, but its 'now regression-tested' judgment is informed by them."
consumed_by: "NONE downstream. T3.S1 is the README coherence gate for the bugfix; it is a terminal documentation review."
---

# PRP — P1.M1.T3.S1: Review README.md for expanded-view multi-file documentation accuracy

> **Scope flag:** This is a **DOCUMENTATION REVIEW (Mode B)** subtask, NOT implementation. The v009 bugfix
> fixed a **display-only** bug: the `ctrl+o` expanded view corrupted every file's body after the first (a
> `"\\n\\n"`-vs-`"\n\n"` separator-literal typo in `computeDetailOffsets`, file-injector.ts L354). **The
> model-facing `message.content` was always correct** — the core "whole file reaches the model" contract held;
> only the TUI renderer's expanded offset-slice was wrong. T1.S1 fixed it (commit b1f0727, LANDED); T2.S1 +
> T2.S2 add regression coverage.
>
> This subtask reviews README.md and confirms its expanded-view / multi-file rendering statements are accurate
> now that the fix restored correct `ctrl+o` expansion for every file. **Expected outcome: README.md is ALREADY
> accurate → NO edits.** The contract (item §3) is explicit: *"do NOT add unnecessary documentation noise for
> a display-only bugfix that restores already-documented behavior."* The deliverable is a confirmation recorded
> in the commit message / PR description, with `git status` showing README.md untouched.

---

## Goal

**Feature Goal:** Confirm `README.md`'s statements about the expanded (`ctrl+o`) view and multi-file rendering
are **accurate** now that the T1.S1 SEP fix (LANDED b1f0727) restored correct per-file expansion. Concretely,
verify the three contract checkpoints (item §3):
- **(a) Line 41** — "Press `ctrl+o` to expand **any of them** to the full contents." (the load-bearing phrase:
  "any of them" = every file expands; pre-fix only file 0 was correct; post-fix all are.)
- **(b) Line 72** — "...**each** injected file renders as a green `read <path>` line … with `ctrl+o` to expand."
- **(c) Line 37** — the `Diff #@a.ts vs #@b.ts` example (no rendering claim to invalidate).

Then resolve the judgment call: README is accurate → **no edit** (confirm in commit/PR note). A bugfix/changelog
note is added ONLY if it adds real value, which the contract steers against for this display-only fix.

**Deliverable:** An accuracy-confirmation note (commit message / PR description) stating lines 41 + 72
accurately describe the restored behavior, with `git status` proving README.md (and all code/test/config files)
are **unchanged**. No edits expected (item §4 OUTPUT).

**Success Definition:** All three checkpoints verified accurate; the full README scanned for any other
expanded-view / rendering statement (none beyond L41/L72); `git status --short README.md` is **empty**; the
judgment call resolves to "no edit" with the documented rationale. *(If — unexpectedly — a stale claim were
found, the only permitted edit is a surgical rewording of that one sentence; research confirms none exists.)*

## Why

- **Closes the doc-coherence half of the bugfix.** The bug violated an explicit PRD §11 acceptance criterion
  (#34 "Both expand together on `ctrl+o`") for the multi-file case. T1.S1 fixed the code; T2.S1/T2.S2 lock the
  fix with tests. **T3.S1 confirms the user-facing README never stopped promising the correct behavior** —
  meaning the fix makes reality match the docs, rather than requiring a doc change.
- **The bug was display-only and transient.** README.md is a user-facing product doc. It documents the product's
  *behavior*, not its historical defects. The README's phrasing ("any of them", "each injected file … to
  expand") was always the *correct general statement*; the bug violated it, the fix honors it. There is nothing
  in the README to "correct" — and adding a "we fixed a display bug" note would document a defect users never
  saw documented in the first place (noise, per item §3).
- **No changelog surface exists.** There is no `CHANGELOG.md` and no `docs/` directory (verified via
  `system_context.md` §'Documentation Surface'). Inventing a changelog convention for a single display-only
  fix is scope creep the contract explicitly cautions against.

## What

No user-visible, API, config, code, or doc change is expected (review only). The deliverable is an accuracy
confirmation. README.md is read; the three checkpoints are verified; a full scan confirms no other
expanded-view statement exists; the judgment call resolves to "no edit."

### Success Criteria

- [ ] **(a)** Line 41 reads "Press `ctrl+o` to expand **any of them** to the full contents." and is **accurate**
      post-T1.S1 (every file expands correctly — the fix restored this; REND-MULTI-E2E locks it in).
- [ ] **(b)** Line 72 reads "...**each** injected file renders as a green `read <path>` line … with `ctrl+o`
      to expand." and is **accurate** post-T1.S1.
- [ ] **(c)** Line 37's `Diff #@a.ts vs #@b.ts` example makes no expanded-rendering claim → nothing to invalidate.
- [ ] A full scan of README.md (`grep -nE "ctrl\+o|expand|render|read <path>|read.*line"`) finds NO statement
      beyond L41/L72 that describes expanded/multi-file rendering, and none of them is stale.
- [ ] **Judgment call resolved:** README is accurate → **no edit**. The rationale (display-only bug; README
      documents behavior not defects; no CHANGELOG surface; "do NOT add documentation noise") is recorded in
      the commit message / PR description.
- [ ] `git status --short README.md` is **empty** (review was read-only; README unchanged).
- [ ] No edit to PRD.md, file-injector.ts, any `.test.mjs`, package.json, tsconfig.json, validate.sh, or
      `scripts/typecheck.mjs` (`git status` clean for all — this task touches none).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives: the exact README lines under review (41, 72, 37) with their verbatim
text and the per-line accuracy analysis, the full-README scan command and its expected (minimal) output, the
verified fact that no CHANGELOG/docs directory exists, the contract's explicit judgment-call steer ("do NOT
add documentation noise for a display-only bugfix that restores already-documented behavior"), the
T1.S1-dependency state (LANDED b1f0727 — so the documented behavior is real), the no-edit default with its
documented rationale, and the git-clean proof. The executing agent reads one file, runs one grep, checks three
lines, records a confirmation — editing nothing (the unexpected stale-claim branch has a defined one-sentence
surgical-reword protocol, but research confirms it does not fire).

### Documentation & References

```yaml
# MUST READ — the artifact under review (read it, focus on L37/L41/L72 + scan the rest)
- file: ./README.md
  why: "The file this subtask reviews. 148 lines. The expanded-view statements are at L41 ('Press ctrl+o to
        expand any of them to the full contents.') and L72 ('each injected file renders as a green read <path>
        line … with ctrl+o to expand.'). L37 is the 'Diff #@a.ts vs #@b.ts' Usage example (no rendering claim).
        Read end-to-end to confirm NO other expanded-view/multi-file/rendering statement exists."
  pattern: "User-facing product doc. Documents the product's BEHAVIOR (install/usage/syntax/limits), not its
            internal offset-computation or historical defects. Phrasing is the correct general statement
            ('any of them', 'each injected file'); the bug violated it, the fix honors it."
  gotcha: "Do NOT edit README.md. The default outcome is CONFIRMATION (no edit). The README's phrasing was
           always correct; the bug was a code defect that violated the documented behavior, now fixed. Editing
           the README to 'reflect the fix' is backwards — the docs were right, the code was wrong."

# MUST READ — the bug + fix + the Documentation Surface fact (the contract basis)
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/system_context.md
  why: "§'The Bug (Issue 1)' pins the root cause (file-injector.ts L354 SEP literal) and confirms the MODEL is
        unaffected (message.content always correct; only the renderer's expanded offset-slice was wrong).
        §'Documentation Surface' states verbatim: 'README.md line 41 … Already describes the correct behavior;
        the fix restores it.' and 'No CHANGELOG.md, no docs/ directory.' and 'The fix is internal (display-only
        offset computation); no public API changes.' This is the authoritative basis for the no-edit outcome."
  section: "## Documentation Surface"
  critical: "The bug was DISPLAY-ONLY. README documents behavior the model+renderer should exhibit; the model
             half was always correct, the renderer half is now fixed. There is no doc defect to correct."

# MUST READ — the bugfix PRD (the acceptance criteria the fix honors; the judgment-call steer)
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/prd_snapshot.md   # (or the selected_prd_content)
  why: "§h2.0 Overview confirms display-only + model-always-correct. §h2.2/§h3.0 Issue 1 cites PRD §6.3
        ('Expanded (ctrl+o): each file's full delivered text renders below its read line') and §11 test #34
        ('Both expand together on ctrl+o') — these are the behaviors README L41/L72 already describe. §h2.4
        Testing Summary is the regression-coverage context. The item description §3 contains the explicit
        steer: 'do NOT add unnecessary documentation noise for a display-only bugfix that restores
        already-documented behavior.'"
  critical: "README L41/L72 already satisfy §6.3 and §11 #34 in their phrasing. The fix makes the CODE meet
             what the DOCS already promise. No doc change is required to satisfy the acceptance criteria."

# REFERENCE — the LANDED fix (confirms the documented behavior is now real)
- file: plan/009_0d85ac0b1b08/P1M1T1S1/PRP.md
  why: "T1.S1 (COMPLETE, LANDED b1f0727): the SEP literal fix 'computed offsets now use a real two-newline
        separator matching blocks.join(\\n\\n)'. This is the dependency that makes README L41/L72 accurate in
        reality (not just on paper). T3.S1's review is valid because T1.S1 landed."

# REFERENCE — the sibling regression tests (context for the 'now regression-tested' judgment)
- file: plan/009_0d85ac0b1b08/P1M1T2S1/PRP.md
  why: "T2.S1 (COMPLETE): REND-MULTI-OFFSET unit test (crafts blocks, calls computeDetailOffsets manually)."
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/P1M1T2S2/PRP.md
  why: "T2.S2 (Implementing, parallel): REND-MULTI-E2E integration test (real handler chain, asserts each
        file's expanded body is exact). Together T2.S1+T2.S2 are the regression coverage. The 'should the README
        note this is now regression-tested?' judgment resolves to NO — the tests are the durable artifact; a
        README sentence adds no user value and ages poorly."

# EXTERNAL — n/a. README review is plain-text; no library docs needed.
```

### Current Codebase tree (the file under review)

```bash
pi-file-injector/                # HEAD ≥ b1f0727 (T1.S1 LANDED)
├── README.md                    # ← READ (148 lines). Confirm L41/L72/L37 accurate. Edit ONLY if a stale claim
│                                #   is found (research: none exists). Default = unchanged.
├── file-injector.ts             # UNTOUCHED (T1.S1 owns the SEP fix, LANDED; T3.S1 consumes its outcome)
├── file-injector.test.mjs       # UNTOUCHED (T2.S1/T2.S2 own the regression tests)
├── relative-imports.test.mjs    # UNTOUCHED
├── import-behavior.test.mjs     # UNTOUCHED
├── package.json / tsconfig.json # UNTOUCHED
├── validate.sh / scripts/typecheck.mjs  # UNTOUCHED
├── PRD.md                       # READ-ONLY reference
└── plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/
    ├── architecture/system_context.md   # ← §'Documentation Surface' = the no-edit basis
    └── P1M1T3S1/
        ├── research/research_notes.md   # ← first-hand line-by-line verification + judgment rationale
        └── PRP.md                         # (this file)
```

### README.md structure (verified — the lines under review)

```text
L1   # `#@file`                              # title + intro (model-delivery phrasing; always correct)
L5   ## Why / L13 ## Install / L21 ## Usage
L37     `Diff #@a.ts vs #@b.ts`              # ← checkpoint (c): Usage example; NO rendering claim
L41     "…Press `ctrl+o` to expand any of them to the full contents…"  # ← checkpoint (a): load-bearing phrase
L45  ## What gets injected                   # 4-row table + markdown-scan note + <file> block-format
L72     "…each injected file renders as a green `read <path>` line … with `ctrl+o` to expand…"  # ← checkpoint (b)
L78  ## Syntax / L100 ### Optional: bare-@ / L131 ## Limits / L143 ## `#@` versus `@`
```

### Desired Codebase tree (files touched)

```bash
README.md   # UNCHANGED (expected). The review is read-only. If a genuine stale expanded-view claim is found
            # (NOT expected — research confirms none), reword THAT one sentence to match restored behavior;
            # otherwise leave it byte-for-byte.
# No other file touched. (plan/ PRP/research artifacts are the only writes, and belong to this session.)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — the DEFAULT outcome is CONFIRMATION, not modification (item §3 + §4). README.md documents the
#   product's BEHAVIOR; the bug was a CODE defect that violated that behavior; the fix (T1.S1) makes reality
#   match the docs. There is no doc defect to correct. Editing README to "reflect the fix" is backwards.

# CRITICAL — do NOT add a bugfix/changelog note, a "now regression-tested" sentence, or a version entry to
#   the README. The contract explicitly steers against this: "do NOT add unnecessary documentation noise for
#   a display-only bugfix that restores already-documented behavior." The regression tests (T2.S1/T2.S2) are
#   the durable artifact; a README sentence adds no user value and ages poorly.

# CRITICAL — do NOT create a CHANGELOG.md or docs/ directory. The project ships neither (verified). Inventing
#   a changelog convention for a single display-only fix is scope creep.

# CRITICAL — do NOT conflate "the README is accurate" with "the README needs updating." The README's phrasing
#   ("any of them", "each injected file … to expand") was ALWAYS the correct general statement. Pre-fix the
#   CODE fell short of the docs; post-fix the code meets them. That is the fix's job, not the docs' job.

# GOTCHA — README contains model-delivery phrasing too (intro L2, Why, table). The bug NEVER touched
#   model delivery (message.content was always byte-correct). So those statements were accurate both pre- and
#   post-fix. Don't "review" them as if they could be stale — they can't (the bug was renderer-only).

# GOTCHA — if (unexpectedly) a stale claim WERE found, the only permitted edit is a SURGICAL rewording of
#   that one sentence (e.g. if it said "only the first file expands" — it doesn't). Do NOT rewrite a section,
#   do NOT touch PRD.md/code/tests/package.json. But research confirms no such claim exists.

# LIBRARY — none. README review is plain-text reading + grep. No build, no runtime, no model, no network.
```

## Implementation Blueprint

> There is no implementation. This is the **documentation-review runbook**. (Adapted from the implementation
> template since this subtask produces no code and — by design — no doc edit.)

### The per-line accuracy analysis (the reference for checkpoints a/b/c)

| Checkpoint | README line | Verbatim phrase | Pre-fix | Post-fix (T1.S1 LANDED) | Verdict |
|---|---|---|---|---|---|
| **(a)** | L41 | "Press `ctrl+o` to expand **any of them** to the full contents." | FALSE (only file 0 correct; ≥1 corrupted) | TRUE (every file expands correctly; REND-MULTI-E2E locks it) | **accurate — no edit** |
| **(b)** | L72 | "**each** injected file renders as a green `read <path>` line … with `ctrl+o` to expand." | FALSE (each renders a read line ✓, but expansion of ≥1 was corrupted) | TRUE (each renders + each expands correctly) | **accurate — no edit** |
| **(c)** | L37 | `Diff #@a.ts vs #@b.ts` | (no rendering claim) | (no rendering claim) | **no claim to invalidate** |

> Note on (b): the read-line (collapsed) rendering was **always correct** — the bug only corrupted the expanded
> *body* slice. So "each injected file renders as a green `read <path>` line" was always true; only the "with
> `ctrl+o` to expand" half was temporarily false for files ≥1. Post-fix both halves are true.

### Review Tasks (ordered)

```yaml
Task 1: CONFIRM the fix landed (the dependency — makes the review valid)
  - CMD: git log --oneline -1   # expect HEAD ≥ b1f0727 (T1.S1's SEP fix).
  - CMD: grep -n 'const SEP' file-injector.ts   # expect `const SEP = "\n\n";` (single-backslash, length 2).
  - WHY: if the fix isn't landed, README L41/L72 are aspirational, not accurate. (Not expected at HEAD ≥ b1f0727.)

Task 2: READ README.md IN FULL (148 lines), focus on L37 / L41 / L72
  - VERIFY (a) L41: "Press `ctrl+o` to expand any of them to the full contents." — accurate (every file expands).
  - VERIFY (b) L72: "each injected file renders as a green `read <path>` line … with `ctrl+o` to expand." — accurate.
  - VERIFY (c) L37: `Diff #@a.ts vs #@b.ts` — a syntax example, no rendering claim → nothing to invalidate.

Task 3: FULL SCAN for any OTHER expanded-view / multi-file / rendering statement
  - CMD: grep -nE "ctrl\+o|expand|render|read <path>|read.*line" README.md
  - EXPECT: hits ONLY at L41 and L72 (the two verified statements). No other expanded-rendering claim.
  - IF a hit elsewhere describes expanded/multi-file rendering AND is stale → apply the Edit Protocol (below).
    (Research: no such hit exists.)

Task 4: RESOLVE the judgment call → NO EDIT (the documented default)
  - RATIONALE (record in commit/PR note):
      1. README documents the product's BEHAVIOR; the bug was a CODE defect that violated it; T1.S1 makes
         reality match the docs. There is no doc defect to correct.
      2. The bug was display-only + transient (model delivery always correct). README never documented the
         defect, so there's nothing to "correct" — adding a "we fixed a display bug" note is noise.
      3. No CHANGELOG.md / docs/ directory exists (verified). Inventing a changelog is scope creep.
      4. The regression coverage (T2.S1 + T2.S2) is the durable artifact; a "now regression-tested" sentence
         adds no user value and ages poorly.
      5. Contract steer (item §3): "do NOT add unnecessary documentation noise for a display-only bugfix that
         restores already-documented behavior."
  - OUTCOME: README.md unchanged. Record the confirmation in the commit message / PR description.

Task 5: VERIFY the review was read-only (git-clean proof)
  - CMD: git status --short README.md   # expect EMPTY (README unchanged).
  - CMD: git status --short PRD.md file-injector.ts file-injector.test.mjs relative-imports.test.mjs
            import-behavior.test.mjs package.json tsconfig.json validate.sh scripts/typecheck.mjs
          # expect EMPTY (this task touches none of them).

### Edit Protocol (ONLY if Task 3 finds a genuine stale expanded-view claim — NOT expected)
# - Reword THAT one sentence so it matches the restored behavior (e.g. if it wrongly limited expansion to one
#   file, generalize it — though no such sentence exists).
# - Do NOT rewrite a section. Do NOT touch PRD.md/code/tests/package.json. Do NOT add a changelog/version note.
# - Re-run Task 5: `git status --short README.md` shows ONLY the one-sentence change.
# - Note the reword + justification in the report.
# (Research confirms this branch does NOT fire: the only expanded-view statements are L41/L72, both accurate.)
```

### Implementation Patterns & Key Details

```bash
# The review is ONE READ + ONE GREP + ONE git status. No edit is the success state.
#
# PATTERN — Task 3 scan grep:
#   grep -nE "ctrl\+o|expand|render|read <path>|read.*line" README.md
#   -n : line numbers.  -E : extended regex (ctrl\+o escapes the +). Catches every rendering-related phrase.
#   Expected output: L41 + L72 (the two verified statements). If anything else prints, examine it (Task 3).
#
# GOTCHA — do NOT use a grep so broad it matches the model-delivery phrasing and then "review" it as potentially
#   stale. The model-delivery statements (intro L2 "whole file reaches the model", table Text row, etc.) were
#   NEVER affected by the bug (message.content was always correct). They are accurate by construction. The scan
#   grep above targets RENDERING phrases (ctrl+o/expand/render/read line), which is the bug's domain.
#
# PATTERN — the commit/PR note (the deliverable): state each checkpoint's verdict (a accurate / b accurate /
#   c no-claim), the scan result (only L41/L72), the no-edit rationale (5-point list above), and that
#   `git status` confirms README.md untouched. That note IS the deliverable.
#
# PATTERN — judgment-call framing: the contract offers "add a note if it adds value." The review's job is to
#   decide it does NOT (here), with the documented rationale. Do NOT default to "add something to be safe" —
#   that violates the explicit "do NOT add documentation noise" steer.
```

### Integration Points

```yaml
NO CHANGES (review only): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited (expected). README.md is READ for review; PRD.md/system_context.md are READ for context.
    The only write is the PRP/research in plan/ (this session's artifacts) + the commit/PR note (prose, not a
    tracked source file).
```

## Validation Loop

### Level 1: The checkpoint verification (read README, check a/b/c)

```bash
cd /home/dustin/projects/pi-file-injector
sed -n '41p;72p;37p' README.md
# Expected: L41 contains "Press `ctrl+o` to expand any of them to the full contents."
#           L72 contains "each injected file renders as a green `read <path>` line … with `ctrl+o` to expand."
#           L37 contains "Diff #@a.ts vs #@b.ts"
# All three accurate (a/b describe restored behavior; c is a syntax example with no rendering claim).
```

### Level 2: The full-README scan (no other stale rendering statement)

```bash
cd /home/dustin/projects/pi-file-injector
grep -nE "ctrl\+o|expand|render|read <path>|read.*line" README.md
# Expected: hits ONLY at L41 and L72 (the two verified statements). No other expanded-view/multi-file claim.
# If a hit elsewhere describes expanded rendering AND is stale → Edit Protocol (research: none exists).
```

### Level 3: No-doc-noise confirmation (the judgment call)

```bash
# Confirm there is no CHANGELOG/docs surface to "update" (so the no-edit default is clean):
cd /home/dustin/projects/pi-file-injector
ls CHANGELOG.md docs 2>&1 | grep -i "no such" && echo "no changelog/docs dir (confirmed) — no-edit is correct"
# Expected: "no such file or directory" for both → there is nothing to append a fix note to.
# (This matches system_context.md §'Documentation Surface': 'No CHANGELOG.md, no docs/ directory.')
```

### Level 4: Scope discipline (git-clean — the proof the review was read-only)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short README.md
# Expected: EMPTY (README.md unchanged — the review was read-only). This is the success state.
git status --short PRD.md file-injector.ts file-injector.test.mjs relative-imports.test.mjs import-behavior.test.mjs package.json tsconfig.json validate.sh scripts/typecheck.mjs
# Expected: EMPTY (this task touches none of them).
#
# (If the Edit Protocol fired for a genuine stale claim — NOT expected — then `git status --short README.md`
#  shows exactly the one-sentence change and NOTHING else. That is the only permitted non-empty result.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `git log --oneline -1` shows HEAD ≥ b1f0727 (T1.S1's SEP fix LANDED — the review is valid).
- [ ] `grep -n 'const SEP' file-injector.ts` shows `const SEP = "\n\n";` (length 2; the fix).
- [ ] README L41 + L72 read as expected and are accurate (checkpoints a + b).
- [ ] README L37 is a syntax example with no rendering claim (checkpoint c).
- [ ] `grep -nE "ctrl\+o|expand|render|read <path>|read.*line" README.md` → only L41 + L72.

### Judgment-Call Validation (the binding decision)

- [ ] README is accurate → **no edit** (the documented default).
- [ ] The no-edit rationale is recorded in the commit message / PR description (5-point list).
- [ ] No CHANGELOG.md / docs/ directory was created (no scope creep).
- [ ] No bugfix/version/regression-tested note added to README (no documentation noise).

### Scope-Discipline Validation

- [ ] `git status --short README.md` → **empty** (review was read-only; README unchanged).
- [ ] `git status --short` shows NO edit to PRD.md, file-injector.ts, any `.test.mjs`, package.json,
      tsconfig.json, validate.sh, or scripts/typecheck.mjs.
- [ ] No PRD.md edit made here; no code/test edit (those are T1.S1/T2.S1/T2.S2's scopes).

### Documentation

- [ ] The commit/PR note states: lines 41 + 72 accurately describe the restored `ctrl+o` multi-file expansion;
      the full scan found no other expanded-view statement; README.md was left unchanged (display-only bug,
      already-documented behavior restored, no changelog surface, no documentation noise).
- [ ] (If unexpectedly a stale claim was found and reworded) the one-sentence change + justification is documented.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit README.md by default.** The expected outcome is CONFIRMATION (no edit). README documents the
  product's behavior; the bug was a code defect that violated it; T1.S1 makes reality match the docs. There is
  no doc defect to correct. Editing to "reflect the fix" is backwards.
- ❌ **Do NOT add a bugfix/changelog note, a "now regression-tested" sentence, or a version entry.** The contract
  explicitly steers against "documentation noise for a display-only bugfix that restores already-documented
  behavior." The regression tests are the durable artifact; a README sentence adds no user value and ages poorly.
- ❌ **Do NOT create a CHANGELOG.md or `docs/` directory.** The project ships neither (verified). Inventing a
  changelog convention for one display-only fix is scope creep.
- ❌ **Do NOT touch PRD.md, file-injector.ts, any test, package.json, tsconfig.json, validate.sh, or
  scripts/typecheck.mjs.** This task touches NONE of them. Code/test fixes are T1.S1/T2.S1/T2.S2's scopes.
- ❌ **Do NOT "review" the model-delivery phrasing as if it could be stale.** The bug never touched model
  delivery (`message.content` was always byte-correct). The intro/Why/table model-delivery statements were
  accurate both pre- and post-fix. The scan targets RENDERING phrases (the bug's domain), not delivery phrases.
- ❌ **Do NOT conflate "accurate" with "needs updating."** If L41/L72 are accurate (they are), the correct
  action is to confirm and move on — not to "strengthen" or "clarify" them. Rewording accurate prose widens scope.
- ❌ **Do NOT default to "add something to be safe."** The contract's judgment call resolves to NO here, with a
  documented rationale. Adding a note "in case it helps" violates the explicit "do NOT add documentation noise" steer.
- ❌ **Do NOT re-run the test suites as part of T3.S1.** That is T2.S1/T2.S2's regression-coverage scope. T3.S1's
  deliverable is the README accuracy confirmation; it has no test-run step.

---

## Confidence Score: 10/10

This is a deterministic read-only documentation review, and the baseline is **already verified during
research**: I read README.md in full (148 lines), verified line 41 ("expand **any of them**") and line 72
("**each** injected file … with `ctrl+o` to expand") are accurate post-T1.S1 (the fix restored correct
per-file expansion; REND-MULTI-E2E locks it in), confirmed line 37 is a syntax example with no rendering
claim, and scanned the whole README for any other expanded-view statement (none beyond L41/L72). The
`system_context.md` §'Documentation Surface' independently confirms "README.md line 41 … Already describes
the correct behavior; the fix restores it" and "No CHANGELOG.md, no docs/ directory." The contract's explicit
steer ("do NOT add unnecessary documentation noise for a display-only bugfix that restores already-documented
behavior") points squarely at **no edit**. **Expected result: PASS — README.md unchanged, `git status` clean.**
The only residual is the (unexpected) stale-claim branch, which the Edit Protocol resolves as a single
one-sentence surgical reword — but research confirms it does not fire. No design risk, no ambiguity, no code
or doc change.