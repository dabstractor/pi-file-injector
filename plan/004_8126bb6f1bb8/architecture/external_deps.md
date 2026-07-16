# External Dependencies — plan/004 (Markdown Import Extension Shorthand)

> Validated against the globally-installed Pi package. Researcher run `9a0141e1` (review-only, no file mods).

## Pi package

- **`@earendil-works/pi-coding-agent@0.80.8`** at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`.
- ESM (`"type": "module"`); types at `dist/index.d.ts`. Declared dep: jiti 2.7.0. `engines.node >= 22.19.0`.
- Companion: **`@earendil-works/pi-ai@0.80.8`** (`node_modules/@earendil-works/pi-ai`).

## Contract facts used by the extension — ALL CONFIRMED

| # | Fact (delta-relevant) | Status | Evidence |
|---|---|---|---|
| 1 | `input` handler may be `async`; an internal sub-function going async only adds `await` points inside the already-async handler — **no contract change** | ✅ CONFIRMED | `dist/core/extensions/types.d.ts`: `ExtensionHandler<E,R> = (e,ctx) => Promise<R\|void> \| R\|void`; `on("input", ExtensionHandler<InputEvent,InputEventResult>)`. Existing handler already `async` + `await injectFiles(...)`. |
| 2 | `resizeImage(bytes, mime, opts?) => Promise<ResizedImage\|null>` and `formatDimensionNote(resized) => string\|undefined` exported from package root | ✅ CONFIRMED | `dist/index.d.ts` re-export; exact sigs in `dist/utils/image-resize.d.ts`; `ResizedImage` shape in `image-resize-core.d.ts`. (Unchanged by this delta.) |
| 3 | `ImageContent = { type:"image"; data:string; mimeType:string }` from `@earendil-works/pi-ai` | ✅ CONFIRMED | `node_modules/@earendil-works/pi-ai/dist/types.d.ts`. (Unchanged.) |
| 4 | Directory `{ "pi": { "extensions": ["file-injector.ts"] } }` loads via jiti (manifest wins over `index.ts`) | ✅ CONFIRMED | `dist/core/extensions/loader.js`: `resolveExtensionEntries` → `readPiManifest` checks `pkg.pi.extensions` BEFORE falling back to `index.ts`; `loadExtensionModule` imports via jiti. `pi install .`/`pi install /abs/path` flow through `DefaultPackageManager`. |
| 5 | `path.extname` returns `""` for extensionless tokens (`"PRD"`, `"sub/notes"`); standard ESM `node:` imports | ✅ CONFIRMED | Node `node:path` semantics; both extension and Pi loader use `import * as path from "node:path"`. |
| 6 | `await fs.stat(p)` rejects on ENOENT → `try/catch` returning `false` is the correct "missing" detection | ✅ CONFIRMED | Standard `fs/promises` ENOENT reject; idiom already shipped in `injectFile`/`injectMarkdown`. |

## Delta impact on the Pi surface

**None.** The delta (`scanTokens` async + `tryMdExt`) is purely extension-internal. It introduces no new Pi
APIs, changes no contract, and reuses only already-validated surface. The two within-extension notes below
are NOT Pi risks:

### Note A — `scanTokens` is exported; going async changes its return to a Promise
- `typeof asyncFunction === "function"` is **true**, so the test sanity gate
  (`assert(typeof mod.scanTokens === "function")` at test L122 / array L137) **stays valid**.
- The test suite calls **only `mod.injectFiles(...)`** for the acceptance cases — it does **NOT** call
  `scanTokens` directly. So **no test call site needs `await`**. (Verified by grep: the only `mod.` calls of
  the changed functions are the `typeof` sanity checks; the one direct helper call is
  `mod.expandTildeAndResolve(...)` at test L659, which is **unchanged** by the delta.)
- The two production call sites (`processTokenStream` L431, `injectMarkdown` L600) are already `async` →
  add `await`. That is the entire async-propagation cost.

### Note B — dotfile `path.extname` nuance (`.env`, `.bashrc` → `""`)
- `path.extname(".env") === path.extname("PRD") === ""`. The PRD §4.5 rule 3 guard is literally
  `path.extname(token) === ""`. So a token like `.env` technically qualifies for the shorthand fallback
  (it would try `.env.md`). **But exact-match always wins** — a bare `.env` that exists is returned before
  the `.md` fallback runs, so the behavior is correct/harmless in practice.
- **Implementer decision:** follow the PRD **literally** (`path.extname(token) === ""`). Do NOT add a
  special dotfile exclusion — it would diverge from the spec, and exact-match-wins already makes it safe.
  This matches `delta_analysis.md` and the delta PRD §4.1 pseudocode.

## No new external dependencies

The delta adds zero npm imports. It reuses `node:fs` (`fs/promises.stat`), `node:path` (`path.extname`,
`path.dirname`, `path.resolve`, `path.join`, `path.basename`), and `node:os` (`os.homedir`) — all already
imported. No new Pi exports are needed.
