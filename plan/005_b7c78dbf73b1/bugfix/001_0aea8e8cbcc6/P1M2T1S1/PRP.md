---
name: "P1.M2.T1.S1 (bugfix 001) — Verify T2.S1-f readConfig test-isolation fix is present, correct vs PRD §4.6, and the suite is green (fallback: apply PRD Issue 2 Suggested Fix if absent)"
prd_ref: "bugfix PRD §h3.1 Issue 2 (readConfig unit test T2.S1-f is environment-dependent — test-harness isolation gap); main PRD §4.6 (config sources / precedence / trust gate — L194-219)"
target_file: "./file-injector.test.mjs"   # VERIFY-ONLY in the primary path (fix is committed + green); FALLBACK edit ONLY if a fresh checkout lacks the isolation
target_language: JavaScript (.mjs test harness, zero-deps); gate = `node ./file-injector.test.mjs` (readConfig product code in file-injector.ts is NOT modified under any branch)
depends_on: "(none blocking — the T2.S1-* family + GLOBAL_BASELINE + the isolation fix are already committed in `342bd73`; S1 (R_OK gate + E5) and S2 (un-claim + E6) are also landed. This task VERIFIES the committed state.)"
consumed_by: "P1.M2.T2.S1 (README/doc sweep — for Issue 1 verbatim-on-error, NOT this test-isolation item; this item has no doc surface)"
---

# PRP — P1.M2.T1.S1 (bugfix 001): Verify & retain the T2.S1-f readConfig test-isolation fix

