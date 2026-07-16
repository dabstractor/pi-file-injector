# Research: Pi Extension API Surface Validation

Validated against `@earendil-works/pi-coding-agent` **v0.80.8** at
`/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/`.

## Verdict: ALL API usage in file-injector.ts is VALID

## (1) Exports — all 5 present ✓
| Name | Kind | Source module |
|------|------|---------------|
| `resizeImage` | function | `./utils/image-resize.ts` |
| `formatDimensionNote` | function | `./utils/image-resize.ts` |
| `ResizedImage` | type | `./utils/image-resize-core.d.ts` |
| `CONFIG_DIR_NAME` | const | `./config.ts` |
| `getAgentDir` | function | `./config.ts` |
| `ExtensionAPI` | type | `./core/extensions/index.ts` |

### Signatures
```ts
resizeImage(inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions): Promise<ResizedImage | null>;
formatDimensionNote(result: ResizedImage): string | undefined;
interface ResizedImage { data: string; mimeType: string; originalWidth: number; originalHeight: number; width: number; height: number; wasResized: boolean; }
```

## (2) `input` event contract — EXACT match ✓
Source: `dist/core/extensions/types.d.ts`
```ts
interface InputEvent { type: "input"; text: string; images?: ImageContent[]; source: "interactive" | "rpc" | "extension"; streamingBehavior?: "steer" | "followUp"; }
type InputEventResult = { action: "continue" } | { action: "transform"; text: string; images?: ImageContent[] } | { action: "handled" };
```

## (3) Context surface — all 5 members exist ✓
| Member | Declaration | Status |
|--------|-------------|--------|
| `ctx.getContextUsage()` | `(): ContextUsage \| undefined` | ✓ |
| `ctx.isProjectTrusted()` | `(): boolean` | ✓ |
| `ctx.hasUI` | `boolean` | ✓ |
| `ctx.ui.notify(msg, type?)` | `(message: string, type?: "info"\|"warning"\|"error"): void` | ✓ |
| `ctx.ui.addAutocompleteProvider(factory)` | `(factory: AutocompleteProviderFactory): void` | ✓ |
| `ctx.cwd` | `string` | ✓ |
| `ctx.model` | `Model<any> \| undefined` (has contextWindow, maxTokens) | ✓ |

### ContextUsage
```ts
interface ContextUsage { tokens: number | null; contextWindow: number; percent: number | null; }
```

## Conclusion
No API risk. Every import, event field, return type, and context member used by file-injector.ts is
present and correctly typed in the installed package.
