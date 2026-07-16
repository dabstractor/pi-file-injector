---
name: "P1.M1.T2.S1 — Add CONFIG_DIR_NAME/getAgentDir imports + FileInjectorConfig + readConfig (+ unit tests + ASSERTED_EXPORTS guard sync)"
prd_ref: "PRD §4.6 (Optional bare-@ markdown imports / config), §7 (Technical Reference: CONFIG_DIR_NAME/getAgentDir imports), §9 (Algorithm: readConfig pseudocode), §13.4 (Why almost no user-facing config)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — imports line + FileInjectorConfig + readConfig; ALSO edit file-injector.test.mjs (guard sync + unit tests + fixture)
target_language: TypeScript (jiti transpile-on-load; `npm run typecheck` = tsc --strict gate; `node ./file-injector.test.mjs` = the regression gate)
depends_on: "(none blocking — reads NO T1.S1 output; T1.S1 is parallel and touches scanTokens/BARE_AT_RE, NOT the imports line or the helpers region where readConfig lands)"
consumed_by: "P1.M2.T1.S1 (adds the module-level `cfg` var + `session_start` load `cfg = await readConfig(ctx)` + State.bareAt + threads bareAt through the pipeline)"
---

# PRP — P1.M1.T2.S1: Add CONFIG_DIR_NAME/getAgentDir imports + FileInjectorConfig + readConfig (+ unit tests + ASSERTED_EXPORTS guard sync)

> **Scope flag:** Config-foundation building block. Adds two `@earendil-works/pi-coding-agent` imports
> (`CONFIG_DIR_NAME`, `getAgentDir`), the `FileInjectorConfig` interface, an EXPORTED `readConfig` async
> function (PRD §4.6 / §9), 4 unit tests, and the module-surface guard sync (`readConfig` → ASSERTED_EXPORTS
> + a typeof sanity assert). **No behavior change yet** — readConfig is dormant until P1.M2.T1.S1 wires the
> `cfg` var + `session_start` load. The narrow typed `{cwd, isProjectTrusted}` ctx (NOT `any`) makes it
> unit-testable with a literal mock object.

---

## Goal

**Feature Goal:** Land the config-reading foundation for optional bare-`@` markdown imports (PRD §4.6): an
exported `readConfig(ctx)` that loads `file-injector.json` from the global agent dir (`~/.pi/agent/`) first,
then from the project dir (`<cwd>/.pi/`) if `ctx.isProjectTrusted()`, shallow-merged (project wins), with
missing/malformed either file defaulting to `{}` (so `markdownBareAtImports` undefined → false downstream).
Never throws. Plus the imports (`CONFIG_DIR_NAME`, `getAgentDir`) and the `FileInjectorConfig` type it
consumes/returns.

**Deliverable:** Modified `file-injector.ts` (imports line L3 gains `CONFIG_DIR_NAME, getAgentDir`; a new
`interface FileInjectorConfig { markdownBareAtImports?: boolean }`; a new `export async function readConfig(...)`
in the pure/IO helpers region near `resolveImportPath`/`isRegularFile`) + modified `file-injector.test.mjs`
(sanity list +1 typeof assert for `readConfig`; `ASSERTED_EXPORTS` Set +`"readConfig"`; a `.pi/` fixture +
project config JSON in `buildFixtures`; 4 `readConfig` unit tests). No consumer wiring (that is P1.M2.T1.S1).

