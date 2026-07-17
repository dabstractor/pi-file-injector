# PRP — P1.M1.T1.S1 (bugfix 001_3e09899f9ba3): Fix closeRe at file-injector.ts:496 to tolerate trailing \r (CRLF fence-close detection)

> **Scope flag:** This is a **one-line bugfix** (Major): CRLF (`\r\n`) markdown line endings break fenced-code-block
> **close** detection → the fence is treated as unterminated → its code range runs to EOF → every `#@` import
> after the fence is silently dropped. Fix = insert `\\r?` before the `$` anchor in the `closeRe` regex
> (`computeCodeRanges`, L496) + add two regression cases (CC12, CC13). **Scope = S1 ONLY.** Defense-in-depth
> (CR-only/mixed/trailing-spaces/e2e) is S2; the README CRLF note is T2.S1.

---

## Goal

**Feature Goal:** Make fenced-code-block **close** detection line-ending-agnostic: a closing fence line with a
trailing `\r` (CRLF) is recognized as a close, so a fenced block ends at its closing fence (not EOF) and any
`#@` import after the fence is delivered (not silently dropped as "inside code"). LF behavior is unchanged.

**Deliverable:** Modified `file-injector.ts` (ONE line: `closeRe` at L496 gains `\\r?` before `$`) + modified
`file-injector.test.mjs` (two new regression cases CC12 + CC13 in the CODE-REGION DETECTION section).

**Success Definition:**
1. CC12 is RED on the old regex (CRLF fence → range to EOF → `#@after.md` classified inCode), GREEN after the fix.
2. CC13 confirms code-exempt STILL works under CRLF (`#@inside.ts` inside a CRLF fence IS in code).
3. `node ./file-injector.test.mjs` → **124 passed** (122 + CC12 + CC13), 0 failed.
4. `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 22 passed (unchanged).
5. `npm run typecheck` → 0 errors.
6. No other behavior changes (LF fence detection, offset math, inline code, token capture — all byte-for-byte identical).

## Why

- **Restores a documented contract on a common trigger.** PRD §5.6.1 says code-region detection approximates
  CommonMark, which treats `\r\n` and `\r` as line endings. CRLF is the Windows default and appears in
  cross-platform repos (`core.autocrlf=true`, editors, Office/Notion exports). Today any CRLF markdown with a
  code fence + a later `#@` import silently loses those imports — no error, no warning. This violates PRD §2
  Goal 6 and the §5.6 markdown-import contract.
- **The fix is maximally localized.** Only the fence-**close** test is affected: the open detection
  (`FENCE_OPEN_RE`, not end-anchored), inline-code detection (position-based), token capture (`\S+` stops at
  `\r`), and head line counting (counts `\n` only) are all already CRLF-correct. The close-line test is the
  sole defect — a 4-char regex addition closes it.
- **Adds the missing gate coverage.** Zero of the 182 existing tests use CRLF line endings, so the regression
  is invisible to the current suite. CC12 (RED→GREEN) + CC13 (code-exempt guard) lock it in.

## What

### User-visible behavior

- A markdown file with CRLF line endings now behaves identically to one with LF endings for fenced-code-block
  detection: a `#@` import appearing **after** a fenced block is delivered; a `#@` **inside** a fenced block is
  still treated as code (left verbatim, not imported).

### Technical behavior (the contract)

- `computeCodeRanges`' `closeRe` tail changes from `[ \t]*$` to `[ \t]*\r?$`. A closing fence line `"```\r"`
  (CRLF) now matches; `"```"` (LF) still matches; `"```  \r"` (CRLF + trailing spaces) also matches.

### Success Criteria

