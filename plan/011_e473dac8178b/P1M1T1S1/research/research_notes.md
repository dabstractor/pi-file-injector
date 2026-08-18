# Research Notes — P1.M1.T1.S1 (plan/011): LR-1 — run the §5.5 inline-vs-paged decision on the slice

## Mission
Close the LR-1 gap: the `emitText` RANGE branch currently injects the slice whole UNCONDITIONALLY (comment
L1301: "Closed ranges are intentional extracts: always inject the slice whole (no paging past the range)").
Verified gap: under a budget where `#@huge.log` (~2 MB) correctly pages, `#@huge.log:1-999999` delivers the
full ~2 MB inline (~500K est. tokens vs a 23,616 budget) — a typo'd end silently disables the safety valve.
LR-1: the slice runs the SAME §5.5 decision as a whole file; a paged slice's directive resumes in FILE
coordinates (`resumeLine = startLine + headLines`).

**Scope = S1 ONLY**: the range-branch decision + the file-coordinate resume + the paged detail + state.paged +
the Mode-A comment replacement + 2 tests (the LINE-8 shape + a markdown ranged paged case).
NOT LR-5 (S2); NOT the quadruple unification / JSDoc rewrite (S3); NOT LR-2/3/4 (T2); NOT the formal gates (P1.M2).

## Baseline (MUST stay green)
- file-injector.test.mjs → **172 passed**; relative-imports 38; import-behavior 23 (233 total). typecheck clean.
- LINE-1…LINE-6 (L2969-3025) use **FIX (no budget → remaining null)** → the new decision's first condition
  (`remaining === null`) is TRUE → whole → **byte-identical to today** → they stay green by construction.

## Verified current landmarks (file-injector.ts, 1790 lines)
- **L1301-1314 THE RANGE BRANCH (the edit site)**: `if (startLine !== undefined) { const end = endLine ?? startLine;
  content = sliceLines(content, startLine, end); rangeSuffix = startLine === end ? \`:${startLine}\` : \`:${startLine}-${end}\`;
  const fileCost = Math.ceil(content.length / 4); const lineCount = …; state.blocks.push(formatTextFileBlock(abs, content));
  state.details.push({ path: abs, kind: "text", chars, lines, range: rangeSuffix }); subtract(state, fileCost); return; }`
- **L1316-1356 the whole-file decision (the pattern to replicate)**: inline (`remaining === null ||
  fileCost <= PAGED_THRESHOLD * remaining` → whole); else sub-head guard (`content.length <= HEAD_CHARS` → whole);
  else paged: `head = headSlice(content); headLines = headCompleteLineCount(head); resumeLine = headLines + 1;
  directiveBlock = formatPagedDirectiveBlock(abs, content.length, resumeLine, headLines); blocks.push(head-block);
  blocks.push(directiveBlock); details.push({ path, kind:"paged", chars, range: \`:${resumeLine}-\`, pagedHeadLines:
  headLines, directive: extractDirectiveInner(directiveBlock) }); state.paged++; subtract(state, Math.ceil(HEAD_CHARS/4));`
- Constants: PAGED_THRESHOLD=0.6 (L88), HEAD_CHARS=8192 (L90). Helpers: sliceLines (L183-189, exported), headSlice
  (L380), headCompleteLineCount (L394, NOT exported), formatPagedDirectiveBlock (L411, exported), extractDirectiveInner
  (L419, internal). FileDetail has `directive?: string` (L545) and `range?: string`.
- injectMarkdown L1395/L1412 passes (abs, FULL content, state, ctx, startLine?, endLine?) → emitText re-slices →
  markdown ranged tokens get LR-1 automatically.
- The mode-aware notify (~L1700) already consumes state.paged — no notify work needed for LR-1.
- Test fixtures: PAGED_FIX (L415-419: `{cwd: TMPDIR, getContextUsage: () => ({tokens:10000, contextWindow:50000,
  percent:20}), model: {contextWindow:50000, maxTokens:8192}}`) → remaining = 50000−10000−8192−8192 = **23616**;
  threshold = 0.6×23616 ≈ **14170**. HUGE (L360) + HUGE_LOG_CONTENT (~2 MB, ASCII). LINE-1…6 at L2969-3025.

