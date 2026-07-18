# Research Notes — P1.M2.T3.S1 (plan/008): README sync for compact read-tool-style display

## What this task is

A **Mode B changeset-level documentation sync**: rewrite the README so it describes the NEW compact
read-tool-style chat display instead of the OLD `---`-append model. README.md is the **only** file touched.
No `.ts`, no tests, no config, no PRD. Depends on the implementing subtasks (P1.M1.T1.S1 → P1.M2.T2.S2)
because it documents their user-visible result.

## The OLD vs NEW delivery/display model (from architecture/system_context.md)

**OLD (what line 33 currently describes verbatim):**
- One hook (`input`). File bytes are concatenated into the user-message text after `\n\n---\n\n`.
- The TUI shows the full file contents in the user bubble, under a `---` horizontal rule.

**NEW (what the README must now describe — LANDED in file-injector.ts):**
- `input` rewrites the prompt text only (strips `#@` → bare path); file bytes are NO LONGER in the text.
- `before_agent_start` returns a custom message `{ customType: "fileInjector.injected", content: <joined <file> blocks>, display: true, details: { files } }` (file-injector.ts:1199-1215).
- A `MessageRenderer` registered for that customType draws a **green** (`toolSuccessBg`) `Box` with **one `read <path>` line per file** when collapsed, expanding on `ctrl+o` to the full/highlighted contents (file-injector.ts:599-690).
- The model STILL receives every `<file name="…">…</file>` block — `convertToLlm()` maps `role:"custom"` → user-role message. The `<file>` block FORMAT is byte-identical (§6.1) → the model-facing `<file>` example in the README stays correct.
- The user's own message bubble shows only what they typed (`#@` stripped to bare paths).

## Exact read-line behavior I must document accurately (file-injector.ts:669-682)

`readLine` per kind (collapsed):
- text → `read <tildified-path>` (no suffix)
- image → `read <tildified-path> <dimensionHint>` (e.g. `(resized to 1568×1044)`)
- binary → `read <tildified-path> (binary — not injected)`
- paged → `read <tildified-path><range>` (e.g. `:5-`)

`(ctrl+o to expand)` hint shown ONCE per box (on the first line, `i===0`). Paths are tildified
(leading `os.homedir()` → `~`). Color: `toolTitle`+bold for "read", `accent` for path, `dim`/`warning`
for the suffix, `toolSuccessBg` background — i.e. the **read tool's** recipe, not the purple skill recipe.

## The 3 in-scope edit targets in README.md (verified by grep + read)

### Edit 1 — line 33 (the "Usage" paragraph) — REWRITE
OLD:
> On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath.

This is the ONLY prose that describes the OLD display. It must describe the NEW compact green read-line
display + ctrl+o + `#@`→bare-path + delivered-to-model-not-pasted.

### Edit 2 — line 52 ("What gets injected" table, missing-file row) — minor
OLD: `| Missing file, directory, or permission error | Left as written. Nothing is appended. |`
"appended" is append-model language. The "What gets injected" section IS in scope (contract point a).
Change "Nothing is appended." → "Nothing is injected." (row stays accurate to the new model).

### Edit 3 — after line 62 (the `<file name=...>` code example in "What gets injected") — ADD a note
The `<file name="/abs/path/to/file.ts">` block (lines 58-62) is STILL correct for the model-facing format
(§6.1 unchanged). Keep it. Per contract point (a), add a note after the closing fence: this is what the
MODEL receives; in the chat each file renders as a green `read <path>` line, not the raw block.

## CRITICAL GOTCHA — line 48 `|---|---|` is GFM TABLE SYNTAX, not a delivery mention

`grep -n -- '---' README.md` matches line 48 `|---|---|`. That is the **GitHub-Flavored Markdown table
delimiter row** separating the header `| File | Result |` from the body. It is NOT prose describing the
`---` delivery rule. Contract point (b) "Remove any mention of `---`" refers to PROSE mentions of the
horizontal-rule delivery separator (line 33), NOT markdown table syntax. **Editing or removing line 48
breaks the "What gets injected" table.** The implementing agent MUST NOT touch it.

## Out of scope (contract point d + c) — do NOT change

These lines mention "deliver" / "read tool" / "appear" but in CORRECT contexts (paging delivery to the
model, markdown imports, limits) — they do NOT describe the OLD `---` append display, so they stay:
- Line 3 (intro/tagline area — explicitly unaffected per contract point c)
- Line 7, 9 ("Why" section — describes delivery-to-model, accurate in both models)
- Line 35, 41 (Usage: markdown imports, path completion)
- Line 49, 54 (What gets injected: paging delivery, markdown-scan)
- Line 80-86 (Syntax: markdown import rules)
- Line 92, 115 (config: bare-@ imports)
- Line 121-128 (Limits)
- Line 136 (`#@` versus `@`)

## Validation approach (no test runner for prose)

Deterministic grep gates:
1. No prose `---` delivery mention remains → `grep -n 'appear below a \`---\`\|appended underneath\|Nothing is appended' README.md` → EMPTY.
2. The NEW wording is present → `grep -n 'read <path>\|ctrl+o\|compact green\|green .read <path>. line' README.md` → hits in Usage + the new note.
3. Line 48 table delimiter intact → `sed -n '48p' README.md` == `|---|---|`.
4. No scope creep → `git diff --stat` touches ONLY README.md.
5. Markdown sanity → the table still renders (delimiter untouched); headings/structure unchanged.

## Contract from the parallel PRP (P1.M2.T2.S2)

P1.M2.T2.S2 (running in parallel) pins `renderInjectedMessage` DISPLAY output with 10 REND test cases.
Its PRP confirms: the renderer is LANDED + EXPORTED (file-injector.ts:627); it draws a green
`toolSuccessBg` Box, one `read <path>` line per file, ctrl+o expand, per-kind suffixes, tildify,
defensive fallback. My README wording must match THAT display contract (it does — both trace to PRD §6.3).
I consume its contract (the user-visible result) but touch NO code/tests — README only.
