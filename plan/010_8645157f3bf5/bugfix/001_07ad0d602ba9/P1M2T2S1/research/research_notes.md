# Research Notes — P1.M2.T2.S1 (Regression tests for URL-only and mixed prompt notify wording)

## Task
Add a comprehensive notify-wording regression suite (3 cases) for BUG-002's trigger-aware notify.
TEST-ONLY (no source, no docs). Depends on P1.M2.T1.S1's notify fix (the three-branch msg).

## CRITICAL: worktree + state verification (do NOT assume — these are verified facts)
- CWD is the **`url-injector` worktree** (`/home/dustin/projects/pi-file-injector-url-injector`, branch
  `url-injector`, b8aeac0) — NOT `main` (main has no URL feature, no url-injection.test.mjs, 3-file test chain).
- `file-injector.ts` L1546-1548: **the notify fix has NOT landed yet** — still the OLD buggy
  `const msg = \`#@ injected ${whole} whole${paged > 0 ? \`, ${paged} paged\` : ""}\`;`. → The sibling's fix
  is pending; MY tests assert the NEW wording and will PASS once it lands.
- `file-injector.test.mjs` (modified 08:38): **BUG2-1 ALREADY LANDED** (L2989-3044) — URL-only singular,
  inline `RICH_HTML` + fetch stub, asserts `!rec.notify.m.includes("#@")`. I MUST NOT duplicate BUG2-1.

## Where the helpers live (SPLIT across files — verified)
- `file-injector.test.mjs` OWNS the notify/handler harness: `runCase` L90, `makeMockCtx` L162 (→
  `{ctx, rec}`; `rec.notify={m,t}`), `captureHandler(event="input")` L170 (→ `{cb, all}`; `.cb`=LAST handler
  for the event), `captureAllHandlers` L185, `TMPDIR` L212, `PAGED_FIX` L413 (budget ctx), `A_TS` L350 +
  `A_TS_CONTENT` L226 (~97-char whole file), `b.ts`/`huge.log`/`pic.png` fixtures, `passed`/`failed` counters
  L77-78 (auto-increment in runCase → NO hardcoded total to bump), `blocksText`/`hasBlock`/`countFileBlocks`.
- `url-injection.test.mjs` OWNS the fetch harness: `makeRes` L146, `RICH_HTML` L180, `runCase` L97, `TMPDIR` L121.
  It has NO `captureHandler`/`makeMockCtx`. It is owned by the BUG-001 regression (P1.M1.T2.S1).

## DECISION: test file = file-injector.test.mjs (NOT url-injection.test.mjs)
The item allows "either". But: (1) the notify harness (captureHandler/makeMockCtx/PAGED_FIX) lives ONLY in
file-injector.test.mjs; (2) BUG2-1 + PN1-3 (the existing notify cases) are there; (3) test_analysis §11
(L451) assigns BUG-002 notify gaps to file-injector.test.mjs; (4) url-injection.test.mjs is the BUG-001
regression file — co-locating BUG2-* notify tests there would split the notify suite. → file-injector.test.mjs.

## The harness pattern (test_analysis §7, L291; verified in source)
```js
const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: true });   // rec.notify = {m, t} after a notify fires
const slot = captureHandler();                               // slot.cb = the input handler
const out = await slot.cb({ text: "...", source: "interactive", images: [] }, ctx);
// out.action === "transform" when something was injected; rec.notify.m is the toast text.
```
- captureHandler does NOT fire session_start → module-level `cfg` stays `{}` → `cfg.enableUrls` is
  `undefined` → `undefined !== false` === true → URLs ENABLED with zero config. (BUG2-1 proves this.)
  So `captureAllHandlers()`/session_start is NOT needed — the simpler `captureHandler()` suffices (matches
  BUG2-1 + PN1-3 exactly). The item's note about captureAllHandlers/session_start is over-specified; I follow
  the ESTABLISHED BUG2-1 pattern for consistency.
- makeMockCtx (no getContextUsage) → injectFiles O(1) fallback → NO budget limit → files stay WHOLE, URLs
  inject whole. So `a.ts` (whole) + 1 URL → `#@ injected 1 whole, 1 URL` deterministically.

