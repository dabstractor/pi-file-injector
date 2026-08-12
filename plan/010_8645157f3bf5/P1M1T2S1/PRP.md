# PRP — P1.M1.T2.S1: injectUrl + helpers (fetch pipeline, content-type dispatch, defuddle extraction, image byte path, guards)

---

## Goal

**Feature Goal**: Implement the complete URL fetch+inject pipeline for `#<url>`
tokens — a self-contained `injectUrl(url, state, ctx)` driver plus three helpers
(`readBodyCapped`, `readBytesCapped`, `formatUrlBlock`) — that fetches a URL,
dispatches by `Content-Type`, extracts HTML→markdown via **defuddle** (with the
**linkedom** polyfills defuddle's internals require), routes images through the
existing resize pipeline, enforces the three §3.3 guards (timeout / 1 MB cap /
shared-budget), handles the SPA/empty-extraction fallback, and **never throws**
(every failure → leave the `#<url>` token verbatim). Consumed downstream by
**T2.S3** (the URL scan+inject loop in `injectFiles`).

**Deliverable**: Four new functions added to `file-injector.ts` (private — same
module, exercised via `injectFiles` per the `injectMarkdown` precedent), two new
imports (`defuddle/node`, `linkedom`), four new §3.3 constants, a one-token
`FileDetail.kind` union widening (`"url"`), and a two-field `Ctx` widening
(`hasUI?`, `ui?`) for the SPA notify. [Mode A] JSDoc on all four functions.

**Success Definition**:
- `npm run typecheck` exits 0 — the defuddle/linkedom imports resolve natively
  (Outcome (a) from S4) AND the pipeline typechecks under `--strict` (incl. the
  `doc as Document` cast and the polyfill mutations).
- `npm test` exits 0 — the module-surface allowlist guard stays green (the four
  functions are **private** → no allowlist edit → no regression).
- The code is spec-§8-pseudocode-faithful with the four architecture refinements
  applied; behavioral dispatch/guard tests are deferred to **P1.M2.T1** (which
  runs after T2.S3 wires the loop and exercises `injectUrl` via `injectFiles`
  with a stubbed `globalThis.fetch`).

## User Persona

**Target User**: The T2.S3 implementer (who wires the URL scan loop) and P1.M2.T1
test author (who writes hermetic dispatch/guard tests). Indirectly: every Pi user
who types `#example.com` into a prompt.
**Use Case**: T2.S3 calls `await injectUrl(abs, state, ctx)` per matched URL token;
P1.M2.T1 stubs `globalThis.fetch` and calls `injectFiles(prompt, [], ctx, false, true)`
to exercise the branch end-to-end.
**User Journey**: `#example.com` in a prompt → (T2.S3) matched & deduped →
`injectUrl` fetches (20s timeout, 1 MB cap, browser UA) → routes by content-type →
HTML extracted to markdown / image resized & attached / raw text injected verbatim /
else left verbatim → block+detail pushed, budget subtracted, `count++`.
**Pain Points Addressed**: in-process trafilatura-class web extraction without a
browser; enormous files never pulled into context; JS-rendered shells detected and
left as reference instead of injecting garbage; binary image bytes never UTF-8-corrupted.

## Why

- **The vertical core of the URL feature.** Every other URL task (T2.S2 renderer,
  T2.S3 wiring, P1.M2.T1 tests, P1.M2.T2 docs) depends on this pipeline existing
  and being correct. It is the load-bearing work item of milestone P1.M1.T2.
- **Reuses the shipped file-injector plumbing.** The image path mirrors
  `injectFile`'s image branch (L966–975) verbatim; budget subtraction uses the
  existing `subtract`/`State`; block format reuses the `<file name="…">` envelope.
  No new State fields, no new delivery mechanism.
- **Honors four architecture-verified refinements** that the spec/§8 pseudocode got
  wrong: (A) Defuddle is an async function; (B) `parseHTML` takes ONE arg;
  (C) defuddle internals REQUIRE polyfills or they throw; (D) images need a
  byte-oriented reader (the string reader UTF-8-corrupts binary bytes).

## What

Add to `file-injector.ts`, between `estimateImageTokens` (ends L735) and the
§6.3 renderer section (starts L736):

1. **Two imports** (`defuddle/node`, `linkedom`) after the `os` import (L8).
2. **Four §3.3 constants** (`URL_TIMEOUT_MS`, `URL_MAX_BYTES`, `URL_MIN_CONTENT`,
   `BROWSER_UA`) in the constants cluster (after `IMAGE_FALLBACK_TOKENS`).
3. **`FileDetail.kind` += `"url"`** (one token — required for T2.S1's own typecheck).
4. **`Ctx` += `hasUI?` / `ui?`** (additive optional fields for the SPA notify).
5. **Four private functions**: `injectUrl`, `readBodyCapped`, `readBytesCapped`,
   `formatUrlBlock` — each with [Mode A] JSDoc.

### Success Criteria

- [ ] `import { Defuddle } from "defuddle/node"; import { parseHTML } from "linkedom";` added; `npm run typecheck` exits 0.
- [ ] `injectUrl(url, state, ctx): Promise<boolean>` implements the full §3 dispatch + three §3.3 guards + §3.4 SPA fallback, wrapped in `try/catch → return false` + `finally { clearTimeout }` (never throws).
- [ ] `readBodyCapped(res, cap): Promise<string|null>` streams the body, aborts→`null` at cap, returns UTF-8 string (text/html/json/xml).
- [ ] `readBytesCapped(res, cap): Promise<Buffer|null>` — same streaming, returns a **raw Buffer** (images — Refinement #D; no UTF-8 corruption).
- [ ] `formatUrlBlock(url, content)` returns `'<file name="' + url + '">\n' + content + '\n</file>'` (same envelope as `formatTextFileBlock`, name = URL).
- [ ] Image path uses `readBytesCapped` → `resizeImage(new Uint8Array(buf), cleanMime)` → reuse `formatImageBlock`/`estimateImageTokens`/`subtract`; HTML path uses `parseHTML(html)` [1-arg] + the three polyfills + `doc.URL=url` + `Defuddle(doc,url,{markdown:true})`.
- [ ] `FileDetail.kind` includes `"url"`; `Ctx` includes optional `hasUI`/`ui`.
- [ ] All four functions **private** (no `export`) → `npm test` module-surface allowlist unchanged → green.

## All Needed Context

### Context Completeness Check

_Pass._ "If someone knew nothing about this codebase, would they have everything
needed?" — **Yes.** The exact insertion point, the exact reusable helpers (with line
numbers + signatures), the exact defuddle/linkedom API shapes (verified from the
shipped `.d.ts`), the exact polyfill lines (from defuddle's own
`linkedom-compat.ts`), the exact image recipe to mirror, the export decision
(keep private, citing the `injectMarkdown` precedent + the allowlist guard), and
the verified validation commands are all below. No domain inference required.

### Documentation & References

```yaml
# MUST READ — the architecture docs already did the deep library research; they are the source of truth.
- docfile: plan/010_8645157f3bf5/architecture/external_deps.md
  why: Authoritative defuddle/linkedom API + the ⭐ polyfill requirement (defuddle's linkedom-compat.ts).
  section: "## 1. defuddle … ⚠️ CRITICAL: linkedom polyfill requirement" + "## 2. linkedom"
  critical: |
    (A) `Defuddle` is an ASYNC FUNCTION from "defuddle/node", not a class.
    (B) `parseHTML(html)` takes ONE arg — `parseHTML(html,{url})` is WRONG (TS2554 + ignored).
    (C) defuddle internals REQUIRE polyfills: `doc.styleSheets=[]` if missing;
        `doc.defaultView.getComputedStyle=()=>({display:''})` if missing; set `doc.URL=url` AFTER parsing.
    (D) image path MUST use a byte reader (string reader UTF-8-corrupts binary image bytes).

- docfile: plan/010_8645157f3bf5/architecture/defuddle-linkedom-research.md
  why: Same conclusions verified against the published npm tarballs (dist/node.d.ts, dist/markdown.js).
  section: "## 1. defuddle (defuddle/node entry)" + "## 2. linkedom (parseHTML)"
  critical: result.content IS the markdown when {markdown:true}; result.title is a required string (may be "").

- docfile: plan/010_8645157f3bf5/architecture/code_map.md
  why: Exact integration points in file-injector.ts + the image-URL byte-path bug + the hermetic-test note.
  section: "## Integration points …" + "## Image-URL byte-path refinement" + "## Test harness"

- docfile: plan/010_8645157f3bf5/P1M1T1S4/PRP.md
  why: Parallel sibling. PROVES (Outcome a) the defuddle/linkedom types resolve natively → no shim.
  take: Add the two imports as-is; `npm run typecheck` will pass.

- docfile: plan/010_8645157f3bf5/P1M1T1S3/PRP.md
  why: Parallel sibling that added URL_INJECT_RE + URL_SHAPE_RE (already merged at L20–34). T2.S1 does
        NOT touch that regex region. cleanToken (L109) is reused by the SCAN loop (T2.S3), not injectUrl.

# Library docs (external — the underlying APIs; the arch docs already distilled these):
- url: https://github.com/kepano/defuddle
  why: defuddle/node entry + the markdown pipeline. Defuddle(doc,url,{markdown:true}) → DefuddleResponse.
- url: https://github.com/WebReflection/linkedom
  why: parseHTML(html) → { document, ... } . document.URL is settable. ONE arg.

# The file being edited (the ONLY source file this task touches):
- file: file-injector.ts
  why: Add imports (L1–8), constants (~L66), FileDetail.kind "url" (L457), Ctx widening (L852–857),
       and the four functions in the L735→L736 gap.
  pattern: mirror the injectFile image branch (L966–975) for the URL image path; mirror formatTextFileBlock
           (L272) for formatUrlBlock; mirror subtract (L496) usage for budget; mirror the input handler's
           `if (ctx.hasUI) ctx.ui.notify(msg,"info")` (L1286/1291) for the SPA notify.
  gotcha: keep the four functions PRIVATE — file-injector.test.mjs L136–156 is a strict export allowlist.
```

### Current Codebase tree (the files this task touches)

```bash
.
├── file-injector.ts          # EDIT: +2 imports, +4 constants, +1 union member, +2 Ctx fields, +4 functions
├── scripts/
│   └── typecheck.mjs         # NOT modified (temp tsconfig resolves defuddle/linkedom natively — S4 proved this)
├── tsconfig.json             # NOT modified (editor-only; npm run typecheck ignores it)
├── package.json              # NOT modified (S1 already installed defuddle/linkedom as hard deps)
├── node_modules/
│   ├── defuddle/             # PRESENT (S1). dist/node.d.ts ships → resolves natively.
│   └── linkedom/             # PRESENT (S1). types/esm/index.d.ts ships → resolves natively.
├── file-injector.test.mjs    # NOT modified (4 functions are PRIVATE → module-surface allowlist unchanged)
└── plan/010_8645157f3bf5/P1M1T2S1/
    ├── PRP.md                # THIS file.
    └── research/notes.md     # (exists) line-precise research record.
```

### Desired Codebase tree with files to be added

```bash
# No NEW files. The single edited file, file-injector.ts, gains (all additive, in-place):
#   L8a  import { Defuddle } from "defuddle/node";
#   L8b  import { parseHTML } from "linkedom";
#   ~L67 const URL_TIMEOUT_MS / URL_MAX_BYTES / URL_MIN_CONTENT / BROWSER_UA   (§3.3 cluster)
#   L457 FileDetail.kind  +=  "url"
#   L857 Ctx              +=  hasUI?: boolean;  ui?: { notify(message: string, level: string): void }
#   L735→736 gap:  injectUrl / readBodyCapped / readBytesCapped / formatUrlBlock  (4 private functions + JSDoc)
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL (Refinement B): linkedom's parseHTML takes ONE arg. parseHTML(html, { url }) is WRONG —
//   TS2554 "Expected 1 arguments, but got 2" under --strict, and linkedom ignores the 2nd arg anyway.
//   Use `const { document } = parseHTML(html);` then set `doc.URL = url` AFTER parsing.
//   (source: defuddle's own src/utils/linkedom-compat.ts — the canonical pattern.)

// CRITICAL (Refinement C): defuddle's internals READ doc.styleSheets and doc.defaultView.getComputedStyle.
//   linkedom's document has NEITHER by default → defuddle throws → caught by try/catch → silent verbatim
//   (extraction silently fails). REPLICATE the polyfills before calling Defuddle:
//     const doc = document as any;
//     if (!doc.styleSheets) doc.styleSheets = [];
//     if (doc.defaultView && !doc.defaultView.getComputedStyle)
//       doc.defaultView.getComputedStyle = () => ({ display: "" });
//     doc.URL = url;

// CRITICAL (Refinement D): the image path MUST use readBytesCapped (raw Buffer), NOT readBodyCapped
//   (UTF-8 string). Feeding image bytes through Buffer.from(htmlString,"utf8") CORRUPTS them. The spec §8
//   pseudocode has this bug; readBytesCapped is the fix. Text/html/json/xml keep the string reader.

// CRITICAL (Refinement A): `import { Defuddle } from "defuddle/node"` imports an ASYNC FUNCTION (not a class).
//   `await Defuddle(doc, url, { markdown: true })` → DefuddleResponse. result.content IS the markdown
//   (overwritten by toMarkdown when markdown:true). result.title is a REQUIRED string (may be "").

// CRITICAL (export decision): the four functions MUST be PRIVATE (no `export`). file-injector.test.mjs
//   L136–156 enforces a STRICT allowlist (ASSERTED_EXPORTS). Any new export not registered there →
//   `npm test` FAILS with "module ships functions not in the sanity list". The guard's own message sanctions
//   "keep PRIVATE and exercise via injectFiles" (the injectMarkdown precedent). injectUrl is its analog.

// CRITICAL (FileDetail.kind): injectUrl pushes kind:"url" details → "url" MUST be in the union or
//   typecheck fails. T2.S1 adds the "url" member (one token). SAFE: no consumer uses an exhaustive switch
//   (all are if-chains w/ default). T2.S2 then only adds the readLine renderer branch.

// GOTCHA (Content-Type params): ct may be "image/png; charset=utf-8". For resizeImage + the image push,
//   strip params: `const mime = ct.split(";")[0].trim();`. The ct.startsWith("image/") / "text/html"
//   dispatch checks tolerate params as-is.

// GOTCHA (budget guard for images): the over-budget guard applies to ALL injectable paths including image.
//   For images: resize FIRST (to get estimateImageTokens(resized)), THEN guard, THEN push — an over-budget
//   image is discarded (left verbatim), mirroring §3.3 "NO paging for URLs".

// GOTCHA (never throws): wrap the ENTIRE injectUrl body in try { … } catch { return false } with the
//   AbortController timeout cleared in `finally`. §3.5: non-2xx / DNS / TLS / timeout / cap / over-budget /
//   empty-extraction / unhandled content-type / any throw → verbatim, no block appended, never lose the prompt.

// GOTCHA (readLine + tildify): readLine (L825) tildifies d.path. For a url detail rendered via readLine's
//   DEFAULT branch (until T2.S2 adds the explicit url branch), tildify is a no-op (URLs don't start with
//   home+"/"). Acceptable interim rendering: `read https://example.com`.
```

## Implementation Blueprint

### Data models and structure

No new runtime models. Two TYPE-ONLY widenings (erased at runtime by jiti/TS):

```ts
// FileDetail.kind (L457) — add "url" (one token). T2.S1 is the producer; T2.S2 adds the renderer branch.
export interface FileDetail {
  path: string;
  kind: "text" | "image" | "binary" | "paged" | "url";  // ← +"url"
  chars?: number;   // url: body.length
  // … (existing fields unchanged)
}

// Ctx (L852–857) — add two OPTIONAL fields (additive; existing callers unaffected). The real pi ctx
// already has these (used at L1286/1291); the local type just didn't declare them.
type Ctx = {
  cwd: string;
  getContextUsage?: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
  hasUI?: boolean;                                       // ← NEW (SPA fallback §3.4)
  ui?: { notify(message: string, level: string): void }; // ← NEW
};
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD IMPORTS (file-injector.ts, after L8 `import * as os from "node:os";`)
  - ADD: `import { Defuddle } from "defuddle/node";`
  - ADD: `import { parseHTML } from "linkedom";`
  - WHY: Defuddle is the async extract→markdown fn (Refinement A); parseHTML parses HTML to a linkedom
         document (Refinement B: ONE arg). S4 proved both resolve natively under Bundler resolution.
  - DO NOT add paths mappings, shims, or declarations.d.ts (S4 Outcome (a) = native resolution).

Task 2: ADD §3.3 CONSTANTS (file-injector.ts, in the constants cluster, after IMAGE_FALLBACK_TOKENS ~L66,
         BEFORE hasValidImageMagic at L82 — text-disjoint from S3's regex region L20–34)
  - ADD (each with a one-line §3.3/§3.4 JSDoc comment):
      const URL_TIMEOUT_MS  = 20_000;       // §3.3 guard 1 — AbortController timeout
      const URL_MAX_BYTES   = 1_000_000;    // §3.3 guard 2 — 1 MB download cap
      const URL_MIN_CONTENT = 200;          // §3.4 SPA / empty-extraction floor
      const BROWSER_UA      = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  - NAMING: SCREAMING_SNAKE_CASE (matches PAGED_THRESHOLD / IMAGE_FALLBACK_TOKENS).
  - PLACEMENT: in the constants cluster so all tunables sit together.

Task 3: WIDEN FileDetail.kind (file-injector.ts L457)
  - CHANGE: `kind: "text" | "image" | "binary" | "paged";`
         → `kind: "text" | "image" | "binary" | "paged" | "url";`
  - WHY: injectUrl pushes { kind: "url", … } details (Task 5). Required for T2.S1's own typecheck.
  - SAFETY: verified — no exhaustive switch/assertNever on .kind (all consumers are if-chains w/ default).
  - HANDOFF NOTE (JSDoc on the union): "url added by T2.S1 (producer); the readLine renderer branch lands
         in T2.S2. url details render via readLine's default branch until then."

Task 4: WIDEN Ctx (file-injector.ts L852–857)
  - ADD: `hasUI?: boolean;` and `ui?: { notify(message: string, level: string): void };` (optional).
  - WHY: injectUrl's SPA fallback (§3.4) emits a notify guarded on ctx.hasUI (Task 5).
  - SAFETY: purely additive optional fields — injectFiles/processTokenStream/injectFile don't reference
         them; the real pi ctx structurally satisfies the widened type.

Task 5: CREATE the four functions (file-injector.ts, in the L735→L736 gap, AFTER estimateImageTokens,
         BEFORE the `// ---------- §6.3 chat renderer` line). ALL PRIVATE (no export).
  - IMPLEMENT (see "Implementation Patterns & Key Details" for exact bodies):
      formatUrlBlock(url, content): string            # pure formatter (Task 5a)
      readBodyCapped(res, cap): Promise<string|null>  # string reader — text/html/json/xml (Task 5b)
      readBytesCapped(res, cap): Promise<Buffer|null> # BYTE reader — images (Refinement D) (Task 5c)
      injectUrl(url, state, ctx): Promise<boolean>    # the pipeline (Task 5d — depends on 5a/5b/5c + reuse)
  - FOLLOW pattern: injectFile (L963) for the never-throws try/catch + the image recipe (L966–975);
         formatTextFileBlock (L272) for formatUrlBlock's envelope; the input handler's SPA-notify shape
         (L1286/1291: `if (ctx.hasUI) ctx.ui.notify(msg, "info")`).
  - REUSE (do NOT redeclare): formatImageBlock (L277), estimateImageTokens (L729), resizeImage (L3),
         formatDimensionNote (L3), subtract (L496), State (L483), FileDetail (L457).
  - DO NOT export any of the four (module-surface allowlist guard — see Gotchas).
  - DO NOT add a URL scan loop, enableUrls wiring, or a readLine url branch (T2.S3 / T2.S2).
  - DOCS: [Mode A] JSDoc on each (document dispatch, three guards, SPA fallback, never-throws;
         note readBytesCapped is byte-oriented for image safety; note formatUrlBlock's name=url envelope).

Task 6: VALIDATE (no code)
  - RUN: `npm run typecheck`  → EXPECT exit 0 (proves imports resolve + strict type-correctness).
  - RUN: `npm test`           → EXPECT exit 0 (module-surface allowlist unchanged — 4 private functions).
  - (Behavioral dispatch/guard tests are P1.M2.T1, after T2.S3 wires the loop.)
```

### Implementation Patterns & Key Details

```ts
// ───────── Task 5a: formatUrlBlock — pure formatter, same <file> envelope as formatTextFileBlock (L272) ─────────
/** §3.2/§6.1 — the URL injection block. Same `<file name="…">\n…\n</file>` envelope as formatTextFileBlock,
 *  but `name` is the absolute URL (not a home-relative path). Consumed by injectUrl's text/html + raw-text
 *  paths. NOT exported (private; exercised via injectFiles → injectUrl, per the injectMarkdown precedent). */
function formatUrlBlock(url: string, content: string): string {
  return '<file name="' + url + '">\n' + content + '\n</file>';
}

// ───────── Task 5b: readBodyCapped — STRING reader (text/html/json/xml). Aborts → null at cap. ─────────
/** §3.3 guard 2 — stream-read `res.body` as a UTF-8 STRING, aborting (→ null) if accumulated bytes exceed
 *  `cap`. Pre-download, injectUrl checks `Content-Length > cap` first; this enforces the cap MID-stream
 *  (servers may lie or omit Content-Length). Falls back to `res.text()` (with a length check) when the body
 *  has no reader. Returns null on overflow → caller leaves the token verbatim (§3.3). */
async function readBodyCapped(res: Response, cap: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) { const t = await res.text(); return t.length > cap ? null : t; }
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) return null;          // overflow → verbatim (§3.3)
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ───────── Task 5c: readBytesCapped — BYTE reader (images, Refinement D). NEVER decodes to UTF-8. ─────────
/** §3.3/§5.2 — BYTE-oriented capped reader for the image path. Identical streaming/abort logic to
 *  readBodyCapped but returns a raw Buffer (NO .toString) so binary image bytes are NOT UTF-8-corrupted.
 *  The spec §8 pseudocode's Buffer.from(htmlString,"utf8") corrupts images; this reader is the fix.
 *  Fed into resizeImage(new Uint8Array(buf), mime). Returns null on overflow → verbatim. */
async function readBytesCapped(res: Response, cap: number): Promise<Buffer | null> {
  const reader = res.body?.getReader();
  if (!reader) { const b = Buffer.from(await res.arrayBuffer()); return b.length > cap ? null : b; }
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) return null;          // overflow → verbatim (§3.3)
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);           // raw bytes — no decode
}

// ───────── Task 5d: injectUrl — the pipeline. Content-type dispatch + 3 guards + SPA fallback + never throws. ─────────
/**
 * §3 — fetch a URL and inject its content into `state`, routing by Content-Type:
 *   • text/html (or sniffed leading '<') → §3.2 defuddle extract → markdown  (Refinements A/B/C)
 *   • text/plain | markdown | json | xml | rss | atom            → raw text, verbatim (no extraction)
 *   • image/*                                                    → §5.2 resize + attach (Refinement D byte reader)
 *   • anything else (PDF, octet-stream, …)                       → verbatim (§3.5)
 *
 * Three §3.3 guards — any failing leaves the `#<url>` token VERBATIM (NO paging — the read tool can't
 * fetch URLs, §3.3): (1) AbortController 20s timeout; (2) Content-Length > URL_MAX_BYTES pre-download
 * (skip) + stream-abort at URL_MAX_BYTES via the capped readers; (3) shared-budget over-limit
 * (state.remaining !== null && cost > state.remaining). Successful injection subtracts `cost` from the
 * shared `remaining` (like any delivered file) and bumps state.count.
 *
 * §3.4 SPA fallback: if defuddle yields < URL_MIN_CONTENT chars (a JS-rendered shell), leave the token
 * verbatim AND emit a notify (guarded on ctx.hasUI): "#<url>: page appears JS-rendered; left as reference".
 *
 * §3.5 NEVER THROWS: non-2xx / DNS / TLS / timeout / cap / over-budget / empty-extraction / unhandled
 * content-type / ANY thrown error → return false (verbatim, no block appended). The whole body is wrapped
 * in try/catch with the timeout cleared in `finally`.
 *
 * @returns true iff a block (and/or image) was emitted (count bumped exactly once); false → verbatim.
 *          PRIVATE — consumed by the URL loop in injectFiles (T2.S3); exercised via injectFiles in tests.
 */
async function injectUrl(url: string, state: State, ctx: Ctx): Promise<boolean> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS);          // §3.3 guard 1
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return false;                                         // §3.5 non-2xx → verbatim
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > URL_MAX_BYTES) return false;                      // §3.3 guard 2a — too big, don't download
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    // ── IMAGE path (Refinement D: BYTE reader) ──
    if (ct.startsWith("image/")) {
      const buf = await readBytesCapped(res, URL_MAX_BYTES);           // raw Buffer — no UTF-8 decode
      if (buf === null) return false;                                  // §3.3 guard 2b — overflowed mid-stream
      const mime = ct.split(";")[0].trim();                            // strip params ("image/png; charset=…")
      const resized = await resizeImage(new Uint8Array(buf), mime);    // async Worker; null on failure (mirror L968)
      const cost = estimateImageTokens(resized);                       // §5.6.2 tile estimate
      if (state.remaining !== null && cost > state.remaining) return false; // §3.3 guard 3 — over-budget → verbatim
      state.images.push({ type: "image", data: resized?.data ?? buf.toString("base64"), mimeType: resized?.mimeType ?? mime }); // mirror L969
      state.blocks.push(formatImageBlock(url, resized));               // mirror L972 (name = url)
      state.details.push({ path: url, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined }); // mirror L973
      subtract(state, cost);                                           // §5.6.2 mirror L974
      state.count++;
      return true;
    }

    // ── STRING reader for text/html/json/xml (images already handled above) ──
    const html = await readBodyCapped(res, URL_MAX_BYTES);
    if (html === null) return false;                                   // §3.3 guard 2b — overflowed mid-stream

    let body: string;
    if (ct.startsWith("text/html") || /^\s*</.test(html)) {
      // §3.2 HTML pipeline — Refinements A/B/C
      const { document } = parseHTML(html);                            // (B) ONE arg — NOT parseHTML(html, {url})
      const doc = document as any;                                     // polyfills need `any` (styleSheets not on the TS DOM type)
      if (!doc.styleSheets) doc.styleSheets = [];                      // (C) defuddle reads styleSheets
      if (doc.defaultView && !doc.defaultView.getComputedStyle)        // (C) defuddle reads getComputedStyle
        doc.defaultView.getComputedStyle = () => ({ display: "" });
      doc.URL = url;                                                   // (B) set base URL AFTER parsing
      const r = await Defuddle(doc as Document, url, { markdown: true }); // (A) async FUNCTION; result.content IS markdown
      const md = (r.content ?? "").trim();
      if (md.length < URL_MIN_CONTENT) {                               // §3.4 SPA / empty-extraction
        if (ctx.hasUI) ctx.ui?.notify(`${url}: page appears JS-rendered; left as reference`, "info");
        return false;                                                  // verbatim + notify
      }
      body = (r.title ? `# ${r.title}\n\n` : "") + md;                 // r.title: required string, may be ""
    } else if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("markdown")) {
      body = html;                                                     // §3.1 raw text — verbatim (no extraction)
    } else {
      return false;                                                    // §3.5 unhandled content-type → verbatim
    }

    const cost = Math.ceil(body.length / 4);                           // §3.3 token estimate (≈4 chars/token)
    if (state.remaining !== null && cost > state.remaining) return false; // §3.3 guard 3 — over-budget → verbatim (NO paging)

    state.blocks.push(formatUrlBlock(url, body));                      // <file name="URL">\n…\n</file>
    state.details.push({ path: url, kind: "url", chars: body.length }); // FileDetail.kind "url" (Task 3)
    subtract(state, cost);                                             // shared budget
    state.count++;
    return true;
  } catch {
    return false;                                                      // §3.5 timeout/network/throw → verbatim (never throws)
  } finally {
    clearTimeout(to);                                                  // always release the AbortController timer
  }
}
```

### Integration Points

```yaml
IMPORTS: +2 in file-injector.ts (defuddle/node, linkedom) — resolve natively (S4 Outcome a).
DATABASE: none.
CONFIG: none (enableUrls wiring is T2.S3; T2.S1 only CONSUMES ctx.hasUI/ctx.ui).
ROUTES: none.
REGISTRY: none.
DOWNSTREAM CONSUMERS:
  - P1.M1.T2.S3: calls `await injectUrl(abs, state, ctx)` per matched/deduped URL in the injectFiles loop.
  - P1.M1.T2.S2: adds the readLine url renderer branch (the FileDetail.kind "url" member is already present from Task 3).
  - P1.M2.T1.S1/S2: exercises injectUrl via injectFiles(prompt, [], ctx, false, enableUrls=true) with globalThis.fetch stubbed.
