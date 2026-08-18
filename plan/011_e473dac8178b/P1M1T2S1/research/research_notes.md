# Research Notes — P1.M1.T2.S1: LR-2 — images/binaries claim the bare abs (no duplicate bytes)

> Source fix (injectFile's 3 non-text branches) + the LINE-9 regression test (both orders, both kinds). The
> pre-read ranged claim stays (recursion-readiness, unchanged); once classified image/binary, the EFFECTIVE
> claim is the bare abs — a duplicate bare-abs key turns the token away BEFORE emitting.

## 1. T1.S3 contract (parallel) — NO conflict

T1.S3 ("Unify the emit quadruple + rewrite emitText JSDoc") edits **emitText only** (L1299-1347 region).
T2.S1 edits **injectFile's 3 non-text branches** (F5 L1247, F3 L1255, binary L1275). Disjoint functions —
T2.S1 does not touch emitText; T1.S3 does not touch injectFile's branches.

## 2. Verified current state (file-injector.ts, 1833 lines)

injectFile (L1231-1290): stat → `const key = claimKey(abs, startLine, endLine); state.injectedSet.add(key);`
at **L1239-1240** (pre-read, ranged) → read → classify:
- F5 empty-image L1247-1253: note + `{path, kind:"image", dimensionHint:undefined}` + subtract.
- F3 real-image L1255-1271: magic sniff → resize → `state.images.push` + block + detail + subtract.
- markdown L1272-1274: `injectMarkdown(abs, buf, state, ctx, startLine, endLine)` — UNTOUCHED.
- binary L1275-1281: note + `{path, kind:"binary"}` + subtract.
- text L1282: `emitText(...)` — UNTOUCHED.
- `state.count++` L1284; catch → `state.injectedSet.delete(key)` L1287 + return false.

claimKey (L192-196): bare `abs` | `abs:N` (s===e) | `abs:N-M`. `:N ≡ :N-N` canonical (LR-7 OK).

## 3. The bug (why both orders duplicate today)

`#@pic.png #@pic.png:3` — scanTokens records both (different keys `abs`, `abs:3` in localSeen). processTokenStream
skips only same-key records (L1213). injectFile #1 claims `abs` (bare token); injectFile #2 claims `abs:3` —
no collision → same PNG attached twice. Reverse order `#@pic.png:3 #@pic.png`: claims `abs:3` then `abs` — same
duplication. Binary twin identical. LR-2's fix: the non-text branches consult/add the BARE abs at emit time.

## 4. The edit (one guard shape, three sites — placed AFTER read/classify, BEFORE emit)

The claim-relevant region: mime/ext are known after stat (pre-read, L1236-1237); classification needing `buf`
happens in the branch conditions. For F5 (`mime && buf.length===0`) and binary (`isBinary(buf)`) the guard can
go at the TOP of the branch (mime/ext/buf known); for F3 (`mime && hasValidImageMagic(buf, mime)`) likewise —
all three branch heads have everything needed. Simplest shape: insert the guard as the FIRST statement of each
branch:

```ts
// (at the top of each of the three branches)
if (state.injectedSet.has(abs)) {   // LR-2 — bare-abs already claimed (an earlier bare OR ranged delivery
  state.injectedSet.delete(key);    // of the same image/binary) → back out the ranged claim; emit NOTHING
  return false;                     // (token left verbatim, count NOT bumped — claim ⟺ delivered)
}
state.injectedSet.add(abs);         // LR-2 — the effective claim: the bare abs (a range is meaningless
                                    // identity for images/binaries; identical bytes never delivered twice)
```

Spec §3: "the ranged key may remain alongside harmlessly or be normalized/deleted — pick one and note it in the
JSDoc." **Pick: DELETE the ranged key on dedup-turn-away** (cleanest — a turned-away token leaves no key behind,
so a THIRD form `#@pic.png:5` is correctly turned away by the bare `abs` check, not by a stale `abs:3`).
On the deliver path the ranged key REMAINS alongside the bare key (harmless: a later `#@pic.png:3` hits the
bare-abs guard; a later ranged form of a TEXT file is unaffected). Note both choices in the JSDoc.

**Markdown/text keep claiming abs:N / abs:N-M** (distinct ranges = distinct deliveries) — untouched.

## 5. Guard-vs-guard: bare-then-ranged AND ranged-then-bare both dedup

