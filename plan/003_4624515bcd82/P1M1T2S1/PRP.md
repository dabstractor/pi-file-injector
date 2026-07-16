---
name: "P1.M1.T2.S1 — Markdown constants + code-region detection helpers"
prd_ref: "PRD §5.6.1 (code-region detection), §5.6.2 (IMAGE_FALLBACK_TOKENS), §4.5 rule 1 (isAbsoluteOrTilde — REUSED from T1.S2)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — add constants + helpers; fill the scanTokens skipCode stub
target_language: TypeScript (jiti transpile-on-load; no tsconfig/lint/test-framework — the .mjs harness IS the gate)
depends_on: "P1.M1.T1.S2 (VERIFIED LANDED: provides isAbsoluteOrTilde L207, scanTokens w/ skipCode stub L240, processTokenStream, injectFile, emitText, State, subtract)"
consumed_by: "P1.M1.T2.S2 (consumes IMAGE_FALLBACK_TOKENS in estimateImageTokens), P1.M1.T2.S3 (scanTokens opts.skipCode:true → computeCodeRanges/inCode drive the markdown import exemption), P1.M1.T2.S4 (module-surface sync)"
---

# PRP — P1.M1.T2.S1: Markdown constants + code-region detection helpers

> **Scope flag:** ADDITIVE pure helpers. Add 4 module constants (`MD_EXTS`, `IMAGE_FALLBACK_TOKENS`,
> `INLINE_CODE_RE`, `FENCE_OPEN_RE`), 2 exported pure functions (`computeCodeRanges`, `inCode`), and
> FILL the existing `scanTokens` `skipCode` stub (currently a comment at L240). `isAbsoluteOrTilde`
> already exists (T1.S2) — REUSE, do not redeclare. **No behavior change at top level**: `scanTokens`
> is still only called with `skipCode:false` from `injectFiles`, so the new code path is inert until
> T2.S3 wires markdown. The 52-test suite stays green; add ~6-8 new pure-function unit tests.

---

## Goal

**Feature Goal:** Implement approximate-CommonMark code-region detection (`computeCodeRanges` +
`inCode`) and the markdown/import constants cluster, then wire `scanTokens`'s `skipCode` option to
actually skip `#@` matches that start inside a code region — the foundation PRD §5.6 step 3 /
§5.6.1 need so a `#@<path>` inside a fenced block or inline code span is left verbatim (the escape
hatch for markdown that documents the `#@` syntax itself).

**Deliverable:** A modified `./file-injector.ts` (in-place edit) where:
1. **Constants cluster** (after the existing `READ_LIMIT`, ~L25): `MD_EXTS = new Set(["md","markdown"])`,
   `IMAGE_FALLBACK_TOKENS = 2805`, `INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g`, `FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/`
   (exact forms per PRD §5.6.1 / §5.6.2). Module-scope `const`, NOT exported.
2. **`export function computeCodeRanges(content: string): [number, number][]`** — returns a sorted
   (by start) list of `[start, end)` code regions: fenced blocks first (walk lines with a running char
   offset; open on `FENCE_OPEN_RE`; close = line of ` {0,3}` + same fence char repeated ≥ open length
   followed by whitespace-only, range = open-fence-first-char … end-of-close-line-incl-its-newline;
   unterminated → EOF; the other fence char does NOT reopen inside a block), then inline-code spans from
   `INLINE_CODE_RE` whose FULL span is NOT already inside a fenced range, sorted by start.
3. **`export function inCode(index: number, ranges: [number, number][]): boolean`** — binary search over
   the sorted disjoint ranges; true iff `range[0] <= index < range[1]` for some range.
4. **`scanTokens` filled in**: `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;`
   before the loop + `if (codeRanges && inCode(m.index!, codeRanges)) continue;` inside the loop at L240
   (replacing the placeholder comment).
5. **Test sanity list**: append 2 asserts (`computeCodeRanges`, `inCode`) after the `isAbsoluteOrTilde`
   assert at L125. `isAbsoluteOrTilde` is ALREADY in the list (T1.S2) — do NOT re-add.
6. **New pure-function test section**: ~6-8 `runCase` blocks asserting `computeCodeRanges`/`inCode`
   directly with literal strings (no fs fixtures) — fenced block, inline span, prose, unterminated fence,
   tilde-vs-backtick independence, closing-fence-with-trailing-content-doesn't-close.

**Success Definition:** `node ./file-injector.test.mjs` prints `Result: <52 + N> passed, 0 failed.`
(N = the new computeCodeRanges/inCode test count, ~6-8), exit 0. The existing 52 cases stay green
(scanTokens top-level call still passes `skipCode:false`, so `codeRanges` is `null` → `inCode` never
called → zero behavior change at top level). `computeCodeRanges` and `inCode` are exported and asserted.

## Why

