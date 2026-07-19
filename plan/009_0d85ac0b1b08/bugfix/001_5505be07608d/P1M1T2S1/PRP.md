---
name: "P1.M1.T2.S1 (bugfix 001_5505be07608d) — Add REND-MULTI-OFFSET unit test: computeDetailOffsets with multiple crafted blocks"
prd_ref: "bugfix PRD §h3.0 Issue 1 (multi-file expanded-view corruption; Suggested Fix: 'The existing single-block REND-OFFSET test should be joined by a multi-block sibling'), §h2.4 Testing Summary ('no automated end-to-end test that injects ≥2 files ... Adding the regression test would prevent recurrence')"
target_file: "./file-injector.test.mjs"   # TEST-ONLY — file-injector.ts stays as T1.S1 left it (SEP fix landed/landing)
target_language: JavaScript (.mjs; zero-dependency harness; loads the REAL .ts via jiti + Pi's alias map)
depends_on: "P1.M1.T1.S1 (Implementing, parallel: fixes SEP literal '\"\\\\n\\\\n\"' → '\"\\n\\n\"' in computeDetailOffsets so SEP.length===2 matches the real join). T2.S1's test PASSES after S1; WOULD FAIL before it (the designed RED-then-GREEN regression signal)."
consumed_by: "(none — this is a terminal regression test; it locks in the SEP fix's behavioral proof)"
---

# PRP — P1.M1.T2.S1: Add REND-MULTI-OFFSET unit test (computeDetailOffsets, multiple crafted blocks)

> **Scope flag:** TEST-ONLY. Adds ONE `runCase` block (`REND-MULTI-OFFSET`) to `file-injector.test.mjs`, placed
> right after the existing single-block `REND-OFFSET` test. It crafts two `<file>` blocks directly (no file I/O),
> calls `mod.computeDetailOffsets`, and asserts BOTH files' bodies slice correctly from the assembled `content` —
> the minimal test that would have caught the SEP bug (the existing single-block tests have zero drift; this
> multi-block sibling exposes the +2/block drift). **No source change** (T1.S1 owns the fix). Uses only existing
> test infrastructure (`runCase`, `assert`, `mod`, `REND_THEME`, `REND_W`, `textOf`).

---

## Goal

**Feature Goal:** Lock in the P1.M1.T1.S1 SEP fix with the minimal multi-block regression test it deferred — a
`REND-MULTI-OFFSET` case that crafts two `<file>` blocks, runs them through `computeDetailOffsets`, and asserts
each file's body slices exactly from the assembled `content` (the second file's slice is the assertion that
FAILS pre-fix with +2 drift and PASSES post-fix). Plus an end-to-end expanded-render assertion confirming both
body children carry the correct content.

**Deliverable:** Modified `./file-injector.test.mjs` — ONE new `runCase("REND-MULTI-OFFSET", …)` block appended
immediately after the `REND-OFFSET` block's closing `});` (~L2745), before the `REND-PAGED-DIR` comment (~L2747).
`file-injector.ts` UNCHANGED. No new helpers, no new fixtures, no file I/O.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **157 passed** (156 baseline + REND-MULTI-OFFSET), 0 failed, exit 0 — assuming T1.S1 (the SEP fix) has landed.
2. `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 23 passed (unchanged).
3. `npm run typecheck` → 0 errors (no source change; trivially clean).
4. `file-injector.ts` byte-for-byte unchanged (`git diff --stat` shows only `file-injector.test.mjs`).
5. The new case prints `✓ case REND-MULTI-OFFSET: …`.

## User Persona

**Target User:** The maintainer who needs assurance that the multi-file expanded (`ctrl+o`) view renders each
file's exact body — the PRD §6.3/§11-#34 acceptance criterion the SEP bug violated.

**Use Case:** A user submits `Diff #@a.ts vs #@b.ts`, presses `ctrl+o`, and expects both bodies correct. The
REND-MULTI-OFFSET test is the automated guard that this stays true across refactors (the existing single-block
tests could not catch it — `starts[0]===0` has zero drift regardless of `SEP.length`).

