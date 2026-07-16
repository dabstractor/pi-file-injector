# PRP — P1.M1.T1.S1 (plan/005): Add BARE_AT_RE + prefixLen + restructure scanTokens to union #@ and bare-@ matches (with unit tests)

> **Scope flag:** This is the **engine building block** for optional bare-`@` markdown imports (PRD §4.6).
> It adds `BARE_AT_RE`, an optional `bareAt` opt to `scanTokens`, a `prefixLen` field on each returned record,
> and restructures the scan loop into a union `cands` array. **Byte-for-byte identical when `bareAt` is
> absent/false.** This subtask touches ONLY `scanTokens` + adds unit tests. The consumers (processTokenStream,
> injectFiles, injectMarkdown) and `State.bareAt` are wired in P1.M2 — do NOT touch them here.

---

## Goal

**Feature Goal:** Extend `scanTokens` so that, when `opts.bareAt` is true, it ALSO matches bare-`@path` markers
(via a new `BARE_AT_RE`) alongside the existing `#@path` markers (`FILE_INJECT_RE`), returning a union of
candidate records sorted by index — each tagged with `prefixLen` (2 for `#@`, 1 for a bare `@`). The two
regexes never double-match the same `#@` (BARE_AT_RE forbids a preceding `#`). Dedup keys on the resolved abs.

**Deliverable:** Modified `file-injector.ts` (new `BARE_AT_RE` const near L8; `scanTokens` opts gains
`bareAt?`; return type gains `prefixLen`; loop restructured to a `cands` union) + modified
`file-injector.test.mjs` (6 new `scanTokens` unit tests). No consumer changes, no State changes, no guard edits.

**Success Definition:**
1. `node ./file-injector.test.mjs` → existing 92 + new 6 unit tests all PASS, exit 0.
2. `npm run typecheck` → 0 errors under `--strict`.
3. `scanTokens` accepts `opts.bareAt?` and returns `{index, prefixLen, abs}[]`; behavior is byte-for-byte
   identical when `bareAt` is absent/false.

## Why

- **Engine for bare-`@` markdown imports (§4.6).** A markdown author who opts in (via `markdownBareAtImports`
  config, wired in P1.M1.T2 + P1.M2) can write `@api.md` inside a markdown and have it imported — wiki-style.
  Today only `#@path` matches. `scanTokens` is the single chokepoint where markers are detected, so the union
  logic lands here.
- **`prefixLen` enables correct per-marker stripping later.** A bare `@` marker is 1 char; a `#@` marker is 2.
  P1.M2.T2.S1's markdown Step-4 strip will use `r.index + r.prefixLen` instead of the current hardcoded `+2`.
  Shipping `prefixLen` now (always 2 in production until P1.M2 wires bare-@) is the seam.
- **No double-match, no prose `@mentions`.** `BARE_AT_RE`'s lookbehind forbids a preceding `#` (so `#@file`
  fires once via FILE_INJECT_RE) and forbids a preceding word char (so `user@host.com`, `café@x` don't match).
- **Foundation, decoupled.** Isolating the regex + scan-union + unit tests from the config/integration wiring
  (P1.M1.T2, P1.M2) keeps each subtask independently testable and green.

## What

### User-visible behavior

- **None yet.** This subtask changes no user-facing path: production callers don't pass `bareAt` (it's optional
  and defaults to "off"), so `scanTokens` only matches `#@path` exactly as today. The bare-`@` capability is
  dormant until P1.M2 wires `opts.bareAt:true` into the markdown branch.

### Technical behavior (the contract)

- `BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu` — matches a bare `@path` at start-of-string or after a
  non-(letter/digit/underscore/`#`) char. Never matches the `@` in `#@file` (preceded by `#`) or in
  `user@host.com` (preceded by a letter).
