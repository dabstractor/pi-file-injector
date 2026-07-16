# PRP — P1.M1.T1.S1 (plan/004): resolveImportPath + isRegularFile, async scanTokens, tryMdExt wiring, exports, module-surface sync

> **Scope flag:** This is the **resolution core** for markdown import extension shorthand (PRD §4.5 rule 3).
> It adds two exported helpers, makes `scanTokens` async with a `tryMdExt` flag, and wires the flag through.
> **Top-level (`#@` at the prompt) behavior stays byte-for-byte identical** (exact-only; `tryMdExt:false`).
> Only markdown imports gain the `.md`/`.markdown` shorthand. Acceptance cases 21–24 are a SEPARATE
> subtask (T1.S2) — this PRP ships the helpers + their TDD unit tests only.

---

## Goal

**Feature Goal:** Implement `resolveImportPath(token, baseDir, tryMdExt)` (exact-first → `.md` → `.markdown`
fallback, markdown-only via `tryMdExt`) and `isRegularFile(p)`; promote `scanTokens` to `async` with a new
`opts.tryMdExt: boolean`; thread `tryMdExt` through `processTokenStream`; wire `tryMdExt:false` at the
top-level call site and `tryMdExt:true` (+ `await`) at the markdown call site — without changing any
observable top-level behavior and without deleting the (now-redundant) markdown Step-3.5 existence pre-check.

**Deliverable:** Modified `file-injector.ts` (two new exported helpers near L94; async `scanTokens`; `tryMdExt`
threaded) + modified `file-injector.test.mjs` (sanity list + COMPLETENESS guard updated for the 2 new exports;
new shorthand fixtures; TDD unit tests for `resolveImportPath` + a `scanTokens`-returns-Promise check).

**Success Definition:**
1. `node ./file-injector.test.mjs` → all green (existing 77 byte-for-byte + new TDD unit tests), exit 0.
2. `npm run typecheck` → "0 errors" under `--strict`.
3. `resolveImportPath` + `isRegularFile` are exported AND present in BOTH the sanity `typeof`-asserts and the
   `ASSERTED_EXPORTS` completeness-guard Set (else the suite errors at load).

## Why

- **Enables the headline markdown convenience.** PRD §4.5 rule 3 lets a markdown author write `#@PRD` and get
  `PRD.md` injected — the same ergonomics as a wiki link. Today an extensionless `#@PRD` inside a markdown is
  left verbatim (no bare `PRD` file). `resolveImportPath` implements the exact→`.md`→`.markdown` ladder.
- **Keys dedup on the resolved path.** Because resolution now happens at scan time (and may append `.md`),
  dedup runs on the **resolved** abs — so `#@PRD` and `#@PRD.md` in the same markdown collapse to ONE
  injection (PRD §5.6 Step 3). This is why `scanTokens` must become `async` (it stats candidate paths).
- **Foundation for T1.S2.** The §11 acceptance cases 21–24 (top-level no-fallback, markdown shorthand,
  fallback to `.markdown`, collapse-of-forms) exercise this core. Shipping the helpers + their unit tests now
  isolates the resolution logic from the end-to-end case wiring.
- **Top-level is untouched in effect.** `tryMdExt:false` makes `resolveImportPath` exact-only, so the prompt
  path is observably identical to today (PRD §4.4: top-level is exact-match; the user has §14 autocomplete).

## What

### User-visible behavior

- **Top-level prompt `#@token`:** unchanged. `#@PRD` with no bare `PRD` file is still left verbatim
  (no `PRD.md` fallback at the prompt). Exact-match only.
- **Markdown import `#@token`:** NEW — if the exact path is not an existing regular file AND the token is
  extensionless (`path.extname(token) === ""`), try `<exact>.md` then `<exact>.markdown`. Exact-match wins
  (a bare `PRD` beats `PRD.md`); tokens already ending in `.md`/`.markdown` or any extension stay exact-only
  (`#@PRD.md` never becomes `PRD.md.md`). Missing/non-regular/no-match → leave the `#@` marker verbatim.
- **Dedup (markdown only):** `#@PRD` and `#@PRD.md` in one file now collapse to one injection.

### Success Criteria

- [ ] `resolveImportPath(token, baseDir, tryMdExt): Promise<string | null>` exported — exact-first; `.md`/`.markdown`
      fallback ONLY when `tryMdExt && path.extname(token) === ""`; returns first existing regular file or `null`.
