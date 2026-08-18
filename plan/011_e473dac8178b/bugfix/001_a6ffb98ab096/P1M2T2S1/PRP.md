---
name: "P1.M2.T2.S1 (bugfix 001_a6ffb98ab096) — injectUrl image branch: empty body → formatEmptyImageBlock note, no attachment (BUG-003 / bugfix-PRD Minor Issue 2: mirror the F5 guard to the URL image path)"
prd_ref: "bugfix PRD §Minor Issues Issue 2 (BUG-003: URL image response with empty body attaches an empty ImageContent — F5 guard not mirrored to the URL path) + §Recommendations ('Mirror the F5 empty-image guard into injectUrl's image branch (empty body → note block, no attachment)'); architecture/injection_bug002_003.md § BUG-003 injectUrl image path + § fix inputs (h) guard-placement analysis"
target_files: "./file-injector.ts (EDIT injectUrl image branch ONLY — one guard block after :945) + ./url-injection.test.mjs (+URL-IMG-EMPTY near DIS-4 :349) + ./README.md (Mode-A note on the ### URLs Images bullet :82)"
target_language: TypeScript (jiti transpile-on-load; gates = `npm run typecheck` --strict 0 errors + the 4-suite `npm test` chain; TDD: URL-IMG-EMPTY RED first, then the guard)
depends_on: "None blocking — the image branch (:944-963), formatEmptyImageBlock (:387-390, already exported), readBytesCapped (:861-878, empty-Buffer-on-zero-length), the local F5 template (:1306-1323), and the injectFiles 5th arg enableUrls (L1612) are LANDED and green (url-injection 38/0, file-injector 183/0). The parallel sibling P1.M2.T1.S1 (BUG-002) edits injectMarkdown Step-5 + file-injector.test.mjs + the README Line-range paragraph — code/test/doc regions FULLY DISJOINT from this task's."
consumed_by: "P1.M4.T6.S1 (README changeset sweep — verifies this subtask's Mode-A note), P1.M4.T6.S2 (spec consistency pass — BUG-003 has no spec anchors to sync)"
---

# PRP — P1.M2.T2.S1: injectUrl empty-body image guard (BUG-003 — F5 parity for URL images)

> **Scope flag:** Bugfix, surgical: ONE guard block inserted into `injectUrl`'s IMAGE branch (file-injector.ts,
> immediately after the `buf === null` overflow check at :945 and BEFORE `mime`/`resizeImage` at :946-947) that
> mirrors the local F5 empty-image template (:1306-1323) for URLs: a 200 `image/*` response with a **zero-length
> body** emits `formatEmptyImageBlock(url)` + an image detail + the note's budget cost + count++ → **true**,
> with **NO `ImageContent` attachment** (today it attaches `data: ""` — the provider-rejected shape F5 exists to
> prevent). Plus ONE regression test (**URL-IMG-EMPTY**, TDD RED-first, placed near DIS-4 in url-injection.test.mjs)
> and ONE Mode-A README sentence on the `### URLs` Images bullet. **No signature change, no exported-surface change,
> no edits to readBytesCapped/formatEmptyImageBlock/the local F5 path/scanTokens/computeDetailOffsets.**

---

## Goal

**Feature Goal:** Make an image URL whose response body is empty (200 + `content-type: image/*` + 0 bytes) behave
EXACTLY like a 0-byte local image file (F5): a note block — `<file name="URL"><empty image file — 0 bytes; nothing
to attach></file>` — is delivered (block + image detail + budget cost + count++), and **no `ImageContent` is pushed**
(today the branch attaches `{type:"image", data:"", mimeType}` — an empty attachment providers may reject with a 400
that fails the whole turn, and charges `estimateImageTokens(null)` = 2805 tokens for 0 bytes).

**Deliverable:** (1) Modified `./file-injector.ts` — the empty-body guard block in `injectUrl`'s image branch
(after :945, before :946); (2) modified `./url-injection.test.mjs` — `runCase("URL-IMG-EMPTY", …)` placed right
after DIS-4's closing `});` (~:363), RED first then GREEN; (3) modified `./README.md` — one sentence appended to
the `**Images**` bullet under `### URLs` (~:82, Mode A — rides with this subtask).

**Success Definition:**
1. URL-IMG-EMPTY (GREEN): `injectFiles("#https://example.com/empty.png", [], FIX, false, true)` with a mocked
   fetch returning `makeRes({ ct: "image/png", body: "" })` → `r.images.length === 0`;
   `hasBlock(r, '<file name="https://example.com/empty.png"><empty image file — 0 bytes; nothing to attach></file>')`
   (em dash U+2014); `r.injected === 1`; `r.details.length === 1 && r.details[0].kind === "image"`.
2. DIS-4 stays GREEN (non-empty body still attaches; `images[0].data` round-trips base64 byte-exact).
3. `npm run typecheck` → 0 errors (`--strict`); `node ./url-injection.test.mjs` → **39 passed, 0 failed**
   (38 + URL-IMG-EMPTY); `node ./file-injector.test.mjs` → 183/0 (untouched); `npm test` (4-suite chain) green.
4. No behavior change for non-empty image URLs (byte-identical to today) and for every non-image URL path.

## User Persona

**Target User:** A Pi user who injects an image URL (`#https://example.com/cat.png`) that happens to return a
200 with an empty body (a broken CDN edge, a truncated upload, a 0-byte object in object storage). Today the
turn can be **failed by the provider** (empty image attachment → 400) for a resource the user cannot see is broken.

