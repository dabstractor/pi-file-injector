---
name: "P1.M2.T1.S3 (plan 011) — Full-suite green sweep: npm test (4 files) + npm run typecheck — VERIFICATION-FIRST (all 279 cases + typecheck observed GREEN at HEAD e5448b3); contingency fixes ONLY within the LR changed seams"
prd_ref: "Line-Range feature §9 (acceptance table LINE-1…LINE-12), §10 (requirement & gap register — LR-1…LR-5 closure is this sweep's done-definition); architecture/system_context.md §5 (the verified commands: npm test = 4 .mjs files, npm run typecheck = node ./scripts/typecheck.mjs)"
target_file: "(no file is expected to change — verification-first. IF fallout: fixes land in ./file-injector.ts changed seams ONLY, or ./file-injector.test.mjs new-gate territory ONLY)"
target_language: "JavaScript/TypeScript; gates = `npm test` (&&-chained 4 files, exit 0) + `npm run typecheck` (tsc 5.6 --strict vs global pi .d.ts, exit 0)"
depends_on: "ALL landed: P1.M1.T1.S1–S3 (LR-1 f2d33dc / LR-5 a5d0f5f / unify d954487), P1.M1.T2.S1–S3 (LR-2 cec5f1d / LR-3 6b136f5 / LR-4 2e56a86), P1.M2.T1.S1 (LINE-7 gate 9b18634), P1.M2.T1.S2 (LINE-8b gate e5448b3 — parallel contract; its commit is in HEAD)"
consumed_by: "P1.M2.T2.S1 (README line-range sync — runs after this sweep confirms the behavior is final-green); CI (validate.sh Phase 1 parity with npm run typecheck)"
---

# PRP — P1.M2.T1.S3: Full-suite green sweep (`npm test` ×4 + `npm run typecheck`)

> **Scope flag:** VERIFICATION-FIRST — and smaller than the title suggests. **Empirically discovered: the
> entire suite is ALREADY GREEN at HEAD e5448b3**: `npm test` = file-injector **180/0** + import-behavior
> **23/0** + relative-imports **38/0** + url-injection **38/0** (279 cases, 0 failed, exit 0), and
> `npm run typecheck` = **0 errors under --strict** (exit 0). All 14 LINE gates ✓ (LINE-1…12, LINE-8-MD,
> LINE-8b). So this task's real work is: (1) RUN both gates on the current tree; (2) CONFIRM the
> done-definition (LR-1…LR-5 closed per feature §10; LINE-1…12 all pass; no drift in the three guard
> suites); (3) DELIVER the one-paragraph summary (expected: "nothing adjusted"). The fix-fallout logic is a
> **CONTINGENCY** that fires only if the tree at sweep time differs from the observed state (e.g. a sibling
> commit shifted something) — and then fixes are bounded to the LR changed seams, NEVER the guarded
> URL/import/relative features. No README (P1.M2.T2.S1), no plan/ edits.

---

## Goal

**Feature Goal:** Certify the Line-Range Gap Closure changeset end-to-end: run the FULL suite
(`npm test` — all four .mjs files, not just file-injector) plus `npm run typecheck`, confirm every clause
of the done-definition — LR-1…LR-5 closed by their gates, LINE-1…LINE-12 (plus LINE-8-MD/LINE-8b) all
passing, zero drift in the import-behavior/relative-imports/url-injection guard suites — and fix any
fallout strictly within the seams the LR changes touched.

**Deliverable:** (a) A green `npm test` run (exit 0; four `Result:` lines, all `0 failed`) and a green
`npm run typecheck` (exit 0; "0 errors" line); (b) a **one-paragraph summary** of anything adjusted during
the sweep (expected: nothing — the observed tree is already fully green); (c) IF (and only if) fallout was
found: minimal seam-bounded fixes in `file-injector.ts` / `file-injector.test.mjs`.

**Success Definition:**
1. `npm test` exits 0 with four green `Result:` lines (observed baseline: 180 / 23 / 38 / 38 — all
   `0 failed`; robust form: every suite `0 failed`, never a fixed N).
