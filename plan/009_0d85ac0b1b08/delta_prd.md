# Delta PRD: Preserve the Prompt Verbatim (stop stripping `#@` markers)

**Status:** Draft · **Changes from:** Plan 008 (completed) · **Artifact type:** In-place edit of the existing `file-injector.ts` extension + tests + README

---

## 1. The Change (one decision, precisely scoped)

**Plan 008 ships a working extension whose `input` handler *strips* `#@` from the user prompt (and strips resolved `#@`/bare-`@` markers from delivered markdown content) before storing the message.** The current PRD reverses that: **the prompt is never modified.** The `input` handler returns `event.text` byte-for-byte intact; delivered markdown files keep their import markers verbatim.

### Why (the newly-discovered constraint)

Pi does **not** replay typed text on cancel/fork/`/tree`-navigate — it re-feeds the **stored** user-message content. Verified in `agent-session.ts`: `navigateTree()` prefills the editor from `_extractUserMessageText(targetEntry.message.content)`; there is **no** extension hook to override that prefill (`session_tree` fires *before* `editor.setText`, so `ctx.ui.setEditorText()` there is silently clobbered). The same stored-content replay applies to queued follow-up/steer dequeue (`restoreQueuedMessagesToEditor`) and forks.

Consequence: if the extension strips `Review #@a.ts` → `Review a.ts` before storing, the re-submitted prompt contains no `#@`, the `input` handler injects nothing, and **the files silently vanish on every re-open.** Preserving the prompt verbatim makes re-submission reliably re-trigger injection. (Full reasoning: PRD §13.8, new in this delta.)

### What changes in code (all in `file-injector.ts`)

| Location (verified current line numbers) | Today (Plan 008) | After this delta |
|---|---|---|
| `scanTokens` signature & return (L856-886) | returns `Promise<{ index: number; prefixLen: number; abs: string }[]>` | returns `Promise<string[]>` (resolved abs paths, encounter order). Drop `index`/`prefixLen` — markers are detected only to resolve imports, never stripped. |
| `processTokenStream` (L904+, called L1225) | returns `Promise<number[]>` (resolved marker indices for stripping) | returns `Promise<void>`. Injects each resolved token; no indices collected. |
| `injectMarkdown` Step 3.5 (L1118-1138) | stat+`fs.access(R_OK)` pre-check to decide which markers to strip | **DELETE** entirely — existed only to gate stripping. |
| `injectMarkdown` Step 4 (L1141-1147) | strips `#@`/bare-`@` from `content` → `stripped` | **DELETE** the stripping loop. `emitText` operates on the **verbatim** `content`. |
| `injectMarkdown` Step 5 (L1151) | `emitText(abs, stripped, state)` | `emitText(abs, content, state)` (verbatim). |
| `injectMarkdown` recursion (L1155+) | recurses over `injectable` (stat-filtered records) | recurses over the resolved abs paths from `scanTokens` (dedup re-checked in `injectFile`). |
| `injectFiles` L1225-1246 | computes `resolvedIdx`, builds `strippedText`, returns `text: strippedText` | drop `resolvedIdx`/`strippedText`; return `text` (the original prompt) **verbatim**. |
| `input` handler return (L1327) | `return { action: "transform", text, images }` where `text` is stripped | `return { action: "transform", text: event.text, images }` (verbatim). |

### What does NOT change

- **The renderer** (`renderInjectedMessage`, L739+) reads `message.content` (the `<file>` blocks) and re-parses bodies — it never depended on stripping. Verbatim markdown content (markers visible in the expanded view) is honest: it matches exactly what the model sees.
- **The `before_agent_start` handler and the one-shot `pending` stash** — unchanged. The stash still carries `{ blocks, details }`; only the *input handler's returned text* changes.
- **All injection engine logic**: regexes (`FILE_INJECT_RE`, `BARE_AT_RE`), `cleanToken`, `resolveImportPath`, `computeCodeRanges`/`inCode`, budget/paging (`emitText` decision logic), markdown recursion structure, dedup (`injectedSet`), `markdownBareAtImports` config, the autocomplete provider.
- **`emitText`'s paged decision** — unchanged logic; it just runs on verbatim content instead of stripped content (markers are a handful of extra chars, negligible for the budget).
- **Image/binary branches** in `injectFile` — never stripped anything.
- **`injectFiles` return shape** — still `{ text, images, injected, paged, blocks, details }`; only the *value* of `text` changes (verbatim vs stripped).

