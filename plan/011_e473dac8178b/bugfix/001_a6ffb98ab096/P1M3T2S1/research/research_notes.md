# Research Notes — P1.M3.T5.S1 (BUG-005): URL_SHAPE_RE ftp + normalization sync + spec/15 §7 fix

**Item:** Restore the spec-literal `(https?|ftp)` URL shape gate, sync the coupled normalization site,
update the JSDoc, and correct spec/15 §7's factually-wrong ftp row.
**Task type:** CODE (one regex literal + one coupled regex literal + JSDoc + one spec row) with
**failing-test-FIRST** discipline (DET-FTP). This is NOT a docs-only task.

---

## 1. ⚠️ CRITICAL FINDING — the contract's regex rendering has a typo; the spec literal has TWO slashes

The item description's target regex is `…(https?|ftp):\/\S+…` (**one** escaped slash). That is WRONG.
The actual spec literal — verified at BOTH spec/15 locations — has `\/\/\S+` (**two** escaped slashes):

- `spec/15-url-injection.md:71` (§2.2, multi-line commented form): `/^((https?|ftp):\/\/\S+ …`
- `spec/15-url-injection.md:333` (§8, single-line form): `/^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i`

The current code (`file-injector.ts:43`) is byte-identical to the spec EXCEPT the scheme group:
`/^((https?):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i`
→ `(https?)` vs the spec's `(https?|ftp)`.

**Therefore the correct, minimal change is: `(https?)` → `(https?|ftp)` — and NOTHING else in the regex.**
Writing the contract's one-slash form would introduce a NEW bug (it would match `https:/foo` — one
slash — which no browser or spec treats as a URL). The PRP must pin the exact byte-identical target.

## 2. Verified current code sites (line numbers VERIFIED against the working tree — the contract's
   :1646/:1656/:1660/:1663 refs are STALE; the file has grown to ~135 KB)

| Site | Current line | Content (verbatim) |
|---|---|---|
| URL_SHAPE_RE JSDoc | **:27–42** | `/** PRD §2.3 — an anchored shape gate … an explicit scheme (\`https?\`) OR a dotted host …` (the `(\`https?\`)` narrowing lives at :28) |
| URL_SHAPE_RE | **:43** | `const URL_SHAPE_RE = /^((https?):\/\/\S+\|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;` — bare `const`, **NOT exported** |
| URL scan loop (gate) | **:1701** | `if (tok && URL_SHAPE_RE.test(tok)) {` |
| deny-list guard | **:1711** | `if (!/^https?:\/\//i.test(tok) && !tok.includes("/")) {` (scheme-test site #1; comment at :1710 says it "Mirrors the scheme test used by the normalization below it") |
| **normalization** | **:1715** | `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;` ← **THE MANDATORY SYNC SITE** |
| injectedSet claim | :1717 | `state.injectedSet.add(abs);` (before fetch; harmless if fetch fails) |
| onUrlFetch | :1718 | `onUrlFetch?.(abs);` — fires BEFORE fetch (spinner; honest: egress IS attempted) |
| injectUrl call | :1719 | `await injectUrl(abs, state, ctx);` |
| count===0 early return | :1724 | `return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };` — `text` is the ORIGINAL (verbatim) |
| injectUrl | :928 | `async function injectUrl(url, state, ctx): Promise<boolean>` — fetch at :932–937; NEVER throws (loop comment :1696: "never throws; false → token left verbatim"); its catch returns false |

**The mangling trap (why (b) is mandatory):** with a regex-only change, `ftp://example.com/x` passes
the gate → the :1715 test `/^https?:\/\//i` is FALSE for ftp → `abs = "https://" + tok` =
`https://ftp://example.com/x` — garbage fetched instead of the real URL. The :1715 test MUST become
`/^(https?|ftp):\/\//i` so ftp tokens pass through un-prefixed.

**The deny-list guard (:1711) is behaviorally inert for ftp:** an ftp token always contains `/`
(`ftp://…`), so `!tok.includes("/")` is false → the whole guard condition is false → ftp bypasses the
deny-list regardless of the guard's scheme test. Syncing it to `/^(https?|ftp):\/\//i` is OPTIONAL —
recommended only to keep the :1710 "mirrors the scheme test" comment literally true. Zero behavior change.

## 3. Runtime behavior after the fix (the Option-A tradeoff, accepted by the contract)

`#ftp://example.com/x` → cleanToken → passes gate → bypasses deny-list (contains `/`) → passes
normalization un-prefixed → claimed in injectedSet → onUrlFetch fires (footer spinner, briefly) →
`injectUrl("ftp://example.com/x")` → Node's fetch (undici) throws `TypeError: fetch failed` (undici has
NO ftp client) → injectUrl's catch returns false → loop moves on → state.count stays 0 → the :1724
early return gives verbatim text, injected 0, blocks []. **Net user-visible outcome: identical to
today (verbatim) — plus a brief spinner flash and one attempted egress.** No ftp client is added; the
graceful verbatim path IS the spec-consistent behavior (spec §3.5 catch path). The architecture note's
Option-B lean was overridden by the human's spec-literal decision; the contract's caveats (spinner,
injectedSet) are known-and-accepted costs.

## 4. Test design — DET-FTP (failing FIRST), and why its `calls` assertion is the regression net for BOTH (a) and (b)