- `scanTokens` opts gains `bareAt?: boolean`. When truthy, the scan ALSO runs `BARE_AT_RE` and unions the
  matches into a `cands` array (prefixLen 1); `FILE_INJECT_RE` matches always join (prefixLen 2). `cands` is
  sorted by index, then the EXISTING per-candidate body (code-region skip, cleanToken, allowAbsTilde,
  resolveImportPath, dedup-on-resolved-abs) runs unchanged.
- Return type: `Promise<{ index: number; prefixLen: number; abs: string }[]>`.

### Success Criteria

- [ ] `BARE_AT_RE` const exists near `FILE_INJECT_RE` (NOT exported), with the `#` exclusion property.
- [ ] `scanTokens` opts type includes `bareAt?: boolean`; return type is `Promise<{index; prefixLen; abs}[]>`.
- [ ] The loop builds a `cands` union (FILE_INJECT_RE always prefixLen 2; BARE_AT_RE when `opts.bareAt` prefixLen 1), sorts by `idx`, and emits `{index, prefixLen, abs}` per resolved candidate.
- [ ] Existing 92 tests pass byte-for-byte (bareAt absent → only FILE_INJECT_RE candidates → identical).
- [ ] `npm run typecheck` is clean (bareAt optional → no consumer cascade).
- [ ] 6 new unit tests pass (bareAt off ignores `@`; bareAt on matches `@`; no-double-match on `#@`; mid-word/Unicode `@` excluded; dedup collapses `#@x`+`@x`; code-exempt).
- [ ] NO changes to processTokenStream, injectFiles, injectMarkdown, State, the imports, or the module-surface guard.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current scanTokens body (L432), the precise diff, the verified BARE_AT_RE match/exclusion table, the
CRITICAL `bareAt`-optional decision (with the typecheck-cascade proof), the 6 TDD test specs (with exact
fixtures that already exist), and both verified gates. One source file + one test file; ~6 small regions.

### Documentation & References

