# Research Notes — P1.M2.T2.S1 (bugfix 001_a6ffb98ab096, plan 011)

**Item:** BUG-003 — mirror the F5 empty-image guard into `injectUrl`'s image branch: a 200 `image/*`
response with a ZERO-LENGTH body must emit `formatEmptyImageBlock(url)` + an image detail, NO
`ImageContent` attachment, count++ → true. (Task path P1M2T2S1; the bugfix-PRD calls it Minor Issue 2.)

## The bug (verified in code + arch doc)

`injectUrl` image branch (file-injector.ts:944-963): `readBytesCapped(res, URL_MAX_BYTES)` returns an
**EMPTY Buffer** for a zero-length body (null ONLY on overflow) → `if (buf === null) return false;` (L945)
never catches it → `resizeImage(new Uint8Array(0), mime)` deterministically returns **null** (photon throws →
catch → null) → `resized?.data ?? buf.toString("base64")` === `""` → `state.images.push({type:"image", data:"", mimeType})`
— the **provider-rejected empty ImageContent** the local F5 guard (L1306-1323) exists to prevent.
Also `estimateImageTokens(null)` === 2805 (IMAGE_FALLBACK_TOKENS) — the wrong cost for 0 bytes.
Bug-hunt verified: injected=1, images[0].data.length===0, block `<file name="URL"></file>`.

## Verified code sites (file-injector.ts)

- **Image branch L944-963** (exact): `buf = await readBytesCapped(res, URL_MAX_BYTES)` → `if (buf === null)
  return false;` (L945) → `mime = ct.split(";")[0].trim()` (L946) → `resized = await resizeImage(...)`
  (L947, "async Worker; null on failure") → `cost = estimateImageTokens(resized)` (L948) → guard 3
  `if (state.remaining !== null && cost > state.remaining) return false;` (L949) → `images.push` (L950-954,
  `data: resized?.data ?? buf.toString("base64")`) → `blocks.push(formatImageBlock(url, resized))` (L955) →
  `details.push({path: url, kind: "image", dimensionHint: resized ? ... : undefined})` (L956-960) →
  `subtract(state, cost)` (L961) → `count++` (L962) → `return true` (L963).
- **formatEmptyImageBlock (L387-390)**: `export function formatEmptyImageBlock(abs: string)` returns
  `'<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>'` (em dash U+2014). ALREADY exported.
- **injectFiles signature (L1605-1615)**: `(text, imagesIn, ctx, bareAt = false, enableUrls = true, onUrlFetch?)`
  — the 5th arg `enableUrls` defaults true; direct unit calls pass it explicitly.
- **Local F5 template (L1306-1323)**: pushes formatEmptyImageBlock + detail `{path, kind:"image",
  dimensionHint: undefined}` + `subtract(ceil(len/4))`; count++ comes from injectFile's trailing bump —
  injectUrl owns its OWN count++ (mirror it in the guard).
- **No claim-juggling for URLs**: the URL loop in injectFiles (~L1636-1644) claims the dedup key BEFORE
  injectUrl; injectUrl returning true/false needs no backing-out.

## The fix (from arch doc §fix inputs (h), placement analysis)

Insert immediately AFTER L945 (`buf === null` check), BEFORE L946-947 (mime/resizeImage):
```ts
if (buf.length === 0) {
  // F5 mirror — a 0-byte image body would attach an EMPTY ImageContent (providers reject it).
  const f5Block = formatEmptyImageBlock(url);
  state.blocks.push(f5Block);
  state.details.push({ path: url, kind: "image", dimensionHint: undefined });
  subtract(state, Math.ceil(f5Block.length / 4)); // note consumes budget (mirror F5)
  state.count++;
  return true;
}
```
**Placement rationale**: after readBytesCapped (needs buf; null handled); BEFORE resizeImage (avoids
spawning the WASM Worker for 0 bytes — it returns null anyway); BEFORE guard 3 (F5 parity: the note ALWAYS
delivers, no over-budget turn-away; ~15-20 token note cost negligible). Note the subtle TS ordering: the
guard needs nothing from `mime`/`resized`, so inserting before L946 keeps them untouched.

## Test harness (url-injection.test.mjs — verified)

