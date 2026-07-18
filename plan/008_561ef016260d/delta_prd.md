# Delta PRD (v008): Compact read-tool-style display via custom-message delivery

**Status:** Draft · **Parent PRD:** `PRD.md` (Pi `#@file` Whole-File Injection extension) · **Delta type:** **Medium feature — delivery-mechanism + chat-display change. Code change required (the current code ships the OLD model).**

---

## 1. What changed in the PRD (the diff)

Comparing the session-007 baseline snapshot (`plan/007_3778406b61d6/prd_snapshot.md`, 1189 lines) against the current `PRD.md` (1559 lines): **57 lines removed/changed, 427 added/changed** (~595 diff lines, +370 net). The PRD grew one cohesive feature across many sections. The implementation has **not** been updated yet — the current `file-injector.ts` (verified: zero references to `before_agent_start`, `registerMessageRenderer`, `FileDetail`, `pending`, or `renderInjectedMessage`) still ships the **OLD** delivery model.

### The single conceptual change

**OLD model (what the code does today).** The single `input` handler does everything: it reads/classifies each file, then **appends** the `<file>` blocks to the user's prompt text below a `\n\n---\n\n` rule and returns one `{ action:"transform", text: finalText, images }`. The result is **one** user message whose text is `strippedPrompt + "---" + fileBlocks`. The TUI shows the full file contents inline in the user bubble (Pi core has no hook to collapse `<file>` blocks — only `<skill>` blocks are collapsed, via a hard-coded `parseSkillBlock()`).

**NEW model (what the current PRD specifies).** Split the work across **two public hooks** so the file bytes leave the user message and the TUI can render them compactly:

1. `input` handler — still does all file I/O and strips `#@`, but now **stashes** `{ blocks, details }` on a closure variable and returns `{ action:"transform", text: strippedPrompt (no blocks), images }`. The user message becomes *only* what the user typed.
2. `before_agent_start` handler (NEW) — consumes the stash and returns **one custom message** `{ customType:"fileInjector.injected", content: blocks.join("\n\n"), display:true, details:{ files } }`. Pi appends it **after** the user message, persists it, and — via `convertToLlm()` (`role:"custom"` → user-role message) — **sends it to the LLM**. The model still receives every `<file name="…">…</file>` block, byte-identical in content; the only difference is the input is now **two** user-role messages instead of one.
3. `MessageRenderer` (NEW, registered on `session_start`) — draws the injected files as a **green `Box` (`theme.toolSuccessBg`) with one `read <path>` line per file**, expandable on `ctrl+o` to the full contents — visually indistinguishable from a completed `read` tool call, using the same theme keys (`toolTitle`+bold title, `accent` path, `dim` hint).

### The invariant the PRD stresses

> **No change to what the model receives — only to message boundaries and display.** The same `<file>` blocks with the same contents reach the model; delivery moves them from the user-message text into a following custom (→ user-role) message so the TUI can render them compactly (PRD §6, §13.7). This is why the existing injection/import/paging/budget logic is untouched — only the *packaging* changes.

### Where the PRD changed (section map)

