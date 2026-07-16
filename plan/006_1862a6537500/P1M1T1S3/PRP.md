---
name: "P1.M1.T1.S3 (plan/006) — Confirm the three §1 requirements are specifically exercised in the test suites"
prd_ref: "PRD §4.6 (h3.14 — 4-source config + depth-uniform bare-@), §4.5 (h3.13 — depth-uniform/no-cwd-fallback), §11 (h2.10/h3.23 — manual test matrix), §10 (h2.9 — edge cases). Bugfix/v006 context: arch/system_context.md maps each delta requirement → named test cases."
target_file: "(NONE expected — VERIFICATION subtask. Test files edited ONLY if a named case is genuinely missing or asserts the wrong thing; in that case add/fix the CASE, never weaken an assertion or delete one. file-injector.ts is edited ONLY if a re-run surfaces a real regression.)"
target_language: "JavaScript (Node ESM .mjs) zero-dep test harnesses that load the real ./file-injector.ts via Pi's jiti loader"
depends_on: "P1.M1.T1.S1 (green 182-test gate — Complete) and P1.M1.T1.S2 (clean tsc --strict gate — implemented in parallel; assume green). S3 CONSUMES their green state as its INPUT. S3 itself produces no code surface."
consumed_by: "NONE downstream. S3 is the final verification record for T1; its confirmation table is the artifact that closes P1.M1.T1."
---

# PRP — P1.M1.T1.S3: Confirm the three §1 requirements are specifically exercised in the test suites

> **Scope flag:** This is a **VERIFICATION subtask**, NOT new implementation. The v006 delta's three
> §1 requirement changes (A: 4-source config merge; B: depth-uniform markdown resolution with no cwd
> fallback; C: depth-uniform bare-@ matching) are **already implemented and green** (S1 confirmed
> 182/0). This subtask does NOT re-run the suites blindly — it confirms that the **specific named test
> cases** the delta PRD §2 maps to each requirement (A→T2.S1-e/-f/-g; B→A1/A7/A9/C1/C2; C→GROUP D +
> import-behavior GROUP 2/5) **(1) exist, (2) run, and (3) assert the *correct* behavior with
> non-weakened assertions**. The deliverable is a confirmation table. **Scope = S3 ONLY.**

---

## Goal

**Feature Goal:** For each of the three §1 delta requirements, locate its named test cases across
`file-injector.test.mjs`, `relative-imports.test.mjs`, and `import-behavior.test.mjs`, and confirm
every named case (a) exists, (b) runs green, and (c) asserts the **correct** behavior (positive
outcome **and** an explicit negative/bug-rejecting check — never a weakened or vacuous assertion).

**Deliverable:** A **confirmation table** mapping each §1 requirement → the test cases that exercise
it → pass/fail (per case + per requirement). If every named case is present and green, mark complete
with the table as the artifact. If any named case is missing or asserts the wrong/weakened thing,
**add or fix that case** (the one allowed code action) per the contract — never weaken or delete.

**Success Definition:**
1. Every named case in the case-map below is located (file:line) and confirmed to assert the
   requirement's specific behavior in **both directions** (the expected file/value IS chosen AND the
   wrong cwd-root/wrong-source copy is explicitly rejected), or — if a named case is missing — an
   equivalent case is **added** asserting the same two-direction property.
2. All three suites re-run green after any case additions/fixes: `122 + 38 + 22` (≥ these counts;
   additions may raise them).
3. The confirmation table is produced and every requirement row reads PASS.

## Why

- **A green total is necessary but not sufficient.** S1 proved 182 tests pass; S3 proves the right
  *named* tests specifically pin each of the three *new* §1 requirements. A suite can be green while
  the exact requirement-under-verification is only tangentially (or vacuously) exercised — this gate
  closes that gap by checking assertion *content*, not just pass/fail.
- **Guards against silent assertion rot.** The named cases encode the delta's regression intent
  (baseDir-wins-not-cwd, no-cwd-fallback, first-file-not-special-cased). Confirming their assertions
  are the strong two-direction form (not weakened to a vacuous truth) protects the requirement if
  `file-injector.ts` is later refactored.
- **Closes P1.M1.T1.** This is the final subtask of the verification task; its confirmation table is
  the record that the repo satisfies the delta's three §1 changes, completing T1.

