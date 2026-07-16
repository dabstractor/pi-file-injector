import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));

const REPO = path.resolve(process.env.HOME, "projects/test-repo");
const ctx = { cwd: REPO, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} } };

function blocksOf(text) {
  return [...text.matchAll(/<file name="([^"]+)">/g)].map((m) => m[1]);
}

async function run(label, prompt, bareAt) {
  const out = await mod.injectFiles(prompt, [], ctx, bareAt);
  const files = out.action === "transform" ? blocksOf(out.text) : [];
  console.log(`\n=== ${label} (bareAt=${bareAt}) ===`);
  console.log("  action:", out.action, "| injected:", out.injected, "| paged:", out.paged);
  for (const f of files) console.log("   block:", path.relative(REPO, f));
  if (!files.length) console.log("   (no blocks)");
}

// 1. PASSING case (repo root, #@)
await run("main.md via #@", "#@main.md", true);

// 2. FAILING case (spec/PRD.md via #@, bareAt ON so the bare @ inside should also resolve)
await run("spec/PRD.md via #@ (bareAt ON)", "#@spec/PRD.md", true);

// 3. Same but bareAt OFF — only #@ inside should resolve
await run("spec/PRD.md via #@ (bareAt OFF)", "#@spec/PRD.md", false);

// 4. Direct probe: scan the ACTUAL spec/PRD.md content for tokens
const prd = readFileSync(path.join(REPO, "spec/PRD.md"), "utf8");
for (const bareAt of [true, false]) {
  const recs = await mod.scanTokens(
    prd, path.join(REPO, "spec"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt },
    { blocks: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 },
  );
  console.log(`\nscanTokens(spec/PRD.md, baseDir=spec/, bareAt=${bareAt}) → ${recs.length} record(s):`);
  for (const r of recs) console.log(`   idx=${r.index} prefixLen=${r.prefixLen} abs=${path.relative(REPO, r.abs)}`);
}

// 5. Direct probe: does ARCHITECTURE.md resolve relative to spec dir vs cwd?
console.log("\nresolveImportPath probes:");
for (const [tok, base] of [["ARCHITECTURE.md", "spec"], ["ARCHITECTURE.md", "."], ["ARCHITECTURE", "spec"]]) {
  const abs = await mod.resolveImportPath(tok, path.join(REPO, base), true);
  console.log(`   resolveImportPath(${JSON.stringify(tok)}, baseDir=${base}) → ${abs ? path.relative(REPO, abs) : "null (not found)"}`);
}

// 6. cleanToken on trailing-punctuation cases
console.log("\ncleanToken probes:");
for (const t of ["ARCHITECTURE.md", "ARCHITECTURE.md.", "ARCHITECTURE.md,", "ARCHITECTURE.md.", 'ARCHITECTURE.md".']) {
  console.log(`   cleanToken(${JSON.stringify(t)}) → ${JSON.stringify(mod.cleanToken(t))}`);
}
