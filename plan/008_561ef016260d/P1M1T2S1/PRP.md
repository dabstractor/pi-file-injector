---
name: "P1.M1.T2.S1 (plan/008) — input/before_agent_start split with one-shot pending stash"
prd_ref: "PRD §3.4 (two-mechanism model), §6.2 (custom-message delivery from before_agent_start), §6.4 (two returns: input stash+transform; before_agent_start consume), §12.20 (two-hook stash, one-shot per prompt)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — factory region only: add pending closure var, rewire input destructure+stash, add before_agent_start handler
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + structural grep; the test suite is INTENTIONALLY red from T1.S2 — migration is M2.T1)
depends_on: "P1.M1.T1.S2 (FULLY LANDED: injectFiles returns {text, images, injected, paged, blocks, details} with text=stripped-prompt-only; the --- concat is gone). T2.S1 consumes blocks+details from that return."
consumed_by: "P1.M1.T2.S2 (registers the MessageRenderer for 'fileInjector.injected' + implements renderInjectedMessage — fulfills the display:true contract T2.S1 sets); P1.M2.T1.S1 (migrates ~230 test assertions from r.text to r.blocks/r.details)"
---

# PRP — P1.M1.T2.S1: input/before_agent_start split with one-shot pending stash

> **Scope flag:** This is the **delivery seam** between "collect files" (M1.T1, done) and "render them
> compactly" (T2.S2, next). It edits **`file-injector.ts` FACTORY REGION ONLY** (3 changes): (A) add a `pending`
> closure variable; (B) rewire the `input` handler to destructure `blocks, details` and stash them; (C) add a
> `before_agent_start` handler that consumes the stash → returns the custom message (or `undefined`). **No
> renderer** (T2.S2); **no test migration** (M2.T1). The custom message ships with `display: true` but no
> registered renderer yet — Pi renders its default `[fileInjector.injected]` box as an acceptable interim
> (delivery to the model works regardless; display is T2.S2's job).

---

## Goal

**Feature Goal:** Implement PRD §3.4's two-mechanism delivery model: the `input` handler does all file I/O and
**stashes** `{ blocks, details }` on a closure variable; a new `before_agent_start` handler **consumes** that
stash and returns a single custom message (`customType: "fileInjector.injected"`, `content: blocks.join("\n\n")`,
`display: true`, `details: { files }`) that Pi appends after the user message, persists, and routes to the LLM.
The stash is the one-shot handoff between the two hooks (PRD §6.2/§12.20).

**Deliverable:** Modified `./file-injector.ts` factory region (L1053-1075): (A) `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` as a closure var inside the factory; (B) the `input` handler destructures `blocks, details` from `injectFiles` and sets `pending = { blocks, details }` (the existing `return { action: "transform", text, images }` with `text` = stripped prompt is UNCHANGED — T1.S2 already removed the block append); (C) a new `pi.on("before_agent_start", …)` handler registered after `input` and before the autocomplete `session_start`, which reads+closes `pending` and returns the custom message or `undefined`.

**Success Definition:**
1. `npm run typecheck` → 0 errors under `--strict` (the `before_agent_start` handler return type matches `BeforeAgentStartEventResult`).
2. Structural grep confirms all 3 edits (pending closure var; input destructure + stash; before_agent_start handler with the exact custom-message shape + the one-shot `pending = null`).
3. The `input` handler returns `{ action: "transform", text, images }` with `text` = stripped prompt (UNCHANGED from T1.S2 — blocks are NOT in the prompt text).
4. The `before_agent_start` handler returns `undefined` when `pending` is null (no `#@`, or short-circuited) — a no-op.
5. `cfg` STAYS module-level (L1051); `pending` is a closure var (item §3a). The renderer (T2.S2) and test migration (M2.T1) are NOT in scope.

## User Persona

**Target User:** Pi end-user who writes `#@file` and expects (a) the model to receive the full file contents and (b) the chat to eventually show compact green `read <path>` lines. T2.S1 delivers (a) via the custom message; (b) lands in T2.S2.

**Use Case:** User submits `Review #@a.ts`. The `input` handler strips `#@`, reads `a.ts`, builds the `<file>` block + FileDetail, and stashes them. The `before_agent_start` handler publishes the stash as a custom message after the user message. The model receives `[user: Review a.ts]` then `[user: <file name="/abs/a.ts">…</file>]` (the custom message mapped to user-role). Eventually (T2.S2) the TUI renders the custom message as a green `read a.ts` line.

**Pain Points Addressed:** Before this seam (post-T1.S2), the input handler collects blocks but the factory ignores them — files are NOT delivered to the model (the intermediate red-suite state). T2.S1 restores delivery via the custom message, splitting it across two hooks because the `input` event can only rewrite prompt text (not append separate messages) and `before_agent_start` is the only hook whose returned `message` lands after the user message, persists, and reaches the LLM (PRD §3.4 "Why two hooks, not one").

## Why

- **Closes the delivery seam.** T1.S1/T1.S2 collected `blocks` + `details`; T2.S1 is the structural handoff that actually delivers them to the model. Without T2.S1, the post-T1.S2 source collects files but the factory drops them (the intentionally-red intermediate). T2.S1 wires the two-hook pipeline that PRD §3.4/§6.2 specify.
- **The two-hook split is forced by Pi's API.** `input` is the only place to rewrite the prompt text (strip `#@`); `before_agent_start` is the only hook whose returned `message` Pi appends after the user message, persists, and routes to the LLM via `convertToLlm` (role:"custom" → user). No single hook can do both. The stash bridges them (PRD §3.4, §6.2, §12.20).
- **One-shot, race-free.** `prompt()` runs `input` → … → `before_agent_start` → `runAgentPrompt` sequentially in one awaited call, so the stash is populated before it's read. Clearing `pending` unconditionally inside the consume path guarantees one delivery per prompt (a later no-#@ prompt never re-delivers a stale stash — PRD §12.20).
- **Foundation for compact display.** The custom message's `customType: "fileInjector.injected"` + `display: true` + `details: { files }` is the contract T2.S2's `MessageRenderer` fulfills (green `read <path>` lines). T2.S1 produces the message; T2.S2 renders it. Decoupling lets each land+test independently.

## What

No user-visible behavior change yet at the TUI (the green read-lines renderer is T2.S2). The model-facing behavior changes from "no delivery" (the post-T1.S2 intermediate) to "files delivered as a custom message after the prompt." Externally, the module gains one new event handler (`before_agent_start`); no new exports, no new imports.

### Success Criteria

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] A `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` closure variable exists inside the factory (after `export default function (pi: ExtensionAPI) {`).
- [ ] The `input` handler destructures `{ text, images, injected, paged, blocks, details }` from `injectFiles` (was `{ text, images, injected, paged }`).
- [ ] The `input` handler sets `pending = { blocks, details };` AFTER the `if (!injected) return { action: "continue" };` guard and BEFORE the notify.
- [ ] The `input` handler's `return { action: "transform" as const, text, images };` is UNCHANGED (text = stripped prompt; blocks NOT appended — T1.S2 already did this).
- [ ] A `pi.on("before_agent_start", async (_e, _ctx) => { … })` handler exists, registered AFTER `pi.on("input", …)` and BEFORE the autocomplete `pi.on("session_start", …)`.
- [ ] The `before_agent_start` handler: returns `undefined` if `!pending`; otherwise reads `{ blocks, details }`, sets `pending = null` (one-shot clear), and returns `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.
- [ ] `cfg` STAYS module-level (L1051, with its JSDoc); `pending` is a closure var. The item §3a constraint holds.
- [ ] NO renderer registration, NO `renderInjectedMessage` function (T2.S2's scope). NO test edits (M2.T1's scope).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the verified POST-T1.S2 factory state (exact lines for cfg, the
input handler, the destructure, the return), the 3 exact edits (A/B/C with oldText→newText), the
verified `before_agent_start` API contract (external_deps §1: `BeforeAgentStartEventResult.message?` shape,
`undefined` = no-op), the one-shot clear invariant (§12.20), the cfg-module-level-vs-pending-closure rationale
(item §3a + the L1045-1050 JSDoc), the "display:true but no renderer yet" interim explanation, and the
deterministic gate (typecheck + structural grep; the red suite is the expected T1.S2 handoff, NOT T2.S1's
concern). The implementer edits one file's factory region, runs typecheck, confirms structure, and STOPS.

### Documentation & References

```yaml
# MUST READ — the verified before_agent_start API contract (the return type this subtask must match)
- file: plan/008_561ef016260d/architecture/external_deps.md
  why: "§1 'before_agent_start event + BeforeAgentStartEventResult.message' VERIFIES: on(event:'before_agent_start',
        handler) exists; BeforeAgentStartEventResult.message? = Pick<CustomMessage,'customType'|'content'|'display'|
        'details'>; message.content is string|(Text|Image)[] (we use string); message.details is unknown (we store
        {files: FileDetail[]}); returning undefined is a no-op. §'Runtime semantics' confirms convertToLlm maps
        role:custom→user (so the message reaches the LLM) and prompt() runs input→...→before_agent_start→runAgentPrompt
        sequentially (no race on pending)."
  critical: "The handler returns { message: {...} } OR undefined. The message MUST have exactly customType/content/
             display/details (the Pick shape). content = blocks.join('\\n\\n') (string). details = { files: details }.
             customType = 'fileInjector.injected' (the EXACT string T2.S2's renderer registers — the handshake)."

# MUST READ — the two-mechanism model + the stash handoff (the "why" of this subtask)
- file: PRD.md
  why: "§3.4 'How #@ delivers files and renders them compactly (two-mechanism model)' — the input→stash→
        before_agent_start flow diagram + 'Why two hooks, not one'; §6.2 'Delivery: a custom message returned from
        before_agent_start' — the custom message shape + the instance-state handoff + the ordering/persistence
        guarantees; §6.4 'Assembly & shared state' → 'Two returns (not one)' — the exact input-return (stash+transform)
        and before_agent_start-return (consume→message|undefined); §12.20 'Two hooks, one stash' — the clear-
        unconditionally / one-shot-per-prompt invariant."
  section: "### 3.4 + ### 6.2 + ### 6.4 (Two returns) + #### 12.20"
  critical: "§12.20: 'Clear pending unconditionally in before_agent_start (one-shot per prompt) so a later non-#@
             prompt never re-delivers a stale stash.' The clear goes INSIDE the if(pending) block (we clear what we
             consumed); a null pending is already null. §6.4: the input handler stashes ONLY when count>0 (the
             !injected early-return leaves no stash → before_agent_start returns undefined)."

