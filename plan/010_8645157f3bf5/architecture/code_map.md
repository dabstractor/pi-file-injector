# Code Map — Delta 010 (URL Injection Implementation Grounding)

Verified against `file-injector.ts` (1359 lines) + `package.json` at HEAD (`90369d3`).
Prior research: `plan/009_0d85ac0b1b08/architecture/system_context.md` (verbatim-delivery refactor,
which is DONE and must stay byte-for-byte identical). The `#@file` path is fully shipped.

## What does NOT exist yet (the delta)
A grep for `URL_INJECT_RE | URL_SHAPE_RE | defuddle | injectUrl | enableUrls | "url"` in
`file-injector.ts` returns **nothing**. The URL feature is specced in `spec/15-url-injection.md`
only. `package.json` has **no `dependencies`** block (only `peerDependencies`). So the entire URL
half is greenfield code on top of the shipped file injector.

## Integration points in `file-injector.ts` (exact locations)

| Concern | Location | What changes for URLs |
|---|---|---|
| Imports | L1-9 | add `import { Defuddle } from "defuddle/node"; import { parseHTML } from "linkedom";` |
| Trigger regexes | L9-25 block | add `URL_INJECT_RE`, `URL_SHAPE_RE` (use the Unicode lookbehind `\p{L}\p{N}_` form + `u` flag to match the shipped `FILE_INJECT_RE`/`BARE_AT_RE`, NOT the literal `\W` form) |
| `FileInjectorConfig` | L177 | add `enableUrls?: boolean;` |
| `readConfig` | L196-227 | **no body change** — shallow-merge already passes through unknown keys; the DEFAULT is enforced at the call site (`!== false`), not here (see note) |
| `formatImageBlock` / `estimateImageTokens` | L255 / ~L704 | reused verbatim by the URL image branch |
| `FileDetail.kind` union | L448 | add `"url"` |
| `State` | L461-471 | unchanged (blocks/details/images/injectedSet/remaining/count/paged/bareAt already shared) |
| `injectFile` image branch | L966-975 | the `resizeImage` + `state.images.push` + `formatImageBlock` + `estimateImageTokens` recipe the URL image branch mirrors |
| `readLine` | L803-818 | add a `url` branch (identical to the text branch but NO `tildify` — pass `d.path` raw; URLs are not home-relative) |
| `injectFiles` entry | L1114 | add `enableUrls = true` param (mirrors the existing `bareAt` seam); insert the URL scan+inject loop after `processTokenStream` (shares `state`) |
| input handler pre-check | L1255 `!event.text?.includes("#@")` | must broaden to cover `#<url>` (which has no `#@`); see note below |
| input handler `injectFiles` call | L1257 | pass `cfg.enableUrls !== false` as the new arg |
| module-level `cfg` | L1226-1228 | already module-level (shared session_start→input); `enableUrls` read off it |

### Pre-check note
L1255 short-circuits when there is no `#@`. A URL-only prompt (`#example.com`) has no `#@` and would
be skipped. The cleanest broadening: `if (!event.text?.includes("#")) return { action: "continue" };`
— both triggers contain `#`. (`#` is common in markdown, but this is only a pre-check; the regex +
`URL_SHAPE_RE` do the real filtering, and the URL scan is additionally gated on
`enableUrls !== false`.)

### `enableUrls` default-true note
`readConfig` returns `{}` when sources are missing (existing contract). So `cfg.enableUrls` is
`undefined` by default. The gate must therefore be `cfg.enableUrls !== false` (default **enabled**),
NOT `=== true`. This mirrors the spec §4 "default `true`".

## Image-URL byte-path refinement (spec pseudocode is buggy here)
`spec/15-url-injection.md` §8 reads the body via `readBodyCapped` (returns a UTF-8 **string**) then
feeds image content-types through `Buffer.from(html, "utf8")`. Decoding binary image bytes as UTF-8
**corrupts** them. The implementer must add a **byte-oriented** capped reader (returns `Buffer`,
aborts at `URL_MAX_BYTES`) for the `image/*` content-type branch, then feed those raw bytes into the
existing image recipe (`resizeImage(new Uint8Array(buf), mime)` → `state.images.push` →
`formatImageBlock` → `estimateImageTokens` → `subtract`). Text/HTML/JSON/XML keep the string reader.

## Test harness (hermetic URL tests)
- Tests load `file-injector.ts` via **jiti from the global pi package** with pi's alias map
  (`file-injector.test.mjs` L36-59). The alias map does NOT alias `defuddle`/`linkedom`, so they must
  be **real installed deps** in the repo-root `node_modules` for jiti to resolve them at test time.
- `injectUrl` uses the global `fetch`. Tests must stub `globalThis.fetch` to return deterministic
  `Response`-shaped objects (HTML / JSON / image bytes / oversized `Content-Length` / non-2xx) and
  must **never hit the network** in CI. Restore the real `fetch` in a `finally`.
- Direct pipeline calls `mod.injectFiles(prompt, [], ctx, bareAt, enableUrls)` exercise the branch
  without the handler; set `enableUrls` explicitly (default `true`) for hermetic control.

## Typecheck impact
`scripts/typecheck.mjs` runs `tsc --strict` with `paths` mapping only `@earendil-works/*`. New imports
(`defuddle/node`, `linkedom`) resolve via Bundler resolution from repo-root `node_modules`. **Risk:**
if either ships no `.d.ts`, tsc errors TS7016. Mitigation: add a `declarations.d.ts` with
`declare module "defuddle/node"; declare module "linkedom";` shims (verified shapes from spec §3.2/§8).
linkedom ships types; defuddle's node entry may need a shim — verify after `npm install`.

## package.json
Add a top-level `"dependencies"` block (spec §5 exact versions). Keep the existing
`peerDependencies`/`peerDependenciesMeta` for `@earendil-works/*` unchanged. `files` array currently
lists `file-injector.ts`, `README.md`, `LICENSE` — `npm` bundles `dependencies` from the registry at
install time, so no `files` change is needed for the deps themselves.