| Section | Change |
|---|---|
| §1 Solution | + paragraph "How delivery works (and how it looks)" — custom message + renderer |
| §1 Value prop | + bullet "Reads like a `read`, not like a paste"; "Zero config" bullet reworded to mention auto-derived display |
| §2 Goals | **+ Goal #8** "Compact, read-tool-style chat display" |
| §2 Non-Goals | **+ 2**: "No change to what the model receives — only message boundaries and display"; "No custom user-message rendering, no core patch" |
| §3.3 API table | **+ rows**: `before_agent_start`, `registerMessageRenderer`, `Box/Text/Markdown/Component` (pi-tui), `Theme#fg/bg/bold`, `highlightCode`/`getLanguageFromPath`, `convertToLlm` (relied-upon internal) |
| **§3.4** | **NEW** — "How `#@` delivers files *and* renders them compactly (the two-mechanism model)" with the pipeline diagram |
| **§6** | **REWRITTEN** — title "Output Format & Assembly" → "Output Format, Delivery & Chat Display"; old §6.2 "Assembly" replaced by §6.1 (format, unchanged) + **§6.2 (custom message)** + **§6.3 (renderer)** + §6.4 (assembly & shared state) |
| §7 Technical Reference | **+** `BeforeAgentStartEvent`/`Result` contract, `registerMessageRenderer`+`MessageRenderer` contract, `Component` constructors (`Box/Text`) |
| §8 File Structure | **+** `FileDetail` type + detail-push helpers; **+** renderer section (§6.3); factory now registers the renderer + the `before_agent_start` handler |
| §9 Algorithm | Rewritten: `State` gains `details`; `emitText`/image/binary push `FileDetail`s; `injectFiles` returns stripped text + `blocks`/`details`; two handlers + `pending` stash; **new** `renderInjectedMessage`/`readLine`/`tildify`/`expandHint` |
| §10 Edge cases | **+ ~16 display/delivery rows** (single/multi/image/binary/paged/color-parity/reload/print-mode/model-input-structure, plus defensive-rendering fallbacks) |
| §11 Test plan | **+ test cases #33–#41** (display + model-input structure); Done-definition count 32 → **41** |
| §12 Impl notes | Note #10 rewritten (deliver via custom message, don't append); **+ notes #20–#25** (two-hook stash, one-message decomposition, `details` is renderer-only, defensive renderer, green-vs-purple, tildify path display) |
| **§13.7** | **NEW** — rationale: why custom messages + renderer, the one tradeoff (two user messages), why it beats alternatives (dual-render/monkeypatch/wait-for-core) |
| Appendix A skeleton | `FileDetail`, `pending` stash, `before_agent_start` handler, `renderInjectedMessage`/`readLine`/`tildify` |

---

## 2. Scope & implementation impact (code change is required)

The current code ships the OLD model. This delta implements the NEW model. All core injection logic (regex, token cleanup, path resolution, file-type classification, paging, budget, markdown imports, code-region detection, dedup, bare-`@` option, autocomplete) is **unchanged** — only the delivery + display packaging changes.

### 2.1 `file-injector.ts` (the extension — primary work)

All line numbers are current-code references; the NEW-model target is PRD §9.

| Current code (OLD model) | Change to (NEW model) |
|---|---|
| `interface State` (line 329): `blocks, images, injectedSet, remaining, count, paged, bareAt` | **Add `details: FileDetail[]`** |
| — (does not exist) | **Add `interface FileDetail`**: `{ path; kind: "text"\|"image"\|"binary"\|"paged"; chars?; lines?; range?; pagedHeadLines?; dimensionHint? }` (PRD §6.2) |
| `emitText` (line 752): pushes only `blocks` (whole / head+directive) + `paged++` | **Also push a `FileDetail`** (text: `{path, kind:"text", chars, lines}` / paged: `{path, kind:"paged", chars, range:`:${startLine}-`, pagedHeadLines}`) |
| Image branch (line 719): `state.blocks.push(formatImageBlock(...))` | **Also push `{path, kind:"image", dimensionHint}`** |
| Binary branch (line 730): `formatBinaryBlock(abs)` → `blocks.push` | **Also push `{path, kind:"binary"}`** |
| `injectFiles` return (lines 971, 987–988): `{ text: strippedText+"\n\n---\n\n"+blocks, images, injected, paged }` | **Return `{ text: strippedText (NO `---` append), images, injected, paged, blocks, details }`** — expose `blocks`/`details` so the caller (the `input` handler) can hand them to `before_agent_start` |
| `input` handler (line 1032): `injectFiles(...)` then `return { transform, text, images }` where `text` contains the appended blocks | **Stash** `pending = { blocks, details }`; `return { transform, text: strippedText, images }` (text is now stripped-only) |
| — (only `session_start` + `input` + autocomplete `session_start` registered) | **Register `MessageRenderer("fileInjector.injected", renderInjectedMessage)` on `session_start`** (no `hasUI` guard — renderers are a no-op in print/json modes) |
| — (no `before_agent_start`) | **Add `pi.on("before_agent_start", ...)`**: consume `pending` → `return { message: { customType, content: blocks.join("\n\n"), display:true, details:{files: details} } }`; clear stash unconditionally (one-shot per prompt) |
| — (no renderer) | **Add `renderInjectedMessage(message, {expanded}, theme)`**, `readLine(detail, theme)`, `tildify(abs)`, `expandHint(theme)` (PRD §6.3/§9) |
| Imports: `resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir` | **Add** `highlightCode, getLanguageFromPath` from `@earendil-works/pi-coding-agent`; **add** `Box, Text, type Component` from `@earendil-works/pi-tui` |