**Pain Points Addressed:** The test-suite gap that let the SEP bug ship (regression_test_design.md §"The Gap":
"no automated end-to-end test that injects ≥2 files through the real path"). This minimal unit test is the
smallest reproduction that would have caught it.

## Why

- **Closes the test-suite gap that let the bug ship.** Every existing renderer test (`REND-OFFSET`, `REND-6`,
  `REND-11(b)`, `REND-PAGED-DIR`) crafts a SINGLE-block `message.content`, where `starts[0]===0` and the drift
  is zero. No test exercises the multi-block path where `starts[i≥1]` depends on `SEP.length` matching the real
  join separator. REND-MULTI-OFFSET is the multi-block sibling (bugfix PRD §h3.0 Suggested Fix: "The existing
  single-block REND-OFFSET test should be joined by a multi-block sibling").
- **The minimal test that catches the bug.** Per regression_test_design.md §"Minimal Unit Test Alternative":
  craft blocks + details directly (no file I/O), call `computeDetailOffsets`, assert `details[1]` slices correctly.
  This is the smallest reproduction — it isolates `computeDetailOffsets` (the buggy function) without entangling
  the handler chain (T2.S2's REND-MULTI-E2E does the full handler-chain version).
- **RED-then-GREEN proof of the SEP fix.** T1.S1 ships the corrected constant but explicitly defers the multi-file
  behavioral proof ("the multi-file proof is T2's job"). REND-MULTI-OFFSET is that proof: it FAILS pre-T1.S1
  (details[1] slices `"nction b() { return 2; }\n<"`) and PASSES post-T1.S1 (exact body). Together S1 + T2.S1
  close the fix-and-verify loop.

## What

No user-visible / API / config surface change (internal test coverage). The deliverable is one new test case.

### Success Criteria

- [ ] A `runCase("REND-MULTI-OFFSET", …)` block exists in `file-injector.test.mjs`, placed immediately after the `REND-OFFSET` block's closing `});` and before the `REND-PAGED-DIR` comment.
- [ ] The test crafts two blocks directly: `block0 = '<file name="/abs/a.ts">\nfunction a() { return 1; }\n</file>'`, `block1 = '<file name="/abs/b.ts">\nfunction b() { return 2; }\n</file>'`; `content = [block0, block1].join("\n\n")`.
- [ ] The test calls `mod.computeDetailOffsets([block0, block1], details)` (details crafted WITHOUT pre-set offsets).
- [ ] The test asserts `content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen) === "function a() { return 1; }"` (first file — baseline, passes both pre- and post-fix).
- [ ] The test asserts `content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen) === "function b() { return 2; }"` (second file — THE regression assertion: fails pre-fix with +2 drift, passes post-fix).
- [ ] The test renders expanded via `mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME)` and asserts body children at indices 1 and 3 (odd indices — even are read lines) carry the correct content via `textOf()`.
- [ ] `node ./file-injector.test.mjs` → 157 passed, 0 failed (post-T1.S1); the new case prints ✓.
- [ ] `file-injector.ts` UNCHANGED; no new helpers/fixtures/exports in the test file.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim REND-OFFSET sibling template (L2728-2745, the exact pattern to mirror), the verbatim new test body
(blocks/details/asserts/expanded-render), the drift arithmetic explaining WHY assertion (b) catches the bug
(`starts[1]` drifts +2 when SEP.length=4 vs join length 2), the exact insertion point (after REND-OFFSET's `});`,
before REND-PAGED-DIR), the existing infrastructure (`runCase`/`assert`/`mod`/`REND_THEME`/`REND_W`/`textOf`,
all defined ~L2557-2567), the `computeDetailOffsets` mutates-in-place fact (L353), and the T1.S1 dependency
(test PASSES post-fix, FAILS pre-fix). The implementer appends one `runCase` block and runs the suite.

### Documentation & References

```yaml
# MUST READ — the test design (the minimal unit-test pattern, the gap, the assertion approach)
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/regression_test_design.md
  why: "§'The Gap' (all renderer tests are single-block → zero drift → the bug shipped). §'Minimal Unit Test
        Alternative' gives the EXACT pattern: craft blocks + details, call computeDetailOffsets, assert
        details[0]/details[1] slice correctly. §'Assertion Pattern' documents the expanded-Box layout
        ([0]=read0, [1]=body0, [2]=read1, [3]=body1 → body children at odd indices). §'Where to Place the Test':
        after REND-OFFSET, REND- prefix."
  critical: "The test MUST craft MULTIPLE blocks (≥2) — that's the entire point (single-block has zero drift).
             details must be crafted WITHOUT pre-set offsets (computeDetailOffsets populates them). The second
             file's slice is the regression assertion (the first passes regardless)."

# MUST READ — the bug + root cause + the SEP fix this test locks in
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/system_context.md
  why: "§'The Bug (Issue 1)' pins L354 `const SEP = \"\\n\\n\"` (length 4) vs L1286 `blocks.join(\"\\n\\n\")`
        (length 2); explains the +2/block drift in starts[i≥1]; confirms the existing single-block tests have
        zero drift; gives the standalone Node repro (b.ts → 'nction b()...' pre-fix)."
  critical: "The test's assertion (b) — content.slice(details[1].contentStart, ...) === 'function b()...' — is
             the line that FAILS pre-T1.S1 and PASSES post-T1.S1. If T1.S1 hasn't landed, the test ADDS correctly
             but FAILS (the designed RED signal). Confirm T1.S1 landed before expecting GREEN."

# MUST READ — the contract: T1.S1 is the fix; T2.S1 is the behavioral proof
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/P1M1T1S1/PRP.md
  why: "T1.S1 fixes SEP (\"\\n\\n\"→\"\\n\\n\") + 2 docstrings in file-injector.ts. Its 'Anti-Patterns' says
        'Do NOT add the multi-file regression test in S1' and its Level 4 says 'the multi-file proof is T2's job.'
        T2.S1 IS that job. No file conflict (S1=source; T2.S1=test)."
  critical: "T2.S1 does NOT edit file-injector.ts. T2.S1's test consumes the corrected computeDetailOffsets.
             If a case fails, the bug is in T1.S1's fix (or the test is malformed) — NOT something T2.S1 patches
             in source. (Expected: all green post-T1.S1.)"

# The file you edit (the ONLY change — append ONE runCase block)
- file: file-injector.test.mjs
  why: "2920 lines. Renderer-test infrastructure at L2557-2567 (REND_THEME L2565, REND_W L2566, textOf L2567).
        REND-OFFSET (the sibling template) at L2728-2745. REND-PAGED-DIR comment at L2747. INSERT the new block
        between L2745 (REND-OFFSET's `});`) and L2747 (the REND-PAGED-DIR comment). runCase/assert/mod are all
        already in scope (mod is the jiti-loaded module; computeDetailOffsets L353 + renderInjectedMessage L742
        are exported)."
  pattern: "Mirror REND-OFFSET's structure exactly: craft blocks/content → build msg → call computeDetailOffsets →
            assert the slice → render expanded → assert body children. The ONLY difference is MULTIPLE blocks
            (REND-OFFSET uses one) and calling computeDetailOffsets (REND-OFFSET crafts offsets directly)."
  gotcha: "computeDetailOffsets MUTATES the details array in place (sets contentStart/contentLen on each element).
           The test reads details[0]/details[1].contentStart AFTER the call. The return value is the same mutated
           array — either reading works. Do NOT pre-set contentStart/contentLen in the crafted details (the call
           populates them). Do NOT use file I/O (craft blocks as string literals — this is the minimal unit test,
           NOT the E2E handler-chain version which is T2.S2)."

# The source (READ-ONLY — T1.S1 owns it; cited only to trace behavior)
- file: file-injector.ts
  why: "computeDetailOffsets L353 (exported; mutates details in place; return = same array). renderInjectedMessage
        L742 (exported; returns a Box). SEP at L354 (T1.S1 fixes it). The real assembly join at L1286
        (content: blocks.join(\"\\n\\n\")). T2.S1 does NOT edit this file."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← THE ONLY FILE EDITED (+1 runCase block "REND-MULTI-OFFSET" after REND-OFFSET ~L2745)
├── file-injector.ts          # UNTOUCHED (T1.S1's SEP fix is the source change; T2.S1 consumes it)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (no source change → trivially clean)
├── package.json              # untouched
├── PRD.md / README.md        # read-only
└── plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/
    ├── architecture/{system_context.md, regression_test_design.md, external_deps.md}
    ├── P1M1T1S1/{PRP.md}   # ← T1.S1 (parallel): the SEP fix this test locks in
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← sibling template + drift arithmetic + insertion point
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED (append-only): +1 runCase("REND-MULTI-OFFSET", …) block after REND-OFFSET.
# No other files. No new files. No source change. No new exports (computeDetailOffsets/renderInjectedMessage
# already exported + asserted). No new helpers/fixtures (reuses runCase/assert/mod/REND_THEME/REND_W/textOf).
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — this test catches the bug ONLY because it uses MULTIPLE blocks. REND-OFFSET (single block) has
//   starts[0]===0 regardless of SEP.length → zero drift → passes both pre- and post-fix. REND-MULTI-OFFSET's
//   details[1] depends on SEP.length matching the join separator → drift +2 pre-fix → assertion (b) FAILS.
//   Do NOT collapse it to one block (that defeats the purpose).

// CRITICAL — do NOT pre-set contentStart/contentLen in the crafted details. computeDetailOffsets POPULATES them
//   (mutates the array in place). The test's job is to verify those POPULATED offsets are correct. Pre-setting
//   them would bypass the function under test. Craft details as [{path, kind}, {path, kind}] ONLY.

// CRITICAL — computeDetailOffsets MUTATES details in place. Read details[0]/details[1].contentStart AFTER the
//   call. The return value (const result = mod.computeDetailOffsets(...)) is the same mutated array — reading
//   either details[i] or result[i] works. (The real before_agent_start at L1282 discards the return: it calls
//   computeDetailOffsets(blocks, details) then stashes the mutated details.)

// CRITICAL — the second file's slice is the REGRESSION assertion. Pre-T1.S1 it yields "nction b() { return 2; }\n<"
//   (drift +2: missing "fu", trailing "\n<" garbage from block1's header). Post-T1.S1 it yields the exact body.
//   If T1.S1 hasn't landed, the test ADDS correctly but FAILS on this assertion — that's the designed RED signal.
//   Confirm T1.S1 landed (grep 'const SEP' file-injector.ts → "\n\n" single-backslash) before expecting GREEN.

// GOTCHA — the expanded-Box body children are at ODD indices. The layout for N text files is
//   [0]=read line file0 (+expand hint), [1]=body file0, [2]=read line file1, [3]=body file1, ...
//   So bodyA = textOf(expanded.children[1]), bodyB = textOf(expanded.children[3]). (REND-6/REND-PAGED-DIR confirm
//   this layout; regression_test_design.md §'Assertion Pattern' documents it.)

// GOTCHA — textOf(child) = child.render(REND_W).join("\n"). REND_W=2000 (generous → no wrapping). The rendered
//   body string may have trailing padding; use .includes(expected) (NOT ===) for the body-child assertions,
//   matching REND-6/REND-OFFSET's pattern. (The offset-slice assertions (a)/(b) use === because content.slice
//   returns the exact body with no padding.)

// GOTCHA — the test name "REND-MULTI-OFFSET" must be distinct from every existing case. The existing REND-*
//   names are REND-1..REND-11, REND-OFFSET, REND-PAGED-DIR. "REND-MULTI-OFFSET" is distinct (no collision).
//   T2.S2's sibling (the E2E version) should use a different name (e.g. "REND-MULTI-E2E") to avoid collision.

// LIBRARY — zero-dependency .mjs harness; imports the REAL file-injector.ts via jiti + Pi's alias map. mod.
//   computeDetailOffsets / mod.renderInjectedMessage are both already exported + asserted (earlier sessions).
//   No new export is exercised → no sanity-list / ASSERTED_EXPORTS / completeness-guard edit. The gate is
//   `node ./file-injector.test.mjs` → 157 passed (post-T1.S1).
```

## Implementation Blueprint

### The exact test (verbatim — append after REND-OFFSET's closing `});` ~L2745, before REND-PAGED-DIR ~L2747)

```js
// REND-MULTI-OFFSET — §12.22 offset tier, MULTI-BLOCK (the gap that let the SEP bug ship, bugfix §h3.0 Issue 1).
// REND-OFFSET uses a SINGLE block (starts[0]===0, drift zero regardless of SEP.length); this sibling crafts TWO
// blocks so details[1].contentStart depends on SEP.length matching the real join separator. Pre-T1.S1
// (SEP="\\n\\n", length 4 vs join "\n\n" length 2): details[1] slices "nction b() { return 2; }\n<" (drift +2 —
// missing "fu", trailing garbage). Post-T1.S1 (SEP.length 2): exact body. This is the minimal test that would
// have caught the bug (regression_test_design.md §"Minimal Unit Test Alternative"). NO file I/O — crafts blocks
// directly (the E2E handler-chain version is T2.S2 REND-MULTI-E2E).
await runCase("REND-MULTI-OFFSET", "§12.22 multi-block offset tier: computeDetailOffsets + expanded render — EACH file's body is exact (the +2/block drift regression)", async () => {
  const block0 = '<file name="/abs/a.ts">\nfunction a() { return 1; }\n</file>';
  const block1 = '<file name="/abs/b.ts">\nfunction b() { return 2; }\n</file>';
  const blocks = [block0, block1];
  const content = blocks.join("\n\n");              // the real assembly (file-injector.ts L1286) — 2-char separator
  const details = [{ path: "/abs/a.ts", kind: "text" }, { path: "/abs/b.ts", kind: "text" }];
  mod.computeDetailOffsets(blocks, details);       // populates contentStart/contentLen (mutates details in place)
  // (a) FIRST file — correct even pre-fix (starts[0]===0). Pins the baseline (if this fails, the test is malformed).
  const sliceA = content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen);
  assert(sliceA === "function a() { return 1; }",
    `a.ts offset slice is exact (starts[0]===0, drift zero even pre-fix), got ${JSON.stringify(sliceA)}`);
  // (b) SECOND file — THE regression assertion. Pre-T1.S1 (SEP.length 4): drift +2 → "nction b() { return 2; }\n<".
  //     Post-T1.S1 (SEP.length 2): exact body. This line FAILS before the SEP fix and PASSES after it.
  const sliceB = content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen);
  assert(sliceB === "function b() { return 2; }",
    `b.ts offset slice is exact (NO +2 drift — SEP.length must match the join separator), got ${JSON.stringify(sliceB)}`);
  // (c) END-TO-END through the renderer: expanded view, each body child (odd indices 1 and 3) carries the content.
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const bodyA = textOf(expanded.children[1]);       // [0]=read a.ts (+hint), [1]=body a.ts
  const bodyB = textOf(expanded.children[3]);       // [2]=read b.ts, [3]=body b.ts
  assert(bodyA.includes("function a() { return 1; }"),
    `expanded body child [1] (a.ts) carries the exact content, got ${JSON.stringify(bodyA.slice(0, 80))}`);
  assert(bodyB.includes("function b() { return 2; }"),
    `expanded body child [3] (b.ts) carries the exact content (NO drift), got ${JSON.stringify(bodyB.slice(0, 80))}`);
});
```

### Why each assertion holds (the drift arithmetic)

`computeDetailOffsets` builds `starts[]` via `off += b.length + SEP.length`:
- **Pre-T1.S1** (`SEP = "\\n\\n"`, `SEP.length === 4`; real join `"\n\n"`, length 2):
  - `starts[0] = 0` → `details[0].contentStart` correct → assertion (a) PASSES.
  - `starts[1] = block0.length + 4` but the real offset of block1 is `block0.length + 2` → `details[1].contentStart` is **+2 too large** → assertion (b) FAILS (`content.slice` starts 2 late → `"nction b() { return 2; }\n<"`) → the expanded body child [3] also FAILS.
- **Post-T1.S1** (`SEP = "\n\n"`, `SEP.length === 2`):
  - `starts[1] = block0.length + 2` (matches the real join) → `details[1].contentStart` correct → assertion (b) PASSES → body child [3] PASSES.

Assertion (a) is the baseline (proves the test wiring is correct — if (a) fails, the test itself is malformed,
not the bug). Assertion (b) is the regression catch. Assertion (c) is the end-to-end renderer proof.

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — append ONE runCase block):
  - INSERT the REND-MULTI-OFFSET block (see Blueprint) immediately AFTER the REND-OFFSET block's closing `});`
    (~L2745) and BEFORE the `// REND-PAGED-DIR` comment (~L2747).
  - NO edits to: any existing test case (incl. REND-OFFSET, REND-PAGED-DIR, REND-1..11); the renderer-test
    infrastructure (REND_THEME/REND_W/textOf at L2565-2567); the sanity list; ASSERTED_EXPORTS; the completeness
    guard; buildFixtures; captureAllHandlers; runCase/assert definitions.

