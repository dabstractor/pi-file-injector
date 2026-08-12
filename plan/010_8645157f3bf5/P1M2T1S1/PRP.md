# PRP — P1.M2.T1.S1: Detection + dispatch + collision tests (hermetic `url-injection.test.mjs`)

---

## Goal

**Feature Goal**: Add a hermetic, zero-network test suite (`url-injection.test.mjs`) that
proves the `#<url>` detection regex, the content-type dispatch, and the §2.3 collision rules
all behave per spec — by loading the **real committed `file-injector.ts`** through the same
jiti+alias harness as `file-injector.test.mjs`, stubbing `globalThis.fetch` per-test, and
asserting on the `injectFiles` return shape. Every assertion runs offline; no HTTP ever
leaves the process.

**Deliverable**:
1. **NEW FILE** `url-injection.test.mjs` at repo root — a standalone Node ESM script (no test
   framework), mirroring `file-injector.test.mjs`'s harness exactly (same jiti load, same
   `@earendil-works/*` alias map, same `assert`/`runCase` + pass/fail matrix, exit 0/1).
2. **ONE EDIT** to `package.json`: append `&& node ./url-injection.test.mjs` as the **4th entry**
   in `scripts.test` (after `relative-imports.test.mjs`).

**Success Definition**:
- `node ./url-injection.test.mjs` exits **0** with every named assertion green and **ZERO
  real network calls** (verified by a `fetch` call-count tracker that is asserted in every case).
- `npm test` exits 0 — the new file is chained in and passes alongside the existing three.
- `npm run typecheck` still exits 0 (no source touched; this item is TESTS ONLY).

## User Persona

**Target User**: The maintainer + CI. (Indirectly: every Pi user who types `#example.com`.)
**Use Case**: On every commit/PR, CI runs `npm test`; the URL matrix runs hermetically and
deterministically, catching any regression in detection/dispatch/collision without a network
or a live model.
**User Journey**: dev edits `file-injector.ts` → `npm test` → the url-injection matrix prints
✓ for DETECTION/DISPATCH/COLLISION/SCHEME-LESS groups → exit 0.
**Pain Points Addressed**: P1.M1.T2.S3 explicitly deferred behavioral tests to P1.M2.T1; this
item IS that deferred validation. Without it, the `#<url>` feature ships untested.

## Why

- **Closes the deferred-validation gap.** T2.S1 (pipeline) and T2.S3 (scan loop) ship
  typechecked, spec-faithful code but prove NO behavior. This item proves detection,
  content-type dispatch, and the collision rules actually fire.
- **Deterministic + air-gapped.** Every fetch is a stub returning a Response-shaped object;
  the call-count tracker lets each case assert "fetch was/wasn't called" — impossible to
  flake on network/DNS, and it doubles as the spec §4 `enableUrls:false` → zero-egress proof.
- **Mirrors a proven convention.** `file-injector.test.mjs` already established the repo's
  "standalone .mjs gate" convention (jiti load, no framework, exit-code gate). This file is
  its URL twin — same structure, different domain.

## What

### Success Criteria

- [ ] `url-injection.test.mjs` loads `file-injector.ts` via jiti from the GLOBAL pi package
      (alias map maps ONLY `@earendil-works/*`; defuddle/linkedom resolve from repo node_modules).
- [ ] **DETECTION** group: `#example.com` (rich HTML mock → defuddle markdown ≥200 chars)
      and `#https://x.com/y` both inject → `r.injected === 1`, block has
      `<file name="https://example.com">` envelope, `r.details[0].kind === "url"`.
- [ ] **DISPATCH** group: `text/plain` → raw text verbatim in block (NO defuddle); `application/json`
      → raw JSON; `text/xml` → raw XML; `image/png` → `r.images.length === 1`,
      `r.details[0].kind === "image"`, and the mock image bytes are preserved byte-exactly
      (`r.images[0].data === mockBytes.toString("base64")`).
