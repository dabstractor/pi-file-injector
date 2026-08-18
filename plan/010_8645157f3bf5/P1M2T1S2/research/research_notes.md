# Research Notes — P1.M2.T1.S2 (URL failure / guard tests)

## Dependency: P1.M2.T1.S1 (in parallel; "Ready" → implemented first)
S1 CREATES `url-injection.test.mjs` at repo root + appends it as the 4th entry in
`package.json` scripts.test. S2 EXTENDS that same file. S2 MUST NOT re-declare S1's
harness pieces — it reuses them:

- jiti loader (dynamic-import `PIPKG+"/node_modules/jiti/lib/jiti.mjs"`; alias map for `@earendil-works/*` only; `jiti.import(TS_PATH)` → `mod`).
- `assert(cond, msg)`, `runCase(id, desc, fn)`, the pass/fail `matrixRows` harness.
- `FIX = { cwd: TMPDIR }` (cwd-only ctx — NO getContextUsage ⇒ remaining=null ⇒ no budget gate; NO hasUI ⇒ no notify).
- `makeRes({ ok, status, ct, contentLength, body })` factory → Response-shaped plain object.
- `RICH_HTML` fixture (rich `<article>` ⇒ defuddle markdown ≥200 chars — S2 REUSES it for the over-budget case).
- The per-case fetch-stub pattern: `const calls=[]; try{ globalThis.fetch=async(u)=>{calls.push(String(u));return makeRes(...)}; const r=await mod.injectFiles(...); ... } finally{ globalThis.fetch=origFetch; }`.

Public API to drive (injectUrl / readBodyCapped / readBytesCapped / URL_*_RE are PRIVATE):
`mod.injectFiles(text, imagesIn, ctx, bareAt=false, enableUrls=true)` → `{text, images, injected, paged, blocks, details}`.

## The code under test (file-injector.ts — verified, committed)

### Constants (private, module-level — NOT exported)
- `URL_TIMEOUT_MS = 20_000` (L81) — AbortController timeout. **NOT injectable** (private const).
- `URL_MAX_BYTES = 1_000_000` (L83) — 1 MB cap (Content-Length pre-check + mid-stream abort).
- `URL_MIN_CONTENT = 200` (L85) — SPA floor.
- `MARGIN = 8192`, `DEFAULT_RESERVE = 8192` (paged-budget consts) — feed the `remaining` formula.

### injectUrl(url, state, ctx) → boolean (L830-916) — the verbatim/failure surface
```
const ctrl = new AbortController();
const to = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS);     // guard 1
try {
  const res = await fetch(url, { signal: ctrl.signal, redirect:"follow", headers:{User-Agent} });
  if (!res.ok) return false;                                    // §3.5 non-2xx → verbatim
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > URL_MAX_BYTES) return false;                 // guard 2a — too big, don't download (READER NEVER CALLED)
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("image/")) { ... readBytesCapped ... }       // image path (not S2 scope)
  const html = await readBodyCapped(res, URL_MAX_BYTES);        // STRING reader (html/json/xml/text)
  if (html === null) return false;                              // guard 2b — mid-stream overflow → verbatim
  if (ct.startsWith("text/html") || /^\s*</.test(html)) {
    const r = await Defuddle(doc, url, {markdown:true});
    const md = (r.content ?? "").trim();
    if (md.length < URL_MIN_CONTENT) {                          // §3.4 SPA — runs BEFORE over-budget
      if (ctx.hasUI) ctx.ui?.notify(`${url}: page appears JS-rendered; left as reference`, "info");
      return false;                                             // verbatim + notify
    }
    body = (r.title ? `# ${r.title}\n\n` : "") + md;
  } else if (ct.startsWith("text/")||ct.includes("json")||ct.includes("xml")||ct.includes("markdown")) {
    body = html;                                                // raw text
  } else {
    return false;                                               // §3.5 unhandled ct (PDF/octet) → verbatim
  }
  const cost = Math.ceil(body.length / 4);
  if (state.remaining !== null && cost > state.remaining) return false;  // guard 3 — over-budget, NO paging
  ... push block/detail, subtract, count++ ...; return true;
} catch { return false; }                                       // §3.5 timeout/network/throw → verbatim (NEVER throws out)
finally { clearTimeout(to); }
```
**KEY:** `injectUrl` NEVER throws and NEVER appends a block on any failure path — it only `return false`. The
verbatim guarantee is structural: a failed token keeps `#<url>` in the prompt, and (when no other token
succeeds) `injectFiles` returns the ORIGINAL `text` ref + empty `blocks` (L1420-ish early return on
`count===0`).