**Success Definition:**
1. `npm run typecheck` → `0 errors` under `--strict` (the narrow ctx typechecks; no `any`).
2. `node ./file-injector.test.mjs` → existing baseline (incl. T1.S1's parallel scanTokens tests, if landed)
   + 4 new `readConfig` unit tests all PASS, exit 0. The module-surface guard passes (`readConfig` recognized).
3. `readConfig` is exported and pure (only reads JSON files; never throws); `FileInjectorConfig` is a type
   (no runtime export). `CONFIG_DIR_NAME`/`getAgentDir` are imported values, consumed internally by readConfig.

## User Persona

**Target User:** Pi end-user who wants to opt into bare-`@` markdown imports wiki-style (`@api.md` inside a
markdown file) via a config file, rather than always writing `#@api.md`.

**Use Case:** The user authors `~/.pi/agent/file-injector.json` (global) or `<project>/.pi/file-injector.json`
(trusted projects only) with `{"markdownBareAtImports": true}`, then writes `@api.md` in their markdown. The
config is read once on `session_start` (P1.M2.T1.S1) and the setting threads through the pipeline.

**User Journey:** (end-to-end, completed by M2) User creates config → starts session → `session_start` fires
→ `cfg = await readConfig(ctx)` → `state.bareAt = cfg.markdownBareAtImports === true` → markdown scan matches
bare `@path`. **This subtask delivers only the `readConfig` step** (loaded by M2; unit-tested directly here).

**Pain Points Addressed:** Without config, bare-`@` is impossible — every markdown import must be `#@`. With
it, users opt into the wiki-style `@` shorthand per-project (trusted only) or globally. `readConfig` is the
single chokepoint where the JSON is parsed + the trust gate is enforced + the merge precedence is applied.

## Why

- **Foundation for the §4.6 config knob, decoupled from wiring.** `readConfig` is pure (reads JSON, never
  throws) and unit-testable in isolation with a literal `{cwd, isProjectTrusted}` mock — landing it BEFORE
  the `session_start` wiring (P1.M2.T1.S1) means the hardest-to-test piece (merge precedence, trust gate,
  malformed→default) is pinned by direct unit tests, not entangled with Pi's event lifecycle.
- **The trust gate is a security boundary.** An untrusted project (`isProjectTrusted() === false`) MUST NOT
  be able to enable bare-`@` (which could auto-import files the user didn't explicitly reference). Encoding
  `if (ctx.isProjectTrusted())` in readConfig + a unit test (case c) locks this invariant.
- **Shallow-merge precedence (project wins) is a deliberate UX choice.** A user's global setting is a default;
  a trusted project can override it. The `{ ...cfg, ...project }` spread order is load-bearing — a unit test
  (case b) pins it (project `markdownBareAtImports:true` wins even if global also sets it).
- **Never-throws is a correctness invariant.** A malformed `file-injector.json` must NOT crash the session;
  it must default to `{}` (bare-`@` off). The `tryRead` try/catch → `{}` + a unit test (case d) lock this.

## What

No user-visible behavior yet (readConfig is dormant until P1.M2.T1.S1). Externally, the module gains ONE new
exported function (`readConfig`) and ONE new type (`FileInjectorConfig`, erased at runtime). The two imports
(`CONFIG_DIR_NAME`, `getAgentDir`) are consumed internally by readConfig, not re-exported.

### Success Criteria

- [ ] `npm run typecheck` → `0 errors` under `--strict`.
- [ ] `node ./file-injector.test.mjs` → `<baseline + 4> passed, 0 failed`, exit 0. Existing cases stay green.
- [ ] The imports line reads `import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";`.
- [ ] `interface FileInjectorConfig { markdownBareAtImports?: boolean; }` exists (NOT exported — type, erased at runtime).
- [ ] `export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig>`
      exists, is exported, never throws (tryRead catches all errors → `{}`), reads global then project-if-trusted
      with shallow merge (project wins).
- [ ] The sanity list has `assert(typeof mod.readConfig === "function", ...)` appended (after the `isRegularFile` assert).
- [ ] `ASSERTED_EXPORTS` Set contains `"readConfig"` (so the module-surface guard passes).
- [ ] 4 unit tests pass: (a) no config → `{}`-ish; (b) project `{markdownBareAtImports:true}` + trusted → project wins;
      (c) same project config + untrusted → ignored; (d) malformed project JSON + trusted → `{}`-ish, no throw.
- [ ] No consumer wiring added: NO `State.bareAt`, NO `cfg` var, NO `session_start` load, NO `processTokenStream`/`injectFiles`/`injectMarkdown` changes.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the exact import-line diff, the exact `FileInjectorConfig` +
`readConfig` bodies (verified against the installed pi dist), the placement landmarks (helpers region near
`resolveImportPath`), the mandatory module-surface guard sync (ASSERTED_EXPORTS + typeof assert, with the
"why it fails without" proof), the test-robustness subtlety (assert on `markdownBareAtImports` VALUE not
deepEqual, because the real `~/.pi/agent/` global may contribute unrelated keys), the 4 unit-test specs with
fixtures, and both verified gates (typecheck --strict + the .mjs suite). The implementer edits two files in
small, well-bounded regions, then runs two commands.

### Documentation & References

```yaml
# MUST READ — the function-level contract for THIS subtask (§2 imports, §3 FileInjectorConfig + readConfig)
- file: plan/005_b7c78dbf73b1/architecture/codebase_delta.md
  why: "§2 gives the EXACT imports-line diff (CONFIG_DIR_NAME, getAgentDir) + notes they're VERIFIED exported;
        §3 gives the EXACT FileInjectorConfig interface + readConfig body (the tryRead helper, global-first/
        project-if-trusted, shallow merge, narrow ctx). This is the authoritative code source for T2.S1."
  section: "## 2. NEW imports: CONFIG_DIR_NAME, getAgentDir + ## 3. NEW type + NEW function: FileInjectorConfig, readConfig"
  critical: "§3 explicitly says: 'Prefer the narrow typed ctx param shown here (only cwd + isProjectTrusted are
             used) so it is unit-testable with a tiny mock — do NOT type it as any.' The PRD §9 pseudocode types
             it `ctx: any`; the item description OVERRIDES that to the narrow type. Use the narrow type."

# MUST READ — VERIFIED API surface (CONFIG_DIR_NAME=".pi", getAgentDir→~/.pi/agent, session_start ctx shape)
- file: plan/005_b7c78dbf73b1/architecture/api_verification.md
  why: "§1 CONFIG_DIR_NAME === '.pi' (dist/config.js:394); §2 getAgentDir():string → ~/.pi/agent (dist/config.js:411-418,
        overridable via PI_CODING_AGENT_DIR env); §3 session_start ctx has cwd + isProjectTrusted() (types.d.ts:226,221).
        Confirms the imports resolve + the narrow ctx matches the real ExtensionContext fields readConfig uses."
  critical: "getAgentDir() reads the REAL ~/.pi/agent/ at runtime. In the unit-test env, a real global config may
             or may not exist there. This is why readConfig unit tests assert on the markdownBareAtImports VALUE
             (project wins via spread) not deepEqual {} (global could add unrelated keys). See Known Gotchas."

# MUST READ — the spec for §4.6 config (locations, trust gate, merge, malformed→default)
- file: PRD.md
  why: "§4.6 defines the config knob (markdownBareAtImports), the two file locations (global ~/.pi/agent/ +
        project <cwd>/.pi/), the trust gate (isProjectTrusted), the shallow-merge (project wins), and the
        malformed→{} default; §7 lists the imports; §9 gives the readConfig pseudocode (ctx:any — OVERRIDE to
        narrow per item §3); §13.4 'Why (almost) no user-facing config' (markdownBareAtImports is the ONE knob)."
  section: "### 4.6 + ## 7 (imports) + ## 9 (readConfig) + ### 13.4"

# The file you edit (source) — the imports line + the helpers region
- file: file-injector.ts
  why: "879 lines. Imports line L3 (the `@earendil-works/pi-coding-agent` import — EDIT to add CONFIG_DIR_NAME,
        getAgentDir). Helpers region L95-135 (isRegularFile L101, resolveImportPath L122 — PLACE FileInjectorConfig
        + readConfig near here, after resolveImportPath ~L135, before extOf ~L138). The existing imports already
        include `node:fs` (fs.readFile), `node:path` (path.join) — readConfig needs nothing new."
  pattern: "readConfig is a pure/IO helper (reads JSON, never throws, returns FileInjectorConfig) — group it with
            the other pure/IO helpers (isRegularFile, resolveImportPath) per codebase_delta §8 file-structure list
            (section 3: Pure/IO helpers)."
  gotcha: "Do NOT re-export CONFIG_DIR_NAME or getAgentDir — they're imported VALUES consumed internally by
           readConfig. Re-exporting getAgentDir (a function) would put it on the module surface and TRIGGER the
           completeness guard (which filters typeof mod[k]==='function'). Only readConfig is a NEW export."

# The gate you also edit (test harness) — guard sync + unit tests + fixture
- file: file-injector.test.mjs
  why: "1753 lines. Sanity list L113-130 (typeof asserts — APPEND a readConfig assert after L130 isRegularFile).
        ASSERTED_EXPORTS Set L139-141 (APPEND 'readConfig' after 'isRegularFile'). buildFixtures ~L208+ (APPEND
        mkdirSync .pi/ + writeFileSync the project config JSON). Existing T1.S1 resolveImportPath unit tests at
        L1534+ (the TEMPLATE for direct mod.X unit tests). Tail '10. Summary' block at the end (place new tests
        BEFORE it). runCase(name, desc, async fn) harness; assert(cond, msg) throws on failure."
  pattern: "new runCase blocks call `await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => <bool> })`
            directly and assert on r.markdownBareAtImports (VALUE, not deepEqual). Mirror the T1.S1-1..7 style."
  gotcha: "The module-surface guard (L143-150) filters typeof mod[k]==='function' and fails if a shipped function
           is in NEITHER ASSERTED_EXPORTS nor PURE_HELPERS_NOT_ASSERTED. Adding readConfig (exported fn) WITHOUT
           syncing ASSERTED_EXPORTS → 'module ships functions not in the sanity list: readConfig'. MUST add both
           the typeof assert AND the ASSERTED_EXPORTS entry. FileInjectorConfig is a type (no runtime fn) → NOT
           subject to the guard; no entry needed."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "`npm run typecheck` runs tsc --strict against the global pi .d.ts. Must stay 0 errors. The narrow ctx
        type {cwd: string; isProjectTrusted: () => boolean} is --strict-clean and structurally compatible with
        the real ExtensionContext (which has both fields among others) — so P1.M2.T1.S1's `cfg = await
        readConfig(ctx)` call will typecheck too."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (imports line L3 + FileInjectorConfig + readConfig ~L135)
├── file-injector.test.mjs    # ← EDITED (sanity +1, ASSERTED_EXPORTS +1, buildFixtures +.pi fixture, +4 unit tests)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched (typecheck + test scripts present)
├── PRD.md / README.md        # read-only (README = P1.M3.T2.S1)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{codebase_delta.md, api_verification.md, system_context.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← parallel (BARE_AT_RE/scanTokens); NO region overlap with T2.S1
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← guard-sync + test-robustness analysis + fixture plan (this subtask)
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — imports line +CONFIG_DIR_NAME, getAgentDir; +interface FileInjectorConfig;
                          #                  +export async function readConfig (helpers region near resolveImportPath).
file-injector.test.mjs    # MODIFIED — sanity list +1 typeof assert (readConfig); ASSERTED_EXPORTS +"readConfig";
                          #                  buildFixtures +.pi/ dir + project config JSON; +4 readConfig unit tests.
# No other files. No new files. No consumer wiring (State.bareAt/cfg/session_start = P1.M2.T1.S1).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the module-surface guard (file-injector.test.mjs L143-150) WILL FAIL if you export readConfig
//   without syncing it. The guard does:
//     shippedFunctions = Object.keys(mod).filter(k => typeof mod[k] === "function");
//     unexpected = [...shippedFunctions].filter(k => !ASSERTED_EXPORTS.has(k) && !PURE_HELPERS_NOT_ASSERTED.has(k));
//     assert(unexpected.length === 0, `module ships functions not in the sanity list: ${unexpected.join(", ")}`);
//   Adding `export async function readConfig` puts "readConfig" in shippedFunctions. It's NOT in ASSERTED_EXPORTS
//   (yet) and NOT in PURE_HELPERS_NOT_ASSERTED → the guard fails with "module ships functions not in the sanity
//   list: readConfig". FIX: (1) append `assert(typeof mod.readConfig === "function", "...")` to the sanity list
//   (after L130); (2) append "readConfig" to ASSERTED_EXPORTS (after "isRegularFile"). BOTH edits are required.

// CRITICAL — FileInjectorConfig is an interface (TYPE), erased at runtime. It does NOT appear in shippedFunctions
//   (typeof mod["FileInjectorConfig"] === "undefined", not "function"), so it needs NO sanity assert and NO
//   ASSERTED_EXPORTS entry. Do NOT add it to either — it would be a no-op/confusing.

// CRITICAL — do NOT re-export CONFIG_DIR_NAME or getAgentDir. They are imported VALUES (a string + a function)
//   consumed internally by readConfig. Re-exporting getAgentDir (a function) would put it on the module surface
//   and TRIGGER the completeness guard. Only `readConfig` is a new export. (CONFIG_DIR_NAME is a string, so even
//   if it leaked it wouldn't match the typeof==="function" filter — but don't re-export it anyway; it's internal.)

// CRITICAL — type the ctx param NARROW: { cwd: string; isProjectTrusted: () => boolean }, NOT `any`.
//   (1) Item §3 explicitly requires it ("do NOT type it as any"). (2) It's --strict-clean. (3) It's unit-testable
//   with a literal mock: `mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true })`. (4) It's structurally
//   compatible with the real ExtensionContext (which has cwd + isProjectTrusted among other fields), so
//   P1.M2.T1.S1's `cfg = await readConfig(ctx)` typechecks. The PRD §9 pseudocode `ctx: any` is OVERRIDDEN.

// CRITICAL — readConfig unit tests MUST assert on the markdownBareAtImports VALUE, NOT deepEqual {} / {markdownBareAtImports:true}.
//   getAgentDir() reads the REAL ~/.pi/agent/file-injector.json at runtime. If a real global config exists on the
//   test machine (with ANY keys), it merges into the result. So:
//     case (b): assert r.markdownBareAtImports === true (project WINS via spread, even if global also sets it).
//               Do NOT assert deepEqual {markdownBareAtImports:true} (global could add unrelated keys).
//     case (c): assert r.markdownBareAtImports === undefined (untrusted → project NOT read → its key never lands).
//               Do NOT assert deepEqual {} (global could contribute unrelated keys).
//     case (d): assert r.markdownBareAtImports === undefined (malformed project → {} → key never lands); also
//               assert NO throw (wrap in try/catch or just rely on runCase catching a throw as FAIL).
//     case (a): assert r.markdownBareAtImports === undefined (no files → {} → undefined).
//   This is the single biggest test-robustness risk — asserting deepEqual is the natural but WRONG instinct.

// GOTCHA — the global-path merge PRECEDENCE (project wins) is structurally guaranteed by `{ ...cfg, ...project }`
//   (spread order: later keys win). It is NOT unit-tested in isolation here (would require mocking getAgentDir,
//   which reads the real home dir). Item §5 explicitly defers global-merge coverage to P1.M2.T1.S1's session_start
//   integration test. T2.S1's case (b) DOES exercise the project-wins behavior (project markdownBareAtImports:true
//   is asserted present regardless of what global contributes) — that's the robust subset testable here.

// GOTCHA — the .pi/ project-config dir does NOT exist in TMPDIR by default. buildFixtures must
//   fsSync.mkdirSync(path.join(TMPDIR, ".pi"), { recursive: true }) BEFORE writing the config JSON. Use
//   { recursive: true } so it's a no-op if a prior fixture (or a parallel subtask) already created it.

// GOTCHA — readConfig MUST NEVER throw (a malformed config must not crash the session). The tryRead helper's
//   try/catch → {} is the contract. The unit-test case (d) pins this: a malformed JSON + trusted ctx returns
//   {}-ish (markdownBareAtImports undefined), and readConfig itself does not throw. (runCase's try/catch treats
//   an uncaught throw as a FAIL, so if readConfig threw, case d would fail loudly — which is the desired signal.)

// LIBRARY — TypeScript via jiti (Pi's loader). No build step. jiti transpiles-on-load (no strict type-check at
//   load), so a type nit won't fail the test gate — BUT `npm run typecheck` (tsc --strict) IS a separate gate
//   that WILL catch a type error. Both gates must pass. A SYNTAX error or undefined-identifier reference fails
//   the harness import (sanity asserts never run → non-zero exit). The two gates: `npm run typecheck` AND
//   `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

