---
name: "P1.M2.T1.S1 (plan 011) — Gates LINE-7 / LINE-9 / LINE-10: ADD the missing LINE-7 (§2.4 exact-path-wins); VERIFY the already-delivered LINE-9/LINE-10"
prd_ref: "Line-Range feature §2.4 (exact path wins — a literal 'a.ts:10' file resolves whole, no range), §3 (retry ladder), §8 edge rows ('Literal file a.ts:10 exists → Exact wins'), §9 acceptance table (LINE-7/LINE-9/LINE-10); architecture/system_context.md §5 (harness reality)"
target_file: "./file-injector.test.mjs"   # EDIT: +runCase("LINE-7") after LINE-6, before the // LINE-8 comment. VERIFY-ONLY on LINE-9/LINE-10 (already landed, green). NO .ts change.
target_language: JavaScript (.mjs; zero-dep harness; loads the REAL .ts via jiti + Pi's alias map); gate = `node ./file-injector.test.mjs`
depends_on: "LR-2 (P1.M1.T2.S1 — LANDED, shipped the LINE-9 gate) + LR-3 (P1.M1.T2.S2 — LANDED, shipped the LINE-10 gate). LINE-7 pins PRE-EXISTING §2.4 behavior (shipped with the original line-range feature) — no new dependency."
consumed_by: "P1.M2.T1.S2 (LINE-8/11/12 formalization — LINE-8/8-MD/12 already exist; S2 lands LINE-11 alongside the parallel LR-4), P1.M2.T1.S3 (full-suite green sweep: npm test ×4 + typecheck), P1.M2.T2.S1 (README)"
---

# PRP — P1.M2.T1.S1: Gates LINE-7 / LINE-9 / LINE-10 (resolution, image dedup, malformed notify)

> **Scope flag:** Test-only, and SMALLER than the item title suggests — **empirically discovered: LINE-9 and
> LINE-10 are ALREADY DELIVERED** (the LR-2/LR-3 implementation subtasks shipped their gates; both print ✓ in the
> current `177 passed, 0 failed` run, with coverage EXCEEDING the item's contract). **LINE-7 is the only gate this
> task must ADD** (§2.4 exact-path-wins; pins pre-existing behavior). So this PRP is: (1) ADD `runCase("LINE-7")`
> after LINE-6; (2) VERIFY (read-only) LINE-9/LINE-10 exist + pass + match the contract; (3) suite green. **No
> production-code changes** — if LINE-7 fails, the regression belongs to the engine (report back; do NOT weaken
> the test) — item §4 explicit. Do not duplicate/modify LINE-9/LINE-10.

---

## Goal

**Feature Goal:** Complete the LINE-7/9/10 regression-gate triplet from the Line-Range feature §9 acceptance
table: **add the missing LINE-7** — a literal file named `a.ts:10` in TMPDIR makes `#@a.ts:10` resolve via the
§3 ladder's step 1 (exact, suffix included) and deliver the WHOLE literal file with NO range
(`details[0].range === undefined`, body = the literal content) — and **verify the already-landed LINE-9**
(image/binary bare+ranged dedup, LR-2) **and LINE-10** (malformed-range warning notify, LR-3) are present,
green, and contract-complete.

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): one new `runCase("LINE-7", …)`
inserted after LINE-6's closing `});` and before the `// LINE-8` comment (~L3055). LINE-1…8/8-MD/9/10/12 and
everything else UNTOUCHED.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **`0 failed`**; the output contains `✓ case LINE-7`, `✓ case LINE-9`,
   `✓ case LINE-10` (LINE-9/10 already ✓ — they must remain so).
2. LINE-7 asserts the discriminating set: `injected === 1` (vs range-past-EOF → 0), the literal marker delivered,
   the block opens with the literal `a.ts:10` abs path, a.ts content NOT delivered, `blocks.length === 1`,
   `details[0].kind === "text"`, **`details[0].range === undefined`**, prompt verbatim.
3. LINE-9/LINE-10 are UNMODIFIED (byte-identical before/after this task).
4. `git diff --stat file-injector.ts` is EMPTY relative to the working tree at task start (test-only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` (part of `npm test`, 4 files). The
gates lock the line-range feature's resolution precedence, dedup identity, and failure feedback so they can never
silently regress.

**Use Case:** A future refactor of the range parser or claim keys runs the suite → LINE-7 catches an
exact-path-wins regression (a literal colon-digits file silently reinterpreted as a range); LINE-9 catches a
duplicate-bytes regression; LINE-10 catches a silent-vanish regression.

**Pain Points Addressed:** §9's table lists LINE-7…12 as REQUIRED once LR-1..5 land; LINE-7 pins §2.4 which had
NO gate at all (a regression in the retry ladder's step-1-wins precedence would be invisible today).

## Why

- **LINE-7 is the only ungated §2.4 behavior.** The retry ladder (§3) resolves the FULL token (suffix included)
  FIRST; only on failure is the suffix stripped + the range attached. The shared `a.ts` fixture (4 lines) makes
  the test sharply discriminating: with the literal `a.ts:10` present, correct code delivers the literal whole
  (`injected===1`, no range); broken code falls to the range interpretation → line 10 of a 4-line file →
  past-EOF → LR-4 → verbatim (`injected===0`). One number separates the outcomes.
- **LINE-9/LINE-10 verification closes the item honestly.** The item's "three new runCases" predates the
  discovery that LR-2/LR-3 shipped their own gates (both exceed the contract — both orders for image AND binary;
  three notify negatives including a literal `…:0` file). Re-adding them would duplicate; the right move is
  verify + retain.
- **Cheap, surgical, zero-risk to production.** One test case; no `.ts` change; LINE-1…6 untouched; placement
  chosen to avoid the parallel sibling's LINE-11 slot.

## What

No user-visible/API/logic change. The test file gains ONE runCase (LINE-7). Everything else is read-only
verification.

### Success Criteria

- [ ] `runCase("LINE-7", …)` exists, placed after LINE-6's closing `});` and before the `// LINE-8` comment.
- [ ] LINE-7 body: inline fixture `path.join(TMPDIR, "a.ts:10")` with a unique marker content; `finally` rmSync
      cleanup (mirroring LINE-10's `literal0.ts:0` pattern); `mod.injectFiles("See #@a.ts:10 here", [], FIX)`.
- [ ] LINE-7 asserts: `injected===1`; `hasBlock(r, "<marker>")`; `hasBlock(r, '<file name="' + lit + '">')`;
      `!hasBlock(r, "return a + b;")`; `r.blocks.length === 1`; `r.details[0].kind === "text"`;
      `r.details[0].range === undefined`; `r.text === "See #@a.ts:10 here"`.
- [ ] `node ./file-injector.test.mjs` → 0 failed; `✓ case LINE-7` + `✓ case LINE-9` + `✓ case LINE-10`.
- [ ] LINE-9 (L3112) and LINE-10 (L3137) are UNMODIFIED; LINE-1…6 UNTOUCHED; no other case changed.
- [ ] `git diff --stat file-injector.ts` EMPTY (test-only).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the empirical discovery (LINE-9/10 already landed + green at 177/0 — verified; LINE-7
absent — verified by grep + suite output), the exact LINE-7 test body (verbatim, with the discriminating
assertion set and the three-way discrimination proof), the placement landmarks (after LINE-6's `});` ~L3054,
before the `// LINE-8` comment ~L3055 — by identifier, not line number), the fixture mechanics (Linux `:`
filenames; inline write + finally rmSync; no collision with the shared `a.ts` because they are distinct names
and LINE-1…6 have already run sequentially), the contract→coverage mapping for LINE-9/LINE-10 (every element
verified present), and the single gate. The implementer inserts ONE test case, runs the suite, and confirms the
three ✓ lines.

### Documentation & References

```yaml
# MUST READ — the harness reality (runCase/FIX/hasBlock/spy pattern; a.ts is 4 lines; suite commands)
- file: plan/011_e473dac8178b/architecture/system_context.md
  why: "§5 'Test-harness reality (verified)' documents: runCase(id,desc,fn); mod.injectFiles(text,[],FIX) →
        {text,blocks,details,images,injected,…}; FIX={cwd:TMPDIR} (L363) → O-1 inline fallback; helpers assert /
        hasBlock (L202); the notify-spy ctx pattern (url-injection.test.mjs L703 — LINE-10 landed it inline);
        a.ts has 4 lines; npm test = 4 files + npm run typecheck. All empirically re-verified for this PRP."
  critical: "LINE-7 needs NO notify spy (happy path, FIX has no hasUI → the guarded notify never fires). Use FIX."

# MUST READ — the spec for the gate being added (§2.4 + §3 ladder + §8/§9 rows)
- file: PRD.md   # (the Line-Range feature — plan/011 delta_prd / prd_snapshot)
  why: "§2.4 'Exact path wins: resolution tries the full token including the suffix first… A file literally named
        a.ts:10 therefore resolves as-is, whole — no range.' §3 retry ladder (step 1 = exact, suffix included).
        §8 edge row 'Literal file a.ts:10 exists → Exact wins — whole literal file, no range.' §9 table 'LINE-7 |
        §2.4 | Literal a.ts:10 file → exact wins, no range.'"
  section: "Line-Range feature §2.4 + §3 + §8 + §9 (LINE-7/9/10 rows)"

# MUST READ — the landed gates this task verifies (do NOT duplicate or modify)
- file: plan/011_e473dac8178b/P1M1T2S1/PRP.md   # (LR-2 — shipped LINE-9)
- file: plan/011_e473dac8178b/P1M1T2S2/PRP.md   # (LR-3 — shipped LINE-10)
  why: "LR-2's subtask shipped the LINE-9 gate (image/binary bare+ranged dedup, both orders); LR-3's shipped
        LINE-10 (malformed-range warning + 3 negatives, including the literal '…:0' exact-wins negative). Both
        are LANDED and green (177/0). This task VERIFIES them — it must not re-add, move, or edit them."
  critical: "If a fresh checkout lacks them, re-adding per the contract is the fallback — but they ARE present
             in the working tree (verified at L3112/L3137, both ✓)."

# The file you edit (the ONLY change — insert ONE runCase)
- file: file-injector.test.mjs
  why: "LINE-1…6 at L2987-3054 (the pattern; LINE-6 ends with the `dup` dedup assert + `});` at ~L3054); the
        `// LINE-8 — LR-1…` comment starts ~L3055 (the insertion boundary). LINE-8/8-MD at L3060/3082; LINE-12 at
        L3091; LINE-9 at L3112; LINE-10 at L3137 (with the literal0.ts:0 inline-fixture + finally-rmSync pattern
        to mirror). Helpers: runCase L90ish, assert, hasBlock L202, FIX L363, A_TS L362 (a.ts = 4 lines; line 2
        is '  return a + b;' — usable as the not-delivered marker)."
  pattern: "Mirror LINE-10's inline-fixture discipline: write the colon-named file inside the case, try/finally
            rmSync it. Use FIX for the ctx (happy path, no spy needed). Assert on hasBlock + details[0] fields."
  gotcha: "PLACE BY IDENTIFIER: after the runCase(\"LINE-6\", …) block's closing `});` and BEFORE the `// LINE-8`
           comment — NOT after LINE-10 (the parallel sibling P1.M1.T2.S3 inserts LINE-11 there; colliding would
           force a messy merge). Line numbers drift; the identifiers don't."

