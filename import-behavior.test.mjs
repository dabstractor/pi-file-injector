// Standalone repro for the reported import bugs. Same jiti loader as the real suite (file-injector.test.mjs),
// so it exercises the LIVE committed file-injector.ts. Encodes the DESIRED behavior; a FAIL = a real bug.
// Kept separate from file-injector.test.mjs to avoid colliding with the in-flight P1.M2 edits there.
import { execSync } from "node:child_process";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// --- load the real extension exactly like the suite does ---
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      → ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// Each file gets UNIQUE marker content so we can tell WHICH file was injected (path AND content).
const mk = (dir, rel, body) => {
  const p = path.join(dir, rel); fsSync.mkdirSync(path.dirname(p), { recursive: true });
  fsSync.writeFileSync(p, body); return p;
};
const ctxFor = (cwd) => ({ cwd, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} } });
const run = async (cwd, prompt, bareAt) => {
  const out = await mod.injectFiles(prompt, [], ctxFor(cwd), bareAt);
  return out; // { text(stripped), images, injected, paged, blocks, details }
};
const has = (out, marker) => (out.blocks ?? []).join("\n\n").includes(marker);
const abs = (cwd, rel) => path.resolve(cwd, rel);

// Drive the REAL input handler — the exact path pi takes. session_start loads cfg from the LIVE global
// settings.json (so markdownBareAtImports is derived INSIDE the handler, not hardcoded). This catches any
// config/depth wiring bug that a direct injectFiles(..., true) call would hide.
function captureAll() {
  const cbs = {};
  mod.default({ on: (ev, cb) => { (cbs[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} });
  return cbs;
}
async function runHandler(cwd, prompt) {
  const cbs = captureAll();
  for (const cb of (cbs.session_start ?? [])) await cb({}, { cwd, isProjectTrusted: () => true });
  const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(cwd));
  const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(cwd)) : undefined;
  return { out, msg };
}

// ===========================================================================
// GROUP 1 — RELATIVE RESOLUTION (relative to the IMPORTING FILE, never cwd)
// Same basename in two places, different content, so we can tell which one was chosen.
// ===========================================================================
console.log("\nGROUP 1 — relative resolution (file-relative, not project-root)");

await test("1a: @ARCHITECTURE.md in spec/PRD.md resolves to spec/ARCHITECTURE.md (NOT <root>/ARCHITECTURE.md)", async () => {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "rel-"));
  mk(root, "spec/PRD.md", "PRD-BODY\n\n@ARCHITECTURE.md\n");
  mk(root, "spec/ARCHITECTURE.md", "FILE-RELATIVE-ARCH");   // correct target (file's own dir)
  mk(root, "ARCHITECTURE.md", "ROOT-CWD-ARCH");             // wrong target (cwd / project root)
  const out = await run(root, "#@spec/PRD.md", true);
  assert(has(out, "FILE-RELATIVE-ARCH"), `expected spec/ARCHITECTURE.md (file-relative); got text lacking FILE-RELATIVE-ARCH.\ninjected=${out.injected}`);
  assert(!has(out, "ROOT-CWD-ARCH"), `BUG: resolved the ROOT copy — that is project-root (cwd) resolution, NOT file-relative`);
});

await test("1b: @../shared/X.md in spec/PRD.md resolves up-and-over to shared/X.md", async () => {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "rel-"));
  mk(root, "spec/PRD.md", "PRD-BODY\n\n@../shared/X.md\n");
  mk(root, "shared/X.md", "SHARED-X-MARKER");
  const out = await run(root, "#@spec/PRD.md", true);
  assert(has(out, "SHARED-X-MARKER"), `../ relative path from the importing file's dir must resolve; marker absent.\ninjected=${out.injected}`);
});

await test("1c: import in a nested dir resolves to its sibling, not a root same-name file", async () => {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "rel-"));
  mk(root, "a/b/deep.md", "DEEP\n\n@sibling.md\n");
  mk(root, "a/b/sibling.md", "DEEP-SIBLING");
  mk(root, "sibling.md", "ROOT-SIBLING");
  const out = await run(root, "#@a/b/deep.md", true);
  assert(has(out, "DEEP-SIBLING") && !has(out, "ROOT-SIBLING"), `nested import must resolve relative to a/b/, not root`);
});

// ===========================================================================
// GROUP 2 — BARE-@ AT EVERY MARKDOWN DEPTH (setting on → no markdown file needs #@)
// User report: the FIRST imported markdown file requires #@; deeper ones accept @. That asymmetry is the bug.
// ===========================================================================
console.log("\nGROUP 2 — bare-@ at every markdown depth (markdownBareAtImports on)");

