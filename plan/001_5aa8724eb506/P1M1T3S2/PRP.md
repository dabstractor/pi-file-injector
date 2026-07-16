---
name: "P1.M1.T3.S2 — Input event handler: replace factory stub (3 guards, injectFiles call, hasUI-guarded notify, transform/continue)"
prd_ref: "PRD §3 (input event fires in prompt() for all contexts), §9 (handler algorithm), §12.1/§12.2/§12.4 (the 3 guards), §10 (edge cases), §11 (#5/#7/#8/#9/#12/#14 handler-owned acceptance), Appendix A (minimal skeleton)"
target_file: "./file-injector.ts"  # IN-PLACE EDIT; S1+S2+T2.S1+T3.S1 already present. This task replaces ONLY the factory stub body + adds a JSDoc.
target_language: TypeScript (jiti transpile-on-load; no tsconfig/package.json/test framework)
depends_on: "P1.M1.T1.S1 (factory stub + imports/constants), P1.M1.T1.S2 (parsing helpers), P1.M1.T2.S1 (format helpers), P1.M1.T3.S1 (injectFiles — consumed as the handler's single I/O call)"
consumed_by: "P1.M2.T4.S1 (manual acceptance matrix — extension must be fully functional), P1.M2.T5.S1 (README documents this entry point)"
---

# PRP — P1.M1.T3.S2: Input Event Handler (replace factory stub)

## Goal

**Feature Goal**: Replace the `pi.on("input", ...)` **factory stub body** in `./file-injector.ts` with the
**real input handler** — the final wiring that makes the extension fully functional. The handler: (1)
short-circuits on three cheap guards (`source==="extension"` for loop prevention, `streamingBehavior==="steer"`
for latency, no `#@` substring for a cheap pre-check), (2) delegates all file I/O + assembly to `injectFiles`
(already implemented in T3.S1), (3) emits a user-facing `notify` (guarded by `ctx.hasUI`) with the injected
file count, and (4) returns `{action:"transform", text, images}` when files were injected or
`{action:"continue"}` otherwise. Also adds a **Mode-A JSDoc** above the factory documenting the extension
purpose, the `#@<path>` syntax, all-context support, and the no-limits/no-config guarantee.

**Deliverable**: One in-place edit to `./file-injector.ts`:
- **(a)** Replace the stub handler body (`return { action: "continue" };`) with the 7-line real handler.
- **(b)** Insert a JSDoc `/** ... */` block immediately above `export default function (pi: ExtensionAPI) {`.

~7 lines of handler code + ~18 lines of JSDoc. **No new files.** The rest of the file (6 imports, 3
constants, 3 S2 parsing helpers, 4 T2.S1 format helpers, `injectFiles`) is **untouched**.

**Success Definition**:
- [ ] The handler returns `{action:"continue"}` for: `source==="extension"` (loop prevention), `steer`
      streaming, no `#@` substring, and `injected===0` (no valid file resolved).
- [ ] The handler returns `{action:"transform", text, images}` when ≥1 file was injected — the same
      `{text, images}` object that `injectFiles` returns (merged images, original text + appended blocks).
- [ ] `ctx.ui.notify(`#@ injected ${injected} file(s)`, "info")` is called IFF `ctx.hasUI === true`
      AND ≥1 file was injected. Never called in print/json modes (headless) or on a `continue` path.
- [ ] The 2nd `notify` arg is the string `"info"` (the param is named **`type`**, constrained to
      `"info"|"warning"|"error"` — NOT `"level"`).
- [ ] A Mode-A JSDoc sits directly above `export default function`, covering all 4 required points
      (purpose, `#@<path>` syntax, all-input-context support, no limits/no config).
- [ ] Level-2 jiti gate (~22 assertions) passes with exit 0, **non-interactively, no model/API key** —
      it captures the handler via a mock `pi.on("input", cb)` and a mock `ctx` with a notify recorder.

> **Scope boundary (read carefully):** This subtask changes ONLY the factory function (body replacement
> + JSDoc). Do NOT touch `injectFiles`, the helpers, the constants, or the imports. Do NOT add a
> try/catch wrapper around the `injectFiles` call — `injectFiles` already guarantees "never throws"
> (T3.S1 contract, PRD §12.5) and the guards are throw-free value comparisons; a wrapper is dead code
> that PRD §9 / Appendix A do not have. Do NOT add a README (P1.M2.T5.S1) or run the 14-case manual
> matrix (P1.M2.T4.S1 — needs a real model). Do NOT add any size gate, config, or truncation (PRD §2
> Non-Goals, §12.11, §13).

## User Persona

**Target User**: The end user who types `#@<path>` (and, transitively, the implementing agent).

**Use Case**: In ANY input context — interactive TUI message, initial `pi -p "...#@file..."` launch, or
an RPC call — the user writes `#@src/index.ts` (or `#@~/notes.md`, `#@pic.png`) and the file's entire
contents are appended to the prompt before it reaches the model, with no `read` tool call. This is the
key advantage over Pi's built-in `@file` CLI expansion (which runs pre-`prompt()` during argv parsing
and only at launch — PRD §3.1).

**User Journey**: user types prompt containing `#@path` → Pi calls `prompt()` → `input` event fires →
**this handler** runs (guards pass) → `injectFiles` reads + assembles → handler returns `transform` →
runner replaces the prompt text/images with the expanded version → notify shows `#@ injected N file(s)` →
agent loop begins with the full file already in context.

**Pain Points Addressed**: Without this handler, `injectFiles` is dead code (the stub always returns
`continue`). This subtask is the "on switch" — the one place that connects the `#@` trigger to the
assembly engine. The three guards (loop prevention, steer latency, cheap pre-check) make it safe and
fast for the 99% of prompts that have no `#@`.

## Why

- **It's the activation step.** Every prior subtask built pieces (regex, path resolution, format blocks,
  `injectFiles`); none of them run until the handler wires `injectFiles` to the `input` event. This is
  the final, load-bearing connection.
