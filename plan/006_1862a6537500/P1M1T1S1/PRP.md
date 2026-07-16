# PRP — P1.M1.T1.S1 (plan/006): Run all three test suites — confirm 182 passed, 0 failed

> **Scope flag:** This is a **verification gate**, NOT new implementation. The v006 delta introduced three
> requirement-level changes (all ALREADY implemented + tested green): (A) 4-source config merge with trust
> gate, (B) depth-uniform markdown resolution, (C) depth-uniform bare-@ matching. This subtask runs the three
> integration test suites and confirms a total of **182 passed, 0 failed**. If any suite is unexpectedly red,
> apply a **minimal** fix to `file-injector.ts` (never weaken/mock/delete tests). **Scope = S1 ONLY** —
> typecheck is S2; doc fixes are T2 subtasks.

---

## Goal

**Feature Goal:** Confirm the repo satisfies the three §1 v006 delta requirements by running the three
integration test suites in sequence and asserting each prints "X passed, 0 failed" where X totals 182
(file-injector 122 + relative-imports 38 + import-behavior 22).

**Deliverable:** A recorded pass/fail count for each of the three suites + a gate-complete marker (all three
green). No new code, tests, exports, or files. If (unexpectedly) a suite is red, the deliverable additionally
includes the minimal `file-injector.ts` fix that restores green.

**Success Definition:**
1. `node ./file-injector.test.mjs` → `Result: 122 passed, 0 failed.` exit 0.
2. `node ./relative-imports.test.mjs` → `Result: 38 passed, 0 failed` exit 0.
3. `node ./import-behavior.test.mjs` → `Result: 22 passed, 0 failed` exit 0.
4. Combined: **182 passed, 0 failed**. The three §1 requirements (A/B/C) are exercised by these suites.

## Why

- **The v006 delta is "Verification + doc-audit (no new implementation required)."** The three requirement
  changes were introduced in PRD §4.5/§4.6 since session-005 and are already implemented in `file-injector.ts`
  (1114 lines). This subtask is the formal confirmation that the existing integration suites — which exercise
  the real extension via Pi's jiti loader with NO mocking — still pass against the current code.
- **The three suites each pin a different slice of the §1 requirements** (see Context), so a green run is
  direct evidence that (A) the 4-source config merge + trust gate, (B) dirname-based depth-uniform resolution
  with no cwd fallback, and (C) depth-uniform bare-@ (including the first-imported-file asymmetry fix via the
  real handler path) all hold.
- **Integration, not mocks.** The item explicitly forbids mocking (§5) — these suites load the real
  `file-injector.ts`, spin up temp fixtures, and drive `injectFiles` / the real `input` handler. They are the
  authoritative regression gate for the delta.

## What

### The runbook (the whole subtask)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # expect: "Result: 122 passed, 0 failed."   exit 0
node ./relative-imports.test.mjs     # expect: "Result: 38 passed, 0 failed"     exit 0
node ./import-behavior.test.mjs      # expect: "Result: 22 passed, 0 failed"     exit 0
```

Record each suite's count. If all three are green → **gate complete** (total 182). If any is red → follow the
Failure-Diagnosis Protocol below (minimal fix to `file-injector.ts`, then re-run all three).

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `122 passed, 0 failed`, exit 0.
- [ ] `node ./relative-imports.test.mjs` → `38 passed, 0 failed`, exit 0.
- [ ] `node ./import-behavior.test.mjs` → `22 passed, 0 failed`, exit 0.
- [ ] Combined total = **182 passed, 0 failed**.
- [ ] No test was weakened, deleted, `@ts-ignore`d, or mocked (item §3/§5).
- [ ] No changes to PRD.md / README.md / JSDoc / tasks.json / prd_snapshot.md (out of scope).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact three commands, the expected per-suite counts, the requirement→suite→test-case→function mapping (so a
failure routes straight to the offending function), the failure-diagnosis protocol, and the scope boundaries.
The baseline is already confirmed green by research (see below).

### Baseline (CONFIRMED GREEN during research — working tree unmodified)

```
file-injector.test.mjs      → 122 passed, 0 failed
relative-imports.test.mjs   →  38 passed, 0 failed
import-behavior.test.mjs    →  22 passed, 0 failed
                               (182 passed total, 0 failed)
