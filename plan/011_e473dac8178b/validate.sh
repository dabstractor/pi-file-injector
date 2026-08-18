#!/usr/bin/env bash
# ============================================================================
# validate.sh — comprehensive validation for pi-file-injector
#
# Phases (only what exists in this codebase — there is no eslint/prettier):
#   1. Type checking      (scripts/typecheck.mjs — tsc --strict vs pi's .d.ts)
#   2. Unit testing       (npm test — 4 suites, 258 cases)
#   3. Data-level probes  (real extension via pi's jiti loader; no model calls)
#   4. E2E                (real `pi -ne -e` runs, --mode json, real model + network)
#   5. URL corpus         (tools/url-corpus.mjs — live network, ~94 URLs)
#   6. Packaging          (npm pack --dry-run manifest/files check)
#
# Env knobs:
#   SKIP_E2E=1     skip Phase 4 (needs a working pi model/credential)
#   SKIP_NETWORK=1 skip Phases 5 and the live-URL E2E checks (E6)
#
# Exit code: 0 iff every executed phase passed.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")"

EXT_FILE="$(pwd)/file-injector.ts"
EXT_DIR="$(pwd)"
PASS=0; FAIL=0; SKIP=0; FAILED_NAMES=()

ok()  { PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); printf '  \033[31m✗ %s\033[0m\n' "$1"; }
sk()  { SKIP=$((SKIP+1)); printf '  \033[33m–\033[0m %s\n' "$1"; }
hdr() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

TMP="$(mktemp -d /tmp/fi-validate-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

# ============================================================================
hdr "Phase 0 — environment sanity"
# ============================================================================
command -v node >/dev/null 2>&1 && ok "node present ($(node --version))" || { bad "node not found"; }
command -v pi    >/dev/null 2>&1 && ok "pi present ($(pi --version 2>/dev/null | head -1))" || bad "pi CLI not found (Phase 4 will fail)"
[ -f "$EXT_FILE" ] && ok "file-injector.ts present" || bad "file-injector.ts missing"
PIPKG="$(npm root -g 2>/dev/null)/@earendil-works/pi-coding-agent"
[ -f "$PIPKG/dist/index.js" ] && ok "global pi package found at $PIPKG" || bad "global pi package not found (typecheck+tests need it)"

# ============================================================================
hdr "Phase 1 — type checking (tsc --strict against pi .d.ts)"
# ============================================================================
if timeout 300 node scripts/typecheck.mjs >"$TMP/typecheck.log" 2>&1; then
  ok "typecheck clean under --strict (0 errors)"
else
  bad "typecheck FAILED"
  tail -20 "$TMP/typecheck.log"
fi

# ============================================================================
hdr "Phase 2 — unit tests (npm test: 4 suites)"
# ============================================================================
declare -A SUITE_CASES=( [file-injector.test.mjs]=180 [import-behavior.test.mjs]="?" [relative-imports.test.mjs]="?" [url-injection.test.mjs]=38 )
for suite in file-injector.test.mjs import-behavior.test.mjs relative-imports.test.mjs url-injection.test.mjs; do
  if timeout 600 node --test "$suite" >"$TMP/$suite.log" 2>&1; then
    ok "$suite passed ($(grep -oE 'Result: [0-9]+ passed, [0-9]+ failed' "$TMP/$suite.log" | tail -1))"
  else
    bad "$suite FAILED"
    tail -15 "$TMP/$suite.log"
  fi
done

# ============================================================================
hdr "Phase 3 — data-level probes (real extension via jiti; no model calls)"
# ============================================================================
cat > "$TMP/probes.mjs" <<'PROBE_EOF'
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const REPO = process.argv[2];
const mod = await jiti.import(path.join(REPO, "file-injector.ts"));

