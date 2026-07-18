---
name: "P1.M1.T1.S2 (bugfix 001_a4cee0dcf39c) — update import-behavior test 4f + add primary-gate regression cases (Issue 1)"
prd_ref: "bugfix PRD §h3.0 Issue 1 (resolveImportPath truncation injects the WRONG file); §4.4 (top-level exact-only); §4.5 rule 3 (extended tokens exact-only); architecture/issue4_image_and_tests.md (harness patterns)"
target_file: "./import-behavior.test.mjs + ./file-injector.test.mjs"   # TEST-ONLY — file-injector.ts stays as S1 left it (fmtCut fix landed)
target_language: JavaScript (.mjs; zero-dependency harnesses; load the REAL .ts via jiti + Pi's alias map)
depends_on: "P1.M1.T1.S1 (FULLY LANDED: resolveImportPath extCut → fmtCut + cleanToken(fmtCut) retry at file-injector.ts L162-163). S1 left import-behavior test 4f RED (it endorses the bug); S2 rewrites 4f GREEN + adds the FP coverage S1's gate lacks. S2 adds NO source change."
consumed_by: "P1.M3.T1.S1 (wire all three suites into npm test — depends on 4f being green, which S2 delivers); P1.M3.T2.S1 (README Issue 1 note)"
---

# PRP — P1.M1.T1.S2: update import-behavior test 4f + add primary-gate regression cases (Issue 1)

> **Scope flag:** This is a **TEST-ONLY** subtask. S1 (LANDED) fixed `resolveImportPath` (the `.md`-substring
> `extCut` truncation that silently injected the WRONG file is replaced by a trailing `*`/`_` formatting-strip +
> re-clean retry). S1 explicitly deferred the test work to S2: import-behavior **test 4f endorses the bug** (it's
> the single RED case after S1), and the primary gate (`file-injector.test.mjs`) has NO false-positive coverage.
> S2 rewrites 4f to the PRD-compliant outcome, adds a 4h `.old`-FP guard, updates the GROUP-4 header comment,
> and adds two regression cases (ISS1-TL top-level + ISS1-MD markdown-import) to the primary gate. **No source
> change** (file-injector.ts stays as S1 left it). All three suites end GREEN.

---

## Goal

**Feature Goal:** Encode Issue 1's fix in the test suites so it can never silently regress: (1) flip
import-behavior test 4f from endorsing the bug to asserting the PRD-compliant verbatim/null outcome; (2) add a
4h `.old` false-positive guard; (3) update the GROUP-4 header comment to describe the narrowed formatting-strip;
(4) add two primary-gate (`npm test`) regression cases (top-level + markdown-import) for the `X.md.backup`
false-positive, which the primary gate currently does not exercise at all.

**Deliverable:** Modified `import-behavior.test.mjs` (rewrite 4f; add 4h; update GROUP-4 header L141-146) +
modified `file-injector.test.mjs` (add ISS1-TL + ISS1-MD runCases after EDG-4). **`file-injector.ts` UNCHANGED.**
No new files.

**Success Definition:**
1. `node ./file-injector.test.mjs` → green (baseline + ISS1-TL + ISS1-MD; was 145 → now 147, or whatever the
   post-fix count is — the gate is **0 failed**, not a specific N).
2. `node ./import-behavior.test.mjs` → green (was 21 passed/1 failed [4f]; now 22 passed/0 failed with 4h added:
   23 passed/0 failed).
3. `node ./relative-imports.test.mjs` → green, UNCHANGED.
4. `file-injector.ts` byte-for-byte unchanged (S2 adds tests only).

## Why

- **Locks in the Issue-1 fix at both gates.** S1's `fmtCut` fix is the source change; without S2 the only test
  that exercised the truncation path (4f) still asserts the BUG, and the primary gate (`npm test`) has zero
  coverage of the `X.md.backup` false-positive. S2 makes both gates assert the PRD-compliant outcome so a future
  regression of the `extCut` heuristic fails loudly.
- **Closes the silent data-integrity defect's test gap.** PRD §h3.0 Issue 1: "`import-behavior.test.mjs` test 4f
  encodes the PRD-violating behavior and is the reason the bug persisted … a regression case for `X.md.bak`-style
  false positives should be added to the primary `file-injector.test.mjs` gate." S2 does both.
- **Unblocks the npm-test wiring.** P1.M3.T1.S1 (wire all three suites into `npm test`) depends on 4f being
  green. S2's 4f rewrite + 4h add is the prerequisite that makes the import-behavior suite gate-ready.

## What

No user-visible / API / config surface change (internal test coverage). Concretely, 5 test edits across 2 files:

### Success Criteria

- [ ] **import-behavior 4f** rewritten: `@weird.md.bak` (only weird.md) → `o.injected === 1`, `!has(o,"MD-MARKER")`,
      `has(o,"@weird.md.bak")` (verbatim). GREEN (was the single RED).
- [ ] **import-behavior 4h** added (after 4g): `@api.md.old` (only api.md) → `o.injected === 1`,
      `!has(o,"API-MARKER")`, `has(o,"@api.md.old")`. GREEN.
- [ ] **import-behavior GROUP-4 header** (L141-146) updated: describes trailing `*`/`_` glue-strip + re-clean;
      extended tokens (.bak/.txt/.old/.backup) exact-only; `_` inside a name never stripped; full token wins.
- [ ] **file-injector ISS1-TL** added: `#@iss1_report.md.backup` (only iss1_report.md) → `r.injected === 0`,
      `r.text === "Compare #@iss1_report.md.backup with the latest"`, `!hasBlock(r,"Secret draft content.")`. GREEN.
- [ ] **file-injector ISS1-MD** added: iss1_index.md imports `#@iss1_report.md.backup` (only iss1_report.md) →
      `r.injected === 1`, parent block present, `!hasBlock(r,"Secret draft content.")`,
      `hasBlock(r,"See #@iss1_report.md.backup here.")` (verbatim). GREEN.
- [ ] All three suites green (0 failed); `file-injector.ts` UNCHANGED.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim bodies of all 5 edits, the exact POST-S1 current text for the 4f rewrite + the GROUP-4 header, the
helpers to use (`has`/`hasBlock`/`runCase`/`assert`/`FIX`), the model cases (24/EDG-2 for the primary gate;
4a-4e for import-behavior), the UNIQUE fixture names (collision-safe), and the verified gates. The implementer
edits two test files in five spots, then runs three commands.

### Documentation & References

```yaml
# MUST READ — the harness patterns (mk/run/has/assert; runCase/assert/FIX/hasBlock) + the npm-test wiring note
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue4_image_and_tests.md
  why: "§'Test harness patterns (for implementers)' documents the three harnesses' shared load mechanism + the
        per-file helpers. §'Test-suite wiring' notes import-behavior is NOT in npm test (only file-injector is)
        and that 4f must be fixed before P1.M3.T1.S1 wires it in. Confirms S2 is the prerequisite."
  critical: "import-behavior helpers: test(name,fn), assert(c,m), mk(dir,rel,body), run(cwd,prompt,bareAt) returns
             {text,images,injected,paged,blocks,details}, has(out,marker)=out.blocks.join('\\n\\n').includes(marker).
             file-injector helpers: runCase(n,name,fn), assert(c,m), FIX={cwd:TMPDIR}, hasBlock(r,needle)=
             r.blocks.some(b=>b.includes(needle)), blocksText(r)=r.blocks.join('\\n\\n')."

# MUST READ — the contract: S1's fix is landed; S2 consumes it (4f red → green; add FP coverage)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M1T1S1/PRP.md
  why: "S1 = the resolveImportPath fmtCut fix (LANDED at file-injector.ts L162-163). S1 explicitly left 4f RED
        ('Do NOT edit import-behavior.test.mjs in S1') and deferred ALL test work to S2. S1's VERIFIED sequencing
        table is the authoritative spec for what 4f/4h/ISS1 must assert (FP patterns → null; glue → resolves)."
  critical: "S2 does NOT edit file-injector.ts. The 4f/4h/ISS1 assertions are derived from S1's VERIFIED table:
             weird.md.bak / api.md.old / report.md.backup (no trailing glue) → exact-only → null → verbatim."

# MUST READ — the bug contract (Expected/Actual/Root-cause) + the PRD §4.4/§4.5 exact-only rule
- file: PRD.md  (bugfix PRD §h3.0 Issue 1)
  why: "States the FP patterns (X.md.txt/.bak/.old/foo all → null after the fix); notes 4f endorses the bug and
        'a regression case for X.md.bak-style false positives should be added to the primary file-injector.test.mjs
        gate' (exactly ISS1-TL/ISS1-MD). §4.4 (top-level exact-only) + §4.5 rule 3 (extended tokens exact-only)."

# The files you edit (TEST-ONLY — 5 edits across 2 files)
- file: import-behavior.test.mjs
  why: "GROUP-4 header L141-146; 4f ~L184-188 (the RED case); 4g ~L190-194; GROUP-5 header ~L196. Helpers at top
        (test/assert/mk/run/has/ctxFor). 4e (both exist → weird.md.bak wins) STAYS GREEN — do not touch it."
  pattern: "Each GROUP-4 case: mk a temp dir; mk a.md (importing the test token) + the base .md; run(r,'#@a.md',true);
            assert via has(o, MARKER). 4f flips has(o,'MD-MARKER') from true→false + adds verbatim + injected asserts."
  gotcha: "`has(out, marker)` reads `out.blocks` (NEW shape), NOT out.text. The verbatim check `has(o,'@weird.md.bak')`
           works because the unresolved marker is left in a.md's BLOCK content (not stripped)."

- file: file-injector.test.mjs
  why: "runCase L90, assert L81, FIX={cwd:TMPDIR} L360, hasBlock L199, blocksText L198. Case 24 (top-level
        no-fallback → injected===0, r.text===input) L1907 is the ISS1-TL model. EDG-2 (markdown-import verbatim
        via hasBlock) L1930 is the ISS1-MD model. Insert ISS1 cases after EDG-4 (end of the §4.5/EDG cluster)."
  pattern: "ISS1 cases write UNIQUE inline fixtures (iss1_report.md / iss1_index.md — not shared buildFixtures
            names), call mod.injectFiles(prompt, [], FIX), assert via r.injected / r.text / hasBlock."
  gotcha: "Use FIX (=== {cwd:TMPDIR}), matching case 24/EDG-2. injectFiles ignores hasUI/isProjectTrusted/ui on
           the direct-call path (those are for the input handler) — FIX is sufficient + consistent with siblings."
```

### Current Codebase tree

```bash
pi-file-injector/
├── import-behavior.test.mjs  # ← EDITED (rewrite 4f; add 4h after 4g; update GROUP-4 header L141-146)
├── file-injector.test.mjs    # ← EDITED (+ISS1-TL +ISS1-MD after EDG-4, the §4.5/EDG cluster)
├── file-injector.ts          # UNTOUCHED (S1's fmtCut fix at L162-163 is the source change; S2 consumes it)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (no source change → trivially clean)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/{issue1_resolveimportpath.md, issue4_image_and_tests.md, system_context.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (LANDED): resolveImportPath fmtCut
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
import-behavior.test.mjs   # MODIFIED — rewrite 4f (L184-188); +4h after 4g; GROUP-4 header (L141-146) updated.
file-injector.test.mjs     # MODIFIED — +runCase("ISS1-TL",…) + runCase("ISS1-MD",…) after EDG-4.
# No other files. No source change. No new files. No new exports.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — S2 is TEST-ONLY. file-injector.ts is UNCHANGED (S1's fmtCut fix is already landed at L162-163).
//   If a new test FAILS, the bug is in S1's fix (or the trace), NOT something S2 patches in source. (Expected: all green.)

// CRITICAL — 4f currently ENDORSES the bug (asserts has(o,"MD-MARKER") — weird.md IS injected). After S1 it is RED.
//   S2 REWRITES it (do not just delete it). The rewrite asserts the OPPOSITE: !has(o,"MD-MARKER") + verbatim + injected===1.

// CRITICAL — `has` (import-behavior) and `hasBlock` (file-injector) read .blocks (the NEW return shape), NOT .text.
//   The verbatim-marker check (has(o,"@weird.md.bak") / hasBlock(r,"See #@iss1_report.md.backup here.")) works because
//   an UNRESOLVED marker is left in the parent markdown's BLOCK content (scanTokens only strips RESOLVED markers).

// CRITICAL — use UNIQUE fixture names. file-injector ISS1 cases write iss1_report.md / iss1_index.md INLINE (not in
//   buildFixtures; the iss1_ prefix collides with nothing). import-behavior 4f/4h use their own mkdtemp dirs (self-contained,
//   like 4a-4g). Do NOT reuse shared names (a.ts/notes.md/api.md/etc.) — those back the §11 matrix cases.

// CRITICAL — 4e (both weird.md.bak AND weird.md exist → weird.md.bak wins) STAYS GREEN after S1 and S2. Do NOT touch it.
//   Only 4f (ONLY weird.md exists) flips, because weird.md.bak is no longer truncated to weird.md.

// GOTCHA — the item's line numbers are STALE (it cites "4f lines 208-213" and "header 191-197", but the actual file has
//   the GROUP-4 header at L141-146 and 4f at ~L184-188). Place by IDENTIFIER (the test names "4f"/"4g"/"4h" and the
//   GROUP-4 header text), using the exact current text in the Blueprint below — not raw line numbers.

// GOTCHA — file-injector ISS1 cases use FIX (=== {cwd:TMPDIR}), matching case 24 / EDG-2. The item's fuller ctx
//   ({cwd,hasUI,isProjectTrusted,ui}) is equivalent for direct injectFiles calls (which ignore those fields), but FIX
//   is the suite convention — use it for consistency.

// LIBRARY — zero-dependency .mjs harnesses; load the REAL file-injector.ts via jiti + Pi's alias map. All helpers
//   (runCase/assert/hasBlock/FIX; test/assert/mk/run/has) already exist — S2 reuses them, adds no new helpers.
```

## Implementation Blueprint

### Edit 1 — Rewrite import-behavior 4f (ENDORSING the bug → PRD-compliant)

```js
// CURRENT (L184-188, ENDORSES THE BUG — RED after S1):
await test("4f: truncation fallback when only the .md exists — '@weird.md.bak' (only weird.md) → weird.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@weird.md.bak\n"); mk(r, "weird.md", "MD-MARKER"); // no weird.md.bak
  const o = await run(r, "#@a.md", true);
  assert(has(o, "MD-MARKER"), `truncation fallback to weird.md must apply. injected=${o.injected}`);
});

// AFTER (PRD-compliant — GREEN):
await test("4f: extended token exact-only — '@weird.md.bak' (only weird.md) → NOT injected, left verbatim", async () => {
  // PRD §4.5 rule 3: a token already carrying an extension (.bak) is EXACT-only. weird.md.bak is missing →
  // null → marker left verbatim. The OLD extCut heuristic truncated at .md → injected weird.md (the WRONG file).
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@weird.md.bak\n"); mk(r, "weird.md", "MD-MARKER"); // no weird.md.bak
  const o = await run(r, "#@a.md", true);
  assert(o.injected === 1, `only a.md injected (weird.md.bak missing → exact-only → null), got injected=${o.injected}`);
  assert(!has(o, "MD-MARKER"), `weird.md must NOT be injected (weird.md.bak is exact-only; no .md truncation), got MD-MARKER present`);
  assert(has(o, "@weird.md.bak"), `the literal @weird.md.bak reference must be left VERBATIM in a.md's block`);
});
```

### Edit 2 — Add import-behavior 4h (after 4g, before the GROUP-5 header)

```js
await test("4h: extended-token false-positive guard — '@api.md.old' (only api.md) → NOT injected (no .md truncation)", async () => {
  // PRD §4.5 rule 3: .old/.txt/.bak are real extensions → exact-only. The OLD extCut would truncate at .md →
  // inject api.md (WRONG). Confirmed FP patterns: X.md.txt, X.md.bak (4f), X.md.old, X.md/foo (all → null now).
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@api.md.old\n"); mk(r, "api.md", "API-MARKER"); // no api.md.old
  const o = await run(r, "#@a.md", true);
  assert(o.injected === 1, `only a.md injected (api.md.old missing → exact-only → null), got injected=${o.injected}`);
  assert(!has(o, "API-MARKER"), `api.md must NOT be injected (api.md.old is exact-only), got API-MARKER present`);
  assert(has(o, "@api.md.old"), `the literal @api.md.old reference must be left VERBATIM`);
});
```

### Edit 3 — Update the GROUP-4 header comment (import-behavior L141-146)

```js
// CURRENT (L141-146, describes the BUG):
// GROUP 4 — markdown formatting glued to the filename (italics/bold markers)
// \S+ grabs trailing markdown markers; a filename's extension (.md/.markdown) is its terminator.
// Rule decided with the user: try cleanToken(raw) FIRST; THEN, if it contains .md/.markdown, also try it
// truncated immediately after the LAST .md/.markdown (drops trailing *, **, etc.). _ is a filename char,
// never stripped. Full token wins over truncation (a genuine weird.md.bak beats weird.md).

