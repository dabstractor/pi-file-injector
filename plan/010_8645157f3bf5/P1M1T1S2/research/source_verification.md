# Research Notes — P1.M1.T1.S2 (FileInjectorConfig + enableUrls field)

## Method
This subtask is a surgical TypeScript interface change (add ONE optional boolean field +
field-level JSDoc; no runtime/logic change). Direct source verification against `file-injector.ts`
substituted for subagent codebase search — every contract claim was read at its exact line. No
external/library research was needed (no new dependency or API is introduced; the default-true
semantics pattern is a code convention already documented in
`plan/010_8645157f3bf5/architecture/system_context.md` Refinement #2).

## Contract verification (all read directly from `file-injector.ts`, HEAD 90369d3)

| Contract claim | Verified at | Status |
|---|---|---|
| `interface FileInjectorConfig { markdownBareAtImports?: boolean; }` is a single-field one-liner | L177 | ✅ EXACT (one line, one optional boolean field) |
| Interface-level JSDoc (§4.6) sits at L175-176 describing markdownBareAtImports + loading + default | L175-176 | ✅ |
| readConfig (L196-228) shallow-merges from 4 sources via `cfg = { ...cfg, ...source }` | L223-228 | ✅ Unknown keys pass through unchanged |
| `tryReadCfg`/`tryReadNamespaced` cast parsed JSON to `FileInjectorConfig` | L199-202, L209-214 | ✅ A JSON `{"enableUrls":...}` or `{"fileInjector":{"enableUrls":...}}` plum through with NO body change |
| readConfig returns `{}` when all sources missing → `cfg.enableUrls` is `undefined` by default | L219 `let cfg = {}` + L228 return | ✅ This IS the default-true mechanism |
| Module-level `let cfg: FileInjectorConfig = {}` consumer | L1227 | ✅ Adding optional field is backward-compatible (no break) |
| Call site: input handler reads `cfg.markdownBareAtImports === true` | L1257 | ✅ The enableUrls gate (`cfg.enableUrls !== false`) lands HERE in P1.M1.T2.S3, NOT this subtask |
| No other `enableUrls`/`FileInjectorConfig` consumers that would break | `grep -n` full file | ✅ Only L177/196/199/209/219/1227 — all type-compatible with an added optional field |

## Why readConfig needs NO change
`readConfig` builds the result with successive `{ ...cfg, ...source }` spreads (L223-228). Spreading
copies ALL enumerable own keys of each source — it does not know or care about the interface shape.
Therefore a JSON file containing `{"enableUrls": false}` (or a namespaced
`{"fileInjector": {"enableUrls": false}}`) flows straight through to the returned object as soon as
the interface DECLARES the field. Adding `enableUrls?: boolean` to the interface is the ENTIRE change
needed for readConfig to type-correctly carry the value. The default-true behavior falls out for free:
when no source sets the key, the spreads contribute nothing and `cfg.enableUrls === undefined`
(which the call site interprets as enabled via `!== false` in T2.S3).

## Validation command verification
- `npm run typecheck` → `scripts/typecheck.mjs` → `tsc --strict` over `file-injector.ts` only
  (verified: writes temp tsconfig with `files: ["file-injector.ts"]`). Adding an OPTIONAL field
  cannot produce a type error; this is the primary gate and MUST stay green.
- `npm test` → chains `file-injector.test.mjs && import-behavior.test.mjs && relative-imports.test.mjs`.
  The readConfig unit tests (file-injector.test.mjs L2110+: T2.S1-a..d + settings.json cases) assert
  on the `markdownBareAtImports` VALUE (e.g. `r.markdownBareAtImports === true`), NOT `deepEqual` on
  the whole object. Adding `enableUrls` to the interface does not change any returned VALUE, so all
  existing assertions remain green. No runtime behavior change in this subtask.

## Parallel-execution safety (vs P1.M1.T1.S1)
S1 edits `package.json` + runs `npm install` (manifest + node_modules). S2 edits `file-injector.ts`
(source interface). ZERO file overlap → the two subtasks cannot conflict. S2 does not import
defuddle/linkedom (that is P1.M1.T2.S1), so S2 is independent of whether S1's install has completed.
S2's typecheck (`tsc --strict` over file-injector.ts) needs only the existing `@earendil-works/*`
peer paths already mapped in typecheck.mjs — no dependency on the newly-installed extraction deps.

## Optional hermetic plumbing proof (NOT a file change — a one-off check)
Because readConfig's body is unchanged, a standalone proof that the new key plum through can be run
WITHOUT editing any test file: reuse the existing jiti-load pattern from `file-injector.test.mjs`
(L31-59) to load `file-injector.ts`, then:
```js
const r = await mod.readConfig({ cwd: <tmp-with-".pi/file-injector.json"={"enableUrls":false}>, isProjectTrusted: () => true });
assert(r.enableUrls === false, "enableUrls must plumb through readConfig's shallow-merge");
```
This is OPTIONAL — the mandatory gates are typecheck + existing test suite (both already prove the
change is safe and complete for THIS subtask; the gate that actually CONSUMES the field is T2.S3).