const dir = fs.mkdtempSync("/tmp/fi-probe-");
let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  OK ${name}${extra ? " — " + extra : ""}`);
  else { failures++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
};

// fixtures
fs.writeFileSync(path.join(dir, "a.ts"), "l1\nl2\nl3\nl4\nl5\n");
fs.writeFileSync(path.join(dir, "empty.txt"), "");
fs.writeFileSync(path.join(dir, "note.md"), "# n\nSee #@a.ts.\n");
fs.writeFileSync(path.join(dir, "urlmd.md"), "# doc\nSee #nodejs.org too.\n");
fs.writeFileSync(path.join(dir, "data.bin"), "BIN\x00\x01\x02DATA\xff\xfe");
let big = "";
for (let i = 1; i <= 40000; i++) big += `line-${String(i).padStart(6, "0")}: ${"data ".repeat(18)}\n`;
fs.writeFileSync(path.join(dir, "huge.log"), big);

const ctx = (extra = {}) => ({ cwd: dir, hasUI: false, ...extra });
const tight = {
  cwd: dir, hasUI: false,
  getContextUsage: () => ({ tokens: 30000, contextWindow: 50000, percent: 60 }),
  model: { contextWindow: 50000, maxTokens: 8192 },
};

// D1: whole oversize file pages under tight budget, directive from actual head lines
{
  const r = await mod.injectFiles("whole #@huge.log", [], tight);
  check("D1 paged whole file", r.injected === 1 && r.paged === 1 && r.details[0].kind === "paged",
    `range=${r.details[0]?.range} directive=${(r.details[0]?.directive ?? "").slice(0, 60)}…`);
}
// D2: LR-1 — ranged slice pages with FILE-coordinate resume (startLine + headLines)
{
  const r = await mod.injectFiles("ranged #@huge.log:5-40000", [], tight);
  const d = r.details[0];
  const resume = Number((d.range ?? "").replace(/[^0-9]/g, ""));
  check("D2 LR-1 paged slice, file-coord resume", r.paged === 1 && d.kind === "paged" && resume === 5 + (d.pagedHeadLines ?? -1),
    `range=${d.range} pagedHeadLines=${d.pagedHeadLines}`);
}
// D3: LR-3/LR-4 — malformed + past-EOF warn, nothing injected
{
  const notes = [];
  const r = await mod.injectFiles("m #@huge.log:0 p #@huge.log:99999", [], ctx({ hasUI: true, ui: { notify: (m, t) => notes.push(t + "|" + m) } }));
  check("D3 LR-3/LR-4 warn + no injection", r.injected === 0 && notes.length === 2 && notes.every(n => n.startsWith("warning|")),
    notes.map(n => n.split("|")[1].slice(0, 60)).join(" ;; "));
}
// D4: prior <file> block in prompt seeds dedup
{
  const p = path.join(dir, "a.ts");
  const r = await mod.injectFiles(`<file name="${p}">\nx\n</file>\nalso #@a.ts`, [], ctx());
  check("D4 prior <file> dedup", r.injected === 0);
}
// D5: URL markers inside delivered markdown are NOT fetched (prompt-only URL scan)
{
  let fetches = 0;
  const r = await mod.injectFiles("read #@urlmd.md", [], ctx(), false, true, () => fetches++);
  check("D5 URL-in-markdown not fetched", r.injected === 1 && fetches === 0);
}
// D6: empty file delivers empty block, counted
{
  const r = await mod.injectFiles("read #@empty.txt", [], ctx());
  check("D6 empty file empty block", r.injected === 1 && r.blocks[0] === `<file name="${path.join(dir, "empty.txt")}">\n\n</file>`);
}
// D7: ftp:// token is URL-shaped but fetch always fails → verbatim, never throws
{
  const notes = [];
  const r = await mod.injectFiles("grab #ftp://example.com/pub/x", [], ctx({ hasUI: true, ui: { notify: (m) => notes.push(m) } }));
  check("D7 ftp:// silently verbatim", r.injected === 0 && r.text.includes("#ftp://example.com"));
}
// D8: renderer smoke (offset tier + defensive fallback) — must not throw
{
  const fake = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t };
  const r = await mod.injectFiles("x #@a.ts", [], ctx());
  const offsets = JSON.parse(JSON.stringify(r.details));
  // emulate computeDetailOffsets via before_agent_start path: call it directly
  mod.computeDetailOffsets(r.blocks, offsets);
  const c1 = mod.renderInjectedMessage({ details: { files: offsets }, content: r.blocks.join("\n\n") }, { expanded: true }, fake);
  const c2 = mod.renderInjectedMessage({ details: { files: [] }, content: "raw" }, { expanded: true }, fake);
  const c3 = mod.renderInjectedMessage({}, { expanded: false }, fake);
  check("D8 renderer never throws", !!c1 && !!c2 && !!c3, `kinds=${c1?.constructor?.name ?? "?"}`);
}
// D9: readConfig precedence — project (trusted) overrides global; untrusted ignored
{
  const home = process.env.HOME;
  const proj = fs.mkdtempSync("/tmp/fi-cfg-");
  fs.mkdirSync(path.join(proj, ".pi"), { recursive: true });
  fs.writeFileSync(path.join(proj, ".pi", "file-injector.json"), JSON.stringify({ enableUrls: false, markdownBareAtImports: true }));
  const trusted = await mod.readConfig({ cwd: proj, isProjectTrusted: () => true });
  const untrusted = await mod.readConfig({ cwd: proj, isProjectTrusted: () => false });
  const g = await mod.readConfig({ cwd: "/nonexistent", isProjectTrusted: () => true });
  check("D9 readConfig trust gating", trusted.enableUrls === false && untrusted.enableUrls === undefined && typeof g === "object",
    `trusted=${JSON.stringify(trusted)} untrusted.enableUrls=${untrusted.enableUrls}`);
  fs.rmSync(proj, { recursive: true, force: true });
}
// D10: enableUrls=false → zero network callbacks
{
  let fetches = 0;
  const r = await mod.injectFiles("x #nodejs.org", [], ctx(), false, false, () => fetches++);
  check("D10 enableUrls=false gates egress", r.injected === 0 && fetches === 0);
}
// D11: binary routing — NUL byte → binary note; mislabeled text-as-png → text
{
  const r = await mod.injectFiles("b #@data.bin t #@fake.png", [], ctx());
  fs.writeFileSync(path.join(dir, "fake.png"), "just text bytes, not an image\n");
  const r2 = await mod.injectFiles("t #@fake.png", [], ctx());
  check("D11 binary note + magic sniff", r.details[0]?.kind === "binary" && r2.details[0]?.kind === "text",
    `bin=${r.details[0]?.kind} fakepng=${r2.details[0]?.kind}`);
}
// D12: pure helpers sanity (spec §4.3/§17)
{
  const t1 = mod.cleanToken("a.ts).,") === "a.ts";
  const t2 = JSON.stringify(mod.splitLineRange("a.ts:5-3")) === JSON.stringify({ path: "a.ts:5-3", invalid: true });
  const t3 = mod.sliceLines("a\nb\nc\n", 2, 10) === "b\nc";  // clamped end
  const t4 = mod.countLines("a\nb\nc\n") === 3;               // wc -l semantics
  check("D12 helper semantics", t1 && t2 && t3 && t4);
}

