## 7. Technical Reference (verified APIs)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
  resizeImage,          // (bytes: Uint8Array, mime: string, opts?) => Promise<ResizedImage | null>
  formatDimensionNote,  // (resized: ResizedImage) => string | undefined
  CONFIG_DIR_NAME,      // project-local config dir name (".pi") — §4.6 config path
  getAgentDir,          // global agent config dir (~/.pi/agent) — §4.6 config path
  // §6.3 display helpers (all exported from the package):
  highlightCode,        // (code: string, lang: string) => string[] — syntax-highlight expanded code
  getLanguageFromPath,  // (path: string) => string | undefined — detect language for highlighting
} from "@earendil-works/pi-coding-agent";
// §6.3 the Component types the MessageRenderer returns (the example extensions import these):
import { Box, Text, Markdown, type Component } from "@earendil-works/pi-tui";
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
Calling `resizeImage(bytes, mime)` with no options caps to **2000×2000** (matches Pi's `images.autoResize` default). Returns `null` if it can't process. The `width`/`height` fields feed the image-token estimate (§5.6.2).

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

**`before_agent_start` event contract (delivery — §6.2):**
```ts
interface BeforeAgentStartEvent {
  type: "before_agent_start";
  prompt: string;            // the (already input-transformed, skill/template-expanded) user text
  images?: ImageContent[];   // attached images
  systemPrompt: string;
  systemPromptOptions: BuildSystemPromptOptions;
}
interface BeforeAgentStartEventResult {
  message?: {                // SINGULAR — one per handler; all files for a prompt pack into this one message
    customType: string;      // "fileInjector.injected"
    content: string | Content[];  // → <file> blocks; sent to the LLM (convertToLlm: role "custom" → user)
    display?: boolean;       // true → render in TUI via the registered renderer
    details?: unknown;       // { files: FileDetail[] } — renderer metadata, NOT sent as extra model text
  };
  systemPrompt?: string;     // (unused by this extension)
}
pi.on("before_agent_start", async (event, ctx) => {
  // read + clear the stash populated by the input handler; return the custom message or undefined
});
```
Verified in `prompt()`: the returned `message` is pushed onto the turn's message list **after** the user message, emitted as a `message_start`/`message_end` (role `"custom"`), and persisted via `appendCustomMessageEntry`. `emitBeforeAgentStart()` aggregates one `message` per handler across extensions. Returning `undefined` (no stash) is a no-op.

**`registerMessageRenderer` + renderer contract (display — §6.3):**
```ts
type MessageRenderer<T = unknown> = (
  message: CustomMessage<T>,
  options: { expanded: boolean },   // mirrors the global ctrl+o toggle, like [skill] blocks
  theme: Theme,                     // Pi Theme: theme.fg(key, text), theme.bg(key, text), theme.bold(text)
) => Component | undefined;         // Component from @earendil-works/pi-tui (Box/Text/Markdown/…)
pi.registerMessageRenderer("fileInjector.injected", (message, { expanded }, theme) => {
  const files = (message.details as { files: FileDetail[] } | undefined)?.files ?? [];
  // build a Box(theme.bg("toolSuccessBg", t)) with one `read <path>` Text line per file,
  // and (when expanded) each file's highlighted/full content. See §6.3.
  return box;
});
```
Registered once on `session_start`. The `theme` argument is Pi's `Theme` (the same object `ToolExecutionComponent`/`SkillInvocationMessageComponent` use). Relevant theme keys: backgrounds `toolSuccessBg` (green, the read-tool look), `customMessageBg` (purple, skills — **not** used here); foregrounds `toolTitle`, `accent`, `dim`, `warning`, `toolOutput`. A thrown exception in the renderer is caught by `CustomMessageComponent`, which falls back to its default `[fileInjector.injected]` purple box — so the renderer must be defensive but cannot crash the TUI.

**`Component` constructors used (from `@earendil-works/pi-tui`):**
```ts
class Box       implements Component { constructor(paddingX?, paddingY?, bgFn?: (t: string) => string); addChild(c: Component); clear(); }
class Text      implements Component { constructor(text?: string, paddingX?, paddingY?, customBgFn?: (t: string) => string); setText(t: string); }
class Markdown  implements Component { constructor(text, paddingX?, paddingY?, mdTheme?, opts?); }   // for prose-y expanded content if desired
```
(Box applies `bgFn` to all rendered children — exactly how `ToolExecutionComponent` paints its green background.)

---

