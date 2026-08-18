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

// DIS-1b — [BUG-002] text/plain body that BEGINS WITH '<' still routes RAW. The '<' sniff is a fallback
// for a missing/unknown Content-Type ONLY — never an override of an explicit text type (spec §3.1 "falling
// back to sniffing"). Real-world trigger: raw.githubusercontent.com serves README.md as text/plain, and
// READMEs commonly open with `<p align="center">`; the old sniff routed such a file into defuddle
// (markdown-as-HTML ⇒ ~0 chars extracted ⇒ FALSE "page appears JS-rendered" notify per §3.4 — for a
// static file with no JS anywhere near it). Regression-pins the exact shape.
await runCase("DIS-1b", "dispatch: text/plain body starting with '<' → STILL raw text (no defuddle, no SPA verdict)", async () => {
  const calls = [];
  const mdBody = '<p align="center">\n  <img src="assets/logo.svg" width="180" alt="Logo">\n</p>\n\n# Stagecoach\n\n> Writes your commit messages using the agent you already pay for.\n';
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/plain; charset=utf-8", body: mdBody }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected} (leading '<' must NOT divert text/plain to defuddle)`);
    assert(hasBlock(r, mdBody), "raw README bytes must be injected verbatim (no extraction, no 200-char SPA floor)");
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
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

// DIS-3 — text/xml → raw text verbatim, INCLUDING a body that starts with '<?xml'. Since [BUG-002] the
// '<' sniff applies ONLY when the Content-Type is missing/unknown; an explicit text/xml is delivered raw
// even though its first non-whitespace char is '<' (spec §3.1 lists xml in the raw-text row — running XML
// through defuddle would mangle it). Pre-BUG-002 this body was diverted into the HTML pipeline.
await runCase("DIS-3", "dispatch: text/xml ('<?xml…' body) → raw text verbatim in block", async () => {
  const calls = [];
  const xmlBody = '<?xml version="1.0"?><root><item>1</item></root>'; // leads with '<' → pre-BUG-002 this was defuddled
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

// URL-IMG-EMPTY — BUG-003 (F5 parity): a 200 image/* response with a ZERO-LENGTH body must deliver the
// empty-image NOTE (block + image detail + count) with NO ImageContent attachment — mirroring the local F5
// guard for 0-byte #@image files. Before the fix this attached {type:"image", data:"", mimeType} (the
// provider-rejected shape) and charged estimateImageTokens(null)=2805 for 0 bytes. makeRes({body:""}) is the
// deterministic zero-length-chunk fixture (Buffer.from("") → the reader's single chunk is zero-length).
await runCase("URL-IMG-EMPTY", "image URL with empty body → F5 note block + image detail, NO attachment (BUG-003)", async () => {
  const calls = [];
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: "" }); };
    const r = await mod.injectFiles("#https://example.com/empty.png", [], FIX, false, true);
    assert(calls.length === 1 && calls[0] === "https://example.com/empty.png", `exactly one fetch of the normalized URL, got ${JSON.stringify(calls)}`);
    assert(r.images.length === 0, `NO ImageContent for a 0-byte image body (the provider-rejected shape), got images.length=${r.images.length}`);
    assert(hasBlock(r, '<file name="https://example.com/empty.png"><empty image file — 0 bytes; nothing to attach></file>'),
      `the F5 note block must be delivered (em dash U+2014), got blocks=${JSON.stringify(r.blocks)}`);
    assert(r.injected === 1, `the note counts as a delivery (count++), got injected=${r.injected}`);
    assert(r.details.length === 1 && r.details[0].kind === "image", `one image detail, got ${JSON.stringify(r.details)}`);
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

// COL-4 — [BUG-001] #node.js: final label 'js' is in CODE_EXTENSIONS → the deny-list gate rejects
// it BEFORE fetch (NOT because URL_SHAPE_RE fails — it passes; the gate is the guard). The fetch SPY
// (not the absence of a stub) proves ZERO egress, and r.text==="#node.js" proves nothing was stripped.
// The explicit-scheme form #https://node.js still fetches (see BUG1-12 in the BUG-001 BYPASS section).
await runCase("COL-4", "collision: #node.js is a code-extension token → DENIED (no fetch), verbatim", async () => {
  const calls = [];
  const prompt = "#node.js";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `#node.js final label 'js' is a code extension → must NOT fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `no block; got injected===${r.injected}`);
    assert(!hasBlock(r, '<file name="https://node.js">'), "no block appended");
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
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
// BUG-001 REGRESSION — code-extension tokens must NOT fetch.
//
// Scheme-less tokens whose final label ∈ CODE_EXTENSIONS are denied BEFORE fetch (no egress, no
// injection). Each case spies on globalThis.fetch and asserts ZERO calls. These FAIL if S1's
// CODE_EXTENSIONS gate is removed — the regression guard for BUG-001. enableUrls===true (5th param)
// in every case: this is the ON-BY-DEFAULT false-positive class (the original BUG-001 blind spot).
// (Consolidates S1's former DENY-1 — BUG1-1 now owns the #main.go no-fetch assertion.)
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nBUG-001 REGRESSION: code-extension tokens must NOT fetch");

// BUG1-1 — #main.go: final label 'go' ∈ CODE_EXTENSIONS → denied before fetch. (Formerly S1's DENY-1;
// consolidated here — BUG1-1 is the canonical #main.go case.)
await runCase("BUG1-1", "no-fetch: #main.go (ext 'go' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#main.go";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // SPY — proves ZERO egress
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch; // ALWAYS restore — a leaked stub poisons later cases / hits real network
  }
});

// BUG1-2 — #notes.md: final label 'md' ∈ CODE_EXTENSIONS (markdown) → denied before fetch.
await runCase("BUG1-2", "no-fetch: #notes.md (ext 'md' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#notes.md";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-3 — #config.json: final label 'json' ∈ CODE_EXTENSIONS → denied before fetch.
await runCase("BUG1-3", "no-fetch: #config.json (ext 'json' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#config.json";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-4 — #image.png: final label 'png' ∈ CODE_EXTENSIONS (image) → denied before fetch.
await runCase("BUG1-4", "no-fetch: #image.png (ext 'png' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#image.png";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-5 — #script.py: final label 'py' ∈ CODE_EXTENSIONS → denied before fetch.
await runCase("BUG1-5", "no-fetch: #script.py (ext 'py' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#script.py";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-6 — #utils.rs: final label 'rs' ∈ CODE_EXTENSIONS (Rust) → denied before fetch.
await runCase("BUG1-6", "no-fetch: #utils.rs (ext 'rs' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#utils.rs";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-7 — #spec.tsx: final label 'tsx' ∈ CODE_EXTENSIONS → denied before fetch.
await runCase("BUG1-7", "no-fetch: #spec.tsx (ext 'tsx' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#spec.tsx";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-8 — #app.cs: final label 'cs' ∈ CODE_EXTENSIONS (C#) → denied before fetch.
await runCase("BUG1-8", "no-fetch: #app.cs (ext 'cs' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#app.cs";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-9 — #lib.java: final label 'java' ∈ CODE_EXTENSIONS → denied before fetch.
await runCase("BUG1-9", "no-fetch: #lib.java (ext 'java' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#lib.java";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-10 — #data.csv: final label 'csv' ∈ CODE_EXTENSIONS → denied before fetch.
await runCase("BUG1-10", "no-fetch: #data.csv (ext 'csv' ∈ CODE_EXTENSIONS) → zero calls, verbatim", async () => {
  const calls = [];
  const prompt = "#data.csv";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 0, `must NOT fetch for ${prompt}; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected for ${prompt}; got ${r.injected}`);
    assert(r.text === prompt, `prompt returned byte-for-byte; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// BUG1-11 — the CONTENT-INJECTION harm guard. A 200-OK text/html RICH_HTML response is 'waiting'
// (the Go homepage), yet #main.go is denied → fetch never fires → injected===0 and no Go-homepage
// block. WITHOUT the gate this FAILS (fetch → defuddle extracts the Go homepage → injects it).
// RICH_HTML (≥200 chars) is deliberate: a trivial body would trigger the SPA fallback and mask the
// regression (injected===0 for the wrong reason).
await runCase("BUG1-11", "harm: refactor #main.go now → Go homepage NOT injected (gate denies before fetch)", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML, status: 200, ok: true }); };
    const r = await mod.injectFiles("refactor #main.go now", [], FIX, false, true);
    assert(calls.length === 0, `#main.go denied → no fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `no content injected (Go homepage must NOT reach the model); got ${r.injected}`);
    assert(!hasBlock(r, "https://main.go"), 'no <file name="https://main.go"> block');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BUG-001 BYPASS — explicit-scheme tokens still fetch (the deny-list is scheme-less only).
//
// BUG1-12 — the deny-list gates SCHEME-LESS tokens only. #https://node.js carries an explicit
// https:// scheme → it BYPASSES the gate → fetch IS called. Proves the fix's scope: a user can
// always force a URL by writing the scheme. (Gate-independent: passes with or without S1's gate.)
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nBUG-001 BYPASS: explicit-scheme tokens still fetch (deny-list is scheme-less only)");

// BUG1-12 — #https://node.js: explicit scheme bypasses the deny-list → fetch IS called (404 → verbatim).
await runCase("BUG1-12", "bypass: #https://node.js → explicit scheme STILL fetches (404 → verbatim)", async () => {
  const calls = [];
  const prompt = "#https://node.js";
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(calls.length === 1, `explicit scheme bypasses deny-list → fetch IS called; calls=${calls.length}`);
    assert(calls[0] === "https://node.js", `fetched the exact URL; got ${calls[0]}`);
    assert(r.injected === 0, `404 → verbatim; got injected===${r.injected}`);
    assert(r.text === prompt, `prompt verbatim; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── FAILURE / GUARD CASES (§3.5 / §3.3 / §3.4 / §4) ──
//
// The whole safety model of URL injection is "on any problem, leave the prompt untouched and let
// the model fetch it itself." Every case below proves ONE failure path leaves the `#<url>` token
// VERBATIM (r.text === prompt byte-for-byte), appends NO block (r.injected===0, empty blocks),
// never throws, and — for the §4 air-gapped case — makes ZERO network calls when enableUrls===false.
// injectUrl is PRIVATE, so each case drives it via mod.injectFiles(prompt, [], CTX, bareAt, enableUrls).
//
// Two non-obvious gotchas baked into the stubs below (documented once here, not per-case):
//  GOTCHA 1 — URL_TIMEOUT_MS (file-injector.ts L81) is a PRIVATE module const (20_000ms) and is NOT
//    exported, so it cannot be injected/reduced. The real 20s cannot be exercised hermetically; the
//    timeout case (FAIL-3) SIMULATES it by stubbing fetch to reject with an AbortError-like error
//    (catch { return false } → verbatim). The 20s *magnitude* is deliberately NOT asserted here.
//  GOTCHA 2 — `remaining` (the context budget) is DERIVED, not a settable field. Formula
//    (file-injector.ts L1338-1347): reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE(8192);
//    remaining = max(0, contextWindow - tokens - reserve - MARGIN(8192)). The over-budget case
//    (FAIL-6) uses LOW_BUDGET_CTX below so remaining = 16394 - 0 - 8192 - 8192 = 10.
//
// Two small test-local helpers (do NOT re-declare S1's makeRes/FIX/runCase/assert/RICH_HTML):

// ctx WITH a notify spy (mirrors file-injector.test.mjs L160-200 makeMockCtx ui shape) — for the SPA
// case. ctx.hasUI===true is required for ctx.ui?.notify(...) to fire (the SPA branch is guarded on it).
function ctxWithNotifySpy() {
  const notes = [];
  return {
    ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } },
    notes,
  };
}

// ctx WITH a derived low remaining (≈10 tokens, NO model → reserve=DEFAULT_RESERVE=8192) — for the
// over-budget case. getContextUsage yields {tokens:0, contextWindow:16394} ⇒ remaining = 10. No
// hasUI here ⇒ SPA notify would be a no-op even if it fired (it must NOT fire — the body is ≥200).
const LOW_BUDGET_CTX = { cwd: TMPDIR, getContextUsage: () => ({ tokens: 0, contextWindow: 16394 }) };

console.log("\nFAILURE / GUARD");

// FAIL-1 — non-2xx response → verbatim, no block (§3.5). The !res.ok guard returns false; with count
// staying 0 the count===0 early-return hands back the ORIGINAL `text` ref + empty blocks/details.
await runCase("FAIL-1", "guard: non-2xx (404) → verbatim, no block, injected===0", async () => {
  const prompt = "Read #example.com";
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ok: false, status: 404 }); };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
    assert(r.details.length === 0, "no detail appended on failure");
    assert(calls.length === 1, `fetch WAS called (404 is still a network round-trip); calls=${calls.length}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-2 — DNS/TLS/network rejection → verbatim (§3.5). fetch rejects with a generic Error; injectUrl's
// catch { return false } swallows it (NEVER throws out). The fact that `r` resolves at all is the proof
// there was no uncaught rejection.
await runCase("FAIL-2", "guard: DNS/network rejection → verbatim, no uncaught rejection", async () => {
  const prompt = "Read #example.com";
  try {
    globalThis.fetch = async () => Promise.reject(new Error("ENOTFOUND example.com"));
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-3 — timeout (AbortError sim) → verbatim (§3.5). URL_TIMEOUT_MS is a PRIVATE const (20_000ms,
// file-injector.ts L81) and is NOT exported — the real 20s cannot be exercised hermetically. Instead we
// SIMULATE the abort by rejecting with an AbortError-like error (name:'AbortError'); injectUrl's catch
// { return false } → verbatim. (Optional wiring sanity: assert the 2nd fetch arg carries an AbortSignal,
// proving the AbortController is actually wired up even though we don't wait on it.)
await runCase("FAIL-3", "guard: timeout (AbortError sim) → verbatim (URL_TIMEOUT_MS private; magnitude not asserted)", async () => {
  const prompt = "Read #example.com";
  const capturedSignals = [];
  try {
    globalThis.fetch = async (url, init) => {
      if (init?.signal) capturedSignals.push(init.signal);
      const e = new Error("aborted");
      e.name = "AbortError";
      return Promise.reject(e);
    };
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
    assert(capturedSignals.length === 1 && capturedSignals[0] instanceof AbortSignal, "fetch must be called with an AbortSignal (timeout wiring present)");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-4 — Content-Length >1MB (guard 2a, pre-download) → verbatim AND body reader NEVER called (§3.3).
// The pre-check `if (len && len > URL_MAX_BYTES) return false` runs BEFORE readBodyCapped, so the body
// reader spy must record ZERO invocations. content-length '1500000' > URL_MAX_BYTES(1_000_000).
await runCase("FAIL-4", "guard: Content-Length >1MB → verbatim, body reader NEVER called", async () => {
  const prompt = "Read #example.com";
  const readerCalls = [];
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (k) => {
          const lk = k.toLowerCase();
          if (lk === "content-type") return "text/html";
          if (lk === "content-length") return "1500000"; // > URL_MAX_BYTES(1_000_000)
          return null;
        },
      },
      body: {
        // SPY — records every getReader() call so we can prove the pre-download guard skipped the body.
        getReader: () => { readerCalls.push(1); return { read: async () => ({ done: true }) }; },
      },
      text: async () => "",
    });
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
    assert(readerCalls.length === 0, `getReader must NOT be called when Content-Length exceeds cap; calls=${readerCalls.length}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-5 — mid-stream overflow (guard 2b) → verbatim (§3.3). Content-Length is ABSENT (len=0 ⇒ the
// guard-2a pre-check `len && len>cap` is FALSE) so control reaches readBodyCapped, which streams ONE
// chunk >1MB and returns null at the first read → false. This ISOLATES guard 2b from guard 2a above.
await runCase("FAIL-5", "guard: mid-stream >1MB (absent Content-Length) → verbatim", async () => {
  const prompt = "Read #example.com";
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (k) => {
          const lk = k.toLowerCase();
          if (lk === "content-type") return "text/html";
          if (lk === "content-length") return null; // ABSENT ⇒ len=0 ⇒ pre-check false ⇒ reach readBodyCapped
          return null;
        },
      },
      body: {
        getReader: () => {
          let i = 0;
          return {
            // ONE chunk of 1_100_000 bytes then done. size(1_100_000) > cap(1_000_000) ⇒ readBodyCapped
            // returns null on the FIRST read → false (verbatim). Uint8Array (not Buffer) keeps it general.
            read: async () => (i++ === 0 ? { done: false, value: new Uint8Array(1_100_000) } : { done: true }),
          };
        },
      },
      text: async () => "",
    });
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-6 — over-budget → verbatim, NO paging (§3.3). CTX=LOW_BUDGET_CTX (remaining≈10). RICH_HTML yields
// ≥200 chars of markdown (passes the SPA floor — SPA runs BEFORE over-budget per the ordering gotcha) and
// a cost ≈ 256 ≫ 10 ⇒ guard 3 fires → false. URLs NEVER page (the read tool can't fetch a URL), so we
// assert NO `<paged:` block. No hasUI on LOW_BUDGET_CTX ⇒ a notify would be a silent no-op (and must NOT
// fire anyway, since the SPA branch is not taken).
await runCase("FAIL-6", "guard: over-budget (remaining≈10) → verbatim, NO paging, markdown ≥200 (not SPA)", async () => {
  const prompt = "Read #example.com";
  try {
    globalThis.fetch = async () => makeRes({ ct: "text/html", body: RICH_HTML }); // ≥200 chars ⇒ not SPA
    const r = await mod.injectFiles(prompt, [], LOW_BUDGET_CTX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `over-budget URL must be verbatim; injected=${r.injected}`);
    assert(r.blocks.length === 0, `no block appended on failure; blocks=${JSON.stringify(r.blocks)}`);
    assert(!r.blocks.some((b) => b.includes("<paged:")), "URLs NEVER page (read tool can't fetch a URL)");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-7 — SPA / empty-extraction (§3.4). defuddle yields < URL_MIN_CONTENT(200) chars ⇒ false +
// ctx.ui.notify("<url>: page appears JS-rendered; left as reference", "info") (guarded on ctx.hasUI).
// A deliberately minimal `<p>short</p>` HTML keeps the extracted markdown WELL under 200 so the SPA
// branch fires deterministically; we assert on the NOTIFY behavior (robust) rather than a fragile char count.
await runCase("FAIL-7", "guard: SPA <200 chars → verbatim + notify (ctx.hasUI===true, type 'info')", async () => {
  const prompt = "Read #example.com";
  const { ctx, notes } = ctxWithNotifySpy();
  try {
    globalThis.fetch = async () => makeRes({ ct: "text/html", body: "<html><body><p>short</p></body></html>" });
    const r = await mod.injectFiles(prompt, [], ctx, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `SPA → verbatim; injected=${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
    assert(notes.some((n) => n.m.includes("page appears JS-rendered; left as reference")), `SPA notify must fire; notes=${JSON.stringify(notes)}`);
    assert(notes.some((n) => n.t === "info"), `SPA notify type must be 'info'; notes=${JSON.stringify(notes)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-8 — enableUrls===false → ZERO network egress (§4 air-gapped opt-out). The whole URL loop body is
// SKIPPED when enableUrls is false, so fetch is never reached. We install a SPY (not rely on the absence
// of a stub) and assert calls.length===0 — the absence of a stub proves nothing.
await runCase("FAIL-8", "guard: enableUrls===false → ZERO fetch calls (air-gapped opt-out) + verbatim", async () => {
  const prompt = "Read #example.com";
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // spy — would be a bug if called
    const r = await mod.injectFiles(prompt, [], FIX, false, false); // 5th param enableUrls===false
    assert(calls.length === 0, `enableUrls:false must make ZERO fetch calls; calls=${JSON.stringify(calls)}`);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `nothing injected; injected=${r.injected}`);
    assert(r.blocks.length === 0, "no block appended");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// FAIL-9 — unhandled content-type (PDF) → verbatim (§3.5). application/pdf matches none of the recognized
// prefixes/includes (text/ | json | xml | markdown | image/) → the else-branch returns false. The same
// branch covers application/octet-stream and any other unhandled ct. content-length is ABSENT so guard 2a
// cannot short-circuit before the dispatch; the small body would fit under cap so guard 2b cannot either —
// proving the ELSE branch itself is the reason for the verbatim result.
await runCase("FAIL-9", "guard: unhandled content-type (application/pdf) → verbatim", async () => {
  const prompt = "Read #example.com";
  try {
    globalThis.fetch = async () => makeRes({ ct: "application/pdf", body: "%PDF-1.4 fake" }); // else-branch
    const r = await mod.injectFiles(prompt, [], FIX, false, true);
    assert(r.text === prompt, `text must be verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.injected === 0, `injected must be 0 on failure, got ${r.injected}`);
    assert(r.blocks.length === 0, "no block appended on failure");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ── onUrlFetch progress callback (§X — URL download feedback) ──────────────────────────────────────
// injectFiles' 6th param is a UI progress hook the input handler wires to a footer spinner. It MUST fire
// once per REAL fetch — AFTER gating + dedup, immediately BEFORE network egress — and NOT for gated
// (code-ext) or deduped tokens. These cases pin that contract at the data level (no UI / no timers).

// CB-1 — single URL: onUrlFetch fires once with the absolute URL, BEFORE the fetch resolves.
await runCase("CB-1", "onUrlFetch: single URL → fires once with absolute URL, before fetch resolves", async () => {
  const order = [];
  try {
    globalThis.fetch = async (url) => { order.push("fetch:" + String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#example.com", [], FIX, false, true, (url) => { order.push("cb:" + url); });
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(order.length === 2 && order[0] === "cb:https://example.com" && order[1] === "fetch:https://example.com",
      `callback must fire BEFORE fetch, both with the absolute URL; order=${JSON.stringify(order)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// CB-2 — dedup: the same URL twice → onUrlFetch fires ONCE (the second is deduped before the callback).
await runCase("CB-2", "onUrlFetch: duplicate URL → fires once (deduped before the callback)", async () => {
  const cb = [];
  const fetches = [];
  try {
    globalThis.fetch = async (url) => { fetches.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#example.com and #https://example.com", [], FIX, false, true, (url) => { cb.push(url); });
    assert(r.injected === 1, `expected injected===1 (dedup), got ${r.injected}`);
    assert(cb.length === 1 && cb[0] === "https://example.com", `callback must fire once; cb=${JSON.stringify(cb)}`);
    assert(fetches.length === 1, `fetch must run once; fetches=${JSON.stringify(fetches)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// CB-3 — gated token: a code-extension token (#main.go) → onUrlFetch NEVER fires (gated before egress).
await runCase("CB-3", "onUrlFetch: code-ext token (#main.go) → NEVER fires (gate denies before callback)", async () => {
  const cb = [];
  const fetches = [];
  try {
    globalThis.fetch = async (url) => { fetches.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("refactor #main.go now", [], FIX, false, true, (url) => { cb.push(url); });
    assert(r.injected === 0, `expected injected===0 (gated), got ${r.injected}`);
    assert(cb.length === 0, `callback must NOT fire for a gated token; cb=${JSON.stringify(cb)}`);
    assert(fetches.length === 0, `fetch must NOT run for a gated token; fetches=${JSON.stringify(fetches)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// CB-4 — multiple distinct URLs: onUrlFetch fires once per URL, in prompt order, each with its absolute URL.
await runCase("CB-4", "onUrlFetch: N distinct URLs → fires once each, in order, with absolute URLs", async () => {
  const cb = [];
  try {
    globalThis.fetch = async () => makeRes({ ct: "text/html", body: RICH_HTML });
    const r = await mod.injectFiles("#a.com vs #https://b.org/x", [], FIX, false, true, (url) => { cb.push(url); });
    assert(r.injected === 2, `expected injected===2, got ${r.injected}`);
    assert(cb.length === 2 && cb[0] === "https://a.com" && cb[1] === "https://b.org/x",
      `callback must fire once per URL in order; cb=${JSON.stringify(cb)}`);
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