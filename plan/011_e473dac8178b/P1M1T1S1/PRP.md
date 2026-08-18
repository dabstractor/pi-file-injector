# PRP — P1.M1.T1.S1 (plan/011): LR-1 — run the §5.5 inline-vs-paged decision on the slice

> **Scope flag:** This closes the **LR-1 gap** (PRD §17.5): the `emitText` RANGE branch injects the slice whole
> **unconditionally** today, so a typo'd end (`#@huge.log:1-999999`) delivers the full ~2 MB inline even under a
> budget that pages the whole file — silently disabling the overflow safety valve. LR-1: the slice runs the SAME
> §5.5 decision as a whole file; a paged slice's directive resumes in **FILE coordinates** (`startLine + headLines`).
> **Byte-identical when `remaining === null`** → LINE-1…6 stay green. Scope = S1 ONLY. LR-5 = S2; quadruple
> unification + JSDoc = S3; LR-2/3/4 = T2; formal gates = P1.M2; README = P1.M2.T2.

---

## Goal

**Feature Goal:** Make the `emitText` range branch run the §5.5 inline-vs-paged decision on the **slice**: fits
(or budget unknown) → whole; trips `PAGED_THRESHOLD·remaining` → sub-head guard on the slice length → else page
the slice (head block + directive), with the directive's resume offset in **file coordinates** so the model's
`read` continues at the correct absolute line; a paged slice bumps `state.paged` (surfacing in the existing
`N whole, M paged` notify).

**Deliverable:** Modified `file-injector.ts` (the L1301-1314 range branch becomes a full §5.5 decision; the
L1301 comment replaced — Mode A) + modified `file-injector.test.mjs` (+a big markdown fixture + 2 TDD tests: the
LINE-8 shape and a markdown ranged paged case; 172 → 174).

**Success Definition:**
1. TDD: the LINE-8-shape test is RED on the current code (slice delivered whole, no paged detail), GREEN after.
2. `node ./file-injector.test.mjs` → 174 passed (172 + 2), incl. LINE-1…6 unchanged; `relative-imports` 38 + `import-behavior` 23.
3. `npm run typecheck` → 0 errors under `--strict`.
4. `remaining === null` → the slice path is byte-identical to today (whole push, `range: rangeSuffix`, `subtract(fileCost)`).
5. Tight budget + big slice → `kind:"paged"`, head + directive with `offset:${startLine + headLines}`, `state.paged` counts it.

## Why

- **A bounded selection must degrade exactly like a whole-file token.** "A range is a deliberate extract" justifies
  not forcing the model to page *past* the range end — it does not justify suspending overflow protection *within*
  the range. Verified gap: under PAGED_FIX (remaining 23,616), `#@huge.log` pages correctly, but `#@huge.log:1-999999`
  delivers ~2 MB inline (~500K estimated tokens — 20× the window). A typo'd end value silently disables the safety
  valve. PRD §17.5 makes this normative (LR-1).
- **File-coordinate resume is correctness, not polish.** For a slice starting at line `startLine`, the head's
  complete lines map back to absolute file lines: `resumeLine = startLine + headLines`. A slice-relative offset
  would send the model's `read` to the wrong line (e.g. a slice `:100-999999` resuming at "line 2001" of a file
  whose head ended at slice-line 2000 → the model would skip ~100 lines).
- **Markdown gets it for free (assert it).** `injectMarkdown` passes the FULL content + range to `emitText`, which
  re-slices — so ranged markdown tokens flow through the same branch automatically. One tight-budget markdown
  ranged case pins that.

## What

### User-visible behavior

- Under a tight budget, a ranged token whose slice exceeds the budget now pages (head + `read` directive) instead
  of silently dumping the whole slice inline. The notify correctly reports `N whole, M paged` (a paged slice counts).
- With no budget info (the common `remaining === null` path) — or when the slice fits — behavior is unchanged.