## The exact change — the range branch becomes a full §5.5 decision
Replace the L1301-1314 range branch (keep `rangeSuffix` computation; the whole-slice detail keeps `range: rangeSuffix` —
LR-5 clamping is S2, NOT here):
```ts
if (startLine !== undefined) {
  const end = endLine ?? startLine;
  content = sliceLines(content, startLine, end);
  rangeSuffix = startLine === end ? `:${startLine}` : `:${startLine}-${end}`;
  const fileCost = Math.ceil(content.length / 4);
  const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1;
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // fits (or O-1 unknown budget) → slice whole — byte-identical to the old unconditional push
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
    subtract(state, fileCost);
  } else if (content.length <= HEAD_CHARS) {
    // §5.5 sub-head guard — applied to the SLICE length
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
    subtract(state, fileCost);
  } else {
    // LR-1 — page the slice: head + directive; resume in FILE coordinates so the model's read
    // continues at the correct absolute line of the original file (startLine + complete-lines-in-head).
    const head = headSlice(content);
    const headLines = headCompleteLineCount(head);
    const resumeLine = startLine + headLines;               // FILE coordinates (whole-file uses headLines+1 ≡ 1+headLines)
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
- Keep the final `return;` (skip the whole-file decision).
- The whole-slice paths keep `range: rangeSuffix` (REQUESTED range; LR-5 = S2). The PAGED path's detail uses
  `:${resumeLine}-` (the paged-resume display, PRD §17.7 "Paged slices render like paged text").
- subtract stays `Math.ceil(HEAD_CHARS/4)` in the paged path (matches the whole-file paged branch L1355).
- NOTE: this temporarily adds a 4th copy of the cost/lines/push/subtract quadruple — S3 owns the unification.
  Do NOT unify in S1 (the PRD §10 code-quality note is executed by S3, per the task tree).

## Mode A docs (rides with S1)
REPLACE the L1301 comment ("Closed ranges are intentional extracts: always inject the slice whole (no paging past
the range).") with the new rule: the slice runs the same §5.5 budget decision as a whole file (LR-1); a paged
slice's directive resumes in file coordinates (startLine + headLines); the sub-head guard applies to the slice
length. Do NOT rewrite the full emitText JSDoc (L1291-1298) — S3 owns that.

## The 2 tests (TDD: write RED first; LINE-8 is formalized in P1.M2.T1.S2)
Placement: after LINE-6 (~L3036). Fixtures: PAGED_FIX + HUGE/HUGE_LOG_CONTENT exist; ADD a big markdown fixture
(e.g. `BIGMD` + `BIGMD_CONTENT` ~120,000 chars, ~3,000 lines, NO imports) in buildFixtures next to huge.log
(120,000 chars → fileCost 30,000 > 14,170 → trips; > 8192 → paged).
1. **LINE-8** (huge.log, top-level): `await mod.injectFiles("Summarize #@huge.log:1-999999", [], PAGED_FIX)` →
   compute `headLines = (HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length` (ASCII → headSlice is exact);
   `resumeLine = 1 + headLines` (startLine=1). Assert: `r.paged === 1`; `r.details[0].kind === "paged"`;
   `r.details[0].chars === HUGE_LOG_CONTENT.length` (slice covers the file);
   `r.details[0].range === ":" + resumeLine + "-"`; `r.details[0].pagedHeadLines === headLines`;
   `r.blocks[0]` is the head block (`startsWith('<file name="' + HUGE + '">')`, length ≈ 8192+);
   `r.blocks[1]` is the directive containing `offset:${resumeLine}`; NO full-content block.
2. **Markdown ranged paged** (LR-1 flows through injectMarkdown → emitText automatically): write bigmd.md;
   `await mod.injectFiles("Summarize #@bigmd.md:1-999999", [], PAGED_FIX)` → same structural assertions
   (kind 'paged', paged===1, file-coordinate resume = 1 + headLines computed from BIGMD_CONTENT's first 8192 chars).
   This pins that the markdown path (which passes full content + range to emitText) gets LR-1 for free.

## Why byte-identical when remaining===null (LINE-1…6 stay green)
The new decision's first condition `state.remaining === null` is TRUE under FIX (no getContextUsage) → the
whole-slice push (same block, same detail incl. range:rangeSuffix, same subtract(fileCost)) → byte-identical.
The ONLY behavior change is: tight budget + slice trips threshold + slice > HEAD_CHARS → pages (the LR-1 fix).

## Scope boundaries (S1 = this subtask ONLY)
- ❌ LR-5 clamp the displayed range (`:2-100000` → show `:2-5`) = **S2**. The whole-slice detail keeps the REQUESTED rangeSuffix.
- ❌ Unify the cost/lines/push/subtract quadruple + emitText JSDoc rewrite = **S3** (accept the temporary 4th copy).
- ❌ LR-2 image/binary bare claim = **P1.M1.T2.S1**; LR-3 malformed notify = **T2.S2**; LR-4 past-EOF = **T2.S3**.
- ❌ Formal gates LINE-7/9/10/11/12 + full-suite sweep = **P1.M2.T1** (LINE-8 formalized there from S1's test).
- ❌ README = **P1.M2.T2**.
- ✅ S1 = the range-branch decision + file-coordinate resume + paged detail + state.paged + Mode-A comment + 2 tests.
  NO new exports; consumes only existing helpers (sliceLines, headSlice, headCompleteLineCount, formatTextFileBlock,
  formatPagedDirectiveBlock, extractDirectiveInner, subtract).