- [ ] `isRegularFile(p): Promise<boolean>` exported — `try { return (await fs.stat(p)).isFile(); } catch { return false; }`.
- [ ] `scanTokens` is `async`, opts `{ allowAbsTilde; skipCode; tryMdExt }`, returns `Promise<{index;abs}[]>`,
      calls `await resolveImportPath(token, baseDir, opts.tryMdExt)` with `if (!abs) continue;`.
- [ ] `processTokenStream` opts carry `tryMdExt`; its `scanTokens` call is `await`ed.
- [ ] Top-level call site passes `tryMdExt: false`; markdown call site passes `tryMdExt: true` and `await`s.
- [ ] Step-3.5 existence pre-check in `injectMarkdown` is UNCHANGED (redundant-but-harmless; kept).
- [ ] `expandTildeAndResolve` is UNCHANGED (test L659 still calls it).
- [ ] Existing 77 tests pass byte-for-byte; `npm run typecheck` is clean; 2 new exports added to sanity list + `ASSERTED_EXPORTS`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current landmarks, the precise diff for each of the 4 changed functions, the new helper bodies verbatim,
the `path.extname` table (verified), the test-file edit map (sanity list + completeness guard + fixtures +
TDD cases), and the two verified gates. The change touches 2 files, ~6 small regions.

### Documentation & References

