# Pi Extension API Verification

Package verified: `@earendil-works/pi-coding-agent` at
`/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/`
(Types live under `dist/`; the `Model` type is re-exported from the bundled
`@earendil-works/pi-ai` at `node_modules/@earendil-works/pi-ai/dist/types.d.ts`).

All 9 claims below were checked by reading the actual `.d.ts` declarations. All
9 are **VERIFIED**.

---

## 1. ContextUsage type — VERIFIED

File: `dist/core/extensions/types.d.ts` (lines ~273-282)

```ts
export interface ContextUsage {
    /** Estimated context tokens, or null if unknown (e.g. right after compaction, before next LLM response). */
    tokens: number | null;
    contextWindow: number;
    /** Context usage as percentage of context window, or null if tokens is unknown. */
    percent: number | null;
}
```

Shape is exactly `{ tokens: number | null; contextWindow: number; percent: number | null }`.

---

## 2. getContextUsage() return type — VERIFIED

File: `dist/core/extensions/types.d.ts` (in `ExtensionContext`)

```ts
/** Get current context usage for the active model. */
getContextUsage(): ContextUsage | undefined;
```

Return type is **`ContextUsage | undefined`** — note the `| undefined`. It is
`undefined` when the active model/context is unknown (e.g. before the first
LLM response). Any caller MUST null-check the whole result before reading
`.tokens` / `.percent` (which can themselves also be `null`).

---

## 3. ctx.model shape (contextWindow / maxTokens) — VERIFIED

File: `dist/core/extensions/types.d.ts` (in `ExtensionContext`)

```ts
/** Current model (may be undefined) */
model: Model<any> | undefined;
```

`Model<TApi>` is imported from `@earendil-works/pi-ai`. Source of truth:

File: `node_modules/@earendil-works/pi-ai/dist/types.d.ts` (lines 600-618)

```ts
export interface Model<TApi extends Api> {
    id: string;
    name: string;
    api: TApi;
    provider: ProviderId;
    baseUrl: string;
    reasoning: boolean;
    thinkingLevelMap?: ThinkingLevelMap;
    input: ("text" | "image")[];
    cost: ModelCost;
    contextWindow: number;   // <-- required number
    maxTokens: number;       // <-- required number
    headers?: Record<string, string>;
    compat?: ...;
}
```

Both `contextWindow` and `maxTokens` are **required `number`** fields on every
model. Callers must still guard `ctx.model` itself for `undefined`.

---

## 4. Full ExtensionContext interface — VERIFIED (and more fields than the spec listed)

File: `dist/core/extensions/types.d.ts` (`ExtensionContext`)

The spec listed `cwd, model, getContextUsage, hasUI, ui, modelRegistry`. Those
are all present, but the real interface has additional members. Full list:

```ts
export type ExtensionMode = "tui" | "rpc" | "json" | "print";

export interface ExtensionContext {
    ui: ExtensionUIContext;
    mode: ExtensionMode;
    hasUI: boolean;
    cwd: string;
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

Extension command handlers receive the extended `ExtensionCommandContext`
(which adds `getSystemPromptOptions`, `waitForIdle`, `newSession`, `fork`,
`navigateTree`, `switchSession`, `reload`).

---

## 5. ctx.ui.notify signature — VERIFIED

File: `dist/core/extensions/types.d.ts` (in `ExtensionUIContext`)

```ts
/** Show a notification to the user. */
notify(message: string, type?: "info" | "warning" | "error"): void;
```

`message` is required `string`; `type` is optional, restricted to
`"info" | "warning" | "error"` (defaults to info at the call site). Returns
`void`. Note: notifications are fire-and-forget; in non-TUI modes they may be
no-ops or logged, depending on mode.

---

## 6. read tool DEFAULT_MAX_LINES == 2000 — VERIFIED

File: `dist/core/tools/truncate.d.ts` (lines 1-13)

```ts
export declare const DEFAULT_MAX_LINES = 2000;
export declare const DEFAULT_MAX_BYTES: number;
export declare const GREP_MAX_LINE_LENGTH = 500;
```

`DEFAULT_MAX_LINES` is a literal `2000` (numeric literal type). It is
re-exported through `dist/core/tools/index.d.ts` and again from the package
root `dist/index.d.ts`:

```ts
export { ... DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, ... } from "./core/tools/index.ts";
```

Note the dual truncation rule from the same file: outputs are truncated at
whichever is hit first of `DEFAULT_MAX_LINES` (2000) or `DEFAULT_MAX_BYTES`
(50KB). `TruncationOptions` allows callers to override both per-call.

---

## 7. estimateTokens — exported, takes AgentMessage (not string) — VERIFIED

Exported from the package root (`dist/index.d.ts`):

```ts
export { ... estimateTokens, ... } from "./core/compaction/index.ts";
```

Declaration in `dist/core/compaction/compaction.d.ts` (line 59):

```ts
export declare function estimateTokens(message: AgentMessage): number;
```

Signature is **`(message: AgentMessage) => number`** — it takes a single
`AgentMessage` (not a string, not an array). Implementation at
`dist/core/compaction/compaction.js:165`. Callers needing the token count for
multiple messages must sum `estimateTokens(m)` per message; session entries
should first be converted via `sessionEntryToContextMessages(entry)` (see
`compaction.js:295` for the pattern).

---

## 8. resizeImage, formatDimensionNote, ResizedImage — exported from main package — VERIFIED

Exported from the package root (`dist/index.d.ts`):

```ts
export { formatDimensionNote, type ResizedImage, resizeImage } from "./utils/image-resize.ts";
```

Signatures (`dist/utils/image-resize.d.ts`):

```ts
export declare function resizeImage(
    inputBytes: Uint8Array,
    mimeType: string,
    options?: ImageResizeOptions
): Promise<ResizedImage | null>;

