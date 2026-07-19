---
name: "P1.M2.T3.S1 (plan/009) — Add return-shape, handler-level, and re-open simulation regression tests (4 new REOPEN runCase blocks in file-injector.test.mjs pinning the verbatim re-submission contract: #@ survives in the stored text so cancel/fork//tree re-open re-triggers injection; PRD §6.4 + §13.8)"
prd_ref: "PRD §6.4 (Assembly & shared state — the prompt is preserved byte-for-byte; re-submission robustness), §13.8 (Why the prompt is preserved verbatim — stripping breaks every re-submission path), §10 Edge Cases (verbatim storage rows), §11 Acceptance Criteria"
target_file: "./file-injector.test.mjs"   # ADD 4 new runCase blocks (REOPEN-1..REOPEN-4) under a banner BEFORE the Summary block (L2791). NO .ts change, NO aux-suite change, NO harness change, NO new fixtures/helpers.
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (REOPEN-1..4 ✓; 0 new failures; the 6 pre-existing failures UNCHANGED)
depends_on: "P1.M1 (the verbatim engine — LANDED: injectFiles returns text verbatim, file-injector.ts:1179/1188; input handler returns text:event.text, L1265; before_agent_start delivers the custom message, L1199) + P1.M2.T1 (the main-suite migration to verbatim assertions — LANDED: DELIV-1/2 already assert text==='#@a.ts' verbatim). The suite runs against the LANDED verbatim file-injector.ts."
consumed_by: "P1.M3.T1.S1 (wire all three suites into npm test). Nothing depends on these cases at runtime; they are a regression gate for the verbatim re-submission contract."
---

# PRP — P1.M2.T3.S1 (plan/009): verbatim re-submission regression tests

> **Scope flag:** This is a **test-addition** task. The engine under test is **already landed and verbatim**
> (P1.M1: `injectFiles` returns `text` verbatim; the input handler returns `text: event.text`). I add **4 new
> `runCase` blocks** to `file-injector.test.mjs` that pin the **verbatim re-submission contract** (PRD §6.4 /
> §13.8): the `#@` markers survive in the stored prompt text so that when Pi re-feeds it on cancel/fork/`/tree`
> re-open, injection RE-TRIGGERS automatically. **No `.ts` change, no aux-suite change, no harness change, no
> new fixtures/helpers.** The cases reuse `makeMockCtx`/`captureAllHandlers`/`FIX`/`A_TS` and the existing
> `a.ts` fixture. Prefix `REOPEN-` (no collision with `DELIV-`/`F1`/`T1.S1-`).

---

## Goal

**Feature Goal:** Pin the verbatim re-submission contract (PRD §6.4 + §13.8 + §10) as runnable regression
cases, so a future change that re-introduces `#@` stripping (which would make cancel/fork/`/tree` re-open
silently lose the injected files) is caught deterministically. Four angles: (1) the pipeline return shape
carries `#@` verbatim; (2) the input handler stores `#@` verbatim AND `before_agent_start` still delivers the
block; (3) **the keystone regression** — feeding the stored text back into a fresh factory re-triggers
injection; (4) the negative control — a stored prompt with NO `#@` re-triggers nothing (the exact failure
mode a stripping regression would produce).

**Deliverable:** 4 new `runCase` blocks in `file-injector.test.mjs` under a
`// ── P1.M2.T3.S1 (plan/009): verbatim re-submission regression ──` banner (`REOPEN-1`…`REOPEN-4`), placed
BEFORE the `// 10. Summary + cleanup + exit.` block (L2791), after the `DELIV-6` case. No other file touched.

**Success Definition:**
1. `node ./file-injector.test.mjs` → the 4 `REOPEN` cases print ✓; **0 NEW failures** introduced (the suite's
   6 pre-existing failures — `F1`/`F1b`/`F1d`/`T1.S1-9`/`T1.S1-10`/`T1.S1-12`, all P1.M2.T1's scope — stay
   EXACTLY as-is; passed count rises 144 → 148).
2. `REOPEN-1`: `injectFiles("Review #@a.ts", [], FIX)` → `text === "Review #@a.ts"` (verbatim, `#@` preserved)
   AND `blocks.length === 1` AND `details.length === 1` AND `injected === 1`.
3. `REOPEN-2`: `captureAllHandlers()` → input `out.action === "transform"`, `out.text === "Review #@a.ts"`
   (verbatim); `before_agent_start` `msg.message.content` includes `<file name=` (block delivered).
4. `REOPEN-3`: factory 1 input → `out1.text === "Review #@a.ts"` (stored, verbatim); feed `out1.text` to a
   FRESH factory 2 input → `out2.action === "transform"` (injection RE-TRIGGERED) + `out2.text` verbatim;
   factory 2 `before_agent_start` re-delivers the block.
