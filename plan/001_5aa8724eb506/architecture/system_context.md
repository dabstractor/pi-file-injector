# System Context: `#@file` Whole-File Injection Extension

## Executive Summary

The PRD describes a **single-file TypeScript extension** (~150–220 lines) for Pi (`@earendil-works/pi-coding-agent` v0.80.7). It hooks the `input` event to unconditionally inject entire file contents into the model's prompt when the user writes `#@<path>`.

**All 6 API claims in the PRD have been VERIFIED against the installed package.** The PRD is accurate and feasible. See `api_verification.md` for line-by-line evidence.

---

## Verified API Surface (exported from `@earendil-works/pi-coding-agent`)

| API | Exported? | Location | Signature |
|---|---|---|---|
| `resizeImage` | ✅ | `dist/index.d.ts:31` → `dist/utils/image-resize.d.ts:11` | `(inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions) => Promise<ResizedImage \| null>` |
| `formatDimensionNote` | ✅ | `dist/index.d.ts:31` → `dist/utils/image-resize.d.ts:18` | `(result: ResizedImage) => string \| undefined` |
| `getLanguageFromPath` | ✅ | `dist/index.d.ts:28` | `(filePath: string) => string \| undefined` (optional, not needed for v1) |
| `ImageContent` (type) | ✅ via `@earendil-works/pi-ai` | `pi-ai/dist/types.d.ts:239-243` | `{ type: "image"; data: string; mimeType: string }` — data is raw base64, **no `data:` prefix** |

### Input Event Contract (`dist/core/extensions/types.d.ts:505-529`)

```ts
interface InputEvent {
  type: "input";
  text: string;
  images?: ImageContent[];
  source: "interactive" | "rpc" | "extension";
  streamingBehavior?: "steer" | "followUp";
}

type InputEventResult =
  | { action: "continue" }                                    // pass through
  | { action: "transform"; text: string; images?: ImageContent[] }  // rewrite
  | { action: "handled" };                                     // consume entirely
```

### ExtensionContext (`ctx`)

Handler receives `(event: InputEvent, ctx: ExtensionContext)`. Key fields:
- `ctx.cwd: string` — working directory for path resolution.
- `ctx.hasUI: boolean` — true in TUI and RPC modes (guard `ctx.ui.notify`).
- `ctx.ui.notify(message: string, type?: "info" | "warning" | "error"): void`.

### resizeImage defaults

Calling `resizeImage(bytes, mime)` with no options: **2000×2000** max dimensions, **4.5 MB** maxBytes. Returns `null` if it can't bring the image under `maxBytes`. Output `data` is plain base64 via `Buffer.from(buffer).toString("base64")` — no `data:` URL prefix.

---

## Canonical Reference Pattern: `inline-bash.ts`

**File:** `examples/extensions/inline-bash.ts` — the exact structural template to mirror.

Key structural elements:
1. `export default function (pi: ExtensionAPI) { pi.on("input", async (event, ctx) => {...}) }`
2. Cheap pre-check (`if (!PATTERN.test(text)) return { action: "continue" }`)
3. Global regex: reset `lastIndex = 0` after `test()`, collect matches with `exec()` loop **before** mutating
4. Per-match `try/catch` — never throw out of handler
5. Forward/merge `images` explicitly: `return { action: "transform", text: result, images: event.images }`
6. Guard UI feedback: `if (ctx.hasUI) ctx.ui.notify(...)`

---

## Input Event Dispatch Internals (`dist/core/extensions/runner.js:882-920`)

Handlers chain **in load order**. Each receives the *current* (possibly already-transformed) text/images:
- `transform` with `images` omitted → **keeps prior images**.
- `transform` with `images` present → **replaces** the array. Must return `[...originals, ...newImages]` to merge.
- `handled` → short-circuits the entire chain.
- Per-handler errors are **swallowed** (logged via `emitError`), chain continues. So the extension should still aim to never throw and surface failures via `ctx.ui.notify`.