```yaml
# MUST READ — the refactor contract for THIS exact subtask (call-site audit, Step-3.5 interaction, gates)
- file: plan/004_8126bb6f1bb8/architecture/codebase_insertion_points.md
  why: "§1–6 pin the exact current line numbers + the new-helper bodies; the call-site audit proves only
        2 scan sites + 1 processTokenStream site exist; 'Step-3.5 interaction' explains why the pre-check
        becomes redundant-but-harmless and MUST stay; verification gates 1–4."
  critical: "The MODULE-SURFACE COMPLETENESS guard (file-injector.test.mjs L129–150) throws at load if a
             shipped function isn't in ASSERTED_EXPORTS — both new exports MUST be added there AND as typeof
             asserts, or the suite errors before any case runs."

# MUST READ — Pi facts (all CONFIRMED) + the dotfile nuance
- file: plan/004_8126bb6f1bb8/architecture/external_deps.md
  why: "Note A: typeof asyncFunction==='function' → the scanTokens sanity assert stays valid; the suite
        calls ONLY mod.injectFiles (never scanTokens directly) → no test call site needs await. Note B:
        path.extname('.env')==='' but exact-match-wins makes it safe → follow PRD §4.5 LITERALLY, no dotfile
        exclusion. Fact 1: a sub-function going async inside the already-async handler is no contract change."
  critical: "mod.expandTildeAndResolve is called directly by the test at L659 — DO NOT modify it (it stays
             the resolution primitive; resolveImportPath wraps it)."

# MUST READ — the spec for the shorthand ladder + exact-wins
- file: PRD.md
  why: "§4.5 rule 3 is the exact spec resolveImportPath implements; §4.4 pins top-level exact-only
        (tryMdExt:false); §5.6 Step 3 explains dedup-on-resolved-abs; §12.18 documents the markdown-only
        + resolved-abs-keyed design."
  section: "### 4.5 Markdown import directives (rule 3 Extension shorthand) + #### 5.6 Step 3"

# MUST READ — the target shape (resolveImportPath / isRegularFile / async scanTokens, verbatim)
- file: PRD.md
  why: "§9 pseudocode shows resolveImportPath/isRegularFile/async scanTokens EXACTLY as they must be written."
  section: "## 9. Algorithm (pseudocode)"

# The file you edit (the only source change)
- file: file-injector.ts
  why: "831 lines. scanTokens L389, processTokenStream L424, injectMarkdown L593 (call L600, Step-3.5 L606-622),
        injectFiles L639 (call L699), expandTildeAndResolve L84 (UNCHANGED), injectFile stat idiom L458-461
        (the pattern isRegularFile mirrors)."
  pattern: "isRegularFile mirrors injectFile's stat idiom; resolveImportPath wraps expandTildeAndResolve."
  gotcha: "scanTokens is EXPORTED and its sanity assert is `typeof mod.scanTokens === 'function'` — going async
           keeps that true. But you MUST add resolveImportPath + isRegularFile to ASSERTED_EXPORTS or the
           completeness guard fails at load."

# The gate you also edit (sanity list, completeness guard, fixtures, TDD cases)
- file: file-injector.test.mjs
  why: "1501 lines. Sanity list L113-128; ASSERTED_EXPORTS Set L139-141; buildFixtures L194-233 + path
        constants ~L260-281; runCase(n,name,async fn) harness L88; markdown cases 15-20/MD1/MD2 L1333-1402
        (template for new cases); summary block at the very tail (append new cases BEFORE it)."
  pattern: "new runCase blocks use `await runCase(N, 'name', async () => { …asserts… });` and call
            `await mod.resolveImportPath(…)` directly against TMPDIR fixtures."
  gotcha: "State is a TS interface (erased at runtime) — the scanTokens-Promise test passes a plain object
           literal {blocks:[],images:[],injectedSet:new Set(),remaining:null,count:0,paged:0} as the State
           arg (the .mjs test is untyped)."

# typecheck gate (run it)
- file: scripts/typecheck.mjs
  why: "npm run typecheck resolves the GLOBAL pi .d.ts, writes a temp tsconfig with paths, runs tsc --strict.
        Must print '0 errors' after the async signature change."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (2 new exports near L94; scanTokens→async L389;
│                             #              processTokenStream opts L424; 2 call sites L600/L699)
├── file-injector.test.mjs    # ← EDITED (sanity list L113-128; ASSERTED_EXPORTS L139-141;
│                             #              fixtures ~L194-233; new TDD runCase blocks before tail summary)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched (typecheck + test scripts already present)
├── PRD.md / README.md        # read-only (README = T2.S1)
└── plan/004_8126bb6f1bb8/
    ├── architecture/{codebase_insertion_points.md, external_deps.md, system_context.md, delta_analysis.md}
    └── P1M1T1S1/{research/research_notes.md, PRP.md}  # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — +resolveImportPath, +isRegularFile (exported, ~L94);
                          #                  scanTokens async + tryMdExt (L389); processTokenStream opts (L424);
                          #                  injectMarkdown call tryMdExt:true+await (L600); top-level call tryMdExt:false (L699).
file-injector.test.mjs    # MODIFIED — +2 typeof asserts (L113-128); +2 entries in ASSERTED_EXPORTS (L139-141);
                          #                  +shorthand fixtures (buildFixtures); +TDD runCase blocks (before tail summary).
# No other files. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the MODULE-SURFACE COMPLETENESS guard (test L129-150) HARD-FAILS at load if a shipped function
//   isn't listed. ASSERTED_EXPORTS (L139-141) is a Set of 16 names; PURE_HELPERS_NOT_ASSERTED = {expandTildeAndResolve,
//   extOf, isBinary}. When you `export` resolveImportPath + isRegularFile, ADD BOTH to ASSERTED_EXPORTS AND as
//   typeof asserts at L113-128. Missing either → "module ships functions not in the sanity list" → exit 1.

// CRITICAL — typeof asyncFunction === "function" is TRUE. So the existing `assert(typeof mod.scanTokens === "function")`
//   stays valid after scanTokens goes async. Do NOT change that assert. (external_deps.md Note A.)

// CRITICAL — top-level MUST stay exact-only. Wire tryMdExt:FALSE at the injectFiles L699 call site. With false,
//   resolveImportPath never tries .md/.markdown → top-level is byte-for-byte identical to today (verified: cases
//   5/6 missing/dir still verbatim; case 5 still returns ORIGINAL imagesIn ref).

// CRITICAL — dotfiles: path.extname(".env") === "". The PRD §4.5 guard is LITERALLY `path.extname(token) === ""`.
//   A token ".env" technically qualifies for the fallback — BUT exact-match-wins returns the bare .env BEFORE the
//   .md fallback runs. So the behavior is correct/harmless. DO NOT add a dotfile exclusion (diverges from spec;
//   external_deps.md Note B). TDD case 5 pins this.

// GOTCHA — cleanToken runs BEFORE resolveImportPath. So "README." → cleanToken strips trailing "." → resolveImportPath
//   sees "README" → path.extname("README")==="" → shorthand applies. path.extname("README.")==="." is irrelevant.

// GOTCHA — Dedup now keys on the RESOLVED abs (possibly with ".md" appended). So "#@PRD" + "#@PRD.md" in one
//   markdown collapse to ONE injection. This is markdown-only and a NEW behavior — no existing case has both forms,
//   so the existing suite is unaffected. (It's tested in T1.S2, not here.)

// GOTCHA — scanTokens scan phase must stay PURE re: state.injectedSet (read-only). resolveImportPath only stats
//   (never mutates state). The scan-then-inject separation (records built before any injection) is what makes
//   cross-subtree dedup work — preserve it.

// LIBRARY — node:fs/promises.stat rejects on ENOENT → the try/catch→false idiom is correct "missing" detection
//   (mirrors the already-shipped injectFile L458-461). No new deps; reuses node:fs/node:path/node:os.
```

