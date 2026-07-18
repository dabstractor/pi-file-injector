---
name: "P1.M2.T2.S1 (plan/008) — Delivery + custom-message + stash lifecycle tests (6 new cases in file-injector.test.mjs pinning the injectFiles return shape, the before_agent_start custom message, and the one-shot pending stash)"
prd_ref: "PRD §6.2 (Delivery: a custom message returned from before_agent_start — {customType, content: blocks.join, display:true, details:{files}}), §6.4 (Assembly & shared state — two returns; the pending stash handoff; clear unconditionally), §11 #33-41 (display/model-input test matrix), §12.20 (Two hooks, one stash — one-shot per prompt), §12.21/§12.22 (one custom message; details is renderer-only)"
target_file: "./file-injector.test.mjs"   # ADD 6 new runCase blocks under a banner (no .ts change, no harness change, no migration of existing cases)
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (0 failed; my 6 pass; no existing regression)
depends_on: "P1.M1.T1.S2 (injectFiles return +blocks/+details — LANDED, file-injector.ts:1116) + P1.M1.T2.S1 (input/before_agent_start split + pending CLOSURE stash — LANDED, file-injector.ts:1150-1211) + P1.M1.T2.S2 (renderInjectedMessage exported — LANDED) + P1.M2.T1.S1 (migrate file-injector.test.mjs ~170 assertions to r.blocks/r.details — the baseline is GREEN when this task runs; the currently-failing 25 markdown/bare-@/config cases are S1's migration scope, NOT mine)."
consumed_by: "P1.M2.T2.S2 (renderer output + defensive fallback tests — a sibling; it tests renderInjectedMessage, NOT the delivery/stash lifecycle this task pins), P1.M2.T3.S1 (README Mode B)."
---

# PRP — P1.M2.T2.S1 (plan/008): Delivery + custom-message + stash lifecycle tests

