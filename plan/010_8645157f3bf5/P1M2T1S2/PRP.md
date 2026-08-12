# PRP — P1.M2.T1.S2: URL Failure / Guard Tests (all → verbatim, no block, no network when disabled)

> **DOCS MODE:** A (test files are self-documenting) — no README changes. This PRP touches ONLY
> `url-injection.test.mjs` (extends it) and nothing else.

## Goal

**Feature Goal**: Extend `url-injection.test.mjs` (created by P1.M2.T1.S1) with a comprehensive
**FAILURE / GUARD** test group proving every failure path in `injectUrl` leaves the `#<url>` token
**verbatim** (`r.text === prompt` byte-for-byte), appends **no block** (`r.injected === 0`, empty
`blocks`), never throws, and makes **zero network calls when `enableUrls === false`**.

**Deliverable**: ~9 new `runCase(...)` entries appended to `url-injection.test.mjs` under a
`// ── FAILURE / GUARD CASES ──` banner, each using the per-case `globalThis.fetch` stub + `calls`
tracker from S1, plus a refreshed pass/fail matrix total. No source changes.

**Success Definition**: `node ./url-injection.test.mjs` exits 0 with all new cases green;
`npm test` (4 files) green; every failure case asserts `r.text === prompt`, `r.injected === 0`, no
block, and `globalThis.fetch` restored.

## Why

- **§3.5 / §3.3 / §3.4 contract fidelity** — the entire safety model of URL injection is "on any
  problem, leave the prompt untouched and let the model fetch it itself." These tests are the
  executable proof of that invariant (the verbatim-prompt contract from plan 009, applied to URLs).
- **Air-gapped opt-out (§4)** — `enableUrls:false` must be provably zero-egress. A unit test with a
  fetch spy is the only hermetic way to assert "no request made."