## Implementation Blueprint

### Data models and structure

No new data models. `State` already exists (from plan 003). The two new helpers are pure functions:

```ts
// §4.5 resolution: exact path first; if markdown import + extensionless token + exact not a file,
// try <exact>.md then <exact>.markdown. Returns the first existing regular file, or null.
export async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);     // reuse (tilde + resolve) — NO stat
  if (await isRegularFile(abs)) return abs;              // EXACT MATCH ALWAYS WINS
  if (tryMdExt && path.extname(token) === "") {          // extensionless shorthand ONLY (PRD §4.5 rule 3)
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;
}

// stat + isFile, never throws. Mirrors the injectFile L458-461 idiom.
export async function isRegularFile(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isFile(); } catch { return false; }
}
```

### Implementation Patterns & Key Details

```ts
// === scanTokens (L389) — sync → async + tryMdExt (the core change) ===
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean },   // + tryMdExt
  state: State,
): Promise<{ index: number; abs: string }[]> {                              // now Promise
  const localSeen = new Set<string>();
  const out: { index: number; abs: string }[] = [];
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  for (const m of text.matchAll(FILE_INJECT_RE)) {
    if (codeRanges && inCode(m.index!, codeRanges)) continue;
    const token = cleanToken(m[2]);
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);      // ← stats; .md/.markdown fallback
    if (!abs) continue;                                                       // ← nothing resolved → leave verbatim
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;          // dedup on RESOLVED abs
    localSeen.add(abs);
    out.push({ index: m.index!, abs });
  }
  return out;
}

// === processTokenStream (L424) — opts gain tryMdExt; await scanTokens ===
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean },    // + tryMdExt
  state: State,
  ctx: Ctx,
): Promise<number[]> {
  const records = await scanTokens(text, baseDir, opts, state);              // ← now awaited
  const resolved: number[] = [];
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue;
    const ok = await injectFile(r.abs, state, ctx);
    if (ok) resolved.push(r.index);
  }
  return resolved;
}

// === injectMarkdown call site (L600) — tryMdExt:true + await ===
const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true }, state);
// (Step 3.5 at L606-622 stays EXACTLY as-is — redundant-but-harmless; resolveImportPath now guarantees existence.)

// === injectFiles top-level call site (L699) — tryMdExt:false (exact-only, byte-for-byte identical) ===
const resolvedIdx = await processTokenStream(
  text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false }, state, ctx);
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - add (after expandTildeAndResolve, ~L94): export async function resolveImportPath(...)
  - add (next to resolveImportPath):          export async function isRegularFile(...)
  - change (L389):  scanTokens sync → async; opts +tryMdExt; return Promise; L406 → await resolveImportPath + if(!abs)continue
  - change (L424):  processTokenStream opts +tryMdExt; L431 scanTokens call → await
  - change (L600):  injectMarkdown scanTokens call → +tryMdExt:true + await
  - change (L699):  injectFiles processTokenStream call → +tryMdExt:false
  - UNCHANGED:     expandTildeAndResolve (L84); Step-3.5 (L606-622); injectFile; emitText; everything else

FILE_EDITS (file-injector.test.mjs):
  - add (L113-128): assert(typeof mod.resolveImportPath === "function", …); assert(typeof mod.isRegularFile === "function", …)
  - add (ASSERTED_EXPORTS L139-141): "resolveImportPath", "isRegularFile"
  - add (buildFixtures ~L194-233): bare `README` + `README.md`; `PRD.md`; `only.markdown`; bare `.env`
  - add (path constants ~L260-281): README_BARE, README_MD, PRD_MD, ONLY_MARKDOWN, DOTENV (path.join(TMPDIR, …))
  - add (before the "10. Summary" tail block): runCase blocks for the 7 TDD checks (Task 6)

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD export async function isRegularFile(p) to file-injector.ts (~L94, after expandTildeAndResolve)
  - IMPLEMENT: try { return (await fs.stat(p)).isFile(); } catch { return false; }
  - FOLLOW pattern: injectFile L458-461 (the shipped stat idiom — identical shape).
  - EXPORT: yes (`export async function`).
  - PLACEMENT: immediately after expandTildeAndResolve, before extOf.

Task 2: ADD export async function resolveImportPath(token, baseDir, tryMdExt) (~L94, next to Task 1)
  - IMPLEMENT: const abs = expandTildeAndResolve(token, baseDir); if (await isRegularFile(abs)) return abs;
              if (tryMdExt && path.extname(token) === "") { if (await isRegularFile(abs+".md")) return abs+".md";
              if (await isRegularFile(abs+".markdown")) return abs+".markdown"; } return null;
  - RULE: exact-match ALWAYS wins; .md/.markdown ONLY when tryMdExt && path.extname(token)==="" (PRD §4.5 rule 3).
  - DO NOT: add a dotfile exclusion (follow spec literally; external_deps.md Note B).
  - DEPENDENCIES: Task 1 (isRegularFile); expandTildeAndResolve (unchanged).
  - EXPORT: yes.

Task 3: PROMOTE scanTokens to async + tryMdExt (L389)
  - CHANGE signature: `export async function scanTokens(text, baseDir, opts:{allowAbsTilde;skipCode;tryMdExt}, state): Promise<{index;abs}[]>`.
  - REPLACE L406 `const abs = expandTildeAndResolve(token, baseDir);` → `const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);`
  - ADD `if (!abs) continue;` immediately after.
  - PRESERVE: the rest of the loop (code-range skip, cleanToken, allowAbsTilde guard, dedup `state.injectedSet.has(abs) || localSeen.has(abs)` now on the resolved abs).
  - UPDATE JSDoc (now async BECAUSE resolution stats; tryMdExt = markdown true / top-level false; dedup keys on resolved abs).

Task 4: THREAD tryMdExt through processTokenStream (L424)
  - CHANGE opts type: add `tryMdExt: boolean`.
  - CHANGE L431 `const records = scanTokens(...)` → `const records = await scanTokens(text, baseDir, opts, state);` (opts already carries tryMdExt).
  - UPDATE JSDoc (tryMdExt threading; shorthand markdown-only).

Task 5: WIRE the two call sites
  - injectMarkdown L600: `scanTokens(content, dir, { allowAbsTilde:false, skipCode:true }, state)`
    → `await scanTokens(content, dir, { allowAbsTilde:false, skipCode:true, tryMdExt:true }, state)`.
    Update the Step-3 JSDoc/comment (tryMdExt:true; shorthand is markdown-only). LEAVE Step-3.5 (L606-622) UNCHANGED.
  - injectFiles L699: `{ allowAbsTilde:true, skipCode:false }` → `{ allowAbsTilde:true, skipCode:false, tryMdExt:false }`.
  - DO NOT modify expandTildeAndResolve.

Task 6 (TDD — item §6 DoD): UPDATE the test file
  - 6a: ADD to sanity list (L113-128): `assert(typeof mod.resolveImportPath === "function", "mod.resolveImportPath must be a function (§4.5 exact→.md/.markdown)");` and `assert(typeof mod.isRegularFile === "function", "mod.isRegularFile must be a function (stat+isFile)");`.
  - 6b: ADD "resolveImportPath" + "isRegularFile" to the ASSERTED_EXPORTS Set (L139-141). REQUIRED or the completeness guard throws at load.
  - 6c: ADD fixtures in buildFixtures (~L194-233): fsSync.writeFileSync a bare `README` ("bare readme\n"); `README.md` ("# README\n"); `PRD.md` ("# PRD\n") (NO bare PRD); `only.markdown` ("# Only\n"); a bare `.env` ("KEY=val\n"). Add path constants (~L260-281) following the existing pattern.
  - 6d: ADD runCase blocks (before the tail "10. Summary" block), each `await runCase(N, "name", async () => { … })`:
        (1) exact-wins: await resolveImportPath("README", TMPDIR, true) === path.join(TMPDIR,"README").
        (2) .md fallback: await resolveImportPath("PRD", TMPDIR, true) === path.join(TMPDIR,"PRD.md").
        (3) .markdown fallback: await resolveImportPath("only", TMPDIR, true) === path.join(TMPDIR,"only.markdown").
        (4) no-match → null: await resolveImportPath("nope", TMPDIR, true) === null.
        (5) dotfile exact-wins: await resolveImportPath(".env", TMPDIR, true) === path.join(TMPDIR,".env") (NOT .env.md).
        (6) top-level exact-only: await resolveImportPath("PRD", TMPDIR, false) === null.
        (7) scanTokens returns a Promise:
            const p = mod.scanTokens("text", TMPDIR, {allowAbsTilde:true,skipCode:false,tryMdExt:false},
                       {blocks:[],images:[],injectedSet:new Set(),remaining:null,count:0,paged:0});
            assert(p instanceof Promise); const arr = await p; assert(Array.isArray(arr));
  - COVERAGE: all 5 resolveImportPath scenarios from item §6 + the Promise check. (Cases 21-24 end-to-end are T1.S2.)
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# The async signature change (scanTokens Promise return; await points) MUST satisfy the compiler.
# Common failure: a call site still uses scanTokens(...) without await, or opts missing tryMdExt.
```

