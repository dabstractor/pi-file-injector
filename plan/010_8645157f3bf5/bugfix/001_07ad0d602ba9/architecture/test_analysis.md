# Test Suite Analysis — file-injector / url-injector extension

This document captures the EXACT test harness patterns, conventions, and structures that downstream
implementation/PRP agents MUST follow when adding or modifying tests for BUG-001 (URL_SHAPE_RE
false-positive on `#filename.ext`) and BUG-002 (notify wording for URL-only injections).

---

## 1. Repository Test Layout

| File | Lines | Test fn | Cases | Convention |
|---|---|---|---|---|
| `file-injector.test.mjs` | 3008 | `runCase(n, name, fn)` | 162 | Standalone ESM, no framework, `runCase` + `integrationCase` |
| `url-injection.test.mjs` | 714 | `runCase(n, name, fn)` | 21 | Standalone ESM, hermetic zero-network |
| `relative-imports.test.mjs` | 517 | `test(name, fn)` | 38 | Standalone ESM, same jiti loader |
| `import-behavior.test.mjs` | 278 | `test(name, fn)` | 21 | Standalone ESM repro harness |

**Total: 242 automated cases** (matches PRD's "159 + 23 + 38 + 21" within rounding — some
`integrationCase` rows in file-injector.test.mjs are manual-only and do not affect the exit code).

**No test framework is configured.** Each `.mjs` file is a standalone Node ESM script run directly
with `node ./<file>.test.mjs`. Each exits `0` on full pass, `1` on any failure. The `package.json`
`test` script chains all four:

```json
"test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs"
```

---

## 2. The Jiti Loader (LOAD-BEARING — identical in ALL test files)

The project's `peerDependencies` (`@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui`) are
**NOT resolvable** from the project cwd. They are installed GLOBALLY. The test harness resolves the
global package root, loads jiti (nested inside pi), and creates an alias map mirroring Pi's own
extension loader. This is THE mechanism for loading the real `file-injector.ts`. **Downstream agents
must copy this verbatim.**

```js
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

// 1. Resolve the GLOBAL pi package root
function resolvePiPackageRoot() {
  let npmRoot;
  try {
    npmRoot = execSync("npm root -g").toString().trim();
  } catch (e) {
    throw new Error(`Could not run 'npm root -g' to locate the global pi package: ${e.message}`);
  }
  const PIPKG = npmRoot + "/@earendil-works/pi-coding-agent";
  if (!fsSync.existsSync(PIPKG + "/dist/index.js")) {
    throw new Error(`Global pi package not found at ${PIPKG}/dist/index.js.`);
  }
  return PIPKG;
}
const PIPKG = resolvePiPackageRoot();

// 2. Load jiti (nested inside pi) and create the alias map
const jitiLib = PIPKG + "/node_modules/jiti/lib/jiti.mjs";
const { createJiti } = await import(jitiLib);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});

// 3. Import the REAL committed extension (resolve relative to THIS script → cwd-independent)
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TS_PATH = path.resolve(SCRIPT_DIR, "file-injector.ts");
const mod = await jiti.import(TS_PATH);
```

**Sanity check** (proves the real module was loaded, not a stub):
```js
assert(typeof mod.injectFiles === "function", "mod.injectFiles must be a function");
assert(typeof mod.cleanToken === "function", "mod.cleanToken must be a function");
```

---

## 3. Assertion Harness (the project's zero-deps convention)

Two near-identical helper styles exist. Both throw-on-fail, caught by the runner.

### Style A: `runCase(n, name, fn)` — used by file-injector.test.mjs AND url-injection.test.mjs

```js
let passed = 0, failed = 0;
const matrixRows = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runCase(n, name, fn) {
  try {
    await fn();
    passed++;
    matrixRows.push({ n, name, status: "PASS" });
    console.log(`  ✓ case ${n}: ${name}`);
  } catch (e) {
    failed++;
    matrixRows.push({ n, name, status: "FAIL", detail: e.message });
    console.log(`  ✗ case ${n}: ${name}\n      → ${e.message}`);
  }
}
```

### Style B: `test(name, fn)` — used by relative-imports.test.mjs AND import-behavior.test.mjs

```js
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      → ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
```

