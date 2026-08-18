# BUG-002 (markdown malformed-range leak) + BUG-003 (URL empty-image attach) — code context for fix

Repo: `/home/dustin/projects/pi-file-injector` — single-file TS extension `file-injector.ts` (1932 lines), tested by 4 standalone `.mjs` harnesses (no test framework; `node ./file.test.mjs` exits 0/1).

## Summary

- **BUG-002 (Major)**: `scanTokens` (file-injector.ts:1158-1210) emits `{ path: <RAW token>, invalidRange: true }` records for malformed line ranges (`:0`, `:5-3`). `processTokenStream` (top-level user prompt) guards them at lines 1234-1237 (warn + skip, LR-3). But `injectMarkdown`'s Step-5 recursion loop (lines 1558-1561) consumes the same `scanTokens` records WITHOUT the `invalidRange` guard and calls `injectFile(rec.path, …)` with the unresolved raw token (e.g. `"a.md:0"`). `injectFile` stats that string **relative to process.cwd** (line 1296) — if a literal file named `a.md:0` exists in the pi process cwd it is injected with a relative block name; otherwise it silently verbatims with **no warning**, violating LR-3 inside delivered markdown.
- **BUG-003 (Minor)**: `injectUrl`'s image branch (lines 920-942) has no empty-body guard. A 200 response with `content-type: image/*` and a zero-length body flows: `readBytesCapped` → **empty Buffer (not null)** → `resizeImage` → **null** (deterministic on empty bytes) → `estimateImageTokens(null)` = 2805 → budget check passes (or `remaining === null`) → `state.images.push({ type: "image", data: "", mimeType })` — the exact provider-rejected empty `ImageContent` the local-file path's F5 guard (lines 1308-1323) exists to prevent. Fix = mirror F5: empty body → note block, no attachment.
- Naming collision warning: the repo's **existing** test labels "BUG-001"/"BUG-002" (in `file-injector.test.mjs` ~line 3308 and `url-injection.test.mjs` DIS-1b/DIS-3) refer to *earlier, different* bugs (code-extension deny-list; URL-notify wording). The current bug-hunt IDs (plan/011_e473dac8178b/bugfix/001_a6ffb98ab096) are new — new test labels must not collide (e.g. `MR-1` / `IMG-EMPTY-1` style, or `BUG2MD-*`).

## BUG-002 scan/notify/markdown flow

### (a) `splitLineRange` — what makes a range invalid (lines 169-180)

```ts
/** Optional trailing line range on a token (1-indexed, inclusive).
 *  `#@a.ts:10` → lines 10–10 (single line). `#@a.ts:10-15` → lines 10–15.
 *  Exact path wins at resolve time (a file literally named `a.ts:10` still resolves as-is).
 *  LR-3: an INVALID range (e.g. `:0`, `:5-3`) returns `invalid: true` with the raw token as path —
 *  the caller (scanTokens → processTokenStream) warns the user and leaves the marker verbatim. */