- **makeRes({ct, body, status, ok, contentLength})** L147-170: plain Response shape; `body: ""` →
  `Buffer.from("", "utf8")` = zero-length buffer → the reader's single chunk is ZERO-LENGTH — the
  deterministic empty-body fixture. `contentLength` defaults null (skips guard-2a).
- **DIS-4 (L349-362)** = the image template to mirror: capture `const origFetch = globalThis.fetch;` before
  try; `globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: IMG_BYTES }); };`
  → `const r = await mod.injectFiles("#example.com/img.png", [], FIX, false, true);` → asserts →
  `finally { globalThis.fetch = origFetch; }` (restore ALWAYS — a leaked stub poisons later cases).
- **FIX = {cwd: TMPDIR}** L122; **hasBlock(r, needle) = r.blocks.some(b => b.includes(needle))** L127-129.
- **New test (URL-IMG-EMPTY, near DIS-4)**: fetch→makeRes({ct:"image/png", body:""}) +
  `injectFiles("#https://example.com/empty.png", [], FIX, false, true)` → assert `r.images.length === 0`,
  `hasBlock(r, '<file name="https://example.com/empty.png"><empty image file \u2014 0 bytes; nothing to attach></file>')`,
  `r.injected === 1`, `r.details[0].kind === "image"`. TDD: RED first (today: images[0].data==="" → fail), then GREEN.
- Keep DIS-4 green (non-empty body still attaches; images[0].data round-trips base64).
- DO NOT stub resizeImage (external, jiti-aliased; the fix relies on deterministic null-on-invalid — and the
  guard now runs BEFORE resizeImage anyway).
- Label collision risk: existing "BUG-001"/"BUG-002"/"BUG-003" test labels in url-injection refer to OLDER
  different bugs (DIS-1b/DIS-3) — use the unique label **URL-IMG-EMPTY**.

## No-conflict with the parallel sibling (P1.M2.T1.S1 = BUG-002)

P1.M2.T1S1's PRP: edits `injectMarkdown` Step-5 (:1597-1603, invalidRange guard), file-injector.test.mjs
(+MD-LR3 after LINE-10 :3323), README "Line range." paragraph. My regions: `injectUrl` image branch (:945-946),
url-injection.test.mjs (+URL-IMG-EMPTY near DIS-4 :349), README "### URLs" Images bullet (L82).
**Code, test, and doc regions fully disjoint.** Both add one block before a shared boundary (its guard goes
before injectMarkdown's claimKey re-check; mine before mime/resizeImage) — no shared edit sites.

## Downstream consumers (P1.M1.T1.S1/S2/S3 LANDED — BUG-001 renderer offsets)

`computeDetailOffsets` now processes kinds text/paged/url/binary. **kind "image" is skipped** (no offsets) —
my new detail `{path: url, kind: "image"}` is skipped exactly like the local F5 empty-image detail. The
renderer's tier-3 path-aware fallback likewise ignores image details (expanded view skips image bodies;
readLine shows `read <path>` with no dimensionHint since it's undefined). No interaction — verified consistent.

## README (Mode A, item §5)

`README.md` L82, "### URLs" by-content-type bullet: `- **Images** (#https://example.com/cat.png) → attached
as an image, same as #@image.` → append the Mode-A note: an image URL whose body is empty (0 bytes) attaches
the note ("empty image file — 0 bytes; nothing to attach") instead of an image — same as a 0-byte local image.

## Baselines + gates

- Suites green: file-injector **183/0**, url-injection **38/0** (npm test chains all four).
- Gates: `npm run typecheck` → 0 errors (`--strict`); `node ./url-injection.test.mjs` → **39/0** (38 + URL-IMG-EMPTY);
  `node ./file-injector.test.mjs` → 183/0 (untouched by this fix); the other two suites stay green;
  `npm test` chains all four green.
- Behavior deltas: (a) empty-body image URL: empty ImageContent → note block (+detail, count++ → true).
  (b) under a TIGHT budget the note now ALWAYS delivers (F5 parity) where the old path either silently
  returned false (guard 3) or attached empty bytes — NO existing test pins either old outcome (arch doc verified).
- No exported-surface change (formatEmptyImageBlock already exported; no new functions).