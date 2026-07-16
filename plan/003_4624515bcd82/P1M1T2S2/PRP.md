---
name: "P1.M1.T2.S2 — estimateImageTokens + total-size budget for image/binary"
prd_ref: "PRD §5.6.2 (Total-size budget accounting), §5.2 (image consume budget, never paged), §5.3 (binary note cost)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — add estimateImageTokens; add 3 subtract() calls in injectFile
target_language: TypeScript (jiti transpile-on-load; no tsconfig/lint/test-framework — the .mjs harness IS the gate)
depends_on: "P1.M1.T2.S1 (VERIFIED LANDED at commit accfb14: IMAGE_FALLBACK_TOKENS at L42; injectFile at L421–461 with F5/image/binary/text branches; subtract at L215; emitText already subtracts at L476/L500)"
consumed_by: "P1.M1.T2.S3 (injectMarkdown calls emitText, which already subtracts — no new budget wiring needed by S3), P1.M1.T2.S4 (module-surface sync — estimateImageTokens export must be present + sanity-asserted)"
---

# PRP — P1.M1.T2.S2: estimateImageTokens + total-size budget for image/binary

> **Scope flag:** ADDITIVE budget wiring. Create ONE new exported pure helper (`estimateImageTokens`)
> and add THREE `subtract(state, …)` calls inside the existing `injectFile` branches (F5 empty-image,
> image attach, binary). Text already subtracts via `emitText` (T1.S2) — DO NOT double-count it.
> No new constants (consume `IMAGE_FALLBACK_TOKENS` from T2.S1). No behavior change when budget is
> unknown (`state.remaining === null` → subtract is a no-op → O-1 fallback unchanged). The 61-test
> suite stays green; add ~4–6 new tests + 1 sanity assert.

---

## Goal

**Feature Goal:** Make images, binary notes, and empty-image notes consume the shared `state.remaining`
budget at emit time, so the **total filesize of every delivered file** (text + image + binary) is
accounted for against the model's remaining context window — PRD §5.6.2. Today only text subtracts
(via `emitText`); this subtask closes that gap by adding `estimateImageTokens(resized)` and wiring
`subtract` into the three non-text branches of `injectFile`. Images are NEVER paged (resized+attached);
they consume budget so a later text file in the same prompt sees a budget that already reflects the image.

**Deliverable:** A modified `./file-injector.ts` (in-place edit) where:
1. **`export function estimateImageTokens(resized: ResizedImage | null): number`** — pure. If `resized`
   is non-null (has numeric `width`/`height`): `Math.max(1, Math.ceil(resized.width/512)) *
   Math.max(1, Math.ceil(resized.height/512)) * 170 + 85` (the Anthropic 512-tile formula, PRD §5.6.2).
   Else (raw-base64 fallback path): `IMAGE_FALLBACK_TOKENS` (2805). Place near the other pure helpers
   (e.g. near `isAbsoluteOrTilde`/`computeCodeRanges`).
2. **In `injectFile` (L421–461), add a `subtract` call inside each of the 3 non-text branches** (after
   the existing `state.blocks.push(...)`):
   - **F5 empty-image (after L438):** `subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4));`
   - **image attach (after L449):** `subtract(state, estimateImageTokens(resized));`
   - **binary (after L452):** `subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4));`
3. **Test sanity list:** append 1 assert (`estimateImageTokens`) after the 15 existing asserts (L127).
4. **New §5.6.2 test section:** ~4–6 `runCase` blocks: (a) pure `estimateImageTokens` unit cases
   (null→2805; 512×512→255; 513×513→765; 2000×2000→2805); (b) a shared-budget interaction test proving
   an image + a large text file under `PAGED_FIX` leaves the text file paged (image consumed budget),
   reusing the merged-ctx pattern from PN2.

**Success Definition:** `node ./file-injector.test.mjs` prints `Result: <61 + N> passed, 0 failed.`
(N = new §5.6.2 test count, ~4–6), exit 0. The existing 61 cases stay green (subtract is a no-op when
`state.remaining === null`, so every budget-less case — FIX mock, most of the suite — is byte-for-byte
unchanged; the budget-aware cases PD1–PD8/PN1–PN4 see only an additional subtract that does not flip
their existing whole-vs-paged outcomes). `estimateImageTokens` is exported and asserted.

## Why

- **The total-size budget (PRD §5.6.2).** The budget is cumulative over **every** delivered file, not a
  per-file check. `remaining` is computed once and mutated in emission order (depth-first). Today only
  text subtracts; an image or binary note is "free," so a prompt like `#@pic.png #@huge.log` under a
  tight budget lets the image's ~thousands of image tokens vanish from the accounting, risking overflow.
  T2.S2 makes all three types subtract so the running total never silently exceeds the window. (Recursion
  in T2.S3 then shares this same `remaining` across top-level files AND all transitive markdown imports.)
- **Conservative, deterministic cost estimates (no network).** Image cost uses the Anthropic 512-tile
  formula on the **resized** dimensions (`max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170+85`); when dimensions are
  unavailable (the raw-base64 fallback, `resizeImage→null`), the flat `IMAGE_FALLBACK_TOKENS = 2805`
  (the 2000×2000 resized worst case = 4·4·170+85). Binary/empty-image notes are tiny strings, so their
  cost is `Math.ceil(noteString.length / 4)` — the same chars-per-token heuristic text uses (O-3).
- **Images never page.** An image is resized and attached (PRD §5.2); it consumes budget but is NEVER
  paged. (Only text pages.) This is already the shipped behavior (PD4); T2.S2 only adds the cost.

## What

User-visible behavior: **none** when no budget is available (the overwhelmingly common case — most of
the test suite and the default `FIX` mock have `remaining === null`). When a model/context budget IS
available, images + binary/empty-image notes now decrement `state.remaining` at emit time, so a later
file's inline-vs-paged decision sees a budget that accounts for everything injected before it. No new
files, no new dependencies, no new fixtures (reuses `pic.png`, `data.bin`, `empty.png`, `huge.log`).

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `<61 + N> passed, 0 failed` (N ≈ 4–6 new tests), exit 0. The
      original 61 cases are UNCHANGED (green).
