---
name: "P1.M1.T1.S2 — PRD §11 acceptance cases 21–24 + §10 edge cases EDG-1..4 + fixtures"
prd_ref: "PRD §4.5 rule 3 (Extension shorthand), §5.6 Step 3 (dedup on resolved abs), §4.4 (top-level exact-only), §11 cases 21–24, §10 edges (no-match / already-extended-missing / dedup-across-shorthand / shorthand-with-prefix)"
target_file: "./file-injector.test.mjs"   # TEST-ONLY — file-injector.ts is S1's deliverable (untouched here)
target_language: JavaScript (.mjs; zero-dependency harness; loads the REAL .ts via jiti + Pi's alias map)
depends_on: "P1.M1.T1.S1 (provides exported resolveImportPath/isRegularFile, async scanTokens with tryMdExt, tryMdExt:false at top-level / true at markdown call site, AND its own fixtures README/README.md/PRD.md/only.markdown/.env + constants + ~7 unit runCases)"
consumed_by: "P1.M1.T2.S1 (README Mode B docs — references §11 cases 21–24 as the acceptance proof)"
---

# PRP — P1.M1.T1.S2: PRD §11 acceptance cases 21–24 + §10 edge cases EDG-1..4 + fixtures

> **Scope flag:** This is a **TEST-ONLY** subtask. It edits **`file-injector.test.mjs` ONLY** — adds 8
> end-to-end `runCase` blocks (cases 21–24 + EDG-1..4) + their fixtures + path constants. It does **NOT**
> touch `file-injector.ts`, the sanity list, or `ASSERTED_EXPORTS` (all 8 cases call `mod.injectFiles(...)`,
> already asserted, + the test-internal `countFileBlocks`). The shorthand RESOLUTION is S1's deliverable;
> these cases ENCODE the PRD §11/§10 shorthand contract and must PASS against S1's implementation. If a case
> FAILS, the bug is in S1's `resolveImportPath`/`scanTokens`/wiring — not here (item point 6).

---

## Goal

**Feature Goal:** Add the 4 PRD §11 acceptance cases (21 `.md` shorthand, 22 exact-beats-shorthand,
23 `.markdown`-only fallback, 24 top-level exact-only) and the 4 PRD §10 edge cases (EDG-1 no-match,
EDG-2 already-extended-missing, EDG-3 dedup-across-shorthand, EDG-4 shorthand-with-path-prefix) as
end-to-end `runCase` blocks driving `mod.injectFiles`, plus their real-TMPDIR fixtures + path constants —
**all green** against S1's implementation, with the existing 77-case baseline + S1's unit tests unchanged.

**Deliverable:** A modified `file-injector.test.mjs` containing:
1. ~12 new fixture writes inside `buildFixtures()` (real `fsSync.writeFileSync`/`mkdirSync`, no mocking).
2. ~11 new path constants in the markdown-constants block.
3. 8 new `runCase` blocks (21, 22, 23, 24 numeric; EDG-1, EDG-2, EDG-3, EDG-4 string ids) appended after
   the `MD2` block, before the `// 10. Summary` tail.

**Success Definition:** `node ./file-injector.test.mjs` → `Result: N passed, 0 failed.` (N = baseline 77 +
S1's unit-test count + 8), exit 0. All 8 new cases print ✓. The existing markdown cases (15–20, MD1, MD2) and
every other baseline case stay byte-for-byte green (proves S1's shorthand didn't alter relative-only /
code-exempt / dedup / missing-import behavior). No `file-injector.ts` change.

## Why

- **Closes the §11/§10 acceptance gate for the shorthand feature.** S1 ships the resolution core + its UNIT
  tests (calling `resolveImportPath` directly). But PRD §11 specifies END-TO-END cases that drive the whole
  pipeline (`#@notes.md` → `injectFiles` → markdown scan → `resolveImportPath` → inject → strip → assemble).
  Cases 21–24 + EDG-1..4 are those end-to-end proofs: they exercise the shorthand through `scanTokens`'s
  async resolution, the markdown call-site `tryMdExt:true`, dedup-on-resolved-abs, and the top-level
  `tryMdExt:false` exact-only boundary — exactly the contract a unit test of `resolveImportPath` alone cannot.
- **Pins the design invariants that are easy to regress.** Exact-beats-shorthand (22), `.markdown`-only
  fallback (23), top-level-no-fallback (24), never-`.md.md` (EDG-2), and collapse-of-forms dedup (EDG-3) are
  the four sharp edges of the shorthand ladder. Encoding them as named, self-checking cases makes a future
  regression fail LOUDLY with a precise message instead of silently shipping wrong behavior.
- **Decouples test authoring from resolution authoring.** S1 and T1.S2 can be reviewed/landed independently;
  if S1's resolution has a bug, T1.S2's gate catches it (item point 6: "the bug is in S1's resolution, not here").

## What

No user-visible or API surface change (these are internal acceptance tests). Concretely, 8 new cases:

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `0 failed`, exit 0; the 8 new cases print ✓.
- [ ] **Case 21** (md `#@api`, no bare api, `api.md` exists) → `api.md` block present; import marker inside
      `notesShorthand.md` stripped to `api` (NOT `#@api`); `injected===2`; `paged===0`.
- [ ] **Case 22** (md `#@guide`, BOTH bare `guide` AND `guide.md` exist) → bare `guide` block present;
      `guide.md` has ZERO blocks (`countFileBlocks===0`); import marker stripped to `guide`; `injected===2`.
- [ ] **Case 23** (md `#@api` in `sub/ext/`, ONLY `api.markdown` exists) → `sub/ext/api.markdown` block
      present (its distinct content); import marker stripped to `api`; `injected===2`.
- [ ] **Case 24** (top-level `#@specdoc`, ONLY `specdoc.md` exists, NO bare `specdoc`) → left VERBATIM,
      `injected===0`, `r.text === "See #@specdoc"` byte-for-byte (top-level is exact-only).
- [ ] **EDG-1** (md `#@ghost`, no `ghost`/`.md`/`.markdown`) → `#@ghost` left verbatim in the markdown block;
      `injected===1`; no ghost/ghost.md block.
- [ ] **EDG-2** (md `#@absent.md`, `absent.md` missing) → `#@absent.md` left verbatim (exact-only; never
      `absent.md.md`); `injected===1`; no absent.md block.
- [ ] **EDG-3** (md `#@specdoc` + `#@specdoc.md`, `specdoc.md` exists) → injected ONCE
      (`countFileBlocks(r.text, SPECDOC_MD) === 1`); first marker stripped to `specdoc`, second left
      verbatim; `injected===2`.
- [ ] **EDG-4** (md `#@sub/notes`, `sub/notes.md` exists) → `sub/notes.md` block present (distinct content);
      import marker stripped to `sub/notes`; `injected===2`.
- [ ] Existing markdown cases 15–20 + MD1 + MD2 + all 77 baseline cases UNCHANGED (byte-for-byte green).
- [ ] No change to `file-injector.ts`, the sanity list (L113–128), `ASSERTED_EXPORTS` (L139–141), or any
      existing fixture/constant/case.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives
the exact fixture set (contents + path constants), the per-case resolution trace, the 8 `runCase` bodies
verbatim, the identifier-based placement landmarks, the collision-avoidance rationale, and the verified gate.
The implementer edits ONE file in three append-only spots, then runs one command.

### Documentation & References

```yaml
# MUST READ — the test-pattern table (runCase/countFileBlocks/FIX/fixtures/constants/case template)
- file: plan/004_8126bb6f1bb8/architecture/codebase_insertion_points.md
  why: "'file-injector.test.mjs — patterns the delta tests must mirror' table: runCase (L89), countFileBlocks
        (L293), FIX (L271, no budget → remaining=null → all whole), markdown fixtures (buildFixtures), markdown
        path constants (~L260–281), markdown cases 15–20+MD1/MD2 (L1333–1402, the TEMPLATE for new cases)."
  critical: "runCase(n,name,fn) accepts a NUMBER or a STRING id (cases 15–20 numeric; MD1/MD2/F1/BG1/CC1/EIT1
             string). EDG-1..4 use string ids; 21–24 use numeric ids matching PRD §11."

# MUST READ — the decision matrix (token → behavior) + fixture list + path.extname table
- file: plan/004_8126bb6f1bb8/architecture/delta_analysis.md
  why: "The decision matrix maps EACH of my 8 cases to its exact resolveImportPath trace; the fixture list
        shows options; the path.extname table proves cleanToken-runs-first and exact-wins."
  critical: "case 23 needs a DEDICATED dir (sub/ext/) so api.markdown doesn't collide with top-level api.md.
             EDG-2's token has '.md' ext → path.extname !== '' → exact-only → never <name>.md.md."

# MUST READ — the source contract T1.S2 consumes (POST-S1)
- file: plan/004_8126bb6f1bb8/P1M1T1S1/PRP.md
  why: "S1 delivers resolveImportPath/isRegularFile, async scanTokens with tryMdExt, the tryMdExt:false
        (top-level) / true (markdown) wiring, AND S1's own fixtures (README/README.md/PRD.md/only.markdown/.env)
        + constants (README_BARE/README_MD/PRD_MD/ONLY_MARKDOWN/DOTENV) + ~7 unit runCases."
  critical: "S1 already creates README/README.md/PRD.md and the constants README_BARE/README_MD/PRD_MD —
             T1.S2 MUST NOT reuse those names (duplicate-declaration SyntaxError) or collide with those files.
             T1.S2's fixtures are SELF-CONTAINED with distinct names (guide/specdoc/etc.). See Known Gotchas."

# MUST READ — the spec for the shorthand ladder + exact-wins + top-level-exact-only
- file: PRD.md
  why: "§4.5 rule 3 (Extension shorthand: exact-first → .md → .markdown, extensionless only, exact-wins);
        §4.4 (top-level exact-only — NO fallback at the prompt, tryMdExt:false); §5.6 Step 3 (dedup keys on
        the RESOLVED abs → #@PRD + #@PRD.md collapse); §11 cases 21–24; §10 edge rows."
  section: "### 4.5 rule 3 + ### 4.4 + #### 5.6 Step 3 + ## 11 (rows 21–24) + ## 10 (md import rows)"

# The file you edit (the ONLY change)
- file: file-injector.test.mjs
  why: "~1501 lines (+ S1's additions). runCase L89; sanity list L113–128; ASSERTED_EXPORTS L139–141;
        TMPDIR L191; buildFixtures L208+; markdown path constants ~L260–281; FIX L271; countFileBlocks L293;
        markdown cases 15–20 L1333+; MD1/MD2 L1450+; tail '10. Summary' L1480+."
  pattern: "new runCase blocks mirror cases 15–19: `await runCase(N,'name',async()=>{ const r = await
            mod.injectFiles('Review #@X.md', [], FIX); assert(r.injected===N,…); …block-presence +
            pre-order + marker-stripped/verbatim… });`. Case 24 mirrors case 5: `r.text === '…'` byte-for-byte."
  gotcha: "The sanity list + ASSERTED_EXPORTS are NOT touched (no new export exercised). FIX = no budget →
           emitText injects whole → injected===count, paged===0 for ALL 8 cases. Line numbers SHIFT as S1
           lands — place by IDENTIFIER (after the MD2 runCase; after the last path constant; inside
           buildFixtures before `return { HUGE_LOG_CONTENT }`), not by line number."

# The source (READ-ONLY here — S1 owns it; cited only to trace behavior)
- file: file-injector.ts
  why: "scanTokens (async, tryMdExt), injectMarkdown Step-3.5 (existence pre-check, redundant-but-harmless
        after S1), injectFile (stat→claim→classify→count). T1.S2 does NOT edit this file."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← THE ONLY FILE EDITED (append fixtures + constants + 8 runCases)
├── file-injector.ts          # UNTOUCHED (S1's deliverable — resolveImportPath/isRegularFile/async scanTokens)
├── scripts/typecheck.mjs     # untouched (S1's gate; T1.S2 is .mjs-only so typecheck stays 0 errors)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README = T2.S1)
└── plan/004_8126bb6f1bb8/
    ├── architecture/{codebase_insertion_points.md, delta_analysis.md, external_deps.md, system_context.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← the source contract (POST-S1)
    └── P1M1T1S2/
        ├── research/research_notes.md   # ← collision analysis + per-case traces + fixture design
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED (append-only in 3 spots):
                          #   (1) ~12 fixture writes inside buildFixtures() (before `return { HUGE_LOG_CONTENT }`)
                          #   (2) ~11 path constants in the markdown-constants block
                          #   (3) 8 runCase blocks (21,22,23,24,EDG-1,EDG-2,EDG-3,EDG-4) after MD2, before "10. Summary"
# No other files. No new files. No source change. No new exports.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — do NOT reuse S1's fixture NAMES or constant NAMES. S1 (parallel) creates files README/README.md/
//   PRD.md/only.markdown/.env AND constants README_BARE/README_MD/PRD_MD/ONLY_MARKDOWN/DOTENV. Reusing a
//   constant name → `SyntaxError: Identifier 'PRD_MD' has already been declared` (suite won't load). Reusing
//   a lowercase `readme`/`readme.md` alongside S1's uppercase `README`/`README.md` → case-insensitive-FS
//   collision (macOS). ∴ T1.S2 uses SELF-CONTAINED names: guide/guide.md (not readme), specdoc.md (not PRD.md),
//   api (literal, reuses the PRE-S1 top-level api.md), ghost (literal, no collision). See the Name Mapping table.

// CRITICAL — Case 24 + EDG-3 depend on a file that exists as ONLY .md (NO bare form). Create `specdoc.md` but
//   NEVER a bare `specdoc`. Case 24: top-level `#@specdoc` (tryMdExt:false) → specdoc∉file → exact-only → null →
//   verbatim. EDG-3: markdown `#@specdoc` (tryMdExt:true) → specdoc.md. If you accidentally create a bare
//   `specdoc`, Case 24 would inject it (tryMdExt:false, exact) → injected!==0 → Case 24 FAILS.

// CRITICAL — Case 23 MUST use a DEDICATED dir (sub/ext/) holding ONLY api.markdown (no api, no api.md). A
//   top-level `api.md` ALREADY exists (Case 21 reuses it). If Case 23's #@api resolved against TMPDIR it would
//   hit the top-level api.md, not api.markdown. The sub/ext/ dir + resolution-relative-to-md-dir fixes this.

// CRITICAL — EDG-2's token MUST carry an extension (absent.md, NOT absent). path.extname("absent.md")===".md"
//   (!== "") → resolveImportPath is exact-only → never tries absent.md.md. A bare `absent` would trigger the
//   shorthand ladder and (if absent.md existed) resolve — wrong test. absent.md is INTENTIONALLY not created.

// CRITICAL — EDG-3 marker order. notesDedup.md = "Imports: #@specdoc and #@specdoc.md\n". FILE_INJECT_RE
//   matches #@specdoc FIRST (recorded; resolves to specdoc.md), then #@specdoc.md (same resolved abs → localSeen
//   SKIP → not recorded). Step 4 strips ONLY recorded markers → FIRST stripped to "specdoc", SECOND left verbatim.
//   ∴ assert `r.text.includes("Imports: specdoc and #@specdoc.md")` ∧ NOT `includes("Imports: #@specdoc and")`.

// GOTCHA — runCase(n,name,fn): `n` may be a number (21–24) OR a string ("EDG-1".."EDG-4"). Both work (the
//   suite already mixes: 15–20 numeric, MD1/MD2/F1/BG1/CC1/EIT1 string). console.log prints `case ${n}`.

// GOTCHA — FIX = { cwd: TMPDIR } has NO budget → state.remaining===null → emitText injects WHOLE →
//   injected===count, paged===0 for ALL 8 cases. Do NOT use PAGED_FIX (no case needs paging).

// GOTCHA — countFileBlocks(text, abs) counts `<file name="abs">` openers (test-internal, L293). Use it for
//   EDG-3 (===1) and Case 22's guide.md (===0). For single-block presence, `r.text.indexOf('<file name="…">')`.

// GOTCHA — the sanity list + ASSERTED_EXPORTS guard are NOT touched. All 8 cases use mod.injectFiles (asserted)
//   + countFileBlocks (test-internal). No new export. The completeness guard (L129–150) stays satisfied.

// LIBRARY — zero-dependency .mjs harness; imports the REAL file-injector.ts via jiti + Pi's alias map.
//   Fixtures are REAL files in TMPDIR (fsSync.mkdtempSync at L191). No mocking. The shorthand resolution
//   does real fs.stat via S1's isRegularFile. The ONLY gate is `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Fixture set (append inside `buildFixtures()`, before `return { HUGE_LOG_CONTENT };`)

```js
// ── Extension-shorthand fixtures (PRD §4.5 rule 3 — T1.S2 cases 21–24 + EDG-1..4). SELF-CONTAINED names
//    that do NOT collide with S1's README/README.md/PRD.md/only.markdown/.env or the existing markdown
//    fixtures. Case 21 reuses the existing top-level api.md (no bare api). Case 24 + EDG-3 share specdoc.md
//    (NO bare specdoc → top-level exact-only). EDG-4 reuses the existing sub/notes.md. ──
fsSync.writeFileSync(path.join(TMPDIR, "notesShorthand.md"), "Imports #@api here.\n");      // case 21: imports #@api → api.md
fsSync.writeFileSync(path.join(TMPDIR, "guide"), "bare guide\n");                           // case 22: bare (exact-wins)
fsSync.writeFileSync(path.join(TMPDIR, "guide.md"), "# Guide\n");                           // case 22: .md (must NOT win)
fsSync.writeFileSync(path.join(TMPDIR, "notesExactWins.md"), "Refs #@guide here.\n");       // case 22: imports #@guide
fsSync.mkdirSync(path.join(TMPDIR, "sub", "ext"), { recursive: true });                     // case 23: dedicated dir
fsSync.writeFileSync(path.join(TMPDIR, "sub", "ext", "notes.md"), "See #@api here.\n");     // case 23: imports #@api
fsSync.writeFileSync(path.join(TMPDIR, "sub", "ext", "api.markdown"), "# Markdown API\n");  // case 23: ONLY .markdown (no .md)
fsSync.writeFileSync(path.join(TMPDIR, "specdoc.md"), "# Spec\n");                          // case 24 + EDG-3 (NO bare specdoc)
fsSync.writeFileSync(path.join(TMPDIR, "notesGhost.md"), "Refs #@ghost here.\n");           // EDG-1: no-match (ghost never created)
fsSync.writeFileSync(path.join(TMPDIR, "notesAbsent.md"), "Refs #@absent.md here.\n");      // EDG-2: already-extended missing (absent.md never created)
fsSync.writeFileSync(path.join(TMPDIR, "notesDedup.md"), "Imports: #@specdoc and #@specdoc.md\n"); // EDG-3: dedup across shorthand forms
fsSync.writeFileSync(path.join(TMPDIR, "notesSubPrefix.md"), "See #@sub/notes here.\n");    // EDG-4: shorthand w/ path prefix → sub/notes.md
```

> **`sub/` already exists** (created earlier in `buildFixtures`); only `sub/ext/` needs `mkdirSync({recursive:true})`.

### Path constants (append in the markdown-constants block, after `SHARED_API`)

```js
// Extension-shorthand path constants (PRD §4.5 rule 3 — T1.S2 cases 21–24 + EDG-1..4).
const NOTES_SHORTHAND = path.join(TMPDIR, "notesShorthand.md");
const GUIDE_BARE = path.join(TMPDIR, "guide");
const GUIDE_MD = path.join(TMPDIR, "guide.md");
const NOTES_EXACT_WINS = path.join(TMPDIR, "notesExactWins.md");
const EXT_NOTES = path.join(TMPDIR, "sub", "ext", "notes.md");
const EXT_API_MARKDOWN = path.join(TMPDIR, "sub", "ext", "api.markdown");
const SPECDOC_MD = path.join(TMPDIR, "specdoc.md");
const NOTES_GHOST = path.join(TMPDIR, "notesGhost.md");
const NOTES_ABSENT = path.join(TMPDIR, "notesAbsent.md");
const NOTES_DEDUP = path.join(TMPDIR, "notesDedup.md");
const NOTES_SUB_PREFIX = path.join(TMPDIR, "notesSubPrefix.md");
// (reuses existing API = top-level api.md; existing SUB_NOTES = sub/notes.md)
```

### The 8 runCase blocks (append AFTER the `MD2` runCase, BEFORE `// 10. Summary`)

```js
// ──────────────────────────────────────────────────────────────────────────────
// ── EXTENSION SHORTHAND (PRD §4.5 rule 3) — cases 21–24 + EDG-1..4 ──
// A markdown import whose cleaned token is EXTENSIONLESS (path.extname(token)==="") resolves to <exact>.md
// then <exact>.markdown when the exact path is not an existing regular file (tryMdExt:true, markdown-only).
// Exact-match always wins; tokens already carrying any extension are exact-only (never <name>.md.md). Dedup
// keys on the RESOLVED abs. Top-level user tokens stay EXACT-ONLY (tryMdExt:false — case 24). FIX = no budget.
// ──────────────────────────────────────────────────────────────────────────────

// Case 21 — §11: .md SHORTHAND. notesShorthand.md imports "#@api" (extensionless); top-level api.md exists
// (no bare api) → resolves to api.md. The import marker is stripped to bare "api".
await runCase(21, "md ext-shorthand: #@api (no bare api) → api.md; marker→api; injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesShorthand.md", [], FIX);
  assert(r.injected === 2, `notesShorthand.md + api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesShorthand.md"), "top-level #@notesShorthand.md marker stripped to notesShorthand.md");
  const iNotes = r.text.indexOf('<file name="' + NOTES_SHORTHAND + '">');
  const iApi = r.text.indexOf('<file name="' + API + '">');   // reuses the existing top-level api.md
  assert(iNotes !== -1 && iApi !== -1, "both notesShorthand.md and api.md blocks must be present");
  assert(iNotes < iApi, "notesShorthand.md block must appear BEFORE api.md block (pre-order depth-first)");
  assert(r.text.includes("Imports api here."), "notesShorthand.md block: extensionless import marker stripped to api");
  assert(!r.text.includes("Imports #@api here."), "the resolved extensionless import marker must NOT retain #@");
});

