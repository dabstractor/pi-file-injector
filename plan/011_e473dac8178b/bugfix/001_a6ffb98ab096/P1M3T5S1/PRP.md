---
name: "P1.M3.T5.S1 (bugfix 001_a6ffb98ab096) — URL_SHAPE_RE ftp alternative + normalization site sync + spec/15 §7/§8 correction (BUG-005)"
prd_ref: "bugfix PRD §h2.3 Issue 4 / BUG-005 (ftp:// scheme tokens never fetched — deviation from the PRD URL spec's literal URL_SHAPE_RE); §h2.5 Recommendation ('Either document the https?-only narrowing in the README's Limits section or extend URL_SHAPE_RE to accept ftp:// and let the fetch fail to verbatim, so code and PRD text agree'); architecture/spec_ux_bug004_005.md § 'BUG-005 spec-vs-code deviation + option comparison'; architecture/system_context.md § 'Approved fix designs' — chosen: Option A+ (spec-literal gate + coupled-site sync + spec correction)"
target_files: "./file-injector.ts (EDIT URL_SHAPE_RE :43 + its JSDoc :27-42 + ADD shared URL_SCHEME_RE const + sync the two scheme-test sites :1711/:1715 + loop comments) + ./url-injection.test.mjs (ADD one DET-FTP case after DET-2 :261-271) + ./spec/15-url-injection.md (EDIT §7 edge-table row :325 + §8 pseudocode normalization line :347)"
target_language: TypeScript (single-file extension, jiti transpile-on-load; gates = url-injection suite 39→40 passed 0 failed, full 4-suite `npm test` chain 283→284 passed 0 failed, `npm run typecheck` --strict 0 errors — all baselines re-verified at HEAD)
depends_on: "Nothing blocking — BUG-001..004 all landed (this item's regions verified present at HEAD; line numbers in this PRP are re-anchored post-BUG-003, which shifted the URL loop ~+55 lines vs the architecture doc's 1646/1656/1660/1663)"
consumed_by: "P1.M4.T6.S1 (README sweep — the Limits 'dotted, alphabetic hostname' bullet :216 gets the ftp sentence THERE, not here); P1.M4.T6.S2 (spec/ consistency pass — verifies my §7/§8 edits are internally consistent)"
supersedes: "None — first PRP for this work item."
---

# PRP — P1.M3.T5.S1: Restore the spec-literal `(https?|ftp)` URL shape gate, sync the coupled scheme-normalization sites, and correct spec/15 §7/§8 (BUG-005)

> **Scope flag:** A surgical spec-parity bugfix. The PRD's URL feature spec defines `URL_SHAPE_RE`
> with `(https?|ftp)` and §7 promises ftp tokens pass the gate; the shipped regex
> (`file-injector.ts:43`) accepts `https?` only, so `#ftp://example.com/x` is left verbatim without
> even attempting egress. The approved fix (system_context decision record: **Option A+**) restores the
> spec-literal alternative **and** — MANDATORY — syncs the coupled `/^https?:\/\//i` scheme-test sites
> that a regex-only change would turn into a NEW bug (`ftp://` → `https://ftp://…` mangling). Runtime
> outcome for ftp stays verbatim either way: Node's `fetch` (undici) has no ftp support — verified on
> this machine (Node v26.7.0): `fetch('ftp://example.com/x')` rejects with
> `TypeError: fetch failed` (cause: `Error unknown scheme`) — and `injectUrl`'s never-throws catch
> (:988-993) already converts that to "token left verbatim" per spec §3.5. The spec itself is corrected:
> §7's factually-wrong "(Node supports it)" parenthetical, and §8's pseudocode which repeats the same
> `https?`-only normalization trap. One new hermetic test pins both coupled sites. Failing-test-FIRST
> discipline. No ftp client. No export-surface change. No README change (deferred to P1.M4.T6.S1).

---

## Goal

**Feature Goal:** `URL_SHAPE_RE` matches the PRD URL spec's literal definition —
`/^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i` —
so an explicit `ftp://` token **passes the shape gate, is normalized UN-prefixed** (`abs === tok`,
never `https://ftp://…`), attempts egress, and — because Node's `fetch` cannot retrieve ftp — falls
back gracefully to verbatim through the existing §3.5 catch (no block, no image, `count` unbumped).
Code, spec §2.2/§8 regex text, and spec §7's behavioral promise all agree with each other AND with
observable runtime behavior.

