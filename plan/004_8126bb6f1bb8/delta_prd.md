# Delta PRD: Markdown Import `.md`/`.markdown` Extension Shorthand

**Delta from:** plan/003 (Markdown Transitive Imports — **Complete**) · **Scope:** Single small feature on the already-shipped `#@file` extension · **Artifact:** `file-injector.ts` (+ test + README)

---

## 1. Diff Summary (what actually changed)

The entire delta between plan/003's PRD snapshot and plan/004's is **one logical feature**, threaded through ~14 PRD hunks that all describe the same thing:

> **Markdown import extension shorthand.** A `#@<path>` directive *inside* an injected markdown file may omit its `.md`/`.markdown` extension — `#@PRD` resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` file exists. This is **markdown-import-only**; top-level user-prompt tokens stay **exact-match** (the user has §14 path autocomplete and types the full name).

### PRD hunks (all the same feature)
- **§1 Solution** — adds one "Extension shorthand" sentence to the markdown-imports paragraph.
- **§2 Goal 6** — notes an import may omit its `.md`/`.markdown` extension (markdown-only, top-level exact).
- **§2 Non-Goals** — adds "**No extension shorthand at the top level.**"
- **§4.4** — adds a "No extension shorthand here" note (top-level = exact-match only).
- **§4.5** — adds rule 3 "**Extension shorthand**": extensionless token (`path.extname(token) === ""`) tries `<exact>.md` then `<exact>.markdown`; exact-match wins; `#@PRD.md` never becomes `PRD.md.md`.
- **§5.6 Step 3** — resolution now goes through `resolveImportPath(token, dirname(abs), tryMdExt=true)`; `scanTokens` becomes **async** (it stats candidate paths); dedup keys on the **resolved** abs (so `#@PRD` + `#@PRD.md` collapse to one injection).
- **§8** — adds `resolveImportPath` (exact → `.md`/`.markdown`) + `isRegularFile` to the helpers list.
- **§9 pseudocode** — adds `tryMdExt` to the opts, `async scanTokens`, and the two new helpers.
- **§10** — adds 7 edge-case rows (shorthand resolves / `.markdown`-only / exact-beats-shorthand / no-match / already-extended / dedup-across-shorthand / top-level-exact-only).
- **§11** — adds manual test cases **21–24**.
- **§12** — adds note 18 (markdown-only, keyed on resolved abs, why `scanTokens` is async).
- **§13.6** — adds "Why extension shorthand, and why markdown-only" rationale.
- **§14.4 / Appendix A** — shorthand references.

### Size assessment
**Small feature addition.** Code footprint: 2 small helpers (~12 lines), an `async` signature change on `scanTokens` + 2 call-site opts tokens (`tryMdExt: false` at top level, `tryMdExt: true` in markdown). Test footprint: ~4 fixtures + 4 acceptance cases (21–24) + ~5 edge-case rows. Doc footprint: one README bullet. **No new dependencies, no new Pi API surface, no structural refactor** (the shared-`State` recursion from plan/003 is reused as-is).

---

## 2. Goal & Non-Goals

### Goal
1. **Markdown import `.md`/`.markdown` extension shorthand.** A markdown import whose cleaned token is **extensionless** (`path.extname(token) === ""`) resolves to `<exact>.md` then `<exact>.markdown` when the exact path is not an existing regular file (§4.5 rule 3). Exact-match always wins (a bare `PRD` file beats `PRD.md`); tokens already carrying any extension are exact-only (`#@PRD.md` never becomes `PRD.md.md`). Dedup keys on the **resolved** abs.

### Non-Goals
- **No top-level shorthand.** Top-level user-prompt `#@` tokens stay exact-match (`tryMdExt: false`). `#@PRD` at the prompt with only `PRD.md` present is left verbatim (§4.4, §11 case 24).
- **No globbing / multi-file / directory reads.** Unchanged from plan/003.
- **No new config, no new paging/budget behavior, no new file-type handling.** Shorthand only changes *path resolution*; everything downstream (image/binary/text/markdown classify, paging, total-size budget, dedup, marker stripping) is reused verbatim from plan/003.

