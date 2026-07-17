# Research Notes — P1.M1.T2.S1: README.md note CRLF/Windows line-ending compatibility for fenced code detection

> One-sentence documentation addition to README.md. The fix (P1.M1.T1.S1) and regression tests (P1.M1.T1.S2)
> are complete/landing. This subtask is the changeset-level doc sync (Mode B): surface the now-fixed
> CRLF/LF compatibility to users in the "Code is the escape hatch" bullet.

## 1. T1.S1 + T1.S2 contract (the fix being documented) — confirmed via their PRPs

- **T1.S1 (Complete)**: fixed `closeRe` at `file-injector.ts:496` — the fence-close regex gained a trailing
  `\r?` so a CRLF close line (` ```\r `) matches. After the fix, CRLF markdown behaves identically to LF:
  a fenced block closes at its close fence, so a `#@` import after the fence resolves (previously silently
  dropped because the fence was treated as unterminated → range to EOF → `#@` classified inCode → skipped).
- **T1.S2 (Ready/Implementing, parallel)**: adds defense-in-depth regression tests CC14 (CR-only documentation),
  CC15 (mixed LF/CRLF), CC16 (CRLF + trailing spaces), + a CRLF-E2E integration test. **Edits
  `file-injector.test.mjs` ONLY** — NO file conflict with my README.md-only task.

The CRLF fix is **backward-compatible and transparent**: CRLF now behaves identically to LF. Per item §1,
no behavioral caveat is needed — just a brief positive note that fenced code detection is line-ending agnostic.

## 2. The exact target bullet (README.md:84, verified first-hand)

```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
```

This sits in the **`## Syntax`** section, under the **"Markdown imports:"** intro ("Five rules narrow it:"),
as the 3rd of 5 bullets (Relative paths only / Extension shorthand / **Code is the escape hatch** / Each file
injected once / Shared budget).

**Why this bullet (not elsewhere)?** Item §1 names it explicitly: "The README's ## Syntax section has a
bullet under 'Markdown imports' that reads: '- **Code is the escape hatch.** ...' After the fix (P1.M1.T1.S1),
this behavior is correct for both LF and CRLF files." The CRLF/LF compatibility is about *how fenced code
blocks are detected* — which is exactly the subject of this bullet. Appending to it is the most cohesive
placement (the note rides with the feature it describes).

**Alternative considered**: the `## Limits` section (item §3 mentions it as an alternative). Rejected — Limits
is for *constraints/caveats* (no spaces, no globs, no directories). The CRLF note is a *positive* capability
("works across line endings"), not a limitation, so it fits the "Code is the escape hatch" bullet better.
The item §3 says "the implementing agent should decide the exact wording and placement; the constraint is:
one brief note, existing structure preserved, no new sections" — so the Syntax-bullet placement is a
recommendation, and I'm specifying it as the primary choice with Limits as a documented fallback.

## 3. The exact edit (one sentence appended to the bullet)

**oldText** (the full current bullet line — unique in README.md, safe edit anchor):
```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
```

**newText** (bullet + one appended sentence; item §3 suggested wording, lightly polished for README tone):
```markdown
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything. Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect code fences identically.
```

This is:
- **One sentence** appended to an existing bullet (item §3 constraint: "one brief sentence addition to an
  existing bullet — do NOT add a new section or heading"). ✓
- **Positive framing** (item §1: "no behavioral caveat is needed — just a brief positive note"). ✓
- **Accurate to the shipped fix** (T1.S1's `closeRe` `\r?` makes CRLF close-detection match LF). ✓
- **Consistent with README tone** (the other bullets are dense one-liners with backticked examples). ✓

## 4. Verification approach (item §4)

- `git diff README.md` → exactly ONE line changed (the bullet gains one appended sentence). Nothing else.
- `grep -niE "crlf|line.ending|carriage|windows" README.md` → now matches the new sentence (was zero matches
  per item §1; confirms the note landed).
- `node ./file-injector.test.mjs` → still green (item §4: "README.md is not loaded by tests"). This is a
  sanity check that no source/test file was accidentally touched, NOT a validation of the README content.

No test gate validates README content (it's pure prose). Validation = git-diff scope + grep confirmation +
human re-read that the sentence reads coherently in context (item §3: "keep the change minimal ... existing
structure preserved").

## 5. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Complete) | closeRe `\r?` fix at file-injector.ts:496 + CC12/CC13 | T2.S1 DOCUMENTS this shipped fix. No file conflict (S1=source; T2.S1=README). |
| P1.M1.T1.S2 (Implementing, parallel) | CC14/CC15/CC16 + CRLF-E2E in file-injector.test.mjs | T2.S1 may cite S2's green CRLF coverage as evidence. No file conflict (S2=test file; T2.S1=README). |

**Critical no-conflict:** T2.S1 is the ONLY subtask editing README.md. S1 (source) and S2 (tests) edit
different files. The note describes behavior that S1 shipped + S2 validates — by the time T2.S1 lands, the
behavior is fixed and tested.

## 6. The README-is-not-loaded-by-tests fact (item §4)

README.md is NOT imported by `file-injector.ts`, `file-injector.test.mjs`, `relative-imports.test.mjs`, or
`import-behavior.test.mjs` (the harnesses load `file-injector.ts` via jiti). So this doc edit CANNOT break
any test. Running the suite after the edit is a sanity check that the implementer didn't accidentally touch
a source/test file (`git status` should show only README.md). It is NOT a content validation.
