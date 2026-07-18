---
name: "P1.M2.T1.S2 (plan/008) — Migrate relative-imports.test.mjs (~38 cases) + import-behavior.test.mjs (~22 cases) from out.text block-content reads to the new injectFiles return shape (out.blocks: string[]); handler-level reads migrate to before_agent_start capture"
prd_ref: "PRD §9 (Algorithm — injectFiles returns {text(stripped), images, injected, paged, blocks: string[], details}); §6.2/§6.4 (blocks leave the user message → a custom message from before_agent_start); §11 (relative-imports/import-behavior are the standalone regression gates pinning file-relative resolution + first-level bare-@); plan/008 architecture/test_migration.md (the migration patterns + handler-level note)"
target_files: "./relative-imports.test.mjs (EDIT IN PLACE) + ./import-behavior.test.mjs (EDIT IN PLACE)"
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gates = `node ./relative-imports.test.mjs` AND `node ./import-behavior.test.mjs` (the .ts is T2.S2's typecheck gate — UNCHANGED here)
depends_on: "P1.M1.T1.S2 (injectFiles return +blocks/+details — LANDED) + P1.M1.T2.S1 (input/before_agent_start split + pending closure — LANDED) + P1.M1.T2.S2 (pi-tui import + renderInjectedMessage + registerMessageRenderer in session_start — LANDED uncommitted). Both suites are currently RED: each FAILS TO LOAD (no pi-tui alias) AND reads the OLD out.text shape."
consumed_by: "P1.M2.T2.S1/S2 (delivery + renderer tests — reuse the single-factory captureAll pattern this task lands), P1.M2.T3.S1 (README Mode B). NOTE: runs in PARALLEL with P1.M2.T1.S1 (file-injector.test.mjs migration) — the two do not share files; this task edits ONLY relative-imports.test.mjs + import-behavior.test.mjs."
---

# PRP — P1.M2.T1.S2: Migrate relative-imports.test.mjs + import-behavior.test.mjs to the new injectFiles return shape (out.text block reads → out.blocks / before_agent_start capture)

> **Scope flag:** Test-only migration of TWO standalone regression suites. `injectFiles` now returns
> `{ text(stripped), images, injected, paged, blocks: string[], details: FileDetail[] }` — `text` is the
> STRIPPED prompt ONLY (no `\n\n---\n\n` separator, no appended blocks); the `<file>` blocks live in
> `out.blocks` (a `string[]`), and at the handler level they are published by `before_agent_start` as a
> custom message whose `content` is `blocks.join("\n\n")`. **The import LOGIC under test (file-relative
> resolution at every depth, first-level bare-@, trailing punctuation, exact-vs-shorthand, cycle dedup)
> is UNCHANGED — only the OUTPUT CONTAINER the tests read moves.** Each file also has a LOAD BLOCKER
> (no pi-tui jiti alias) and, once it loads, a second blocker (session_start now calls
> `pi.registerMessageRenderer`, which the mock `pi` lacks). No `.ts` change, no README, no logic change.

---

## Goal

**Feature Goal:** Make both standalone regression suites GREEN against the NEW `injectFiles` return shape
by (a) unblocking their load (pi-tui alias) and their session_start path (registerMessageRenderer no-op on
the mock `pi`), and (b) migrating every block-content read from `out.text` to `out.blocks` (for direct
`injectFiles` calls) or to the `before_agent_start` custom message `content` (for handler-level tests).
The migrated asserts verify the SAME relative-resolution / bare-@ / trailing-punct / exact-vs-shorthand /
dedup / cycle behavior — only the container changed.

**Deliverable:** Two modified test files (the ONLY files edited):
- **`./relative-imports.test.mjs`** (38 cases): +pi-tui alias; +`registerMessageRenderer` no-op on the
  mock `pi`; +`before_agent_start` capture in `captureHandlers`/`runViaHandler`; +a `blocksText(r)` adapter;
  23 `has(out.text, M)`→`has(blocksText(out), M)`; 4 `blocksRel(out.text, root)`→`blocksRel(blocksText(out), root)`;
  4 `countAbs(out.text, abs)`→`countAbs(blocksText(out), abs)`; 2 handler-level sites (D5, D7) read
  `msg.message.content`; Group A path-string `has(r ?? "", "ROOT")` UNCHANGED.
- **`./import-behavior.test.mjs`** (22 cases): +pi-tui alias; one-line `has` definition change
  (`out.text` → `out.blocks.join("\n\n")`); `capture(event)`→`captureAll()` (single factory +
  `registerMessageRenderer` no-op); `runHandler` returns `{ out, msg }`; 2 handler-level sites (5b, 5d)
  read `msg.message.content`.

**Success Definition:**
1. `node ./relative-imports.test.mjs` → `Result: 38 passed, 0 failed`, exit 0; loads cleanly (no pi-tui error).
2. `node ./import-behavior.test.mjs` → `Result: 22 passed, 0 failed`, exit 0; loads cleanly.
3. ZERO remaining `out.text` / `out.text` block-content reads in either file (the only `out.text` reads
   that may remain are stripped-prompt-only handler assertions like `out.action === "transform"` — never
   block content). Group A's path-string `has(r ?? "", "ROOT")` is the ONE legitimate surviving
   non-block `has(...)` and is explicitly out of scope.
4. The 4 handler-level sites (relative-imports D5/D7; import-behavior 5b/5d) drive `before_agent_start`
   from the SAME factory as `input` (shared `pending` closure) and assert `msg.message.content`.
5. No `.ts` change (`git diff --stat file-injector.ts` is empty relative to the T2.S2 working tree).

## User Persona

**Target User:** The developer/CI running the two standalone regression gates. The return-shape refactor
(P1.M1) deliberately moved blocks out of `out.text` (PRD §6.4: compact display); these suites — which pin
the two bug classes the PRD calls out (file-relative resolution + first-level bare-@) — must follow.

**Use Case:** `git pull && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs` → both green.

**Pain Points Addressed:** Both suites are currently RED (fail to load + stale `out.text` reads), so the
two regression properties they guard are currently UNCHECKED. This task restores them as runnable gates.

## Why

- **The return shape deliberately changed (PRD §6.4).** Blocks left the user-message text precisely so a
  registered renderer can draw them compactly. The old `out.text = stripped + "\n\n---\n\n" + blocks` is
  gone; `out.text` is stripped-only and `out.blocks` (a `string[]`) carries the blocks. The handler path
  publishes them via `before_agent_start`. The tests MUST follow.
- **These suites pin the two properties the PRD most fears regressing (§11).** `relative-imports.test.mjs`
  guards file-relative resolution at every depth (never `ctx.cwd`) and first-level bare-@; `import-behavior.test.mjs`
  guards bare-@ at every depth + trailing-punctuation/markdown-formatting token cleanup. Losing them
  (by leaving them red) means those regressions go uncaught.
- **Mechanical, low-risk, file-scoped.** Two files, deterministic old→new transformations per helper.
  The risk is MISSING a site or mishandling a handler-level path; the PRP gives exact grep counts +
  worked examples + the closure-scope trap.
- **Parallel-safe with P1.M2.T1.S1.** This task edits ONLY `relative-imports.test.mjs` + `import-behavior.test.mjs`;
  P1.M2.T1.S1 edits ONLY `file-injector.test.mjs`. No shared files, no merge conflict.

## What

No user-visible / API / logic change. The two suites' ASSERTIONS change container (`out.text` →
`out.blocks` / `before_agent_start` message); the cases, fixtures, helpers' signatures, and pass/fail
matrices are structurally unchanged. Each file gains: 1 alias line, a `registerMessageRenderer` no-op on
its mock `pi`, the before_agent_start capture, and the migrated reads.