2. `npm run typecheck` exits 0 with "type-checks clean under --strict (0 errors)".
3. `grep "✓ case LINE"` shows **14 lines** — LINE-1, 2, 3, 4, 5, 6, 7, 8, 8-MD, 8b, 9, 10, 11, 12.
4. LR→gate closure confirmed: LR-1→LINE-8/8-MD/8b · LR-2→LINE-9 · LR-3→LINE-10 · LR-4→LINE-11 · LR-5→LINE-12.
5. The three guard suites (import-behavior, relative-imports, url-injection) each report `0 failed` —
   no drift in shipped behavior (URL deny-list, dispatch, spinner untouched).
6. The summary paragraph exists; if no fallout, `git status` shows NO new modifications to source/test
   files (plan/tasks.json is orchestrator-owned and pre-modified — ignore it).

## User Persona

**Target User:** The developer/CI gate-keeping the changeset before the README/docs sync (P1.M2.T2.S1) and
release. `npm test` + `npm run typecheck` are the package's two CI-parity commands (typecheck mirrors
validate.sh Phase 1).

**Use Case:** After every LR subtask and both gate subtasks land, run the two commands once, together, as
the final gate: full suite green means the changeset did not regress ANY shipped behavior while closing
LR-1…LR-5.

**Pain Points Addressed:** Individual subtasks ran only `node ./file-injector.test.mjs` (their local gate).
Nothing yet certified the OTHER three suites (URL deny-list/dispatch/spinner; import resolution semantics)
against the accumulated engine changes — scanTokens/cleanToken are SHARED machinery the LR work modified.
This sweep is that certificate.

## Why

- **The done-definition is cross-suite, not single-suite.** LR-1..5 changed shared engine paths
  (`scanTokens`, `cleanToken`, `processTokenStream`, `injectFile`, `emitText`). The URL suite guards
  "ranges never run on URL tokens" (feature §1 out-of-scope) and the whole URL pipeline; the import/relative
  suites guard markdown resolution. Only a full `npm test` proves no leak.
- **Cheap now, expensive later.** The sweep is two commands (~30s). If drift exists, catching it BEFORE the
  README sync (P1.M2.T2.S1) keeps the docs task honest; catching it after means re-syncing docs.
- **All-green is the EXPECTED outcome.** Observed at HEAD e5448b3: 279/0 + typecheck clean. The PRP's
  contingency playbook exists so that IF the tree moved, fixes stay bounded — not because red is expected.

## What

No user-visible/API/logic change is intended. The deliverable is the green runs + the summary paragraph.
Contingent edits (if any) are minimal, seam-bounded, and behavior-preserving.

### Success Criteria

- [ ] `npm test` → exit 0; four `Result:` lines all showing `0 failed` (baseline counts 180/23/38/38).
- [ ] `npm run typecheck` → exit 0; final line "…type-checks clean under --strict (0 errors)".
- [ ] `node ./file-injector.test.mjs 2>&1 | grep "✓ case LINE"` → 14 ✓ lines (1,2,3,4,5,6,7,8,8-MD,8b,9,10,11,12).
- [ ] LR-1…LR-5 each confirmed closed by its gate(s) (mapping above).
- [ ] Zero drift in import-behavior / relative-imports / url-injection (each `0 failed`).
- [ ] The one-paragraph sweep summary is produced (expected content: nothing adjusted; the observed numbers).
- [ ] If (and only if) fallout occurred: fixes confined to the changed seams; `git diff` shows no edits to
      the guard suites' assertions, the URL feature surface, README, PRD.md, or plan/.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the two exact commands and their verified expected output (observed at HEAD
e5448b3 — four Result lines with counts, the typecheck success line, exit codes), the LR→gate closure
mapping that constitutes the done-definition, the complete changed-seams map (every diff hunk of
`git diff 5c1434e HEAD -- file-injector.ts`, with function names — this bounds where contingency fixes may
land), the do-not-regress rules (the three guard suites and their guarded features), the failure-routing
playbook (which red case means which seam), and the robust-gate principle (`0 failed` + exit 0 + 14 LINE ✓
lines — never fixed N, because the count is a moving baseline). The implementer runs two commands, greps
three things, and writes one paragraph — or follows the contingency playbook.

### Documentation & References

