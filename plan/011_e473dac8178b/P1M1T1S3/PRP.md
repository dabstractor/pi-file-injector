---
name: "P1.M1.T1.S3 (plan/011) — Unify the emit quadruple + rewrite emitText JSDoc (code-quality note + Mode A docs)"
prd_ref: "PRD §17.10 (Requirement & gap register — the code-quality note: 'when landing LR-1, unify the cost/lines/push/subtract quadruple in emitText (three near-identical copies after the range branch) rather than adding a fourth'), §17.5 (LR-1 — the §5.5 decision applies to the slice; file-coordinate resume), §17.6 (LR-5 — the delivered/clamped range display), §9 Algorithm (emitText pseudocode — the inline-vs-paged contract)"
target_file: "./file-injector.ts"   # emitText body refactor + new private helper emitWholeText + emitText JSDoc rewrite (Mode A)
target_language: TypeScript (jiti transpile-on-load; gates = npm run typecheck --strict 0 errors + ALL FOUR suites green — this is a pure refactor, every behavioral expectation stays green UNEDITED)
depends_on: "P1.M1.T1.S1 (Complete, commit f2d33dc: LR-1 — the range branch runs the full §5.5 decision with file-coordinate resume) + P1.M1.T1.S2 (landed in the working tree: LR-5 — rangeSuffix built from the DELIVERED/clamped range; LINE-12 green). S3 consumes the post-S2 state: the whole-delivery quadruple now exists FOUR times (the contract said three — S1+S2 split the range branch into an inline arm AND a sub-head-guard arm)."
consumed_by: "P1.M2.T1.S3 (full-suite green sweep — S3 must keep the baseline: 175/23/38/38 + typecheck 0 errors). P1.M2.T2.S1 (README — Mode B; S3 is Mode A JSDoc only). P1.M1.T2.* (LR-2/3/4 in injectFile/scanTokens territory — untouched by S3)."
---

# PRP — P1.M1.T1.S3: Unify the emit quadruple + rewrite the emitText JSDoc

> **Scope flag:** This is the PRD §17.10 **code-quality note** made real: after S1+S2, the whole-delivery
> quadruple (`fileCost` → `lineCount` → `blocks.push` → `details.push` → `subtract`) exists **four times** in
> `emitText`. S3 extracts it into ONE private helper `emitWholeText(abs, content, state, rangeSuffix?)` used by
> ALL whole-delivery paths, and rewrites the stale pre-LR-1 `emitText` JSDoc to the LR-1/LR-5 contract.
> **Pure refactor — behavior byte-identical.** Every existing test must stay green WITHOUT editing expectations;
> the ONE sanctioned exception is `PD-SUBHEAD-BUDGET`, whose source-introspection *mechanism* must be re-pointed
> from `emitText`'s body to `emitWholeText`'s body (its F1 expectation is preserved and strengthened — see
> Gotchas). Scope = S3 ONLY (T2 owns LR-2/3/4; M2 owns formal gates LINE-7…12 and the README).

---

## Goal

**Feature Goal:** Collapse the four near-identical whole-delivery quadruples in `emitText` into one private
helper `emitWholeText(abs, content, state, rangeSuffix?)` called from all four whole-delivery sites (range-inline,
range-sub-head-guard, whole-inline, whole-sub-head-guard), and rewrite `emitText`'s JSDoc (currently the pre-LR-1
"lifted verbatim from the former inline text branch" text) to the LR-1/LR-5 contract so no reader can believe
slices skip the budget decision or that display shows the requested range.

**Deliverable:** Modified `file-injector.ts` — (a) new private `emitWholeText` helper placed immediately after
`emitText`; (b) `emitText` body: the four whole-delivery sites each become decision + single `emitWholeText(...)`
call (the two PAGED arms are UNTOUCHED — they are not whole deliveries); (c) `emitText` JSDoc rewritten to the
contract text. Modified `file-injector.test.mjs` — exactly ONE test-mechanism edit: `PD-SUBHEAD-BUDGET`'s
source-scrape re-pointed at `emitWholeText` (F1 expectation intact). **No export changes; no behavioral changes.**

**Success Definition:**
1. `npm run typecheck` → **0 errors**; `node ./file-injector.test.mjs` → **175 passed, 0 failed**;
   `import-behavior` 23, `relative-imports` 38, `url-injection` 38 (baseline unchanged, `npm test` chains all four).
