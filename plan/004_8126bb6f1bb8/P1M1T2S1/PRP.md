---
name: "P1.M1.T2.S1 — README.md: add Extension shorthand bullet to the Markdown imports subsection"
prd_ref: "PRD §4.5 rule 3 (Extension shorthand), §4.4 (top-level exact-only), §13.6 (why markdown-only), §14.4 (scope note)"
target_file: "./README.md"   # EDIT IN PLACE — insert one bullet + one count-word tweak in the Syntax → Markdown imports block
target_language: Markdown (user-facing doc; no code, no tests, no build)
depends_on: "P1.M1.T1.S1 (Complete — ships resolveImportPath/isRegularFile/async scanTokens/tryMdExt wiring + Mode A per-file JSDoc; behavior is fixed) + P1.M1.T1.S2 (Ready, parallel — adds acceptance cases 21–24 + EDG-1..4 that prove the contract)"
consumed_by: "(none — this is the terminal Mode B changeset-level documentation task for the delta; the feature is documented here for end users)"
---

# PRP — P1.M1.T2.S1: README.md — add Extension shorthand bullet to the Markdown imports subsection

> **Scope flag:** This is the **Mode B changeset-level documentation sync** (item §7). It edits **README.md
> ONLY** — inserts ONE bullet ("Extension shorthand") into the existing Markdown-imports subsection of the
> `## Syntax` section, plus changes one count word ("Four" → "Five") in that subsection's intro sentence to
> keep the doc internally consistent. No source code, no tests, no new files. The feature itself is shipped
> (P1.M1.T1.S1) and validated (P1.M1.T1.S2); this subtask surfaces it to users.

---

## Goal

**Feature Goal:** Document the extension-shorthand resolution rule (PRD §4.5 rule 3) in README.md's
Markdown-imports subsection so users discover that a markdown import may omit the `.md`/`.markdown`
extension (`#@PRD` → `PRD.md`), that exact-match always wins, and that this is a markdown-import
convenience only (top-level prompt tokens stay exact-only, PRD §4.4).

**Deliverable:** A modified `./README.md` where the **Syntax → Markdown imports** block contains a new
5th bullet — "**Extension shorthand.**" — placed immediately after the "Relative paths only." bullet,
plus the intro sentence count word updated from "Four rules narrow it:" to "Five rules narrow it:".

**Success Definition:** `git diff README.md` shows exactly TWO logical changes: (1) one inserted bullet
(3-4 lines) between the "Relative paths only." and "Code is the escape hatch." bullets; (2) the single
word "Four" → "Five" in the intro sentence. Every other line of README.md is byte-for-byte unchanged.
A human re-read of the subsection confirms the bullet reads coherently and does not contradict the
existing import bullets (relative-only, code-exempt, dedup, budget). No test run is affected (README.md
is not loaded by the test harness).

## User Persona

**Target User:** Pi end-user who writes `#@<path>` in prompts and authors markdown files containing
`#@<path>` import directives.

**Use Case:** A user writes `#@PRD` inside a `spec.md` file expecting it to pull in `PRD.md` (a natural,
extensionless reference in a doc that has no live path completion). They need to know (a) this works,
(b) a bare `PRD` file would win over `PRD.md`, and (c) the same shorthand does NOT apply at the prompt
(where they have autocomplete and must type the full name).

**User Journey:** User reads the README's Syntax section → Markdown imports block → sees the new
"Extension shorthand" bullet alongside the other import rules → writes `#@PRD` in their markdown →
`PRD.md` is injected → marker stripped to `PRD`.

**Pain Points Addressed:** Without this bullet, the shorthand is an undocumented behavior — a user who
sees `#@PRD` resolve to `PRD.md` may think it's magic or a bug, and a user who doesn't know about it
keeps typing `#@PRD.md` by hand in every markdown import. The bullet makes the convenience discoverable
and the exact-wins / top-level-exact-only boundaries explicit.

## Why

- **User-facing discoverability for a shipped convenience.** The shorthand (PRD §4.5 rule 3) is shipped by
  P1.M1.T1.S1 and acceptance-tested by P1.M1.T1.S2 (cases 21–24 + EDG-1..4). But the README — the only
  user-facing doc — currently lists only 4 import rules and says nothing about extension omission. Users
  authoring markdown imports have no editor path completion (PRD §14.4), so an extensionless `#@PRD` is
  the natural way to reference `PRD.md`; they should be told this works.
