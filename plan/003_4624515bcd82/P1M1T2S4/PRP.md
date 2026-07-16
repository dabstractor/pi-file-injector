---
name: "P1.M1.T2.S4 — Shared-budget case 20 + MD edge cases + module-surface sync"
prd_ref: "PRD §5.6.2 (total-size budget), §5.6 (markdown recursion), §4.5 (markdown import rules), §10 (edge cases: missing import → verbatim; outside-cwd `../` → allowed), §11 case 20 (shared budget), §5.5 (paged directive format), §5.4 (missing/dir → verbatim)"
target_file: "./file-injector.ts + ./file-injector.test.mjs"   # EDIT injectMarkdown (the §10 fix); ADD 1 guard + fixtures + consts + 3 cases to the harness
target_language: TypeScript (jiti transpile-on-load; no tsconfig/lint/test-framework — the .mjs harness IS the gate)
depends_on: "P1.M1.T2.S3 (DONE/LANDED: injectMarkdown L578 PRIVATE + MD_EXTS branch L482 + cases 15-19; gate GREEN at 72). S4 starts POST-S3."
consumed_by: "P1.M1.T3.S1 (README markdown imports — Mode B docs; S4's doc work is the test-surface guard only). Nothing downstream consumes the injectMarkdown fix's API (it is internal behavior)."
---

# PRP — P1.M1.T2.S4: Shared-budget case 20 + MD edge cases + module-surface sync

> **Scope flag:** This is **NOT a test-only subtask.** PRD §10 edge (a) — *a markdown that imports a MISSING
> file must leave the import marker VERBATIM* — is **violated by the S3 implementation** (verified live).
> S3's `injectMarkdown` strips `#@` from EVERY scan-resolved marker *before* recursing, but `scanTokens`
> resolves paths without stat-ing, so a missing import's marker is stripped even though `injectFile` later
> returns false. S4 **fixes `injectMarkdown`** with a stat+isFile existence pre-check (preserving pre-order +
> all 5 S3 cases), then adds: **PRD §11 case 20** (shared budget across the recursion, PAGED_FIX + merged-ctx
> notify), **2 markdown edge cases** (MD1 missing→verbatim [exercises the fix], MD2 outside-cwd `../`→allowed
> [pure regression test — already works]), and a **module-surface completeness guard** (the test-surface sync).
> **+3 cases → `75 passed, 0 failed`.** No new exports, no new constants, no README (Mode B = T3.S1).

---

## Goal

**Feature Goal:** Close the markdown-recursion feature to PRD-spec completeness: (1) make the shared budget
span the full markdown recursion (PRD §5.6.2) and prove it via case 20; (2) make `injectMarkdown` honor the
PRD §10 / §5.4 contract that a markdown import resolving to a **missing file or directory is left verbatim**
(its marker is NOT stripped); (3) prove the outside-cwd `../` import is allowed (PRD §10); (4) finalize the
test's module-surface sanity list so the gate asserts the **real shipped surface** (no unexpected exports;
`injectMarkdown` stays private).

**Deliverable:**
1. **`./file-injector.ts`** — `injectMarkdown` (L578) MODIFIED: insert an existence pre-check (`fs.stat` +
   `isFile`) between scan (Step 3) and strip (Step 4); strip + recurse only into `injectable` (the existing-
   file subset). ONE localized edit; the claim/emit/recursion structure is S3's. Update the JSDoc to cite
   PRD §10/§5.4 and the pre-order rationale.
2. **`./file-injector.test.mjs`** —
   - **Module-surface completeness guard** (after the last sanity assert, L128): assert every shipped
     function is either in the curated 16-name list OR a known pure helper; assert `injectMarkdown` is
     **NOT** exported.
   - **Fixtures** in `buildFixtures`: `bigdoc.md` (imports 3 parts + `#@huge.log`), `part1/2/3.txt`,
     `notesMissing.md` (imports a genuinely-missing `#@ghost.md`), `sub/outsider.md` (imports
     `#@../shared/api.md`), `shared/api.md` (+ `shared/` mkdir).
   - **Path constants** (near `HUGE` L229): `BIGDOC`, `PART1`, `PART2`, `PART3`, `NOTES_MISSING`,
     `OUTSIDER`, `SHARED_API`.
   - **3 new `runCase` blocks** after case 19 (L1315), before Summary (L1317): `20` (shared budget,
     PAGED_FIX + merged-ctx notify), `MD1` (missing import → verbatim, FIX), `MD2` (outside-cwd `../`, FIX).

**Success Definition:** `node ./file-injector.test.mjs` prints `Result: 75 passed, 0 failed.`, exit 0. The 72
POST-S3 cases stay green (the `injectMarkdown` fix is behavior-identical for all 5 S3 cases — their imports
all exist, so `injectable === records`). Cases 20, MD1, MD2 pass. The completeness guard passes on the
shipped surface.

## Why

- **Spec correctness (the §10 gap S3 left).** A user writing `#@spec.md` that references `#@api.md` expects
  to SEE that api.md was referenced. If api.md is missing, stripping `#@` from the marker (leaving bare
  `api.md`) is **misleading** — it looks injected but no block follows. PRD §10 mandates the marker stay
  verbatim. The top-level path already does this (processTokenStream strips only successfully-injected
  indices); the markdown path couldn't, because **pre-order** (§5.6 step 6) emits the parent block before
  recursing. The fix (stat pre-check) makes the markdown strip existence-aware without breaking pre-order.
- **Shared-budget proof across recursion (§5.6.2).** `remaining` is ONE mutable accumulator decremented at
  each emission across the whole prompt — top-level tokens AND every transitive import. BG1-BG3 prove the
  flip at the top level; **case 20 proves it spans the markdown recursion** (bigdoc.md + 3 parts each
  decrement remaining, then huge.log pages against the running total) and that notify counts ALL delivered
  files (whole + paged).
