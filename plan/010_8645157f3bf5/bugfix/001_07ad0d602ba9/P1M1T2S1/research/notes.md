# Research Notes — P1.M1.T2.S1 (BUG-001 regression tests: update COL-4 + no-fetch matrix + harm + bypass)

TEST-ONLY task. Touches **only `url-injection.test.mjs`** (714 lines, 21 cases → ~33 after).
Assumes S1's CODE_EXTENSIONS deny-list gate is LIVE in file-injector.ts (S1 is "Implementing",
runs before T2.S1). These tests are TDD regression guards: they PASS once S1 lands; they FAIL
(without the gate) which is the whole point.

## 1. The test harness (from test_analysis.md — AUTHORITATIVE)

- **Loader**: jiti from the GLOBAL pi package; `const mod = await jiti.import(TS_PATH)` (L76-77).
  `TS_PATH = path.resolve(SCRIPT_DIR, "file-injector.ts")`.
- **Runner**: `runCase(n, name, fn)` (L97) — try/await fn, PASS/FAIL row, `passed`/`failed` counters,
  `process.exit(failed>0?1:0)` at L715. NO test framework (zero-dep ESM).
- **Assert**: a top-level `assert(cond, msg)` (throws → caught → FAIL row).
- **Entry point**: `mod.injectFiles(text, [], FIX, false, enableUrls)` — returns
  `{ text, images, injected, paged, blocks, details }`.
- **FIX**: `const FIX = { cwd: TMPDIR }` (L122) — `TMPDIR = fsSync.mkdtempSync(...)`.
- **hasBlock**: `r.blocks.some((b) => b.includes(needle))` (L126).
- **origFetch**: captured ONCE at L132 → `const origFetch = globalThis.fetch;`. EVERY stub restores in `finally`.
- **makeRes({ct, body, status, ok, contentLength})** (L146): builds a Response-shaped object with a
  one-chunk `body.getReader()` (Buffer IS a Uint8Array), `.text()`, `.arrayBuffer()`.
- **RICH_HTML** (L180): a ~3 KB multi-paragraph HTML doc → defuddle extracts ≥200 chars (passes the SPA
  floor). DO NOT simplify (a trivial `<p>hi</p>` extracts <200 → SPA fallback fires instead of inject).

## 2. Section structure + case ids (current 21 cases)

- **DETECTION** (L243): DET-1 (`#example.com` → HTML inject), DET-2 (`#https://x.com/y` → inject).
- **DISPATCH** (L280): DIS-1 (text/plain), DIS-2 (json), DIS-3 (xml), DIS-4 (image/png bytes).
- **COLLISION** (L353): COL-1 (`#@file.txt` no fetch), COL-2 (prose no fetch), COL-3 (mid-word no fetch),
  **COL-4** (`#node.js` — L400-414), COL-5 (file+url shared budget, L416-428).
- **SCHEME-LESS NORMALIZATION** (L430): NORM-1.
- **FAILURE / GUARD** (L487): FAIL-1..FAIL-9.

**Insertion point for the new group**: AFTER COL-5's closing `});` (L427) and BEFORE the NORMALIZATION
header (L430, the `// ═══` line + `console.log("\nSCHEME-LESS NORMALIZATION")`). Text-disjoint from
everything else — a clean new block.

## 3. COL-4 — EXACT current code (L400-414, to be polished — NOT relocated)

```js
// COL-4 — #node.js IS url-shaped (alpha TLD 'js') → fetch IS called → 404 → verbatim (no block).
// This is the case that distinguishes "URL-shaped but unresolvable" from "not URL-shaped".
await runCase("COL-4", "collision: #node.js URL-shaped → 404 → verbatim (fetch CALLED, no block)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles("#node.js", [], FIX, false, true);
    assert(calls.length === 1, `#node.js IS url-shaped → fetch must be called; calls=${calls.length}`);
    assert(r.injected === 0, `404 → verbatim, no block; got injected===${r.injected}`);
    assert(!hasBlock(r, '<file name="https://node.js">'), "no block appended on 404");
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

**S1 ALREADY flips** COL-4's `calls.length === 1` → `=== 0` (S1 Task 5) to keep `npm test` green with
the gate. T2.S1 (this task) makes COL-4 match the final desired state: `calls===0` + `injected===0`
+ no block + **`r.text === "#node.js"` (verbatim)**, and updates the comment to reflect that `js` is
now rejected by the CODE_EXTENSIONS deny-list (not that it fails URL_SHAPE_RE). Because S1's flip may
or may not be present when T2.S1 runs, T2.S1 writes the FULL final COL-4 (idempotent — overwrite-in-place).

## 4. The dedup concern: S1's DENY-1 vs BUG1-1 (#main.go)

