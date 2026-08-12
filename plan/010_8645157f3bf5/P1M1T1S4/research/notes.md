# Research Notes — P1.M1.T1.S4 (Typecheck-shim decision)

**Task**: Empirically verify whether `tsc --strict` (`moduleResolution: "Bundler"`)
resolves `defuddle/node` + `linkedom` types. Decide: native resolution vs.
`declarations.d.ts` shim. **This research was performed on the ACTUAL installed
packages** (deps installed by P1.M1.T1.S1 — Complete).

---

## VERDICT: Outcome (a) — types resolve NATIVELY. NO declarations.d.ts shim needed.

Both packages ship `.d.ts` and resolve cleanly under the typecheck script's
`moduleResolution: "Bundler"`. No `TS7016` ("Could not find a declaration file for
module") occurs for either specifier. The shim contract is therefore **not invoked**.

---

## 1. Baseline (today, before P1.M1.T2.S1 adds the imports)

- `npm run typecheck` → exit **0**, prints
  `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`.
- `grep -nE "defuddle|linkedom" file-injector.ts` → **no matches** (the imports do
  not exist yet — they arrive in P1.M1.T2.S1).
- ⚠️ **IMPORTANT CAVEAT**: a clean `npm run typecheck` TODAY proves *nothing* about
  defuddle/linkedom resolution, because `file-injector.ts` does not yet import them.
  The meaningful test is the **forward-looking probe** (§3 below), which adds the
  imports in a throwaway file and runs the same compiler options. That is the
  decision's real evidence.

---

## 2. Verified package.json declarations maps (the mechanism)

### defuddle 0.19.2 — `node_modules/defuddle/package.json`
```jsonc
"types": "dist/index.d.ts",
"typesVersions": { "*": { "node": ["dist/node.d.ts"], ... } },
"exports": {
  "./node": {
    "types": "./dist/node.d.ts",        // ← declarations for the subpath
    "import": "./dist/node.js"
  }
}
```

### linkedom 0.18.13 — `node_modules/linkedom/package.json`
```jsonc
"types": "./types/index.d.ts",
"exports": {
  ".": {
    "types": "./types/esm/index.d.ts",  // ← declarations
    "import": "./esm/index.js",
    "default": "./cjs/index.js"
  }
},
"typesVersions": { "*": { "cached": [...], "worker": [...] } }
```
(Note: installed `0.18.13` is within the PRD `^0.18.12` range — a patch bump.)

`moduleResolution: "Bundler"` honors `exports["..."].types`, so both specifiers
resolve to real `.d.ts` files. Confirmed by `--traceResolution` (§3).

---

## 3. The forward-looking probe (THE decision evidence)

A throwaway `.ts` placed at the **repo root** (so tsc's node-walk finds the repo's
`node_modules`), type-checked with a temp tsconfig mirroring `scripts/typecheck.mjs`
**exactly** (same `compilerOptions`, **no `paths` for defuddle/linkedom** — forcing
NATIVE exports-map resolution, which is what the task must verify). TS 5.6 (same as
the typecheck script pins).

### Probe source
```ts
import { Defuddle, type DefuddleResponse, type DefuddleOptions } from "defuddle/node";
import { parseHTML } from "linkedom";
export async function probe(html: string, url: string): Promise<DefuddleResponse> {
  const { document } = parseHTML(html);
  const opts: DefuddleOptions = { markdown: true, url };
  return Defuddle(document, url, opts);
}
```

### Result — `--traceResolution` excerpt (native resolution)
```
Resolving module 'defuddle/node' ... Found 'package.json' at '.../node_modules/defuddle/package.json'.
File '.../node_modules/defuddle/dist/node.d.ts' exists - use it as a name resolution result.
======== Module 'defuddle/node' successfully resolved to '.../node_modules/defuddle/dist/node.d.ts' (defuddle/dist/node.d.ts@0.19.2) ========
Resolving module 'linkedom' ... Found 'package.json' at '.../node_modules/linkedom/package.json'.
File '.../node_modules/linkedom/types/esm/index.d.ts' exists - use it as a name resolution result.
======== Module 'linkedom' successfully resolved to '.../node_modules/linkedom/types/esm/index.d.ts' (linkedom/types/esm/index.d.ts@0.18.13) ========
Resolving module './defuddle' from '.../node_modules/defuddle/dist/node.d.ts' -> '.../node_modules/defuddle/dist/defuddle.d.ts' OK
Resolving module './types'   from '.../node_modules/defuddle/dist/node.d.ts' -> '.../node_modules/defuddle/dist/types.d.ts' OK
```

### Exit code: **0** (0 errors). No TS7016. Both specifiers resolve natively.

> Earlier exploratory probe added a polyfill line `doc.styleSheets = []` which
> produced a single `TS2741` (`never[]` not assignable to `StyleSheetList`). That
> is a **consumer-code** type error in that throwaway line, NOT a missing-declaration
> error, and NOT relevant to the S4 decision (it is a P1.M1.T2.S1 implementation
> detail — the polyfill must be cast). The minimal probe above has no such line and
> compiles to **0 errors**. The decision turns on `TS7016`, which never appears.

---

## 4. REAL API shapes (for the fallback shim, IF ever needed — not needed now)

Sourced from the actual installed `.d.ts` (NOT guessed). Useful as the authoritative
contract for P1.M1.T2.S1's import usage, and as the faithful content for a shim if a
future environment ever hits TS7016.

### `defuddle/node` (`node_modules/defuddle/dist/node.d.ts` + `dist/types.d.ts`)
```ts
export declare function Defuddle(
  input: Document | string | { window: { document: Document; location: { href: string } } },
  url?: string,
  options?: DefuddleOptions
): Promise<DefuddleResponse>;
export { DefuddleClass, DefuddleOptions, DefuddleResponse };

interface DefuddleMetadata {
  title: string; description: string; domain: string; favicon: string; image: string;
  language: string; parseTime: number; published: string; author: string; site: string;
  schemaOrgData: any; wordCount: number;
}
interface DefuddleResponse extends DefuddleMetadata {
  content: string;            // ← the markdown when options.markdown === true
  contentMarkdown?: string;   // ← only when options.separateMarkdown === true
  extractorType?: string;
  metaTags?: MetaTagItem[];
  debug?: DebugInfo;
  profile?: Record<string, number>;
  variables?: { [key: string]: string };
}
interface DefuddleOptions {
  markdown?: boolean;         // "Convert output to Markdown. Defaults to false"
  url?: string;
  useAsync?: boolean;         // DEFAULT TRUE — site-specific extractors (YouTube/Reddit/HN)
  separateMarkdown?: boolean;
  // ...removeImages, debug, contentSelector, language, includeReplies, profile, fetch, etc.
}
```

### `linkedom` (`node_modules/linkedom/types/esm/index.d.ts`)
```ts
export function parseHTML(html: any, globals?: any): Window & typeof globalThis;
// usage: const { document } = parseHTML(html);
// ⚠️ parseHTML does NOT accept { url } — set document.URL = url AFTER parsing.
```

---

## 5. Decision summary (for downstream PRPs / implementers)

| Specifier         | Ships `.d.ts`? | Resolves natively (Bundler)? | Shim needed? |
|-------------------|----------------|------------------------------|--------------|
| `defuddle/node`   | ✅ (exports+typesVersions) | ✅ (0 errors) | **NO** |
| `linkedom`        | ✅ (exports+types)         | ✅ (0 errors) | **NO** |
| turndown / mathml-to-latex / temml | — (not imported directly) | n/a | NO |

**Outcome**: **(a) CLEAN**. `declarations.d.ts` is NOT created. Documentation
outcome = "none — types resolve natively under `moduleResolution: Bundler`".

P1.M1.T2.S1 may add `import { Defuddle } from "defuddle/node"` and
`import { parseHTML } from "linkedom"` directly; `npm run typecheck` will remain
green (the linkedom polyfill `doc.styleSheets = [] as unknown as StyleSheetList`
cast is the only type-care needed — that is T2.S1's concern, not S4's).