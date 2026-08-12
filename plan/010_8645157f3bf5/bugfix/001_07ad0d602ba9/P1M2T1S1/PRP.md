# PRP — P1.M2.T1.S1: Trigger-aware status notify for URL-only injections (BUG-002)

---

## Goal

**Feature Goal**: Make the input-handler status toast **trigger-aware** so a URL-only prompt
(e.g. `Summarize #example.com`) no longer reports `#@ injected 1 whole` — wording that references
the wrong trigger (`#@`) and a meaningless axis (`whole`/`paged`, which never apply to URLs). The
notify must distinguish three cases using the already-returned `details[].kind` breakdown:
files-only (byte-for-byte unchanged wording), URLs-only (new wording, no `#@`), and mixed (both).

**Deliverable**:
1. **EDIT** `file-injector.ts` — the input handler's notify block (after `pending = { blocks, details }`,
   before `if (ctx.hasUI) ctx.ui.notify(...)`). Compute `urlCount`/`fileCount` from `details`, and replace
   the single hardcoded `msg` with a three-branch trigger-aware construction. The `injectFiles` return
   shape is **UNCHANGED** (no new field, no `State` change). The `if (ctx.hasUI)` guard + `"info"` type
   are **unchanged**.
2. **EDIT** `file-injector.test.mjs` — add ONE handler-level failing-first test (`BUG2-1`) that drives the
   input handler with a URL-only prompt (stub `globalThis.fetch` → rich HTML) and asserts the notify does
   NOT contain `#@`. Written FIRST (fails before the fix), then the fix makes it pass.

**Success Definition**:
- **TDD order**: `BUG2-1` FAILS before the fix (notify contains `#@`), PASSES after (notify reads
  `injected 1 URL`).
- **No regression**: the existing file-only notify cases (file-injector.test.mjs Case 9
  `#@ injected 2 whole`, etc.) stay byte-for-byte green (the `urlCount === 0` branch is the original string).
- `npm run typecheck` exits 0; `npm test` exits 0 (all 4 test files green after the fix).
- The `injectFiles` return shape is unchanged; no new export is added (module-surface allowlist stays green).

## User Persona

**Target User**: Every Pi user who types a `#<url>` into a prompt (and sees the toast). Indirectly: the
maintainer + CI.
**Use Case**: A user writes `Summarize #example.com` and glances at the toast. Today it lies (`#@ injected 1
whole`); after the fix it tells the truth (`injected 1 URL`).
**User Journey**: prompt with `#<url>` only → handler injects → toast reads `injected 1 URL` (no `#@`); prompt
with `#@a.ts` only → toast reads `#@ injected 1 whole` (unchanged); prompt with both → toast reads
`#@ injected 1 whole, 1 URL`.
**Pain Points Addressed**: BUG-002 — the toast references the wrong trigger and a meaningless `whole`/`paged`
axis for URL-only prompts (URLs can never be paged — `injectUrl` returns false on over-budget with NO paging).

## Why

- **Correctness of user-facing feedback.** The toast is the only visible signal that injection happened. A
  URL-only prompt reporting `#@` is observably wrong and erodes trust in the feature.
- **Zero-risk, surgical change.** The fix needs NO new return field, NO `State` change, NO new export — the
  `details[].kind` breakdown already distinguishes URLs from files. The file-only path is byte-for-byte
  preserved, so the ~existing notify assertions cannot regress.
