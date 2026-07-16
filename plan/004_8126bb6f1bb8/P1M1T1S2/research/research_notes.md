# Research Notes — P1.M1.T1.S2: §11 cases 21–24 + §10 edges EDG-1..4 + fixtures

> First-hand read of: the S1 PRP (contract for the POST-S1 source state),
> `architecture/codebase_insertion_points.md` (test-pattern table) + `delta_analysis.md`
> (decision matrix + fixture list), `file-injector.test.mjs` (runCase L89, sanity list L113–128,
> ASSERTED_EXPORTS L139–141, TMPDIR L191, buildFixtures L208+, path constants L260–281, FIX L271,
> countFileBlocks L293, markdown cases 15–20 L1333+, MD1/MD2 L1450+, tail summary L1480+),
> and `file-injector.ts` (scanTokens/injectMarkdown Step-3.5). Baseline: **77 passed, 0 failed.**

---

## 1. Starting state = POST-S1 (this subtask runs AFTER S1 lands)

S1 (parallel, in flight) delivers the source + its OWN test additions:
- **Source (`file-injector.ts`):** `export async function resolveImportPath(token, baseDir, tryMdExt)` +
  `export async function isRegularFile(p)`; `scanTokens` promoted to `async` with `opts.tryMdExt`;
  `tryMdExt:false` at the top-level call site, `tryMdExt:true` (+`await`) at the markdown call site.
- **Test additions by S1:** 2 typeof asserts + 2 ASSERTED_EXPORTS entries (`resolveImportPath`,
  `isRegularFile`); fixtures `README`(bare)/`README.md`/`PRD.md`/`only.markdown`/`.env`; path constants
  `README_BARE`/`README_MD`/`PRD_MD`/`ONLY_MARKDOWN`/`DOTENV`; ~7 TDD `runCase` blocks calling
  `resolveImportPath` DIRECTLY (unit tests, not end-to-end).

**T1.S2 adds the END-TO-END acceptance/edge cases** (call `mod.injectFiles(...)`) — it does NOT touch
`file-injector.ts`, the sanity list, or ASSERTED_EXPORTS (no new exports: all cases use `mod.injectFiles`
+ the test-internal `countFileBlocks`). The 8 new cases must PASS against S1's implementation.

---

## 2. THE COLLISION PROBLEM (and the resolution)

The item description names fixtures `readme`/`PRD`/`api`/`ghost`. But:
- S1 already creates uppercase `README`/`README.md` + `PRD.md` and constants `README_BARE`/`README_MD`/`PRD_MD`.
- Lowercase `readme`/`readme.md` would collide with S1's uppercase ones on a **case-insensitive FS** (macOS
  default) and are needlessly fragile on case-sensitive FS (4 near-duplicate files).
- Reusing S1's `PRD.md`/`PRD_MD` for Case 24/EDG-3 **couples T1.S2 to S1's exact constant name** and risks a
  **duplicate-declaration** SyntaxError if T1.S2 redefines `PRD_MD`; referencing S1's name is fragile (the
  T1.S2 implementer would have to locate it).

**Resolution: SELF-CONTAINED fixtures with names that collide with NOTHING** (not S1's, not the existing
markdown fixtures). The file NAME is an implementation detail — `delta_analysis.md` explicitly allows fixture
flexibility ("Reuse where possible"); the SEMANTIC contract per case is what matters. Two clean reuses remain
safe because they PREDATE S1 and S1 doesn't touch them: the existing top-level `api.md` (+ existing `API`
const) for Case 21, and the existing `sub/notes.md` (+ existing `SUB_NOTES` const) for EDG-4.

### Fixture set (all self-contained, non-colliding)

