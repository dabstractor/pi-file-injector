---
name: "P1.M3.T1.S1 — Full regression + typecheck gate; confirm no regressions and injectMarkdown still private"
prd_ref: "PRD §11 (Acceptance Criteria & Test Plan — the gate IS the automated sanity-check half of §11), §10 (Edge Cases — exercised by the suite), §12 (Implementation Notes — the invariants the gates enforce), §8 (File Structure — the two gate files)"
target_file: "NONE (gate task — no files are written by default). `file-injector.ts` / `file-injector.test.mjs` are touched ONLY if a gate surfaces a genuine call-site/strictness mismatch (contract item c), and then only as a minimal call-site fix."
target_language: "N/A — this is a verification/runbook task (run two commands, confirm output, diagnose only if a gate is red)."
depends_on: "P1.M1.T1.S1 (scanTokens bareAt?/prefixLen — LANDED) + P1.M1.T2.S1 (readConfig/FileInjectorConfig/.pi fixture/ASSERTED_EXPORTS — LANDED) + P1.M2.T1.S1 (State.bareAt + injectFiles 4th param + top-level bareAt:false + cfg/session_start — LANDED, suite=107) + P1.M2.T2.S1 (injectMarkdown bareAt threading + prefixLen strip + 7 cases — the FINAL predecessor; this gate EXISTS to confirm it landed clean)."
consumed_by: "P1.M3.T2.S1 (README optional bare-@ subsection — docs sweep, gated by this green run); the Definition-of-Done for the entire P1 feature (markdownBareAtImports)."
---

# PRP — P1.M3.T1.S1: Full regression + typecheck gate (Definition-of-Done confirmation)

> **Scope flag:** This is the **VERIFICATION GATE** for the whole P1 feature (`markdownBareAtImports`,
> PRD §4.6). It is NOT a feature build. The default, happy-path deliverable is **two green commands and
> a confirmation** — no file is written. The gate runs the REAL committed `file-injector.ts` (via jiti
> for the suite, via `tsc --strict` for the typecheck) and confirms: (a) the full suite is `0 failed`,
> exit 0; (b) `npm run typecheck` is `0 errors`, exit 0; (c) IF a gate surfaces a genuine call-site or
> strictness mismatch, fix the **offending call site** (never weaken strictness); (d) the module-surface
> guard still holds — `readConfig` recognized, `injectMarkdown` still PRIVATE. **Mock nothing.**

---

## Goal

**Feature Goal:** Prove the complete P1 feature (P1.M1 + P1.M2 — the `markdownBareAtImports` opt-in:
config → `scanTokens` bare-@ engine → `processTokenStream`/`State.bareAt` threading → `injectMarkdown`
wiring) ships GREEN: no test regressions, no type errors, and the module-surface invariants intact.
This is the **Definition-of-Done** gate for the implementation phase.

**Deliverable:** Two green gate runs —
1. `node ./file-injector.test.mjs` → exit `0`, summary line `Result: 114 passed, 0 failed.`
   (92 core + 6 M1.T1.S1 + 4 M1.T2.S1 + 5 M2.T1.S1 + 7 M2.T2.S1; the load-bearing part is `0 failed` + exit 0).
2. `npm run typecheck` → exit `0`, stderr line
   `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`.
— plus the embedded module-surface confirmation (both run as the FIRST assertions of the suite): `readConfig`
is a recognized export and `injectMarkdown` is **NOT** exported. **No file is written in the happy path.**
Source is touched ONLY if a gate is red AND the red is a genuine call-site/strictness mismatch; then the
fix is a minimal call-site edit (contract item c), never a strictness relaxation.

**Success Definition:**
1. Both gates exit 0 with the exact success strings above.
2. The suite's module-surface sanity block passes (readConfig recognized; ASSERTED_EXPORTS complete;
   `mod.injectMarkdown === undefined`).
3. No pre-existing case (1-24, MD1/2, EDG-1..4, the T1/T2/M2.T1 banners) regressed — i.e. the byte-for-byte
   default (bare-@ off) is preserved.
4. IF any gate was red on first run, the resolution was a **call-site / source fix** (documented), NOT a
   strictness/test/guard weakening.

## User Persona

**Target User:** The **Pi extension maintainer** (the human who will merge the P1 feature). This gate is
their confidence checkpoint: "the whole bare-@ feature lands without breaking anything and without leaking
`injectMarkdown` into the public module surface." They run these exact two commands in CI / before merge.

**Use Case:** Before declaring P1 "implementation complete" and handing off to the docs task (P1.M3.T2.S1),
the maintainer runs the gate. A green gate = "ship it"; a red gate = a concrete diagnostic (case name /
TS error line) pointing at which predecessor subtask has a bug.

**User Journey:** maintainer → `npm run typecheck` (green) → `node ./file-injector.test.mjs` (green) → reads
`Result: 114 passed, 0 failed.` → confirms the sanity lines ran (no "injectMarkdown must NOT be exported"
failure) → declares P1 implementation Done.