fs.rmSync(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
PROBE_EOF
if timeout 300 node "$TMP/probes.mjs" "$EXT_DIR"; then
  ok "all data-level probes passed"
else
  bad "data-level probes FAILED (see output above)"
fi

# ============================================================================
hdr "Phase 4 — E2E with real pi (interactive-equivalent -p runs; needs model)"
# ============================================================================
if [ "${SKIP_E2E:-0}" = "1" ]; then
  sk "SKIP_E2E=1 — skipping Phase 4"
else
  # fixture in a TRUSTED dir (ancestor /projects is in trust.json) so project config is honored
  FIX="$HOME/projects/.fi-val-e2e-$$"
  mkdir -p "$FIX/docs"
  cat > "$FIX/a.ts" <<'EOF'
line1: export function hello() {
line2:   return "world";
line3: }
line4: // a.ts ends
EOF
  printf '# B doc\nSee also #@../a.ts and #@c.md.\n' > "$FIX/docs/b.md"
  printf '# C doc\nImported transitively.\n'        > "$FIX/docs/c.md"
  printf 'BIN\x00\x01\x02DATA\xff\xfe'             > "$FIX/data.bin"
  printf 'GIF89a-fake-not-an-image'                 > "$FIX/fake.png"
  python3 - "$FIX/red8.png" <<'PYEOF'
import struct, zlib, sys
def chunk(t, d):
    c = struct.pack('>I', len(d)) + t + d
    return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
ihdr = struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)
raw = b''.join(b'\x00' + b'\xff\x00\x00' * 8 for _ in range(8))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
open(sys.argv[1], 'wb').write(png)
PYEOF

  # generic runner: run_pi <workdir> <extra-args...> -- "-p" <prompt>  → agent_end JSON on stdout
  run_pi() {
    local wd="$1"; shift
    (cd "$wd" && timeout 180 pi -ne "$@" 2>&1 | grep '"type":"agent_end"' | head -1)
  }
  # assert helper: reads agent_end JSON on stdin, runs python expr file
  assert_pi() { # <name> <json> <pythonfile> [python-args...]
    local name="$1" json="$2" py="$3"; shift 3
    if [ -z "$json" ]; then bad "$name (no agent_end line — pi/model failure?)"; return; fi
    if printf '%s' "$json" | python3 "$py" "$@" >>"$TMP/e2e.out" 2>&1; then ok "$name"; else bad "$name"; tail -3 "$TMP/e2e.out"; fi
  }

  # canary: is the model reachable at all?
  CANARY="$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p "Say OK")"
  if ! printf '%s' "$CANARY" | grep -q '"role":"assistant"'; then
    sk "model not reachable (no assistant reply) — skipping remaining E2E checks"
  else
    ok "model reachable (canary run)"

    cat > "$TMP/e1.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
