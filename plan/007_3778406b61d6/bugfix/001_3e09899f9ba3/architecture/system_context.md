# System Context — CRLF Fence-Close Bugfix

## Project Overview

**Project:** `pi-file-injector` — a Pi extension (`#@file`) that injects whole files into the
LLM prompt when the user writes `#@` before a path. Files are delivered whole when they fit
the context budget, or paged via the `read` tool when they don't.

**Bug being fixed:** CRLF (`\r\n`) line endings in markdown files break fenced-code-block close
detection in `computeCodeRanges`, silently dropping every `#@` import that appears after a fenced
code block.

**Severity:** Major (Should Fix). No Critical issues found.

## Technology Stack

- **Language:** TypeScript (single source file: `file-injector.ts`, 1115 lines)
- **Runtime:** Node.js ESM (`"type": "module"`)
- **Transpilation:** jiti (lazy, no build step; tests `jiti.import()` the `.ts` directly)
- **Testing:** Custom zero-dependency test harness (no `node:test`, no `mocha`, no `jest`)
  — three standalone `.mjs` scripts that import the real `.ts` via jiti
- **Dependencies:** None at the module level (pi-coding-agent provides the extension API;
  jiti comes from the global pi package)

## Key Source File

`file-injector.ts` — the entire extension. Key functions relevant to this bugfix:

| Function | Lines | Exported? | Role |
|----------|-------|-----------|------|
| `computeCodeRanges` | 472–530 | ✅ YES | Builds sorted `[start, end)` code ranges (fenced blocks + inline code) |
| `inCode` | 539–549 | ✅ YES | Binary search: true iff index lies inside any code range |
| `scanTokens` | 611–648 | ✅ YES | Scans text for `#@`/`@` markers; skips those `inCode` (line 648) |
| `inlineCodeRanges` | 389–444 | ❌ NO | Linear-time inline-code span detector (position-based, NOT line-based) |
| `escapeRegex` | 356–358 | ❌ NO | Escapes regex metacharacters (used by closeRe construction) |

## The Bug

### Root Cause

In `computeCodeRanges` (line 472), markdown content is split into lines via:

```ts
const lines = content.split("\n");  // line 474
```

On a CRLF file, each line retains its trailing `\r` (since `split("\n")` only removes `\n`,
not `\r`). The fence-close regex is built dynamically (line 496):

```ts
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
```

The `[ \t]*$` tail does NOT permit a `\r`, and `$` (no `m` flag, single-line test on one line)
matches only at the true end of the string. So a closing fence line `"```\r"` fails to match:

```js
closeRe.test("```")    // → true  (LF)
closeRe.test("```\r")  // → false (CRLF — BUG)
```

### Consequence

The closing fence is never detected → the fence is treated as **unterminated** → its code
range runs to EOF (line 512: `ranges.push([openStart, content.length])`). Every `#@` import
after the first fenced block falls inside the code range → `scanTokens` skips it (line 648:
`if (codeRanges && inCode(c.idx, codeRanges)) continue`) → imports are **silently dropped**
(no error, no warning, no injection).

### Reproduction

```
CRLF file: "# Title\r\n\r\n```\r\ncode\r\n```\r\n\r\nAfter: #@after.md\r\n"
injectFiles("Read #@/tmp/crlf.md", [], { cwd: "/tmp" })
→ injected === 1  (only crlf.md; after.md silently dropped)
→ LF control: injected === 2  (both files)
```

### Scope of the Fix

ONLY the `closeRe` regex construction at line 496 is broken. All other components are
verified unaffected under CRLF:

- `FENCE_OPEN_RE` (line 48): NOT end-anchored (`/^ {0,3}(`{3,}|~{3,})/`), so trailing `\r`
  on the open line doesn't matter.
- `inlineCodeRanges` (line 389): Position-based char-offset scanner, NOT line-based —
  `\r` is just another non-backtick char it steps over.
- `lineStart[]` (lines 478–484): Uses `lines[i].length + 1` for offsets. Under CRLF,
  `lines[i]` includes the `\r` (it's part of `length`), so offsets remain correct —
  the `+1` accounts for the `\n` that `split` removed, and `\r` stays counted in the
  line's own length. No change needed.
- Token capture (`FILE_INJECT_RE`): `\S+` stops at `\r` (which is whitespace), so paths
  are captured correctly under CRLF.
- `headStartLine`/`headCompleteLineCount` (lines 280–292): Count `\n` only — one per line
  for both LF and CRLF. No change needed.

## The Fix

**Option A (recommended, smallest diff):** Add `\r?` before `$` in the closeRe template:

```ts
// line 496 — BEFORE (broken):
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");

