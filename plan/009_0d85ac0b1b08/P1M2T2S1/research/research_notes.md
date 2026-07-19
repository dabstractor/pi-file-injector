# Research Notes — P1.M2.T2.S1 (plan/009)

**Item:** Update marker-presence expectations in `relative-imports.test.mjs` and `import-behavior.test.mjs`
for verbatim delivery (plan 009: stop stripping `#@` markers; preserve the prompt verbatim).
**Plan:** plan/009_0d85ac0b1b08.

## The behavioral change (plan 009, P1.M1 — LANDED)

The extension NO LONGER STRIPS `#@`/`@` markers. Delivered text is VERBATIM everywhere:
- `injectFiles` returns `text` = the ORIGINAL prompt verbatim (P1.M1.T1.S3).
- Markdown block content keeps `#@api.md` etc. (P1.M1.T1.S2 — injectMarkdown emits verbatim content).
- `scanTokens` now returns `Promise<string[]>` (resolved abs paths ONLY) — P1.M1.T1.S1 REMOVED the
  `{index, prefixLen, abs}` record shape. **`prefixLen` is DEAD** (it existed only for stripping).

## Live suite state (verified by running both)

- **import-behavior.test.mjs: 23 passed, 0 failed.** ALREADY GREEN. The 2 marker assertions
  (4f `has(o,"@weird.md.bak")`, 4h `has(o,"@api.md.old")`) assert VERBATIM for missing tokens —
  always correct. 2c/5f `!has(out,"B-MARKER")` test NON-INJECTION (file not injected), not stripping —
  unchanged. **No assertion changes needed** — only 1 stale COMMENT (L38 `text(stripped)` → `text(verbatim)`).
- **relative-imports.test.mjs: 35 passed, 3 failed.** The 3 failures are B1, B4, B6 — ALL `scanTokens`
  return-shape (the `{index,prefixLen,abs}` record → `string[]`), NOT marker-stripping.
  - The 1 explicit marker assertion (C9 L344 `has(blocksText(out),"#@ghost.md")`) PASSES — missing-import
    markers were ALWAYS verbatim.

## The 3 relative-imports failures (root cause + fix)

`scanTokens` now returns `string[]` (the abs paths). The Group B tests read the OLD record shape:

- **B1** (L196-197): `recs[0].abs === path.join(root,"dir","b.md")` → `recs[0]` IS the abs now → undefined.
  FIX: `recs[0] === path.join(...)`; `recs.map((r) => r.abs)` → `recs` (the array IS the abs paths).
- **B4** (L220-221): identical to B1 (bare-@ variant).
- **B6** (L232-240): asserts `a.prefixLen === 2` / `b.prefixLen === 1` — **prefixLen no longer exists**.
  The test ALSO proves both #@ and bare-@ resolve in one scan (the union). FIX: REPURPOSE — drop the
  prefixLen asserts; assert both resolve baseDir-relative in one scan. Rename to reflect the new meaning.
  (`recs.find((r) => r.abs.endsWith("a.md"))` → `recs.find((r) => r.endsWith("a.md"))`.)

## Marker assertions — all ALREADY CORRECT (verify, don't change)

- relative-imports **C9** (L344): `has(blocksText(out), "#@ghost.md")` — missing relative import verbatim.
  PASSES (missing imports were always verbatim). VERIFY.
- import-behavior **4f** (L194): `has(o, "@weird.md.bak")` — extended token `.bak` exact-only, missing → verbatim. PASSES.
- import-behavior **4h** (L205): `has(o, "@api.md.old")` — same pattern. PASSES.
- import-behavior **2c/5f**: `!has(out, "B-MARKER")` / `!has(out, "C-MARKER")` — bare-@ inert when OFF →
  file NOT injected → content marker absent. Tests NON-INJECTION, not stripping. UNCHANGED. PASSES.
- Content-marker assertions (B-FILE-RELATIVE, A-MARKER, etc. in C1-C8/C10-C12/D1-D7/E1-E3): prove the
  CORRECT FILE was injected — unaffected by verbatim delivery (the file is still injected, marker preserved
  in the parent's block). ALL PASS (35/38 pass; the 3 fails are the scanTokens-shape B-cases).

## Stale comments to update (LOGIC d — "stripped" → "verbatim")

- import-behavior **L38**: `// { text(stripped), images, injected, paged, blocks, details }` → `text(verbatim)`.
  (The `run` helper's return-shape comment. No assertion reads `out.text` — pure comment.)
- import-behavior L143-147 (Group 4 header): about cleanToken/fmtCut TOKEN CLEANUP (trailing-punct/glue trim),
  NOT marker stripping — "left verbatim (4f/4h)" already correct. NO change needed (not stale w.r.t. plan 009).
- relative-imports **B-group header** (L182-184): "Proves the records carry abs paths" → "Proves the resolved
  abs paths" (records are now strings). Minor accuracy. And L11 ("left verbatim — markdown is relative-only")
  is already correct.

## Scope boundary (what's NOT mine)

- **file-injector.test.mjs** is P1.M2.T1's scope (S1/S2/S3). It has the SAME scanTokens-shape failures
  (T1.S1-9/10/12 use `.prefixLen`/`.abs`) — currently FAILING (e.g. T1.S1-12). P1.M2.T1.S3 (parallel) owns
  those. My task touches ONLY the two aux suites. The `npm test` chaining (all three) is green once BOTH
  P1.M2.T1 and my task land (P1.M3.T1 wires the chain).
- I do NOT touch file-injector.ts (the engine is LANDED — verbatim). I do NOT touch PRD/README.

## No conflict with the parallel task (P1.M2.T1.S3)

P1.M2.T1.S3 migrates file-injector.test.mjs. My task migrates relative-imports.test.mjs + import-behavior.test.mjs.
Different files. The scanTokens-shape migration pattern is shared conceptually (both fix `.abs`→direct, drop
`prefixLen`) but applied to disjoint files. No merge collision.

## The fixes (exact)

### relative-imports.test.mjs
- B1 (L196-197): `recs[0].abs === X` → `recs[0] === X`; `recs.map((r)=>r.abs)` → `recs`.
- B4 (L220-221): same.
- B6 (L232-240): REPURPOSE — drop prefixLen; assert both resolve baseDir-relative in one scan (the union).
  `recs.find((r)=>r.abs.endsWith(...))` → `recs.find((r)=>r.endsWith(...))`. Rename.
- B-group header (L182-184): "records carry abs paths" → "resolved abs paths".

### import-behavior.test.mjs
- L38 comment: `text(stripped)` → `text(verbatim)`.
- (No assertion changes — already green.)

## Gates
- `node ./relative-imports.test.mjs` → 38 passed, 0 failed (was 35/3).
- `node ./import-behavior.test.mjs` → 23 passed, 0 failed (already green; comment-only).
- `npm test` (all three chained) → green once P1.M2.T1 (file-injector.test.mjs) also lands (parallel; not my file).
- `git diff --stat`: relative-imports.test.mjs + import-behavior.test.mjs only (no .ts, no PRD/README).