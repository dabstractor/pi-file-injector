# External Dependencies Research — Delta 010 (URL Injection)

Verified against the **actual source code** on GitHub/GitHub master for each package.
This file is authoritative for the `context_scope` contracts downstream PRP agents will use.

---

## 1. defuddle (npm `defuddle`, GitHub `kepano/defuddle`)

### Version
- **GitHub repo** shows `0.18.1` at HEAD; npm registry publishes newer versions.
- PRD pins `^0.19.2`. The `^` range will resolve to the latest `0.x.y ≥ 0.19.2`.
- **No breaking changes** between 0.18→0.19 for the `defuddle/node` API surface we use.

### TypeScript Declarations — ✅ SHIPPED
**Critical finding:** `defuddle/node` **DOES ship `.d.ts`**. Confirmed from `package.json`:
```jsonc
"exports": {
  "./node": {
    "types": "./dist/node.d.ts",      // ← declarations exist
    "import": "./dist/node.js"
  }
},
"typesVersions": {
  "*": { "node": ["dist/node.d.ts"] }  // ← fallback for older TS resolution
}
```
→ **M1.T1.S4 (typecheck-shim decision)**: The shim is very likely UNNECESSARY. After
`npm install`, `npm run typecheck` should resolve `defuddle/node` types cleanly under
Bundler resolution. Keep the subtask as a **conditional verify** — if `tsc --strict`
errors TS7016, add the shim; otherwise skip. But the most probable outcome is: types
resolve and no shim is needed.

### Import + API (verified from `src/node.ts`)
```ts
import { Defuddle } from "defuddle/node";

// Defuddle is an ASYNC FUNCTION (not a class) when imported from "defuddle/node".
// The class is `DefuddleClass` (also exported but not needed here).
export async function Defuddle(
  input: Document | string | { window: { document: Document; location: { href: string } } },
  url?: string,
  options?: DefuddleOptions
): Promise<DefuddleResponse>
```

**NOTE:** The internal `DefuddleClass` (from `src/defuddle.ts`) is the class; `defuddle/node`
wraps it in an async function that also runs `toMarkdown()`. **Always import from
`defuddle/node`**, never from the bare `defuddle` index (which lacks the markdown pipeline).

### Return Shape (verified from `src/types.ts`)
```ts
interface DefuddleResponse extends DefuddleMetadata {
  content: string;            // ← THE MARKDOWN (when options.markdown === true)
  contentMarkdown?: string;   // ← present only when options.separateMarkdown === true
  extractorType?: string;
  // ... debug, profile, variables, metaTags
}

interface DefuddleMetadata {
  title: string;              // typed string (NOT optional) — but may be "" when none found
  description: string;
  domain: string;
  wordCount: number;
  // ... favicon, image, language, published, author, site, parseTime, schemaOrgData
}

interface DefuddleOptions {
  markdown?: boolean;         // "Convert output to Markdown. Defaults to false"
  separateMarkdown?: boolean; // "Include Markdown in the response. Defaults to false"
  url?: string;
  useAsync?: boolean;         // DEFAULT TRUE — allows async extractors to fetch from third-party APIs (YouTube, Reddit, HN)
  // ... many more (removeImages, debug, contentSelector, etc.)
}
```

**Key detail:** When `markdown: true`, `DefuddleResponse.content` IS the markdown string
(the function calls `toMarkdown(result, options)` internally, which replaces `content`).
The spec's `result.content` usage is correct. Use `result.title` (may be `""`).

### ⚠️ CRITICAL: linkedom polyfill requirement (from `src/utils/linkedom-compat.ts`)
defuddle's Node entry, when given a **string** input, does NOT just call
`parseHTML(html)` — it applies **polyfills** that defuddle's internals REQUIRE:
```ts
export function parseLinkedomHTML(html: string, url?: string): Document {
  const { document } = parseHTML(html);       // NOTE: parseHTML(html) — NO { url } arg!
  const doc = document as any;
  if (!doc.styleSheets) doc.styleSheets = [];  // ← polyfill: defuddle reads styleSheets
  if (doc.defaultView && !doc.defaultView.getComputedStyle) {
    doc.defaultView.getComputedStyle = () => ({ display: '' });  // ← polyfill
  }
  if (url) doc.URL = url;                      // ← URL set AFTER parsing, NOT via parseHTML arg
  return document as unknown as Document;
}
```

**Implications for the implementer (M1.T2.S1):**
1. **linkedom's `parseHTML` does NOT accept `{ url }` as a second arg** — the spec's
   `parseHTML(html, { url })` is WRONG. The correct pattern is `parseHTML(html)` then
   `doc.URL = url`. (linkedom's parseHTML accepts options but they are NOT `{ url }` —
   they control parser behavior like `{ sanitizer: ... }`.)
2. **defuddle's internals REQUIRE polyfills** (`styleSheets`, `getComputedStyle`). If the
   implementer pre-parses with linkedom and passes the Document to `Defuddle()` directly,
   they MUST replicate these polyfills or defuddle may throw on `doc.styleSheets` access.