- **The guards are individually critical.** Loop prevention (§12.1) prevents an infinite loop if any
  extension re-feeds `#@` text. The steer skip (§12.2) keeps mid-stream corrections fast. The `includes`
  pre-check (§12.4) avoids regex+IO for every prompt. Each has a dedicated acceptance path.
- **`notify`-on-inject is the user's only feedback** that injection happened (besides the model's
  response). Guarding it with `ctx.hasUI` keeps print/json/RPC-headless modes clean.
- **`transform`-vs-`continue` is the merge contract surface.** Returning `continue` on `injected===0`
  preserves the prompt byte-for-byte (no spurious transform). Returning `transform` with `injectFiles`'s
  merged `images` array is the only correct way to attach images without destroying user-attached ones
  (the runner REPLACES the array on `transform`-with-images — system_context.md).

## What

Edit `./file-injector.ts` in place:

**(a) Replace** the factory stub body. The **exact current stub** (verified in the file) is:
```ts
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```
**After** the edit, the factory is the JSDoc + real handler (see "Exact source to write" below).

**(b) Insert** a Mode-A JSDoc `/** ... */` block immediately above `export default function (pi: ExtensionAPI) {`.

No new files. No new imports (`ExtensionAPI` is already imported; `injectFiles` + `ImageContent` are
already in module scope). No changes to `injectFiles`, the helpers, the constants, or any other line.

### Success Criteria

- [ ] Handler guard order is exactly: `source==="extension"` → `streamingBehavior==="steer"` → `!text.includes("#@")`.
- [ ] Each guard returns `{action:"continue"}` (a plain object literal — no `as const` needed for `continue`).
- [ ] `injectFiles` is called as `await injectFiles(event.text, event.images ?? [], ctx)`.
- [ ] `if (!injected) return { action: "continue" };` — `injected` is a count; `0` is falsy.
- [ ] `notify` fires ONLY when `ctx.hasUI && injected > 0`, with message `` `#@ injected ${injected} file(s)` ``
      and `type` `"info"`.
- [ ] Return on success: `{ action: "transform" as const, text, images }` (the `{text, images}` from
      `injectFiles`).
- [ ] JSDoc covers all 4 Mode-A points; sits at column 1 directly above the factory.
- [ ] Level-2 jiti gate: ~22 assertions green, exit 0.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the exact verified handler source (copied from PRD §9 /
> Appendix A and cross-checked against dist `.d.ts`), the exact current stub to replace (read from the
> file), the exact Mode-A JSDoc text, the verified `InputEvent`/`InputEventResult`/`ExtensionContext`/
> `ui.notify` contracts with `dist:line` evidence, the three guard rationales (each tied to a Pi example
> extension + PRD §), the `as const` type-only note, the "no try/catch wrapper" rationale, the
> concurrency-safe edit anchor, AND a pre-designed ~22-assertion Level-2 gate (mock `pi` + mock `ctx`,
> model-free). No `dist/` access required beyond the quotes provided.

### Documentation & References

