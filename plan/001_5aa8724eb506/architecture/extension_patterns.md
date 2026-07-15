# Pi Extension Patterns — `#@file` Input-Injection Recon

Reference package: `@earendil-works/pi-coding-agent`
Package root: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`
Dist version line (for reference): compiled JS under `dist/`, source under `src/` (types only shipped as `.d.ts`).

All paths below are absolute into the installed package unless noted.

---

## 1. `inline-bash.ts` — the canonical input-event pattern to mirror

File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/inline-bash.ts` (read completely, 1–end).

It expands `!{command}` patterns inline before the prompt reaches the agent. This is the exact shape a `#@file` extension should follow.

### Structure (full file quoted in essence)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const PATTERN = /!\{([^}]+)\}/g;          // module-level regex (global flag)
  const TIMEOUT_MS = 30000;

  pi.on("input", async (event, ctx) => {
    const text = event.text;

    // (1) Bypass: preserve whole-line `!command` behavior.
    if (text.trimStart().startsWith("!") && !text.trimStart().startsWith("!{")) {
      return { action: "continue" };            // pass through unchanged
    }

    // (2) No-match fast path.
    if (!PATTERN.test(text)) {
      return { action: "continue" };
    }
    PATTERN.lastIndex = 0;                       // reset after test() (global regex)

    // (3) Collect all matches first, then replace (avoid mutate-while-iterate).
    const matches: Array<{ full: string; command: string }> = [];
    let match = PATTERN.exec(text);
    while (match) {
      matches.push({ full: match[0], command: match[1] });
      match = PATTERN.exec(text);
    }

    // (4) Execute each and splice output into the text.
    let result = text;
    const expansions = [];
    for (const { full, command } of matches) {
      try {
        const bashResult = await pi.exec("bash", ["-c", command], { timeout: TIMEOUT_MS });
        const trimmed = (bashResult.stdout || bashResult.stderr || "").trim();
        result = result.replace(full, trimmed);
        // ...record expansion status...
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result = result.replace(full, `[error: ${errorMsg}]`);
      }
    }

    // (5) Optional UI feedback guarded by ctx.hasUI.
    if (ctx.hasUI && expansions.length > 0) {
      ctx.ui.notify(`Expanded ${expansions.length} inline command(s):\n${summary}`, "info");
    }

    // (6) RETURN the transform. NOTE: it forwards event.images explicitly.
    return { action: "transform", text: result, images: event.images };
  });
}
```

### Key takeaways for `#@file`
- **Registration shape:** `export default function (pi: ExtensionAPI) { pi.on("input", async (event, ctx) => {...}) }`.
- **Handler signature:** `(event: InputEvent, ctx: ExtensionContext) => Promise<InputEventResult | void>`.
- **Three return shapes** (see `InputEventResult` in §7):
  - `{ action: "continue" }` — pass through (no-op).
  - `{ action: "transform", text, images? }` — replace text (and optionally images).
  - `{ action: "handled" }` — short-circuit the whole chain (agent turn skipped).
- **`images` forwarding:** `inline-bash` returns `images: event.images` to preserve any images the user already attached. A `#@file` extension that *adds* image attachments must return the **merged** image array, not just the originals.
- **Error handling:** per-match `try/catch`; failures are spliced inline as `[error: ...]` and the handler still returns `transform` (it never throws). The runner also wraps each handler in `try/catch` (§6), so a thrown error does not crash the input chain — it is logged as an extension error and the next handler runs on the *current* text.
- **Regex discipline:** when using the global flag (`/g`), call `PATTERN.lastIndex = 0` after `test()` and collect matches with repeated `.exec()` before mutating the string (the file models this exactly).
- **Process spawning:** `pi.exec(command, args, { cwd, timeout })` returns `{ stdout, stderr, code }`. For file reading, however, prefer `node:fs/promises` directly (the built-in `processFileArguments` does exactly this — see §2).

---

## 2. `processFileArguments` — the format `#@` must match for parity

File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.js` (read completely).
Type decl: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.d.ts`.

This is the built-in CLI `@file` handler. Called from `dist/main.js:100`:
```js
const { text, images } = await processFileArguments(parsed.fileArgs, { autoResizeImages });
```

### Signatures
```ts
export interface ProcessedFiles { text: string; images: ImageContent[]; }
export interface ProcessFileOptions { autoResizeImages?: boolean; }   // default true
export declare function processFileArguments(fileArgs: string[], options?: ProcessFileOptions): Promise<ProcessedFiles>;
```