> **Scope flag:** This is a **VERIFICATION** task, not an implementation task. The bugfix plan's own architecture
> analysis (`test_harness_analysis.md` §"Issue 2 — the fix is ALREADY in the working tree") is explicit: the
> PRD §h3.1 prose describes the PRE-fix committed state; the working tree ALREADY has the fix (committed in
> `342bd73`). The task is: VERIFY the fix is present + correct vs PRD §4.6, RUN the suite to confirm green,
> ENSURE it is retained; apply the PRD "Suggested Fix" ONLY if a fresh checkout lacks it. **No source change to
> `file-injector.ts`** — readConfig is correct (it's the TEST that needed isolation). Empirically confirmed
> (2025-07-16): suite is GREEN at **`Result: 122 passed, 0 failed.`** with **`✓ case T2.S1-f`**.

---

## Goal

**Feature Goal:** Confirm the `T2.S1-f` readConfig unit test is deterministic regardless of the developer's real
global `~/.pi/agent/` config (PRD §h3.1 Issue 2), by verifying the already-committed isolation fix is present
and correct: it neutralizes the project dedicated file (`<TMPDIR>/.pi/file-injector.json`) for the duration of
the case so the settings.json `fileInjector` key is the ONLY project source under test, uses a baseline-relative
`flip`, asserts both the trust gate (untrusted→baseline) and the trusted project value (→flip) AND that they
differ, and restores the fixture in a `finally`.

**Deliverable:** A VERIFIED, suite-green `T2.S1-f` (read-only confirmation report + a green suite run). In the
PRIMARY path, **no file is edited** — the fix is committed and the suite passes. In the FALLBACK path (only if
a fresh checkout lacks the isolation), apply the exact PRD §h3.1 "Suggested Fix" pattern to `T2.S1-f`
(mirroring sibling `T2.S1-e`) and ensure it is retained. `file-injector.ts` is NOT modified under any branch.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **`0 failed`** AND **`✓ case T2.S1-f`** (the load-bearing assertions;
   count is ≥121 — currently **122** with the parallel S2's E6 landed; 121 if E6 is reverted in the checkout).
2. Verification checks (§Implementation Tasks Task 1) all PASS: the isolation (`PROJ_FILE_PATH="{}"`), the
   `GLOBAL_BASELINE`/`flip`, the trust-gate asserts (untrusted→baseline AND trusted→flip AND differ), and
   T2.S1-g's precedence coverage (dedicated file overrides settings.json key).
3. `git diff file-injector.ts` is **empty** (readConfig product code is correct and untouched).
4. The fix is **RETAINED** (present in the final working tree; not reverted).

## User Persona

**Target User:** Any developer/CI running `node ./file-injector.test.mjs` — especially one who has **dogfooded**
the `markdownBareAtImports` option globally (a real `~/.pi/agent/settings.json` or `file-injector.json` with the
key set). Without the isolation fix, `T2.S1-f` fails for them (env-dependent); with it, the suite is hermetic.

**Use Case:** `git clone … && node ./file-injector.test.mjs` passes deterministically on every machine,
regardless of the developer's real global pi config.

**Pain Points Addressed:** A flaky/env-dependent test (`T2.S1-f` failing only when the global config sets the
key) undermines trust in the suite and blocks clean CI. The isolation fix makes it deterministic.

## Why

- **Test quality, not a product bug (PRD §h3.1 severity: Minor).** `readConfig`'s behavior is INTENTIONAL and
  correct — within a scope, the dedicated file-injector.json (source #4) overrides the settings.json
  `fileInjector` key (source #3), per PRD §4.6 (main PRD.md L194-201). The bug was purely in the TEST: `T2.S1-f`
  forgot to neutralize #4 (which buildFixtures writes as `{markdownBareAtImports:true}`), so #4 masked the #3
  flip and the `trusted === flip` assertion failed whenever the global baseline was `true`.
- **The fix mirrors a sibling that already does it right.** `T2.S1-e` (file-injector.test.mjs:2045-2061) uses the
  EXACT isolation pattern (capture `fileValid` → `writeFileSync(PROJ_FILE_PATH,"{}")` → `writeSettings` → asserts
  → finally restore+rmSync). `T2.S1-f` now mirrors it — Issue 2 was that it originally didn't.
- **Baseline-relative assertions make the whole T2.S1-* family hermetic.** `GLOBAL_BASELINE` (L1972) captures the
  REAL global contribution; `flip` = its negation. Every case asserts RELATIVE to the baseline, so the suite is
  deterministic in a clean env AND a dogfooded env. This is the correct hermetic pattern (the product reads the
  real global sources at runtime; the test isolates the PROJECT sources under TMPDIR and asserts relative to the
  captured baseline).
- **Verification, not re-implementation.** Re-applying a fix that's already committed would be wasted work and
  risks introducing a regression. The architecture analysis says "Do NOT re-implement." This task confirms the
  committed fix + runs the suite + ensures retention.

## What

No user-visible / API / config / product-code surface change. In the PRIMARY path, **no file is edited** — this
is a read-only verification + a suite run. The verification confirms: (a) the isolation is present in `T2.S1-f`;
(b) the case asserts the trust gate correctly (both directions + they differ); (c) the precedence behavior is
covered by `T2.S1-g` (so neutralizing #4 in `T2.S1-f` is correct isolation, not a masking of real behavior);
(d) the suite is green. The FALLBACK (apply the fix) fires ONLY if a fresh checkout lacks the isolation.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → **`0 failed`**, exit 0; output contains **`✓ case T2.S1-f`**.
- [ ] `grep -n 'fsSync.writeFileSync(PROJ_FILE_PATH, "{}")' file-injector.test.mjs` returns ≥2 hits, including
      one inside `T2.S1-f` (the runCase at L2063; the neutralization at L2066).
- [ ] `T2.S1-f` asserts ALL THREE: `untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports`,
      `trusted.markdownBareAtImports === flip`, AND `trusted !== untrusted` (L2069-2077).
- [ ] `T2.S1-g` (L2086) asserts the dedicated file overrides the settings.json key (`=== false` wins).
- [ ] `git diff file-injector.ts` is **empty** (readConfig untouched; no source change under any branch).
- [ ] The fix is RETAINED in the final working tree (present after the task; not reverted).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the empirical current state (suite GREEN at 122, ✓ T2.S1-f, fix committed in
`342bd73`), the EXACT current `T2.S1-f` body (L2063-2082) with line-precise annotations, the PRD §4.6 four-source
precedence table (WHY #4 must be neutralized), the proof that T2.S1-g covers precedence (WHY neutralizing is
correct, not masking), the read-only verification checks (exact grep commands + expected line hits), the
authoritative suite-run command + expected output, and the FALLBACK apply (exact PRD "Suggested Fix" pattern,
mirroring T2.S1-e) — which fires ONLY if a fresh checkout lacks the isolation. The implementer runs read-only
checks + a suite run; edits ONLY in the fallback.

### Documentation & References

```yaml
# MUST READ — the authoritative framing: the fix is ALREADY committed; VERIFY, do NOT re-implement
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/test_harness_analysis.md
  why: "§'Issue 2 — the fix is ALREADY in the working tree' is explicit: 'Do NOT re-implement.' It lists the 5
        elements of the already-applied fix (capture fileValid → write '{}' to PROJ_FILE_PATH → writeSettings
        flip → asserts untrusted→baseline & trusted→flip → finally restore) and states the task is VERIFY the
        fix is correct & complete + confirm the suite is green + ensure it is RETAINED; apply the Suggested Fix
        ONLY if a fresh checkout lacks it."
  critical: "The PRD §h3.1 prose ('does NOT isolate the project dedicated file') describes the PRE-fix committed
             state, NOT the current working tree. Trust the working tree (empirically green), not the stale prose."

# MUST READ — the bug being verified (env-dependent T2.S1-f) + the Suggested Fix (the FALLBACK pattern)
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/prd_snapshot.md   # (or the bugfix PRD §h3.1)
  why: "§h3.1 Issue 2: T2.S1-f mutates only PROJ_SETTINGS_PATH and forgets to empty PROJ_FILE_PATH; readConfig's
        documented within-scope precedence (dedicated file OVERRIDES the settings.json key) makes trusted resolve
        to true regardless of flip → fails when the global baseline is true. The 'Suggested Fix' is the exact
        pattern now present at L2063-2082 (and the FALLBACK apply spec)."
  section: "h3.1 Issue 2 (Suggested Fix code block)"

# MUST READ — WHY the isolation is required (4-source precedence; #4 overrides #3 within a scope)
- file: PRD.md   # (the MAIN product PRD — §4.6 config sources)
  why: "§4.6 (L194-219) defines four config sources shallow-merged in precedence order: (1) global settings.json
        fileInjector key, (2) global file-injector.json, (3) project settings.json fileInjector key (trusted only),
        (4) project file-injector.json (trusted only). 'each row overrides the one above; project overrides global;
        within a scope the dedicated file overrides the settings.json key.' So #4 (the buildFixtures
        {markdownBareAtImports:true}) overrides #3 (the flip) → T2.S1-f MUST neutralize #4 to test #3's trust gate."
  section: "§4.6 'Config sources' table (L194-201) + 'Loading' (L219)"

# The file under verification (PRIMARY path: read-only; FALLBACK: edit T2.S1-f only)
- file: file-injector.test.mjs
  why: "GLOBAL_BASELINE L1972; PROJ_SETTINGS_PATH L2039; PROJ_FILE_PATH L2040; writeSettings L2041; T2.S1-e
        (sibling isolation template) L2045-2061; T2.S1-f (the case under verification) L2063-2082; T2.S1-g
        (precedence coverage) L2086-2102. runCase(n,name,fn) harness at L88; assert(cond,msg) throws on failure."
  pattern: "T2.S1-f mirrors T2.S1-e's isolation: capture → neutralize PROJ_FILE_PATH → writeSettings → asserts →
            finally restore+rmSync. The baseline-relative `flip` + the three asserts (untrusted→baseline,
            trusted→flip, differ) make it hermetic."
  gotcha: "readConfig reads the REAL global ~/.pi/agent/ sources at runtime (getAgentDir). The test does NOT mock
           the global; it captures GLOBAL_BASELINE and asserts RELATIVE to it (the correct hermetic pattern — see
           T2.S1-a..d, all baseline-relative). Do NOT add a global mock; do NOT change readConfig."

# The product code — UNCHANGED (verify-only; the bug is in the TEST, not readConfig)
- file: file-injector.ts
  why: "readConfig at L749-764 reads all four sources in precedence order (SETTINGS_KEY='fileInjector', L751).
        It is CORRECT — the dedicated file DOES override the settings.json key within a scope, exactly as the
        test (post-fix) expects. `git diff file-injector.ts` MUST be empty after this task."
  gotcha: "Do NOT modify readConfig or any other line in file-injector.ts. The isolation lives in the TEST."

# (No external/library docs needed — this is a zero-deps .mjs test-harness verification.)
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← VERIFY (read-only) in primary path; T2.S1-f L2063-2082; FALLBACK edit ONLY if isolation absent
├── file-injector.ts          # ← UNCHANGED (readConfig L749-764 is correct; git diff must be empty)
├── scripts/typecheck.mjs     # untouched (run as belt-and-suspenders only)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (no doc surface for this test-isolation item)
└── plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/
    ├── architecture/{code_changes_analysis.md, system_context.md, test_harness_analysis.md}   # test_harness_analysis.md §"Issue 2" = the framing
    ├── P1M1T1S1/{research, PRP.md}   # S1 (R_OK gate + E5) — LANDED
    ├── P1M1T1S2/{research, PRP.md}   # S2 (un-claim + E6) — LANDED (parallel; landed before this task)
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
# PRIMARY path (fix is committed + green): NO files touched. This is a read-only verification + a suite run.
file-injector.test.mjs    # UNCHANGED (verified: T2.S1-f isolation present at L2063-2082)
file-injector.ts          # UNCHANGED (readConfig correct; git diff empty)

# FALLBACK path (ONLY if a fresh checkout lacks the T2.S1-f isolation):
file-injector.test.mjs    # MODIFIED — T2.S1-f gains the isolation (capture fileValid → writeFileSync(PROJ_FILE_PATH,"{}")
                          #                  → writeSettings({fileInjector:{markdownBareAtImports:flip}}) → asserts →
                          #                  finally restore+rmSync), mirroring sibling T2.S1-e (L2045-2061).
# file-injector.ts is NEVER modified under either branch.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — this is a VERIFICATION task. The fix is ALREADY COMMITTED (git log: 342bd73). The PRIMARY path is
//   read-only: run the verification checks (Task 1) + the suite (Task 2) + confirm retention (Task 3). Do NOT
//   edit any file unless the verification finds the isolation ABSENT (the FALLBACK, Task 4). The architecture
//   analysis says "Do NOT re-implement."

// CRITICAL — NEVER modify file-injector.ts. readConfig (L749-764) is CORRECT: the dedicated file overriding the
//   settings.json key within a scope is the INTENTIONAL, documented PRD §4.6 behavior. The bug was in the TEST
//   (T2.S1-f forgot to isolate #4), not the product. `git diff file-injector.ts` MUST be empty after this task.

// CRITICAL — the neutralization in T2.S1-f is NOT masking real behavior; T2.S1-g covers precedence. T2.S1-g
//   (L2086-2102) separately proves #4 overrides #3 (dedicated file false wins over settings key true). So
//   neutralizing #4 in T2.S1-f is the correct ISOLATION for testing #3's trust gate — not a behavior mask.
//   (Item logic §3c.) If you "fix" T2.S1-f by removing the neutralization, you reintroduce Issue 2.

// GOTCHA — readConfig reads the REAL global ~/.pi/agent/ sources at runtime (getAgentDir → real home dir). The
//   test does NOT mock the global. It captures GLOBAL_BASELINE (L1972, with isProjectTrusted:()=>false + a
//   nonexistent cwd → only the real global sources contribute) and asserts every case RELATIVE to it. This is the
//   correct hermetic pattern; do NOT add a global mock and do NOT assume the global is empty.

// GOTCHA — the suite count is ≥121, currently 122. The item expected "121 (120 + E5)"; the actual is 122 because
//   the parallel S2 (E6: un-claim on injectFile failure) has LANDED (E6 passes; file-injector.ts:729 has the
//   delete(abs), committed). The LOAD-BEARING assertion for THIS task is `✓ case T2.S1-f` + 0 failures — robust
//   to E6's presence. Do not "fix" the count; report whatever the suite prints (122 now).

// GOTCHA — `flip = GLOBAL_BASELINE.markdownBareAtImports === true ? false : true` guarantees the trusted value is
//   DISTINGUISHABLE from the baseline, so the trust-gate assertion (trusted !== untrusted) holds in every env.
//   This is the second hermetic lever (the first is neutralizing #4). Both are required; neither alone suffices.

// LIBRARY — zero-deps .mjs harness loaded via Pi's own jiti + alias mechanism (identical to the product). No build
//   step. The gate is `node ./file-injector.test.mjs`. `npm run typecheck` (tsc --strict) is belt-and-suspenders
//   only (the .mjs is untyped; readConfig in the .ts is unchanged → 0 errors regardless).
```

## Implementation Blueprint

### The verification logic (read-only) — encode as the PRIMARY path

This task's "implementation" is a sequence of read-only checks + a suite run. There is no data model, no new
code in the primary path. The verification confirms the five elements of the PRD §h3.1 "Suggested Fix" are all
present in `T2.S1-f` (file-injector.test.mjs:2063-2082):

1. **Capture** `fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? readFileSync(PROJ_FILE_PATH,"utf8") : null` (L2065).
2. **Neutralize** `fsSync.writeFileSync(PROJ_FILE_PATH, "{}")` (L2066) — the exact isolation Issue 2 asks for.
3. **Write the key** `writeSettings({ "fileInjector": { markdownBareAtImports: flip } })` (L2067), `flip` = negation of baseline (L2064).
4. **Assert** `untrusted → baseline` AND `trusted → flip` AND `trusted !== untrusted` (L2069-2077).
5. **Restore** in `finally`: `writeFileSync(PROJ_FILE_PATH, fileValid)` + `rmSync(PROJ_SETTINGS_PATH, {force:true})` (L2079-2081).

### Implementation Tasks (ordered — PRIMARY path is verify-only)

```yaml
Task 1 (PRIMARY — VERIFY, read-only): confirm the T2.S1-f isolation is present + correct
  - RUN: grep -n 'fsSync.writeFileSync(PROJ_FILE_PATH, "{}")' file-injector.test.mjs
    EXPECT: ≥2 hits — T2.S1-e (L2047) AND T2.S1-f (L2066). If T2.S1-f's hit (L2066) is ABSENT → FALLBACK (Task 4).
  - RUN: sed -n '2063,2082p' file-injector.test.mjs   # the T2.S1-f body
    EXPECT: the 5 elements above (flip L2064; fileValid capture L2065; neutralize L2066; writeSettings L2067;
            the 3 asserts L2069-2077; finally restore+rmSync L2079-2081). Match against the PRP's exact body.
  - RUN: sed -n '2086,2102p' file-injector.test.mjs   # T2.S1-g precedence
    EXPECT: asserts `r.markdownBareAtImports === false` (dedicated file false wins over settings key true) →
            confirms neutralizing #4 in T2.S1-f is correct isolation, not a behavior mask (item §3c).
  - RUN: git diff --stat file-injector.ts
    EXPECT: EMPTY (readConfig product code is correct and untouched). If non-empty, STOP — readConfig must not change.
  - DO NOT edit anything in Task 1. This is read-only confirmation.

Task 2 (PRIMARY — RUN the suite): confirm green + ✓ T2.S1-f
  - RUN: node ./file-injector.test.mjs
    EXPECT: `Result: 122 passed, 0 failed.` (or ≥121; the load-bearing signals are `0 failed` + `✓ case T2.S1-f`).
            Exit code 0. The output contains `  ✓ case T2.S1-f: readConfig settings.json key + UNTRUSTED → ignored …`.
  - IF T2.S1-f shows `✗` (e.g. "trusted → settings.json key value (false), got true") → the isolation is absent or
    regressed → proceed to FALLBACK (Task 4). (Empirically it PASSES in the current tree.)
  - IF a DIFFERENT case fails → that is NOT this task's scope (report it; do not chase unrelated failures here).

Task 3 (PRIMARY — ENSURE RETAINED): confirm the fix is in the working tree + will not be reverted
  - RUN: git status --short file-injector.test.mjs   # CLEAN (committed in 342bd73) — OR, if Task 4 applied it, MODIFIED.
  - RUN: git log --oneline -3 -- file-injector.test.mjs   # shows the commit(s) carrying the T2.S1-* family + isolation.
  - DO NOT revert/stash the T2.S1-f isolation. If Task 4 applied it, LEAVE the edit (it is the fix; "ensure RETAINED").
  - (Optional belt-and-suspenders) npm run typecheck → 0 errors (readConfig in the .ts is unchanged → trivially clean).

Task 4 (FALLBACK — apply the Suggested Fix; fires ONLY if Task 1 finds the isolation ABSENT in T2.S1-f):
  - TRIGGER: Task 1's grep did NOT find `fsSync.writeFileSync(PROJ_FILE_PATH, "{}")` inside T2.S1-f (L2063-2082),
    OR Task 2's T2.S1-f shows `✗` with the env-dependent failure message.
  - EDIT T2.S1-f (file-injector.test.mjs) to add the isolation, MIRRORING sibling T2.S1-e (L2045-2061). The exact
    pattern (PRD §h3.1 "Suggested Fix"):
        const flip = GLOBAL_BASELINE.markdownBareAtImports === true ? false : true;
        const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;
        fsSync.writeFileSync(PROJ_FILE_PATH, "{}");          // ← isolate the dedicated file (#4 beats #3)
        writeSettings({ "fileInjector": { markdownBareAtImports: flip } });
        try {
          const untrusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => false });
          const trusted   = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
          assert(untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports, `…`);
          assert(trusted.markdownBareAtImports === flip, `…`);
          assert(trusted.markdownBareAtImports !== untrusted.markdownBareAtImports, `…`);
        } finally {
          if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid);
          fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
        }
  - DO NOT modify file-injector.ts (readConfig is correct). DO NOT touch T2.S1-e/T2.S1-g/any other case.
  - RE-RUN: node ./file-injector.test.mjs → `✓ case T2.S1-f`, 0 failed.
  - ENSURE RETAINED: leave the edit in the working tree (commit per the team's workflow); do NOT revert it.

Task 5 (REPORT): summarize the verification outcome
  - Report: (a) which path ran (PRIMARY verify-only, or FALLBACK applied); (b) the suite Result line; (c) ✓ T2.S1-f;
            (d) git diff file-injector.ts empty; (e) the fix is retained.
```

### Integration Points

```yaml
FILE_EDITS:
  - PRIMARY path: NONE (read-only verification + suite run; fix is committed + green).
  - FALLBACK path (ONLY if isolation absent): file-injector.test.mjs T2.S1-f (L2063-2082) gains the isolation
    (capture fileValid → writeFileSync(PROJ_FILE_PATH,"{}") → writeSettings(flip) → asserts → finally restore+rmSync),
    mirroring T2.S1-e. file-injector.ts is NEVER edited.

NO_CHANGES (either path): file-injector.ts (readConfig L749-764 is correct), package.json, scripts/typecheck.mjs,
  PRD.md, README.md, all plan/ files, any OTHER test case (T2.S1-a..e, T2.S1-g, T2.S1-h, E5, E6, cases 1-28, etc.).

NO_PRODUCT_CHANGE: readConfig's behavior (dedicated file overrides settings.json key within a scope, per PRD §4.6)
  is INTENTIONAL and correct. The isolation lives in the TEST, not the product. `git diff file-injector.ts` MUST be empty.
```

## Validation Loop

### Level 1: The suite run (the authoritative gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected (current working tree): 
#   …
#     ✓ case T2.S1-f: readConfig settings.json key + UNTRUSTED → ignored (baseline); trusted → project value
#     ✓ case T2.S1-g: readConfig precedence: file-injector.json overrides settings.json key (false wins)
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 122 passed, 0 failed.
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
# LOAD-BEARING: `0 failed` + `✓ case T2.S1-f`. (Count is ≥121; 122 with the parallel S2's E6 landed.)
# If T2.S1-f shows ✗ with "trusted → settings.json key value (false), got true" → the isolation is absent/regressed
# → FALLBACK (Task 4). (Empirically PASSES in the current committed tree.)
```

### Level 2: Verification checks (read-only)

```bash
cd /home/dustin/projects/pi-file-injector
# (a) Isolation present in BOTH T2.S1-e and T2.S1-f:
grep -n 'fsSync.writeFileSync(PROJ_FILE_PATH, "{}")' file-injector.test.mjs
# Expected: file-injector.test.mjs:2047 (T2.S1-e) AND file-injector.test.mjs:2066 (T2.S1-f). ≥2 hits.

# (b) GLOBAL_BASELINE + flip present:
grep -n 'GLOBAL_BASELINE = await\|markdownBareAtImports === true ? false : true' file-injector.test.mjs
# Expected: L1972 (baseline capture) + L1998 (T2.S1-c flip) + L2064 (T2.S1-f flip).

# (c) The trust-gate asserts (untrusted→baseline AND trusted→flip AND differ):
sed -n '2069,2077p' file-injector.test.mjs
# Expected: 3 assert() calls — untrusted===baseline; trusted===flip; trusted!==untrusted.

# (d) T2.S1-g covers precedence (dedicated file wins):
sed -n '2086,2102p' file-injector.test.mjs
# Expected: asserts r.markdownBareAtImports === false (file-injector.json false overrides settings.json true).

# (e) readConfig product code UNCHANGED:
git diff --stat file-injector.ts
# Expected: EMPTY (no output). readConfig (L749-764) is correct and untouched.
```

### Level 3: Retention + belt-and-suspenders

```bash
cd /home/dustin/projects/pi-file-injector
git status --short file-injector.test.mjs file-injector.ts
# Expected (PRIMARY): both CLEAN (committed). (FALLBACK: file-injector.test.mjs MODIFIED, file-injector.ts CLEAN.)
git log --oneline -3 -- file-injector.test.mjs
# Expected: 342bd73 (Gate markdown imports on readability) is the head commit carrying the T2.S1-* family + isolation.

npm run typecheck    # belt-and-suspenders only (readConfig in .ts is unchanged → trivially 0 errors)
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
```

### Level 4: Environment-robustness sanity (the whole point of Issue 2)

```bash
# The fix makes T2.S1-f deterministic regardless of the dev's REAL global config. To confirm hermeticity, inspect
# the assert strategy (already done in Level 2c): it asserts RELATIVE to GLOBAL_BASELINE + uses flip (negation).
# No additional command needed — the baseline-relative asserts (Level 2c) ARE the hermeticity guarantee.
# (If you want to PROVE it under a dogfooded global: ensure ~/.pi/agent/settings.json has
#  "fileInjector":{"markdownBareAtImports":true}, then `node ./file-injector.test.mjs` → still `✓ case T2.S1-f`.
#  This is exactly the env where the PRE-fix T2.S1-f failed — the fix makes it pass there too.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → **`0 failed`**, exit 0; output contains **`✓ case T2.S1-f`**.
- [ ] `git diff --stat file-injector.ts` is **EMPTY** (readConfig product code untouched — no source change).
- [ ] (PRIMARY path) no file was edited; (FALLBACK path) only `T2.S1-f` in `file-injector.test.mjs` was edited.

### Feature Validation (the isolation correctness)

- [ ] `T2.S1-f` neutralizes `PROJ_FILE_PATH` (`writeFileSync(PROJ_FILE_PATH, "{}")` at L2066) for the case duration.
- [ ] `T2.S1-f` uses `flip` = negation of `GLOBAL_BASELINE.markdownBareAtImports` (L2064).
- [ ] `T2.S1-f` asserts ALL THREE: untrusted→baseline (L2070-2072), trusted→flip (L2073-2075), trusted≠untrusted (L2076-2077).
- [ ] `T2.S1-f` restores `PROJ_FILE_PATH` + removes `PROJ_SETTINGS_PATH` in a `finally` (L2079-2081).
- [ ] `T2.S1-g` (L2086-2102) covers precedence (dedicated file false wins) → neutralizing #4 in T2.S1-f is correct isolation.

### Code Quality Validation

- [ ] `T2.S1-f` mirrors sibling `T2.S1-e`'s isolation pattern (capture → neutralize → writeSettings → asserts → finally).
- [ ] `T2.S1-f`'s asserts are baseline-RELATIVE (hermetic to the dev's real global config) — NOT absolute values.
- [ ] No new fixtures, no new helpers, no module-surface/guard edits (PRIMARY path edits nothing; FALLBACK edits T2.S1-f only).
- [ ] readConfig's behavior is unchanged (the bug was in the test, not the product).

### Documentation & Deployment

- [ ] No doc surface (test-harness-only). The optional bare-@ behavior is already documented (README.md:103, PRD §4.6).
- [ ] No README/PRD/plan edits. (The bugfix plan's P1.M2.T2.S1 owns the Issue 1 README/doc sweep — NOT this item.)

---

## Anti-Patterns to Avoid

- ❌ **Do NOT re-implement the fix if it's already present + green.** The architecture analysis is explicit: "Do NOT
  re-implement." Verify (read-only) + run the suite; edit ONLY in the FALLBACK (isolation absent in a fresh checkout).
- ❌ **Do NOT modify `file-injector.ts` / readConfig.** readConfig (L749-764) is CORRECT: the dedicated file overriding
  the settings.json key within a scope is the INTENTIONAL PRD §4.6 behavior. The bug was in the TEST. `git diff
  file-injector.ts` MUST be empty. Modifying readConfig to "fix" the test would BREAK the documented precedence.
- ❌ **Do NOT remove the `PROJ_FILE_PATH="{}"` neutralization from T2.S1-f** thinking it "masks" behavior. T2.S1-g
  separately covers precedence (#4 beats #3); the neutralization is the correct ISOLATION for testing #3's trust gate.
  Removing it reintroduces Issue 2 (env-dependent failure when the global baseline is true).
- ❌ **Do NOT mock the global config.** readConfig reads the REAL `~/.pi/agent/` sources at runtime; the test captures
  `GLOBAL_BASELINE` and asserts RELATIVE to it. That IS the hermetic pattern. Adding a global mock couples the test to
  an assumed-empty global (exactly the fragility Issue 2 fixed).
- ❌ **Do NOT chase the suite count to "121".** The item expected 121 (120 + E5); the actual is **122** because the
  parallel S2 (E6) landed (E6 passes; `file-injector.ts:729` has the `delete(abs)`). The load-bearing signal is
  `✓ case T2.S1-f` + `0 failed`, robust to E6's presence. Report the actual count (122).
- ❌ **Do NOT touch sibling cases** (T2.S1-a..e, T2.S1-g, T2.S1-h, E5, E6, cases 1-28) in the FALLBACK. Edit T2.S1-f ONLY.
- ❌ **Do NOT revert the isolation** after applying it (FALLBACK). Item §3: "Ensure the change is RETAINED (do not revert it)."

---

## Confidence Score: 10/10

This is a verification task and the outcome is already empirically confirmed: the suite is GREEN (`Result: 122
passed, 0 failed.`) with `✓ case T2.S1-f`, the isolation fix is COMMITTED (git log `342bd73`), `file-injector.ts`
is clean (readConfig untouched), and the PRD §h3.1 "Suggested Fix" is present byte-for-byte at
`file-injector.test.mjs:2063-2082` (capture `fileValid` → neutralize `PROJ_FILE_PATH="{}"` → `writeSettings(flip)`
→ 3 trust-gate asserts → finally restore+rmSync), mirroring sibling `T2.S1-e`, with `T2.S1-g` covering the
precedence the neutralization isolates. The PRIMARY path is read-only (verify + run); the FALLBACK (apply the
exact Suggested Fix, T2.S1-f only) fires ONLY if a fresh checkout lacks the isolation. There is no product-code
change under any branch. The only residual uncertainty is the FALLBACK trigger (a fresh checkout without the
committed edit) — which the PRP handles with the exact apply spec, and which does not arise in the current tree.