### Critical: Image Array Merging

When `#@` injects an image, the returned `images` MUST be `[...(event.images ?? []), newImage]`. Returning only `[newImage]` would **replace** any user-attached images. The PRD pseudocode seeds `images = [...imagesIn]` correctly.

---

## Format Parity with `processFileArguments` (`dist/cli/file-processor.js`)

The built-in CLI `@file` handler. Exact `<file>` block templates:

| Type | Template |
|---|---|
| **Text** | `<file name="${absolutePath}">\n${content}\n</file>\n` |
| **Image** | `<file name="${absolutePath}">${hints.join("\n")}</file>\n` + push `ImageContent` |
| **Binary** | ⚠️ No guard — falls through to text path (reads UTF-8 garbage) |
| **Empty** | ⚠️ Skipped entirely (`if (stats.size === 0) continue`) |
| **Missing** | ⚠️ `process.exit(1)` |

### Deliberate Divergences (`#@` improves on processFileArguments)

| Case | processFileArguments | `#@file` (PRD design) |
|---|---|---|
| Binary (non-image) | UTF-8 garbage | NUL-byte guard → clear note block |
| Empty file (0 bytes) | Skipped | Injected as `<file name="…">\n\n</file>` |
| Missing file | Hard `process.exit(1)` | Token left verbatim, no error |

Format parity applies to the **block format** (`<file name="ABS">\n...`) for text and image cases — NOT to edge-case behavior.

---

## Extension Loading Mechanism

- **Discovery:** `~/.pi/agent/extensions/*.ts` (global) and `.pi/extensions/*.ts` (project-local), loaded by `dist/core/extensions/loader.js`.
- **Explicit:** `-e ./path.ts` flag, repeatable.
- **Compilation:** `jiti` transpiles TypeScript on the fly. **No tsconfig, no build step needed.** Bare `.ts` files load directly.
- **Reload:** `/reload` command invalidates the cache.
- **Default export:** must be a function `(pi: ExtensionAPI) => void`.

---

## `github-issue-autocomplete.ts` — Coexistence Verification

**Not an `input`-event extension** — it registers an autocomplete provider via `ctx.ui.addAutocompleteProvider` on `session_start`.

Its token regex `(?:^|[ \t])#([^\s#]*)$/` **does** capture `#@` tokens syntactically, but:
- It operates in the **autocomplete popup layer**, not the input transformation layer.
- When `#@...` yields no matching GitHub issues, it falls back to the file-completion provider.
- **No hard conflict.** The only effect: the autocomplete popup might briefly offer issues while typing `#@`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Infinite loop (extension re-feeds `#@` text) | `if (event.source === "extension") return { action: "continue" }` — MANDATORY guard |
| Steering latency | `if (event.streamingBehavior === "steer") return { action: "continue" }` — skip mid-stream |
| Handler throws (permissions, read error) | Wrap all `stat`/`readFile`/`resizeImage` in try/catch; leave token verbatim |
| Image array replacement bug | Return `[...event.images ?? [], newImage]`, not `[newImage]` |
| Global regex `lastIndex` stale | Reset `FILE_INJECT_RE.lastIndex = 0` or use `String.matchAll()` |
| Large file context blow-up | **Accepted by design** (PRD §13). Document, don't gate. |

---

## Implementation File: `file-injector.ts`

- **Global path:** `~/.pi/agent/extensions/file-injector.ts`
- **Project-local path:** `.pi/extensions/file-injector.ts`
- **Target size:** ~150–220 lines, single file, zero dependencies beyond Pi's exports + Node builtins.

### Internal Structure (PRD §8)
1. Imports (§7)
2. Constants: `FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT`
3. Pure helpers: `expandTildeAndResolve`, `cleanToken`, `isBinary`, `extOf`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`
4. Core: `async function injectFiles(text, imagesIn, ctx): Promise<{ text, images, injected }>`
5. Factory: `export default function (pi: ExtensionAPI) { pi.on("input", ...) }`
