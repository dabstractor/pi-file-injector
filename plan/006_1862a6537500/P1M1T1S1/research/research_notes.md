# Research Notes — P1.M1.T1.S1 (plan/006): Run all three test suites — confirm 182 passed, 0 failed

## Mission
A **verification gate** (not new implementation). The v006 delta PRD introduced three requirement-level
changes (all ALREADY implemented + tested green): (A) 4-source config merge with trust gate, (B) depth-uniform
markdown resolution (dirname(abs), no cwd fallback), (C) depth-uniform bare-@ matching. This subtask runs the
three integration test suites in sequence and confirms each prints "X passed, 0 failed" totaling 182.

## ⭐ Baseline CONFIRMED GREEN (run by this research session, working tree unmodified)
```
file-injector.test.mjs      → 122 passed, 0 failed
relative-imports.test.mjs   →  38 passed, 0 failed
import-behavior.test.mjs    →  22 passed, 0 failed
                               (182 passed total, 0 failed)
```
The three commands: `node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs`.
All exit 0. All three test files exist at repo root (file-injector.ts is 1114 lines; suites are 2302/508/250 lines).
These are zero-dep Node ESM scripts that load the REAL extension via Pi's jiti loader (the `@earendil-works/…`
alias map) + spin up temp fixtures — NO mocking.

## The three §1 requirements + their test coverage (for failure-diagnosis routing)
### A — 4-source config merge (`readConfig`, PRD §4.6) → file-injector.test.mjs
- `SETTINGS_KEY = "fileInjector"` (file-injector.ts L171); `readConfig()` L184-217 reads 4 sources in precedence:
  global settings.json→fileInjector key, global file-injector.json, project settings.json (trusted), project
  file-injector.json (trusted). Trust gate `ctx.isProjectTrusted()` wraps BOTH project sources. Missing/malformed → `{}`.
- readConfig is EXPORTED + in ASSERTED_EXPORTS (test L142); typeof assert at L131.
- Tests: file-injector.test.mjs **T2.S1-a/b/…/g** (readConfig unit tests, L1957+). GLOBAL_BASELINE captured at L1972
  to isolate from a dogfooded global config.

### B — Depth-uniform markdown resolution (PRD §4.5 rule 5 + §4.6) → relative-imports.test.mjs
- injectMarkdown L838 has NO `depth` parameter; `const dir = path.dirname(abs)` L842 — base dir is ALWAYS the
  importing file's directory. NO `ctx.cwd` in the resolution path; NO cwd fallback.
- Tests: relative-imports.test.mjs **A1/A7/A9/C1/C2** (and C9 at L336). A7 (L147): missing token → null, NO cwd
  fallback (same-named root file NOT chosen). C9 (L336): missing relative import → verbatim marker, NO cwd fallback.

### C — Depth-uniform bare-@ (PRD §4.6) → relative-imports.test.mjs + import-behavior.test.mjs
- `bareAt: state.bareAt` passed identically at every depth (injectMarkdown scan call L849); BARE_AT_RE union in scanTokens.
- Tests: import-behavior.test.mjs **GROUP 2** (bare-@ at every markdown depth) + **GROUP 5** (depth-0 / first-imported
  file bare-@ under markdownBareAtImports:true — the "#@ first-file-import" asymmetry fix, via the REAL handler path
  with cfg from LIVE settings, not hardcoded). Also relative-imports.test.mjs covers cases 30-32 (PRD §11).

## The runbook (the whole subtask)
```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs       # expect: "Result: 122 passed, 0 failed."   exit 0
node ./relative-imports.test.mjs    # expect: "Result: 38 passed, 0 failed"     exit 0
node ./import-behavior.test.mjs     # expect: "Result: 22 passed, 0 failed"     exit 0
# Combined exit: all three 0 → gate PASS. Total = 122+38+22 = 182 passed, 0 failed.
```
Record the count for each. If all green → mark complete. (Baseline is green, so this is the expected path.)

## Failure-diagnosis protocol (ONLY if a suite is red — NOT expected per baseline)
1. READ the failing case's name + assertion message from the suite output (each prints `✗ case <n>: <name> → <msg>`).
2. Route to the requirement + offending function (see mapping above):
   - A/config → file-injector.test.mjs T2.S1-* failing → `readConfig` (file-injector.ts L184-217) or SETTINGS_KEY (L171).
   - B/resolution → relative-imports.test.mjs A*/C* failing → `injectMarkdown` (L838, esp. `dir = path.dirname(abs)` L842)
     or `resolveImportPath` / `expandTildeAndResolve`.
   - C/bare-@ → import-behavior.test.mjs GROUP 2/5 or relative-imports 30-32 failing → `scanTokens` (BARE_AT_RE union,
     prefixLen) or the `bareAt: state.bareAt` threading in injectMarkdown (L849) / injectFiles state init.
3. Apply the MINIMAL fix to file-injector.ts that makes the requirement pass. Re-run the failing suite, then all three.
- **DO NOT weaken tests, delete cases, @ts-ignore, or mock anything** (item §3/§5). These are integration tests
  against the real extension; weakening them defeats the gate.
- **DO NOT** edit PRD.md, README.md, JSDoc, tasks.json, or prd_snapshot.md here (those are T2/doc subtasks).

## Scope boundaries (S1 = this subtask ONLY)
- ❌ typecheck (`npm run typecheck`) = **S2** (separate subtask). S1 is the three TEST suites only.
- ❌ PRD.md "24"→"32" doc fix (Done-definition, PRD.md:1189) = **T2.S1** (downstream; and the system prompt forbids
  modifying PRD.md — it is NOT part of this subtask).
- ❌ README.md / JSDoc coherence audit = **T2.S2 / T2.S3**.
- ❌ No new implementation, no new tests, no new exports, no new files. This is a pure confirmation gate.
- ✅ IF (unexpectedly) a suite is red, the ONLY allowed code change is a minimal fix to file-injector.ts.

## Environment notes
- The suites require the GLOBAL pi package (`@earendil-works/pi-coding-agent`, currently v0.80.x) — the harness
  resolves it via `npm root -g` and loads file-injector.ts via jiti. If a suite fails to LOAD (not a test failure),
  check the global install (the loader throws "Global pi package not found" / a jiti import error, distinct from a
  case failure). That is an environment issue, not a code regression.
- Some tests are environment-sensitive: T2.S1-* captures a GLOBAL_BASELINE to isolate from a dogfooded global
  config; chmod-based tests (E4/E5) skip under root (`process.getuid()===0`). These are pre-existing harness
  behaviors — NOT failures to fix here.