---

## 3. Context (prior work this builds on — do NOT redo)

Plan/003 **completed** the full markdown transitive-import feature (§5.6) on the shared mutable `State` + recursive core. This delta reuses it unchanged:
- `scanTokens(text, baseDir, { allowAbsTilde, skipCode }, state)` — currently **synchronous**; uses `expandTildeAndResolve(token, baseDir)` (no stat); records `{ index, abs }` per resolved token; per-text `localSeen` + global `state.injectedSet` dedup. *(file-injector.ts L389–422)*
- `processTokenStream(...)` — already `async`; calls `scanTokens` then `await injectFile(...)` per record; returns resolved indices for `#@` stripping. *(L424–449)*
- `injectMarkdown(abs, content, state, ctx)` — six-step recursion; calls `scanTokens(content, dir, { allowAbsTilde:false, skipCode:true }, state)`; has a **Step 3.5 existence pre-check** that stats each record before stripping (a plan/003 validator fix). *(L593–635)*
- `injectFiles(...)` top-level call: `processTokenStream(text, ctx.cwd, { allowAbsTilde:true, skipCode:false }, state, ctx)`. *(L700)*
- `expandTildeAndResolve(p, cwd)` — `~`/`~/` expand + `path.resolve(cwd, …)`; **no stat**. *(L84–94)*
- Test sanity list at `file-injector.test.mjs` L113–128 (`assert(typeof mod.X === "function")`); markdown fixtures + path constants at L207–281; markdown cases 15–20 at L1333–1402; `runCase(N, …)` helper pattern + `countFileBlocks`.

**Research to reuse:** `plan/003_4624515bcd82/architecture/codebase_insertion_points.md` (§5.6 insertion points, the test-sanity-list rule, fixture patterns) and `system_context.md` (dedup keys on abs path). **No new architecture research is needed** — the change is localized to resolution.

---

## 4. Implementation Contract

The whole feature is: resolution now stats, and markdown-import scans additionally try `.md`/`.markdown` for extensionless tokens.

### 4.1 New helpers (export both; add to the test sanity list)

```ts
// §4.5 resolution: exact path first; if markdown import + extensionless token + exact not a file,
// try <exact>.md then <exact>.markdown. Returns the first existing regular file, or null.
export async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);     // reuse existing helper (tilde + resolve)
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
- `path.extname(token)` runs on the **cleaned** token (after `cleanToken`), so `#@PRD` → `""`, `#@sub/notes` → `""` (shorthand applies, tries `sub/notes.md`), `#@PRD.md` → `".md"` (exact-only), `#@a.ts` → `".ts"` (exact-only). This matches §4.5 rule 3 exactly.
- `isRegularFile` mirrors the existing `injectFile`/Step-3.5 stat-+-isFile-+-try/catch-false pattern.

### 4.2 `scanTokens` becomes async + gains `tryMdExt`

- Change signature to `async function scanTokens(text, baseDir, opts: { allowAbsTilde; skipCode; tryMdExt }, state): Promise<{ index; abs }[]>`.
- Replace the resolution line `const abs = expandTildeAndResolve(token, baseDir);` with `const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);` and **add `if (!abs) continue;`** (nothing resolved → leave verbatim). Dedup (`state.injectedSet` / `localSeen`) now runs on the **resolved** abs — so `#@PRD` and `#@PRD.md` in the same file collapse to one injection (§5.6 Step 3, §12 note 18).
- Propagate `await`: `processTokenStream` → `await scanTokens(...)`; `injectMarkdown` → `await scanTokens(...)`. (`processTokenStream` is already `async`; `injectMarkdown` is already `async`.)
- Update the `scanTokens` JSDoc to note it is now async *because resolution stats candidate paths*, and that markdown passes `tryMdExt:true` while top-level passes `tryMdExt:false`.

### 4.3 Wire the opts through the two call sites

