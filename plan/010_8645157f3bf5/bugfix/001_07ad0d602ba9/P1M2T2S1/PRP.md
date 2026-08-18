name: "P1.M2.T2.S1 — Regression tests for URL-only and mixed prompt notify wording (BUG-002)"
description: >
  TEST-ONLY task. Add a 3-case notify-wording regression suite (BUG2-2/3/4) to file-injector.test.mjs that
  exercises all three branches of P1.M2.T1.S1's trigger-aware notify (file-only / URL-only / mixed) and the
  singular/plural URL wording. Extends the BUG2-* group that already contains BUG2-1 (the sibling's
  failing-first anchor). No source/docs changes.

---

## Goal

**Feature Goal**: Lock in the BUG-002 fix (trigger-aware status notify) with a comprehensive regression
suite so the three notify branches — **files-only** (`#@ injected N whole[, M paged]`, byte-identical to
today), **URLs-only** (`injected N URL[s]`, no `#@`), and **mixed** (both parts joined) — plus the
singular-vs-plural URL wording, can never silently regress.

**Deliverable**: Three new `runCase(...)` entries (`BUG2-2`, `BUG2-3`, `BUG2-4`) appended to
`file-injector.test.mjs` in the existing `BUG-002` section (after `BUG2-1`), plus a shared
`BUG2_RICH_HTML` const + `richHtmlRes(html)` factory to keep the two URL-needing cases DRY. **No other
file is touched.** `npm test` (4 files) must still exit 0 *once the sibling's notify fix (P1.M2.T1.S1) has
landed*.

**Success Definition**:
- `node ./file-injector.test.mjs` exits 0 with `BUG2-2`/`BUG2-3`/`BUG2-4` all PASSING (against the fixed
  `file-injector.ts`).
- `npm test` (all 4 files) exits 0.
- `BUG2-1` (sibling anchor) is **untouched** and still passes; the BUG-001 file
  (`url-injection.test.mjs`) is **untouched**; `file-injector.ts` is **untouched** (the fix is the
  sibling's deliverable).
- The three cases together cover every notify branch: file-only (BUG2-3, exact), URL-only singular
  (BUG2-1, sibling) + plural (BUG2-4, exact), and mixed (BUG2-2, exact).

## Why

- **Regression safety for a user-visible UX fix.** BUG-002 made the status toast tell the truth for
  URL-only prompts. Without tests, a future refactor of the notify string could silently reintroduce the
  `#@ injected 1 whole` lie for a `#example.com`-only prompt. These cases are the executable guarantee.
- **Fills the exact gap test_analysis §11 names** (L451-457): "No URL-only notify test … all notify
  assertions use `#@file` prompts" + "Handler tests don't stub fetch." BUG2-1 (sibling) opened the gap;
  this task closes it comprehensively (mixed + plural + file-only-exact).
- **The mixed branch is untested anywhere.** BUG2-1 covers URL-only-singular-no-`#@`; nobody yet asserts
  that a `#@file` + `#url` prompt yields BOTH axes in one toast. BUG2-2 is the only guard for it.
- **Parallel-safe by construction**: this task edits ONLY `file-injector.test.mjs`'s tail (the BUG-002
  section). The sibling's fix edits `file-injector.ts` (the notify block). `url-injection.test.mjs` is
  owned by BUG-001. Zero file overlap.

## What

User-visible behavior under test (all via the real **input handler** — `captureHandler("input")`'s `.cb`,
driven with `{text, source:"interactive", images:[]}`; `injectUrl` and `injectFiles` are PRIVATE and
exercised through the handler). `rec.notify = {m, t}` is captured by `makeMockCtx`'s notify spy.

| Case | Prompt | Expected `rec.notify.m` | Notes |
|---|---|---|---|
| **BUG2-2** mixed | `#@a.ts and #example.com` | **`#@ injected 1 whole, 1 URL`** (exact) | stub fetch → rich HTML; reuses `A_TS` fixture |
| **BUG2-3** file-only | `#@a.ts` | **`#@ injected 1 whole`** (byte-for-byte) | NO fetch stub; guards the `urlCount===0` branch |
| **BUG2-4** URL-only plural | `#example.com and #example.org` | **`injected 2 URLs`** (exact) | stub fetch (2 calls); exercises plural branch |

