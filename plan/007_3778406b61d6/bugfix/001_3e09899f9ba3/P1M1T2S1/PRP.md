---
name: "P1.M1.T2.S1 (bugfix 001) — Update README.md to note CRLF/Windows line-ending compatibility for markdown fenced code block detection"
prd_ref: "bugfix PRD §h3.0 Issue 1 (CRLF fence-close defect + Suggested Fix), §h2.4 Testing Summary (CRLF defense-in-depth); architecture/system_context.md §Documentation Surface"
target_file: "./README.md"   # EDIT IN PLACE — append one sentence to the 'Code is the escape hatch' bullet (line 84)
target_language: Markdown (user-facing doc; no code, no tests, no build)
depends_on: "P1.M1.T1.S1 (Complete — shipped the closeRe `\\r?` fix at file-injector.ts:496 making CRLF behave identically to LF) + P1.M1.T1.S2 (Ready/parallel — adds CC14-16 + CRLF-E2E regression coverage; edits file-injector.test.mjs ONLY, no README conflict)"
consumed_by: "(none — this is the terminal Mode B changeset-level documentation task for the CRLF bugfix; the fix is documented here for end users)"
---

# PRP — P1.M1.T2.S1: README.md note CRLF/Windows line-ending compatibility for fenced code detection

> **Scope flag:** This is the **Mode B changeset-level documentation sync** (item §5) for the CRLF fence-close
> bugfix. It edits **README.md ONLY** — appends ONE sentence to the existing "Code is the escape hatch" bullet
> in the `## Syntax` → "Markdown imports" block, noting that fenced-code detection is line-ending agnostic
> (Windows CRLF and Unix LF behave identically). The fix (P1.M1.T1.S1) and regression tests (P1.M1.T1.S2) are
> complete/landing. **No source code, no tests, no new sections/headings.** The note is a positive capability
> statement (the fix is backward-compatible and transparent — no caveat needed, per item §1).

---

## Goal

**Feature Goal:** Surface the now-fixed CRLF/Windows line-ending compatibility to README readers by adding one
brief sentence to the "Code is the escape hatch" bullet, so users know fenced-code-block detection works
identically across LF (Unix) and CRLF (Windows) markdown files.

**Deliverable:** Modified `./README.md` where line 84 (the "Code is the escape hatch." bullet) ends with one
appended sentence: "Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown
files detect code fences identically." Every other line of README.md is byte-for-byte unchanged.

**Success Definition:** `git diff README.md` shows exactly ONE line changed (the bullet gains one appended
sentence). `grep -niE "crlf|line.ending|carriage|windows" README.md` now matches the new sentence (was zero
matches). `node ./file-injector.test.mjs` stays green (README.md is not loaded by tests — sanity check only,
proving no source/test file was accidentally touched). No new section or heading added.

## User Persona

**Target User:** Pi end-user who authors markdown files with `#@` imports on Windows (CRLF default) or in
cross-platform repos (Git `core.autocrlf=true`, Office/Notion exports), and who needs to know fenced code
blocks are detected correctly regardless of line endings.

**Use Case:** A Windows user writes a `spec.md` (CRLF) containing a fenced code block followed by `#@api.md`.
Before the fix, `api.md` was silently dropped (the fence never closed → `#@` classified inCode → skipped).
After the fix + this doc note, the user knows CRLF works and `api.md` resolves.

**User Journey:** User reads the README Syntax section → "Code is the escape hatch" bullet → sees the new
sentence → knows they don't need to convert their Windows markdown to LF for fenced-code detection to work.

**Pain Points Addressed:** Before the fix, CRLF markdown with a code fence + a later `#@` import silently lost
the import (no error, no warning — the extension appeared to run but dropped post-fence references). The fix
(T1.S1) makes CRLF behave like LF; this note tells users that's the case so they trust cross-platform markdown.

## Why

- **User-facing discoverability for a shipped cross-platform fix.** The CRLF bugfix (T1.S1) is shipped and
  regression-tested (T1.S2). But the README — the only user-facing doc — said nothing about line endings
  (item §1: grep for crlf/line.ending/carriage/windows across README.md = zero matches). Users on Windows or
  in cross-platform repos had no signal that fenced-code detection now works for their files.
- **Reassurance, not a caveat.** The fix is backward-compatible and transparent: CRLF now behaves identically
  to LF. Item §1 is explicit: "no behavioral caveat is needed — just a brief positive note." The sentence tells
  users "this just works across line endings," matching the README's existing positive-tone bullets.