- **Top level** (`injectFiles` → `processTokenStream`): add `tryMdExt: false` → `{ allowAbsTilde: true, skipCode: false, tryMdExt: false }`. (Behavior-preserving: `tryMdExt:false` makes `resolveImportPath` exact-only, identical to today's `expandTildeAndResolve` — except it now also stats, which is harmless because `injectFile` re-stats anyway and `resolved` only keeps stat-succeeding tokens.)
- **Markdown** (`injectMarkdown` Step 3): add `tryMdExt: true` → `{ allowAbsTilde: false, skipCode: true, tryMdExt: true }`.
- `processTokenStream`'s opts type gains `tryMdExt: boolean`; pass it through to `scanTokens`.

### 4.4 Notes on existing behavior (no change needed — verify it stays green)
- **Step 3.5 existence pre-check** in `injectMarkdown`: `resolveImportPath` already guarantees the returned abs is an existing regular file, so Step 3.5's stat is now **redundant-but-harmless** (defense in depth). Leave it; it costs one extra stat per import and keeps the §10 verbatim-on-missing invariant belt-and-suspenders. (If a `#@PRD` shorthand resolves to `PRD.md` which exists, Step 3.5 passes; if nothing resolves, `resolveImportPath` returns `null` and the token never reaches Step 3.5 — left verbatim. Either way correct.)
- **Top-level regression gate:** the existing 14 + markdown (15–20) + edge/guard suite (1044+ lines) must stay byte-for-byte green. The only top-level behavior delta is that `scanTokens` now stats during the scan instead of `injectFile` statting during injection — observably identical (resolved-indices for `#@` stripping depend only on files that exist, which both paths agree on).

---

## 5. Acceptance — PRD §11 cases 21–24 + §10 edges

New fixtures in `buildFixtures()` (real `fs` in `TMPDIR`, same pattern as existing markdown fixtures):
- `api_mdonly.md` absent, `api.md` exists already → reuse for shorthand; **add** `api.markdown`? No — for case 23 (`.markdown`-only) add a dedicated dir/file so it doesn't collide with the existing top-level `api.md`. Suggested: `sub/ext/` with `api.markdown` (only), and a `sub/ext/notes.md` importing `#@api`.
- `readme` (bare, **no** extension) **and** `readme.md` both exist → exact-beats-shorthand (case 22).
- `#@PRD` with no `PRD`/`PRD.md`/`PRD.markdown` → no-match, verbatim.
- A markdown importing both `#@PRD` and `#@PRD.md` → dedup across shorthand.
- Top-level `#@PRD` with only `PRD.md` → verbatim (case 24).

New `runCase` assertions (FIX ctx, no budget → all whole), mirroring cases 15–19's style:
| # | Setup | Assert |
|---|---|---|
| 21 | `notesShorthand.md` imports `#@api` (`api.md` exists); `#@notesShorthand.md` | `api.md` block present, marker stripped to `api` (not `#@api`), `injected===2`. |
| 22 | `notesExactWins.md` imports `#@readme` where **both** `readme` and `readme.md` exist | bare `readme` block injected, `readme.md` NOT injected, `injected===2`. |
| 23 | `sub/ext/notes.md` imports `#@api` where only `sub/ext/api.markdown` exists | resolves to `api.markdown`; block present, `injected===2`. |
| 24 | top-level `#@PRD`, only `PRD.md` exists | left **verbatim** (exact-only at top level), `injected===0`/unchanged text. |
| EDG-1 | `#@ghost` in a markdown, no `ghost`/`ghost.md`/`ghost.markdown` | not resolved; `#@ghost` verbatim in the markdown block. |
| EDG-2 | `#@PRD.md` in a markdown, `PRD.md` missing | exact-only (no `PRD.md.md`); `#@PRD.md` verbatim. |
| EDG-3 | markdown imports `#@PRD` **and** `#@PRD.md` (same file, `PRD.md` exists) | injected **once** (dedup on resolved abs); second marker verbatim. |
| EDG-4 | `#@sub/notes` (extensionless, `sub/notes.md` exists) | resolves to `sub/notes.md`; shorthand works with a path prefix too. |

**Module-surface sync (mandatory):** add `resolveImportPath` and `isRegularFile` to the `assert(typeof mod.X === "function")` sanity list (test L113–128) — the gate fails if a newly-exported helper isn't asserted.

---

## 6. Documentation Impact

### Mode A — doc-with-work (rides with the implementation task)
- **JSDoc on `resolveImportPath`** (new): exact-first, `.md`/`.markdown` fallback for extensionless markdown-import tokens, markdown-only (`tryMdExt`), exact-wins.
- **JSDoc on `isRegularFile`** (new): stat + `isFile` + try/catch→false.
- **JSDoc on `scanTokens`** (modified): now `async` because resolution stats; `opts.tryMdExt` (markdown `true` / top-level `false`); dedup keys on resolved abs.
- **JSDoc on `processTokenStream` opts** + **`injectMarkdown` Step-3 comment** (modified): note `tryMdExt` threading and that shorthand is markdown-only.

### Mode B — changeset-level docs (final task, depends on the implementation)
- **`README.md` → "Syntax → Markdown imports" subsection:** add one bullet — *"Extension shorthand. An import may omit the `.md`/`.markdown` extension: `#@PRD` resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats `readme.md`); this is a markdown-import convenience only — at the prompt you type the full name."* Leave the four existing bullets (relative-only / code-is-escape-hatch / each-file-once / shared-budget) and the `#@`-versus-`@` and Limits sections as-is.

---

## 7. Risk & Verification

- **Risk:** making `scanTokens` async could break a call site that doesn't `await`. **Mitigation:** exactly two callers (`processTokenStream`, `injectMarkdown`); both are already `async` — add `await` to each; full suite is the gate.
- **Risk:** `path.extname` on a token with a trailing-dot-after-clean. `cleanToken` already strips trailing `.`/`:`/etc., so a cleaned `PRD.` → `PRD` (extname `""` → shorthand applies), matching §4.5. No special handling.
- **Verification:** `node ./file-injector.test.mjs` — the **entire** suite (cases 1–20 + edges + guards + F1–F5 + U1 + PD* + MD1/MD2 + the new 21–24 + EDG-*) green; no uncaught errors; existing markdown cases 15–20 byte-for-byte unchanged.

---

## 8. Backlog

### Phase P1 — Markdown Import Extension Shorthand (single, focused phase)
**Milestone P1.M1 — Implement & validate.** One implementation task (helpers + async `scanTokens` + `tryMdExt` wiring + tests + module-surface sync), then one README doc-sync task (Mode B) depending on it.

- **P1.M1.T1 — Extension shorthand resolution + tests** (story_points 2)
  - **P1.M1.T1.S1 — `resolveImportPath` + `isRegularFile`, async `scanTokens`, `tryMdExt` wiring, exports** (story_points 1). Add the two helpers (§4.1); make `scanTokens` async with `opts.tryMdExt`, swap `expandTildeAndResolve`→`await resolveImportPath(token, baseDir, opts.tryMdExt)` + `if (!abs) continue`; thread `tryMdExt` through `processTokenStream`'s opts; set `tryMdExt:false` at the top-level call and `tryMdExt:true` in `injectMarkdown`; `await` both scan sites; export the two new helpers; update the JSDoc (§6 Mode A). **Regression gate:** full existing suite green, byte-for-byte.
  - **P1.M1.T1.S2 — Acceptance cases 21–24 + §10 edges + module-surface sync** (story_points 1, depends S1). Add the fixtures (§5); add `runCase` 21–24 + EDG-1..4; add `resolveImportPath`/`isRegularFile` to the test sanity list (L113–128). TDD — write failing tests, then confirm S1's implementation passes.
- **P1.M1.T2 — Sync README extension shorthand (Mode B)** (story_points 1, depends T1.S1+S2). Add the one "Extension shorthand" bullet to `README.md` → "Markdown imports" (§6 Mode B). No code change.