### Success Criteria

- [ ] `node ./relative-imports.test.mjs` → `Result: 38 passed, 0 failed`, exit 0; loads cleanly.
- [ ] `node ./import-behavior.test.mjs` → `Result: 22 passed, 0 failed`, exit 0; loads cleanly.
- [ ] Both jiti alias maps contain `"@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js"`.
- [ ] Both mock `pi` objects define `registerMessageRenderer: () => {}` (session_start no-throw).
- [ ] relative-imports: `captureHandlers` captures `before_agent_start`; `runViaHandler` returns `{ out, msg }`.
- [ ] import-behavior: a single-factory `captureAll()` (replaces per-event `capture`); `runHandler` returns `{ out, msg }`.
- [ ] ZERO `out.text` block-content reads remain (grep `has(out\.text\|blocksRel(out\.text\|countAbs(out\.text` → 0 in both files; the only `has` survivor is Group A's path-string `has(r ?? "", …)`).
- [ ] The 4 handler-level sites read `msg.message.content` for block checks.
- [ ] `git diff --stat file-injector.ts` is empty (no `.ts` change).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact NEW return shape (+ the input/before_agent_start delivery model with the
`pending` CLOSURE var and why it demands a single factory), the empirically-confirmed LOAD BLOCKER (`node` output
quoted for BOTH files) and the second blocker (session_start's unconditional `registerMessageRenderer` call —
file-injector.ts:1170 quoted), the exact grep-verified call-site counts per file (relative-imports: 23/4/4/1;
import-behavior: 1-line helper + 2 handler sites), the chosen migration approach per file (adapter vs one-line
helper) with worked old→new examples, the closure-scope trap (why two `capture(event)` factories can't share
`pending`), and the two gates. The implementer edits TWO files, runs each suite after each change class, and
stops when both are green.

### Documentation & References

```yaml
# MUST READ — the migration strategy doc (patterns + handler-level note)
- file: plan/008_561ef016260d/architecture/test_migration.md
  why: "§'relative-imports.test.mjs + import-behavior.test.mjs (more resilient)' states: 'The has() helper
        can be trivially updated to search r.blocks.join(\"\\n\\n\") instead of r.text.' §'Handler-level
        testing' states: 'Under the NEW model, the input handler no longer has blocks in out.text — they
        are in the stash consumed by before_agent_start. Tests must capture BOTH handlers and exercise the
        full flow.'"
  critical: "This task operationalizes both statements. import-behavior's has() = the one-line helper change;
             relative-imports' has/blocksRel/countAbs = the adapter approach (they also check path strings in
             Group A, so they stay generic). Both files' handler sites = the before_agent_start capture."

# MUST READ — the new return shape + delivery model (the CONTRACT)
- file: plan/008_561ef016260d/P1M1T1S2/PRP.md   # (T1.S2 — Complete: injectFiles return +blocks/+details)
- file: plan/008_561ef016260d/P1M1T2S1/PRP.md   # (T2.S1 — Complete: input/before_agent_start split + pending closure)
- file: plan/008_561ef016260d/P1M1T2S2/PRP.md   # (T2.S2 — LANDED uncommitted: pi-tui import + renderInjectedMessage + registerMessageRenderer in session_start)
  why: "T1.S2 defined the return shape {text(stripped), images, injected, paged, blocks, details}. T2.S1
        defined the delivery: input returns {action:transform, text:stripped, images} + stashes {blocks,
        details} in the `pending` CLOSURE var; before_agent_start returns {message:{customType:
        'fileInjector.injected', content: blocks.join('\\n\\n'), display:true, details:{files}}} and clears
        pending. T2.S2 added the pi-tui import (file-injector.ts:4) AND the unconditional
        pi.registerMessageRenderer('fileInjector.injected', …) call inside session_start (file-injector.ts:1170)."
  critical: "pending is a CLOSURE var (file-injector.ts:1157), NOT module-level. input + before_agent_start
             MUST come from the SAME mod.default(pi) to share pending. import-behavior's current
             capture(event) creates a NEW factory per event → its runHandler CANNOT share pending across
             input+before_agent_start → MUST be reworked to a single-factory captureAll(). relative-imports'
             captureHandlers already uses one factory (just needs +before_agent_start capture). The T2.S2
             registerMessageRenderer call means BOTH mock pi objects MUST define it (no-op) or session_start throws."

# The sibling PRP (parallel) — read for the shared captureAllHandlers pattern, do NOT edit its file
- file: plan/008_561ef016260d/P1M2T1S1/PRP.md   # (parallel: file-injector.test.mjs migration)
  why: "S1's captureAllHandlers() helper (one mod.default(pi), captures EVERY event, mock pi = { on, … })
        is the SAME pattern import-behavior's captureAll() should mirror. S1 also documents the pi-tui alias
        + registerMessageRenderer gotchas. DO NOT edit file-injector.test.mjs (S1's scope)."

# The files you edit (the ONLY changes)
- file: relative-imports.test.mjs
  why: "508 lines, 38 cases. jiti alias map L44 (ADD pi-tui). captureHandlers L81-85 (ADD registerMessageRenderer
        no-op + before_agent_start:[]). run() L75 (ALREADY returns full result — no change). has/blocksRel/
        countAbs L76-80 (STAY string helpers; add a blocksText adapter nearby). runViaHandler L429-433 (drive
        before_agent_start; return {out,msg}). 23 has(out.text…) + 4 blocksRel(out.text…) + 4 countAbs(out.text…)
        scattered (grep-to-find). Group A has(r ?? \"\", …) L107 UNCHANGED. D5 L441-443 + D7 L469-470 → msg.message.content.
        D6 L452-463 checks ONLY notify → UNCHANGED."
  pattern: "Flat ESM script: test(name,fn)/assert. run(cwd,prompt,bareAt=false)→injectFiles result. Helpers
            has/blocksRel/countAbs take STRINGS. Group A tests call mod.resolveImportPath directly (returns a
            PATH string). Groups B-E call run() (injectFiles result) or runViaHandler() (input handler result)."
  gotcha: "has is used TWO ways: block content (has(out.text, M)) AND path string (Group A: has(r ?? \"\", \"ROOT\")).
           Keep has a generic string helper; route block reads through blocksText(out) so Group A is untouched."

- file: import-behavior.test.mjs
  why: "250 lines, 22 cases. jiti alias map L14 (ADD pi-tui). has L39 (ONE-LINE body change out.text→out.blocks.join).
        run L35-38 (ALREADY returns full result — stale comment only, optional fix). capture L45 (REPLACE with
        captureAll single-factory + registerMessageRenderer no-op). runHandler L46-50 (drive before_agent_start
        from SAME factory; return {out,msg}). 5b L212-213 + 5d L227-228 → msg.message.content. Groups 1-4 + 5a/5c/5e/5f
        use run() + has(o, M) → work UNCHANGED once has reads blocks."
  pattern: "Same harness as relative-imports. has(out, marker) takes the RESULT object (unlike relative-imports'
            string has). capture(event) is per-event (one factory each) — the trap for handler delivery."
  gotcha: "After replacing capture(event) with captureAll(), the old capture() becomes dead code — remove it
           (or leave; cleaner to remove). The stale comment on run() (`// { text, images, injected, paged }`)
           may be updated to note blocks/details but is cosmetic."

# The product code (UNCHANGED — read-only; the contract the tests migrate TO)
- file: file-injector.ts
  why: "injectFiles return L1030-1114 (text=stripped L1114; blocks/details L1076-1077/L1114; nothing-injected
        L1096). pending closure L1157; input stash L1186 + return {transform,text,images} L1191 + notify L1190;
        before_agent_start L1198-1209 (returns {message:{customType,content:blocks.join('\\n\\n'),display,details:{files}}};
        clears pending L1204; no-stash→undefined). session_start unconditional registerMessageRenderer L1170.
        Do NOT edit any of this."
  gotcha: "git diff --stat file-injector.ts MUST be empty. The tests migrate to MATCH the .ts; the .ts is not touched."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD + uncommitted T2.S2 edits (M file-injector.ts: pi-tui import + renderer + registerMessageRenderer)
