---
name: "P1.M1.T2.S1 (plan/007) — Run typecheck and all three test suites via validate.sh (phases 1-3, skip e2e)"
prd_ref: "v007 delta (documentation-only PRD Done-definition fix, already-applied commit 1ad7b19); architecture/system_context.md (test infrastructure); PRD §8 (File Structure), §9 (Algorithm), §11.3 (Automated sanity check)"
target_file: "(NONE — VERIFICATION subtask. Runs existing validate.sh / npm scripts; modifies NO files. file-injector.ts, the 3 test files, package.json, tsconfig.json are all untouched.)"
target_language: "Bash + Node (validate.sh orchestrates tsc --strict via scripts/typecheck.mjs + 3 zero-dep .mjs suites that load the real ./file-injector.ts via Pi's jiti loader)"
depends_on: "NONE for execution (the codebase is complete + green; T2.S1 is a deterministic re-run). Sibling P1.M1.T1.S1 (Done-definition=32 + matrix=32 — Complete) and P1.M1.T1.S2 (stale-24 scan — parallel, read-only PRD.md) provide the doc-consistency context T2.S1's green gate is consistent with; neither is a code dependency."
consumed_by: "NONE downstream. T2.S1 is the hermetic regression record that closes the 'zero-code-impact' half of the v007 verification; P1.M1.T3.S1/S2 (README/PRD doc re-verify) are independent read-only gates."
---

# PRP — P1.M1.T2.S1: Run typecheck and all three test suites via validate.sh (phases 1-3, skip e2e)

> **Scope flag:** This is a **VERIFICATION subtask**, NOT implementation. The v007 delta is documentation-only
> (PRD.md Done-definition `24 → 32`, already-applied commit `1ad7b19`, zero code changes). T2.S1 runs the
> hermetic regression gate — `FI_SKIP_E2E=1 bash validate.sh` — and asserts all three phases green (typecheck
> 0 errors; 3 suites 122/38/22 = 182; package.json manifest valid). **No file is modified.** A failure would
> indicate a pre-existing issue or an environment problem, NOT a delta regression (item §4).

---

## Goal

**Feature Goal:** Confirm the v007 documentation-only delta introduced ZERO code regression by running the
project's hermetic validation gate (validate.sh phases 1–3, e2e skipped) and asserting every phase passes:
(a) `tsc --strict` reports 0 errors, (b) `file-injector.test.mjs` reports 122 passed, (c)
`relative-imports.test.mjs` reports 38 passed, (d) `import-behavior.test.mjs` reports 22 passed, (e) the
`package.json` manifest validation passes. Together these exercise the 32-case §11 matrix + §10 edge cases +
relative-import properties + import-behavior scenarios (item §3).

**Deliverable:** A pass/fail record for each phase (1–3) with exit codes, produced by running
`FI_SKIP_E2E=1 bash validate.sh` (or the equivalent individual `npm run typecheck` + `node ./<suite>.test.mjs`
+ manifest-check commands). **No file edits** — verification only.

**Success Definition:** `FI_SKIP_E2E=1 bash validate.sh` exits 0 with the summary line `PASS: 7  FAIL: 0`
and `RESULT: VALIDATION PASSED`. Phase 1 ✓ (0 errors), Phase 2 ✓ (122/38/22 = 182/182 aggregate), Phase 3 ✓
(manifest valid + directory-loadable), Phase 4 ℹ (skipped via FI_SKIP_E2E=1). No source/test/package file is
modified (`git status` clean except for plan/ artifacts).

## User Persona

**Target User:** The delta reviewer / maintainer who needs proof the documentation-only PRD fix didn't
break the (unchanged) code, and that the full 182-case behavioral contract still holds.

**Use Case:** After landing the one-token PRD.md fix, the reviewer runs the regression gate to confirm
`file-injector.ts` still typechecks clean and all 182 tests still pass — closing the "zero code impact"
verification half of the delta.

