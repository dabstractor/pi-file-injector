# PRD: Auto-Reader Extension for Pi

**Status:** Draft · **Target:** Pi `@earendil-works/pi-coding-agent` (tested against v0.80.7) · **Artifact type:** Pi TypeScript extension

---

## 1. Overview

### Problem
In Claude Code, typing `@filename.txt` in the prompt **immediately reads the file into the model's context**. In Pi, an `@path` mention is passed through as **literal text** — the agent must then decide to call the `read` tool (possibly in chunks) to actually see the file contents. For small files this wastes a round-trip and a tool call.

### Solution
A Pi extension that intercepts user input, finds `@<path>` mentions that resolve to **small** files, reads those files inline, and injects their contents directly into the prompt text and/or image attachments **before** the prompt reaches the agent. The agent then already has the content and never needs to call `read`.

### Tagline
> "Instant inline file context for small `@mentions` — text by default, images opt-in."

---

## 2. Goals & Non-Goals

### Goals
1. **Text files (default ON):** When a user types `@path/to/file.ext` and the file exists and is text-like and under the configured size limit, read its contents and inject them into the prompt automatically.
2. **Images (default OFF, configurable):** Optionally do the same for image files, attaching them as image content blocks (mirroring how the built-in `read` tool attaches images).
3. **Configurable size limit:** The threshold is user-configurable (default ~1000 words).
4. **Zero extra tool calls:** For matched small files, the agent receives the content with no `read` tool call required.
5. **Safe & non-destructive:** Large files, missing files, binary files, and non-`@` text are left untouched. If anything fails, the original prompt is preserved verbatim.

### Non-Goals (v1)
- **No globbing / multiple-file expansion** (`@src/*.ts`). Only concrete single-file paths.
- **No directory reads.** A `@` mention of a directory is ignored.
- **No automatic recursive inclusion** of referenced files within read files.
- **No re-reading on file change.** Content is snapshotted at prompt-submission time.
- **No custom TUI "chip" rendering** like Claude Code's attachment UI. (See §11 Future Enhancements.)
- **No replacement of the built-in `read` tool.** The `read` tool remains the fallback for large files.

---

## 3. Background: How Pi Handles Input (must-read for implementer)

Pi extensions are TypeScript modules exporting a default factory function `(pi: ExtensionAPI) => void`. The correct hook for this feature is the **`input` event**, which fires when the user submits a prompt, *before* skill/template expansion and *before* agent processing.

```ts
pi.on("input", async (event, ctx) => {
  // event.text            -> raw user prompt (contains literal "@path" text)
  // event.images          -> ImageContent[] already attached (e.g. via paste)
  // event.source          -> "interactive" | "rpc" | "extension"
  // event.streamingBehavior -> undefined | "steer" | "followUp"

  // To rewrite the prompt + images:
  return { action: "transform", text: newText, images: newImages };
  // To pass through unchanged:
  return { action: "continue" };
});
```

A `transform` **replaces** the user's submitted prompt text and image list. Whatever you return is stored in the session as the user message and sent to the model. This is exactly the mechanism the canonical example **`inline-bash.ts`** uses to expand `!{command}` patterns — **read it first and mirror its structure.**

> **Canonical reference example (copy this pattern):** `examples/extensions/inline-bash.ts` in the Pi package. It scans `event.text` for a regex, expands matches, and returns `{ action: "transform", text, images: event.images }`.

**Event ordering note:** The `input` event fires *after* extension commands (`/cmd`) are checked but *before* skill (`/skill:...`) and template expansion. This is exactly where we want to operate.

---

## 4. Configuration

### 4.1 Config file locations & precedence

The extension reads its own JSON config files (Pi has no shared "extension settings" registry; a dedicated file is the idiomatic approach). Resolution order, **later wins**:

1. `~/.pi/agent/auto-reader.json` — **global** (all projects)
2. `.pi/auto-reader.json` — **project-local** (overrides global)

Project config is **deep-merged** over global config. Use `CONFIG_DIR_NAME` (exported from the package) instead of hardcoding `.pi`, so the path works under rebranded distributions.

> **Trust:** Project-local config (`.pi/auto-reader.json`) must only be honored when the project is trusted. Guard with `ctx.isProjectTrusted()` when deciding whether to read the project file. The global file is always read.

