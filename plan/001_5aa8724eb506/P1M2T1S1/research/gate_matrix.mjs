// Deterministic 14-case acceptance gate for file-injector.ts (Tier A, model-free).
// Loads the extension via jiti (Pi's loader), captures the input handler, creates real
// fixtures in a temp sandbox, runs synthetic InputEvents, asserts the transform output.
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const EXT = process.env.EXT || "/home/dustin/projects/pi-file-injector/file-injector.ts";
const mod = await jiti.import(pathToFileURL(EXT).href);

let pass = 0, fail = 0;
const results = [];
const T = (n, cond, detail = "") => {
  if (cond) { pass++; results.push(`PASS  ${n}`); }
  else { fail++; results.push(`FAIL  ${n}${detail ? "  — " + detail : ""}`); }
};

let inputHandler = null;
const pi = { on(event, handler) { if (event === "input") inputHandler = handler; } };
T("L:default export is function", typeof mod.default === "function");
mod.default(pi);
T("L:handler captured via on('input')", typeof inputHandler === "function");

// --- sandbox + fixtures ---
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "saf-"));
process.env.HOME = sandbox; // make os.homedir() resolve into the sandbox (Test 10 tilde)
const abs = (rel) => path.resolve(sandbox, rel);

const A_BODY = 'export const GREETING = "hello world";\nexport function add(a, b) { return a + b; }\n';
await fs.writeFile(abs("a.ts"), A_BODY);
await fs.writeFile(abs("b.ts"), 'export const TWO = "second file body";\n');
// huge.log — 2MB representative (item allows "smaller representative"); assert NO truncation by full equality
const hugeLines = []; const HUGE_BYTES = 2 * 1024 * 1024;
let acc = ""; while (acc.length < HUGE_BYTES) { acc += "log line payload 0123456789abcdef\n"; }
await fs.writeFile(abs("huge.log"), acc); const HUGE_BODY = acc;
// pic.png — minimal valid 1x1 PNG (base64). resizeImage accepts it; falls back to raw if null.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
await fs.writeFile(abs("pic.png"), Buffer.from(PNG_B64, "base64"));
// data.bin — binary with NUL bytes
await fs.writeFile(abs("data.bin"), Buffer.from([0x49, 0x00, 0x54, 0x45, 0x00, 0x53, 0x54, 0x00, 0x21]));
// src/ — directory
await fs.mkdir(abs("src"));
// ~/notes.md — tilde-expanded (resolves into sandbox because HOME=sandbox)
await fs.writeFile(path.join(sandbox, "notes.md"), "# tilde notes\nhome is sandbox\n");

const makeCtx = (hasUI = true) => {
  const notifies = [];
  return { cwd: sandbox, hasUI, ui: { notify: (m, t) => notifies.push([m, t]) }, _notifies: notifies };
};
const run = async (text, { source = "interactive", streamingBehavior, images = [], hasUI = true } = {}) => {
  const ctx = makeCtx(hasUI);
  const event = { type: "input", text, images, source };
  if (streamingBehavior) event.streamingBehavior = streamingBehavior;
  const res = await inputHandler(event, ctx);
  return { res, ctx };
};
const blockOf = (text, nameHint) => {
  const re = new RegExp('<file name="' + (nameHint ? nameHint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : '[^"]*') + '">[\\s\\S]*?</file>');
  return text.match(re)?.[0] ?? null;
};

