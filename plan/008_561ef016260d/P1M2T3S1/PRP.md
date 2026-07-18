---
name: "P1.M2.T3.S1 (plan/008) — Update README.md for compact read-tool-style display (remove the --- append language; Mode B changeset-level doc sync)"
prd_ref: "PRD §1 Solution ('How delivery works (and how it looks)' paragraph), §3.4 Goal #8, §6.1 (model-facing <file> format unchanged), §6.3 (green collapsible read-line chat display), §13.7 (the custom-message+renderer mechanism and its one tradeoff)"
target_file: "./README.md"   # 3 targeted edits ONLY: rewrite Usage para (L33), one word in a table row (L52), add a note after the <file> example (after L62). NO code, NO tests, NO config, NO PRD.
target_language: Markdown (user-facing docs; no build/test gate — validated by deterministic grep + prose read-through)
depends_on: "All implementing subtasks LANDED in file-injector.ts: P1.M1.T1.S1/T1.S2 (FileDetail + return shape), P1.M1.T2.S1/T2.S2 (input/before_agent_start split + renderInjectedMessage EXPORTED at L627), P1.M2.T1.S1/T1.S2 (test migration), P1.M2.T2.S1 (delivery tests). P1.M2.T2.S2 (renderer display tests) runs in PARALLEL — consume its display CONTRACT, do not duplicate."
consumed_by: "Nothing. This is the changeset-level documentation closeout for plan 008's user-visible delta."
---

# PRP — P1.M2.T3.S1 (plan/008): README sync — compact read-tool-style display

> **Scope flag:** This is a **Mode B documentation sync**. README.md is the ONLY file touched. Three
> precise edits: (1) rewrite the "Usage" paragraph (L33) that currently describes the OLD `---`-append
> display, so it describes the NEW compact green `read <path>`-line display; (2) change one word in the
> "What gets injected" missing-file table row (L52: "appended"→"injected"); (3) add one note after the
> `<file name=…>` example (after L62) clarifying that the block is what the MODEL sees, while the chat
> shows green `read <path>` lines. **No code, no tests, no config, no PRD.** The PRD's `<file>`-block
> format (§6.1) is byte-identical before/after this plan, so that example stays correct as-is.

---

## Goal

**Feature Goal:** Make README.md accurately describe the chat appearance an end user actually sees after
plan 008 — files delivered by `#@` render in the chat as **compact, green, collapsible `read <path>`
lines** (one per file, indistinguishable from the `read` tool, expandable on `ctrl+o`) — and remove every
prose mention of the OLD `---` horizontal-rule append model. The model-facing `<file>` block format
(unchanged by §6.1) stays documented correctly.

**Deliverable:** A `README.md` diff with exactly 3 edits in the `## Usage` and `## What gets injected`
sections. `git diff --stat` touches ONLY `README.md`. No other file is modified.

**Success Definition:**
1. `grep -nE 'appear below a .---.|appended underneath|Nothing is appended' README.md` → **EMPTY** (no OLD-model prose remains).
2. `grep -n 'read <path>\|ctrl+o' README.md` → the NEW compact-display wording is present in BOTH the rewritten Usage paragraph AND the new note after the `<file>` example.
3. `sed -n '48p' README.md` == `|---|---|` — the GFM **table delimiter row** is byte-for-byte intact (it is markdown table syntax, NOT a delivery mention; touching it breaks the table).
4. `git diff --stat` → ONLY `README.md`; zero changes to `file-injector.ts`, any `*.test.mjs`, `package.json`, `scripts/`, `PRD.md`, or anything under `plan/`.
5. Install, Syntax, config (bare-`@`), Limits, and `#@` versus `@` sections are byte-for-byte unchanged; the intro/tagline area (L1-9) is unchanged.

## User Persona

**Target User:** An end user reading the README to learn what `#@` does and what they will see in the Pi
TUI when they submit a `#@file` prompt.

**Use Case:** A user writes `Review #@a.ts`, submits, and wants the README to match what they see: their
message shows `Review a.ts` (the `#@` stripped), and a green `read a.ts` line appears below it that they
can expand with `ctrl+o`. Today the README tells them they'll see "the file contents appear below a `---`
rule … with the file appended underneath" — which is wrong after plan 008.

