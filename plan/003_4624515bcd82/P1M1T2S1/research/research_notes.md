# Research Notes — P1.M1.T2.S1: Markdown constants + code-region detection helpers

> First-hand codebase analysis + external spec research for the PRP. All line numbers verified via
> `awk` against the CURRENT committed `file-injector.ts` (POST-T1.S2 — the parallel task HAS landed:
> `isAbsoluteOrTilde`, `scanTokens` w/ skipCode stub, `processTokenStream`, `injectFile`, `emitText`,
> `interface State`, `subtract` ALL exist).

## 1. T1.S2 contract — VERIFIED LANDED in source (not just promised)

The parallel-execution note said "T1.S2 is being implemented." On inspection it is **already committed**:

| Contract element | Status | Lines |
|---|---|---|
| `interface State { blocks; images; injectedSet; remaining; count; paged }` | ✓ present | 187–196 |
| `function subtract(state, cost)` (private) | ✓ present | 198–201 |
| `export function isAbsoluteOrTilde(p)` | ✓ present + exported | 207–209 |
| `type Ctx = { cwd; getContextUsage?; model? }` | ✓ present | 211–216 |
| `export function scanTokens(text, baseDir, opts, state)` w/ **skipCode stub comment** | ✓ present + exported | 231–250 |
| `async function processTokenStream(...)` (private) | ✓ present | ~257–270 |
| `export async function injectFile(abs, state, ctx)` | ✓ present + exported | ~275–320 |
| `export function emitText(abs, content, state)` | ✓ present + exported | ~325–345 |
| `injectFiles` is a thin wrapper calling `processTokenStream` | ✓ present | ~350+ |
| Sanity list has the 4 T1.S2 asserts appended | ✓ present | 122–125 |

**Conclusion for T2.S1:** `isAbsoluteOrTilde` MUST be reused (NOT redeclared — the JSDoc at L204–206
explicitly says "T2.S1 REUSES this export"). The `scanTokens` skipCode stub lives at **L240**
(placeholder comment); T2.S1 replaces it with the code-region check.

### The exact scanTokens shape T2.S1 must modify (file-injector.ts L231–250)

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
    // (T2.S1 inserts the code-region exemption here when skipCode:true lands.)  ← L240
    const token = cleanToken(m[2]); // trim trailing punctuation (§4.3)
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;
    const abs = expandTildeAndResolve(token, baseDir);
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;
    localSeen.add(abs);
    out.push({ index: m.index!, abs });
  }
  return out;
}
```

**T2.S1 edit = two surgical changes:**
1. Before the loop (after the `out` declaration, ~L238): add `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;`
2. Inside the loop at L240 (replace the comment): `if (codeRanges && inCode(m.index!, codeRanges)) continue;`

`m.index` is the index of `#` (FILE_INJECT_RE group 1 is zero-width), so `inCode(m.index)` checks the
`#@` start position — exactly the PRD §5.6.1 semantics ("start ≥ someRange[0] && start < someRange[1]").

## 2. Constants cluster insertion point (file-injector.ts)

The top-of-file constants block (L8–25):
```
L8   FILE_INJECT_RE
L9-16 MIME_BY_EXT
L17  TRAILING_PUNCT
L18  (blank)
L19  /** §5.5 — paged-delivery budget constants … */
L20  PAGED_THRESHOLD = 0.6
L21  MARGIN = 8192
L22  HEAD_CHARS = 8192
L23  DEFAULT_WINDOW = 200000
L24  DEFAULT_RESERVE = 8192
L25  READ_LIMIT = 2000
L26  (blank)
L27  /** F3 — magic-number sniff … */
```

**Insert the 4 new T2.S1 constants after L25 (READ_LIMIT), before the blank at L26.** Keep them in a
new JSDoc-commented cluster. They are module-scope consts, NOT exported (the test asserts the
helper FUNCTIONS computeCodeRanges/inCode, not the regexes/consts).