One new interface (type, erased at runtime). No new runtime data structures beyond the local `cfg`/`tryRead`
inside readConfig.

```ts
/** §4.6 — file-injector.json config shape. markdownBareAtImports: also match bare "@path" in markdown (opt-in).
 *  Loaded on session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports undefined → false. */
interface FileInjectorConfig { markdownBareAtImports?: boolean; }
```

### The imports-line edit (file-injector.ts L3)

```diff
-import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
+import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
```

### The readConfig function (place near resolveImportPath/isRegularFile, ~L135)

```ts
/** §4.6 — file-injector.json config shape. markdownBareAtImports: also match bare "@path" in markdown
 *  (opt-in). Loaded on session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports
 *  undefined → treated as false downstream. */
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

/** PRD §4.6 / §9 — read file-injector.json config. GLOBAL first (~/.pi/agent/file-injector.json via
 *  getAgentDir()), then PROJECT-if-trusted (<cwd>/.pi/file-injector.json via CONFIG_DIR_NAME=".pi"),
 *  shallow-merged (project wins: `{ ...global, ...project }`). Missing or malformed EITHER file →
 *  default {} (markdownBareAtImports undefined → false downstream). NEVER throws (tryRead catches all
 *  read/parse errors → {}). The narrow `{cwd, isProjectTrusted}` ctx (only the two fields used) makes it
 *  unit-testable with a literal mock; do NOT type it as `any` (item §3). Consumed by P1.M2.T1.S1's
 *  session_start handler (`cfg = await readConfig(ctx)`). */
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  const tryRead = async (p: string): Promise<FileInjectorConfig> => {
    try {
      return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}");
    } catch {
      return {};
    }
  };
  // GLOBAL first (~/.pi/agent/file-injector.json).
  let cfg: FileInjectorConfig = await tryRead(path.join(getAgentDir(), "file-injector.json"));
  // PROJECT-if-trusted (<cwd>/.pi/file-injector.json), shallow-merged (project wins).
  if (ctx.isProjectTrusted()) {
    cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  }
  return cfg;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT the imports line (file-injector.ts L3)
  - CHANGE: add CONFIG_DIR_NAME and getAgentDir to the @earendil-works/pi-coding-agent import (exact diff above).
  - VERIFY: both are exported by the installed package (api_verification.md §1-2: dist/index.d.ts:2). typecheck
            resolves them against the pi .d.ts (CONFIG_DIR_NAME: string; getAgentDir: () => string).
  - DO NOT: re-export either (they're internal to readConfig). DO NOT touch the other import lines (ExtensionAPI,
            ImageContent, node:fs, node:path, node:os — all already present and sufficient).

Task 2: ADD FileInjectorConfig + readConfig (file-injector.ts, helpers region ~L135)
  - ADD: interface FileInjectorConfig { markdownBareAtImports?: boolean; } (with the §4.6 JSDoc above).
  - ADD: export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig>
         (exact body above — tryRead helper, global-first, project-if-trusted shallow merge, narrow ctx).
  - PLACEMENT: in the pure/IO helpers region, near isRegularFile (L101) / resolveImportPath (L122). Place AFTER
            resolveImportPath (~L135, before extOf ~L138) — groups the IO helpers together per codebase_delta §8.
  - JSDoc: document the two config locations, the trust gate, the shallow-merge precedence (project wins), and
            the malformed→{} default (mirrors PRD §4.6). [Mode A — item §6.]
  - TYPE: ctx is the NARROW {cwd, isProjectTrusted} — NOT any (item §3). --strict-clean.
  - DO NOT: add State.bareAt, a cfg var, session_start wiring, or any consumer change (P1.M2.T1.S1).

Task 3: SYNC the module-surface guard (file-injector.test.mjs)
  - APPEND to the sanity list (after the `assert(typeof mod.isRegularFile === "function", ...)` line ~L130):
        assert(typeof mod.readConfig === "function", "mod.readConfig must be a function (§4.6 config reader: global+project merge, trust gate, never throws)");
  - APPEND "readConfig" to the ASSERTED_EXPORTS Set (after "isRegularFile", ~L141):
        ... "resolveImportPath", "isRegularFile", "readConfig",
  - WHY: without BOTH, the completeness guard (L143-150) fails: "module ships functions not in the sanity list: readConfig".
  - DO NOT: add FileInjectorConfig to either (it's a type, not a runtime function). DO NOT touch PURE_HELPERS_NOT_ASSERTED.

Task 4: ADD the .pi/ project-config fixture (file-injector.test.mjs buildFixtures, ~L239-280)
  - ADD: fsSync.mkdirSync(path.join(TMPDIR, ".pi"), { recursive: true });   // the project config dir (CONFIG_DIR_NAME=".pi")
  - ADD: fsSync.writeFileSync(path.join(TMPDIR, ".pi", "file-injector.json"), JSON.stringify({ markdownBareAtImports: true }));
         // the project config read by cases (b) trusted and (c) untrusted and (d) malformed-overwrite.
  - ADD (for case d — malformed): a SEPARATE fixture path OR overwrite-in-test. Simplest: case (d) writes its OWN
         malformed file inline in the runCase body (fsSync.writeFileSync(...path..., "{bad")) so it doesn't
         pollute cases (b)/(c) which need the valid JSON. (See Task 5 case d.)
  - GOTCHA: { recursive: true } makes mkdirSync a no-op if .pi/ already exists (parallel-subtask-safe).
  - GOTCHA: do NOT create a global ~/.pi/agent/file-injector.json fixture (you must NOT touch the real home dir;
            item §5 defers global-merge to M2's integration test).

Task 5: ADD 4 readConfig unit tests (file-injector.test.mjs, after the T1.S1 unit-test block, before "10. Summary")
  - PATTERN: mirror the T1.S1-1..7 runCase style. Call `await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => <bool> })`
            directly (NO makeMockCtx — pass a literal object; item §5). Assert on r.markdownBareAtImports VALUE.
  - (a) T2.S1-a "readConfig no-config → markdownBareAtImports undefined":
        const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
        assert(r.markdownBareAtImports === undefined, `no config files → markdownBareAtImports undefined, got ${r.markdownBareAtImports}`);
        (NOTE: assert on the VALUE, not deepEqual {} — the real global ~/.pi/agent/ may contribute unrelated keys.)
  - (b) T2.S1-b "readConfig project {markdownBareAtImports:true} + trusted → project wins (true)":
        const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
        assert(r.markdownBareAtImports === true, `trusted project config → markdownBareAtImports true (project wins), got ${r.markdownBareAtImports}`);
        (Depends on the Task 4 fixture: <TMPDIR>/.pi/file-injector.json = {"markdownBareAtImports":true}.)
  - (c) T2.S1-c "readConfig project config + UNTRUSTED → ignored (undefined)":
        const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => false });
        assert(r.markdownBareAtImports === undefined, `untrusted project → config ignored (trust gate), markdownBareAtImports undefined, got ${r.markdownBareAtModules}`);
        (Same fixture as (b), but isProjectTrusted: () => false → the project file is NEVER read.)
  - (d) T2.S1-d "readConfig malformed project JSON + trusted → {} (undefined), no throw":
        // Overwrite the project config with malformed JSON for THIS case (don't pollute b/c):
        const cfgPath = path.join(TMPDIR, ".pi", "file-injector.json");
        const valid = fsSync.readFileSync(cfgPath, "utf8");           // save the valid content
        fsSync.writeFileSync(cfgPath, "{bad");                        // malformed JSON
        try {
          const r = await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true });
          assert(r.markdownBareAtImports === undefined, `malformed project JSON → markdownBareAtModules undefined (default {}), got ${r.markdownBareAtImports}`);
        } finally {
          fsSync.writeFileSync(cfgPath, valid);                       // RESTORE so subsequent cases (if any) see valid JSON
        }
        (The try/finally restores the fixture; if readConfig threw, runCase's catch → FAIL — the desired signal.)
  - NAMING: runCase("T2.S1-a", "readConfig ...", async () => {...}). Place under a `// ── T2.S1: readConfig unit tests (PRD §4.6) ──` banner.
  - PLACEMENT: AFTER the T1.S1 resolveImportPath/scanTokens unit-test block (L1534+), BEFORE the `// 10. Summary` tail.

