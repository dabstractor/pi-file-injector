# PRD: `#@file` Whole-File Injection Extension for Pi

**Status:** Draft · **Target:** Pi `@earendil-works/pi-coding-agent` (verified against v0.80.7) · **Artifact type:** Pi TypeScript extension

---

## 1. Overview

### Problem
Pi has no simple, consistent way to say **"put this entire file into the model's context right now."**

- The existing `@file` syntax only auto-reads when passed as a **CLI argument** (`pi @file.txt "question"`). It is parsed from argv by `processFileArguments()` *before* the session starts.
- **Inside the interactive editor**, typing `@file.txt` only triggers path *autocomplete*; on submit the literal text `@file.txt` is sent and the model must call the `read` tool itself.
- Worse, `@file` is **overloaded**: it means "autocomplete a path" interactively *and* "inject a file" at the CLI. Users cannot express a clear, unconditional "inject the whole file" intent in either context without it being ambiguous.

### Solution
A new, dedicated syntax: **`#@<path>`**. It is an **unconditional, whole-file injection** trigger. When the user writes `#@filename.txt` anywhere in a prompt and submits, the extension reads the **entire** file and injects its contents into the prompt **before** the model sees it — every time, with no size limit and no configuration.

`#@` is deliberately a **different symbol** from `@` so there is zero ambiguity:
- `@file` → Pi's existing behavior (autocomplete interactively; inject at CLI). Left untouched.
- `#@file` → **always** inject the whole file, in every context.

### Value proposition
- **One syntax, every context.** Because the extension hooks the `input` event (which fires for *every* prompt — interactive typed messages *and* the initial CLI/`-p` message), `#@file` works identically whether you launch with it or type it mid-session. (See §3.)
- **Explicit intent.** `#@` can't be confused with a path-completion trigger or an email-style `@mention`. The user is saying "give the model this whole file," and that's exactly what happens.
- **Zero config.** No thresholds, no toggles, no config files. It does one thing.

### Tagline
> "`#@file` — inject the whole file, every time, everywhere."

---

## 2. Goals & Non-Goals

### Goals
1. **New syntax `#@<path>`** that unconditionally injects the **entire** contents of the referenced file into the model's context at prompt-submission time.
2. **Works in every input context** — interactive TUI, the initial CLI/`-p` message, and RPC — because it operates on the `input` event.
3. **No configuration.** No size limits, no word counts, no toggles, no config files, no env vars. Fixed, predictable behavior.
4. **Correct file-type handling** with no knobs: text → content; image → attached; other binary → a clear note (not garbage); missing/dir → left as a literal token.
5. **Non-destructive & loop-safe.** Leaves the user's original prompt intact; never breaks a prompt on an error; never re-expands its own or other extensions' injected messages.

### Non-Goals
- **No size gating.** This is intentional and is the central design choice (see §13). The user asked for the whole file every time; if they `#@` a 10 MB file, they get a 10 MB injection. The risk is documented, not gated.
- **No chunking / offset / limit.** `#@` always injects the *entire* file. For partial reads the user uses the `read` tool.
- **No globbing / multi-file** (`#@src/*.ts`). Single concrete path per token.
- **No directory reads.** `#@some/dir` is left as a literal token.
- **No replacement of `@`, `read`, or any built-in.** `#@` is purely additive.
- **No custom TUI rendering.** Injected content appears in the user's message bubble normally.
- **No config** of any kind (this bears repeating).

---

## 3. Background: How Pi Handles Input (must-read for implementer)

Pi extensions are TypeScript modules exporting a default factory `(pi: ExtensionAPI) => void`. The correct hook is the **`input` event**, emitted from inside `AgentSession.prompt()` — the single entry point for **all** user prompts.

```
user submits prompt (interactive editor  OR  initial CLI/-p message  OR  RPC)
        │
        ▼
  AgentSession.prompt(text)
        │
        ├─► extension commands (/cmd) checked
        ├─► ★ input event ★   ← THIS EXTENSION HOOKS HERE
        │     handler may { action: "transform", text, images }
        ├─► skill (/skill:...) + prompt-template expansion
        └─► agent loop
```

