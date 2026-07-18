# Research Notes — P1.M2.T2.S1 (plan/008)

**Item:** Delivery + custom-message + stash lifecycle tests. Add NEW test cases to `file-injector.test.mjs`
pinning PRD §11 #33-41 + §10 delivery/display rows: the `injectFiles` return shape, the `before_agent_start`
custom-message contract, and the one-shot `pending` stash lifecycle.
**Plan:** plan/008_561ef016260d (Compact read-tool-style display via custom-message delivery).

## What's LANDED (the code I'm testing — all Complete)

- **P1.M1.T1.S2 (injectFiles return shape)** — `injectFiles` returns
  `{ text, images, injected, paged, blocks: string[], details: FileDetail[] }` (file-injector.ts L1116).
  `text` = STRIPPED prompt ONLY (no blocks, no `\n\n---\n\n` separator — that's the whole point of the refactor).
  `blocks` = the `<file>…</file>` strings. `details` = FileDetail[] parallel to blocks.
- **P1.M1.T2.S1 (input/before_agent_start split + pending stash)** — the factory (file-injector.ts L1150-1211):
  - `let pending: {blocks, details} | null = null` — a CLOSURE var (L1157), per `mod.default(pi)`.
  - `input` handler (L1173): short-circuits (`source==="extension"` / `steer` / no `#@`) → `{action:"continue"}`
    WITHOUT setting pending. Else calls injectFiles; if `!injected` → `{action:"continue"}` (no stash). Else
    `pending = {blocks, details}` + notify + `return {action:"transform", text, images}`.
  - `before_agent_start` handler (L1199): `if (!pending) return undefined;` else pops pending, returns
    `{message: {customType:"fileInjector.injected", content: blocks.join("\n\n"), display:true, details:{files: details}}}`.
  - `session_start` (L1164): loads cfg + UNCONDITIONALLY calls `pi.registerMessageRenderer("fileInjector.injected", …)`.
- **P1.M1.T2.S2 (renderer)** — `renderInjectedMessage` is exported (rendered display is P1.M2.T2.S2's test scope, NOT mine).

## The harness ALREADY supports my tests (no new helper needed)

- **`captureAllHandlers()`** (file-injector.test.mjs L181-189) captures EVERY handler from ONE `mod.default(pi)`:
  `const handlers = {}; const pi = { on: (ev, cb) => { (handlers[ev] ??= []).push(cb); } }; mod.default(pi); return handlers;`
  → `{ input:[fn], session_start:[cfgFn, acFn], before_agent_start:[fn] }`. This is EXACTLY the single-factory
  capture the `pending` CLOSURE requires (input + before_agent_start share it). **I do NOT add a new helper — I reuse this.**
- **`makeMockCtx(cwd, {hasUI, isProjectTrusted})`** (L161) returns `{ctx, rec}`; `rec.notify` captures the notify call.
- **`runCase(n, name, fn)`** (L90); **`assert(cond, msg)`**.
- **`blocksText(r)` / `hasBlock(r, needle)` / `countFileBlocks(text, abs)`** (L195-201) — migration helpers for the new shape.
- **Fixtures**: `FIX = {cwd: TMPDIR}` (L350); `A_TS`/`B_TS` (L339-340); `A_TS_CONTENT`/`B_TS_CONTENT` (L219-221).

## CRITICAL — captureAllHandlers does NOT define registerMessageRenderer

`captureAllHandlers`'s mock pi is `{ on: … }` only. session_start calls `pi.registerMessageRenderer`
(file-injector.ts:1170) — but ONLY when session_start is INVOKED. My 6 cases do NOT invoke session_start
(they drive `input[0]` + `before_agent_start[0]` directly, like existing case 12 at L536). So no throw.
**Do NOT drive session_start in my cases** (and do NOT need to modify captureAllHandlers). cfg is module-level
and persists; my cases use `#@a.ts`/`#@b.ts` (no config dependence), so the default bareAt:false is fine.

## Existing coverage I must EXPAND, not duplicate

- **Case 12** (L528-543) already does a PARTIAL delivery test: `captureAllHandlers()` → input[0]("Review #@a.ts")
  → assert out.text==="Review a.ts" → before_agent_start[0] → assert msg.message.customType==="fileInjector.injected"
  + content.includes the a.ts block + notify fired. **My case (b) EXPANDS this**: assert the FULL custom-message
  shape (content === blocks.join for 1 file; display===true; details.files is an array length 1 with path+kind).
  Case 12 checks customType + content.includes; mine pins the complete contract.
- **Case 9** (L496) covers multi-file ORDER (`r.blocks.findIndex` ia<ib) + notify count. **My case (f) COMPLEMENTS**:
  pin `r.blocks.length===2` AND `r.details.length===2` (the new FileDetail parallel structure) + details[i].path
  aligns with the abs in blocks[i] (emission order). Case 9 doesn't touch details.

## The 6 cases (a-f) — design

All via either direct `mod.injectFiles(...)` (a, f) or `captureAllHandlers()` driving input[0]+before_agent_start[0] (b,c,d,e).

**(a) RETURN SHAPE** — direct injectFiles("Review #@a.ts"):
  r.injected===1; r.paged===0; r.text==="Review a.ts" (stripped, NO `---`, NO `<file`); r.blocks is string[] len 1
  (the a.ts block); r.details is FileDetail[] len 1: {path===A_TS, kind==='text', chars===A_TS_CONTENT.length,
  lines===(A_TS_CONTENT \n count)+1}. **Pins the new return shape end-to-end.**

**(b) CUSTOM MESSAGE** — captureAllHandlers; input[0]("Review #@a.ts"); before_agent_start[0]:
  msg.message = {customType:"fileInjector.injected", content, display:true, details:{files}}. Assert customType;
  content.includes the a.ts block + exactly ONE `<file name=` in content (blocks.join for 1 file = the block);
  display===true; details.files is array len 1 with path===A_TS + kind==='text'. **Pins the full custom-message contract.**

**(c) ONE-SHOT STASH** — captureAllHandlers; input[0] stashes; before_agent_start[0] #1 → message; #2 → undefined:
  pending cleared after first read (one-shot per prompt). Assert msg1.message present + msg2===undefined.

**(d) EMPTY STASH** — input[0]("no markers") → action==='continue' (no-#@ guard, no stash); before_agent_start[0] → undefined.
  **No phantom injection.**

**(e) SHORT-CIRCUIT** — input[0]("Review #@a.ts", source:'extension') → action==='continue' (loop prevention, no stash);
  before_agent_start[0] → undefined. **Extension source never stashes.**

**(f) MULTI-FILE details** — direct injectFiles("Diff #@a.ts vs #@b.ts"): r.blocks.length===2, r.details.length===2;
  details[0].path===A_TS, details[1].path===B_TS (emission order parallel to blocks); both kind==='text'. **Pins the
  details array parallel-to-blocks structure (case 9 covers order+notify; this covers the FileDetail side).**

## Case-ID collision risk (plan-005 residuals)

The file currently contains plan-005 residual cases with IDs `M2.T1.S1-a/b/c` (config) and `M2.T2.S1-e/f/g`
(bare-@ §10 edges). To AVOID collision + confusion, my cases use a DISTINCT prefix: `DELIV-1`..`DELIV-6`
(or similar), under a banner `// ── P1.M2.T2.S1 (plan/008): delivery + custom-message + stash lifecycle ──`.
Do NOT use the `M2.T2.S1-` prefix (collides with plan-005's e/f/g).

## Placement + baseline

- Place the 6 cases under the banner, BEFORE the final "Summary" block (the suite's tail). After the existing
  delivery-adjacent cases (12, 14) or at the end of the case run — either works; the banner makes it findable.
- **Baseline when my task runs**: file-injector.test.mjs is GREEN (P1.M2.T1.S1's migration of the ~170 existing
  assertions to r.blocks/r.details has landed; the currently-failing 25 markdown/bare-@/config cases pass).
  The CURRENT tree shows 103 pass / 25 fail — those 25 failures are P1.M2.T1.S1's migration scope, NOT mine.
  My task ADDS 6 cases on top of a green baseline. Gate: my 6 pass + 0 failures overall + no existing case regresses.
- I do NOT touch the 25 failing cases (P1.M2.T1.S1 owns them) and do NOT touch file-injector.ts (the code is landed).

## No collision with the parallel task

P1.M2.T1.S2 (parallel) edits ONLY `relative-imports.test.mjs` + `import-behavior.test.mjs` (confirmed by its PRP's
"FILE_EDITS" + anti-pattern "Do NOT edit file-injector.test.mjs"). My task edits ONLY `file-injector.test.mjs`.
No shared files, no merge conflict.

## Gates
- `node ./file-injector.test.mjs` → 0 failed, exit 0; my 6 DELIV cases print ✓; no existing case regresses.
  (Record the actual count — post-migration baseline + 6.)
- `git diff --stat file-injector.ts` → EMPTY (the code is landed; I add tests only).
- `npm run typecheck` → 0 errors (belt-and-suspenders; tests are .mjs, but confirms the .ts is untouched/clean).

## No docs
Item §6: "DOCS: none — test additions only." No README/PRD change (README = P1.M2.T3.S1).