// Case 22 — §11: EXACT BEATS SHORTHAND. notesExactWins.md imports "#@guide"; BOTH a bare "guide" AND
// "guide.md" exist → the bare "guide" (exact) wins; guide.md is NOT imported.
await runCase(22, "md ext exact-wins: #@guide (bare guide + guide.md) → bare guide; guide.md NOT imported; injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesExactWins.md", [], FIX);
  assert(r.injected === 2, `notesExactWins.md + bare guide injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesExactWins.md"), "top-level #@notesExactWins.md marker stripped to notesExactWins.md");
  const iNotes = r.text.indexOf('<file name="' + NOTES_EXACT_WINS + '">');
  const iGuide = r.text.indexOf('<file name="' + GUIDE_BARE + '">');
  assert(iNotes !== -1 && iGuide !== -1, "both notesExactWins.md and bare guide blocks must be present");
  assert(iNotes < iGuide, "notesExactWins.md block before bare guide block (pre-order)");
  // CRITICAL: exact-match wins — the bare "guide" is injected; guide.md is NOT.
  assert(r.text.includes("bare guide"), "the bare guide's content is present (exact match injected)");
  assert(countFileBlocks(r.text, GUIDE_MD) === 0, `guide.md must have ZERO blocks (exact-match wins over shorthand), got ${countFileBlocks(r.text, GUIDE_MD)}`);
  assert(r.text.includes("Refs guide here."), "notesExactWins.md block: import marker stripped to guide");
  assert(!r.text.includes("Refs #@guide here."), "the resolved import marker must NOT retain #@");
});

// Case 23 — §11: .markdown FALLBACK. sub/ext/notes.md imports "#@api"; in sub/ext/ ONLY api.markdown exists
// (no api, no api.md — dedicated dir avoids colliding with the top-level api.md) → resolves to api.markdown.
await runCase(23, "md ext .markdown: #@api (only api.markdown) → api.markdown; injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/ext/notes.md", [], FIX);
  assert(r.injected === 2, `sub/ext/notes.md + sub/ext/api.markdown injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read sub/ext/notes.md"), "top-level #@sub/ext/notes.md marker stripped to sub/ext/notes.md");
  const iNotes = r.text.indexOf('<file name="' + EXT_NOTES + '">');
  const iApi = r.text.indexOf('<file name="' + EXT_API_MARKDOWN + '">');
  assert(iNotes !== -1 && iApi !== -1, "both sub/ext/notes.md and sub/ext/api.markdown blocks must be present");
  assert(iNotes < iApi, "sub/ext/notes.md block before sub/ext/api.markdown block (pre-order)");
  assert(r.text.includes("Markdown API"), "sub/ext/api.markdown's DISTINCT content present (proves .markdown fallback)");
  assert(r.text.includes("See api here."), "sub/ext/notes.md block: import marker stripped to api");
  assert(!r.text.includes("See #@api here."), "the resolved import marker must NOT retain #@");
});

