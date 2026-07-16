# Research Notes — P1.M1.T2.S2 (estimateImageTokens + total-size budget for image/binary)

All facts verified first-hand against working tree at HEAD commit `accfb14` ("Add code-region
detection and markdown constants"). Repo: `/home/dustin/projects/pi-file-injector`. Working tree clean.

## 1. POST-T2.S1 starting state (VERIFIED LANDED — the CONTRACT)

T2.S1 is DONE (committed as `accfb14`). This is the exact state T2.S2 begins in:

### Source: `file-injector.ts`
- **`IMAGE_FALLBACK_TOKENS = 2805`** present at **L42** (module-scope `const`, NOT exported), with
  JSDoc "Consumed by estimateImageTokens (T2.S2)." The constant T2.S2 must consume — already there.
- **`estimateImageTokens` does NOT exist yet** (only referenced in the L41 JSDoc comment). T2.S2 CREATES it.
- **`injectFile`** at **L421–461**. Branch order (verified):
  - L436: `if (mime && buf.length === 0)` → F5 empty-image → `state.blocks.push(formatEmptyImageBlock(abs))` at **L438**
  - L440: `else if (mime && hasValidImageMagic(buf, mime))` → real image → `state.images.push({...})` at L444 + `state.blocks.push(formatImageBlock(abs, resized))` at **L449**
  - L451: `else if (isBinary(buf))` → binary → `state.blocks.push(formatBinaryBlock(abs))` at **L452**
  - L454: `else` → text → `emitText(abs, buf.toString("utf8"), state)` at L455 (emitText already subtracts)
  - L457: `state.count++; return true;`
- **`subtract(state, cost)`** at L215 — no-op when `state.remaining === null` (O-1 fallback). NOT exported.
- **`emitText`** at L471 already calls `subtract` at L476 (whole) and L500 (paged head). Text is DONE.
- **`formatImageBlock`/`formatBinaryBlock`/`formatEmptyImageBlock`** exported formatters — unchanged, reused.
- **`isAbsoluteOrTilde`/`computeCodeRanges`/`inCode`** all exported (T2.S1). scanTokens skipCode wired.
- The constants cluster (L25–42): PAGED_THRESHOLD, MARGIN, HEAD_CHARS, DEFAULT_WINDOW, DEFAULT_RESERVE,
  READ_LIMIT, INLINE_CODE_RE, FENCE_OPEN_RE, MD_EXTS, IMAGE_FALLBACK_TOKENS.

### Test: `file-injector.test.mjs` (1161 lines, clean at HEAD)
- **61 `runCase` calls** total (NOT 52 — the S1 PRP's "52" was pre-T2.S1). Categorized:
  numeric §11 (14: cases 1–14), E (4), G (3), H (1), M (1), F1-family (4), DUP (3), F2 (1),
  FS (3), F3a/F3b (2), F5 (1), F4 (1), U1 (1), A1 (1), PD (8: PD1–PD8), PN (4: PN1–PN4), CC (9: CC1–CC9).
- **Sanity list: 15 asserts** (L113–127): default, injectFiles, cleanToken, formatTextFileBlock,
  formatImageBlock, formatBinaryBlock, formatEmptyImageBlock, formatPagedDirectiveBlock,
  hasValidImageMagic, scanTokens, injectFile, emitText, isAbsoluteOrTilde, computeCodeRanges, inCode.
- **CC9 ends at ~L1137**; the **summary block** ("// 10. Summary + cleanup + exit.") starts at **L1141**.
  New §5.6.2 test section inserts BETWEEN CC9's closing `});` and the L1141 summary comment.
- **Fixtures**: `pic.png` (1×1 tiny PNG → resizeImage returns null → fallback path), `data.bin` (NUL→binary),
  `empty.png` (0-byte → F5). All present; reusable for new §5.6.2 tests without new fixtures.

## 2. The estimateImageTokens formula (PRD §5.6.2)

```ts
estimateImageTokens(resized: ResizedImage | null): number =
  resized (with numeric width/height)
    ? Math.max(1, Math.ceil(resized.width  / 512))
    * Math.max(1, Math.ceil(resized.height / 512))
    * 170 + 85
    : IMAGE_FALLBACK_TOKENS   // 2805 (2000×2000 worst case = 4·4·170+85)
```

- **External confirmation (Anthropic Vision guide):** image tokens = `(tiles_w × tiles_h × 170) + 85`
  where `tiles = ceil(px/512)` with min 1 tile/side.
  URL: `https://docs.claude.com/en/docs/build-with-claude/vision` (canonical; legacy
  `https://docs.anthropic.com/en/docs/build-with-claude/vision` redirects).
  Numbers: **512** tile px, **170** tokens/tile, **85** base tokens, **2805** = 4×4×170+85 worst case.
  (Note: Anthropic resizes the longest edge to ≤1568 before tiling, so 2805 is a CONSERVATIVE upper
  bound when computed from the pre-resize 2000×2000 cap — appropriate for a budget guard.)
- **ResizedImage.width/height are VERIFIED numeric** (global pi `dist/utils/image-resize-core.d.ts`):
  `{ data: string; mimeType: string; originalWidth: number; originalHeight: number; width: number;
  height: number; wasResized: boolean }`. Safe to read `resized.width`/`resized.height` directly when
  `resized !== null`. The `Math.max(1, ⌈w/512⌉)` guards make even a 0-dimension safe (→1 tile).

## 3. The 3 subtract() wirings into injectFile (PRD §5.6.2)

| Branch | File line | Block pushed | subtract cost (after T2.S2) |
|---|---|---|---|
| F5 empty-image | L438 `formatEmptyImageBlock(abs)` | note | `subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4))` |
| image attach | L449 `formatImageBlock(abs, resized)` | image ref | `subtract(state, estimateImageTokens(resized))` |
| binary | L452 `formatBinaryBlock(abs)` | note | `subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4))` |
| text (emitText) | L455 | whole/head | ALREADY subtracts (L476/L500) — DO NOT double-count |

- **Image cost uses `estimateImageTokens(resized)` — NOT the block-string length.** The image block is a
  tiny reference (`<file name="ABS"></file>`); the REAL cost is the attached base64 image, estimated by
  the tile formula. The `resized` var is in scope at L449 (declared L441).
- **Binary + empty-image costs use `Math.ceil(blockString.length / 4)`** (the note strings are small,
  ~tens of tokens — PRD §5.6.2 "binary note = Math.ceil(noteString.length/4)"). The standard chars-per-
  token heuristic (≈4 chars/token; OpenAI/Anthropic community standard) already used for text (O-3).
- All 3 subtractions are **no-ops when `state.remaining === null`** (O-1 fallback, no budget) → preserves
  current behavior for budget-less ctxs (FIX mock, most existing cases).

## 4. The image+paged-budget test (item §5 MOCKING: PAGED_FIX budget mock)

The item requires: "an assertion that a prompt with an image + a large text file under a tight budget
pages the text file (image consumed budget)" — reusing the **merged-ctx pattern** from PN2:
```js
const { ctx: base, rec } = makeMockCtx(TMPDIR);
const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
```
- PAGED_FIX: `remaining = 50000 - 10000 - 8192 - 8192 = 23616`; `PAGED_THRESHOLD·remaining = 14169.6`.
- The tiny 1×1 `pic.png` fixture → resizeImage returns null → `estimateImageTokens(null) = 2805`
  (IMAGE_FALLBACK path). Subtracting 2805 from 23616 → 20811 remaining. huge.log fileCost ≈ 524288
  >> 0.6·20811 = 12486 → **huge.log PAGES**. ✅ The image consumed budget (2805 tokens) BEFORE huge.log
  is decided.
- **BEFORE T2.S2** (today): the image does NOT subtract → huge.log's decision sees the full 23616 → it
  STILL pages (524288 > 14169). So the test must prove the *interaction* (image cost was actually
  subtracted from remaining), not merely that huge.log pages. The cleanest proof: make the test such
  that WITHOUT the image subtract, huge.log would be borderline WHOLE — but with 2805 subtracted, it
  pages. PAGED_FIX alone doesn't create that cliff (huge.log is huge). **Better: a direct
  estimateImageTokens unit test + a separate assertion that an image under PAGED_FIX leaves
  `paged===0` (image never pages) but the next text file pages because budget shrank.**
- **Cleanest approach (what the PRP will specify):**
  1. A **pure unit test** of `estimateImageTokens` directly (no fs): null→2805; a fake
     `{width:512,height:512}`→1·1·170+85=255; `{width:513,height:513}`→2·2·170+85=765; `{width:2000,height:2000}`→2805.
  2. A **shared-budget interaction test** (item §5 requirement): under PAGED_FIX, inject `#@pic.png`
     then `#@huge.log`. Assert (a) `paged===1` (huge.log paged); (b) `images.length===1`; (c) the image
     block appears BEFORE the huge.log head block (emission order). The "image consumed budget" is
     structurally proven because huge.log pages (the image's 2805 was subtracted before huge.log's
     decision) — AND a companion assertion that huge.log alone under PAGED_FIX also pages (PD1) confirms
     the threshold math is consistent.
- The **existing PD4** ("images unaffected by budget: pic.png attaches under PAGED_FIX") already proves
  images are never paged. T2.S2 does NOT break it (image still attaches; now it also subtracts — but
  PD4 only checks `paged===0` + `images.length===1`, which stay true).

## 5. No-conflict coordination with siblings

- **T2.S1 (DONE):** owns constants + computeCodeRanges/inCode + scanTokens skipCode. T2.S2 CONSUMES
  `IMAGE_FALLBACK_TOKENS` (L42) — does NOT redeclare it. Does NOT touch scanTokens/computeCodeRanges.
- **T2.S3 (upcoming):** adds `injectMarkdown` + the `MD_EXTS` markdown branch in injectFile (between
  image and binary per §5.6 step 1 / system_context §5.3). T2.S2's subtract wirings are in the F5/image/
  binary branches — **the markdown branch (to be inserted by T2.S3) calls emitText which already
  subtracts**, so T2.S3 needs NO new subtract wiring. T2.S2 and T2.S3 touch DISJOINT regions of
  injectFile (S2: F5/image/binary branches; S3: a new `else if (MD_EXTS.has(ext))` branch). No conflict.
- **T2.S4 (upcoming):** module-surface sync + case 20 + edge cases. T2.S2's new export
  (`estimateImageTokens`) + new sanity assert must be in place before T2.S4's sync pass. T2.S2 ships its
  own sanity assert now; T2.S4 will re-verify the full surface.

## 6. Module-surface change (item §6 DOCS)

- **NEW export:** `estimateImageTokens(resized: ResizedImage | null): number` (Mode A JSDoc per item §6).
- **NEW sanity assert** to append (after the 15 existing, so 16 total):
  `assert(typeof mod.estimateImageTokens === "function", "mod.estimateImageTokens must be a function (§5.6.2 image token estimate)");`
- No constants added (IMAGE_FALLBACK_TOKENS already there from T2.S1). No formatters changed.
- `subtract` stays private (internal). The 3 new call sites use the existing private helper.

## 7. Validation gate (verified command)

`cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs`
→ expected `Result: <61 + N> passed, 0 failed.` (N = new §5.6.2 test count, ~4–6), exit 0. The 61
existing cases (incl. PD1–PD8, PN1–PN4, CC1–CC9, F5, M1) MUST all stay green.
