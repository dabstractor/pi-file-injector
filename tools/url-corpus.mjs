// URL-injection corpus harness — runs every entry in url-corpus.data.mjs through the REAL
// file-injector.ts (same jiti+alias harness as url-injection.test.mjs) with REAL network fetches.
// NOT part of `npm test`. Run manually:  node tools/url-corpus.mjs [--cat <cat>] [--verbose]
//
// For each URL it calls injectFiles("#<url>", [], {cwd:tmp}, false, true, noop) in a FRESH state,
// captures outcome (injected? blocks? images? detail kind? notify?), grades it against `expected`
// (see vocabulary in url-corpus.data.mjs), and prints a per-category + grand summary. Network
// failures (ECONNRESET etc.) are graded "netfail" and never crash the run.
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { fileURLToPath } from "node:url";
import { CORPUS } from "./url-corpus.data.mjs";

// ── load the real extension via pi's nested jiti (identical alias map to the test harness) ──
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");
const PIPKG = process.env.HOME + "/.local/lib/node_modules/@earendil-works/pi-coding-agent";
if (!fsSync.existsSync(PIPKG + "/dist/index.js")) throw new Error("pi package not found at " + PIPKG);
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const mod = await jiti.import(path.join(REPO, "file-injector.ts"));

// ── CLI ──
const argv = process.argv.slice(2);
const catFilter = argv.includes("--cat") ? argv[argv.indexOf("--cat") + 1] : null;
const verbose = argv.includes("--verbose");

// ── helpers ──
const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
const ms = (t) => (t >= 1000 ? (t / 1000).toFixed(1) + "s" : t + "ms");

function classify(r, url) {
  // What did the extension ACTUALLY do? Derived from the injectFiles result.
  if (r.injected === 0 && r.images.length === 0) return "verbatim";
  const d = r.details[0];
  if (d?.kind === "image") return "image";
  const block = r.blocks[0] ?? "";
  // Exact envelope strip: block = `<file name="URL">\n` + body + `\n</file>`
  // (12 + url.length + 3 prefix chars, 8 suffix chars) — tiny JSON bodies must not clamp to 0.
  const bodyLen = Math.max(0, block.length - url.length - 23);
  return { kind: "injected", detail: d?.kind ?? "?", bodyLen };
}

function gradeOf(actual, expected) {
  if (expected === "any") return "record"; // record-only
  if (actual === expected) return "pass";
  // raw: injected with a NON-EMPTY body (tiny JSON APIs are legitimately ~80 chars);
  // extract: defuddle floor guarantees >= URL_MIN_CONTENT (200) markdown — hold it to that.
  if (expected === "raw" && typeof actual === "object" && actual.kind === "injected" && actual.bodyLen > 0) return "pass";
  if (expected === "extract" && typeof actual === "object" && actual.kind === "injected" && actual.bodyLen >= 200) return "pass";
  if (expected === "decline" && actual === "verbatim") return "pass";
  if (expected === "cap" && actual === "verbatim") return "pass"; // >1MB declined (pre- or mid-stream)
  return "fail";
}

const results = [];
let n = 0;
console.log(`Running ${catFilter ? "category '" + catFilter + "' of " : ""}${CORPUS.length} URLs (real network)…\n`);

for (const entry of CORPUS) {
  if (catFilter && entry.cat !== catFilter) continue;
  n++;
  const notes = [];
  const ctx = {
    cwd: TMP,
    hasUI: true,
    ui: { notify: (m, t) => notes.push(`[${t}] ${m}`) },
  };
  const t0 = Date.now();
  let actual, err = null;
  try {
    const r = await mod.injectFiles("#" + entry.url, [], ctx, false, true, () => {});
    actual = classify(r, r.details[0]?.path ?? entry.url);
  } catch (e) {
    err = e;
    actual = "throw";
  }
  const dt = Date.now() - t0;
  const grade = gradeOf(actual, entry.grade);
  results.push({ ...entry, expected: entry.grade, actual, grade, notes, dt, err: err ? String(err.message ?? err).slice(0, 200) : null });

  const flag = grade === "pass" ? "✓" : grade === "fail" ? "✗" : "·";
  const act = typeof actual === "object" ? `injected(${actual.detail}, body≈${actual.bodyLen})` : actual;
  console.log(`${flag} [${entry.cat}] ${entry.url}`);
  console.log(`    expected=${entry.grade} actual=${act} ${ms(dt)}${notes.length ? "  notify:" + JSON.stringify(notes) : ""}${err ? "  ERR:" + err : ""}`);
}

// ── summary ──
console.log("\n" + "═".repeat(72));
const byGrade = {};
for (const r of results) byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
console.log(`GRADES: ${Object.entries(byGrade).map(([k, v]) => `${k}=${v}`).join("  ")}   (of ${results.length})`);

console.log("\nBy category:");
const cats = [...new Set(results.map((r) => r.cat))];
for (const c of cats) {
  const rs = results.filter((r) => r.cat === c);
  const fails = rs.filter((r) => r.grade === "fail");
  console.log(`  ${c.padEnd(14)} ${rs.length}  fail=${fails.length}${fails.length ? "  ← " + fails.map((f) => f.url).join(", ") : ""}`);
}

const fails = results.filter((r) => r.grade === "fail");
if (fails.length) {
  console.log("\nFAILURES (expected → actual):");
  for (const f of fails) {
    const act = typeof f.actual === "object" ? `injected(${f.actual.detail}, body≈${f.actual.bodyLen})` : f.actual;
    console.log(`  ${f.url}\n    expected=${f.expected}  actual=${act}${f.notes.length ? "  notify:" + JSON.stringify(f.notes) : ""}`);
  }
}
console.log("\nDone.");