- [ ] **COLLISION** group (§2.3): `#@file.txt` is a file not a URL (fetch NOT called); `# Heading` /
      `#1234` / `#fff` / `#v1.2` / `#3.14` → `r.injected === 0`, no fetch; `foo#example.com` mid-word →
      not matched, no fetch; `#node.js` → URL-shaped, fetch returns 404 → verbatim (fetch CALLED,
      `r.injected === 0`); `#@file.txt` + `#example.com` in one prompt → two injected (shared budget).
- [ ] **SCHEME-LESS NORMALIZATION** group: `#example.com` + `#https://example.com` in one prompt →
      dedup to ONE injection (`r.injected === 1`, fetch called exactly once).
- [ ] `package.json` `scripts.test` chains `node ./url-injection.test.mjs` as the 4th entry.

## All Needed Context

### Context Completeness Check

_Pass._ "If someone knew nothing about this codebase, would they have everything needed?" — **Yes.**
The exact harness (copy-pasteable jiti loader + alias map + assert/runCase), the exact
`injectUrl`/scan-loop behavior (verified line-by-line from the shipped source), the exact
fetch-stub Response shape, the CALIBRATED HTML fixture (defuddle yields 1024 chars of markdown —
well above the 200-char floor), the exact collision outcomes, and the exact package.json edit
are all below. No inference required.

### Documentation & References

```yaml
# MUST READ — the spec sections this test suite encodes.
- docfile: plan/010_8645157f3bf5/prd_snapshot.md
  why: §2.3 collision table + §3.1 content-type dispatch + §7 edge cases → the assertion targets.
  section: "Feature: URL Web-Content Injection" → "2. Grammar & detection" + "3. Behavior" + "7. Edge cases"
  critical: the collision table is the literal oracle for the COLLISION group; §3.1 rows are the DISPATCH group.

# MUST READ — the production code under test (READ-ONLY for this item; do NOT edit it).
- file: file-injector.ts
  why: injectUrl (L830–916) + the URL scan loop (L1404–1412) + URL_INJECT_RE/URL_SHAPE_RE (L24–37) +
        cleanToken/TRAILING_PUNCT (L45,121) are exactly what these tests exercise.
  pattern: L830 dispatch (image / text-html-sniff / raw-text / else-verbatim); L1405–1411 loop+dedup.
  gotcha: injectUrl and the URL_* regexes are PRIVATE — exercise them ONLY via injectFiles(prompt,[],ctx,_,enableUrls).

# MUST READ — the harness to COPY (same jiti load, alias map, assert/runCase, FIX fixture, hasBlock).
- file: file-injector.test.mjs
  why: L1–200 define the load mechanism + the assertion harness + the ctx fixture. This is the template.
  pattern: resolvePiPackageRoot() → createJiti(alias) → jiti.import(TS_PATH) → runCase(n,name,fn) → exit code.
  gotcha: bare `import {createJiti} from "jiti"` FAILS (jiti nested in pi) — MUST dynamic-import PIPKG+"/node_modules/jiti/lib/jiti.mjs".

# MUST READ — the dependency PRP (the code this test consumes; assume it is implemented exactly as specified).
- docfile: plan/010_8645157f3bf5/P1M1T2S3/PRP.md
  why: defines injectFiles(text,imagesIn,ctx,bareAt=false,enableUrls=true) → {text,images,injected,paged,blocks,details}
        and the scan loop contract this suite exercises.
  take: call `mod.injectFiles(prompt, [], FIX, false, true)`; assert on r.injected / r.blocks / r.details / r.images.

# Calibration proof (defuddle fixture reliability).
- docfile: plan/010_8645157f3bf5/P1M2T1S1/research/notes.md
  why: §5 records a LIVE defuddle probe — the 3-paragraph <article> yields 1024 chars of markdown (≥200 floor).
  critical: use a RICH <article> fixture; trivial "<p>Hello</p>" may extract <200 chars → SPA fallback → false negative.
```

### Current Codebase tree (files this item touches)