**Use Case:** `Describe #https://example.com/empty.png` where the server returns `200 image/png` with 0 bytes →
the model receives the note block (`<empty image file — 0 bytes; nothing to attach>`), the model and the user both
see the reference was delivered-as-note, and no provider-rejected attachment is sent. Identical UX to `#@empty.png`
for a local 0-byte image (F5).

**User Journey:** user types `#<image-url>` → fetch 200 `image/*` → body length 0 → guard fires BEFORE resizeImage
(no Worker spawn for 0 bytes) → note block + image detail pushed, budget cost subtracted (≈ the note's chars/4,
~15-20 tokens — negligible), count++ → the token is "delivered" (transform; notify `#@ injected 1 whole`) → no
attachment on the user message.

**Pain Points Addressed:** (a) the silent provider-facing hazard (empty `ImageContent` may 400 the whole turn);
(b) the wrong budget cost (2805-token flat image estimate charged for 0 bytes); (c) the LOCAL/URL asymmetry (the
identical 0-byte situation produced a clean note for `#@file` but an empty attach for `#url`).

## Why

- **Closes a provider-rejection hazard, not a cosmetic gap.** `ImageContent` with `data: ""` is exactly the shape
  the local F5 guard exists to prevent ("a 0-byte image file would attach an EMPTY ImageContent (which providers
  reject)" — file-injector.ts:1306-1323's rationale). The URL path bypassed that guard, so a broken image URL can
  fail the user's entire turn at the provider boundary. The bug-hunt verified the repro end-to-end.
- **Restores local/URL parity — the extension's own design invariant.** `#<url>` is specified to behave "same as
  `#@image`" for images (README Images bullet). F5 (local) already emits the note for 0-byte images; the URL branch
  must mirror it, per the bugfix PRD's Recommendation 3 verbatim ("Mirror the F5 empty-image guard into injectUrl's
  image branch (empty body → note block, no attachment)").
- **Fixes the wrong budget accounting for free.** Today the empty path charges `estimateImageTokens(null)` === 2805
  (`IMAGE_FALLBACK_TOKENS`) for 0 delivered bytes; the guard charges the note's actual cost
  (`ceil(f5Block.length / 4)`), exactly as the local F5 template does.
- **Cheaper and earlier than the alternative.** The guard runs BEFORE `resizeImage` (:947) — a 0-byte body never
  spawns the WASM Worker (which would deterministically return null on empty bytes anyway: photon throws → catch →
  null). It also runs BEFORE the guard-3 budget check (:949), giving F5 parity: the note always delivers
  (≈15-20 tokens), rather than today's inconsistent silent-false (tight budget) vs empty-attach (loose budget).
- **Surgical and decoupled.** One 7-line guard in a private function, one test, one README sentence. No signature
  change, no exported-surface change, no edits to the readers/formatters/the local F5 path. The parallel sibling
  (P1.M2.T1.S1, BUG-002) edits entirely disjoint regions (injectMarkdown Step-5, file-injector.test.mjs, the README
  Line-range paragraph).

## What

**User-visible:** an image URL returning an empty body now produces the compact `read <url>` green line (image
detail) with the note as its delivered content — and **no image attachment** — instead of an empty attachment the
provider may reject. Non-empty image URLs are byte-identical to today.

**Technical behavior (the contract):** in `injectUrl`'s image branch, after the `buf === null` overflow check,
`buf.length === 0` → push `formatEmptyImageBlock(url)` to `state.blocks`; push
`{ path: url, kind: "image", dimensionHint: undefined }` to `state.details`; `subtract(state,
Math.ceil(f5Block.length / 4))`; `state.count++`; `return true` — WITHOUT touching `state.images`, WITHOUT calling
`resizeImage`, and WITHOUT the guard-3 budget turn-away.

### Success Criteria

- [ ] The guard block is inserted immediately AFTER `if (buf === null) return false;` (:945) and BEFORE
      `const mime = ct.split(";")[0].trim();` / `resizeImage` (:946-947), byte-equivalent to the blueprint below.
- [ ] The guard pushes block + detail and returns true; it does NOT push to `state.images` and does NOT call
      `resizeImage`/`estimateImageTokens`.
- [ ] `formatEmptyImageBlock` (L387-390) is reused as-is (already exported) — not re-implemented, not modified.
- [ ] URL-IMG-EMPTY present (near DIS-4), passes with the exact 4 assertions from Success Definition 1.
- [ ] DIS-4 and every other url-injection / file-injector case stay green (no leaked fetch stub — try/finally restore).
- [ ] README `### URLs` Images bullet gains the Mode-A sentence (empty image URL → note, same as a 0-byte local image).
- [ ] `npm run typecheck` → 0 errors; `node ./url-injection.test.mjs` → 39/0; `node ./file-injector.test.mjs` → 183/0.
- [ ] `git diff --stat` touches ONLY file-injector.ts + url-injection.test.mjs + README.md.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact current image-branch code (L944-963, quoted line-by-line with the insertion
point), the exact guard block to insert, the placement rationale (after null-check/before resizeImage/before
guard-3 — with the why for each), the exact `formatEmptyImageBlock` output string (em dash U+2014 spelled out), the
verified root cause (`readBytesCapped` returns an EMPTY Buffer for zero-length bodies — null only on overflow;
`resizeImage` deterministically null on empty bytes; `estimateImageTokens(null)` = 2805), the exact DIS-4 test
template to mirror (fetch stubbing with try/finally restore; `makeRes({ct:"image/png", body:""})` as the
deterministic zero-length-chunk fixture), the `injectFiles` 5th-arg `enableUrls` call shape, the label-collision
warning (URL-IMG-EMPTY, not BUG-003), the no-conflict boundary with the parallel BUG-002 sibling, the
computeDetailOffsets/renderer non-interaction (kind "image" is skipped by both — same as local F5), and both
verified gates with baselines. The implementer inserts one guard, adds one test, appends one README sentence,
runs three commands.

