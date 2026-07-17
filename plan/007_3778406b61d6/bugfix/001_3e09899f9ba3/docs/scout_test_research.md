# Scout Report — Test Structure Research (CRLF fence-close bugfix)

Scope: the three test files + the `file-injector.ts` exports that the tests reach. The
in-flight bug (see `bugfix/001_3e09899f9ba3/TEST_RESULTS.md` Issue 1) is that
`computeCodeRanges`' fence-close regex does not tolerate a trailing `\r` left by
`content.split("\n")`, so CRLF markdown silently drops every `#@` import after a fenced
code block. This report maps exactly where a fix + regression tests must go.

---

## Files Retrieved

1. `file-injector.test.mjs` (lines 1-2303, full) — the primary suite: loader, harness,
   fixtures, all PRD §11 cases + edges + guards + code-region tests + markdown imports.
2. `relative-imports.test.mjs` (lines 1-340, full) — regression suite for file-relative
   markdown imports + first-level bare-`@` (GROUP A–E).
3. `import-behavior.test.mjs` (lines 1-236, full) — standalone repro for import bugs
   (GROUP 1–5).
4. `file-injector.ts` (lines 389-560) — `inlineCodeRanges`, `computeCodeRanges`, `inCode`
   implementations (the bug location).
5. `file-injector.ts` (lines 44-48) — `FENCE_OPEN_RE` / `INLINE_CODE_MAX_OPENER` consts.
6. `package.json` — `npm test` = `node ./file-injector.test.mjs`.
7. `bugfix/001_3e09899f9ba3/TEST_RESULTS.md` — the bug spec + reproduction + suggested fix.

---

## 1. Test Organization — NO framework, custom zero-dep harness

There is **no `node:test`, no `describe`/`it`, no mocha/jest, no `assert` module**. Each
`.mjs` file is a standalone Node ESM script that imports the **real committed**
`file-injector.ts` via jiti, runs named assertions, prints a ✓/✗ matrix, and
`process.exit(failed ? 1 : 0)`.

`package.json` wires only the primary suite:
```json
"scripts": { "test": "node ./file-injector.test.mjs", "typecheck": "node ./scripts/typecheck.mjs" }
```
NOTE: `relative-imports.test.mjs` and `import-behavior.test.mjs` are NOT in `npm test`.
They are run manually (`node ./relative-imports.test.mjs`). All three must be kept green.

### Harness variants

**`file-injector.test.mjs`** — `runCase(n, name, fn)` + `integrationCase(...)`:
- `runCase(n, name, fn)` (lines ~110-122): `n` is the PRD case number OR a string label
  ("E1","CC1","MD1","F4","PD1","T1.S1-1",...). Catches thrown errors → pushes a
  `{n, name, status}` matrix row. ~200+ cases.
- `integrationCase(n, name, command, expected)` (lines ~124-130): prints a manual `pi`
  command; NEVER affects the exit code (hermetic gate).
- `assert(cond, msg)` (line ~95): `if (!cond) throw new Error(msg)`.
- Totals printed at the end (lines ~2285-2296).

**`relative-imports.test.mjs`** & **`import-behavior.test.mjs`** — simpler `test(name, fn)`:
```js
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      → ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
```
Both end with `console.log(...Result...); process.exit(failed ? 1 : 0)`.

---

## 2. ALL tests related to fenced code blocks / `computeCodeRanges` / code-region detection

### A. Direct unit tests of `computeCodeRanges` / `inCode` — file-injector.test.mjs

Section header: `// ── CODE-REGION DETECTION (PRD §5.6.1)` at **line 1289**.

These call the pure functions DIRECTLY with literal strings (no fs fixtures). A shared
helper derives the `#@` index so assertions are off-by-one-safe:
```js
// line 1293-1297
const FILE_INJECT_RE_TEST = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
function indexOfFirstHash(txt) {
  const m = [...txt.matchAll(FILE_INJECT_RE_TEST)][0];
  return m ? m.index : -1;
}
```

