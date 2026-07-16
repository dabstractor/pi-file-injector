# Research Notes — P1.M1.T1.S1 (plan/004): resolveImportPath + isRegularFile, async scanTokens, tryMdExt wiring

## Mission
Add markdown import **extension shorthand** (PRD §4.5 rule 3): inside a markdown file, an extensionless
`#@<token>` resolves to `<token>.md` (then `.markdown`) when the exact path is not an existing regular file.
This subtask implements the **resolution core** (no acceptance cases yet — those are T1.S2): two new
exported helpers (`resolveImportPath`, `isRegularFile`), `scanTokens` becomes `async` with a new
`opts.tryMdExt`, `tryMdExt` is threaded through `processTokenStream` and wired at the two call sites
(top-level `false`, markdown `true`). **Top-level behavior stays exact-only (byte-for-byte identical).**

## Baseline (MUST stay green)
- `node ./file-injector.test.mjs` → **77 passed, 0 failed.**
- `npm run typecheck` → **"file-injector.ts type-checks clean under --strict (0 errors)".**

## Current landmarks (file-injector.ts, 831 lines — line numbers verified 2025-07-16)
- L84–94  : `export function expandTildeAndResolve(p, cwd)` — REUSED UNCHANGED (pure: `~`/`~/` expand + `path.resolve`). Still called directly by test L659 (legacy helper) — do NOT touch.
- L389–413: `export function scanTokens(text, baseDir, opts, state): {index,abs}[]` — currently SYNC; opts `{allowAbsTilde,skipCode}`; resolves via `expandTildeAndResolve` (NO stat) at L406; dedup `state.injectedSet.has(abs) || localSeen.has(abs)` on the unresolved abs.
- L424–449: `async function processTokenStream(...)` — opts `{allowAbsTilde,skipCode}`; L431 `const records = scanTokens(text, baseDir, opts, state);` (NO await — currently sync).
- L452–470: `export async function injectFile(abs, state, ctx)` — the stat+isFile idiom to mirror in isRegularFile: `try { st = await fs.stat(abs); } catch { return false; } if (!st.isFile()) return false;`
- L593–642: `async function injectMarkdown(abs, content, state, ctx)` — L600 `const records = scanTokens(content, dir, { allowAbsTilde:false, skipCode:true }, state);`; L606–622 = **Step 3.5 existence pre-check** (stats each record, keeps only isFile ones in `injectable`). LEAVE UNCHANGED (becomes redundant-but-harmless; defense-in-depth).
- L639–… : `export async function injectFiles(...)` — L699 `const resolvedIdx = await processTokenStream(text, ctx.cwd, { allowAbsTilde:true, skipCode:false }, state, ctx);`
- `resolveImportPath` / `isRegularFile` / `tryMdExt` — grep-confirmed ABSENT pre-delta.

## Call-site audit (exhaustive — only these runtime sites exist)
| Function | Runtime call sites | Notes |
|---|---|---|
| `scanTokens` | 2 — L431 (processTokenStream), L600 (injectMarkdown) | Both already inside `async` fns → safe to `await`. |
| `processTokenStream` | 1 — L699 (injectFiles) | Already awaited. |
| `expandTildeAndResolve` | 1 production (L406, will move inside resolveImportPath) + 1 test (L659, unchanged) | test L659 stays. |
| `resolveImportPath` / `isRegularFile` | 0 pre-delta | New; called only from scanTokens / resolveImportPath. |
JSDoc mentions at L238, L568 are docs, not calls.

## path.extname semantics — VERIFIED (node one-liner)
```
"PRD"           => ""    ← shorthand applies
"sub/notes"     => ""    ← applies WITH a path prefix
"PRD.md"        => ".md" ← exact-only (never PRD.md.md)
"README."       => "."   BUT cleanToken strips trailing '.' first → resolveImportPath sees "README" → "" → shorthand applies
".env"          => ""    ← technically qualifies, BUT exact-match-wins returns .env before the .md fallback
".bashrc"       => ""    ← same as .env
"notes.markdown"=> ".markdown" ← exact-only
```
**Implementer decision (external_deps.md Note B):** follow PRD §4.5 LITERALLY — `path.extname(token) === ""`.
Do NOT add a dotfile exclusion (would diverge from spec; exact-wins already makes `.env` safe).

## The exact new helpers (place after expandTildeAndResolve, ~L94) — exported
```ts
export async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);     // reuse (tilde + resolve) — NO stat
  if (await isRegularFile(abs)) return abs;              // EXACT MATCH ALWAYS WINS
  if (tryMdExt && path.extname(token) === "") {          // extensionless shorthand ONLY (PRD §4.5 rule 3)
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;
}
export async function isRegularFile(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isFile(); } catch { return false; }   // mirrors injectFile L458–461
}
```

## scanTokens delta (L389–413)
```diff
- export function scanTokens(
+ export async function scanTokens(
    text, baseDir,
-   opts: { allowAbsTilde: boolean; skipCode: boolean },
+   opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean },
    state: State,
- ): { index: number; abs: string }[] {
+ ): Promise<{ index: number; abs: string }[]> {
    ...
-   const abs = expandTildeAndResolve(token, baseDir);     // L406 — NO stat
+   const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // stats; .md/.markdown fallback
+   if (!abs) continue;                                    // nothing resolved → leave verbatim
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue; // dedup on RESOLVED abs
```
`typeof asyncFunction === "function"` is true → test sanity `typeof mod.scanTokens === "function"` stays valid.