### Exact template strings (verbatim from file-processor.js)

**TEXT files** (the `else` branch — anything that is not a supported image):
```js
const content = await readFile(absolutePath, "utf-8");
text += `<file name="${absolutePath}">\n${content}\n</file>\n`;
```
→ Output: `<file name="/abs/path.txt">\n<content>\n</file>\n`

**IMAGES** (supported: `image/jpeg`, `image/png` non-animated, `image/gif`, `image/webp`, `image/bmp` — see `dist/utils/mime.js`):
- The file bytes are decoded via `processImage(content, mimeType, { autoResizeImages })` (resized to ≤2000×2000) and pushed as an `ImageContent` attachment:
  ```js
  images.push({ type: "image", mimeType: processed.mimeType, data: processed.data });
  ```
- A *text placeholder* is always emitted alongside, carrying optional processing hints, or empty:
  ```js
  // with hints:
  text += `<file name="${absolutePath}">${processed.hints.join("\n")}</file>\n`;
  // without hints:
  text += `<file name="${absolutePath}"></file>\n`;
  ```
- Image processing failure emits an error text block (no image attachment):
  ```js
  text += `<file name="${absolutePath}">${processed.message}</file>\n`;
  ```

**BINARIES / empty files** (important nuance):
- There is **no explicit binary branch**. A binary file that is not a supported image type falls through to the **text** path: `await readFile(absolutePath, "utf-8")`. This will read raw bytes as UTF-8 (mojibake / replacement chars). `processFileArguments` does not detect or guard binary content.
- **Empty files are skipped entirely** (`if (stats.size === 0) continue;`) — no output, no error.
- **Missing files** → `console.error(chalk.red(...))` then `process.exit(1)`.

### Parity implications for `#@file`
| Case | `processFileArguments` does | `#@file` should mirror |
|---|---|---|
| Text file | `<file name="ABS">\n<content>\n</file>\n` | identical |
| Image (png/jpg/gif/webp/bmp) | push `ImageContent` + `<file name="ABS"></file>\n` placeholder | identical; must return images via `{ action:"transform", text, images }` |
| Empty file | skip silently | skip (do nothing) |
| Missing file | hard `process.exit(1)` | **do NOT** exit; surface `ctx.ui.notify(..., "error")` and skip / splice an error block |
| Binary | read as UTF-8 (unintended) | **decision needed**: either replicate (parity) or guard with a binary/NULL-byte check and emit an error block. Flagged as open question below. |

Note: `absolutePath` is the fully resolved absolute path (`resolve(resolveReadPath(fileArg, process.cwd()))`) — `resolveReadPath` handles `~` expansion and macOS screenshot Unicode spaces.

---

## 3. `input-transform-streaming.ts` — `streamingBehavior === "steer"` skip pattern

File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/input-transform-streaming.ts` (read completely).

Full body:
```ts
const TRIGGER = /\b(changes?|diff|modified)\b/i;

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event) => {
    // During steering, skip the exec call — corrections should be fast
    if (event.streamingBehavior === "steer") {
      return { action: "continue" };
    }

    if (!TRIGGER.test(event.text)) {
      return { action: "continue" };
    }

    const { stdout, code } = await pi.exec("git", ["diff", "--stat"]);
    if (code !== 0 || !stdout.trim()) {
      return { action: "continue" };
    }

    return {
      action: "transform",
      text: `${event.text}\n\nCurrent uncommitted changes:\n\`\`\`\n${stdout.trim()}\n\`\`\``,
    };
  });
}
```

### Skip / continue pattern for steering
- `event.streamingBehavior` is `"steer"` (mid-stream correction), `"followUp"` (queued), or `undefined` (idle). See `InputEvent.streamingBehavior` in §7.
- The canonical guard is the **first** check in the handler: `if (event.streamingBehavior === "steer") return { action: "continue" };`. This avoids expensive pre-processing when low latency matters and the user is just nudging the in-flight turn.
- The same file also demonstrates the full no-op cascade: no trigger match → `continue`; exec failure / empty output → `continue`. Only on success does it return `transform` (and note it does **not** pass `images` — they are preserved automatically by the runner's chaining, see §6).

**For `#@file`:** applying the same steer guard is the right default — injecting file contents mid-steer would delay a correction. (Confirm desired behavior; flagged as open question.)

---

## 4. ALL input-event extensions in `examples/extensions/`

