# System Context — Delta 003: Markdown Transitive Imports (`#@file`)

**Project:** `pi-file-injector` — `#@file` Whole-File Injection Extension for Pi (`@earendil-works/pi-coding-agent` v0.80.7).
**Delta scope (plan 003):** Add **markdown transitive imports** (PRD §5.6 + §4.5 + §5.6.1 + §5.6.2) to the existing, fully-implemented single-file extension. This is the *only* net-new feature; it requires a structural refactor (shared mutable `State`) and a budget-accounting extension (images + binary notes now consume the shared budget) to support recursion.
**Research basis:** First-hand read of the committed `file-injector.ts` (467 lines), `file-injector.test.mjs` (1044 lines), the current `README.md`, plus `plan/002_0ac3eb160af7/architecture/pi_api_verification.md` (all 9 API claims VERIFIED). The Pi API requires **no new** surface for this delta.

---

## 1. What Exists and Works Today (the starting point)

A **single-file** Pi TypeScript extension. `package.json` loads only `file-injector.ts` (`"pi": { "extensions": ["file-injector.ts"] }`). Zero npm dependencies. The implementation is the **MVP (plan 001) + paged delivery (plan 002)**, both shipped and green.

| Capability | Status | Code site |
|---|---|---|
| `#@<path>` detection, Unicode-aware word boundary | ✅ | `FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu` (L17) |
| Top-level token resolution (tilde/abs/relative, no cwd restriction) | ✅ | `expandTildeAndResolve`, `cleanToken`, `extOf` |
| Text injection — whole inline when it fits remaining budget | ✅ | `injectFiles` linear loop |
| Paged delivery (§5.5) — head block + directive, surrogate-safe slice, line-derived offsets, sub-head guard | ✅ | `headSlice`, `headStartLine`, `headCompleteLineCount`, `formatPagedDirectiveBlock` |
| Image attach (resize → ImageContent) | ✅ | image branch |
| F3 magic-byte validation (mislabeled image-ext → falls through to text/binary) | ✅ | `hasValidImageMagic` |
| F5 empty-image guard (0-byte image → note block, no empty ImageContent) | ✅ | `formatEmptyImageBlock` |
| Binary (NUL) → note block | ✅ | `isBinary`, `formatBinaryBlock` |
| Missing / directory / read-error → token left verbatim, never throws | ✅ | try/catch per file |
| `#@` trigger stripped from injected markers (index-based, high→low) | ✅ | post-loop strip |
| Prior-injection dedup (two sets: `priorPaths` seeded from `<file>` blocks + `injectedThisRun`) | ✅ | `injectFiles` |
| Context budget (text-only subtraction; `getContextUsage`/`ctx.model`) | ✅ | `remainingBudget` |
| Loop prevention, steering skip, no-`#@` pre-check | ✅ | default factory handler |
| `#@` autocomplete provider (TUI/RPC, Option-1 line-rewrite reuse) | ✅ | `session_start` handler |
| Mode-aware notify (`N whole` / `N whole, M paged`) | ✅ | handler |

**External contract (must be preserved verbatim):** `injectFiles(text, imagesIn, ctx)` → `Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }>`. When `injected===0`, returns the **original `text`** and the **original `imagesIn` ref** byte-for-byte (L338). This is asserted across the test suite and must not regress.

## 2. What Does NOT Exist (the delta)

1. **No markdown support at all.** `grep -nE "MD_EXTS|injectMarkdown|computeCodeRanges|INLINE_CODE_RE|FENCE_OPEN_RE|isAbsoluteOrTilde|estimateImageTokens"` returns nothing. A delivered `.md` file is treated as plain text (injected whole / paged) and **not** scanned for further `#@` imports.
2. **`injectFiles` is a single linear loop** (`for (const m of text.matchAll(FILE_INJECT_RE))`). There is no recursion; the structure cannot inject a file's imports. The refactor to shared mutable `State` + recursive helpers (`scanTokens`, `processTokenStream`, `injectFile`, `injectMarkdown`, `emitText`, `subtract`) is the structural prerequisite (PRD §9).
3. **Budget is text-only.** Only the text-inline path (L300) and the text-paged head (L324) call `remainingBudget -= ...`. Images and binary notes do **not** subtract from the budget. PRD §5.6.2 requires **all three** types to consume the shared `remaining`.

## 3. Pi API for This Delta — VERIFIED, No New Surface Required

Source: `plan/002_0ac3eb160af7/architecture/pi_api_verification.md` (all 9 claims VERIFIED against installed v0.80.7). Re-confirmed during this scout.