- **No-paging asymmetry (§3.3)** — URLs deliberately do NOT page (the `read` tool can't fetch a URL).
  The over-budget case must assert no `<paged:...>` directive sneaks in.
- Parallel-safe complement to S1: S1 owns DETECTION / DISPATCH / COLLISION / SCHEME-LESS; S2 owns
  FAILURE / GUARD. Zero overlap.

## What

User-visible behavior under test (all via `mod.injectFiles(...)`; `injectUrl` is PRIVATE):

| Failure input | Observed behavior |
|---|---|
| `#example.com` → 404 | `r.text` verbatim, `injected===0`, no block |
| `#example.com` → fetch rejects (DNS/TLS) | verbatim, no uncaught rejection |
| `#example.com` → AbortError (timeout sim) | verbatim |
| `#example.com` → Content-Length `1500000` | verbatim AND body reader **never called** |
| `#example.com` → body streams >1MB | verbatim (mid-stream cap) |
| `#example.com` rich HTML + remaining≈10 tokens | verbatim AND **no `<paged:>` block** |
| `#example.com` → defuddle <200 chars | verbatim + `ctx.ui.notify` called w/ SPA msg |
| `enableUrls:false` + `#example.com` | fetch **never called** + verbatim |
| `#example.com` → Content-Type `application/pdf` | verbatim (unhandled ct) |

### Success Criteria

- [ ] `node ./url-injection.test.mjs` exits 0
- [ ] `npm test` (all 4 files) exits 0
- [ ] Every failure case asserts `r.text === prompt` (original prompt, byte-for-byte — see Verbatim Contract)
- [ ] Every failure case asserts `r.injected === 0` and no block appended (except a deliberate mixed case, if added)
- [ ] `globalThis.fetch` restored to `origFetch` in a `finally` for every case (no leak between cases)
- [ ] Content-Length>1MB case proves the body reader was never called (spy counter `=== 0`)
- [ ] Over-budget case asserts NO `<paged:` substring in `r.blocks` (URLs never page)
- [ ] SPA case asserts `ctx.ui.notify` was invoked with the exact SPA message (and `ctx.hasUI===true`)
- [ ] `enableUrls:false` case asserts a fetch spy recorded `0` invocations

## All Needed Context

### Context Completeness Check
✅ Passes "No Prior Knowledge" test: an agent unfamiliar with the repo gets (a) the exact harness to
reuse from S1, (b) the verbatim-injection model, (c) line-precise references into `file-injector.ts`
for every failure branch, and (d) exact stub values (e.g. the derived `remaining` formula → the
`getContextUsage`/`contextWindow` numbers that yield `remaining ≈ 10`).

### Documentation & References

```yaml
- prd_section: "§3.3 Cap, timeout, over-budget → verbatim (NO paging)"
  why: "The three guards this PRP exercises end-to-end; the no-paging rationale for URLs."
  critical: "Over-budget URL is left VERBATIM (not truncated, not paged) — read tool can't fetch a URL."

- prd_section: "§3.4 SPA / empty-extraction fallback"
  why: "defuddle <200 chars → verbatim + notify 'page appears JS-rendered; left as reference'."

- prd_section: "§3.5 Failures → verbatim"
  why: "non-2xx/network/timeout/cap/unhandled-ct → return false, never throw, never append a block."

- prd_section: "§4 Config: enableUrls (default true) + §7 edge-case table"
  why: "enableUrls===false ⇒ ZERO network egress (the air-gapped opt-out)."

- arch_ref: "plan/010_8645157f3bf5/architecture/system_context.md — Refinement #2 ('cfg.enableUrls !== false')"
  why: "The default-ENABLED gate polarity; the handler passes `cfg.enableUrls !== false`, NOT `=== true`."

- contract_note: "Verbatim-prompt contract from plan 009 applies to URLs too: every failure case leaves r.text === prompt (original event.text byte-for-byte)."

- file: file-injector.ts
  lines: "injectUrl L830–916; readBodyCapped L767; URL_TIMEOUT_MS/URL_MAX_BYTES/URL_MIN_CONTENT L81-85; enableUrls gate L1404; remaining formula L1338-1347; State.subtract L510"
  why: "This IS the code under test. Read these exact ranges before writing stubs."

- dependency_prp: plan/010_8645157f3bf5/P1M2T1S1/PRP.md
  why: "S1 CREATES url-injection.test.mjs + its harness (jiti loader, makeRes, FIX, runCase/assert, RICH_HTML) and appends the package.json test entry. S2 EXTENDS that file — do NOT re-declare S1's pieces."

- pattern_file: file-injector.test.mjs
  lines: "L1-60 (jiti loader), L160-200 (makeMockCtx w/ ui.notify spy), L361 (FIX={cwd:TMPDIR}), L413-416 (PAGED_FIX getContextUsage+model — budget-aware ctx precedent)"
  why: "The harness S1 copied FROM and the notify-spy / budget-ctx patterns S2 reuses."
```

### Current Codebase tree (relevant slice)
```
file-injector.ts            # code under test (injectUrl + guards + enableUrls gate)
file-injector.test.mjs      # #@file harness S1's harness was copied from
url-injection.test.mjs      # ⬅ CREATED BY S1; S2 EXTENDS THIS FILE (does not exist until S1 lands)
package.json                # scripts.test: S1 appends "&& node ./url-injection.test.mjs" (4th entry)
plan/010_8645157f3bf5/
  P1M2T1S1/PRP.md           # dependency (S1) — the harness contract
  P1M2T1S2/research/research_notes.md  # THIS ITEM's research (derived-budget formula, per-case stub table)
  architecture/system_context.md       # Refinement #2 (enableUrls !== false)
```

### Desired Codebase tree (S2's only change)
```
url-injection.test.mjs      # MODIFIED: append ~9 runCase(...) entries under "// ── FAILURE / GUARD CASES ──"; bump matrix total
```
(No other file is touched. No new file. No package.json edit — S1 already wired the test entry.)

### Known Gotchas of our codebase & Library Quirks

```javascript
// CRITICAL — `URL_TIMEOUT_MS` is a PRIVATE module const (file-injector.ts L81 = 20_000), NOT exported.
// You CANNOT inject a reduced timeout. The real 20s cannot be exercised hermetically. Instead simulate
// the timeout: stub fetch to REJECT with an AbortError-like error:
//   const e = new Error("aborted"); e.name = "AbortError"; return Promise.reject(e);
// (immediate or after a short setTimeout). This proves the `catch { return false }` path → verbatim.
// Optional wiring sanity: capture the 2nd fetch arg `init` and assert `init.signal instanceof AbortSignal`.
// Document this limitation in a comment — the 20s *magnitude* is not asserted here.

// CRITICAL — `remaining` is DERIVED, not a field you set. Formula (file-injector.ts L1338-1347):
//   reserve = ctx.model?.maxTokens ?? 8192          // DEFAULT_RESERVE
//   remaining = max(0, usage.contextWindow - usage.tokens - reserve - MARGIN)   // MARGIN=8192
// To get remaining ≈ 10 with NO model (reserve=8192): getContextUsage: () => ({ tokens: 0, contextWindow: 16394 })
//   ⇒ 16394 - 0 - 8192 - 8192 = 10. The contract's "return a low remaining (e.g. 10)" is loose wording —
//   you must set contextWindow/tokens to hit the derived value.

// CRITICAL — ORDERING: the SPA check (md.length < URL_MIN_CONTENT) runs BEFORE the over-budget check.
// So the over-budget markdown MUST be ≥200 chars (else SPA fires first). Reuse S1's RICH_HTML
// (defuddle ≥1024 chars ⇒ cost 256 ≫ 10): passes SPA, then over-budget → verbatim, NO notify, NO paging.

// CRITICAL — Content-Length pre-check vs mid-stream: the pre-download check is
//   `if (len && len > URL_MAX_BYTES) return false`  (len=Number(headers['content-length']||0))
// To isolate the MID-STREAM guard (readBodyCapped returns null), make Content-Length ABSENT (len=0 ⇒
// pre-check false) and stream >1MB of body. To isolate the PRE-DOWNLOAD guard, set content-length
// '1500000' and assert the body reader spy was NEVER called.

// CRITICAL — URLs NEVER page. The over-budget case must assert r.blocks has NO entry containing
// "<paged:" — the file-paged directive only applies to local files (§3.3 asymmetry: read tool can't fetch).

// CRITICAL — injectUrl NEVER throws and never appends a block on failure (only `return false`). When
// count stays 0, injectFiles returns the ORIGINAL `text` ref + empty blocks (verbatim early-return).
// So `r.text === prompt` is the EXACT original prompt for every pure-failure case.

// CRITICAL — every per-case fetch stub MUST restore globalThis.fetch in a `finally`:
//   const origFetch = globalThis.fetch;  // save ONCE near top (after harness, before first case)
//   ... try { globalThis.fetch = async(u)=>{...}; ... } finally { globalThis.fetch = origFetch; }
// Otherwise a stub leaks into the next case and produces baffling cross-case failures.

// QUIRK — makeRes returns a PLAIN object shaped like Response (ok/status/headers.get/body.getReader/text).
// For the Content-Length>1MB case, override body.getReader with a SPY that records invocations, so you
// can assert it was never called:
//   const readerCalls = []; makeRes({..., contentLength:'1500000', body:{ getReader(){ readerCalls.push(1); return {read:()=>({done:true})}; } }})
//   assert(readerCalls.length === 0, "reader must not be called when Content-Length exceeds cap")
```

## Implementation Blueprint

### Data models and structure
No new data models. S2 reuses S1's `makeRes`, `FIX`, `runCase`, `assert`, and the `calls` tracker.
Two small test-local helpers are worth defining (both inline at the FAILURE/GUARD banner):

```javascript
// ctx WITH a notify spy (for the SPA case) — mirrors file-injector.test.mjs L160-200 makeMockCtx ui:
function ctxWithNotifySpy() {
  const notes = [];
  return {
    ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } },
    notes,
  };
}

// ctx WITH a derived low remaining (≈10 tokens, no model) — for the over-budget case:
const LOW_BUDGET_CTX = { cwd: TMPDIR, getContextUsage: () => ({ tokens: 0, contextWindow: 16394 }) };
// remaining = 16394 - 0 - 8192(DEFAULT_RESERVE) - 8192(MARGIN) = 10
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: VERIFY dependency (S1) is present
  - BEFORE WRITING: confirm url-injection.test.mjs exists and contains makeRes / runCase / FIX / RICH_HTML.
  - IF MISSING: STOP — S1 has not landed. Re-read plan/010_8645157f3bf5/P1M2T1S1/PRP.md; it is a hard prerequisite.
  - CONFIRM package.json scripts.test already has 4 entries (url-injection.test.mjs appended by S1).

Task 2: ADD the universal fetch-saved guard + two test-local helpers
  - PLACE: immediately before the FAILURE/GUARD banner (one line): `const origFetch = globalThis.fetch;`
  - ADD helpers ctxWithNotifySpy() and LOW_BUDGET_CTX (see Data Models above).
  - DO NOT re-declare makeRes / FIX / runCase / assert / RICH_HTML — S1 owns them.

Task 3: ADD banner `// ── FAILURE / GUARD CASES (§3.5 / §3.3 / §3.4 / §4) ──` and 9 runCase entries
  Each case: `const calls=[]; try{ globalThis.fetch=async(u,o)=>{calls.push(String(u));return STUB}; const r=await mod.injectFiles(PROMPT,[],CTX); ASSERT; } finally{ globalThis.fetch=origFetch; }`
  - Case A "non-2xx → verbatim": PROMPT="Read #example.com"; STUB=makeRes({ok:false,status:404}); assert r.text===prompt, r.injected===0, r.blocks.length===0.
  - Case B "network/DNS throw → verbatim": STUB=()=>Promise.reject(new Error("ENOTFOUND")); assert same; ALSO assert injectFiles resolved (no uncaught rejection) — the call returning r is itself the proof.
  - Case C "timeout (AbortError sim) → verbatim": STUB=()=>Promise.reject(Object.assign(new Error("aborted"),{name:"AbortError"})); comment that URL_TIMEOUT_MS is a private const (20s) so the magnitude isn't exercised; assert verbatim. (Optional: capture init arg, assert `init?.signal instanceof AbortSignal`.)
  - Case D "Content-Length >1MB → verbatim + reader never called": STUB via a makeRes whose body.getReader is a spy (readerCalls=[]); contentLength:'1500000'; assert r verbatim AND readerCalls.length===0.
  - Case E "mid-stream >1MB → verbatim": makeRes with content-length ABSENT and a body reader that yields ONE chunk of 1_100_000 bytes then {done:true}; assert verbatim. (readBodyCapped returns null at the first read.)
  - Case F "over-budget → verbatim, NO paging": CTX=LOW_BUDGET_CTX (remaining≈10); PROMPT uses S1's RICH_HTML so markdown ≥200 (passes SPA) and cost≈256≫10; assert r verbatim AND `!r.blocks.some(b=>b.includes("<paged:"))` AND no notify (ctx has no hasUI here).
  - Case G "SPA <200 chars → verbatim + notify": const {ctx,notes}=ctxWithNotifySpy(); STUB=makeRes({ct:'text/html', body:'<html><body><p>short</p></body></html>'}); assert r verbatim AND notes contains the SPA message (`notes.some(n=>n.m.includes("page appears JS-rendered; left as reference"))`) AND notify type 'info'.
  - Case H "enableUrls:false → ZERO fetch": STUB is a spy (calls tracked); call mod.injectFiles(prompt,[],FIX,false,false) (5th param false); assert calls.length===0 AND r.text===prompt AND r.injected===0.
  - Case I "PDF content-type → verbatim": STUB=makeRes({ct:'application/pdf', body:'%PDF-1.4 fake'}); assert verbatim. (Same else-branch covers application/octet-stream — note in a comment.)

Task 4: REFRESH the pass/fail matrix total
  - FIND S1's `matrixRows`/total-count print (S1 owns it). If S1 prints a row count, the added cases
    simply extend it — no edit usually needed. If a literal total is hardcoded, bump it to include
    S2's cases. Prefer letting runCase auto-number; verify the final line prints "all green".

Task 5: SELF-RUN + iterate
  - `node ./url-injection.test.mjs` → fix until exit 0.
  - `npm test` → all 4 files green.
```

### Implementation Patterns & Key Details

```javascript
// ── Per-case skeleton (LOAD-BEARING — restore fetch in finally for EVERY case) ──
await runCase(<id>, "<label>", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url, init) => { calls.push(String(url)); return <STUB>; };
    const r = await mod.injectFiles("Read #example.com", [], <CTX>);
    assert(r.text === "Read #example.com", `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
  } finally {
    globalThis.fetch = origFetch;   // NEVER omit — a leaked stub breaks the next case
  }
});

// ── Content-Length>1MB: reader spy (proves pre-download guard skipped the body) ──
const readerCalls = [];
const r = await mod.injectFiles("Read #example.com", [], FIX, false, true);
// ... with fetch stubbed to makeRes whose body.getReader pushes to readerCalls ...
assert(readerCalls.length === 0, "getReader must not be called when Content-Length exceeds cap");

// ── Mid-stream overflow: ABSENT content-length + >1MB body ──
// makeRes({ ct:'text/html', body:{ getReader(){ let i=0; return { read(){ return i++===0 ? {value:new Uint8Array(1_100_000)} : {done:true}; } }; } } })
// (no content-length header ⇒ len=0 ⇒ pre-check `len && len>cap` is false ⇒ falls into readBodyCapped ⇒ null)

// ── Over-budget: derived low remaining + RICH_HTML (≥200 ⇒ not SPA; cost≫10 ⇒ over-budget) ──
const r = await mod.injectFiles("Read #example.com", [], LOW_BUDGET_CTX, false, true);
assert(r.injected === 0, "over-budget URL must be verbatim");
assert(!r.blocks.some((b) => b.includes("<paged:")), "URLs never page (read tool can't fetch)");

// ── SPA: notify spy ──
const { ctx, notes } = ctxWithNotifySpy();
// ... fetch stub returns minimal HTML (<p>short</p>) ...
assert(notes.some((n) => n.m.includes("page appears JS-rendered; left as reference")), "SPA notify must fire");
assert(notes.some((n) => n.t === "info"), "SPA notify type must be 'info'");

// ── enableUrls:false: ZERO egress (install a spy to PROVE zero, not just "no call") ──
const r = await mod.injectFiles("Read #example.com", [], FIX, false, false);  // 5th param = enableUrls=false
assert(calls.length === 0, "enableUrls:false must make ZERO fetch calls (air-gapped opt-out)");
```

### Integration Points

```yaml
TEST FILE: url-injection.test.mjs   # EXTEND ONLY — append cases; reuse S1's harness; do NOT edit S1's cases
PACKAGE.JSON: no change             # S1 already appended "&& node ./url-injection.test.mjs"
SOURCE CODE: no change              # injectUrl is PRIVATE; S2 only OBSERVES its behavior
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)
```bash
# Node parses the file as ESM; a syntax error fails fast.
node --check ./url-injection.test.mjs          # parse-check only (no execution)
# Expected: no output, exit 0. If it errors, READ the line and fix.
```

### Level 2: Unit Tests (the deliverable)
```bash
# The new file standalone — must be GREEN with all S1 + S2 cases.
node ./url-injection.test.mjs
# Expected: a pass/fail matrix, all rows PASS, exit 0.

# Full suite (4 files) — S2 must not regress S1 or any prior file.
npm test
# Expected: all 4 files exit 0.
```

### Level 3: Integration / Contract Sanity (targeted re-runs)
```bash
# Re-run in isolation to prove no cross-case fetch-stub leak (the #1 S2 risk).
node ./url-injection.test.mjs && echo "ISOLATION OK"

# If a case is flaky/failing, isolate ONE case by temporarily commenting the others,
# then `node ./url-injection.test.mjs` — confirm the stub+restore cycle is symmetric.

# Confirm the enableUrls:false case truly proves zero egress: if you change its 5th
# param to `true` the case should now record calls.length>=1 (invert-and-watch test).
```

### Level 4: Domain-Specific (none — hermetic by design)
No network, no model, no Pi process, no DB. Every `fetch` is a `globalThis.fetch` stub. This is a
model-free structural gate; Level 2 IS the full validation.

## Final Validation Checklist

### Technical Validation
- [ ] `node --check ./url-injection.test.mjs` passes
- [ ] `node ./url-injection.test.mjs` exits 0 (all S1 + S2 cases green)
- [ ] `npm test` exits 0 (4 files)
- [ ] No fetch-stub leak: `globalThis.fetch === origFetch` after every case (the `finally` blocks)

### Feature Validation
- [ ] All 9 failure/guard cases present and passing (non-2xx, throw, timeout, CL>1MB, mid-stream,
      over-budget, SPA, enableUrls:false, PDF)
- [ ] Every failure case asserts `r.text === prompt` (byte-for-byte verbatim — plan 009 contract)
- [ ] Every failure case asserts `r.injected === 0` and no block appended
- [ ] Content-Length>1MB case asserts body reader NEVER called
- [ ] Mid-stream case uses ABSENT content-length + >1MB body (isolates guard 2b from 2a)
- [ ] Over-budget case asserts NO `<paged:` block (URLs never page) AND markdown ≥200 (not SPA)
- [ ] SPA case asserts `ctx.ui.notify` called with the exact SPA message + type 'info'
- [ ] enableUrls:false case asserts a fetch spy recorded 0 invocations

### Code Quality
- [ ] Reuses S1's harness (makeRes/FIX/runCase/assert/RICH_HTML) — does NOT re-declare
- [ ] `origFetch` saved once; restored in `finally` per case
- [ ] Comments explain the two non-obvious gotchas (private URL_TIMEOUT_MS; derived `remaining`)
- [ ] No overlap with S1's DETECTION/DISPATCH/COLLISION/SCHEME-LESS groups

### Documentation
- [ ] Mode A: no README/PRD changes (test file is self-documenting)

## Anti-Patterns to Avoid

- ❌ Don't redeclare S1's harness (makeRes/FIX/runCase/assert/RICH_HTML) — S2 EXTENDS, not duplicates.
- ❌ Don't omit the `finally { globalThis.fetch = origFetch; }` — a leaked stub corrupts the next case.
- ❌ Don't try to "set `state.remaining`" — it's not settable; derive it via getContextUsage+contextWindow.
- ❌ Don't make the over-budget markdown <200 chars — SPA fires first (ordering gotcha).
- ❌ Don't give the mid-stream case a Content-Length header — that hits the pre-download guard, not 2b.
- ❌ Don't assert the real 20s timeout — URL_TIMEOUT_MS is private; simulate via AbortError rejection.
- ❌ Don't catch/suppress inside the case body such that a thrown injectUrl hides — injectUrl must never
  throw; if it does, let runCase fail loudly so it's visible.
- ❌ Don't write a "fetch not installed, so zero calls" enableUrls:false test — install a spy and assert
  its counter, otherwise you've proven nothing (the absence of a stub ≠ absence of calls).

## Confidence Score: 9/10
One-pass success is very high: the code under test is committed and line-precise, the harness is
fully defined by S1, and every stub value is specified (incl. the derived `remaining` numbers and the
private-const workaround for timeout). The only residual risk is a borderline SPA fixture (defuddle
yielding ≥200 from a thin page) — mitigated by specifying a deliberately minimal `<p>short</p>` HTML and
asserting on the notify behavior rather than a fragile char count.