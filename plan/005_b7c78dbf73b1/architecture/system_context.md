# System Context — PRD v005 (`#@file` Whole-File Injection)

## Executive Summary

This is **NOT a greenfield project.** The `#@file` Pi extension is already substantially
implemented and tested. PRD v005 (`plan/005_b7c78dbf73b1`) introduces exactly **one new
feature** on top of the existing, passing implementation:

> **§4.6 — `markdownBareAtImports`: an opt-in config setting that makes a delivered
> markdown file treat a bare `@<path>` (no leading `#`) as an import**, with every rule
> that applies to `#@` imports (relative-only resolution, extension shorthand, code-exempt,
> dedup, paging, budget).

Everything else in the PRD (core `#@` injection, text/image/binary classification, paged
delivery, markdown transitive imports, extension shorthand, code-region detection, total-size
budget accounting, and the `#@` path autocomplete provider) is **already implemented, tested,
and type-checking clean**. This phase adds the config system + bare-`@` matching, then verifies
the whole PRD and syncs docs.

---

## Current Implementation State (VERIFIED — 2025-07-16)

| Artifact | Path | State |
|---|---|---|
| Extension source | `file-injector.ts` (879 lines) | ✅ Complete except §4.6 |
| Test harness | `file-injector.test.mjs` (1753 lines) | ✅ **92 passed, 0 failed** |
| Type-check | `scripts/typecheck.mjs` → `tsc --strict` | ✅ **0 errors** |
| Package manifest | `package.json` (`"pi": { "extensions": [...] }`) | ✅ Present |
| README | `README.md` | ✅ Documents all features except bare-@ |
| tsconfig | `tsconfig.json` (editor/LSP hints only) | ✅ Present |

### What is ALREADY implemented (do NOT re-plan)

1. **`input` event handler** — short-circuits on `source==="extension"`, `streamingBehavior==="steer"`,
   and `!text.includes("#@")`; calls `injectFiles`; mode-aware notify (`N whole` / `N whole, M paged`).
2. **Token detection** — `FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu` (Unicode-aware; an
   intentional improvement over the PRD §4.2 `(?<=\W)` form — the README documents that
   `café#@x`, `Öster#@x`, `日本語#@x` do not match).
3. **Token cleanup** — `cleanToken` trims `TRAILING_PUNCT` repeatedly.
4. **Path resolution** — `expandTildeAndResolve` (tilde + `path.resolve(cwd)`); `resolveImportPath`
   (exact → `.md` → `.markdown` extension shorthand for markdown imports, §4.5 rule 3).
5. **File-type handling** — text / image (`resizeImage` + `formatDimensionNote`) / binary (NUL-note) /
   **empty-image (F5)** / missing-directory (verbatim). Adds `hasValidImageMagic` (F3 magic-number
   sniff — an improvement over PRD §5.2's extension-only check, so a text file named `.png` is
   injected as text, not attached as a broken image).
6. **Paged delivery (§5.5)** — `emitText` inline-vs-paged decision against a shared `remaining` budget;
   sub-head guard; `headSlice` surrogate-safe; `headStartLine`/`headCompleteLineCount` derive the
   directive offset from the ACTUAL line count (not a hardcoded 2001).
7. **Total-size budget (§5.6.2)** — single mutable `remaining` across text/image/binary/empty-image;
   `estimateImageTokens` (tile formula); `subtract`.
8. **Markdown transitive imports (§5.6)** — `injectMarkdown` six-step algorithm with a **Step 3.5
   existence pre-check** (an improvement over the PRD §9 pseudocode: a markdown import resolving to
   a missing file/directory is left verbatim rather than stripped). Dedup-bounded recursion.
9. **Code-region detection (§5.6.1)** — `computeCodeRanges` (strict-CommonMark close: trailing-content
   fence does not close; unterminated fence → EOF) + `inCode` binary search.
10. **`#@` path autocomplete (§14)** — `session_start` registers an `addAutocompleteProvider` that
    rewrites `#@<partial>` → `@<partial>` (line-rewrite reuse, Option 1), delegates to the built-in,
    remaps results back. Headless print/json guarded.

### What is NOT yet implemented (the delta — the focus of this plan)

**§4.6 `markdownBareAtImports`** — confirmed absent via grep (zero matches for `BARE_AT_RE`,
`markdownBareAtImports`, `readConfig`, `CONFIG_DIR_NAME`, `getAgentDir`, `FileInjectorConfig`,
`prefixLen`, `bareAt` in `file-injector.ts`). This requires:

- A config system (`file-injector.json`, global + project-if-trusted).
- `BARE_AT_RE` + `prefixLen` plumbing through `scanTokens` → `injectMarkdown`.
- `session_start` config loading (the handler currently only registers autocomplete).

See `codebase_delta.md` for the precise per-function change set.

---

## Architecture (how the existing code is structured)

```
factory(pi)
 ├─ pi.on("input", (event, ctx) => …)
 │     short-circuits → injectFiles(text, images, ctx)
 │       ├─ State { blocks, images, injectedSet, remaining, count, paged }
 │       ├─ processTokenStream(text, cwd, {allowAbsTilde,skipCode,tryMdExt}, state, ctx)
 │       │     └─ scanTokens(text, baseDir, opts, state)   ← ASYNC (stats candidate paths)
 │       │     └─ injectFile(abs, state, ctx) per record   ← stat→claim→classify→emit→count
 │       │           └─ injectMarkdown(abs, content, state, ctx)  [if .md/.markdown]
 │       │                 ├─ scanTokens (relative-only, skipCode, tryMdExt)
 │       │                 ├─ Step 3.5 existence pre-check → injectable[]
 │       │                 ├─ strip '#@' (high→low) → stripped content
 │       │                 ├─ emitText(abs, stripped, state)
 │       │                 └─ recurse injectFile per injectable import (pre-order DFS)
 │       ├─ strip '#@' from resolved top-level markers
 │       └─ return { text, images, injected, paged }
 │     → { action: "transform" | "continue" }
 └─ pi.on("session_start", (_e, ctx) => …)
       └─ addAutocompleteProvider(line-rewrite reuse)   ← TUI/RPC only; headless guard
```

**Key invariants the delta must preserve:**
- `injectFiles` is a pure, exported, standalone function (no module-state reads) — it creates and
  owns `State`. Tests call it directly. The `bareAt` flag must reach `State` (via a param or a
  module-level `cfg` read by the handler; the test harness exercises both the handler and
  `injectFiles` directly).
- `scanTokens` is **async** (it stats candidate paths during resolution) and is the single choke
  point for ALL `#@`/bare-`@` detection — top-level prompt AND markdown content.
- Dedup keys on the **resolved absolute path** in `state.injectedSet` (seeded with prior `<file>`
  blocks). Recursion is dedup-bounded, not depth-limited.
- The pipeline **never throws** — every `stat`/`readFile`/`resizeImage` is in try/catch; failures
  leave the token verbatim.

## Extension load & test mechanism

- **Compilation:** `jiti` transpiles `file-injector.ts` on load (no build step). Pi aliases its own
  packages so extensions import `@earendil-works/pi-coding-agent` / `@earendil-works/pi-ai`.
- **Test harness:** `file-injector.test.mjs` is a zero-dependency Node ESM script. It resolves the
  global pi package (`npm root -g`), builds a `jiti` with Pi's alias map, imports the real
  `file-injector.ts`, runs named assertions via a tiny `assert`/`runCase` harness, prints a matrix,
  and exits 0/1. The mock ctx is `makeMockCtx(cwd, {hasUI})`; handlers are captured via
  `captureHandler(event)`. A module-surface completeness guard (`ASSERTED_EXPORTS`) asserts every
  shipped function is named — **a new export like `readConfig` MUST be added to it or the gate fails.**

## Risks & constraints for the delta

| Risk | Mitigation |
|---|---|
| Adding `bareAt` to `scanTokens` opts breaks the two call sites | Both call sites (top-level + markdown) updated in the same milestone; TS `--strict` catches mismatches. |
| `BARE_AT_RE` double-matches `#@file` | PRD §4.6: `BARE_AT_RE` uses `(?<=[^\w#])` so an `@` preceded by `#` is excluded. For consistency with the existing Unicode `FILE_INJECT_RE`, prefer `(?<![\p{L}\p{N}_#])` with the `u` flag (see recommendation in `codebase_delta.md`). |
| Top-level prompt accidentally matches bare `@` | Top-level scan passes `bareAt: false`; bare-`@` matching is markdown-only (§4.6). |
| Config read throws / blocks session_start | `readConfig` wraps every read in try/catch; malformed JSON → default `{}` (§4.6 "never an error"). |
| Untrusted project enables bare-@ | Project config honored **only when** `ctx.isProjectTrusted()` (§4.6). |
| `session_start` already registers autocomplete | The handler gains config loading ALONGSIDE the existing autocomplete registration (both run on the same `session_start`). |
| Module-surface test guard fails on new export | `readConfig` must be added to `ASSERTED_EXPORTS` (and possibly `FileInjectorConfig` — though it's a type). |
