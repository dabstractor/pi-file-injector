# Delta PRD (v006): `settings.json` Config Source + Depth-Uniform Resolution

**Status:** Draft · **Parent PRD:** `PRD.md` (Pi `#@file` Whole-File Injection extension) · **Delta type:** **Verification + doc-audit (no new implementation required — see §3)**

---

## 1. What changed in the PRD (the diff)

Comparing the session-005 PRD against the current `PRD.md`, three requirement-level changes were introduced, all localized to **§4.5 / §4.6** and their downstream sync points (§8, §9, §10, §11, §12). Nothing else in the PRD moved.

| # | Section | Change | Size |
|---|---|---|---|
| **A** | **§4.6 (config sources)** | The `markdownBareAtImports` setting may now live in **either of two forms** — a dedicated `file-injector.json` **or** a namespaced `fileInjector` key inside Pi's own `settings.json`. The setting is now read from **up to four locations**, shallow-merged in precedence: (1) global `settings.json` → `fileInjector`, (2) global `file-injector.json`, (3) project `settings.json` → `fileInjector` (trusted only), (4) project `file-injector.json` (trusted only). Within a scope the **dedicated file beats the `settings.json` key**; project scope overrides global. (Was: two locations, dedicated file only.) | ~30 lines |
| **B** | **§4.5 rule 5 + §4.6 "Depth-uniform" para** | New rule: markdown import resolution is **always `dirname(importingMarkdownAbs)` at every recursion depth** — never `ctx.cwd`, with no first-file special-casing and **no cwd fallback**. A same-named file in both the importing file's dir **and** `ctx.cwd` resolves to the importing file's dir; a token missing in that dir stays verbatim even if a same-named file exists under `cwd`. The same depth-uniformity applies to bare-`@` matching (no level requires `#@` while deeper levels allow `@`). | ~10 lines |
| **C** | **§8 / §9 / §10 / §11 / §12 sync** | §8 adds the `SETTINGS_KEY` constant to the constants list; §9 `readConfig` pseudocode expands to the 4-source merge with a `SETTINGS_KEY`-extraction helper; §10 adds ~6 edge rows (cwd-disambiguation, missing-in-dir-no-fallback, bare-`@` at depth 0→1 and across a chain, settings.json-key read, both-sources-in-scope precedence); §11 adds **test matrix #29–#32** and names a new **`relative-imports.test.mjs`** regression script; §12 note #19 is updated to mention the `settings.json` key. | ~40 lines |

**Net delta:** a small-to-medium *specification* change (~80 PRD lines touched), concentrated entirely in the already-shipped `markdownBareAtImports` feature and the already-shipped markdown-import resolution rules. No new syntax, no new file types, no new pipeline stage, no new dependency.

---

## 2. Why this is a verification delta, not an implementation delta

**Every changed requirement in §1 is already implemented, tested green, and documented in the current repo.** This was verified against the working tree (not assumed):

