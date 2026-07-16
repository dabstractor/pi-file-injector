# Delta Analysis & Resolution Logic — plan/004 (Markdown Import Extension Shorthand)

## The single feature

> A markdown import whose cleaned token is **extensionless** (`path.extname(token) === ""`) resolves to
> `<exact>.md` then `<exact>.markdown` when the exact path is not an existing regular file (PRD §4.5 rule 3).
> Exact-match always wins; tokens already carrying any extension are exact-only. Dedup keys on the
> **resolved** abs. **Markdown-import-only**; top-level user-prompt tokens stay exact-match.

## `path.extname` semantics (verified against Node — the foundation of rule 3)

```
token           extname(token)   shorthand applies? (only if extname==="" AND tryMdExt)
"PRD"           ""               YES → tries PRD, PRD.md, PRD.markdown
"sub/notes"     ""               YES → tries sub/notes, sub/notes.md, sub/notes.markdown
"PRD.md"        ".md"            NO  (already extended → exact-only; never PRD.md.md)
"PRD.markdown"  ".markdown"      NO  (exact-only)
"a.ts"          ".ts"            NO  (exact-only)
"readme"        ""               YES
".bashrc"       ""               YES → tries .bashrc, .bashrc.md (harmless; .bashrc exists as exact → wins)
"README."       "."              ⚠  see note below — cleanToken runs FIRST
"a.b.md"        ".md"            NO  (exact-only; multi-dot → last ext wins)
"~/notes"       ""               YES (but markdown imports are relative-only → ~/ rejected before this)
"/abs/x"        ""               YES (but markdown imports are relative-only → / rejected before this)
```

