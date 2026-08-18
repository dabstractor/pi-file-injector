## 6. Output Format, Delivery & Chat Display

`#@` has three concerns that used to be one: **(A)** the *model-facing* format of each delivered file (unchanged — still Pi-native `<file>` tags), **(B)** *how* those blocks reach the model (new — as a custom message, not appended prompt text), and **(C)** *how* they render in the chat (new — green, collapsible `read` lines via a registered renderer). This section specifies all three.

### 6.1 Model-facing format: Pi-native `<file>` tags (unchanged)

Each delivered file is still serialized exactly as Pi's own CLI `@file` expansion emits (from `processFileArguments`), so the model sees identical structure regardless of source. The only change is *where* the resulting strings live (the custom message's `content`, §6.2) — not their format.

**Text file** →
```
<file name="/absolute/path/to/file.ts">
<entire file contents>
</file>
```

**Image file** → an `ImageContent` block is attached to the **user message** (via the `input` transform's `images`, §6.4) **and** a text reference tag is emitted in the custom-message content:
```
<file name="/absolute/path/to/img.png"><optional dimension hints></file>
```

**Binary (non-image)** →
```
<file name="/absolute/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```

**Paged text** → a head block (§5.5) followed by a directive block:
```
<file name="/absolute/path/to/huge.log">
<first HEAD_CHARS of content>
</file>
<file name="/absolute/path/to/huge.log"><paged: <len> chars; head delivered <injectedLines> complete lines; read the rest with the read tool at offset:<startLine>, limit:2000, incrementing offset by 2000 until done></file>
```

Use the **absolute resolved path** as `name` (matches the CLI format). All blocks for a prompt are concatenated (joined by `"\n\n"`) into the custom message's `content`.

### 6.2 Delivery: a custom message returned from `before_agent_start`

Files are delivered to the model as **one custom message** per prompt, returned from a `before_agent_start` handler. This is the public hook Pi provides for “inject a persistent message, stored in session, sent to the LLM” (verified: `prompt()` appends each handler's returned `message` to the turn's message list **after** the user message; `convertToLlm()` maps `role:"custom"` → a user-role message; the `message_end` path persists it as a `CustomMessageEntry`).

**The custom message:**
```ts
{
  customType: "fileInjector.injected",
  content:   state.blocks.join("\n\n"),   // every <file> block (text/head/directive/binary/img-ref)
  display:   true,                        // render in the TUI (§6.3)
  details:   { files: fileDetails },       // per-file metadata for the renderer (§6.3)
}
```
`fileDetails` is an array, **one entry per delivered file, in emission (pre-order depth-first) order**, each shaped:
```ts
interface FileDetail {
  path: string;                 // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;               // text: content length; paged: full content length
  lines?: number;               // text: total line count (for the “N lines” hint)
  range?: string;               // paged: ":<startLine>-" resume range; ranged text: the delivered ":N" / ":N-M" (clamped, LR-5; §17.6)
  pagedHeadLines?: number;      // paged: complete lines delivered in the head
  dimensionHint?: string;       // image: formatDimensionNote(resized) (e.g. "(resized to 1568×1044)")
}
```
Details carry *only* metadata the renderer needs to draw lines and expansion; the **bytes** live in `content` (sent to the model) and are re-derived for display from `content`/`details` — never duplicated into the model input.

**What the model receives** (after `convertToLlm`):
```
[ user:   "<verbatim prompt — exactly what the user typed, #@ preserved>"  + <injected images> ]
[ user:   "<file name="/abs/a.ts">\n…\n</file>\n\n<file name="/abs/b.md">\n…\n</file>" ]
                     └─ the custom message, mapped to a user-role message ─┘
```
I.e. the model sees the prompt, then every `<file>` block — the same content as before, now split across two user-role messages instead of concatenated into one. See §13.7.

**Why one custom message (not one per file).** `BeforeAgentStartEventResult` carries a single `message` (singular); `emitBeforeAgentStart()` aggregates one per handler across handlers, but a single extension handler returns one. So all files for a prompt are packed into one custom message, and the **renderer** (§6.3) decomposes `details.files` into one `read <path>` line per file. Unit expand/collapse (the whole message expands together on `ctrl+o`) matches the `[skill]` block precedent.

**Handoff via instance state.** The `input` handler does all file I/O and *stashes* `{ blocks, details }` on a closure variable; the `before_agent_start` handler reads and clears it. `prompt()` is sequential (`input` → … → `before_agent_start` → `runAgentPrompt`, all awaited in one call), so there is no race: by the time `before_agent_start` fires, the stash is populated. If the `input` handler short-circuited (`source==="extension"`, steering, or no `#@`), the stash stays empty and `before_agent_start` returns `undefined` — a no-op.

**Ordering & persistence guarantees.**
- Files always render *after* the user's message and *before* the assistant reply (they're a later entry in the same message list).
- On session reload, the custom message is reloaded as a `CustomMessageEntry` and rendered through the same registered renderer (and re-sent to the model on continuation, exactly as the old appended text was).
- Works in **every input context** (interactive, initial CLI/`-p`, RPC) because `before_agent_start` fires inside `prompt()` for all of them. In print/JSON mode there is no TUI, so the renderer is simply not called — but the custom message still delivers the files to the model.