**Deliverable:**
- **`file-injector.ts`** — (a) `URL_SHAPE_RE` :43 gains the `ftp` alternative (spec §2.2 literal);
  (b) NEW module-level `const URL_SCHEME_RE = /^(?:https?|ftp):\/\//i;` placed directly after
  `URL_SHAPE_RE`, used at BOTH coupled scheme-test sites — the deny-list guard (:1711) and the
  normalization (:1715); (c) JSDoc :27-42 rewritten to drop the implicit narrowing and state the
  ftp-passes-gate / fetch-fails-to-verbatim behavior; (d) the two loop comments (:1708, :1710)
  updated to stay literally true. NOTHING else in the URL pipeline changes.
- **`url-injection.test.mjs`** — one new case `DET-FTP` inserted after DET-2 (:261-271): a
  throwing `globalThis.fetch` stub (simulating undici's real ftp rejection) +
  `injectFiles("#ftp://example.com/x", [], FIX, false, true)` asserting verbatim prompt, zero
  injection, and — the critical regression net — `calls[0] === "ftp://example.com/x"`
  (fetch attempted with the UN-mangled URL).
- **`spec/15-url-injection.md`** — (a) §7 edge-table row :325 corrected: "(Node supports it)" is
  factually wrong; replace with the accurate gate-accepts/fetch-fails/verbatim-fallback statement;
  (b) §8 pseudocode normalization line :347 `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;`
  gains `ftp` — the spec's own pseudocode currently embeds the same mangle trap the code does;
  (c) VERIFY ONLY: §2.2 :71 and §8 :333 already carry `(https?|ftp)` — no edit.

**Success Definition:** All four gates green at the new baselines — `node ./url-injection.test.mjs`
→ **40 passed, 0 failed** (was 39); full `npm test` chain → **284 passed, 0 failed** (183 + 23 + 38
+ 40); `npm run typecheck` → 0 errors under `--strict`; `grep -n "Node supports it" spec/15-url-injection.md`
→ no matches. `#ftp://example.com/x` behaves: gate passes → fetch attempted once with the exact
token → TypeError → verbatim, `injected === 0`. `#example.com` / `#https://x.com/y` behavior
byte-identical to before (DET-1/DET-2 still green — normalization for https/http/bare-host
unchanged).

---

## Why

- **Spec parity (the PRD's recorded deviation):** The PRD bug-hunt recorded BUG-005 as a literal
  spec deviation — the spec defines the shape gate with `(https?|ftp)` and §7 lists `ftp://` as
  "supported by URL_SHAPE_RE". The shipped narrowing was implicit (only a JSDoc half-sentence)
  with no deviation note anywhere. The approved remedy is Option A+: make the code match the spec's
  literal gate, fix every coupled site, and correct the spec's own factual error, so code and PRD
  text agree (PRD §h2.5 Recommendation, second option).
- **No behavior regression, no new bug:** Observable ftp behavior is IDENTICAL before/after
  (verbatim, never injected — undici cannot fetch ftp). The ONLY observable deltas are: the fetch is
  now genuinely attempted (egress try + `onUrlFetch` footer spinner may flash — honest per §3.6:
  "immediately before network egress", and egress IS attempted), and the token enters
  `state.injectedSet` (harmless dedup claim). The dangerous alternative — a regex-only change —
  would mangle `#ftp://…` into `https://ftp://…` and fetch THAT; the coupled normalization sync is
  the mandatory heart of this fix.
- **Who benefits:** Future maintainers (code, spec, and tests stop contradicting each other on the
  scheme set; the shared `URL_SCHEME_RE` constant removes the drift class entirely), and the
  changeset-level docs task P1.M4.T6 (can now state one coherent truth: "the gate accepts ftp but
  Node fetch cannot retrieve it").

## What

`URL_SHAPE_RE`'s explicit-scheme alternative becomes `(https?|ftp)`, synced with a shared
`URL_SCHEME_RE` test used by the URL scan loop's deny-list guard and normalization. An
`#ftp://host/path` token: survives `cleanToken` → passes the gate → bypasses the code-extension
deny-list (it contains `/`) → `abs = tok` verbatim (no `https://` prefix) → dedup claim →
`onUrlFetch` fires → `fetch("ftp://…")` throws `TypeError: fetch failed` (undici: no ftp) →
`injectUrl`'s catch returns `false` → token left verbatim, nothing injected. Spec §7's ftp row and
§8's pseudocode normalization are corrected to state exactly this. Explicitly NOT built: any ftp
client/transport (graceful verbatim IS the spec-consistent behavior).

### Success Criteria

- [ ] `URL_SHAPE_RE` at file-injector.ts:43 is exactly `/^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i` (spec §2.2/§8 literal, single-line style preserved)
- [ ] The normalization at :1715 recognizes `ftp://` (via `URL_SCHEME_RE`): `#ftp://example.com/x` → fetch called with `ftp://example.com/x`, NEVER `https://ftp://example.com/x`
- [ ] The deny-list guard at :1711 uses the same shared `URL_SCHEME_RE` (behaviorally neutral for ftp — scheme-bearing tokens contain `/` and bypass it anyway — but the "Mirrors the scheme test" comment stays literally true)
- [ ] `DET-FTP` passes: verbatim prompt preserved, `injected === 0`, `blocks.length === 0`, `details.length === 0`, `calls.length === 1 && calls[0] === "ftp://example.com/x"`
- [ ] DET-1, DET-2, COL-2, and every BUG1-* / CB-* case still green (no https/http/bare-host behavior change)
- [ ] spec/15 §7 row :325 no longer claims "(Node supports it)"; §8 pseudocode :347 normalization tests `(https?|ftp)`; §2.2 :71 / §8 :333 verified already-literal (untouched)
- [ ] `URL_SHAPE_RE` (and `URL_SCHEME_RE`) remain module-private — NOT exported (module-surface allowlist unchanged)
- [ ] Full gates: url-injection 40/0, `npm test` 284/0, `npm run typecheck` 0 errors

## All Needed Context

### Context Completeness Check

An implementer who knows nothing about this repo gets from this PRP: the exact current regex text and
its file:line anchors, the complete list of coupled scheme-test sites (found by exhaustive grep —
there are exactly three candidate-processing sites plus one display-only site assessed and excluded),
the approved design decision with its rationale (Option A+ from the architecture decision record),
the mangle-trap the naive fix creates, the real undici behavior (empirically re-verified on this
machine), a verbatim-ready test matching the repo's hermetic harness conventions, the exact spec rows
to edit including the hidden §8 pseudocode trap, and the verified baseline counts for every gate.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: spec/15-url-injection.md
  why: "The URL feature spec — source of truth this fix restores parity with"
  section: "§2.2 lines 63-80 (spec-literal URL_SHAPE_RE with (https?|ftp), on line 71); §7 edge table row line 325 (the factually-wrong ftp row to correct); §8 lines 333-347 (pseudocode — regex on 333 already literal, but the normalization on ~347 is https?-only and MUST be synced); §3.5 (never-throws catch → verbatim — the fallback ftp actually takes); §3.6 (onUrlFetch spinner contract — fires before egress, honest for a doomed fetch)"
  gotcha: "Line numbers verified at HEAD. The §8 pseudocode normalization line is a SEPARATE copy of the code's regex — editing the code without it leaves the spec self-contradictory."

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/spec_ux_bug004_005.md
  why: "Scout findings for BUG-005 — full verbatim quotes of every relevant code/spec fragment, the all-usages grep, the injectUrl failure-path analysis, and the Option A vs B comparison"
  section: "§ 'BUG-005 spec-vs-code deviation + option comparison' (starts line 201); § 'Existing shape-gate tests' (the DET pattern this PRP's test extends); § 'Risks' (spinner-noise + mangle-trap)"
  gotcha: "Its code line numbers (1646/1656/1660/1663) are PRE-BUG-003-fix — at HEAD the same sites are 1701/1711/1715/1718. Anchor edits on the quoted CODE TEXT, never on line numbers alone."

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/system_context.md
  why: "The decision record — BUG-005 resolution 'Option A+ (spec-literal gate + coupled-site sync + spec correction)' with rationale, and the Mode A/Mode B docs plan showing which doc edits ride with THIS task vs the changeset sweep"
  section: "§ 'Verified root causes' (BUG-005 row); § 'Approved fix designs' (BUG-005 bullet, ~line 78); § 'Documentation plan'"
  gotcha: "The decision explicitly accepts the residual spinner flash on a doomed ftp fetch as honest UX; do NOT add special-casing to suppress it."

- file: url-injection.test.mjs
  why: "The harness the new DET-FTP case must live in — hermetic, zero-network, jiti-loads the real file-injector.ts, stubs globalThis.fetch per case with a calls tracker restored in finally"
  section: "runCase/makeRes/FIX/hasBlock helpers (:87-:170); DET-1 :238-258 (scheme-less normalization asserts); DET-2 :261-271 (fully-qualified scheme asserts — insert DET-FTP right after); CB-* callback cases (onUrlFetch contract)"
  gotcha: "URL_SHAPE_RE is NOT exported — the ONLY way tests reach the gate is through mod.injectFiles with a stubbed fetch. Do not 'helpfully' export the regex."

- file: file-injector.ts
  why: "The implementation target — the gate, the loop, the failure path"
  section: "URL_SHAPE_RE + JSDoc :27-43; URL scan loop :1692-1722 (gate :1701, deny-list guard :1711, normalization :1715, onUrlFetch :1718, injectUrl call :1719); injectUrl :906-994 (fetch :933, silent catch → return false ~:988-993); isUrlDelivered :1881 (assessed, out of scope — see Gotchas)"
  gotcha: "The loop's placement comments (:1693-1700) are load-bearing documentation of the pipeline order — update the scheme mentions inside them, do not restructure."

- url: https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
  why: "fetch() scheme support — fetch is defined for http/https (plus data:/blob: in some runtimes); ftp is NOT a supported scheme"
  critical: "Node's fetch (undici) rejects ftp: with TypeError: fetch failed (cause 'unknown scheme'). Empirically re-verified on this machine, Node v26.7.0, before writing this PRP. The spec §7 claim '(Node supports it)' is wrong — that claim is what this task corrects."
```

### Current Codebase Tree (relevant excerpt — repo root, no src/ dir)

```bash
pi-file-injector/
├── file-injector.ts          # THE extension — single TypeScript file (1989 lines at HEAD), jiti-loaded by pi
├── file-injector.test.mjs    # suite 1 — 183 passed (local-file domain; autocomplete A1 case lives here)
├── import-behavior.test.mjs  # suite 2 — 23 passed (markdown transitive imports)
├── relative-imports.test.mjs # suite 3 — 38 passed (markdown relative resolution)
├── url-injection.test.mjs    # suite 4 — 39 passed → 40 after DET-FTP (URL domain; DET/COL/DIS/BUG1/CB groups)
├── spec/                     # hand-written PRD, 17 parts; SPEC.md is an @path index
│   └── 15-url-injection.md   # ← §2.2 :71, §7 :325, §8 :333/:347 edited/verified by THIS task
├── scripts/typecheck.mjs     # `npm run typecheck` — tsc --strict over file-injector.ts
├── README.md                 # user doc — NOT touched by this task (P1.M4.T6.S1 owns the ftp Limits bullet)
└── plan/011_e473dac8178b/…   # engineering artifacts (PRD snapshot, tasks.json, architecture/, PRPs) — read-only context
```

### Desired Codebase Tree (no new files — three files EDITED in place)

```bash
file-injector.ts          # EDIT: :43 regex, :27-42 JSDoc, +URL_SCHEME_RE const, :1711/:1715 site sync, :1708/:1710 comments
url-injection.test.mjs    # EDIT: +DET-FTP case (after DET-2, inside the DETECTION group)
spec/15-url-injection.md  # EDIT: §7 row :325 corrected; §8 normalization :347 gains ftp; §2.2/§8 regexes verified-only
```

### Known Gotchas of Our Codebase & Library Quirks

```text
# CRITICAL — THE MANGLE TRAP (why a regex-only change is a NEW bug):
#   Normalization :1715 is `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;`
#   With ftp added to the gate but NOT here, `#ftp://example.com/x` → abs === "https://ftp://example.com/x"
#   → fetch attempts THAT garbage URL. The architecture doc's Option-A analysis flags this as the
#   primary risk; system_context's decision record calls the normalization sync MANDATORY.

# CRITICAL — Line-number drift: the architecture doc cites 1646/1656/1660/1663 (pre-BUG-003).
#   At HEAD (BUG-001..004 landed) the same sites are 1701/1711/1715/1718. Anchor every edit on the
#   exact code text quoted in this PRP; verify with grep before editing.

# CASE-INSENSITIVITY: URL_SHAPE_RE has the /i flag — `#FTP://X` matches. The shared URL_SCHEME_RE
#   MUST also be /i so `FTP://…` is recognized as scheme-bearing (else `https://FTP://x` mangling
#   returns via the back door). Use exactly /^(?:https?|ftp):\/\//i.

# SPINNER HONESTY (accepted residual): onUrlFetch fires at :1718 BEFORE the fetch, so a doomed ftp
#   fetch briefly shows the §3.6 footer spinner ("⠹ Fetching example.com…"). The decision record
#   ACCEPTS this as honest (egress IS attempted; §3.6's contract is "fires for a REAL fetch").
#   Do NOT add scheme-specific suppression logic.

# injectedSet CLAIM: state.injectedSet.add(abs) at :1716-1717 happens BEFORE injectUrl runs, so a
#   failed ftp token claims its URL (a second `#ftp://…` in the same prompt won't re-fetch). This
#   matches existing failure behavior (DNS-fail/timeout also claim) — no change wanted.

# DISPLAY SITE ASSESSED, EXCLUDED: isUrlDelivered :1881 (`/^https?:\/\//i.test(d.path)`) classifies
#   DELIVERED image details for the notify count. ftp can NEVER be delivered (fetch always throws),
#   so the site is dead-correct for ftp; leave it untouched (minimal diff — same reasoning the
#   decision record used for the deny-list guard being behaviorally neutral, but here there is not
#   even a "technically needs syncing" coupling — it never sees an ftp path).

# URL_INJECT_RE :41 (lookbehind (?<![\p{L}\p{N}_]), u flag) differs from spec §2.2's (?<=\W) — that
#   is a KNOWN, SEPARATE, deliberate divergence (P1.M1.T2.S3). NOT this task. Do not touch it.

# cleanToken :161-167 strips trailing punctuation only — `#ftp://example.com/x.` → tok `ftp://example.com/x`.
#   Orthogonal to schemes; no change.

# SPEC.md is an @path index of the 17 parts — editing spec/15 directly is correct; do not regenerate
#   anything (no generator exists; spec/ is hand-written, per the architecture docs-landscape section).
```

## Implementation Blueprint

### Data Models & Structure

None — no schema/type changes. (`State`, `FileDetail`, `injectFiles`' return shape are untouched;
`URL_SHAPE_RE` and the new `URL_SCHEME_RE` stay module-private `const`s.)

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the failing test FIRST — url-injection.test.mjs, new case DET-FTP after DET-2 (:261-271)
  - INSERT into the DETECTION group, immediately after DET-2's closing `});`, this case (verbatim-ready,
    follows the file's exact conventions — try/finally fetch restore, calls tracker, FIX, hasBlock):
      // DET-FTP — [BUG-005] explicit ftp:// scheme: passes the spec-literal URL_SHAPE_RE (§2.2
      // (https?|ftp)), normalized UN-prefixed (abs === tok — pins the no-mangling sync), then the
      // fetch throws (undici has no ftp: TypeError "fetch failed", cause "unknown scheme" — verified
      // Node v26.7.0) → §3.5 catch → token left VERBATIM, nothing injected. The stub reproduces
      // undici's real rejection so the case stays hermetic/zero-network.
      await runCase("DET-FTP", "detection: #ftp://… → gate passes, fetch attempted UN-mangled, throws → verbatim (BUG-005)", async () => {
        const calls = [];
        try {
          globalThis.fetch = async (url) => { calls.push(String(url)); throw new TypeError("fetch failed"); };
          const r = await mod.injectFiles("#ftp://example.com/x", [], FIX, false, true);
          assert(r.text === "#ftp://example.com/x", `ftp token left verbatim, got ${JSON.stringify(r.text)}`);
          assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
          assert(r.blocks.length === 0, `expected no blocks, got ${JSON.stringify(r.blocks)}`);
          assert(r.details.length === 0, `expected no details, got ${r.details.length}`);
          assert(calls.length === 1 && calls[0] === "ftp://example.com/x",
            `fetch attempted ONCE with the UN-mangled ftp URL (no https:// prefix); calls=${JSON.stringify(calls)}`);
        } finally {
          globalThis.fetch = origFetch;
        }
      });
  - RUN `node ./url-injection.test.mjs` → DET-FTP FAILS (calls.length === 0 — the current https?-only
    gate never attempts the fetch). That failure is the red state proving the test exercises the bug.
  - WHY THIS ONE TEST PINS BOTH COUPLED SITES: a gate regression (ftp dropped again) → calls.length===0
    → fails; a normalization regression (https?-only test) → calls[0]==="https://ftp://example.com/x"
    → fails. No second case needed.