### Exit pattern (every file)
```js
console.log(`Result: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
```

---

## 4. `injectFiles` — the primary test entry point

```ts
export async function injectFiles(
  text: string,
  images: ImageContent[],
  ctx: Ctx,
  bareAt = false,      // §4.6 markdown bare-@ enabled (default false for direct unit tests)
  enableUrls = true,   // §4 URL injection enabled (default true; input handler passes cfg.enableUrls !== false)
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number;
             blocks: string[]; details: FileDetail[] }>
```

### Minimal ctx fixture (used by url-injection.test.mjs):
```js
const FIX = { cwd: TMPDIR };  // TMPDIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "ui-"))
```

### Block-text helpers (read across the joined blocks):
```js
function hasBlock(r, needle) {
  return r.blocks.some((b) => b.includes(needle));
}
```

### Typical URL test call:
```js
const r = await mod.injectFiles("#example.com", [], FIX, false, true);
// r.injected === 1, r.text === "#example.com" (verbatim), r.blocks has <file name="https://example.com">
// r.details[0].kind === "url"
```

---

## 5. Fetch Stubbing Pattern (CRITICAL for BUG-001 test work)

`globalThis.fetch` is stubbed **per test** inside a `try/finally` that ALWAYS restores the original.
The original is captured ONCE at module top-level:

```js
const origFetch = globalThis.fetch;
```

### Response factory (`makeRes`):
```js
function makeRes({ ct = "text/html", body = "", status = 200, ok = true, contentLength } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return {
    ok,
    status,
    headers: {
      get: (k) => {
        const lk = k.toLowerCase();
        if (lk === "content-type") return ct;
        if (lk === "content-length") return contentLength != null ? String(contentLength) : null;
        return null;
      },
    },
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: buf };  // one chunk; Buffer IS a Uint8Array
          },
        };
      },
    },
    text: async () => buf.toString("utf8"),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}
```

### Per-test fetch stub with call tracking (THE pattern for BUG-001 no-fetch assertions):
```js
await runCase("BUG-NEW-1", "name", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles("edit #main.go", [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for #filename.ext; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; got ${r.injected}`);
  } finally {
    globalThis.fetch = origFetch;  // ALWAYS restore — a leaked stub poisons later cases
  }
});
```

### The RICH_HTML fixture (for content-injection tests that must pass the 200-char SPA floor):
A multi-paragraph HTML document (~3 KB) is defined as the `RICH_HTML` const. **Do NOT simplify it** —
a trivial `<p>hi</p>` extracts <200 chars via defuddle, causing the SPA fallback branch to fire
instead of the injection branch. The fixture must stay rich.

### IMG_BYTES fixture (binary byte-preservation proof):
```js
const IMG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,  // PNG signature
  0xff, 0xfe, 0x00, 0x80,  // high/non-ASCII bytes
]);
```

---

## 6. The COL-4 Test — the `#node.js` False-Positive Case (the ONLY shape-gate collision asserted)

This is the test that BUG-001 directly concerns. It currently ASSERTS that `#node.js` IS url-shaped
and DOES fire a fetch (returning 404 → verbatim). **After BUG-001 is fixed, this test may need
revision depending on the chosen approach** (if the fix tightens the gate so `#node.js` no longer
fires, this test must be updated; if the fix only blocks known code-extensions, `#node.js` still
fires).

```js
await runCase("COL-4", "collision: #node.js URL-shaped → 404 → verbatim (fetch CALLED, no block)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles("#node.js", [], FIX, false, true);
    assert(calls.length === 1, `#node.js IS url-shaped → fetch must be called; calls=${calls.length}`);
    assert(r.injected === 0, `404 → verbatim, no block; got injected===${r.injected}`);
    assert(!hasBlock(r, '<file name="https://node.js">'), "no block appended on 404");
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

### The COL-2 test — prose tokens that must NEVER fetch (the no-shape case):
```js
// #Heading #1234 #fff #v1.2 #3.14 → all FAIL the shape gate (numeric/short final labels)
await runCase("COL-2", "collision: #Heading #1234 #fff #v1.2 #3.14 → prose, NO fetch", async () => {
  const calls = [];
  const prompt = "# Heading and #1234 #fff #v1.2 #3.14";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `no URL-shaped token → ZERO fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; got ${r.injected}`);
  } finally { globalThis.fetch = origFetch; }
});
```