## What

### The three requirements under confirmation (from the contract)

| Req | §1 requirement | Named test cases (per delta PRD §2 / contract) | What "correctly asserted" means |
|-----|----------------|------------------------------------------------|----------------------------------|
| **A** | 4-source config merge with trust gate (§4.6) | `file-injector.test.mjs` **T2.S1-e / -f / -g** | (e) settings.json `fileInjector` key **alone** enables the option (dedicated file emptied); (f) the **trust gate applies to the key** (untrusted → ignored/baseline, trusted → project value, and the two **differ**); (g) the **dedicated file overrides the settings.json key within a scope** |
| **B** | Depth-uniform markdown resolution, **no cwd fallback** (§4.5 rule 5) | `relative-imports.test.mjs` **A1 / A7 / A9 / C1 / C2** | (A1) baseDir copy wins over a same-named cwd copy AND the cwd copy is rejected; (A7) missing-in-baseDir → `null`, NO fallback to a same-named cwd file; (A9) resolution independent of `process.cwd()` (verified by `process.chdir`); (C1) nested import → file-relative copy wins, cwd copy has **zero** blocks; (C2) the user's exact deep path resolves in the importing file's dir, not cwd |
| **C** | Depth-uniform bare-@ (§4.6) | `relative-imports.test.mjs` **GROUP D** + `import-behavior.test.mjs` **GROUP 2 / GROUP 5** | bare-@ honored at the **first imported file** AND **across a chain** (no first-file asymmetry); **inert when the setting is off at every depth**; plus end-to-end via the REAL `input` handler with hermetic/live config |

### Success Criteria

- [ ] Confirmation table produced: each requirement → its named cases → per-case PASS/FAIL.
- [ ] Every named case in the case-map is present at a concrete file:line and asserts the correct
      two-direction behavior (or an equivalent case was ADDED — none weakened/deleted).
- [ ] All three suites green: `Result: 122 passed, 0 failed.` / `38 passed, 0 failed.` /
      `22 passed, 0 failed.` (post any fixes).
- [ ] No assertion was weakened or deleted (the contract forbids it).

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes** — the case-map below gives exact file:line locations, the literal case titles
to grep for, and the exact two-direction assertion each must contain. The validation commands are the
project's real `node ./…test.mjs` invocations. No external knowledge is required.

### Documentation & References

```yaml
# MUST READ — the requirement spec being confirmed against
- docfile: PRD.md
  why: §4.6 (4-source config + depth-uniform bare-@), §4.5 rule 5 (depth-uniform no-cwd-fallback),
       §11 manual matrix (#25–#32 are the bare-@ / relative cases), §10 edge rows (the config + bare-@ rows).
  critical: the named test cases encode these exact invariants; "correctly asserted" means the case
            checks BOTH the right outcome AND rejects the wrong one (e.g. cwd-root copy, ignored-untrusted key).

# MUST READ — the authoritative requirement→case mapping (from the bugfix research)
- file: plan/006_1862a6537500/architecture/system_context.md
  why: "The Three Delta Requirements (all ALREADY SATISFIED)" maps A→T2.S1-e/-f/-g, B→A1/A7/A9/C1/C2,
       C→GROUP D + import-behavior, with the file-injector.ts line ranges that implement each.
  pattern: use this as the cross-check that a named case's assertion matches the implemented invariant.

# MUST READ — the three test files under verification (load the real extension via jiti)
- file: file-injector.test.mjs
  why: requirement A lives here — the T2.S1 readConfig unit block (GROUP at :1957; settings.json cases at :2032–2101).
  pattern: `await runCase("T2.S1-e", "<title>", async () => { … assert … })`. Each case writes a PROJECT
           fixture under <TMPDIR>/.pi/ and removes it in a finally; the global ~/.pi/agent is the REAL user file.
  gotcha: T2.S1-e/-f/-g NEUTRALIZE the dedicated file (write `{}`) so the settings.json KEY is the only project
          source under test — do not "fix" this, it is the isolation design.

- file: relative-imports.test.mjs
  why: requirement B (GROUP A: resolveImportPath @ :93; GROUP C: injectFiles @ :249) + requirement C
       (GROUP D: first-level bare-@ @ :375). 38 cases via `await test("<ID>: <title>", async () => {…})`.
  pattern: every case builds a FRESH tmp tree with UNIQUE content markers (e.g. "B-FILE-RELATIVE" vs
           "B-CWD-ROOT") so the assertion can tell WHICH physical file was chosen. `run(cwd, prompt, bareAt=false)`.
  gotcha: A9 does `process.chdir(os.tmpdir())` inside try/finally — that chdir IS the test; do not remove it.

- file: import-behavior.test.mjs
  why: requirement C depth-0 / depth-1 bare-@ via the REAL input-handler path (GROUP 2 @ :89, GROUP 5 @ :192).
  pattern: `run(cwd, prompt, bareAt)` → `mod.injectFiles`; GROUP 5 captures the real handlers and drives
           session_start→input so `bareAt` is DERIVED from live config (catches config/depth wiring bugs a
           direct `injectFiles(..., true)` call would hide).
  gotcha: GROUP 5 relies on the dev's real ~/.pi/agent settings to set the key; the hermetic alternative is
          relative-imports D5/D6/D7 which write `.pi/file-injector.json` into a tmp repo.
```

