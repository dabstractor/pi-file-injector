---
name: "P1.M3.T5.S1 (bugfix 001_a6ffb98ab096) — URL_SHAPE_RE ftp alternative + normalization site sync + spec/15 §7 correction (BUG-005)"
prd_ref: "bugfix PRD §h2.3 Issue 4 / BUG-005 (ftp:// scheme never fetched — documented-code narrowing to https?, deviating from the URL spec); §h2.5 Recommendation ('Either document the https?-only narrowing … or extend URL_SHAPE_RE to accept ftp:// and let the fetch fail to verbatim, so code and PRD text agree'); architecture/spec_ux_bug004_005.md § BUG-005 (option comparison — the human chose the SPEC-LITERAL Option A; its 'line-1660 normalization change is mandatory' caveat is baked into this PRP)"
target_files: "./file-injector.ts (EDIT :43 regex scheme group + :1715 normalization regex (MANDATORY) + JSDoc :27-42 + optional :1711 mirror sync) + ./url-injection.test.mjs (ADD DET-FTP after DET-2 :262-273, failing FIRST) + ./spec/15-url-injection.md (EDIT :325 §7 row ONLY; :71/:333 confirm-only)"
target_language: "TypeScript (jiti transpile-on-load). Regex literals + comments + one test case + one spec table row. Gates: `node ./url-injection.test.mjs` 40/0 + `npm test` 4-suite chain all 0-failed + `npm run typecheck` --strict 0 errors."
depends_on: "Nothing in this plan (BUG-005 is independent of BUG-001..004 — disjoint regions). Requires only the shipped URL pipeline (URL_SHAPE_RE :43, the scan loop :1698-1723, injectUrl :928) and url-injection.test.mjs (baseline 39/0 — verified green on the working tree)."
consumed_by: "P1.M4.T6.S1 (README sweep — the ftp Limits bullet lands THERE, not here) + P1.M4.T6.S2 (spec/ consistency pass — my §7 row fix may be reviewed there)."
---

# PRP — P1.M3.T5.S1: Restore the spec-literal `(https?|ftp)` URL gate + sync the normalization