### Technical behavior (the contract)

- The range branch computes `fileCost = Math.ceil(slice.length/4)` and decides exactly like the whole-file path:
  `remaining === null || fileCost <= PAGED_THRESHOLD * remaining` → whole; else `slice.length <= HEAD_CHARS` →
  sub-head guard → whole; else page: `head = headSlice(slice)`, `headLines = headCompleteLineCount(head)`,
  `resumeLine = startLine + headLines`, push head block + `formatPagedDirectiveBlock(abs, slice.length, resumeLine,
  headLines)`, detail `{path, kind:"paged", chars: slice.length, range: `:${resumeLine}-`, pagedHeadLines: headLines,
  directive: extractDirectiveInner(directiveBlock)}`, `state.paged++`, `subtract(Math.ceil(HEAD_CHARS/4))`.
- The whole-slice detail keeps `range: rangeSuffix` (the REQUESTED range — LR-5 clamping is S2, not here).

### Success Criteria

- [ ] The L1301-1314 range branch runs the full §5.5 decision (inline / sub-head guard / paged) with `return;` retained.
- [ ] The paged-slice resume is `startLine + headLines` (FILE coordinates); the detail is `kind:"paged"` with `:${resumeLine}-`.
- [ ] `state.paged++` + `subtract(Math.ceil(HEAD_CHARS/4))` in the paged path (matches the whole-file paged branch).
- [ ] `remaining === null` → byte-identical to today (LINE-1…6 green unchanged).
- [ ] The L1301 comment replaced (Mode A); the emitText JSDoc NOT rewritten (S3 owns it).
- [ ] +2 tests (LINE-8 shape + markdown ranged paged) RED-first, then green; no new exports.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim current range branch, the verbatim replacement (a full §5.5 decision mirroring the whole-file branch),
the exact helpers to reuse (all existing), the file-coordinate math, the fixtures with the threshold arithmetic,
the 2 test specs (with the expected-value computations), and the byte-identical proof. One branch rewrite + one
comment + one fixture + two tests.

### Documentation & References