- **Completes the bugfix's documentation.** This is the only changeset-level doc task in the bugfix delta
  (item §5). Landing it leaves the README consistent with the shipped+tested behavior.

## What

A single sentence appended to one existing bullet in README.md. No user-visible/runtime behavior change
(README.md is documentation only — not loaded by any code or test).

### Success Criteria

- [ ] README.md line 84 (the "Code is the escape hatch." bullet) ends with the appended sentence:
      "Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect
      code fences identically."
- [ ] `git diff README.md` shows exactly ONE line changed (the bullet); no other line modified.
- [ ] No new section, heading, or bullet is added (item §3: "do NOT add a new section or heading").
- [ ] `grep -niE "crlf|line.ending|carriage|windows" README.md` matches the new sentence (was zero matches).
- [ ] `node ./file-injector.test.mjs` stays green (README not loaded by tests; this is a sanity check that no
      source/test file was accidentally touched).
- [ ] The other 4 Markdown-import bullets, the `## Syntax` intro, the `## Limits` section, the bare-`@`
      subsection, and every other README section are byte-for-byte unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes the exact current bullet text (line 84, quoted verbatim), the exact
one-sentence addition (wording given), the unique oldText anchor for the edit tool, the placement rationale
(this bullet, not Limits, because the note is a positive capability about how fenced code is detected —
exactly this bullet's subject), the grep-based post-edit verification, and the no-test-gate fact (README
isn't loaded by tests). The implementer makes one surgical append to one line, then runs a grep + a sanity
test suite.

### Documentation & References

```yaml
# MUST READ — the defect + fix this note documents (the "why" of the sentence)
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/prd_snapshot.md
  why: "§h3.0 Issue 1 documents the CRLF fence-close defect (closeRe `[ \\t]*$` failed on ` ```\\r ` → fence
        treated as unterminated → post-fence #@ silently dropped) + the Suggested Fix (tolerate trailing \\r).
        §h2.4 Testing Summary notes CRLF was the one defect found + requests defense-in-depth tests. The
        README sentence is the user-facing summary of 'this is now fixed and works cross-platform.'"
  section: "### Issue 1: CRLF line endings break fenced-code-block close detection + ## Testing Summary"
  critical: "The note is a POSITIVE capability statement (CRLF now works like LF), NOT a caveat. Item §1 is
             explicit: 'The fix is backward-compatible and transparent (CRLF now behaves identically to LF),
             so no behavioral caveat is needed — just a brief positive note.' Do NOT phrase it as a warning."

# MUST READ — the contract: S1 shipped the fix; S2 (parallel) adds tests; T2.S1 is the README note
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/P1M1T1S1/PRP.md
  why: "S1 = the closeRe `\\r?` one-liner at file-injector.ts:496 + CC12/CC13. S1 is Complete. T2.S1 documents
        S1's shipped behavior. No file conflict (S1=source; T2.S1=README)."
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/P1M1T1S2/PRP.md
  why: "S2 (parallel, Ready/Implementing) = CC14-16 + CRLF-E2E regression tests in file-injector.test.mjs.
        T2.S1 may cite S2's green CRLF coverage as evidence. S2 edits the TEST file ONLY — no README conflict."

# The file you edit (the ONLY change)
- file: README.md
  why: "136 lines. Line 84 = the 'Code is the escape hatch.' bullet (3rd of 5 bullets under the 'Markdown
        imports:' intro in ## Syntax). The note appends to THIS bullet (it's about how fenced code is detected,
        which is exactly this bullet's subject). Use the edit tool with the full current bullet as oldText
        (unique in README.md)."
  pattern: "The 5 Markdown-import bullets are dense one-liners: bold lead phrase, prose, backticked examples.
            Match that format — the appended sentence is one clause, no new formatting."
  gotcha: "Do NOT add a new bullet, heading, or section (item §3). Do NOT edit the other 4 bullets, the
           'Markdown imports:' intro, the ## Syntax section, ## Limits, or the bare-@ subsection. ONE sentence
           appended to ONE existing bullet. The 'Five rules narrow it:' intro count stays 'Five' (the note is
           part of an existing bullet, not a 6th bullet)."

# Confirmation README has NO existing line-ending mention (item §1 baseline)
- cmd: "grep -niE 'crlf|line.ending|carriage|windows' README.md   # pre-edit: zero matches (item §1)"
  why: "Proves the note fills a documentation gap. Post-edit this grep matches the new sentence (the
        verification signal that the append landed)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── README.md                 # ← THE ONLY FILE EDITED (line 84: append one sentence to the 'Code is the escape hatch' bullet)