> **Scope flag:** This is a **test-addition** task. The code under test is **already landed** (the injectFiles
> return shape + the input/before_agent_start split + the one-shot `pending` closure stash). I add **6 new
> `runCase` blocks** to `file-injector.test.mjs` that pin three things the existing suite only partially or
> never covers: (1) the new `injectFiles` return shape (`{text(stripped), blocks: string[], details: FileDetail[]}`);
> (2) the full `before_agent_start` **custom-message contract** (`{customType, content: blocks.join("\n\n"),
> display:true, details:{files}}`); (3) the **one-shot `pending` stash lifecycle** (set by input only when
> injected>0; read-and-cleared once by before_agent_start; `undefined` on no-#@ / extension-source / second-fire).
> **No `.ts` change, no harness change, no migration of existing cases.** I REUSE the existing `captureAllHandlers()`
> helper (one factory → shared `pending` closure) + `makeMockCtx` + `FIX`/`A_TS`/`B_TS` fixtures.

---

## Goal

**Feature Goal:** Pin the custom-message delivery model (PRD §6.2/§6.4/§12.20) as runnable regression cases so a
future refactor that breaks the return shape, the custom-message contract, or the stash lifecycle is caught
deterministically — covering PRD §11 #33-41 (display/model-input matrix) at the unit/handler level.

**Deliverable:** 6 new `runCase` blocks in `file-injector.test.mjs` under a `// ── P1.M2.T2.S1 (plan/008):
delivery + custom-message + stash lifecycle ──` banner (cases `DELIV-1`…`DELIV-6`), reusing existing helpers
and fixtures. No other file is touched.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **0 failed**, exit 0; the 6 `DELIV` cases print `✓`; no existing case regresses.
2. Case `DELIV-1` (return shape): direct `injectFiles("Review #@a.ts")` → `r.text==="Review a.ts"` (stripped,
   no `---`, no `<file`); `r.blocks` is a `string[]` length 1; `r.details` is a `FileDetail[]` length 1 with
   `{path===A_TS, kind==="text", chars===A_TS_CONTENT.length, lines===newline-count+1}`.
3. Case `DELIV-2` (custom message): `captureAllHandlers()` → input[0] → before_agent_start[0] → the returned
   `message` has `customType==="fileInjector.injected"`, `content` carrying exactly one `<file>` block (=
   `blocks.join("\n\n")` for one file), `display===true`, `details.files` an array length 1 with the a.ts detail.
4. Cases `DELIV-3/4/5` (stash lifecycle): one-shot (2nd before_agent_start → `undefined`); no-#@ input →
   before_agent_start `undefined`; `source:"extension"` input → before_agent_start `undefined`.
5. Case `DELIV-6` (multi-file details): `injectFiles("Diff #@a.ts vs #@b.ts")` → `r.blocks.length===2` AND
   `r.details.length===2`, `details[0].path===A_TS`, `details[1].path===B_TS` (emission order, parallel to blocks).
6. `git diff --stat file-injector.ts` is **EMPTY** (the code is landed; this task adds tests only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` — and especially a future refactorer
of the delivery model (e.g. someone tempted to re-append blocks to the user message, or to change the
custom-message shape, or to forget the one-shot stash clear).

**Use Case:** `git pull && node ./file-injector.test.mjs` → green, with explicit cases proving: the user message
is just the stripped prompt; the model still gets the `<file>` blocks via the before_agent_start custom message;
the stash is one-shot; and a no-`#@` / extension-source prompt never produces a phantom custom message.

**Pain Points Addressed:** The delivery refactor (P1.M1) deliberately moved blocks OUT of the user message and
into a custom message (PRD §6.2/§13.7). The existing suite was MIGRATED to the new shape (P1.M2.T1.S1), but no
case directly pins the **return-shape contract** (`blocks`/`details` arrays), the **full custom-message shape**,
or the **stash lifecycle** (one-shot, no-phantom). Without these, a regression that re-appends blocks, drops
`display:true`, or fails to clear `pending` would slip through. Case 12 covers a sliver (customType +
content.includes); these 6 cases close the gap.

## Why

- **The delivery model is the riskiest part of the refactor.** Moving bytes from the user message into a separate
  custom message (returned from `before_agent_start`, persisted, sent to the LLM via `convertToLlm`) is a
  fundamental structural change (PRD §13.7). Its three load-bearing contracts — the return shape, the custom
  message, the one-shot stash — each deserve a dedicated pin.
- **Case 12 only proves it works once; it doesn't pin the contract.** Case 12 checks `customType` + `content.includes`
  + notify for the happy path. It does NOT assert: `r.blocks`/`r.details` are arrays of the right length with the
  right shape; `display===true`; `details.files` carries the per-file metadata; the stash is cleared after one read;
  a no-`#@` or extension-source prompt leaves the stash empty. Those are exactly the properties that could silently
  regress (e.g. someone adds a `display:false`, or forgets `pending=null`, or drops `details`).
- **The stash lifecycle is subtle and easy to break.** `pending` is a CLOSURE var shared between two handlers
  (input sets it; before_agent_start reads+clears it). PRD §12.20 is explicit: "Clear `pending` unconditionally
  in `before_agent_start` (one-shot per prompt) so a later no-`#@` prompt never re-delivers a stale stash." Without
  a test, a future change that reads-but-doesn't-clear (or clears-but-then-returns) would re-deliver stale files
  on the next prompt — a silent, nasty bug. Cases DELIV-3/4/5 lock it.
- **Decoupled from the renderer tests.** The renderer (`renderInjectedMessage`) is P1.M2.T2.S2's scope. This task
  pins DELIVERY (the data + the stash), not DISPLAY (the green box). The custom message's `details` field is the
  handshake between delivery and display; I pin its shape here, P1.M2.T2.S2 pins how the renderer consumes it.

## What

No user-visible / API / logic change. **Test additions only.** 6 new `runCase` blocks exercising:
- the `injectFiles` return shape directly (DELIV-1, DELIV-6);
- the input→before_agent_start delivery flow via `captureAllHandlers()` (DELIV-2, DELIV-3, DELIV-4, DELIV-5).

No new fixtures (reuse `FIX`/`A_TS`/`B_TS`/`A_TS_CONTENT`/`B_TS_CONTENT`). No new helpers (reuse
`captureAllHandlers`/`makeMockCtx`/`runCase`/`assert`). No migration of existing cases. No `.ts` change.

### Success Criteria

- [ ] 6 new cases (`DELIV-1`…`DELIV-6`) present under a `P1.M2.T2.S1 (plan/008)` banner, before the Summary block.
- [ ] DELIV-1: `r.text` is stripped-only (no `---`, no `<file`); `r.blocks`/`r.details` are arrays len 1; detail shape correct.
- [ ] DELIV-2: before_agent_start returns `{message:{customType, content, display:true, details:{files}}}` with the
      full contract (content = the joined block; display===true; details.files len 1 with path+kind).
- [ ] DELIV-3: 2nd before_agent_start returns `undefined` (stash cleared — one-shot).
- [ ] DELIV-4: no-`#@` input → `action==="continue"`; before_agent_start → `undefined` (no phantom).
- [ ] DELIV-5: `source:"extension"` input → `action==="continue"`; before_agent_start → `undefined` (loop prevention).
- [ ] DELIV-6: two `#@` tokens → `r.blocks.length===2` AND `r.details.length===2`; `details[0].path===A_TS`,
      `details[1].path===B_TS` (emission order parallel to blocks).
- [ ] `node ./file-injector.test.mjs` → **0 failed**, exit 0; no existing case regresses.
- [ ] `git diff --stat file-injector.ts` is **EMPTY**.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact landed return shape (file-injector.ts:1116, quoted) + custom-message shape
(L1199-1211, quoted) + stash semantics (input sets `pending` only when `injected>0`; before_agent_start returns
`undefined` if no stash, else pops + returns the message + clears), the EXACT existing helper to reuse
(`captureAllHandlers` at L181-189 — one factory, captures every event, the `pending` closure-share the delivery
flow needs), the CRITICAL `registerMessageRenderer` non-invocation note (session_start calls it but my cases never
drive session_start, so the mock-pi-less `captureAllHandlers` is safe), the existing coverage to EXPAND-not-duplicate
(case 12 partial delivery; case 9 multi-file order+notify), the case-ID collision risk (plan-005 residuals
`M2.T2.S1-e/f/g` → use `DELIV-n`), the exact fixtures (`FIX`/`A_TS`/`A_TS_CONTENT`/`B_TS`), and the gate. The
implementer adds 6 `runCase` blocks and runs one command.

### Documentation & References

```yaml
# MUST READ — the delivery contract this task pins (custom message shape + stash lifecycle + ordering)
- file: PRD.md
  why: "§6.2 'The custom message' quotes the EXACT shape: {customType:'fileInjector.injected', content: blocks.join('\\n\\n'),
        display:true, details:{files: fileDetails}} + the FileDetail interface. §6.4 'Two returns (not one)' specifies input
        returns {action:transform, text:stripped, images} + stashes {blocks,details}; before_agent_start returns {message:…}
        and clears the stash, else undefined. §12.20 'Two hooks, one stash' pins the one-shot clear. §11 #33-41 is the matrix."
  section: "§6.2 (Delivery) + §6.4 (Assembly & shared state / Two returns) + §12.20 + §11 #33-41"

# MUST READ — the landed code I'm testing (read-only; the contract)
- file: file-injector.ts
  why: "injectFiles return L1116: {text: strippedText, images, injected, paged, blocks: state.blocks, details: state.details}.
        Factory L1150-1211: `let pending = {blocks,details}|null = null` (CLOSURE, L1157); input handler L1173-1192
        (short-circuits L1174-1176 set NO stash; !injected L1179 returns continue, no stash; else L1183 `pending={blocks,details}`
        + notify L1189 + return transform L1191); before_agent_start L1199-1211 (`if(!pending) return undefined;` else pop +
        return {message:{customType:'fileInjector.injected', content: blocks.join('\\n\\n'), display:true, details:{files}}}
        + L1202 `pending=null`). emitText pushes the text FileDetail {path, kind:'text', chars, lines}."
  pattern: "input + before_agent_start share the `pending` CLOSURE (per mod.default(pi)) — so a delivery test MUST capture
            both from ONE factory. cfg is MODULE-level (persists across factories); pending is NOT."
  critical: "session_start (L1164) UNCONDITIONALLY calls pi.registerMessageRenderer (L1169). captureAllHandlers' mock pi is
             {on:…} only — so DO NOT drive session_start in my cases (drive input[0] + before_agent_start[0] only, like case 12).
             My cases use #@a.ts/#@b.ts (no config) so cfg is irrelevant; default bareAt:false is fine."

# The PREDECESSOR PRPs (the contracts I consume — LANDED)
- file: plan/008_561ef016260d/P1M1T1S2/PRP.md   # injectFiles return +blocks/+details (Complete)
- file: plan/008_561ef016260d/P1M1T2S1/PRP.md   # input/before_agent_start split + pending closure (Complete)
  why: "T1.S2 defined the return shape; T2.S1 defined the delivery + the one-shot stash. My tests pin both. Read to confirm
        the exact shapes (also quoted in file-injector.ts above) — do NOT re-derive."

# The file you edit (the ONLY change) — add 6 cases; reuse helpers; no harness change
- file: file-injector.test.mjs
  why: "captureAllHandlers L181-189 (REUSE — one factory, captures every event); makeMockCtx L161 (REUSE — {ctx,rec});
        runCase L90; assert; blocksText/hasBlock/countFileBlocks L195-201 (REUSE for block checks). FIX L350; A_TS L339;
        B_TS L340; A_TS_CONTENT L219; B_TS_CONTENT L221. Existing delivery-adjacent: case 12 L528-543 (PARTIAL delivery —
        I EXPAND in DELIV-2); case 9 L496-515 (multi-file order+notify — I COMPLEMENT in DELIV-6 with the details side).
        Place my banner+cases BEFORE the final 'Summary' block (suite tail)."
  pattern: "Direct-shape cases call `mod.injectFiles(prompt, [], FIX)` and assert on r.text/r.blocks/r.details/r.injected.
            Delivery cases call `const h = captureAllHandlers(); const {ctx}=makeMockCtx(TMPDIR); const out = await h.input[0]({text,source,images}, ctx);
            const msg = await h.before_agent_start[0]({}, ctx);` then assert on out.action/out.text and msg/message."
  gotcha: "Case-ID collision: the file has plan-005 residual cases `M2.T2.S1-e/f/g` (bare-@ §10 edges) and `M2.T1.S1-a/b/c`
           (config). Do NOT use the `M2.T2.S1-` prefix. Use `DELIV-1`…`DELIV-6` under a distinct banner. (The 25 currently-failing
           cases are P1.M2.T1.S1's migration scope — when my task runs the baseline is GREEN; I do NOT touch them.)"

# The parallel task — NO collision (it edits the OTHER two test files)
- file: plan/008_561ef016260d/P1M2T1S2/PRP.md
  why: "P1.M2.T1.S2 edits ONLY relative-imports.test.mjs + import-behavior.test.mjs (its anti-pattern: 'Do NOT edit
        file-injector.test.mjs'). My task edits ONLY file-injector.test.mjs. No shared files. (It also lands the same
        single-factory captureAll pattern in those files — reassuring the pattern is right, but I already have captureAllHandlers.)"
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← EDITED (+6 DELIV cases under a banner; reuse captureAllHandlers/makeMockCtx/FIX/A_TS/B_TS)
├── file-injector.ts          # ← UNCHANGED (return shape L1116 + factory L1150-1211 LANDED; git diff empty)
├── relative-imports.test.mjs # NOT edited (P1.M2.T1.S2's parallel scope)
├── import-behavior.test.mjs  # NOT edited (P1.M2.T1.S2's parallel scope)
├── scripts/typecheck.mjs     # untouched
├── package.json / PRD.md / README.md   # untouched (README = P1.M2.T3.S1)
└── plan/008_561ef016260d/
    ├── architecture/{system_context.md, external_deps.md, test_migration.md}
    ├── P1M1T1S1..P1M1T2S2/{PRP.md, research/}   # the return-shape + delivery + renderer predecessors (all LANDED)
    ├── P1M2T1S1/{research/, PRP.md}             # file-injector.test.mjs MIGRATION (the green baseline I build on)
    ├── P1M2T1S2/{research/, PRP.md}             # parallel: relative-imports + import-behavior migration (no collision)
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 banner comment + 6 runCase blocks (DELIV-1..DELIV-6) before the Summary block.
                          #           NO harness change, NO new fixtures, NO new helpers, NO migration of existing cases.
# file-injector.ts + relative-imports.test.mjs + import-behavior.test.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — `pending` is a CLOSURE var (file-injector.ts:1157), per mod.default(pi). A delivery test MUST capture
//   input + before_agent_start from ONE factory (they share pending). captureAllHandlers() (L181) does exactly this:
//   ONE mod.default(pi), returns {input:[fn], session_start:[…], before_agent_start:[fn]}. REUSE it — do NOT call
//   captureHandler("input") then captureHandler("before_agent_start") (two factories → two pending closures → the
//   before_agent_start from factory B reads a NULL pending → your delivery asserts fail with undefined).

// CRITICAL — DO NOT drive session_start in my cases. session_start (L1164) UNCONDITIONALLY calls pi.registerMessageRenderer
//   (L1169); captureAllHandlers' mock pi is {on:…} only → driving session_start throws "registerMessageRenderer is not a
//   function". My 6 cases drive ONLY input[0] + before_agent_start[0] (like existing case 12 at L536) → no throw. cfg is
//   module-level (persists) and my prompts use #@a.ts/#@b.ts (no config) → default bareAt:false is correct regardless.

// CRITICAL — input sets `pending` ONLY when injected > 0. The handler short-circuits (extension/steer/no-#@ → continue,
//   NO stash) AND early-returns continue when `!injected` (NO stash). So before_agent_start returns undefined for: no-#@,
//   extension source, steering, and nothing-resolved prompts. DELIV-4/5 pin the no-#@ and extension paths.

// GOTCHA — `r.text` is the STRIPPED prompt ONLY (no "\n\n---\n\n", no <file> blocks). The old design appended blocks;
//   the refactor (PRD §6.4) moved them to r.blocks + the custom message. DELIV-1 asserts r.text has NO "---" and NO "<file"
//   to lock this — a future change that re-appends would fail it.

// GOTCHA — for a SINGLE file, blocks.join("\n\n") === blocks[0] (one element, no separator). So DELIV-2's content assert
//   for one file checks exactly ONE "<file name=" in content. For multi-file (DELIV-6) the join inserts "\n\n" between
//   blocks — but DELIV-6 tests the return shape (r.blocks/r.details), not the joined content, so no join-fragility there.

// GOTCHA — case-ID collision. The file has plan-005 residual cases `M2.T2.S1-e/f/g` and `M2.T1.S1-a/b/c`. Use `DELIV-1`..`DELIV-6`
//   (NOT `M2.T2.S1-a` etc.) under a `// ── P1.M2.T2.S1 (plan/008): delivery + custom-message + stash lifecycle ──` banner.

// GOTCHA — do NOT duplicate case 12 (L528) or case 9 (L496). Case 12 = partial delivery (customType + content.includes +
//   notify) — DELIV-2 EXPANDS it (full shape: display===true, details.files array, content === joined block). Case 9 =
//   multi-file order + notify — DELIV-6 COMPLEMENTS it (blocks/details LENGTH parity + details emission order; case 9 doesn't
//   touch details). Frame DELIV-2/6 as pinning the parts those cases don't.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti. runCase(n,name,fn)/assert(cond,msg). The gate is
//   `node ./file-injector.test.mjs`. `npm run typecheck` is belt-and-suspenders (the .ts is untouched → trivially clean).
```

## Implementation Blueprint

### Data models and structure

No new data models. The cases assert against the LANDED shapes:

```ts
// injectFiles return (file-injector.ts:1116):
{ text: string /* stripped prompt, NO blocks/separator */, images: ImageContent[], injected: number, paged: number,
  blocks: string[] /* <file>…</file> strings, emission order */, details: FileDetail[] /* parallel to blocks */ }

// FileDetail for text (emitText): { path: string, kind: "text", chars: content.length, lines: newlineCount+1 }

// before_agent_start custom message (file-injector.ts:1204-1209):
{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }
// before_agent_start returns `undefined` when no stash (no-#@ / extension / steering / nothing-injected).
```

### The 6 cases (exact specs — encode as runCase blocks)

```js
// ── P1.M2.T2.S1 (plan/008): delivery + custom-message + stash lifecycle ──
// Pins PRD §6.2/§6.4/§12.20 + §11 #33-41: the injectFiles return shape (blocks/details), the full before_agent_start
// custom-message contract, and the one-shot `pending` stash lifecycle. REUSES captureAllHandlers (one factory → shared
// `pending` closure) + makeMockCtx + FIX/A_TS/B_TS. Does NOT drive session_start (it calls registerMessageRenderer,
// which captureAllHandlers' mock pi lacks — my cases drive input[0]+before_agent_start[0] only, like case 12).

// DELIV-1 — RETURN SHAPE (direct injectFiles). r.text is stripped-only; blocks/details are arrays of len 1.
await runCase("DELIV-1", "injectFiles return shape: r.text stripped (no ---/<file>); r.blocks[] + r.details[] len 1", async () => {
  const r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
  assert(r.paged === 0, `expected paged===0, got ${r.paged}`);
  assert(r.text === "Review a.ts", `r.text is the STRIPPED prompt (no blocks); got ${JSON.stringify(r.text)}`);
  assert(!r.text.includes("---"), "r.text must NOT contain the old '---' separator");
  assert(!r.text.includes("<file"), "r.text must NOT contain any <file> block (bytes live in r.blocks/the custom message)");
  assert(Array.isArray(r.blocks) && r.blocks.length === 1, `r.blocks is a string[] of length 1, got ${JSON.stringify(r.blocks)}`);
  assert(r.blocks[0].includes('<file name="' + A_TS + '">'), "r.blocks[0] is the a.ts <file> block");
  assert(Array.isArray(r.details) && r.details.length === 1, `r.details is a FileDetail[] of length 1, got ${JSON.stringify(r.details)}`);
  const d = r.details[0];
  assert(d.path === A_TS, `details[0].path is the resolved a.ts abs, got ${d.path}`);
  assert(d.kind === "text", `details[0].kind === 'text', got ${d.kind}`);
  assert(d.chars === A_TS_CONTENT.length, `details[0].chars is the content length (${A_TS_CONTENT.length}), got ${d.chars}`);
  const expectedLines = (A_TS_CONTENT.match(/\n/g) || []).length + 1;
  assert(d.lines === expectedLines, `details[0].lines is newline-count+1 (${expectedLines}), got ${d.lines}`);
});

// DELIV-2 — CUSTOM MESSAGE (full contract). before_agent_start publishes {customType, content=blocks.join, display:true, details:{files}}.
// EXPANDS case 12 (which checks customType + content.includes + notify) to pin display===true, details.files shape, and content === the joined block.
await runCase("DELIV-2", "custom message: before_agent_start → {customType, content=blocks.join, display:true, details:{files}}", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers(); // ONE factory → input + before_agent_start share the `pending` closure
  const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `input must transform, got '${out.action}'`);
  assert(out.text === "Review a.ts", `input text is stripped (blocks leave the user message); got ${JSON.stringify(out.text)}`);
  const msg = await h.before_agent_start[0]({}, ctx); // SAME factory → reads the stashed pending
  assert(msg && msg.message, `before_agent_start must return {message}, got ${JSON.stringify(msg)}`);
  const m = msg.message;
  assert(m.customType === "fileInjector.injected", `customType handshake (the renderer key), got ${m.customType}`);
  assert(typeof m.content === "string" && m.content.includes('<file name="' + A_TS + '">'),
    `content carries the a.ts <file> block (the model receives it), got ${JSON.stringify(m.content)}`);
  // for ONE file, blocks.join("\n\n") === the single block → exactly one <file> opener in content
  assert((m.content.match(/<file name="/g) || []).length === 1,
    `content has exactly ONE <file> block (= blocks.join for 1 file), got ${JSON.stringify(m.content)}`);
  assert(m.display === true, `display===true (TUI render contract; §6.2), got ${m.display}`);
  assert(m.details && Array.isArray(m.details.files), `details.files is an array, got ${JSON.stringify(m.details)}`);
  assert(m.details.files.length === 1, `details.files has one entry (one file delivered), got ${m.details.files.length}`);
  assert(m.details.files[0].path === A_TS && m.details.files[0].kind === "text",
    `details.files[0] is the a.ts text detail, got ${JSON.stringify(m.details.files[0])}`);
});

// DELIV-3 — ONE-SHOT STASH. before_agent_start read-and-clears `pending`; a 2nd call returns undefined.
await runCase("DELIV-3", "one-shot stash: 2nd before_agent_start returns undefined (pending cleared)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx); // stashes pending
  const msg1 = await h.before_agent_start[0]({}, ctx);
  assert(msg1 && msg1.message && msg1.message.customType === "fileInjector.injected",
    `1st before_agent_start publishes the custom message, got ${JSON.stringify(msg1)}`);
  const msg2 = await h.before_agent_start[0]({}, ctx);
  assert(msg2 === undefined,
    `2nd before_agent_start must return undefined (pending cleared — one-shot per prompt, §12.20), got ${JSON.stringify(msg2)}`);
});

// DELIV-4 — EMPTY STASH. A no-#@ prompt short-circuits (no stash) → before_agent_start returns undefined (no phantom).
await runCase("DELIV-4", "empty stash: no-#@ input → before_agent_start undefined (no phantom injection)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  const out = await h.input[0]({ text: "Just a plain prompt with no markers", source: "interactive", images: [] }, ctx);
  assert(out.action === "continue", `no-#@ input short-circuits to continue (no stash set), got '${out.action}'`);
  const msg = await h.before_agent_start[0]({}, ctx);
  assert(msg === undefined, `before_agent_start must return undefined (empty stash → no phantom custom message), got ${JSON.stringify(msg)}`);
});