### 2.2 Test suites (return-shape migration + new coverage)

The internal `injectFiles` is the test entry point (`mod.injectFiles(text, images, ctx, bareAt)`). Today it returns `{ text, images, injected, paged }` and **~161 assertions read `r.text` expecting the appended `<file>` blocks** (e.g. `r.text.includes("\n\n---\n\n")`, `r.text.indexOf('<file name=…>')`). Under the NEW model `r.text` is the stripped prompt only; the blocks live in `r.blocks` / `r.details`. This is a **mechanical but broad** migration, not a logic rewrite.

- **`file-injector.test.mjs`** (122 cases): migrate the ~161 `r.text`-block assertions to `r.blocks`/`r.details`; drop the `\n\n---\n\n` separator assertion; assert `r.text === strippedPrompt` (no blocks). The injection *logic* assertions (regex, cleanup, resolution, paging, imports, dedup, config) stay valid — only the container changes.
- **`relative-imports.test.mjs`** (38 cases) + **`import-behavior.test.mjs`** (22 cases): update the `injectFiles` return-shape reads (they currently read `r.text`/blocks).
- **New tests** (mirroring PRD §11 #33–#41): (a) `injectFiles` now returns `blocks`/`details` arrays of the right shape/length and a stripped `text`; (b) the `before_agent_start` handler emits the custom message with `content = blocks.join("\n\n")`, `display:true`, `details.files`; (c) the `input`/`before_agent_start` stash is one-shot (cleared on consume; empty when `input` short-circuits); (d) the renderer produces one `read <path>` line per file with correct kind/range/dimensionHint styling and a defensive fallback when `details.files` is absent. (The renderer can be unit-tested by calling `renderInjectedMessage` directly with a synthetic `CustomMessage` + a stub `theme`.)

### 2.3 `README.md` (Mode B — see §5)

Line 33 currently documents the OLD model verbatim ("file contents appear below a `---` rule … with the file appended underneath"). It must describe the NEW read-tool-style appearance.

---

## 3. Removed requirement (note for awareness)

**Removed: the append-to-prompt delivery model.** The `\n\n---\n\n`-separated concatenation of `<file>` blocks into the user-message text is gone (old PRD §6.2 "Assembly"; old §12.10 "Append, don't inline-replace"). It is replaced by the custom-message + renderer model (new §6.2/§6.3). No task is created to "preserve" it — this is the change itself. The functional guarantees that lived under the old model (whole file always reaches the model, no silent truncation, paging, dedup, budget) are **unchanged** and still apply to the custom message's `content`.

---

## 4. New & modified requirements

### R1 (NEW) — Deliver files as one custom message from `before_agent_start`
After the `input` handler strips `#@` and builds the blocks/details, a `before_agent_start` handler returns `{ message: { customType:"fileInjector.injected", content: blocks.join("\n\n"), display:true, details:{ files: details } } }`. The user message contains only the stripped prompt (no file bytes, no `---`). The stash handoff is one-shot (cleared on consume; empty ⇒ `before_agent_start` returns `undefined`/no-op). The model receives the same `<file>` blocks as two user-role messages instead of one. (PRD §3.4, §6.2, §9, §13.7.)

### R2 (NEW) — Register a green, collapsible `read`-line `MessageRenderer`
On `session_start`, register a renderer for `"fileInjector.injected"` that returns a `Box` with `theme.bg("toolSuccessBg", …)` containing **one `read <tildified-path>` line per file** (`theme.fg("toolTitle", theme.bold("read"))` + `theme.fg("accent", path)` + kind-specific suffix: `range` for paged, `dimensionHint` for images, `(binary — not injected)` for binaries), a single `(ctrl+o to expand)` hint, and — when expanded — each file's full content (`highlightCode` when a language is detected). It must be **defensive** (guard missing `details.files`/`bodies[i]`; never throw — a throw falls through to Pi's default purple box). Images are not re-rendered when expanded (they attach to the user message). (PRD §6.3, §12.23–25.)

