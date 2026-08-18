# Research Notes — P1.M2.T1.S3 (plan 011)

## Task: Full-suite green sweep — npm test (4 files) + npm run typecheck

---

## 1. EMPIRICAL BASELINE (the headline discovery): everything is ALREADY GREEN at HEAD e5448b3

Run on the clean working tree (only plan/tasks.json modified, which is orchestrator-owned):

### npm test — ALL 4 FILES GREEN, exit 0
| Suite | Result |
|---|---|
| file-injector.test.mjs | **180 passed, 0 failed** (includes all LINE gates) |
| import-behavior.test.mjs | **23 passed, 0 failed** |
| relative-imports.test.mjs | **38 passed, 0 failed** |
| url-injection.test.mjs | **38 passed, 0 failed** |
| **Total** | **279 passed, 0 failed**, `npm test` exit 0 |

`package.json` scripts.test = `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs` — `&&`-chained, short-circuits on first failure; exit 0 ⇒ all four green.

### npm run typecheck — CLEAN, exit 0
`node ./scripts/typecheck.mjs` → "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
The wrapper resolves the GLOBAL pi package (`npm root -g`), writes a temp tsconfig with `paths` for
`@earendil-works/pi-coding-agent` / `pi-ai` / `pi-tui` .d.ts, and runs
`npx --yes -p typescript@5.6 tsc -p <tmp-tsconfig> --listFiles`. Exits non-zero on any TS error.

### All 14 LINE gates ✓ (verified individually)
LINE-1 (single line), LINE-2 (span), LINE-3 (trim), LINE-4 (unit helpers), LINE-5 (scanTokens shape),
LINE-6 (dedup matrix), LINE-7 (§2.4 exact-path-wins — S1), LINE-8 (LR-1 paged slice), LINE-8-MD
(LR-1 markdown), LINE-8b (LR-1 file-coordinate discriminator — S2), LINE-9 (LR-2 image/binary dedup),
LINE-10 (LR-3 malformed notify), LINE-11 (LR-4 past-EOF), LINE-12 (LR-5 clamped display).

⇒ **The sweep is VERIFICATION-FIRST.** All implementation subtasks (P1.M1.T1.S1–S3,
P1.M1.T2.S1–S3) and both gate subtasks (S1: 9b18634 LINE-7; S2: e5448b3 LINE-8b) are landed and green.
The expected outcome: NO changes; a one-paragraph summary stating nothing needed adjusting.
The fix-fallout logic is a CONTINGENCY, exercised only if the tree at sweep time differs.

---

## 2. Git state at research time