## processTokenStream delta (L424–431)
- opts type gains `tryMdExt: boolean`.
- L431: `const records = scanTokens(...)` → `const records = await scanTokens(text, baseDir, opts, state);` (opts already carries tryMdExt through).

## Call-site wiring
- Top-level (injectFiles L699): add `tryMdExt: false` → `{ allowAbsTilde: true, skipCode: false, tryMdExt: false }`. (EXACT-MATCH preserved → top-level byte-for-byte identical.)
- Markdown (injectMarkdown L600): `scanTokens(content, dir, { allowAbsTilde:false, skipCode:true }, state)` → `await scanTokens(content, dir, { allowAbsTilde:false, skipCode:true, tryMdExt:true }, state)`.
- Step-3.5 (L606–622): UNCHANGED. resolveImportPath now guarantees each record is an existing regular file, so the pre-check always passes — redundant-but-harmless, kept as defense-in-depth for the §10 verbatim-on-missing invariant. Do NOT delete.

## Why gate 1 (full suite byte-for-byte green) holds
The ONLY behavioral delta is that resolution now stats during scan (resolveImportPath) instead of during
injection (injectFile) — observably identical:
- **Top-level missing/dir (cases 5,6):** before — scanTokens records, injectFile re-stats → false → verbatim; after — resolveImportPath stats → null → not recorded → verbatim. Identical. (Case 5 still returns ORIGINAL `imagesIn` ref.)
- **Markdown missing import (MD1 `#@ghost.md`):** before — Step-3.5 stats ghost.md → throws → dropped from `injectable` → marker NOT stripped (verbatim); after — resolveImportPath → null → not recorded → not in `injectable` → marker NOT stripped (verbatim). Identical. injected===1 both ways.
- **Dedup-on-resolved-abs (NEW, markdown-only):** `#@PRD` + `#@PRD.md` in one file now collapse (both resolve to PRD.md → same abs → localSeen dedup). No existing case has both forms → existing suite unaffected.
- Scan phase still pure re: injectedSet (resolveImportPath only stats, never mutates state) → scan-then-inject separation preserved.

## Test-file changes (file-injector.test.mjs) — T1.S1 DOES modify the test file
1. **Sanity list (L113–128):** add two `assert(typeof mod.X === "function", …)` lines for `resolveImportPath` + `isRegularFile`.
2. **COMPLETENESS guard (L139–141 `ASSERTED_EXPORTS` Set):** add `"resolveImportPath"` + `"isRegularFile"` — else the guard throws "module ships functions not in the sanity list" at load (gate 3 HARD FAIL).
3. **Fixtures (`buildFixtures` ~L194–233):** add the shorthand fixtures: a bare `README` + `README.md`; `PRD.md` (no bare PRD); `only.markdown`; a bare `.env` (dotfile). Follow the existing `fsSync.writeFileSync(path.join(TMPDIR, …), …)` pattern + path constants near L260–281.
4. **New runCase blocks (append before the "10. Summary" block at the tail):** TDD unit tests — see PRP Task 6.

## TDD unit tests required (item §6 DoD) — write FIRST, then implement
`mod.resolveImportPath(token, baseDir, tryMdExt)` directly against TMPDIR fixtures (async):
1. **exact-wins over .md** — bare `README` + `README.md` both exist → `resolveImportPath("README", dir, true)` === `<dir>/README`.
2. **.md fallback when exact missing** — only `PRD.md` → `resolveImportPath("PRD", dir, true)` === `<dir>/PRD.md`.
3. **.markdown fallback when only .markdown exists** — only `only.markdown` → `resolveImportPath("only", dir, true)` === `<dir>/only.markdown`.
4. **no-match → null** — `resolveImportPath("nope", dir, true)` === null.
5. **dotfile `.env` exact-wins, no .env.md tried** — bare `.env` exists → `resolveImportPath(".env", dir, true)` === `<dir>/.env` (NOT `<dir>/.env.md`).
6. **top-level tryMdExt:false is exact-only** — only `PRD.md` present → `resolveImportPath("PRD", dir, false)` === null.
7. **scanTokens now returns a Promise** — `mod.scanTokens("text", TMPDIR, {allowAbsTilde:true,skipCode:false,tryMdExt:false}, {blocks:[],images:[],injectedSet:new Set(),remaining:null,count:0,paged:0}) instanceof Promise` (and `await` it resolves to an array). State is a TS interface (erased at runtime) so a plain object literal works in the .mjs test.

## Gates (item §6)
1. `node ./file-injector.test.mjs` → existing 77 + new unit tests all PASS (existing 77 byte-for-byte green).
2. `npm run typecheck` → 0 errors under --strict (async signature change must satisfy compiler).
3. Sanity list + ASSERTED_EXPORTS updated for the 2 new exports.

## Scope boundary — what T1.S1 does NOT do
- ❌ PRD §11 acceptance cases 21–24 + §10 EDG-1..4 (that is T1.S2).
- ❌ README change (T2.S1).
- ❌ No new Pi APIs; no new npm deps (reuses node:fs/node:path).
- ❌ Do NOT modify expandTildeAndResolve (test L659 depends on it).
- ❌ Do NOT delete Step-3.5 (redundant-but-harmless; defense-in-depth).
- ❌ Do NOT add a dotfile exclusion to resolveImportPath (follow PRD §4.5 literally).