├── file-injector.test.mjs       # NOT edited (P1.M2.T1.S1's parallel scope)
├── file-injector.ts             # UNCHANGED (T2.S2 working tree: return shape + delivery + renderer all landed)
├── relative-imports.test.mjs    # ← EDIT (38 cases; currently RED: fails to load + ~31 stale out.text reads + 2 handler sites)
├── import-behavior.test.mjs     # ← EDIT (22 cases; currently RED: fails to load + 1-line has body + capture rework + 2 handler sites)
├── scripts/typecheck.mjs        # untouched
├── package.json / PRD.md / README.md   # untouched
└── plan/008_561ef016260d/
    ├── architecture/test_migration.md        # the strategy doc
    ├── P1M1T1S1..P1M1T2S2/{PRP.md, research/}  # the return-shape + delivery + renderer predecessors (all LANDED)
    ├── P1M2T1S1/{research/, PRP.md}           # parallel sibling (file-injector.test.mjs)
    └── P1M2T1S2/{research/research_notes.md, PRP.md}  # (this file)
```

### Desired Codebase tree (files touched)

```bash
relative-imports.test.mjs    # MODIFIED:
                             #   (1) jiti alias map L44: +pi-tui entry (LOAD fix)
                             #   (2) captureHandlers mock pi L82: +registerMessageRenderer: () => {} (session_start no-throw)
                             #   (3) captureHandlers cbs L81: +before_agent_start: []; runViaHandler drives it + returns {out,msg}
                             #   (4) +const blocksText = (r) => (r?.blocks ?? []).join("\n\n");  adapter near the helpers
                             #   (5) 23 has(out.text,M)→has(blocksText(out),M); 4 blocksRel(out.text,root)→blocksRel(blocksText(out),root);
                             #       4 countAbs(out.text,abs)→countAbs(blocksText(out),abs)
                             #   (6) D5/D7: blocksRel(out.text,root)→blocksRel(msg.message.content,root) (read {out,msg} from runViaHandler)
                             #   (Group A1 has(r ?? "", "ROOT") UNCHANGED; D6 notify-only UNCHANGED)