**Pain Points Addressed:** Without this gate, the four predecessor subtasks (each independently green at
107→114) could still interact badly — e.g. an `injectMarkdown` `export` leak, a `bareAt` opt dropped from a
call site, or a byte-for-byte-default violation. This gate is the single command that catches all three.

## Why

- **It IS the acceptance contract.** PRD §11 splits into a "Manual test matrix" (live model cases, not
  automated) and an "Automated sanity check." The `.mjs` suite IS the automated sanity check; `npm run
  typecheck` IS the §12 strictness contract. A green pair is literally the PRD's Definition-of-Done.
- **Catches cross-subtask interaction bugs the per-subtask suites cannot.** Each predecessor runs only its
  OWN new cases on top of a snapshot. Only THIS gate runs the FULL accumulated suite (114 cases) after every
  predecessor landed, so it's the only place that detects (a) a regression in an earlier subtask's case caused
  by a later subtask's edit, or (b) a module-surface drift (`injectMarkdown` exported, a new helper unnamed).
- **The module-surface invariant is non-negotiable.** `injectMarkdown` is a PRIVATE recursion driver
  (PRD §5.6, §8 internal-section #5 — it is called only by `injectFile`, never a public API). If any
  predecessor accidentally `export`ed it (e.g. to "make a test easier"), the privacy assert fails HERE —
  and the fix is to un-export, not to bless the leak. The guard is the only automated enforcement.
- **No docs surface.** This is purely a confirmation; it has nothing user-facing (contract item 5: "gate
  confirmation has no user-facing surface"). It unblocks P1.M3.T2.S1 (README) and closes the implementation.

## What

No user-visible change. No code change in the happy path. The gate agent:
1. Runs `npm run typecheck`; confirms exit 0 + the success line.
2. Runs `node ./file-injector.test.mjs`; confirms exit 0 + `0 failed` + the expected count.
3. Confirms (via the suite's own sanity block having run without failure) that `readConfig` is exported and
   `injectMarkdown` is **not**.
4. **Only if** a gate is red AND the red is a genuine call-site/type mismatch: applies the minimal call-site
   fix from the diagnostic decision tree below (never weakens strictness / never skips a test / never mocks),
   then re-runs the red gate.

### Success Criteria

- [ ] `npm run typecheck` → exit 0; stderr contains `type-checks clean under --strict (0 errors)`.
- [ ] `node ./file-injector.test.mjs` → exit 0; final line `Result: 114 passed, 0 failed.` (load-bearing: `0 failed`).
- [ ] Module-surface sanity block passed (no `"module ships functions not in the sanity list"`, no
      `"injectMarkdown must NOT be exported"`, `readConfig` typeof-function assert held) — evidenced by the
      suite reaching its case matrix + summary line at all (the sanity block fails fast before the matrix).
- [ ] No pre-existing case (1-24 / MD1 / MD2 / EDG-1..4 / T1.S1 / T2.S1 / M2.T1.S1) flipped to ✗.
- [ ] IF any gate needed a fix: the fix was a documented call-site/source edit; no `@ts-ignore`, no `as any`,
      no opts-type/`strict`/`skipLibCheck` relaxation, no skipped/relaxed test, no edited guard.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to run this gate and
diagnose a red?_ **Yes.** This PRP includes: the exact two commands + their exact success strings (verified
by direct execution during research), the mechanism of each gate (jiti-imports-real-source / tsc-temp-tsconfig),
the precise module-surface guard location + the two privacy assertions it enforces, the full TS-error → real-fix
map for the `bareAt` opt (which call sites, which lines, which edits — and the forbidden weakenings), the
test-failure diagnostic tree keyed to case names/banners, the current verified snapshot (typecheck 0 errors,
suite 107/0, source already carries every M2.T2.S1 edit), and the hard constraints (mock nothing, never weaken).
The gate agent runs two commands; if green, they are done; if red, they follow the named diagnostic to a
named file/line fix and re-run.

### Documentation & References

```yaml
# MUST READ — the gate commands + the per-subtask test-count arithmetic + the module-surface guard
- file: plan/005_b7c78dbf73b1/architecture/system_context.md
  why: "States the two gates verbatim: `node ./file-injector.test.mjs` (exits 0/1) and
        `scripts/typecheck.mjs` (prints the clean-strict line). Confirms the suite is at 92 baseline and
        that the module-surface guard (`ASSERTED_EXPORTS`) REQUIRES a new export like readConfig to be
        added or the gate fails — already done in M1.T2.S1, this gate CONFIRMS it."
  critical: "The guard: 'every shipped function is named — a new export like readConfig MUST be added to
             it or the gate fails.' + 'injectMarkdown ... MUST NOT be exported.' Both are assertions IN the
             suite; this gate task does NOT edit them, only confirms they still pass."

# MUST READ — the exact function-level change set this gate is confirming (so a red diagnosis maps to the right predecessor)
- file: plan/005_b7c78dbf73b1/architecture/codebase_delta.md
  why: "§5 (scanTokens bareAt?/prefixLen), §6 (processTokenStream bareAt — required), §7 (injectFiles
        State.bareAt + top-level bareAt:false), §8 (injectMarkdown bareAt:state.bareAt + injectable prefixLen
        + Step-4 +r.prefixLen), §10 (the ASSERTED_EXPORTS += readConfig guard). A TS error or test failure
        maps to one of these sections → the predecessor that owns it."
  section: "## 5–8 (the bareAt/prefixLen wiring) + ## 10 (module-surface guard)"

# The PREDECESSOR PRPs — the contracts whose landing this gate confirms (read for diagnostics, not to re-do)
- file: plan/005_b7c78dbf73b1/P1M2T2S1/PRP.md
  why: "The FINAL implementation predecessor (injectMarkdown wiring + 7 cases #25-28 + §10 e/f/g). Its
        'Validation Loop' Level 2/3 is the diagnostic dictionary for any #25-28 failure or any TS error at
        injectMarkdown. Its anti-patterns (do NOT export injectMarkdown; do NOT keep Step-4 as +2; do NOT
        pass bareAt:true in the scan call) are exactly what this gate catches. Suite expected 107 → 114."
- file: plan/005_b7c78dbf73b1/P1M2T1S1/PRP.md
  why: "Owns State.bareAt + injectFiles 4th param + top-level bareAt:false + cfg/session_start. A TS error
        'Property bareAt does not exist on State' or a #28 top-level-exclusion failure points here."
- file: plan/005_b7c78dbf73b1/P1M1T2S1/PRP.md
  why: "Owns readConfig + ASSERTED_EXPORTS guard update. A sanity-assert failure 'mod.readConfig must be a
        function' or 'module ships functions not in the sanity list: readConfig' points here."
- file: plan/005_b7c78dbf73b1/P1M1T1S1/PRP.md
  why: "Owns scanTokens bareAt?/prefixLen + BARE_AT_RE. A #27 double-match failure or a BARE_AT_RE mid-word
        failure (#email) points here (re-run its T1.S1-8..13 unit cases)."

# The gate files themselves (read to know exactly what success looks like — do NOT edit)
- file: scripts/typecheck.mjs
  why: "`npm run typecheck` runs THIS (package.json scripts.typecheck). It resolves the global pi .d.ts,
        writes a temp tsconfig (strict:true, skipLibCheck:true), runs `tsc -p <tmp> --listFiles`. On success
        prints to STDERR: 'typecheck: file-injector.ts type-checks clean under --strict (0 errors)'; on TS
        error sets process.exitCode=1 (no success line). Success ⟺ exit 0 ⟺ success line present."
  gotcha: "The success message goes to STDERR (console.error), so `2>&1 | grep` or checking exit code is
           the reliable signal — do NOT grep stdout alone."
- file: file-injector.test.mjs
  why: "Gate A. Sanity block L131-154 runs FIRST (fails fast): L131 readConfig typeof-function assert;
        L138-142 ASSERTED_EXPORTS (19, incl. readConfig); L144 PURE_HELPERS_NOT_ASSERTED (3); L145-150
        completeness assert; L152-153 injectMarkdown-NOT-exported privacy assert. Then the case matrix;
        then the summary line 'Result: <N> passed, <M> failed.' Exits 0 iff M===0."
  pattern: "Look for the banner BEFORE '10. Summary' for the P1.M2.T2.S1 cases (#25/#26/#27/#28 +
            M2.T2.S1-e/f/g). Their ✓ rows prove the injectMarkdown wiring landed."

# The source under test (read for diagnostics; edit ONLY if a gate is red with a call-site mismatch)
- file: file-injector.ts
  why: "~1010 lines. The exports this gate's sanity block must account for (grep ^export → 21 named + default).
        injectMarkdown L693 is `async function` with NO `export` (PRIVATE). scanTokens L476 opts bareAt?
        (OPTIONAL). processTokenStream L528 opts bareAt (REQUIRED). injectFiles L740 sig + L799 top-level
        processTokenStream(bareAt:false). injectMarkdown L705 scan call (bareAt:state.bareAt); L725
        injectable {index;prefixLen;abs}[]; L737 Step-4 slice(r.index+r.prefixLen)."
  gotcha: "scanTokens.bareAt is OPTIONAL by design (so any call site — passing bareAt or not — compiles).
           processTokenStream.bareAt is REQUIRED (its only caller, the injectFiles top-level scan, passes
           bareAt:false). This asymmetry is intentional and is why the typecheck is green; do not 'normalize' it."

# PRD — the acceptance contract this gate implements
- file: PRD.md
  why: "§11 is the test plan (the .mjs suite automates its structural rows). §12 are the invariants the
        typecheck + suite enforce (loop prevention, never-throw, dedup-bounded recursion, strip-resolved-markers).
        §8 defines the file structure (the two gate files)."
  section: "## 11 (Acceptance Criteria & Test Plan) + ## 12 (Implementation Notes & Gotchas) + ## 8 (File Structure)"
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # UNDER TEST — read for diagnostics; edit ONLY on a red-gate call-site fix
├── file-injector.test.mjs    # GATE A — run as-is; the sanity block L131-154 is the module-surface guard
├── scripts/typecheck.mjs     # GATE B — run as-is (`npm run typecheck`); emits the strict-success line to stderr
├── package.json              # scripts: { typecheck: 'node ./scripts/typecheck.mjs', test: 'node ./file-injector.test.mjs' }
├── tsconfig.json             # editor/LSP hints only — typecheck.mjs writes its OWN temp tsconfig; NOT run by tsc directly
├── PRD.md / README.md        # read-only (README = P1.M3.T2.S1, AFTER this green gate)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{system_context.md, codebase_delta.md, api_verification.md}
    └── P1M?T?S?/{research, PRP.md}   # the four predecessor PRPs (M1.T1/M1.T2/M2.T1/M2.T2) + this one
```

### Desired Codebase tree (files touched by THIS task)

```bash
# HAPPY PATH (expected — both gates already green on the research snapshot):
#   (no files touched)

# ONLY IF a gate is red with a genuine call-site/type mismatch (contract item c):
file-injector.ts          # MINIMAL call-site fix (e.g. add `bareAt: false` to a processTokenStream call,
                          #   widen an `injectable` annotation, restore a dropped `bareAt` opt on a callee).
                          #   NEVER: @ts-ignore, as any, opts-type relaxation, strict/skipLibCheck toggle.
# (Do NOT touch file-injector.test.mjs, scripts/typecheck.mjs, package.json, tsconfig.json, ASSERTED_EXPORTS,
#  PRD.md, README.md, or any plan/ file. Do NOT add tests. Do NOT add docs. Do NOT export injectMarkdown.)
```

### Known Gotchas of our codebase & Gate Quirks

```ts
// CRITICAL — this is a GATE task, not a build. The default output is two green commands + a confirmation,
//   and ZERO files written. Source edits happen ONLY if a gate prints a concrete TS error or a test ✗ that
//   maps to a call-site/strictness mismatch (contract item c). If you find yourself "fixing" green gates or
//   refactoring to "improve" things, STOP — you are out of scope. Run, confirm, report.

// CRITICAL — Mock NOTHING. Gate A imports the REAL committed file-injector.ts through Pi's own jiti loader
//   (resolve global pi via `npm root -g`, alias @earendil-works/*, jiti.import the real path). Gate B runs
//   real tsc --strict against the real file. Do NOT stub jiti, override PIPKG, `git stash`/`checkout` the
//   source to "reset", or point the temp tsconfig elsewhere. (Contract item 3: "Mock nothing.")

// CRITICAL — the typecheck success line goes to STDERR (scripts/typecheck.mjs uses console.error). So
//   `npm run typecheck` prints the clean message on stderr and exits 0; a TS error sets exitCode=1 with NO
//   success line. Reliable signal = exit code 0 AND (stderr) `type-checks clean under --strict (0 errors)`.
//   Do NOT grep stdout alone (it's the --listFiles spew).

// CRITICAL — never WEAKEN strictness to clear Gate B. Forbidden: `// @ts-ignore` / `// @ts-expect-error`;
//   `as any` / `as unknown as X`; flipping `bareAt: boolean` (required, processTokenStream) → `bareAt?` merely
//   to silence an omitting call site; removing `bareAt` from a callee opts type to "fix" a call; toggling
//   `strict:false` or `skipLibCheck` in the temp tsconfig (typecheck.mjs) or tsconfig.json. The contract is
//   explicit (item c): "fix the offending call site — do NOT weaken strictness."

// CRITICAL — never WEAKEN Gate A to clear a red suite. Forbidden: skipping/commmenting-out a case; relaxing
//   an assertion (e.g. loosening `===` to `>=` or an includes check); editing ASSERTED_EXPORTS to bless an
//   accidentally-exported injectMarkdown (instead, REMOVE the `export` from injectMarkdown). A red suite is a
//   REAL bug or regression — diagnose it via the tree below, do not mask it.

// GOTCHA — the bareAt opt asymmetry is INTENTIONAL and load-bearing for the green typecheck:
//   - scanTokens opts: { allowAbsTilde; skipCode; tryMdExt; bareAt?: boolean }   ← OPTIONAL (bareAt?)
//     → ANY scanTokens call site compiles whether or not it passes bareAt. Two production callers:
//       (1) injectMarkdown Step 3 (passes bareAt: state.bareAt); (2) injectFiles top-level (via
//       processTokenStream, which passes bareAt:false). Plus T1.S1-8..13 unit tests call it directly.
//   - processTokenStream opts: { allowAbsTilde; skipCode; tryMdExt; bareAt: boolean }   ← REQUIRED (bareAt)
//     → its ONLY caller is the injectFiles top-level scan, which passes bareAt:false (§4.6 top-level is
//       #@-only). If Gate B ever reports "Property 'bareAt' is missing" at that call, the fix is to ADD
//       bareAt:false to the call (NOT to make processTokenStream's bareAt optional).
//   Do NOT "normalize" the two to match — the optionality difference is deliberate (scanTokens is the
//   general engine reused by tests without bareAt; processTokenStream is the single top-level choke point).

// GOTCHA — injectMarkdown PRIVACY is the headline invariant of this gate (contract item d). It is declared
//   `async function injectMarkdown(...)` at L693 with NO `export`. The suite asserts `typeof mod.injectMarkdown
//   === "undefined"`. If a predecessor exported it to ease a test, Gate A fails with "injectMarkdown must NOT
//   be exported" — the fix is to DELETE the `export` keyword (and re-route any test that relied on it through
//   injectFiles, which is how cases 15-24 + #25-28 already exercise it). NEVER add it to ASSERTED_EXPORTS.

// GOTCHA — the suite's sanity block runs BEFORE the case matrix and fails FAST. So if you see NO summary line
//   ("Result: …") at all, a sanity assertion failed (read the printed assert message: it names exactly which
//   export is unaccounted-for or whether injectMarkdown leaked). If you DO see a summary line with M>0 failed,
//   the failure is in the matrix (a named case row printed ✗ with detail).

// GOTCHA — the passing count is informational; the load-bearing contract is `0 failed` + exit 0. Expected 114
//   = 92 core + 6 (M1.T1.S1) + 4 (M1.T2.S1) + 5 (M2.T1.S1) + 7 (M2.T2.S1). If the count differs but M===0,
//   reconcile each predecessor's declared case count; a LOWER count means a predecessor dropped a case (a
//   regression in that predecessor — report it; do not silently accept).
```

## Implementation Blueprint

> **There is no "data model" and no "new files" for a gate task.** The blueprint below is the
> **verification runbook** (ordered steps) + the **diagnostic decision trees** for a red gate.

### Verification Runbook (ordered by dependencies)

```yaml
Step 0: PRECONDITION CHECK (cheap, prevents a misleading red)
  - CONFIRM every predecessor is LANDED: P1.M1.T1.S1, P1.M1.T2.S1, P1.M2.T1.S1, P1.M2.T2.S1 (the gate
    EXISTS to confirm M2.T2.S1 landed clean; if M2.T2.S1's source/test edits are visibly absent, that is a
    PLAN error, not a gate failure — escalate, do not "implement M2.T2.S1 yourself").
  - CONFIRM cwd is the repo root (file-injector.ts is present). Both gates resolve relative to it.
  - CONFIRM the global pi package is installed: `npm root -g` → .../@earendil-works/pi-coding-agent with
    dist/index.d.ts present (both gates resolve it; if missing, the gate ERRORS out clearly — that is an
    environment issue, not a code regression).

Step 1: GATE B — typecheck (run FIRST — it's faster and isolates type issues from behavior)
  - RUN: `npm run typecheck`
  - EXPECT: exit 0; stderr ends with: `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`
  - IF GREEN → proceed to Step 2.
  - IF RED → apply the Gate-B diagnostic decision tree (below); fix the OFFENDING CALL SITE; re-run; loop
    until green. (Contract item c: never weaken strictness.)

Step 2: GATE A — full regression suite (incl. the module-surface guard)
  - RUN: `node ./file-injector.test.mjs`
  - EXPECT: exit 0; final line `Result: 114 passed, 0 failed.`; no ✗ rows in the matrix.
  - IF GREEN → the module-surface guard passed (the sanity block ran before the matrix; reaching the summary
    line means readConfig-recognized + ASSERTED_EXPORTS-complete + injectMarkdown-private all held). Proceed to Step 3.
  - IF RED → apply the Gate-A diagnostic decision tree (below); fix the ROOT CAUSE (call site / source /
    predecessor wiring); re-run; loop until green. (Never skip/relax a test; never mock; never bless an
    injectMarkdown export.)

Step 3: MODULE-SURFACE CONFIRMATION (read out of the green Step 2 — no separate command)
  - The suite's sanity block (file-injector.test.mjs L131-154) already asserted:
      (i)  `typeof mod.readConfig === "function"`   (readConfig IS a recognized export — M1.T2.S1 landed)
      (ii) ASSERTED_EXPORTS completeness             (no shipped function is unnamed)
      (iii)`typeof mod.injectMarkdown === "undefined"` (injectMarkdown is PRIVATE — the headline invariant)
  - A green Step 2 = all three held. State this explicitly in the report. (No ASSERTED_EXPORTS edit by this task.)

Step 4: REPORT (the deliverable is the confirmation, not a file)
  - State: Gate B green (0 errors), Gate A green (114 passed, 0 failed), module-surface intact (readConfig
    exported, injectMarkdown private). Note ANY call-site fix applied (file + line + one-line reason) if a
    gate was red on first run. This is the Definition-of-Done for the P1 implementation phase.
```

### Gate-B diagnostic decision tree (typecheck red → call-site fix, never weaken strictness)

```ts
// The success line `type-checks clean under --strict (0 errors)` is ALREADY green on the research snapshot.
// A red Gate B here means a predecessor landed incompletely OR a stray edit. Find the named site in the
// tsc output (file:line) and apply the REAL fix. tsconfig/ts strictness is NEVER the thing you change.

// 1) "Property 'bareAt' is missing in type '{ allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; }'
//    but required in type '{ ...; bareAt: boolean; }'"  →  at the injectFiles TOP-LEVEL processTokenStream call.
//    FIX: add `bareAt: false` to that opts literal (§4.6 — top-level is #@-only). DO NOT make processTokenStream's
//    bareAt optional to silence it (that weakens the choke-point type).
//
// 2) "Property 'prefixLen' does not exist on type '{ index: number; abs: string; }'"  →  at injectMarkdown
//    Step 4 (`stripped.slice(r.index + r.prefixLen)`), because the Step 3.5 `injectable` annotation wasn't widened.
//    FIX: widen `const injectable: { index: number; prefixLen: number; abs: string }[] = [];` (the filter body
//    `injectable.push(r)` is UNCHANGED — r already carries prefixLen from scanTokens). DO NOT cast r to any.
//
// 3) "Property 'bareAt' does not exist on type '{ allowAbsTilde; skipCode; tryMdExt; bareAt?: boolean }'"
//    (i.e. a scanTokens call passes bareAt but the callee lost it)  →  a scanTokens opts type regression.
//    FIX: restore `bareAt?: boolean` in the scanTokens opts type (L479). DO NOT delete `bareAt:` from the call.
//
// 4) "Property 'bareAt' does not exist on type 'State'"  →  at any `state.bareAt` read (injectMarkdown scan call).
//    FIX: restore `bareAt: boolean;` in `interface State` (M2.T1.S1). DO NOT cast state.
//
// 5) Any "Argument of type 'X' is not assignable to parameter of type 'Y'" at a scanTokens/processTokenStream/
//    injectFile/injectMarkdown call  →  a call-site shape drift. FIX the call site to match the callee's type.
//
// After ANY fix: re-run `npm run typecheck`; it must print the success line and exit 0 BEFORE you touch Gate A.
// ALL of these are minimal, surgical call-site/type edits. NONE weaken strictness.
```

### Gate-A diagnostic decision tree (suite red → root-cause fix, never skip/relax/mock)

```ts
// NO summary line printed (suite died in the sanity block L131-154)  →  read the assert message:
//   - "mod.readConfig must be a function"               → readConfig lost its `export`. RESTORE `export` on
//     readConfig (it's a §4.6 public API + unit-tested directly in T2.S1-a..d). (M1.T2.S1 lane.)
//   - "module ships functions not in the sanity list: <name>" → <name> was exported without a guard entry.
//     If <name> is a legitimate new public API → add it to ASSERTED_EXPORTS. If it's a pure helper tested
//     indirectly → add to PURE_HELPERS_NOT_ASSERTED. If it's injectMarkdown → REMOVE the export (see below).
//   - "injectMarkdown must NOT be exported"             → injectMarkdown got an `export` keyword. REMOVE it
//     (L693 → `async function injectMarkdown(...)`). Re-route any test that imported it through injectFiles
//     (the established pattern for cases 15-28). NEVER add injectMarkdown to ASSERTED_EXPORTS.
//
// Summary line present with `M failed` > 0  →  read each ✗ row's name + detail:
//   - A #25-28 / "M2.T2.S1-e/f/g" row ✗   →  the injectMarkdown wiring (M2.T2.S1 lane). Cross-reference
//     P1M2T2S1/PRP.md 'Validation Loop' Level 3 for the exact symptom→cause map (e.g. #26 ✗ "pi.md" →
//     Step-4 still `+ 2`; #28 ✗ injected=1 → top-level scan passed bareAt:true, an M2.T1.S1 bug).
//   - A #1-24 / MD1 / MD2 / EDG-1..4 / T1.S1 / T2.S1 / M2.T1.S1 row FLIPPED  →  a REGRESSION: the byte-for-byte
//     default (bareAt off) changed behavior. Re-check injectMarkdown Step 3 passes `bareAt: state.bareAt`
//     (NOT `bareAt: true`) and Step 4 uses `+ r.prefixLen` (every default record has prefixLen 2 → `+ 2`).
//   - Summary count ≠ 114 but `0 failed`  →  a predecessor added/dropped a different number of cases;
//     reconcile against each predecessor's declared count. Report the discrepancy (do not silently accept).
//
// After ANY fix: re-run `node ./file-injector.test.mjs`; it must print `Result: 114 passed, 0 failed.` and
// exit 0. NEVER skip a case (`//`), relax an assertion, or mock jiti/PIPKG to force green.
```

### Integration Points

```yaml
GATES (run as-is — DO NOT edit):
  - node ./file-injector.test.mjs        # Gate A: suite + module-surface guard (sanity block L131-154)
  - npm run typecheck                    # Gate B: tsc --strict (wrapper scripts/typecheck.mjs)

SOURCE (edit ONLY on a red-gate call-site fix — contract item c):
  - file-injector.ts                     # minimal call-site fix per the diagnostic tree (never weaken strictness)

NO_CHANGES (the entire happy path + the constraints):
  - file-injector.test.mjs               # the gate itself — never edit to force green
  - scripts/typecheck.mjs                # the gate itself — never edit strictness/tsconfig
  - package.json / tsconfig.json         # never edit scripts or compilerOptions
  - ASSERTED_EXPORTS / PURE_HELPERS_NOT_ASSERTED  # never bless an injectMarkdown export via the guard
  - PRD.md / README.md / plan/**         # read-only (README = P1.M3.T2.S1, after this green gate)
  - no new files, no new tests, no new docs, no new exports
```

## Validation Loop

> For a gate task, the Validation Loop **is** the deliverable. There is no "Level 1/2/3" separation — the
> two commands below ARE levels 1 (type) and 2 (regression), and the module-surface guard is folded into
> level 2. Run them in order; both must be green.

### Level 1 + 2: The two gates (run in order)

```bash
cd /home/dustin/projects/pi-file-injector

# ── Gate B (typecheck) — run FIRST ──
npm run typecheck
# Expected: exit 0; the LAST stderr line is:
#   typecheck: file-injector.ts type-checks clean under --strict (0 errors)
# (success line is on STDERR — `echo $?` === 0 is the reliable signal; stdout is the --listFiles spew)
# If RED: apply the Gate-B diagnostic tree; fix the CALL SITE; re-run. Never weaken strictness.

# ── Gate A (regression + module-surface guard) ──
node ./file-injector.test.mjs
# Expected: exit 0; the FINAL stdout line is:
#   Result: 114 passed, 0 failed.
# and every matrix row printed ✓ (no ✗). The sanity block (readConfig/exported/injectMarkdown-private)
# ran BEFORE the matrix, so reaching the summary line means all three invariants held.
# If RED: apply the Gate-A diagnostic tree; fix the ROOT CAUSE; re-run. Never skip/relax/mock.
```

### Level 3: Module-surface confirmation (derived from a green Gate A — no extra command)

```bash
# A green Gate A already proves the sanity block passed. To make the readout explicit (optional):
node ./file-injector.test.mjs 2>&1 | grep -iE "readConfig|injectMarkdown|sanity|Result:"
# Expected: NO "must be a function"/"must NOT be exported"/"not in the sanity list" lines; the only
# match is `Result: 114 passed, 0 failed.` (the sanity asserts are silent on success).
#
# Equivalently, confirm the source invariant directly (read-only sanity — NOT a substitute for the gate):
grep -n "^export.*injectMarkdown\|^async function injectMarkdown\|^function injectMarkdown" file-injector.ts
# Expected: ONLY `693:async function injectMarkdown(...)` — NO `export` prefix. (Privacy confirmed in source.)
```

### Level 4: Targeted spot-checks IF a gate was red and you applied a fix

```bash
# After a Gate-B call-site fix, prove the specific predecessor wiring still holds (re-run the predecessor's
# own targeted cases so you don't accidentally break a different predecessor while fixing this one):
node ./file-injector.test.mjs 2>&1 | grep -iE "#2[5-8]|M2.T2.S1-[efg]|M2.T1.S1-|T2.S1-|T1.S1-1[0-3]|Result:"
# Expected: all predecessor-case rows ✓; `Result: 114 passed, 0 failed.`
#
# If you fixed an injectMarkdown-export leak, re-confirm privacy at the source (must have NO `export`):
grep -n "function injectMarkdown" file-injector.ts
# Expected: `async function injectMarkdown` with no leading `export`.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → exit 0; stderr `type-checks clean under --strict (0 errors)`.
- [ ] `node ./file-injector.test.mjs` → exit 0; `Result: 114 passed, 0 failed.` (load-bearing: `0 failed`).
- [ ] No ✗ rows in the matrix; no sanity-block assert message printed.
- [ ] Module-surface intact: `readConfig` exported; `injectMarkdown` NOT exported; ASSERTED_EXPORTS complete.

### Gate Integrity (the load-bearing constraints)

- [ ] Mocked NOTHING — both gates ran against the REAL committed `file-injector.ts` (real jiti import; real tsc).
- [ ] Weakened NO strictness — no `@ts-ignore`/`@ts-expect-error`, no `as any`, no opts-type relaxation,
      no `strict`/`skipLibCheck` toggle in typecheck.mjs/tsconfig.json.
- [ ] Skipped/relaxed NO test — no commented-out cases, no loosened assertions, no ASSERTED_EXPORTS edit to
      bless an `injectMarkdown` export.
- [ ] Edited NO gate file — `scripts/typecheck.mjs`, the test harness sanity block, `package.json`,
      `tsconfig.json` are byte-for-byte unchanged.
- [ ] IF a fix was applied: it was a documented, minimal CALL-SITE/SOURCE edit (file + line + reason), and
      both gates were re-run green afterward.

### Feature Validation (the P1 implementation this gate confirms)

- [ ] No pre-existing case (1-24 / MD1 / MD2 / EDG-1..4 / T1.S1 / T2.S1 / M2.T1.S1) regressed.
- [ ] The P1.M2.T2.S1 cases (#25-28 + M2.T2.S1-e/f/g) all ✓ — the injectMarkdown bare-@ wiring landed.
- [ ] The byte-for-byte default (bare-@ off) is preserved (the green full suite IS the proof).

### Scope Discipline

- [ ] Added NO new files, NO new tests, NO new exports, NO docs (README = P1.M3.T2.S1).
- [ ] Did NOT implement/re-implement any predecessor subtask (if a predecessor is genuinely incomplete,
      that is a PLAN error — escalated, not patched by the gate agent).

### Documentation

- [ ] The confirmation report states: Gate B green, Gate A green (114/0), module-surface intact, and (if
      applicable) the one-line call-site fix that cleared a red gate. (No user-facing docs — contract item 5.)

---

## Anti-Patterns to Avoid

- ❌ **Do NOT mock, stub, or "reset" anything.** Run the REAL gates against the REAL committed source. No
  jiti stubs, no `PIPKG` override, no `git stash`/`checkout` to "get back to green." (Contract: mock nothing.)
- ❌ **Do NOT weaken strictness to clear a red typecheck.** No `@ts-ignore`/`@ts-expect-error`, no `as any`,
  no flipping `bareAt: boolean`→`bareAt?` to silence a call site, no removing `bareAt` from a callee opts
  type, no `strict:false`/`skipLibCheck` toggle. Fix the OFFENDING CALL SITE. (Contract item c.)
- ❌ **Do NOT skip/relax a test to clear a red suite.** No commenting-out cases, no loosening `===`/includes
  assertions, no editing ASSERTED_EXPORTS to bless an `injectMarkdown` export (REMOVE the export instead).
  A red suite is a real bug — diagnose it, don't mask it.
- ❌ **Do NOT edit the gate files.** `scripts/typecheck.mjs`, the test harness sanity block, `package.json`,
  `tsconfig.json` are the gauges, not the work. Changing a gauge to force green is the cardinal gate sin.
- ❌ **Do NOT "improve" or refactor green gates.** This is a confirmation task. If both gates are already
  green (the expected state), the deliverable is the confirmation — not a refactor, not "extra" tests, not
  a README tweak. Out-of-scope edits are how regressions are introduced into a clean tree.
- ❌ **Do NOT re-implement a predecessor subtask.** If a gate is red because a predecessor (M1.T1/M1.T2/
  M2.T1/M2.T2) is genuinely incomplete or wrong, that is a PLAN error — escalate it to the orchestrator,
  do not silently absorb the predecessor's scope into this gate task.
- ❌ **Do NOT export `injectMarkdown` (or add it to ASSERTED_EXPORTS) under any circumstance.** It is a
  PRIVATE recursion driver (PRD §5.6/§8). The privacy assert is the headline invariant of THIS gate. If a
  test "needs" it, the test is wrong — re-route through `injectFiles` (cases 15-28 already do).

---

## Confidence Score: 9/10

This is the most deterministic task in the plan: run two known commands, match two known success strings,
confirm two module-surface invariants. Both gates are GREEN on the research snapshot (typecheck 0 errors;
suite 107/0 failed — and the source ALREADY carries every `injectMarkdown` edit M2.T2.S1 specifies, so once
M2.T2.S1's 7 test cases land the suite is 114/0). The module-surface guard already includes `readConfig`
(M1.T2.S1) and `injectMarkdown` is already source-private — both confirmed by `grep`. The -1 reserves for
the one genuine open variable this gate EXISTS to answer: "did M2.T2.S1 land cleanly end-to-end?" — which
is resolved by simply running the gates. The PRP's load-bearing content is the diagnostic decision trees
(Gate-B TS-error → real call-site fix; Gate-A red → root-cause by case/banner), which are exactly what
contract item (c) requires the gate agent to handle if a gate is NOT green. The implementing agent runs two
commands; if green, reports Done; if red, follows the named diagnostic to a named file/line minimal fix and
re-runs. No file is written in the happy path.