await test("2a: depth-1 file may use bare @ (prompt #@a.md; a.md has '@b.md'; b.md has '@c.md') → A,B,C all injected", async () => {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "chain-"));
  mk(root, "a.md", "A-MARKER\n\n@b.md\n");
  mk(root, "b.md", "B-MARKER\n\n@c.md\n");
  mk(root, "c.md", "C-MARKER");
  const out = await run(root, "#@a.md", true);
  assert(has(out, "A-MARKER") && has(out, "B-MARKER") && has(out, "C-MARKER"),
    `bare @ must work at depth 1 too. markers present: A=${has(out,"A-MARKER")} B=${has(out,"B-MARKER")} C=${has(out,"C-MARKER")}. injected=${out.injected}`);
});

await test("2b: the FIRST imported file must NOT require #@ (same chain, a.md bare @ only)", async () => {
  // Explicitly: if a.md's bare '@b.md' is ignored but a deeper file's bare '@' works, that's the reported bug.
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "chain-"));
  mk(root, "a.md", "A-MARKER\n\n@b.md\n");   // bare @, depth 1
  mk(root, "b.md", "B-MARKER");
  const out = await run(root, "#@a.md", true);
  assert(has(out, "B-MARKER"), `BUG per report: the first imported markdown file's bare @ was not honored (B-MARKER absent). injected=${out.injected}`);
});

await test("2c: with setting OFF, bare @ in a markdown file is inert (only #@ imports) — regression guard", async () => {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "chain-"));
  mk(root, "a.md", "A-MARKER\n\n@b.md\n");   // bare @, setting OFF → must NOT import
  mk(root, "b.md", "B-MARKER");
  const out = await run(root, "#@a.md", false);
  assert(!has(out, "B-MARKER"), `with markdownBareAtImports OFF, bare @ in markdown must be inert`);
});

// ===========================================================================
// GROUP 3 — TRAILING PUNCTUATION after the filename in a markdown import
// ===========================================================================
console.log("\nGROUP 3 — trailing punctuation in markdown imports");

for (const [label, suffix] of [["period", "."], ["comma+space", ", and more"], ["paren", ")"]]) {
  await test(`3: @file.md${suffix} in markdown still resolves (trailing punct/sentence must not break it)`, async () => {
    const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "punct-"));
    mk(root, "a.md", `A-MARKER\n\nSee @b.md${suffix}\n`);
    mk(root, "b.md", "B-MARKER");
    const out = await run(root, "#@a.md", true);
    assert(has(out, "B-MARKER"), `trailing "${suffix}" broke the import (B-MARKER absent). injected=${out.injected}`);
  });
}

// ===========================================================================
// GROUP 4 — markdown formatting glued to the filename (italics/bold markers)
// \S+ grabs trailing markdown markers; a filename's extension (.md/.markdown) is its terminator.
// Rule decided with the user: try cleanToken(raw) FIRST; THEN, if it contains .md/.markdown, also try it
// truncated immediately after the LAST .md/.markdown (drops trailing *, **, etc.). _ is a filename char,
// never stripped. Full token wins over truncation (a genuine weird.md.bak beats weird.md).
// ===========================================================================
console.log("\nGROUP 4 — trailing markdown formatting glued to the filename");

await test("4a: trailing italic '*' — '@b.md.*' resolves to b.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\nsee @b.md.*\n"); mk(r, "b.md", "B-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "B-MARKER"), `trailing '*' broke import. injected=${o.injected}`);
});

await test("4b: bold '**' — '@b.md.**' resolves to b.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\nsee @b.md.**\n"); mk(r, "b.md", "B-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "B-MARKER"), `trailing '**' broke import. injected=${o.injected}`);
});

await test("4c: whole italic line — '*see @b.md*' resolves to b.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "*see @b.md*\n"); mk(r, "b.md", "B-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "B-MARKER"), `glued trailing '*' (italic line) broke import. injected=${o.injected}`);
});

await test("4d: underscore is a filename char — '@my_file.md.*' resolves to my_file.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@my_file.md.*\n"); mk(r, "my_file.md", "UNDERSCORE-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "UNDERSCORE-MARKER"), `underscore filename + trailing '*' must still resolve. injected=${o.injected}`);
});

await test("4e: genuine multi-extension wins over truncation — '@weird.md.bak' (both exist) → weird.md.bak", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@weird.md.bak\n"); mk(r, "weird.md.bak", "BAK-MARKER"); mk(r, "weird.md", "MD-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "BAK-MARKER") && !has(o, "MD-MARKER"), `full token 'weird.md.bak' must win over truncation`);
});

