---
name: "P1.M3.T1.S1 (bugfix 001_a4cee0dcf39c) — Update package.json test script to chain all three harnesses"
prd_ref: "bugfix PRD §h2.4 (Testing Summary — 'consider wiring [import-behavior.test.mjs] in (after fixing test 4f) so the truncation behavior is gated going forward'); architecture/issue4_image_and_tests.md ('Test-suite wiring' section — the exact target string + why each harness is gated)"
target_file: "./package.json (EDIT scripts.test L9 — one string value; everything else byte-for-byte unchanged)"
target_language: "N/A — JSON manifest edit (no TS/JS). Gate = `npm test` runs all three harnesses sequentially, exits 0 iff ALL pass; `npm run typecheck` still works."
depends_on: "P1.M1.T1.S2 (flipped import-behavior.test.mjs test 4f + added 4h — Complete; REQUIRED so the newly-wired suite is green, not red on the old PRD-violating 4f). P1.M1.T1.S1 (the actual resolveImportPath fmtCut fix — Complete; what 4f+4h now assert). The three harness files exist at repo root (file-injector.test.mjs, import-behavior.test.mjs, relative-imports.test.mjs)."
consumed_by: "P1.M3.T2.S1 (README feature/docs sweep — this task is package.json only; README = that subtask). Future CI / contributors who run `npm test` expecting all suites to run."
---

# PRP — P1.M3.T1.S1: Chain all three test harnesses into `npm test`

> **Scope flag:** A one-line wiring change. `npm test` currently runs ONLY `file-injector.test.mjs`. The two
> regression suites — `import-behavior.test.mjs` (Issue-1 truncation guard, incl. the now-fixed test 4f) and
> `relative-imports.test.mjs` (BUG CLASS 1 & 2 guards) — are **standalone scripts not gated by `npm test`**
> (the architecture doc + PRD §h2.4 both flag this). This task chains all three with `&&` so a regression in
> ANY of the three now fails `npm test`. **One string-value edit to `package.json` L9. No new files, no new
> deps, no test framework, no README change.** The three harnesses share the identical
> `process.exit(failed ? 1 : 0)` pattern, so the `&&` chain fails fast on the first non-zero exit. Run after
> confirming all three are green standalone.

---

## Goal

**Feature Goal:** Make `npm test` execute the COMPLETE shipped test surface — all three repo-root harnesses
(`file-injector.test.mjs`, `import-behavior.test.mjs`, `relative-imports.test.mjs`) — sequentially, exiting 0
only if ALL three pass. A regression in any one harness (e.g. the Issue-1 truncation behavior that
`import-behavior.test.mjs` 4f/4h now guard) will then fail `npm test`, closing the gap the bugfix PRD §h2.4
identifies ("the primary gate does not exercise it either way").

**Deliverable:** Modified `package.json` — `scripts.test` (L9) changed from
`"node ./file-injector.test.mjs"` to
`"node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"`.
That is the ENTIRE change. `scripts.typecheck` (L8) and every other key preserved.

**Success Definition:**
1. `npm test` runs the three harnesses IN ORDER (file-injector → import-behavior → relative-imports),
   printing each one's `Result: … passed, … failed` summary line, and exits `0`.
2. The chain fails fast: a failure in any earlier harness aborts the later ones (standard `&&` semantics).
3. `npm run typecheck` is unaffected (L8 untouched; still `node ./scripts/typecheck.mjs`).
4. `package.json` is still valid JSON (parseable; 2-space indented; no trailing comma on the last `scripts` key).
5. No `devDependencies` added; no test framework introduced (zero-deps ethos preserved).

## User Persona

**Target User:** The **Pi extension maintainer / contributor** who runs `npm test` (locally or in CI) to
verify the extension before merge. Today `npm test` gives a false green when `import-behavior.test.mjs` or
`relative-imports.test.mjs` regresses — those suites exist but are invisible to the standard command.

**Use Case:** A contributor lands a change to `resolveImportPath` and runs `npm test`. Today the Issue-1
truncation guard (`import-behavior.test.mjs` 4f/4h) does NOT run, so a reintroduced `.md.bak` false-positive
ships silently. After this task, `npm test` runs that guard and fails red, catching the regression pre-merge.

