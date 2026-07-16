---
name: "P1.M2.T1.S1 — State.bareAt + module-level cfg + session_start config load + injectFiles State init + processTokenStream bareAt opt + top-level scan bareAt:false (with config-loading integration test)"
prd_ref: "PRD §4.6 (Optional bare-@ markdown imports / config), §9 (Algorithm: factory cfg + session_start load + State.bareAt + top-level bareAt:false pseudocode), §6.2 (Assembly: top-level #@ strip unchanged)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — State iface, processTokenStream opts, injectFiles (sig + State init + top-level scan call), module-level cfg, factory (config session_start + input bareAt arg)
target_language: TypeScript (jiti transpile-on-load; `npm run typecheck` = tsc --strict gate; `node ./file-injector.test.mjs` = the regression gate)
depends_on: "P1.M1.T1.S1 (scanTokens bareAt? + prefixLen — LANDED) + P1.M1.T2.S1 (readConfig + FileInjectorConfig + imports + .pi fixture — LANDED). Consumes readConfig verbatim."
consumed_by: "P1.M2.T2.S1 (injectMarkdown reads state.bareAt via `bareAt: state.bareAt` + prefixLen strip — the SEAM this task creates); P1.M3.T2.S1 (README bare-@ subsection)"
---

# PRP — P1.M2.T1.S1: Thread bareAt from config through State + the factory + the top-level pipeline (+ config-loading integration test)

> **Scope flag:** Integration wiring. Adds a `bareAt: boolean` field to `State`, a **module-level** `let cfg: FileInjectorConfig = {}`
> cache, a `session_start` handler that loads `cfg = await readConfig(ctx)`, a 4th `bareAt = false` param to `injectFiles`
> (Option A — cleanest for direct unit testing), a `bareAt` opt to `processTokenStream` (REQUIRED — single caller), and
> `bareAt:false` on the top-level scan call (§4.6: bare-`@` is markdown-only — the top-level prompt is byte-for-byte
> unaffected). **The top-level `#@` marker strip is UNCHANGED** (`slice(0,i)+slice(i+2)` — top-level is always `#@`,
> prefixLen 2). `injectMarkdown` is **NOT touched** (P1.M2.T2.S1 owns `bareAt: state.bareAt` + the prefixLen strip). The
> integration test verifies the config→pipeline wiring this task owns (top-level safety is the key observable invariant);
> literal markdown bare-`@` end-to-end is P1.M2.T2.S1's integration tests.

---

## Goal

**Feature Goal:** Wire the `markdownBareAtImports` config (PRD §4.6) end-to-end from the `session_start` event into the
pipeline's shared state, WITHOUT changing any top-level user-prompt behavior: (1) `State` carries `bareAt`; (2) a
module-level `cfg` cache is loaded once on `session_start` via the already-shipped `readConfig`; (3) the `input` handler
derives `bareAt = cfg.markdownBareAtImports === true` and passes it into `injectFiles` (Option A param); (4) `injectFiles`
sets `state.bareAt` and calls the top-level `processTokenStream` with `bareAt:false` (always — §4.6). The result: top-level
`#@` behavior is byte-for-byte identical (bare-`@` never matches at the top level), while `state.bareAt` is correctly
derived and available as the seam P1.M2.T2.S1's `injectMarkdown` will read.

**Deliverable:** Modified `file-injector.ts` (State +`bareAt`; processTokenStream +`bareAt` opt; injectFiles +`bareAt` param
+ State init + top-level scan call `bareAt:false`; module-level `cfg`; factory: +config `session_start` handler + input
handler passes `cfg.markdownBareAtImports === true`) + modified `file-injector.test.mjs` (`makeMockCtx` +`isProjectTrusted`;
`captureHandler` additively +`.all`; 5 new integration/unit cases). No new exports, no new fixtures, no `injectMarkdown` change.

**Success Definition:**
1. `npm run typecheck` → `0 errors` under `--strict`.
2. `node ./file-injector.test.mjs` → baseline (102: 92 + T1.S1's 6 + T2.S1's 4) + 5 new cases all PASS, exit 0.
3. Top-level `#@` behavior is byte-for-byte identical (existing 92 cases stay green; the top-level scan passes `bareAt:false`
   regardless of config, so a top-level bare `@b.ts` is NEVER injected even when `markdownBareAtImports:true`).
4. `state.bareAt` is correctly derived from config and set (the seam for P1.M2.T2.S1); the config-load→handler→injectFiles
   path runs without error for both trusted and untrusted projects.

## User Persona

**Target User:** A Pi end-user who opts into bare-`@` markdown imports (wiki-style `@api.md` inside a markdown file) via
`~/.pi/agent/file-injector.json` (global) or `<project>/.pi/file-injector.json` (trusted projects only), config
`{"markdownBareAtImports": true}`.

**Use Case:** The user writes the config, starts a session, and writes a markdown file containing `@api.md`. This subtask
delivers the config-loading + state-threading plumbing; the user-visible bare-`@`-in-markdown injection lands in P1.M2.T2.S1
(which reads `state.bareAt`).

**User Journey (end-to-end, completed across M2):** config → `session_start` → `cfg = await readConfig(ctx)` (THIS TASK) →
`input` → `bareAt = cfg.markdownBareAtImports === true` → `injectFiles(…, bareAt)` → `state.bareAt` set (THIS TASK) →
`injectMarkdown` scans with `bareAt: state.bareAt` (P1.M2.T2.S1) → bare `@api.md` matched + injected.

**Pain Points Addressed:** Without this wiring, `readConfig` (T2.S1) is dormant and `state.bareAt` doesn't exist — there is
no path from the config file to the scan engine. This subtask builds that path while guaranteeing the top-level user prompt
is completely unaffected (bare-`@` stays markdown-only).

## Why

- **Connects the config foundation (T2.S1) to the scan engine (T1.S1).** `readConfig` is shipped but uncalled; `scanTokens`
  accepts `bareAt?` but no caller passes `true`. This subtask is the bridge: config → `cfg` → `bareAt` → `state.bareAt` →
  (later) `injectMarkdown`'s scan call.
