// sharp-at-file.test.mjs — Model-free acceptance harness for the `#@file` injection extension.
//
// WHAT THIS IS
//   A standalone, zero-dependency Node ESM script (the project's "standalone .mjs gate" convention —
//   no test framework is configured in this repo). It imports the REAL committed `./sharp-at-file.ts`
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
//   node ./sharp-at-file.test.mjs      # from the repo root; exits 0 on success, 1 on any failure.

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
const TS_PATH = path.resolve(SCRIPT_DIR, "sharp-at-file.ts");
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
assert(typeof mod.hasValidImageMagic === "function", "mod.hasValidImageMagic must be a function (F3)");

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

function captureHandler() {
  const slot = {};
  const pi = { on: (_event, cb) => { slot.cb = cb; } };
  mod.default(pi); // registers the handler on slot.cb
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

// ──────────────────────────────────────────────────────────────────────────────
// 8. The 14 PRD §11 acceptance cases (+ edges + guards).
// ──────────────────────────────────────────────────────────────────────────────
console.log("\nsharp-at-file.ts — PRD §11 acceptance matrix (model-free)\n");

// Case 1 — single text file; original text preserved; block appended after `---`.
await runCase(1, "single text file injected, original preserved", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text.startsWith("Review #@a.ts"), "original prompt text must be preserved verbatim at start");
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
  assert(rec.notify && rec.notify.m === "#@ injected 2 files", `notify message must be the count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
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
  assert(rec.notify && rec.notify.m === "#@ injected 1 file", "notify must fire for the interactive path");
});
integrationCase(
  12,
  "initial CLI -p message (live pi)",
  'pi -e ./sharp-at-file.ts -p "Review #@a.ts"',
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
console.log("\nsharp-at-file.ts — edge cases & guards (PRD §10 / §12)\n");

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

await runCase("F2", "F2 — sentinel string in prompt no longer gates injection (Issue 2)", async () => {
  // Issue 2 regression: the old sentinel guard tested the RAW user prompt and short-circuited on ANY
  // `<!--#@file-injected-->` substring, silently dropping ALL #@ tokens. With the sentinel removed
  // (P1.M1.T1.S2), a prompt containing the literal sentinel string AND a valid #@token must STILL
  // inject the file. (`#@file-injected-->` resolves (after cleanToken trims the trailing `>`) to a
  // missing path and is left verbatim; `#@a.ts` injects.)
  const prompt = '<!--#@file-injected--> Review #@a.ts';
  const r = await mod.injectFiles(prompt, [], FIX);
  assert(r.injected === 1, `a.ts must be injected despite the sentinel string in the prompt (got ${r.injected})`);
  assert(r.text.startsWith(prompt), "original prompt text must be preserved verbatim at the start");
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

await runCase("F4", "F4 — notify pluralization (1 file / N files)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 1 file", `singular prompt must say '1 file', got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  const { ctx: ctx2, rec: rec2 } = makeMockCtx(TMPDIR);
  const slot2 = captureHandler();
  await slot2.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx2);
  assert(rec2.notify && rec2.notify.m === "#@ injected 2 files", `plural prompt must say '2 files', got ${JSON.stringify(rec2.notify && rec2.notify.m)}`);
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
  assert(r.text.startsWith("Review #@a.ts"), `(c) original prompt must be preserved verbatim at start`);
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

// ──────────────────────────────────────────────────────────────────────────────
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
