# PRP — P1.M1.T2.S1: Update COL-4 and add no-fetch regression tests for `#filename.ext` patterns (BUG-001)

---

## Goal

**Feature Goal**: Lock in the BUG-001 fix (S1's `CODE_EXTENSIONS` deny-list gate) with a
**hermetic, zero-network regression suite** in `url-injection.test.mjs` that (a) corrects the
sole existing false-positive assertion (`COL-4` for `#node.js`), (b) proves **no fetch fires**
for representative code-file-extension tokens (`#main.go`, `#notes.md`, `#config.json`,
`#image.png`, `#script.py`, `#utils.rs`, `#spec.tsx`, `#app.cs`, `#lib.java`, `#data.csv`),
(c) proves the **content-injection harm** is eliminated (the Go homepage is NOT delivered to
the model even when a 200-OK rich-HTML response is "waiting"), and (d) proves the deny-list's
**scope** is correct (explicit-scheme tokens like `#https://node.js` STILL fetch).

**Deliverable**: A modified `url-injection.test.mjs` — `COL-4` polished in place (asserts no
fetch) + a new 12-case `BUG1-*` group inserted between the COLLISION and NORMALIZATION
sections. ~21 → ~33 cases. No source, no README, no other test files touched.

**Success Definition**:
- `npm test` exits 0 with S1's gate LIVE (the 12 new cases PASS).
- The 12 new cases are genuine regression guards: with S1's gate temporarily removed,
  `BUG1-1`..`BUG1-11` FAIL (proving they actually guard the fix; `BUG1-12` stays green —
  it asserts the bypass which is independent of the gate).
- The existing 21 cases stay green (only `COL-4`'s assertions change, matching the fix).
- No new harness helpers (reuse `makeRes`/`FIX`/`runCase`/`hasBlock`/`origFetch`/`RICH_HTML`).

## User Persona

**Target User**: The maintainer (and the CI gate). Every future edit to `URL_SHAPE_RE` or the
URL scan loop must keep these cases green — a regression that reintroduces `#filename.ext`
fetches is caught instantly, hermetically (no network in CI).
**Use Case**: `npm test` runs the full chain; `url-injection.test.mjs` runs last and exits 0
iff the deny-list gate holds for all 10 representative extensions + the harm + the bypass.
**User Journey**: A future PR loosens the gate → `BUG1-1` (`#main.go` → `calls===0`) fails →
CI blocks the merge before any real network egress or content injection ships.
**Pain Points Addressed**: BUG-001 was invisible to the suite because every prior fetch stub
returned 404 (silent no-op) and the only false-positive asserted was `#node.js`. These tests
close that gap with `calls`-spies (prove ZERO egress) and a 200-OK rich-HTML stub (prove ZERO
content injection even when a domain resolves).

## Why

- **The fix without a guard is unmaintainable.** S1's `CODE_EXTENSIONS` gate is a regex/loop
  change that a future refactor could silently revert; without these tests the suite regresses
  to the BUG-001 blind spot (404 stubs mask the egress/injection).
- **Closes the two PRD-identified test gaps** (test_analysis.md §11): (1) no `#filename.ext`
  no-fetch test existed (only `#fff`/`#v1.2`/`#3.14` which FAIL the alpha-TLD gate); (2) no
  test proved a SUCCESSFUL fetch for a false-positive domain injects content. Both are now
  covered by the matrix (BUG1-1..10) and the harm test (BUG1-11).
- **Documents the deny-list's scope.** `BUG1-12` (bypass) pins the contract: scheme-less
  `#node.js` is blocked, but `#https://node.js` still works — so the user can always force a
  URL by writing the scheme. This prevents an over-broad "fix" that breaks legitimate URLs.

## What

Edit **only** `url-injection.test.mjs`:

1. **Polish `COL-4` (L400-414, in place)** — final state: `calls===0`, `injected===0`, no block,
   **`r.text === "#node.js"` (verbatim)**; comment reflects that `js` is now a `CODE_EXTENSIONS`
   member (not that it fails `URL_SHAPE_RE`).
2. **Insert a `BUG1-*` group** (after COL-5's `});` at L427, before the NORMALIZATION header
   at L430): `BUG1-1`..`BUG1-10` (no-fetch matrix) + `BUG1-11` (content-injection harm) +
   `BUG1-12` (explicit-scheme bypass). Each follows the `calls`-spy + `try/finally` restore pattern.

### Success Criteria

- [ ] `COL-4` asserts `calls.length === 0` (NOT 1), `r.injected === 0`, no `https://node.js` block, AND `r.text === "#node.js"`.
- [ ] `BUG1-1`..`BUG1-10` each assert `calls.length === 0` + `r.injected === 0` + `r.text === prompt` for: main.go, notes.md, config.json, image.png, script.py, utils.rs, spec.tsx, app.cs, lib.java, data.csv.
- [ ] `BUG1-11` stubs fetch to a 200-OK `text/html` `RICH_HTML` response and asserts `r.injected === 0` + no block contains `https://main.go` (+ `calls.length === 0`).
- [ ] `BUG1-12` stubs fetch to 404 and asserts `#https://node.js` STILL fetches (`calls.length === 1`) + `r.injected === 0` + `r.text === '#https://node.js'`.
- [ ] S1's `DENY-1` (if present) is consolidated into `BUG1-1` (no duplicate `#main.go` case).
- [ ] `npm test` exits 0 (all 4 test files green) with S1's gate live; the 12 new cases FAIL if the gate is removed.

## All Needed Context

### Context Completeness Check

_Pass._ "If someone knew nothing about this codebase, would they have everything needed?" —
**Yes.** The exact loader, the `runCase`/`assert`/`makeRes`/`RICH_HTML`/`FIX`/`hasBlock`/`origFetch`
definitions and line numbers, the exact current `COL-4` body to overwrite, the exact insertion
boundary (after COL-5 `});`, before the NORMALIZATION `═══` line), the exact 12 case specs (id,
prompt, stub, assertions), the dedup rule for S1's `DENY-1`, and the verified validation commands
are all below. No domain inference required.

### Documentation & References

```yaml
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/test_analysis.md
  why: AUTHORITATIVE test-harness reference — the jiti loader, runCase, makeRes, RICH_HTML, FIX,
       hasBlock, the fetch-stub + calls-spy pattern, COL-4's current code, and the full case list.
  section: "## 2 The Jiti Loader" + "## 3 Assertion Harness" + "## 5 Fetch Stubbing Pattern"
           + "## 6 The COL-4 Test" + "## 10 Key Test Conventions" + "## 11 Test Gaps"
  critical: |
    Every fetch stub MUST restore globalThis.fetch=origFetch in a finally (a leaked stub poisons
    later cases / hits real network). Use a calls-SPY to prove ZERO fetch ("absence of a stub
    proves nothing"). r.text===prompt is the strongest "nothing happened" assertion.

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M1T1S1/PRP.md
  why: The PARALLEL implementation (the gate THIS task guards). Defines CODE_EXTENSIONS, the
       post-gate continue in the URL scan loop, S1's own DENY-1 anchor, and S1's COL-4 flip.
  take: Assume S1 is LIVE when T2.S1 runs. S1's DENY-1 (#main.go) and COL-4 flip may already be
        present — CONSOLIDATE (delete DENY-1, BUG1-1 owns #main.go; overwrite COL-4 to final state).

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/source_analysis.md
  why: The exact URL scan loop (§2, §9 in test_analysis) + enableUrls default semantics.
  section: "§2 URL scan loop" — confirms scheme-less tokens route through URL_SHAPE_RE then the gate.

# The ONLY file this task edits:
- file: url-injection.test.mjs
  why: Polish COL-4 (L400-414); insert the BUG1-* group in the L427→L430 gap.
  pattern: mirror COL-2 (the prose no-fetch case) for the calls-spy + try/finally + verbatim shape;
           mirror FAIL-1 (404 → verbatim) for BUG1-12's bypass assertions.
  gotcha: runCase ids must be UNIQUE. If S1 added DENY-1, delete it (BUG1-1 supersedes it) — do NOT
          leave two #main.go cases. Do NOT re-declare makeRes/FIX/runCase/hasBlock/origFetch/RICH_HTML.
```

### Current Codebase tree (the files this task touches)

```bash
.
├── url-injection.test.mjs    # EDIT: polish COL-4 (L400-414) + insert BUG1-* group (L427→L430 gap)
├── file-injector.ts          # NOT modified (S1 owns the CODE_EXTENSIONS gate; it is ASSUMED LIVE)
├── file-injector.test.mjs    # NOT modified (BUG-002 notify tests are P1.M2.T2.S1)
├── import-behavior.test.mjs  # NOT modified
├── relative-imports.test.mjs # NOT modified
├── README.md                 # NOT modified (P1.M3.T1.S1)
└── plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M1T2S1/
    ├── PRP.md                # THIS file.
    └── research/notes.md     # (exists) line-precise research record.
```

### Desired Codebase tree with files to be added

```bash
# No NEW files. The single edited file, url-injection.test.mjs, gains (all in-place / one new block):
#   L400-414  COL-4 polished in place (calls===0, injected===0, no block, r.text==='#node.js', new comment)
#   L427→430  NEW block: console.log("BUG-001 REGRESSION…") + BUG1-1..BUG1-11
#             + console.log("BUG-001 BYPASS…") + BUG1-12
#   (DENY-1, if S1 added it, is DELETED here — BUG1-1 owns #main.go)
# Net: ~21 → ~33 runCase entries; `npm test` still chains unchanged.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL (dependency): these tests REQUIRE S1's CODE_EXTENSIONS gate to be LIVE in file-injector.ts.
//   If S1 has NOT landed yet, BUG1-1..BUG1-11 FAIL (calls===1 / injected===1) — that is CORRECT TDD;
//   run them only after S1 is complete. BUG1-12 (bypass) is gate-independent and passes either way.

// CRITICAL (fetch restore): EVERY stub MUST restore globalThis.fetch = origFetch in a `finally`.
//   A leaked stub poisons later cases (DET/DIS/COL/FAIL groups) and, worse, could hit the REAL network.
//   origFetch is captured ONCE at module top-level (L132) — reuse it, do not re-capture.

// CRITICAL (spy, not absence): assert calls.length===0 with a calls-SPY
//   (`globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }`), NEVER by
//   "fetch wasn't stubbed so it must not have been called". test_analysis §10 rule 4: "absence of a
//   stub proves nothing." A 404/no-stub makes a false-positive a silent no-op (exactly the BUG-001 blind spot).

// CRITICAL (runCase id uniqueness): every runCase id must be unique. If S1 added DENY-1 (#main.go),
//   DELETE it and let BUG1-1 own #main.go. Do NOT keep two #main.go cases.

// GOTCHA (RICH_HTML): for BUG1-11 (content-harm), the fetch stub returns a 200-OK text/html RICH_HTML
//   body. With S1's gate, #main.go never reaches fetch (calls===0) so the stub is never invoked — the
//   test still PASSES (injected===0). The stub is deliberate: it proves the harm is blocked EVEN when a
//   successful rich response is available, and makes the test FAIL if the gate is removed (then fetch
//   fires → defuddle extracts the Go homepage → injected===1 → assert fails). Do NOT swap RICH_HTML for
//   a trivial body (<200 chars triggers the SPA fallback, masking the regression).

// GOTCHA (verbatim): r.text === prompt is the byte-for-byte "nothing was stripped" check (markers are
//   never removed). Use it for every no-fetch case (the prompt returned unchanged). For BUG1-12, the
//   prompt is '#https://node.js' literally.
```

## Implementation Blueprint

### Data models and structure

None. This is a test-only task. No types, no models, no runtime code. The only "model" is the
existing `runCase(n, name, fn)` contract (id `string`, name `string`, async fn throwing on fail).

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: POLISH COL-4 IN PLACE (url-injection.test.mjs L400-414)
  - OVERWRITE the COL-4 runCase (id stays "COL-4") so its final state is:
      name: "collision: #node.js is a code-extension token → DENIED (no fetch), verbatim"
      comment: "COL-4 — #node.js: final label 'js' is in CODE_EXTENSIONS → the deny-list gate rejects
               it BEFORE fetch (NOT because URL_SHAPE_RE fails — it passes; the gate is the guard)."
      body: calls-spy + try/finally; assert calls.length===0; assert r.injected===0;
            assert !hasBlock(r,'<file name="https://node.js">'); assert r.text==="#node.js".
  - NOTE: S1 may have already flipped calls 1→0. Overwrite to the FULL final state (idempotent) so the
          comment + the r.text verbatim assertion are present regardless of S1's exact edit.
  - DO NOT change the id "COL-4" or move it (it stays in the COLLISION section).

Task 2: CONSOLIDATE S1's DENY-1 (if present) — delete-if-exists
  - IF a runCase("DENY-1", …, "#main.go", …) exists (S1's TDD anchor), DELETE it entirely.
  - WHY: BUG1-1 (Task 3) asserts the same #main.go no-fetch and is a superset (adds r.text verbatim).
         Two #main.go cases is redundant; runCase ids must stay unique. One canonical case is cleaner.
  - IF DENY-1 does NOT exist, skip (BUG1-1 covers #main.go).

Task 3: INSERT the no-fetch matrix — BUG1-1..BUG1-10 (in the L427→L430 gap, after COL-5, before NORMALIZATION)
  - ADD a section header first: `console.log("\nBUG-001 REGRESSION: code-extension tokens must NOT fetch");`
  - ADD a one-line comment: "// BUG-001 — scheme-less tokens whose final label ∈ CODE_EXTENSIONS are
         //  denied BEFORE fetch (no egress, no injection). Each case spies on globalThis.fetch and
         //  asserts ZERO calls. These FAIL if S1's gate is removed — the regression guard for BUG-001."
  - ADD 10 runCase entries (BUG1-1..BUG1-10), each with this shape:
        await runCase("BUG1-N", "no-fetch: #<file>.<ext> (ext∈CODE_EXTENSIONS) → zero calls, verbatim", async () => {
          const calls = [];
          const prompt = "<the #token.ext>";
          try {
            globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
            const r = await mod.injectFiles(prompt, [], FIX, false, true);
            assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
            assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
            assert(r.text === prompt, `prompt returned verbatim; got ${JSON.stringify(r.text)}`);
          } finally { globalThis.fetch = origFetch; }
        });
  - The 10 prompts (ext ∈ S1's CODE_EXTENSIONS): "#main.go", "#notes.md", "#config.json", "#image.png",
        "#script.py", "#utils.rs", "#spec.tsx", "#app.cs", "#lib.java", "#data.csv".
  - NAMING: BUG1-1 (#main.go) … BUG1-10 (#data.csv), in that order.
  - DEPENDS ON: Task 2 (so BUG1-1 is the sole #main.go case).

Task 4: INSERT the content-injection-harm case — BUG1-11 (immediately after BUG1-10, same section)
  - ADD a comment: "// BUG1-11 — the CONTENT-INJECTION harm guard. A 200-OK text/html RICH_HTML response
         //  is 'waiting' (the Go homepage), yet #main.go is denied → fetch never fires → injected===0
         //  and no Go-homepage block. WITHOUT the gate this FAILS (fetch→extract→inject the homepage)."
  - BODY:
        const calls = [];
        try {
          globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML, status: 200, ok: true }); };
          const r = await mod.injectFiles("refactor #main.go now", [], FIX, false, true);
          assert(calls.length === 0, `#main.go denied → no fetch; calls=${JSON.stringify(calls)}`);
          assert(r.injected === 0, `no content injected (Go homepage must NOT reach the model); got ${r.injected}`);
          assert(!hasBlock(r, "https://main.go"), "no <file name=\"https://main.go\"> block");
        } finally { globalThis.fetch = origFetch; }
  - CRITICAL: use RICH_HTML (≥200 chars) so that IF the gate were absent, defuddle would inject (not SPA-fall).

Task 5: INSERT the bypass case — BUG1-12 (new sub-header, after BUG1-11, before NORMALIZATION)
  - ADD a sub-header: `console.log("\nBUG-001 BYPASS: explicit-scheme tokens still fetch (deny-list is scheme-less only)");`
  - ADD a comment: "// BUG1-12 — the deny-list gates SCHEME-LESS tokens only. #https://node.js carries an
         //  explicit https:// scheme → it BYPASSES the gate → fetch IS called. Proves the fix's scope:
         //  a user can always force a URL by writing the scheme. (Gate-independent: passes with or without S1.)"
  - BODY:
        const calls = [];
        try {
          globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
          const r = await mod.injectFiles("#https://node.js", [], FIX, false, true);
          assert(calls.length === 1, `explicit scheme → fetch IS called; calls=${calls.length}`);
          assert(calls[0] === "https://node.js", `fetched the exact URL; got ${calls[0]}`);
          assert(r.injected === 0, `404 → verbatim; got injected===${r.injected}`);
          assert(r.text === "#https://node.js", `prompt verbatim; got ${JSON.stringify(r.text)}`);
        } finally { globalThis.fetch = origFetch; }

Task 6: VALIDATE
  - RUN: node ./url-injection.test.mjs  → EXPECT exit 0, ~33 cases, "BUG-001 REGRESSION" + "BUG-001 BYPASS" sections print all PASS.
  - RUN: npm test                        → EXPECT exit 0 (all 4 files; url-injection runs LAST).
  - RUN: npm run typecheck               → EXPECT exit 0 (unchanged — .mjs not typechecked; S1's source is what it checks).
  - (Optional regression-guard sanity — DO NOT commit the temp change): comment out S1's gate `continue`
         in file-injector.ts → re-run node ./url-injection.test.mjs → BUG1-1..BUG1-11 should FAIL, COL-4
         should FAIL, BUG1-12 + the other ~20 should still PASS. Restore the gate. Proves the tests guard the fix.
```

### Implementation Patterns & Key Details

```js
// THE no-fetch case shape (BUG1-1..BUG1-10) — mirror COL-2's calls-spy + try/finally + verbatim pattern:
await runCase("BUG1-1", "no-fetch: #main.go (ext 'go' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#main.go";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // SPY — proves ZERO egress
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch; // ALWAYS restore — a leaked stub poisons later cases / hits real network
  }
});

// THE content-harm case (BUG1-11) — the strongest guard: a 200-OK rich body is "waiting" but never injected
await runCase("BUG1-11", "harm: refactor #main.go now → Go homepage NOT injected (gate denies before fetch)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML, status: 200, ok: true }); };
    const r = await mod.injectFiles("refactor #main.go now", [], FIX, false, true);
    assert(calls.length === 0, `#main.go denied → fetch never fires; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `no content injected; got injected===${r.injected}`);
    assert(!hasBlock(r, "https://main.go"), 'no <file name="https://main.go"> block');
  } finally { globalThis.fetch = origFetch; }
});

// THE bypass case (BUG1-12) — explicit scheme bypasses the deny-list (scope proof)
await runCase("BUG1-12", "bypass: #https://node.js → explicit scheme STILL fetches (404 → verbatim)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles("#https://node.js", [], FIX, false, true);
    assert(calls.length === 1, `explicit scheme bypasses deny-list → fetch IS called; calls=${calls.length}`);
    assert(calls[0] === "https://node.js", `fetched the exact URL; got ${calls[0]}`);
    assert(r.injected === 0, `404 → verbatim; got injected===${r.injected}`);
    assert(r.text === "#https://node.js", `prompt verbatim; got ${JSON.stringify(r.text)}`);
  } finally { globalThis.fetch = origFetch; }
});
```

### Integration Points

```yaml
TEST FILE: url-injection.test.mjs
  - section: "COLLISION" → COL-4 polished in place (L400-414); no other COLLISION case touched.
  - insert:  new "BUG-001 REGRESSION" + "BUG-001 BYPASS" block in the L427→L430 gap (after COL-5, before NORMALIZATION).
  - dedup:   delete S1's DENY-1 (#main.go) if present; BUG1-1 owns #main.go.
SOURCE: none (file-injector.ts is ASSUMED to carry S1's CODE_EXTENSIONS gate — do NOT edit it).
PACKAGE.JSON: none (the `test` chain already includes url-injection.test.mjs as the last step).
README: none (P1.M3.T1.S1 owns the user-facing doc update).
DOWNSTREAM: these cases are the CI regression guard for BUG-001; P1.M2.T2.S1 adds BUG-002 notify tests.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# .mjs files are not linted/typechecked by this project (no eslint/tsc on .mjs). The only static check is
# that the file parses and runs. Node parses on first require; a syntax error → immediate throw → exit 1.
node --check ./url-injection.test.mjs
# Expected: no output, exit 0 (syntax valid). If it errors, READ the line number and fix.
# (npm run typecheck is unaffected — it only checks file-injector.ts; .mjs files are not in its scope.)
```

### Level 2: Unit Tests (Component Validation)

```bash
# Run the target file in isolation first (fast feedback; url-injection.test.mjs runs LAST in the chain).
node ./url-injection.test.mjs
# Expected: exit 0. Prints "DETECTION", "DISPATCH", "COLLISION" (COL-4 now asserts NO fetch),
#   "BUG-001 REGRESSION: code-extension tokens must NOT fetch" (BUG1-1..BUG1-11 all PASS),
#   "BUG-001 BYPASS: explicit-scheme tokens still fetch …" (BUG1-12 PASS),
#   "SCHEME-LESS NORMALIZATION" (NORM-1), "FAILURE / GUARD" (FAIL-1..9). Final "Result: N passed, 0 failed."

# Then the full chain (the `test` script): url-injection runs LAST, so all 4 must be green.
npm test
# Expected: exit 0. (Requires the global pi package for the jiti loader. If it fails ONLY due to a missing
#   global pi, that is environmental, not a test-logic failure.)
```

### Level 3: Integration Testing (the regression-guard proof — DO NOT commit the temp change)

```bash
# PROVE the new tests actually guard the fix: temporarily disable S1's gate and confirm BUG1-1..BUG1-11 fail.
# 1. In file-injector.ts, find S1's CODE_EXTENSIONS gate (the `continue`/skip in the URL scan loop) and
#    comment it out (e.g. `// if (CODE_EXTENSIONS.has(ext)) continue;`).
# 2. Re-run:
node ./url-injection.test.mjs
# Expected: BUG1-1..BUG1-11 FAIL (calls===1 / injected===1 — #main.go fetches and, with RICH_HTML, injects
#   the Go homepage). COL-4 FAILS (calls===1). BUG1-12 + the ~20 other cases still PASS. This proves the
#   11 new guards are load-bearing. (If NONE fail with the gate off, the tests are not guarding the fix — re-check.)
# 3. RESTORE the gate line in file-injector.ts. Re-run node ./url-injection.test.mjs → exit 0.
# 4. git diff file-injector.ts → MUST be empty (you restored it). Only url-injection.test.mjs is committed.
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (Hermetic by construction — every fetch is stubbed via globalThis.fetch; ZERO real network in CI.
#  No Playwright/Docker/DB/perf/security scanning applies to a test-only .mjs change.)

# Optional breadth check: confirm S1's CODE_EXTENSIONS actually contains the 10 extensions the matrix uses.
grep -nE "'(go|md|json|png|py|rs|cs|java|tsx|csv)'" file-injector.ts | head
# Expected: hits in the CODE_EXTENSIONS Set definition. If any extension is MISSING from S1's set, that
#   BUG1-N case will FAIL (calls===1) — report it as an S1 scope gap, do NOT weaken the test assertion.
```

## Final Validation Checklist

### Technical Validation
- [ ] `node --check ./url-injection.test.mjs` exits 0 (valid syntax).
- [ ] `node ./url-injection.test.mjs` exits 0 (~33 cases; BUG-001 REGRESSION + BYPASS sections print all PASS).
- [ ] `npm test` exits 0 (all 4 test files green).
- [ ] `npm run typecheck` exits 0 (unchanged; confirms S1's source edit is clean).

### Feature Validation
- [ ] `COL-4` asserts `calls===0` + `injected===0` + no block + `r.text==="#node.js"`; comment reflects the CODE_EXTENSIONS denial of `js`.
- [ ] `BUG1-1`..`BUG1-10` cover the 10 listed extensions, each asserting zero calls + `injected===0` + verbatim.
- [ ] `BUG1-11` uses a 200-OK `RICH_HTML` stub and asserts `injected===0` + no `https://main.go` block + zero calls.
- [ ] `BUG1-12` asserts `#https://node.js` STILL fetches (`calls===1`, exact URL) + 404 verbatim.
- [ ] Regression-guard proof: disabling S1's gate makes `BUG1-1`..`BUG1-11` + `COL-4` FAIL (Level 3).

### Code Quality Validation
- [ ] Reuses `makeRes`/`FIX`/`runCase`/`hasBlock`/`origFetch`/`RICH_HTML` — no re-declaration, no new helpers.
- [ ] Every fetch stub restores `globalThis.fetch = origFetch` in a `finally`.
- [ ] `runCase` ids are unique; S1's `DENY-1` consolidated into `BUG1-1` (no duplicate `#main.go`).
- [ ] The new block sits in the L427→L430 gap (after COL-5, before NORMALIZATION) — clean insertion, no relocation.

### Documentation & Deployment
- [ ] Each `BUG1-*` case has a one-line comment naming the extension / the harm / the bypass rationale.
- [ ] No user-facing/config/API surface change (test-only); no README edit (P1.M3.T1.S1).

---

## Anti-Patterns to Avoid

- ❌ Don't assert "no fetch" by leaving fetch un-stubbed — use a `calls`-spy. An unstubbed fetch would hit the REAL network AND "absence of a stub proves nothing" (test_analysis §10 rule 4).
- ❌ Don't skip the `finally { globalThis.fetch = origFetch }` — a leaked stub poisons later cases (DET/DIS/COL/FAIL) and can hit real network.
- ❌ Don't keep S1's `DENY-1` AND add `BUG1-1` — two `#main.go` cases is redundant and risks an id/prompt collision. Consolidate into `BUG1-1`.
- ❌ Don't swap `RICH_HTML` for a trivial body in `BUG1-11` — a `<200`-char body triggers the SPA fallback, which masks the regression (injected===0 for the wrong reason).
- ❌ Don't weaken a `BUG1-*` assertion to make it pass if an extension is missing from S1's `CODE_EXTENSIONS` — report the S1 scope gap instead; the test must pin the REQUIRED behavior.
- ❌ Don't edit `file-injector.ts`, `README.md`, or the other 3 test files — S1 owns the gate, P1.M3.T1.S1 owns docs, P1.M2.T2.S1 owns BUG-002 tests.
- ❌ Don't change `COL-4`'s id or move it out of the COLLISION section — polish it in place.
- ❌ Don't make `BUG1-12` assert zero fetch — the bypass case MUST assert `calls===1` (explicit scheme bypasses the gate); that's the whole point of the scope proof.
- ❌ Don't run these tests before S1 lands and then "fix" them by weakening assertions — they FAIL without the gate by design (correct TDD).

---

## Confidence Score

**9.5 / 10** for one-pass success. This is a pure, additive test change that reuses well-documented
harness primitives (`runCase`/`makeRes`/`RICH_HTML`/`calls`-spy/`try-finally` restore) with exact
line anchors (COL-4 at L400-414; insertion gap L427→L430). The 12 case specs are unambiguous (id,
prompt, stub, assertions all given verbatim). The two genuine risks are environmental, not logical:
(1) **ordering with S1** — mitigated by the explicit consolidate-DENY-1 / overwrite-COL-4 / dependency
note (assume S1 live); (2) **an extension missing from S1's CODE_EXTENSIONS** — mitigated by the
Level-4 grep check + the "report the gap, don't weaken" rule. The regression-guard proof (Level 3)
guarantees the tests are load-bearing. No source/type/model work, so no deep-integration risk.

## Parallel-Safety Note (for the orchestrator / merger)

- **vs P1.M1.T1.S1** (the gate implementation — "Implementing", runs first): S1 edits `file-injector.ts`
  (adds CODE_EXTENSIONS + the gate) AND touches `url-injection.test.mjs` (adds DENY-1 + flips COL-4).
  T2.S1 (THIS task) edits ONLY `url-injection.test.mjs`. Overlap = `url-injection.test.mjs`. To avoid a
  merge conflict: **T2.S1 runs AFTER S1** (S1's DENY-1 + flipped COL-4 are already on disk; T2.S1 deletes
  DENY-1 and overwrites COL-4 to the final state). If run concurrently, the two edits to
  `url-injection.test.mjs` (S1: DENY-1 + COL-4 flip; T2.S1: BUG1-* block + COL-4 polish + DENY-1 delete)
  would conflict — **sequence them (S1 then T2.S1)**.
- **vs P1.M2.T2.S1** (BUG-002 notify tests): that task edits `file-injector.test.mjs` (notify wording),
  NOT `url-injection.test.mjs`. No overlap.
- **vs P1.M3.T1.S1** (README): edits `README.md`. No overlap.
- **Gate dependency**: T2.S1's 11 no-fetch/harm cases REQUIRE S1's gate to PASS. If the orchestrator
  runs T2.S1 before S1, those 11 cases FAIL (expected — TDD). The orchestrator MUST land S1 first (or
  treat a T2.S1-before-S1 failure as "waiting on S1", not a T2.S1 bug).