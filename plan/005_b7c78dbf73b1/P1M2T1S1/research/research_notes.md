# Research Notes — P1.M2.T1.S1 (plan/005)

State.bareAt + module-level `cfg` + session_start config load + injectFiles State init + processTokenStream
`bareAt` opt + top-level scan call (`bareAt:false`) + config-loading integration test. PRD §4.6, §9.

---

## 0. Current working-tree state (VERIFIED 2025-07-16)

Both predecessor subtasks have LANDED (the plan_status "Ready"/"Complete" labels are stale; the files prove it):

- **P1.M1.T1.S1 (BARE_AT_RE + scanTokens restructure) — LANDED.** `BARE_AT_RE` at file-injector.ts:15
  (`/(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu`). `scanTokens` at L446 with opts `{ allowAbsTilde; skipCode; tryMdExt; bareAt?: boolean }`
  (bareAt **OPTIONAL**), returns `Promise<{ index; prefixLen; abs }[]>`, builds the `cands` union (FILE_INJECT_RE always
  prefixLen 2; BARE_AT_RE when `opts.bareAt` prefixLen 1). T1.S1's 6 unit tests are in the .mjs.
- **P1.M1.T2.S1 (readConfig + FileInjectorConfig + imports) — LANDED.** Imports line L3 has `CONFIG_DIR_NAME, getAgentDir`.
  `interface FileInjectorConfig { markdownBareAtImports?: boolean }` at L146. `export async function readConfig(ctx: { cwd:
  string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig>` at L155 (tryRead helper, global-first,
  project-if-trusted shallow merge, never throws). The `.pi/file-injector.json` = `{"markdownBareAtImports":true}` fixture
  is in buildFixtures (L257). `ASSERTED_EXPORTS` has `"readConfig"` (L142) + the typeof sanity assert (L131). T2.S1-a..d
  readConfig unit tests are at L1850-1886.

⇒ My task begins with readConfig ALREADY shipped+tested. I CONSUME it (add the module-level `cfg` cache + session_start
load + thread bareAt). I do NOT re-add readConfig / FileInjectorConfig / imports / the .pi fixture — they exist.

## 1. Current `file-injector.ts` anatomy (line refs against the LANDED tree)

