# Test Migration Strategy — Plan 008

## Current test architecture

All three test files are **standalone zero-dependency ESM scripts** (no test runner). They load the
real `file-injector.ts` via Pi's jiti loader and call internal exports directly.

| File | Lines | Cases | Primary API used | Return reads |
|---|---|---|---|---|
| `file-injector.test.mjs` | 2381 | ~122 | `mod.injectFiles(prompt, images, ctx, bareAt)` | **~170 assertions on `r.text`** for `<file>` block content + `\n\n---\n\n` separator |
| `relative-imports.test.mjs` | 508 | ~38 | `mod.injectFiles(prompt, [], ctxFor(cwd), bareAt)` via `run()` | Content markers via `has(out.text, "MARKER")` helper + `blocksRel()` / `countAbs()` |
| `import-behavior.test.mjs` | 250 | ~22 | Same as above | Content markers via `has(out, "MARKER")` helper |

### How `injectFiles` is called and what the return looks like (OLD)

```js
const r = await mod.injectFiles("Review #@a.ts", [], FIX);
// OLD: r.text = "Review a.ts\n\n---\n\n<file name=\"/abs/a.ts\">\n...\n</file>"
// Tests assert: r.text.includes("\n\n---\n\n"), r.text.includes('<file name="...">...\n</file>')
```

### Handler-level testing

Tests also capture `input`/`session_start` handlers via `captureHandler("input")`:
```js
const slot = captureHandler("input");
const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
// Tests read: out.text, out.images, out.action
```

Under the NEW model, the `input` handler no longer has blocks in `out.text` — they are in the stash
consumed by `before_agent_start`. Tests must capture BOTH handlers and exercise the full flow.

## Migration impact

### file-injector.test.mjs (the bulk — ~170 assertions)

**Mechanical but broad.** Every assertion reading `r.text` for `<file>` content must switch to
`r.blocks` (the array of `<file>` block strings) or `r.details` (the `FileDetail[]` metadata array).

Patterns to migrate:
1. `r.text.includes("\n\n---\n\n")` → **DELETE** (separator no longer exists).
2. `r.text.includes('<file name="ABS">\n...\n</file>')` → `r.blocks.some(b => b.includes('<file name="ABS">'))`.
3. `r.text.indexOf('<file name="A">')` / ordering checks → check order in `r.blocks` array or `r.details`.
4. `r.text.includes("<paged:")` → `r.blocks.some(b => b.includes("<paged:"))`.
5. `r.text` (the full stripped prompt) → assert `r.text === strippedPrompt` (no blocks).
6. Handler-level: `out.text` after `input` → stripped prompt only. To verify delivery, capture
   `before_agent_start` and assert the returned `message.content` contains the blocks.

### relative-imports.test.mjs + import-behavior.test.mjs (more resilient)

These read content via helpers like `has(out.text, "MARKER")` where markers are unique content
strings embedded inside files. Under the NEW model, content moves to `r.blocks.join("\n\n")`. The
`has()` helper can be trivially updated to search `r.blocks.join("\n\n")` instead of `r.text`.

Alternatively, update `run()` to also return `blocks` and update `has()` to check there.

## New tests needed (PRD §11 #33-41)

1. **Return shape**: `injectFiles` returns `{ text, images, injected, paged, blocks, details }` where
   `text` is the stripped prompt (no blocks, no `---`).
2. **Custom message**: Capturing `before_agent_start` handler → it returns
   `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.
3. **One-shot stash**: `before_agent_start` clears the stash; calling it twice → second returns `undefined`.
   Empty stash (no `#@` in input) → `before_agent_start` returns `undefined`.
4. **Renderer output**: `renderInjectedMessage(message, { expanded: false }, stubTheme)` produces one
   `read <path>` Text per file with correct kind suffix (range/dimensionHint/binary note).
5. **Renderer fallback**: When `message.details.files` is absent → single fallback line, no throw.

## Test helper additions

The renderer can be unit-tested by calling `renderInjectedMessage` directly with a synthetic
`CustomMessage` and a **stub theme** (an object with `fg`, `bg`, `bold` methods that return their
input, so the test can assert the returned `Component`'s structure). The `Box`/`Text` components
from pi-tui are real objects; the test reads their `.children` / `.text` fields.

```js
const stubTheme = {
  fg: (k, t) => t,
  bg: (k, t) => t,
  bold: (t) => t,
};
```