### Full url-injection.test.mjs case list:
- **DETECTION**: DET-1 (`#example.com` → HTML inject), DET-2 (`#https://x.com/y` → inject verbatim)
- **DISPATCH**: DIS-1 (text/plain raw), DIS-2 (application/json raw), DIS-3 (text/xml raw), DIS-4 (image/png bytes)
- **COLLISION**: COL-1 (`#@file.txt` no fetch), COL-2 (prose no fetch), COL-3 (mid-word no fetch),
  COL-4 (`#node.js` fetch→404), COL-5 (file+url shared budget)
- **NORMALIZATION**: NORM-1 (dedup scheme-less + qualified)
- **FAILURE/GUARD**: FAIL-1 (404 verbatim), FAIL-2 (DNS reject), FAIL-3 (timeout AbortError sim),
  FAIL-4 (Content-Length>1MB no body read), FAIL-5 (mid-stream overflow), FAIL-6 (over-budget no paging),
  FAIL-7 (SPA<200 notify), FAIL-8 (enableUrls===false zero fetch), FAIL-9 (application/pdf verbatim)

---

## 7. Handler Registration + Notify Collection (CRITICAL for BUG-002 test work)

### The `mod.default(pi)` factory pattern:
The extension's default export registers event handlers via `pi.on(event, cb)`. Tests capture these
handlers by providing a mock `pi` object:

```js
function captureHandler(event = "input") {
  const cbs = [];
  const pi = {
    on: (ev, cb) => { if (ev === event) cbs.push(cb); },
    registerMessageRenderer: () => {},
  };
  mod.default(pi);  // registers handlers
  return { cb: cbs[cbs.length - 1], all: cbs };  // .cb = LAST handler; .all = every handler for `event`
}

// Capture ALL events from ONE factory call (needed for input→before_agent_start stash flow)
function captureAllHandlers() {
  const handlers = {};
  const pi = {
    on: (ev, cb) => { (handlers[ev] ??= []).push(cb); },
    registerMessageRenderer: () => {},
  };
  mod.default(pi);
  return handlers;  // { input:[fn], session_start:[cfgFn,acFn], before_agent_start:[fn] }
}
```

### Mock ctx with notify spy (THE pattern for BUG-002 notify assertions):
```js
function makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, isProjectTrusted, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,  // rec.notify === { m: "message", t: "info" } after a notify fires
  };
}
```

### Driving the handler and asserting notify (from file-injector.test.mjs Case 9):
```js
const { ctx, rec } = makeMockCtx(TMPDIR);
const slot = captureHandler();
const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
assert(out.action === "transform", `handler must return transform, got '${out.action}'`);
assert(rec.notify && rec.notify.m === "#@ injected 2 whole", `notify msg, got ${JSON.stringify(rec.notify?.m)}`);
assert(rec.notify.t === "info", `notify type must be 'info'`);
```

### Driving with notify SPY array (from url-injection.test.mjs FAIL-7):
```js
function ctxWithNotifySpy() {
  const notes = [];
  return {
    ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } },
    notes,  // notes.push({m, t}) — collects MULTIPLE notify calls
  };
}
```

### Notify-guards assertions (must NOT fire):
```js
assert(rec.notify === undefined, "notify must NOT fire when nothing is injected");
assert(rec.notify === undefined, "notify must NEVER fire when ctx.hasUI===false (headless)");
```

---

## 8. The Notify Bug (BUG-002) — exact source location

**file-injector.ts:1494:**
```ts
const whole = injected - paged;
const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
if (ctx.hasUI) ctx.ui.notify(msg, "info");
```

The `msg` is hardcoded with the `#@` prefix regardless of whether the injection came from `#@file`
or `#<url>`. For URL-only prompts, this is misleading. The `injectFiles` return shape has
`details[].kind` (`"url"`, `"text"`, `"image"`) which can be used to make the notify trigger-aware.

---

## 9. The URL_SHAPE_RE Gate (BUG-001) — exact source location

**file-injector.ts:36:**
```ts
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

The dotted-host alternative `(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}` matches ANY
`<word>.<2+alpha>` token, so `#main.go`, `#notes.md`, `#config.json`, `#image.png` all pass the gate
and trigger fetches.