- **Outside-cwd safety (§10).** A markdown in `sub/` importing `#@../shared/api.md` resolves to
  `shared/api.md` (relative to the markdown's dir, NOT cwd). This is explicitly ALLOWED (explicit user intent
  via the markdown's locality). MD2 is a regression test that this keeps working (it already does).

## What

User-visible behavior after S4:
- `#@notesMissing.md` (imports a missing `#@ghost.md`) → notesMissing.md injected whole; its content still
  shows `#@ghost.md` (verbatim, not stripped); injected===1.
- `#@sub/outsider.md` (imports `#@../shared/api.md`) → both injected; shared/api.md is OUTSIDE cwd but
  inside the markdown's parent; injected===2.
- `#@bigdoc.md` (imports 3 parts + `#@huge.log`) under a tight budget → bigdoc.md + 3 parts whole, huge.log
  paged; notify `4 whole, 1 paged`.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `75 passed, 0 failed`, exit 0. The 72 POST-S3 cases UNCHANGED (green).
- [ ] `injectMarkdown` does an `fs.stat`+`isFile` existence pre-check after `scanTokens` and before stripping;
      it strips + recurses only into `injectable` (existing files). Missing/dir imports keep `#@` verbatim.
- [ ] The fix is behavior-identical for S3 cases 15-19 (their imports all exist → `injectable === records`).
- [ ] Case 20 (PAGED_FIX + merged ctx): bigdoc.md + part1/2/3 whole, huge.log paged; `injected===5`,
      `paged===1`; block order pre-order (bigdoc < part1 < part2 < part3 < huge.log); notify
      `"#@ injected 4 whole, 1 paged"`; bigdoc markers stripped; huge.log has a head block + a directive
      block containing `"Use the read tool"`.
- [ ] MD1 (FIX): `notesMissing.md` (imports missing `#@ghost.md`) → `injected===1`; notesMissing.md block
      present; **`#@ghost.md` left VERBATIM** in its content; no ghost.md block; (negation) the stripped
      form `"Refs ghost.md here."` is NOT present.
- [ ] MD2 (FIX): `sub/outsider.md` (imports `#@../shared/api.md`) → `injected===2`; sub/outsider.md +
      shared/api.md blocks present; shared/api.md content `"Outside cwd."` present; shared/api.md is OUTSIDE
      cwd (`path.relative(TMPDIR, SHARED_API)` starts with `..`); marker stripped in outsider.md.
- [ ] Module-surface completeness guard passes: no shipped function is outside the 16-name curated list ∪
      {expandTildeAndResolve, extOf, isBinary}; `typeof mod.injectMarkdown === "undefined"` (stays private).
- [ ] No new exports, no new constants, no new npm deps, no README change.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the verified POST-S3 starting state (exact line anchors for
injectMarkdown L578, the sanity list L113-128, the merged-ctx pattern L989-1024, PAGED_FIX L252, the case
15-19 section L1248-1315, Summary L1317), the **first-hand-verified bug** in injectMarkdown (§2 of research
notes: current strips missing-import markers; live proof), the **exact one-edit fix** with before/after +
traced proof of backward-compat with all 5 S3 cases, the **exact completeness-guard code**, the **exact
fixture contents** (incl. the gotcha that top-level `api.md` EXISTS from S3 so the missing import must use a
distinct name `ghost.md`), the **traced budget math** for case 20 (remaining=23616; bigdoc+parts whole;
huge.log fileCost=524288≫14170→paged; injected=5, paged=1, notify `4 whole, 1 paged`), the **directive-format
gotcha** (the real format is `<large file — estimated N bytes; ... Use the read tool ...>`, NOT the PRD §6.1
`<paged:>` example), and the single authoritative green gate (72→75). The implementer edits one source
function + appends a guard + fixtures + consts + 3 cases, then runs one command.

### Documentation & References

```yaml
# MUST READ — the §10/§5.6.2 contract this subtask implements + the case-20 / edge specs
- file: PRD.md
  why: "§5.6.2 = the shared-budget accumulator (mutated in emission order, depth-first, across top-level +
        imports). §5.6 steps 3-6 = the injectMarkdown algorithm (scan → strip → emit → recurse); step 5 emits
        on the STRIPPED content; step 6 is PRE-ORDER (parent block before imports — this is WHY the strip
        decision must be made before recursion, forcing the stat pre-check). §10 edge rows: 'missing api.md
        → #@api.md left verbatim' and 'outside-cwd #@../shared/api.md → allowed (relative to md dir)'. §11
        case 20 = the shared-budget spec. §5.5 = paged directive format (NOTE: the §6.1 `<paged:>` example is
        STALE; the real code emits `<large file — ... Use the read tool ...>`, see file-injector.ts L180)."
  section: "### 5.6.2 + ### 5.6 (steps 3-6) + ## 10 (missing + outside-cwd rows) + ## 11 case 20"
  critical: "§10's 'missing → verbatim' OVERRIDES the naive reading of §5.6 step 4 (strip all records). The
             strip must be existence-aware. Pre-order (§5.6 step 6) prevents the top-level's inject-then-strip
             trick; the stat pre-check is the markdown analog, done eagerly before emission."

# MUST READ — the injectMarkdown fix + the §10 gap (first-hand verified)
- file: plan/003_4624515bcd82/P1M1T2S4/research/research_notes.md
  why: "§1 POST-S3 verified state (exact anchors); §2 THE BUG + the exact fix + traced backward-compat with
        cases 15-19; §3 edge (b) already-works proof; §4 case-20 budget math + traced execution + live proof;
        §5 module-surface (19 functions; guard design; injectMarkdown private); §6 placement anchors; §7 the
        api.md-exists gotcha for MD1."

# MUST READ — the merged-ctx notify pattern (case 20 reuses it) + PAGED_FIX
- file: ./file-injector.test.mjs
  why: "L989-1024 (PN2-PN4) show the merged-ctx pattern: makeMockCtx's notify-recording ui+hasUI + PAGED_FIX's
        budget, via captureHandler(). L252-256 = PAGED_FIX (remaining=23616). L133-143 = makeMockCtx. L807-810
        (PD1) shows the direct injectFiles(PAGED_FIX) paged assertion. L1171-1190 (BG1) shows the budget +
        emission-order assertion pattern case 20 generalizes to the recursion."
  section: "the PN2 merged-ctx block (L989-1024) + BG1 (L1171-1190) + PAGED_FIX (L252)"
  critical: "The handler output is {action,text,images} — it does NOT expose injected/paged directly. The
             counts come from the NOTIFY message ('#@ injected {whole} whole, {paged} paged'). So case 20
             ALSO calls injectFiles(PAGED_FIX) directly to assert injected===5/paged===1, then the handler
             (merged ctx) to assert the notify. Both share the PAGED_FIX budget."

# MUST READ — the S3 contract (injectMarkdown as S4 finds it; the recursion structure S4 preserves)
- file: plan/003_4624515bcd82/P1M1T2S3/PRP.md
  why: "S3 defined injectMarkdown's six-step structure (claim → scan → strip → emit → recurse). S4 MODIFIES
        the scan→strip→recurse middle (adds the stat pre-check) but preserves the claim/emit/recursion
        structure + the MD_EXTS branch + scanTokens opts {allowAbsTilde:false, skipCode:true} + baseDir=
        dirname(abs). S4 does NOT touch the MD_EXTS branch, scanTokens, emitText, injectFile classification,
        or injectFiles' signature/return."
  critical: "S3's Anti-Patterns carry over: no markdown-branch subtract (emitText owns text), no count++/
            depth-counter in injectMarkdown, emitText on STRIPPED content, MD_EXTS before isBinary. S4 adds
            ONE new invariant: strip + recurse use `injectable` (stat+isFile), not raw `records`."

# MUST READ — the dedup/branch-order + budget-mock facts
- file: plan/003_4624515bcd82/architecture/system_context.md
  why: "§5 fact 2 (dedup-bounded recursion, not depth); fact 3 (markdown bypasses NUL/binary routing; order
        empty-image→image→markdown→binary→text); fact 6 (ONE shared remaining). §6 = the PAGED_FIX budget
        mock + the case-20 intent ('a markdown importing several files + a big.log, under PAGED_FIX, asserting
        later files page against the running total')."
  critical: "§6 pins remaining=23616, PAGED_THRESHOLD·remaining=14170 — case 20's assertions derive from this."

# EXTERNAL — n/a. No new library/API surface. fs.stat/isFile are stdlib (already used in injectFile L452).
```

### Current Codebase tree (POST-S3, verified)

```bash
pi-file-injector/
├── file-injector.ts          # ← EDIT (797 lines): injectMarkdown L578-602 (PRIVATE; the §10 fix goes here);
│                             #    injectFile L450-501 (MD_EXTS branch L482 → calls injectMarkdown); scanTokens
│                             #    L387 (sync, no-existence-check — UNCHANGED); emitText L505 (owns subtract);
│                             #    formatPagedDirectiveBlock L180 ('<large file — ... Use the read tool ...>').
├── file-injector.test.mjs    # gate (1337 lines; 72 runCase; sanity list L113-128 = 16 asserts). EDIT: +guard
│                             #   after L128; +fixtures in buildFixtures; +path consts near L229; +case 20 +
│                             #   MD1 + MD2 after case 19 (L1315), before Summary (L1317).
├── package.json              # untouched
├── PRD.md                    # read-only
├── README.md                 # untouched (Mode B = T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/{system_context,codebase_insertion_points,external_deps}.md
    ├── P1M1T2S3/PRP.md                    # ← S3 contract (injectMarkdown structure S4 preserves)
    └── P1M1T2S4/
        ├── research/research_notes.md     # ← first-hand verification + the bug + the fix + budget math
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectMarkdown: insert stat+isFile existence pre-check (Step 3.5) after
                          #                  scanTokens; strip + recurse into `injectable` (not raw `records`);
                          #                  update the JSDoc to cite PRD §10/§5.4 + the pre-order rationale.
                          #                  NO other function touched.
file-injector.test.mjs    # MODIFIED — (a) module-surface completeness guard after L128; (b) fixtures:
                          #                  bigdoc.md/part1.txt/part2.txt/part3.txt/notesMissing.md/sub/
                          #                  outsider.md/shared/api.md (+ shared/ mkdir); (c) path consts
                          #                  BIGDOC/PART1/PART2/PART3/NOTES_MISSING/OUTSIDER/SHARED_API;
                          #                  (d) 3 runCase (20, MD1, MD2) after case 19, before Summary.
# No new files. No new deps. No new exports. No new constants in the .ts.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the §10 fix is the LOAD-BEARING change. S3's injectMarkdown strips ALL scan-resolved markers,
//   but scanTokens does NOT stat. A missing import's marker is therefore stripped (WRONG: PRD §10 wants it
//   verbatim). VERIFIED LIVE: notesMissing.md importing a missing ghost.md → current code shows "Refs
//   ghost.md here." (stripped); REQUIRED: "Refs #@ghost.md here." (verbatim). The fix: stat+isFile pre-check.

// CRITICAL — pre-order (§5.6 step 6) is WHY the fix is a stat pre-check, NOT inject-then-strip. injectMarkdown
//   emits THIS file's block (Step 5) BEFORE recursing (Step 6). So the strip decision must be made BEFORE
//   recursion. The top-level path (processTokenStream) can inject-then-strip because the user prompt is not
//   a pre-order block. The markdown path cannot. Stat each import eagerly; injectFile re-stats harmlessly.

// CRITICAL — the stat pre-check MUST be `st.isFile()`, not just stat-succeeds. A DIRECTORY import
//   (`#@src/`) stats-true but isFile=false → not in injectable → marker verbatim (matches §5.4: directory →
//   verbatim). Without the isFile guard, a directory import would be stripped-but-not-injected (same bug
//   class as missing). The isFile check ALSO matches injectFile's own `if (!st.isFile()) return false`.

// CRITICAL — recurse into `injectable` (the existence-filtered subset), NOT raw `records`. A missing import
//   is not in injectable → not recursed (injectFile would return false anyway; skipping it is a clean no-op).
//   Iterating injectable is correct AND avoids a doomed injectFile(missing) call.

// CRITICAL — top-level api.md EXISTS (S3 fixture, content "Top-level API surface."). So MD1's missing import
//   MUST use a DISTINCT name that is never created. Use `ghost.md` (genuinely absent). Do NOT use api.md for
//   the missing case — it would resolve to the existing top-level api.md and NOT be missing.

// CRITICAL — the paged directive format is '<large file — estimated N bytes; first M lines injected above.
//   Use the read tool to read the rest: offset:X, limit:2000, ...>' (file-injector.ts L180). It is NOT
//   '<paged: ...>' (that is the PRD §6.1 EXAMPLE, stale vs the real code). Case 20 asserts the substring
//   "Use the read tool" (stable across the real format). Do NOT assert "paged:".

// CRITICAL — the handler output {action,text,images} does NOT expose injected/paged. The counts come from
//   the NOTIFY message via the merged ctx. Case 20 asserts injected===5/paged===1 via a DIRECT
//   injectFiles(PAGED_FIX) call, and the notify "4 whole, 1 paged" via a SEPARATE handler(merged-ctx) call.
//   Both share the PAGED_FIX budget (merged ctx = makeMockCtx ui + PAGED_FIX budget).

// CRITICAL — the merged-ctx pattern (PN2, L1001): `const { ctx: base, rec } = makeMockCtx(TMPDIR);
//   const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };` then
//   `const slot = captureHandler(); const out = await slot.cb({text, source:"interactive", images:[]}, ctx);`.
//   rec.notify.m holds the message. captureHandler() captures the "input" handler (default event).

// CRITICAL — the completeness guard must treat `default` as a shipped function (it IS: typeof mod.default
//   === "function" is asserted L113). Object.keys(mod) includes "default". Include it in ASSERTED_EXPORTS.

// GOTCHA — huge.log is 2 MB (fileCost=⌈2097152/4⌉=524288). Under PAGED_FIX (remaining=23616,
//   PAGED_THRESHOLD·remaining=14170), 524288 ≫ 14170 → ALWAYS paged, regardless of what came before. So
//   huge.log pages in case 20 because IT is huge, not because the budget was exhausted by the imports. The
//   "shared budget" signal in case 20 is: (a) the accumulator spans the recursion (each emission decrements
//   the SAME remaining), (b) huge.log pages when imported TRANSITIVELY, (c) notify counts ALL 5 files. The
//   top-level budget-FLIP is proven by BG1-BG3; case 20 proves the recursion spans it.

// GOTCHA — case 20's bigdoc.md imports part1/2/3.txt which are SMALL (fileCost≈5 ≪ 14170 → whole). After
//   bigdoc.md (fileCost≈19) + 3 parts, remaining ≈ 23582 (still huge). huge.log then pages. So injected=5,
//   paged=1, whole=4. The imports do NOT push each other over the threshold (they're tiny); huge.log pages
//   on its own size. This is fine — the assertion is the counts + the shared accumulator + notify, not a flip.

// GOTCHA — `fs` (node:fs promises) is already imported in file-injector.ts (used by injectFile L452:
//   `await fs.stat(abs)`). The fix uses `await fs.stat(r.abs)` — no new import. `st.isFile()` is the same
//   check injectFile uses (L453). Keep the try/catch (stat throws ENOENT on missing → caught → verbatim).

// LIBRARY — TypeScript via jiti (Pi's loader). No build step. The .mjs harness imports file-injector.ts
//   directly. A SYNTAX error or UNDEFINED-IDENTIFIER reference fails the harness import → sanity asserts
//   never run → exit non-zero. The ONLY gate is `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### `injectMarkdown` — the §10 fix (file-injector.ts L578; PRIVATE)

**CURRENT (S3, the bug) — the scan→strip→recurse middle:**
```ts
  // Step 3 — scan for imports: relative-only (allowAbsTilde:false), outside code (skipCode:true).
  const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);

  // Step 4 — strip '#@' from each resolved import marker (high→low so earlier offsets stay valid), leaving
  // the path. `stripped` becomes THIS file's block content.
  let stripped = content;
  for (const r of [...records].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is the '#' (lookbehind is zero-width)
  }

  // Step 5 — emit THIS file's block. The paged decision runs on the STRIPPED content (§5.6 step 5).
  emitText(abs, stripped, state); // emitText owns formatTextFileBlock + subtract + the paged head/directive + state.paged++

  // Step 6 — recurse into imports, depth-first, ENCOUNTER ORDER (pre-order). Each record.abs already passed
  // dedup at scan time; the injectedSet re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(r.abs, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
```

**AFTER (S4 fix) — insert the existence pre-check; strip + recurse into `injectable`:**
```ts
  // Step 3 — scan for imports: relative-only (allowAbsTilde:false), outside code (skipCode:true).
  const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);

  // Step 3.5 — EXISTENCE PRE-CHECK (PRD §10 / §5.4). scanTokens records a token as soon as it RESOLVES (it
  // does NOT stat), so a markdown import resolving to a MISSING file or DIRECTORY would otherwise have its
  // '#@' marker stripped (Step 4) even though injectFile later returns false and nothing is injected for it.
  // PRD §10 requires such markers be left VERBATIM. Pre-order (§5.6 step 6) emits THIS file's block BEFORE
  // recursing, so the strip decision must be made NOW (the top-level path can inject-then-strip because the
  // user prompt is not a pre-order block; the markdown path cannot). Stat each import; keep only those that
  // stat-succeed AND are regular files (isFile also rejects directories, matching injectFile's own check).
  // injectFile re-stats harmlessly on recursion. A read-error (stat-succeeds but read throws — rare, not in
  // §10) still strips; acceptable: §10 specifies missing only.
  const injectable: { index: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (st.isFile()) injectable.push(r);
    } catch {
      /* missing/unreadable → leave verbatim (not stripped, not injected) */
    }
  }

  // Step 4 — strip '#@' from each INJECTABLE import marker (high→low so earlier offsets stay valid), leaving
  // the path. `stripped` becomes THIS file's block content. Missing/dir imports keep '#@' verbatim.
  let stripped = content;
  for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is the '#' (lookbehind is zero-width)
  }

  // Step 5 — emit THIS file's block. The paged decision runs on the STRIPPED content (§5.6 step 5).
  emitText(abs, stripped, state); // emitText owns formatTextFileBlock + subtract + the paged head/directive + state.paged++

  // Step 6 — recurse into INJECTABLE imports, depth-first, ENCOUNTER ORDER (pre-order). Missing/dir imports
  // are absent here (they would no-op in injectFile anyway). The injectedSet re-check is belt-and-suspenders.
  for (const r of injectable) {
    if (state.injectedSet.has(r.abs)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(r.abs, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
```

> **The ONLY changes:** (1) insert the `injectable` stat+isFile loop after Step 3; (2) Step 4 iterates
> `injectable` instead of `records`; (3) Step 6 iterates `injectable` instead of `records`. The claim (Step 2),
> the scan opts (Step 3), the emitText call (Step 5), the injectedSet re-check (Step 6), and the recursion
> call (`await injectFile(r.abs, state, ctx)`) are UNCHANGED. Update the JSDoc above injectMarkdown to cite
> PRD §10/§5.4 and note the pre-check (Step 3.5) + that `injectable ⊆ records` (existing files only).

### Module-surface completeness guard (file-injector.test.mjs, AFTER L128)

```js
// ── MODULE-SURFACE COMPLETENESS (S4 sync) ── The 16 asserts above name the MEANINGFUL exports. This guard
// enforces the FULL contract: every function the module SHIPS is either (a) asserted by name above, or (b) a
// known pure helper tested indirectly. It catches a future export added without a sanity assert, AND catches
// injectMarkdown (the PRIVATE recursion driver) being accidentally exported. (PRD §11 "the gate must assert
// the real shipped module surface"; item LOGIC (c).)
const ASSERTED_EXPORTS = new Set([
  "default", "injectFiles", "cleanToken", "formatTextFileBlock", "formatImageBlock", "formatBinaryBlock",
  "formatEmptyImageBlock", "formatPagedDirectiveBlock", "hasValidImageMagic", "scanTokens", "injectFile",
  "emitText", "isAbsoluteOrTilde", "computeCodeRanges", "inCode", "estimateImageTokens",
]);
const PURE_HELPERS_NOT_ASSERTED = new Set(["expandTildeAndResolve", "extOf", "isBinary"]); // tested indirectly via injectFiles
{
  const shippedFunctions = new Set(Object.keys(mod).filter((k) => typeof mod[k] === "function"));
  const unexpected = [...shippedFunctions].filter((k) => !ASSERTED_EXPORTS.has(k) && !PURE_HELPERS_NOT_ASSERTED.has(k));
  assert(unexpected.length === 0,
    `module ships functions not in the sanity list: ${unexpected.join(", ")} ` +
      `(add a typeof-assert above, or — if it is injectMarkdown — keep it PRIVATE and exercise via injectFiles)`);
  // injectMarkdown is the PRIVATE recursion driver (exercised via injectFiles). Assert it is NOT exported.
  assert(typeof mod.injectMarkdown === "undefined",
    "injectMarkdown must NOT be exported — it is a PRIVATE recursion driver (exercised via injectFiles; PRD §5.6)");
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: FIX injectMarkdown in file-injector.ts (L578) — the §10 existence pre-check (Blueprint above)
  - EDIT: insert the `injectable` stat+isFile loop (Step 3.5) after `const records = scanTokens(...)`;
          change Step 4's `[...records]` → `[...injectable]`; change Step 6's `for (const r of records)` →
          `for (const r of injectable)`.
  - PRESERVE: Step 2 claim (state.injectedSet.add(abs)); Step 3 scan opts {allowAbsTilde:false, skipCode:true}
          + baseDir=dirname(abs); Step 5 emitText(abs, stripped, state); Step 6's `if (state.injectedSet.has
          (r.abs)) continue` + `await injectFile(r.abs, state, ctx)`. NO markdown-branch subtract. NO count++.
  - JSDOC: [Mode A] cite PRD §10/§5.4; note Step 3.5 (existence pre-check; missing/dir → verbatim; pre-order
          forces the eager decision); note injectable ⊆ records; note injectFile re-stats harmlessly.
  - VERIFY (after Task 1, BEFORE adding tests): `node ./file-injector.test.mjs` MUST still print
          `72 passed, 0 failed`. The fix is behavior-identical for cases 15-19 (their imports all exist →
          injectable===records). If ANY of 15-19 flips, you changed more than the 3 lines above — diff.

Task 2: ADD the module-surface completeness guard (file-injector.test.mjs, AFTER L128 — after the
        estimateImageTokens assert, before the section-7 comment)
  - IMPLEMENT: the ASSERTED_EXPORTS + PURE_HELPERS_NOT_ASSERTED block per the Blueprint. One `{…}` scope.
  - VERIFY: the gate still prints `72 passed, 0 failed` (the guard is 2 new asserts; runCase count unchanged
          — the guard uses bare `assert`, like the 16 sanity asserts, NOT runCase). If it fails,
          `unexpected` names a function missing from ASSERTED_EXPORTS/PURE_HELPERS — add it (or, if it is
          injectMarkdown, the .ts wrongly exported it: remove the `export`).

Task 3: ADD fixtures to buildFixtures (among the writeFileSync calls ~L200-219; match existing style)
  - ADD (simple writeFileSync + 1 mkdir; sub/ already exists from S3):
      fsSync.writeFileSync(path.join(TMPDIR, "bigdoc.md"),
        "# Bigdoc\n\n- One: #@part1.txt\n- Two: #@part2.txt\n- Three: #@part3.txt\n- Logs: #@huge.log\n");
      fsSync.writeFileSync(path.join(TMPDIR, "part1.txt"), "Part one content.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "part2.txt"), "Part two content.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "part3.txt"), "Part three content.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "notesMissing.md"), "# Notes\n\nRefs #@ghost.md here.\n");
      // sub/ already created by S3 (fsSync.mkdirSync(path.join(TMPDIR, "sub"), { recursive: true }));
      fsSync.writeFileSync(path.join(TMPDIR, "sub", "outsider.md"), "# Sub\n\nSee #@../shared/api.md here.\n");
      fsSync.mkdirSync(path.join(TMPDIR, "shared"), { recursive: true });   // OUTSIDE cwd-relative-to-subdir
      fsSync.writeFileSync(path.join(TMPDIR, "shared", "api.md"), "# Shared API\n\nOutside cwd.\n");
      // ghost.md is INTENTIONALLY NOT created — it is the missing import for MD1.
  - GOTCHA: top-level api.md EXISTS (S3). MD1's missing import is `#@ghost.md` (distinct, never created) —
            do NOT use api.md for the missing case.
  - GOTCHA: part1/2/3.txt + bigdoc.md reuse the existing huge.log (case 20's `#@huge.log` resolves to
            TMPDIR/huge.log, the S2 fixture — no new 2 MB file). huge.log content is already byte-pinned by
            cases 2/PD1/BG1-3; case 20 does NOT assert huge.log's content, only that it PAGES.
  - PRESERVE: every existing fixture (a.ts/b.ts/a.txt/pic.png/data.bin/empty.txt/fake.png/empty.png/src/
            huge.log + S3's notes.md/api.md/a.md/b.md/notesAbs.md/sub/notes.md/sub/api.md) + huge.log computation.

Task 4: ADD path constants (after HUGE L229, near the S3 md consts; grouped with existing consts)
  - ADD:
      const BIGDOC = path.join(TMPDIR, "bigdoc.md");
      const PART1 = path.join(TMPDIR, "part1.txt");
      const PART2 = path.join(TMPDIR, "part2.txt");
      const PART3 = path.join(TMPDIR, "part3.txt");
      const NOTES_MISSING = path.join(TMPDIR, "notesMissing.md");
      const OUTSIDER = path.join(TMPDIR, "sub", "outsider.md");
      const SHARED_API = path.join(TMPDIR, "shared", "api.md");
  - PATTERN: matches A_TS/B_TS/HUGE/NOTES/SUB_API (S3). (GHOST is never a const — it has no path; assert its
            ABSENCE via `!r.text.includes('<file name="' + path.join(TMPDIR,'ghost.md') + '">')`.)

Task 5: ADD the test section (after case 19's closing `});` ~L1315, BEFORE `// 10. Summary` L1317)
  - HEADING: `// ── SHARED BUDGET (§5.6.2) + MARKDOWN EDGES (§10) — case 20 + MD1 + MD2 ──`
  - IMPLEMENT: 3 runCase blocks per the per-case specs below. case 20 = numeric (PRD §11 row 20); MD1/MD2 =
            named (markdown edges; "MD" prefix is free — no existing MDn). case 20 uses PAGED_FIX (direct)
            + merged-ctx (handler); MD1/MD2 use FIX (no budget → all whole).
  - PRESERVE: every existing case (incl. 15-19) + the 16 sanity asserts + the completeness guard + summary/exit.

Task 6: VERIFY — run the gate
  - RUN: cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs
  - EXPECT: `Result: 75 passed, 0 failed.` (72 + 3), exit 0.
  - CONFIRM: the 72 POST-S3 cases ALL stay green (the injectMarkdown fix is behavior-identical for 15-19). If
            any of 15-19 flips, you changed more than the 3 injectMarkdown lines — diff against the Blueprint.
```

### Test Case Specs (the 3 runCase blocks — exact assertions)

```js
// Case 20 — §5.6.2 SHARED BUDGET across the markdown recursion. bigdoc.md imports 3 parts + huge.log;
// under PAGED_FIX the accumulator spans the recursion: bigdoc + 3 parts whole, huge.log paged. notify counts
// ALL 5 files. (Two sub-calls: direct injectFiles for the counts/blocks; merged-ctx handler for the notify.)
await runCase(20, "§5.6.2 shared budget: bigdoc.md + 3 imports whole, huge.log paged; notify counts all 5", async () => {
  // (1) DIRECT — injectFiles(PAGED_FIX): structural counts + blocks + order + marker stripping.
  //     remaining=23616; bigdoc(≈19)+part1(≈5)+part2(≈5)+part3(≈5) whole; huge.log(524288≫14170) paged.
  const r = await mod.injectFiles("Read #@bigdoc.md", [], PAGED_FIX);
  assert(r.injected === 5, `bigdoc + 3 parts + huge.log delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly huge.log paged, got paged=${r.paged}`);
  assert(r.injected - r.paged === 4, `4 whole (bigdoc + 3 parts), got whole=${r.injected - r.paged}`);
  // Pre-order DFS block order: bigdoc.md < part1 < part2 < part3 < huge.log(head).
  const iB = r.text.indexOf('<file name="' + BIGDOC + '">');
  const i1 = r.text.indexOf('<file name="' + PART1 + '">');
  const i2 = r.text.indexOf('<file name="' + PART2 + '">');
  const i3 = r.text.indexOf('<file name="' + PART3 + '">');
  const iH = r.text.indexOf('<file name="' + HUGE + '">\n'); // head block (content follows the '>\n')
  assert(iB !== -1 && i1 !== -1 && i2 !== -1 && i3 !== -1 && iH !== -1, "all 5 files have blocks");
  assert(iB < i1 && i1 < i2 && i2 < i3 && i3 < iH,
    `pre-order DFS: bigdoc<part1<part2<part3<huge.log, got iB=${iB},i1=${i1},i2=${i2},i3=${i3},iH=${iH}`);
  // huge.log PAGED: a head block + a directive block (2 occurrences of its <file name> tag). The directive
  // uses the REAL format '<large file — ... Use the read tool ...>' (NOT '<paged:>'; see file-injector.ts L180).
  const hugeTags = (r.text.match(new RegExp('<file name="' + HUGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(hugeTags === 2, `huge.log must have a HEAD block + a DIRECTIVE block (2 tags), got ${hugeTags}`);
  assert(r.text.includes("Use the read tool"), "huge.log paged directive present (real format; §5.5)");
  // bigdoc.md's import markers are STRIPPED (all 4 imports resolved+exist → injectable → stripped).
  assert(r.text.slice(iB, i1).includes("Logs: huge.log."), "bigdoc.md block: the #@huge.log marker stripped to huge.log");
  assert(!r.text.slice(iB, i1).includes("#@"), "bigdoc.md block must contain NO '#@' markers (all imports resolved+stripped)");

  // (2) NOTIFY — merged ctx (makeMockCtx ui + PAGED_FIX budget) via the handler. Counts come from the message.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Read #@bigdoc.md", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 4 whole, 1 paged",
    `notify must count EVERY delivered file across the recursion (4 whole + 1 paged), got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

// MD1 — §10 EDGE: a markdown importing a MISSING file leaves the import marker VERBATIM (not stripped).
// Exercises the injectMarkdown §10 fix (Task 1). FIX = no budget → notesMissing.md whole.
await runCase("MD1", "§10 md edge: notesMissing.md imports missing ghost.md → marker VERBATIM, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesMissing.md", [], FIX);
  assert(r.injected === 1, `only notesMissing.md injected (ghost.md is missing), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesMissing.md"), "top-level #@notesMissing.md marker stripped to notesMissing.md");
  assert(r.text.includes('<file name="' + NOTES_MISSING + '">'), "notesMissing.md block present");
  // THE §10 FIX: the missing import marker is LEFT VERBATIM (not stripped) — nothing was injected for it.
  assert(r.text.includes("Refs #@ghost.md here."), "the MISSING import marker #@ghost.md must be left VERBATIM (§10)");
  assert(!r.text.includes("Refs ghost.md here."), "the missing import marker must NOT be stripped (no bare 'ghost.md' reference)");
  assert(!r.text.includes('<file name="' + path.join(TMPDIR, "ghost.md") + '">'), "ghost.md must NOT be injected (it does not exist)");
});

// MD2 — §10 EDGE: a markdown import resolving OUTSIDE cwd (via ../) is ALLOWED (relative to the md's dir).
// Pure regression test — this ALREADY works (imports resolve from dirname(abs), not cwd). FIX = no budget.
await runCase("MD2", "§10 md edge: sub/outsider.md imports #@../shared/api.md → allowed (md's dir, outside cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/outsider.md", [], FIX);
  assert(r.injected === 2, `sub/outsider.md + shared/api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read sub/outsider.md"), "top-level #@sub/outsider.md marker stripped to sub/outsider.md");
  assert(r.text.includes('<file name="' + OUTSIDER + '">'), "sub/outsider.md block present");
  assert(r.text.includes('<file name="' + SHARED_API + '">'), "shared/api.md block present (resolved via ../, outside cwd)");
  // shared/api.md is OUTSIDE cwd (TMPDIR) but INSIDE the markdown's parent — explicitly ALLOWED (§10).
  assert(path.relative(TMPDIR, SHARED_API) === path.join("shared", "api.md"),
    `shared/api.md resolves under TMPDIR/shared (the md's parent's sibling), got rel=${path.relative(TMPDIR, SHARED_API)}`);
  assert(r.text.includes("Outside cwd."), "shared/api.md's DISTINCT content present (proves the outside-cwd file was injected)");
  // the import marker is STRIPPED (the import resolved + exists → injectable → stripped).
  assert(r.text.includes("See ../shared/api.md here."), "sub/outsider.md block: the #@../shared/api.md marker stripped to ../shared/api.md");
  assert(!r.text.includes("#@../shared/api.md"), "the resolved outside-cwd import marker must NOT retain #@");
});
```

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    edit (injectMarkdown L578): insert the `injectable` stat+isFile loop (Step 3.5); Step 4 + Step 6 iterate
          `injectable` (not `records`). Update the JSDoc (cite §10/§5.4; note Step 3.5 + pre-order rationale).
    preserve: MD_EXTS (L37) + the injectFile MD_EXTS branch (L482); scanTokens (L387, UNCHANGED — sync,
          no-existence-check); emitText (L505, owns subtract); injectFile classification + count++ (L499);
          injectFiles signature/return; the factory; the autocomplete provider; ALL other functions.

  - modify: file-injector.test.mjs
    add (after L128): the module-surface completeness guard (ASSERTED_EXPORTS + PURE_HELPERS_NOT_ASSERTED +
          the injectMarkdown-not-exported assert).
    add (buildFixtures ~L200-219): bigdoc.md, part1/2/3.txt, notesMissing.md, sub/outsider.md, shared/api.md
          (+ shared/ mkdir). ghost.md INTENTIONALLY absent.
    add (after HUGE L229): BIGDOC/PART1/PART2/PART3/NOTES_MISSING/OUTSIDER/SHARED_API consts.
    add (after case 19 ~L1315, before Summary L1317): case 20 + MD1 + MD2 (3 runCase).
    preserve: the 16 sanity asserts + the 72 existing cases (incl. 15-19) + the summary/exit logic.

NO OTHER CHANGES:
  - package.json / README.md: untouched (Mode B docs = T3.S1).
  - no new files, no new deps, no new exports, no new .ts constants.

BEHAVIOR FOR EXISTING-MARKDOWN-IMPORTS: UNCHANGED. Cases 15-19 (all imports exist) → injectable===records →
  byte-identical blocks/counts. This is why all 72 stay green after the fix.

BEHAVIOR FOR MISSING/DIR MARKDOWN-IMPORTS: FIXED. The marker is now left VERBATIM (was wrongly stripped).
  This is the §10 contract; MD1 asserts it.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No tsc/lint gate. The .mjs harness loads file-injector.ts via jiti (transpile-on-load). A SYNTAX error or
# an UNDEFINED-IDENTIFIER reference (e.g. referencing `injectable` before its declaration, or a typo in the
# stat loop) surfaces as the harness failing to import → the 16 sanity asserts never run → exit non-zero
# with a jiti/TS error.

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -30
# Expected: the 16 sanity asserts + the completeness guard pass, then the case matrix begins (now incl. 20/MD1/MD2).
# A jiti/TS error here means: (a) `injectable` referenced before declaration (it's a const — declare before use),
# (b) a typo (fs.stat / st.isFile / injectable), (c) malformed syntax in the guard block. READ the error, fix.
```

### Level 2: The Regression Gate (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   ... (matrix rows, incl. your new case 20 / MD1 / MD2 rows) ...
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 75 passed, 0 failed.        # 72 (POST-S3) + 3 (case 20, MD1, MD2)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL: the 72 POST-S3 cases MUST all stay green. If the count is <72:
#   - A S3 case (15-19) flipped → the injectMarkdown fix changed behavior for an EXISTING import. The fix
#     iterates `injectable` (⊆ records); for cases 15-19 injectable===records (all imports exist), so they
#     MUST be byte-identical. If one flipped, you changed more than the 3 lines (Step 3.5 insert + Step 4/6
#     records→injectable) — diff injectMarkdown against the Blueprint.
#   - The completeness guard failed → `unexpected` names a function. If it's a real export, add it to
#     ASSERTED_EXPORTS (or PURE_HELPERS if indirect). If it's injectMarkdown, the .ts wrongly exported it.
#   - An earlier case (<15) flipped → you touched a function beyond injectMarkdown (scanTokens/emitText/
#     injectFile/injectFiles). S4 edits ONLY injectMarkdown + the test file. Diff the .ts.
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# MD1 FAILS (marker stripped instead of verbatim) → the §10 fix is missing or wrong:
#   - You did NOT add the stat+isFile pre-check (Step 3.5). injectMarkdown still iterates `records` in
#     Step 4/6. Re-apply the Blueprint: insert the `injectable` loop; Step 4 + Step 6 use `injectable`.
#   - You used `st` without `.isFile()` — a missing file throws (caught → verbatim ✓), but a DIRECTORY
#     import would wrongly strip. MD1 uses a missing FILE (stat throws), so this specific bug wouldn't
#     surface in MD1, but add isFile() anyway for §5.4 directory correctness.
#   - You recursed into `records` instead of `injectable` in Step 6 — harmless (injectFile(missing) returns
#     false), but the STRIP must use `injectable`. The bug is in Step 4, not Step 6.

# A S3 case 15-19 flips (e.g. case 15 injected≠2, or marker not stripped) → the fix broke an existing import:
#   - You changed the scan opts or baseDir. They MUST stay {allowAbsTilde:false, skipCode:true} +
#     path.dirname(abs). S4 does NOT touch scanTokens or the scan call.
#   - You changed emitText(abs, stripped, state) → emitText(abs, content, state). Step 5 still uses `stripped`.
#   - You removed the injectedSet re-check (`if (state.injectedSet.has(r.abs)) continue`) — re-add it.

# Case 20 FAILS (injected≠5 / paged≠1 / notify wrong) → likely causes:
#   - The bigdoc.md fixture wasn't added (buildFixtures) → `#@bigdoc.md` is missing → injected===0.
#   - huge.log not paging → you're not under PAGED_FIX (case 20's direct call MUST pass PAGED_FIX, not FIX).
#   - notify ≠ "4 whole, 1 paged" → the merged ctx wasn't built (must spread makeMockCtx's base + PAGED_FIX's
#     getContextUsage+model), OR captureHandler() captured the wrong event (default "input" is correct).
#   - hugeTags ≠ 2 → huge.log didn't page (only a head, no directive) — check r.paged===1 and that emitText's
#     paged path ran (huge.log fileCost=524288 ≫ 14170 under PAGED_FIX).

# MD2 FAILS (injected≠2 / shared/api.md absent) → likely causes:
#   - shared/ mkdir missing, or shared/api.md not written → the import is missing → (with the fix) verbatim,
#     injected===1. Re-check the fixture writes.
#   - The marker `#@../shared/api.md` didn't resolve → cleanToken/expandTildeAndResolve issue (unlikely;
#     verified working). Check the fixture string exactly: "See #@../shared/api.md here.\n".

# Re-run focusing on failures:
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|case 20|MD1|MD2|sanity|completeness"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2. No model, no network, no server, no DB.
# Optional manual sanity (proves the §10 fix visually — NOT required for the gate):
node --input-type=module -e '
  import { execSync } from "node:child_process"; import * as path from "node:path"; import * as os from "node:os";
  import * as fs from "node:fs";
  const PIPKG = execSync("npm root -g").toString().trim()+"/@earendil-works/pi-coding-agent";
  const { createJiti } = await import(PIPKG+"/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(import.meta.url,{alias:{"@earendil-works/pi-coding-agent":PIPKG+"/dist/index.js","@earendil-works/pi-ai":PIPKG+"/node_modules/@earendil-works/pi-ai/dist/compat.js"}});
  const mod = await jiti.import(path.resolve("file-injector.ts"));
  const d = fs.mkdtempSync(path.join(os.tmpdir(),"md10-"));
  fs.writeFileSync(path.join(d,"n.md"),"# N\n\nRefs #@ghost.md here.\n"); // ghost.md absent
  const r = await mod.injectFiles("Review #@n.md",[],{cwd:d});
  console.log("injected:",r.injected,"(expect 1)");
  console.log("VERBATIM #@ghost.md:",r.text.includes("Refs #@ghost.md here."),"(expect true — the §10 fix)");
  console.log("STRIPPED ghost.md:",r.text.includes("Refs ghost.md here."),"(expect false)");
  fs.rmSync(d,{recursive:true,force:true});
'
# Expected: injected===1; VERBATIM true; STRIPPED false. (Mirrors MD1.) If VERBATIM is false, the fix is missing.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `75 passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error (the 16 sanity asserts + the completeness guard all run).
- [ ] `injectMarkdown` does an `fs.stat`+`isFile` pre-check; strips + recurses into `injectable` (not `records`).
- [ ] The 72 POST-S3 cases ALL stay green (the fix is behavior-identical for cases 15-19).

### Feature Validation

- [ ] Case 20: bigdoc.md + part1/2/3 whole, huge.log paged; injected===5, paged===1; pre-order block order;
      notify "#@ injected 4 whole, 1 paged"; huge.log has head + directive (2 tags, "Use the read tool").
- [ ] MD1: notesMissing.md imports missing ghost.md → injected===1; `#@ghost.md` VERBATIM; no ghost.md block.
- [ ] MD2: sub/outsider.md imports `#@../shared/api.md` → injected===2; shared/api.md (outside cwd) injected;
      marker stripped.
- [ ] Module-surface completeness guard: no unexpected exports; injectMarkdown NOT exported.

### Code Quality Validation

- [ ] The injectMarkdown fix touches ONLY the scan→strip→recurse middle (Step 3.5 insert + Step 4/6 records→injectable).
- [ ] No new exports / constants in the .ts. No new deps. No markdown-branch subtract. No count++ in injectMarkdown.
- [ ] The completeness guard's ASSERTED_EXPORTS matches the 16 sanity-asserted names; PURE_HELPERS = the 3 indirect helpers.
- [ ] MD1 uses `ghost.md` (genuinely missing), NOT api.md (which exists from S3).

### Documentation

- [ ] [Mode A] injectMarkdown JSDoc updated to cite PRD §10/§5.4 + the Step 3.5 existence pre-check + the
      pre-order rationale (why the markdown strip is eager, unlike the top-level inject-then-strip).
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT add MD1 as a test-only case without the injectMarkdown fix.** The current S3 code STRIPS the
  missing-import marker (verified live). MD1 would fail (`Refs #@ghost.md here.` absent). The fix (Task 1) is
  a PREREQUISITE for MD1 — do it FIRST.
- ❌ **Do NOT make the markdown strip inject-then-strip (reorder Step 5 after Step 6).** Pre-order (§5.6 step 6)
  requires the parent block BEFORE imports. Reordering would break cases 15/17/19 (pre-order assertions) AND
  the model's context order (parent before detail). Use the stat pre-check (Step 3.5), which preserves pre-order.
- ❌ **Do NOT stat-check WITHOUT `isFile()`.** A missing file throws (caught → verbatim ✓), but a DIRECTORY
  import (`#@src/`) stats-true → would wrongly strip. `st.isFile()` rejects directories (matches injectFile's
  own check + §5.4).
- ❌ **Do NOT use `api.md` as MD1's missing import.** Top-level api.md EXISTS (S3 fixture). Use `ghost.md`
  (genuinely absent). If you use api.md, MD1 would inject the existing api.md (injected===2, not 1) and the
  marker would be stripped (not verbatim) — the test would fail.
- ❌ **Do NOT assert `"paged:"` for huge.log's directive.** The real format is `<large file — estimated N
  bytes; ... Use the read tool ...>` (file-injector.ts L180). The PRD §6.1 `<paged:>` example is STALE. Assert
  `"Use the read tool"` + 2 huge.log tags (head + directive).
- ❌ **Do NOT get injected/paged from the handler output.** The handler returns {action,text,images} — NO
  counts. Get counts from a DIRECT injectFiles(PAGED_FIX) call (case 20 sub-call 1) AND from the notify
  message via the merged-ctx handler (sub-call 2). Both share the PAGED_FIX budget.
- ❌ **Do NOT touch scanTokens / emitText / injectFile / injectFiles / the MD_EXTS branch / the factory / the
  autocomplete provider.** S4 edits ONLY injectMarkdown (the fix) + the test file. Every other function is a
  sibling's contract (T1.S2 / T2.S1 / T2.S2 / S3).
- ❌ **Do NOT add an export for injectMarkdown.** It is PRIVATE (exercised via injectFiles). The completeness
  guard ASSERTS it is not exported — exporting it would fail the guard AND is out of scope (item §6 DOCS).
- ❌ **Do NOT change the scan opts or baseDir.** injectMarkdown calls `scanTokens(content, path.dirname(abs),
  {allowAbsTilde:false, skipCode:true}, state)` — UNCHANGED. S4 only adds Step 3.5 + swaps records→injectable.
- ❌ **Do NOT skip Level 2.** The 75-test gate is authoritative. If any of the 72 POST-S3 cases flips, the
  injectMarkdown fix changed behavior for an existing import — diff against the Blueprint (injectable===records
  for all-existing imports, so 15-19 MUST be byte-identical).

---

## Confidence Score: 9/10

A tightly-scoped subtask with ONE load-bearing code fix + 3 tests + 1 guard. The fix (injectMarkdown stat
pre-check) is the crux: it closes the §10 gap S3 left (verified live — current code strips missing-import
markers; PRD §10 requires verbatim), and it is **provably backward-compatible** with all 5 S3 cases (their
imports all exist → `injectable === records` → byte-identical blocks/counts/count). Edge (b) (outside-cwd
`../`) is a pure regression test (verified already-working: imports resolve from `dirname(abs)`, not cwd).
Case 20's budget math is traced and live-verified (injected=5, paged=1, pre-order, notify `4 whole, 1 paged`).
The module-surface guard is live-verified (19 shipped functions ⊆ 16-asserted ∪ 3-pure-helpers; injectMarkdown
undefined). The PRP includes: the verified POST-S3 starting state (exact anchors), the first-hand bug proof +
the exact before/after fix + traced backward-compat, the exact guard code, the exact fixture contents (with
the api.md-exists → use-ghost.md gotcha), the 3 case-by-case test specs with exact assertions, the
directive-format gotcha (`<large file — ...>`, not `<paged:>`), and the single authoritative green gate
(72→75). The -1 reserves for: (a) the injectMarkdown fix touching a function S3 owns (a coordination seam —
mitigated by the strict "injectable ⊆ records → 15-19 byte-identical" proof + the diff-against-Blueprint
guidance), and (b) case 20's "shared budget" signal being structural (huge.log pages on its own size, not a
budget-exhaustion flip — mitigated by the explicit note that BG1-3 prove the flip and case 20 proves the
recursion spans the accumulator + notify counts all files). The implementing agent edits one source function
+ appends a guard + fixtures + consts + 3 cases, then runs one command.