```

## Validation Loop

### Level 1: Syntax & Style (the HARD GATE — run first and last)

```bash
# THE primary gate: proves the defuddle/linkedom imports resolve natively AND the pipeline typechecks
# under --strict (incl. the `doc as Document` cast, the polyfill `any` mutations, the Ctx widening,
# and the FileDetail.kind "url" member). scripts/typecheck.mjs writes a temp tsconfig (moduleResolution
# "Bundler", strict true, skipLibCheck true) with paths ONLY for @earendil-works/* — defuddle/linkedom
# resolve from repo-root node_modules.
npm run typecheck
# Expected: exit 0, "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
# If TS7016 appears for defuddle/node or linkedom → S4's Outcome (a) was wrong; create declarations.d.ts
#   per the S4 PRP's "Fallback shim content" (insurance) and re-run. (Expected NOT to happen.)
# If TS2554 on parseHTML → you passed a 2nd arg; revert to parseHTML(html) (ONE arg — Refinement B).
# If TS23xx on doc.styleSheets/getComputedStyle → you forgot `const doc = document as any;` before mutating.
```

### Level 2: Unit Tests (regression — the 4 functions are private, so this proves no module-surface break)

```bash
# The module-surface allowlist guard (file-injector.test.mjs L136–156) FAILS if any new function is exported
# without registration. Since the 4 functions are PRIVATE, this stays green. The existing ~25 #@file
# assertions + 3 handler guards + headless/notify path must all still pass (the file path is unchanged).
# Loads via jiti from the GLOBAL pi package (alias map does NOT alias defuddle/linkedom → they must be
# real repo-root node_modules deps, which S1 installed).
npm test
# Expected: exit 0. (Requires the global pi package for the jiti loader. If it fails ONLY due to a missing
#   global pi, `npm run typecheck` remains the authoritative gate — see S3 PRP Level 2 note.)
# NOTE: behavioral dispatch/guard tests for injectUrl are P1.M2.T1's job (after T2.S3 wires the loop).
```

### Level 3: Integration Testing (OPTIONAL dev-time smoke — NOT committed; defer behavioral to P1.M2.T1)

```bash
# injectUrl is PRIVATE and not yet wired into injectFiles (T2.S3 not done), so a direct functional smoke
# requires a TEMPORARY export. This is OPTIONAL confidence-building — the default path is typecheck (L1) +
# existing-tests-green (L2) and deferring behavioral validation to P1.M2.T1. If you want immediate feedback:
#
# 1. TEMPORARILY add `export` to injectUrl (and readBodyCapped/readBytesCapped) in file-injector.ts.
# 2. Run a hermetic smoke that stubs globalThis.fetch (NEVER real network) — e.g.:
node --input-type=module -e '
  // (Load via the project jiti loader in real use; the jiti path is what file-injector.test.mjs uses.)
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    "<html><body><article><p>" + ("Hello world article body that exceeds the two hundred char minimum threshold to pass the SPA empty extraction guard cleanly. ".repeat(2)) + "</p></article></body></html>",
    { headers: { "content-type": "text/html" } });
  // import the module, then: const ok = await mod.injectUrl("https://example.com", state, { cwd: "." });
  // console.log({ ok, count: state.count, blocks: state.blocks });
  globalThis.fetch = orig;
