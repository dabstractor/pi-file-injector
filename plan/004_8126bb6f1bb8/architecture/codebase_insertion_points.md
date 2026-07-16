# Codebase Insertion Points — plan/004 (Markdown Import Extension Shorthand)

> Exact current locations in `file-injector.ts` (831 lines) and `file-injector.test.mjs` (1501 lines).
> All line numbers verified against the working tree on 2025-07-16. Baseline: 77/77 tests green, typecheck clean.

## file-injector.ts — functions the delta touches

### 1. `expandTildeAndResolve(p, cwd)` — L84–94 — REUSED (not changed)

```ts
export function expandTildeAndResolve(p: string, cwd: string): string {
  // ~ / ~/ expand via os.homedir(), then path.resolve(cwd, …). NO stat.
}
```
- **Role:** the existing resolution primitive. Takes a token + baseDir, returns an abs path string. Does **not**
  stat. The new `resolveImportPath` calls this as its first step, then adds the stat + `.md`/`.markdown` fallback.
- **No change.** Reused verbatim by `resolveImportPath`.

### 2. `scanTokens(...)` — L389–413 — CHANGED (sync → async + `tryMdExt`)

**Current signature (sync, no tryMdExt):**
```ts
export function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean },
  state: State,
): { index: number; abs: string }[] {
  ...
  const abs = expandTildeAndResolve(token, baseDir); // L406 — NO stat, NO fallback
  if (state.injectedSet.has(abs) || localSeen.has(abs)) continue; // dedup on abs
  localSeen.add(abs);
  out.push({ index: m.index!, abs });
}
```

**Delta changes (§4.2 of delta PRD):**
1. Signature → `async function scanTokens(...)`: opts gains `tryMdExt: boolean`; return type → `Promise<{index;abs}[]>`.
2. L406: replace `const abs = expandTildeAndResolve(token, baseDir);` with
   `const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);` and add `if (!abs) continue;`
   (nothing resolved → leave verbatim).
3. Dedup (`state.injectedSet` / `localSeen`) now runs on the **resolved** abs (the one `resolveImportPath`
   returned, possibly with `.md` appended) — so `#@PRD` + `#@PRD.md` collapse to one injection.
4. Update JSDoc: now async because resolution stats candidate paths; markdown passes `tryMdExt:true`,
   top-level passes `tryMdExt:false`.

### 3. `processTokenStream(...)` — L424–449 — CHANGED (opts gain `tryMdExt`; await scanTokens)

**Current:** async, opts `{ allowAbsTilde; skipCode }`, calls `const records = scanTokens(...)` (no await).
**Delta:**
1. opts type gains `tryMdExt: boolean`.
2. L431: `const records = scanTokens(...)` → `const records = await scanTokens(text, baseDir, opts, state);`
   (pass `opts.tryMdExt` through).
3. JSDoc: note `tryMdExt` threading; shorthand is markdown-only.

### 4. `injectMarkdown(...)` — L595–642 — CHANGED (scan call gains `tryMdExt: true`; await it)

**Current Step 3 (L600):**
```ts
const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);
```
**Delta:**
1. L600 → `const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true }, state);`

### 5. Top-level call site — L699 (`injectFiles` body) — CHANGED (opts gain `tryMdExt: false`)

**Current (L699):**
```ts
const resolvedIdx = await processTokenStream(
  text, ctx.cwd, { allowAbsTilde: true, skipCode: false }, state, ctx);
```
**Delta:** add `tryMdExt: false`:
```ts
const resolvedIdx = await processTokenStream(
  text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false }, state, ctx);
```

### 6. NEW helpers — to be added near `expandTildeAndResolve` (after L94)

```ts
// §4.5 resolution: exact path first; if markdown import + extensionless token + exact not a file,
// try <exact>.md then <exact>.markdown. Returns first existing regular file, or null.
export async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);     // reuse (tilde + resolve)
  if (await isRegularFile(abs)) return abs;              // exact match wins
  if (tryMdExt && path.extname(token) === "") {          // extensionless shorthand only
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;
}
export async function isRegularFile(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isFile(); } catch { return false; }
}
```

## Call-site audit (exhaustive — only these runtime sites exist)

