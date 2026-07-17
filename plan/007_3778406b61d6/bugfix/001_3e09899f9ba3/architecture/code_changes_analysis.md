# Code Changes Analysis — CRLF Fence-Close Bugfix

## Bug Location: `file-injector.ts`

### The Single Broken Line

**File:** `file-injector.ts`
**Function:** `computeCodeRanges` (lines 472–530)
**Line:** 496

```ts
// line 496 — CURRENT (broken under CRLF):
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
```

### The Fix (Option A — recommended)

```ts
// line 496 — FIXED (tolerates trailing \r from CRLF):
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");
```

**What changes:** Add `\\r?` immediately before the `$` anchor. In the string passed to
`new RegExp(...)`, `\\r` is the escaped `\r` literal, and `?` makes it optional. So the
compiled regex tail becomes `[ \t]*\r?$`, which matches:
- LF lines: ```` ``` ```` followed by zero spaces/tabs, no `\r`, end of string → matches ✓
- CRLF lines: ```` ``` ```` followed by zero spaces/tabs, then `\r`, end of string → matches ✓
- CRLF lines with trailing spaces: ```` ```  ```` (spaces) then `\r` → matches ✓

**What does NOT change:**
- `content.split("\n")` at line 474 — stays as-is (splitting on `\n` only).
- `lineStart[]` computation (lines 478–484) — stays as-is. Under CRLF, each `lines[i]` includes
  the trailing `\r` in its `.length`, so `lineStart[i]` offsets are correct. The `+1` for the `\n`
  that split removed is still correct.
- `closedEnd` computation (line 504): `Math.min(lineStart[j] + lines[j].length + 1, content.length)`
  — stays as-is. `lines[j].length` includes `\r`, so `+1` for the `\n` is still correct.
- `FENCE_OPEN_RE` (line 48) — stays as-is (not end-anchored; `\r` on open line is harmless).
- `inlineCodeRanges` (lines 389–444) — stays as-is (position-based, not line-based).
- `escapeRegex` (lines 356–358) — stays as-is.

### Why Not Option B?

Option B (strip `\r` from each line before testing):
```ts
if (closeRe.test(lines[j].replace(/\r$/, ""))) { ... }
```
Also correct, but:
- Slightly more code change (modifies the test call at line 502 rather than the regex at 496).
- Creates a `.replace()` call per line in the inner loop (negligible perf, but less clean).
- Option A is a 4-character addition to a regex string — the smallest possible diff.

### Why Not `content.split(/\r\n|\r|\n/)`?

This would handle ALL line-ending variants (CRLF, CR-only, LF) at the split level, but:
- **Breaks `lineStart[]` math.** The `+1` in `acc += lines[i].length + 1` assumes exactly one
  char (`\n`) was removed by split. With `\r\n` removed (2 chars), the `+1` would be wrong —
  offsets would drift by 1 per CRLF line.
- Would require changing the split line AND all offset arithmetic — far larger change.
- CR-only endings are essentially extinct (classic Mac OS ≤9, pre-2001).
- **Out of scope.** The PRD explicitly says CR-only is "defense-in-depth" only.

## Verification: Offset Math Under CRLF (Stays Correct)

For a CRLF file like `"```\r\ncode\r\n```\r\n"`:

```
content = "```\r\ncode\r\n```\r\n"
split("\n") → ["```\r", "code\r", "```\r", ""]

