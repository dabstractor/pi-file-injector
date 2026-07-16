---
name: "P1.M1.T3.S1 — Add markdown transitive imports to README (Why/Usage/Table/Syntax/Limits)"
prd_ref: "PRD §5.6 (markdown transitive imports), §4.5 (markdown import directives — narrower rules), §5.6.1 (code-region escape hatch), §5.6.2 (total-size budget), §13.6 (why these guards), §14.4 (autocomplete is top-level-only), Non-Goals §2 (relative-only / non-markdown inert / no absolute-tilde imports), Value proposition §3 (composable for docs)"
target_file: "./README.md"   # DOCUMENTATION-ONLY (Mode B). No code, no test, no config.
target_language: Markdown (GitHub-flavored; the existing README's idiom)
depends_on: "P1.M1.T2.S1 (MD constants + code-region helpers), S2 (estimateImageTokens + total-size budget), S3 (injectMarkdown 6-step + wiring), S4 (shared-budget case 20 + §10 missing-import edge) — ALL landed and green (75 passed). This is the cross-cutting Mode B sync: it runs LAST."
consumed_by: "Nothing (terminal documentation task for plan 003). The README is the user-facing artifact."
---

# PRP — P1.M1.T3.S1: Add markdown transitive imports to README

> **Scope flag:** This is a **documentation-only** subtask (SOW §5 Mode B). It edits **`README.md` in place**
> to add markdown transitive-import content across exactly five sections (Why / Usage / What-gets-injected /
> Syntax / Limits). It does **not** touch `file-injector.ts`, `file-injector.test.mjs`, `package.json`,
> `PRD.md`, or any plan file. It depends on every implementing subtask and runs last. The README is already
> paged-delivery-current (plan 002) — this PRP adds the missing markdown layer and **verifies** the paged-
> delivery wording stays non-contradictory.

---

## Goal

**Feature Goal:** Make `README.md` accurately and coherently describe the markdown transitive-imports
feature (PRD §5.6) the same way it already describes single-file `#@` delivery and paged delivery — at the
same user-facing abstraction level, in the existing prose-first style. A reader should understand, in under
two minutes, that `#@spec.md` can pull in a whole tree of docs, what the rules are, and what the limits are.

**Deliverable:** An edited `./README.md` with content added to exactly these five sections (in-place
insertions, preserving every surrounding paragraph):
1. **Why** — one new line (3rd paragraph).
2. **Usage** — a markdown-import example (prompt `#@spec.md` where `spec.md` contains `#@api.md`).
3. **What gets injected** — one new note paragraph after the table (a delivered `.md`/`.markdown` is scanned
   for relative `#@` imports; each delivered as its own block, recursed if markdown).
4. **Syntax** — a new `**Markdown imports.**` subsection (bold-header style, matching **Paths:**) stating the
   4-rule contract.
5. **Limits** — three new bullets.

**Success Definition:** `README.md` reads coherently end-to-end; all five sections present the markdown
feature; the pre-existing paged-delivery wording (plan 002) is **unchanged and non-contradictory** with the
new markdown budget line; no stale "no size limit" / "entire contents no truncation" phrases (re)introduced;
`node ./file-injector.test.mjs` still prints `75 passed, 0 failed` (README edits must not have touched code).

## Why

- **Mode B requires docs to match the shipped surface.** Markdown transitive imports (PRD §5.6) are the
  headline feature of plan 003. The README — the user-facing artifact — currently has **zero** markdown-import
  content; a user reading it would not know `#@spec.md` can import a tree. This task closes that gap.
- **One coherent narrative.** The five edits weave the feature into the existing Why→Usage→What→Syntax→Limits
  arc rather than bolting on a separate "Markdown" section. Each edit lands where a reader naturally expects
  the information (the "why composable" line in Why; the how-to in Usage; the what-happens in the table; the
  exact rules in Syntax; the caveats in Limits).
- **Consistency guard.** The new "imports share the single context budget and page when the running total is
  exceeded" line is the same budget the paged-delivery wording already describes — it just spans the recursion.
  No contradiction; we verify it.

## What

User-visible result: a README that, in addition to single-file `#@` delivery and paged delivery, now explains
that `#@` works **inside** delivered markdown files to pull in further files.

### Success Criteria

- [ ] **(a) Why** has a 3rd paragraph: `#@spec.md` pulls in everything `spec.md` references with the same
      `#@` directive — spec-and-its-dependencies in one token, loop-safe via dedup.
- [ ] **(b) Usage** shows a markdown-import example: a prompt `#@spec.md` where `spec.md` contains `#@api.md`,
      delivering both files.
- [ ] **(c) What gets injected** has a note (after the 4-row table, before the `<file>` block-format example)
      that a delivered `.md`/`.markdown` file is also scanned for relative `#@` imports; each import is
      delivered as its own block and recursed if markdown.
- [ ] **(d) Syntax** has a `**Markdown imports.**` subsection stating all four rules: relative-only (resolved
      from the markdown file's own directory; absolute/tilde ignored and left verbatim); `#@` inside fenced or
      inline code is NOT an import (escape hatch); each file injected at most once across the whole prompt
      (cycles + shared deps dedup); imports share the single context budget and page when the running total is
      exceeded.
- [ ] **(e) Limits** has three new bullets: markdown imports are relative-only; `#@` inside non-markdown
      files is inert (only `.md`/`.markdown` are scanned); there is no autocomplete for in-file import
      directives (the completer is top-level-prompt-only, PRD §14.4).
- [ ] **Untouched:** the intro (L1–3), `## Install` (L11–17), the four table ROWS (only a note is added), the
      paged-delivery phrasing throughout, and `## `#@` versus `@`` (L78–83).
- [ ] **No contradiction:** the new markdown budget line is consistent with the existing paged-delivery
      wording; no stale "no size limit" / "entire contents no truncation" phrases.
- [ ] `node ./file-injector.test.mjs` still prints `Result: 75 passed, 0 failed.` (README edits must not have
      changed any code; this confirms scope discipline).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the exact current README structure with line anchors (§"Current
Codebase tree"), the exact prose to insert in each of the five sections with exact placement (Implementation
Blueprint), the verified behavior-to-doc mapping (every claim tied to a code site), the verified
paged-delivery consistency check (so the implementer can re-verify they didn't break it), the README's style
conventions (prose-first, fenced ```` ```text ```` blocks, `**Bold header.**` subsection style), the explicit
do-not-touch list, and the single regression gate. The implementer edits one Markdown file, then runs one
command to confirm no code drifted.

### Documentation & References

```yaml
# MUST READ — the contract: what to add to each of the 5 sections
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "§'MI-3 README (Mode B, final task)' enumerates the EXACT five sections + the per-section content to
        add. This is the source of truth for the contract clauses (a)–(e)."
  section: "## MI-3 — README (Mode B, final task)"

# MUST READ — the current README (the file being edited)
- file: ./README.md
  why: "The artifact under edit. Read in full FIRST to absorb the existing tone (prose-first, concise,
        examples in ```text blocks, **Bold header.** subsection style). Edits are IN-PLACE insertions that
        preserve every surrounding paragraph."
  pattern: "Headings are `## Section`; in-section sub-points use `**Bold lead-in.**` (e.g. **Where it
            matches:**, **Trailing punctuation is trimmed.**, **Paths:**). Examples live in fenced ```text
            blocks. Limit bullets use `- **Bold lead-in.**`."
  gotcha: "Do NOT rewrite any section. Do NOT modify the four table rows. Do NOT touch the intro / Install /
           `#@` versus `@`. The paged-delivery wording (Why L9, table Text row L39, Limits L72) is already
           correct (plan 002) — leave it and verify it stays non-contradictory."

# MUST READ — the PRD contract for markdown imports (so every claim is accurate)
- file: PRD.md
  why: "§5.6 = the 6-step algorithm + the guards; §4.5 = the three narrowing rules (relative-only, resolve
        from md dir, code exempt); §5.6.2 = shared budget across recursion; §13.6 = WHY the guards (portability,
        dedup-bounds-recursion, code-is-escape-hatch); §14.4 = autocomplete is top-level-only; Non-Goals §2 =
        relative-only, non-markdown inert, no absolute/tilde imports. The README restates these at USER level."
  section: "### 5.6 + ### 4.5 + ### 5.6.2 + ### 13.6 + ### 14.4 + ### Non-Goals"
  critical: "The README is a USER quickstart, NOT the PRD. Do NOT copy the 6-step algorithm, the code-region
             regexes, the token-cost formula, or the §5.6.1 detection detail. State the 4 user-facing rules
             (relative-only + resolve-from-md-dir; code is escape hatch; dedup-once; shared budget) at the
             same abstraction as the existing **Paths:** paragraph."

# MUST READ — first-hand verification that the README claims match the landed code
- file: plan/003_4624515bcd82/P1M1T3S1/research/research_notes.md
  why: "§1 = current README structure + the paged-delivery consistency check (the OUTPUT clause 4 guard).
        §2 = the behavior-to-doc mapping (every claim tied to a file-injector.ts line). §4 = validation
        approach. §5 = scope boundary / non-goals."

# REFERENCE — the landed implementation (confirm behavior; do NOT document internals)
- file: ./file-injector.ts
  why: "Confirm the behaviors the README states are accurate: MD_EXTS = {md, markdown} (L37); scanTokens with
        {allowAbsTilde:false, skipCode:true} + dir=dirname(abs) (L591-594); computeCodeRanges/inCode (L258,
        L325); shared budget via estimateImageTokens/subtract (L481). You READ this to verify accuracy; you do
        NOT edit it."
  critical: "S4 (landing in parallel) adds the §10 stat pre-check: a markdown import resolving to a MISSING
             file leaves its `#@` marker verbatim. This is the SAME behavior as a top-level missing token
             (table row 'Missing file… → Left as written. Nothing is appended.'). No separate README bullet is
             needed for it — the general 'each import delivered as its own block' note covers it. Do not add a
             §10-specific edge case to the user-facing quickstart."

# REFERENCE — the S4 PRP (what lands in parallel; the §10 behavior the docs must stay consistent with)
- file: plan/003_4624515bcd82/P1M1T2S4/PRP.md
  why: "S4 finalizes the feature (case 20 shared budget + the §10 missing-import edge). The README docs the
        FINAL shipped behavior; S4's missing-import edge is consistent with the existing missing-row table
        entry, so no special treatment is required."

# EXTERNAL — n/a. README is plain Markdown; no library docs needed.
```

### Current Codebase tree (the file under edit)

```bash
pi-file-injector/
├── file-injector.ts          # READ-ONLY here (feature is landed: S1+S2+S3+S4). Do NOT edit.
├── file-injector.test.mjs    # READ-ONLY here (gate: 75 passed). Do NOT edit. Run it to confirm no drift.
├── package.json              # untouched
├── PRD.md                    # READ-ONLY (owned by humans)
├── README.md                 # ← EDIT IN PLACE (5 sections; 83 lines → ~115 lines)
└── plan/003_4624515bcd82/
    ├── architecture/codebase_insertion_points.md   # ← MI-3 section = the contract
    └── P1M1T3S1/
        ├── research/research_notes.md              # ← behavior↔doc mapping + consistency check
        └── PRP.md                                  # (this file)
```

### Current README.md structure (verified line anchors — read the file FIRST)

```text
L1   # `#@file`                         # title + intro (paged-delivery phrasing). UNTOUCHED.
L5   ## Why                              # 2 paragraphs. EDIT: append a 3rd paragraph (clause a).
L11  ## Install                          # UNTOUCHED.
L19  ## Usage                            # fenced example + marker-strip explanation + completion + bare @.
                                           EDIT: add a markdown-import example (clause b).
L37  ## What gets injected               # 4-row table + <file> block-format + images. EDIT: add a note
                                           paragraph after the table (clause c). Table rows UNTOUCHED.
L56  ## Syntax                           # **Where it matches:** / **Trailing punctuation…** / **Paths:**.
                                           EDIT: add **Markdown imports.** subsection (clause d).
L70  ## Limits                           # 5 bullets. EDIT: add 3 bullets (clause e).
L78  ## `#@` versus `@`                  # UNTOUCHED.
```

### Desired Codebase tree (files touched)

```bash
README.md   # MODIFIED — 5 in-place insertions (clauses a–e). No other file touched.
# Net: ~83 lines → ~115 lines. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — this is a DOCUMENTATION task. The ONLY file you edit is README.md. Touching file-injector.ts,
     file-injector.test.mjs, package.json, PRD.md, or any plan/ file is OUT OF SCOPE and a failure. -->

<!-- CRITICAL — edits are IN-PLACE INSERTIONS, not rewrites. Preserve every surrounding paragraph, every
     table row, and every heading. The README already reads coherently for single-file + paged delivery;
     your job is to weave the markdown feature into the existing arc, not to restructure it. -->

<!-- CRITICAL — paged-delivery consistency. The README is already paged-delivery-current (plan 002). Your new
     markdown budget line ("imports share the single context budget and page when the running total is
     exceeded") MUST be consistent with the existing phrasing ("injected whole when it fits remaining
     context… paged via the read tool when it doesn't"). It is — it's the same budget, spanning the recursion.
     Do NOT add a second, contradictory size story. Do NOT reintroduce stale phrases like "no size limit" or
     "entire contents, no truncation" (plan 002 removed those — verify they stay absent). -->

<!-- CRITICAL — abstraction level. The README is a USER quickstart. State the 4 user-facing rules. Do NOT copy
     the PRD's 6-step algorithm, the computeCodeRanges regexes, the token-cost formula, the §5.6.1 CommonMark
     detection detail, or the §10 missing-import stat-pre-check edge. Match the abstraction of the existing
     **Paths:** paragraph. -->

<!-- GOTCHA — §14.4 says the autocomplete provider is top-level-only (import directives inside a markdown file
     are never typed in the editor, so they get no completion). The README Usage section already mentions
     top-level path completion ("Type `#@` and the same file list Pi shows for `@` appears"). Your new Limit
     bullet ("no autocomplete for in-file import directives") is COMPLEMENTARY, not contradictory — it
     clarifies that in-file directives (written by hand in the .md) use the author's editor's normal file
     completion. Keep both; they describe different surfaces. -->

<!-- GOTCHA — the §10 missing-import edge (a markdown importing a missing file leaves the `#@` marker verbatim)
     lands via S4 in parallel. This is the SAME behavior as a top-level missing token ("Missing file… → Left as
     written. Nothing is appended." — already in the table). No separate README bullet is needed; the general
     "each import delivered as its own block" note in clause (c) covers it. Adding a §10-specific edge case
     would over-complicate the user quickstart. -->

<!-- STYLE — match the existing README idiom exactly: -->
<!--   * fenced examples use ```text (not ```markdown), e.g. the Usage example block L23-29. -->
<!--   * in-Syntax subsections use a `**Bold lead-in.**` sentence (see **Where it matches:** L60, **Paths:** L68). -->
<!--   * Limit bullets use `- **Bold lead-in.**` followed by a short explanation (see L72-76). -->
<!--   * backticks around paths, triggers, and code: `#@spec.md`, `.md`, `#@`, `read` tool. -->
<!--   * em-dashes (—) for asides, matching the existing prose. -->
```

## Implementation Blueprint

> Read `README.md` in full before editing. All edits are **in-place insertions** using the `edit` tool with
> exact `oldText` anchors. Each clause below gives the exact anchor (a unique snippet from the current README)
> and the exact text to insert. Use em-dashes (—) and backticks to match the existing style.

### Clause (a) — Why: append a 3rd paragraph

**Anchor** (the last sentence of `## Why`, L9): 
```
When the file fits the remaining context it is injected whole; when it exceeds the budget it is delivered as a head block plus a paging directive that the model reads through.
```

**Insert immediately AFTER that paragraph** (a blank line, then the new paragraph):
```markdown

`#@spec.md` pulls in everything `spec.md` references with the same `#@` directive — spec-and-its-dependencies in one token, loop-safe via dedup (each file is injected at most once).
```

### Clause (b) — Usage: add a markdown-import example

**Anchor** (the marker-strip explanation paragraph, L31):
```
On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath.
```

**Insert immediately AFTER that paragraph** (blank line, then the new paragraph + fenced example):
```markdown

Markdown files can import other files. If `spec.md` itself contains `#@api.md`, a single `#@spec.md` delivers both — `spec.md` first, then `api.md` — and the import marker is stripped from `spec.md` the same way a top-level marker is:

```text
#@spec.md          # spec.md contains: see #@api.md
```
```

> **Gotcha:** the fenced block above uses ```` ```text ```` and shows an inline `#` comment to convey the
> nesting. Keep it to 1–2 lines. Do NOT enumerate every rule here — that is Syntax's job (clause d).

### Clause (c) — What gets injected: add a note paragraph after the table

**Anchor** (the end of the 4-row table — the `Missing file` row, L42):
```
| Missing file, directory, or permission error | Left as written. Nothing is appended. |
```

**Insert immediately AFTER that table row** (blank line, then the note paragraph — BEFORE the
`Text uses Pi's native block format` paragraph at L46):
```markdown

A delivered markdown file (`.md` or `.markdown`) is also scanned for relative `#@` imports. Each import it references is delivered as its own block, and is scanned in turn if it is also markdown — so a single `#@spec.md` can pull in a whole tree of docs. The same file-type rules (text / image / binary / missing) apply to each import unchanged.
```

> **Do NOT** modify the four table rows. The note is additive.

### Clause (d) — Syntax: add a `**Markdown imports.**` subsection

**Anchor** (the **Paths:** paragraph, L68):
```
**Paths:** relative (against your current directory), absolute (`#@/etc/hosts`), tilde (`#@~/notes.md`), and `../` all work.
```

**Insert immediately AFTER that paragraph** (blank line, then the new subsection — matching the
`**Bold lead-in.**` style of the surrounding Syntax subsections):
```markdown

**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Four rules narrow it:

- **Relative paths only.** Imports resolve against the markdown file's own directory, not your current directory. Absolute (`#@/etc/hosts`) and tilde (`#@~/notes.md`) imports inside a markdown file are ignored and left verbatim.
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
- **Each file is injected at most once.** Across the whole prompt — top-level tokens, every import, and cycles — a given file appears in one block only. Shared dependencies dedup; cycles terminate.
- **Shared budget.** Imports draw on the same context budget as the top-level prompt. When the running total exceeds the window, later files page (head block plus a `read`-tool directive) instead of overflow.
```

> **Abstraction guard:** this states the 4 user-facing rules. Do NOT add the 6-step algorithm, the
> code-region regexes, or the token formula. Match the abstraction of **Paths:** above it.

### Clause (e) — Limits: add three bullets

**Anchor** (the last current bullet — the backtick bullet, L76):
```
- **A backtick right after `#@` blocks it.** Inside a code span like `` `#@a.ts` ``, nothing is injected. To suppress `#@` anywhere, write `# @` with a space.
```

**Insert immediately AFTER that bullet** (three new bullets, same `- **Bold lead-in.**` style):
```markdown
- **Markdown imports are relative-only.** A `#@` inside a `.md`/`.markdown` file that points at an absolute or tilde path is ignored, never resolved.
- **Only markdown is scanned.** A `#@` inside an injected `.ts`, `.json`, image, or any other non-markdown file is inert — only `.md`/`.markdown` pull in further files.
- **No autocomplete for in-file imports.** The `#@` path completer runs in the editor prompt only. Import directives live inside markdown files (written by hand), where your editor's normal file completion applies.
```

> **Complementarity check:** the Usage section's path-completion sentence describes the TOP-LEVEL completer;
> this bullet clarifies in-file directives get no completer. Both stay; they describe different surfaces.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 0: READ the current README.md IN FULL (all 83 lines)
  - WHY: absorb the tone (prose-first, ```text blocks, **Bold lead-in.** subsections, backticks, em-dashes)
    and the exact wording of the paged-delivery phrases you must NOT contradict.
  - CONFIRM: the section anchors above still match (L9, L31, L42, L68, L76). If a prior edit shifted them,
    re-grep (`grep -n "## \|^\*\*Paths:\|exceeds the budget" README.md`). The ANCHOR TEXT is what matters,
    not the line number.

Task 1: EDIT clause (a) — Why: insert the 3rd paragraph after the "paging directive that the model reads
        through." paragraph. (1 edit.)

Task 2: EDIT clause (b) — Usage: insert the markdown-import example after the "with the file appended
        underneath." paragraph. (1 edit.)

Task 3: EDIT clause (c) — What gets injected: insert the note paragraph after the table's "Left as written.
        Nothing is appended." row, before the "Text uses Pi's native block format" paragraph. (1 edit.)

Task 4: EDIT clause (d) — Syntax: insert the **Markdown imports:** subsection after the **Paths:** paragraph.
        (1 edit.)

Task 5: EDIT clause (e) — Limits: insert three bullets after the "A backtick right after `#@` blocks it."
        bullet. (1 edit.)

Task 6: VERIFY consistency (manual review)
  - Re-read the whole README end-to-end. Confirm it reads coherently.
  - GREP for stale phrases that must NOT appear: `grep -niE "no size limit|entire contents|no truncation" README.md`
    → expect NO output (plan 002 removed these; the new content must not reintroduce them).
  - GREP for the new markdown content: `grep -niE "markdown import|relative paths only|escape hatch|at most once|shared budget|inert|autocomplete for in-file" README.md`
    → expect all five sections represented.
  - CONFIRM the four table rows are intact and unchanged (grep the table for "| Text (", "| Image (",
    "| Other binary", "| Missing file").

Task 7: VERIFY no code drift (the regression gate)
  - RUN: cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs
  - EXPECT: `Result: 75 passed, 0 failed.` (exit 0). README edits do NOT affect code; if this number changed,
    you accidentally edited a non-README file — revert it.
```

### Implementation Patterns & Key Details

```markdown
# The five edits are PURE INSERTIONS. Each uses the edit tool with:
#   oldText = a unique snippet from the current README (the "anchor" — the END of the section/paragraph/bullet
#             you're appending after)
#   newText = the SAME snippet + a blank line + the new content
#
# Example shape (clause a):
#   oldText: "...delivered as a head block plus a paging directive that the model reads through."
#   newText: "...delivered as a head block plus a paging directive that the model reads through.\n\n`#@spec.md`
#             pulls in everything `spec.md` references with the same `#@` directive — ..."
#
# GOTCHA — every oldText MUST be unique in the file. The paragraph-ending sentences above are unique
# (verified). Do NOT use a fragment that appears twice (e.g. the word "markdown" alone).
#
# GOTCHA — preserve the blank-line rhythm: one blank line between paragraphs/bullets (GitHub Markdown). The
# insertions above each start with "\n\n" (a blank line) to maintain this.
#
# GOTCHA — fenced code blocks inside a fenced ```text block: clause (b)'s example is a ```text block. If you
# author the PRP-content via the edit tool, make sure the nested fences are literal in README.md (they are —
# the README renders them as a code block, which is the intent).
```

### Integration Points

```yaml
FILE EDITS:
  - modify: ./README.md
    add (5 in-place insertions): clauses (a)–(e) per the Blueprint above. Each is an `edit` with a unique
          paragraph/row/bullet-ending anchor.
    preserve: the intro (L1–3); ## Install (L11–17); the four table rows; the <file> block-format example;
          the "Images are matched by their real bytes" paragraph; the paged-delivery phrasing (Why L9, table
          Text row L39, Limits L72); ## `#@` versus `@` (L78–83).

NO OTHER CHANGES:
  - file-injector.ts / file-injector.test.mjs / package.json / PRD.md / plan/**: UNTOUCHED.
  - no new files, no new deps, no new exports, no new constants.

VALIDATION GATE (unchanged, confirms scope discipline):
  - node ./file-injector.test.mjs → `75 passed, 0 failed`. (README does not affect this; running it proves no
    non-README file was accidentally edited.)
```

## Validation Loop

> **There is no automated test for README content** (and we do not add one — the test harness exercises code,
> not docs). Validation is structural + accuracy + consistency + a no-drift gate.

### Level 1: Structural completeness (manual review)

```bash
cd /home/dustin/projects/pi-file-injector
# Confirm all 5 sections were edited (each clause left a searchable phrase):
grep -niE "markdown import|relative paths only|escape hatch|at most once|shared budget|only markdown is scanned|autocomplete for in-file" README.md
# Expected: ≥1 hit in EACH of: Why (clause a: "pulls in everything"), Usage (clause b: the example),
#           What-gets-injected (clause c: "scanned for relative"), Syntax (clause d: "Markdown imports:"),
#           Limits (clause e: "relative-only" / "Only markdown" / "autocomplete for in-file").
#
# Confirm the untouched sections are STILL present and intact:
grep -nE "^## Install|^## \`#@ \` versus \`@\`" README.md     # both headings present
grep -nE "\| Text \(|\| Image \(|\| Other binary|\| Missing file" README.md  # 4 table rows intact
```

### Level 2: Accuracy (every README claim matches the landed code)

```bash
# Verify the behaviors the README asserts are TRUE in file-injector.ts (read-only check):
cd /home/dustin/projects/pi-file-injector
grep -n 'MD_EXTS = new Set(\["md", "markdown"\])' file-injector.ts   # only .md/.markdown scanned
grep -n 'allowAbsTilde: false, skipCode: true' file-injector.ts      # relative-only + code-exempt
grep -n 'path.dirname(abs)' file-injector.ts                         # resolve from md's directory
grep -n 'export function computeCodeRanges' file-injector.ts         # code-region escape hatch exists
grep -n 'estimateImageTokens' file-injector.ts                       # shared budget for images
# Expected: a hit on each. If any is absent, the feature isn't fully landed — STOP and flag (this task
# depends on S1–S4 all being green).
```

### Level 3: Consistency — no contradiction with paged delivery (OUTPUT clause 4)

```bash
cd /home/dustin/projects/pi-file-injector
# Stale phrases that MUST NOT appear (plan 002 removed them; verify the new content didn't reintroduce):
grep -niE "no size limit|entire contents|no truncation|no maximum" README.md
# Expected: NO output. If a line prints, remove the stale phrase — it contradicts paged delivery.

# The paged-delivery story must be coherent across Why / Table / Limits / new markdown budget line:
grep -niE "paged|paging directive|remaining context|head block|read tool" README.md
# Read every hit. The new "Shared budget … later files page (head block plus a read-tool directive)" line
# in clause (d) must use the SAME vocabulary as the existing paged phrasing — it does.
```

### Level 4: No code drift (the regression gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   Result: 75 passed, 0 failed.
# Exit code 0.
#
# README edits do NOT affect code. If the count is NOT 75 / 0, you accidentally edited a non-README file
# (file-injector.ts / file-injector.test.mjs / package.json) — `git status` to find it, revert it, re-run.
git status --short
# Expected: ONLY README.md modified. If anything else is listed, revert it.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `Result: 75 passed, 0 failed`, exit 0.
- [ ] `git status --short` shows ONLY `README.md` modified (no other file touched).
- [ ] Every README claim matches `file-injector.ts` (Level 2 greps all hit).

### Feature Validation (the five clauses)

- [ ] **(a) Why** — 3rd paragraph present: `#@spec.md` pulls in everything referenced, same `#@`, loop-safe via dedup.
- [ ] **(b) Usage** — markdown-import example present: `#@spec.md` where spec.md contains `#@api.md` delivers both.
- [ ] **(c) What gets injected** — note after the table: `.md`/`.markdown` scanned for relative `#@` imports; each its own block; recursed if markdown.
- [ ] **(d) Syntax** — `**Markdown imports:**` subsection with all four rules (relative-only + resolve-from-md-dir; code escape hatch; dedup-once; shared budget).
- [ ] **(e) Limits** — three bullets: relative-only; only-markdown-scanned (non-markdown `#@` inert); no autocomplete for in-file directives.

### Consistency & Style Validation

- [ ] `grep -niE "no size limit|entire contents|no truncation|no maximum" README.md` → no output (no stale phrases).
- [ ] The paged-delivery phrasing (Why / table Text row / Limits "No size knob") is UNCHANGED and non-contradictory with the new markdown budget line.
- [ ] Untouched sections intact: intro, `## Install`, the four table rows, `## `#@` versus `@``.
- [ ] Style matches existing README: ```` ```text ```` fenced examples, `**Bold lead-in.**` subsections, backticks around `#@`/paths/`read`, em-dashes for asides.
- [ ] Abstraction level is user-facing (NO 6-step algorithm, NO code-region regexes, NO token formula, NO §10 edge deep-dive).

### Documentation

- [ ] The README reads coherently end-to-end (re-read it fully after editing).
- [ ] No internal/implementation detail leaked (no `injectMarkdown`, `scanTokens`, `computeCodeRanges`, `estimateImageTokens`, `IMAGE_FALLBACK_TOKENS`, line numbers, or PRD section numbers in the user-facing prose).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT rewrite any README section.** All five edits are in-place insertions. Rewriting risks breaking
  the paged-delivery wording (plan 002) and the coherent Why→Usage→What→Syntax→Limits arc.
- ❌ **Do NOT touch any file other than README.md.** This is Mode B docs. Editing `file-injector.ts`,
  `file-injector.test.mjs`, `package.json`, `PRD.md`, or any `plan/` file is out of scope and a failure.
  `git status --short` must show ONLY `README.md`.
- ❌ **Do NOT copy the PRD's implementation detail into the README.** No 6-step algorithm, no `computeCodeRanges`
  regexes, no `Math.ceil(content.length/4)` token formula, no §5.6.1 CommonMark detection, no §10 stat-pre-check
  edge. The README is a user quickstart at the abstraction of `**Paths:** relative (against your current
  directory)…`. State the 4 user-facing rules; that's it.
- ❌ **Do NOT reintroduce stale size phrases.** "no size limit", "entire contents", "no truncation" were removed
  in plan 002 because they contradicted paged delivery. The new markdown budget line shares the SAME budget
  story — keep it consistent; never add a second, contradictory size narrative.
- ❌ **Do NOT modify the four table rows.** Clause (c) adds a NOTE paragraph after the table; the rows
  (Text/Image/Other binary/Missing) stay byte-for-byte. The §10 missing-import edge is consistent with the
  existing "Missing file… → Left as written" row — do NOT add a markdown-specific missing-row variant.
- ❌ **Do NOT skip the regression gate.** Running `node ./file-injector.test.mjs` (expect `75 passed, 0 failed`)
  is how you PROVE you didn't accidentally edit code. A passing gate is mandatory, not optional.