Conventions (verified in url-injection.test.mjs): `runCase(label, desc, fn)` :97; `FIX = { cwd: TMPDIR }`
:122; `hasBlock` :126; `origFetch = globalThis.fetch` :132; `makeRes` :146; every case stubs fetch in
`try { globalThis.fetch = … } finally { globalThis.fetch = origFetch; }`; calls go through
`mod.injectFiles(prompt, [], FIX, false, true)` — 5-arg signature `(text, images, ctx, bareAt, enableUrls)`.
DET-1 :248–260, DET-2 :262–273, DISPATCH banner right after; COL-2 :411–423. Exit:
`process.exit(failed > 0 ? 1 : 0)`. Baseline: **Result: 39 passed, 0 failed.**

Insert **DET-FTP after DET-2** (before the DISPATCH banner), with a THROWING fetch (simulating undici):

```js
// DET-FTP — ftp:// passes the spec-literal shape gate; Node's fetch (undici) cannot retrieve ftp:
// the fetch throws, injectUrl's catch returns false, and the token is left VERBATIM. The calls
// assertion is the regression net for the :1715 normalization — fetch must see the UN-mangled
// ftp:// URL, never "https://ftp://…".
await runCase("DET-FTP", "detection: #ftp://… passes the gate; fetch throws (undici has no ftp) → verbatim, fetch called with the un-mangled URL", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); throw new TypeError("fetch failed"); };
    const r = await mod.injectFiles("#ftp://example.com/x", [], FIX, false, true);
    assert(r.text === "#ftp://example.com/x", `verbatim prompt preserved; got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `fetch failure → nothing injected; got ${r.injected}`);
    assert(r.blocks.length === 0, `no blocks on fetch failure; got ${r.blocks.length}`);
    assert(calls.length === 1 && calls[0] === "ftp://example.com/x", `fetch attempted ONCE with the un-mangled ftp:// URL (no https://ftp:// mangling); calls=${JSON.stringify(calls)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

**Three-state trace (proves the test catches every wrong implementation):**
1. **OLD code** (regex `https?`-only): ftp fails the gate → no fetch → verbatim/injected-0/blocks-0
   asserts PASS, but `calls.length === 1` FAILS (it's 0) → **red** ✅ (correct failing-first signal).
2. **Regex-only fix, normalization unsynced**: gate passes → :1715 mangles →
   `calls[0] === "https://ftp://example.com/x"` → the `calls[0]` assert FAILS → **red** ✅ (pins the
   mandatory sync — this is exactly the NEW-bug class the contract warns about).
3. **Full fix (a)+(b)**: fetch sees un-mangled `ftp://example.com/x`, throws → catch → false → verbatim
   → ALL asserts pass → **green** ✅.

Keep DET-1/DET-2 green (https behavior unchanged) and COL-2 green (prose tokens still zero fetch).
No other suite exercises ftp (`grep -rn "ftp" *.mjs` → **empty** — verified), so import-behavior (23),
relative-imports (38), file-injector (183) are untouched by the widening.

## 5. Spec edit — spec/15-url-injection.md §7 row (line 325), verbatim current + replacement

Current (WRONG — "(Node supports it)" is factually false; undici's fetch throws on ftp:):

```md
| `ftp://` scheme | supported by `URL_SHAPE_RE`; fetch via `fetch` (Node supports it). |
```

Replacement (accurate; references the shipped §3.5 catch path):

```md
| `ftp://` scheme | passes the `URL_SHAPE_RE` gate; Node's `fetch` (undici) cannot retrieve `ftp:` — the fetch throws, the §3.5 catch returns false, and the token falls back to verbatim (no injection). |
```

**Confirm-only (no edit):** §2.2 :71 and §8 :333 already carry `(https?|ftp)` — once the code regex is
restored they match exactly. Grep the file to confirm post-edit (three `ftp` sites total: :71, :325, :333).

## 6. Gates (all verified green on the working-tree baseline)

```bash
node ./url-injection.test.mjs        # 39/0 → 40/0 after DET-FTP (load-bearing: 0 failed, exit 0)
npm test                             # 4-suite chain: 183 + 23 + 38 + 40 → all "0 failed", exit 0
npm run typecheck                    # --strict 0 errors (regex literal + comments only — type-neutral)
```
NOTE: the parallel sibling (BUG-004, PRP at …/P1M3T1S1/PRP.md) edits file-injector.ts :1955–1963
(getSuggestions map) + the A1 case in file-injector.test.mjs — **disjoint regions** from :27–43 /
:1711–1715 / spec/15 / url-injection.test.mjs. Its A1 extension may shift the file-injector count
(183 → 183/184) — the load-bearing gate is `0 failed`, not the exact count.

## 7. Out of scope (guard rails)

- **No ftp client.** No new dependency, no protocol implementation — the graceful verbatim fallback IS
  the spec-consistent behavior. (contract: "Do NOT add an ftp client")
- **No export change.** URL_SHAPE_RE stays a bare `const` (:43, NOT exported); the module-surface
  allowlist `ASSERTED_EXPORTS` (file-injector.test.mjs:144) is UNCHANGED.
- **No README edit.** The Limits bullet for ftp lands in P1.M4.T6 (changeset-level docs) — NOT here.
- **No spec §2.2/§8 edit.** Those lines already match the restored regex — confirm only.
- **No change to** URL_INJECT_RE, CODE_EXTENSIONS, the loop structure, dedup, onUrlFetch ordering,
  injectUrl's catch semantics, or any file-token behavior.