Grepped `examples/extensions/**` for `.on("input"` / `.on('input'`. Exactly **3** files use the `input` event:

| # | File | Transform (1-line) |
|---|---|---|
| 1 | `examples/extensions/inline-bash.ts` | Expands inline `!{cmd}` bash patterns in the prompt text, splicing stdout in place. |
| 2 | `examples/extensions/input-transform.ts` | `?quick <q>` → brief-response rewrite; `ping`/`time` → instant `{ action:"handled" }` (no LLM). Also demonstrates the `event.source === "extension"` bypass to avoid re-processing extension-injected messages. |
| 3 | `examples/extensions/input-transform-streaming.ts` | Prepends `git diff --stat` when prompt mentions changes/diff; skips during `streamingBehavior === "steer"`. |

Note: `examples/extensions/github-issue-autocomplete.ts` does **not** use the `input` event — it uses `session_start` + an autocomplete provider (see §6). So it is not in this list.

Additional patterns worth mirroring from `input-transform.ts`:
- **Re-entrancy guard:** `if (event.source === "extension") return { action: "continue" };` prevents an extension that re-injects a message (e.g. via `pi.sendUserMessage`) from looping. Recommended for `#@file` if it ever re-injects.
- **`handled` vs `transform`:** `{ action: "handled" }` fully consumes the turn (no agent call) and should show its own UI feedback via `ctx.ui.notify`. Used for instant local replies.

---

## 5. Extension loading mechanism