# MUST READ — the contract: T1.S2 is landed; T2.S1 consumes its return
- file: plan/008_561ef016260d/P1M1T1S2/PRP.md
  why: "T1.S2 (LANDED) changed injectFiles' return to {text, images, injected, paged, blocks, details} with text =
        stripped prompt only (the --- concat is gone). T2.S1 destructures blocks+details and stashes them. The T1.S2
        PRP's 'consumed_by' names T2.S1 explicitly: 'P1.M1.T2.S1 (the input handler stashes {blocks, details} →
        before_agent_start custom message)'."
  critical: "T1.S2 is DONE. injectFiles L933-938 signature + L999 early return + L1017 final return are all in the
             working tree (verified). T2.S1 is the next seam; it does NOT touch injectFiles itself."

# The file you edit (the ONLY change — factory region L1053-1075)
- file: file-injector.ts
  why: "1143 lines. Factory at L1053. Module-level cfg L1051 (KEEP — JSDoc L1045-1050 explains the captureHandler-
        fresh-per-capture reason). session_start(config) L1059. input handler L1061-1075 (destructure L1069, early
        return L1071, notify L1073-1074, transform return L1075). session_start(autocomplete) L1089. before_agent_start
        handler INSERTS between L1075 (end of input) and L1089 (autocomplete). pending closure var INSERTS right after
        L1053 (the factory opening brace)."
  pattern: "Mirror the existing handler-registration style: pi.on(\"<event>\", async (_e, ctx) => { … }); The
            before_agent_start handler is async (matches input). The handler body is small (read pending → clear →
            return message | undefined)."
  gotcha: "Do NOT move cfg into the closure. Do NOT register the renderer (T2.S2). Do NOT add renderInjectedMessage
           (T2.S2). Do NOT touch the input handler's short-circuits, notify, or the transform return text/images.
           Do NOT touch injectFiles, the helpers, the detail pushes, the tests."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. The before_agent_start return type must match BeforeAgentStartEventResult
        (verified in external_deps §1). The pending closure var type-checks against FileDetail (exported by S1).
        The input destructure adding blocks/details compiles (they're in the injectFiles return type per T1.S2)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE ONLY FILE EDITED (factory region: +pending closure, rewire input destructure+stash, +before_agent_start handler)
├── file-injector.test.mjs    # NOT edited (RED from T1.S2 — migration is M2.T1)
├── relative-imports.test.mjs # NOT edited (RED from T1.S2)
├── import-behavior.test.mjs  # NOT edited (RED from T1.S2)
├── scripts/typecheck.mjs     # untouched (the typecheck gate — T2.S1's deterministic check)
├── package.json              # untouched
├── PRD.md / README.md        # read-only
└── plan/008_561ef016260d/
    ├── architecture/{system_context.md, external_deps.md, test_migration.md}   # ← external_deps §1 = the verified before_agent_start API
    ├── P1M1T1S1/{PRP.md}   # ← S1 (Complete): FileDetail + State.details + emitText details
    ├── P1M1T1S2/{PRP.md}   # ← S2 (Complete): injectFiles return-shape change (+blocks/+details, --- gone)
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← factory-state verification + the 3 edits + one-shot invariant
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED (factory region, 3 changes):
                          #   (A) +let pending closure var (after the factory opening brace)
                          #   (B) input handler: destructure +blocks/+details; +pending = { blocks, details } (before notify)
                          #   (C) +pi.on("before_agent_start", …) handler (after input, before autocomplete session_start)
# NO other files. NO test edits. NO renderer. NO new exports/imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — cfg STAYS MODULE-LEVEL (L1051). The JSDoc at L1045-1050 explains why: the test harness's
//   captureHandler calls the factory (mod.default(pi)) fresh per capture, so a closure cfg would reset to {}
//   and break the session_start(config)→input(cfg) sharing. Item §3a is explicit: "cfg is module-level
//   (keep it that way)." Do NOT move cfg into the factory. The NEW pending var IS a closure var (item §3a),
//   because it's a per-prompt handoff between two handlers from the SAME factory invocation — closure scope
//   is correct and per-session there.

// CRITICAL — pending is a CLOSURE var, NOT module-level. If it were module-level, multiple parallel sessions
//   could clobber each other's stash. Closure scope ties it to one factory invocation = one session's handler
//   set. Item §3a: "Add a closure variable inside the factory: let pending: { blocks; details } | null = null."
//   Place it right after the factory opening brace, BEFORE the first pi.on.

// CRITICAL — the one-shot clear. Inside before_agent_start, `pending = null` goes INSIDE the `if (pending)`
//   block, AFTER reading { blocks, details }. There is no separate "clear on every call" — a null pending is
//   already null. The invariant (PRD §12.20): a later no-#@ prompt's before_agent_start finds pending===null
//   (the previous prompt cleared it) → returns undefined → no stale re-delivery. The clear is UNCONDITIONAL
//   within the consume path (clear regardless of whether blocks is empty — but blocks is only non-empty when
//   injected>0, which is the only time pending is set).

// CRITICAL — the input handler's existing return { action: "transform", text, images } is UNCHANGED. T1.S2
//   already made text = stripped prompt (the --- concat is gone). T2.S1 only (1) adds blocks, details to the
//   destructure and (2) inserts `pending = { blocks, details };` between the !injected early-return and the
//   notify. Do NOT append blocks to text (that would re-introduce the old design T1.S2 removed).

// CRITICAL — stash ONLY when injected > 0. The `if (!injected) return { action: "continue" };` guard runs
//   BEFORE the stash assignment, so a no-#@ / short-circuited / nothing-injected prompt leaves pending untouched
//   (it stays whatever before_agent_start last cleared it to: null). before_agent_start then returns undefined.
//   This is the §6.4 "Two returns" contract.

// CRITICAL — customType MUST be the exact string "fileInjector.injected". This is the handshake with T2.S2's
//   renderer (registerMessageRenderer("fileInjector.injected", …)). A typo here = the renderer never fires
//   (Pi falls back to the default box). The string appears in: the before_agent_start return (T2.S1) + the
//   registerMessageRenderer call (T2.S2). They MUST match.

// GOTCHA — before_agent_start fires for EVERY prompt, not just #@ ones. That's fine: when pending is null
//   (no #@), it returns undefined (no-op). Pi dispatches by event name; the handler is cheap (one null check).

// GOTCHA — the test suite is INTENTIONALLY RED (from T1.S2). T2.S1 does NOT re-green it. The ~230 r.text-shape
//   failures are the expected intermediate state; M2.T1 migrates them to r.blocks/r.details. T2.S1's gate is
//   typecheck + structural grep. DO NOT edit tests or revert source to force green.

// GOTCHA — display: true is set even though T2.S2 (the renderer) hasn't landed. Pi's CustomMessageComponent
//   falls back to its default [fileInjector.injected] purple box when no renderer is registered for the
//   customType (external_deps §"Runtime semantics"). This is an acceptable interim: the MODEL still receives
//   the <file> blocks (convertToLlm runs regardless of rendering), and the TUI shows a fallback box until T2.S2
//   ships the green read-lines renderer. T2.S1's contract is the DELIVERY seam, not the display.

// LIBRARY — TypeScript via jiti (no build step). typecheck uses tsc --strict. BeforeAgentStartEventResult is
//   the verified return type (external_deps §1); { message?: Pick<CustomMessage,'customType'|'content'|
//   'display'|'details'> }. The handler is async (matches input). No new imports (FileDetail already exported
//   by S1; the handler uses only locals + the pending closure).
```

## Implementation Blueprint

### The 3 edits (exact oldText → newText)

**Edit A — add the `pending` closure variable** (insert right after `export default function (pi: ExtensionAPI) {`, before the first `pi.on`):

```ts
// oldText:
export default function (pi: ExtensionAPI) {
  // §4.6 — load file-injector.json config on session_start (provides ctx.cwd + ctx.isProjectTrusted()).
// newText:
export default function (pi: ExtensionAPI) {
  // §6.2/§12.20 — one-shot handoff stash from the input handler to before_agent_start. input produces the
  // work (file I/O + blocks/details); before_agent_start publishes it as the custom message after the user
  // message. prompt() runs input → … → before_agent_start sequentially (one awaited call), so there is no race.
  // CLOSURE var (NOT module-level like cfg above): pending is a per-prompt handoff between two handlers from
  // this same factory invocation; closure scope is correct and per-session. Cleared unconditionally in
  // before_agent_start (one-shot per prompt, §12.20) so a later no-#@ prompt never re-delivers a stale stash.
  let pending: { blocks: string[]; details: FileDetail[] } | null = null;

  // §4.6 — load file-injector.json config on session_start (provides ctx.cwd + ctx.isProjectTrusted()).
```

**Edit B — rewire the input handler** (L1069 destructure + insert the stash line before the notify):

```ts
// oldText (the destructure, L1069):
    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true); // §5.5 — paged count drives the mode-aware notify below; §4.6 — bareAt derived from cached cfg
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered

    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). Unified wording: always
// newText:
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true); // §5.5 — paged count drives the mode-aware notify below; §4.6 — bareAt derived from cached cfg; §6.2 — blocks/details stashed for before_agent_start
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered (no stash set → before_agent_start returns undefined)

    // §6.2 hand the built blocks+details to before_agent_start (the custom message). Only stashed when
    // injected > 0 (the !injected early-return above left no stash). Cleared one-shot in before_agent_start.
    pending = { blocks, details };

    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). Unified wording: always
