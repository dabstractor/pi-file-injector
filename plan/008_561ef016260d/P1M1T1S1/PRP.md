# PRP — P1.M1.T1.S1 (plan/008): Add FileDetail interface, State.details field, and emitText detail pushes

> **Scope flag:** This is the **first building block** of the compact read-tool-style display feature (PRD §6.2/§6.3/§6.4).
> It is **purely additive**: add an exported `FileDetail` interface, a `details: FileDetail[]` field on `State`, and have
> `emitText` push a `FileDetail` entry alongside each block push (text whole / sub-head whole / paged). Plus init
> `details: []` in the State constructor. `details` is built in parallel with `blocks` but **not yet consumed** — the
> renderer/handoff come in P1.M1.T2; image/binary details + the return-shape change are S2. **Behavior is byte-for-byte
> unchanged → all 188 existing tests stay green.** Scope = S1 ONLY.

---

## Goal

**Feature Goal:** Thread per-file `FileDetail` metadata through the injection core so a later subtask (the
renderer, T2.S2) can draw collapsed `read <path>` lines. Concretely: `FileDetail` exists (exported), `State`
carries a `details: FileDetail[]` parallel to `blocks`, and `emitText` pushes one detail per emission (text
whole, sub-head whole, paged) — without altering any block/budget/return behavior.

**Deliverable:** Modified `file-injector.ts` (exported `FileDetail` interface before `State`; `details` field
on `State`; `emitText` adds `lineCount` + 3 detail pushes + paged-local extraction; the State constructor at
L951 inits `details: []`). No test changes, no new files, no behavior change.