Task 2: EDIT file-injector.ts — the gate + the shared scheme constant
  - CHANGE :43 from:
      const URL_SHAPE_RE = /^((https?):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
    to (spec §2.2/§8 literal — only the capture gains |ftp):
      const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
  - ADD immediately after URL_SHAPE_RE (before the CODE_EXTENSIONS JSDoc at :44):
      /** [BUG-005] Shared scheme-bearing test for URL candidates — MUST stay in lockstep with
       *  URL_SHAPE_RE's explicit-scheme alternative above (spec §2.2 literal: https?|ftp). Used by
       *  the URL scan loop's deny-list guard and the https:// normalization so the two can never
       *  drift again (a scheme-only gate change without this sync mangles ftp:// into
       *  https://ftp://…). Case-insensitive (matches URL_SHAPE_RE's /i — #FTP://X is scheme-bearing).
       *  NOT exported. */
      const URL_SCHEME_RE = /^(?:https?|ftp):\/\//i;

Task 3: EDIT file-injector.ts — sync the two coupled sites in the URL scan loop
  - :1711 deny-list guard — CHANGE `if (!/^https?:\/\//i.test(tok) && !tok.includes("/"))`
    TO `if (!URL_SCHEME_RE.test(tok) && !tok.includes("/"))`
    (behaviorally neutral for ftp — scheme-bearing tokens contain "/" and bypass the guard — but the
    adjacent comment says the guard "Mirrors the scheme test used by the normalization below it";
    the shared constant keeps that sentence literally true forever)
  - :1715 normalization — CHANGE `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;`
    TO `const abs = URL_SCHEME_RE.test(tok) ? tok : "https://" + tok;`
    ← THIS is the MANDATORY BUG-005 fix (the mangle trap); the other edits support it
  - UPDATE the two loop comments that enumerate schemes so they stay true:
    :1708 "Explicit-scheme tokens (#https://…/#http://…) bypass" → "(#https://…/#http://…/#ftp://…)"
    :1710 "Mirrors the scheme test used by the normalization below it." → append "(shared
    URL_SCHEME_RE — kept in lockstep, BUG-005)". Do NOT restructure the loop or its placement comments.