```yaml
# MUST READ — the verified commands + harness reality (PAGED_FIX, notify spy, fixture semantics)
- file: plan/011_e473dac8178b/architecture/system_context.md
  why: "§5 'Test-harness reality (verified)' documents BOTH commands verbatim: npm test = the 4-file
        &&-chain; npm run typecheck = node ./scripts/typecheck.mjs. Also FIX/PAGED_FIX/TINY_FIX budget
        fixtures and the notify-spy pattern the LINE-10/11 gates use — context for reading any failure."
  critical: "The &&-chain short-circuits: exit 0 means ALL FOUR suites ran green; a non-zero exit with
             no later-suite output means an earlier file failed first."

# MUST READ — the feature acceptance table + gap register (the done-definition source)
- file: PRD.md   # (the Line-Range feature — plan/011's delta)
  why: "§9: the LINE-1…LINE-12 acceptance rows (what each gate asserts). §10: the LR-1…LR-7 register —
        LR-1..5 were 'Gap' at spec time; this sweep CERTIFIES they are now closed (each via its gate).
        §1 out-of-scope: ranges never run on URL tokens — what url-injection.test.mjs guards."
  section: "Line-Range feature §9 + §10 (+ §1 out-of-scope list)"

# MUST READ — the sibling contracts (what produces the tree this sweep certifies)
- file: plan/011_e473dac8178b/P1M2T1S1/PRP.md   # (LANDED 9b18634 — LINE-7 gate)
- file: plan/011_e473dac8178b/P1M2T1S2/PRP.md   # (LANDED e5448b3 — LINE-8b gate; its Level-1/3 validation = the 180/0 baseline)
  why: "S2's PRP is the immediate predecessor: its success state (file-injector 180 passed, 0 failed,
        five ✓ lines incl. LINE-8b) is this sweep's file-injector starting point. S1 added LINE-7
        (the 180th case includes it). Both must remain byte-identical unless a gate is BROKEN."
  critical: "The observed baseline (279 total / 0 failed) ALREADY INCLUDES both siblings' gates. Do NOT
             re-add, modify, or 'improve' any landed gate."

# The gates this sweep runs (read-only; the 4 suites + the typecheck wrapper)
- file: package.json
  why: "scripts.test (the 4-file &&-chain) and scripts.typecheck — the exact command definitions. Also
        scripts.prepublishOnly = npm run typecheck (CI/release parity)."
- file: scripts/typecheck.mjs
  why: "The wrapper: resolves the GLOBAL pi package via npm root -g, writes a temp tsconfig with paths
        mappings for pi/pi-ai/pi-tui .d.ts, runs npx -p typescript@5.6 tsc --listFiles. Read it before
        debugging any typecheck failure — a failure may be an environment/path issue (e.g. pi not
        installed globally → the script's own error message), NOT a type error in file-injector.ts."
  gotcha: "Environment failure (npm root -g fails / .d.ts missing) prints the script's own console.error
           and exits 1 — distinct from a tsc type error. Diagnose which before touching any .ts."

# The engine seams (read-only reference for the contingency playbook)
- file: file-injector.ts
  why: "The changed functions (see the seam map in the Blueprint): cleanToken L~168, sliceLines L~188-209,
        FileDetail L~548, scanTokens L~1160+, processTokenStream L~1229+, injectFile L~1309-1452,
        emitText L~1464-1505. If (and only if) a gate fails, the fix belongs inside one of these."
  gotcha: "The observed tree type-checks clean and passes 279/0. Any edit MUST end with BOTH gates green —
           an edit that fixes one suite and breaks another is a net regression."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD e5448b3; working tree clean except plan/011_e473dac8178b/tasks.json (orchestrator-owned)
├── file-injector.test.mjs       # 180 cases green (LINE-1..12 + 8-MD + 8b included) — guard it stays 0 failed
├── file-injector.ts             # the engine (LR-1..5 landed; typechecks clean) — seam-bounded fixes ONLY if fallout
├── import-behavior.test.mjs     # guard suite #1 — 23/0 (markdown import semantics)
├── relative-imports.test.mjs    # guard suite #2 — 38/0 (file-relative vs cwd-relative resolution)
├── url-injection.test.mjs       # guard suite #3 — 38/0 (URL deny-list, dispatch, spinner — NEVER edit to pass)
├── scripts/typecheck.mjs        # the typecheck wrapper (global-pi tsconfig; tsc 5.6 --strict)
├── package.json                 # scripts.test = the 4-file &&-chain; scripts.typecheck
└── plan/011_e473dac8178b/…      # PRP/research history + tasks.json (DO NOT TOUCH)
```

