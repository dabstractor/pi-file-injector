// url-injection.test.mjs — Hermetic, zero-network acceptance harness for the `#<url>` web-content
// injection feature (PRD §2–§7; P1.M2.T1.S1).
//
// WHAT THIS IS
//   A standalone, zero-dependency Node ESM script (the project's "standalone .mjs gate" convention —
//   no test framework is configured in this repo). It imports the REAL committed `./file-injector.ts`
//   through the SAME jiti+alias harness as `file-injector.test.mjs`, stubs `globalThis.fetch` PER TEST
//   with a Response-shaped object, and asserts on the `injectFiles(prompt, [], FIX, false, true)`
//   return shape. Every assertion runs OFFLINE — no HTTP ever leaves the process — and a per-case
//   `calls` tracker proves the no-network invariant (spec §4 zero-egress proof at the detection layer).
//
// WHY IT EXISTS
//   P1.M1.T2.S1 (pipeline) + T2.S3 (scan loop) shipped typechecked, spec-faithful code but proved NO
//   behavior. This suite proves the `#<url>` DETECTION regex, the Content-Type DISPATCH (image /
//   text-html / raw-text), and the §2.3 COLLISION rules actually fire — catching any regression in
//   detection/dispatch/collision without a network or a live model. It is the URL twin of
//   `file-injector.test.mjs` (same harness, different domain).
//
// RUN
//   node ./url-injection.test.mjs      # from the repo root; exits 0 on success, 1 on any failure.

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

// ──────────────────────────────────────────────────────────────────────────────
// 1. Resolve the GLOBAL pi package root (it is NOT resolvable from the project cwd).
//    Verified: `npm root -g` → the dir containing `@earendil-works/pi-coding-agent`.
//    (IDENTICAL to file-injector.test.mjs L1–200.)
// ──────────────────────────────────────────────────────────────────────────────
function resolvePiPackageRoot() {
  let npmRoot;
  try {
    npmRoot = execSync("npm root -g").toString().trim();
  } catch (e) {
    throw new Error(`Could not run 'npm root -g' to locate the global pi package: ${e.message}`);
  }
  const PIPKG = npmRoot + "/@earendil-works/pi-coding-agent";
  if (!fsSync.existsSync(PIPKG + "/dist/index.js")) {
    throw new Error(
      `Global pi package not found at ${PIPKG}/dist/index.js. ` +
        `Ensure @earendil-works/pi-coding-agent is installed globally.`,
    );
  }
  return PIPKG;
}

const PIPKG = resolvePiPackageRoot();

// ──────────────────────────────────────────────────────────────────────────────
// 2. Load jiti (nested inside pi) by ABSOLUTE dynamic import, then give it the alias map
//    Pi's own extension loader uses. Bare `import { createJiti } from "jiti"` FAILS here — jiti is
//    nested and not resolvable from arbitrary dirs. This is THE load-bearing mechanism (verified).
//    defuddle/linkedom are NOT aliased → they resolve from repo-root node_modules (installed by S1).
//    (IDENTICAL to file-injector.test.mjs.)
// ──────────────────────────────────────────────────────────────────────────────
const jitiLib = PIPKG + "/node_modules/jiti/lib/jiti.mjs";
const { createJiti } = await import(jitiLib);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Import the REAL committed extension (resolve relative to THIS script → cwd-independent).
//    file-injector.ts is READ-ONLY for this item — we never edit it; injectUrl and the URL_*
//    regexes are PRIVATE and exercised ONLY via injectFiles(prompt, [], FIX, false, enableUrls).
// ──────────────────────────────────────────────────────────────────────────────
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TS_PATH = path.resolve(SCRIPT_DIR, "file-injector.ts");
const mod = await jiti.import(TS_PATH);

