# Research Notes — P1.M2.T3.S2 (plan/009)

**Item:** Add markdown verbatim regression test (import markers preserved in delivered content).
**Scope:** TEST-ONLY — add 1–2 `runCase` blocks to `file-injector.test.mjs`. No `.ts` change, no aux-suite change,
no harness change, no buildFixtures change. The engine under test is the LANDED plan-009 verbatim engine.

---

## 1. The contract being pinned (PRD §5.6 + §6.4)

The full chain this regression models (item §3):
> top-level `#@notes.md` → notes.md contains `#@api.md` → api.md is injected → notes.md's `<file>` block
> contains the LITERAL `#@api.md` marker (preserved verbatim — NOT stripped to `api.md`).

**Why this is a regression risk:** before plan 009, `injectMarkdown` Step 3.5 + Step 4 STRIPPED resolved import
markers from the delivered content (so `#@api.md` → `api.md` in the block). Plan 009 (P1.M1.T1.S2) DELETED the
stripping: `injectMarkdown` now emits the content **verbatim** (file-injector.ts:1095 `emitText(abs, content, …)`
on the file-as-read content; §6.4 "markers are detected only to resolve imports — never stripped from content").
A future "cleanup" that re-introduces stripping would silently corrupt delivered markdown. This test makes that
regression loud.

## 2. The LANDED verbatim engine (verified — read-only, the contract)

From `file-injector.ts`:
- **L1111** `export async function injectFiles(text, imagesIn, ctx, bareAt = false, …)`. 4th param `bareAt`
  is the §4.6 seam (markdown-only bare-`@` imports). Default `false` for direct unit tests.
- **L1164** `state.bareAt = bareAt` (threaded into State).
- **L1178** count===0 path: `return { text, … }` — `text` is the ORIGINAL prompt ref (verbatim).
- **L1188** count>0 path: `return { text, images:state.images, injected, paged, blocks, details }` — SAME
  `text` ref. Comment L1180–1186: "the user message is the ORIGINAL `text`, byte-for-byte VERBATIM."
- **L1085** `injectMarkdown(abs, content, state, ctx)`: Step 2 claim self; Step 3 `scanTokens(content, dir,
  { … bareAt: state.bareAt }, state)` → `absPaths` (resolved import paths, encounter order; markers NEVER
  stripped — scan only resolves); Step 4 `emitText(abs, content, state)` emits the VERBATIM content (the file
  exactly as read from disk); Step 5 recurse depth-first.
- **L1177** the TOP-LEVEL `processTokenStream` scan hardcodes `bareAt: false` (top-level is `#@`-only; §4.6
  markdown-only invariant). So the 4th `bareAt` param affects ONLY markdown import scanning, never top-level.

**Bottom line:** `r.text === prompt` ALWAYS (top-level `#@` verbatim); each markdown's `<file>` block carries
its content VERBATIM (import markers survive); imports still resolve+inject (they're in `blocks`, pre-order
depth-first: parent then its imports).

## 3. The `bareAt` seam end-to-end (the MDV-2 case)

For the bare-`@` chain (markdownBareAtImports ON), pass `true` as the 4th param:
`mod.injectFiles("Review #@mdBare.md", [], FIX, true)`.
- Top-level: `#@mdBare.md` matched by `FILE_INJECT_RE` (always) → injects mdBare.md.
- mdBare.md scanned by `injectMarkdown` with `state.bareAt=true` → `BARE_AT_RE` runs → bare `@apiBare.md`
  (prefixLen 1) resolves → injects apiBare.md.
- mdBare.md's block content is emitted VERBATIM → `@apiBare.md` survives in the block (§6.4 — no stripping).
- `r.text === "Review #@mdBare.md"` (the bare `@` is INSIDE mdBare.md's content, delivered verbatim; the
  top-level `#@mdBare.md` marker is the prompt, returned verbatim).

## 4. The test harness (verified — reuse, do NOT add helpers)

From `file-injector.test.mjs`:
- **L200** `function hasBlock(r, needle) { return r.blocks.some((b) => b.includes(needle)); }` — THE helper
  for "does any block contain this substring." Exactly what the task's asserts need.
- **L81** `assert(cond, msg)`; **L90** `runCase(n, name, fn)`.
- **L356-ish** `FIX = { cwd: TMPDIR }`; **L212** `TMPDIR = fsSync.mkdtempSync(...)`; `fsSync`/`path`/`os`
  are module-loaded (top of file).
