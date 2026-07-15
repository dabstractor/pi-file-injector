# Research Notes — P1.M1.T3.S2: Input Event Handler (replace factory stub)

> Subtask: replace the `pi.on("input", ...)` factory **stub body** in `./sharp-at-file.ts` with the real
> handler: 3 short-circuit guards → `injectFiles` call → `notify` (hasUI-guarded) → `transform`/`continue`.
> Also add a Mode-A JSDoc above the factory. This is the **final wiring subtask** — after it, the
> extension is fully functional and testable end-to-end.

All claims below are **verified against the installed dist** (`@earendil-works/pi-coding-agent`) and the
actual current state of `sharp-at-file.ts` (which already contains `injectFiles` from T3.S1 + all
S1/S2/T2.S1 helpers). Path:line evidence throughout.

---

## §1. Verified contracts (dist `.d.ts`, read directly)

### InputEvent — `dist/core/extensions/types.d.ts:615-626`
```ts
export type InputSource = "interactive" | "rpc" | "extension";          // line 615
export interface InputEvent {                                           // line 617
    type: "input";
    text: string;
    images?: ImageContent[];
    source: InputSource;                                                // line 624 — NON-optional
    streamingBehavior?: "steer" | "followUp";                           // line 626 — optional
}
```
→ The three guard conditions reference **real, exact field names**: `event.source`, `event.streamingBehavior`,
`event.text`. `source` is required (never `undefined`); `streamingBehavior` is optional (so `=== "steer"`
is false when absent → correct). `images?` is optional → `event.images ?? []` is correct.

### InputEventResult — `dist/core/extensions/types.d.ts:629-...`
```ts
export type InputEventResult =
  | { action: "continue" }
  | { action: "transform"; text: string; images?: ImageContent[] }
  | { action: "handled" };
```
→ The handler returns EITHER `{action:"continue"}` (3 guards + `injected===0`) OR
`{action:"transform", text, images}` (injected>0). `transform` with `images` **present** REPLACES the
image array in the runner (system_context.md "Image Array Merging"), but `injectFiles` already seeds
`[...imagesIn]` so the returned `images` is the full merge — nothing extra to do in the handler.

### on("input") registration — `dist/core/extensions/types.d.ts:872`
```ts
on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
```
`ExtensionHandler<E,R> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void`.
→ Our `async (event, ctx) => InputEventResult` handler shape is exactly correct.

### ExtensionContext — `dist/core/extensions/types.d.ts:214, 216, 388-389`
```ts
hasUI: boolean;              // line 214 / 388 — true in TUI + RPC only; false in print/json
cwd: string;                 // line 216
ui: Pick<ExtensionUIContext, "select" | "confirm" | "input" | "notify">;  // line 389
```
→ `ctx.hasUI` and `ctx.cwd` are exactly as the PRD/item describe. `ctx.ui` is always present (even in
print/json), but the architecture mandates **guarding `ctx.ui.notify` with `ctx.hasUI`** because print/json
modes are headless (notify is meaningless / could be a no-op or undefined-behavior path there).
api_verification.md §5: "hasUI is true in TUI and RPC modes only."

### ui.notify — `dist/core/extensions/types.d.ts:75`
```ts
notify(message: string, type?: "info" | "warning" | "error"): void;
```
→ 2nd arg is named **`type`** (NOT `level`), constrained to `"info" | "warning" | "error"`. Our call
`ctx.ui.notify(\`#@ injected ${injected} file(s)\`, "info")` is exactly correct.

---

## §2. The three guards — rationale + verified reference examples

### Guard A — `if (event.source === "extension") return { action: "continue" };`  (MANDATORY, loop prevention)
- **Why:** If ANY extension (including this one, via `pi.sendUserMessage` or a command handler that re-feeds
  the transformed text) emits an input event whose text again contains `#@`, the handler would re-run and
  re-inject → **infinite loop**. PRD §12.1: "Loop prevention is mandatory."
- **Reference:** `examples/extensions/input-transform.ts` demonstrates this exact guard as a re-entrancy
  bypass ("prevents an extension that re-injects a message from looping"). extension_patterns.md §3 / line 203.
- **Must be FIRST** (before steer and pre-check): a re-entrant extension message must short-circuit before
  ANY regex/IO work, regardless of steer state. The item description orders it first. PRD §9 pseudocode
  puts it first too.

### Guard B — `if (event.streamingBehavior === "steer") return { action: "continue" };`  (latency during steering)
- **Why:** `streamingBehavior === "steer"` = a mid-stream correction nudge. Latency-sensitive. Injecting
  files (stat + read + resizeImage Worker spawn) would delay the correction. PRD §12.2.
- **Reference:** `examples/extensions/input-transform-streaming.ts` — the canonical steer-skip pattern.
  Its handler's FIRST check is `if (event.streamingBehavior === "steer") return { action: "continue" };`
  (extension_patterns.md §3, lines 159-162). `"followUp"` and `undefined` (idle) are PROCESSED normally.