# The engine contract (read-only — what LINE-7 pins)
- file: file-injector.ts
  why: "The §3 retry ladder lives in the token-resolution path: resolveImportPath(token) with the suffix INCLUDED
        is tried first (step 1); only on failure is the suffix parsed + the stripped path re-resolved (step 2).
        LINE-7 pins that step 1 wins when the literal colon-digits file exists. Do NOT edit the .ts — LINE-7
        pins PRE-EXISTING behavior; if it fails, the bug is an engine regression (report, don't paper over)."
  gotcha: "`git diff --stat file-injector.ts` MUST be empty relative to the working tree at task start."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← THE ONLY FILE EDITED (+runCase("LINE-7") after LINE-6, before // LINE-8; ~3.4k lines; 177 passed)
├── file-injector.ts          # UNCHANGED (LINE-7 pins pre-existing §2.4; the parallel sibling owns the .ts edits)
├── import-behavior.test.mjs / relative-imports.test.mjs / url-injection.test.mjs   # NOT edited
├── scripts/typecheck.mjs / package.json / PRD.md / README.md   # untouched (README is P1.M2.T2.S1)
└── plan/011_e473dac8178b/
    ├── architecture/{system_context.md, code_map.md, external_deps.md}
    ├── P1M1T1.S1..S3/{PRP.md, research/}   # LR-1/LR-5 (shipped LINE-8/8-MD/12)
    ├── P1M1T2.S1..S2/{PRP.md, research/}   # LR-2/LR-3 (shipped LINE-9/LINE-10 — the gates this task verifies)
    ├── P1M1T2S3/{PRP.md, research/}        # LR-4 (PARALLEL — inserts LINE-11 after LINE-10; no overlap)
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 runCase: runCase("LINE-7", "§2.4 exact-path-wins: literal 'a.ts:10'
                          #   file → #@a.ts:10 delivers the WHOLE literal file, no range", …)
                          #   inserted after LINE-6's closing `});`, before the `// LINE-8` comment.
# file-injector.ts is NEVER edited. LINE-9/LINE-10 are NEVER modified. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — LINE-9 and LINE-10 ALREADY EXIST (L3112/L3137) and pass in the current 177/0 run. This task does
//   NOT re-add them ("three new runCases" predates the discovery that LR-2/LR-3 shipped their gates). VERIFY
//   them (run + grep ✓) and leave them byte-identical. Duplicating = redundant cases + a merge mess.

// CRITICAL — LINE-7 placement: after LINE-6's closing `});`, BEFORE the `// LINE-8` comment (~L3055). NOT after
//   LINE-10 — the PARALLEL sibling (P1.M1.T2.S3) inserts LINE-11 there (~L3160). Place by IDENTIFIER.

// CRITICAL — the literal-fixture cleanup. Write `<TMPDIR>/a.ts:10` INSIDE the case and rmSync it in a `finally`
//   (mirror LINE-10's literal0.ts:0 pattern). Linux allows ':' in filenames (CI is Linux — the item's platform
//   note); `a.ts:10` is a DISTINCT filename from `a.ts` (no overwrite). LINE-1…6 run BEFORE LINE-7 (sequential
//   await runCase) so they are unaffected; no later case references `a.ts:10`.

// CRITICAL — the three-way discrimination (why the assertion set is complete):
//   (a) exact-wins CORRECT → literal delivered whole → injected===1 + marker present + range undefined.
//   (b) range interpretation (bug) → a.ts:10 = line 10 of a 4-line file → past-EOF → LR-4 verbatim → injected===0.
//   (c) whole-a.ts misfire (bug) → a.ts content delivered → hasBlock("return a + b;") would be TRUE.
//   So injected===1 + marker + !hasBlock("return a + b;") + blocks.length===1 + range===undefined separates all three.

// CRITICAL — do NOT paper over a LINE-7 failure. §2.4 is pre-existing implemented behavior; if the new gate
//   fails, the ENGINE regressed (likely the retry ladder's step-1-wins). Report back — do NOT weaken/skip the
//   test (item §4 explicit: "if a gate fails, the bug belongs to the dependency subtasks").

// GOTCHA — `details[0].range === undefined` is the §2.4 contract ("no range"). Use `=== undefined` (covers both
//   an absent key and an explicitly-undefined value). Also assert kind === "text" (whole-file text delivery).

// GOTCHA — no notify spy for LINE-7: happy-path delivery with FIX ({cwd:TMPDIR} — no hasUI, no ui) means the
//   hasUI-guarded notify never fires. The spy ctx is LINE-10's landed pattern (needed only for notify asserts).

// GOTCHA — suite count is a MOVING BASELINE: currently 177; +LINE-7 → 178; the parallel sibling's LINE-11 adds
//   another (+1, may land before or after this task). The ROBUST gate is `0 failed` + the three ✓ lines, never
//   a fixed N.

// LIBRARY — zero-dep .mjs; loads the real .ts via jiti from the GLOBAL pi package (npm root -g). runCase/assert/
// hasBlock/FIX all exist. The gate is `node ./file-injector.test.mjs` (npm test runs 4 files — S3's sweep).
```

## Implementation Blueprint

### The LINE-7 test (verbatim — insert after LINE-6's `});`, before the `// LINE-8` comment)

```js
// LINE-7 — §2.4 exact-path-wins (pins PRE-EXISTING behavior): the §3 retry ladder's STEP 1 resolves the FULL
// token (suffix included) first, so a file LITERALLY named 'a.ts:10' is delivered WHOLE — the suffix is never
// reinterpreted as a range. The shared a.ts fixture (4 lines) makes this discriminating: if the range
// interpretation wrongly ran, a.ts:10 = line 10 of a 4-line file → past-EOF → LR-4 → verbatim → injected:0.
// And a whole-a.ts misfire is excluded by the 'return a + b;' negative (a.ts line 2). Linux allows ':' in
// filenames (CI is Linux). Inline fixture + finally rmSync — mirrors LINE-10's literal0.ts:0 pattern.
await runCase("LINE-7", "§2.4 exact-path-wins: literal 'a.ts:10' file → #@a.ts:10 delivers the WHOLE literal file, no range", async () => {
  const lit = path.join(TMPDIR, "a.ts:10"); // distinct filename from a.ts — no collision, no overwrite
  fsSync.writeFileSync(lit, "LR7 literal colon file — line one\nLR7 line two\n");
  try {
    const r = await mod.injectFiles("See #@a.ts:10 here", [], FIX);
    assert(r.injected === 1, `the LITERAL a.ts:10 file resolves whole (exact wins), got injected=${r.injected}`);
    assert(hasBlock(r, "LR7 literal colon file — line one"), `the literal file's content is the body, got ${JSON.stringify(r.blocks)}`);
    assert(hasBlock(r, '<file name="' + lit + '">'), `the delivered block's name IS the literal ${lit} abs path`);
    assert(!hasBlock(r, "return a + b;"), `a.ts content must NOT be delivered (no range slice of a.ts, no whole-a.ts misfire)`);
    assert(r.blocks.length === 1, `exactly one block (the literal file), got ${r.blocks.length}`);
    assert(r.details?.[0]?.kind === "text", `kind 'text' (whole-file delivery), got '${r.details?.[0]?.kind}'`);
    assert(r.details?.[0]?.range === undefined, `NO range on a literal-file delivery (§2.4: resolves as-is, whole), got ${JSON.stringify(r.details?.[0]?.range)}`);
    assert(r.text === "See #@a.ts:10 here", `prompt verbatim (#@a.ts:10 untouched, §6.4), got ${JSON.stringify(r.text)}`);
  } finally {
    fsSync.rmSync(lit, { force: true }); // tidy + mid-case-throw safety (TMPDIR is per-run anyway)
  }
});
```

### Implementation Tasks (ordered)

```yaml
Task 1: ADD runCase("LINE-7") (the ONLY edit)
  - INSERT the body above, placed AFTER the runCase("LINE-6", …) block's closing `});` and BEFORE the
    `// LINE-8 — LR-1…` comment (~L3055). Place by IDENTIFIER (line numbers drift).
  - FIXTURE: inline writeFileSync of <TMPDIR>/a.ts:10 with the unique "LR7 literal colon file" marker; finally rmSync.
  - CTX: FIX (no spy — happy path; the hasUI-guarded notify never fires).
  - DO NOT touch: LINE-1…6, LINE-8/8-MD, LINE-9, LINE-10, LINE-12, any other case, helpers, fixtures.