import-behavior.test.mjs     # MODIFIED:
                             #   (1) jiti alias map L14: +pi-tui entry (LOAD fix)
                             #   (2) has L39 body: (out.text ?? "") → (out.blocks ?? []).join("\n\n")  (ONE line; fixes all 20 run()-based cases)
                             #   (3) capture L45 → captureAll() single-factory + registerMessageRenderer: () => {} ; runHandler drives
                             #       before_agent_start from the SAME factory, returns {out,msg}
                             #   (4) 5b/5d: has(o, M) → msg.message.content.includes(M) (read {out,msg} from runHandler)
                             #   (optional) run() L37 stale comment update
# file-injector.ts + file-injector.test.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — BOTH files FAIL TO LOAD until you add the pi-tui alias. T2.S2 (LANDED uncommitted) added
//   `import { Box, Text } from "@earendil-works/pi-tui"` (file-injector.ts:4). Each test file has its OWN
//   jiti alias map (relative-imports L44, import-behavior L14) and NEITHER has a pi-tui entry →
//   `node ./relative-imports.test.mjs` → `Cannot find module '@earendil-works/pi-tui'` (same for import-behavior).
//   ADD the alias line to BOTH (same nested-node_modules path). Nothing runs until this lands.

// CRITICAL — session_start now throws on the mock pi UNLESS you add registerMessageRenderer. T2.S2 added an
//   UNCONDITIONAL `pi.registerMessageRenderer("fileInjector.injected", …)` inside session_start
//   (file-injector.ts:1170). Both files' mock `pi` objects (`mod.default({ on: … })`) drive session_start
//   (relative-imports D5/D6/D7 + import-behavior 5b/5d) but define ONLY `{ on: … }` → once the file loads,
//   `pi.registerMessageRenderer is not a function`. ADD `registerMessageRenderer: () => {}` (no-op) to each
//   mock pi. (This is independent of the alias fix — both are required.)

// CRITICAL — pending is a CLOSURE var, NOT module-level (file-injector.ts:1157). input + before_agent_start
//   MUST come from the SAME mod.default(pi) factory to share the pending stash. import-behavior's current
//   `capture(event)` creates a NEW factory PER event (factory A=session_start, B=input) — so even adding a
//   `capture("before_agent_start")` (factory C) would read a NULL pending. Rework to ONE factory
//   (captureAll()). relative-imports' `captureHandlers` ALREADY uses one factory — just add before_agent_start
//   capture + drive it in runViaHandler. cfg IS module-level (persists across factories), so config-only flows
//   survive multi-factory capture; but delivery checks need one factory.

// GOTCHA — relative-imports' has() is used TWO ways: block content `has(out.text, M)` (Groups C/D1-D4/E) AND
//   path string `has(r ?? "", "ROOT")` (Group A1 — r is a resolved PATH from resolveImportPath). Do NOT change
//   has()'s signature to take a result object (it would break Group A). Keep has a generic STRING helper and
//   route block reads through a blocksText(r) adapter. Group A stays byte-for-byte unchanged.

// GOTCHA — import-behavior's has() ALREADY takes the result object `out` (signature `has(out, marker)`), so
//   changing its BODY (out.text → out.blocks.join) fixes ALL 20 run()-based cases in ONE line. The 2 handler
//   cases (5b/5d) pass the INPUT result `o` (no .blocks) → has(o, M) would read "" → they MUST migrate to
//   msg.message.content.

// GOTCHA — handler-level reads. The input handler returns {action, text:STRIPPED, images} — NO blocks. Under
//   the new model blocks live in the before_agent_start custom message (content = blocks.join("\n\n")). So any
//   test that drove the input handler and read block content from out.text MUST now ALSO drive before_agent_start
//   (same factory) and read msg.message.content. Sites: relative-imports D5/D7; import-behavior 5b/5d.
//   (relative-imports D6 checks ONLY the notify message — UNAFFECTED; the input handler still notifies.)

// GOTCHA — negative asserts still hold after migration. e.g. relative-imports C1 `!has(out.text, "B-CWD-ROOT")`
//   → `!has(blocksText(out), "B-CWD-ROOT")` still correctly proves the cwd-root copy was NOT injected (because
//   blocksText(out) contains only the file-relative block). import-behavior 5f `!has(o, "B-MARKER")` → reads
//   out.blocks → still correctly proves bare-@ is inert when the setting is off.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti (alias map). No test runner. test(name,fn)/assert. The gates
//   are `node ./relative-imports.test.mjs` and `node ./import-behavior.test.mjs`. npm run typecheck is the .ts
//   gate (UNAFFECTED — test-only). npm test (file-injector.test.mjs) is P1.M2.T1.S1's scope, NOT this task.
```

## Implementation Blueprint

### Approach summary (per file)

**relative-imports.test.mjs** — keep `has`/`blocksRel`/`countAbs` as generic STRING helpers (Group A needs
a string `has`); add a `blocksText(r)` adapter; change the 31 block-content call sites to pass
`blocksText(out)`; capture + drive `before_agent_start` for the 2 handler sites (D5/D7).

**import-behavior.test.mjs** — `has(out, marker)` already takes the result object; change its BODY one line
(`out.text` → `out.blocks.join("\n\n")`) and all 20 `run()`-based cases pass; rework `capture`/`runHandler`
to a single-factory `captureAll()` returning `{ out, msg }`; migrate the 2 handler sites (5b/5d) to
`msg.message.content`.

### Implementation Tasks (ordered by dependencies — do BOTH files' enabling changes first, then migrations)

```yaml
# ════════════════════════════════════════════════════════════════════════════
# FILE 1: relative-imports.test.mjs
# ════════════════════════════════════════════════════════════════════════════
Task R1 (ENABLING — LOAD): ADD the pi-tui jiti alias (L44)
  - oldText:
      alias: {
        "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
        "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
      },
  - newText: ADD the pi-tui line (same nested-node_modules path).
      alias: {
        "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
        "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
        "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
      },
  - VERIFY: `node ./relative-imports.test.mjs 2>&1 | head -3` no longer prints the pi-tui error; the suite RUNS
    (and fails on the stale out.text reads + the registerMessageRenderer throw).
  - WHY FIRST: nothing verifies until the file loads.