**User Journey:** contributor → `npm test` → sees three summary blocks in order
(`Result: 148 passed, 0 failed.` → `Result: 23 passed, 0 failed` → `Result: 38 passed, 0 failed`) → exit 0 =
all green; or sees the FIRST failing harness's output + a non-zero exit + npm's error line.

**Pain Points Addressed:** Two of the three shipped regression suites were un-gated — the Issue-1 bug
*persisted precisely because* its guard (`import-behavior.test.mjs` 4f) was neither run by `npm test` nor
correct (it endorsed the bug). This task wires it in (now that P1.M1.T1.S2 fixed 4f) so the guard is
enforced going forward, and adds `relative-imports.test.mjs` (BUG CLASS 1 & 2) to the same gate.

## Why

- **Closes the exact gap the PRD identifies.** §h2.4: "The `import-behavior.test.mjs` suite is **not** part of
  `npm test`; consider wiring it in (after fixing test 4f) so the truncation behavior is gated going forward."
  4f is now fixed (P1.M1.T1.S2, Complete); the wiring is THIS task. The architecture doc
  (`issue4_image_and_tests.md` "Test-suite wiring") specifies the exact target string.
- **Defense against regression.** Issue 1 (silent wrong-file injection) was a Major correctness defect that
  survived because its guard was (a) endorsing the bug and (b) not in `npm test`. Both are now fixed: the
  guard asserts the right thing AND this task makes it run on every `npm test`. The same applies to
  `relative-imports.test.mjs` (path-resolution BUG CLASS 1 & 2 guards).
- **No new machinery.** All three harnesses already share the `process.exit(failed ? 1 : 0)` pattern; the
  shell's `&&` operator already does fail-fast. Zero new dependencies, zero framework churn — the change is
  literally one string. This respects the repo's zero-deps ethos (PRD §8).
- **Fails fast, in priority order.** file-injector.test.mjs runs FIRST (the primary gate with the most
  cases — ~148+), so the most common/most-important failure surfaces first; the two regression suites run
  after. A red file-injector gate doesn't waste time on the others.
- **No docs surface.** Mode A: the script is self-documenting (`npm test` now obviously runs three harnesses).
  The README feature/docs sweep is P1.M3.T2.S1 (separate subtask). This task ships no user-facing prose.

## What

`npm test`'s behavior changes from "run one harness" to "run all three, fail-fast, exit 0 iff all green".
No source/behavior change to the extension itself. No new files.

### Success Criteria

- [ ] `package.json` L9 `scripts.test` == `"node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"`.
- [ ] `npm test` exits `0` and prints all three `Result:` summary lines in order (file-injector, then import-behavior, then relative-imports).
- [ ] `npm run typecheck` still works and is unchanged (L8 untouched).
- [ ] `package.json` parses as valid JSON (2-space indent; L9 is the last `scripts` key — NO trailing comma).
- [ ] No `devDependencies` / no new dependencies / no test framework added.
- [ ] `scripts.typecheck`, `"type":"module"`, `"pi":{"extensions":["file-injector.ts"]}`, name/version/description/private all byte-for-byte unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to make this edit correctly?_ **Yes.**
This PRP includes: the exact current `package.json` (14 lines, verbatim), the exact target string for L9
(from the architecture doc + contract), the verified fact that all three harnesses exit with the identical
`process.exit(failed ? 1 : 0)` pattern (so `&&` fail-fast works), the verified standalone-green snapshot
(148/0, 23/0, 38/0) to confirm wiring is safe, the JSON-no-escaping-of-`&` fact (so the implementer doesn't
malform the file), the fail-fast mechanism (npm runs scripts via the shell; `&&` is the shell operator), the
hard constraints (no deps, preserve typecheck, no README), and a precise post-edit validation (the `npm test`
run + a `JSON.parse` sanity check). The implementer edits one string on one line and runs two commands.

### Documentation & References

```yaml
# MUST READ — the exact target string + the rationale + the dependency on the 4f fix
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue4_image_and_tests.md
  why: "'Test-suite wiring (cross-cutting)' section pins the target verbatim:
        `\"test\": \"node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs\"`.
        Confirms all three harnesses share `process.exit(failed ? 1 : 0)` and chain with `&&`; that the
        wiring MUST land AFTER the import-behavior 4f fix (P1.M1.T1.S2) so the newly-wired suite is green."
  critical: "It also documents WHY each harness is gated: import-behavior.test.mjs = Issue-1 truncation
             (4f endorsed the bug → now flipped); relative-imports.test.mjs = BUG CLASS 1 & 2 regression
             guards. Do not reorder or omit any of the three."

