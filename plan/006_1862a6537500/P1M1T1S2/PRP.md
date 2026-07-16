---
name: "P1.M1.T1.S2 (plan/006) — Run tsc --strict typecheck — confirm 0 errors"
prd_ref: "PRD §7 (Technical Reference — verified APIs), §8 (File Structure — single-file extension, zero npm deps), §9 (Algorithm pseudocode); bugfix/v006 context: external_deps.md validates the full Pi API surface against v0.80.8"
target_file: "(NONE — verification gate. file-injector.ts is edited ONLY if a TS error forces a real type fix.)"
target_language: TypeScript (gate = `npm run typecheck` == `node ./scripts/typecheck.mjs`, which runs `tsc --strict` v5.6 against file-injector.ts via a temp tsconfig resolving the GLOBAL pi .d.ts)
depends_on: "NONE for execution (S2 is an independent gate). Sibling P1.M1.T1.S1 (the 182-test gate) runs in parallel; S1 explicitly defers typecheck to S2 ('Do NOT run/typecheck here as part of S1's deliverable'). Neither consumes the other's output."
consumed_by: "P1.M1.T2.* (doc-audit subtasks — may cite the green typecheck as a coherence anchor)"
---

# PRP — P1.M1.T1.S2: Run tsc --strict typecheck — confirm 0 errors

> **Scope flag:** This is a **verification gate**, NOT new implementation. The v006 delta is "Verification +
> doc-audit (no new implementation required)" — the three §1 requirement changes are already implemented in
> `file-injector.ts` (1114 lines) and the code already type-checks clean. This subtask runs `tsc --strict` and
> formally confirms **0 errors**. If (unexpectedly) a TS error appears, apply a **real type fix** to
> `file-injector.ts` (never `@ts-ignore`, never loosen strictness). **Scope = S2 ONLY** — the test suites are
> S1; doc fixes are T2 subtasks.

---

## Goal

**Feature Goal:** Confirm `file-injector.ts` type-checks clean under `tsc --strict` against pi's shipped `.d.ts`
(v0.80.8), by running `npm run typecheck` and asserting the output contains `0 errors` and the process exits 0.

**Deliverable:** A recorded typecheck result (the `typecheck: … (0 errors)` line + exit code). No new code,
tests, exports, or files. If (unexpectedly) red, the deliverable additionally includes the minimal **real type
fix** to `file-injector.ts` that restores 0 errors.

**Success Definition:**
1. `npm run typecheck` (== `node ./scripts/typecheck.mjs`) prints `typecheck: file-injector.ts type-checks clean under --strict (0 errors)` and exits 0.
2. No `@ts-ignore` / `as any` suppression, no loosened `strict`, no removed `skipLibCheck` (item §3).
3. If a fix was required: `file-injector.ts` is the only changed file; the typecheck is re-green; S1's three test suites still pass (re-run them — a fix must not regress the 182-total).

## Why

- **The v006 delta is a verification + doc-audit pass.** The code is already implemented; this subtask is the
  formal confirmation that `file-injector.ts` still satisfies PRD §7/§8/§9's "type-checks clean under --strict"
  contract against the installed pi package.
- **Type safety is a PRD-stated contract.** PRD §7 lists the verified APIs (resizeImage, formatDimensionNote,
  CONFIG_DIR_NAME, getAgentDir, ResizedImage, ExtensionAPI, ImageContent) and the `input` event / ctx contract;
  PRD §8 calls the extension "zero npm imports beyond Pi's own packages." A green `--strict` check is the
  mechanical proof those imports + the handler/ctx usage are all correctly typed.
- **Guards the integration gate.** The jiti loader transpiles-on-load at runtime (the test suites load the
  real `.ts`), so a type regression wouldn't always crash the tests — the `--strict` check is the dedicated
  static gate that catches type drift the runtime suites might miss.

## What