Task 2: VERIFY the landed LINE-9 / LINE-10 (read-only — do NOT modify)
  - RUN: node ./file-injector.test.mjs 2>&1 | grep -E "LINE-(7|9|10)|Result:"
  - EXPECT: `✓ case LINE-7` (new) + `✓ case LINE-9` + `✓ case LINE-10` + `Result: N passed, 0 failed.`
    (N = 178 with only LINE-7 added; 179 if the parallel LINE-11 has landed. The gate is 0 failed + the ✓s.)
  - CROSS-CHECK (read-only) the contract mapping: LINE-9 covers image ONE-entry both orders + binary ONE-note
    both orders (L3112-3130); LINE-10 covers injected:0 / verbatim / warning notify with the range-rule message
    + 3 negatives (L3137-3160). Both already exceed the item's contract — nothing to add.

Task 3: VERIFY scope + no-regression
  - git diff --stat file-injector.ts → EMPTY relative to the working tree at task start (test-only).
  - git diff file-injector.test.mjs → the ONLY hunk is the inserted LINE-7 block (LINE-9/10 byte-identical).
  - (Belt-and-suspenders) npm run typecheck → 0 errors (no .ts change → trivially the pre-existing state).

Task 4: IF LINE-7 FAILS — report, do not paper over
  - §2.4 is pre-existing behavior; a failure means an engine regression (most likely the retry ladder's
    step-1-wins precedence). REPORT the failure with the assert message — do NOT weaken, skip, or re-order the
    test to make it pass (item §4: "the bug belongs to the dependency subtasks").
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - +runCase("LINE-7", …) between LINE-6's closing `});` and the `// LINE-8` comment (~L3055).
  - UNCHANGED: LINE-1…6, LINE-8/8-MD/12 (S2's territory), LINE-9 (LR-2's landed gate), LINE-10 (LR-3's landed
    gate), LINE-11's future slot (after LINE-10 — the parallel sibling's), all helpers/fixtures/cases.