All three also assert `rec.notify.t === "info"`. BUG2-2 additionally asserts `#@` IS present (files exist);
BUG2-4 asserts `#@` is NOT present.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` exits 0 with BUG2-2/3/4 green (against the FIXED `file-injector.ts`).
- [ ] `npm test` (4 files) exits 0.
- [ ] BUG2-2 asserts the exact mixed string `#@ injected 1 whole, 1 URL` (both axes, `#@` present).
- [ ] BUG2-3 asserts the exact file-only string `#@ injected 1 whole` byte-for-byte.
- [ ] BUG2-4 asserts the exact URL-only plural string `injected 2 URLs` (no `#@`).
- [ ] Every fetch-stubbed case (BUG2-2, BUG2-4) restores `globalThis.fetch` in `finally`.
- [ ] BUG2-1, `url-injection.test.mjs`, and `file-injector.ts` are untouched.

## All Needed Context

### Context Completeness Check
✅ Passes "No Prior Knowledge" test: an agent unfamiliar with the repo gets (1) the exact verified current
state (which worktree, that the fix is pending but BUG2-1+ the harness have landed), (2) the exact harness
signatures + return shapes with line refs, (3) ready-to-paste test bodies + the shared factory, (4) the
exact expected notify strings derived from the sibling PRP's three-branch contract, and (5) the hard
"don't touch sibling files" constraints.

### Documentation & References

```yaml
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/test_analysis.md
  why: "§7 (L291) = the captureHandler/makeMockCtx harness + the 'drive slot.cb, assert rec.notify' pattern;
        §8 (L360) = BUG-002 source location (the buggy notify block); §11 (L439, L451-457) = the test gaps
        this suite fills ('No URL-only notify test', 'Handler tests don't stub fetch')."
  critical: "rec.notify === {m, t} only AFTER a notify fires; captureHandler().cb is the LAST handler for the
             event (input: 1 handler). cfg is module-level — captureHandler does NOT fire session_start, so
             cfg stays {} → enableUrls defaults enabled (undefined !== false). No session_start needed."

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/source_analysis.md
  why: "§5 = the buggy notify block (the fix target); §9 = ctx.hasUI / ctx.ui.notify types; §13 = fix options
        (the sibling uses details[].kind — NO new return field)."
  critical: "details[].kind union already includes 'url'; urlCount = details.filter(d=>d.kind==='url').length."

- dependency_prp: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M2T1S1/PRP.md
  why: "THE CONTRACT for the three-branch notify msg (file-only / URL-only / mixed) — copied verbatim into
        this PRP's 'notify fix contract'. It also COMMITTED BUG2-1 (URL-only singular, no-#@). This task
        EXTENDS the BUG2-* group (BUG2-2/3/4); do NOT re-add BUG2-1 or collide with its id."
  take: "The sibling owns file-injector.ts (the fix) + BUG2-1. THIS task owns ONLY the additional notify
         cases in file-injector.test.mjs. Disjoint."

- dependency_prp: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M1T2S1/PRP.md
  why: "Confirms BUG-001 regression tests live in url-injection.test.mjs; BUG-002 notify tests belong in
        file-injector.test.mjs (captureHandler/makeMockCtx live there). No overlap."

- file: file-injector.test.mjs   # the ONLY file this task edits
  lines: "runCase L90; makeMockCtx L162 (→{ctx,rec}, rec.notify={m,t}); captureHandler L170 (→{cb,all});
          TMPDIR L212; A_TS_CONTENT L226 (writeFileSync a.ts L233); A_TS L350; PAGED_FIX L413; PN1 L1283
          (file-only notify precedent: '#@ injected 2 whole'); PN2 L1290 (mixed whole+paged precedent);
          BUG2-1 L2989-3044 (URL-only singular anchor — the pattern to copy); summary section L3046."
  why: "This IS the harness + the precedent. Reuse captureHandler/makeMockCtx/A_TS/PN1's drive shape; copy
        BUG2-1's inline fetch-stub pattern (extracted into a shared factory for BUG2-2/4)."
  pattern: "BUG2-1: makeMockCtx(TMPDIR,{hasUI:true}) + captureHandler() + inline rich-HTML fetch stub +
            try/finally restore + assert on rec.notify.m/.t."
  gotcha: "passed/failed auto-increment in runCase (L77-78, L93/97) — NO hardcoded total to bump. Insert the
           new cases AFTER BUG2-1's closing }); (L3044) and BEFORE the '// 10. Summary' section (L3046)."

- file: file-injector.ts   # READ-ONLY for this task (the sibling's fix lands here)
  lines: "notify block L1537-1548 (CURRENTLY still the buggy single-string; will become three-branch).
          URL scan loop runs AFTER processTokenStream (file tokens) → details=[files…, urls…].
          FileDetail.kind union L504 incl. 'url'. injectUrl L830-916 (HTML path; 200-char SPA floor L884)."
  why: "Confirms the wording contract + that files inject before URLs (so mixed details = [a.ts(text),
        example.com(url)] → urlCount filter is order-independent). DO NOT EDIT THIS FILE."
```