### The runbook (the whole subtask)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck          # == node ./scripts/typecheck.mjs
# EXPECT (on success): "typecheck: file-injector.ts type-checks clean under --strict (0 errors)"  + exit 0
```

Record the result line + exit code. If green → **gate complete**. If a TS error appears → follow the
Failure-Diagnosis Protocol below (real type fix in `file-injector.ts`, then re-run typecheck + S1's suites).

### Success Criteria

- [ ] `npm run typecheck` exits 0 and prints `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`.
- [ ] No type error suppressed via `@ts-ignore` / `as any`; `strict:true` and `skipLibCheck:true` unchanged (item §3).
- [ ] If a fix was required: only `file-injector.ts` changed; typecheck re-green; S1's three suites re-run to 182 passed.
- [ ] No changes to PRD.md / README.md / JSDoc / tasks.json / prd_snapshot / tsconfig.json / scripts/typecheck.mjs / package.json (out of scope).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact command, the exact success message + exit semantics, the gate MECHANISM (the script writes a temp
tsconfig resolving the GLOBAL pi `.d.ts` — NOT the repo's editor-hints-only `tsconfig.json`), the validated API
surface (external_deps.md), the symbol→file routing table for failure diagnosis, the environment-vs-regression
discriminator, and the scope boundaries. The baseline is already confirmed green during research.

### Baseline (CONFIRMED GREEN during research — working tree unmodified)

```
$ node ./scripts/typecheck.mjs 2>&1 | tail -1
typecheck: file-injector.ts type-checks clean under --strict (0 errors)
$ echo $?
0
```
Installed pi: **v0.80.8** at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/`
(item cites v0.80.8; PRD §7 references v0.80.7 — `external_deps.md` validates against the installed v0.80.8).

### Documentation & References