├── file-injector.ts          # untouched (S1's closeRe fix at L496 is the source change; T2.S1 consumes it)
├── file-injector.test.mjs    # untouched (S2's CC14-16 + CRLF-E2E; parallel — no README conflict)
├── relative-imports.test.mjs # untouched (run for sanity; not edited)
├── import-behavior.test.mjs  # untouched (run for sanity; not edited)
├── package.json              # untouched
├── PRD.md                    # read-only
└── plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/
    ├── architecture/system_context.md              # ← §Documentation Surface (README has no line-ending mention)
    ├── prd_snapshot.md                             # ← §h3.0 Issue 1 (the defect+fix this note documents)
    ├── P1M1T1S1/{PRP.md}   # ← S1 (Complete): closeRe `\r?` fix + CC12/CC13
    ├── P1M1T1S2/{PRP.md}   # ← S2 (parallel): CC14-16 + CRLF-E2E
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← bullet text + placement rationale + verification (this subtask)
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
README.md    # MODIFIED — line 84: the 'Code is the escape hatch.' bullet gains one appended sentence.
# No other files. No new files. No source/test/package/config changes.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — ONE sentence appended to ONE existing bullet. Item §3 is explicit: "one brief sentence
     addition to an existing bullet — do NOT add a new section or heading." Do NOT add a new bullet, a new
     heading, or a new subsection. Do NOT edit any of the other 4 Markdown-import bullets. -->

<!-- CRITICAL — the "Five rules narrow it:" intro count STAYS "Five". The note is part of the existing
     "Code is the escape hatch." bullet (the 3rd of 5), not a 6th bullet. Do NOT change "Five" → "Six".
     (Unlike a new-bullet scenario, appending a sentence to an existing bullet does not change the bullet
     count.) -->

<!-- CRITICAL — the note is a POSITIVE capability statement, NOT a caveat. Item §1: "The fix is backward-
     compatible and transparent (CRLF now behaves identically to LF), so no behavioral caveat is needed —
     just a brief positive note." Do NOT phrase it as a warning/limitation (that would belong in ## Limits,
     which is the wrong section for a capability). Phrase it as "works across line endings" (positive). -->

<!-- GOTCHA — placement is the "Code is the escape hatch." bullet (README.md:84), NOT ## Limits. Item §3
     names this bullet explicitly and offers ## Limits only as an alternative. The bullet is the better
     fit: the note is about HOW fenced code blocks are detected (this bullet's subject), and it's a positive
     capability (Limits is for constraints). The implementing agent may choose Limits, but the bullet is the
     recommended primary placement. -->

<!-- GOTCHA — README.md is NOT loaded by file-injector.ts or any .test.mjs (the harnesses load file-injector.ts
     via jiti). So this doc edit CANNOT break any test. Running `node ./file-injector.test.mjs` after the edit
     is a SANITY check that you didn't accidentally touch a source/test file (git status should show only
     README.md), NOT a validation of the README content. -->

<!-- GOTCHA — match the README's bullet tone: dense one-liner, bold lead phrase, backticked examples, em dash
     for clauses. The appended sentence uses an em dash ("—") to attach to the bullet, consistent with the
     other bullets' style. Don't introduce a new paragraph break or formatting. -->
```

## Implementation Blueprint

### The exact README.md target bullet (verbatim, line 84)

```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
```

### The exact edit (one sentence appended)

**oldText** (the full current bullet — unique in README.md, safe edit anchor):
```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
```

**newText** (bullet + one appended sentence; item §3 suggested wording, em-dash-attached for tone consistency):
```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything. Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect code fences identically.
```

Only the one sentence is added; the rest of the bullet (and the entire rest of README.md) is untouched.

### Resulting bullet (for review)

```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything. Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect code fences identically.
```

### Why this wording (cross-check vs. the contract)

| Sentence clause | Source | Why it's accurate |
|---|---|---|
| "Fenced-code detection is line-ending agnostic" | bugfix PRD §h3.0 (the defect was in fence-CLOSE detection; the fix makes CRLF match LF) | The fix (T1.S1 `closeRe` `\r?`) is specifically in the fence-close path; after it, CRLF behaves identically to LF. |
| "Windows (CRLF) and Unix (LF) markdown files" | bugfix PRD §h3.0 Impact ("CRLF is the default line ending on Windows") + item §3 suggested wording | Names the two real-world cases users hit (Windows default; Unix/cross-platform). |
| "detect code fences identically" | T1.S1's fix: CRLF close-line now matches → fence closes → post-fence `#@` resolves (same as LF) | The user-visible outcome: no silent import drops on CRLF. |

