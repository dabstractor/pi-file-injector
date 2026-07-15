# External Dependencies & Verified API Reference

## Package: `@earendil-works/pi-coding-agent` (v0.80.7)

**Installed at:** `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`

All exports verified against `dist/index.d.ts` and runtime `dist/index.js`.

---

## Exported Functions Used by This Extension

### `resizeImage`

```ts
// dist/utils/image-resize.d.ts:11
export declare function resizeImage(
  inputBytes: Uint8Array,    // NOTE: param name is 'inputBytes', not 'bytes'
  mimeType: string,
  options?: ImageResizeOptions
): Promise<ResizedImage | null>;
```

**Default behavior** (no options): caps to **2000×2000**, maxBytes **4.5 MB**.
Returns `null` if the image cannot be brought under `maxBytes`.
Output `data` is **plain base64** — `Buffer.from(buffer).toString("base64")`.

```ts
// dist/utils/image-resize-core.d.ts:1-14
interface ImageResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  jpegQuality?: number;
}

interface ResizedImage {
  data: string;          // base64
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  wasResized: boolean;
}
```

**Implementation note:** Spawns a Worker thread (Photon WASM); falls back to in-process if worker fails.

### `formatDimensionNote`

```ts
// dist/utils/image-resize.d.ts:18
export declare function formatDimensionNote(result: ResizedImage): string | undefined;
```

Returns `undefined` if `!result.wasResized`. Otherwise returns a coordinate-mapping hint:
`[Image: original WxH, displayed at wxh. Multiply coordinates by S.SS to map to original image.]`

### `getLanguageFromPath` (optional, not needed for v1)

```ts
// dist/modes/interactive/theme/theme.d.ts:114
export declare function getLanguageFromPath(filePath: string): string | undefined;
```

## Package: `@earendil-works/pi-ai`

**Installed at:** `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai`

### `ImageContent` (type)

```ts
// pi-ai/dist/types.d.ts:239-243
export interface ImageContent {
  type: "image";
  data: string;       // base64, NO "data:" URL prefix
  mimeType: string;
}
```

---

## Node.js Builtins Used

```ts
import { promises as fs } from "node:fs";   // fs.stat, fs.readFile
import * as path from "node:path";            // path.resolve, path.join, path.basename
import * as os from "node:os";                // os.homedir()
```

No other dependencies. The extension is dependency-free (Pi aliases its own packages for extension imports via `jiti`).

---

## Import Pattern (verified working — mirrors `inline-bash.ts`)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

**Pi virtualizes/aliases** its packages so extensions can import from `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` without a local `package.json` or `node_modules`. The `jiti` loader handles this at import time.