```yaml
# MUST READ — the consumed function's contract (injectFiles from the in-flight/complete prior subtask)
- docfile: plan/001_5aa8724eb506/P1M1T3S1/PRP.md
  why: "injectFiles(text, imagesIn, ctx: {cwd:string}) => Promise<{text, images, injected: number}>.
        The handler calls it, reads `injected` (a COUNT; 0 = nothing changed → continue), and forwards
        `{text, images}` verbatim into the transform result. injectFiles NEVER throws (per-file
        try/catch) and returns the ORIGINAL imagesIn ref on injected===0 / a merged copy on >0."
  critical: "`injected` is a NUMBER not a boolean. `!injected` treats 0 as falsy. The handler must NOT
        re-validate files or re-wrap in try/catch — injectFiles owns that."

- docfile: plan/001_5aa8724eb506/P1M1T1S1/PRP.md
  why: "Defines the EXACT factory stub this task replaces: `pi.on(\"input\", async (event, ctx) => {
        return { action: \"continue\" }; })` inside `export default function (pi: ExtensionAPI) {}`.
        Also defines the 6 imports (ExtensionAPI, ImageContent, resizeImage, formatDimensionNote,
        type ResizedImage, fs, path, os) — already present, do NOT re-add."
  critical: "The stub is the unique, stable edit anchor. T3.S1 inserts injectFiles ABOVE the factory
        without touching it, so the anchor is safe regardless of T3.S1 landing state."

# MUST READ — verified architecture recon (the contracts this handler depends on)
- docfile: plan/001_5aa8724eb506/architecture/system_context.md
  why: "'Input Event Dispatch Internals' (runner.js:882-920): handlers chain in load order; transform
        with images PRESENT REPLACES the array; per-handler errors are swallowed (emitError) but the
        extension should still never throw. 'Critical: Image Array Merging' — returning merged images
        is mandatory; injectFiles already seeds [...imagesIn]. 'Risks & Mitigations' lists all 3 guards."
  section: "Input Event Dispatch Internals + Critical: Image Array Merging + Risks & Mitigations"

- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: "§1 InputEvent/InputEventResult exact shapes. §5 ExtensionContext: ctx.cwd (string),
        ctx.hasUI (boolean, true in TUI+RPC only), ctx.ui.notify(message, type?: 'info'|'warning'|'error')
        — the 2nd arg is named `type` NOT `level`. on('input', (event, ctx) => InputEventResult|void)."
  section: "§1, §5"

- docfile: plan/001_5aa8724eb506/architecture/extension_patterns.md
  why: "§3: input-transform-streaming.ts demonstrates the canonical steer-skip guard as the handler's
        early check; input-transform.ts demonstrates the event.source==='extension' re-entrancy guard.
        Both guards are mirrored verbatim here. Also: notify is guarded by ctx.hasUI (api_verification §5)."
  section: "§3 (input-transform-streaming.ts + input-transform.ts patterns), lines 142/159-203"

# THIS TASK's research (detailed)
- docfile: plan/001_5aa8724eb506/P1M1T3S2/research/research_notes.md
  why: "Verified dist:line contracts (InputEvent 615-626, InputEventResult 629, on('input') 872, ctx
        hasUI/cwd 214/216/388, ui.notify 75), the 3-guard rationale matrix, the exact current stub
        (edit anchor), the as-const-type-only note, the no-try/catch rationale, the concurrency-safety
        argument, and the ~22-assertion gate design (mock pi + mock ctx, model-free)."
  section: "§1 (contracts), §2 (guards), §3 (edit anchor), §4 (exact source), §7 (gate design)"

# PRD source of truth (read-only; do NOT edit PRD.md)
- docfile: PRD.md
  why: "§3 = why #@ works in all input contexts (the input event fires in prompt()). §9 = authoritative
        handler pseudocode. §12.1/§12.2/§12.4 = the 3 guards. §10 = edge cases. §11 = acceptance matrix
        (handler owns #5/#7/#8/#9/#12/#14). Appendix A = minimal skeleton."
  section: "§3, §9, §10, §11, §12.1/§12.2/§12.4, Appendix A"
```

### Verified dist quotes (so the implementer never opens dist/)

**`InputEvent`** (`dist/core/extensions/types.d.ts:615-626`):
```ts
export type InputSource = "interactive" | "rpc" | "extension";   // 615
export interface InputEvent {                                    // 617
    type: "input";
    text: string;
    images?: ImageContent[];
    source: InputSource;                                         // 624 — required
    streamingBehavior?: "steer" | "followUp";                    // 626 — optional
}
```

**`InputEventResult`** (`dist/core/extensions/types.d.ts:629`):
```ts
export type InputEventResult =
  | { action: "continue" }
  | { action: "transform"; text: string; images?: ImageContent[] }
  | { action: "handled" };
```

**`on("input")`** (`dist/core/extensions/types.d.ts:872`):
```ts
on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
// ExtensionHandler<E,R> = (event: E, ctx: ExtensionContext) => Promise<R|void> | R | void;
```

**`ExtensionContext`** (relevant fields, `dist/core/extensions/types.d.ts:214,216,388-389`):
```ts
hasUI: boolean;   // 214/388 — true in TUI + RPC only; false in print/json
cwd: string;      // 216
ui: Pick<ExtensionUIContext, "select" | "confirm" | "input" | "notify">;   // 389
```

**`ui.notify`** (`dist/core/extensions/types.d.ts:75`):
```ts
notify(message: string, type?: "info" | "warning" | "error"): void;
```
→ 2nd param is `type` (not `level`); our call passes `"info"`.

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-file-injector
.
├── .gitignore          # ignores node_modules/, dist/, .pi-subagents/ — NOT .ts
├── PRD.md              # READ-ONLY source of truth
├── file-injector.ts    # ← EXISTS; S1+S2+T2.S1+T3.S1 already present. T3.S2 EDITS THIS (factory + JSDoc).
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/{api_verification,system_context,external_deps,extension_patterns}.md
        ├── prd_snapshot.md / prd_index.txt
        ├── tasks.json          # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T1S1/{PRP.md, research/}
        ├── P1M1T1S2/{PRP.md, research/}
        ├── P1M1T2S1/{PRP.md, research/}
        ├── P1M1T3S1/{PRP.md, research/}   # injectFiles — consumed
        └── P1M1T3S2/
            ├── research/research_notes.md  # THIS TASK's research
            └── PRP.md                      # ← THIS FILE
# NOTE: NO src/, NO package.json, NO tsconfig, NO test framework. Single-file jiti extension.
```

### Current factory stub (the EXACT text to replace — read from file-injector.ts)

```ts
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```
This block is at the **end** of the file, below `injectFiles`. It is unique and is the stable edit anchor.

### Desired result after the edit (factory + JSDoc only — nothing else changes)

```bash
file-injector.ts
  # (unchanged regions — do NOT touch)
  #   imports (6, incl type ResizedImage)
  #   const FILE_INJECT_RE / MIME_BY_EXT / TRAILING_PUNCT
  #   export function cleanToken / expandTildeAndResolve / extOf
  #   export function isBinary / formatTextFileBlock / formatImageBlock / formatBinaryBlock
  #   export async function injectFiles(...)
  # (T3.S2 region — REPLACED: JSDoc + real handler body)
  + /** <Mode-A JSDoc: purpose, #@<path> syntax, all-context, no limits/no config> */
  + export default function (pi: ExtensionAPI) {
  +   pi.on("input", async (event, ctx) => {
  +     <3 guards> ; <injectFiles call> ; <injected===0 continue> ; <hasUI notify> ; <transform return>
  +   });
  + }
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — Guard ORDER is source → steer → includes("#@"). The item description and PRD §9 fix this
// order. A re-entrant extension message (source==="extension") must short-circuit BEFORE any regex/IO,
// regardless of steer state. Put `event.source === "extension"` first. (PRD §12.1, item §1a.)

// CRITICAL — `event.images ?? []`. `images?` is optional on InputEvent (dist:619). Passing `undefined`
// would make injectFiles's `[...imagesIn]` throw. Always coalesce: `event.images ?? []`.

// CRITICAL — `injected` is a COUNT (number), NOT a boolean. `if (!injected)` treats 0 as falsy and
// any positive count as truthy. Do NOT write `injected === true` or `injected > 0` differently — `!injected`
// is the exact PRD §9 form and is correct. (injectFiles returns injected:0 on no-valid-file.)

// CRITICAL — notify 2nd arg is named `type`, constrained to "info"|"warning"|"error". Pass the string
// literal `"info"` (NOT "level", NOT a variable). (dist:75, api_verification §5.)

// CRITICAL — Guard notify with `ctx.hasUI`. In print/json modes hasUI===false (headless); calling notify
// there is meaningless and the architecture mandates the guard. `if (ctx.hasUI) ctx.ui.notify(...)`.
// (api_verification §5: hasUI is true in TUI and RPC modes only.)

// CRITICAL — `as const` on the transform result is TYPE-ONLY. jiti is transpile-only and strips it at
// load; it has ZERO runtime effect. Keep it to match PRD §9 / Appendix A and to document intent, but
// know its absence would not break runtime (only a type error jiti never checks). Do not "fix" a reviewer
// who drops it, but WRITE it per the PRD.

// CRITICAL — Do NOT wrap the injectFiles call in try/catch. injectFiles ALREADY guarantees "never throws"
// (per-file try/catch; T3.S1 contract; PRD §12.5). The guards are throw-free value comparisons. A wrapper
// is dead code that PRD §9 / Appendix A do NOT have. The runner would swallow a throw anyway, but the
// contract is "injectFiles never throws" so the wrapper is both unnecessary and unrequested.

// GOTCHA — `continue` results are plain object literals: `{ action: "continue" }`. No `as const` needed
// (the PRD §9 pseudocode omits it for continue and uses it only on transform). Either is runtime-safe;
// match the PRD.

// GOTCHA — The factory stub is the UNIQUE stable anchor. T3.S1 (running in parallel) inserts injectFiles
// ABOVE the factory without touching it. So the stub text is byte-identical whether or not T3.S1 has
// landed — anchor your edit on the stub verbatim.

// OK — `event.text?.includes("#@")` uses optional chaining defensively. `text` is typed `string`
// (non-optional) so `text` is never undefined in practice, but the `?.` is harmless and matches PRD §9
// verbatim. Keep it.

// OK — `event.streamingBehavior === "steer"` is false when `streamingBehavior` is `undefined` (idle) or
// `"followUp"` (queued) — both proceed to the next guard. Only mid-stream `"steer"` is skipped. (PRD §12.2.)
```

## Implementation Blueprint

### Data models and structure

No new data models. The handler consumes `InputEvent` (from Pi) and `injectFiles`'s return
`{text, images, injected}`, and produces an `InputEventResult` (`continue` or `transform`). The only
"model" is the return shape, which is dictated by `InputEventResult` (dist:629, quoted above).

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT ./file-injector.ts (in-place; file already exists, fully populated by prior subtasks)
  - OBJECTIVE: Replace the factory stub body with the real input handler + add a Mode-A JSDoc.
  - EDIT (a) — REPLACE the stub body. Find this EXACT block:
        export default function (pi: ExtensionAPI) {
          pi.on("input", async (event, ctx) => {
            return { action: "continue" };
          });
        }
    and replace it with the JSDoc + real handler from "Exact source to write" below.
  - WRITE: the JSDoc + handler VERBATIM from the block below.
  - FOLLOW pattern: PRD §9 pseudocode + Appendix A (the authoritative handler) + extension_patterns.md §3
        (input-transform-streaming.ts steer guard, input-transform.ts source guard, inline-bash.ts
        hasUI-guarded notify).
  - NAMING: the handler is an anonymous arrow inside pi.on("input", ...). No new named symbols.
  - CONSUMES (already present — do NOT redefine): injectFiles (T3.S1), ExtensionAPI type (T1.S1 import).
  - NEW IMPORTS: NONE. NEW HELPERS: NONE. NEW CONSTANTS: NONE.
  - PLACEMENT: the factory stays at the END of the file (below injectFiles). The JSDoc goes directly
        above `export default function`.
  - DO NOT (out of scope — owned elsewhere):
      - touch injectFiles, the helpers (cleanToken/expandTildeAndResolve/extOf/isBinary/format*Block),
        the constants (FILE_INJECT_RE/MIME_BY_EXT/TRAILING_PUNCT), or any import line.
      - add a try/catch wrapper around injectFiles (it never throws; PRD §12.5).
      - add a size gate / config / truncation (PRD §2 Non-Goals, §12.11, §13).
      - create README.md (P1.M2.T5.S1) or run the 14-case manual matrix (P1.M2.T4.S1).
```

### Exact source to write (authoritative — copy verbatim, then run the validation gates)

Replace the entire current factory block (stub) with this:

```typescript
/**
 * #@file — Whole-File Injection Extension for Pi.
 *
 * Lets a user attach an ENTIRE file to their prompt by writing `#@<path>` anywhere in the submitted
 * text. On the `input` event — which fires inside `AgentSession.prompt()` for ALL input contexts
 * (interactive TUI messages, the initial CLI / `-p` / RPC message, and RPC calls alike) — every
 * `#@<path>` token is resolved, the whole file is read, and its contents are appended to the prompt in
 * Pi-native `<file name="...">...</file>` blocks below a `---` separator. Image files are attached as
 * `ImageContent` (resized to provider limits) plus a reference block; non-image binaries get a clear
 * note instead of decoded garbage.
 *
 * Trigger syntax:  `#@<path>`  — e.g. `#@src/index.ts`, `#@~/notes.md`, `#@pic.png`,
 *                  `(#@a.txt and #@b.md)`. The two-char `#@` trigger is collision-free with Pi's
 *                  `@file` / `@mention`, markdown `#` headings, issue `#1234`, and `user@host` email.
 *
 * Works everywhere: interactive, `pi -p "...#@file..."`, and RPC — because the hook is the `input`
 * event inside `prompt()`, not argv parsing (unlike Pi's built-in `@file` CLI expansion).
 *
 * No limits, no config: the whole file is injected every time — no truncation, no word / byte cap.
 * Large files may blow the model's context; that is the documented, intended behavior. Images are
 * downscaled (2000×2000) only because providers reject oversized images; the whole image is still
 * delivered (downscaled to fit). The handler short-circuits (`continue`) when the input originated
 * from an extension (loop prevention), is a mid-stream steering nudge (latency), or simply has no `#@`
 * token — and it never throws (injectFiles isolates each file in its own try/catch).
 */
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" }; // MANDATORY loop prevention (§12.1)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // skip mid-stream steering for latency (§12.2)
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1)

    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} file(s)`, "info"); // user feedback; guarded for print/json headless modes (api_verification §5)
    return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images
  });
}
```

