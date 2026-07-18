---
name: "P1.M3.T2.S1 (bugfix 001_a4cee0dcf39c) — Update README.md for Issue 1 behavior change + Issue 4 intentional-contract note"
prd_ref: "bugfix PRD §h2.2/Issue 1 (resolveImportPath truncation — Major; the behavior change to document) + §h2.3/Issue 4 (image magic-byte sniff — Minor, intentional; the contract to clarify). NOT §h2.3 Issues 2 & 3 (internal offset/directive — contract: do NOT document)."
target_file: "README.md (ONLY). Pure Mode-B documentation changeset-sync (the FINAL doc task). No code, no tests, no config."
target_language: "Markdown (GitHub-flavored). README prose only; two edits (one new paragraph + one appended sentence); zero new code fences."
depends_on: "ALL implementing subtasks: P1.M1.T1.S1 (resolveImportPath fmtCut fix — Complete, verified LANDED at file-injector.ts L162-163) + P1.M1.T1.S2 (test 4f flip + 4h + regression cases — Complete) + P1.M2.* (FileDetail offsets/paged directive — internal, not user-facing, undoc'd per contract) + P1.M3.T1.S1 (test wiring into npm test — landed: package.json test script chains all 3 harnesses)."
consumed_by: "None — this is the final task of the bugfix (Mode B final sweep). No downstream consumer."
---

# PRP — P1.M3.T2.S1: README — Issue 1 exact-extension rule + Issue 4 magic-byte contract

> **Scope flag:** This is a **DOCUMENTATION changeset-sync** task (Mode B — the final, whole-delta
> overview). The implementing agent writes **only to `README.md`**: **two prose edits** (one new paragraph
> in `## Syntax` for Issue 1; one sentence appended to the magic-byte paragraph for Issue 4). No code, no
> tests, no config files, no `file-injector.ts`, no `PRD.md`. Per-symbol JSDoc and the test wiring are
> DONE (precondition); this task only surfaces the **user-facing** behavior changes. **Issues 2 & 3 are
> internal (offset/directive) — the contract forbids documenting them; stay in scope (1 & 4 only).**

---

## Goal

**Feature Goal:** Update `README.md` so it accurately reflects two user-facing outcomes of the QA bugfix
effort, with no stale claims: (Issue 1) a `#@` reference that already ends in a file extension is now
**exact-match** — a missing `X.md.bak` is left verbatim (was silently truncated to `X.md`), while
markdown emphasis glued to a name (`*@b.md*`) is still trimmed and resolves; (Issue 4) the image
magic-byte contract is stated precisely in both directions, including that a **real** image saved with a
mismatched extension (a PNG named `.jpg`) is **not attached** — it's delivered as a binary note.

**Deliverable:** An edited `README.md` with exactly two prose additions and zero edits to existing
accurate sentences (and zero new code fences):
1. A new bolded paragraph in `## Syntax` — placed AFTER the "Trailing punctuation is trimmed" code fence
   and BEFORE `**Paths:**` — titled to convey exact-extension matching. States: a reference ending in an
   extension is matched by its exact name; a missing `#@report.md.bak` is left as written, never silently
   resolved to `report.md`; the carve-out that markdown emphasis (`*@b.md*`, `**@b.md**`) is still trimmed
   so the file resolves.
2. One sentence appended to the existing "Images are matched by their real bytes…" paragraph (the
   magic-byte contract): the check cuts both ways — a real image saved with the wrong extension (a PNG
   named `photo.jpg`) is **not attached**; it's delivered as a binary note because its bytes don't match
   the declared extension's signature; rename to the real type to attach it.

**Success Definition:**
1. A reader who knows nothing about this codebase can, from `README.md` alone, learn (a) that an
   extension-carrying `#@` reference is exact-match and a missing `X.md.bak` is never silently resolved
   to `X.md`, while markdown-formatted names still resolve; and (b) the image-bytes contract cuts both
   ways — a mislabeled real image becomes a binary note, not an attachment.
2. The additions match the existing README voice (concise, second-person, bold lead-ins, backticked
   examples) and add **zero** code fences (fence count stays 14, even).
3. **No stale/inaccurate claims:** the README does NOT say a mismatched-extension image is "attached by
   its real type" (the shipped code delivers a **binary note** — verified). It states the real outcome.
4. **Issues 2 & 3 are NOT documented** (internal offset/directive; contract-forbidden). No code-internal
   leakage (`fmtCut`, `hasValidImageMagic`, `MIME_BY_EXT`, `resolveImportPath`, `cleanToken`, regexes,
   line numbers) appears in the README.
5. All validation gates pass (fence balance; Issue-1 + Issue-4 presence; Issue-4 accuracy; scope; no
   code-internal leakage; no edits to still-accurate existing prose).

## User Persona

**Target User:** A **Pi end user** reading the extension README to learn exactly how `#@file` resolves
paths and handles images. They are NOT a contributor; they will never read the PRD or source. The README
is their *only* interface to the behavior contract.

**Use Case:** Two scenarios the current README does not crisply cover:
- "I wrote `#@report.md.backup` but only `report.md` exists — what happens?" (Answer: left verbatim,
  never silently resolved to the wrong file. Before the fix, it silently delivered `report.md`.)
