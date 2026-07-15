// Test 13: format parity — compare processFileArguments block vs the extension's block
import { pathToFileURL } from "node:url";
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
// Deep-import processFileArguments (NOT in main index; lives in dist/cli/file-processor.js)
const fp = await jiti.import(pathToFileURL(PI + "/dist/cli/file-processor.js").href);
const builtin = await fp.processFileArguments(["/tmp/saf-smoke/a.ts"]);
console.log("=== BUILTIN @a.ts text (raw, repr) ===");
console.log(JSON.stringify(builtin.text));
console.log("=== BUILTIN images count ===", builtin.images.length);

// Extension block from cap1.json
import { readFileSync } from "node:fs";
const cap = JSON.parse(readFileSync("/tmp/saf-smoke/cap1.json", "utf8"));
const userText = cap.messages.filter(m=>m.role==="user").pop().content[0].text;
const extBlockMatch = userText.match(/<file name="[^"]*">\n[\s\S]*?<\/file>/);
const extBlock = extBlockMatch[0];
console.log("=== EXTENSION #@a.ts block (raw, repr) ===");
console.log(JSON.stringify(extBlock));

// Compare: normalize by stripping a SINGLE trailing \n before </file> on the builtin block
const builtinBlock = builtin.text.trimEnd(); // strip the trailing \n that processFileArguments appends
console.log("\n=== PARITY (block, after trimming builtin trailing \\n) ===");
console.log(builtinBlock === extBlock ? "MATCH ✅" : "DIFFER ❌");
if (builtinBlock !== extBlock) {
  console.log("builtin:", JSON.stringify(builtinBlock));
  console.log("ext:    ", JSON.stringify(extBlock));
}