### R3 (MODIFIED) — `injectFiles` return shape
Return `{ text: strippedPrompt, images, injected, paged, blocks, details }`. `text` is **no longer** `stripped + "---" + blocks`. This is the contract the tests depend on and the `input`/`before_agent_start` handoff reads. (PRD §9.)

### R4 (MODIFIED) — Shared `State` carries `details`
`State` gains `details: FileDetail[]` (parallel to `blocks` in pre-order emission order); `emitText`/image/binary each push their detail alongside their block. Budget/paging/dedup logic is unchanged. (PRD §6.4, §9.)

---

## 5. Documentation impact

- **Mode A (doc-with-work):** the implementing code is a single-file extension with no separate API/config doc files. There is no JSDoc-exported public surface beyond the internal helpers the tests already import; the relevant new internal symbol (`renderInjectedMessage` and the `FileDetail` shape) gets JSDoc as part of R2's implementation. No standalone doc file rides with this work.
- **Mode B (changeset-level docs):** **YES — `README.md` must be synced.** Line 33 ("appear below a `---` rule … appended underneath") describes the removed model and is now misleading. The "Usage" / "What gets injected" sections need a short, user-facing description of the NEW appearance: injected files render as compact green `read <path>` lines under the message (one per file, expandable), indistinguishable from the `read` tool, while the model still receives the full contents. This is a cross-cutting overview update that only makes sense once R1–R2 land, so it is the final requirement below.

---

## 6. Verified API surface (implementer reference)

Confirmed present in the installed `@earendil-works/pi-coding-agent` v0.80.7 + `@earendil-works/pi-tui` (this delta introduces no new external dependency):

- `pi.on("before_agent_start", handler)` + `BeforeAgentStartEventResult.message?: Pick<CustomMessage, "customType"|"content"|"display"|"details">` (`dist/core/extensions/types.d.ts:514, 787, 855`).
- `CustomMessage`: `{ role:"custom"; customType; content: string | (TextContent|ImageContent)[]; display; details?; timestamp }` — `details` is generic, **ignored by `convertToLlm()`**, so it is free of model tokens (`dist/core/messages.d.ts:32`).
- `pi.registerMessageRenderer<T>(customType, renderer)`; `MessageRenderer<T> = (message, options:{ expanded: boolean }, theme: Theme) => Component | undefined` (`types.d.ts:816, 822, 891`).
- `Box(paddingX?, paddingY?, bgFn?)` with `addChild`/`setBgFn`; `Text(text?, paddingX?, paddingY?, customBgFn?)` with `setText` (pi-tui `dist/components/box.d.ts`, `text.d.ts`). `Component` interface exported from `pi-tui`.
- `highlightCode`, `getLanguageFromPath` exported from the pi package (`dist/index.d.ts:29`); `formatDimensionNote`, `resizeImage` already in use (`:33`).