### Current Codebase tree (verification target)

```bash
pi-file-injector/
├── file-injector.ts            # the extension (1114 lines) — INPUT, edited only on regression
├── file-injector.test.mjs      # 122 tests — Req A here (T2.S1-e/f/g)
├── relative-imports.test.mjs   #  38 tests — Req B (A1/A7/A9/C1/C2) + Req C (GROUP D)
├── import-behavior.test.mjs    #  22 tests — Req C (GROUP 2 / GROUP 5)
├── package.json                # "test": "node ./file-injector.test.mjs"
├── scripts/typecheck.mjs       # tsc --strict gate (S2's deliverable)
└── tsconfig.json
```

### Desired Codebase tree

```bash
# UNCHANGED unless a named case is missing/weakened. If so, the ONLY edits are to the relevant
# .test.mjs file (add the missing case or restore the strong assertion). No new files. file-injector.ts
# is touched only if the suite re-run reveals a genuine regression (then fix the function, not the test).
```

### Known Gotchas of our codebase & Library Quirks

```javascript
// CRITICAL: the test files use different case-naming conventions — do NOT assume a uniform "runCase".
//   file-injector.test.mjs     → `await runCase("<ID>", "<title>", async () => {…})`  (IDs like "T2.S1-e")
//   relative-imports.test.mjs  → `await test("<ID>: <title>", async () => {…})`        (IDs like "A1", "C2")
//   import-behavior.test.mjs   → `await test("<n><letter>: <title>", async () => {…})` (IDs like "2a", "5e")
// The contract's named IDs (A1/A7/A9/C1/C2, T2.S1-e/f/g) are LITERAL substrings of these case titles —
// grep for them directly (see Implementation Tasks Task 0).

// CRITICAL: "asserts the right thing" means TWO-DIRECTION. A strong case asserts BOTH:
//   (1) the CORRECT outcome is present  (e.g. `has(text,"B-FILE-RELATIVE")`)
//   (2) the WRONG outcome is ABSENT      (e.g. `!has(text,"B-CWD-ROOT")`, often with a "BUG:" message)
// A case that only checks (1) is WEAKENED. If you find one, restore the explicit negative check.

// GOTCHA: T2.S1-e/-f/-g read the REAL global ~/.pi/agent/sources at runtime. Their assertions are written
// to be robust to whatever the dev's real global value is (they compare against GLOBAL_BASELINE and use a
// "flip" = negation of baseline, then assert trusted≠untrusted). Do NOT hardcode `=== true`/`=== false`.

// GOTCHA: relative-imports A9 mutates process.cwd() — the test helper restores it in finally. This is
// intentional and load-bearing; if a case seems to depend on cwd, confirm it's the design (A9, C7).
```

---

## Implementation Blueprint

