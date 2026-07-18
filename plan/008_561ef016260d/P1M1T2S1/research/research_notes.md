# Research Notes — P1.M1.T2.S1: input/before_agent_start split with one-shot pending stash

> Handler-wiring subtask. Adds a closure `pending` stash + a `before_agent_start` handler, and rewires the
> existing `input` handler to stash `{blocks, details}` (consumed from T1.S2's landed return shape) instead of
> appending blocks to the prompt text (which T1.S2 already stopped doing). NO renderer (that's T2.S2); NO test
> migration (that's M2.T1). The custom message will render via Pi's default fallback box until T2.S2 registers
> the green read-line renderer.

## 1. T1.S2 contract — LANDED in source (verified first-hand)

T1.S2 (the parallel/previous task) is **fully landed** in the working tree:
- `injectFiles` signature (L933-938): returns `Promise<{ text; images; injected; paged; blocks: string[]; details: FileDetail[] }>`.
  Takes a 4th `bareAt = false` arg (derived from cfg in the input handler).
- Early return (L999): `{ text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }`.
- Final return (L1017): `{ text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details }`.
  The `\n\n---\n\n` concat is GONE (L1016 comment: "details are returned for the caller (P1.M1.T2.S1 stashes them...").
- **`text` is the stripped prompt ONLY** (no `<file>` blocks, no `---`).

∴ T2.S1 CONSUMES `blocks` + `details` from the injectFiles return. The seam is already in place.

## 2. The factory's current state (file-injector.ts L1045-1075, verified)

```ts
let cfg: FileInjectorConfig = {};   // L1051 — MODULE-LEVEL (NOT a closure var). The JSDoc above it (L1045-1050)
                                    // explains WHY: captureHandler calls the factory fresh per capture, so a
                                    // closure cfg would reset to {} and break the session_start→input sharing.
                                    // The item §3a explicitly says KEEP cfg module-level.

export default function (pi: ExtensionAPI) {   // L1053
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });   // L1059 — config load (1st session_start)
  pi.on("input", async (event, ctx) => {   // L1061
    // ... 3 short-circuits (extension/steer/no-#@) ...
    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);   // L1069 — DESTRUCTURE IGNORES blocks/details
    if (!injected) return { action: "continue" };   // L1071
    const whole = injected - paged;
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info");   // L1074
    return { action: "transform" as const, text, images };   // L1075 — returns stripped text (blocks NOT appended; T1.S2 removed the concat)
  });
  pi.on("session_start", (_event, ctx) => { /* autocomplete provider */ });   // L1089 — 2nd session_start (autocomplete)
}
```

**Key facts:**
- **cfg is module-level (L1051)** and MUST stay that way (item §3a). The JSDoc L1045-1050 documents the captureHandler-fresh-per-capture reason. Do NOT move cfg into the factory closure.
- **The input handler at L1069 destructures `{ text, images, injected, paged }`** — it ALREADY ignores blocks/details (T1.S2 added them to the return; the factory hasn't consumed them yet). T2.S1 ADDS `blocks, details` to the destructure and STASHES them.
- **The input handler ALREADY returns `{ action: "transform", text, images }`** with `text` = stripped prompt (T1.S2 removed the concat). So the "return stripped text" half of the item §3b is ALREADY done; T2.S1 only adds the stash assignment.
- **NO before_agent_start handler, NO pending stash** exist (grep confirms only the L1016 comment references the future stash). Confirms item §1.

## 3. The exact edits (3 changes, all inside the factory)

### Edit A — add the `pending` closure variable (inside the factory, right after `export default function (pi: ExtensionAPI) {`)

```ts
export default function (pi: ExtensionAPI) {
  // §6.2/§12.20 — one-shot handoff stash from the input handler to before_agent_start. input produces the
  // work (file I/O + blocks/details); before_agent_start publishes it (the custom message after the user msg).
  // prompt() runs input → ... → before_agent_start sequentially (one awaited call), so there is no race.
  // Cleared unconditionally in before_agent_start (one-shot per prompt) so a later no-#@ prompt never re-delivers.
  // CLOSURE var (NOT module-level like cfg): scoped to one factory invocation = one session's handler set.
  let pending: { blocks: string[]; details: FileDetail[] } | null = null;
  ...
```

**Why closure (NOT module-level like cfg)?** `pending` is a per-prompt handoff between two handlers registered
in the SAME factory call. cfg must be module-level because captureHandler re-invokes the factory (resetting
closure state) but the session_start→input pair must share cfg across captures. `pending`, by contrast, is
written in input and read in before_agent_start of the SAME prompt() call — both handlers come from the same
factory invocation, so a closure var is correct and scope-appropriate. (If it were module-level, multiple
parallel sessions could clobber each other's stash; closure keeps it per-factory-invocation.) The item §3a
explicitly specifies this: "cfg is module-level (keep it that way)... Add a closure variable inside the factory."

### Edit B — rewire the input handler to stash (L1069 destructure + add stash assignment before the return)

```ts
// OLD (L1069):
    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);
// NEW:
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);
```
Then, AFTER the `if (!injected) return { action: "continue" };` line (L1071) and BEFORE the notify (L1073),
add the stash assignment:
```ts
    // §6.2 hand the built blocks+details to before_agent_start (the custom message). Only stashed when
    // injected > 0 (the !injected early-return above left no stash → before_agent_start returns undefined).
    pending = { blocks, details };
```
The existing `return { action: "transform" as const, text, images };` (L1075) is UNCHANGED — `text` is already
the stripped prompt (T1.S2), and we do NOT append blocks (also T1.S2). So the only input-handler changes are:
(1) destructure blocks/details; (2) the one stash line.

### Edit C — add the before_agent_start handler (AFTER the input handler registration, BEFORE the autocomplete session_start)

```ts
  // §6.2 publish the stashed files as ONE custom message, appended after the user message. Fires once per
  // prompt(), after the input handler. No stash (no #@, or short-circuited) → return undefined (no-op).
  // Cleared unconditionally (one-shot per prompt) per §12.20.
  pi.on("before_agent_start", async (_e, _ctx) => {
    if (!pending) return undefined;
    const { blocks, details } = pending;
    pending = null;   // clear regardless — one-shot per prompt (a later no-#@ prompt never re-delivers)
    return {
      message: {
        customType: "fileInjector.injected",   // the renderer's registered customType (T2.S2 registers it)
        content: blocks.join("\n\n"),           // every <file> block → sent to the LLM (convertToLlm: custom→user)
        display: true,                          // render in the TUI (renderer registered in T2.S2; Pi's default
                                                //   [fileInjector.injected] box shows until then — acceptable interim)
        details: { files: details },            // renderer metadata (NOT sent as extra model text; convertToLlm ignores details)
      },
    };
  });
```

**Placement**: AFTER the `pi.on("input", …)` block (ends ~L1075) and BEFORE the `pi.on("session_start", …)`
autocomplete block (L1089). Item §3d says "Register this handler AFTER the input handler registration (order
within the factory does not matter for runtime since Pi dispatches by event name, but placing it after input
is conventional)." So: input → before_agent_start → autocomplete-session_start.

## 4. The one-shot / clear-unconditionally invariant (PRD §12.20 — load-bearing)

`pending = null` happens **unconditionally** inside the `if (pending)` block (after reading blocks/details),
NOT in an `else`. This means: if `pending` is null (no #@, or short-circuited), the handler returns undefined
AND does nothing else. If `pending` is non-null, it reads it, clears it, returns the message. The "one-shot
per prompt" guarantee (§12.20): a later no-#@ prompt's before_agent_start finds `pending === null` (the
previous prompt's handler cleared it) → returns undefined → no stale re-delivery. This is why the clear is
inside the `if` (we only clear what we consumed) — there's no separate "clear on every call" because a null
pending is already null.

**The race-free argument (PRD §6.2):** `prompt()` runs `input` → … → `before_agent_start` → `runAgentPrompt`
sequentially in ONE awaited call. So by the time before_agent_start fires, the input handler (which sets
`pending`) has already completed. No locking needed.

## 5. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Complete) | FileDetail interface, State.details, emitText text/paged detail pushes | T2.S1 CONSUMES State.details (via injectFiles' return). No file conflict. |
| P1.M1.T1.S2 (Complete, parallel) | image/binary/empty-image detail pushes + injectFiles return-shape change (strip the `---`) | T2.S1 CONSUMES the new `{blocks, details}` return. T1.S2 is LANDED. T2.S1 is the next seam. |
| P1.M1.T2.S2 (Planned, downstream) | Register MessageRenderer + implement renderInjectedMessage (green read-tool display) | T2.S1 SETS `customType: "fileInjector.injected"` + `display: true` — the contract T2.S2's renderer fulfills. Until T2.S2 lands, Pi renders the default `[fileInjector.injected]` purple box (acceptable interim per external_deps §"Runtime semantics"). T2.S1 does NOT register the renderer or write renderInjectedMessage. |
| P1.M2.T1.S1 (Planned) | Migrate ~230 test assertions from r.text to r.blocks/r.details | Orthogonal to T2.S1 (test migration; T2.S1 is source). T2.S1 doesn't touch tests. |

**Critical no-conflict:** T2.S1 edits ONLY the factory region of file-injector.ts (L1053-1075: add pending
closure, rewire input destructure + stash, add before_agent_start handler). It does NOT touch: the injectFiles
function (T1.S2 owns it), the helpers, the detail pushes, the test files, or the renderer (T2.S2). The
`customType` string `"fileInjector.injected"` is the handshake contract between T2.S1 (the producer) and T2.S2
(the renderer) — both must use the exact same string.

## 6. The "display: true but no renderer yet" interim (acceptable)

After T2.S1 lands (and before T2.S2), the custom message is returned with `display: true` but NO renderer is
registered for `"fileInjector.injected"`. Pi's `CustomMessageComponent` falls back to its default rendering:
a `[fileInjector.injected]` purple box showing the raw content (external_deps.md §"Runtime semantics": "A
thrown MessageRenderer is caught... falls back to Pi's default box" — and a missing renderer behaves the same).
This is an acceptable interim state:
- The **model still receives the `<file>` blocks** (convertToLlm maps the custom message to a user-role
  message regardless of whether a renderer exists — delivery is independent of display).
- The **TUI shows a fallback box** (purple, raw content) instead of the green read-lines — not the final UX,
  but T2.S1's contract is the DELIVERY seam, not the display. T2.S2 ships the green renderer.
- The **test suite** doesn't exercise the renderer at all (the .mjs harnesses call injectFiles / the input
  handler directly; they don't render). So T2.S1's gate is unaffected by the missing renderer.

## 7. Validation approach

T2.S1's deterministic gate is `npm run typecheck` → 0 errors (the edits compile; BeforeAgentStartEventResult
is the verified return type). The test suite is INTENTIONALLY RED from T1.S2 (~230 r.text-shape failures;
M2.T1 migrates them) — T2.S1 does NOT re-green it. Structural greps confirm:
- `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` exists inside the factory.
- The input destructure includes `blocks, details`.
- `pending = { blocks, details };` exists in the input handler.
- `pi.on("before_agent_start"` exists.
- `customType: "fileInjector.injected"` exists.
- `pending = null;` (the one-shot clear) exists.

A runtime probe (optional) can confirm the stash→custom-message handoff via the captured before_agent_start
handler (the test harness's captureHandler pattern captures handlers by event name).

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck   # → 0 errors (the gate)
# Structural greps (Level 2):
grep -c 'let pending: { blocks: string\[\]; details: FileDetail\[\] } | null = null' file-injector.ts  # expect 1
grep -c 'pending = { blocks, details }' file-injector.ts   # expect 1
grep -c 'pi.on("before_agent_start"' file-injector.ts      # expect 1
grep -c 'customType: "fileInjector.injected"' file-injector.ts   # expect 1
grep -c 'pending = null;' file-injector.ts                  # expect 1
```

The red suite (Level 3) is the expected T1.S2 handoff state — DO NOT edit tests (M2.T1) or revert source.