// ──────────────────────────────────────────────────────────────────────────────
// 4. Tiny assertion harness (the project has no test runner; bare helper matches the zero-deps ethos).
//    (IDENTICAL to file-injector.test.mjs.)
// ──────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const matrixRows = []; // {n, name, status, detail} — status: PASS | FAIL

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Run one hermetic assertion block. The block throws on failure (caught here). Prints ✓/✗ + the
 * case id + name, and records a matrix row. `n` is the case id (DET-1..DET-2, DIS-1..DIS-4,
 * COL-1..COL-5, NORM-1); `name` is the short label. Each runCase is INDEPENDENT (own try/finally
 * fetch restore — a leaked stub would poison later cases).
 */
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

// ──────────────────────────────────────────────────────────────────────────────
// 5. Sanity: prove we loaded the REAL shipped file (not a stub / stale copy). The URL feature is
//    driven entirely through injectFiles; we assert the two exports this suite actually consumes.
// ──────────────────────────────────────────────────────────────────────────────
assert(typeof mod.injectFiles === "function", "mod.injectFiles must be a function (the URL scan-loop entry point)");
assert(typeof mod.cleanToken === "function", "mod.cleanToken must be a function (PRD §4.3 trailing-punct trim)");

// ──────────────────────────────────────────────────────────────────────────────
// 6. Fixture: a temp cwd (shared with any #@file collision case so the local file resolves).
//    (Mirrors file-injector.test.mjs FIX = { cwd: TMPDIR }. URL tests have no model + no trust gate.)
// ──────────────────────────────────────────────────────────────────────────────
const TMPDIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "ui-"));
const FIX = { cwd: TMPDIR };

// block-text helper — the <file> blocks live in r.blocks (string[]). Reads across the joined block
// text so content checks (block openers, raw bodies) work regardless of which block carries them.
function hasBlock(r, needle) {
  return r.blocks.some((b) => b.includes(needle));
}

// The original globalThis.fetch — restored in EVERY case's `finally` so a leaked stub can never
// poison the next case (and can never hit the real network).
const origFetch = globalThis.fetch;

// ──────────────────────────────────────────────────────────────────────────────
// 7. Mock layer — Response-shaped factory + fixtures + per-case fetch stub.
//
// makeRes returns a PLAIN OBJECT shaped exactly like what injectUrl's readers consume:
//   • readBytesCapped / readBodyCapped call res.body?.getReader() then loop reader.read() →
//     {done:false,value:Uint8Array} then {done:true,value:undefined}. A Buffer IS a Uint8Array
//     (Buffer.from(value) copies it cleanly in both readers), so we hand back `buf` directly.
//   • res.text() is the readers' no-reader fallback (not used when getReader exists, but provided
//     for completeness / robustness).
//   • res.headers.get("content-type") / ("content-length") drive the dispatch + the guard-2a check.
//    (Per PRP "Data models" + item LOGIC #8.)
// ──────────────────────────────────────────────────────────────────────────────
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
            return { done: false, value: buf }; // one chunk; Buffer IS a Uint8Array
          },
        };
      },
    },
    text: async () => buf.toString("utf8"), // readers' no-reader fallback (not used when getReader exists)
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

// RICH_HTML — a full document with <title> + an <article> of 3 substantial paragraphs (~3 KB).
// CALIBRATION (live defuddle probe, research/notes.md §5): this shape yields 1024 chars of markdown,
// comfortably clearing the 200-char SPA floor (file-injector.ts L896). A trivial "<p>hi</p>" may
// extract <200 chars → injectUrl returns false → false negative. DO NOT simplify this fixture.
const RICH_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Example Domain Test Page</title>
  <meta name="description" content="A rich test fixture for the URL injection acceptance harness.">
