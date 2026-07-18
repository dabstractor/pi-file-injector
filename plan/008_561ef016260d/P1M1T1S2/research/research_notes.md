# Research Notes — P1.M1.T1.S2 (plan/008): image/binary detail pushes + injectFiles return-shape change (strip the `---`)

> First-hand read of: the S1 PRP (FULLY LANDED — FileDetail L335, State.details L347, emitText lineCount L771,
> constructor `details: []` ~L951), `architecture/test_migration.md` (the migration strategy + expected breakage),
> and the current `file-injector.ts` (injectFile branches L705-752, injectFiles signature L930-935, early return
> L1000, final concat+return L1012-1013, factory destructure L1062). Baseline (POST-S1): **188 green** (128+38+22).

---

## 1. Starting state = POST-S1 (S1 is landed; S2 is source-only)

S1 (parallel, LANDED) added the additive foundation: `export interface FileDetail` (L335), `State.details:
FileDetail[]` (L347), `emitText` text/paged detail pushes (L771+), and `details: []` in the State constructor.
S1 is purely additive → 188 tests still green.

**S2 (THIS task) is SOURCE-ONLY** (`file-injector.ts`). It completes the per-file metadata collection (image /
empty-image / binary details, which S1 deferred) AND changes the `injectFiles` return shape to surface
`blocks` + `details` and STRIP the `\n\n---\n\n` concatenation from the output text. **S2 is NOT additive —
it changes runtime behavior** (the user message no longer appends blocks), so it INTENTIONALLY breaks the
existing test suite. The test migration is a separate, later subtask (P1.M2.T1.S1).

---

## 2. THE CRITICAL FRAMING: S2 intentionally breaks the test suite (migration is M2.T1)

`test_migration.md` confirms: ~170 assertions in `file-injector.test.mjs` + helpers in the other two suites
read the OLD return shape — `r.text` containing `\n\n---\n\n` + `<file>` blocks. After S2:
- `r.text` = the STRIPPED prompt ONLY (no blocks, no `---`).
- blocks move to `r.blocks` (array); per-file metadata moves to `r.details`.

∴ **all three suites go RED** (~230 assertions fail with "r.text no longer contains `<file>`/`---`"). This is
the **intended intermediate state** of the sequenced migration (S1 → S2 → T2 → M2). Re-greening is M2.T1's job
("Migrate file-injector.test.mjs (~170 assertions) to r.blocks/r.details"). **S2 edits NO test files.**

**S2's deterministic gate is `npm run typecheck` → 0 errors** (the return-type change must compile) **+ a
structural grep** confirming the 6 edits landed (concat deleted; new return fields; 3 detail pushes). The red
suite is an EXPECTED observation, NOT a regression — the implementing agent must NOT "fix" it by reverting
source or editing tests.

---

## 3. The 6 edits (POST-S1 exact oldText → newText)

### injectFile — 3 detail pushes (S1 deferred image/binary; S2 completes them)

**(a) EMPTY-IMAGE branch** — after `state.blocks.push(f5Block);`:
```ts
      state.details.push({ path: abs, kind: "image", dimensionHint: undefined }); // §6.4 — empty-image detail
```
(item §3c: "push { path: abs, kind: 'image', dimensionHint: undefined } to keep details parallel with blocks".)

**(b) IMAGE branch** — after `state.blocks.push(formatImageBlock(abs, resized));`:
```ts
      state.details.push({ path: abs, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined }); // §6.4 — image detail
```
(`formatDimensionNote` is already imported L3; returns `string | undefined`; the `?? undefined` normalizes null.
`resized` null → dimensionHint undefined. Matches PRD §9 verbatim.)

**(c) BINARY branch** — after `state.blocks.push(binBlock);`:
```ts
      state.details.push({ path: abs, kind: "binary" }); // §6.4 — binary detail
```

### injectFiles — return-shape change (3 sub-edits)

**(d) Return type annotation** (L935):
```ts
// BEFORE: ): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }> {
// AFTER:  ): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }> {
```

**(e) Early return** (L1000, count===0) — add `blocks: [], details: []` for shape consistency (keep `images: imagesIn` ORIGINAL ref):
```ts
// BEFORE: if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };
// AFTER:  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };
```

**(f) Final concat + return** (L1012-1013) — DELETE the `finalText` concat; return `strippedText` + blocks + details:
```ts
// BEFORE:
//   const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`;
//   return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
// AFTER:
//   // §6.4 — user message is the stripped prompt ONLY (no appended blocks, no `\n\n---\n\n`); blocks+details
//   // are returned for P1.M1.T2.S1 to stash → the before_agent_start custom message (PRD §6.2).
//   return { text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
```

The string `\n\n---\n\n` appears ONLY at L1012 in the output path (L315/L955 are comments) — deleting L1012
removes it entirely. `strippedText` is computed above (the high→low index splice loop) and is UNCHANGED.

---

## 4. The intermediate state (factory handler, L1062 — NOT edited by S2)

The factory's `input` handler (L1062) destructures `const { text, images, injected, paged } = await injectFiles(...)`
and returns `{ action: "transform", text, images }` (L1071). After S2:
- `text` is the STRIPPED prompt (no blocks) → the handler now delivers a clean prompt.
- `blocks`/`details` are RETURNED by injectFiles but IGNORED by the handler (the destructure skips them).
- ∴ between S2 and T2.S1, files are collected but NOT yet delivered to the model (no `before_agent_start`
  stash yet). **This is the expected seam** — T2.S1 wires `pending = { blocks, details }` + the
  `before_agent_start` custom message. S2's gate is source correctness, NOT end-to-end delivery.

Adding fields to the return does NOT break the destructure (extra fields are ignored) → the factory still
compiles and runs under `--strict`. ∴ typecheck stays clean. ✓

---

## 5. Why the detail pushes land in injectFile (not emitText)

S1 put text/paged details in `emitText` (it decides whole-vs-paged + has content/line info). Image + binary
don't flow through `emitText` (they're separate branches in `injectFile`), so their details MUST be pushed in
`injectFile`. The empty-image branch (F5) also bypasses `emitText`. ∴ S2's 3 pushes are in `injectFile`,
keeping `state.details` parallel to `state.blocks` (one detail per block emission, index-aligned — the
renderer pairs them by index per PRD §6.4).

---

## 6. Scope discipline (what S2 does NOT do)

- Does NOT edit any test file (the migration is M2.T1 — ~230 assertions move from `r.text` to `r.blocks`/`r.details`).
- Does NOT touch the factory handler (T2.S1 wires the stash + before_agent_start).
- Does NOT add the renderer / `registerMessageRenderer` (T2.S2).
- Does NOT change emitText (S1 owns text/paged details; S2 adds only image/binary/empty-image).
- Does NOT change blocks pushes, subtract math, `state.paged++`, or the strip loop.
- Does NOT change the early return's `images: imagesIn` (ORIGINAL-ref identity — preserved; only blocks/details added).

---

## 7. Confidence: 9/10

Six precise, well-bounded source edits (3 detail pushes + return-type + early-return + final-return), each
with exact oldText→newText verified against the POST-S1 working tree. `formatDimensionNote` is imported;
`FileDetail` is exported (S1). The deterministic gate is typecheck-clean + structural grep. The -1 reserves
for the UNUSUAL gate (an intentionally-red suite) — the implementing agent must understand the red suite is
EXPECTED and NOT edit tests or revert source. The PRP flags this loudly. The intermediate non-delivery state
(blocks collected, not yet delivered until T2.S1) is also a conceptual hurdle the PRP must make explicit.
