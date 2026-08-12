# Fix Strategy — BUG-001 & BUG-002

This document records the chosen fix approach, rationale, and risk analysis for the two bugs
identified in the PRD. It is the authoritative design reference for downstream PRP agents.

---

## BUG-001: URL detector fires for `#filename.ext` prose tokens

### Root Cause
`URL_SHAPE_RE` (file-injector.ts:36) has a scheme-less dotted-host alternative whose final-label
gate `[a-z]{2,}` accepts **every** 2+ letter alphabetic string as a "TLD." Code-file extensions
(`md`, `go`, `py`, `rs`, `ts`, `cs`, `java`, `json`, `png`, `csv`, …) are all 2+ letter alphabetic
strings, so `#main.go`, `#notes.md`, `#config.json`, etc. all pass the gate and trigger a live
`fetch("https://<word>.<ext>")`. When the domain resolves (e.g. `main.go` is the real Go site), the
extracted HTML is injected into the model's context.

### Chosen Approach: Code-Extension Deny-List Gate

After `URL_SHAPE_RE.test(tok)` passes for a **scheme-less** token (Alternative B only), extract the
final label (the substring after the last `.`) and check it against a comprehensive
`CODE_EXTENSIONS` Set. If the label is a known code/file extension, the token is NOT treated as a
URL — it falls through verbatim (no fetch, no injection).

**Why this approach:**
1. **Surgical** — only affects scheme-less tokens (Alternative B). Explicit-scheme URLs
   (`#https://main.go`) are unaffected because Alternative A doesn't reach the deny-list check.
2. **Preserves legitimate domain detection** — `#example.com`, `#api.example.co.uk`,
   `#sub.domain.org/path` all still work because `com`, `co.uk`, `org` are NOT in the extension set.
3. **Eliminates the exact false-positive class** — every extension the PRD enumerated (go, md, py,
   rs, cs, java, ts, tsx, png, json, yaml, csv) is in the deny-list.
4. **Low blast radius** — single new gate added at ONE call site (L1398), no other consumers.
5. **No config change required** — the deny-list is static, covering the common coding extensions.

**Implementation detail:** the gate is an inline check in the URL scan loop, not a regex change.
The regex stays as-is; the gate is a post-regex filter on scheme-less tokens only. This avoids
over-complicating the regex and keeps the fix readable and auditable.

**Detection of "scheme-less":** a token is scheme-less if it does NOT start with `http://`,
`https://`, or `ftp://`. The existing normalization logic at L1399
(`/^https?:\/\//i.test(tok)`) already distinguishes these — we reuse the same test.

### Extensions to Include (categories)
- **Programming languages:** ts, tsx, js, jsx, mjs, cjs, py, rb, go, rs, java, kt, kts, cs, cpp,
  cc, cxx, c, h, hpp, hxx, swift, php, pl, pm, lua, r, scala, clj, cljs, cljc, ex, exs, erl, hs,
  ml, mli, fs, fsi, vb, dart, groovy, el, scm, rkt, zig, nim, jl, d, f, f90, pas, cob, asm, s, v
- **Web/markup:** html, htm, css, scss, sass, less, styl, vue, svelte, astro
- **Config/data:** xml, json, json5, jsonc, yaml, yml, toml, ini, cfg, conf, env, sql, graphql,
  gql, proto, csv, tsv, properties, gradle, cmake
- **Scripts:** sh, bash, zsh, fish, ps1, bat, cmd, awk
- **Images:** png, jpg, jpeg, gif, webp, bmp, svg, ico, tiff, tif, heic, avif
- **Documents:** md, markdown, txt, pdf, doc, docx, xls, xlsx, ppt, pptx, rtf, tex, bib, rst, adoc
- **Binary/archives:** db, sqlite, zip, tar, gz, bz2, xz, 7z, rar, lock, log, min, map, wasm

**Note on real ccTLDs:** a few extensions overlap with real ccTLDs (e.g. `.sh` = Saint Helena,
`.py` = Paraguay). In a coding agent context, `#foo.sh` and `#foo.py` almost always mean a script
and a Python file, not a website in Saint Helena or Paraguay. Blocking them is the correct
trade-off for this extension's primary use case. Users who need to fetch `https://foo.sh` can use
the explicit-scheme form `#https://foo.sh`.