- [ ] `file-injector.ts:496` `closeRe` ends with `[ \\t]*\\r?$` (the `\\r?` is the only new token).
- [ ] CC12 present, RED before the fix, GREEN after.
- [ ] CC13 present (code-exempt under CRLF), GREEN.
- [ ] `node ./file-injector.test.mjs` → 124 passed; relative-imports 38 + import-behavior 22 unchanged; typecheck clean.
- [ ] No change to `content.split("\n")`, `lineStart[]`, `closedEnd`, `FENCE_OPEN_RE`, `inlineCodeRanges`, `escapeRegex`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current line (L496), the exact replacement (add `\\r?` before `$`), the verified regex behavior table, the
offset-math proof (why nothing else changes), the CC12/CC13 specs (verbatim, modeled on CC1–CC11), the precise
insertion point (after CC11 L1434, before TOTAL-SIZE BUDGET L1437), and all gates. One source line + two test cases.

### Documentation & References

```yaml
# MUST READ — the single broken line, Option A fix, and the offset-math proof
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/architecture/code_changes_analysis.md
  why: "§'The Single Broken Line' pins L496; §'The Fix (Option A)' gives the exact old→new regex and the
        'What does NOT change' list (split, lineStart, closedEnd, FENCE_OPEN_RE, inlineCodeRanges, escapeRegex);
        §'Verification: Offset Math Under CRLF' proves offsets stay correct; §'Why Not split(/\\r\\n|\\r|\\n/)'
        explains why the split-level change is out of scope (breaks the +1 math)."
  critical: "ONLY L496 changes. Do NOT touch the split, the offset arithmetic, or any other detection path."

# MUST READ — the bug reproduction + scope-of-fix analysis
- file: plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/architecture/system_context.md
  why: "§'The Bug' shows closeRe.test('```')=true vs .test('```\\r')=false; §'Scope of the Fix' confirms open
        detection / inline code / token capture / head line counting are all already CRLF-correct."

# The file you edit (the only source change — ONE line)
- file: file-injector.ts
  why: "computeCodeRanges L472-530; the closeRe at L496 is the edit site. content.split('\\n') L474, lineStart[]
        L478-484, closedEnd L504, FENCE_OPEN_RE L48, inlineCodeRanges L389-444, escapeRegex L356 — all UNCHANGED."
  pattern: "closeRe is built per-fence from fenceChar+fenceLen via escapeRegex; tested at L502 closeRe.test(lines[j])."
  gotcha: "The string literal passes '\\r' to new RegExp, which compiles to the \\r token (carriage return). '?
           makes it optional. Do NOT write a single backslash (\"\\r\") — in a JS string that is just a carriage
           return character, not the regex token; you need '\\\\r' in source = '\\r' regex token."

# The gate you also edit (+CC12 +CC13)
- file: file-injector.test.mjs
  why: "indexOfFirstHash(txt) at L1294 (derives the #@ index via the same FILE_INJECT_RE scanTokens uses — avoids
        off-by-one). CC1 template at L1299. CC11 closes at L1434. The '// ── TOTAL-SIZE BUDGET' header is at L1437.
        Insert CC12/CC13 between L1434 and L1437."
  pattern: "Each CC case: const txt = …; const idx = indexOfFirstHash(txt); assert(idx>-1,…); const r =
            mod.computeCodeRanges(txt); assert(mod.inCode(idx, r) === <bool>, …). Do NOT assert exact range numbers."
  gotcha: "Follow the CC1-CC11 inCode-assertion pattern. The item's prose '[0,15]' is illustrative; the actual
           exclusive range end is 16 (closedEnd = lineStart[2]+lines[2].length+1). Asserting a literal range
           number is fragile and unnecessary — inCode(idx, r) is the deterministic check."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (closeRe L496: add `\\r?` before `$`; ONE line only)
├── file-injector.test.mjs    # ← EDITED (+CC12 +CC13 after CC11 L1434, before TOTAL-SIZE BUDGET L1437)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/007_3778406b61d6/bugfix/001_3e09899f9ba3/
    ├── architecture/{code_changes_analysis.md, system_context.md}
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — closeRe L496: `[ \\t]*$` → `[ \\t]*\\r?$` (the ONLY source change).
file-injector.test.mjs    # MODIFIED — +runCase("CC12", …) + runCase("CC13", …) after CC11 (~L1434).
# No other files. No new files. No new exports. No new imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the string-literal escaping. Source must read:  "[ \\t]*\\r?$"
//   In the JS string "...[ \\t]*\\r?$", `\\r` becomes the 2-char regex token `\r` (carriage return) when
//   new RegExp(...) compiles it; `?` makes it optional. Writing "\r" (single backslash) in the source would
//   embed an actual CR character into the pattern — WRONG. Match the existing `[ \\t]*` escaping style exactly.

// CRITICAL — ONLY L496 changes. content.split("\n") (L474), lineStart[] (L478-484), closedEnd (L504),
//   FENCE_OPEN_RE (L48), inlineCodeRanges (L389-444), escapeRegex (L356) are all VERIFIED CRLF-correct — leave
//   them. Do NOT "normalize" line endings at the split level.

// CRITICAL — do NOT switch to content.split(/\r\n|\r|\n/). It removes 2 chars per CRLF line but lineStart's
//   `+1` assumes exactly 1 (\n) was removed → offsets drift by 1 per CRLF line. (code_changes_analysis §"Why Not".)

// GOTCHA — CC12 is the RED→GREEN discriminator; CC13 alone is NOT red (a #@ inside a fence is inCode=true both
//   with and without the fix, since the range always starts at the open fence). CC13 guards that the fix didn't
//   break code-exempt. Both must pass after the fix.

// GOTCHA — do NOT assert exact range numbers in CC12/CC13. The CC1-CC11 pattern asserts mod.inCode(idx, r).
//   The item's prose "[0,15]" describes the fence's last covered index; the exclusive range end is 16. Asserting
//   a literal number couples the test to offset arithmetic and is unnecessary — inCode is the deterministic gate.

// LIBRARY — `$` without the `m` flag matches only at true end-of-string (not per-line). closeRe is tested on a
//   single line (lines[j]), so `$` = end of that line's string. The `\r` sits before end-of-string under CRLF,
//   which is exactly why `[ \t]*$` (no \r?) fails and `[ \t]*\r?$` succeeds.
```