```yaml
# MUST READ — the LR-1 contract + the file-coordinate resume rule
- file: PRD.md
  why: "§17.5 (Budget & paging on slices — LR-1) is normative: fileCost on the SLICE; the identical decision;
        resumeLine = startLine + complete-lines-in-slice-head (file coordinates); the sub-head guard applies to
        the slice; a paged slice counts in state.paged and the notify. §17.10 registers the verified gap.
        §12.26 notes the S3 unification (not S1)."
  section: "## 5. Budget & paging on slices — LR-1 + ## 10. Requirement & gap register + #12.26"
  critical: "§5: 'resumeLine = startLine + complete-lines-in-slice-head — so the model's read continues at the
             correct absolute line of the original file.' And the sub-head guard applies to the SLICE length."

# MUST READ — the exact line-level map of the battleground
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "§emitText maps L1303-1312 (the range branch to rewrite — incl. the LR-5 gap at L1306 which S1 must NOT
        touch), L1315-1347 (the whole-file decision to mirror), L1344-1347 (resumeLine — 'for slices this becomes
        startLine + headLines'). Pins every helper + the notify interplay (state.paged already feeds L1700)."
  critical: "The range branch's rangeSuffix (L1306) comes from the REQUESTED lines — that's the LR-5 gap owned by
             S2. S1 keeps rangeSuffix verbatim in the whole-slice detail and uses `:${resumeLine}-` only in the
             paged detail."

# The file you edit (ONE branch + ONE comment)
- file: file-injector.ts
  why: "emitText L1299-1356. The range branch L1301-1314 (the edit site) currently: slice → rangeSuffix → whole
        push + detail(range: rangeSuffix) + subtract + return. The whole-file decision L1316-1356 is the pattern
        to mirror (inline / sub-head guard / paged with the exact push shape at L1351-1355). Constants L88/L90.
        Helpers: sliceLines L183 (exported), headSlice L380, headCompleteLineCount L394, formatPagedDirectiveBlock
        L411, extractDirectiveInner L419. FileDetail.directive L545."
  pattern: "Copy the whole-file branch's structure verbatim into the range branch, substituting the FILE-coordinate
            resume (startLine + headLines) for the whole-file (headLines + 1) and adding range: rangeSuffix to the
            whole-slice detail pushes."
  gotcha: "When startLine === 1, startLine + headLines === headLines + 1 — the whole-file formula is the startLine=1
           special case. Keep the subtract as Math.ceil(HEAD_CHARS/4) (NOT head.length — matches L1355)."

# The gate you also edit (+fixture +2 tests)
- file: file-injector.test.mjs
  why: "172 baseline. PAGED_FIX L415-419 (remaining = 50000-10000-8192-8192 = 23616; threshold 0.6×23616 ≈ 14170).
        HUGE L360 + HUGE_LOG_CONTENT (~2 MB ASCII) L339. LINE-1…6 at L2969-3036 (use FIX = no budget → the
        byte-identical path). runCase(n, name, async fn) harness; existing PD* tests show the tight-budget style."
  pattern: "Compute the expected headLines IN THE TEST from the fixture content: (CONTENT.slice(0, 8192).match(/\\n/g)||[]).length
            (ASCII → headSlice is exact), resumeLine = 1 + headLines for a :1-… range. Assert kind/range/pagedHeadLines/
            paged/offset presence — the existing PD-test style."
  gotcha: "LINE-8 is FORMALIZED in P1.M2.T1.S2 — write it now (TDD, RED first) with the LINE-8 name; it becomes the
           formal gate there. The markdown ranged test needs a NEW big .md fixture (~120k chars, no imports)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (emitText range branch L1301-1314 → full §5.5 decision; L1301 comment)
├── file-injector.test.mjs    # ← EDITED (+BIGMD fixture in buildFixtures; +LINE-8 + markdown-ranged-paged tests after LINE-6)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
└── plan/011_e473dac8178b/
    ├── architecture/{code_map.md, system_context.md, external_deps.md}
    └── P1.M1.T1.S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — the range branch runs the §5.5 decision; file-coordinate resume; paged detail; state.paged++; Mode-A comment.
file-injector.test.mjs    # MODIFIED — +BIGMD/BIGMD_CONTENT fixture (buildFixtures, ~120k chars, no imports);
                          #                  +runCase("LINE-8", …) + a markdown-ranged-paged runCase after LINE-6. 172 → 174.
# No other files. No new exports. No new imports (reuses sliceLines/headSlice/headCompleteLineCount/format*/extractDirectiveInner/subtract).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — byte-identical when remaining === null. The new decision's first condition
//   (state.remaining === null) is TRUE under the FIX fixture (no getContextUsage) → the whole-slice push
//   (same block, same detail incl. range: rangeSuffix, same subtract(fileCost)) → LINE-1…6 stay green BY
//   CONSTRUCTION. The ONLY behavior change: tight budget + slice > threshold + slice > HEAD_CHARS → pages.

// CRITICAL — FILE-coordinate resume: resumeLine = startLine + headLines (NOT headLines + 1). For startLine=1
//   they coincide (the whole-file formula is the startLine=1 case); for any other start they differ — a slice
//   :100-999999 resuming at "2001" would skip ~100 real lines. PRD §17.5 pins this.

// CRITICAL — do NOT touch rangeSuffix (L1306) beyond reusing it in the whole-slice detail pushes. It comes from
//   the REQUESTED lines — clamping it to the delivered range is LR-5 (S2). The PAGED detail uses `:${resumeLine}-`
//   (the paged-resume display), NOT rangeSuffix.

// CRITICAL — do NOT unify the quadruple. S1 intentionally accepts a temporary 4th copy of the
//   cost/lines/push/subtract pattern; the unification + the full emitText JSDoc rewrite are S3 (the task tree
//   splits the PRD §17.10 code-quality note into S3). Unifying here is scope creep that risks S3's contract.

// GOTCHA — subtract stays Math.ceil(HEAD_CHARS/4) in the paged path (the whole-file paged branch L1355 uses
//   HEAD_CHARS, not head.length). Keep them identical.

// GOTCHA — the paged path pushes TWO blocks (head + directive) and ONE detail (kind:"paged"). The whole-file
//   paged branch (L1351-1355) is the exact shape to copy, including directive: extractDirectiveInner(directiveBlock)
//   and state.paged++ BEFORE subtract.

// GOTCHA — markdown ranged tokens: injectMarkdown passes (abs, FULL content, state, ctx, startLine, endLine) to
//   emitText, which re-slices at the top of the range branch → LR-1 covers markdown automatically. The test needs
//   a big .md fixture (huge.log is not markdown) — ~120,000 chars (fileCost 30,000 > 14,170 threshold; length
//   > 8192 → paged), NO imports (keep the test about paging, not scanning).

// LIBRARY — huge.log/BIGMD are ASCII → headSlice never trims a surrogate (head.length === 8192 exactly), so the
//   test's expected headLines = newlines in CONTENT.slice(0, 8192) is exact. PAGED_FIX arithmetic: remaining =
//   50000 − 10000 (tokens) − 8192 (reserve) − 8192 (MARGIN) = 23616; threshold = 0.6 × 23616 ≈ 14169.6.
```

