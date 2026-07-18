---
name: "P1.M2.T1.S1 (plan/008) — Migrate file-injector.test.mjs (~170 assertions) from r.text to r.blocks/r.details (the new injectFiles return shape)"
prd_ref: "PRD §9 (Algorithm — injectFiles returns {text(stripped), images, injected, paged, blocks, details}); §6.2/§6.4 (blocks leave the user message → a custom message from before_agent_start); plan/008 architecture/test_migration.md (the migration patterns)"
target_file: "./file-injector.test.mjs"   # EDIT IN PLACE — pi-tui alias; renderInjectedMessage guard sync; details:[] State mocks; captureAllHandlers helper; ~150 r.text→r.blocks migrations + 1 separator-assert deletion + 4 handler-level out.text→before_agent_start migrations
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (the .ts is T2.S2's typecheck gate — UNCHANGED here)
depends_on: "P1.M1.T1.S2 (injectFiles return +blocks/+details — LANDED) + P1.M1.T2.S1 (input/before_agent_start split + pending closure — LANDED) + P1.M1.T2.S2 (pi-tui import + renderInjectedMessage + registerMessageRenderer — LANDED uncommitted). The suite is currently RED: it FAILS TO LOAD (no pi-tui alias) AND ~150 asserts read the OLD r.text shape."
consumed_by: "P1.M2.T1.S2 (relative-imports + import-behavior migration — same pattern; each file needs its own pi-tui alias), P1.M2.T2.S1/S2 (delivery + renderer tests — reuse captureAllHandlers + the pi-tui alias this task adds), P1.M2.T3.S1 (README Mode B)"
---

# PRP — P1.M2.T1.S1: Migrate file-injector.test.mjs assertions to the new injectFiles return shape (r.text → r.blocks/r.details)

> **Scope flag:** Test-only migration. `injectFiles` now returns `{ text(stripped), images, injected, paged, blocks: string[], details: FileDetail[] }` — `text` is the STRIPPED prompt ONLY (no `\n\n---\n\n` separator, no appended blocks); the `<file>` blocks live in `r.blocks`. The `input` handler returns stripped text and stashes `{blocks, details}` in the `pending` closure; `before_agent_start` publishes them as a custom message. **~150 assertions reading `r.text` for block content must migrate to `r.blocks`; 1 separator assert is deleted; 4 handler-level `out.text` block-asserts migrate to a `before_agent_start` capture; plus 4 enabling changes (pi-tui alias [load BLOCKER], `renderInjectedMessage` guard sync, `details:[]` on 7 State mocks, a `captureAllHandlers` helper).** No `.ts` change, no README, no logic change — only the OUTPUT CONTAINER changed. The suite is currently RED (fails to load + ~150 stale asserts); this task makes it GREEN.

---

## Goal

**Feature Goal:** Make `file-injector.test.mjs` pass against the NEW `injectFiles` return shape by migrating
every `r.text`/`out.text` block-content assertion to `r.blocks` (or the `before_agent_start` custom message for
handler-level delivery), deleting the obsolete `\n\n---\n\n` separator assertion, and adding the 4 enabling
harness changes the suite now needs to load + stay green. No injection LOGIC changes — the migrated asserts
verify the SAME regex/cleanup/resolution/paging/imports/dedup/config/bare-@/code-region behavior, just read
from `r.blocks` instead of `r.text`.

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): (1) pi-tui jiti alias (load fix);
(2) `renderInjectedMessage` → sanity list + `ASSERTED_EXPORTS`; (3) `details: []` on 7 State mocks; (4) a
`captureAllHandlers()` helper; (5) ~150 `r.text`→`r.blocks` migrations + 1 separator-assert deletion + 4
handler-level `out.text`→`before_agent_start` migrations. No `.ts`/README/plan edits.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **GREEN** (loads + all cases pass, exit 0). The suite prints the SAME
   case count as before the return-shape change (migration changes assertions, not case count).
2. The module-surface guard passes (`renderInjectedMessage` recognized; no "ships functions not in sanity list").
3. ZERO remaining `r.text.includes('<file name=` / `r.text.indexOf('<file name=` / `r.text.includes("\n\n---\n\n")`
   / `r.text.includes("<paged:")` reads (grep returns 0 for the block-content/separator/paged patterns on `r.text`).
4. The 4 handler-level block asserts (L523, L2215, L2239, L2240) drive `before_agent_start` and assert the
   custom message `content`.