await test("4f: truncation fallback when only the .md exists — '@weird.md.bak' (only weird.md) → weird.md", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@weird.md.bak\n"); mk(r, "weird.md", "MD-MARKER"); // no weird.md.bak
  const o = await run(r, "#@a.md", true);
  assert(has(o, "MD-MARKER"), `truncation fallback to weird.md must apply. injected=${o.injected}`);
});

await test("4g: .markdown variant — '@x.markdown.*' resolves to x.markdown", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
  mk(r, "a.md", "A\n\n@x.markdown.*\n"); mk(r, "x.markdown", "MARKDOWN-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "MARKDOWN-MARKER"), `.markdown truncation must work. injected=${o.injected}`);
});

// ===========================================================================
// GROUP 5 — the "#@ first-file-import" issue under markdownBareAtImports: true
// User report: with the setting ON, the FIRST-imported (depth-0) file's imports need #@, while deeper
// files accept bare @. Desired: bare @ works at EVERY depth incl. the first-imported file — identical to
// deeper files, no special-casing. Tests run through BOTH injectFiles (direct) AND the real handler path
// (cfg loaded from live settings, bareAt derived inside the handler — the path pi actually takes).
// ===========================================================================
console.log("\nGROUP 5 — depth-0 (first-imported) file bare-@ under markdownBareAtImports:true");

await test("5a: depth-0 EXACT user line '*...@ARCHITECTURE.md.*' (bare @, italic+glue) → imports [injectFiles]", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "spec/PRD.md", "*End of PRD. Continue with @ARCHITECTURE.md.*\n");
  mk(r, "spec/ARCHITECTURE.md", "ARCH-MARKER");
  const o = await run(r, "#@spec/PRD.md", true);
  assert(has(o, "ARCH-MARKER"), `depth-0 bare-@ (italic line) must import. injected=${o.injected}`);
});

await test("5b: SAME via the REAL handler path (cfg from live settings → bareAt derived inside handler)", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "spec/PRD.md", "*End of PRD. Continue with @ARCHITECTURE.md.*\n");
  mk(r, "spec/ARCHITECTURE.md", "ARCH-MARKER");
  const { out, msg } = await runHandler(r, "#@spec/PRD.md");
  assert(out.action === "transform" && msg.message.content.includes("ARCH-MARKER"),
    `real handler path: depth-0 bare-@ must import. action=${out.action}`);
});

await test("5c: depth-0 plain bare-@ (own line, no glue) → imports", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "a.md", "A\n\n@b.md\n"); mk(r, "b.md", "B-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "B-MARKER"), `depth-0 plain bare-@ must import. injected=${o.injected}`);
});

await test("5d: depth-0 bare-@ ALSO via the real handler path (plain, no glue)", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "a.md", "A\n\n@b.md\n"); mk(r, "b.md", "B-MARKER");
  const { out, msg } = await runHandler(r, "#@a.md");
  assert(out.action === "transform" && msg.message.content.includes("B-MARKER"), `real handler: depth-0 bare-@ must import. action=${out.action}`);
});

await test("5e: NO asymmetry — depth-0 AND depth-1 bare-@ BOTH honored (setting on)", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "a.md", "A-MARKER\n\n@b.md\n");   // depth-0 file, bare @
  mk(r, "b.md", "B-MARKER\n\n@c.md\n");   // depth-1 file, bare @
  mk(r, "c.md", "C-MARKER");
  const o = await run(r, "#@a.md", true);
  assert(has(o, "A-MARKER") && has(o, "B-MARKER") && has(o, "C-MARKER"),
    `depth-0 (B=${has(o,"B-MARKER")}) and depth-1 (C=${has(o,"C-MARKER")}) bare-@ must BOTH work — no first-file special-casing`);
});

await test("5f: setting OFF → bare-@ inert at depth-0 AND depth-1 (regression guard)", async () => {
  const r = fsSync.mkdtempSync(path.join(os.tmpdir(), "d0-"));
  mk(r, "a.md", "A-MARKER\n\n@b.md\n"); mk(r, "b.md", "B-MARKER\n\n@c.md\n"); mk(r, "c.md", "C-MARKER");
  const o = await run(r, "#@a.md", false);
  assert(!has(o, "B-MARKER") && !has(o, "C-MARKER"),
    `setting OFF → bare-@ inert everywhere (B=${has(o,"B-MARKER")} C=${has(o,"C-MARKER")})`);
});

console.log(`\n────────────────────────────────────────\nResult: ${passed} passed, ${failed} failed\n────────────────────────────────────────`);
process.exit(failed ? 1 : 0);