- Self-contained-fixture pattern (THE model for this task): **CRLF-E2E at L1655** creates its OWN fixtures
  inside the test (`fsSync.writeFileSync(path.join(TMPDIR, "crlf_spec.md"), …)`), runs `injectFiles`, and
  asserts `hasBlock(r, "See #@crlf_after.md")` + `!hasBlock(r, "See crlf_after.md")`. MDV cases mirror this.

## 5. Fixture strategy — SELF-CONTAINED, non-colliding (do NOT touch buildFixtures)

The shared `notes.md` fixture (buildFixtures L252) = `"# Notes\n\nImports #@api.md here.\n\n```\n#@example.ts\n```\n"`.
Case 15 (L1634) already asserts `hasBlock(r, "Imports #@api.md here.")` + `!hasBlock(r, "Imports api.md here.")`.
**I must NOT reuse notes.md** — (a) its content differs from the task's literal text ('See #@api.md for details');
(b) asserting on it would DUPLICATE Case 15; (c) buildFixtures is shared and changes ripple.

**Decision:** create DEDICATED fixtures INSIDE each test case (like CRLF-E2E), with unique non-colliding names:
- MDV-1 (`#@` chain): `mdVerbatim.md` = `"See #@apiVerbatim.md for details.\n"`; `apiVerbatim.md` =
  `"# API Verbatim\n\nImport-chain target content.\n"`.
- MDV-2 (bare-`@` chain): `mdBare.md` = `"See @apiBare.md for details.\n"`; `apiBare.md` =
  `"# API Bare\n\nBare-at import target.\n"`.

Names verified non-colliding (grep): `mdVerbatim`, `apiVerbatim`, `mdBare`, `apiBare` appear NOWHERE in the file.
(NOT `notesBare.md`/`api.md` — those are buildFixtures fixtures Case 25/26 depend on.)

## 6. Case-ID prefix — MDV- (no collision)

Verified in-file: existing prefixes are `DELIV-`, `F1`/`F1b`/`F1d`, `T1.S1-`, `REOPEN-` (P1.M2.T3.S1),
`M2.T2.S1-`, `MD1`/`MD2`, `CRLF-E2E`, `REND-OFFSET`, `EDG-`. Use **`MDV-1`/`MDV-2`** (Markdown Verbatim).
Distinct from `MD1`/`MD2` (§10 markdown edges) and all others.

## 7. Baseline — RED at 148/6 (the 6 are NOT mine)

`node ./file-injector.test.mjs` → **148 passed, 6 failed.** (P1.M2.T3.S1's REOPEN-1..4 already exist in the
working tree — they raised 144→148.) The 6 failures are ALL P1.M2.T1's main-suite-migration scope:
- `F1`/`F1b`/`F1d` (~L800-820) — depend on the OLD dedup-after-strip model.
- `T1.S1-9`/`T1.S1-10`/`T1.S1-12` (L2055-2103) — read the DEAD `.prefixLen`/`.abs` fields (scanTokens now
  returns `string[]`).

**My 2 MDV cases pass cleanly regardless.** GATE = "MDV-1/2 ✓ AND 0 NEW failures" — NOT "0 failed." After my
work: **150 passed, 6 failed.** Do NOT touch the 6 (scope creep into P1.M2.T1).

## 8. Insertion point

REOPEN-4 ends ~L2857; the Summary block (`// 10. Summary + cleanup + exit.`) is at L2860. **Place the MDV
banner + 2 cases between them** (after REOPEN-4, before the Summary). This is the natural tail-end regression
block, after the re-submission (REOPEN) cases.

## 9. Complementarity (NOT duplication)

- Case 15 (L1634): focus = pre-order two-block structure + marker-preserved assertion on the SHARED notes.md.
  Title still says "marker stripped" (stale); the migrated assertion (L1644) is one line. MDV-1 DELIBERATELY
  models the full chain with dedicated fixtures and a crisp verbatim-vs-stripped pair.
- Case 26 (L2384): bare-@ ON, asserts `hasBlock(r, "Refs @api.md here.")` on the SHARED notesBare.md. MDV-2
  covers the SAME bare-@ verbatim contract with a DEDICATED chain fixture — and pins `r.text` (top-level
  `#@` verbatim) + `r.blocks.length===2` + `!hasBlock(r, "See apiBare.md for details.")` explicitly.
- CRLF-E2E (L1655): the closest sibling (self-contained fixtures + verbatim assertion) — but it's a CRLF/fence
  regression, not the canonical verbatim-import-marker chain. MDV generalizes its assertion style.
- REOPEN-1..4 (P1.M2.T3.S1): pin the VERBATIM PROMPT (re-submission robustness). MDV pins the VERBATIM
  DELIVERED CONTENT (import markers survive inside the `<file>` block). Different invariant, complementary.