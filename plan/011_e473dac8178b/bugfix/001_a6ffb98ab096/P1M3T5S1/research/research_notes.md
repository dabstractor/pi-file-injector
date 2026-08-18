# Research Notes — P1.M3.T5.S1 (BUG-005: ftp scheme gate + coupled sync + spec correction)

Session date: research for PRP at `../PRP.md`. All findings verified against HEAD
(post-BUG-001..004 landing). Machine: Node v26.7.0.

## 1. Decision context (read from plan artifacts — read-only)

- `architecture/system_context.md` § Approved fix designs: BUG-005 → **Option A+** (spec-literal
  gate + coupled-site sync + spec correction). Regex-only was explicitly ruled a NEW bug class.
- `architecture/spec_ux_bug004_005.md` § BUG-005 (line 201+): full spec/code quotes, all-usages
  grep, injectUrl failure-path analysis, Option A/B comparison (its recommendation input was
  Option B; the humans chose A+ — the PRP follows the decision record, not the scout's input).
- `tasks.json` P1.M3.T5.S1 context_scope: mandates (a) regex literal, (b) normalization sync,
  (c) JSDoc, one DET-FTP test near DET-2, spec/15 §7 :325 correction, §2.2/:71 + §8/:333
  verify-only. README deferred to P1.M4.T6.S1.

## 2. Line-number drift (architecture doc → HEAD)

BUG-003's fix inserted ~55 lines before the URL loop. Pre-fix citations → HEAD:
gate 1646→**1701**, deny-list guard 1656→**1711**, normalization 1660→**1715**,
onUrlFetch 1663→**1718**. URL_SHAPE_RE still **:43**, JSDoc :27-42, injectUrl catch ~:988-993,
isUrlDelivered **:1881** (new since planning — display site, assessed & excluded).

## 3. Coupled scheme-test inventory (exhaustive grep at HEAD)

| Site | Current text | Status in fix |
|---|---|---|
| file-injector.ts:43 `URL_SHAPE_RE` | `((https?):\/\/\S+|…)` | EDIT → `(https?|ftp)` |
| :1711 deny-list guard | `!/^https?:\/\//i.test(tok) && !tok.includes("/")` | SYNC (behaviorally neutral — ftp tokens contain "/") via shared `URL_SCHEME_RE` |
| :1715 normalization | `/^https?:\/\//i.test(tok) ? tok : "https://" + tok` | **MANDATORY SYNC** — else `https://ftp://…` mangling |
| :1881 `isUrlDelivered` | `/^https?:\/\//i.test(d.path)` | EXCLUDE — classifies DELIVERED details; ftp can never be delivered (fetch always throws) → dead-correct |

## 4. Hidden spec inconsistency found (beyond the task contract)

spec/15 §8 pseudocode (~line 347) contains its own copy of the normalization:
`const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;` — same mangle trap. Restoring
the gate without syncing this leaves the spec self-contradictory (§2.2/§8 regex accepts ftp, §8
normalization prefixes it). Added to the PRP as Task 5. §2.2 :71 and §8 :333 regexes already
carry `(https?|ftp)` — verify only.

## 5. Empirical verification (run during this session)

- `node -e "fetch('ftp://example.com/x')…"` → `REJECTED: TypeError: fetch failed | cause: Error
  unknown scheme` (Node v26.7.0). Confirms: post-fix ftp tokens pass the gate, attempt one fetch,
  and fall back to verbatim via injectUrl's silent catch. Also proves spec §7's "(Node supports
  it)" is factually wrong.
- Baselines at HEAD: `npm test` → 183 + 23 + 38 + 39 = **283 passed / 0 failed**;
  `npm run typecheck` → **0 errors**. Post-fix targets: 284/0 (url-injection 40).
- Test-harness mechanics confirmed (url-injection.test.mjs): `runCase`/`makeRes`/`FIX = { cwd:
  TMPDIR }`/`hasBlock` helpers; per-case `globalThis.fetch` stub with `calls` tracker, restored in
  `finally`; URL_SHAPE_RE is NOT exported → gate only reachable via `mod.injectFiles(prompt, [],
  FIX, false, true)`.

## 6. Boundaries honored

- No README edits (P1.M4.T6.S1 owns the Limits ftp sentence).
- No ftp client (graceful verbatim IS the spec-consistent behavior).
- No export-surface change; no URL_INJECT_RE / isUrlDelivered changes.
- No PRPs written for other work items (single-PRP session per policy).