5. No `.ts` change (`git diff --stat file-injector.ts` is empty relative to the T2.S2 working tree).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` — the project's `npm test` gate. The
return-shape refactor (P1.M1) intentionally moved blocks out of `r.text` (PRD §6.4: compact display); this task
brings the test suite into compliance so the gate is GREEN again.

**Use Case:** `git pull && node ./file-injector.test.mjs` → `Result: N passed, 0 failed.`

**Pain Points Addressed:** The suite is currently RED (fails to load + ~150 stale asserts), blocking the gate
and all downstream work (M2.T1.S2, M2.T2, M2.T3). This task unblocks the plan.

## Why

- **The return shape deliberately changed (PRD §6.4).** Blocks left the user-message text precisely so a
  registered renderer can draw them compactly (the compact-display feature this plan delivers). The old
  `r.text = stripped + "\n\n---\n\n" + blocks` is gone; `r.text` is stripped-only and `r.blocks` carries the
  blocks. The tests MUST follow.
- **Mechanical but broad — precision over creativity.** ~150 asserts, 5 categories, each with a deterministic
  old→new transformation. No logic to design; the risk is MISSING a site or mis-translating an ordering check.
  The PRP gives exact grep-to-find commands + worked examples per category.
- **4 enabling harness changes are the load/guard/mock prerequisites.** Without the pi-tui alias the file
  won't LOAD (T2.S2's deferred handoff landed); without the `renderInjectedMessage` guard sync the module-
  surface check fails; without `details:[]` the State mocks are interface-incomplete; without `captureAllHandlers`
  the 4 handler delivery asserts can't share the `pending` closure. These MUST land first.
- **Unblocks M2.T1.S2 + M2.T2.** The pi-tui alias + `captureAllHandlers` helper are reused by the sibling test
  files' migration (M2.T1.S2) and the new delivery/renderer tests (M2.T2). Landing them here is the right seam.

## What

No user-visible / API / logic change. The test file's ASSERTIONS change container (r.text → r.blocks / custom
message); the cases, fixtures, helpers (`runCase`, `assert`, `makeMockCtx`, `captureHandler`), and the pass/fail
matrix are structurally unchanged. The file gains: 1 alias line, 1 sanity assert + 1 ASSERTED_EXPORTS entry,
`details:[]` on 7 mocks, 1 new helper (`captureAllHandlers`), and ~155 migrated/deleted assertions.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `0 failed`, exit 0; loads cleanly (no `Cannot find module '@earendil-works/pi-tui'`).
- [ ] The jiti `alias` map contains `"@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",`.
- [ ] `renderInjectedMessage` is in BOTH the sanity list (`assert(typeof mod.renderInjectedMessage === "function", …)`) AND `ASSERTED_EXPORTS`.
- [ ] All 7 State mock literals (grep `remaining: null, count: 0, paged: 0`) include `details: []`.
- [ ] `captureAllHandlers()` helper exists (captures every event's handlers from one `mod.default(pi)`).
- [ ] ZERO `r.text.includes('<file name=` / `r.text.indexOf('<file name=` / `r.text.includes("\n\n---\n\n")` /
      `r.text.includes("<paged:")` reads remain (grep = 0 for these on `r.text`).
- [ ] The 1 separator assert (L397) is DELETED.
- [ ] The 4 handler-level block asserts (L523, L2215, L2239, L2240) drive `before_agent_start` + assert `msg.message.content`.
- [ ] `git diff --stat file-injector.ts` is empty (no `.ts` change).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact NEW return shape (+ the input/before_agent_start delivery model with the
`pending` CLOSURE var), the empirically-confirmed LOAD BLOCKER (pi-tui alias absent — `node` output quoted),
the exact grep counts + line numbers for each of the 5 assertion categories (95/35/7/13/1) and the 4 handler
sites, the module-surface guard mechanics (with the "why it fails without the sync" proof), the 7 State-mock
line numbers, the `captureAllHandlers` design (why `pending` needs a single-factory capture), worked old→new
examples for EVERY category (incl. negative asserts + ordering + stripped-prompt equality), and the single gate
(`node ./file-injector.test.mjs`). The implementer edits ONE file, iterates category-by-category (run the suite
after each), and stops when green.

### Documentation & References

```yaml
# MUST READ — the migration strategy doc (patterns + helper additions + new-test seeds)
- file: plan/008_561ef016260d/architecture/test_migration.md
  why: "§'file-injector.test.mjs (the bulk — ~170 assertions)' lists the 6 migration patterns (separator DELETE;
        includes→blocks.some; indexOf→blocks index; <paged:→blocks.some; equality→stripped-only; handler-level→
        before_agent_start capture). §'Handler-level testing' confirms 'Tests must capture BOTH handlers and
        exercise the full flow.' §'Test helper additions' shows the stubTheme pattern (M2.T2.S2, not this task)."
  critical: "The migration is MECHANICAL. The risk is missing a site or mis-translating ordering. The PRP's grep
             commands + worked examples operationalize this doc into exact edits."

