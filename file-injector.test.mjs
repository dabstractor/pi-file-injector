// file-injector.test.mjs — Model-free acceptance harness for the `#@file` injection extension.
//
// WHAT THIS IS
//   A standalone, zero-dependency Node ESM script (the project's "standalone .mjs gate" convention —
//   no test framework is configured in this repo). It imports the REAL committed `./file-injector.ts`
//   through Pi's own loader mechanism (jiti + the same `alias` map Pi's extension loader uses), spins
//   up tiny temp fixtures, runs ~25 named assertions covering all 14 PRD §11 acceptance cases + the
//   §10 edge cases + the 3 handler guards + the headless/notify path, prints a 14-row pass/fail
//   matrix, and exits 0 iff every model-free assertion is green.
//
// WHY IT EXISTS
//   PRD §11 is literally a "Manual test matrix" that today requires a human driving the TUI / a real
//   model for every case. 12 of the 14 cases are deterministic structural properties (block format,
//   token-presence, regex no-match, guard returns, image merge) that an automated gate can assert
//   instantly and re-runably. The 2 genuinely-live cases (#12 `-p`, #13 end-to-end parity) are
//   printed as exact `pi ...` commands to run manually and do NOT affect the exit code (keeps the
//   gate hermetic: no model API key, no Pi process, no network).
//
// RUN
//   node ./file-injector.test.mjs      # from the repo root; exits 0 on success, 1 on any failure.

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

// ──────────────────────────────────────────────────────────────────────────────
// 1. Resolve the GLOBAL pi package root (it is NOT resolvable from the project cwd).
//    Verified: `npm root -g` → the dir containing `@earendil-works/pi-coding-agent`.
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
// ──────────────────────────────────────────────────────────────────────────────
const jitiLib = PIPKG + "/node_modules/jiti/lib/jiti.mjs";
const { createJiti } = await import(jitiLib);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Import the REAL committed extension (resolve relative to THIS script → cwd-independent).
// ──────────────────────────────────────────────────────────────────────────────
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TS_PATH = path.resolve(SCRIPT_DIR, "file-injector.ts");
const mod = await jiti.import(TS_PATH);

// ──────────────────────────────────────────────────────────────────────────────
// 4. Tiny assertion harness (the project has no test runner; bare helper matches the zero-deps ethos).
// ──────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const matrixRows = []; // {n, name, status, detail} — status: PASS | FAIL | INTEGRATION

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Run one model-free assertion block. The block throws on failure (caught here).
 * Prints ✓/✗ + the case number + name, and records a matrix row.
 * `n` is the PRD §11 case number (1–14); `name` is the short label.
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

/** Record an integration-only case (no assertion; never affects the exit code). */
function integrationCase(n, name, command, expected) {
  matrixRows.push({ n, name, status: "INTEGRATION", detail: command });
  console.log(`  ℹ case ${n}: ${name} (INTEGRATION — run manually)`);
  console.log(`      $ ${command}`);
  console.log(`      expected: ${expected}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Sanity: prove we loaded the REAL shipped file (not a stub / stale copy).
// ──────────────────────────────────────────────────────────────────────────────
assert(typeof mod.default === "function", "mod.default must be a function (the factory)");
assert(typeof mod.injectFiles === "function", "mod.injectFiles must be a function");
assert(typeof mod.cleanToken === "function", "mod.cleanToken must be a function");
assert(typeof mod.formatTextFileBlock === "function", "mod.formatTextFileBlock must be a function");
assert(typeof mod.formatImageBlock === "function", "mod.formatImageBlock must be a function");
assert(typeof mod.formatBinaryBlock === "function", "mod.formatBinaryBlock must be a function");
assert(typeof mod.formatEmptyImageBlock === "function", "mod.formatEmptyImageBlock must be a function (F5)");
assert(typeof mod.formatPagedDirectiveBlock === "function", "mod.formatPagedDirectiveBlock must be a function (§5.5 paged delivery)");
assert(typeof mod.hasValidImageMagic === "function", "mod.hasValidImageMagic must be a function (F3)");
assert(typeof mod.scanTokens === "function", "mod.scanTokens must be a function (scan-only, recursion-ready)");
assert(typeof mod.injectFile === "function", "mod.injectFile must be a function (stat→claim→classify→count)");
assert(typeof mod.emitText === "function", "mod.emitText must be a function (inline-vs-paged text decision)");
assert(typeof mod.isAbsoluteOrTilde === "function", "mod.isAbsoluteOrTilde must be a function (§4.5 markdown relative-only guard)");
assert(typeof mod.computeCodeRanges === "function", "mod.computeCodeRanges must be a function (§5.6.1 code-region detection)");
assert(typeof mod.inCode === "function", "mod.inCode must be a function (binary search over code ranges)");
assert(typeof mod.estimateImageTokens === "function", "mod.estimateImageTokens must be a function (§5.6.2 image token estimate)");
assert(typeof mod.resolveImportPath === "function", "mod.resolveImportPath must be a function (§4.5 exact→.md/.markdown resolution ladder)");
assert(typeof mod.isRegularFile === "function", "mod.isRegularFile must be a function (stat + isFile, never throws)");

// ── MODULE-SURFACE COMPLETENESS (S4 sync) ── The 16 asserts above name the MEANINGFUL exports. This guard
// enforces the FULL contract: every function the module SHIPS is either (a) asserted by name above, or (b) a
// known pure helper tested indirectly. It catches a future export added without a sanity assert, AND catches
// injectMarkdown (the PRIVATE recursion driver) being accidentally exported. (PRD §11 "the gate must assert
// the real shipped module surface"; item LOGIC (c).)
const ASSERTED_EXPORTS = new Set([
  "default", "injectFiles", "cleanToken", "formatTextFileBlock", "formatImageBlock", "formatBinaryBlock",
  "formatEmptyImageBlock", "formatPagedDirectiveBlock", "hasValidImageMagic", "scanTokens", "injectFile",
  "emitText", "isAbsoluteOrTilde", "computeCodeRanges", "inCode", "estimateImageTokens",
  "resolveImportPath", "isRegularFile",
]);
const PURE_HELPERS_NOT_ASSERTED = new Set(["expandTildeAndResolve", "extOf", "isBinary"]); // tested indirectly via injectFiles
{
  const shippedFunctions = new Set(Object.keys(mod).filter((k) => typeof mod[k] === "function"));
  const unexpected = [...shippedFunctions].filter((k) => !ASSERTED_EXPORTS.has(k) && !PURE_HELPERS_NOT_ASSERTED.has(k));
  assert(unexpected.length === 0,
    `module ships functions not in the sanity list: ${unexpected.join(", ")} ` +
      `(add a typeof-assert above, or — if it is injectMarkdown — keep it PRIVATE and exercise via injectFiles)`);
  // injectMarkdown is the PRIVATE recursion driver (exercised via injectFiles). Assert it is NOT exported.
  assert(typeof mod.injectMarkdown === "undefined",
    "injectMarkdown must NOT be exported — it is a PRIVATE recursion driver (exercised via injectFiles; PRD §5.6)");
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Mock pi/ctx factories + handler capture (verified pattern — drives guards/notify/transform).
// ──────────────────────────────────────────────────────────────────────────────
function makeMockCtx(cwd, { hasUI = true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,
  };
}

function captureHandler(event = "input") {
  const slot = {};
  const pi = { on: (ev, cb) => { if (ev === event) slot.cb = cb; } }; // capture by event name (factory registers both input + session_start)
  mod.default(pi); // registers handlers; slot.cb holds the one for `event`
  return slot;
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Fixture setup — tiny, fixed, deterministic. (2 MB huge.log proves "entire file / no truncation"
//    via exact byte-equality; a 50 MB file would bloat the repo for no extra signal.)
// ──────────────────────────────────────────────────────────────────────────────
const TMPDIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "saf-"));
const HOME_NOTES_NAME = ".sharp-at-test-notes.md";
const HOME_NOTES_PATH = path.join(os.homedir(), HOME_NOTES_NAME);

// A minimal valid 1×1 PNG (67 bytes). resizeImage() returns null on this DETERMINISTICALLY → the image
// case (#3) exercises the fallback path (data === raw base64, empty-hints block). Do NOT randomize — a
// random image may non-deterministically hit the resize branch and make the case flaky.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// Fixed fixture contents (declared once so the parity case #13 can build the expected template from
// the SAME source — proving byte-identical format to processFileArguments).
const A_TS_CONTENT =
  "export function add(a, b) {\n  return a + b;\n}\n// a small TypeScript fixture for the #@file tests\n";
const B_TS_CONTENT = "export const VALUE = 42;\n";
const TXT_CONTENT = "plain text content for the parenthesized-token edge case\n";
const HOME_NOTES_CONTENT = "# Notes\n\nTilde-expansion fixture for #@~/...\n";

function buildFixtures() {
  fsSync.writeFileSync(path.join(TMPDIR, "a.ts"), A_TS_CONTENT);
  fsSync.writeFileSync(path.join(TMPDIR, "b.ts"), B_TS_CONTENT);
  fsSync.writeFileSync(path.join(TMPDIR, "a.txt"), TXT_CONTENT);
  fsSync.writeFileSync(path.join(TMPDIR, "pic.png"), PNG_BYTES);
  fsSync.writeFileSync(path.join(TMPDIR, "data.bin"), Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0xfe])); // has NUL → binary
  fsSync.writeFileSync(path.join(TMPDIR, "empty.txt"), ""); // 0 bytes
  // F3 fixture: a file with an image extension but TEXT content (fails magic-number sniff).
  fsSync.writeFileSync(path.join(TMPDIR, "fake.png"), "this is not really a PNG, just text\n");
  // F5 fixture: a genuine 0-byte image file.
  fsSync.writeFileSync(path.join(TMPDIR, "empty.png"), "");
  fsSync.mkdirSync(path.join(TMPDIR, "src"), { recursive: true }); // a directory

  // Markdown transitive-import fixtures (PRD §5.6). notes.md has BOTH a real #@api.md (prose) AND a
  // fenced #@example.ts (code-exempt) — it serves cases 15 (import) + 16 (code-exempt). sub/api.md is
  // DELIBERATELY distinct from top-level api.md so case 19 can prove resolution is relative to the md's dir.
  fsSync.writeFileSync(path.join(TMPDIR, "notes.md"), "# Notes\n\nImports #@api.md here.\n\n```\n#@example.ts\n```\n");
  fsSync.writeFileSync(path.join(TMPDIR, "api.md"), "# API\n\nTop-level API surface.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "a.md"), "# A\n\nRefs #@b.md.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "b.md"), "# B\n\nBack #@a.md.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "notesAbs.md"), "# Abs\n\nIgnored #@/etc/hosts here.\n");
  fsSync.mkdirSync(path.join(TMPDIR, "sub"), { recursive: true });
  fsSync.writeFileSync(path.join(TMPDIR, "sub", "notes.md"), "# Sub Notes\n\nSee #@api.md.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "sub", "api.md"), "# Sub API\n\nSibling API in sub/.\n");

  // Markdown shared-budget + §10 edge fixtures (PRD §5.6.2 / §10 — cases 20 / MD1 / MD2). bigdoc.md imports
  // 3 small parts + the existing huge.log (case 20: under PAGED_FIX the accumulator spans the recursion →
  // 3 parts whole, huge.log paged). notesMissing.md imports a MISSING ghost.md (MD1: §10 → marker verbatim,
  // requires the injectMarkdown §10 fix). sub/outsider.md imports #@../shared/api.md (MD2: outside-cwd but
  // inside the markdown's parent → allowed; pure regression test). ghost.md is INTENTIONALLY NOT created.
  fsSync.writeFileSync(path.join(TMPDIR, "bigdoc.md"),
    "# Bigdoc\n\n- One: #@part1.txt\n- Two: #@part2.txt\n- Three: #@part3.txt\n- Logs: #@huge.log\n");
  fsSync.writeFileSync(path.join(TMPDIR, "part1.txt"), "Part one content.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "part2.txt"), "Part two content.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "part3.txt"), "Part three content.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "notesMissing.md"), "# Notes\n\nRefs #@ghost.md here.\n");
  // sub/ already created above (fsSync.mkdirSync(path.join(TMPDIR, "sub"), { recursive: true }));
  fsSync.writeFileSync(path.join(TMPDIR, "sub", "outsider.md"), "# Sub\n\nSee #@../shared/api.md here.\n");
  fsSync.mkdirSync(path.join(TMPDIR, "shared"), { recursive: true });   // OUTSIDE cwd-relative-to-subdir
  fsSync.writeFileSync(path.join(TMPDIR, "shared", "api.md"), "# Shared API\n\nOutside cwd.\n");
  // ghost.md is INTENTIONALLY NOT created — it is the missing import for MD1.

  // Markdown extension-shorthand fixtures (PRD §4.5 rule 3 — T1.S1 resolveImportPath unit tests).
  // bare `README` (no ext) + `README.md` → exact-match-wins (bare beats .md). `PRD.md` exists but NOT bare
  // `PRD` → shorthand falls back to PRD.md. `only.markdown` exists but NOT bare `only`/`only.md` → fallback
  // reaches .markdown. A bare `.env` → path.extname(".env")==="" technically qualifies, BUT exact-wins returns
  // .env before the .md fallback (follows PRD §4.5 literally — no dotfile exclusion).
  fsSync.writeFileSync(path.join(TMPDIR, "README"), "bare readme\n");
  fsSync.writeFileSync(path.join(TMPDIR, "README.md"), "# README\n");
  fsSync.writeFileSync(path.join(TMPDIR, "PRD.md"), "# PRD\n"); // NO bare `PRD` → shorthand target
  fsSync.writeFileSync(path.join(TMPDIR, "only.markdown"), "# Only\n"); // NO bare `only`/`only.md`
  fsSync.writeFileSync(path.join(TMPDIR, ".env"), "KEY=val\n"); // dotfile exact-wins fixture

  // ~2 MB huge.log: many repeated lines. Exact byte-equality vs. the fixture proves "entire file,
  // no truncation" without bloating the repo. Computed once so case #2 can compare block content
  // byte-for-byte against THIS exact buffer.
  const LINE = "2024-01-01T00:00:00.000Z INFO request handled status=200 path=/api/items\n";
  const HUGE_LINES = [];
  const TARGET_BYTES = 2 * 1024 * 1024; // ~2 MB
  let acc = 0;
  while (acc < TARGET_BYTES) {
    HUGE_LINES.push(LINE);
    acc += LINE.length;
  }
  const HUGE_LOG_CONTENT = HUGE_LINES.join("");

  return { HUGE_LOG_CONTENT };
}

const { HUGE_LOG_CONTENT } = buildFixtures();
// Write huge.log AFTER computing content (so we hold the exact string for the assertion).
fsSync.writeFileSync(path.join(TMPDIR, "huge.log"), HUGE_LOG_CONTENT);

// The home-dir notes file for the tilde case (#10). Written into os.homedir(); cleaned up in finally.
fsSync.writeFileSync(HOME_NOTES_PATH, HOME_NOTES_CONTENT);

// Absolute paths the assertions expect.
const A_TS = path.join(TMPDIR, "a.ts");
const B_TS = path.join(TMPDIR, "b.ts");
const A_TXT = path.join(TMPDIR, "a.txt");
const PIC = path.join(TMPDIR, "pic.png");
const BIN = path.join(TMPDIR, "data.bin");
const EMPTY = path.join(TMPDIR, "empty.txt");
const FAKE_PNG = path.join(TMPDIR, "fake.png"); // F3: image-ext + text body
const EMPTY_PNG = path.join(TMPDIR, "empty.png"); // F5: 0-byte image
const HUGE = path.join(TMPDIR, "huge.log");
const SRC = path.join(TMPDIR, "src") + path.sep; // includes trailing slash (token "src/")

const FIX = { cwd: TMPDIR };

// Markdown transitive-import path constants (PRD §5.6 — cases 15-19).
const NOTES = path.join(TMPDIR, "notes.md");
const API = path.join(TMPDIR, "api.md");
const A_MD = path.join(TMPDIR, "a.md");
const B_MD = path.join(TMPDIR, "b.md");
const NOTES_ABS = path.join(TMPDIR, "notesAbs.md");
const SUB_NOTES = path.join(TMPDIR, "sub", "notes.md");
const SUB_API = path.join(TMPDIR, "sub", "api.md");

// Markdown shared-budget + §10 edge path constants (PRD §5.6.2 / §10 — cases 20 / MD1 / MD2).
const BIGDOC = path.join(TMPDIR, "bigdoc.md");
const PART1 = path.join(TMPDIR, "part1.txt");
const PART2 = path.join(TMPDIR, "part2.txt");
const PART3 = path.join(TMPDIR, "part3.txt");
const NOTES_MISSING = path.join(TMPDIR, "notesMissing.md");
const OUTSIDER = path.join(TMPDIR, "sub", "outsider.md");
const SHARED_API = path.join(TMPDIR, "shared", "api.md");

// Markdown extension-shorthand path constants (PRD §4.5 rule 3 — T1.S1 resolveImportPath unit tests).
const README_BARE = path.join(TMPDIR, "README");     // exact-match-wins (bare beats README.md)
const README_MD = path.join(TMPDIR, "README.md");    // sibling that must NOT win over bare README
const PRD_MD = path.join(TMPDIR, "PRD.md");          // shorthand fallback target (no bare PRD)
const ONLY_MARKDOWN = path.join(TMPDIR, "only.markdown"); // second-tier fallback (.markdown)
const DOTENV = path.join(TMPDIR, ".env");            // dotfile exact-wins (no .env.md tried in success path)

// countFileBlocks — counts <file name="ABS"> block-openers for `abs` in `text`. Dedupes the inline
// regex-count pattern (escape-special-chars + match length) used across F1/F1c/DUP1/etc.
function countFileBlocks(text, abs) {
  return (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
}

// §5.5 paged-delivery mock ctx — a TIGHT budget so oversize text files page. Huge.log (~2 MB,
// fileCost ~524K) PAGES; a.ts (~97 chars, fileCost ~25) stays WHOLE.
//   remaining = 50000 - 10000 - 8192 - 8192 = 23616;  PAGED_THRESHOLD * remaining = 14169.6
const PAGED_FIX = {
  cwd: TMPDIR,
  getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }),
  model: { contextWindow: 50000, maxTokens: 8192 },
};

// ──────────────────────────────────────────────────────────────────────────────
// 8. The 14 PRD §11 acceptance cases (+ edges + guards).
// ──────────────────────────────────────────────────────────────────────────────
console.log("\nfile-injector.ts — PRD §11 acceptance matrix (model-free)\n");

// Case 1 — single text file; original text preserved; block appended after `---`.
await runCase(1, "single text file injected, original preserved", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text.startsWith("Review a.ts"), "path stays inline as a reference (#@ trigger stripped on inject)");
  assert(r.text.includes("\n\n---\n\n"), "blocks must be appended after a '\\n\\n---\\n\\n' separator");
  const expectedBlock = '<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>';
  assert(r.text.includes(expectedBlock), `expected block to equal the processFileArguments template`);
});