Loader: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js` (read completely).
Config: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/config.js`.
CLI flag parsing: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/args.js`.

### Discovery locations (order matters)
`discoverAndLoadExtensions(configuredPaths, cwd, agentDir)` (loader.js) loads from three sources, **deduplicated**, in this order:

1. **Project-local:** `cwd/${CONFIG_DIR_NAME}/extensions/` → resolves to **`./.pi/extensions/`** (config.js:394 `CONFIG_DIR_NAME = ".pi"`).
2. **Global:** `agentDir/extensions/` where `getAgentDir() = join(homedir(), ".pi", "agent")` (config.js:412–418) → **`~/.pi/agent/extensions/`**.
3. **Explicit paths** (from `-e` / `--extension` flags; see below).

Discovery rules per directory (`discoverExtensionsInDir`):
- Direct `*.ts` or `*.js` files → loaded.
- Subdirectory with `index.ts`/`index.js` → that index loaded.
- Subdirectory with `package.json` containing a `"pi": { "extensions": [...] }` field → declared entry points loaded (one level only, no deeper recursion).

### `-e file.ts` flag
Parsed in `dist/cli/args.js:118–123`:
```js
else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
    result.extensions = result.extensions ?? [];
    result.extensions.push(args[++i]);   // value = the next arg verbatim
}
```
- Each `-e <path>` pushes onto `result.extensions`; the flag is repeatable.
- `-ne` / `--no-extensions` (`args.js:124`) disables **discovery** (sources 1 & 2) but **explicit `-e` paths still load** (loader handles configuredPaths regardless).
- Paths are resolved via `resolvePath(p, resolvedCwd, { normalizeUnicodeSpaces: true })`. If the path is a directory, its `package.json`/`index` entries (or contained `*.ts/*.js`) are discovered.
- Resolution in `dist/main.js:484`: `const resolvedExtensionPaths = resolveCliPaths(cwd, parsed.extensions);`

### Compilation: jiti (transpile-on-load, no tsconfig required)
`loadExtensionModule` (loader.js):
```js
const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  ...(isBunBinary
    ? { virtualModules: VIRTUAL_MODULES, tryNative: false }
    : { alias: getAliases() }),
});
const module = await jiti.import(extensionPath, { default: true });
```
- **`jiti`** transpiles TypeScript on the fly. **No tsconfig and no separate build step are needed** — a bare `.ts` extension loads directly.
- The module's **default export must be a function** (`ExtensionFactory`); otherwise load fails with `"Extension does not export a valid factory function"`.
- **Dependency resolution:** Pi aliases / virtualizes the supported packages so extensions can `import { ExtensionAPI } from "@earendil-works/pi-coding-agent"` (and `@earendil-works/pi-agent-core`, `pi-ai`, `pi-tui`, `typebox`). The legacy `@mariozechner/*` names are also aliased for back-compat. Any **other** npm dependency must be installable/resolvable from the extension's directory (see the `with-deps`, `gondolin`, `sandbox` examples which ship their own `package.json`/`node_modules`).
- **Caching:** an in-memory cache keyed by `(cwd, generation)` is used by `loadExtensionsCached`; `clearExtensionCache()` invalidates on cwd change or `/reload`. A per-instance `assertActive()` throws "stale ctx" if the runtime is replaced (e.g. after `ctx.reload()` / session switch).
- Each factory receives an `ExtensionAPI` whose `on(event, handler)` simply appends the handler to `extension.handlers.get(event)` (a per-extension `Map<string, HandlerFn[]>`).

---

## 6. `github-issue-autocomplete.ts` regex verification + input dispatch semantics

File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/github-issue-autocomplete.ts` (read completely).

### The regex (exact)
Token extraction (`extractIssueToken`):
```ts
function extractIssueToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
  return match?.[1];
}
```
The **produced value** for a selected issue:
```ts
function formatIssueItem(issue: GitHubIssue): AutocompleteItem {
  return { value: `#${issue.number}`, label: `#${issue.number}`, description: `[${issue.state.toLowerCase()}] ${issue.title}` };
}
```

### Verification result — IMPORTANT for `#@file` coexistence
- The regex matches `#` followed by **any** run of non-whitespace, non-`#` characters at end-of-line: `[^\s#]*`.
- It does **not** anchor to digits. The capture group `[^\s#]*` will also match `@foo`, `@./path`, etc. So **`#@...` tokens ARE captured** by this regex. `+digits` is merely what issue numbers happen to be (and `filterIssues` special-cases `/^\d+$/`), not a constraint of the regex.
- **Mechanism layer:** github-issue-autocomplete runs in the **autocomplete-provider** layer (`ctx.ui.addAutocompleteProvider`, hooked on `session_start`), **not** the `input` event. When the typed token (`@foo`) yields no matching issues, `filterIssues` returns `[]` and the wrapper falls back to `current.getSuggestions(...)` — so it does **not** consume or rewrite the submitted text.
- **Net coexistence:** A `#@file` extension (an `input` event) and github-issue-autocomplete operate on **different layers** and will not both rewrite the same text. The only interaction is the autocomplete *popup* may attempt to offer issues while typing `#@`; because `@...` matches no issue titles it falls back to the file-completion provider. **No hard conflict, but the overlap in trigger syntax (`#` vs `#@`) should be documented for users.** Flagged as open question.

### Input-event dispatch internals (runner) — relevant to chaining/order
File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js` lines **882–920** (`emitInput`):
```js
async emitInput(text, images, source, streamingBehavior) {
    const ctx = this.createContext();
    let currentText = text;
    let currentImages = images;
    for (const ext of this.extensions) {                       // extension order = load order
        for (const handler of ext.handlers.get("input") ?? []) {
            try {
                const event = { type: "input", text: currentText, images: currentImages, source, streamingBehavior };
                const result = (await handler(event, ctx));
                if (result?.action === "handled") return result;          // short-circuit entire chain
                if (result?.action === "transform") {
                    currentText = result.text;
                    currentImages = result.images ?? currentImages;       // merge: new images OR keep prior
                }
            } catch (err) { this.emitError({ ... }); }                    // handler error logged, chain continues
        }
    }
    return currentText !== text || currentImages !== images
        ? { action: "transform", text: currentText, images: currentImages }
        : { action: "continue" };
}
```
Key semantics for implementers:
- **Handlers chain in load order**, each receiving the *current* (possibly already-transformed) text/images.
- `transform` with `images` omitted keeps the previous images. To **add** file-image attachments, the handler must return the **merged** array (originals ++ new). Returning only the new images would *replace* any user-attached images — inline-bash avoids this by forwarding `event.images`.
- `handled` stops everything (turn skipped). `continue` is a pure pass-through.
- Per-handler errors are swallowed (logged via `emitError`); the chain is robust to a buggy handler. So `#@file` should still aim to never throw and to emit `ctx.ui.notify(..., "error")` for per-file failures.

---

## 7. `dist/core/extensions/types.d.ts` — ExtensionAPI + input-relevant event types

File: `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` (read completely; 1238 lines). The input-relevant definitions are quoted below.

### `InputEvent` and `InputEventResult`
```ts
/** Source of user input */
export type InputSource = "interactive" | "rpc" | "extension";
/** Fired when user input is received, before agent processing */
export interface InputEvent {
    type: "input";
    /** The input text */
    text: string;
    /** Attached images, if any */
    images?: ImageContent[];
    /** Where the input came from */
    source: InputSource;
    /** How the input will be delivered during streaming, or undefined when idle */
    streamingBehavior?: "steer" | "followUp";
}
/** Result from input event handler */
export type InputEventResult =
    | { action: "continue"; }
    | { action: "transform"; text: string; images?: ImageContent[]; }
    | { action: "handled"; };