**Pain Points Addressed:** The README currently contradicts the shipped behavior. A user following the
docs expects a pasted-under-`---` block and instead gets read-tool-style lines, eroding trust. This sync
makes the docs match the TUI.

## Why

- **The display model fundamentally changed (plan 008).** Files used to be concatenated into the user's
  message text after a `---` rule (shown fully in the user bubble). Now they live in a separate custom
  message rendered as green `read <path>` lines by a registered `MessageRenderer` (PRD §6.3, §13.7). Line
  33 describes the OLD model verbatim and is now a lie.
- **This is the user-facing contract.** `#@` is a user-facing feature; its README is the reference an end
  user reads. Mode B (changeset-level doc sync) exists precisely for this: the delta's user-visible result
  must be documented before the changeset is considered done.
- **The `<file>` format did NOT change (§6.1).** The model still receives `<file name="/abs/path">…</file>`
  byte-identically — only *where* those blocks live (a custom message, not the prompt text) and *how they
  render in the chat* changed. So the model-facing example stays; we only add a note distinguishing
  model-facing format from chat display.
- **Depends on all implementing subtasks.** This task describes the complete plan-008 delta's user-visible
  result, so it is sequenced after P1.M1 (delivery + renderer) and P1.M2.T1/T2 (tests confirming the
  behavior). It consumes the display contract the parallel P1.M2.T2.S2 pins (green `read <path>` lines,
  ctrl+o expand, per-kind suffixes) — but touches no code/tests.

## What

No code, test, or behavior change. **README.md edits only.** Three targeted edits, two in the `## Usage`
section and one in the `## What gets injected` section. Copy-ready prose for each is given verbatim in the
Implementation Blueprint below (Task 1/2/3). Nothing in Install, Syntax, config (bare-`@`), Limits, or
`#@` versus `@` is touched.

### Success Criteria

- [ ] The "Usage" paragraph (L33) is rewritten to describe compact green `read <path>` lines (one per
      file), `ctrl+o` to expand, `#@` stripped to a bare path in the user's message, and the file
      delivered to the model (not pasted into the message).
- [ ] No prose mention of a `---` rule / horizontal-rule append remains (the OLD L33 text is gone).
- [ ] No "appended underneath" / "Nothing is appended" remains (L52 reads "Nothing is injected").
- [ ] The `<file name="/abs/path/to/file.ts">` model-facing example is KEPT and a note is added that in
      the chat each file renders as a green `read <path>` line (not the raw block).
- [ ] Line 48 (`|---|---|`, the GFM table delimiter) is byte-for-byte intact (NOT a delivery mention).
- [ ] Install / Syntax / config / Limits / `#@` vs `@` / intro+tagline are unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the EXACT old text of every edit site (with line numbers),
copy-ready replacement prose for each, the CRITICAL line-48 gotcha (GFM table delimiter ≠ delivery
mention), the explicit out-of-scope list (lines that mention "deliver"/"read tool" correctly and must be
left alone), the display contract grounded in the LANDED renderer (`file-injector.ts:627-690`, quoted),
and deterministic grep validation gates. The implementing agent applies 3 edits and runs 4 greps.

### Documentation & References