```yaml
# MUST READ — the validated API surface (the "no API risk" basis for expecting green)
- file: plan/006_1862a6537500/architecture/external_deps.md
  why: "Confirms EVERY import (resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, ResizedImage,
        ExtensionAPI, ImageContent), the input event fields, and every ctx member (getContextUsage,
        isProjectTrusted, hasUI, ui.notify, ui.addAutocompleteProvider, cwd, model) present + correctly typed
        in v0.80.8. Conclusion: 'No API risk … will load and run against v0.80.8 without type or runtime errors.'"
  critical: "This is WHY the typecheck is expected green. Any TS error contradicts this validation → it's either
             a code regression since research or a pi version drift (check `cat <pipkg>/package.json | grep version`)."

# MUST READ — the gate mechanism + scope (verification delta; typecheck is S2, tests are S1)
- file: plan/006_1862a6537500/P1M1T1S1/PRP.md
  why: "S1 (the 182-test gate) explicitly defers typecheck to S2 ('typecheck (`npm run typecheck`) is S2, a
        SEPARATE subtask. Do NOT run/typecheck here as part of S1's deliverable'). Confirms S1/S2 are independent
        sibling gates; S2 consumes nothing from S1."
  critical: "Scope discipline: S2 runs typecheck ONLY. Do NOT run the three test suites (S1's gate). Do NOT fix
             PRD/README/JSDoc (T2 subtasks)."

# The gate script (read it — it is the WHOLE mechanism)
- file: scripts/typecheck.mjs
  why: "Resolves the GLOBAL pi package via `npm root -g`, locates `dist/index.d.ts` + pi-ai `.d.ts`, writes a TEMP
        tsconfig (strict/noEmit/skipLibCheck + paths), runs `npx --yes -p typescript@5.6 tsc -p <temp> --listFiles`.
        On success: `console.error('typecheck: … (0 errors)')` + exit 0. On error: exitCode 1."
  pattern: "The repo's tsconfig.json is NOT used by tsc (no `paths` → would fail to resolve pi); it is editor/LSP
            hints only. The script is the ONLY correct invocation."
  gotcha: "The success message goes to STDERR (console.error), and `--listFiles` dumps the file list to STDOUT.
           Assert BOTH the message text AND exit code 0 — don't rely on stdout being empty."

# The repo tsconfig.json (EDITOR HINTS ONLY — not the gate)
- file: tsconfig.json
  why: "Documents the intended compiler options (strict/noEmit/skipLibCheck/Bundler/allowImportingTsExtensions)
        for editors/LSP. It has NO `paths` (the pi .d.ts lives in the global node_modules), so `tsc -p tsconfig.json`
        would FAIL. `npm run typecheck` is the gate; this file is documentation."
  gotcha: "Do NOT 'fix' a typecheck by editing tsconfig.json (e.g., adding skipLibCheck:false or loosening strict).
           The script owns the real options; tsconfig.json is hints-only."

# The implementation under type-check (read-only here; edit ONLY if a TS error appears)
- file: file-injector.ts
  why: "1114 lines. Imports L1-6 (match external_deps validated surface EXACTLY). All type-relevant constructs:
        State interface; readConfig (ctx.isProjectTrusted trust gate); injectFile (resizeImage/ResizedImage/
        formatImageBlock/formatDimensionNote); handler (InputEvent guards, ctx.getContextUsage/hasUI/ui/cwd/model);
        session_start autocomplete (AutocompleteProvider shape)."
  gotcha: "If a fix is needed, keep it MINIMAL + real (correct the type), never @ts-ignore/as-any. A fix that
           touches an export also needs the test-sanity list / ASSERTED_EXPORTS (test ~L131/142) — re-run S1's suites."

# package.json — the script wiring
- file: package.json
  why: "`scripts.typecheck` = `node ./scripts/typecheck.mjs` (== `npm run typecheck`). `scripts.test` = only
        file-injector.test.mjs (S1's concern, not S2's)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # the file under type-check (1114 lines) — UNCHANGED unless a TS error appears
├── scripts/typecheck.mjs     # THE GATE — run `npm run typecheck` (resolves global pi .d.ts; writes temp tsconfig; tsc --strict)
├── tsconfig.json             # editor/LSP hints ONLY (no `paths`; NOT run by tsc) — UNCHANGED
├── package.json              # `scripts.typecheck` wiring — UNCHANGED
├── file-injector.test.mjs    # S1's suite (122) — NOT run by S2
├── relative-imports.test.mjs # S1's suite (38) — NOT run by S2
├── import-behavior.test.mjs  # S1's suite (22) — NOT run by S2
├── PRD.md / README.md        # read-only (doc fixes are T2 subtasks)
└── plan/006_1862a6537500/
    ├── architecture/external_deps.md     # ← the validated API surface (the "no API risk" basis)
    ├── architecture/system_context.md    # ← delta is "Verification + doc-audit (no new implementation)"
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
(none — verification gate)
# ONLY if a TS error forces a real type fix: file-injector.ts (minimal, real type correction; then re-run
# typecheck + S1's three suites). No other file is touched under any branch.
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL — the gate is `npm run typecheck` (== `node ./scripts/typecheck.mjs`), NOT `tsc -p tsconfig.json`.
#   The repo tsconfig.json has NO `paths` (the pi .d.ts lives in the GLOBAL node_modules, outside the repo), so
#   `tsc -p tsconfig.json` FAILS to resolve `@earendil-works/pi-coding-agent`. The script writes a TEMP tsconfig
#   with the correct `paths` and runs tsc on THAT. Running tsc directly on tsconfig.json is NOT the gate.

# CRITICAL — pi is installed GLOBALLY (the repo is dependency-free at the project level). The script resolves it
#   via `npm root -g`. If `npm root -g` fails or the global pi package is absent, the script exits 1 with a clear
#   message ("could not run `npm root -g`" / "pi .d.ts not found at … (is pi installed globally?)"). That is an
#   ENVIRONMENT issue, NOT a code regression — distinguish it from a real TS error (see Level 3).

# CRITICAL — the success message goes to STDERR (the script uses `console.error`), and `--listFiles` dumps the
#   file list to STDOUT. Assert BOTH the message text (`... (0 errors)`) AND exit code 0. Do NOT assume "no stdout
#   errors" == green (stdout has the file list; the human line is on stderr).

# CRITICAL — do NOT suppress a TS error with `@ts-ignore` / `as any`, and do NOT loosen `strict` or remove
#   `skipLibCheck` to force green (item §3). Fix the actual type mismatch in file-injector.ts. If the error is a
#   genuine Pi API break with no code-side fix, that is a `"result":"fail"` halt — but external_deps.md makes
#   this astronomically unlikely for v0.80.8.

# GOTCHA — the TypeScript version is PINNED (`npx --yes -p typescript@5.6`), so the check is deterministic across
#   machines/CI. A version-pinned gate means a red result is a real code/API issue, not a TS-version fluke.

# GOTCHA — if a type fix touches an EXPORTED symbol, the test module-surface guard (file-injector.test.mjs ~L137)
#   will catch an unlisted function. After any file-injector.ts fix, re-run S1's three suites (182 passed) to be
#   sure the fix didn't regress behavior or the module surface.

# LIBRARY — typescript@5.6 + `strict:true` + `skipLibCheck:true` + `moduleResolution:"Bundler"` +
#   `allowImportingTsExtensions:true`. Node ≥22 (engines). No project-level npm deps; pi is global.
```