2. Exactly **one** `kind: "text"` `details.push` and **one** `subtract(state, fileCost)` in the file — both inside
   `emitWholeText`; `emitWholeText` called from exactly 4 sites in `emitText`.
3. Every behavioral expectation (LINE-1…6, LINE-8, LINE-8-MD, LINE-12, PD*, PAGED_FIX, all paged/budget cases)
   green **without editing any assertion value** — only PD-SUBHEAD-BUDGET's scrape target changes.
4. `emitText`'s JSDoc states: the §5.5 decision applies to the sliced content exactly as to a whole file
   (sub-head guard on the slice; paged slices resume in FILE coordinates — `resumeLine = startLine + headLines`);
   `FileDetail.range` shows the delivered (clamped) range, or `:<resumeLine>-` when paged.
5. `emitWholeText` is **PRIVATE** (the module-surface completeness guard stays green; nothing added to
   `ASSERTED_EXPORTS` / `PURE_HELPERS_NOT_ASSERTED`).

## Why

- **The PRD's own code-quality note (§17.10, non-normative but directive here).** "When landing LR-1, unify the
  cost/lines/push/subtract quadruple in `emitText` … rather than adding a fourth." S1/S2 landed with **four**
  copies (the contract counted three — the range branch grew both an inline arm and a sub-head-guard arm). Four
  copies of a 5-line invariants-bearing block is exactly the drift surface the note warns about: a future budget
  tweak (e.g. changing the cost heuristic) would need four synchronized edits; miss one and whole-file vs ranged
  files silently account differently.
- **One subtract site hardens the F1 invariant.** The F1 budget fix (a sub-head-guard whole delivery must
  subtract its FULL `fileCost`) currently holds at 2 of the 4 sites only because two of them predate the guard
  test. After S3 the invariant exists once, structurally, for all four paths.