```yaml
# MUST READ — the display contract this README must match (already LANDED in file-injector.ts)
- file: file-injector.ts
  why: "L627 renderInjectedMessage (EXPORTED): draws a green (toolSuccessBg) Box; one `read <path>` line
        per file when collapsed; expanded (ctrl+o) shows the full/highlighted content below each line;
        images NOT re-rendered; tildify homedir→~; defensive fallback (never throws). L669 readLine per
        kind: text=`read <path>`; image=`read <path> <dimensionHint>`; binary=`read <path> (binary — not
        injected)`; paged=`read <path><range>`. L685 expandHint = ` (ctrl+o to expand)` shown ONCE per box.
        L1199-1215 before_agent_start returns the custom message { customType:'fileInjector.injected',
        content:<joined <file> blocks>, display:true, details:{files} }."
  pattern: "The README's user-facing prose must describe this EXACTLY: compact green read lines (one per
            file), ctrl+o expand, read-tool look. The model still receives every <file> block (§6.1)."
  critical: "The <file name=\"/abs/path\">…</file> FORMAT is unchanged (§6.1) — the model-facing example
             in the README is still correct. Only the CHAT DISPLAY changed. Do NOT rewrite the <file>
             example; just add a note after it."

# MUST READ — the PRD display spec (the source of truth for what the prose must say)
- file: PRD.md
  why: "§6.3 'Chat display: a green, collapsible read-line box' = the full renderer spec the README
        summarizes. §6.1 'Model-facing format: Pi-native <file> tags (unchanged)' = why the <file>
        example stays. §13.7 = the mechanism + the one honest tradeoff (model input becomes two user
        messages; content byte-identical). §1 Solution 'How delivery works (and how it looks)' + §3.4
        Goal #8 = the end-user description ('indistinguishable from the read tool; expand on ctrl+o;
        user's message bubble shows only what they typed')."
  section: "§1 (Solution) + §3.4 (Goal #8) + §6.1 + §6.3 + §13.7"

# The file you edit (the ONLY change) — 3 targeted edits, copy-ready prose in the Blueprint
- file: README.md
  why: "EDIT 1: L33 Usage paragraph (rewrite — describes OLD --- model verbatim). EDIT 2: L52 'What gets
        injected' table missing-file row (one word: appended→injected). EDIT 3: after L62, add a note
        after the <file> model-facing example. The intro/tagline (L1-9), Why (L11-13), Install, Syntax,
        config (bare-@), Limits, and #@ vs @ are OUT OF SCOPE — leave byte-for-byte unchanged."
  pattern: "Read the exact old text (quoted in Blueprint Task 1/2/3) and replace with the copy-ready new
            text. Do not reflow surrounding paragraphs."
  gotcha: "L48 `|---|---|` is GFM TABLE DELIMITER syntax (separates the | File | Result | header from the
           body). It is NOT a prose mention of the --- delivery rule. grep '---' hits it — DO NOT 'fix'
           it. Editing/removing L48 BREAKS the table."

# The parallel task's display contract — consume, do not duplicate
- file: plan/008_561ef016260d/P1M2T2S2/PRP.md
  why: "P1.M2.T2.S2 pins renderInjectedMessage DISPLAY output (10 REND cases). Its PRP confirms the
        renderer is LANDED + EXPORTED and documents the exact per-kind read-line text + the green
        toolSuccessBg/toolTitle/accent/dim recipe. My README wording must match that contract (both trace
        to PRD §6.3). I touch NO code/tests — README only."

# The architecture delta doc — OLD vs NEW model (background; read-only)
- file: plan/008_561ef016260d/architecture/system_context.md
  why: "Documents the OLD model (one input hook; blocks concatenated into prompt text after \\n\\n---\\n\\n;
        TUI shows full bytes in the user bubble) vs the NEW model (input strips #@ only; before_agent_start
        publishes a custom message; MessageRenderer draws green read lines). This is the delta line 33 lags."
```

### Current Codebase tree (read-only overview — this task edits ONLY README.md)

```bash
pi-file-injector/
├── file-injector.ts          # LANDED: renderInjectedMessage (L627) + before_agent_start (L1199) + readLine (L669)
├── file-injector.test.mjs    # LANDED: migrated + DELIV-* delivery tests (+ REND-* from parallel P1.M2.T2.S2)
├── relative-imports.test.mjs # LANDED: migrated (P1.M2.T1.S2)
├── import-behavior.test.mjs  # LANDED: migrated (P1.M2.T1.S2)
├── README.md                 # ← THE ONLY FILE EDITED (3 targeted edits)
├── PRD.md                    # READ-ONLY (never modify)
├── package.json / scripts/   # untouched
└── plan/008_561ef016260d/    # untouched
```

### Desired Codebase tree with files to be added/edited