```bash
.
├── file-injector.ts          # NOT modified (READ-ONLY — the code under test)
├── package.json              # EDIT: scripts.test += "&& node ./url-injection.test.mjs" (4th entry)
├── url-injection.test.mjs    # NEW — the hermetic URL test suite (this item's deliverable)
├── file-injector.test.mjs    # NOT modified (the harness template to copy; its existing cases stay green)
├── scripts/typecheck.mjs     # NOT modified
├── node_modules/             # PRESENT — defuddle/linkedom/turndown/temml/mathml-to-latex (S1)
└── package-lock.json         # NOT modified
```

### Desired Codebase tree with files to be added

```bash
url-injection.test.mjs   # NEW. Sections (mirror file-injector.test.mjs):
#   1. Header comment (what/why/run)
#   2. node: imports (execSync, url, path, os, fsSync)
#   3. resolvePiPackageRoot() + PIPKG  (identical to file-injector.test.mjs)
#   4. jiti load with @earendil-works/* alias map (identical)
#   5. jiti.import("file-injector.ts") → mod
#   6. sanity: assert typeof mod.injectFiles === "function"
#   7. assert / runCase / matrix harness + FIX = { cwd: TMPDIR }
#   8. makeRes() fetch-response factory + HTML fixture + image bytes
#   9. DETECTION / DISPATCH / COLLISION / SCHEME-LESS groups (runCase per assertion)
#  10. summary + process.exit(failed ? 1 : 0)
package.json             # scripts.test: 4th entry appended.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL (load mechanism): bare `import { createJiti } from "jiti"` FAILS — jiti is NESTED inside the
//   global pi package and not resolvable from arbitrary dirs. MUST dynamic-import PIPKG+"/node_modules/jiti/lib/jiti.mjs".
//   defuddle/linkedom are NOT in the alias map → they resolve from repo-root node_modules (installed by S1).
//   (Verified identical to file-injector.test.mjs L36–59.)

// CRITICAL (exercise via injectFiles only): injectUrl, readBodyCapped, readBytesCapped, formatUrlBlock,
//   URL_INJECT_RE, URL_SHAPE_RE are ALL PRIVATE. file-injector.test.mjs enforces a strict export allowlist
//   (L136–156). Do NOT add exports for them. Drive everything through: mod.injectFiles(prompt, [], FIX, false, true).

// CRITICAL (verbatim prompt): r.text is the ORIGINAL prompt byte-for-byte — #<url> is NEVER stripped
//   (so cancel/re-open/fork re-triggers). Do NOT assert r.text has the token removed; assert it's unchanged.

// CRITICAL (count===0 images ref): when nothing injects, injectFiles returns images: imagesIn (the ORIGINAL
//   array ref passed in, here []). So r.images === [] (same ref). For image cases, assert r.images.length === 1.

// CRITICAL (HTML fixture richness): the HTML path applies a 200-char SPA floor on the EXTRACTED markdown.
//   A trivial "<p>hi</p>" may extract <200 chars → injectUrl returns false (SPA fallback) → r.injected === 0
//   → false negative. Use a rich <article> (title + 3 substantial paragraphs). Verified: yields 1024 chars.

// CRITICAL (raw-text path has NO 200-char floor): text/plain/json/xml are injected VERBATIM with no extraction.
//   Short bodies are fine for the DISPATCH group. (The 200 floor is ONLY in the HTML branch — source L896.)

// CRITICAL (image byte-exact): resizeImage returns null for non-processable bytes → fallback
//   data = buf.toString("base64"). Assert r.images[0].data === mockBytes.toString("base64") to prove the BYTE
//   reader (readBytesCapped) preserved raw bytes — a UTF-8 string reader would CORRUPT them. Use non-ASCII bytes.

// CRITICAL (enableUrls default true): injectFiles's 5th param defaults true, so omitting it enables URLs.
//   Pass enableUrls=false explicitly for the no-network case (P1.M2.T1.S2's job; this item stays default-true).

// GOTCHA (fetch call tracking): every case MUST set globalThis.fetch in try{} and restore in finally{}.
//   A shared `calls = []` array records each fetch(url). The no-fetch assertions (collisions, enableUrls)
//   assert calls.length === 0; the dedup case asserts calls.length === 1. This is the spec §4 zero-egress proof.

// GOTCHA (Response stub body): readBytesCapped/readBodyCapped call res.body?.getReader() then loop reader.read().
//   The stub's getReader().read() must return {done:false, value:Uint8Array} then {done:true, value:undefined}.
//   A Buffer IS a Uint8Array (Buffer.from(value) copies it cleanly in both readers). Provide res.text() too
//   (the readers' no-reader fallback). Provide res.arrayBuffer() only if you omit getReader (not needed here).
```

