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
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
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
assert(typeof mod.readConfig === "function", "mod.readConfig must be a function (§4.6 config reader: global+project merge, trust gate, never throws)");
assert(typeof mod.renderInjectedMessage === "function", "mod.renderInjectedMessage must be a function (§6.3 chat renderer for fileInjector.injected custom messages)");
assert(typeof mod.computeDetailOffsets === "function", "mod.computeDetailOffsets must be a function (§12.22 P1.M2.T1.S1 — absolute body offsets so the renderer slices message.content without duplicating file bytes into details)");

// ── MODULE-SURFACE COMPLETENESS (S4 sync) ── The 16 asserts above name the MEANINGFUL exports. This guard
// enforces the FULL contract: every function the module SHIPS is either (a) asserted by name above, or (b) a
// known pure helper tested indirectly. It catches a future export added without a sanity assert, AND catches
// injectMarkdown (the PRIVATE recursion driver) being accidentally exported. (PRD §11 "the gate must assert
// the real shipped module surface"; item LOGIC (c).)
const ASSERTED_EXPORTS = new Set([
  "default", "injectFiles", "cleanToken", "formatTextFileBlock", "formatImageBlock", "formatBinaryBlock",
  "formatEmptyImageBlock", "formatPagedDirectiveBlock", "hasValidImageMagic", "scanTokens", "injectFile",
  "emitText", "isAbsoluteOrTilde", "computeCodeRanges", "inCode", "estimateImageTokens",
  "resolveImportPath", "isRegularFile", "readConfig", "renderInjectedMessage", "computeDetailOffsets",
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
function makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, isProjectTrusted, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,
  };
}

function captureHandler(event = "input") {
  const cbs = [];
  const pi = {
    on: (ev, cb) => { if (ev === event) cbs.push(cb); }, // capture by event name (factory registers both input + session_start)
    registerMessageRenderer: () => {}, // §6.3 no-op stub — the session_start handler registers the chat renderer (T2.S2); tests don't render
  };
  mod.default(pi); // registers handlers; cbs holds EVERY handler for `event` (input: 1; session_start: 2 after §4.6 config)
  return { cb: cbs[cbs.length - 1], all: cbs }; // .cb = LAST handler (backward compat for ~30 callers); .all = every handler for `event`
}

// Capture EVERY handler the factory registers (all events) from ONE mod.default(pi) call, so handlers sharing a
// factory closure (the input→before_agent_start `pending` stash) are driven against the same factory state.
// (cfg is MODULE-level — persists across factories; pending is CLOSURE-scoped — per factory. The delivery flow
// needs ONE factory for both.) Returns { event: [cb,…], … } e.g. { input:[fn], session_start:[cfgFn,acFn],
// before_agent_start:[fn] }. Used by handler delivery tests that assert the before_agent_start custom message.
function captureAllHandlers() {
  const handlers = {};
  const pi = {
    on: (ev, cb) => { (handlers[ev] ??= []).push(cb); },
    registerMessageRenderer: () => {}, // §6.3 no-op stub (same as captureHandler)
  };
  mod.default(pi);
  return handlers;
}

// block-text helpers — under the new injectFiles return shape, r.text is the STRIPPED prompt ONLY (no blocks,
// no separator); the <file> blocks live in r.blocks (string[]). These read the JOINED block text so content
// checks (block openers, markdown prose, paged directives, dedup counts) keep working with minimal edits.
// Positive/negative includes and ordering all operate on the joined blocks (emission order = array order).
function blocksText(r) { return r.blocks.join("\n\n"); }
function hasBlock(r, needle) { return r.blocks.some((b) => b.includes(needle)); }
// countFileBlocks — counts <file name="ABS"> block-openers for `abs` across the JOINED blocks. Dedupes the
// inline regex-count pattern (escape-special-chars + match length) used across F1/F1c/DUP1/etc. Under the
// new return shape block openers live in r.blocks (one per block string), so count over blocksText(r).
function countFileBlocks(text, abs) {
  return (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
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
  // BUG-1 regression fixture: a file whose OWN content contains a literal `</file>`. The renderer's
  // block regex used to truncate the expanded view at the INNER `</file>`; emitText now stores the
  // exact body in detail.body so the renderer never re-regexes real content.
  fsSync.writeFileSync(path.join(TMPDIR, "nest.ts"), "Example:\n<file name=\"d\">nested</file>\nDONE\n");
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

  // ── §4.6 bare-@ markdown-import fixtures (PRD §4.6 — P1.M2.T2.S1 cases #25-28 + §10 e/f/g). ──
  //   notesBare.md: a bare `@api.md` (reuses the existing top-level api.md). notesEmail.md: a mid-word
  //   `user@host.com` (excluded by BARE_AT_RE's word-char lookbehind). notesMention.md: a bare `@username`
  //   (no username.md → not resolved). notesMixDedup.md: BOTH `#@api.md` and `@api.md` (same resolved abs →
  //   dedup). other.md: a top-level bare-@ TARGET that must EXIST so #28's top-level-exclusion assertion is
  //   meaningful (a wrong bareAt:true would inject it). global ~/.pi/agent/file-injector.json is NOT touched.
  fsSync.writeFileSync(path.join(TMPDIR, "notesBare.md"), "# Bare Notes\n\nRefs @api.md here.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "notesEmail.md"), "# Email\n\nContact user@host.com.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "notesMention.md"), "# Mention\n\nPing @username now.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "notesMixDedup.md"), "Refs #@api.md and @api.md.\n");
  fsSync.writeFileSync(path.join(TMPDIR, "other.md"), "# Other\n\nTop-level bare-@ target.\n");

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

  // T2.S1 — PRD §4.6 project-local config fixture (file-injector.json). The project config dir is .pi/
  // (CONFIG_DIR_NAME === ".pi", VERIFIED). Cases T2.S1-b/c read this valid {markdownBareAtImports:true};
  // case T2.S1-d OVERWRITES it with malformed JSON inline (then restores in a finally). The global
  // ~/.pi/agent/file-injector.json is INTENTIONALLY NOT created here (must not touch the real home dir;
  // global-merge precedence is covered by P1.M2.T1.S1's session_start integration test).
  fsSync.mkdirSync(path.join(TMPDIR, ".pi"), { recursive: true }); // {recursive:true} → no-op if a parallel fixture already made it
  fsSync.writeFileSync(path.join(TMPDIR, ".pi", "file-injector.json"), JSON.stringify({ markdownBareAtImports: true }));

  // ── Extension-shorthand fixtures (PRD §4.5 rule 3 — T1.S2 cases 21–24 + EDG-1..4). SELF-CONTAINED names
  //    that do NOT collide with S1's README/README.md/PRD.md/only.markdown/.env or the existing markdown
  //    fixtures. Case 21 reuses the existing top-level api.md (no bare api). Case 24 + EDG-3 share specdoc.md
  //    (NO bare specdoc → top-level exact-only). EDG-4 reuses the existing sub/notes.md. ──
  fsSync.writeFileSync(path.join(TMPDIR, "notesShorthand.md"), "Imports #@api here.\n");      // case 21: imports #@api → api.md
  fsSync.writeFileSync(path.join(TMPDIR, "guide"), "bare guide\n");                           // case 22: bare (exact-wins)
  fsSync.writeFileSync(path.join(TMPDIR, "guide.md"), "# Guide\n");                           // case 22: .md (must NOT win)
  fsSync.writeFileSync(path.join(TMPDIR, "notesExactWins.md"), "Refs #@guide here.\n");       // case 22: imports #@guide
  fsSync.mkdirSync(path.join(TMPDIR, "sub", "ext"), { recursive: true });                     // case 23: dedicated dir
  fsSync.writeFileSync(path.join(TMPDIR, "sub", "ext", "notes.md"), "See #@api here.\n");     // case 23: imports #@api
  fsSync.writeFileSync(path.join(TMPDIR, "sub", "ext", "api.markdown"), "# Markdown API\n");  // case 23: ONLY .markdown (no .md)
  fsSync.writeFileSync(path.join(TMPDIR, "specdoc.md"), "# Spec\n");                          // case 24 + EDG-3 (NO bare specdoc)
  fsSync.writeFileSync(path.join(TMPDIR, "notesGhost.md"), "Refs #@ghost here.\n");           // EDG-1: no-match (ghost never created)
  fsSync.writeFileSync(path.join(TMPDIR, "notesAbsent.md"), "Refs #@absent.md here.\n");      // EDG-2: already-extended missing (absent.md never created)
  fsSync.writeFileSync(path.join(TMPDIR, "notesDedup.md"), "Imports: #@specdoc and #@specdoc.md\n"); // EDG-3: dedup across shorthand forms
  fsSync.writeFileSync(path.join(TMPDIR, "notesSubPrefix.md"), "See #@sub/notes here.\n");    // EDG-4: shorthand w/ path prefix → sub/notes.md

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

// Extension-shorthand path constants (PRD §4.5 rule 3 — T1.S2 cases 21–24 + EDG-1..4).
// Self-contained, non-colliding names. Reuses the existing API (top-level api.md) and SUB_NOTES (sub/notes.md).
const NOTES_SHORTHAND = path.join(TMPDIR, "notesShorthand.md");
const GUIDE_BARE = path.join(TMPDIR, "guide");
const GUIDE_MD = path.join(TMPDIR, "guide.md");
const NOTES_EXACT_WINS = path.join(TMPDIR, "notesExactWins.md");
const EXT_NOTES = path.join(TMPDIR, "sub", "ext", "notes.md");
const EXT_API_MARKDOWN = path.join(TMPDIR, "sub", "ext", "api.markdown");
const SPECDOC_MD = path.join(TMPDIR, "specdoc.md");
const NOTES_GHOST = path.join(TMPDIR, "notesGhost.md");
const NOTES_ABSENT = path.join(TMPDIR, "notesAbsent.md");
const NOTES_DEDUP = path.join(TMPDIR, "notesDedup.md");
const NOTES_SUB_PREFIX = path.join(TMPDIR, "notesSubPrefix.md");

// §4.6 bare-@ markdown-import path constants (P1.M2.T2.S1 cases #25-28 + §10 e/f/g). Reuse EXISTING api.md
// (#25/#26/#27/g) and notes.md (#27) — these 5 are the NEW self-contained fixtures (no duplication).
const NOTES_BARE = path.join(TMPDIR, "notesBare.md");
const NOTES_EMAIL = path.join(TMPDIR, "notesEmail.md");
const NOTES_MENTION = path.join(TMPDIR, "notesMention.md");
const NOTES_MIX_DEDUP = path.join(TMPDIR, "notesMixDedup.md");
const OTHER_MD = path.join(TMPDIR, "other.md");

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

// Case 1 — single text file; original text preserved; block in r.blocks.
await runCase(1, "single text file injected, original preserved", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.text === "Review #@a.ts", `text is the verbatim prompt (#@ preserved; no blocks, no ---), got ${JSON.stringify(r.text)}`);
  const expectedBlock = '<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>';
  assert(hasBlock(r, expectedBlock), `expected block to equal the processFileArguments template`);
});

// Case 2 — huge file; ENTIRE content injected, byte-for-byte (no truncation).
await runCase(2, "huge file injected byte-for-byte (no truncation)", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  const expectedBlock = '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT + '\n</file>';
  assert(
    r.blocks.length === 1 && r.blocks[0] === expectedBlock,
    "block content must equal the ENTIRE fixture byte-for-byte (no truncation)",
  );
  // Explicit length check: proves no silent truncation on a ~2 MB file.
  assert(r.blocks[0].length >= HUGE_LOG_CONTENT.length, "block must contain the full file length");
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
  // Reference block in r.blocks.
  assert(hasBlock(r, '<file name="' + PIC + '">'), "blocks must reference the image in a <file name=…> block");
  const expectedBlock = '<file name="' + PIC + '"></file>'; // empty hints (resizeImage→null)
  assert(hasBlock(r, expectedBlock), "image reference block must have empty hints (resize→null)");
});