### Level 2: The Regression Gate (existing 77 must stay byte-for-byte green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: all existing cases PASS (1-14, E1-E4, G1-G3, H1, M1, F1/F1b/F1c/F1d, F2, FS1-FS3, F3a/b, F5, F4,
#           U1, A1, DUP1-3, PD1-8, PN1-4, CC*, EIT*, BG*, 15-20, MD1, MD2) PLUS the new T1.S1 unit tests.
#           Final line: "Result: N passed, 0 failed." (N = 77 + your new runCase count), exit 0.
# If ANY existing case flips to FAIL, a behavioral invariant regressed — see Level 3.
```

### Level 3: Regression root-cause map (if an existing case breaks)

```bash
# Case 5 (missing file) / case 6 (directory) → top-level must stay verbatim + ORIGINAL imagesIn ref.
#   LIKELY: top-level call site got tryMdExt:true by mistake, OR the count===0 early return drifted.
#   FIX: top-level L699 MUST be tryMdExt:false; early return keeps { text, images: imagesIn, ... }.
#
# Case 13 / 14 (processFileArguments parity, bare @) → unrelated to resolution; if broken you touched too much.
#
# MD1 (notesMissing.md imports missing ghost.md → marker VERBATIM, injected=1):
#   LIKELY: resolveImportPath stopped returning null for a missing file, OR Step-3.5 was deleted.
#   TRACE: ghost.md absent → resolveImportPath("ghost.md",dir,true): isRegularFile→false; path.extname("ghost.md")===".md"
#          (NOT "") → fallback skipped → null → scanTokens continues → not recorded → not in injectable → NOT stripped
#          → marker stays verbatim. injected===1. If MD1 fails, you changed resolveImportPath's logic.
#
# Cases 15-20 (markdown transitive imports) → all should pass unchanged (tryMdExt:true only ADDS capability
#   for extensionless tokens; existing .md imports are exact-only and unaffected).
#
# Module-surface completeness guard (fails at load, before any case):
#   "module ships functions not in the sanity list: resolveImportPath, isRegularFile"
#   FIX: add both to ASSERTED_EXPORTS (L139-141) AND the typeof asserts (L113-128).

