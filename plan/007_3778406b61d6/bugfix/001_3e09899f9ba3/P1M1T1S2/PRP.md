---
name: "P1.M1.T1.S2 (bugfix 001_3e09899f9ba3) — defense-in-depth CRLF regression tests (CR-only/mixed/trailing-spaces) + e2e CRLF markdown import"
prd_ref: "bugfix PRD §h2.4 Testing Summary ('Recommend also adding \\r-only (classic Mac) and mixed-ending cases … as defense-in-depth') + §h3.0 Issue 1 Suggested Fix (c) 'mixed LF/CRLF line endings in one file'; architecture/code_changes_analysis.md §Test Plan (CC14/CC15/CC16 + e2e, verbatim)"
target_file: "./file-injector.test.mjs"   # TEST-ONLY — file-injector.ts stays as S1 left it (closeRe `\\r?` fix landed)
target_language: JavaScript (.mjs; zero-dependency harness; loads the REAL .ts via jiti + Pi's alias map)
depends_on: "P1.M1.T1.S1 (FULLY LANDED in working tree: closeRe `\\r?` fix at file-injector.ts:496 + CC12/CC13). S2 consumes S1's fixed source; S2 adds NO source change — only 4 new test cases."
consumed_by: "P1.M1.T2.S1 (README CRLF compatibility note — may cite S2's green CRLF coverage as evidence)"
---

# PRP — P1.M1.T1.S2: defense-in-depth CRLF regression tests + e2e CRLF markdown import

> **Scope flag:** This is a **TEST-ONLY** subtask. S1 (FULLY LANDED) fixed the CRLF fence-close bug
> (`closeRe` `[ \\t]*\\r?$` at file-injector.ts:496) + added CC12/CC13. S2 adds the **defense-in-depth**
> coverage the PRD Testing Summary + Issue-1 Suggested-Fix requested: CC14 (CR-only documentation), CC15
> (mixed LF/CRLF), CC16 (trailing spaces before close), + 1 end-to-end CRLF markdown-import integration test.
> **No source change** (file-injector.ts stays as S1 left it). All 4 cases are GREEN on first run against
> S1's landed fix (no RED phase — the fix is already in).

---

## Goal

**Feature Goal:** Lock in S1's CRLF fence-close fix with defense-in-depth regression coverage + document the
CR-only scope boundary, by adding 4 new `runCase` blocks to `file-injector.test.mjs`: CC14 (CR-only known-
limitation documentation), CC15 (mixed LF/CRLF), CC16 (CRLF + trailing spaces before close), and a CRLF
markdown-import end-to-end integration case.

**Deliverable:** A modified `file-injector.test.mjs` (4 new `runCase` blocks; no other edits). `file-injector.ts`
is UNCHANGED. The 4 cases use the existing `indexOfFirstHash` / `mod.computeCodeRanges` / `mod.inCode` /
`mod.injectFiles` / `FIX` / `TMPDIR` patterns and UNIQUE fixture names.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **128 passed** (124 POST-S1 baseline + CC14 + CC15 + CC16 + CRLF-E2E), 0 failed.
2. `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 22 passed (unchanged).
3. `npm run typecheck` → 0 errors (no source change, so trivially clean).
4. `file-injector.ts` byte-for-byte unchanged (S2 adds tests only).

## Why

- **Closes the PRD's requested defense-in-depth.** PRD §h2.4 Testing Summary: "Recommend also adding `\r`-only
  (classic Mac) and mixed-ending cases to the regression suite as defense-in-depth." PRD §h3.0 Issue-1 Suggested
  Fix: add regression tests exercising CRLF markdown with (a) a fence followed by an import [DONE in S1's
  CC12/CC13], (b) a fence containing a `#@` [DONE in S1's CC13], and **(c) mixed LF/CRLF line endings in one
  file.** S2 delivers (c) plus CC14 (CR-only documentation) + CC16 (trailing spaces) + the e2e integration proof.
- **The fix is landed; these tests guard it.** S1's `\\r?` is a 4-char regex addition. CC15/CC16 exercise the
  two remaining close-line shapes the fix must tolerate (mixed endings; trailing spaces + `\r`); the e2e proves
  the fix works end-to-end through the real markdown-import pipeline (not just the `computeCodeRanges` unit).
- **Documents the CR-only scope boundary explicitly.** CC14 asserts that pure `\r`-only files are ONE line to
  `split("\n")` (a known, accepted limitation — CR-only is essentially extinct) so a future reader doesn't
  mistake it for a regression. This is documentation, NOT a correctness target (the item is explicit on this).

## What

No user-visible / API / config surface change (internal test coverage). Concretely, 4 new cases:

### Success Criteria

- [ ] **CC14** (`r.length <= 1`): CR-only txt `"```\r#@inside.ts\r```\r#@outside.md"` → `split("\n")` yields one
      line → at most one range. Comment marks it as a DOCUMENTATION test of the known CR-only limitation.
- [ ] **CC15** (`inCode === false`): mixed LF/CRLF txt `"```\ncode\r\n```\r\n#@after.md\n"` → fence closes →
      `#@after.md` is OUTSIDE the code range.
- [ ] **CC16** (`inCode === false`): CRLF + trailing-spaces txt `"```\r\ncode\r\n```  \r\n#@after.md\r\n"` →
      close line `"```  \r"` (spaces + `\r`) closes → `#@after.md` is OUTSIDE the code range.
- [ ] **CRLF-E2E** (`injected === 2`): CRLF `crlf_spec.md` (fenced block + `See #@crlf_after.md`) + LF
      `crlf_after.md` → both injected; import marker STRIPPED (`See crlf_after.md`, not `See #@crlf_after.md`).
- [ ] `node ./file-injector.test.mjs` → 128 passed, 0 failed; the other two suites unchanged (38 / 22).
- [ ] `file-injector.ts` UNCHANGED; no sanity-list / ASSERTED_EXPORTS / module-surface edit (no new export).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim bodies of all 4 cases (traced through `computeCodeRanges`/`inCode`/`injectFiles`), the exact
POST-S1 insertion points (after CC13 L1459 / after case 16 L1559), the CC1–CC13 + case-15/16 patterns to
mirror, the UNIQUE fixture names (no collision), and the verified gates. The implementer edits ONE file in
two spots, then runs three commands.

### Documentation & References

```yaml
# MUST READ — the verbatim specs for all 4 cases + the CR-only limitation rationale
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/architecture/code_changes_analysis.md
  why: "§Test Plan gives CC14/CC15/CC16 + the e2e VERBATIM (txt strings, assertions, comments). §'Why Not
        split(/\\r\\n|\\r|\\n/)' explains why CR-only is out of scope (breaks the +1 offset math; CR-only is
        extinct). §'Verification: Offset Math Under CRLF' proves CC15/CC16's ranges are correct."
  critical: "CC14 is a DOCUMENTATION test (assert r.length <= 1), NOT a correctness target — the comment MUST
             state CR-only is an intentional scope boundary. CC15/CC16 assert mod.inCode(idx, r) === false
             (the fence closes; the #@ is OUTSIDE). The e2e asserts injected===2 + marker stripped."

# MUST READ — the contract: S1's fix is landed; S2 consumes it (no source change)
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/P1M1T1S1/PRP.md
  why: "S1 = the closeRe `\\r?` one-liner (file-injector.ts:496) + CC12/CC13. S1 is FULLY LANDED (verified:
        L496 has `\\r?`; CC12 at L1436; CC13 at L1450; baseline 124 passed). S2 adds CC14–CC16 + e2e AFTER
        S1's cases. S1 explicitly deferred defense-in-depth to S2."
  critical: "S2 does NOT edit file-injector.ts. S2's CC14–CC16 are NOT a RED→GREEN (the fix is already in) —
             they are additional GREEN coverage. They append AFTER CC13 (S1's last case)."

# MUST READ — the spec: PRD requests these defense-in-depth cases
- file: PRD.md  (bugfix PRD §h2.4 Testing Summary + §h3.0 Issue 1 Suggested Fix)
  why: "§h2.4: 'Recommend also adding \\r-only (classic Mac) and mixed-ending cases … as defense-in-depth,
        though \\r-alone is essentially extinct.' §h3.0 Suggested Fix (c): 'mixed LF/CRLF line endings in one
        file.' S2 delivers exactly these."

# The file you edit (the ONLY change — TEST-ONLY)
- file: file-injector.test.mjs
  why: "indexOfFirstHash L1293; CC1 template L1299; CC13 closes L1459; `// ── TOTAL-SIZE BUDGET` header L1462
        (CC14–16 insert between L1459 and L1462); case 16 L1559; case 17 L1569 (e2e inserts between them);
        countFileBlocks L374; FIX L323; TMPDIR L178."
  pattern: "CC cases: `const txt=…; const idx=indexOfFirstHash(txt); assert(idx>-1,…); const r=mod.computeCodeRanges(txt);
            assert(mod.inCode(idx,r)===<bool>,…)`. Markdown cases: `const r=await mod.injectFiles('…',[],FIX);
            assert(r.injected===N,…); r.text.indexOf('<file name=\"…\">') + r.text.includes('…')`."
  gotcha: "CC14 does NOT use indexOfFirstHash — it asserts r.length <= 1 (a range-COUNT documentation, not inCode).
           The e2e uses FIX (=== { cwd: TMPDIR }), matching the surrounding case-15/16 pattern. Use UNIQUE
           fixture names (crlf_spec.md / crlf_after.md) — do NOT reuse shared buildFixtures names."

# The source (READ-ONLY — S1 owns it; cited only to trace behavior)
- file: file-injector.ts
  why: "computeCodeRanges L472–530; closeRe L496 (`[ \\t]*\\r?$` — S1's fix). content.split('\\n') L474,
        lineStart[] L478–484, closedEnd L504. S2 does NOT edit this file."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← THE ONLY FILE EDITED (+CC14 +CC15 +CC16 +CRLF-E2E; 2 insertion spots)
├── file-injector.ts          # UNTOUCHED (S1's closeRe fix at L496 is the source change; S2 consumes it)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (no source change → trivially clean)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README CRLF note is T2.S1)
└── plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/
    ├── architecture/{code_changes_analysis.md, system_context.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (FULLY LANDED): closeRe fix + CC12/CC13
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED (append-only in 2 spots):
                          #   (1) CC14/CC15/CC16 after CC13's `});` (~L1459), before TOTAL-SIZE BUDGET header (~L1462)
                          #   (2) runCase("CRLF-E2E", …) after case 16 (~L1559), before case 17 (~L1569)
# No other files. No new files. No source change. No new exports. No new imports.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — S2 is TEST-ONLY. file-injector.ts is UNCHANGED (S1's closeRe `\\r?` fix is already landed at L496).
//   If a case FAILS, the bug is in S1's fix (or the trace), NOT something S2 patches in source. (Expected: all green.)

// CRITICAL — CC14 is a DOCUMENTATION test, NOT a correctness target. It asserts r.length <= 1 (CR-only content is
//   ONE line to split("\n") → at most one range). The comment MUST state this is an intentional scope boundary
//   (CR-only is extinct; split("\n") doesn't split on \r; the S1 fix only helps multi-line CRLF/LF). Do NOT
//   assert inCode for CC14, and do NOT treat r.length===1 as a failure to "fix" — it is the documented limitation.

// CRITICAL — CC14 does NOT use indexOfFirstHash (it asserts the range COUNT, not an inCode membership). CC15/CC16
//   DO use indexOfFirstHash + mod.inCode (the CC1–CC13 pattern). Mixing the two patterns is intentional.

// CRITICAL — use UNIQUE fixture names in the e2e (crlf_spec.md / crlf_after.md). buildFixtures writes SHARED
//   notes.md/api.md/a.md/b.md/etc. (cases 15/16/17–20/MD1/MD2 depend on them). Reusing those names would clobber
//   shared fixtures. Unique names avoid the collision; the e2e writes them inline (self-contained, like E4/E5).

// CRITICAL — string-id for the e2e, NOT a numeric id. The markdown section uses numeric ids 15–20 (PRD §11 rows).
//   The e2e is NOT a PRD §11 matrix row (the matrix stops at 32); a numeric 33 would couple to the matrix count.
//   Use the string id "CRLF-E2E" (descriptive, no collision with CC*/EIT*/BG*/MD1/MD2/F*).

// GOTCHA — line numbers are POST-S1 (CC12 L1436, CC13 L1450/closes L1459, TOTAL-SIZE BUDGET L1462, case 16 L1559,
//   case 17 L1569). Place by IDENTIFIER (after CC13's `});`; after case 16's `});` before case 17), not raw line.

// GOTCHA — the e2e uses FIX (=== { cwd: TMPDIR }), matching the surrounding case-15/16 pattern. FIX has NO budget
//   → emitText injects whole → injected===count, paged===0. Do NOT use PAGED_FIX.

// LIBRARY — zero-dependency .mjs harness; imports the REAL file-injector.ts via jiti + Pi's alias map. mod.
//   computeCodeRanges / mod.inCode / mod.injectFiles are all already exported + asserted (earlier sessions).
//   No new export is exercised → no sanity-list / ASSERTED_EXPORTS / completeness-guard edit.
```