## Implementation Blueprint

### Data models and structure

No data models. The suite is a standalone script. The only "model" is the **mock fetch Response**
shape (a plain object, NOT `new Response(...)` — keeps the stub inspectable and dependency-free):

```js
// Response-shaped object consumed by injectUrl (matches what readBytesCapped/readBodyCapped read).
function makeRes({ ct = "text/html", body = "", status = 200, ok = true, contentLength } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return {
    ok, status,
    headers: { get: (k) => {
      const lk = k.toLowerCase();
      if (lk === "content-type") return ct;
      if (lk === "content-length") return contentLength != null ? String(contentLength) : null;
      return null;
    }},
    body: { getReader: () => { let done = false; return { read: async () => {
      if (done) return { done: true, value: undefined };
      done = true; return { done: false, value: buf }; // one chunk; Buffer IS a Uint8Array
    }};}},
    text: async () => buf.toString("utf8"), // readers' no-reader fallback (not used when getReader exists)
  };
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE url-injection.test.mjs — sections 1–7 (scaffold, IDENTICAL load to file-injector.test.mjs)
  - COPY verbatim from file-injector.test.mjs L1–200: node: imports, resolvePiPackageRoot(), the PIPKG const,
    the createJiti dynamic-import + the @earendil-works/* alias map, jiti.import(TS_PATH), and the
    assert()/runCase()/matrixRows harness.
  - CHANGE ONLY: the header comment (URL suite, not #@file), the TS_PATH sanity asserts (assert
    typeof mod.injectFiles === "function"; assert typeof mod.cleanToken === "function" — both exported),
    and the fixture name prefix ("ui-" → reuse, fine).
  - ADD: `const FIX = { cwd: TMPDIR };` and `function hasBlock(r, needle){ return r.blocks.some(b => b.includes(needle)); }`
    (copy from file-injector.test.mjs L361 / the blocksText helpers).
  - DO NOT copy the file-injector fixtures (a.ts, huge.log, PNG_BYTES, buildFixtures) — URL tests don't need them.

Task 2: ADD the mock layer (section 8) — makeRes + fixtures + calls tracker
  - IMPLEMENT makeRes() exactly as in "Data models" above.
  - DEFINE a rich HTML fixture constant (RICH_HTML): a full document with <title> + an <article> of 3
    substantial paragraphs (≥ ~3 KB). Verified yield: 1024 chars of markdown (clears the 200-char floor).
  - DEFINE IMG_BYTES: a Buffer of non-ASCII bytes (e.g. Buffer.from a tiny/invalid PNG base64, or
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0xFF,0xFE,0x00,0x80])) so resizeImage → null
    (byte-exact fallback path) and UTF-8 corruption would be detectable.
  - DEFINE a file.txt fixture path + content: write a temp file at path.join(TMPDIR,"file.txt") so the
    #@file.txt collision case injects it as a FILE (proves #@ still works AND fetch isn't called for it).
  - PATTERN for fetch stub per case:
        const calls = [];
        try {
          globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct, body, status }); };
          const r = await mod.injectFiles(prompt, [], FIX, false, true);
          // …assertions…
        } finally { globalThis.fetch = origFetch; }   // restore ALWAYS

Task 3: ADD the DETECTION group
  - runCase "DET-1": prompt "#example.com", stub returns text/html + RICH_HTML.
        assert r.injected === 1
        assert hasBlock(r, '<file name="https://example.com">')
        assert r.details.length === 1 && r.details[0].kind === "url"
        assert calls.length === 1 && calls[0] === "https://example.com"   (scheme-less normalized to https://)
        assert r.text === "#example.com"   (verbatim)
  - runCase "DET-2": prompt "#https://x.com/y", stub returns text/html + RICH_HTML (title only path fine).
        assert r.injected === 1
        assert hasBlock(r, '<file name="https://x.com/y">')
        assert r.details[0].kind === "url"
        assert calls[0] === "https://x.com/y"

Task 4: ADD the DISPATCH group (content-type routing)
  - runCase "DIS-1 text/plain": prompt "#example.com", stub ct "text/plain", body "plain body line\n".
        assert r.injected === 1
        assert hasBlock(r, "plain body line")           (raw text in block, NO extraction)
        assert !blocksContainDefuddleArtifacts          (body is verbatim — assert the exact body string is present)
        assert r.details[0].kind === "url"
  - runCase "DIS-2 application/json": stub ct "application/json", body '{"k":"v","n":3}'.
        assert hasBlock(r, '{"k":"v","n":3}')           (raw JSON, not mangled through defuddle)
  - runCase "DIS-3 text/xml": stub ct "text/xml", body '<root><item>1</item></root>'.
        assert hasBlock(r, '<root><item>1</item></root>')
  - runCase "DIS-4 image/png": stub ct "image/png", body IMG_BYTES (Buffer).
        assert r.images.length === 1
        assert r.images[0].data === IMG_BYTES.toString("base64")   (BYTE-EXACT — proves byte reader, not UTF-8)
        assert Buffer.from(r.images[0].data, "base64").equals(IMG_BYTES)
        assert r.images[0].mimeType === "image/png"
        assert r.details.length === 1 && r.details[0].kind === "image"
        assert r.injected === 1

Task 5: ADD the COLLISION group (§2.3 table)
  - runCase "COL-1 #@file is a FILE not URL": prompt "#@file.txt" (file.txt exists in TMPDIR). stub any.
        assert calls.length === 0                          (URL regex (?!@) never fires; NO fetch)
        assert r.injected === 1                            (the FILE path injects it)
        assert r.details[0].kind === "text"               (file, not url/image)
        assert hasBlock(r, '<file name="') && !hasBlock(r, 'name="https://')   (it's a local path)
  - runCase "COL-2 prose untouched": prompt "# Heading and #1234 #fff #v1.2 #3.14".
        assert calls.length === 0                          (none are URL-shaped; NO fetch)
        assert r.injected === 0
        assert r.text === prompt                           (verbatim)
  - runCase "COL-3 mid-word #": prompt "see foo#example.com here".
        assert calls.length === 0                          (# not at boundary → not matched)
        assert r.injected === 0
  - runCase "COL-4 #node.js no-op": prompt "#node.js", stub returns 404 (ok:false, status:404).
        assert calls.length === 1                          (URL-SHAPED → fetch IS called)
        assert r.injected === 0                            (404 → verbatim; no block)
        assert !hasBlock(r, '<file name="https://node.js">')
  - runCase "COL-5 file + url shared budget": prompt "#@file.txt and #example.com", file.txt exists,
        stub returns text/html + RICH_HTML.
        assert r.injected === 2                            (one file + one url; shared budget, two green lines)
        assert calls.length === 1                          (only example.com fetched; file.txt is local)
        assert r.details.some(d => d.kind === "text") && r.details.some(d => d.kind === "url")

Task 6: ADD the SCHEME-LESS NORMALIZATION group (dedup)
  - runCase "NORM-1 dedup": prompt "#example.com and also #https://example.com", stub returns text/html + RICH_HTML.
        assert r.injected === 1                            (both normalize to https://example.com → ONE injection)
        assert calls.length === 1                          (deduped before fetch)
        assert r.details.length === 1 && r.details[0].kind === "url"
        assert hasBlock(r, '<file name="https://example.com">')

Task 7: ADD summary + exit code (section 10)
  - PRINT a pass/fail matrix grouped by DETECTION/DISPATCH/COLLISION/SCHEME-LESS.
  - PRINT `if (failed) { console.error(...); process.exit(1); } console.log("all green"); process.exit(0);`
  - NAMING: case ids DET-1..DET-2, DIS-1..DIS-4, COL-1..COL-5, NORM-1 (mirrors file-injector.test.mjs's
    descriptive ids). Each runCase is independent (own try/finally fetch restore).

Task 8: EDIT package.json — chain the new test
  - CHANGE scripts.test FROM:
      "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
    TO:
      "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs"
  - PLACEMENT: 4th entry (appended after relative-imports.test.mjs). Do NOT reorder or remove existing entries.
  - PRESERVE: every other package.json field verbatim.

Task 9: VALIDATE (no code)
  - RUN: node ./url-injection.test.mjs   → EXPECT exit 0, all ✓.
  - RUN: npm test                         → EXPECT exit 0 (all four scripts pass).
  - RUN: npm run typecheck                → EXPECT exit 0 (no source touched; regression guard).
```

