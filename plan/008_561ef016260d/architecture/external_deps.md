# External Dependencies & Verified API Surface

## Pi packages (installed globally via `npm root -g`)

- `@earendil-works/pi-coding-agent` **v0.80.10** — the host extension runtime.
- `@earendil-works/pi-tui` **v0.80.10** — the TUI component library (nested dep of pi-coding-agent).

**Important:** The project has NO local `node_modules`. All imports resolve through the global root,
matching `scripts/typecheck.mjs` (`npm root -g`).

## Verified API claims (Plan 008 delta introduces these)

### 1. `before_agent_start` event + `BeforeAgentStartEventResult.message` ✅

```ts
// dist/core/extensions/types.d.ts
on(event: "before_agent_start",
   handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>): void;

interface BeforeAgentStartEvent {
  type: "before_agent_start";
  prompt: string;            // the already-transformed user text
  images?: ImageContent[];
  systemPrompt: string;
  systemPromptOptions: BuildSystemPromptOptions;
}

interface BeforeAgentStartEventResult {
  message?: Pick<CustomMessage, "customType" | "content" | "display" | "details">;
  systemPrompt?: string;
}
```

- `message.content` is `string | (TextContent | ImageContent)[]` — we use `string` (joined `<file>` blocks).
- `message.details` is `unknown` — we store `{ files: FileDetail[] }` there (renderer-only, model-invisible).
- Returning `undefined` is a no-op (no message appended).

### 2. `registerMessageRenderer` + `MessageRenderer` ✅

```ts
// dist/core/extensions/types.d.ts
registerMessageRenderer<T = unknown>(customType: string, renderer: MessageRenderer<T>): void;

type MessageRenderer<T = unknown> = (
  message: CustomMessage<T>,
  options: MessageRenderOptions,   // { expanded: boolean }
  theme: Theme,
) => Component | undefined;
```

### 3. `Theme` — class with `fg`/`bg`/`bold` ✅ (CRITICAL NUANCE)

```ts
class Theme {
  fg(color: ThemeColor, text: string): string;   // FOREGROUND colors
  bg(color: ThemeBg, text: string): string;       // BACKGROUND colors
  bold(text: string): string;
}
```

**`toolSuccessBg` is `ThemeBg`** → must use `theme.bg("toolSuccessBg", text)`.
**`toolTitle`, `accent`, `dim`, `toolOutput`, `warning` are `ThemeColor`** → must use `theme.fg(...)`.

Using `theme.fg("toolSuccessBg", ...)` is a **type error** (`"toolSuccessBg"` not in `ThemeColor` union).

### 4. pi-tui `Box`, `Text`, `Component` ✅

```ts
// @earendil-works/pi-tui/dist/components/box.d.ts
class Box implements Component {
  constructor(paddingX?, paddingY?, bgFn?: (text: string) => string);
  addChild(component: Component): void;
  setBgFn(bgFn?: (text: string) => string): void;
  clear(): void;
  render(width: number): string[];
}

// @earendil-works/pi-tui/dist/components/text.d.ts
class Text implements Component {
  constructor(text?: string, paddingX?, paddingY?, customBgFn?: (text: string) => string);
  setText(text: string): void;
  setCustomBgFn(fn?: (text: string) => string): void;
  render(width: number): string[];
}

// @earendil-works/pi-tui/dist/tui.d.ts
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
}
```

`Box` applies `bgFn` to ALL rendered children — exactly how `ToolExecutionComponent` paints its green bg.

### 5. `highlightCode` + `getLanguageFromPath` ✅

```ts
// pi-coding-agent dist/modes/interactive/theme/theme.d.ts
function highlightCode(code: string, lang?: string): string[];   // ANSI-styled lines array
function getLanguageFromPath(filePath: string): string | undefined;
```

Both re-exported from `dist/index.d.ts`.

### 6. Already-imported APIs (unchanged, confirmed valid) ✅

```ts
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage }
  from "@earendil-works/pi-coding-agent";
```

## Runtime semantics (type-only audit — NOT runtime-verified)

The following are documented Pi behaviors relied upon but not runtime-tested:
- `convertToLlm()` maps `role:"custom"` → user-role message (so the custom message reaches the LLM).
- `prompt()` runs `input` → ... → `before_agent_start` → `runAgentPrompt` sequentially (no race on the `pending` stash).
- A thrown `MessageRenderer` is caught by `CustomMessageComponent`, falling back to Pi's default box.
- `appendCustomMessageEntry` persists the custom message for session reload.

## New imports needed (file-injector.ts L1-6)

```ts
// ADD to the existing pi-coding-agent import:
import { resizeImage, formatDimensionNote, highlightCode, getLanguageFromPath, CONFIG_DIR_NAME, getAgentDir, type ResizedImage }
  from "@earendil-works/pi-coding-agent";

// NEW import line (first pi-tui import in this file):
import { Box, Text, type Component } from "@earendil-works/pi-tui";
```