### Net effect

The change is mostly **deletion of stripping logic** plus **signature simplification** (`scanTokens`/`processTokenStream` shed their index/prefixLen bookkeeping). The injection engine gets simpler, not more complex.

---

## 2. Goals & Non-Goals

### Goals
1. **The user prompt is stored verbatim.** `#@<path>` triggers stay exactly where the user typed them in the stored user message and in the model-visible prompt text. Re-submission (cancel + re-open, `/tree` navigate, fork, queued-followUp dequeue) re-triggers injection because the decorators survive.
2. **Delivered markdown content is verbatim.** Import markers (`#@` and bare-`@` when enabled) are *detected* to resolve imports but **never stripped** from the delivered block content.
3. **Simpler engine.** `scanTokens` returns resolved abs paths only; `processTokenStream` returns void; the markdown path no longer has a stripping step or a readability pre-check.
4. **Renderer and delivery are unaffected.** The custom-message mechanism, the `pending` stash, and the green `read`-line display all keep working unchanged.

### Non-Goals
- **No change to what the model receives.** The `<file>` blocks (byte-identical content, now including preserved markers inside markdown) are still delivered via the `before_agent_start` custom message. The model still sees every file.
- **No new features.** No new config, no new hooks, no new display behavior. This is a correctness fix to re-submission.
- **No change to the renderer.** Verbatim markers appearing in the expanded view of a markdown file is the intended honest behavior (matches model input); not a regression to paper over.
- **No re-introduction of stripping.** The earlier `prefixLen`/`index` machinery is gone for good — it existed solely to support stripping, which is removed.

---

## 3. Scope Delta (diff against Plan 008's PRD)

| PRD section | Change | Impact |
|---|---|---|
| §1 Solution "How delivery works" + Value prop "Reads like a `read`" | "stripped to bare paths" → "preserved verbatim … so cancel/fork/re-open re-trigger injection" | prose |
| §2 Goal #8 | "user bubble shows only what they typed" → "shows the prompt **verbatim** … `#@` preserved" | prose |
| §3.4 flow diagram | `text: strippedPrompt` → `text: event.text`; "strip #@ from the prompt" → "leave the prompt text VERBATIM" | prose + pseudocode |
| §4.5 rule 4 + §4.6 Effect | add "resolved imports are never stripped from surrounding text (§6.4)" | prose |
| §5.6 Step 3/4/5 (markdown) | Step 3 notes "markers never stripped … no index/prefixLen"; Step 4 deletes stripping; Step 5 emits on verbatim content; renumber recurse to Step 5 | spec + pseudocode |
| §6.2 "What the model receives" | "stripped prompt — #@ removed" → "verbatim prompt — #@ preserved" | prose |
| §6.4 "User-message text" | FULL REWRITE: "Strip the trigger" → "The prompt is never modified" + re-submission robustness + "Why verbatim instead of strip-and-reference?" | spec |
| §6.4 Two returns | `text: strippedPrompt` → `text: event.text` | spec |
| §8 File Structure item 5/7 | `scanTokens → string[]`; `processTokenStream → injects (no return)`; factory "return transform with `text: event.text`" | spec |
| §9 pseudocode | `scanTokens`/`processTokenStream` signatures + `injectMarkdown` (no Step 4 strip) + input handler return | pseudocode |
| §10 Edge cases | ~10 rows: "inline marker becomes `a.ts`" → "prompt stored verbatim"; markdown rows "marker stripped" → "block delivered verbatim (marker preserved)"; **ADD 3 rows**: Cancel+re-open, Fork at user message, Queued follow-up dequeue | table |
| §11 Test matrix | ~8 cases: "user bubble reads `Review a.ts`" → "reads `Review #@a.ts` (verbatim)"; **ADD case #42** re-open re-injection; Done-definition updated | table |
| §12 gotchas #10, #16 | #10 "strip the trigger" → "preserve the prompt verbatim" (with cancel/fork/`/tree` reasoning); #16 "Strip resolved markers in both scopes" → "Never strip markers — verbatim delivery everywhere" | notes |
| §13.7 | input handler "leaves the prompt text verbatim so cancel/fork/re-open re-trigger injection" | prose |
| §13.8 (NEW) | "Why the prompt is preserved verbatim (no `#@` stripping)" — the full rationale + `navigateTree` mechanism | new section |

