# Research Notes — P1.M1.T1.S2 (bugfix 001_a4cee0dcf39c): update import-behavior 4f + add primary-gate regression cases

> First-hand read of: the S1 PRP (FULLY LANDED — fmtCut at file-injector.ts L162-163, no extCut),
> `architecture/issue4_image_and_tests.md` (harness patterns), `import-behavior.test.mjs` (helpers + GROUP-4
> L141-194), and `file-injector.test.mjs` (runCase/assert L81/90, FIX L360, hasBlock/blocksText L198-199,
> case 5 L477, case 24 L1907, EDG-2 L1930). Baselines: import-behavior **21 passed, 1 failed (4f)** (the
> expected red S1 predicted); file-injector + relative-imports green.

---

## 1. Starting state = POST-S1 (S1 is landed; S2 is TEST-ONLY)

S1 (LANDED) fixed `resolveImportPath`: `extCut` (greedy `.md`-substring truncation → injected the WRONG file)
is replaced by `fmtCut = token.replace(/[*_]+$/, "")` + `cleanToken(fmtCut)` retry (trailing markdown-glue strip
only). `file-injector.ts` is UNCHANGED by S2. S2 owns the TEST updates S1 explicitly deferred:
- import-behavior test **4f** endorses the bug (`@weird.md.bak` only-weird.md → weird.md) → goes RED after S1.
- No primary-gate (file-injector.test.mjs) case exercises the FP → S2 adds regression cases.

**S2 is TEST-ONLY** (edits `import-behavior.test.mjs` + `file-injector.test.mjs`; NO source change).

---

## 2. The behavior contract (POST-S1, what the tests must assert)

`resolveImportPath(token, baseDir, tryMdExt)` now builds `candidates = [token]`, then if
`fmtCut = token.replace(/[*_]+$/, "")` differs and is non-empty, pushes `cleanToken(fmtCut)`. The candidate
loop + tryMdExt `.md`/`.markdown` fallback are unchanged. Net effect for the FP patterns:

| token (raw `\S+`) | cleanToken | fmtCut | candidates | result |
|---|---|---|---|---|
| `weird.md.bak` (4f) | `weird.md.bak` | (no trailing `*`/`_` → fmtCut===token) | `[weird.md.bak]` | exact-only → missing → **null** (FIXED) |
| `api.md.old` (4h) | `api.md.old` | (no glue) | `[api.md.old]` | exact-only → **null** |
| `report.md.backup` (ISS1) | `report.md.backup` | (no glue) | `[report.md.backup]` | exact-only → **null** |
| `b.md.*` (4a, unchanged) | `b.md.*` | `b.md.` → cleanToken → `b.md` | `[b.md.*, b.md]` | retry → resolves ✓ |

So: a token already carrying a real extension (`.bak`/`.old`/`.txt`/`.backup`) is **exact-only**; if missing →
**null → marker left verbatim, no injection**. Trailing markdown glue (`*`/`_`) is still stripped + retried.

---

## 3. The 3 import-behavior edits (rewrite 4f + add 4h + update GROUP-4 header)