// DELIV-5 — SHORT-CIRCUIT. source:'extension' input → continue (loop prevention, no stash) → before_agent_start undefined.
await runCase("DELIV-5", "short-circuit: source:'extension' input → before_agent_start undefined (loop prevention)", async () => {
  const { ctx } = makeMockCtx(TMPDIR);
  const h = captureAllHandlers();
  // source:'extension' is MANDATORY loop prevention (§12.1) — even with a #@, no stash is set.
  const out = await h.input[0]({ text: "Review #@a.ts", source: "extension", images: [] }, ctx);
  assert(out.action === "continue", `source:'extension' input short-circuits to continue (loop prevention), got '${out.action}'`);
  const msg = await h.before_agent_start[0]({}, ctx);
  assert(msg === undefined, `before_agent_start must return undefined (extension source set no stash), got ${JSON.stringify(msg)}`);
});

// DELIV-6 — MULTI-FILE details. Two #@ tokens → r.blocks.length===2 AND r.details.length===2; details parallel to blocks.
// COMPLEMENTS case 9 (which covers block order via findIndex + notify count) by pinning the FileDetail side + length parity.
await runCase("DELIV-6", "multi-file: r.blocks.length===2 AND r.details.length===2; details parallel to blocks (emission order)", async () => {
  const r = await mod.injectFiles("Diff #@a.ts vs #@b.ts", [], FIX);
  assert(r.injected === 2, `expected injected===2, got ${r.injected}`);
  assert(Array.isArray(r.blocks) && r.blocks.length === 2, `r.blocks is a string[] of length 2, got ${r.blocks.length}`);
  assert(Array.isArray(r.details) && r.details.length === 2, `r.details is a FileDetail[] of length 2, got ${r.details.length}`);
  // details are parallel to blocks in emission (pre-order) order: details[0]=a.ts, details[1]=b.ts
  assert(r.details[0].path === A_TS, `details[0].path===A_TS (emission order), got ${r.details[0].path}`);
  assert(r.details[1].path === B_TS, `details[1].path===B_TS (emission order), got ${r.details[1].path}`);
  assert(r.details[0].kind === "text" && r.details[1].kind === "text", `both details kind==='text'`);
  // cross-check: each detail's path appears as the <file name=…> in the parallel block
  assert(r.blocks[0].includes('<file name="' + A_TS + '">'), "blocks[0] is the a.ts block (parallel to details[0])");
  assert(r.blocks[1].includes('<file name="' + B_TS + '">'), "blocks[1] is the b.ts block (parallel to details[1])");
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the banner + 6 runCase blocks (file-injector.test.mjs, before the Summary block)
  - ADD a banner comment: `// ── P1.M2.T2.S1 (plan/008): delivery + custom-message + stash lifecycle ──` (cite PRD §6.2/§6.4/§12.20/§11 #33-41;
    note: reuses captureAllHandlers; does NOT drive session_start).
  - ADD the 6 runCase blocks (DELIV-1..DELIV-6) verbatim per the blueprint above.
  - NAMING: `DELIV-1`..`DELIV-6` (NOT `M2.T2.S1-a` — collides with plan-005 residual IDs `M2.T2.S1-e/f/g`).
  - PLACEMENT: before the final Summary block; after the existing case-12/case-14 delivery-adjacent cases is natural, but any
    pre-Summary position under the banner is fine.
  - DO NOT: add new fixtures (reuse FIX/A_TS/B_TS/A_TS_CONTENT/B_TS_CONTENT); add new helpers (reuse captureAllHandlers/makeMockCtx);
    modify captureAllHandlers; migrate any existing case; touch the 25 currently-failing cases (P1.M2.T1.S1's scope).

Task 2: VERIFY the gate
  - RUN: node ./file-injector.test.mjs → EXPECT "0 failed", exit 0; the 6 DELIV cases print ✓; no existing case flips to ✗.
    (Record the actual pass count — post-migration baseline + 6. The CURRENT tree shows 103 pass/25 fail because the migration
    P1.M2.T1.S1 hasn't landed; when my task runs the baseline is GREEN and my 6 sit on top.)
  - RUN: git diff --stat file-injector.ts → EXPECT EMPTY (the code is landed; tests only).
  - (belt-and-suspenders) npm run typecheck → 0 errors (the .ts is untouched → trivially clean).
  - IF a DELIV case fails:
      DELIV-1 r.text has blocks → the refactor regressed (blocks re-appended) — NOT this task's code; report it.
      DELIV-2 msg undefined → before_agent_start from a DIFFERENT factory than input (did you use captureHandler twice? use captureAllHandlers).
      DELIV-2 "registerMessageRenderer is not a function" → you drove session_start; remove that call (drive input[0]+before_agent_start[0] only).
      DELIV-3 msg2 !== undefined → the stash wasn't cleared (pending=null missing) — NOT this task's code; report it.
      DELIV-4/5 msg !== undefined → a no-#@/extension prompt set a stash — NOT this task's code; report it.
      DELIV-6 details.length !== 2 → a FileDetail push is missing — NOT this task's code; report it.
```

### Implementation Patterns & Key Details

```js
// The delivery-flow pattern (DELIV-2/3/4/5) — ONE factory, drive input[0] + before_agent_start[0] only:
const { ctx } = makeMockCtx(TMPDIR);
const h = captureAllHandlers();                       // ONE mod.default(pi) → shared `pending` closure
const out = await h.input[0]({ text, source, images: [] }, ctx);
// out = { action: "transform"|"continue", text?, images? }  (NO .blocks — blocks are stashed in `pending`)
const msg = await h.before_agent_start[0]({}, ctx);   // SAME factory → reads (and clears) the stashed pending
// msg = undefined (no stash) | { message: { customType, content, display, details } }

// The return-shape pattern (DELIV-1/6) — direct injectFiles:
const r = await mod.injectFiles(prompt, [], FIX);
// r = { text(stripped), images, injected, paged, blocks: string[], details: FileDetail[] }

// DELIV-2 content check for ONE file: blocks.join("\n\n") === blocks[0] → exactly one "<file name=" in content.
//   (For multi-file the join inserts "\n\n"; DELIV-6 tests r.blocks/r.details directly, not the joined content, so no join-fragility.)
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - file-injector.test.mjs: +1 banner comment + 6 runCase blocks (DELIV-1..DELIV-6) before the Summary block.
    REUSES captureAllHandlers (L181), makeMockCtx (L161), runCase (L90), assert, FIX (L350), A_TS/B_TS (L339-340),
    A_TS_CONTENT/B_TS_CONTENT (L219-221). NO new fixtures/helpers; NO harness change; NO migration of existing cases.
NO_CHANGES: file-injector.ts (git diff empty — the code is LANDED), relative-imports.test.mjs + import-behavior.test.mjs
            (P1.M2.T1.S2's parallel scope), scripts/typecheck.mjs, package.json, PRD.md, README.md (P1.M2.T3.S1), all plan/ files.
NO_LOGIC_CHANGE: the injection/delivery code is UNCHANGED — this task adds TESTS that pin the landed contract.
```

## Validation Loop

### Level 1: The suite run (the authoritative gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 6 DELIV cases print ✓, then "Result: <N> passed, 0 failed.", exit 0.
#   <N> = (post-migration baseline) + 6. The CURRENT tree shows 103 pass/25 fail because P1.M2.T1.S1's migration hasn't
#   landed; when my task runs the baseline is GREEN (the 25 markdown/bare-@/config cases pass) and my 6 sit on top.
# LOAD-BEARING: "0 failed" + the 6 DELIV ✓ + no existing case flips to ✗.
# If a DELIV case shows ✗ → see Task 2's failure-triage (most likely: drove session_start, or used two factories).
# If an EXISTING case flips to ✗ → you accidentally edited it or the harness; revert (this task adds cases ONLY).
```

### Level 2: Targeted checks (the 6 new cases + scope)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "DELIV-|Result:|✗ case" | head -20
# Expected: 6 "✓ case DELIV-…" lines; "Result: <N> passed, 0 failed."; ZERO "✗ case" lines.

# Scope integrity — only file-injector.test.mjs changed; the .ts is untouched:
git diff --stat file-injector.ts            # expect EMPTY
git diff --stat file-injector.test.mjs      # expect the file (the +banner + 6 cases)
git diff --stat relative-imports.test.mjs import-behavior.test.mjs   # expect EMPTY (P1.M2.T1.S2's parallel scope)
```

### Level 3: Belt-and-suspenders (typecheck — the .ts is untouched → trivially clean)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# (The .mjs is untyped; the .ts is unchanged → 0 errors regardless. This just confirms no accidental .ts edit.)
```

### Level 4: Cross-reference the landed contract (read-only — confirm the shapes my cases assert)

```bash
cd /home/dustin/projects/pi-file-injector
grep -n "blocks: state.blocks, details: state.details" file-injector.ts   # the injectFiles return (L1116)
grep -n 'customType: "fileInjector.injected"' file-injector.ts            # the before_agent_start message (L1205)
grep -n "pending = null" file-injector.ts                                 # the one-shot clear (L1202)
grep -n "if (!pending) return undefined" file-injector.ts                 # the no-stash no-op (L1200)
# Expected: hits at each — these are the exact contract lines DELIV-1..6 pin.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → **0 failed**, exit 0; 6 `DELIV` cases print ✓; no existing case regresses.
- [ ] `git diff --stat file-injector.ts` is **EMPTY** (the code is landed; tests only).
- [ ] `git diff --stat` touches ONLY `file-injector.test.mjs` (no collision with P1.M2.T1.S2's two files).

### Feature Validation (the contracts the 6 cases pin)

- [ ] DELIV-1: `r.text` stripped-only (no `---`/`<file`); `r.blocks`/`r.details` arrays len 1; detail shape `{path, kind:'text', chars, lines}`.
- [ ] DELIV-2: before_agent_start returns the full custom message `{customType, content(=joined block), display:true, details:{files:[…]}}`.
- [ ] DELIV-3: 2nd before_agent_start → `undefined` (one-shot stash cleared).
- [ ] DELIV-4: no-`#@` input → `continue`; before_agent_start → `undefined` (no phantom).
- [ ] DELIV-5: `source:"extension"` input → `continue`; before_agent_start → `undefined` (loop prevention).
- [ ] DELIV-6: two `#@` → `r.blocks.length===2` AND `r.details.length===2`; details parallel to blocks in emission order.

### Code Quality Validation

- [ ] REUSES `captureAllHandlers` (ONE factory → shared `pending` closure) — never two per-event captures for a delivery test.
- [ ] Does NOT drive `session_start` (it calls `registerMessageRenderer`, which the mock pi lacks; cases drive input[0]+before_agent_start[0] only).
- [ ] REUSES existing fixtures (`FIX`/`A_TS`/`B_TS`/`A_TS_CONTENT`/`B_TS_CONTENT`) + helpers (`makeMockCtx`/`runCase`/`assert`) — no new ones.
- [ ] Case IDs `DELIV-1`..`DELIV-6` (non-colliding with plan-005 residuals `M2.T2.S1-e/f/g`).
- [ ] EXPANDS case 12 (full custom-message shape) and COMPLEMENTS case 9 (details side of multi-file) — no duplication.

### Documentation

- [ ] None (test additions only — item §6). No README/PRD change (README = P1.M2.T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT use two factories for a delivery test.** `pending` is a CLOSURE var (file-injector.ts:1157), per `mod.default(pi)`.
  `captureHandler("input")` then `captureHandler("before_agent_start")` creates two factories → two `pending` closures →
  before_agent_start from factory B reads NULL → your asserts fail with `undefined`. Use `captureAllHandlers()` (ONE factory).
- ❌ **Do NOT drive `session_start` in my cases.** session_start unconditionally calls `pi.registerMessageRenderer` (L1169);
  `captureAllHandlers`' mock pi is `{on:…}` only → it throws. My cases drive `input[0]` + `before_agent_start[0]` only (like
  case 12). cfg is module-level + my prompts use no config → default bareAt:false is correct without driving session_start.
- ❌ **Do NOT modify `captureAllHandlers` or any harness helper.** It already does exactly what I need (one factory, every event).
  Adding `registerMessageRenderer: () => {}` to it is P1.M2.T1.S1's harness territory (if anyone's); my cases don't need it.
- ❌ **Do NOT migrate or touch the 25 currently-failing cases.** They are markdown/bare-@/config cases in P1.M2.T1.S1's migration
  scope. When my task runs the baseline is GREEN. I ADD 6 cases; I do not fix or move existing ones.
- ❌ **Do NOT edit `file-injector.ts`** (the code is LANDED) **or `relative-imports.test.mjs`/`import-behavior.test.mjs`** (P1.M2.T1.S2's
  parallel scope). `git diff --stat` for all three must be empty.
- ❌ **Do NOT duplicate case 12 or case 9.** Case 12 = partial delivery (customType + content.includes + notify); DELIV-2 EXPANDS it
  (display===true, details.files shape, content===joined block). Case 9 = multi-file order + notify; DELIV-6 COMPLEMENTS it (blocks/details
  length parity + details emission order). Frame DELIV-2/6 as the parts those cases don't cover.
- ❌ **Do NOT use the `M2.T2.S1-` case-ID prefix.** It collides with plan-005 residual cases (`M2.T2.S1-e/f/g`). Use `DELIV-1`..`DELIV-6`.
- ❌ **Do NOT assert `r.text` contains `<file>` blocks or `---`.** Under the new shape `r.text` is the STRIPPED prompt only (PRD §6.4);
  blocks live in `r.blocks` / the custom message. DELIV-1 explicitly asserts the ABSENCE of `---`/`<file` in `r.text` to lock this.
- ❌ **Do NOT add docs.** Item §6: test additions only. README = P1.M2.T3.S1; PRD is read-only.

---

## Confidence Score: 9/10

A tightly-bounded test-addition task against LANDED code (the injectFiles return shape + the input/before_agent_start
split + the one-shot `pending` closure stash are all Complete). The 6 cases are precisely specified with exact assertion
specs, reusing the existing `captureAllHandlers()` helper (which already does the one-factory capture the `pending` closure
requires) and existing fixtures. The PRP nails the two non-obvious traps: (1) **`pending` is a closure var** → a delivery
test MUST use ONE factory (`captureAllHandlers`), never two per-event captures; (2) **do NOT drive `session_start`** — it calls
`registerMessageRenderer`, which the mock pi lacks, and my cases don't need it (cfg is module-level + my prompts use no config).
It also resolves the case-ID collision (plan-005 residuals → use `DELIV-n`) and the expand-not-duplicate relationship with
case 12 (full custom-message shape) and case 9 (details side of multi-file). The -1 reserves for the baseline-state assumption
(when my task runs, P1.M2.T1.S1's migration has landed and the 25 currently-failing cases pass; if the migration is incomplete,
my cases still add cleanly but the suite won't be 0-failed until migration lands — the PRP flags this and says the load-bearing
signal is "my 6 pass + I introduce no new failure"). The implementing agent adds 6 `runCase` blocks under a banner and runs one command.
