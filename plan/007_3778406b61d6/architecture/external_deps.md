# External Dependencies & Verified APIs

## No new dependencies for session 007

This delta introduces zero new dependencies. The implementation is complete and all APIs were
verified in prior sessions. This file documents the stable API surface for reference.

## Pi exported APIs used (from `@earendil-works/pi-coding-agent`)

| API | Signature | Usage |
|---|---|---|
| `resizeImage` | `(bytes: Uint8Array, mime: string, opts?) => Promise<ResizedImage \| null>` | Image downscale to 2000×2000 |
| `formatDimensionNote` | `(resized: ResizedImage) => string \| undefined` | Image dimension hint text |
| `CONFIG_DIR_NAME` | `string` (`.pi`) | Project-local config path |
| `getAgentDir` | `() => string` (`~/.pi/agent`) | Global config path |

## Pi event contract

```ts
pi.on("input", async (event, ctx) => {
  // event: { type, text, images?, source, streamingBehavior? }
  // return: { action: "continue" } | { action: "transform", text, images? } | { action: "handled" }
});

pi.on("session_start", async (event, ctx) => {
  // ctx: { cwd, isProjectTrusted(), getContextUsage?(), model?, hasUI, ui: { notify, addAutocompleteProvider } }
});
```

## ImageContent (from `@earendil-works/pi-ai`)

```ts
interface ImageContent { type: "image"; data: string; mimeType: string }
// data is base64 (no data: URL prefix)
```

## Node.js builtins

- `fs/promises` — `stat`, `readFile`, `access` (R_OK readability check)
- `path` — `resolve`, `dirname`, `basename`, `extname`, `join`
- `os` — `homedir()` (tilde expansion)

## Re-implemented internals (NOT imported from dist/)

- `processImage` → replaced by `resizeImage` (exported)
- `detectSupportedImageMimeTypeFromFile` → inline MIME table (`MIME_BY_EXT`) + magic-number sniff
  (`hasValidImageMagic`)
- `resolveReadPath` → inline tilde expansion via `os.homedir()` (`expandTildeAndResolve`)