Task R2 (ENABLING — session_start no-throw + before_agent_start capture): Rework captureHandlers + runViaHandler
  - captureHandlers (L81-85): add `before_agent_start: []` to cbs AND `registerMessageRenderer: () => {}` to the mock pi:
      function captureHandlers() {
        const cbs = { input: [], session_start: [], before_agent_start: [] };
        mod.default({ on: (ev, cb) => { cbs[ev]?.push(cb); }, registerMessageRenderer: () => {} });
        return cbs;
      }
  - runViaHandler (L429-433): drive before_agent_start from the SAME factory; return { out, msg }:
      async function runViaHandler(root, prompt) {
        const cbs = captureHandlers();
        for (const cb of cbs.session_start) await cb({}, { cwd: root, isProjectTrusted: () => true });
        const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(root));
        const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(root)) : undefined;
        return { out, msg };
      }
  - WHY: session_start calls pi.registerMessageRenderer (T2.S2) → mock needs the no-op or it throws. before_agent_start
    is the new home of block content for handler tests. ONE factory (captureHandlers already does this) shares `pending`.

Task R3 (ENABLING — adapter): ADD blocksText near the helpers (after countAbs, ~L80)
  - const blocksText = (r) => (r?.blocks ?? []).join("\n\n");
  - WHY: the joined-blocks string for all block-content reads. Keeps has/blocksRel/countAbs generic (Group A's path-string
    has(r ?? "", "ROOT") stays valid).

Task R4 (MIGRATION — block-content reads): change the 31 call sites to pass blocksText(out)
  - 23×: `has(out.text, M)` → `has(blocksText(out), M)`   (Groups C1-C12, D1-D4, E1-E3)
  - 4×:  `blocksRel(out.text, root)` → `blocksRel(blocksText(out), root)`   (L354 C10-msg, L391 D1, L443 D5, L470 D7)
         NOTE L443/L470 are inside D5/D7 handler sites — they are re-pointed in Task R5 (content source changes), so in
         this task change ONLY L354 + L391 here; leave L443/L470 for R5 (they read `out` from runViaHandler which now
         returns {out,msg}). To avoid double-touching, do R4 for the 2 injectFiles-direct blocksRel sites (L354, L391)
         and all 23 has + 4 countAbs sites; do L443/L470 in R5.
  - 4×:  `countAbs(out.text, abs)` → `countAbs(blocksText(out), abs)`   (L263 C1, L353 C10, L362/L363 C11)
  - LEAVE `has(r ?? "", "ROOT")` (Group A1, L107) UNCHANGED — it checks a resolved PATH string, not block content.
  - VERIFY: `grep -nE "out\.text" relative-imports.test.mjs` → survivors should be ONLY D5/D7's `blocksRel(out.text…)`
    (fixed in R5) — no other out.text block reads.