### Current Codebase tree (relevant slice — `url-injector` worktree)

```bash
file-injector.ts            # READ-ONLY (sibling's fix target; currently buggy at L1546-1548)
file-injector.test.mjs      # ⬅ EDIT: append BUG2-2/3/4 + shared BUG2_RICH_HTML/richHtmlRes after BUG2-1 (L3044)
url-injection.test.mjs      # NOT touched (BUG-001 regression file; P1.M1.T2.S1 owns it)
import-behavior.test.mjs    # NOT touched
relative-imports.test.mjs   # NOT touched
package.json                # NOT touched (4-file test chain already correct)
plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/
  P1M2T1S1/PRP.md           # the fix contract (three-branch msg) + BUG2-1 anchor
  architecture/test_analysis.md   # §7 harness, §8 bug location, §11 gaps
```

### Desired Codebase tree (this task's only change)

```bash
file-injector.test.mjs      # MODIFIED: + shared BUG2_RICH_HTML const + richHtmlRes(html) factory
                           #           + 3 runCase entries (BUG2-2, BUG2-3, BUG2-4) in the BUG-002 section
```
(No other file. No new file. No package.json edit.)

### Known Gotchas of our codebase & Library Quirks

```javascript
// CRITICAL — these tests REQUIRE the sibling's notify fix to pass (BUG2-2 + BUG2-4 assert NEW wording).
//   Until P1.M2.T1.S1 lands the three-branch msg in file-injector.ts, BUG2-2 and BUG2-4 will FAIL with the
//   OLD "#@ injected N whole" wording. BUG2-3 PASSES either way (the urlCount===0 branch is byte-identical
//   to the original — it's a regression guard, not a TDD-red case). Run `npm test` AFTER the fix lands.

// CRITICAL — worktree. You MUST be in the `url-injector` worktree (branch `url-injector`), NOT `main`
//   (main has no URL feature, no url-injection.test.mjs, a 3-file test chain). `git branch --show-current`
//   must print `url-injector`.

// CRITICAL — rich HTML must clear the 200-char SPA floor. A trivial "<p>hi</p>" may extract <200 chars →
//   SPA fallback → injected===0 → notify NEVER fires → can't assert wording. Reuse BUG2-1's ~3KB <article>
//   (defuddle yields ~1024 chars). Extract it as BUG2_RICH_HTML and share across BUG2-2/4.

// CRITICAL — restore globalThis.fetch in `finally` for EVERY stubbed case (BUG2-2, BUG2-4). A leaked stub
//   poisons later cases and can hit the REAL network. Match BUG2-1's try/finally exactly.

// CRITICAL — the fetch stub must serve MULTIPLE calls (BUG2-4: #example.com + #example.org = 2 fetches).
//   Make richHtmlRes(html) return a FRESH response object per call (each call's body.getReader has its own
//   `done` closure). A shared single-use reader would done=true on the 2nd call → empty body → SPA fallback.

// GOTCHA — no makeRes/RICH_HTML in this file (those live in url-injection.test.mjs). Do NOT import across
//   test files. Define BUG2_RICH_HTML + richHtmlRes inline (mirror BUG2-1's inline stub).

// GOTCHA — #example.com / #example.org pass the CODE_EXTENSIONS deny-list (BUG-001 fix): .com/.org are TLDs,
//   not code extensions; both match URL_SHAPE_RE. Both inject under the stub. Verified.

// GOTCHA — makeMockCtx has NO getContextUsage → injectFiles O(1) fallback → NO budget limit → files stay
//   WHOLE, URLs inject whole, paged===0. So a.ts (~97 chars) → whole; URLs → whole. Deterministic counts.
//   (Do NOT use PAGED_FIX here — it would page huge.log, not a.ts, and isn't needed.)

// GOTCHA — captureHandler() alone suffices (matches BUG2-1 + PN1-3). Do NOT call captureAllHandlers /
//   session_start: cfg defaults to {} → enableUrls enabled. The item's captureAllHandlers suggestion is
//   over-specified; the simpler, already-proven captureHandler() pattern is correct.

// GOTCHA — passed/failed auto-increment in runCase; `Result: ${passed} passed, ${failed} failed.` prints
//   the count. NO hardcoded matrix total to bump.
```