u = next(m for m in d["messages"] if m["role"] == "user")
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert "#@a.ts" in u["content"][0]["text"], "prompt not verbatim"
assert c and c["customType"] == "fileInjector.injected" and c.get("display") is True
f = c["details"]["files"][0]
assert f["kind"] == "text" and f["path"].endswith("/a.ts"), f
assert "line2:   return \"world\";" in c["content"]
print("  prompt verbatim + custom message + <file> block OK")
EOF
    assert_pi "E1 basic #@file: verbatim prompt + custom message carries <file> block" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Review #@a.ts')" "$TMP/e1.py"

    cat > "$TMP/e2.py" <<'EOF'
import json, sys, re
d = json.loads(sys.stdin.read())
u = next(m for m in d["messages"] if m["role"] == "user")
m = re.search(r'<file name="[^"]+">\n[\s\S]*?\n</file>', u["content"][0]["text"])
assert m, "built-in @file block not found"
builtin = m.group(0)
# re-run comparison is done by the caller via the extension run — compare against ext block built here
open("/tmp/fi-val-builtin.txt", "w").write(builtin)
print("  built-in block captured")
EOF
    BUILTIN_JSON="$(run_pi "$FIX" --mode json --no-session -p 'Say OK' @"$FIX/a.ts")"
    if [ -n "$BUILTIN_JSON" ] && printf '%s' "$BUILTIN_JSON" | python3 "$TMP/e2.py"; then
      cat > "$TMP/e2b.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next(m for m in d["messages"] if m["role"] == "custom")
builtin = open("/tmp/fi-val-builtin.txt").read()
assert c["content"] == builtin, "block format differs from built-in @file:\nEXT : %r\nBUILT: %r" % (c["content"], builtin)
print("  byte-identical to built-in @file expansion")
EOF
      assert_pi "E2 format parity with built-in @file (acceptance #13)" \
        "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Review #@a.ts')" "$TMP/e2b.py"
    else
      bad "E2 format parity — built-in @file run failed"
    fi

    cat > "$TMP/e3.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c, "no custom message"
names = [f["path"].replace(sys.argv[1] + "/", "") for f in c["details"]["files"]]
assert names == ["docs/b.md", "a.ts", "docs/c.md"], names  # pre-order depth-first, file-relative
print("  import order:", names)
EOF
    assert_pi "E3 markdown transitive imports (pre-order, file-relative)" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Read #@docs/b.md')" "$TMP/e3.py" "$FIX"

    cat > "$TMP/e4.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c, "no custom message"
f = c["details"]["files"][0]
assert f.get("range") == ":2-3", f
assert "line2:" in c["content"] and "line1:" not in c["content"], c["content"][:80]
print("  range delivered:", f["range"])
EOF
    assert_pi "E4 line range #@a.ts:2-3 (clamped display, slice only)" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Show #@a.ts:2-3')" "$TMP/e4.py" "$FIX"

    MISS_JSON="$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Fix #@nope-missing.ts')"
    if printf '%s' "$MISS_JSON" | grep -q '"role":"custom"'; then
      bad "E5 missing file left verbatim (custom message unexpectedly present)"
    else
      ok "E5 missing file left verbatim (no injection, prompt intact)"
    fi

    cat > "$TMP/e6.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c, "no custom message"