## Implementation Blueprint

> There is no implementation. This is the **verification runbook**. The "tasks" are: run the typecheck, record
> the result, confirm 0 errors. (Adapted from the implementation template since this subtask produces no code.)

### Validated API surface → file-injector.ts routing (for failure diagnosis)

| Symbol a TS error might mention | file-injector.ts use site | Validated signature (external_deps.md) |
|---|---|---|
| `resizeImage` | injectFile image branch | `(Uint8Array, mime, opts?) => Promise<ResizedImage\|null>` |
| `ResizedImage` (type) | formatImageBlock / estimateImageTokens | `{ data; mimeType; originalWidth; originalHeight; width; height; wasResized }` |
| `formatDimensionNote` | formatImageBlock | `(ResizedImage) => string\|undefined` (arg must be non-null) |
| `CONFIG_DIR_NAME` / `getAgentDir` | readConfig (project / global settings path) | const / `() => string` |
| `ExtensionAPI` (type) | default factory param | exported type |
| `ImageContent` | state.images / handler `transform` return | `{ type:"image"; data:string; mimeType:string }` |
| `InputEvent` (source/streamingBehavior/text/images) | handler guards | literal-union members — exact match |
| `ctx.getContextUsage` | budget computation | `(): ContextUsage\|undefined` (non-optional) |
| `ctx.isProjectTrusted` | readConfig trust gate | `(): boolean` (non-optional) |
| `ctx.hasUI` / `ctx.ui.notify` / `ctx.ui.addAutocompleteProvider` | notify + autocomplete | field / method / method |
| `ctx.cwd` / `ctx.model` | resolution + budget | fields (model has contextWindow, maxTokens) |
| `AutocompleteProvider` (getSuggestions/applyCompletion/shouldTriggerFileCompletion) | session_start | shape unchanged |

### Failure-Diagnosis Protocol (ONLY if a TS error appears — NOT expected per baseline)

```text
1. DISCRIMINATE environment vs regression (Level 3):
   - "could not run `npm root -g`" / "pi .d.ts not found at … (is pi installed globally?)" → ENVIRONMENT issue
     (global pi package missing). Verify: `npm root -g` + `ls <that>/@earendil-works/pi-coding-agent/dist/index.d.ts`.
     NOT a code regression — do NOT edit file-injector.ts.
   - A `file-injector.ts(L,C): error TSNNNN: …` line → REAL type regression or pi API drift. Continue to step 2.
2. CHECK pi version drift: `cat <pipkg>/package.json | grep version`. If != 0.80.8, the API may have changed —
   re-validate the failing symbol against the new .d.ts (the external_deps table may be stale).
3. ROUTE the error symbol via the table above to the file-injector.ts site.
4. APPLY the MINIMAL real type fix in file-injector.ts (correct the type; never @ts-ignore/as-any; never loosen strict).
5. RE-RUN `npm run typecheck` → 0 errors. THEN re-run S1's three suites (182 passed) — a fix must not regress behavior.
```

### Integration Points