- **Fills the exact gap test_analysis §11 names** ("No URL-only notify test … drives a URL-only prompt through
  the handler and checks the notify wording"). The failing-first test is the regression guard; the
  comprehensive suite (URL-only + mixed) is expanded by the sibling P1.M2.T2.S1.

## What

[User-visible behavior: the toast wording depends on what was injected.]
- **Files only** (`urlCount === 0`, the common case): `#@ injected ${whole} whole` (+ `, N paged` if paging).
  **Byte-for-byte identical to today.**
- **URLs only** (`fileCount === 0`): `injected ${urlCount} URL` (or `URLs` if >1). No `#@`, no `whole`/`paged`.
- **Mixed** (both >0): `#@ injected ${fileWhole} whole` (+ `, N paged` if paging)`, ${urlCount} URL(s)`.

### Success Criteria

- [ ] URL-only prompt (`see #example.com`, text/html rich mock) → toast does NOT contain `#@` and reads `injected 1 URL`.
- [ ] File-only prompt → toast is byte-for-byte `#@ injected N whole[, M paged]` (unchanged — verified by the
      existing Case 9 / notify assertions staying green).
- [ ] Mixed prompt (`#@a.ts` + `#example.com`) → toast contains BOTH `#@ injected … whole` AND `1 URL`.
- [ ] `BUG2-1` is the failing-first regression test in `file-injector.test.mjs` (fails before fix, passes after).
- [ ] `npm run typecheck` exit 0; `npm test` exit 0; no new export / no return-shape change.

## All Needed Context

### Context Completeness Check

_Pass._ "If someone knew nothing about this codebase, would they have everything needed?" — **Yes.** The exact
buggy block (anchored by TEXT, not line number, since P1.M1.T1.S1's gate shifted lines), the exact three-branch
replacement (verbatim, with the `urlCount===0` path byte-identical to the original), the exact `FileDetail.kind`
union + the 1:1 `details.length === injected` proof, the exact handler-test harness (`captureHandler` +
`makeMockCtx`, already in `file-injector.test.mjs`), the `cfg` default-enabled proof, and the calibrated rich-HTML
fixture (defuddle yields 1024 chars ≥ 200-char SPA floor) are all below. No inference required.

### Documentation & References

```yaml
# MUST READ — the authoritative source/test map (BUG-002 sections).
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/source_analysis.md
  why: §5 = the buggy notify block (exact source) + why injected can't distinguish today; §9 = State/Ctx types
        (ctx.hasUI / ctx.ui.notify); §13 = fix options (this PRP uses option (b): details[].kind, NO new field).
  critical: the notify type union is pinned ("info"|"warning"|"error") — keep "info"; the if(ctx.hasUI) guard is required for headless.

# MUST READ — the handler/notify test harness patterns.
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/test_analysis.md
  why: §7 = captureHandler() + makeMockCtx() (notify spy) + the "drive the handler, assert rec.notify" pattern;
        §8 = the exact BUG-002 source location; §11 = the "no URL-only notify test" gap this task fills.
  critical: the handler is driven via slot.cb({text,source:"interactive",images:[]}, ctx); rec.notify === {m, t} after a notify fires.

# MUST READ — the parallel sibling (avoid overlap). BUG-001 regression tests in url-injection.test.mjs.
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M1T2S1/PRP.md
  why: states BUG-002 notify tests belong in file-injector.test.mjs ("vs P1.M2.T2.S1 … edits file-injector.test.mjs
        (notify wording), NOT url-injection.test.mjs. No overlap."). Confirms my test file choice.
  take: P1.M1.T2.S1 edits url-injection.test.mjs ONLY; THIS task edits file-injector.ts + file-injector.test.mjs. Disjoint.

# The code under edit (READ before editing; the notify block).
- file: file-injector.ts
  why: the input-handler notify block is the fix locus; FileDetail.kind union (L504) is the breakdown key.
  pattern: anchor the edit by the EXACT TEXT of `pending = { blocks, details };` + the `const whole = injected - paged; const msg = …` lines
           (line numbers drift — P1.M1.T1.S1's CODE_EXTENSIONS gate shifted nearby lines).
  gotcha: do NOT add a new injectFiles return field or State field — details[].kind is sufficient. keep the urlCount===0 branch byte-identical.

# The harness file to extend (reuses captureHandler + makeMockCtx already present there).
- file: file-injector.test.mjs
  why: §7 test_analysis — captureHandler()/makeMockCtx() live HERE (not in url-injection.test.mjs). The handler-level
        notify test belongs here (mirrors Case 9's `await slot.cb({…}, ctx)` → `rec.notify.m` pattern).
  pattern: copy Case 9's drive shape; add a SELF-CONTAINED inline fetch stub + rich HTML (file-injector.test.mjs has no makeRes/RICH_HTML).
  gotcha: restore globalThis.fetch in finally; cfg defaults to {} → enableUrls enabled with zero config (verified).
```

### Current Codebase tree (files this item touches)

```bash
.
├── file-injector.ts          # EDIT: the input-handler notify block (trigger-aware msg; details[].kind breakdown)
├── file-injector.test.mjs    # EDIT: + ONE handler-level failing-first test (BUG2-1), reusing captureHandler/makeMockCtx
├── url-injection.test.mjs    # NOT modified (owned by the parallel P1.M1.T2.S1; BUG-001 regression block)
├── package.json              # NOT modified (the test chain is unchanged)
├── scripts/typecheck.mjs     # NOT modified
└── README.md                 # NOT modified (P1.M3.T1.S1; the toast is not a documented API surface)
```

### Desired Codebase tree with files to be added

```bash
# No NEW files. Two in-place edits:
# file-injector.ts (input handler): after `pending = { blocks, details };` add the urlCount/fileCount compute;
#   replace `const whole…; const msg = …;` with the three-branch trigger-aware msg; keep `if (ctx.hasUI) ctx.ui.notify(msg,"info")`.
# file-injector.test.mjs: +1 runCase "BUG2-1" (failing-first: URL-only prompt → notify must NOT contain "#@").
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL (line drift): the contract cites L1478–1495; the CURRENT file has the notify ~L1541–1545 (P1.M1.T1.S1's
//   CODE_EXTENSIONS gate shifted lines). ANCHOR THE EDIT BY TEXT, not line number:
//     oldText: the `pending = { blocks, details };` line + the `const whole = injected - paged;\n    const msg = …` block.
//   (The edit tool matches exact text — stable across line drift.)

// CRITICAL (byte-for-byte preservation): the urlCount===0 branch MUST be the EXACT original string
//   `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}` with whole = injected - paged.
//   file-injector.test.mjs Case 9 asserts `#@ injected 2 whole` verbatim — any wording drift there breaks it.

// CRITICAL (no new return field / no State change): the contract is explicit — use details[].kind only.
//   Adding a `urls` count to the return would ripple into State + 4 test files' expectations. DON'T.

// CRITICAL (FileDetail.kind breakdown): urlCount = details.filter(d => d.kind === "url").length. Only text/html/
//   json/xml URLs are kind:"url". A URL returning an IMAGE is kind:"image" (injectUrl L889) → counts as a FILE.
//   That is ACCEPTABLE per the contract (filter on kind==="url"); it is out of scope for this wording fix
//   (the bug is about text/HTML URL-only prompts). Document it; do not try to "fix" it.

// GOTCHA (1:1 invariant): details.length === injected === state.count (every count++ is paired with exactly one
//   details.push — verified L889/937/1203/1216/1229/1256/1280/1289). So fileCount = injected - urlCount is exact.

// GOTCHA (paged ⊆ files): URLs NEVER increment paged (injectUrl returns false on over-budget with NO paging).
//   So fileWhole = fileCount - paged is always ≥ 0, and `paged > 0` only when files paged. The mixed branch's
//   `${paged > 0 ? … : ""}` is therefore correct (a URL-only prompt always has paged===0).

// GOTCHA (cfg default-enabled in the test): captureHandler() does NOT fire session_start → module-level cfg
//   stays {} → cfg.enableUrls is undefined → `undefined !== false` === true → URLs ENABLED with zero config.
//   So a URL-only handler test works WITHOUT configuring anything. readConfig returns {} when no config files
//   exist (TMPDIR) — robust even if session_start fired.

// GOTCHA (rich HTML ≥ 200 chars): injectUrl's HTML path applies a 200-char SPA floor on the EXTRACTED markdown.
//   A trivial "<p>hi</p>" may extract <200 chars → SPA fallback → injected===0 → notify never fires → the case
//   cannot assert wording. Use a rich <article> (title + 3 substantial paragraphs). Calibrated yield: 1024 chars.

// GOTCHA (fetch restore in finally): the failing test stubs globalThis.fetch; ALWAYS restore it in finally
//   or later cases in file-injector.test.mjs inherit a stale stub (and could hit the REAL network).
```

## Implementation Blueprint

### Data models and structure

No new models. The fix is a string-construction change inside the input handler, reading the already-present
`details: FileDetail[]`. The `FileDetail.kind` union is **already** `"text" | "image" | "binary" | "paged" | "url"`
(file-injector.ts L504) — no type change.

### Implementation Tasks (ordered by dependencies — TDD: failing test FIRST)

```yaml
Task 1: ADD the failing-first test (file-injector.test.mjs) — BUG2-1
  - PLACE: near the existing handler/notify cases (after Case 9 / the notify-assertion cluster), OR in a new
           short "BUG-002" mini-section. Use runCase (Style A — same file's convention).
  - REUSE: captureHandler() (returns {cb} = the input handler) + makeMockCtx(TMPDIR, {hasUI:true})
           (returns {ctx, rec}; rec.notify === {m, t} after a notify fires). Both ALREADY defined in this file.
  - DEFINE inline (this file has no makeRes/RICH_HTML): a rich HTML body (title + 3 paragraphs of real text,
           ~3 KB — calibrated to yield 1024 chars of defuddle markdown ≥ 200-char SPA floor) + a minimal fetch
           stub returning { ok:true, status:200, headers:{get}, body:{getReader}, text }.
  - BODY (the failing-first assertion — fails BEFORE the fix because notify reads "#@ injected 1 whole"):
        await runCase("BUG2-1", "BUG-002: URL-only prompt → notify must NOT say '#@'", async () => {
          const origFetch = globalThis.fetch;
          const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: true });
          const slot = captureHandler();
          const html = RICH_HTML_INLINE;       // the ~3 KB <article> (see Implementation Patterns)
          const buf = Buffer.from(html, "utf8");
          try {
            globalThis.fetch = async () => ({
              ok: true, status: 200,
              headers: { get: (k) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
              body: { getReader: () => { let done = false; return { read: async () => {
                if (done) return { done: true, value: undefined };
                done = true; return { done: false, value: buf };   // Buffer IS a Uint8Array
              }};}},
              text: async () => buf.toString("utf8"),
            });
            const out = await slot.cb({ text: "see #example.com", source: "interactive", images: [] }, ctx);
            assert(out.action === "transform", `handler must transform; got ${out.action}`);
            assert(rec.notify, "notify must fire (a URL WAS injected)");
            assert(!rec.notify.m.includes("#@"), `URL-only notify must NOT contain '#@'; got ${JSON.stringify(rec.notify.m)}`);
            assert(rec.notify.t === "info", `notify type must be 'info'; got ${rec.notify.t}`);
          } finally { globalThis.fetch = origFetch; }
        });
  - RUN (expect FAIL): node ./file-injector.test.mjs   → BUG2-1 fails ("URL-only notify must NOT contain '#@';
        got '#@ injected 1 whole'"). This is correct TDD — the bug is reproduced before the fix.

Task 2: IMPLEMENT the trigger-aware notify (file-injector.ts, input handler)
  - ANCHOR (by text, NOT line number — lines drifted from the contract's L1493–1495):
      oldText (the block to replace — exact):
        "    const whole = injected - paged;\n    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : \"\"}`;"
  - REPLACE WITH the three-branch construction (see "Implementation Patterns"). Insert the urlCount/fileCount
    compute either just above the msg or inline (after `pending = { blocks, details };`).
  - KEEP: `if (ctx.hasUI) ctx.ui.notify(msg, "info");` UNCHANGED (guard + type).
  - KEEP: the `return { action: "transform" as const, text: event.text, images };` UNCHANGED.
  - The urlCount===0 branch MUST be byte-for-byte the original string (PRD: file-only behavior preserved).
  - DOCS: update the §5.5 comment above the msg to describe the three branches (no JSDoc/README change — the
          toast is not a documented API surface, per item LOGIC #5).

Task 3: VERIFY the fix (TDD green)
  - RUN: node ./file-injector.test.mjs   → BUG2-1 now PASSES (notify reads "injected 1 URL", no "#@"); Case 9
         and all other notify cases STILL PASS (urlCount===0 branch is byte-identical).
  - RUN: npm run typecheck               → exit 0 (details.filter is typed; no new symbols).
  - RUN: npm test                        → exit 0 (all 4 files; url-injection.test.mjs unaffected by this fix).

Task 4: (OPTIONAL, do-not-commit) mixed-case sanity probe
  - If desired, temporarily extend BUG2-1 with a mixed prompt ("#@a.ts and #example.com" — requires a.ts
    fixture, already built by the file's buildFixtures) and assert the notify contains BOTH "#@ injected" and
    "1 URL". NOTE: the comprehensive mixed/URL-only regression suite is P1.M2.T2.S1's job — keep this task's
    committed test to the single BUG2-1 (URL-only, no-#@) to avoid scope creep / overlap with the sibling.
```

### Implementation Patterns & Key Details

```ts
// ── THE FIX (file-injector.ts input handler) — three-branch trigger-aware msg ──────────────────────────
// Anchor: replace the two lines `const whole = injected - paged;` + `const msg = \`#@ injected …\`;`
// (keep `if (ctx.hasUI) ctx.ui.notify(msg, "info");` and the return UNCHANGED). details is in scope
// (destructured at the top of the handler).
const urlCount = details.filter((d) => d.kind === "url").length;
const fileCount = injected - urlCount; // details.length === injected; non-url kinds are all files
let msg;
if (urlCount === 0) {
  // FILES ONLY — byte-for-byte the ORIGINAL string (file-injector.test.mjs Case 9 asserts this verbatim).
  const whole = injected - paged;
  msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
} else if (fileCount === 0) {
  // URLS ONLY — no '#@', no whole/paged axis (URLs can never be paged).
  msg = `injected ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
} else {
  // MIXED — files keep the '#@ injected … whole[, … paged]' axis, then append the URL count.
  const fileWhole = fileCount - paged; // paged ⊆ files (URLs never page) → fileWhole ≥ 0
  msg = `#@ injected ${fileWhole} whole${paged > 0 ? `, ${paged} paged` : ""}, ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
}
if (ctx.hasUI) ctx.ui.notify(msg, "info");

// ── THE FAILING-FIRST TEST (file-injector.test.mjs) — rich HTML that clears the 200-char SPA floor ──────
// A real <article> with a title + 3 substantial paragraphs. Calibrated (sibling feature plan): defuddle
// yields ~1024 chars of markdown — comfortably ≥ URL_MIN_CONTENT (200). Do NOT use trivial "<p>hi</p>".
const RICH_HTML_INLINE = `<!doctype html><html><head><title>Example Domain</title></head><body>
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
```

### Integration Points

```yaml
SOURCE (file-injector.ts):
  - edit: the input-handler notify block (after `pending = { blocks, details };`).
  - preserve: `if (ctx.hasUI) ctx.ui.notify(msg, "info");` + the `return { action:"transform", text:event.text, images };`.
  - no new field: injectFiles return shape UNCHANGED; no State change; no new export.
TEST (file-injector.test.mjs):
  - add: one runCase "BUG2-1" (failing-first), reusing captureHandler() + makeMockCtx().
  - no new harness helper (the fetch stub + RICH_HTML are inline in the case; this file has no shared makeRes).
PACKAGE.JSON: none (the test chain already includes file-injector.test.mjs as the first step).
README / JSDoc: none (the toast is transient UI, not a documented API surface — item LOGIC #5).
DOWNSTREAM: P1.M2.T2.S1 adds the comprehensive URL-only + mixed regression suite (extends BUG2-* in
  file-injector.test.mjs). Leave that expansion to the sibling; this task commits only BUG2-1.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# .mjs: parse-check the edited test file (the project lints/typechecks ONLY file-injector.ts, not .mjs).
node --check ./file-injector.test.mjs      # Expected: no output, exit 0 (valid module).
# .ts: the HARD gate — proves the trigger-aware msg + the details.filter typecheck under --strict.
npm run typecheck                          # Expected: exit 0, "0 errors". (details.filter(d=>d.kind==="url")
#   is well-typed; `let msg: string` is assigned on all three branches — no "possibly undefined" if you keep
#   the three branches exhaustive. If TS complains msg may be unset, initialize `let msg = "";` defensively.)
```

### Level 2: Unit Tests (TDD — the failing-first proof, then green)

```bash
# STEP 1 (TDD red): run BEFORE applying the Task 2 fix. BUG2-1 MUST fail (the bug is reproduced).
node ./file-injector.test.mjs
# Expected (pre-fix): "✗ BUG2-1: … → URL-only notify must NOT contain '#@'; got '#@ injected 1 whole'",
#   and exit 1. (All OTHER cases should still PASS — the bug is isolated to the URL-only wording.)

# STEP 2 (TDD green): apply the Task 2 fix, re-run. BUG2-1 passes; Case 9 + all notify cases still green.
node ./file-injector.test.mjs
# Expected (post-fix): "✓ BUG2-1" + every prior case still ✓; "Result: N passed, 0 failed."; exit 0.
#   If Case 9 now fails, the urlCount===0 branch is NOT byte-identical to the original — fix the string.
```

### Level 3: Integration Testing (the full chain)

```bash
# The whole repo gate — file-injector.test.mjs runs FIRST, url-injection.test.mjs LAST. All 4 must be green.
npm test
# Expected: exit 0 (after the fix). url-injection.test.mjs is unaffected by this fix (it doesn't assert the
#   input-handler toast; its notify spy FAIL-7 is the SPA-fallback notify inside injectUrl, a different path).
# (Requires the global pi package for the jiti loader — environmental, not a logic failure if absent.)
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (Hermetic by construction — the only fetch is the inline stub in BUG2-1; no real network. No
#  Playwright/Docker/DB/perf/security scanning applies to a notify-wording + one-test change.)

# Optional wording spot-check (post-fix) — prove the three branches produce the expected strings without
# driving the full handler (pure string-construction confidence). NOT committed; dev-time sanity only.
node --input-type=module -e '
  function build(injected, paged, urlCount) {
    const fileCount = injected - urlCount;
    if (urlCount === 0) { const w = injected - paged; return `#@ injected ${w} whole${paged > 0 ? `, ${paged} paged` : ""}`; }
    if (fileCount === 0) return `injected ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
    const fw = fileCount - paged;
    return `#@ injected ${fw} whole${paged > 0 ? `, ${paged} paged` : ""}, ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
  }
  console.log(build(2,0,0));  // file-only  → "#@ injected 2 whole"          (Case 9 parity)
  console.log(build(1,0,1));  // URL-only   → "injected 1 URL"               (BUG-002 fix)
  console.log(build(3,1,1));  // mixed      → "#@ injected 1 whole, 1 paged, 1 URL"
  console.log(build(2,0,2));  // 2 URLs     → "injected 2 URLs"
'
# Expected (matches the PRD wording contract exactly). Cross-check the handler output equals build().
```

## Final Validation Checklist

### Technical Validation
- [ ] `node --check ./file-injector.test.mjs` exits 0; `npm run typecheck` exits 0.
- [ ] TDD: BUG2-1 FAILS before the fix (`#@` present) and PASSES after (`injected 1 URL`).
- [ ] `npm test` exits 0 (all 4 test files green after the fix).

### Feature Validation
- [ ] URL-only prompt → toast has NO `#@` and reads `injected 1 URL` (BUG2-1).
- [ ] File-only prompt → toast is byte-for-byte `#@ injected N whole[, M paged]` (Case 9 + notify cases green).
- [ ] Mixed prompt → toast contains BOTH the `#@ injected … whole` file axis AND `N URL(s)`.
- [ ] `if (ctx.hasUI)` guard + `"info"` type unchanged; `injectFiles` return shape unchanged.

### Code Quality Validation
- [ ] No new `injectFiles` return field, no `State` change, no new export (allowlist guard stays green).
- [ ] The `urlCount === 0` branch is byte-identical to the original string.
- [ ] Edit anchored by TEXT (not line number) — robust to P1.M1.T1.S1's line drift.
- [ ] The failing test restores `globalThis.fetch` in `finally`.

### Documentation & Deployment
- [ ] §5.5 comment updated to describe the three branches (toast is not a documented API surface; no README/JSDoc).

---

## Anti-Patterns to Avoid

- ❌ Don't add a new `injectFiles` return field (e.g. `urls` count) or a `State` field — `details[].kind` already provides the breakdown (contract is explicit; adding a field ripples into 4 test files).
- ❌ Don't alter the `urlCount === 0` branch's string — file-injector.test.mjs Case 9 asserts `#@ injected 2 whole` byte-for-byte; any drift breaks it.
- ❌ Don't change the notify `type` ("info") or drop the `if (ctx.hasUI)` guard — headless print/json modes have no `ctx.ui`.
- ❌ Don't anchor the edit by line number — P1.M1.T1.S1's `CODE_EXTENSIONS` gate shifted the notify lines; anchor by the exact `const whole = injected - paged; const msg = …` text.
- ❌ Don't use a trivial HTML body in BUG2-1 — defuddle may extract <200 chars → SPA fallback → injected===0 → notify never fires → the case can't assert wording. Use the rich `<article>` (calibrated 1024-char yield).
- ❌ Don't forget `finally { globalThis.fetch = origFetch; }` in BUG2-1 — a leaked stub poisons later cases and can hit the real network.
- ❌ Don't put the BUG-002 test in `url-injection.test.mjs` — that file is owned by the parallel P1.M1.T2.S1 (BUG-001 regression). BUG-002 notify tests belong in `file-injector.test.mjs` (its own PRP confirms this).
- ❌ Don't expand this task's test into the full URL-only + mixed regression suite — that's P1.M2.T2.S1's scope. Commit only BUG2-1 (the failing-first no-`#@` anchor).
- ❌ Don't try to make image-URLs (`kind:"image"`) count as URLs — the contract filters `kind==="url"`; that nuance is out of scope and changing it would need a different breakdown key.

---

## Confidence Score

**9 / 10** for one-pass success. The change is surgical (one string-construction block + one failing test),
needs no new field/export/State, and the `urlCount === 0` branch is provably byte-identical to the original
(so the existing notify cases cannot regress). All load-bearing facts are verified: the exact buggy block
(anchored by text), the `FileDetail.kind` union + the 1:1 `details.length === injected` invariant, the `paged ⊆
files` property (URLs never page), the `cfg` default-enabled proof (handler URL test works with zero config),
and a calibrated rich-HTML fixture (1024-char defuddle yield ≥ 200-char SPA floor). The TDD red→green ordering
is explicit. Residual risk: (1) line drift — mitigated by text-anchored edits; (2) defuddle extraction length
on the chosen fixture wording — mitigated by the calibrated 3-paragraph `<article>` and the assertion message
naming the actual notify value for fast debugging; (3) a `let msg` possibly-unset typecheck nit — mitigated by
the `let msg = ""` defensive-init note.

## Parallel-Safety Note (for the orchestrator / merger)

- **vs P1.M1.T1.S1** (the `CODE_EXTENSIONS` gate — "Implementing"): edits `file-injector.ts` (constants cluster +
  URL loop) AND `url-injection.test.mjs` (DENY-1 + COL-4). THIS task edits `file-injector.ts` (the input-handler
  notify block, far below the loop) AND `file-injector.test.mjs`. **file-injector.ts overlap**: both edit it, but
  in TEXT-DISJOINT regions (S1: constants ~L45–66 + URL loop ~L1404; THIS: input handler notify ~L1541–1545).
  Clean merge either order. **Line drift**: S1 may shift THIS task's notify lines — hence the TEXT-anchored edit
  (stable regardless of S1's line count). If both merge simultaneously, rebase THIS onto S1's tree and re-run typecheck.
- **vs P1.M1.T2.S1** (BUG-001 regression tests — parallel NOW): edits `url-injection.test.mjs` ONLY. THIS task does
  NOT touch `url-injection.test.mjs`. **No overlap.** (Its own PRP explicitly assigns BUG-002 notify tests to
  `file-injector.test.mjs`.)
- **vs P1.M2.T2.S1** (BUG-002 regression suite — future sibling): will add the comprehensive URL-only + mixed
  notify cases in `file-injector.test.mjs`. THIS task commits only the single `BUG2-1` failing-first anchor;
  P1.M2.T2.S1 EXTENDS the `BUG2-*` group (no id collision — it adds BUG2-2/3…). Coordinate via this PRP's
  "leave the expansion to the sibling" note.
- **vs P1.M3.T1.S1** (README): edits `README.md`. No overlap (the toast is not a documented surface).