5. `REOPEN-4`: input with `"Review a.ts"` (NO `#@` — models a stripped stored prompt) → `action === "continue"`
   (the regression's failure mode).
6. `git diff --stat file-injector.ts` is **EMPTY**; `git diff --stat` touches ONLY `file-injector.test.mjs`.

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` — and a future refactorer tempted to
"clean up" the prompt by stripping `#@` to a bare path (the pre-plan-009 behavior) for a tidier chat bubble.

**Use Case:** `git pull && node ./file-injector.test.mjs` → the 4 REOPEN cases prove: the stored prompt keeps
`#@`; a re-open (cancel/fork/`/tree`) re-triggers injection; and a prompt without `#@` re-triggers nothing
(the trap a stripping regression would fall into).

**Pain Points Addressed:** Plan 009 deliberately reversed an earlier stripping design precisely because
stripping breaks re-submission (PRD §13.8): Pi re-feeds the STORED text on re-open, so stripped `#@` → no
trigger → files vanish. The contract is subtle (the cost of verbatim is purely cosmetic — a `#@` in the
bubble) and the regression is silent (no error, just missing files). These 4 cases make the invariant runnable
and the regression noisy.

## Why

- **The re-open path is invisible without a test.** PRD §13.8 documents that Pi re-feeds stored text on
  cancel/fork/`/tree` (verified in `agent-session.ts`: `navigateTree()` → `_extractUserMessageText` →
  `editor.setText`; no extension hook to override the prefill). No existing case exercises this — DELIV-1/2/3
  pin the *delivery* mechanism (return shape, custom message, one-shot stash), not the *re-submission*
  robustness. REOPEN-3 closes that gap: it feeds the stored text back through a fresh factory and proves
  injection re-triggers.
- **The keystone regression is silent.** If `injectFiles`/the input handler ever strip `#@` again, the stored
  text becomes a bare path; the re-open finds no `#@`; the input handler returns `continue`; and the files
  silently vanish — no error, no test failure among the existing delivery cases (DELIV-2 would still pass: its
  FIRST invocation delivers fine). REOPEN-3 + REOPEN-4 make this regression loud and deterministic.
- **Complementary, not duplicative, with DELIV.** DELIV-1/2 assert `text === "Review #@a.ts"` (verbatim) but
  their documented focus is the *delivery return shape / custom-message structure*. REOPEN-1/2 assert the same
  text invariant but document the *re-submission rationale* (§6.4/§13.8) and pair it with the re-open
  simulation (REOPEN-3) and negative control (REOPEN-4). Different angle, stronger net.
- **Decoupled from the parallel sibling.** P1.M2.T2.S1 (running in parallel) edits the two AUX suites
  (`relative-imports.test.mjs` + `import-behavior.test.mjs`); this task adds to the MAIN suite only. Disjoint
  files → no merge conflict, no case-ID collision (REOPEN- vs the aux suites' own IDs).

## What

No user-visible / API / logic change. **Test additions only.** 4 new `runCase` blocks exercising the verbatim
contract via two invocation modes (architecture/test_assertions_analysis.md §7): Mode A (direct
`mod.injectFiles`) for REOPEN-1, Mode B (`captureAllHandlers()` + manual drive) for REOPEN-2/3/4. No new
fixtures (reuse the existing `a.ts` in TMPDIR). No new helpers (reuse `makeMockCtx`/`captureAllHandlers`/`FIX`/
`A_TS`/`assert`/`runCase`). No harness change. No `.ts` change.

### Success Criteria

- [ ] 4 new cases (`REOPEN-1`…`REOPEN-4`) present under a `P1.M2.T3.S1 (plan/009)` banner, BEFORE the Summary block (L2791).
- [ ] REOPEN-1: `injectFiles("Review #@a.ts", [], FIX)` → `text==="Review #@a.ts"`, `blocks.length===1`, `details.length===1`, `injected===1`.
- [ ] REOPEN-2: input `out.action==="transform"` + `out.text==="Review #@a.ts"`; `before_agent_start` `content` includes `<file name=`.
- [ ] REOPEN-3: factory-1 `out1.text==="Review #@a.ts"`; factory-2 (fed `out1.text`) `out2.action==="transform"` + `out2.text` verbatim; factory-2 `before_agent_start` re-delivers the block.
- [ ] REOPEN-4: input `"Review a.ts"` (no `#@`) → `action==="continue"`.
- [ ] `node ./file-injector.test.mjs` → REOPEN-1..4 ✓; **0 NEW failures**; the 6 pre-existing failures unchanged.
- [ ] `git diff --stat file-injector.ts` EMPTY; `git diff --stat` touches ONLY `file-injector.test.mjs`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the EXACT verbatim behavior grounded in the LANDED code (`injectFiles` returns
`text` verbatim in both paths — file-injector.ts:1179/1188, quoted; the input handler returns `text: event.text`
— L1265, quoted; `before_agent_start` returns the custom message — L1199), the verified harness
(`makeMockCtx` L162, `captureAllHandlers` L185 — with the CLOSURE-SCOPED `pending` fact that makes a fresh
factory model a fresh prompt() invocation, quoted), the DELIV sibling pattern to mirror (L2473-2560), the
reuse list (`FIX`/`A_TS`/`A_TS_CONTENT`/`assert`/`runCase`, all pre-existing), the copy-ready code for all 4
cases (below), the insertion point (banner before L2791 Summary), the CRITICAL baseline gotcha (144/6 — the 6
are out of scope), the no-collision note (REOPEN- vs DELIV-/aux), and the gate. The implementer adds a banner +
4 `runCase` blocks and runs one command.

### Documentation & References

```yaml
# MUST READ — the verbatim re-submission contract this task pins
- file: PRD.md
  why: "§6.4 'Assembly & shared state': the prompt is NEVER modified — the input handler leaves event.text
        byte-for-byte intact so cancel/fork//tree re-open re-triggers injection (the 're-submission robustness'
        paragraph). §13.8 'Why the prompt is preserved verbatim': stripping breaks every re-submission path
        (Pi re-feeds STORED text; no hook to override the prefill); verbatim is strictly better. §10 Edge Cases:
        'the prompt is stored verbatim — #@a.txt stays in place, so re-open re-triggers'. §11 case #1: the user
        bubble reads 'Review #@a.ts' verbatim."
  section: "§6.4 (re-submission robustness) + §13.8 + §10 + §11 #1"
  critical: "The whole point: r.text / out.text MUST carry '#@' (what gets STORED), or re-open loses the files.
             REOPEN-3 is the keystone — it proves feeding the stored text back re-triggers injection."

# MUST READ — the verbatim engine I'm testing (read-only; the contract)
- file: file-injector.ts
  why: "L1111 injectFiles(text, imagesIn, ctx, bareAt). L1179 count===0 path: return { text, images:imagesIn,
        injected:0, paged:0, blocks:[], details:[] } (text = the ORIGINAL prompt ref — verbatim). L1188 count>0
        path: return { text, images:state.images, injected, paged, blocks, details } (text = the SAME original
        ref — comment L1186 'the prompt carries nothing but the user's original text'). So r.text === prompt
        ALWAYS. L1247-1265 input handler: guards (extension/steer/no-#@/injected===0) → {action:'continue'};
        else {action:'transform', text: event.text, images} (L1265: 'text VERBATIM (event.text, unchanged …
        re-open re-triggers injection; §13.8)'). L1199 before_agent_start: if stash → {message:{customType:
        'fileInjector.injected', content:blocks.join('\\n\\n'), display:true, details:{files}}}; else undefined."
  pattern: "injectFiles is a PURE function of (text, ctx) for the verbatim invariant — text is returned unchanged.
            The input handler returns event.text unchanged. Tests assert text === prompt (the #@ survives)."
  critical: "Both injectFiles paths return the SAME `text` ref — there is no 'strippedText' anywhere (plan 009
             removed it). If you ever see text !== prompt, the verbatim contract regressed. REOPEN-1/3 pin this."

# The test harness (grounded in architecture/test_assertions_analysis.md §7 + the live helpers)
- file: file-injector.test.mjs
  why: "L162 makeMockCtx(cwd) → {ctx:{cwd,hasUI,isProjectTrusted,ui:{notify}}, rec}. L185 captureAllHandlers()
        → calls mod.default(pi) ONCE so input + before_agent_start share the `pending` closure; returns
        {input:[fn], session_start:[…], before_agent_start:[fn]}. L361 FIX={cwd:TMPDIR} (no budget → all whole).
        L350 A_TS=path.join(TMPDIR,'a.ts'); L226 A_TS_CONTENT. L342 buildFixtures() runs at module load → a.ts
        EXISTS before any case. L81 assert(cond,msg); L90 runCase(n,name,fn). L2791 '// 10. Summary …' block."
  pattern: "Mode A: const r = await mod.injectFiles(prompt, [], FIX). Mode B: const {ctx}=makeMockCtx(TMPDIR);
            const h=captureAllHandlers(); const out=await h.input[0]({text,source:'interactive',images:[]},ctx);
            const msg=await h.before_agent_start[0]({},ctx). REUSE these — do NOT add new helpers/fixtures."
  gotcha: "`pending` (the input→before_agent_start stash) is CLOSURE-SCOPED per factory. A SECOND
           captureAllHandlers() = a fresh factory = its own `pending` (initially empty). This is exactly what
           models a 'fresh prompt() invocation on re-open' for REOPEN-3 — drive factory 2's input with the
           stored text from factory 1."

# The DELIV siblings — the exact pattern to mirror (read-only; complementary, not duplicate)
- file: file-injector.test.mjs   # DELIV-1 (L2473), DELIV-2 (L2495), DELIV-3 (L2519), DELIV-6 (L2556)
  why: "DELIV-1/2 already assert text==='#@a.ts' (verbatim) — but their FOCUS is the delivery return shape /
        custom-message STRUCTURE. My REOPEN cases focus on the re-submission CONTRACT (§6.4/§13.8) and add the
        re-open simulation (REOPEN-3) + negative control (REOPEN-4). Mirror their STYLE (runCase + assert with
        JSON-stringified diagnostics); do NOT copy their custom-message-structure asserts (display/details)."
  critical: "REOPEN-1/2 are LEANER than DELIV-1/2 — they assert only the verbatim + delivery facts the
             re-submission contract needs, and cite §6.4/§13.8 as the rationale. Do not re-assert customType/
             display/details.files (DELIV-2 owns that)."

# The baseline reality — the suite is RED (6 pre-existing failures, NOT mine)
- file: file-injector.test.mjs   # F1/F1b/F1d (~L800-820), T1.S1-9/10/12 (L2055-2103)
  why: "These 6 cases FAIL at baseline (144 passed, 6 failed). F1/F1b/F1d depend on the OLD stripping model
        (dedup-after-strip); T1.S1-9/10/12 read the DEAD .prefixLen/.abs fields (scanTokens now returns
        string[]). ALL are P1.M2.T1's main-suite-migration scope — NOT mine. My REOPEN cases pass cleanly
        regardless. I MUST NOT touch these 6 (scope creep into P1.M2.T1)."
  critical: "After my work: 148 passed, 6 failed (my 4 added + green; the 6 unchanged). The gate is 'REOPEN-1..4
             ✓ AND 0 NEW failures' — NOT '0 failed'. Do not 'fix' the 6; do not report them as your problem."

# The architecture scout report — the two invocation modes (background)
- file: plan/009_0d85ac0b1b08/architecture/test_assertions_analysis.md
  why: "§7 'Harness pattern' documents Mode A (direct injectFiles) and Mode B (captureAllHandlers + drive), the
        makeMockCtx shape, and the closure-shared `pending` fact. §0 describes the OLD stripped return shape —
        NOTE: §0 predates plan 009; under verbatim, r.text is the ORIGINAL prompt (not strippedText). Trust the
        LIVE file-injector.ts (quoted above), not §0's 'strippedText' wording."
  section: "§7 (Harness pattern) + §9 (implications). IGNORE §0's strippedText wording (superseded by verbatim)."

# The parallel sibling (no collision) — read for awareness only
- file: plan/009_0d85ac0b1b08/P1M2T2S1/PRP.md
  why: "P1.M2.T2.S1 (parallel) edits relative-imports.test.mjs + import-behavior.test.mjs ONLY (scanTokens
        return-shape migration B1/B4/B6 + 1 comment). Disjoint from this task (which adds to the MAIN suite).
        No file overlap, no case-ID collision."
```

### Current Codebase tree (read-only overview — this task edits ONLY file-injector.test.mjs)

```bash
pi-file-injector/                # HEAD + plan-009 verbatim engine (P1.M1 LANDED)
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (+4 REOPEN cases under a banner before L2791)
├── file-injector.ts             # UNCHANGED (the verbatim engine — LANDED; git diff empty)
├── relative-imports.test.mjs    # NOT edited (parallel P1.M2.T2.S1's scope)
├── import-behavior.test.mjs     # NOT edited (parallel P1.M2.T2.S1's scope)
├── scripts/typecheck.mjs        # untouched (.ts unchanged → trivially clean)
├── package.json / PRD.md / README.md   # untouched (README = P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1S1..P1M2T1S3/{research, PRP.md}   # P1.M1 (verbatim engine) LANDED; P1.M2.T1 (main suite migration) LANDED
    └── P1M2T3S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 banner comment + 4 runCase blocks (REOPEN-1..REOPEN-4) before the Summary block (L2791).
                          #           NO harness change, NO new fixtures, NO new exported helpers, NO migration of existing cases.
# file-injector.ts + relative-imports.test.mjs + import-behavior.test.mjs + scripts/typecheck.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the suite is RED at baseline (144 passed, 6 failed). The 6 failures are PRE-EXISTING and OUT OF
//   SCOPE: F1/F1b/F1d (~L800-820, dedup-after-strip — depend on the OLD model) + T1.S1-9/10/12 (L2055-2103,
//   read DEAD .prefixLen/.abs). They are P1.M2.T1's main-suite-migration job, NOT mine. My 4 REOPEN cases pass
//   cleanly regardless. GATE = "REOPEN-1..4 ✓ AND 0 NEW failures" — NOT "0 failed". Do NOT touch the 6.

// CRITICAL — `pending` (the input→before_agent_start stash) is CLOSURE-SCOPED per factory. A SECOND
//   captureAllHandlers() call = a fresh mod.default(pi) = a fresh factory with its OWN `pending` (initially
//   empty). This is the mechanism REOPEN-3 uses to model a "fresh prompt() invocation on re-open": drive
//   factory 2's input with factory 1's stored out1.text. (Do NOT reuse factory 1's h for the re-open — a
//   fresh factory is the faithful model and proves closure-independence.)

// CRITICAL — injectFiles returns `text` VERBATIM in BOTH paths (file-injector.ts:1179 count===0, L1188 count>0).
//   There is NO strippedText anywhere (plan 009 removed it). architecture/test_assertions_analysis.md §0 still
//   says "strippedText" — that wording is SUPERSEDED. Trust the LIVE .ts. r.text === prompt ALWAYS.

// GOTCHA — a.ts ALREADY EXISTS in TMPDIR (buildFixtures() runs at module load, L342). REUSE it via FIX/A_TS.
//   Do NOT create a new temp file. FIX={cwd:TMPDIR} (L361) means "#@a.ts" resolves to TMPDIR/a.ts.

// GOTCHA — the input handler's guards (file-injector.ts:1248-1253): source==='extension' → continue;
//   streamingBehavior==='steer' → continue; !event.text.includes("#@") → continue; injected===0 → continue.
//   REOPEN-2/3/4 use source:'interactive' + a '#@' substring → reach the transform branch. REOPEN-4 uses a
//   prompt with NO '#@' → the no-#@ guard fires → continue (the regression's failure mode).

// GOTCHA — case-ID collision: DELIV-1..6 (delivery), F1/F1b/F1d (dedup), T1.S1-9/10/12 (scanTokens) already
//   exist in the same file. Use REOPEN-1..REOPEN-4 (distinct prefix). The parallel P1.M2.T2.S1 uses B1/B4/B6
//   in the AUX suites — no collision (different file).

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti (alias map, file-injector.test.mjs:39-66). No test runner.
//   The gate is `node ./file-injector.test.mjs`. npm run typecheck is belt-and-suspenders (.ts untouched → 0 errors).
```

## Implementation Blueprint

### Data models and structure

No new data models. The cases assert against the LANDED verbatim engine by reusing existing helpers:

```js
// Mode A (REOPEN-1): direct pipeline call.
const r = await mod.injectFiles(prompt, [], FIX);   // r = { text, images, injected, paged, blocks, details }
// r.text === prompt ALWAYS (verbatim — the #@ survives; this is what Pi STORES).

// Mode B (REOPEN-2/3/4): handler capture + manual drive.
const { ctx } = makeMockCtx(TMPDIR);                // ctx = { cwd:TMPDIR, hasUI, isProjectTrusted, ui:{notify} }
const h = captureAllHandlers();                      // h = { input:[fn], session_start:[…], before_agent_start:[fn] }
const out = await h.input[0]({ text, source:"interactive", images:[] }, ctx);  // → {action, text, images}
const msg = await h.before_agent_start[0]({}, ctx);                             // → {message:{…}} | undefined
// out.text === event.text ALWAYS (verbatim). msg.message.content carries the <file> blocks (delivered to the model).
```

### The 4 cases (exact specs — encode as runCase blocks)

```js
// ── P1.M2.T3.S1 (plan/009): verbatim re-submission regression ──
// ─────────────────────────────────────────────────────────────────────
// Pins PRD §6.4 (the prompt is preserved byte-for-byte; re-submission robustness) + §13.8 (stripping breaks
// every re-submission path) + §10 (the prompt is stored verbatim — #@ stays, so re-open re-triggers).
// The keystone is REOPEN-3: it feeds the STORED text back through a FRESH factory and proves injection
// RE-TRIGGERS — the exact invariant that would silently break (files vanish on cancel/fork//tree) if #@ were
// ever stripped again. REUSE makeMockCtx/captureAllHandlers/FIX/A_TS/A_TS_CONTENT/assert/runCase — no new
// fixtures/helpers. Calls injectFiles (Mode A) and captureAllHandlers (Mode B) only — no scanTokens, no dedup.
// Prefix REOPEN- (no collision with DELIV-/F1/T1.S1-).

// REOPEN-1 — RETURN SHAPE (Mode A, contract a). The stored prompt text carries #@ verbatim.
await runCase("REOPEN-1", "injectFiles return shape: r.text is the verbatim prompt (#@ preserved — what gets stored); blocks/details len 1", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.text === "Review #@a.ts", `r.text must be the verbatim prompt (#@ preserved — §6.4; this is what Pi STORES so re-open re-triggers), got ${JSON.stringify(r.text)}`);
  assert(r.injected === 1, `injected===1 (one file delivered), got ${r.injected}`);
  assert(Array.isArray(r.blocks) && r.blocks.length === 1, `r.blocks is a string[] of length 1, got ${JSON.stringify(r.blocks?.length)}`);
  assert(r.blocks[0].includes('<file name="' + A_TS + '">'), `r.blocks[0] is the a.ts <file> block, got ${JSON.stringify(r.blocks?.[0]?.slice(0, 40))}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `r.details is a FileDetail[] of length 1, got ${JSON.stringify(r.details?.length)}`);
});

// REOPEN-2 — HANDLER-LEVEL (Mode B, contract b). The input handler stores #@ verbatim AND before_agent_start
// still delivers the block to the model. (Leaner than DELIV-2 — asserts only the re-submission-relevant facts.)
await runCase("REOPEN-2", "handler-level: input stores #@ verbatim (action:transform) + before_agent_start delivers the <file> block", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers(); // ONE factory → input + before_agent_start share the `pending` closure
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `input must transform (injection happened), got '${out.action}'`);
  assert(out.text === "Review #@a.ts", `input text is VERBATIM (event.text, #@ preserved — §6.4/§13.8; this is what gets stored), got ${JSON.stringify(out.text)}`);
  const msg = await h.before_agent_start[0]({}, ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message && typeof msg.message.content === "string" && msg.message.content.includes("<file name="),
    `before_agent_start must deliver the <file> block to the model (msg.message.content), got ${JSON.stringify(msg)}`);
});

// REOPEN-3 — RE-OPEN SIMULATION (Mode B ×2, contract c — the KEYSTONE REGRESSION). Pi re-feeds the STORED text
// on cancel/fork//tree re-open. Feed factory-1's stored text (out1.text) into a FRESH factory-2 input and prove
// injection RE-TRIGGERS (and the block is re-delivered). If #@ had been stripped, out1.text would be "Review a.ts"
// → factory-2 input would return {action:"continue"} → files would silently vanish. This case catches that.
await runCase("REOPEN-3", "re-open simulation: feeding the STORED text (verbatim #@) back into a FRESH factory re-triggers injection (keystone — §13.8)", async () => {
  // Factory 1 — the original submission. out1.text is what Pi STORES.
  const { ctx: ctx1 } = makeMockCtx(TMPDIR);
  const h1 = captureAllHandlers();
  const out1 = await h1.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx1);
  assert(out1.action === "transform", `1st submission must inject, got '${out1.action}'`);
  assert(out1.text === "Review #@a.ts", `the STORED text (out1.text) must still contain #@ (verbatim — §6.4), got ${JSON.stringify(out1.text)}`);

  // Simulate re-open: Pi re-feeds the STORED text into a FRESH prompt() invocation → a fresh factory closure.
  // (pending is closure-scoped; a 2nd captureAllHandlers() = its own pending — a faithful fresh-invocation model.)
  const { ctx: ctx2 } = makeMockCtx(TMPDIR);
  const h2 = captureAllHandlers();
  const out2 = await h2.input[0]({ text: out1.text, source: "interactive", images: [] }, ctx2);
  assert(out2.action === "transform", `RE-OPEN must RE-TRIGGER injection (the stored text still has #@) — got '${out2.action}' (a stripping regression would make this 'continue' → files vanish, §13.8)`);
  assert(out2.text === "Review #@a.ts", `re-opened text is still verbatim, got ${JSON.stringify(out2.text)}`);
  // And the block is re-delivered to the model on re-open (proves files don't vanish end-to-end):
  const msg2 = await h2.before_agent_start[0]({}, ctx2);
  assert(msg2 && msg2.message && typeof msg2.message.content === "string" && msg2.message.content.includes("<file name="),
    `re-open must RE-DELIVER the <file> block to the model (before_agent_start), got ${JSON.stringify(msg2)}`);
});

// REOPEN-4 — NEGATIVE CONTROL (Mode B, the regression's failure mode). A stored prompt with NO #@ re-triggers
// nothing ({action:"continue"}). This is the EXACT failure mode a stripping regression would produce: stripped
// stored text → no #@ on re-open → continue → files vanish. REOPEN-3 passes only because verbatim preserves #@.
await runCase("REOPEN-4", "negative control: a stored prompt with NO #@ re-triggers nothing (continue) — the failure mode a stripping regression would produce", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  // "Review a.ts" models a STRIPPED stored prompt (no #@). Re-open finds no trigger → continue.
  const out = await h.input[0]({ text: "Review a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "continue", `a prompt with NO #@ must NOT inject (action:continue) — this is the trap REOPEN-3 avoids by preserving #@, got '${out.action}'`);
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the banner + 4 runCase blocks (file-injector.test.mjs, before the Summary block at L2791)
  - ADD a banner comment: `// ── P1.M2.T3.S1 (plan/009): verbatim re-submission regression ──` (cite PRD
    §6.4/§13.8; note: REOPEN-3 is the keystone; reuse makeMockCtx/captureAllHandlers/FIX/A_TS; no scanTokens/dedup).
  - ADD the 4 runCase blocks (REOPEN-1..REOPEN-4) verbatim per the blueprint above.
  - NAMING: `REOPEN-1`..`REOPEN-4` (NOT `DELIV-`/`F1`/`T1.S1-` — collide with existing cases in the same file).
  - PLACEMENT: BEFORE the `// 10. Summary + cleanup + exit.` block (L2791); after the DELIV-6 case (~L2560) is natural.
  - DO NOT: add fixtures (reuse a.ts via FIX/A_TS); add helpers (reuse makeMockCtx/captureAllHandlers/assert/runCase);
    modify existing cases (DELIV-/F1/T1.S1-); touch file-injector.ts; touch the aux suites; touch scripts/typecheck.mjs.

Task 2: VERIFY the gate
  - RUN: node ./file-injector.test.mjs → EXPECT "Result: 148 passed, 6 failed." (current 144 + my 4), exit 1
    (the 6 pre-existing failures keep exit code 1 — they are NOT mine). The 4 REOPEN cases print ✓.
    LOAD-BEARING: the 4 REOPEN ✓ appear; NO existing case flips from ✓ to ✗ (no new failures beyond the known 6).
  - RUN: node ./file-injector.test.mjs 2>&1 | grep -E "REOPEN-|Result:" → 4 "✓ case REOPEN-…" lines; "Result: 148 passed, 6 failed."
  - RUN: git diff --stat file-injector.ts → EXPECT EMPTY (tests only).
  - RUN: git diff --stat → EXPECT ONLY file-injector.test.mjs (no .ts, no aux suites, no scripts/typecheck.mjs).
  - (belt-and-suspenders) npm run typecheck → 0 errors (the .ts is untouched → trivially clean).
  - IF a REOPEN case fails:
      REOPEN-1 text !== "Review #@a.ts" → the verbatim contract regressed in injectFiles (file-injector.ts:1188) — NOT this task's code; report it.
      REOPEN-2 input action !== transform → a guard regressed (file-injector.ts:1248-1253) OR ctx cwd wrong — check makeMockCtx(TMPDIR).
      REOPEN-3 out2.action === "continue" → #@ is being STRIPPED (the exact regression this catches) — report it; do NOT weaken the assert.
      REOPEN-4 action !== continue → the no-#@ guard (file-injector.ts:1250) regressed — report it.
      "Cannot find module" / jiti error → the harness alias (L39-66) was disturbed — NOT this task's code; report it.
```

### Implementation Patterns & Key Details

```js
// Mode A — direct pipeline (REOPEN-1): assert the verbatim return shape.
const r = await mod.injectFiles("Review #@a.ts", [], FIX);   // FIX={cwd:TMPDIR}; a.ts exists via buildFixtures()
r.text === "Review #@a.ts";   // ALWAYS (verbatim — §6.4); this is what Pi STORES

// Mode B — handler capture + drive (REOPEN-2/3/4): assert the input handler stores verbatim + before_agent_start delivers.
const { ctx } = makeMockCtx(TMPDIR);
const h = captureAllHandlers();
const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
out.action === "transform";  out.text === "Review #@a.ts";   // stored verbatim
const msg = await h.before_agent_start[0]({}, ctx);
msg.message.content.includes("<file name=");                 // block delivered to the model

// The keystone re-open pattern (REOPEN-3): feed factory-1's STORED text into a FRESH factory-2 input.
const { ctx: ctx2 } = makeMockCtx(TMPDIR);
const h2 = captureAllHandlers();                              // FRESH factory = own `pending` closure (a fresh prompt() model)
const out2 = await h2.input[0]({ text: out1.text, source: "interactive", images: [] }, ctx2);
out2.action === "transform";                                  // injection RE-TRIGGERED (the stored text still has #@)
// If #@ were stripped, out1.text would be "Review a.ts" → out2.action would be "continue" → files vanish. REOPEN-4 pins that failure mode.

// CRITICAL: reuse ONLY makeMockCtx/captureAllHandlers/FIX/A_TS/A_TS_CONTENT/assert/runCase. No new fixtures/helpers.
// CRITICAL: the suite is RED at baseline (6 pre-existing failures) — your gate is "REOPEN ✓ + 0 NEW failures", NOT "0 failed".
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - file-injector.test.mjs: +1 banner comment + 4 runCase blocks (REOPEN-1..REOPEN-4) before the Summary block (L2791).
    REUSES makeMockCtx (L162), captureAllHandlers (L185), FIX (L361), A_TS (L350), A_TS_CONTENT (L226), assert (L81),
    runCase (L90), mod (the jiti-loaded extension). NO new fixtures; NO harness change; NO new exported helpers;
    NO migration of existing cases.
NO_CHANGES: file-injector.ts (git diff empty — the verbatim engine is LANDED), relative-imports.test.mjs +
            import-behavior.test.mjs (parallel P1.M2.T2.S1's scope), scripts/typecheck.mjs, package.json, PRD.md,
            README.md (P1.M2.T4.S1), all plan/ files.
NO_LOGIC_CHANGE: the engine is UNCHANGED — this task adds TESTS that pin the landed verbatim re-submission contract.
```

## Validation Loop

### Level 1: The suite run (the authoritative gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 148 passed, 6 failed." (current baseline 144 + my 4). The 6 failures are PRE-EXISTING
#   (F1/F1b/F1d/T1.S1-9/T1.S1-10/T1.S1-12 — P1.M2.T1's scope, NOT mine). Exit code is 1 BECAUSE of those 6,
#   not because of my cases. LOAD-BEARING: the 4 REOPEN cases print ✓; NO existing case flips ✓→✗.
# If a REOPEN case shows ✗ → see Task 2's failure-triage (a REOPEN failure is almost certainly a real verbatim
#   regression to REPORT — REOPEN-3 ✗ in particular means #@ is being stripped again, the exact bug this catches).
# If an EXISTING case flips to ✗ beyond the known 6 → you accidentally edited it or the harness; revert.
```

### Level 2: Targeted checks (the 4 new cases + scope)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "REOPEN-|Result:" | head
# Expected: 4 "✓ case REOPEN-…" lines; "Result: 148 passed, 6 failed.". ZERO "✗ case REOPEN-" lines.

# Scope integrity — only file-injector.test.mjs changed; the .ts, the aux suites, and scripts are untouched:
git diff --stat file-injector.ts                    # expect EMPTY (the engine is LANDED; tests only)
git diff --stat file-injector.test.mjs              # expect the file (+banner + 4 cases)
git diff --stat relative-imports.test.mjs import-behavior.test.mjs scripts/typecheck.mjs   # expect EMPTY
git diff --stat                                     # expect ONLY file-injector.test.mjs
```

### Level 3: Belt-and-suspenders (typecheck — the .ts is untouched → trivially clean)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# (The .mjs is untyped; the .ts is unchanged → 0 errors regardless. Confirms no accidental .ts edit.)
```

### Level 4: Cross-reference the landed contract (read-only — confirm the behavior my cases pin)

```bash
cd /home/dustin/projects/pi-file-injector
grep -n "return { text" file-injector.ts                       # injectFiles returns text verbatim (L1179 + L1188)
grep -n 'text: event.text' file-injector.ts                    # the input handler stores event.text verbatim (L1265)
grep -n 'customType: "fileInjector.injected"' file-injector.ts # before_agent_start delivers the block (L1199+)
# Expected: hits at each — these are the exact contract lines REOPEN-1..4 pin.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → "Result: 148 passed, 6 failed." (my 4 added + green; the 6 pre-existing failures UNCHANGED).
- [ ] The 4 `REOPEN` cases print ✓; ZERO `✗ case REOPEN-` lines; NO existing case flips ✓→✗ beyond the known 6.
- [ ] `git diff --stat file-injector.ts` is **EMPTY**; `git diff --stat` touches ONLY `file-injector.test.mjs`.

### Feature Validation (the contracts the 4 cases pin)

- [ ] REOPEN-1: `injectFiles("Review #@a.ts", [], FIX)` → `text==="Review #@a.ts"`, `blocks.length===1`, `details.length===1`, `injected===1`.
- [ ] REOPEN-2: input `action==="transform"` + `text==="Review #@a.ts"`; `before_agent_start` `content` includes `<file name=`.
- [ ] REOPEN-3: factory-1 `out1.text==="Review #@a.ts"`; factory-2 (fed `out1.text`) `out2.action==="transform"` + `out2.text` verbatim + factory-2 `before_agent_start` re-delivers the block.
- [ ] REOPEN-4: input `"Review a.ts"` (no `#@`) → `action==="continue"`.

### Code Quality Validation

- [ ] Calls `mod.injectFiles` (REOPEN-1) and `captureAllHandlers` + `h.input[0]`/`h.before_agent_start[0]` (REOPEN-2/3/4) — no `scanTokens`, no dedup sentinels, no rendering.
- [ ] REUSES `makeMockCtx`/`captureAllHandlers`/`FIX`/`A_TS`/`A_TS_CONTENT`/`assert`/`runCase` — no new fixtures/helpers.
- [ ] Case IDs `REOPEN-1`..`REOPEN-4` (non-colliding with `DELIV-`/`F1`/`T1.S1-` in the same file, and with the aux suites' `B1`/`4f` etc.).
- [ ] REOPEN-3 uses a FRESH `captureAllHandlers()` for the re-open (faithful fresh-factory model; proves closure-independence of the `pending` stash).

### Documentation

- [ ] None (test additions only — item §5 "DOCS: none"). No README/PRD change (README = P1.M2.T4.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT "fix" the 6 pre-existing failures** (`F1`/`F1b`/`F1d`/`T1.S1-9`/`T1.S1-10`/`T1.S1-12`). They are
  P1.M2.T1's main-suite-migration scope (dedup-after-strip + dead `.prefixLen`/`.abs` reads). Touching them is
  scope creep; it will conflict with P1.M2.T1 and obscure whether YOUR cases are green. Your gate is
  "REOPEN-1..4 ✓ AND 0 NEW failures", NOT "0 failed".
- ❌ **Do NOT weaken REOPEN-3 if it fails.** REOPEN-3 is the keystone regression gate — if `out2.action` is
  `"continue"`, `#@` is being stripped (the exact bug this task exists to catch). REPORT it as a real engine
  regression; do not change the assert to tolerate `continue`.
- ❌ **Do NOT reuse factory-1's `h` for the re-open in REOPEN-3.** Use a FRESH `captureAllHandlers()` (its own
  `pending` closure). A fresh factory faithfully models a fresh `prompt()` invocation and proves the behavior
  is closure-independent. Reusing `h` would conflate the two submissions and miss the point.
- ❌ **Do NOT use the `DELIV-` prefix** (collides with DELIV-1..6 in the same file), `F1` (collides with the
  dedup cases), or `T1.S1-` (collides with the scanTokens cases). Use `REOPEN-1`..`REOPEN-4`.
- ❌ **Do NOT create a new temp file.** `a.ts` already exists in TMPDIR (`buildFixtures()` runs at module load,
  L342). Reuse it via `FIX`/`A_TS`. Creating `a.ts` again is redundant and risks a write collision.
- ❌ **Do NOT add new helpers** (a local `runViaHandler`/`storedText`/etc.). Reuse `makeMockCtx`/
  `captureAllHandlers`/`assert`/`runCase` exactly as DELIV-2 does. New exported helpers are a harness change
  outside this task's scope.
- ❌ **Do NOT edit `file-injector.ts`** (the verbatim engine is LANDED) **or `relative-imports.test.mjs`/
  `import-behavior.test.mjs`/`scripts/typecheck.mjs`**. `git diff --stat` for all four must be empty.
- ❌ **Do NOT trust architecture/test_assertions_analysis.md §0's "strippedText" wording.** It predates plan 009.
  Under verbatim, `r.text`/`out.text` is the ORIGINAL prompt (`#@` preserved). Trust the LIVE file-injector.ts
  (L1179/L1188/L1265). If you assert `r.text === "Review a.ts"` (stripped), your case will FAIL — the contract
  is verbatim.
- ❌ **Do NOT re-assert the custom-message STRUCTURE** (`customType`/`display`/`details.files` shape) in
  REOPEN-2/3. DELIV-2 owns that. REOPEN-2/3 assert only the re-submission-relevant facts (`content` includes
  `<file name=`). Duplicating DELIV-2's structure asserts is noise.

---

## Confidence Score: 9/10

A tightly-bounded test-addition task against LANDED, verbatim code (`injectFiles` returns `text` verbatim,
file-injector.ts:1179/1188; input handler returns `text: event.text`, L1265; `before_agent_start` delivers the
custom message, L1199). Each of the 4 cases is grounded in the **live** verbatim contract (not the
superseded §0 "strippedText" wording), and the keystone (REOPEN-3) is the exact regression plan 009 was
created to prevent (stripping → files vanish on re-open). The PRP nails the one non-obvious harness fact —
`pending` is **closure-scoped per factory**, so a second `captureAllHandlers()` models a fresh `prompt()`
invocation (the re-open) — and reuses only `makeMockCtx`/`captureAllHandlers`/`FIX`/`A_TS` (no new
fixtures/helpers). It is explicit and honest about the **RED baseline** (144 passed, 6 failed — the 6 are
P1.M2.T1's scope, NOT mine) so the implementing agent does not mistake them for its own failures or try to
"fix" them. It uses the `REOPEN-` prefix to avoid collision with `DELIV-`/`F1`/`T1.S1-` and the parallel
aux-suite task. The -1 reserves for the cross-suite RED baseline (the agent must read "148 passed, 6 failed"
correctly and not panic) and the small chance the agent reuses factory-1's `h` instead of a fresh factory in
REOPEN-3 (the PRP forbids it and explains why). The implementing agent adds a banner + 4 `runCase` blocks and
runs one command.