## Implementation Blueprint

### Data models and structure

No model change. `FileDetail` already has `kind: "paged"`, `range?`, `pagedHeadLines?`, `directive?` (L531-545).
`emitText(abs, content, state, startLine?, endLine?): void` signature unchanged. The change is internal to the
range branch.

### Implementation Patterns & Key Details

```ts
// === emitText range branch (L1301-1314) — BEFORE (unconditional whole) → AFTER (full §5.5 decision) ===

// AFTER (mirror the whole-file branch; FILE-coordinate resume; rangeSuffix kept for the whole paths):
//   (replace the L1301 comment too — see Task 3)
  let rangeSuffix: string | undefined;
  if (startLine !== undefined) {
    const end = endLine ?? startLine;
    content = sliceLines(content, startLine, end);
    rangeSuffix = startLine === end ? `:${startLine}` : `:${startLine}-${end}`;
    const fileCost = Math.ceil(content.length / 4);
    const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1;
    if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
      // fits (or budget unknown, O-1) → slice whole — byte-identical to the old unconditional push
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
      subtract(state, fileCost);
    } else if (content.length <= HEAD_CHARS) {
      // §5.5 sub-head guard — applied to the SLICE length (a slice that fits HEAD_CHARS pages nothing)
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
      subtract(state, fileCost);
    } else {
      // LR-1 — page the slice: head + directive; the resume offset is in FILE coordinates
      // (startLine + complete-lines-in-head) so the model's read continues at the correct absolute line.
      const head = headSlice(content);
      const headLines = headCompleteLineCount(head);
      const resumeLine = startLine + headLines;
      const directiveBlock = formatPagedDirectiveBlock(abs, content.length, resumeLine, headLines);
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(directiveBlock);
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${resumeLine}-`, pagedHeadLines: headLines, directive: extractDirectiveInner(directiveBlock) });
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }
    return;
  }
```

### The 2 tests (TDD — RED first; LINE-8 formalized in P1.M2.T1.S2)

```js
// Placement: after LINE-6 (~L3036). Compute expected values IN the test (the PD-test style).
// BIGMD fixture (buildFixtures, next to huge.log): ~3,000 lines × ~40 chars = ~120,000 chars, NO imports.
//   e.g. const BIGMD_LINES = Array.from({length: 3000}, (_, i) => `# big markdown line ${i + 1} ${"x".repeat(20)}\n`);
//        fsSync.writeFileSync(path.join(TMPDIR, "bigmd.md"), BIGMD_CONTENT);

