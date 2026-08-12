# External Dependency Research — defuddle / linkedom (API & type verification)

Verified against published npm tarballs `defuddle@0.19.2` and `linkedom@0.18.12`
(downloaded + inspected `dist/` source + `.d.ts`). This grounds the `injectUrl` pipeline
contract and corrects two assumptions in `spec/15-url-injection.md` / `code_map.md`.

## 1. defuddle (`defuddle/node` entry)

### Import + signature — CONFIRMED
```ts
// dist/node.d.ts
export declare function Defuddle(
  input: Document | string | { window: { document: Document; location: { href: string } } },
  url?: string,
  options?: DefuddleOptions
): Promise<DefuddleResponse>;
```
- `Defuddle` is an **async FUNCTION** (not a class) exported from `"defuddle/node"`.
  A separate `DefuddleClass` (the underlying class) is also exported, but we want the function.
- **`import { Defuddle } from "defuddle/node"`** is the correct import — VERIFIED.
- The 3-arg form `Defuddle(document, url, { markdown: true })` is valid (url is optional,
  options is optional). The node wrapper internally does
  `new DefuddleClass(doc, {...options, url}).parseAsync()` then `toMarkdown(result, options, url)`.

### Return shape — CONFIRMED (DefuddleResponse)
```ts
interface DefuddleMetadata { title: string; description: string; domain: string; favicon: string;
  image: string; language: string; parseTime: number; published: string; author: string;
  site: string; schemaOrgData: any; wordCount: number; }
interface DefuddleResponse extends DefuddleMetadata {
  content: string;              // extracted HTML by default; MARKDOWN when { markdown: true }
  contentMarkdown?: string;     // only populated when { separateMarkdown: true }
  extractorType?: string; metaTags?: MetaTagItem[]; debug?: DebugInfo; profile?: ...; variables?: ...;
}
```
- **When `markdown: true`, `result.content` is OVERWRITTEN with markdown** (verified in
  `dist/markdown.js` `toMarkdown`: `if (options.markdown) result.content = createMarkdownContent(result.content, url)`).
  → spec §3.2 reading `result.content` for the body is CORRECT.
- `result.title` is a **required `string`** (never undefined, may be empty `""`). The spec's
  `result.title ? ... : ...` guard is correct (empty string is falsy).

### ⭐ CRITICAL CORRECTION #1 — defuddle/node SHIPS TypeScript declarations
`dist/node.d.ts` exists and is wired through the `exports` map (`"./node": { types: "./dist/node.d.ts", ... }`)
AND `typesVersions`. **NO shim / `declarations.d.ts` is needed for defuddle.**
→ PRD risk #1 (M1.T1.S4) is largely mitigated for defuddle. linkedom also ships types (see §2).
The implementer should still RUN `npm run typecheck` after install (M1.T1.S4) to confirm, but the
expected outcome is "clean, no shim."

### Dependencies (justifies the 5 hard deps)
- `dependencies`: only `commander` (CLI).
- `optionalDependencies`: `linkedom ^0.18.12`, `turndown ^7.2.0`, `mathml-to-latex ^1.8.0`,
  `temml ^0.13.3`. **These versions EXACTLY match the PRD §5 planned hard dependencies.**
- `markdown.js` does `require("turndown")` at MODULE LOAD and `new TurndownService(...)` to build
  markdown. → **turndown MUST be installed for the node entry to even load.** Making it a hard dep
  of the file-injector package is correct (markdown:true breaks without it). This validates PRD §5's
  "optionality is defuddle's choice; from this package's perspective extraction-without-markdown is
  a broken feature."

### Version: `0.19.2` is the current `latest` dist-tag. ✓ (PRD plan `^0.19.2` is satisfied.)

## 2. linkedom (`parseHTML`)

### Import + signature — VERIFIED, but ⭐ CORRECTION #2 (arity)
```ts
// linkedom types/index.d.ts
export function parseHTML(html: any): Window & typeof globalThis;
```
- `parseHTML` takes **ONE argument** (`html`) and returns a `Window & typeof globalThis`.
  The Window object HAS a `.document` property, so `const { document } = parseHTML(html)` works.
- **The spec/code_map form `parseHTML(html, { url })` is WRONG for typecheck** — passing a 2nd arg
  to a function declared with 1 param is a TS2554 "Expected 1 arguments, but got 2" error under
  `--strict`. The implementer must use `parseHTML(html)` (one arg).
- linkedom **SHIPS types** (`types/index.d.ts`, wired via `"types": "./types/index.d.ts"`).
  → no shim needed for linkedom either.

### The URL must be set SEPARATELY (matches defuddle's own internal helper)
defuddle's internal `dist/utils/linkedom-compat.js` `parseLinkedomHTML` shows the canonical pattern:
```js
const { document } = parseHTML(html);          // ONE arg
const doc = document;
if (!doc.styleSheets) doc.styleSheets = [];     // polyfill defuddle internals expect
if (doc.defaultView && !doc.defaultView.getComputedStyle)
  doc.defaultView.getComputedStyle = () => ({ display: '' });  // polyfill
if (url) doc.URL = url;                          // base URL set here, NOT via a parseHTML arg
return document;
```
→ If the implementer parses with external linkedom `parseHTML(html)` and passes the raw Document
to `Defuddle`, they should **replicate these polyfills** (styleSheets, getComputedStyle, doc.URL=url)
to avoid breaking defuddle's internals.

### Implementation options for the HTML pipeline (decision for the plan)
1. **Pre-parse with external linkedom** (spec §3.2 recommendation, avoids deprecation): call
   `parseHTML(html)` → apply polyfills + set `doc.URL = url` → `Defuddle(document, url, {markdown:true})`.
   More code; future-proof against the deprecation removal.
2. **String input** (simplest): `Defuddle(html, url, {markdown:true})`. defuddle handles linkedom
   parsing + polyfills internally (its `parseLinkedomHTML`). BUT it is `@deprecated` ("removed in next
   major version") — not imminent at 0.19.2, but flagged.

Note on spec §8 pseudocode: it also has the `Buffer.from(html,"utf8")` image-bytes bug already
flagged in code_map.md refinement #3 — confirmed still present; the byte-reader fix stands.

## 3. Summary of corrections to feed the plan
| Assumption (spec/code_map) | Reality | Action |
|---|---|---|
| defuddle/node may lack `.d.ts` → need `declarations.d.ts` shim | **Ships `dist/node.d.ts`** | No shim expected; still run typecheck (M1.T1.S4) to confirm |
| linkedom may lack `.d.ts` | **Ships types** | No shim |
| `parseHTML(html, { url })` | `parseHTML(html)` — ONE arg; 2nd arg fails `--strict` | Use 1 arg; set `doc.URL = url` separately (mirror linkedom-compat) |
| `result.content` is markdown under `{markdown:true}` | CONFIRMED | No change |
| `result.title?: string` | `result.title: string` (required, may be empty) | Spec guard still correct |
| 5 dep versions | EXACTLY match defuddle's own optionalDependencies | No change |
| turndown needed for markdown | Required at module-load | Hard dep justified ✓ |

## 4. Files inspected (reproducible)
`npm pack defuddle@0.19.2` → `dist/node.{js,d.ts}`, `dist/types.d.ts`, `dist/markdown.js`,
`dist/utils/linkedom-compat.js`, `package.json`.
`npm pack linkedom@0.18.12` → `types/index.d.ts`, `package.json`.