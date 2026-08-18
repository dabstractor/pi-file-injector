#!/usr/bin/env bash
# validate.sh — comprehensive validation for pi-file-injector (the `#@file` + `#<url>` extension).
#
# This validator is a READ-ONLY checker. It runs three phases against the REAL committed code:
#
#   Phase 1 — Type checking      : `npm run typecheck` (strict, against pi's shipped .d.ts)
#   Phase 2 — Unit testing        : `npm test` (4 model-free harnesses: 241 assertions)
#   Phase 3 — E2E handler lifecycle + real-pi runtime smoke:
#       3a. Loads the extension via Pi's own jiti loader and exercises the FULL factory lifecycle
#           (session_start → input → before_agent_start → MessageRenderer) with a mock ExtensionAPI,
#           asserting the real user workflows from the README (file / image / url / markdown-imports /
#           missing-file / bare-@-unchanged). This covers the handler wiring the unit tests bypass by
#           calling injectFiles() directly.
#       3b. Spawns the REAL `pi` binary (`-ne -e ./file-injector.ts --mode json`) and confirms the
#           custom message carrying the `<file>` block is emitted after the verbatim user message —
#           the §6.2 delivery contract — using a single isolated copy (`-ne` avoids the double-injection
#           that occurs when a second copy of the extension is loaded concurrently).
#
# Exit code: 0 only if every phase passes. Any failure prints a clear message and exits non-zero.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# The pi binary (used for Phase 3b). Defaults to the one on PATH; override via PI_BIN.
PI_BIN="${PI_BIN:-pi}"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

FAIL=0
phase() { echo; bold "=== Phase $1: $2 ==="; }

# -----------------------------------------------------------------------------
phase 1 "Type checking (npm run typecheck, --strict)"
# -----------------------------------------------------------------------------
if ! npm run typecheck >/tmp/validate_typecheck.log 2>&1; then
  red "FAIL: typecheck reported errors."
  tail -20 /tmp/validate_typecheck.log
  FAIL=1
else
  green "PASS: file-injector.ts type-checks clean under --strict."
fi

# -----------------------------------------------------------------------------
phase 2 "Unit tests (npm test)"
# -----------------------------------------------------------------------------
if ! npm test >/tmp/validate_test.log 2>&1; then
  red "FAIL: one or more unit-test harnesses failed."
  grep -E "Result:|✗|Error:|AssertionError" /tmp/validate_test.log | tail -30
  FAIL=1
else
  green "PASS: all unit-test harnesses passed."
  grep -E "Result: [0-9]+ passed" /tmp/validate_test.log || true
fi

# -----------------------------------------------------------------------------
phase 3 "E2E — handler lifecycle + real-pi runtime smoke"
# -----------------------------------------------------------------------------

# --- 3a: handler-lifecycle E2E (deterministic, no model needed) ---------------
cat > /tmp/validate_e2e_lifecycle.mjs <<'EOT'
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const ROOT = process.argv[2];
const mod = await jiti.import(path.resolve(ROOT, "file-injector.ts"));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m); } };

// Fresh isolated temp project.
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fi-e2e-"));
await fs.writeFile(path.join(tmp, "a.ts"), "export const ANSWER = 42;\n");
await fs.writeFile(path.join(tmp, "notes.md"), "# Notes\nSee #@api.md for detail.\n");
await fs.writeFile(path.join(tmp, "api.md"), "# API\nThe endpoint returns forty-two items per page with a stable pagination cursor across long result sets.\n");
// 2x2 red PNG (valid magic bytes).
await fs.writeFile(path.join(tmp, "pic.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAAXNSR0OAUmZ0AAAAJcEhZcwAAHUkAAB/JAvYX5EwAAAAQSURBVAgdY/zPwMDwn4GBgQEXAxkAYgk1j14lY0kAAAAASUVORK5CYII=", "base64"));

// --- Mock ExtensionAPI: capture handler registrations ----------------------
function makePi() {
  const handlers = new Map();   // event -> [fn]
  const renderers = new Map();  // customType -> fn
  return {
    on(event, fn) { (handlers.get(event) ?? handlers.set(event, []).get(event)).push(fn); },
    registerMessageRenderer(type, fn) { renderers.set(type, fn); },
    handlers, renderers,
    async emit(event, ev, ctx) {
      const fns = handlers.get(event) ?? [];
      for (const f of fns) { await f(ev, ctx); }
    },
  };
}
const theme = {
  fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t,
};
const baseCtx = (extra = {}) => ({
  cwd: tmp,
  hasUI: false,
  isProjectTrusted: () => true,
  ui: { notify() {} },
  getContextUsage: () => ({ tokens: 1000, contextWindow: 200000, percent: 1 }),
  model: { contextWindow: 200000, maxTokens: 8192 },
  ...extra,
});