await runCase("LINE-8", "LR-1: tight budget + #@huge.log:1-999999 → kind:'paged', head + directive, file-coordinate resume", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log:1-999999", [], PAGED_FIX);
  const headLines = (HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length;   // ASCII → head is exactly 8192
  const resumeLine = 1 + headLines;                                                // startLine = 1
  assert(r.paged === 1, `expected paged===1, got ${r.paged}`);
  assert(r.injected === 1, `one delivery (paged), got ${r.injected}`);
  const d = r.details[0];
  assert(d.kind === "paged", `kind must be 'paged', got '${d.kind}'`);
  assert(d.chars === HUGE_LOG_CONTENT.length, `chars = slice length (covers the file), got ${d.chars}`);
  assert(d.range === `:${resumeLine}-`, `range must be :${resumeLine}-, got ${d.range}`);
  assert(d.pagedHeadLines === headLines, `pagedHeadLines must be ${headLines}, got ${d.pagedHeadLines}`);
  assert(r.blocks[0].startsWith('<file name="' + HUGE + '">') && r.blocks[0].length < HUGE_LOG_CONTENT.length,
    "blocks[0] must be the HEAD block, not the full content");
  assert(r.blocks[1].includes("offset:" + resumeLine), `directive must resume at file line ${resumeLine}`);
});

await runCase("LINE-8-MD", "LR-1 via markdown: tight budget + #@bigmd.md:1-999999 → paged (injectMarkdown re-slices in emitText)", async () => {
  const r = await mod.injectFiles("Summarize #@bigmd.md:1-999999", [], PAGED_FIX);
  const headLines = (BIGMD_CONTENT.slice(0, 8192).match(/\n/g) || []).length;
  const resumeLine = 1 + headLines;
  assert(r.paged === 1 && r.details[0].kind === "paged", "the markdown slice must page");
  assert(r.details[0].range === `:${resumeLine}-` && r.details[0].pagedHeadLines === headLines,
    "file-coordinate resume on the markdown slice");
});
```
RED check: on the CURRENT code both fail at `kind === "paged"` (today kind is `"text"`, paged is 0, blocks[0] is the full content).

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (L1301-1314): the range branch becomes the full §5.5 decision (verbatim in Patterns above). Keep the
    trailing `return;`. Keep rangeSuffix; use it ONLY in the two whole-slice detail pushes.
  - replace (L1301 comment): "Closed ranges are intentional extracts: always inject the slice whole (no paging
    past the range)." → the new rule (slice runs the same §5.5 decision as a whole file; paged slices resume in
    file coordinates startLine + headLines; sub-head guard on the slice length; LR-1 / PRD §17.5).
  - UNCHANGED: the whole-file decision (L1316-1356); sliceLines/headSlice/headCompleteLineCount/
    formatPagedDirectiveBlock/extractDirectiveInner/subtract; emitText's signature + JSDoc (S3); injectMarkdown;
    the notify (~L1700 — already consumes state.paged); splitLineRange/claimKey.

FILE_EDITS (file-injector.test.mjs):
  - add (buildFixtures, next to huge.log): BIGMD + BIGMD_CONTENT (~120k chars, ~3,000 lines, NO imports);
    export/hold BIGMD_CONTENT for the expected-value computation (mirror HUGE_LOG_CONTENT).
  - add (after LINE-6 ~L3036): runCase("LINE-8", …) + runCase("LINE-8-MD", …) per the spec above.

NO_CHANGES: relative-imports.test.mjs, import-behavior.test.mjs, package.json, scripts/, PRD.md, README.md (P1.M2.T2),
            all plan/ files. NO new exports. NO new imports.
```

### Implementation Tasks (ordered — TDD: RED first)