| Case | Line | Description |
|------|------|-------------|
| **CC1** | 1299 | `#@` inside a fenced block IS in code (skipped) — `"```\n#@fenced.ts\n```"` |
| **CC2** | 1308 | `#@` inside an inline backtick span IS in code — `"see \`#@inline.ts\` here"` |
| **CC3** | 1317 | `#@` in plain prose is NOT in code — `"review #@prose.md please"` |
| **CC4** | 1326 | unterminated fence → range to EOF; `#@` after open fence IS in code |
| **CC5** | 1338 | tilde fence does NOT close a backtick fence (other char is literal) |
| **CC6** | 1349 | closing fence with trailing content (` ```foo `) does NOT close (strict CommonMark) |
| **CC7** | 1362 | info-string line closes nothing; a real closer AFTER it reopens/closes correctly |
| **CC8** | 1374 | double-backtick span containing a single backtick is ONE range |
| **CC9** | 1385 | `inCode`: index before first range, after last, and in a gap all return false |
| **CC10** | 1407 | a real inline span is still detected inside a long backtick run (linear scanner) |
| **CC11** | 1420 | pathological 200k-backtick run completes in bounded (linear) time (<2s) |

**THIS IS THE PLACE TO ADD CRLF REGRESSION TESTS.** CC1/CC3/CC4/CC5 are the closest
templates: pass a literal CRLF string (`"```\r\n#@inside.ts\r\n```\r\n#@outside.md\r\n"`)
to `mod.computeCodeRanges(...)` and assert `inCode(outsideIdx, ranges) === false`.
The bug's TEST_RESULTS.md "Equivalently, probe computeCodeRanges directly" block is
exactly such a unit probe — it can be lifted almost verbatim into a `CC12` case.

### B. End-to-end / behavior tests touching fences & code-exempt (file-injector.test.mjs)

| Case | Line | What it pins |
|------|------|--------------|
| **E3** | 586 | "fenced-code-block #@ (documented limitation)" — `\`code #@a.ts\`` → injected===0 (trailing backtick path) |
| **16** | 1534 | md code-exempt: fenced `#@example.ts` left verbatim; only api.md imported |
| **T1.S1-13** | 1947 | scanTokens bare-@ code-exempt: fenced `@api.md` (skipCode:true) → [] |

### C. Code-exempt tests in relative-imports.test.mjs

| Case | Line | What it pins |
|------|------|--------------|
| **B7** | 240 | `#@b.md` inside a fenced code block yields no record (scanTokens, skipCode:true) |
| **C8** | 325 | a `#@file` inside a fenced/inline code span in a nested md is NOT imported |

### D. inlineCodeRanges (the inline-code half of computeCodeRanges)
- Covered indirectly by CC2, CC8, CC10, CC11. `inlineCodeRanges` is a **private**
  helper (file-injector.ts:389, NOT exported) — exercised only through
  `computeCodeRanges`. Inline-code detection is position-based, NOT line-based, so it
  is **unaffected by the CRLF bug** (per TEST_RESULTS.md scope analysis).

---

## 3. CRLF / `\r` tests — NONE EXIST

```
grep -E '\\r|CRLF|\r\n|carriage' across *.mjs  →  No matches found
```

**Zero** tests use `\r\n` or `\r` in any form. This is exactly the coverage gap the
bugfix must close. The existing CC cases all use LF (`\n`) literals, so the fence-close
regex path `[ \t]*$` is never exercised against a trailing `\r`.

Where CRLF test data would naturally live: the CC1–CC11 block (direct pure-function
probes, lines 1289–1430) and optionally an end-to-end markdown case near case 16/MD1
(lines 1534/1633). Both `file-injector.test.mjs` and the markdown import suites build
fixtures via `fs.writeFileSync(path, string)` — a CRLF fixture is just a string with
`\r\n` (no `fsSync.writeFileSync(buf)` needed; the string itself carries the `\r`).

---

## 4. How `computeCodeRanges` and `inCode` are imported

**They are NOT named imports.** They are accessed as `mod.<fn>` after a dynamic
`jiti.import` of the real TS file. From `file-injector.test.mjs` (lines 126-127 sanity,
1290-1304 usage):
```js
// sanity surface asserts (mod is the jiti-imported module object)
assert(typeof mod.computeCodeRanges === "function", "mod.computeCodeRanges must be a function (§5.6.1 code-region detection)");
assert(typeof mod.inCode === "function", "mod.inCode must be a function (binary search over code ranges)");
// usage (CC1, line 1303-1304):
const r = mod.computeCodeRanges(txt);
assert(mod.inCode(idx, r) === true, ...);
```
`relative-imports.test.mjs` and `import-behavior.test.mjs` sanity-assert only
`mod.injectFiles` / `mod.resolveImportPath` / `mod.scanTokens`; they do NOT touch
`computeCodeRanges`/`inCode` directly (they exercise it only transitively via
`scanTokens({skipCode:true})`).

---

## 5. The test runner / loader pattern (identical in all three files)

There is a load-bearing loader preamble (no package.json "type":"module" deps — jiti is
nested inside the global pi package). **`file-injector.test.mjs` (lines 22-46):**
```js
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

function resolvePiPackageRoot() { /* npm root -g → .../@earendil-works/pi-coding-agent */ }
const PIPKG = resolvePiPackageRoot();
const jitiLib = PIPKG + "/node_modules/jiti/lib/jiti.mjs";
const { createJiti } = await import(jitiLib);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TS_PATH = path.resolve(SCRIPT_DIR, "file-injector.ts");
const mod = await jiti.import(TS_PATH);
```
`relative-imports.test.mjs` (lines 41-52) and `import-behavior.test.mjs` (lines 12-22)
copy this **verbatim** (the same alias map + the same `jiti.import(resolve(SCRIPT_DIR,
"file-injector.ts"))`).

**Assert module usage:** NONE. Every file defines its own local `assert(c, m)` that
`throw new Error(m)`. The Node `assert` builtin is not used anywhere.

**Assertion helpers per file:**
- `file-injector.test.mjs`: `assert` (line 95), `runCase` (~110), `integrationCase`
  (~124), `countFileBlocks(text, abs)` (~270 — escapes + counts `<file name="abs">`).
- `relative-imports.test.mjs`: `assert` (line 64), `mk(root,rel,body)` (line 70),
  `newRoot()` (73), `ctxFor(cwd,extra)` (74), `run(cwd,prompt,bareAt)` (75 — calls
  `mod.injectFiles`), `has(text,marker)` (76), `blocksRel` (78), `countAbs` (80),
  `captureHandlers()` (84), `blankState()` (178).
- `import-behavior.test.mjs`: `assert` (line 26), `mk` (31), `ctxFor` (32), `run`
  (33), `has` (37), `abs` (38), `capture(event)` (43), `runHandler(cwd,prompt)` (46).

---

## 6. Markdown transitive import tests (patterns to mirror for an e2e CRLF case)

### `file-injector.test.mjs` — PRD §5.6 cases (FIX = `{cwd}` no-budget ctx; PAGED_FIX = tight budget)
Section headers at lines **1515** (MARKDOWN TRANSITIVE IMPORTS) and **1585** (SHARED
BUDGET + MARKDOWN EDGES). Each case calls `mod.injectFiles(prompt, [], FIX)` and asserts
on `r.injected`, `r.paged`, `r.text` includes/!includes, block order (pre-order DFS via
`indexOf('<file name="...">')`), and marker stripping.

| Case | Line | Scenario |
|------|------|----------|
| 15 | 1520 | notes.md imports api.md → both blocks, marker stripped, injected=2 |
| 16 | 1534 | md code-exempt: fenced `#@example.ts` verbatim; only api.md |
| 17 | 1544 | md cycle a.md↔b.md → each once, dedup, injected=2 |
| 18 | 1558 | md abs rejected: `#@/etc/hosts` ignored (relative-only) |
| 19 | 1567 | md relative base: sub/notes.md's `#@api.md` → sub/api.md |
| 20 | 1595 | §5.6.2 shared budget: bigdoc + 3 parts whole, huge.log paged; notify all 5 |
| MD1 | 1633 | §10 md edge: missing ghost.md → marker VERBATIM, injected=1 |
| MD2 | 1647 | §10 md edge: `#@../shared/api.md` allowed (md's dir, outside cwd) |
| 21 | 1744 | md ext-shorthand `#@api` → api.md |
| 22 | 1759 | exact-wins `#@guide` → bare guide |
| 23 | 1777 | `.markdown` fallback |
| 24 | 1793 | top-level exact-only (no .md fallback) |
| EDG-1..4 | 1803-1865 | no-match / already-extended-missing / dedup / path-prefix |
| 25 | 2195 | §4.6 default-off bare @ |
| 26 | 2208 | §4.6 on bare @ stripped prefixLen 1 |
| 27 | 2226 | §4.6 on+#@ no double-match; fenced code verbatim |
| 28 | 2243 | top-level bare-@ never injects |

**The "build a CRLF markdown fixture + assert imports after a fence inject" pattern:**
MD1/MD2 + case 19 are the closest templates. They write a `.md` via
`fsSync.writeFileSync(path, string)` (the string containing `#@` import markers) and
assert which content markers land. A CRLF e2e case would `writeFileSync(notesMd,
"...\r\n```\r\ncode\r\n```\r\n\r\nSee #@api.md\r\n")` and assert
`r.injected === 2` (the LF control already proves injected===2; CRLF today gives 1).

### `relative-imports.test.mjs` — GROUP C (relative resolution) / GROUP D (first-level bare-@)
- Uses `mk(root, rel, body)` to build fresh per-case tmp trees with UNIQUE content
  markers, `run(root, prompt, bareAt)` → `mod.injectFiles`. Asserts via
  `has(out.text, MARKER)` + `!has` + `countAbs`.
- GROUP C: C1–C12 (lines 251-340). GROUP D: D1–D7 (lines 358-430) incl. the REAL input
  handler path via `runViaHandler` + hermetic `.pi/file-injector.json`.

### `import-behavior.test.mjs` — GROUP 1–5
- GROUP 1: relative resolution (1a–1c). GROUP 2: bare-@ at every depth (2a–2c).
  GROUP 3: trailing punctuation. GROUP 4: markdown formatting glue (italic/bold).
  GROUP 5: depth-0 bare-@ via injectFiles AND `runHandler`.

---

## 7. Export / import mechanism for testing "internal" functions

Everything the tests touch is a top-level `export function` in `file-injector.ts`.
The TS interfaces are erased at runtime; tests pass plain object literals for `State`
and mock `ctx`. There is a **module-surface completeness guard** (file-injector.test.mjs
~130-145) that enumerates the asserted exports and FAILS if the module ships any other
function OR if `injectMarkdown` is exported:

```js
const ASSERTED_EXPORTS = new Set([ "default","injectFiles","cleanToken","formatTextFileBlock",
  "formatImageBlock","formatBinaryBlock","formatEmptyImageBlock","formatPagedDirectiveBlock",
  "hasValidImageMagic","scanTokens","injectFile","emitText","isAbsoluteOrTilde",
  "computeCodeRanges","inCode","estimateImageTokens","resolveImportPath","isRegularFile","readConfig" ]);
const PURE_HELPERS_NOT_ASSERTED = new Set(["expandTildeAndResolve","extOf","isBinary"]); // tested indirectly
// fails if mod ships a function not in either set
// ALSO asserts typeof mod.injectMarkdown === "undefined"  (PRIVATE recursion driver)
```

**Relevant to this bugfix:** `computeCodeRanges` and `inCode` are ALREADY exported and
sanity-asserted — so a new CRLF regression case needs NO new export and NO new sanity
line; it just calls `mod.computeCodeRanges(...)` / `mod.inCode(...)` like CC1–CC11 do.

---

## The bug location (for the implementing agent)

`file-injector.ts`, function `computeCodeRanges` (line **472**):
- **line 474**: `const lines = content.split("\n");` — on CRLF this leaves a trailing
  `\r` on each line.
- **line 496** (THE BUG):
  ```ts
  const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
  ```
  `[ \t]*$` does not permit `\r`, so a closing line `"```\r"` fails → fence treated as
  unterminated → range runs to EOF (line 512) → every later `#@` is `inCode` → dropped.

Supporting facts (per TEST_RESULTS.md): `FENCE_OPEN_RE` (line 48, not end-anchored) is
fine under CRLF; `inlineCodeRanges` (line 389) is position-based and unaffected;
`lineStart[]` (line 480) uses `lines[i].length + 1`, so it stays correct if you only
patch the close test (the `\r` counts toward `lines[i].length`, which the offset math
already accounts for). **Suggested fix (Option A, smallest):** add `\\r?` before `$` in
the `closeRe` template at line 496. Optionally also normalize a lone `\r`-only line
ending.

---

## Start Here

1. **`file-injector.ts:496`** — the single line to fix (`closeRe` regex, add `\\r?`).
2. **`file-injector.test.mjs:1299-1304`** (CC1) — copy this exact pattern into a new
   `CC12` (CRLF fence-close) + `CC13` (CR-only) unit case using literal `\r\n` strings.
3. **`file-injector.test.mjs:1633`** (MD1) — mirror as an end-to-end CRLF markdown
   fixture case if broader coverage is wanted (write a `.md` with `\r\n`, assert
   `r.injected === 2` for a post-fence `#@` import).
4. After editing: run `node ./file-injector.test.mjs` (the `npm test` gate) AND
   manually `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs`
   (both are NOT in `npm test` but must stay green).
