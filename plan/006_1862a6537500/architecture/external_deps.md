# External Dependencies — Pi Extension API Surface

Validated against `@earendil-works/pi-coding-agent` **v0.80.8** installed at
`/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/`.

## Exported APIs (all CONFIRMED present)

| Import | Kind | Source module | Status |
|--------|------|---------------|--------|
| `resizeImage` | function | `./utils/image-resize.ts` | ✓ exported (types + runtime) |
| `formatDimensionNote` | function | `./utils/image-resize.ts` | ✓ exported (types + runtime) |
| `ResizedImage` | type | `./utils/image-resize-core.d.ts` | ✓ exported (type-only, correctly erased from runtime) |
| `CONFIG_DIR_NAME` | const | `./config.ts` | ✓ exported (types + runtime) |
| `getAgentDir` | function | `./config.ts` | ✓ exported (types + runtime) |
| `ExtensionAPI` | type | `./core/extensions/index.ts` | ✓ exported |

### Signatures
```ts
resizeImage(inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions): Promise<ResizedImage | null>;
formatDimensionNote(result: ResizedImage): string | undefined;
interface ResizedImage { data: string; mimeType: string; originalWidth: number; originalHeight: number; width: number; height: number; wasResized: boolean; }
```

## `input` Event Contract (CONFIRMED exact match)

Source: `dist/core/extensions/types.d.ts`

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

## ExtensionContext Members (all CONFIRMED present)

| Member | Declaration | Status |
|--------|-------------|--------|
| `ctx.getContextUsage()` | `(): ContextUsage \| undefined` | ✓ non-optional |
| `ctx.isProjectTrusted()` | `(): boolean` | ✓ non-optional |
| `ctx.hasUI` | `boolean` | ✓ field |
| `ctx.ui.notify(msg, type?)` | `(message: string, type?: "info"\|"warning"\|"error"): void` | ✓ |
| `ctx.ui.addAutocompleteProvider(factory)` | `(factory: AutocompleteProviderFactory): void` | ✓ |
| `ctx.cwd` | `string` | ✓ field |
| `ctx.model` | `Model<any> \| undefined` | ✓ (has `contextWindow`, `maxTokens`) |

### ContextUsage shape
```ts
interface ContextUsage { tokens: number | null; contextWindow: number; percent: number | null; }
```

## AutocompleteProvider shape
From `@earendil-works/pi-tui/dist/autocomplete.d.ts`:
```ts
interface AutocompleteProvider {
  triggerCharacters?: string[];
  getSuggestions(lines, cursorLine, cursorCol, { signal, force? }): Promise<AutocompleteSuggestions | null>;
  applyCompletion(lines, cursorLine, cursorCol, item, prefix): { lines, cursorLine, cursorCol };
  shouldTriggerFileCompletion?(lines, cursorLine, cursorCol): boolean;
}
```

## Conclusion
**No API risk.** Every import, event field, return type, and context member used by
`file-injector.ts` is present and correctly typed in the installed package. The extension will
load and run against v0.80.8 (and the PRD's stated v0.80.7) without type or runtime errors.