- **Note on ordering:** The item description orders B AFTER A (source guard first). `input-transform-streaming.ts`
  has steer first, but that extension has no source guard. Our handler needs BOTH; per the item description
  and PRD §9, **A (source) → B (steer) → C (pre-check)**. Both orderings are safe for correctness, but the
  item description + PRD §9 are the contract — follow them verbatim.

### Guard C — `if (!event.text?.includes("#@")) return { action: "continue" };`  (cheap pre-check)
- **Why:** Most prompts have no `#@`. `String.includes` is far cheaper than running the regex + doing I/O.
  PRD §12.4. `?.` is defensive (text is typed `string`, never undefined, but the PRD pseudocode uses `?.` —
  harmless). This guard runs AFTER A and B so it never even runs for the re-entrant/steer cases.

---

## §3. The current factory stub — EXACT edit anchor (read from sharp-at-file.ts)

The file `sharp-at-file.ts` currently ends with (verified — this is T1.S1's stub, untouched by S1/S2/T2.S1/T3.S1):

```ts
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```

**T3.S2 replaces the handler BODY and adds a JSDoc above `export default function`.** Everything else in the
file (6 imports, 3 constants, 3 S2 helpers, 4 T2.S1 helpers, `injectFiles`) is UNTOUCHED.

### Concurrency safety (T3.S1 runs in parallel)
- T3.S1's edit inserts `export async function injectFiles(...)` **immediately before** the factory line.
  It does NOT touch the factory stub. → The factory stub is a **stable edit anchor** regardless of whether
  T3.S1 has landed yet. T3.S2 can anchor on the stub body verbatim; the JSDoc lands above
  `export default function (pi: ExtensionAPI) {` which is unique in the file.
- No risk of clobbering `injectFiles`: T3.S2 does not insert/delete near it.

---

## §4. The exact replacement body (from PRD §9 + Appendix A + item description)

```ts
if (event.source === "extension") return { action: "continue" };
if (event.streamingBehavior === "steer") return { action: "continue" };
if (!event.text?.includes("#@")) return { action: "continue" };

const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
if (!injected) return { action: "continue" };

if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} file(s)`, "info");
return { action: "transform" as const, text, images };
```

### Why each line is exactly this
| Line | Rationale |
|---|---|
| `event.source === "extension"` | Loop prevention — MANDATORY (PRD §12.1). Must be first (item §1a). |
| `event.streamingBehavior === "steer"` | Latency skip (PRD §12.2). `"followUp"`/`undefined` proceed. |
| `!event.text?.includes("#@")` | Cheap pre-check before regex/IO (PRD §12.4). `?.` defensive, matches PRD §9 verbatim. |
| `injectFiles(event.text, event.images ?? [], ctx)` | `images?` optional → `?? []`. `ctx` satisfies the `{cwd:string}` param structurally (ctx.cwd verified §1). |
| `if (!injected) return continue` | `injected` is a count (T3.S1 contract); `0` is falsy → "nothing injected" → preserve prompt byte-for-byte (PRD §10 row 1). |
| `if (ctx.hasUI) ctx.ui.notify(...)` | Guard for print/json headless modes (api_verification §5). `type:"info"` (not "level"). |
| `` `#@ injected ${injected} file(s)` `` | Exact message per item §3 + PRD §11 test #9 ("notify says `2 file(s)`"). |
| `return { action: "transform" as const, text, images }` | Rewrite prompt + merged images. |

### `as const` — type-only annotation (no runtime effect under jiti)
`{ action: "transform" as const, text, images }` — the `as const` is a TypeScript-level narrowing so the
object literal's `action` property is typed the literal `"transform"` (satisfying `InputEventResult`).
**jiti is transpile-only** — it strips the `as const` at load time, so it has **zero runtime effect**.
Whether present or absent, runtime behavior is identical. We KEEP it to match PRD §9 / Appendix A verbatim
and to document intent; its absence would NOT cause a runtime failure (only a type error, which jiti never
checks). **Do not "fix" a reviewer who drops it, but write it per the PRD.**

### No try/catch wrapper in the handler (by design)
`injectFiles` ALREADY guarantees "never throws" — each file's stat/read/resize is isolated in its own
try/catch (T3.S1 contract, PRD §12.5). The guards are simple value comparisons that cannot throw. So the
handler needs NO additional try/catch. PRD §9 and Appendix A do NOT wrap the call. The runner would
swallow a throw anyway (system_context.md "Input Event Dispatch Internals"), but the contract is
"injectFiles never throws" so a wrapper is dead code. **Do not add one.**

---

## §5. JSDoc (Mode A) — what the public-facing entry point must document