> **⚠ `README.` edge:** `path.extname("README.") === "."` (a lone trailing dot). The shorthand check
> `path.extname(token) === ""` would be FALSE for `"."`, so shorthand would NOT apply. **But `cleanToken`
> runs first** (§4.3) and strips trailing `.` (it's in `TRAILING_PUNCT`), so the token reaching
> `resolveImportPath` is `README` (extname `""`) → shorthand applies. This is correct and requires NO
> special handling. (delta PRD §7 Risk #2 documents this.) `path.extname(token)` in `resolveImportPath`
> operates on the **cleaned** token, after `cleanToken`.

## `resolveImportPath` resolution order (the contract)

```
resolveImportPath(token, baseDir, tryMdExt):
  1. abs = expandTildeAndResolve(token, baseDir)   // ~ expand + path.resolve(baseDir, …)
  2. if isRegularFile(abs) → return abs            // EXACT MATCH ALWAYS WINS
  3. if tryMdExt && path.extname(token) === "":    // extensionless + markdown-import-only
       if isRegularFile(abs + ".md")       → return abs + ".md"
       if isRegularFile(abs + ".markdown") → return abs + ".markdown"
  4. return null                                    // nothing resolved → caller leaves verbatim
```

`isRegularFile(p)` = `try { return (await fs.stat(p)).isFile(); } catch { return false; }`
(missing / dir / unreadable / non-regular all → false). This mirrors `injectFile`'s own stat+isFile gate
and the existing Step-3.5 pre-check, so all three agree on "is this an injectable regular file".

## Decision matrix (token → behavior)

| Context | Token | Exact file exists? | Result |
|---|---|---|---|
| top-level (`tryMdExt:false`) | `PRD` | no | verbatim (top-level is exact-only) — **case 24** |
| top-level (`tryMdExt:false`) | `PRD.md` | yes | injected (exact) |
| markdown import (`tryMdExt:true`) | `api` | no, `api.md` yes | → `api.md` injected — **case 21** |
| markdown import (`tryMdExt:true`) | `readme` | YES (bare) | → bare `readme` injected (exact wins, `readme.md` NOT tried) — **case 22** |
| markdown import (`tryMdExt:true`) | `api` | no, `api.markdown` yes (only) | → `api.markdown` injected — **case 23** |
| markdown import (`tryMdExt:true`) | `ghost` | no, no `.md`/`.markdown` | verbatim — **EDG-1** |
| markdown import (`tryMdExt:true`) | `PRD.md` | no (missing) | verbatim (exact-only, never `PRD.md.md`) — **EDG-2** |
| markdown import (`tryMdExt:true`) | `PRD` + `PRD.md` (same file, both in one md) | `PRD.md` yes | injected **once** (dedup on resolved abs); 2nd marker verbatim — **EDG-3** |
| markdown import (`tryMdExt:true`) | `sub/notes` | no, `sub/notes.md` yes | → `sub/notes.md` injected — **EDG-4** |

## Why `scanTokens` must become async

Today `scanTokens` resolves a token to an abs with `expandTildeAndResolve` (pure string math, no I/O).
The shorthand needs to **stat candidate paths** (`exact`, `exact.md`, `exact.markdown`) to pick the winner,
which is I/O. Therefore:

1. `scanTokens` → `async`, returns `Promise<{index;abs}[]>`.
2. Both call sites (`processTokenStream` L431, `injectMarkdown` L600) are already inside `async`
   functions → add `await`. (Handler at top is already `async`.)
3. Dedup (`injectedSet`/`localSeen`) now keys on the **resolved** abs — the one `resolveImportPath`
   returned. This is what makes `#@PRD` + `#@PRD.md` collapse to one injection (both resolve to the same
   `/…/PRD.md`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Making `scanTokens` async breaks a call site that doesn't `await`. | Only 2 call sites; both already async. Grep-verified (L431, L600). Add `await`; full suite is the gate. |
| `path.extname` on trailing-dot token. | `cleanToken` strips trailing `.` first (it's in TRAILING_PUNCT); `resolveImportPath` sees the cleaned token. No special handling (delta PRD §7). |
| Step-3.5 pre-check in `injectMarkdown` now redundant — could it mask a bug? | It stays harmless (defense in depth). `resolveImportPath` guarantees existence; Step 3.5 re-stats and always passes for valid records. Leave it; don't remove. |
| Top-level regression: scan now stats during scan vs injectFile during injection. | Observably identical — resolved-indices for `#@` stripping depend only on files that exist as regular files, which both the new scan-time stat and injectFile's stat agree on. Cases 1–20 + edges are the regression gate. |
| Performance: extra stats (exact + possibly .md + .markdown) per markdown import. | Negligible (markdown imports are a handful of files; each stat is microseconds). Top-level stays 1 stat per token. |

## Test fixtures to add (in `buildFixtures`/module scope, real `fs` in TMPDIR)

| Fixture | Purpose |
|---|---|
| `notesShorthand.md` (imports `#@api`), reuse existing top-level `api.md` | case 21 (`.md` shorthand) |
| `readme` (bare, NO extension) AND `readme.md` both exist | case 22 (exact-beats-shorthand) + a `notesExactWins.md` importing `#@readme` |
| `sub/ext/notes.md` (imports `#@api`) + `sub/ext/api.markdown` (ONLY, no `.md`) | case 23 (`.markdown`-only; dedicated dir avoids collision with top-level `api.md`) |
| `sub/ext/notesPath.md` (imports `#@sub/notes`)? OR simpler: a md importing `#@sub/notes` | EDG-4 (shorthand with path prefix; `sub/notes.md` already exists) |
| a markdown importing `#@ghost` (no ghost/ghost.md/ghost.markdown) | EDG-1 (no-match verbatim) |
| a markdown importing `#@PRD.md` where PRD.md is missing | EDG-2 (exact-only, no `.md.md`) |
| a markdown importing BOTH `#@PRD` and `#@PRD.md` (PRD.md exists) | EDG-3 (dedup across shorthand) |
| top-level-only: `#@PRD` with only `PRD.md` present | case 24 (top-level exact-only → verbatim) |

> **Reuse where possible:** existing `api.md` (top-level) can serve case 21. The dedicated `sub/ext/` dir for
> case 23 avoids the collision the delta PRD §5 explicitly warns about.