</head>
<body>
  <header><h1>Example Domain — Test Article</h1></header>
  <main>
    <article>
      <h2>Welcome to the Example Domain</h2>
      <p>This is the first substantial paragraph of the Example Domain test article. It is written
      to be long enough that the content extraction library produces a meaningful body of markdown
      well above the minimum content threshold enforced by the injection pipeline. The paragraph
      discusses how the URL injection feature works end to end, from detection of the scheme-less
      token through normalization, dispatch by content type, and finally the delivery of the
      extracted markdown inside a file block envelope that mirrors the local file injection shape.</p>

      <p>The second paragraph elaborates on the collision rules that govern whether a hash token is
      treated as a URL reference, a local file reference, or ordinary prose. A token like example.com
      has a dotted host with an alphabetic top-level domain, so it passes the shape gate and is
      fetched and injected. A token like node dot js also passes the shape gate, but when the fetch
      returns a non-success status the pipeline leaves the token verbatim in the prompt, which is the
      graceful no-op fallback defined in the behavior section of the specification.</p>

      <p>The third paragraph covers the deduplication rule that normalizes scheme-less and
      fully-qualified forms to the same absolute URL before fetching. When a prompt mentions the
      same web resource twice, once with a scheme and once without, the pipeline issues exactly one
      network request and emits exactly one injection block, sharing the context budget across both
      triggers. This keeps the injected context coherent and avoids duplicate blocks appearing in the
      delivered message that the calling agent session assembles from the returned text and blocks.</p>

      <p>A closing fourth paragraph restates the purpose of the fixture: it exists to give the
      extraction pipeline enough real semantic content that the converted markdown is substantial.
      This sentence and the ones above together ensure the extracted length is comfortably above the
      floor, so the detection group of the test matrix reliably exercises the full HTML pipeline
      rather than taking the single-page-application fallback path that would leave the token as a
      bare reference in the verbatim prompt.</p>
    </article>
  </main>
  <footer><p>&copy; Example Domain — fixture content for offline acceptance testing.</p></footer>
</body>
</html>`;

// IMG_BYTES — non-ASCII bytes (a PNG signature header + trailing high bytes). resizeImage returns
// null for non-processable bytes → the fallback data = buf.toString("base64"). Asserting
// base64 round-trip PROVES readBytesCapped (the BYTE reader) preserved raw bytes; a UTF-8 string
// reader would CORRUPT the 0x89/0x0D/0xFF/0xFE bytes. (Mirrors file-injector.test.mjs Case 3.)
const IMG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature (8 bytes)
  0xff, 0xfe, 0x00, 0x80, // high/non-ASCII bytes — would be corrupted by a UTF-8 decode
]);

// file.txt — a local file fixture written into TMPDIR so the #@file.txt COLLISION case injects it as
// a FILE (proving #@ still works AND that the URL regex never fires a fetch for it).
const FILE_TXT_PATH = path.join(TMPDIR, "file.txt");
const FILE_TXT_BODY = "this is a local file fixture for the collision test group\n";
fsSync.writeFileSync(FILE_TXT_PATH, FILE_TXT_BODY, "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// DETECTION — the #<url> regex fires and the HTML pipeline injects a URL block.
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nDETECTION");

// DET-1 — scheme-less token injects via the HTML pipeline.
await runCase("DET-1", "detection: #example.com → injected via HTML pipeline (kind 'url', <file name=\"https://…\"> envelope)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, '<file name="https://example.com">'), 'block must carry the <file name="URL"> envelope');
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
    assert(calls.length === 1 && calls[0] === "https://example.com", `scheme-less normalized to https://; calls=${JSON.stringify(calls)}`);
    assert(r.text === "#example.com", "prompt preserved verbatim (token never stripped — §6.4 re-trigger on cancel/fork)");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// DET-2 — fully-qualified scheme token injects verbatim (no normalization needed).
