# Typecheck-shim Decision — P1.M1.T1.S4

**Status**: ✅ Confirmed (Outcome **(a)** — CLEAN, no shim)
**Date**: 2024-typecheck run against actually-installed deps (defuddle 0.19.2, linkedom 0.18.13)
**Verifier**: Implementation agent executing PRP `plan/010_8645157f3bf5/P1M1T1S4/PRP.md`

---

## Outcome

**(a) CLEAN — no shim created.** `tsc --strict` with `moduleResolution: "Bundler"`
resolves both `defuddle/node` and `linkedom` types **natively** via each package's
`exports[].types` map. No `TS7016` ("Could not find a declaration file for module")
occurs for either specifier. The `declarations.d.ts` fallback contract is therefore
**not invoked**.

## Evidence — exit codes observed

| Check                                                          | Tool        | Exit | Result                                                                 |
|---------------------------------------------------------------|-------------|------|------------------------------------------------------------------------|
| Task 1 — baseline `npm run typecheck` (today, no imports yet) | `scripts/typecheck.mjs` → `tsc@5.6` | **0** | `typecheck: file-injector.ts type-checks clean under --strict (0 errors)` |
| Task 2 — forward-looking minimal probe (the real test)        | `tsc@5.6 -p temp-tsconfig --noEmit` | **0** | 0 errors, no output, **no TS7016**                                     |

> Caveat (per PRP): the Task 1 baseline is *trivially* clean because
> `file-injector.ts` does **not** yet import defuddle/linkedom (those imports arrive
> in P1.M1.T2.S1). The **Task 2 probe is the actual decision evidence**: it adds the
> exact imports P1.M1.T2.S1 will use, in a throwaway `.ts` placed at the repo root
> (so tsc's node-walk finds `node_modules`), compiled with the **same** compiler
> options as `scripts/typecheck.mjs`, with **no** `paths` entry for
> defuddle/linkedom (forcing native exports-map resolution).

## Per-specifier verdict

| Specifier       | Ships `.d.ts`?                          | Resolves natively (Bundler)?               | Shim needed? |
|-----------------|-----------------------------------------|--------------------------------------------|--------------|
| `defuddle/node` | ✅ `exports["./node"].types` + `typesVersions` | ✅ YES — via exports map under Bundler | **NO**       |
| `linkedom`      | ✅ `exports["."].types` + top-level `types`    | ✅ YES — via exports map under Bundler | **NO**       |
| turndown / mathml-to-latex / temml | — (transitive-only, never imported directly) | n/a | NO |

## Level 4 confirmation — native resolution traced (not paths-shimmed)

`tsc@5.6 --traceResolution` on the probe (same temp tsconfig) shows both specifiers
resolving to real on-disk `.d.ts` files:

- `defuddle/node` → `node_modules/defuddle/dist/node.d.ts` @ `0.19.2`
  — *"Module name 'defuddle/node' was successfully resolved"*
- `linkedom` → `node_modules/linkedom/types/esm/index.d.ts` @ `0.18.13`
  — *"Module name 'linkedom' was successfully resolved"*

No `paths` mapping was used — this is genuine native `exports`-map resolution.

## Artifacts produced by this task

- **`declarations.d.ts`**: **NOT created** (types resolve natively — a shim would
  shadow real upstream `.d.ts`, drift from the real API, and mask future type errors).
- **`file-injector.ts`**: **NOT modified** (no source change under Outcome (a)).
- **`scripts/typecheck.mjs`**: **NOT modified**.
- **`tsconfig.json`**: **NOT modified** (and is editor-only anyway — `npm run typecheck`
  writes its own temp tsconfig).
- **`package.json`**: **NOT modified**.
- **This decision record**: the sole new artifact (the [Mode A] "docs ride with the
  work" deliverable for this task).

`git status` after this task shows **no modified source files** — only this new
file under `plan/010_8645157f3bf5/P1M1T1S4/research/`.

## Existing test suites — regression check (Level 2)

`npm test` → **38 passed, 0 failed**, exit 0 (file-injector.test.mjs +
import-behavior.test.mjs + relative-imports.test.mjs). No regression (expected —
no source code was touched).

## Downstream guidance for P1.M1.T2.S1

The implementer may add the two bare-specifier imports to `file-injector.ts`
**directly**; `npm run typecheck` (the `prepublishOnly`/CI gate) will remain green:

```ts
import { Defuddle, type DefuddleResponse, type DefuddleOptions } from "defuddle/node";
import { parseHTML } from "linkedom";
```

**One type-care note for T2.S1 (not an S4 concern, recorded here for handoff):**
`parseHTML` does **not** accept `{ url }`. Set `document.URL = url` *after* parsing.
If T2.S1 adds a polyfill like `doc.styleSheets = []`, that line needs a cast
(`[] as unknown as StyleSheetList`) to avoid a `TS2741` — that is a **consumer-code**
type error, **not** a missing-declaration (`TS7016`) error, and does not affect this
resolution decision. The S4 probe deliberately omits the polyfill so its 0-error
result is unambiguous.

## Cross-reference

This result matches the pre-existing empirical proof in
`plan/010_8645157f3bf5/P1M1T1S4/research/notes.md` (§3 trace + §5 summary). This
document records the implementing agent's independent confirmation re-run.