- **The JSDoc is load-bearing documentation (Mode A).** It still describes the pre-LR-1 world ("Lifted VERBATIM
  from the former inline text branch…") and is silent on slices, file-coordinate resume, and LR-5 clamping — the
  three things S1/S2 just made true. The contract supplies the exact replacement text.

## What

### User-visible behavior

**None.** Pure refactor: identical blocks, details, budgets, paged counts, notify strings, and displayed ranges for
every input. (This is itself the acceptance property: the full suite stays green with zero expectation edits.)

### Technical behavior (the contract)

- NEW private helper (placed immediately after `emitText`, before `injectMarkdown`'s JSDoc):

```ts
/**
 * PRD §5.5/§5.6.2 — the ONE whole-text delivery: cost estimate, delivered line count, the whole-file block,
 * the kind:"text" FileDetail, and the budget subtract. Every whole-delivery path in emitText (ranged inline,
 * ranged sub-head guard, whole-file inline, whole-file sub-head guard) routes through here, so the F1 invariant
 * (a whole delivery always subtracts its FULL fileCost) holds by construction. `rangeSuffix` (the DELIVERED,
 * clamped range per LR-5) is attached only when present — a whole-file detail carries NO range key.
 */
function emitWholeText(abs: string, content: string, state: State, rangeSuffix?: string): void {
  const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
  const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1; // empty → 0
  state.blocks.push(formatTextFileBlock(abs, content));
  state.details.push(rangeSuffix === undefined
    ? { path: abs, kind: "text", chars: content.length, lines: lineCount } // §12.22 — offsets computed by computeDetailOffsets in before_agent_start
    : { path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // LR-5 — the DELIVERED (clamped) range
  subtract(state, fileCost);
}
```

- The four whole-delivery sites in `emitText` become: keep the DECISION lines (`const fileCost = Math.ceil(content.length / 4);`
  for the threshold test, the `state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining` /
  `content.length <= HEAD_CHARS` guards) and replace each quadruple body with `emitWholeText(abs, content, state, rangeSuffix?)`.
- The two PAGED arms (range: head + directive + `kind:"paged"` + `paged++` + `subtract(Math.ceil(HEAD_CHARS / 4))`;
  whole-file: same shape with `resumeLine = headLines + 1`) are **UNTOUCHED**.
- `emitText`'s JSDoc (L1291–1298) is REPLACED with the contract text (see Edit 3).

### Success Criteria

- [ ] One `kind: "text"` push, one `subtract(state, fileCost)` — both inside `emitWholeText`.
- [ ] `emitWholeText` called exactly 4× from `emitText` (range inline, range guard, whole inline, whole guard).
- [ ] Paged arms byte-identical (details still carry `directive: extractDirectiveInner(directiveBlock)`).
- [ ] All four suites green at baseline (175/23/38/38); typecheck 0 errors.
- [ ] No assertion VALUE edited anywhere; PD-SUBHEAD-BUDGET's scrape mechanism re-pointed (F1 kept).
- [ ] `emitWholeText` not exported; module-surface guard green.
- [ ] New JSDoc states the LR-1 slice-decision + FILE-coordinate resume + LR-5 clamped-range contract.

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** The PRP gives: the
exact current `emitText` (post-S1+S2, verified this session) with all four quadruple sites mapped to line
numbers; the helper's full implementation (drop-in); the replacement JSDoc verbatim; the ONE test edit with its
exact current text and the re-pointed version; the module-surface and source-introspection constraints that
dictate privacy and the test re-pointing; and verified commands with exact baselines.

### Documentation & References

```yaml
# MUST READ — the code-quality note being executed + the normative requirements the JSDoc must state
- file: PRD.md   # (the merged PRD; §17.x = the Line-Ranges feature part)
  why: "§17.10 code-quality note: 'unify the cost/lines/push/subtract quadruple in emitText … rather than adding
        a fourth'. §17.5 (LR-1): the §5.5 decision applies to the SLICE; sub-head guard on the slice; paged slices
        resume in FILE coordinates (resumeLine = startLine + complete-lines-in-slice-head). §17.6 (LR-5): display
        shows the DELIVERED (clamped) range. These three sentences are the new JSDoc's content."
  section: "Feature: Line Ranges — §5, §6, §10"

# MUST READ — S2's contract (S3 consumes its output; don't redo or revert it)
- file: plan/011_e473dac8178b/P1M1T1S2/PRP.md
  why: "S2 (landed) built rangeSuffix from deliveredEnd (LR-5) and explicitly hands off: 'consumed_by:
        P1.M1.T1.S3 (unify the emit quadruple + rewrite the emitText JSDoc — consumes the clamped rangeSuffix)'.
        S3 keeps S2's deliveredEnd/rangeSuffix computation and the paged arm's ':${resumeLine}-' display intact."
  critical: "S2's LR-5 comments on the two range-whole pushes fold into the helper's rangeSuffix comment. Do NOT
             revert to the requested range, and do NOT touch the paged arm's range."

# MUST READ — S1's contract (the LR-1 structure S3 refactors on top of)
- file: plan/011_e473dac8178b/P1M1T1S1/PRP.md
  why: "S1 (Complete, commit f2d33dc) gave the range branch the three-way decision + file-coordinate resume
        (resumeLine = startLine + headLines) and subtract(Math.ceil(HEAD_CHARS/4)) on the paged arm. S3 preserves
        every one of those outcomes byte-identically."

# The line-level map of the battleground (verified pre-S2; line numbers shifted ~+10 by S2)
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "The 'emitText — the LR-1/LR-5 battleground' table + 'State & output shapes'. Confirms the FileDetail.kind
        union ('text' | 'paged' | 'image' | 'binary' | 'url') and that both callers (injectFile L1282,
        injectMarkdown L1444 post-S2) pass full content + range so emitText re-slices."
  gotcha: "code_map was written PRE-S2 (it shows L1306 rangeSuffix 'from REQUESTED lines' as the gap — S2 fixed it).
           Use this session's PRP line numbers, which are POST-S2."

# The file you edit + the ONE test you re-point
- file: file-injector.ts
  why: "emitText L1299-1386 + its JSDoc L1291-1298 + insertion point for the helper. Placement by the literal
        text in the Edits below (S2 just shifted lines; T2 may shift them again — the oldText is authoritative)."
- file: file-injector.test.mjs
  why: "PD-SUBHEAD-BUDGET at ~L1168-1182 (source-introspection: scrapes emitText's body for the sub-head guard
        and its subtract(state, fileCost)). The module-surface completeness guard at ~L140-160. The 16 typeof
        asserts at ~L120-140 (emitText stays exported; emitWholeText must NOT join them)."

# Gates
- file: scripts/typecheck.mjs
  why: "npm run typecheck → tsc --strict against the GLOBAL pi package's .d.ts; success prints '0 errors'."
- file: package.json
  why: "npm test chains FOUR suites: file-injector && import-behavior && relative-imports && url-injection."
```

### Current Codebase tree (verification target)

```bash
pi-file-injector/
├── file-injector.ts            # ← EDITED: emitText refactor (4 quadruples → emitWholeText×4) + JSDoc + new helper
├── file-injector.test.mjs      # ← EDITED: exactly ONE mechanism edit (PD-SUBHEAD-BUDGET scrape re-point)
├── import-behavior.test.mjs    # NOT edited (23 cases, unaffected — pure refactor)
├── relative-imports.test.mjs   # NOT edited (38)
├── url-injection.test.mjs      # NOT edited (38)
├── scripts/typecheck.mjs       # untouched (gate)
└── plan/011_e473dac8178b/{architecture/, P1M1T1S1/, P1M1T1S2/, P1M1T1S3/}
```

### Desired Codebase tree

```bash
# Same files; only file-injector.ts (+ the one test mechanism) differ. No new files, no export changes.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — THE CONTRACT UNDERCOUNTED: there are FOUR quadruple copies, not three. Post-S1+S2 the range
//   branch has an INLINE arm (~L1318-1324) AND a SUB-HEAD-GUARD arm (~L1325-1331), plus the whole-file
//   INLINE (~L1347-1354) and SUB-HEAD-GUARD (~L1367-1377). Verified: 4× `kind: "text"` pushes (L1323/1329/1352/
//   1376) and 4× `subtract(state, fileCost)`. Unify ALL FOUR. The two PAGED arms (~L1332-1341, ~L1378-1386)
//   are NOT whole deliveries — leave them byte-identical.

// CRITICAL — PD-SUBHEAD-BUDGET (file-injector.test.mjs ~L1168-1182) INTROSPECTS emitText's SOURCE:
//   it does src.indexOf("function emitText(") → slices to the first "\n}" → finds "content.length <= HEAD_CHARS"
//   → asserts that guard block includes the LITERAL "subtract(state, fileCost)". After S3 the guard arm's body
//   is a single emitWholeText(...) call → the literal leaves emitText → THE TEST FAILS unless re-pointed.
//   This is the ONE sanctioned test edit (mechanism only, not expectation): re-point the scrape at
//   emitWholeText — assert (a) the sub-head-guard block in emitText calls emitWholeText, AND (b) emitWholeText's
//   body contains subtract(state, fileCost). Update the case's explanatory comment to say the invariant now
//   lives structurally in the one helper covering all four whole-delivery paths. DO NOT delete or weaken it.

// CRITICAL — MODULE-SURFACE COMPLETENESS GUARD (~L140-160): every exported function must be in ASSERTED_EXPORTS
//   or PURE_HELPERS_NOT_ASSERTED, else "module ships functions not in the sanity list" fails. ⇒ emitWholeText
//   MUST be declared `function emitWholeText(...)` with NO export keyword (like injectMarkdown — which the guard
//   even asserts is NOT exported). Do NOT add typeof-asserts for it; do NOT export it "for testing".

// CRITICAL — DETAIL OBJECT SHAPE IS OBSERVABLE: whole-file details carry NO `range` key today. A naive
//   `{ ..., range: rangeSuffix }` with rangeSuffix===undefined adds a PRESENT key with value undefined —
//   different under Object.keys()/deep-equal. Build the detail conditionally (two literals, as in the helper
//   above), exactly as the four sites do today.

// CRITICAL — lineCount's empty→0 RULE: `content.length === 0 ? 0 : (newlines ?? 0) + 1`. A 0-byte file and an
//   empty slice push lines: 0 (not 1). The helper preserves it verbatim.

// GOTCHA — the DECISION stays in emitText: each site keeps its own `const fileCost = Math.ceil(content.length/4);`
//   for the threshold test (recomputing the same value twice is byte-identical and keeps the helper single-
//   purpose). Do NOT pass fileCost INTO the helper to "save a divide" — that re-splits the quadruple.
//   What unifies is cost+lines+push+push+subtract AS A UNIT (one implementation).

// GOTCHA — keep these EXACT outcomes (byte-identical): the paged arms' `range: \`:${resumeLine}-\`` (NOT
//   rangeSuffix), `directive: extractDirectiveInner(directiveBlock)`, `pagedHeadLines`, `state.paged++`,
//   `subtract(state, Math.ceil(HEAD_CHARS / 4))`; the range paged arm's `resumeLine = startLine + headLines`
//   (FILE coordinates) vs the whole arm's `resumeLine = headLines + 1`; S2's deliveredEnd/rangeSuffix
//   computation; the F1 comment story on the whole-file sub-head guard (it moves into the helper's JSDoc).

// GOTCHA — "intentional extracts" wording: ALREADY GONE (S1 replaced it; grep → 0 hits). The surviving
//   "deliberate extract" at ~L1302 is INSIDE S1's LR-1 rationale ("justifies not paging PAST the range end, not
//   suspending overflow protection WITHIN it") — that is correct post-LR-1 reasoning; KEEP it. Only the JSDoc
//   (L1291-1298) still describes the pre-LR-1 world and must be replaced.

// GOTCHA — T2 (LR-2/3/4) runs AFTER S3 in injectFile/scanTokens territory; M2.T1 adds LINE-7/9/10/11 gates.
//   S3 touches neither — but place edits by TEXT (oldText below), since sibling landings shift line numbers.
```

---

## Implementation Blueprint

### Edit 1 — CREATE the private helper (insert immediately AFTER `emitText`'s closing `}`)

Insert the `emitWholeText` function + its JSDoc (verbatim from the "Technical behavior" section above) between
`emitText`'s closing `}` and the `/**` that opens `injectMarkdown`'s JSDoc.

### Edit 2 — REWRITE the `emitText` body's four whole-delivery sites

**Site 1 (range INLINE arm).** oldText:
```ts
    const fileCost = Math.ceil(content.length / 4);
    const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1;
    if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
      // INLINE (whole slice) — fits or budget unknown (O-1): byte-identical to the former unconditional push.
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // the DELIVERED (clamped) range (LR-5) — clamps only when the requested end passed EOF
      subtract(state, fileCost);
    } else if (content.length <= HEAD_CHARS) {
```
newText:
```ts
    const fileCost = Math.ceil(content.length / 4);
    if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
      // INLINE (whole slice) — fits or budget unknown (O-1). rangeSuffix = the DELIVERED (clamped) range (LR-5).
      emitWholeText(abs, content, state, rangeSuffix);
    } else if (content.length <= HEAD_CHARS) {
```

**Site 2 (range SUB-HEAD guard arm).** oldText:
```ts
      // §5.5 sub-head guard — applied to the SLICE length (a slice that already fits HEAD_CHARS pages nothing;
      // a directive would point past the range's end, causing a spurious read).
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
      subtract(state, fileCost);
    } else {
```
newText:
```ts
      // §5.5 sub-head guard — applied to the SLICE length (a slice that already fits HEAD_CHARS pages nothing;
      // a directive would point past the range's end, causing a spurious read). Whole delivery → emitWholeText.
      emitWholeText(abs, content, state, rangeSuffix);
    } else {
```

**Site 3 (whole-file INLINE arm).** oldText:
```ts
  const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
  const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1; // PRD §9 — delivered line count
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // INLINE (whole) — current behavior preserved (PRD §5.1)
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount }); // §12.22 — contentStart/contentLen populated by computeDetailOffsets in before_agent_start (no body duplication)
    subtract(state, fileCost);
  } else {
```
newText:
```ts
  const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // INLINE (whole) — current behavior preserved (PRD §5.1). §12.22 offsets computed in before_agent_start.
    emitWholeText(abs, content, state);
  } else {
```

**Site 4 (whole-file SUB-HEAD guard arm).** oldText (keep the FINDING 1/2 comment block above it intact):
```ts
    const head = headSlice(content);
    if (content.length <= HEAD_CHARS) {
      // whole content fits the head slice → deliver inline, never page (FINDING 2).
      // The file is delivered WHOLE, so its whole cost is accounted (PRD §5.6.2 "each delivered file
      // subtracts its cost at emit time"). Earlier this branch pushed the block without subtract(),
      // which let a tight-but-positive budget never deplete across a run of small files (F1).
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount }); // §12.22 — offsets computed in before_agent_start (no body duplication)
      subtract(state, fileCost);
    } else {
```
newText:
```ts
    const head = headSlice(content);
    if (content.length <= HEAD_CHARS) {
      // whole content fits the head slice → deliver inline, never page (FINDING 2).
      // F1 (PRD §5.6.2 "each delivered file subtracts its cost at emit time"): emitWholeText subtracts the
      // FULL fileCost — the invariant that earlier lived only at this guarded site now holds for every
      // whole-delivery path by construction (the helper is the single implementation).
      emitWholeText(abs, content, state);
    } else {
```

> The whole-file `lineCount` local disappears after Site 3/4 (only `fileCost` remains, for the decision). The
> range branch's `fileCost` stays for its decision; its `lineCount` also disappears. If tsc flags an unused
> local, the corresponding edit left one behind — re-check all four sites.

### Edit 3 — REPLACE the emitText JSDoc (L1291–1298)

oldText:
```ts
/**
 * PRD §9 / §5.5 — inline-vs-paged decision for a text file. Pushes block(s) onto state.blocks and subtracts
 * the block's cost from state.remaining via subtract(). Bumps state.paged on the page path (NOT count —
 * injectFile bumps count once per file). Lifted VERBATIM from the former inline text branch of injectFiles
 * (T1.S1): whole if budget unknown or fileCost ≤ PAGED_THRESHOLD·remaining; sub-head guard (content ≤
 * HEAD_CHARS → whole, no directive, no extra subtract); else head + directive + paged++ + subtract(head cost).
 */
```
newText:
```ts
/**
 * PRD §9 / §5.5 / §17.5 (LR-1) — the inline-vs-paged decision for a text file OR a `#@file:N`/`:N-M` slice.
 * The §5.5 decision applies to the sliced content exactly as to a whole file: whole (via emitWholeText) if the
 * budget is unknown (O-1 fallback) or fileCost ≤ PAGED_THRESHOLD·remaining; the sub-head guard applies to the
 * SLICE (content ≤ HEAD_CHARS → whole, never a directive pointing past the end); else PAGE — head block +
 * directive, where paged slices resume in FILE coordinates (resumeLine = startLine + complete-lines-in-slice-head,
 * so the model's read continues at the correct absolute line; the whole-file headLines+1 is the startLine=1
 * special case). FileDetail.range shows the delivered (clamped) range (LR-5), or `:<resumeLine>-` when paged.
 * Bumps state.paged on the page path (NOT count — injectFile bumps count once per file). Whole deliveries all
 * route through emitWholeText (the ONE cost/lines/push/subtract implementation — PRD §17.10 code-quality note).
 */
```

### Edit 4 — RE-POINT PD-SUBHEAD-BUDGET's scrape (the ONE test edit; file-injector.test.mjs ~L1168-1182)

Replace the case body (keep the `await runCase("PD-SUBHEAD-BUDGET", …)` id + title; update the trailing comment
prose to name emitWholeText). oldText (core of the case):
```js
  const src = fsSync.readFileSync(path.join(process.cwd(), "file-injector.ts"), "utf8");
  // locate emitText and inspect only its body
  const fnStart = src.indexOf("function emitText(");
  assert(fnStart !== -1, "emitText must exist in file-injector.ts");
  const fnBody = src.slice(fnStart, src.indexOf("\n}", fnStart) + 2);
  // the sub-head-guard branch is `if (content.length <= HEAD_CHARS) {` — find it
  const guardIdx = fnBody.indexOf("content.length <= HEAD_CHARS");
  assert(guardIdx !== -1, "sub-head guard branch must exist in emitText");
  const guardBlock = fnBody.slice(guardIdx, fnBody.indexOf("} else {", guardIdx));
  assert(guardBlock.includes("subtract(state, fileCost)"),
    `sub-head guard must call subtract(state, fileCost) — F1 fix present in: ${JSON.stringify(guardBlock)}`);
```
newText:
```js
  const src = fsSync.readFileSync(path.join(process.cwd(), "file-injector.ts"), "utf8");
  // P1.M1.T1.S3: the F1 subtract moved into emitWholeText (the ONE whole-delivery helper). Pin BOTH halves:
  // (a) emitText's sub-head guard routes through emitWholeText; (b) the helper subtracts the full fileCost —
  // which now covers ALL FOUR whole-delivery paths (range inline, range guard, whole inline, whole guard).
  const fnStart = src.indexOf("function emitText(");
  assert(fnStart !== -1, "emitText must exist in file-injector.ts");
  const fnBody = src.slice(fnStart, src.indexOf("\n}", fnStart) + 2);
  const guardIdx = fnBody.indexOf("content.length <= HEAD_CHARS");
  assert(guardIdx !== -1, "sub-head guard branch must exist in emitText");
  const guardBlock = fnBody.slice(guardIdx, fnBody.indexOf("} else {", guardIdx));
  assert(guardBlock.includes("emitWholeText("),
    `sub-head guard must deliver via emitWholeText — got: ${JSON.stringify(guardBlock)}`);
  const helperStart = src.indexOf("function emitWholeText(");
  assert(helperStart !== -1, "emitWholeText must exist in file-injector.ts");
  const helperBody = src.slice(helperStart, src.indexOf("\n}", helperStart) + 2);
  assert(helperBody.includes("subtract(state, fileCost)"),
    `emitWholeText must call subtract(state, fileCost) — F1 invariant in: ${JSON.stringify(helperBody)}`);
  const emitCalls = fnBody.match(/emitWholeText\(/g)?.length ?? 0;
  assert(emitCalls === 4, `emitText must route ALL 4 whole-delivery paths through emitWholeText; found ${emitCalls}`);
```
Also update the block comment above the case: replace "read the emitText source and assert the sub-head-guard
branch contains a subtract(state, fileCost) call (matching the whole branch)" with "read the source and assert
(a) the sub-head guard routes through emitWholeText and (b) emitWholeText — now the single whole-delivery
implementation for all four paths — contains the subtract(state, fileCost) call (F1 holds structurally)".
**Nothing else in any test file changes.**

### Integration Points

```yaml
FILE_EDITS:
  - file-injector.ts: Edit 1 (insert helper after emitText) + Edit 2 (4 sites → emitWholeText calls) + Edit 3 (JSDoc).
  - file-injector.test.mjs: Edit 4 (PD-SUBHEAD-BUDGET mechanism re-point ONLY — F1 expectation preserved).
NO_CHANGES: export surface (emitText stays the only new-ish public name — unchanged; emitWholeText PRIVATE),
  the two PAGED arms, S2's deliveredEnd/rangeSuffix computation, injectFile/injectMarkdown call sites,
  import-behavior / relative-imports / url-injection suites, scripts/, package.json, README (Mode B = M2.T2),
  PRD.md / tasks.json / snapshots.
```

### Implementation Tasks (ordered)

```yaml
Task 1: INSERT emitWholeText (Edit 1) — private, after emitText's closing brace, before injectMarkdown's JSDoc.
Task 2: CONVERT the four whole-delivery sites (Edit 2, sites 1-4). KEEP each site's decision lines
        (fileCost compute + threshold/guard conditions); the paged arms untouched.
Task 3: REPLACE the emitText JSDoc (Edit 3).
Task 4: RE-POINT PD-SUBHEAD-BUDGET (Edit 4) — mechanism only.
Task 5: GATES — npm run typecheck (0 errors); node ./file-injector.test.mjs (175/0);
        node ./import-behavior.test.mjs (23/0); node ./relative-imports.test.mjs (38/0);
        node ./url-injection.test.mjs (38/0); or npm test (chains all four).
Task 6: STRUCTURAL SWEEP — exactly 1× `kind: "text"` push and 1× subtract(state, fileCost) (both in the helper);
        emitWholeText called 4× in emitText; `grep -c "export function emitWholeText"` → 0;
        grep "intentional extracts" → 0 hits; `grep -c "function emitWholeText"` → 1.
```

## Validation Loop

### Level 1: Typecheck (immediate, after each edit batch)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck        # EXPECT: "type-checks clean under --strict (0 errors)"
# Watch for: unused locals (a site kept its lineCount after Site 3/4 — remove the dead local);
# emitWholeText used-before-declared (it is declared AFTER emitText — fine for function declarations, hoisted).
```

### Level 2: The suite gate — baseline EXACTLY unchanged (the pure-refactor proof)

```bash
node ./file-injector.test.mjs        # EXPECT: Result: 175 passed, 0 failed   (incl. PD-SUBHEAD-BUDGET, LINE-1…6/8/8-MD/12, PD*, PAGED_FIX)
node ./import-behavior.test.mjs      # EXPECT: Result: 23 passed, 0 failed
node ./relative-imports.test.mjs     # EXPECT: Result: 38 passed, 0 failed
node ./url-injection.test.mjs        # EXPECT: Result: 38 passed, 0 failed
npm test                             # chains all four — same totals
# ANY behavioral delta = the refactor is not byte-identical → fix the CODE, never the expectations
# (the sole sanctioned test edit is Edit 4's mechanism re-point).
```

### Level 3: Structural verification (the unification actually happened)

```bash
echo "[1] one kind:text push:";      grep -c 'kind: "text"' file-injector.ts                 # expect 1 (helper) + 1 (FileDetail type union line — check with: grep 'kind: "text"' | grep details.push → 1)
echo "[2] one subtract(fileCost):";  grep -c "subtract(state, fileCost)" file-injector.ts    # expect 1
echo "[3] 4 helper call sites:";     awk '/function emitText/,/^\}/' file-injector.ts | grep -c "emitWholeText("   # expect 4
echo "[4] helper private:";          grep -c "export function emitWholeText" file-injector.ts # expect 0
echo "[5] helper exists once:";      grep -c "^function emitWholeText" file-injector.ts       # expect 1
echo "[6] stale wording gone:";      grep -c "intentional extracts" file-injector.ts          # expect 0
echo "[7] paged arms intact:";       grep -c "kind: \"paged\"" file-injector.ts               # expect 2 (unchanged)
echo "[8] JSDoc contract:";          grep -c "FILE coordinates" file-injector.ts              # expect ≥1 (new JSDoc)
```

### Level 4: N/A — internal refactor; no UI/config/runtime surface. (The renderer reads the SAME
FileDetail shapes; `read` lines and clamped ranges are covered by the unchanged suites.)

## Final Validation Checklist

### Technical
- [ ] `npm run typecheck` → 0 errors; all four suites at baseline (175/23/38/38, 0 failed each).
- [ ] Structural sweep Level 3 all green.

### Feature (pure-refactor contract)
- [ ] Zero assertion values edited; PD-SUBHEAD-BUDGET mechanism re-pointed with F1 + 4-site coverage assertions.
- [ ] Paged arms byte-identical (`:${resumeLine}-`, extractDirectiveInner, pagedHeadLines, paged++, HEAD_CHARS subtract).
- [ ] Whole-file details carry no `range` key (conditional literal in the helper).
- [ ] `emitWholeText` private; module-surface guard green; the 16 typeof asserts untouched.

### Code Quality
- [ ] Exactly one quadruple implementation (the PRD §17.10 note satisfied).
- [ ] New JSDoc states LR-1 slice decision + FILE-coordinate resume + LR-5 clamped range + emitWholeText routing.
- [ ] No new imports/exports/files; comments preserve the FINDING 1/2 and F1 provenance.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT "fix" a failing behavioral test by editing its expectation.** A pure refactor failing LINE-8/PD/PAGED
  means the refactor changed behavior — restore the code path. Edit 4 is the ONLY sanctioned test touch (mechanism).
- ❌ **Do NOT export emitWholeText** (or add a typeof assert for it) — the module-surface guard fails on any
  unlisted export; injectMarkdown is the precedent for a private helper.
- ❌ **Do NOT write `{ ..., range: rangeSuffix }` when rangeSuffix is undefined** — whole-file details must have
  NO range key (observable via Object.keys/deep-equal). Use the two-literal conditional.
- ❌ **Do NOT pass fileCost/lineCount into the helper** — that re-splits the quadruple; the helper owns cost+lines.
- ❌ **Do NOT touch the two PAGED arms, S2's deliveredEnd computation, or the callers.** Paged arms are not whole
  deliveries; rangeSuffix's `:${resumeLine}-` display is S2's contract; callers (injectFile L1282 /
  injectMarkdown L1444) are unchanged.
- ❌ **Do NOT delete/leave stale the F1 story** — Site 4's comment folds into the helper's JSDoc; PD-SUBHEAD-BUDGET's
  comment names the structural invariant.
- ❌ **Do NOT confuse the contract's "3 copies" with reality's 4** — the range branch has inline AND guard arms.
- ❌ **Do NOT grep "deliberate extract" and delete it** — that L1302 phrase is S1's correct LR-1 rationale; only
  "intentional extracts … no paging" (already gone) was the stale wording.

---

## Confidence Score: 9/10

A tightly-scoped pure refactor with all four sites' exact oldText verified this session, the helper implementation
supplied drop-in, the two test-introspection constraints (PD-SUBHEAD-BUDGET source scrape; module-surface
completeness guard) discovered and handled explicitly, exact replacement JSDoc from the contract, and verified
baselines for every gate (175/23/38/38 + typecheck clean). The −1 reserves for edit-matching drift if a parallel
sibling lands first (mitigated: place by oldText, not line numbers) and the subtle observability rule around the
conditional `range` key, which the Gotchas call out but an implementer could still fumble.