'
# Expected (with a real jiti import + a rich-enough HTML fixture): ok=true, count=1, blocks[0] starts with
#   '<file name="https://example.com">'. (defuddle extraction of a trivial article may itself be < 200 chars
#   → if so ok=false with the SPA notify; use a richer fixture if you want ok=true. The point: no throw,
#   no network.) Then REMOVE the temporary `export` keywords before committing (functions ship PRIVATE).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (Behavioral matrix — content-type dispatch × the three guards × SPA fallback × image byte path — is
#  formalized as hermetic tests in P1.M2.T1.S1/S2 with globalThis.fetch stubbed. T2.S1 delivers
#  typechecked, spec-faithful code; P1.M2.T1 proves behavior. No live network in CI.)

# Optional: confirm the two imports resolve NATIVELY (not via a shim) by tracing one specifier.
# (Reuse the S4 PRP's "Probe harness" with --traceResolution; grep for the success lines.)
# Expected: "Module name 'defuddle/node' was successfully resolved" + same for 'linkedom', pointing at
#   node_modules/.../*.d.ts. (Already proven by S4 research — re-running is confirmation only.)
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` exits 0 (the defuddle/linkedom imports resolve + pipeline typechecks under `--strict`).
- [ ] `npm test` exits 0 (module-surface allowlist unchanged; 4 functions private; no `#@file` regression).

