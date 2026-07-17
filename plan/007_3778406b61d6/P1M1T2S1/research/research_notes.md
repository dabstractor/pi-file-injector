# Research Notes — P1.M1.T2.S1: Run typecheck + all three test suites via validate.sh (phases 1-3, skip e2e)

> Pure verification subtask. Runs existing tests; asserts green; expects ZERO code changes. The v007 delta
> is documentation-only (PRD.md Done-definition fix, already-applied commit 1ad7b19). This subtask confirms
> the regression-check half of the delta's verification.

## 1. Baseline VERIFIED GREEN right now (during research)

I ran the exact command this subtask specifies:

```bash
cd /home/dustin/projects/pi-file-injector
FI_SKIP_E2E=1 bash validate.sh
```

**Actual output (captured 2025-07-16):**
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

This is the exact expected result the PRP will assert. The baseline is green; the subtask is a
deterministic re-run that confirms no regression from the (documentation-only) delta.

## 2. validate.sh structure — the 4 phases (verified by reading the script)

`validate.sh` (executable, 13079 bytes, repo root) runs 4 phases, exits 0 only if every phase passes:

| Phase | What | Hermetic? | In scope for T2.S1? |
|---|---|---|---|
| 1 | tsc --strict via `scripts/typecheck.mjs`; greps `/tmp/fi_tc.log` for "0 errors" | YES (global pi .d.ts) | ✓ |
| 2 | 3 `.test.mjs` suites (122 + 38 + 22 = 182); greps each log for `N passed`; aggregates to 182 | YES (tmpdir fixtures + jiti) | ✓ |
| 3 | `package.json` manifest: name/type:module/pi.extensions/scripts + directory-loadable | YES | ✓ |
| 4 | 11 live `pi -p --mode json` e2e (W1–W11); needs real pi binary + API key | NO | ✗ (FI_SKIP_E2E=1) |

**`FI_SKIP_E2E=1` skips phase 4** (the script checks `[ "${FI_SKIP_E2E:-0}" = "1" ]` and prints the
"skipping" info line). Phases 1–3 always run. The script's summary line `PASS: <N> FAIL: 0` counts
the phase-1 (1 ok) + phase-2 (4 ok: 3 suites + aggregate) + phase-3 (2 ok: manifest + loadable) = **7
PASS when e2e is skipped**. Exit 0 iff FAIL===0.

## 3. The exact phase expectations (verified against the actual run)

- **Phase 1**: `node ./scripts/typecheck.mjs` exits 0 AND `/tmp/fi_tc.log` contains "0 errors".
  - Expected ok: `file-injector.ts type-checks clean under --strict (0 errors)`.
  - Failure mode: typecheck exits non-zero (a real type error) OR exits 0 without "0 errors" in the log.
    Either → bad() → summary FAIL. **NOT expected** (baseline green; delta is doc-only).
- **Phase 2**: three `run_suite` calls:
  - `run_suite file-injector.test.mjs 122` → greps log for `122 passed` → ok.
  - `run_suite relative-imports.test.mjs 38` → greps for `38 passed` → ok.
  - `run_suite import-behavior.test.mjs 22` → greps for `22 passed` → ok.
  - Aggregate: sums the three "N passed" → 182 → ok.
  - Failure mode: a suite exits non-zero OR reports a count ≠ expected. **NOT expected**.
- **Phase 3**: `node -e` JSON.parse of package.json asserting `name==="pi-file-injector"`,
  `type==="module"`, `pi.extensions[0]==="file-injector.ts"`, `scripts.typecheck` + `scripts.test`
  are strings; then a second check that `pi.extensions` is non-empty (directory-loadable).
  - Expected: 2 ok. Failure mode: a manifest field is wrong/missing. **NOT expected** (package.json
    verified: name=pi-file-injector, type=module, pi.extensions=["file-injector.ts"], scripts present).

## 4. The three test suites — what they cover (item §3: "exercise the 32-case §11 matrix + §10 edges")

- **`file-injector.test.mjs` (122 cases)** — the project's `npm test`. The full §11 matrix (32 cases #1–#32:
  text/image/binary/missing/dir/mid-word/multi/tilde/trailing-punct/CLI/format-parity/@-unaffected/md-import/
  md-code-exempt/md-cycle/md-abs-reject/md-relative-base/budget/md-ext-shorthand/md-ext-exact-wins/md-ext-markdown/
  top-level-no-fallback/bare-@-off/bare-@-on/bare-@-#@-coexist/bare-@-top-level-unaffected/bare-@-settings.json/
  md-relative-disambiguation/md-relative-deep-cwd-indep/bare-@-first-file-chain) + §10 edge cases + paged
  delivery + code-region detection + unit tests for resolveImportPath/scanTokens/readConfig/computeCodeRanges/inCode.
- **`relative-imports.test.mjs` (38 cases)** — focused on the two properties easiest to regress: (a) every
  `[#]@path` in a delivered markdown resolves relative to that file's dir at every depth (never ctx.cwd); (b)
  with markdownBareAtImports on, bare-@ honored at every depth incl. the first imported file (cases 30–32).
  Covers resolveImportPath / scanTokens / injectFiles / the real input handler with a hermetic project config.