node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|not in the sanity"
```

### Level 4: Targeted TDD verification (the new unit tests)

```bash
# After implementation, the new runCase blocks should each print ✓:
node ./file-injector.test.mjs 2>&1 | grep -iE "exact-wins|fallback|markdown fallback|no-match|dotfile|exact-only|Promise|resolveImportPath|isRegularFile|shorthand"
# Confirm the 7 new checks PASS. If a resolveImportPath scenario fails, re-check path.extname(token) for that
# token (see the verified table in research_notes.md) and the exact-wins ordering.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → existing 77 + new TDD unit tests all PASS, exit 0.
- [ ] `resolveImportPath` + `isRegularFile` added to BOTH the sanity typeof-asserts AND `ASSERTED_EXPORTS`.
- [ ] `scanTokens` is `async`, returns `Promise<{index;abs}[]>`, calls `await resolveImportPath(...)` + `if (!abs) continue;`.
- [ ] Top-level call site is `tryMdExt: false` (exact-only — top-level byte-for-byte identical).

### Feature Validation (behavior)

- [ ] Top-level `#@PRD` (no bare file) still left verbatim; exact-only (PRD §4.4 preserved).
- [ ] Markdown `#@PRD` (only PRD.md exists) resolves to PRD.md (shorthand works, tryMdExt:true).
- [ ] Exact-match wins: bare `README` + `README.md` → returns the bare `README` (not README.md).
- [ ] `.markdown` fallback works when only `.markdown` exists.
- [ ] Missing/non-regular/no-match → `null` → marker left verbatim (MD1 still green).
- [ ] Dotfile `.env` exact-wins (no `.env.md` tried in the success path).
- [ ] Dedup keys on resolved abs (`#@PRD`+`#@PRD.md` collapse — observable only via T1.S2 cases, but the mechanism is in place).

