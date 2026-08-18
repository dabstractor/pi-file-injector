# Research Notes — P1.M1.T1.S2 (bugfix 001_a6ffb98ab096): computeDetailOffsets — kind-gated binary note branch

> First-hand read of: the S1 PRP (contract — LANDED, verified: 181 green; the deny-guard at :477),
> `architecture/renderer_bug001.md` (§Fix design evaluation — candidate (a) binary analysis + 7 edge cases),
> and the current `file-injector.ts`: computeDetailOffsets :462-513, formatBinaryBlock :380-382, the binary
> detail push :1369-1381, the renderer tier-1 slice :1072 + lang-undefined path :1075, REND-PAGED-URL :2809.

---

## 1. Starting state = POST-S1 (S1 LANDED; baseline 181 green)

S1 (LANDED) changed the :475 skip-guard from the allow-list to the DENY-list:
```ts
if (d.kind === "image" || d.kind === "binary") continue; // no displayable body (F5 is kind "image").
```
so **url is now processed** through the existing 0x0A body-bearing test (formatUrlBlock ≡ the text envelope —
zero math changes). S1 added REND-PAGED-URL (:2809; 180 → 181) and its JSDoc already forward-references S2:
"binary lands via the note branch (P1.M1.T1.S2)". **Binary is STILL skipped — that is my task.**

Suites: file-injector 181 (+1 = 182 after S2), relative-imports 38, import-behavior 23, url-injection 38
(4 suites — the plan's "npm test (4 files)").

---

## 2. The binary block shape (why it needs its own branch)

`formatBinaryBlock` (:380-382) emits:
```
<file name="ABS"><binary file — contents not injected; use the read tool if needed></file>
```
— **NO `\n` after the opener**, so it FAILS the 0x0A body-bearing test (:489) that pairs text/paged/url.
The displayable body is the **whole note inner text** (incl. its angle brackets). The branch math:
- `headerLen = openEnd` (no `\n` to include — vs `openEnd + 1` in the text branch)
- `closerLen = "</file>".length` = 7 (no leading `\n` — vs `"\n</file>".length` = 8)
- `bodyLen = blk.length - headerLen - closerLen`; `contentStart = starts[bi] + headerLen`.

`blk.indexOf(">") + 1` finds the opener's closing `>` (a path containing `>` would mis-find — the SAME
pre-existing assumption as the text branch's openEnd; real emissions are fine; failure mode is defensive
no-offsets → tier-3). The em dash U+2014 is 1 UTF-16 code unit — `.length`/offsets are consistent.

---

## 3. ⚠️ THE KIND-GATE IS LOAD-BEARING (the paged-directive-skip invariant)

The 0x0A test **double-serves** as the "skip paged directive blocks" discriminator: a directive block
(`<file name="ABS"><paged: …></file>`) has NO leading `\n` → the 0x0A test fails → a paged detail's scan
skips it. A **naive generalization** ("if not 0x0A, use the no-newline math") would let a **paged** detail pair
its OWN directive block. The guard: apply the no-newline branch ONLY when `d.kind === "binary"`. Consequences:
- text/paged/url pairing is **byte-for-byte unchanged** (their scan still skips non-0x0A blocks via `bi++`).
- The paged-directive skip is preserved for text/paged details — pinned as a regression assertion in the test.
- arch doc: "Guard: only apply the no-newline branch when `d.kind === \"binary\"` … keeping text/paged
  pairing unchanged." S1's anti-pattern: "Adding a binary hack here would break the paged-directive skip invariant."

---

## 4. The 2 edits (POST-S1 oldText → newText)

**Edit 1 — the deny-guard (:477): drop "binary" (image stays skipped):**
```ts
// oldText: if (d.kind === "image" || d.kind === "binary") continue; // no displayable body (F5 is kind "image").
// newText: if (d.kind === "image") continue; // no displayable body (F5 is kind "image"); image never renders a body.
```
(Image blocks never render a body — the renderer's `d.kind !== "image"` guard :1074 — and the arch doc's
"Other kinds" section says do NOT add image/F5/URL-image: only the F5 inner notes would "pair".)