Task 4: EDIT file-injector.ts — rewrite the URL_SHAPE_RE JSDoc (:27-42)
  - The narrowing sentence at :28 "(`https?`)" becomes the spec-literal truth, e.g.:
    "an explicit scheme (`https?` or `ftp` — spec §2.2 literal; NOTE: `ftp://` passes this gate but
    Node's `fetch` (undici) has no ftp support — the fetch throws and the token falls back to
    VERBATIM via injectUrl's §3.5 catch, so ftp never injects; the gate still recognizes it so code
    matches the spec's regex exactly)"
  - Optionally extend the accepted-shapes example list (:32) with `#ftp://mirror.example/x`.
  - Keep every other sentence of the JSDoc (deny-list text, examples, "NOT exported") intact.

Task 5: EDIT spec/15-url-injection.md — correct §7 and sync §8
  - §7 row :325 — REPLACE the whole row. FROM:
      | `ftp://` scheme | supported by `URL_SHAPE_RE`; fetch via `fetch` (Node supports it). |
    TO (wording may be lightly adjusted, the three facts are mandatory — gate-accepts /
    fetch-cannot / verbatim-fallback):
      | `ftp://` scheme | accepted by `URL_SHAPE_RE` (§2.2 literal), but Node's `fetch` (undici) has no ftp support — the fetch throws (`TypeError: fetch failed`), so the token falls back to verbatim via the §3.5 catch (no block, no injection; the §3.6 footer spinner may flash — a fetch is genuinely attempted). |
  - §8 pseudocode normalization line (~:347) — CHANGE
      const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
    TO
      const abs = /^(https?|ftp):\/\//i.test(tok) ? tok : "https://" + tok;
    (or the shared-const form if you also declare URL_SCHEME_RE in the pseudocode block — either way
    the TESTED scheme set must include ftp; leaving it https?-only makes the spec self-contradictory)
  - VERIFY ONLY (no edit): §2.2 regex :71 and §8 regex :333 already contain `(https?|ftp)`.
  - DO NOT touch any other spec part — P1.M4.T6.S2 does the cross-cutting consistency pass.