// Case 24 — §11: TOP-LEVEL EXACT-ONLY. Top-level "#@specdoc" with ONLY specdoc.md present (NO bare specdoc)
// → left VERBATIM (top-level is exact-match; NO .md fallback at the prompt — PRD §4.4).
await runCase(24, "top-level no-fallback: #@specdoc (only specdoc.md) → verbatim, injected=0", async () => {
  const r = await mod.injectFiles("See #@specdoc", [], FIX);
  assert(r.injected === 0, `nothing injected (top-level exact-only), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging, got paged=${r.paged}`);
  // byte-for-byte unchanged — mirrors case 5's "r.text === input" style (PRD §4.4: top-level is exact-only)
  assert(r.text === "See #@specdoc", `top-level prompt must be byte-for-byte UNCHANGED (no .md fallback at the prompt), got ${JSON.stringify(r.text)}`);
});

// EDG-1 — §10: NO MATCH. notesGhost.md imports "#@ghost"; NO ghost/ghost.md/ghost.markdown exists → the
// extensionless shorthand finds nothing → marker left VERBATIM.
await runCase("EDG-1", "§10 md edge: #@ghost (no ghost/.md/.markdown) → verbatim in markdown block, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesGhost.md", [], FIX);
  assert(r.injected === 1, `only notesGhost.md injected (ghost has no match), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesGhost.md"), "top-level #@notesGhost.md marker stripped to notesGhost.md");
  assert(r.text.includes('<file name="' + NOTES_GHOST + '">'), "notesGhost.md block present");
  assert(r.text.includes("Refs #@ghost here."), "the no-match import marker #@ghost must be left VERBATIM (§10)");
  assert(!r.text.includes("Refs ghost here."), "the no-match import marker must NOT be stripped");
  assert(r.text.indexOf('<file name="' + path.join(TMPDIR, "ghost.md") + '">') === -1, "ghost.md must NOT be injected (no match)");
});

// EDG-2 — §10: ALREADY-EXTENDED, MISSING. notesAbsent.md imports "#@absent.md"; absent.md is MISSING → the
// token already carries ".md" → exact-only (path.extname !== "") → NEVER tries absent.md.md → verbatim.
await runCase("EDG-2", "§10 md edge: #@absent.md (missing) → exact-only (never .md.md), verbatim, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesAbsent.md", [], FIX);
  assert(r.injected === 1, `only notesAbsent.md injected (absent.md missing), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesAbsent.md"), "top-level #@notesAbsent.md marker stripped to notesAbsent.md");
  assert(r.text.includes('<file name="' + NOTES_ABSENT + '">'), "notesAbsent.md block present");
  assert(r.text.includes("Refs #@absent.md here."), "the missing already-extended marker #@absent.md must be left VERBATIM (exact-only, never .md.md)");
  assert(!r.text.includes("Refs absent.md here."), "the missing import marker must NOT be stripped");
  assert(r.text.indexOf('<file name="' + path.join(TMPDIR, "absent.md") + '">') === -1, "absent.md must NOT be injected (missing)");
});