// AFTER (describes the S1 fix):
// GROUP 4 — markdown formatting glued to the filename (italics/bold markers)
// \S+ grabs trailing markdown markers. Rule (PRD §4.4/§4.5 exact-only for extended tokens): try the full token
// (cleanToken) FIRST; THEN strip a trailing run of the GLUE chars cleanToken omits (* and _) + re-clean (drops
// an exposed trailing ".") and retry the EXACT path. A token already carrying an extension (.bak/.txt/.old/
// .backup) is NEVER truncated at .md — if the exact path misses, it is left verbatim (4f/4h). _ INSIDE a name
// (my_file.md) is a filename char, never stripped (4d). Full token wins (4e: a genuine weird.md.bak beats
// weird.md when both exist).
```

### Edit 4 — Add file-injector ISS1-TL (after EDG-4, modeled on case 24)

```js
await runCase("ISS1-TL", "Issue 1 top-level: #@iss1_report.md.backup (only iss1_report.md) → verbatim, injected=0 (no .md truncation)", async () => {
  // PRD §4.4 (top-level exact-only) + Issue 1: a token already carrying .backup is NOT truncated at .md.
  // iss1_report.md.backup is missing → null → #@ left verbatim → injected===0. The OLD extCut would have
  // truncated to iss1_report.md → injected the WRONG file (secret draft) + stripped the #@.
  const report = path.join(TMPDIR, "iss1_report.md");
  fsSync.writeFileSync(report, "# Current Report\nSecret draft content.\n"); // NO iss1_report.md.backup
  const r = await mod.injectFiles("Compare #@iss1_report.md.backup with the latest", [], FIX);
  assert(r.injected === 0, `nothing injected (iss1_report.md.backup missing → exact-only), got injected=${r.injected}`);
  assert(r.text === "Compare #@iss1_report.md.backup with the latest",
    `top-level prompt byte-for-byte UNCHANGED (no .md truncation, no strip), got ${JSON.stringify(r.text)}`);
  assert(!hasBlock(r, "Secret draft content."), `iss1_report.md must NOT be injected (its content absent from blocks)`);
});
```

### Edit 5 — Add file-injector ISS1-MD (after ISS1-TL, modeled on EDG-2)

```js
await runCase("ISS1-MD", "Issue 1 markdown-import: iss1_index.md imports #@iss1_report.md.backup (only iss1_report.md) → report NOT injected, marker verbatim", async () => {
  // PRD §4.5 rule 3 (extended tokens exact-only) at the markdown-import path. iss1_index.md is delivered; its
  // import #@iss1_report.md.backup does NOT resolve (exact-only, missing) → left verbatim in the index block;
  // iss1_report.md is NOT pulled in. The OLD extCut would have truncated → injected iss1_report.md (WRONG).
  const index = path.join(TMPDIR, "iss1_index.md");
  const report = path.join(TMPDIR, "iss1_report.md");
  fsSync.writeFileSync(index, "# Index\n\nSee #@iss1_report.md.backup here.\n");
  fsSync.writeFileSync(report, "# Current Report\nSecret draft content.\n"); // NO iss1_report.md.backup
  const r = await mod.injectFiles("Read #@iss1_index.md", [], FIX);
  assert(r.injected === 1, `only iss1_index.md injected (iss1_report.md.backup missing → exact-only), got injected=${r.injected}`);
  assert(hasBlock(r, '<file name="' + index + '">'), "iss1_index.md block present (the parent delivered)");
  assert(!hasBlock(r, "Secret draft content."), `iss1_report.md must NOT be injected (no .md truncation)`);
  assert(hasBlock(r, "See #@iss1_report.md.backup here."),
    `the unresolved #@iss1_report.md.backup marker must be left VERBATIM in iss1_index.md's block (not stripped, no wrong file)`);
});
```

### Per-case behavior trace (against S1's landed fmtCut — all GREEN)

| Case | token | base .md exists? | resolveImportPath trace | assertion |
|---|---|---|---|---|
| 4f | `@weird.md.bak` | weird.md only | `[weird.md.bak]` (no glue) → miss → null | injected===1, !MD-MARKER, verbatim ✓ |
| 4h | `@api.md.old` | api.md only | `[api.md.old]` → miss → null | injected===1, !API-MARKER, verbatim ✓ |
| ISS1-TL | `#@iss1_report.md.backup` | iss1_report.md only | `[iss1_report.md.backup]` → miss → null (tryMdExt:false) | injected===0, text byte-for-byte, !report ✓ |
| ISS1-MD | `#@iss1_report.md.backup` (in index) | iss1_report.md only | `[iss1_report.md.backup]` → miss → null (tryMdExt:true but ext=".backup"≠"") | injected===1, !report, verbatim ✓ |