```yaml
# MUST READ — the function-level delta contract for THIS plan (§1 BARE_AT_RE, §5 scanTokens engine change)
- file: plan/005_b7c78dbf73b1/architecture/codebase_delta.md
  why: "§1 pins BARE_AT_RE (recommended Unicode form + the critical # exclusion); §5 gives the target scanTokens
        signature and the exact cands-union logic. NOTE: §5 shows bareAt as REQUIRED in the FULL end-state — but
        the consumers (§6 processTokenStream, §7 injectFiles, §8 injectMarkdown) are P1.M2's job. See the
        CRITICAL DECISION below: T1.S1 MUST make bareAt OPTIONAL or typecheck cascades."
  critical: "The full-target signature has `bareAt: boolean` (required) ONLY because P1.M2 wires every call site.
             In T1.S1, make it `bareAt?: boolean` so existing call sites compile unchanged."

# MUST READ — the spec for bare-@ matching + the no-double-match invariant
- file: PRD.md
  why: "§4.6 defines bare-@ as markdown-only, opt-in, never double-matching #@; §12.19 documents BARE_AT_RE's
        (?<=[^\\w#]) / the prefixLen strip; §9 pseudocode shows the cands-union scanTokens shape."
  section: "### 4.6 Optional bare-@ markdown imports + #### 12.19 + ## 9 Algorithm (scanTokens)"

# The file you edit (the only source change)
- file: file-injector.ts
  why: "879 lines. FILE_INJECT_RE L8 (const, Unicode, PRESERVE); scanTokens L432 (exported async, the change site);
        processTokenStream L471 (private, forwards opts — DO NOT TOUCH); injectMarkdown L648 (scan call — DO NOT
        TOUCH); injectFiles L747 (processTokenStream call — DO NOT TOUCH)."
  pattern: "scanTokens reads ONLY state.injectedSet (dedup). bareAt comes via opts, not State."
  gotcha: "injectMarkdown's Step-4 strip (L685) is hardcoded `r.index + 2` and its `injectable` array (L677) is
           typed `{index,abs}[]`. Adding prefixLen to records is type-safe (subtype-assignable) and `+2` stays
           correct because all PRODUCTION records have prefixLen:2 (bareAt off). Do NOT change Step-4 here."

# The gate you also edit (append 6 unit tests; NO guard/sanity changes)
- file: file-injector.test.mjs
  why: "1753 lines. sanity list L113-130 + ASSERTED_EXPORTS L139-141 (scanTokens already asserted; BARE_AT_RE is a
        const → NOT subject to the function-only guard → NO guard edit). Existing scanTokens unit test T1.S1-7 at
        L1593 calls scanTokens WITHOUT bareAt (PROVES bareAt must be optional). runCase(n,name,async fn) harness;
        buildFixtures creates TMPDIR/api.md, a.md, b.md (use these for unit-test resolution)."
  pattern: "new runCase blocks call `await mod.scanTokens(content, TMPDIR, {allowAbsTilde:false, skipCode:<bool>,
            tryMdExt:true, bareAt:<bool>}, {blocks:[],images:[],injectedSet:new Set(),remaining:null,count:0,paged:0})`."
  gotcha: "The State literal needs NO bareAt field — scanTokens reads only injectedSet in this subtask. The existing
           T1.S1-7 State literal (no bareAt) keeps working unchanged."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict against the global pi .d.ts. Must stay 0 errors. The optional-bareAt
        choice is what guarantees this; a required bareAt would cascade type errors into P1.M2's call sites."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (+BARE_AT_RE const ~L8; scanTokens opts+return+loop L432)
├── file-injector.test.mjs    # ← EDITED (+6 scanTokens unit tests before the tail summary)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched (typecheck + test scripts present)
├── PRD.md / README.md        # read-only (README = P1.M3.T2.S1)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{codebase_delta.md, api_verification.md, system_context.md}
    └── P1.M1.T1.S1/{research/research_notes.md, PRP.md}  # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — +const BARE_AT_RE (~L8); scanTokens: opts +bareAt?; return +prefixLen; cands-union loop.
file-injector.test.mjs    # MODIFIED — +6 scanTokens unit-test runCase blocks (before tail summary). NO guard/sanity edits.
# No other files. No new files. No new exports (BARE_AT_RE is a non-exported const).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — bareAt MUST be OPTIONAL (`bareAt?: boolean`), NOT required.
//   scanTokens is EXPORTED and called by processTokenStream (forwards its own opts, typed WITHOUT bareAt),
//   injectMarkdown (literal opts WITHOUT bareAt), and indirectly injectFiles. Making bareAt required CASCADES
//   type errors into all three → gate 2 fails. The existing T1.S1-7 test (L1593) also calls scanTokens without
//   bareAt. OPTIONAL + `if (opts.bareAt)` keeps typecheck green, behavior byte-for-byte (undefined→skip), and
//   the scope boundary intact. P1.M2 wires bareAt through and MAY harden it to required later.

// CRITICAL — BARE_AT_RE's lookbehind MUST forbid a preceding '#':  (?<![\p{L}\p{N}_#])
//   so "#@file" is matched ONCE by FILE_INJECT_RE and NEVER by BARE_AT_RE (PRD §4.6 / §12.19). Verified by node
//   one-liner (see match table in research_notes.md). The "_#\p{L}\p{N}" class also excludes user@host.com and
//   café@x / 日本語@x (Unicode \p{} + u flag, mirroring the shipped FILE_INJECT_RE).

// CRITICAL — dedup keys on the RESOLVED abs, so "#@api.md" and "@api.md" in one scan collapse to ONE record
//   (whichever sorts first wins; the second is dropped via localSeen). This is why a same-path double-match is
//   INVISIBLE at the record level — the no-double-match unit test asserts the END-STATE (one record, prefixLen 2),
//   and the authoritative # exclusion is the verified regex (BARE_AT_RE is not exported, so it can't be tested
//   directly from the .mjs).

// GOTCHA — FILE_INJECT_RE is `const` (NOT exported) at L8. Add BARE_AT_RE the same way: `const BARE_AT_RE = …`
//   (NOT exported). The COMPLETENESS guard filters `typeof mod[k]==="function"`, so a const is never flagged.
//   → NO sanity-list edit, NO ASSERTED_EXPORTS edit for this subtask.

// GOTCHA — matchAll always sets m.index (the (^|(?<!…)) anchor is zero-width but still positions the match).
//   `m.index!` (non-null assertion) is correct for BOTH regexes, matching the existing FILE_INJECT_RE usage.

// GOTCHA — the cands sort is a NO-OP when bareAt is off (matchAll already yields index-ascending), so the
//   restructure is behaviorally identical to today's single-loop form when bareAt:false. That is the
//   byte-for-byte guarantee.

// LIBRARY — BARE_AT_RE uses \p{L}\p{N} Unicode property escapes + the `u` flag (same as FILE_INJECT_RE). Node 22+
//   supports these natively (engines.node >= 22.19.0 per the pi package). No polyfill.
```

