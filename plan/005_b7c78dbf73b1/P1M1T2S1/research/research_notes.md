# Research Notes — P1.M1.T2.S1: Add CONFIG_DIR_NAME/getAgentDir imports + FileInjectorConfig + readConfig (+ unit tests + guard sync)

> Config-foundation subtask. Adds the `@earendil-works/pi-coding-agent` imports (`CONFIG_DIR_NAME`,
> `getAgentDir`), the `FileInjectorConfig` type, an exported `readConfig`, 4-5 unit tests, and a
> module-surface guard sync. Consumed by P1.M2.T1.S1 (which adds the `cfg` var + `session_start` load +
> threads `bareAt` through the pipeline). No behavior change yet — readConfig is dormant until M2.

## 1. T1.S1 contract (parallel, the dependency) — what it produces

T1.S1 (the previous work item, currently being implemented) touches ONLY `scanTokens` + adds 6 unit tests:
- Adds `const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;` near `FILE_INJECT_RE` (~L8). NOT exported.
- Restructures `scanTokens` (L432): opts gains `bareAt?: boolean` (OPTIONAL — to avoid typecheck cascade
  into processTokenStream/injectMarkdown/injectFiles); return type gains `prefixLen: number`; loop becomes
  a `cands` union (FILE_INJECT_RE always prefixLen 2; BARE_AT_RE when `opts.bareAt` prefixLen 1).
- **Does NOT add**: `CONFIG_DIR_NAME`/`getAgentDir` imports, `FileInjectorConfig`, `readConfig`, `State.bareAt`,
  the `cfg` var, `session_start` config load, or any consumer wiring. All of that is T2.S1 (mine) + M2.

**Critical coordination:** T1.S1 leaves the imports line at L3 UNCHANGED:
```ts
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
```
T2.S1 edits THIS line to add `CONFIG_DIR_NAME, getAgentDir`. No conflict — T1.S1 doesn't touch imports.

## 2. The exact code to add (from codebase_delta.md §2-3, VERIFIED against installed dist)

### Import line edit (file-injector.ts L3)

```diff
-import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
+import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
```