# The file you edit (14 lines, 2-space indent, valid JSON)
- file: package.json
  why: "L8 `typecheck` (PRESERVE); L9 `test` (THE EDIT — currently `\"node ./file-injector.test.mjs\"`,
        the LAST key in `scripts` so NO trailing comma). The new L9 value is still the last key → still no
        trailing comma. Everything else (type/pi/extensions/name/version/description/private) unchanged."
  gotcha: "The L9 string is the LAST property in the `scripts` object — it currently has NO trailing comma
           and must keep having none. (L8 typecheck DOES have a trailing comma; leave it.) A stray/missing
           comma is the only realistic way to malform this edit — the `JSON.parse` sanity check catches it."

# The three harnesses (read only — to confirm their exit pattern; do NOT edit them)
- file: file-injector.test.mjs
  why: "Primary gate (~148+ cases; the biggest suite). Exit: L2768 `process.exit(failed > 0 ? 1 : 0)`.
        Runs FIRST in the chain (most cases → most important failure surfaces first). P1.M2.T2.S1 (parallel)
        adds 2 cases here (REND-PAGED-DIR + ISS3-DIRECTIVE); stays green standalone."
- file: import-behavior.test.mjs
  why: "Issue-1 truncation regression suite. Exit: L274 `process.exit(failed ? 1 : 0)`. Test 4f was the
        PRD-violating assertion (P1.M1.T1.S2 flipped it to assert verbatim/null + added 4h) — the reason
        this task is gated on P1.M1.T1.S2 being Complete. Runs SECOND."
- file: relative-imports.test.mjs
  why: "Path-resolution BUG CLASS 1 & 2 regression guards (see its header L1-19). Exit: L513
        `process.exit(failed ? 1 : 0)`. Runs THIRD. Independently green (38/0)."

# The predecessor subtasks (the contract whose landing makes wiring safe)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M1T1S2/PRP.md
  why: "Owns the import-behavior.test.mjs 4f FLIP + 4h ADD + the file-injector.test.mjs regression cases.
        This wiring task MUST run after it (4f must assert the PRD-compliant outcome, else wiring
        import-behavior.test.mjs into `npm test` would immediately go red on the old 4f). 4f is flipped → safe."

# The parallel task (NO conflict — confirmed)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T2S1/PRP.md
  why: "Issue-3 renderer fix. Edits file-injector.ts + file-injector.test.mjs ONLY. Does NOT touch
        package.json. Orthogonal to this task — no shared edit site, no merge conflict. When it lands,
        file-injector.test.mjs grows ~2 cases but stays green, so the wired `npm test` chain stays green."

# PRD — the gap this closes
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/prd_snapshot.md
  why: "§h2.4 'Areas needing attention': 'The import-behavior.test.mjs suite is not part of npm test;
        consider wiring it in (after fixing test 4f) so the truncation behavior is gated going forward.'
        This task IS that wiring (4f is fixed)."
  section: "h2.4 Testing Summary (the last bullet of 'Areas needing attention')"
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts            # untouched (the extension under test)
├── file-injector.test.mjs      # harness #1 (primary gate; ~148+ cases; exit 0/1) — runs FIRST
├── import-behavior.test.mjs    # harness #2 (Issue-1 truncation; 23 cases; 4f flipped, 4h added) — runs SECOND
├── relative-imports.test.mjs   # harness #3 (BUG CLASS 1 & 2; 38 cases) — runs THIRD
├── scripts/typecheck.mjs       # the --strict typecheck (invoked by `npm run typecheck`; L8 — PRESERVE)
├── package.json                # ← EDITED (L9 scripts.test only)
├── tsconfig.json               # untouched
├── PRD.md / README.md          # read-only (README sweep = P1.M3.T2.S1)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/{issue4_image_and_tests.md (the wiring spec), issue1/2_3/system_context.md}
    └── P1M?T?S?/{research, PRP.md}   # the predecessor + sibling PRPs
```

### Desired Codebase tree (files touched by THIS task)

```bash
package.json   # MODIFIED — scripts.test (L9) only:
               #   BEFORE: "node ./file-injector.test.mjs"
               #   AFTER:  "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