// line 496 — AFTER (fixed):
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");
```

This tolerates the trailing `\r` left by `split("\n")` on CRLF files. It also toler a lone
`\r` if it happens to appear (classic Mac `\r`-only endings, though split("\n") would not
split those — see Option B consideration below).

**Option B (alternative):** Strip `\r` from each line at test time:

```ts
if (closeRe.test(lines[j].replace(/\r$/, ""))) { ... }
```

This normalizes without disturbing char offsets (lineStart is computed from `lines[i].length + 1`,
which includes the `\r`).

**Recommendation:** Option A — it's the smallest, most localized change. It matches the
"approximate CommonMark" framing (CommonMark treats `\r\n` and `\r` as line endings).

**Note on CR-only (`\r` without `\n`) endings:** Under `content.split("\n")`, a pure `\r`-only
file is NOT split at `\r` — it becomes a single line. So `FENCE_OPEN_RE` and `closeRe` would
both need the file to have been split for them to work at all. CR-only is essentially extinct
(classic Mac OS ≤9). Option A's `\r?` handles the `\r` within a CRLF-split line; for true
CR-only support, `content.split(/\r\n|\r|\n/)` would be needed but that changes the `+1`
offset math and is out of scope. The PRD recommends CR-only tests as "defense-in-depth" only.

## Test Infrastructure

### Files

| File | Lines | In `npm test`? | Role |
|------|-------|-----------------|------|
| `file-injector.test.mjs` | 2303 | ✅ YES | Primary suite (~200+ cases: PRD §11 + edges + guards + code-region + markdown) |
| `relative-imports.test.mjs` | 508 | ❌ NO (manual) | File-relative md imports + bare-`@` regression |
| `import-behavior.test.mjs` | 250 | ❌ NO (manual) | Import behavior regression (standalone) |

All three must be kept green. `npm test` runs only the primary suite.

### Test Harness Pattern

Custom zero-dependency. Key components in `file-injector.test.mjs`:
- `assert(cond, msg)` (line ~95): throws `Error(msg)` if false.
- `runCase(n, name, fn)` (line ~110): catches errors, pushes `{n, name, status}` row.
- `integrationCase(n, name, command, expected)` (line ~124): prints manual pi command, NEVER affects exit code.
- Loader: `jiti.import(TS_PATH)` → `mod` object (lines 22–46).
- Module surface guard (lines 130–155): Asserts exact export set; `computeCodeRanges`/`inCode`
  are already asserted — no new exports or guard changes needed.

### Code-Region Detection Tests (where new CRLF tests go)

Section: `// ── CODE-REGION DETECTION (PRD §5.6.1) — computeCodeRanges/inCode ─` at line 1289.

Existing cases CC1–CC11 (lines 1299–1430) are pure-function probes calling
`mod.computeCodeRanges(txt)` and `mod.inCode(idx, r)` directly with literal LF strings.
A shared helper derives the `#@` index:

```js
const FILE_INJECT_RE_TEST = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
function indexOfFirstHash(txt) {
  const m = [...txt.matchAll(FILE_INJECT_RE_TEST)][0];
  return m ? m.index : -1;
}
```

**No CRLF tests exist.** This is the exact coverage gap. New CRLF cases should be added as
CC12+ following the identical pattern.

### End-to-End Markdown Import Tests

Cases 15–16, MD1–MD2 (lines 1515–1660) build `.md` fixtures via `fsSync.writeFileSync(path, string)`
and assert on `r.injected`, `r.text` includes/!includes, block order. A CRLF e2e case would
write a `.md` with `\r\n` line endings and assert the post-fence `#@` import resolves.

## Documentation Surface

- `README.md` — Documents the "Code is the escape hatch" behavior under `## Syntax` →
  `### Optional: bare-@ markdown imports` (bullet: "A #@ inside a fenced or inline code span
  is not an import — it stays verbatim."). No mention of line endings. The fix makes this
  documented behavior work correctly under CRLF.
- No CRLF/line-ending references exist in README.md or file-injector.ts.

## Constraints for the Implementing Agent

1. **Single-line fix.** The code change is localized to `closeRe` construction at line 496.
   Do NOT change `content.split("\n")`, `lineStart[]` math, `FENCE_OPEN_RE`, or `inlineCodeRanges`.
2. **No export changes.** `computeCodeRanges`/`inCode` are already exported and sanity-asserted.
   The module surface guard must pass unchanged.
3. **All three test files must pass.** `npm test` (primary) + manual `node ./relative-imports.test.mjs`
   + `node ./import-behavior.test.mjs`.
4. **jiti transpilation.** Tests import the real `.ts` via jiti — no build step. Run tests with
   `node ./file-injector.test.mjs`.
5. **No new dependencies.** The test harness is zero-dependency; keep it that way.