### Integration Points

```yaml
FILE_EDITS (import-behavior.test.mjs — 3 edits):
  - rewrite test "4f: …" (L184-188): ENDORSING → PRD-compliant (injected===1, !MD-MARKER, verbatim).
  - add test "4h: …" after test 4g's `});` and before the GROUP-5 header comment block.
  - update the GROUP-4 header comment (L141-146): old extCut rationale → narrowed fmtCut formatting-strip rationale.
  - NO edits to: 4a/4b/4c/4d/4e/4g (STAY GREEN), helpers, any other GROUP.

FILE_EDITS (file-injector.test.mjs — 2 edits):
  - add runCase("ISS1-TL", …) + runCase("ISS1-MD", …) after EDG-4 (end of the §4.5 extension-shorthand / §10-edge
    cluster, alongside case 24 + EDG-2 — the thematic neighbors).
  - NO edits to: sanity list, ASSERTED_EXPORTS, completeness guard, buildFixtures, any existing case.

NO_CHANGES: file-injector.ts (S1's fmtCut fix is the source change), relative-imports.test.mjs, package.json,
            scripts/typecheck.mjs, PRD.md, README.md, all plan/ files. NO new exports. NO new imports.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: REWRITE import-behavior 4f (Edit 1)
  - REPLACE the current 4f (asserts has(o,"MD-MARKER")) with the PRD-compliant version (injected===1, !MD-MARKER,
    has(o,"@weird.md.bak") verbatim). KEEP the same fixture (a.md imports @weird.md.bak; weird.md exists; no weird.md.bak).
  - VERIFY: `node ./import-behavior.test.mjs` → 4f now ✓ (was the single ✗). 4e still ✓.

Task 2: ADD import-behavior 4h (Edit 2)
  - INSERT test "4h: …" after 4g's `});`, before the GROUP-5 header. Fixture: a.md imports @api.md.old; api.md exists.
  - VERIFY: `node ./import-behavior.test.mjs` → 4h ✓; suite now all-green (4f fixed + 4h added).

Task 3: UPDATE the GROUP-4 header comment (Edit 3)
  - REPLACE the L141-146 comment block (extCut rationale) with the narrowed fmtCut formatting-strip rationale (Edit 3 text).
  - VERIFY: re-run the suite (a comment change can't flip a case, but confirm still green).

Task 4: ADD file-injector ISS1-TL + ISS1-MD (Edits 4-5)
  - INSERT both runCases after EDG-4 (the §4.5/EDG cluster). Write UNIQUE inline fixtures (iss1_report.md / iss1_index.md).
  - Use FIX + hasBlock + r.text/r.injected (model on case 24 / EDG-2).
  - VERIFY: `node ./file-injector.test.mjs` → ISS1-TL ✓ + ISS1-MD ✓; no existing case flips.

Task 5: VERIFY all three gates
  - node ./file-injector.test.mjs → 0 failed (baseline + ISS1-TL + ISS1-MD).
  - node ./import-behavior.test.mjs → 0 failed (4f fixed, 4h added, header updated).
  - node ./relative-imports.test.mjs → 0 failed (unchanged).
  - git diff --stat: only the two .mjs test files changed (file-injector.ts UNCHANGED).
```