**Edit 2 — the kind-gated no-newline branch (inside `if (hdr === p)`, after the 0x0A block):**
```ts
        } else if (d.kind === "binary") {
          // BINARY NOTE BRANCH (BUG-001, P1.M1.T1.S2) — formatBinaryBlock emits `<file name="ABS"><binary …></file>`
          // with NO '\n' after the opener, so the 0x0A body-bearing test fails. The displayable body is the whole
          // note inner text. The KIND-GATE is load-bearing: without it a paged detail could pair its OWN directive
          // block (also no 0x0A) — text/paged pairing must stay byte-for-byte unchanged.
          const headerLen = openEnd;             // no '\n' to include
          const closerLen = "</file>".length;    // 7 — no leading '\n' (formatBinaryBlock appends bare '</file>')
          const bodyLen = blk.length - headerLen - closerLen;
          if (bodyLen >= 0) { // defensive: malformed block → leave detail untouched
            d.contentStart = starts[bi] + headerLen;
            d.contentLen = bodyLen;
          }
          cursorByPath.set(p, bi + 1); // consumed
          break;
        }
```
(The surrounding loop/cursor semantics — including the post-loop redundant-but-harmless
`cursorByPath.set(p, bi + 1)` after break (arch edge #5) — are UNCHANGED.)

**Edits 3-4 — Mode A (the comments S1 wrote forward-referencing S2):**
- computeDetailOffsets JSDoc (:470-471): "Image/binary details have no displayable body and are skipped here …
  binary lands via the note branch (P1.M1.T1.S2)." → now describe the LANDED kind-gated note branch (binary
  pairs via `headerLen = openEnd`, `closerLen = 7`; kind-gated so the paged-directive skip is untouched; only
  image is skipped — it never renders a body).
- FileDetail.contentStart/contentLen comments (:~564-569): "(text/paged/url; image/binary omit — binary via the
  note branch, P1.M1.T1.S2)" → "(text/paged/url/binary; image omits)" + the binary note-branch note.

---

## 5. The REND-PAGED-BIN test (TDD, RED first; modeled verbatim on S1's REND-PAGED-URL :2809)

Crafted blocks `[pagedHead, pagedDirective, binaryBlock]` + details `[paged, binary]` → computeDetailOffsets →
assert (a) `slice(details[1])` === the note text (never `<paged:`); (b) the paged slice === head, NOT the
directive (the kind-gate invariant); (c) renderer E2E: the child after the binary read line carries the note
(the lang-undefined path :1075 renders it un-highlighted), never the directive.

- **RED on POST-S1**: binary still skipped → `details[1].contentStart` is `undefined` →
  `content.slice(undefined, NaN)` → `""` → the `=== binaryNote` assertion fails. ✓ By construction.
- **GREEN after**: the branch computes offsets → the slice is exactly the note inner text.
- Placement: after REND-PAGED-URL's `});` (before the REND-MULTI-E2E comment block). Reuses REND_THEME/textOf
  (module-scope, already used by S1's landed test). 181 → 182.
- Uses `\u2014` in the expected note text (matches formatBinaryBlock's em dash exactly).

## 6. Behavior trace (all kinds, POST-S2)

| kind | guard | pairing | offsets | renderer body |
|---|---|---|---|---|
| text | processed | 0x0A branch (unchanged) | ✓ (unchanged math) | tier-1 slice |
| paged | processed | 0x0A branch on the HEAD; directive skipped (0x0A fails; kind ≠ binary) | ✓ (unchanged) | tier-1 head slice |
| url | processed | 0x0A branch (S1; envelope ≡ text) | ✓ | tier-1 markdown |
| **binary** | **processed (NEW)** | **the no-newline branch (kind-gated)** | **✓ note inner** | **tier-1 note, un-highlighted** |
| image | skipped (only kind) | — | none | none (renderer :1074 guard) |

## 7. Gate

- `npm run typecheck` → 0 errors.
- `node ./file-injector.test.mjs` → **182 passed** (181 + REND-PAGED-BIN), all REND-* incl. REND-MULTI-OFFSET /
  REND-PAGED-URL / REND-MULTI-E2E green (text/paged/url pairing unchanged).
- The other 3 suites unchanged (relative-imports 38 / import-behavior 23 / url-injection 38) — run via `npm test`.

## 8. Scope discipline (what S2 does NOT do)

- No tier-3 changes (that's S3: the path-aware bodies fallback). S2 leaves `bodies[i]` as-is — binary now has
  tier-1 offsets, so tier-3 is only the old/foreign-message fallback (per the arch verdict: "leave tier-3
  as-is").
- No renderer changes (renderInjectedMessage consumes offsets implicitly via tier-1; pinned by the test's E2E part).
- No image/F5/URL-image offsets (they never render a body).
- No JSDoc rewrites beyond the 2 binary-note comments S1 forward-referenced.

## 9. Confidence: 10/10

Two small edits (drop "binary" from the deny-guard + an `else if (d.kind === "binary")` branch with 4 lines of
math) + 2 comment touches + 1 TDD test modeled verbatim on S1's landed REND-PAGED-URL. The kind-gate risk is
explicitly handled (the branch is gated; the paged-directive skip is pinned by a regression assertion); the
math is verified against formatBinaryBlock's exact emission (no-\n opener, bare `</file>` closer, em dash = 1
UTF-16 unit); RED is by construction (binary lacks offsets today). -0: deterministic RED→GREEN, sibling gates
green by construction (text/paged/url paths untouched).