Task 6: VERIFY gates
  - npm run typecheck → 0 errors. (If it fails on readConfig's ctx type, you used `any` or a wrong shape — use the narrow {cwd, isProjectTrusted}.)
  - node ./file-injector.test.mjs → baseline + 4 passed, 0 failed. The module-surface guard passes (readConfig recognized).
  - Confirm NO consumer wiring leaked (no State.bareAt, no cfg var, no session_start change, no processTokenStream/injectFiles/injectMarkdown change).
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - imports line (L3): +CONFIG_DIR_NAME, getAgentDir (values from @earendil-works/pi-coding-agent; VERIFIED exported).
  - helpers region (~L135): +interface FileInjectorConfig { markdownBareAtImports?: boolean; }
                            +export async function readConfig(ctx: {cwd; isProjectTrusted}): Promise<FileInjectorConfig>
  - UNCHANGED: every other line of file-injector.ts (scanTokens, BARE_AT_RE [T1.S1's], processTokenStream,
    injectFile, injectMarkdown, emitText, State, the factory, autocomplete, all other helpers, all constants).

FILE_EDITS (file-injector.test.mjs):
  - sanity list (~L130): +1 typeof assert (readConfig).
  - ASSERTED_EXPORTS (~L141): +"readConfig".
  - buildFixtures (~L239): +mkdirSync(.pi/, {recursive:true}); +writeFileSync(.pi/file-injector.json, {"markdownBareAtImports":true}).
  - unit-test section (after T1.S1 block, before "10. Summary"): +4 runCase blocks (T2.S1-a..d) under a banner.
  - UNCHANGED: PURE_HELPERS_NOT_ASSERTED, the completeness-guard logic, makeMockCtx, every existing case/fixture/constant.

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files. NO new files.
NO_CONSUMER_WIRING: State.bareAt, cfg var, session_start load, processTokenStream/injectFiles/injectMarkdown
                     bareAt threading = ALL P1.M2.T1.S1 / P1.M2.T2.S1. T2.S1 delivers ONLY readConfig + its type + tests + guard.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails:
#   - "Cannot find name 'CONFIG_DIR_NAME'/'getAgentDir'" → the import-line edit (Task 1) didn't land; check L3.
#   - "Property 'isProjectTrusted' is missing in type ..." (at a CALL site in M2) → not T2.S1's concern (M2 hasn't
#     landed yet); T2.S1's only call sites are the unit tests' literal {cwd, isProjectTrusted} objects, which satisfy it.
#   - A type error on readConfig's return → ensure FileInjectorConfig is declared BEFORE readConfig (TS interface
#     hoisting is fine, but clean source ordering aids readability).
```

### Level 2: The Regression + New-Tests Gate (the .mjs suite)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 4 new T2.S1-a..d cases print ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: N passed, 0 failed.        (N = current baseline + T1.S1's 6 [if landed] + T2.S1's 4)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL checks:
#   - The module-surface guard MUST pass (no "module ships functions not in the sanity list: readConfig").
#     If it fails, you forgot Task 3 (the ASSERTED_EXPORTS + typeof-assert sync).
#   - The 4 readConfig cases MUST pass. If case (b) fails with "got undefined", the Task 4 fixture (.pi/file-injector.json)
#     wasn't written or readConfig isn't reading <cwd>/.pi/. If case (c) fails with "got true", the trust gate is broken
#     (isProjectTrusted not checked). If case (d) throws (runCase → FAIL), readConfig isn't catching the JSON.parse error.
#   - The existing baseline (incl. T1.S1's scanTokens tests, if landed) MUST stay green — readConfig is additive + dormant.
```

### Level 3: Targeted invariant checks (if a case regresses or a new case fails)

```bash
node ./file-injector.test.mjs 2>&1 | grep -iE "readConfig|T2.S1|sanity list|module ships|Result:"
# Expected: 4 ✓ for T2.S1-a..d; no "module ships functions not in the sanity list"; "Result: N passed, 0 failed."
#
# If "module ships functions not in the sanity list: readConfig" → Task 3 incomplete (add readConfig to ASSERTED_EXPORTS + the typeof assert).
# If T2.S1-b ✗ "got undefined" → the .pi/file-injector.json fixture is missing or readConfig's project path is wrong
#   (should be path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json") = <TMPDIR>/.pi/file-injector.json).
# If T2.S1-c ✗ "got true" → the `if (ctx.isProjectTrusted())` gate is missing or inverted (untrusted must SKIP the project read).
# If T2.S1-d ✗ (threw) → tryRead's try/catch is missing or too narrow (must catch JSON.parse + fs.readFile errors → {}).
# If a deepEqual-style assert fails with "extra keys" → you used deepEqual instead of the VALUE assert (see Known Gotchas CRITICAL).
```

### Level 4: Creative / Domain-Specific Validation

```bash
# Optional ad-hoc sanity (NOT part of the gate) — prove readConfig reads + merges + never throws interactively:
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  (async () => {
    // no config (assuming no real ~/.pi/agent/file-injector.json on this machine):
    console.log("no-config:", JSON.stringify(await mod.readConfig({cwd: "/tmp", isProjectTrusted: () => true})));
    // untrusted:
    console.log("untrusted:", JSON.stringify(await mod.readConfig({cwd: "/tmp", isProjectTrusted: () => false})));
  })();
'
# Expected: both print {} or {"markdownBareAtImports":...} IF a real global config exists; never throws.
# (This mirrors how P1.M2.T1.S1 will call readConfig on session_start.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → `0 errors` under `--strict`.
- [ ] `node ./file-injector.test.mjs` → `<baseline + 4> passed, 0 failed`, exit 0.
- [ ] The module-surface guard passes (no "module ships functions not in the sanity list: readConfig").
- [ ] `readConfig` is exported; `FileInjectorConfig` is a type (no runtime export); `CONFIG_DIR_NAME`/`getAgentDir` are imported values (NOT re-exported).

### Feature Validation (readConfig behavior)

- [ ] No config files → `markdownBareAtImports === undefined` (case a).
- [ ] Project `{markdownBareAtImports:true}` + trusted → `markdownBareAtImports === true` (project wins; case b).
- [ ] Same project config + untrusted → `markdownBareAtImports === undefined` (trust gate skips project read; case c).
- [ ] Malformed project JSON + trusted → `markdownBareAtImports === undefined`, NO throw (tryRead catches → {}; case d).
- [ ] readConfig NEVER throws on any input (missing/malformed/unreadable → {}).

### Code Quality Validation

- [ ] ctx typed NARROW `{cwd: string; isProjectTrusted: () => boolean}` (NOT `any`; item §3).
- [ ] FileInjectorConfig placed BEFORE readConfig (clean source ordering); both in the helpers region near resolveImportPath.
- [ ] readConfig's tryRead helper catches ALL errors (read + parse) → {} (never throws).
- [ ] Shallow-merge spread order is `{ ...cfg, ...project }` (project wins — load-bearing).
- [ ] Unit tests assert on `r.markdownBareAtImports` VALUE (not deepEqual) — robust to a real global config contributing unrelated keys.
- [ ] The .pi/ fixture uses `mkdirSync({recursive:true})` (no-op if exists; parallel-subtask-safe).
- [ ] Case (d) restores the valid fixture in a `finally` (doesn't pollute sibling cases).

### Documentation

- [ ] JSDoc on readConfig (Mode A — item §6): two config locations (global ~/.pi/agent/ + project <cwd>/.pi/), the trust gate, the shallow-merge precedence (project wins), the malformed→{} default, the narrow-ctx rationale. Cites PRD §4.6.
- [ ] JSDoc on FileInjectorConfig (the markdownBareAtImports knob + missing→undefined→false downstream).
- [ ] NO README change (Mode B = P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT skip the module-surface guard sync.** Exporting readConfig WITHOUT adding it to ASSERTED_EXPORTS +
  the typeof sanity assert → the guard fails with "module ships functions not in the sanity list: readConfig".
  BOTH edits (Task 3) are mandatory.
- ❌ **Do NOT type readConfig's ctx as `any`.** Item §3 explicitly forbids it. Use the narrow
  `{cwd: string; isProjectTrusted: () => boolean}` — it's --strict-clean, unit-testable with a literal mock,
  and structurally compatible with the real ExtensionContext for M2's call site.
- ❌ **Do NOT assert deepEqual on readConfig's result.** getAgentDir() reads the REAL ~/.pi/agent/; a real global
  config may contribute unrelated keys. Assert on `r.markdownBareAtImports` VALUE (undefined/true) — robust.
- ❌ **Do NOT re-export CONFIG_DIR_NAME or getAgentDir.** They're imported values consumed internally by readConfig.
  Re-exporting getAgentDir (a function) would put it on the module surface and TRIGGER the completeness guard.
- ❌ **Do NOT add FileInjectorConfig to ASSERTED_EXPORTS or the sanity list.** It's a TYPE (interface), erased at
  runtime — `typeof mod["FileInjectorConfig"] === "undefined"`, not "function". The guard never sees it.
- ❂ **Do NOT add consumer wiring.** State.bareAt, the `cfg` var, `session_start` config load, and the
  processTokenStream/injectFiles/injectMarkdown bareAt threading are ALL P1.M2.T1.S1 / P1.M2.T2.S1. T2.S1
  delivers readConfig + its type + tests + guard — nothing more. readConfig must be DORMANT (uncalled except tests).
- ❌ **Do NOT touch the real ~/.pi/agent/ in tests.** The global-merge precedence is structurally guaranteed by
  the spread order and is covered by P1.M2.T1.S1's session_start integration test (item §5). T2.S1's unit tests
  are robust to whatever the real global contributes (VALUE asserts, not deepEqual).
- ❌ **Do NOT let readConfig throw.** A malformed config must NOT crash the session. The tryRead try/catch → {}
  is the contract; case (d) pins it (runCase treats an uncaught throw as FAIL).
- ❌ **Do NOT create the .pi/ dir without `{recursive:true}`.** A parallel subtask (or a prior fixture) may have
  created it; `{recursive:true}` is a safe no-op. Without it, mkdirSync throws EEXIST if it exists.
- ❌ **Do NOT pollute sibling test cases with case (d)'s malformed file.** Case (d) overwrites the valid fixture
  with `{bad` — restore it in a `finally` so cases (b)/(c) (which may run after, depending on order) see valid JSON.
- ❌ **Do NOT overlap with T1.S1's regions.** T1.S1 (parallel) edits the BARE_AT_RE const (~L8) + scanTokens
  (~L432) + appends scanTokens unit tests. T2.S1 edits the imports line (L3) + the helpers region (~L135) +
  the guard + appends readConfig unit tests. No shared regions; both can land independently.

---

## Confidence Score: 9/10

A small, well-bounded config-foundation subtask: one import-line edit (verified exports), one interface + one
exported async function (exact body from codebase_delta §3, verified against the installed pi dist), one
mandatory module-surface guard sync (ASSERTED_EXPORTS + typeof assert — the gate fails without it), and 4 direct
unit tests with a clear fixture plan. The PRP includes the test-robustness subtlety (VALUE asserts not deepEqual,
because getAgentDir reads the real home dir), the case-(d) fixture-restore pattern, the narrow-ctx rationale
(item §3 override of PRD §9's `any`), and both verified gates (typecheck --strict + the .mjs suite). The -1
reserves for: (a) the module-surface guard sync being easy to forget (instantly caught by the gate, but it's the
one mandatory non-obvious step), and (b) the test-robustness subtlety (deepEqual is the natural-but-wrong
instinct; the PRP flags it CRITICALLY). The implementing agent edits two files in small regions, then runs two
commands. readConfig is dormant until P1.M2.T1.S1, so this subtask cannot break any existing behavior.