# MUST READ — the new return shape + delivery model (the CONTRACT)
- file: plan/008_561ef016260d/P1M1T1S2/PRP.md   # (T1.S2 — Complete: injectFiles return +blocks/+details)
- file: plan/008_561ef016260d/P1M1T2S1/PRP.md   # (T2.S1 — Complete: input/before_agent_start split + pending closure)
  why: "T1.S2 defined the return shape {text(stripped), images, injected, paged, blocks, details}. T2.S1 defined
        the delivery: input returns {action:transform, text:stripped, images} + stashes {blocks,details} in the
        `pending` CLOSURE var; before_agent_start returns {message:{customType:'fileInjector.injected', content:
        blocks.join('\n\n'), display:true, details:{files}}}. The closure scope is WHY handler delivery tests
        need captureAllHandlers (one factory → shared pending)."
  critical: "pending is a CLOSURE var (file-injector.ts:1057 'CLOSURE var (NOT module-level like cfg)'), NOT module-
             level. So input + before_agent_start MUST come from the SAME mod.default(pi). captureHandler(event)
             captures one event per factory → cannot share pending across input+before_agent_start. Use captureAllHandlers."

# MUST READ — the pi-tui LOAD BLOCKER + the deferred alias (why M2.T1.S1 must add it)
- file: plan/008_561ef016260d/P1M1T2S2/PRP.md   # (T2.S2 — LANDED uncommitted: pi-tui import + renderInjectedMessage)
  why: "T2.S2 added `import { Box, Text, type Component } from '@earendil-works/pi-tui'` (file-injector.ts:4) +
        `export function renderInjectedMessage` + `pi.registerMessageRenderer(...)`. T2.S2's PRP §'The jiti alias'
        explicitly deferred the alias to 'P1.M2.T2.S2 (renderer tests)' — but that ordering is broken for M2.T1:
        the migration's gate (suite green) REQUIRES the file to load, which REQUIRES the alias. M2.T1.S1 adds it."
  critical: "T2.S2 is LANDED (git status: M file-injector.ts). The suite FAILS TO LOAD until the alias is added.
             Empirical: `node ./file-injector.test.mjs` → `Error: Cannot find module '@earendil-works/pi-tui'`.
             The alias key is the SAME nested-node_modules path T2.S2's probe used. Adding it is idempotent if
             M2.T2.S2 also adds it."

# The file you edit (the ONLY change)
- file: file-injector.test.mjs
  why: "2381 lines. jiti alias map L60-64 (ADD pi-tui). Sanity list L128-146 + ASSERTED_EXPORTS L150-154 (ADD
        renderInjectedMessage). makeMockCtx L158 (UNAFFECTED). captureHandler L167-170 (already has .all; ADD a
        sibling captureAllHandlers helper nearby). State mocks L1806/1958/1969/1988/2003/2016/2031 (ADD details:[]).
        ~150 r.text asserts scattered (grep-to-find per category). Separator assert L397 (DELETE). Handler block
        asserts L523/L2215/L2239/L2240 (migrate to before_agent_start)."
  pattern: "The harness is a flat ESM script: runCase(n,name,fn) at L88; assert(cond,msg) throws on failure;
            mod.injectFiles(prompt, images, ctx, bareAt) → r.{text,images,injected,paged,blocks,details};
            captureHandler(event) → {cb, all}; makeMockCtx(cwd, opts) → {ctx, rec}. Mirror the existing style."
  gotcha: "r.text is now STRIPPED-ONLY. Do NOT assume r.text still contains blocks or the separator. Negative
           asserts (!r.text.includes('<file X')) that verified 'X NOT injected' MUST move to !r.blocks.some(...)
           — otherwise they pass TRIVIALLY (nothing is in stripped text) and stop guarding the intent."