Task 6: RUN all gates (see Validation Loop) and confirm the new baselines:
  url-injection 40/0 · npm test 284/0 · typecheck 0 errors
```

### Implementation Patterns & Key Details

```typescript
// THE URL SCAN LOOP AFTER THE FIX (file-injector.ts ~1692-1722 — shape preserved, only the two
// scheme-test expressions and comments change):
if (enableUrls) {
  for (const m of text.matchAll(URL_INJECT_RE)) {
    const tok = cleanToken(m[2]);
    if (tok && URL_SHAPE_RE.test(tok)) {                       // gate :1701 — now accepts ftp://
      // [BUG-001] deny-list guard :1711 — scheme-bearing bypass via the SHARED test:
      if (!URL_SCHEME_RE.test(tok) && !tok.includes("/")) {
        const finalLabel = tok.slice(tok.lastIndexOf(".") + 1).toLowerCase();
        if (CODE_EXTENSIONS.has(finalLabel)) continue;
      }
      const abs = URL_SCHEME_RE.test(tok) ? tok : "https://" + tok;  // :1715 — THE mandatory sync:
      // ftp://x stays ftp://x (was: /^https?:\/\//i → would have produced "https://ftp://x")
      if (!state.injectedSet.has(abs)) {
        state.injectedSet.add(abs);
        onUrlFetch?.(abs);           // :1718 — fires for ftp too (honest: egress IS attempted, §3.6)
        await injectUrl(abs, state, ctx);  // ftp → fetch throws → catch (:988-993) → false → verbatim
      }
    }
  }
}