| Case | New fixture(s) | Content | Reuses |
|---|---|---|---|
| 21 (.md shorthand) | `notesShorthand.md` | `Imports #@api here.\n` | existing `api.md` (+ `API`) |
| 22 (exact-wins) | `guide` (bare) + `guide.md` + `notesExactWins.md` | `bare guide\n` / `# Guide\n` / `Refs #@guide here.\n` | — |
| 23 (.markdown-only) | `sub/ext/notes.md` + `sub/ext/api.markdown` | `See #@api here.\n` / `# Markdown API\n` | — |
| 24 (top-level exact-only) | `specdoc.md` (NO bare specdoc) | `# Spec\n` | — |
| EDG-1 (no-match) | `notesGhost.md` | `Refs #@ghost here.\n` | (ghost/* never created) |
| EDG-2 (already-extended missing) | `notesAbsent.md` | `Refs #@absent.md here.\n` | (absent.md never created) |
| EDG-3 (dedup across shorthand) | `notesDedup.md` | `Imports: #@specdoc and #@specdoc.md\n` | my own `specdoc.md` |
| EDG-4 (shorthand + path prefix) | `notesSubPrefix.md` | `See #@sub/notes here.\n` | existing `sub/notes.md` (+ `SUB_NOTES`) |

**Name mapping (PRD §11 → my fixture):** `api`→`api` (literal reuse); `readme`→`guide` (avoids S1's README);
`PRD`→`specdoc` (avoids S1's PRD.md/PRD_MD); `ghost`→`ghost` (literal; no collision). `sub/ext/` dedicated dir
for Case 23 avoids colliding with top-level `api.md` (delta_analysis.md's explicit recommendation).

### Path constants (append to the existing markdown-constants block; all MINE — no reuse of S1's names)
`NOTES_SHORTHAND`, `GUIDE_BARE`, `GUIDE_MD`, `NOTES_EXACT_WINS`, `EXT_NOTES`, `EXT_API_MARKDOWN`,
`SPECDOC_MD`, `NOTES_GHOST`, `NOTES_ABSENT`, `NOTES_DEDUP`, `NOTES_SUB_PREFIX` (+ reuse `API`, `SUB_NOTES`).

---

## 3. Per-case contracts (the SEMANTIC gate) — traced to resolveImportPath

`resolveImportPath(token, baseDir, tryMdExt)` = exact-first; if `tryMdExt && path.extname(token)===""` try
`<exact>.md` then `<exact>.markdown`; first existing regular file wins; else `null`. `scanTokens` dedups on
the **resolved** abs. Top-level call passes `tryMdExt:false` (exact-only); markdown passes `tryMdExt:true`.

| Case | Input | tryMdExt | Resolution trace | Expected |
|---|---|---|---|---|
| 21 | md `#@api` (no bare api) | true | api∉file → **api.md**∈file → api.md | api.md block; marker→`api`; injected=2 |
| 22 | md `#@guide` (bare guide + guide.md) | true | **guide**∈file (exact wins) → guide; guide.md never tried | bare guide block; guide.md NOT injected; injected=2 |
| 23 | md `#@api` in sub/ext/ (only api.markdown) | true | sub/ext/api∉file → sub/ext/api.md∉file → **sub/ext/api.markdown**∈file | api.markdown block; marker→`api`; injected=2 |
| 24 | top-level `#@specdoc` (only specdoc.md) | **false** | specdoc∉file → tryMdExt false → null → verbatim | byte-for-byte unchanged; injected=0 |
| EDG-1 | md `#@ghost` (no ghost/.md/.markdown) | true | ghost∉ → ghost.md∉ → ghost.markdown∉ → null | `#@ghost` verbatim; injected=1 |
| EDG-2 | md `#@absent.md` (absent.md missing) | true | extname(".md")≠"" → exact-only → absent.md∉ → null (never absent.md.md) | `#@absent.md` verbatim; injected=1 |
| EDG-3 | md `#@specdoc` + `#@specdoc.md` (specdoc.md exists) | true | both → specdoc.md (same abs) → dedup ONCE | specdoc.md block×1; 1st marker stripped, 2nd verbatim; injected=2 |
| EDG-4 | md `#@sub/notes` (sub/notes.md exists) | true | sub/notes∉ → **sub/notes.md**∈file → sub/notes.md | sub/notes.md block; marker→`sub/notes`; injected=2 |

---

## 4. EDG-3 marker-stripping trace (the subtle one)

`notesDedup.md` = `Imports: #@specdoc and #@specdoc.md\n`. FILE_INJECT_RE matches in order:
- Match 1: `#@specdoc` (group2="specdoc") → resolveImportPath("specdoc",TMPDIR,true): specdoc∉file → specdoc.md∈file → resolves to `SPECDOC_MD`. `localSeen.add(SPECDOC_MD)`. **recorded** (index i1).
- Match 2: `#@specdoc.md` (group2="specdoc.md") → resolveImportPath: specdoc.md∈file (exact) → resolves to `SPECDOC_MD`. `localSeen.has(SPECDOC_MD)` → **SKIP** (not recorded).

Step 4 strips `#@` only from recorded markers (high→low) → only match 1 stripped. Block content:
`Imports: specdoc and #@specdoc.md\n`. ∴ assert `r.text.includes("Imports: specdoc and #@specdoc.md")` ∧
`!r.text.includes("Imports: #@specdoc and")` ∧ `countFileBlocks(r.text, SPECDOC_MD) === 1`.

---

## 5. Placement landmarks (line numbers SHIFT as S1 lands — use IDENTIFIERS)

| What | Landmark (identifier-based, not line) |
|---|---|
| Fixtures | append inside `buildFixtures()`, after the last existing `fsSync.writeFileSync` (the huge.log/HUGE_LOG_CONTENT block is computed separately — put new writes BEFORE the `return { HUGE_LOG_CONTENT }`). `sub/ext/` needs `fsSync.mkdirSync(path.join(TMPDIR, "sub", "ext"), { recursive: true })`. |
| Path constants | append in the markdown path-constants block (the one defining `NOTES`/`API`/`A_MD`/`B_MD`/`SUB_NOTES`/`SUB_API`/`BIGDOC`/`PART1`/`NOTES_MISSING`/`OUTSIDER`/`SHARED_API`), after the last existing const. |
| runCases | append AFTER the `MD2` runCase block and BEFORE the `// 10. Summary + cleanup + exit.` comment block. |

S1 also appends to buildFixtures + constants + runCases; my appends land after S1's (distinct names → no collision, no duplicate-declaration).

---

## 6. Why no source / sanity-list / ASSERTED_EXPORTS change

- All 8 cases call `mod.injectFiles(...)` (already asserted at the sanity list) + the test-internal
  `countFileBlocks`. **No new module export is exercised.** ∴ the sanity list (L113–128) and
  ASSERTED_EXPORTS (L139–141) are UNTOUCHED by T1.S2. S1 already added `resolveImportPath`/`isRegularFile`.
- `file-injector.ts` is S1's deliverable; T1.S2 is test-only. If a case FAILS, the bug is in S1's
  `resolveImportPath`/`scanTokens`/wiring — NOT in T1.S2 (item point 6).

---

## 7. Regression guard (must stay green — proves shorthand didn't break existing behavior)

The full suite (77 baseline + S1's unit tests + my 8) must pass with **0 failed**. Critically, the existing
markdown cases must be byte-for-byte unchanged: 15–20 (import/code-exempt/cycle/abs-rejected/relative-base/
shared-budget), MD1 (missing .md import → verbatim), MD2 (outside-cwd import → allowed). If any flips, S1's
shorthand wiring altered relative-only/code-exempt/dedup/missing-import behavior — NOT a T1.S2 bug, but T1.S2's
gate catches it.

---

## 8. Confidence: 9/10

Test-only, one file, 8 cases with traced contracts + a self-contained non-colliding fixture set. The gate is
`node ./file-injector.test.mjs` → `0 failed`. The -1 reserves for: (a) the fixture-naming deviation from the
item's literal `readme`/`PRD` (documented + semantically equivalent); (b) the EDG-3 marker-order subtlety
(traced in §4). If S1's resolution has a bug, a case fails LOUDLY with a clear assertion message — that's the
designed behavior (item point 6: the bug is in S1, not here).
