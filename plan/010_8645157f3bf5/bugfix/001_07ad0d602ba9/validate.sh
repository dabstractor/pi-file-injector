#!/usr/bin/env bash
# validate.sh — end-to-end validation of the pi-file-injector / url-injector extension.
#
# This validator is READ-ONLY with respect to the repo: it runs the project's own gates
# (typecheck + the four standalone .mjs test suites) and then an INDEPENDENT, hermetic
# end-to-end probe that loads the REAL committed extension through Pi's own loader (jiti
# with the same alias map Pi's extension loader uses) and re-checks the user-facing
# workflows — including the exact BUG-001 / BUG-002 reproduction steps from the PRD — so
# the result does not rely on the project's own assertions alone.
#
# Phases (only those that apply to this repo):
#   1. Type checking      — `npm run typecheck`  (file-injector.ts under --strict)
#   2. Unit / acceptance   — `npm test`           (4 standalone .mjs suites)
#   3. E2E user workflow   — independent jiti probe (PRD repro steps + positive controls)
#
# Exit 0 iff every phase is green.
set -u
cd "$(dirname "$0")"

REPO="$(pwd)"
FAIL=0
sep() { printf '\n──────── %s ────────\n' "$1"; }

# ── Phase 1: type checking ────────────────────────────────────────────────────
sep "Phase 1: typecheck (npm run typecheck)"
if npm run --silent typecheck; then
  echo "[phase1] PASS"
else
  echo "[phase1] FAIL"; FAIL=1
fi

# ── Phase 2: unit / acceptance suites ─────────────────────────────────────────
sep "Phase 2: acceptance suites (npm test)"
if npm test; then
  echo "[phase2] PASS"
else
  echo "[phase2] FAIL"; FAIL=1
fi

# ── Phase 3: independent end-to-end user-workflow probe ───────────────────────
# Loads the REAL extension via jiti (Pi's own loader) and asserts the actual user
# behaviors: (a) the PRD BUG-001 repros (#main.go, #notes.md, … + the Go-homepage
# content-injection harm) must NOT fetch/inject; (b) real domains DO fetch+inject
# (gate scope correct); (c) the explicit-scheme escape hatch still works; (d) the
# enableUrls:false air-gap yields zero egress; (e) the PRD BUG-002 repro (URL-only
# notify) must NOT say '#@'. The harness is written to a TEMP file (never the repo)
# and cleaned up on exit.
sep "Phase 3: independent E2E probe (real extension via jiti)"
PROBE="$(mktemp -t valprobe.XXXXXX.mjs)"
trap 'rm -f "$PROBE"' EXIT
cat > "$PROBE" <<'PROBE_EOF'
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const REPO = process.argv[2];
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const mod = await jiti.import(path.resolve(REPO, "file-injector.ts"));
const TMP = mkdtempSync(path.join(os.tmpdir(), "valprobe-"));
const ctx = { cwd: TMP, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} } };
const origFetch = globalThis.fetch;
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✓" : "✗"} ${n}${c || !d ? "" : " — " + d}`); };
const makeRes = ({ ct = "text/html", body = "", status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => k.toLowerCase() === "content-type" ? ct : null },
  body: null,
  async arrayBuffer() { return new TextEncoder().encode(body).buffer; },
  async text() { return body; },
});
const blockNames = (r) => [...(r.blocks.join("\n\n")).matchAll(/<file name="([^"]+)">/g)].map((m) => m[1]);
// A rich HTML body (≥200 chars post-extraction) so the SPA floor (§3.4) does NOT fire.
const RICH = `<!doctype html><html><head><meta charset="utf-8"><title>Example Domain Test Page</title></head><body><main><article>
<h2>Welcome to the Example Domain</h2>
<p>This is the first substantial paragraph of the Example Domain test article. It is written to be long enough that the content extraction library produces a meaningful body of markdown well above the minimum content threshold enforced by the injection pipeline. The paragraph discusses how the URL injection feature works end to end, from detection of the scheme-less token through normalization, dispatch by content type, and finally the delivery of the extracted markdown inside a file block envelope that mirrors the local file injection shape.</p>
<p>The second paragraph elaborates on the collision rules that govern whether a hash token is treated as a URL reference, a local file reference, or ordinary prose. A token like example.com has a dotted host with an alphabetic top-level domain, so it passes the shape gate and is fetched and injected. The pipeline leaves the token verbatim in the prompt when the fetch returns a non-success status.</p>
<p>The third paragraph covers the deduplication rule that normalizes scheme-less and fully-qualified forms to the same absolute URL before fetching. When a prompt mentions the same web resource twice the pipeline issues exactly one network request and emits exactly one injection block, sharing the context budget across both trigger kinds.</p>
</article></main></body></html>`;