The handler signature (verified in `dist/core/extensions/types.d.ts`):

```ts
pi.on("input", async (event, ctx) => {
  // event.text              -> raw user prompt (contains literal "#@path" text)
  // event.images            -> ImageContent[] already attached
  // event.source            -> "interactive" | "rpc" | "extension"
  // event.streamingBehavior -> undefined | "steer" | "followUp"

  return { action: "transform", text: newText, images: newImages }; // rewrite
  // or
  return { action: "continue" };                                     // pass through
});
```

A `transform` **replaces** the submitted prompt text and image list; the result is stored as the user message and sent to the model.

### 3.1 Why `#@` works everywhere (the key advantage)

Because the `input` event fires inside `prompt()` — and `prompt()` is called for interactive typed messages *and* the initial CLI/`-p`/RPC message — `#@file` injection happens uniformly in **all** contexts. This is something even Pi's own `@file` CLI expansion cannot claim (that expansion runs during argv parsing, *before* `prompt()`, and only at launch).

> **Canonical reference example to mirror:** `examples/extensions/inline-bash.ts` — it scans `event.text` for a regex (`!{cmd}`), expands each match, and returns `{ action: "transform", text, images: event.images }`. Structure this extension the same way, substituting the `#@path` pattern and file-reading for command execution.

### 3.2 Why `#@` is a safe, collision-free trigger

The two-character trigger `#@` (`#` immediately followed by `@`) is unambiguous against everything else in Pi and in prose:

| Existing use of `#` or `@` | Collision with `#@`? | Why |
|---|---|---|
| Pi interactive `@path` autocomplete / `@mention` | ❌ No | Requires bare `@`; `#@` has a leading `#`. |
| Pi CLI `@file` argv expansion | ❌ No | Runs pre-`prompt()` on argv; `#@file` starts with `#`, not `@`, so it's never parsed as a file arg — it reaches `prompt()` as text where we handle it. |
| `github-issue-autocomplete.ts` `#1234` | ❌ No | That matches `#` + digits; `#@` has `@` after `#`. |
| Markdown headings (`# Title`, `## Section`) | ❌ No | `#` + space/text, never `#` + `@`. |
| Email `user@host` | ❌ No | No `#`. |

So `#@` is a clean, dedicated trigger that coexists with all of the above.

### 3.3 Public vs internal utilities

The built-in CLI `@file` path uses helpers that are **not** exported from the package. This extension re-implements the thin missing pieces on top of *exported* APIs only (never import from `dist/...` internals — unstable surface):

| Built-in uses | Exported? | This extension uses |
|---|---|---|
| `resizeImage(bytes, mime)` | ✅ yes | directly (image downscale to provider limits) |
| `formatDimensionNote(resized)` | ✅ yes | directly (image dimension hint) |
| `getLanguageFromPath(path)` | ✅ yes | directly (optional, only if markdown format were ever added) |
| `CONFIG_DIR_NAME` | ✅ yes | N/A (no config in v1) |
| `processImage(bytes, mime)` | ❌ internal | `resizeImage` instead |
| `detectSupportedImageMimeTypeFromFile(path)` | ❌ internal | small inline MIME table (§5.2) |
| `resolveReadPath(p, cwd)` (tilde + macOS Unicode-space) | ❌ internal | inline tilde expansion via `os.homedir()` (§4) |

---

## 4. The `#@` Syntax Specification

### 4.1 Grammar

```
#@<path>
```

- The literal two-character trigger `#@`, immediately followed by a path token.
- **`<path>`** = a maximal run of non-whitespace characters (`\S+`), then trailing sentence punctuation is trimmed (see §4.3).
- The trigger must appear at **start-of-string** or **after a non-word character** (so `foo#@bar` mid-word does *not* trigger).

### 4.2 Detection regex

```ts
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
```