export declare function formatDimensionNote(result: ResizedImage): string | undefined;
```

`ImageResizeOptions` and `ResizedImage` are both re-exported from
`./utils/image-resize-core.ts`. Exact `ResizedImage` type
(`dist/utils/image-resize-core.d.ts`):

```ts
export interface ResizedImage {
    data: string;          // base64-encoded image bytes
    mimeType: string;
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    wasResized: boolean;
}
```

`ImageResizeOptions`:
```ts
export interface ImageResizeOptions {
    maxWidth?: number;
    maxHeight?: number;
    maxBytes?: number;
    jpegQuality?: number;
}
```

Notes for callers:
- `resizeImage` runs Photon (Rust/WASM) in a worker thread and falls back to
  in-process resizing if the worker cannot load. It returns `null` if the
  image cannot be resized under `maxBytes`.
- `formatDimensionNote` returns `string | undefined`.

---

## 9. InputEvent and InputEventResult types — VERIFIED

File: `dist/core/extensions/types.d.ts`

```ts
export type InputSource = "interactive" | "rpc" | "extension";

export interface InputEvent {
    type: "input";
    text: string;
    images?: ImageContent[];
    source: InputSource;
    streamingBehavior?: "steer" | "followUp";
}

export type InputEventResult =
    | { action: "continue"; }
    | { action: "transform"; text: string; images?: ImageContent[]; }
    | { action: "handled"; };
```

Handler registration (in `ExtensionAPI`):
```ts
on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
```

`InputEvent` is fired when user input is received, before agent processing.
`streamingBehavior` is present only when the input arrives while the agent is
streaming (`"steer" | "followUp"`); it is `undefined` when idle. A handler can
return `{ action: "transform", text, images? }` to rewrite the input,
`{ action: "handled" }` to swallow it, or `{ action: "continue" }` to pass it
through unchanged.

---

## Summary

| # | Claim | Result | Source |
|---|-------|--------|--------|
| 1 | `ContextUsage = { tokens: number\|null; contextWindow: number; percent: number\|null }` | **VERIFIED** | `dist/core/extensions/types.d.ts:273` |
| 2 | `getContextUsage()` return type | **VERIFIED** — `ContextUsage \| undefined` | `dist/core/extensions/types.d.ts` (ExtensionContext) |
| 3 | `ctx.model` exposes `contextWindow` & `maxTokens` numbers | **VERIFIED** | `node_modules/@earendil-works/pi-ai/dist/types.d.ts:614-615` |
| 4 | Full `ExtensionContext` interface | **VERIFIED** (spec fields present, plus more) | `dist/core/extensions/types.d.ts` |
| 5 | `ctx.ui.notify` signature | **VERIFIED** | `dist/core/extensions/types.d.ts` (ExtensionUIContext) |
| 6 | `DEFAULT_MAX_LINES === 2000` | **VERIFIED** | `dist/core/tools/truncate.d.ts:10` |
| 7 | `estimateTokens` exported, takes `AgentMessage` | **VERIFIED** | `dist/core/compaction/compaction.d.ts:59` |
| 8 | `resizeImage`/`formatDimensionNote`/`ResizedImage` exported | **VERIFIED** | `dist/utils/image-resize.d.ts`, `dist/utils/image-resize-core.d.ts` |
| 9 | `InputEvent` / `InputEventResult` types | **VERIFIED** | `dist/core/extensions/types.d.ts` |

### Implementation notes for the paged-file-delivery feature

- `getContextUsage()` and `ctx.model` can each be `undefined`; always guard
  both. `ContextUsage.tokens`/`.percent` can be `null` (e.g. right after
  compaction, before the next LLM response) even when the wrapper object is
  present.
- The read tool truncates at `DEFAULT_MAX_LINES` (2000) OR `DEFAULT_MAX_BYTES`
  (50KB), whichever comes first; both are overridable per-call via
  `TruncationOptions`. A paged-delivery design should account for the byte
  limit too, not just line count.
- `estimateTokens(message: AgentMessage): number` is per-message — sum across
  the conversation; use `sessionEntryToContextMessages(entry)` to convert
  session entries to `AgentMessage[]` first.
