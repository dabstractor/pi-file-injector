# Research Notes — P1.M2.T3.S1 (plan/009): return-shape / handler-level / re-open regression tests

## What this task is

A **test-addition** task: add 3-4 NEW `runCase` blocks to `file-injector.test.mjs` that pin the
**verbatim re-submission contract** (PRD §6.4 "Assembly & shared state" + §13.8 "Why the prompt is
preserved verbatim"). The engine already delivers the prompt verbatim (P1.M1 LANDED). These tests
prove `#@` SURVIVES in the stored text so cancel/fork/`/tree` re-open RE-TRIGGERS injection. No `.ts`
change, no aux-suite change, no README.

## Scope boundaries (verified — NO collision)

- **P1.M2.T3.S1 (MINE)**: ADDS new cases to `file-injector.test.mjs` ONLY. Prefix `REOPEN-`.
- **P1.M2.T2.S1 (PARALLEL)**: edits `relative-imports.test.mjs` + `import-behavior.test.mjs` ONLY.
  Disjoint file → zero collision.
- **DELIV-1..6** (already in file-injector.test.mjs, plan 008): pin the DELIVERY mechanism (return
  shape, custom message, one-shot stash). My REOPEN cases pin the VERBATIM RE-SUBMISSION contract.
  Different prefix, different documented rationale, complementary.

## The verbatim contract (confirmed live in file-injector.ts)

- **`injectFiles` (L1111-1188)** returns `text` VERBATIM in BOTH paths:
  - count===0 (L1179): `return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }`
    → `text` = the original prompt ref.
  - count>0 (L1188): `return { text, images: state.images, injected, paged, blocks, details }`
    → `text` = the SAME original prompt ref (comment L1186: "the prompt carries nothing but the user's
    original text").
  - So `r.text === prompt` ALWAYS (the `#@` is preserved). This is what gets STORED.
- **Input handler (L1247-1265)**: guards (extension source / steer / no `#@` substring / injected===0)
  → `{action:"continue"}`; else `{action:"transform", text: event.text, images}`. Comment L1265:
  "text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open re-triggers
  injection; §13.8)".
- **before_agent_start (L1199+)**: if stash exists → `{message:{customType:"fileInjector.injected",
  content: blocks.join("\n\n"), display:true, details:{files}}}`; else `undefined`.

## The re-open model (PRD §6.4 / §13.8)

Pi re-feeds the **STORED** user-message text into `prompt()` on cancel/fork/`/tree` navigate
(verified in agent-session.ts: `navigateTree()` → `_extractUserMessageText` → `editor.setText`).
There is NO extension hook to override that prefill. So if the stored text had `#@` stripped, the
re-submitted prompt has no `#@` → input handler returns `continue` → **files silently vanish**.
Preserving `#@` verbatim means re-open re-triggers injection automatically.

## Test harness (architecture/test_assertions_analysis.md §7 — two invocation modes)

### Mode A — direct pipeline: `mod.injectFiles(prompt, imagesIn, ctx, bareAt)`
Returns `{ text, images, injected, paged, blocks, details }`.

### Mode B — handler capture: `captureAllHandlers()` + manual drive
```js
function captureAllHandlers() {           // file-injector.test.mjs:185
  const handlers = {};
  const pi = { on: (ev, cb) => { (handlers[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} };
  mod.default(pi);                          // ONE factory → input + before_agent_start share the `pending` closure
  return handlers;                          // { input:[fn], session_start:[…], before_agent_start:[fn] }
}
```
Drive: `h.input[0]({text, source, images}, ctx)` → `{action, text, images}`;
`h.before_agent_start[0]({}, ctx)` → `{message:{…}} | undefined`.

**KEY**: `pending` (the input→before_agent_start stash) is CLOSURE-SCOPED per factory. A SECOND
`captureAllHandlers()` call = a fresh factory = its own `pending` (initially empty). This is exactly
what models a "fresh prompt() invocation on re-open".

## Helpers / fixtures I reuse (all pre-existing, no new fixtures needed)

- `makeMockCtx(cwd)` (L162) → `{ctx:{cwd, hasUI, isProjectTrusted, ui:{notify}}, rec}`.
- `captureAllHandlers()` (L185) → `{input:[fn], before_agent_start:[fn], …}`.
- `FIX = { cwd: TMPDIR }` (L361) — no budget → O(1 fallback → all whole. Perfect for return-shape.
- `A_TS = path.join(TMPDIR, "a.ts")` (L350); `A_TS_CONTENT` (L226) — the a.ts fixture.
- `buildFixtures()` runs at module load (L342) → `a.ts` EXISTS in TMPDIR before any case. REUSE it.
- `assert(cond, msg)` (L81); `runCase(n, name, fn)` (L90) — the case harness.
- The Summary block is at L2791 (`// 10. Summary + cleanup + exit.`); cases run before it.

## The DELIV siblings (the exact pattern to mirror — file-injector.test.mjs:2473-2560)

- **DELIV-1** (L2473): direct `injectFiles("Review #@a.ts", [], FIX)` → asserts `r.text === "Review #@a.ts"`
  (verbatim), `!r.text.includes("---")`, `!r.text.includes("<file")`, `r.blocks.length===1`,
  `r.details.length===1`, detail shape. (Note: DELIV-1's NAME still says "stripped" — stale, migrated to
  verbatim by P1.M2.T1. Its FOCUS is the delivery return shape.)
- **DELIV-2** (L2495): `captureAllHandlers()` → drive input → `out.action==="transform"`, `out.text` verbatim;
  drive before_agent_start → `msg.message.customType`, `content.includes(<file name=…>)`, `display===true`,
  `details.files`. (FOCUS: the custom-message STRUCTURE.)
- **DELIV-3** (L2519): one-shot stash (2nd before_agent_start → undefined).

My REOPEN cases are LEANER and focus on the re-submission contract. REOPEN-1/2 overlap DELIV-1/2 in
*what they assert* but differ in *documented rationale* (verbatim re-open, §6.4/§13.8) — complementary
regression gates, not duplicates.

## BASELINE (critical — the suite is currently RED)

`node ./file-injector.test.mjs` → **144 passed, 6 failed.** The 6 failures are PRE-EXISTING and
**OUT OF SCOPE** (P1.M2.T1's main-suite migration; not mine, not the parallel P1.M2.T2.S1's):
- `F1` / `F1b` / `F1d` (L~800-820): per-token dedup cases that DEPEND on the OLD stripping model
  ("stripping #@ post-inject makes dedup bidirectional"). Under verbatim delivery their premise is
  obsolete — they need migration (P1.M2.T1's job).
- `T1.S1-9` / `T1.S1-10` / `T1.S1-12` (L2055-2103): `scanTokens` shape tests reading the DEAD
  `.prefixLen` / `.abs` fields (plan 009 removed them — `scanTokens` now returns `string[]`). Same
  class as the aux-suite B1/B4/B6 the parallel P1.M2.T2.S1 fixes; P1.M2.T1 owns the main-suite analogs.

**My gate**: REOPEN-1..4 print ✓ (4 new passes → 148 passed); the 6 pre-existing failures stay EXACTLY
as-is (6 failed); `git diff --stat` touches ONLY `file-injector.test.mjs`. I must NOT touch F1/F1b/F1d/
T1.S1-9/10/12 — doing so is scope creep into P1.M2.T1.

## The 4 REOPEN cases (design — directly maps to the contract)

- **REOPEN-1** (contract a — RETURN SHAPE): direct `injectFiles("Review #@a.ts", [], FIX)` → `text ===
  "Review #@a.ts"` (verbatim, #@ preserved — what gets STORED), `blocks.length===1`, `details.length===1`,
  `injected===1`. Mode A.
- **REOPEN-2** (contract b — HANDLER-LEVEL): `captureAllHandlers()` → drive input → `out.action==="transform"`,
  `out.text === "Review #@a.ts"` (verbatim); drive before_agent_start → `msg.message.content` includes
  `<file name=` (block delivered to model). Mode B.
- **REOPEN-3** (contract c — RE-OPEN SIMULATION, the KEY regression): factory 1 input → `out1.text` (stored,
  verbatim). Feed `out1.text` back to a FRESH factory 2 input → `out2.action==="transform"` (injection
  RE-TRIGGERED) + `out2.text` verbatim. ALSO drive factory 2 before_agent_start → block re-delivered (proves
  files don't vanish on re-open). Mode B ×2.
- **REOPEN-4** (the negative control — "if stripped, files vanish"): feed a prompt with NO `#@` ("Review a.ts")
  to input → `action === "continue"` (no injection). This documents WHY REOPEN-3 is a meaningful gate: it's
  the exact failure mode a stripping regression would produce.

No new fixtures (reuse a.ts). No new helpers (reuse makeMockCtx/captureAllHandlers/FIX/A_TS/assert/runCase).
Prefix `REOPEN-` (no collision with DELIV-/F1/T1.S1-). Placement: before the Summary block (L2791), after
DELIV-6.