## Validation Loop

### Level 1: The three suites (the entire gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs       # → 0 failed (baseline + ISS1-TL + ISS1-MD)
node ./import-behavior.test.mjs     # → 0 failed (4f fixed, 4h added, header updated; was 21 passed/1 failed)
node ./relative-imports.test.mjs    # → 0 failed (unchanged)
# Expected: all three print "Result: N passed, 0 failed" and exit 0.
# NOTE: only file-injector.test.mjs is in `npm test` (the wiring is P1.M3.T1.S1, a later milestone). Run all three explicitly.
```

### Level 2: Targeted new-case verification (the 5 edits each pass)

```bash
echo "[import-behavior]"; node ./import-behavior.test.mjs 2>&1 | grep -E "4[efh]:|Result:"
# Expected: "  ✓ 4f: extended token exact-only …" + "  ✓ 4h: extended-token false-positive guard …" + "Result: … 0 failed"
echo "[file-injector]"; node ./file-injector.test.mjs 2>&1 | grep -E "ISS1-TL|ISS1-MD|Result:"
# Expected: "  ✓ case ISS1-TL: …" + "  ✓ case ISS1-MD: …" + "Result: … 0 failed"
# If 4f is still ✗ → the rewrite didn't land (re-check Edit 1). If ISS1-MD ✗ on the verbatim assert → the marker
# was stripped (would mean resolveImportPath resolved it → S1 regression, NOT an S2 bug; report, don't patch source).
```

### Level 3: No-regression confirmation (4a–4e/4g + the rest of the primary gate stay green)

```bash
echo "[import-behavior GROUP-4 unchanged cases]"; node ./import-behavior.test.mjs 2>&1 | grep -E "4[abcdg]:"
# Expected: 4a/4b/4c/4d/4e/4g all ✓ (the fmtCut retry preserves them; 4e: both exist → weird.md.bak wins).
echo "[file-injector §4.5 cluster]"; node ./file-injector.test.mjs 2>&1 | grep -E "case 2[1234]:|case EDG-[12]:"
# Expected: cases 21-24 + EDG-1/EDG-2 all ✓ (the new ISS1 cases are additive neighbors; they disturb nothing).
```

### Level 4: Typecheck (trivial — no source change)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# S2 does not touch file-injector.ts, so this is trivially the POST-S1 (already-clean) state.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → 0 failed (+ ISS1-TL + ISS1-MD).
- [ ] `node ./import-behavior.test.mjs` → 0 failed (4f fixed, 4h added, header updated).
- [ ] `node ./relative-imports.test.mjs` → 0 failed (unchanged).
- [ ] `git diff --stat` shows ONLY `import-behavior.test.mjs` + `file-injector.test.mjs` changed (file-injector.ts untouched).

### Feature Validation (the 5 edits)

- [ ] 4f: `@weird.md.bak` (only weird.md) → injected===1, !MD-MARKER, `@weird.md.bak` verbatim (was the RED case; now GREEN).
- [ ] 4h: `@api.md.old` (only api.md) → injected===1, !API-MARKER, `@api.md.old` verbatim.
- [ ] GROUP-4 header describes the narrowed fmtCut formatting-strip (not the old extCut `.md`-truncation).
- [ ] ISS1-TL: `#@iss1_report.md.backup` (only iss1_report.md) → injected===0, text byte-for-byte, report NOT in blocks.
- [ ] ISS1-MD: iss1_index.md imports `#@iss1_report.md.backup` → injected===1, parent delivered, report NOT in blocks, marker verbatim.