# No other files. No new files. No new deps. No README. No harness edits.
```

### Known Gotchas of our codebase & JSON/shell Quirks

```js
// CRITICAL — this is a ONE-LINE edit. Do not "improve" package.json (no script reordering, no
//   devDependencies, no "test:unit"/"test:all" split, no npm-run-all). The contract is explicit: plain `&&`
//   chaining, zero new deps. Over-engineering a 14-line manifest is how you break the build.

// CRITICAL — L9 is the LAST key in the `scripts` object → it has NO trailing comma and must keep none.
//   (L8 `typecheck` DOES have a trailing comma; leave it.) A missing/stray comma on L9 is the ONLY realistic
//   way to malform this edit. Sanity-check with `node -e 'JSON.parse(fs.readFileSync("package.json","utf8"))'`.

// CRITICAL — `&` needs NO escaping inside a JSON string value. JSON mandates escaping only `"`, `\`, and
//   control chars (U+0000–U+001F) — `&` is a literal character. So
//     "node ./a.mjs && node ./b.mjs"
//   is valid JSON as-is. Do NOT write `&amp;` (that's XML/HTML) and do NOT backslash-escape (`\&`).

// CRITICAL — confirm all three harnesses are GREEN STANDALONE BEFORE editing (contract item 1). Run each:
//     node ./file-injector.test.mjs ; echo $?
//     node ./import-behavior.test.mjs ; echo $?
//     node ./relative-imports.test.mjs ; echo $?
//   Each must print `Result: … 0 failed` and exit 0. If ANY is red, STOP — do not wire a red suite into
//   `npm test` (it would make `npm test` immediately fail and mask which suite is the real problem). Fix /
//   escalate that harness's owning subtask first. (Snapshot: 148/0, 23/0, 38/0 — all green.)

// GOTCHA — `&&` is the SHELL's sequential-and operator, not a Node/npm construct. npm runs each
//   `scripts.*` value via the shell (`sh -c` on POSIX, `cmd /c` on Windows; both honor `&&`). So `A && B &&
//   C` runs A, then B iff A exited 0, then C iff B exited 0. The chain's exit code is the first non-zero
//   exit, or 0 if all passed. npm propagates that code → `npm test` exits non-zero if ANY harness fails.

// GOTCHA — the harnesses set the exit code EXPLICITLY (`process.exit(failed ? 1 : 0)`), not just
//   `process.exitCode = …`. So the shell observes the code synchronously — no reliance on Node's
//   natural-exit code propagation. This is why the chain is robust (and why you don't need to change the
//   harnesses — they're already exit-code-correct).

// GOTCHA — fail-fast is INTENDED. With `&&`, a red file-injector.test.mjs means import-behavior +
//   relative-imports do NOT run (and their summary lines won't print). That's correct: fix the primary
//   gate first. Do NOT switch to `;` (run-all) or a runner that reports all-three-regardless — the contract
//   wants fail-fast ("chain cleanly with `&&` (fail-fast on first non-zero exit)").
```

## Implementation Blueprint

> No data models, no new files, no integration points beyond `package.json`. The blueprint is the single
> ordered task + the verification.

### The edit (package.json, L9)

```jsonc
// BEFORE (L7-L10):
  "scripts": {
    "typecheck": "node ./scripts/typecheck.mjs",
    "test": "node ./file-injector.test.mjs"
  },

// AFTER (L7-L10) — ONLY L9 changes; L8 and the structure are identical:
  "scripts": {
    "typecheck": "node ./scripts/typecheck.mjs",
    "test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
  },
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 0: PRE-EDIT GATE — confirm all three harnesses are green standalone (contract item 1)
  - RUN (each, separately): `node ./file-injector.test.mjs` / `node ./import-behavior.test.mjs` / `node ./relative-imports.test.mjs`
  - EXPECT: each prints `Result: <N> passed, 0 failed` and exits 0. (Snapshot: 148/0, 23/0, 38/0.)
  - IF ANY RED: STOP. Do NOT proceed to Task 1 (wiring a red suite makes `npm test` fail and hides the real
    culprit). Fix/escalate that harness's owning subtask (e.g. import-behavior.test.mjs → P1.M1.T1.S2).