## Implementation Blueprint

### Data models and structure

No data-model change. The fix is a 4-char regex addition on one line. `computeCodeRanges` returns
`[number, number][]` unchanged; `inCode(index, ranges): boolean` unchanged.

### Implementation Patterns & Key Details

```ts
// === file-injector.ts L496 — BEFORE → AFTER (the ONLY source change) ===

// BEFORE (broken under CRLF — `[ \t]*$` rejects a trailing \r):
//   const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");

// AFTER (tolerate an optional trailing \r from CRLF — Option A, recommended):
  const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");
//                                                                                    ^^^^
//                                                              inserted: `\r?` (4 source chars: \ \ r ?)
```

```js
// === file-injector.test.mjs — CC12 + CC13 (after CC11 ~L1434, before TOTAL-SIZE BUDGET ~L1437) ===

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
  const idx = indexOfFirstHash(txt);   // the FIRST #@ = #@inside.ts
  assert(idx > -1, "test fixture must contain a #@ token");
  const r = mod.computeCodeRanges(txt);
  assert(mod.inCode(idx, r) === true,
    `#@ inside a CRLF fenced block must BE in code (idx=${idx}, ranges=${JSON.stringify(r)})`);
});
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (L496 closeRe): insert `\\r?` between `*` and `$` → tail becomes `[ \\t]*\\r?$`.
  - UNCHANGED: content.split("\n") L474; lineStart[] L478-484; closedEnd L504; FENCE_OPEN_RE L48;
    inlineCodeRanges L389-444; escapeRegex L356; every other function.