### Implementation Patterns & Key Details

```js
// ── The fetch stub per-case pattern (LOAD-BEARING — restore in finally or later cases inherit a stale stub) ──
const origFetch = globalThis.fetch;
await runCase("DET-1", "detection: #example.com injects via HTML pipeline", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, '<file name="https://example.com">'), "block must carry the <file name=\"URL\"> envelope");
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
    assert(calls.length === 1 && calls[0] === "https://example.com", `scheme-less normalized to https://; calls=${JSON.stringify(calls)}`);
    assert(r.text === "#example.com", "prompt preserved verbatim (token never stripped)");
  } finally { globalThis.fetch = origFetch; }
});

// ── The image byte-exact assertion (mirrors file-injector.test.mjs Case 3, L448–463) ──
//   resizeImage returns null for non-processable bytes → fallback data = buf.toString("base64").
//   Asserting base64 round-trip PROVES readBytesCapped (byte reader), not readBodyCapped (UTF-8 string).
await runCase("DIS-4", "dispatch: image/png → images[] + image detail, bytes preserved", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: IMG_BYTES }); };
    const r = await mod.injectFiles("#example.com/img.png", [], FIX, false, true);
    assert(r.images.length === 1, `expected 1 image, got ${r.images.length}`);
    assert(r.images[0].data === IMG_BYTES.toString("base64"), "img.data must be raw base64 of the ORIGINAL bytes (byte reader, not UTF-8)");
    assert(Buffer.from(r.images[0].data, "base64").equals(IMG_BYTES), "decoded image bytes must deep-equal the mock bytes");
    assert(r.images[0].mimeType === "image/png", `mimeType must be 'image/png', got ${r.images[0].mimeType}`);
    assert(r.details.length === 1 && r.details[0].kind === "image", `detail kind must be 'image', got ${r.details[0]?.kind}`);
    assert(r.injected === 1, `image injects (count++); got injected===${r.injected}`);
  } finally { globalThis.fetch = origFetch; }
});

