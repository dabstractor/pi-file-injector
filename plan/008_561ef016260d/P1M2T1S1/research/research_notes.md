# Research Notes — P1.M2.T1.S1 (plan/008): Migrate file-injector.test.mjs (~170 assertions) to r.blocks/r.details

**Item:** Migrate `file-injector.test.mjs`'s ~170 `r.text` assertions to the NEW `injectFiles` return shape
`{ text(stripped), images, injected, paged, blocks: string[], details: FileDetail[] }`. The `text` field is now
STRIPPED-ONLY (no `\n\n---\n\n` separator, no appended blocks); the `<file>` blocks live in `r.blocks`. Test-only.

---

## 0. The new return shape + delivery model (the CONTRACT — from P1.M1.T1.S2 + P1.M1.T2.S1, both LANDED)

`injectFiles` (file-injector.ts:933-1017) now returns:
```ts
{ text: string /* STRIPPED prompt only — NO blocks, NO \n\n---\n\n */,
  images: ImageContent[], injected: number, paged: number,
  blocks: string[] /* the <file>…</file> block strings, in emission order */,
  details: FileDetail[] /* per-file metadata, parallel to blocks (one detail per emitText) */ }
```
- file-injector.ts:999 — nothing-injected path returns `blocks: [], details: []`.
- file-injector.ts:1015-1017 — the user message is JUST the stripped prompt; blocks+details are returned for the caller.
- The `input` HANDLER (file-injector.ts:~1069-1074) returns `{ action:"transform", text: stripped, images }` (stripped only) and stashes `{ blocks, details }` in the `pending` CLOSURE var.
- `before_agent_start` (file-injector.ts:~1096-1108) reads `pending` and returns the custom message `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.

## 1. CRITICAL BLOCKER — the suite FAILS TO LOAD (pi-tui alias absent)

Empirically: `node ./file-injector.test.mjs` → `Error: Cannot find module '@earendil-works/pi-tui'`. T2.S2 (parallel, LANDED uncommitted — `git status` shows `M file-injector.ts`) added `import { Box, Text, type Component } from "@earendil-works/pi-tui";` (file-injector.ts:4) AND `renderInjectedMessage`/`registerMessageRenderer`. The test harness's jiti alias map (file-injector.test.mjs:60-64) has NO pi-tui entry → jiti cannot resolve the import → the file never loads → ZERO tests run.

**T2.S2's PRP explicitly defers the alias to "P1.M2.T2.S2 (renderer tests)".** But that ordering is broken for THIS task: M2.T1 (migration) MUST run the suite to verify, and the suite can't load without the alias. **Therefore M2.T1.S1 MUST add the pi-tui alias** (1 line in the alias map) as a precondition — it is squarely a test-harness change (M2.T1's scope: "test file changes only"). M2.T2.S2 may also reference it (idempotent — adding an existing alias map key is a no-op).

The alias to add (mirroring the existing pi-coding-agent / pi-ai entries, same `PIPKG`/nested-node_modules pattern T2.S2's probe used):
```js
alias: {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
  "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",   // ← ADD (T2.S2's pi-tui import)
},
```

## 2. Module-surface guard — `renderInjectedMessage` (item §3f) MUST be synced

T2.S2 added `export function renderInjectedMessage` (file-injector.ts). The module-surface completeness guard (file-injector.test.mjs:143-155) filters `Object.keys(mod).filter(k => typeof mod[k]==="function")` and FAILS if a shipped fn is in NEITHER `ASSERTED_EXPORTS` nor `PURE_HELPERS_NOT_ASSERTED`. So the guard now fails: `module ships functions not in the sanity list: renderInjectedMessage`.
- Sanity list (L128-146): APPEND `assert(typeof mod.renderInjectedMessage === "function", "mod.renderInjectedMessage must be a function (§6.3 chat renderer for fileInjector.injected custom messages)");` after the `readConfig` assert (L146).
- `ASSERTED_EXPORTS` Set (L150-154): APPEND `"renderInjectedMessage",` (after `"readConfig"`).
- NOTE: `readLine`/`expandHint`/`tildify` are NOT exported (internal) → NOT subject to the guard.

## 3. State mock literals — add `details: []` (item §3g)

The `State` interface now has `details: FileDetail[]` (required, file-injector.ts:347). 7 scanTokens unit-test State mocks lack it (grep `remaining: null, count: 0, paged: 0` → L1806, 1958, 1969, 1988, 2003, 2016, 2031). At runtime scanTokens reads only `injectedSet`/`localSeen` (NOT details) → these mocks technically work, BUT add `details: []` for structural completeness + interface fidelity (item §3g is explicit). Each becomes `{ blocks: [], details: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 }`.

## 4. The ~150 `r.text` assertions on `mod.injectFiles` results — categorize + migrate

(`grep` counts against the current 2381-line file.)

| Cat | Pattern | Count | Old → New |
|---|---|---|---|
| (a) | `r.text.includes("\n\n---\n\n")` | 1 (L397) | **DELETE** the assert line (separator gone). |
| (b) | `r.text.includes('<file name="ABS">…')` (content checks) | 95 | `r.blocks.some(b => b.includes('<file name="ABS">'))` |
| (c) | `r.text.indexOf('<file name="A">')` (ordering) | 35 | index in `r.blocks`: `r.blocks.findIndex(b => b.includes('A')) < r.blocks.findIndex(b => b.includes('B'))` |
| (d) | `r.text.includes("<paged:")` | 7 | `r.blocks.some(b => b.includes("<paged:"))` |
| (e) | `r.text === "<stripped>\n\n---\n\n<file…>"` (equality) | 13 | `r.text === "<stripped>"` (no blocks/no ---) + optionally `r.blocks.length`/`r.blocks[0]` |

**Worked examples (the transformation the implementer applies category-by-category):**
```js
// (b) content — OLD:                            NEW:
assert(r.text.includes(`<file name="${A_TS}">\n${A_TS_CONTENT}\n</file>`), …);
//  → assert(r.blocks.some(b => b.includes(`<file name="${A_TS}">`)) && r.blocks.some(b => b.includes(A_TS_CONTENT)), …);
//   (splitting the block-open + content lets the .some() match either the whole block or its body)