```

(The existing `return { action: "transform" as const, text, images };` at the end of the input handler is UNCHANGED.)

**Edit C — add the before_agent_start handler** (insert AFTER the input handler's closing `});` and BEFORE the autocomplete `pi.on("session_start", …)`):

```ts
// newText (insert between the input handler's `});` and the `// ── #@ path autocomplete` comment + session_start):
  // §6.2 publish the stashed files as ONE custom message, appended after the user message. Fires once per
  // prompt(), after the input handler. No stash (no #@, or short-circuited, or nothing injected) → return
  // undefined (no-op). The customType "fileInjector.injected" is the handshake with the MessageRenderer T2.S2
  // registers; until then Pi renders its default [fileInjector.injected] box (delivery to the model — via
  // convertToLlm role:custom→user — works regardless of rendering). Cleared unconditionally (one-shot, §12.20).
  pi.on("before_agent_start", async (_e, _ctx) => {
    if (!pending) return undefined;
    const { blocks, details } = pending;
    pending = null; // clear regardless — one-shot per prompt (a later no-#@ prompt never re-delivers)
    return {
      message: {
        customType: "fileInjector.injected", // the renderer's registered customType (T2.S2 registers it)
        content: blocks.join("\n\n"),        // every <file> block → sent to the LLM (convertToLlm: custom→user)
        display: true,                       // render in the TUI (renderer registered in T2.S2; Pi's default
                                             //   [fileInjector.injected] box shows until then — acceptable interim)
        details: { files: details },         // renderer metadata (NOT extra model text; convertToLlm ignores details)
      },
    };
  });