- `(^|(?<=\W))` — start-of-string **or** a preceding non-word char (space, `(`, `[`, etc.). Blocks mid-word `#@`.
- `#@` — the literal trigger.
- `(\S+)` — the path token (no spaces).
- **Zero-width anchor note:** `(^|(?<=\W))` consumes nothing, so the full match `m[0]` is **exactly** `#@<path>` — precise for string replacement, no leading-char bookkeeping.

### 4.3 Token cleanup

For each captured raw token `r`:
1. **Trim trailing punctuation** repeatedly: remove any of `` . , ; : ! ? " ' ) ] } > `` from the end until none remain. (Preserves `file.txt`, `~/a/b`, `./x`, `../y`.)
2. If empty after trimming → skip (leave as-is in text).
3. **No escape hatch needed.** (Unlike `@`, there's no need for `##@`; if a user wants a literal `#@`, they... won't, it's not real prose. If ever needed, `#@` inside a fenced code block is still matched — document this as a known minor limitation, or note `# @` with a space avoids it.)

### 4.4 Path resolution

For cleaned token `p`:
1. **Tilde expansion:** if `p` starts with `~`, replace a leading `~/` with `os.homedir() + "/"` (or `~` alone with homedir).
2. **Resolve:** `const abs = path.resolve(ctx.cwd, p);`
3. **`fs/promises.stat(abs)`:**
   - throws / not found → **not a file** → leave the `#@p` token verbatim in the text (no injection). *(Do not throw out of the handler.)*
   - is a directory → leave token verbatim.
   - not a regular file → leave token verbatim.
4. **No cwd restriction.** The user explicitly wrote `#@`; absolute paths, `~/...`, and `../...` are all allowed (same trust model as the built-in `read` tool with an explicit path).

> **Known limitation (document, do not fix):** paths containing spaces cannot be expressed (a space ends the token). Users with such files use the `read` tool.

---

## 5. Behavior by File Type

Given an existing regular file at `abs`, classify by extension (lowercased, no dot) and branch:

### 5.1 Text files (everything that isn't a recognized image)

1. **Read the entire file:** `const buf = await fs.readFile(abs);`
2. **Binary check** (only to route *non-image* binaries to §5.3, not to gate size): scan the first 8000 bytes for a `0x00` (NUL) byte.
   - If a NUL is found **and** the extension is not a known image type → go to §5.3 (binary note).
   - Otherwise treat as text.
3. **Decode:** `const content = buf.toString("utf8");`
4. **Inject the entire content** — no truncation, no limit. (See §6 for format.)

> There is **no word/byte limit anywhere**. This is the defining behavior of `#@`.

### 5.2 Image files

Recognized image extensions (case-insensitive) and their MIME types:

| ext | mimeType |
|---|---|
| `png` | `image/png` |
| `jpg`, `jpeg` | `image/jpeg` |
| `gif` | `image/gif` |
| `webp` | `image/webp` |
| `bmp` | `image/bmp` |

For an image file:
1. `const buf = await fs.readFile(abs);`
2. **Resize to provider limits** (necessary, not configurable — providers reject oversized images): `const resized = await resizeImage(new Uint8Array(buf), mimeType);`
   - `resizeImage` returns `null` if it can't process → fall back to the raw bytes: `data = buf.toString("base64")`, `finalMime = mimeType`.
   - Otherwise: `data = resized.data`, `finalMime = resized.mimeType`.
3. **Attach:** push `{ type: "image", data, mimeType: finalMime }` into the `images` array (seeded from `event.images ?? []`).
4. **Reference note** in the text block (see §6), optionally including `formatDimensionNote(resized)`.

### 5.3 Other binary files (non-image, NUL detected)

Do **not** inject decoded garbage. Emit a clear note instead so the model knows the file exists and can use a tool if it actually needs the bytes:

```
<file name="/abs/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```

### 5.4 Missing / directory / read error

Leave the original `#@path` token **verbatim** in the text. No block is appended for it. The model sees the literal reference and can react (call `read`, ask the user, etc.). Never throw.

---

## 6. Output Format & Assembly

### 6.1 Format: Pi-native `<file>` tags

Mirror the exact format Pi's own CLI `@file` expansion emits (from `processFileArguments`), so the model sees identical structure regardless of source:

**Text file** →
```
<file name="/absolute/path/to/file.ts">
<entire file contents>
</file>
```

**Image file** → an `ImageContent` block is attached **and** a text reference tag is emitted:
```
<file name="/absolute/path/to/img.png"><optional dimension hints></file>
```

**Binary (non-image)** →
```
<file name="/absolute/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```

Use the **absolute resolved path** as `name` (matches the CLI format).

### 6.2 Assembly

Maintain across all `#@` tokens in the prompt:
- `blocks: string[]` — the `<file>…</file>` strings produced above.
- `images: ImageContent[]` — seeded from `event.images ?? []`, appended to for each image.
- `injected: number` — count of files successfully injected (blocks appended or images attached); `0` means none.

**Final text:** **append** all blocks below the user's prompt, separated by a horizontal rule, and **strip the `#@` trigger** from each injected marker — the **path** stays as a readable reference (the model gets the data from the appended `<file name="abs">` blocks, so `#@` is pure noise). Tokens that did **not** inject (missing / directory / read-error) are left byte-for-byte verbatim, `#@` included:

```
<original prompt text, unchanged>

---

<block 1>

<block 2>
...
```

> **Why append, not inline-replace?** Files can be large (this is unconditional). Appending keeps the user's prose readable in the transcript and is the least surprising transformation. The `#@` trigger is stripped from each injected reference (the path stays); failed tokens keep their `#@` verbatim.

**Final images:** the accumulated `images` array (unchanged if none).

**Return:**
- `injected > 0` → `return { action: "transform", text: finalText, images: finalImages };`
- else → `return { action: "continue" };` (prompt preserved byte-for-byte).

---

## 7. Technical Reference (verified APIs)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
  resizeImage,          // (bytes: Uint8Array, mime: string, opts?) => Promise<ResizedImage | null>
  formatDimensionNote,  // (resized: ResizedImage) => string | undefined
} from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