# The product code (UNCHANGED — read-only; the contract the tests migrate TO)
- file: file-injector.ts
  why: "injectFiles return L938-1017 (text=stripped at L1017; blocks/details at L999/L1017). State.details L347
        (required). pending closure L1054-1059 + input stash ~L1069-1074 + before_agent_start ~L1096-1108
        (customType 'fileInjector.injected' L1099). renderInjectedMessage (T2.S2, exported). Do NOT edit any of this."
  gotcha: "git diff --stat file-injector.ts MUST be empty after this task (relative to the T2.S2 working tree).
           The tests migrate to MATCH the .ts; the .ts is not touched."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD + uncommitted T2.S2 edits (M file-injector.ts: pi-tui import + renderer)
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (2381 lines; currently RED: fails to load + ~150 stale asserts)
├── file-injector.ts             # UNCHANGED (T2.S2 working tree: return shape + delivery + renderer all landed)
├── relative-imports.test.mjs    # NOT edited (M2.T1.S2's scope)
├── import-behavior.test.mjs     # NOT edited (M2.T1.S2's scope)
├── scripts/typecheck.mjs        # untouched
├── package.json / PRD.md / README.md   # untouched
└── plan/008_561ef016260d/
    ├── architecture/{external_deps.md, system_context.md, test_migration.md}   # test_migration.md = the strategy doc
    ├── P1M1T1S1..P1M1T2S2/{PRP.md, research/}   # the return-shape + delivery + renderer predecessors (all LANDED)
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED (5 change classes):
                          #   (1) jiti alias map L60-64: +pi-tui entry (LOAD fix)
                          #   (2) sanity list L128-146 + ASSERTED_EXPORTS L150-154: +renderInjectedMessage (guard sync)
                          #   (3) 7 State mocks (L1806/1958/1969/1988/2003/2016/2031): +details: []
                          #   (4) +captureAllHandlers() helper (near captureHandler L167)
                          #   (5) ~150 r.text→r.blocks migrations + 1 separator-assert deletion (L397) +
                          #       4 handler out.text→before_agent_start migrations (L523/L2215/L2239/L2240)
# file-injector.ts is NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the suite FAILS TO LOAD until you add the pi-tui alias. T2.S2 (LANDED uncommitted) added
//   `import { Box, Text } from "@earendil-works/pi-tui"` (file-injector.ts:4). The test harness's jiti alias map
//   (L60-64) has NO pi-tui entry → `node ./file-injector.test.mjs` → `Cannot find module '@earendil-works/pi-tui'`.
//   T2.S2's PRP deferred the alias to M2.T2.S2, but M2.T1's gate (suite green) REQUIRES the load. ADD the alias
//   here (it's a test-harness change = M2.T1's scope). Idempotent if M2.T2.S2 also adds it.

// CRITICAL — the module-surface guard (L143-155) WILL FAIL without syncing renderInjectedMessage. T2.S2 exported
//   `renderInjectedMessage`; the guard filters shipped functions and fails if one is in NEITHER ASSERTED_EXPORTS
//   nor PURE_HELPERS_NOT_ASSERTED → "module ships functions not in the sanity list: renderInjectedMessage". ADD
//   BOTH the sanity typeof-assert AND the ASSERTED_EXPORTS entry. (readLine/expandHint/tildify are NOT exported.)

// CRITICAL — pending is a CLOSURE var, NOT module-level. input and before_agent_start MUST be driven from the
//   SAME mod.default(pi) to share the pending stash. captureHandler(event) captures ONE event per factory →
//   driving input (factory A) then before_agent_start (factory B) does NOT share pending (B's pending is null).
//   Use captureAllHandlers() (captures EVERY event from ONE factory) for handler delivery tests. cfg IS module-
//   level (persists across factories) — so config-handler-then-input CAN span two captureHandler calls; but
//   using one captureAllHandlers for the whole flow is cleanest.

// CRITICAL — NEGATIVE asserts must migrate too. `!r.text.includes('<file name="X">')` (verifying X was NOT
//   injected — dedup/abs-rejected/bare-@-off/mid-word) becomes `!r.blocks.some(b => b.includes('<file name="X">'))`.
//   If left on r.text, the assert passes TRIVIALLY (stripped text never has blocks) and STOPS guarding the intent
//   → a future regression (X wrongly injected) would not be caught.

// CRITICAL — do NOT edit file-injector.ts. The tests migrate to MATCH the .ts; the .ts is T2.S2's (landed) contract.
//   `git diff --stat file-injector.ts` MUST be empty relative to the working tree you started from.

// GOTCHA — ordering checks via r.text.indexOf migrate to r.blocks.findIndex. Two blocks' relative order is now
//   their INDEX order in r.blocks (emission order = pre-order DFS, unchanged from before). findIndex returns -1
//   if absent — guard accordingly if a test relied on indexOf's -1 semantics.

// GOTCHA — stripped-prompt equality asserts (r.text === "Review a.ts\n\n---\n\n<file…>") now assert
//   r.text === "Review a.ts" (NO blocks, NO separator). Where the old assert ALSO implicitly checked the block,
//   ADD a companion r.blocks.some(...) so the delivery is still verified (don't lose coverage).

// GOTCHA — the 7 State mocks are scanTokens unit tests. scanTokens reads only injectedSet/localSeen at runtime,
//   so they technically work WITHOUT details — but ADD details:[] for interface fidelity (item §3g explicit) and
//   to avoid a future scanTokens change that reads details from silently passing on an incomplete mock.