```

All three exit 0. `file-injector.ts` is 1114 lines; the three suites are 2302/508/250 lines (zero-dep Node ESM;
load the real extension via Pi's jiti loader + alias map; spin up temp fixtures; NO mocking).

### Documentation & References

```yaml
# MUST READ — the three §1 requirements, their test coverage, and the prior green confirmation
- file: plan/006_1862a6537500/architecture/system_context.md
  why: "States the delta is 'Verification + doc-audit (no new implementation)', lists the current 182-green
        status, and maps each requirement (A/B/C) to its implementation lines + the tests that cover it. Also
        notes the ONE known stale doc (PRD.md:1189 '24'→'32') — which is a T2 subtask, NOT this one."
  critical: "All three requirements are ALREADY SATISFIED. This subtask is confirmation only. The known stale
             doc (PRD.md) is out of scope (and the system prompt forbids modifying PRD.md)."

# The three suites you run (their headers explain what each pins)
- file: file-injector.test.mjs
  why: "122 cases — the full PRD §11 matrix (#1–#32) + §10 edges + module-surface guard + T2.S1 readConfig
        unit tests (requirement A). Loads file-injector.ts via jiti; drives mod.injectFiles / the real handler."
  pattern: "T2.S1-a…g (L1957+) pin requirement A (4-source config merge + trust gate). GLOBAL_BASELINE (L1972)
            isolates from a dogfooded global config."
- file: relative-imports.test.mjs
  why: "38 cases — pins requirement B (every [#]@path in a delivered markdown resolves to dirname(abs) at every
        depth, NEVER ctx.cwd; a same-named cwd file never wins; a missing-in-dir import never falls back to cwd)."
  pattern: "A7 (L147) + C9 (L336) explicitly assert NO cwd fallback. Also covers PRD §11 #30–#32 (relative
            disambiguation + deep + bare-@ chain)."
- file: import-behavior.test.mjs
  why: "22 cases — pins requirement C (depth-uniform bare-@ under markdownBareAtImports, incl. the first-imported
        file asymmetry fix via the REAL handler path with cfg from LIVE settings, not hardcoded)."
  pattern: "GROUP 2 (bare-@ at every depth) + GROUP 5 (depth-0 first-file bare-@ under the real handler path)."

# The implementation under test (read-only here; edit ONLY if a suite is red)
- file: file-injector.ts
  why: "1114 lines. Requirement A: readConfig (L184-217), SETTINGS_KEY (L171). Requirement B: injectMarkdown
        (L838; `dir = path.dirname(abs)` L842; no ctx.cwd). Requirement C: scanTokens BARE_AT_RE union + prefixLen;
        `bareAt: state.bareAt` threading (injectMarkdown scan call L849)."
  gotcha: "readConfig is EXPORTED and in ASSERTED_EXPORTS (test L142) + the typeof sanity list (L131). If a
           minimal fix touches an export, the module-surface guard at test ~L137 will catch an unlisted function."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # the implementation under test (1114 lines) — UNCHANGED unless a suite is red
├── file-injector.test.mjs    # suite 1 — run it (122 expected)              # UNCHANGED
├── relative-imports.test.mjs # suite 2 — run it (38 expected)               # UNCHANGED
├── import-behavior.test.mjs  # suite 3 — run it (22 expected)               # UNCHANGED
├── package.json              # untouched (has `test` script = file-injector.test.mjs only; S1 runs all three explicitly)
├── scripts/typecheck.mjs     # untouched (typecheck is S2, NOT this subtask)
└── plan/006_1862a6537500/
    ├── architecture/system_context.md     # ← the §1 requirement→test mapping + green confirmation
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — these are INTEGRATION tests; do NOT mock anything (item §5). They load the REAL file-injector.ts
#   via jiti + the global pi package's alias map, and spin up temp fixtures in os.tmpdir(). Weakening/mocking
#   them defeats the gate.

# CRITICAL — if a suite fails to LOAD (jiti/TS import error) vs a CASE failure, diagnose differently:
#   - Load failure ("Global pi package not found" / a jiti import error, before any "case N" line) → environment
#     issue (global @earendil-works/pi-coding-agent not installed). NOT a code regression. Verify: `npm root -g`.
#   - Case failure ("✗ case N: name → msg") → a real regression; use the Failure-Diagnosis Protocol.

# GOTCHA — package.json's `npm test` runs ONLY file-injector.test.mjs. S1 must run ALL THREE explicitly
#   (the commands above), not `npm test`. (S1's contract is the 182-total confirmation.)

# GOTCHA — environment-sensitive pre-existing harness behaviors (NOT failures to fix here):
#   - T2.S1-* captures a GLOBAL_BASELINE (test L1972) to isolate from a dogfooded global config; this is correct,
#     not a bug (Issue 2 from a prior session was already fixed — see system_context).
#   - chmod-based read-error tests (E4/E5) skip under root (`process.getuid()===0`) — a documented guard, not a failure.