NO_CHANGES: file-injector.ts (git diff empty), the 3 other .mjs suites, scripts/typecheck.mjs, package.json,
            PRD.md, README.md (P1.M2.T2.S1), all plan/ files. No new fixtures in buildFixtures (LINE-7's
            colon-file is inline + self-cleaning). No new helpers. No module-surface/guard edits (test-only add).
```

## Validation Loop

### Level 1: The gate — suite green + the three ✓

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "LINE-(7|9|10)|Result:"
# Expected:
#   ✓ case LINE-7: §2.4 exact-path-wins: literal 'a.ts:10' file → #@a.ts:10 delivers the WHOLE literal file, no range
#   ✓ case LINE-9: LR-2: #@pic.png #@pic.png:3 → ONE image (both orders); #@data.bin #@data.bin:5 → ONE note
#   ✓ case LINE-10: LR-3: #@a.ts:0 → injected:0, prompt verbatim, warning notify fired
#   Result: 178 passed, 0 failed.   (or 179 if the parallel LINE-11 has landed; the gate is 0 failed + the ✓s)
# If LINE-7 ✗ on `injected` (got 0) → the range interpretation ran (exact-wins regressed): an ENGINE bug — report.
# If LINE-7 ✗ on `range` (got ":10") → the literal resolved but a range was attached: an ENGINE bug — report.
```