- [ ] `export function estimateImageTokens(resized: ResizedImage | null): number` exists, is `export`ed,
      is PURE (no I/O, no state mutation), and returns the exact tile formula for non-null resized and
      `IMAGE_FALLBACK_TOKENS` (2805) for null.
- [ ] `injectFile` (L421–461) has exactly 3 NEW `subtract(state, …)` calls — one in each of the F5
      empty-image, image-attach, and binary branches — placed AFTER the existing `state.blocks.push(...)`.
      The text branch (`emitText`) is UNTOUCHED (it already subtracts; do not double-count).
- [ ] Image cost = `estimateImageTokens(resized)`; binary + empty-image costs = `Math.ceil(formatXBlock(abs).length / 4)`.
- [ ] When `state.remaining === null` (budget unknown), the 3 new subtracts are no-ops (current O-1
      fallback behavior preserved — verified by the 61 green cases, esp. the FIX-mock cases).
- [ ] New §5.6.2 tests pass: estimateImageTokens unit cases (null→2805, 512×512→255, 513×513→765,
      2000×2000→2805); a shared-budget interaction case (image + huge.log under PAGED_FIX → huge.log
      pages, image attached, paged===1) using the PN2 merged-ctx pattern.
- [ ] Test sanity list has exactly 1 NEW assert appended (16 total); the 15 existing asserts UNTOUCHED.
- [ ] [Mode A] JSDoc on `estimateImageTokens` (tile estimate formula, 512/170/85, fallback constant).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the verified POST-T2.S1 starting state (exact lines for
`IMAGE_FALLBACK_TOKENS` L42, `injectFile` branches L436–455, `subtract` L215, `emitText` already
subtracting L476/L500), the exact `estimateImageTokens` body (the Anthropic 512-tile formula), the 3
exact `subtract` lines to add (with their block-formatter cost expressions), the confirmed
`ResizedImage.width/height` numeric fields, the test-harness append points (sanity assert after L127;
new section after CC9 ~L1137 before the L1141 summary), the exact budget-mock math (PAGED_FIX
remaining=23616; image subtract=2805), and the verified validation command. The implementer edits one
source file + appends to the test harness, then runs one command.

### Documentation & References

