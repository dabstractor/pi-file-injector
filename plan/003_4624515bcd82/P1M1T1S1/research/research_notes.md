# Research Notes — P1.M1.T1.S1: Introduce shared State + consolidate dedup + subtract helper

## Mission
Surgical refactor of `injectFiles` in `file-injector.ts` (467 lines): replace scattered locals
(`blocks`, `images`, `count`, `paged`, `remainingBudget`, `priorPaths`, `injectedThisRun`) with ONE
shared `const state: State`, add `interface State` + `function subtract()`, and consolidate the two
dedup sets into `state.injectedSet`. **Behavior byte-for-byte identical.** This is the structural
foundation for T1.S2 (extract recursive helpers) and T2 (markdown). The linear `matchAll` loop shape
is PRESERVED (no recursion yet).

## Baseline (MUST stay green)
`node ./file-injector.test.mjs` → **52 passed, 0 failed.** This is the regression gate. No new tests.

## Current `injectFiles` landmarks (commit HEAD — line numbers will shift; identifiers are the contract)
- L168–177 : JSDoc for `injectFiles`
- L179      : `export async function injectFiles(text, imagesIn, ctx)` → `Promise<{text,images,injected,paged}>`
- L189–192  : locals `const blocks: string[]`, `const images = [...imagesIn]`, `let count=0`, `let paged=0`
- L198–208  : budget `let remainingBudget` — try/catch; `usage===undefined || usage.tokens===null` → null; else
              `Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN)` where `reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE`
- L220–222  : `priorPaths = new Set` seeded from `<file name="([^"]+)">` matches in text
- L229      : `injectedThisRun = new Set` (within-run dedup)
- L235      : `injectedIndexes: number[]` (marker-strip indices — STAYS LOCAL, NOT in State)
- L242      : `for (const m of text.matchAll(FILE_INJECT_RE))`
- L248      : dedup check `if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;`
- L268–270  : EMPTY-IMAGE success site: `injectedThisRun.add(abs); injectedIndexes.push(m.index); count++; continue;`
- L297–300  : TEXT INLINE-WHOLE + budget mutation: `if (remainingBudget === null || fileCost <= PAGED_THRESHOLD * remainingBudget)` → push, then `if (remainingBudget !== null) remainingBudget = Math.max(0, remainingBudget - fileCost);`
- L319–322  : SUB-HEAD GUARD (`content.length <= HEAD_CHARS` inside paged else): push whole, **NO budget mutation** (stays mutation-free)
- L323–325  : TEXT PAGED-HEAD + budget mutation: `remainingBudget = Math.max(0, remainingBudget - Math.ceil(HEAD_CHARS / 4));` (NO `if(remainingBudget!==null)` guard here — non-null is guaranteed by being in the `else`)
- L329–331  : GENERIC success site: `injectedThisRun.add(abs); injectedIndexes.push(m.index); count++;`
- L338      : `if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };` — **ORIGINAL `imagesIn` ref**
- L350–353  : strip `#@` high→low over `injectedIndexes`
- L354–355  : `finalText = strippedText + "\n\n---\n\n" + blocks.join("\n\n")`; return `{ text: finalText, images, injected: count, paged }`

## The conversion map (the whole change, in one table)

| Current (local) | After (state) | Notes |
|---|---|---|
| `const blocks: string[]` | `state.blocks` | seeded `[]` |
| `const images = [...imagesIn]` | `state.images` | seeded `[...imagesIn]` (the COPY) |
| `let count` | `state.count` | seeded `0` |
| `let paged` | `state.paged` | seeded `0` |
| `let remainingBudget` | `state.remaining` | same math + try/catch |
| `priorPaths` + `injectedThisRun` | `state.injectedSet` | seeded with priorPaths; per-token check `.has(abs)`; each success `.add(abs)` |
| `injectedIndexes: number[]` | **STAYS LOCAL** | not in State (PRD §9: it's a top-level-strip return value) |
| `if(remainingBudget!==null) remainingBudget = Math.max(0, remainingBudget - fileCost)` (L300, inline whole) | `subtract(state, fileCost)` | subtract's internal `if(state.remaining!==null)` guard ≡ existing guard |
| `remainingBudget = Math.max(0, remainingBudget - Math.ceil(HEAD_CHARS/4))` (L324, paged head) | `subtract(state, Math.ceil(HEAD_CHARS/4))` | subtract adds a null guard that is a no-op here (non-null guaranteed) → identical result |
| `if (count === 0) return { text, images: imagesIn, ... }` (L338) | UNCHANGED — uses ORIGINAL `imagesIn`, NOT `state.images` | byte-for-byte critical |
| final return `{ text: finalText, images, injected: count, paged }` | `{ text: finalText, images: state.images, injected: state.count, paged: state.paged }` | uses the COPY |

## Dedup-equivalence proof (why consolidation is behavior-identical)
- `state.injectedSet` initialized = `priorPaths` (seeded from `<file name="…">` blocks already in text).
- Per-token check `state.injectedSet.has(abs)` ≡ `priorPaths.has(abs) || injectedThisRun.has(abs)` because the set
  at check time == {priorPaths} ∪ {paths successfully delivered so far this run}, maintained incrementally via `.add(abs)` at each success site.
- F1 invariant (a prior block for X blocks re-inject of X): X ∈ priorPaths ⊆ injectedSet → skipped. ✓
- F1c invariant (a NEW path Y still injects): Y ∉ priorPaths, not yet added → injects. ✓
- Within-run repeat (DUP1/DUP2/DUP3): first delivery adds Y; second check sees Y → skipped. ✓

## subtract() — exact shape (PRD §9)
```ts
function subtract(state: State, cost: number) {
  if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost);
}
```

## interface State — exact shape (PRD §9 / §6.2)
```ts
interface State {
  blocks: string[];
  images: ImageContent[];
  injectedSet: Set<string>;   // seeded with priorPaths; claimed abs paths → dedup
  remaining: number | null;   // single budget accumulator
  count: number;
  paged: number;
}
```
NOT exported (it's internal). `subtract` NOT exported. **Test sanity list (L113–121) is NOT touched.**

## Scope boundary — what this subtask does NOT do
- ❌ No `scanTokens` / `processTokenStream` / `injectFile` / `emitText` extraction (that is T1.S2).
- ❌ No markdown (T2.S3), no `MD_EXTS` / code-region helpers (T2.S1), no image/binary budget (T2.S2).
- ❌ No change to `FILE_INJECT_RE`, `hasValidImageMagic`, `format*`, `headSlice`, `default` factory, autocomplete.
- ❌ No new exports. No new tests. No README change.
- The loop stays linear `for (const m of text.matchAll(FILE_INJECT_RE))`; images/binary/empty-image do NOT call subtract yet.

## JSDoc update (Mode A, item §6 DOCS)
Update the injectFiles JSDoc (L168–177): state that internal state is now carried in a shared `State`
object (blocks/images/injectedSet/remaining/count/paged) and forward-reference that the budget will
span the whole prompt including markdown imports (PRD §5.6.2). No README change (Mode B = T3.S1).

## Validation command (verified working)
`node ./file-injector.test.mjs` from repo root → expects `52 passed, 0 failed`.
(Pi's loader/jiti + global `@earendil-works/pi-coding-agent` v0.80.7 must be installed — it is; baseline green.)