// GOTCHA — most handler tests assert out.action + rec.notify (UNAFFECTED by the return-shape change). Only the 4
//   sites reading out.text for <file> content need the before_agent_start migration. Don't touch the unaffected ones.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti (alias map L60-64). No test runner. runCase(n,name,fn)/assert.
//   The gate is `node ./file-injector.test.mjs`. npm run typecheck is the .ts gate (UNAFFECTED — test-only).
```

## Implementation Blueprint

### The 5 change classes (do ENABLING changes 1-4 first, then the MIGRATIONS 5)

**ENABLING CHANGE 1 — pi-tui jiti alias (LOAD fix — do FIRST; nothing runs without it).**
```js
// file-injector.test.mjs L60-64 — oldText:
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
// newText (add the pi-tui line):
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
```
VERIFY: `node ./file-injector.test.mjs 2>&1 | head -3` no longer prints `Cannot find module '@earendil-works/pi-tui'`; the suite now RUNS (and fails on the stale asserts + the guard).

**ENABLING CHANGE 2 — `renderInjectedMessage` guard sync (else the module-surface guard fails).**
- Sanity list (after the `readConfig` assert, L146): APPEND
  `assert(typeof mod.renderInjectedMessage === "function", "mod.renderInjectedMessage must be a function (§6.3 chat renderer for fileInjector.injected custom messages)");`
- `ASSERTED_EXPORTS` Set (L150-154): APPEND `"renderInjectedMessage",` (after `"readConfig",`).

**ENABLING CHANGE 3 — `details: []` on the 7 State mocks.**
`grep -n "remaining: null, count: 0, paged: 0" file-injector.test.mjs` → L1806, 1958, 1969, 1988, 2003, 2016, 2031. Each `{ blocks: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 }` → add `details: [],` (after `blocks: [],`).

**ENABLING CHANGE 4 — `captureAllHandlers()` helper (for handler delivery tests).** Add near `captureHandler` (L167):
```js
// Capture EVERY handler the factory registers (all events) from ONE mod.default(pi) call, so handlers sharing a
// factory closure (the input→before_agent_start `pending` stash) are driven against the same factory state.
// (cfg is MODULE-level — persists across factories; pending is CLOSURE-scoped — per factory. The delivery flow
// needs ONE factory for both.) Returns { event: [cb,…], … } e.g. { input:[fn], session_start:[cfgFn,acFn],
// before_agent_start:[fn] }.
function captureAllHandlers() {
  const handlers = {};
  const pi = { on: (ev, cb) => { (handlers[ev] ??= []).push(cb); } };
  mod.default(pi);
  return handlers;
}
```

**MIGRATION 5a — DELETE the separator assert (1 site).** `grep -n '"\\\\n\\\\n---\\\\n\\\\n"' file-injector.test.mjs` → L397. DELETE the line `assert(r.text.includes("\n\n---\n\n"), "blocks must be appended after a '\\n\\n---\\n\\n' separator");` (the separator no longer exists). Keep the case's other asserts (inject count, block content).

**MIGRATION 5b — `r.text.includes('<file name=')` content checks → `r.blocks.some(...)` (95 sites).**
`grep -n "r\.text\.includes\|out\.text\.includes" file-injector.test.mjs` → ~95 `r.text` hits + 4 `out.text` (handled in 5f).
```js
// OLD: assert(r.text.includes(`<file name="${A_TS}">\n${A_TS_CONTENT}\n</file>`), …);
// NEW: assert(r.blocks.some(b => b.includes(`<file name="${A_TS}">`)) && r.blocks.some(b => b.includes(A_TS_CONTENT)), …);
// NEGATIVE: assert(!r.text.includes(`<file name="${X}">`), …);
//       →  assert(!r.blocks.some(b => b.includes(`<file name="${X}">`)), …);   // MUST migrate — else trivially true
```

**MIGRATION 5c — ordering `r.text.indexOf` → `r.blocks.findIndex` (35 sites).**
`grep -n "\.text\.indexOf\|\.text\.lastIndexOf" file-injector.test.mjs`.
```js
// OLD: assert(r.text.indexOf(`<file name="${NOTES}">`) < r.text.indexOf(`<file name="${API}">`), …);
// NEW: assert(r.blocks.findIndex(b => b.includes(`<file name="${NOTES}">`)) < r.blocks.findIndex(b => b.includes(`<file name="${API}">`)), …);
```

**MIGRATION 5d — `<paged:` directive → `r.blocks.some(...)` (7 sites).**
`grep -n '<paged:' file-injector.test.mjs`.
```js
// OLD: assert(r.text.includes("<paged:"), …);
// NEW: assert(r.blocks.some(b => b.includes("<paged:")), …);
```

**MIGRATION 5e — stripped-prompt equality `r.text ===` → stripped-only + companion block check (13 sites).**
`grep -n "r\.text ===\|out\.text ===" file-injector.test.mjs` → ~13 `r.text` + 1 `out.text` (L523, handled in 5f).
```js
// OLD: assert(r.text === "Review a.ts\n\n---\n\n<file name=\"" + A_TS + "\">\n…\n</file>", …);
// NEW: assert(r.text === "Review a.ts", `text is the stripped prompt only (no blocks, no ---), got ${JSON.stringify(r.text)}`);
//      + assert(r.blocks.some(b => b.includes(`<file name="${A_TS}">`)), "the a.ts block is in r.blocks");
```

**MIGRATION 5f — handler-level `out.text` block asserts → `before_agent_start` capture (4 sites: L523, L2215, L2239, L2240).**
```js
// OLD (L523): const slot = captureHandler();
//   const out = await slot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
//   assert(out.text && out.text.includes('<file name="' + A_TS + '">'), …);
// NEW:
const h = captureAllHandlers();                                           // ONE factory → shared pending closure
const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
assert(out.action === "transform", `handler returns transform, got '${out.action}'`);
assert(out.text === "Review a.ts", `handler text is the stripped prompt, got ${JSON.stringify(out.text)}`);
const msg = await h.before_agent_start[0]({}, ctx);                       // SAME factory → reads the pending stash
assert(msg && msg.message && msg.message.customType === "fileInjector.injected", `before_agent_start publishes the custom message, got ${JSON.stringify(msg)}`);
assert(msg.message.content.includes(`<file name="${A_TS}">`), `the a.ts block is in the custom message content`);
// NEGATIVE (L2240: bare @b.ts NOT injected at top level): verify ABSENCE in the custom message content:
//   assert(!msg.message.content.includes(`<file name="${B_TS}">`), "bare @b.ts must NOT be delivered");
// For the §4.6 config sites (L2215/L2239): also drive h.session_start[0] (the config handler) BEFORE h.input[0]
// to set the module-level cfg — all from the same captureAllHandlers() (cfg is module-level so it persists, but
// one capture for the whole flow is cleanest).
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1 (ENABLING — LOAD): ADD the pi-tui jiti alias (L60-64)
  - ADD the "@earendil-works/pi-tui" line to the alias map (exact old→new above).
  - VERIFY: `node ./file-injector.test.mjs 2>&1 | head -3` no longer errors on pi-tui; the suite RUNS.
  - WHY FIRST: nothing else can be verified until the file loads.