// Case 2 — huge file; ENTIRE content injected, byte-for-byte (no truncation).
await runCase(2, "huge file injected byte-for-byte (no truncation)", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text.includes("\n\n---\n\n"), "separator present");
  const expectedBlock = '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT + '\n</file>';
  assert(
    r.text.endsWith(expectedBlock),
    "block content must equal the ENTIRE fixture byte-for-byte (no truncation)",
  );
  // Explicit length check: proves no silent truncation on a ~2 MB file.
  const blockStart = r.text.indexOf('<file name="' + HUGE + '">');
  const block = r.text.slice(blockStart);
  assert(block.length >= HUGE_LOG_CONTENT.length, "block must contain the full file length");
});

// Case 3 — image: resizeImage→null on tiny PNG → fallback (raw base64, empty-hints block).
await runCase(3, "image attached as ImageContent + reference block", async () => {
  const r = await mod.injectFiles("Describe #@pic.png", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.images.length === 1, `expected 1 image, got ${r.images.length}`);
  const img = r.images[0];
  assert(img.type === "image", `img.type must be 'image', got '${img.type}'`);
  assert(img.mimeType === "image/png", `img.mimeType must be 'image/png', got '${img.mimeType}'`);
  assert(img.data.length > 0, "img.data must be non-empty");
  assert(!img.data.startsWith("data:"), "img.data must NOT have a 'data:' URL prefix (raw base64)");
  // Whole-image parity (fallback path): data === raw base64 of ORIGINAL bytes.
  assert(img.data === PNG_BYTES.toString("base64"), "img.data must equal raw base64 of the original image bytes");
  // Reference block in text.
  assert(r.text.includes('<file name="' + PIC + '">'), "text must reference the image in a <file name=…> block");
  const expectedBlock = '<file name="' + PIC + '"></file>'; // empty hints (resizeImage→null)
  assert(r.text.includes(expectedBlock), "image reference block must have empty hints (resize→null)");
});