There are no data models or new modules. The "implementation" is a **verification pass** that may
result in a small test-file edit. The ordered tasks below are the verification procedure.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 0: LOCATE every named case (read-only, do this first for the whole table)
  - GREP, in each file, for the literal named IDs:
      file-injector.test.mjs:     grep -nE 'T2\.S1-[efgh]' file-injector.test.mjs
      relative-imports.test.mjs:  grep -nE 'test("(A1|A7|A9|C1|C2|D[1-7]):' relative-imports.test.mjs
      import-behavior.test.mjs:   grep -nE 'test("(2[abc]|5[abcdef]):' import-behavior.test.mjs
  - EXPECT (current repo): every named ID present (see research_notes.md for the exact file:line map).
    Record each located file:line. If ANY named ID is absent → go to that requirement's Task and ADD it.

Task 1: VERIFY Requirement A — 4-source config (file-injector.test.mjs T2.S1-e/-f/-g)
  - CONFIRM T2.S1-e (:2045) asserts: with the dedicated project file emptied (`{}`), a project
    settings.json `{"fileInjector":{"markdownBareAtImports":true}}` + trusted → result is `true`
    (the KEY alone enables it). REQUIRED assertion: `r.markdownBareAtImports === true`.
  - CONFIRM T2.S1-f (:2063) asserts the TRUST GATE on the settings.json key: untrusted →
    `=== GLOBAL_BASELINE` (ignored), trusted → the negation "flip", AND the two `!==` (proves the
    gate regardless of the real global env). REQUIRED: all three sub-asserts present.
  - CONFIRM T2.S1-g (:2086) asserts PRECEDENCE: dedicated file `false` + settings key `true` →
    result `false` (dedicated wins within a scope). REQUIRED: `r.markdownBareAtImports === false`.
  - IF any of e/f/g is missing or weakened (e.g. no negative check, hardcoded bool): RESTORE the
    two-direction assertion per the table above. Do NOT weaken sibling cases T2.S1-a..-d/-h.
  - FOLLOW pattern: the surrounding T2.S1 block (helper `writeSettings`, PROJECT fixture under
    <TMPDIR>/.pi/settings.json, `finally` cleanup). NAMING: `runCase("T2.S1-<x>", "<title>", fn)`.

