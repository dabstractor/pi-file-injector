# Research Notes — P1.M1.T2.S1 (injectUrl + helpers)

Grounded in: `file-injector.ts` (1381 lines, HEAD with S3 regexes already merged),
`package.json`, `scripts/typecheck.mjs`, `file-injector.test.mjs`, and the architecture
docs (`external_deps.md`, `defuddle-linkedom-research.md`, `code_map.md`). All facts below
were read directly from source unless marked "(from arch doc)".

## 1. Insertion point (exact, current line numbers)

- `estimateImageTokens` ENDS at **L735** (`}` then blank line).
- The renderer section starts at **L736** (`// ---------- §6.3 chat renderer`).
- → The four new functions (`injectUrl`, `readBodyCapped`, `readBytesCapped`, `formatUrlBlock`)
  go in the gap **L735→L736**, i.e. between the last helper and the renderer. This matches the
  contract's "after the existing helper functions, before the renderer section".

## 2. Imports (L1–8)

Current L1–8:
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, highlightCode, getLanguageFromPath, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { Box, Text, type Component } from "@earendil-works/pi-tui";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```
Add AFTER the `os` import, BEFORE the `FILE_INJECT_RE` const:
```ts
import { Defuddle } from "defuddle/node";   // async fn (not class) — arch Refinement A
import { parseHTML } from "linkedom";       // parseHTML(html) — ONE arg — arch Refinement B
```
**Verified present**: `node_modules/defuddle/dist/node.d.ts` + `node_modules/linkedom/types/esm/index.d.ts`
exist → S4's expected Outcome (a) holds (no shim). `npm run typecheck` will resolve both natively
under `moduleResolution: "Bundler"` (the temp tsconfig in `scripts/typecheck.mjs` adds `paths` ONLY
for `@earendil-works/*`; defuddle/linkedom resolve from repo-root `node_modules`).

## 3. Constants cluster (where the 4 URL constants go)

Paged constants live at **L46–50** (`PAGED_THRESHOLD`, `MARGIN`, `HEAD_CHARS`, `DEFAULT_RESERVE`,
`READ_LIMIT`); `IMAGE_FALLBACK_TOKENS` is ~L66. Put the new §3.3 URL constants block immediately
AFTER `IMAGE_FALLBACK_TOKENS` (still in the constants cluster, before `hasValidImageMagic` at L82).
This is **text-disjoint from S3's regex region (L20–34)** → no merge conflict with the parallel
sibling. Values (from contract + PRD §3.3/§8):
```ts
const URL_TIMEOUT_MS  = 20_000;       // §3.3 guard 1 — AbortController timeout
const URL_MAX_BYTES   = 1_000_000;    // §3.3 guard 2 — 1 MB download cap
const URL_MIN_CONTENT = 200;          // §3.4 SPA/empty-extraction floor
const BROWSER_UA      = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
```

## 4. Existing helpers to REUSE (do NOT redeclare)

| Helper | Line | Signature / role |
|---|---|---|
| `formatImageBlock(abs, resized)` | L277 | `'<file name="ABS">' + (hint ?? "") + '</file>'` — reused for image URL blocks |
| `estimateImageTokens(resized)` | L729 | tile formula `⌈w/512⌉·⌈h/512⌉·170+85`; `IMAGE_FALLBACK_TOKENS`(2805) when null |
| `resizeImage` | imported L3 | `resizeImage(new Uint8Array(buf), mime)` → `Promise<ResizedImage \| null>` (async Worker) |
| `formatDimensionNote` | imported L3 | `formatDimensionNote(resized)` → image dimension hint string |
| `subtract(state, cost)` | L496 | `if (remaining!==null) remaining = max(0, remaining-cost)` — budget mutator |
| `cleanToken(raw)` | L109 | trims TRAILING_PUNCT — used by the URL SCAN loop (**T2.S3**, NOT injectUrl) |
| `State` | L483 | `blocks/details/images/injectedSet/remaining/count/paged/bareAt` — NO new fields needed |
| `FileDetail` | L457 | `path/kind/chars/...` — injectUrl pushes `{path:url, kind:"url", chars}` + image details |

The injectFile **image branch (L966–975)** is the recipe the URL image path mirrors:
```ts
const resized = await resizeImage(new Uint8Array(buf), mime);
state.images.push({ type:"image", data: resized?.data ?? buf.toString("base64"), mimeType: resized?.mimeType ?? mime });
state.blocks.push(formatImageBlock(abs, resized));
state.details.push({ path:abs, kind:"image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined });
subtract(state, estimateImageTokens(resized));
```

## 5. FileDetail.kind union — T2.S1 MUST add `"url"`

Current union (L457): `kind: "text" | "image" | "binary" | "paged"`. injectUrl pushes
`kind: "url"` details → **TypeScript errors unless `"url"` is added**. T2.S1 is the PRODUCER and
runs BEFORE T2.S2, so **T2.S1 adds the `"url"` member** (one token) for its own typecheck.
- **SAFE**: every consumer of `d.kind` uses an `if`-chain with a default return — NO exhaustive
  `switch`/`assertNever`. Verified at L388 (`!==` filter), L807–808, L812, L828/831/834 (readLine).
  Adding `"url"` → a url detail renders via readLine's default `return read <path>` (tildify is a
  no-op on URLs). Acceptable until T2.S2 adds the explicit url renderer branch.
- **Reconciliation note for the merger**: plan assigned "FileDetail.kind 'url' union member" to
  T2.S2, but T2.S1 needs it to typecheck. T2.S1 adds the union member; T2.S2 then ONLY does the
  readLine renderer branch (the member is already present).

## 6. Ctx widening (for SPA fallback notify)

Local `Ctx` type (L852–857) has only `cwd` / `getContextUsage?` / `model?`. The REAL pi ctx
(already used in the input handler at **L1286/1291**: `if (ctx.hasUI) ctx.ui.notify(msg,"info")`)
has `hasUI` + `ui.notify`. injectUrl's SPA fallback (§3.4) needs these. **T2.S1 widens `Ctx`** by
adding two OPTIONAL fields (purely additive — injectFiles/processTokenStream/injectFile don't
reference them, so no breakage; the passed-in pi ctx structurally satisfies the widened type):
```ts
type Ctx = {
  cwd: string;
  getContextUsage?: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
  hasUI?: boolean;                                              // ← NEW (SPA fallback §3.4)
  ui?: { notify(message: string, level: string): void };        // ← NEW
};
```

## 7. Export decision — KEEP ALL FOUR PRIVATE (no test-file edits)

`file-injector.test.mjs` L136–156 enforces a **strict allowlist** (`ASSERTED_EXPORTS`, 21 names +
3 in `PURE_HELPERS_NOT_ASSERTED`). Any exported function not in the set → `npm test` FAILS. The
guard's own message sanctions two paths: (a) export + add typeof-assert + add to set, OR
**(b) keep PRIVATE (like `injectMarkdown`) and exercise via injectFiles**.

→ **Decision: keep `injectUrl`, `readBodyCapped`, `readBytesCapped`, `formatUrlBlock` PRIVATE.**
Rationale:
- `injectUrl` is the URL analog of `injectMarkdown` (an internal pipeline driver called from the
  main loop). injectMarkdown is asserted NOT exported + exercised via injectFiles. Same pattern.
- **ZERO edits to `file-injector.test.mjs`** → `npm test` stays green (module-surface unchanged).
- Consumed internally by T2.S3's URL loop (same module → no export needed).
- P1.M2.T1 (hermetic URL tests) exercises them via `injectFiles(prompt, [], ctx, bareAt, enableUrls)`
  with `globalThis.fetch` stubbed — exactly as `code_map.md` describes ("Direct pipeline calls
  `mod.injectFiles(...)` exercise the branch"). Works once T2.S3 wires the loop.
- T2.S1's behavioral validation is therefore DEFERRED to P1.M2.T1 (the dedicated test milestone);
  T2.S1's hard gate is `npm run typecheck` (which is meaningful here: proves the defuddle/linkedom
  imports resolve + the `doc as Document` cast + polyfill mutations typecheck under `--strict`).

## 8. The four refinements (from arch docs) — all honored in the PRP

- **A. Defuddle is an ASYNC FUNCTION** from `defuddle/node`, not a class: `await Defuddle(doc, url, {markdown:true})`.
  `result.content` IS the markdown when `markdown:true`; `result.title` is a required string (may be `""`).
- **B. `parseHTML(html)` takes ONE arg** — `parseHTML(html, {url})` is WRONG (TS2554 under --strict
  + linkedom ignores the 2nd arg). Set `doc.URL = url` AFTER parsing.
- **C. defuddle internals REQUIRE polyfills** on the linkedom document (from defuddle's own
  `src/utils/linkedom-compat.ts`): `if (!doc.styleSheets) doc.styleSheets = [];` and
  `if (doc.defaultView && !doc.defaultView.getComputedStyle) doc.defaultView.getComputedStyle = () => ({ display: '' });`.
  Without these defuddle may throw on `doc.styleSheets` access → caught by try/catch → verbatim
  (silent failure). Polyfilling makes extraction actually work.
- **D. Image path needs a BYTE reader** — the spec §8 pseudocode's `Buffer.from(html,"utf8")` on a
  string-decoded body CORRUPTS binary image bytes. `readBytesCapped` returns a raw `Buffer`
  (no `.toString`); `readBodyCapped` returns a UTF-8 string (for text/html/json/xml only).

## 9. Content-type dispatch + guard ordering (final logic)

```
image/*  → readBytesCapped → resizeImage(new Uint8Array(buf), cleanMime) →
           cost = estimateImageTokens(resized) → GUARD(cost) → push image+block+detail+subtract+count++
text/html OR sniffed '<' → readBodyCapped(string) → parseHTML(html) [1-arg] →
           polyfill doc (styleSheets/getComputedStyle) → doc.URL=url →
           Defuddle(doc, url, {markdown:true}) → md = result.content.trim() →
           if md.length < URL_MIN_CONTENT → SPA notify (ctx.hasUI? ctx.ui?.notify) → return false
           body = (title? `# title\n\n` : "") + md
text/plain|markdown|json|xml|*rss|*atom → readBodyCapped(string) → body = html (verbatim)
else → return false (PDF/octet-stream/…)
```
The 3 guards (§3.3): (1) `AbortController` 20s timeout; (2) `Content-Length > cap` → verbatim
(pre-download) + stream-abort at cap via the capped readers returning `null`; (3) over-budget:
`state.remaining !== null && cost > state.remaining` → verbatim (NO paging for URLs — read tool
can't fetch URLs). The over-budget guard applies to ALL injectable paths (text/html, raw-text,
image) — "before pushing". For the image path: resize FIRST (to get the precise tile cost), THEN
guard, THEN push. ALL paths wrapped in `try { … } catch { return false }` + `finally { clearTimeout(to) }`.

Gotcha: strip Content-Type params for the image mimeType — `ct` may be `"image/png; charset=utf-8"`;
use `const mime = ct.split(";")[0].trim();` for resizeImage + the image push. The `ct.startsWith(...)`
dispatch checks tolerate params (startsWith on the raw ct is fine).

## 10. Validation gates (verified executable)

- **`npm run typecheck`** → `node ./scripts/typecheck.mjs` → writes a temp tsconfig
  (`moduleResolution:"Bundler"`, `strict:true`, `skipLibCheck:true`, `files:[<repo>/file-injector.ts]`,
  `paths` for `@earendil-works/*` only) → `npx -p typescript@5.6 tsc --noEmit`. Exit 0 expected.
  This is the PRIMARY gate (proves imports resolve + strict type-correctness of the integration).
- **`npm test`** → `file-injector.test.mjs && import-behavior.test.mjs && relative-imports.test.mjs`.
  Loads via jiti from the GLOBAL pi package (the alias map does NOT alias defuddle/linkedom → they
  MUST be real repo-root node_modules deps, which S1 installed). Stays green because nothing is
  exported (module surface unchanged). Requires the global pi package for the jiti loader.
- Behavioral/dispatch tests are P1.M2.T1's job (runs after T2.S3 wires the loop).

## 11. Scope boundaries (what T2.S1 does NOT do)

- NOT the URL scan loop / `enableUrls` wiring → **T2.S3**.
- NOT the `readLine` url renderer branch → **T2.S2** (T2.S1 only adds the union member).
- NOT README / changeset docs → **P1.M2.T2.S1** ([Mode A] here = JSDoc only).
- NOT hermetic dispatch/guard tests → **P1.M2.T1.S1/S2**.
- Does NOT touch S3's regex region (L20–34), S4's decision (no source under Outcome a), or
  `file-injector.test.mjs` (kept green by keeping the 4 functions private).