- **Surfaces the sharp edges honestly.** "Exact match wins" and "top-level stays exact-only" are the two
  boundaries a user can trip over (expecting `#@PRD.md` to also try `.markdown`, or expecting `#@PRD` at
  the prompt to resolve to `PRD.md`). Documenting them prevents confusion and matches the PRD's
  design-rationale tone (§13.6 "Why extension shorthand, and why markdown-only").
- **Completes the delta's documentation.** This is the ONLY changeset-level doc task in the delta (item
  §7; per-file Mode A JSDoc was done in S1). Landing it leaves the README consistent with the shipped
  behavior and the PRD.

## What

A single bullet added to README.md's `## Syntax` → **Markdown imports** block, plus a one-word count fix.
No code, no tests, no other doc sections touched.

### Success Criteria

- [ ] README.md's Markdown-imports block contains a new bullet beginning "**Extension shorthand.**",
      placed immediately after the "**Relative paths only.**" bullet and before "**Code is the escape hatch.**".
- [ ] The new bullet states: a markdown import may omit `.md`/`.markdown`; `#@PRD` → `PRD.md` (then
      `PRD.markdown`) when no bare `PRD` exists; exact match wins (a bare `readme` beats `readme.md`);
      a token already carrying any extension is left as-is (so `#@PRD.md` never becomes `PRD.md.md`);
      markdown-import only — at the prompt you type the full name.