- **The escape hatch for documenting `#@` in markdown (PRD §4.5 rule 3, §5.6 step 3).** Without
  code-region detection, a markdown file that contains `` `#@example.ts` `` in a fenced block (e.g. a
  README explaining the syntax) would have that token scanned as a real import. §5.6.1's approximate
  CommonMark detection skips `#@` matches whose start index lies inside a fenced block or inline code
  span, leaving them verbatim. T2.S1 ships the detection engine + wires it into the (already-extracted)
  `scanTokens`; T2.S3's `injectMarkdown` then simply calls `scanTokens(content, dir, { allowAbsTilde:
  false, skipCode: true }, state)`.
- **Pure + independently testable.** `computeCodeRanges`/`inCode` are pure functions over strings — no
  I/O, no state mutation, no mocking. This subtask lands the hardest-to-test piece of MI-2 in isolation,
  with direct unit assertions on literal inputs, before T2.S3 entangles it with recursion + budget.
- **Foundational constants for the whole MI-2 milestone.** `MD_EXTS` (T2.S3 markdown branch),
  `IMAGE_FALLBACK_TOKENS` (T2.S2 estimateImageTokens), and the two detection regexes are defined once
  here so later subtasks consume without re-declaring.

## What

User-visible behavior: **none** (T2.S1 is additive; the new code path is inert until T2.S3 calls
`scanTokens` with `skipCode:true`). Externally, `injectFiles` behaves identically. The deliverable is
two new exported pure helpers + their direct unit tests + the constants T2.S2/T2.S3 will consume.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `<52 + N> passed, 0 failed` (N ≈ 6-8 new tests), exit 0. The
      original 52 cases are UNCHANGED (green).
- [ ] `computeCodeRanges(content: string): [number, number][]` exists, is `export`ed, is PURE (no I/O,
      no state), and returns ranges sorted by `start`, disjoint.
- [ ] `inCode(index: number, ranges: [number, number][]): boolean` exists, is `export`ed, uses binary
      search, returns true iff some range `[s,e)` satisfies `s <= index < e`.
- [ ] `MD_EXTS`, `IMAGE_FALLBACK_TOKENS`, `INLINE_CODE_RE`, `FENCE_OPEN_RE` exist as module-scope
      `const` (NOT exported), placed in the constants cluster after `READ_LIMIT`.
- [ ] `INLINE_CODE_RE` is byte-exact `/(`+)([\s\S]*?)\1(?!`)/g` and `FENCE_OPEN_RE` is byte-exact
      `/^ {0,3}(`{3,}|~{3,})/` (PRD §5.6.1).
- [ ] `scanTokens` now contains `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;`
      (before the loop) and `if (codeRanges && inCode(m.index!, codeRanges)) continue;` (first line
      inside the loop, replacing the L240 placeholder comment). `isAbsoluteOrTilde` is NOT redeclared.
- [ ] At top level, behavior is unchanged: `injectFiles` → `processTokenStream(text, ctx.cwd,
      { allowAbsTilde: true, skipCode: false }, ...)` → `codeRanges` is `null` → `inCode` never called.
      (Verify: the 52 existing cases, including FS1/FS2/E3, stay green.)
- [ ] New unit tests assert: (a) `#@x` inside a fenced block IS in code; (b) `#@x` inside an inline
      backtick span IS in code; (c) `#@x` in prose is NOT in code; (d) unterminated fence → range to
      EOF (a `#@` after the open fence is in code); (e) tilde fence does NOT close a backtick fence
      (and vice versa); (f) closing fence with trailing content (` ```foo `) does NOT close (strict
      CommonMark) → the `#@` after it is NOT in code.
- [ ] Test sanity list has exactly 2 NEW asserts appended (computeCodeRanges, inCode); the 13 existing
      asserts (incl. `isAbsoluteOrTilde` at L125) are UNTOUCHED.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the verified POST-T1.S2 starting state (exact lines for the
scanTokens stub + constants cluster + isAbsoluteOrTilde), the byte-exact regexes, the line-by-line
`computeCodeRanges` algorithm with offset accounting, the binary-search `inCode` body, the
strict-CommonMark closing-fence decision (with rationale for deviating from the literal item-desc
wording), the exact 2-line scanTokens edit, the test-harness append points, and the verified
validation command. The implementer edits one source file + appends to the test harness, then runs
one command.

### Documentation & References

```yaml
# MUST READ — the exact regexes + algorithm spec for THIS subtask
- file: PRD.md
  why: "§5.6.1 gives the two regexes (FENCE_OPEN_RE, INLINE_CODE_RE) verbatim and the fenced/inline
        detection rules (open/close/EOF/other-char-literal/inline-inside-fenced-skip); §5.6.2 pins
        IMAGE_FALLBACK_TOKENS=2805 (2000×2000 worst case = 4·4·170+85); §4.5 rule 1 gives
        isAbsoluteOrTilde (REUSED from T1.S2, not redeclared). §10 edge-case table rows
        '#@path inside fenced/inline code in a.md → Not an import; left verbatim' is the behavior goal."
  section: "### 5.6.1 Code-region detection (approximate CommonMark) + ### 5.6.2 Total-size budget accounting"
  critical: "PRD §5.6.1 closing-line wording ('a closing line that is {0,3} + same fence char ≥ opening
             length') is AMBIGUOUS about trailing content. This PRP resolves it as STRICT-CommonMark
             (closing fence must be followed by whitespace-only) — see Known Gotchas + Implementation
             Blueprint. The strict reading passes ALL required unit assertions and prevents a #@ after
             '```ruby' from being wrongly treated as inside code."

# MUST READ — the MI-2 insertion-point contract (constant forms + helper signatures + wiring)
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "## MI-2 'New constants (cluster near L17-43)' pins MD_EXTS/IMAGE_FALLBACK_TOKENS/INLINE_CODE_RE/
        FENCE_OPEN_RE exact forms; 'New pure helpers' pins computeCodeRanges/inCode signatures + the
        strict-CommonMark description ('closing line = {0,3} + same fence char ≥ opening length'); the
        sanity-list rule ('Any newly-exported helper ... must be appended to this list or the gate fails')."
  section: "## MI-2 — Markdown imports + total-size budget → 'New constants' + 'New pure helpers'"
  critical: "Line numbers are commit landmarks (shifted after T1.S2 landed). Use IDENTIFIER names. The
             MI-2 section confirms: scanTokens opts.skipCode is the consumer (T2.S3), and the constants
             are owned HERE even though their consumers are T2.S2/T2.S3."

# MUST READ — NO new deps; jiti/regex/image facts
- file: plan/003_4624515bcd82/architecture/external_deps.md
  why: "Confirms NO markdown parser dependency (code-region detection is two inline regexes — full
        CommonMark is out of scope, failure modes benign); IMAGE_FALLBACK_TOKENS rationale
        (2000×2000 resize cap = 4×4 tiles); jiti transpile-on-load (syntax/undefined-identifier errors
        fail the import → sanity asserts never run)."
  section: "## 2. Pi API facts / ## 3. Explicitly NOT used"
  critical: "There is intentionally NO `node:readline` or CommonMark parser. The line-walk is a manual
             split('\\n') + offset accumulation (see Implementation Blueprint)."

# MUST READ — the contract for what exists when T2.S1 begins (POST-T1.S2, VERIFIED LANDED)
- file: plan/003_4624515bcd82/P1M1T1S2/PRP.md
  why: "T1.S2 is the CONTRACT: isAbsoluteOrTilde (L207, exported, 'T2.S1 REUSES — do not redeclare'),
        scanTokens with the skipCode stub comment (L240, 'T2.S1 inserts the code-region exemption here'),
        processTokenStream/injectFile/emitText/State/subtract all present. The scanTokens JSDoc even
        spells out the exact two lines T2.S1 must add."
  critical: "Do NOT re-implement isAbsoluteOrTilde (T1.S2 owns it). Do NOT change scanTokens' signature
             or other logic. T2.S1 ONLY: adds constants, adds computeCodeRanges/inCode, and replaces the
             L240 comment with the 2 documented lines."

# The file you edit (the only source change)
- file: file-injector.ts
  why: "POST-T1.S2 file already has: constants cluster L8-25 (insert after L25 READ_LIMIT), isAbsoluteOrTilde
        L207, scanTokens L231-250 with the skipCode stub comment at L240. T2.S1 adds constants + 2 helpers
        + fills the stub."
  pattern: "scanTokens loop body — the FIRST line inside `for (const m of text.matchAll(FILE_INJECT_RE)) {`
            is currently the placeholder comment '// (T2.S1 inserts the code-region exemption here …)'.
            Replace it with `if (codeRanges && inCode(m.index!, codeRanges)) continue;`. Add the
            `const codeRanges = ...` before the loop."
  gotcha: "computeCodeRanges/inCode MUST be defined BEFORE scanTokens in the file (TS function declarations
           hoist, but clean source ordering aids readability + matches the helper-near-top convention).
           Place them with the other pure helpers (near cleanToken/expandTildeAndResolve/isAbsoluteOrTilde)."