## Implementation Blueprint

### Data models and structure
No new models. Two small test-local helpers (defined once, just above BUG2-2):

```javascript
// BUG2_RICH_HTML — the calibrated ~3KB article (defuddle yields ~1024 chars ≥ 200-char SPA floor).
// Identical wording to BUG2-1's inline html so behavior matches; extracted here so BUG2-2/4 share it.
const BUG2_RICH_HTML = `<!doctype html><html><head><title>Example Domain</title></head><body>
<article>
<h1>Welcome to the Example Domain</h1>
<p>This domain is for use in illustrative examples in documents. You may use this domain in literature without
prior coordination or asking for permission. It is a long paragraph that contains substantial prose content
designed to exceed the two hundred character minimum threshold that the SPA empty extraction guard enforces.</p>
<p>More information about this example domain can be found in the RFC documents and the IANA registry. The domain
is reserved for documentation and testing purposes so that developers have a stable placeholder to reference in
tutorials, configuration samples, and integration test suites across many different kinds of software products.</p>
<p>A third paragraph ensures the extracted markdown comfortably clears the minimum threshold even after defuddle
strips navigation chrome, sidebars, footers, cookie banners, and other boilerplate that modern web pages include
around their main article body content on the page.</p>
</article></body></html>`;

// richHtmlRes(html) — a Response-shaped object (ok/status/headers/body.getReader/text) for ONE fetch call.
// Call per-fetch (do NOT share one response across calls — the reader's `done` flag is single-use).
function richHtmlRes(html) {
  const buf = Buffer.from(html, "utf8");
  return {
    ok: true,
    status: 200,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: buf }; // one chunk; Buffer IS a Uint8Array
          },
        };
      },
    },
    text: async () => buf.toString("utf8"), // readers' no-reader fallback (not used when getReader exists)
  };
}
```

### The notify fix contract (from P1.M2.T1.S1 PRP — the wording these tests target)

```javascript
// file-injector.ts input handler (the sibling lands this; THIS task only TESTS it):
//   urlCount = details.filter(d => d.kind === "url").length;   fileCount = injected - urlCount;
//   urlCount===0        → `#@ injected ${injected-paged} whole${paged>0?`, ${paged} paged`:""}`
//   fileCount===0       → `injected ${urlCount} URL${urlCount>1?"s":""}`
//   else (mixed)        → `#@ injected ${fileCount-paged} whole${paged>0?`, ${paged} paged`:""}, ${urlCount} URL${urlCount>1?"s":""}`
// Derived expected strings (makeMockCtx → no budget → all whole, paged===0):
//   BUG2-2 mixed (a.ts whole + 1 URL):   fileCount=1,urlCount=1 → "#@ injected 1 whole, 1 URL"
//   BUG2-3 file-only (a.ts):             urlCount=0            → "#@ injected 1 whole"
//   BUG2-4 URL-only (2 URLs):            fileCount=0,urlCount=2 → "injected 2 URLs"
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: VERIFY the harness + sibling anchors are present
  - CONFIRM CWD is the `url-injector` worktree: `git branch --show-current` → "url-injector".
  - CONFIRM file-injector.test.mjs defines makeMockCtx, captureHandler, runCase, A_TS, TMPDIR (grep).
  - CONFIRM BUG2-1 exists (grep "BUG2-1") — it is the sibling's anchor; do NOT duplicate it.
  - CONFIRM the sibling's notify fix is present in file-injector.ts (grep "urlCount" / "details.filter" /
    `injected \${urlCount}`). IF ABSENT: BUG2-2 + BUG2-4 WILL fail until it lands — that is EXPECTED (this
    task's tests are the regression guard for the fix). Note it; the cases are still correct to commit.

Task 2: ADD the shared helpers (just above BUG2-2, after BUG2-1)
  - PLACE: immediately after BUG2-1's closing `});` (L3044), before the `// 10. Summary` section.
  - ADD: `const BUG2_RICH_HTML = \`…\`;` + `function richHtmlRes(html) { … }` (see Data Models above).
  - DO NOT touch BUG2-1's inline stub (out of scope; leave the sibling's case byte-identical).