**`ImageContent`** (from `@earendil-works/pi-ai`): `{ type: "image"; data: string; mimeType: string }` where `data` is **base64** (no `data:` URL prefix).

**`resizeImage` / `ResizedImage`:**
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
Calling `resizeImage(bytes, mime)` with no options caps to **2000×2000** (matches Pi's `images.autoResize` default). Returns `null` if it can't process.

**`input` event contract:**
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
`transform`s chain across handlers (each sees the previous output); return `continue` when you change nothing.

---

## 8. File Structure

Single-file extension, no runtime dependencies. The repo ships two files at the root:

- **`sharp-at-file.ts`** — the extension itself (zero npm imports beyond Pi's own packages).
- **`package.json`** — a thin `"pi"` manifest (`{ "pi": { "extensions": ["sharp-at-file.ts"] } }`)
  that makes the **directory** a loadable pi package. This is required so `pi install .` /
  `pi install /abs/path` work, and so handing the directory to the loader (via a package
  registration or `-e <dir>`) resolves to `sharp-at-file.ts` instead of crashing with
  `Cannot find module '<dir>'` — a directory with no manifest and no `index.ts` has no entry
  point for jiti to import.

Install locations:

- **Global:** `~/.pi/agent/extensions/sharp-at-file.ts` (copy), or `pi install .` (package).
- **Project-local:** `.pi/extensions/sharp-at-file.ts` (copy).

Internal sections (in order):
1. Imports (§7)
2. Constants: `FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT`, helpers
3. Pure helpers: `expandTilde`, `cleanToken`, `isBinary(buf)`, `extOf(p)`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`
4. Core: `async function injectFiles(text, imagesIn, ctx): Promise<{ text, images, injected }>`
5. Factory: `export default function (pi: ExtensionAPI) { pi.on("input", ...) }`

Target ~150–220 lines.

---

## 9. Algorithm (pseudocode)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};
const TRAILING_PUNCT = ".,;:!?\")]}>'";

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    // --- short circuits ---
    if (event.source === "extension") return { action: "continue" };        // loop prevention
    if (event.streamingBehavior === "steer") return { action: "continue" }; // latency during steering
    if (!event.text?.includes("#@")) return { action: "continue" };         // cheap pre-check

    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" };          // injected is a count; 0 = none

    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} file(s)`, "info");
    return { action: "transform" as const, text, images };
  });
}

