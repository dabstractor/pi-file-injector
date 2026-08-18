# Research Notes — P1.M1.T1.S1 (BUG-001: CODE_EXTENSIONS deny-list gate)

Date: collected during PRP creation. All facts directly verified against the current source/tests.

## 1. Source edit sites (verified by `read` of file-injector.ts)

- `URL_INJECT_RE` — L25 (`const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu`). NOT edited.
- `URL_SHAPE_RE` — L36 (`const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i`).
  The JSDoc `/** PRD §2.3 — an anchored shape gate ... */` spans **L27-35**. It currently CLAIMS:
  "Residual benign false-positive: `#node.js` matches the shape (alpha TLD `js`) but won't resolve →
  the no-op fallback ... leaves it verbatim." → **this is the false claim to remove/rewrite.**
- `MIME_BY_EXT` — L37 (so `CODE_EXTENSIONS` inserts at L37, between URL_SHAPE_RE and MIME_BY_EXT).
- `TRAILING_PUNCT` — L42 (`".,;:!?\")]}>'"`).
- URL scan loop — `if (enableUrls) { ... }` at **L1393-1404** (verbatim captured in PRP). The gate
  insertion point is between L1396 (`if (tok && URL_SHAPE_RE.test(tok)) {`) and L1397 (`const abs = …`).

## 2. URL_SHAPE_RE has EXACTLY ONE runtime consumer (verified by grep in source_analysis.md §6)

- L36 definition; L1398 (`if (tok && URL_SHAPE_RE.test(tok))`) is the ONLY runtime use; L35/L1391 are
  comments. → single-point change. The constant is NOT exported.

## 3. cleanToken behavior (verified, L121, exported)

`cleanToken(raw)` strips trailing `TRAILING_PUNCT` repeatedly BEFORE `URL_SHAPE_RE.test`. So
`#main.go,` → `main.go`, `#main.go.` → `main.go` (trailing `.` stripped) → still matches the gate.
→ The deny-list sees the post-clean token. `lastIndexOf('.')` on `main.go` → index 4 → slice(5) →
`go`. Correct.

## 4. enableUrls gating (verified)

- `injectFiles(..., enableUrls = true)` param default L1322.
- Call site L1483: `cfg.enableUrls !== false` → **default-true** (undefined !== false → true).
- `readConfig` returns `{}` when sources missing → enableUrls is undefined → ON by default.
- Outer gate `if (enableUrls)` at L1395 wraps the WHOLE loop. FAIL-8 asserts enableUrls===false →
  calls===0. **The deny-list MUST stay inside `if (enableUrls)`** to preserve the air-gapped opt-out.

## 5. Test harness facts (verified by `read` of url-injection.test.mjs)

- Loader: jiti (nested in global pi) + alias map for `@earendil-works/*` only (defuddle/linkedom
  resolve from repo-root node_modules — installed by the original delta-010 P1.M1.T1.S1).
- Entry: `mod.injectFiles(prompt, [], FIX, false, enableUrls)` where `FIX = { cwd: TMPDIR }`
  (TMPDIR = `mkdtempSync(os.tmpdir()/ui-)`, L120-122). No model, no trust gate.
- Per-case pattern: `const calls=[]; try { globalThis.fetch = async(url)=>{calls.push(String(url)); return makeRes({...});}; ...; } finally { globalThis.fetch = origFetch; }`. `origFetch = globalThis.fetch` saved at L132.
- `makeRes({ct, body, status, ok, contentLength})` — Response-shaped; default ct=text/html status=200 ok=true.
- `hasBlock(r, needle)` — `r.blocks.some(b => b.includes(needle))`.
- Exit: `process.exit(failed > 0 ? 1 : 0)`.
- Section headers (console.log "\n<GROUP>"): DETECTION(243) DISPATCH(280) COLLISION(353)
  SCHEME-LESS NORMALIZATION(434) FAILURE/GUARD(487).
