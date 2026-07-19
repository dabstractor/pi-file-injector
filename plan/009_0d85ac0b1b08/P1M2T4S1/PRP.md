---
name: "P1.M2.T4.S1 (plan/009) — Update README.md lines 41, 43, 72 for verbatim prompt behavior (Mode B documentation-only: no passage claims #@ markers are stripped; describe verbatim delivery + re-trigger rationale)"
prd_ref: "PRD §6.4 (Assembly & shared state — the prompt is returned byte-for-byte; event.text left intact, #@ preserved), §13.8 (Why the prompt is preserved verbatim — stripping breaks every re-submission path: cancel/re-open, /tree navigate, /fork, queued-message dequeue), §3.2 (Value proposition — 'the user's message bubble shows the prompt verbatim (#@ preserved so cancel/fork/re-open re-trigger injection); the file bytes never appear in the bubble')"
target_file: "./README.md"   # EDIT 3 lines ONLY (41, 43, 72). NO code change, NO test change, NO config change.
target_language: Markdown (GitHub-flavored prose; the repo's public changeset-level overview)
depends_on: "P1.M1 (the LANDED verbatim engine — injectMarkdown emits verbatim content, injectFiles returns text verbatim) + P1.M2.T1/T2/T3 (verbatim test migrations). README describes the LANDED behavior; this task only syncs the doc to match the code."
consumed_by: "Nothing consumes README at build/runtime. It is the human-facing overview for plan 009's verbatim-delivery behavior. This is the final (Mode B) doc task for P1.M2."
---

# PRP — P1.M2.T4.S1 (plan/009): sync README.md to verbatim prompt behavior

> **Scope flag:** This is a **documentation-only** task (Mode B). **No code change, no test change, no config
> change.** Exactly **3 prose lines** in `README.md` are edited (lines **41**, **43**, **72**) so that **no
> passage anywhere in the README claims a resolved `#@` marker is "stripped."** Instead the README describes the
> **verbatim** prompt behavior that plan 009 landed: `#@` triggers stay in the user's message exactly as typed,
> so cancel/re-open, fork, and re-submit re-trigger injection (PRD §6.4 + §13.8). The file bytes are delivered to
> the model underneath (as a green `read <path>` line + the `<file>` block in the custom message), never pasted
> into the message bubble.
>
> The `git diff` touches **ONLY `README.md`**. The 3 edits are independent text replacements on 3 separate
> non-adjacent lines (no overlap). Six other lines use "left as written" / "left verbatim" / "left as-is" for
> **NON-matching** tokens (60, 88, 94, 95, 96, 135) — those are CORRECT and MUST NOT be touched.

---

## Goal

**Feature Goal:** Make `README.md` accurately describe the **verbatim** prompt delivery that plan 009
implemented (P1.M1 landed; P1.M2.T1/T2/T3 migrated the tests). Specifically: remove the two "stripped" claims
(lines 41 and 43 — the only occurrences of "strip" in the entire README) and replace them with the verbatim
contract; and strengthen line 72's "Your own message shows only what you typed" with the clarifying note that
`#@` markers are preserved verbatim (so re-open/fork re-triggers injection). After this edit, **no sentence in
the README claims a resolved `#@` marker is removed from the user's prompt or from a delivered markdown file.**

**Deliverable:** `README.md` with exactly 3 edited lines (41, 43, 72), no other change. The doc reads as a
coherent, internally-consistent description of verbatim delivery: markers stay verbatim in the prompt and in
delivered markdown content; the model receives the `<file>` bytes underneath; the user bubble shows the prompt
verbatim and the rendering is a green `read <path>` line.

**Success Definition:**
1. `grep -ni "strip" README.md` → **0 hits** (was 2: lines 41 and 43). This is the single deterministic gate
   for "no passage claims markers are stripped."
2. Line 41 describes verbatim delivery (markers stay as typed) + the re-trigger rationale + bytes-underneath,
   and preserves the existing green-`read <path>`-line + `ctrl+o` rendering description.
3. Line 43 says the import marker **stays in `spec.md` verbatim** (same as a top-level marker) — NOT stripped.
4. Line 72 adds the clarifying note: the user's own message shows exactly what was typed — **including the `#@`
   markers** — so re-opening or forking re-triggers injection automatically.
5. The 6 "left as written / left verbatim / left as-is" lines (60, 88, 94, 95, 96, 135) are **byte-for-byte
   unchanged** (these describe NON-matching tokens — the opposite of stripping — and must not be conflated).
6. `git diff --stat` touches **ONLY `README.md`** (no `.ts`, no `.mjs`, no `scripts/`, no `package.json`).
7. `npm run test` and `npm run typecheck` still behave exactly as before (README is not in any test or in the
   typecheck `files:` list — these are belt-and-suspenders, not load-bearing).

## User Persona

**Target User:** The developer/evaluator reading the `README.md` to understand what `#@` does to their prompt —
especially whether cancel/fork/re-open re-delivers the files.

**Use Case:** A user writes `Review #@a.ts`, cancels (ESC), navigates the session tree (`/tree`) back to that
message, and re-submits. They expect the files to re-inject. The README must not mislead them into thinking
`#@` is stripped from the stored prompt (which would imply files vanish on re-open — the exact bug plan 009
fixed).

**Pain Points Addressed:** The pre-plan-009 README claimed `#@` is "stripped from each reference" (line 41) and
"the import marker is stripped from `spec.md`" (line 43). That was the OLD design, which plan 009 reversed
because stripping breaks every re-submission path (PRD §13.8: Pi re-feeds the stored user-message text; a
stripped prompt has no `#@` to re-trigger injection). The README now lagged the code; this task closes that gap.

## Why

- **Doc-code drift is a correctness bug.** The LANDED engine (P1.M1) returns `event.text` byte-for-byte
  (`injectFiles` returns the original `text` verbatim; `injectMarkdown` emits the file-as-read content verbatim
  — import markers are detected ONLY to resolve imports, never stripped). The README still says "stripped." A
  reader trusts the README; the lie must be corrected.
- **The re-trigger property is the headline value of verbatim delivery** (PRD §3.2, §6.4, §13.8). The README's
  Usage section is the first place a user learns what `#@` does to their message bubble — it must state that
  markers are preserved so cancel/fork/re-open re-triggers injection.
- **Internal consistency across the 3 primary "what appears after injection" lines.** `architecture/readme_analysis.md`
  flags lines 41, 43, 72 as the 3 primary passages describing post-injection appearance. Updating only 41 and 43
  would leave 72 subtly incomplete ("shows only what you typed" is true but doesn't mention `#@` is preserved or
  why that matters). The optional 72 clarification makes all 3 coherent.
- **Decoupled from the parallel test work.** P1.M2.T3.S1 (landed) and P1.M2.T3.S2 (in progress) add TEST cases;
  they touch `*.test.mjs`, never `README.md`. This task touches ONLY `README.md`. No collision. The test work
  pins the verbatim contract in code; this task pins it in prose.

## What

No user-visible / API / runtime / logic change. **3 prose edits in `README.md` only.** Each is a precise
text replacement on one line (lines 41, 43, 72 are non-adjacent — no overlap, each edit is independent).

### Success Criteria

- [ ] `grep -ni "strip" README.md` → **0 hits** (the 2 occurrences on lines 41 and 43 are removed).
- [ ] Line 41: contains "`#@` triggers stay in your message exactly as you typed them" + "re-triggers injection"
  + "delivered to the model underneath — never pasted into your message bubble"; does NOT contain "stripped".
- [ ] Line 43: contains "The import marker stays in `spec.md` verbatim"; does NOT contain "stripped".
- [ ] Line 72: the final sentence reads "...Your own message shows exactly what you typed — including the `#@`
  markers — so re-opening or forking re-triggers injection automatically."
- [ ] Lines 60, 88, 94, 95, 96, 135 are **byte-for-byte unchanged** (`git diff` shows no change on them).
- [ ] `git diff --stat` touches **ONLY** `README.md`.
- [ ] `npm run test` and `npm run typecheck` behave exactly as before (no new failures; README is not consumed).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the EXACT current text of each of the 3 target lines (quoted verbatim from the live
README via `grep -n`), the EXACT target replacement text for each (copy-ready), the distinction between
"stripping a resolved marker" (being removed — WRONG, the bug) and "left as written/verbatim/as-is" (a
non-matching token untouched — CORRECT, lines 60/88/94/95/96/135), the single deterministic gate
(`grep -ni strip README.md` → 0), the full PRD rationale (§6.4 + §13.8 + §3.2, with the agent-session.ts
verification), the companion analysis (`architecture/readme_analysis.md` §1-3 + §3's "distinction to preserve"),
the no-collision note (parallel test work touches `.mjs`, never README), and the L41 redundancy judgment call
(replace ONLY sentence 3, keep the rendering sentences 1-2, drop the redundant rendering clause). The
implementer makes 3 `edit` calls (one per line) and runs 2 grep gates.

### Documentation & References

```yaml
# MUST READ — the verbatim contract this doc must describe
- file: PRD.md   # (or plan/009_0d85ac0b1b08/prd_snapshot.md — the merged PRD)
  why: "§6.4 'Assembly & shared state': 'the user message is always the user's prompt verbatim (#@ preserved)';
        the input handler 'leaves event.text byte-for-byte intact — the #@<path> triggers stay exactly where the
        user typed them.' §13.8 'Why the prompt is preserved verbatim (no #@ stripping)': stripping 'breaks
        every re-submission path' — cancel (ESC), fork, /tree navigate, queued-message dequeue — because Pi
        re-feeds the STORED user-message text (agent-session.ts: navigateTree() → _extractUserMessageText() →
        editor.setText; no extension hook can override that prefill). §3.2 Value prop: 'the user's message
        bubble shows the prompt verbatim (#@ preserved so cancel/fork/re-open re-trigger injection); the file
        bytes never appear in the bubble.'"
  section: "§6.4 (verbatim prompt) + §13.8 (why not strip) + §3.2 (value prop)"
  critical: "The README MUST say markers are PRESERVED (verbatim), not STRIPPED. Stripping breaks re-submission.
             The file bytes are ALWAYS in the custom message (the green read <path> line + the <file> block),
             NEVER in the prompt bubble, in EITHER design — so 'never pasted into your message bubble' stays
             accurate; only the 'stripped' claim was wrong."

# MUST READ — the exact current text of the 3 target lines + the no-touch list (read-only)
- file: plan/009_0d85ac0b1b08/architecture/readme_analysis.md
  why: "§1 quotes line 41 in full + its surrounding context (lines 33-51). §2 quotes line 43 in full + its
        fenced example (lines 45-47). §3's table maps EVERY line mentioning strip/verbatim/'left as' — confirms
        'strip' appears ONLY on 41 and 43, and that lines 60/88/94/95/96/135 say 'left as written/verbatim/as-is'
        for NON-matching tokens (the opposite of stripping). §3's 'Distinction to preserve when editing' is the
        exact guardrail for this task. §4 maps the README heading structure (preserve anchors)."
  section: "§1 (L41), §2 (L43), §3 (the full grep table + distinction), §4 (heading anchors)"
  critical: "Lines 60, 88, 94, 95, 96, 135 MUST NOT be touched. They mean 'untouched because nothing matched' —
             a different concept from 'stripping a resolved marker.' Conflating them is the #1 way to corrupt
             this edit. The fenced example under L43 (lines 45-47: '#@spec.md  # spec.md contains: see #@api.md')
             stays as-is."

# The file being edited (read it first; the 3 edits are precise text replacements)
- file: README.md
  why: "Lines 41, 43, 72 are the edit targets. The '## Usage' section (starts L29) contains 41 + 43. The
        '## What gets injected' section (starts L53) contains 72 (inside the <file> block-format paragraph).
        Read the full README once so the surrounding voice/tense/em-dash style is matched."
  pattern: "Prose style: long sentences joined with em-dash (—) + backtick-quoted tokens (`#@`, `read <path>`,
            `spec.md`). Match that style exactly in the replacement text (use — not --; backtick all code-like
            tokens). No markdown headers/lists are added — the edits stay inside existing paragraphs."
  gotcha: "Em-dashes in the current text are U+2014 (—), NOT hyphens. Backticks are ASCII (`). Match these
           exactly in oldText so the edit matches. Do NOT reflow surrounding sentences."

# The LANDED verbatim engine the README now describes (read-only — confirms the behavior the doc must state)
- file: file-injector.ts
  why: "The contract the README must match: injectFiles returns the original `text` verbatim in BOTH the
        count===0 path and the count>0 path (the prompt is never modified); injectMarkdown emits the
        file-as-read content verbatim (import markers detected ONLY to resolve, never stripped). The input
        handler returns { action: 'transform', text: event.text, ... } (text unchanged)."
  pattern: "grep -n 'return { text' file-injector.ts  → both return paths (verbatim); grep -n 'emitText(abs,
            content' → injectMarkdown Step 4 emits verbatim; grep -n 'markers are detected ONLY to resolve' →
            the no-strip contract comment."
  critical: "This file is NOT edited by this task. It is the source of truth the README must match. If you see
             the engine stripping markers, that is a CODE bug outside this task's scope — REPORT it; do not
             change the README to match a buggy engine."
```

### Current Codebase tree (read-only overview — this task edits ONLY README.md)

```bash
pi-file-injector/                # HEAD + plan-009 verbatim engine (P1.M1 LANDED) + P1.M2.T1/T2/T3 test work
├── README.md                    # ← THE ONLY FILE EDITED (3 lines: 41, 43, 72)
├── file-injector.ts             # UNCHANGED (the LANDED verbatim engine — git diff empty)
├── file-injector.test.mjs       # UNCHANGED (P1.M2.T1/T3 scope — in progress in parallel; never README)
├── import-behavior.test.mjs     # UNCHANGED (P1.M2.T2 scope — DONE)
├── relative-imports.test.mjs    # UNCHANGED (P1.M2.T2 scope — DONE)
├── scripts/typecheck.mjs        # UNCHANGED (files: ["file-injector.ts"] — README not consumed)
├── package.json                 # UNCHANGED (no README-consuming script)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{readme_analysis.md, stripping_logic_analysis.md, system_context.md, test_assertions_analysis.md}
    ├── prd_snapshot.md / delta_prd.md / prd_index.txt / tasks.json   # untouched (orchestrator-owned)
    └── P1M1T1S1..P1M2T4S1/{research, PRP.md}   # P1.M1 LANDED; P1.M2.T1/T2 LANDED; T3 in progress; T4 (this)
```

### Desired Codebase tree (files touched)

```bash
README.md    # MODIFIED — exactly 3 lines edited (41, 43, 72). Em-dash + backtick style preserved.
             #           No heading/anchor change. No new section. No reflow of surrounding sentences.
# file-injector.ts + *.test.mjs + scripts/typecheck.mjs + package.json + plan/** are NEVER edited.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — "stripped" (WRONG, remove) vs "left as written/verbatim/as-is" (CORRECT, keep). -->
<!--   - Lines 41 and 43 say a RESOLVED marker is "stripped" (removed from the prompt / from delivered -->
<!--     markdown). That was the pre-plan-009 design. Plan 009 reversed it: markers stay VERBATIM. -->
<!--     These are the ONLY "strip" occurrences in the README — edit them. -->
<!--   - Lines 60, 88, 94, 95, 96, 135 say a NON-matching token (missing/dir/exact-ext/no-match/absolute/tilde/ -->
<!--     code-span/dir-path) is "left as written" / "left verbatim" / "left as-is" — untouched because NOTHING -->
<!--     matched. That is the OPPOSITE of stripping and is CORRECT. Do NOT touch them. -->
<!--     Conflating the two is the #1 corruption risk. -->

<!-- CRITICAL — em-dashes are U+2014 (—), NOT ASCII hyphens. Backticks are ASCII (`). -->
<!--   Match these EXACTLY in every edit's oldText or the edit tool will fail to match. Copy oldText -->
<!--   verbatim from the grep output / this PRP, do not retype by hand. -->

<!-- GOTCHA — line 43 is IMMEDIATELY followed by a fenced code block (lines 45-47): -->
<!--     ```text -->
<!--     #@spec.md          # spec.md contains: see #@api.md -->
<!--     ``` -->
<!--   The replacement for L43 must keep the trailing colon (":") so it still introduces that fenced example. -->

<!-- GOTCHA — L41 is ONE long line (a single paragraph, not a list). The edit replaces text WITHIN that line, -->
<!--   not whole lines. Keep it a single line (no added newlines) so the paragraph stays one logical block. -->

<!-- GOTCHA — there is NO markdown/prettier linter in this repo (.markdownlint*/.prettierrc* absent). -->
<!--   Validation is grep + git-diff scope + readability — NOT a linter pass. Do not invent a lint command. -->

<!-- GOTCHA — the working tree has UNCOMMITTED changes from P1.M2.T3.S1/S2 (file-injector.test.mjs + -->
<!--   tasks.json). Those are NOT yours. `git diff --stat` will show them; confirm YOUR edit is on README.md -->
<!--   ONLY (`git diff --stat README.md`). Do not stage/commit anything. -->
```

## Implementation Blueprint

### Data models and structure

None. This is prose. The "model" is the 3 exact text replacements below, applied with the `edit` tool (3
independent calls — the 3 lines are non-adjacent and non-overlapping).

### The 3 edits (exact oldText → newText)

#### EDIT 1 — line 41 (Usage section): remove "stripped", add verbatim + re-trigger rationale

This line is one long paragraph with 3 sentences. **Sentences 1 and 2** (the rendering description: green
`read <path>` line, one per file, indistinguishable from the `read` tool, `ctrl+o` to expand) are ACCURATE and
MUST be preserved verbatim. **Only sentence 3** (the "stripped" claim) is replaced.

> **L41 redundancy judgment call:** the item description's "Rewrite to" text ends with a rendering clause
> ("Each file renders as a compact green read <path> line below your message"). Sentences 1-2 ALREADY say that,
> better ("indistinguishable from the `read` tool", "`ctrl+o` to expand"). Keeping both creates redundancy.
> Decision: replace ONLY sentence 3, drop the redundant rendering clause, keep the verbatim + re-trigger +
> bytes-underneath content. This is the minimal change that honors the item's intent (remove strip claim, add
> verbatim claim) without duplicating the rendering description.

**oldText (sentence 3 ONLY — unique within README; copy verbatim):**

```
The `#@` trigger is stripped from each reference, so `Review #@a.ts` appears in your message as `Review a.ts`, with the file delivered to the model underneath — never pasted into your message bubble.
```

**newText:**

```
`#@` triggers stay in your message exactly as you typed them (`Review #@a.ts` stays `Review #@a.ts`), so cancelling and re-opening, forking, or re-submitting re-triggers injection. The file bytes are delivered to the model underneath — never pasted into your message bubble.
```

(Rationale: states the verbatim contract, the re-trigger reason, and keeps "never pasted into your message
bubble" — which remains accurate: the bytes live in the custom message / green `read <path>` line, never the
prompt bubble, in EITHER design. PRD §6.4 + §13.8.)

#### EDIT 2 — line 43 (Usage section): "stripped from spec.md" → "stays in spec.md verbatim"

Only the **tail of the sentence** changes (the "— and the import marker is stripped from `spec.md` the same
way a top-level marker is:" clause). The head ("Markdown files can import other files. If `spec.md` itself
contains `#@api.md`, a single `#@spec.md` delivers both — `spec.md` first, then `api.md`") stays verbatim.
**Keep the trailing colon** so it still introduces the fenced example on lines 45-47.

**oldText (the tail clause ONLY — unique within README; copy verbatim):**

```
delivers both — `spec.md` first, then `api.md` — and the import marker is stripped from `spec.md` the same way a top-level marker is:
```

**newText:**

```
delivers both — `spec.md` first, then `api.md`. The import marker stays in `spec.md` verbatim (same as a top-level marker):
```

(Rationale: the import marker is now PRESERVED VERBATIM in the delivered markdown content, matching the
top-level behavior from Edit 1. PRD §5.6 Step 4 + §6.4.)

#### EDIT 3 — line 72 (What gets injected section): optional clarification — add the "#@ preserved" note

The current final sentence "Your own message shows only what you typed." is still accurate (the user sees their
prompt, not file contents). The item description marks the clarification as OPTIONAL but recommends it for
consistency across the 3 primary passages. **Apply it** so all 3 lines coherently state the verbatim contract.

**oldText (the final sentence ONLY — unique within README; copy verbatim):**

```
Your own message shows only what you typed.
```

**newText:**

```
Your own message shows exactly what you typed — including the `#@` markers — so re-opening or forking re-triggers injection automatically.
```

(Rationale: makes explicit that `#@` markers survive in the user's bubble, tying line 72 to the same
re-trigger rationale as line 41. PRD §3.2 + §13.8.)

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: READ README.md once (full file) + architecture/readme_analysis.md §1-3
  - PURPOSE: internalize the em-dash/backtick prose style and the 3-way distinction:
    (a) marker PRESERVED verbatim (the new contract — 41, 43, 72);
    (b) bytes delivered as a separate green read <path> line (unchanged, accurate);
    (c) "left as written/verbatim/as-is" = NO MATCH, untouched (60, 88, 94, 95, 96, 135 — CORRECT, no-touch).
  - VERIFY the 3 oldText strings match the live README EXACTLY (em-dashes are — U+2014; backticks ASCII `).

Task 2: APPLY Edit 1 (line 41 — sentence 3 only)
  - USE the edit tool with oldText/newText from "EDIT 1" above (sentence 3 ONLY, NOT the whole line).
  - PRESERVE sentences 1-2 verbatim (green read <path> line, indistinguishable from read tool, ctrl+o).
  - DO NOT touch the fenced usage block (lines 33-39) or the fenced spec.md example (lines 45-47).

Task 3: APPLY Edit 2 (line 43 — tail clause only)
  - USE the edit tool with oldText/newText from "EDIT 2" above (the tail clause ONLY).
  - KEEP the trailing colon ":" so the fenced example on lines 45-47 still follows correctly.

Task 4: APPLY Edit 3 (line 72 — final sentence only)
  - USE the edit tool with oldText/newText from "EDIT 3" above (the final sentence ONLY).
  - PRESERVE the preceding sentences (the <file> block description + green read <path> line + ctrl+o).

Task 5: VERIFY the gates (see Validation Loop)
  - RUN: grep -ni "strip" README.md            → EXPECT 0 hits (the keystone gate).
  - RUN: git diff --stat README.md             → EXPECT README.md changed.
  - RUN: git diff --stat                       → EXPECT README.md is the ONLY file you changed
                                                 (file-injector.test.mjs + tasks.json may show as modified by
                                                 the parallel P1.M2.T3 work — those are NOT yours; confirm via
                                                 `git diff --stat -- README.md` that YOUR change is README-only).
  - RUN: grep -n "left as written\|left verbatim\|left as-is\|stays verbatim" README.md
        → EXPECT 6 hits on lines 60, 88, 94, 95, 96, 135 UNCHANGED (verify the line numbers/contents match).
  - READ the 3 edited paragraphs in context to confirm they flow naturally and use — / ` consistently.
```

### Implementation Patterns & Key Details

```markdown
<!-- PATTERN: minimal-surface prose edit. Replace ONLY the wrong clause/sentence; keep everything around it
     verbatim. Do NOT reflow paragraphs, do NOT add/remove headers, do NOT touch fenced code blocks. -->

<!-- PATTERN: em-dash (—) + backtick (`token`) style. Every code-like token is backtick-quoted: `#@`, `read
     <path>`, `Review #@a.ts`, `spec.md`, `#@spec.md`, `#@api.md`, `read`, `ctrl+o`. Match this exactly. -->

<!-- PATTERN: the edit tool matches oldText UNIQUELY. Each oldText above is unique in the README (verified:
     "stripped from each reference" appears once (L41); "the import marker is stripped from `spec.md`" once
     (L43); "Your own message shows only what you typed." once (L72)). If an edit fails to match, you
     copy-typed it wrong (em-dash vs hyphen, or a stray space) — re-copy from this PRP verbatim. -->

<!-- CRITICAL: keep the 3 edits INDEPENDENT. They are on non-adjacent lines (41, 43, 72); apply as 3 separate
     edit calls (or one call with 3 entries). They do NOT overlap. Do NOT merge them into a single oldText. -->

<!-- CRITICAL: the 6 no-touch lines (60, 88, 94, 95, 96, 135) say "left as written/verbatim/as-is" for
     NON-matching tokens. That is CORRECT and is the OPPOSITE of stripping. If you are tempted to edit one
     because it contains the word "verbatim", STOP — "left verbatim" (line 94) means "ignored, untouched"
     (an absolute/tilde import inside markdown that does NOT resolve). It is not about marker stripping. -->
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - README.md: exactly 3 text replacements (line 41 sentence 3; line 43 tail clause; line 72 final sentence).
    Em-dash (—) + ASCII-backtick (`) style preserved. No header/anchor/fenced-block change. No reflow.
NO_CHANGES: file-injector.ts (the verbatim engine — LANDED; git diff empty), file-injector.test.mjs +
            import-behavior.test.mjs + relative-imports.test.mjs (P1.M2.T1/T2/T3 scope — test work, never
            README), scripts/typecheck.mjs (files: ["file-injector.ts"] — README not consumed), package.json
            (no README-consuming script), tsconfig.json (editor hints only — not run by tsc), PRD.md /
            prd_snapshot.md / tasks.json (orchestrator-owned, READ-ONLY), all plan/ files.
NO_RUNTIME_IMPACT: README is documentation only. Nothing imports/requires/reads it at build or runtime.
                   `npm test` and `npm run typecheck` are unaffected (belt-and-suspenders only).
```

## Validation Loop

### Level 1: The keystone gate (deterministic — run first)

```bash
cd /home/dustin/projects/pi-file-injector
grep -ni "strip" README.md
# Expected: NO output (0 hits). Before the edit this printed lines 41 and 43. After: empty.
# This is the single authoritative gate for "no passage claims markers are stripped."
# If ANY line still contains "strip" (case-insensitive), the edit is incomplete — find and fix it.
```

### Level 2: Scope integrity (only README.md changed by YOU)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat -- README.md          # EXPECT: README.md | <n> +-   (your 3 edits)
git diff -- README.md                 # read the full diff; confirm exactly 3 hunks on lines 41, 43, 72

# Confirm the no-touch lines are byte-for-byte unchanged:
git diff -- README.md | grep -E "^[+-].*(left as written|left verbatim|left as-is|stays verbatim)"
# Expected: EMPTY (no +/- lines touching the no-touch phrases). If non-empty, you edited a protected line — revert it.

# Confirm the parallel test work is NOT yours (informational — do not touch):
git diff --stat                       # may show file-injector.test.mjs + tasks.json (P1.M2.T3 work) — NOT yours
git diff --stat -- README.md          # YOUR change is README.md only
```

### Level 3: Content correctness (the 3 edited lines say the right thing)

```bash
cd /home/dustin/projects/pi-file-injector
# Line 41 — verbatim contract present, "stripped" absent:
grep -n "stay in your message exactly as you typed them" README.md        # EXPECT 1 hit (L41)
grep -n "re-triggers injection" README.md                                 # EXPECT 1 hit (L41)
grep -n "delivered to the model underneath" README.md                     # EXPECT 1 hit (L41)

# Line 43 — import marker stays verbatim, colon preserved:
grep -n "import marker stays in \`spec.md\` verbatim" README.md           # EXPECT 1 hit (L43)
sed -n '43p' README.md | grep -q ":$" && echo "L43 colon OK"             # EXPECT "L43 colon OK"

# Line 72 — the clarifying note present:
grep -n "including the \`#@\` markers" README.md                          # EXPECT 1 hit (L72)
grep -n "re-opening or forking re-triggers injection" README.md           # EXPECT 1 hit (L72)

# No-touch lines intact (the 6 "left as written/verbatim/as-is" lines):
grep -n "left as written\|left verbatim\|left as-is\|stays verbatim" README.md
# EXPECT 6 hits: lines 60, 88, 94, 95, 96, 135 (unchanged).
```

### Level 4: Belt-and-suspenders (README is not consumed — these must be unaffected)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck    # EXPECT: "file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
                     # (README is not in typecheck's files: list; trivially unaffected. Confirms no accidental .ts edit.)
# npm test is OPTIONAL to run — it is the test suite (P1.M2's scope), not yours, and may be RED at baseline
# (6 pre-existing failures in file-injector.test.mjs from P1.M2.T1's migration). Do NOT run it as YOUR gate;
# README changes cannot affect it. If you do run it, expect the same baseline (do not "fix" test failures).
```

## Final Validation Checklist

### Technical Validation

- [ ] `grep -ni "strip" README.md` → **0 hits** (the keystone gate; was 2: lines 41 and 43).
- [ ] `git diff --stat -- README.md` shows README.md changed; `git diff -- README.md` shows exactly 3 hunks (L41, L43, L72).
- [ ] The 6 no-touch lines (60, 88, 94, 95, 96, 135) are byte-for-byte unchanged (`git diff` shows no +/- for "left as written/verbatim/as-is/stays verbatim").
- [ ] `git diff --stat` shows NO change to file-injector.ts, *.test.mjs, scripts/typecheck.mjs, package.json, tsconfig.json, or any plan/ file (by YOU).
- [ ] `npm run typecheck` → 0 errors (belt-and-suspenders; README not consumed).

### Feature Validation (the 3 edited passages)

- [ ] Line 41: "`#@` triggers stay in your message exactly as you typed them" + "re-triggers injection" + "delivered to the model underneath — never pasted into your message bubble"; sentences 1-2 (green `read <path>` line, indistinguishable from `read` tool, `ctrl+o`) preserved; "stripped" absent.
- [ ] Line 43: "The import marker stays in `spec.md` verbatim (same as a top-level marker):" with trailing colon; fenced example (lines 45-47) intact; "stripped" absent.
- [ ] Line 72: "Your own message shows exactly what you typed — including the `#@` markers — so re-opening or forking re-triggers injection automatically."; preceding `<file>`-block + rendering sentences preserved.

### Code Quality Validation

- [ ] Em-dash (— U+2014) + ASCII-backtick (`) prose style matches the surrounding README exactly.
- [ ] No markdown header / list / fenced-block added, removed, or reflowed.
- [ ] No anchor broken (the `[Limits](#limits)` in-doc link still resolves — heading lines untouched).
- [ ] The 3 edits read naturally in context (read the full Usage section + the What-gets-injected paragraph).

### Documentation

- [ ] This IS the documentation task (Mode B). No further doc artifact needed. The README now accurately
      describes the verbatim prompt delivery that plan 009 landed, with the re-trigger rationale stated.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch the 6 "left as written/verbatim/as-is" lines (60, 88, 94, 95, 96, 135).** They describe
  NON-matching tokens (missing/dir/exact-ext/absolute/tilde/code-span/dir-path) left UNTOUCHED because nothing
  matched — the OPPOSITE of stripping a resolved marker. Conflating them is the #1 corruption risk. "left
  verbatim" (L94) means "ignored, no injection" — not "marker preserved after resolution."
- ❌ **Do NOT replace the entire line 41.** Sentences 1-2 (the rendering description: green `read <path>` line,
  indistinguishable from the `read` tool, `ctrl+o` to expand) are ACCURATE and better than the item's
  rendering clause. Replace ONLY sentence 3 (the "stripped" claim). See the L41 redundancy judgment call.
- ❌ **Do NOT drop the trailing colon on line 43.** It introduces the fenced example (`#@spec.md  # spec.md
  contains: see #@api.md`) on lines 45-47. The replacement keeps ":" so the example still follows.
- ❌ **Do NOT retype oldText by hand.** Em-dashes are U+2014 (—), not hyphens; backticks are ASCII. Copy the
  oldText verbatim from this PRP (or the grep output) or the edit tool will fail to match.
- ❌ **Do NOT merge the 3 edits into one oldText** or apply them as a single multi-line replacement. They are
  on non-adjacent lines (41, 43, 72); apply as 3 independent edit operations.
- ❌ **Do NOT run `npm test` as YOUR gate or "fix" its failures.** The test suite is P1.M2.T1/T3's scope and is
  RED at baseline (6 pre-existing failures from the verbatim migration). README changes cannot affect it. Your
  gate is `grep -ni strip README.md` → 0, plus the scope/content checks. (typecheck is belt-and-suspenders.)
- ❌ **Do NOT edit file-injector.ts, *.test.mjs, scripts/typecheck.mjs, package.json, tsconfig.json, PRD.md,
  prd_snapshot.md, tasks.json, or any plan/ file.** `git diff --stat` for all of those must show no change by
  YOU. (file-injector.test.mjs + tasks.json may show as modified by the PARALLEL P1.M2.T3 work — leave them.)
- ❌ **Do NOT add a "Changelog" / "Contributing" / "License" section, or any new heading.** No such sections
  exist (per readme_analysis.md §4); adding one is scope creep. Stay inside the existing 3 paragraphs.
- ❌ **Do NOT weaken the verbatim claim to hedge ("mostly preserved", "usually stays").** The contract is
  absolute (PRD §6.4: byte-for-byte; §13.8). State it plainly: markers stay exactly as typed.
- ❌ **Do NOT describe stripping as "still happens for X".** Stripping is GONE entirely (P1.M1 deleted it).
  Every resolved marker — top-level and markdown-import — survives verbatim. No caveat.

---

## Confidence Score: 9/10

A tightly-bounded documentation-only task (Mode B) with **fully-specified text**: the item description gives
the exact rewrite for L41 and L43, and the optional (recommended) clarification for L72; `readme_analysis.md`
provides the exact current text of all 3 lines + the full grep map (confirming "strip" appears ONLY on 41 and
43, and that the 6 "left as written/verbatim/as-is" lines are a distinct, correct concept to preserve); the
PRD (§6.4 + §13.8 + §3.2) gives the complete rationale (verbatim prompt → re-submission re-triggers injection;
stripping breaks cancel/fork/`/tree`/queued-dequeue because Pi re-feeds stored text). The single deterministic
gate (`grep -ni strip README.md` → 0) makes verification unambiguous. The PRP owns the one genuine judgment
call (L41: replace only sentence 3, keep the superior rendering sentences 1-2, drop the redundant rendering
clause) with clear rationale, and nails the #1 corruption risk (conflating "stripped" with "left as written").
The -1 reserves for the small chance the implementer retypes oldText with a hyphen instead of an em-dash (the
PRP forbids it and says to copy verbatim) or accidentally touches a no-touch line (the PRP enumerates all 6
with their exact phrases and a git-diff guard). The implementer reads the README + readme_analysis §1-3, makes
3 precise edits, and runs 2 grep gates.