### Code Quality Validation

- [ ] `expandTildeAndResolve` UNCHANGED (test L659 still calls it).
- [ ] Step-3.5 existence pre-check UNCHANGED (redundant-but-harmless; defense-in-depth).
- [ ] No dotfile exclusion added (PRD §4.5 followed literally).
- [ ] No new Pi APIs / npm deps (reuses node:fs/node:path/node:os).
- [ ] JSDoc updated on resolveImportPath, isRegularFile, scanTokens, processTokenStream, injectMarkdown Step-3.

### Documentation

- [ ] JSDoc on `resolveImportPath` (exact-first; `.md`/`.markdown` ONLY for extensionless markdown-import tokens; exact-wins).
- [ ] JSDoc on `isRegularFile` (stat + isFile + try/catch→false).
- [ ] `scanTokens` JSDoc (async BECAUSE resolution stats; `opts.tryMdExt` = markdown true / top-level false; dedup on resolved abs).
- [ ] `processTokenStream` opts JSDoc + `injectMarkdown` Step-3 comment (tryMdExt threading; shorthand markdown-only).
- [ ] NO README change (Mode B = T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT wire `tryMdExt: true` at the top-level call site.** Top-level is exact-only (PRD §4.4). `tryMdExt:false`
  there is what keeps cases 5/6 and the whole prompt path byte-for-byte identical.
- ❌ **Do NOT add a dotfile exclusion to resolveImportPath.** Follow PRD §4.5 literally (`path.extname(token) === ""`).
  Exact-match-wins already makes `.env` safe; an exclusion would diverge from the spec and fail TDD case 5.
- ❌ **Do NOT forget the COMPLETENESS guard.** Adding `export` without adding the name to `ASSERTED_EXPORTS` (L139-141)
  throws "module ships functions not in the sanity list" at load — the gate fails before any case runs.
- ❌ **Do NOT delete Step-3.5.** It becomes redundant-but-harmless after this delta (resolveImportPath now guarantees
  existence). Keep it as defense-in-depth for the §10 verbatim-on-missing invariant (item §f).
- ❌ **Do NOT modify expandTildeAndResolve.** The test calls it directly at L659; it stays the resolution primitive
  that resolveImportPath wraps.
- ❌ **Do NOT ship the §11 acceptance cases 21–24 / EDG-1..4 here.** Those are T1.S2. This PRP ships the helpers
  + their unit tests only (gates 1–3 + the 7 TDD checks).
- ❌ **Do NOT break the scan-then-inject separation.** resolveImportPath must only stat (never mutate
  `state.injectedSet`); scanTokens builds `records`/`localSeen` before any injection — that ordering is what makes
  cross-subtree dedup correct.
- ❌ **Do NOT skip `await` at the two call sites.** Forgetting `await` on the now-async `scanTokens` returns a Promise
  where an array is expected → runtime breakage (typecheck should catch it, but verify cases 15-20).

---

## Confidence Score: 9/10

The delta is small and fully specified: two pure helpers (bodies given verbatim), a sync→async promotion with a
threaded boolean, and two one-line call-site wirings. The architecture docs give exact line numbers, an exhaustive
call-site audit, the Step-3.5 interaction, and the verified `path.extname` table. Both gates (`typecheck`, full
suite) are green today and the gate-1 non-regression is proven by tracing cases 5/6/MD1. The -1 reserves for the
test-file COMPLETENESS-guard gotcha (easy to miss) and ensuring the async change satisfies `--strict` — both
caught instantly by the gates. One file of source + one file of tests; the implementing agent re-runs two commands.
