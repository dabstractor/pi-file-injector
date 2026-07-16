# Codebase Delta — `markdownBareAtImports` (PRD §4.6)

Precise, function-level change set to bring `file-injector.ts` to PRD v005 spec. All line/function
references are against the **current** 879-line `file-injector.ts`. The existing implementation is
AHEAD of the PRD §9 pseudocode in several robustness aspects (Unicode regex, magic-number sniff,
empty-image note, Step 3.5 existence pre-check, surrogate-safe headSlice) — **those improvements
MUST be preserved**, not reverted to the pseudocode.

---

## 1. NEW constant: `BARE_AT_RE`

**Add** near `FILE_INJECT_RE` (top of file):
```ts
const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;  // markdown opt-in (§4.6); NOT after # or a word char
```
- PRD §4.6 literal form: `/(^|(?<=[^\w#]))@(\S+)/g`.
- **RECOMMENDATION (consistency):** the shipped `FILE_INJECT_RE` is Unicode-aware
  (`(?<![\p{L}\p{N}_])` + `u` flag, so `café#@x` / `日本語#@x` don't match). Mirror that for the
  bare-`@` regex: the lookbehind `(?<![\p{L}\p{N}_#])` (Unicode `\p{}` classes + explicit `#` in the
  negated set) + `u` flag. This keeps `user@host.com` (mid-word `@`) and `#@file` (preceded by `#`)
  both correctly excluded, in any language. (If the implementer prefers the PRD's ASCII literal,
  that is also acceptable — just document the choice. The behavior for ASCII paths is identical.)
- **Critical property (§4.6):** the lookbehind forbids a preceding `#`, so `#@file` is matched
  **once** by `FILE_INJECT_RE` and **never** by `BARE_AT_RE`. No double-match.

## 2. NEW imports: `CONFIG_DIR_NAME`, `getAgentDir`

**Current** import line:
```ts
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
```
**Change to:**
```ts
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
```
- **VERIFIED exported** (see `api_verification.md`): `dist/index.d.ts:2` + `dist/index.js:4`.
- `CONFIG_DIR_NAME === ".pi"`; `getAgentDir(): string` → `~/.pi/agent` (or `PI_CODING_AGENT_DIR` env override).

## 3. NEW type + NEW function: `FileInjectorConfig`, `readConfig`

```ts
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

/** §4.6 — read file-injector.json (global, then project-if-trusted; project overrides global). */
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  const tryRead = async (p: string): Promise<FileInjectorConfig> => {
    try { return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}"); } catch { return {}; }
  };
  let cfg: FileInjectorConfig = await tryRead(path.join(getAgentDir(), "file-injector.json"));
  if (ctx.isProjectTrusted()) cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  return cfg;
}
```
- Global first, then project-if-trusted, **shallow merge** (project wins).
- Missing/malformed → default `{}` → `markdownBareAtImports` is `undefined` → treated as `false`. Never throws.
- Note: the PRD §9 pseudocode types `readConfig(ctx: any)`. Prefer the narrow typed param shown here
  (only `cwd` + `isProjectTrusted` are used) so it is unit-testable with a tiny mock.

## 4. CHANGE `State` interface — add `bareAt`

**Current:**
```ts
interface State { blocks; images; injectedSet; remaining; count; paged; }
```
**Add field:** `bareAt: boolean;   // markdown bare-"@" imports enabled? (§4.6)`

## 5. CHANGE `scanTokens` — add `bareAt` opt + `prefixLen` (THE ENGINE CHANGE)

**Current signature:**
```ts
export async function scanTokens(
  text, baseDir,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean },
  state,
): Promise<{ index: number; abs: string }[]>
```
**Target signature:**
```ts
export async function scanTokens(
  text, baseDir,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state,
): Promise<{ index: number; prefixLen: number; abs: string }[]>
```
**Logic change (PRD §9 `scanTokens`):** instead of a single `for (const m of text.matchAll(FILE_INJECT_RE))`,
build a `cands` array from BOTH regexes when `bareAt` is on, then process uniformly:
```ts
const cands: { idx: number; token: string; prefixLen: number }[] = [];
for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
cands.sort((a, b) => a.idx - b.idx);
for (const c of cands) {
  if (codeRanges && inCode(c.idx, codeRanges)) continue;   // §5.6.1
  const token = cleanToken(c.token);
  if (!token) continue;
  if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;  // §4.5 markdown relative-only
  const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);
  if (!abs) continue;
  if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;
  localSeen.add(abs);
  out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
}
```
- `BARE_AT_RE`'s lookbehind excludes a preceding `#`, so `#@file` appears once (prefixLen 2), a bare
  `@file` appears once (prefixLen 1). Dedup keys on the **resolved abs**, so `#@api.md` and `@api.md`
  in the same file collapse to one injection (whichever sorts first wins; the second is left verbatim).

## 6. CHANGE `processTokenStream` — add `bareAt` opt (top-level = false)

**Current:** `opts: { allowAbsTilde; skipCode; tryMdExt }`, returns `Promise<number[]>`.
**Target:** `opts: { allowAbsTilde; skipCode; tryMdExt; bareAt }`, still returns `Promise<number[]>`.
- It passes `opts` straight through to `scanTokens`, so `bareAt` flows automatically.
- The top-level call site (in `injectFiles`) passes `bareAt: false` (§4.6: bare-`@` is markdown-only).
- **Top-level marker strip is UNCHANGED:** `processTokenStream` pushes `r.index` (just the index) to
  `resolved`, and `injectFiles` strips with hardcoded `+ 2` (correct because top-level is always `#@`,
  prefixLen 2). No prefixLen needed at the top level — do NOT over-engineer this.

## 7. CHANGE `injectFiles` — set `state.bareAt` + thread bareAt into the top-level scan

**Current state init:**
```ts
const state: State = { blocks, images, injectedSet: priorPaths, remaining, count: 0, paged: 0 };
```
**Target:** add `bareAt`. Two design options (the implementer picks one; BOTH are acceptable):
- **(A) Param:** `injectFiles(text, imagesIn, ctx, bareAt = false)` and the handler passes `cfg.markdownBareAtImports === true`. Cleanest for direct unit testing of `injectFiles`.
- **(B) Module cfg:** read the module-level `cfg` inside `injectFiles` (matches PRD §9 pseudocode, where State is built in the handler). Requires the test harness to set `cfg` via `session_start`.

Either way, `state.bareAt` is set, and the `processTokenStream` call gains `bareAt: false`:
```ts
const resolvedIdx = await processTokenStream(text, ctx.cwd,
  { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
```

## 8. CHANGE `injectMarkdown` — pass `bareAt: state.bareAt` + prefixLen-aware strip

Three edits in the existing six-step body:
1. **scan call (Step 3):** add `bareAt: state.bareAt`:
   ```ts
   const records = await scanTokens(content, dir,
     { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);
   ```
   (`records` is now `{ index; prefixLen; abs }[]`.)
2. **Step 3.5 existence pre-check:** the existing `injectable` filter must carry `prefixLen` through
   (records already have it; the filter just forwards the whole record). `injectable` becomes
   `{ index; prefixLen; abs }[]`.
3. **Step 4 strip:** replace hardcoded `+ 2` with `+ r.prefixLen`:
   ```ts
   for (const r of [...injectable].sort((a, b) => b.index - a.index))
     stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);
   ```

## 9. CHANGE the factory — add config loading to `session_start`

**Current factory:** `pi.on("input", …)` + `pi.on("session_start", …)` (autocomplete only).
**Target:** add a module-level `let cfg: FileInjectorConfig = {};` and load it on `session_start`:
```ts
let cfg: FileInjectorConfig = {};
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });   // §4.6 config load
  pi.on("session_start", (_e, ctx) => { /* existing autocomplete registration (unchanged) */ });
  pi.on("input", async (event, ctx) => { /* … unchanged, but reads cfg for bareAt (option B) or passes it (option A) */ });
}
```
- Two `session_start` handlers are fine (Pi appends handlers per event). Or merge config-load into
  the existing `session_start` handler body (cleaner — one handler does both). The PRD §9 pseudocode
  shows a separate `session_start` for config; either is acceptable.
- The `input` handler must derive `bareAt` from `cfg.markdownBareAtImports === true` and pass it into
  `injectFiles` (option A) or rely on `injectFiles` reading `cfg` (option B).

## 10. TEST harness changes (file-injector.test.mjs)

- **Module-surface guard:** add `"readConfig"` to `ASSERTED_EXPORTS` (the completeness guard at ~L137
  fails if a shipped function isn't named). `FileInjectorConfig` is a type (no runtime export), so it
  is NOT added.
- **`makeMockCtx`:** add `isProjectTrusted: () => true/false` so config tests can toggle trust.
- **Bare-@ tests:** either call `scanTokens(text, dir, {allowAbsTilde:false, skipCode:true, tryMdExt:true, bareAt:true}, state)` directly (unit), or drive the full pipeline with `bareAt` on (integration, via option A param or by invoking `session_start` with a temp config dir first).
- **Config tests:** `readConfig` is exported and takes a narrow `{cwd, isProjectTrusted}` — test it directly by writing `file-injector.json` into temp dirs (global via `getAgentDir()` mock is hard; test the project path + trust gate + malformed-JSON-defaults-false paths).

## 11. DOCS changes

- **Mode A (ride with work):** JSDoc on `readConfig`, `scanTokens` (new `bareAt` opt + `prefixLen`),
  `injectMarkdown` (bareAt threading). These ride with their implementing subtasks.
- **Mode B (final sweep):** `README.md` gains a short "Optional: bare-`@` markdown imports" subsection
  under Syntax (the config file, the two locations, the trust gate) — added by the final docs task.

---

## Summary of touched functions

| Function | Change type |
|---|---|
| `BARE_AT_RE` (new const) | ADD |
| imports (`CONFIG_DIR_NAME`, `getAgentDir`) | ADD to existing import |
| `FileInjectorConfig` (new type) | ADD |
| `readConfig` (new fn) | ADD (exported) |
| `State` interface | ADD `bareAt` field |
| `scanTokens` | ADD `bareAt` opt + `prefixLen` + union logic (engine change) |
| `processTokenStream` | ADD `bareAt` opt (passthrough) |
| `injectFiles` | ADD `bareAt` to State init + top-level scan call |
| `injectMarkdown` | ADD `bareAt` to scan call + `prefixLen` to Step 3.5/Step 4 |
| factory | ADD `cfg` var + `session_start` config load + handler reads cfg |
| test harness | ADD `readConfig` to surface guard; new bare-@ + config cases |
| README | ADD bare-@ config subsection (final docs task) |