### (a) Rewrite 4f (currently L184-188, ENDORSES the bug) → PRD-compliant
The current 4f asserts `has(o, "MD-MARKER")` (weird.md IS injected — the bug). Flip to: NOT injected + verbatim.
`o.injected === 1` (only a.md); `!has(o, "MD-MARKER")`; `has(o, "@weird.md.bak")` (the literal marker left
verbatim in a.md's block — `has` reads `out.blocks`).

### (b) Add 4h (after 4g, before the GROUP-5 header) — `.old` false-positive guard
`@api.md.old` (only api.md) → NOT injected; `o.injected === 1`; `!has(o, "API-MARKER")`; `has(o, "@api.md.old")`.
(4f covers `.bak`; 4h covers `.old`; `.txt` is the same code path.)

### (d) Update the GROUP-4 header comment (L141-146)
The OLD rationale ("a filename's extension (.md/.markdown) is its terminator… truncated immediately after the
LAST .md/.markdown") describes the BUG. Rewrite to: trailing `*`/`_` glue-strip + re-clean retry; extended
tokens (.bak/.txt/.old/.backup) are exact-only (4f/4h); `_` inside a name never stripped (4d); full token wins (4e).

---

## 4. The 2 primary-gate regression cases (file-injector.test.mjs — the `npm test` gate)

Models: **case 24** (L1907, top-level no-fallback → injected===0, `r.text === input`) and **EDG-2** (L1930,
markdown-import of a missing already-extended token → verbatim via `hasBlock`). Helpers: `runCase(n,name,fn)`,
`assert(c,m)`, `FIX = { cwd: TMPDIR }`, `hasBlock(r, needle) = r.blocks.some(b => b.includes(needle))`.

### ISS1-TL (top-level, modeled on case 24)
Token `#@iss1_report.md.backup`; ONLY `iss1_report.md` exists. → `r.injected === 0`;
`r.text === "Compare #@iss1_report.md.backup with the latest"` (byte-for-byte — early return, no strip);
`!hasBlock(r, "Secret draft content.")` (iss1_report.md NOT injected).

### ISS1-MD (markdown-import, modeled on EDG-2)
`iss1_index.md` imports `#@iss1_report.md.backup`; ONLY `iss1_report.md` exists. → `r.injected === 1` (only
index); `hasBlock(r, '<file name="…/iss1_index.md">')` (parent delivered); `!hasBlock(r, "Secret draft content.")`
(report NOT injected); `hasBlock(r, "See #@iss1_report.md.backup here.")` (the unresolved marker left VERBATIM —
proves it was not stripped + no wrong file pulled in).

**Fixture names**: `iss1_report.md` / `iss1_index.md` — UNIQUE (no shared fixture uses the `iss1_` prefix; the
shared buildFixtures are a.ts/b.ts/notes.md/api.md/etc.). Written INLINE in each runCase (self-contained, like
the EDG cases). Maps to the item's `report.md`/`index.md` (renamed for collision-safety; the `.md.backup` token
shape — the load-bearing part — is identical).

**Insertion point**: after EDG-4 (the last case in the §4.5 extension-shorthand / §10-edge cluster, ~L1940s),
alongside case 24 + EDG-2 (the thematic neighbors). String ids "ISS1-TL" / "ISS1-MD" (no collision with numeric
matrix ids or existing string ids).

---

## 5. Why `has` (import-behavior) and `hasBlock` (file-injector) read blocks, not text

Both suites are already migrated to the NEW injectFiles return shape (text = stripped prompt only; blocks =
array). `import-behavior.has(out, marker)` = `(out.blocks ?? []).join("\n\n").includes(marker)`;
`file-injector.hasBlock(r, needle)` = `r.blocks.some(b => b.includes(needle))`. So "marker present" checks go
through blocks, and `r.text === "stripped prompt"` checks the user-message text. S2's cases use both correctly.

---

## 6. Coordination with S1 (no conflict)

S1 = code only (resolveImportPath fmtCut); S2 = tests only. S1 left 4f RED (expected); S2 rewrites 4f → GREEN.
S1 added no primary-gate FP case; S2 adds ISS1-TL/ISS1-MD. file-injector.ts is UNCHANGED by S2. The GROUP-4
header comment + 4f/4h + ISS1 cases are all S2-exclusive edits.

---

## 7. Scope discipline (what S2 does NOT do)

- Does NOT edit file-injector.ts (S1's fmtCut fix is the source change; S2 consumes it).
- Does NOT touch relative-imports.test.mjs (unchanged, green).
- Does NOT wire the suites into `npm test` (that's P1.M3.T1.S1 — a later milestone; depends on 4f being fixed first).
- Does NOT update README.md (P1.M3.T2.S1).
- Does NOT touch 4a-4e/4g (they STAY GREEN — the fmtCut retry preserves them).

---

## 8. Confidence: 9/10

TEST-ONLY, two files, 5 focused edits (rewrite 4f, add 4h, update GROUP-4 header, add ISS1-TL, add ISS1-MD),
each traced through POST-S1 resolveImportPath and modeled on existing cases (24/EDG-2 for the primary gate;
4a-4e for import-behavior). The gate is all three suites green. The -1 reserves for: (a) the fixture-name
deviation (`iss1_report.md` vs the item's `report.md` — collision-safe, semantically identical, documented);
(b) the stale line numbers in the item (header is L141-146, not 191-197; 4f is ~L184-188, not 208-213 — the
PRP uses IDENTIFIER-based landmarks + the exact current text). The implementing agent edits two test files,
runs three commands.