- **`import-behavior.test.mjs` (22 cases)** — import-behavior scenarios (the §4.5/§4.6 contract surface).

Together = 182 cases = the full behavioral contract the v007 delta's Done-definition ("all 32 manual test
cases pass") summarizes. Running them green PROVES the doc-only delta introduced no code regression.

## 5. The typecheck gate — how it resolves global pi .d.ts

`scripts/typecheck.mjs` (74 lines, `npm run typecheck`) resolves the global `@earendil-works/pi-coding-agent`
+ `pi-ai` `.d.ts` from the global install (`/home/dustin/.local/lib/node_modules/...`), then runs `tsc --strict`
against `file-injector.ts`. The log must contain "0 errors". The v007 delta touches NO .ts code, so the
typecheck result is identical to the pre-delta state (green). A typecheck failure here would indicate an
ENVIRONMENT problem (e.g., the global pi package uninstalled/moved) NOT a delta regression — item §4 flags this.

## 6. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Complete) | Read-only: confirm Done-definition reads "32" + §11 matrix has 32 rows | Provides the doc-consistency confirmation T2.S1's green gate is consistent with. T1.S1 reads PRD.md only; T2.S1 runs code/tests. No file conflict. |
| P1.M1.T1.S2 (Implementing, parallel) | Read-only: grep-scan PRD.md for any other stale "24" test-count | Reads PRD.md only; no code/test impact. No conflict with T2.S1 (which runs tests). |
| P1.M1.T3.S1 (Planned) | Verify README.md has no stale test-count/feature refs | Different file (README.md). No conflict. |
| P1.M1.T3.S2 (Planned) | Verify PRD.md internal consistency | Read-only PRD.md scan. No conflict. |

**Critical no-conflict:** T2.S1 is the ONLY subtask that RUNS code/tests. It modifies NO files (verification
only). The delta expects zero code changes (item §4); a failure would indicate a pre-existing issue or
environment problem, not a delta regression. The baseline is verified GREEN right now (§1).

## 7. Failure-diagnosis protocol (item §4 — only if a phase unexpectedly fails)

The delta is documentation-only and already-applied; phases 1–3 should be green. If a phase FAILS:

1. **Phase 1 (typecheck) fails** → environment problem, not a delta regression. Likely causes: the global
   `@earendil-works/pi-coding-agent` package was uninstalled/moved (typecheck can't resolve the .d.ts), OR
   a Node version change. Investigate `/tmp/fi_tc.log` (printed by validate.sh on failure). Do NOT edit
   `file-injector.ts` to "fix" it — the delta forbids code changes. Report the environment issue.
2. **Phase 2 (a test suite) fails** → a pre-existing issue OR a test-environment problem (e.g., running as
   root makes the chmod-000 E4 case skip-but-not-fail; a tmpdir permission issue). Read the failing suite's
   `/tmp/fi_<name>.log` (printed on failure). The 32-case §11 matrix + §10 edges are the contract; a failure
   there would be a real regression — but the delta touched NO code, so it's pre-existing. Report, don't patch.
3. **Phase 3 (manifest) fails** → package.json was modified outside the delta (forbidden) OR a JSON syntax
   error. Read `/tmp/fi_pkg.log`. The manifest is verified correct (name/type/pi.extensions/scripts).
4. **Exit code ≠ 0** → at least one phase's `bad()` fired. The summary line names the count; the per-phase
   logs (printed inline) name which assertion failed.

**In all cases: HALT and report** — do NOT edit any source/test/package file to make a phase pass. The delta
is zero-code-impact by contract; a failure means the environment or a pre-existing issue, not delta work.

## 8. The exact commands (the deliverable's core)

```bash
# Primary (recommended) — run all 3 hermetic phases, skip live e2e:
cd /home/dustin/projects/pi-file-injector
FI_SKIP_E2E=1 bash validate.sh
# Expected: exit 0; "PASS: 7  FAIL: 0"; "RESULT: VALIDATION PASSED".
# Phase 1 ✓ (0 errors); Phase 2 ✓ (122/38/22 = 182); Phase 3 ✓ (manifest + loadable); Phase 4 ℹ (skipped).

# Equivalent individual-phase runs (item §3 alternative):
npm run typecheck                                              # → "0 errors", exit 0
node ./file-injector.test.mjs 2>&1 | tail -3                   # → "122 passed, 0 failed"
node ./relative-imports.test.mjs 2>&1 | tail -3                # → "38 passed, 0 failed"
node ./import-behavior.test.mjs 2>&1 | tail -3                 # → "22 passed, 0 failed"
# (Phase 3 manifest check is validate.sh-internal; the `node -e` JSON.parse snippet can be run standalone.)
```

The `FI_SKIP_E2E=1 bash validate.sh` form is preferred — it's the single command that exercises all three
hermetic phases + the manifest check in one exit-code-0 gate, and it's the command the item description §3
names first. The individual `npm run`/`node` runs are the fallback if validate.sh itself is unavailable.