**Why every line is exactly this:**

| Element | Rationale & source |
|---|---|
| `if (event.source === "extension") return { action: "continue" };` (FIRST) | **Loop prevention — MANDATORY.** A re-entrant extension message that re-feeds `#@` would loop infinitely without this. Must precede all regex/IO. Mirrors `input-transform.ts`. PRD §12.1, item §1a. |
| `if (event.streamingBehavior === "steer") return { action: "continue" };` | **Latency during steering.** Mid-stream corrections should be fast; file I/O + resizeImage Worker would delay them. Mirrors `input-transform-streaming.ts`. `"followUp"` / `undefined` proceed. PRD §12.2, item §1b. |
| `if (!event.text?.includes("#@")) return { action: "continue" };` | **Cheap pre-check.** `String.includes` is far cheaper than the regex + I/O; skips the 99% no-`#@` case. `?.` is defensive (text is typed `string`); matches PRD §9 verbatim. PRD §12.4, item §1c. |
| `const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);` | The single delegation. `event.images ?? []` because `images?` is optional. `ctx` satisfies the `{cwd:string}` param structurally (ctx.cwd verified). Returns `injected` as a COUNT. |
| `if (!injected) return { action: "continue" };` | `injected===0` ⇒ no valid file resolved (missing/dir/read-error all handled inside injectFiles by leaving tokens verbatim). Returning `continue` preserves the prompt **byte-for-byte** (no spurious transform). PRD §10 row 1, item §3. |
| `if (ctx.hasUI) ctx.ui.notify(\`#@ injected ${injected} file(s)\`, "info");` | User feedback. **Guarded by `ctx.hasUI`** for print/json headless modes. 2nd arg is `type:"info"` (NOT `level`). Message format matches PRD §11 test #9 ("notify says `2 file(s)`"). api_verification §5. |
| `return { action: "transform" as const, text, images };` | Rewrite the prompt. `text`/`images` are forwarded verbatim from injectFiles — `images` is the MERGED array (`[...imagesIn]` + appended), so user-attached images survive the runner's array-REPLACE semantics. `as const` is type-only (jiti strips it); kept to match PRD §9. |