Task 1: EDIT package.json L9 (scripts.test)
  - CHANGE the `test` value (the LAST key in `scripts`) to:
      "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
  - PRESERVE: L8 `typecheck` (unchanged); the trailing-comma structure (L9 has NO trailing comma — it's the
    last key; L8 keeps its comma); 2-space indentation; valid JSON.
  - DO NOT: reorder scripts, add keys, add devDependencies, add a runner/framework, HTML-escape `&`, or touch
    any other line.

Task 2: VALIDATE the edit
  - RUN: `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8")); console.log("package.json: valid JSON")'`
    → expect `package.json: valid JSON` (catches a comma/quote slip instantly).
  - RUN: `npm test` → expect THREE summary blocks in order, each `0 failed`, exit 0:
        … Result: <N1> passed, 0 failed.      (file-injector.test.mjs — ~148+)
        … Result: <N2> passed, 0 failed       (import-behavior.test.mjs — 23)
        … Result: <N3> passed, 0 failed       (relative-imports.test.mjs — 38)
  - RUN: `npm run typecheck` → expect exit 0 + `type-checks clean under --strict (0 errors)` (L8 untouched).
  - RUN (sanity): `node -e 'const s=require("./package.json").scripts; console.log(s.test)'`
    → expect the exact `&&`-chain string; `console.log(s.typecheck)` → `node ./scripts/typecheck.mjs`.
```

### Implementation Patterns & Key Details

```js
// The exact target string (copy verbatim into L9's value):
//   "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
//
// Why this ordering:
//   1. file-injector.test.mjs   — PRIMARY gate, most cases (~148+); fail-fast here surfaces the highest-value
//                                 failure first. (P1.M2.T2.S1 adds ~2 more when it lands.)
//   2. import-behavior.test.mjs — Issue-1 truncation regression (4f flipped + 4h added by P1.M1.T1.S2).
//   3. relative-imports.test.mjs — path-resolution BUG CLASS 1 & 2 regression guards.
//
// The chain's contract: exit 0 ⟺ all three exited 0. A single failure → non-zero exit + only the failing
// (and earlier) harnesses' output. Standard `npm test` fail-fast; no runner needed.
```

### Integration Points

```yaml
PACKAGE_JSON (the ONLY file touched):
  - scripts.test (L9): single-harness → three-harness `&&` chain.
  - PRESERVE: scripts.typecheck (L8); "type":"module"; "pi":{"extensions":["file-injector.ts"]};
    name/version/description/private; 2-space indent; valid JSON; L9 as last scripts key (no trailing comma).

NO_CHANGES: file-injector.ts; file-injector.test.mjs; import-behavior.test.mjs; relative-imports.test.mjs;
            scripts/typecheck.mjs; tsconfig.json; PRD.md; README.md; all plan/ files. No new files. No new deps.
```

## Validation Loop

> A one-line edit has a short loop. Run the pre-edit gate, edit, then the three post-edit checks.

### Level 1: Pre-edit gate (confirm safe to wire)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs   ; echo "exit=$?"   # expect: Result: <N> passed, 0 failed. ; exit=0
node ./import-behavior.test.mjs ; echo "exit=$?"   # expect: Result: <N> passed, 0 failed  ; exit=0
node ./relative-imports.test.mjs; echo "exit=$?"   # expect: Result: <N> passed, 0 failed  ; exit=0
# If ANY is non-zero: STOP. Do not wire a red suite. Fix/escalate that harness first.
```

### Level 2: JSON validity (post-edit, instant)

```bash
node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8")); console.log("package.json: valid JSON")'
# Expected: `package.json: valid JSON`. If this throws (SyntaxError) → a comma/quote slipped; fix L9.
```

### Level 3: The wired `npm test` chain (the deliverable)

```bash
npm test
# Expected: three summary blocks IN ORDER, each `0 failed`, and exit 0:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: <N1> passed, 0 failed.           (file-injector.test.mjs — ~148+)
#   ──────────────────────────────────────────────────────────────────────────
#   ─────────────────────────────────────────
#   Result: <N2> passed, 0 failed            (import-behavior.test.mjs — 23)
#   ─────────────────────────────────────────
#   ─────────────────────────────────────────
#   Result: <N3> passed, 0 failed            (relative-imports.test.mjs — 38)
#   ─────────────────────────────────────────
# Exit code 0. (If any block shows `M failed` (M>0), npm exits non-zero and the chain stops there.)
```

