# Research Notes — P1.M2.T4.S1 (Manual test matrix: 14 acceptance cases)

> This is a **VALIDATION** task, not an implementation task. INPUT = the complete extension
> (sharp-at-file.ts, T3.S2 done). OUTPUT = a pass/fail report for all 14 PRD §11 cases. No source
> changes to sharp-at-file.ts. Findings feed back to T1–T3 implementers + README (T5.S1).

## 0. Verification status of the extension (as of this research)

The current `sharp-at-file.ts` (T3.S2 present) was run against the full gate below and **PASSES all
14 cases** (Tier A: 50/50 assertions; Tier B end-to-end: T1/T12/T13/T14 green). So the expectation
for the implementing agent is that the matrix passes; any FAIL is a real regression to report.

## 1. The core problem: HOW to observe behavior (no test framework, model involved)

`sharp-at-file.ts` is a jiti extension. There is no `package.json`, no test runner, no linter. The
extension transforms the prompt on the `input` event; "success" is partly deterministic (format,
regex, file dispatch) and partly behavioral (model receives content, no `read` tool call). Three
**verified observation mechanisms** cover all 14 cases:

### Tier A — Deterministic gate (model-free) — covers Tests 1–11, 13, 14
jiti-imports `sharp-at-file.ts` (Pi's loader), captures the handler via a mock `pi.on("input", cb)`,
creates REAL fixtures in a temp sandbox, fires synthetic `InputEvent`s, and asserts the exact
`InputEventResult` (transform text / images / action / notify). This is the same pattern the prior
PRPs (T3.S1/T3.S2) used for their gates. **VERIFIED: 50/50 pass.** Script: `research/gate_matrix.mjs`.

### Tier B — Capture provider + `pi -p` (no API key, no network) — covers Tests 1, 12, 13, 14 end-to-end
A tiny extension registers a provider whose `streamSimple(model, context)` writes `context.messages`
(the **model-facing** prompt, AFTER the `input` event fired) to a JSON file and returns a canned
assistant message. Because `streamSimple` short-circuits HTTP, **no API key and no network are
needed**. `pi -e sharp-at-file.ts -e capture-provider.ts --provider capture --model test -p "..."`
then captures exactly what the model would receive. **VERIFIED working** (see §4 logs).
- `Context.messages` exists and carries the transformed user message: `pi-ai/dist/types.d.ts:332-335`
  `interface Context { systemPrompt?: string; messages: Message[]; tools?: Tool[] }`.
- `UserMessage.content` is `string | (TextContent|ImageContent)[]` (`types.d.ts`).
- `streamSimple` registration + short-circuit pattern: `docs/custom-provider.md` "Custom Streaming API".

### Tier C (optional) — Real provider `--mode json` — confirms the "no `read` tool call" corollary
`pi --mode json -p "Review #@a.ts"` emits NDJSON events incl. `message_start/message_end` (the prompt
sent to the model) and `tool_execution_start/end` (tool calls). Assert no `tool_execution_*` event
has `toolName === "read"` before the first assistant turn. Needs a real provider key. Only required
to prove the *corollary*; the *defining* behavior (content in the prompt) is already proven by
Tier A+B. Doc: `docs/json.md` (event types enumerated).

## 2. Format parity (Test 13) — EXACT bytes, VERIFIED

- Built-in `processFileArguments` (`dist/cli/file-processor.js:11`, NOT re-exported from main index —
  deep-import via jiti from `dist/cli/file-processor.js`): TEXT block =
  `` `<file name="${absolutePath}">\n${content}\n</file>\n` `` (trailing `\n`); IMAGE block (no hints)
  = `<file name="${absolutePath}"></file>\n` + push `ImageContent`; empty file SKIPPED; missing =
  `process.exit(1)`; binary = falls through to text (UTF-8 garbage).
- Extension `formatTextFileBlock` = `'<file name="' + abs + '">\n' + content + '\n</file>'` (NO
  trailing `\n`; the `\n\n` join is owned by assembly).
- **Parity rule**: the per-block format is identical EXCEPT processFileArguments appends one trailing
  `\n`. Compare `builtin.text.trimEnd() === extBlock`. **VERIFIED MATCH** (both via deep-import
  comparison AND end-to-end through both real CLI paths: `pi @a.ts "x"` vs `pi -e ... -p "#@a.ts"`).

## 3. Fixtures (item §2) — exact creation (all verified in the gate)

| Fixture | Creation (Node `fs` / shell) | Why |
|---|---|---|
| `a.ts` (~50 words) | `fs.writeFile(abs("a.ts"), 'export const GREETING = "hello world";\nexport function add(a, b) { return a + b; }\n')` | Test 1, 9, 11, 13, 14 |
| `b.ts` | `fs.writeFile(abs("b.ts"), 'export const TWO = "second file body";\n')` | Test 9 |
| `huge.log` (2 MB representative) | build a >2MB string of repeated lines; item allows "smaller representative"; assert inner===full file bytes (NO truncation) | Test 2 |
| `pic.png` | `Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64")` (valid 1×1 PNG) | Test 3 |
| `data.bin` (NUL bytes) | `Buffer.from([0x49,0x00,0x54,0x45,0x00,0x53,0x54,0x00,0x21])` | Test 4 |
| `src/` (dir) | `fs.mkdir(abs("src"))` | Test 6 |
| `~/notes.md` | write into the sandbox and **set `process.env.HOME = sandbox`** so `os.homedir()` (POSIX reads `$HOME`) resolves into the sandbox — no pollution of real home | Test 10 |

**Test 10 gotcha (critical):** `expandTildeAndResolve` calls `os.homedir()`. On POSIX, Node's
`os.homedir()` returns `process.env.HOME` when set. Setting `HOME=<sandbox>` (in-process for the
gate; `HOME=<sandbox> pi ...` as an env prefix for Tier B) makes `#@~/notes.md` resolve into the
sandbox — clean, no real-home writes. **VERIFIED** in both tiers.

## 4. End-to-end capture logs (Tier B, against the CURRENT extension)

```
T12 (-p #@a.ts):  a.ts injected?     True   (user msg = "Review #@a.ts\n\n---\n\n<file name=...>...</file>")
T14 (-p bare @a.ts): NO injection?   True   (user msg = exactly "Review @a.ts", byte-for-byte)
T13 builtin @a.ts block == #@ block: True   (through BOTH real CLI paths)
```
Captured `-p #@a.ts` user message (repr):
`"Review #@a.ts\n\n---\n\n<file name=\"/tmp/saf-smoke/a.ts\">\nexport const GREETING = \"hello world\";\nexport function add(a: number, b: number) { return a + b; }\n\n</file>"`

## 5. Per-case assertion map (what each test MUST check) — encoded in gate_matrix.mjs

| # | Input | Assert (gate unless noted) |
|---|---|---|
| 1 | `Review #@a.ts` | transform; text startsWith marker; `---` before block; inner block == raw file bytes; 0 images; notify "1 file(s)"/"info" |
| 2 | `Summarize #@huge.log` | transform; inner content === HUGE_BODY (full, no truncation) |
| 3 | `Describe #@pic.png` | transform; images.length==1; type image; data non-empty, no `data:` prefix; mimeType image/png; ref block present; marker in text |
| 4 | `Inspect #@data.bin` | transform; block == binary-note (em dash U+2014); NO `\u0000` in text |
| 5 | `Fix #@nope.ts` | continue; no notify (verbatim) |
| 6 | `List #@src/` | continue; no notify (directory) |
| 7 | `the foo#@bar thing` | continue; no notify (mid-word, `(?<=\W)` fails on `o`) |
| 8 | `# Heading and #1234` | continue; no notify (no `#@`) |
| 9 | `Diff #@a.ts vs #@b.ts` | transform; both blocks; order a<b; notify "2 file(s)" |
| 10 | `Read #@~/notes.md` | transform; block name == `<HOME>/notes.md` |
| 11 | `See #@a.ts.` | transform; block name `a.ts` (period trimmed); marker `See #@a.ts.` preserved; no `a.ts.` block |
| 12 | `pi -p "Review #@a.ts"` | **Tier B**: captured user msg contains `<file>` block (input event fires for initial -p msg) |
| 13 | `#@a.ts` vs `pi @a.ts "x"` | **Tier A+B**: `builtin.text.trimEnd() === extBlock` (parity, sans trailing \n) |
| 14 | `Review @a.ts` | continue (gate); **Tier B**: captured msg == exactly `Review @a.ts` (byte-for-byte unchanged) |

## 6. Definition of Done (item §3) — checklist mapping

- "no uncaught errors" → gate runs to completion (injectFiles never throws; per-file try/catch). ✓
- "model receives whole-file contents with zero read tool calls" → Tier A (content in transform) +
  Tier B (content in captured model-facing msg) + Tier C optional (no `read` tool_execution event). ✓
- "prompts without #@ (incl bare @file) byte-for-byte unchanged" → Test 14 (continue = no transform)
  + Tier B capture shows exact text. ✓
- "#@ works in interactive AND initial -p messages" → handler is source-agnostic for interactive/
  rpc/followUp (only extension/steer gated); Tier B proves the -p initial path. Interactive TUI is
  the same `input` event in `prompt()` (PRD §3) — proven by source-agnosticism. ✓

## 7. Risks / notes for the implementing agent

- **Gate Test 1 block-format pitfall**: `formatTextFileBlock` = `<file name="ABS">\n<content>\n</file>`.
  If the fixture file ends in `\n` (most source files do), the block shows `\n\n</file>` (content's
  trailing `\n` + the format's `\n`). Assert **inner content == raw file bytes**, NOT a naive string
  equality with the body constant. (This bit the first draft of the gate — fixed.)
- **pic.png resizeImage**: may return a `ResizedImage` (1×1, wasResized=false) OR `null` (→ raw
  base64 fallback). Test 3 must be robust to both: assert `images.length>=1 && type==="image" &&
  data non-empty`, NOT a specific dimension.
- **50 MB Test 2**: a true 50 MB file makes the gate slow (full-string equality). Use a ~2 MB
  representative (item explicitly allows "smaller representative"); the no-truncation assertion is
  identical at any size. If a 50 MB run is wanted for the report, run it separately in Tier B.
- **HOME pollution**: always set `HOME=<sandbox>` for Test 10 in BOTH tiers; never write `~/notes.md`
  to the real home.
- **`processFileArguments` deep-import**: `await jiti.import(pathToFileURL(PI+"/dist/cli/file-processor.js").href)`
  then `mod.processFileArguments([absPath])`. NOT in the main `@earendil-works/pi-coding-agent` index.
- **Capture provider registration**: requires `baseUrl` (+ `apiKey`) when `models` is provided, even
  though `streamSimple` short-circuits HTTP. Use dummy values `http://localhost:0` / `dummy`.

## 8. Where the deliverables live

- PRP: `plan/001_5aa8724eb506/P1M2T1S1/PRP.md`
- Verified harness scripts (runnable as-is): `research/gate_matrix.mjs`, `research/parity.mjs`,
  `research/capture-provider.ts`
- Validation report (implementing agent writes): `plan/001_5aa8724eb506/P1M2T1S1/VALIDATION_REPORT.md`