### Implementation Patterns & Key Details

```typescript
// PATTERN (guard cascade): the handler is a flat sequence of early returns. Each guard is a single
// throw-free comparison returning {action:"continue"}. Only the LAST path (injected>0) does real work
// (notify + transform). This is the cheapest possible happy/sad-path routing and matches the canonical
// Pi input-handler examples (inline-bash.ts, input-transform*.ts) exactly.

// PATTERN (delegation, not re-implementation): the handler does NO file I/O, regex, or formatting itself.
// injectFiles owns ALL of that (and its 45-assertion gate in T3.S1 proves it). The handler is purely:
// gate → delegate → translate the count into a continue/transform + a notify. Keep it that way — adding
// file logic here would duplicate T3.S1 and split the test surface.

// PATTERN (notify-on-success-only): notify fires ONLY on the success path (injected>0) AND only when
// ctx.hasUI. Every continue path (all 4 of them) skips notify. This keeps headless modes silent and
// avoids notify spam for prompts that had no #@ or whose #@ tokens all missed.

// GOTCHA (continue vs transform array semantics): returning {action:"continue"} does NOT touch the
// images array (runner keeps prior). Returning {action:"transform", images} REPLACES it — which is why
// injectFiles seeds [...imagesIn] and the handler forwards that exact array. Never construct a fresh
// images array in the handler; always use the one injectFiles returned. (system_context.md "Image Array
// Merging".)

// GOTCHA (no wrapper): do NOT add try { ... } catch around the injectFiles call. injectFiles never
// throws (T3.S1 contract). The guards can't throw. A wrapper is dead code and diverges from PRD §9.
```

### Integration Points

```yaml
MODULE file-injector.ts (in-place edit; no build step):
  - edit: "Replace the factory stub body + add JSDoc above `export default function`."
  - new_imports: NONE. ExtensionAPI + injectFiles + ImageContent are already in module scope.
  - concurrency: "The factory stub is the unique stable anchor. T3.S1 inserts injectFiles ABOVE the
    factory without touching it, so the stub is byte-identical whether or not T3.S1 has landed. Anchor
    on the stub verbatim; no merge conflict with T3.S1."

NO DATABASE / NO CONFIG / NO ROUTES / NO NEW ENV VARS / NO NEW FILES:
  - "Pure handler wiring. No user-facing config surface. (PRD §2 Non-Goals: no config.)"

DOWNSTREAM CONSUMERS (do NOT implement now — the handler just has to be correct for them):
  - P1.M2.T4.S1 manual acceptance matrix (#1-#14) — the extension is now fully functional; the matrix
        exercises this handler end-to-end with a real provider.
  - P1.M2.T5.S1 README — documents this public-facing entry point (the JSDoc is the README's source).
```

## Validation Loop

> This project has **no test framework, no linter, no type-checker** (greenfield single-file jiti
> extension). The `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. Use the gates below —
> TypeScript/Pi-specific, **verified working on this machine**, requiring **no model/API key**. The
> handler is tested by capturing the `on("input", cb)` callback through a mock `pi` and invoking it with
> synthetic `InputEvent` objects + a mock `ctx` (cwd, hasUI, ui.notify recorder). `injectFiles` does real
> I/O, so the gate creates ONE real temp file + one missing path.

### Level 1: Syntax & Placement (Immediate Feedback)

```bash
cd /home/dustin/projects/pi-file-injector