### Level 4: Non-regression of `typecheck` + exact-string sanity

```bash
npm run typecheck
# Expected: exit 0; `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`. (L8 untouched.)

node -e 'const s=require("./package.json").scripts; console.log(JSON.stringify(s.test,null,0))'
# Expected: "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
node -e 'console.log(require("./package.json").scripts.typecheck)'
# Expected: node ./scripts/typecheck.mjs
```

## Final Validation Checklist

### Technical Validation

- [ ] Pre-edit: all three harnesses green standalone (Level 1) — confirmed BEFORE editing.
- [ ] Post-edit: `package.json` parses as valid JSON (Level 2).
- [ ] `npm test` runs all three harnesses in order, each `0 failed`, exit 0 (Level 3).
- [ ] `npm run typecheck` unaffected → 0 errors (Level 4).

### Feature Validation (the wiring this task owns)

- [ ] `scripts.test` == the exact three-harness `&&` chain (file-injector → import-behavior → relative-imports).
- [ ] A regression in ANY of the three now fails `npm test` (fail-fast `&&` semantics — by construction).
- [ ] `import-behavior.test.mjs` (the Issue-1 guard, incl. fixed 4f + new 4h) is now gated by `npm test`.

### Code Quality / Scope Validation

- [ ] Only `package.json` L9 changed; L8 + all other keys byte-for-byte unchanged.
- [ ] No new `devDependencies`; no test framework / runner introduced (zero-deps ethos).
- [ ] No harness files edited; no new files; no README change (README = P1.M3.T2.S1).

### Documentation

- [ ] Mode A: package.json's `test` script is self-documenting (no prose needed). No README change.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT wire a red suite.** If any of the three harnesses is non-zero standalone, STOP — fix/escalate
  that harness's owning subtask first. Wiring a red suite makes `npm test` fail and obscures which suite is
  the real problem. (Confirm green BEFORE editing — Task 0.)
- ❌ **Do NOT add a test framework or runner.** No vitest/jest/mocha, no `npm-run-all`/`run-s`, no
  `devDependencies`. Plain shell `&&` is the convention; the contract forbids new deps (zero-deps ethos).
- ❌ **Do NOT switch `&&` to `;` (or run-all).** Fail-fast is the contract: a red primary gate should abort
  the later suites, not run them anyway. `;` would run all three regardless and muddy the output.
- ❌ **Do NOT reorder or omit harnesses.** The order is file-injector (primary, most cases) → import-behavior
  (Issue-1) → relative-imports (BUG CLASS 1 & 2). All three are wired; none is optional.
- ❌ **Do NOT HTML-escape or backslash-escape `&`.** `&` is a literal in JSON string values. `&amp;` (XML) or
  `\&` would break the shell operator and the JSON would still parse but the chain wouldn't run. Literal `&&`.
- ❌ **Do NOT add a trailing comma on L9** (it's the last `scripts` key) or remove L8's comma. Keep the
  existing structure; only the L9 string value changes. The `JSON.parse` check catches any slip.
- ❌ **Do NOT edit the harness files, scripts/typecheck.mjs, tsconfig.json, or README.md.** This task is
  `package.json` L9 only. (README sweep = P1.M3.T2.S1.)
- ❌ **Do NOT "improve" the manifest** (no `test:unit`/`test:all` split, no script reordering, no
  description edits). A 14-line manifest edited beyond the one string is scope creep that risks the build.

---

## Confidence Score: 10/10

A one-line edit with a verified target string (from the architecture doc, verbatim), verified standalone-green
inputs (148/0, 23/0, 38/0), a verified shared exit pattern (`process.exit(failed ? 1 : 0)` ×3 → `&&` fail-fast
works), an orthogonal parallel task (P1.M2.T2.S1 touches file-injector.ts/.test.mjs, NOT package.json), and a
completed dependency (P1.M1.T1.S2 flipped 4f so the wired suite is green). The only realistic failure mode is
a JSON comma/quote slip on L9, which the `JSON.parse` sanity check + the `npm test` run catch instantly. The
PRP pins the exact string, the exact line, the no-escaping-of-`&` JSON fact, and the fail-fast mechanism so the
implementer makes the trivial edit correctly without over-engineering it. The implementing agent confirms three
green standalone harnesses, edits one string, and runs `npm test` + `npm run typecheck`.