Task 2: VERIFY Requirement B — depth-uniform, no-cwd-fallback (relative-imports.test.mjs A1/A7/A9/C1/C2)
  - CONFIRM A1 (:99) asserts baseDir copy wins AND cwd-root copy rejected: `r === .../nested/x.md`
    plus `!has(r,"ROOT")` (the case's message names the cwd bug).
  - CONFIRM A7 (:147) asserts missing-in-baseDir → `null` with a same-named cwd-root file present:
    `r === null` despite `ghost.md` existing at root.
  - CONFIRM A9 (:161) asserts process.cwd-independence: `process.chdir(os.tmpdir())` inside try/finally,
    result identical from the unrelated cwd.
  - CONFIRM C1 (:255) asserts file-relative wins, cwd copy has ZERO blocks: `has(text,"B-FILE-RELATIVE")`
    AND `!has(text,"B-CWD-ROOT")` AND `countAbs(.../b.md) === 0`.
  - CONFIRM C2 (:266) asserts the user's exact deep path resolves in the importing file's dir, not cwd:
    `has(text,"FILE2-CORRECT")` AND `!has(text,"FILE2-WRONG-CWD")`.
  - IF any is missing/weakened: ADD/RESTORE with UNIQUE content markers (e.g. CORRECT vs WRONG-CWD) so
    the assertion can tell which physical file was chosen — this is the file's established convention.
  - FOLLOW pattern: `test("<ID>: <title>", async () => {…})`, `newRoot()` + `mk(root, relpath, content)`.

Task 3: VERIFY Requirement C — depth-uniform bare-@ (relative-imports GROUP D + import-behavior GROUP 2/5)
  - CONFIRM "honored at the FIRST imported file": relative-imports D1 (:382, full chain),
    D5 (:435, REAL handler, hermetic config ON); import-behavior 2b (:101, "FIRST imported file must
    NOT require #@"), 5a/5b/5c/5d (:200/:208/:217/:224, depth-0 bare-@ via injectFiles AND real handler).
  - CONFIRM "honored ACROSS a chain (no first-file asymmetry)": relative-imports D2 (:396, @→@→@),
    D6 (:448, notify counts every file); import-behavior 2a (:91), 5e (:231, depth-0 AND depth-1 BOTH).
  - CONFIRM "inert when OFF at every depth": relative-imports D4 (:416), D7 (:464, REAL handler OFF);
    import-behavior 2c (:110), 5f (:241, OFF → inert depth-0 AND depth-1).
  - REQUIRED for each: positive (right markers/chain present) AND negative (wrong markers absent, or
    `injected === 1` / notify-string exact when OFF). D6's assertion is the literal `notified === "#@ injected 4 whole"`.
  - IF any is missing/weakened: ADD/RESTORE per the table. The depth-asymmetry property MUST be pinned
    by at least one case asserting depth-0 AND depth-1 together (D2 / 5e) — do not let both lapse.

Task 4: RE-RUN all three suites green (after any Task 1–3 edits)
  - RUN: node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs
  - EXPECT: "122 passed, 0 failed." / "38 passed, 0 failed." / "22 passed, 0 failed." (counts ≥ these
    if cases were added). If a REAL regression surfaced (a previously-green case now red), that is the
    ONE trigger to edit file-injector.ts: fix the offending function, do NOT weaken the test.
  - THEN also: npm run typecheck  (S2's gate — confirm still 0 errors if file-injector.ts was touched).

Task 5: PRODUCE the confirmation table (the deliverable)
  - FORMAT: a markdown table — one row per NAMED CASE — columns:
      Req | Case ID | File:line | Behavior asserted (1 line) | Result (PASS/FAIL)
    plus a summary row per requirement (A/B/C → PASS when all its cases PASS).
  - CONTENT: fill from Tasks 1–3 (every named case: T2.S1-e/f/g; A1/A7/A9/C1/C2; D1/D2/D4/D5/D6/D7;
    2a/2b/2c; 5a–5f). If all PASS, mark the subtask complete. Record any added/restored cases explicitly.
```

### Implementation Patterns & Key Details

```javascript
// Strong (two-direction) assertion pattern — this is what "correctly asserted" means. If a located
// case lacks the explicit-negative half, RESTORE it (never delete). Examples from the current suite:

// Req B — file-relative wins, cwd copy explicitly rejected (relative-imports C1, :255)
assert(has(out.text, "B-FILE-RELATIVE"), `expected dir/b.md (file-relative); ... injected=${out.injected}`);
assert(!has(out.text, "B-CWD-ROOT"), "BUG: resolved the cwd-root copy — that is cwd resolution, NOT file-relative");
assert(countAbs(out.text, path.join(root, "b.md")) === 0, "cwd-root b.md must have ZERO blocks");

// Req A — trust gate on the settings.json key: both directions + they differ (file-injector T2.S1-f, :2063)
assert(untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports, `untrusted → baseline, got ${…}`);
assert(trusted.markdownBareAtImports === flip, `trusted → project value, got ${…}`);
assert(trusted.markdownBareAtImports !== untrusted.markdownBareAtImports, `trust gate: must differ`);

// Req C — no first-file asymmetry: depth-0 AND depth-1 bare-@ BOTH honored (import-behavior 5e, :231)
assert(has(o,"B-MARKER") && has(o,"C-MARKER"),
  `depth-0 and depth-1 bare-@ must BOTH work — no first-file special-casing`);
// And the OFF regression guard (import-behavior 5f, :241) — inert at BOTH depths
assert(!has(o,"B-MARKER") && !has(o,"C-MARKER"), `setting OFF → bare-@ inert everywhere`);

// ANTI-PATTERN (weakened — reject if found): only the positive half, e.g.
//   assert(has(out.text, "B-FILE-RELATIVE"));   // ← vacuously passes even on a cwd leak; add the !has check
```

### Integration Points

```yaml
TEST HARNESS (no DB/config/routes — this is a verification subtask):
  - files under verification: file-injector.test.mjs, relative-imports.test.mjs, import-behavior.test.mjs
  - run via: `node ./<file>.test.mjs` (zero-dep; load the real ./file-injector.ts via Pi's jiti loader,
    resolved from the GLOBAL pi package at `npm root -g`/`@earendil-works/pi-coding-agent`).
  - cross-gate: if file-injector.ts is touched (regression fix only), re-run S2's `npm run typecheck`.
NO PRD.md / tasks.json / prd_snapshot.md edits — those are owned by humans/the orchestrator.
```

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# .mjs files are plain Node ESM (no build step). After any test-file edit, node --check it:
node --check ./file-injector.test.mjs
node --check ./relative-imports.test.mjs
node --check ./import-behavior.test.mjs
# Expected: no output, exit 0. (No linter is configured for this repo.)
```

### Level 2: Unit / Suite Re-run (Component Validation)

```bash
# The three suites — the heart of this subtask. Run each; assert the exact "Result:" line.
node ./file-injector.test.mjs        | tail -4   # expect: Result: 122 passed, 0 failed.
node ./relative-imports.test.mjs     | tail -4   # expect: Result: 38 passed, 0 failed.
node ./import-behavior.test.mjs      | tail -4   # expect: Result: 22 passed, 0 failed.

# Or chained (project's own test script runs only file-injector.test.mjs — run all three explicitly):
node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs
# Expected: all three "0 failed", combined ≥ 182 passed. Counts may rise if cases were added.
```

### Level 3: Cross-Gate (only if file-injector.ts was touched)

```bash
# Only relevant if Task 4 surfaced a real regression that required editing file-injector.ts.
npm run typecheck          # == node ./scripts/typecheck.mjs → tsc --strict, expect "0 errors", exit 0
# Expected: green typecheck AND all three suites still green (a fix must not regress the 182-total).
```

### Level 4: Domain-Specific Validation — the confirmation table

```bash
# This subtask's bespoke gate: the confirmation table itself. After Tasks 1–3, the table must show
# every named case PASS. The named IDs to account for (grep each to confirm it ran, not just exists):
#   Req A: T2.S1-e  T2.S1-f  T2.S1-g
#   Req B: A1  A7  A9  C1  C2
#   Req C: D1 D2 D4 D5 D6 D7  |  2a 2b 2c  |  5a 5b 5c 5d 5e 5f
# A passing suite run already exercised every one of these (they are in the 122/38/22). The table is
# the curated record mapping requirement → case → the SPECIFIC behavior asserted → PASS/FAIL.
```

## Final Validation Checklist

### Technical Validation

- [ ] Level 1: `node --check` clean on any edited `.mjs` file.
- [ ] Level 2: all three suites green — `122 / 38 / 22` passed, `0 failed` (≥ if cases added).
- [ ] Level 3 (only if file-injector.ts touched): `npm run typecheck` → `0 errors`; suites re-green.

### Feature (Verification) Validation

- [ ] Confirmation table produced with one row per named case (T2.S1-e/f/g; A1/A7/A9/C1/C2; D1/D2/D4/D5/D6/D7; 2a/2b/2c; 5a–5f).
- [ ] Each requirement row (A/B/C) PASS — every named case present, runs, asserts the correct two-direction behavior.
- [ ] Any added/restored case uses UNIQUE content markers + an explicit negative/bug-rejecting assertion.
- [ ] No assertion weakened or deleted (contract forbids it).

### Code Quality Validation

- [ ] Any test-file edit follows the file's existing convention (`runCase` in file-injector.test.mjs; `test("ID: …")` in the other two; `newRoot()`/`mk()` fixtures; `finally` cleanup).
- [ ] No edits outside the three `.test.mjs` files (and file-injector.ts only on a confirmed regression).
- [ ] PRD.md / tasks.json / prd_snapshot.md untouched (owned by humans/orchestrator).

---

## Anti-Patterns to Avoid

- ❌ Don't trust a green total alone — this subtask exists precisely to confirm the *named* cases assert the *specific* requirement (not just that something passed).
- ❌ Don't weaken or delete a failing/awkward assertion to force green — the contract explicitly forbids it; fix the test to be the strong two-direction form, or (on a real code regression) fix the function in file-injector.ts.
- ❌ Don't assume a uniform case-naming convention — file-injector.test.mjs uses `runCase`, the other two use `test`; grep the literal IDs.
- ❌ Don't hardcode `=== true`/`=== false` in config cases (T2.S1-f) — they are written to be robust to the dev's real global value (compare against GLOBAL_BASELINE + a "flip" negation + trusted≠untrusted).
- ❌ Don't edit PRD.md, tasks.json, prd_snapshot.md, or `.gitignore` — out of scope and forbidden.
- ❌ Don't add cases for unrelated requirements — only fill gaps in the named set above.