**Success Definition:**
1. `npm run typecheck` → 0 errors (State's required `details` is initialized at the one constructor, L951).
2. `node ./file-injector.test.mjs` → 128 passed; `relative-imports` 38 + `import-behavior` 22 unchanged (188 total).
3. `emitText` pushes a `FileDetail` for every block emission (whole, sub-head, paged); `state.details` is parallel to `state.blocks`.
4. No change to blocks, subtract math, `state.paged++`, the `---` concat, or the `{text, images, injected, paged}` return shape.

## Why

- **Foundation for the display feature.** PRD §6.2/§6.3 deliver files as a custom message whose `details.files`
  array drives a green, collapsible `read <path>` renderer. That metadata has to be collected *during* injection,
  in emission order, parallel to `blocks`. This subtask lays the `FileDetail` type + the `State.details` seam +
  the `emitText` text/paged collection — without which the renderer (T2.S2) has nothing to render.
- **Additive now, consumed later.** Collecting details in `emitText` is the natural site (it already decides
  whole-vs-paged and has the content/line info). Doing it atomically here — without changing blocks, budget, or
  the return shape — keeps the 188-test regression gate green and lets S2/T2/T2.S2 build on a stable seam.
- **`details` is parallel to `blocks` by construction.** Both are appended in the same emission sites, so they
  stay index-aligned (the renderer pairs them by index, §6.4). Establishing that invariant now (one detail per
  block emission in `emitText`) is the whole point.

## What

### User-visible behavior

- **None.** `details` is built but read by nothing in S1. The model-facing `<file>` blocks, the budget, the
  notify, and the return shape are all unchanged. This subtask is invisible until the renderer lands (T2.S2).

### Technical behavior (the contract)

- `emitText` pushes a `FileDetail` alongside each block push: `{ path, kind: "text", chars, lines }` for whole
  (incl. sub-head); `{ path, kind: "paged", chars, range: ":<startLine>-", pagedHeadLines }` for paged.
- `State.details: FileDetail[]` is initialized `[]` at the one State constructor (injectFiles L951).

### Success Criteria

- [ ] `export interface FileDetail { path; kind: "text"|"image"|"binary"|"paged"; chars?; lines?; range?; pagedHeadLines?; dimensionHint? }` exists before `interface State`.
- [ ] `State` has `details: FileDetail[]` (parallel to `blocks`).
- [ ] `emitText` adds `const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;` and pushes a detail in the whole, sub-head, and paged branches.
- [ ] The paged branch extracts `headLines`/`startLine` locals (used in both the directive block and the detail).
- [ ] The State constructor at L951 inits `details: []`.
- [ ] Blocks, subtract math, `state.paged++`, `---` concat, return shape — all UNCHANGED.
- [ ] `npm run typecheck` → 0 errors; all 188 tests pass.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current landmarks (State L329, emitText L752, constructor L951), the verbatim new code for each edit, the
`lineCount`-doesn't-exist correction, the paged-local extraction rationale, the "subtract unchanged" guard, and
both gates. One file; four small additive edits.

### Documentation & References

```yaml
# MUST READ — the target shapes (FileDetail, State.details, emitText with details)
- file: PRD.md
  why: "§6.2 defines the FileDetail interface (fields + meaning); §6.4 lists State.details parallel to blocks;
        §9 Algorithm pseudocode shows emitText WITH the lineCount local + the 3 detail pushes + the paged-local
        extraction — the exact target for this subtask."
  section: "### 6.2 Delivery (FileDetail interface) + ### 6.4 Assembly (State.details) + ## 9 Algorithm (emitText)"
  critical: "§9 emitText is the authoritative target shape. NOTE: §9's paged subtract uses Math.ceil(head.length/4);
             the CURRENT code uses Math.ceil(HEAD_CHARS/4). S1 does NOT change the subtract — keep the current
             HEAD_CHARS form. (Changing it is out of scope and would perturb the PD* budget tests.)"

# The file you edit (the ONLY source change — 4 additive edits)
- file: file-injector.ts
  why: "1114 lines. interface State L329; emitText L752-792 (the edit site); the State constructor at L951 (the
        ONLY State construction — all other `state: State` at L341/615/663/689/752/838 are PARAM declarations).
        emitText callers: injectFile L735, injectMarkdown L895 (both pass `state`, now with details)."
  pattern: "emitText already computes fileCost and (in the paged branch) head via headSlice + headStartLine/
            headCompleteLineCount inline. The detail pushes ride on those same values."
  gotcha: "lineCount does NOT exist in the current emitText (the item's claim it 'already exists' is WRONG) —
           add it. And do NOT change the paged subtract (HEAD_CHARS → head.length is NOT this subtask)."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. State.details is REQUIRED; the only constructor (L951) inits it →
        clean. FileDetail is a type-only export (interface, erased at runtime) → no runtime/ guard impact."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (4 additive edits: +FileDetail, +State.details, emitText details, +details:[] at L951)
├── file-injector.test.mjs    # run to confirm green (NOT edited — no test reads state.details)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/008_561ef016260d/
    ├── architecture/{system_context.md, external_deps.md, test_migration.md}
    └── P1M1.T1.S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — +export interface FileDetail (before State); +details on State; emitText
                          #                  +lineCount + 3 detail pushes + paged-local extraction; +details:[] at L951.
# No other files. No new files. No new runtime exports (FileDetail is type-only). No test changes.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — lineCount does NOT exist in the current emitText. The item's §3 claim ("The lineCount variable
//   already exists") is INACCURATE. ADD `const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;` at the top
//   of emitText (after fileCost), per PRD §9. Do not assume it's there.

// CRITICAL — do NOT change the paged-branch subtract. It is currently `subtract(state, Math.ceil(HEAD_CHARS / 4))`.
//   PRD §9 shows `Math.ceil(head.length / 4)` — that is a DIFFERENT change (surrogate-trimmed head) and is NOT
//   in S1's scope. Keep HEAD_CHARS. Changing it would perturb the PD* budget tests and is scope creep.

// CRITICAL — the ONLY State constructor in the file is at L951 (injectFiles). Adding the required `details` field
//   means L951 MUST init `details: []` or typecheck fails ("Property 'details' is missing"). All other `state: State`
//   occurrences are param declarations (they receive state, don't construct it) — unaffected.

// GOTCHA — FileDetail is a TYPE-ONLY export (interface). jiti/TS erases interfaces at runtime, so `Object.keys(mod)`
//   will NOT include "FileDetail" and the test's ASSERTED_EXPORTS completeness guard (which filters
//   `typeof mod[k] === "function"`) is UNAFFECTED. No test sanity-list edit needed.

// GOTCHA — `kind: "text"` in the pushed object literal is contextually typed by `state.details: FileDetail[]`, so
//   it assigns to the union `"text"|"image"|"binary"|"paged"` without `as const`. (Matches PRD §9.)

// GOTCHA — emitText is the ONLY place that decides whole-vs-paged and has the content/line info, so it is the
//   natural site for text/paged details. Image (`kind:"image"`, dimensionHint) and binary (`kind:"binary"`) details
//   are pushed in injectFile in S2 — NOT here. S1's FileDetail.kind union includes them forward-looking, but emitText
//   only ever pushes "text" and "paged".
```

## Implementation Blueprint

### Data models and structure

```ts
/** PRD §6.2/§6.3 per-file metadata (one entry per delivered file). Type-only export (erased at runtime). */
export interface FileDetail {
  path: string;                 // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;               // text: content length; paged: FULL content length
  lines?: number;               // text: total line count
  range?: string;               // paged: ":<startLine>-…" resume range (read-tool style)
  pagedHeadLines?: number;      // paged: complete lines delivered in the head
  dimensionHint?: string;       // image: formatDimensionNote(resized) — UNUSED in S1 (image is S2)
}

interface State {
  blocks: string[];
  details: FileDetail[];   // ← ADD — parallel to blocks (per-file metadata for the renderer, §6.4)
  images: ImageContent[];
  injectedSet: Set<string>;
  remaining: number | null;
  count: number;
  paged: number;
  bareAt: boolean;
}
```

### Implementation Patterns & Key Details

```ts
// === emitText (L752) — ADD lineCount + 3 detail pushes; extract paged locals; subtract UNCHANGED ===
export function emitText(abs: string, content: string, state: State): void {
  const fileCost = Math.ceil(content.length / 4);
  const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;   // ← ADD (does NOT exist today)
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });   // ← ADD
    subtract(state, fileCost);
  } else {
    const head = headSlice(content);
    if (content.length <= HEAD_CHARS) {
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });   // ← ADD
      subtract(state, fileCost);
    } else {
      const headLines = headCompleteLineCount(head);   // ← EXTRACT (was inline in the directive args)
      const startLine = headLines + 1;                  // ← EXTRACT (= headStartLine(head))
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines));   // use locals
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines }); // ← ADD
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));   // ← UNCHANGED (do NOT switch to head.length)
    }
  }
}

// === State constructor in injectFiles (L951) — ADD `details: []` ===
const state: State = {
  blocks: [],
  details: [],   // ← ADD (parallel to blocks)
  images: [...imagesIn],
  injectedSet: priorPaths,
  remaining,
  count: 0,
  paged: 0,
  bareAt,
};
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 4 additive edits, ONE file):
  - add (before `interface State` ~L329): `export interface FileDetail { … }` (type-only; no guard impact).
  - change (`interface State` ~L329): add `details: FileDetail[];` (parallel to blocks).
  - change (emitText L752-792): add `lineCount` local; add a detail push in whole / sub-head / paged; extract
    `headLines`+`startLine` locals in the paged branch (used by both the directive block and the detail).
    KEEP the paged subtract as `Math.ceil(HEAD_CHARS / 4)` (do NOT change to head.length).
  - change (State constructor L951): add `details: [],`.
  - UNCHANGED: blocks pushes; subtract math; state.paged++; the `---` concat in injectFiles; the return shape
    `{ text, images, injected, paged }`; injectFile's image/binary branches (S2); scanTokens; injectMarkdown;
    every helper.

NO_CHANGES: the three .mjs suites, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new runtime exports (FileDetail is type-only). NO new imports.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD `export interface FileDetail` before `interface State` (~L329)
  - IMPLEMENT: the 7-field interface above (path; kind union; chars?; lines?; range?; pagedHeadLines?; dimensionHint?).
  - EXPORT: yes (`export interface`) — type-only (item §4; consumed forward by S2 image/binary + T2.S2 renderer).
  - COMMENT: cite PRD §6.2/§6.3; note it is renderer metadata, never sent to the model as separate text.
  - PLACEMENT: immediately before `interface State`.

Task 2: ADD `details: FileDetail[];` to `interface State`
  - ADD the field parallel to `blocks` (PRD §6.4).
  - REQUIRED (not optional) — the constructor (Task 4) inits it.

Task 3: EDIT `emitText` (L752-792) — add lineCount + 3 detail pushes + paged-local extraction
  - ADD `const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;` after `fileCost`. (It does NOT exist today.)
  - Whole branch: after `state.blocks.push(formatTextFileBlock(abs, content))`, ADD
    `state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });`.
  - Sub-head branch: ADD the SAME text detail after its block push.
  - Paged branch: EXTRACT `const headLines = headCompleteLineCount(head); const startLine = headLines + 1;`; use
    them in `formatPagedDirectiveBlock(abs, content.length, startLine, headLines)`; after the two block pushes ADD
    `state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines });`.
  - PRESERVE: `state.paged++` and `subtract(state, Math.ceil(HEAD_CHARS / 4))` UNCHANGED.
  - DO NOT: change the subtract, touch blocks logic, or push image/binary details (S2).

Task 4: INIT `details: []` in the State constructor (injectFiles L951)
  - ADD `details: [],` to the `const state: State = { … }` object (the ONLY State construction in the file).
  - REQUIRED or typecheck fails ("Property 'details' is missing").

Task 5: VERIFY gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 128 passed; relative-imports 38; import-behavior 22 (188 total, unchanged).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails with "Property 'details' is missing in type …" → you forgot Task 4 (init details: [] at L951).
# If it fails on the detail push (kind) → ensure state.details is typed FileDetail[] (contextual typing of the literal).
```