| Needed by delta | API | Status |
|---|---|---|
| Markdown import file reads | `node:fs` / `node:path` (already imported) | ✅ already used |
| `#@` detection in markdown | reuses the existing `FILE_INJECT_RE` (PRD §4.2: same regex) | ✅ already in code |
| `estimateImageTokens` dimensions | `ResizedImage.width` / `.height` (both **required `number`**) | ✅ VERIFIED (pi_api_verification §8) |
| `read` tool page size for directive | `DEFAULT_MAX_LINES === 2000` | ✅ VERIFIED (§6), already pinned as `READ_LIMIT` |
| Budget shape | `ContextUsage = { tokens: number\|null; contextWindow: number; percent: number\|null }`; `getContextUsage(): ContextUsage \| undefined` | ✅ VERIFIED (§1-2); existing budget code already handles `undefined`/`null` → `null` remaining → inject-whole (O-1) |

**No new exports, no new npm dependencies.** `resizeImage`/`formatDimensionNote` already imported.

## 4. The Delta, in Three Requirements (from `delta_prd.md`)

- **MI-1 — Refactor core to shared mutable `State`** (prerequisite, **no behavior change**). Introduce `State { blocks, images, injectedSet, remaining, count, paged }`; consolidate the two dedup sets (`priorPaths` + `injectedThisRun`) into `state.injectedSet` seeded with `priorPaths`; extract `scanTokens`/`processTokenStream`/`injectFile` (text/image/binary only)/`emitText`/`subtract`. Move the text budget into `state.remaining`. **Regression gate: every existing test passes byte-for-byte.**
- **MI-2 — Markdown transitive imports + total-size budget.** Add `MD_EXTS`, `INLINE_CODE_RE`, `FENCE_OPEN_RE`, `IMAGE_FALLBACK_TOKENS`; add `isAbsoluteOrTilde`, `computeCodeRanges`, `inCode`, `estimateImageTokens`, `injectMarkdown`; wire the markdown branch into `injectFile`; make images + binary notes consume the shared budget. Adds PRD §11 cases 15–20 + markdown fixtures.
- **MI-3 — Sync README** (Mode B docs). The README is already paged-delivery-current (plan 002) but has **zero** markdown-import content.

## 5. Key Architectural Facts (encode in every relevant subtask)

1. **Dedup keys on the resolved absolute path in the scan/loop, NOT on output `<file>` blocks.** This is why paged delivery (2 blocks per path) already coexists with dedup today — it is NOT a collision. The refactor must keep this: `injectedSet` holds resolved abs paths; paged head + directive blocks are pushed freely.
2. **Recursion is bounded by dedup, not depth.** A markdown file claims its own abs in `injectedSet` *before* scanning (self-import dedups to verbatim). The set of injectable files is finite, each claimed once → guaranteed termination, no depth counter (PRD §12.13).
3. **Markdown bypasses the §5.1 NUL/binary routing** so import scanning always runs (PRD §5.6 step 1). Order in `injectFile`: empty-image (F5) → image (F3) → **markdown** → binary → text. The `MD_EXTS` check comes *before* `isBinary`.
4. **`FILE_INJECT_RE` is Unicode-aware** (`(?<![\p{L}\p{N}_])`, `u` flag) and is reused unchanged for markdown scanning. No regex change is part of this delta.
5. **Scan-before-inject at top level.** `processTokenStream` runs `scanTokens` over the whole prompt *before* injecting anything, so a later top-level token whose path an earlier import claimed is left verbatim (cross-subtree dedup). Markdown does its own scan+strip+emit+recurse in `injectMarkdown`.
6. **Budget is ONE shared `remaining`.** It is computed once and mutated in emission order (depth-first). Every block — text whole/head, image, binary note — subtracts its cost *before* the next file is decided (PRD §5.6.2).
7. **The autocomplete provider is top-level-only** and needs **no change** (PRD §14.4). Import directives are never typed in the editor; this is a doc-only clarification landing in MI-3.

## 6. Budget Mock Pattern (for the test cases)

The existing budget-aware mock (used by PD/PN paged tests):
```js
const PAGED_FIX = {
  cwd: TMPDIR,
  getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }),
  model: { contextWindow: 50000, maxTokens: 8192 },
};
// remaining = 50000 - 10000 - 8192 - 8192 = 23616; PAGED_THRESHOLD*remaining = 0.6*23616 = 14170
// huge.log (~2MB) fileCost = ceil(2097152/4)=524288 >> 14170 → PAGED; a.ts (~200 chars) fileCost≈50 << 14170 → WHOLE
```
Handler/notify tests MERGE this with `makeMockCtx`'s notify-recording `ui`/`hasUI`: `{ ...makeMockCtx(TMPDIR).ctx, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model }`. **Case 20 (shared budget across imports)** reuses this pattern: a markdown file importing several files + a `big.log`, under `PAGED_FIX`, asserting later files page against the running total.
