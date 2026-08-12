# System Context — Delta 010 (URL Injection Implementation)

Verified against `file-injector.ts` (1359 lines, HEAD `90369d3`) + `package.json` + the spec
`spec/15-url-injection.md`. Supersedes the high-level `code_map.md` with verified line numbers
and API-grounded refinements. The `#@file` path is fully shipped and MUST stay byte-for-byte
identical (every existing test in the three suites must pass unchanged).

See also: `external_deps.md` for the defuddle/linkedom API research.

---

## 1. What does NOT exist yet (the delta)

`grep -n "URL_INJECT_RE\|URL_SHAPE_RE\|defuddle\|injectUrl\|enableUrls\|\"url\"" file-injector.ts`
returns **nothing**. `package.json` has **no `dependencies`** block (only `peerDependencies`).
The entire URL half is greenfield code on top of the shipped file injector.

## 2. Verified Integration Points (exact line numbers)

| Concern | Line | What changes for URLs |
|---|---|---|
| Imports | L1-9 | add `import { Defuddle } from "defuddle/node"; import { parseHTML } from "linkedom";` |
| Trigger regexes | L9-16 block | add `URL_INJECT_RE`, `URL_SHAPE_RE` AFTER `BARE_AT_RE` (L16) |
| `FileInjectorConfig` | L177 | add `enableUrls?: boolean;` to the existing single-field interface |
| `readConfig` | L196-218 | **no body change** — shallow-merge already passes through unknown keys |
| `cleanToken` | L91 | **reused verbatim** (exported) — strips trailing `TRAILING_PUNCT` from URL tokens too |
| `formatImageBlock` | L255 | **reused verbatim** by the URL image branch |
| `estimateImageTokens` | L707 | **reused verbatim** by the URL image branch |
| `FileDetail.kind` union | L437 | add `"url"` → `"text" \| "image" \| "binary" \| "paged" \| "url"` |
| `FileDetail` interface | L435-456 | no other field changes; `path` holds the URL for `kind:"url"` |
| `State` interface | L461-471 | **unchanged** (blocks/details/images/injectedSet/remaining/count/paged/bareAt already shared) |
| `subtract` | L474 | **reused verbatim** (internal) — URL budget subtraction |
| `readLine` | L803-818 | add a `url` branch BEFORE the final text-fallback `return` at L818 |
| `injectFile` image branch | L966-974 | the recipe (`resizeImage` + `state.images.push` + `formatImageBlock` + `estimateImageTokens` + `subtract`) the URL image branch mirrors |
| `injectFiles` signature | L1114 | add `enableUrls = true` as trailing param (after `bareAt = false`) |
| `injectFiles` URL loop | after L1184 (after `processTokenStream` call) | scan `URL_INJECT_RE`, test `URL_SHAPE_RE`, normalize, dedup, `await injectUrl` per surviving URL |
| `injectFiles` early return | L1186 | `state.count === 0` check already covers URL successes (count++ in injectUrl) |
| input handler pre-check | L1255 | broaden `!event.text?.includes("#@")` → `!event.text?.includes("#")` |
| input handler `injectFiles` call | L1257 | pass `cfg.enableUrls !== false` as the new 5th arg |
| module-level `cfg` | L1227 | already module-level; `cfg.enableUrls` read off it |

## 3. Three Architecture Refinements (from code + API research)

### Refinement 1: Regex form — Unicode lookbehind, not `\W`
The shipped `FILE_INJECT_RE` (L9) and `BARE_AT_RE` (L16) use:
```ts
const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
const BARE_AT_RE     = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
```
`URL_INJECT_RE` must match this convention:
```ts
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;
```
NOT the spec's literal `/(^|(?<=\W))#(?!@)(\S+)/g` (which uses `\W` + ASCII lookbehind). The
`(?!@)` negative lookahead keeps it disjoint with `#@`. The `u` flag is mandatory.

