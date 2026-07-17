# Research Notes — P1.M1.T1.S2 (bugfix 001_3e09899f9ba3): defense-in-depth CRLF regression tests + e2e

> First-hand read of: the S1 PRP (the closeRe one-liner + CC12/CC13 — **FULLY LANDED** in the working tree),
> `architecture/code_changes_analysis.md` (§Test Plan gives CC14/CC15/CC16 + the e2e VERBATIM; §"Why Not
> split(/\r\n|\r|\n/)" explains the CR-only limitation), and `file-injector.test.mjs` (indexOfFirstHash L1293,
> CC1 template L1299, CC13 close L1459, TOTAL-SIZE BUDGET header L1462, case 16 L1559, case 17 L1569,
> countFileBlocks L374, FIX L323, TMPDIR L178). Baseline (POST-S1): **124 passed, 0 failed.**

---

## 1. Starting state = POST-S1 (S1 is fully landed, not just in-flight)

Verified in the working tree:
- `file-injector.ts:496` closeRe IS fixed: `new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$")` — the `\\r?` is present. ✓
- CC12 (L1436) + CC13 (L1450) ARE present; CC13 closes at L1459. ✓
- Baseline `node ./file-injector.test.mjs` → **124 passed, 0 failed** (122 + CC12 + CC13). ✓

∴ S2 starts POST-S1. **S2 is TEST-ONLY** — `file-injector.ts` stays as S1 left it (the `\\r?` fix). S2 adds
4 new cases (CC14/CC15/CC16 + 1 e2e) as additional green coverage (defense-in-depth) + documentation of the
CR-only scope boundary. No RED phase (the fix is already in).

---

## 2. The four cases (traced through computeCodeRanges/inCode — all GREEN against S1's fixed closeRe)

### CC14 — CR-only (classic Mac): DOCUMENTATION of a known limitation (NOT a correctness target)