// WHY NOTHING ELSE NEEDS TOUCHING — the failure path already exists, verbatim from injectUrl:
//   } catch {
//     return false; // §3.5 timeout/network/throw → verbatim (never throws)
//   } finally {
//     clearTimeout(to);
//   }
// `false` → the loop discards it → prompt text keeps '#ftp://example.com/x' byte-for-byte,
// state.count unbumped, no block, no detail, no image. Identical mechanics to DNS-fail/timeout.

// PATTERN (tests): every case stubs globalThis.fetch per-case and restores origFetch in finally —
// a leaked stub would poison the next case or hit the real network. DET-FTP (Task 1) follows the
// DET-1/DET-2 convention exactly; the only novelty is a THROWING stub (async () => { …; throw new
// TypeError("fetch failed"); }) which mirrors undici's real ftp rejection.
```

### Integration Points

```yaml
CONFIG: none        # enableUrls (input-handler wiring :1851-1858) is unchanged — ftp flows through the same gate
ROUTES: none        # no server/API surface — this is a pi extension transform
DATABASE: none
MODULE SURFACE: none  # URL_SHAPE_RE and URL_SCHEME_RE both stay module-private ("NOT exported")
DOCS:               # Mode A riders (ride WITH this subtask, per the system_context docs plan):
  - spec/15-url-injection.md §7 :325 (correct) + §8 :347 (sync)   # Task 5
  - file-injector.ts JSDoc :27-42                                  # Task 4
  # README Limits bullet is EXPLICITLY DEFERRED to P1.M4.T6.S1 ("the gate now accepts ftp but Node
  # fetch cannot retrieve it") — do NOT edit README.md in this task.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# After each file edit (this repo has NO ruff/mypy — it's TypeScript via tsc + jiti):