Task 2 (ENABLING — GUARD): SYNC renderInjectedMessage (sanity list + ASSERTED_EXPORTS)
  - APPEND the typeof-assert after the readConfig assert (L146); APPEND "renderInjectedMessage" to ASSERTED_EXPORTS.
  - VERIFY: the module-surface guard no longer prints "ships functions not in the sanity list: renderInjectedMessage".

Task 3 (ENABLING — MOCKS): ADD details:[] to the 7 State mocks
  - EDIT each of L1806/1958/1969/1988/2003/2016/2031 to insert `details: [],` after `blocks: [],`.
  - (scanTokens reads only injectedSet at runtime, so these pass without it — but interface fidelity per item §3g.)

Task 4 (ENABLING — HELPER): ADD captureAllHandlers() near captureHandler (L167)
  - ADD the helper (exact body above). Used by the 4 handler delivery migrations + M2.T2 later.

Task 5 (MIGRATION — iterate category-by-category, RUN the suite after each):
  5a. DELETE the separator assert (L397). RUN.
  5b. MIGRATE the ~95 r.text.includes('<file…') → r.blocks.some(...) (incl. NEGATIVE asserts). RUN.
  5c. MIGRATE the ~35 r.text.indexOf ordering → r.blocks.findIndex. RUN.
  5d. MIGRATE the 7 <paged: → r.blocks.some(...). RUN.
  5e. MIGRATE the ~13 r.text === equality → stripped-only + companion r.blocks check. RUN.
  5f. MIGRATE the 4 handler out.text block asserts (L523/L2215/L2239/L2240) → captureAllHandlers + before_agent_start. RUN.
  - After each sub-task, RUN `node ./file-injector.test.mjs` and fix any remaining failures in that category before
    moving on (localizes regressions). The suite is GREEN only after 5a-5f are all done.