### COL-4 Test Impact
COL-4 (`#node.js`) currently asserts fetch IS called (→ 404). With the deny-list, `.js` is a known
code extension, so `#node.js` will NO LONGER trigger a fetch. The test must be updated to assert
`calls.length === 0` and `injected === 0` — reflecting the corrected, desired behavior.

### Risk Assessment
- **Risk of blocking a legitimate URL:** only scheme-less tokens whose final label matches a code
  extension are affected. Any such domain can still be fetched via `#https://domain.ext`.
- **Risk of missing an extension:** the deny-list is comprehensive but not exhaustive. New or
  obscure extensions could slip through. The JSDoc and README will document the behavior so users
  understand the trade-off. The deny-list is a simple Set that is trivial to extend.
- **Risk of breaking existing tests:** COL-4 is the only test that changes (from fetch-called to
  no-fetch). All other url-injection.test.mjs cases use real domains (`example.com`, `x.com`) whose
  TLDs are NOT code extensions, so they pass unchanged.

---

## BUG-002: Status notify says '#@ injected' for URL-only injections

### Root Cause
The input handler (file-injector.ts:1494) hardcodes the notify string as
`#@ injected ${whole} whole…`. The `whole`/`paged` axis is derived from `injected` and `paged` which
are shared across file AND URL deliveries. A URL-only prompt (e.g. `Summarize #example.com`) sets
`injected===1, paged===0` and emits `#@ injected 1 whole` even though no `#@file` was involved.

### Chosen Approach: Trigger-Aware Notify via `details[].kind`

The `injectFiles` return already includes `details: FileDetail[]` where each detail has a `kind`
field: `"url"` for URL injections, `"text"`/`"image"` for file injections. The handler can
compute URL vs file counts from `details` **without any API change to `injectFiles`**.

**Wording logic:**
- **Files only** (`urlCount === 0`): `#@ injected ${fileWhole} whole${paged > 0 ? `, ${paged} paged` : ""}`
  (existing behavior, byte-for-byte preserved)
- **URLs only** (`fileCount === 0`): `injected ${urlCount} URL${urlCount > 1 ? "s" : ""}`
  (no `#@` prefix; no `whole`/`paged` axis — meaningless for URLs)
- **Mixed** (both > 0): `#@ injected ${fileWhole} whole${paged > 0 ? `, ${paged} paged` : ""}, ${urlCount} URL${urlCount > 1 ? "s" : ""}`

**Why this approach:**
1. **No API change** — uses the existing `details` array; `injectFiles` return shape is unchanged.
2. **Backward-compatible** — file-only prompts get the exact same toast as before.
3. **Minimal diff** — only the `const msg = …` line (L1494) and a few lines to compute
   `urlCount`/`fileCount` change. No logic flow changes.

### Risk Assessment
- **Risk of breaking notify tests:** existing handler tests (file-injector.test.mjs Case 9, etc.)
  use `#@file` prompts, so `urlCount===0` and the wording is unchanged. No existing notify test
  breaks.
- **Edge case — 0 file details but paged > 0:** impossible by construction (paged is only
  incremented for file deliveries; if there are no file details, paged===0).

---

## Dependency Analysis

BUG-001 and BUG-002 are **independent** — different code locations (L36/L1398 vs L1494), no shared
state, no ordering requirement. They can be implemented in parallel. The documentation sync task
depends on both (it summarizes the full changeset).

## Files Modified

| File | Change | Bug |
|------|--------|-----|
| `file-injector.ts` L36 (JSDoc above URL_SHAPE_RE) | Update JSDoc to document deny-list | BUG-001 |
| `file-injector.ts` (new constant ~L37) | Add `CODE_EXTENSIONS` Set | BUG-001 |
| `file-injector.ts` L1395-1402 (URL scan loop) | Add post-gate extension check | BUG-001 |
| `file-injector.ts` L1493-1494 (notify) | Trigger-aware wording | BUG-002 |
| `url-injection.test.mjs` COL-4 (L400-410) | Update: assert NO fetch for #node.js | BUG-001 |
| `url-injection.test.mjs` (new cases) | Add no-fetch regression tests for #filename.ext | BUG-001 |
| `file-injector.test.mjs` or `url-injection.test.mjs` (new case) | Add URL-only notify test | BUG-002 |
| `README.md` L202 | Update URL detection documentation | Both |