NO_CHANGES: file-injector.ts (T1.S1 owns the SEP fix; T2.S1 consumes it), relative-imports.test.mjs,
            import-behavior.test.mjs, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports. NO new imports. NO new helpers/fixtures (reuses existing runCase/assert/mod/REND_THEME/REND_W/textOf).
```

### Implementation Tasks (ordered)

```yaml
Task 1: CONFIRM T1.S1 has landed (the dependency)
  - CMD: grep -n 'const SEP' file-injector.ts
  - EXPECT: `const SEP = "\n\n";` (single-backslash; SEP.length===2). If it shows `"\\n\\n"` (double-backslash),
    T1.S1 hasn't landed — the test will still ADD but assertion (b) will FAIL (the designed RED signal). Proceed
    (the test is correct; it fails until S1 lands, which is the point).

Task 2: APPEND the REND-MULTI-OFFSET runCase block
  - LOCATE the REND-OFFSET block's closing `});` (~L2745) — the line after its final `assert(...)`.
  - INSERT the REND-MULTI-OFFSET block (see Blueprint verbatim) immediately after, with a blank line separator,
    BEFORE the `// REND-PAGED-DIR` comment (~L2747).
  - The block uses ONLY existing infrastructure: runCase, assert, mod, REND_THEME, REND_W, textOf.
  - NAMING: "REND-MULTI-OFFSET" (distinct from REND-1..11/REND-OFFSET/REND-PAGED-DIR; leaves REND-MULTI-E2E for T2.S2).