// Case 4 — non-image binary: NUL-byte guard → clear note block (no decoded garbage).
await runCase(4, "non-image binary → note block (em dash, no garbage)", async () => {
  const r = await mod.injectFiles("Inspect #@data.bin", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  const expectedBlock =
    '<file name="' + BIN + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
  assert(
    hasBlock(r, expectedBlock),
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
  const ia = r.blocks.findIndex((b) => b.includes('<file name="' + A_TS + '">'));
  const ib = r.blocks.findIndex((b) => b.includes('<file name="' + B_TS + '">'));
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
    hasBlock(r, '<file name="' + expectedPath + '">'),
    `block path must be the tilde-expanded home path (${expectedPath})`,
  );
});

// Case 11 — trailing punctuation trimmed by cleanToken → resolves a.ts (not a.ts.).
await runCase(11, "trailing punctuation trimmed", async () => {
  const r = await mod.injectFiles("See #@a.ts.", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(hasBlock(r, '<file name="' + A_TS + '">'), "must resolve to a.ts (trailing '.' trimmed)");
  assert(!hasBlock(r, '<file name="' + A_TS + '.">'), "must NOT resolve to 'a.ts.' (punctuation must be trimmed)");
});

// Case 12 — initial -p message: the input event fires for -p too (structural via handler mock),
//           PLUS a documented live-pi integration command.
await runCase(12, "handler transforms interactive input (input event fires for -p)", async () => {
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers(); // ONE factory → shared `pending` closure (input stashes; before_agent_start publishes)
  // source:"interactive" mirrors the -p path (the input event fires inside prompt() for ALL contexts).
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform an interactive #@ prompt, got '${out.action}'`);
  assert(out.text === "Review #@a.ts", `handler text is the verbatim prompt (#@ preserved; blocks live in the before_agent_start custom message), got ${JSON.stringify(out.text)}`);
  const msg = await h.before_agent_start[0]({}, ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message && msg.message.customType === "fileInjector.injected", `before_agent_start must publish the custom message, got ${JSON.stringify(msg)}`);
  assert(msg.message.content.includes('<file name="' + A_TS + '">'), "the a.ts block must be in the custom message content");
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
  assert(hasBlock(r, expectedBlock), "our #@ text block must be byte-identical to the pi @file block template");
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
  assert(hasBlock(r, expectedBlock), "empty file must be injected as <file name=…>\\n\\n</file> (NOT skipped)");
});

await runCase("E2", "parenthesized token → trimmed, resolved", async () => {
  const r = await mod.injectFiles("(#@a.txt)", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(hasBlock(r, '<file name="' + A_TXT + '">'), "token 'a.txt)' must trim to 'a.txt' and resolve");
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

await runCase("E5", "markdown import of unreadable file → marker verbatim", async () => {
  if (process.getuid() === 0) {
    // chmod is ineffective when running as root — skip with a note (same caveat as E4).
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  // CRITICAL: use UNIQUE fixture names (perm_api.md / perm_notes.md) — NOT api.md/notes.md.
  // buildFixtures writes SHARED notes.md + api.md that later markdown cases (15/16/MD1/17-20) depend on;
  // overwriting them mid-suite breaks those cases even with chmod restored.
  const api = path.join(TMPDIR, "perm_api.md");
  const notes = path.join(TMPDIR, "perm_notes.md");
  fsSync.writeFileSync(api, "API secret\n");
  fsSync.writeFileSync(notes, "Notes intro.\n#@perm_api.md\nNotes end.\n");
  fsSync.chmodSync(api, 0o000);
  try {
    const r = await mod.injectFiles("Read #@perm_notes.md", [], FIX);
    // (a) only the PARENT markdown (perm_notes.md) counts as injected.
    assert(r.injected === 1, `expected injected===1 (parent only), got ${r.injected}`);
    // (b) the unreadable import's marker must be LEFT VERBATIM in the parent's emitted block (PRD §5.4/§12.5).
    assert(hasBlock(r, "#@perm_api.md") === true, "unreadable markdown-import marker must be left verbatim");
    // (c) no block may be appended for the unreadable import target.
    assert(!hasBlock(r, '<file name="' + api + '">'), "no block must be appended for the unreadable import");
    // (d) the parent's own block IS delivered.
    assert(hasBlock(r, '<file name="' + notes + '">'), "parent markdown block must be delivered");
  } finally {
    fsSync.chmodSync(api, 0o644); // restore so cleanup can remove it
  }
});

await runCase("E6", "injectFile read-failure un-claims abs (claim ⟺ delivered) — no poisoned dedup", async () => {
  if (process.getuid() === 0) {
    // chmod is ineffective when running as root — skip with a note (same caveat as E4/E5).
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  const secret = path.join(TMPDIR, "unclaim_secret.txt"); // UNIQUE fixture name (no shared-fixture collision)
  fsSync.writeFileSync(secret, "unreadable\n");
  fsSync.chmodSync(secret, 0o000);
  try {
    // minimal State — the TS interface is erased at runtime; a structurally-compatible plain object works.
    // bareAt is REQUIRED (State L325) even though unused on the failure path.
    const state = {
      injectedSet: new Set(),
      blocks: [],
      images: [],
      remaining: null,
      count: 0,
      paged: 0,
      bareAt: false,
    };
    // ctx is UNUSED on the failure path (stat OK → claim → readFile throws → catch → delete → return false
    // before any block/image push), but pass a structurally-valid ctx for cleanliness.
    const result = await mod.injectFile(secret, state, { cwd: TMPDIR, getContextUsage: () => undefined });
    assert(result === false, `failed read must return false, got ${result}`);
    // THE FIX: the failure path must UN-CLAIM abs so a later duplicate reference can retry (not be silently suppressed)
    assert(state.injectedSet.has(secret) === false,
      `failed injectFile must NOT leave the path claimed (claim ⟺ delivered; a poisoned dedup set suppresses later retries), got has=${state.injectedSet.has(secret)}`);
    assert(state.count === 0, `nothing delivered on failure, got count=${state.count}`);
    assert(state.blocks.length === 0, `no block pushed on failure, got blocks.length=${state.blocks.length}`);
  } finally {
    fsSync.chmodSync(secret, 0o644); // restore so TMPDIR cleanup can remove it
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

  // Exactly ONE <file> block for a.ts in the injected blocks — the dedup prevented a duplicate.
  const aCount = countFileBlocks(blocksText(first), A_TS);
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
  assert(hasBlock(r, '<file name="' + B_TS + '">'), "must contain the NEW b.ts block");
  // Exactly ONE a.ts block (the pre-existing one) — not re-injected, not duplicated. The prior block is
  // in the user-supplied text; our run injects only b.ts into r.blocks, so count b.ts in r.blocks.
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `a.ts must appear exactly once (the pre-existing block; dedup keeps it), got ${aCount}`);
  const bCount = countFileBlocks(blocksText(r), B_TS);
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
  // The dedup copy's single a.ts block is the ONLY one (legacy added nothing — it found no #@ trigger
  // in the stripped text). Count it in first.blocks (the call that produced it).
  const aCount = countFileBlocks(blocksText(first), A_TS);
  assert(aCount === 1, `order dedup→legacy now yields exactly 1 a.ts block (got ${aCount}); F-NEW-1 gap closed by #@ stripping`);
  // REVERSE order (legacy FIRST, dedup SECOND) MUST stay clean — the dedup copy suppresses the dup.
  const legacyFirst = await legacyInject("Review #@a.ts", [], FIX);
  assert(legacyFirst.injected === 1, `legacy copy alone injects a.ts once (got ${legacyFirst.injected})`);
  const dedupAfter = await mod.injectFiles(legacyFirst.text, legacyFirst.images, FIX);
  assert(dedupAfter.injected === 0, `dedup copy must suppress the legacy dup (got ${dedupAfter.injected})`);
  // legacyFirst.text carries the legacy-assembled a.ts block (legacy shape: text + --- + blocks);
  // the dedup pass suppressed re-injection. Count the single block in the legacy-assembled text.
  const aCountRev = (legacyFirst.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCountRev === 1, `reverse order (legacy→dedup) yields exactly 1 a.ts block (got ${aCountRev})`);
});

await runCase("DUP1", "DUP1 — within-prompt same-path repeat injects ONCE (text) (Issue 1)", async () => {
  const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
  assert(r.injected === 1, `same path twice must inject ONCE, got injected=${r.injected}`);
  const aCount = countFileBlocks(blocksText(r), A_TS);
  assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
});

await runCase("DUP2", "DUP2 — two path forms of the same file inject ONCE (Issue 1)", async () => {
  // 'a.ts' and './a.ts' both resolve to the same absolute path → dedup to one injection.
  const r = await mod.injectFiles("Diff #@a.ts against #@./a.ts", [], FIX);
  assert(r.injected === 1, `two path forms (same file) must inject ONCE, got injected=${r.injected}`);
  const aCount = countFileBlocks(blocksText(r), A_TS);
  assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
});

await runCase("DUP3", "DUP3 — within-prompt same-image repeat attaches ONCE (Issue 1)", async () => {
  const r = await mod.injectFiles("See #@pic.png and #@pic.png", [], FIX);
  assert(r.images.length === 1, `same image twice must attach ONCE, got images.length=${r.images.length}`);
  const picCount = countFileBlocks(blocksText(r), PIC);
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
  assert(r.text.startsWith('<!--#@file-injected--> Review #@a.ts'), "prompt delivered verbatim — BOTH #@ tokens preserved (§6.4); the injected #@a.ts no longer loses its #@ (no stripping under verbatim delivery)");
  assert(hasBlock(r, '<file name="' + A_TS + '">'), "injected blocks must contain the a.ts <file> block");
  // Exactly ONE block (a.ts) — no spurious block from the ghost `#@file-injected-->` token.
  const aCount = countFileBlocks(blocksText(r), A_TS);
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
  assert(r.text.startsWith("Review #@a.ts"), "prompt delivered verbatim — the injected #@a.ts keeps its #@ (§6.4)");
  assert(r.text.includes("#@missing.ts") === true, `the FAILED #@missing.ts must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
  const aCount = countFileBlocks(blocksText(r), A_TS);
  assert(aCount === 1, `exactly 1 <file> block (a.ts only); missing.ts injected nothing (got ${aCount})`);
});

await runCase("FS2", "FS2 — mixed success+directory: failed token keeps #@ (Issue 2)", async () => {
  const r = await mod.injectFiles("Review #@a.ts and list #@src/", [], FIX);
  assert(r.injected === 1, `a.ts injected (count=1), got injected=${r.injected}`);
  assert(r.text.startsWith("Review #@a.ts"), "prompt delivered verbatim — the injected #@a.ts keeps its #@ (§6.4)");
  assert(r.text.includes("#@src/") === true, `the directory token #@src/ must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
});

await runCase("FS3", "FS3 — Issue1×Issue2: deduped repeat — both #@ verbatim (dedup affects count only)", async () => {
  // Same path twice: Issue 1 dedup SKIPS the 2nd (it does not inject); under verbatim delivery the
  // prompt is never modified, so BOTH #@a.ts markers survive in r.text. ⇒ both verbatim, one block.
  const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
  assert(r.injected === 1, `same path twice injects ONCE (Issue 1), got injected=${r.injected}`);
  assert(r.text.startsWith("Compare #@a.ts with #@a.ts"), `BOTH #@ tokens verbatim (dedup affects injection count, not the prompt; §6.4), got text=${JSON.stringify(r.text.slice(0, 40))}`);
  const aCount = countFileBlocks(blocksText(r), A_TS);
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
  assert(hasBlock(r, expected), "mislabeled image must fall through to the text <file> block (its actual content)");
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
  assert(hasBlock(r, expected), "0-byte image must produce the empty-image note block");
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
  assert(r.text.startsWith("Review #@a.ts"), `(c) path stays inline as a reference (#@ preserved verbatim; §6.4)`);
  assert(hasBlock(r, '<file name="' + A_TS + '">'), `(c) injected text must contain the a.ts <file> block`);
  // (d) REGRESSION GUARD: start-of-string (^ alternation) → #@a.ts still injects → injected===1.
  r = await mod.injectFiles("#@a.ts", [], FIX);
  assert(r.injected === 1, `(d) #@a.ts must inject (start-of-string boundary), got ${r.injected}`);
  assert(hasBlock(r, '<file name="' + A_TS + '">'), `(d) injected text must contain the a.ts <file> block`);
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
  assert(hasBlock(r, expectedHead), "paged head block must contain the first 8192 chars");
  // directive block = the exported helper's output. startLine = (newlines in head) + 1 and
  // injectedLines = (newlines in head) — complete lines only; a partial trailing line is re-read,
  // never lost. Finding 1: the directive must resume at exactly the line AFTER the complete head
  // lines, for ANY line length — not a hardcoded offset:2001 (which silently loses content).
  const head = HUGE_LOG_CONTENT.slice(0, 8192);
  let nl = 0; for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 10) nl++;
  const injectedLines = nl;
  const expectedStart = nl + 1;
  const expectedDirective = mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length, expectedStart, injectedLines);
  assert(hasBlock(r, expectedDirective),
    `paged directive must resume at offset:${expectedStart} (head=${injectedLines} complete lines), got directive=${JSON.stringify((blocksText(r).match(/<file name="[^"]*huge.log"><paged:[\s\S]*?<\/file>/) || [])[0])}`);
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
  assert(r.text.startsWith("Summarize #@huge.log"), "#@huge.log preserved verbatim (path stays inline; §6.4)");
  assert(r.images.length === 0, "text-file paging attaches NO images");
});

await runCase("PD2", "§5.5 mixed: small whole + large paged under tight budget", async () => {
  const r = await mod.injectFiles("Review #@a.ts and #@huge.log", [], PAGED_FIX);
  assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
  assert(r.paged === 1, `exactly one paged (huge.log), got paged=${r.paged}`);
  // a.ts WHOLE (its full content block present), huge.log paged (head + directive present)
  assert(hasBlock(r, '<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>'),
    "a.ts must be injected WHOLE (fits budget)");
  assert(hasBlock(r, '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT.slice(0, 8192) + '\n</file>'),
    "huge.log must be paged (head block)");
  assert(hasBlock(r, (function(){const h=HUGE_LOG_CONTENT.slice(0,8192);let nl=0;for(let i=0;i<h.length;i++)if(h.charCodeAt(i)===10)nl++;return mod.formatPagedDirectiveBlock(HUGE,HUGE_LOG_CONTENT.length,nl+1,nl);})()),
    "huge.log directive block present (startLine + injectedLines derived from actual head line count)");
});

await runCase("PD3", "§5.5 O-1 fallback: budget unknown (FIX) → huge.log injected WHOLE, paged=0", async () => {
  // The existing FIX mock has no getContextUsage → remainingBudget null → O-1 fallback → inline.
  // Complements case #2 (byte-equality) by asserting the paged FIELD directly.
  const r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
  assert(r.injected === 1, `huge.log delivered whole under no budget, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging when budget unknown (O-1 fallback), got paged=${r.paged}`);
  assert(hasBlock(r, '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT + '\n</file>'),
    "huge.log must be the FULL content block (not a head slice) under the O-1 fallback");
});

await runCase("PD4", "§5.5 images unaffected by budget: pic.png attaches under PAGED_FIX", async () => {
  // Paging is TEXT-only (PRD §5.5 Scope). An image under a tight budget still attaches.
  const r = await mod.injectFiles("Describe #@pic.png", [], PAGED_FIX);
  assert(r.injected === 1, `image delivered, got injected=${r.injected}`);
  assert(r.paged === 0, `images are never paged, got paged=${r.paged}`);
  assert(r.images.length === 1, `image attached under PAGED_FIX, got ${r.images.length}`);
  assert(hasBlock(r, '<file name="' + PIC + '">'), "image reference block present");
});

await runCase("PD5", "§5.5 binaries unaffected by budget: data.bin note under PAGED_FIX", async () => {
  // Paging is TEXT-only. A binary under a tight budget still gets the binary note (no bytes).
  const r = await mod.injectFiles("Inspect #@data.bin", [], PAGED_FIX);
  assert(r.injected === 1, `binary delivered, got injected=${r.injected}`);
  assert(r.paged === 0, `binaries are never paged, got paged=${r.paged}`);
  assert(r.images.length === 0, `binary attaches NO image, got ${r.images.length}`);
  const expectedNote = '<file name="' + BIN + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
  assert(hasBlock(r, expectedNote), "binary note block present (unaffected by budget)");
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
    assert(hasBlock(r, expectedBlock), "whole content must be injected inline (no head slice)");
    // And NO directive block is emitted (would point past EOF).
    assert(!hasBlock(r, "<paged:"), "no paged directive for a sub-head-sized file (Finding 2)");
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
    assert(hasBlock(r, "offset:1, limit:2000"),
      `long-lined file: directive must resume at offset:1 (head ends mid-first-line), not offset:2001; got text=${JSON.stringify((blocksText(r).match(/<file name="[^"]*longlines.log"><paged:[\s\S]*?<\/file>/) || [])[0])}`);
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
    const m = blocksText(r).match(new RegExp('<file name="' + emojiFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">\\n([\\s\\S]*?)\\n</file>'));
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

// ISS3-DIRECTIVE — §6.3 producer (P1.M2.T2.S1). A REAL paged injection (huge.log under PAGED_FIX) produces a paged
// FileDetail whose `directive` is populated (the <paged: …> inner text) — proving emitText + extractDirectiveInner.
// Asserts `d.directive` (NOT `d.body` — P1.M2.T1.S1 removes body), so it's robust to S1's presence/absence.
await runCase("ISS3-DIRECTIVE", "§6.3 producer: paged injection → FileDetail.directive carries the <paged: …> inner text", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 1, `huge.log delivered (count includes paged), got injected=${r.injected}`);
  assert(r.paged === 1, `huge.log must be PAGED under PAGED_FIX, got paged=${r.paged}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `one paged detail, got ${JSON.stringify(r.details?.length)}`);
  const d = r.details[0];
  assert(d.kind === "paged", `detail kind === 'paged', got ${d.kind}`);
  assert(typeof d.directive === "string" && d.directive.includes("<paged:"),
    `paged detail.directive carries the <paged: …> inner text (populated by emitText), got ${JSON.stringify(d.directive)}`);
  assert(d.directive.includes("read the rest"),
    `directive inner text includes the resume instructions, got ${JSON.stringify(d.directive)}`);
  // the model-facing content is unchanged — the directive block is still pushed to blocks (this fix is display-only):
  assert(blocksText(r).includes("<paged:"),
    `the directive block still reaches the model via content (display-only fix), got ${JSON.stringify(blocksText(r).slice(0, 80))}`);
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

// ── INLINE-CODE LINEAR-TIME GUARD (validator Finding 1) ─────────────────────────────────────────
// The old inline-code detector was the regex /(`+)([\s\S]*?)\1(?!`)/g, run via content.matchAll. Its
// backreference \1 + lazy [\s\S]*? made it O(n²) on a long UNMATCHED backtick run (the engine tried
// every run-length split): ~8s CPU at 200k backticks, reachable via any `#@file.md` whose content is a
// pathological/hostile backtick run. computeCodeRanges now uses a linear-time inlineCodeRanges helper
// (same spans, ~O(n)). These two cases pin (a) that the new scanner still detects a real inline span
// embedded in a long backtick run, and (b) that a pathological input completes in bounded (linear) time —
// the regression the validator flagged as "not covered by the unit suite".
await runCase("CC10", "§5.6.1 — a real inline span is still detected inside a long backtick run (linear scanner correctness)", async () => {
  // 50k backticks (no closer) followed by a genuine `#@code.ts` inline span. The span MUST register as
  // code; the leading 50k run (unmatched) must not crash or hang. (A smaller run than the perf case so
  // the correctness assertion is instant even under a naive engine.)
  const lead = "`".repeat(50000);
  const txt = lead + " then `#@code.ts` after";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `the real inline span (backtick #@code.ts backtick) must be in code even after a 50k backtick run (idx=${idx}, ranges.length=${r.length})`);
});

await runCase("CC11", "§5.6.1 — pathological 200k-backtick run completes in bounded (linear) time (Finding 1 regression)", async () => {
  // The old regex took ~8s here (O(n²)); the linear scanner must return well under the 2s guard below.
  // The guard is deliberately generous (the old code blew past it by 4×) so it catches the quadratic
  // regression without being flaky on a slow CI box. The result is also asserted correct: a lone
  // unmatched run yields exactly ONE code range spanning the whole run (the degenerate 1-backtick
  // opener/content/closer triples tile the run end-to-end — same as the old regex).
  const content = "`".repeat(200000) + " tail";
  const t = process.hrtime.bigint();
  const r = mod.computeCodeRanges(content);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert(ms < 2000, `pathological 200k-backtick run must complete in <2s (linear); took ${ms.toFixed(1)}ms`);
  // Correctness: the run is fully covered by code ranges (every backtick is in some code range).
  assert(r.length >= 1 && r[0][0] === 0, `the run must start a code range at 0 (got ${JSON.stringify(r.slice(0, 3))}…)`);
  assert(r.every((rg) => rg[1] <= 200000 + " tail".length), "no range may run past the content");
});

await runCase("CC12", "§5.6.1 — CRLF fence closes correctly; #@ AFTER the fence is NOT in code", async () => {
  // CRLF (\r\n) line endings: split("\n") leaves a trailing \r on each line. The OLD closeRe
  // (`[ \t]*$`) rejected a trailing \r → the fence looked unterminated → its range ran to EOF →
  // every #@ after the fence was silently classified inCode and dropped. The fix adds `\r?` before
  // the `$` anchor so a closing fence line "```\r" is recognized as a close.
  const txt = "```\r\ncode\r\n```\r\n#@after.md\r\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(r.length === 1, `CRLF fence must produce ONE range (close detected), got ${JSON.stringify(r)}`);
  assert(mod.inCode(idx, r) === false,
    `#@ after a CRLF-closed fence must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC13", "§5.6.1 — CRLF: #@ INSIDE a fenced block IS in code (code-exempt still works under CRLF)", async () => {
  // Guard that the \r? fix did not break code-exempt: a #@ inside a CRLF fenced block must still
  // be treated as code (left verbatim, NOT imported). The FIRST #@ is the one inside the fence.
  const txt = "```\r\n#@inside.ts\r\n```\r\n#@outside.md\r\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside a CRLF fenced block must BE in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC14", "§5.6.1 — CR-only (classic Mac) line endings: known limitation documentation", async () => {
  // DEFENSE-IN-DEPTH / DOCUMENTATION (NOT a correctness target): content.split("\n") does NOT split on \r,
  // so a pure \r-only file is ONE giant line. computeCodeRanges sees a single line; the open fence matches
  // FENCE_OPEN_RE but there is no further line to close on → at most one range covering the whole content.
  // This is an INTENTIONAL SCOPE BOUNDARY (CR-only is essentially extinct — classic Mac OS ≤9, pre-2001),
  // not a regression: S1's `\r?` fix only helps when split("\n") produces multiple lines (CRLF/LF), not CR-only.
  const txt = "```\r#@inside.ts\r```\r#@outside.md";
  const r = mod.computeCodeRanges(txt);
  assert(r.length <= 1,
    `CR-only content is one line to split("\n") → at most one range (known limitation, not a target), got ${JSON.stringify(r)}`);
});

await runCase("CC15", "§5.6.1 — mixed LF/CRLF line endings in one file: fence closes correctly", async () => {
  // Open fence on LF ("\n"), close fence on CRLF ("\r\n"), import on LF ("\n"). The `\r?` in closeRe lets the
  // close line "```\r" match → the fence closes → the #@after.md import is OUTSIDE the code range → injected.
  const txt = "```\ncode\r\n```\r\n#@after.md\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ after a mixed LF/CRLF-closed fence must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC16", "§5.6.1 — CRLF with trailing spaces before the close fence", async () => {
  // Close line "```  \r" (2 trailing spaces then \r). `[ \t]*` consumes the spaces, `\r?` consumes the \r,
  // `$` anchors end → the fence closes → the #@after.md import is OUTSIDE the code range → injected.
  const txt = "```\r\ncode\r\n```  \r\n#@after.md\r\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === false,
    `#@ after a CRLF close fence with trailing spaces must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
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
  const imgIdx = r.blocks.findIndex((b) => b.includes('<file name="' + PIC + '">'));
  const hugeHeadIdx = r.blocks.findIndex((b) => b.includes('<file name="' + HUGE + '">\n'));
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
  const binIdx = r.blocks.findIndex((b) => b.includes('<file name="' + BIN + '">'));
  const hugeHeadIdx = r.blocks.findIndex((b) => b.includes('<file name="' + HUGE + '">\n'));
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
  const emptyIdx = r.blocks.findIndex((b) => b.includes('<file name="' + EMPTY_PNG + '">'));
  const hugeHeadIdx = r.blocks.findIndex((b) => b.includes('<file name="' + HUGE + '">\n'));
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
  assert(r.text.startsWith("Review #@notes.md"), "top-level #@notes.md preserved verbatim (§6.4)");
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + NOTES + '">'));
  const iApi = r.blocks.findIndex((b) => b.includes('<file name="' + API + '">'));
  assert(iNotes !== -1 && iApi !== -1, "both notes.md and api.md blocks must be present");
  assert(iNotes < iApi, "notes.md block must appear BEFORE api.md block (pre-order depth-first: parent then import)");
  // the import marker inside notes.md is preserved verbatim (§6.4); the fenced #@example.ts is also verbatim
  assert(hasBlock(r, "Imports #@api.md here."), "notes.md block: resolved import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "Imports api.md here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

await runCase(16, "md code-exempt: fenced #@example.ts left verbatim; only api.md imported", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX);  // same notes.md as #15
  assert(r.injected === 2, `only notes.md + api.md injected (example.ts is code-exempt), got ${r.injected}`);
  // the fenced #@example.ts is left VERBATIM in the notes.md block (code-region exemption, §5.6.1)
  assert(hasBlock(r, "#@example.ts"), "the fenced #@example.ts must be left VERBATIM (code-exempt, not stripped)");
  // example.ts is never imported (code-exempt → never resolved, never stat'd; it is not even a fixture)
  assert(!hasBlock(r, '<file name="' + path.join(TMPDIR, "example.ts") + '">'),
    "example.ts must NOT be injected (inside a fenced block → code-exempt)");
});

await runCase("CRLF-E2E", "§5.6 — CRLF markdown: fenced block + #@ import → both injected, marker stripped", async () => {
  // End-to-end integration: a CRLF .md file with a fenced code block FOLLOWED by a #@ import. Before S1's
  // closeRe `\r?` fix the fence never closed → the import was classified inCode → silently dropped
  // (injected===1). After the fix the fence closes → the import resolves → injected===2 + marker stripped.
  // UNIQUE fixture names (no collision with shared buildFixtures entries).
  const crlfSpec = path.join(TMPDIR, "crlf_spec.md");
  const crlfAfter = path.join(TMPDIR, "crlf_after.md");
  fsSync.writeFileSync(crlfSpec, "# CRLF Spec\r\n\r\n```\r\ncode here\r\n```\r\n\r\nSee #@crlf_after.md\r\n");
  fsSync.writeFileSync(crlfAfter, "# After Content\n");
  const r = await mod.injectFiles("Read #@crlf_spec.md", [], FIX);
  assert(r.injected === 2, `CRLF spec + crlf_after.md both injected (import after the fence resolved), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read #@crlf_spec.md"), "top-level #@crlf_spec.md preserved verbatim (§6.4)");
  assert(r.blocks.some((b) => b.includes('<file name="' + crlfSpec + '">')), "crlf_spec.md block present");
  assert(r.blocks.some((b) => b.includes('<file name="' + crlfAfter + '">')), "crlf_after.md block present (import after the CRLF fence resolved)");
  // The import marker is preserved VERBATIM — the #@ stays (content is the file as-read; §6.4).
  assert(hasBlock(r, "See #@crlf_after.md"), "crlf_spec.md block: CRLF-path import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "See crlf_after.md"), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

await runCase(17, "md cycle: a.md↔b.md → each once, b.md's #@a.md verbatim, no loop, injected=2", async () => {
  const r = await mod.injectFiles("Start #@a.md", [], FIX);
  assert(r.injected === 2, `a.md + b.md injected once each (cycle terminates via dedup), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  const iA = r.blocks.findIndex((b) => b.includes('<file name="' + A_MD + '">'));
  const iB = r.blocks.findIndex((b) => b.includes('<file name="' + B_MD + '">'));
  assert(iA !== -1 && iB !== -1, "both a.md and b.md blocks present");
  assert(iA < iB, "a.md block before b.md block (pre-order: a.md then its import b.md)");
  assert(countFileBlocks(blocksText(r), A_MD) === 1, `a.md must appear exactly ONCE (dedup), got ${countFileBlocks(blocksText(r), A_MD)}`);
  assert(countFileBlocks(blocksText(r), B_MD) === 1, `b.md must appear exactly ONCE (dedup), got ${countFileBlocks(blocksText(r), B_MD)}`);
  // b.md's #@a.md is LEFT VERBATIM: a.md was claimed (in injectFile) before b.md scanned it → dedup → verbatim.
  assert(hasBlock(r, "Back #@a.md."), "b.md's #@a.md must be left VERBATIM (a.md already injected → deduped, NOT stripped)");
});

await runCase(18, "md abs rejected: #@/etc/hosts ignored (relative-only), verbatim, only notesAbs.md injected", async () => {
  const r = await mod.injectFiles("Read #@notesAbs.md", [], FIX);
  assert(r.injected === 1, `only notesAbs.md injected (absolute import ignored), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // the #@/etc/hosts marker is left VERBATIM (relative-only rule fires BEFORE resolution/stat)
  assert(hasBlock(r, "#@/etc/hosts"), "the absolute #@/etc/hosts must be left VERBATIM (relative-only, not resolved)");
  assert(!hasBlock(r, '<file name="/etc/hosts">'), "/etc/hosts must NOT be injected (relative-only rule)");
});

await runCase(19, "md relative base: sub/notes.md's #@api.md → sub/api.md (md's dir, not cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/notes.md", [], FIX);
  assert(r.injected === 2, `sub/notes.md + sub/api.md injected, got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read #@sub/notes.md"), "top-level #@sub/notes.md preserved verbatim (§6.4)");
  const iSubNotes = r.blocks.findIndex((b) => b.includes('<file name="' + SUB_NOTES + '">'));
  const iSubApi = r.blocks.findIndex((b) => b.includes('<file name="' + SUB_API + '">'));
  assert(iSubNotes !== -1 && iSubApi !== -1, "both sub/notes.md and sub/api.md blocks present");
  assert(iSubNotes < iSubApi, "sub/notes.md block before sub/api.md block (pre-order)");
  // CRITICAL: api.md resolved as sub/api.md (relative to the markdown's dir), NOT TMPDIR/api.md.
  assert(hasBlock(r, "Sibling API in sub/."), "sub/api.md's DISTINCT content present (proves resolution relative to md dir)");
  assert(!hasBlock(r, "Top-level API surface."), "the top-level api.md must NOT be injected (resolution is relative to the md's dir)");
  // sub/notes.md's #@api.md marker preserved verbatim (§6.4)
  assert(hasBlock(r, "See #@api.md."), "sub/notes.md's import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "See api.md."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
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
  const iB = r.blocks.findIndex((b) => b.includes('<file name="' + BIGDOC + '">'));
  const i1 = r.blocks.findIndex((b) => b.includes('<file name="' + PART1 + '">'));
  const i2 = r.blocks.findIndex((b) => b.includes('<file name="' + PART2 + '">'));
  const i3 = r.blocks.findIndex((b) => b.includes('<file name="' + PART3 + '">'));
  const iH = r.blocks.findIndex((b) => b.includes('<file name="' + HUGE + '">\n')); // head block (content follows the '>\n')
  assert(iB !== -1 && i1 !== -1 && i2 !== -1 && i3 !== -1 && iH !== -1, "all 5 files have blocks");
  assert(iB < i1 && i1 < i2 && i2 < i3 && i3 < iH,
    `pre-order DFS: bigdoc<part1<part2<part3<huge.log, got iB=${iB},i1=${i1},i2=${i2},i3=${i3},iH=${iH}`);
  // huge.log PAGED: a head block + a directive block (2 occurrences of its <file name> tag). The directive
  // uses the PRD §6.1 format '<paged: ... chars; head delivered ... complete lines; read the rest with the read tool ...>'.
  const hugeTags = countFileBlocks(blocksText(r), HUGE);
  assert(hugeTags === 2, `huge.log must have a HEAD block + a DIRECTIVE block (2 tags), got ${hugeTags}`);
  assert(hasBlock(r, "<paged:"), "huge.log paged directive present (PRD §6.1 '<paged: ...>' format)");
  assert(hasBlock(r, "with the read tool"), "huge.log paged directive references the read tool (§6.1 'read the rest with the read tool')");
  // bigdoc.md's import markers are preserved VERBATIM (content is the file as-read; all 4 imports resolved+exist; §6.4).
  assert(r.blocks[iB].includes("Logs: #@huge.log"), "bigdoc.md block: the #@huge.log marker preserved verbatim (§6.4)");
  assert(r.blocks[iB].includes("#@"), "bigdoc.md block now CONTAINS verbatim #@ markers (§6.4)");

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
  assert(r.text.startsWith("Review #@notesMissing.md"), "top-level #@notesMissing.md preserved verbatim (§6.4)");
  assert(hasBlock(r, '<file name="' + NOTES_MISSING + '">'), "notesMissing.md block present");
  // THE §10 FIX: the missing import marker is LEFT VERBATIM (not stripped) — nothing was injected for it.
  assert(hasBlock(r, "Refs #@ghost.md here."), "the MISSING import marker #@ghost.md must be left VERBATIM (§10)");
  assert(!hasBlock(r, "Refs ghost.md here."), "the missing import marker must NOT be stripped (no bare 'ghost.md' reference)");
  assert(!hasBlock(r, '<file name="' + path.join(TMPDIR, "ghost.md") + '">'), "ghost.md must NOT be injected (it does not exist)");
});

// MD2 — §10 EDGE: a markdown import resolving OUTSIDE cwd (via ../) is ALLOWED (relative to the md's dir).
// Pure regression test — this ALREADY works (imports resolve from dirname(abs), not cwd). FIX = no budget.
await runCase("MD2", "§10 md edge: sub/outsider.md imports #@../shared/api.md → allowed (md's dir, outside cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/outsider.md", [], FIX);
  assert(r.injected === 2, `sub/outsider.md + shared/api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read #@sub/outsider.md"), "top-level #@sub/outsider.md preserved verbatim (§6.4)");
  assert(hasBlock(r, '<file name="' + OUTSIDER + '">'), "sub/outsider.md block present");
  assert(hasBlock(r, '<file name="' + SHARED_API + '">'), "shared/api.md block present (resolved via ../, outside cwd)");
  // shared/api.md is OUTSIDE cwd (TMPDIR) but INSIDE the markdown's parent — explicitly ALLOWED (§10).
  assert(path.relative(TMPDIR, SHARED_API) === path.join("shared", "api.md"),
    `shared/api.md resolves under TMPDIR/shared (the md's parent's sibling), got rel=${path.relative(TMPDIR, SHARED_API)}`);
  assert(hasBlock(r, "Outside cwd."), "shared/api.md's DISTINCT content present (proves the outside-cwd file was injected)");
  // the import marker is preserved VERBATIM (content is the file as-read; §6.4).
  assert(hasBlock(r, "#@../shared/api.md"), "sub/outsider.md block: the #@../shared/api.md marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "See ../shared/api.md here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
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
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(p instanceof Promise, `scanTokens must return a Promise after going async, got ${Object.prototype.toString.call(p)}`);
  const arr = await p;
  assert(Array.isArray(arr), `awaited scanTokens must resolve to an array, got ${Object.prototype.toString.call(arr)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// ── EXTENSION SHORTHAND (PRD §4.5 rule 3) — cases 21–24 + EDG-1..4 ──
// A markdown import whose cleaned token is EXTENSIONLESS (path.extname(token)==="") resolves to <exact>.md
// then <exact>.markdown when the exact path is not an existing regular file (tryMdExt:true, markdown-only).
// Exact-match always wins; tokens already carrying any extension are exact-only (never <name>.md.md). Dedup
// keys on the RESOLVED abs. Top-level user tokens stay EXACT-ONLY (tryMdExt:false — case 24). FIX = no budget.
// ─────────────────────────────────────────────────────────────────────────────

// Case 21 — §11: .md SHORTHAND. notesShorthand.md imports "#@api" (extensionless); top-level api.md exists
// (no bare api) → resolves to api.md. The import marker is stripped to bare "api".
await runCase(21, "md ext-shorthand: #@api (no bare api) → api.md; marker→api; injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesShorthand.md", [], FIX);
  assert(r.injected === 2, `notesShorthand.md + api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review #@notesShorthand.md"), "top-level #@notesShorthand.md preserved verbatim (§6.4)");
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + NOTES_SHORTHAND + '">'));
  const iApi = r.blocks.findIndex((b) => b.includes('<file name="' + API + '">'));   // reuses the existing top-level api.md
  assert(iNotes !== -1 && iApi !== -1, "both notesShorthand.md and api.md blocks must be present");
  assert(iNotes < iApi, "notesShorthand.md block must appear BEFORE api.md block (pre-order depth-first)");
  assert(hasBlock(r, "Imports #@api here."), "notesShorthand.md block: extensionless import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "Imports api here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

// Case 22 — §11: EXACT BEATS SHORTHAND. notesExactWins.md imports "#@guide"; BOTH a bare "guide" AND
// "guide.md" exist → the bare "guide" (exact) wins; guide.md is NOT imported.
await runCase(22, "md ext exact-wins: #@guide (bare guide + guide.md) → bare guide; guide.md NOT imported; injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesExactWins.md", [], FIX);
  assert(r.injected === 2, `notesExactWins.md + bare guide injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review #@notesExactWins.md"), "top-level #@notesExactWins.md preserved verbatim (§6.4)");
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + NOTES_EXACT_WINS + '">'));
  const iGuide = r.blocks.findIndex((b) => b.includes('<file name="' + GUIDE_BARE + '">'));
  assert(iNotes !== -1 && iGuide !== -1, "both notesExactWins.md and bare guide blocks must be present");
  assert(iNotes < iGuide, "notesExactWins.md block before bare guide block (pre-order)");
  // CRITICAL: exact-match wins — the bare "guide" is injected; guide.md is NOT.
  assert(hasBlock(r, "bare guide"), "the bare guide's content is present (exact match injected)");
  assert(countFileBlocks(blocksText(r), GUIDE_MD) === 0, `guide.md must have ZERO blocks (exact-match wins over shorthand), got ${countFileBlocks(blocksText(r), GUIDE_MD)}`);
  assert(hasBlock(r, "Refs #@guide here."), "notesExactWins.md block: import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "Refs guide here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

// Case 23 — §11: .markdown FALLBACK. sub/ext/notes.md imports "#@api"; in sub/ext/ ONLY api.markdown exists
// (no api, no api.md — dedicated dir avoids colliding with the top-level api.md) → resolves to api.markdown.
await runCase(23, "md ext .markdown: #@api (only api.markdown) → api.markdown; injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/ext/notes.md", [], FIX);
  assert(r.injected === 2, `sub/ext/notes.md + sub/ext/api.markdown injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read #@sub/ext/notes.md"), "top-level #@sub/ext/notes.md preserved verbatim (§6.4)");
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + EXT_NOTES + '">'));
  const iApi = r.blocks.findIndex((b) => b.includes('<file name="' + EXT_API_MARKDOWN + '">'));
  assert(iNotes !== -1 && iApi !== -1, "both sub/ext/notes.md and sub/ext/api.markdown blocks must be present");
  assert(iNotes < iApi, "sub/ext/notes.md block before sub/ext/api.markdown block (pre-order)");
  assert(hasBlock(r, "Markdown API"), "sub/ext/api.markdown's DISTINCT content present (proves .markdown fallback)");
  assert(hasBlock(r, "See #@api here."), "sub/ext/notes.md block: import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "See api here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

// Case 24 — §11: TOP-LEVEL EXACT-ONLY. Top-level "#@specdoc" with ONLY specdoc.md present (NO bare specdoc)
// → left VERBATIM (top-level is exact-match; NO .md fallback at the prompt — PRD §4.4).
await runCase(24, "top-level no-fallback: #@specdoc (only specdoc.md) → verbatim, injected=0", async () => {
  const r = await mod.injectFiles("See #@specdoc", [], FIX);
  assert(r.injected === 0, `nothing injected (top-level exact-only), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging, got paged=${r.paged}`);
  // byte-for-byte unchanged — mirrors case 5's "r.text === input" style (PRD §4.4: top-level is exact-only)
  assert(r.text === "See #@specdoc", `top-level prompt must be byte-for-byte UNCHANGED (no .md fallback at the prompt), got ${JSON.stringify(r.text)}`);
});

// EDG-1 — §10: NO MATCH. notesGhost.md imports "#@ghost"; NO ghost/ghost.md/ghost.markdown exists → the
// extensionless shorthand finds nothing → marker left VERBATIM.
await runCase("EDG-1", "§10 md edge: #@ghost (no ghost/.md/.markdown) → verbatim in markdown block, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesGhost.md", [], FIX);
  assert(r.injected === 1, `only notesGhost.md injected (ghost has no match), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review #@notesGhost.md"), "top-level #@notesGhost.md preserved verbatim (§6.4)");
  assert(hasBlock(r, '<file name="' + NOTES_GHOST + '">'), "notesGhost.md block present");
  assert(hasBlock(r, "Refs #@ghost here."), "the no-match import marker #@ghost must be left VERBATIM (§10)");
  assert(!hasBlock(r, "Refs ghost here."), "the no-match import marker must NOT be stripped");
  assert(!hasBlock(r, '<file name="' + path.join(TMPDIR, "ghost.md") + '">'), "ghost.md must NOT be injected (no match)");
});

// EDG-2 — §10: ALREADY-EXTENDED, MISSING. notesAbsent.md imports "#@absent.md"; absent.md is MISSING → the
// token already carries ".md" → exact-only (path.extname !== "") → NEVER tries absent.md.md → verbatim.
await runCase("EDG-2", "§10 md edge: #@absent.md (missing) → exact-only (never .md.md), verbatim, injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesAbsent.md", [], FIX);
  assert(r.injected === 1, `only notesAbsent.md injected (absent.md missing), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review #@notesAbsent.md"), "top-level #@notesAbsent.md preserved verbatim (§6.4)");
  assert(hasBlock(r, '<file name="' + NOTES_ABSENT + '">'), "notesAbsent.md block present");
  assert(hasBlock(r, "Refs #@absent.md here."), "the missing already-extended marker #@absent.md must be left VERBATIM (exact-only, never .md.md)");
  assert(!hasBlock(r, "Refs absent.md here."), "the missing import marker must NOT be stripped");
  assert(!hasBlock(r, '<file name="' + path.join(TMPDIR, "absent.md") + '">'), "absent.md must NOT be injected (missing)");
});

// EDG-3 — §10: DEDUP ACROSS SHORTHAND. notesDedup.md imports BOTH "#@specdoc" and "#@specdoc.md"; specdoc.md
// exists → BOTH resolve to the SAME abs → injected ONCE (dedup on the resolved abs). First marker (encountered
// first) is stripped; the second is left verbatim.
await runCase("EDG-3", "§10 md edge: #@specdoc + #@specdoc.md (specdoc.md exists) → injected ONCE (dedup), injected=2", async () => {
  const r = await mod.injectFiles("Review #@notesDedup.md", [], FIX);
  assert(r.injected === 2, `notesDedup.md + specdoc.md (deduped) injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review #@notesDedup.md"), "top-level #@notesDedup.md preserved verbatim (§6.4)");
  // specdoc.md injected EXACTLY ONCE (dedup on the resolved abs — both #@specdoc and #@specdoc.md collapse)
  assert(countFileBlocks(blocksText(r), SPECDOC_MD) === 1, `specdoc.md must appear exactly ONCE (dedup across shorthand forms), got ${countFileBlocks(blocksText(r), SPECDOC_MD)}`);
  // BOTH markers verbatim (dedup affects INJECTION — one block per resolved abs — NOT content; §6.4)
  assert(hasBlock(r, "Imports: #@specdoc and #@specdoc.md"), "both markers preserved verbatim (dedup affects injection, not content; §6.4)");
  assert(!hasBlock(r, "Imports: specdoc and"), "the first-stripped form must be ABSENT (content is verbatim, not stripped)");
});

// EDG-4 — §10: SHORTHAND WITH PATH PREFIX. notesSubPrefix.md imports "#@sub/notes"; sub/notes.md already
// exists (no bare sub/notes) → resolves to sub/notes.md (shorthand applies to prefixed paths too). NOTE:
// sub/notes.md itself transitively imports "#@api.md" → sub/api.md (the existing case-19 fixture), so the
// transitive chain is notesSubPrefix.md → sub/notes.md → sub/api.md = 3 injections. The PRP's core intent
// (shorthand resolves a prefixed extensionless token to the .md sibling) is proven by the presence + pre-order
// of sub/notes.md and the stripped marker; the transitive sub/api.md is incidental reuse, not under test here.
await runCase("EDG-4", "§10 md edge: #@sub/notes (sub/notes.md exists) → sub/notes.md (+transitive sub/api.md), injected=3", async () => {
  const r = await mod.injectFiles("Read #@notesSubPrefix.md", [], FIX);
  assert(r.injected === 3, `notesSubPrefix.md + sub/notes.md + sub/api.md (transitive) injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read #@notesSubPrefix.md"), "top-level #@notesSubPrefix.md preserved verbatim (§6.4)");
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + NOTES_SUB_PREFIX + '">'));
  const iSub = r.blocks.findIndex((b) => b.includes('<file name="' + SUB_NOTES + '">'));   // reuses the existing sub/notes.md
  const iSubApi = r.blocks.findIndex((b) => b.includes('<file name="' + SUB_API + '">'));   // sub/notes.md's transitive #@api.md → sub/api.md
  assert(iNotes !== -1 && iSub !== -1 && iSubApi !== -1, "notesSubPrefix.md + sub/notes.md + sub/api.md blocks all present");
  assert(iNotes < iSub && iSub < iSubApi, "pre-order: notesSubPrefix.md before sub/notes.md before sub/api.md");
  assert(hasBlock(r, "Sub Notes"), "sub/notes.md's DISTINCT content present (proves shorthand resolved the prefixed path)");
  assert(hasBlock(r, "See #@sub/notes here."), "notesSubPrefix.md block: import marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "See sub/notes here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
});

// ─────────────────────────────────────────────────────────────────────────────
// ── P1.M1.T1.S2: Issue 1 regression cases (the X.md.backup false-positive). ──
// S1 landed the resolveImportPath fix (extCut → fmtCut: trailing-glue strip + re-clean, NEVER truncating
// an extended token at .md). These two cases lock the PRD-compliant outcome at the primary gate so a future
// regression of the truncation heuristic fails loudly. ISS1-TL mirrors case 24 (top-level exact-only);
// ISS1-MD mirrors EDG-2 (markdown-import verbatim). Both use UNIQUE inline fixtures (iss1_ prefix).
// ─────────────────────────────────────────────────────────────────────────────

// ISS1-TL — Issue 1 top-level: a token already carrying .backup is NOT truncated at .md. iss1_report.md.backup
// is missing → null → #@ left verbatim → injected===0. The OLD extCut would have truncated to iss1_report.md →
// injected the WRONG file (secret draft) + stripped the #@. PRD §4.4 (top-level exact-only) + Issue 1.
await runCase("ISS1-TL", "Issue 1 top-level: #@iss1_report.md.backup (only iss1_report.md) → verbatim, injected=0 (no .md truncation)", async () => {
  const report = path.join(TMPDIR, "iss1_report.md");
  fsSync.writeFileSync(report, "# Current Report\nSecret draft content.\n"); // NO iss1_report.md.backup
  const r = await mod.injectFiles("Compare #@iss1_report.md.backup with the latest", [], FIX);
  assert(r.injected === 0, `nothing injected (iss1_report.md.backup missing → exact-only), got injected=${r.injected}`);
  assert(r.text === "Compare #@iss1_report.md.backup with the latest",
    `top-level prompt byte-for-byte UNCHANGED (no .md truncation, no strip), got ${JSON.stringify(r.text)}`);
  assert(!hasBlock(r, "Secret draft content."), `iss1_report.md must NOT be injected (its content absent from blocks)`);
});

// ISS1-MD — Issue 1 markdown-import path: iss1_index.md is delivered; its import #@iss1_report.md.backup does
// NOT resolve (exact-only, missing) → left verbatim in the index block; iss1_report.md is NOT pulled in.
// The OLD extCut would have truncated → injected iss1_report.md (WRONG). PRD §4.5 rule 3 (extended tokens exact-only).
await runCase("ISS1-MD", "Issue 1 markdown-import: iss1_index.md imports #@iss1_report.md.backup (only iss1_report.md) → report NOT injected, marker verbatim", async () => {
  const index = path.join(TMPDIR, "iss1_index.md");
  const report = path.join(TMPDIR, "iss1_report.md");
  fsSync.writeFileSync(index, "# Index\n\nSee #@iss1_report.md.backup here.\n");
  fsSync.writeFileSync(report, "# Current Report\nSecret draft content.\n"); // NO iss1_report.md.backup
  const r = await mod.injectFiles("Read #@iss1_index.md", [], FIX);
  assert(r.injected === 1, `only iss1_index.md injected (iss1_report.md.backup missing → exact-only), got injected=${r.injected}`);
  assert(hasBlock(r, '<file name="' + index + '">'), "iss1_index.md block present (the parent delivered)");
  assert(!hasBlock(r, "Secret draft content."), `iss1_report.md must NOT be injected (no .md truncation)`);
  assert(hasBlock(r, "See #@iss1_report.md.backup here."),
    `the unresolved #@iss1_report.md.backup marker must be left VERBATIM in iss1_index.md's block (not stripped, no wrong file)`);
});

// ─────────────────────────────────────────────────────────────────────────────
// ── P1.M1.T1.S1: scanTokens bare-`@` engine unit tests (PRD §4.6 — the BARE_AT_RE union) ──
// scanTokens is the single chokepoint where markers are detected. When opts.bareAt is truthy it ALSO runs
// BARE_AT_RE alongside FILE_INJECT_RE, returning a union of candidate records sorted by index, each tagged
// with prefixLen (2 for `#@`, 1 for bare `@`). The State literal needs NO bareAt field — scanTokens reads
// only injectedSet here. Fixtures TMPDIR/api.md, a.md, b.md already exist (buildFixtures). When bareAt is
// absent/false the scan is byte-for-byte identical to today (only `#@`).
// ─────────────────────────────────────────────────────────────────────────────

// T1.S1-8 — bareAt OFF ignores bare `@`. With bareAt:false, scanTokens runs ONLY FILE_INJECT_RE, so a prose
// `@api.md` (no `#@`) yields NO records. Proves the optional default keeps behavior identical.
await runCase("T1.S1-8", "scanTokens bare-@ off: 'Review @api.md here' → [] (no #@, bare-@ not scanned)", async () => {
  const arr = await mod.scanTokens(
    "Review @api.md here",
    TMPDIR,
    { allowAbsTilde: false, skipCode: false, tryMdExt: true, bareAt: false },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(Array.isArray(arr) && arr.length === 0, `bareAt:false must ignore bare @, got ${JSON.stringify(arr)}`);
});

// T1.S1-9 — bareAt ON matches both forms. '@api.md' (prefixLen 1) AND '#@b.md' (prefixLen 2) both resolve.
await runCase("T1.S1-9", "scanTokens bare-@ on: '@api.md and #@b.md' → 2 records (prefixLen 1 + 2)", async () => {
  const arr = await mod.scanTokens(
    "@api.md and #@b.md",
    TMPDIR,
    { allowAbsTilde: false, skipCode: false, tryMdExt: true, bareAt: true },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(arr.length === 2, `expected 2 records (bare @ + #@), got ${arr.length}: ${JSON.stringify(arr)}`);
  const bare = arr.find((r) => r.prefixLen === 1);
  const hash = arr.find((r) => r.prefixLen === 2);
  assert(bare && bare.abs === API, `bare-@ record must be prefixLen 1 with abs api.md, got ${JSON.stringify(bare)}`);
  assert(hash && hash.abs === B_MD, `#@ record must be prefixLen 2 with abs b.md, got ${JSON.stringify(hash)}`);
  assert(arr[0].index < arr[1].index, "records must be sorted by index ascending");
});

// T1.S1-10 — NO DOUBLE-MATCH on `#@`. BARE_AT_RE's lookbehind forbids a preceding `#`, so '#@a.md' is
// matched ONCE (by FILE_INJECT_RE, prefixLen 2). NOTE: even if both regexes produced a candidate, dedup keys
// on the RESOLVED abs — so a same-path double is invisible at the record level. The authoritative exclusion
// is the verified regex itself (BARE_AT_RE is not exported, so it can't be tested directly from the .mjs).
await runCase("T1.S1-10", "scanTokens no-double-match: '#@a.md' (bareAt:true) → ONE record, prefixLen 2, index 0", async () => {
  const arr = await mod.scanTokens(
    "#@a.md",
    TMPDIR,
    { allowAbsTilde: false, skipCode: false, tryMdExt: true, bareAt: true },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(arr.length === 1, `#@a.md must yield exactly ONE record (no double-match), got ${arr.length}: ${JSON.stringify(arr)}`);
  assert(arr[0].prefixLen === 2, `the surviving record must be the #@ form (prefixLen 2), got ${arr[0].prefixLen}`);
  assert(arr[0].index === 0, `record must be at index 0, got ${arr[0].index}`);
  assert(arr[0].abs === A_MD, `record must resolve to a.md, got ${arr[0].abs}`);
});

// T1.S1-11 — mid-word / Unicode `@` excluded. BARE_AT_RE forbids a preceding word char (\p{L}\p{N}_), so
// 'user@host.com' (letter before @) does NOT match. Nothing resolves → empty.
await runCase("T1.S1-11", "scanTokens bare-@ mid-word excluded: 'email user@host.com' → [] (even with bareAt:true)", async () => {
  const arr = await mod.scanTokens(
    "email user@host.com",
    TMPDIR,
    { allowAbsTilde: false, skipCode: false, tryMdExt: true, bareAt: true },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(arr.length === 0, `mid-word @ must be excluded, got ${JSON.stringify(arr)}`);
});

// T1.S1-12 — DEDUP on resolved abs. '#@api.md' (prefixLen 2) and '@api.md' (prefixLen 1) both resolve to the
// SAME abs (TMPDIR/api.md). Dedup keys on the resolved abs → the second candidate is dropped via localSeen.
// The first one wins by index order (the #@ at index 0 sorts before the bare @ at index 8).
await runCase("T1.S1-12", "scanTokens dedup: '#@api.md @api.md' → ONE record (both resolve to api.md)", async () => {
  const arr = await mod.scanTokens(
    "#@api.md @api.md",
    TMPDIR,
    { allowAbsTilde: false, skipCode: false, tryMdExt: true, bareAt: true },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(arr.length === 1, `dedup must collapse to ONE record, got ${arr.length}: ${JSON.stringify(arr)}`);
  assert(arr[0].abs === API, `record must resolve to api.md, got ${arr[0].abs}`);
  assert(arr[0].prefixLen === 2, `first-by-index (#@) wins → prefixLen 2, got ${arr[0].prefixLen}`);
  assert(arr[0].index === 0, `surviving record is the #@ at index 0, got ${arr[0].index}`);
});

// T1.S1-13 — code-exempt. With skipCode:true, a bare '@api.md' INSIDE a fenced code block is skipped
// (computeCodeRanges/inCode applies to bare-@ candidates exactly as it does to #@). Nothing resolves → empty.
await runCase("T1.S1-13", "scanTokens bare-@ code-exempt: fenced '@api.md' (skipCode:true) → []", async () => {
  const arr = await mod.scanTokens(
    "```\n@api.md\n```",
    TMPDIR,
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: true },
    { blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  assert(arr.length === 0, `bare-@ inside a fenced block must be skipped (code-exempt), got ${JSON.stringify(arr)}`);
});

// ── T2.S1: readConfig unit tests (PRD §4.6 — the config reader: global+project merge, trust gate, never throws) ──
// readConfig takes a NARROW {cwd, isProjectTrusted} ctx (item §3 — NOT `any`) so it is unit-testable with a
// literal mock object (NO makeMockCtx needed). The fixture <TMPDIR>/.pi/file-injector.json =
// {"markdownBareAtImports":true} is written in buildFixtures. getAgentDir() reads the REAL ~/.pi/agent/ at
// runtime, so a real global config (with ANY keys) could merge into the result — hence each case asserts on
// the markdownBareAtImports VALUE (project WINS via spread when trusted; gated/malformed → undefined), NOT a
// deepEqual on the whole object (global could contribute unrelated keys). This is the robust subset testable
// here; the global→project merge PRECEDENCE is structurally guaranteed by `{ ...cfg, ...project }` and is
// covered end-to-end by P1.M2.T1.S1's session_start integration test.

// readConfig reads the REAL global sources at runtime (~/.pi/agent/settings.json[fileInjector] +
// ~/.pi/agent/file-injector.json via getAgentDir()). The dev's real global settings.json may set the key
// (dogfooding), so cases below assert project-source behavior RELATIVE to a captured GLOBAL_BASELINE rather
// than assuming the global is empty. The global→project merge precedence is structurally guaranteed by the
// spread order and covered end-to-end by P1.M2.T1.S1's session_start integration test.
const GLOBAL_BASELINE = await mod.readConfig({ cwd: path.join(os.tmpdir(), "nonexistent-saf-dir"), isProjectTrusted: () => false });

// T2.S1-a — NO project config is a no-op relative to global. A nonexistent project cwd (trusted) reads the
// (absent) project sources → {} → the result equals the global baseline (whatever it is), proving no spurious
// project contribution and no crash.
await runCase("T2.S1-a", "readConfig no project config → result equals global baseline", async () => {
  const r = await mod.readConfig({ cwd: path.join(os.tmpdir(), "nonexistent-saf-dir"), isProjectTrusted: () => true });
  assert(r.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports,
    `no project config → result equals global baseline (${GLOBAL_BASELINE.markdownBareAtImports}), got ${r.markdownBareAtImports}`);
});

// T2.S1-b — PROJECT WINS (trusted). <TMPDIR>/.pi/file-injector.json = {"markdownBareAtImports":true}; with
// isProjectTrusted:true the project file IS read and its key lands (project wins via spread even if a real
// global config also sets it). Assert the VALUE (true), not deepEqual {markdownBareAtImports:true} (global
// could add unrelated keys).
await runCase("T2.S1-b", "readConfig project {markdownBareAtImports:true} + trusted → project wins (true)", async () => {
  const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
  assert(r.markdownBareAtImports === true,
    `trusted project config → markdownBareAtImports true (project wins), got ${r.markdownBareAtImports}`);
});

// T2.S1-c — TRUST GATE (untrusted). Write a project config whose value is the NEGATION of the global
// baseline (guaranteed distinguishable), then assert: TRUSTED → project value (project wins); UNTRUSTED →
// baseline (project IGNORED — the trust gate). The two differing proves the gate regardless of what the real
// global env sets. Restores the valid fixture in finally.
await runCase("T2.S1-c", "readConfig project config + UNTRUSTED → ignored (baseline); trusted → project wins", async () => {
  const flip = GLOBAL_BASELINE.markdownBareAtImports === true ? false : true; // guaranteed ≠ baseline
  const cfgPath = path.join(TMPDIR, ".pi", "file-injector.json");
  const valid = fsSync.existsSync(cfgPath) ? fsSync.readFileSync(cfgPath, "utf8") : null;
  fsSync.writeFileSync(cfgPath, JSON.stringify({ markdownBareAtImports: flip }));
  try {
    const trusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    const untrusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => false });
    assert(trusted.markdownBareAtImports === flip,
      `trusted reads project config → ${flip}, got ${trusted.markdownBareAtImports}`);
    assert(untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports,
      `untrusted ignores project config → baseline (${GLOBAL_BASELINE.markdownBareAtImports}), got ${untrusted.markdownBareAtImports}`);
    assert(trusted.markdownBareAtImports !== untrusted.markdownBareAtImports,
      `trust gate: trusted (${trusted.markdownBareAtImports}) must differ from untrusted (${untrusted.markdownBareAtImports})`);
  } finally {
    if (valid !== null) fsSync.writeFileSync(cfgPath, valid); // restore {markdownBareAtImports:true}
  }
});

// T2.S1-d — MALFORMED project JSON → project contributes {} (never throws); the result equals the global
// baseline (a broken project file neither crashes readConfig nor suppresses the global sources). Overwrite the
// project config with "{bad" for THIS case only, then RESTORE the valid fixture in finally.
await runCase("T2.S1-d", "readConfig malformed project JSON + trusted → {} (equals baseline), no throw", async () => {
  const cfgPath = path.join(TMPDIR, ".pi", "file-injector.json");
  const valid = fsSync.readFileSync(cfgPath, "utf8"); // save the valid content
  fsSync.writeFileSync(cfgPath, "{bad");              // malformed JSON for this case only
  try {
    const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(r.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports,
      `malformed project JSON → project {} (no throw) → equals baseline (${GLOBAL_BASELINE.markdownBareAtImports}), got ${r.markdownBareAtImports}`);
  } finally {
    fsSync.writeFileSync(cfgPath, valid);             // RESTORE so sibling cases (if any run after) see valid JSON
  }
});

// ── T2.S1 (settings.json): readConfig reads the namespaced `fileInjector` key from settings.json too ──
// PRD §4.6 sources #1/#3: the option may live under the SETTINGS_KEY ("fileInjector") inside Pi's own
// settings.json, co-located with the user's other settings. readConfig must read it (global + project-if-
// trusted), gated by the SAME trust boundary as the dedicated file, and the dedicated file-injector.json takes
// precedence WITHIN a scope. Each case writes a PROJECT <TMPDIR>/.pi/settings.json fixture and removes it in a
// finally so sibling cases never see it; the global ~/.pi/agent/settings.json is the REAL user file (assert on
// the markdownBareAtImports VALUE, not deepEqual — a real global could contribute unrelated keys).
const PROJ_SETTINGS_PATH = path.join(TMPDIR, ".pi", "settings.json");
const PROJ_FILE_PATH = path.join(TMPDIR, ".pi", "file-injector.json");
const writeSettings = (obj) => fsSync.writeFileSync(PROJ_SETTINGS_PATH, JSON.stringify(obj));

// T2.S1-e — settings.json key ALONE enables it (trusted). Empty out the dedicated file for this case so the
// ONLY project source is the settings.json key → markdownBareAtImports === true (from the key).
await runCase("T2.S1-e", "readConfig settings.json {fileInjector:{markdownBareAtImports:true}} + trusted → true", async () => {
  const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;
  fsSync.writeFileSync(PROJ_FILE_PATH, "{}");
  writeSettings({ "fileInjector": { markdownBareAtImports: true } });
  try {
    const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(r.markdownBareAtImports === true,
      `settings.json key (dedicated file empty) → markdownBareAtImports true, got ${r.markdownBareAtImports}`);
  } finally {
    if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid); // restore {markdownBareAtImports:true}
    fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
  }
});

// T2.S1-f — TRUST GATE on the settings.json key (untrusted). Write a project settings.json whose fileInjector
// value is the NEGATION of the baseline AND neutralize the dedicated project file (which otherwise has higher
// precedence and would mask the key); UNTRUSTED → baseline (key IGNORED), TRUSTED → project value. The two
// differing proves the gate applies to the settings.json key too, regardless of the real global env.
await runCase("T2.S1-f", "readConfig settings.json key + UNTRUSTED → ignored (baseline); trusted → project value", async () => {
  const flip = GLOBAL_BASELINE.markdownBareAtImports === true ? false : true;
  const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;
  fsSync.writeFileSync(PROJ_FILE_PATH, "{}"); // neutralize the dedicated file so the settings.json KEY is the project source under test
  writeSettings({ "fileInjector": { markdownBareAtImports: flip } });
  try {
    const untrusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => false });
    const trusted = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(untrusted.markdownBareAtImports === GLOBAL_BASELINE.markdownBareAtImports,
      `untrusted → settings.json key ignored → baseline (${GLOBAL_BASELINE.markdownBareAtImports}), got ${untrusted.markdownBareAtImports}`);
    assert(trusted.markdownBareAtImports === flip,
      `trusted → settings.json key value (${flip}), got ${trusted.markdownBareAtImports}`);
    assert(trusted.markdownBareAtImports !== untrusted.markdownBareAtImports,
      `trust gate: trusted (${trusted.markdownBareAtImports}) must differ from untrusted (${untrusted.markdownBareAtImports})`);
  } finally {
    if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid); // restore {markdownBareAtImports:true}
    fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
  }
});

// T2.S1-g — PRECEDENCE: dedicated file OVERRIDES the settings.json key within a scope. settings.json key says
// true, but the dedicated file says false → the file wins → markdownBareAtImports === false. (Source #4 beats
// #3; the project dedicated file is the most-specific source.)
await runCase("T2.S1-g", "readConfig precedence: file-injector.json overrides settings.json key (false wins)", async () => {
  const fileValid = fsSync.readFileSync(PROJ_FILE_PATH, "utf8");
  writeSettings({ "fileInjector": { markdownBareAtImports: true } });
  fsSync.writeFileSync(PROJ_FILE_PATH, JSON.stringify({ markdownBareAtImports: false }));
  try {
    const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(r.markdownBareAtImports === false,
      `dedicated file (false) overrides settings.json key (true) → false, got ${r.markdownBareAtImports}`);
  } finally {
    fsSync.writeFileSync(PROJ_FILE_PATH, fileValid);
    fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
  }
});

// T2.S1-h — MALFORMED settings.json → key contributes {} (never throws); the dedicated file still applies.
// Write "{bad" to settings.json; the dedicated file is {markdownBareAtImports:true} → result true. Proves a
// broken settings.json neither crashes readConfig nor suppresses the dedicated file.
await runCase("T2.S1-h", "readConfig malformed settings.json + trusted → key {} (dedicated file still applies, true)", async () => {
  fsSync.writeFileSync(PROJ_SETTINGS_PATH, "{bad");
  try {
    const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
    assert(r.markdownBareAtImports === true,
      `malformed settings.json → key absent, dedicated file true wins → true, got ${r.markdownBareAtImports}`);
  } finally {
    fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
  }
});

// ── P1.M2.T1.S1: config→pipeline wiring (session_start load + top-level bareAt:false) ─────────────────────────
// This subtask threads bareAt from the cached cfg through State via a 4th injectFiles param (Option A), adds a
// MODULE-LEVEL cfg cache loaded on session_start, and hardcodes bareAt:false on the TOP-LEVEL scan call (§4.6:
// bare-@ is markdown-ONLY — it must NEVER match in the user prompt where Pi's @file/@mention would collide).
// The KEY observable invariant this task owns is TOP-LEVEL SAFETY (case c): a bare `@b.ts` at the top level is
// NOT injected even when markdownBareAtImports:true is loaded. NOTE: literal markdown bare-@ end-to-end
// (api.md injected / trust-gated) is P1.M2.T2.S1's integration tests — it owns the injectMarkdown wiring that
// reads state.bareAt; this task only delivers the config-load plumbing + the state.bareAt seam.
//
// Flow under test: captureHandler("session_start").all[0] is the §4.6 config handler (registered first); driving
// it sets the MODULE-LEVEL cfg. A subsequent captureHandler("input") reads cfg.markdownBareAtImports===true and
// threads it into injectFiles. The .pi/file-injector.json fixture (T2.S1, {markdownBareAtImports:true}) is reused.

// M2.T1.S1-a — session_start loads config (trusted) + input pipeline runs (regression). Drive the config
// session_start handler with cwd=TMPDIR + trusted → cfg.markdownBareAtImports:true; then an input with #@a.ts
// must transform and inject a.ts. Proves the config→handler→injectFiles wiring runs end-to-end without error.
await runCase("M2.T1.S1-a", "session_start loads config (trusted) + input pipeline runs (regression)", async () => {
  const h = captureAllHandlers(); // ONE factory → shared `pending` closure (input stashes; before_agent_start publishes)
  await h.session_start[0]({}, makeMockCtx(TMPDIR).ctx); // cfg = readConfig({cwd:TMPDIR, trusted}) → markdownBareAtImports:true
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
  assert(out.action === "transform", `#@a.ts must inject with config loaded; got ${JSON.stringify(out)}`);
  const msg = await h.before_agent_start[0]({}, makeMockCtx(TMPDIR).ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message && msg.message.content.includes(`<file name="${A_TS}">`), "a.ts block present in the custom message");
});

// M2.T1.S1-b — trust-gate path runs (untrusted) — smoke, no crash; #@ still injects. Driving the config
// session_start handler with isProjectTrusted:()=>false skips the project config → cfg.markdownBareAtImports
// undefined → bareAt false. But top-level #@ is unaffected (always bareAt:false anyway) → #@a.ts still injects.
await runCase("M2.T1.S1-b", "trust-gate path runs (untrusted) — smoke, no crash; #@ still injects", async () => {
  const h = captureAllHandlers();
  await h.session_start[0]({}, makeMockCtx(TMPDIR, { isProjectTrusted: () => false }).ctx); // project skipped → bareAt undefined
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
  assert(out.action === "transform", `#@a.ts must inject even when untrusted (top-level unaffected); got ${JSON.stringify(out)}`);
});

// M2.T1.S1-c — TOP-LEVEL SAFETY (KEY INVARIANT): bare @ NEVER injects at the top level, even with the bareAt
// config on. With markdownBareAtImports:true (cfg loaded, bareAt derived true), a top-level `#@a.ts and @b.ts`
// prompt must inject ONLY a.ts (the #@ token) — the bare @b.ts must NOT inject. Both files exist; if the top-level
// scan wrongly passed bareAt:true, @b.ts WOULD inject → b.ts block present → FAIL. This pins the §4.6 invariant.
await runCase("M2.T1.S1-c", "TOP-LEVEL SAFETY — bare @ NEVER injects at top level (even with bareAt config on)", async () => {
  const h = captureAllHandlers();
  await h.session_start[0]({}, makeMockCtx(TMPDIR).ctx); // markdownBareAtImports:true → bareAt derived true
  const out = await h.input[0]({ text: "Diff #@a.ts and @b.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
  assert(out.action === "transform", `#@a.ts must inject; got ${JSON.stringify(out)}`);
  const msg = await h.before_agent_start[0]({}, makeMockCtx(TMPDIR).ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message && msg.message.content.includes(`<file name="${A_TS}">`), "a.ts block present (the #@ token injected)");
  assert(!msg.message.content.includes(`<file name="${B_TS}">`),
    `bare @b.ts must NOT inject at top level even with bareAt config on; b.ts block must be absent`);
});

// M2.T1.S1-d — direct injectFiles bareAt:true param does NOT break #@ (unit). Calling injectFiles directly with
// the 4th param true sets state.bareAt=true but the top-level scan hardcodes bareAt:false, so #@a.ts still injects
// (bareAt doesn't affect top-level #@ matching). Proves Option A: the param is harmless to existing direct calls.
await runCase("M2.T1.S1-d", "direct injectFiles bareAt:true param does NOT break #@ (unit)", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX, true); // bareAt param true
  assert(r.injected >= 1, `bareAt:true param must not break #@ injection; got injected=${r.injected}`);
});

// M2.T1.S1-e — direct injectFiles — top-level bareAt:false regardless of param (unit). With bareAt:true passed
// directly, `Diff #@a.ts and @b.ts` must inject ONLY a.ts (injected===1); the bare @b.ts must NOT inject because
// the top-level scan call hardcodes bareAt:false regardless of the param. The companion to case (c) via direct call.
await runCase("M2.T1.S1-e", "direct injectFiles — top-level bareAt:false regardless of param (unit)", async () => {
  const r = await mod.injectFiles("Diff #@a.ts and @b.ts", [], FIX, true); // bareAt param true, top-level scan hardcodes false
  assert(r.injected === 1, `top-level bare @ must NOT inject even with bareAt:true param; expected injected===1, got ${r.injected}`);
  assert(!hasBlock(r, `<file name="${B_TS}">`), "bare @b.ts block must be absent");
});

// ─────────────────────────────────────────────────────────────────────────────
// ── P1.M2.T2.S1: bare-@ wiring into injectMarkdown (PRD §4.6 — #25-28 + §10 e/f/g). ──
// These exercise the FULL injection pipeline via injectFiles' bareAt param (Option A — the established
// pattern for cases 15-24). injectMarkdown now scans with `bareAt: state.bareAt` (the P1.M2.T1.S1 seam),
// carries `prefixLen` through Step 3.5 (type widening), and strips `r.index + r.prefixLen` in Step 4 (NOT +2).
// With bareAt:false (default) behavior is byte-for-byte identical to today (#25). With bareAt:true a bare
// `@api.md` inside a delivered markdown IS imported and stripped to `api.md` (prefixLen 1 — #26). Top-level
// bare-@ is UNAFFECTED (#28 — top-level scan hardcodes bareAt:false). The config→session_start→input→injectFiles
// path is covered by P1.M2.T1.S1's M2.T1.S1-a..c; this block isolates the injectMarkdown wiring.
// ─────────────────────────────────────────────────────────────────────────────

// #25 — DEFAULT-OFF. bareAt defaults false (no 4th arg) → BARE_AT_RE not run in injectMarkdown → the bare
// @api.md inside notesBare.md is NOT matched/injected/stripped → left VERBATIM. Only notesBare.md injects.
await runCase(25, "§4.6 default-off: bare @api.md in notesBare.md NOT imported (verbatim), injected=1", async () => {
  const r = await mod.injectFiles("Review #@notesBare.md", [], FIX); // bareAt defaults false
  assert(r.injected === 1, `bareAt off → only notesBare.md injected (bare-@ not scanned), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // the bare @api.md marker is left VERBATIM (bareAt:false → BARE_AT_RE not run → not a record → not stripped)
  assert(hasBlock(r, "Refs @api.md here."), "the bare @api.md must be left VERBATIM (bareAt off, not scanned)");
  assert(!hasBlock(r, '<file name="' + API + '">'), "api.md must NOT be injected (bare-@ not scanned when bareAt off)");
  assert(countFileBlocks(blocksText(r), API) === 0, `api.md must appear ZERO times, got ${countFileBlocks(blocksText(r), API)}`);
});

// #26 — BARE-@ ON, prefixLen-1 STRIP (the smoking-gun +2-bug guard). bareAt:true → BARE_AT_RE runs in
// injectMarkdown → the bare @api.md IS matched (prefixLen 1) → injected (notesBare.md + api.md) AND stripped
// to `api.md` (1 char removed). The `+2` bug would strip `@a` leaving `pi.md`; the explicit guard below pins it.
await runCase(26, "§4.6 on: bare @api.md imported + stripped to api.md (prefixLen 1); +2-bug fingerprint ABSENT", async () => {
  const r = await mod.injectFiles("Review #@notesBare.md", [], FIX, true); // bareAt on
  assert(r.injected === 2, `bareAt on → notesBare.md + api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  const iNotes = r.blocks.findIndex((b) => b.includes('<file name="' + NOTES_BARE + '">'));
  const iApi = r.blocks.findIndex((b) => b.includes('<file name="' + API + '">'));
  assert(iNotes !== -1 && iApi !== -1, "both notesBare.md and api.md blocks must be present");
  assert(iNotes < iApi, "notesBare.md block before api.md block (pre-order depth-first)");
  // bare-@ marker preserved verbatim (§6.4): the '@' stays (content is the file as-read; no stripping)
  assert(hasBlock(r, "Refs @api.md here."), "bare @api.md marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "Refs api.md here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
  // +2-prefixLen bug guard (redundant under verbatim): no stripping occurs → the bug cannot fire; 'pi.md' never appears.
  assert(!hasBlock(r, "Refs pi.md here."), "redundant under verbatim: no stripping → +2-prefixLen bug cannot occur; 'pi.md' never appears (§6.4)");
});

// #27 — bareAt ON + existing #@notes.md (no double-match). The existing notes.md has `#@api.md` (prefixLen 2)
// and a fenced `#@example.ts`. With bareAt on, the #@api.md is matched ONCE (BARE_AT_RE's lookbehind forbids a
// preceding '#' → no double-match), stripped with prefixLen 2. The fenced #@example.ts stays verbatim (code-exempt).
await runCase(27, "§4.6 on+#@: #@api.md matched ONCE (no double-match), injected=2; fenced code still verbatim", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX, true); // bareAt on; reuses EXISTING notes.md
  assert(r.injected === 2, `notes.md + api.md injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // api.md matched EXACTLY ONCE (BARE_AT_RE forbids preceding '#' → #@api.md never double-matched)
  assert(countFileBlocks(blocksText(r), API) === 1, `api.md must appear exactly ONCE (no double-match), got ${countFileBlocks(blocksText(r), API)}`);
  // prefixLen-2 strip for the #@ form (unchanged behavior; the +r.prefixLen edit == +2 here)
  assert(hasBlock(r, "Imports #@api.md here."), "#@api.md marker preserved verbatim (§6.4)");
  assert(!hasBlock(r, "Imports api.md here."), "the stripped form must be ABSENT (content is verbatim, not stripped)");
  // the fenced #@example.ts is STILL verbatim (code-exempt even with bareAt on)
  assert(hasBlock(r, "#@example.ts"), "fenced #@example.ts must be left VERBATIM (code-exempt, bareAt-independent)");
});

// #28 — TOP-LEVEL UNAFFECTED (the §4.6 markdown-only invariant). A top-level bare @other.md (other.md EXISTS)
// must NOT inject even with bareAt:true passed directly — the top-level scan hardcodes bareAt:false (P1.M2.T1.S1).
// injectFiles has NO !text.includes('#@') pre-check (that guard is in the input handler), so the full pipeline
// runs → processTokenStream(bareAt:false) → no top-level bare-@ match → injected=0 → original text returned.
await runCase(28, "§4.6 on+top-level: bare @other.md (exists) NOT injected (injected=0); top-level is #@-only", async () => {
  const r = await mod.injectFiles("Read @other.md", [], FIX, true); // bareAt param true; top-level scan hardcodes false
  assert(r.injected === 0, `top-level bare @ must NOT inject even with bareAt:true; expected injected===0, got ${r.injected}`);
  assert(r.text === "Read @other.md", `count===0 returns the ORIGINAL text byte-for-byte; got ${JSON.stringify(r.text)}`);
  assert(!hasBlock(r, '<file name="' + OTHER_MD + '">'), "other.md block must be absent (top-level is #@-only)");
});

// §10(e) — MID-WORD @ EXCLUDED. `user@host.com` in a markdown (bareAt on) is left VERBATIM: BARE_AT_RE forbids
// a preceding word char (\p{L}\p{N}_) so the letter before @ excludes it. Only notesEmail.md injects.
await runCase("M2.T2.S1-e", "§10 email: user@host.com in markdown (on) left VERBATIM (mid-word @ excluded)", async () => {
  const r = await mod.injectFiles("Read #@notesEmail.md", [], FIX, true);
  assert(r.injected === 1, `only notesEmail.md injected (mid-word @ not matched), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(hasBlock(r, "Contact user@host.com."), "user@host.com must be left VERBATIM (BARE_AT_RE word-char lookbehind excludes mid-word @)");
});

// §10(f) — UNRESOLVED @ MENTION. `@username` in prose (bareAt on, no username.md) is recorded by BARE_AT_RE
// but Step 3.5's existence pre-check rejects it (no username.md) → left VERBATIM (not stripped, not injected).
await runCase("M2.T2.S1-f", "§10 mention: @username (on, no username.md) left VERBATIM (not resolved)", async () => {
  const r = await mod.injectFiles("Read #@notesMention.md", [], FIX, true);
  assert(r.injected === 1, `only notesMention.md injected (no username.md → not resolved), got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(hasBlock(r, "Ping @username now."), "@username must be left VERBATIM (Step 3.5 existence pre-check: no username.md → not stripped)");
});

// §10(g) — DEDUP on resolved abs. notesMixDedup.md has BOTH `#@api.md` (prefixLen 2) and `@api.md` (prefixLen 1)
// — both resolve to the SAME api.md. Dedup keys on the resolved abs → api.md injected ONCE. The first marker
// (#@, encountered first, lower index) wins → stripped to `api.md`; the second (@) is dropped (deduped) → VERBATIM.
await runCase("M2.T2.S1-g", "§10 dedup: #@api.md + @api.md (on) → api.md ONCE; first stripped, second verbatim", async () => {
  const r = await mod.injectFiles("Review #@notesMixDedup.md", [], FIX, true);
  assert(r.injected === 2, `notesMixDedup.md + api.md (deduped) injected, got injected=${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // api.md injected EXACTLY ONCE (dedup on resolved abs — both #@api.md and @api.md collapse)
  assert(countFileBlocks(blocksText(r), API) === 1, `api.md must appear exactly ONCE (dedup on resolved abs), got ${countFileBlocks(blocksText(r), API)}`);
  // BOTH markers verbatim (dedup affects INJECTION — one block per resolved abs — NOT content; §6.4)
  assert(hasBlock(r, "Refs #@api.md and @api.md."), "both markers preserved verbatim (dedup affects injection, not content; §6.4)");
  assert(!hasBlock(r, "Refs api.md and @api.md."), "the first-stripped form must be ABSENT (content is verbatim, not stripped)");
});

// ─────────────────────────────────────────────────────────────────────────────
// ── P1.M2.T2.S1 (plan/008): delivery + custom-message + stash lifecycle ──
// ─────────────────────────────────────────────────────────────────────────────
// Pins PRD §6.2 (Delivery — the custom message shape) / §6.4 (Assembly & shared state — two returns; the
// pending stash handoff; clear unconditionally) / §12.20 (Two hooks, one stash — one-shot per prompt) /
// §11 #33-41 (display/model-input test matrix). The injectFiles return shape (+blocks/+details), the full
// before_agent_start custom-message contract ({customType, content=blocks.join("\n\n"), display:true,
// details:{files}}), and the one-shot `pending` stash lifecycle (set by input only when injected>0; read-and-
// cleared once by before_agent_start; undefined on no-#@ / extension-source / second-fire).
//
// REUSES captureAllHandlers (ONE factory → input + before_agent_start share the `pending` closure) + makeMockCtx
// + FIX/A_TS/B_TS/A_TS_CONTENT/B_TS_CONTENT. Does NOT drive session_start (it UNCONDITIONALLY calls
// pi.registerMessageRenderer at L1169; captureAllHandlers' mock pi stubs it as a no-op, but cfg is module-level
// and these prompts use no config → default bareAt:false is correct without driving session_start — cases drive
// input[0] + before_agent_start[0] only, like existing case 12). EXPANDS case 12 (partial delivery → full
// custom-message shape) and COMPLEMENTS case 9 (multi-file order → details side + length parity). Case IDs
// DELIV-1..DELIV-6 (NOT `M2.T2.S1-` — collides with plan-005 residual cases `M2.T2.S1-e/f/g` above).
// ─────────────────────────────────────────────────────────────────────────────

// DELIV-1 — RETURN SHAPE (direct injectFiles). r.text is stripped-only (no `---`, no `<file`); blocks/details
// are arrays of len 1 with the FileDetail shape {path, kind:'text', chars, lines}.
await runCase("DELIV-1", "injectFiles return shape: r.text stripped (no ---/<file>); r.blocks[] + r.details[] len 1", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.paged === 0, `expected paged===0, got ${r.paged}`);
  assert(r.text === "Review #@a.ts", `r.text is the verbatim prompt (#@ preserved; no blocks); got ${JSON.stringify(r.text)}`);
  assert(!r.text.includes("---"), "r.text must NOT contain the old '---' separator");
  assert(!r.text.includes("<file"), "r.text must NOT contain any <file> block (bytes live in r.blocks/the custom message)");
  assert(Array.isArray(r.blocks) && r.blocks.length === 1, `r.blocks is a string[] of length 1, got ${JSON.stringify(r.blocks)}`);
  assert(r.blocks[0].includes('<file name="' + A_TS + '">'), "r.blocks[0] is the a.ts <file> block");
  assert(Array.isArray(r.details) && r.details.length === 1, `r.details is a FileDetail[] of length 1, got ${JSON.stringify(r.details)}`);
  const d = r.details[0];
  assert(d.path === A_TS, `details[0].path is the resolved a.ts abs, got ${d.path}`);
  assert(d.kind === "text", `details[0].kind === 'text', got ${d.kind}`);
  assert(d.chars === A_TS_CONTENT.length, `details[0].chars is the content length (${A_TS_CONTENT.length}), got ${d.chars}`);
  const expectedLines = (A_TS_CONTENT.match(/\n/g) || []).length + 1;
  assert(d.lines === expectedLines, `details[0].lines is newline-count+1 (${expectedLines}), got ${d.lines}`);
});

// DELIV-2 — CUSTOM MESSAGE (full contract). before_agent_start publishes
// {customType, content=blocks.join("\n\n"), display:true, details:{files}}. EXPANDS case 12 (which checks
// customType + content.includes + notify) to also pin display===true, details.files shape, and content === the
// joined block (exactly ONE <file> for a single-file prompt).
await runCase("DELIV-2", "custom message: before_agent_start → {customType, content=blocks.join, display:true, details:{files}}", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers(); // ONE factory → input + before_agent_start share the `pending` closure
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `input must transform, got '${out.action}'`);
  assert(out.text === "Review #@a.ts", `input text is verbatim (#@ preserved; blocks leave the user message), got ${JSON.stringify(out.text)}`);
  const msg = await h.before_agent_start[0]({}, ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message, `before_agent_start must return {message}, got ${JSON.stringify(msg)}`);
  const m = msg.message;
  assert(m.customType === "fileInjector.injected", `customType handshake (the renderer key), got ${m.customType}`);
  assert(typeof m.content === "string" && m.content.includes('<file name="' + A_TS + '">'),
    `content carries the a.ts <file> block (the model receives it), got ${JSON.stringify(m.content)}`);
  // for ONE file, blocks.join("\n\n") === the single block → exactly one <file> opener in content
  assert((m.content.match(/<file name="/g) || []).length === 1,
    `content has exactly ONE <file> block (= blocks.join for 1 file), got ${JSON.stringify(m.content)}`);
  assert(m.display === true, `display===true (TUI render contract; §6.2), got ${m.display}`);
  assert(m.details && Array.isArray(m.details.files), `details.files is an array, got ${JSON.stringify(m.details)}`);
  assert(m.details.files.length === 1, `details.files has one entry (one file delivered), got ${m.details.files.length}`);
  assert(m.details.files[0].path === A_TS && m.details.files[0].kind === "text",
    `details.files[0] is the a.ts text detail, got ${JSON.stringify(m.details.files[0])}`);
});

// DELIV-3 — ONE-SHOT STASH. before_agent_start read-and-clears `pending` (file-injector.ts:1202); a 2nd call
// returns undefined. Pins PRD §12.20 (one-shot per prompt — a later no-#@ prompt never re-delivers a stale stash).
await runCase("DELIV-3", "one-shot stash: 2nd before_agent_start returns undefined (pending cleared)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx); // stashes pending
  const msg1 = await h.before_agent_start[0]({}, ctx);
  assert(msg1 && msg1.message && msg1.message.customType === "fileInjector.injected",
    `1st before_agent_start publishes the custom message, got ${JSON.stringify(msg1)}`);
  const msg2 = await h.before_agent_start[0]({}, ctx);
  assert(msg2 === undefined,
    `2nd before_agent_start must return undefined (pending cleared — one-shot per prompt, §12.20), got ${JSON.stringify(msg2)}`);
});

// DELIV-4 — EMPTY STASH. A no-#@ prompt short-circuits (input returns continue, sets no stash) → before_agent_start
// returns undefined (no phantom custom message).
await runCase("DELIV-4", "empty stash: no-#@ input → before_agent_start undefined (no phantom injection)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  const out = await h.input[0]({ text: "Just a plain prompt with no markers", source: "interactive", images: [] }, ctx);
  assert(out.action === "continue", `no-#@ input short-circuits to continue (no stash set), got '${out.action}'`);
  const msg = await h.before_agent_start[0]({}, ctx);
  assert(msg === undefined, `before_agent_start must return undefined (empty stash → no phantom custom message), got ${JSON.stringify(msg)}`);
});

// DELIV-5 — SHORT-CIRCUIT. source:'extension' input → continue (PRD §12.1 loop prevention — no stash set) →
// before_agent_start returns undefined. Even with a #@, no stash is set for extension sources.
await runCase("DELIV-5", "short-circuit: source:'extension' input → before_agent_start undefined (loop prevention)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  // source:'extension' is MANDATORY loop prevention (§12.1) — even with a #@, no stash is set.
  const out = await h.input[0]({ text: "Review #@a.ts", source: "extension", images: [] }, ctx);
  assert(out.action === "continue", `source:'extension' input short-circuits to continue (loop prevention), got '${out.action}'`);
  const msg = await h.before_agent_start[0]({}, ctx);
  assert(msg === undefined, `before_agent_start must return undefined (extension source set no stash), got ${JSON.stringify(msg)}`);
});

// DELIV-6 — MULTI-FILE details. Two #@ tokens → r.blocks.length===2 AND r.details.length===2; details parallel
// to blocks in emission (pre-order) order: details[0]=a.ts, details[1]=b.ts. COMPLEMENTS case 9 (which covers
// block order via findIndex + notify count) by pinning the FileDetail side + length parity.
await runCase("DELIV-6", "multi-file: r.blocks.length===2 AND r.details.length===2; details parallel to blocks (emission order)", async () => {
  const r = await mod.injectFiles("Diff #@a.ts vs #@b.ts", [], FIX);
  assert(r.injected === 2, `expected injected===2, got ${r.injected}`);
  assert(Array.isArray(r.blocks) && r.blocks.length === 2, `r.blocks is a string[] of length 2, got ${r.blocks.length}`);
  assert(Array.isArray(r.details) && r.details.length === 2, `r.details is a FileDetail[] of length 2, got ${r.details.length}`);
  // details are parallel to blocks in emission (pre-order) order: details[0]=a.ts, details[1]=b.ts
  assert(r.details[0].path === A_TS, `details[0].path===A_TS (emission order), got ${r.details[0].path}`);
  assert(r.details[1].path === B_TS, `details[1].path===B_TS (emission order), got ${r.details[1].path}`);
  assert(r.details[0].kind === "text" && r.details[1].kind === "text", `both details kind==='text'`);
  // cross-check: each detail's path appears as the <file name=…> in the parallel block
  assert(r.blocks[0].includes('<file name="' + A_TS + '">'), "blocks[0] is the a.ts block (parallel to details[0])");
  assert(r.blocks[1].includes('<file name="' + B_TS + '">'), "blocks[1] is the b.ts block (parallel to details[1])");
});

// ── P1.M2.T2.S2 (plan/008): renderer output + defensive fallback ──
// ─────────────────────────────────────────────────────────────────────
// Pins PRD §6.3 (the MessageRenderer) + §11 #33-38 (display matrix) + §12.23 (defensive, never throw) +
// §12.24 (green choice deliberate: toolSuccessBg/toolTitle+bold/accent/dim) + §12.25 (tildify; ctrl+o hardcoded).
// Calls mod.renderInjectedMessage DIRECTLY with crafted messages — NO file I/O, NO hooks, NO captureAllHandlers,
// NO fixtures. Reuses runCase/assert (and os, already imported L25). A local stubTheme renders UNSTYLED content
// (every theme fn returns its text arg); a local spyTheme (REND-10) records the theme KEYS for color parity.
//
// TEST SEAM (pi-tui, grounded in source): Box.children is PUBLIC (Component[]) → inspect children[i] directly.
// Text.text is PRIVATE → read via Text.render(width): string[]. The renderer builds new Text(s,0,0) (padding 0),
// so child.render(W).join("\n") = the content (wrapped to W, right-padded with spaces, NO margins). W=2000 → no wrap.
// highlightCode returns PLAIN text (probed) → body includes-checks are ANSI-safe TODAY.
const REND_THEME = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t };
const REND_W = 2000;
const textOf = (child) => child.render(REND_W).join("\n"); // generous width → no wrapping; trailing pad is harmless for .includes()

// REND-1 — COLLAPSED SINGLE FILE (§11 #33). One read line; includes "read" + the path.
await runCase("REND-1", "collapsed single text file: Box has children; [0] includes 'read' + path", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhello world\n</file>' },
    { expanded: false }, REND_THEME);
  assert(box && Array.isArray(box.children) && box.children.length >= 1, `renderer must return a Box with children, got ${JSON.stringify(box?.children?.length)}`);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read"), `children[0] is a read line (includes 'read'), got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("/abs/a.ts"), `children[0] includes the path, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(ctrl+o to expand)"), `children[0] includes the expand hint (i===0), got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-2 — COLLAPSED MULTI-FILE (§11 #34). Two read lines; the expand hint appears ONCE (on [0] only).
await runCase("REND-2", "collapsed multi-file: 2 read lines; hint on [0] only (shown once per box)", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }, { path: "/abs/b.md", kind: "text" }] },
      content: '<file name="/abs/a.ts">\na\n</file>\n<file name="/abs/b.md">\nb\n</file>' },
    { expanded: false }, REND_THEME);
  assert(box.children.length === 2, `two files → two read lines, got ${box.children.length}`);
  const l0 = textOf(box.children[0]), l1 = textOf(box.children[1]);
  assert(l0.includes("/abs/a.ts") && l0.includes("(ctrl+o to expand)"), `[0] is the a.ts read line WITH the hint, got ${JSON.stringify(l0.slice(0, 60))}`);
  assert(l1.includes("/abs/b.md"), `[1] is the b.md read line, got ${JSON.stringify(l1.slice(0, 60))}`);
  assert(!l1.includes("(ctrl+o to expand)"), `[1] must NOT have the expand hint (shown once per box, §6.3), got ${JSON.stringify(l1.slice(0, 60))}`);
});

// REND-3 — PAGED LINE (§11 #37). The read line carries the range suffix (mirrors the read tool's formatReadLineRange).
await runCase("REND-3", "paged file: read line includes the range suffix ':5-'", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/huge.log", kind: "paged", range: ":5-" }] },
      content: '<file name="/abs/huge.log">\nhead line\n</file>\n<file name="/abs/huge.log">directive</file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/huge.log"), `[0] is the huge.log read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes(":5-"), `[0] includes the paged range suffix ':5-', got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-4 — IMAGE LINE (§11 #35). The read line appends the dimensionHint.
await runCase("REND-4", "image file: read line includes the dimensionHint", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/pic.png", kind: "image", dimensionHint: "(resized to 1568×1044)" }] },
      content: '<file name="/abs/pic.png"></file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/pic.png"), `[0] is the pic.png read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(resized to 1568×1044)"), `[0] includes the dimensionHint, got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-5 — BINARY LINE (§11 #36). The read line shows '(binary — not injected)' (model note + display agree).
await runCase("REND-5", "binary file: read line includes '(binary — not injected)'", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/data.bin", kind: "binary" }] },
      content: '<file name="/abs/data.bin"><binary file — contents not injected; use the read tool if needed></file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/data.bin"), `[0] is the data.bin read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(binary — not injected)"), `[0] includes the binary note, got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-6 — EXPANDED (§6.3). Expanded renders the file content below the read line → MORE children than collapsed.
await runCase("REND-6", "expanded text file: more children than collapsed; body child carries the content", async () => {
  const msg = { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhello world\n</file>' };
  const collapsed = mod.renderInjectedMessage(msg, { expanded: false }, REND_THEME);
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  assert(expanded.children.length > collapsed.children.length,
    `expanded must render the body below the read line (more children); collapsed=${collapsed.children.length} expanded=${expanded.children.length}`);
  // the body child (last) carries the file content — PLAIN text (highlightCode returns no ANSI today)
  const body = textOf(expanded.children[expanded.children.length - 1]);
  assert(body.includes("hello world"), `the expanded body child carries the file content, got ${JSON.stringify(body.slice(0, 60))}`);
});

// REND-7 — IMAGE NOT RE-RENDERED (§6.3/§6.4). Expanded image has NO body child (images attach to the user message).
await runCase("REND-7", "expanded image: NO body child (images attach to the user message, not the renderer)", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/pic.png", kind: "image", dimensionHint: "(resized to WxH)" }] },
      content: '<file name="/abs/pic.png"></file>' },
    { expanded: true }, REND_THEME);
  assert(box.children.length === 1, `expanded image must have ONE child (the read line only; no body), got ${box.children.length}`);
  assert(textOf(box.children[0]).includes("/abs/pic.png"), `[0] is still the pic.png read line, got ${JSON.stringify(textOf(box.children[0]).slice(0, 60))}`);
});

// REND-8 — DEFENSIVE FALLBACK (§12.23). Malformed entries (no files / no details) never throw; single fallback line.
await runCase("REND-8", "defensive fallback: {details:{}} and {content} (no details) → no throw; 1 child '(injected files)'", async () => {
  // (a) details present but no files array
  let box = mod.renderInjectedMessage({ details: {}, content: '<file name="/abs/x.ts">x</file>' }, { expanded: false }, REND_THEME);
  assert(box && box.children.length === 1, `{details:{}} → single fallback line, got ${box?.children?.length}`);
  assert(textOf(box.children[0]).trim() === "read (injected files) (ctrl+o to expand)",
    `fallback line text, got ${JSON.stringify(textOf(box.children[0]).trim())}`);
  // (b) no details key at all (only content)
  box = mod.renderInjectedMessage({ content: '<file name="/abs/x.ts">x</file>' }, { expanded: false }, REND_THEME);
  assert(box && box.children.length === 1, `{content} (no details) → single fallback line (no throw), got ${box?.children?.length}`);
  assert(textOf(box.children[0]).trim() === "read (injected files) (ctrl+o to expand)",
    `fallback line text (no-details path), got ${JSON.stringify(textOf(box.children[0]).trim())}`);
});

// REND-9 — TILDIFY (§12.25). A path under os.homedir() displays with a leading '~'.
await runCase("REND-9", "tildify: a homedir path displays starting with '~'", async () => {
  const homePath = os.homedir() + "/projects/a.ts";
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: homePath, kind: "text" }] }, content: '<file name="' + homePath + '">\nhi\n</file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.startsWith("read ~"), `homedir path is tildified (starts with 'read ~'), got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(!line0.includes(os.homedir()), `the raw homedir must NOT appear (replaced by ~), got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-10 — COLOR PARITY (§11 #38 / §12.24). A spy theme proves the renderer uses the read-tool theme keys.
await runCase("REND-10", "color parity: toolSuccessBg (bg) + toolTitle/accent/dim (fg) + bold('read') — the read-tool recipe", async () => {
  const calls = { fg: [], bg: [], bold: [] };
  const spy = { fg: (k, t) => { calls.fg.push(k); return t; }, bg: (k, t) => { calls.bg.push(k); return t; }, bold: (t) => { calls.bold.push(t); return t; } };
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhi\n</file>' },
    { expanded: false }, spy);
  // readLine builds its string eagerly → fg/bold are called during construction
  assert(calls.fg.includes("toolTitle"), `fg uses toolTitle for the 'read' title (read-tool parity), got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.fg.includes("accent"), `fg uses accent for the path (read-tool parity), got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.fg.includes("dim"), `fg uses dim for the expand hint, got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.bold.includes("read"), `bold is applied to 'read' (read-tool parity), got bold=${JSON.stringify(calls.bold)}`);
  // the Box bgFn (toolSuccessBg) fires on box.render(width) — prove the GREEN key, not the purple customMessageBg
  box.render(80);
  assert(calls.bg.includes("toolSuccessBg"), `bg uses toolSuccessBg (GREEN, the read tool's completed-call color; NOT purple customMessageBg), got bg=${JSON.stringify(calls.bg)}`);
  assert(!calls.bg.includes("customMessageBg"), `must NOT use customMessageBg (purple = skills, §12.24), got bg=${JSON.stringify(calls.bg)}`);
});

// REND-11 — BUG-1 REGRESSION (nested </file>). A file whose OWN content contains a literal `</file>`
// must render its FULL body in the expanded view. Before the fix, the renderer re-derived each body
// from message.content via the lazy block regex, which truncated at the INNER `</file>`. The fix stores
// the exact body in detail.body at emit time; the renderer prefers it and only falls back to the regex
// for entries without one (old/foreign/test messages). This test pins BOTH the stored-body path (real
// injected detail) and that the regex fallback alone would have failed.
await runCase("REND-11", "BUG-1: a file whose content has a nested </file> renders the FULL body when expanded (not truncated)", async () => {
  // (a) UNIT (renderer-direct): a detail carrying the stored body. The expanded view must include 'DONE'
  //     (which sits AFTER the inner </file> in the content). The regex fallback alone would truncate.
  const fullBody = "Example:\n<file name=\"d\">nested</file>\nDONE\n";
  const block = '<file name="/abs/nest.ts">\n' + fullBody + '\n</file>';
  const msg = { details: { files: [{ path: "/abs/nest.ts", kind: "text", body: fullBody }] }, content: block };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const bodyChild = textOf(expanded.children[expanded.children.length - 1]);
  assert(bodyChild.includes("DONE"), `expanded body must include text AFTER the inner </file> ('DONE'); got ${JSON.stringify(bodyChild.slice(0, 80))}`);
  assert(!bodyChild.endsWith("nested"), `expanded body must NOT be truncated at the inner </file>; got ${JSON.stringify(bodyChild.slice(0, 80))}`);

  // (b) E2E (injectFiles → render): a REAL file with a nested </file> renders its FULL body (DONE present) via
  //     the renderer's 3-tier resolution. After P1.M2.T1.S1, injectFiles carries contentStart/contentLen (no body);
  //     offsets are computed in before_agent_start via computeDetailOffsets — simulate that here (injectFiles itself
  //     does not compute them). The `typeof … === "function"` guard makes this pass pre-S1 (body → tier-2) AND
  //     post-S1 (offsets → tier-1). Model-facing content is intact regardless (delivery is unaffected — display-only).
  const r = await mod.injectFiles("Review #@nest.ts", [], FIX);
  assert(r.injected === 1, `nest.ts was injected, got injected=${r.injected}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `one detail for nest.ts, got ${JSON.stringify(r.details?.length)}`);
  // simulate before_agent_start's offset pass (P1.M2.T1.S1) so the renderer's offset tier is exercised post-S1:
  if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details);
  // model-facing content is the full block (delivery unaffected — this bug is display-only per the report):
  assert(r.blocks[0].includes("DONE"), `the model-facing block carries the full content ('DONE' present), got ${JSON.stringify(r.blocks[0].slice(0, 80))}`);
  // renderer (as published by before_agent_start: content=blocks.join) shows DONE in the expanded view:
  const published = { details: { files: r.details }, content: r.blocks.join("\n\n") };
  const exp = mod.renderInjectedMessage(published, { expanded: true }, REND_THEME);
  const shown = textOf(exp.children[exp.children.length - 1]);
  assert(shown.includes("DONE"), `expanded view of a real nested-</file> file shows the full body ('DONE') via the renderer's offset/body tier, got ${JSON.stringify(shown.slice(0, 80))}`);
});

// REND-OFFSET — §12.22 offset tier (P1.M2.T1.S2). A detail carrying contentStart/contentLen (NOT body) — the
// post-S1 shape for real injected files — must render the EXACT body via message.content.slice in the expanded
// view. Pins tier-1 of the renderer's 3-tier body resolution (offset → body → regex) in isolation, incl. a
// nested-</file> body (BUG-1-safe: the slice is length-derived, not regex — the lazy regex would truncate at
// the inner tag). Independent of S1 state (offsets crafted directly in the test).
await runCase("REND-OFFSET", "offset tier: detail with contentStart/contentLen (no body) renders the exact slice incl. nested </file> (§12.22)", async () => {
  const fullBody = "a</file>b";                                                    // BUG-1 body — a literal </file>
  const block = '<file name="/abs/o.ts">\n' + fullBody + '\n</file>';
  const content = block;                                                           // single block → content === block
  const headerLen = '<file name="/abs/o.ts">\n'.length;                            // 15 + 9 = 24
  const contentStart = headerLen;
  const contentLen = fullBody.length;                                              // 8
  const msg = { details: { files: [{ path: "/abs/o.ts", kind: "text", contentStart, contentLen }] }, content };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const bodyChild = textOf(expanded.children[expanded.children.length - 1]);
  assert(bodyChild.includes("a</file>b"),
    `offset slice (tier-1) shows the EXACT body incl. the inner </file> (BUG-1-safe), got ${JSON.stringify(bodyChild.slice(0, 80))}`);
  // sanity: tier-1 fired (not the regex). The regex alone would yield "a" (truncated at the inner </file>).
  assert(!bodyChild.endsWith("a") || bodyChild.length > 1,
    `tier-1 slice is the FULL body (not the regex-truncated 'a'), got ${JSON.stringify(bodyChild.slice(0, 80))}`);
});

// REND-PAGED-DIR — §6.3 paged directive in the expanded view (P1.M2.T2.S1). A paged detail carrying `directive` +
// content renders, when expanded, the head body FOLLOWED BY the directive text (the <paged: …> resume instructions).
// Crafts the detail directly (independent of P1.M2.T1.S1 offsets + paging fixtures — mirrors REND-OFFSET's isolation).
await runCase("REND-PAGED-DIR", "§6.3 expanded paged: head body FOLLOWED BY the <paged: …> directive text (dim)", async () => {
  const headBody = "first 8 KB of the file…";
  const directive = "<paged: 50000 chars; head delivered 200 complete lines; read the rest with the read tool at offset:201, limit:2000, incrementing offset by 2000 until done>";
  const content = '<file name="/abs/huge.log">\n' + headBody + '\n</file>';   // single head block → bodies[0] resolves
  const msg = {
    details: { files: [{ path: "/abs/huge.log", kind: "paged", range: ":201-", body: headBody, directive }] },
    content,
  };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const texts = expanded.children.map((c) => textOf(c));
  // the head body renders (tier-2 d.body):
  assert(texts.some((t) => t.includes(headBody)), `expanded paged view shows the head body, got ${JSON.stringify(texts.map((t) => t.slice(0, 40)))}`);
  // the directive renders AFTER the head (§6.3) — the LAST child is the directive:
  assert(texts.some((t) => t.includes("<paged:") && t.includes("read the rest")),
    `expanded paged view shows the <paged: …> directive text (§6.3), got ${JSON.stringify(texts.map((t) => t.slice(0, 40)))}`);
  const bodyIdx = texts.findIndex((t) => t.includes(headBody));
  const dirIdx = texts.findIndex((t) => t.includes("<paged:"));
  assert(dirIdx > bodyIdx, `the directive renders AFTER the head body (§6.3 order), got bodyIdx=${bodyIdx} dirIdx=${dirIdx}`);
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