**Gotchas already documented in PRD §12.20–25** (do not re-litigate): one-message-per-handler ⇒ all files pack into one custom message; `details` must never duplicate file bytes (renderer re-parses them from `content` via `<file name="…">…</file>`); renderer must never throw; use `toolSuccessBg` (green) **not** `customMessageBg` (purple); tildify paths because Pi's `renderToolPath` is internal; hardcode `ctrl+o` because `keyText()` is internal.

---

## 7. Acceptance criteria — the delta is complete when

1. **Delivery model swapped.** `file-injector.ts` has a `before_agent_start` handler that returns the `fileInjector.injected` custom message; the `input` handler returns a stripped prompt (no `---`, no blocks) and stashes blocks/details; `State` carries `details`; `emitText`/image/binary push `FileDetail`s; `injectFiles` returns `{ text(stripped), images, injected, paged, blocks, details }`. The string `\n\n---\n\n` no longer appears in the code's output path.
2. **Renderer registered + green read-lines.** A `MessageRenderer("fileInjector.injected", …)` is registered on `session_start`; it returns a `Box` on `toolSuccessBg` with one `read <tildified-path><suffix>` line per file, a single `(ctrl+o to expand)` hint, and expands to full/highlighted content; it never throws and falls back gracefully when `details.files` is absent.
3. **Model input unchanged in content.** The model still receives every `<file name="…">…</file>` block (now as a second user-role message); byte-identical contents to the old single-message form (PRD §13.7). Existing injection/import/paging/budget behavior is preserved.
4. **Tests green & migrated.** `npm run typecheck` (tsc --strict) passes; all three suites pass with the migrated return-shape assertions; new delivery + display tests (custom-message structure, one-shot stash, renderer read-lines + fallback) pass. The 9 new manual cases §11 #33–#41 are covered by runnable assertions.
5. **Docs coherent.** `README.md` describes the compact read-tool-style appearance, not the removed `---`-append model.

---

## 8. Phase / milestone / task breakdown

> **One phase, two milestones.** This is a single cohesive feature (compact display via custom-message delivery). The code work (M1) and the test+docs work (M2) are separable milestones within one phase. Keep the implementation to the `file-injector.ts` + test + README surfaces named above — do not widen scope to other features.

### Phase P1 — Compact read-tool-style display via custom-message delivery

#### Milestone P1.M1 — Implement delivery + renderer in `file-injector.ts`
**Task P1.M1.T1 — Thread `details` through the injection core.** Add `interface FileDetail` and `details: FileDetail[]` to `State`; make `emitText` push text/paged details, the image branch push an image detail (with `formatDimensionNote`), and the binary branch push a binary detail; change `injectFiles`'s return to expose `blocks` + `details` and to return a **stripped-only** `text` (delete the `\n\n---\n\n` concatenation at lines 987–988).
  - S1: Add `FileDetail` + `State.details`; update `emitText` to push text/paged `FileDetail`s alongside blocks. (PRD §6.4, §9 `emitText`.)
  - S2: Update the image and binary branches in `injectFile` to push their `FileDetail`s; update `injectFiles`'s return shape to `{ text: stripped, images, injected, paged, blocks, details }`. (PRD §9.)

**Task P1.M1.T2 — Split delivery across two hooks + register the renderer.** Add the `pending` closure stash; change the `input` handler to stash `{blocks, details}` and return the stripped prompt; add the `before_agent_start` handler that consumes the stash and returns the custom message (cleared unconditionally); register `MessageRenderer("fileInjector.injected", renderInjectedMessage)` on `session_start`; implement `renderInjectedMessage`/`readLine`/`tildify`/`expandHint` with the green `toolSuccessBg` box, defensive guards, and `highlightCode` for expanded content; add the new imports (`highlightCode`, `getLanguageFromPath`, `Box`, `Text`, `Component`). (PRD §3.4, §6.2, §6.3, §9 factory + renderer, §12.20–25.)
  - S1: `input`/`before_agent_start` split + `pending` one-shot stash + custom-message return.
  - S2: `MessageRenderer` registration + `renderInjectedMessage` (green read-lines, expand path, defensive fallback). (PRD §6.3.)