async function injectFiles(text, imagesIn, ctx) {
  const blocks: string[] = [];
  const images = [...imagesIn];
  let count = 0;

  for (const m of text.matchAll(FILE_INJECT_RE)) {
    const raw = m[2];                       // token after '#@'
    const token = cleanToken(raw);          // trim trailing punct
    if (!token) continue;

    const abs = expandTildeAndResolve(token, ctx.cwd);  // ~ + path.resolve

    let st;
    try { st = await fs.stat(abs); } catch { continue; }  // missing → leave token
    if (!st.isFile()) continue;                            // dir → leave token

    const ext = extOf(abs);
    const mime = MIME_BY_EXT[ext];

    try {
      if (mime) {
        // IMAGE
        const buf = await fs.readFile(abs);
        const resized = await resizeImage(new Uint8Array(buf), mime);
        images.push({ type: "image",
                      data: resized?.data ?? buf.toString("base64"),
                      mimeType: resized?.mimeType ?? mime });
        blocks.push(formatImageBlock(abs, resized));
      } else {
        // TEXT (or binary)
        const buf = await fs.readFile(abs);
        if (isBinary(buf)) {
          blocks.push(formatBinaryBlock(abs));             // §5.3 note, no garbage
        } else {
          blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file
        }
      }
      count++;
    } catch {
      // read/processing error → leave token, keep going
      continue;
    }
  }

  if (count === 0) return { text, images: imagesIn, injected: 0 }; // nothing injected → byte-for-byte

  // strip the #@ trigger from each injected marker (the path stays as the reference; #@ is noise).
  // Failed tokens took the count===0 path above, so they keep their #@ verbatim.
  const stripped = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
  const finalText = `${stripped}\n\n---\n\n${blocks.join("\n\n")}`;
  return { text: finalText, images, injected: count };
}

// helpers ----------------------------------------------------------
function cleanToken(raw: string): string {
  let t = raw;
  while (t.length && TRAILING_PUNCT.includes(t[t.length - 1])) t = t.slice(0, -1);
  return t;
}
function expandTildeAndResolve(p: string, cwd: string): string {
  const home = os.homedir();
  const expanded = p === "~" ? home
                 : p.startsWith("~/") ? path.join(home, p.slice(2))
                 : p;
  return path.resolve(cwd, expanded);
}
function extOf(abs: string): string {
  const base = path.basename(abs);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}