Config is loaded **lazily on first use per session and cached in memory** (reload on `session_start`). Since the `input` handler is async, reading the small JSON config from disk once per session (cached) is fine.

### 4.2 Config schema

```jsonc
{
  // Maximum word count for a text file to be auto-read.
  // "Words" = tokens split on whitespace. Files at or below this count are inlined.
  "maxWords": 1000,

  // Hard byte safety net (optional). Even if under maxWords, a file larger than
  // this is skipped. Prevents pathological "one giant word" files (e.g. minified blobs).
  // Set to 0 or null to disable. Default 25600 (25KB).
  "maxBytes": 25600,

  // Text-file handling.
  "text": {
    "enabled": true,             // master switch for text auto-reading (default true)
    // Restrict to these extensions (no leading dot). null/undefined = all text files.
    "extensions": null,          // e.g. ["ts", "js", "md", "py", "json"]
    // Always skip these extensions even if otherwise eligible (no leading dot).
    "excludeExtensions": ["lock", "min", "map", "woff", "woff2", "ttf"]
  },

  // Image-file handling. DEFAULT OFF.
  "images": {
    "enabled": false,            // must be explicitly turned on
    "maxBytes": 5242880,         // skip source images larger than this (5MB)
    "resize": true,              // reuse Pi's resizeImage to cap size/bytes (default true)
    "extensions": ["png", "jpg", "jpeg", "gif", "webp", "bmp"]
  },

  // If true (default), keep the original "@path" mention in the prompt and
  // APPEND file contents below it. If false, REPLACE the "@path" mention inline
  // with the formatted contents.
  "preserveMention": true,

  // If true, when an eligible file is OVER the size limit, append a small
  // hint like "[@file.ts is large; use the read tool]". Default false (silent).
  "annotateOversized": false
}
```

### 4.3 Defaults summary

| Option | Default | Notes |
|---|---|---|
| `maxWords` | `1000` | Primary gate. |
| `maxBytes` | `25600` | Secondary guard. `0`/`null` disables. |
| `text.enabled` | `true` | Text auto-read on by default. |
| `text.extensions` | `null` | All text files. |
| `text.excludeExtensions` | `["lock","min","map","woff","woff2","ttf"]` | Skip binary-ish blobs. |
| `images.enabled` | **`false`** | Images off by default. |
| `images.maxBytes` | `5242880` | 5MB source cap. |
| `images.resize` | `true` | Cap to 2000×2000 via Pi's util. |
| `images.extensions` | `["png","jpg","jpeg","gif","webp","bmp"]` | Matches built-in `read`. |
| `preserveMention` | `true` | Append, don't replace. |
| `annotateOversized` | `false` | Silent on over-limit files. |

### 4.4 Example: enable images, raise the word limit

`~/.pi/agent/auto-reader.json`:
```json
{
  "maxWords": 2000,
  "images": { "enabled": true }
}
```

---

## 5. Detailed Design

### 5.1 High-level flow

```
user submits prompt
        │
        ▼
┌─────────────────────────────────────────────┐
│ input event handler (async)                  │
│  1. short-circuit checks (§5.2)              │
│  2. load+merge config (cached)               │
│  3. scan text for @mentions (§5.3)           │
│  4. for each candidate path:                 │
│        a. resolve + stat (§5.4)              │
│        b. text or image branch (§5.5 / §5.6) │
│  5. assemble new text + images               │
│  6. return transform (or continue if none)   │
└─────────────────────────────────────────────┘
        │
        ▼
prompt (with inlined content) → agent loop (no read tool needed for these files)
```

### 5.2 Short-circuit (early-exit) conditions

Return `{ action: "continue" }` **immediately** (do no work) when:

1. `event.source === "extension"` — **prevent infinite loops** (our own or other extensions' injected messages must not be re-expanded).
2. `event.streamingBehavior === "steer"` — during a mid-stream steering interrupt, skip the file I/O so the correction reaches the model with minimal latency. (Mirrors `input-transform-streaming.ts`.) `followUp` and normal (idle) input are processed normally.
3. `event.text` does not contain an `@` character at all (cheap pre-check before running the regex).
4. Config has both `text.enabled === false` and `images.enabled === false` — nothing to do.

> `event.text` may be empty when only images were attached (no typed text). Still process any `event.images`? No — our feature is about `@mentions` in text. If there's no text, return `continue`.

### 5.3 Mention parsing (the regex)

The `@mention` must be **disambiguated from email addresses** (`user@example.com`) and **`@handles`** that are not files. The reliable discriminator is: **the extracted token must resolve to an existing, readable file.** A benign `@mention` that isn't a file is simply left untouched.

**Step 1 — Candidate extraction.** Find every `@` that is *not* preceded by a word char or a dot, followed by a run of non-space, non-`@` characters:

```ts
const MENTION_RE = /(^|(?<=[^@\w.]))@([^\s@]+)/g;
```

- `(^|(?<=[^@\w.]))` — start-of-string **or** a preceding char that is not `@`, not a word char, not `.`. This blocks `user@host` (preceded by word char) and `sentence.@x` (preceded by dot).
- `@([^\s@]+)` — the literal `@` then the candidate token (no spaces, no nested `@`).

> **Important (zero-width anchor):** both alternatives (`^` and the lookbehind) are **zero-width**, so the full match `m[0]` is **exactly** the `@token` substring — it does **not** include the preceding character. That makes string replacement precise: `text.replace(m[0], block)` swaps just the mention. Capture group 1 (`m[1]`) is always an empty string; you generally don't need it.

**Step 2 — Token cleanup.** For each captured token string `raw`:
- Strip trailing sentence punctuation repeatedly: remove any of `.,;:!?"')]}>` from the end until none remain. (Preserves `file.txt`, `~/a/b`, `./x`.)
- If the (trimmed) token still ends with a path separator or is empty after trimming, drop it.
- `@@path` (leading `@`) is treated as a literal/escape: strip one leading `@`, and **do not** treat the remainder as a file mention — leave `@path` in the output text verbatim. (This gives users an escape hatch.)

**Step 3 — Path resolution & existence (§5.4).** Only tokens that resolve to an existing regular file proceed; everything else is left as-is in the text.

> **Known limitation (document, do not fix in v1):** paths containing spaces cannot be expressed, because a space terminates the token. Users with such files should use the `read` tool.

### 5.4 Path resolution & validation

For a cleaned candidate string `p`:

1. **Tilde expansion:** if `p` starts with `~`, expand via `os.homedir()` (or a manual replace of leading `~/`).
2. **Resolve:** `const abs = path.resolve(ctx.cwd, p);`
3. **Stat with `fs/promises.stat`:**
   - If the path does not exist → not a file mention; leave text unchanged. *(Do **not** throw.)*
   - If it is a directory → leave unchanged.
   - If it is not a regular file → leave unchanged.
4. **Readability:** if `stat` succeeds we treat it as readable; a subsequent read failure is caught and the mention is left unchanged.
5. **Scope guard (optional but recommended):** Do **not** restrict to `ctx.cwd`. The user explicitly mentioned the path, so absolute/`~`/`../` paths are allowed (same trust model as the built-in `read` tool with an explicit path).

### 5.5 Text-file branch

Given an eligible regular file `abs`:

1. **Extension check** (lowercased, no dot):
   - If `ext` is in `config.text.excludeExtensions` → skip (leave mention).
   - If `config.text.extensions` is non-null and `ext` not in it → skip.
2. **Size pre-check via `stat.size`:** if `config.maxBytes > 0 && stat.size > config.maxBytes` → file is oversized → branch to **§5.7 (oversized handling)**.
   - (Cheap guard so we never read a huge file just to count words.)
3. **Read & binary-detect:**
   - `const buf = await readFile(abs)` (full file; already gated by `stat.size` ≤ maxBytes).
   - **Binary detection:** scan the buffer's first 8000 bytes for a `NUL` byte (`0x00`). If found → treat as binary → skip (leave mention). This matches the standard heuristic.
   - Decode: `const content = buf.toString("utf8")`.
4. **Word count:** `const words = content.trim().split(/\s+/).filter(Boolean).length;`
   - If `words > config.maxWords` → oversized → §5.7.
5. **Format & inject** (§5.8).

### 5.6 Image branch (only when `config.images.enabled === true`)

1. **Extension check:** if `ext` is in `config.images.extensions` (case-insensitive):
   - Determine `mimeType` from extension (see table below).
   - If `stat.size > config.images.maxBytes` → oversized handling (§5.7), images variant: leave mention, optionally annotate.
2. **Read + (optional) resize:**
   - `const buf = await readFile(abs);`
   - If `config.images.resize`:
     ```ts
     const resized = await resizeImage(new Uint8Array(buf), mimeType);
     // resized may be null if the image can't be processed → fall back to raw
     const data = resized?.data ?? buf.toString("base64");
     const finalMime = resized?.mimeType ?? mimeType;
     ```
   - Else: `const data = buf.toString("base64");`
3. **Build `ImageContent`:** `{ type: "image", data, mimeType: finalMime }` and **push into the `images` array** (start from `event.images ?? []`).
4. **Text annotation:** keep the `@image.png` mention in the text (images are not in-band text). Optionally append `formatDimensionNote(resized)` to the formatted block so the model knows the rendered dimensions.

**MIME table:**
| ext | mimeType |
|---|---|
| `png` | `image/png` |
| `jpg`, `jpeg` | `image/jpeg` |
| `gif` | `image/gif` |
| `webp` | `image/webp` |
| `bmp` | `image/bmp` |

### 5.7 Oversized / over-limit handling

A file that **exists and is eligible by type** but exceeds `maxWords`/`maxBytes` is **left as-is** in the text (so the agent can still call `read` on it). If `config.annotateOversized === true`, append a one-line note to the formatted output:

```
[@path/to/file.ts — 2,341 words, over the 1,000-word auto-read limit; use the read tool]
```

### 5.8 Output assembly

Maintain, across all mentions in the prompt:
- `parts: string[]` — formatted content blocks (text) and notes.
- `images: ImageContent[]` — appended image content blocks.
- A **flag** `changed` — set true if at least one mention was successfully inlined OR annotated.

**Text formatting block** (for a successfully-read text file):

````
**@<relative-or-original-path>** (<N> words):

```<lang>
<full file contents>
```
````

- `<lang>` comes from `getLanguageFromPath(abs)` (may be `undefined`; omit the lang tag if so).
- Use the **original mention string** as the label (what the user typed), not necessarily the absolute path.

**Final `text`:**
- If `config.preserveMention === true` (default): keep the user's original `event.text` unchanged, then append a separator + all `parts`:
  ```
  <original prompt text>

  ---

  <part 1>

  <part 2>
  ...
  ```
- If `config.preserveMention === false`: rewrite `event.text` by **string-replacing each successfully-expanded mention token** with its formatted block. (Use the full match substring from the regex to replace precisely.) Mentions that were *not* expanded (missing/oversized/binary) stay as typed.

**Final `images`:** the accumulated `images` array (or `event.images` unchanged if none).

**Return:**
- If `changed === true`: `return { action: "transform", text: finalText, images: finalImages };`
- Else: `return { action: "continue" };`  (no transformation — original prompt is preserved exactly, including any unchanged `@mentions`).

### 5.9 Optional: TUI feedback

When `ctx.hasUI` and at least one file was inlined, emit a concise `ctx.ui.notify(..., "info")` summarizing counts (mirror `inline-bash.ts`'s expansion summary), e.g.:

```
Auto-read 2 file(s): @a.ts (120 words), @b.md (45 words)
```

Keep it short. Skip in non-interactive/print modes (`ctx.hasUI === false`).

---

## 6. Technical Reference (verified APIs)

Implement against these **real** exports/signatures (verified in pi-coding-agent v0.80.7).

### 6.1 Imports

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
  CONFIG_DIR_NAME,                 // ".pi" (use instead of hardcoding)
  resizeImage,                     // (bytes: Uint8Array, mime: string, opts?) => Promise<ResizedImage | null>
  formatDimensionNote,             // (resized: ResizedImage) => string | undefined
  getLanguageFromPath,             // (filePath: string) => string | undefined
} from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

> `ImageContent` shape: `{ type: "image"; data: string; mimeType: string }` where `data` is **base64** (no data-URL prefix). Defined in `@earendil-works/pi-ai` (`dist/types.d.ts`).

### 6.2 `resizeImage` / `ResizedImage`

```ts
interface ImageResizeOptions { maxWidth?: number; maxHeight?: number; maxBytes?: number; jpegQuality?: number; }
interface ResizedImage {
  data: string;          // base64
  mimeType: string;
  originalWidth: number; originalHeight: number;
  width: number; height: number;
  wasResized: boolean;
}
function resizeImage(inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions): Promise<ResizedImage | null>;
```
- Defaults when `options` omitted: caps to **2000×2000** (matches Pi's `images.autoResize`). Pass `{ maxWidth: 2000, maxHeight: 2000 }` explicitly if you want to be certain.
- Returns `null` if it cannot process (then fall back to raw base64).

### 6.3 `input` event contract (definitive)

```ts
interface InputEvent {
  type: "input";
  text: string;
  images?: ImageContent[];
  source: "interactive" | "rpc" | "extension";
  streamingBehavior?: "steer" | "followUp";
}
type InputEventResult =
  | { action: "continue" }
  | { action: "transform"; text: string; images?: ImageContent[] }
  | { action: "handled" };
```
- Only the **first** `handled` wins; `transform`s **chain** across handlers (each sees the previous transform's output). Return `continue` when you make no change.

### 6.4 Config helpers (write these)

- `loadConfig(ctx): Promise<Config>` — read global then project JSON (guard project read with `ctx.isProjectTrusted()`), deep-merge, apply defaults, cache on the module (reset cache in `session_start`).
- Deep-merge: plain objects merge recursively; arrays/scalars from project replace global; `null`/`undefined` project keys keep global.

---

## 7. File Structure

Ship as a **single-file extension** for v1 (simplest; matches most examples). Place at:

- **Global:** `~/.pi/agent/extensions/auto-reader.ts`
- **Project-local:** `.pi/extensions/auto-reader.ts`

```
auto-reader.ts   // single file (~250–350 lines)
```

Suggested internal organization within the single file (sections, in order):

1. **Imports** (§6.1)
2. **Types:** `interface Config`, `interface ImageConfig`, `interface TextConfig`, plus a `DEFAULT_CONFIG` constant.
3. **Constants:** `MENTION_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT`, binary-detection helper.
4. **Config:** `loadConfig(ctx)` + module-level cache + `session_start` reset.
5. **Pure helpers:** `expandTilde`, `cleanToken`, `countWords`, `isBinary(buf)`, `extOf(p)`, `formatTextBlock(...)`, `formatImageNote(...)`, `formatOversizedNote(...)`.
6. **Core:** `async function expandMentions(text, images, ctx, config): Promise<{ text, images, changed }>` — the heart of the feature.
7. **Factory:** `export default function (pi: ExtensionAPI) { ... }` wiring `session_start` (cache reset) and `input` (the handler).
8. **Sanity self-test** (optional, dev-only): a tiny `if (import.meta.url ... )` block or `/auto-reader-test` command (see §10).

> Keep it dependency-free (Node builtins + Pi exports only). No `package.json` needed.

---

## 8. Algorithm Reference (pseudocode)

```ts
export default function (pi: ExtensionAPI) {
  let configCache: Config | null = null;

  pi.on("session_start", () => { configCache = null; }); // reload on new/resume/reload

  pi.on("input", async (event, ctx) => {
    // --- short circuits (§5.2) ---
    if (event.source === "extension") return { action: "continue" };
    if (event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text || !event.text.includes("@")) return { action: "continue" };

    const config = configCache ?? await loadConfig(ctx);
    configCache = config;
    if (!config.text.enabled && !config.images.enabled) return { action: "continue" };

    const result = await expandMentions(event.text, event.images ?? [], ctx, config);
    if (!result.changed) return { action: "continue" };

    if (ctx.hasUI && result.summary) ctx.ui.notify(result.summary, "info");
    return { action: "transform", text: result.text, images: result.images };
  });
}

async function expandMentions(text, imagesIn, ctx, config) {
  const parts: string[] = [];
  const images = [...imagesIn];
  const inlineReplacements: Array<{ match: string; block: string }> = [];
  let readCount = 0;

  for (const m of text.matchAll(MENTION_RE)) {
    const raw  = m[2];                      // token after '@'
    const mentionText = m[0];               // exact substring (== "@" + raw) to replace/keep

    if (raw.startsWith("@")) continue;      // @@escape → leave verbatim
    const token = cleanToken(raw);
    if (!token) continue;
    // m[0] === "@" + raw  (the zero-width anchor is NOT part of the match)

    const abs = expandTildeAndResolve(token, ctx.cwd);
    let st;
    try { st = await fs.stat(abs); } catch { continue; } // not a file → leave as-is
    if (!st.isFile()) continue;

    const ext = extOf(abs);
    const isImg = config.images.enabled && MIME_BY_EXT[ext];

    if (isImg) {
      // §5.6 image branch
      if (st.size > config.images.maxBytes) { pushOversized(parts, ...); continue; }
      const buf = await fs.readFile(abs);
      const resized = config.images.resize ? await resizeImage(new Uint8Array(buf), MIME_BY_EXT[ext]) : null;
      images.push({ type: "image", data: resized?.data ?? buf.toString("base64"),
                    mimeType: resized?.mimeType ?? MIME_BY_EXT[ext] });
      const block = formatImageNote(mentionText, resized);
      parts.push(block);
      inlineReplacements.push({ match: mentionText, block });
      readCount++;
    } else if (config.text.enabled && looksText(ext, config)) {
      // §5.5 text branch
      if (config.maxBytes > 0 && st.size > config.maxBytes) { pushOversized(parts, ...); continue; }
      const buf = await fs.readFile(abs);
      if (isBinary(buf)) continue;
      const content = buf.toString("utf8");
      const words = countWords(content);
      if (words > config.maxWords) { pushOversized(parts, mentionText, words, config); continue; }
      const block = formatTextBlock(mentionText, content, words, abs);
      parts.push(block);
      inlineReplacements.push({ match: mentionText, block });
      readCount++;
    }
    // else: leave mention untouched
  }

  if (readCount === 0 && parts.length === 0) return { text, images: imagesIn, changed: false };

  let finalText;
  if (config.preserveMention) {
    finalText = parts.length ? `${text}\n\n---\n\n${parts.join("\n\n")}` : text;
  } else {
    finalText = text;
    for (const { match, block } of inlineReplacements) finalText = finalText.replace(match, block);
    if (parts.some(p => p.startsWith("["))) { /* append oversized notes if any */ }
  }

  return { text: finalText, images, changed: true,
           summary: `Auto-read ${readCount} file(s): ${readCount}` };
}
```

---

## 9. Edge Cases (implementer checklist)

| Case | Expected behavior |
|---|---|
| No `@` in prompt | `continue` (no work). |
| `@nonexistent.txt` | Mention left verbatim; no error, no notify. |
| `@some/dir/` (directory) | Mention left verbatim. |
| `user@example.com` | **Not matched** (preceded by word char). |
| `Look at @a.txt and @b.md` | Both inlined (multi-mention). |
| `@@file.ts` | Treated as literal `@file.ts` — left verbatim, **not** expanded. |
| `(@file.ts)` | Token `file.ts)` cleaned to `file.ts`; expanded. The `(` and `)` stay in text. |
| File over `maxWords` | Left as-is; optionally annotated if `annotateOversized`. |
| File over `maxBytes` (stat) | Skipped before reading; left as-is / annotated. |
| Binary file (NUL byte) | Left verbatim. |
| `.lock` / `.min.js` / `.map` | Left verbatim (excluded by default). |
| Image mention, `images.enabled=false` | **Not** treated as an image; falls through to text branch (will be skipped by `looksText` exclusion or binary check), left verbatim. |
| Image over `images.maxBytes` | Left verbatim; optionally annotated. |
| `resizeImage` returns `null` | Fall back to raw base64 of the original. |
| Read throws (permission) | Catch; leave mention verbatim. |
| Empty / whitespace-only file | Inlined (0 words) — that's fine; cheap and correct. |
| Path with spaces (`@my file.txt`) | Not supported v1 (space terminates token); left verbatim. Document it. |
| `~`-prefixed path (`@~/notes.md`) | Expanded to home dir; resolved. |
| Absolute path (`@/etc/hosts`) | Resolved & read if under limits (user explicitly mentioned it). |
| Same file `@`-mentioned twice | Inlined twice (acceptable; matches user text). |
| RPC / print mode (`ctx.hasUI === false`) | Still transforms (feature is non-UI); just skip the `notify`. |
| Mid-stream steering | Skipped entirely (latency). |
| Config file missing | Use defaults; no error. |
| Malformed config JSON | Catch parse error, log via `ctx.ui.notify(..., "error")` once, fall back to defaults. |

---

## 10. Acceptance Criteria & Test Plan

A naive dev agent should verify each of these. Run Pi with the extension:

```bash
pi -e ./auto-reader.ts        # quick test
# or place in ~/.pi/agent/extensions/auto-reader.ts and use /reload
```

### Manual test matrix

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | small `a.ts` (~50 words) | `Review @a.ts` | Prompt sent to model already contains `a.ts` contents; **no `read` tool call** appears. `@a.ts` still visible in prompt (preserveMention). |
| 2 | `big.md` (1500 words), default config | `Summarize @big.md` | Mention left as-is; model calls `read`. (With `annotateOversized:true`, a note is appended.) |
| 3 | raise limit: `{"maxWords":2000}` | same as #2 | `big.md` is now inlined; no `read` call. |
| 4 | `pic.png`, images off | `Describe @pic.png` | Mention left verbatim; no image attached. |
| 5 | `pic.png`, `{"images":{"enabled":true}}` | `Describe @pic.png` | Image content block attached; `pic.png` mention remains in text. |
| 6 | missing file | `Fix @nope.ts` | Text unchanged; model told file missing by its own means. |
| 7 | email | `Email me at a@b.com` | **No** expansion (preceded by word char). |
| 8 | binary `data.bin` | `Check @data.bin` | Left verbatim (NUL detected). |
| 9 | excluded ext `pkg.lock` | `Review @pkg.lock` | Left verbatim (excluded). |
| 10 | multi-mention | `Diff @a.ts vs @b.ts` | Both inlined; summary notify shows `2 file(s)`. |
| 11 | `@@escape` | `Literal @@readme.md token` | Output contains literal `@readme.md` — **not** expanded. |
| 12 | preserveMention:false | `{"preserveMention":false}` + `@a.ts end` | `@a.ts` replaced inline by formatted block; `end` preserved. |
| 13 | project config override | global `maxWords:1000`, `.pi/auto-reader.json` `{"maxWords":50000}` | A 2000-word file inlines in this project. |
| 14 | untrusted project | run in untrusted dir with `.pi/auto-reader.json` | Project config ignored (only global applies); `ctx.isProjectTrusted()` false. |
| 15 | mid-stream steering | type a correction mid-response | Transformation skipped (no file I/O); correction is fast. |

### Automated sanity check (optional, recommended)

Add a hidden command for dev verification:

```ts
pi.registerCommand("auto-reader-test", {
  description: "Run auto-reader self-test",
  handler: async (_args, ctx) => {
    // create a temp file, run expandMentions() directly on a sample string,
    // assert contents appear, assert oversized/binary skip, assert email not matched.
    ctx.ui.notify("auto-reader self-test passed", "info");
  },
});
```

(Strip or gate behind a dev flag before shipping if undesired.)

---

## 11. Implementation Notes & Gotchas

1. **Loop prevention is mandatory.** Always return `continue` for `event.source === "extension"`. Failing this can cause infinite expansion if any extension (including this one's own `sendUserMessage` paths) re-feeds text containing `@`.
2. **`matchAll` + replace precision.** When `preserveMention === false`, replace using the **exact matched substring** `m[0]` (which is precisely `@token`, since the regex anchor is zero-width), not a reconstructed string — tokens may contain regex-special characters. Use `String.replace` with a string needle, or escape it if using a RegExp.
3. **The lookbehind is zero-width.** `m[0]` never includes the preceding character, so `(@file)` keeps its `(` and `)` naturally; you only ever swap the `@file` portion. No manual char-preservation logic is needed.
4. **Don't read huge files to count words.** Always `stat` first and bail on `stat.size > maxBytes`. This is a performance + safety requirement, not optional.
5. **Binary detection before decode.** Check for `0x00` in the buffer *before* `toString("utf8")` to avoid silently mangling binary.
6. **Images use base64, no data URL.** `ImageContent.data` is raw base64. Do **not** prefix with `data:image/png;base64,`.
7. **`resizeImage` takes `Uint8Array`.** Wrap the Buffer: `new Uint8Array(buf)` (Buffers are `Uint8Array` subclasses, but be explicit for type safety).
8. **Cache config per session.** Reading JSON from disk on every keystroke-submission is wasteful; cache and invalidate on `session_start` (`reason` includes `"reload"`, `"new"`, `"resume"`, `"fork"`).
9. **`CONFIG_DIR_NAME` for `.pi`.** Use it, not the literal `".pi"`, for project config paths.
10. **Never throw out of the handler.** Wrap all file I/O in try/catch; on any unexpected error, return `{ action: "continue" }` so the user's prompt is never lost.
11. **`event.text` may have no `@`.** The `includes("@")` pre-check avoids spinning up config load + regex for the common case.
12. **Order of checks for an image extension when images are disabled:** don't accidentally treat a `.png` as a text file (it'll be binary-detected and skipped anyway, but `looksText` should also exclude it cleanly).
13. **Don't override the `read` tool.** This extension only uses the `input` event; leave built-in tools alone so they remain the fallback for large files.

---

## 12. Design Alternatives Considered

- **`before_agent_start` injection** (inject file contents as a separate context message instead of rewriting the prompt). *Rejected for v1:* the `input` transform is simpler, matches the canonical `inline-bash.ts` pattern, and keeps content inline in the user message (closest to Claude Code semantics). `before_agent_start` is noted as a possible future refactor if a cleaner TUI separation is desired.
- **Custom `read` tool override** (wrap `read` to pre-populate). *Rejected:* doesn't address the goal — the goal is to avoid the tool call entirely.
- **Custom autocomplete provider** to transform `@`-completions into content on Tab. *Rejected:* autocomplete only runs in interactive TUI mode and only at completion time; it would miss typed-by-hand mentions and all RPC/print usage. The `input` hook is mode-agnostic.
- **TUI "chip"/collapsible attachment rendering** (like Claude Code). *Deferred* (§13): would require a custom user-message renderer to collapse the inlined blocks for a cleaner transcript. Not needed for the core value (no tool call).

---

## 13. Future Enhancements (out of scope for v1)

- **Glob expansion** (`@src/*.ts`) with a result count cap.
- **Directory summary** (`@src/` → a tree + file list, capped).
- **Collapsible TUI rendering** of inlined blocks via a custom user-message renderer (visually compact like Claude Code chips, while still sending full content to the model).
- **Token-based budgeting** instead of/in addition to word count, using `ctx.getContextUsage()` or an estimator.
- **MCP/remote path support** (the built-in `read` tool supports pluggable operations; this extension is local-fs only in v1).
- **Per-mention override flags**, e.g. `@!big.md` to force-inline regardless of limit, or `@?maybe.md` to inline only if tiny.

---

## 14. Open Questions (resolve before/as you implement)

1. **Should the word count include or exclude markdown/code-fence structure?** Recommendation: count raw words (simplest, predictable); document it.
2. **Default `maxBytes` value?** Recommendation: `25600` (25KB) — generous enough to never block legitimate ~1000-word prose, strict enough to stop minified blobs. Confirm with one large-prose test file.
3. **Should oversized annotation be on by default?** Recommendation: **off** (minimal surprise); users who want visibility enable `annotateOversized`.

---

## Appendix A — Minimal skeleton (starting point for the implementer)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { CONFIG_DIR_NAME, resizeImage, formatDimensionNote, getLanguageFromPath } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const MENTION_RE = /(^|(?<=[^@\w.]))@([^\s@]+)/g;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};

interface Config { /* ...per §4.2... */ }
const DEFAULT_CONFIG: Config = { /* ...per §4.3... */ };

export default function (pi: ExtensionAPI) {
  let cache: Config | null = null;

  pi.on("session_start", () => { cache = null; });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text?.includes("@")) return { action: "continue" };

    const config = cache ?? (cache = await loadConfig(ctx));
    if (!config.text.enabled && !config.images.enabled) return { action: "continue" };

    const { text, images, changed } = await expandMentions(event.text, event.images ?? [], ctx, config);
    if (!changed) return { action: "continue" };
    return { action: "transform" as const, text, images };
  });

  // ... loadConfig, expandMentions, and the §5 helpers implemented here ...
}
```

**Done-definition:** all 15 manual test cases in §10 pass, no uncaught errors, the agent makes **zero** `read` tool calls for inlined files, and prompts with no/small `@mentions` are byte-for-byte unchanged when nothing matches.