```ts
/** §5.6.1 — approximate-CommonMark code-region detection (markdown import exemption).
 *  Two regexes: fenced-code-block openers and inline-code spans. See computeCodeRanges. */
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;   // backtick run, same-length close (PRD §5.6.1)
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;      // line-anchored; group 1 = the fence run

/** §5.6 / §4.5 — a delivered file whose ext is md/markdown is an import source. */
const MD_EXTS = new Set(["md", "markdown"]);

/** §5.6.2 — flat fallback for image token cost when dimensions are unavailable (2000×2000 worst case
 *  = max(1,⌈2000/512⌉)·max(1,⌈2000/512⌉)·170 + 85 = 4·4·170 + 85 = 2805). Owned by T2.S2 (estimateImageTokens). */
const IMAGE_FALLBACK_TOKENS = 2805;
```

**Note:** `IMAGE_FALLBACK_TOKENS` is owned by T2.S2 (estimateImageTokens) but the item description lists
it here as one of the constants cluster. T2.S2 will consume it. Defining it now in the cluster is the
documented contract; T2.S2 adds the consumer. There is NO conflict.

## 3. CRITICAL FINDING — closing-fence trailing-content rule (CommonMark §4.5)

**Researcher finding (CommonMark 0.30 §4.5):** A closing fence line may be followed ONLY by spaces/tabs.
A line like ` ```foo ` (info string) is a valid OPENING fence but NOT a valid CLOSING fence.

**The PRD §5.6.1 wording is ambiguous:** "scan for a closing line that is ` {0,3}` + the same fence
char repeated ≥ opening length." Taken literally, ` ```foo ` matches ` {0,3}` + 3 backticks and would
close — but CommonMark says it must NOT.