### Level 2: The Regression Gate (all 188 tests must stay green — the change is additive)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 128 passed, 0 failed
node ./relative-imports.test.mjs     # →  38 passed, 0 failed
node ./import-behavior.test.mjs      # →  22 passed, 0 failed
# Expected: all green, unchanged. No test reads state.details; blocks/budget/return-shape are untouched.
# If ANY test flips to FAIL, the edit over-reached — re-check you did NOT change the subtract, blocks, or return shape.
```

### Level 3: Additive-only proof (details built but not consumed)

```bash
# Confirm state.details is populated in parallel with blocks (ad-hoc; not a gate) — drive injectFiles and
# inspect via a tiny probe, OR just trust the unit tests + typecheck (details has no consumer in S1, so the
# only S1 proof is "blocks/budget/return unchanged" = Level 2 green + typecheck clean).
node ./file-injector.test.mjs 2>&1 | grep -E "case PD1:|case 1:|case 15:|Result:"
# Expected: PD1 (paged) ✓, case 1 (whole text) ✓, case 15 (markdown import → emitText) ✓ — all unchanged.
```

### Level 4: N/A (no display/renderer in S1)

```bash
# The renderer (the actual consumer of details.files) is T2.S2. S1 only COLLECTS details; there is no display
# to validate yet. No creative/domain validation applies.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 128 passed; `relative-imports` 38 + `import-behavior` 22 (188 total).
- [ ] `export interface FileDetail` exists with the 7 fields; `State.details: FileDetail[]` exists.
- [ ] `emitText` has the `lineCount` local + detail pushes in whole/sub-head/paged; paged extracts `headLines`/`startLine`.
- [ ] The State constructor at L951 inits `details: []`.