### Documentation & References

```yaml
# MUST READ — the BUG-003 analysis + the guard-placement analysis (the fix's authoritative source)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/injection_bug002_003.md
  why: "§ BUG-003 injectUrl image path: the verified repro (injected=1, images[0].data.length===0, empty <file> block),
        the root-cause chain (readBytesCapped empty-Buffer-not-null; resizeImage null-on-empty; estimateImageTokens(null)=2805),
        the EXACT guard block (verbatim in this PRP's blueprint), and § fix inputs (h): the placement analysis —
        after the null check / before resizeImage (no Worker spawn for 0 bytes) / before guard-3 (F5 parity: the note
        always delivers; ~15-20 token cost negligible)."
  critical: "The doc's guard block is the CONTRACT — copy it verbatim (incl. the `f5Block` local + ceil(len/4) cost
             + count++ + return true). Do NOT add a notify (local F5 doesn't notify either), do NOT run the budget
             guard-3 turn-away on the note path, do NOT un-claim anything (URLs have no claimKey — the URL loop in
             injectFiles claimed the dedup key BEFORE injectUrl; returning true is the normal delivered path)."

# MUST READ — the bugfix PRD's Issue 2 + Recommendation 3 (the requirement)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md   # bugfix PRD §Minor Issues Issue 2 (BUG-003) + §Recommendations
  why: "Issue 2 states Expected/Actual/repro; Recommendation 3 is the one-line mandate: 'Mirror the F5 empty-image
        guard into injectUrl's image branch (empty body → note block, no attachment) (BUG-003).' This task is that
        recommendation, scoped to the guard + test + README note."

# The parallel sibling (no conflict) — read to confirm the disjoint boundary, do NOT edit its regions
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M2T1S1/PRP.md
  why: "BUG-002 (injectMarkdown Step-5 invalidRange guard :1597-1603, +MD-LR3 in file-injector.test.mjs after
        LINE-10, README 'Line range.' paragraph). Its consumed_by/depends_on confirm the split. This task's regions —
        injectUrl image branch (:945-946), url-injection.test.mjs (+URL-IMG-EMPTY near DIS-4), README '### URLs'
        Images bullet (:82) — are FULLY DISJOINT. No shared edit sites; no merge conflict."
  critical: "Its frontmatter says it also edits README.md — but the Line-range paragraph, not the URLs section.
             Different bullets, no collision."

# The file you edit (source) — ONE guard block in the image branch
- file: file-injector.ts
  why: "injectUrl image branch L944-963: `const buf = await readBytesCapped(res, URL_MAX_BYTES);` →
        `if (buf === null) return false;` (:945, 'guard 2b — overflowed mid-stream') → `const mime = ct.split(\";\")[0].trim();`
        (:946) → `const resized = await resizeImage(new Uint8Array(buf), mime);` (:947, 'async Worker; null on failure')
        → cost/guard-3/images.push/formatImageBlock/detail/subtract/count++/return true (:948-963). INSERT the guard
        between :945 and :946. formatEmptyImageBlock :387-390 (ALREADY exported — reuse; do not modify). The local
        F5 template :1306-1323 is the parity reference (read it, do NOT edit it). injectFiles signature :1605-1615
        (5th arg enableUrls — the test passes it explicitly)."
  pattern: "injectUrl is PRIVATE (async (url, state, ctx) => Promise<boolean>), 'true iff a block (and/or image) was
            emitted (count bumped exactly once); false → verbatim'. The image branch pushes block+detail+subtract+count++
            inline (injectUrl owns its own count++ — unlike local files whose count++ is injectFile's trailing bump)."
  gotcha: "readBytesCapped (:861-878) returns an EMPTY Buffer for a zero-length body — null ONLY on overflow. So
           `buf.length === 0` is the correct empty test; do NOT compare `buf === null` again and do NOT use
           `!buf.length` with falsy-Buffer confusion (length is a number; `0` is falsy — use `=== 0` for exactness)."

# The file you edit (tests) — mirror DIS-4 exactly
- file: url-injection.test.mjs
  why: "makeRes({ct, body, status, ok, contentLength}) :147-170 — `body: \"\"` becomes `Buffer.from(\"\", \"utf8\")`
        (zero-length) and the reader's single chunk is that ZERO-LENGTH buffer = the deterministic empty-body fixture.
        DIS-4 :349-363 = the exact template: `const origFetch = globalThis.fetch;` captured BEFORE try;
        `globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({...}); };` →
        `const r = await mod.injectFiles(\"#example.com/img.png\", [], FIX, false, true);` → asserts →
        `finally { globalThis.fetch = origFetch; }`. FIX={cwd:TMPDIR} :122; hasBlock(r,needle)=r.blocks.some(b=>b.includes(needle)) :127-129.
        PLACE URL-IMG-EMPTY right AFTER DIS-4's closing `});` (~:363). Baseline: 38 passed, 0 failed."
  pattern: "Per-case fetch stubbing with save/restore in try/finally — a leaked stub poisons every later case (the
            suite already restores everywhere; mirror it). Use the explicit-scheme form `#https://example.com/empty.png`
            (the contract's spec) so the asserted block name is exactly 'https://example.com/empty.png'."
  gotcha: "Label collision: existing 'BUG-001'/'BUG-002'/'BUG-003' test labels in this suite refer to OLDER different
           bugs (DIS-1b/DIS-3 history). Use the unique label URL-IMG-EMPTY. Do NOT stub resizeImage (external,
           jiti-aliased; and the guard runs BEFORE it anyway)."

# The file you edit (docs) — one sentence, Mode A
- file: README.md
  why: "`### URLs` → 'By content type:' → the Images bullet :82: '- **Images** (`#https://example.com/cat.png`) →
        attached as an image, same as `#@image`.' Append the Mode-A note to this bullet (exact text in the blueprint)."
  gotcha: "Mode A rides WITH this subtask (item §5). Do NOT touch any other README section (the Line-range paragraph
           is the parallel sibling's; the full changeset sweep is P1.M4.T6.S1)."

# Downstream consumers (LANDED, read-only — verify non-interaction, do NOT edit)
- file: file-injector.ts   # computeDetailOffsets + renderInjectedMessage (P1.M1.T1.S1/S2/S3 — LANDED, BUG-001 fix)
  why: "computeDetailOffsets processes kinds text/paged/url/binary and SKIPS kind 'image' (no offsets) — my new detail
        {path: url, kind: 'image'} is skipped exactly like the local F5 empty-image detail. The renderer's tier-3
        path-aware fallback likewise skips image details (expanded view never shows image bodies; readLine shows
        'read <path>' with no dimensionHint since it's undefined). Verified consistent — no interaction, no edits."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD (baselines: file-injector 183/0, url-injection 38/0; all 4 suites green)
├── file-injector.ts             # ← EDIT (injectUrl image branch :945-946 — ONE guard block; nothing else)
├── url-injection.test.mjs       # ← EDIT (+URL-IMG-EMPTY after DIS-4 ~:363)
├── README.md                    # ← EDIT (### URLs Images bullet :82 — one Mode-A sentence)
├── file-injector.test.mjs       # NOT edited (the parallel sibling's file; verify 183/0 stays green)
├── relative-imports.test.mjs    # NOT edited (verify green via npm test)
├── import-behavior.test.mjs     # NOT edited (verify green via npm test)
├── scripts/typecheck.mjs        # untouched (--strict gate)
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/{injection_bug002_003.md, renderer_bug001.md, spec_ux_bug004_005.md, system_context.md}
    ├── P1M1T1S1..P1M1T1S3/{research, PRP.md}   # BUG-001 renderer-offset fixes — LANDED (Complete)
    ├── P1M2T1S1/{research/, PRP.md}            # BUG-002 (parallel sibling — injectMarkdown/file-injector.test/README Line-range)
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectUrl image branch: +the empty-body guard block between :945 and :946
                          #            (push formatEmptyImageBlock(url) + image detail + ceil(len/4) cost + count++ → true).
                          #            UNCHANGED: readBytesCapped; formatEmptyImageBlock; the local F5 template (:1306-1323);
                          #            the non-empty image path (:946-963); every other injectUrl branch; scanTokens;
                          #            injectMarkdown (the sibling's); computeDetailOffsets; renderInjectedMessage; injectFiles.
url-injection.test.mjs    # MODIFIED — +runCase("URL-IMG-EMPTY", …) after DIS-4 (~:363): fetch→makeRes({ct:"image/png",
                          #            body:""}) + injectFiles("#https://example.com/empty.png", [], FIX, false, true) →
                          #            images.length===0 + hasBlock(note) + injected===1 + details[0].kind==="image".
README.md                 # MODIFIED — the ### URLs Images bullet (:82) gains the Mode-A empty-body note sentence.
# No other files. No new exports (formatEmptyImageBlock is already exported; the guard adds no function).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — readBytesCapped returns an EMPTY Buffer for a zero-length body (null ONLY on overflow). So the existing
//   `if (buf === null) return false;` (:945) NEVER catches the empty case — that IS the bug. The guard tests
//   `buf.length === 0` (use the explicit === 0; don't rely on falsiness).

// CRITICAL — placement is load-bearing: AFTER :945 (buf exists; overflow handled) and BEFORE :946-947 (mime/resizeImage).
//   Before resizeImage = a 0-byte body never spawns the WASM Worker (resizeImage deterministically returns null on
//   empty bytes — photon throws → catch → null — so calling it first is pure waste). Before guard-3 (:949) = F5 parity:
//   the note ALWAYS delivers (its ~15-20 token cost is negligible); do NOT turn the note away on a tight budget.

// CRITICAL — do NOT push to state.images in the guard. The whole point is NO attachment (empty ImageContent is the
//   provider-rejected shape). Also do NOT call estimateImageTokens — the note's cost is ceil(f5Block.length / 4),
//   mirroring the local F5 template (which also does NOT use the 2805 flat estimate).

// CRITICAL — injectUrl owns its own count++ (local files get theirs from injectFile's trailing bump; injectUrl has no
//   wrapper). The guard must count++ and return true — the token IS delivered (as a note). No claim-juggling: the URL
//   loop in injectFiles claimed the dedup key BEFORE injectUrl; true is the normal delivered path.

// CRITICAL (test) — restore globalThis.fetch in a finally. A leaked stub poisons every later case in the suite (the
//   suite's convention; DIS-4 and friends all restore). Capture origFetch BEFORE the try.

// GOTCHA (test) — makeRes({body: ""}) is the deterministic zero-length fixture: Buffer.from("", "utf8") is a
//   zero-length buffer, and the reader's single chunk is that buffer. Do NOT use makeRes({body: undefined}) (defaults
//   to "" anyway) or omit body — be explicit for readability.

// GOTCHA (test) — use the explicit-scheme prompt "#https://example.com/empty.png" so the asserted block name is
//   exactly "https://example.com/empty.png" (DIS-4 uses the scheme-less "#example.com/img.png" form — both are
//   normalized to https://, but the explicit form makes the assertion self-evident). The note text contains an
//   EM DASH (U+2014): '<empty image file \u2014 0 bytes; nothing to attach>' — assert the full literal as in the
//   blueprint (paste the em dash, don't substitute '-').

// GOTCHA (test label) — existing "BUG-001"/"BUG-002"/"BUG-003" labels in url-injection.test.mjs refer to OLDER
//   different bugs (DIS-1b/DIS-3 history). Use the unique label URL-IMG-EMPTY (the contract's label).

// GOTCHA — kind "image" details get NO contentStart/contentLen from computeDetailOffsets (it processes
//   text/paged/url/binary only) and the renderer's expanded view skips image bodies — IDENTICAL to the local F5
//   empty-image detail. This is correct and intended (the note is the delivered content; the green read-line shows
//   'read <url>' with no dimensionHint). No offset/renderer work belongs in this task.

// GOTCHA — do NOT emit a notify from the guard (no "empty image" warning). Local F5 doesn't notify; the note block
//   itself is the signal. Adding a notify would break parity and the notify-type literal union ("info"|"warning"|"error").

// LIBRARY — TypeScript via jiti (transpile-on-load; no build step). `npm run typecheck` = tsc --strict (the .ts gate).
//   resizeImage is an external jiti-aliased import — NEVER stub it in tests (this task doesn't need to: the guard
//   fires before it, and DIS-4's non-empty path relies on its deterministic null-on-invalid for the raw-base64 fallback).
```

## Implementation Blueprint

### Edit 1 — the empty-body guard (file-injector.ts, injectUrl image branch, between :945 and :946)

```ts
// BEFORE (L944-947, verbatim):
    if (ct.startsWith("image/")) {
      const buf = await readBytesCapped(res, URL_MAX_BYTES); // raw Buffer — no UTF-8 decode
      if (buf === null) return false; // §3.3 guard 2b — overflowed mid-stream
      const mime = ct.split(";")[0].trim(); // strip params ("image/png; charset=…")
      const resized = await resizeImage(new Uint8Array(buf), mime); // async Worker; null on failure (mirror L968)

// AFTER — the F5-mirror guard inserted between the null check and mime/resizeImage:
    if (ct.startsWith("image/")) {
      const buf = await readBytesCapped(res, URL_MAX_BYTES); // raw Buffer — no UTF-8 decode
      if (buf === null) return false; // §3.3 guard 2b — overflowed mid-stream
      if (buf.length === 0) {
        // BUG-003 / F5 mirror (:1306-1323) — a 0-byte image body would attach an EMPTY ImageContent (data: "",
        // which providers reject). readBytesCapped returns an EMPTY Buffer (not null) for a zero-length body, so
        // the null check above never caught it. Emit the note instead: block + image detail + the note's cost,
        // count++ → delivered (true). Before mime/resizeImage (no Worker spawn for 0 bytes — resizeImage is
        // deterministically null on empty bytes) and before the guard-3 budget check (F5 parity: the note always
        // delivers; its ~15-20 token cost is negligible). No claim back-out (URLs have no claimKey).
        const f5Block = formatEmptyImageBlock(url);
        state.blocks.push(f5Block);
        state.details.push({ path: url, kind: "image", dimensionHint: undefined });
        subtract(state, Math.ceil(f5Block.length / 4)); // note consumes budget (mirror F5)
        state.count++;
        return true;
      }
      const mime = ct.split(";")[0].trim(); // strip params ("image/png; charset=…")
      const resized = await resizeImage(new Uint8Array(buf), mime); // async Worker; null on failure (mirror L968)
// …(:948-963 unchanged: cost / guard 3 / images.push / formatImageBlock / detail / subtract / count++ / return true)
```

### Edit 2 — URL-IMG-EMPTY (url-injection.test.mjs, right after DIS-4's closing `});` ~:363)

```js
// URL-IMG-EMPTY — BUG-003 (F5 parity): a 200 image/* response with a ZERO-LENGTH body must deliver the
// empty-image NOTE (block + image detail + count) with NO ImageContent attachment — mirroring the local F5
// guard for 0-byte #@image files. Before the fix this attached {type:"image", data:"", mimeType} (the
// provider-rejected shape) and charged estimateImageTokens(null)=2805 for 0 bytes. makeRes({body:""}) is the
// deterministic zero-length-chunk fixture (Buffer.from("") → the reader's single chunk is zero-length).
await runCase("URL-IMG-EMPTY", "image URL with empty body → F5 note block + image detail, NO attachment (BUG-003)", async () => {
  const calls = [];
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: "" }); };
    const r = await mod.injectFiles("#https://example.com/empty.png", [], FIX, false, true);
    assert(calls.length === 1 && calls[0] === "https://example.com/empty.png", `exactly one fetch of the normalized URL, got ${JSON.stringify(calls)}`);
    assert(r.images.length === 0, `NO ImageContent for a 0-byte image body (the provider-rejected shape), got images.length=${r.images.length}`);
    assert(hasBlock(r, '<file name="https://example.com/empty.png"><empty image file \u2014 0 bytes; nothing to attach></file>'),
      `the F5 note block must be delivered (em dash U+2014), got blocks=${JSON.stringify(r.blocks)}`);
    assert(r.injected === 1, `the note counts as a delivery (count++), got injected=${r.injected}`);
    assert(r.details.length === 1 && r.details[0].kind === "image", `one image detail, got ${JSON.stringify(r.details)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

### Edit 3 — README Mode-A note (README.md, `### URLs` → Images bullet :82)

```markdown
<!-- BEFORE (:82): -->
- **Images** (`#https://example.com/cat.png`) → attached as an image, same as `#@image`.
<!-- AFTER: -->
- **Images** (`#https://example.com/cat.png`) → attached as an image, same as `#@image`. An image URL whose body
  comes back empty (0 bytes) attaches nothing — it delivers the same "empty image file — 0 bytes" note a 0-byte
  local image does.
```

### Implementation Tasks (ordered by dependencies — TDD: RED first)

```yaml
Task 1 (RED): ADD URL-IMG-EMPTY to url-injection.test.mjs (right after DIS-4's closing `});`, ~:363)
  - IMPLEMENT per Edit 2 verbatim (origFetch captured BEFORE try; restore in finally; makeRes({ct:"image/png", body:""})).
  - RUN: node ./url-injection.test.mjs → URL-IMG-EMPTY ✗ on the images.length assert (today: images.length===1 with
    data==="" — the bug) or on the hasBlock assert (today: `<file name="URL"></file>` with no note). RED = the test
    correctly pins the missing guard. (All 38 existing cases still ✓.)
  - If URL-IMG-EMPTY PASSES before the guard, the test is wrong — re-check it exercises the image path
    (ct "image/*", body ""), not the text path.

Task 2 (GREEN): ADD the empty-body guard to injectUrl's image branch (file-injector.ts, between :945 and :946)
  - IMPLEMENT per Edit 1 verbatim (the 7-line guard; comment cites BUG-003/F5 mirror + the placement rationale).
  - DO NOT touch: readBytesCapped; formatEmptyImageBlock (:387-390); the local F5 template (:1306-1323); the
    non-empty image path (:946-963); any other injectUrl branch; scanTokens/injectMarkdown (sibling's);
    computeDetailOffsets/renderInjectedMessage; injectFiles' signature or URL loop.
  - RUN: node ./url-injection.test.mjs → "Result: 39 passed, 0 failed." (38 + URL-IMG-EMPTY ✓; DIS-4 ✓).

Task 3 (DOCS): APPEND the Mode-A sentence to the README ### URLs Images bullet (:82, per Edit 3)
  - EDIT ONLY that bullet. Do NOT touch the Line range. paragraph (the parallel sibling's) or anything else
    (the changeset sweep is P1.M4.T6.S1).

Task 4 (VERIFY): all gates
  - npm run typecheck → 0 errors (--strict). (The guard is straight-line code on existing exports — no type surface.)
  - node ./url-injection.test.mjs → 39 passed, 0 failed.
  - node ./file-injector.test.mjs → 183 passed, 0 failed (untouched by this fix; catches accidental spillover).
  - npm test → the 4-suite chain green (file-injector, url-injection, relative-imports, import-behavior).
  - git diff --stat → file-injector.ts + url-injection.test.mjs + README.md ONLY.
  - IF a NON-DIS-4 case in url-injection flips ✗ → your fetch stub leaked (re-check the finally restore) or you
    edited the non-empty image path (revert — :946-963 must be byte-identical).
  - IF file-injector flips ✗ → you edited something outside injectUrl (revert; check git diff).
```

### Implementation Patterns & Key Details

```ts
// The F5 mirror, side by side (URL guard ← local template :1306-1323):
//   local F5: formatEmptyImageBlock(abs) + detail {path, kind:"image", dimensionHint: undefined}
//             + subtract(ceil(block.length / 4)); count++ comes from injectFile's trailing bump.
//   URL guard: formatEmptyImageBlock(url) + detail {path: url, kind:"image", dimensionHint: undefined}
//             + subtract(ceil(f5Block.length / 4)); count++ INLINE (injectUrl owns its own bump).
// Cost note: the note's cost is ceil(f5Block.length / 4) — NEVER estimateImageTokens (2805 flat is for real
// images with unknown dimensions; 0 bytes deserves the note's actual ~15-20 token cost).

// The zero-length fixture chain (why body:"" is deterministic):
//   makeRes({body:""}) → Buffer.from("", "utf8") → a zero-length Buffer → the reader's single chunk is that
//   zero-length buffer → readBytesCapped concatenates nothing → returns an EMPTY Buffer (NOT null) → the guard fires.
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — ONE region):
  - injectUrl image branch (between :945 and :946): +the empty-body guard block (block push + image detail +
    ceil(f5Block.length/4) subtract + count++ + return true). NO images.push; NO resizeImage call; NO guard-3 check.
  - UNCHANGED: readBytesCapped (:861-878); formatEmptyImageBlock (:387-390, reused as-is); the local F5 template
    (:1306-1323); the non-empty image path (:946-963); injectUrl's other branches (text/html/json/xml/defuddle/binary);
    scanTokens; processTokenStream; injectMarkdown (the parallel sibling's region); computeDetailOffsets;
    renderInjectedMessage; injectFiles' signature/URL loop; every helper.
FILE_EDITS (url-injection.test.mjs):
  - +runCase("URL-IMG-EMPTY", …) after DIS-4 (~:363). Fetch stubbing per-case with try/finally restore (the suite's
    convention). UNCHANGED: makeRes; DIS-4; every other case; the harness/label conventions.
FILE_EDITS (README.md):
  - ### URLs → Images bullet (:82): +one Mode-A sentence (empty image URL → note, same as a 0-byte local image).
NO_CHANGES: file-injector.test.mjs (the parallel sibling's file — run it green, do NOT edit), relative-imports.test.mjs,
            import-behavior.test.mjs, scripts/typecheck.mjs, package.json, PRD.md, spec/ (P1.M4.T6.S2 owns the spec pass),
            all plan/ files.
NO_SURFACE_CHANGE: no new/removed exports (formatEmptyImageBlock is already exported and asserted in the main suite's
            sanity list). No signature changes. No new constants.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# The guard is straight-line code calling existing exports (formatEmptyImageBlock, subtract) on existing State
# fields (blocks/details/count) — no type surface. A TS error here means a typo in a field name or a stray edit
# elsewhere; READ the error location and check git diff.
```

### Level 2: The RED → GREEN TDD cycle + the suite gates

```bash
cd /home/dustin/projects/pi-file-injector
# Step A (RED, after Task 1 only): URL-IMG-EMPTY fails on the bug's fingerprint:
node ./url-injection.test.mjs 2>&1 | grep -E "URL-IMG-EMPTY|Result:"
#   Expected: "✗ case URL-IMG-EMPTY … NO ImageContent for a 0-byte image body … got images.length=1" (or the
#   hasBlock assert) + "Result: 38 passed, 1 failed."
# Step B (GREEN, after Task 2): the guard lands:
node ./url-injection.test.mjs
#   Expected: "✓ case URL-IMG-EMPTY: image URL with empty body → F5 note block + image detail, NO attachment (BUG-003)"
#   + "Result: 39 passed, 0 failed.", exit 0. DIS-4 still ✓ (the non-empty path untouched).
node ./file-injector.test.mjs
#   Expected: "Result: 183 passed, 0 failed.", exit 0 (spillover detector — this suite's F5/F3 image cases + the
#   module-surface guard must be untouched).
```

### Level 3: The full 4-suite chain (npm test)

```bash
cd /home/dustin/projects/pi-file-injector
npm test
# Expected: all four suites green — file-injector (183), url-injection (39 = 38 + URL-IMG-EMPTY),
#           relative-imports, import-behavior — exit 0.
# If a relative-imports/import-behavior case flips → a fetch stub leaked (re-check every finally) or an edit
# escaped injectUrl (git diff --stat must show exactly 3 files; git diff file-injector.ts must show ONE block).
```

### Level 4: Adversarial spot-checks (confidence — the suite is authoritative)

```bash
cd /home/dustin/projects/pi-file-injector
# (a) Confirm the empty-image URL under a TIGHT budget now delivers the note (F5 parity: no turn-away). LOW_BUDGET_CTX
#     (url-injection :712, getContextUsage tokens:0/contextWindow:16394) — the note's ~15-20 tokens still deliver:
node -e '
  const { execSync } = require("child_process");
  const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
  const { createJiti } = require(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  createJiti(__filename, { alias: { "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js" } })
  .import(require("path").resolve("./file-injector.ts")).then(async mod => {
    const of = globalThis.fetch; try {
      globalThis.fetch = async () => ({ ok: true, headers: { get: (k) => k === "content-type" ? "image/png" : null },
        body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) } });
      const r = await mod.injectFiles("#https://e.com/x.png", [], { cwd: process.cwd(),
        getContextUsage: () => ({ tokens: 0, contextWindow: 16394, percent: 0 }) }, false, true);
      console.log("tight-budget empty image → injected:", r.injected, "| images:", r.images.length,
        "| note delivered:", r.blocks.some(b => b.includes("empty image file")));
    } finally { globalThis.fetch = of; } });'
# Expected: injected: 1 | images: 0 | note delivered: true  (guard-3 never applies to the note — F5 parity).
# (b) Confirm the non-empty path is byte-identical: DIS-4 already proves it (images[0].data round-trips base64).
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors (`--strict`).
- [ ] `node ./url-injection.test.mjs` → **39 passed, 0 failed** (38 + URL-IMG-EMPTY).
- [ ] `node ./file-injector.test.mjs` → **183 passed, 0 failed** (untouched).
- [ ] `npm test` → the 4-suite chain green, exit 0.
- [ ] `git diff --stat` → file-injector.ts + url-injection.test.mjs + README.md ONLY.

### Feature Validation (the BUG-003 contract)

- [ ] Empty-body image URL: `r.images.length === 0` (NO attachment); the F5 note block delivered (em dash U+2014);
      `r.injected === 1` (count++); `r.details[0].kind === "image"` with `dimensionHint === undefined`.
- [ ] The guard runs BEFORE `resizeImage` (no Worker spawn for 0 bytes) and BEFORE guard-3 (the note always delivers).
- [ ] The note's cost is `ceil(f5Block.length / 4)` — not `estimateImageTokens`.
- [ ] DIS-4 green: a non-empty image URL attaches byte-identically to today (images[0].data round-trips).
- [ ] Tight-budget empty image delivers the note (F5 parity — no silent turn-away; Level 4a spot-check).
- [ ] README Images bullet carries the Mode-A sentence.

### Code Quality Validation

- [ ] The guard block matches the blueprint verbatim (7 lines + the rationale comment citing BUG-003/F5/:1306-1323).
- [ ] `formatEmptyImageBlock` reused, not re-implemented; no new export; no signature change.
- [ ] No edits outside injectUrl's image branch in the .ts (git diff shows ONE inserted block).
- [ ] Test label URL-IMG-EMPTY (unique; no BUG-001/002/003 collision); fetch restored in finally; makeRes body:"".
- [ ] No notify added (local F5 parity — the note block is the signal).

### Documentation

- [ ] README `### URLs` Images bullet: the Mode-A sentence appended (rides with this subtask, item §5).
- [ ] No other README section touched (Line range = sibling's; the sweep = P1.M4.T6.S1). No PRD/spec edits.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT compare `buf === null` again (or expect readBytesCapped to return null for empty bodies).** It returns
  an EMPTY Buffer for zero-length bodies — null ONLY on overflow. The guard tests `buf.length === 0`; that distinction
  IS the bug.
- ❌ **Do NOT place the guard after `resizeImage` or after guard-3.** After resizeImage wastes a Worker spawn on 0
  bytes (deterministic null anyway); after guard-3 turns the note away on a tight budget, breaking F5 parity (the
  local note always delivers) and preserving today's inconsistent silent-false/empty-attach split.
- ❌ **Do NOT push to `state.images` or call `estimateImageTokens` in the guard.** No attachment is the point (empty
  `ImageContent` is the provider-rejected shape), and the 2805 flat estimate is the wrong cost for 0 bytes — the
  note's own `ceil(len/4)` mirrors F5.
- ❌ **Do NOT modify `formatEmptyImageBlock`, `readBytesCapped`, or the local F5 template (:1306-1323).** They are
  correct and shared; the fix only ADDS a URL-path consumer. Editing them breaks the main suite's F5/F3 cases.
- ❌ **Do NOT touch the non-empty image path (:946-963).** DIS-4 pins it byte-exact (base64 round-trip). Your diff in
  file-injector.ts must be ONE inserted block between :945 and :946.
- ❌ **Do NOT edit file-injector.test.mjs.** It is the parallel sibling's file (BUG-002's MD-LR3). Run it green as a
  spillover detector; add URL-IMG-EMPTY to url-injection.test.mjs ONLY.
- ❌ **Do NOT stub `resizeImage` in the test.** It's an external jiti-aliased import (the suite's convention is to
  rely on its deterministic null-on-invalid); the guard fires BEFORE it anyway, so the stub would prove nothing.
- ❌ **Do NOT leak the fetch stub.** Capture `origFetch` before try; restore in `finally` — a leaked stub poisons
  every later case in the chain (the suite's own convention; see the L495 note in the arch doc).
- ❌ **Do NOT label the test BUG-003.** Existing BUG-00x labels in url-injection.test.mjs refer to OLDER different
  bugs (DIS-1b/DIS-3). Use the unique label **URL-IMG-EMPTY** (the contract's label).
- ❌ **Do NOT add a notify/warning for the empty image.** Local F5 doesn't notify; the note block IS the signal.
  A notify would also drag in the hasUI guard and the notify-type literal union for zero benefit.
- ❌ **Do NOT skip the em dash.** The note text contains U+2014 (`\u2014`) between "file" and "0 bytes" — assert the
  full literal; substituting '-' fails the hasBlock assertion against the real formatter output.

---

## Confidence Score: 10/10

A one-block surgical bugfix with an unusually complete contract: the architecture doc gives the exact guard code,
the exact placement (after :945 / before :946-947) with a three-point rationale (buf exists; no Worker spawn; F5
parity before guard-3), and the verified root-cause chain (empty-Buffer-not-null → resizeImage null-on-empty →
`data:""` → estimateImageTokens(null)=2805); the code sites were re-verified against the working tree line-by-line
(:944-963, :387-390, :1306-1323, the injectFiles 5th arg); the test harness conventions (DIS-4 template, makeRes
`body:""` zero-length fixture, try/finally fetch restore, label-collision warning) were read directly from
url-injection.test.mjs; the parallel sibling's PRP was read and the regions confirmed fully disjoint (its
injectMarkdown/file-injector.test.mjs/README-Line-range vs my injectUrl/url-injection/README-URLs-Images); the
downstream consumers (computeDetailOffsets skips kind "image"; the renderer skips image bodies) were checked for
non-interaction; and both suite baselines (183/0, 38/0) plus the 4-suite npm-test chain are verified green today.
The only judgment calls (no notify; no claim back-out; note-always-delivers) are each explicitly dictated by F5
parity and the arch doc. The implementing agent inserts one guard, adds one test, appends one sentence, and runs
three commands.