> **Scope flag:** A surgical spec-parity fix (BUG-005, Minor). The URL spec (`spec/15-url-injection.md`
> :71/:333) defines `URL_SHAPE_RE` with `(https?|ftp)`; the shipped code (:43) narrows it to `(https?)`
> with no deviation note. The fix restores the **spec literal** — a ONE-TOKEN change: `(https?)` →
> `(https?|ftp)` — **plus the MANDATORY companion change at :1715** (the scheme-less normalization
> test must also learn `ftp`, or a regex-only change would mangle `ftp://example.com/x` into
> `https://ftp://example.com/x` — a NEW bug). Plus: JSDoc truth-telling (:27-42), a failing-FIRST test
> (DET-FTP) whose `calls` assertion is the regression net for BOTH changes, and the spec §7 row
> correction (:325 — its "(Node supports it)" claim is factually wrong; undici's fetch THROWS on ftp:).
> **No ftp client is added** — Node's fetch fails and the existing catch falls back to verbatim, which
> IS the spec-consistent behavior. **No export change. No README change (that's P1.M4.T6).**

---

## ⚠️ CRITICAL PRE-IMPLEMENTATION NOTE — the item contract's regex rendering contains a typo

The work-item contract writes the target as `(https?|ftp):\/\S+` — **ONE** escaped slash. That is a
transcription error. The actual spec literal — verified at BOTH spec/15 locations (:71 §2.2 and :333
§8) — uses `\/\/\S+` (**TWO** escaped slashes), exactly like the current code. Writing the one-slash
form would introduce a NEW bug (it would match `https:/foo` — a single-slash pseudo-URL no spec or
browser accepts).

**The correct change is minimal and byte-exact: at `file-injector.ts:43`, change `(https?)` →
`(https?|ftp)` and NOTHING ELSE in the regex.** The full target line (byte-identical to spec :333):

```ts
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

---

## Goal

**Feature Goal:** Make the shipped `URL_SHAPE_RE` match the PRD/spec literal `(https?|ftp)`, keep the
coupled normalization site in lockstep (so ftp tokens are fetched un-mangled, never prefixed into
`https://ftp://…`), let a `#ftp://…` token attempt egress and fall back verbatim when Node's fetch
(undici, which has no ftp client) throws, and correct the spec's factually-wrong §7 ftp row — so code,
spec, and tests all agree.

**Deliverable:**
1. `file-injector.ts:43` — scheme group `(https?)` → `(https?|ftp)` (byte-exact spec literal, two slashes).
2. `file-injector.ts:1715` — **MANDATORY companion**: `/^https?:\/\//i` → `/^(https?|ftp):\/\//i` in the
   normalization `const abs = … ? tok : "https://" + tok;` so ftp tokens pass through un-prefixed.
3. `file-injector.ts:27-42` — JSDoc updated: drop the `(https?)` narrowing (:28 → `(https?|ftp)`), note
   that `ftp://` passes the gate, that Node's fetch (undici) cannot retrieve `ftp:` and the existing
   catch falls back to verbatim, and that NO ftp client is added (the graceful verbatim path is the
   spec-consistent behavior). Optional: sync the deny-list guard's scheme test at :1711
   (`/^(https?|ftp):\/\//i`) — behaviorally inert (ftp tokens contain `/` and bypass that guard
   regardless) but keeps the :1710 "mirrors the scheme test" comment literally true.
4. `url-injection.test.mjs` — **DET-FTP added after DET-2 (:262-273), failing FIRST**: a throwing fetch
   stub (simulating undici's real `TypeError: fetch failed`) proving `#ftp://example.com/x` → verbatim
   text, injected 0, blocks 0, and exactly ONE fetch call with the **un-mangled** `ftp://example.com/x`.
5. `spec/15-url-injection.md:325` — §7 row corrected: ftp passes the gate but Node's fetch cannot
   retrieve it → §3.5 catch → verbatim. (`:71`/`:333` already match the restored regex — confirm only.)

**Success Definition:**
1. DET-FTP is RED before the code edit (fails at `calls.length === 1` — old code never fetches ftp)
   and GREEN after — with `calls[0] === "ftp://example.com/x"` pinning the no-mangling normalization.
2. `node ./url-injection.test.mjs` → `Result: 40 passed, 0 failed.` (was 39/0), exit 0.
3. `npm test` (4-suite chain: file-injector 183 + import-behavior 23 + relative-imports 38 +
   url-injection 40) → all `0 failed`, exit 0. (If the parallel BUG-004 task lands first, the
   file-injector count may read 183 or 184 — the load-bearing gate is `0 failed`.)
4. `npm run typecheck` → 0 errors (regex literals + comments are type-neutral).
5. `grep -n "ftp" file-injector.ts` shows the gate, the normalization, and the JSDoc in agreement;
   `grep -n "ftp" spec/15-url-injection.md` shows exactly three sites (:71, :325, :333) all accurate.
6. URL_SHAPE_RE remains a bare `const` — NOT exported; `ASSERTED_EXPORTS`
   (file-injector.test.mjs:144) unchanged.

## User Persona

**Target User:** The **Pi end user** who writes `#ftp://example.com/file` expecting the documented
spec behavior, and the **maintainer** who audits code-vs-spec parity. Neither sees a behavior change
in practice (ftp was verbatim before, is verbatim after) — but the *contract* now matches the spec,
the code no longer carries an undocumented narrowing, and the spec no longer makes a factually false
claim about Node's fetch.

**Use Case:** A user points `#` at an ftp URL. Before: the shape gate rejects it silently (an
undocumented deviation from the spec's own regex). After: the gate accepts it per spec, one honest
egress is attempted, Node's fetch throws (undici has no ftp), the existing catch returns false, and
the token is left verbatim — exactly the spec's §3.5 fallback. The user sees a brief fetch spinner
(accepted cost — egress IS attempted) and an untouched prompt.

**User Journey:** user submits `#ftp://example.com/x` → URL_INJECT_RE captures the token →
cleanToken → URL_SHAPE_RE (now spec-literal) PASSES → deny-list bypassed (token contains `/`) →
normalization passes it through UN-prefixed → dedup claim → onUrlFetch spinner → fetch throws
(TypeError) → injectUrl catch → false → prompt returned byte-for-byte verbatim, nothing injected.

**Pain Points Addressed:** (1) Code-vs-spec drift: the spec promised `(https?|ftp)` and even claimed
"Node supports it" — both false in code. (2) The latent mangling trap: anyone naively restoring the
regex without syncing :1715 would ship `https://ftp://…` garbage. DET-FTP now guards both forever.

## Why

- **Spec-parity is the contract.** The bugfix PRD (§h2.3 Issue 4) records BUG-005 as a literal
  spec deviation; §h2.5 offers two remedies and the human chose the spec-literal one ("extend
  URL_SHAPE_RE to accept ftp:// and let the fetch fail to verbatim, so code and PRD text agree").
  This task IS that remedy.
- **The regex-only change is a trap — the companion edit is the real work.** The architecture note
  (spec_ux_bug004_005.md, Option A analysis) proved the :1715 normalization `/^https?:\/\//i` would
  prefix `https://` onto an ftp token (`https://ftp://example.com/x`) — a NEW bug class. The
  normalization test MUST widen in lockstep. DET-FTP's `calls[0]` assertion permanently pins this.
- **The spec's §7 row is factually wrong.** "(Node supports it)" is false — undici's fetch throws
  `TypeError: fetch failed` for `ftp:` (no ftp client). Correcting the row (not the regex) is the
  right fix: the gate accepts ftp per spec; the FETCH half of the old row was the false claim.
- **The behavior outcome is identical — the honesty changes.** ftp tokens were verbatim before (gate
  rejection) and are verbatim after (fetch-throw → catch → false). What changes: code matches the
  spec regex, egress is honestly attempted (spinner fires for a real attempted fetch), and the spec
  tells the truth. No ftp client is needed — the graceful verbatim path IS the spec-consistent
  behavior (§3.5 catch path).
- **Zero blast radius.** `grep -rn "ftp" *.mjs` → empty: no existing test exercises ftp, and only
  tokens literally starting `ftp://` (case-insensitive) can newly pass the gate. The three other
  suites (183/23/38) cannot notice. The parallel BUG-004 task edits :1955-1963 + file-injector.test.mjs
  A1 — disjoint regions, no conflict.

## What

**User-visible behavior:** `#ftp://…` tokens now pass the URL shape gate per spec: one fetch is
attempted (spinner may flash briefly), Node's fetch throws, the token is left verbatim, nothing is
injected. http/https and scheme-less tokens behave EXACTLY as before. No other behavior changes.

**Technical requirements:**
1. `URL_SHAPE_RE` (:43) becomes the byte-exact spec literal — scheme group `(https?|ftp)`, `\/\/\S+`
   (two slashes), everything else byte-identical to the current line.
2. The normalization (:1715) scheme test becomes `/^(https?|ftp):\/\//i` — ftp tokens pass un-prefixed.
3. JSDoc (:27-42) tells the truth: `(https?|ftp)` gate; ftp:// passes; Node's fetch (undici) cannot
   retrieve ftp: — the fetch throws and the existing catch returns false → verbatim; no ftp client.
4. (Optional, inert) deny-list guard (:1711) scheme test syncs to `/^(https?|ftp):\/\//i` for the
   mirror-comment's truth.
5. DET-FTP test added (failing FIRST) with a throwing fetch stub; DET-1/DET-2/COL-2 stay green.
6. spec/15 :325 row corrected; :71/:333 confirmed (no edit).

### Success Criteria

- [ ] `file-injector.ts:43` reads exactly `/^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i` — two slashes, `ftp` added, nothing else changed.
- [ ] `file-injector.ts:1715` normalization test is `/^(https?|ftp):\/\//i` (ftp passes un-prefixed).
- [ ] JSDoc (:27-42) has no `(https?)`-only narrowing; documents the ftp-passes-gate / fetch-throws /
      catch→verbatim / no-ftp-client contract.
- [ ] DET-FTP exists after DET-2, was observed RED before the code edit, and is GREEN after with
      `calls.length === 1 && calls[0] === "ftp://example.com/x"`.
- [ ] `node ./url-injection.test.mjs` → `Result: 40 passed, 0 failed.` exit 0.
- [ ] `npm test` → all four suites `0 failed`, exit 0; `npm run typecheck` → 0 errors.
- [ ] spec/15:325 no longer claims "(Node supports it)"; :71 and :333 match the restored regex (confirm).
- [ ] URL_SHAPE_RE still NOT exported; `ASSERTED_EXPORTS` unchanged; no new dependency (no ftp client).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the exact byte-level target regex (with the one-slash
typo flagged and corrected against the verified spec literal), the exact current line numbers for
every touched site (:27-42, :43, :1711, :1715 — the contract's stale refs superseded), verbatim
before/after for each edit, a complete ready-to-paste DET-FTP test, a three-state trace proving the
test catches every wrong implementation (old code / regex-only / full fix), the exact spec row
replacement, all gate commands with verified baseline counts (39→40 url; 183/23/38 untouched), the
failing-test-FIRST ordering, and the out-of-scope guard rails (no ftp client, no README, no exports).
The agent opens three files, makes four edits in order, and runs three gates.

### Documentation & References

```yaml
# MUST READ — the option comparison + the mangling-trap analysis this fix is built on
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/spec_ux_bug004_005.md
  why: "§ BUG-005 (line ~201+): quotes the spec regex (:71/:325/:333), proves '(Node supports it)' is
        wrong (undici throws TypeError: fetch failed), and analyzes Option A's two hidden couplings —
        the :1715 normalization (MANDATORY sync; regex-only → https://ftp://… garbage) and the :1711
        deny-list guard (inert for ftp — tokens contain '/'). Also notes onUrlFetch fires before the
        guaranteed-failure fetch (accepted spinner cost) and injectedSet claims before fetch (harmless)."
  critical: "'If Option A is chosen anyway, the line-1660 normalization change is mandatory' — the human
             chose Option A (spec-literal); this PRP is that implementation with the caveat baked in."

# MUST READ — the file under test: every site you touch, with verbatim content
- file: file-injector.ts
  why: ":43 URL_SHAPE_RE (bare const, NOT exported); :27-42 its JSDoc (the '(https?)' narrowing is at
        :28); the scan loop :1698-1723 — gate :1701, deny-list guard :1711, normalization :1715
        ('const abs = /^https?:\\/\\//i.test(tok) ? tok : \"https://\" + tok;'), injectedSet.add :1717,
        onUrlFetch :1718, injectUrl call :1719; count===0 early return :1724 (verbatim text, blocks []);
        injectUrl :928 — fetch :932-937, NEVER throws, catch returns false (loop comment :1696)."
  pattern: "Edit :43 (scheme group only), :1715 (scheme test only), :27-42 (JSDoc), optionally :1711.
            Touch NOTHING else — not URL_INJECT_RE, not CODE_EXTENSIONS, not the loop structure."
  gotcha: "The contract text's '(https?|ftp):\\/\\S+' one-slash rendering is a TYPO. The spec and the
           current code both use \\/\\/\\S+ (two slashes). Only the scheme group changes."

# MUST READ — the spec file you correct (and the two lines you confirm)
- file: spec/15-url-injection.md
  why: ":71 (§2.2 multi-line regex) and :333 (§8 single-line regex) already carry (https?|ftp) — CONFIRM
        ONLY, no edit. :325 (§7 edge-table row) is the ONE edit: replace the factually-wrong
        '(Node supports it)' cell with the accurate gate-accepts/fetch-throws/§3.5-verbatim statement."
  gotcha: "Grep 'ftp' post-edit — expect exactly three sites (:71, :325, :333), all accurate. Do NOT
           'fix' :71/:333 (they are already the spec literal the code is being restored TO)."

# MUST READ — the harness you extend (conventions + placement + baseline)
- file: url-injection.test.mjs
  why: "Zero-network jiti harness; per-case fetch stubs in try/finally. Conventions: runCase :97,
        FIX={cwd:TMPDIR} :122, hasBlock :126, origFetch :132, makeRes :146; 5-arg
        mod.injectFiles(text, [], FIX, bareAt=false, enableUrls=true). DET-1 :248-260, DET-2 :262-273
        (insert DET-FTP right after, before the DISPATCH banner), COL-2 :411-423 (must stay green).
        Exit: process.exit(failed>0?1:0). Baseline: Result: 39 passed, 0 failed."
  pattern: "Copy DET-2's try/finally shape verbatim; the ONLY difference is the fetch stub THROWS
            (TypeError('fetch failed')) — simulating undici — and the asserts expect verbatim/0/0 +
            exactly one un-mangled call."

# The bug contract — what this task implements
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md
  why: "§h2.3 Issue 4 / BUG-005 (the documented-code narrowing) + §h2.5 Recommendation (the either/or
        the human resolved in favor of the spec-literal option)."
  section: "h2.3 Issue 4 + h2.5 last recommendation bullet"

# The parallel sibling (NO conflict — verified disjoint)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M3T1S1/PRP.md
  why: "BUG-004 (autocomplete remap): edits file-injector.ts :1955-1963 (getSuggestions map) +
        file-injector.test.mjs A1 (:1000-1050) + optional spec/14 sentence. Disjoint from my :27-43 /
        :1711-1715 / spec/15 / url-injection.test.mjs. Its A1 extension may shift the file-injector
        suite count (183→183/184) — treat '0 failed' as the gate, not the count."
```

### Current Codebase tree (the three touched files in context)

```bash
pi-file-injector/
├── file-injector.ts          # ← EDIT :43 regex + :1715 normalization (MANDATORY) + :27-42 JSDoc (+optional :1711)
├── url-injection.test.mjs    # ← ADD DET-FTP after DET-2 (:262-273); 39/0 → 40/0
├── spec/15-url-injection.md  # ← EDIT :325 §7 row ONLY; :71/:333 confirm-only
├── file-injector.test.mjs    # read-only (module-surface guard ASSERTED_EXPORTS :144 — unchanged; 183/0)
├── import-behavior.test.mjs  # read-only (23/0)
├── relative-imports.test.mjs# read-only (38/0)
├── scripts/typecheck.mjs     # read-only (gate: npm run typecheck)
├── package.json              # read-only (npm test = 4-suite && chain)
└── README.md                 # read-only (ftp Limits bullet = P1.M4.T6, NOT this task)
```

### Desired Codebase tree (files touched by THIS task)

```bash
file-injector.ts          # :43 (https?) → (https?|ftp); :1715 ^https?:\/\/ → ^(https?|ftp):\/\/;
                          # :27-42 JSDoc truth-telling; optional :1711 mirror sync. No other line.
url-injection.test.mjs    # +1 case (DET-FTP) after DET-2. No other case touched.
spec/15-url-injection.md  # :325 row replacement only. :71/:333 untouched.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — THE CONTRACT'S ONE-SLASH REGEX IS A TYPO. The target is the SPEC LITERAL with TWO
//   escaped slashes: /^((https?|ftp):\/\/\S+|…)$/i. Current :43 already has \/\/\S+ — your ONLY regex
//   change at :43 is the scheme group (https?) → (https?|ftp). Writing \/S+ (one slash) would match
//   "https:/foo" — a NEW bug. Diff your :43 against spec :333; they must be byte-identical.

// CRITICAL — A REGEX-ONLY CHANGE IS INSUFFICIENT (the mandatory companion). :1715
//   'const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;' prefixes https:// onto anything
//   the scheme test doesn't recognize. Without syncing it to /^(https?|ftp):\/\//i, an ftp token
//   becomes "https://ftp://example.com/x" — fetched garbage. DET-FTP's calls[0] assert FAILS on this
//   exact regression — that's the point of the test.

// CRITICAL — FAILING-TEST-FIRST. Write DET-FTP, RUN IT, observe it FAIL at
//   'calls.length === 1' (old code: ftp fails the gate, zero fetch calls), THEN make the code edits,
//   then re-run to green. If DET-FTP passes before the code edit, the test is wrong — fix the test.

// CRITICAL — NO FTP CLIENT. Do not add a dependency, a protocol implementation, or any special-case
//   branch for ftp in injectUrl. The graceful path IS: fetch throws (undici) → existing catch →
//   false → token verbatim. That is the spec-consistent behavior (§3.5 catch path).

// CRITICAL — NO EXPORT CHANGE. URL_SHAPE_RE stays a bare module-level const. The sanity block
//   (ASSERTED_EXPORTS, file-injector.test.mjs:144) must remain untouched — adding an export for
//   testability would break the module-surface contract.

// GOTCHA — the :1711 deny-list guard is behaviorally INERT for ftp ('ftp://…'.includes('/') → the
//   guard's second clause is false → skipped regardless of its scheme test). Syncing it to
//   /^(https?|ftp):\/\//i is optional — do it only to keep the :1710 "mirrors the scheme test"
//   comment literally true. Zero behavior change either way; DET-FTP passes either way.

// GOTCHA — accepted Option-A costs (do NOT "fix" them): onUrlFetch (:1718) fires before the
//   guaranteed-failure fetch (brief spinner — honest: egress IS attempted); the token claims a spot
//   in state.injectedSet (:1717) before the fetch (harmless — dedups a duplicate ftp token in the
//   same prompt). Both were flagged in the architecture note and accepted by the spec-literal choice.

// GOTCHA — line-number drift. The item contract's :1646/:1656/:1660/:1663 refs are STALE (verified
//   against the working tree): gate :1701, deny :1711, normalization :1715, onUrlFetch :1718. Anchor
//   edits by the verbatim content (grep the exact strings), not by line numbers alone.

// GOTCHA — the harness is zero-network BY DESIGN. Every case stubs globalThis.fetch and restores it
//   in finally (origFetch :132). DET-FTP's stub must THROW (TypeError('fetch failed')) — that IS the
//   undici simulation — and must still push to calls BEFORE throwing, so the assertion can pin the
//   un-mangled URL.
```

## Implementation Blueprint

> No data models. Four ordered edits (test FIRST) + three gates. The whole diff is ~10 meaningful lines.

### Implementation Tasks (ordered by dependencies — failing-test-FIRST)

```yaml
Task 1: ADD DET-FTP to url-injection.test.mjs (WRITE THE TEST FIRST — it must FAIL on current code)
  - PLACEMENT: immediately AFTER DET-2's closing "});" (:273) and BEFORE the "DISPATCH" banner block.
  - FOLLOW pattern: DET-2's exact try/finally shape (:262-273) — copy verbatim, then change ONLY the
    fetch stub (push-then-THROW) and the assertions.
  - CONTENT (paste-ready):
      // DET-FTP — ftp:// passes the spec-literal shape gate; Node's fetch (undici) cannot retrieve
      // ftp: — the fetch throws, injectUrl's catch returns false, and the token is left VERBATIM.
      // The calls assertion is the regression net for the normalization: fetch must see the
      // UN-mangled ftp:// URL, never "https://ftp://…".
      await runCase("DET-FTP", "detection: #ftp://… passes the gate; fetch throws (undici has no ftp) → verbatim, one un-mangled fetch call", async () => {
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
  - VERIFY FAILING: `node ./url-injection.test.mjs` → DET-FTP ✗ at
    'calls.length === 1' (old code: ftp fails the gate → zero calls; the verbatim/0/0 asserts pass).
    If DET-FTP is GREEN now, the test is wrong — stop and fix it before touching the source.

Task 2: EDIT file-injector.ts:43 — restore the spec-literal scheme group
  - CHANGE: `(https?)` → `(https?|ftp)` — NOTHING else on the line.
  - TARGET (byte-identical to spec/15:333):
      const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
  - SANITY: `diff <(grep URL_SHAPE_RE spec/15-url-injection.md | sed 's/^ *//') <(sed -n '43p' file-injector.ts)`
    — the regexes must match modulo the `const NAME  = ` prefix and trailing `;`.

Task 3: EDIT file-injector.ts:1715 — the MANDATORY normalization sync
  - CHANGE: `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;`
    →         `const abs = /^(https?|ftp):\/\//i.test(tok) ? tok : "https://" + tok;`
  - WHY: without this, Task 2 alone mangles ftp into "https://ftp://…" (DET-FTP fails on calls[0]).
  - (OPTIONAL, same pass): sync the :1711 deny-list guard's scheme test
    `!/^https?:\/\//i.test(tok)` → `!/^(https?|ftp):\/\//i.test(tok)` — behaviorally inert for ftp
    (tokens contain '/'), keeps the :1710 "mirrors" comment true.

Task 4: EDIT file-injector.ts:27-42 — JSDoc truth-telling (contract item c)
  - :28 "an explicit scheme (`https?`)" → "an explicit scheme (`https?|ftp` — the spec §2.2 literal;
    BUG-005: the undocumented https?-only narrowing is removed)".
  - EXTEND the explicit-scheme sentence: ftp:// PASSES the gate, but Node's `fetch` (undici) cannot
    retrieve ftp: — the fetch throws, the existing catch in injectUrl returns false, and the token
    falls back to VERBATIM (spec §3.5 catch path). No ftp client is added; the graceful verbatim
    fallback IS the spec-consistent behavior.
  - If the JSDoc lists explicit-scheme examples ("#https://…, #http://…"), add #ftp://… to the list.
  - KEEP the final "NOT exported." sentence.

Task 5: EDIT spec/15-url-injection.md:325 — correct the §7 row (contract DOCS item ii)
  - REPLACE: | `ftp://` scheme | supported by `URL_SHAPE_RE`; fetch via `fetch` (Node supports it). |
  - WITH:    | `ftp://` scheme | passes the `URL_SHAPE_RE` gate; Node's `fetch` (undici) cannot retrieve `ftp:` — the fetch throws, the §3.5 catch returns false, and the token falls back to verbatim (no injection). |
  - CONFIRM-ONLY (:71, :333): already carry `(https?|ftp)` — post-edit grep 'ftp' must show exactly
    these three sites, all accurate. Do NOT edit :71/:333.

Task 6: RUN ALL GATES (see Validation Loop) — url 40/0, npm test all-0-failed, typecheck 0 errors.
```

### Implementation Patterns & Key Details

```ts
// The three-state trace — PROOF the test design pins both changes (run mentally before coding):
//   State 1 (old code):     ftp fails gate → no fetch → calls.length === 0 → DET-FTP ✗ at calls assert. (failing-first ✓)
//   State 2 (Task 2 only):  gate passes → :1715 mangles → calls[0] === "https://ftp://example.com/x" → ✗ at calls[0]. (mangling caught ✓)
//   State 3 (Tasks 2+3):    fetch sees "ftp://example.com/x" → throws → catch → false → verbatim → ALL ✓.

// The verbatim-fallback mechanism (why no ftp client is needed):
//   injectFiles loop :1719 → injectUrl("ftp://…") :928 → fetch :932 throws TypeError (undici: no ftp)
//   → injectUrl's catch → return false → loop continues → state.count === 0
//   → early return :1724 → { text: ORIGINAL (verbatim), injected: 0, blocks: [], details: [] }.

// EDIT HYGIENE: anchor every edit by grepping the verbatim strings (the file has drifted; line
//   numbers in older docs are stale). The four anchors:
//     grep -n "const URL_SHAPE_RE" file-injector.ts            → :43
//     grep -n 'const abs = /\^https' file-injector.ts          → :1715
//     grep -n '!/\^https' file-injector.ts                     → :1711 (optional edit)
//     grep -n "explicit scheme" file-injector.ts               → :28 (JSDoc)
```

### Integration Points

```yaml
REGEX_SITES (the only source changes — keep them in lockstep):
  - file-injector.ts:43     URL_SHAPE_RE scheme group   (https?) → (https?|ftp)         [spec literal]
  - file-injector.ts:1715   normalization scheme test   ^https?:\/\/ → ^(https?|ftp):\/\/ [MANDATORY]
  - file-injector.ts:1711   deny-list scheme test       same sync                     [OPTIONAL, inert]

TESTS:
  - url-injection.test.mjs  +DET-FTP (after DET-2); DET-1/DET-2/COL-2 must stay green (39/0 → 40/0)

DOCS:
  - spec/15-url-injection.md:325 §7 row replacement (Mode A); :71/:333 confirm-only
  - README.md: NO CHANGE (ftp Limits bullet = P1.M4.T6.S1, the changeset-level sweep)

NO_CHANGES:
  - URL_INJECT_RE; CODE_EXTENSIONS; loop structure/order; dedup; onUrlFetch ordering; injectUrl body
    (incl. its catch); ASSERTED_EXPORTS (file-injector.test.mjs:144); package.json; any new dependency
```

## Validation Loop

### Level 0: Failing-test-first check (BEFORE the source edits)

```bash
cd /home/dustin/projects/pi-file-injector
node ./url-injection.test.mjs 2>&1 | grep -E "DET-FTP|Result:"
# After Task 1 (test only): expect DET-FTP ✗ (failure detail: 'calls.length === 1 … got 0' — or
# equivalent) and `Result: 39 passed, 1 failed.` → exit 1. THIS IS THE REQUIRED PRE-EDIT STATE.
# If DET-FTP is already green here, the test does not pin the gate — fix the test before proceeding.
```

### Level 1: Targeted suite (after the code edits)

```bash
node ./url-injection.test.mjs
# Expected: `Result: 40 passed, 0 failed.` and exit 0. DET-FTP ✓ with
#   calls[0] === "ftp://example.com/x" (the no-mangling pin); DET-1/DET-2/COL-2 still ✓ (http(s)
#   behavior unchanged; prose tokens still zero-fetch).
```

### Level 2: Full regression + typecheck

```bash
npm test
# Expected: all four suites green, exit 0 —
#   Result: 183 passed, 0 failed.        (file-injector; may read 183 or 184 if the parallel BUG-004
#                                         A1 extension lands first — load-bearing is `0 failed`)
#   Result: 23 passed, 0 failed          (import-behavior)
#   Result: 38 passed, 0 failed          (relative-imports)
#   Result: 40 passed, 0 failed.         (url-injection — the +1 is DET-FTP)

npm run typecheck
# Expected: exit 0; `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`.
# (Regex literals and comments are type-neutral — any error here means an accidental syntax slip.)
```

### Level 3: Byte-exact parity + surface checks

```bash
# 3a) The :43 regex is byte-identical to the spec §8 literal (modulo the const prefix/semicolon).
grep -n "const URL_SHAPE_RE" file-injector.ts
grep -n "URL_SHAPE_RE  = /^((https?|ftp)" spec/15-url-injection.md
# Eyeball: both scheme groups read (https?|ftp) and both use \/\/\S+ (TWO slashes).

# 3b) The normalization (and optionally the guard) learned ftp.
grep -n 'const abs = /\^(https?|ftp)' file-injector.ts        # Expected: :1715 region, one match.

# 3c) URL_SHAPE_RE still NOT exported (module surface unchanged).
grep -c "export const URL_SHAPE_RE" file-injector.ts          # Expected: 0.

# 3d) Spec ftp sites — exactly three, all accurate.
grep -n "ftp" spec/15-url-injection.md
# Expected: :71 (§2.2 regex), :325 (§7 row — corrected, no "Node supports it"), :333 (§8 regex).

# 3e) No stray ftp client / dependency.
grep -ciE "ftplib|ftp-client|new.*[Ff]tp" file-injector.ts ; grep -ci ftp package.json
# Expected: 0 and 0.
```

### Level 4: Domain-specific behavioral spot-check (reasoned, offline)

```bash
# Trace (no command needed — assert by reading the final loop, :1698-1723): for "#ftp://example.com/x"
#   cleanToken → "ftp://example.com/x" → URL_SHAPE_RE ✓ (Task 2) → deny-list bypassed (contains '/')
#   → normalization passthrough (Task 3) → injectedSet claim → onUrlFetch → fetch THROWS →
#   injectUrl catch → false → count===0 → :1724 early return: text VERBATIM, injected 0, blocks [].
#   Every one of those outcomes is asserted by DET-FTP — a green Level 1 IS this check.
```

## Final Validation Checklist

### Technical Validation

- [ ] Level 0: DET-FTP observed RED **before** the source edits (failing-test-first honored).
- [ ] Level 1: `node ./url-injection.test.mjs` → `Result: 40 passed, 0 failed.` exit 0.
- [ ] Level 2: `npm test` → all four suites `0 failed`, exit 0; `npm run typecheck` → 0 errors.
- [ ] Level 3: :43 byte-identical to spec :333; :1715 normalization synced; URL_SHAPE_RE not exported;
      spec ftp sites = exactly :71/:325/:333, all accurate; zero ftp-client/dependency additions.

### Feature Validation

- [ ] `#ftp://…` passes the spec-literal gate, attempts exactly ONE fetch with the UN-mangled URL,
      and falls back verbatim (injected 0, blocks 0) when undici throws.
- [ ] NO `https://ftp://…` mangling is possible (DET-FTP's `calls[0]` assert permanently pins it).
- [ ] http/https and scheme-less tokens behave byte-identically to before (DET-1/DET-2/COL-2 green).
- [ ] spec §7 :325 no longer claims "(Node supports it)"; the corrected row cites the §3.5 catch path.

### Code Quality / Scope Validation

- [ ] Only the three files touched (file-injector.ts, url-injection.test.mjs, spec/15-url-injection.md);
      only the named sites within them (:43, :1715, :27-42, optional :1711; +DET-FTP; :325 row).
- [ ] No ftp client, no new dependency, no export change, no README change (that's P1.M4.T6).
- [ ] No changes to URL_INJECT_RE / CODE_EXTENSIONS / loop structure / dedup / onUrlFetch / injectUrl.

### Documentation (Mode A)

- [ ] JSDoc (:27-42) documents the `(https?|ftp)` gate, the ftp→throw→catch→verbatim path, and the
      no-ftp-client rationale; the `(https?)`-only narrowing is gone.
- [ ] spec :71/:333 confirmed (not edited); :325 corrected.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT write the one-slash regex.** The contract text's `(https?|ftp):\/\S+` is a transcription
  typo. The spec and current code use `\/\/\S+` (two slashes). Only the scheme group changes at :43.
- ❌ **Do NOT ship the regex without the :1715 normalization sync.** That combination mangles
  `ftp://…` into `https://ftp://…` — a NEW bug. The sync is MANDATORY; DET-FTP fails without it.
- ❌ **Do NOT write the test after the fix.** Failing-test-FIRST: add DET-FTP, run it red (at the
  `calls.length` assert), then edit the source, then green. A test that was never red proves nothing.
- ❌ **Do NOT add an ftp client / dependency / special-case branch.** undici throwing → catch → false →
  verbatim IS the spec-consistent behavior (§3.5). Any "make ftp actually work" scope creep is out.
- ❌ **Do NOT export URL_SHAPE_RE** (or touch ASSERTED_EXPORTS) to make testing easier. It stays a bare
  const; DET-FTP exercises it through `mod.injectFiles` like every other case.
- ❌ **Do NOT edit spec :71/:333.** They already carry `(https?|ftp)` — the code is being restored TO
  them. Only the :325 §7 row (the factually-wrong fetch claim) is edited.
- ❌ **Do NOT touch README.md.** The ftp Limits bullet is P1.M4.T6.S1 (changeset-level docs), not here.
- ❌ **Do NOT "fix" the accepted Option-A costs.** The brief spinner flash (onUrlFetch before a
  guaranteed-failure fetch — honest: egress IS attempted) and the injectedSet claim are known,
  architecture-documented, and accepted. No gating changes.
- ❌ **Do NOT edit the deny-list guard's LOGIC.** The optional :1711 sync is a scheme-TEST widening
  only (behaviorally inert); the `!tok.includes("/")` clause and CODE_EXTENSIONS logic are untouched.
- ❌ **Do NOT trust the contract's line numbers (:1646/:1656/:1660/:1663).** They are stale. Anchor
  every edit by grepping the verbatim strings (gate :1701, deny :1711, normalization :1715).

---

## Confidence Score: 9/10

Every input is verified against the working tree: the exact spec literal (both :71 and :333, two
slashes — the contract's typo caught and corrected), the current line numbers for all four source
sites (the contract's stale refs superseded), the verbatim before/after for each edit, a
paste-ready DET-FTP with a three-state trace proving it catches the old code, the regex-only
half-fix, and the full fix, the verified baselines (url 39/0 → 40/0; 183/23/38 untouched; `grep ftp
*.mjs` empty), the exact spec-row replacement text, a confirmed-disjoint parallel sibling (BUG-004
at :1955-1963), and three executable gates. The -1 reserves for ordinary execution risk: regex
transcription slips (guarded by the Level 3a byte-parity check) and the sibling's test-count shift
(guarded by making `0 failed` the load-bearing gate). The implementing agent writes one test, watches
it fail, changes one regex group + one companion regex + comments + one spec row, and runs three gates.