txt = `"```\r#@inside.ts\r```\r#@outside.md"` (pure `\r`, NO `\n`).
- `content.split("\n")` does NOT split on `\r` → `lines = ["```\r#@inside.ts\r```\r#@outside.md"]` (ONE element).
- computeCodeRanges: line 0 matches `FENCE_OPEN_RE` (starts with ```` ``` ````) → opens a fence. There are no
  further lines → no close line to find → unterminated → ONE range `[0, content.length]`.
- The inline-code pass finds a ```` ```…``` ```` span at index 0, but it is already inside the fenced range
  `[0, EOF]` → `inCode(0, ranges)===true` → skipped. No extra ranges.
- ∴ `r.length === 1`. Assert `r.length <= 1` (the `<=` is defensive; in practice it is exactly 1).

**This is documentation, not a target.** The S1 fix (`\\r?`) only helps when `split("\n")` produces multiple
lines (CRLF/LF); CR-only files have no `\n`, so they are one giant line regardless. CR-only is essentially
extinct (classic Mac OS ≤9, pre-2001) and is an INTENTIONAL SCOPE BOUNDARY (PRD Testing Summary: "defense-in-
depth … though \r-alone is essentially extinct"; code_changes_analysis §"Why Not split(/\r\n|\r|\n/)").
**CC14 does NOT use indexOfFirstHash** (it asserts the range COUNT, not inCode).

### CC15 — mixed LF/CRLF in one file: fence closes correctly

txt = `"```\ncode\r\n```\r\n#@after.md\n"` (open fence on `\n`, close on `\r\n`, import on `\n`).
- `split("\n")` → `["```", "code\r", "```\r", "#@after.md", ""]`.
- lineStart[0]=0, [1]=4, [2]=10, [3]=15. idx of `#@after.md` = 15.
- Line 0 opens fence (```` ``` ````). Line 2 `"```\r"`: closeRe `[ \t]*\r?$` → ```` ``` ```` matches `{3,}`,
  `\r` matches `\r?`, `$` → TRUE → close detected. closedEnd = 10 + 4 + 1 = 15. Range `[0, 15]`.
- `inCode(15, [[0,15]])` → `15 >= 0 && 15 < 15` → **false**. ✓ (the `#@` is OUTSIDE the closed fence → imported)

### CC16 — CRLF with trailing spaces before the close fence

txt = `"```\r\ncode\r\n```  \r\n#@after.md\r\n"` (close line = ```` ```  ```` + 2 spaces + `\r`).
- `split("\n")` → `["```\r", "code\r", "```  \r", "#@after.md\r", ""]`. idx of `#@after.md` = 18.
- Line 2 `"```  \r"`: closeRe `[ \t]*\r?$` → ```` ``` ```` matches `{3,}`, `"  "` matches `[ \t]*`, `\r`
  matches `\r?`, `$` → TRUE → close detected. closedEnd = 11 + 6 + 1 = 18. Range `[0, 18]`.
- `inCode(18, [[0,18]])` → **false**. ✓ (the trailing spaces + `\r` do not prevent the close)

### E2E — CRLF markdown with fenced block + #@ import → injected === 2, marker stripped (the integration proof)

Fixtures (UNIQUE names — no collision with shared buildFixtures entries):
- `crlf_spec.md` (CRLF): `"# CRLF Spec\r\n\r\n```\r\ncode here\r\n```\r\n\r\nSee #@crlf_after.md\r\n"`
- `crlf_after.md` (LF): `"# After Content\n"`

`mod.injectFiles("Read #@crlf_spec.md", [], FIX)`:
- crlf_spec.md is delivered; its content is scanned for imports. The fenced block closes (S1 fix) → the
  `#@crlf_after.md` AFTER the fence is NOT in code → resolves → crlf_after.md delivered.
- `r.injected === 2`; `r.text.startsWith("Read crlf_spec.md")`; both `<file>` blocks present; the import marker
  is STRIPPED → `r.text.includes("See crlf_after.md")` ∧ `!r.text.includes("See #@crlf_after.md")`.
- Before S1's fix this would have been `injected === 1` (the fence never closed → import classified inCode →
  silently dropped). The e2e is the end-to-end proof the fix works through the whole pipeline.

---

## 3. Placement landmarks (POST-S1 line numbers — use IDENTIFIERS for robustness)

| What | Landmark |
|---|---|
| CC14–CC16 | AFTER CC13's closing `});` (L1459), BEFORE the `// ── TOTAL-SIZE BUDGET (PRD §5.6.2)` header (L1462). Insert into the blank line at ~L1460. |
| E2E (string id "CRLF-E2E") | AFTER case 16's closing `});` (case 16 at L1559), BEFORE case 17 (L1569). Keeps fenced-code+import cases together. |

CC14–CC16 follow the CC1–CC13 pattern: `indexOfFirstHash(txt)` → `mod.computeCodeRanges(txt)` → assert via
`mod.inCode(idx, r)` (CC15/CC16) or range-count (CC14). The e2e follows the case-15/16 pattern:
`mod.injectFiles(..., [], FIX)` + `<file>` block presence + marker-stripped assertions.

---

## 4. Coordination with S1 (no conflict)

S1 added CC12 + CC13 after CC11 (before the TOTAL-SIZE BUDGET header). S2 adds CC14–CC16 AFTER CC13 (still
before the header). S1 did NOT add a CRLF e2e in the markdown section. S2's cases use UNIQUE ids (CC14/CC15/
CC16/CRLF-E2E) and UNIQUE fixture names (crlf_spec.md / crlf_after.md) → no collision with S1 or existing
fixtures. file-injector.ts is UNTOUCHED by S2 (S1 owns the closeRe fix).

---

## 5. Why no source change / no new exports

S2 is test-only. All 4 cases call already-exported functions: `mod.computeCodeRanges`, `mod.inCode` (CC14–16,
both in the sanity list + ASSERTED_EXPORTS from earlier sessions), and `mod.injectFiles` (e2e). The e2e also
uses the test-internal `FIX`/`TMPDIR`/`fsSync`. ∴ no sanity-list / ASSERTED_EXPORTS / module-surface edit.
No new imports.

---

## 6. Scope discipline (what S2 does NOT do)

- Does NOT edit file-injector.ts (S1's closeRe fix is the source change; S2 consumes it).
- Does NOT touch relative-imports.test.mjs / import-behavior.test.mjs (they stay green, unchanged — run to confirm).
- Does NOT update README.md (the CRLF compatibility note is T2.S1).
- Does NOT add CC12/CC13 (S1 owns those).
- Does NOT "fix" CR-only (CC14 documents it as an accepted scope boundary, not a target).

---

## 7. Confidence: 10/10

Test-only, one file, 4 cases with traced behavior (CC14 range-count; CC15/CC16 inCode===false; e2e injected===2
+ marker stripped) all confirmed GREEN against S1's landed closeRe fix. The architecture doc gives the case
specs verbatim; the insertion points are pinned (post-S1). The gate is `node ./file-injector.test.mjs` →
128 passed (124 + CC14 + CC15 + CC16 + CRLF-E2E), 0 failed. -0 reflects a deterministic, no-source-change,
trace-verified addition.