| Function | Runtime call sites | Notes |
|---|---|---|
| `scanTokens` | **2** — L431 (`processTokenStream`), L600 (`injectMarkdown`) | Both already inside async functions → safe to `await`. |
| `processTokenStream` | **1** — L699 (`injectFiles`) | Already awaited. |
| `expandTildeAndResolve` | **1** — L406 (inside `scanTokens`) | Will be wrapped by `resolveImportPath`; still used standalone by test sanity? **No** — only called from `scanTokens`. |
| `resolveImportPath` | 0 (absent pre-delta) | New; called from `scanTokens`. |
| `isRegularFile` | 0 (absent pre-delta) | New; called from `resolveImportPath`. |

> **No other code path calls these functions.** The two scan sites and one processTokenStream site are the
> entire blast radius. (JSDoc comments at L238, L568 mention `scanTokens`/`opts` but are documentation, not calls.)

## The Step-3.5 interaction (important — document, do not remove)

`injectMarkdown` has a **Step 3.5 existence pre-check** (L606–622): after `scanTokens` records tokens, it
stats each record and keeps only those that are existing regular files (so a missing/dir import's `#@`
marker is left **verbatim** rather than stripped in Step 4). 

**Before the delta:** `scanTokens` resolves WITHOUT statting, so Step 3.5 is the load-bearing existence check.
**After the delta:** `resolveImportPath` (called inside `scanTokens`) already stats and returns `null` for
missing/dir/non-regular — so a record in the `injectable` array only ever contains paths that exist as
regular files. **Step 3.5 becomes redundant-but-harmless** (defense in depth; one extra stat per import).
The delta PRD §4.4 says **leave it**. The implementer must understand this: do NOT delete Step 3.5 (it keeps
the §10 verbatim-on-missing invariant belt-and-suspenders and is observably harmless), but recognize that
`resolveImportPath` now guarantees existence, so the pre-check will always pass for every record.

## file-injector.test.mjs — patterns the delta tests must mirror

| Pattern | Location | Notes |
|---|---|---|
| **Module-surface sanity list** (`assert(typeof mod.X === "function")`) | **L113–128** | The gate. **MUST add `resolveImportPath` + `isRegularFile`** or the suite errors at load. Also asserts `mod.scanTokens` is a function (still true after going async). |
| `runCase(n, name, fn)` | L89 | Assertion harness: prints ✓/✗, records matrix row. New cases use this. |
| `countFileBlocks(text, abs)` | L293 | Counts `<file name="abs">` openers. |
| `FIX` context | **L271** — `const FIX = { cwd: TMPDIR }` | No budget → `remaining=null` → all whole. Markdown cases use this. |
| `PAGED_FIX` context | L300 | Tight budget for paging tests. |
| Markdown fixtures (`buildFixtures`/module scope) | **L207–233** | Existing: `notes.md`, `api.md`, `a.md`, `b.md`, `notesAbs.md`, `sub/notes.md`, `sub/api.md`, `bigdoc.md`, `parts`, `notesMissing.md`, `sub/outsider.md`, `shared/api.md`. |
| Markdown path constants | ~L260–281 (block near L282 comment) | `NOTES`, `API`, `A_MD`, `B_MD`, etc. New shorthand paths (e.g. `API_MDONLY`, `README_BARE`, `README_MD`) follow this pattern. |
| Markdown cases 15–20 + MD1/MD2 | L1333–1402 | **Template for cases 21–24 + EDG-*.** Each: `mod.injectFiles("Review #@notes.md", [], FIX)` → assert `injected`, block presence, pre-order order, marker stripped/verbatim. |
| Case 24 (top-level no fallback) needs `FIX` + only `PRD.md` present | — | Top-level `#@PRD` → verbatim, `injected===0`. |

## Verification gates

1. **Regression:** the entire existing suite (cases 1–20 + MD1/MD2 + edges + guards + F1–F5 + U1 + PD* + CC* + EIT* + BG*) stays **byte-for-byte green** (the only top-level behavior delta is that `scanTokens` now stats during scan instead of `injectFile` during injection — observably identical for existing cases).
2. **Typecheck:** `npm run typecheck` → 0 errors (async signature change must satisfy `--strict`).
3. **New cases:** 21–24 + EDG-1..4 pass.
4. **Module surface:** `resolveImportPath` and `isRegularFile` added to the L113–128 sanity list.