```bash
README.md   # MODIFIED — 3 edits: L33 (rewrite Usage para), L52 (appended→injected), after L62 (add display note).
            #           NO other file. NO new files. git diff --stat → ONLY README.md.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
# CRITICAL — line 48 `|---|---|` is GFM TABLE DELIMITER SYNTAX, not a delivery mention.
#   grep -n '---' README.md matches it, but it is the markdown row that separates the
#   | File | Result | header from the table body. Editing or removing it BREAKS the
#   "What gets injected" table. Contract point (b) "remove any mention of ---" targets
#   PROSE (line 33's "appear below a `---` rule"), NOT table syntax. LEAVE LINE 48 ALONE.

# CRITICAL — the <file name="/abs/path/to/file.ts"> example (L58-62) is STILL CORRECT.
#   PRD §6.1 is explicit: the model-facing <file> block FORMAT is byte-identical before/after
#   plan 008. Only WHERE the blocks live (a custom message, not prompt text) and HOW they
#   render in chat changed. So: KEEP the example, ADD a note after it. Do NOT rewrite it.

# GOTCHA — line 52 "Nothing is appended" is in the "What gets injected" section, which IS in scope
#   (contract point a). "appended" is OLD-model language. Change it to "injected". The row stays
#   accurate (a missing/dir/error token is left as literal text; nothing is delivered).

# GOTCHA — out-of-scope lines that mention "deliver" / "read tool" / "appear" but CORRECTLY:
#   L3 (intro/tagline — explicitly unaffected per contract point c), L7/L9 (Why), L35/L41 (Usage),
#   L49/L54 (What gets injected), L80-86 (Syntax), L92/L115 (config), L121-128 (Limits), L136 (#@ vs @).
#   These describe delivery-to-the-model / paging / imports — NOT the OLD --- display. DO NOT TOUCH.

# GOTCHA — README is user-facing PROSE, not code. There is no compiler/test gate. Validation is
#   deterministic GREP (no OLD phrases remain; NEW wording present; L48 intact) + a prose read-through.
#   Do not invent a build step.

# CONVENTION — the README uses `# heading` H1, `## section` H2, inline `code` for paths/keys/commands,
#   ```text fenced blocks for examples, and a GFM pipe table for file types. Match this exactly; do not
#   introduce new heading levels, emojis, or reflowed paragraphs beyond the 3 edit sites.
```

## Implementation Blueprint

### The 3 edits (copy-ready prose — apply verbatim)

These are the ONLY changes. Each is an exact-text replacement (use the `edit` tool with the exact `oldText`
below; the README's current text matches it).

#### Task 1: REWRITE the "Usage" paragraph (L33)

**OLD (exact current text, L33):**
```
On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath.
```

**NEW (replacement):**
```
On submit, each file shows up as a compact green `read <path>` line directly below your message — one line per file, indistinguishable from the `read` tool. Press `ctrl+o` to expand any of them to the full contents. The `#@` trigger is stripped from each reference, so `Review #@a.ts` appears in your message as `Review a.ts`, with the file delivered to the model underneath — never pasted into your message bubble.
```

*Rationale (grounded in PRD §6.3 + §1 Solution + the LANDED renderer):* "compact green `read <path>`
line … one per file … indistinguishable from the read tool" = the renderer's collapsed view; "press
`ctrl+o` to expand" = `expandHint` (`(ctrl+o to expand)`, shown once per box); "`Review #@a.ts` appears
in your message as `Review a.ts`" = the `input` handler strips `#@` to a bare path in the prompt text;
"delivered to the model underneath — never pasted into your message bubble" = the `before_agent_start`
custom message carries the bytes, not the prompt text (§13.7).

#### Task 2: one word in the "What gets injected" missing-file table row (L52)

**OLD (exact current text, L52):**
```
| Missing file, directory, or permission error | Left as written. Nothing is appended. |
```

**NEW (replacement):**
```
| Missing file, directory, or permission error | Left as written. Nothing is injected. |
```

*Rationale:* "appended" is OLD-model (bytes appended to prompt text). In the new model a missing/dir/error
token is left verbatim and nothing is delivered — "Nothing is injected" is accurate and removes the
append-model connotation. Only one word changes; the row and the rest of the table are untouched.

#### Task 3: ADD a note after the `<file>` model-facing example (after the closing fence at L62)

Locate the example block in `## What gets injected`:

```
Text uses Pi's native block format, the same one `@file` uses:

```text
<file name="/abs/path/to/file.ts">
<entire file contents>
</file>
```
```

Immediately AFTER the closing ` ``` ` of that `text` block (and BEFORE the blank line + "Images are
matched by their real bytes…"), insert this paragraph:

**NEW (insert):**
```
That's what the model receives. You won't see it as raw text in the chat — each injected file renders as a green `read <path>` line (just like the `read` tool), with `ctrl+o` to expand. Your own message shows only what you typed.
```

*Rationale (contract point a):* The `<file>` example stays (PRD §6.1 — format unchanged), but without a
note a reader could think they'll SEE that raw block in the chat. The note distinguishes model-facing
format from chat display and restates the compact-line affordance. (Mild overlap with the Usage paragraph
is intentional and correct — both must stand alone for a skimming reader.)

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT README.md L33 — rewrite the "Usage" paragraph (OLD --- append → NEW compact green read-line display)
  - FIND: the line beginning "On submit, the file contents appear below a `---` rule."
  - REPLACE: with the copy-ready NEW text above (compact green `read <path>` lines; ctrl+o; #@→bare path;
    delivered to model, not pasted into message).
  - PRESERVE: the surrounding Usage content — the `Review #@a.ts` example list (L23-31), the Markdown
    imports paragraph (L35), the path-completion line (L41), and the "Bare @ is unchanged" line (L43).
  - NAMING/PLACEMENT: in-place replacement of exactly that one paragraph; no heading or structure change.

Task 2: EDIT README.md L52 — one word in the "What gets injected" missing-file table row
  - FIND: "| Missing file, directory, or permission error | Left as written. Nothing is appended. |"
  - REPLACE: "| Missing file, directory, or permission error | Left as written. Nothing is injected. |"
  - PRESERVE: the rest of the table — header row (L47), delimiter (L48 — DO NOT TOUCH), and the
    Text/Image/Other-binary rows (L49-51). The table must still render.

Task 3: INSERT a note after the <file> model-facing example (after L62, before "Images are matched…")
  - FIND: the "```text / <file name=\"/abs/path/to/file.ts\"> / <entire file contents> / </file> / ```"
    block under "## What gets injected" (the block immediately after "Text uses Pi's native block format…").
  - INSERT: the copy-ready NEW paragraph above, immediately after that block's closing ``` fence.
  - PRESERVE: the <file> example itself (it is still correct — PRD §6.1), and the "Images are matched by
    their real bytes…" paragraph that follows.

Task 4: VERIFY — no OLD-model prose remains; NEW wording present; scope intact; table delimiter intact
  - RUN: grep -nE 'appear below a .---.|appended underneath|Nothing is appended' README.md  → EXPECT EMPTY
  - RUN: grep -n 'read <path>\|ctrl+o' README.md  → EXPECT hits in Usage (Task 1) + the new note (Task 3)
  - RUN: sed -n '48p' README.md  → EXPECT exactly "|---|---|" (GFM table delimiter intact)
  - RUN: git diff --stat  → EXPECT ONLY README.md (no .ts, no *.test.mjs, no PRD.md, no plan/)
  - READ: the Usage + What-gets-injected sections end-to-end for flow (no dangling refs, no contradiction).
```

### Implementation Patterns & Key Details

```markdown
# The edit pattern: exact-text replacement (edit tool) for Tasks 1 and 2; insert (edit tool with the
# closing fence as the anchor) for Task 3. Three independent, non-overlapping edits in one file.

# CRITICAL: every edit must preserve surrounding context. Use the SMALLEST unique oldText that covers
# only the target line(s). For Task 1 the whole paragraph is one line (L33). For Task 2 the whole row is
# one line (L52). For Task 3 anchor on the closing fence line (```) of the <file> example — but that
# fence is not unique in the file, so anchor on the `</file>` line + its following fence together, OR on
# the unique "<entire file contents>" block as a whole, to disambiguate.

# DO NOT reflow paragraphs you are not editing. DO NOT touch L48 (table delimiter). DO NOT touch the
# <file> example body (L59-61). DO NOT touch any out-of-scope section.