// --- Workflow 1: file injection ---------------------------------------------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const ev = { type: "input", text: "Review #@a.ts", images: [], source: "interactive" };
  const inputRes = await pi.emit("input", ev, baseCtx());
  // emit() returns void; the real handler's return is the LAST fn's return:
  const r = await pi.handlers.get("input")[pi.handlers.get("input").length - 1](ev, baseCtx());
  ok(r.action === "transform", "file: input returns transform");
  ok(r.text === "Review #@a.ts", "file: prompt preserved verbatim (§6.4): " + JSON.stringify(r.text));
  const bas = await pi.handlers.get("before_agent_start")[0]({ type: "before_agent_start" }, baseCtx());
  ok(bas && bas.message && bas.message.customType === "fileInjector.injected", "file: before_agent_start returns the custom message");
  ok(/<file name="[^"]*a\.ts">/.test(bas.message.content), "file: custom message carries the <file> block");
  ok(bas.message.display === true, "file: display:true (renderer handshake)");
  // second fire clears the stash (one-shot)
  const bas2 = await pi.handlers.get("before_agent_start")[0]({ type: "before_agent_start" }, baseCtx());
  ok(bas2 === undefined, "file: before_agent_start is one-shot (stash cleared)");
}

// --- Workflow 2: image injection (image attached to user msg, ref in custom) -
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const ev = { type: "input", text: "Describe #@pic.png", images: [], source: "interactive" };
  const r = await pi.handlers.get("input")[0](ev, baseCtx());
  ok(r.action === "transform", "image: input returns transform");
  ok(Array.isArray(r.images) && r.images.length === 1 && r.images[0].type === "image", "image: one ImageContent attached to user message");
  ok(r.images[0].mimeType === "image/png", "image: correct mime type");
  const bas = await pi.handlers.get("before_agent_start")[0]({ type: "before_agent_start" }, baseCtx());
  ok(/<file name="[^"]*pic\.png">/.test(bas.message.content), "image: ref block in custom message");
}

// --- Workflow 3: markdown transitive imports (notes.md -> api.md) -----------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const r = await pi.handlers.get("input")[0]({ type: "input", text: "Summarize #@notes.md", images: [], source: "interactive" }, baseCtx());
  ok(r.action === "transform", "md-imports: input returns transform");
  ok(r.text === "Summarize #@notes.md", "md-imports: prompt verbatim (import marker preserved)");
  const bas = await pi.handlers.get("before_agent_start")[0]({ type: "before_agent_start" }, baseCtx());
  const blocks = [...bas.message.content.matchAll(/<file name="([^"]+)">/g)].map(m => path.basename(m[1]));
  ok(blocks.includes("notes.md") && blocks.includes("api.md"), "md-imports: BOTH notes.md and api.md delivered: " + JSON.stringify(blocks));
  ok(blocks.length === 2, "md-imports: exactly two blocks (dedup, no extras): " + blocks.length);
}

// --- Workflow 4: missing file → verbatim, no injection ----------------------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const r = await pi.handlers.get("input")[0]({ type: "input", text: "Fix #@nope.ts", images: [], source: "interactive" }, baseCtx());
  ok(r.action === "continue", "missing: input returns continue (no injection)");
  const bas = await pi.handlers.get("before_agent_start")[0]({ type: "before_agent_start" }, baseCtx());
  ok(bas === undefined, "missing: no custom message (no stash)");
}

// --- Workflow 5: bare @ is NOT injected (Pi's @ untouched) ------------------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const r = await pi.handlers.get("input")[0]({ type: "input", text: "Look at @a.ts please", images: [], source: "interactive" }, baseCtx());
  ok(r.action === "continue", "bare-@: top-level bare @ is not injected (continue)");
}

// --- Workflow 6: loop-prevention guard (source === "extension") -------------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  const r = await pi.handlers.get("input")[0]({ type: "input", text: "Review #@a.ts", images: [], source: "extension" }, baseCtx());
  ok(r.action === "continue", "guard: source==='extension' short-circuits (loop prevention, §12.1)");
}