# 1a. The 3 guards are present, in order.
grep -nE 'event\.source === "extension"' file-injector.ts | grep -q continue && echo "OK guard A" || echo "FAIL guard A"
grep -nE 'event\.streamingBehavior === "steer"' file-injector.ts | grep -q continue && echo "OK guard B" || echo "FAIL guard B"
grep -nE '!event\.text\?\.includes\("#@"\)' file-injector.ts | grep -q continue && echo "OK guard C" || echo "FAIL guard C"

# 1b. injectFiles call + injected check + notify + transform return all present.
grep -qE 'await injectFiles\(event\.text, event\.images \?\? \[\], ctx\)' file-injector.ts && echo "OK injectFiles call" || echo "FAIL injectFiles call"
grep -qE 'if \(!injected\) return \{ action: "continue" \}' file-injector.ts && echo "OK injected check" || echo "FAIL injected check"
grep -qE 'if \(ctx\.hasUI\) ctx\.ui\.notify\(`#@ injected \$\{injected\} file\(s\)`, "info"\)' file-injector.ts && echo "OK notify" || echo "FAIL notify"
grep -qE 'return \{ action: "transform" as const, text, images \}' file-injector.ts && echo "OK transform" || echo "FAIL transform"

# 1c. The stub is GONE (no bare `return { action: "continue" };` immediately under pi.on).
#     (The injected===0 `continue` has a leading `if (!injected)`, so the bare stub line must be absent.)
grep -nE '^\s+return \{ action: "continue" \};\s*$' file-injector.ts | wc -l | grep -q '^0$' \
  && echo "OK stub removed" || echo "WARN: check for leftover bare stub line"

# 1d. JSDoc is present directly above the factory (Mode A).
JSDOC=$(grep -nE '^\s*\* ' file-injector.ts | tail -1 | cut -d: -f1)
FACTORY=$(grep -nE '^export default function \(pi: ExtensionAPI\)' file-injector.ts | cut -d: -f1)
[ -n "$JSDOC" ] && [ -n "$FACTORY" ] && [ "$JSDOC" -lt "$FACTORY" ] \
  && echo "OK JSDoc above factory ($JSDOC < $FACTORY)" || echo "FAIL JSDoc placement"

# 1e. No try/catch wrapper was added around the injectFiles call (out of scope; injectFiles never throws).
awk '/await injectFiles\(/{f=1} f&&/^\s*\}\s*catch/{print "WRAP";f=0} f&&/return \{ action:/{f=0}' file-injector.ts | grep -q WRAP \
  && echo "FAIL: unwanted try/catch wrapper" || echo "OK no wrapper"

# 1f. Prior work intact (injectFiles + all helpers + constants + imports untouched).
[ "$(grep -cE '^export async function injectFiles' file-injector.ts)" = "1" ] && echo "OK injectFiles intact" || echo "FAIL injectFiles"
[ "$(grep -cE '^import ' file-injector.ts)" = "6" ] && echo "OK 6 imports" || echo "FAIL import count"
# Expected: guards OK, injectFiles/notify/transform OK, stub removed, JSDoc above factory, no wrapper,
#           injectFiles intact, 6 imports.
```

### Level 2: jiti Transpile + Handler Assertion Suite (PRIMARY GATE)

Replicates Pi's loader (`jiti.import` with package aliases), imports the `default` factory, registers it
against a MOCK `pi` that captures the `on("input", handler)` callback, then invokes that callback with
synthetic events + a mock `ctx` (cwd, hasUI, ui.notify recorder). Creates ONE real temp file + one missing
path. Asserts all 11 guard/return/notify scenarios. No model, no API key, non-interactive.

```bash
cd /home/dustin/projects/pi-file-injector
cat > /tmp/gate_t3s2.mjs <<'GATE'
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./file-injector.ts").href);

let pass = 0, fail = 0;
const T = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("FAIL:", name); } };

// --- capture the handler via a mock pi ---
T("default export is function", typeof mod.default === "function");
let inputHandler = null;
const pi = { on(event, handler) { if (event === "input") inputHandler = handler; } };
mod.default(pi);
T("handler captured via on('input')", typeof inputHandler === "function");

// --- temp sandbox: ONE real file + (missing path is implicit) ---
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "hnd-"));
const abs = (rel) => path.resolve(cwd, rel);
await fs.writeFile(abs("note.txt"), "hello world");
await fs.writeFile(abs("two.md"), "second file body");

// mock ctx factory with a notify recorder
const makeCtx = (hasUI) => {
  const notifies = [];
  return { cwd, hasUI, ui: { notify: (m, t) => notifies.push([m, t]) }, _notifies: notifies };
};
const r = async (event, hasUI = true) => {
  const ctx = makeCtx(hasUI);
  const res = await inputHandler(event, ctx);
  return { res, ctx };
};

