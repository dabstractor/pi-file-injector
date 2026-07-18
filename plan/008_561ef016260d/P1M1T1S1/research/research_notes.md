# Research Notes — P1.M1.T1.S1 (plan/008): Add FileDetail interface, State.details field, and emitText detail pushes

## Mission
The FIRST building block of the compact read-tool-style display feature (PRD §6.2/§6.3/§6.4). Add the
`FileDetail` interface, a `details: FileDetail[]` field on `State`, and have `emitText` push a `FileDetail`
entry ALONGSIDE each block push (text whole, sub-head whole, paged). Plus init `details: []` in the State
constructor. **Purely additive** — `details` is built in parallel with `blocks` but NOT yet consumed (the
renderer/handoff come in P1.M1.T2; image/binary details + the return-shape change are S2). Behavior is
byte-for-byte unchanged → all 188 existing tests stay green.

**Scope = S1 ONLY:** FileDetail + State.details + emitText text/sub-head/paged detail pushes + State init.
NOT image/binary details (S2); NOT injectFiles return-shape change / strip `---` concat (S2); NOT the
input/before_agent_start split (T2.S1); NOT the renderer (T2.S2); NOT test migration (M2).

## Baseline (MUST stay green — change is additive)
- `node ./file-injector.test.mjs` → **128 passed, 0 failed.**
- `node ./relative-imports.test.mjs` → **38 passed, 0 failed.**
- `node ./import-behavior.test.mjs` → **22 passed, 0 failed.** (Total 188.)
- `npm run typecheck` → **0 errors** under `--strict`. file-injector.ts is 1114 lines.
- `FileDetail` / `State.details` / any `.details` ref — grep-confirmed ABSENT (purely additive).

## Verified current landmarks (file-injector.ts, 1114 lines)
- L329 : `interface State { blocks; images; injectedSet; remaining; count; paged; bareAt }` — NO details field.
- L341 : `function subtract(state, cost)` — receives state (param, not a constructor).
- L752 : `export function emitText(abs, content, state): void` — the edit site. Body (L752-792):
  - `const fileCost = Math.ceil(content.length / 4);`
  - Whole branch (remaining===null || fileCost <= PAGED_THRESHOLD*remaining): `state.blocks.push(formatTextFileBlock(abs, content)); subtract(state, fileCost);`
  - else → PAGED: `const head = headSlice(content);` then sub-head guard (`content.length <= HEAD_CHARS` → push whole + subtract), else paged (`push(head); push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head))); state.paged++; subtract(state, Math.ceil(HEAD_CHARS / 4));`).
- L951 : `const state: State = { blocks:[], images:[...imagesIn], injectedSet:priorPaths, remaining, count:0, paged:0, bareAt }` — the **ONLY** State constructor in the file (all other `state: State` at L341/615/663/689/752/838 are PARAM declarations). Updating L951 keeps typecheck green.
- emitText callers: injectFile L735 (text branch), injectMarkdown L895 (Step 5). Both pass `state` (now with details).
- format helpers: formatTextFileBlock L238; headStartLine L280 (newlines+1); headCompleteLineCount L288 (newlines); formatPagedDirectiveBlock L305 (abs, len, startLine, injectedLines).

## ⭐ CORRECTION to the item: `lineCount` does NOT exist in emitText
The item §3 says "The lineCount variable already exists in emitText as `(content.match(/\n/g)?.length ?? 0) + 1`."
That is INACCURATE for the current code — emitText (L752-792) has only `fileCost`, no `lineCount`. The PRD §9
pseudocode shows `lineCount` being ADDED. → The implementer MUST add `const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;`
at the top of emitText (right after `fileCost`). Do not assume it exists.

## The exact changes (PRD §9 emitText + §6.2 FileDetail + §6.4 State.details)

### (a) Add `export interface FileDetail` just BEFORE `interface State` (L329)
```ts
/** PRD §6.2/§6.3 per-file metadata carried in the custom message's `details` (one entry per delivered file).
 *  Drives the renderer's collapsed `read <path>` lines; never sent to the model as separate text.
 *  Type-only export (erased at runtime → NOT subject to the test's module-surface function guard). */
export interface FileDetail {
  path: string;                 // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;               // text: content length; paged: FULL content length
  lines?: number;               // text: total line count (for the "N lines" hint)
  range?: string;               // paged: ":<startLine>-…" resume range (read-tool style)
  pagedHeadLines?: number;      // paged: complete lines delivered in the head
  dimensionHint?: string;       // image: formatDimensionNote(resized) — UNUSED in S1 (image is S2)
}
```
`export` is type-only (jiti erases interfaces) → `Object.keys(mod)` won't include it → the test's
`ASSERTED_EXPORTS` completeness guard (filters `typeof === "function"`) is UNAFFECTED. No test sanity-list edit.

