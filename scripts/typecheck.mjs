#!/usr/bin/env node
// `npm run typecheck` — type-check file-injector.ts under --strict against pi's shipped .d.ts.
//
// pi is installed GLOBALLY (the repo is dependency-free at the project level), so the .d.ts we
// must resolve lives outside the repo in the global node_modules. This wrapper resolves that path
// at runtime, writes a temp tsconfig with the correct `paths`, and invokes tsc — matching
// validate.sh's Phase 1 so a local `npm run typecheck` and CI see identical behavior. Exits 0 on
// a clean check, non-zero on any TS error (CI-ready).
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// `npm run` executes from the package root, so cwd is the repo root. Fall back to the script's
// parent dir (one level up from scripts/) if invoked directly from elsewhere.
const ROOT = fs.existsSync(path.join(process.cwd(), "file-injector.ts"))
  ? process.cwd()
  : path.resolve(path.dirname(new URL(".", import.meta.url).pathname), "..");

if (!fs.existsSync(path.join(ROOT, "file-injector.ts"))) {
  console.error(`typecheck: file-injector.ts not found under ${ROOT}`);
  process.exit(1);
}

// Resolve the globally-installed pi package root.
let PIPKG;
try {
  PIPKG = path.join(execSync("npm root -g").toString().trim(), "@earendil-works/pi-coding-agent");
} catch {
  console.error("typecheck: could not run `npm root -g` to locate pi.");
  process.exit(1);
}
const PI_TYPES = path.join(PIPKG, "dist/index.d.ts");
const PIAI_TYPES = path.join(PIPKG, "node_modules/@earendil-works/pi-ai/dist/index.d.ts");

if (!fs.existsSync(PI_TYPES)) {
  console.error(`typecheck: pi .d.ts not found at ${PI_TYPES} (is pi installed globally?).`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-file-injector-tsc-"));
const tsconfig = path.join(tmp, "tsconfig.json");
fs.writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      baseUrl: ".",
      paths: {
        "@earendil-works/pi-coding-agent": [PI_TYPES],
        // pi-ai .d.ts falls back to index.d.ts then compat.d.ts (both shipped by pi-ai).
        "@earendil-works/pi-ai": fs.existsSync(PIAI_TYPES) ? [PIAI_TYPES] : [path.join(PIPKG, "node_modules/@earendil-works/pi-ai/dist/compat.d.ts")],
        // pi-tui .d.ts (a NESTED dep under pi-coding-agent/node_modules). Needed since P1.M1.T2.S2 added
        // `import { Box, Text, type Component } from "@earendil-works/pi-tui"` for the §6.3 MessageRenderer.
        // tsc Bundler resolution does NOT walk up to the global node_modules for a project-root `files:`
        // entry, so without this paths mapping tsc errors with TS2307 Cannot find module '@earendil-works/pi-tui'.
        // (The test-harness jiti alias for pi-tui is a SEPARATE concern — owned by P1.M2.T2.S2.)
        "@earendil-works/pi-tui": [path.join(PIPKG, "node_modules/@earendil-works/pi-tui/dist/index.d.ts")],
      },
    },
    files: [path.join(ROOT, "file-injector.ts")],
  }),
);

try {
  execSync(`npx --yes -p typescript@5.6 tsc -p ${JSON.stringify(tsconfig)} --listFiles`, {
    stdio: "inherit",
  });
  console.error("typecheck: file-injector.ts type-checks clean under --strict (0 errors)");
} catch {
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