- `#@pic.png` then `#@pic.png:3`: #1 claims `abs`, delivers. #2 claims `abs:3` pre-read → F3 guard sees
  `injectedSet.has(abs)` TRUE → deletes `abs:3`, returns false. ONE image. ✓
- `#@pic.png:3` then `#@pic.png`: #1 claims `abs:3`, guard sees bare `abs` NOT present → adds `abs`, delivers.
  #2 claims `abs` → **processTokenStream L1213 does NOT skip it** (its key `abs` was added by #1's branch —
  wait: #1's branch ADDED bare `abs` to injectedSet; #2's record key is `abs`; L1213 `if
  (state.injectedSet.has(claimKey(rec.path, undefined, undefined)))` → `has(abs)` TRUE → **skipped in the
  stream loop, never reaches injectFile** → token left verbatim). ONE image. ✓
  (Even if it reached injectFile, the branch guard would catch it. Belt and suspenders.)
- Binary twins: identical shape. ✓
- Markdown `#@notes.md:2` + `#@notes.md`: markdown branch untouched → slice + whole both deliver (LR-7). ✓
- Ranged TEXT `#@a.ts:2 #@a.ts:3`: text branch untouched → two blocks (LINE-6 green). ✓

## 6. LINE-9 test (the regression gate — both orders, both kinds)

Fixtures ALREADY EXIST: `pic.png` (PNG_BYTES, L242; `PIC = path.join(TMPDIR,'pic.png')` L364) and
`data.bin` (NUL bytes, L243; `BIN` L365). Reuse them — no new fixtures, no mocking.

Placement: the LINE section (L2987+); LINE-8/LINE-8-MD/LINE-12 landed (T1.S1/S2); LINE-9 slots after LINE-8-MD
(~L3090, before LINE-12) or after LINE-12 — anywhere in the LINE block; specify "after the LINE-8-MD block".

```js
await runCase("LINE-9", "LR-2: #@pic.png #@pic.png:3 → ONE image (both orders); #@data.bin #@data.bin:5 → ONE note", async () => {
  const r1 = await mod.injectFiles("Describe #@pic.png and #@pic.png:3", [], FIX);
  assert(r1.injected === 1, `one delivery (bare + ranged collapse for images), got ${r1.injected}`);
  assert(r1.images.length === 1, `exactly ONE images entry (no duplicate bytes), got ${r1.images.length}`);
  assert(r1.images[0].data === PNG_BYTES.toString("base64"), "the one image is the real PNG base64");
  const r1b = await mod.injectFiles("Describe #@pic.png:3 and #@pic.png", [], FIX); // reverse order
  assert(r1b.injected === 1 && r1b.images.length === 1, `reverse order also ONE image, got injected=${r1b.injected} images=${r1b.images.length}`);
  const r2 = await mod.injectFiles("Inspect #@data.bin and #@data.bin:5", [], FIX);
  assert(r2.injected === 1, `binary twin: one delivery, got ${r2.injected}`);
  assert(countBlocks(r2, BIN) === 1, `exactly ONE binary note block, got ${countBlocks(r2, BIN)}`);
  const r2b = await mod.injectFiles("Inspect #@data.bin:5 and #@data.bin", [], FIX);
  assert(r2b.injected === 1 && countBlocks(r2b, BIN) === 1, `reverse binary order also ONE note`);
});
```
(A 4-line helper `countBlocks(r, abs)` = `r.blocks.filter(b => b.includes('<file name="'+abs+'">')).length`
may already exist as a similar helper — check `hasBlock` (used at L470); if `hasBlock(r, x)` is boolean-only,
inline the filter. Each injectFiles call is a FRESH state (dedup is per-call via state.injectedSet) so the
4 sub-cases don't interfere. `FIX` = no-budget inline ctx, L363.)

## 7. Validation

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck                 # → 0 errors (Set.has/add/delete on string keys; no type change)
node ./file-injector.test.mjs     # → 177 passed (176 + LINE-9), 0 failed; LINE-1..8/12 + F3/F5/F4 image/binary cases green
npm test                          # → all 4 files green (import-behavior/relative-imports/url-injection untouched)
```
Existing image/binary tests (case 3, case 4, F3a/b, F5, F4) exercise SINGLE tokens — unaffected (the bare-abs
guard fires only when a duplicate appears). LINE-6 (text ranges dedup correctly) unaffected (text untouched).