The sentence does NOT mention CR-only (classic Mac, pre-2001) — that's an intentional scope boundary
documented in T1.S2's CC14 test, not a user-facing concern (CR-only is extinct). The README note covers the
two line-ending styles users actually have.

### Integration Points

```yaml
FILE_EDITS (README.md — exactly one sentence appended to one bullet):
  - line 84 (the "Code is the escape hatch." bullet): append " Fenced-code detection is line-ending agnostic
    — Windows (CRLF) and Unix (LF) markdown files detect code fences identically."

NO_CHANGES:
  - the other 4 Markdown-import bullets (Relative paths only / Extension shorthand / Each file once / Shared budget): UNCHANGED.
  - the "Markdown imports:" intro (incl. "Five rules narrow it:" — stays "Five"): UNCHANGED.
  - ## Syntax section, ## Limits section, bare-@ subsection, ## Why, ## Install, ## Usage, What-gets-injected, #@ vs @: UNCHANGED.
  - file-injector.ts, the 3 .test.mjs files, package.json, PRD.md, all plan/ files: UNCHANGED.

NO_CODE / NO_TESTS / NO_NEW_FILES: documentation only. README.md is not loaded by any code or test.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT README.md line 84 — append the one sentence to the 'Code is the escape hatch.' bullet
  - USE the edit tool with:
      oldText: "- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything."
      newText: "- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything. Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect code fences identically."
  - WHY this anchor: the full bullet line is unique in README.md (the bold lead "**Code is the escape hatch.**"
    appears once), so oldText matches exactly one line.
  - DO NOT: add a new bullet/heading/section. DO NOT edit any other bullet. DO NOT change "Five" → "Six".

Task 2: VERIFY — git diff scope + grep confirmation + sanity test (item §4)
  - RUN: `git diff README.md`
    EXPECT: exactly ONE line changed (the bullet, with the appended sentence). No other line touched.
  - RUN: `grep -niE "crlf|line.ending|carriage|windows" README.md`
    EXPECT: one match — the new sentence on line 84. (Pre-edit this was zero matches per item §1.)
  - RUN (sanity): `node ./file-injector.test.mjs`
    EXPECT: still green (e.g. 128 passed if S2 has landed, or 124 if only S1; either way 0 failed). This proves
    no source/test file was accidentally touched — README.md is not loaded by the harness.
  - READ: the "Code is the escape hatch." bullet in context (the 5-bullet Markdown-imports block) — confirm the
    appended sentence reads coherently and does not contradict the other bullets (item §3: "keep the change
    minimal ... existing structure preserved").
```

## Validation Loop

### Level 1: Edit scope (git diff — the primary check)

```bash
cd /home/dustin/projects/pi-file-injector
git diff README.md
# Expected: exactly ONE hunk on line 84, appending the sentence. No other line touched.
# If the diff touches ANY other line (another bullet, the intro, Limits, etc.), the edit was too broad —
# re-scope to the exact "Code is the escape hatch." bullet oldText. The 4 sibling bullets + intro must be
# byte-for-byte identical in the diff (only line 84's content changes).
```

### Level 2: Grep confirmation (the note landed + fills the doc gap)

```bash
cd /home/dustin/projects/pi-file-injector
grep -niE "crlf|line.ending|carriage|windows" README.md
# Expected: one match — "84:... Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF)
#           markdown files detect code fences identically."
# (Pre-edit this grep returned zero matches per item §1; the one match confirms the note landed.)
```