try {
  // 1. source="extension" + text with #@ => continue (guard A wins), NO notify, NO file IO observable
  const { res, ctx } = await r({ type: "input", text: "x #@note.txt", images: [], source: "extension" });
  T("ext-source continue", res?.action === "continue");
  T("ext-source no notify", ctx._notifies.length === 0);

  // 2. streamingBehavior="steer" + text with #@ => continue (guard B), no notify
  const s2 = await r({ type: "input", text: "x #@note.txt", images: [], source: "interactive", streamingBehavior: "steer" });
  T("steer continue", s2.res?.action === "continue");
  T("steer no notify", s2.ctx._notifies.length === 0);

  // 3. no "#@" in text => continue (guard C), no notify
  const s3 = await r({ type: "input", text: "Review @note.txt and # Heading", images: [], source: "interactive" });
  T("no-#@ continue", s3.res?.action === "continue");
  T("no-#@ no notify", s3.ctx._notifies.length === 0);

  // 4. "#@note.txt" => transform; text has <file> block + original marker; notify fires once "info"
  const s4 = await r({ type: "input", text: "Review #@note.txt", images: [], source: "interactive" });
  T("valid transform", s4.res?.action === "transform");
  T("valid text has <file", typeof s4.res.text === "string" && s4.res.text.includes("<file name="));
  T("valid marker preserved", s4.res.text.startsWith("Review #@note.txt"));
  T("valid has --- separator", s4.res.text.includes("\n\n---\n\n"));
  T("valid images array", Array.isArray(s4.res.images));
  T("valid notify once", s4.ctx._notifies.length === 1);
  T("valid notify message", s4.ctx._notifies[0][0] === "#@ injected 1 file(s)");
  T("valid notify type info", s4.ctx._notifies[0][1] === "info");

  // 5. "#@nonexistent" => continue (injected 0), no notify
  const s5 = await r({ type: "input", text: "Fix #@nope.ts", images: [], source: "interactive" });
  T("missing continue", s5.res?.action === "continue");
  T("missing no notify", s5.ctx._notifies.length === 0);
  T("missing text verbatim", s5.res === undefined || s5.res?.action === "continue"); // continue has no text field

  // 6. two valid files => transform; notify "2 file(s)"
  const s6 = await r({ type: "input", text: "Diff #@note.txt vs #@two.md", images: [], source: "interactive" });
  T("multi transform", s6.res?.action === "transform");
  T("multi notify count 2", s6.ctx._notifies[0][0] === "#@ injected 2 file(s)");

  // 7. hasUI=false + valid file => transform (still injects) but NO notify
  const s7 = await r({ type: "input", text: "Review #@note.txt", images: [], source: "interactive" }, false);
  T("headless transform", s7.res?.action === "transform");
  T("headless no notify", s7.ctx._notifies.length === 0);

  // 8. bare @file (no #@) => continue (non-interference, §11 #14)
  const s8 = await r({ type: "input", text: "Review @note.txt", images: [], source: "interactive" });
  T("bare-@ continue", s8.res?.action === "continue");

  // 9. mid-word foo#@bar => continue (regex no-match => injected 0, §11 #7)
  const s9 = await r({ type: "input", text: "the foo#@bar thing", images: [], source: "interactive" });
  T("midword continue", s9.res?.action === "continue");
  T("midword no notify", s9.ctx._notifies.length === 0);

  // 10. source="rpc" + valid file => transform (rpc is allowed; only "extension" is gated)
  const s10 = await r({ type: "input", text: "Review #@note.txt", images: [], source: "rpc" });
  T("rpc transform", s10.res?.action === "transform");
  T("rpc notify fires", s10.ctx._notifies.length === 1);

  // 11. followUp (not steer) + valid file => transform (followUp proceeds)
  const s11 = await r({ type: "input", text: "Review #@note.txt", images: [], source: "interactive", streamingBehavior: "followUp" });
  T("followUp transform", s11.res?.action === "transform");

  // 12. user-attached image preserved on transform (merge contract surfaces through the handler)
  const userImg = { type: "image", data: "USER_B64", mimeType: "image/png" };
  const s12 = await r({ type: "input", text: "Review #@note.txt", images: [userImg], source: "interactive" });
  T("merge transform", s12.res?.action === "transform");
  T("merge user image preserved", Array.isArray(s12.res.images) && s12.res.images[0] === userImg);
} finally {
  await fs.rm(cwd, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
GATE
node /tmp/gate_t3s2.mjs
# Expected: "NN passed, 0 failed", exit 0. (~24 assertions.)
# If any FAIL: READ the failure name, compare against the exact-source block + the guard matrix in
# research §7, fix, re-run.
```

### Level 3: Authoritative Pi Loader (System Validation — optional confidence)

```bash
cd /home/dustin/projects/pi-file-injector
# Confirms Pi's REAL loader (with its real getAliases()) accepts the edited file and the factory is valid.
# -e loads the extension; -ne disables discovery so ONLY our -e file loads; -p makes it non-interactive.
# NOTE: with the REAL handler in place, a "#@<file>" prompt is now ACTUALLY injected (unlike T3.S1's stub).
#       A provider is needed for the model turn AFTER load; a provider error after load does NOT indicate
#       a handler failure. Use this only for final confidence if a provider is configured.
pi -e ./file-injector.ts -ne -p "load check #@note.txt" 2>&1 | tee /tmp/pi_t3s2.log
grep -qiE "does not export a valid factory|syntax error|is not defined|cannot find module" /tmp/pi_t3s2.log \
  && echo "FAIL: load error above" || echo "OK: no load error"
# Expected: no "does not export a valid factory function" / syntax / import errors.
# (Level 2 already proves load + handler behavior; this is end-to-end confidence only.)
```

### Level 4: Cross-Subtask State Check (S1+S2+T2.S1+T3.S1+T3.S2 coexist)

After editing, the file must still contain ALL prior work — none clobbered — plus the new handler + JSDoc.

```bash
cd /home/dustin/projects/pi-file-injector
echo "--- S1 constants ---"
grep -cE '^const (FILE_INJECT_RE|MIME_BY_EXT|TRAILING_PUNCT)' file-injector.ts        # Expected: 3
echo "--- S2 helpers ---"
grep -cE '^export function (cleanToken|expandTildeAndResolve|extOf)' file-injector.ts  # Expected: 3
echo "--- T2.S1 helpers ---"
grep -cE '^export function (isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock)' file-injector.ts  # Expected: 4
echo "--- T3.S1 core ---"
grep -cE '^export async function injectFiles' file-injector.ts                         # Expected: 1
echo "--- T3.S2 handler markers ---"
grep -cE 'event\.source === "extension"|streamingBehavior === "steer"|ctx\.ui\.notify|action: "transform" as const' file-injector.ts  # Expected: 4
echo "--- factory present ---"
grep -cE '^export default function \(pi: ExtensionAPI\)' file-injector.ts              # Expected: 1
# Expected: 3, 3, 4, 1, 4, 1.
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: 3 guards present + ordered; injectFiles call / injected check / notify / transform present;
      stub removed; JSDoc above factory; no try/catch wrapper; injectFiles intact; 6 imports.
- [ ] Level 2: jiti gate prints `NN passed, 0 failed` (~24 assertions), exit 0.
- [ ] Level 3 (optional, if provider configured): no load error in `pi -e ... -p` output.
- [ ] Level 4: S1 (3) + S2 (3) + T2.S1 (4) + T3.S1 (1) + T3.S2 handler markers (4) + factory (1) coexist.

### Feature Validation
- [ ] `source==="extension"` → `continue`, no notify (loop prevention).
- [ ] `streamingBehavior==="steer"` → `continue`, no notify (latency).
- [ ] no `#@` substring (incl. bare `@file`, `# Heading`, `#1234`) → `continue`, no notify.
- [ ] `#@validfile` → `transform` with `<file>` block appended after `---`; original marker preserved;
      notify `#@ injected 1 file(s)` with type `info`.
- [ ] `#@nonexistent` / directory / all-miss → `continue` (injected 0); prompt byte-for-byte unchanged.
- [ ] multiple valid files → notify count matches; `transform`.
- [ ] `hasUI===false` (print/json) → still `transform`, but notify NOT called.
- [ ] `source==="rpc"` and `streamingBehavior==="followUp"` → proceed normally (only "extension"/"steer" gated).
- [ ] user-attached images preserved through the handler into the `transform` result (merge contract).

### Code Quality Validation
- [ ] Handler is a flat guard cascade (3 early returns) → delegate → count-check → notify → transform.
- [ ] Guard order exactly: `source` → `streamingBehavior` → `includes("#@")` (item §1, PRD §9).
- [ ] `event.images ?? []`; `if (!injected)`; `ctx.hasUI` guard; `type:"info"`; `as const` on transform.
- [ ] No try/catch wrapper around `injectFiles` (it never throws).
- [ ] No new imports / helpers / constants / files; no edits to prior regions.
- [ ] JSDoc at column 1 directly above the factory; covers all 4 Mode-A points.

### Documentation & Deployment
- [ ] No new env vars, config, or user-facing surface beyond the JSDoc (PRD §2: no config).
- [ ] JSDoc documents: purpose, `#@<path>` syntax, all-input-context support, no-limits/no-config.
- [ ] Inline comments cite PRD §12.1/§12.2/§12.4 and api_verification §5 (for the implementer & reviewer).

---

## Anti-Patterns to Avoid

- ❌ Don't reorder the guards — `source==="extension"` MUST be first (loop prevention beats latency beats
  cheap-check). PRD §9 + item §1 fix the order. (A re-entrant extension message must short-circuit before
  any regex/IO, regardless of steer state.)
- ❌ Don't pass `event.images` without `?? []` — `images?` is optional; `undefined` would make
  injectFiles's `[...imagesIn]` throw. Always `event.images ?? []`.
- ❌ Don't treat `injected` as a boolean — it's a COUNT. `if (!injected)` (0 = falsy) is correct;
  `injected === true` is always false and would break every `#@validfile` prompt.
- ❌ Don't call `ctx.ui.notify` without the `ctx.hasUI` guard — print/json modes are headless. And don't
  call notify on any `continue` path (only on injected>0).
- ❌ Don't pass `"level"` or omit the notify `type` — the param is named `type`, constrained to
  `"info"|"warning"|"error"`. Pass the literal `"info"`.
- ❌ Don't construct a fresh `images` array in the handler — forward the exact `{text, images}` from
  `injectFiles`. It already merged user images (`[...imagesIn]`); rebuilding the array would drop them
  (runner REPLACES the array on transform-with-images).
- ❌ Don't add a try/catch wrapper around `injectFiles` — it never throws (T3.S1 contract, PRD §12.5). The
  guards are throw-free. A wrapper is dead code that diverges from PRD §9 / Appendix A.
- ❌ Don't re-implement file logic in the handler — injectFiles owns ALL I/O, regex, and formatting. The
  handler is gate → delegate → translate-count → notify.
- ❌ Don't omit the JSDoc (Mode A is a required deliverable) — it's the public-facing entry point and the
  source for the future README (P1.M2.T5.S1). Cover all 4 points (purpose, `#@<path>` syntax,
  all-context, no-limits/no-config).
- ❌ Don't touch `injectFiles`, the helpers, the constants, or the imports — this task changes ONLY the
  factory body + adds the JSDoc.
- ❌ Don't add any size gate, truncation, word count, or byte cap — "the whole file, every time" is the
  defining behavior (PRD §5.1, §12.11, §13).
- ❌ Don't create a README or run the 14-case manual matrix — those are P1.M2.T5.S1 / P1.M2.T4.S1.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: The handler is ~7 lines copied verbatim from PRD §9 / Appendix A, and every contract it depends
on is **verified against dist with `path:line` evidence**: `InputEvent.source`/`streamingBehavior`/`text`/
`images?` (types.d.ts:615-626), `InputEventResult` `continue`/`transform{text,images?}` (629),
`on("input", (event,ctx)=>InputEventResult)` (872), `ctx.hasUI`/`ctx.cwd` (214/216/388),
`ctx.ui.notify(message, type?: "info"|"warning"|"error")` (75 — the `type`-not-`level` gotcha). The 3
guards each trace to a canonical Pi example extension (input-transform.ts source guard,
input-transform-streaming.ts steer guard) + a PRD §12 note. The consumed `injectFiles` is ALREADY present
in the file (T3.S1 landed) with a 45-assertion green gate, so the handler's only job is wiring. The edit
anchor (the factory stub) is unique and stable under T3.S1's parallel insert. The Level-2 gate captures the
handler via a mock `pi.on("input")` + mock `ctx` recorder and asserts all 11 guard/return/notify scenarios
plus the merge-contract pass-through — fully model-free. Residual 0.5 risk is a transcription slip
(missing `?? []`, dropping `ctx.hasUI`, wrong guard order, or forgetting the JSDoc) — all fully caught by
Level 1 grep + the ~24-assertion Level 2 gate.