**file-injector.ts:1395-1402** — the URL scan loop:
```ts
if (enableUrls) {
  for (const m of text.matchAll(URL_INJECT_RE)) {
    const tok = cleanToken(m[2]);
    if (tok && URL_SHAPE_RE.test(tok)) {
      const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
      if (!state.injectedSet.has(abs)) {
        state.injectedSet.add(abs);
        await injectUrl(abs, state, ctx);
      }
    }
  }
}
```

**file-injector.ts:26** — the candidate regex:
```ts
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;
```

**file-injector.ts:1322** — `enableUrls` default:
```ts
enableUrls = true,  // Default true so direct unit tests get the branch
```

**file-injector.ts:1483** — input handler passes `cfg.enableUrls !== false` (default-enabled).

---

## 10. Key Test Conventions Downstream Agents MUST Follow

1. **Zero-dependency ESM** — no `import` of any test framework. Only Node builtins + jiti (nested
   in pi).
2. **`try/finally` fetch restore** — EVERY fetch stub must restore `globalThis.fetch = origFetch`
   in a `finally` block. A leaked stub poisons later cases and can hit the real network.
3. **Per-case independence** — each case gets its own `calls = []` array and own stub. No shared
   mutable state between cases (except the module-level fixtures built once before cases run).
4. **`calls.length === 0` for no-egress assertions** — always use a SPY (not reliance on absence of
   stub) to prove zero fetch. "The absence of a stub proves nothing" (FAIL-8 comment).
5. **`r.text === prompt` byte-for-byte** — the prompt is ALWAYS returned verbatim (markers never
   stripped). This is the strongest assertion for "nothing happened" cases.
6. **`r.injected === 0` + `r.blocks.length === 0`** — the standard "no injection occurred" pair.
7. **Block-content checks via `hasBlock(r, needle)`** — reads across `r.blocks` array, not `r.text`.
8. **`r.details[].kind`** — `"text"` for file text, `"image"` for image, `"url"` for URL injection.
   Use this to distinguish injection source (relevant for BUG-002 trigger-aware notify).
9. **`FIX = { cwd: TMPDIR }`** is the minimal ctx for URL tests. For handler/notify tests, use
   `makeMockCtx` or `ctxWithNotifySpy`.
10. **Cleanup** — temp dirs are removed with `fsSync.rmSync(TMPDIR, { recursive: true, force: true })`
    at the end, best-effort (`try/catch {}`).

---

## 11. Test Gaps Relevant to BUG-001 / BUG-002

### BUG-001 gaps in url-injection.test.mjs:
- **No `#filename.ext` no-fetch test** — COL-2 asserts `#fff`, `#v1.2`, `#3.14` (numeric/hex labels
  that FAIL the alpha-TLD gate), but NOTHING asserts `#main.go`, `#notes.md`, `#config.json`, etc.
  (code-file extensions that PASS the alpha-TLD gate). This is exactly why BUG-001 was not caught.
- **COL-4 is the ONLY shape-gate collision** that asserts a fetch IS called. If the BUG-001 fix
  changes the gate so `#node.js` no longer fires, COL-4 must be updated.
- **All fetch stubs return 404 or fail** — no test proves a SUCCESSFUL fetch for a false-positive
  domain injects content (the "main.go delivers the Go homepage" harm). A new test with a 200-OK
  stub + content-injection assertion would close this gap.

### BUG-002 gaps in file-injector.test.mjs:
- **No URL-only notify test** — all notify assertions (Case 9, F4) use `#@file` prompts and assert
  `"#@ injected N whole"`. No test drives a URL-only prompt through the handler and checks the
  notify wording. A new case stubbing `fetch` + collecting `notify` for a `#example.com`-only prompt
  would surface BUG-002.
- **Handler tests don't stub fetch** — `captureHandler` + `makeMockCtx` are used for `#@file` cases
  where no fetch occurs. BUG-002 testing requires a fetch stub in the handler-level test (the url
  test file's `ctxWithNotifySpy` + `makeRes` pattern is the template).

---

## 12. Typecheck

```
npm run typecheck   # node ./scripts/typecheck.mjs — must be clean
```

The project has no `tsc` in devDependencies; typecheck uses a custom `scripts/typecheck.mjs` script.