- **All case ids (grep):** DET-1, DET-2, DIS-1, DIS-2, DIS-3, DIS-4, COL-1, COL-2, COL-3, COL-4,
  COL-5, NORM-1, FAIL-1..FAIL-9. → **DENY-1 is non-colliding.** Recommended placement: a new
  "CODE-EXTENSION DENY-LIST (BUG-001)" section after SCHEME-LESS NORMALIZATION (before FAILURE/GUARD).

## 6. COL-4 (verified, L400-411) — the forced flip

Current COL-4 asserts `#node.js` → `calls.length === 1` (fetch CALLED → 404 → verbatim). After the
deny-list lands, `.js` ∈ CODE_EXTENSIONS → `#node.js` is gated → `calls.length === 0`. **COL-4 MUST be
flipped to calls===0 or `npm test` exits 1.** (fix_strategy.md "COL-4 Test Impact" confirms this.)
The flip is the MINIMAL keep-green change; the broader no-fetch matrix is P1.M1.T2.S1.

## 7. Cases that MUST stay green (regression anchors)

- DET-1 (`#example.com` → injected===1, calls===1, block `<file name="https://example.com">`, kind
  'url'). `com` ∉ deny-list → unaffected. PROVES real domains still fetch.
- DET-2 (`#https://x.com/y` → injected===1, calls[0]==="https://x.com/y"). Explicit scheme → bypasses
  deny-list. PROVES explicit-scheme tokens unaffected.
- NORM-1 (scheme-less normalization `example.com` → `https://example.com`). unaffected.
- FAIL-8 (`enableUrls===false` → calls===0). PROVES outer gate intact.
- DIS-1..4, FAIL-1..9 — unaffected (all use `example.com` or explicit scheme).

## 8. CODE_EXTENSIONS set — source reconciliation

- item_description point 3a gives the authoritative FLOOR ("include at minimum these categories").
- fix_strategy.md "Extensions to Include" adds supplements: `kts, cxx, hxx, pm, cljs, cljc, exs, mli,
  fsi, cob, s, astro`.
- The PRP implements the UNION (strictly more robust; both docs internal). Categorized:
  programming / web-markup / config-data / scripts / images / documents / binary-archives.
- **ccTLD overlap** (fix_strategy): `.sh` (Saint Helena), `.py` (Paraguay) are both code extensions
  AND real ccTLDs. In a coding agent, block them (force-fetch via `#https://foo.sh`). Do NOT add real
  gTLDs (com, org, net, io, dev, app, ai, co, me, xyz) — that breaks DET-1/DET-2.

## 9. Validation commands (verified)

- `npm run typecheck` → `node ./scripts/typecheck.mjs` → tsc --strict via temp tsconfig + paths to
  global pi `.d.ts`. Exits 0 clean / 1 on TS error.
- `npm test` → `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node
  ./relative-imports.test.mjs && node ./url-injection.test.mjs`. All 4 chained with `&&`.
- `node ./url-injection.test.mjs` standalone — used for the TDD red→green proof.

## 10. Scope boundaries (from plan/010 bugfix tasks.json)

- S1 (this): CODE_EXTENSIONS const + post-gate continue + JSDoc + ONE TDD anchor test (DENY-1) +
  forced COL-4 flip. Files: file-injector.ts, url-injection.test.mjs ONLY.
- P1.M1.T2.S1: the broader no-fetch regression matrix (#notes.md, #config.json, #image.png, …) +
  COL-4 polish.
- P1.M2.* (BUG-002): trigger-aware notify wording (L1493-1494) — DIFFERENT location, independent.
- P1.M3.T1.S1: README.md URL-detection docs sync — do NOT touch README here.

## Subagent calls used

- 0 external subagent calls — the authoritative line-accurate research already exists
  (source_analysis.md §1/§2/§6/§10 + fix_strategy.md BUG-001), and every edit site, case id, and
  validation command was verified by direct `read`/`grep` of the current source and test files
  (8 tool calls total: file reads + targeted greps). The remaining budget would add no new
  information for this surgical, single-call-site fix.