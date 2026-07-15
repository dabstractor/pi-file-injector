# Pi Extension API Verification — `#@file` Injection Extension

Package root: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`
pi-ai location (nested dep, not top-level): `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai`

All claims below VERIFIED against the installed dist `.d.ts` / `.js`. Every reference is `path:line`.

---

## 1. InputEvent contract — **VERIFIED**

**File:** `dist/core/extensions/types.d.ts`

`InputSource` union (line ~505):
```ts
export type InputSource = "interactive" | "rpc" | "extension";
```

`InputEvent` interface (exact, types.d.ts ~507-519):
```ts
/** Fired when user input is received, before agent processing */
export interface InputEvent {
    type: "input";
    /** The input text */
    text: string;
    /** Attached images, if any */
    images?: ImageContent[];
    /** Where the input came from */
    source: InputSource;
    /** How the input will be delivered during streaming, or undefined when idle */
    streamingBehavior?: "steer" | "followUp";
}
```

`InputEventResult` union (exact, types.d.ts ~521-529):
```ts
export type InputEventResult = {
    action: "continue";
} | {
    action: "transform";
    text: string;
    images?: ImageContent[];
} | {
    action: "handled";
};
```

All four `InputEvent` fields (`text`, `images?`, `source`, `streamingBehavior?`) and all three `InputEventResult` shapes (`continue`, `transform` with `text`/`images?`, `handled`) match the PRD claims exactly.

For a `#@file` injector, the relevant handler return is:
```ts
return { action: "transform", text: expandedText, images: injectedImages };
```
`transform` replaces the user's text (and optionally images). `handled` would consume the message entirely (no turn). `continue` is a no-op pass-through.

---

## 2. resizeImage — **VERIFIED**

**Exported from main entry:** Yes.
- `dist/index.d.ts:31` → `export { formatDimensionNote, type ResizedImage, resizeImage } from "./utils/image-resize.ts";`
- `dist/index.js:44` → `export { formatDimensionNote, resizeImage } from "./utils/image-resize.js";`

**Signature** (`dist/utils/image-resize.d.ts:11`):
```ts
export declare function resizeImage(
  inputBytes: Uint8Array,
  mimeType: string,
  options?: ImageResizeOptions
): Promise<ResizedImage | null>;
```
Param name is `inputBytes` (not `bytes`), but the type/arity matches the claim exactly.

**`ResizedImage` interface** (`dist/utils/image-resize-core.d.ts:6-14`):
```ts
export interface ResizedImage {
    data: string;
    mimeType: string;
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    wasResized: boolean;
}
```

**`ImageResizeOptions` interface** (`dist/utils/image-resize-core.d.ts:1-5`):
```ts
export interface ImageResizeOptions {
    maxWidth?: number;
    maxHeight?: number;
    maxBytes?: number;
    jpegQuality?: number;
}
```

**Default dimensions = 2000×2000 — VERIFIED.**
`dist/utils/image-resize-core.js:4-8`:
```js
const DEFAULT_MAX_BYTES = 4.5 * 1024 * 1024;
const DEFAULT_OPTIONS = {
    maxWidth: 2000,
    maxHeight: 2000,
    maxBytes: DEFAULT_MAX_BYTES,
```
So calling `resizeImage(bytes, mime)` with no options uses 2000×2000 and ~4.5 MB maxBytes. These defaults merge with caller options: `const opts = { ...DEFAULT_OPTIONS, ...options };` (`image-resize-core.js:33`).

**Note:** `resizeImage` is async and spawns a Worker thread (Photon WASM); falls back to in-process (`resizeImageInProcess`) if the worker fails. Returns `null` if the image cannot be brought under `maxBytes`. The returned `data` is **plain base64** (`Buffer.from(buffer).toString("base64")`, `image-resize-core.js:12,51`) — no `data:` URL prefix, ready to drop straight into `ImageContent.data`.

---

## 3. formatDimensionNote — **VERIFIED**

**Exported from main entry:** Yes (same export line as `resizeImage`, `dist/index.d.ts:31`).

**Signature** (`dist/utils/image-resize.d.ts:18`):
```ts
export declare function formatDimensionNote(result: ResizedImage): string | undefined;
```

**Implementation** (`dist/utils/image-resize.js:80-87`) — returns `undefined` when not resized, otherwise a coordinate-mapping hint string:
```js
export function formatDimensionNote(result) {
    if (!result.wasResized) {
        return undefined;
    }
    const scale = result.originalWidth / result.width;
    return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
```
Signature matches `(resized: ResizedImage) => string | undefined` exactly.

---

## 4. ImageContent type — **VERIFIED** (in `@earendil-works/pi-ai`)

**File:** `node_modules/@earendil-works/pi-ai/dist/types.d.ts:239-243`
```ts
export interface ImageContent {
    type: "image";
    data: string;
    mimeType: string;
}
```

**base64, no `data:` URL prefix — VERIFIED.** The pi-coding-agent `read` tool produces this exact shape from resized output:
- `dist/core/tools/read.js:183` → `{ type: "image", data: processed.data, mimeType: processed.mimeType }`
- `processed.data` originates from `Buffer.from(buffer).toString("base64")` (`image-resize-core.js:12`).