lineStart[0] = 0                        ("```\r" starts at offset 0)
lineStart[1] = 0 + 5 = 5                ("```\r" is 5 chars: `,`,`,`,`,\r; +1 for \n)
lineStart[2] = 5 + 5 = 10               ("code\r" is 5 chars; +1 for \n)
lineStart[3] = 10 + 5 = 15              ("```\r" is 5 chars; +1 for \n)

Open match at line 0: "```\r".match(FENCE_OPEN_RE) → matches "`{3," (stops before \r).
  fenceChar = "`", fenceLen = 3
  closeRe = /^ {0,3}`{3,}[ \t]*\r?$/

Scan line 1: "code\r" → no match
Scan line 2: "```\r" → /^ {0,3}`{3,}[ \t]*\r?$/ test:
  "```" matches `{3,}`, then \r matches \r?, then $ matches end → TRUE ✓

closedEnd = min(lineStart[2] + lines[2].length + 1, content.length)
         = min(10 + 4 + 1, 15) = min(15, 15) = 15
  (lines[2] = "```\r" → length = 4; +1 for \n = 5; 10+5 = 15)

Range: [0, 15] — covers the entire fenced block including closing fence. ✓
```

After the fix, the fence correctly closes at line 2, so any `#@` import after line 2 is
NOT in code and IS injected.

## Test Plan

### Unit-Level Regression Tests (file-injector.test.mjs, CC section, lines 1289–1430)

Add new cases following the EXACT CC1–CC11 pattern. Each uses `indexOfFirstHash(txt)` to derive
the `#@` index, calls `mod.computeCodeRanges(txt)`, and asserts via `mod.inCode(idx, r)`.

**CC12 — CRLF fence closes correctly; #@ AFTER the fence is NOT in code**
```
txt = "```\r\ncode\r\n```\r\n#@after.md\r\n"
idx = indexOfFirstHash(txt)  // index of # in "#@after.md"
r = mod.computeCodeRanges(txt)
assert: r has exactly ONE range [0, 15] (fenced block only, NOT to EOF)
assert: mod.inCode(idx, r) === false  (the #@ is OUTSIDE the closed fence)
```

**CC13 — CRLF: #@ INSIDE a fenced block IS in code (code-exempt still works under CRLF)**
```
txt = "```\r\n#@inside.ts\r\n```\r\n#@outside.md\r\n"
idxInside = indexOfFirstHash(txt)  // index of first #@ (inside the fence)
r = mod.computeCodeRanges(txt)
assert: mod.inCode(idxInside, r) === true  (inside fence → in code)
```
(Also assert the second #@ is NOT in code — same range structure.)

**CC14 — CR-only (classic Mac) line endings: defense-in-depth**
```
Note: split("\n") does NOT split on \r, so a pure \r-only file is one giant line.
This test documents that \r-only is a known limitation (not a regression target).
txt = "```\r#@inside.ts\r```\r#@outside.md"
r = mod.computeCodeRanges(txt)
assert: r.length <= 1  (at most one range — the whole thing is one line)
```
This test serves as documentation that CR-only is not split by `split("\n")` and is
intentionally out of scope.

**CC15 — Mixed LF/CRLF line endings in one file**
```
txt = "```\ncode\r\n```\r\n#@after.md\n"
idx = indexOfFirstHash(txt)
r = mod.computeCodeRanges(txt)
assert: mod.inCode(idx, r) === false  (fence closed; #@ is outside)
```

**CC16 — CRLF with trailing spaces before the close fence**
```
txt = "```\r\ncode\r\n```  \r\n#@after.md\r\n"
idx = indexOfFirstHash(txt)
r = mod.computeCodeRanges(txt)
assert: mod.inCode(idx, r) === false  ("```  " with trailing spaces + \r → closes)
```

### End-to-End Integration Test (file-injector.test.mjs, markdown section, ~lines 1515–1660)

**E2E — CRLF markdown with fenced block + #@ import directive → injected === 2**
```
// Write a CRLF .md fixture with a fenced block followed by a #@ import
const crlfMd = "# CRLF Spec\r\n\r\n```\r\ncode here\r\n```\r\n\r\nSee #@after.md\r\n";
fsSync.writeFileSync(path.join(TMPDIR, "crlf_test.md"), crlfMd);
fsSync.writeFileSync(path.join(TMPDIR, "after.md"), "# After Content\n");

const r = await mod.injectFiles("Read #@crlf_test.md", [], { cwd: TMPDIR });
assert: r.injected === 2  (crlf_test.md + after.md — the import after the fence resolves)
assert: r.text includes "<file name=\"...after.md\">"  (after.md block present)
assert: r.text includes "See after.md"  (marker stripped from crlf_test.md content)
```

### LF Control (implicit — existing tests CC1–CC11 already cover LF)

All existing CC1–CC11 cases use LF and must continue to pass unchanged after the fix.
The fix (`\r?` in the regex) is backward-compatible: `\r?` matches zero `\r` on LF lines.

## Test File Edit Locations

### `file-injector.test.mjs`

1. **CC section** (after CC11, around line 1432): Insert CC12–CC16 before the
   `// ── TOTAL-SIZE BUDGET` section header (line 1438).
2. **Markdown transitive imports section** (around line 1534, near case 16): Insert the
   CRLF e2e test case. Use the existing `FIX = { cwd: TMPDIR }` context and the existing
   fixture-writing pattern (`fsSync.writeFileSync`).
3. **No changes needed** to:
   - Module surface guard (lines 130–155) — no new exports.
   - Loader (lines 22–46) — no new imports.
   - `assert`/`runCase` helpers — reused as-is.

### No changes to `relative-imports.test.mjs` or `import-behavior.test.mjs`

These files exercise code-fence behavior only transitively (via `scanTokens({skipCode:true})`).
The fix doesn't change any behavior they assert. They must still pass, but need no edits.

## Documentation Impact

**README.md** — The `## Syntax` section under "Code is the escape hatch" bullet says:
> "A #@ inside a fenced or inline code span is not an import — it stays verbatim."

After the fix, this is true for both LF and CRLF files. No change to the bullet text is
strictly required (the behavior is now correct as documented). A brief note that fenced
code blocks are detected correctly across Windows (CRLF) and Unix (LF) line endings would
be a nice addition to prevent future regressions being perceived as "by design."

**Mode A (doc-with-work):** No per-subtask doc change — the fix doesn't alter any documented
API, config, or CLI surface.

**Mode B (changeset-level):** A final doc-sync task to touch README.md's "Code is the escape
hatch" bullet (or Limits section) to note CRLF compatibility.

## Risk Assessment

- **Regression risk: Very low.** The fix adds `\r?` (optional `\r`) to an existing regex tail.
  On LF lines, `\r?` matches zero `\r` — byte-identical behavior.
- **Offset math risk: Zero.** No change to `lineStart[]`, `closedEnd`, or any offset arithmetic.
- **Test risk: Zero.** No existing test uses CRLF, so no existing test can break. New CRLF tests
  validate the fix. Existing LF tests continue to pass unchanged.
- **Module surface risk: Zero.** No exports added/removed/renamed.
