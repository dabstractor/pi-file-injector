# Codebase Insertion Points — Delta 003 (Markdown Imports)

> Maps the **current** `file-injector.ts` (467 lines) structure to the exact insertion / refactor points
> for MI-1 and MI-2. Line numbers are current-commit landmarks (they will shift during the refactor);
> **function/identifier names are the stable contract.** All facts first-hand from the committed source.

---

## Current module surface (12 exports) — the test's sanity list

`file-injector.test.mjs` lines ~113–121 `assert(typeof mod.X === "function")` for: `default` (factory), `injectFiles`, `cleanToken`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`, `formatPagedDirectiveBlock`, `hasValidImageMagic`. **Any newly-exported helper (e.g. `scanTokens`, `computeCodeRanges`, `inCode`, `injectMarkdown`, `isAbsoluteOrTilde`, `estimateImageTokens`) must be appended to this list or the gate fails.** Pure helpers are exported so the harness can assert them; the recursion driver `injectFile`/`injectMarkdown`/`processTokenStream` MAY be kept private (they are exercised indirectly via `injectFiles`).

| Export | Lines | Used by MI? |
|---|---|---|
| `FILE_INJECT_RE` (const) | 17 | reused unchanged for markdown scan |
| `hasValidImageMagic` (F3) | 46 | preserved in refactored `injectFile` |
| `cleanToken` | 84 | reused by `scanTokens` |
| `expandTildeAndResolve` | 94 | reused by `scanTokens` (baseDir param) |
| `extOf` | 107 | reused by `injectFile` classification |
| `isBinary` | 118 | reused by `injectFile` |
| `formatTextFileBlock` / `formatImageBlock` / `formatBinaryBlock` / `formatEmptyImageBlock` | 129–153 | reused unchanged |
| `headSlice` / `headStartLine` / `headCompleteLineCount` (private) | 158–184 | reused by `emitText` paged branch |
| `formatPagedDirectiveBlock` | 189 | reused by `emitText` paged branch |
| `injectFiles` | 179 | refactored internally; **signature + return shape unchanged** |
| `default` (factory) | 384 | unchanged (handler + autocomplete) |

## MI-1 — Refactor `injectFiles` into shared `State` + recursive helpers (no behavior change)

### Landmark: the current `injectFiles` body (L179–355)
```
L188  return type Promise<{ text; images; injected: number; paged: number }>
L190  const images = [...imagesIn];                 // MERGE seed
L193–216  let remainingBudget (budget: undefined/null → null; else window-used-reserve-MARGIN)
L218–228  const priorPaths = new Set (from /<file name="([^"]+)">/g in text)
L230–236  const injectedThisRun = new Set
L240      const injectedIndexes: number[] = []
L242+     for (const m of text.matchAll(FILE_INJECT_RE)) { ...linear classify+emit... }
L338      if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };  // ORIGINAL refs
L344–355  strip #@ (high→low) → finalText = `${stripped}\n\n---\n\n${blocks.join("\n\n")}`; return {...}
```

### Refactor contract
- **Introduce `interface State { blocks: string[]; images: ImageContent[]; injectedSet: Set<string>; remaining: number|null; count: number; paged: number; }`** (PRD §9). Store the budget result in `state.remaining` (was local `remainingBudget`).
- **Consolidate dedup:** `state.injectedSet` is **seeded with `priorPaths`** (every `<file name="…">` already in `text`) — preserving the F1/F1c invariants. The within-run set (`injectedThisRun`) merges into `injectedSet`; each successful delivery `state.injectedSet.add(abs)`.
- **Extract helpers (MI-1 ships text/image/binary only — no markdown yet):**
  - `scanTokens(text, baseDir, { allowAbsTilde, skipCode }, state): { index; abs }[]` — scan-only; `localSeen` (per-text) + `state.injectedSet` check. For MI-1 the opts are always `{ allowAbsTilde: true, skipCode: false }` (user-prompt profile); `skipCode` is accepted but a no-op (`codeRanges = null`). Returns marker start-indices + resolved abs.
  - `processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]>` — scan once → re-check `state.injectedSet` → `await injectFile(...)` depth-first → returns resolved indices for `#@` stripping.
  - `injectFile(abs, state, ctx): Promise<boolean>` — stat→isFile→**CLAIM `abs` in `state.injectedSet`**→read buf→classify. **MI-1 classification branch order (preserve F3/F5):** (a) empty image `mime && buf.length===0` → `formatEmptyImageBlock`; (b) image `mime && hasValidImageMagic(buf,mime)` → attach + `formatImageBlock`; (c) `isBinary(buf)` → `formatBinaryBlock`; (d) else → `emitText`. `state.count++` once; return `true`. On any throw/miss/dir → return `false` (token left verbatim). **No markdown branch yet.**
  - `emitText(abs, content, state)` — lift the existing inline-vs-paged decision (L293–326) **verbatim**: whole if `remaining===null || fileCost<=PAGED_THRESHOLD*remaining`; sub-head guard (`content.length<=HEAD_CHARS`→whole); else head+directive, `state.paged++`. All `remaining` mutations move into `emitText` via `subtract`.
  - `subtract(state, cost)` — `if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost)`.
