# System Context — BUG-001 & BUG-002 Bugfix

## Project Overview
**pi-file-injector** is a Pi coding-agent extension that lets users attach entire files and URLs to
their prompt via `#@<path>` and `#<url>` trigger tokens. It is a single-file TypeScript module
(`file-injector.ts`, 1585 lines) loaded via jiti by the Pi extension loader.

## Architecture at a Glance

```
User Prompt ("edit #main.go and #@config.ts")
  │
  ▼
input handler (pi.on("input"))
  │  1. Short-circuit guards (extension source, steer, no '#')
  │  2. Call injectFiles(text, images, ctx, bareAt, enableUrls)
  │     ├── processTokenStream → #@file path (local file I/O)
  │     └── URL scan loop → #<url> path (network fetch via injectUrl)
  │  3. Build notify toast
  │  4. Stash blocks+details in `pending` (closure)
  │
  ▼
before_agent_start handler (pi.on("before_agent_start"))
  │  Publish stashed blocks as a custom message to the LLM
  │
  ▼
Model receives: user prompt (verbatim) + injected file/URL blocks
```

## Key Data Structures

### `injectFiles` return (file-injector.ts:1406-1417)
```ts
{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }
```
- `injected` — total successful deliveries (files + URLs combined; `state.count`)
- `paged` — subset of FILE deliveries that were head+directive (URLs never paged)
- `blocks` — the `<file name="…">…</file>` block strings
- `details` — per-delivery metadata with `kind: "text" | "image" | "binary" | "url"`

### `State` (file-injector.ts:488)
```ts
{ blocks, details, images, injectedSet, remaining, count, paged, bareAt }
```
Shared across BOTH the `#@file` and `#<url>` paths — budget, dedup, and counters are coherent.

### `Ctx` (file-injector.ts:1028)
```ts
{ cwd, getContextUsage?, model?, hasUI?, ui?: { notify } }
```

## URL Detection Pipeline (the BUG-001 path)

```
URL_INJECT_RE (L25)          → candidate extraction (#<token>)
  ↓
cleanToken (L121)            → strip trailing punctuation
  ↓
URL_SHAPE_RE.test(tok) (L36) → shape gate (scheme OR dotted-host+alpha-TLD)
  ↓                          ← BUG-001: .go/.md/.py/.json all pass here
normalize to https:// (L1399)
  ↓
dedup on injectedSet (L1400)
  ↓
injectUrl (L821)             → fetch, dispatch by content-type, push block+detail
```

## Config Resolution (file-injector.ts:230-283)

Four sources, shallow-merged in precedence:
1. Global `~/.pi/agent/settings.json` → `fileInjector` key
2. Global `~/.pi/agent/file-injector.json` (whole file)
3. Project `<cwd>/.pi/settings.json` → `fileInjector` key (trusted only)
4. Project `<cwd>/.pi/file-injector.json` (whole file) (trusted only)

Config fields: `markdownBareAtImports?: boolean`, `enableUrls?: boolean` (default true).

Loaded once on `session_start`, cached in module-level `cfg`.

## Test Architecture

- **Zero-dependency standalone ESM** — no test framework. Each `.mjs` is run directly with `node`.
- **jiti loader** — loads the REAL `file-injector.ts` via global pi package's nested jiti + alias map.
- **`runCase(n, name, fn)`** — the test runner pattern (try/catch, passed/failed counters, matrix).
- **`globalThis.fetch`** stubbed per-test with `try/finally` restore.
- **Test files:** file-injector.test.mjs (159 cases), url-injection.test.mjs (21 cases),
  relative-imports.test.mjs (38 cases), import-behavior.test.mjs (21 cases). Total: 239.

## External Dependencies
- `defuddle` — HTML content extraction (markdown output)
- `linkedom` — DOM parser (polyfilled for defuddle)
- `@earendil-works/pi-coding-agent` — Pi SDK (resizeImage, highlightCode, etc.)
- `@earendil-works/pi-ai` — ImageContent type
- `@earendil-works/pi-tui` — Box, Text, Component (UI rendering)

All three `@earendil-works` packages are GLOBAL peer dependencies, not installed locally.
defuddle/linkedom resolve from repo-root `node_modules`.

## Build/Test Commands
```
npm run typecheck    # node ./scripts/typecheck.mjs
npm test             # runs all 4 .mjs test files in sequence
```