// [BUG-001 harm1] the PRD's exact repro list: #filename.ext must NOT fetch (enableUrls default ON)
console.log("[BUG-001 harm1] #filename.ext prose must NOT fetch");
for (const tok of ["#main.go","#notes.md","#config.json","#image.png","#script.py","#utils.rs","#spec.tsx","#app.cs","#lib.java","#data.csv"]) {
  const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({}); };
    const r = await mod.injectFiles(tok, [], ctx, false, true);
    ok(`${tok} no-fetch`, calls.length === 0, JSON.stringify(calls));
    ok(`${tok} no-inject`, r.injected === 0, "injected=" + r.injected);
    ok(`${tok} verbatim`, r.text === tok, JSON.stringify(r.text));
  } finally { globalThis.fetch = origFetch; }
}

// [BUG-001 harm2] content-injection harm: 'refactor #main.go now' must NOT deliver the Go homepage
console.log("[BUG-001 harm2] refactor #main.go now must NOT inject Go homepage");
{ const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({ ct: "text/html", body: RICH, status: 200 }); };
    const r = await mod.injectFiles("refactor #main.go now", [], ctx, false, true);
    ok("no fetch", calls.length === 0, JSON.stringify(calls));
    ok("injected 0", r.injected === 0, "injected=" + r.injected);
    ok("no main.go block", !blockNames(r).includes("https://main.go"), JSON.stringify(blockNames(r)));
  } finally { globalThis.fetch = origFetch; } }

// [positive] a REAL domain still fetches + injects (gate scope is correct, not over-broad)
console.log("[positive] real domain #example.com DOES fetch + inject");
{ const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({ ct: "text/html", body: RICH, status: 200 }); };
    const r = await mod.injectFiles("Summarize #example.com", [], ctx, false, true);
    ok("fetch once", calls.length === 1, JSON.stringify(calls));
    ok("injected 1", r.injected === 1, "injected=" + r.injected);
    ok("block present", blockNames(r).includes("https://example.com"), JSON.stringify(blockNames(r)));
  } finally { globalThis.fetch = origFetch; } }

// [bypass] explicit-scheme escape hatch still fetches
console.log("[bypass] #https://node.js explicit scheme fetches");
{ const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({ status: 404, body: "" }); };
    const r = await mod.injectFiles("#https://node.js", [], ctx, false, true);
    ok("fetch called", calls.length === 1 && calls[0] === "https://node.js", JSON.stringify(calls));
    ok("404 verbatim", r.injected === 0, "injected=" + r.injected);
  } finally { globalThis.fetch = origFetch; } }

// [airgap] enableUrls===false → zero egress even for a real domain
console.log("[airgap] enableUrls===false → zero fetch");
{ const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({}); };
    const r = await mod.injectFiles("Summarize #example.com", [], ctx, false, false);
    ok("zero fetch", calls.length === 0, JSON.stringify(calls));
    ok("injected 0", r.injected === 0, "injected=" + r.injected);
  } finally { globalThis.fetch = origFetch; } }

// [BUG-002] URL-only notify must NOT say '#@' (handler-level, real factory)
console.log("[BUG-002] URL-only notify wording (handler-level)");
{ const m2 = await jiti.import(path.resolve(REPO, "file-injector.ts"));
  const H = {}; const notes = [];
  await m2.default({ on: (e, f) => { (H[e] ||= []).push(f); }, registerMessageRenderer: () => {} });
  await H.session_start?.[0]?.({}, ctx);
  const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({ ct: "text/html", body: RICH, status: 200 }); };
    const ui = { cwd: TMP, hasUI: true, isProjectTrusted: () => true, ui: { notify: (mm, t) => notes.push({ m: mm, t }) } };
    const res = await H.input?.[0]?.({ text: "see #example.com", images: [] }, ui);
    ok("notify fired", notes.length === 1, JSON.stringify(notes));
    ok("no '#@' in notify", notes.length === 1 && !/#@/.test(notes[0].m), JSON.stringify(notes[0]?.m));
    ok("notify mentions URL", notes.length === 1 && /URL/i.test(notes[0].m), JSON.stringify(notes[0]?.m));
    ok("transform verbatim", res?.action === "transform" && res?.text === "see #example.com", JSON.stringify(res));
  } finally { globalThis.fetch = origFetch; } }

// [edge] uppercase final label also denied
console.log("[edge] #main.GO uppercase also denied");
{ const calls = [];
  try { globalThis.fetch = async (u) => { calls.push(String(u)); return makeRes({}); };
    const r = await mod.injectFiles("#main.GO", [], ctx, false, true);
    ok("no fetch", calls.length === 0, JSON.stringify(calls));
  } finally { globalThis.fetch = origFetch; } }

console.log(`\n==== PROBE: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
PROBE_EOF

if node "$PROBE" "$REPO"; then
  echo "[phase3] PASS"
else
  echo "[phase3] FAIL"; FAIL=1
fi

sep "VALIDATION SUMMARY"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL PHASES PASSED (typecheck + acceptance suites + independent E2E probe)"
  exit 0
else
  echo "ONE OR MORE PHASES FAILED"
  exit 1
fi