## Implementation Blueprint

### Data models and structure

No new data models. The change is to `scanTokens`' opt + return shapes and its loop. The `prefixLen` field is
the new piece of per-record data:

```ts
// candidate marker gathered from the two regexes
type Cand = { idx: number; token: string; prefixLen: number };   // prefixLen 2 for #@, 1 for bare @

// emitted record (return element)
type Record = { index: number; prefixLen: number; abs: string };
```

### Implementation Patterns & Key Details

```ts
// === BARE_AT_RE — add near FILE_INJECT_RE (L8), NOT exported ===
// PRD §4.6 — markdown opt-in bare-"@" imports. The lookbehind forbids a preceding '#' (so "#@file" matches
// once via FILE_INJECT_RE, never here) AND a preceding word char (so user@host.com / café@x / 日本語@x don't
// match). Unicode \p{} classes + `u` flag mirror the shipped FILE_INJECT_RE for consistency. (PRD §4.6 literal
// /(^|(?<=[^\w#]))@(\S+)/g is ASCII-equivalent and also acceptable; this Unicode form is the recommendation.)
const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;

// === scanTokens (L432) — opts +bareAt? (OPTIONAL); return +prefixLen; cands union ===
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },  // bareAt OPTIONAL
  state: State,
): Promise<{ index: number; prefixLen: number; abs: string }[]> {                            // + prefixLen
  const localSeen = new Set<string>();
  const out: { index: number; prefixLen: number; abs: string }[] = [];
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  // candidate markers: "#@" always (prefixLen 2); bare "@" only when opts.bareAt (prefixLen 1).
  // BARE_AT_RE forbids a preceding "#", so "#@file" appears once, not twice.
  const cands: { idx: number; token: string; prefixLen: number }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue;            // §5.6.1 — code is exempt
    const token = cleanToken(c.token);                                // §4.3 trailing-punct trim
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;    // §4.5 — markdown relative only
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // §4.5 exact→.md/.markdown (stats)
    if (!abs) continue;                                               // nothing resolved → leave verbatim
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;   // dedup on RESOLVED abs
    localSeen.add(abs);
    out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
  }
  return out;
}
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - add (~L8, after FILE_INJECT_RE): const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;   # NOT exported, + comment
  - change (L432 scanTokens): opts +bareAt? (OPTIONAL); return +prefixLen; loop → cands union (FILE_INJECT_RE always prefixLen 2;
    BARE_AT_RE when opts.bareAt prefixLen 1); sort by idx; emit {index, prefixLen, abs}. Per-candidate body UNCHANGED.
  - update (L432 scanTokens JSDoc): document bareAt opt + prefixLen (2 for #@, 1 for bare @); note markdown-only / opt-in / no-double-match.
  - UNCHANGED: FILE_INJECT_RE; processTokenStream (L471); injectMarkdown (L640-690, incl. L648 scan call + L685 +2 strip);
    injectFiles (L688+); State; imports; default factory; autocomplete; every helper.

FILE_EDITS (file-injector.test.mjs):
  - add (before the tail "Summary" block): 6 runCase blocks unit-testing scanTokens directly (Task 6).
  - NO edits to: sanity list (L113-130), ASSERTED_EXPORTS (L139-141), completeness guard, buildFixtures, existing cases.

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files. NO new exports.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD const BARE_AT_RE to file-injector.ts (~L8, right after FILE_INJECT_RE)
  - IMPLEMENT: const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
  - COMMENT: cite PRD §4.6; note the Unicode recommendation (mirrors FILE_INJECT_RE); note the CRITICAL # exclusion
            (so #@file matches once) and the word-char exclusion (user@host.com / Unicode).
  - EXPORT: NO (const, mirroring FILE_INJECT_RE). → NO guard/sanity edit.

Task 2: RESTRUCTURE scanTokens (L432) — opts +bareAt? + return +prefixLen + cands union
  - CHANGE opts type: add `bareAt?: boolean` (OPTIONAL — see CRITICAL DECISION).
  - CHANGE return type: Promise<{ index: number; prefixLen: number; abs: string }[]>.
  - REPLACE the single `for (const m of text.matchAll(FILE_INJECT_RE))` loop with the cands-union form
    (see Implementation Patterns): push FILE_INJECT_RE matches (prefixLen 2); if opts.bareAt push BARE_AT_RE
    matches (prefixLen 1); sort by idx; loop cands running the EXISTING per-candidate body (code-range skip,
    cleanToken, allowAbsTilde, resolveImportPath, dedup-on-resolved-abs); emit {index:c.idx, prefixLen:c.prefixLen, abs}.
  - PRESERVE: localSeen/injectedSet dedup; the `!` on m.index (valid for both regexes); computeCodeRanges/inCode skip.
  - DO NOT touch: processTokenStream, injectMarkdown, injectFiles, State.
  - UPDATE JSDoc (bareAt opt + prefixLen; markdown-only/opt-in/no-double-match).

Task 3 (TDD — item §5): ADD 6 scanTokens unit tests to file-injector.test.mjs (before the tail Summary)
  - Use state = { blocks:[], images:[], injectedSet:new Set(), remaining:null, count:0, paged:0 } (NO bareAt field;
    scanTokens reads only injectedSet). Fixtures TMPDIR/api.md, a.md, b.md already exist (buildFixtures).
  - (a) bareAt:false, "Review @api.md here", {allowAbsTilde:false,skipCode:false,tryMdExt:true,bareAt:false} → []
        (no #@; bare-@ not scanned).
  - (b) bareAt:true, "@api.md and #@b.md", {allowAbsTilde:false,skipCode:false,tryMdExt:true,bareAt:true}
        → 2 records: {index:0,prefixLen:1,abs:<api.md>} and {index:<#>,prefixLen:2,abs:<b.md>}.
        Assert: length===2; one record prefixLen===1 with abs api.md; one record prefixLen===2 with abs b.md.
  - (c) no-double-match: bareAt:true, "#@a.md", same opts → EXACTLY ONE record {index:0,prefixLen:2,abs:<a.md>}.
        (Assert length===1 && records[0].prefixLen===2 && records[0].index===0. NOTE in a comment: dedup-on-
        resolved-abs masks a same-path double at the record level; the # exclusion is verified by the regex.)
  - (d) bareAt:true, "email user@host.com", same opts → [] (mid-word @ excluded; nothing resolves).
  - (e) dedup: bareAt:true, "#@api.md @api.md", same opts → ONE record {index:0,prefixLen:2,abs:<api.md>}
        (both resolve to api.md; second dropped via localSeen).
  - (f) code-exempt: bareAt:true, skipCode:true, "```\n@api.md\n```", {allowAbsTilde:false,skipCode:true,tryMdExt:true,bareAt:true}
        → [] (@api.md inside a fenced block → inCode → skipped).
  - NAMING: runCase("T1.S1-<n>" or a descriptive label, "scanTokens bare-@ …", async () => { …asserts… }).
  - PLACEMENT: append before the tail "10. Summary" block (mirror how prior T1.S1-* unit tests sit).

Task 4: VERIFY gates (no code change)
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → existing 92 + new 6 all PASS, exit 0.
  - Confirm NO changes leaked into processTokenStream/injectMarkdown/injectFiles/State/imports/guard.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails with "Property 'bareAt' is missing in type ..." at processTokenStream/injectMarkdown/injectFiles,
# you made bareAt REQUIRED — change it to `bareAt?: boolean` (the CRITICAL DECISION). A required bareAt cascades
# type errors into P1.M2's call sites; optional keeps them green.
```