#### Milestone P1.M2 — Migrate tests + sync README (Mode B)
**Task P1.M2.T1 — Migrate existing assertions to the new return shape.** Update `file-injector.test.mjs` (122), `relative-imports.test.mjs` (38), and `import-behavior.test.mjs` (22): replace the ~161 `r.text`-block assertions with `r.blocks`/`r.details` reads; assert `r.text === strippedPrompt` (no blocks, no `---`); keep all injection/import/paging/dedup/config logic assertions valid. (PRD §9 return shape; §11 existing matrix.)
  - S1: Migrate `file-injector.test.mjs` (the bulk of the 161 assertions) to `r.blocks`/`r.details`.
  - S2: Migrate `relative-imports.test.mjs` + `import-behavior.test.mjs` return-shape reads.

**Task P1.M2.T2 — Add delivery + display tests; sync README.** Add runnable tests for: (a) `injectFiles` returns `blocks`/`details` of correct shape/length + stripped text; (b) the `before_agent_start` handler emits `{ customType, content: blocks.join("\n\n"), display:true, details:{files} }` and is one-shot (cleared on consume; no-op when `input` short-circuited); (c) `renderInjectedMessage` yields one `read <path>` line per file with correct kind/range/dimensionHint suffixes and a single expand hint, and falls back when `details.files` is absent. Then sync `README.md` (Mode B): rewrite the "appear below a `---` rule … appended underneath" description (line 33) to the compact green `read <path>`-line appearance. (PRD §11 #33–#41; §10 display rows.)
  - S1: New delivery + display tests (custom message, stash lifecycle, renderer output + fallback).
  - S2: README Mode-B sync (Usage / "What gets injected" → read-tool-style appearance; no `---`-append language).

---

## 9. Implementation notes specific to this delta

- **Do not touch the injection engine.** Regexes, `cleanToken`, `resolveImportPath`, `computeCodeRanges`, budget/paging, markdown recursion, dedup, bare-`@`, config loading, and the autocomplete provider are all unchanged. The diff should be confined to: `State`/`FileDetail`, the three emit branches' detail pushes, `injectFiles`'s return + the deleted `---` concat, the `input`/`before_agent_start` split, the renderer, and imports.
- **`injectFiles` is the migration seam.** Keeping it as the single internal entry point that returns `{ text, images, injected, paged, blocks, details }` means the test migration is a return-shape rewrite, not a logic rewrite — and the `input` handler just forwards `blocks`/`details` to the stash.
- **The stash is the whole coordination.** `prompt()` runs `input → … → before_agent_start → runAgentPrompt` sequentially in one awaited call, so the closure `pending` needs no locking. Clear it unconditionally in `before_agent_start` so a later non-`#@` prompt never re-delivers a stale stash (PRD §12.20).
- **`details` is renderer-only.** Never put file bytes in `details` — `convertToLlm()` ignores it, and the renderer re-parses bodies from `content` via the `<file name="…">…</file>` regex. This keeps `details` cheap and the model input uncontaminated (PRD §12.22).
- **Green, not purple.** `toolSuccessBg` + `toolTitle`+bold + `accent` path — the exact recipe a completed `read` call uses. Do **not** use `customMessageBg` (that is the `[skill]` purple). Only the collapse/expand affordance is shared with skills (PRD §12.24).
- **The renderer must never throw.** Guard `message.details?.files` (absent on old/foreign entries), guard `bodies[i]`, and skip re-rendering images when expanded (they attach to the user message). A throw is caught by `CustomMessageComponent` and falls back to the default purple box — acceptable, not the goal (PRD §12.23).
- **The tradeoff to keep.** The model's input becomes two user-role messages (prompt, then `<file>` blocks) instead of one. Content is byte-identical; only the boundary differs. This is the unavoidable cost of compact display at the extension level and must not be "fixed" by re-appending blocks to the prompt (PRD §13.7).