### enableUrls gate (injectFiles L1404) — the zero-egress proof
```
if (enableUrls) {                       // default true (param); handler passes cfg.enableUrls !== false
  for (const m of text.matchAll(URL_INJECT_RE)) { ... await injectUrl(abs, state, ctx); }
}
```
`enableUrls===false` ⇒ the loop body is SKIPPED ⇒ `fetch` is never reached. S2 proves this by installing a
fetch spy and asserting `calls.length === 0`.

### `remaining` budget is DERIVED, not settable (L1338-1347) — load-bearing for the over-budget test
```
const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;   // 8192
remaining = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);  // MARGIN=8192
```
`getContextUsage()` returns `{ tokens, contextWindow, ... }` (or undefined / tokens:null ⇒ remaining=null).
To force a LOW remaining (≈10): no `model` (so reserve=8192) + `getContextUsage: () => ({ tokens: 0, contextWindow: 16394 })`
⇒ remaining = 16394 − 0 − 8192 − 8192 = **10**. The contract's "return a very low remaining (e.g. 10)" is
LOOSE — the implementer must set contextWindow/tokens to hit the derived value.

### Ordering gotcha (over-budget vs SPA)
The SPA check (`md.length < 200`) executes BEFORE the over-budget check (`cost > remaining`). So the
over-budget markdown body MUST be **≥200 chars** (else SPA fires first). `RICH_HTML` (S1 fixture, 1024-char
markdown ⇒ cost 256 ≫ 10) is perfect: passes SPA, then over-budget → verbatim, no notify.

## Per-case stub design (S2)

| Case | Stub | Verbatim proof |
|---|---|---|
| Non-2xx | `makeRes({ok:false, status:404})` | `!res.ok` → false |
| DNS/throw | fetch rejects with generic Error | catch → false |
| Timeout | fetch rejects with AbortError-like (`{name:'AbortError'}`) — can't exercise real 20s (private const); simulate. Optionally capture `init.signal` ⇒ assert an AbortSignal passed | catch → false |
| CL>1MB | headers content-length '1500000' (>1_000_000); make `body.getReader` a spy that records calls | len>cap → false BEFORE reader; assert reader spy count === 0 |
| Mid-stream>1MB | content-length ABSENT (len=0 ⇒ pre-check false); body reader yields chunks totaling >1MB (e.g. one 1.1MB Uint8Array, or several) | readBodyCapped returns null → false |
| Over-budget | `ctx.getContextUsage ⇒ {tokens:0,contextWindow:16394}` (no model ⇒ remaining=10); reuse RICH_HTML (≥200 ⇒ not SPA; cost 256>10) | cost>remaining → false; assert NO `<paged:` in blocks |
| SPA <200 | minimal HTML (`<p>short</p>` — defuddle ≪200); `ctx` has `hasUI:true` + `ui.notify` spy | md<200 → false + notify; assert spy called w/ SPA msg |
| enableUrls:false | install fetch spy anyway; `injectFiles(prompt,[],ctx,false,false)` | assert `calls.length===0` + r.text===prompt + injected===0 |
| PDF/octet | content-type 'application/pdf'; small body (`%PDF-1.4…`); CL absent | else-branch → false |

**Universal invariants for every failure case:** `r.text === prompt` (byte-for-byte), `r.injected === 0`
(unless mixed w/ a success token), no block appended, and `globalThis.fetch` restored in `finally`.

## Verbatim-prompt contract (plan 009)
Confirmed in code: markers are NEVER stripped; failed tokens keep `#<url>`; when count stays 0 the
early-return hands back the ORIGINAL `text` ref. So `r.text === prompt` is the exact original event.text
for every failure case. URLs never page (read tool can't fetch a URL) ⇒ assert no `<paged:...>` block.