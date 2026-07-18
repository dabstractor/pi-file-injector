# Research Notes — P1.M2.T1.S2 (relative-imports + import-behavior return-shape migration)

## Task
Migrate `relative-imports.test.mjs` (508 lines, 38 cases) and `import-behavior.test.mjs` (250 lines,
22 cases) to read injected `<file>` block content from the NEW `injectFiles` return shape
(`out.blocks: string[]`) instead of the OLD `out.text` (which used to contain the blocks + a
`\n\n---\n\n` separator). Import LOGIC under test is UNCHANGED — only the output container moves.
Test-only; `file-injector.ts` is NOT edited.

## The contract (verified in working-tree file-injector.ts)

### injectFiles return shape (file-injector.ts:1030-1114)
```ts
export async function injectFiles(text, imagesIn, ctx, bareAt = false): Promise<{
  text: string;          // STRIPPED prompt ONLY — no blocks, no "\n\n---\n\n" separator (L1114)
  images: ImageContent[];
  injected: number;
  paged: number;
  blocks: string[];      // the <file>…</file> strings (L1076, returned L1114)
  details: FileDetail[]; // per-file metadata (L1077)
}>
```
- Nothing-injected path (L1096): `{ text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }`.
- `text` is the ORIGINAL prompt when nothing injected (byte-for-byte); STRIPPED prompt when injected.

### input handler (file-injector.ts:1173-1192)
- Returns `{ action: "transform", text, images }` — `text` is STRIPPED prompt only.
- Stashes `{ blocks, details }` in closure var `pending` (L1157, set L1186) when injected > 0.
- Notifies on `ctx.hasUI` (L1190): `"#@ injected N whole"` or `"#@ injected N whole, M paged"`.
- `!injected` → `{ action: "continue" }`, NO stash set.