- "I have a real PNG but it's named `photo.jpg` — will `#@photo.jpg` attach it?" (Answer: no — its bytes
  don't match the `.jpg` signature, so it's a binary note; rename to `.png`.)

**User Journey:** user reads `## Syntax` → finds the new "Extensions are exact." rule → understands a
missing `report.md.bak` is left as-is (no silent wrong-file injection) AND that `*@b.md*` emphasis still
resolves → scrolls to the image paragraph under `## What gets injected` → reads that the magic-byte check
cuts both ways → knows a mislabeled real image is a binary note → renames if needed.

**Pain Points Addressed:** Before Issue 1's fix, a missing `report.md.backup` silently injected
`report.md` — a data-integrity defect (wrong/sensitive content, no signal). The README must now make the
SAFE exact-match behavior discoverable so users trust it. For Issue 4, the existing README only stated the
text-fake direction (`fake.png` → text); a user could wrongly assume a real image with a wrong extension
is still attached. The appended sentence removes that assumption with the accurate outcome.

## Why

- **Issue 1 changed user-facing resolution behavior.** The `extCut` truncation heuristic silently
  resolved a missing `X.md.bak` to `X.md`. The fix (verified LANDED at `file-injector.ts:162-163`,
  `fmtCut = token.replace(/[*_]+$/, "")` + re-`cleanToken` retry) makes extension-carrying tokens
  exact-only while preserving markdown-emphasis glue trimming. This is a visible behavior change
  (verbatim-vs-injected) that the README must reflect so users understand the new contract.