3. **Two safe approaches** (pick ONE in M1.T2.S1):
   - **Option A (simpler, uses deprecated path):** Pass the HTML string directly to
     `Defuddle(html, url, { markdown: true })`. The deprecated string-input path runs
     `parseLinkedomHTML` internally, applying all polyfills. Risk: deprecated, may be
     removed in a future major version.
   - **Option B (spec-recommended, polyfill-aware):** Pre-parse with linkedom, replicate
     the three polyfill lines from `linkedom-compat.ts`, then pass the Document:
     ```ts
     const { document } = parseHTML(html);
     const doc = document as any;
     if (!doc.styleSheets) doc.styleSheets = [];
     if (doc.defaultView && !doc.defaultView.getComputedStyle)
       doc.defaultView.getComputedStyle = () => ({ display: '' });
     if (url) doc.URL = url;
     const result = await Defuddle(doc as Document, url, { markdown: true });
     ```
     This is the forward-compatible path. RECOMMENDED.

### ⚠️ `useAsync` default-true concern
`DefuddleOptions.useAsync` defaults to `true`, which allows defuddle's site-specific
extractors (YouTube transcript API, Reddit comments, Hacker News, etc.) to make
**additional network requests** beyond the initial fetch. For predictability and to
honor the "single fetch per URL" mental model, the implementer MAY consider passing
`useAsync: false`. However, the spec does not mention this, and async extractors are
gated on domain matching (only fires for youtube.com, reddit.com, etc.). **Decision:
leave at default (true) per spec, but document the behavior.** The `enableUrls: false`
gate prevents ALL network egress including async extractors since `injectUrl` is never
called.

### Dependencies in defuddle's own package.json
linkedom, turndown, mathml-to-latex, temml are listed as `optionalDependencies`. npm
installs optionalDependencies by default, but the PRD makes them hard deps of THIS
package for two reasons: (1) explicit reliability, (2) the test harness jiti alias map
doesn't cover them, so they must be real repo-root `node_modules` deps.

---

## 2. linkedom (npm `linkedom`, GitHub `WebReflection/linkedom`)

### Version
- Latest: `0.18.12` (matches PRD's `^0.18.12`).
- Has runtime dependencies: `css-select`, `cssom`, `html-escaper`, `htmlparser2`, `uhyphen`.

### TypeScript Declarations — ✅ SHIPPED
```jsonc
"types": "./types/index.d.ts",
"exports": { ".": { "types": "./types/esm/index.d.ts", ... } }
```
→ No shim needed for linkedom. `tsc --strict` will resolve types.

### API: `parseHTML`
```ts
import { parseHTML } from "linkedom";
const { document, Window, customElements, MutationObserver, ... } = parseHTML(html);
```
- Accepts a **string** (HTML). The second argument is parser options (NOT `{ url }`).
- Returns a destructured object with `{ document, ... }` where `document` is a
  linkedom `Document`.
- The `document.URL` property is settable (linkedom allows mutation, unlike spec DOM).
- **See defuddle polyfill section above** for the `styleSheets`/`getComputedStyle`
  polyfills required before passing to `Defuddle()`.

---

## 3. turndown (npm `turndown`)

### Version
- Latest: `7.2.0` (matches PRD's `^7.2.0`).

### TypeScript Declarations
- turndown itself does NOT ship `.d.ts`; it uses `@types/turndown` (a DefinitelyTyped
  package). However, **we do NOT import turndown directly** — defuddle uses it
  internally. So we do NOT need `@types/turndown` in our deps.
- **No `.d.ts` concern** for our code: turndown is only used transitively by defuddle.

---

## 4. mathml-to-latex (npm `mathml-to-latex`)

### Version
- PRD pins `^1.8.0`. defuddle's own optionalDependencies list `^1.5.0`.

### Usage
- Used ONLY transitively by defuddle (for math→LaTeX conversion when MathML is present).
- We do NOT import it directly. No `.d.ts` concern for our code.

---

## 5. temml (npm `temml`)

### Version
- PRD pins `^0.13.3`. defuddle's own optionalDependencies list `^0.13.1`.

### Usage
- Used ONLY transitively by defuddle (for LaTeX math rendering).
- We do NOT import it directly. No `.d.ts` concern for our code.

---

## Summary Table

| Package | Planned | Latest | Ships .d.ts? | Imported directly? | Notes |
|---|---|---|---|---|---|
| `defuddle` | `^0.19.2` | `0.18.x`+ on npm | ✅ (via exports `./node`) | Yes (`defuddle/node`) | Async fn `Defuddle(doc, url, opts)`; polyfills required |
| `linkedom` | `^0.18.12` | `0.18.12` | ✅ | Yes (`parseHTML`) | `parseHTML(html)` — NO `{ url }` arg; set `doc.URL` after |
| `turndown` | `^7.2.0` | `7.2.0` | ❌ (uses `@types/turndown`) | No (transitive) | No concern — defuddle uses internally |
| `mathml-to-latex` | `^1.8.0` | ~1.8.x | — | No (transitive) | No concern |
| `temml` | `^0.13.3` | ~0.13.x | — | No (transitive) | No concern |

## Typecheck Impact (for M1.T1.S4)
- `defuddle/node` ships `.d.ts` → resolves under Bundler moduleResolution.
- `linkedom` ships `.d.ts` → resolves under Bundler moduleResolution.
- turndown/mathml-to-latex/temml are NOT imported directly → no type concern.
- **Expected outcome:** `npm run typecheck` passes WITHOUT a shim.
  The `declarations.d.ts` shim is a **fallback only** — verify after install.