await runCase("DET-2", "detection: #https://x.com/y → injected, fetch called with the exact URL", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#https://x.com/y", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, '<file name="https://x.com/y">'), 'block must carry the <file name="https://x.com/y"> envelope');
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
    assert(calls.length === 1 && calls[0] === "https://x.com/y", `fully-qualified URL fetched as-is; calls=${JSON.stringify(calls)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DISPATCH — content-type routing (image / text-html / raw-text / else-verbatim).
// §3.1 rows are the assertion targets. The raw-text path has NO 200-char floor — short bodies are fine.
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nDISPATCH");

// DIS-1 — text/plain → raw text verbatim in the block (NO defuddle extraction).
await runCase("DIS-1", "dispatch: text/plain → raw text verbatim in block (no extraction)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/plain", body: "plain body line\n" }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, "plain body line"), "raw text body must be present verbatim in the block");
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
    assert(calls.length === 1, `text/plain is fetched; calls=${calls.length}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// DIS-2 — application/json → raw JSON verbatim (not mangled through defuddle).
await runCase("DIS-2", "dispatch: application/json → raw JSON verbatim in block", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "application/json", body: '{"k":"v","n":3}' }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, '{"k":"v","n":3}'), "raw JSON must be present verbatim in the block (not defuddle-extracted)");
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// DIS-3 — text/xml → raw text verbatim. NOTE: the production dispatch sniffs a leading '<'
// FIRST (ct.startsWith("text/html") || /^\s*</.test(html) — file-injector.ts L871): ANY body whose first
// non-whitespace char is '<' routes to the HTML/defuddle pipeline (with the 200-char floor), regardless
// of content-type. A realistic XML body ('<?xml…' / '<root>') therefore ALWAYS goes through defuddle. To
// genuinely exercise the RAW-TEXT branch (ct.includes("xml")) the body must NOT start with '<' (even
// after leading whitespace). We use a body that leads with a text token so the raw-text branch fires and
// the bytes land verbatim — proving the xml content-type is a recognized raw-text route (not else→verbatim).
await runCase("DIS-3", "dispatch: text/xml (non-angle-sniffed body) → raw text verbatim in block", async () => {
  const calls = [];
  const xmlBody = "xml <root><item>1</item></root>"; // leads with 'x' → no '<' sniff → raw-text branch
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/xml", body: xmlBody }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, xmlBody), "raw XML must be present verbatim in the block (not defuddle-extracted)");
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// DIS-4 — image/png → images[] + image detail, bytes preserved BYTE-EXACT (proves the byte reader).
await runCase("DIS-4", "dispatch: image/png → images[] + image detail, bytes preserved byte-exact", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: IMG_BYTES }); };
    const r = await mod.injectFiles("#example.com/img.png", [], FIX, false, true);
    assert(r.images.length === 1, `expected 1 image, got ${r.images.length}`);
    assert(r.images[0].data === IMG_BYTES.toString("base64"), "img.data must be raw base64 of the ORIGINAL bytes (byte reader, not UTF-8 decode)");
    assert(Buffer.from(r.images[0].data, "base64").equals(IMG_BYTES), "decoded image bytes must deep-equal the mock bytes");
    assert(r.images[0].mimeType === "image/png", `mimeType must be 'image/png', got ${r.images[0].mimeType}`);
    assert(r.details.length === 1 && r.details[0].kind === "image", `detail kind must be 'image', got ${r.details[0]?.kind}`);
    assert(r.injected === 1, `image injects (count++); got injected===${r.injected}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// COLLISION — the §2.3 table is the literal oracle. Distinguishes "URL-shaped" from
// "not URL-shaped" via the calls tracker (the spec §4 zero-egress proof at the detection layer).
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nCOLLISION");

// COL-1 — #@file.txt is a FILE, not a URL. The (?!@) negative lookahead makes #@ disjoint; the URL
// regex NEVER fires for it → ZERO fetch. The FILE path injects it.
await runCase("COL-1", "collision: #@file.txt is a FILE not a URL (URL regex (?!@) never fires; NO fetch)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // would be a bug if called
    const r = await mod.injectFiles("#@file.txt", [], FIX, false, true);
    assert(calls.length === 0, `#@ is a FILE trigger — URL regex must NEVER fire; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 1, `the FILE path injects file.txt; got injected===${r.injected}`);
    assert(r.details.length === 1 && r.details[0].kind === "text", `file detail kind must be 'text', got ${r.details[0]?.kind}`);
    assert(hasBlock(r, '<file name="'), "a local file block was appended");
    assert(!hasBlock(r, 'name="https://'), "the block name is a local path, NOT an https:// URL");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// COL-2 — prose tokens (heading, issue ref, hex, version, decimal) are NOT URL-shaped → NO fetch, nothing injected.
await runCase("COL-2", "collision: #Heading #1234 #fff #v1.2 #3.14 → prose, NO fetch, nothing injected", async () => {
  const calls = [];
  const prompt = "# Heading and #1234 #fff #v1.2 #3.14";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // would be a bug if called
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `no URL-shaped token → ZERO fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; got ${r.injected}`);
    assert(r.text === prompt, "verbatim prompt preserved");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// COL-3 — mid-word # (foo#example.com): the lookbehind (?<![\p{L}\p{N}_]) fails → not matched → NO fetch.
await runCase("COL-3", "collision: foo#example.com mid-word → not matched, NO fetch", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // would be a bug if called
    const r = await mod.injectFiles("see foo#example.com here", [], FIX, false, true);
    assert(calls.length === 0, `# not at a boundary → not matched; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; got ${r.injected}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// COL-4 — #node.js IS url-shaped (alpha TLD 'js') → fetch IS called → 404 → verbatim (no block).
// This is the case that distinguishes "URL-shaped but unresolvable" from "not URL-shaped".
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

// COL-5 — file + url in one prompt: shared budget, two injected, only the url is fetched.
await runCase("COL-5", "collision: #@file.txt + #example.com → two injected (shared budget), one fetch", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#@file.txt and #example.com", [], FIX, false, true);
    assert(r.injected === 2, `one file + one url → two green lines; got injected===${r.injected}`);
    assert(calls.length === 1, `only example.com is fetched (file.txt is local); calls=${JSON.stringify(calls)}`);
    assert(r.details.some((d) => d.kind === "text"), "a file detail (kind 'text') was produced");
    assert(r.details.some((d) => d.kind === "url"), "a url detail (kind 'url') was produced");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SCHEME-LESS NORMALIZATION — dedup: scheme-less and fully-qualified collapse to ONE injection.
// (The scan loop dedups on the ABSOLUTE form — #example.com and #https://example.com both → https://example.com.)
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nSCHEME-LESS NORMALIZATION");

// NORM-1 — dedup: both forms normalize to https://example.com → ONE injection, ONE fetch.
await runCase("NORM-1", "dedup: #example.com + #https://example.com → ONE injection, ONE fetch", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#example.com and also #https://example.com", [], FIX, false, true);
    assert(r.injected === 1, `both normalize to https://example.com → ONE injection; got injected===${r.injected}`);
    assert(calls.length === 1, `deduped before fetch; calls=${JSON.stringify(calls)}`);
    assert(r.details.length === 1 && r.details[0].kind === "url", `one url detail; got details=${JSON.stringify(r.details)}`);
    assert(hasBlock(r, '<file name="https://example.com">'), 'single <file name="https://example.com"> envelope present');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. Summary + cleanup + exit.
// ──────────────────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(64));
console.log(`Result: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log("\nFailed cases:");
  for (const row of matrixRows) {
    if (row.status === "FAIL") console.log(`  ✗ case ${row.n} (${row.name}): ${row.detail}`);
  }
}
console.log("─".repeat(64));

// Cleanup (always): temp dir holds the file.txt fixture; leave no litter.
try {
  fsSync.rmSync(TMPDIR, { recursive: true, force: true });
} catch {
  /* best-effort */
}

process.exit(failed > 0 ? 1 : 0);