Task 3: VERIFY the gates
  - node ./file-injector.test.mjs → EXPECT "Result: 157 passed, 0 failed." (156 baseline + REND-MULTI-OFFSET),
    exit 0 — assuming T1.S1 landed. The new case prints "✓ case REND-MULTI-OFFSET: …".
  - node ./relative-imports.test.mjs → 38 passed (unchanged).
  - node ./import-behavior.test.mjs → 23 passed (unchanged).
  - npm run typecheck → 0 errors (no source change; trivially clean).
  - git diff --stat → ONLY file-injector.test.mjs changed (file-injector.ts untouched).

Task 4 (IF T1.S1 hasn't landed): acknowledge the expected RED
  - If assertion (b) FAILS with `got "nction b() { return 2; }\n<"` → that is the DESIGNED pre-T1.S.1 signal
    (item §4: "would FAIL before the SEP fix and PASSES after it"). The test is CORRECT; it will go GREEN once
    T1.S1 lands. Do NOT weaken the assertion to force green (that defeats the regression catch).
```

## Validation Loop

### Level 1: The gate — full suite green + the new case (post-T1.S1)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected (post-T1.S1): REND-MULTI-OFFSET prints ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 157 passed, 0 failed.        (156 baseline + REND-MULTI-OFFSET)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
# (If T1.S1 hasn't landed: assertion (b) fails with `got "nction b() { return 2; }\n<"` — the designed RED signal.
#  The test is correct; it goes GREEN once S1 lands. Do NOT weaken it.)
```

### Level 2: The other two suites (must stay green — T2.S1 adds no source change)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 38 passed, 0 failed
node ./import-behavior.test.mjs     # → 23 passed, 0 failed
# T2.S1 adds no source change, so these must stay green. (They don't exercise the renderer's offset tier directly,
# but they load the real file-injector.ts — a typecheck-equivalent sanity that the source is unchanged.)
```

### Level 3: Targeted new-case verification (the 4 assertions each pass post-T1.S1)

```bash
node ./file-injector.test.mjs 2>&1 | grep -E "case REND-MULTI-OFFSET|Result:"
# Expected: "  ✓ case REND-MULTI-OFFSET: §12.22 multi-block offset tier …" + "Result: 157 passed, 0 failed."
# If the case is ✗, READ its assertion message:
#   - assertion (a) "a.ts offset slice is exact" fails → the test is malformed (starts[0]===0 always; re-check the
#     crafted block0/headerLen/computeDetailOffsets call). NOT a T1.S1 issue.
#   - assertion (b) "b.ts offset slice is exact ... got \"nction b()..." → T1.S1 hasn't landed (the SEP fix). The
#     test is CORRECT; it catches the bug. Wait for / land T1.S1.
#   - assertion (c) "expanded body child [1]/[3] carries the exact content" fails → either T1.S1 (drift) or the
#     child-index assumption (re-check expanded.children[1]/[3] via REND-6/REND-PAGED-DIR's pattern).
```

### Level 4: Typecheck (trivial — no source change)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# T2.S1 does not touch file-injector.ts, so this is trivially the current (post-T1.S1) state.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → 157 passed (156 + REND-MULTI-OFFSET), 0 failed, exit 0 (post-T1.S1).
- [ ] `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 23 passed.
- [ ] `npm run typecheck` → 0 errors (no source change).
- [ ] `git diff --stat` shows ONLY `file-injector.test.mjs` changed (file-injector.ts untouched).

### Feature Validation (the 4 assertions)

- [ ] (a) `content.slice(details[0].contentStart, ...) === "function a() { return 1; }"` (first file — baseline).
- [ ] (b) `content.slice(details[1].contentStart, ...) === "function b() { return 2; }"` (second file — the regression catch).
- [ ] (c1) `textOf(expanded.children[1]).includes("function a() { return 1; }")` (expanded body child [1]).
- [ ] (c2) `textOf(expanded.children[3]).includes("function b() { return 2; }")` (expanded body child [3]).

### Code Quality Validation

- [ ] The block mirrors REND-OFFSET's structure (craft → computeDetailOffsets → assert slice → render → assert body).
- [ ] The ONLY difference from REND-OFFSET is MULTIPLE blocks + calling computeDetailOffsets (vs crafted offsets).
- [ ] Uses ONLY existing infrastructure (runCase/assert/mod/REND_THEME/REND_W/textOf); no new helpers/fixtures.
- [ ] details crafted WITHOUT pre-set offsets (computeDetailOffsets populates them).
- [ ] Name "REND-MULTI-OFFSET" distinct from every existing case; leaves "REND-MULTI-E2E" for T2.S2.
- [ ] Append-only: no existing case/infrastructure line modified.

### Scope Discipline

- [ ] file-injector.ts UNCHANGED (T1.S1 owns the SEP fix; T2.S1 consumes it).
- [ ] No sanity-list / ASSERTED_EXPORTS / completeness-guard edit (no new export exercised).
- [ ] relative-imports.test.mjs / import-behavior.test.mjs UNCHANGED.
- [ ] If T1.S1 hasn't landed: the test's assertion (b) FAILS with the drift message — that is the DESIGNED RED
      signal, NOT a T2.S1 bug. Do NOT weaken the assertion to force green.

### Documentation

- [ ] The block's header comment cites bugfix §h3.0 Issue 1, §12.22, and regression_test_design.md's "Minimal
      Unit Test Alternative"; explains why the multi-block sibling catches what single-block couldn't.
- [ ] No README/user-facing change (test-only).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit file-injector.ts.** T1.S1 owns the SEP fix and is landing in parallel. T2.S1 is test-only. If
  assertion (b) fails, the cause is either T1.S1-not-yet-landed (wait for it) or a malformed test — NOT something
  T2.S1 patches in source.
- ❌ **Do NOT collapse the test to a single block.** The ENTIRE POINT is multiple blocks (single-block has zero
  drift — that's why the bug shipped). details[1] is the regression catch; without it the test is pointless.
- ❌ **Do NOT pre-set contentStart/contentLen in the crafted details.** computeDetailOffsets POPULATES them (the
  function under test). Pre-setting bypasses it. Craft details as `[{path, kind}, {path, kind}]` ONLY.
- ❌ **Do NOT weaken assertion (b) to force green.** If it fails with `got "nction b()..."`, that's the DESIGNED
  pre-T1.S1 RED signal (item §4: "would FAIL before the SEP fix and PASSES after it"). Weakening it (e.g.
  `.includes("b()")`) defeats the regression catch. Wait for / land T1.S1.
- ❌ **Do NOT use file I/O.** This is the MINIMAL UNIT test (crafts blocks as string literals per
  regression_test_design.md §"Minimal Unit Test Alternative"). The E2E handler-chain version (real input →
  before_agent_start → renderer) is T2.S2 REND-MULTI-E2E — a separate subtask.
- ❌ **Do NOT use the wrong child indices.** Expanded-Box layout is `[read0, body0, read1, body1, …]` → body
  children at ODD indices (1, 3). Using children[0]/children[2] would assert on the READ lines, not the bodies.
- ❌ **Do NOT use `===` for the body-child assertions.** `textOf()` may include trailing render padding; use
  `.includes(expected)` (matching REND-6/REND-OFFSET). (The offset-SLICE assertions (a)/(b) DO use `===` —
  `content.slice` returns the exact body with no padding.)
- ❌ **Do NOT name it REND-MULTI-E2E** (that's T2.S2's name) or any existing REND-* name. Use "REND-MULTI-OFFSET".
- ❌ **Do NOT add CC12-style CR-only or 3-file drift cases here.** This subtask is the 2-file minimal unit test
  (REND-MULTI-OFFSET). 3-file drift is covered by T2.S2's E2E version (regression_test_design.md Test B).
- ❌ **Do NOT skip the other two suites.** They're not in the `npm test` chain the same way; run them explicitly
  to confirm T2.S1 added no source change (a stray edit would surface as a regression there).

---

## Confidence Score: 10/10

Test-only, one file, one `runCase` block — the verbatim test body is specified (crafts 2 blocks, calls
computeDetailOffsets, asserts both slices + both expanded body children), the sibling template (REND-OFFSET) and
infrastructure (REND_THEME/REND_W/textOf) are pinned at exact lines, the drift arithmetic explaining why
assertion (b) catches the bug is documented (`starts[1]` drifts +2 when SEP.length=4 vs join length 2), the
insertion point is fixed (after REND-OFFSET, before REND-PAGED-DIR), and the T1.S1 dependency is explicit (test
PASSES post-fix, FAILS pre-fix — the designed RED-then-GREEN). No source change, no new helpers/fixtures/exports,
no new imports. The gate is `node ./file-injector.test.mjs` → 157 passed (post-T1.S1). The -0 reflects a
deterministic, trace-verified, no-source-change test addition with exact commands.