### Level 3: Sanity test (README isn't loaded — proves no accidental source/test edit)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | tail -3
# Expected: "Result: <N> passed, 0 failed." (UNCHANGED from baseline — 124 if only S1 has landed, 128 if S2
# has landed too). README.md is NOT imported by the harness, so this doc edit cannot change the result.
# This run is a SANITY check that you didn't accidentally touch a source/test file:
git status --short
# Expected: only " M README.md". If file-injector.ts or a .test.mjs appears, you edited the wrong file.
```

### Level 4: Coherence re-read (item §3 verification)

```bash
cd /home/dustin/projects/pi-file-injector
sed -n '80,87p' README.md
# Eyeball the 5-bullet Markdown-imports block. Confirm:
#   - the "Code is the escape hatch." bullet (line 84) now ends with the CRLF/LF sentence;
#   - the sentence reads coherently after "...without importing anything.";
#   - it does NOT contradict the other bullets (it's about fenced-code DETECTION, complementary to them);
#   - the "Five rules narrow it:" intro still says "Five" (the note is part of bullet 3, not a 6th bullet);
#   - no new bullet/heading/section appeared.
```

## Final Validation Checklist

### Technical Validation

- [ ] `git diff README.md` shows exactly ONE line changed (line 84, the appended sentence); no other line touched.
- [ ] `git status --short` shows ONLY `M README.md` (no source/test/package file accidentally edited).
- [ ] `node ./file-injector.test.mjs` still green (sanity — README isn't loaded; proves no accidental code edit).

### Feature Validation

- [ ] The "Code is the escape hatch." bullet ends with: "Fenced-code detection is line-ending agnostic —
      Windows (CRLF) and Unix (LF) markdown files detect code fences identically."
- [ ] The note is a POSITIVE capability statement (not a caveat/warning) — matches item §1.
- [ ] `grep -niE "crlf|line.ending|carriage|windows" README.md` matches the new sentence (was zero matches).

### Code Quality Validation

- [ ] ONE sentence appended to ONE existing bullet; no new bullet/heading/section (item §3).
- [ ] The "Five rules narrow it:" intro count STAYS "Five" (the note is part of bullet 3, not a 6th bullet).
- [ ] The other 4 Markdown-import bullets + the intro + every other README section are byte-for-byte unchanged.
- [ ] The sentence tone matches the README (dense one-liner, em-dash clause, consistent with sibling bullets).

### Documentation

- [ ] This subtask IS the Mode B changeset-level documentation sync (item §5).
- [ ] No source JSDoc change (S1 owns file-injector.ts; the fix JSDoc is S1's Mode A, already done).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT add a new bullet, heading, or section.** Item §3 is explicit: "one brief sentence addition to an
  existing bullet — do NOT add a new section or heading." Append to the existing "Code is the escape hatch."
  bullet only.
- ❌ **Do NOT change "Five rules narrow it:" → "Six".** The note is part of bullet 3 (an appended sentence),
  not a 6th bullet. The bullet count is unchanged.
- ❌ **Do NOT phrase the note as a caveat/warning.** Item §1: the fix is backward-compatible and transparent;
  "no behavioral caveat is needed — just a brief positive note." Do NOT put it in ## Limits (that section is
  for constraints). Phrase it as "works across line endings" (positive capability).
- ❌ **Do NOT edit any other bullet or section.** The 4 sibling Markdown-import bullets, the intro, ## Limits,
  the bare-@ subsection, ## Syntax/Why/Install/Usage, the What-gets-injected table, #@ vs @ — all UNCHANGED.
  ONE sentence on ONE line.
- ❌ **Do NOT mention CR-only (classic Mac).** That's an extinct line-ending style and an intentional scope
  boundary (documented in T1.S2's CC14 test, not user-facing). The README note covers CRLF (Windows) + LF
  (Unix) — the two styles users actually have.
- ❌ **Do NOT touch any source/test/package file.** This is README-only. `git status` must show only `README.md`.
- ❌ **Do NOT run the test suite expecting it to validate README content.** README.md isn't loaded by the
  harness. Running the suite is a SANITY check that you didn't accidentally edit a source/test file — not a
  content validation.
- ❌ **Do NOT overlap with S1/S2's files.** S1 edits file-injector.ts (source); S2 edits file-injector.test.mjs
  (tests); T2.S1 edits README.md (docs). No shared files; all three can land independently.

---

## Confidence Score: 10/10

A one-sentence documentation append to one existing README bullet, with every fact verified first-hand: the
exact current bullet (line 84, quoted verbatim), the exact one-sentence addition (wording given, em-dash-
attached for tone consistency), the unique oldText anchor (the bold lead appears once), the placement rationale
(this bullet, not Limits, because the note is a positive capability about fenced-code DETECTION — this bullet's
subject), the "Five" count stays "Five" (appending a sentence isn't adding a bullet), the grep-based verification
(fills the zero-match doc gap), and the no-test-gate fact (README isn't loaded by tests). The implementing agent
makes one surgical edit, runs a grep + a sanity test, and re-reads the bullet in context. No code path, no test,
no build, no ambiguity. The fix being documented (T1.S1) is shipped; the tests (T1.S2) are landing in parallel
on a different file. There is no residual risk.
