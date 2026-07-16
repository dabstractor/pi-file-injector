# Research Notes — P1.M3.T1.S1 (Full regression + typecheck gate)

> This is a **VERIFICATION / GATE** task (Definition-of-Done confirmation), NOT a feature build.
> The PRP is therefore a **runbook + diagnostic decision tree**, not an implementation spec.
> Research goal: (1) pin the exact gate commands + expected output strings; (2) inventory the
> realistic failure modes a gate agent must diagnose; (3) confirm the module-surface guard state.

---

## 1. The two gates (VERIFIED by direct execution — research snapshot 2025-07-16)

### Gate A — the regression / module-surface suite
- **Command:** `node ./file-injector.test.mjs`  (from repo root). Alias: `npm test` / `npm run test`.
- **Mechanism:** zero-dep Node ESM script. Resolves the GLOBAL pi package via `npm root -g`, builds a
  `jiti` with Pi's alias map, imports the REAL committed `./file-injector.ts`, runs named assertions via
  a tiny `assert`/`runCase` harness, prints a matrix + summary line, exits 0/1.
- **Success contract (HARD):** exit code `0` AND the final summary line `Result: <N> passed, 0 failed.`
  where `<N>` = 92 core + 6 (M1.T1.S1) + 4 (M1.T2.S1) + 5 (M2.T1.S1) + 7 (M2.T2.S1) = **114** when every
  predecessor subtask has landed. The LOAD-BEARING assertion is `0 failed` + exit 0 (the exact passing
  count is informational; 114 is the expected total once M2.T2.S1 adds its 7).
- **Snapshot NOW (M2.T2.S1 mid-implementation):** `Result: 107 passed, 0 failed.` (M2.T2.S1's source
  edits to `injectMarkdown` are ALREADY in `file-injector.ts` — bareAt threading + `injectable` type
  widening + `+ r.prefixLen` strip — but its 7 test cases are not yet added).

### Gate B — the `--strict` typecheck
- **Command:** `npm run typecheck` (== `node ./scripts/typecheck.mjs`). NOT plain `tsc` — the wrapper
  resolves the global pi `.d.ts`, writes a temp tsconfig with the right `paths`, and runs
  `tsc -p <tmp> --listFiles` under `strict:true` + `skipLibCheck:true`.
- **Success contract (HARD):** exit code `0` AND the line
  `typecheck: file-injector.ts type-checks clean under --strict (0 errors)` printed to **stderr**
  (`scripts/typecheck.mjs` uses `console.error` for the success message; the catch path sets
  `process.exitCode = 1` WITHOUT printing the success line). So: success ⟺ exit 0 ⟺ success line present.
- **Snapshot NOW:** `0 errors` (clean). The `bareAt` opt is already wired through every call site.

---

## 2. Module-surface guard (the `readConfig` / `injectMarkdown` contract) — VERIFIED green

Lives in `file-injector.test.mjs` sanity block, **before** the case matrix (runs first → fails fast):

- **L131:** `assert(typeof mod.readConfig === "function", ...)` — readConfig IS exported & callable.
- **L138-142:** `ASSERTED_EXPORTS` = `{default, injectFiles, cleanToken, formatTextFileBlock,
  formatImageBlock, formatBinaryBlock, formatEmptyImageBlock, formatPagedDirectiveBlock,
  hasValidImageMagic, scanTokens, injectFile, emitText, isAbsoluteOrTilde, computeCodeRanges, inCode,
  estimateImageTokens, resolveImportPath, isRegularFile, readConfig}` (19 — readConfig added in M1.T2.S1).
- **L144:** `PURE_HELPERS_NOT_ASSERTED` = `{expandTildeAndResolve, extOf, isBinary}` (3 — tested indirectly).
- **L145-150:** completeness assert — every shipped function must be in one of the two sets, else
  `"module ships functions not in the sanity list: <names>"`.
- **L152-153:** PRIVACY assert — `assert(typeof mod.injectMarkdown === "undefined", "injectMarkdown
  must NOT be exported ...")`.