Task 3: ADD BUG2-2 — MIXED prompt notify (the core new case)
  - REUSE: makeMockCtx(TMPDIR,{hasUI:true}) + captureHandler() + A_TS fixture (a small whole file; NO
           file.txt write — matches PN1/PN2 conventions and removes write/cleanup risk).
  - STUB: globalThis.fetch = async () => richHtmlRes(BUG2_RICH_HTML); restore in finally.
  - DRIVE: await slot.cb({ text: "#@a.ts and #example.com", source: "interactive", images: [] }, ctx);
  - ASSERT:
      out.action === "transform";
      rec.notify.m === "#@ injected 1 whole, 1 URL";           // EXACT mixed string
      rec.notify.m.includes("whole") && rec.notify.m.includes("URL") && rec.notify.m.includes("#@");
      rec.notify.t === "info";
  - WHY EXACT: a.ts (~97 chars, no budget → whole) + 1 URL (stub, whole) → injected=2, urlCount=1,
    fileCount=1, fileWhole=1, paged=0 → mixed branch "#@ injected 1 whole, 1 URL".

Task 4: ADD BUG2-3 — FILE-ONLY single-file regression (byte-for-byte)
  - NO fetch stub (no URL in the prompt). Reuse makeMockCtx + captureHandler + A_TS.
  - DRIVE: await slot.cb({ text: "#@a.ts", source: "interactive", images: [] }, ctx);
  - ASSERT: out.action === "transform"; rec.notify.m === "#@ injected 1 whole"; rec.notify.t === "info";
  - WHY: a.ts whole, no URLs → urlCount=0 → the byte-identical file-only branch. PASSES before AND after
    the fix → a regression guard that the file-only wording never drifts.

Task 5: ADD BUG2-4 — URL-ONLY plural (exercises the plural branch + multi-URL scan)
  - STUB: globalThis.fetch = async () => richHtmlRes(BUG2_RICH_HTML); restore in finally. (Called twice.)
  - DRIVE: await slot.cb({ text: "#example.com and #example.org", source: "interactive", images: [] }, ctx);
  - ASSERT:
      out.action === "transform";
      rec.notify.m === "injected 2 URLs";                      // EXACT plural string
      !rec.notify.m.includes("#@");                            // URL-only → no #@
      rec.notify.t === "info";
  - WHY: both tokens pass URL_SHAPE_RE + CODE_EXTENSIONS gate; both fetch (stub) → injected=2, urlCount=2,
    fileCount=0 → URL-only branch "injected 2 URLs" (plural because urlCount>1).

Task 6: SELF-RUN + iterate
  - `node ./file-injector.test.mjs` → all cases green (AFTER the sibling fix lands; BUG2-2/4 fail until then
    by design). If BUG2-3 fails, the file-only branch drifted — but that's the sibling's code, not yours.
  - `npm test` → all 4 files green.
