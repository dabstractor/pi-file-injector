# Research Notes — P1.M2.T1.S1 (Detection + dispatch + collision tests)

Verbatim-verified facts (source: `file-injector.ts`, `file-injector.test.mjs`, live defuddle probe).
The implementation contract (item LOGIC) is authoritative; these notes CONFIRM it against the real code.

## 1. Test harness pattern (copied from `file-injector.test.mjs` L1–200)

- Standalone zero-dep Node ESM script. NO test framework. Exit 0 on success / 1 on failure.
- Load mechanism (LOAD-BEARING — bare `import` of jiti FAILS):
  ```js
  const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
  const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(import.meta.url, { alias: {
      "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
      "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
      "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  }});
  const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));
  ```
- defuddle/linkedom are **NOT** in the alias map → resolve from repo-root `node_modules` (installed by P1.M1.T1.S1; confirmed present).
- Assertion helpers (copy verbatim):
  ```js
  function assert(cond, msg){ if(!cond) throw new Error(msg); }
  async function runCase(n, name, fn){ try{ await fn(); passed++; console.log(`  ✓ ${n}: ${name}`); }
    catch(e){ failed++; console.log(`  ✗ ${n}: ${name}\n      → ${e.message}`); } }
  ```
- Fixture: `const FIX = { cwd: TMPDIR };` where `TMPDIR = fsSync.mkdtempSync(path.join(os.tmpdir(),"ui-"));`
- Helpers: `function hasBlock(r, needle){ return r.blocks.some(b => b.includes(needle)); }`

## 2. injectUrl behavior — VERIFIED from `file-injector.ts` L830–916

Signature: `async function injectUrl(url, state, ctx): Promise<boolean>` (PRIVATE — exercised via injectFiles).
Dispatch by `Content-Type` (`ct = (res.headers.get("content-type")||"").toLowerCase()`):
- **`ct.startsWith("image/")`** → `readBytesCapped` (raw Buffer) → `resizeImage(Uint8Array(buf), mime)`:
  - `resized === null` (resize fails) → fallback `data = buf.toString("base64")`, `mimeType = mime` (mime = ct before `;`).
  - pushes `state.images.push({type:"image", data, mimeType})`, `state.blocks.push(formatImageBlock(url,resized))`,
    `state.details.push({path:url, kind:"image", dimensionHint})`, `subtract`, `count++`, return true.
- **`ct.startsWith("text/html") || /^\s*</.test(html)`** → parseHTML(html) [1-arg] + polyfills + `await Defuddle(doc,url,{markdown:true})`:
  - `md = (r.content ?? "").trim()`. If `md.length < 200` → SPA fallback (return false; notify if `ctx.hasUI`).
  - else `body = (r.title ? "# "+r.title+"\n\n" : "") + md`.
- **raw text** (`ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("markdown")`) → `body = html` (verbatim, NO 200-char floor).
- **else** (PDF, octet-stream…) → return false (verbatim).
Guards (any failing → return false, NO block, NO throw):
1. AbortController 20s; 2a. `Content-Length > URL_MAX_BYTES` skip; 2b. capped readers stream-abort → null; 3. over-budget.
Whole body in `try{}catch{return false}finally{clearTimeout}`. **Never throws.**

Block envelope: `formatUrlBlock(url,body)` = `'<file name="'+url+'">\n'+body+'\n</file>'` (same as text files).
Detail (text/html + raw-text paths): `{ path: url, kind: "url", chars: body.length }`.

## 3. URL scan loop — VERIFIED from `file-injector.ts` L1404–1412 (T2.S3 WIRED)

