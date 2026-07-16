# External Dependencies — Delta 003 (Markdown Imports)

**Conclusion: NO new external dependencies, NO new Pi API surface.** This delta is implemented entirely with already-imported Node builtins + already-verified Pi exports. Full API verification lives in `plan/002_0ac3eb160af7/architecture/pi_api_verification.md` (all 9 claims VERIFIED against installed `@earendil-works/pi-coding-agent` v0.80.7). This file records only the delta-relevant facts a downstream PRP agent needs.

---

## 1. Imports already present in `file-injector.ts` (L1–6) — sufficient for the whole delta

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

| Delta need | Satisfied by | Note |
|---|---|---|
| Reading imported markdown (and the files they import) | `node:fs` `promises` (`fs.stat`, `fs.readFile`) | already used for top-level files |
| Resolving relative-to-markdown-dir paths | `node:path` (`path.resolve`, `path.dirname`) | `expandTildeAndResolve(token, baseDir)` already takes a `baseDir` arg |
| Image token estimate | `ResizedImage.width` / `.height` (both **required `number`**) | VERIFIED present (pi_api_verification §8) |
| Detecting `#@` inside markdown | reuse existing `FILE_INJECT_RE` | PRD §4.2: same regex for prompts and markdown |

## 2. Pi API facts the delta relies on (re-confirmed; see plan/002 for `.d.ts` line evidence)

- **`ResizedImage`** (`dist/utils/image-resize-core.d.ts`): `{ data: string (base64); mimeType: string; originalWidth; originalHeight; width: number; height: number; wasResized: boolean }`. `resizeImage(bytes, mime)` (no options) caps to **2000×2000**; returns `null` if it can't process. `width`/`height` feed `estimateImageTokens` (§5.6.2).
- **`ImageContent`** (`@earendil-works/pi-ai`): `{ type: "image"; data: string (base64, NO `data:` prefix); mimeType: string }`. Unchanged usage.
- **`ContextUsage`**: `{ tokens: number|null; contextWindow: number; percent: number|null }`. **`getContextUsage(): ContextUsage | undefined`** — must null-check the whole result AND `.tokens`. The existing budget code already maps `undefined`/`null` → `remaining=null` → inject-whole (O-1). This delta only *shares* `remaining` across recursion and adds image/binary costs.
- **`ctx.model`**: `Model<any> | undefined`; `Model` has `contextWindow: number` and `maxTokens: number` (both required). Used only for `maxTokens` (the reserve). `usage.contextWindow` is the window source (O-2).
- **`read` tool `DEFAULT_MAX_LINES === 2000`** — already pinned as `READ_LIMIT`, emitted in the paged directive. Unchanged.
- **`input` event contract** (`dist/core/extensions/types.d.ts`): handler `(event, ctx) => { action:"continue" } | { action:"transform"; text; images? } | { action:"handled" }`. `event = { type:"input"; text; images?; source:"interactive"|"rpc"|"extension"; streamingBehavior?:"steer"|"followUp" }`. Unchanged.

## 3. Explicitly NOT used / NOT needed

- **No markdown parser dependency.** Code-region detection is approximate-CommonMark via two regexes (`FENCE_OPEN_RE`, `INLINE_CODE_RE`) implemented inline (PRD §5.6.1). A full CommonMark parser is out of scope (failure modes are benign: verbatim token left or an unexpected import; never data corruption).
- **No string-based token estimator.** `estimateTokens` takes an `AgentMessage`, not a string (VERIFIED §7) → use the `Math.ceil(content.length / 4)` heuristic already in use.
- **No new config surface.** PRD §2.3 / §13.4: zero user-facing config. `MD_EXTS`, `IMAGE_FALLBACK_TOKENS`, `PAGED_THRESHOLD`, etc. are hardcoded module constants.
- **No changes to `package.json`.** Single-file extension; `"pi": { "extensions": ["file-injector.ts"] }` unchanged; no new `dependencies`/`devDependencies`.
- **`DEFAULT_WINDOW = 200000`** (L43) is a dead leftover; leave it untouched (out of scope).