// Case 4 — non-image binary: NUL-byte guard → clear note block (no decoded garbage).
await runCase(4, "non-image binary → note block (em dash, no garbage)", async () => {
  const r = await mod.injectFiles("Inspect #@data.bin", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  const expectedBlock =
    '<file name="' + BIN + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
  assert(
    r.text.includes(expectedBlock),
    "binary block body must be exactly the fixed note (em dash U+2014, no decoded garbage bytes)",
  );
});

// Case 5 — missing file: token left verbatim, injected===0, images ref unchanged (merge contract).
await runCase(5, "missing file → token verbatim, injected===0", async () => {
  const orig = [];
  const r = await mod.injectFiles("Fix #@nope.ts", orig, FIX);
  assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
  assert(r.text === "Fix #@nope.ts", "text must be byte-for-byte unchanged when nothing injected");
  assert(r.images === orig, "images must be the ORIGINAL ref when count===0 (merge contract)");
});

// Case 6 — directory: not isFile() → token left verbatim.
await runCase(6, "directory → token verbatim", async () => {
  const r = await mod.injectFiles("List #@src/", [], FIX);
  assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
  assert(r.text === "List #@src/", "directory token must be left verbatim");
});

// Case 7 — mid-word #@: regex requires #@ at start or after non-word → no match.
await runCase(7, "mid-word #@ not matched", async () => {
  const r = await mod.injectFiles("the foo#@bar thing", [], FIX);
  assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
  assert(r.text === "the foo#@bar thing", "text must be unchanged (mid-word #@ not matched)");
});

// Case 8 — markdown heading / issue ref: no #@ substring → no match.
await runCase(8, "markdown heading / #1234 not matched", async () => {
  const r = await mod.injectFiles("# Heading and #1234", [], FIX);
  assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
  assert(r.text === "# Heading and #1234", "text must be unchanged (no #@ present)");
});

// Case 9 — multi-file: both injected in order; handler notify fires with the count.
await runCase(9, "multi-file: both injected in order; notify count", async () => {
  const r = await mod.injectFiles("Diff #@a.ts vs #@b.ts", [], FIX);
  assert(r.injected === 2, `expected injected===2, got ${r.injected}`);
  const ia = r.text.indexOf('<file name="' + A_TS + '">');
  const ib = r.text.indexOf('<file name="' + B_TS + '">');
  assert(ia !== -1 && ib !== -1, "both file blocks must be present");
  assert(ia < ib, "blocks must appear in source order (a.ts before b.ts)");

  // Handler-level: notify fires with the injected count, type 'info'.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must return transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 2 whole", `notify message must be the count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  assert(rec.notify.t === "info", `notify type must be 'info', got '${rec.notify && rec.notify.t}'`);
});

// Case 10 — tilde expansion: #@~/<homefile> resolves into os.homedir().
await runCase(10, "tilde ~/ expanded to os.homedir()", async () => {
  const r = await mod.injectFiles("Read #@~/" + HOME_NOTES_NAME, [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  const expectedPath = path.join(os.homedir(), HOME_NOTES_NAME);
  assert(
    r.text.includes('<file name="' + expectedPath + '">'),
    `block path must be the tilde-expanded home path (${expectedPath})`,
  );
});

// Case 11 — trailing punctuation trimmed by cleanToken → resolves a.ts (not a.ts.).
await runCase(11, "trailing punctuation trimmed", async () => {
  const r = await mod.injectFiles("See #@a.ts.", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text.includes('<file name="' + A_TS + '">'), "must resolve to a.ts (trailing '.' trimmed)");
  assert(!r.text.includes('<file name="' + A_TS + '.">'), "must NOT resolve to 'a.ts.' (punctuation must be trimmed)");
});

// Case 12 — initial -p message: the input event fires for -p too (structural via handler mock),
//           PLUS a documented live-pi integration command.
await runCase(12, "handler transforms interactive input (input event fires for -p)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  // source:"interactive" mirrors the -p path (the input event fires inside prompt() for ALL contexts).
  const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform an interactive #@ prompt, got '${out.action}'`);
  assert(out.text && out.text.includes('<file name="' + A_TS + '">'), "transformed text must contain the injected block");
  assert(rec.notify && rec.notify.m === "#@ injected 1 whole", "notify must fire for the interactive path");
});
integrationCase(
  12,
  "initial CLI -p message (live pi)",
  'pi -e ./file-injector.ts -p "Review #@a.ts"',
  "the prompt the model receives already contains a.ts in a <file name=…> block — confirm via the user-message bubble / transcript (no read tool call).",
);

// Case 13 — format parity vs processFileArguments: per-block TEXT format is byte-identical.
//           (Pi concatenates raw with a trailing "\n"; our assembly joins with "\n\n" under "---".
//            So parity is about the BLOCK, not the assembly — assert our block == the file-processor
//            template MINUS its trailing "\n", which our join owns.)
await runCase(13, "format parity with pi @file (per-block template)", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  // Expected from the processFileArguments template: `<file name="${abs}">\n${content}\n</file>` (no trailing \n).
  const expectedBlock = '<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>';
  assert(r.text.includes(expectedBlock), "our #@ text block must be byte-identical to the pi @file block template");
  // Also assert the pure helper produces the same template (defensive: parity at the formatter level).
  assert(mod.formatTextFileBlock(A_TS, A_TS_CONTENT) === expectedBlock, "formatTextFileBlock must match the template");
});
integrationCase(
  13,
  "end-to-end parity vs pi @file (live pi)",
  'pi @a.ts "x"',
  "emits a block `<file name=\"/abs/a.ts\">\\n<content>\\n</file>` — byte-identical CONTENT to our #13 block (only the per-block trailing \\n / assembly differ).",
);

// Case 14 — bare @ (no #): byte-for-byte unchanged; handler returns continue.
await runCase(14, "bare @ unaffected (no #@)", async () => {
  const orig = [];
  const r = await mod.injectFiles("Review @a.ts", orig, FIX);
  assert(r.injected === 0, `expected injected===0, got ${r.injected}`);
  assert(r.text === "Review @a.ts", "bare @a.ts must be byte-for-byte unchanged");
  assert(r.images === orig, "images ref unchanged (no transform)");

  // Handler: the `!text.includes("#@")` guard → continue, no notify.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review @a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "continue", `handler must continue on bare @ (no #@), got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NOT fire when nothing is injected");
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. Edge cases (PRD §10) + 3 handler guards + headless path.
// ──────────────────────────────────────────────────────────────────────────────
console.log("\nfile-injector.ts — edge cases & guards (PRD §10 / §12)\n");

await runCase("E1", "empty 0-byte file → injected as <file>\\n\\n</file>", async () => {
  const r = await mod.injectFiles("See #@empty.txt", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  const expectedBlock = '<file name="' + EMPTY + '">\n\n</file>';
  assert(r.text.includes(expectedBlock), "empty file must be injected as <file name=…>\\n\\n</file> (NOT skipped)");
});

await runCase("E2", "parenthesized token → trimmed, resolved", async () => {
  const r = await mod.injectFiles("(#@a.txt)", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text.includes('<file name="' + A_TXT + '">'), "token 'a.txt)' must trim to 'a.txt' and resolve");
});

await runCase("E3", "fenced-code-block #@ (documented limitation)", async () => {
  // ACTUAL shipped behavior (verified by running the real injectFiles): the regex DOES match `#@a.ts`
  // inside backticks, but the captured token is `a.ts`` and the trailing backtick is NOT in
  // TRAILING_PUNCT (only ".,;:!?\")]}'"), so cleanToken leaves it, the path `a.ts`` does not exist,
  // and injected===0. This is SAFER than matching-in-and-injecting-garbage; the README (T5.S1) should
  // note that `#@` inside backticks is a known edge — escape with `# @` to suppress.
  const r = await mod.injectFiles("`code #@a.ts`", [], FIX);
  assert(
    r.injected === 0,
    `fenced #@ token carries a trailing backtick that is not trimmed → unresolved → injected===0 (actual shipped behavior; got ${r.injected})`,
  );
  assert(r.text === "`code #@a.ts`", "text must be unchanged when the trailing-backtick path does not resolve");
});

await runCase("E4", "read error (chmod 000) → token verbatim, no throw", async () => {
  if (process.getuid() === 0) {
    // chmod is ineffective when running as root — skip with a note (same caveat P1M1T3S1 used).
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  const secret = path.join(TMPDIR, "secret.txt");
  fsSync.writeFileSync(secret, "top secret\n");
  fsSync.chmodSync(secret, 0o000);
  try {
    const r = await mod.injectFiles("Read #@secret.txt", [], FIX);
    assert(r.injected === 0, `expected injected===0 on unreadable file, got ${r.injected}`);
    assert(r.text === "Read #@secret.txt", "unreadable-file token must be left verbatim");
  } finally {
    fsSync.chmodSync(secret, 0o644); // restore so cleanup can remove it
  }
});

await runCase("G1", "guard: source==='extension' → continue (loop prevention)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts", source: "extension", images: [] }, ctx);
  assert(out.action === "continue", `extension-source must short-circuit to continue, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NOT fire for extension-source input (loop prevention)");
});

await runCase("G2", "guard: streamingBehavior==='steer' → continue (latency)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb(
    { text: "Review #@a.ts", source: "interactive", streamingBehavior: "steer", images: [] },
    ctx,
  );
  assert(out.action === "continue", `steer must short-circuit to continue, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NOT fire for mid-stream steering");
});

await runCase("G3", "guard: no #@ substring → continue (cheap pre-check)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "just a normal prompt", source: "interactive", images: [] }, ctx);
  assert(out.action === "continue", `no-#@ must short-circuit to continue, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NOT fire when there is no #@ token");
});

await runCase("H1", "headless (hasUI===false): transform but notify NEVER called", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR, { hasUI: false });
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `headless must still transform injecting prompts, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NEVER fire when ctx.hasUI===false (print/json mode)");
});

await runCase("M1", "merge contract: user image preserved at [0] when injecting", async () => {
  const userImg = { type: "image", data: "dXNlcg==", mimeType: "image/png" }; // "user" in base64
  const r = await mod.injectFiles("Describe #@pic.png", [userImg], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.images.length === 2, `expected 2 images (user + injected), got ${r.images.length}`);
  assert(r.images[0] === userImg, "user-attached image must be preserved at index [0] (MERGE, not replace)");
  assert(r.images[1].data === PNG_BYTES.toString("base64"), "injected image must be appended at index [1]");
});

// ── F1/F3/F5: regression cases for the validation-report findings ──────────────

await runCase("F1", "F1 — per-token dedup prevents re-injection", async () => {
  // The sentinel mechanism is GONE (P1.M1.T1). Re-injection is now prevented by PER-TOKEN DEDUP
  // inside injectFiles: if a `<file name="<abs>">` block for the resolved path already exists in
  // `text`, the token is skipped — cooperation-independent (works against ANY prior copy, sentinel or
  // not). Simulate a SECOND copy receiving the first copy's already-injected text: (a) injectFiles
  // returns injected===0 with unchanged text; (b) the captured handler short-circuits to `continue`
  // (no notify); and the text retains EXACTLY ONE `<file>` block for a.ts (not two).
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(first.injected === 1, `first pass must inject a.ts (got ${first.injected})`);

  // (a) injectFiles-level: already-injected text → injected===0 (per-token dedup), text unchanged.
  const dedup = await mod.injectFiles(first.text, first.images, FIX);
  assert(dedup.injected === 0, `dedup pass must return injected===0 (got ${dedup.injected})`);
  assert(dedup.text === first.text, "dedup pass must not alter the text (idempotent)");

  // (b) handler-level: the second-copy handler returns continue (injectFiles injected 0), no notify.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: first.text, source: "interactive", images: first.images }, ctx);
  assert(out.action === "continue", `second copy must short-circuit to continue (got '${out.action}')`);
  assert(rec.notify === undefined, "second copy must NOT notify (nothing re-injected)");

  // Exactly ONE <file> block for a.ts in the injected text — the dedup prevented a duplicate.
  const aCount = (dedup.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `injected text must contain exactly 1 <file> block for a.ts (got ${aCount})`);
});

await runCase("F1b", "F1b — co-load: two non-sentinel copies do not double-inject (Issue 1)", async () => {
  // Direct Issue 1 repro at the injectFiles layer. A prior copy (here another injectFiles call, since
  // the sentinel is gone) injects, then a second copy processes the result. Because injectFiles no
  // longer stamps a sentinel, the second copy relies SOLELY on per-token dedup. Assert the second
  // pass injects nothing AND appends no blocks (first.text === second.text).
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(first.injected === 1, `first copy must inject a.ts (got ${first.injected})`);
  const second = await mod.injectFiles(first.text, first.images, FIX);
  assert(second.injected === 0, `second copy must inject nothing — per-token dedup (got ${second.injected})`);
  assert(second.text === first.text, "second copy must append NO additional blocks (first.text === second.text)");
});

await runCase("F1c", "F1c — structural dedup: prior @file block doesn't block a NEW file (multi-file safe)", async () => {
  // Validator finding F-NEW-1, recommendation #2: the dedup now builds a SET of every
  // `<file name="<path>">` already in `text` (whether from a prior #@ copy under the `---` separator
  // or from Pi's own @file argv expander) and skips only those exact paths. This MUST NOT suppress a
  // genuinely-new file in the same prompt: a prior copy injected a.ts; our copy must STILL inject b.ts
  // from the same prompt. This is the regression guard that the structural dedup is not over-aggressive
  // (an earlier draft that keyed on the bare `\n\n---\n\n<file` separator would have wrongly dropped b.ts).
  const priorText = `Review #@a.ts\n\n---\n\n<file name="${A_TS}">\n${A_TS_CONTENT}\n</file>`;
  const r = await mod.injectFiles(`${priorText}\nAlso review #@b.ts`, [], FIX);
  assert(r.injected === 1, `must inject ONLY the new b.ts (a.ts already present), got ${r.injected}`);
  assert(r.text.includes('<file name="' + B_TS + '">'), "must contain the NEW b.ts block");
  // Exactly ONE a.ts block (the pre-existing one) — not re-injected, not duplicated.
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `a.ts must appear exactly once (dedup), got ${aCount}`);
  const bCount = (r.text.match(new RegExp('<file name="' + B_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(bCount === 1, `b.ts must appear exactly once (newly injected), got ${bCount}`);
});

await runCase("F1d", "F1d — co-load: stripping #@ post-inject makes dedup bidirectional (closes F-NEW-1 dedup→legacy gap)", async () => {
  // Originally a validator pin for F-NEW-1 (recommendation #3): exercise a GENUINE mixed pair — a
  // dedup copy followed by a NON-dedup (legacy) copy. The OLD limit was one-directional: a later
  // non-cooperating legacy copy re-injected because the #@ marker survived the dedup pass. Stripping
  // the #@ marker after injection (PRD §6.2) CLOSED that gap — the legacy copy now finds no trigger
  // and cannot re-inject — so this case now asserts the FIXED (bidirectional) behavior. Reverse order
  // (legacy→dedup) was already clean via per-token/structural dedup. Only TWO stale copies (user
  // error) could still double-inject; the single-copy guidance still guards that.
  //
  // A faithful legacy injector: uses the repo's OWN exported formatters (identical block format) but
  // OMITS the dedup line — exactly what the stale 182-line global copy does.
  const legacyInject = async (text, imagesIn, ctx) => {
    const blocks = [];
    const images = [...imagesIn];
    let count = 0;
    const LEGACY_RE = /(^|(?<=\W))#@(\S+)/g; // the pre-fix \W regex
    for (const m of text.matchAll(LEGACY_RE)) {
      const token = mod.cleanToken(m[2]);
      if (!token) continue;
      const abs = mod.expandTildeAndResolve(token, ctx.cwd);
      // NO per-token dedup — this is the bug-relevant legacy behavior
      let st; try { st = await fs.stat(abs); } catch { continue; }
      if (!st.isFile()) continue;
      try { const buf = await fs.readFile(abs); blocks.push(mod.formatTextFileBlock(abs, buf.toString("utf8"))); count++; } catch { continue; }
    }
    if (count === 0) return { text, images: imagesIn, injected: 0 };
    return { text: `${text}\n\n---\n\n${blocks.join("\n\n")}`, images, injected: count };
  };
  // Forward order: dedup copy FIRST, legacy (no-dedup) copy SECOND.
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(first.injected === 1, `dedup copy must inject a.ts once (got ${first.injected})`);
  const legacyAfter = await legacyInject(first.text, first.images, FIX);
  // FIXED (was F-NEW-1): the dedup copy stripped the #@ marker, so the later legacy copy finds no
  // trigger → cannot re-inject. Dedup is now effectively bidirectional for any pair involving a
  // current copy.
  assert(legacyAfter.injected === 0, `legacy copy cannot re-inject — #@ was stripped on the dedup pass (got ${legacyAfter.injected})`);
  const aCount = (legacyAfter.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `order dedup→legacy now yields exactly 1 a.ts block (got ${aCount}); F-NEW-1 gap closed by #@ stripping`);
  // REVERSE order (legacy FIRST, dedup SECOND) MUST stay clean — the dedup copy suppresses the dup.
  const legacyFirst = await legacyInject("Review #@a.ts", [], FIX);
  assert(legacyFirst.injected === 1, `legacy copy alone injects a.ts once (got ${legacyFirst.injected})`);
  const dedupAfter = await mod.injectFiles(legacyFirst.text, legacyFirst.images, FIX);
  assert(dedupAfter.injected === 0, `dedup copy must suppress the legacy dup (got ${dedupAfter.injected})`);
  const aCountRev = (dedupAfter.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCountRev === 1, `reverse order (legacy→dedup) yields exactly 1 a.ts block (got ${aCountRev})`);
});

await runCase("DUP1", "DUP1 — within-prompt same-path repeat injects ONCE (text) (Issue 1)", async () => {
  const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
  assert(r.injected === 1, `same path twice must inject ONCE, got injected=${r.injected}`);
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
});

await runCase("DUP2", "DUP2 — two path forms of the same file inject ONCE (Issue 1)", async () => {
  // 'a.ts' and './a.ts' both resolve to the same absolute path → dedup to one injection.
  const r = await mod.injectFiles("Diff #@a.ts against #@./a.ts", [], FIX);
  assert(r.injected === 1, `two path forms (same file) must inject ONCE, got injected=${r.injected}`);
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
});

await runCase("DUP3", "DUP3 — within-prompt same-image repeat attaches ONCE (Issue 1)", async () => {
  const r = await mod.injectFiles("See #@pic.png and #@pic.png", [], FIX);
  assert(r.images.length === 1, `same image twice must attach ONCE, got images.length=${r.images.length}`);
  const picCount = (r.text.match(new RegExp('<file name="' + PIC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(picCount === 1, `must contain exactly ONE <file> reference block for pic.png, got ${picCount}`);
});

await runCase("F2", "F2 — sentinel string in prompt no longer gates injection (Issue 2)", async () => {
  // Issue 2 regression: the old sentinel guard tested the RAW user prompt and short-circuited on ANY
  // `<!--#@file-injected-->` substring, silently dropping ALL #@ tokens. With the sentinel removed
  // (P1.M1.T1.S2), a prompt containing the literal sentinel string AND a valid #@token must STILL
  // inject the file. (`#@file-injected-->` resolves (after cleanToken trims the trailing `>`) to a
  // missing path and is left verbatim; `#@a.ts` injects.)
  const prompt = '<!--#@file-injected--> Review #@a.ts';
  const r = await mod.injectFiles(prompt, [], FIX);
  assert(r.injected === 1, `a.ts must be injected despite the sentinel string in the prompt (got ${r.injected})`);
  assert(r.text.startsWith('<!--#@file-injected--> Review a.ts'), "only the injected #@a.ts is stripped (→ a.ts); the failed sentinel token keeps its #@ verbatim (Issue 2 fix)");
  assert(r.text.includes('<file name="' + A_TS + '">'), "injected text must contain the a.ts <file> block");
  // Exactly ONE block (a.ts) — no spurious block from the ghost `#@file-injected-->` token.
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `exactly 1 <file> block (a.ts); no ghost block from the sentinel token (got ${aCount})`);

  // Handler-level: the input event transforms (does NOT short-circuit on the sentinel substring).
  const { ctx } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: prompt, source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform (sentinel no longer gates), got '${out.action}'`);
});

await runCase("FS1", "FS1 — mixed success+missing: failed token keeps #@ (Issue 2)", async () => {
  const r = await mod.injectFiles("Review #@a.ts and check #@missing.ts", [], FIX);
  assert(r.injected === 1, `a.ts injected (count=1), got injected=${r.injected}`);
  assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
  assert(r.text.includes("#@missing.ts") === true, `the FAILED #@missing.ts must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `exactly 1 <file> block (a.ts only); missing.ts injected nothing (got ${aCount})`);
});

await runCase("FS2", "FS2 — mixed success+directory: failed token keeps #@ (Issue 2)", async () => {
  const r = await mod.injectFiles("Review #@a.ts and list #@src/", [], FIX);
  assert(r.injected === 1, `a.ts injected (count=1), got injected=${r.injected}`);
  assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
  assert(r.text.includes("#@src/") === true, `the directory token #@src/ must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
});

await runCase("FS3", "FS3 — Issue1×Issue2: deduped repeat keeps #@ (first stripped)", async () => {
  // Same path twice: Issue 1 dedup SKIPS the 2nd (it does not inject); Issue 2 strips #@ only from
  // actually-injected tokens. ⇒ first stripped to a.ts, deduped second KEEPS its #@. One block.
  const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
  assert(r.injected === 1, `same path twice injects ONCE (Issue 1), got injected=${r.injected}`);
  assert(r.text.startsWith("Compare a.ts with #@a.ts"), `first stripped, deduped second keeps #@ (Issue 2), got text=${JSON.stringify(r.text.slice(0, 40))}`);
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `exactly ONE <file> block for a.ts (got ${aCount})`);
});

await runCase("F3a", "F3 — mislabeled image (text body, .png ext) → text path, no garbage image", async () => {
  const r = await mod.injectFiles("See #@fake.png", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  // Must NOT attach an image (no decoded garbage labeled image/png).
  assert(r.images.length === 0, `must attach NO image for a mislabeled file, got ${r.images.length}`);
  // Must inject the text content as a normal text <file> block (content includes its own trailing \n,
  // so the block is `<file>\n<content>\n</file>` = `<file>\n...text\n\n</file>`).
  const expected = '<file name="' + FAKE_PNG + '">\nthis is not really a PNG, just text\n\n</file>';
  assert(r.text.includes(expected), "mislabeled image must fall through to the text <file> block (its actual content)");
});

await runCase("F3b", "F3 — hasValidImageMagic accepts real PNG, rejects text/random bytes", async () => {
  assert(mod.hasValidImageMagic(PNG_BYTES, "image/png") === true, "real PNG bytes must pass the png sniff");
  assert(mod.hasValidImageMagic(Buffer.from("not a png"), "image/png") === false, "text bytes must fail the png sniff");
  assert(mod.hasValidImageMagic(Buffer.alloc(8), "image/png") === false, "too-short buffer must fail the sniff");
  // A real JPEG header (FF D8 FF E0) must pass.
  assert(mod.hasValidImageMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0,0,0,0,0,0,0,0]), "image/jpeg") === true, "real JPEG header must pass the jpeg sniff");
});

await runCase("F5", "F5 — 0-byte image file → note block, NO empty ImageContent attached", async () => {
  const r = await mod.injectFiles("See #@empty.png", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  // Must attach NO image (the whole point — an empty ImageContent would be rejected by providers).
  assert(r.images.length === 0, `0-byte image must attach NO image, got ${r.images.length}`);
  // Must emit a note block referencing the file (consistent with the binary/empty-text conventions).
  const expected = '<file name="' + EMPTY_PNG + '"><empty image file \u2014 0 bytes; nothing to attach></file>';
  assert(r.text.includes(expected), "0-byte image must produce the empty-image note block");
});

await runCase("F4", "F4 — notify wording (1 whole / N whole)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 1 whole", `singular prompt must say '1 whole', got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  const { ctx: ctx2, rec: rec2 } = makeMockCtx(TMPDIR);
  const slot2 = captureHandler();
  await slot2.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx2);
  assert(rec2.notify && rec2.notify.m === "#@ injected 2 whole", `plural prompt must say '2 whole', got ${JSON.stringify(rec2.notify && rec2.notify.m)}`);
});

// ── U1: Unicode word-boundary regression (Issue 5) ────────────────────────────
await runCase("U1", "U1 — Unicode word-boundary: #@ does not fire mid-word in any language", async () => {
  // Issue 5 regression guard. FILE_INJECT_RE is now /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu (P1.M1.T2.S1): the
  // `u` flag enables Unicode property escapes, and the negative lookbehind treats Unicode letters /
  // numbers / underscore as word chars. So #@ no longer triggers after non-ASCII letters (é, ö, ñ, CJK,
  // …). Each sub-assert calls injectFiles and checks BOTH r.injected and r.text (verbatim for no-match).
  // (a) THE FIX: é is a Unicode letter → #@ is mid-word in café#@a.ts → NO match → injected===0, text verbatim.
  let r = await mod.injectFiles("café#@a.ts", [], FIX);
  assert(r.injected === 0, `(a) café#@a.ts must NOT inject (é is a Unicode letter, mid-word), got ${r.injected}`);
  assert(r.text === "café#@a.ts", `(a) café#@a.ts text must be unchanged when not matched`);
  // (b) THE FIX: CJK characters are Unicode letters → 日本語#@a.ts is mid-word → NO match → injected===0, text verbatim.
  r = await mod.injectFiles("日本語#@a.ts", [], FIX);
  assert(r.injected === 0, `(b) 日本語#@a.ts must NOT inject (CJK are Unicode letters, mid-word), got ${r.injected}`);
  assert(r.text === "日本語#@a.ts", `(b) 日本語#@a.ts text must be unchanged when not matched`);
  // (c) REGRESSION GUARD: a SPACE before #@ is a boundary → Review #@a.ts still injects → injected===1.
  r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `(c) Review #@a.ts must inject (space before #@ is a boundary), got ${r.injected}`);
  assert(r.text.startsWith("Review a.ts"), `(c) path stays inline as a reference (#@ trigger stripped on successful inject)`);
  assert(r.text.includes('<file name="' + A_TS + '">'), `(c) injected text must contain the a.ts <file> block`);
  // (d) REGRESSION GUARD: start-of-string (^ alternation) → #@a.ts still injects → injected===1.
  r = await mod.injectFiles("#@a.ts", [], FIX);
  assert(r.injected === 1, `(d) #@a.ts must inject (start-of-string boundary), got ${r.injected}`);
  assert(r.text.includes('<file name="' + A_TS + '">'), `(d) injected text must contain the a.ts <file> block`);
  // (e) REGRESSION GUARD: ASCII mid-word is STILL blocked → foo#@bar → NO match → injected===0, text verbatim.
  r = await mod.injectFiles("foo#@bar", [], FIX);
  assert(r.injected === 0, `(e) foo#@bar must NOT inject (ASCII mid-word, still blocked), got ${r.injected}`);
  assert(r.text === "foo#@bar", `(e) foo#@bar text must be unchanged when not matched`);
});

// ── A1: #@ autocomplete reuses pi's @ file engine via line-rewrite (Option 1) ─────
// The factory also registers a `session_start` handler that installs an autocomplete provider via
// ctx.ui.addAutocompleteProvider, so `#@` gets path completion by reusing pi's built-in `@` engine
// (PRD §14). Option 2 (gate override) was tried and produced nothing — reverted. This case pins
// the shipped Option 1 behavior: rewrite '#'→space, delegate, remap prefix/items back to #@, and a
// deterministic applyCompletion for #@ prefixes. Headless-guarded (no ctx.ui → no-op).
await runCase("A1", "A1 — #@ autocomplete: rewrites '#'→space for built-in, remaps result to #@, deterministic apply", async () => {
  const slot = captureHandler("session_start");
  assert(typeof slot.cb === "function", "factory must register a session_start handler");

  // Headless guard: no ctx.ui.addAutocompleteProvider → no-op, must not throw.
  await slot.cb({}, { cwd: TMPDIR });
  await slot.cb({}, { cwd: TMPDIR, ui: {} });

  // Fake built-in: simulates pi's @ file completion. Captures the lines it received and returns
  // file items whose prefix/value carry the '@' (as pi does), so we can assert the #@ remap.
  let seenLines = null;
  const fakeCurrent = {
    getSuggestions: async (lines) => { seenLines = lines.map((l) => l.slice()); return { prefix: "@src/", items: [{ value: "@src/index.ts", label: "index.ts", description: "" }, { value: "@src/util.ts", label: "util.ts", description: "" }] }; },
    applyCompletion: (lines, line, col) => ({ lines, cursorLine: line, cursorCol: col }),
    shouldTriggerFileCompletion: () => false,
  };
  let providerFactory = null;
  const ctx = { cwd: TMPDIR, ui: { addAutocompleteProvider: (f) => { providerFactory = f; } } };
  await slot.cb({}, ctx);
  assert(typeof providerFactory === "function", "session_start must call ctx.ui.addAutocompleteProvider with a factory");

  const provider = providerFactory(fakeCurrent);
  assert(Array.isArray(provider.triggerCharacters) && provider.triggerCharacters.includes("@"),
    `triggerCharacters must include "@" (got ${JSON.stringify(provider.triggerCharacters)})`);

  // getSuggestions: #@<partial> → rewrite '#' to space, delegate, remap to #@.
  const out = await provider.getSuggestions(["Review #@src/"], 0, "Review #@src/".length, { signal: { aborted: false } });
  assert(seenLines && seenLines[0] === "Review  @src/", `built-in must see '#' rewritten to space, got ${JSON.stringify(seenLines && seenLines[0])}`);
  assert(out && out.prefix === "#@src/", `prefix must be remapped to '#@src/', got ${JSON.stringify(out && out.prefix)}`);
  assert(out && out.items.length === 2 && out.items.every((it) => it.value.startsWith("#@")), `every item value must be remapped to start with '#@' (got ${JSON.stringify(out && out.items.map((i) => i.value))})`);
  assert(out.items[0].value === "#@src/index.ts", `first item value must be '#@src/index.ts', got ${out.items[0].value}`);

  // Non-#@ input delegates to the built-in UNCHANGED (no rewrite, no remap — prefix stays '@src/').
  const out2 = await provider.getSuggestions(["Review @src/"], 0, "Review @src/".length, { signal: { aborted: false } });
  assert(out2 && out2.prefix === "@src/", "non-#@ must delegate to built-in unchanged (prefix '@src/', not remapped)");

  // applyCompletion: #@ prefix → deterministic replace; cursor lands after the inserted value.
  const applied = provider.applyCompletion(["Review #@src/"], 0, "Review #@src/".length, { value: "#@src/index.ts", label: "index.ts" }, "#@src/");
  assert(applied.lines[0] === "Review #@src/index.ts", `apply must produce 'Review #@src/index.ts', got ${JSON.stringify(applied.lines[0])}`);
  assert(applied.cursorCol === "Review #@src/index.ts".length, `cursor must land at end of inserted value (got ${applied.cursorCol})`);

  // applyCompletion: non-#@ prefix delegates to the built-in (returns defined value).
  const delegated = provider.applyCompletion(["x"], 0, 1, { value: "y", label: "y" }, "z");
  assert(delegated !== undefined, "non-#@ apply must delegate to built-in (return defined)");
});

// ── PAGED DELIVERY (PRD §5.5) — budget-aware inline-vs-paged ────────────────────────────

await runCase("PD1", "§5.5 paged: huge.log under tight budget → head + directive, paged=1, NO LINE GAP (Finding 1)", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 1, `huge.log delivered (count includes paged), got injected=${r.injected}`);
  assert(r.paged === 1, `huge.log must be PAGED under PAGED_FIX, got paged=${r.paged}`);
  // head block = first HEAD_CHARS (8192) of the content (UTF-16 code units; surrogate-safe)
  const expectedHead = '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT.slice(0, 8192) + '\n</file>';
  assert(r.text.includes(expectedHead), "paged head block must contain the first 8192 chars");
  // directive block = the exported helper's output. startLine = (newlines in head) + 1 and
  // injectedLines = (newlines in head) — complete lines only; a partial trailing line is re-read,
  // never lost. Finding 1: the directive must resume at exactly the line AFTER the complete head
  // lines, for ANY line length — not a hardcoded offset:2001 (which silently loses content).
  const head = HUGE_LOG_CONTENT.slice(0, 8192);
  let nl = 0; for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 10) nl++;
  const injectedLines = nl;
  const expectedStart = nl + 1;
  const expectedDirective = mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length, expectedStart, injectedLines);
  assert(r.text.includes(expectedDirective),
    `paged directive must resume at offset:${expectedStart} (head=${injectedLines} complete lines), got directive=${JSON.stringify((r.text.match(/<file name="[^"]*huge.log"><paged:[\s\S]*?<\/file>/) || [])[0])}`);
  // CORRECTNESS PROBE (closes Coverage Gap #1): simulate the model following the directive and assert
  // ZERO lines are skipped. Union {complete head lines ∪ offset-stepped reads of READ_LIMIT} must cover
  // all lines. This is what validate.sh's discovery probe does — it is how Finding 1 was caught. The
  // old hardcoded offset:2001 failed here for huge.log (lost lines 113–2000); the computed offset passes.
  const total = HUGE_LOG_CONTENT.split("\n").length;
  const seen = new Set();
  for (let i = 1; i <= injectedLines; i++) seen.add(i);
  for (let off = expectedStart; off <= total; off += 2000) for (let k = 0; k < 2000; k++) seen.add(off + k);
  let lost = 0, first = -1;
  for (let i = 1; i <= total; i++) if (!seen.has(i)) { lost++; if (first < 0) first = i; }
  assert(lost === 0, `directive + head must cover every line; ${lost} of ${total} lines never delivered (first gap at line ${first}); Finding 1 regression`);
  // #@ stripped from the injected marker; the path stays
  assert(r.text.startsWith("Summarize huge.log"), "#@huge.log must be stripped to huge.log (path stays)");
  assert(r.images.length === 0, "text-file paging attaches NO images");
});