### (b) Add `details: FileDetail[];` to `interface State` (parallel to `blocks`)
```ts
interface State {
  blocks: string[];
  details: FileDetail[];   // ← ADD (parallel to blocks; per-file metadata for the renderer, §6.4)
  images: ImageContent[];
  injectedSet: Set<string>;
  remaining: number | null;
  count: number;
  paged: number;
  bareAt: boolean;
}
```

### (c) emitText (L752-792) — ADD lineCount + 3 detail pushes; extract paged locals; keep subtract UNCHANGED
```ts
export function emitText(abs: string, content: string, state: State): void {
  const fileCost = Math.ceil(content.length / 4);
  const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;   // ← ADD (does NOT exist today; item's claim is wrong)
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });   // ← ADD
    subtract(state, fileCost);
  } else {
    const head = headSlice(content);
    if (content.length <= HEAD_CHARS) {
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });   // ← ADD (same whole detail)
      subtract(state, fileCost);
    } else {
      const headLines = headCompleteLineCount(head);   // ← EXTRACT as local (replaces inline call below)
      const startLine = headLines + 1;                  // ← EXTRACT (= headStartLine(head))
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines));  // use locals
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines }); // ← ADD
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));   // ← UNCHANGED (do NOT switch to head.length — not S1's scope)
    }
  }
}
```

### (d) State constructor in injectFiles (L951) — ADD `details: []`
```ts
const state: State = {
  blocks: [],
  details: [],   // ← ADD (parallel to blocks; init empty)
  images: [...imagesIn],
  injectedSet: priorPaths,
  remaining,
  count: 0,
  paged: 0,
  bareAt,
};
```

## Why this is purely additive (188 tests stay green)
- emitText STILL pushes blocks exactly as before; the subtract math is UNCHANGED (`Math.ceil(HEAD_CHARS / 4)`
  in the paged branch — do NOT change to `head.length`; that is NOT S1); `state.paged++` unchanged.
- The return shape `{ text, images, injected, paged }` is UNCHANGED; the `---` concat in injectFiles is UNCHANGED.
- `state.details` is built but NOT read by anything in S1 (no consumer until the renderer in T2.S2).
- No existing test reads `state.details` (grep-confirmed: zero `.details` refs in file-injector.ts; the suites
  drive `mod.injectFiles` and assert on `r.text`/`r.injected`/`r.paged`/`r.images` — all unchanged).
- TypeScript: `details: FileDetail[]` is REQUIRED in State; the ONLY constructor (L951) inits it → typecheck
  green. The `.mjs` test State literals (for scanTokens unit tests) are untyped and don't construct State in TS
  scope, so they don't affect typecheck. (scanTokens doesn't touch details anyway.)

## Why the paged-branch local extraction is in scope (and necessary)
The current paged branch calls `headStartLine(head)`/`headCompleteLineCount(head)` INLINE in the
formatPagedDirectiveBlock args. The detail push needs `headLines` (= headCompleteLineCount) and `startLine`
(= headLines + 1). The PRD §9 pseudocode extracts them as locals (`const headLines = …; const startLine = headLines + 1;`)
and uses them in BOTH the directive block AND the detail. Extracting avoids double-calling the helpers and
gives the names the detail references. Minimal, necessary, matches PRD.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ Image detail push (`kind: "image", dimensionHint`) in injectFile = **S2**.
- ❌ Binary detail push (`kind: "binary"`) in injectFile = **S2**.
- ❌ injectFiles return-shape change (strip the `---` concat; return blocks/details) = **S2**.
- ❌ input/before_agent_start split + pending stash = **T2.S1**.
- ❌ registerMessageRenderer + renderInjectedMessage = **T2.S2**.
- ❌ Test migration (r.blocks/r.details) = **M2**.
- ❌ Do NOT change the paged subtract (`HEAD_CHARS` → `head.length`) — not S1; would perturb the PD* budget tests.
- ✅ S1 = FileDetail interface (exported) + State.details + emitText text/sub-head/paged detail pushes + State init at L951.

## DOCS: none
Internal type/interface additions + parallel array; no user-facing/config/API surface change. (Mode A: none.)
