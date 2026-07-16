# External Dependencies & Verified Pi Internals — `#@file` Injector Bug Fixes

The extension has **zero npm runtime dependencies** beyond Pi's own packages
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`). All "external" facts below were
verified against the installed Pi package (`npm root -g`/`@earendil-works/pi-coding-agent`) and the
committed code. No new dependencies are introduced by any of the four fixes.

## 1. Read tool `offset` semantics — drives Issue 4

Verified in `dist/core/tools/read.js`:
```js
// param schema
offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
limit:  Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
// execute():
const startLine = offset ? Math.max(0, offset - 1) : 0;   // 1-indexed → 0-indexed array access
const startLineDisplay = startLine + 1;
if (startLine >= allLines.length) throw new Error(`Offset ${offset} is beyond end of file …`);
const endLine = Math.min(startLine + limit, allLines.length);   // when limit present
selectedContent = allLines.slice(startLine, endLine).join("\n");
```
- `offset` is **1-indexed**; `offset:0` is falsy → `startLine = 0` → reads from line 1 (the very
  top). `offset:1` also reads from line 1. To resume AFTER the first N lines, pass `offset: N+1`.
- `limit` is a **line count** (`DEFAULT_MAX_LINES = 2000`), NOT bytes. Output is also capped by
  `DEFAULT_MAX_BYTES`.
- **Implication for Issue 4**: the head block is `content.slice(0, HEAD_BYTES)` (8192 **bytes** ≈
  2000 lines), but the read window is line-based. `offset:0` re-reads the head. The corrected
  directive must point the model past the head (line-based) or drop the head and page from the start.

## 2. `FILE_INJECT_RE` match geometry — drives Issue 2

`FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu`
- Group 1 `(^|(?<![\p{L}\p{N}_]))` is **zero-width** (start-of-string OR a negative lookbehind for a
  Unicode letter/number/underscore). It consumes NO characters.
- Therefore `m.index` is exactly the index of the `#`, and `m[0]` is exactly `#@<rawtoken>` (the raw
  token BEFORE `cleanToken` trims trailing punctuation). `m[0].length === 2 + raw.length`.
- **Implication for Issue 2**: removing exactly the 2 chars at `m.index` drops `#@` and leaves the
  raw path token in place — no leading-char bookkeeping needed. This makes the index-based splice
  fix collision-free.

## 3. `injectFiles` budget inputs (unchanged by these fixes, for context)

`ctx.getContextUsage?.()` → `{ tokens: number | null; contextWindow: number; percent: number | null } | undefined`.
`ctx.model?.{ contextWindow, maxTokens }`. Both optional; `undefined`/`null` → `remainingBudget=null`
→ O-1 fallback (inject whole). None of Issues 1–4 touch the budget logic.

## 4. Resize / image APIs (untouched)

`resizeImage(new Uint8Array(buf), mime): Promise<ResizedImage | null>` and
`formatDimensionNote(resized)`. None of the four fixes touch the image path (Issue 1's image-dedup
only adds a set membership check before the resize; the resize itself is unchanged).

## 5. Test harness load mechanism (for the implementing agents)

`file-injector.test.mjs` resolves the global pi package via `npm root -g`, loads jiti from
`<pipkg>/node_modules/jiti/lib/jiti.mjs`, applies Pi's alias map, and `jiti.import`s the real
`file-injector.ts`. Mocks: `makeMockCtx(cwd, {hasUI})` (notify-recording ctx), `PAGED_FIX` (tight
budget ctx), `captureHandler(event)` (captures the `input`/`session_start` callback from the
factory). New regression cases should reuse these helpers. Run gate:
`node ./file-injector.test.mjs` → exit 0 iff all green.
