# Scout: `computeCodeRanges` & fenced-code-block detection logic

Source file: `/home/dustin/projects/pi-file-injector/file-injector.ts` (1115 lines, ends with a single blank line at 1115).

All line numbers below are 1-indexed and verified against the file.

---

## 1. Complete `computeCodeRanges` function body — lines 472–530

```ts
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
    const open = lines[i].match(FENCE_OPEN_RE);
    if (!open) { i++; continue; }            // not a fence opener → skip
    const run = open[1];
    const fenceChar = run[0];                  // "`" or "~"
    const fenceLen = run.length;
    const openStart = lineStart[i];            // first char of the opening fence line (PRD §5.6.1)
    // strict-CommonMark close: 0-3 leading spaces, then >= fenceLen of fenceChar, then whitespace-only.
    const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");

    // scan forward from the NEXT line for the closing fence
    let j = i + 1;
    let closedEnd: number | null = null;
    while (j < lines.length) {
      if (closeRe.test(lines[j])) {
        // end of closing line incl. its trailing newline (cap at content.length for the final line)
        closedEnd = Math.min(lineStart[j] + lines[j].length + 1, content.length);
        break;
      }
      j++;
    }
    if (closedEnd !== null) {
      ranges.push([openStart, closedEnd]);
      i = j + 1;                              // resume AFTER the closing line
    } else {
      ranges.push([openStart, content.length]); // unterminated → EOF (CommonMark)
      break;                                  // nothing left to scan
    }
  }

  // 2. INLINE CODE — spans NOT fully inside any fenced range. (inlineCodeRanges is the LINEAR-TIME
  //    replacement for the former `/(`+)([\s\S]*?)\1(?!`)/g` regex — same spans, ~O(n) regardless of
  //    backtick-run length; see its docstring. The old regex was O(n²) on a long unmatched run.)
  for (const [spanStart, spanEnd] of inlineCodeRanges(content)) {
    const insideFenced = ranges.some((fr) => spanStart >= fr[0] && spanEnd <= fr[1]);
    if (!insideFenced) ranges.push([spanStart, spanEnd]);
  }

  // 3. sort by start (ranges are already disjoint by construction; sort for inCode's binary search).
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}
```

---

## 2. Fence-related regexes/variables

**Line 47** — `INLINE_CODE_MAX_OPENER`:
```ts
const INLINE_CODE_MAX_OPENER = 1024;               // cap on opener run length (defense-in-depth; see above)
```

**Line 48** — `FENCE_OPEN_RE` (the ONLY fence-related regex literal; the close-fence regex is built dynamically per block — see §6):
```ts
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;      // PRD §5.6.1 (exact form); apply per-line
```
- Anchored at line start (`^`), 0–3 leading spaces, then a run of ≥3 backticks OR ≥3 tildes.
- Capture group 1 = the fence run; `run[0]` = fence char (`` ` `` or `~`), `run.length` = fence length. Drives the dynamic close regex.
- Note: NO trailing `$` and NO `[ \t]*$` — the opener tolerates an info string (e.g. `` ```ts ``), per CommonMark. Only the CLOSING fence requires whitespace-only remainder.

There is **no other** fence-related regex literal in the file. The dynamic close regex (`closeRe`, §6) is the only other fence pattern.

---

## 3. `escapeRegex` helper — lines 356–358

```ts
/** Escape a char for safe interpolation into a RegExp body (fenceChar is "`" or "~"). Used by
 *  computeCodeRanges' constructed close-line regex. NOT exported (internal helper). */
function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```
- NOT exported (internal). Only used by `computeCodeRanges` (line 496) to build `closeRe`.
- For valid inputs `ch` is `` ` `` or `~`; neither is a regex metacharacter, so `escapeRegex` is a no-op for them — but it guards against any future caller.

---

## 4. `inCode` function — lines 539–549

```ts
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
- Binary search over sorted disjoint `[start, end)` ranges from `computeCodeRanges`.
- Contract: `ranges` MUST be sorted by start AND disjoint (`computeCodeRanges` guarantees both via the final `ranges.sort((a, b) => a[0] - b[0])`).
- Returns `true` iff `start <= index < end` (half-open).
- Called only by `scanTokens` (line 648): `if (codeRanges && inCode(c.idx, codeRanges)) continue;`

---

## 5. EXACT line where `content.split("\n")` is called inside `computeCodeRanges`

**Line 474**:
```ts
  const lines = content.split("\n");
```

---

## 6. EXACT construction of `closeRe` (close-fence regex)

**Line 496**:
```ts
    const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
```
- Built once per fence opener, from `fenceChar` (`run[0]`, the open match's first char) and `fenceLen` (`run.length`).
- Pattern: `^ {0,3}` + `<fenceChar>{<fenceLen>,}` + `[ \t]*$`.
- Semantics: 0–3 leading spaces, then ≥ `fenceLen` of the SAME fence char, then whitespace-only remainder (strict CommonMark — a close line with an info string like `` ```foo `` does NOT close; only the opener may carry an info string).
- Applied per-line via `closeRe.test(lines[j])` at line 502.