**Decision for the PRP:** The approximation's stated failure mode is benign either way (PRD §5.6.1 "Why
approximate is fine": a `#@` left verbatim or an unexpected import — neither corrupts data). BUT to match
the dominant CommonMark behavior AND the obvious user intent (a `#@` after ` ```ruby` on its own line is
almost certainly intended as the END of a code block, and a `#@` BEFORE the fence is prose), the cleanest
defensible rule is:

**RECOMMENDED rule for computeCodeRanges (matches the spirit of "closing line is just the fence run"):**
A line closes a fence iff it matches `/^ {0,3}(`{3,}|~{3,})[ \t]*$/` for the SAME fence char with
run length ≥ fenceLen. I.e., after the fence run, only spaces/tabs (then optional `\r`) may remain.

This is implementable either as:
- (a) A dedicated closing-fence regex `FENCE_CLOSE_RE = /^ {0,3}([`~])\1{N,}[ \t]*$/` (needs runtime N — awkward), OR
- (b) Match the candidate close line with the line-split, then post-check: same fence char + run.length >= fenceLen + remainder-after-run is whitespace-only.

Option (b) is cleanest given the existing `FENCE_OPEN_RE` only captures the prefix. The PRP specifies
option (b): walk lines; on an open match, record fenceChar + fenceLen; for subsequent lines, test
`line.replace(/^\s{0,3}/, "")` starts with ≥ fenceLen of fenceChar AND the rest is `/^[ \t]*$/`.

**HOWEVER** — the item description's literal contract says:
> "a closing line = ` {0,3}` + same fenceChar repeated >= fenceLen"

The item description is the IMMEDIATE contract. There are two defensible readings:
1. **Strict-CommonMark** (researcher rec): require trailing whitespace-only → ` ```foo ` does NOT close.
2. **Literal-item-desc** (simplest): any line whose trimmed-left prefix is ≥ fenceLen of fenceChar closes.

**PRP resolution:** Specify the STRICT-CommonMark rule (option 1) because (a) it matches the spec the
PRD §5.6.1 explicitly cites as the reference ("approximate CommonMark"), (b) it prevents the failure
mode where a `#@` immediately after an info-string fence is wrongly treated as inside code, and
(c) the added check is 1 line. Document this as a deliberate precision choice over the literal item-desc
wording, and note that either reading passes all the required unit assertions (the required assertions
don't include a trailing-content-after-close-fence case). The implementer gets the precise rule.

**Unit test that pins this behavior:** add an assertion that ` ```\ncode\n```foo\n#@x\n` → the `#@x`
(after the closing fence) is NOT in code (it's prose). This locks the strict reading.

## 4. computeCodeRanges algorithm (final design)

Walk lines with a running char offset. JS string offsets over UTF-16 code units are what FILE_INJECT_RE
and INLINE_CODE_RE indices use, so offsets are consistent (no surrogate concerns for the code-region
detection itself — backticks/newlines are ASCII).

```
ranges = []
offset = 0
i = 0
lines = content.split("\n")   // NOTE: split keeps content BETWEEN newlines; newline NOT in each piece
// To get the END-OF-CLOSING-LINE-INCL-NEWLINE offset, accumulate: each piece's length + 1 (the \n),
// except the final piece (no trailing \n if content doesn't end in \n).
```

**Fenced scan (state machine):**
```
while i < lines.length:
  line = lines[i]
  m = line.match(FENCE_OPEN_RE)   // null if not a fence-opening line
  if not currently in a fence AND m:
    run = m[1]; fenceChar = run[0]; fenceLen = run.length
    openStart = offset             // index of the first char of this line (the fence's first char or leading spaces)
    # scan forward for the close
    j = i + 1
    closed = false
    while j < lines.length:
      cline = lines[j]
      # advance offset for line j lazily (see offset accounting below)
      # test close: ^ {0,3} + fenceChar*>=fenceLen + [ \t]*$
      stripped = cline.replace(/^ {0,3}/, "")   // drop 0-3 leading spaces
      if stripped.length >= fenceLen
         AND stripped is all fenceChar for at least fenceLen (i.e. starts with run of fenceChar >= fenceLen)
         AND the remainder after that run is /^[ \t]*$/ :
        # this is the close
        closeEnd = offset_at_end_of_line_j_including_its_newline
        ranges.push([openStart, closeEnd])
        closed = true
        i = j + 1; offset = offset_after_line_j_newline; break inner
      advance offset past line j + its newline
      j++
    if not closed:
      ranges.push([openStart, content.length])   # to EOF
      i = lines.length; break   # done
  else:
    advance offset past line i + its newline
    i++
```

**Offset accounting** (the fiddly part): define a helper or precompute `lineStartOffset[i]` =
sum of (lines[k].length + 1) for k < i. Then:
- `openStart = lineStartOffset[i]`
- close line j: `lineEndIncludingNewline = lineStartOffset[j] + lines[j].length + (j === last ? 0 : 1)`
  (the final line has no trailing newline if content didn't end in `\n`; but content.length is the
  safe cap — use `Math.min(..., content.length)` to be safe).

**Inline scan (after fenced ranges known):**
```
for m of content.matchAll(INLINE_CODE_RE):
  span = [m.index, m.index + m[0].length]
  if NOT fully inside any fenced range:   # "fully inside" = span[0] >= fr[0] && span[1] <= fr[1]
    ranges.push(span)
ranges.sort((a,b) => a[0] - b[0])
return ranges
```

**"fully inside a fenced range"** — the PRD §5.6.1 says "each match's full span ... is a code range,
UNLESS it already lies inside a fenced range (skip those so we don't double-count)." A span lies inside
a fenced range iff `span[0] >= fr[0] && span[1] <= fr[1]`. Spans that merely OVERLAP a fence boundary
(start before, end inside) are kept (benign per the approximation rationale; document as a known edge).

## 5. inCode algorithm (binary search)

`ranges` is sorted by start, NON-overlapping (fenced ranges don't overlap each other by construction;
inline spans that overlap fenced ranges are filtered out; two inline spans don't overlap because
matchAll is non-overlapping). So binary search by start works:

```
function inCode(index, ranges):
  lo = 0; hi = ranges.length - 1
  while lo <= hi:
    mid = (lo+hi) >> 1
    [s, e] = ranges[mid]
    if index < s:  hi = mid - 1
    else if index >= e: lo = mid + 1
    else: return true   # s <= index < e
  return false
```

Since ranges are disjoint + sorted, the "else" (s <= index < e) is the only hit. Linear scan is also
correct (ranges is tiny — typically 0-10 ranges), but binary search matches the PRD §5.6.1 wording
("binary search over the sorted ranges") and is O(log n).

## 6. Test harness integration

**Baseline:** `node ./file-injector.test.mjs` → `Result: 52 passed, 0 failed.`

**Sanity list append** (file-injector.test.mjs, after L125 `isAbsoluteOrTilde` assert, before blank L126):
```js
assert(typeof mod.computeCodeRanges === "function", "mod.computeCodeRanges must be a function (§5.6.1 code-region detection)");
assert(typeof mod.inCode === "function", "mod.inCode must be a function (binary search over code ranges)");
```
(2 new asserts → sanity list grows from 13 to 15. `isAbsoluteOrTilde` is ALREADY in the list at L125 —
do NOT add it again.)

**New pure-function test section** — direct `mod.computeCodeRanges(...)` / `mod.inCode(...)` calls,
following the established pattern (cf. `mod.hasValidImageMagic(...)` at L691–695, `mod.cleanToken(...)`
at L579, `mod.formatTextFileBlock(...)` at L384). NO fs fixtures needed — pass literal strings. Place as
a new section between the PAGED DELIVERY section (ends ~L973) and the §5.5 HANDLER NOTIFY section
(L975–976), OR at the very end before the summary. Either is acceptable; the cleanest is a new
`// ── CODE-REGION DETECTION (PRD §5.6.1) — computeCodeRanges / inCode ─` section.

**Required assertions (from item description §5 MOCKING):**
- fenced ``` block with `#@x` inside → that `#@x` index IS in code
- inline `` `#@x` `` backtick span → in code
- `#@x` in prose → NOT in code
- unterminated fence → range to EOF (a `#@` after the open fence is in code; a `#@` before EOF beyond
  any close is in code)
- (add) closing fence with trailing content ` ```foo ` does NOT close (strict-CommonMark) → the `#@`
  after it is NOT in code

Each adds ~2-4 passed. Target: 52 + (new tests) passed, 0 failed.

## 7. Coordination boundaries (no-conflict guarantees)

| Sibling task | What it owns | T2.S1 relationship |
|---|---|---|
| T1.S1, T1.S2 | State/subtract, isAbsoluteOrTilde, scanTokens stub, injectFile/emitText/processTokenStream | T2.S1 CONSUMES: reuses isAbsoluteOrTilde; FILLS the scanTokens skipCode stub. Does NOT touch State/subtract/injectFile/emitText. |
| T2.S2 | estimateImageTokens + image/binary subtract wiring into injectFile | T2.S1 DEFINES IMAGE_FALLBACK_TOKENS (consumer is T2.S2). T2.S1 does NOT touch injectFile's image/binary branches. |
| T2.S3 | injectMarkdown (6-step) + markdown branch in injectFile | T2.S3 CONSUMES computeCodeRanges/inCode via scanTokens(opts.skipCode:true). T2.S1 does NOT write injectMarkdown. |
| T2.S4 | shared-budget case 20 + edge cases + module-surface sync | Orthogonal. |

**Critical no-conflict:** T2.S1 defines `MD_EXTS` AND `IMAGE_FALLBACK_TOKENS` even though their consumers
(T2.S3, T2.S2) are later tasks. This is per the item description's literal contract (§3a lists all 4
constants + 3 helpers). The constants sit in the cluster unused-but-defined; jiti has no "unused const"
error. The regexes (INLINE_CODE_RE, FENCE_OPEN_RE) ARE used by computeCodeRanges in T2.S1.

## 8. Validation commands (verified working)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Baseline (pre-T2.S1): 52 passed, 0 failed.
# Post-T2.S1: 52 + (new computeCodeRanges/inCode tests) passed, 0 failed.
```

No tsc/lint/build. jiti transpiles-on-load; a SYNTAX error or undefined-identifier reference fails the
import (sanity asserts never run → non-zero exit with a jiti/TS error). The 52 existing tests must stay
green (T2.S1 is ADDITIVE: new constants + new helpers + scanTokens stub filled — no existing behavior
changes since scanTokens is still only called with skipCode:false at top level).