// ── The 404 verbatim case (distinguishes "URL-shaped but unresolvable" from "not URL-shaped") ──
await runCase("COL-4", "collision: #node.js URL-shaped → 404 → verbatim (fetch CALLED)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles("#node.js", [], FIX, false, true);
    assert(calls.length === 1, `#node.js IS url-shaped → fetch must be called; calls=${calls.length}`);
    assert(r.injected === 0, `404 → verbatim, no block; got injected===${r.injected}`);
    assert(!hasBlock(r, '<file name="https://node.js">'), "no block appended on 404");
  } finally { globalThis.fetch = origFetch; }
});

// ── The no-fetch collision case (the spec §4 zero-egress proof, at the detection layer) ──
await runCase("COL-2", "collision: #Heading #1234 #fff #v1.2 #3.14 → prose, NO fetch", async () => {
  const calls = []; const prompt = "# Heading and #1234 #fff #v1.2 #3.14";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // would be a bug if called
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `no URL-shaped token → ZERO fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; got ${r.injected}`);
    assert(r.text === prompt, "verbatim");
  } finally { globalThis.fetch = origFetch; }
});
```

### Integration Points

```yaml
PACKAGE.JSON:
  - edit: scripts.test  (append "&& node ./url-injection.test.mjs" as the 4th entry — see Task 8)
  - preserve: every other field (deps, files, pi.extensions, peerDependencies) verbatim.