## Implementation Blueprint

### The 4 runCase blocks (exact bodies)

**Insertion 1 — CC14/CC15/CC16** (after CC13's closing `});` ~L1459, before the `// ── TOTAL-SIZE BUDGET` header ~L1462):

```js
await runCase("CC14", "§5.6.1 — CR-only (classic Mac) line endings: known limitation documentation", async () => {
  // DEFENSE-IN-DEPTH / DOCUMENTATION (NOT a correctness target): content.split("\n") does NOT split on \r,
  // so a pure \r-only file is ONE giant line. computeCodeRanges sees a single line; the open fence matches
  // FENCE_OPEN_RE but there is no further line to close on → at most one range covering the whole content.
  // This is an INTENTIONAL SCOPE BOUNDARY (CR-only is essentially extinct — classic Mac OS ≤9, pre-2001),
  // not a regression: S1's `\r?` fix only helps when split("\n") produces multiple lines (CRLF/LF), not CR-only.
  const txt = "```\r#@inside.ts\r```\r#@outside.md";
  const r = mod.computeCodeRanges(txt);
  assert(r.length <= 1,
    `CR-only content is one line to split("\n") → at most one range (known limitation, not a target), got ${JSON.stringify(r)}`);
});

await runCase("CC15", "§5.6.1 — mixed LF/CRLF line endings in one file: fence closes correctly", async () => {
  // Open fence on LF ("\n"), close fence on CRLF ("\r\n"), import on LF ("\n"). The `\r?` in closeRe lets the
  // close line "```\r" match → the fence closes → the #@after.md import is OUTSIDE the code range → injected.
  const txt = "```\ncode\r\n```\r\n#@after.md\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ after a mixed LF/CRLF-closed fence must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC16", "§5.6.1 — CRLF with trailing spaces before the close fence", async () => {
  // Close line "```  \r" (2 trailing spaces then \r). `[ \t]*` consumes the spaces, `\r?` consumes the \r,
  // `$` anchors end → the fence closes → the #@after.md import is OUTSIDE the code range → injected.
  const txt = "```\r\ncode\r\n```  \r\n#@after.md\r\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ after a CRLF close fence with trailing spaces must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});
```

**Insertion 2 — the e2e** (after case 16's closing `});` ~L1559, before case 17 ~L1569):

```js
await runCase("CRLF-E2E", "§5.6 — CRLF markdown: fenced block + #@ import → both injected, marker stripped", async () => {
  // End-to-end integration: a CRLF .md file with a fenced code block FOLLOWED by a #@ import. Before S1's
  // closeRe `\r?` fix the fence never closed → the import was classified inCode → silently dropped
  // (injected===1). After the fix the fence closes → the import resolves → injected===2 + marker stripped.
  // UNIQUE fixture names (no collision with shared buildFixtures entries).
  const crlfSpec = path.join(TMPDIR, "crlf_spec.md");
  const crlfAfter = path.join(TMPDIR, "crlf_after.md");
  fsSync.writeFileSync(crlfSpec, "# CRLF Spec\r\n\r\n```\r\ncode here\r\n```\r\n\r\nSee #@crlf_after.md\r\n");
  fsSync.writeFileSync(crlfAfter, "# After Content\n");
  const r = await mod.injectFiles("Read #@crlf_spec.md", [], FIX);
  assert(r.injected === 2, `CRLF spec + crlf_after.md both injected (import after the fence resolved), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read crlf_spec.md"), "top-level #@crlf_spec.md marker stripped to crlf_spec.md");
  assert(r.text.indexOf('<file name="' + crlfSpec + '">') !== -1, "crlf_spec.md block present");
  assert(r.text.indexOf('<file name="' + crlfAfter + '">') !== -1, "crlf_after.md block present (import after the CRLF fence resolved)");
  // The import marker is STRIPPED to the bare path — proving the #@ was recognized as an import (NOT code).
  assert(r.text.includes("See crlf_after.md"), "crlf_spec.md block: CRLF-path import marker stripped to crlf_after.md");
  assert(!r.text.includes("See #@crlf_after.md"), "the resolved CRLF-path import marker must NOT retain #@");
});
```

### Per-case behavior trace (why each assertion holds — against S1's landed closeRe)

| Case | txt | split("\n") → | closeRe on close line | idx of #@ | range | assertion |
|---|---|---|---|---|---|---|
| CC14 | `"```\r#@inside.ts\r```\r#@outside.md"` (CR-only) | 1 element (no `\n`) | n/a (no close line) | n/a (asserts count) | `[0, EOF]` (1 range) | `r.length <= 1` ✓ (documentation) |
| CC15 | `"```\ncode\r\n```\r\n#@after.md\n"` (mixed) | `["```","code\r","```\r","#@after.md",""]` | `"```\r"` → `[ \t]*\r?$` TRUE | 15 | `[0,15]` | `inCode(15,[[0,15]])===false` ✓ |
| CC16 | `"```\r\ncode\r\n```  \r\n#@after.md\r\n"` | `["```\r","code\r","```  \r","#@after.md\r",""]` | `"```  \r"` → TRUE | 18 | `[0,18]` | `inCode(18,[[0,18]])===false` ✓ |
| CRLF-E2E | CRLF `crlf_spec.md` + `crlf_after.md` | (real file read) | fence closes → import resolves | — | — | `injected===2`, marker stripped ✓ |

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — append-only in 2 spots):
  - CODE-REGION DETECTION section: append CC14/CC15/CC16 after CC13's `});` (~L1459), before the
    `// ── TOTAL-SIZE BUDGET (PRD §5.6.2)` header (~L1462).
  - MARKDOWN TRANSITIVE IMPORTS section: append runCase("CRLF-E2E", …) after case 16's `});` (~L1559),
    before case 17 (~L1569).
  - NO edits to: sanity list, ASSERTED_EXPORTS, completeness guard, indexOfFirstHash, buildFixtures,
    any existing case (incl. S1's CC12/CC13).

NO_CHANGES: file-injector.ts (S1's closeRe fix is the source change; S2 consumes it), relative-imports.test.mjs,
            import-behavior.test.mjs, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports. NO new imports. NO module-surface edit.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD CC14/CC15/CC16 to the CODE-REGION DETECTION section
  - INSERT the 3 runCase blocks (see Blueprint) after CC13's `});` (~L1459), before the TOTAL-SIZE BUDGET header (~L1462).
  - CC14: NO indexOfFirstHash; assert r.length <= 1; comment marks it DOCUMENTATION (CR-only scope boundary).
  - CC15: indexOfFirstHash + mod.computeCodeRanges + assert mod.inCode(idx, r) === false (mixed LF/CRLF).
  - CC16: indexOfFirstHash + mod.computeCodeRanges + assert mod.inCode(idx, r) === false (trailing spaces + \r).
  - FOLLOW the CC1–CC13 pattern (CC15/CC16); CC14 intentionally diverges (range-count, not inCode).

Task 2: ADD the CRLF-E2E integration case to the MARKDOWN TRANSITIVE IMPORTS section
  - INSERT runCase("CRLF-E2E", …) (see Blueprint) after case 16's `});` (~L1559), before case 17 (~L1569).
  - WRITE UNIQUE fixtures inline: crlf_spec.md (CRLF) + crlf_after.md (LF). Do NOT reuse shared buildFixtures names.
  - CALL mod.injectFiles("Read #@crlf_spec.md", [], FIX); assert injected===2, paged===0, both <file> blocks
    present, startsWith("Read crlf_spec.md"), marker stripped (includes "See crlf_after.md", NOT "See #@crlf_after.md").
  - FOLLOW the case-15/16 pattern (FIX ctx; block-presence via indexOf; marker-stripped via includes).

Task 3: VERIFY all gates
  - node ./file-injector.test.mjs → 128 passed (124 + CC14 + CC15 + CC16 + CRLF-E2E), 0 failed, exit 0.
  - node ./relative-imports.test.mjs → 38 passed (unchanged).
  - node ./import-behavior.test.mjs → 22 passed (unchanged).
  - npm run typecheck → 0 errors (no source change → trivially clean).

Task 4: CONFIRM scope discipline (no edits leaked)
  - file-injector.ts byte-for-byte UNCHANGED (git diff shows only file-injector.test.mjs).
  - the two other suites UNCHANGED; no sanity-list/ASSERTED_EXPORTS/guard edit; no new export.
```

## Validation Loop

### Level 1: The gate — full suite green + 4 new cases

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: CC14, CC15, CC16, CRLF-E2E each print ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 128 passed, 0 failed.        (124 POST-S1 baseline + 4 new)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
```

### Level 2: The other two suites (must stay green — they transitively call computeCodeRanges)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 38 passed, 0 failed
node ./import-behavior.test.mjs     # → 22 passed, 0 failed
# These exercise the real markdown-import pipeline (which calls computeCodeRanges under skipCode:true).
# S2 adds no source change, so they must stay green. A failure would mean a fixture collision (re-check
# the e2e uses UNIQUE names crlf_spec.md / crlf_after.md, not shared api.md/notes.md).
```

### Level 3: Targeted new-case verification (the 4 cases each pass)

```bash
node ./file-injector.test.mjs 2>&1 | grep -E "case CC1[456]:|case CRLF-E2E:|Result:"
# Expected: "  ✓ case CC14: …" + "  ✓ case CC15: …" + "  ✓ case CC16: …" + "  ✓ case CRLF-E2E: …" + "Result: 128 passed, 0 failed."
# If one is ✗, READ its assertion message:
#   - CC14 "got [{…},{…}]" (r.length > 1) → CR-only unexpectedly split (would mean someone changed split("\n")
#     to /\r\n|\r|\n/ — that's an S1/source regression, NOT an S2 fix; report it, don't patch source).
#   - CC15/CC16 "must NOT be in code" (inCode===true) → the closeRe `\r?` fix regressed (S1/source issue).
#   - CRLF-E2E "got injected=1" → the fence didn't close → import dropped (S1/source issue); or a fixture
#     name collision (re-check UNIQUE names).
# These are all SOURCE (S1) bugs if they fire, NOT S2 bugs — S2 only adds tests. Report; do not edit source.
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

- [ ] `node ./file-injector.test.mjs` → 128 passed (124 + 4), 0 failed, exit 0.
- [ ] `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 22 passed.
- [ ] `npm run typecheck` → 0 errors (no source change).
- [ ] `git diff --stat` shows ONLY `file-injector.test.mjs` changed (file-injector.ts untouched).

### Feature Validation (the 4 cases)

- [ ] CC14: `r.length <= 1` (CR-only = one line to split("\n"); DOCUMENTATION, comment states scope boundary).
- [ ] CC15: `inCode(idx, r) === false` (mixed LF/CRLF fence closes; `#@after.md` outside code).
- [ ] CC16: `inCode(idx, r) === false` (CRLF + trailing spaces close; `#@after.md` outside code).
- [ ] CRLF-E2E: `injected === 2`; both `<file>` blocks present; marker stripped (`See crlf_after.md`, not `See #@crlf_after.md`).

### Code Quality Validation

- [ ] CC14/CC15/CC16 follow the CC1–CC13 pattern (CC15/CC16 use indexOfFirstHash + inCode; CC14 asserts range-count).
- [ ] CRLF-E2E follows the case-15/16 pattern (FIX ctx; block-presence via indexOf; marker-stripped via includes).
- [ ] UNIQUE fixture names (crlf_spec.md / crlf_after.md); e2e writes them inline (no buildFixtures collision).
- [ ] e2e uses the STRING id "CRLF-E2E" (not a numeric id — avoids coupling to the PRD §11 32-row matrix).
- [ ] Append-only: no existing case / fixture / sanity-list / guard line modified.

### Scope Discipline

- [ ] file-injector.ts UNCHANGED (S1's closeRe fix is the source change; S2 consumes it).
- [ ] No sanity-list / ASSERTED_EXPORTS / completeness-guard edit (no new export exercised).
- [ ] relative-imports.test.mjs / import-behavior.test.mjs UNCHANGED.
- [ ] README.md NOT edited (the CRLF compatibility note is T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit file-injector.ts.** S1's closeRe `\\r?` fix is the source change and is LANDED. S2 is test-only.
  If a case fails, it's an S1/source regression (or a fixture collision) — report it, don't patch source here.
- ❌ **Do NOT treat CC14 as a correctness target.** It is a DOCUMENTATION test: CR-only content is one line to
  `split("\n")` → at most one range. The comment MUST state this is an intentional scope boundary (CR-only is
  extinct). Do NOT assert `inCode` for CC14, and do NOT "fix" r.length===1 — it is the documented limitation.
- ❌ **Do NOT reuse shared fixture names in the e2e** (api.md / notes.md / a.md / b.md / etc.). buildFixtures
  writes them and cases 15/16/17–20/MD1/MD2 depend on them. Use UNIQUE names (crlf_spec.md / crlf_after.md),
  written inline in the runCase (self-contained, like E4/E5).
- ❌ **Do NOT use a numeric id for the e2e.** The markdown section uses numeric ids 15–20 (PRD §11 rows); the
  matrix stops at 32. A numeric "33" would couple the test to the matrix count. Use the string id "CRLF-E2E".
- ❌ **Do NOT use PAGED_FIX in the e2e.** Use FIX (=== { cwd: TMPDIR }, no budget → whole → injected===count,
  paged===0). The e2e has no paging concern.
- ❌ **Do NOT assert exact range numbers in CC15/CC16.** Use `mod.inCode(idx, r)` (the CC1–CC13 convention).
  The item's/architecture's prose ranges ("[0,15]", "[0,18]") are illustrative; a literal-number assertion
  couples the test to offset arithmetic and is needlessly fragile.
- ❌ **Do NOT skip the other two suites.** They're not in `npm test`; run `relative-imports.test.mjs` and
  `import-behavior.test.mjs` explicitly — they transitively call `computeCodeRanges` and must stay green
  (a fixture collision in the e2e could break them).
- ❌ **Do NOT add CC12/CC13** (S1 owns those). S2 appends CC14–CC16 AFTER CC13. And do NOT do T2.S1's README
  CRLF note here — S2 is the 4 test cases ONLY.
- ❌ **Do NOT mis-escape `\r` in the txt strings.** In a JS double-quoted string, `"\r"` is a single carriage-
  return character (what we want here — these are literal CR chars in the fixture text, NOT regex tokens).
  (Contrast with S1's closeRe source, where `"\\r?"` in the RegExp string is the regex token — different context.)

---

## Confidence Score: 10/10

Test-only, one file, 4 cases — each traced through `computeCodeRanges`/`inCode`/`injectFiles` and confirmed
GREEN against S1's landed closeRe `\\r?` fix (CC14 range-count documentation; CC15/CC16 inCode===false;
CRLF-E2E injected===2 + marker stripped). The architecture doc gives the case specs verbatim; the POST-S1
insertion points are pinned (after CC13 L1459; after case 16 L1559). The gate is `node ./file-injector.test.mjs`
→ 128 passed (124 + 4), 0 failed. No source change, no new export, no RED phase (the fix is already in). The
-0 reflects a deterministic, trace-verified, no-source-change addition with exact commands.