Task 6 (VERIFY GREEN + scope): final gate
  - node ./file-injector.test.mjs → `Result: N passed, 0 failed.` (N = the pre-return-shape case count; unchanged).
  - GREP zero-residue: `grep -cE "r\.text\.(includes|indexOf|lastIndexOf)\(|r\.text ===" file-injector.test.mjs`
    → the ONLY remaining r.text reads should be stripped-prompt-only checks (equality with NO blocks) — none reading
    for <file>/<paged:/---. (Confirm by eyeballing any survivors.)
  - git diff --stat file-injector.ts → EMPTY (no .ts change).
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - jiti alias map (L60-64): +pi-tui entry.
  - sanity list (~L146) + ASSERTED_EXPORTS (~L150-154): +renderInjectedMessage (typeof-assert + Set entry).
  - 7 State mocks (L1806/1958/1969/1988/2003/2016/2031): +details: [].
  - near captureHandler (~L167): +captureAllHandlers() helper.
  - ~150 r.text asserts: migrate to r.blocks (5b/5c/5d/5e) + 1 separator deletion (5a) + 4 handler out.text→
    before_agent_start (5f).
  - UNCHANGED: runCase/assert/makeMockCtx/captureHandler/integrationCase; all fixtures (buildFixtures); all pure-
    function tests (cleanToken/scanTokens/resolveImportPath/readConfig/etc.); all injected/paged numeric asserts;
    the case structure + IDs + the Summary/matrix.

NO_CHANGES: file-injector.ts (git diff empty), relative-imports.test.mjs (M2.T1.S2), import-behavior.test.mjs
            (M2.T1.S2), scripts/typecheck.mjs, package.json, PRD.md, README.md (M2.T3.S1), all plan/ files.
NO_LOGIC_CHANGE: the injection engine (regex/cleanup/resolution/paging/imports/dedup/config/bare-@/code-region)
                 is UNCHANGED — only the OUTPUT CONTAINER the tests read changed.
```

## Validation Loop

### Level 1: The gate — full suite GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Before this task: FAILS TO LOAD (`Cannot find module '@earendil-works/pi-tui'`) + ~150 stale asserts.
# After:  Result: N passed, 0 failed.   (N = pre-return-shape case count; migration doesn't change case count)
# Exit code 0.
# If it still fails to load → Task 1 (pi-tui alias) didn't land. If the guard fails → Task 2. If a State mock
# throws on a missing field → Task 3 (details:[]). If a migrated assert fails → re-check that category's pattern.
```

### Level 2: Zero-residue grep (no stale r.text block reads remain)

```bash
cd /home/dustin/projects/pi-file-injector
# These MUST return 0 (all migrated to r.blocks):
echo "separator:"; grep -c 'r\.text\.includes("\\\\n\\\\n---\\\\n\\\\n")' file-injector.test.mjs          # expect 0
echo "block-content includes:"; grep -c "r\.text\.includes.*<file name=" file-injector.test.mjs          # expect 0
echo "block indexOf:"; grep -c "r\.text\.indexOf.*<file name=" file-injector.test.mjs                    # expect 0
echo "paged directive:"; grep -c 'r\.text\.includes.*<paged:' file-injector.test.mjs                     # expect 0
echo "out.text block includes:"; grep -c "out\.text\.includes.*<file name=" file-injector.test.mjs       # expect 0
# The ONLY survivors should be r.text === "<stripped prompt>" (no blocks) — eyeball any r.text === to confirm.
```