| Requirement (§1) | Code already satisfies it? | Evidence |
|---|---|---|
| **A — 4-source config + `settings.json` key** | ✅ Yes | `file-injector.ts` ships `const SETTINGS_KEY = "fileInjector";` and an exported `readConfig(ctx)` that reads all four sources in precedence order (global `settings.json` key → global `file-injector.json` → project `settings.json` key → project `file-injector.json`, trusted gate on the last two), each wrapped so a missing/malformed source or a non-object key contributes `{}` and nothing throws. Matches the §9 pseudocode. |
| **A — tests** | ✅ Yes | `file-injector.test.mjs` cases **T2.S1-e / -f / -g** assert: `settings.json` `fileInjector` key alone enables the option (e); the trust gate applies to the key too (f); the dedicated file **overrides** the `settings.json` key within a scope (g). Plus the module-surface guard lists `readConfig`. |
| **B — depth-uniform, no cwd fallback** | ✅ Yes | `injectMarkdown` resolves imports against `path.dirname(abs)` (the importing file's dir) unconditionally; `resolveImportPath` has no `ctx.cwd` branch. `relative-imports.test.mjs` cases **A1** (same name in baseDir **and** cwd → baseDir wins), **A7** (missing-in-baseDir → `null`, **no** cwd fallback), **A9** (resolution independent of `process.cwd()`), **C1 / C2** (the deep nested scenario) pin this at the `resolveImportPath`, `scanTokens`, `injectFiles`, and real-handler layers. |
| **B — depth-uniform bare-`@`** | ✅ Yes | `injectMarkdown` passes `bareAt: state.bareAt` regardless of depth. `relative-imports.test.mjs` and `import-behavior.test.mjs` assert bare-`@` is honored at the first imported file and across a chain (and is inert when off, at every depth). |
| **C — `relative-imports.test.mjs` script** | ✅ Yes | The file exists and passes (see §3 gate result). |

The full test suites were run as part of this analysis:

```
file-injector.test.mjs      → 122 passed, 0 failed
relative-imports.test.mjs   →  38 passed, 0 failed
import-behavior.test.mjs    →  22 passed, 0 failed
                                (182 passed total, 0 failed)
```

**Conclusion:** the codebase is *ahead of* the session-005 PRD and *already at* the current `PRD.md` for every §1 requirement. There is no new code to write. The legitimate work is (1) a confirmation gate that the green state holds against the updated spec, and (2) a doc audit — the PRD's own Done-definition is stale (`PRD.md:1189` says "all **24** manual test cases" but §11 now lists **32**).

---

## 3. Goals & Non-Goals

### Goals
1. **Confirm** the current repo satisfies the three §1 requirement changes (4-source config; depth-uniform resolution with no cwd fallback; depth-uniform bare-`@`), via the existing test suites + typecheck.
2. **Audit & repair** the one known stale doc: `PRD.md` Done-definition's test-case count.
3. **Verify documentation coherence** (README + JSDoc) for the `settings.json` form and depth-uniformity, so the delta ships with no stale claims.

### Non-Goals
- **No new implementation.** `readConfig`, `SETTINGS_KEY`, `scanTokens`/`injectMarkdown` depth-uniform behavior are already shipped and green — do not re-implement, restructure, or "clean up" them.
- **No new tests required beyond what exists.** The §11 #29–#32 behaviors are already covered by the existing cases enumerated in §2; only add a test if the audit finds a genuine gap (none is currently known).
- **No behavior change.** Resolution precedence, trust gating, and the depth-uniform property must remain exactly as they are.

---

## 4. Documentation Impact

- **Mode A (doc-with-work):** None outstanding. `readConfig`'s JSDoc already documents the four sources, the precedence, the trust gate, and the `SETTINGS_KEY` form; the `SETTINGS_KEY` const is commented; `injectMarkdown`'s JSDoc already notes the `dirname(abs)` resolution and the `bareAt` threading. (Rode with the prior implementation; re-confirmed here, not re-done.)
- **Mode B (changeset-level docs):** `README.md` is already coherent — its "Optional: bare-`@` markdown imports" section (`README.md:92–115`) documents both config forms, the **four-location precedence list**, the trust gate, and the depth-uniform ("every depth") property. The only changeset-level fix needed is the stale test-case count in the **PRD's own** Done-definition (`PRD.md:1189`), handled by the doc-audit task below.

---

## 5. Phase: Verification Gate + Doc Audit

A single, minimal phase. It exists to turn the "already done, 182 green" finding into a recorded, gated confirmation against the *updated* PRD, and to close the one stale-doc nit. **No code edits are expected** (if the gate is green, which the §2 evidence predicts).

### Milestone P1.M1 — Confirm v006 + close the stale-doc nit

**Task P1.M1.T1 — Verification gate (confirm the repo satisfies §1)**
- Run `node ./file-injector.test.mjs`, `node ./relative-imports.test.mjs`, `node ./import-behavior.test.mjs`, and `node ./scripts/typecheck.mjs`.
- Expect: all suites `0 failed`; typecheck `0 errors` under `--strict`.
- Specifically confirm the three §1 requirements are exercised: the `settings.json` config cases (T2.S1-e/-f/-g), the depth-uniform / no-cwd-fallback cases (relative-imports A1/A7/A9/C1/C2), and the depth-uniform bare-`@` cases (relative-imports + import-behavior).
- If any check is red, that is the **only** case where code work is in scope: fix the offending function (do not weaken strictness, do not delete tests) so the requirement passes. Treat a red gate as a regression to repair, not a redesign.
  - *Doc (Mode A):* none — a gate task has no user-facing surface.

**Task P1.M1.T2 — Doc audit: fix the stale test-case count + confirm coherence**
- Update `PRD.md` Done-definition (`PRD.md:1189`): "all **24** manual test cases" → "all **32** manual test cases" (the §11 matrix now lists 1–32).
- Confirm `README.md:92–115` and the `readConfig` / `SETTINGS_KEY` JSDoc still match the §1 behavior (4-source precedence, trust gate, depth-uniform, dedicated-file-beats-key). If coherent (expected), no further edit. If any claim drifts from the shipped code, correct the doc, not the code.
  - *Doc (Mode B):* this task **is** the changeset-level documentation sweep for the delta.

---

## 6. Acceptance / Done-Definition for this delta

- All three test suites green (182 passed, 0 failed) and `tsc --strict` clean.
- `PRD.md` Done-definition no longer references the stale "24" count.
- No stale doc claims remain for the `settings.json` config form or depth-uniform resolution.
- No source-code edits were required (or, if the gate surfaced a genuine regression, the minimal fix landed and all suites are green again).
