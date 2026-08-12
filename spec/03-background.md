## 3. Background: How Pi Handles Input (must-read for implementer)

Pi extensions are TypeScript modules exporting a default factory `(pi: ExtensionAPI) => void`. The correct hook is the **`input` event**, emitted from inside `AgentSession.prompt()` — the single entry point for **all** user prompts.

```
user submits prompt (interactive editor  OR  initial CLI/-p message  OR  RPC)
        │
        ▼
  AgentSession.prompt(text)
        │
        ├─► extension commands (/cmd) checked
        ├─► ★ input event ★   ← THIS EXTENSION HOOKS HERE
        │     handler may { action: "transform", text, images }
        ├─► skill (/skill:...) + prompt-template expansion
        └─► agent loop
```

The handler signature (verified in `dist/core/extensions/types.d.ts`):

```ts
pi.on("input", async (event, ctx) => {
  // event.text              -> raw user prompt (contains literal "#@path" text)
  // event.images            -> ImageContent[] already attached
  // event.source            -> "interactive" | "rpc" | "extension"
  // event.streamingBehavior -> undefined | "steer" | "followUp"

  return { action: "transform", text: newText, images: newImages }; // rewrite
  // or
  return { action: "continue" };                                     // pass through
});
```

A `transform` **replaces** the submitted prompt text and image list; the result is stored as the user message and sent to the model.

### 3.1 Why `#@` works everywhere (the key advantage)

Because the `input` event fires inside `prompt()` — and `prompt()` is called for interactive typed messages *and* the initial CLI/`-p`/RPC message — `#@file` injection happens uniformly in **all** contexts. This is something even Pi's own `@file` CLI expansion cannot claim (that expansion runs during argv parsing, *before* `prompt()`, and only at launch).

> **Canonical reference example to mirror:** `examples/extensions/inline-bash.ts` — it scans `event.text` for a regex (`!{cmd}`), expands each match, and returns `{ action: "transform", text, images: event.images }`. Structure this extension the same way, substituting the `#@path` pattern and file-reading for command execution.

### 3.2 Why `#@` is a safe, collision-free trigger

The two-character trigger `#@` (`#` immediately followed by `@`) is unambiguous against everything else in Pi and in prose:

| Existing use of `#` or `@` | Collision with `#@`? | Why |
|---|---|---|
| Pi interactive `@path` autocomplete / `@mention` | ❌ No | Requires bare `@`; `#@` has a leading `#`. |
| Pi CLI `@file` argv expansion | ❌ No | Runs pre-`prompt()` on argv; `#@file` starts with `#`, not `@`, so it's never parsed as a file arg — it reaches `prompt()` as text where we handle it. |
| `github-issue-autocomplete.ts` `#1234` | ❌ No | That matches `#` + digits; `#@` has `@` after `#`. |
| Markdown headings (`# Title`, `## Section`) | ❌ No | `#` + space/text, never `#` + `@`. |
| Email `user@host` | ❌ No | No `#`. |

So `#@` is a clean, dedicated trigger that coexists with all of the above.

### 3.3 Public vs internal utilities

The built-in CLI `@file` path uses helpers that are **not** exported from the package. This extension re-implements the thin missing pieces on top of *exported* APIs only (never import from `dist/...` internals — unstable surface):