### 6.3 Chat display: a green, collapsible `read`-line box (the `MessageRenderer`)

On `session_start` the extension registers:
```ts
pi.registerMessageRenderer("fileInjector.injected", (message, { expanded }, theme) => { … });
```
The renderer returns a `Component` (from `@earendil-works/pi-tui`) that **replicates the `read` tool's completed-call look**:

- **Shell:** a `Box` with background `theme.bg("toolSuccessBg", t)` — the *same green* the `read` tool uses when a call succeeds (mirrors `ToolExecutionComponent`'s `bgFn` for a non-partial, non-error result). This is what makes reads look green; skills use `customMessageBg` (purple) instead.
- **Collapsed (default):** **one line per file**, each identical in spirit to the read tool's `formatReadCall`:
  ```
  read <path><range> (ctrl+o to expand)
  ```
  built as `theme.fg("toolTitle", theme.bold("read")) + " " + theme.fg("accent", displayPath) + range + hint` — the exact colors and bolding the built-in `read` call line uses. `range` is empty for whole text/image/binary files, `":<startLine>-…"` for paged files (mirrors `formatReadLineRange`), and the delivered `:N` / `:N-M` for a line-range slice — clamped to what was actually delivered, so display and delivery agree (§17.6/LR-5). For **images** the line appends `dimensionHint` (e.g. `read img.png (resized to 1568×1044)`). For **binary** files the line reads `read data.bin (binary — not injected)` so the model's note and the display agree. The `(ctrl+o to expand)` hint (`hint = theme.fg("dim", " (ctrl+o to expand)")`) is shown once for the whole box (like the `[skill]` block), not repeated per line. The expand key is hardcoded `ctrl+o` (the default binding, matching the user's example) because Pi's `keyText("app.tools.expand")` helper is internal and not importable; see §12.25.
- **Expanded (`ctrl+o`):** each file's full delivered text renders below its `read` line. Text/code content is passed through `highlightCode(content, getLanguageFromPath(path))` when a language is detected, else `theme.fg("toolOutput", content)` — matching how the `read` tool's `formatReadResult` shows code. Paged files show their head block plus the paged-directive text verbatim (the model-driven paging is unaffected; this is just the expanded view of what was delivered). Images are **not** re-rendered here — they are already attached to the user message above (§6.4); the expanded view just repeats the `read <img>` reference line.
- **Path display.** The renderer tildifies the absolute path for readability (leading `os.homedir()` → `~`), approximating the read tool's `renderToolPath`/`formatPathRelativeToCwdOrAbsolute` (those helpers are not exported from the package; tildification is the closest portable equivalent and is what the user's example showed — `read ~/.local/share/…/disk-passthrough-methods.md`).