### Feature Validation
- [ ] `injectUrl` implements §3.1 content-type dispatch (image / html-or-sniffed / raw-text / else-verbatim).
- [ ] All three §3.3 guards present: AbortController 20s; `Content-Length > cap` skip + capped-reader stream-abort; `remaining !== null && cost > remaining` over-budget verbatim (applies to image path too).
- [ ] §3.4 SPA fallback: `< URL_MIN_CONTENT` → verbatim + `if (ctx.hasUI) ctx.ui?.notify(...)` guarded notify.
- [ ] §3.5 never-throws: whole body in `try { … } catch { return false }` with `clearTimeout` in `finally`.
- [ ] Refinement D honored: image path uses `readBytesCapped` (raw Buffer), text/html/json/xml use `readBodyCapped` (string).
- [ ] Refinements A/B/C honored: `await Defuddle(doc,url,{markdown:true})`; `parseHTML(html)` one-arg; polyfills + `doc.URL=url`.
- [ ] `formatUrlBlock` produces the `<file name="URL">` envelope; image path reuses `formatImageBlock`.
- [ ] `FileDetail.kind` includes `"url"`; `Ctx` includes optional `hasUI`/`ui`.

### Code Quality Validation
- [ ] The four functions are PRIVATE (no `export`) — `file-injector.test.mjs` allowlist untouched.
- [ ] Reuses existing helpers (formatImageBlock/estimateImageTokens/resizeImage/formatDimensionNote/subtract) — no re-declaration, no new State fields.
- [ ] Constants named `URL_*` / `BROWSER_UA` (SCREAMING_SNAKE_CASE) and clustered with the existing tunables.
- [ ] Edits are text-disjoint from S3's regex region (L20–34) and S4 (no source under Outcome a) — clean merge.