- **`injectFiles` becomes a thin wrapper:** build budget → build `State` (seed `injectedSet` with `priorPaths`, `images = [...imagesIn]`) → `resolvedIdx = await processTokenStream(event… text, ctx.cwd, { allowAbsTilde:true, skipCode:false }, state, ctx)` → if `state.count===0` return original refs → strip `#@` high→low → assemble `finalText` → return `{ text, images, injected: state.count, paged: state.paged }`.
- **MI-1 budget stays text-only** (images/binary do NOT call `subtract` yet — that is MI-2). This keeps behavior byte-for-byte.

### MI-1 behavior-preservation checklist (regression gate)
Unicode regex; F3 magic gate; F5 empty-image; empty 0-byte text → `\n\n</file>`; text-only budget; `count===0`→original `text`+`imagesIn` ref; strip `#@` only from injected markers (index-based); paged head+directive/surrogate-safe/line-offsets/sub-head; notify wording; the three handler guards; autocomplete provider; dedup semantics (F1/F1c).

## MI-2 — Markdown imports + total-size budget

### New constants (cluster near L17–43)
`MD_EXTS = new Set(["md","markdown"])`, `IMAGE_FALLBACK_TOKENS = 2805` (2000×2000 resized worst case = 4×4 tiles). Regexes (PRD §5.6.1): `INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g`, `FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/`.

### New pure helpers (export the test-asserted ones)
- `isAbsoluteOrTilde(p): boolean` — `p.startsWith("/") || p.startsWith("~")`.
- `computeCodeRanges(content): [number,number][]` — approximate-CommonMark (PRD §5.6.1). Walk lines (running char offset) for fenced blocks (`FENCE_OPEN_RE`; closing line = ` {0,3}` + same fence char ≥ opening length; unterminated → EOF; range = opening-fence first char … end of closing line inclusive). Then `INLINE_CODE_RE` spans **not** already inside a fenced range. Sort by start.
- `inCode(index, ranges): boolean` — binary search; `index ≥ range[0] && index < range[1]`.
- `estimateImageTokens(resized): number` — `resized` with numeric `width`/`height`: `max(1,⌈w/512⌉)·max(1,⌈h/512⌉)·170 + 85`; else `IMAGE_FALLBACK_TOKENS`.

### New recursion driver
`injectMarkdown(abs, content, state, ctx): Promise<void>` — PRD §5.6 six steps:
1. (read/decode already done by `injectFile`).
2. **Claim self:** `state.injectedSet.add(abs)` *before* scanning (self-import → verbatim, no infinite recursion).
3. `scanTokens(content, path.dirname(abs), { allowAbsTilde:false, skipCode:true }, state)` → resolved records (relative-only, outside code).
4. **Strip `#@`** from each resolved import marker (high→low splice, leave path) → `stripped` = block content.
5. `emitText(abs, stripped, state)` (paged decision on **stripped** content; bumps `state.paged`).
6. **Recurse depth-first** in encounter order: `if (!state.injectedSet.has(r.abs)) await injectFile(r.abs, state, ctx)`. Pre-order emission.

### Wire markdown into `injectFile`
In the classify cascade, insert the markdown branch **after** image, **before** binary: `else if (MD_EXTS.has(ext)) { await injectMarkdown(abs, buf.toString("utf8"), state, ctx); }`. Markdown bypasses NUL/binary routing.

### Total-size budget (§5.6.2) — wire into `injectFile`
- Image attach: `subtract(state, estimateImageTokens(resized))` (images never paged).
- Binary note: `subtract(state, Math.ceil(formatBinaryBlock(abs).length / 4))`.
- Empty-image note: `subtract(state, Math.ceil(formatEmptyImageBlock(abs).length / 4))`.
- `emitText` already subtracts text whole/head cost (from MI-1).

### Test fixtures to add (`buildFixtures`)
Markdown fixtures written the same way as existing ones (real `fs` in the temp dir): e.g. `notes.md` containing `#@api.md` (+ a fenced `` `#@example.ts` ``), `api.md`, `a.md`↔`b.md` (cycle), `sub/notes.md` importing `api.md` (sibling), an importing-three-files `bigdoc.md`, a `big.log` (or reuse `huge.log`) for the shared-budget case. The tilde/abs-import cases need only inline text in the markdown.

## MI-3 — README (Mode B, final task)

Current `README.md` is **paged-delivery-current** (plan 002) but has **no** markdown-import content. Sections to touch: **Why** (add: `#@spec.md` pulls in everything it references); **Usage** (markdown-import example); **What gets injected** table (note a delivered `.md` is also scanned for relative imports); **Syntax** (new *Markdown imports* subsection: relative-only, resolve-from-md-dir, code-exempt, dedup-once, shared budget); **Limits** (imports are relative-only; non-markdown files are inert; no autocomplete for in-file directives). Leave paged/image/binary/`#@`-vs-`@` sections as-is.