```yaml
# MUST READ — the exact cost table + formula for THIS subtask
- file: PRD.md
  why: "§5.6.2 pins the per-type cost table: Image = estimateImageTokens(resized) =
        max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170+85, fallback IMAGE_FALLBACK_TOKENS=2805 (2000×2000 = 4×4
        tiles); binary note = Math.ceil(noteString.length/4); images consume budget but are NEVER paged
        (§5.2). §5.6.2's 'monotonic shared accumulator' is WHY these subtracts go in injectFile."
  section: "#### 5.6.2 Total-size budget accounting + ### 5.2 Image files + ### 5.3 Other binary files"
  critical: "The image cost is the TILE estimate on resized dimensions, NOT the length of the tiny
             <file name=ABS></file> reference block (that block is ~30 chars — the real cost is the
             attached base64 image, estimated by the tile formula). Binary/empty-image notes ARE small
             strings, so they use Math.ceil(length/4). Text already subtracts in emitText — do NOT add
             a subtract to the text branch (double-counting)."

# MUST READ — the MI-2 insertion-point contract (estimateImageTokens signature + the 3 subtract wirings)
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "## MI-2 'New pure helpers' pins estimateImageTokens(resized): number — resized with numeric
        width/height: max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170+85; else IMAGE_FALLBACK_TOKENS. ## MI-2 'Total-size
        budget (§5.6.2) — wire into injectFile' pins the EXACT 3 subtract lines (image attach, binary
        note, empty-image note) and notes emitText already subtracts text."
  section: "## MI-2 — Markdown imports + total-size budget → 'New pure helpers' + 'Total-size budget'"
  critical: "estimateImageTokens MUST be EXPORTED (it's in the test sanity list). The 3 subtracts go in
             injectFile's existing branches, NOT in emitText and NOT in a new function."

# MUST READ — the budget facts (shared accumulator, O-1 null fallback, subtract no-op)
- file: plan/003_4624515bcd82/architecture/system_context.md
  why: "§1 'Context budget (text-only subtraction; getContextUsage/ctx.model)' is the CURRENT state —
        T2.S2 is what changes 'text-only' to 'all three types'. §5 fact 6 'Budget is ONE shared
        remaining, computed once and mutated in emission order (depth-first)' is the design principle.
        §6 'Budget Mock Pattern (for the test cases)' pins PAGED_FIX (remaining=23616) + the merged-ctx
        pattern {...makeMockCtx(TMPDIR).ctx, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model}."
  section: "## 1 + ## 5 (fact 6) + ## 6 Budget Mock Pattern"
  critical: "subtract() is a NO-OP when state.remaining===null (O-1 fallback). This is why ALL 61
             existing cases stay green — only the budget-aware cases (PD/PN under PAGED_FIX/TINY_FIX)
             see any change, and even there the new subtracts don't flip existing outcomes (PD4 image
             still attaches with paged===0; the image's 2805 subtract doesn't push any existing test
             across a threshold because the FIX/no-budget cases are no-ops and the PAGED cases were
             already far past the threshold)."

# MUST READ — ResizedImage.width/height are VERIFIED numeric (no null-guard needed on the success path)
- file: plan/003_4624515bcd82/architecture/external_deps.md
  why: "§2 'ResizedImage: { data; mimeType; originalWidth; originalHeight; width: number; height: number;
        wasResized } — resizeImage(bytes,mime) (no options) caps to 2000×2000; returns null if it can't
        process. width/height feed estimateImageTokens (§5.6.2).' Confirms width/height are REQUIRED
        numbers — the formula reads them directly when resized !== null."
  section: "## 2. Pi API facts the delta relies on"
  critical: "The single null-check (resized === null) on the WHOLE object is sufficient. Do NOT add
             per-field null-checks on width/height — they are typed `number` and always present on a
             non-null ResizedImage. The Math.max(1, ⌈x/512⌉) guards make even a 0 dimension safe (→1 tile)."

# MUST READ — the contract for what exists when T2.S2 begins (POST-T2.S1, VERIFIED LANDED at accfb14)
- file: plan/003_4624515bcd82/P1M1T2S1/PRP.md
  why: "T2.S1 is the CONTRACT: IMAGE_FALLBACK_TOKENS=2805 landed at L42 (JSDoc says 'Consumed by
        estimateImageTokens (T2.S2)'); injectFile L421–461 has the F5/image/binary/text cascade;
        subtract() at L215; emitText at L471 already subtracts (L476 whole, L500 paged head). The CC1–CC9
        tests + 15 sanity asserts landed. T2.S2 CONSUMES these — does not redeclare IMAGE_FALLBACK_TOKENS,
        does not touch scanTokens/computeCodeRanges/inCode, does not touch emitText."
  critical: "Do NOT re-add IMAGE_FALLBACK_TOKENS (T2.S1 owns it at L42). Do NOT touch the text branch of
             injectFile (emitText already subtracts). T2.S2 ONLY: adds estimateImageTokens, and adds 3
             subtract lines (one per non-text branch)."

# EXTERNAL — authoritative source for the 512/170/85 image token formula
- url: https://docs.claude.com/en/docs/build-with-claude/vision
  why: "Anthropic Vision guide: image tokens = (tiles_w × tiles_h × 170) + 85, where tiles = ceil(px/512)
        with a minimum of 1 tile per side. This is the exact formula estimateImageTokens implements.
        (Legacy URL https://docs.anthropic.com/en/docs/build-with-claude/vision redirects here.)"
  critical: "Anthropic resizes the longest edge to ≤1568 before tiling, so 2805 (computed from the
             2000×2000 resize cap) is a CONSERVATIVE upper bound — appropriate for a budget guard that
             must not UNDER-estimate. The constant comment in code already notes 4·4·170+85=2805."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE SOURCE FILE EDITED (POST-T2.S1 ~680 lines, HEAD accfb14:
│                             #    constants cluster L25-42 [incl. IMAGE_FALLBACK_TOKENS L42];
│                             #    subtract L215; injectFile L421-461 [F5 L436-439, image L440-450,
│                             #    binary L451-453, text L454-456]; emitText L471-501 [subtracts
│                             #    at L476 whole + L500 paged]; computeCodeRanges/inCode exported)
├── file-injector.test.mjs    # gate (1161 lines; 61 runCase; sanity list L113-127 [15 asserts];
│                             #   CC9 ends ~L1137; summary "// 10. ..." at L1141. EDIT: append 1
│                             #   sanity assert after L127 + add a new §5.6.2 test section after CC9)
├── package.json              # { "pi": { "extensions": ["file-injector.ts"] } } — untouched
├── PRD.md                    # read-only
├── README.md                 # untouched (Mode B docs are T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/
    │   ├── codebase_insertion_points.md   # ← MI-2 estimateImageTokens sig + the 3 subtract lines
    │   ├── system_context.md              # ← budget facts + PAGED_FIX mock math + merged-ctx pattern
    │   └── external_deps.md               # ← ResizedImage.width/height numeric; no new deps
    ├── P1M1T1S2/PRP.md                    # ← emitText/subtract origin (read-only reference)
    ├── P1M1T2S1/PRP.md                    # ← the CONTRACT (IMAGE_FALLBACK_TOKENS + injectFile cascade)
    └── P1M1T2S2/
        ├── research/research_notes.md     # ← full first-hand verification (this subtask)
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — add export estimateImageTokens (pure helper, near
                          #                  computeCodeRanges/inCode ~L210); add 3 subtract(state, …)
                          #                  calls in injectFile (after L438 F5 push, after L449 image
                          #                  push, after L452 binary push). NO other changes.
file-injector.test.mjs    # MODIFIED — append 1 sanity assert (estimateImageTokens) after L127;
                          #                  add a new TOTAL-SIZE BUDGET (§5.6.2) section (~4-6 runCase
                          #                  blocks) after CC9 (~L1137), before the L1141 summary.
# No other files. No new files. No new dependencies. No new fixtures (reuses pic.png/data.bin/empty.png/huge.log).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — IMAGE_FALLBACK_TOKENS ALREADY EXISTS (file-injector.ts L42, module-scope const, NOT exported,
//   landed by T2.S1). Its JSDoc explicitly says "Consumed by estimateImageTokens (T2.S2)." Do NOT
//   redeclare it. estimateImageTokens REFERENCES it (in scope at module level — no import needed).

// CRITICAL — the 3 subtracts go in injectFile's EXISTING branches, AFTER the existing push, INSIDE the
//   branch block (before the branch's closing brace, before the shared `state.count++; return true;` at
//   L457/L458). Do NOT move the pushes. Do NOT restructure the if/else-if cascade. Do NOT add a subtract
//   to the text branch (emitText already subtracts at L476 whole / L500 paged head — double-counting
//   would corrupt the budget).

// CRITICAL — the image cost is estimateImageTokens(resized), NOT the length of the reference block.
//   The image branch pushes a TINY block (formatImageBlock → `<file name="ABS"></file>` or with a
//   dimension hint, ~30-60 chars). The REAL cost is the attached base64 image, which the tile formula
//   estimates (hundreds to thousands of tokens). Using Math.ceil(block.length/4) for the image would
//   UNDER-count by ~100x and defeat the budget. Binary + empty-image notes ARE the actual content
//   (small fixed strings), so they correctly use Math.ceil(length/4).

// CRITICAL — the `resized` variable is IN SCOPE at the image-branch subtract site (declared at L441:
//   `const resized = await resizeImage(new Uint8Array(buf), mime);`). It is `ResizedImage | null`.
//   estimateImageTokens handles both: null → IMAGE_FALLBACK_TOKENS; non-null → tile formula on
//   resized.width/resized.height. Pass it directly: `subtract(state, estimateImageTokens(resized));`.

// CRITICAL — ResizedImage.width/height are VERIFIED numeric (external_deps.md §2; pi's
//   image-resize-core.d.ts: `width: number; height: number`). Do NOT add per-field null-checks. The
//   single `resized === null` guard inside estimateImageTokens is sufficient. Math.max(1, ⌈x/512⌉)
//   makes even a 0 dimension safe (→ 1 tile).

// CRITICAL — subtract() is a NO-OP when state.remaining === null (L215-218). This is WHY all 61 existing
//   cases stay green: the FIX mock (cwd-only, no budget) → remaining null → all 3 new subtracts no-op →
//   byte-for-byte unchanged. Only PD/PN cases under PAGED_FIX/TINY_FIX see a change, and even there the
//   new subtracts (image: 2805; binary note: ~17 tokens; empty-image note: ~17 tokens) do not flip any
//   existing whole-vs-paged outcome (PD4 image still paged===0; PD1/PD2 huge.log still paged===1; the
//   image's 2805 subtract shrinks remaining from 23616→20811, but huge.log fileCost≈524288 still far
//   exceeds 0.6·20811=12486). VERIFY this by running the gate after wiring — if any PD/PN case flips,
//   re-check your subtract placement (wrong branch / double-counting text).

// GOTCHA — the binary + empty-image costs must use the SAME formatter that produced the block, called
//   again to measure its length. `subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4));` calls
//   formatBinaryBlock(abs) a second time — it is a PURE deterministic string builder (no side effects),
//   so the double call is safe and keeps the cost EXACTLY matched to the emitted block. (Alternative:
//   hoist `const block = formatBinaryBlock(abs); state.blocks.push(block); subtract(state,
//   Math.ceil(block.length / 4));` — cleaner, avoids the double call. Either is correct; the hoist is
//   marginally preferable. SAME for formatEmptyImageBlock.) The image branch does NOT measure its block
//   string — it uses estimateImageTokens(resized) (the tile formula), so no double-call concern there.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step, no tsconfig, no lint, no test framework.
//   The .mjs harness imports file-injector.ts directly. jiti transpiles-on-load (no strict type-check),
//   so a type nit won't fail the gate — but a SYNTAX error or an undefined-identifier reference (e.g.
//   referencing estimateImageTokens before its declaration, or IMAGE_FALLBACK_TOKENS — already defined)
//   will fail the harness import (the sanity asserts never run → process exits non-zero with a jiti/TS
//   error). estimateImageTokens MUST be defined before injectFile references it (TS function declarations
//   hoist, but place it with the other pure helpers near computeCodeRanges for clean source ordering).
//   The ONLY gate is `node ./file-injector.test.mjs`.

// GOTCHA — the §5.6.2 interaction test (item §5 MOCKING) must PROVE the image consumed budget, not
//   merely that huge.log paged (huge.log pages under PAGED_FIX even WITHOUT the image, per PD1). The
//   cleanest proof combines: (a) a PURE estimateImageTokens unit test (null→2805 etc.) that pins the
//   cost value; (b) a structural assertion that under PAGED_FIX, `#@pic.png` + `#@huge.log` yields
//   paged===1 with the image attached at images[0] and the huge.log head block AFTER the image block
//   (emission order). The "image consumed budget" is structurally entailed: huge.log's decision ran
//   AFTER the image's subtract, and it paged. (To make the effect observable/vivid, the PRP also
//   specifies computing the exact remaining-after-image in the test comment: 23616 - 2805 = 20811.)
```

## Implementation Blueprint

### `estimateImageTokens` — pure helper (place near `computeCodeRanges`/`inCode`, ~L210, BEFORE injectFile)

```ts
/**
 * PRD §5.6.2 — conservative image-token estimate for budget accounting. Images consume the shared
 * `remaining` budget but are NEVER paged (§5.2: resized + attached). This estimate lets a later file's
 * inline-vs-paged decision see a budget that already reflects the image.
 *
 * Formula (Anthropic Vision guide, https://docs.claude.com/en/docs/build-with-claude/vision): an image
 * is tiled into 512×512 blocks; each tile ≈ 170 tokens; plus a flat 85-token base. So
 *   tokens = max(1, ⌈width/512⌉) · max(1, ⌈height/512⌉) · 170 + 85
 * computed on the RESIZED dimensions (resizeImage caps the longest edge to 2000, so the worst case is
 * ⌈2000/512⌉=4 tiles per side → 4·4·170+85 = 2805 = IMAGE_FALLBACK_TOKENS).
 *
 * When `resized` is null (resizeImage could not process the bytes → the raw-base64 fallback path),
 * dimensions are unavailable, so return the flat `IMAGE_FALLBACK_TOKENS` (the 2000×2000 worst case — a
 * CONSERVATIVE upper bound appropriate for a budget guard that must not under-count). ResizedImage.width
 * and .height are required numbers (pi's ResizedImage type), so no per-field null-check is needed; the
 * Math.max(1, ⌈x/512⌉) guard makes even a 0 dimension safe (→ 1 tile).
 *
 * PURE: no I/O, no state mutation. Exported for unit testing + the module-surface sanity list.
 *
 * @param resized the resizeImage result (null on the raw-base64 fallback path)
 * @returns the conservative image token cost
 */
export function estimateImageTokens(resized: ResizedImage | null): number {
  if (resized === null) return IMAGE_FALLBACK_TOKENS;
  const tilesW = Math.max(1, Math.ceil(resized.width / 512));
  const tilesH = Math.max(1, Math.ceil(resized.height / 512));
  return tilesW * tilesH * 170 + 85;
}
```

> **NOTE:** `ResizedImage` is already imported at L3 (`import { resizeImage, formatDimensionNote, type
> ResizedImage } from "@earendil-works/pi-coding-agent";`). `IMAGE_FALLBACK_TOKENS` is the module-scope
> const at L42. Both are in scope — no new imports. Place `estimateImageTokens` AFTER `computeCodeRanges`/
> `inCode` (T2.S1's exports) and BEFORE `scanTokens`/`injectFile` for clean ordering. (TS function
> declarations hoist, but co-locating pure helpers aids readability.)

### `injectFile` — the 3 subtract wirings (L421–461; 3 surgical edits, one per non-text branch)

The POST-T2.S1 body of the classify cascade is (showing the relevant region, L435–456):

```ts
    const buf = await fs.readFile(abs); // read ONCE; reused by image + text/binary paths
    if (mime && buf.length === 0) {
      // F5 — a 0-byte image file would attach an EMPTY ImageContent (which providers reject).
      // Align with the text path's empty-file handling: emit a note block, attach nothing.
      state.blocks.push(formatEmptyImageBlock(abs));                                    // L438
    } else if (mime && hasValidImageMagic(buf, mime)) {
      // F3 — validate the ACTUAL bytes match the declared image type before attaching.
      // A mislabeled file (e.g. text named `.png`) fails the magic-number sniff and falls
      // through to the text/binary path instead of attaching decoded garbage as an image.
      const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
        mimeType: resized?.mimeType ?? mime, // null => original mime
      });
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>   // L449
    } else if (isBinary(buf)) {
      // BINARY (PRD §5.3) — note, no decoded garbage (em dash U+2014)
      state.blocks.push(formatBinaryBlock(abs));                                        // L452
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      emitText(abs, buf.toString("utf8"), state);                                       // L455  ← DO NOT add subtract (emitText owns it)
    }
    state.count++; // exactly one delivery per claimed file
    return true;