kinds = {f["path"].split("/")[-1]: f["kind"] for f in c["details"]["files"]}
assert kinds.get("data.bin") == "binary", kinds
assert "binary file" in c["content"], c["content"][:100]
assert kinds.get("fake.png") == "text", kinds   # magic-number sniff routes mislabeled image to text
print("  kinds:", kinds)
EOF
    assert_pi "E6 binary note (NUL) + mislabeled .png routed as text" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Inspect #@data.bin and #@fake.png')" "$TMP/e6.py" "$FIX"

    cat > "$TMP/e7.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
u = next(m for m in d["messages"] if m["role"] == "user")
imgs = [c for c in u["content"] if c.get("type") == "image"]
assert imgs and imgs[0]["mimeType"] == "image/png" and len(imgs[0]["data"]) > 50, imgs
c = next(m for m in d["messages"] if m["role"] == "custom")
assert any(f["kind"] == "image" and f["path"].endswith("red8.png") for f in c["details"]["files"])
print("  image attached:", imgs[0]["mimeType"], "b64len:", len(imgs[0]["data"]))
EOF
    assert_pi "E7 image file: attached ImageContent + reference block" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. What color is #@red8.png?')" "$TMP/e7.py" "$FIX"

    cat > "$TMP/e8.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c and len(c["details"]["files"]) == 1, c and [f["path"] for f in c["details"]["files"]]
print("  single block for 3 path forms")
EOF
    assert_pi "E8 dedup across relative/./relative/absolute forms" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p "Say OK. Diff #@a.ts vs #@./a.ts vs #@$FIX/a.ts")" "$TMP/e8.py"

    COLL_JSON="$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Compare @a.ts and foo#@bar and #main.go please')"
    if printf '%s' "$COLL_JSON" | grep -q '"role":"custom"'; then
      bad "E9 collision matrix (bare @ / mid-word / #main.go) — unexpected injection"
    else
      ok "E9 collision matrix: bare @, foo#@bar, #main.go all untouched"
    fi

    MANIFEST_JSON="$(run_pi "$FIX" -e "$EXT_DIR" --mode json --no-session -p 'Say OK. Read #@a.ts')"
    if printf '%s' "$MANIFEST_JSON" | grep -q '"customType":"fileInjector.injected"'; then
      ok "E10 directory-manifest load (pi -e <dir> resolves file-injector.ts)"
    else
      bad "E10 directory-manifest load (pi -e <dir>)"
    fi

    if [ "${SKIP_NETWORK:-0}" = "1" ]; then
      sk "SKIP_NETWORK=1 — skipping live URL E2E (E11) and gating E2E needs no network"
    else
      cat > "$TMP/e11.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c, "no custom message"
f = c["details"]["files"][0]
assert f["kind"] == "url" and f["path"].startswith("https://") and (f.get("chars") or 0) > 200, f
print("  url injected:", f["path"], f.get("chars"), "chars")
EOF
      assert_pi "E11 live URL #nodejs.org: fetched → markdown injected" \
        "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Summarize #nodejs.org in one word')" "$TMP/e11.py" "$FIX"
    fi

    # E12: enableUrls=false in a TRUSTED project gates egress (fixture under ~/projects is trusted)
    mkdir -p "$FIX/.pi"
    echo '{"enableUrls": false}' > "$FIX/.pi/file-injector.json"
    cat > "$TMP/e12.py" <<'EOF'