function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
function formatTextFileBlock(abs: string, content: string): string {
  return `<file name="${abs}">\n${content}\n</file>`;
}
function formatImageBlock(abs: string, resized: any): string {
  const hint = resized ? formatDimensionNote(resized) : "";
  return `<file name="${abs}">${hint ?? ""}</file>`;
}
function formatBinaryBlock(abs: string): string {
  return `<file name="${abs}"><binary file — contents not injected; use the read tool if needed></file>`;
}
```

`injectFiles` returns `injected` as a **count** (number ≥ 0); the handler treats `0` as "nothing injected".

---

## 10. Edge Cases (implementer checklist)

| Case | Expected behavior |
|---|---|
| No `#@` in prompt | `continue` (no work). |
| `#@nonexistent.txt` | Token left verbatim; no block; no error. |
| `#@some/dir/` (directory) | Token left verbatim. |
| `text #@a.txt more` | `#@a.ts` → wait, `#@a.txt`; file injected, appended below; inline marker becomes `a.txt` (`#@` stripped, path stays). |
| Multiple `#@a.txt #@b.md` | Both injected; blocks appended in order; summary notify `2 file(s)`. |
| `#@huge.log` (50 MB) | **Entire file injected.** No limit. (Documented risk, §13.) |
| `#@data.bin` (binary, NUL) | Binary note block appended; no garbage. |
| `#@pic.png` | Image attached as `ImageContent` (resized); reference block appended. |
| `#@~/notes.md` | Tilde-expanded; resolved; injected. |
| `#@/etc/hosts` (absolute) | Resolved; injected (explicit user intent). |
| `#@file.txt.` (trailing period) | Period trimmed → `file.txt`; injected. |
| `(@file.txt)` | `#@`? No — this is `(@...`. For `(#@file.txt)`: `(` is non-word → matches; token `file.txt)` → trimmed to `file.txt`; injected. |
| `foo#@bar` (mid-word) | **Not matched** (`#@` preceded by word char `o`). |
| `# @file` (space between) | **Not matched** (trigger is `#@`, not `# @`). |
| Markdown `# Heading` / issue `#1234` | **Not matched** (no `#@`). |
| `#@file` inside a fenced code block | Still matched/injected (known minor limitation; use `# @` or rephrase to avoid). |
| Read throws (permissions) | Caught; token left verbatim; other tokens still processed. |
| `resizeImage` returns `null` | Fall back to raw base64 of original image bytes. |
| Empty file (0 bytes) | Injected as empty `<file name="…">\n\n</file>` — correct and cheap. |
| `source === "extension"` | Skipped entirely (loop prevention). |
| Mid-stream steering | Skipped entirely (latency). |
| RPC / print mode (`ctx.hasUI === false`) | Still injects; skip the `notify`. |
| Initial CLI/`-p` message containing `#@file` | **Also injected** (input event fires in `prompt()`). |

---

## 11. Acceptance Criteria & Test Plan

Load the extension:
```bash
pi -e ./sharp-at-file.ts            # quick test (file)
pi -e .                             # quick test (directory — resolves via package.json manifest)
# or install as a package:  pi install .
# or copy to ~/.pi/agent/extensions/sharp-at-file.ts and use /reload
```