try {
  // ===== TEST 1: text file injected, marker preserved, block after ---, NO image =====
  {
    const { res, ctx } = await run("Review #@a.ts");
    T("1:transform", res?.action === "transform", JSON.stringify(res));
    T("1:marker preserved (starts with)", typeof res.text === "string" && res.text.startsWith("Review #@a.ts"));
    T("1:--- separator present", res.text.includes("\n\n---\n\n"));
    const idxSep = res.text.indexOf("\n\n---\n\n");
    const idxBlock = res.text.indexOf("<file name=\"" + abs("a.ts") + "\">");
    T("1:block after ---", idxBlock > idxSep, `sep=${idxSep} block=${idxBlock}`);
    const blk = blockOf(res.text, abs("a.ts"));
    // formatTextFileBlock = '<file name="ABS">\n' + content + '\n</file>'; inner content == raw file bytes
    const pre = `<file name="${abs("a.ts")}">\n`, post = `\n</file>`;
    const inner = blk && blk.startsWith(pre) && blk.endsWith(post) ? blk.slice(pre.length, blk.length - post.length) : null;
    T("1:block exact format (inner==raw file)", inner === A_BODY, `inner=${JSON.stringify(inner)} want=${JSON.stringify(A_BODY)}`);
    T("1:no image pushed", Array.isArray(res.images) && res.images.length === 0);
    T("1:notify 1 file", ctx._notifies.length === 1 && ctx._notifies[0][0] === "#@ injected 1 file(s)" && ctx._notifies[0][1] === "info");
  }
  // ===== TEST 2: huge file ENTIRE, no truncation =====
  {
    const { res } = await run("Summarize #@huge.log");
    T("2:transform", res?.action === "transform");
    const blk = blockOf(res.text, abs("huge.log"));
    T("2:block present", blk !== null);
    const inner = blk.slice(("<file name=\"" + abs("huge.log") + "\">\n").length, blk.length - "\n</file>".length);
    T("2:entire content (no truncation)", inner === HUGE_BODY, `len inner=${inner.length} vs file=${HUGE_BODY.length}`);
  }
  // ===== TEST 3: image attached + reference block + marker in text =====
  {
    const { res, ctx } = await run("Describe #@pic.png");
    T("3:transform", res?.action === "transform");
    T("3:image pushed", Array.isArray(res.images) && res.images.length === 1);
    T("3:image shape", res.images[0]?.type === "image" && typeof res.images[0]?.data === "string" && res.images[0]?.data.length > 0);
    T("3:image no data: prefix", !res.images[0].data.startsWith("data:"));
    T("3:mimeType png", res.images[0]?.mimeType === "image/png");
    T("3:image reference block", blockOf(res.text, abs("pic.png")) !== null);
    T("3:marker in text", res.text.startsWith("Describe #@pic.png"));
  }
  // ===== TEST 4: binary note, no garbage =====
  {
    const { res } = await run("Inspect #@data.bin");
    T("4:transform", res?.action === "transform");
    const blk = blockOf(res.text, abs("data.bin"));
    T("4:binary note block", blk === `<file name="${abs("data.bin")}"><binary file \u2014 contents not injected; use the read tool if needed></file>`, JSON.stringify(blk));
    T("4:no raw NUL bytes in text", !res.text.includes("\u0000"));
  }
  // ===== TEST 5: missing -> verbatim, unchanged =====
  {
    const { res, ctx } = await run("Fix #@nope.ts");
    T("5:continue (verbatim)", res?.action === "continue");
    T("5:no notify", ctx._notifies.length === 0);
  }
  // ===== TEST 6: directory -> verbatim =====
  {
    const { res, ctx } = await run("List #@src/");
    T("6:continue (directory)", res?.action === "continue");
    T("6:no notify", ctx._notifies.length === 0);
  }
  // ===== TEST 7: mid-word foo#@bar -> NO expansion =====
  {
    const { res, ctx } = await run("the foo#@bar thing");
    T("7:continue (mid-word)", res?.action === "continue");
    T("7:no notify", ctx._notifies.length === 0);
  }
  // ===== TEST 8: markdown/issue, no #@ -> NO expansion =====
  {
    const { res, ctx } = await run("# Heading and #1234");
    T("8:continue (no #@)", res?.action === "continue");
    T("8:no notify", ctx._notifies.length === 0);
  }
  // ===== TEST 9: multi-file -> both injected, notify 2 =====
  {
    const { res, ctx } = await run("Diff #@a.ts vs #@b.ts");
    T("9:transform", res?.action === "transform");
    const ia = res.text.indexOf("<file name=\"" + abs("a.ts") + "\">");
    const ib = res.text.indexOf("<file name=\"" + abs("b.ts") + "\">");
    T("9:both blocks present", ia > -1 && ib > -1);
    T("9:order a before b", ia < ib);
    T("9:notify 2 files", ctx._notifies.length === 1 && ctx._notifies[0][0] === "#@ injected 2 file(s)");
  }
  // ===== TEST 10: tilde expansion -> injected =====
  {
    const { res } = await run("Read #@~/notes.md");
    T("10:transform", res?.action === "transform");
    const expectedName = path.join(os.homedir(), "notes.md"); // == sandbox/notes.md
    const blk = blockOf(res.text, expectedName);
    T("10:tilde-expanded block name", blk !== null, "expected name=" + expectedName);
  }
  // ===== TEST 11: trailing period trimmed -> injected =====
  {
    const { res } = await run("See #@a.ts.");
    T("11:transform", res?.action === "transform");
    const blk = blockOf(res.text, abs("a.ts")); // name must be a.ts NOT a.ts.
    T("11:period trimmed (block name a.ts)", blk !== null);
    T("11:marker preserved", res.text.startsWith("See #@a.ts."));
    T("11:no block for a.ts.", !res.text.includes('name="' + abs("a.ts.") + '"'));
  }
  // ===== TEST 13 (parity): extension block == processFileArguments block (sans trailing \n) =====
  {
    const fp = await jiti.import(pathToFileURL(PI + "/dist/cli/file-processor.js").href);
    const builtin = await fp.processFileArguments([abs("a.ts")]);
    const { res } = await run("x #@a.ts");
    const extBlock = blockOf(res.text, abs("a.ts"));
    T("13:builtin trailing \\n", builtin.text.endsWith("\n</file>\n"), JSON.stringify(builtin.text.slice(-12)));
    T("13:parity (after trimming builtin trailing \\n)", builtin.text.trimEnd() === extBlock, "builtin=" + JSON.stringify(builtin.text.trimEnd()) + " ext=" + JSON.stringify(extBlock));
  }
  // ===== TEST 14: bare @a.ts -> NO injection (non-interference) =====
  {
    const { res, ctx } = await run("Review @a.ts");
    T("14:continue (bare @)", res?.action === "continue");
    T("14:no block", !(typeof res?.text === "string" && res.text.includes("<file name=")));
    T("14:no notify", ctx._notifies.length === 0);
  }
  // ===== Bonus: guards exercised by T3.S2 (loop/steer/headless) — keep for regression =====
  {
    const e = await run("x #@a.ts", { source: "extension" });
    T("G:ext-source continue", e.res?.action === "continue");
    const s = await run("x #@a.ts", { streamingBehavior: "steer" });
    T("G:steer continue", s.res?.action === "continue");
    const h = await run("x #@a.ts", { hasUI: false });
    T("G:headless still injects", h.res?.action === "transform");
    T("G:headless no notify", h.ctx._notifies.length === 0);
    const img = { type: "image", data: "USER", mimeType: "image/png" };
    const m = await run("x #@a.ts", { images: [img] });
    T("G:user image preserved", Array.isArray(m.res.images) && m.res.images[0] === img);
  }
} finally {
  await fs.rm(sandbox, { recursive: true, force: true });
}

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