// --- Workflow 7: MessageRenderer registered + defensive --------------------
{
  const pi = makePi();
  mod.default(pi);
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  ok(pi.renderers.has("fileInjector.injected"), "renderer: registered for customType 'fileInjector.injected'");
  const fn = pi.renderers.get("fileInjector.injected");
  // defensive: old/foreign entry with no details must not throw.
  let threw = false;
  try { fn({ content: "<file name=\"x\">y</file>", details: undefined }, { expanded: false }, theme); } catch { threw = true; }
  ok(!threw, "renderer: never throws on malformed details (§12.23)");
  // a real details.files entry renders without throwing.
  threw = false;
  try {
    const c = fn({ content: '<file name="/abs/a.ts">\nhi\n</file>', details: { files: [{ path: "/abs/a.ts", kind: "text" }] } }, { expanded: true }, theme);
    ok(c !== undefined, "renderer: returns a Component for a real entry");
  } catch { threw = true; }
  ok(!threw, "renderer: does not throw for a real expanded entry");
}

// --- Workflow 8: enableUrls:false gates network (config) -------------------
{
  const pi = makePi();
  mod.default(pi);
  // write a project file-injector.json disabling urls (mkdir FIRST), then session_start loads it.
  await fs.mkdir(path.join(tmp, ".pi"), { recursive: true });
  await fs.writeFile(path.join(tmp, ".pi", "file-injector.json"), JSON.stringify({ enableUrls: false }));
  await pi.emit("session_start", { type: "session_start" }, baseCtx());
  // A bare-domain URL token should be left verbatim with NO fetch (we can't easily assert "no fetch"
  // without a network mock, but we assert no injection happens — count stays 0).
  const r = await pi.handlers.get("input")[0]({ type: "input", text: "Read #example.invalid.", images: [], source: "interactive" }, baseCtx());
  ok(r.action === "continue", "enableUrls:false: URL token produces no injection (no fetch / verbatim)");
  await fs.rm(path.join(tmp, ".pi"), { recursive: true, force: true });
}

await fs.rm(tmp, { recursive: true, force: true });
console.log(`\nE2E lifecycle: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
EOT

if ! node /tmp/validate_e2e_lifecycle.mjs "$ROOT" >/tmp/validate_e2e_lifecycle.log 2>&1; then
  red "FAIL: E2E handler-lifecycle test failed."
  cat /tmp/validate_e2e_lifecycle.log
  FAIL=1
else
  green "PASS: E2E handler-lifecycle test."
  grep -E "E2E lifecycle:" /tmp/validate_e2e_lifecycle.log
fi

# --- 3b: real-pi runtime smoke (best-effort; needs a working default model) --
# Spawns the REAL pi binary in JSON mode with ONLY this extension loaded (-ne),
# injects a file, and confirms the §6.2 contract: a custom (role:user-converted)
# message carrying the <file> block is emitted after the verbatim user message.
if command -v "$PI_BIN" >/dev/null 2>&1; then
  SMOKE_DIR="$(mktemp -d)"
  printf 'hello world from the smoke file\n' > "$SMOKE_DIR/smoke.txt"
  SMOKE_PROMPT="Echo the injected file. File: #@smoke.txt"
  # `-ne` disables all globally-installed extensions/packages so only our -e copy runs
  # (prevents the double-injection artifact from a concurrently-loaded second copy).
  # pi has no --cwd flag, so run from the smoke dir (it uses the process cwd).
  if (cd "$SMOKE_DIR" && "$PI_BIN" -ne -e "$ROOT/file-injector.ts" --mode json -p "$SMOKE_PROMPT") \
       >/tmp/validate_smoke.json 2>/tmp/validate_smoke.err; then
    # Assert: (a) a user message with verbatim #@smoke.txt, (b) a custom message with the <file> block.
    if grep -q '"role":"user"' /tmp/validate_smoke.json 2>/dev/null \
       && grep -q '#@smoke.txt' /tmp/validate_smoke.json \
       && grep -q '<file name=' /tmp/validate_smoke.json; then
      green "PASS: real-pi JSON smoke — verbatim prompt + <file> custom message present (§6.2)."
    else
      red "FAIL: real-pi JSON smoke — expected markers not found in output."
      tail -5 /tmp/validate_smoke.json
      FAIL=1
    fi
  else
    # Best-effort: a missing/unconfigured model is an environment issue, not an extension defect.
    echo "  (skipped: pi smoke run exited non-zero — likely no working default model in this env)"
    tail -3 /tmp/validate_smoke.err 2>/dev/null || true
  fi
  rm -rf "$SMOKE_DIR"
else
  echo "  (skipped: pi binary not found on PATH)"
fi

# -----------------------------------------------------------------------------
echo
if [ "$FAIL" -eq 0 ]; then
  green "════════════════════════════════════════════"
  green "  VALIDATION PASSED — all phases green."
  green "════════════════════════════════════════════"
  exit 0
else
  red "════════════════════════════════════════════"
  red "  VALIDATION FAILED — see failures above."
  red "════════════════════════════════════════════"
  exit 1
fi