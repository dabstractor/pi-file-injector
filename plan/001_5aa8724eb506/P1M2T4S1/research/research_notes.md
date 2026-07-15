# Research Notes — P1.M2.T4.S1: Manual Test Matrix (all 14 acceptance cases)

> Researcher goal: pre-verify the EXACT mechanism for a **reusable, model-free, non-interactive
> acceptance test harness** that imports the REAL committed `sharp-at-file.ts` and asserts all 14
> PRD §11 cases + edge cases + guards. The prior M1 subtasks ran reference-copy gates from `/tmp`;
> THIS task must test the actual shipped artifact.

## 1. State of the world (verified by reading the repo)

- `sharp-at-file.ts` is **COMPLETE** (P1.M1 done; git log: "Implement input event handler"). It exports
  8 named symbols + the default factory:
  `cleanToken`, `expandTildeAndResolve`, `extOf`, `isBinary`, `formatTextFileBlock`,
  `formatImageBlock`, `formatBinaryBlock`, `injectFiles`, and `default` (the `(pi)=>void` factory).
  Confirmed by `jiti.import(...)` returning exactly those keys (probe4.mjs).
- **NO test framework exists.** No `package.json`, no `tsconfig`, no `*.test.ts`, no `vitest`/`node:test`
  config. `.gitignore` ignores `node_modules/`, `dist/`, `.pi-subagents/` — NOT `.mjs` or `.ts`.
- The established M1 pattern was: standalone `.mjs` scripts run from `/tmp` that **inlined a reference
  copy** of the target function (e.g. P1M1T3S1 research: "a reference copy of the EXACT target
  injectFiles with T2.S1 helpers inlined"). That does NOT exercise the shipped file. For ACCEPTANCE,
  we must import the real `sharp-at-file.ts` → this harness is novel vs. the M1 gates.

## 2. THE verified import mechanism (load-bearing — the whole harness depends on it)

The pi package is installed GLOBALLY and is **NOT resolvable from the project cwd**
(`require.resolve('@earendil-works/pi-coding-agent')` → MODULE_NOT_FOUND from cwd; confirmed).
Pi's own extension loader solves this by passing `alias` to jiti (`dist/core/extensions/loader.js:59`
`getAliases()`). The harness must replicate this.

### 2.1 Resolve the global pi package root — VERIFIED robust
`npm root -g` → `/home/dustin/.local/lib/node_modules`. Package root =
`<npmRoot>/@earendil-works/pi-coding-agent`. Confirmed `dist/index.js`, `node_modules/jiti/lib/jiti.mjs`,
and `node_modules/@earendil-works/pi-ai/dist/compat.js` all exist there (probe_img2.mjs).
Alternative derivations (for resilience if `npm root -g` is missing): `fs.realpathSync(<which pi>)`
→ `…/pi-coding-agent/dist/cli.js`; walk up 2 to get the package root. The `pi` bin is at
`/home/dustin/.local/bin/pi`. Prefer `npm root -g`; it is the simplest verified path.

### 2.2 createJiti + alias — VERIFIED working (the exact config)
```js
import { execSync } from "node:child_process";
const PIPKG = execSync("npm root -g").toString().trim()
            + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const alias = {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",                 // package.json main
  "@earendil-works/pi-ai":           PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js", // compat entry (strict superset)
};
const jiti = createJiti(import.meta.url, { alias });
const mod  = await jiti.import("/abs/path/to/sharp-at-file.ts");
// mod.default = factory; mod.injectFiles / mod.cleanToken / ... all present
```
**VERIFIED** (probe4.mjs): returns `default typeof function` + all 8 named exports; `injectFiles`
runs on real temp files; handler runs via mock pi/ctx. This is THE mechanism the harness uses.
- GOTCHA: bare `import { createJiti } from "jiti"` from `/tmp` FAILS (ERR_MODULE_NOT_FOUND) — jiti is
  nested, not resolvable from arbitrary dirs. MUST use the absolute `await import(PIPKG+"/node_modules/jiti/lib/jiti.mjs")`.
- GOTCHA: do NOT alias `@earendil-works/pi-coding-agent` → `PIPKG+"/index.js"` (no such file; main is
  `dist/index.js`). Do NOT alias pi-ai → `…/pi-ai/dist/index.js` (extensions resolve to `compat.js`,
  a strict superset — see loader.js:81 `piAiCompatEntry`).

## 3. Handler-level testing via mock pi/ctx (VERIFIED — probe4.mjs)