## The notify fix contract (from P1.M2.T1.S1 PRP — WILL land; my tests target this)
```js
const urlCount = details.filter((d) => d.kind === "url").length;
const fileCount = injected - urlCount;                 // details.length === injected (1:1 invariant)
let msg;
if (urlCount === 0)        // FILES ONLY — byte-identical original
  msg = `#@ injected ${injected - paged} whole${paged > 0 ? `, ${paged} paged` : ""}`;
else if (fileCount === 0)  // URLS ONLY — no '#@', no whole/paged axis
  msg = `injected ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
else                       // MIXED — files axis + URL count
  msg = `#@ injected ${fileCount - paged} whole${paged > 0 ? `, ${paged} paged` : ""}, ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
```
Exact expected strings (calculated):
- file-only 1 file, 0 paged: `#@ injected 1 whole` (BUG2-3 — passes BEFORE & AFTER fix; regression guard)
- URL-only 1 URL: `injected 1 URL` (BUG2-1 — sibling)
- URL-only 2 URLs: `injected 2 URLs` (BUG2-4 — requires fix)
- mixed 1 file + 1 URL: `#@ injected 1 whole, 1 URL` (BUG2-2 — requires fix)

## The 3 new tests (extend BUG2-* group; BUG2-2/3/4 — no id collision with sibling's BUG2-1)
- **BUG2-2 MIXED** (the core new case): prompt `#@a.ts and #example.com`; stub fetch; assert
  `rec.notify.m === "#@ injected 1 whole, 1 URL"` (exact) + includes `whole` + includes `URL` + includes `#@`
  + `t === "info"`. Reuses `A_TS` fixture (no file.txt write needed — matches PN1/PN2).
- **BUG2-3 FILE-ONLY single-file regression**: prompt `#@a.ts` (NO fetch stub); assert
  `rec.notify.m === "#@ injected 1 whole"` byte-for-byte + `t === "info"`. Guards the urlCount===0 branch
  (passes pre- and post-fix → regression guard, not TDD-red).
- **BUG2-4 URL-ONLY plural**: prompt `#example.com and #example.org`; stub fetch (2 calls); assert
  `rec.notify.m === "injected 2 URLs"` (exact) + `!includes("#@")` + `t === "info"`. Exercises the plural
  branch + multi-URL scan.

## Why reuse `#@a.ts` (not write file.txt per the item's note)
- `a.ts` is a guaranteed TMPDIR fixture (setup L233), used by PN1/PN2/F1 (~5 existing cases). Reusing it
  matches the established convention, removes write/cleanup risk, and yields the exact `1 whole` count.
- The item's `file.txt` is also valid; `a.ts` is strictly more robust. (Both produce an identical 1-whole file.)

## Insertion point
After BUG2-1's closing `});` (L3044) and BEFORE the `// 10. Summary + cleanup + exit.` section (L3046).
Add a shared `BUG2_RICH_HTML` const + `richHtmlRes(html)` factory just above BUG2-2 (DRY for BUG2-2 + BUG2-4;
do NOT touch BUG2-1's inline stub — out of scope).

## Gotchas
- BUG2-2 + BUG2-4 REQUIRE the sibling's fix to pass (they assert new wording). Run `npm test` AFTER the fix
  lands. BUG2-3 passes either way (byte-identical file-only branch).
- Rich HTML must yield ≥200 chars markdown (SPA floor) — reuse BUG2-1's ~3KB article wording verbatim.
- fetch stub must serve multiple calls (BUG2-4: 2 URLs) → factory returns a FRESH response object each call.
- `#example.com`/`#example.org` pass the CODE_EXTENSIONS deny-list (BUG-001 fix) — `.com`/`.org` aren't code
  extensions. Both match URL_SHAPE_RE. Verified.
- Restore `globalThis.fetch` in `finally` for EVERY stubbed case (BUG2-2, BUG2-4) — a leak poisons later cases.
- URL loop runs AFTER file tokens in injectFiles → details=[a.ts(text), example.com(url)]; urlCount filter is
  order-independent. No budget ctx → no paging → paged===0 always in these cases.
- Do NOT modify BUG2-1 (sibling anchor). Do NOT touch url-injection.test.mjs (BUG-001 file). Do NOT bump a
  hardcoded total (passed/failed auto-count). Do NOT edit file-injector.ts (sibling owns the fix).