| Built-in uses | Exported? | This extension uses |
|---|---|---|
| `resizeImage(bytes, mime)` | ✅ yes | directly (image downscale to provider limits) |
| `formatDimensionNote(resized)` | ✅ yes | directly (image dimension hint) |
| `getLanguageFromPath(path)` | ✅ yes | not used (markdown is treated as text + scanned for imports, §5.6; no per-language formatting) |
| `CONFIG_DIR_NAME` | ✅ yes | project-local config path (`<cwd>/.pi/file-injector.json`, §4.6) |
| `getAgentDir()` | ✅ yes | global config path (`~/.pi/agent/file-injector.json`, §4.6) |
| `processImage(bytes, mime)` | ❌ internal | `resizeImage` instead |
| `detectSupportedImageMimeTypeFromFile(path)` | ❌ internal | small inline MIME table (§5.2) |
| `resolveReadPath(p, cwd)` (tilde + macOS Unicode-space) | ❌ internal | inline tilde expansion via `os.homedir()` (§4) |
| `before_agent_start` event (return `{ message }`) | ✅ yes | **file delivery** — the custom message carrying all `<file>` blocks is returned here, appended after the user message, persisted, and sent to the LLM (§6.2) |
| `registerMessageRenderer(customType, renderer)` | ✅ yes | **chat display** — draws the injected files as green `read <path>` lines (§6.3) |
| `Box`, `Text`, `Markdown`, `Container`, `Spacer` (`@earendil-works/pi-tui`) | ✅ yes | the `Component`s the renderer returns (§6.3, §7) |
| `Theme#fg/bg/bold` (passed to the renderer) | ✅ yes | styling (`toolSuccessBg`, `toolTitle`, `accent`, `dim`) (§6.3) |
| `highlightCode`, `getLanguageFromPath`, `getMarkdownTheme` | ✅ yes | optional syntax highlighting for the expanded view (§6.3) |
| `convertToLlm()` (custom→user mapping) | ❌ internal (Pi core) | relied upon, not imported: this is *why* a custom message reaches the model (§6.2). Documented behavior, stable contract. |

### 3.4 How `#@` delivers files *and* renders them compactly (the two-mechanism model)

`#@` does two things on submit, through two different public hooks, because **display** and **model delivery** are served by different parts of Pi's pipeline:

```
user submits prompt with #@file
        │
        ▼
  AgentSession.prompt(text)
        │
        ├─► ★ input event ★  (this extension)
        │      • detect #@ tokens, read+classify each file
        │      • build the <file> blocks + per-file details
        │      • leave the prompt text VERBATIM (decorators preserved
        │        so re-open/fork re-trigger injection; §6.4)
        │      • STASH {blocks, details} in instance state
        │      • return { action:"transform", text: event.text, images }
        │            (user message = the prompt verbatim; no file bytes)
        │
        ├─► skill/template expansion on the (verbatim) text
        │
        ├─► build user message from the verbatim text + images
        │
        ├─► ★ before_agent_start event ★  (this extension)
        │      • read the stashed {blocks, details}
        │      • return { message: { customType:"fileInjector.injected",
        │                             content: blocks, display:true, details } }
        │      • clear the stash
        │      ──► Pi appends this custom message AFTER the user message,
        │          persists it, and (via convertToLlm) sends it to the model
        │          as a user-role message. The model sees every <file> block.
        │
        └─► agent loop  ──►  TUI renders messages in order:
              [user bubble: verbatim prompt]  then
              [★ renderer for "fileInjector.injected" ★ → green box,
                one `read <path>` per file, collapsible]
```

**Why two hooks, not one.** The `input` event is the *only* place an extension can attach images / react to the submitted prompt (it deliberately leaves the prompt **text** untouched — §6.4 — so cancel/fork/re-open re-trigger injection). But the `input` handler's job is to return a transform; it cannot append *separate* messages in the right position, and it cannot register display. Pi appends a `before_agent_start` handler's returned `message` **after** the user message (verified in `prompt()`), persists it, and routes it to the LLM (`convertToLlm`, `role:"custom"`→user) — which is exactly the position and lifecycle injected files need. The stash is the handoff: `input` produces the work, `before_agent_start` publishes it. Full spec in §6; pseudocode in §9.

**Why this is the only extension-level path to compact display.** The TUI collapses only `<skill>` blocks inside a user message — `parseSkillBlock()` is hard-coded in Pi core's `case "user"` renderer. There is **no** extension hook to collapse arbitrary `<file>` blocks that live *inside* user-message text. Therefore compact display *requires* the file bytes to live somewhere the TUI renders via a registered renderer — i.e. a custom message. Keeping the bytes in the user message (the old design) forces the full contents into the user bubble with no way to hide them. See §13.7 for the tradeoff.

---