Task R5 (MIGRATION — handler sites D5, D7): read {out,msg}; blocks on msg.message.content
  - D5 (L441-443):
      OLD: const out = await runViaHandler(root, "Check out #@main2.md");
           assert(out.action === "transform", …);
           const got = blocksRel(out.text, root).sort();
      NEW: const { out, msg } = await runViaHandler(root, "Check out #@main2.md");
           assert(out.action === "transform", …);
           const got = blocksRel(msg.message.content, root).sort();
  - D7 (L469-470):
      OLD: const out = await runViaHandler(root, "Check out #@main2.md");
           const got = blocksRel(out.text, root);
      NEW: const { out, msg } = await runViaHandler(root, "Check out #@main2.md");
           const got = blocksRel(msg.message.content, root);
  - WHY: msg.message.content IS blocks.join("\n\n") (the custom message's content); blocksRel is string-operating, so it
    works directly. D6 (notify-only) is UNCHANGED — do not touch it.
  - VERIFY relative-imports GREEN: `node ./relative-imports.test.mjs` → `Result: 38 passed, 0 failed`.

# ════════════════════════════════════════════════════════════════════════════
# FILE 2: import-behavior.test.mjs
# ════════════════════════════════════════════════════════════════════════════
Task I1 (ENABLING — LOAD): ADD the pi-tui jiti alias (L14)
  - oldText (same 2-line alias body as relative-imports) → newText (ADD the pi-tui line). Identical to Task R1.

Task I2 (MIGRATION — the one-line has fix): change has body (L39)
  - OLD: const has = (out, marker) => (out.text ?? "").includes(marker);
  - NEW: const has = (out, marker) => (out.blocks ?? []).join("\n\n").includes(marker);
  - WHY: has already takes the result object; switching the field fixes ALL 20 run()-based cases (Groups 1-4, 5a, 5c,
    5e, 5f) — they pass `o`/`out` = injectFiles result which now carries `.blocks`. Negative asserts (4e `!has(o,"MD-MARKER")`,
    5f `!has(o,"B-MARKER") && !has(o,"C-MARKER")`) remain correct: blocks is empty/missing the marker → false → !false = true.

Task I3 (ENABLING + MIGRATION — handler rework): capture→captureAll; runHandler returns {out,msg}; mock +registerMessageRenderer
  - REPLACE capture (L45) with captureAll (single factory; captures every event; mock pi has registerMessageRenderer no-op):
      function captureAll() {
        const cbs = {};
        mod.default({ on: (ev, cb) => { (cbs[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} });
        return cbs;
      }
  - REPLACE runHandler (L46-50) to use ONE factory + drive before_agent_start; return { out, msg }:
      async function runHandler(cwd, prompt) {
        const cbs = captureAll();
        for (const cb of (cbs.session_start ?? [])) await cb({}, { cwd, isProjectTrusted: () => true });
        const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(cwd));
        const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(cwd)) : undefined;
        return { out, msg };
      }
  - WHY: the OLD capture(event) created a factory PER event → pending (closure var) was NOT shared → before_agent_start
    could never see input's stash. captureAll = ONE factory → shared pending → delivery works. registerMessageRenderer
    no-op stops session_start throwing (T2.S2). (Old capture(event) is now dead code — removed by this replace.)

Task I4 (MIGRATION — handler sites 5b, 5d): read {out,msg}; block check on msg.message.content
  - 5b (L212-213):
      OLD: const o = await runHandler(r, "#@spec/PRD.md");
           assert(o.action === "transform" && has(o, "ARCH-MARKER"), …);
      NEW: const { out, msg } = await runHandler(r, "#@spec/PRD.md");
           assert(out.action === "transform" && msg.message.content.includes("ARCH-MARKER"), …);
  - 5d (L227-228):
      OLD: const o = await runHandler(r, "#@a.md");
           assert(o.action === "transform" && has(o, "B-MARKER"), …);
      NEW: const { out, msg } = await runHandler(r, "#@a.md");
           assert(out.action === "transform" && msg.message.content.includes("B-MARKER"), …);
  - WHY: the input result `o`/`out` has NO .blocks (stripped text only); blocks are in msg.message.content.
  - VERIFY import-behavior GREEN: `node ./import-behavior.test.mjs` → `Result: 22 passed, 0 failed`.

Task I5 (OPTIONAL cosmetic): update run()'s stale comment (L37)
  - `// { text, images, injected, paged }` → `// { text(stripped), images, injected, paged, blocks, details }`
    (functionally returns the full result already; comment-only.)

# ════════════════════════════════════════════════════════════════════════════
# FINAL
# ════════════════════════════════════════════════════════════════════════════
Task Z (VERIFY GREEN + scope): final gates
  - node ./relative-imports.test.mjs → `Result: 38 passed, 0 failed.`
  - node ./import-behavior.test.mjs  → `Result: 22 passed, 0 failed.`
  - GREP zero-residue (see Validation Loop Level 2).
  - git diff --stat file-injector.ts → EMPTY. git diff --stat → ONLY the 2 test files (+ pre-existing T2.S2 .ts).
```

### Implementation Patterns & Key Details

```js
// ── relative-imports.test.mjs: the blocksText adapter + a worked block-content migration ──
const blocksText = (r) => (r?.blocks ?? []).join("\n\n");   // add near has/blocksRel/countAbs

// C1 (OLD): assert(has(out.text, "B-FILE-RELATIVE"), …);
// C1 (NEW): assert(has(blocksText(out), "B-FILE-RELATIVE"), …);
// C1 neg (OLD): assert(!has(out.text, "B-CWD-ROOT"), …);
// C1 neg (NEW): assert(!has(blocksText(out), "B-CWD-ROOT"), …);   // still proves cwd-root copy NOT injected

// Group A1 STAYS: assert(!has(r ?? "", "ROOT"), "must not resolve to the cwd-root copy");  // r = resolved PATH string

// ── relative-imports.test.mjs: the handler rework (D5) ──
const { out, msg } = await runViaHandler(root, "Check out #@main2.md");
assert(out.action === "transform", `handler must transform; got ${out.action}`);
const got = blocksRel(msg.message.content, root).sort();   // content == blocks.join("\n\n"); blocksRel is string-op

// ── import-behavior.test.mjs: the one-line has fix ──
const has = (out, marker) => (out.blocks ?? []).join("\n\n").includes(marker);   // ALL 20 run()-based cases fixed

// ── import-behavior.test.mjs: the single-factory capture + handler (5b) ──
function captureAll() { const cbs = {}; mod.default({ on: (ev, cb) => { (cbs[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} }); return cbs; }
async function runHandler(cwd, prompt) {
  const cbs = captureAll();   // ONE factory → input + before_agent_start SHARE the pending closure
  for (const cb of (cbs.session_start ?? [])) await cb({}, { cwd, isProjectTrusted: () => true });
  const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(cwd));
  const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(cwd)) : undefined;
  return { out, msg };
}
// 5b: const { out, msg } = await runHandler(r, "#@spec/PRD.md");
//     assert(out.action === "transform" && msg.message.content.includes("ARCH-MARKER"), …);
```

### Integration Points

```yaml
FILE_EDITS (the ONLY two files):
  relative-imports.test.mjs:
    - jiti alias map (L44): +pi-tui entry.
    - captureHandlers (L81-85): +before_agent_start:[] in cbs; +registerMessageRenderer:()=>{} on mock pi.
    - runViaHandler (L429-433): drive before_agent_start; return {out,msg}.
    - +blocksText adapter (~L80).
    - 23 has(out.text,M) + 4 countAbs(out.text,abs) + 2 blocksRel(out.text,root) [L354,L391] → blocksText(out).
    - D5 (L441-443), D7 (L469-470): blocksRel(msg.message.content, root).
    - UNCHANGED: run() (already full result); has/blocksRel/countAbs signatures (stay string helpers); Group A
      (resolveImportPath path-string checks, incl. has(r ?? "", "ROOT")); Group B (scanTokens record checks);
      D6 (notify-only); all fixtures; the case structure/IDs/Summary.
  import-behavior.test.mjs:
    - jiti alias map (L14): +pi-tui entry.
    - has (L39): body out.text → out.blocks.join("\n\n") (ONE line).
    - capture (L45) → captureAll() (single factory + registerMessageRenderer no-op); runHandler (L46-50) returns {out,msg}.
    - 5b (L212-213), 5d (L227-228): msg.message.content.includes(M).
    - (optional) run() L37 stale comment.
    - UNCHANGED: run(); Groups 1-4 + 5a/5c/5e/5f assertions (fixed by the has body change); all fixtures; case structure.
NO_CHANGES: file-injector.ts (git diff empty), file-injector.test.mjs (P1.M2.T1.S1's parallel scope),
            scripts/typecheck.mjs, package.json, PRD.md, README.md (P1.M2.T3.S1), all plan/ files.
NO_LOGIC_CHANGE: the injection engine (regex/cleanup/resolution/paging/imports/dedup/config/bare-@/code-region)
                 is UNCHANGED — only the OUTPUT CONTAINER the tests read changed.
```

## Validation Loop

### Level 1: The gates — both suites GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs
# Before: FAILS TO LOAD (`Cannot find module '@earendil-works/pi-tui'`) + ~31 stale out.text reads + 2 handler sites.
# After:  Result: 38 passed, 0 failed.   Exit code 0.
node ./import-behavior.test.mjs
# Before: FAILS TO LOAD + 1-line has body stale + capture multi-factory + 2 handler sites.
# After:  Result: 22 passed, 0 failed.   Exit code 0.
# If it fails to load → Task R1/I1 (pi-tui alias). If a handler test throws "registerMessageRenderer is not a
# function" → Task R2/I3 (mock pi no-op). If a handler block assert fails (got "" / undefined) → Task R5/I4
# (msg.message.content, single factory). If an injectFiles-direct block assert fails → Task R4/I2 (blocksText / has body).
```

### Level 2: Zero-residue grep (no stale out.text block reads remain)

```bash
cd /home/dustin/projects/pi-file-injector
# These MUST return 0 in BOTH files (block content migrated to blocks / msg.message.content):
echo "[relative-imports] has(out.text:"; grep -c "has(out\.text" relative-imports.test.mjs          # expect 0
echo "[relative-imports] blocksRel(out.text:"; grep -c "blocksRel(out\.text" relative-imports.test.mjs  # expect 0
echo "[relative-imports] countAbs(out.text:"; grep -c "countAbs(out\.text" relative-imports.test.mjs    # expect 0
echo "[import-behavior] has body reads out.text:"; grep -c "out\.text" import-behavior.test.mjs        # expect 0
# The ONLY legitimate has(...) survivor in relative-imports is Group A's path string:
echo "[relative-imports] path-string has(r ?? \"\": "; grep -c 'has(r ?? ""' relative-imports.test.mjs  # expect 1 (Group A1 — UNCHANGED)
```

### Level 3: Enabling-change presence (grep the prerequisites)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[R1] pi-tui alias (relative-imports):"; grep -c '"@earendil-works/pi-tui": PIPKG' relative-imports.test.mjs   # expect 1
echo "[I1] pi-tui alias (import-behavior):";  grep -c '"@earendil-works/pi-tui": PIPKG' import-behavior.test.mjs    # expect 1
echo "[R2/I3] registerMessageRenderer no-op:"; grep -c 'registerMessageRenderer: () => {}' relative-imports.test.mjs import-behavior.test.mjs  # expect 1 each
echo "[R2] captureHandlers before_agent_start:"; grep -c 'before_agent_start: \[\]' relative-imports.test.mjs       # expect 1
echo "[R3] blocksText adapter:"; grep -c 'const blocksText' relative-imports.test.mjs                              # expect 1
echo "[I2] has reads blocks:"; grep -c 'out.blocks ?? \[\]\)\.join' import-behavior.test.mjs                       # expect 1
echo "[I3] captureAll single-factory:"; grep -c 'function captureAll' import-behavior.test.mjs                     # expect 1
echo "[R5/I4] msg.message.content reads:"; grep -c 'msg.message.content' relative-imports.test.mjs import-behavior.test.mjs  # expect 2 + 2
```

### Level 4: Scope integrity (no .ts change; no collision with the parallel sibling)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts            # expect EMPTY (the .ts is T2.S2's landed contract)
git diff --stat file-injector.test.mjs      # expect EMPTY (P1.M2.T1.S1's parallel scope — do NOT touch)
git diff --stat                             # expect ONLY relative-imports.test.mjs + import-behavior.test.mjs (+ pre-existing T2.S2 .ts)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./relative-imports.test.mjs` → `38 passed, 0 failed`, exit 0; loads cleanly.
- [ ] `node ./import-behavior.test.mjs` → `22 passed, 0 failed`, exit 0; loads cleanly.
- [ ] Zero-residue grep (Level 2): 0 stale `out.text` block reads in either file.
- [ ] Enabling-change grep (Level 3): all checks pass (pi-tui alias ×2; registerMessageRenderer ×2; before_agent_start capture; blocksText; has-blocks body; captureAll).
- [ ] `git diff --stat file-injector.ts` empty; `git diff --stat file-injector.test.mjs` empty (no collision with P1.M2.T1.S1).

### Feature Validation (migration correctness)

- [ ] relative-imports: every block-content check reads `blocksText(out)` (23 has + 4 countAbs + 2 blocksRel) or `msg.message.content` (D5/D7); Group A path-string `has(r ?? "", "ROOT")` UNCHANGED.
- [ ] relative-imports: `captureHandlers` captures `before_agent_start`; `runViaHandler` returns `{ out, msg }` from ONE factory (shared `pending`).
- [ ] import-behavior: `has` body reads `out.blocks.join("\n\n")`; all 20 `run()`-based cases pass via that one-line change.
- [ ] import-behavior: `captureAll()` is single-factory (+ `registerMessageRenderer` no-op); `runHandler` drives `before_agent_start` and returns `{ out, msg }`; 5b/5d read `msg.message.content`.
- [ ] All injection-LOGIC assertions (file-relative resolution at every depth, first-level bare-@, trailing punct, exact-vs-shorthand, dedup, cycles, code-exempt, bare-@-off inert) still hold — only the container changed.
- [ ] Negative asserts still guard intent (e.g. `!has(blocksText(out), "B-CWD-ROOT")` still proves cwd-root NOT injected; `!has(o, "B-MARKER")` still proves bare-@ inert when off).

### Code Quality Validation

- [ ] Helpers' INTENT preserved: relative-imports' `has`/`blocksRel`/`countAbs` stay generic string helpers (Group A path use valid); import-behavior's `has` stays result-object-taking (one-line body change).
- [ ] Handler delivery tests use ONE factory (shared `pending` closure); never two per-event factories.
- [ ] `registerMessageRenderer: () => {}` no-op on every mock `pi` that drives `session_start`.
- [ ] No new fixtures, no case-count change, no test()/assert() signature change, no logic change.

### Documentation

- [ ] None (test-only; no user-facing surface — item §5). (Optional: import-behavior run() stale comment update.)

---

## Anti-Patterns to Avoid

- ❌ **Do NOT skip the pi-tui alias in EITHER file.** Both FAIL TO LOAD without it (each has its own jiti alias map;
  neither has a pi-tui entry). Add it FIRST — nothing verifies until the file loads. Empirically confirmed:
  `node ./relative-imports.test.mjs` AND `node ./import-behavior.test.mjs` both print `Cannot find module '@earendil-works/pi-tui'`.
- ❌ **Do NOT forget `registerMessageRenderer: () => {}` on the mock pi.** T2.S2 made session_start UNCONDITIONALLY
  call `pi.registerMessageRenderer` (file-injector.ts:1170). Both files' mocks define only `{ on: … }` → session_start
  throws once the file loads. This is INDEPENDENT of the alias fix — both are required. (D5/D6/D7 + 5b/5d all drive session_start.)
- ❌ **Do NOT use two factories for a handler delivery test.** `pending` is a CLOSURE var (file-injector.ts:1157),
  per `mod.default(pi)`. import-behavior's OLD `capture(event)` creates a factory PER event → before_agent_start from a
  different factory than input reads a NULL pending. Rework to `captureAll()` (ONE factory). relative-imports' `captureHandlers`
  already uses one factory — just add before_agent_start capture + drive it.
- ❌ **Do NOT change relative-imports' `has` signature to take a result object.** Group A uses `has(r ?? "", "ROOT")` where
  `r` is a resolved PATH STRING (from `resolveImportPath`). Keep `has` a generic string helper; route block reads through
  `blocksText(out)`. (import-behavior's `has` ALREADY takes a result object — there the one-line body change is correct.)
- ❌ **Do NOT leave handler-level reads on `out.text`.** The input handler returns stripped text only (no blocks). Under
  the new model blocks are in the `before_agent_start` custom message `content`. Sites: relative-imports D5/D7;
  import-behavior 5b/5d. Read `msg.message.content`.
- ❌ **Do NOT edit file-injector.ts OR file-injector.test.mjs.** The .ts is T2.S2's landed contract (tests migrate TO it);
  file-injector.test.mjs is P1.M2.T1.S1's PARALLEL scope. `git diff --stat` for both must be empty.
- ❌ **Do NOT delete or merge cases.** Migrate ASSERTIONS within cases; the case counts (38 / 22) are unchanged.
- ❌ **Do NOT touch Group A (resolveImportPath) or Group B (scanTokens) assertions in relative-imports.** They don't read
  `out.text` for block content — Group A checks resolved PATH strings, Group B checks `recs` arrays. They need no migration.
- ❌ **Do NOT touch relative-imports D6.** It checks ONLY the notify message (`notified === "#@ injected 4 whole"`), which
  the input handler still emits — unaffected by the return-shape change. (It does need the registerMessageRenderer no-op
  on the mock pi so its session_start doesn't throw — that's part of the captureHandlers rework, not a D6 assertion change.)
- ❌ **Do NOT lose negative-assert coverage.** `!has(out.text, X)` → `!has(blocksText(out), X)` (relative-imports) and
  `!has(o, X)` → reads `out.blocks` (import-behavior) STILL correctly prove X was not injected, because the joined blocks
  contain only what was delivered. Keep them as negative asserts, don't drop them.

---

## Confidence Score: 9/10

Two small, well-bounded test files with deterministic old→new transformations, all traced to empirically-verified
state (pi-tui LOAD BLOCKER quoted from `node` for BOTH files; the session_start `registerMessageRenderer` blocker quoted
from file-injector.ts:1170; exact grep-verified counts: relative-imports 23 has / 4 blocksRel / 4 countAbs / 1 path-string /
2 handler sites; import-behavior 1-line has body / capture rework / 2 handler sites; the `pending` closure-scope trap
requiring single-factory capture). The PRP gives the exact old→new for every change class (incl. the load-bearing
nuances: Group A path-string `has` must stay a string helper; negative asserts still hold; D6 notify-only untouched;
import-behavior's has already takes the result object so it's a one-line body change). The two gates are unambiguous
(`node ./relative-imports.test.mjs` = 38/0; `node ./import-behavior.test.mjs` = 22/0). The -1 reserves for: the closure-scope
handler rework in import-behavior (replacing `capture(event)` with `captureAll()`) is the most intricate change and the
one place a subtle wiring mistake (e.g. driving before_agent_start from a second factory) would silently produce a null
message; the PRP's single-factory pattern + the Level 3 grep for `function captureAll` and `msg.message.content` catch it.
The implementer edits TWO files, runs each suite after its enabling changes then after its migrations, and stops when both
are green + zero-residue.