### before_agent_start handler (file-injector.ts:1198-1209)
- Reads + CLEARS `pending` (one-shot, L1204).
- Returns `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.
- No stash (no #@, short-circuited, nothing injected) → returns `undefined`.

### CRITICAL — closure scope
- `pending` (L1157) is a **CLOSURE var** (per `mod.default(pi)` factory), NOT module-level. So `input`
  + `before_agent_start` MUST come from the SAME factory to share `pending`. Driving input from factory A
  then before_agent_start from factory B → B's pending is null → no message.
- `cfg` IS module-level (persists across factories) — so config-from-session_start-then-input CAN span
  two factories, but using ONE factory for the whole flow is cleanest and REQUIRED for delivery checks.

## CRITICAL LOAD BLOCKER + a second required mock change (both files)

### 1. pi-tui jiti alias (LOAD blocker — empirically confirmed)
Both files currently FAIL TO LOAD:
```
node ./relative-imports.test.mjs  → Error: Cannot find module '@earendil-works/pi-tui'
node ./import-behavior.test.mjs   → Error: Cannot find module '@earendil-works/pi-tui'
```
Cause: T2.S2 (LANDED uncommitted) added `import { Box, Text, type Component } from "@earendil-works/pi-tui"`
(file-injector.ts:4). Each test file has its OWN jiti alias map and NEITHER has a pi-tui entry:
- relative-imports.test.mjs alias map: L44 (`alias: {`).
- import-behavior.test.mjs alias map: L14 (`alias: {`).
FIX (identical line in both): add
`"@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",`
(same nested-node_modules path P1.M2.T1.S1 uses). This is the same enabling change as P1.M2.T1.S1 #1.

### 2. mock pi MUST define registerMessageRenderer (else session_start throws)
T2.S2 added an UNCONDITIONAL `pi.registerMessageRenderer("fileInjector.injected", …)` call inside the
session_start handler (file-injector.ts:1170). Both files' mock `pi` objects drive session_start
(relative-imports D5/D6/D7 + import-behavior 5b/5d) but define ONLY `{ on: … }`:
- relative-imports captureHandlers L82: `mod.default({ on: (ev, cb) => { cbs[ev]?.push(cb); } })`.
- import-behavior capture L45: `mod.default({ on: (e, cb) => { if (e === event) cbs.push(cb); } })`.
Once the file LOADS (alias added), every handler test that drives session_start throws
`pi.registerMessageRenderer is not a function`. FIX: add `registerMessageRenderer: () => {}` (no-op)
to each mock pi. (Verified: grep `registerMessageRenderer` in file-injector.test.mjs returns 0 — P1.M2.T1.S1
hits the same issue; its captureAllHandlers helper will need it too, but that is S1's concern, not S2's.)

## relative-imports.test.mjs — full site inventory (grep-verified)

### Helpers (L75-80) — ALL string-operating, stay generic
```js
const run = async (cwd, prompt, bareAt = false) => mod.injectFiles(prompt, [], ctxFor(cwd), bareAt);
const has = (text, marker) => (text ?? "").includes(marker);
const blocksRel = (text, root) => [...(text ?? "").matchAll(/<file name="([^"]+)">/g)].map((m) => path.relative(root, m[1]));
const countAbs = (text, abs) => (text.match(new RegExp('<file name="' + esc + '">', "g")) || []).length;
```
`run()` already returns the FULL injectFiles result (incl. blocks/details) — NO change needed.

### Two consumer contexts
1. **Block content** (Groups C, D1-D4, E, handler D5/D7): `has(out.text, M)`, `blocksRel(out.text, root)`,
   `countAbs(out.text, …)` → MUST migrate to read blocks.
2. **Path string** (Group A only): `has(r ?? "", "ROOT")` (1 site, A1 L107) where `r` is a resolved PATH
   string from `resolveImportPath` → STAYS UNCHANGED (it checks a path, not block content).

### Call-site counts (grep-verified)
- `has(out.text, …)` → **23 sites** (Groups C1-C12, D1-D4, E1-E3).
- `blocksRel(out.text, root)` → **4 sites**: L354 (C10 msg), L391 (D1), L443 (D5 handler), L470 (D7 handler).
- `countAbs(out.text, …)` → **4 sites**: L263 (C1), L353 (C10), L362 (C11), L363 (C11).
- `has(r ?? "", …)` → **1 site** (A1 L107) — UNCHANGED.
- `runViaHandler` usage → D5 (L441), D7 (L469) read blocks via `out.text`; D6 (L457) checks ONLY notify → UNCHANGED.

### Chosen migration approach (item description clause 1: "search r.blocks.join('\n\n') instead of r.text")
Keep `has`/`blocksRel`/`countAbs` as generic STRING helpers (so Group A path-string use stays valid).
Add ONE adapter and change block-content call sites to pass it:
```js
const blocksText = (r) => (r?.blocks ?? []).join("\n\n");
// has(out.text, M)        → has(blocksText(out), M)
// blocksRel(out.text, r)  → blocksRel(blocksText(out), r)
// countAbs(out.text, a)   → countAbs(blocksText(out), a)
```
(Equivalent alt: change the 3 helpers to take the result object `r` and read `r.blocks.join`; then Group
A1's `has(r ?? "", "ROOT")` becomes `(r ?? "").includes("ROOT")` inline. The adapter is lower-churn +
keeps Group A untouched — recommended.)

### Handler-level sites (D5, D7) — need before_agent_start (item description point (c))
`runViaHandler` currently returns ONLY the input result (`out.text` = stripped). Under the new model the
blocks are in the `pending` stash, published by before_agent_start. Rework:
```js
function captureHandlers() {
  const cbs = { input: [], session_start: [], before_agent_start: [] };
  mod.default({ on: (ev, cb) => { cbs[ev]?.push(cb); }, registerMessageRenderer: () => {} });  // +registerMessageRenderer + before_agent_start
  return cbs;
}
async function runViaHandler(root, prompt) {
  const cbs = captureHandlers();
  for (const cb of cbs.session_start) await cb({}, { cwd: root, isProjectTrusted: () => true });
  const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(root));
  const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(root)) : undefined;
  return { out, msg };
}
// D5/D7: blocksRel(out.text, root) → blocksRel(msg.message.content, root)   (content == blocks.join("\n\n"))
```
`captureHandlers` already uses ONE factory (one `mod.default(pi)`), so input + before_agent_start SHARE
`pending` — good, just need to capture + drive before_agent_start.

## import-behavior.test.mjs — full site inventory (grep-verified)

### Helpers (L35-47)
```js
const run = async (cwd, prompt, bareAt) => { const out = await mod.injectFiles(...); return out; };  // returns full result (comment stale: says {text,images,injected,paged})
const has = (out, marker) => (out.text ?? "").includes(marker);   // ← takes RESULT object `out`
function capture(event) { const cbs = []; mod.default({ on: (e, cb) => { if (e === event) cbs.push(cb); } }); return cbs; }  // ONE factory PER event
async function runHandler(cwd, prompt) {
  for (const cb of capture("session_start")) await cb({}, { cwd, isProjectTrusted: () => true });  // factory A (sets module cfg)
  const inputCb = capture("input").pop();  // factory B (DIFFERENT pending closure)
  return await inputCb({ text: prompt, source: "interactive", images: [] }, ctxFor(cwd));
}
```

### The EASIEST migration: `has` is one line
`has(out, marker)` already takes the RESULT object. Change its body from `(out.text ?? "")` to
`(out.blocks ?? []).join("\n\n")` → ALL 20 injectFiles-direct tests (Groups 1-4, 5a, 5c, 5e, 5f) pass
unchanged (they pass `o` = injectFiles result, which now has `.blocks`). One-line helper edit.

### Handler-level sites (5b, 5d) — need before_agent_start + single-factory rework
5b (L212-213) and 5d (L227-228) use `runHandler` and check `has(o, …)` where `o` is the INPUT result
(no `.blocks`). Under the new model `has(o, …)` reads `(o?.blocks ?? []).join()` = `""` → always false.
AND `runHandler` uses separate `capture(event)` calls (factory A for session_start, factory B for input)
→ even if it captured before_agent_start it'd be factory C (pending null). Rework to ONE factory:
```js
function captureAll() { const cbs = {}; mod.default({ on: (ev, cb) => { (cbs[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} }); return cbs; }
async function runHandler(cwd, prompt) {
  const cbs = captureAll();
  for (const cb of (cbs.session_start ?? [])) await cb({}, { cwd, isProjectTrusted: () => true });
  const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(cwd));
  const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(cwd)) : undefined;
  return { out, msg };
}
// 5b: assert(out.action === "transform" && msg.message.content.includes("ARCH-MARKER"), …)
// 5d: assert(out.action === "transform" && msg.message.content.includes("B-MARKER"), …)
```
(Old `capture(event)` becomes unused after this rework — remove it or leave it; cleaner to remove.)

## Gates
- `node ./relative-imports.test.mjs` → `Result: 38 passed, 0 failed`, exit 0.
- `node ./import-behavior.test.mjs` → `Result: 22 passed, 0 failed`, exit 0.
- (The project's `npm test` gate = `node ./file-injector.test.mjs` = P1.M2.T1.S1's scope, NOT this task.)

## Scope boundaries (do NOT touch)
- file-injector.ts — READ ONLY (git diff empty; tests migrate TO the landed T2.S2 contract).
- file-injector.test.mjs — P1.M2.T1.S1's scope (parallel).
- README.md — P1.M2.T3.S1.
- No fixtures/case-count/logic change — only the OUTPUT CONTAINER the tests read changed.