---

## 7. ALL places in the file that do `.split("\n")`

There is exactly **ONE** occurrence in the entire file:

| Line | Code | Location |
|------|------|----------|
| **474** | `const lines = content.split("\n");` | inside `computeCodeRanges` |

A `grep` for `split(` across the whole file returns only:
- Line 474: the actual `content.split("\n")` call.
- Line 477: a COMMENT (`// The +1 accounts for the "\n" that split() removed.`) — not a call.

No other `.split("\n")` (or `.split('\n')`) exists anywhere in the file.

---

## 8. How `lineStart`, `headStartLine`, `headCompleteLineCount` are computed

### `lineStart[]` — computed inside `computeCodeRanges`, lines 478–484

```ts
  const lineStart: number[] = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStart[i] = acc;
    acc += lines[i].length + 1; // +1 for the "\n"
  }
```
- `lineStart[i]` = char offset of the first character of line `i`.
- The `+1` accounts for the `"\n"` that `split()` removed (each line is followed by exactly one newline). For the final line, if `content` doesn't end in a newline there is no trailing newline, but `content.length` is used as a safe cap at line 504 so this never over-reads.
- Used at:
  - Line 494: `const openStart = lineStart[i];` (opening fence's first char).
  - Line 504: `closedEnd = Math.min(lineStart[j] + lines[j].length + 1, content.length);` (end of closing line incl. its trailing newline).

### `headStartLine(head)` — lines 280–284 (module-private, NOT exported)

```ts
function headStartLine(head: string): number {
  let n = 0;
  for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 0x0A) n++;
  return n + 1; // 1-indexed: first line AFTER the complete lines delivered in the head
}
```
- Counts newlines (`0x0A`) in the head slice and returns `newlineCount + 1` — the 1-indexed line at which the paged directive should resume reading (i.e. the first line AFTER the complete lines delivered in the head).

### `headCompleteLineCount(head)` — lines 288–292 (module-private, NOT exported)

```ts
function headCompleteLineCount(head: string): number {
  let n = 0;
  for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 0x0A) n++;
  return n;
}
```
- Counts newlines = count of COMPLETE lines fully contained in the head slice (a line is complete iff it ends with `\n` within the head; a head ending mid-line does NOT count that partial line).

Both are called together at **line 783**:
```ts
state.blocks.push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head)));
```
- These are unrelated to `computeCodeRanges`' `lineStart[]` — they operate on the `head` slice for the paging directive, whereas `lineStart[]` is the per-line char-offset table for fenced-block detection.

---

## 9. `scanTokens` function — lines 611–648

```ts
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<{ index: number; prefixLen: number; abs: string }[]> {
  const localSeen = new Set<string>();
  const out: { index: number; prefixLen: number; abs: string }[] = [];
  // §5.6.1 — when scanning markdown content, precompute code regions once and skip `#@` matches whose
  // start index lies inside a fenced block or inline code span (the markdown escape hatch, §4.5 rule 3).
  // null when skipCode:false (top-level user-prompt scan) → inCode is never called → no behavior change.
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  // Candidate markers: `#@` always (prefixLen 2); bare `@` only when opts.bareAt (prefixLen 1). BARE_AT_RE
  // forbids a preceding `#`, so `#@file` appears once (via FILE_INJECT_RE), never twice. When bareAt is
  // absent/false, cands holds only the FILE_INJECT_RE matches in index-ascending order (matchAll yields
  // ascending), so the sort is a no-op and the per-candidate body below is byte-for-byte identical to the
  // prior single-loop form.
  const cands: { idx: number; token: string; prefixLen: number }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue; // §5.6.1 — skip markers inside code
    const token = cleanToken(c.token); // trim trailing punctuation (§4.3)
    if (!token) continue; // empty after trim => skip, leave verbatim
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue; // §4.5 — markdown: relative only
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // §4.5 — exact, then .md/.markdown (stats)
    if (!abs) continue; // nothing resolved → leave verbatim (missing/dir/non-regular)
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue; // dedup on RESOLVED abs → leave verbatim
    localSeen.add(abs);
    out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
  }
  return out;
}
```

**How it uses `computeCodeRanges`/`inCode`:**
- Line 622: `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` — computes code regions ONCE per scan, only when `skipCode` is `true`.
- Line 648: `if (codeRanges && inCode(c.idx, codeRanges)) continue;` — skips any candidate marker whose start index lies inside a code range.
- When `skipCode` is `false` (top-level user-prompt scan), `codeRanges` is `null`, so `inCode` is never called → byte-for-byte identical to a no-code-skip scan.
- `skipCode: true` is passed by the **markdown import path only** (line 849): `scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);`
- The top-level user-prompt path (`processTokenStream` → `scanTokens` at line 666) does NOT set `skipCode` to `true` (it threads through `opts` from `injectFiles`).

---

## 10. `inlineCodeRanges` function — lines 389–444

```ts
function inlineCodeRanges(content: string): [number, number][] {
  const n = content.length;
  if (n === 0) return [];

  // runEnd[i] = exclusive end of the maximal backtick run containing index i (−1 for non-backticks).
  // Built in one right-to-left pass: when s[i]==='`', extend left to the run's start and stamp [start,end).
  const runEnd = new Int32Array(n).fill(-1);
  for (let i = n - 1; i >= 0; ) {
    if (content.charCodeAt(i) !== 0x60 /* '`' */) { i--; continue; } // backtick = U+0060
    let start = i;
    while (start > 0 && content.charCodeAt(start - 1) === 0x60) start--;
    const end = i + 1; // run covers [start, end) — all backticks by construction
    for (let k = start; k < end; k++) runEnd[k] = end;
    i = start - 1;
  }

  const ranges: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (content.charCodeAt(i) !== 0x60) { i++; continue; } // not an opener → advance
    const runStart = i;
    let runLen = 0;
    while (i < n && content.charCodeAt(i) === 0x60) { runLen++; i++; } // maximal opener run

    const maxL = Math.min(runLen, INLINE_CODE_MAX_OPENER);
    let matched: [number, number] | null = null;
    for (let L = maxL; L >= 1; L--) { // opener length: greedy-then-backtrack (regex semantics)
      const contentStart = runStart + L;
      let p = contentStart;
      let found = -1;
      while (p + L <= n) {
        if (content.charCodeAt(p) !== 0x60) { p++; continue; }
        const end = runEnd[p]!;                 // end of the maximal run containing p
        // An exact-L closer (L backticks not followed by a backtick) must END at `end` — anywhere
        // earlier in the run is followed by another backtick. So the unique closer start in this
        // run is `end − L`, valid iff it lies at/after both p and contentStart (within the content).
        const closerStart = end - L;
        if (closerStart >= contentStart && closerStart >= p) {
          found = closerStart; // leftmost viable closer for this run
          break;
        }
        p = end; // this run can't host a valid closer ≥ contentStart → skip it wholesale
      }
      if (found !== -1) {
        matched = [runStart, found + L];
        break; // first (largest) L with a closer wins, mirroring the regex
      }
    }
    if (matched) {
      ranges.push(matched);
      i = matched[1]; // non-overlapping: resume after this span
    }
    // (no match → i already past the opener run; continue scanning)
  }
  return ranges;
}
```
- LINEAR-TIME replacement for the former regex `/(`+)([\s\S]*?)\1(?!`)/g` (which was O(n²) on a long unmatched backtick run).
- Returns non-overlapping leftmost `[start, end)` inline-code spans (NOT yet filtered by fenced ranges — the caller, `computeCodeRanges`, drops spans fully inside a fenced range at lines 521–523).
- NOT exported (internal helper). Only called by `computeCodeRanges` (line 521).

---

## 11. How internal functions are exported for testing

**There is NO `export { ... }` re-export block at the bottom of the file.** The file ends (line 1113–1115) with the closing of the default-export factory function `export default function (pi: ExtensionAPI) { ... }` and a trailing blank line. There is no test-export aggregation block.

**Export strategy:** functions are exported inline at their definition sites via `export function` / `export async function`. Relevant to this area:

| Function | Lines | Exported? |
|----------|-------|-----------|
| `computeCodeRanges` | 472–530 | ✅ YES (`export function`) — available for unit testing |
| `inCode` | 539–549 | ✅ YES (`export function`) — available for unit testing |
| `scanTokens` | 611–648 | ✅ YES (`export async function`) |
| `escapeRegex` | 356–358 | ❌ NO — internal helper (only used by `computeCodeRanges`) |
| `inlineCodeRanges` | 389–444 | ❌ NO — internal helper (only used by `computeCodeRanges`) |
| `headStartLine` | 280–284 | ❌ NO — internal helper (only used at line 783) |
| `headCompleteLineCount` | 288–292 | ❌ NO — internal helper (only used at line 783) |
| `FENCE_OPEN_RE` | 48 | ❌ NO — module-private `const` |
| `INLINE_CODE_MAX_OPENER` | 47 | ❌ NO — module-private `const` |

Full list of `^export ` declarations in the file (verified by grep):
- Line 63: `export function hasValidImageMagic`
- Line 90: `export function cleanToken`
- Line 100: `export function expandTildeAndResolve`
- Line 117: `export async function isRegularFile`
- Line 138: `export async function resolveImportPath`
- Line 184: `export async function readConfig`
- Line 220: `export function extOf`
- Line 229: `export function isBinary`
- Line 238: `export function formatTextFileBlock`
- Line 243: `export function formatImageBlock`
- Line 250: `export function formatBinaryBlock`
- Line 257: `export function formatEmptyImageBlock`
- Line 305: `export function formatPagedDirectiveBlock`
- Line 350: `export function isAbsoluteOrTilde`
- Line 472: `export function computeCodeRanges` ← key
- Line 539: `export function inCode` ← key
- Line 574: `export function estimateImageTokens`
- Line 611: `export async function scanTokens` ← key
- Line 689: `export async function injectFile`
- Line 752: `export function emitText`
- Line 906: `export async function injectFiles`
- Line 1024: `export default function (pi: ExtensionAPI)`

**Test files:** No `*.test.ts` or `*.spec.ts` files exist in the repo (verified by `find`). The only references to these symbols outside `file-injector.ts` are in `plan/**/tasks.json` and `.pi-subagents/artifacts/*.json` (planning docs), not test code.

---

## Architecture summary (how the pieces connect)

```
injectFiles (906)  ──top-level user prompt──► processTokenStream (654) ──► scanTokens (611)
                                                    │                          │  opts.skipCode = false (top level)
                                                    │                          │  → codeRanges = null → inCode never called
                                                    ▼                          ▼
                                               injectFile (689) ──markdown import path─► scanTokens (611)
                                                    │                          │  opts.skipCode = TRUE (line 849)
                                                    │                          ▼
                                                    │                   computeCodeRanges (472)
                                                    │                     │   ├─ content.split("\n") (474)
                                                    │                     │   ├─ lineStart[] table (478-484)
                                                    │                     │   ├─ FENCE_OPEN_RE per-line open test (489)
                                                    │                     │   ├─ dynamic closeRe per block (496)
                                                    │                     │   └─ inlineCodeRanges(content) (521) ── filters spans inside fenced ranges
                                                    │                     ▼
                                                    │                   sorted [start,end) ranges
                                                    │                     ▼
                                                    │                   inCode(idx, ranges) (539) — binary search
                                                    │                     ▼
                                                    │              skip #@ markers inside code (648)
```

### Key data-flow facts
- `computeCodeRanges` is the SOLE producer of code ranges; `inCode` is the SOLE consumer (called only from `scanTokens` line 648).
- `computeCodeRanges` calls `content.split("\n")` exactly once (line 474) and builds the `lineStart[]` char-offset table from it.
- The open-fence regex `FENCE_OPEN_RE` (line 48) is a literal; the close-fence regex `closeRe` (line 496) is constructed dynamically per fence block via `escapeRegex` (line 356).
- `inlineCodeRanges` (line 389) is independent of line-splitting — it works on raw char offsets with a `runEnd[]` precompute pass.
- Code-skip is OPT-IN via `opts.skipCode`; it is `true` ONLY on the markdown-import path (line 849). Top-level user-prompt scanning does NOT skip code.

### Risks / open questions for an implementer
- **`FENCE_OPEN_RE` has no `$` and no info-string handling**, so an opening fence line like `` ```ts `` opens a block whose info string (`ts`) is INSIDE the code range (correct), but the opener regex would also match a line that is actually `` ``` `` inside an ALREADY-open block — except the state machine (`while i < lines.length`) consumes through the close fence, so nested openers inside a block are never re-tested (the loop jumps to `j + 1` after the close). Safe as-is.
- **`closeRe` requires `[ \t]*$`** (whitespace-only remainder) — strict CommonMark. A close line with trailing non-whitespace does NOT close; the block runs to the next matching close line or EOF. This matches the documented intent.
- **`lineStart[]` `+1` assumption** assumes exactly one `"\n"` between every pair of lines. This is guaranteed by `split("\n")` semantics. If a future change splits on `\r\n` or multiple chars, the `+1` becomes wrong. The single `split("\n")` site (line 474) is the lynchpin.
- **`escapeRegex`/`inlineCodeRanges`/`headStartLine`/`headCompleteLineCount` are NOT exported** — if a bugfix needs to unit-test them directly, they must be exported (or tested indirectly via `computeCodeRanges`/`formatPagedDirectiveBlock`).

---

## Start here

Open **`file-injector.ts:472`** (`computeCodeRanges`). This is the hub: it owns the single `content.split("\n")` (line 474), the `lineStart[]` table (478–484), the `FENCE_OPEN_RE` open test (489), the dynamic `closeRe` (496), and the call to `inlineCodeRanges` (521). Any change to fenced-block detection, line splitting, or offset arithmetic flows through this function. Cross-reference with `scanTokens:622,648` to confirm how the ranges are consumed, and `inCode:539` for the binary-search contract (sorted + disjoint).