# GOTCHA — the typecheck gate (`npm run typecheck`) is S2, a SEPARATE subtask. Do NOT run/typecheck here as part
#   of S1's deliverable (you may run it ad hoc for diagnosis, but it is not S1's gate).
```

## Implementation Blueprint

> There is no implementation. This is the **verification runbook**. The "tasks" are: run each suite, record the
> count, confirm 182 total. (Adapted from the implementation template since this subtask produces no code.)

### Requirement → suite → test-case → function routing (for failure diagnosis)

| §1 Requirement | Suite (expected) | Representative test cases | Implementation function (file-injector.ts) |
|---|---|---|---|
| **A** — 4-source config merge + trust gate (PRD §4.6) | file-injector.test.mjs (122) | T2.S1-a…g (L1957+); readConfig typeof assert L131; ASSERTED_EXPORTS L142 | `readConfig` L184-217; `SETTINGS_KEY` L171 |
| **B** — depth-uniform markdown resolution, no cwd fallback (PRD §4.5 rule 5) | relative-imports.test.mjs (38) | A7 (L147), C9 (L336); A1/A9/C1/C2 | `injectMarkdown` L838 (`dir = path.dirname(abs)` L842); `resolveImportPath`; `expandTildeAndResolve` |
| **C** — depth-uniform bare-@ (PRD §4.6) | import-behavior.test.mjs (22) + relative-imports.test.mjs | import-behavior GROUP 2 + GROUP 5 (real handler path, live settings); relative-imports #30-32 | `scanTokens` (BARE_AT_RE union + prefixLen); `bareAt: state.bareAt` threading in `injectMarkdown` L849 + `injectFiles` state init |

### Failure-Diagnosis Protocol (ONLY if a suite is red — NOT expected per baseline)

```text
1. READ the failing line: "✗ case <N>: <name> → <message>".
2. ROUTE via the table above to the requirement + offending function.
3. APPLY the MINIMAL fix in file-injector.ts that makes the requirement pass.
   - A/config (T2.S1-*)         → readConfig (L184-217): 4-source order, trust gate, SETTINGS_KEY extraction, malformed→{}.
   - B/resolution (A*/C*)       → injectMarkdown (L838): `dir = path.dirname(abs)` L842 must hold at every depth;
                                  NO ctx.cwd reference in resolution; resolveImportPath / expandTildeAndResolve.
   - C/bare-@ (GROUP 2/5, #30-32) → scanTokens BARE_AT_RE union + prefixLen; the `bareAt: state.bareAt` argument
                                  in injectMarkdown's scan call (L849) and injectFiles state init.
4. RE-RUN the failing suite, THEN all three (a fix can't break siblings).
```

### Integration Points

```yaml
NO CHANGES (verification gate): none of these are touched unless a suite is red.
  - DATABASE: none
  - CONFIG: none (readConfig is exercised BY the tests, not changed)
  - ROUTES: none
  - The ONLY file that may change (and only if red) is file-injector.ts, with a minimal fix.
```

### Verification Tasks (ordered)

```yaml
Task 1: RUN file-injector.test.mjs
  - CMD: node ./file-injector.test.mjs
  - EXPECT: "Result: 122 passed, 0 failed.", exit 0.
  - RECORD the count.

Task 2: RUN relative-imports.test.mjs
  - CMD: node ./relative-imports.test.mjs
  - EXPECT: "Result: 38 passed, 0 failed", exit 0.
  - RECORD the count.

Task 3: RUN import-behavior.test.mjs
  - CMD: node ./import-behavior.test.mjs
  - EXPECT: "Result: 22 passed, 0 failed", exit 0.
  - RECORD the count.

Task 4: CONFIRM the total = 182 passed, 0 failed. If all green → GATE COMPLETE.
  - If ANY suite red: run the Failure-Diagnosis Protocol, apply the minimal file-injector.ts fix, re-run all three
    until green. DO NOT weaken/mock/delete tests.

Task 5: CONFIRM scope discipline (no edits leaked)
  - file-injector.ts UNCHANGED (unless a red suite forced a minimal fix);
  - the three .mjs suites UNCHANGED; package.json/scripts/PRD/README/JSDoc/tasks.json/prd_snapshot UNCHANGED;
  - no new exports (the module-surface guard at test ~L137 would catch an unlisted function if a fix touched one).
```

## Validation Loop

### Level 1: The three suites (the entire gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs       # → "Result: 122 passed, 0 failed."   exit 0
node ./relative-imports.test.mjs    # → "Result: 38 passed, 0 failed"     exit 0
node ./import-behavior.test.mjs     # → "Result: 22 passed, 0 failed"     exit 0
# OR chained:
node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs
# Expected: all three print their pass line; final exit 0; combined 182 passed, 0 failed.
```

### Level 2: Per-requirement spot-check (optional — only if you want to confirm A/B/C are each exercised)

```bash
# A — config merge + trust gate (should show T2.S1-* as ✓):
node ./file-injector.test.mjs 2>&1 | grep -E "case T2.S1-|readConfig"
# B — depth-uniform resolution, no cwd fallback (relative-imports A7/C9):
node ./relative-imports.test.mjs 2>&1 | grep -E "A7|C9|cwd fallback"
# C — depth-uniform bare-@ (import-behavior GROUP 2/5):
node ./import-behavior.test.mjs 2>&1 | grep -E "GROUP 2|GROUP 5|bare-@"
```

### Level 3: Load-vs-case failure discrimination (only if a suite is red)

```bash
# A LOAD failure (environment) prints BEFORE any "case N" line and mentions jiti / "Global pi package not found":
npm root -g   # confirm @earendil-works/pi-coding-agent is installed globally
# A CASE failure prints "✗ case N: …" → real regression → use the Failure-Diagnosis Protocol.
```

### Level 4: Re-run after any minimal fix (only if red)

```bash
# After a minimal file-injector.ts fix, re-run ALL THREE (a fix must not break siblings):
node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs
# Expected: 182 passed, 0 failed again. Also run `npm run typecheck` ad hoc to be sure the fix type-checks
# (typecheck is S2's formal gate, but a fix that breaks --strict would also break the jiti load).
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `122 passed, 0 failed`, exit 0.
- [ ] `node ./relative-imports.test.mjs` → `38 passed, 0 failed`, exit 0.
- [ ] `node ./import-behavior.test.mjs` → `22 passed, 0 failed`, exit 0.
- [ ] Combined total = **182 passed, 0 failed**.

### Gate Integrity (the contract)

- [ ] No test weakened, deleted, `@ts-ignore`d, or mocked (item §3/§5).
- [ ] No changes to PRD.md / README.md / JSDoc / tasks.json / prd_snapshot.md.
- [ ] If a fix was needed, it was MINIMAL and confined to `file-injector.ts`; all three suites re-green; no new
      export slipped past the module-surface guard.

### Scope Discipline

- [ ] typecheck (`npm run typecheck`) was NOT treated as this subtask's gate (it is S2).
- [ ] PRD.md "24"→"32" doc fix was NOT applied here (it is T2.S1; and PRD.md is read-only).
- [ ] README/JSDoc coherence audit was NOT done here (T2.S2/T2.S3).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT weaken, delete, `@ts-ignore`, or mock any test** to make a red suite green. These are integration
  tests against the real extension; gaming them defeats the gate (item §3/§5). If red, fix `file-injector.ts`.
- ❌ **Do NOT run only `npm test`.** package.json's `test` script runs ONLY file-injector.test.mjs (122). S1's
  contract is all THREE (182 total) — run them explicitly.
- ❌ **Do NOT conflate a LOAD failure with a CASE failure.** A jiti/"Global pi package not found" error before
  any `case N` line is an environment issue (check `npm root -g`), NOT a code regression. Only `✗ case N:` lines
  are real regressions for the Failure-Diagnosis Protocol.
- ❌ **Do NOT scope-creep typecheck or docs into S1.** `npm run typecheck` is S2; the PRD.md "24"→"32" fix is
  T2.S1 (and PRD.md is read-only); README/JSDoc audit is T2.S2/T2.S3. S1 is the three test suites ONLY.
- ❌ **Do NOT apply a "fix" to the test files.** The suites are the source of truth; the implementation conforms
  to them. If a suite is red, the bug is in `file-injector.ts`.
- ❌ **Do NOT skip re-running all three after a minimal fix.** A fix to one requirement can regress a sibling
  (e.g., a resolution change can affect bare-@ chaining). Always re-run all three.
- ❌ **Do NOT treat environment-sensitive harness guards as failures.** T2.S1-* GLOBAL_BASELINE isolation and the
  E4/E5 root-skip (`process.getuid()===0`) are correct, documented harness behaviors — not regressions to fix.

---

## Confidence Score: 10/10

This is a pure confirmation gate and the baseline is **already verified green** during research (122 + 38 + 22 =
182 passed, 0 failed, working tree unmodified). The executing agent runs three commands, confirms the counts,
and is done — no implementation, no design risk. The only residual is the (unexpected) red-suite branch, which
the Failure-Diagnosis Protocol + the requirement→function routing table make a 5-minute triage. The -0 reflects
that the gate is deterministic and the commands are exact.