**VERIFIED exports** (api_verification.md §1-2): `dist/index.d.ts:2` + `dist/index.js:4` re-export both.
- `CONFIG_DIR_NAME === ".pi"` (`dist/config.js:394`: `pkg.piConfig?.configDir || ".pi"`, deterministically ".pi").
- `getAgentDir(): string` → `~/.pi/agent` (`dist/config.js:411-418`: `path.join(os.homedir(), CONFIG_DIR_NAME, "agent")`,
  overridable via `PI_CODING_AGENT_DIR` env — but that doesn't affect the unit-testable surface).

### FileInjectorConfig type + readConfig function

```ts
/** §4.6 — file-injector.json config shape. markdownBareAtImports: also match bare "@path" in markdown
 *  (opt-in). Loaded on session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports
 *  undefined → treated as false downstream. */
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

/** §4.6 — read file-injector.json. GLOBAL first (~/.pi/agent/file-injector.json), then PROJECT-if-trusted
 *  (<cwd>/.pi/file-injector.json), shallow-merged (project wins). Missing/malformed either file → default
 *  {} (markdownBareAtImports undefined → false downstream). NEVER throws. The narrow {cwd, isProjectTrusted}
 *  ctx (only the two fields used) makes it unit-testable with a tiny mock; do NOT type it as `any`. */
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  const tryRead = async (p: string): Promise<FileInjectorConfig> => {
    try {
      return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}");
    } catch {
      return {};
    }
  };
  let cfg: FileInjectorConfig = await tryRead(path.join(getAgentDir(), "file-injector.json"));
  if (ctx.isProjectTrusted()) {
    cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  }
  return cfg;
}
```

**Placement:** near `resolveImportPath`/`isRegularFile` (file-injector.ts L95-135, the pure/IO helpers
region). codebase_delta §8 file-structure list puts readConfig in section 3 (Pure/IO helpers). Place it
AFTER `resolveImportPath` (L135) and BEFORE `extOf` (L138), OR right after `isRegularFile`. Either is
consistent with the existing helper grouping.

### Why the narrow ctx type (NOT `any`) — item §3 is explicit

PRD §9 pseudocode shows `readConfig(ctx: any)`, but item §3 says: "Prefer the narrow typed ctx param shown
here (only cwd + isProjectTrusted are used) so it is unit-testable with a tiny mock — do NOT type it as
`any`." The narrow `{ cwd: string; isProjectTrusted: () => boolean }`:
- Is unit-testable with `await mod.readConfig({ cwd: TMPDIR, isProjectTrusted: () => true })` (literal object).
- typechecks clean under `--strict` (no `any`).
- Is a SUPERTYPE-compatible param for the real `session_start` ctx (which has `cwd: string` + `isProjectTrusted():
  boolean` among many other fields) — P1.M2.T1.S1's `cfg = await readConfig(ctx)` call is type-safe because a
  richer ctx is assignable to a narrower param type (TS bivariance for method params / structural subtyping).

## 3. The module-surface guard (file-injector.test.mjs L132-151) — MUST sync

The guard (verified L132-151):
```js
const ASSERTED_EXPORTS = new Set([
  "default", "injectFiles", "cleanToken", ..., "resolveImportPath", "isRegularFile",
]);
const PURE_HELPERS_NOT_ASSERTED = new Set(["expandTildeAndResolve", "extOf", "isBinary"]);
{
  const shippedFunctions = new Set(Object.keys(mod).filter((k) => typeof mod[k] === "function"));
  const unexpected = [...shippedFunctions].filter((k) => !ASSERTED_EXPORTS.has(k) && !PURE_HELPERS_NOT_ASSERTED.has(k));
  assert(unexpected.length === 0, `module ships functions not in the sanity list: ${unexpected.join(", ")} ...`);
  ...
}
```

**Adding `readConfig` (exported function) WITHOUT syncing this guard → the guard fails:**
`module ships functions not in the sanity list: readConfig ...`. So T2.S1 MUST:
1. Add `assert(typeof mod.readConfig === "function", "mod.readConfig must be a function (§4.6 config reader)")`
   to the sanity list (after the `isRegularFile` assert at L130).
2. Add `"readConfig"` to the `ASSERTED_EXPORTS` Set (after `"isRegularFile",` at L141).

**Note:** `FileInjectorConfig` is a `type`/`interface` (erased at runtime, NOT a `typeof mod[k]==="function"`),
so it does NOT appear in `shippedFunctions` and does NOT need a sanity assert or ASSERTED_EXPORTS entry.
`CONFIG_DIR_NAME`/`getAgentDir` are VALUES imported from the pi package — they appear on `mod` only if
re-exported (T2.S1 does NOT re-export them; they're consumed internally by readConfig). The guard filters
`typeof mod[k] === "function"` — `CONFIG_DIR_NAME` is a string, so even if it leaked onto `mod` it wouldn't
trigger; `getAgentDir` IS a function but is NOT re-exported (it's an import, consumed internally), so it
does NOT appear on the module's export surface. → No guard edit for the imports; ONLY readConfig.

## 4. Unit-test plan (item §5) — direct mod.readConfig calls, literal {cwd, isProjectTrusted}

**No makeMockCtx change needed** (item §5 explicit): pass a literal `{ cwd: TMPDIR, isProjectTrusted: () => bool }`.

**Fixture writes** (in buildFixtures, near the existing markdown fixtures ~L239-280): create a project config
file at `<TMPDIR>/.pi/file-injector.json`. Need `fsSync.mkdirSync(path.join(TMPDIR, ".pi"), { recursive: true })`
first (the .pi dir doesn't exist yet). Cases:

| # | Fixture / mock | Expected |
|---|---|---|
| T2.S1-a | no config files anywhere; `isProjectTrusted: () => true` | `{}` (both tryRead catch → {}) |
| T2.S1-b | `<TMPDIR>/.pi/file-injector.json` = `{"markdownBareAtImports":true}`; `isProjectTrusted: () => true` | `{markdownBareAtImports:true}` (project read) |
| T2.S1-c | same project config; `isProjectTrusted: () => false` | `{}` (trust gate → project NOT read) |
| T2.S1-d | `<TMPDIR>/.pi/file-injector.json` = `{bad` (malformed); `isProjectTrusted: () => true` | `{}` (JSON.parse throws → catch → {}, no throw escapes) |

**Global-path merge** (`getAgentDir()` → `~/.pi/agent/file-injector.json`): item §5 explicitly says this is
"HARD to sandbox without touching ~" → "cover it in M2's integration test via session_start, not here."
So T2.S1's unit tests do NOT assert global-then-project merge precedence; they test:
- project-only (cases b/c/d) — because the global file almost certainly doesn't exist in the test env's
  `~/.pi/agent/`, so the global tryRead returns {} and the merge is just `{} merged with <project>`.
- The merge PRECEDENCE (project wins) is structurally guaranteed by `{ ...cfg, ...project }` (spread order)
  and is exercised end-to-end in P1.M2.T1.S1's session_start integration test.

**IMPORTANT subtlety for case (b):** `getAgentDir()` reads the REAL `~/.pi/agent/`. If a real
`~/.pi/agent/file-injector.json` exists on the test machine with `markdownBareAtImports`, it would merge
into the result. To make case (b) deterministic, assert `r.markdownBareAtImports === true` (the project
value WINS via spread order even if global also sets it) rather than deepEqual `{markdownBareAtImports:true}`
(which could fail if global adds an unrelated key). This is the robust assertion. Similarly case (c/d):
assert `r.markdownBareAtImports === undefined` (the project file is gated/malformed → its key never lands),
NOT deepEqual `{}` (global could contribute unrelated keys).

**This subtlety is the single biggest test-robustness risk** — flag it in the PRP.

## 5. Test placement + naming (mirror the T1.S1 resolveImportPath unit tests)

The T1.S1 unit tests live at L1534+ under a `// ── T1.S1: resolveImportPath + async scanTokens unit tests ──`
banner, each as `await runCase("T1.S1-n", "...", async () => {...})`. T2.S1 mirrors this:
- A new `// ── T2.S1: readConfig unit tests (PRD §4.6 — config reader) ──` banner.
- `await runCase("T2.S1-a", "readConfig ...", async () => { const r = await mod.readConfig({cwd: TMPDIR, isProjectTrusted: () => true}); assert(...); });`
- Place AFTER the T1.S1 unit-test block (which ends before the tail summary) and BEFORE the `// 10. Summary` block.
- **Fixture writes** go inside `buildFixtures()` (need the `.pi/` subdir + the project config JSON file),
  near the existing markdown fixtures (~L239-280).

## 6. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Implementing, parallel) | BARE_AT_RE const; scanTokens opts+`bareAt?`+`prefixLen`+cands-union; 6 scanTokens unit tests | T2.S1 does NOT touch scanTokens or BARE_AT_RE. T2.S1 edits the imports line (L3) — T1.S1 does NOT. No file-region overlap. |
| P1.M2.T1.S1 (Planned, downstream consumer) | State.bareAt; `cfg` var; session_start `cfg = await readConfig(ctx)`; injectFiles state init `bareAt: cfg.markdownBareAtImports === true`; processTokenStream bareAt opt | T2.S1 PROVIDES `readConfig` + `FileInjectorConfig` (the consumed interface). T2.S1 does NOT add State.bareAt, the cfg var, or session_start wiring. |
| P1.M2.T2.S1 (Planned) | injectMarkdown bare-@ wiring (pass `bareAt:state.bareAt`, carry prefixLen through Step 3.5/4) | Orthogonal — depends on State.bareAt (M2.T1.S1), not on readConfig directly. |
| P1.M3.T1/T2 (Planned) | Full regression gate + README | Orthogonal. |

**Critical no-conflict:** T2.S1 edits (a) the imports line L3, (b) adds FileInjectorConfig + readConfig in
the helpers region (~L135), (c) appends 2 guard-sync lines + ~4 unit tests + 1-2 fixture lines in the test
harness. T1.S1 (parallel) edits scanTokens (~L432) + the const region (~L8) + appends 6 scanTokens unit
tests. No overlapping regions. Both append unit tests before the tail summary — if both land, the test
section grows by ~10 cases; neither references the other's tests.

## 7. Validation (verified gates)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck          # → "0 errors" under --strict (readConfig's narrow ctx typechecks; FileInjectorConfig is structural)
node ./file-injector.test.mjs   # → "Result: N passed, 0 failed." (N = current baseline + T1.S1's 6 + T2.S1's ~4)
```

- **typecheck gate**: the narrow `{cwd: string; isProjectTrusted: () => boolean}` ctx is `--strict`-clean.
  `FileInjectorConfig` is an interface (structural). `CONFIG_DIR_NAME`/`getAgentDir` are imported as values
  (string + function) — used inside readConfig, typecheck resolves them against the pi `.d.ts`.
- **test gate**: the module-surface guard MUST pass (readConfig in ASSERTED_EXPORTS). The 4 readConfig unit
  tests must pass (cases a-d). The existing baseline + T1.S1's scanTokens tests stay green (readConfig is
  additive + dormant — nothing calls it yet except the tests).

**Both gates are independent of T1.S1's landing** (T2.S1 doesn't touch scanTokens). If T1.S1 lands first,
T2.S1's PRP still holds (the imports line + helpers region + guard are unaffected by scanTokens changes).