# The regression gate (append 2 sanity asserts + add a new pure-function test section)
- file: file-injector.test.mjs
  why: "1044-line zero-dependency .mjs harness. Sanity list L113-125 (13 asserts; the last is
        isAbsoluteOrTilde at L125). Direct `mod.X(...)` calls are an ESTABLISHED pattern (hasValidImageMagic
        L691-695, cleanToken L579, formatTextFileBlock L384, formatPagedDirectiveBlock L818). runCase(name,
        desc, asyncFn) tallies passed/failed; final line prints `Result: N passed, M failed.`"
  pattern: "Append 2 typeof asserts after L125. Add a new `// ── CODE-REGION DETECTION (PRD §5.6.1) — …`
            section with runCase blocks calling mod.computeCodeRanges/mod.inCode directly with literal
            strings (NO fs fixtures)."
  gotcha: "isAbsoluteOrTilde is ALREADY in the sanity list (L125) — do NOT re-add it. computeCodeRanges/
           inCode are the ONLY 2 new sanity asserts. The 52 existing cases must stay green."

# Full first-hand analysis (algorithm + offset accounting + strict-CommonMark decision + test plan)
- file: plan/003_4624515bcd82/P1M1T2S1/research/research_notes.md
  why: "§1 T1.S2-landed verification; §2 constants insertion; §3 the CRITICAL strict-CommonMark closing-fence
        finding (with PRD-vs-item-desc reconciliation); §4 the full computeCodeRanges line-walk algorithm
        with offset accounting; §5 the inCode binary search; §6 test-harness integration; §7 no-conflict
        coordination with T2.S2/T2.S3/T2.S4."

# EXTERNAL — authoritative spec for the fence/code-span rules this approximates
- url: https://spec.commonmark.org/0.30/#fenced-code-blocks
  why: "§4.5 Fenced code blocks: open = 0-3 leading spaces + (``` or ~~~) run; close = 0-3 leading spaces
        + same char run ≥ open length + followed by WHITESPACE ONLY (info string allowed only on open);
        tilde/backtick independent; unclosed → consumes to EOF. This is the reference 'approximate
        CommonMark' points at."
  critical: "The closing-fence 'followed by whitespace only' rule is the one the literal PRD/item-desc
             wording omits. T2.S1 implements the strict version (a `\\`\\`\\`foo` line does NOT close)."

- url: https://spec.commonmark.org/0.30/#code-spans
  why: "§6.1 Code spans: a span opens with N backticks and closes with EXACTLY N backticks (backreference
        \\1); longer runs contain shorter (a `` `` `` span can contain a single `` ` ``). Confirms the
        INLINE_CODE_RE backreference design."

- url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
  why: "Confirms matchAll internally clones the regex (lastIndex NOT mutated; no manual reset needed) and
        requires the `g` flag. INLINE_CODE_RE has `g` — safe to call in computeCodeRanges each invocation."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE SOURCE FILE EDITED (POST-T1.S2 ~500 lines: constants L8-25,