Item §5 (DOCS): "Add a JSDoc comment block above `export default function` describing: the extension
purpose, the `#@<path>` trigger syntax, that it works in all input contexts (interactive/CLI/RPC), and that
there are no size limits or configuration."

Required content (all four points, Mode A = JSDoc `/** ... */`):
1. **Purpose** — whole-file injection into the model's prompt via the `input` event.
2. **Trigger syntax** — `#@<path>` (e.g. `#@src/index.ts`, `#@~/notes.md`, `#@pic.png`); the `#@`
   two-char trigger; collision-free with `@file`/`@mention`/`#heading`/`#1234`/email.
3. **All input contexts** — interactive TUI, initial CLI/`-p` message, and RPC, because the hook is the
   `input` event inside `prompt()` (not argv parsing). This is THE key advantage (PRD §3.1).
4. **No limits / no config** — the whole file every time, no truncation/word/byte cap (PRD §13); images
   downscaled to 2000×2000 only because providers reject oversized images.

The JSDoc goes immediately above `export default function (pi: ExtensionAPI) {` (line-1 column-1).

---

## §6. Acceptance criteria mapping (handler-owned, from PRD §11)

| §11 test | Handler behavior that makes it pass |
|---|---|
| #1 `Review #@a.ts` → injected, no read tool call | guard C passes → injectFiles → `transform` with text containing `<file>` block |
| #2 `#@huge.log` (50 MB) → entire file | NO size gate anywhere (handler passes straight through) |
| #5 missing → token verbatim, unchanged | injectFiles returns `injected:0` → handler returns `continue` |
| #7 mid-word `foo#@bar` → no expansion | regex won't match → `injected:0` → `continue` |
| #8 `# Heading and #1234` → no expansion | guard C: no `#@` substring → `continue` |
| #9 multi → notify `2 file(s)` | injectFiles returns `injected:2` → notify fires with `2` |
| #12 `pi -p "...#@a.ts"` → injected | input event fires for initial `-p` message too (PRD §3.1) → handler runs |
| #14 `Review @a.ts` → no injection | guard C: `@a.ts` has no `#@` → `continue` |

T3.S1 owns the per-file format/dispatch (tests #1,3,4,6,10,11,13). T3.S2 owns the **gating + return shape +
notify**, which is exactly what makes #5/#7/#8/#9/#12/#14 pass.

---

## §7. Validation strategy (model-free, non-interactive)

This project has **no test framework / linter / type-checker** (greenfield single-file jiti extension).
The pytest/mypy/ruff gates from the base template DO NOT apply. Like T3.S1, use a jiti gate — but for the
**handler**, which means: import the `default` factory, register it against a MOCK `pi` that captures the
`on("input", handler)` callback, then invoke that callback with synthetic `InputEvent` objects + a mock
`ctx` (with `cwd`, `hasUI`, `ui.notify` recorder), and assert the returned `InputEventResult`.

This is clean, fast, deterministic, and requires **no model / API key**. The handler delegates all file I/O
to `injectFiles` (already 45-assertion green in T3.S1), so the handler gate needs only:
- ONE real temp file (valid injection path)
- ONE missing path (injected===0 → continue)
- synthetic events for the 3 guards + hasUI=false

~22 focused assertions. Pre-design below; the exact gate is in the PRP Validation Loop.

### Guard/return-shape matrix the gate must cover
1. `source:"extension"` + text with `#@` → `continue`, notify NOT called (guard A wins before C).
2. `streamingBehavior:"steer"` + text with `#@` → `continue`, notify NOT called (guard B).
3. no `#@` in text → `continue`, notify NOT called (guard C).
4. `#@validfile` → `transform`; `result.text` contains `<file name="...">`; `result.images` is an array;
   notify called once with `["#@ injected 1 file(s)", "info"]`.
5. `#@nonexistent` → `continue` (injected 0); notify NOT called.
6. two valid files → `transform`; notify message contains `2 file(s)`.
7. `hasUI:false` + `#@validfile` → `transform` (still injects) but notify NOT called.
8. bare `@file` (no `#@`) → `continue` (non-interference, §11 #14).
9. mid-word `foo#@bar` → `continue` (regex no-match → injected 0, §11 #7).
10. `source:"rpc"` + `#@validfile` → `transform` (rpc is allowed; only "extension" is gated).
11. `source:"interactive"` + `#@validfile` → `transform`.

---

## §8. Out-of-scope (owned by sibling/other tasks — do NOT implement)

- `injectFiles` body + all helpers/consts/imports — T1.S1/T1.S2/T2.S1/T3.S1 (DONE / in-flight). Consume only.
- README.md — P1.M2.T5.S1 (Planned). Do not create.
- The 14-case manual acceptance matrix end-to-end (needs a real model/provider) — P1.M2.T4.S1 (Planned).
- Any size gate, config, or truncation — explicitly a Non-Goal (PRD §2, §12.11, §13).