// EDG-3 — §10: DEDUP ACROSS SHORTHAND. notesDedup.md imports BOTH "#@specdoc" and "#@specdoc.md"; specdoc.md
// exists → BOTH resolve to the SAME abs → injected ONCE (dedup on the resolved abs). First marker (encountered
// first) is stripped; the second is left verbatim.
await runCase("EDG-3", "§10 md edge: #@specdoc + #@specdoc.md (specdoc.md exists) → injected ONCE (dedup), injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesDedup.md", [], FIX);
  assert(r.injected === 2, `notesDedup.md + specdoc.md (deduped) injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesDedup.md"), "top-level #@notesDedup.md marker stripped to notesDedup.md");
  // specdoc.md injected EXACTLY ONCE (dedup on the resolved abs — both #@specdoc and #@specdoc.md collapse)
  assert(countFileBlocks(r.text, SPECDOC_MD) === 1, `specdoc.md must appear exactly ONCE (dedup across shorthand forms), got ${countFileBlocks(r.text, SPECDOC_MD)}`);
  // first marker #@specdoc stripped to "specdoc"; second #@specdoc.md left VERBATIM (deduped → not recorded → not stripped)
  assert(r.text.includes("Imports: specdoc and #@specdoc.md"), "first marker #@specdoc stripped to specdoc; second #@specdoc.md left VERBATIM (deduped)");
  assert(!r.text.includes("Imports: #@specdoc and"), "the first (dedup-winning) marker must NOT retain #@");
});

// EDG-4 — §10: SHORTHAND WITH PATH PREFIX. notesSubPrefix.md imports "#@sub/notes"; sub/notes.md already
// exists (no bare sub/notes) → resolves to sub/notes.md (shorthand applies to prefixed paths too).
await runCase("EDG-4", "§10 md edge: #@sub/notes (sub/notes.md exists) → sub/notes.md, injected=2", async () => {
  const r = await mod.injectFiles("Read #@notesSubPrefix.md", [], FIX);
  assert(r.injected === 2, `notesSubPrefix.md + sub/notes.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read notesSubPrefix.md"), "top-level #@notesSubPrefix.md marker stripped to notesSubPrefix.md");
  const iNotes = r.text.indexOf('<file name="' + NOTES_SUB_PREFIX + '">');
  const iSub = r.text.indexOf('<file name="' + SUB_NOTES + '">');   // reuses the existing sub/notes.md
  assert(iNotes !== -1 && iSub !== -1, "both notesSubPrefix.md and sub/notes.md blocks must be present");
  assert(iNotes < iSub, "notesSubPrefix.md block before sub/notes.md block (pre-order)");
  assert(r.text.includes("Sub Notes"), "sub/notes.md's DISTINCT content present (proves shorthand resolved the prefixed path)");
  assert(r.text.includes("See sub/notes here."), "notesSubPrefix.md block: import marker stripped to sub/notes");
  assert(!r.text.includes("See #@sub/notes here."), "the resolved import marker must NOT retain #@");
});
```

### Per-case resolution trace (why each assertion holds — traced through S1's `resolveImportPath`)

| Case | Token (cleaned) | tryMdExt | resolveImportPath trace | Holds because |
|---|---|---|---|---|
| 21 | `api` | true | `api`∉file → **`api.md`**∈file → `api.md` | no bare api; .md fallback fires |
| 22 | `guide` | true | **`guide`**∈file (exact wins) → `guide`; `guide.md` never tried | exact-match short-circuits before shorthand |
| 23 | `api` (base=`sub/ext/`) | true | `sub/ext/api`∉ → `sub/ext/api.md`∉ → **`sub/ext/api.markdown`**∈ | dedicated dir; only .markdown exists |
| 24 | `specdoc` | **false** | `specdoc`∉file → tryMdExt false → `null` → verbatim | top-level exact-only (PRD §4.4) |
| EDG-1 | `ghost` | true | `ghost`∉ → `ghost.md`∉ → `ghost.markdown`∉ → `null` | no candidate exists |
| EDG-2 | `absent.md` | true | `extname(".md")!==""` → exact-only → `absent.md`∉ → `null` | already-extended → no ladder |
| EDG-3 | `specdoc` then `specdoc.md` | true | both → `specdoc.md` (same abs) → localSeen dedup → 1 inject | dedup on resolved abs |
| EDG-4 | `sub/notes` | true | `sub/notes`∉ → **`sub/notes.md`**∈ → `sub/notes.md` | shorthand applies to prefixed paths |

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — append-only in 3 spots):
  - buildFixtures(): append the ~12 fsSync.writeFileSync/mkdirSync lines (BEFORE `return { HUGE_LOG_CONTENT };`)
  - markdown path-constants block: append the ~11 const declarations (AFTER the existing SHARED_API const)
  - runCase section: append the 8 runCase blocks (AFTER the MD2 runCase, BEFORE `// 10. Summary + cleanup + exit.`)