- HEAD = e5448b3 "Add LINE-8b test case to verify FILE-coordinate resume in paged slices" (S2's output).
- Before it: 9b18634 "Add LINE-7 test case for §2.4 exact-path-wins regression" (S1's output).
- Feature base: 5c1434e "Add #@file:N / :N-M line ranges". LR-1..5 fix commits:
  f2d33dc (LR-1), a5d0f5f (LR-5), d954487 (emit unify/JSDoc), cec5f1d (LR-2), 6b136f5 (LR-3),
  2e56a86 (LR-4).
- Working tree: only `plan/011_e473dac8178b/tasks.json` modified (orchestrator-owned — DO NOT TOUCH).
- NOTE: research ran in parallel with S2's implementation; S2's commit is already in HEAD. If the
  implementer's tree has S2's final state, counts match (180/23/38/38). If anything differs, the ROBUST
  gate is `0 failed` + exit 0 + the 14 LINE ✓ lines — never a fixed N (the suite count is a moving baseline).

---

## 3. The CHANGED SEAMS (where fallout-fixing is ALLOWED) — from `git diff 5c1434e HEAD -- file-injector.ts`

`file-injector.ts`: 172 insertions, 30 deletions. The hunks (current line anchors):

| Seam | Diff hunk (current L) | What changed (which LR) |
|---|---|---|
| `cleanToken` | @@ -168,13 +168,15 | trailing-`:` trim note (range grammar §2.1) |
| `sliceLines` | @@ -188,6 +190,19 | trailing-newline semantics (§4) |
| `FileDetail` interface | @@ -533,7 +548,7 | `pagedHeadLines` / range fields |
| `scanTokens` | @@ -1145,9 +1160,9 / @@ -1172,6 +1187,10 | carries startLine+endLine (LINE-5) |
| `processTokenStream` | @@ -1210,11 +1229,36 / @@ -1227,6 +1271,24 | retry ladder + LR-3 malformed detect |
| `injectFile` | @@ -1247,6 +1309,14 / @@ -1256,6 +1326,12 / @@ -1270,55 +1346,106 | LR-2 claim-by-classification; LR-3/LR-4 warning notifies; claim revoke |
| `emitText` | @@ -1337,12 +1464,10 / @@ -1357,6 +1482,23 | LR-1 slice budget/paging; LR-5 clamped display; unified quadruple; file-coordinate resume |

Plus the NEW GATES in file-injector.test.mjs: LINE-7 (S1), LINE-8b (S2), and the LINE-8/8-MD/9/10/11/12
gates shipped by the LR subtasks. The item text names the seams "emitText range branch, injectFile
claims/notifies, splitLineRange/scanTokens/processTokenStream, the new gates" — `sliceLines`/`splitLineRange`
are the unit helpers (LINE-4 pins both).

## 4. The DO-NOT-REGRESS guard (the other three suites) — awareness only

- **import-behavior.test.mjs (23)** — markdown import resolution semantics.
- **relative-imports.test.mjs (38)** — file-relative vs cwd-relative resolution.
- **url-injection.test.mjs (38)** — the URL feature (#<url>): content-type dispatch, deny-list, cap,
  timeout→verbatim, SPA fallback, spinner/footer. The LR changes MUST NOT touch URL behavior ("ranges
  never run on URL tokens", feature §1). scanTokens/cleanToken ARE shared machinery — a red
  url-injection case at sweep time = an LR regression leaking into shared code.
- **RULE: never edit those shipped features (or their suites' assertions) to make a test pass.** Fix the
  engine within the changed seams (§3 above). A red guard suite with a green seam-fix = correct outcome;
  a green suite achieved by weakening a guard = FORBIDDEN.

---

## 5. The done-definition checklist (item §3) — how to confirm each clause

1. **"LR-1…LR-5 closed per spec §10"** — each LR has a green gate: LR-1 → LINE-8 + LINE-8-MD + LINE-8b;
   LR-2 → LINE-9; LR-3 → LINE-10; LR-4 → LINE-11; LR-5 → LINE-12. Grep the ✓ lines.
2. **"LINE-1…LINE-12 all pass"** — grep `✓ case LINE` → 14 lines (1,2,3,4,5,6,7,8,8-MD,8b,9,10,11,12).
3. **"no drift in the other three suites"** — import-behavior 23/0, relative-imports 38/0,
   url-injection 38/0 (counts observed at HEAD; robust form = `0 failed` each).
4. **green `npm test`** — exit 0 (the `&&` chain completes).
5. **green `npm run typecheck`** — exit 0, "0 errors" line.

## 6. Failure routing (item §4 contingency — expected NOT to trigger)

If any suite/case is red at sweep time:
- Fix ONLY within: emitText range branch · injectFile claims/notifies · sliceLines/splitLineRange ·
  scanTokens · processTokenStream · the new LINE gates in the test file.
- Do NOT: weaken/skip/re-order any assertion; edit the URL/import/relative suites' guarded features
  (deny-list, dispatch, spinner) or their assertions; touch README (P1.M2.T2.S1); touch plan/ or PRD.md.
- A LINE-gate failure = the corresponding LR implementation regressed → fix the engine seam.
- A guard-suite failure = an LR change leaked into shared machinery (scanTokens/cleanToken) → fix the seam.

## 7. Output artifact (item §4)

A one-paragraph summary of anything adjusted during the sweep. Expected (all-green case): "No changes
required — npm test green (4 files: 180/23/38/38, 0 failed; LINE-1…12 + 8b all ✓) and typecheck clean
(0 errors under --strict). LR-1…LR-5 confirmed closed by their gates; no drift in the guard suites."

## 8. Confidence

9/10. The sweep's core is running two verified commands against a tree whose exact expected output I
have observed (279/0 + typecheck clean at HEAD e5448b3). The contingency path (red suite → fix within
seams) is fully mapped (§3/§6). The -1: suite counts are a moving baseline if S2's final commit differs
from what I observed — mitigated by the robust gate (`0 failed` + exit 0 + 14 LINE ✓ lines).