```

### Implementation Patterns & Key Details

```ts
// The before_agent_start handler — minimal, defensive, one-shot:
pi.on("before_agent_start", async (_e, _ctx) => {
  if (!pending) return undefined;          // no #@ / short-circuited / nothing injected → no-op
  const { blocks, details } = pending;
  pending = null;                          // §12.20 — one-shot clear (inside the if; a null pending is already null)
  return {
    message: {
      customType: "fileInjector.injected", // MUST match T2.S2's registerMessageRenderer string
      content: blocks.join("\n\n"),        // string (the verified content type accepts string)
      display: true,
      details: { files: details },         // unknown-typed slot; the renderer reads details.files
    },
  };
});

// The input handler stash — one line, after the !injected guard:
const { text, images, injected, paged, blocks, details } = await injectFiles(...);
if (!injected) return { action: "continue" };   // leaves pending untouched (null) → before_agent_start no-ops
pending = { blocks, details };                  // §6.2 handoff; only when injected > 0
// ... notify + return { action: "transform", text, images } UNCHANGED ...
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — factory region, 3 changes):
  - (A) pending closure var: INSERT after `export default function (pi: ExtensionAPI) {`, before the first pi.on.
        `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` + the §6.2/§12.20 JSDoc.
  - (B) input handler: change the destructure to add `blocks, details`; INSERT `pending = { blocks, details };`
        between the `if (!injected) return { action: "continue" };` line and the `// §5.5 Notify` comment.
        The transform return is UNCHANGED.
  - (C) before_agent_start handler: INSERT after the input handler's closing `});` and BEFORE the
        `// ── #@ path autocomplete` comment + the autocomplete `pi.on("session_start", …)`.
  - UNCHANGED: cfg (module-level L1051, KEEP); the session_start(config) handler L1059; the input handler's
        3 short-circuits, notify, transform return; the autocomplete session_start handler; injectFiles;
        every helper; every format* function; every detail push.