### Desired Codebase tree (files touched)

```bash
# EXPECTED (all-green case): NO source/test file changes. The deliverable is the runs + the summary paragraph.
# CONTINGENCY (fallout found): minimal edits confined to —
file-injector.ts            # only inside the changed seams (see the seam map)
file-injector.test.mjs      # only the new-gate territory (LINE-7..12/8-MD/8b) — and only to fix a BROKEN
                            # gate's own bug, never to weaken an assertion
# NEVER: the 3 guard suites' assertions, URL feature surface (deny-list/dispatch/spinner), README, PRD, plan/
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — VERIFICATION-FIRST. At HEAD e5448b3 the ENTIRE suite is green: npm test = 180/23/38/38
//   (all "0 failed", exit 0) and typecheck = 0 errors. The overwhelmingly likely outcome is: run, confirm,
//   write the summary, DONE — zero code changes. Do NOT "improve" anything that is green.

// CRITICAL — suite counts are a MOVING BASELINE. 180/23/38/38 is what I observed; if the sibling S2 commit
//   settles slightly differently, counts may shift by ±1. The ROBUST gate is: every suite "0 failed",
//   exit 0, and 14 "✓ case LINE" lines (1,2,3,4,5,6,7,8,8-MD,8b,9,10,11,12). Never assert a fixed N.

// CRITICAL — the &&-chain short-circuits. `npm test` exit 0 = all four files ran green. A non-zero exit
//   where you only see 1-2 "Result:" lines means an EARLIER file failed — read the first ✗/failure block.

// CRITICAL — contingency fixes are SEAM-BOUNDED. The LR changeset touched ONLY: cleanToken, sliceLines,
//   FileDetail (interface fields), scanTokens, processTokenStream, injectFile (claims/notifies),
//   emitText (range branch + unified quadruple), plus the new LINE gates. A red case anywhere maps to one
//   of those (see the routing table). Fixing outside them = scope creep; editing a guard suite's
//   assertions to pass = FORBIDDEN (it would convert the do-not-regress certificate into a lie).

// CRITICAL — the three guard suites protect SHIPPED behavior. url-injection.test.mjs guards the URL
//   deny-list, content-type dispatch, cap/timeout→verbatim, SPA fallback, spinner — "awareness only,
//   never edit those features to make a test pass" (item §1). import-behavior/relative-imports guard
//   markdown resolution semantics. If any of these is red, the LR work leaked into shared machinery
//   (scanTokens/cleanToken are shared) — fix the ENGINE seam, not the suite.

// GOTCHA — typecheck failures are not always type errors. scripts/typecheck.mjs resolves pi's .d.ts from
//   the GLOBAL npm root; if pi isn't installed globally, the script prints its own error and exits 1 —
//   that's an environment issue, not a regression. Check the message before touching file-injector.ts.

// GOTCHA — plan/011_e473dac8178b/tasks.json is ALREADY modified in the working tree (orchestrator-owned).
//   It is NOT fallout and must be left alone. `git status` cleanliness = "no NEW modifications beyond it".

// GOTCHA — a green sweep should leave git diff EMPTY (beyond tasks.json). If you wrote a fix, re-run BOTH
//   gates after it — a fix that trades one suite's red for another's is a net failure.

// LIBRARY — the suites load the REAL file-injector.ts via jiti from the global pi package (npm root -g),
//   with Pi's alias map. Zero project-level deps for tests. typecheck uses npx -p typescript@5.6.
```

## Implementation Blueprint

### The changed-seams map (contingency fix boundary — from `git diff 5c1434e HEAD -- file-injector.ts`)