S1 adds a TDD anchor `DENY-1` asserting `#main.go` → `calls===0`. This task's matrix ALSO covers
`#main.go` (BUG1-1). Two cases for the same prompt is redundant (and `runCase` ids must stay unique —
DENY-1 ≠ BUG1-1 so no id collision, but the prompt repeats).
**Resolution (state in PRP)**: CONSOLIDATE — if `DENY-1` exists when T2.S1 runs, DELETE it and let
`BUG1-1` (`#main.go`) be the single canonical no-fetch-main.go case (BUG1-1 is a superset: asserts
calls===0 + injected===0 + `r.text === prompt` verbatim). If `DENY-1` does NOT exist (S1 ran
differently), BUG1-1 covers it. Either way: exactly ONE case asserts `#main.go` no-fetch.

## 5. The new regression group — exact cases

**Group header**: `console.log("\nBUG-001 REGRESSION: code-extension tokens must NOT fetch")`
placed in the L427→L430 gap. Each no-fetch case follows the per-test `calls`-spy + `try/finally`
restore pattern (test_analysis §5). The matrix:

| id | prompt | ext | (S1's CODE_EXTENSIONS contains all of these) |
|----|--------|-----|-----|
| BUG1-1 | `#main.go` | go | (consolidates S1's DENY-1 if present) |
| BUG1-2 | `#notes.md` | md | |
| BUG1-3 | `#config.json` | json | |
| BUG1-4 | `#image.png` | png | |
| BUG1-5 | `#script.py` | py | |
| BUG1-6 | `#utils.rs` | rs | |
| BUG1-7 | `#spec.tsx` | tsx | |
| BUG1-8 | `#app.cs` | cs | |
| BUG1-9 | `#lib.java` | java | |
| BUG1-10 | `#data.csv` | csv | |

Each asserts: `calls.length === 0`, `r.injected === 0`, `r.text === prompt` (verbatim). Stub fetch
to a SPY (`globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }`) so the
absence of egress is PROVEN, not assumed (test_analysis §10 rule 4: "absence of a stub proves nothing").

**BUG1-11 (content-injection-harm)**: `mod.injectFiles('refactor #main.go now', [], FIX, false, true)`
with fetch stubbed to `makeRes({ ct: "text/html", body: RICH_HTML, status: 200, ok: true })`. Assert
`r.injected === 0`, NO block contains `'https://main.go'`, AND `calls.length === 0`. This is the
STRONGEST regression guard: WITHOUT S1's gate, `#main.go` passes URL_SHAPE_RE → fetch IS called with
the 200 RICH_HTML stub → defuddle extracts the Go homepage → `injected===1` + block contains the
homepage → this test FAILS. WITH the gate: fetch never happens → injected===0 → PASSES. The RICH_HTML
stub is deliberately present to prove the harm is blocked EVEN when a successful rich response is
"waiting" — it documents the exact PRD-repro harm ("the Go homepage is delivered to the model").

**BUG1-12 (bypass — explicit scheme STILL fetches)**: sub-header
`console.log("\nBUG-001 BYPASS: explicit-scheme tokens still fetch (deny-list is scheme-less only)")`.
`mod.injectFiles('#https://node.js', [], FIX, false, true)` with fetch stubbed to
`makeRes({ status: 404, ok: false })`. Assert `calls.length === 1` (fetch IS called — explicit
`https://` scheme bypasses the CODE_EXTENSIONS deny-list, which only gates scheme-less tokens),
`r.injected === 0` (404 → verbatim), `r.text === '#https://node.js'`. This proves the deny-list's
scope is correct: scheme-less `#node.js` is blocked (COL-4/BUG1 group), but `#https://node.js` still
works (the user can force a URL by writing the scheme).

Total new cases: 12 (BUG1-1..BUG1-12). Matches the contract's "~12-14".

## 6. Validation gates

- **`npm test`** (the `test` script chains all 4 files; `url-injection.test.mjs` runs LAST). Exits 0 iff
  all pass. With S1's gate live, the new cases PASS. **Dependency**: these tests REQUIRE S1 to be landed;
  if run before S1, BUG1-1..BUG1-11 FAIL (correct TDD — they document required behavior).
- **`npm run typecheck`**: NOT affected (test files are `.mjs`, not typechecked). Confirm it stays green
  (S1's source edit is what typecheck exercises; T2.S1 adds no `.ts`).
- **Regression-guard sanity (optional)**: temporarily comment out S1's `continue`/gate line → re-run
  `node ./url-injection.test.mjs` → BUG1-1..BUG1-11 should FAIL (proving the tests actually guard the
  fix). Restore before committing.

## 7. Scope boundaries

- ONLY edits `url-injection.test.mjs`. Does NOT touch file-injector.ts (S1 owns the gate), README
  (P1.M3.T1.S1), BUG-002 notify tests (P1.M2.T2.S1), or the other 3 test files.
- Does NOT add new harness helpers (reuse makeRes/FIX/runCase/hasBlock/origFetch/RICH_HTML —
  test_analysis §"Two small test-local helpers (do NOT re-declare S1's makeRes/FIX/...)".
- Does NOT change the loader, the runner counters, or the exit logic.