### Level 3: Enabling-change presence (grep the 4 prerequisites)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] pi-tui alias:"; grep -c '"@earendil-works/pi-tui": PIPKG' file-injector.test.mjs                # expect 1
echo "[2a] renderInjectedMessage typeof-assert:"; grep -c 'typeof mod.renderInjectedMessage === "function"' file-injector.test.mjs   # expect 1
echo "[2b] ASSERTED_EXPORTS entry:"; grep -c '"renderInjectedMessage"' file-injector.test.mjs            # expect 1
echo "[3] details:[] on State mocks:"; grep -c 'blocks: \[\], details: \[\],' file-injector.test.mjs      # expect 7
echo "[4] captureAllHandlers:"; grep -c 'function captureAllHandlers' file-injector.test.mjs              # expect 1
```

### Level 4: Scope integrity (no .ts change)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts    # expect EMPTY (the .ts is T2.S2's landed contract; tests migrate TO it)
git diff --stat                    # expect ONLY file-injector.test.mjs (+ the pre-existing T2.S2 .ts working-tree edit)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `0 failed`, exit 0; loads cleanly (no pi-tui load error).
- [ ] Zero-residue grep (Level 2): 0 stale `r.text` block-content/separator/paged/indexOf reads.
- [ ] Enabling-change grep (Level 3): all 5 checks pass (alias; typeof-assert; ASSERTED_EXPORTS; 7 details:[]; captureAllHandlers).
- [ ] `git diff --stat file-injector.ts` empty (no .ts change).

### Feature Validation (the migration correctness)

- [ ] Every `<file name="ABS">` content check reads `r.blocks.some(b => b.includes(...))` (incl. NEGATIVE asserts).
- [ ] Ordering checks use `r.blocks.findIndex(...)` (relative index = emission order).
- [ ] `<paged:` directive checks use `r.blocks.some(b => b.includes("<paged:"))`.
- [ ] Stripped-prompt equality asserts `r.text === "<stripped>"` (no blocks/---) + a companion `r.blocks` check where the old assert also covered the block.
- [ ] The 4 handler-level delivery asserts drive `input` + `before_agent_start` (same factory) and assert `msg.message.content` (customType `fileInjector.injected`).
- [ ] The separator assert (L397) is DELETED.
- [ ] All injection-LOGIC assertions (regex/cleanup/resolution/paging/imports/dedup/config/bare-@/code-region) still hold — only the container changed.

### Code Quality Validation

- [ ] Migrated asserts preserve the original INTENT (especially negative asserts — `!r.blocks.some(...)` not a trivially-true `!r.text.includes(...)`).
- [ ] `captureAllHandlers` is used for handler delivery (shares the `pending` closure); `captureHandler` still used for action/notify-only handler tests.
- [ ] `details: []` on all 7 State mocks (interface fidelity).
- [ ] No new fixtures, no case-count change, no runCase/assert/makeMockCtx signature change.

### Documentation

- [ ] None (test-only; no user-facing surface — item §5).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT skip the pi-tui alias.** The suite FAILS TO LOAD without it (T2.S2 landed the import; the alias was
  deferred to M2.T2 but M2.T1's gate requires the load). Add it FIRST — nothing verifies until the file loads.
- ❌ **Do NOT sync only ONE of {sanity typeof-assert, ASSERTED_EXPORTS entry} for renderInjectedMessage.** The guard
  needs BOTH (the typeof-assert proves it's a function; the Set entry satisfies the completeness filter). One without
  the other → either a stale assert or "ships functions not in the sanity list".
- ❌ **Do NOT leave NEGATIVE asserts on r.text.** `!r.text.includes('<file X')` now passes TRIVIALLY (stripped text
  has no blocks) → it stops guarding "X was NOT injected". Migrate to `!r.blocks.some(b => b.includes('<file X'))`.
- ❌ **Do NOT use two captureHandler calls for a handler delivery test.** `pending` is a CLOSURE var (per factory);
  input (factory A) + before_agent_start (factory B) do NOT share it → B's pending is null → no custom message. Use
  `captureAllHandlers()` (one factory for both).
- ❌ **Do NOT edit file-injector.ts.** The tests migrate TO the landed .ts contract; the .ts is not touched.
  `git diff --stat file-injector.ts` MUST be empty.
- ❌ **Do NOT delete whole cases.** Migrate ASSERTIONS within cases; delete only the 1 separator assert LINE (L397),
  not its case. The case count is unchanged.
- ❌ **Do NOT touch the pure-function tests** (cleanToken/scanTokens/resolveImportPath/readConfig/etc.) — they don't
  read r.text; they need no migration.
- ❌ **Do NOT touch relative-imports.test.mjs / import-behavior.test.mjs.** Those are P1.M2.T1.S2's scope (each has its
  own jiti alias map that will also need the pi-tui entry — but that's S2's edit, not S1's).
- ❌ **Do NOT lose coverage on stripped-prompt equality.** Where an old `r.text === "stripped\n\n---\n\n<file…>"` also
  implicitly verified the block, the new `r.text === "stripped"` must gain a companion `r.blocks.some(...)` so the
  delivery is still asserted.
- ❌ **Do NOT forget `details: []` on the 7 State mocks.** They pass at runtime without it (scanTokens ignores details),
  but item §3g is explicit and a future scanTokens change reading details would silently pass on an incomplete mock.

---

## Confidence Score: 8/10

A mechanical but BROAD migration (~155 assertion edits across 5 categories) plus 4 enabling harness changes, all
traced to the empirically-verified state (pi-tui LOAD BLOCKER quoted from `node`; the exact grep counts 95/35/7/13/1;
the 4 handler out.text sites L523/L2215/L2239/L2240; the 7 State-mock lines; the module-surface guard mechanics; the
`pending` closure scope requiring `captureAllHandlers`). The PRP gives exact grep-to-find + worked old→new examples
for every category (including the load-bearing NEGATIVE-assert + ordering + stripped-equality nuances). The -2 reserves
for: (a) the sheer breadth (~155 edits) — easy to MISS a site; the zero-residue grep (Level 2) catches stragglers but
the implementer must be thorough; (b) the handler-level §4.6 config sites (L2215/L2239) needing session_start(config)
+ input + before_agent_start from one captureAllHandlers — the cleanest pattern, but the most intricate of the 5f sites.
The single gate (`node ./file-injector.test.mjs` GREEN) is unambiguous. The implementer edits ONE file, iterates
category-by-category (run after each), and stops when green + zero-residue.
