## 8. File Structure

Single-file extension, no runtime dependencies. The repo ships two files at the root:

- **`file-injector.ts`** — the extension itself (zero npm imports beyond Pi's own packages).
- **`package.json`** — a thin `"pi"` manifest (`{ "pi": { "extensions": ["file-injector.ts"] } }`)
  that makes the **directory** a loadable pi package. This is required so `pi install .` /
  `pi install /abs/path` work, and so handing the directory to the loader (via a package
  registration or `-e <dir>`) resolves to `file-injector.ts` instead of crashing with
  `Cannot find module '<dir>'` — a directory with no manifest and no `index.ts` has no entry
  point for jiti to import.

Install locations:

- **Global:** `~/.pi/agent/extensions/file-injector.ts` (copy), or `pi install .` (package).
- **Project-local:** `.pi/extensions/file-injector.ts` (copy).

Internal sections (in order):
1. Imports (§7)
2. Constants: `FILE_INJECT_RE`, `BARE_AT_RE`, `INLINE_CODE_RE`, `FENCE_OPEN_RE`, `MIME_BY_EXT`, `MD_EXTS`, `TRAILING_PUNCT`, `SETTINGS_KEY` (settings.json key), budget constants (`PAGED_THRESHOLD`, `MARGIN`, `HEAD_CHARS`, `READ_LIMIT`, `DEFAULT_RESERVE`, `IMAGE_FALLBACK_TOKENS`)
3. Pure/IO helpers: `cleanToken`, `isAbsoluteOrTilde`, `expandTildeAndResolve`, `resolveImportPath` (exact → `.md`/`.markdown`), `isRegularFile`, `readConfig` (§4.6), `extOf`, `isBinary`, `headSlice`, `headStartLine`, `headCompleteLineCount`, `estimateImageTokens`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatPagedDirectiveBlock`
4. Markdown helpers: `computeCodeRanges(content)` → sorted `[start,end][]`; `inCode(index, ranges)` → boolean
5. Core (shared state + recursion): `scanTokens(text, baseDir, opts, state)` → `string[]` (resolved abs paths, encounter order; markers detected but **never stripped**, §6.4); `processTokenStream(...)` → injects (no return); `injectFile(abs, state, ctx)` → bool; `injectMarkdown(abs, content, state, ctx)`; `emitText(abs, content, state)`; `subtract(state, cost)`; plus `FileDetail` type and detail-push helpers (`pushTextDetail`, `pushPagedDetail`, `pushImageDetail`, `pushBinaryDetail`).
6. Renderer: `renderInjectedMessage(message, { expanded }, theme)` → `Component` (§6.3); small display helpers (`tildify(abs)`, `readLine(detail, theme)`).
7. Factory: `export default function (pi: ExtensionAPI) { let pending: { blocks; details } | null = null; pi.on("session_start", …) (load `cfg`, §4.6; **register the `MessageRenderer`** for `"fileInjector.injected"`, §6.3); pi.on("input", …) (read+classify+build blocks/details, **leave the prompt verbatim**, **stash `pending`**, return transform with `text: event.text`); pi.on("before_agent_start", …) (consume `pending` → return `{ message }`, §6.2) }`

Target ~300–380 lines.

---