### Code Quality Validation

- [ ] 4f/4h follow the GROUP-4 pattern (mk temp dir + mk a.md + run(r,'#@a.md',true) + has assertions).
- [ ] ISS1-TL/ISS1-MD follow case 24 / EDG-2 (FIX + hasBlock + r.text/r.injected; inline UNIQUE fixtures).
- [ ] 4a-4e/4g UNCHANGED (STAY GREEN — the fmtCut retry preserves them); 4e (both exist) still weird.md.bak-wins.
- [ ] UNIQUE fixture names (iss1_report.md / iss1_index.md) — no collision with shared buildFixtures.
- [ ] String ids "ISS1-TL"/"ISS1-MD" (no collision with numeric matrix ids or existing string ids).

### Scope Discipline

- [ ] file-injector.ts UNCHANGED (S1's fmtCut fix is the source change; S2 consumes it).
- [ ] relative-imports.test.mjs UNCHANGED.
- [ ] No npm-test wiring (P1.M3.T1.S1); no README edit (P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit file-injector.ts.** S1's fmtCut fix is LANDED. S2 is test-only. If a case fails, it's an S1
  regression (or a trace/fixture issue) — report it, don't patch source here.
- ❌ **Do NOT just delete 4f.** REWRITE it to assert the PRD-compliant outcome (injected===1, !MD-MARKER, verbatim).
  Deleting it would lose the coverage that originally caught (and endorsed) the bug.
- ❌ **Do NOT touch 4a/4b/4c/4d/4e/4g.** They STAY GREEN (the fmtCut retry preserves them). 4e (both exist →
  weird.md.bak wins) is the exact-match-wins guard — leave it. Only 4f (only weird.md exists) flips.
- ❌ **Do NOT assert verbatim via `out.text`.** `has`/`hasBlock` read `.blocks` (the NEW shape); the unresolved
  marker lives in the parent markdown's BLOCK content (not the stripped prompt text). Use `has(o,"@weird.md.bak")` /
  `hasBlock(r,"See #@iss1_report.md.backup here.")`.
- ❌ **Do NOT reuse shared fixture names** (a.ts/notes.md/api.md/report.md/index.md/etc.). file-injector ISS1 cases
  use the UNIQUE `iss1_` prefix, written inline; import-behavior 4f/4h use their own mkdtemp dirs (self-contained).
- ❌ **Do NOT wire the suites into `npm test` here.** That's P1.M3.T1.S1 (a later milestone that depends on 4f
  being green — which S2 delivers). S2 only edits the two test files.
- ❌ **Do NOT trust the item's stale line numbers** ("4f lines 208-213", "header 191-197"). The actual file has the
  GROUP-4 header at L141-146 and 4f at ~L184-188. Place by IDENTIFIER (test name + header text) using the Blueprint's
  exact current text.
- ❌ **Do NOT add the npm-test ctx fields to file-injector cases.** Use FIX (=== {cwd:TMPDIR}), matching case 24/EDG-2.
  injectFiles ignores hasUI/isProjectTrusted/ui on the direct-call path; FIX is the suite convention.
- ❌ **Do NOT update the README here.** The Issue-1 README note is P1.M3.T2.S1. S2 edits ONLY the two test files.

---

## Confidence Score: 9/10

TEST-ONLY, two files, 5 focused edits (rewrite 4f, add 4h, update GROUP-4 header, add ISS1-TL, add ISS1-MD) —
each traced through S1's landed fmtCut fix and modeled on existing cases (24/EDG-2 for the primary gate; 4a-4e
for import-behavior). The gate is all three suites green. The -1 reserves for: (a) the fixture-name deviation
(`iss1_report.md` vs the item's `report.md` — collision-safe, semantically identical, documented); (b) the stale
line numbers in the item (the PRP uses identifier-based landmarks + exact current text). The implementing agent
edits two test files, runs three commands.