### Level 2: LINE-9/LINE-10 unmodified (byte-identical)

```bash
cd /home/dustin/projects/pi-file-injector
# The test-file diff must contain EXACTLY ONE hunk (the inserted LINE-7 block):
git diff file-injector.test.mjs | grep -c "^+await runCase"        # expect 1 (only LINE-7's runCase line added)
git diff file-injector.test.mjs | grep -E "^[-+].*LINE-(9|10)"     # expect NO output (LINE-9/10 untouched)
```

### Level 3: No-regression (the 177 baseline stays green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "✗|Result:"
# Expected: NO ✗ lines; Result: N passed, 0 failed (N ≥ 178). Every pre-existing case (incl. LINE-1…6, which
# share the a.ts fixture) stays green — LINE-7's colon-file is written AFTER they run and removed in a finally.
```

### Level 4: Scope integrity

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts    # expect EMPTY (test-only; the .ts is the parallel sibling's territory)
git diff --stat                     # expect ONLY file-injector.test.mjs beyond the pre-existing working-tree state
npm run typecheck                   # belt-and-suspenders: 0 errors (no .ts change)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → 0 failed; `✓ case LINE-7` + `✓ case LINE-9` + `✓ case LINE-10`.
- [ ] `git diff --stat file-injector.ts` EMPTY (test-only).
- [ ] (Belt-and-suspenders) `npm run typecheck` → 0 errors.

### Feature Validation (the gates)

- [ ] LINE-7: literal `a.ts:10` file → `injected===1`; the literal marker IS the body; the block opens with the
      literal abs path; `!hasBlock("return a + b;")`; `blocks.length===1`; `details[0].kind==="text"`;
      **`details[0].range === undefined`**; prompt verbatim.
- [ ] LINE-9 (verified, landed): image bare+ranged → ONE `images` entry (both orders); binary twin → ONE note
      block (both orders).
- [ ] LINE-10 (verified, landed): `#@a.ts:0` → `injected:0`, verbatim, ONE warning notify with the range-rule
      message; negatives silent.