### Level 2: The Regression Gate (existing 92 must stay byte-for-byte green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: all 92 existing cases PASS (cases 1-14, E1-E4, G1-G3, H1, M1, F1/F1b/F1c/F1d, F2, FS1-FS3, F3a/b,
#           F5, F4, U1, A1, DUP1-3, PD1-8, PN1-4, CC*, EIT*, BG*, 15-20, MD1, MD2, 21-24, EDG-1..4, prior
#           T1.S1-1..7 resolveImportPath/scanTokens-Promise unit tests) PLUS the 6 new bare-@ unit tests.
#           Final line: "Result: N passed, 0 failed." (N = 92 + 6 = 98), exit 0.
# If ANY existing case flips to FAIL, the restructure changed behavior when bareAt is off — re-check that
# cands only gets FILE_INJECT_RE matches and the sort is a no-op (matchAll is already index-ascending).
```

### Level 3: Targeted TDD verification (the 6 new unit tests)

```bash
node ./file-injector.test.mjs 2>&1 | grep -iE "bare-@|bareAt|no-double|prefixLen|dedup|code-exempt|scanTokens"
# Confirm all 6 new runCase blocks print ✓. If a case fails:
#  - (a) returns a record → bareAt is being treated as on when false, OR BARE_AT_RE ran unconditionally.
#  - (b) missing a prefixLen → the cands push used the wrong prefixLen, or BARE_AT_RE/FILE_INJECT_RE swapped.
#  - (c) two records → BARE_AT_RE matched the @ in #@ (lookbehind missing the # exclusion).
#  - (d) a record → BARE_AT_RE matched mid-word (lookbehind missing \p{L}\p{N} or the u flag).
#  - (e) two records → dedup not keyed on resolved abs (regression of the resolveImportPath dedup).
#  - (f) a record → inCode/codeRanges not applied to bare-@ candidates.
```

### Level 4: Regex sanity (independent of the unit tests — BARE_AT_RE is not exported)

```bash
# Quick authoritative check that BARE_AT_RE excludes #@ and mid-word/Unicode @ (run ad hoc; not part of the gate):
node -e 'const R=/(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu; for(const s of ["#@file","@api.md","user@host.com","café@x","日本語@x"]){const a=[...s.matchAll(R)];console.log(JSON.stringify(s),"=>",JSON.stringify(a.map(m=>m.index)));}'
# Expected: #@file => []; @api.md => [0]; user@host.com => []; café@x => []; 日本語@x => [].
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → existing 92 + new 6 unit tests all PASS, exit 0.
- [ ] `bareAt` is OPTIONAL (`bareAt?: boolean`) — required would cascade typecheck into P1.M2's call sites.
- [ ] `BARE_AT_RE` is a non-exported const; NO module-surface guard / sanity-list edit.

