# System Context — Delta Plan 009: Preserve Prompt Verbatim

## Project Type
**Delta/in-place edit** of an existing, working Pi TypeScript extension (`file-injector.ts`, 1412 lines).
This is NOT greenfield. Plan 008 shipped a working `#@file` injection extension. Plan 009 reverses
one decision: stop stripping `#@` markers from the user prompt and from delivered markdown content.

## Current State (Plan 008 — what exists)
- `file-injector.ts` (1412 lines): full `#@` injection extension — input handler, before_agent_start
  custom message delivery, MessageRenderer (green read lines), markdown transitive imports,
  paging/budget, config (markdownBareAtImports), autocomplete provider.
- Three test files (3600+ lines total): `file-injector.test.mjs` (2812), `relative-imports.test.mjs`
  (513), `import-behavior.test.mjs` (274).
- `README.md` (150 lines), `package.json`, `tsconfig.json`, `scripts/typecheck.mjs`.
- All tests currently GREEN and asserting STRIPPED prompts (markers removed, paths kept).

## The Delta (Plan 009)
Stop stripping `#@` markers. The prompt is never modified. Two stripping sites must be removed:

### Site 1 — Top-level prompt stripping (`injectFiles` L1225-1246)
- **Current**: `processTokenStream` returns `number[]` (resolved marker indices). `injectFiles`
  splices each index by `+2` to produce `strippedText`, returns it.
- **After**: `processTokenStream` returns `void`. `injectFiles` returns the original `text` verbatim.

### Site 2 — Markdown content stripping (`injectMarkdown` L1094-1159)
- **Current Step 3.5** (L1129-1140): stat/fs.access pre-check builds `injectable[]` of records that
  will actually deliver (gate for stripping).
- **Current Step 4** (L1145-1147): slices out `#@`/bare-`@` from content by `prefixLen`, producing
  `stripped`, then calls `emitText(abs, stripped, state)`.
- **After**: Delete Step 3.5 and Step 4. Call `emitText(abs, content, state)` on verbatim content.
  Recurse over resolved abs paths directly.

### Signature simplifications
- `scanTokens` (L856-893): return `Promise<{index, prefixLen, abs}[]>` → `Promise<string[]>`
  (resolved abs paths, encounter order). Drop `index`/`prefixLen` bookkeeping.
- `processTokenStream` (L904-919): return `Promise<number[]>` → `Promise<void>`.
  Drop the `resolved` accumulator.

### What does NOT change
- `before_agent_start` handler (L1331-1342): consumes `blocks`/`details`, not prompt text.
- `computeDetailOffsets` (L353-423): operates on `blocks`/`details` only.
- `renderInjectedMessage` (L739-825): re-parses bodies from `message.content`; verbatim markers
  inside markdown blocks are simply displayed as-is in the expanded view.
- `emitText` (L1000-1037): inline-vs-paged decision logic unchanged; runs on verbatim content.
- `injectFile` (L944-993): image/binary branches never stripped.
- All injection engine logic: regexes, `cleanToken`, `resolveImportPath`, `computeCodeRanges`/`inCode`,
  budget/paging, markdown recursion structure, dedup, config, autocomplete.

## Why (the root cause)
Pi re-feeds the **stored** user-message content on cancel/fork/`/tree`-navigate — NOT the original
typed text. If the extension strips `#@` from the stored message, re-submission finds no `#@`,
injects nothing, and files silently vanish. Preserving verbatim makes re-submission reliably
re-trigger injection.

## Test Impact (critical)
~78 stripping-related assertions across the three test files must migrate from "stripped" to
"verbatim" expectations:
- 4 exact-equality stripped prompts (`r.text === "Review a.ts"` → `r.text === "Review #@a.ts"`)
- 14 startsWith stripped checks
- 2 negative shape checks (`!includes("---")`, `!includes("<file")`)
- ~13 markdown block stripped-marker pairs (26 individual asserts)
- ~6 partial-strip assertions (Issue 2: injected stripped, deduped/failed kept)

New regression tests needed: re-open re-injection (case #42 from PRD §11).

## README Impact
- Line 41: "The `#@` trigger is stripped from each reference" → "`#@` triggers stay verbatim"
- Line 43: "the import marker is stripped from `spec.md`" → "stays in `spec.md` verbatim"
- Line 72: "Your own message shows only what you typed" — needs review for consistency

## Architecture Constraints
- Tests load via jiti from the **global** pi package (`npm root -g`). Environment must have it.
- `npm test` chains all three test files with `&&`.
- `scripts/typecheck.mjs` runs `tsc --strict` (TS 5.6) against the global pi type defs.
- The extension is a single-file TS module with zero npm runtime dependencies beyond Pi's packages.