```

### Implementation Patterns & Key Details

```javascript
// ── BUG2-2 MIXED (load-bearing: the only test of the mixed branch) ──
await runCase("BUG2-2", "BUG-002: mixed #@file + #url → notify has BOTH axes", async () => {
  const origFetch = globalThis.fetch;
  const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: true });
  const slot = captureHandler();
  try {
    globalThis.fetch = async () => richHtmlRes(BUG2_RICH_HTML);
    const out = await slot.cb({ text: "#@a.ts and #example.com", source: "interactive", images: [] }, ctx);
    assert(out.action === "transform", `handler must transform; got ${out.action}`);
    assert(rec.notify, "notify must fire (a file AND a URL were injected)");
    assert(rec.notify.m === "#@ injected 1 whole, 1 URL",
      `mixed notify must be '#@ injected 1 whole, 1 URL'; got ${JSON.stringify(rec.notify.m)}`);
    assert(rec.notify.m.includes("#@"), "mixed notify must still contain '#@' (files present)");
    assert(rec.notify.t === "info", `notify type must be 'info'; got ${rec.notify.t}`);
  } finally { globalThis.fetch = origFetch; }
});

// ── BUG2-3 FILE-ONLY (regression guard; passes pre- and post-fix) ──
await runCase("BUG2-3", "BUG-002 regression: file-only '#@a.ts' → '#@ injected 1 whole' (byte-for-byte)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: true });
  const slot = captureHandler();
  const out = await slot.cb({ text: "#@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform; got ${out.action}`);
  assert(rec.notify && rec.notify.m === "#@ injected 1 whole",
    `file-only notify must be exactly '#@ injected 1 whole'; got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  assert(rec.notify.t === "info", `notify type must be 'info'; got ${rec.notify.t}`);
});

// ── BUG2-4 URL-ONLY PLURAL (the plural branch + multi-URL scan) ──
await runCase("BUG2-4", "BUG-002: URL-only plural → 'injected 2 URLs' (no #@)", async () => {
  const origFetch = globalThis.fetch;
  const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: true });
  const slot = captureHandler();
  try {
    globalThis.fetch = async () => richHtmlRes(BUG2_RICH_HTML);
    const out = await slot.cb({ text: "#example.com and #example.org", source: "interactive", images: [] }, ctx);
    assert(out.action === "transform", `handler must transform; got ${out.action}`);
    assert(rec.notify, "notify must fire (2 URLs were injected)");
    assert(rec.notify.m === "injected 2 URLs",
      `URL-only plural notify must be 'injected 2 URLs'; got ${JSON.stringify(rec.notify.m)}`);
    assert(!rec.notify.m.includes("#@"), `URL-only notify must NOT contain '#@'; got ${JSON.stringify(rec.notify.m)}`);
    assert(rec.notify.t === "info", `notify type must be 'info'; got ${rec.notify.t}`);
  } finally { globalThis.fetch = origFetch; }
});
```

### Integration Points

```yaml
TEST FILE: file-injector.test.mjs   # EXTEND ONLY — append BUG2-2/3/4 + 2 shared helpers after BUG2-1
SOURCE: no change (file-injector.ts is the sibling's fix target — READ-ONLY here)
url-injection.test.mjs: no change (BUG-001 regression file — not this task's)
PACKAGE.JSON: no change (4-file chain already includes file-injector.test.mjs)
```

## Validation Loop

### Level 1: Syntax (immediate)
```bash
# .mjs parses as ESM (the project lints/typechecks ONLY file-injector.ts, not .mjs).
node --check ./file-injector.test.mjs          # parse-check only; expected no output, exit 0
git branch --show-current                       # MUST print "url-injector" (not "main")
```

### Level 2: Unit Tests (the deliverable)
```bash
# The edited file standalone — GREEN only AFTER the sibling's notify fix lands.
node ./file-injector.test.mjs
# Expected (post-fix): "✓ BUG2-1/BUG2-2/BUG2-3/BUG2-4" + every prior case still ✓; exit 0.
# Expected (pre-fix): BUG2-2 + BUG2-4 FAIL ("…; got '#@ injected 2 whole'") — by design; BUG2-3 still PASSES.

# Full suite (4 files) — must not regress BUG-001, import, or relative-imports suites.
npm test
# Expected: exit 0 (post-fix). url-injection.test.mjs is unaffected (it doesn't assert the input toast).
```

### Level 3: Isolation / contract sanity
```bash
# Prove no fetch-stub leak between the new cases: each restores globalThis.fetch in finally.
node ./file-injector.test.mjs && echo "ISOLATION OK"

# Invert-and-watch (confidence): if you flip BUG2-4's prompt to "#@a.ts and #example.org" it should now
# report the MIXED string ("#@ injected 1 whole, 1 URL"), proving the mixed/URL-only branches diverge
# correctly. (Dev-time sanity only; do not commit the flip.)
```

### Level 4: Domain-specific (none — hermetic by design)
No network, no model, no Pi process. Every `fetch` is a `globalThis.fetch` stub returning rich HTML; `a.ts`
is a pre-built TMPDIR fixture. Level 2 IS the full validation.

## Final Validation Checklist

### Technical Validation
- [ ] `git branch --show-current` → `url-injector`.
- [ ] `node --check ./file-injector.test.mjs` passes.
- [ ] `node ./file-injector.test.mjs` exits 0 (post-fix): BUG2-1/2/3/4 all green.
- [ ] `npm test` exits 0 (4 files).
- [ ] No fetch-stub leak: `globalThis.fetch` restored in `finally` for BUG2-2 and BUG2-4.

### Feature Validation (the 3 new cases)
- [ ] BUG2-2 mixed → exact `#@ injected 1 whole, 1 URL`; `#@` present; both axes.
- [ ] BUG2-3 file-only → exact `#@ injected 1 whole` byte-for-byte; type `info`.
- [ ] BUG2-4 URL-only plural → exact `injected 2 URLs`; no `#@`; type `info`.
- [ ] `rec.notify.t === "info"` asserted in all three.

### Code Quality
- [ ] Reuses the established harness (makeMockCtx/captureHandler/A_TS/runCase) — no re-declaration.
- [ ] Shared `BUG2_RICH_HTML` + `richHtmlRes` keep BUG2-2/4 DRY (BUG2-1's inline stub left untouched).
- [ ] Comments note that BUG2-2/4 require the sibling fix (so a pre-fix run's failures are understood).
- [ ] BUG2-1 (sibling), `url-injection.test.mjs`, and `file-injector.ts` untouched.

### Documentation
- [ ] Mode B (test-only): no README/PRD/source changes.

## Anti-Patterns to Avoid

- ❌ Don't duplicate BUG2-1 — it's the sibling's anchor; add BUG2-2/3/4 only (no id collision).
- ❌ Don't put these tests in `url-injection.test.mjs` — it lacks captureHandler/makeMockCtx and is the BUG-001 file.
- ❌ Don't edit `file-injector.ts` — the notify fix is the sibling's deliverable; this task is test-only.
- ❌ Don't call `captureAllHandlers`/session_start — `captureHandler()` alone works (cfg defaults enabled; BUG2-1 proves it).
- ❌ Don't omit `finally { globalThis.fetch = origFetch; }` in BUG2-2/4 — a leaked stub corrupts later cases / hits real network.
- ❌ Don't share ONE response object across fetches — the reader's `done` flag is single-use; `richHtmlRes` must be called per-fetch.
- ❌ Don't use a trivial HTML body — defuddle may extract <200 chars → SPA fallback → injected===0 → notify never fires. Use the ~3KB article.
- ❌ Don't import makeRes/RICH_HTML from url-injection.test.mjs — test files don't cross-import; define helpers inline.
- ❌ Don't write a `file.txt` fixture when `a.ts` already exists and matches PN1/PN2 — reuse `A_TS` for robustness.
- ❌ Don't use PAGED_FIX — makeMockCtx's no-budget ctx gives the deterministic all-whole counts these assertions need.
- ❌ Don't bump a hardcoded total — passed/failed auto-increment in runCase.

## Confidence Score: 9/10
One-pass success is very high: the harness is fully defined and line-verified, BUG2-1 is the exact pattern
to copy, the expected notify strings are derived directly from the sibling PRP's three-branch contract
(calculated, not guessed), and the `a.ts` fixture guarantees deterministic `1 whole` counts. The only
residual risk is timing — BUG2-2/4 fail until the sibling's fix lands — which is BY DESIGN (they're the
regression guard) and is explicitly documented. The multi-URL plural case is the one novel shape; it's
mitigated by the per-call `richHtmlRes` factory (no single-use-reader bug) and the verified fact that
`.com`/`.org` pass the CODE_EXTENSIONS gate.