The default export is `factory(pi) => void` that calls `pi.on("input", cb)`. To test the handler
directly (guards, notify, transform/continue) WITHOUT Pi:
```js
const rec = {};
const pi  = { on: (_ev, cb) => { rec.cb = cb; } };          // capture the registered handler
const ctx = {
  cwd: dir,
  hasUI: true,
  ui: { notify: (m, t) => { rec.notify = { m, t }; } },     // record notify calls
};
mod.default(pi);                                            // registers rec.cb
const out = await rec.cb({ type:"input", text:"…", source:"…", streamingBehavior, images:[] }, ctx);
// out.action === "transform" | "continue"; rec.notify === { m:"#@ injected N file(s)", t:"info" } | undefined
```
**VERIFIED**: `source:"interactive"` + `#@a.ts` → `{action:"transform"}` + notify `{m:"#@ injected 1
file(s)", t:"info"}`. `source:"extension"` → `{action:"continue"}`, no notify. (probe4.mjs.)

## 4. processFileArguments exact output — VERIFIED from `dist/cli/file-processor.js` (parity #13)

```js
// file-processor.js:11  export async function processFileArguments(fileArgs, options)
//   :24  missing  → console.error + process.exit(1)            // DIVERGENCE: we leave token verbatim
//   :28  size===0 → continue (SKIP)                           // DIVERGENCE: we inject <file name="…">\n\n</file>
//   :38  image !ok → `<file name="${abs}">${processed.message}</file>\n`
//   :46  images.push({type:"image", mimeType, data})
//   :49  image ok + hints → `<file name="${abs}">${hints.join("\n")}</file>\n`
//   :52  image ok, no hints → `<file name="${abs}"></file>\n`
//   :59  text → `<file name="${abs}">\n${content}\n</file>\n`
//   :64  read error → process.exit(1)                         // DIVERGENCE: we leave token verbatim
```
**Parity conclusion (test #13):** the per-block TEXT format is byte-identical to ours
(`<file name="ABS">\n${content}\n</file>`) — only the trailing per-block `\n` differs, because Pi
concatenates raw (`text += block + "\n"`) while our `injectFiles` joins blocks with `\n\n` under a
`---` separator (PRD §6.2). The IMAGE reference format is also identical
(`<file name="ABS">${hints||""}</file>`). So #13 parity is assertable MODEL-FREE by constructing the
expected block from the SAME file content and asserting our `formatTextFileBlock`/`formatImageBlock`
output equals the `processFileArguments` template above. End-to-end `pi @a.ts "x"` is an OPTIONAL
integration add-on (needs a live `pi` run; no API key for a print/echo check).

## 5. resizeImage empirical behavior for tiny images (VERIFIED — probe_img2.mjs)

For a minimal 1×1 PNG (67 bytes), `resizeImage(bytes, "image/png")` resolves **`null`** deterministically
(can't bring under 4.5 MB maxBytes / can't process tiny input — documented branch). So the image path
deterministically exercises the **fallback**:
- `data === buf.toString("base64")` (raw base64 of ORIGINAL image bytes) — VERIFIED parity: `img.data
  === PNG.toString("base64")` is **true** (probe_img2.mjs).
- `mimeType === "image/png"`.
- block = `<file name="ABS"></file>` (empty hints, since resized===null → formatImageBlock→"").
- NO `data:` prefix (VERIFIED: `!img.data.startsWith("data:")`).
This makes the image case (#3) **fully deterministic and model-free** — use a tiny fixed PNG, assert
the fallback path, and assert whole-image parity (data === raw base64). A real-world large image would
hit the resize branch (wasResized===true → formatDimensionNote hint), but tiny-image determinism is
preferable for an automated gate.

## 6. Case → assertion mapping (the 14 cases, classified by testability)

| # | PRD §11 input | Model-free assertion (via injectFiles / handler mock)? | Integration (live pi)? |
|---|---|---|---|
| 1 | `Review #@a.ts` | YES: injected===1; text contains `<file name="ABS">\n<content>\n</file>`; original "Review #@a.ts" preserved verbatim; block after `\n\n---\n\n`. | "no read tool call" is structural: content present ⇒ model needn't call read. |
| 2 | `Summarize #@huge.log` | YES: assert block content === file content BYTE-FOR-BYTE (no truncation). Use a representative large temp file (e.g. 2 MB) — the contract is "entire file", verified by exact-equality, not by absolute 50 MB. | — |
| 3 | `Describe #@pic.png` | YES: injected===1; images[0].type==="image", mimeType==="image/png", data non-empty, no `data:` prefix, data===raw base64 (fallback); text has `<file name="ABS">` ref block. | — |
| 4 | `Inspect #@data.bin` | YES: injected===1; text contains `<file name="ABS"><binary file — …></file>`; assert NO garbage (the block body is exactly the fixed note string, not decoded bytes). | — |
| 5 | `Fix #@nope.ts` | YES: injected===0; text === original (token verbatim); returns continue-eligible. | — |
| 6 | `List #@src/` | YES: injected===0 (directory → not isFile → leave token). | — |
| 7 | `the foo#@bar thing` | YES: injected===0 (mid-word, `#@` preceded by word char → regex no-match). | — |
| 8 | `# Heading and #1234` | YES: injected===0 (no `#@`). | — |
| 9 | `Diff #@a.ts vs #@b.ts` | YES: injected===2; two blocks in order; handler notify `m==="#@ injected 2 file(s)"`, `t==="info"`. | — |
| 10 | `Read #@~/notes.md` | YES: injected===1; block path === `path.join(os.homedir(),"notes.md")` (tilde expanded). | — |
| 11 | `See #@a.ts.` | YES: injected===1; trailing `.` trimmed → resolves `a.ts` (cleanToken). | — |
| 12 | `pi -p "Review #@a.ts"` | Structural (input event fires for -p) verifiable via handler mock with `source:"interactive"` (already #1). | FULL integration: launch `pi -e ./sharp-at-file.ts -p "Review #@a.ts"`; needs live pi; observe the transformed prompt reaches the model. Document as a manual/integration step (optional auto-run if pi present + a no-model echo mode exists). |
| 13 | parity vs `pi @a.ts` | YES (format-level): assert our text/image block == processFileArguments template (§4). | OPTIONAL end-to-end: `pi @a.ts "x"` → compare emitted block. Document as integration add-on. |
| 14 | `Review @a.ts` (bare @) | YES: injected===0 (no `#@` substring); text byte-identical to input (no transform, no block). | — |

**Edge cases (§10) also assertable model-free:** empty 0-byte file → `<file name="ABS">\n\n</file>`
(VERIFIED probe_img2.mjs); guards source==="extension"→continue, steer→continue, no-`#@`→continue
(VERIFIED probe4.mjs); read-error (chmod 000) → token verbatim (PLATFORM-conditional: skip if
`process.getuid()===0` root, where chmod is ineffective — same caveat P1M1T3S1 used).

## 7. Deliverable shape (what the implementer builds)

A single self-contained `sharp-at-file.test.mjs` at repo root (committed; NOT `/tmp` — acceptance must
be re-runnable) that:
1. Resolves PIPKG via `npm root -g` (§2.1).
2. Imports the real `./sharp-at-file.ts` via jiti+alias (§2.2) — uses `path.resolve` of the test file's
   dir so it works from any cwd, NOT a hardcoded `/home/dustin/...`.
3. Creates temp fixtures in `mkdtempSync` (a.ts, b.ts, huge.log, pic.png [tiny fixed], data.bin [NUL
   bytes], empty.txt, src/ dir, ~/sharp-at-notes.md for tilde).
4. Runs the 14 cases (§6) + edge cases (§7) as named assertions with a tiny `assert(cond, msg)`
   helper + pass/fail counter; prints `✓/✗ case N: name`.
5. Integration cases (#12, #13 e2e): print clear `ℹ INTEGRATION (run manually): <exact command>` lines
   and do NOT count them against the exit code (or attempt via a `--integration` flag if a pi no-model
   echo mode is found — but default to documented-manual to keep the gate hermetic).
6. **Exits 0 iff all model-free assertions pass**; non-zero otherwise. This is the Level-2 gate.
PLUS a short validation report (`P1M2T4S1_validation_report.md` or appended) recording the actual
pass/fail counts, fulfilling the tasks.json OUTPUT ("A pass/fail validation report for all 14 cases").

## 8. Out-of-scope guardrails (owned by OTHER tasks)

- **T1–T3 (all of P1.M1):** the extension code itself. DONE — do NOT modify `sharp-at-file.ts`. If a
  test FAILS, the harness reports it; the FIX belongs to the owning M1 subtask (tasks.json: "Any bugs
  found feed back into the implementing subtasks (T1-T3) for fixes"). This task only REPORTS.
- **P1.M2.T5.S1:** the README.md. The validation report's "findings" inform its known-limitations
  section, but creating README.md is NOT this task.
- **No PRD.md / tasks.json / prd_snapshot.md edits.** No `.gitignore` edits.
