# Delta PRD: URL Web-Content Injection (`#<url>`) — Implementation

**Status:** Draft · **Parent spec:** `spec/15-url-injection.md` (already written; this delta implements it)
**Builds on:** plan 008 (`#@file` shipped) + plan 009 (verbatim-delivery refactor, DONE) · **Artifact:** in-place edit of `file-injector.ts` + `package.json`

---

## 1. Delta Summary

The "Current PRD" adds a **second trigger** to the file-injector extension — `#<url>` — that fetches a
URL at prompt-submit, extracts main content via **defuddle**, converts to markdown, and injects it into
the model's context through the **same** `fileInjector.injected` custom message and green `read`-line
renderer that `#@file` already uses. The feature is **fully specced** in `spec/15-url-injection.md`
(commit `90369d3` split the PRD into `spec/` and wrote this file) but is **not implemented** in code:
`grep "URL_INJECT_RE|defuddle|injectUrl|enableUrls|\"url\"" file-injector.ts` returns nothing, and
`package.json` has no `dependencies` block.

This delta implements the URL half. It is a **medium feature addition** (new trigger, 5 hard deps,
~150-200 new LOC, a new test category, a README section) — not a structural rewrite. The entire
`#@file` path (plan 008/009) stays **byte-for-byte identical**.

### Size check (proportionality)
- Added requirement: 1 (the `#<url>` feature).
- Modified surfaces: `FileInjectorConfig` (+1 field), `FileDetail.kind` (+1 union member), `readLine`
  (+1 branch), `injectFiles` (+1 param + the URL loop), input-handler pre-check (broaden), `package.json`
  (+`dependencies`). All small, localized edits.
- Removed: none.
- → 1 phase, 2 milestones, 4 tasks, ~8 subtasks.

---

## 2. Scope Delta

### Added (implement)
- **`#<url>` trigger.** `URL_INJECT_RE` (a `#` not followed by `@`, at a boundary) +
  `URL_SHAPE_RE` (scheme OR dotted host with alpha TLD). Scheme-less matches fetched as `https://`.
  `#@` always wins for files (regexes are disjoint). (spec §2)
- **`injectUrl` pipeline.** `global fetch` (browser-ish UA, 20s `AbortController`, 1 MB stream cap) →
  content-type dispatch (HTML → defuddle→markdown; text/json/xml → raw; image → resize+attach; other →
  verbatim) → over-budget / empty-extraction (SPA, <200 chars) / any failure → **token left verbatim**.
  Dedup by absolute URL form. Subtract `ceil(body.length/4)` from the shared `state.remaining`.
  (spec §3, §8)
- **`enableUrls` config** (default **`true`**), joining `markdownBareAtImports` under the same four
  sources/precedence. `false` → URL tokens ignored entirely, **no network request made** (air-gapped
  opt-out). (spec §4)
- **`kind: "url"` in `FileDetail`** + a `url` branch in `readLine` (title + raw URL, no `tildify`, no
  range). (spec §6)
- **5 hard npm `dependencies`**: `defuddle`, `linkedom`, `turndown`, `mathml-to-latex`, `temml`
  (spec §5 exact versions). Bundled so the user installs nothing extra.

### Modified (implement)
- `injectFiles` gains an `enableUrls` param (default `true`, mirrors the existing `bareAt` seam) and a
  URL scan+inject loop sharing the existing `state`.
- Input handler: broaden the `!event.text?.includes("#@")` pre-check so URL-only prompts reach the
  engine; pass `cfg.enableUrls !== false` into `injectFiles`.
- `package.json`: add `dependencies`; keep `peerDependencies` for `@earendil-works/*`.

### Removed
- None.

### Unaffected (must stay identical)
- The entire `#@file` path: `FILE_INJECT_RE`/`BARE_AT_RE`, `scanTokens`, `processTokenStream`,
  `injectFile`, `injectMarkdown`, `emitText`, paging, budget, markdown transitive imports, dedup,
  the verbatim-prompt contract (plan 009), the autocomplete provider, `before_agent_start` delivery,
  `computeDetailOffsets`, the renderer's text/image/binary/paged branches. **No `#@`-behavior change
  is in scope** — every existing test in the three suites must stay green unchanged.

---

## 3. Architecture Grounding (reference, do not re-research)

See `plan/010_8645157f3bf5/architecture/code_map.md` for the exact line-numbered integration map and
three implementer-critical refinements derived from the shipped code:

1. **Regex form.** The shipped `FILE_INJECT_RE`/`BARE_AT_RE` use the Unicode lookbehind
   `(?<![\p{L}\p{N}_])` + `u` flag (NOT the spec's literal `\W`). `URL_INJECT_RE` must match that
   convention for consistency.
2. **`enableUrls` default-true.** `readConfig` returns `{}` when sources are missing (existing
   contract) → `cfg.enableUrls` is `undefined`. The gate is `cfg.enableUrls !== false`, not `=== true`.
3. **Image-URL byte path (spec §8 pseudocode is buggy).** `readBodyCapped` returns a UTF-8 *string*;
   `Buffer.from(html,"utf8")` corrupts binary image bytes. The image content-type branch needs a
   **byte-oriented** capped reader (returns `Buffer`) feeding the existing image recipe
   (`resizeImage(new Uint8Array(buf), mime)` → `state.images.push` → `formatImageBlock` →
   `estimateImageTokens` → `subtract`). Text/HTML/JSON/XML keep the string reader.

Test harness (from `file-injector.test.mjs` L36-59): tests load `file-injector.ts` via **jiti from the
global pi package** with pi's alias map. That map does **not** alias `defuddle`/`linkedom`, so they must
be real repo-root `node_modules` deps for jiti to resolve them at test time (consistent with adding the
deps). `injectUrl` uses the global `fetch`, so URL tests must stub `globalThis.fetch` hermetically.

---

## 4. Phase 1 — URL Web-Content Injection

### Milestone M1 — Engine + Dependencies

**Goal:** `#example.com` and `#https://example.com/x` fetch, extract via defuddle, and inject clean
markdown as part of the `fileInjector.injected` custom message, rendered as a green `read <url>` line;
all failure modes leave the token verbatim; `#@file` unchanged; `npm run typecheck` clean.

#### Task M1.T1 — Foundations: dependencies, config, detection regexes
Add the hard npm dependencies and install them; extend config; add the two URL detection constants.
These are prerequisites for M1.T2 (the pipeline imports `defuddle`/`linkedom` and won't typecheck/run
without the deps installed).

- **Subtask M1.T1.S1 — `package.json`: add `dependencies`; `npm install`.** Add a top-level
  `"dependencies"` block per spec §5 exact versions (`defuddle ^0.19.2`, `linkedom ^0.18.12`,
  `turndown ^7.2.0`, `mathml-to-latex ^1.8.0`, `temml ^0.13.3`). Keep `peerDependencies`/
  `peerDependenciesMeta` for `@earendil-works/*` unchanged. Run `npm install` and commit the resulting
  `package-lock.json`. Verify `pi install .`/`npm install` resolves the new deps (they come from the
  registry transitively). **Mode A docs:** none beyond `package.json`.
- **Subtask M1.T1.S2 — `FileInjectorConfig` + `enableUrls`; `readConfig` default handling.** Add
  `enableUrls?: boolean;` to `FileInjectorConfig` (L177). Do **not** change `readConfig`'s body — its
  shallow-merge already passes through the new key. The **default-true** semantics are enforced at the
  call sites via `cfg.enableUrls !== false` (code_map.md refinement #2). JSDoc the field as
  "default true; false disables all URL network egress (air-gapped opt-out)" (spec §4). **Mode A docs:**
  JSDoc on the field.
- **Subtask M1.T1.S3 — `URL_INJECT_RE` + `URL_SHAPE_RE` constants.** Add them in the regexes block
  (L9-25). Use the Unicode lookbehind form for `URL_INJECT_RE`
  (`/(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu`) for consistency with the shipped regexes (code_map.md
  refinement #1); `URL_SHAPE_RE` verbatim from spec §2.2. JSDoc both, noting the `(?!@)` disjointness
  with `#@` and the alpha-TLD/dot/scheme shape gate (so `#Heading`, `#1234`, `#fff`, `#3.14`, `#v1.2`
  are ordinary prose and left untouched). **Mode A docs:** JSDoc on both constants.
- **Subtask M1.T1.S4 — typecheck-shim decision.** After install, run `npm run typecheck`. If `defuddle/node`
  or `linkedom` lack `.d.ts` (TS7016), add a `declarations.d.ts` at repo root with typed shims for the
  shapes actually used (`Defuddle(document, url, { markdown: true })` → `{ title?: string; content: string }`;
  `parseHTML(html, opts?) → { document }`). linkedom ships types; defuddle's node entry is the likely
  gap. If types resolve cleanly, skip the shim. **Mode A docs:** the shim file itself (typed module
  declarations).

#### Task M1.T2 — The URL pipeline + integration
Implement `injectUrl` and the helpers, wire the URL loop into `injectFiles` + the input handler, and
extend `FileDetail`/`readLine` for display. Mirrors spec §3 + §8; honors the three code_map.md
refinements.

- **Subtask M1.T2.S1 — `injectUrl` + helpers.** Add `injectUrl(url, state, ctx): Promise<boolean>`,
  `readBodyCapped(res, cap): Promise<string | null>` (string, for text/HTML/JSON/XML), a byte-oriented
  `readBytesCapped(res, cap): Promise<Buffer | null>` (for images — code_map.md refinement #3), and
  `formatUrlBlock(url, content)`. Implement the content-type dispatch (spec §3.1), the defuddle HTML
  pipeline (`parseHTML` → `Defuddle(doc, url, {markdown:true})` → title-prefixed markdown; spec §3.2),
  the SPA `<URL_MIN_CONTENT` (200) → verbatim+notify guard (§3.4), the three verbatim guards
  (20s timeout, 1 MB cap, over-budget; §3.3), and failures→verbatim (§3.5). Image branch feeds raw
  bytes into the existing recipe (`resizeImage` + `state.images.push` + `formatImageBlock` +
  `estimateImageTokens` + `subtract` + a `kind:"image"` detail). Successful text/HTML path pushes a
  `kind:"url"` detail + `formatUrlBlock` + `subtract(ceil(body.length/4))` + `state.count++`.
  Constants: `URL_TIMEOUT_MS=20_000`, `URL_MAX_BYTES=1_000_000`, `URL_MIN_CONTENT=200`, `BROWSER_UA`.
  Never throws (wrap in try/catch → `return false`). **Mode A docs:** JSDoc on `injectUrl` and helpers.
- **Subtask M1.T2.S2 — `FileDetail.kind: "url"` + `readLine` url branch.** Add `"url"` to the
  `FileDetail.kind` union (L448). In `readLine` (L803), add a `url` branch **before** the final
  text fallback: it returns `title + theme.fg("accent", d.path)` with **no `tildify`** (URLs are not
  home-relative — code_map.md) and no range. Expanded-view body recovery already works generically
  (text/image/binary branches handle markdown bodies; image details skip body). **Mode A docs:**
  update the `FileDetail.kind` JSDoc to list `url`.
- **Subtask M1.T2.S3 — Wire the URL loop into `injectFiles` + the input handler.**
  - `injectFiles` (L1114): add `enableUrls = true` as a trailing param (mirrors the `bareAt` seam).
    Store it on `state` is unnecessary — read the local `enableUrls` directly. After the existing
    `processTokenStream` call, when `enableUrls` is true, run `URL_INJECT_RE` over `text`; for each
    match, `cleanToken` (existing helper), test `URL_SHAPE_RE`, normalize to absolute
    (`https://` prefix when scheme-less), dedup against `state.injectedSet`, and `await injectUrl(abs,
    state, ctx)` per surviving URL (spec §8). The loop shares `state` so budget/dedup/count span both
    triggers.
  - Input handler pre-check (L1255): broaden `!event.text?.includes("#@")` to
    `!event.text?.includes("#")` (both triggers contain `#`; code_map.md pre-check note). Pass
    `cfg.enableUrls !== false` as the new `injectFiles` arg at L1257. The verbatim-prompt return
    (`text: event.text`) is unchanged — failed URL tokens stay verbatim exactly like failed `#@` tokens.
  - **Mode A docs:** JSDoc on the new `injectFiles` param + the URL loop.

### Milestone M2 — Tests + Changeset Docs

**Goal:** `npm test` green with hermetic URL coverage; README describes `#<url>`. Depends on M1.

#### Task M2.T1 — Hermetic URL tests
Add a new test file `url-injection.test.mjs` (and chain it into `package.json` `"test"` after
`relative-imports.test.mjs`). Tests stub `globalThis.fetch` (restore in `finally`) — **never hit the
network**. Wire it into the existing `npm test` chain.

- **Subtask M2.T1.S1 — detection + dispatch tests.** Cover: `#example.com` and `#https://x.com/y`
  both inject clean markdown (mock HTML → defuddle); `text/plain`/`application/json`/`text/xml` URLs
  inject raw (no extraction); `image/png` URL attaches an image (byte-exact path); the collision rows
  from spec §2.3 (`#@file.txt` is a file not a URL; `# Heading`/`#1234`/`#fff`/`#v1.2`/`#3.14`/
  `foo#example.com` mid-word are untouched prose; `#node.js` is URL-shaped → no-op verbatim); both
  triggers in one prompt share budget and produce two green lines.
- **Subtask M2.T1.S2 — failure / guard tests (all → verbatim, no block).** Non-2xx; DNS/network throw;
  20s timeout (use a fetch stub that never resolves + a reduced `URL_TIMEOUT_MS` via injection or a
  fast-aborting stub); `Content-Length` > 1 MB → not downloaded (assert the body reader is never
  called); mid-stream overflow > 1 MB → verbatim; over-budget (`state.remaining` forced low) →
  verbatim (assert **no** paging — URLs never page, spec §3.3); SPA `<200` chars extracted → verbatim
  + the notify; `enableUrls:false` → verbatim AND assert **no fetch call** is made (air-gapped);
  PDF/`application/octet-stream` → verbatim. Assert every verbatim case leaves `r.text === prompt`
  (the verbatim contract from plan 009 applies to URLs too) and `r.injected` reflects only the
  successes. Dedup: `#example.com` + `#https://example.com` collapse to one.

#### Task M2.T2 — Changeset-level documentation (Mode B)
Depends on M1 + M2.T1. Update `README.md` (currently describes only `#@file`) so the package's
user-facing overview reflects the new capability.

- **Subtask M2.T2.S1 — README `#<url>` section + wiring.** Add: (a) a short "URLs" subsection under
  Usage showing `#example.com` / `#https://example.com/api` → green `read <url>` line, extracted to
  markdown; (b) the `enableUrls` config (default true; `false` disables all network egress) alongside
  the existing `markdownBareAtImports` config block; (c) a Limits note: 20s timeout, 1 MB cap,
  no caching (re-open re-fetches), SPA/JS-rendered pages fall back to verbatim, over-budget URLs are
  left verbatim (no paging — unlike files); (d) keep the install instructions accurate — the deps are
  bundled, the user installs nothing extra (preserve the "zero setup" value-prop). Do **not** rewrite
  the `#@file` sections. Optionally broaden the tagline/title to mention web pages.

---

## 5. Documentation Impact (summary)

- **Mode A (ride with the work):** JSDoc on `enableUrls`, `URL_INJECT_RE`, `URL_SHAPE_RE`, `injectUrl`,
  `readBodyCapped`/`readBytesCapped`, `formatUrlBlock`, the `FileDetail.kind` `url` member, and the new
  `injectFiles` param — all noted as sub-bullets under their implementing subtasks. The optional
  `declarations.d.ts` shim (M1.T1.S4) is itself typed-module documentation.
- **Spec files:** **already current.** `spec/15-url-injection.md` is the authoritative URL spec and was
  written in commit `90369d3`; spec files 01-14 describe the `#@file` half. **No edits to `spec/01-14`
  are in scope** — that would be re-spec work, not implementation. (The §9 "integration table" in
  `spec/15` is aspirational merge guidance; the 15 file stands alone as the URL contract.)
- **Mode B (changeset-level):** README.md — Task M2.T2. The package's top-level capability list and
  install/limits overview only make full sense once the whole feature lands, so it is the final task
  depending on all implementation.

---

## 6. Acceptance / Done-Definition (from `spec/15-url-injection.md` §9)

- `#example.com` and `#https://example.com/x` fetch, extract via defuddle, and inject clean markdown as
  part of the `fileInjector.injected` custom message, rendered as a green `read <url>` line.
- Raw text/JSON/XML URLs inject verbatim (no extraction); image URLs attach as images.
- Oversized (>1 MB), over-budget, empty-extraction (SPA), non-2xx, timed-out, and `enableUrls:false`
  cases all leave the token verbatim; **no network egress when `enableUrls` is false**.
- No caching (re-open re-fetches). The `#@file` behavior is **byte-for-byte unchanged** (all three
  existing suites stay green).
- `npm run typecheck` clean; `npm test` (now four files) green.

---

## 7. Risks

1. **defuddle `.d.ts` availability** for `tsc --strict` — mitigated by M1.T1.S4 (shim if needed).
2. **jiti resolution of new deps in the test harness** — mitigated by making them real
   repo-root `node_modules` deps (M1.T1.S1); the test alias map does not cover them.
3. **Image-URL byte corruption** if the implementer copies the spec's string-based pseudocode verbatim
   — mitigated by the byte-reader refinement (M1.T2.S1 / code_map.md #3).
4. **Network in CI** — mitigated by hermetic `globalThis.fetch` stubbing (M2.T1) with a hard rule to
   never hit the network.
5. **Pre-check regression** — broadening to `includes("#")` runs the regex path on more prompts; verify
   no `#@`-only or prose-only prompt changes behavior (the `URL_SHAPE_RE` gate keeps ordinary `#word`
   prose inert).