| Region | Line | Current state | My edit |
|---|---|---|---|
| `interface State` | 253 | `{ blocks; images; injectedSet; remaining; count; paged }` — NO bareAt | + `bareAt: boolean` |
| `processTokenStream` sig | 523 | opts `{ allowAbsTilde; skipCode; tryMdExt }`; returns `Promise<number[]>` | + `bareAt: boolean` (REQUIRED — see §5) |
| `injectFiles` sig | 710 | `(text, imagesIn, ctx): Promise<{text,images,injected,paged}>` | + `bareAt = false` 4th param (Option A) |
| `injectFiles` state literal | 783 | `{ blocks, images, injectedSet, remaining, count:0, paged:0 }` | + `bareAt` (from param) |
| `injectFiles` top-level scan call | 799 | `processTokenStream(text, ctx.cwd, { allowAbsTilde:true, skipCode:false, tryMdExt:false }, state, ctx)` | + `bareAt:false` (HARDCODED — §4.6) |
| top-level marker strip | ~806 | `slice(0,i) + slice(i+2)` | UNCHANGED (top-level always #@, prefixLen 2) |
| factory / `export default` | 819 | `pi.on("input",…)` (L820) + `pi.on("session_start",…)` autocomplete (L848) | + module-level `cfg`; + config session_start handler; input handler passes bareAt |
| `injectMarkdown` scan call | 707 | `scanTokens(content, dir, { allowAbsTilde:false, skipCode:true, tryMdExt:true }, state)` — NO bareAt; `injectable:{index;abs}[]` (L718, no prefixLen) | **UNTOUCHED — P1.M2.T2.S1's scope** |

## 2. CRITICAL GOTCHA — `cfg` MUST be MODULE-LEVEL (not a factory closure)

`captureHandler` (file-injector.test.mjs:166) creates a FRESH mock `pi` and calls `mod.default(pi)` on EVERY capture.
If `cfg` lived INSIDE the factory closure (`export default function (pi) { let cfg = {}; … }`), each `mod.default(pi)`
would create a NEW closure with `cfg = {}`. Then:
- `captureHandler("session_start")` → closure1.cfg set by the config handler.
- `captureHandler("input")` → closure2.cfg = `{}` (FRESH; session_start never driven on this pi) → input handler reads
  `closure2.cfg.markdownBareAtImports === true` → **false**. The config loaded in the session_start capture is
  INACCESSIBLE to the input capture.

⇒ `cfg` MUST be declared at MODULE SCOPE (`let cfg: FileInjectorConfig = {};` right before `export default function`),
so both handlers share ONE variable across `mod.default(pi)` invocations. The item §3b says "module-level" — this is WHY
(it overrides the PRD §9 pseudocode which nests `cfg` inside the factory closure). Place it at ~L818, before the default
export, with a comment noting the persistence-across-captureHandler rationale.

This also means the real (non-test) Pi runtime is fine: Pi calls the factory ONCE per session (one closure), but a
module-level var works identically there — and is robust to any future multi-invocation.

## 3. Factory design — SEPARATE session_start handler (config) + ADDITIVE captureHandler change

Two viable factory shapes (item §3b: merge OR separate, both acceptable):

- **(merge)** `cfg = await readConfig(ctx)` at the TOP of the EXISTING session_start handler (before the `ctx.ui` guard),
  making it `async`. ONE handler → `captureHandler("session_start")` captures it directly. BUT: the existing **A1
  autocomplete test (L895-900)** invokes the session_start handler with MINIMAL ctx `{cwd}` / `{cwd, ui:{}}` — **no
  `isProjectTrusted`** — so `readConfig`'s `ctx.isProjectTrusted()` would throw `TypeError` → breaks A1. Fixing A1 means
  editing every minimal-ctx invocation in that test (intrusive, touches existing-passing code).
- **(separate)** A NEW `pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); })` registered FIRST
  (before the autocomplete session_start). The autocomplete handler stays BYTE-FOR-BYTE UNCHANGED → the A1 test still
  captures it via `captureHandler("session_start").cb` (the LAST registered) and passes with its minimal ctx (autocomplete
  guard short-circuits; readConfig never runs on the autocomplete handler). Zero edits to A1.

⇒ **Choose SEPARATE** (cleaner separation, zero risk to A1, matches PRD §9 §9-pseudocode + codebase_delta §9). The ONLY
harness change needed: make `captureHandler` ALSO expose ALL handlers for an event (so my config test can grab the FIRST
session_start handler, the config one). Do this ADDITIVELY (keep `.cb` = last for backward compat):

```js
function captureHandler(event = "input") {
  const cbs = [];
  const pi = { on: (ev, cb) => { if (ev === event) cbs.push(cb); } };
  mod.default(pi);
  return { cb: cbs[cbs.length - 1], all: cbs };   // .cb = last (backward compat); .all = every handler for `event`
}
```
All ~30 existing callers use `.cb` → unaffected. For `'session_start'` now `.all = [configHandler, autocompleteHandler]`,
`.cb = autocompleteHandler` (A1 still works). For `'input'`, `.all = [inputHandler]`, `.cb = inputHandler`.

Registration order in the factory (so config is `.all[0]`):
```ts
let cfg: FileInjectorConfig = {};                                    // module-level (~L818)
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });   // NEW — config, registered FIRST
  pi.on("input", async (event, ctx) => { … injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true) … });
  pi.on("session_start", (_event, ctx) => { … autocomplete (UNCHANGED) … });
}
```

## 4. DESIGN CHOICE — Option A (`bareAt` PARAM to injectFiles), NOT Option B (read module cfg)

Item §3c recommends **Option A** for testability. Confirmed correct:
- `injectFiles(text, imagesIn, ctx, bareAt = false)` — takes bareAt as a PARAM; does NOT read the module-level `cfg`.
  ⇒ injectFiles stays STATELESS re config → directly unit-testable (existing `mod.injectFiles(text, [], FIX)` calls
  pass 3 args → `bareAt` defaults `false` → byte-for-byte identical behavior).
- The INPUT HANDLER is the ONLY place `cfg` is read: `injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true)`.
- `state.bareAt = bareAt` (the param). The TOP-LEVEL `processTokenStream` call hardcodes `bareAt:false` (§4.6: bare-@ is
  markdown-only; the user prompt is unaffected). So `state.bareAt` is set but UNUSED at the top level in this subtask —
  it is the SEAM P1.M2.T2.S1's `injectMarkdown` will read (`bareAt: state.bareAt`).

Byte-for-byte proof for existing input-handler tests (which do NOT drive session_start): `cfg` stays `{}` (module default)
→ `cfg.markdownBareAtImports === true` → `false` → `injectFiles(…, false)` → `state.bareAt=false`, top-level scan
`bareAt:false` → identical to today. The `if (!event.text?.includes("#@"))` pre-check and everything downstream are
unchanged. ⇒ existing input tests stay GREEN with no edits.

## 5. processTokenStream `bareAt` opt — REQUIRED is safe (one caller)

`processTokenStream` (L523) is PRIVATE (no `export`) and has EXACTLY ONE caller: `injectFiles` (L799). `injectMarkdown`
calls `scanTokens` DIRECTLY (L707), NOT `processTokenStream`. No test calls `processTokenStream` directly (not exported).
⇒ Making `bareAt: boolean` REQUIRED on processTokenStream's opts is safe (no cascade — unlike scanTokens, which has 3
callers + tests, which is why T1.S1 made scanTokens' bareAt OPTIONAL). The single caller passes `bareAt:false`.
Forwards `opts` straight to `scanTokens` (whose bareAt is optional) — supertype usage, typecheck-clean.

## 6. State `bareAt` — REQUIRED is typecheck-safe (one construction site in .ts)

`State` is constructed in EXACTLY ONE place in `file-injector.ts`: the `injectFiles` literal (L783). Adding required
`bareAt: boolean` to the interface only forces that ONE literal to set it. The `.mjs` test file constructs State-like
literals for scanTokens unit tests WITHOUT bareAt — but the `.mjs` is NOT typechecked (tsc only checks file-injector.ts),
and `scanTokens` reads only `state.injectedSet` (never `state.bareAt`), so those literals work at runtime unchanged.
⇒ `bareAt: boolean` (required) on State; set `bareAt` in the injectFiles literal from the param.

## 7. TEST SCOPE TENSION — and the resolution

The item §5 describes 3 integration cases: (a) markdown-imports bare `@api.md` → injected; (b) trust-gate → not injected;
(c) top-level safety. **Cases (a)/(b) require `injectMarkdown` to honor `state.bareAt`** (codebase_delta §8: the
`scanTokens(content, dir, { …, bareAt: state.bareAt }, state)` call + the prefixLen strip). That wiring is explicitly
**P1.M2.T2.S1's scope** (plan_status: "injectMarkdown: pass bareAt:state.bareAt + carry prefixLen through Step 3.5 +
strip with prefixLen"). My task §3(a)-(f) does NOT touch injectMarkdown, and §4 says injectMarkdown is "Consumed by
P1.M2.T2.S1".

⇒ Cases (a)/(b) as literally specified CANNOT pass in my task alone (injectMarkdown ignores state.bareAt until
P1.M2.T2.S1). Since ALL tests must pass and existing cases must not break, my task's integration test verifies the
wiring it ACTUALLY owns, all fully passing:

- **Config-load path runs (cases a/b SPIRIT)**: drive `session_start` (trusted, then untrusted) via `captureHandler` →
  `readConfig` runs, `cfg` set, no crash; then drive `input` on a normal `#@a.ts` prompt → still injects (regression:
  config wiring doesn't break #@; the session_start→cfg→input→injectFiles path is exercised end-to-end).
- **Top-level safety (case c — THE key invariant, FULLY observable)**: drive `session_start` (trusted, `markdownBareAtImports:true`)
  so `cfg` loads and the input handler derives `bareAt=true`; then drive `input` on `"Diff #@a.ts and @b.ts"` (BOTH files
  exist) → `#@a.ts` injects but the BARE `@b.ts` does NOT (top-level scan hardcodes `bareAt:false`). Assert the `b.ts`
  `<file>` block is ABSENT. This DIRECTLY proves `bareAt:false` is hardcoded at the top level: if the wiring were wrong
  (top-level passed `bareAt:true`), `@b.ts` WOULD inject (it exists) → assertion fails.
- **Direct `injectFiles` bareAt-param unit tests (Option A)**: `mod.injectFiles("#@a.ts", [], FIX, true)` → `#@a.ts`
  still injects (param doesn't break #@); `mod.injectFiles("Diff #@a.ts and @b.ts", [], FIX, true)` → `injected===1`
  (bare `@b.ts` not injected; top-level `bareAt:false` regardless of param).

The literal markdown-end-to-end assertions (cases a/b: "api.md IS injected" / "api.md NOT injected") are DEFERRED to
P1.M2.T2.S1's integration tests (PRD §11 #25-28), which own the injectMarkdown wiring that makes them observable.
This is the honest, scope-respecting, all-green resolution. Documented prominently in the PRP.

## 8. `makeMockCtx` change — add `isProjectTrusted` (default true), harmless

`makeMockCtx(cwd, { hasUI = true } = {})` (L158) → add `isProjectTrusted = () => true` default. The INPUT handler
(Option A) does NOT call `isProjectTrusted` (only `readConfig` on session_start does, and the config handler is invoked
with a ctx that has it). So adding `isProjectTrusted` to makeMockCtx is HARMLESS for all existing input-handler tests.
The config test uses `makeMockCtx(TMPDIR).ctx` (trusted) and `makeMockCtx(TMPDIR, { isProjectTrusted: () => false }).ctx`
(untrusted). Aligns with item §5 ("add an isProjectTrusted field to makeMockCtx").

## 9. Fixtures reused (NONE new)

- `.pi/file-injector.json` = `{"markdownBareAtImports":true}` — ALREADY written by T2.S1's buildFixtures (L257). Reused.
- `a.ts` (L198), `b.ts` (L199) — exist. `A_TS`/`B_TS` constants exist (L291-292). Used by the top-level-safety cases.
- `TMPDIR` (L177) — cwd for all config tests (its `.pi/` has the config). Reused.
⇒ My task adds NO new fixtures. Only the makeMockCtx + captureHandler (additive) harness changes + the 5 test cases.

## 10. Global-config robustness (no test-env assumption)

`readConfig` reads the REAL `~/.pi/agent/file-injector.json` first (getAgentDir → real home dir). A real global config
may exist on the test machine. This is HARMLESS for my tests:
- trusted cases: the project config sets `markdownBareAtImports:true` (project WINS via spread) → `cfg.markdownBareAtImports===true` regardless of global.
- untrusted case: project skipped → cfg = global only; but top-level IGNORES bareAt → no observable effect (smoke test).
So no test-env assumption about the global config. (Mirrors T2.S1's VALUE-assert rationale.)

## 11. Gates (both VERIFIED present)

- `npm run typecheck` → `scripts/typecheck.mjs` runs `tsc --strict` against the global pi `.d.ts`. Must stay 0 errors.
  My changes are all --strict-clean (narrow types; cfg: FileInjectorConfig; bareAt: boolean; readConfig ctx unchanged).
- `node ./file-injector.test.mjs` → the regression + new-tests gate. Baseline = existing 92 + T1.S1's 6 + T2.S1's 4 = 102.
  My 5 new cases → 107 total, 0 failed. The module-surface guard passes (no new exports — `cfg` is module-private,
  injectFiles/State/processTokenStream already counted).