│                             #    isAbsoluteOrTilde L207, scanTokens L231-250 w/ skipCode stub L240,
│                             #    processTokenStream/injectFile/emitText/State/subtract all present)
├── file-injector.test.mjs    # gate (1044 lines; sanity list L113-125 [13 asserts]; EDIT: append 2
│                             #   sanity asserts after L125 + add a new pure-function test section)
├── package.json              # { "pi": { "extensions": ["file-injector.ts"] } } — untouched
├── PRD.md                    # read-only
├── README.md                 # untouched (Mode B docs are T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/
    │   ├── codebase_insertion_points.md   # ← MI-2 constant forms + helper signatures
    │   ├── system_context.md              # ← dedup/budget facts (read-only reference)
    │   └── external_deps.md               # ← NO new deps; jiti/regex facts
    ├── P1M1T1S1/PRP.md                    # ← State/subtract origin (read-only reference)
    ├── P1M1T1S2/PRP.md                    # ← the CONTRACT (isAbsoluteOrTilde + scanTokens stub)
    └── P1M1T2S1/
        ├── research/research_notes.md     # ← full algorithm + strict-CommonMark decision (this subtask)
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — add 4 constants (MD_EXTS, IMAGE_FALLBACK_TOKENS, INLINE_CODE_RE,
                          #                  FENCE_OPEN_RE) after L25; add export computeCodeRanges +
                          #                  export inCode (pure helpers, near isAbsoluteOrTilde);
                          #                  fill scanTokens skipCode stub (2 lines: codeRanges decl
                          #                  before loop + inCode check inside loop at L240).
file-injector.test.mjs    # MODIFIED — append 2 sanity asserts (computeCodeRanges, inCode) after L125;
                          #                  add a new CODE-REGION DETECTION section (~6-8 runCase blocks
                          #                  calling mod.computeCodeRanges/mod.inCode with literal strings).
# No other files. No new files. No new dependencies.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — isAbsoluteOrTilde ALREADY EXISTS (file-injector.ts L207, exported by T1.S2). Its JSDoc
//   explicitly says "T2.S1 REUSES this export (do NOT redeclare it there)." Do NOT add a second
//   isAbsoluteOrTilde. The item description lists it under "LOGIC (b)" for completeness — it is a
//   CONSUMED export, not a new one. The test sanity list already asserts it (L125) — do NOT re-add.

// CRITICAL — the scanTokens skipCode stub is at file-injector.ts L240, currently the comment:
//   `// (T2.S1 inserts the code-region exemption here when skipCode:true lands.)`
//   T2.S1 makes EXACTLY two edits to scanTokens: (1) add `const codeRanges = opts.skipCode ?
//   computeCodeRanges(text) : null;` between the `out` declaration and the `for` loop; (2) replace the
//   L240 comment with `if (codeRanges && inCode(m.index!, codeRanges)) continue;`. Do NOT touch any
//   other line of scanTokens (the token-cleanup/absTilde/resolve/dedup logic is T1.S2's, unchanged).

// CRITICAL — the closing-fence rule. PRD §5.6.1 + the item description say "a closing line = {0,3} +
//   same fenceChar repeated >= fenceLen". Taken literally, ``` ```ruby ``` (a line that is 3 backticks
//   + "ruby") would match and close. CommonMark §4.30 says a closing fence may be followed by
//   WHITESPACE ONLY. T2.S1 implements the STRICT-CommonMark rule: after stripping 0-3 leading spaces,
//   the line must START with >= fenceLen of fenceChar AND the remainder must be /^[ \t]*$/ (whitespace
//   only). This prevents a #@ immediately after an info-string fence from being wrongly treated as
//   inside code. All required unit assertions pass either way; the strict reading is safer + matches
//   the spec §5.6.1 cites. ADD A UNIT TEST that pins this (``` ```\ncode\n```foo\n#@x ``` → #@x NOT in code).

// CRITICAL — offset accounting in computeCodeRanges. `content.split("\n")` yields pieces WITHOUT the
//   newline char. The "end of closing line incl. its trailing newline" = lineStartOffset[j] +
//   lines[j].length + 1, EXCEPT the final line when content does not end in "\n" (then there is no
//   trailing newline — but content.length is the safe upper cap; use Math.min(..., content.length)).
//   Precompute lineStartOffset[i] = sum of (lines[k].length + 1) for k < i. See Implementation Blueprint.

// CRITICAL — the open-fence FIRST CHAR offset is lineStartOffset[i] (the start of the line, which for
//   a 0-3-spaces-indented fence IS the first space, which IS the first char of the fence region per
//   PRD §5.6.1 "range runs from the opening fence's first character"). For an unindented fence that's
//   the first backtick. Either way lineStartOffset[i] is correct.

// GOTCHA — "fully inside a fenced range" for inline spans means span[0] >= fr[0] && span[1] <= fr[1].
//   A span that merely OVERLAPS a fence boundary (starts before, ends inside) is KEPT (benign per the
//   approximation rationale; document as a known edge — pathological input). Do NOT try to clip spans.

// GOTCHA — ranges from computeCodeRanges are DISJOINT + sorted-by-start by construction (fenced ranges
//   never overlap; inline spans never overlap each other because matchAll is non-overlapping; inline
//   spans fully inside a fenced range are filtered out). So inCode's binary search is valid. If you
//   ever emit overlapping ranges, inCode's binary search could miss — so keep them disjoint.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step, no tsconfig, no lint, no test framework.
//   The .mjs harness imports file-injector.ts directly. jiti transpiles-on-load (no strict type-check),
//   so a type nit won't fail the gate — but a SYNTAX error or an undefined-identifier reference will
//   fail the harness import (the sanity asserts never run → process exits non-zero with a jiti/TS error).
//   computeCodeRanges/inCode/INLINE_CODE_RE/FENCE_OPEN_RE MUST all be defined before scanTokens
//   references them (TS function declarations hoist, but `const` regexes do NOT — define the regexes in
//   the constants cluster at the top, BEFORE computeCodeRanges and scanTokens). The ONLY gate is
//   `node ./file-injector.test.mjs`.

// GOTCHA — INLINE_CODE_RE has the `g` flag. matchAll clones it internally (MDN), so calling
//   content.matchAll(INLINE_CODE_RE) repeatedly across invocations of computeCodeRanges is safe (no
//   stale lastIndex). Do NOT use .exec() in a loop (that DOES need manual lastIndex reset).

// GOTCHA — JS string indices are UTF-16 code units. Backticks, newlines, and spaces are ASCII (1 code
//   unit each), so code-region offsets are safe. A surrogate-pair char inside code is 2 code units,
//   but that doesn't affect fence/code-span boundary detection. The `m.index` from FILE_INJECT_RE is
//   also UTF-16-code-unit-based, so inCode(m.index) is consistent with computeCodeRanges offsets.
```

## Implementation Blueprint

### Constants cluster (add after `READ_LIMIT` at file-injector.ts ~L25, before the blank at L26)

```ts
/** §5.6.1 — approximate-CommonMark code-region detection (the markdown import exemption, PRD §4.5 rule 3).
 *  INLINE_CODE_RE: a backtick run closed by a run of the SAME length (backreference \1), non-greedy,
 *    not followed by another backtick. `g` flag for matchAll (matchAll clones — no lastIndex reset needed).
 *  FENCE_OPEN_RE: line-anchored (use against a single line, not full text); 0-3 leading spaces then a
 *    run of >= 3 backticks or tildes. Group 1 = the fence run (char + length drive open/close matching). */
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;   // PRD §5.6.1 (exact form)
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;      // PRD §5.6.1 (exact form); apply per-line

/** §5.6 / §4.5 — a delivered file whose lowercased ext is md/markdown is an import source (consumed by
 *  the markdown branch T2.S3 adds to injectFile). Defined here so T2.S3 does not re-declare. */
const MD_EXTS = new Set(["md", "markdown"]);

/** §5.6.2 — flat fallback image token cost when resized dimensions are unavailable (raw base64 path).
 *  Derived from the 2000×2000 resize cap worst case: max(1,⌈2000/512⌉)·max(1,⌈2000/512⌉)·170 + 85 =
 *  4·4·170 + 85 = 2805. Consumed by estimateImageTokens (T2.S2). Defined here per the constants cluster. */
const IMAGE_FALLBACK_TOKENS = 2805;
```

### `computeCodeRanges` — pure, line-walk + inline scan (place near isAbsoluteOrTilde, ~L210)

```ts
/**
 * PRD §5.6.1 — compute a sorted list of [start, end) character-offset ranges that are CODE (fenced
 * blocks + inline code), approximate-CommonMark. Used by scanTokens(opts.skipCode:true) to leave `#@`
 * directives inside code verbatim (the markdown escape hatch, PRD §4.5 rule 3). PURE: no I/O, no state.
 *
 * Algorithm:
 *  1. FENCED BLOCKS — walk lines with a running char offset. A line matching FENCE_OPEN_RE opens a block
 *     (fenceChar = run[0], fenceLen = run.length). From the next line, scan for a CLOSING line: after
 *     dropping 0-3 leading spaces, it must START with >= fenceLen of the SAME fenceChar AND the remainder
 *     must be whitespace-only (/^[ \t]*$/) — this is the strict-CommonMark rule (a ` ```foo ` line does
 *     NOT close; only the OPENING fence may carry an info string). The range runs from the opening
 *     fence's first char (lineStartOffset) through the end of the closing line INCLUSIVE of its trailing
 *     newline. If NO closing fence is found, the range runs to EOF (unterminated fences consume the rest,
 *     matching CommonMark). Fences of the OTHER char inside a block are literal (do not reopen).
 *  2. INLINE CODE — run INLINE_CODE_RE over the full text; each match's full span [index, index+len)
 *     is a code range UNLESS it is FULLY inside a fenced range (span[0]>=fr[0] && span[1]<=fr[1]) —
 *     skip those so we don't double-count. (Approximate: does not model backslash escapes. Good enough
 *     to stop the common `#@file` doc pattern from importing.)
 *  3. Sort by start. Ranges are disjoint + sorted (fenced ranges don't overlap; inline spans don't
 *     overlap each other; inside-fenced spans are filtered) — so inCode can binary-search them.
 *
 * @param content the full markdown text (UTF-16 code-unit offsets, consistent with FILE_INJECT_RE m.index)
 * @returns sorted [start, end) code ranges
 */
export function computeCodeRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  const lines = content.split("\n");

  // Precompute the char offset of the START of each line (line i starts at sum of len(lines[k])+1 for k<i).
  // The +1 accounts for the "\n" that split() removed. The final line has no trailing "\n" if content
  // doesn't end in one — content.length is the safe cap for any end offset.
  const lineStart: number[] = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStart[i] = acc;
    acc += lines[i].length + 1; // +1 for the "\n"
  }

  // 1. FENCED BLOCKS — state machine over lines.
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(FENCE_OPEN_RE);
    if (!m) { i++; continue; }                  // not a fence opener → skip (offset math not needed here)
    const run = m[1];
    const fenceChar = run[0];                    // "`" or "~"
    const fenceLen = run.length;
    const openStart = lineStart[i];              // first char of the opening fence line (PRD §5.6.1)

    // scan forward from the NEXT line for the closing fence
    let j = i + 1;
    let closedEnd: number | null = null;
    while (j < lines.length) {
      const line = lines[j];
      // candidate close: drop 0-3 leading spaces, then check same-char run >= fenceLen + ws-only remainder
      const deindent = line.replace(/^ {0,3}/, "");
      if (
        deindent.length >= fenceLen &&
        deindent.slice(0, fenceLen).split("").every((c) => c === fenceChar) &&
        // the run is actually >= fenceLen of fenceChar at the start (re-check the full leading run)
        deindent.match(new RegExp("^" + escapeRegex(fenceChar) + "{" + fenceLen + ",}")) &&
        deindent.replace(new RegExp("^" + escapeRegex(fenceChar) + "+"), "").match(/^[ \t]*$/) !== null
      ) {
        // end of closing line incl. its trailing newline (cap at content.length for the final line)
        closedEnd = Math.min(lineStart[j] + lines[j].length + 1, content.length);
        break;
      }
      j++;
    }
    if (closedEnd !== null) {
      ranges.push([openStart, closedEnd]);
      i = j + 1;                                 // resume AFTER the closing line
    } else {
      ranges.push([openStart, content.length]);  // unterminated → EOF (CommonMark)
      break;                                     // nothing left to scan
    }
  }

  // 2. INLINE CODE — spans NOT fully inside any fenced range.
  for (const m of content.matchAll(INLINE_CODE_RE)) {
    const spanStart = m.index!;
    const spanEnd = spanStart + m[0].length;
    const insideFenced = ranges.some((fr) => spanStart >= fr[0] && spanEnd <= fr[1]);
    if (!insideFenced) ranges.push([spanStart, spanEnd]);
  }

  // 3. sort by start (ranges are already disjoint by construction; sort for inCode's binary search).
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

