# System Context — Plan 008: Compact read-tool-style display

## Project State

This is an **existing, working extension** (`file-injector.ts`, 1114 lines) that ships the **OLD delivery model**.
Plan 008 is a **delta**: swap the delivery mechanism from "append file blocks to prompt text" to
"custom message + renderer" for compact read-tool-style chat display.

### What exists today (OLD model)

```
input event handler
  → injectFiles(text, images, ctx, bareAt)
    → scan #@ tokens, read/classify files, build <file> blocks
    → return { text: `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`, images, injected, paged }
  → return { action: "transform", text, images }   // text ALREADY contains the blocks
```

- **ONE hook**: `input` event only. No `before_agent_start`, no renderer.
- **File bytes** live inside the user-message text (after `\n\n---\n\n`), so the TUI shows them
  fully expanded in the user bubble. Pi core has no extension hook to collapse arbitrary `<file>`
  blocks (only `<skill>` blocks are collapsed, via hard-coded `parseSkillBlock()`).
- **State**: `{ blocks, images, injectedSet, remaining, count, paged, bareAt }` — no `details`.
- **injectFiles return**: `{ text, images, injected, paged }` — blocks are baked into `text`.

### What the PRD now specifies (NEW model)

```
input event handler
  → injectFiles(text, images, ctx, bareAt)
    → scan #@ tokens, read/classify files, build <file> blocks + FileDetail[]
    → return { text: strippedText, images, injected, paged, blocks, details }  // NO --- concat
  → stash pending = { blocks, details }
  → return { action: "transform", text: strippedText, images }   // text is stripped-only

before_agent_start event handler (NEW)
  → consume pending stash
  → return { message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }

session_start event handler
  → registerMessageRenderer("fileInjector.injected", renderInjectedMessage)  // NEW
```

- **TWO hooks**: `input` (rewrites prompt text) + `before_agent_start` (publishes the custom message).
- **File bytes** live in the custom message's `content`, rendered compactly by the `MessageRenderer`.
- The model still receives every `<file>` block — `convertToLlm()` maps `role:"custom"` → user-role.
- **State**: gains `details: FileDetail[]`.
- **injectFiles return**: gains `blocks: string[]` + `details: FileDetail[]`; `text` is stripped-only.

### What does NOT change

ALL injection engine logic is untouched: regexes (`FILE_INJECT_RE`, `BARE_AT_RE`), `cleanToken`,
`resolveImportPath`, `computeCodeRanges`, `inCode`, budget/paging (`emitText` decision logic),
markdown recursion (`injectMarkdown`), dedup (`injectedSet`), bare-`@` config, autocomplete provider.
Only the **packaging** of the output changes.

## Key files

| File | Lines | Role |
|---|---|---|
| `file-injector.ts` | 1114 | The extension (single-file). PRIMARY edit target. |
| `file-injector.test.mjs` | 2381 | Master acceptance matrix (~170 assertions on `r.text` block content). |
| `relative-imports.test.mjs` | 508 | File-relative import regression (38 cases). |
| `import-behavior.test.mjs` | 250 | Import behavior bug repros (22 cases). |
| `README.md` | ~200 | User-facing docs. Line 33-34 describe the OLD model. |
| `package.json` | 13 | Pi manifest. Unchanged. |
| `scripts/typecheck.mjs` | — | tsc --strict wrapper (resolves via `npm root -g`). Unchanged. |

## Critical code locations (file-injector.ts)

| Location | What | Delta action |
|---|---|---|
| L1-6 | Imports | **Add** `highlightCode, getLanguageFromPath` from pi-coding-agent; **add** `Box, Text, type Component` from pi-tui |
| L329-336 | `interface State` | **Add** `details: FileDetail[]` |
| — (new) | `interface FileDetail` | **Add** type: `{ path; kind; chars?; lines?; range?; pagedHeadLines?; dimensionHint? }` |
| L689-736 | `injectFile` branches | Image: **add** `pushImageDetail`; Binary: **add** `pushBinaryDetail` |
| L752-792 | `emitText` | **Add** `pushTextDetail` / `pushPagedDetail` alongside block pushes |
| L906-988 | `injectFiles` | **Change** return to `{ text(stripped), images, injected, paged, blocks, details }`; **delete** the `\n\n---\n\n` concat at L987 |
| L1028+ | Factory | **Add** `pending` closure; **split** input handler; **add** `before_agent_start`; **add** `registerMessageRenderer` |
| — (new) | Renderer section | **Add** `renderInjectedMessage`, `readLine`, `tildify`, `expandHint` |

## Verification of the OLD model (confirmed by research)

- `grep -E 'before_agent_start|registerMessageRenderer|FileDetail|pending|renderInjectedMessage|readLine|tildify' file-injector.ts` → **ZERO matches**.
- `injectFiles` returns `{ text: \`${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}\`, ... }` — blocks are IN the text.
- Factory registers exactly: `session_start` (config), `input` (inject), `session_start` (autocomplete). No third event.
- No imports from `@earendil-works/pi-tui` at all.