NO SOURCE CHANGES:
  - file-injector.ts is READ-ONLY for this item. Do NOT export injectUrl/regexes, do NOT add hooks.
NO CONFIG:
  - enableUrls defaults true in injectFiles (5th param); tests pass it explicitly for clarity.
```

## Validation Loop

### Level 1: Syntax & Style (the new test file is plain ESM; lint via typecheck is a no-op for it)

```bash
# No linter is configured in this repo (typecheck targets file-injector.ts only). The gate for this item is:
node --check ./url-injection.test.mjs        # parse-only syntax check (fast, no execution)
# Expected: no output, exit 0 (valid JS module). Fix any syntax error before running the suite.
```

### Level 2: Unit Tests (the deliverable IS the test — run it directly)

```bash
# Run the new suite in isolation. Requires the GLOBAL pi package (for the jiti loader) + repo node_modules
# (defuddle/linkedom — installed by P1.M1.T1.S1). NO network: every fetch is a stub.
node ./url-injection.test.mjs
# Expected: prints the DETECTION/DISPATCH/COLLISION/SCHEME-LESS matrix, all ✓, "all green", exit 0.
# If a case prints ✗: READ the message (it names the exact assertion + actual value), then fix the
#   assertion OR the fixture (most likely cause: an HTML fixture that extracts <200 chars → raise RICH_HTML size).
```

### Level 3: Integration Testing (the chained gate)

```bash
# The full repo gate — the new suite is the 4th entry. All four must pass.
npm test
# Expected: exit 0 (file-injector + import-behavior + relative-imports + url-injection all green).
# If npm test fails ONLY at the url-injection step: run it directly (Level 2) to see which case failed.
```

### Level 4: Hermetic / zero-network proof

```bash
# PROVE no real network egress occurs. Block all sockets, then run the suite — it must still pass
# (every fetch is a stub; the `calls` tracker already asserts per-case, but this is belt-and-suspenders).
# (Optional, dev-time confidence — not a committed step. Skip if your env can't block sockets.)
node --input-type=module -e '
  import { read } from "node:fs/promises";
  const src = await read("./url-injection.test.mjs","utf8");
  if (!/globalThis\.fetch\s*=/.test(src)) throw new Error("fetch is never stubbed — suite would hit the real network!");
  console.log("ok: fetch is stubbed in the suite");
'
# Expected: "ok: …". (Confirms the suite is hermetic by construction.)
```

## Final Validation Checklist

### Technical Validation
- [ ] `node --check ./url-injection.test.mjs` exits 0 (valid module).
- [ ] `node ./url-injection.test.mjs` exits 0 (all DETECTION/DISPATCH/COLLISION/SCHEME-LESS ✓).
- [ ] `npm test` exits 0 (the new file is chained and passes alongside the existing three).
- [ ] `npm run typecheck` exits 0 (no source touched; regression guard).

### Feature Validation
- [ ] DETECTION: both `#example.com` and `#https://x.com/y` inject with `kind:"url"` + the `<file name="URL">` envelope.
- [ ] DISPATCH: text/plain + application/json + text/xml inject verbatim (raw text, no defuddle); image/png → `images[]` + `kind:"image"` byte-exact.
- [ ] COLLISION: `#@file.txt` → file (no fetch); prose tokens → no fetch + `injected===0`; mid-word → no fetch; `#node.js` → 404 → verbatim (fetch called); file+url → two injected.
- [ ] SCHEME-LESS: `#example.com` + `#https://example.com` → ONE injection, ONE fetch.
- [ ] Every case restores `globalThis.fetch` in `finally`; the `calls` tracker proves the no-egress invariant.

### Code Quality Validation
- [ ] Mirrors `file-injector.test.mjs`'s harness (same jiti load, alias map, assert/runCase, FIX) — no new convention.
- [ ] No exports added to `file-injector.ts` (injectUrl/regexes stay PRIVATE; the allowlist guard stays green).
- [ ] `package.json` change is the single-line `scripts.test` append; nothing else touched.