FILE_EDITS (file-injector.test.mjs):
  - add (after CC11's `});` ~L1434, before the `// ── TOTAL-SIZE BUDGET` header ~L1437): runCase("CC12", …) + runCase("CC13", …).
  - NO edits to: sanity list, ASSERTED_EXPORTS, completeness guard, indexOfFirstHash, any existing case.

NO_CHANGES: relative-imports.test.mjs, import-behavior.test.mjs, package.json, scripts/typecheck.mjs, PRD.md,
            README.md, all plan/ files. NO new exports. NO new imports.
```

### Implementation Tasks (ordered by dependencies — TDD: RED first)

```yaml
Task 1 (RED): ADD CC12 + CC13 to file-injector.test.mjs (after CC11 ~L1434, before TOTAL-SIZE BUDGET ~L1437)
  - FOLLOW the CC1-CC11 pattern EXACTLY: indexOfFirstHash(txt) → mod.computeCodeRanges(txt) → assert via mod.inCode.
  - CC12 txt = "```\r\ncode\r\n```\r\n#@after.md\r\n"; assert r.length===1 && mod.inCode(idx, r)===false.
  - CC13 txt = "```\r\n#@inside.ts\r\n```\r\n#@outside.md\r\n"; assert mod.inCode(idx, r)===true (FIRST #@ = inside).
  - DO NOT assert exact range numbers (use inCode, per the CC1-CC11 convention).
  - VERIFY RED: `node ./file-injector.test.mjs` → CC12 FAILS (range to EOF → inCode=true → `===false` fails).
    (CC13 may already pass — that's fine; it guards code-exempt, not the close bug.)

Task 2 (GREEN): FIX closeRe at file-injector.ts L496
  - CHANGE: `[ \\t]*$` → `[ \\t]*\\r?$` (insert `\\r?` before `$`). ONE line. The ONLY source change.
  - ESCAPING: source literal "[ \\t]*\\r?$" — `\\r` compiles to the `\r` regex token; `?` optional.
  - DO NOT touch content.split("\n"), lineStart[], closedEnd, FENCE_OPEN_RE, inlineCodeRanges, escapeRegex.
  - DO NOT switch to split(/\r\n|\r|\n/) (breaks the +1 offset math).

Task 3 (VERIFY): run all gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 124 passed (122 + CC12 + CC13), 0 failed.
  - node ./relative-imports.test.mjs → 38 passed (unchanged).
  - node ./import-behavior.test.mjs → 22 passed (unchanged).

Task 4 (DOCS): none
  - The closeRe regex is an internal implementation detail. No user-facing/config/API surface change. (Mode A: none.)
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# The fix is a regex string-literal change (\\r? added) — no type impact.
```

### Level 2: The Regression Gate (existing 122 + new CC12/CC13)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: all 122 existing cases PASS + CC12 PASS + CC13 PASS. Final: "Result: 124 passed, 0 failed.", exit 0.
# If a non-CC case flips to FAIL, the regex change over-reached (re-check L496 is the ONLY edit).
```

### Level 3: The other two suites (must stay green — not in `npm test`)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 38 passed, 0 failed
node ./import-behavior.test.mjs     # → 22 passed, 0 failed
# These exercise the real markdown-import pipeline (which calls computeCodeRanges); they must stay green.
# A failure here means the closeRe change altered fence detection for LF content (it must not).
```

### Level 4: TDD RED→GREEN + standalone regex sanity

```bash
# Step A (RED): with CC12/CC13 added but L496 UNCHANGED, CC12 must FAIL (range to EOF → inCode=true).
# Step B (GREEN): after the L496 fix, CC12 PASSES. Confirm:
node ./file-injector.test.mjs 2>&1 | grep -E "case CC1[23]:|Result:"
# Expected: "  ✓ case CC12: …" + "  ✓ case CC13: …" + "Result: 124 passed, 0 failed."

# Standalone regex sanity (no source edit — confirms the token behavior):
node -e 'const f=c=>new RegExp("^ {0,3}`{3,}"+c); for(const[c,l]of[["[ \t]*$","cur"],["[ \t]*\\\\r?$","fix"]])for(const s of ["```","```\r","```  \r"])console.log(l,JSON.stringify(s),f(c).test(s));'
# Expected: cur "```"=true cur "```\r"=false cur "```  \r"=false ; fix "```"=true fix "```\r"=true fix "```  \r"=true
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 124 passed (122 + CC12 + CC13), 0 failed.
- [ ] `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 22 passed.
- [ ] file-injector.ts L496 is the ONLY source line changed; tail is `[ \\t]*\\r?$`.

### Feature Validation (behavior)

- [ ] CC12 RED before the fix (CRLF fence → range to EOF → `#@after.md` inCode), GREEN after.
- [ ] CC13 GREEN (code-exempt still works under CRLF — `#@inside.ts` IS in code).
- [ ] LF fence detection unchanged (all existing CC1-CC11 + relative-imports/import-behavior green).
- [ ] Offset math unchanged (lineStart/closedEnd stay correct — no split-level change).

### Code Quality Validation

- [ ] Only L496 changed in file-injector.ts; no other function touched.
- [ ] CC12/CC13 follow the CC1-CC11 pattern (indexOfFirstHash + computeCodeRanges + inCode); no exact-range assertions.
- [ ] No new exports, no new imports.

### Documentation

- [ ] No docs change (the closeRe regex is an internal detail; Mode A = none). README CRLF note is T2.S1.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT change anything other than L496.** content.split("\n"), lineStart[], closedEnd, FENCE_OPEN_RE,
  inlineCodeRanges, and escapeRegex are all VERIFIED CRLF-correct. "Normalizing" line endings at the split
  level breaks the `+1` offset math (code_changes_analysis §"Why Not split(/\\r\\n|\\r|\\n/)").
- ❌ **Do NOT mis-escape the regex.** Source must read `"[ \\t]*\\r?$"` — `\\r` (two chars: backslash, r)
  compiles to the `\r` regex token. A single-backslash `"\r"` embeds an actual CR character — wrong.
- ❌ **Do NOT assert exact range numbers in CC12/CC13.** The CC1-CC11 convention is `mod.inCode(idx, r)`. The
  item's prose "[0,15]" is illustrative (the exclusive range end is 16); a literal-number assertion couples the
  test to offset arithmetic and is needlessly fragile.
- ❌ **Do NOT use Option B (`.replace(/\r$/, "")` at the test call) or split-level normalization.** Option A
  (the `\\r?` regex token) is the smallest, most localized diff and matches the "approximate CommonMark" framing.
- ❌ **Do NOT rely on CC13 as the RED signal.** CC13 (a #@ inside a fence) passes both before and after the fix
  (the range always starts at the open fence). CC12 (a #@ AFTER a closed fence) is the RED→GREEN discriminator.
- ❌ **Do NOT skip the other two suites.** They're not in `npm test`; run `relative-imports.test.mjs` and
  `import-behavior.test.mjs` explicitly — they exercise the real markdown-import pipeline that calls
  computeCodeRanges and must stay green (the fix must not alter LF fence detection).
- ❌ **Do NOT do S2 / T2 work here.** CR-only/mixed/trailing-spaces/e2e defense-in-depth is S2; the README CRLF
  note is T2.S1. S1 = the L496 one-liner + CC12 + CC13 ONLY.

---

## Confidence Score: 10/10

A deterministic one-line regex fix (add `\\r?` before `$`), verified standalone (current fails `"```\r"`, fixed
passes; LF unchanged), with the offset math proven to stay correct under CRLF (closedEnd = lineStart[j]+lines[j].
length+1). The architecture docs give the exact old→new line, the "what does NOT change" list, and the explicit
rejection of the split-level alternative. The two regression cases (CC12 RED→GREEN, CC13 code-exempt guard)
follow the existing CC1-CC11 pattern verbatim. All gates (typecheck + 3 suites) are green today; the only
RED→GREEN is CC12. One source line + two test cases; the implementing agent re-runs `npm run typecheck` + the
three suite commands.