```

### `ExtensionHandler` + the `input` registration on `ExtensionAPI`
```ts
/** Handler function type for events */
export type ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;

export interface ExtensionAPI {
    // ... many events ...
    on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
    // ... plus registerTool / registerCommand / registerShortcut / registerFlag / exec / sendUserMessage / events ...
    /** Execute a shell command. */
    exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
}
```

### `ExtensionContext` (the `ctx` passed to handlers) — fields `#@file` will use
```ts
export type ExtensionMode = "tui" | "rpc" | "json" | "print";
export interface ExtensionContext {
    ui: ExtensionUIContext;
    mode: ExtensionMode;
    /** Whether dialog-capable UI is available (true in TUI and RPC modes) */
    hasUI: boolean;
    /** Current working directory */
    cwd: string;
    sessionManager: ReadonlySessionManager;
    modelRegistry: ModelRegistry;
    model: Model<any> | undefined;
    isIdle(): boolean;
    isProjectTrusted(): boolean;
    signal: AbortSignal | undefined;
    abort(): void;
    hasPendingMessages(): boolean;
    shutdown(): void;
    getContextUsage(): ContextUsage | undefined;
    compact(options?: CompactOptions): void;
    getSystemPrompt(): string;
}
```
`ExtensionUIContext` members relevant to file-injection feedback:
```ts
notify(message: string, type?: "info" | "warning" | "error"): void;
setStatus(key: string, text: string | undefined): void;
addAutocompleteProvider(factory: AutocompleteProviderFactory): void;   // (what github-issue-autocomplete uses)
// ... select / confirm / input dialogs, setEditorText, getEditorText, pasteToEditor, setWidget, ...
```

### `ExecResult` / `ExecOptions` (re-exported from `../exec.ts`)
```ts
export type { ExecOptions, ExecResult } from "../exec.ts";
// Used as: pi.exec(command: string, args: string[], options?: { cwd?: ...; timeout?: ... })
// Returns { stdout: string; stderr: string; code: number } (see inline-bash usage).
```

### Extension factory shape
```ts
export type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
export type InlineExtension = ExtensionFactory | { name: string; factory: ExtensionFactory; };
```
(The default-exported function in an extension file is the `ExtensionFactory`.)

---

## Open questions / risks for the implementer
1. **Binary handling parity.** `processFileArguments` has no binary guard — non-image binaries are read as UTF-8. For `#@file`, decide: replicate (full parity) or add a NULL-byte / non-text guard that emits `<file name="ABS">[binary file, skipped]</file>\n`. (Recommend the latter; flag for product decision.)
2. **Steer behavior.** Should `#@file` inject during `streamingBehavior === "steer"`? Default recommendation: `continue` (mirror input-transform-streaming.ts) to avoid delaying corrections.
3. **Re-entrancy.** If `#@file` could re-inject via `pi.sendUserMessage`, guard with `if (event.source === "extension") return { action: "continue" };` (pattern from input-transform.ts).
4. **Image merging.** When a `#@`-referenced file is an image, the returned `images` array MUST be `[...(event.images ?? []), newImage]`, not just `[newImage]` (per runner chaining in §6).
5. **`#@` vs `#` syntax overlap.** `github-issue-autocomplete`'s token regex captures `#@...` tokens (see §6) but operates in a different layer and falls back harmlessly; document the `#@` trigger for users to avoid confusion with issue `#NNN`.
6. **Regex trigger design.** Decide the exact `#@` token grammar (e.g. `/#@(\S+)/g` vs `/#@("[^"]+"|'[^']+'|\S+)/g` to allow paths with spaces). Mirror inline-bash's global-regex discipline (`lastIndex = 0` after `test`, collect-then-replace).

## Start here
Open `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/inline-bash.ts` — copy its structure verbatim, swap the `!{...}` regex + bash exec for a `#@...` regex + `processFileArguments`-equivalent file formatting (see §2 for exact templates). Then consult `examples/extensions/input-transform-streaming.ts` for the steer-guard and `dist/cli/file-processor.js` for the canonical text/image output format and edge cases.