npm run typecheck          # scripts/typecheck.mjs → tsc --strict over file-injector.ts
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)"
# (Baselines re-verified at HEAD before this PRP was written: 283 tests + 0 type errors.)
```

### Level 2: Unit Tests (Component Validation)

```bash
node ./url-injection.test.mjs   # → "Result: 40 passed, 0 failed." (39 + DET-FTP)
# BEFORE the code fix, DET-FTP must FAIL with calls.length === 0 (proves it exercises the bug);
# AFTER Tasks 2-3 it must PASS. All other 39 cases unchanged (DET-1/DET-2/COL-2/BUG1-*/CB-* pin
# the untouched https/http/bare-host/deny-list/callback behavior).

npm test                        # full chain → 183 + 23 + 38 + 40 = 284 passed, 0 failed
# Suites run in order: file-injector.test.mjs, import-behavior.test.mjs, relative-imports.test.mjs,
# url-injection.test.mjs. Any regression in the file/markdown domains also surfaces here.
```

### Level 3: Integration / Behavioral Spot-Checks (System Validation)

```bash
# (a) Empirical proof of the real-world failure mode this fix relies on (Node ≥18, undici):
node -e "fetch('ftp://example.com/x').then(r=>console.log('unexpected ok',r.status)).catch(e=>console.log('REJECTED:',e.name+':',e.message,'| cause:',e.cause&&e.cause.message))"
# Expected on this repo's runtime: REJECTED: TypeError: fetch failed | cause: Error unknown scheme
# (Verified while writing this PRP on Node v26.7.0 — the §7 correction states exactly this.)

# (b) Coupled-site sweep — no unsynced https?-only scheme test remains in the URL loop:
grep -n 'https\?:' file-injector.ts | grep -v '^\s*[0-9]*:\s*\*'
# Expected scheme-TEST sites: only URL_SHAPE_RE :43, URL_SCHEME_RE const, and isUrlDelivered :1881
# (the latter deliberately untouched — assessed and excluded, see Gotchas). Comments aside, the
# scan loop's guard+normalization must reference URL_SCHEME_RE, not an inline https?: literal.