### Documentation & Deployment
- [ ] [Mode A] JSDoc on all four functions (dispatch, three guards, SPA fallback, never-throws; readBytesCapped byte-oriented note; formatUrlBlock name=url note).
- [ ] A JSDoc note on the `FileDetail.kind` `"url"` member recording the T2.S1-producer / T2.S2-renderer split.

---

## Anti-Patterns to Avoid

- ❌ Don't call `parseHTML(html, { url })` — it takes ONE arg (TS2554 + ignored). Use `parseHTML(html)` then `doc.URL = url`.
- ❌ Don't skip the polyfills (`doc.styleSheets = []`, `getComputedStyle`) — defuddle's internals read them and THROW without them (silent verbatim via the catch, but extraction never works).
- ❌ Don't feed image bytes through `readBodyCapped` / `Buffer.from(string, "utf8")` — it UTF-8-corrupts binary image data. Images use `readBytesCapped` (raw Buffer).
- ❌ Don't `export` any of the four functions — `file-injector.test.mjs` L136–156 is a strict allowlist; an unregistered export breaks `npm test`. Keep them private (the `injectMarkdown` precedent).
- ❌ Don't forget to add `"url"` to `FileDetail.kind` — `kind: "url"` details won't typecheck without it (T2.S1 is the producer).
- ❌ Don't add a URL scan loop, `enableUrls` wiring, or a `readLine` url branch — those are T2.S3 / T2.S2 (scope creep).
- ❌ Don't add `paths` mappings / `declarations.d.ts` / shims for defuddle/linkedom — S4 proved native resolution (Outcome a).
- ❌ Don't let `injectUrl` throw out the top — every path returns a boolean; the outer try/catch + finally are load-bearing (§3.5: never lose the prompt).
- ❌ Don't apply the over-budget guard ONLY to text — it applies to the image path too (resize first, then guard, then push).
- ❌ Don't strip `ctx.hasUI`/`ctx.ui` guards from the SPA notify — in headless print/json modes ctx.ui is absent; the `?.` + `if (ctx.hasUI)` guard is required.

