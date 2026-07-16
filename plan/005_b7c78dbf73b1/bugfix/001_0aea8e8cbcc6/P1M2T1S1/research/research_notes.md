# Research Notes — P1.M2.T1.S1 (bugfix 001): Verify T2.S1-f isolation fix is present, correct, suite green

**Item:** Verify the already-applied T2.S1-f readConfig test-isolation fix (PRD §h3.1 Issue 2) is present,
correct vs PRD §4.6, and the suite is green. Fallback: apply the PRD "Suggested Fix" ONLY if absent.

---

## 0. This is a VERIFICATION task, not an implementation task

The bugfix plan's own architecture analysis
(`plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/test_harness_analysis.md`, §"Issue 2 — the fix is
ALREADY in the working tree") is explicit: **"Do NOT re-implement."** The PRD §h3.1 prose ("does NOT isolate
the project dedicated file") describes the PRE-fix committed state, NOT the current working tree. The task is:
VERIFY the fix is correct & complete, confirm the suite is green, ensure it is RETAINED; apply the fix ONLY if
a fresh checkout lacks it. **No source change to file-injector.ts** (readConfig is correct — it's the TEST that
needed isolation).

## 1. Empirically verified working-tree state (2025-07-16)

- `git status --short`: `file-injector.test.mjs` is **CLEAN** (not in the modified list); `file-injector.ts` is
  **CLEAN**. The fix is **COMMITTED** (the item's "uncommitted edit" snapshot predates the commit).
- `git log -- file-injector.test.mjs` last commit: `342bd73 Gate markdown imports on readability`.
- **Suite run: `Result: 122 passed, 0 failed.`, exit 0.** `✓ case T2.S1-f`, `✓ case T2.S1-g`, `✓ case T2.S1-e`,
  `✓ case E5`, `✓ case E6`.

  NOTE on count: the item expected "121 passed (120 + E5)". The actual count is **122** because the PARALLEL
  sibling **P1.M1.T1.S2 (E6: un-claim on injectFile failure) has ALREADY landed** (E6 passes; `git status` shows
  file-injector.ts clean → S2's `state.injectedSet.delete(abs)` at file-injector.ts:729 is committed). So the
  current baseline is 122. The KEY invariant for THIS task is `✓ case T2.S1-f` + **0 failures** — robust to E6's
  presence (count is ≥121; exactly 122 with E6 landed).

## 2. The T2.S1-f isolation fix — EXACT current code (file-injector.test.mjs:2063-2082)

```js
await runCase("T2.S1-f", "readConfig settings.json key + UNTRUSTED → ignored (baseline); trusted → project value", async () => {
  const flip = GLOBAL_BASELINE.markdownBareAtImports === true ? false : true;          // L2064 — negation of baseline (guaranteed ≠ baseline)
  const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;  // L2065 — capture dedicated file
  fsSync.writeFileSync(PROJ_FILE_PATH, "{}");   // L2066 — NEUTRALIZE the dedicated file (#4 beats #3; without this trusted=true regardless of flip)
  writeSettings({ "fileInjector": { markdownBareAtImports: flip } });                  // L2067 — write the settings.json KEY (the project source under test)
  try {
    const untrusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => false });
    const trusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports, …);   // untrusted → baseline (key IGNORED — trust gate)
    assert(trusted.markdownBareAtImports === flip, …);                                       // trusted → flip (settings.json key value)
    assert(trusted.markdownBareAtImports !== untrusted.markdownBareAtImports, …);            // the two DIFFER → the gate is real
  } finally {
    if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid);                  // restore {markdownBareAtImports:true}
    fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
  }
});
```

**This EXACTLY matches the PRD §h3.1 Issue 2 "Suggested Fix":** capture `fileValid` → write `"{}"` to
`PROJ_FILE_PATH` (isolate) → `writeSettings({fileInjector:{markdownBareAtImports:flip}})` → asserts → finally
restore + rmSync. Every element of the Suggested Fix is present:
1. ✓ `const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? readFileSync(...) : null;`
2. ✓ `fsSync.writeFileSync(PROJ_FILE_PATH, "{}");` (the neutralization — the exact isolation the PRD asks for)
3. ✓ `writeSettings({ "fileInjector": { markdownBareAtImports: flip } });`
4. ✓ `flip` = negation of `GLOBAL_BASELINE.markdownBareAtImports`
5. ✓ asserts `untrusted → baseline` AND `trusted → flip` AND they differ
6. ✓ `finally { restore fileValid; rmSync(PROJ_SETTINGS_PATH) }`

## 3. WHY the neutralization is required (PRD §4.6 — main PRD.md L194-219)

PRD §4.6 defines FOUR config sources, shallow-merged in precedence order (each row overrides the one above;
project overrides global; **within a scope the dedicated file overrides the settings.json key**):

| # | Source | Path | Form | Gate |
|---|---|---|---|---|
| 1 | Global settings | `~/.pi/agent/settings.json` | `fileInjector` key | always |
| 2 | Global extension file | `~/.pi/agent/file-injector.json` | whole file | always |
| 3 | Project settings | `<cwd>/.pi/settings.json` | `fileInjector` key | trusted only |
| 4 | Project extension file | `<cwd>/.pi/file-injector.json` | whole file | trusted only |

`readConfig` (file-injector.ts:749-764) reads all four in this order. In the test, buildFixtures writes
`<TMPDIR>/.pi/file-injector.json` = `{"markdownBareAtImports":true}` (source #4). T2.S1-f tests the SETTINGS
KEY (source #3) by writing `<TMPDIR>/.pi/settings.json` with `fileInjector.markdownBareAtImports = flip`. But
**#4 overrides #3 within the project scope** → without neutralizing #4, `trusted.markdownBareAtImports` resolves
to `true` (from #4) REGARDLESS of `flip` → the `trusted === flip` assertion fails whenever the captured
`GLOBAL_BASELINE` is `true` (i.e. the dev dogfooded the option globally). Neutralizing #4 (`writeFileSync(PROJ_FILE_PATH, "{}")`)
for the case duration makes #3 the ONLY project source under test → deterministic regardless of the global env.

The `flip` (negation of `GLOBAL_BASELINE`) is the second robustness lever: it guarantees the trusted value is
DISTINGUISHABLE from the baseline, so the trust-gate assertion (`trusted !== untrusted`) holds in every env
(clean or dogfooded).

## 4. WHY neutralizing #4 is NOT masking real behavior (T2.S1-g covers precedence)

T2.S1-g (file-injector.test.mjs:2086-2102) **separately** proves source #4 overrides #3: it writes settings.json
`fileInjector.markdownBareAtImports:true` AND the dedicated file `{markdownBareAtImports:false}`, then asserts
the result is `false` (the file wins). So the precedence behavior (#4 > #3) is pinned by T2.S1-g; T2.S1-f's
neutralization is the correct ISOLATION for testing the KEY's trust gate (not a masking of the precedence).
This is the item's logic §3(c): "the dedicated-file precedence case T2.S1-g still proves the dedicated file
overrides the settings.json key (so neutralizing it in T2.S1-f is the right isolation, not a masking of real behavior)."

## 5. Helpers + sibling pattern (file-injector.test.mjs)

- `GLOBAL_BASELINE` (L1972): `await mod.readConfig({ cwd: <nonexistent>, isProjectTrusted: () => false })` —
  captures the REAL global sources' contribution (readConfig reads the REAL `~/.pi/agent/...` at runtime). Every
  case asserts RELATIVE to this baseline (not an absolute value), so the suite is deterministic regardless of
  the dev's real global config.
- `PROJ_SETTINGS_PATH` = `<TMPDIR>/.pi/settings.json` (L2039); `PROJ_FILE_PATH` = `<TMPDIR>/.pi/file-injector.json` (L2040);
  `writeSettings(obj)` → writeFileSync(PROJ_SETTINGS_PATH, JSON.stringify(obj)) (L2041).
- T2.S1-e (L2045-2061, sibling): the EXACT same isolation pattern (capture `fileValid` → `writeFileSync(PROJ_FILE_PATH,"{}")`
  → `writeSettings` → asserts → finally restore+rmSync). T2.S1-f mirrors T2.S1-e — which is the whole point of
  Issue 2 (T2.S1-f originally forgot the T2.S1-e neutralization).

## 6. Verification checks (read-only) the implementer runs

(a) **Isolation present** — `grep -n 'fsSync.writeFileSync(PROJ_FILE_PATH, "{}")' file-injector.test.mjs` MUST
    return ≥2 lines (T2.S1-e L2047 + T2.S1-f L2066); specifically L2066 is inside T2.S1-f (L2063).
(b) **GLOBAL_BASELINE + flip** — `grep -n 'GLOBAL_BASELINE\|=== true ? false : true' file-injector.test.mjs`
    shows the baseline capture (L1972) + flip (L1998 T2.S1-c, L2064 T2.S1-f).
(c) **Trust-gate asserts** — T2.S1-f asserts BOTH `untrusted === baseline` AND `trusted === flip` AND
    `trusted !== untrusted` (L2069-2077).
(d) **Precedence covered** — T2.S1-g (L2086) asserts `r.markdownBareAtImports === false` (dedicated file wins).
(e) **readConfig product code unchanged** — `git diff file-injector.ts` is empty (readConfig L749-764 correct;
    no source change is part of this task).

## 7. The suite run (the authoritative gate)

```bash
node ./file-injector.test.mjs
```
Expected (current working tree): `Result: 122 passed, 0 failed.`, exit 0; `✓ case T2.S1-f`. The count is ≥121
(122 with the parallel S2's E6 landed; 121 if E6 is reverted in the implementer's checkout). The LOAD-BEARING
assertion is **`✓ case T2.S1-f`** and **0 failures** — robust to E6's presence.

## 8. Fallback — apply the Suggested Fix ONLY if verification finds the isolation ABSENT

If a FRESH CHECKOUT (e.g. `git stash`/clean re-clone) lacks the T2.S1-f isolation (check (a) fails — L2066's
`writeFileSync(PROJ_FILE_PATH, "{}")` absent from T2.S1-f), apply the EXACT PRD §h3.1 "Suggested Fix" pattern to
T2.S1-f, mirroring sibling T2.S1-e (L2045-2061):

```js
const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;
fsSync.writeFileSync(PROJ_FILE_PATH, "{}");          // ← isolate the dedicated file
writeSettings({ "fileInjector": { markdownBareAtImports: flip } });
try { /* …existing asserts (untrusted→baseline; trusted→flip; they differ)… */ }
finally {
  if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid);
  fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
}
```

ENSURE the change is RETAINED (do NOT revert it). The product code (readConfig) is NOT modified under any branch.

## 9. Docs

None. This is a test-harness-only verification/fix with no user-facing/config/API surface. The optional bare-@
behavior it configures is already documented (README.md:103, PRD §4.6). The bugfix plan's P1.M2.T2.S1 owns the
README/doc sweep for the OTHER issue (verbatim-on-error, Issue 1) — NOT this test-isolation item.

## 10. Gates (both present, run by the implementer)

- `node ./file-injector.test.mjs` → the authoritative gate. Current: 122 passed, 0 failed, ✓ T2.S1-f.
- `npm run typecheck` → only relevant IF the fallback edit touches .ts (it does NOT — readConfig is unchanged;
  the isolation is .mjs-only). Run it as a belt-and-suspenders check; expect 0 errors regardless.
