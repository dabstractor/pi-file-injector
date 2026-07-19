---
name: "P1.M1.T2.S2 (bugfix 001_5505be07608d) — Add REND-MULTI-E2E integration test: real handler chain with multiple files"
prd_ref: "bugfix PRD §h3.0 Issue 1 (Suggested Fix: 'drive the real input + before_agent_start handlers with a multi-file prompt ... assert that renderInjectedMessage's body child for every file equals that file's actual content'), §h2.4 Testing Summary ('no automated end-to-end test that injects ≥2 files ... Adding the regression test would prevent recurrence'), regression_test_design.md Test A (REND-MULTI-E2E)"
target_file: "./file-injector.test.mjs"   # TEST-ONLY — file-injector.ts stays as T1.S1 left it (SEP fix LANDED at b1f0727)
target_language: JavaScript (.mjs; zero-dependency harness; loads the REAL .ts via jiti + Pi's alias map)
depends_on: "P1.M1.T1.S1 (LANDED at b1f0727: SEP literal fixed '\\n\\n'→'\\n\\n' in computeDetailOffsets; suite GREEN at 157). P1.M1.T2.S1 (LANDED: REND-MULTI-OFFSET unit test at L2757-2781 — the unit sibling). T2.S2 is the E2E counterpart."
consumed_by: "(none — this is a terminal regression test; it locks in the SEP fix's end-to-end behavioral proof through the real handler chain)"
---

# PRP — P1.M1.T2.S2: Add REND-MULTI-E2E integration test (real handler chain, multiple files)

> **Scope flag:** TEST-ONLY. Adds ONE `runCase` block (`REND-MULTI-E2E`) to `file-injector.test.mjs`, placed
> immediately after the LANDED `REND-MULTI-OFFSET` unit test (insert at L2782). It drives the REAL
> `input` → `before_agent_start` handler chain with a 2-file prompt (`Diff #@a.ts vs #@b.ts`), then renders
> expanded and asserts EACH file's body child carries the file's ACTUAL content — the end-to-end proof that the
> SEP fix produces correct multi-file bodies through the full pipeline (the unit REND-MULTI-OFFSET proved it in
> isolation). **No source change** (T1.S1 owns the fix, LANDED). Uses only existing test infrastructure
> (`captureAllHandlers`, `makeMockCtx`, `runCase`, `assert`, `mod`, `REND_THEME`, `REND_W`, `textOf`, `A_TS`,
> `B_TS`, `TMPDIR`). Optional 3-file variant (cumulative +4 drift) included.

---

## Goal

**Feature Goal:** Lock in the P1.M1.T1.S1 SEP fix with the END-TO-END multi-file regression test — the exact
gap that let the bug ship (bugfix PRD §h2.4: "no automated end-to-end test that injects ≥2 files through the
real path"). A `REND-MULTI-E2E` case that drives the real `input` → `before_agent_start` handler chain with
`Diff #@a.ts vs #@b.ts` (using the existing real fixtures), then renders expanded via
`mod.renderInjectedMessage` and asserts BOTH body children carry the correct file content. This is the E2E
counterpart to T2.S1's unit `REND-MULTI-OFFSET` (which isolates `computeDetailOffsets` with crafted blocks);
together they close the fix-and-verify loop from both the unit and integration angles.

**Deliverable:** Modified `./file-injector.test.mjs` — ONE new `runCase("REND-MULTI-E2E", …)` block appended
immediately after the `REND-MULTI-OFFSET` block's closing `});` (insert at L2782), before the `REND-PAGED-DIR`
comment header (~L2783/2784). Plus an optional 3-file `REND-MULTI-3FILE` variant (cumulative +4 drift).
`file-injector.ts` UNCHANGED. No new helpers, no new top-level fixtures (the 3-file variant writes its own
temporary `c.ts` in the test body and cleans up in `finally`).

**Success Definition:**
1. `node ./file-injector.test.mjs` → **158 passed** (157 baseline + REND-MULTI-E2E; **159** if the optional
   REND-MULTI-3FILE variant is also added), 0 failed, exit 0 — T1.S1 (the SEP fix) is LANDED, so the test is GREEN.
2. `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 23 passed (unchanged).
3. `npm run typecheck` → 0 errors (no source change; trivially clean).
4. `file-injector.ts` byte-for-byte unchanged (`git diff --stat` shows only `file-injector.test.mjs`).
5. The new case(s) print `✓ case REND-MULTI-E2E: …` (and `✓ case REND-MULTI-3FILE: …` if added).

## User Persona

**Target User:** The maintainer who needs assurance that the multi-file expanded (`ctrl+o`) view renders each
file's exact body through the REAL handler pipeline — the PRD §6.3/§11-#34 acceptance criterion the SEP bug
violated. And the future maintainer who must not regress it.

**Use Case:** A user submits `Diff #@a.ts vs #@b.ts`, presses `ctrl+o`, and expects both bodies correct. The
REND-MULTI-E2E test is the automated end-to-end guard — it exercises the exact path that was untested (real
input → before_agent_start → computeDetailOffsets → renderInjectedMessage) and asserts every file's expanded
body is correct.

**Pain Points Addressed:** The test-suite gap that let the SEP bug ship (regression_test_design.md §"The Gap":
"no automated end-to-end test that injects ≥2 files through the real input → before_agent_start →
computeDetailOffsets → renderInjectedMessage path"). The unit REND-MULTI-OFFSET catches the bug in isolation;
REND-MULTI-E2E catches it end-to-end. Together they prevent recurrence from either angle.

## Why

- **Closes the E2E test-suite gap.** The unit REND-MULTI-OFFSET (T2.S1, LANDED) crafts blocks directly and
  calls `computeDetailOffsets` manually — it isolates the buggy function but does NOT exercise the real handler
  chain. REND-MULTI-E2E drives the real `input` → `before_agent_start` handlers (which internally calls
  `computeDetailOffsets` at file-injector.ts L1284) and the real renderer, proving the WHOLE pipeline produces
  correct multi-file bodies. This is the test that would have caught the bug at the integration level
  (bugfix PRD §h3.0 Suggested Fix: "drive the real input + before_agent_start handlers with a multi-file prompt").
- **RED-then-GREEN proof of the SEP fix, end-to-end.** T1.S1 shipped the corrected SEP constant; T2.S1 proved
  the fix in isolation. REND-MULTI-E2E is the end-to-end proof: it FAILS pre-T1.S1 (the second file's body
  renders corrupted — shifted +2 chars with trailing garbage) and PASSES post-T1.S1 (exact bodies). The
  cumulative +4 drift for a 3rd file is covered by the optional REND-MULTI-3FILE variant.
- **The real-handler path is what shipped untested.** Per regression_test_design.md §"The Gap", every existing
  renderer test crafts single-block `message.content`; no test drove ≥2 files through the real handlers. This
  subtask is that test.

## What

No user-visible / API / config / source surface change (internal test coverage). The deliverable is one (or
two) new test cases.

### Success Criteria

- [ ] A `runCase("REND-MULTI-E2E", …)` block exists in `file-injector.test.mjs`, placed immediately after the
      `REND-MULTI-OFFSET` block's closing `});` (insert at L2782) and before the `REND-PAGED-DIR` comment header.
- [ ] The test captures handlers via `captureAllHandlers()` (ONE factory → shared `pending` closure).
- [ ] The test creates ctx via `makeMockCtx(TMPDIR)` (provides `cwd`, `hasUI`, `isProjectTrusted`, `ui.notify`).
- [ ] The test drives `h.input[0]({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx)`
      and asserts `out.action === "transform"`.
- [ ] The test drives `const result = await h.before_agent_start[0]({}, ctx)` and extracts `const msg = result.message`
      (which ALREADY has `computeDetailOffsets` applied internally — do NOT call it manually).
- [ ] The test asserts `msg.details.files.length === 2`.
- [ ] The test renders `const box = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME)`.
- [ ] The test asserts `textOf(box.children[1]).includes("export function add")` (a.ts body — the REAL fixture
      content, A_TS_CONTENT) and `textOf(box.children[3]).includes("export const VALUE = 42")` (b.ts body —
      B_TS_CONTENT). (Body children at ODD indices 1 and 3; read lines at even 0 and 2.)
- [ ] **KEY ASSERTION:** `textOf(box.children[3])` MUST include `export const VALUE = 42` — this FAILS pre-T1.S1
      (shows corrupted content with +2 drift) and PASSES post-T1.S1.
- [ ] (Optional, recommended) A `runCase("REND-MULTI-3FILE", …)` block: writes a temporary `c.ts` with
      `function c() { return 3; }` in the test body, drives `#@a.ts #@b.ts #@c.ts`, asserts
      `textOf(box.children[5]).includes("function c() { return 3; }")` (cumulative +4 drift pre-fix), cleans
      up `c.ts` in `finally`.
- [ ] `node ./file-injector.test.mjs` → 158 passed (159 with the 3-file variant), 0 failed; the new case(s) print ✓.
- [ ] `file-injector.ts` UNCHANGED; no new top-level helpers/fixtures/exports.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim DELIV-2 handler-chain template (L2477-2497, the exact pattern to mirror), the verbatim new test body
(capture→input→before_agent_start→render→assert, with the REAL fixture content strings), the critical correction
that the real fixtures are `export function add` / `export const VALUE = 42` (NOT the unit test's crafted
`function a()`), the fact that `before_agent_start` calls `computeDetailOffsets` internally (do NOT call it
manually — that's the unit test's job), the expanded-Box child layout (body children at ODD indices 1/3/5), the
exact insertion point (L2782, after the LANDED REND-MULTI-OFFSET), the verified infrastructure
(`captureAllHandlers` L185, `makeMockCtx` L162, `REND_THEME`/`REND_W`/`textOf` L2565-2567), the drift arithmetic
explaining WHY the children[3] assertion catches the bug, and the T1.S1 dependency (test PASSES post-fix,
FAILS pre-fix — the designed RED-then-GREEN). The implementer appends one (or two) `runCase` block(s) and runs
the suite.

### Documentation & References

```yaml
# MUST READ — the test design (the E2E pattern, the gap, the assertion approach, Test A + Test B)
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/regression_test_design.md
  why: "§'The Gap' (all renderer tests are single-block → zero drift → the bug shipped; no E2E test drives ≥2
        files through the real handler chain). §'Test A — REND-MULTI-OFFSET (handler chain E2E)' gives the EXACT
        E2E pattern: captureAllHandlers → input → before_agent_start → renderInjectedMessage → assert body children.
        §'Test B — REND-MULTI-3FILE' gives the 3-file cumulative-drift variant. §'Assertion Pattern' documents the
        expanded-Box layout ([read0, body0, read1, body1, ...] → body children at ODD indices). §'Available Fixture
        Constants' (A_TS, B_TS) and the 3-file option (write c.ts in the test body). §'Important: The Fix Must Come
        First' (test FAILS pre-fix, PASSES post-fix)."
  critical: "The E2E test must drive the REAL handlers (captureAllHandlers → input[0] → before_agent_start[0]) —
             NOT call computeDetailOffsets manually (before_agent_start does it internally). It must use the REAL
             a.ts/b.ts fixtures (content is 'export function add...' / 'export const VALUE = 42'), NOT the unit
             test's crafted 'function a()' strings."

# MUST READ — the bug + root cause + the SEP fix this test locks in
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/architecture/system_context.md
  why: "§'The Bug (Issue 1)' pins file-injector.ts L354 SEP (was '\"\\\\n\\\\n\"' length 4, now '\"\\n\\n\"' length 2)
        vs L1286 blocks.join(\"\\n\\n\") (length 2); explains the +2/block drift in starts[i≥1]; gives the standalone
        Node repro. Confirms the model is unaffected (message.content is correct); only the renderer's expanded
        offset-slice tier was corrupted."
  critical: "The test's children[3] assertion (b.ts body) is the line that FAILS pre-T1.S1 and PASSES post-T1.S1.
             T1.S1 has LANDED (b1f0727), so the test is GREEN. The children[1] assertion (a.ts body) is the baseline
             (passes regardless — starts[0]===0)."

# MUST READ — the contract: T1.S1 is the fix (LANDED); T2.S1 is the unit proof (LANDED); T2.S2 is the E2E proof
- file: plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/P1M1T2S1/PRP.md
  why: "T2.S1 (LANDED at L2757-2781) is the UNIT sibling — crafts 2 blocks directly, calls computeDetailOffsets
        MANUALLY, no file I/O, no handlers, uses crafted content 'function a() { return 1; }'. T2.S2 (REND-MULTI-E2E)
        is the E2E counterpart — drives the real handlers, does NOT call computeDetailOffsets manually, uses the
        REAL fixtures. The two are complementary: unit isolates the function; E2E proves the pipeline. T2.S2 inserts
        AFTER T2.S1's block (L2782). Name 'REND-MULTI-E2E' distinct from 'REND-MULTI-OFFSET'."
  critical: "Do NOT duplicate T2.S1's unit test (crafts blocks + manual computeDetailOffsets). Do NOT name this
             'REND-MULTI-OFFSET' (taken). The E2E test's distinguishing feature is the REAL handler chain — preserve
             it (no manual computeDetailOffsets call)."

# The file you edit (the ONLY change — append ONE or TWO runCase blocks)
- file: file-injector.test.mjs
  why: "2953 lines. captureAllHandlers L185-194 (ONE mod.default call → input[0]+before_agent_start[0] share the
        pending closure). makeMockCtx L162-168 (returns {ctx,rec}; ctx has cwd/hasUI/isProjectTrusted/ui.notify).
        DELIV-2 L2477-2497 (the handler-chain E2E template to mirror). REND_THEME/REND_W/textOf L2565-2567.
        A_TS_CONTENT L226-227 ('export function add(a, b)...'), B_TS_CONTENT L228 ('export const VALUE = 42;\\n').
        A_TS L350, B_TS L351, TMPDIR L212. REND-MULTI-OFFSET (LANDED) L2757-2781 — INSERT REND-MULTI-E2E at L2782
        (the blank line after its closing });), before the REND-PAGED-DIR comment header ~L2783/2784."
  pattern: "Mirror DELIV-2's handler-chain structure (capture → input → before_agent_start → extract message),
            extended with: (1) a 2-file prompt, (2) expanded render via mod.renderInjectedMessage, (3) body-child
            assertions on children[1] and children[3] (odd indices). Do NOT call computeDetailOffsets manually
            (before_agent_start does it). Use makeMockCtx(TMPDIR).ctx (NOT FIX — FIX lacks hasUI/isProjectTrusted/ui)."
  gotcha: "The REAL fixtures are 'export function add...' / 'export const VALUE = 42' — NOT the unit test's crafted
           'function a() { return 1; }'. Assert textOf(children[1]).includes('export function add') and
           textOf(children[3]).includes('export const VALUE = 42'). Using the wrong content string is the #1 way
           this test goes wrong. For the optional 3-file variant, the test writes its OWN c.ts with
           'function c() { return 3; }' (simple content is fine there — the test creates it)."

# The source (READ-ONLY — T1.S1 owns the SEP fix; cited only to trace behavior)
- file: file-injector.ts
  why: "computeDetailOffsets L353 (exported; mutates details in place). before_agent_start handler L1278-1290 calls
        computeDetailOffsets(blocks, details) INTERNALLY at L1284 before publishing the message — so the E2E test's
        msg.details.files[i].contentStart/contentLen are ALREADY populated. renderInjectedMessage L742 (exported;
        returns a Box; tier-1 offset slice fires automatically). T2.S2 does NOT edit this file."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD b1f0727, suite GREEN at 157 passed
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (+1 runCase "REND-MULTI-E2E" at L2782; +optional "REND-MULTI-3FILE")
│                                #   captureAllHandlers L185; makeMockCtx L162; DELIV-2 L2477; REND_THEME/W/textOf L2565;
│                                #   A_TS_CONTENT L226 / B_TS_CONTENT L228; A_TS L350 / B_TS L351 / TMPDIR L212;
│                                #   REND-MULTI-OFFSET (LANDED) L2757-2781 → insert REND-MULTI-E2E at L2782
├── file-injector.ts             # UNTOUCHED (T1.S1's SEP fix is the source change, LANDED; T2.S2 consumes it)
├── relative-imports.test.mjs    # run to confirm green (NOT edited)
├── import-behavior.test.mjs     # run to confirm green (NOT edited)
├── scripts/typecheck.mjs        # untouched (no source change → trivially clean)
├── package.json                 # untouched
├── PRD.md / README.md           # read-only
└── plan/009_0d85ac0b1b08/bugfix/001_5505be07608d/
    ├── architecture/{system_context.md, regression_test_design.md, external_deps.md}
    ├── P1M1T1S1/{PRP.md}   # ← T1.S1 (LANDED): the SEP fix this test locks in
    ├── P1M1T2S1/{PRP.md}   # ← T2.S1 (LANDED): REND-MULTI-OFFSET unit sibling
    └── P1M1T2S2/
        ├── research/research_notes.md   # ← verified infra + DELIV-2 template + the real-fixture-content correction
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED (append-only): +1 runCase("REND-MULTI-E2E", …) block at L2782 (after REND-MULTI-OFFSET).
                          #   Optional: +1 runCase("REND-MULTI-3FILE", …) block after REND-MULTI-E2E.
# No other files. No new files. No source change. No new top-level helpers/fixtures/exports (reuses
# captureAllHandlers/makeMockCtx/runCase/assert/mod/REND_THEME/REND_W/textOf/A_TS/B_TS/TMPDIR/fsSync).
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the REAL fixtures are NOT 'function a() { return 1; }'. That simpler string is what the UNIT test
//   (REND-MULTI-OFFSET) CRAFTS directly. The E2E test uses the REAL a.ts/b.ts fixtures (written by buildFixtures):
//     A_TS_CONTENT = "export function add(a, b) {\n  return a + b;\n}\n// a small TypeScript fixture for the #@file tests\n"
//     B_TS_CONTENT = "export const VALUE = 42;\n"
//   So assert textOf(children[1]).includes("export function add") and textOf(children[3]).includes("export const VALUE = 42").
//   (For the optional 3-file variant, the test writes its OWN c.ts with "function c() { return 3; }" — simple content
//   is fine there because the test creates it.) Using the wrong content string is the #1 way this test goes wrong.

// CRITICAL — do NOT call computeDetailOffsets manually in REND-MULTI-E2E. The before_agent_start handler calls it
//   INTERNALLY (file-injector.ts L1284) before publishing the message. Calling it manually would (a) be redundant
//   and (b) erase the "E2E" distinction from the unit REND-MULTI-OFFSET (which DOES call it manually because it
//   bypasses the handler chain). The E2E test's whole point is to exercise the real handler pipeline.

// CRITICAL — use captureAllHandlers() (ONE mod.default call) so input[0] and before_agent_start[0] share the
//   `pending` closure. Do NOT use captureHandler separately for each — that would create TWO factory invocations
//   with separate `pending` vars, and before_agent_start would find pending===null (the input handler's stash
//   lives in a different closure). captureAllHandlers is the verified helper for this (L185-194).

// CRITICAL — use makeMockCtx(TMPDIR).ctx, NOT FIX. FIX = { cwd: TMPDIR } (L361) is for DIRECT injectFiles calls
//   only — it LACKS hasUI/isProjectTrusted/ui. The handler chain needs hasUI (for the notify), isProjectTrusted
//   (for readConfig, though it's not driven here), and ui.notify. makeMockCtx provides all three (L162-168).

// CRITICAL — the KEY ASSERTION is children[3] (b.ts body). Pre-T1.S1 it shows corrupted content (+2 drift:
//   shifted start, trailing garbage from the next block). Post-T1.S1 (LANDED) it includes "export const VALUE = 42".
//   children[1] (a.ts body) is the baseline — it passes regardless (starts[0]===0 has zero drift even pre-fix).
//   If children[1] fails, the test is malformed (re-check the capture/input/before_agent_start wiring); if
//   children[3] fails, T1.S1 hasn't landed (but it has — b1f0727).

// GOTCHA — the expanded-Box body children are at ODD indices. The layout for N text files is
//   [0]=read line file0 (+expand hint), [1]=body file0, [2]=read line file1, [3]=body file1, [5]=body file2 (3-file).
//   So bodyA = textOf(children[1]), bodyB = textOf(children[3]), bodyC = textOf(children[5]). Read lines at even
//   indices. (REND-MULTI-OFFSET L2774-2776 confirms this layout.)

// GOTCHA — textOf(child) = child.render(REND_W).join("\n"). REND_W=2000 (generous → no wrapping). The rendered
//   body string may have trailing padding; use .includes(expected) (NOT ===) for the body-child assertions,
//   matching REND-MULTI-OFFSET's pattern (L2774-2776). Do NOT assert === (padding would break it).

// GOTCHA — session_start does NOT need to be driven. cfg defaults to {} (markdownBareAtImports:undefined → false),
//   which is correct for a #@-only prompt (no bare-@ needed). DELIV-2 (L2451-2456 comment) confirms this. Driving
//   session_start[0] would call readConfig (harmless but unnecessary). Skip it.

// GOTCHA — the test name "REND-MULTI-E2E" must be distinct from every existing case. Existing REND-* names:
//   REND-1..REND-11, REND-OFFSET, REND-MULTI-OFFSET, REND-PAGED-DIR. "REND-MULTI-E2E" is distinct (no collision).
//   The optional 3-file variant should use "REND-MULTI-3FILE" (also distinct).

// GOTCHA — the optional 3-file variant writes c.ts IN THE TEST BODY (fsSync.writeFileSync(path.join(TMPDIR, "c.ts"), ...))
//   and MUST clean it up in a finally block (fsSync.rmSync(path.join(TMPDIR, "c.ts"), { force: true })) so it
//   doesn't leak into other tests that count files in TMPDIR or assert TMPDIR contents. Do NOT add c.ts as a
//   top-level fixture (it's test-local). Use fsSync (already imported at the top of the file).

// LIBRARY — zero-dependency .mjs harness; imports the REAL file-injector.ts via jiti + Pi's alias map. mod.
//   renderInjectedMessage is already exported + asserted. No new export is exercised → no sanity-list /
//   ASSERTED_EXPORTS / completeness-guard edit. The gate is `node ./file-injector.test.mjs` → 158 passed (post-T1.S1).
```

## Implementation Blueprint

### The exact 2-file E2E test (verbatim — append after REND-MULTI-OFFSET's closing `});` at L2782)

```js
// REND-MULTI-E2E — §h3.0 Issue 1 E2E regression (bugfix PRD §h2.4 "no automated end-to-end test that injects ≥2
// files"). The unit REND-MULTI-OFFSET crafts blocks + calls computeDetailOffsets manually; THIS test drives the
// REAL input → before_agent_start handler chain (which calls computeDetailOffsets internally at L1284) with a
// 2-file prompt, then renders expanded and asserts EACH file's body child carries the file's ACTUAL content.
// Pre-T1.S1 (SEP length 4 vs join length 2): children[3] (b.ts body) renders corrupted (+2 drift — shifted start,
// trailing garbage from the next block). Post-T1.S1 (SEP length 2, LANDED b1f0727): exact bodies. This is the
// end-to-end proof of the SEP fix through the full pipeline.
await runCase("REND-MULTI-E2E", "§6.3 multi-file expanded (ctrl+o) E2E: real input→before_agent_start→renderer — EACH file's body is exact (the +2/block drift regression, full handler chain)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);              // cwd + hasUI + isProjectTrusted + ui.notify
  const h = captureAllHandlers();                    // ONE factory → input[0] + before_agent_start[0] share `pending`
  // (a) drive input with a 2-file prompt
  const out = await h.input[0]({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `input must transform a 2-file prompt, got '${out.action}'`);
  // (b) drive before_agent_start — this INTERNALLY calls computeDetailOffsets(blocks, details) (file-injector.ts L1284)
  //     before publishing. Do NOT call computeDetailOffsets manually (that's the unit test's job; this is E2E).
  const result = await h.before_agent_start[0]({}, ctx);
  assert(result && result.message, `before_agent_start must return {message} for a 2-file prompt, got ${JSON.stringify(result)}`);
  const msg = result.message;
  assert(msg.details && msg.details.files.length === 2,
    `details.files has 2 entries (a.ts + b.ts), got ${msg.details?.files?.length}`);
  // (c) render EXPANDED — the renderer's tier-1 offset slice fires automatically (offsets already populated by the handler)
  const box = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  // (d) expanded-Box layout for 2 text files: [0]=read a.ts (+hint), [1]=body a.ts, [2]=read b.ts, [3]=body b.ts.
  //     Body children at ODD indices. textOf may have trailing padding → use .includes (NOT ===).
  const bodyA = textOf(box.children[1]);             // a.ts body — baseline (starts[0]===0, drift zero even pre-fix)
  const bodyB = textOf(box.children[3]);             // b.ts body — THE regression assertion (drift +2 pre-T1.S1)
  assert(bodyA.includes("export function add"),
    `a.ts expanded body (children[1]) carries the REAL a.ts content (A_TS_CONTENT), got ${JSON.stringify(bodyA.slice(0, 80))}`);
  assert(bodyB.includes("export const VALUE = 42"),
    `b.ts expanded body (children[3]) carries the REAL b.ts content (B_TS_CONTENT) — NO +2 drift, got ${JSON.stringify(bodyB.slice(0, 80))}`);
});
```

### The optional 3-file variant (verbatim — append after REND-MULTI-E2E if included)

```js
// REND-MULTI-3FILE — §h3.0 Issue 1 cumulative-drift variant (regression_test_design.md Test B). 3 files → the
// THIRD file's drift would be +4 pre-T1.S1 (2 preceding blocks × +2). Proves the drift is cumulative, not +2 once.
await runCase("REND-MULTI-3FILE", "§6.3 3-file expanded E2E: THIRD file's body is exact (cumulative +4 drift pre-fix)", async () => {
  const cTs = path.join(TMPDIR, "c.ts");
  fsSync.writeFileSync(cTs, "function c() { return 3; }");   // test-local fixture (cleaned up below)
  try {
    const { ctx } = makeMockCtx(TMPDIR);
    const h = captureAllHandlers();
    const out = await h.input[0]({ text: "Review #@a.ts #@b.ts #@c.ts", source: "interactive", images: [] }, ctx);
    assert(out.action === "transform", `input must transform a 3-file prompt, got '${out.action}'`);
    const result = await h.before_agent_start[0]({}, ctx);   // computeDetailOffsets runs internally
    const msg = result.message;
    assert(msg.details.files.length === 3, `details.files has 3 entries, got ${msg.details.files.length}`);
    const box = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
    // [0]=read a.ts, [1]=body a.ts, [2]=read b.ts, [3]=body b.ts, [4]=read c.ts, [5]=body c.ts
    const bodyC = textOf(box.children[5]);                   // c.ts body — cumulative +4 drift pre-T1.S1
    assert(bodyC.includes("function c() { return 3; }"),
      `c.ts expanded body (children[5]) carries the exact content — NO cumulative +4 drift, got ${JSON.stringify(bodyC.slice(0, 80))}`);
  } finally {
    fsSync.rmSync(cTs, { force: true });                     // clean up the test-local fixture
  }
});
```

### Why each assertion holds (the drift arithmetic)

`computeDetailOffsets` builds `starts[]` via `off += b.length + SEP.length` (file-injector.ts L358). The renderer
slices `message.content.slice(d.contentStart, d.contentStart + d.contentLen)` (tier-1, L766). `message.content`
is `blocks.join("\n\n")` (L1286, 2-char separator).
- **Pre-T1.S1** (`SEP = "\\n\\n"`, length 4): `starts[1] = block0.length + 4` but block1's real offset is
  `block0.length + 2` → `details[1].contentStart` is +2 too large → `content.slice` starts 2 chars late → the
  b.ts body is shifted (missing first 2 chars of what it should show, trailing 2 chars bleed in). For a 3rd file,
  `starts[2]` is +4 too large → cumulative drift. → children[3] and children[5] assertions FAIL.
- **Post-T1.S1** (`SEP = "\n\n"`, length 2, LANDED): `starts[i]` matches the real join offsets exactly → slices
  are correct → children[3] and children[5] carry the exact bodies → assertions PASS.

children[1] (a.ts body, file 0) is the baseline: `starts[0]===0` regardless of SEP.length → zero drift → passes
both pre- and post-fix. If children[1] fails, the test wiring is malformed (not the bug).

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — append ONE or TWO runCase blocks):
  - INSERT the REND-MULTI-E2E block (see Blueprint) at L2782 (the blank line after REND-MULTI-OFFSET's closing `});`
    at L2781), before the `// REND-PAGED-DIR` comment header (~L2783/2784).
  - (Optional) INSERT the REND-MULTI-3FILE block immediately after REND-MULTI-E2E's closing `});`.
  - NO edits to: any existing test case (incl. REND-MULTI-OFFSET, REND-OFFSET, REND-PAGED-DIR, DELIV-2, DELIV-6);
    the renderer-test infrastructure (REND_THEME/REND_W/textOf L2565-2567); the sanity list; ASSERTED_EXPORTS;
    the completeness guard; buildFixtures; captureAllHandlers (L185); makeMockCtx (L162); runCase/assert defs.

NO_CHANGES: file-injector.ts (T1.S1 owns the SEP fix, LANDED; T2.S2 consumes it), relative-imports.test.mjs,
            import-behavior.test.mjs, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports. NO new imports (fsSync/path already imported at the top). NO new top-level helpers/fixtures
(reuses captureAllHandlers/makeMockCtx/runCase/assert/mod/REND_THEME/REND_W/textOf/A_TS/B_TS/TMPDIR; the 3-file
variant writes its own test-local c.ts and cleans up).
```

### Implementation Tasks (ordered)

```yaml
Task 1: CONFIRM T1.S1 + T2.S1 have landed (the dependencies)
  - CMD: grep -n 'const SEP' file-injector.ts → expect `const SEP = "\n\n";` (single-backslash; length 2). (T1.S1, LANDED b1f0727.)
  - CMD: grep -n '"REND-MULTI-OFFSET"' file-injector.test.mjs → expect 1 match (~L2757). (T2.S1, LANDED.)
  - CMD: node ./file-injector.test.mjs 2>&1 | grep Result: → expect "Result: 157 passed, 0 failed." (GREEN baseline.)
  - If any of these fail, STOP and report (the dependency isn't met). (Not expected at HEAD b1f0727.)

Task 2: APPEND the REND-MULTI-E2E runCase block (the 2-file E2E test)
  - LOCATE L2781 (REND-MULTI-OFFSET's closing `});`) → INSERT the REND-MULTI-E2E block (see Blueprint verbatim)
    at L2782 (the blank line after), before the REND-PAGED-DIR comment header.
  - The block uses ONLY existing infrastructure: captureAllHandlers, makeMockCtx, runCase, assert, mod, REND_THEME,
    REND_W, textOf. Plus the REAL fixtures (A_TS/B_TS via the prompt; content asserted as A_TS_CONTENT/B_TS_CONTENT).
  - NAMING: "REND-MULTI-E2E" (distinct from REND-MULTI-OFFSET and all other REND-* names).
  - CRITICAL: do NOT call computeDetailOffsets manually (before_agent_start does it internally).
  - CRITICAL: assert "export function add" / "export const VALUE = 42" (the REAL fixture content), NOT "function a()".

Task 3 (OPTIONAL, recommended): APPEND the REND-MULTI-3FILE runCase block (the 3-file cumulative-drift variant)
  - INSERT the REND-MULTI-3FILE block (see Blueprint verbatim) immediately after REND-MULTI-E2E's closing `});`.
  - Writes c.ts IN THE TEST BODY (fsSync.writeFileSync) with "function c() { return 3; }"; cleans up in `finally`
    (fsSync.rmSync). Test-local fixture — do NOT add as a top-level constant.
  - Drives "#@a.ts #@b.ts #@c.ts"; asserts textOf(box.children[5]).includes("function c() { return 3; }").
  - NAMING: "REND-MULTI-3FILE".

Task 4: VERIFY the gates
  - node ./file-injector.test.mjs → EXPECT "Result: 158 passed, 0 failed." (157 + REND-MULTI-E2E), or
    "159 passed" if the 3-file variant is also added. The new case(s) print ✓. Exit 0.
  - node ./relative-imports.test.mjs → 38 passed (unchanged).
  - node ./import-behavior.test.mjs → 23 passed (unchanged).
  - npm run typecheck → 0 errors (no source change; trivially clean).
  - git diff --stat → ONLY file-injector.test.mjs changed (file-injector.ts untouched).
```

## Validation Loop

### Level 1: The gate — full suite green + the new case(s) (post-T1.S1)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected (T1.S1 LANDED): REND-MULTI-E2E prints ✓ (and REND-MULTI-3FILE if added), then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 158 passed, 0 failed.        (157 baseline + REND-MULTI-E2E; 159 if 3-file variant added)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
```

### Level 2: The other two suites (must stay green — T2.S2 adds no source change)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 38 passed, 0 failed
node ./import-behavior.test.mjs     # → 23 passed, 0 failed
# T2.S2 adds no source change, so these must stay green.
```

### Level 3: Targeted new-case verification (the assertions each pass post-T1.S1)

```bash
node ./file-injector.test.mjs 2>&1 | grep -E "case REND-MULTI-E2E|case REND-MULTI-3FILE|Result:"
# Expected: "  ✓ case REND-MULTI-E2E: §6.3 multi-file expanded..." + "Result: 158 passed, 0 failed."
# If a case is ✗, READ its assertion message:
#   - "a.ts expanded body (children[1]) carries the REAL a.ts content" fails → the test is malformed (re-check
#     the capture/input/before_agent_start wiring; children[1] is the baseline and should always pass). NOT a T1.S1 issue.
#   - "b.ts expanded body (children[3]) ... NO +2 drift" fails → either T1.S1 hasn't landed (but it has — b1f0727)
#     OR the assertion used the wrong content string (must be "export const VALUE = 42", NOT "function b()").
#   - children[5] (3-file) fails → cumulative drift; same diagnosis as children[3].
```

### Level 4: Typecheck (trivial — no source change)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# T2.S2 does not touch file-injector.ts, so this is trivially the current (post-T1.S1) state.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → 158 passed (157 + REND-MULTI-E2E; 159 with 3-file variant), 0 failed, exit 0.
- [ ] `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 23 passed.
- [ ] `npm run typecheck` → 0 errors (no source change).
- [ ] `git diff --stat` shows ONLY `file-injector.test.mjs` changed (file-injector.ts untouched).

### Feature Validation (the assertions)

- [ ] (a) `out.action === "transform"` (input transforms the 2-file prompt).
- [ ] (b) `result.message` exists; `msg.details.files.length === 2` (before_agent_start published 2 files).
- [ ] (c1) `textOf(box.children[1]).includes("export function add")` (a.ts body — REAL fixture content).
- [ ] (c2) `textOf(box.children[3]).includes("export const VALUE = 42")` (b.ts body — the regression catch).
- [ ] (optional, 3-file) `textOf(box.children[5]).includes("function c() { return 3; }")` (cumulative +4 drift catch).

### Code Quality Validation

- [ ] The block mirrors DELIV-2's handler-chain structure (capture → input → before_agent_start → extract message),
      extended with expanded render + body-child assertions.
- [ ] Uses ONLY existing infrastructure (captureAllHandlers/makeMockCtx/runCase/assert/mod/REND_THEME/REND_W/textOf);
      no new helpers/fixtures.
- [ ] Does NOT call computeDetailOffsets manually (before_agent_start does it internally — preserves E2E distinction).
- [ ] Uses makeMockCtx(TMPDIR).ctx (NOT FIX — FIX lacks hasUI/isProjectTrusted/ui).
- [ ] Asserts the REAL fixture content ("export function add" / "export const VALUE = 42"), NOT the unit test's
      crafted "function a()".
- [ ] Name "REND-MULTI-E2E" distinct from every existing case (and "REND-MULTI-3FILE" for the optional variant).
- [ ] Append-only: no existing case/infrastructure line modified.
- [ ] (3-file variant) c.ts written in the test body + cleaned up in `finally` (no leak).

### Scope Discipline

- [ ] file-injector.ts UNCHANGED (T1.S1 owns the SEP fix, LANDED; T2.S2 consumes it).
- [ ] No sanity-list / ASSERTED_EXPORTS / completeness-guard edit (no new export exercised).
- [ ] relative-imports.test.mjs / import-behavior.test.mjs UNCHANGED.

### Documentation

- [ ] The block's header comment cites bugfix §h3.0 Issue 1, §h2.4, regression_test_design.md Test A, and explains
      why the E2E sibling catches what the unit REND-MULTI-OFFSET isolates.
- [ ] No README/user-facing change (test-only).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit file-injector.ts.** T1.S1 owns the SEP fix and is LANDED (b1f0727). T2.S2 is test-only. If an
  assertion fails, the cause is either a malformed test OR (impossibly, since T1.S1 landed) T1.S1-not-yet-landed —
  NOT something T2.S2 patches in source.
- ❌ **Do NOT assert the body contains `function a() { return 1; }` / `function b() { return 2; }`.** Those are the
  UNIT test's (REND-MULTI-OFFSET) CRAFTED string literals. The E2E test uses the REAL fixtures: assert
  `textOf(children[1]).includes("export function add")` and `textOf(children[3]).includes("export const VALUE = 42")`.
  (The optional c.ts variant DOES use `function c() { return 3; }` because the test creates that file itself.)
- ❌ **Do NOT call `computeDetailOffsets` manually.** The before_agent_start handler calls it internally (L1284).
  Calling it manually would (a) be redundant and (b) erase the E2E distinction from the unit REND-MULTI-OFFSET.
  The E2E test's whole point is the real handler pipeline.
- ❌ **Do NOT use `captureHandler` separately for input and before_agent_start.** That creates TWO factory
  invocations with separate `pending` closures; before_agent_start would find pending===null. Use
  `captureAllHandlers()` (ONE mod.default call → shared `pending` closure).
- ❌ **Do NOT use `FIX` as the ctx.** FIX = `{ cwd: TMPDIR }` lacks hasUI/isProjectTrusted/ui. Use
  `makeMockCtx(TMPDIR).ctx` (provides all three).
- ❌ **Do NOT weaken the children[3] assertion to force green.** If it fails, the cause is a malformed test
  (wrong content string) — NOT the assertion being too strict. Fix the content string to the REAL fixture content.
- ❌ **Do NOT use `===` for the body-child assertions.** `textOf()` may include trailing render padding; use
  `.includes(expected)` (matching REND-MULTI-OFFSET's pattern).
- ❌ **Do NOT use the wrong child indices.** Expanded-Box layout is `[read0, body0, read1, body1, ...]` → body
  children at ODD indices (1, 3, 5). Using children[0]/children[2] would assert on the READ lines, not the bodies.
- ❌ **Do NOT name it REND-MULTI-OFFSET** (that's T2.S1's name, LANDED) or any existing REND-* name. Use
  "REND-MULTI-E2E" (and "REND-MULTI-3FILE" for the optional variant).
- ❌ **Do NOT forget to clean up c.ts** (3-file variant). Write it in the test body and `fsSync.rmSync` it in a
  `finally` block so it doesn't leak into other tests. Do NOT add c.ts as a top-level fixture.
- ❌ **Do NOT drive `session_start` unnecessarily.** cfg defaults to `markdownBareAtImports:false` (correct for a
  #@-only prompt). Driving session_start[0] is harmless but adds noise. Skip it (DELIV-2 confirms this).
- ❌ **Do NOT duplicate T2.S1's unit test.** The two must remain complementary: unit (crafts blocks, manual
  computeDetailOffsets, crafted content) vs E2E (real handlers, no manual computeDetailOffsets, real fixtures).
  If you find yourself crafting blocks as string literals, you're writing the unit test again — stop.

---

## Confidence Score: 10/10

Test-only, one file, one (or two) `runCase` blocks — the verbatim test bodies are specified (2-file E2E +
optional 3-file), the DELIV-2 handler-chain template is pinned at L2477-2497, the critical correction (real
fixtures are `export function add` / `export const VALUE = 42`, NOT the unit's `function a()`) is documented,
the fact that before_agent_start calls computeDetailOffsets internally (do NOT call manually) is explicit, the
expanded-Box child layout (body at odd indices 1/3/5) is confirmed by REND-MULTI-OFFSET, the insertion point is
fixed (L2782, after the LANDED REND-MULTI-OFFSET), the drift arithmetic explaining why children[3]/children[5]
catch the bug is documented, and the T1.S1 dependency is explicit (test PASSES post-fix, FAILS pre-fix — T1.S1
is LANDED so GREEN). No source change, no new helpers/fixtures/exports, no new imports. The gate is
`node ./file-injector.test.mjs` → 158 passed (159 with 3-file). The -0 reflects a deterministic, trace-verified,
no-source-change test addition with exact commands and the real-fixture-content correction that the item
description got wrong.