/** Escape a char for safe interpolation into a RegExp (fenceChar is "`" or "~" — backtick needs escaping
 *  inside a RegExp literal body but not inside a character class; this helper makes both safe). */
function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

> **NOTE on the close-line check:** the cascade above is deliberately belt-and-suspenders (it re-checks
> the leading run with a constructed regex AND verifies the remainder is whitespace-only). A simpler
> equivalent that is easier to read:
> ```ts
> // candidate close: 0-3 leading spaces, then >= fenceLen of fenceChar, then whitespace-only.
> const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
> if (closeRe.test(line)) { closedEnd = ...; break; }
> ```
> **Use this simpler form.** It is correct, readable, and matches the strict-CommonMark rule exactly.
> (The verbose cascade in the main listing documents each sub-condition for the reviewer; the one-line
> `closeRe.test(line)` is the recommended implementation. Pick ONE — do not duplicate.)

### `inCode` — binary search (place immediately after computeCodeRanges)

```ts
/**
 * PRD §5.6.1 — true iff `index` lies inside any code range `[start, end)` (i.e. start <= index < end).
 * Binary search over the sorted disjoint ranges from computeCodeRanges. `ranges` MUST be sorted by start
 * and disjoint (computeCodeRanges guarantees both). O(log ranges.length).
 *
 * @param index the char offset to test (e.g. a FILE_INJECT_RE m.index — the position of `#`)
 * @param ranges sorted [start, end) code ranges from computeCodeRanges
 */