NO_CHANGES:
  - file-injector.ts: UNTOUCHED (S1's deliverable)
  - sanity list (L113–128): UNTOUCHED (no new export exercised — all cases use mod.injectFiles)
  - ASSERTED_EXPORTS (L139–141) + completeness guard (L129–150): UNTOUCHED
  - existing fixtures / constants / cases: UNTOUCHED (regression gate)
  - package.json / scripts/typecheck.mjs / PRD.md / README.md / all plan/ files: UNTOUCHED

NO_NEW_EXPORTS: all 8 cases call mod.injectFiles (already asserted) + countFileBlocks (test-internal).
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the ~12 shorthand fixtures inside buildFixtures()
  - APPEND the fsSync.writeFileSync/mkdirSync block (see Blueprint) immediately BEFORE `return { HUGE_LOG_CONTENT };`.
  - NAMING: self-contained, non-colliding (guide/guide.md/specdoc.md/notes*.md/sub/ext/...). Do NOT use readme/PRD
            (collide with S1's README/README.md/PRD.md) or reuse S1's constants.
  - GOTCHA: `sub/ext/` needs fsSync.mkdirSync(path.join(TMPDIR,"sub","ext"),{recursive:true}); `sub/` already exists.
  - GOTCHA: create `specdoc.md` but NEVER a bare `specdoc` (Case 24 + EDG-3 depend on only-.md existing).
  - GOTCHA: do NOT create ghost / ghost.md / ghost.markdown / absent.md (EDG-1 / EDG-2 need them absent).

Task 2: ADD the ~11 path constants in the markdown-constants block
  - APPEND the const declarations (see Blueprint) after the existing SHARED_API const (or the last markdown const).
  - NAMING: NOTES_SHORTHAND, GUIDE_BARE, GUIDE_MD, NOTES_EXACT_WINS, EXT_NOTES, EXT_API_MARKDOWN, SPECDOC_MD,
            NOTES_GHOST, NOTES_ABSENT, NOTES_DEDUP, NOTES_SUB_PREFIX. Do NOT redeclare API/SUB_NOTES (reuse them).
  - GOTCHA: do NOT use any name S1 added (README_BARE/README_MD/PRD_MD/ONLY_MARKDOWN/DOTENV) → duplicate-declaration.

Task 3: ADD the 8 runCase blocks after MD2, before "10. Summary"
  - APPEND cases 21,22,23,24 (numeric ids) + EDG-1,EDG-2,EDG-3,EDG-4 (string ids) in that order (see Blueprint).
  - PATTERN: mirror cases 15–19 (mod.injectFiles → assert injected/paged/startsWith/block-presence/pre-order/
            marker-stripped-or-verbatim). Case 24 mirrors case 5 (r.text === input, byte-for-byte).
  - DEPENDENCIES: Tasks 1 & 2 (fixtures + constants must exist before the cases reference them).

Task 4: VERIFY no source / sanity / completeness change
  - CONFIRM: file-injector.ts is byte-for-byte unchanged (git diff shows only file-injector.test.mjs).
  - CONFIRM: the sanity list (L113–128) + ASSERTED_EXPORTS (L139–141) are unchanged.
  - CONFIRM: no existing fixture/constant/case was modified (append-only).
```

## Validation Loop

### Level 1: Load + sanity (the harness must import + clear the sanity/completeness guards)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -25
# Expected: no "SyntaxError: Identifier '...' has already been declared" (means a const collided with S1's —
#           rename it); no "module ships functions not in the sanity list" (means an export appeared — there
#           shouldn't be one, since T1.S2 adds no export). The sanity asserts (now including S1's
#           resolveImportPath/isRegularFile) print, then the case matrix begins.
```

### Level 2: The gate — full suite green (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 8 new cases print ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: N passed, 0 failed.        (N = 77 baseline + S1's unit-test count + 8)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# The 8 new cases: 21 (shorthand→api.md), 22 (exact-wins→guide), 23 (.markdown→api.markdown),
# 24 (top-level verbatim), EDG-1 (no-match verbatim), EDG-2 (already-extended verbatim),
# EDG-3 (dedup once), EDG-4 (prefixed→sub/notes.md).
```

### Level 3: Regression guard (existing markdown cases must stay byte-for-byte green)

```bash
# If ANY existing case flips to FAIL, S1's shorthand wiring altered relative-only / code-exempt / dedup /
# missing-import behavior — that is an S1 bug, NOT a T1.S2 bug, but T1.S2's gate catches it.
node ./file-injector.test.mjs 2>&1 | grep -E "case (15|16|17|18|19|20|MD1|MD2)|FAIL|Result:"
# Expected: ✓ for cases 15,16,17,18,19,20,MD1,MD2; "Result: N passed, 0 failed."
#
# Case-15/16 (notes.md imports api.md + fenced #@example.ts): if FAIL, S1's tryMdExt:true wiring or code-exempt
#   detection regressed. Case-17 (cycle): if FAIL, dedup-on-resolved-abs broke. MD1 (missing ghost.md): if FAIL,
#   resolveImportPath stopped returning null for a missing exact-.md token.
```

### Level 4: Targeted new-case verification (the 8 cases each pass)

```bash
node ./file-injector.test.mjs 2>&1 | grep -iE "case 21|case 22|case 23|case 24|EDG-1|EDG-2|EDG-3|EDG-4"
# Expected: 8 lines, all ✓. If one is ✗, READ its assertion message:
#   - "got injected=N" mismatch → resolveImportPath returned the wrong path (or null where it shouldn't).
#   - "guide.md must have ZERO blocks" (Case 22) → exact-match didn't win; resolveImportPath tried .md before exact.
#   - "specdoc.md must appear exactly ONCE" (EDG-3) → dedup-on-resolved-abs broke (scanTokens keyed on pre-resolution abs).
#   - "top-level prompt must be byte-for-byte UNCHANGED" (Case 24) → top-level got tryMdExt:true by mistake (S1 wiring bug).
#   These are ALL S1 bugs (item point 6); T1.S2's job is to surface them with a precise message.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `0 failed`, exit 0; 8 new cases print ✓.
- [ ] No `SyntaxError` / "module ships functions not in the sanity list" at load.
- [ ] `git diff --stat` shows ONLY `file-injector.test.mjs` changed (file-injector.ts untouched).

### Feature Validation (the 8 cases)

- [ ] Case 21: `#@api` → api.md block; marker stripped to `api`; injected===2.
- [ ] Case 22: `#@guide` → bare guide block; guide.md ZERO blocks; injected===2.
- [ ] Case 23: `#@api` in sub/ext/ → api.markdown block; injected===2.
- [ ] Case 24: top-level `#@specdoc` → byte-for-byte verbatim; injected===0.
- [ ] EDG-1: `#@ghost` → verbatim; injected===1; no ghost block.
- [ ] EDG-2: `#@absent.md` → verbatim; injected===1; no absent.md block.
- [ ] EDG-3: `#@specdoc`+`#@specdoc.md` → specdoc.md block ×1; 1st stripped, 2nd verbatim; injected===2.
- [ ] EDG-4: `#@sub/notes` → sub/notes.md block; marker stripped to `sub/notes`; injected===2.

### Regression Validation (existing behavior unchanged)

- [ ] Markdown cases 15–20 + MD1 + MD2 unchanged (relative-only / code-exempt / dedup / missing-import intact).
- [ ] All 77 baseline cases (1–14, E1–E4, G1–G3, H1, M1, F1/F1b/F1c/F1d, F2, FS1–FS3, F3a/b, F5, F4, U1, A1,
      DUP1–3, PD1–8, PN1–4, CC*, EIT*, BG*) still green.
- [ ] Top-level cases (1–14, esp. case 5 missing, case 6 directory) still exact-only (S1's tryMdExt:false held).

### Code Quality Validation

- [ ] Fixtures use self-contained, non-colliding names (guide/specdoc/ghost/absent — NOT readme/PRD).
- [ ] Path constants do NOT duplicate any S1-added name (README_BARE/README_MD/PRD_MD/ONLY_MARKDOWN/DOTENV).
- [ ] runCase ids match the convention (21–24 numeric; EDG-1..4 string).
- [ ] Append-only: no existing fixture/constant/case line modified.
- [ ] JSDoc/comments on the new case block explain the shorthand contract (tryMdExt, exact-wins, dedup-on-resolved).

### Documentation

- [ ] No README change (Mode B = T2.S1). No source JSDoc change (S1 owns file-injector.ts).
- [ ] The new case-block header comment cites PRD §4.5 rule 3 + §4.4 + §5.6 Step 3.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit `file-injector.ts`.** The shorthand resolution is S1's deliverable. T1.S2 is test-only. If a
  case fails, the bug is in S1's `resolveImportPath`/`scanTokens`/wiring — surface it, don't patch the source here.
- ❌ **Do NOT reuse S1's fixture/constant names** (`README`/`README.md`/`PRD.md`/`only.markdown`/`.env` files;
  `README_BARE`/`README_MD`/`PRD_MD`/`ONLY_MARKDOWN`/`DOTENV` constants). Duplicate-declaration → suite won't load.
  Use self-contained names (guide/specdoc/ghost/absent).
- ❌ **Do NOT use lowercase `readme`/`readme.md`** alongside S1's uppercase `README`/`README.md` — case-insensitive-FS
  collision. Use `guide`/`guide.md` (distinct) for the exact-wins case.
- ❌ **Do NOT create a bare `specdoc`.** Case 24 + EDG-3 require ONLY `specdoc.md` to exist (no bare form). A stray
  bare `specdoc` makes Case 24 inject it (exact, tryMdExt:false) → injected!==0 → FAIL.
- ❌ **Do NOT put Case 23's `api.markdown` in TMPDIR root** — it would collide with/blur against the top-level
  `api.md` (Case 21). Use the dedicated `sub/ext/` dir (resolution is relative to the md's dir).
- ❌ **Do NOT use `absent` (bare) for EDG-2.** The token MUST carry `.md` (`absent.md`) so `path.extname !== ""`
  → exact-only → never `<name>.md.md`. A bare token would trigger the shorthand ladder (wrong test).
- ❌ **Do NOT touch the sanity list / ASSERTED_EXPORTS / completeness guard.** No new export is exercised
  (all cases use `mod.injectFiles` + the test-internal `countFileBlocks`). S1 already added its exports.
- ❌ **Do NOT use `PAGED_FIX`.** All 8 cases use `FIX` (no budget → whole). No case needs paging.
- ❌ **Do NOT modify any existing fixture/constant/case.** Append-only. The 77-case baseline + S1's additions
  are the regression gate; touching them hides S1 regressions.
- ❌ **Do NOT hardcode the result count.** The final `N` = baseline + S1's unit tests + 8; assert `0 failed`,
  not a specific `N` (S1's exact unit-test count may vary).

---

## Confidence Score: 9/10

A test-only, one-file task: 8 end-to-end `runCase` blocks + a self-contained, non-colliding fixture set,
each case traced through S1's `resolveImportPath` to a precise assertion. The gate is `node ./file-injector.test.mjs`
→ `0 failed`. The -1 reserves for: (a) the fixture-naming deviation from the item's literal `readme`/`PRD`
(documented + semantically equivalent — `guide`/`specdoc` avoid S1 collisions); (b) the EDG-3 marker-order
subtlety (traced: first `#@specdoc` recorded+stripped, second `#@specdoc.md` deduped+verbatim). If S1's
resolution has a bug, a case fails LOUDLY with a clear message — that is the designed, desired behavior.
