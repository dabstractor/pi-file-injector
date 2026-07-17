# System Context — pi-file-injector (Session 007)

## What exists

The project is a **complete, fully-implemented** Pi extension (`file-injector.ts`, 1114 lines) that
provides `#@<path>` whole-file injection with markdown transitive imports. It was built in prior
sessions (001–006). The codebase is mature:

- **`file-injector.ts`** — the extension; implements every PRD feature (see feature checklist below).
- **`package.json`** — thin `pi` manifest (`{ "pi": { "extensions": ["file-injector.ts"] } }`).
- **3 test suites** — `file-injector.test.mjs` (122 cases), `relative-imports.test.mjs` (38 cases),
  `import-behavior.test.mjs` (22 cases) = **182 total**.
- **`validate.sh`** — 4-phase validator (tsc --strict, 3 test suites, manifest check, 11 live e2e).
- **`README.md`** — user-facing docs (install, usage, syntax, bare-@ option, limits, `#@` vs `@`).
- **`scripts/typecheck.mjs`** — resolves global pi `.d.ts`, runs `tsc --strict`.

## Feature checklist (PRD → code — ALL IMPLEMENTED)

| PRD feature | Status | Key code |
|---|---|---|
| `#@` injection via `input` event | ✅ | `FILE_INJECT_RE` + `input` handler |
| Works in all contexts (interactive, CLI, RPC) | ✅ | hooks `prompt()` via `input` event |
| Mid-word / email collision-free | ✅ | Unicode-word lookbehind in regexes |
| Trailing-punct trim | ✅ | `cleanToken` + `TRAILING_PUNCT` |
| Tilde/absolute/`../` resolve (top-level) | ✅ | `expandTildeAndResolve` |
| Text inline injection | ✅ | `emitText` whole branch |
| Paged delivery (head + read-tool directive) | ✅ | `emitText` paged branch + sub-head guard |
| Budget accounting (one shared accumulator) | ✅ | `remaining`, `subtract` |
| Image attach + magic sniff + resize | ✅ | `hasValidImageMagic`, `resizeImage` |
| Binary note (non-image NUL) | ✅ | `formatBinaryBlock` |
| Markdown transitive imports (recursive) | ✅ | `injectMarkdown` |
| Markdown relative-only + resolve-from-dirname | ✅ | `allowAbsTilde:false`, `dirname(abs)` |
| Extension shorthand (`.md`/`.markdown`) | ✅ | `resolveImportPath` `tryMdExt` |
| Code-is-escape-hatch (fenced + inline) | ✅ | `computeCodeRanges`/`inCode` |
| Dedup across whole prompt (cycles terminate) | ✅ | `injectedSet` claim-before-scan |
| Bare-`@` markdown option | ✅ | `BARE_AT_RE`, `bareAt` threading |
| Config (4 sources, trusted-only project) | ✅ | `readConfig` 4-source merge |
| Autocomplete provider (TUI) | ✅ | `addAutocompleteProvider` (line-rewrite reuse) |
| Loop prevention + steer skip + never-throw | ✅ | `input` guards; per-file try/catch |

## Session 007 delta

**The delta from session 006 is documentation-only.** A single token changed in `PRD.md:1189`
(Appendix A, Done-definition):

- **Before:** `all **24** manual test cases in §11 pass`
- **After:** `all 32 manual test cases in §11 pass`

This fix is **already applied** (commit `1ad7b19`) and requires **zero code edits**. The §11 test
matrix always had 32 rows; only the summary undercounted by 8.

## Implications for task breakdown

- No code changes to `file-injector.ts`, tests, `package.json`, or `tsconfig.json`.
- The only legitimate work is a **consistency confirmation** that the count matches the matrix.
- A regression check (run validate.sh phases 1–3) is advisable to confirm no breakage from the
  (already-applied) doc fix, but no implementation subtask can exist.