### Refinement 2: `enableUrls` default-true via `!== false`
`readConfig` (L196-218) returns `{}` when all sources are missing (existing contract). So
`cfg.enableUrls` is `undefined` by default. The gate must be `cfg.enableUrls !== false`
(default **enabled**), NOT `=== true`. This mirrors spec §4 "default `true`" and is
consistent with how `markdownBareAtImports === true` is the opt-IN gate (the inverse polarity).

### Refinement 3: Image-URL byte path — separate byte reader
The spec §8 pseudocode reads the body via `readBodyCapped` (returns a UTF-8 **string**) then
feeds image content-types through `Buffer.from(html, "utf8")`. Decoding binary image bytes as
UTF-8 **corrupts** them. The implementer must add a **byte-oriented** capped reader
(`readBytesCapped(res, cap): Promise<Buffer | null>`) for the `image/*` branch, then feed
raw bytes into the existing image recipe:
```ts
const buf = await readBytesCapped(res, URL_MAX_BYTES);   // Buffer, not string
if (!buf) return false;
const resized = await resizeImage(new Uint8Array(buf), mime);
state.images.push({ type: "image", data: resized?.data ?? buf.toString("base64"), mimeType: resized?.mimeType ?? mime });
state.blocks.push(formatImageBlock(url, resized));
state.details.push({ path: url, kind: "image", dimensionHint: ... });
subtract(state, estimateImageTokens(resized));
```
Text/HTML/JSON/XML keep the string reader (`readBodyCapped`).

### Refinement 4 (NEW from API research): defuddle linkedom polyfills
The spec says `parseHTML(html, { url })`. This is **wrong** — linkedom's `parseHTML` does not
accept `{ url }`. See `external_deps.md` §1 for the full finding. The correct pattern:
```ts
const { document } = parseHTML(html);    // NO { url } arg
const doc = document as any;
if (!doc.styleSheets) doc.styleSheets = [];                              // polyfill required by defuddle
if (doc.defaultView && !doc.defaultView.getComputedStyle)
  doc.defaultView.getComputedStyle = () => ({ display: '' });           // polyfill
if (url) doc.URL = url;
const result = await Defuddle(doc as Document, url, { markdown: true });
```
Without these polyfills, defuddle may throw when accessing `doc.styleSheets` or
`getComputedStyle`. This is confirmed from defuddle's own `src/utils/linkedom-compat.ts`.

## 4. Test Harness Constraints (for M2.T1)

- Tests load `file-injector.ts` via **jiti from the global pi package** with pi's alias map
  (`file-injector.test.mjs` L36-59). The alias map maps ONLY `@earendil-works/*` — it does
  NOT alias `defuddle`/`linkedom`. They MUST be real repo-root `node_modules` deps for jiti
  to resolve them at test time.
- `injectUrl` uses the global `fetch`. Tests MUST stub `globalThis.fetch` with deterministic
  `Response`-shaped objects and **never hit the network** in CI. Restore in `finally`.
- Direct pipeline calls: `mod.injectFiles(prompt, [], ctx, bareAt, enableUrls)` exercise the
  branch without the handler; set `enableUrls` explicitly for hermetic control.
- The test chain is `package.json` `scripts.test` — a `&&` chain of three `.mjs` files. The
  new `url-injection.test.mjs` chains in as the 4th.

## 5. Typecheck Constraints (for M1.T1.S4)

- `scripts/typecheck.mjs` runs `tsc --strict` with `moduleResolution: "Bundler"` and `paths`
  mapping only `@earendil-works/*`.
- New imports (`defuddle/node`, `linkedom`) resolve via Bundler resolution from repo-root
  `node_modules` (installed by M1.T1.S1).
- **Expected outcome:** types resolve cleanly (both packages ship `.d.ts`). The `declarations.d.ts`
  shim is a conditional fallback only — verify after `npm install` + `npm run typecheck`.