**Pain Points Addressed:** A doc edit can't logically break code, but a regression gate is the deterministic
proof. Running it converts "should be fine" into "182/182 green, 0 type errors, exit 0."

## Why

- **Closes the regression-check half of the v007 verification.** The delta is documentation-only (PRD.md
  Done-definition `24 → 32`, already-applied). T1.S1 confirms the doc consistency (Done-definition=32 +
  matrix=32). T1.S2 confirms no other stale count. **T2.S1 confirms the code is unaffected** — the 182-case
  behavioral contract + the `--strict` typecheck + the manifest all still pass. Together the three close the
  delta's verification loop.
- **The 182 cases ARE the Done-definition's "32 manual test cases" made executable.** The §11 matrix (32 rows)
  is encoded as runnable cases in `file-injector.test.mjs` (the full matrix + §10 edges + unit tests),
  `relative-imports.test.mjs` (the depth-uniform resolution property), and `import-behavior.test.mjs` (the
  §4.5/§4.6 contract). A green aggregate (182/182) is the machine-checked form of "all 32 manual test cases pass."
- **Deterministic + hermetic.** Phases 1–3 need no model, no network, no API key (only phase 4 e2e does, and
  it's skipped). The gate is reproducible in any environment with Node + the global pi `.d.ts` installed.

## What

No user-visible, API, config, or code change (verification only). The deliverable is a pass/fail record.

### Success Criteria

- [ ] `FI_SKIP_E2E=1 bash validate.sh` exits 0.
- [ ] Summary line reads `PASS: 7  FAIL: 0` and `RESULT: VALIDATION PASSED`.
- [ ] **Phase 1** ✓: `file-injector.ts type-checks clean under --strict (0 errors)` (`scripts/typecheck.mjs`
      exit 0 + log contains "0 errors").
- [ ] **Phase 2** ✓: `file-injector.test.mjs: 122 passed, 0 failed`; `relative-imports.test.mjs: 38 passed,
      0 failed`; `import-behavior.test.mjs: 22 passed, 0 failed`; `aggregate: 182/182 tests pass`.
- [ ] **Phase 3** ✓: `package.json: valid (name, type:module, pi.extensions, scripts)` AND `directory loadable
      via manifest (pi.extensions non-empty)`.
- [ ] **Phase 4** ℹ: `FI_SKIP_E2E=1 — skipping live workflow tests` (correctly skipped; out of scope).
- [ ] `git status` shows NO modification to `file-injector.ts`, the 3 `.test.mjs` files, `package.json`,
      `tsconfig.json`, `README.md`, or `PRD.md` (verification only; the delta is doc-only and already-applied).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives the exact command (`FI_SKIP_E2E=1 bash validate.sh`), the exact
expected output (verified green during research: PASS 7 / FAIL 0 / exit 0, with each phase's ok line), the
4-phase structure of validate.sh, the per-suite expected counts (122/38/22=182), the failure-diagnosis
protocol (item §4: a failure = pre-existing/environment, NOT a delta regression — HALT and report, don't
patch), and the equivalent individual-phase fallback commands. The executing agent runs one command and
reads the summary line.

### Documentation & References

```yaml
# MUST READ — the test infrastructure this subtask runs (item §1 cites this)
- file: plan/007_3778406b61d6/architecture/system_context.md
  why: "Documents validate.sh's 4 phases (1 typecheck, 2 three suites 122/38/22=182, 3 manifest, 4 11 live
        e2e skippable via FI_SKIP_E2E=1); confirms the codebase is complete + mature (file-injector.ts 1114
        lines, all PRD features implemented); states the v007 delta is doc-only + already-applied (commit
        1ad7b19) + zero code edits."
  section: "## What exists + ## Session 007 delta + ## Implications for task breakdown"
  critical: "Phase 4 requires a real pi binary + API key and is OUT OF SCOPE for this delta. FI_SKIP_E2E=1
             is the sanctioned skip. Phases 1-3 are hermetic (no model, no network)."

# MUST READ — the delta contract (zero code impact; the regression check is the only sensible verification)
- file: plan/007_3778406b61d6/architecture/delta_analysis.md
  why: "Confirms: no code change (file-injector.ts/tests/README/package.json/tsconfig untouched); no new/modified
        requirement; already-applied (PRD.md:1189 reads 'all 32'); net delta = one token in one doc line.
        §Risk: 'Any edit to file-injector.ts, tests, README.md, or package.json would WIDEN SCOPE and violate
        the delta's contract.' §Verification: 'A regression check (validate.sh phases 1-3) is the only sensible
        verification step.'"
  critical: "T2.S1 MUST NOT edit any source/test/package file to make a phase pass. A failure means a
             pre-existing issue or environment problem — report it, do not patch (item §4)."

# MUST READ — the script you run (the gate)
- file: validate.sh
  why: "Executable at repo root. Phase 1 runs `node ./scripts/typecheck.mjs` and greps /tmp/fi_tc.log for
        '0 errors'. Phase 2 runs three `run_suite` calls (expected 122/38/22) + aggregates to 182. Phase 3
        runs a `node -e` JSON.parse asserting package.json fields (name/type:module/pi.extensions/scripts) +
        a directory-loadable check. Phase 4 runs 11 live `pi -p` e2e (W1-W11), SKIPPED when FI_SKIP_E2E=1.
        Exits 0 iff FAIL===0. Summary: 'PASS: <N> FAIL: <M>' (N=7 when e2e skipped)."
  pattern: "The script uses `set -uo pipefail`; cd's to its own dir; uses PASS/FAIL counters + ok()/bad()
            helpers. Each phase prints '═══ Phase N: <name> ═══' then ✓ PASS / ✗ FAIL lines."
  gotcha: "FI_SKIP_E2E=1 must be set in the ENV (prefix the command: `FI_SKIP_E2E=1 bash validate.sh`), not
           passed as an arg. The script reads `${FI_SKIP_E2E:-0}`. Without it, phase 4 runs and needs a real
           pi binary + API key (out of scope)."

# MUST READ — the sibling doc-consistency gates (context for what T2.S1's green run is consistent with)
- file: plan/007_3778406b61d6/P1M1T1S1/PRP.md
  why: "T1.S1 (Complete) confirms Done-definition reads '32' + §11 matrix has exactly 32 rows (the doc-consistency
        half). T2.S1's green 182-case run is the CODE half — together they prove the delta is consistent
        (doc says 32, matrix has 32, the 32 cases + 150 more all pass)."
- file: plan/007_3778406b61d6/P1M1T1S2/PRP.md
  why: "T1.S2 (parallel, read-only) confirms no OTHER stale '24' test-count in PRD.md. Read-only PRD.md scan;
        no code/test impact; no conflict with T2.S1."

# The files under test (READ-ONLY — do not edit)
- file: file-injector.ts
  why: "The extension (1114 lines). Phase 1 typechecks it; phase 2 loads it via jiti. UNTOUCHED by this subtask."
- file: file-injector.test.mjs
  why: "122 cases — the full §11 matrix (32 rows) + §10 edges + paged delivery + code-region detection + unit
        tests (resolveImportPath/scanTokens/readConfig/computeCodeRanges/inCode). The project's `npm test`."
- file: relative-imports.test.mjs
  why: "38 cases — the depth-uniform resolution property (every [#]@path resolves relative to the importing
        file's dir at every depth; bare-@ honored at every depth incl. the first file)."
- file: import-behavior.test.mjs
  why: "22 cases — the §4.5/§4.6 import-behavior contract surface."
- file: package.json
  why: "Phase 3 validates: name==='pi-file-injector', type==='module', pi.extensions[0]==='file-injector.ts',
        scripts.typecheck + scripts.test are strings, pi.extensions non-empty (directory-loadable)."
- file: scripts/typecheck.mjs
  why: "Phase 1's typecheck runner (74 lines). Resolves the global @earendil-works/pi-coding-agent + pi-ai .d.ts,
        runs tsc --strict, logs '0 errors' on success."
```

### Current Codebase tree

```bash
pi-file-injector/
├── validate.sh               # ← THE GATE T2.S1 RUNS (phases 1-3; phase 4 skipped via FI_SKIP_E2E=1)
├── file-injector.ts          # UNTOUCHED (phase 1 typecheck target; phase 2 jiti-loaded)
├── file-injector.test.mjs    # UNTOUCHED (phase 2; expect 122 passed)
├── relative-imports.test.mjs # UNTOUCHED (phase 2; expect 38 passed)
├── import-behavior.test.mjs  # UNTOUCHED (phase 2; expect 22 passed)
├── scripts/typecheck.mjs     # UNTOUCHED (phase 1 runner; resolves global pi .d.ts, tsc --strict)
├── package.json              # UNTOUCHED (phase 3 manifest validation)
├── tsconfig.json             # UNTOUCHED
├── PRD.md / README.md        # UNTOUCHED (PRD.md fix already-applied commit 1ad7b19; doc re-verify = T1.S1/S2, T3)
└── plan/007_3778406b61d6/
    ├── architecture/{system_context.md, delta_analysis.md, external_deps.md}   # ← the test-infra + delta contract
    ├── P1M1T1S1/{PRP.md}   # ← doc-consistency gate (Done-def=32 + matrix=32) — Complete
    ├── P1M1T1S2/{PRP.md}   # ← stale-24 scan (parallel, read-only PRD.md)
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← verified-green baseline + phase expectations + failure protocol
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
(none — VERIFICATION subtask. validate.sh / npm scripts are RUN, not edited.
 No source/test/package/config file is modified. `git status` stays clean except for plan/ artifacts.)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — VERIFICATION ONLY. Do NOT edit file-injector.ts, the 3 .test.mjs files, package.json,
#   tsconfig.json, README.md, PRD.md, or validate.sh. The v007 delta is documentation-only and
#   already-applied (commit 1ad7b19); zero code changes are expected or permitted (delta_analysis §Risk).
#   If a phase FAILS, that indicates a pre-existing issue or environment problem, NOT a delta regression —
#   HALT and report (item §4); do NOT patch source/tests to make it pass.

# CRITICAL — FI_SKIP_E2E=1 must be set in the ENVIRONMENT, not passed as an arg. Prefix the command:
#   `FI_SKIP_E2E=1 bash validate.sh`  (NOT `bash validate.sh FI_SKIP_E2E=1`).
#   The script reads `${FI_SKIP_E2E:-0}`. Without it, phase 4 runs and needs a real `pi` binary + API key
#   (out of scope for this delta — item §1/§4). If `pi` isn't on PATH, phase 4 self-skips with an info line,
#   but setting FI_SKIP_E2E=1 is the explicit, deterministic skip.

# CRITICAL — the expected summary is "PASS: 7  FAIL: 0" (not 11). When e2e is skipped, phase 4 contributes
#   0 PASS (just the "skipping" info line). The 7 PASS = phase 1 (1) + phase 2 (3 suites + 1 aggregate = 4)
#   + phase 3 (manifest + loadable = 2). If you see "PASS: 18" that means phase 4 RAN (FI_SKIP_E2E wasn't
#   set) — re-run with the env var. If you see "PASS: <7 but FAIL: >0", a phase failed — read its ✗ line.

# GOTCHA — phase 1 greps /tmp/fi_tc.log for the literal "0 errors". If scripts/typecheck.mjs exits 0 but
#   doesn't print "0 errors" (e.g., a future refactor changes the wording), validate.sh flags it FAIL even
#   though typecheck passed. NOT expected here (the runner is unchanged). If it happens, it's a
#   validate.sh/typecheck.mjs wording drift, not a delta regression — report it.

# GOTCHA — phase 2 greps each suite's log for "N passed" and aggregates via `bc`. If `bc` isn't installed,
#   the aggregate falls back to 0 and the aggregate assertion fails (but the 3 per-suite ok lines still
#   print). NOT expected (bc is standard); if it happens, the per-suite ✓ lines are the real signal.

# GOTCHA — the E4 case (chmod 000 unreadable-file) in file-injector.test.mjs self-skips when running as
#   root (chmod is ineffective for root) — it prints a skip note but does NOT fail. So the suite still
#   reports "122 passed" whether run as root or not. Don't mistake the skip note for a failure.

# LIBRARY — phases 1-3 are hermetic: no model, no network, no API key. Phase 1 resolves the global pi .d.ts
#   from /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent (typecheck-only, no runtime).
#   Phase 2 loads ./file-injector.ts via Pi's jiti loader in a tmpdir (fsSync.mkdtempSync); no real pi
#   process, no API calls. Phase 3 is a JSON.parse of package.json. The ONLY gate is the exit code of
#   `FI_SKIP_E2E=1 bash validate.sh`.
```

## Implementation Blueprint

> There is no implementation. This is the **verification runbook**. (Adapted from the implementation template
> since this subtask produces no code and edits no files.)

### The single command (the whole subtask)

```bash
cd /home/dustin/projects/pi-file-injector
FI_SKIP_E2E=1 bash validate.sh
```

### Expected output (VERIFIED GREEN during research — the contract)

```
═══ Phase 1: Static type checking (tsc --strict) ═══
  ✓ PASS  file-injector.ts type-checks clean under --strict (0 errors)

═══ Phase 2: Unit / integration tests (3 suites, 182 cases) ═══
  ✓ PASS  file-injector.test.mjs: 122 passed, 0 failed
  ✓ PASS  relative-imports.test.mjs: 38 passed, 0 failed
  ✓ PASS  import-behavior.test.mjs: 22 passed, 0 failed
  ✓ PASS  aggregate: 182/182 tests pass

═══ Phase 3: Package-manifest validation ═══
  ✓ PASS  package.json: valid (name, type:module, pi.extensions, scripts)
  ✓ PASS  directory loadable via manifest (pi.extensions non-empty)

═══ Phase 4: End-to-end workflows (real pi -p) ═══
  ℹ      FI_SKIP_E2E=1 — skipping live workflow tests

═══ Summary ═══
  PASS: 7   FAIL: 0
  RESULT: VALIDATION PASSED
```
**Exit code: 0.**

### Verification Tasks (ordered)

```yaml
Task 1: RUN the hermetic regression gate
  - CMD: cd /home/dustin/projects/pi-file-injector && FI_SKIP_E2E=1 bash validate.sh
  - EXPECT: exit 0; the full output above (7 ✓ PASS lines across phases 1-3; phase 4 ℹ skipped; summary
            "PASS: 7  FAIL: 0" + "RESULT: VALIDATION PASSED").
  - WHY this command: it's the single gate that exercises all three hermetic phases (typecheck + 3 suites +
            manifest) in one exit-code-0 result, and it's the command item §3 names first. FI_SKIP_E2E=1
            deterministically skips the out-of-scope live e2e (phase 4).

Task 2: ASSERT each phase's expected line (read the output)
  - Phase 1: ✓ "file-injector.ts type-checks clean under --strict (0 errors)".
  - Phase 2: ✓ "file-injector.test.mjs: 122 passed, 0 failed"; ✓ "relative-imports.test.mjs: 38 passed, 0 failed";
              ✓ "import-behavior.test.mjs: 22 passed, 0 failed"; ✓ "aggregate: 182/182 tests pass".
  - Phase 3: ✓ "package.json: valid (name, type:module, pi.extensions, scripts)"; ✓ "directory loadable via
              manifest (pi.extensions non-empty)".
  - Phase 4: ℹ "FI_SKIP_E2E=1 — skipping live workflow tests" (skipped, NOT a pass or fail).
  - Summary: "PASS: 7  FAIL: 0" + "RESULT: VALIDATION PASSED".

Task 3: VERIFY no files were modified (zero-code-impact contract)
  - CMD: git status --short
  - EXPECT: NO modification to file-injector.ts, *.test.mjs (×3), package.json, tsconfig.json, README.md,
            PRD.md, validate.sh, scripts/typecheck.mjs. (plan/ artifacts are the only allowed writes, and
            those are the PRP/research, not code.)
  - The delta is documentation-only and already-applied; T2.S1 runs tests, it doesn't change code.

Task 4 (FALLBACK — only if validate.sh is unavailable): run the phases individually
  - Phase 1: npm run typecheck            # → log contains "0 errors", exit 0
  - Phase 2a: node ./file-injector.test.mjs    2>&1 | tail -3   # → "122 passed, 0 failed"
  - Phase 2b: node ./relative-imports.test.mjs 2>&1 | tail -3   # → "38 passed, 0 failed"
  - Phase 2c: node ./import-behavior.test.mjs  2>&1 | tail -3   # → "22 passed, 0 failed"
  - Phase 3: node -e "const p=require('./package.json'); const e=[]; if(p.name!=='pi-file-injector')e.push('name');
             if(p.type!=='module')e.push('type'); if(!Array.isArray(p.pi?.extensions)||p.pi.extensions[0]!=='file-injector.ts')e.push('pi.extensions');
             if(typeof p.scripts?.typecheck!=='string')e.push('scripts.typecheck'); if(typeof p.scripts?.test!=='string')e.push('scripts.test');
             if(e.length)process.exit(console.error('missing/wrong:',e.join(','))||1); console.log('manifest OK');"
  - EXPECT: all green (0 errors / 122 / 38 / 22 / manifest OK). This is equivalent to validate.sh phases 1-3.
```

### Failure-Diagnosis Protocol (ONLY if a phase unexpectedly fails — item §4)

```text
The delta is documentation-only and already-applied; phases 1-3 are expected GREEN (verified during research).
A failure is NOT a delta regression — it's a pre-existing issue or an environment problem. Protocol:

1. Phase 1 (typecheck) FAILS:
   - Read /tmp/fi_tc.log (validate.sh prints it on failure).
   - Likely: the global @earendil-works/pi-coding-agent package was uninstalled/moved (typecheck can't
     resolve the .d.ts), OR a Node version change broke a lib API.
   - DO NOT edit file-injector.ts to "fix" it (delta forbids code changes). REPORT the environment issue.

2. Phase 2 (a test suite) FAILS:
   - Read the failing suite's /tmp/fi_<name>.log (validate.sh prints the tail on failure).
   - A real test failure would be a pre-existing regression (the delta touched NO code). The chmod-000 E4
     case self-skips under root (NOT a failure). A tmpdir permission issue is environmental.
   - DO NOT edit the test or the source. REPORT the failing case + the pre-existing nature.

3. Phase 3 (manifest) FAILS:
   - Read /tmp/fi_pkg.log. The manifest is verified correct (name/type/pi.extensions/scripts). A failure
     means package.json was modified outside the delta (forbidden) OR has a JSON syntax error.
   - DO NOT edit package.json. REPORT.

4. Exit code ≠ 0:
   - At least one phase's bad() fired. The summary names the FAIL count; the inline ✗ lines name which
     assertion. Apply the protocol above for the failing phase.

In ALL cases: HALT and report. Do NOT edit any source/test/package/config file to make a phase pass.
```

### Integration Points

```yaml
NO CHANGES (verification only): none of these are touched.
  - DATABASE: none
  - CONFIG: none
  - ROUTES: none
  - NO file is edited. validate.sh / npm scripts are RUN.
```

## Validation Loop

### Level 1: The gate (the entire subtask)

```bash
cd /home/dustin/projects/pi-file-injector
FI_SKIP_E2E=1 bash validate.sh
# Expected: exit 0; "PASS: 7  FAIL: 0"; "RESULT: VALIDATION PASSED".
# Phase 1 ✓ (0 errors); Phase 2 ✓ (122/38/22 = 182/182); Phase 3 ✓ (manifest + loadable); Phase 4 ℹ (skipped).
```

### Level 2: Per-phase assertion (read the output, confirm each line)

```bash
FI_SKIP_E2E=1 bash validate.sh 2>&1 | grep -E "PASS|FAIL|RESULT|skipping"
# Expected:
#   ✓ PASS  file-injector.ts type-checks clean under --strict (0 errors)
#   ✓ PASS  file-injector.test.mjs: 122 passed, 0 failed
#   ✓ PASS  relative-imports.test.mjs: 38 passed, 0 failed
#   ✓ PASS  import-behavior.test.mjs: 22 passed, 0 failed
#   ✓ PASS  aggregate: 182/182 tests pass
#   ✓ PASS  package.json: valid (name, type:module, pi.extensions, scripts)
#   ✓ PASS  directory loadable via manifest (pi.extensions non-empty)
#   ℹ      FI_SKIP_E2E=1 — skipping live workflow tests
#   PASS: 7   FAIL: 0
#   RESULT: VALIDATION PASSED
# (7 PASS, 0 FAIL, phase 4 skipped. Any ✗ FAIL line → apply the Failure-Diagnosis Protocol.)
```

### Level 3: Zero-code-impact confirmation (git status clean)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# Expected: NO source/test/package/config/PRD/README/validate.sh line appears. The delta is doc-only and
# already-applied; T2.S1 runs tests, it doesn't edit code. (Only plan/ PRP/research artifacts are writes,
# and those belong to this research session, not the codebase.)
# Belt-and-suspenders — confirm the key files are unchanged:
git status --short file-injector.ts file-injector.test.mjs relative-imports.test.mjs import-behavior.test.mjs package.json tsconfig.json validate.sh scripts/typecheck.mjs PRD.md README.md
# Expected: (empty output — all unchanged.)
```

### Level 4: Equivalent individual-phase re-run (optional cross-check)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck                                               # → "0 errors", exit 0
node ./file-injector.test.mjs 2>&1 | tail -1                    # → "Result: 122 passed, 0 failed."
node ./relative-imports.test.mjs 2>&1 | tail -1                 # → "Result: 38 passed, 0 failed."
node ./import-behavior.test.mjs 2>&1 | tail -1                  # → "Result: 22 passed, 0 failed."
# (All four green = phases 1-2 confirmed independently of validate.sh. Phase 3 is validate.sh-internal;
#  the standalone node -e snippet in Task 4 covers it if desired.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `FI_SKIP_E2E=1 bash validate.sh` exits 0.
- [ ] Summary: `PASS: 7  FAIL: 0` + `RESULT: VALIDATION PASSED`.
- [ ] Phase 1 ✓: `file-injector.ts type-checks clean under --strict (0 errors)`.
- [ ] Phase 2 ✓: 122/38/22 = 182/182 aggregate.
- [ ] Phase 3 ✓: package.json valid + directory-loadable.
- [ ] Phase 4 ℹ: `FI_SKIP_E2E=1 — skipping live workflow tests` (correctly skipped).

### Feature Validation (zero-code-impact)

- [ ] `git status --short` shows NO modification to file-injector.ts / 3 .test.mjs / package.json /
      tsconfig.json / validate.sh / scripts/typecheck.mjs / PRD.md / README.md.
- [ ] No file edited to make a phase pass (verification only; delta is doc-only + already-applied).

### Gate Integrity

- [ ] If a phase FAILED: the Failure-Diagnosis Protocol was applied (HALT + report; no source/test/package edit).
- [ ] FI_SKIP_E2E=1 was set in the environment (prefix), not as an arg (phase 4 deterministically skipped).

### Documentation

- [ ] No user-facing/config/API/JSDoc surface change (this subtask runs tests; it documents nothing new).
- [ ] No README/PRD edit (doc re-verify is T1.S1/S2 + T3.S1/S2; T2.S1 is the code-regression half).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit any source/test/package/config file.** This is verification only. The v007 delta is
  documentation-only and already-applied (commit 1ad7b19); zero code changes are expected or permitted
  (delta_analysis §Risk). A failure means a pre-existing/environment issue — report it, don't patch (item §4).
- ❌ **Do NOT run phase 4 (live e2e).** It needs a real `pi` binary + API key and is out of scope for this
  delta (item §1). Always prefix `FI_SKIP_E2E=1`. (If `pi` isn't on PATH, phase 4 self-skips, but setting
  the env var is the explicit, deterministic skip.)
- ❌ **Do NOT pass FI_SKIP_E2E as an arg** (`bash validate.sh FI_SKIP_E2E=1`). It must be in the ENVIRONMENT
  (`FI_SKIP_E2E=1 bash validate.sh`). The script reads `${FI_SKIP_E2E:-0}`; an arg is ignored → phase 4 runs.
- ❌ **Do NOT expect "PASS: 18" (the full count with e2e).** With e2e skipped, the summary is "PASS: 7"
  (phase 1: 1 + phase 2: 4 + phase 3: 2; phase 4 contributes 0 PASS, just the ℹ skip line). Seeing "PASS: 7"
  is correct; seeing "PASS: 18" means phase 4 ran (FI_SKIP_E2E wasn't set) — re-run with the env var.
- ❌ **Do NOT mistake the E4 chmod-000 skip note for a failure.** When running as root, the unreadable-file
  case self-skips (chmod is ineffective for root) but does NOT fail — `file-injector.test.mjs` still reports
  "122 passed". The skip note is informational.
- ❌ **Do NOT treat a phase-1 "0 errors" wording miss as a typecheck failure.** validate.sh greps
  /tmp/fi_tc.log for the literal "0 errors"; if scripts/typecheck.mjs exits 0 but the wording drifted, the
  script flags FAIL. NOT expected here (runner unchanged); if it happens, it's a validate.sh/typecheck.mjs
  drift, not a delta regression — report it.
- ❌ **Do NOT widen scope.** No Done-definition/matrix re-verification (T1.S1), no stale-24 scan (T1.S2),
  no README scan (T3.S1), no PRD broad re-verify (T3.S2). T2.S1 is the hermetic regression gate ONLY.
- ❌ **Do NOT re-run with a tweaked codebase to "chase" a green result.** The codebase is complete and was
  verified green during research. If a phase fails on re-run, the environment changed (or there's a
  pre-existing issue) — investigate the LOG, don't edit code.

---

## Confidence Score: 10/10

A deterministic verification gate, and the baseline is **already verified GREEN during research**: I ran
`FI_SKIP_E2E=1 bash validate.sh` and captured exit 0 / "PASS: 7  FAIL: 0" / "RESULT: VALIDATION PASSED"
(typecheck 0 errors; 122/38/22 = 182; manifest valid + loadable; phase 4 skipped). The v007 delta is
documentation-only and already-applied (commit 1ad7b19), so the codebase is unchanged from that green state.
The executing agent runs one command, reads the summary line, confirms `git status` is clean — no edits, no
design risk, no ambiguity. The only residual is the (unexpected) failure branch, which the
Failure-Diagnosis Protocol resolves safely (HALT + report; never patch, since the delta forbids code changes
and a failure is by definition pre-existing/environmental, not a delta regression).