```yaml
NO CHANGES (verification gate): none of these are touched unless a TS error appears.
  - DATABASE: none
  - CONFIG: none (readConfig is type-checked, not changed)
  - ROUTES: none
  - The ONLY file that may change (and only if red) is file-injector.ts, with a minimal REAL type fix.
```

### Verification Tasks (ordered)

```yaml
Task 1: RUN the typecheck gate
  - CMD: npm run typecheck          (== node ./scripts/typecheck.mjs)
  - EXPECT: prints "typecheck: file-injector.ts type-checks clean under --strict (0 errors)" (on stderr) + exit 0.
  - RECORD the result line + exit code.

Task 2: CONFIRM green → GATE COMPLETE
  - If exit 0 + the "(0 errors)" message → DONE. Record "typecheck: 0 errors, exit 0".
  - No file changes. Stop here (the success path).

Task 3 (ONLY if red): DISCRIMINATE environment vs regression (Level 3)
  - Environment message (npm root -g / pi .d.ts not found) → fix the environment (install/global-link pi), NOT the code.
  - Real `error TSNNNN` line → continue to Task 4.

Task 4 (ONLY if a real TS error): APPLY the minimal real type fix, then re-verify
  - ROUTE the error symbol via the API-surface table; CHECK pi version drift; FIX the type in file-injector.ts
    (never @ts-ignore/as-any; never loosen strict/skipLibCheck).
  - RE-RUN: npm run typecheck → expect 0 errors, exit 0.
  - RE-RUN S1's three suites (node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs)
    → expect 182 passed, 0 failed (a type fix must not regress behavior or the module surface).

Task 5: CONFIRM scope discipline (no edits leaked)
  - file-injector.ts UNCHANGED on the green path (only touched if Task 4 forced a real fix);
  - tsconfig.json / scripts/typecheck.mjs / package.json / PRD / README / JSDoc / tasks.json / prd_snapshot UNCHANGED;
  - the three .mjs suites UNCHANGED; no new exports (the module-surface guard would catch an unlisted function).
```

## Validation Loop

### Level 1: The typecheck gate (the entire subtask)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected (success): the tsc --listFiles output, then (on stderr):
#   typecheck: file-injector.ts type-checks clean under --strict (0 errors)
# and exit code 0. Confirm with:
npm run typecheck > /dev/null 2>&1; echo "exit=$?"
# Expected: exit=0
```

### Level 2: Spot-check the validated API surface is exercised (optional — confirms WHY green is expected)

```bash
# The imports file-injector.ts relies on (must all resolve in the global pi .d.ts):
sed -n '1,6p' file-injector.ts
# Expected: the 6 import lines exactly matching external_deps.md (resizeImage, formatDimensionNote,
#           CONFIG_DIR_NAME, getAgentDir, type ResizedImage, ExtensionAPI, ImageContent).
# Confirm the global pi .d.ts exports them:
PIPKG="$(npm root -g)/@earendil-works/pi-coding-agent"
grep -lE "resizeImage|formatDimensionNote|CONFIG_DIR_NAME|getAgentDir" "$PIPKG/dist/index.d.ts" && echo "exports present"
```

### Level 3: Environment-vs-regression discrimination (ONLY if the gate is red)

```bash
# A) ENVIRONMENT failure (NOT a code regression) — the script prints one of these BEFORE any "error TS" line:
npm root -g
# → if this fails or is wrong, the global pi package isn't resolvable → install/link pi globally, do NOT edit code.
ls "$(npm root -g)/@earendil-works/pi-coding-agent/dist/index.d.ts"
# → if missing, pi isn't installed globally → environment issue.
#
# B) REAL type regression / API drift — a line like:
#   file-injector.ts(123,45): error TS2345: Argument of type '...' is not assignable ...
# → use the Failure-Diagnosis Protocol + the API-surface routing table; fix the CODE in file-injector.ts.
#
# C) Pi version drift check:
cat "$(npm root -g)/@earendil-works/pi-coding-agent/package.json" | grep '"version"'
# → if != 0.80.8, external_deps.md may be stale; re-validate the failing symbol against the new .d.ts.
```

### Level 4: Re-verify after any minimal type fix (ONLY if red)

```bash
# After a real type fix in file-injector.ts, re-run the typecheck AND S1's three suites (a fix must not regress):
npm run typecheck                                                                                       # → 0 errors, exit 0
node ./file-injector.test.mjs && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs    # → 182 passed, 0 failed
# Expected: typecheck green + 182 tests green. If a suite regressed, the type fix altered behavior — re-scope.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → prints `typecheck: file-injector.ts type-checks clean under --strict (0 errors)` + exit 0.
- [ ] No `@ts-ignore` / `as any` suppression; `strict:true` + `skipLibCheck:true` unchanged (item §3).