### Code Quality Validation

- [ ] LINE-7 mirrors the landed LINE pattern (runCase + assert msgs that quote the contract + §-cite comments).
- [ ] Inline fixture with unique marker + `finally` rmSync (LINE-10's literal0.ts:0 discipline); no buildFixtures
      change; no shared-fixture mutation.
- [ ] Placement by identifier (after LINE-6, before `// LINE-8`) — not after LINE-10 (the sibling's LINE-11 slot).
- [ ] No new helpers; no module-surface/guard edits; no `.ts` change.

### Documentation

- [ ] None (tests are self-documenting — item §5; the §-cite comments in the test body carry the Mode-A rationale).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT re-add or "improve" LINE-9/LINE-10.** They are LANDED (L3112/L3137), green, and exceed the contract
  (both orders for image AND binary; three notify negatives). Duplicate cases are noise; modifying them risks
  breaking a landed gate. Verify only.
- ❌ **Do NOT place LINE-7 after LINE-10.** The parallel sibling (P1.M1.T2.S3) inserts LINE-11 there. Place
  after LINE-6 / before the `// LINE-8` comment (numeric order, zero merge friction).
- ❌ **Do NOT paper over a LINE-7 failure.** §2.4 is pre-existing; a failure = an engine regression (the retry
  ladder's step-1-wins). Report with the assert message. Do NOT weaken/skip/re-order the test (item §4).
- ❌ **Do NOT forget the `finally` rmSync.** LINE-1…6 run before LINE-7 so they're safe either way, but the
  finally keeps the case self-cleaning + throw-safe (and mirrors LINE-10's landed discipline).
- ❌ **Do NOT add a notify spy to LINE-7.** It's a happy-path FIX case (no hasUI → the guarded notify never
  fires). The spy is LINE-10's pattern, needed only where notify is asserted.
- ❌ **Do NOT assert a fixed suite count.** The baseline moves (177 now; the parallel LINE-11 adds +1 whenever it
  lands). The gate is `0 failed` + the three ✓ lines.
- ❌ **Do NOT touch LINE-8/8-MD/12** (P1.M2.T1.S2's territory) or the shared buildFixtures (LINE-7's colon-file
  is inline + self-cleaning).
- ❌ **Do NOT edit file-injector.ts.** Test-only task. `git diff --stat file-injector.ts` MUST be empty.

---

## Confidence Score: 9/10

The task decomposed to ONE insertion (LINE-7) + a read-only verification of two already-landed gates — empirically
confirmed (LINE-9/10 ✓ in the current 177/0 run with contract-exceeding coverage; LINE-7 absent by grep + suite
output). The LINE-7 body is given verbatim with a three-way discrimination proof (exact-wins vs range-past-EOF vs
whole-a.ts misfire — separated by injected + marker + negative-marker + blocks.length + range-undefined), the
placement landmarks are identifier-based (after LINE-6 / before `// LINE-8`, avoiding the sibling's LINE-11 slot),
and the fixture mechanics mirror the landed LINE-10 inline+finally pattern (Linux `:` filenames; no collision with
the shared a.ts). The -1 reserves for the (unlikely) case LINE-7 exposes a genuine §2.4 regression — in which case
the correct action is reporting, not editing, per the item's explicit instruction — and for minor line-number
drift (mitigated by identifier-based placement). The implementing agent inserts ONE test case, runs one command,
and confirms three ✓ lines.