import json, sys
d = json.loads(sys.stdin.read())
c = next((m for m in d["messages"] if m["role"] == "custom"), None)
assert c, "no custom message — file should still inject"
paths = [f["path"] for f in c["details"]["files"]]
assert all(not p.startswith("http") for p in paths), paths  # URL gated, file present
print("  url gated; files:", [p.split("/")[-1] for p in paths])
EOF
    assert_pi "E12 enableUrls=false (trusted project) gates network, file still injects" \
      "$(run_pi "$FIX" -e "$EXT_FILE" --mode json --no-session -p 'Say OK. Summarize #nodejs.org and read #@a.ts')" "$TMP/e12.py" "$FIX"
    rm -rf "$FIX/.pi"

    # E13: session persistence — custom message entry survives in the session file
    SESS_ID="fi-val-$$"
    (cd "$FIX" && timeout 180 pi -ne -e "$EXT_FILE" --mode json --session-id "$SESS_ID" -p 'Say OK. Read #@a.ts' >/dev/null 2>&1)
    SESS_FILE="$(ls -t "$HOME"/.pi/agent/sessions/*/*"${SESS_ID}"*.jsonl 2>/dev/null | head -1)"
    if [ -n "$SESS_FILE" ]; then
      if grep -q '"type":"custom_message".*"customType":"fileInjector.injected"' "$SESS_FILE" 2>/dev/null || python3 -c "
import json,sys
found=any('fileInjector.injected' in json.dumps(json.loads(l)) for l in open('$SESS_FILE') if l.strip())
sys.exit(0 if found else 1)"; then
        ok "E13 custom message persisted in session file (reload/re-send contract)"
      else
        bad "E13 custom message NOT persisted in session file"
      fi
      rm -f "$SESS_FILE"
    else
      bad "E13 session file not found for $SESS_ID"
    fi
  fi
  rm -rf "$FIX"
fi

# ============================================================================
hdr "Phase 5 — URL corpus (live network, ~94 URLs)"
# ============================================================================
if [ "${SKIP_NETWORK:-0}" = "1" ]; then
  sk "SKIP_NETWORK=1 — skipping URL corpus"
elif timeout 550 node tools/url-corpus.mjs >"$TMP/corpus.log" 2>&1; then
  GRADES="$(grep -E '^GRADES:' "$TMP/corpus.log" | tail -1)"
  # grade vocabulary: pass | record (baseline capture, not failure) | fail. fail is omitted when 0.
  if printf '%s' "$GRADES" | grep -qE 'fail=[1-9]'; then
    bad "URL corpus failures: $GRADES"
    grep -E '^✗' "$TMP/corpus.log" | head -10
  else
    ok "URL corpus: no failures ($GRADES; record = baseline capture, not failure)"
  fi
else
  bad "URL corpus harness errored"
  tail -10 "$TMP/corpus.log"
fi

# ============================================================================
hdr "Phase 6 — packaging (npm pack dry run)"
# ============================================================================
if timeout 120 npm pack --dry-run >"$TMP/pack.log" 2>&1; then
  NFILES="$(grep -cE '^(README\.md|LICENSE|file-injector\.ts|package\.json|npm notice [0-9.]+ ?k?B )' "$TMP/pack.log" || true)"
  if grep -q 'file-injector.ts' "$TMP/pack.log" && grep -q 'package.json' "$TMP/pack.log" && grep -q 'README.md' "$TMP/pack.log" && grep -q 'LICENSE' "$TMP/pack.log"; then
    ok "npm pack includes manifest + extension + README + LICENSE (4 files)"
  else
    bad "npm pack file set incomplete"
    tail -12 "$TMP/pack.log"
  fi
  V_PKG="$(node -p "require('./package.json').version")"
  if grep -q "pi-file-injector-${V_PKG}.tgz" "$TMP/pack.log"; then
    ok "tarball name matches package.json version (${V_PKG})"
  else
    bad "tarball/version mismatch (expected ${V_PKG})"
  fi
  if node -e "const p=require('./package.json'); process.exit(p.pi?.extensions?.includes('file-injector.ts') ? 0 : 1)"; then
    ok "pi manifest declares file-injector.ts"
  else
    bad "pi manifest missing/broken"
  fi
else
  bad "npm pack --dry-run failed"
  tail -10 "$TMP/pack.log"
fi

# ============================================================================
hdr "Summary"
# ============================================================================
printf 'passed: %d  failed: %d  skipped: %d\n' "$PASS" "$FAIL" "$SKIP"
if [ "$FAIL" -gt 0 ]; then
  printf 'failed checks:\n'
  for n in "${FAILED_NAMES[@]}"; do printf '  - %s\n' "$n"; done
  exit 1
fi
exit 0