# The README uses ```text fences (NOT ```markdown) for the <file> example — match that if you must quote
# a fenced block (you should not need to).
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - README.md: 3 edits — L33 (rewrite Usage para), L52 (appended→injected), after L62 (insert display note).
NO_CHANGES: file-injector.ts, *.test.mjs (all three), package.json, scripts/, PRD.md (READ-ONLY),
            tsconfig.json, .gitignore, and everything under plan/.
NO_LOGIC_CHANGE: this is documentation. It describes behavior that is ALREADY shipped (P1.M1 + P1.M2.T1/T2).
                  It changes nothing the code/tests do.
```

## Validation Loop

### Level 1: No OLD-model prose remains (deterministic grep)

```bash
cd /home/dustin/projects/pi-file-injector
grep -nE 'appear below a .---.|appended underneath|Nothing is appended' README.md
# Expected: EMPTY output (no matches). These three phrases are the OLD-model markers that MUST be gone.
#   If ANY line prints → that edit was missed or the old text was only partially replaced → fix it.
```

### Level 2: The NEW compact-display wording is present (deterministic grep)

```bash
cd /home/dustin/projects/pi-file-injector
grep -n 'read <path>' README.md    # Expected: ≥2 hits — the rewritten Usage para (Task 1) + the new note (Task 3)
grep -n 'ctrl+o'      README.md    # Expected: ≥2 hits — same two locations
grep -n 'injected' README.md | grep 'Nothing is injected'   # Expected: 1 hit — L52 after Task 2
# If 'read <path>' / 'ctrl+o' appear only ONCE → Task 1 or Task 3 was not applied → apply it.
```

### Level 3: Scope integrity — only README.md changed; table delimiter intact; out-of-scope sections unchanged

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat                                              # Expected: ONLY README.md
git diff --stat -- file-injector.ts '*.test.mjs' PRD.md package.json scripts tsconfig.json   # Expected: EMPTY
sed -n '48p' README.md                                       # Expected: exactly "|---|---|" (table delimiter intact)

# Out-of-scope sections byte-for-byte unchanged — spot-check the first line of each:
sed -n '1p;7p;23p;65p;79p;90p;119p;133p' README.md   # intro, Why, Usage example list, Syntax, config, Limits, #@ vs @
# Expected: the SAME opening text as before the edits (no drift outside the 3 edit sites).
```

### Level 4: Prose read-through (manual — the only "creative" gate for a doc task)

```bash
cd /home/dustin/projects/pi-file-injector
sed -n '20,64p' README.md   # read the Usage + What-gets-injected sections end-to-end
# Expected (read it like an end user):
#   - Usage para (L33) describes compact green read <path> lines, one per file, ctrl+o expand, #@→bare path,
#     delivered-to-model-not-pasted. No "---", no "appended underneath".
#   - The <file> example is intact (still shows <file name="/abs/path/to/file.ts">…</file>), immediately
#     followed by the NEW note ("That's what the model receives… green `read <path>` line… ctrl+o…").
#   - The table's missing-file row reads "Left as written. Nothing is injected."
#   - No contradiction between the Usage para and the new note (both say the same thing; that's fine).
#   - No dangling references, no broken markdown, the table still renders (delimiter intact).
```

## Final Validation Checklist

### Technical Validation

- [ ] `grep -nE 'appear below a .---.|appended underneath|Nothing is appended' README.md` → EMPTY (Level 1).
- [ ] `grep -n 'read <path>\|ctrl+o' README.md` → ≥2 hits each, in Usage + the new note (Level 2).
- [ ] `sed -n '48p' README.md` → exactly `|---|---|` (table delimiter intact, Level 3).
- [ ] `git diff --stat` → ONLY `README.md`; the `-- …test.mjs file-injector.ts PRD.md …` filter → EMPTY (Level 3).

### Feature Validation

- [ ] The Usage paragraph (L33) describes compact green `read <path>` lines (one per file), `ctrl+o` to
      expand, `#@`→bare path in the user's message, and delivery to the model (not pasting into the message).
- [ ] No prose mention of a `---` rule / horizontal-rule append remains.
- [ ] The `<file name="/abs/path/to/file.ts">` model-facing example is intact AND followed by the new note
      distinguishing model-facing format from chat display.