### Feature Validation (behavior)

- [ ] `bareAt` absent/false → scanTokens matches only `#@` (byte-for-byte identical; existing 92 green).
- [ ] `bareAt:true` → scanTokens ALSO matches bare `@path` records with prefixLen 1.
- [ ] `#@path` never double-matches (BARE_AT_RE excludes a preceding `#`); record has prefixLen 2.
- [ ] `user@host.com` / `café@x` / `日本語@x` excluded (Unicode word-char lookbehind + u flag).
- [ ] `#@api.md` + `@api.md` in one scan collapse to ONE record (dedup on resolved abs).
- [ ] bare `@path` inside a fenced block with skipCode:true is exempt (inCode).

### Code Quality Validation

- [ ] FILE_INJECT_RE UNCHANGED (Unicode, PRESERVE — do not revert to the PRD §4.2 (?<=\W) form).
- [ ] processTokenStream, injectMarkdown, injectFiles, State, imports UNCHANGED (P1.M2's scope).
- [ ] injectMarkdown Step-4 `+2` UNCHANGED (correct because production records have prefixLen:2; P1.M2.T2.S1 changes it to `+r.prefixLen`).
- [ ] cands sort is a no-op when bareAt off (byte-for-byte guarantee).
- [ ] JSDoc on scanTokens documents bareAt opt + prefixLen.

### Documentation

- [ ] scanTokens JSDoc updated (bareAt opt; prefixLen=2 for #@, 1 for bare @; markdown-only/opt-in; no-double-match).
- [ ] BARE_AT_RE has a comment citing PRD §4.6 + the Unicode recommendation + the critical # exclusion.
- [ ] NO README change (Mode B = P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT make `bareAt` REQUIRED.** It cascades typecheck errors into processTokenStream/injectMarkdown/injectFiles
  (P1.M2's scope) and breaks the existing T1.S1-7 test's call shape. Use `bareAt?: boolean` + `if (opts.bareAt)`.
- ❌ **Do NOT touch the consumers.** processTokenStream (L471), injectMarkdown (L640-690), injectFiles (L688+),
  State, and the imports are P1.M2's wiring job. T1.S1 changes ONLY scanTokens + adds tests.
- ❌ **Do NOT revert FILE_INJECT_RE.** The shipped Unicode form `(?<![\p{L}\p{N}_])` is an intentional improvement
  over the PRD §4.2 `(?<=\W)` form — preserve it. BARE_AT_RE mirrors it (adds `#` to the negated class).
- ❌ **Do NOT forget the `#` in BARE_AT_RE's lookbehind.** Without it, `#@file`'s `@` matches BARE_AT_RE too
  (double candidate). The exclusion `(?<![\p{L}\p{N}_#])` is load-bearing for the no-double-match invariant.
- ❌ **Do NOT change injectMarkdown's Step-4 `+2`.** It stays `+2` here (all production records have prefixLen:2
  since bareAt is off). P1.M2.T2.S1 will change it to `+r.prefixLen` once bare-@ is wired into markdown.
- ❌ **Do NOT add BARE_AT_RE to the module-surface guard or sanity list.** It's a non-exported const; the
  completeness guard filters functions only. Adding it would be wrong/no-op; scanTokens is already asserted.
- ❌ **Do NOT key dedup on the raw token or prefixLen.** Dedup keys on the RESOLVED abs (so `#@api.md` and
  `@api.md` collapse) — preserve the existing `state.injectedSet.has(abs) || localSeen.has(abs)` check.
- ❌ **Do NOT ship the config / integration / docs here.** readConfig + FileInjectorConfig (P1.M1.T2.S1),
  State.bareAt + factory session_start (P1.M2.T1.S1), injectMarkdown bare-@ wiring (P1.M2.T2.S1),
  README (P1.M3.T2.S1) are all separate subtasks.

---

## Confidence Score: 9/10

The change is small and fully specified: one new const (BARE_AT_RE, verified by node one-liner), one
opt-field added (optional, to avoid the typecheck cascade), one record field added (prefixLen, type-safe via
subtype assignability), and a loop restructure (cands union + sort, a no-op when bareAt off). The architecture
delta §1/§5 give the exact target; the gates (typecheck + 92-test suite) are green today and the
non-regression is proven by tracing that cands-without-bareAt == the current single-loop form. The -1 reserves
for the `bareAt`-optional-vs-required trap (easy to get wrong, instantly caught by typecheck) and the
no-double-match test's dedup-masking nuance (documented; the regex is independently verified). One source file
+ one test file; the implementing agent re-runs two commands.