So the claim holds: `{type:'image', data:<base64 string>, mimeType:<mime>}` with raw base64, no `data:` prefix. Re-exports of `ImageContent` flow into `pi-coding-agent` via `types.d.ts:2` (`import type { ... ImageContent ... } from "@earendil-works/pi-ai";`) and are re-exported in the main index alongside the extension types.

---

## 5. ExtensionAPI / `pi.on('input', handler)` — **VERIFIED**

**File:** `dist/core/extensions/types.d.ts`

**`on('input', ...)` registration** (types.d.ts, ExtensionAPI block):
```ts
on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
```

**Handler type** (types.d.ts):
```ts
export type ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;
```
So the handler receives `(event: InputEvent, ctx: ExtensionContext)` and returns `InputEventResult | void | Promise<...>`.

**`ctx` is `ExtensionContext`** (types.d.ts, interface ExtensionContext) — contains exactly what the PRD claims:
```ts
export interface ExtensionContext {
    ui: ExtensionUIContext;
    mode: ExtensionMode;          // "tui" | "rpc" | "json" | "print"
    hasUI: boolean;               // true in TUI and RPC modes
    cwd: string;                  // current working directory
    sessionManager: ReadonlySessionManager;
    modelRegistry: ModelRegistry;
    model: Model<any> | undefined;
    isIdle(): boolean;
    isProjectTrusted(): boolean;
    signal: AbortSignal | undefined;
    abort(): void;
    hasPendingMessages(): boolean;
    shutdown(): void;
    getContextUsage(): ContextUsage | undefined;
    compact(options?: CompactOptions): void;
    getSystemPrompt(): string;
}
```

- `ctx.cwd` — VERIFIED (string).
- `ctx.hasUI` — VERIFIED (boolean).
- `ctx.ui.notify(...)` — VERIFIED via `ExtensionUIContext.notify`:
```ts
notify(message: string, type?: "info" | "warning" | "error"): void;
```
Note: the PRD's `ui.notify(msg, level)` is accurate, but the 2nd arg is `type` (not `level`) and constrained to `"info" | "warning" | "error"`. The `ui` object is the full `ExtensionUIContext` (also has `select`, `confirm`, `input`, `setStatus`, `setWidget`, `theme`, etc.) — rich enough for diagnostics.

---

## 6. getLanguageFromPath — **VERIFIED**

**Exported from main entry:** Yes.
- `dist/index.d.ts:28` → `export { getLanguageFromPath, getMarkdownTheme, getSelectListTheme, getSettingsListTheme, highlightCode, initTheme, Theme, type ThemeColor, } from "./modes/interactive/theme/theme.ts";`
- `dist/index.js:39` (runtime) → re-exports it as well.

**Signature** (`dist/modes/interactive/theme/theme.d.ts:114`):
```ts
export declare function getLanguageFromPath(filePath: string): string | undefined;
```
Implementation at `dist/modes/interactive/theme/theme.js:934`. Returns the language identifier for syntax highlighting, or `undefined` if unrecognized. Safe to use for an optional syntax hint on injected file content.

---

## Summary Table

| # | Claim | Status | Primary evidence |
|---|-------|--------|------------------|
| 1 | `InputEvent` / `InputEventResult` | **VERIFIED** | `dist/core/extensions/types.d.ts` (~505-529) |
| 2 | `resizeImage` exported + signature + defaults 2000×2000 | **VERIFIED** | `dist/index.d.ts:31`; `dist/utils/image-resize.d.ts:11`; `dist/utils/image-resize-core.js:4-8` |
| 3 | `formatDimensionNote` exported + signature | **VERIFIED** | `dist/index.d.ts:31`; `dist/utils/image-resize.d.ts:18` |
| 4 | `ImageContent` `{type,data,mimeType}` base64 no-prefix | **VERIFIED** | `node_modules/@earendil-works/pi-ai/dist/types.d.ts:239-243`; `read.js:183`; `image-resize-core.js:12` |
| 5 | `pi.on('input', (event, ctx))`, ctx has cwd/hasUI/ui.notify | **VERIFIED** | `dist/core/extensions/types.d.ts` (ExtensionAPI + ExtensionContext + ExtensionUIContext) |
| 6 | `getLanguageFromPath` exported | **VERIFIED** | `dist/index.d.ts:28`; `theme.d.ts:114` |

**All 6 claims VERIFIED. No discrepancies found.** Two minor naming notes (non-blocking):
- `resizeImage` first param is named `inputBytes` (type is `Uint8Array` as claimed).
- `ui.notify`'s second arg is named `type` (not `level`), constrained to `"info" | "warning" | "error"`.

**Recommended integration pattern for the `#@file` injector:**
```ts
import {
  type ExtensionFactory, resizeImage, formatDimensionNote,
} from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

const factory: ExtensionFactory = (pi) => {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;       // avoid recursion
    const { text, images } = await expandFileTokens(event.text, ctx.cwd);
    return { action: "transform", text, images };
  });
};
```
Where `expandFileTokens` reads image files via `resizeImage(buf, mime)` and emits `ImageContent[]` (`{ type: "image", data: res.data, mimeType: res.mimeType }`), and may append `formatDimensionNote(res)` as a text note.