- **Issue 4's contract was under-stated.** The README said images are "matched by their real bytes" but
  only gave the text-fake example. A reader could infer a real-image-wrong-extension is attached by its
  real type — which is FALSE (verified: it's a binary note). The README must state the accurate
  two-directional contract so users aren't misled.
- **Accuracy is non-negotiable.** The task contract's own Issue-4 phrasing ("delivered by its real byte
  type") is **imprecise vs the shipped code** — the code delivers a **binary note**, not an attached
  image of the real type (verified: `mime = MIME_BY_EXT[ext]` is extension-derived; the image branch
  requires `hasValidImageMagic(buf, mime)` to pass; a PNG-named-`.jpg` fails the `.jpg` magic check and
  falls through to `isBinary` → binary note). The README must describe the **shipped** outcome, not the
  contract's loose gloss (contract item 4: "accurately reflects shipped behavior with no stale claims").
- **Integration with existing docs.** The Issue-1 note sits in `## Syntax` alongside the other
  token-cleanup rules (trailing punctuation, then exact-extensions), before the markdown-specific
  bullets. The Issue-4 note appends to the existing magic-byte paragraph without rewriting the accurate
  sentences. Both are minimal, voice-matched additions.
- **Issues 2 & 3 stay out of scope by contract.** Issue 2 (FileDetail byte duplication → content-offset
  refactor) is internal storage with zero user-visible behavior. Issue 3 (paged expanded-view directive)
  is display-only and the contract has decided not to document it. Documenting either would violate
  "Do not describe internal offset/directive implementation details."

## What

**User-visible behavior:** `README.md` gains one new paragraph (Issue 1) and one appended sentence
(Issue 4). No extension behavior changes (this is docs-only). The new content conveys:

1. **Issue 1 — exact-extension rule (general; applies to top-level AND markdown imports):**
   - A reference that already ends in a file extension is matched by its **exact** name.
   - A **missing** `#@report.md.bak` is left as written — it **never** silently resolves to an existing
     `report.md`. (The model never receives a different file than the one you named.)
   - Carve-out: markdown **emphasis/formatting** glued to a name (`*@b.md*`, `**@b.md**`) is still
     trimmed, so the file resolves.
2. **Issue 4 — magic-byte contract (both directions):**
   - Existing (keep): a text file renamed `fake.png` is injected as text, not attached as a broken image.
   - New (append): the check cuts both ways — a real image saved with the wrong extension (a PNG named
     `photo.jpg`) is **not attached**; it's delivered as a **binary note** because its bytes don't match
     the declared extension's signature. Rename to its real type to attach it.

### Success Criteria

- [ ] `README.md` has a new bolded paragraph in `## Syntax`, placed AFTER the trimmed-chars code fence
      and BEFORE `**Paths:**`, stating the exact-extension rule with both examples (missing
      `report.md.bak` → verbatim; `*@b.md*`/`**@b.md**` → resolves).
- [ ] The magic-byte paragraph (under `## What gets injected`) has the appended converse sentence: a real
      image with a mismatched extension (PNG named `photo.jpg`) is NOT attached → binary note; rename to
      attach.
- [ ] **Accuracy:** the README does NOT claim a mismatched-extension image is "attached by its real
      type" — it states the binary-note outcome (shipped behavior).
- [ ] **Scope:** Issues 2 & 3 are NOT mentioned. No code-internal leakage (`fmtCut`, `extCut`,
      `hasValidImageMagic`, `MIME_BY_EXT`, `resolveImportPath`, `cleanToken`, `TRAILING_PUNCT`, regexes,
      line numbers) appears.
- [ ] The new content matches the existing voice (concise, second-person, bold leads, backticked
      examples); adds **zero** code fences (count stays 14, even).
- [ ] No still-accurate existing sentence is rewritten or deleted (pure APPEND for Issue 4; the Issue-1
      paragraph is a new insertion that does not duplicate or contradict the "Extension shorthand" bullet).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to make these two edits
correctly?_ **Yes.** This PRP includes: the exact README structure with line anchors (the canvas), exact
placement for both edits, complete voice-matched **recommended drafts** for both edits (transcribe +
tune), the **verified shipped behavior** for both issues (read from `file-injector.ts`, not aspirational),
the critical **accuracy finding** for Issue 4 (binary note, NOT "attached by real type" — so the
implementer does not copy the contract's imprecise phrasing), the things NOT to do (no Issues 2/3, no
code-internal leakage, no edits to accurate prose), and deterministic greppable validation gates. The
agent opens `README.md`, applies two prose additions, runs the grep checks.

### Documentation & References

```yaml
# MUST READ — the file you edit (the canvas + the voice to match); this is the ONLY file you touch
- file: README.md
  why: "The doc under edit (138 lines, 14 fences — even). Voice: concise, second-person, bold lead-ins
        (**Term.** …), backticked examples, no marketing fluff. Issue-1 home = ## Syntax, AFTER the
        trimmed-chars fence (L76-78) and BEFORE **Paths:** (L80). Issue-4 home = the 'Images are matched
        by their real bytes…' paragraph (L66) under ## What gets injected — APPEND, do not rewrite."
  pattern: "L74 **Trailing punctuation is trimmed.** … → L76-78 trimmed-chars fence → [INSERT Issue-1
            paragraph here] → L80 **Paths:**. L66 magic-byte paragraph → [APPEND Issue-4 converse
            sentence before 'An empty (0-byte) image attaches nothing.']."
  gotcha: "L85 '- **Extension shorthand.**' bullet is about the MARKDOWN .md/.markdown shorthand
           (#@PRD → PRD.md) — a DIFFERENT rule from the exact-extension rule. Leave it; the new Issue-1
           paragraph is the GENERAL exact-match rule; no conflict/duplication. L47-53 file-type table is
           still accurate — do NOT touch it (the magic-byte nuance lives in prose at L66)."

# MUST READ — the bug report (the two issues to document, paraphrased at user level — NOT ported verbatim)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/prd_snapshot.md
  why: "§h2.2 Issue 1 = the behavior change (resolveImportPath truncation → now exact-only; the §4.5
        'extended tokens are exact-only' rule now actually holds). §h2.3 Issue 4 = the intentional
        magic-byte contract (the README's stricter contract is the intended one; clarify the converse).
        §h2.3 Issues 2 & 3 = INTERNAL (offset/directive) — the contract FORBIDS documenting them."
  section: "h2.2 Issue 1 + h2.3 Issue 4 (document); h2.3 Issues 2 & 3 (do NOT document)"
  critical: "Paraphrase USER-FACING behavior only. Do NOT port the root-cause code (extCut regex,
             candidates[], FileDetail.body, renderInjectedMessage) into the README."

# MUST READ — Issue 1 fix design + the verified node-confirmed behavior table
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue1_resolveimportpath.md
  why: "The 'Chosen fix — PRD option 2' section + the VERIFIED sequencing table pin the exact shipped
        behavior: X.md.bak (missing) → null/verbatim; *@b.md*/@b.md.* (glue) → resolves to b.md;
        my_file.md.* (internal underscore untouched) → my_file.md. This is the behavior the README states."
  pattern: "Read the behavior TABLE, not the code shape. The README rule = 'exact name match for
            extension-carrying tokens; missing → verbatim; trailing */_ emphasis glue still trimmed.'"
  gotcha: "The fmtCut logic is code-internal — never name fmtClean/extCut/cleanToken/resolveImportPath
           or the [*_]+$ regex in the README."

# MUST READ — Issue 4 magic-byte logic (RESOLVE THE ACCURACY QUESTION before writing)
- file: file-injector.ts
  why: "VERIFY the Issue-4 outcome so the README is accurate (not the contract's loose phrasing).
        L868 `const mime = MIME_BY_EXT[ext];` → mime is EXTENSION-DERIVED. L64 hasValidImageMagic(buf,
        mime) validates bytes against the DECLARED type. L~878 image branch requires the magic to PASS;
        on mismatch → L~898 isBinary → real image bytes have NUL → BINARY NOTE. So a PNG named photo.jpg
        → mime image/jpeg → hasValidImageMagic(png, jpeg) checks FF D8 FF → FAILS → binary note, NOT
        attached. MIME_BY_EXT (L17-20): png→image/png, jpg/jpeg→image/jpeg."
  pattern: "Read-only. DO NOT edit. Source of truth for 'what does a mismatched-extension image yield?'"
  critical: "The task contract's phrase 'delivered by its real byte type' is IMPRECISE. The shipped
             outcome is a BINARY NOTE (not attached). The README MUST state binary-note, never 'attached
             by its real type.' (Contract item 4: accurately reflects shipped behavior, no stale claims.)"

# MUST READ — the parallel predecessor (NO conflict; confirms the precondition is met)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M3T1S1/PRP.md
  why: "Wires the three test harnesses into npm test by editing package.json L9 ONLY. It does NOT touch
        README.md → zero conflict with this task. It is the precondition (test surface is gated); when it
        lands, package.json's test script chains file-injector + import-behavior + relative-imports. This
        docs task neither runs nor depends on that script at edit-time."
  pattern: "Precondition, not your work. README.md is untouched by P1.M3.T1.S1 — no merge concern."

# The recommended draft (near-complete, voice-matched, accurate) — transcribe + tune
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M3T2S1/research/research_notes.md
  why: "§5 has the complete recommended draft for BOTH edits (Issue-1 paragraph + Issue-4 appended
        sentence), voice-matched and verified accurate against the source. §2/§3 have the verified
        behavior tables. §6 has the validation gates. The implementing agent can largely transcribe."
  section: "## 5. Recommended README draft + ## 2/3 (verified behavior) + ## 6 (validation)"
```

### Current Codebase tree

```bash
pi-file-injector/
├── README.md                # ← EDIT (the ONLY file this task touches): +1 Syntax paragraph, +1 sentence in the image paragraph
├── file-injector.ts         # read-only (verify Issue-1 fmtCut L162-163 + Issue-4 magic logic L64/L868; do NOT edit)
├── file-injector.test.mjs   # read-only (code gate; owned by M1/M2 + wired by M3.T1)
├── import-behavior.test.mjs # read-only (Issue-1 guard; test 4f flipped + 4h added by M1.T1.S2)
├── relative-imports.test.mjs# read-only (BUG CLASS 1 & 2 guard)
├── scripts/typecheck.mjs    # read-only (code gate)
├── package.json             # read-only (test script wired by M3.T1 — do NOT edit)
├── tsconfig.json            # read-only
├── PRD.md                   # read-only (FORBIDDEN — owned by humans)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/{issue1_resolveimportpath.md, issue2_3_filedetail_renderer.md, issue4_image_and_tests.md, system_context.md}
    └── P1M?T?S?/{research, PRP.md}   # predecessor + sibling PRPs (read-only)
```

### Desired Codebase tree (files touched by THIS task)

```bash
README.md    # +1 new paragraph in ## Syntax (Issue 1: exact-extension rule)
             # +1 appended sentence in the image magic-byte paragraph under ## What gets injected (Issue 4)
             # (NO other files. NO new code fences. NO edits to still-accurate existing sentences.)
```

### Known Gotchas of our codebase & Library Quirks

```markdown
# CRITICAL — EDIT ONLY README.md. Docs-only. Do NOT touch file-injector.ts, the three test harnesses,
#   scripts/typecheck.mjs, package.json, tsconfig.json, PRD.md, or any plan/ file. Two prose additions to
#   one file. If you are editing a .ts/.mjs/.json file, STOP — you are out of scope.

# CRITICAL — ISSUE 4 ACCURACY (the headline gotcha). The task contract says "delivered by its real byte
#   type." That is IMPRECISE. Verified shipped behavior: a real image saved with a mismatched extension
#   (PNG named photo.jpg) is delivered as a BINARY NOTE — it is NOT attached (the bytes fail the declared
#   extension's magic check, then isBinary catches the NUL bytes). The README MUST state "binary note, not
#   attached" (e.g. "Rename it to its real type to attach it"). Writing "attached by its real byte type"
#   would be a STALE/WRONG claim. (file-injector.ts L868 mime=MIME_BY_EXT[ext]; L64 hasValidImageMagic;
#   L~878 image branch; L~898 isBinary.)

# CRITICAL — DO NOT DOCUMENT ISSUES 2 & 3. Contract item: "Do not describe internal offset/directive
#   implementation details (those are code-internal, not user-facing)." Issue 2 (FileDetail.body byte
#   duplication → content offsets) is internal storage, zero user-visible behavior. Issue 3 (paged
#   expanded-view directive) is display-only and contract-decided-undocumented. README documents ONLY
#   Issue 1 + Issue 4.

# CRITICAL — NO CODE-INTERNAL LEAKAGE. The README is user-facing prose. Forbidden after your edit:
#   fmtCut, extCut, hasValidImageMagic, MIME_BY_EXT, resolveImportPath, cleanToken, TRAILING_PUNCT,
#   "candidate[0]/[1]", the [*_]+$ regex, any file-injector.ts line number, "§4.4/§4.5". State the
#   user-facing rule + examples; do not port internals.

# CRITICAL — PURE APPEND for Issue 4; do NOT rewrite the accurate existing sentences. The magic-byte
#   paragraph (L66) currently says "Images are matched by their real bytes, not just the extension. A text
#   file renamed fake.png is injected as text… An empty (0-byte) image attaches nothing." — all ACCURATE.
#   Append ONE converse sentence (real image + wrong ext → binary note). Do not delete/rephrase the rest.

# CRITICAL — DO NOT DUPLICATE/CONTRADICT the "Extension shorthand" bullet (L85). It is about the MARKDOWN
#   .md/.markdown shorthand (#@PRD → PRD.md). Your new Issue-1 paragraph is the GENERAL exact-extension
#   rule (#@report.md.bak missing → verbatim). They are different rules; both stay. No overlap to resolve.

# GOTCHA — CODE-FENCE BALANCE IS A HARD GATE. Current `grep -c '^```' README.md` = 14 (even). Your two
#   edits are PROSE ONLY (no fences). Post-edit count MUST stay 14 (even). If it changes, you accidentally
#   added/removed a fence — a real defect. (Neither edit needs a code block; the examples are inline
#   backticks like `#@report.md.bak` and `*@b.md*`, not fenced blocks.)

# GOTCHA — NO MARKDOWN LINTER. package.json has only typecheck + test (both CODE gates; this docs task
#   does NOT run them). Validation is greppable checks (see Validation Loop), not a linter. `npx
#   markdownlint-cli` exists but the EXISTING README wasn't written to pass it → OPTIONAL only, never a
#   hard gate (pre-existing style noise is out of scope).

# GOTCHA — VOICE. Concise, second-person ("you"/"your"), bold lead-in (**Term.** …), backticked inline
#   examples. Mirror the sentence length of the neighboring "Trailing punctuation is trimmed." and
#   "Images are matched…" paragraphs. No marketing fluff, no hedging, no first-person-plural.
```

## Implementation Blueprint

> **No data models, no new code files.** The blueprint is the exact two-edit specification + the
> recommended drafts (transcribe + tune to local voice).

### Edit specification (two prose additions; zero fence changes; zero edits to accurate prose)

```yaml
EDIT 1 — NEW PARAGRAPH in ## Syntax (Issue 1: exact-extension rule):
  - INSERT POSITION: directly AFTER the trimmed-chars code fence (README.md L78, the closing ``` of the
    ". , ; : ! ? \" ' ) ] } >" block) and directly BEFORE the "**Paths:**" paragraph (L80). One blank line
    above and below (match the file's paragraph spacing).
  - FORMAT: a single paragraph with a bold lead-in, matching the neighboring "**Trailing punctuation is
    trimmed.**" / "**Paths:**" paragraphs (NOT a bullet — it is a general rule, peer to those).
  - HEADING/LEAD: convey "extensions are exact." Recommended lead: "**Extensions are exact.**"
  - CONTENT (convey, paraphrased to match voice — see recommended draft in research notes §5):
      (a) A reference that already ends in a file extension is matched by its EXACT name.
      (b) A missing #@report.md.bak is left as written — it NEVER silently resolves to an existing
          report.md (the model never receives a different file than the one you named).
      (c) Carve-out: markdown emphasis glued to a name (*@b.md*, **@b.md**) is still trimmed, so the file
          resolves.
  - SCOPE NOTE: this is a GENERAL rule (top-level AND markdown imports). Do NOT qualify it as
    markdown-only. Do NOT mention fmtCut/cleanToken/resolveImportPath/regex/line numbers.

EDIT 2 — APPEND ONE SENTENCE to the magic-byte paragraph (Issue 4: two-directional contract):
  - INSERT POSITION: inside the "Images are matched by their real bytes…" paragraph (README.md L66),
    inserted AFTER the "…not attached as a broken image." sentence and BEFORE the "An empty (0-byte)
    image attaches nothing." sentence. (Pure append within the paragraph; do not split into a new line.)
  - CONTENT (convey — see recommended draft in research notes §5):
      The check cuts both ways: a real image saved with the wrong extension (a PNG named photo.jpg) is
      NOT attached — its bytes don't match the .jpg signature, so it's delivered as a binary note.
      Rename it to its real type to attach it.
  - ACCURACY: state BINARY NOTE (not "attached by its real type"). This is the verified shipped outcome.
  - DO NOT: rewrite the existing accurate sentences; touch the file-type table (L47-53); add a fence.
```

### Recommended draft (transcribe + tune to voice — from research notes §5)

> The implementing agent may use this near-verbatim (already voice-matched + verified accurate) or
> rephrase to fit local rhythm. Either way it MUST satisfy the Edit-specification content checklist and
> the accuracy constraint (Issue 4 = binary note, not "attached by real type").

**Edit 1 — new paragraph in `## Syntax` (after the trimmed-chars fence, before `**Paths:**`):**

```markdown
**Extensions are exact.** A reference that already ends in a file extension is matched by that exact name. A missing `#@report.md.bak` is left as written — it never silently resolves to an existing `report.md`, so the model never receives a different file than the one you named. (Markdown formatting glued to a name is different: emphasis like `*@b.md*` or `**@b.md**` is still trimmed, so the file resolves.)
```

**Edit 2 — append to the magic-byte paragraph (L66). BEFORE (current):**

```markdown
Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. An empty (0-byte) image attaches nothing.
```

**AFTER (insert the converse sentence before "An empty…"):**

```markdown
Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. The check cuts both ways: a real image saved with the wrong extension — a PNG named `photo.jpg`, say — is not attached, because its bytes don't match the `.jpg` signature; it's delivered as a binary note instead. Rename it to its real type to attach it. An empty (0-byte) image attaches nothing.
```

### Implementation Patterns & Key Details

```markdown
# PLACEMENT (the load-bearing detail — get the anchor lines right):
#   - Edit 1: AFTER the trimmed-chars closing fence (L78), BEFORE "**Paths:**" (L80). Groups the general
#     token-cleanup rules (trailing-punctuation, then exact-extensions) before the markdown-specific
#     bullets. Blank-line spacing identical to neighbors.
#   - Edit 2: INSIDE the L66 paragraph, between "…not attached as a broken image." and "An empty (0-byte)
#     image attaches nothing." Pure in-paragraph append.

# VOICE (match the existing file — read the "Trailing punctuation is trimmed." and "Images are matched…"
#   paragraphs aloud before writing): second-person, present tense, declarative, bold lead-in, backticked
#   inline examples (NO fenced code blocks for either edit).

# ACCURACY (Issue 4 — the one place the contract is loose):
#   - SHIPPED: PNG named photo.jpg → binary note (NOT attached). mime is extension-derived
#     (MIME_BY_EXT[ext]); hasValidImageMagic(buf, mime) validates against the DECLARED type; mismatch →
#     isBinary → binary note.
#   - README states: "not attached … delivered as a binary note … rename to its real type to attach it."
#   - NEVER write "attached by its real byte type" / "delivered by its actual type" — that is WRONG.

# WHAT NOT TO STATE (code-internal leakage guard):
#   - No fmtCut/extCut/cleanToken/resolveImportPath/hasValidImageMagic/MIME_BY_EXT/TRAILING_PUNCT.
#   - No regexes ([*_]+$, the magic-byte hex), no "candidate[0]/[1]", no line numbers, no "§4.4/§4.5".
#   - No Issues 2 & 3 (FileDetail/body/offsets, paged-directive/expanded-view/renderInjectedMessage).
```

### Integration Points

```yaml
FILES TOUCHED:
  - README.md        # +1 paragraph (## Syntax), +1 sentence (image paragraph under ## What gets injected).

NO_CHANGES (read-only for this task):
  - file-injector.ts               # verify-only (Issue-1 fmtCut L162-163; Issue-4 magic L64/L868)
  - file-injector.test.mjs         # code gate (M1/M2; wired by M3.T1)
  - import-behavior.test.mjs       # code gate (Issue-1 4f/4h)
  - relative-imports.test.mjs      # code gate (BUG CLASS 1 & 2)
  - scripts/typecheck.mjs          # code gate
  - package.json / tsconfig.json   # no script/config changes (test wiring = M3.T1, already landed)
  - PRD.md                         # FORBIDDEN (read-only per FORBIDDEN OPERATIONS)
  - plan/**                        # read-only context
  - any new file                   # none — this task writes ONLY to README.md
```

## Validation Loop

> For a docs task there is no compile/test/run loop. Validation is **deterministic greppable checks** that
> confirm the two additions landed accurately, the voice/structure holds, no code internals leaked, no
> inaccurate claims were introduced, and Issues 2/3 stayed out. All run in <1s. (The CODE gates — `npm
> test`, `npm run typecheck` — are owned by the implementing + wiring subtasks and are GREEN by
> precondition; this docs task does NOT run them.)

### Level 1: Structural & style checks (immediate, after the edit)

```bash
cd /home/dustin/projects/pi-file-injector

# 1a) Code-fence balance — MUST stay 14 (even). My two edits add NO fences.
test "$(grep -c '^```' README.md)" -eq 14 && echo "fences balanced (14)" || echo "FENCE MISMATCH: $(grep -c '^```' README.md) — expected 14"
# Expected: "fences balanced (14)". A change means you accidentally added/removed a fence — fix it.

# 1b) The new Issue-1 paragraph exists in ## Syntax, with the exact-extension lead.
grep -n "Extensions are exact\|exact name" README.md
# Expected: ≥1 match, located BETWEEN the trimmed-chars fence and "**Paths:**".

# 1c) Placement sanity: the Issue-1 paragraph sits AFTER the trimmed-chars fence and BEFORE "**Paths:**".
awk '/^```$/{f=NR} /^\*\*Extensions are exact|exact name/{e=NR} /^\*\*Paths:/{p=NR} END{print "fence_close="f" exact_para="e" paths="p}' README.md
# Expected: fence_close < exact_para < paths (ascending). If exact_para is 0 or outside the range,
# placement is wrong — move it.

# 1d) The Issue-4 converse sentence exists in the image paragraph.
grep -n "binary note\|don't match the" README.md
# Expected: ≥1 match in the "Images are matched…" paragraph (around L66).
```

### Level 2: Content-presence, accuracy & leakage checks

```bash
# 2a) PRESENCE — Issue 1: both halves of the rule (verbatim-on-missing + emphasis-still-trims).
grep -c "report.md.bak\|md\.bak" README.md                    # Expected: ≥1 (the missing-file example).
grep -c "\*@b.md\*\|\*\*@b.md\*\*\|@b.md\.\*" README.md       # Expected: ≥1 (the emphasis-glue example).

# 2b) PRESENCE — Issue 4: the converse (real image + wrong extension) + the binary-note outcome.
grep -c "photo.jpg\|PNG named\|real image saved with" README.md   # Expected: ≥1 (the converse example).
grep -c "binary note" README.md                                   # Expected: ≥1 (the accurate outcome).

# 2c) ACCURACY — Issue 4 MUST NOT claim a mismatched-extension image is "attached by its real type".
#     (Shipped behavior = binary note. This grep MUST print 0.)
grep -ciE "attached by (its|the) real (byte|type)|delivered by (its|the) real (byte|type)" README.md
# Expected: 0. Any match → an inaccurate claim crept in — replace with the binary-note wording.

# 2d) ABSENCE — NO code-internal leakage (all must print 0).
for bad in fmtCut extCut hasValidImageMagic MIME_BY_EXT resolveImportPath cleanToken TRAILING_PUNCT "candidate\[" "\[\*_\]" "§4.4" "§4.5" "L162\|L868"; do
  printf "%-22s " "$bad:"; grep -cE "$bad" README.md
done
# Expected: each prints 0. Any >0 → code internals leaked into user-facing prose — remove them.

# 2e) SCOPE — Issues 2 & 3 internals NOT mentioned (all must print 0).
grep -ciE "FileDetail|offset|directive|renderInjectedMessage|paged-directive|expanded view|ctrl\+o" README.md | head -1
# Expected: 0 (ctrl+o already appears in Usage/What-gets-injected — that is PRE-EXISTING and fine; this
# check is about NEW Issue-2/3 wording. If unsure, confirm the matches are pre-existing, not your additions.)
# Tighter scope check — the Issue-2/3-specific terms (these should be 0):
for bad in FileDetail "content offset" "byte duplication" "paging directive" "expanded branch"; do
  printf "%-22s " "$bad:"; grep -cE "$bad" README.md
done
# Expected: each prints 0.
```

### Level 3: Cohesion & no-stale-claim check (read-through)

```bash
# 3a) The Issue-1 paragraph does not contradict the "Extension shorthand" bullet (L85) — both present,
#     distinct. The shorthand bullet (markdown .md omission) is intact; the new exact rule is separate.
grep -c "Extension shorthand\|may omit the" README.md          # Expected: ≥1 (shorthand bullet intact).
grep -c "Extensions are exact\|exact name" README.md           # Expected: ≥1 (new rule present).
# Both ≥1 → the two distinct rules coexist without conflict.

# 3b) The magic-byte paragraph's original accurate sentences are intact (pure append, not rewrite).
grep -c "text file renamed .fake.png. is injected as text" README.md   # Expected: ≥1 (original kept).
grep -c "empty (0-byte) image attaches nothing" README.md              # Expected: ≥1 (original kept).

# 3c) Optional: structural outline sanity (confirm headings nest; no stray fence from the edit).
grep -nE "^#{1,4} " README.md
# Expected: the SAME heading outline as before (## Syntax … ### Optional: bare-@ … ## Limits … ## #@ vs @),
# unchanged — no heading was added/removed by this task.
```

### Level 4: Domain-specific / final read-through

```bash
# 4a) OPTIONAL markdownlint — the EXISTING README was NOT written to pass it (long lines etc.), so expect
#     pre-existing style noise. Run ONLY to confirm YOUR new sentences don't introduce NEW error classes
#     (unclosed fence, bad heading). Do NOT treat pre-existing warnings as failures.
npx --yes markdownlint-cli README.md 2>&1 | grep -iE "MD040|MD041|fence" || echo "no new fence/heading issues"
# Expected (best case): "no new fence/heading issues". Pre-existing line-length notes are out of scope.

# 4b) Human read-through (the real Level-4 gate): open README.md and read ## What gets injected (image
#     paragraph) and ## Syntax (trimmed-punctuation → new exact-extensions paragraph → Paths) top to bottom.
#     Confirm:
#     - A reader learns: missing X.md.bak → verbatim (no silent wrong-file); *@b.md* emphasis → resolves.
#     - A reader learns: a real image with a wrong extension → binary note (not attached); rename to attach.
#     - The wording says BINARY NOTE, never "attached by its real type."
#     - The voice matches neighbors; no code internals; Issues 2/3 absent; no fence added.
```

## Final Validation Checklist

### Technical Validation

- [ ] Level 1 passed: fence count is **14** (even, unchanged); the Issue-1 paragraph sits between the
      trimmed-chars fence and `**Paths:**`; the Issue-4 sentence is in the image paragraph.
- [ ] Level 2 passed: Issue-1 examples present (`report.md.bak`, `*@b.md*`/`**@b.md**`); Issue-4 examples
      present (`photo.jpg`/PNG-named, `binary note`); **zero** inaccurate "attached by real type" claims;
      **zero** code-internal leakage; **zero** Issue-2/3 internal terms.
- [ ] Level 3 passed: the "Extension shorthand" bullet is intact and distinct from the new exact rule;
      the magic-byte paragraph's original accurate sentences are intact (pure append).
- [ ] Level 4 passed: human read-through confirms a zero-context reader is correctly informed; the wording
      states binary-note (never "attached by real type"); no NEW markdownlint fence/heading errors.

### Feature Validation

- [ ] All success criteria from "What" section met (Issue-1 exact rule a–c; Issue-4 converse sentence).
- [ ] The additions match the existing README voice and add **zero** code fences.
- [ ] No still-accurate existing sentence was rewritten or deleted (Issue 4 = pure append; Issue 1 = new
      paragraph that does not duplicate the "Extension shorthand" bullet).
- [ ] **Accuracy:** Issue 4 states the binary-note outcome, never "attached by its real type."

### Code Quality / Scope Validation

- [ ] **Only `README.md` was edited.** No `.ts`, `.mjs`, `.json`, `tsconfig.json`, `PRD.md`, or `plan/`
      file was touched.
- [ ] The edit is **two prose additions** (one new paragraph + one appended sentence); no existing accurate
      prose was rewritten; zero fence changes.
- [ ] Issues 2 & 3 (internal offset/directive) are NOT documented.

### Documentation

- [ ] README prose is clear; no dangling TODOs/placeholders.
- [ ] The exact-extension rule and the two-directional magic-byte contract are both discoverable from the
      README alone (contract item 4: "discoverable from the README").

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit any file other than `README.md`.** Docs-only. No `.ts`/`.mjs`/`package.json`/
  `tsconfig.json`/`PRD.md`/`plan/` edits. (Two prose additions to one file.)
- ❌ **Do NOT copy the contract's Issue-4 phrasing ("delivered by its real byte type").** It is IMPRECISE.
  The shipped outcome is a **binary note** (verified: `mime = MIME_BY_EXT[ext]` is extension-derived;
  `hasValidImageMagic(buf, mime)` validates against the declared type; mismatch → `isBinary` → binary
  note). State "binary note, not attached; rename to its real type to attach it." (Contract item 4.)
- ❌ **Do NOT document Issues 2 & 3.** Contract: "Do not describe internal offset/directive implementation
  details." Issue 2 (FileDetail/body/offsets) is internal storage; Issue 3 (paged expanded-view directive)
  is display-only and contract-decided-undocumented. README documents ONLY Issue 1 + Issue 4.
- ❌ **Do NOT leak code internals into the README.** No `fmtCut`/`extCut`/`cleanToken`/`resolveImportPath`/
  `hasValidImageMagic`/`MIME_BY_EXT`/`TRAILING_PUNCT`, no regexes, no line numbers, no "§4.4/§4.5".
  Paraphrase user-facing behavior; do not port internals.
- ❌ **Do NOT rewrite the accurate magic-byte sentences (Issue 4 = pure append).** The existing "Images are
  matched by their real bytes…" / "text file renamed fake.png … injected as text" / "empty (0-byte) image
  attaches nothing" are all ACCURATE. Append ONE converse sentence; do not delete/rephrase the rest.
- ❌ **Do NOT duplicate or contradict the "Extension shorthand" bullet (L85).** It covers the markdown
  `.md`/`.markdown` shorthand (`#@PRD` → `PRD.md`); your new "Extensions are exact" paragraph covers the
  GENERAL exact-extension rule (`#@report.md.bak` missing → verbatim). Different rules; both stay.
- ❌ **Do NOT add or remove a code fence.** Both edits are inline-backtick prose. Fence count MUST stay 14
  (even). A change is a defect.
- ❌ **Do NOT run or edit the CODE gates** (`npm test`, `npm run typecheck`). They are owned by the
  implementing + wiring subtasks (GREEN by precondition). This docs task neither runs nor touches them.
- ❌ **Do NOT touch the file-type table (L47-53).** It is still accurate (Image "Attached as an image";
  Other binary "A short note says it was skipped"). The magic-byte nuance lives in prose at L66, not the
  table.
- ❌ **Do NOT invent voice.** Match the existing README: concise, second-person, bold lead-ins, backticked
  inline examples. If unsure, transcribe the recommended draft (research notes §5) and tune lightly.

---

## Confidence Score: 9/10

A minimal, pure-append documentation edit to ONE file, with: complete voice-matched recommended drafts for
both edits (research notes §5); every fact verified against the IMPLEMENTED `file-injector.ts` (Issue 1
`fmtCut` at L162-163 LANDED; Issue 4 magic-byte logic at L64/L868/L~878/L~898 confirmed); a CRITICAL
accuracy pre-check that catches the contract's imprecise Issue-4 phrasing (binary note, NOT "attached by
real type") so the implementer does not propagate a wrong claim; exact placement by heading + line
anchors; a confirmed orthogonal parallel predecessor (P1.M3.T1.S1 edits `package.json` only, never
README.md); and deterministic greppable validation gates (fence balance, presence, accuracy, leakage,
scope) that run in <1s. The -1 reserves for the one judgment call: the exact prose wording / whether to
phrase the Issue-4 converse as "cuts both ways" vs. another framing (both valid; the implementing agent
tunes to local rhythm). The implementing agent opens `README.md`, transcribes/tunes the two additions,
runs the grep checks, and reads it through. No code is written.