### Documentation & Deployment
- [ ] Header comment explains what/why/run (self-documenting — [Mode A] for test files, per the item contract).
- [ ] No README change needed (test files are self-documenting; the package.json test-script change is the only doc surface).

---

## Anti-Patterns to Avoid

- ❌ Don't `import` jiti bare — it's nested in the global pi package; dynamic-import `PIPKG+"/node_modules/jiti/lib/jiti.mjs"`.
- ❌ Don't alias defuddle/linkedom in the jiti `alias` map — they resolve from repo `node_modules` (the harness relies on this; aliasing would mask a missing dep).
- ❌ Don't use a trivial HTML fixture (`<p>hi</p>`) — defuddle may extract <200 chars → SPA fallback → `injected===0` false negative. Use the rich `<article>` (verified 1024-char yield).
- ❌ Don't forget the `finally { globalThis.fetch = origFetch; }` — a leaked stub poisons later cases and can mask real fetches.
- ❌ Don't assert `r.text` has the `#<url>` removed — the prompt is ALWAYS verbatim (re-trigger on cancel/fork).
- ❌ Don't feed image bytes through a string-typed `makeRes` body — pass a `Buffer` (the byte reader needs raw bytes; a UTF-8 string would defeat the byte-exact assertion).
- ❌ Don't add real network calls "just to check" — the suite is hermetic by contract; the `calls` tracker IS the no-network proof.
- ❌ Don't export anything from `file-injector.ts` to make testing easier — the module-surface allowlist guard (file-injector.test.mjs L136–156) will fail `npm test`. Drive everything via `injectFiles`.
- ❌ Don't reorder/remove the existing `scripts.test` entries — APPEND only, as the 4th entry.

---

## Confidence Score

**9 / 10** for one-pass success. Every load-bearing fact is verified against the shipped source:
the exact jiti load mechanism (file-injector.test.mjs L1–200), the exact `injectUrl` dispatch +
guards + SPA floor (file-injector.ts L830–916), the exact scan loop + dedup-on-absolute-form
(L1404–1412), the exact regexes + cleanToken (L24–37, L45, L121), the exact injectFiles return
shape (L1417/L1426), and a LIVE-calibrated HTML fixture (defuddle yields 1024 chars ≥ 200 floor).
The image byte-exact pattern mirrors the existing green Case 3 verbatim. Residual risk: defuddle's
extraction on the chosen RICH_HTML is calibrated empirically (1024 chars) but edge-dependant —
the PRP's `RICH_HTML` guidance (3 substantial paragraphs) is the verified-safe shape; if a
particular wording extracts thinner, the assertion message names the exact value to debug. The
`package.json` one-liner and the exit-code gate are trivial and deterministic.

## Parallel-Safety Note (for the orchestrator / merger)

- **vs P1.M1.T2.S3** (URL scan loop — Implementing): this item CONSUMES T2.S3's `injectFiles(prompt,…,enableUrls)`
  output. The loop is already wired in the current source (L1404–1412), so the suite runs against real code.
  If T2.S3 lands AFTER this item, the suite will simply start passing once T2.S3 merges — no conflict (this
  item adds a NEW file + one package.json line; T2.S3 edits file-injector.ts only → text-disjoint).
- **vs P1.M2.T1.S2** (failure/guard tests sibling): S1 owns DETECTION/DISPATCH/COLLISION/SCHEME-LESS;
  S2 owns the FAILURE/guard cases (all→verbatim, no-network-when-disabled, timeout, cap, over-budget, SPA).
  No overlap. S1's `makeRes`/`RICH_HTML`/`IMG_BYTES`/fetch-stub pattern is reusable by S2 (same file conventions,
  but S2 writes its OWN cases in its OWN file or extends this one — S1 does not pre-allocate S2's cases).
- **vs P1.M1.T2.S1/S2** (pipeline + renderer): this item tests their OUTPUT, edits neither. Clean.
- **vs file-injector.test.mjs** (the #@file suite): this is a SEPARATE file. The only shared surface is the
  `package.json` `scripts.test` line — S1 appends ONE entry; no existing entry changes.