**Visual outcome (matches the user's example):**
```
 read a.ts (ctrl+o to expand)
 read b.md
 read ~/notes/img.png (resized to 1568×1044)
```
all on the green `toolSuccessBg` background, directly under the user's message bubble — indistinguishable from three completed `read` tool calls except that they appear at submit time with no model round-trip.

**Defensive rendering.** If `details` is missing/malformed (e.g. an old session entry written before this feature), the renderer falls back to a single `read <n> files` line plus the raw `content` when expanded — it never throws (a renderer exception would fall through to Pi's default `[fileInjector.injected]` box, which is acceptable but not the goal).

### 6.4 Assembly & shared state

Maintain as **shared, mutable state across the entire prompt** (top-level tokens + every transitive markdown import — see §5.6):
- `blocks: string[]` — the `<file>…</file>` strings, appended in **pre-order depth-first** emission order (a file's own block, then its imports' subtrees, before the next sibling). These become the custom message's `content` (§6.2).
- `details: FileDetail[]` — per-file metadata, parallel to `blocks` emission order (text/head/directive/image-ref/binary each push their detail(s)).
- `images: ImageContent[]` — seeded from `event.images ?? []`, appended to for each image. Returned on the `input` transform so they attach to the **user message**.
- `injectedSet: Set<string>` — resolved absolute paths **claimed** so far; seeded with any paths already present as `<file name="…">` blocks in `event.text` (a user who pasted one, or a prior `@file`), so each path is injected at most once across the whole prompt.
- `count: number` — files delivered (block appended or image attached), whole or paged, **spanning the whole recursion**; `0` means none.
- `paged: number` — subset of `count` delivered via the §5.5 page path.
- `remaining: number | null` — the single context-budget accumulator (§5.6.2); every emitted block subtracts from it.

**User-message text (the `input` transform).** **The prompt is never modified.** The `input` handler performs all file I/O, classification, block/detail building, and image attachment, but it leaves `event.text` byte-for-byte intact — the `#@<path>` triggers (and bare `@<path>` imports when `markdownBareAtImports` is on, §4.6) stay exactly where the user typed them. The file *bytes* live only in the custom message (§6.2); the prompt carries nothing but the user's original text.

This matters for **re-submission robustness**. When the user cancels a request (ESC), forks the conversation, or navigates the session tree (`/tree`) back to a user message and re-submits, Pi re-feeds the **stored** user-message text into `prompt()` as the new input (verified in `agent-session.ts`: `navigateTree()` derives the editor prefill from `_extractUserMessageText(targetEntry.message.content)` and the interactive layer then calls `editor.setText(editorText)`; there is **no** extension hook to override that prefill — `session_before_tree` can cancel or alter the summary but not the editor text, and `session_tree` fires *before* `editor.setText`, so `ctx.ui.setEditorText()` there is silently clobbered). The same stored-content replay applies to follow-up/steer dequeue (`restoreQueuedMessagesToEditor`) and to forks. If the extension had stripped `#@`, the stored text would be bare paths with no triggers, the re-submitted prompt would contain no `#@`, the `input` handler would inject nothing, and **the files would silently vanish on every re-open.** Preserving the prompt verbatim means a re-submitted prompt is identical to the original, so injection re-triggers automatically across cancel + re-open, `/tree` navigate, `/fork`, and queued-message dequeue. Stripping's only real effect was deleting two characters per marker — negligible — and never any file bytes (those were always in the custom message). See §13.8.

Markers that did **not** resolve — missing / directory / read-error / deduped / absolute-or-tilde-in-markdown / inside-code — are of course also left verbatim (they always were). The user message is **never** appended with file bytes (that was the old design):
```
<the user's prompt, exactly as typed — verbatim, #@ preserved>
```

> **Why verbatim instead of strip-and-reference?** The earlier design stripped `#@` to a bare path for two stated reasons: (1) the bytes "now live in the custom message, so appending them to the prompt too would duplicate them" — but nothing is ever appended to the prompt in either design (the bytes are always in the custom message), so this never applied to the *marker*; and (2) a "cleaner" bubble. Both collapse: the only real effect of stripping was deleting two characters per marker (a handful of tokens), at the cost of breaking every re-submission path. Verbatim delivery is strictly better — honest (model and bubble both show exactly what the user typed), simpler (no marker-index/`prefixLen` bookkeeping anywhere), and re-open-safe.

**Images** are returned on the `input` transform (`images: state.images`) so they attach to the user message (as today); the custom message carries only their text reference tag.

**Two returns (not one).**
- `input` handler: `count > 0` → stash `{ blocks, details }`, notify, and `return { action: "transform", text: event.text, images: state.images }` (text **verbatim** — unchanged; images seeded from `event.images` plus any injected images); else `return { action: "continue" }` (nothing injected, no stash).
- `before_agent_start` handler: if a stash exists → `return { message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }` and clear the stash; else `return undefined`.

The renderer is registered once on `session_start` (§6.3).

---