**VERIFIED state of `file-injector.ts` exports** (`grep ^export`): exactly 21 named exports + `default`,
all accounted for in ASSERTED_EXPORTS (18 fns + default) ∪ PURE_HELPERS_NOT_ASSERTED (3 fns).
`injectMarkdown` is declared `async function injectMarkdown(...)` at **L693 with NO `export` keyword** →
`mod.injectMarkdown === undefined` → privacy assert passes. **No ASSERTED_EXPORTS change is expected by
this task** (M2.T2.S1 adds NO exports; injectMarkdown stays private — its PRP's anti-patterns forbid both).

→ The module-surface guard is a **PASS-THROUGH CONFIRMATION** for this gate: it runs as part of Gate A.
This task does NOT edit it. It only CONFIRMS the two assertions (readConfig recognized; injectMarkdown
private) still hold after M1+M2 landed.

---

## 3. The `bareAt` opt shape — why a typecheck call-site mismatch is (now) unlikely, but how to fix it

### Signatures (current committed code — VERIFIED)
- **`scanTokens(text, baseDir, opts: { allowAbsTilde; skipCode; tryMdExt; bareAt?: boolean }, state)`**
  → `Promise<{ index; prefixLen; abs }[]>`. **`bareAt` is OPTIONAL** (`bareAt?`). So ANY scanTokens
  call site — whether it passes `bareAt` or not — typechecks. The two production call sites are:
    1. `injectFiles` top-level → `processTokenStream(..., {allowAbsTilde:true, skipCode:false,
       tryMdExt:false, bareAt:false}, ...)` (bareAt:false HARDCODED — §4.6 top-level is #@-only).
    2. `injectMarkdown` Step 3 → `scanTokens(content, dir, {..., bareAt: state.bareAt}, state)`.
  Both already satisfy the type. scanTokens is also called directly in unit tests (T1.S1-8..13).
- **`processTokenStream(text, baseDir, opts: { allowAbsTilde; skipCode; tryMdExt; bareAt: boolean },
  state, ctx)`** → `Promise<number[]>`. **`bareAt` is REQUIRED** (not optional — it's the top-level
  passthrough). Its ONLY caller is the `injectFiles` top-level call above, which passes `bareAt:false`.

### Why the typecheck is already clean (and why a "call site not updated" failure would be a regression)
Because every call site ALREADY passes the right `bareAt` value, `npm run typecheck` returns 0 errors
today. The ONLY way Gate B could surface "a call site not updated for the bareAt opt" at this stage is:
- A predecessor subtask (M1.T1.S1 / M1.T2.S1 / M2.T1.S1 / M2.T2.S1) was incompletely landed, OR
- A stray edit removed `bareAt` from an opts type or a call site.

### The fix rule (contract item c) — fix the CALL SITE, NEVER weaken strictness
If Gate B prints a TS error, the offending site is named in the error (file + line). Fix it at the
call site / the opts type. **Forbidden "fixes"** (these WEAKEN strictness — the contract forbids them):
- `// @ts-ignore` / `// @ts-expect-error`
- `as any` / `as unknown as X` casts to silence the error
- flipping `bareAt: boolean` (required) → `bareAt?: boolean` merely to let an omitting call site compile
- removing `strict: true` or toggling `skipLibCheck` in `scripts/typecheck.mjs`'s generated tsconfig or `tsconfig.json`
- pointing the temp tsconfig at a different file / `git stash`-ing source to "reset" it

### Realistic TS error → real fix map (for the diagnostic tree)
| TS error (paraphrase) | Likely site | REAL fix (do NOT weaken strictness) |
|---|---|---|
| `Property 'bareAt' is missing in type '{...}'` req'd by processTokenStream opts | `injectFiles` top-level `processTokenStream(...)` call | add `bareAt: false` to the opts literal (§4.6: top-level is #@-only) |
| `Property 'prefixLen' does not exist on '{index;abs}'` | `injectMarkdown` Step 4 (`r.index + r.prefixLen`) | widen the Step 3.5 `injectable` annotation to `{index;prefixLen;abs}[]` (filter body unchanged) |
| `Property 'bareAt' does not exist` on scanTokens opts | a scanTokens call passing `bareAt: X` | restore `bareAt?: boolean` in scanTokens opts type (do NOT delete the key from the call) |
| `Object literal may only specify known properties` 'bareAt' | a call site | the opts type at the callee must declare bareAt — add it; do NOT delete it from the call |
| Anything about State | `state.bareAt` read | restore `bareAt: boolean` field in `interface State` |

---

## 4. Realistic TEST failure modes (Gate A) — diagnostic tree

Because Gate A runs the REAL committed source via jiti, a failure means a real behavior bug or a
guard/regression. Mocking/stubbing is FORBIDDEN (contract item 3: "Mock nothing").

| Symptom in matrix | Diagnosis | Action (this task's lane) |
|---|---|---|
| Sanity assert: `module ships functions not in the sanity list: X` | A function was exported w/o adding to the guard | Add `X` to ASSERTED_EXPORTS (if a real new public API) or PURE_HELPERS_NOT_ASSERTED (if a pure indirect helper). NOT a reason to weaken. |
| Sanity assert: `injectMarkdown must NOT be exported` | `injectMarkdown` got an `export` keyword | Remove the `export` (it is a PRIVATE recursion driver — PRD §5.6). |
| Sanity assert: `mod.readConfig must be a function` | readConfig lost its `export` | Restore `export` on `readConfig` (it is a §4.6 public API + unit-tested directly). |
| A §11 #25-28 case (M2.T2.S1) FAILS | M2.T2.S1's wiring bug | This is the PREDECESSOR's domain. The gate REPORTS it; per contract the fix belongs to the wiring (injectMarkdown scan call / injectable type / `+ r.prefixLen`). See M2.T2.S1 PRP Level 3 diagnostics. Do NOT mask by skipping. |
| A PRE-EXISTING case (1-24, MD1/2, EDG-1..4, T1/T2/M2.T1 cases) FLIPS | A regression: the byte-for-byte-default was violated (bareAt off changed behavior) | Re-check `injectMarkdown` Step 3 passes `bareAt: state.bareAt` (NOT `bareAt: true`) and Step 4 uses `+ r.prefixLen` (every default record has prefixLen 2 → `+ 2`). |
| Suite exits 0 but count ≠ 114 | A predecessor added a different number of cases | The LOAD-BEARING contract is `0 failed` + exit 0. Reconcile the count against each predecessor's declared case count; if a case was dropped, that's a regression in that predecessor. |

---

## 5. Hard constraints (from the contract + parallel-execution context)

- **Mock nothing.** Run the REAL gates against the REAL committed `file-injector.ts`. No stubbing jiti,
  no `git stash`/`checkout` to "reset", no pointing at a temp file, no `PIPKG` override.
- **Do NOT weaken strictness** (Gate B): no `@ts-ignore`, no `as any`, no opts-type relaxation, no
  `strict:false`/`skipLibCheck` toggling. Fix the call site, not the gate.
- **Do NOT weaken the suite** (Gate A): no `it.skip`/commenting-out, no relaxing assertions, no editing
  `ASSERTED_EXPORTS` to paper over an accidentally-exported `injectMarkdown` (instead un-export it).
- **Do NOT modify the gates themselves** (`scripts/typecheck.mjs`, the test harness's sanity/assert logic)
  to force green.
- **`injectMarkdown` stays PRIVATE.** The whole point of item LOGIC (d) is to CONFIRM this. If a gate fix
  would require exporting it, that's a signal the real bug is elsewhere — escalate, do not export.
- **Scope:** this task touches source ONLY if a gate surfaces a genuine strictness/call-site mismatch
  (contract item c) — and even then, the change is a minimal call-site fix. It adds NO tests, NO exports,
  NO docs (README = P1.M3.T2.S1). The default, happy-path output is two green commands + confirmation.
- **Predecessor dependency:** P1.M2.T2.S1 (injectMarkdown wiring + 7 cases) MUST be complete when this
  gate runs. This research is concurrent with M2.T2.S1's implementation; the PRP assumes M2.T2.S1 lands
  exactly as specified (suite 107 → 114, typecheck stays 0 errors, injectMarkdown stays private).

---

## 6. Confidence notes

- Both gates are GREEN on the current snapshot (typecheck 0 errors; suite 107/0 failed), and the source
  already carries every `bareAt`/`prefixLen` edit M2.T2.S1 specifies. So the expected default outcome is
  "two green commands, no edits." The PRP's value is the diagnostic decision tree for the case where a
  gate is NOT green — which is exactly what contract item (c) asks the gate agent to handle.
- Confidence 9/10: the work is deterministic (run 2 known commands, match known success strings). The -1
  reserves for the open variable "did M2.T2.S1 land cleanly" — which this gate EXISTS to answer.