export function splitLineRange(token: string): { path: string; startLine?: number; endLine?: number; invalid?: true } {
  const m = /:(\d+)(?:-(\d+))?$/.exec(token);
  if (!m) return { path: token };
  const start = Number(m[1]);
  const end = m[2] !== undefined ? Number(m[2]) : start; // bare :N → single line
  if (!Number.isFinite(start) || start < 1 || !Number.isFinite(end) || end < start) return { path: token, invalid: true };
  const p = token.slice(0, m.index!);
  return p ? { path: p, startLine: start, endLine: end } : { path: token };
}
```

Invalid cases: `start < 1` (`:0`) and `end < start` (`:5-3`). Invalid ⇒ `{ path: <FULL RAW token>, invalid: true }` (path keeps the suffix). Unit-pinned at file-injector.test.mjs:3024-3025:
`splitLineRange("a.ts:0")` ≡ `{path:"a.ts:0",invalid:true}`; `splitLineRange("a.ts:5-3")` ≡ `{path:"a.ts:5-3",invalid:true}`.

### (a) `scanTokens` record shape + the invalidRange push (lines 1158-1210; push at 1189-1194)

Signature (1158-1165):
```ts
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<{ path: string; startLine?: number; endLine?: number; invalidRange?: true }[]>
```
Per-candidate core (1182-1201):
```ts
    const token = cleanToken(c.token); // trim trailing punctuation (§4.3)
    if (!token) continue; // empty after trim => skip, leave verbatim
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue; // §4.5 — markdown: relative only
    // Exact token first (a file literally named `a.ts:10` wins). Else strip trailing `:N`/`:N-M` and retry.
    let abs = await resolveImportPath(token, baseDir, opts.tryMdExt);
    let startLine: number | undefined;
    let endLine: number | undefined;
    if (!abs) {
      const parsed = splitLineRange(token);
      // LR-3 — malformed range (`:0`, `:5-3`): the exact path (a literal `a.ts:0` file) had its chance above;
      // an invalid range is not a path either → surface it as invalidRange so processTokenStream can warn
      // the user (token stays verbatim, nothing injected). Must run BEFORE the startLine check below.
      if (parsed.invalid) { out.push({ path: token, invalidRange: true }); continue; }
      if (parsed.startLine !== undefined && parsed.path !== token) {
        if (!opts.allowAbsTilde && isAbsoluteOrTilde(parsed.path)) continue;
        abs = await resolveImportPath(parsed.path, baseDir, opts.tryMdExt);
        if (abs) { startLine = parsed.startLine; endLine = parsed.endLine; }
      }
    }
    if (!abs) continue; // nothing resolved → leave verbatim (missing/dir/non-regular)
    const key = claimKey(abs, startLine, endLine);
    if (state.injectedSet.has(key) || localSeen.has(key)) continue; // same path+range already claimed → leave verbatim
    localSeen.add(key);
    out.push(startLine !== undefined ? { path: abs, startLine, endLine } : { path: abs });
```
Key facts: the invalidRange record's `path` is the **raw token** (`"a.md:0"`), NOT resolved against `baseDir`, and invalid records bypass `localSeen`/`claimKey` entirely (repeated malformed tokens each produce a record). Exact-path-wins still applies first: a literal `a.md:0` **next to the markdown** resolves via `resolveImportPath(token, dir, true)` before the invalid branch (and `path.extname("a.md:0")===".0"` ≠ `""`, so the `.md` shorthand fallback never fires — resolveImportPath lines 260-286).

### (b) `processTokenStream` — the correct LR-3 handling (verbatim, lines 1219-1241; guard at 1234-1237)

```ts
  const recs = await scanTokens(text, baseDir, opts, state); // scan once, before any injection (opts carries tryMdExt)
  for (const rec of recs) {
    // LR-3 — malformed range (`:0`, `:5-3`): warn (interactive only) and leave verbatim. No claim, no dedup
    // (invalid records are never in injectedSet — localSeen would catch repeats but each scan is per-text anyway).
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // same path+range already claimed since scan
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, emits block(s); never throws
  }
```
Notify shape: `ctx.ui?.notify(message, "warning")` guarded by `ctx.hasUI` (both optional on `Ctx`, lines 1118-1132 — `ui?: { notify(message: string, type?: "info"|"warning"|"error"): void }`). Message prefix is `#@${rec.path}` = the token as typed (em dash U+2014, `≥` chars — pinned byte-for-byte by LINE-10).

### (c) `injectMarkdown` Steps 1-6 (lines 1504-1562) and the unguarded Step 5

Signature (line 1537) — **`ctx` IS the 4th param, so emitting the same LR-3 notify here is fully feasible, no signature change**:
```ts
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx, startLine?: number, endLine?: number): Promise<void> {
```
Flow: Step 2 claim self (1539) → dir = dirname(abs) (1541) → slice body when ranged (1544) → **Step 3** `const recs = await scanTokens(body, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);` (1551) → **Step 4** `emitText(abs, content, state, startLine, endLine);` (1554) → **Step 5** (1556-1561, THE BUG):
```ts
  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const rec of recs) {
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, classifies, bumps count, recurses again if markdown
  }
```
No `rec.invalidRange` check. Note the belt-and-suspenders `claimKey(rec.path, …)` on line 1559 also mis-computes for invalid records (`claimKey("a.md:0", undefined, undefined)` → `"a.md:0"` — a meaningless relative string as a claim key), so the guard should be inserted **before** that check, mirroring processTokenStream's order.

### (d) `injectFile` — how the raw token with `:` leaks (signature line 1294; stat at 1296)

