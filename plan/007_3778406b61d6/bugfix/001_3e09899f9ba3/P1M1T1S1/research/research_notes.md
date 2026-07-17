# Research Notes — P1.M1.T1.S1 (bugfix 001_3e09899f9ba3): Fix closeRe to tolerate trailing \r (CRLF fence-close)

## Mission
Fix Issue 1 (Major): CRLF (`\r\n`) line endings in markdown break fenced-code-block **close** detection.
`content.split("\n")` leaves a trailing `\r` on each line; the close regex `[ \t]*$` rejects `\r` → the closing
fence `"```\r"` fails `closeRe.test()` → fence treated as unterminated → range runs to EOF → every `#@` after
the fence is classified inCode → silently dropped by scanTokens. The fix is ONE line (Option A): add `\\r?`
before `$` → `[ \\t]*\\r?$`. Plus two regression cases (CC12, CC13).

**Scope = S1 ONLY:** the closeRe one-liner + CC12 + CC13. NOT CR-only/mixed/trailing-spaces/e2e (S2); NOT
README CRLF note (T2.S1).

## Baseline (MUST stay green)
- `node ./file-injector.test.mjs` → **122 passed, 0 failed.**
- `node ./relative-imports.test.mjs` → **38 passed, 0 failed** (not in `npm test`; run explicitly).
- `node ./import-behavior.test.mjs` → **22 passed, 0 failed** (not in `npm test`; run explicitly).
- `npm run typecheck` → **0 errors** under `--strict`. (Total 182 existing tests.)

## The exact fix (code_changes_analysis.md §"The Fix" — Option A, recommended)
File: `file-injector.ts`, function `computeCodeRanges` (L472–530), **line 496**.

**Current (L496, broken under CRLF):**
```ts
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
```
**After (insert `\\r?` immediately before `$`):**
```ts
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");
```
- In the string literal, `\\r` is the escaped `\r` (carriage return); `?` makes it optional.
- LF lines (`"```"`) → matches (no `\r`, `$` at end). CRLF lines (`"```\r"`) → matches (`\r?` consumes `\r`).
- This is the ONLY code change. 4 chars added to one regex string.

## VERIFIED standalone (node one-liner, no source edit)
```
current  /^ {0,3}`{3,}[ \t]*$/        .test("```")   = true   .test("```\r")  = false  ← BUG
fixed    /^ {0,3}`{3,}[ \t]*\r?$/      .test("```")   = true   .test("```\r")  = true   ← FIX
(fixed also matches "```  \r" — CRLF + trailing spaces.)
```

## Offset math under CRLF — STAYS CORRECT (do NOT touch it)
- `content.split("\n")` (L474) stays as-is: CRLF leaves `lines[i] = "…\r"` (the `\r` is part of `.length`).
- `lineStart[i]` (L478-484) = `acc += lines[i].length + 1`: the `+1` for the `\n` split removed is still accurate
  because the `\r` is counted in `lines[i].length`. VERIFIED: for `"```\r\ncode\r\n```\r\n#@after.md\r\n"`,
  lineStart = [0,5,11,16,28]; close fence at j=2 → closedEnd = lineStart[2]+lines[2].length+1 = 11+4+1 = 16.
- `FENCE_OPEN_RE` (L48, not end-anchored) is unaffected by a trailing `\r` on the OPEN line.
- `inlineCodeRanges` (L389-444, position-based) unaffected. `escapeRegex` (L356) unaffected.
- DO NOT switch to `content.split(/\r\n|\r|\n/)` — it breaks the `+1` math (2 chars removed per CRLF line → drift).

## CC12 / CC13 regression tests (file-injector.test.mjs)
Placement: AFTER CC11's closing `});` (L1434), BEFORE the `// ── TOTAL-SIZE BUDGET` header (L1437). Follow the
EXACT CC1-CC11 pattern: use `indexOfFirstHash(txt)` (L1294, derives the #@ index via the same FILE_INJECT_RE
scanTokens uses — avoids off-by-one), call `mod.computeCodeRanges(txt)`, assert via `mod.inCode(idx, r)`.
**Do NOT assert exact range numbers** — the CC1-CC11 pattern asserts `inCode(...)===true/false` (deterministic);
the item's "[0,15]" is illustrative prose (the actual exclusive range end is 16; the #@ at index 16 is NOT in code).

```js
await runCase("CC12", "§5.6.1 — CRLF fence closes correctly; #@ AFTER the fence is NOT in code", async () => {
  const txt = "```\r\ncode\r\n```\r\n#@after.md\r\n";
  const idx = indexOfFirstHash(txt);
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(r.length === 1, `CRLF fence must produce ONE range (close detected), got ${JSON.stringify(r)}`);
  assert(mod.inCode(idx, r) === false,
    `#@ after a CRLF-closed fence must NOT be in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});

await runCase("CC13", "§5.6.1 — CRLF: #@ INSIDE a fenced block IS in code (code-exempt still works under CRLF)", async () => {
  const txt = "```\r\n#@inside.ts\r\n```\r\n#@outside.md\r\n";
  const idx = indexOfFirstHash(txt);   // the FIRST #@ = #@inside.ts (index 5)
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside a CRLF fenced block must BE in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});
```
RED/GREEN trace (verified by offset math):
- CC12 WITHOUT fix: closeRe.test("```\r")=false → fence unterminated → range [0, EOF) → inCode(idx16, [0,28))=true → `===false` assertion FAILS (RED). WITH fix: range [0,16) → inCode(16,…)=false → PASS (GREEN).
- CC13 WITHOUT fix: range to EOF → inCode(5,…)=true → `===true` PASS even without fix (so CC13 alone is not RED). CC12 is the RED→GREEN discriminator; CC13 is the code-exempt-still-works guard.

## Gates
1. `node ./file-injector.test.mjs` → **124 passed** (122 + CC12 + CC13), 0 failed.
2. `node ./relative-imports.test.mjs` → 38 passed (unchanged).
3. `node ./import-behavior.test.mjs` → 22 passed (unchanged).
4. `npm run typecheck` → 0 errors.
TDD order: add CC12/CC13 (CC12 RED) → apply the L496 one-liner → CC12 GREEN + full suite GREEN.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ CR-only (`\r` alone), mixed LF/CRLF, trailing-spaces-before-close, e2e CRLF markdown-import integration test = **S2**.
- ❌ README.md CRLF/Windows compatibility note = **T2.S1**.
- ❌ Do NOT touch content.split("\n"), lineStart[], closedEnd, FENCE_OPEN_RE, inlineCodeRanges, escapeRegex.
- ❌ Do NOT switch to `split(/\r\n|\r|\n/)` (breaks +1 offset math).
- ✅ ONLY file-injector.ts L496 changes (add `\\r?` before `$`); +CC12 +CC13 in the test file.

## DOCS: none
The closeRe regex is an internal implementation detail; no user-facing/config/API surface change. (Mode A: none.)