```yaml
Task 1 (RED): ADD the BIGMD fixture + the 2 tests (after LINE-6)
  - BIGMD/BIGMD_CONTENT in buildFixtures (~120,000 chars, no imports); hold the exact string for assertions.
  - runCase("LINE-8", …) + runCase("LINE-8-MD", …) per the spec (expected headLines computed from the content).
  - VERIFY RED: node ./file-injector.test.mjs → both FAIL at kind==='paged' (today kind==='text', paged===0).

Task 2 (GREEN): REWRITE the emitText range branch (L1301-1314)
  - The full §5.5 decision per the Patterns block: inline / sub-head guard (SLICE length) / paged with the
    FILE-coordinate resume (startLine + headLines), the paged detail (range `:${resumeLine}-`, pagedHeadLines,
    directive: extractDirectiveInner), state.paged++, subtract(Math.ceil(HEAD_CHARS/4)). Keep `return;`.
  - VERIFY GREEN: node ./file-injector.test.mjs → 174 passed (172 + 2), LINE-1…6 unchanged.

Task 3 (Mode A): REPLACE the L1301 comment
  - New rule text (slice runs the same §5.5 decision as a whole file; file-coordinate resume; sub-head guard on
    the slice; cite LR-1 / PRD §17.5). Do NOT rewrite the emitText JSDoc (L1291-1298) — S3 owns it.

Task 4: VERIFY gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 174; relative-imports 38; import-behavior 23 (233 + 2 = 235 total).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# No signature/model changes; the branch rewrite uses only existing helpers → no type impact.
```

### Level 2: The Regression Gate (172 existing + 2 new)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 174 passed (LINE-1…6 green — remaining===null → byte-identical whole path)
node ./relative-imports.test.mjs     # →  38 passed
node ./import-behavior.test.mjs      # →  23 passed
# If LINE-1…6 flip: the whole-slice path drifted — re-check the first condition is `state.remaining === null ||
# fileCost <= PAGED_THRESHOLD * state.remaining` and the whole push keeps range: rangeSuffix + subtract(fileCost).
# If PD* (whole-file paging) flip: the whole-file branch was accidentally touched — it must be UNCHANGED.
```

### Level 3: TDD RED→GREEN + the file-coordinate check

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case LINE-|Result:"
# Step A (RED, before Task 2): LINE-8 + LINE-8-MD FAIL at kind==='paged' (got 'text').
# Step B (GREEN, after Task 2): all LINE-* ✓ + "Result: 174 passed, 0 failed."
# The file-coordinate property: for a slice :1-…, resumeLine = 1 + headLines (== the whole-file headLines+1);
# spot-check a NON-1 start ad hoc: emitText(abs, content, state, 100, 999999) under PAGED_FIX → resume = 100 + headLines.
```

### Level 4: Budget arithmetic sanity (ad hoc — the numbers behind the tests)