| Seam | Current-line anchor | LR change it carries | Its gate |
|---|---|---|---|
| `cleanToken` | L~168 | trailing-`:` trim (range grammar §2.1) | LINE-3 |
| `sliceLines` (+ `splitLineRange`) | L~188–209 | trailing-newline line semantics (§4) | LINE-4 |
| `FileDetail` interface | L~548 | `range` / `pagedHeadLines` fields | LINE-8b/12 |
| `scanTokens` | L~1160+ | carries startLine+endLine on tokens | LINE-5 (and shared w/ URL suite) |
| `processTokenStream` | L~1229+ | retry ladder; LR-3 malformed-range detection | LINE-10 |
| `injectFile` | L~1309–1452 | LR-2 claim-by-classification (bare `abs` for image/binary); LR-3/LR-4 warning notifies; LR-4 claim revoke | LINE-9 / 10 / 11 |
| `emitText` | L~1464–1505 | LR-1 slice budget/paging (file-coordinate resume); LR-5 clamped display; unified cost/lines/push/subtract quadruple | LINE-8 / 8-MD / 8b / 12 |
| new gates (test file) | LINE-7 · LINE-8b blocks | S1/S2 additions | their own |

### Failure-routing table (contingency — which red maps to which seam)

| Red signal | Meaning | Allowed fix locus |
|---|---|---|
| LINE-8 / 8-MD / 8b ✗ | LR-1 paging/resume math regressed | `emitText` paged-range branch |
| LINE-12 ✗ | LR-5 clamped-display regressed | `emitText` detail-range construction |
| LINE-9 ✗ | LR-2 claim-by-classification regressed | `injectFile` claim normalization |
| LINE-10 ✗ | LR-3 malformed-notify regressed | `processTokenStream` detect + `injectFile` notify |
| LINE-11 ✗ | LR-4 past-EOF failure path regressed | `injectFile` revoke/notify branch |
| LINE-1..6 ✗ | basic slicing/scan regressed | `sliceLines`/`splitLineRange`/`scanTokens` |
| URL suite ✗ | LR change leaked into shared machinery (`scanTokens`/`cleanToken`) | the leaking seam — NEVER the URL feature/suite |
| import/relative suite ✗ | same leak class | the leaking seam — NEVER the suite |
| typecheck ✗ (real tsc error) | a type regression in a seam | the seam (keep --strict clean) |
| typecheck ✗ (script's own env error) | pi not globally installed / .d.ts missing | environment, not code — report |

### Implementation Tasks (ordered)

```yaml
Task 1: RUN the full suite (the primary gate)
  - cd /home/dustin/projects/pi-file-injector && npm test
  - EXPECT: exit 0; four "Result:" lines — file-injector "180 passed, 0 failed" (or ±1; must be 0 failed),
    import-behavior "23 passed, 0 failed", relative-imports "38 passed, 0 failed", url-injection "38 passed, 0 failed".
  - IF exit non-zero: read the FIRST ✗ block (the &&-chain stops at the failing file) → routing table → Task 4.

Task 2: RUN the typecheck gate
  - npm run typecheck
  - EXPECT: exit 0; final line "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
  - IF non-zero: distinguish the script's environment errors (npm root -g / missing .d.ts → report) from
    real tsc errors (→ routing table → Task 4).

Task 3: CONFIRM the done-definition (read-only, ~4 greps)
  - a) LINE gates: node ./file-injector.test.mjs 2>&1 | grep "✓ case LINE"  → 14 lines (1,2,3,4,5,6,7,8,8-MD,8b,9,10,11,12).
  - b) LR closure: LR-1 = LINE-8+8-MD+8b ✓; LR-2 = LINE-9 ✓; LR-3 = LINE-10 ✓; LR-4 = LINE-11 ✓; LR-5 = LINE-12 ✓.
  - c) Guard suites: the three Result lines from Task 1 (each 0 failed) = no drift (URL deny-list/dispatch/
       spinner; import semantics).
  - d) git status: no NEW modifications beyond the pre-existing plan/…/tasks.json.
  - THEN: write the one-paragraph summary (see PRP output artifact). DONE — do not touch any file.

Task 4: CONTINGENCY (only if Task 1/2 found red) — fix fallout within the changed seams
  - LOCATE: routing table → the single seam. READ the seam + its failing gate before editing.
  - FIX: minimal, behavior-preserving, inside the seam. Do NOT weaken/skip/re-order ANY assertion; do NOT
    edit the three guard suites or the URL feature surface (deny-list/dispatch/spinner).
  - RE-RUN BOTH gates after every fix (a fix that greens one suite and reds another = net regression).
  - IF a gate seems to demand a behavior CHANGE (not a bug fix): STOP and report (item §4-style routing —
    the contract belongs to the dependency subtask, not the sweep).

Task 5: PRODUCE the summary paragraph (the deliverable artifact)
  - All-green case: "No changes required — npm test green across all four suites (file-injector 180/0,
    import-behavior 23/0, relative-imports 38/0, url-injection 38/0; exit 0) and npm run typecheck clean
    (0 errors under --strict). LINE-1…12 plus LINE-8-MD/8b all pass, closing LR-1…LR-5 per the feature
    register; no drift detected in the guard suites."
  - Fallout case: same skeleton + one sentence per fix (what was red, which seam, what changed, both gates re-green).
```

### Integration Points

```yaml
GATES (run, do not modify):
  - npm test        # package.json scripts.test — the 4-file &&-chain
  - npm run typecheck   # scripts/typecheck.mjs — CI-parity (validate.sh Phase 1; also prepublishOnly)

NO_CHANGES (hard boundaries):
  - import-behavior.test.mjs / relative-imports.test.mjs / url-injection.test.mjs  # guard suites: verify only
  - URL feature surface in file-injector.ts (deny-list, content-type dispatch, spinner/footer)  # never edit to pass
  - README.md   # P1.M2.T2.S1 owns it
  - PRD.md, plan/** (incl. tasks.json — orchestrator-owned, already modified in the tree), package.json,
    scripts/typecheck.mjs
  - Landed gates LINE-1..12/8-MD/8b  # byte-identical unless a gate is itself broken (then fix the gate's bug,
                                     # never its assertion strength)
```

## Validation Loop

### Level 1: The full suite gate

```bash
cd /home/dustin/projects/pi-file-injector
npm test 2>&1 | grep -E "Result:|✗"; echo "EXIT: $?"
# Expected: four Result lines —
#   Result: 180 passed, 0 failed.        (file-injector.test.mjs — ±1 acceptable, 0 failed mandatory)
#   Result: 23 passed, 0 failed          (import-behavior.test.mjs)
#   Result: 38 passed, 0 failed.         (relative-imports.test.mjs)
#   Result: 38 passed, 0 failed.         (url-injection.test.mjs)
# — zero ✗ lines, EXIT: 0. Any ✗ or non-zero exit → routing table → contingency Task 4.
```

### Level 2: The typecheck gate

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck; echo "EXIT: $?"
# Expected: ends with "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", EXIT: 0.
# A script-authored error (npm root -g / .d.ts missing) = environment issue → report, not a code fix.
```

### Level 3: The done-definition greps

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -c "✓ case LINE"   # expect 14
node ./file-injector.test.mjs 2>&1 | grep "✓ case LINE"      # eyeball: 1,2,3,4,5,6,7,8,8-MD,8b,9,10,11,12
# LR closure: LINE-8/8-MD/8b (LR-1) · LINE-9 (LR-2) · LINE-10 (LR-3) · LINE-11 (LR-4) · LINE-12 (LR-5)
```

### Level 4: Sweep hygiene (nothing snuck in)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# Expected: ONLY " M plan/011_e473dac8178b/tasks.json" (pre-existing, orchestrator-owned).
# Any other modified file = fallout-fix residue → must be justified in the summary (and both gates re-green).
git diff --stat 5c1434e HEAD -- file-injector.ts   # context: the changeset this sweep certifies (172+/30-)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm test` exit 0; four Result lines, all `0 failed` (observed: 180 / 23 / 38 / 38).
- [ ] `npm run typecheck` exit 0; "0 errors" under --strict.
- [ ] 14 `✓ case LINE` lines (LINE-1…12 + 8-MD + 8b); zero ✗ lines anywhere.
- [ ] `git status` clean beyond the pre-existing orchestrator-owned tasks.json (all-green case).

### Feature Validation (the done-definition, item §3)

- [ ] LR-1 closed: LINE-8 + LINE-8-MD + LINE-8b ✓ (slice budget/paging; FILE-coordinate resume).
- [ ] LR-2 closed: LINE-9 ✓ (image/binary bare-`abs` claim; no duplicate bytes).
- [ ] LR-3 closed: LINE-10 ✓ (malformed range → verbatim + warning notify).
- [ ] LR-4 closed: LINE-11 ✓ (past-EOF → no empty block, claim revoked, notify).
- [ ] LR-5 closed: LINE-12 ✓ (clamped display `:2-5`).
- [ ] LINE-1…LINE-6 (slice basics, trim, unit helpers, scanTokens shape, dedup matrix) ✓.
- [ ] No drift: import-behavior 0 failed · relative-imports 0 failed · url-injection 0 failed
      (URL deny-list, dispatch, spinner behavior guarded and untouched).

### Code Quality Validation (contingency only — skip if all-green)

- [ ] Any fix is inside a changed seam (routing table); minimal; behavior-preserving.
- [ ] No assertion weakened/skipped/re-ordered; no guard-suite or URL-feature edits.
- [ ] Both gates re-run green after every fix; no fix trades one suite's red for another's.

### Documentation & Deployment

- [ ] The one-paragraph sweep summary is delivered (expected: nothing adjusted; the observed numbers).
- [ ] No README/docs changes (P1.M2.T2.S1 owns the README sync; item §5: none).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT "improve" anything that is green.** The observed tree is fully green (279/0 + typecheck 0
  errors). Refactors, comment sweeps, gate tightening — all out of scope. The sweep CERTIFIES; it does not polish.
- ❌ **Do NOT assert a fixed suite count as the gate.** 180/23/38/38 is the observed baseline; counts move
  with sibling commits. The gate is `0 failed` + exit 0 + the 14 LINE ✓ lines.
- ❌ **Do NOT edit the three guard suites (or their guarded features) to make a test pass.** They are the
  do-not-regress certificate for shipped behavior (URL deny-list, dispatch, spinner; import semantics).
  Weakening them converts the sweep into a lie. A red guard suite = an engine leak in a shared seam — fix there.
- ❌ **Do NOT fix fallout outside the changed seams.** The LR changeset touched ONLY cleanToken, sliceLines/
  splitLineRange, FileDetail fields, scanTokens, processTokenStream, injectFile, emitText, and the new gates.
  Anything else is another changeset's territory.
- ❌ **Do NOT weaken a failing gate.** If a LINE gate is red, the bug is in its seam (routing table). Fix the
  engine; the assertion stands. If the gate seems to demand behavior CHANGE, stop and report — that routes
  back to the dependency subtask (item §4).
- ❌ **Do NOT misread a typecheck environment failure as a type error.** scripts/typecheck.mjs prints its own
  errors when pi isn't globally installed / .d.ts is missing. Check which before touching any .ts.
- ❌ **Do NOT skip the re-run after a contingency fix.** A fix must leave BOTH gates green — one-suite-for-
  another is a net regression.
- ❌ **Do NOT touch plan/ (esp. tasks.json — already modified, orchestrator-owned), PRD.md, README.md,
  package.json, or scripts/typecheck.mjs.**
- ❌ **Do NOT forget the summary paragraph.** It is the deliverable (item §4 OUTPUT) — one paragraph, what
  was adjusted (expected: nothing) + the certification numbers.

---

## Confidence Score: 9/10

The sweep's two commands and their exact expected outputs were RUN and observed green at HEAD e5448b3
(`npm test` = 180/23/38/38, all 0 failed, exit 0; `npm run typecheck` = 0 errors, exit 0; all 14 LINE
gates ✓) — so one-pass success is essentially "reproduce the observation, confirm the done-definition
greps, write the paragraph." The contingency playbook (which red maps to which seam, the hard boundaries,
the re-run rule) covers the only realistic deviation (a sibling commit shifting the tree), and the robust
gate (`0 failed` + exit 0 + 14 LINE ✓ lines, never fixed N) absorbs count drift. The -1 reserves for
the tail risk that a sibling's late commit introduces a genuine cross-suite regression — in which case the
routing table bounds the fix, but diagnosing an interplay bug could take judgment beyond the mechanical
path.