export function inCode(index: number, ranges: [number, number][]): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (index < s) hi = mid - 1;
    else if (index >= e) lo = mid + 1;
    else return true; // s <= index < e
  }
  return false;
}
```

### `scanTokens` — fill the skipCode stub (file-injector.ts L231-250; 2 surgical edits)

The POST-T1.S2 body is (showing the relevant region):

```ts
export function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean },
  state: State,
): { index: number; abs: string }[] {
  const localSeen = new Set<string>();
  const out: { index: number; abs: string }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) {
    // (T2.S1 inserts the code-region exemption here when skipCode:true lands.)   ← L240, REPLACE
    const token = cleanToken(m[2]);
    // ... unchanged T1.S2 logic ...
  }
  return out;
}
```

**T2.S1 edit 1** — insert before the `for` loop (between the `out` declaration and the loop):
```ts
  // §5.6.1 — when scanning markdown content, precompute code regions once and skip `#@` matches whose
  // start index lies inside a fenced block or inline code span (the markdown escape hatch, §4.5 rule 3).
  // null when skipCode:false (top-level user-prompt scan) → inCode is never called → no behavior change.
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
```

**T2.S1 edit 2** — replace the L240 placeholder comment (first line inside the loop) with:
```ts
    if (codeRanges && inCode(m.index!, codeRanges)) continue; // §5.6.1 — skip #@ inside code