- [ ] L52 reads "Nothing is injected" (not "appended").
- [ ] Install / Syntax / config (bare-`@`) / Limits / `#@` versus `@` / intro+tagline are unchanged.

### Code Quality Validation

- [ ] Follows existing README conventions: `## section` H2, inline `code` for paths/keys, ` ```text ` fences
      for examples, GFM pipe table (delimiter untouched).
- [ ] No new heading levels, emojis, or reflowed paragraphs beyond the 3 edit sites.
- [ ] The 3 edits are the ONLY changes (`git diff` shows exactly: -1/+1 at L33, a word swap at L52, +1
      inserted paragraph after L62 — and nothing else).

### Documentation

- [ ] The README's user-facing description of `#@`'s chat display now matches the shipped behavior (PRD §6.3)
      and the display contract the parallel P1.M2.T2.S2 tests pin.
- [ ] A user reading the README would correctly predict what they see in the TUI after submitting `#@file`.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch line 48 `|---|---|`.** It is GFM table delimiter syntax, NOT a prose mention of the `---`
  delivery rule. `grep '---'` matches it; that does not make it a target. Editing or removing it BREAKS the
  "What gets injected" table. Contract point (b) targets PROSE (L33), not table syntax.
- ❌ **Do NOT rewrite or remove the `<file name="/abs/path/to/file.ts">` example (L58-62).** PRD §6.1 is
  explicit: the model-facing `<file>` block FORMAT is byte-identical before/after plan 008. It stays. Only
  ADD a note after it (Task 3).
- ❌ **Do NOT touch out-of-sscope lines** (L3 intro/tagline, L7/L9 Why, L35/L41 Usage, L49/L54 What gets
  injected, L80-86 Syntax, L92/L115 config, L121-128 Limits, L136 `#@` vs `@`). They mention "deliver"/
  "read tool"/"appear" in CORRECT contexts (paging, imports) — not the OLD `---` display. Scope creep here
  invites mistakes; the 3 edits are surgical.
- ❌ **Do NOT invent a build/test gate.** README is prose; there is no compiler or test runner for it.
  Validation is deterministic GREP (Level 1-3) + a prose read-through (Level 4). Do not run `node` or `tsc`.
- ❌ **Do NOT modify `PRD.md`, `tasks.json`, `prd_snapshot.md`, any `*.test.mjs`, `file-injector.ts`, or
  anything under `plan/`.** This is documentation. `git diff --stat` must show ONLY `README.md`.
- ❌ **Do NOT reflow or "improve" paragraphs you are not editing.** The diff should be minimal: one paragraph
  rewrite (L33), one word swap (L52), one inserted paragraph (after L62). Reflowing creates churn and review
  noise and risks accidentally altering the out-of-scope sections.
- ❌ **Do NOT contradict the Usage paragraph in the new note (Task 3), and vice versa.** Both describe the
  same compact green read-line display. Mild overlap is correct and intentional (each section should stand
  alone for a skimming reader); contradiction is a bug.

---

## Confidence Score: 9/10

A surgical documentation task with exactly 3 copy-ready edits in one file (`README.md`), all grounded in
the LANDED renderer (`file-injector.ts:627-690`) and the PRD display spec (§6.3 / §13.7 / §6.1). The PRP
gives the **exact old text** of every edit site (with line numbers) and **copy-ready replacement prose**
for each — the implementing agent applies 3 `edit` operations and runs 4 greps. The one genuine risk — a
careless agent running `grep '---'` and "fixing" the GFM table delimiter at L48 — is called out loudly in
three places (gotcha block, Task 2, Anti-Patterns). The out-of-scope lines (which mention "deliver"/"read
tool" correctly) are enumerated so scope creep is avoided. Validation is honest about being grep-based
(no build/test gate for prose). The -1 reserves for the small chance the agent reflows a paragraph it
shouldn't, or mis-anchors the Task 3 insert (the ``` fence is non-unique — the PRP warns to anchor on the
`</file>` + fence pair or the whole block). Net: an agent unfamiliar with this codebase can apply the 3
edits and verify them in a single pass.