```

**T2.S2 edit 1 — F5 empty-image branch (after L438 push):**
```ts
      state.blocks.push(formatEmptyImageBlock(abs));
      subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4)); // §5.6.2 — note consumes budget
```
(Or hoist: `const block = formatEmptyImageBlock(abs); state.blocks.push(block); subtract(state, Math.ceil(block.length / 4));` — cleaner. Either is correct.)

**T2.S2 edit 2 — image-attach branch (after L449 push):**
```ts
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
```

**T2.S2 edit 3 — binary branch (after L452 push):**
```ts
      state.blocks.push(formatBinaryBlock(abs));
      subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4)); // §5.6.2 — note consumes budget
```
(Or hoist as in edit 1.)

Leave EVERY other line of `injectFile` (stat, claim, ext/mime, the `state.images.push`, `state.count++`,
`return true`, the try/catch) UNTOUCHED. **Do NOT add a subtract to the text branch** — `emitText`
(L471) already calls `subtract` at L476 (whole) and L500 (paged head). Adding one here would
double-count text.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD export estimateImageTokens to file-injector.ts (near computeCodeRanges/inCode, ~L210, BEFORE injectFile)
  - IMPLEMENT: export function estimateImageTokens(resized: ResizedImage | null): number per the Blueprint
            — null → IMAGE_FALLBACK_TOKENS; non-null → max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170+85.
  - NAMING: estimateImageTokens (camelCase exported function, matches cleanToken/expandTildeAndResolve/
            isAbsoluteOrTilde/computeCodeRanges convention).
  - PLACEMENT: with the other pure helpers, after computeCodeRanges/inCode (T2.S1), before scanTokens.
  - EXPORT: YES (export function). Consumed by injectFile (Task 2) + the test sanity list (Task 3) +
            the unit tests (Task 4).
  - DEPENDENCIES: IMAGE_FALLBACK_TOKENS (L42, already present from T2.S1 — REFERENCE, do not redeclare);
            ResizedImage type (imported L3 — REFERENCE, no new import).
  - JSDOC: [Mode A] cite PRD §5.6.2, the Anthropic formula (512/170/85), the fallback rationale, and the
            URL. Note images consume budget but are never paged (§5.2).
  - GOTCHA: TS function declarations hoist, so even if placed after injectFile it would work — but place
            it BEFORE injectFile for clean source ordering (pure helpers grouped together).

Task 2: ADD the 3 subtract(state, …) calls in injectFile (file-injector.ts L438 / L449 / L452)
  - EDIT 1 (F5 empty-image branch, after the L438 push): add
            `subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4));`
            (OR hoist the block into a const and measure it — see Blueprint.)
  - EDIT 2 (image-attach branch, after the L449 push): add
            `subtract(state, estimateImageTokens(resized));`
            (`resized` is in scope, declared L441. This is the IMAGE cost — tile formula, NOT block length.)
  - EDIT 3 (binary branch, after the L452 push): add
            `subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4));`
            (OR hoist as in edit 1.)
  - PRESERVE: every other line of injectFile (stat/claim/ext/mime/read/images.push/count++/return/catch).
            The TEXT branch (emitText, L455) MUST NOT get a subtract — emitText already subtracts.
  - DEPENDENCIES: estimateImageTokens (Task 1); subtract (L215, already present); formatBinaryBlock/
            formatEmptyImageBlock (exported formatters, unchanged).
  - VERIFY: after this task, the gate MUST still be 61 passed, 0 failed (subtract is a no-op when
            remaining===null → FIX-mock cases byte-identical; PD/PN cases unaffected because the new
            subtracts don't cross any existing threshold — see Known Gotchas for the exact math).

Task 3: APPEND 1 sanity assert to file-injector.test.mjs (after L127 inCode assert, before blank L128)
  - APPEND:
      assert(typeof mod.estimateImageTokens === "function", "mod.estimateImageTokens must be a function (§5.6.2 image token estimate)");
  - PRESERVE: the 15 existing sanity asserts (L113-127). Do NOT re-add any. Do NOT touch any other line.

Task 4: ADD a new TOTAL-SIZE BUDGET (§5.6.2) test section to file-injector.test.mjs
  - PLACE: a new section AFTER CC9's closing `});` (~L1137) and BEFORE the "// 10. Summary ..." comment
            at L1141. Use the established `// ── ... ──` separator heading (e.g.
            `// ── TOTAL-SIZE BUDGET (PRD §5.6.2) — image/binary consume remaining ──`).
  - IMPLEMENT: ~4-6 runCase blocks. Cover:
    (EIT1) PURE estimateImageTokens(null) === 2805 (IMAGE_FALLBACK path). Pass `null` directly.
    (EIT2) PURE estimateImageTokens on a fake {width:512,height:512} === 255 (1·1·170+85). Construct a
            minimal object literal cast `as any` (the test is .mjs — no type check; just pass
            `{ width: 512, height: 512 }`). Also assert {width:1,height:1}===255 (max(1,·)→1 tile each).
    (EIT3) PURE estimateImageTokens {width:513,height:513} === 765 (2·2·170+85); {width:2000,height:2000}
            === 2805 (4·4·170+85 — matches IMAGE_FALLBACK_TOKENS, proving the constant's derivation).
    (BG1)  SHARED-BUDGET INTERACTION (item §5 requirement): under PAGED_FIX, inject `Describe #@pic.png
            and summarize #@huge.log`. Assert:
              - r.injected === 2 (both delivered)
              - r.paged === 1 (huge.log paged; image never pages)
              - r.images.length === 1 (pic.png attached)
              - the image reference block appears BEFORE the huge.log head block (emission order: pic.png
                decided first, its 2805 subtracted, THEN huge.log decided against the shrunken remaining)
            Use the merged-ctx pattern from PN2: NO ui needed (this asserts injectFiles output, not
            notify), so pass PAGED_FIX DIRECTLY as the ctx (like PD2/PD4). Math comment in the test:
            remaining = 50000-10000-8192-8192 = 23616; after pic.png subtract 2805 → 20811;
            0.6·20811 = 12486.6; huge.log fileCost = ⌈2097152/4⌉ = 524288 >> 12486.6 → PAGED. ✅
    (BG2, optional) BINARY consumes budget (no-flip regression guard): under PAGED_FIX, `#@data.bin` +
            `#@huge.log` → paged===1, injected===2, images.length===0, binary note block BEFORE huge.log
            head. Proves the binary subtract (≈17 tokens) ran and did not corrupt anything. (The binary
            cost is tiny, so this is mostly a no-flip regression guard + emission-order check.)
    (BG3, optional) EMPTY-IMAGE (F5) consumes budget (no-flip guard): under PAGED_FIX, `#@empty.png` +
            `#@huge.log` → paged===1, injected===2, images.length===0 (F5 attaches nothing), empty-image
            note block present BEFORE huge.log head.
  - PATTERN: for the PURE estimateImageTokens cases, call mod.estimateImageTokens(...) directly (like the
            CC cases call mod.computeCodeRanges/mod.inCode, and like F3b calls mod.hasValidImageMagic).
            For the interaction cases, call mod.injectFiles(prompt, [], PAGED_FIX) (like PD2/PD4).
  - NAMING: runCase("EIT1", "§5.6.2 — estimateImageTokens(null) === IMAGE_FALLBACK_TOKENS (2805)", …);
            EIT2, EIT3 (estimateImageTokens); BG1, BG2, BG3 (budget interaction). (EIT = Estimate Image
            Tokens; BG = Budget.)
  - GOTCHA: the tiny 1×1 pic.png fixture makes resizeImage return null DETERMINISTICALLY → estimateImageTokens
            takes the IMAGE_FALLBACK_TOKENS (2805) path in BG1 — that is the EXPECTED cost (the PRD item
            §3b note explicitly blesses this: "the tiny 1x1 PNG fixture makes resizeImage return null
            deterministically -> uses IMAGE_FALLBACK_TOKENS path in tests; that is fine"). Do NOT try to
            construct a fixture that resizeImage succeeds on — the fallback path IS what BG1 exercises.

Task 5: VERIFY — run the gate
  - RUN: cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs
  - EXPECT: `Result: <61 + N> passed, 0 failed.` (N = your new EIT/BG test count), exit 0.
  - CONFIRM: the 61 original cases are ALL still green. If ANY original case flips (esp. PD1/PD2/PD4/PD5
            or PN1-PN4 — the budget-aware cases), you either (a) added a subtract to the text branch
            (double-count), (b) put a subtract outside its branch (runs for every file), or (c) changed
            the if/else cascade structure. Diff injectFile against the POST-T2.S1 body in the Blueprint.
```

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    add (pure helper, after computeCodeRanges/inCode ~L210, before scanTokens): export estimateImageTokens
    edit (injectFile F5 branch, after L438 push): subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4))
    edit (injectFile image branch, after L449 push): subtract(state, estimateImageTokens(resized))
    edit (injectFile binary branch, after L452 push): subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4))
    preserve: IMAGE_FALLBACK_TOKENS (L42), every other injectFile line, subtract (L215), emitText (L471,
              already subtracts), scanTokens/computeCodeRanges/inCode/isAbsoluteOrTilde (T2.S1), injectFiles,
              the factory, the autocomplete provider.

  - modify: file-injector.test.mjs
    append (after L127 inCode assert, before blank L128): 1 typeof assert (estimateImageTokens)
    add (new section, after CC9 ~L1137, before "// 10. Summary" L1141): ~4-6 runCase blocks (EIT1..EIT3,
           BG1..BG3) — pure estimateImageTokens unit cases + the §5.6.2 image+huge.log interaction case.
    preserve: the 15 existing sanity asserts + every existing test case + the summary/exit logic.

NO OTHER CHANGES:
  - package.json: untouched
  - README.md: untouched (Mode B docs are T3.S1)
  - no new files, no new dependencies, no new fixtures

BEHAVIOR WHEN BUDGET IS UNKNOWN (remaining === null): UNCHANGED.
  - subtract() is a no-op when state.remaining === null (L215-218). The FIX mock (cwd-only) and every
    no-budget case → all 3 new subtracts no-op → byte-for-byte identical to POST-T2.S1. This is why the
    61 existing cases (the vast majority use FIX / no budget) stay green with zero semantic change.

BEHAVIOR WHEN BUDGET IS KNOWN (PAGED_FIX / TINY_FIX): the new subtracts run, but DO NOT flip any
  existing outcome:
  - PD4 (pic.png under PAGED_FIX): image still attaches, paged===0 (images never page). The 2805 subtract
    shrinks remaining 23616→20811 but PD4 only checks images.length===1 + paged===0 → still green.
  - PD5 (data.bin under PAGED_FIX): binary note still emitted, paged===0. The ~17-token subtract is
    negligible; PD5 checks the note block + images.length===0 → still green.
  - PD1/PD2 (huge.log under PAGED_FIX): still paged===1. huge.log fileCost≈524288 >> 0.6·remaining
    whether remaining is 23616 or 20811 → still paged.
  - PN1-PN4 (notify wording): notify counts (whole/paged) are unchanged by the new subtracts.
  - F5 (empty.png under FIX, no budget): subtract no-op → unchanged.
  VERIFY all this by running the gate after Task 2.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No tsc/lint configured as a gate. The .mjs harness loads file-injector.ts via jiti (Pi's loader),
# which transpiles+runs the TS on import. A SYNTAX error or an UNDEFINED-IDENTIFIER reference (e.g.
# referencing estimateImageTokens before declaring it, or re-declaring IMAGE_FALLBACK_TOKENS) surfaces
# as the harness failing to import — the sanity asserts never run → process exits non-zero with a
# jiti/TS error.

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -20
# Expected: the sanity assertions (now 16 of them: 15 + your 1) pass, then the case matrix begins.
# A jiti/TS error here means: (a) estimateImageTokens referenced before declaration (place it before
# injectFile), (b) a typo'd helper name, (c) accidentally re-declared IMAGE_FALLBACK_TOKENS, or
# (d) a subtract placed outside its branch (TS won't catch that — the gate will, in Level 2).
```

### Level 2: The Regression Gate (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   ... (matrix rows, incl. your new EIT1..EIT3 / BG1..BGn rows) ...
#   ──────────────────────────────────────────────────────────────────────────
#   Result: <61 + N> passed, 0 failed.        # N = your new estimateImageTokens/budget test count (~4-6)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL: the original 61 cases MUST all stay green. If the count is <61, a prior case regressed:
#   - A PD/PN case flipped whole↔paged → you likely added a subtract to the text branch (double-count),
#     or placed a subtract outside its branch (runs for every file), or changed the cascade structure.
#   - An F5/PD4/PD5 case flipped → you changed the image/binary/empty-image branch beyond the 1 subtract.
#   Diff injectFile against the POST-T2.S1 Blueprint body line-by-line. The ONLY allowed changes are:
#   +1 export function (estimateImageTokens) and +3 subtract lines (one per non-text branch).
# If it's exactly 61 + your N, you're done. The sanity list is now 16 (15 + 1); if it's not 16, your
# Task 3 append didn't land or you accidentally removed an existing assert.
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# PD4 (pic.png under PAGED_FIX) — MUST stay: injected===1, paged===0, images.length===1.
#   If paged flipped to 1 or images.length != 1: you changed the image branch beyond adding the subtract,
#   or estimateImageTokens threw. Re-read the image branch: the ONLY new line is
#   `subtract(state, estimateImageTokens(resized));` after the L449 push.

# PD5 (data.bin under PAGED_FIX) — MUST stay: injected===1, paged===0, images.length===0, note present.
#   If flipped: same as PD4 for the binary branch.

# F5 (empty.png under FIX, no budget) — MUST stay: injected===1, images.length===0, empty-image note.
#   subtract is a no-op (remaining===null) → unchanged. If flipped, you altered the F5 branch logic.

# PD1/PD2 (huge.log under PAGED_FIX) — MUST stay paged===1.
#   The image/binary subtracts in a DIFFERENT test shouldn't affect these (no image in PD1; PD2 has a.ts
#   not an image). If PD2 flipped, check you didn't accidentally add a subtract that runs for a.ts (text)
#   — the text branch must have NO new subtract.

# Your new EIT tests (EIT1..EIT3) — if one FAILS, the likely cause:
#   - Off-by-one in the tile math: re-check Math.max(1, Math.ceil(w/512)). 512→1, 513→2, 2000→4.
#   - EIT1 (null): ensure estimateImageTokens(null) returns IMAGE_FALLBACK_TOKENS (2805), not 0/undefined.
#   - EIT3 {2000,2000}===2805: this MUST equal IMAGE_FALLBACK_TOKENS — if not, the formula or constant is
#     wrong. (4·4·170+85 = 2720+85 = 2805.)

# Your BG1 interaction test — if it FAILS:
#   - paged != 1: huge.log didn't page. Check the image subtract actually ran (estimateImageTokens
#     wired in the IMAGE branch, not the text/binary branch). Or the merged ctx is wrong (use PAGED_FIX
#     directly as ctx, like PD2/PD4 — no makeMockCtx merge needed since BG1 checks injectFiles output,
#     not notify).
#   - images.length != 1: the image didn't attach — you may have disturbed the images.push.

# Re-run focusing on failures:
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|sanity|EIT|BG[0-9]|PD[0-9]|PN[0-9]"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2. There is no model, no network, no server, no DB.
# Optional manual sanity (proves the budget wiring visually — NOT required for the gate):
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  // Pure estimateImageTokens spot-checks:
  console.log("null      →", mod.estimateImageTokens(null));             // 2805
  console.log("512x512   →", mod.estimateImageTokens({width:512,height:512}));   // 255
  console.log("513x513   →", mod.estimateImageTokens({width:513,height:513}));   // 765
  console.log("2000x2000 →", mod.estimateImageTokens({width:2000,height:2000})); // 2805
'
# Expected: 2805, 255, 765, 2805. (Mirrors EIT1-EIT3.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `<61 + N> passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error when the harness imports file-injector.ts (the 16 sanity asserts all run).
- [ ] `estimateImageTokens` exists as an exported module-level function; `IMAGE_FALLBACK_TOKENS` is NOT
      redeclared (reused from T2.S1, already at L42).
- [ ] `injectFile` has exactly 3 NEW subtract calls (F5, image, binary branches); the text branch
      (`emitText`) has ZERO new subtracts; the rest of injectFile is unchanged.

### Feature Validation

- [ ] The 61 original cases stay green (T2.S2's subtracts are no-ops when remaining===null; and the
      budget-aware PD/PN cases don't flip because the new subtracts don't cross any threshold).
- [ ] `estimateImageTokens(null) === 2805`; `estimateImageTokens({width:512,height:512}) === 255`;
      `estimateImageTokens({width:513,height:513}) === 765`; `estimateImageTokens({width:2000,height:2000}) === 2805`.
- [ ] BG1: under PAGED_FIX, `#@pic.png` + `#@huge.log` → injected===2, paged===1, images.length===1,
      image block before huge.log head block (emission order; image consumed budget before huge.log decided).
- [ ] Images are never paged (PD4 still paged===0; BG1 image attached not paged).

### Code Quality Validation

- [ ] `estimateImageTokens` is EXPORTED; `subtract` is NOT (stays private); `IMAGE_FALLBACK_TOKENS` is
      NOT exported (module-scope const from T2.S1).
- [ ] The image cost uses `estimateImageTokens(resized)` (tile formula), NOT `Math.ceil(block.length/4)`.
- [ ] The binary + empty-image costs use `Math.ceil(formatXBlock(abs).length / 4)` (the note-string heuristic).
- [ ] Test sanity list has exactly 1 appended assert (16 total); the original 15 untouched.
- [ ] No double-counting: the text branch has no new subtract (emitText owns text cost).

### Documentation

- [ ] JSDoc on `estimateImageTokens` (PRD §5.6.2; Anthropic 512/170/85 formula + URL; IMAGE_FALLBACK_TOKENS
      fallback rationale; images consume budget but never paged §5.2). [Mode A — item §6 DOCS]
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT redeclare `IMAGE_FALLBACK_TOKENS`.** T2.S1 owns it (L42, module-scope const, NOT exported).
  estimateImageTokens REFERENCES it (in scope at module level). Re-declaring → jiti "Identifier already
  declared" error → harness import fails → gate fails before any test runs.
- ❌ **Do NOT add a subtract to the text branch of injectFile.** `emitText` (L471) already calls `subtract`
  at L476 (whole) and L500 (paged head). Adding one in injectFile's text branch would DOUBLE-COUNT text
  and corrupt the budget (huge.log under PAGED_FIX might wrongly stay whole, or a small file might page).
- ❌ **Do NOT use `Math.ceil(block.length / 4)` for the IMAGE cost.** The image reference block is a tiny
  string (~30-60 chars); the REAL cost is the attached base64 image. Use `estimateImageTokens(resized)`
  (the tile formula → hundreds/thousands of tokens). Using the block length would under-count ~100x.
- ❌ **Do NOT place a subtract OUTSIDE its branch.** Each subtract must be INSIDE its `if`/`else-if` block,
  AFTER the push, BEFORE the branch's closing brace. A subtract placed after the cascade (before
  `state.count++`) would run for EVERY file including text → double-count text + mis-cost images/binaries.
- ❌ **Do NOT add per-field null-checks on `resized.width`/`resized.height`.** They are VERIFIED required
  `number` fields (external_deps.md §2). The single `resized === null` guard inside estimateImageTokens
  is sufficient. `Math.max(1, ⌈x/512⌉)` makes a 0 dimension safe.
- ❌ **Do NOT touch `emitText`, `scanTokens`, `computeCodeRanges`, `inCode`, `isAbsoluteOrTilde`,
  `injectFiles`, the factory, or the autocomplete provider.** T2.S2 only adds `estimateImageTokens` + 3
  subtract lines in injectFile. Every other function is a sibling's contract (T1.S2/T2.S1).
- ❌ **Do NOT restructure the injectFile if/else-if cascade.** The branch ORDER (F5 → image → binary →
  text) is load-bearing (F3 magic gate before binary; F5 empty-image before image; system_context §5.3).
  T2.S3 will insert a markdown branch between image and binary — leave the cascade shape intact so S3's
  insertion point is unambiguous.
- ❌ **Do NOT construct a fixture that `resizeImage` succeeds on for BG1.** The tiny 1×1 `pic.png` fixture
  makes `resizeImage` return null DETERMINISTICALLY → estimateImageTokens takes the IMAGE_FALLBACK path
  (2805). The PRD item §3b EXPLICITLY blesses this ("that is fine"). BG1 exercises the fallback path;
  EIT1-EIT3 cover the formula directly with fake objects. Do not fight the fixture.
- ❌ **Do NOT skip Level 2.** The 61-test gate is the authoritative check. If any original case flips,
  you changed behavior you shouldn't have — the ONLY allowed diff is +1 export function + 3 subtract lines.

---

## Confidence Score: 9/10

A tightly-scoped additive subtask: 1 new exported pure helper (`estimateImageTokens`, with the exact
Anthropic 512-tile formula + the IMAGE_FALLBACK constant already present from T2.S1) + 3 surgical
`subtract` lines in `injectFile`'s existing non-text branches, validated by ~4-6 new tests (3 pure
unit cases pinning the formula + 1-3 budget-interaction cases reusing the established PAGED_FIX mock
pattern). The PRP includes: the verified POST-T2.S1 starting state (exact lines for IMAGE_FALLBACK_TOKENS
L42, injectFile branches L436-455, subtract L215, emitText already subtracting L476/L500), the exact
estimateImageTokens body, the 3 exact subtract lines with their cost expressions, the confirmed
ResizedImage.width/height numeric fields, the test-harness append points (sanity assert after L127; new
section after CC9 ~L1137 before L1141), the exact budget math (PAGED_FIX remaining=23616; image
subtract=2805; huge.log still pages), and the single authoritative green gate. The -1 reserves for:
(a) the subtle "image cost = tile formula, NOT block length" distinction (a natural mistake — mitigated
by explicit Anti-Pattern + the EIT unit tests that would catch a length-based implementation), and
(b) the BG1 interaction test needing to PROVE budget consumption rather than just re-asserting huge.log
pages (mitigated by the EIT1-EIT3 pure unit tests that pin the exact 2805 cost value, making the
"image consumed budget" claim structurally entailed). The implementing agent edits one source file +
appends to the test harness, then runs one command.