```ts
if (enableUrls) {                                   // 5th param, default true
  for (const m of text.matchAll(URL_INJECT_RE)) {
    const tok = cleanToken(m[2]);                   // strips trailing TRAILING_PUNCT
    if (tok && URL_SHAPE_RE.test(tok)) {
      const abs = /^https?:\/\//i.test(tok) ? tok : "https://"+tok;   // scheme-less → https://
      if (!state.injectedSet.has(abs)) {            // DEDUP on ABSOLUTE form
        state.injectedSet.add(abs);
        await injectUrl(abs, state, ctx);
      }
    }
  }
}
```
- `enableUrls === false` → loop body SKIPPED → **ZERO fetch calls** (air-gapped opt-out). Confirms the no-network test.
- `#example.com` and `#https://example.com` both normalize to `https://example.com` → dedup → ONE fetch.
- Returns `{ text, images, injected: state.count, paged, blocks, details }`. `text` is the **verbatim** prompt (#<url> NEVER stripped). When count===0, returns `{text, images: imagesIn, injected:0, paged:0, blocks:[], details:[]}` (images = ORIGINAL ref).

## 4. Regexes — VERIFIED from `file-injector.ts` L24–37

```ts
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;   // # at boundary, NOT #@, token in group 2
const URL_SHAPE_RE  = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
const TRAILING_PUNCT = ".,;:!?\")]}>'";   // cleanToken strips these repeatedly
```
Collision outcomes (§2.3), all CONFIRMED against the regexes:
- `#example.com` → shape match (dotted host, alpha TLD `com`). `#https://x.com/y` → scheme. → fetch.
- `#@file.txt` → `(?!@)` excludes → FILE regex only (disjoint). NO fetch.
- `# Heading` → space; `Heading` not URL-shaped. `#1234`/`#fff`/`#tag` → no dot/scheme. → NO fetch.
- `#v1.2` / `#3.14` → final label numeric → fails `[a-z]{2,}` alpha-TLD gate. → NO fetch.
- `foo#example.com` → `#` preceded by `o` (word char) → lookbehind `(?<![\p{L}\p{N}_])` FAILS → not matched. NO fetch.
- `#node.js` → alpha TLD `js` matches shape → fetch `https://node.js` → 404/DNS → verbatim (fetch CALLED but returns false).

## 5. defuddle fixture CALIBRATION (live probe, repo node_modules)

Probe HTML = `<article>` with title + 3 substantial paragraphs (≈3 KB). Result:
- `title = "Example Domain Test Page"` (preserved).
- extracted markdown length = **1024 chars** → comfortably clears the 200-char SPA floor.
- markdown starts with `## Welcome to the Example Domain` then the paragraphs.

→ The DETECTION fixture is RELIABLE. Use the SAME shape (real `<article>` + title + 3 long paragraphs). Do NOT use trivial `<p>Hello</p>` — defuddle may extract <200 chars → SPA fallback → test fails.

## 6. Image byte-exact path (mirrors existing `file-injector.test.mjs` Case 3)

`PNG_BYTES` (L219) = a 1×1 PNG; `resizeImage` returns **null** → fallback `data === PNG_BYTES.toString("base64")`.
Existing Case 3 asserts: `img.data === PNG_BYTES.toString("base64")` (byte-exact raw base64).
For the URL image test: stub `image/png` with bytes that `resizeImage` rejects (returns null) → same fallback →
assert `r.images[0].data === mockImgBytes.toString("base64")` (byte-exact; proves the BYTE reader, not UTF-8 decode).
Use non-ASCII bytes (e.g. decoded PNG / `0x89,0x50,0x4E,0x47,…`) so a UTF-8 round-trip would CORRUPT them — the
byte reader preserves them exactly.

## 7. package.json scripts.test (current)

```json
"test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
```
4th entry (append): `&& node ./url-injection.test.mjs`.

## 8. Fetch stub shape (per item LOGIC #3)

```js
function makeRes({ ct="text/html", body="", status=200, ok=true, contentLength }={}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return {
    ok, status,
    headers: { get: (k) => {
      const lk = k.toLowerCase();
      if (lk==="content-type") return ct;
      if (lk==="content-length") return contentLength!=null ? String(contentLength) : null;
      return null;
    }},
    body: { getReader: () => { let done=false; return { read: async () => {
      if (done) return { done:true, value: undefined };
      done=true; return { done:false, value: buf };   // Buffer IS a Uint8Array
    }};}},
    text: async () => buf.toString("utf8"),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength),
  };
}
```
`readBytesCapped`/`readBodyCapped` call `res.body?.getReader()` then loop `reader.read()` until `done` — served by getReader.
Track calls: `const calls = []; globalThis.fetch = async (url) => { calls.push(url); return makeRes(...); }` — central to no-network + dedup assertions. Restore in `finally`.