# (c) Spec self-consistency sweep:
grep -n "ftp" spec/15-url-injection.md
# Expected: :71 (§2.2 regex — untouched, already literal), :325 (§7 — corrected row, no
# "Node supports it"), :333 (§8 regex — untouched, already literal), :347-ish (§8 normalization —
# now (https?|ftp)). Then: grep -n "Node supports it" spec/15-url-injection.md → NO matches.
```

### Level 4: Domain-Specific Validation (spec-parity check)

```bash
# Confirm the code regex is now byte-equivalent to the spec's literal definition (modulo the
# spec's decorative comments/whitespace inside its multi-line block):
node -e '
const code = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
for (const t of ["ftp://example.com/x","FTP://X.Y/Z","https://a.b/c","http://a.b","example.com/p","sub.example.co.uk/a","main.go","node.js","#x","v1.2","3.14"]) {
  console.log(JSON.stringify(t), code.test(t));
}
// Expected: ftp/FTP/https/http/bare-host forms true; code-ext-looking and non-URL shapes false
// (the bare "main.go"/"node.js" false-verdicts here are the shape gate alone — the deny-list
// guard is a separate, unchanged layer on top for scheme-less tokens).'
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors (strict)
- [ ] `node ./url-injection.test.mjs` → **40 passed, 0 failed** (DET-FTP included)
- [ ] `npm test` → **284 passed, 0 failed** (183 + 23 + 38 + 40)
- [ ] Level 3(b) grep sweep: no inline `https?:` scheme-test left in the scan loop (URL_SCHEME_RE used at :1711 AND :1715)
- [ ] Level 3(c): `grep -n "Node supports it" spec/15-url-injection.md` → no matches; §8 pseudocode normalization tests `(https?|ftp)`

### Feature Validation

- [ ] `#ftp://example.com/x` → prompt byte-for-byte verbatim, `injected === 0`, no blocks/details/images, exactly ONE fetch attempt with the string `"ftp://example.com/x"` (never `https://ftp://…`)
- [ ] `#example.com` → `https://example.com` (DET-1 green — bare-host normalization unchanged)
- [ ] `#https://x.com/y` → fetched as-is (DET-2 green)
- [ ] `#main.go` / `#notes.md` → still zero fetch calls (BUG1-* green — deny-list guard intact)
- [ ] onUrlFetch still fires once per real fetch and never for gated/deduped tokens (CB-* green)
- [ ] spec §2.2 :71 / §8 :333 verified already-literal, untouched

### Code Quality Validation

- [ ] Follows the file's existing conventions: module-private consts with dense JSDoc, comment-anchored edits, single-line regex style
- [ ] `URL_SHAPE_RE` and `URL_SCHEME_RE` both remain NOT exported
- [ ] Minimal diff: no loop restructuring, no URL_INJECT_RE changes, no isUrlDelivered change, no ftp client, no README edit
- [ ] Every edited comment still literally true (the :1710 "Mirrors…" sentence, the :1708 scheme list, the JSDoc narrowing sentence)

### Documentation & Deployment

- [ ] spec/15 §7 row states the three facts: gate accepts ftp / Node fetch cannot retrieve it / §3.5 verbatim fallback
- [ ] JSDoc documents the ftp-passes-gate-fetch-fails behavior at the regex definition site
- [ ] Deferred work explicitly left for successors: README Limits bullet (P1.M4.T6.S1), spec cross-cutting consistency pass (P1.M4.T6.S2)

---

## Anti-Patterns to Avoid

- ❌ **Regex-only change** — adding `ftp` to `URL_SHAPE_RE` without syncing the :1715 normalization mangles `#ftp://…` into `https://ftp://…` and fetches the garbage URL. This is the ONE new bug this task exists to avoid; the normalization sync is mandatory (architecture Option-A analysis, system_context decision record).
- ❌ Don't export `URL_SHAPE_RE`/`URL_SCHEME_RE` to make them "easier to test" — the module surface is a deliberate allowlist; tests reach the gate through `injectFiles` with a stubbed fetch (the repo's established DET pattern).
- ❌ Don't add a fetch-SUCCEEDS ftp test case (stub returning a 200) — it would pin behavior no real transport can produce (undici always rejects ftp) and invite testing fictional paths. The single throwing-stub DET-FTP pins both coupled sites.
- ❌ Don't special-case ftp anywhere else (no ftp branch in injectUrl, no spinner suppression, no scheme-specific dedup) — the whole design is "the generic pipeline handles it; the generic catch degrades it to verbatim."
- ❌ Don't suppress or move the `onUrlFetch` callback for ftp — the decision record accepts the brief spinner flash as honest (egress is genuinely attempted); §3.6's contract stays intact.
- ❌ Don't "fix" `isUrlDelivered` (:1881) or `URL_INJECT_RE` (:41) while in the file — the former never sees an ftp path (fetch always fails → nothing delivered); the latter's lookbehind difference from spec §2.2 is a separate, deliberate divergence.
- ❌ Don't edit README.md — the ftp Limits sentence is owned by P1.M4.T6.S1 (README changeset sweep), which depends on this task.
- ❌ Don't trust line numbers from the architecture doc (pre-BUG-003: 1646/1660/1663) — anchor on code text; HEAD numbers are 1701/1711/1715/1718.
- ❌ Don't skip the failing-test-FIRST step — running DET-FTP red against the current gate (calls.length === 0) is the proof the test exercises BUG-005 at all.