NO_CHANGES: the three .mjs test files (RED from T1.S2 — M2.T1 migrates), package.json, scripts/typecheck.mjs,
            PRD.md, README.md, all plan/ files. NO new exports. NO new imports. NO renderer (T2.S2).
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the pending closure variable (Edit A)
  - INSERT `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` + the §6.2/§12.20 JSDoc
    right after `export default function (pi: ExtensionAPI) {`, before the `// §4.6 — load file-injector.json` comment.
  - WHY closure (not module-level): item §3a + the L1045-1050 cfg JSDoc. pending is a per-prompt handoff between
    two handlers from the SAME factory invocation; closure scope is correct. cfg stays module-level (do NOT move it).
  - TYPECHECK: FileDetail is exported by S1 → the annotation resolves.

Task 2: REWIRE the input handler (Edit B)
  - CHANGE the destructure (L1069) to add `blocks, details` (from T1.S2's return).
  - INSERT `pending = { blocks, details };` (with the §6.2 comment) between the `if (!injected) return …` line
    and the `// §5.5 Notify` comment.
  - PRESERVE: the 3 short-circuits, the !injected early-return, the notify, the transform return.
  - DO NOT append blocks to text (T1.S2 removed that; re-adding breaks the seam).

Task 3: ADD the before_agent_start handler (Edit C)
  - INSERT the `pi.on("before_agent_start", async (_e, _ctx) => { … })` handler (see Blueprint) AFTER the input
    handler's closing `});` and BEFORE the `// ── #@ path autocomplete` comment.
  - BODY: `if (!pending) return undefined; const { blocks, details } = pending; pending = null; return { message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } };`
  - CRITICAL: customType is the EXACT string "fileInjector.injected" (handshake with T2.S2's renderer).
  - CRITICAL: pending = null goes INSIDE the if (one-shot clear, §12.20).
  - PLACEMENT: after input, before autocomplete session_start (item §3d: conventional; Pi dispatches by event name).

Task 4: VERIFY the deterministic gate
  - npm run typecheck → 0 errors (BeforeAgentStartEventResult is the verified return type; the destructure compiles).
  - Structural grep (Level 2): confirm the 3 edits landed (pending var; input destructure+stash; before_agent_start
    + customType + the one-shot clear).
  - ACKNOWLEDGE the red suite (Level 3): expect ~230 r.text-shape failures (T1.S2's handoff). Do NOT fix (M2.T1).
```

## Validation Loop

### Level 1: Typecheck (THE deterministic gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails:
#   - "Property 'message' does not exist on BeforeAgentStartEventResult" → the return shape is wrong (re-check Edit C
#     against external_deps §1: must be { message: { customType, content, display, details } }).
#   - "Property 'blocks'/'details' does not exist on the return of injectFiles" → T1.S2 didn't land? Verify L935 has
#     `blocks: string[]; details: FileDetail[]` in the return type. (It does — verified.)
#   - A pending-type error → the closure annotation is malformed (re-check Edit A).
```

### Level 2: Structural grep (confirm the 3 edits landed)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[A] pending closure var:";     grep -c 'let pending: { blocks: string\[\]; details: FileDetail\[\] } | null = null' file-injector.ts   # expect 1
echo "[B1] input destructure:";      grep -c 'injected, paged, blocks, details } = await injectFiles' file-injector.ts                       # expect 1
echo "[B2] input stash:";            grep -c 'pending = { blocks, details };' file-injector.ts                                               # expect 1
echo "[C1] before_agent_start handler:"; grep -c 'pi.on("before_agent_start"' file-injector.ts                                              # expect 1
echo "[C2] customType handshake:";   grep -c 'customType: "fileInjector.injected"' file-injector.ts                                          # expect 1
echo "[C3] one-shot clear:";         grep -c 'pending = null; // clear regardless' file-injector.ts                                          # expect 1
echo "[D] cfg still module-level:";  grep -c '^let cfg: FileInjectorConfig = {};' file-injector.ts                                           # expect 1
# Expected: all counts = 1. If any is 0, re-check the corresponding edit.
# (grep is literal-match; if the implementer reworded a comment, adjust the pattern — but the CODE tokens must match.)
```

### Level 3: Expected-red suite acknowledgment (NOT a regression — do NOT fix)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "Result:|FAIL" | head -3
# Expected: MANY failures (the suite was RED from T1.S2; T2.S1 adds no test changes). Final line shows
# "Result: <small number> passed, <large number> failed." This is the INTENDED intermediate state.
# The failures are ALL "r.text no longer contains `<file>`/`---`" shape mismatches (T1.S2 changed the shape;
# M2.T1 migrates the assertions to r.blocks/r.details). NOT type errors, NOT crashes.
# ⚠️ DO NOT edit the test files. DO NOT revert the source. The red suite is M2.T1's handoff signal.
```

### Level 4: Optional runtime probe (confidence only — not a gate)

```bash
# A throwaway probe (do NOT commit) confirming the stash→custom-message handoff via captureHandler.
# Mirror the test harness's jiti loader + the captureHandler("before_agent_start") pattern:
cat > /tmp/t2s1-probe.mjs <<'EOF'
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PIPKG = require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const jiti = require(PIPKG + "/node_modules/jiti/jiti.js");
const mod = jiti(require)("./file-injector.ts", { alias: { "@earendil-works/pi-coding-agent": PIPKG } });
const fs = require("fs"), path = require("path"), os = require("os");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t2s1-"));
fs.writeFileSync(path.join(dir, "a.ts"), "export const x = 1;\n");
const pi = { handlers: {}, on(ev, cb) { (this.handlers[ev] ??= []).push(cb); } };
mod.default(pi);
const ctx = { cwd: dir, hasUI: false };
// Fire session_start first (sets cfg), then input (sets pending), then before_agent_start (consumes).
await pi.handlers["session_start"][0]?.({}, ctx);
const inRes = await pi.handlers["input"][0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
console.log("input action:", inRes.action, "| text startsWith 'Review a.ts':", inRes.text.startsWith("Review a.ts"), "| text has <file>:", inRes.text.includes("<file"));
const basRes = await pi.handlers["before_agent_start"]?.[0]?.({}, ctx);
console.log("bas has message:", !!basRes?.message, "| customType:", basRes?.message?.customType, "| content has <file>:", basRes?.message?.content?.includes("<file"), "| display:", basRes?.message?.display, "| details.files len:", basRes?.message?.details?.files?.length);
// Fire before_agent_start AGAIN — pending must be null now (one-shot) → undefined.
const basRes2 = await pi.handlers["before_agent_start"]?.[0]?.({}, ctx);
console.log("bas 2nd call (one-shot):", basRes2);   // expect undefined
fs.rmSync(dir, { recursive: true, force: true });
EOF
node /tmp/t2s1-probe.mjs; rm -f /tmp/t2s1-probe.mjs
# Expected: input action=transform | text startsWith true | text has <file> FALSE (stripped prompt only);
#           bas has message TRUE | customType "fileInjector.injected" | content has <file> TRUE | display TRUE | details.files len 1;
#           bas 2nd call: undefined (one-shot clear works).
# (If the jiti path doesn't resolve, skip this probe — Level 1+2 are the deterministic gate.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] Structural grep (Level 2): all 7 checks pass (pending var; input destructure; input stash; before_agent_start handler; customType; one-shot clear; cfg module-level).
- [ ] `git diff --stat` shows ONLY `file-injector.ts` changed.

### Feature Validation (the contract)

- [ ] The `input` handler stashes `{ blocks, details }` ONLY when `injected > 0` (the `!injected` early-return leaves pending untouched).
- [ ] The `input` handler returns `{ action: "transform", text, images }` with `text` = stripped prompt (blocks NOT appended).
- [ ] The `before_agent_start` handler returns `undefined` when `pending` is null; otherwise returns `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.
- [ ] `pending` is cleared one-shot inside the consume path (§12.20); a second `before_agent_start` call returns `undefined`.
- [ ] `customType` is the exact string `"fileInjector.injected"` (the T2.S2 renderer handshake).

### Scope & Gate Integrity

- [ ] `cfg` STAYS module-level (L1051); `pending` is a closure var (item §3a).
- [ ] NO renderer registration, NO `renderInjectedMessage` (T2.S2's scope).
- [ ] NO test edits (the red suite is T1.S2's expected handoff; M2.T1 migrates).
- [ ] injectFiles, the helpers, the detail pushes, the session_start(config) handler, the autocomplete session_start handler — all UNCHANGED.
- [ ] No new exports; no new imports.

### Documentation

- [ ] JSDoc on the `pending` closure var (§6.2/§12.20; why closure-not-module-level; one-shot clear).
- [ ] JSDoc on the `before_agent_start` handler (§6.2; no-op when no stash; the customType handshake with T2.S2; display:true interim).
- [ ] The §6.2 comment on the stash line in the input handler.
- [ ] No README/user-facing change (internal handler wiring; Mode A: none).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT move cfg into the factory closure.** cfg is module-level (L1051) because captureHandler re-invokes
  the factory fresh per capture, and session_start(config)→input(cfg) must share it across captures. The L1045-1050
  JSDoc documents this. Item §3a is explicit: "cfg is module-level (keep it that way)." Only `pending` is a closure var.
- ❌ **Do NOT make `pending` module-level.** It's a per-prompt handoff between two handlers from ONE factory
  invocation; closure scope is correct (per-session) and avoids cross-session clobbering. Item §3a: "Add a closure
  variable inside the factory."
- ❌ **Do NOT append blocks to the input handler's `text`.** T1.S2 removed the `\n\n---\n\n` concat; `text` is the
  stripped prompt only. The blocks go to the model via the `before_agent_start` custom message, NOT via the prompt
  text. Re-appending would duplicate bytes for the model and defeat the compact-display seam.
- ❌ **Do NOT clear `pending` outside the `if (pending)` block.** The one-shot clear (§12.20) goes INSIDE the consume
  path (after reading `{ blocks, details }`). A null pending is already null — there's no separate "clear on every call."
- ❇️ **Do NOT register the MessageRenderer or write `renderInjectedMessage`.** That's T2.S2's scope. T2.S1 sets
  `display: true`; Pi renders its default `[fileInjector.injected]` box as an acceptable interim (delivery to the
  model works regardless). Registering the renderer here = scope creep into T2.S2.
- ❌ **Do NOT edit the test files.** The suite is INTENTIONALLY RED from T1.S2 (~230 r.text-shape failures). M2.T1
  migrates them. T2.S1's gate is typecheck + structural grep.
- ❌ **Do NOT typo the customType.** It MUST be the exact string `"fileInjector.injected"` — the handshake with T2.S2's
  `registerMessageRenderer("fileInjector.injected", …)`. A typo = the renderer never fires.
- ❌ **Do NOT touch injectFiles, the helpers, the detail pushes, the session_start(config) handler, or the autocomplete
  handler.** T2.S1 edits ONLY the factory region (pending var + input destructure/stash + before_agent_start handler).
- ❌ **Do NOT add a 4th `session_start` handler or merge the config load with the renderer registration.** Keep the
  existing 3 handlers (config / input / autocomplete) and ADD before_agent_start between input and autocomplete.
- ❌ **Do NOT return the custom message from the input handler.** The input handler returns a transform (stripped
  prompt); the custom message comes from before_agent_start. PRD §3.4 "Why two hooks, not one": input can only
  rewrite prompt text, not append separate messages.

---

## Confidence Score: 9/10

Three precise, well-bounded factory-region edits (A: pending closure var; B: input destructure + stash line;
C: before_agent_start handler), each verified against the POST-T1.S2 working tree and traced through PRD §3.4/§6.2/§12.20.
The verified before_agent_start API (external_deps §1: `BeforeAgentStartEventResult.message?` Pick shape; `undefined`
= no-op) pins the return type. The cfg-module-level-vs-pending-closure distinction (item §3a + the L1045-1050 JSDoc)
is documented. The one-shot clear invariant (§12.20) is explicit. The "display:true but no renderer yet" interim is
explained (delivery works; display is T2.S2). The deterministic gate (typecheck + structural grep) is unambiguous.
The -1 reserves for the UNUSUAL gate (an intentionally-red suite from T1.S2): the implementing agent must understand
the red suite is the EXPECTED intermediate state and must NOT edit tests (M2.T1), revert source, or register the
renderer (T2.S2) — all out of scope. The PRP flags this loudly in the scope header, success criteria, Level 3, and
the anti-patterns.