```bash
node -e '
const remaining = 50000 - 10000 - 8192 - 8192;                 // PAGED_FIX
console.log("remaining =", remaining, "| threshold =", 0.6 * remaining);
console.log("huge.log ~2MB fileCost =", Math.ceil(2000000/4), "→ pages:", Math.ceil(2000000/4) > 0.6*remaining);
console.log("BIGMD 120k fileCost  =", Math.ceil(120000/4), "→ pages:", Math.ceil(120000/4) > 0.6*remaining, "| >HEAD_CHARS:", 120000 > 8192);
'
# Expected: remaining 23616 | threshold ~14170; huge.log 500000 → true; BIGMD 30000 → true | true.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 174 passed (172 + LINE-8 + LINE-8-MD); LINE-1…6 unchanged; `relative-imports` 38 + `import-behavior` 23.
- [ ] RED→GREEN confirmed for both new tests.

### Feature Validation (the LR-1 contract)

- [ ] Tight budget + big slice → `kind:"paged"`, head block + directive, `r.paged === 1`.
- [ ] The directive resumes at `offset:${startLine + headLines}` (FILE coordinates; verified for startLine=1 in the tests).
- [ ] The sub-head guard applies to the SLICE length (a small slice under a tight budget stays whole).
- [ ] `remaining === null` → the slice path is byte-identical to today (same block, same detail, same subtract).
- [ ] The paged slice counts in the existing `N whole, M paged` notify (state.paged; no notify code touched).

### Code Quality Validation

- [ ] The whole-file decision (L1316-1356) is UNCHANGED; rangeSuffix untouched (LR-5 = S2).
- [ ] The quadruple is NOT unified (S3 owns it; the temporary 4th copy is expected).
- [ ] The paged path mirrors the whole-file paged branch exactly (incl. `directive: extractDirectiveInner`, `state.paged++` before `subtract(Math.ceil(HEAD_CHARS/4))`).
- [ ] No new exports/imports; only existing helpers consumed.

### Documentation

- [ ] The L1301 comment replaced with the LR-1 rule (Mode A); the emitText JSDoc NOT rewritten (S3).
- [ ] No README change (P1.M2.T2).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT keep the unconditional whole push.** That IS the gap. The range branch must run the full three-way
  decision (inline / sub-head guard / paged) — byte-identical only via the `remaining === null` arm.
- ❌ **Do NOT use `headLines + 1` for the slice resume.** That is the whole-file formula (the startLine=1 case).
   The slice resume is `startLine + headLines` — FILE coordinates. A `:100-…` slice resuming at headLines+1 skips
   ~99 real lines.
- ❌ **Do NOT clamp or rewrite `rangeSuffix`.** The whole-slice detail keeps the REQUESTED range; clamping to the
   delivered range is LR-5 (S2). The paged detail uses `:${resumeLine}-` (the paged-resume display) — not rangeSuffix.
- ❌ **Do NOT unify the quadruple or rewrite the emitText JSDoc.** Both are S3 (the task tree splits the PRD §17.10
   code-quality note into S3). S1 accepts the temporary 4th copy; unifying early risks S3's contract.
- ❌ **Do NOT change the whole-file branch, the notify, or subtract's cost basis.** The whole-file decision
   (L1316-1356) is UNCHANGED; the notify already consumes state.paged; the paged subtract stays
   `Math.ceil(HEAD_CHARS/4)` (matching L1355 — not `head.length`).
- ❌ **Do NOT add LR-2/3/4 behavior here.** Image/binary bare-claim (LR-2), malformed-range notify (LR-3), past-EOF
   handling (LR-4) are T2. S1 is the budget decision only.
- ❌ **Do NOT hardcode headLines in the tests.** Compute it from the fixture content
   (`CONTENT.slice(0, 8192)` newline count — ASCII so headSlice is exact), matching the PD-test style, so the tests
   stay correct if the fixture changes.
- ❌ **Do NOT forget the markdown ranged case.** injectMarkdown re-slices inside emitText, so markdown gets LR-1
   for free — but only the LINE-8-MD test PINS it. Without it, a future refactor that moves the slice out of
   emitText would silently regress markdown.

---

## Confidence Score: 9/10

A well-bounded branch rewrite with the verbatim current code, the verbatim replacement (mirroring the existing
whole-file paged branch shape exactly — including the `directive: extractDirectiveInner` detail and the
`state.paged++`-before-subtract ordering), the file-coordinate math pinned by the PRD and the code_map, verified
budget arithmetic, and a byte-identical-by-construction path for `remaining === null` that keeps LINE-1…6 green.
The -1 reserves for the file-coordinate formula being subtly wrong under a non-1 start (the tests pin startLine=1;
the ad-hoc Level-3 spot-check covers non-1) and for the discipline traps (touching rangeSuffix = LR-5's scope;
unifying the quadruple = S3's scope). One source branch + one comment + one fixture + two tests; the implementing
agent re-runs `npm run typecheck` + the three suite commands.