### Feature Validation (additive invariant)

- [ ] Blocks pushes UNCHANGED (same `formatTextFileBlock`/`formatPagedDirectiveBlock` calls, same args).
- [ ] Paged subtract UNCHANGED (`Math.ceil(HEAD_CHARS / 4)` — NOT `head.length`).
- [ ] `state.paged++` UNCHANGED; the `---` concat in injectFiles UNCHANGED.
- [ ] Return shape `{ text, images, injected, paged }` UNCHANGED.
- [ ] `state.details` is parallel to `state.blocks` (one detail per block emission in emitText).

### Code Quality Validation

- [ ] `FileDetail` is a type-only export (no runtime export → no module-surface guard edit).
- [ ] Only the 4 additive edits; no other function touched (injectFile's image/binary branches = S2).
- [ ] No new imports; no new runtime exports; no test changes.

### Documentation

- [ ] JSDoc on `FileDetail` (renderer metadata, never sent to the model as separate text; cite PRD §6.2/§6.3).
- [ ] No README/user-facing change (internal type/interface additions; Mode A: none).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT assume `lineCount` exists.** The item's §3 claim is inaccurate — the current emitText has only
  `fileCost`. ADD the `lineCount` local (per PRD §9). Forgetting it → `ReferenceError` at runtime / typecheck error.
- ❌ **Do NOT change the paged subtract.** It is `Math.ceil(HEAD_CHARS / 4)`. PRD §9's `Math.ceil(head.length / 4)`
  is a different (surrogate-trim) change, NOT in S1. Changing it perturbs the PD* budget tests and is scope creep.
- ❌ **Do NOT forget the State constructor init.** `details` is REQUIRED in State; the one constructor (L951) must
  init `details: []` or typecheck fails. (All other `state: State` are param declarations — don't touch them.)
- ❌ **Do NOT push image/binary details in S1.** Those land in injectFile in S2. emitText only ever pushes
  `kind: "text"` and `kind: "paged"`. (FileDetail.kind includes "image"/"binary" forward-looking — that's fine.)
- ❌ **Do NOT change blocks, budget, return shape, or the `---` concat.** S1 is purely additive (details collected
  in parallel, consumed by nothing yet). Any of those changes breaks the 188-test gate and is S2/T2/M2 territory.
- ❌ **Do NOT add FileDetail to the test sanity list / ASSERTED_EXPORTS.** It's a type-only interface (erased at
  runtime); the completeness guard filters functions. Adding it would be wrong/no-op.
- ❌ **Do NOT call headCompleteLineCount/headStartLine twice in the paged branch.** Extract `headLines`/`startLine`
  as locals once and use them in both the directive block and the detail (DRY; matches PRD §9).
- ❌ **Do NOT migrate tests or add renderer/display tests here.** Test migration is M2; delivery/renderer tests are
  M2.T2. S1 ships no test changes (the 188-test gate proves additivity).

---

## Confidence Score: 9/10

A purely additive, well-bounded change: one type-only interface, one State field, three detail pushes + a local
extraction in `emitText`, and one constructor init. The PRD §9 pseudocode gives the exact target shape for
`emitText`; the architecture confirms `details` is parallel to `blocks` and consumed only later. The 188-test gate
is green today and MUST stay green (the change touches no block/budget/return logic). The -1 reserves for the
`lineCount`-doesn't-exist correction (the item's claim is wrong; if the implementer trusts it, they'll omit the
local → runtime ReferenceError, instantly caught by case 1) and the "don't change the subtract" discipline (PRD §9
shows `head.length`, but S1 keeps `HEAD_CHARS`). One file; the implementing agent re-runs `npm run typecheck` + the
three suite commands.