```

Leave EVERY other line of scanTokens (cleanToken, absTilde guard, resolve, dedup, localSeen, push)
UNTOUCHED — that is T1.S2's contract.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the 4 constants to file-injector.ts (after READ_LIMIT, ~L25, before the blank at L26)
  - IMPLEMENT: INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g  (BYTE-EXACT per PRD §5.6.1)
  - IMPLEMENT: FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/    (BYTE-EXACT per PRD §5.6.1)
  - IMPLEMENT: MD_EXTS = new Set(["md","markdown"])
  - IMPLEMENT: IMAGE_FALLBACK_TOKENS = 2805
  - NAMING: SCREAMING_SNAKE_CASE consts (matches PAGED_THRESHOLD/MARGIN/HEAD_CHARS/READ_LIMIT).
  - PLACEMENT: constants cluster, grouped under a new JSDoc banner citing PRD §5.6.1 / §5.6.2 / §4.5.
  - EXPORT: NO (module-scope consts; consumers are intra-module helpers T2.S2/T2.S3/computeCodeRanges).
  - GOTCHA: these `const` regexes must be defined BEFORE computeCodeRanges and scanTokens reference them
            (const does NOT hoist). The constants cluster at the top satisfies this.

Task 2: ADD a private escapeRegex(ch) helper + export computeCodeRanges + export inCode to file-injector.ts
  - IMPLEMENT: escapeRegex(ch) per the Blueprint (small; used by computeCodeRanges' close-line regex).
  - IMPLEMENT: export function computeCodeRanges(content): [number, number][] per the Blueprint — line-walk
            (precompute lineStart offsets; FENCE_OPEN_RE open; strict-CommonMark close via constructed
            closeRe.test(line); range to EOF if no close) + INLINE_CODE_RE spans not-fully-inside-fenced,
            sorted by start. Use the ONE-LINE closeRe form (recommended) — do not duplicate the cascade.
  - IMPLEMENT: export function inCode(index, ranges): boolean per the Blueprint (binary search).
  - PLACEMENT: with the other pure helpers, near isAbsoluteOrTilde (after it, ~L210). BEFORE scanTokens.
  - EXPORT: computeCodeRanges YES, inCode YES, escapeRegex NO (private).
  - DEPENDENCIES: INLINE_CODE_RE, FENCE_OPEN_RE (Task 1). NONE from State/scanTokens (pure functions).

Task 3: FILL the scanTokens skipCode stub (file-injector.ts L240 + 1 line before the loop)
  - EDIT 1: insert `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` between the `out`
            declaration and the `for` loop.
  - EDIT 2: replace the L240 placeholder comment with `if (codeRanges && inCode(m.index!, codeRanges)) continue;`.
  - PRESERVE: every other line of scanTokens (cleanToken, absTilde guard, resolve, dedup, localSeen, push).
  - DEPENDENCIES: computeCodeRanges, inCode (Task 2). isAbsoluteOrTilde is ALREADY referenced (T1.S2) —
            do NOT touch its usage.

Task 4: APPEND 2 sanity asserts to file-injector.test.mjs (after L125 isAbsoluteOrTilde, before blank L126)
  - APPEND:
      assert(typeof mod.computeCodeRanges === "function", "mod.computeCodeRanges must be a function (§5.6.1 code-region detection)");
      assert(typeof mod.inCode === "function", "mod.inCode must be a function (binary search over code ranges)");
  - PRESERVE: the 13 existing sanity asserts (L113-125, incl. isAbsoluteOrTilde at L125). Do NOT re-add
            isAbsoluteOrTilde. Do NOT touch any other harness line.

Task 5: ADD a new CODE-REGION DETECTION test section to file-injector.test.mjs
  - PLACE: a new section (e.g. after the PAGED DELIVERY section ends ~L973, before the §5.5 HANDLER NOTIFY
            section at L975, OR at the very end before the summary cleanup — either is fine). Use the
            established `// ── ... ──` separator heading.
  - IMPLEMENT: ~6-8 runCase blocks calling mod.computeCodes/mod.inCode DIRECTLY with literal strings
            (NO fs fixtures — these are pure functions). Cover:
    (a) fenced block with `#@x` inside → inCode(index of #@x, ranges) === true
    (b) inline `#@x` backtick span → inCode === true
    (c) `#@x` in prose (no code) → inCode === false (ranges empty or doesn't contain the index)
    (d) unterminated fence → range to EOF; a `#@` after the open fence → inCode === true
    (e) tilde fence does NOT close a backtick fence: ` ```\ncode\n~~~\n#@x\n``` ` → the #@x BEFORE the
        real close is INSIDE the block → inCode === true (proves other-char-is-literal)
    (f) closing fence with trailing content ` ```foo ` does NOT close (strict CommonMark): a `#@x` after
        it is NOT in code → inCode === false (pins the strict rule — see Known Gotchas)
    (g) (optional) double-backtick span containing a single backtick: ` `` `#@x` `` ` → the whole span
        (incl the inner backticks) is ONE code range → inCode(index of #@x) === true
  - PATTERN: follow the direct-call style of hasValidImageMagic (L691-695) / cleanToken (L579) —
            `const r = mod.computeCodeRanges("...literal..."); assert(mod.inCode(idx, r) === true/false, "...")`.
  - NAMING: runCase("CC1", "fenced block #@x in code", async () => {...}); CC2, CC3, ... (CC = Code-region Check).
  - GOTCHA: when computing the expected `#@x` index for an assertion, COUNT characters in the literal
            string including newlines (each \n is 1 char). Use m.index from a FILE_INJECT_RE matchAll on
            the same literal to DERIVE the index programmatically (avoids off-by-one):
              const txt = "```\n#@x\n```"; const mi = [...txt.matchAll(/(^|(?<=\W))#@(\S+)/g)][0].index;
              assert(mod.inCode(mi, mod.computeCodeRanges(txt)) === true, "...");
            This mirrors how scanTokens derives m.index — robust against literal miscounting.

Task 6: VERIFY — run the gate
  - RUN: cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs
  - EXPECT: `Result: <52 + N> passed, 0 failed.` (N = your new CC test count), exit 0.
  - CONFIRM: the 52 original cases are ALL still green (scanTokens top-level call passes skipCode:false →
            codeRanges is null → inCode never called → zero behavior change). If ANY original case flips,
            you accidentally changed scanTokens beyond the 2 documented edits — diff against T1.S2's body.
```

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    add (constants cluster, after READ_LIMIT ~L25): INLINE_CODE_RE, FENCE_OPEN_RE, MD_EXTS, IMAGE_FALLBACK_TOKENS
    add (pure helpers, near isAbsoluteOrTilde ~L210): private escapeRegex; export computeCodeRanges; export inCode
    edit (scanTokens ~L238): insert `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` before the loop
    edit (scanTokens L240): replace the placeholder comment with `if (codeRanges && inCode(m.index!, codeRanges)) continue;`
    preserve: isAbsoluteOrTilde (L207), every other scanTokens line, State/subtract/injectFile/emitText/processTokenStream,
              injectFiles, the factory, the autocomplete provider.

  - modify: file-injector.test.mjs
    append (after L125 isAbsoluteOrTilde assert, before blank L126): 2 typeof asserts (computeCodeRanges, inCode)
    add (new section, e.g. after PAGED DELIVERY ~L973 or at end): ~6-8 runCase blocks (CC1..CCn) calling
           mod.computeCodeRanges/mod.inCode directly with literal strings.
    preserve: the 13 existing sanity asserts + every existing test case + the summary/exit logic.

NO OTHER CHANGES:
  - package.json: untouched
  - README.md: untouched (Mode B docs are T3.S1)
  - no new files, no new dependencies

BEHAVIOR AT TOP LEVEL: UNCHANGED.
  - injectFiles → processTokenStream(text, ctx.cwd, { allowAbsTilde: true, skipCode: false }, ...) →
    scanTokens builds codeRanges = null → inCode never called → identical to POST-T1.S2 behavior.
  - The 52 existing cases (incl. FS1/FS2/E3 fenced-code #@ cases, which assert injected===0 via the
    trailing-backtick-isn't-trimmed path — UNAFFECTED by code-region detection since skipCode:false) stay green.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No tsc/lint configured as a gate. The .mjs harness loads file-injector.ts via jiti (Pi's loader),
# which transpiles+runs the TS on import. A SYNTAX error or an UNDEFINED-IDENTIFIER reference (e.g.
# referencing computeCodeRanges/inCode before defining them, or a malformed regex) surfaces as the
# harness failing to import — the sanity asserts never run → process exits non-zero with a jiti/TS error.

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -20
# Expected: the sanity assertions (now 15 of them: 13 + your 2) pass, then the case matrix begins.
# A jiti/TS error here means: (a) a const regex used before declaration, (b) a typo'd helper name, or
# (c) a malformed regex literal. READ the error, fix, re-run. (Common trap: defining INLINE_CODE_RE
# AFTER computeCodeRanges — const does not hoist; the regex must be in the constants cluster at the top.)
```

### Level 2: The Regression Gate (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   ... (matrix rows, incl. your new CC1..CCn rows) ...
#   ──────────────────────────────────────────────────────────────────────────
#   Result: <52 + N> passed, 0 failed.        # N = your new computeCodeRanges/inCode test count (~6-8)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL: the original 52 cases MUST all stay green. If the count is <52, a prior case regressed
# (you changed scanTokens beyond the 2 documented edits, or broke a helper signature). If it's exactly
# 52 + your N, you're done. The sanity list is now 15 (13 + 2); if it's not 15, your Task 4 append
# didn't land or you accidentally removed an existing assert.
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# FS1/FS2/E3 (fenced-code #@ in the USER PROMPT) → must stay injected===0 / verbatim.
#   These cases run with skipCode:false (top-level scan), so codeRegions is null and inCode is never
#   called — they are UNAFFECTED by T2.S1. If one flips, you changed scanTokens beyond the 2 edits.
#   Diff scanTokens against the T1.S2 PRP body line-by-line.

# case 1 / U1 (basic inject / Unicode regex) → zero-width anchor, index-based strip.
#   If FAIL: scanTokens recorded the wrong index, or the codeRanges declaration shadowed something.
#   (Unlikely — the only scanTokens change is additive: a null codeRegions + a guarded inCode call.)

# Your new CC tests (CC1..CCn) → if one FAILS, the likely cause:
#   - Off-by-one in the expected #@ index → DERIVE it programmatically via FILE_INJECT_RE matchAll (Task 5 gotcha).
#   - computeCodeRanges offset accounting → recheck lineStart precompute (+1 per "\n") and the close-end
#     Math.min(lineStart[j] + lines[j].length + 1, content.length).
#   - The strict-CommonMark close check (CC6) → ensure closeRe.test(line) uses "^ {0,3}" + fenceChar
#     + "{" + fenceLen + ",}" + "[ \t]*$" and that a ` ```foo ` line FAILS it.

# Re-run focusing on failures:
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|sanity|CC[0-9]"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2. There is no model, no network, no server, no DB, no fs for the new tests.
# Optional manual sanity (proves the detection logic visually — NOT required for the gate):
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  const txt = "prose `#@inline.ts` more\n\n```\n#@fenced.ts\n```\nend #@prose.md";
  const r = mod.computeCodeRanges(txt);
  console.log("ranges:", JSON.stringify(r));
  for (const m of txt.matchAll(/#@(\S+)/g)) {
    console.log(`#@${m[1]} at ${m.index} → inCode=${mod.inCode(m.index, r)}`);
  }
'
# Expected: the inline #@inline.ts and the fenced #@fenced.ts are inCode===true; #@prose.md is false.
# (This mirrors how scanTokens will use these helpers in T2.S3.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `<52 + N> passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error when the harness imports file-injector.ts (the 15 sanity asserts all run).
- [ ] `computeCodeRanges`, `inCode` exist as exported module-level functions; `isAbsoluteOrTilde` is NOT
      redeclared (reused from T1.S2, already at L207).
- [ ] `INLINE_CODE_RE`, `FENCE_OPEN_RE`, `MD_EXTS`, `IMAGE_FALLBACK_TOKENS` exist as module-scope `const`
      in the constants cluster (after READ_LIMIT), byte-exact per PRD §5.6.1 / §5.6.2.
- [ ] `scanTokens` has exactly the 2 documented edits (codeRanges decl + inCode check); the rest is T1.S2's,
      unchanged.

### Feature Validation

- [ ] The 52 original cases stay green (T2.S1 is additive; top-level scanTokens passes skipCode:false).
- [ ] New CC tests pass: fenced #@ in code, inline #@ in code, prose #@ NOT in code, unterminated→EOF,
      tilde-doesn't-close-backtick, closing-fence-with-trailing-content-doesn't-close (strict CommonMark).
- [ ] `computeCodeRanges` returns disjoint + sorted-by-start ranges (no overlaps).
- [ ] `inCode` correctly returns false for an index before the first range, after the last, and in a gap
      between two ranges; true only for `s <= index < e`.

### Code Quality Validation

- [ ] `computeCodeRanges`/`inCode` are EXPORTED; `escapeRegex` is NOT.
- [ ] `isAbsoluteOrTilde` is NOT redeclared (T1.S2 owns it); the sanity list does NOT duplicate its assert.
- [ ] Test sanity list has exactly 2 appended asserts (15 total); the original 13 untouched.
- [ ] The strict-CommonMark closing-fence rule is implemented (closeRe.test(line) with `[ \t]*$`) AND pinned
      by a unit test (CC6).
- [ ] Offset accounting uses lineStart precompute with +1 per "\n" and Math.min(..., content.length) on close-end.

### Documentation

- [ ] JSDoc on computeCodeRanges (approximate-CommonMark, fenced+inline, strict close rule, unterminated→EOF,
      disjoint+sorted output) and inCode (binary search, disjoint+sorted precondition). [Mode A — item §6 DOCS]
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT redeclare `isAbsoluteOrTilde`.** T1.S2 owns it (L207, exported). Reuse it. The sanity list
  already asserts it (L125) — do NOT re-add. The item description lists it for completeness; it is CONSUMED.
- ❌ **Do NOT change scanTokens beyond the 2 documented edits.** The token-cleanup/absTilde/resolve/dedup/
  localSeen/push logic is T1.S2's contract. Only add the `codeRanges` decl + the `inCode` guard.
- ❌ **Do NOT use the literal item-desc closing-fence wording without the trailing-whitespace check.** A
  ` ```foo ` line must NOT close (strict CommonMark). Implement `closeRe.test(line)` with `[ \t]*$` and
  pin it with CC6. (Either reading passes the required assertions, but the strict one is safer + matches
  the spec §5.6.1 cites.)
- ❌ **Do NOT define INLINE_CODE_RE/FENCE_OPEN_RE AFTER computeCodeRanges.** `const` does not hoist — jiti
  will throw "Cannot access 'X' before initialization" at runtime even if TS allows it lexically. Put the
  regexes in the constants cluster at the top.
- ❌ **Do NOT export `escapeRegex` or the 4 constants.** They are module-private. Only `computeCodeRanges`
  and `inCode` are new exports (the 2 sanity asserts you append).
- ❌ **Do NOT use `.exec()` on INLINE_CODE_RE in a loop.** Use `content.matchAll(INLINE_CODE_RE)` (matchAll
  clones the regex — no stale-lastIndex bug; MDN confirmed).
- ❌ **Do NOT emit overlapping ranges.** computeCodeRanges must produce disjoint + sorted ranges (inCode's
  binary search assumes this). Filter inline spans fully-inside-fenced; don't try to clip overlaps.
- ❌ **Do NOT add fs fixtures for the new CC tests.** computeCodeRanges/inCode are PURE — pass literal
  strings and derive expected #@ indices programmatically via FILE_INJECT_RE matchAll (avoids off-by-one).
- ❌ **Do NOT touch State/subtract/injectFile/emitText/processTokenStream/injectFiles/the factory/the
  autocomplete provider.** T2.S1 only adds constants + 2 helpers + fills the scanTokens stub.
- ❌ **Do NOT skip Level 2.** The 52-test gate is the authoritative check. If any original case flips, you
  changed behavior you shouldn't have — diff scanTokens against the T1.S2 PRP body.

---

## Confidence Score: 9/10

A tightly-scoped additive subtask: 4 module constants + 2 exported pure helpers + a 2-line fill of an
existing scanTokens stub, validated by ~6-8 new direct-call unit tests with no fs fixtures. The PRP
includes: the verified POST-T1.S2 starting state (exact lines for the stub + cluster + isAbsoluteOrTilde),
the byte-exact regexes, the full line-walk algorithm with offset accounting, the binary-search inCode body,
the strict-CommonMark closing-fence decision (with rationale + a pinning test), the exact 2-line scanTokens
edit, the test-harness append points + the established direct-call pattern, and the single authoritative
green gate. The -1 reserves for: (a) the offset-accounting fiddliness in computeCodeRanges (the +1-per-"\n"
and the final-line-no-trailing-newline edge — mitigated by Math.min(..., content.length) and a programmatically
derived index in the tests), and (b) the strict-CommonMark closing-fence choice being a deliberate precision
over the literal item-desc wording (documented + pinned by CC6, so it's safe, but it IS an interpretation
call the implementer must apply consistently). The implementing agent edits one source file + appends to
the test harness, then runs one command.