// (c) ordering — OLD: notes.md block BEFORE api.md block in r.text
assert(r.text.indexOf(`<file name="${NOTES}">`) < r.text.indexOf(`<file name="${API}">`), …);
//  → assert(r.blocks.findIndex(b => b.includes(`<file name="${NOTES}">`)) < r.blocks.findIndex(b => b.includes(`<file name="${API}">`)), …);

// (d) paged directive — OLD:                    NEW:
assert(r.text.includes("<paged:"), …);
//  → assert(r.blocks.some(b => b.includes("<paged:")), …);

// (e) stripped-prompt equality — OLD:           NEW:
assert(r.text === "Review a.ts\n\n---\n\n<file name=\"" + A_TS + "\">\n…\n</file>", …);
//  → assert(r.text === "Review a.ts", `text is the stripped prompt only (no blocks, no ---), got ${JSON.stringify(r.text)}`);
//    + assert(r.blocks.some(b => b.includes(`<file name="${A_TS}">`)), "the a.ts block is in r.blocks");
```
**NEGATIVE asserts** (`!r.text.includes('<file name="X">')`) migrate to `!r.blocks.some(b => b.includes('<file name="X">'))` — these verify a file was NOT injected (dedup / abs-rejected / bare-@-off / mid-word), and that intent is preserved by checking `r.blocks`.

## 5. Handler-level tests — only 4 read `out.text` for block content (the multi-event capture)

Most handler tests assert `out.action` + `rec.notify` (e.g. L489-494: `out.action === "transform"` + `rec.notify.m === "#@ injected 2 whole"`) — UNAFFECTED by the return-shape change. Only **4** asserts read `out.text` for `<file>` content: **L523, L2215, L2239, L2240**. Under the new model `out.text` is stripped-only → these FAIL.

**The `pending` stash is a CLOSURE var** (file-injector.ts:1057 — "CLOSURE var (NOT module-level like cfg above): pending is a per-prompt handoff between two handlers from [the same factory]"). So `input` and `before_agent_start` MUST be driven from the SAME factory invocation to share `pending`. The existing `captureHandler(event)` captures ONE event per `mod.default(pi)` call → driving input (factory A) then before_agent_start (factory B) would NOT share `pending` (B's pending is null). Note `captureHandler` already returns `{ cb, all }` (L167-170) — but `all` is per-event, not cross-event.

**Add a multi-event capture helper** (captures EVERY handler the factory registers from ONE `mod.default(pi)`, so input + before_agent_start share the `pending` closure):
```js
// Capture ALL handlers (every event) from ONE mod.default(pi) call, so handlers sharing a factory closure
// (the input→before_agent_start `pending` stash) are driven against the same factory state. cfg is MODULE-
// level (persists across factories); pending is CLOSURE-scoped (per factory) — so the delivery flow needs this.
function captureAllHandlers() {
  const handlers = {};                         // event → array of callbacks (session_start has 2: config + autocomplete)
  const pi = { on: (ev, cb) => { (handlers[ev] ??= []).push(cb); } };
  mod.default(pi);
  return handlers;                             // e.g. { input: [fn], session_start: [cfgFn, acFn], before_agent_start: [fn] }
}
```
**Handler delivery migration (the 4 sites):**
```js
// OLD (L523): out.text carried the blocks
const slot = captureHandler();
const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
assert(out.text && out.text.includes('<file name="' + A_TS + '">'), …);
// NEW: input returns transform + stripped text; the blocks are published by before_agent_start (same factory)
const h = captureAllHandlers();
const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
assert(out.action === "transform", …);
assert(out.text === "Review a.ts", `handler text is the stripped prompt, got ${JSON.stringify(out.text)}`);
const msg = await h.before_agent_start[0]({}, ctx);   // SAME factory → shares the pending stash
assert(msg && msg.message && msg.message.customType === "fileInjector.injected", `before_agent_start publishes the custom message, got ${JSON.stringify(msg)}`);
assert(msg.message.content.includes(`<file name="${A_TS}">`), `the a.ts block is in the custom message content`);
```
For the §4.6 config sites (L2215/L2239/L2240): `captureAllHandlers()` lets you ALSO drive `h.session_start[0]` (the config handler) to set the module-level cfg BEFORE `h.input[0]` — all from one factory. (cfg is module-level so it persists; but using one captureAllHandlers for the whole flow is cleanest.)

## 6. What does NOT change (scope guard)

- The injection LOGIC (regex, cleanToken, resolution, paging, imports, dedup, config, bare-@, code-region detection) is UNCHANGED — only the OUTPUT CONTAINER changed (r.text → r.blocks). Migrated asserts verify the SAME logic.
- Pure-function tests (`cleanToken`, `scanTokens`, `resolveImportPath`, `readConfig`, etc. called directly) need NO migration — they don't read `r.text`.
- The `injected`/`paged` numeric asserts (`r.injected === 1`, `r.paged === 0`) are UNAFFECTED.
- Case COUNT is unchanged (we migrate asserts within cases; the only removal is the 1 separator assert line, not a whole case).

## 7. Verification gate

```bash
node ./file-injector.test.mjs   # → green (after the pi-tui alias + the migration)
```
LOAD currently fails (pi-tui); after the alias, the suite runs and the migrated asserts must pass. The pass count = the pre-return-shape-change count (~122 cases; unchanged by migration). `npm run typecheck` is UNCHANGED (test-only .mjs, untyped; the .ts is T2.S2's gate).

## 8. Docs

None (test-only; no user-facing surface). The item §5: "test file changes only; no user-facing surface."

## 9. Sibling test files (NOT this task)

`relative-imports.test.mjs` + `import-behavior.test.mjs` are P1.M2.T1.S2's scope (they use `has(out.text, "MARKER")` helpers → update `has()` to search `r.blocks.join("\n\n")`, per test_migration.md). DO NOT touch them here. They ALSO need the pi-tui alias when they run (each has its own jiti alias map) — but that's M2.T1.S2's concern (this task edits ONLY file-injector.test.mjs).
