# Research Notes — P1.M1.T1.S1 (Extension scaffold)

## Task scope
Create `./sharp-at-file.ts` (project root = `/home/dustin/projects/pi-auto-reader`) with:
1. Full import surface per PRD §7.
2. Three module-level constants: `FILE_INJECT_RE` (§4.2), `MIME_BY_EXT` (§5.2), `TRAILING_PUNCT` (§4.3/§9).
3. Factory stub (Appendix A) registering an `input` handler that returns `{ action: "continue" }` (pass-through). T3.S2 replaces the body.

OUT OF SCOPE (later subtasks, same file): parsing helpers (S2), format blocks/binary detect (T2.S1), injectFiles (T3.S1), real handler logic (T3.S2).

## Verified facts (empirical, this machine)

### Regex behavior (PRD §4.2) — TESTED with Node
`const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;`
- `"Review #@a.ts"` → m[0]=`#@a.ts`, m[2]=`a.ts` ✓
- `"Diff #@a.ts vs #@b.md"` → both matched ✓
- `"the foo#@bar thing"` → NO match (mid-word, `#@` preceded by word char) ✓
- `"See #@a.ts."` → m[2]=`a.ts.` (trailing punct captured; cleanToken trims later) ✓
- `"# @file"` → NO match (space between `#` and `@`) ✓
- `"# Heading #1234"` → NO match ✓
- `"user@host.com"` → NO match ✓
- `"leading #@~/notes.md ok"` → m[2]=`~/notes.md` ✓
- Zero-width anchor `(^|(?<=\W))` consumes NOTHING → `m[0]` is EXACTLY `#@<path>`.
- Lookbehind `(?<=\W)` is supported by Node/jiti (modern V8). Confirmed transpiles + runs.

### TRAILING_PUNCT (PRD §4.3 / §9) — TESTED
`const TRAILING_PUNCT = ".,;:!?\")]}>'";`  → 12 chars: `. , ; : ! ? " ' ) ] } >`
- `\"` is an escaped double-quote inside the double-quoted JS string (the char is `"`).
- cleanToken loop: while last char ∈ TRAILING_PUNCT, slice it off.
  - `a.ts.` → `a.ts` ✓ ; `notes.md)` → `notes.md` ✓ ; `x)` → `x` ✓

### MIME_BY_EXT (PRD §5.2) — exact
```ts
{ png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp" }
```

### Pi version & paths
- `@earendil-works/pi-coding-agent` v0.80.7 at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`.
- `pi` binary at `/home/dustin/.local/bin/pi` (v0.80.7).
- Target file `./sharp-at-file.ts` does NOT exist yet (greenfield).
- `.gitignore` does NOT ignore `.ts` files or the project root — fine.

### Import virtualization (architecture/external_deps.md, VERIFIED)
Pi's jiti loader aliases `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` so a bare `.ts` extension imports them with NO local `package.json`/`node_modules`/`tsconfig`. Confirmed by loader.js analysis (architecture/extension_patterns.md §5):
`const jiti = createJiti(...); const module = await jiti.import(extensionPath, { default: true });`
Default export must be a function or load fails: `"Extension does not export a valid factory function"`.

### Unused imports are SAFE in scaffold
jiti is **transpile-only** (esbuild-style; strips types, no type-check, no `noUnusedLocals` enforcement). The scaffold imports `resizeImage`/`formatDimensionNote`/`os`/`fs`/`path` which are unused in the stub but REQUIRED by later subtasks (T2/T3) in the same single file. Including the full import surface now is intentional and correct — establishes the shared module-level structure. No lint/type-check step runs at load time.

## Canonical reference: inline-bash.ts
`examples/extensions/inline-bash.ts` — exact structure to mirror:
`export default function (pi: ExtensionAPI) { pi.on("input", async (event, ctx) => {...}) }`.
- Minimal form (Appendix A) for the stub: just `return { action: "continue" };`.

## Validation gate — VERIFIED WORKING (non-interactive, no model)
jiti transpile + factory-export check (passes without API key/model):
```
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./sharp-at-file.ts").href);
if (typeof mod.default !== "function") { console.error("FAIL"); process.exit(1); }
console.log("PASS: default export is", typeof mod.default);
'
```
Tested against a temp scaffold in /tmp → `PASS: default export is function`. ✓
Authoritative alternative: `pi -e ./sharp-at-file.ts` (launches TUI; confirms real loader accepts it).

## Contract compliance (exact import list — do not deviate)
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```
Factory stub (Appendix A verbatim body):
```ts
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```