await runCase("PD2", "§5.5 mixed: small whole + large paged under tight budget", async () => {
  const r = await mod.injectFiles("Review #@a.ts and #@huge.log", [], PAGED_FIX);
  assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly one paged (huge.log), got paged=${r.paged}`);
  // a.ts WHOLE (its full content block present), huge.log paged (head + directive present)
  assert(r.text.includes('<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>'),
    "a.ts must be injected WHOLE (fits budget)");
  assert(r.text.includes('<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT.slice(0, 8192) + '\n</file>'),
    "huge.log must be paged (head block)");
  assert(r.text.includes((function(){const h=HUGE_LOG_CONTENT.slice(0,8192);let nl=0;for(let i=0;i<h.length;i++)if(h.charCodeAt(i)===10)nl++;return mod.formatPagedDirectiveBlock(HUGE,HUGE_LOG_CONTENT.length,nl+1,nl);})()),
    "huge.log directive block present (startLine + injectedLines derived from actual head line count)");
});

await runCase("PD3", "§5.5 O-1 fallback: budget unknown (FIX) → huge.log injected WHOLE, paged=0", async () => {
  // The existing FIX mock has no getContextUsage → remainingBudget null → O-1 fallback → inline.
  // Complements case #2 (byte-equality) by asserting the paged FIELD directly.
  const r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
  assert(r.injected === 1, `huge.log delivered whole under no budget, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging when budget unknown (O-1 fallback), got paged=${r.paged}`);
  assert(r.text.includes('<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT + '\n</file>'),
    "huge.log must be the FULL content block (not a head slice) under the O-1 fallback");
});

await runCase("PD4", "§5.5 images unaffected by budget: pic.png attaches under PAGED_FIX", async () => {
  // Paging is TEXT-only (PRD §5.5 Scope). An image under a tight budget still attaches.
  const r = await mod.injectFiles("Describe #@pic.png", [], PAGED_FIX);
  assert(r.injected === 1, `image delivered, got injected=${r.injected}`);
  assert(r.paged === 0, `images are never paged, got paged=${r.paged}`);
  assert(r.images.length === 1, `image attached under PAGED_FIX, got ${r.images.length}`);
  assert(r.text.includes('<file name="' + PIC + '">'), "image reference block present");
});

await runCase("PD5", "§5.5 binaries unaffected by budget: data.bin note under PAGED_FIX", async () => {
  // Paging is TEXT-only. A binary under a tight budget still gets the binary note (no bytes).
  const r = await mod.injectFiles("Inspect #@data.bin", [], PAGED_FIX);
  assert(r.injected === 1, `binary delivered, got injected=${r.injected}`);
  assert(r.paged === 0, `binaries are never paged, got paged=${r.paged}`);
  assert(r.images.length === 0, `binary attaches NO image, got ${r.images.length}`);
  const expectedNote = '<file name="' + BIN + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
  assert(r.text.includes(expectedNote), "binary note block present (unaffected by budget)");
});

// ── PAGED DIRECTIVERY (Findings 1–3 from the validation report) ───────────────────────
// PD6–PD8 close Coverage Gaps #2/#3 (byte-head-vs-line-window alignment; small-file-paged edge).
// These are the exact scenarios validate.sh used to DISCOVER Findings 1–3; they now assert the FIX.

// A TINY budget so even a small file trips the page threshold (PAGED_THRESHOLD * remaining is small).
//   remaining = 6000 - 500 - 8192 - 8192 = < 0 → clamped to 0 → PAGED_THRESHOLD * 0 = 0
//   ⇒ any file with fileCost > 0 (i.e. any non-empty text file) PAGES.
const TINY_FIX = {
  cwd: TMPDIR,
  getContextUsage: () => ({ tokens: 500, contextWindow: 6000, percent: 8 }),
  model: { contextWindow: 6000, maxTokens: 8192 },
};

await runCase("PD6", "§5.5 Finding 2: sub-head-sized file under tight budget → WHOLE, no spurious directive", async () => {
  // Finding 2: a file ≤ HEAD_CHARS (8192) that pages ONLY because of a very tight budget previously
  // got a head block equal to its ENTIRE content PLUS a 'read the rest' directive pointing past EOF
  // (offset:2001) → the read tool would throw 'Offset beyond end of file'. Fixed: when the whole
  // content fits the head slice, inject whole and do not page (no directive, paged=0).
  const small = path.join(TMPDIR, "small.txt");
  fsSync.writeFileSync(small, "AB".repeat(2000)); // 4000 chars, single line, < HEAD_CHARS
  try {
    const r = await mod.injectFiles("Read #@small.txt", [], TINY_FIX);
    assert(r.injected === 1, `small.txt delivered, got injected=${r.injected}`);
    assert(r.paged === 0, `small.txt must NOT page (content fits head) — no spurious directive, got paged=${r.paged}`);
    // The WHOLE content is injected inline (head block = full content).
    const expectedBlock = '<file name="' + small + '">\n' + "AB".repeat(2000) + '\n</file>';
    assert(r.text.includes(expectedBlock), "whole content must be injected inline (no head slice)");
    // And NO directive block is emitted (would point past EOF).
    assert(!r.text.includes("<paged:"), "no paged directive for a sub-head-sized file (Finding 2)");
  } finally {
    fsSync.rmSync(small, { force: true });
  }
});

// PD-SUBHEAD-BUDGET (validator F1): the sub-head-guard branch (content ≤ HEAD_CHARS after tripping
// the page threshold) must subtract fileCost — like the whole path. F1 is a budget-accounting
// consistency fix with NO single-call externally-observable behavior change (the report rates it
// low-medium: the sub-head guard always delivers whole by design (Finding 2), so whether subtract
// ran or not, injected/paged/the emitted blocks are identical for any one injectFiles call). The
// effect only compounds internally across many files. We therefore pin the fix structurally: read
// the emitText source and assert the sub-head-guard branch contains a subtract(state, fileCost)
// call (matching the whole branch). This is a regression guard against the one-line fix being
// reverted, and documents WHY no behavioral case can distinguish it.
await runCase("PD-SUBHEAD-BUDGET", "§5.6.2 sub-head guard subtracts fileCost (source-level regression guard) [F1]", async () => {
  const src = fsSync.readFileSync(path.join(process.cwd(), "file-injector.ts"), "utf8");
  // locate emitText and inspect only its body
  const fnStart = src.indexOf("function emitText(");
  assert(fnStart !== -1, "emitText must exist in file-injector.ts");
  const fnBody = src.slice(fnStart, src.indexOf("\n}", fnStart) + 2);
  // the sub-head-guard branch is `if (content.length <= HEAD_CHARS) {` — find it
  const guardIdx = fnBody.indexOf("content.length <= HEAD_CHARS");
  assert(guardIdx !== -1, "sub-head guard branch must exist in emitText");
  const guardBlock = fnBody.slice(guardIdx, fnBody.indexOf("} else {", guardIdx));
  assert(guardBlock.includes("subtract(state, fileCost)"),
    `sub-head guard must call subtract(state, fileCost) — F1 fix present in: ${JSON.stringify(guardBlock)}`);
});

await runCase("PD7", "§5.5 Finding 1: long-lined file (head < 1 line) → directive offset derived from head, 0% loss", async () => {
  // Finding 1 worst case: a file of 10001-char lines. The 8192-char head contains LESS than one
  // complete line, so the old hardcoded offset:2001 pointed past EOF → 100% data loss. The fix derives
  // startLine from the ACTUAL head line count (1 for a head that ends mid-first-line), so the model
  // re-reads line 1 onward — at most redundant, never data loss.
  const longlines = path.join(TMPDIR, "longlines.log");
  const LL_LINE = "X".repeat(10000);
  const LL_CONTENT = (LL_LINE + "\n").repeat(300);
  fsSync.writeFileSync(longlines, LL_CONTENT);
  try {
    const r = await mod.injectFiles("Summarize #@longlines.log", [], PAGED_FIX);
    assert(r.injected === 1, `longlines.log delivered, got injected=${r.injected}`);
    assert(r.paged === 1, `longlines.log must be PAGED, got paged=${r.paged}`);
    // The head ends mid-first-line → 0 complete lines (no newline in head) → injectedLines=0,
    // startLine=1 (model re-reads from line 1; line 1's tail is redundant, lines 2–300 are new).
    assert(r.text.includes("offset:1, limit:2000"),
      `long-lined file: directive must resume at offset:1 (head ends mid-first-line), not offset:2001; got text=${JSON.stringify((r.text.match(/<file name="[^"]*longlines.log"><paged:[\s\S]*?<\/file>/) || [])[0])}`);
    // CORRECTNESS PROBE: following the directive covers every line (0 lost). The old code lost all 301.
    const total = LL_CONTENT.split("\n").length; // 301 (trailing empty after final \n)
    const seen = new Set();
    for (let off = 1; off <= total; off += 2000) for (let k = 0; k < 2000; k++) seen.add(off + k);
    let lost = 0;
    for (let i = 1; i <= total; i++) if (!seen.has(i)) lost++;
    assert(lost === 0, `following the directive must cover every line; ${lost} of ${total} lost (was 100% before the fix)`);
  } finally {
    fsSync.rmSync(longlines, { force: true });
  }
});

await runCase("PD8", "§5.5 Finding 3: head slice is surrogate-safe (no lone trailing surrogate)", async () => {
  // Finding 3: content.slice(0, HEAD_CHARS) can land between a surrogate pair, emitting a lone
  // high surrogate as the last char of the head block (malformed UTF-16). The fix backs up past the
  // pair. Build a fixture where HEAD_CHARS (8192) falls exactly inside a surrogate pair.
  // '😀' is U+1F600 → surrogate pair (0xD83D 0xDE00); two UTF-16 code units per emoji.
  const EMOJI = "\uD83D\uDE00"; // 😀
  // 4095 emoji = 8190 code units; + one ASCII char (8191) + first surrogate of next emoji (8192)
  // → the naive slice(0,8192) ends on a lone high surrogate. headSlice must back up to 8191.
  const body = EMOJI.repeat(4095) + "A" + EMOJI.repeat(100); // head boundary lands mid-pair at index 8192
  const emojiFile = path.join(TMPDIR, "emoji.txt");
  // Pad so the file is larger than HEAD_CHARS (so it pages). Use TINY_FIX so even this modestly-sized
  // file trips the page threshold (any non-empty text file pages under TINY_FIX).
  const padded = body + "\n" + "x".repeat(20000);
  fsSync.writeFileSync(emojiFile, padded);
  try {
    const r = await mod.injectFiles("Read #@emoji.txt", [], TINY_FIX);
    assert(r.injected === 1, `emoji.txt delivered, got injected=${r.injected}`);
    assert(r.paged === 1, `emoji.txt must be PAGED, got paged=${r.paged}`);
    // Extract the head block content and assert its last code unit is NOT a lone high surrogate.
    const m = r.text.match(new RegExp('<file name="' + emojiFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">\\n([\\s\\S]*?)\\n</file>'));
    assert(m, "head block must be present");
    const head = m[1];
    const last = head.charCodeAt(head.length - 1);
    const prev = head.charCodeAt(head.length - 2);
    const isLoneHigh = last >= 0xD800 && last <= 0xDBFF && !(prev >= 0xDC00 && prev <= 0xDFFF);
    assert(!isLoneHigh, `head must not end on a lone high surrogate (last=0x${last.toString(16)}); Finding 3 surrogate-safe slice`);
    // The head must still be ~HEAD_CHARS (backing up at most 1 unit from the surrogate-safe slice).
    assert(Math.abs(head.length - 8192) <= 1, `head length must be 8191–8192 after surrogate-safe slice, got ${head.length}`);
  } finally {
    fsSync.rmSync(emojiFile, { force: true });
  }
});

// PD-TEMPLATE pins the PRD §6.1 directive template EXACTLY (validator F2: the paged-directive wording
// must match the spec, and the length must be labeled "chars" not "bytes"). The earlier tests called
// mod.formatPagedDirectiveBlock(...) and so passed against any output; this asserts the literal string.
await runCase("PD-TEMPLATE", "§6.1 paged directive block matches the PRD template exactly (chars, not bytes) [F2]", async () => {
  const abs = "/abs/huge.log";
  const got = mod.formatPagedDirectiveBlock(abs, 524288, 2001, 2000);
  // PRD §6.1: `<paged: <len> chars; head delivered <injectedLines> complete lines; read the rest with
  // the read tool at offset:<startLine>, limit:2000, incrementing offset by 2000 until done>`
  const expected = '<file name="' + abs + '"><paged: 524288 chars; head delivered 2000 complete lines; read the rest with the read tool at offset:2001, limit:2000, incrementing offset by 2000 until done></file>';
  assert(got === expected, `directive must equal the PRD §6.1 template, got ${JSON.stringify(got)}`);
  assert(!got.includes("bytes"), "directive must NOT label the length as 'bytes' (it is a char/code-unit count) [F2]");
  assert(!got.includes("<large file"), "directive must NOT use the legacy '<large file' wording [F2]");
});

// ──────────────────────────────────────────────────────────────────────────────
// ── §5.5 HANDLER NOTIFY (PRD §5.5 Notify) — mode-aware notify via the input handler ──────
// The handler now destructures `paged` from injectFiles and reports whole-vs-paged mode. The existing
// notify cases (F4 pluralization, #9 multi-file, #12 interactive, H1 headless) use a budget-less ctx →
// paged is always 0 → they exercise the paged===0 path (unified "N whole" wording).
// PN1–PN4 cover the paged>0 path and the headless guard under paging. PN2/PN3/PN4 build a budget-aware
// mock ctx that MERGES makeMockCtx's notify-recording ui+hasUI with PAGED_FIX's tight budget (the two
// existing mocks are complementary: makeMockCtx has ui but no budget; PAGED_FIX has budget but no ui).

await runCase("PN1", "§5.5 notify: all-whole prompt (no budget) → 'N whole' (unified whole style)", async () => {
  // No budget → injectFiles O-1 fallback → all whole → paged=0 → unified "N whole" message.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 2 whole",
    `paged===0 uses the unified whole style, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  assert(rec.notify.t === "info", `notify type must be 'info', got '${rec.notify && rec.notify.t}'`);
});

await runCase("PN2", "§5.5 notify: mixed prompt (tight budget) → '1 whole, 1 paged'", async () => {
  // Merged ctx: makeMockCtx's notify-recording ui + hasUI, + PAGED_FIX's tight budget.
  // a.ts (small, ~90 chars) → WHOLE; huge.log (~2 MB) → PAGED. injected=2, paged=1, whole=1.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts and #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 1 whole, 1 paged",
    `mixed prompt must report whole + paged counts, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

await runCase("PN3", "§5.5 notify: all-paged prompt (tight budget) → '0 whole, 1 paged'", async () => {
  // Only huge.log, tight budget → PAGED. injected=1, paged=1, whole=0.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 0 whole, 1 paged",
    `all-paged prompt must report 0 whole + paged count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

await runCase("PN4", "§5.5 notify: headless (hasUI===false) + tight budget → notify NEVER called", async () => {
  // The hasUI guard must suppress notify even on the paged>0 path (huge.log paged).
  const { ctx: base, rec } = makeMockCtx(TMPDIR, { hasUI: false });
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must still transform when headless, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NEVER fire when ctx.hasUI===false, even under paging");
});

// ──────────────────────────────────────────────────────────────────────────────
// ── CODE-REGION DETECTION (PRD §5.6.1) — computeCodeRanges/inCode, approximate CommonMark ─
// Pure functions: call mod.computeCodeRanges/mod.inCode DIRECTLY with literal strings (no fs fixtures).
// Each expected `#@` index is DERIVED via the same FILE_INJECT_RE scanTokens uses, to avoid off-by-one.
// `inCode(idx, ranges) === true` means a `#@` at that index WOULD be skipped by scanTokens(skipCode:true).
const FILE_INJECT_RE_TEST = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
function indexOfFirstHash(txt) {
  const m = [...txt.matchAll(FILE_INJECT_RE_TEST)][0];
  return m ? m.index : -1;
}

await runCase("CC1", "§5.6.1 — #@ inside a fenced block IS in code (skipped)", async () => {
  const txt = "```\n#@fenced.ts\n```";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside a fenced block must be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC2", "§5.6.1 — #@ inside an inline backtick span IS in code (skipped)", async () => {
  const txt = "see `#@inline.ts` here";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside an inline code span must be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC3", "§5.6.1 — #@ in plain prose is NOT in code (imported normally)", async () => {
  const txt = "review #@prose.md please";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ in prose must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC4", "§5.6.1 — unterminated fence → range to EOF; #@ after the open fence IS in code", async () => {
  // The opening fence is never closed → it consumes the rest (CommonMark). The #@ lies inside.
  const txt = "```\n#@unterminated.ts\nmore body";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(r.length === 1 && r[0][1] === txt.length,
    `unterminated fence must run to EOF (ranges=${JSON.stringify(r)})`);
  assert(mod.inCode(idx, r) === true,
    `#@ after an unterminated open fence must be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC5", "§5.6.1 — tilde fence does NOT close a backtick fence (other char is literal)", async () => {
  // ``` opens a backtick block; a ~~~ line is LITERAL (does not close). The real closer is the trailing ```.
  // The #@ BEFORE the real closer is therefore INSIDE the block → in code.
  const txt = "```\ncode\n~~~\n#@inside.ts\n```";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `tilde fence must not close a backtick fence; #@ before the real close is in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC6", "§5.6.1 — closing fence with trailing content (` ```foo `) does NOT close (strict CommonMark)", async () => {
  // A ```foo line is an INFO-STRING line, NOT a closer. So the block is UNTERMINATED → the #@ is in code.
  // (Pin: the only thing that must NOT happen is a closer being detected too early. Here the block never
  // closes, so the #@ is correctly in code. The paired positive case — a ```foo line wrongly treated as a
  // close followed by a #@ that should NOT be in code — is CC7.)
  const txt = "```\ncode\n```foo\n#@stillinside.ts";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `a line with trailing content does not close; #@ stays in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC7", "§5.6.1 — info-string line closes nothing; a real closer AFTER it reopens/closes correctly", async () => {
  // Block 1 opens with ```ruby. The ```ruby line is the OPENER (info strings allowed on open). A later
  // plain ``` closes it. A #@ AFTER that real close is in PROSE → NOT in code. This proves a ```-plus-word
  // line on OPEN is fine, while the STRICT close rule (CC6) only forbids trailing content on the CLOSER.
  const txt = "```ruby\ncode\n```\n#@afterclose.md";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ after a real close must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC8", "§5.6.1 — double-backtick span containing a single backtick is ONE range", async () => {
  // `` `#@x` `` — the OUTER double-backtick span contains an inner single backtick; the whole span (incl.
  // the inner backticks and the #@) is ONE code range → inCode(index of #@) === true.
  const txt = "a `` `#@nested.ts` `` b";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside a double-backtick span is in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC9", "§5.6.1 — inCode: index before first range, after last, and in a gap all return false", async () => {
  // "prose `a` more ```\ncode\n``` tail" — index 0 is prose 'p'; the inline span + fenced block are
  // the code ranges; the gap word "more" and the trailing "tail" are NOT in code.
  const txt = "prose `a` more ```\ncode\n``` tail";
  const r = mod.computeCodeRanges(txt);
  // index 0 is plain prose ('p' of "prose") → not in any range.
  assert(mod.inCode(0, r) === false, `index 0 is plain prose → not in code (ranges=${JSON.stringify(r)})`);
  // An index well beyond EOF is not in any range.
  assert(mod.inCode(txt.length + 1000, r) === false, "index past EOF is not in code");
  // The literal substring " more " between the inline span and the fence is a prose gap.
  const gapIdx = txt.indexOf("more");
  assert(mod.inCode(gapIdx, r) === false, `index in a prose gap is not in code (gapIdx=${gapIdx}, ranges=${JSON.stringify(r)})`);
});

// ──────────────────────────────────────────────────────────────────────────────
// ── TOTAL-SIZE BUDGET (PRD §5.6.2) — image/binary consume remaining ──────────
// EIT = Estimate Image Tokens (pure unit cases pinning the 512-tile formula).
// BG  = Budget interaction (under PAGED_FIX, prove image/binary/empty-image consumed budget so a
//         later large text file pages). The tiny 1×1 pic.png fixture makes resizeImage return null
//         deterministically → estimateImageTokens takes the IMAGE_FALLBACK (2805) path in BG1; that is
//         the EXPECTED cost (the formula path is covered directly by EIT1–EIT3 with fake objects).
await runCase("EIT1", "§5.6.2 — estimateImageTokens(null) === IMAGE_FALLBACK_TOKENS (2805, raw-base64 path)", async () => {
  // null resized = resizeImage could not process the bytes → the raw-base64 fallback path.
  assert(mod.estimateImageTokens(null) === 2805, "null resized must yield IMAGE_FALLBACK_TOKENS (2805)");
});

await runCase("EIT2", "§5.6.2 — estimateImageTokens: 512×512 / 1×1 === 255 (1·1·170+85)", async () => {
  // Exactly 512px per side = 1 tile each → 1·1·170+85 = 255. A sub-tile 1×1 also clamps to 1 tile/side.
  assert(mod.estimateImageTokens({ width: 512, height: 512 }) === 255,
    "512×512 must yield 255 (1·1·170+85)");
  assert(mod.estimateImageTokens({ width: 1, height: 1 }) === 255,
    "1×1 must clamp to 1 tile/side → 255 (Math.max(1,·) guard)");
});

await runCase("EIT3", "§5.6.2 — estimateImageTokens: 513×513 === 765, 2000×2000 === 2805 (derives the constant)", async () => {
  // 513px spills to 2 tiles/side → 2·2·170+85 = 765. 2000px (resizeImage's longest-edge cap) → 4
  // tiles/side → 4·4·170+85 = 2805, which MUST equal IMAGE_FALLBACK_TOKENS (proves the constant's origin).
  assert(mod.estimateImageTokens({ width: 513, height: 513 }) === 765,
    "513×513 must yield 765 (2·2·170+85)");
  assert(mod.estimateImageTokens({ width: 2000, height: 2000 }) === 2805,
    "2000×2000 must yield 2805 (= IMAGE_FALLBACK_TOKENS; 4·4·170+85)");
});

await runCase("BG1", "§5.6.2 — image + huge.log under PAGED_FIX: image consumed budget, huge.log paged (emission order)", async () => {
  // Shared-budget interaction: the image is decided FIRST (emission order is source order), its 2805
  // cost is subtracted from remaining, THEN huge.log is decided against the shrunken remaining.
  // remaining under PAGED_FIX = 50000 - 10000 - 8192 - 8192 = 23616; after pic.png subtract 2805 → 20811;
  // 0.6·20811 = 12486.6; huge.log fileCost = ⌈2097152/4⌉ = 524288 >> 12486.6 → PAGED. The image is
  // NEVER paged (attached). The EIT1–EIT3 pure cases PIN the 2805 cost value, so 'image consumed
  // budget' is structurally entailed: huge.log's decision ran after the subtract and it paged.
  const r = await mod.injectFiles("Describe #@pic.png and summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly one paged (huge.log; image never pages), got paged=${r.paged}`);
  assert(r.images.length === 1, `pic.png attached (never paged), got images=${r.images.length}`);
  // Emission order: the image reference block appears BEFORE the huge.log head block (pic.png was
  // decided first, budget consumed, THEN huge.log decided against the reduced remaining).
  const imgIdx = r.text.indexOf('<file name="' + PIC + '">');
  const hugeHeadIdx = r.text.indexOf('<file name="' + HUGE + '">\n');
  assert(imgIdx !== -1, "image reference block must be present");
  assert(hugeHeadIdx !== -1, "huge.log paged head block must be present");
  assert(imgIdx < hugeHeadIdx, `image block must precede the huge.log head block (emission order), got img=${imgIdx} huge=${hugeHeadIdx}`);
});

await runCase("BG2", "§5.6.2 — binary + huge.log under PAGED_FIX: binary note consumed budget (no-flip guard)", async () => {
  // The binary cost is tiny (≈17 tokens; Math.ceil(noteLen/4)), so this is mostly a no-flip regression
  // guard + emission-order check: the binary note is decided first, its cost subtracted, THEN huge.log
  // decides and still pages (huge.log fileCost ≈ 524288 >> 0.6·remaining).
  const r = await mod.injectFiles("Inspect #@data.bin and summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly one paged (huge.log), got paged=${r.paged}`);
  assert(r.images.length === 0, `binary attaches NO image, got images=${r.images.length}`);
  const binIdx = r.text.indexOf('<file name="' + BIN + '">');
  const hugeHeadIdx = r.text.indexOf('<file name="' + HUGE + '">\n');
  assert(binIdx !== -1, "binary note block must be present");
  assert(hugeHeadIdx !== -1, "huge.log paged head block must be present");
  assert(binIdx < hugeHeadIdx, `binary note block must precede the huge.log head block (emission order), got bin=${binIdx} huge=${hugeHeadIdx}`);
});

await runCase("BG3", "§5.6.2 — empty-image (F5) + huge.log under PAGED_FIX: empty-image note consumed budget (no-flip guard)", async () => {
  // F5 attaches nothing (0-byte image). The empty-image note cost (≈17 tokens) is subtracted, then
  // huge.log decides and still pages. No-flip regression guard + emission-order check.
  const r = await mod.injectFiles("See #@empty.png and summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly one paged (huge.log), got paged=${r.paged}`);
  assert(r.images.length === 0, `F5 attaches NO image (0-byte), got images=${r.images.length}`);
  const emptyIdx = r.text.indexOf('<file name="' + EMPTY_PNG + '">');
  const hugeHeadIdx = r.text.indexOf('<file name="' + HUGE + '">\n');
  assert(emptyIdx !== -1, "empty-image note block must be present");
  assert(hugeHeadIdx !== -1, "huge.log paged head block must be present");
  assert(emptyIdx < hugeHeadIdx, `empty-image note block must precede the huge.log head block (emission order), got empty=${emptyIdx} huge=${hugeHeadIdx}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// ── MARKDOWN TRANSITIVE IMPORTS (PRD §5.6) — cases 15-19 (FIX, no budget → all whole) ──
// A delivered .md is an import SOURCE: its content is scanned for #@<path>, each resolved import is
// itself delivered (and, if markdown, scanned in turn). Recursion is relative-only, code-exempt, and
// dedup-bounded (NOT depth-limited). FIX has no budget → emitText injects whole → injected===count, paged===0.
// ──────────────────────────────────────────────────────────────────────────────
await runCase(15, "md import: notes.md imports api.md → both blocks (pre-order), marker stripped, injected=2", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX);
  assert(r.injected === 2, `expected injected===2 (notes.md + api.md), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notes.md"), "top-level #@notes.md marker stripped to notes.md");
  const iNotes = r.text.indexOf('<file name="' + NOTES + '">');
  const iApi = r.text.indexOf('<file name="' + API + '">');
  assert(iNotes !== -1 && iApi !== -1, "both notes.md and api.md blocks must be present");
  assert(iNotes < iApi, "notes.md block must appear BEFORE api.md block (pre-order depth-first: parent then import)");
  // the import marker inside notes.md is stripped to the bare path (the fenced #@example.ts is left verbatim)
  assert(r.text.includes("Imports api.md here."), "notes.md block: resolved import marker stripped to api.md");
  assert(!r.text.includes("Imports #@api.md here."), "the resolved import marker must NOT retain #@");
});

await runCase(16, "md code-exempt: fenced #@example.ts left verbatim; only api.md imported", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX);  // same notes.md as #15
  assert(r.injected === 2, `only notes.md + api.md injected (example.ts is code-exempt), got ${r.injected}`);
  // the fenced #@example.ts is left VERBATIM in the notes.md block (code-region exemption, §5.6.1)
  assert(r.text.includes("#@example.ts"), "the fenced #@example.ts must be left VERBATIM (code-exempt, not stripped)");
  // example.ts is never imported (code-exempt → never resolved, never stat'd; it is not even a fixture)
  assert(!r.text.includes('<file name="' + path.join(TMPDIR, "example.ts") + '">'),
    "example.ts must NOT be injected (inside a fenced block → code-exempt)");
});

await runCase(17, "md cycle: a.md↔b.md → each once, b.md's #@a.md verbatim, no loop, injected=2", async () => {
  const r = await mod.injectFiles("Start #@a.md", [], FIX);
  assert(r.injected === 2, `a.md + b.md injected once each (cycle terminates via dedup), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  const iA = r.text.indexOf('<file name="' + A_MD + '">');
  const iB = r.text.indexOf('<file name="' + B_MD + '">');
  assert(iA !== -1 && iB !== -1, "both a.md and b.md blocks present");
  assert(iA < iB, "a.md block before b.md block (pre-order: a.md then its import b.md)");
  assert(countFileBlocks(r.text, A_MD) === 1, `a.md must appear exactly ONCE (dedup), got ${countFileBlocks(r.text, A_MD)}`);
  assert(countFileBlocks(r.text, B_MD) === 1, `b.md must appear exactly ONCE (dedup), got ${countFileBlocks(r.text, B_MD)}`);
  // b.md's #@a.md is LEFT VERBATIM: a.md was claimed (in injectFile) before b.md scanned it → dedup → verbatim.
  assert(r.text.includes("Back #@a.md."), "b.md's #@a.md must be left VERBATIM (a.md already injected → deduped, NOT stripped)");
});

await runCase(18, "md abs rejected: #@/etc/hosts ignored (relative-only), verbatim, only notesAbs.md injected", async () => {
  const r = await mod.injectFiles("Read #@notesAbs.md", [], FIX);
  assert(r.injected === 1, `only notesAbs.md injected (absolute import ignored), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // the #@/etc/hosts marker is left VERBATIM (relative-only rule fires BEFORE resolution/stat)
  assert(r.text.includes("#@/etc/hosts"), "the absolute #@/etc/hosts must be left VERBATIM (relative-only, not resolved)");
  assert(!r.text.includes('<file name="/etc/hosts">'), "/etc/hosts must NOT be injected (relative-only rule)");
});

await runCase(19, "md relative base: sub/notes.md's #@api.md → sub/api.md (md's dir, not cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/notes.md", [], FIX);
  assert(r.injected === 2, `sub/notes.md + sub/api.md injected, got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read sub/notes.md"), "top-level #@sub/notes.md marker stripped to sub/notes.md");
  const iSubNotes = r.text.indexOf('<file name="' + SUB_NOTES + '">');
  const iSubApi = r.text.indexOf('<file name="' + SUB_API + '">');
  assert(iSubNotes !== -1 && iSubApi !== -1, "both sub/notes.md and sub/api.md blocks present");
  assert(iSubNotes < iSubApi, "sub/notes.md block before sub/api.md block (pre-order)");
  // CRITICAL: api.md resolved as sub/api.md (relative to the markdown's dir), NOT TMPDIR/api.md.
  assert(r.text.includes("Sibling API in sub/."), "sub/api.md's DISTINCT content present (proves resolution relative to md dir)");
  assert(!r.text.includes("Top-level API surface."), "the top-level api.md must NOT be injected (resolution is relative to the md's dir)");
  // sub/notes.md's #@api.md marker stripped to api.md
  assert(r.text.includes("See api.md."), "sub/notes.md's import marker stripped to api.md");
  assert(!r.text.includes("See #@api.md."), "the resolved import marker must NOT retain #@");
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// ── SHARED BUDGET (§5.6.2) + MARKDOWN EDGES (§10) — case 20 + MD1 + MD2 ──
// Case 20 proves the shared-budget accumulator spans the markdown recursion (bigdoc.md + 3 parts whole,
// huge.log paged under PAGED_FIX; notify counts ALL 5 files). MD1 exercises the injectMarkdown §10 fix
// (a markdown importing a MISSING file leaves the import marker VERBATIM). MD2 is a pure regression test
// (a markdown import resolving OUTSIDE cwd via ../ is allowed — relative to the md's dir, not cwd).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────

// Case 20 — §5.6.2 SHARED BUDGET across the markdown recursion. bigdoc.md imports 3 parts + huge.log;
// under PAGED_FIX the accumulator spans the recursion: bigdoc + 3 parts whole, huge.log paged. notify counts
// ALL 5 files. (Two sub-calls: direct injectFiles for the counts/blocks; merged-ctx handler for the notify.)
await runCase(20, "§5.6.2 shared budget: bigdoc.md + 3 imports whole, huge.log paged; notify counts all 5", async () => {
  // (1) DIRECT — injectFiles(PAGED_FIX): structural counts + blocks + order + marker stripping.
  //     remaining=23616; bigdoc(≈19)+part1(≈5)+part2(≈5)+part3(≈5) whole; huge.log(524288≫14170) paged.
  const r = await mod.injectFiles("Read #@bigdoc.md", [], PAGED_FIX);
  assert(r.injected === 5, `bigdoc + 3 parts + huge.log delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly huge.log paged, got paged=${r.paged}`);
  assert(r.injected - r.paged === 4, `4 whole (bigdoc + 3 parts), got whole=${r.injected - r.paged}`);
  // Pre-order DFS block order: bigdoc.md < part1 < part2 < part3 < huge.log(head).
  const iB = r.text.indexOf('<file name="' + BIGDOC + '">');
  const i1 = r.text.indexOf('<file name="' + PART1 + '">');
  const i2 = r.text.indexOf('<file name="' + PART2 + '">');
  const i3 = r.text.indexOf('<file name="' + PART3 + '">');
  const iH = r.text.indexOf('<file name="' + HUGE + '">\n'); // head block (content follows the '>\n')
  assert(iB !== -1 && i1 !== -1 && i2 !== -1 && i3 !== -1 && iH !== -1, "all 5 files have blocks");
  assert(iB < i1 && i1 < i2 && i2 < i3 && i3 < iH,
    `pre-order DFS: bigdoc<part1<part2<part3<huge.log, got iB=${iB},i1=${i1},i2=${i2},i3=${i3},iH=${iH}`);
  // huge.log PAGED: a head block + a directive block (2 occurrences of its <file name> tag). The directive
  // uses the PRD §6.1 format '<paged: ... chars; head delivered ... complete lines; read the rest with the read tool ...>'.
  const hugeTags = (r.text.match(new RegExp('<file name="' + HUGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(hugeTags === 2, `huge.log must have a HEAD block + a DIRECTIVE block (2 tags), got ${hugeTags}`);
  assert(r.text.includes("<paged:"), "huge.log paged directive present (PRD §6.1 '<paged: ...>' format)");
  assert(r.text.includes("with the read tool"), "huge.log paged directive references the read tool (§6.1 'read the rest with the read tool')");
  // bigdoc.md's import markers are STRIPPED (all 4 imports resolved+exist → injectable → stripped).
  assert(r.text.slice(iB, i1).includes("Logs: huge.log"), "bigdoc.md block: the #@huge.log marker stripped to huge.log");
  assert(!r.text.slice(iB, i1).includes("#@"), "bigdoc.md block must contain NO '#@' markers (all imports resolved+stripped)");

  // (2) NOTIFY — merged ctx (makeMockCtx ui + PAGED_FIX budget) via the handler. Counts come from the message.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Read #@bigdoc.md", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 4 whole, 1 paged",
    `notify must count EVERY delivered file across the recursion (4 whole + 1 paged), got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

// MD1 — §10 EDGE: a markdown importing a MISSING file leaves the import marker VERBATIM (not stripped).
// Exercises the injectMarkdown §10 fix (Task 1). FIX = no budget → notesMissing.md whole.
await runCase("MD1", "§10 md edge: notesMissing.md imports missing ghost.md → marker VERBATIM, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesMissing.md", [], FIX);
  assert(r.injected === 1, `only notesMissing.md injected (ghost.md is missing), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notesMissing.md"), "top-level #@notesMissing.md marker stripped to notesMissing.md");
  assert(r.text.includes('<file name="' + NOTES_MISSING + '">'), "notesMissing.md block present");
  // THE §10 FIX: the missing import marker is LEFT VERBATIM (not stripped) — nothing was injected for it.
  assert(r.text.includes("Refs #@ghost.md here."), "the MISSING import marker #@ghost.md must be left VERBATIM (§10)");
  assert(!r.text.includes("Refs ghost.md here."), "the missing import marker must NOT be stripped (no bare 'ghost.md' reference)");
  assert(!r.text.includes('<file name="' + path.join(TMPDIR, "ghost.md") + '">'), "ghost.md must NOT be injected (it does not exist)");
});

// MD2 — §10 EDGE: a markdown import resolving OUTSIDE cwd (via ../) is ALLOWED (relative to the md's dir).
// Pure regression test — this ALREADY works (imports resolve from dirname(abs), not cwd). FIX = no budget.
await runCase("MD2", "§10 md edge: sub/outsider.md imports #@../shared/api.md → allowed (md's dir, outside cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/outsider.md", [], FIX);
  assert(r.injected === 2, `sub/outsider.md + shared/api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read sub/outsider.md"), "top-level #@sub/outsider.md marker stripped to sub/outsider.md");
  assert(r.text.includes('<file name="' + OUTSIDER + '">'), "sub/outsider.md block present");
  assert(r.text.includes('<file name="' + SHARED_API + '">'), "shared/api.md block present (resolved via ../, outside cwd)");
  // shared/api.md is OUTSIDE cwd (TMPDIR) but INSIDE the markdown's parent — explicitly ALLOWED (§10).
  assert(path.relative(TMPDIR, SHARED_API) === path.join("shared", "api.md"),
    `shared/api.md resolves under TMPDIR/shared (the md's parent's sibling), got rel=${path.relative(TMPDIR, SHARED_API)}`);
  assert(r.text.includes("Outside cwd."), "shared/api.md's DISTINCT content present (proves the outside-cwd file was injected)");
  // the import marker is STRIPPED (the import resolved + exists → injectable → stripped).
  assert(r.text.includes("See ../shared/api.md here."), "sub/outsider.md block: the #@../shared/api.md marker stripped to ../shared/api.md");
  assert(!r.text.includes("#@../shared/api.md"), "the resolved outside-cwd import marker must NOT retain #@");
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// ── T1.S1: resolveImportPath + async scanTokens unit tests (PRD §4.5 rule 3 — the resolution core) ──
// These unit-test the two new exported helpers directly against TMPDIR fixtures, WITHOUT going through
// the full injectFiles pipeline. Cases 21-24 (end-to-end shorthand wiring) are T1.S2. Each case calls
// `await mod.resolveImportPath(token, TMPDIR, tryMdExt)` directly and asserts the resolved abs (or null).
// scanTokens is exercised only for its now-async return-type contract (returns a Promise<array>).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────

// T1.S1-1 — EXACT MATCH WINS. A bare `README` and `README.md` both exist; resolveImportPath("README", true)
// must return the BARE README (exact-match wins; the .md fallback never runs). PRD §4.5 rule 3.
await runCase("T1.S1-1", "resolveImportPath exact-wins: bare README beats README.md (tryMdExt:true)", async () => {
  const r = await mod.resolveImportPath("README", TMPDIR, true);
  assert(r === README_BARE,
    `exact-match must win: expected bare ${README_BARE}, got ${r}`);
  assert(r !== README_MD, `the .md sibling must NOT be returned when the bare file exists`);
});

// T1.S1-2 — .md FALLBACK. No bare `PRD` exists, only `PRD.md`; with tryMdExt:true the shorthand tries
// <exact>.md and returns it. PRD §4.5 rule 3 (`#@PRD` → `PRD.md`).
await runCase("T1.S1-2", "resolveImportPath .md fallback: PRD → PRD.md (no bare PRD, tryMdExt:true)", async () => {
  const r = await mod.resolveImportPath("PRD", TMPDIR, true);
  assert(r === PRD_MD, `expected shorthand to resolve to ${PRD_MD}, got ${r}`);
});

// T1.S1-3 — .markdown FALLBACK. Only `only.markdown` exists (no bare `only`, no `only.md`); the shorthand
// ladder reaches the second tier and returns `only.markdown`. PRD §4.5 rule 3.
await runCase("T1.S1-3", "resolveImportPath .markdown fallback: only → only.markdown (tryMdExt:true)", async () => {
  const r = await mod.resolveImportPath("only", TMPDIR, true);
  assert(r === ONLY_MARKDOWN, `expected second-tier fallback to ${ONLY_MARKDOWN}, got ${r}`);
});

// T1.S1-4 — NO MATCH → null. A token that resolves to nothing existing returns null (caller leaves the
// `#@` marker verbatim, §5.4). Pins the null path that keeps MD1 green.
await runCase("T1.S1-4", "resolveImportPath no-match → null (missing file, tryMdExt:true)", async () => {
  const r = await mod.resolveImportPath("nope", TMPDIR, true);
  assert(r === null, `expected null for a token resolving to nothing, got ${JSON.stringify(r)}`);
});

// T1.S1-5 — DOTFILE EXACT-WINS. `path.extname(".env") === ""` so `.env` technically qualifies for the
// shorthand, BUT a bare `.env` exists → exact-match returns it BEFORE the .md fallback runs. Follows PRD
// §4.5 literally (no dotfile exclusion). Pins external_deps.md Note B.
await runCase("T1.S1-5", "resolveImportPath dotfile exact-wins: .env → .env (NOT .env.md, tryMdExt:true)", async () => {
  const r = await mod.resolveImportPath(".env", TMPDIR, true);
  assert(r === DOTENV, `expected exact-match dotfile ${DOTENV}, got ${r}`);
  assert(r !== path.join(TMPDIR, ".env.md"), `must NOT fall back to .env.md when the bare .env exists`);
});

// T1.S1-6 — TOP-LEVEL EXACT-ONLY. With tryMdExt:false the shorthand NEVER runs: no bare `PRD` exists, so
// resolveImportPath("PRD", false) returns null even though PRD.md does. This is what keeps the top-level
// user-prompt path byte-for-byte identical to today (PRD §4.4 exact-only).
await runCase("T1.S1-6", "resolveImportPath top-level exact-only: PRD → null (tryMdExt:false, even with PRD.md)", async () => {
  const r = await mod.resolveImportPath("PRD", TMPDIR, false);
  assert(r === null, `tryMdExt:false must NOT fall back to .md (top-level is exact-only), got ${JSON.stringify(r)}`);
});

// T1.S1-7 — scanTokens IS NOW ASYNC. After the sync→async promotion, calling scanTokens returns a Promise
// (typeof asyncFunction === "function" stays true, so the sanity assert is unaffected). The State arg is a
// plain object literal (the TS interface is erased at runtime). Resolves with the records array (an array,
// possibly empty). external_deps.md Note A — the suite never calls scanTokens for content, only this contract.
await runCase("T1.S1-7", "scanTokens is async: returns a Promise<array> after the sync→async promotion", async () => {
  const p = mod.scanTokens(
    "text with no resolvable tokens",
    TMPDIR,
    { allowAbsTilde: true, skipCode: false, tryMdExt: false },
    { blocks: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(p instanceof Promise, `scanTokens must return a Promise after going async, got ${Object.prototype.toString.call(p)}`);
  const arr = await p;
  assert(Array.isArray(arr), `awaited scanTokens must resolve to an array, got ${Object.prototype.toString.call(arr)}`);
});

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

// Cleanup (always): temp dir + the home-dir notes file (leave no litter).
try {
  fsSync.rmSync(TMPDIR, { recursive: true, force: true });
} catch { /* best-effort */ }
try {
  if (fsSync.existsSync(HOME_NOTES_PATH)) fsSync.rmSync(HOME_NOTES_PATH, { force: true });
} catch { /* best-effort */ }

process.exit(failed > 0 ? 1 : 0);