### Gate Integrity (the contract)

- [ ] The gate was run via `npm run typecheck` (the script), NOT `tsc -p tsconfig.json` (editor-hints-only).
- [ ] If a fix was needed: it was a MINIMAL real type fix confined to `file-injector.ts`; typecheck re-green;
      S1's three suites re-run to 182 passed; no new export slipped past the module-surface guard.

### Scope Discipline

- [ ] The three test suites (file-injector / relative-imports / import-behavior) were NOT run as S2's gate (S1's scope).
- [ ] PRD.md "24"→"32" doc fix was NOT applied here (T2.S1; and PRD.md is read-only).
- [ ] README/JSDoc coherence audit was NOT done here (T2.S2/T2.S3).
- [ ] tsconfig.json / scripts/typecheck.mjs / package.json / tasks.json / prd_snapshot UNCHANGED.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT run `tsc -p tsconfig.json` and treat it as the gate.** The repo `tsconfig.json` has no `paths`
  (the pi `.d.ts` is global), so it FAILS to resolve the package. The gate is `npm run typecheck` (the script,
  which writes a temp tsconfig with the correct `paths`). Running tsc directly on tsconfig.json gives a false red.
- ❌ **Do NOT suppress a TS error with `@ts-ignore` / `as any`** to force green (item §3). Fix the actual type
  mismatch in `file-injector.ts`. Suppression defeats the gate and hides a real regression/API drift.
- ❌ **Do NOT loosen `strict` or remove `skipLibCheck`** in tsconfig.json or the script to mask errors. The script
  owns the real options; tsconfig.json is hints-only. Loosening strictness is not a fix.
- ❌ **Do NOT conflate an ENVIRONMENT failure with a CODE regression.** A "could not run `npm root -g`" / "pi .d.ts
  not found" message is an environment issue (global pi missing) — fix the environment, NOT file-injector.ts.
  Only `error TSNNNN` lines are real regressions for the Failure-Diagnosis Protocol.
- ❌ **Do NOT treat the success message's location as a failure.** It prints to STDERR (`console.error`) while
  `--listFiles` dumps to STDOUT. Assert the message text + exit 0; don't assume "empty stdout" == green.
- ❌ **Do NOT scope-creep the test suites or docs into S2.** The three test suites are S1's gate; the PRD.md
  "24"→"32" fix is T2.S1 (and PRD.md is read-only); README/JSDoc audit is T2.S2/T2.S3. S2 is the typecheck ONLY.
- ❌ **Do NOT skip re-running S1's three suites after a type fix.** A type change to `file-injector.ts` can alter
  behavior or the module surface; always confirm 182 passed again alongside the green typecheck.
- ❌ **Do NOT edit tsconfig.json / scripts/typecheck.mjs / package.json.** These define the gate; editing them to
  pass is tampering with the gate, not fixing the code.

---

## Confidence Score: 10/10

Pure confirmation gate. The typecheck is **already verified green** during research (`0 errors`, exit 0, working
tree unmodified) against the installed pi v0.80.8, and `external_deps.md` confirms the entire API surface is
present + correctly typed. The executing agent runs ONE command (`npm run typecheck`), confirms the message +
exit 0, and is done — no implementation, no design risk. The only residual is the (unexpected) red branch,
which the environment-vs-regression discriminator + the symbol→file routing table + the "fix code, don't
suppress" rule make a short triage. -0 reflects that the gate is deterministic and the command is exact.