### Manual test matrix

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | small `a.ts` (~50 words) | `Review #@a.ts` | Prompt sent to model already contains `a.ts` contents in a `<file name="…">` block; **no `read` tool call**. Original prompt text unchanged; block appended after `---`. |
| 2 | `huge.log` (50 MB) | `Summarize #@huge.log` | **Entire file injected.** No truncation, no limit. (May blow context — that's the documented behavior.) |
| 3 | `pic.png` | `Describe #@pic.png` | `ImageContent` attached; `<file name="…">…</file>` reference appended; inline marker becomes `pic.png` (`#@` stripped). |
| 4 | `data.bin` (binary) | `Inspect #@data.bin` | Binary note block appended; no decoded garbage. |
| 5 | missing | `Fix #@nope.ts` | Token left verbatim; prompt otherwise unchanged; model handles. |
| 6 | directory | `List #@src/` | Token left verbatim. |
| 7 | mid-word | `the foo#@bar thing` | **No** expansion (`#@` preceded by word char). |
| 8 | markdown/issue | `# Heading and #1234` | **No** expansion (no `#@`). |
| 9 | multi | `Diff #@a.ts vs #@b.ts` | Both injected; notify says `2 file(s)`. |
| 10 | tilde | `Read #@~/notes.md` | Expanded; injected. |
| 11 | trailing punct | `See #@a.ts.` | Period trimmed; `a.ts` injected. |
| 12 | initial CLI message | `pi -p "Review #@a.ts"` (extension loaded) | `a.ts` injected in the `-p` run too (input event fires for initial message). |
| 13 | format parity | compare `#@a.ts` output vs `pi @a.ts "x"` CLI output | Both emit `<file name="/abs/a.ts">\n<content>\n</file>` with identical content. |
| 14 | `@` unaffected | `Review @a.ts` (interactive) | `@a.ts` left as literal text (Pi's existing behavior preserved); no injection by this extension. |

### Automated sanity check (optional)

```ts
pi.registerCommand("sharp-at-test", {
  description: "Self-test for #@ injection",
  handler: async (_args, ctx) => {
    // create temp text + binary files, run injectFiles() on sample strings,
    // assert: text injected, binary noted, missing left, email/mid-word not matched.
    ctx.ui.notify("sharp-at self-test passed", "info");
  },
});
```

---

## 12. Implementation Notes & Gotchas

1. **Loop prevention is mandatory.** Always `return { action: "continue" }` for `event.source === "extension"`. Without it, any extension (including this one via `sendUserMessage` paths) that re-feeds `#@` text would loop infinitely.
2. **Skip steering for latency.** `event.streamingBehavior === "steer"` mid-stream → `continue` (mirrors `input-transform-streaming.ts`). `followUp` and normal idle input are processed.
3. **Zero-width anchor.** `m[0]` is exactly `#@<path>`; the `(^|(?<=\W))` consumes nothing. No leading-char bookkeeping.
4. **`includes("#@")` pre-check.** Cheap guard before touching the regex / doing I/O for the common no-`#@` case.
5. **Never throw out of the handler.** Wrap all `stat`/`readFile`/`resizeImage` in try/catch; on any error leave the token verbatim and continue. A prompt must never be lost.
6. **`resizeImage` takes `Uint8Array`.** Wrap explicitly: `new Uint8Array(buf)`.
7. **Images are base64, no data-URL prefix.** `ImageContent.data` is raw base64.
8. **Image resize is a necessity, not a config.** Providers reject oversized images; `resizeImage` (2000×2000 default) is hardcoded so injection actually succeeds. This does not contradict "no config" — it's required for correctness, and the user still gets "the whole image" (downscaled to fit).
9. **Binary detection is for routing, not gating.** Use the NUL-byte heuristic *only* to avoid injecting decoded garbage from non-image binaries. Image files skip this check entirely (handled by MIME type first).
10. **Append, don't inline-replace; strip the trigger.** Large files would wreck the transcript bubble. Append blocks below a `---`, and strip `#@` from each injected marker (the path stays as the reference). Failed tokens are left verbatim, `#@` included.
11. **Entire file, always.** Do not add truncation, word counts, or byte limits anywhere. The one defining behavior of `#@` is "the whole file, every time." If you feel tempted to add a cap, re-read §13 — the cap is a *different feature* (`@` with size-gating), not this one.
12. **Don't touch `@`.** This extension must not match or transform bare `@path`. Only `#@path`. Verify with test #14.

---

## 13. Design Rationale & Tradeoffs

### 13.1 Why unconditional (no size gate)
The user explicitly wants **"inject the entire file every time. No maxWords, no config."** This is the point of `#@`: a single, predictable affordance whose contract is "whatever file I name, the model gets all of it." Gating it would make it a worse `@`-with-config rather than a distinct tool.

### 13.2 The tradeoff (be honest about it)
Unconditional injection means a careless `#@` on a huge file can **blow the context window** or trigger a provider error. This is accepted:
- It's the user's explicit, deliberate action (they typed `#@`, a non-default symbol).
- For partial/large reads, the `read` tool (with `offset`/`limit`) already exists and remains the right tool.
- The whole reason `#@` is a *separate* symbol from `@` is so this unconditional behavior is opt-in by syntax and never surprises someone who just typed `@`.

### 13.3 Why a separate symbol instead of reusing `@`
- `@` is overloaded (autocomplete + CLI inject). Overloading it further with "inject whole file interactively" would be ambiguous and would change existing behavior.
- `#@` is unambiguous, collision-free (§3.2), and signals stronger intent — the `#` reads as "force/sharp/inject."
- The `#` does **not** piggyback on Pi's `@` autocomplete on its own — Pi's file-completion gate only fires for `@` at a token boundary, and `#` glued in front closes it. Path completion for `#@` is provided by a separate autocomplete provider (see §14).

### 13.4 Why no config
Configuring this feature would defeat its purpose. The contract is "always, entirely." Adding knobs (size, format, image toggle) reintroduces exactly the complexity the user asked to remove. If size-gated injection is later wanted, that is the *other* extension (`@` with a threshold), not this one.

### 13.5 Relationship to a possible future size-gated `@` extension
This PRD and a size-gated `@` extension are **complementary, not competing**:
- `#@file` → whole file, always (this PRD).
- `@file` (gated) → small files inline, large files delegate to `read` (the token-economics sweet-spot feature).

They can coexist: `#@` for "I know I want all of it," `@` for "inline it if it's small."

---

## 14. Interactive Path Autocomplete (TUI)

`#@` is a two-character trigger, and Pi's built-in `@` file-completion (gitignore-aware, powered by
`fd`) only fires when `@` sits at a token boundary. A `#` glued immediately in front of the `@`
closes that gate, so — out of the box — typing `#@` yields **no** path suggestions; the user must
type the full path by hand.

### 14.1 Hook

Pi exposes `ctx.ui.addAutocompleteProvider(factory)` (TUI/RPC modes only; see Pi's
`docs/extensions.md` → "Autocomplete Providers"). The factory wraps the built-in provider (received
as `current`) and can override three levers: `getSuggestions`, `applyCompletion`, and
`shouldTriggerFileCompletion` (the gate). The extension registers it on `session_start`, guarded for
headless print/json modes. This is purely a TUI affordance — headless `pi -p "...#@file..."` is
unaffected (the user types the full path; injection still runs via the `input` handler).

### 14.2 Implementation (shipped) — line-rewrite reuse (Option 1)

**Option 2 (gate override) was tried first and rejected.** Overriding only
`shouldTriggerFileCompletion` to return `true` at `#@<partial>` (delegating the rest to the built-in)
produced **no suggestions**: Pi's built-in `@`-query extraction is itself boundary-strict
(`CombinedAutocompleteProvider.extractAtPrefix` requires `@` at a token boundary), so opening the
gate alone is insufficient. Reverted.

**Shipped: Option 1 — line-rewrite reuse.** In `getSuggestions`, detect `#@<partial>` at the cursor,
rewrite that one `#` into a space (so the built-in sees a clean `@<partial>` at a valid boundary),
delegate to `current.getSuggestions(...)`, then remap the result back to `#@`: `prefix "@<partial>"`
→ `"#@<partial>"` and each item value `@<path>` → `#@<path>`. `applyCompletion` is implemented
inline for `#@` prefixes (deterministic replace, cursor placed after the inserted value) and
delegates otherwise; `shouldTriggerFileCompletion` delegates to the built-in unchanged. This reuses
Pi's entire file engine — gitignore-aware `fd` listing, sorting, fuzzy matching — with **zero**
reimplementation; only a one-character line rewrite and a prefix/value remap are added.

A last-resort **Option 4** (reimplement file listing via `fd`/`git ls-files`, à la Pi's
`github-issue-autocomplete` example) remains documented but was **not** needed — reuse through
`current` works.

### 14.3 Non-goal

No suffix-style `@<file>#` trigger. It would inherit Pi's `@` completion for free but demands a
trailing `#` the user must type (and often backspace an inserted boundary for), and it makes `#` a
suffix marker that collides with prose. `#@` (prefix) with a completion provider is strictly better.

---

## Appendix A — Minimal skeleton

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text?.includes("#@")) return { action: "continue" };

    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" };
    return { action: "transform" as const, text, images };
  });
}

// ... injectFiles() + helpers per §9 ...
```

**Companion file — `package.json`:** the skeleton above is the whole extension, but the repo also
needs a `package.json` with a `"pi"` manifest so the *directory* is loadable (see §8). Without it,
`pi install .` / `-e <dir>` / a package registration all fail with `Cannot find module '<dir>'`:

```json
{ "name": "pi-auto-reader", "version": "0.1.0", "private": true, "type": "module",
  "pi": { "extensions": ["sharp-at-file.ts"] } }
```

**Done-definition:** all 14 manual test cases in §11 pass; no uncaught errors; the model receives whole-file contents with **zero** `read` tool calls for `#@`-injected files; prompts without `#@` (including bare `@file`) are byte-for-byte unchanged; `#@` works in both interactive and initial `-p` messages.