```ts
export async function injectFile(abs: string, state: State, ctx: Ctx, startLine?: number, endLine?: number): Promise<boolean> {
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return false; // missing → leave verbatim (PRD §5.4)
  }
  if (!st.isFile()) return false; // directory / socket / etc. → leave verbatim (PRD §5.4)
  const key = claimKey(abs, startLine, endLine);
  state.injectedSet.add(key); // CLAIM path+range ...
```
`injectFile` takes the string **as-is** — no `expandTildeAndResolve`/baseDir join. `fs.stat("a.md:0")` resolves against **process.cwd()** (NOT the markdown's dir, NOT `ctx.cwd`). Two outcomes, both wrong per LR-3:
1. A literal file named `a.md:0` exists in process.cwd → injected; block name is the **relative** string `"a.md:0"` (`formatTextFileBlock(abs, …)` line 369: `'<file name="' + abs + '">\n' + content + '\n</file>'`), `state.count++`, no warning.
2. No such file → `stat` throws → `return false` → token verbatim **silently** (no LR-3 warning), unlike the top-level path which warns.

### (e) Existing LR-3 / markdown tests

- **LINE-10** (file-injector.test.mjs:3187-3218) — the top-level LR-3 pin; this is the template a markdown-side regression test should mirror:
```js
await runCase("LINE-10", "LR-3: #@a.ts:0 → injected:0, prompt verbatim, warning notify fired", async () => {
  const notes = [];
  const r = await mod.injectFiles("See #@a.ts:0 here", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } });
  assert(r.injected === 0, `injected:0 (nothing delivered), got ${r.injected}`);
  assert(r.text === "See #@a.ts:0 here", `prompt verbatim (#@a.ts:0 untouched), got ${JSON.stringify(r.text)}`);
  assert(notes.length === 1, `exactly one notify fired, got ${notes.length}`);
  assert(notes[0]?.t === "warning", `notify type 'warning', got ${notes[0]?.t}`);
  assert(notes[0]?.m === "#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)", ...);
```
  Negatives in the same case: `#@nope.ts` (missing, no range) → 0 notifies; `#@a.ts:2` (valid) → injected=1, 0 notifies; literal `literal0.ts:0` file written into TMPDIR + `#@literal0.ts:0` → exact-path-wins delivers whole, 0 notifies (finally: `fsSync.rmSync(lit, { force: true })`).
- **LINE-11** (3225+): LR-4 past-EOF pattern — `spyCtx = (notes) => ({ cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } })`, inline fixtures + finally cleanup; includes a markdown past-EOF notify assertion (notes3, line ~3250).
- Markdown recursion fixtures: `notes.md`/`api.md`/`a.md`/`b.md`/`sub/notes.md`… written by `buildFixtures()` (lines 239-252); `notesMissing.md` imports missing `ghost.md` (MD1 case). A BUG-002 fixture is e.g. `fsSync.writeFileSync(path.join(TMPDIR, "badrange.md"), "see #@a.md:0 here\n")` + prompt `#@badrange.md`.
- relative-imports.test.mjs: per-case FRESH tmp trees with unique content markers ("file-relative vs cwd-relative" discrimination); `ctxFor = (cwd, extra = {}) => ({ cwd, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} }, ...extra })` (line 70); scanTokens is directly exported so `mod.scanTokens(body, dir, {allowAbsTtilde…})` can be unit-driven.
- import-behavior.test.mjs: same jiti harness, `ctxFor(cwd)` headless default (line 35).

## BUG-002 fix inputs

Minimal, spec-aligned fix (mirrors lines 1234-1237 exactly; inserted at line 1559, before the injectedSet re-check):

```ts
  for (const rec of recs) {
    // LR-3 — malformed range (`:0`, `:5-3`) found while scanning a DELIVERED markdown: same contract as
    // processTokenStream — warn (interactive only), leave verbatim, never hand the raw token to injectFile.
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue;
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine);
  }
```

- `ctx` is already in scope (4th param of injectMarkdown) — **no signature/type changes**; `rec`'s type from `scanTokens` already carries `invalidRange?: true`.
- The notify message is byte-identical to the top-level one (`#@<token as typed> — …`, "warning", hasUI-guarded) so a shared assertion string works for both.
- Order matters: `invalidRange` check must precede the `claimKey(...)` re-check (raw token as a claim key is meaningless; matches processTokenStream's ordering).
- Plan recommendation (plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md:83): "In injectMarkdown's Step-5 loop, skip rec.invalidRange records exactly like processTokenStream does (and optionally emit the same LR-3 warning), which also removes the raw-token-into-injectFile leak."
- Spec anchors: spec/17-line-ranges.md:85 (LR-3), spec/11-acceptance-tests.md case 44, spec/10-edge-cases.md:79.
- Test shape for the fix (add near LINE-10/LINE-11, ~file-injector.test.mjs:3218): write `badrange.md` containing `see #@a.md:0 here` into TMPDIR, run `mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m,t) => notes.push({m,t}) } })`, assert: `r.injected === 1` (only badrange.md), no block containing `name="a.md:0"`, `notes.length === 1 && notes[0].t === "warning"` with the exact LR-3 message naming `#@a.md:0`. Headless negative: `hasUI:false` → same injection result, 0 notifies. (The full process-cwd leak repro — literal `a.md:0` file in process.cwd — would need `process.chdir` into a temp dir + restore in `finally`; the guard makes this unnecessary but a belt-and-suspenders variant can `process.chdir(TMPDIR_SUB)` with a colon-file present and assert injected stays 1.)

## BUG-003 injectUrl image path

### (a) `injectUrl` full flow (lines 904-985)

Signature (904): `async function injectUrl(url: string, state: State, ctx: Ctx): Promise<boolean>` — PRIVATE, called only from the URL loop in `injectFiles` (line ~1640: gate → normalize → dedup on `state.injectedSet` → `onUrlFetch?.()` → `await injectUrl(abs, state, ctx)`). Never throws; `false` → token verbatim.

Gating before the call (injectFiles, ~1636-1644): `URL_INJECT_RE` match → `cleanToken` → `URL_SHAPE_RE` shape gate → code-extension deny-list (`CODE_EXTENSIONS`, scheme-less+slash-less tokens) → normalize `https://` prefix → dedup → fetch.

Fetch + guards (906-918): AbortController `URL_TIMEOUT_MS`=20s (121); `!res.ok` → false; `content-length > URL_MAX_BYTES`(1_000_000, line 123) → false (guard 2a); `ct` from headers.

**Image branch verbatim (920-942) — the unguarded path:**
```ts
    // ── IMAGE path (Refinement D: BYTE reader) ──
    if (ct.startsWith("image/")) {
      const buf = await readBytesCapped(res, URL_MAX_BYTES); // raw Buffer — no UTF-8 decode
      if (buf === null) return false; // §3.3 guard 2b — overflowed mid-stream
      const mime = ct.split(";")[0].trim(); // strip params ("image/png; charset=…")
      const resized = await resizeImage(new Uint8Array(buf), mime); // async Worker; null on failure (mirror L968)
      const cost = estimateImageTokens(resized); // §5.6.2 tile estimate
      if (state.remaining !== null && cost > state.remaining) return false; // §3.3 guard 3 — over-budget → verbatim
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
        mimeType: resized?.mimeType ?? mime, // null => original mime
      });
      state.blocks.push(formatImageBlock(url, resized)); // mirror L972 (name = url)
      state.details.push({
        path: url,
        kind: "image",
        dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined, // mirror L973
      });
      subtract(state, cost); // §5.6.2 mirror L974
      state.count++;
      return true;
    }
```
Empty-body trace: `buf` = zero-length Buffer → `resized` = null (see (c)) → `cost` = 2805 → guard 3 may `return false` (silent verbatim) **or** pass (`remaining === null` or ≥ 2805) → `images.push({type:"image", data:"", mimeType})` (empty base64 of an empty buffer) → block `<file name="URL"></file>` → detail `{path: url, kind:"image", dimensionHint: undefined}` → subtract 2805 → count++ → true. Both branches are wrong: one silently drops a 200-image, the other attaches the provider-rejected empty image.

Text path (944-985): `readBodyCapped` → explicit-type dispatch (`isHtml`/`isRawText`/'<' sniff fallback-only) → defuddle + `URL_MIN_CONTENT`(200) SPA floor (`ctx.hasUI` notify "info" at 896-897) → cost = `ceil(body.length/4)` → guard 3 → `formatUrlBlock` + detail kind "url" → subtract → count++ → true; catch → false; finally `clearTimeout(to)`.

### (b) `readBytesCapped` — empty body returns an EMPTY BUFFER, not null (lines 861-878)

```ts
async function readBytesCapped(res: Response, cap: number): Promise<Buffer | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    const b = Buffer.from(await res.arrayBuffer());
    return b.length > cap ? null : b;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) return null; // overflow → verbatim (§3.3)
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks); // raw bytes — no decode
}
```
Zero-length body: streaming path → reader immediately done → `Buffer.concat([])` → **0-length Buffer**; no-reader path → 0-byte ArrayBuffer → `0 > cap` false → **0-length Buffer**. `null` is returned ONLY on overflow. So `buf === null` at line 923 never catches the empty case; the F5-mirror predicate is `buf.length === 0`.

### (c) `resizeImage` on EMPTY input → null (external, `@earendil-works/pi-coding-agent`)

`resizeImage` is imported (file-injector.ts:3) from the global pi package (`…/pi-coding-agent/dist/utils/image-resize.js`, re-exported at dist/index.js:44). Traced at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/utils/`:
- `resizeImage(inputBytes, mimeType, options)` spawns a Worker; on worker failure falls back to `resizeImageInProcess`. 
- `resizeImageInProcess` (image-resize-core.js:32-118): `photon.PhotonImage.new_from_byteslice(inputBytes)` **throws on empty/invalid bytes** → the wrapping `catch { return null; }` → **null**. (Same code path the tests rely on: "resizeImage returns null on tiny/invalid input" — file-injector.test.mjs:218-220, url-injection.test.mjs:346-348, 3494-3496.)
- `data.length === 0` therefore always yields `resized === null` ⇒ `resized?.data ?? buf.toString("base64")` = `""`. (Conversely, non-empty buf + null resize attaches non-empty raw base64 — not this bug.)

### (d) Block/note formatters (exact shapes)

- `formatImageBlock` (373-377): `'<file name="' + abs + '">' + (hint ?? "") + '</file>'` — null/empty hint ⇒ `<file name="URL"></file>`.
- `formatEmptyImageBlock` (387-389): `'<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>'` (em dash U+2014).
- `formatDimensionNote` (pi dist, image-resize.js): returns `undefined` when `!result.wasResized`, else `"[Image: original WxH, displayed at WxH. Multiply coordinates by S.SS to map to original image.]"`.

### (e) `estimateImageTokens` (818-823) + constant (118)

```ts
export function estimateImageTokens(resized: ResizedImage | null): number {
  if (resized === null) return IMAGE_FALLBACK_TOKENS;      // 2805 (line 118)
  const tilesW = Math.max(1, Math.ceil(resized.width / 512));
  const tilesH = Math.max(1, Math.ceil(resized.height / 512));
  return tilesW * tilesH * 170 + 85;
}
```
Empty case → `resized === null` → **2805**, which then drives guard 3 with a nonsense cost for a 0-byte body.

### (f) The F5 local-path guard (mirror-template), verbatim lines 1306-1323

```ts
  try {
    const buf = await fs.readFile(abs); // read ONCE; reused by image + text/binary paths
    if (mime && buf.length === 0) {
      // F5 — a 0-byte image file would attach an EMPTY ImageContent (which providers reject).
      // Align with the text path's empty-file handling: emit a note block, attach nothing.
      // line range is ignored for images (no line semantics).
      // LR-2 (§3 claim-by-type) — the effective claim is the BARE abs ...
      if (key !== abs) {
        if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }
        state.injectedSet.add(abs);
      }
      const f5Block = formatEmptyImageBlock(abs);
      state.blocks.push(f5Block);
      state.details.push({ path: abs, kind: "image", dimensionHint: undefined }); // §6.4 — empty-image detail (parallel to the block push)
      subtract(state, Math.ceil(f5Block.length / 4)); // §5.6.2 — note consumes budget
    } else if (mime && hasValidImageMagic(buf, mime)) {
```
(The LR-2 claim normalization block is file-path-specific — URLs have no `claimKey`; the URL loop in injectFiles already claimed the abs key before calling injectUrl, and nothing needs backing out on this path.)

### (g) Existing URL image tests (url-injection.test.mjs)

- Fetch stubbing: `const origFetch = globalThis.fetch;` (130) — every case: `try { globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({...}); }; ... } finally { globalThis.fetch = origFetch; }` (restored ALWAYS — "a leaked stub would poison later cases / hits real network", 495).
- `makeRes({ ct, body, status, ok, contentLength })` (143-167) — plain Response-shaped object: `headers.get` for content-type/content-length; `body.getReader()` single-chunk (`Buffer` IS a `Uint8Array`); `text`/`arrayBuffer` fallbacks. **`body: ""` yields a zero-length chunk → exercises the empty-buffer path deterministically.**
- **DIS-4** (image assertion template, 346-360): fetch → `makeRes({ ct: "image/png", body: IMG_BYTES })` (`IMG_BYTES` = PNG signature + high bytes, 254-259; resizeImage→null ⇒ raw-base64 fallback) → asserts `r.images.length === 1`, `r.images[0].data === IMG_BYTES.toString("base64")`, deep-equal round-trip, `mimeType === "image/png"`, `r.details[0].kind === "image"`, `r.injected === 1`.
- Empty-body-adjacent representative — **FAIL-7 SPA** (865-884): `ctxWithNotifySpy()` ctx + `makeRes({ ct: "text/html", body: "<html>…<p>short</p>…" })` → asserts verbatim text, `injected === 0`, `blocks.length === 0`, notify fired with "page appears JS-rendered; left as reference", type "info".
- Over-budget — **FAIL-6** (839-856): `LOW_BUDGET_CTX = { cwd: TMPDIR, getContextUsage: () => ({ tokens: 0, contextWindow: 16394 }) }` (line 712) ⇒ remaining = 10 < cost → false.
- `ctxWithNotifySpy()` (700-706): `{ ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }, notes }`.
- `FIX = { cwd: TMPDIR }` (line 122); `hasBlock(r, needle)` reads `r.blocks.some(b => b.includes(needle))` (127-129).
- In file-injector.test.mjs, imageRes() (3492-3510) is a local makeRes-mirror for image/png used by the ISSUE-IMG-URL notify tests (drives the real input handler via `captureHandler()`).

### (h) Guard placement analysis (what makes the F5-mirror minimal and correct)

Insert immediately after the `buf === null` check (line 923) and **before** `resizeImage` (line 925):

```ts
      if (buf.length === 0) {
        // F5 mirror — a 0-byte image body would attach an EMPTY ImageContent (providers reject it).
        // Emit the note block instead; attach nothing. Same contract as the local-file F5 guard.
        const f5Block = formatEmptyImageBlock(url);
        state.blocks.push(f5Block);
        state.details.push({ path: url, kind: "image", dimensionHint: undefined });
        subtract(state, Math.ceil(f5Block.length / 4)); // note consumes budget (mirror F5)
        state.count++;
        return true;
      }
```
- **After `readBytesCapped`** — the predicate needs `buf`; `null`-overflow is already handled at 923.
- **Before `resizeImage`** — avoids spawning a Worker (WASM load) for 0 bytes; the worker would only return null anyway (see (c)).
- **Before guard 3 / the budget check** — `estimateImageTokens(null)` = 2805 is the wrong cost for an empty body; routing the note path before it means the note is always delivered (like F5 local, which subtracts its small note cost unconditionally with no over-budget turn-away), instead of the current inconsistent behavior (empty image under a tight budget silently verbatims; under no/loose budget it attaches an empty image). The note cost (~15-20 tokens) is negligible and mirrors `subtract(state, Math.ceil(f5Block.length / 4))` at line 1323.
- **Detail push**: `{ path: url, kind: "image", dimensionHint: undefined }` mirrors line 1322 exactly (kind "image" so the input handler's URL/image axis counting — ISSUE-IMG-URL — still classifies it as a URL by its https `path`, and the renderer's image branch handles it).
- **`count++` + `return true`** mirror the branch's own tail (940-941): the note IS a delivery (F5 local also counts, via injectFile's trailing `state.count++` at 1378); injectUrl owns its own count bump.
- Predicate is exactly `buf.length === 0` (F5 parity). No need to also check `resized` emptiness — resizeImage never returns empty data.
- Plan recommendation (prd_snapshot.md:84): "Mirror the F5 empty-image guard into injectUrl's image branch (empty body → note block, no attachment) (BUG-003)."
- Test shape (url-injection.test.mjs, near DIS-4): fetch → `makeRes({ ct: "image/png", body: "" })`; assert `r.images.length === 0` (F5 test's core assertion, file-injector.test.mjs:951-952), `hasBlock(r, '<file name="https://example.com"><empty image file \u2014 0 bytes; nothing to attach></file>')`, `r.injected === 1`, `r.details[0].kind === "image"`; negative DIS-4 unchanged (non-empty body still attaches).

## Shared test conventions (jiti, ctx mock, notify spy, tmpdir helpers)

All 4 suites are zero-dependency ESM scripts; run via `npm test` (package.json: `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs`); typecheck via `npm run typecheck` (scripts/typecheck.mjs).

1. **jiti harness** (file-injector.test.mjs:24-77; identical in the others):
```js
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const TS_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "file-injector.ts");
const mod = await jiti.import(TS_PATH);
```
2. **Harness**: bare `assert(cond, msg)` + `runCase(n, name, fn)` collecting PASS/FAIL matrix rows; exit 1 on any failure; `integrationCase` for manual-only rows.
3. **ctx mock / notify spies**:
   - Multi-notify spy (arrays): `{ cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }` (LINE-10 line 3189; url-injection `ctxWithNotifySpy` 700-706).
   - Single-capture: `makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {})` → `{ ctx, rec }`, `rec.notify = { m, t }` (file-injector.test.mjs:166-172).
   - Headless: `hasUI: false` (+ no-op `ui: { notify: () => {} }` in relative-imports' `ctxFor`).
   - `Ctx` type fields actually used (file-injector.ts:1118-1132): `cwd`, optional `getContextUsage`, `model`, `hasUI`, `ui.notify(message, "info"|"warning"|"error")`.
4. **Handler capture** (file tests only): `captureHandler(event="input")` builds `pi = { on, registerMessageRenderer: () => {} }`, calls `mod.default(pi)`, returns the last `input` cb (176-182); `captureAllHandlers()` for multi-event flows.
5. **tmpdir/fixtures**: `const TMPDIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "saf-"/"ui-"));` + `buildFixtures()` writing fixed deterministic files (`fsSync.writeFileSync`), `finally`-cleanup for out-of-tree files (e.g. `HOME_NOTES_PATH`, LINE-10's literal colon file). `hasBlock(r, needle)` / `blocksText(r)` read `r.blocks: string[]`.
6. **fetch stubbing** (url tests): save/restore `globalThis.fetch` in try/finally per case; `calls.push(String(url))` as the zero-egress spy; `makeRes(...)` factory (143-167) for Response shapes.

## Risks

- **Naming collision in tests**: existing `BUG-001`/`BUG-002` case labels already mean different historical bugs — new labels must be unique (e.g. `MR-*` / `IMGEMPTY-*`).
- BUG-002 fix emits one notify per malformed-marker occurrence (invalid records bypass `localSeen`) — same as top-level parity; a markdown with the same bad token twice warns twice. Document in the test if asserted.
- BUG-002: exact-path-wins means a literal `a.md:0` **in the markdown's own directory** still resolves and injects (intended; unaffected by the fix — resolution happens in scanTokens before the invalid branch). Only the process-cwd leak is removed.
- BUG-003: note path always delivers (no over-budget turn-away) — a deliberate F5-parity choice; if a maintainer prefers strict budget accounting, subtracting the note cost (as specified) is the F5-consistent behavior. Under `LOW_BUDGET_CTX`-style budgets the empty image previously returned false silently; post-fix it returns true + note — any existing test asserting `injected===0` for empty-body images would need updating (none exist today; DIS-4 uses a non-empty body).
- BUG-003: `state.count++` + detail `kind:"image"` with an https `path` keeps the ISSUE-IMG-URL notify axis intact ("injected 1 URL").
- `resizeImage`/`formatDimensionNote`/`ResizedImage` are external (global pi package via jiti alias) — do not stub them in tests; the harness relies on their deterministic null-on-invalid behavior.
- typecheck: `Ctx.ui.notify` param is a narrow union ("info"|"warning"|"error") — any new notify must use one of those literals; `npm run typecheck` guards this.
- injectMarkdown is PRIVATE — regression tests must drive it via `mod.injectFiles("Read #@badrange.md", …)` (not a direct call), same as all existing markdown cases.