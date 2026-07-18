# System Context — Bugfix 001_a4cee0dcf39c (`#@file` extension)

## What this changeset touches

A **single-file TypeScript Pi extension**, `file-injector.ts` (1288 lines, repo root), plus three
standalone zero-dependency `.mjs` test harnesses and `package.json` / `README.md`. No build step —
Pi loads the `.ts` directly via jiti. The PRD for this changeset is the **Bug Fix Requirements**
document (4 issues from an end-to-end QA pass).

**Bug reproduction status — ALL CONFIRMED against live code (loaded via jiti, the same mechanism
the test suite uses):**

| Issue | Severity | Reproduced? | File:Lines | PRD ref |
|---|---|---|---|---|
| 1. `resolveImportPath` truncation injects WRONG file | **Major** | ✅ `resolveImportPath("report.md.backup")` → `report.md`; `injectFiles` injects 1 (expect 0) and strips `#@` | `file-injector.ts:150-152` | §4.4, §4.5 |
| 2. `FileDetail.body` duplicates bytes (§12.22) | Minor | ✅ `details[0].body` (4020 B) == content bytes | `file-injector.ts:884,908,916` | §6.2, §12.22 |
| 3. Paged expanded view omits directive (§6.3) | Minor | ✅ paged detail has no `directive` field; `body`=head only | `file-injector.ts:665,916` | §6.3 |
| 4. Image magic sniff rejects valid image ≠ ext | Minor (deliberate) | ✅ documented in README; PRD §5.2 is extension-only | `file-injector.ts:62-90,832` | §5.2 |

---

## Architecture / data-flow (the resolution & delivery pipeline)

```
injectFiles (top-level, tryMdExt:false)            [file-injector.ts:1101]
  └─ processTokenStream(opts)                      [line 789]
       └─ scanTokens(opts)                         [line 734]
            └─ for each #@/@ match:
                 ├─ cleanToken(c.token)            [line 757]  — strip TRAILING_PUNCT
                 └─ resolveImportPath(token, baseDir, opts.tryMdExt)   [line 760]  ← ONLY call site
                      ├─ candidates = [token, extCut?]              [lines 150-152]  ← ISSUE 1
                      └─ for each cand: expandTildeAndResolve → isRegularFile → return abs

injectFile (per resolved abs)                      [line 811]
  ├─ image branch (mime && hasValidImageMagic)     [line 832]    ← ISSUE 4
  ├─ markdown branch → injectMarkdown(abs,...)     [line 845]
  │     └─ scanTokens(content, dir, {tryMdExt:true}) [line 982]   ← ISSUE 1 also bites here
  ├─ binary branch                                  [line 848]
  └─ emitText(abs, content, state)                  [line 856]    ← ISSUE 2 (body push)

emitText                                            [line 878]
  ├─ inline whole → push block + {kind:"text", body:content}     [line 884]  ← ISSUE 2
  ├─ sub-head whole → push block + {kind:"text", body:content}   [line 908]
  └─ paged → push head block + directive block + {kind:"paged", body:head}  [line 914-916]  ← ISSUE 2+3

renderInjectedMessage(message, {expanded}, theme)   [line 631]
  └─ expanded branch: body = d.body ?? bodies[i]    [line 665]    ← ISSUE 3 (paged: head only, no directive)
```

## Test harness architecture (CRITICAL for planning)

- **`npm test`** runs ONLY `file-injector.test.mjs` (package.json line 9).
- `import-behavior.test.mjs` and `relative-imports.test.mjs` are **standalone scripts NOT wired
  into `npm test`** — they must be invoked manually (`node ./import-behavior.test.mjs`).
- All three share an identical zero-dependency pattern: resolve global pi via `npm root -g`, load
  jiti from inside it, `jiti.import` the real `./file-injector.ts`, run named `runCase`/`test`
  assertions, tally pass/fail, `process.exit(failed ? 1 : 0)`.
- `injectFiles(prompt, images, ctx, bareAt?)` is the public API exercised by tests. `resolveImportPath`,
  `emitText`, `renderInjectedMessage`, `cleanToken`, `hasValidImageMagic` are all `export`ed and
  unit-testable directly.
- **Mock ctx shape** (from `import-behavior.test.mjs:36`): `{ cwd, hasUI:false, isProjectTrusted:()=>true,
  ui:{ notify:()=>{} } }`. Paged-path tests add `getContextUsage` + `model` (`file-injector.test.mjs:412`).

## Key PRD contracts (verified against PRD.md)

- **§4.4 (line 227):** top-level user tokens are **exact-match only** — `#@PRD` with no bare `PRD`
  is left verbatim (no `.md` fallback).
- **§4.5 rule 3 (line 237):** markdown shorthand ONLY when `path.extname(token) === ""`;
  "tokens already ending in `.md`/`.markdown` **or any other extension** are exact-only".
- **§5.2 (lines 294-314):** image classification is purely by extension table → resize → attach.
  No magic-byte validation step in the PRD.
- **§6.2 (line 479):** "the **bytes** live in `content`...never duplicated into the model input."
- **§6.3 (line 507-508):** "Paged files show their head block **plus the paged-directive text
  verbatim**" in the expanded view.
- **§12.22 (line 1327):** "Do **not** duplicate file bytes into `details` — the renderer re-parses
  them from `content` (§6.3 `FILE_BLOCK_RE`), keeping `details` cheap and the model input
  uncontaminated."

## Decisions encoded in this plan

- **Issue 1 fix = PRD option 2** (narrow truncation to trailing markdown-formatting chars `*`/`_`
  only, NOT `.md` truncation). Preserves the GROUP-4a–4d italic/bold formatting cases the
  `import-behavior.test.mjs` GROUP-4 suite is designed to protect, while eliminating `.bak`/`.txt`/
  `.old`/`/foo` false positives. See `issue1_resolveimportpath.md`.
- **Issue 2 fix = PRD option (a)** (store offset+length into `content` instead of the body string).
  Preserves the BUG-1 correctness fix (nested `</file>`) while satisfying §12.22. See
  `issue2_3_filedetail_renderer.md`.
- **Issue 3 fix** = store the paged-directive text in the detail and render it after the head when
  expanded. See `issue2_3_filedetail_renderer.md`.
- **Issue 4 fix** = no code change; the README's stricter magic-byte contract is accepted as
  intentional. The PRD §5.2 wording stays as-is (the PRD is read-only). Documentation-only note.

## Files in this changeset (planning scope)

- `file-injector.ts` — the only source file (Issues 1, 2, 3).
- `file-injector.test.mjs` — primary `npm test` gate; add regression cases for Issues 1, 2, 3.
- `import-behavior.test.mjs` — fix test 4f to assert PRD-compliant outcome; wire into `npm test`.
- `relative-imports.test.mjs` — wire into `npm test` (no behavior change needed).
- `package.json` — update the `test` script to run all three harnesses.
- `README.md` — changeset-level doc sync (Issue 4 note + any behavior changes).
- `docs/` — none exist; per-feature docs ride with the implementing subtasks (Mode A).