- [ ] The intro sentence of the Markdown-imports block reads "Five rules narrow it:" (was "Four rules
      narrow it:") so the count matches the new bullet total.
- [ ] `git diff README.md` shows ONLY: (a) the one inserted bullet, (b) the "Four" → "Five" word change.
      The four existing import bullets, the `## Syntax` intro, the `#@`-versus-`@` section, the Limits
      section, the Install/Usage sections, the Why section, and the What-gets-injected table are all
      byte-for-byte unchanged.
- [ ] A human re-read confirms the new bullet reads coherently next to "Relative paths only." and does not
      contradict relative-only / code-exempt / dedup / budget (item §6).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the exact README.md subsection (quoted verbatim with its 4
existing bullets), the exact insertion point (after "Relative paths only."), the exact bullet text
(drafted to match the README's tone/formatting), the one-word intro tweak ("Four" → "Five"), the
cross-check against the shipped behavior (PRD §4.5 rule 3 + delta_analysis decision matrix + T1.S2 cases
21–24), and the validation approach (git diff scope + eyeball; no test gate). The implementer edits ONE
file in TWO spots, then re-reads the subsection.

### Documentation & References

```yaml
# MUST READ — the exact spec for the shorthand (the behavior being documented)
- file: PRD.md
  why: "§4.5 rule 3 (Extension shorthand: extensionless token → exact-first → .md → .markdown; exact-wins;
        already-extended tokens are exact-only so #@PRD.md never becomes PRD.md.md); §4.4 (top-level
        exact-only — NO fallback at the prompt); §13.6 (why markdown-only: imports are authored in files
        with no live completion); §14.4 (autocomplete is prompt-only). The README bullet must match this."
  section: "### 4.5 rule 3 + ### 4.4 + ### 13.6 + ### 14.4"
  critical: "The README bullet is a USER-FACING SUMMARY of §4.5 rule 3 + §4.4. It must convey: (a) the
             shorthand exists for markdown imports, (b) exact-wins, (c) already-extended tokens don't
             double-extend, (d) top-level prompt tokens do NOT get the fallback. Omit the resolve-from-md-dir
             detail (that's the 'Relative paths only' bullet's job) and the dedup detail (that's the
             'Each file once' bullet's job) — keep this bullet scoped to the EXTENSION rule only."

# MUST READ — the decision matrix (proves the bullet's claims against real resolution traces)
- file: plan/004_8126bb6f1bb8/architecture/delta_analysis.md
  why: "The 'Decision matrix (token → behavior)' table maps each bullet claim to a concrete case:
        'api' (no bare) → api.md = case 21; 'readme' (bare exists) → bare readme wins = case 22;
        'api' (only .markdown) → api.markdown = case 23; top-level 'PRD' (only PRD.md) → verbatim = case 24;
        'PRD.md' missing → exact-only, never .md.md = EDG-2. The README example '#@PRD → PRD.md' is backed
        by P1.M1.T1.S1's real PRD.md fixture."
  critical: "The bullet's exact-wins example uses 'a bare readme beats readme.md' — this mirrors the delta
             matrix's case-22 row (bare readme wins). Do NOT change the example to 'guide' (that's the TEST
             fixture name from T1.S2, chosen to avoid collisions); the README uses 'readme' / 'PRD' because
             those are the PRD's canonical user-facing examples (§4.5 rule 3, §13.6)."

# MUST READ — the file you edit (the ONLY change)
- file: README.md
  why: "103 lines. The target is the '## Syntax' section → '**Markdown imports:**' block. That block has an
        intro sentence ending 'Four rules narrow it:' followed by exactly 4 bullets ('Relative paths only.',
        'Code is the escape hatch.', 'Each file is injected at most once.', 'Shared budget.'). The new bullet
        inserts AFTER 'Relative paths only.' and BEFORE 'Code is the escape hatch.'; the intro count word
        flips Four→Five."
  pattern: "Mirror the existing bullets' format: a blank line, then '- **<Bold lead phrase>.**' followed by
            2-4 lines of prose with concrete backticked examples (`#@PRD`, `PRD.md`, `PRD.markdown`, `readme`)."
  gotcha: "The intro sentence currently says 'Four rules narrow it:' — with a 5th bullet added, this MUST
           become 'Five rules narrow it:' or the doc contradicts itself. This count-word tweak is NOT
           'editing one of the four existing import bullets' (the item's prohibition); it's a consistency
           fix to the intro sentence. Leaving 'Four' with 5 bullets would violate item §6 ('does not
           contradict the existing import bullets')."

# READ-ONLY context — the shipped behavior being documented (S1) + its acceptance proof (T1.S2)
- file: plan/004_8126bb6f1bb8/P1M1T1S1/PRP.md
  why: "S1 ships resolveImportPath (exact → .md → .markdown, extensionless-only) + isRegularFile + async
        scanTokens with tryMdExt (false at top-level, true at markdown) + Mode A per-file JSDoc + fixtures
        README/README.md/PRD.md. Confirms the behavior the README bullet describes is the SHIPPED behavior."
- file: plan/004_8126bb6f1bb8/P1M1T1S2/PRP.md
  why: "T1.S2 adds acceptance cases 21–24 + EDG-1..4 — the end-to-end proof of the exact contract the README
        bullet summarizes. Case 21 (#@api→api.md), 22 (exact-wins), 23 (.markdown fallback), 24 (top-level
        verbatim), EDG-2 (never .md.md), EDG-3 (dedup on resolved abs). The README bullet's claims are the
        user-facing version of these cases."
```

### Current Codebase tree

```bash
pi-file-injector/
├── README.md                # ← THE ONLY FILE EDITED (103 lines; insert 1 bullet + 1 count-word in ## Syntax)
├── file-injector.ts         # untouched (S1's deliverable — resolveImportPath/isRegularFile/async scanTokens)
├── file-injector.test.mjs   # untouched (T1.S2's deliverable — cases 21–24 + EDG-1..4; parallel)
├── scripts/typecheck.mjs    # untouched
├── package.json             # untouched
├── PRD.md                   # read-only
└── plan/004_8126bb6f1bb8/
    ├── architecture/{codebase_insertion_points.md, delta_analysis.md, external_deps.md, system_context.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← the shipped source contract
    ├── P1M1T1S2/{research/research_notes.md, PRP.md}   # ← the acceptance-proof contract (parallel)
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← insertion-point + bullet-text + cross-check analysis (this subtask)
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
README.md    # MODIFIED — insert one "Extension shorthand." bullet after "Relative paths only." in the
             #                  ## Syntax → Markdown imports block; change intro "Four" → "Five".
# No other files. No new files. No source/test changes.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — the intro sentence says "Four rules narrow it:". Adding a 5th bullet makes that count wrong.
     Change "Four" → "Five" in the SAME edit. This is a consistency fix to the intro sentence, NOT an edit
     to one of the four existing import bullets (the item's prohibition is about the BULLETS, not the intro).
     Leaving "Four" with 5 bullets contradicts item §6 ("does not contradict the existing import bullets"). -->

<!-- CRITICAL — placement is AFTER "Relative paths only." (bullet 1), NOT at the end. The shorthand is a
     RESOLUTION RULE (how a token resolves to a file), the same category as "Relative paths only".
     PRD §4.5 orders them: rule 1 relative-only, rule 2 base-dir, rule 3 extension shorthand, rule 4 code-exempt.
     The README's bullets follow that grouping, so shorthand slots right after relative-only. Appending at the
     end would separate two resolution rules. Inserting between bullets 1 and 2 does NOT edit either bullet. -->

<!-- CRITICAL — do NOT edit any of the 4 existing bullets, the ## Syntax intro, the #@-versus-@ section, the
     Limits section, Install, Usage, Why, or the What-gets-injected table (item §3). The ONLY changes are the
     new bullet + the "Four"→"Five" word. `git diff README.md` must show exactly those two logical changes. -->

<!-- GOTCHA — match the README's bullet formatting exactly: blank line, then `- **<Lead phrase>.**` then 2-4
     lines of prose with backticked examples. The existing bullets wrap at ~the same column; keep the new
     bullet's line wrapping consistent (don't drop a long unbroken line). -->

<!-- GOTCHA — the example uses `#@PRD` / `PRD.md` / `PRD.markdown` and "a bare readme beats readme.md"
     (the PRD's canonical user-facing examples, §4.5 rule 3 + §13.6). Do NOT use `guide`/`api`/`specdoc`
     — those are T1.S2's TEST fixture names (chosen to avoid S1 collisions). The README is user-facing prose
     and uses the PRD's vocabulary. This is consistent with the existing Usage-section example `#@spec.md`. -->

<!-- GOTCHA — no test gate. README.md is NOT loaded by file-injector.test.mjs (the harness imports
     file-injector.ts via jiti). So this doc change cannot break any test. Validation = git diff scope +
     human re-read (item §6). Do NOT run the test suite expecting it to validate the README. -->
```

## Implementation Blueprint

### The exact README.md target block (verbatim, current state)

The `## Syntax` section of README.md contains this block (the new bullet inserts after bullet 1):

```markdown
**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Four rules narrow it:

- **Relative paths only.** Imports resolve against the markdown file's own directory, not your current directory. Absolute (`#@/etc/hosts`) and tilde (`#@~/notes.md`) imports inside a markdown file are ignored and left verbatim.
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
- **Each file is injected at most once.** Across the whole prompt — top-level tokens, every import, and cycles — a given file appears in one block only. Shared dependencies dedup; cycles terminate.
- **Shared budget.** Imports draw on the same context budget as the top-level prompt. When the running total exceeds the window, later files page (head block plus a `read`-tool directive) instead of overflow.
```

### The exact edits

**Edit 1 — the intro count word** (consistency fix so the count matches the new bullet total):

```diff
-**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Four rules narrow it:
+**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Five rules narrow it:
```

**Edit 2 — insert the new bullet** between the "Relative paths only." bullet and the "Code is the escape hatch." bullet:

```markdown
- **Extension shorthand.** A markdown import may omit the `.md`/`.markdown` extension: `#@PRD` resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats `readme.md`), and a token already ending in any extension is left as-is (so `#@PRD.md` never becomes `PRD.md.md`). This is a markdown-import convenience only — at the prompt you type the full name.
```

### Resulting block (after both edits — for review)

```markdown
**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Five rules narrow it:

- **Relative paths only.** Imports resolve against the markdown file's own directory, not your current directory. Absolute (`#@/etc/hosts`) and tilde (`#@~/notes.md`) imports inside a markdown file are ignored and left verbatim.
- **Extension shorthand.** A markdown import may omit the `.md`/`.markdown` extension: `#@PRD` resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats `readme.md`), and a token already ending in any extension is left as-is (so `#@PRD.md` never becomes `PRD.md.md`). This is a markdown-import convenience only — at the prompt you type the full name.
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
- **Each file is injected at most once.** Across the whole prompt — top-level tokens, every import, and cycles — a given file appears in one block only. Shared dependencies dedup; cycles terminate.
- **Shared budget.** Imports draw on the same context budget as the top-level prompt. When the running total exceeds the window, later files page (head block plus a `read`-tool directive) instead of overflow.
```

### Why the bullet text is shaped this way (cross-check vs. the contract)

| Bullet claim | PRD / delta_analysis source | Acceptance case (T1.S2) |
|---|---|---|
| "may omit the `.md`/`.markdown` extension" | PRD §4.5 rule 3 | case 21 (`#@api` → `api.md`) |
| "`#@PRD` resolves to `PRD.md` (then `PRD.markdown`)" | PRD §4.5 rule 3; delta_analysis ladder | case 21 (.md), case 23 (.markdown fallback) |
| "when no bare `PRD` exists" | PRD §4.5 rule 3 ("when the exact path is not an existing regular file") | case 22 (bare exists → wins) |
| "Exact match wins (a bare `readme` beats `readme.md`)" | PRD §4.5 rule 3; delta_analysis case-22 row | case 22 |
| "a token already ending in any extension is left as-is (so `#@PRD.md` never becomes `PRD.md.md`)" | PRD §4.5 rule 3 ("tokens already ending in `.md`/`.markdown` or any other extension are exact-only") | EDG-2 |
| "markdown-import convenience only — at the prompt you type the full name" | PRD §4.4 + §13.6 + §14.4 | case 24 (top-level `#@specdoc` → verbatim) |

Every clause in the bullet maps to a PRD section AND a T1.S2 acceptance case. The bullet is the
user-facing summary of the exact shipped + tested contract.

### Integration Points

```yaml
FILE_EDITS (README.md — exactly two logical changes):
  - intro sentence: "Four rules narrow it:" → "Five rules narrow it:" (consistency; 1 word)
  - bullet insertion: new "- **Extension shorthand.** ..." bullet AFTER "Relative paths only.",
                      BEFORE "Code is the escape hatch."

NO_CHANGES:
  - file-injector.ts: UNTOUCHED (S1's deliverable)
  - file-injector.test.mjs: UNTOUCHED (T1.S2's deliverable)
  - the 4 existing import bullets: UNTOUCHED (item §3 prohibition)
  - ## Syntax intro, #@-versus-@ section, Limits section, Install, Usage, Why, What-gets-injected table: UNTOUCHED
  - package.json / scripts/typecheck.mjs / PRD.md / all plan/ files: UNTOUCHED

NO_CODE / NO_TESTS / NO_NEW_FILES: documentation only.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT README.md — change "Four rules narrow it:" → "Five rules narrow it:"
  - FIND: the "**Markdown imports:**" intro sentence in the ## Syntax section (the line ending "Four rules narrow it:").
  - EDIT: replace the single word "Four" with "Five". Use the edit tool with oldText uniquely scoped to that
          sentence (e.g. oldText: "using the same grammar. Four rules narrow it:" → newText: "using the same
          grammar. Five rules narrow it:").
  - RATIONALE: the new bullet (Task 2) makes the total 5; the count word must match or the doc contradicts
               itself (item §6). This is a consistency fix to the intro sentence, NOT an edit to a bullet.

Task 2: EDIT README.md — insert the "Extension shorthand." bullet after "Relative paths only."
  - FIND: the "- **Relative paths only.**" bullet (ends "...are ignored and left verbatim.").
  - INSERT: immediately after that bullet's line, add a blank line then the new bullet:
        - **Extension shorthand.** A markdown import may omit the `.md`/`.markdown` extension: `#@PRD`
          resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare
          `readme` beats `readme.md`), and a token already ending in any extension is left as-is (so
          `#@PRD.md` never becomes `PRD.md.md`). This is a markdown-import convenience only — at the
          prompt you type the full name.
    (Use the edit tool with oldText = the end of the "Relative paths only." bullet + the start of the
    "Code is the escape hatch." bullet, newText = the same with the new bullet spliced between. This keeps
    the edit surgical and the surrounding bullets byte-for-byte identical.)
  - PLACEMENT: after "Relative paths only." (a resolution rule) and before "Code is the escape hatch."
            (a filtering rule). This groups the two resolution rules together and mirrors PRD §4.5's
            rule ordering (1 relative, 2 base-dir, 3 shorthand, 4 code-exempt).
  - TONE: match the existing bullets — bold lead phrase ending in a period, 2-4 lines, backticked examples.
  - EXAMPLE TOKENS: use `#@PRD` / `PRD.md` / `PRD.markdown` / `readme` (the PRD's canonical user-facing
            examples, §4.5 rule 3 + §13.6). Do NOT use `guide`/`api`/`specdoc` (T1.S2 test-fixture names).

Task 3: VERIFY — git diff scope + human re-read (item §6)
  - RUN: `git diff README.md` — confirm EXACTLY two logical changes: (a) "Four"→"Five", (b) the new bullet.
            No other line touched.
  - READ: the whole "## Syntax" → "Markdown imports" block (now 5 bullets). Confirm:
            (a) the new bullet reads coherently after "Relative paths only.";
            (b) it does NOT contradict relative-only (it's about extensions, not path bases — complementary);
            (c) it does NOT contradict code-exempt / dedup / budget (orthogonal concerns);
            (d) the intro says "Five rules" and there are 5 bullets;
            (e) the `#@PRD` example is consistent with the Usage section's `#@spec.md` example.
  - OPTIONAL cross-check: the bullet's claims match PRD §4.5 rule 3 + §4.4 (see the cross-check table above).
```

## Validation Loop

### Level 1: Edit scope (git diff — the primary check)

```bash
cd /home/dustin/projects/pi-file-injector
git diff README.md
# Expected: exactly TWO hunks (or one hunk covering both changes):
#   (1) "-...Four rules narrow it:" → "+...Five rules narrow it:"
#   (2) the inserted "- **Extension shorthand.** ..." bullet (3-4 added lines) between "Relative paths only."
#       and "Code is the escape hatch."
# If the diff touches ANY other line (an existing bullet, the Syntax intro, Limits, Usage, etc.), the edit
# was too broad — re-scope the edit tool calls to the exact sentences. The 4 existing import bullets must be
# byte-for-byte identical in the diff (only their surrounding line numbers may shift by the insertion).
```

### Level 2: Coherence re-read (item §6 verification)

```bash
cd /home/dustin/projects/pi-file-injector
read README.md   # or: sed -n '/## Syntax/,/## Limits/p' README.md
# Eyeball the Markdown-imports block. Confirm:
#   - 5 bullets, intro says "Five rules narrow it:"
#   - new "Extension shorthand." bullet sits between "Relative paths only." and "Code is the escape hatch."
#   - no contradiction: shorthand is about EXTENSIONS (complementary to relative-only's PATH-BASE rule);
#     it doesn't touch code-exempt / dedup / budget.
#   - `#@PRD` / `PRD.md` / `PRD.markdown` examples render correctly in backticks.
#   - tone/formatting matches the other bullets (bold lead, ~3 lines, concrete examples).
```

### Level 3: Test-suite unaffected (sanity — README is not loaded by the harness)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | tail -3
# Expected: "Result: N passed, 0 failed." (UNCHANGED from whatever the baseline is after S1 + T1.S2 land).
# README.md is NOT imported by the harness (it imports file-injector.ts via jiti), so this doc edit CANNOT
# break any test. Running the suite is a SANITY check that you didn't accidentally touch a source file —
# `git status` should show ONLY README.md modified.
git status --short
# Expected: only " M README.md". If file-injector.ts or file-injector.test.mjs appear, you edited the wrong file.
```

### Level 4: Creative / Domain-Specific Validation

```bash
# Optional: render-check (if a markdown previewer is available, confirm the bullet renders as a list item
# with bold lead + inline code). Not required — GitHub-flavored markdown renders '- **bold.** prose `code`'
# identically to the existing bullets, which are the template.

# Optional: link/consistency sweep — grep README.md for any other mention of "Four rules" or extension
# shorthand to ensure no stale reference elsewhere:
grep -n "rules narrow\|extension shorthand\|\.md`/`.markdown\|omit" README.md
# Expected: the "Five rules narrow it:" line + the new bullet. No other stray references need updating
# (the Usage section's `#@spec.md` example is consistent with the shorthand; no change needed there).
```

## Final Validation Checklist

### Technical Validation

- [ ] `git diff README.md` shows exactly two logical changes (count word + new bullet); no other line touched.
- [ ] `git status --short` shows ONLY `M README.md` (no source/test file accidentally edited).
- [ ] `node ./file-injector.test.mjs` still passes (sanity — README isn't loaded, so this is a no-regression check on the working tree).

### Feature Validation

- [ ] The Markdown-imports block now has 5 bullets; intro says "Five rules narrow it:".
- [ ] The new "**Extension shorthand.**" bullet is placed after "Relative paths only." and before "Code is the escape hatch.".
- [ ] The bullet states: omit `.md`/`.markdown`; `#@PRD` → `PRD.md` (then `PRD.markdown`); exact-wins; already-extended tokens don't double-extend; markdown-import only (prompt types full name).
- [ ] Every bullet claim maps to PRD §4.5 rule 3 / §4.4 + a T1.S2 acceptance case (see cross-check table).

### Code Quality Validation

- [ ] Bullet formatting matches the existing 4 (bold lead phrase ending in `.`, ~3 lines, backticked examples).
- [ ] Example tokens are the PRD's canonical `#@PRD`/`PRD.md`/`PRD.markdown`/`readme` (NOT test-fixture names `guide`/`api`/`specdoc`).
- [ ] No contradiction with relative-only / code-exempt / dedup / budget bullets (orthogonal concerns).
- [ ] The 4 existing import bullets are byte-for-byte unchanged.

### Documentation

- [ ] This subtask IS the Mode B changeset-level documentation sync (item §7). No per-file JSDoc change (S1 owns Mode A).
- [ ] No other doc section (Syntax intro, `#@`-vs-`@`, Limits, Install, Usage, Why, What-gets-injected) modified.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit any of the 4 existing import bullets** (item §3). Insert the new bullet BETWEEN bullets 1
  and 2; don't rewrite "Relative paths only." or "Code is the escape hatch." to "make room."
- ❌ **Do NOT leave the intro saying "Four rules narrow it:"** with 5 bullets. That contradicts item §6.
  Flip "Four" → "Five" in the same edit. (This is a consistency fix to the intro sentence, not a bullet edit.)
- ❌ **Do NOT append the bullet at the end.** The shorthand is a resolution rule (same category as
  "Relative paths only."); placing it right after groups the two resolution rules and mirrors PRD §4.5's
  rule ordering. Appending separates them.
- ❌ **Do NOT use test-fixture token names** (`guide`/`api`/`specdoc`) in the README bullet. Those are
  T1.S2's collision-avoidance fixture names. The README is user-facing prose and uses the PRD's canonical
  examples (`#@PRD`, `PRD.md`, `readme`) — consistent with the existing Usage example `#@spec.md`.
- ❌ **Do NOT touch any source/test file.** This is documentation only. `git status` must show only `README.md`.
- ❌ **Do NOT drop the "never becomes `PRD.md.md`" clause.** It's a sharp edge (EDG-2) users will hit; the
  PRD §4.5 rule 3 calls it out explicitly and the bullet should too.
- ❌ **Do NOT over-specify.** The bullet is a user-facing SUMMARY — omit resolve-from-md-dir (that's the
  "Relative paths only." bullet), dedup-on-resolved-abs (that's "Each file once"), and the async/tryMdExt
  implementation details. Keep it scoped to the EXTENSION rule only.
- ❌ **Do NOT run the test suite expecting it to validate README content.** The harness doesn't load
  README.md. Running it is only a sanity check that you didn't touch a source file.
- ❌ **Do NOT edit the `## Syntax` intro, `#@`-versus-`@`, Limits, Install, Usage, Why, or the
  What-gets-injected table** (item §3). Two logical changes only: the count word + the bullet.

---

## Confidence Score: 10/10

A one-file, two-edit documentation task with the exact target block quoted verbatim, the exact bullet text
drafted to match the README's tone/formatting, the placement decided (after "Relative paths only."), the
intro count tweak specified ("Four"→"Five"), every bullet claim cross-checked against PRD §4.5 rule 3 /
§4.4 + a T1.S2 acceptance case, and a clear validation approach (git diff scope + eyeball; no test gate
since README isn't loaded by the harness). The implementer makes two surgical edits to README.md and
re-reads the subsection. There is no code path, no test, no external dependency, and no ambiguity in the
contract — the only judgment call (placement + the count-word tweak) is documented with rationale. The
feature being documented is already shipped (S1) and acceptance-tested (T1.S2), so the doc cannot
describe behavior that doesn't exist.