---

## 4. Plan

### Phase P1 — Stop stripping; preserve prompt verbatim

**Milestone P1.M1 — Remove stripping from the injection engine + input handler** (edits `file-injector.ts`)

- **Task P1.M1.T1 — Stop stripping in `injectMarkdown`; simplify `scanTokens`/`processTokenStream`**
  - `scanTokens` (L856-886): return `Promise<string[]>` (resolved abs paths, encounter order); drop `index`/`prefixLen` from the output and from the internal `cands` array; update the JSDoc (L850-854) to drop the "so a consumer can strip" language. The `FILE_INJECT_RE` + `BARE_AT_RE` match loops, code-region skip, `cleanToken`, relative-only, extension-shorthand, and dedup (`localSeen` + `injectedSet`) all stay.
  - `processTokenStream` (L904+): return `Promise<void>`; drop the `resolved` accumulator; just `await injectFile(abs, state, ctx)` for each resolved abs.
  - `injectMarkdown` (L1040+): **delete Step 3.5** (the stat/`fs.access(R_OK)` pre-check, L1118-1138) and **delete Step 4** (the `stripped` slicing loop, L1141-1147); change Step 5 to `emitText(abs, content, state)` (verbatim); change the recursion to iterate the resolved abs paths directly. Update the function's JSDoc to reflect the 5-step (was 6-step) algorithm and the "markers detected, never stripped" contract.
  - `injectFiles` (L1225-1246): delete the `resolvedIdx` binding and the `strippedText` loop; `return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details }` where `text` is the original prompt verbatim. The `count === 0` early return (L1224) already returns the original `text` — unchanged.
  - **Doc impact (Mode A):** none beyond the JSDoc rewrites in-task (these functions are internal; no exported-symbol-level docs).

- **Task P1.M1.T2 — Input handler returns verbatim; verify stash/delivery unaffected**
  - `input` handler (L1319-1328): the destructured `text` from `injectFiles` is now the verbatim prompt; change the return to `return { action: "transform" as const, text: event.text, images }` (or equivalently `text` now that it equals `event.text` — prefer `event.text` for explicitness matching PRD §6.4). The `pending` stash assignment, the notify, and the `!injected` short-circuit are unchanged.
  - Verify (read-only) that `before_agent_start` (L1332+) and `computeDetailOffsets` (L353, called L1335) are untouched — they consume `blocks`/`details`, not the prompt text, so verbatim markers in markdown blocks flow through unchanged.
  - Verify (read-only) that `renderInjectedMessage` (L739+) re-parses bodies from `message.content` via `FILE_BLOCK_RE` — verbatim markers inside a markdown block's body are simply displayed as-is in the expanded view (honest; matches model input). No renderer edit.
  - **Doc impact (Mode A):** none — handler internals; the user-facing display description is Mode B (P1.M2.T3).

**Milestone P1.M2 — Migrate tests to verbatim assertions; add re-open regression; sync README (Mode B)**