---

## Confidence Score

**9 / 10** for one-pass success. The integration is almost entirely additive and reuses shipped,
line-located helpers (image recipe, subtract, State, FileDetail). The four defuddle/linkedom
refinements are precisely specified (exact polyfill lines, exact signatures) and pre-verified against
the shipped `.d.ts` (S4 + architecture docs). The two genuine type-widenings (`FileDetail.kind "url"`,
`Ctx` += `hasUI`/`ui`) are proven safe (no exhaustive consumers; additive optional fields). The export
decision (keep private) is proven correct by reading the allowlist guard. Residual risk: defuddle's
extraction semantics on real pages (what `result.content` actually contains) is validated by P1.M2.T1
behavioral tests, not T2.S1 — but T2.S1's typecheck gate is strong and the logic is spec-faithful. The
one residual surface is the SPA notify wording / `ctx.ui?.notify` exact level string, which is cosmetic
and non-blocking.

## Parallel-Safety Note (for the orchestrator / merger)

- **vs P1.M1.T1.S3** (regex constants — already merged at L20–34): T2.S1's edits are at L8 (imports),
  ~L66 (constants), L457 (FileDetail), L852 (Ctx), and the L735→736 gap. **All text-disjoint** from
  S3's `URL_INJECT_RE`/`URL_SHAPE_RE` region. Clean merge either order.
- **vs P1.M1.T1.S4** (typecheck decision — Outcome a, no source): S4 adds no source under Outcome (a).
  T2.S1 adds the imports S4 proved safe. No conflict.
- **vs P1.M1.T1.S1/S2** (deps/config — Complete): T2.S1 consumes their outputs (installed
  node_modules; `enableUrls` is T2.S3's concern). No interaction.
- **vs P1.M1.T2.S2** (FileDetail.kind "url" + readLine branch): T2.S1 adds the **union member**
  (required for its own typecheck); T2.S2 then adds ONLY the readLine renderer branch. The plan's
  wording assigns the member to S2, but S1 produces it first — the merger should treat the member as
  already-present when S2 runs (S2 = readLine branch only).
- **vs P1.M1.T2.S3** (URL loop wiring): T2.S3 calls `injectUrl(abs, state, ctx)` — the signature is
  fixed here. T2.S3 owns the scan loop + `enableUrls !== false` gate + the input-handler pre-check
  broadening. No overlap.