- **Top-level safety is a hard invariant (§4.6).** Bare-`@` is markdown-ONLY — it must NEVER match in the user prompt
  (Pi's own `@file`/`@mention` would collide). Hardcoding `bareAt:false` on the top-level `processTokenStream` call + an
  integration test (bare `@b.ts` not injected even with config on) locks this end-to-end.
- **`cfg` module-level is load-bearing for the test harness.** `captureHandler` calls `mod.default(pi)` fresh per capture;
  a factory-closure `cfg` would be reset to `{}` on each capture, making the session_start→input test flow impossible.
  Module-level `cfg` persists across captures (and is identical in the real single-invocation runtime).
- **Option A (param) keeps `injectFiles` unit-testable.** `injectFiles` takes `bareAt` as a param and does NOT read `cfg` —
  so existing direct `mod.injectFiles(text, [], FIX)` calls keep working (param defaults `false`), and the top-level
  `bareAt:false` invariant is directly unit-testable.
- **Decoupled from `injectMarkdown` for clean, independently-green subtasks.** This task threads `state.bareAt` through the
  top-level pipeline + factory; P1.M2.T2.S1 wires it into the markdown branch. Each ships + tests independently.

## What

No user-visible behavior change at the top level (bare-`@` never matches in the user prompt; `#@` injection is identical).
Internally: `State` gains a field, the factory loads config on `session_start`, the input handler derives + passes `bareAt`,
and `injectFiles`/`processTokenStream` accept + forward `bareAt` (top-level always `false`).

### Success Criteria

- [ ] `interface State` has `bareAt: boolean` (REQUIRED).
- [ ] A **module-level** `let cfg: FileInjectorConfig = {};` exists (NOT inside the factory closure), right before `export default function`.
- [ ] The factory registers a `session_start` handler that runs `cfg = await readConfig(ctx);` (registered BEFORE the
      existing autocomplete `session_start`, so `captureHandler("session_start").all[0]` is the config handler).
- [ ] The `input` handler calls `injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true)`.
- [ ] `injectFiles(text, imagesIn, ctx, bareAt = false)` — 4th param; `state.bareAt = bareAt`; the top-level
      `processTokenStream` call passes `bareAt:false` (hardcoded); the top-level `#@` strip (`slice(0,i)+slice(i+2)`) is UNCHANGED.
- [ ] `processTokenStream` opts includes `bareAt: boolean` (REQUIRED — single caller passes `bareAt:false`).
- [ ] `makeMockCtx` accepts `isProjectTrusted` (default `() => true`); `captureHandler` returns `{ cb, all }` (additive — `.cb` unchanged).
- [ ] 5 new cases pass (see Implementation Tasks): config-load trusted (regression), config-load untrusted (smoke), top-level
      safety via handler (KEY), direct injectFiles bareAt-param doesn't break #@, direct injectFiles top-level `bareAt:false`.
- [ ] NO changes to `injectMarkdown` (its scan call, `injectable` type, Step-4 strip = P1.M2.T2.S1), NO new exports, NO new fixtures.
- [ ] Existing 92 + T1.S1's 6 + T2.S1's 4 cases stay GREEN (cfg stays `{}` when session_start isn't driven → `bareAt=false` → byte-for-byte).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_ **Yes.**
This PRP includes: the exact current line refs (against the LANDED T1.S1+T2.S1 tree), the CRITICAL module-level-`cfg`
rationale (captureHandler calls `mod.default(pi)` per capture), the factory-shape decision (separate session_start + additive
captureHandler — with the A1-test-breakage proof that rules out merge), the Option-A-vs-B decision, the top-level-`bareAt:false`
invariant + why the strip stays `+2`, the test-scope boundary (cases a/b literal need injectMarkdown = next task; my task's
observable invariant is top-level safety), the 5 exact test specs (reusing existing `a.ts`/`b.ts`/`.pi` fixtures), and both
verified gates. The implementer edits one source file in ~7 small regions + one test file (2 harness tweaks + 5 cases).

### Documentation & References

```yaml
# MUST READ — the function-level delta contract for THIS plan (§4 State.bareAt, §6 processTokenStream, §7 injectFiles, §9 factory)
- file: plan/005_b7c78dbf73b1/architecture/codebase_delta.md
  why: "§4 pins State.bareAt; §6 pins processTokenStream +bareAt (top-level=false) + the UNCHANGED +2 strip; §7 pins
        injectFiles State init + top-level scan call (Option A param vs Option B cfg-read) + bareAt:false; §9 pins the
        factory: module-level cfg + session_start load (merge OR separate) + input handler reads cfg."
  critical: "§6 is explicit: 'Top-level marker strip is UNCHANGED — processTokenStream pushes r.index (just the index),
             and injectFiles strips with hardcoded +2 (correct because top-level is always #@, prefixLen 2). No prefixLen
             needed at the top level — do NOT over-engineer this.' §7 recommends Option A (param) for testability. §9 notes
             two session_start handlers are fine OR merge — this PRP picks SEPARATE (see Known Gotchas for WHY)."

# MUST READ — the spec for §4.6 (Loading: session_start reads cfg + caches; input reads cached) + the §9 factory pseudocode
- file: PRD.md
  why: "§4.6 'Loading': 'Config is read on session_start (which provides ctx.cwd and ctx.isProjectTrusted()) and CACHED for
        the session; the input handler reads the cached value.' §9 pseudocode: module-level `let cfg`, a session_start
        `cfg = await readConfig(ctx)`, State.bareAt = `cfg.markdownBareAtImports === true`, top-level scan `bareAt:false`."
  section: "### 4.6 (Loading paragraph) + ## 9 (Algorithm pseudocode: factory + State + processTokenStream)"

# The PREDECESSOR PRP (the readConfig CONTRACT I consume) — read to know readConfig's exact signature/behavior
- file: plan/005_b7c78dbf73b1/P1M1T2S1/PRP.md
  why: "readConfig(ctx: {cwd; isProjectTrusted}): Promise<FileInjectorConfig> is ALREADY shipped (LANDED). My session_start
        handler calls it verbatim: `cfg = await readConfig(ctx)`. Do NOT re-add readConfig/FileInjectorConfig/imports — they
        exist. The .pi/file-injector.json fixture ({markdownBareAtImports:true}) ALSO already exists (T2.S1 buildFixtures)."
  critical: "readConfig NEVER throws (tryRead catches read+parse → {}). So `await readConfig(ctx)` on session_start is safe
             even with a malformed config. ctx needs cwd + isProjectTrusted (the real ExtensionContext has both)."

# The file you edit (source) — the 7 small regions
- file: file-injector.ts
  why: "879 lines (post T1.S1+T2.S1). State iface L253; processTokenStream sig L523; injectFiles sig L710; injectFiles State
        literal L783; injectFiles top-level processTokenStream call L799; top-level #@ strip ~L806; factory `export default`
        L819 (input handler L820, autocomplete session_start L848). readConfig at L155, FileInjectorConfig at L146 (EXIST)."
  pattern: "State is built INSIDE injectFiles (L783), not in the handler — so bareAt must reach State via the injectFiles
            param (Option A). The factory's input handler is the ONLY place cfg is read; injectFiles stays stateless re cfg."
  gotcha: "cfg MUST be MODULE-LEVEL (before `export default`), NOT inside the factory closure. captureHandler calls
           mod.default(pi) fresh per capture → a closure cfg resets to {} each time → the session_start→input test flow
           breaks. Module-level cfg persists across captures. See Known Gotchas CRITICAL."

# The gate you also edit (test harness) — makeMockCtx + captureHandler (additive) + 5 cases
- file: file-injector.test.mjs
  why: "makeMockCtx L158 (add isProjectTrusted default true); captureHandler L166 (additively return {cb, all}); A1
        autocomplete test L895 (UNTOUCHED — proves separate-session_start is safe); T2.S1 readConfig unit tests L1850-1886
        (PLACE new cases AFTER, before '10. Summary' L1892). FIX={cwd:TMPDIR} L311; A_TS L291, B_TS L292 (reused)."
  pattern: "new runCase blocks: (a/b) drive `captureHandler('session_start').all[0]({}, makeMockCtx(TMPDIR[, {isProjectTrusted}]).ctx)`
            then `captureHandler('input').cb({text,source,images}, ctx)`; (c) same + assert bare @b.ts NOT injected; (d/e)
            `mod.injectFiles(text, [], FIX, true)` direct. Assert on r.injected VALUE + presence/absence of <file> blocks."
  gotcha: "captureHandler MUST stay backward-compatible: existing ~30 callers use `.cb` (the LAST handler). Add `.all`
           (every handler for the event) WITHOUT changing `.cb`. For 'session_start' after this task, `.all=[config, autocomplete]`,
           `.cb`=autocomplete (A1 still captures + passes with its minimal ctx). For 'input', `.all=[input]`, `.cb`=input."

# VERIFIED API — session_start ctx has cwd + isProjectTrusted (so readConfig typechecks + runs on the real ctx)
- file: plan/005_b7c78dbf73b1/architecture/api_verification.md
  why: "§3: session_start ExtensionHandler receives (event, ctx: ExtensionContext); ExtensionContext has cwd + isProjectTrusted()
        (types.d.ts:842,226,221). So `cfg = await readConfig(ctx)` typechecks + the real ctx satisfies readConfig's narrow type.
        Pi appends handlers per event → two session_start handlers (config + autocomplete) both fire."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "`npm run typecheck` runs tsc --strict against the global pi .d.ts. Must stay 0 errors. State.bareAt (required) only
        forces the ONE injectFiles literal (L783) to set it — the .mjs State literals aren't typechecked. processTokenStream
        bareAt (required) has ONE caller (injectFiles L799). cfg: FileInjectorConfig typechecks (interface exists L146)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (State L253; processTokenStream L523; injectFiles L710/783/799; cfg ~L818; factory L819)
├── file-injector.test.mjs    # ← EDITED (makeMockCtx L158; captureHandler L166; +5 cases before L1892 Summary)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README = P1.M3.T2.S1)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{codebase_delta.md, api_verification.md, system_context.md}
    ├── P1M1T1S1/{research, PRP.md}   # LANDED: BARE_AT_RE + scanTokens bareAt?/prefixLen
    ├── P1M1T2S1/{research, PRP.md}   # LANDED: readConfig + FileInjectorConfig + imports + .pi fixture
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — State +bareAt; processTokenStream +bareAt opt (required); injectFiles +bareAt param +
                          #                  State.bareAt init + top-level scan bareAt:false; +module-level cfg; factory
                          #                  +config session_start handler + input handler passes cfg.markdownBareAtImports===true.
file-injector.test.mjs    # MODIFIED — makeMockCtx +isProjectTrusted; captureHandler +additive .all; +5 integration/unit cases.
# No other files. No new files. No new exports (cfg is module-private). No new fixtures (reuse .pi + a.ts/b.ts). No injectMarkdown change.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — cfg MUST be MODULE-LEVEL, NOT inside the factory closure.
//   captureHandler (file-injector.test.mjs:166) creates a FRESH mock pi and calls mod.default(pi) on EVERY capture. If cfg
//   is a closure var inside `export default function (pi) { let cfg = {}; ... }`, each mod.default(pi) creates a NEW closure
//   with cfg={}. Then captureHandler('session_start') sets closure1.cfg, but captureHandler('input') reads closure2.cfg={}
//   (session_start never driven on pi2) → bareAt=false → the config never reaches the input path in tests. MODULE-LEVEL cfg
//   (`let cfg: FileInjectorConfig = {};` right BEFORE `export default function`) is shared across mod.default(pi) invocations
//   → the session_start capture sets it, the input capture reads it. (The real runtime calls the factory once per session,
//   so module-level is identical there.) The item §3b says "module-level" — this is WHY (overrides PRD §9's nested-closure form).

// CRITICAL — use a SEPARATE session_start handler for config load (NOT merge into the autocomplete handler).
//   The existing A1 autocomplete test (file-injector.test.mjs:895-900) invokes captureHandler("session_start").cb with MINIMAL
//   ctx shapes {cwd} / {cwd, ui:{}} — NO isProjectTrusted. If you MERGE `cfg = await readConfig(ctx)` into the autocomplete
//   session_start handler, readConfig's `ctx.isProjectTrusted()` throws TypeError on those minimal ctx → A1 BREAKS. A SEPARATE
//   config session_start handler (registered FIRST) leaves the autocomplete handler byte-for-byte unchanged → captureHandler
//   still captures the autocomplete handler as .cb (the LAST registered) → A1 passes with its minimal ctx (autocomplete guard
//   short-circuits; readConfig never runs on the autocomplete handler). My config test grabs the config handler via .all[0].

// CRITICAL — captureHandler MUST stay backward-compatible (additive .all, keep .cb).
//   ~30 existing callers use slot.cb. Change captureHandler to: `const cbs=[]; const pi={on:(ev,cb)=>{if(ev===event)cbs.push(cb)}};
//   mod.default(pi); return { cb: cbs[cbs.length-1], all: cbs };`. .cb = LAST handler (backward compat); .all = every handler
//   for the event. For 'session_start' (now 2 handlers): .all=[config, autocomplete], .cb=autocomplete. For 'input': .all=[input], .cb=input.

// CRITICAL — the TOP-LEVEL scan call hardcodes bareAt:false (do NOT pass bareAt:state.bareAt or bareAt:bareAt there).
//   §4.6: bare-@ is markdown-ONLY. The user prompt must NEVER match bare @ (Pi's @file/@mention would collide). So the top-level
//   processTokenStream call passes bareAt:false REGARDLESS of state.bareAt. state.bareAt is set (from the param) but is the SEAM
//   for injectMarkdown (P1.M2.T2.S1) — it is UNUSED at the top level in this subtask. An integration test (case c) pins this:
//   with markdownBareAtImports:true (bareAt derived true), a top-level bare @b.ts (file exists) is NOT injected.

// CRITICAL — the top-level #@ marker strip is UNCHANGED: slice(0, i) + slice(i + 2).
//   processTokenStream returns number[] (just indices); the top-level is ALWAYS #@ (prefixLen 2), so +2 is correct. Do NOT add
//   prefixLen to the top-level path or change +2. (prefixLen-aware stripping is injectMarkdown's Step 4 = P1.M2.T2.S1.)

// GOTCHA — make processTokenStream's bareAt REQUIRED (not optional). It has EXACTLY ONE caller (injectFiles L799) and is PRIVATE
//   (not exported, no direct test calls). Unlike scanTokens (3 callers + tests → T1.S1 made it optional), processTokenStream's
//   single caller passes bareAt:false → required is safe + matches codebase_delta §6's target signature. No typecheck cascade.

// GOTCHA — make State.bareAt REQUIRED. State is constructed in EXACTLY ONE place in file-injector.ts (the injectFiles literal
//   L783). The .mjs scanTokens unit-test State literals lack bareAt, but the .mjs is NOT typechecked (tsc checks only .ts) and
//   scanTokens reads only state.injectedSet (never bareAt) → those literals work at runtime unchanged. So required bareAt only
//   forces the one injectFiles literal to set it.

// GOTCHA — Option A (bareAt param) keeps injectFiles unit-testable + existing direct calls byte-for-byte. injectFiles(text,
//   imagesIn, ctx, bareAt=false): existing mod.injectFiles(text, [], FIX) calls pass 3 args → bareAt defaults false → state.
//   bareAt=false, top-level scan bareAt:false → identical to today. The input handler is the ONLY cfg reader. Do NOT make
//   injectFiles read the module-level cfg (Option B) — it couples injectFiles to module state and breaks direct unit testing.

// GOTCHA — existing input-handler tests stay GREEN with no edits. They do NOT drive session_start → cfg stays {} (module
//   default) → cfg.markdownBareAtImports === true → false → injectFiles(…, false) → byte-for-byte. The !text.includes("#@")
//   pre-check and all downstream logic are unchanged.

// GOTCHA — cfg is module-level and PERSISTS across captureHandler calls within one test run. This is INTENTIONAL (needed for
//   the session_start→input flow) and HARMLESS in this subtask: top-level ignores bareAt, and injectMarkdown isn't wired yet.
//   Each config test drives session_start with its DESIRED config at the start (deterministic) before reading via input.
//   Place the config cases at the END (before Summary) to minimize any theoretical cross-contamination.

// GOTCHA — readConfig reads the REAL ~/.pi/agent/file-injector.json (getAgentDir → real home dir) first. A real global config
//   may exist on the test machine. HARMLESS: trusted cases → project config sets markdownBareAtImports:true (project wins via
//   spread); untrusted case → project skipped, but top-level IGNORES bareAt (smoke test). No test-env assumption about global.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step. jiti transpiles-on-load (no strict type-check at load), BUT
//   `npm run typecheck` (tsc --strict) IS a separate gate that WILL catch a type error. Both gates: `npm run typecheck` AND
//   `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

One field added to an existing interface; one module-level cache var. No new runtime data structures.

```ts
/** §4.6 — markdown bare-"@" imports enabled? Derived from the cached cfg (loaded on session_start) and threaded into
 *  State. Set in injectFiles from the bareAt param; UNUSED at the top level (the top-level scan always passes bareAt:false)
 *  — it is the SEAM P1.M2.T2.S1's injectMarkdown reads (`bareAt: state.bareAt`). */
// (add to interface State, ~L253)
interface State {
  blocks: string[];
  images: ImageContent[];
  injectedSet: Set<string>;
  remaining: number | null;
  count: number;
  paged: number;
  bareAt: boolean;   // §4.6 — markdown bare-"@" imports enabled? (top-level scan ignores this; injectMarkdown reads it)
}
```

### The source edits (file-injector.ts)

```ts
// ── (1) State interface (~L253) — add bareAt ──
//   See Data models above. REQUIRED field.

// ── (2) processTokenStream signature (~L523) — add bareAt (REQUIRED; single caller) ──
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },   // + bareAt (REQUIRED)
  state: State,
  ctx: Ctx,
): Promise<number[]> {
  // body UNCHANGED — it forwards `opts` straight to scanTokens (whose bareAt is optional; supertype usage, typecheck-clean).
  const records = await scanTokens(text, baseDir, opts, state);
  // … (rest unchanged)
}

// ── (3) injectFiles signature (~L710) — add bareAt = false param (Option A) ──
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false,   // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }> {

// ── (4) injectFiles State init (~L783) — set state.bareAt from the param ──
  const state: State = {
    blocks: [],
    images: [...imagesIn],
    injectedSet: priorPaths,
    remaining,
    count: 0,
    paged: 0,
    bareAt,   // §4.6 — from the param; the SEAM injectMarkdown (P1.M2.T2.S1) reads via `bareAt: state.bareAt`
  };

// ── (5) injectFiles top-level scan call (~L799) — pass bareAt:false (HARDCODED; top-level is #@-only) ──
  const resolvedIdx = await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
  // ^ §4.6: bare-@ is markdown-ONLY. The top-level scan ALWAYS passes bareAt:false, regardless of state.bareAt.
  // The top-level #@ strip below (slice(0,i)+slice(i+2)) is UNCHANGED — top-level is always #@ (prefixLen 2).

// ── (6) module-level cfg cache (~L818, right BEFORE `export default function`) ──
/** §4.6 — the cached file-injector.json config. MODULE-LEVEL (NOT a factory closure): the test harness's captureHandler
 *  calls the factory (mod.default(pi)) fresh per capture, so a closure cfg would reset to {} on each capture and the
 *  session_start→input flow could not share state. Module-level persists across captures (and is identical in the real
 *  single-invocation runtime). Loaded once on session_start via readConfig; read by the input handler to derive bareAt. */
let cfg: FileInjectorConfig = {};

// ── (7) factory (~L819) — config session_start handler (FIRST) + input handler passes bareAt ──
export default function (pi: ExtensionAPI) {
  // §4.6 — load file-injector.json config on session_start (provides ctx.cwd + ctx.isProjectTrusted()). Registered FIRST so
  // captureHandler("session_start").all[0] is this handler. readConfig NEVER throws (tryRead → {}), so this can't break the
  // session. A separate handler (not merged into autocomplete) so the autocomplete handler + its A1 test stay byte-for-byte.
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    if (event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text?.includes("#@")) return { action: "continue" };
    // §4.6 — derive bareAt from the cached cfg (loaded on session_start); pass into injectFiles (Option A param).
    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);
    if (!injected) return { action: "continue" };
    const whole = injected - paged;
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info");
    return { action: "transform" as const, text, images };
  });

  pi.on("session_start", (_event, ctx) => {
    // … EXISTING autocomplete provider registration — UNCHANGED …
  });
}
```

### The test-harness edits (file-injector.test.mjs)

```js
// ── (8) makeMockCtx (L158) — add isProjectTrusted (default true); harmless for input tests ──
function makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, isProjectTrusted, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,
  };
}

// ── (9) captureHandler (L166) — additively return { cb, all } (backward compatible) ──
function captureHandler(event = "input") {
  const cbs = [];
  const pi = { on: (ev, cb) => { if (ev === event) cbs.push(cb); } };
  mod.default(pi);
  return { cb: cbs[cbs.length - 1], all: cbs };   // .cb = LAST (backward compat); .all = every handler for `event`
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD bareAt to State (file-injector.ts ~L253)
  - ADD field: `bareAt: boolean;` (REQUIRED) to interface State, with the §4.6 JSDoc (see Data models).
  - WHY REQUIRED: State is constructed in exactly ONE .ts site (injectFiles L783) — forcing it there is correct + clean.
  - DO NOT touch the .mjs scanTokens State literals (not typechecked; scanTokens reads only injectedSet).

Task 2: ADD bareAt opt to processTokenStream (file-injector.ts ~L523)
  - CHANGE opts type: add `bareAt: boolean` (REQUIRED — single caller injectFiles passes bareAt:false).
  - BODY UNCHANGED: it forwards `opts` to scanTokens (whose bareAt is optional → supertype usage, typecheck-clean).
  - DO NOT add prefixLen to processTokenStream's return (it stays number[]; top-level is #@-only).

Task 3: ADD bareAt param to injectFiles + State init + top-level scan call (file-injector.ts L710/783/799)
  - SIG: `injectFiles(text, imagesIn, ctx, bareAt = false)` (4th param, default false — Option A).
  - STATE INIT (L783): add `bareAt,` to the State literal (from the param).
  - TOP-LEVEL SCAN CALL (L799): add `bareAt: false` to the opts literal (HARDCODED — §4.6; do NOT pass bareAt or state.bareAt).
  - UNCHANGED: the top-level #@ strip (slice(0,i)+slice(i+2), ~L806); injectMarkdown (L692); everything else in injectFiles.
  - JSDoc (Mode A — item §6): note the bareAt param (derived from cfg in the handler; default false for direct unit tests),
    state.bareAt as the injectMarkdown seam, and that the top-level scan hardcodes bareAt:false (§4.6 markdown-only).

Task 4: ADD module-level cfg cache (file-injector.ts ~L818, right before `export default function`)
  - ADD: `let cfg: FileInjectorConfig = {};` with the §4.6 JSDoc (MODULE-LEVEL — see Known Gotchas CRITICAL for the
    captureHandler-persistence rationale; loaded on session_start; read by the input handler).
  - DO NOT declare cfg inside the factory closure (breaks the session_start→input test flow — see Known Gotchas).

Task 5: ADD the config session_start handler + wire the input handler (file-injector.ts factory ~L819)
  - ADD (FIRST in the factory body, before the input handler): `pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });`
    with a §4.6 JSDoc (config load; why separate from autocomplete; readConfig never throws).
  - CHANGE the input handler's injectFiles call to pass the 4th arg: `injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true)`.
  - UNCHANGED: the input handler's pre-checks + notify; the autocomplete session_start handler (byte-for-byte).
  - REGISTRATION ORDER: config session_start FIRST → captureHandler("session_start").all[0] is the config handler.

Task 6: EDIT makeMockCtx + captureHandler (file-injector.test.mjs L158/L166)
  - makeMockCtx: add `isProjectTrusted = () => true` (default) to opts + `isProjectTrusted` to the returned ctx.
  - captureHandler: return `{ cb: cbs[cbs.length-1], all: cbs }` (additive; .cb unchanged for the ~30 existing callers).
  - DO NOT touch ASSERTED_EXPORTS / PURE_HELPERS_NOT_ASSERTED / the sanity list (no new exports; cfg is module-private).

Task 7: ADD 5 integration/unit cases (file-injector.test.mjs, after T2.S1 block L1886, before "10. Summary" L1892)
  - Reuse existing fixtures: TMPDIR/.pi/file-injector.json (T2.S1, markdownBareAtImports:true), a.ts/b.ts, A_TS/B_TS.
  - (a) M2.T1.S1-a "session_start loads config (trusted) + input pipeline runs (regression)":
        const sslot = captureHandler("session_start");
        await sslot.all[0]({}, makeMockCtx(TMPDIR).ctx);   // cfg = readConfig({cwd:TMPDIR, isProjectTrusted:()=>true}) → markdownBareAtImports:true
        const islot = captureHandler("input");
        const out = await islot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
        assert(out.action === "transform", `#@a.ts must inject with config loaded; got ${JSON.stringify(out)}`);
        assert(out.text.includes(`<file name="${A_TS}">`), "a.ts block present");
  - (b) M2.T1.S1-b "trust-gate path runs (untrusted) — smoke, no crash; #@ still injects":
        const sslot = captureHandler("session_start");
        await sslot.all[0]({}, makeMockCtx(TMPDIR, { isProjectTrusted: () => false }).ctx);  // project skipped → cfg.markdownBareAtImports undefined
        const islot = captureHandler("input");
        const out = await islot.cb({ text: "Review #@a.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
        assert(out.action === "transform", `#@a.ts must inject even when untrusted (top-level unaffected); got ${JSON.stringify(out)}`);
  - (c) M2.T1.S1-c "TOP-LEVEL SAFETY — bare @ NEVER injects at top level (even with bareAt config on)"  [KEY INVARIANT]:
        const sslot = captureHandler("session_start");
        await sslot.all[0]({}, makeMockCtx(TMPDIR).ctx);   // markdownBareAtImports:true → bareAt derived true, passed to injectFiles
        const islot = captureHandler("input");
        const out = await islot.cb({ text: "Diff #@a.ts and @b.ts", source: "interactive", images: [] }, makeMockCtx(TMPDIR).ctx);
        assert(out.action === "transform", `#@a.ts must inject; got ${JSON.stringify(out)}`);
        assert(out.text.includes(`<file name="${A_TS}">`), "a.ts block present (the #@ token injected)");
        assert(!out.text.includes(`<file name="${B_TS}">`), `bare @b.ts must NOT inject at top level even with bareAt config on; b.ts block must be absent`);
        // PROOF: both a.ts and b.ts exist; if the top-level scan passed bareAt:true (WRONG), @b.ts WOULD inject → fail.
  - (d) M2.T1.S1-d "direct injectFiles bareAt:true param does NOT break #@ (unit)":
        const r = await mod.injectFiles("Review #@a.ts", [], FIX, true);   // bareAt param true
        assert(r.injected >= 1, `bareAt:true param must not break #@ injection; got injected=${r.injected}`);
  - (e) M2.T1.S1-e "direct injectFiles — top-level bareAt:false regardless of param (unit)":
        const r = await mod.injectFiles("Diff #@a.ts and @b.ts", [], FIX, true);   // bareAt param true, but top-level scan hardcodes false
        assert(r.injected === 1, `top-level bare @ must NOT inject even with bareAt:true param; expected injected===1, got ${r.injected}`);
        assert(!r.text.includes(`<file name="${B_TS}">`), "bare @b.ts block must be absent");
  - NAMING: runCase("M2.T1.S1-<x>", "<desc>", async () => {…}). Place under a `// ── P1.M2.T1.S1: config→pipeline wiring (session_start load + top-level bareAt:false) ──` banner.
  - NOTE in a banner comment: literal markdown bare-@ end-to-end (api.md injected / trust-gated) is P1.M2.T2.S1's integration
    tests (it owns the injectMarkdown wiring); this task's observable invariant is top-level safety + config-load plumbing.

Task 8: VERIFY gates
  - npm run typecheck → 0 errors. (If it fails: State literal missing bareAt → Task 3; processTokenStream caller missing bareAt → Task 3; cfg type → FileInjectorConfig exists L146.)
  - node ./file-injector.test.mjs → baseline 102 + 5 new = 107 passed, 0 failed. A1 + all existing cases GREEN.
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - State iface (~L253): +bareAt: boolean (REQUIRED).
  - processTokenStream (~L523): opts +bareAt: boolean (REQUIRED); body unchanged (forwards opts to scanTokens).
  - injectFiles (~L710): +4th param bareAt=false (Option A); State init (~L783) +bareAt; top-level scan call (~L799) +bareAt:false (HARDCODED).
  - module-level cfg (~L818, before export default): +let cfg: FileInjectorConfig = {}; (MODULE-LEVEL, not closure).
  - factory (~L819): +config session_start handler (FIRST); input handler injectFiles call +4th arg cfg.markdownBareAtImports===true.
  - UNCHANGED: top-level #@ strip (~L806); injectMarkdown (L692, incl. L707 scan call + L718 injectable type + Step-4 strip);
    readConfig/FileInjectorConfig/imports (L2 T2.S1); BARE_AT_RE/scanTokens (T1.S1); autocomplete session_start handler.

FILE_EDITS (file-injector.test.mjs):
  - makeMockCtx (L158): +isProjectTrusted = () => true (default) + isProjectTrusted in returned ctx.
  - captureHandler (L166): return { cb: cbs[last], all: cbs } (additive; .cb backward compat).
  - new cases (after L1886, before L1892): +5 runCase blocks (M2.T1.S1-a..e) under a banner.
  - UNCHANGED: ASSERTED_EXPORTS, PURE_HELPERS_NOT_ASSERTED, sanity list, buildFixtures (.pi fixture exists from T2.S1),
    A1 autocomplete test, every existing case/fixture/constant.

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files. NO new files. NO new exports
             (cfg is module-private; injectFiles/State/processTokenStream already on the surface/counted). NO new fixtures.
NO_INJECTMARKDOWN: the scan call (L707), injectable type (L718), Step-4 strip = ALL P1.M2.T2.S1.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails:
#   - "Property 'bareAt' is missing in type 'State'" at L783 → Task 3 didn't add `bareAt,` to the State literal.
#   - "Property 'bareAt' is missing in type '{ allowAbsTilde; skipCode; tryMdExt }'" at the processTokenStream call → Task 3
#     didn't add `bareAt:false` to the top-level opts literal.
#   - "Property 'bareAt' is missing in type" at the processTokenStream SIG opts → you made it required but a caller omits it
#     (only injectFiles L799 calls it; ensure it passes bareAt:false).
#   - "Cannot find name 'cfg'" in the factory → Task 4 didn't land (cfg must be module-level BEFORE export default).
#   - "Cannot find name 'FileInjectorConfig'" → T2.S1 didn't land (it DID — L146; re-check).
```

### Level 2: The Regression + New-Tests Gate (the .mjs suite)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 5 new M2.T1.S1-a..e cases print ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 107 passed, 0 failed.        (102 baseline + 5 new)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL checks:
#   - A1 (autocomplete) MUST still pass (proves the separate-session_start choice didn't break it). If A1 fails with a
#     TypeError on isProjectTrusted, you MERGED config-load into the autocomplete handler → revert to a SEPARATE handler.
#   - The 92 existing cases + T1.S1's 6 + T2.S1's 4 MUST stay green. If an input-handler case flips, cfg leaked a non-{}
#     value (a prior config test set it) AND something reads it — but top-level ignores bareAt, so this shouldn't happen;
#     if it does, check that the top-level scan call passes bareAt:false (NOT bareAt or state.bareAt).
#   - M2.T1.S1-c MUST pass (the KEY invariant). If it fails with "b.ts block present", the top-level scan passed bareAt:true
#     (WRONG) → fix Task 3's top-level call to hardcode bareAt:false.
```

### Level 3: Targeted invariant checks

```bash
node ./file-injector.test.mjs 2>&1 | grep -iE "M2.T1.S1|top-level|bareAt|Result:|A1 "
# Expected: 5 ✓ for M2.T1.S1-a..e; A1 ✓; "Result: 107 passed, 0 failed."
#
# If M2.T1.S1-a ✗ (not transform) → the config session_start handler didn't load cfg OR the input handler isn't passing
#   bareAt (but a #@a.ts prompt should transform regardless of bareAt — re-check the handler wiring + that .all[0] is config).
# If M2.T1.S1-c ✗ "b.ts block present" → the top-level scan passed bareAt:true (Task 3 bug); must be bareAt:false.
# If M2.T1.S1-d ✗ (injected 0) → bareAt param broke #@ (shouldn't — bareAt doesn't affect top-level #@); re-check State init.
# If M2.T1.S1-e ✗ (injected 2) → same as (c): top-level scan passed bareAt:true.
# If A1 ✗ → you merged config-load into the autocomplete handler (TypeError on minimal ctx); use a SEPARATE handler.
```

### Level 4: End-to-end config-flow sanity (ad hoc, NOT part of the gate)

```bash
# Prove the session_start→cfg→input→injectFiles flow shares the module-level cfg (run ad hoc):
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  // (Sketch — the real harness uses captureHandler; this just confirms cfg persists across two mod.default calls.)
  console.log("module loads; cfg is module-level:", typeof mod.default === "function");
'
# Expected: confirms the module loads + default is a function. The .mjs suite is the authoritative gate.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → `0 errors` under `--strict`.
- [ ] `node ./file-injector.test.mjs` → `107 passed, 0 failed`, exit 0 (102 baseline + 5 new).
- [ ] A1 (autocomplete) still passes (separate-session_start didn't break it).
- [ ] No new exports (cfg is module-private; State/processTokenStream/injectFiles already on the surface).

### Feature Validation (the wiring this task owns)

- [ ] `State` carries `bareAt` (set in injectFiles from the param).
- [ ] Module-level `cfg` is loaded on `session_start` via `readConfig` (separate handler, registered first).
- [ ] The `input` handler derives `bareAt = cfg.markdownBareAtImports === true` and passes it to `injectFiles`.
- [ ] The top-level `processTokenStream` call hardcodes `bareAt:false` (§4.6 markdown-only) — pinned by M2.T1.S1-c/e.
- [ ] With `markdownBareAtImports:true` + trusted, a top-level bare `@b.ts` (existing file) is NOT injected (M2.T1.S1-c).
- [ ] Direct `injectFiles(…, bareAt=true)` does not break `#@` (M2.T1.S1-d) and does not enable top-level bare-@ (M2.T1.S1-e).
- [ ] `cfg` stays `{}` when `session_start` isn't driven → existing input tests byte-for-byte (no cfg leak).

### Code Quality Validation

- [ ] `cfg` is MODULE-LEVEL (not a factory closure) — load-bearing for the captureHandler session_start→input flow.
- [ ] Config `session_start` handler is SEPARATE (autocomplete handler + A1 test unchanged).
- [ ] `processTokenStream` `bareAt` is REQUIRED (single caller; no cascade); `State.bareAt` is REQUIRED (single .ts construction).
- [ ] Option A (`bareAt` param) — `injectFiles` does NOT read `cfg` (stays unit-testable; existing direct calls byte-for-byte).
- [ ] Top-level `#@` strip (`slice(0,i)+slice(i+2)`) UNCHANGED; `processTokenStream` still returns `number[]` (no prefixLen at top level).
- [ ] `injectMarkdown` UNCHANGED (its scan call, `injectable` type, Step-4 strip = P1.M2.T2.S1).
- [ ] `captureHandler` change is ADDITIVE (`.cb` backward compat; `.all` added); `makeMockCtx` `isProjectTrusted` default true (harmless).

### Documentation

- [ ] JSDoc on `cfg` (module-level rationale — captureHandler persistence; loaded on session_start; read by input handler). [Mode A — item §6]
- [ ] JSDoc on the config `session_start` handler (§4.6 config load; why separate from autocomplete; readConfig never throws).
- [ ] JSDoc on `injectFiles` `bareAt` param (derived from cfg in the handler; default false for direct unit tests; state.bareAt = injectMarkdown seam).
- [ ] JSDoc on `State.bareAt` (top-level scan ignores it; injectMarkdown reads it).
- [ ] NO README change (Mode B = P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT put `cfg` inside the factory closure.** captureHandler calls `mod.default(pi)` fresh per capture → a closure `cfg`
  resets to `{}` each time → the session_start→input test flow can't share state. MODULE-LEVEL `cfg` (before `export default`).
- ❌ **Do NOT merge config-load into the autocomplete session_start handler.** The A1 test invokes it with minimal ctx `{cwd}`
  (no `isProjectTrusted`) → `readConfig`'s `ctx.isProjectTrusted()` throws → A1 breaks. Use a SEPARATE config session_start handler.
- ❂ **Do NOT make the top-level scan pass `bareAt:true` (or `bareAt:state.bareAt`/`bareAt:bareAt`).** §4.6: bare-@ is
  markdown-ONLY. The top-level `processTokenStream` call hardcodes `bareAt:false`. state.bareAt is the SEAM for injectMarkdown
  (P1.M2.T2.S1), UNUSED at the top level. M2.T1.S1-c/e pin this.
- ❌ **Do NOT change the top-level `#@` strip.** It stays `slice(0,i)+slice(i+2)` (top-level is always #@, prefixLen 2).
  `processTokenStream` still returns `number[]` (no prefixLen at the top level). prefixLen-aware strip = injectMarkdown Step 4 (P1.M2.T2.S1).
- ❌ **Do NOT touch `injectMarkdown`.** Its scan call (L707), `injectable` type (L718), Step-4 strip = ALL P1.M2.T2.S1.
  Literal markdown bare-@ end-to-end (api.md injected / trust-gated) is P1.M2.T2.S1's integration tests (#25-28).
- ❌ **Do NOT make `injectFiles` read the module-level `cfg` (Option B).** Use Option A (the `bareAt` param) — it keeps
  injectFiles unit-testable + existing direct calls byte-for-byte. The input handler is the ONLY cfg reader.
- ❌ **Do NOT break captureHandler's backward compatibility.** ~30 callers use `.cb`. Add `.all` (every handler for the event)
  WITHOUT changing `.cb` (the LAST handler). For 'session_start' (now 2 handlers): `.all=[config, autocomplete]`, `.cb`=autocomplete.
- ❌ **Do NOT make `processTokenStream`'s `bareAt` optional "to be safe".** It has ONE caller (injectFiles) and is private.
  REQUIRED matches codebase_delta §6's target + is cascade-free (unlike scanTokens, which T1.S1 made optional for its 3 callers).
- ❌ **Do NOT add `cfg`/`State.bareAt` to ASSERTED_EXPORTS or the sanity list.** `cfg` is a module-private `let` (not a function,
  not exported); State.bareAt is a field. No new exports ship → no guard sync needed (unlike T2.S1's readConfig).
- ❌ **Do NOT create new fixtures.** The `.pi/file-injector.json` (`markdownBareAtImports:true`) already exists (T2.S1 buildFixtures);
  `a.ts`/`b.ts`/`A_TS`/`B_TS`/`TMPDIR` exist. Reuse them.
- ❌ **Do NOT assume the global `~/.pi/agent/file-injector.json` is absent.** readConfig reads it first; a real global may exist.
  HARMLESS (project wins via spread when trusted; top-level ignores bareAt when untrusted). Assert on behavior, not cfg contents.

---

## Confidence Score: 9/10

A well-bounded integration-wiring subtask with a precise contract (codebase_delta §4/§6/§7/§9 + the two LANDED predecessor
PRPs). The changes are ~7 small regions in one source file + 2 additive harness tweaks + 5 cases reusing existing fixtures.
The PRP nails the three non-obvious load-bearing decisions: (1) **module-level `cfg`** (captureHandler calls mod.default(pi)
per capture → closure cfg would reset → the session_start→input test flow breaks); (2) **separate session_start handler**
(merge breaks the A1 test's minimal-ctx invocation); (3) **top-level `bareAt:false` hardcoded** (§4.6 markdown-only, pinned
by a case where both files exist so a wrong `bareAt:true` would inject the bare @). It also resolves the item's internal
scope tension honestly: literal markdown bare-@ end-to-end (cases a/b) requires the injectMarkdown wiring that is
P1.M2.T2.S1's explicit scope, so this task's OBSERVABLE invariant is top-level safety (case c) + config-load plumbing — all
fully passing, with the markdown end-to-end deferred to P1.M2.T2.S1's integration tests (#25-28). The -1 reserves for the
module-level-vs-closure `cfg` trap (easy to get wrong following the PRD §9 pseudocode's nested form; instantly caught when
M2.T1.S1-a returns `continue` instead of `transform`) and the separate-vs-merge session_start decision (merge silently breaks
A1). The implementing agent edits two files in small regions, then runs two commands.