- **Task P1.M2.T1 — Migrate stripped→verbatim assertions across all three test files**
  - `file-injector.test.mjs` (~93 hits on stripped-prompt/marker assertions): every `r.text === "Review a.ts"` (stripped) → `r.text === "Review #@a.ts"` (verbatim); every assertion that a markdown block's content had its marker stripped → assert the marker is **present** (verbatim) in `r.blocks`; every `out.text` (handler-level) stripped check → verbatim. The block-content assertions that read `r.blocks` (introduced by Plan 008) stay valid — only the *marker-presence* expectations flip from "absent" to "present". Injection-logic assertions (regex, cleanup, resolution, paging, imports, dedup, config, code-region) are unchanged.
  - `relative-imports.test.mjs` + `import-behavior.test.mjs`: the `has()`/`blocksRel()`/`countAbs()` helpers operate on `r.blocks.join("\n\n")`; update marker-presence expectations (markers now appear verbatim in delivered markdown content). Import *resolution* logic tested is unchanged.
  - **Doc impact (Mode A):** none — test files.

- **Task P1.M2.T2 — Add re-open / re-submit regression tests (PRD §11 case #42 + §10 new rows)**
  - Add cases to `file-injector.test.mjs` covering: (a) **return shape** — `injectFiles("Review #@a.ts", …)` returns `text === "Review #@a.ts"` (verbatim, `#@` preserved) AND `blocks.length === 1` AND `details.length === 1`; (b) **handler-level** — capture `input`, invoke with `Review #@a.ts`, assert `out.text === "Review #@a.ts"` (verbatim) and `out.action === "transform"`; capture `before_agent_start`, invoke, assert the returned `message.content` contains the `<file>` block; (c) **re-open simulation** — model the constraint: store the handler's returned `text`, re-feed it to a *fresh* `input` invocation, assert injection re-triggers (blocks re-produced) because `#@` survived; (d) **markdown verbatim** — `#@notes.md` where `notes.md` imports `#@api.md`: assert `notes.md`'s block contains the literal `#@api.md` marker (not stripped), and `api.md` is still injected.
  - **Doc impact (Mode A):** none — test files.

- **Task P1.M2.T3 — Sync README for verbatim prompt (Mode B, changeset-level)**
  - `README.md` L41: rewrite "The `#@` trigger is stripped from each reference, so `Review #@a.ts` appears in your message as `Review a.ts`" → "`#@` triggers stay in your message as you typed them (`Review #@a.ts` stays `Review #@a.ts`), so cancelling and re-opening, forking, or re-submitting re-triggers injection; the file bytes are delivered to the model underneath — never pasted into your bubble."
  - `README.md` L43: rewrite "the import marker is stripped from `spec.md`" → "the import marker stays in `spec.md` verbatim (same as a top-level marker)."
  - Do **not** touch install/syntax/config/limits/`#@`-vs-`@` sections — unchanged by this delta.
  - This is the Mode B changeset-level doc sync; it depends on P1.M1 (the behavior) and P1.M2.T1/T2 (the tests confirming it).

---

## 5. Acceptance

- `npm test` (all three suites) green with verbatim assertions.
- `pi -e .` loaded: `Review #@a.ts` → user bubble shows `Review #@a.ts`; green `read a.ts` line below; model receives the verbatim prompt + the `<file>` custom message.
- **Re-open regression:** submit `Review #@a.ts`, cancel (ESC), `/tree` → select the user message → resubmit unchanged → `a.ts` is re-injected (custom message re-created, no `read` call). Confirms decorators survive cancel/re-open.
- Markdown import: `#@notes.md` (imports `#@api.md`) → `notes.md` block contains the literal `#@api.md` marker; `api.md` injected; notify `2 whole`.
- `scripts/typecheck.mjs` (`tsc --strict`) passes — the `scanTokens`/`processTokenStream` signature changes type-check against their (now simpler) call sites.