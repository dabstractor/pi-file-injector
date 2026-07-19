---
name: "P1.M2.T2.S1 (plan/009) — Update marker-presence expectations in relative-imports.test.mjs and import-behavior.test.mjs for verbatim delivery (3 scanTokens return-shape fixes + 1 stale comment; marker assertions already correct)"
prd_ref: "PRD §6.4 (Assembly — the prompt is preserved verbatim, markers never stripped), §5.6 step 3/4 (markers detected only to resolve imports; content emitted verbatim), §4.5/§4.6 (resolution rules unchanged); plan/009 architecture/test_assertions_analysis.md (the marker-assertion scout report)"
target_files: "./relative-imports.test.mjs (EDIT B1/B4/B6 + B-group header comment) + ./import-behavior.test.mjs (EDIT L38 comment only)"
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` (both 0 failed)
depends_on: "P1.M1.T1.S1 (scanTokens → Promise<string[]>; prefixLen/index removed — LANDED, the root cause of the 3 relative-imports failures) + P1.M1.T1.S2/S3 + P1.M1.T2 (the verbatim engine — LANDED). The two aux suites are run against the LANDED verbatim file-injector.ts."
consumed_by: "P1.M3.T1.S1 (wire all three suites into npm test — needs both aux suites green + file-injector.test.mjs green from P1.M2.T1). NOTE: runs in PARALLEL with P1.M2.T1.S3 (file-injector.test.mjs migration) — disjoint files (this task edits ONLY the two aux suites; no collision)."
---

# PRP — P1.M2.T2.S1: Migrate the two auxiliary test suites to the verbatim engine (marker assertions + scanTokens return-shape)

> **Scope flag:** Test-only migration of the two standalone regression suites for plan 009's verbatim-delivery
> change (the extension no longer strips `#@`/`@` markers). **The marker-stripping assertions in these suites are
> ALREADY CORRECT** (verified live: import-behavior 23/0 green; relative-imports C9 passes) — they asserted verbatim
> behavior for missing/unresolved tokens, which was always the case. **The actual failures are `scanTokens`
> return-shape**: P1.M1.T1.S1 changed `scanTokens` from `Promise<{index,prefixLen,abs}[]>` to `Promise<string[]>`
> (prefixLen/index are dead — stripping is gone), breaking Group B's `recs[0].abs` / `recs[i].prefixLen` reads.
> **3 assertion fixes (B1/B4/B6) in relative-imports + 1 stale comment in import-behavior.** No `.ts` change, no
> README (P1.M2.T4.S1), no file-injector.test.mjs (P1.M2.T1's parallel scope).

---

## Goal

**Feature Goal:** Make both auxiliary regression suites GREEN against the LANDED verbatim engine, so the two
properties they guard (file-relative resolution at every depth; first-level/depth-uniform bare-@) stay runnable
gates — by (a) migrating the 3 `scanTokens` return-shape assertions in `relative-imports.test.mjs` (B1/B4/B6) to
the new `string[]` shape, and (b) updating the one stale `text(stripped)` comment in `import-behavior.test.mjs`.
The marker-presence assertions (C9, 4f, 4h, 2c/5f) are verified already-correct (no change).

**Deliverable:** Two modified test files (the ONLY files edited):
- **`./relative-imports.test.mjs`** — B1 (L196-197): `recs[0].abs` → `recs[0]`; B4 (L220-221): same; B6
  (L232-240): drop the dead `prefixLen` asserts, REPURPOSE to "both `#@` and bare-`@` resolve baseDir-relative
  in one scan (the union)"; B-group header (L182-184): "records carry abs paths" → "resolved abs paths".
- **`./import-behavior.test.mjs`** — L38 comment: `text(stripped)` → `text(verbatim)`. (No assertion changes —
  already 23/0 green.)

**Success Definition:**
1. `node ./relative-imports.test.mjs` → **38 passed, 0 failed** (was 35/3 — B1/B4/B6 fixed).
2. `node ./import-behavior.test.mjs` → **23 passed, 0 failed** (already green; comment-only).
3. The marker assertions (C9 `#@ghost.md` verbatim; 4f `@weird.md.bak`; 4h `@api.md.old`; 2c/5f non-injection)
   remain GREEN and UNCHANGED — they were already correct for verbatim delivery.
4. `git diff --stat`: relative-imports.test.mjs + import-behavior.test.mjs ONLY (no `.ts`, no PRD/README,
   no file-injector.test.mjs).

## User Persona

**Target User:** The developer/CI running the two standalone regression gates. Plan 009 made the engine
verbatim (a deliberate reversal of the earlier stripping behavior); these two suites — which pin the two
properties the PRD most fears regressing (file-relative resolution + first-level bare-@) — must follow.

**Use Case:** `git pull && node ./relative-imports.test.mjs && node ./import-behavior.test.mjs` → both green.

**Pain Points Addressed:** Both suites currently RED (relative-imports) or carry a stale comment (import-behavior)
against the verbatim engine. relative-imports' 3 failures (B1/B4/B6) silently disable the file-relative-resolution
regression gate until fixed.

## Why

- **The verbatim engine removed `prefixLen`/`index` from `scanTokens`.** Those fields existed ONLY to support
  stripping (`slice(index, index + prefixLen)`). Plan 009 (PRD §6.4/§12.16) delivers the prompt VERBATIM —
  markers are detected only to resolve imports, never stripped. So `scanTokens` now returns `Promise<string[]>`
  (resolved abs paths). Group B's `recs[0].abs`/`recs[i].prefixLen` reads are the casualties.
- **The marker-stripping assertions were never the problem.** The architecture scout report
  (`test_assertions_analysis.md` §5) found only 1 explicit marker assertion in relative-imports (C9) and 2 in
  import-behavior (4f/4h) — ALL assert VERBATIM for missing/unresolved tokens, which was ALWAYS correct
  (missing imports were never stripped, even before plan 009). 2c/5f test NON-INJECTION (file not injected),
  not stripping. So the contract's "MOST LIKELY OUTCOME: very few stripping-dependent assertions" is confirmed
  live: ZERO marker assertions need flipping.
- **The real work is the `scanTokens` return-shape migration.** Group B (B1/B4/B6) directly tests `scanTokens`'
  return shape — the one part of these suites that touched the now-dead record fields. Migrating them restores
  the suite (and B6's repurpose preserves the bare-@ union coverage that prefixLen used to carry).
- **Low-risk, mechanical, file-scoped.** Two files, deterministic old→new transformations. The risk is
  mishandling B6 (prefixLen is dead — must repurpose, not preserve). The PRP gives the exact rewrite.

## What

No user-visible/API/logic change. The two suites' ASSERTIONS change to match the LANDED verbatim engine:
- relative-imports Group B reads `scanTokens`' new `string[]` return (3 cases).
- import-behavior's stale `text(stripped)` comment → `text(verbatim)`.
The cases, fixtures, helpers' signatures, and pass/fail matrices are otherwise structurally unchanged.

### Success Criteria

- [ ] `node ./relative-imports.test.mjs` → **38 passed, 0 failed** (B1/B4/B6 fixed; C9 + all content-marker cases unchanged).
- [ ] `node ./import-behavior.test.mjs` → **23 passed, 0 failed** (comment-only; 4f/4h/2c/5f unchanged).
- [ ] B1: `recs[0] === path.join(root,"dir","b.md")` (was `recs[0].abs`); the diagnostic maps `recs` (not `recs.map(r=>r.abs)`).
- [ ] B4: same as B1 (bare-@ variant).
- [ ] B6: REPURPOSED — no `prefixLen`; asserts both `#@a.md` and bare `@b.md` resolve baseDir-relative in one scan (`recs.length===2`, each `=== path.join(root,"dir",<a|b>.md)`); renamed.
- [ ] C9 (`has(blocksText(out),"#@ghost.md")`), 4f (`has(o,"@weird.md.bak")`), 4h (`has(o,"@api.md.old")`), 2c/5f (`!has(out,"B-MARKER")`) are UNCHANGED and pass.
- [ ] import-behavior L38 comment: `text(stripped)` → `text(verbatim)`.
- [ ] `git diff --stat`: relative-imports.test.mjs + import-behavior.test.mjs ONLY.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the live-verified suite state (import-behavior 23/0 green; relative-imports 35/3 with
B1/B4/B6 the exact failures), the root cause (`scanTokens` now `Promise<string[]>` — `prefixLen`/`index` dead,
quoted from file-injector.ts L862-894), the exact 3 failing assertions (quoted verbatim with line numbers), the
exact old→new for each (B1/B4: `.abs`→direct; B6: drop prefixLen, repurpose to the union), the verification that
ALL marker assertions (C9/4f/4h/2c/5f) are already correct (no flip needed), the one stale comment (import-behavior
L38), the scope boundary (file-injector.test.mjs is P1.M2.T1's parallel scope — it has the SAME scanTokens-shape
failures T1.S1-9/10/12, not mine), and the gates. The implementer edits 3 assertions + 2 comments across 2 files
and runs 2 commands.

### Documentation & References

```yaml
# MUST READ — the marker-assertion scout report (confirms which assertions are marker-stripping vs resolution)
- file: plan/009_0d85ac0b1b08/architecture/test_assertions_analysis.md
  why: "§5 'relative-imports.test.mjs & import-behavior.test.mjs — marker expectations': C9 is the ONLY explicit
        marker assertion in relative-imports (missing import → verbatim, already correct); 4f/4h in import-behavior
        (extended tokens → verbatim, already correct); 2c/5f test NON-INJECTION (B-MARKER absent because the file
        isn't injected, not because of stripping). §8 summary: relative-imports has 1 marker assertion, import-behavior
        has 2 — all verbatim. §10: 'relative-imports and import-behavior never assert on r.text at all — they only
        check block content via has.' So the verbatim-prompt change does NOT flip any marker assertion here."
  critical: "The scout report predates running the suites post-M1. It correctly predicted the marker assertions are
             fine but did NOT flag the scanTokens return-shape failures (B1/B4/B6) — those are P1.M1.T1.S1's
             scanTokens→string[] change, which the report's §0 still describes as the OLD {index,prefixLen,abs} shape.
             This task fixes what the live run surfaced."

# MUST READ — the scanTokens return-shape change (the root cause of B1/B4/B6)
- file: plan/009_0d85ac0b1b08/P1M1T1S1/PRP.md   # (scanTokens → Promise<string[]>; prefixLen/index removed — LANDED)
  why: "P1.M1.T1.S1 changed scanTokens to return Promise<string[]> (resolved abs paths ONLY). The {index,prefixLen,abs}
        record shape is GONE — prefixLen existed only for stripping, which plan 009 removed. Group B (B1/B4/B6) reads
        the old record shape → B1/B4 fail on `recs[0].abs` (undefined); B6 fails on `recs[i].prefixLen` (undefined →
        TypeError on .endsWith). This task migrates those reads to the new string[] shape."
  critical: "prefixLen is DEAD. B6's premise ('prefixLen is correct (2 for #@, 1 for bare @)') is obsolete — do NOT
             try to preserve prefixLen. Repurpose B6 to assert the still-meaningful property (both #@ and bare-@
             resolve in one scan). The main suite's analogous T1.S1-9/10/12 tests (in file-injector.test.mjs) have the
             SAME issue and are P1.M2.T1's scope — this task mirrors the fix for the aux suites."

# The parallel sibling (no collision) — read for the shared scanTokens-shape migration pattern
- file: plan/009_0d85ac0b1b08/P1M2T1S3/PRP.md   # (file-injector.test.mjs migration — parallel)
  why: "P1.M2.T1.S3 migrates file-injector.test.mjs (including its T1.S1-9/10/12 scanTokens-shape tests that use
        .prefixLen/.abs). This task migrates the aux suites' analogous Group B. Disjoint files — no merge conflict.
        If S3 has landed, mirror its scanTokens-shape migration pattern for B6 (likely: drop prefixLen, assert the
        union/resolution)."

# The files you edit (the ONLY changes)
- file: relative-imports.test.mjs
  why: "GROUP B L180-243 (scanTokens unit tests). B1 L190-198; B4 L218-222; B6 L232-241; B-group header L182-184.
        blankState L188. C9 L339-346 (the marker assertion — UNCHANGED, verify). Helpers L71-80 (has/blocksRel/
        countAbs/blocksText — all string-operating, UNCHANGED). newRoot/mk fixtures."
  pattern: "Group B calls `mod.scanTokens(text, baseDir, opts, blankState())` and asserts on the returned array.
            Pre-M1 the array was {index,prefixLen,abs}[]; post-M1 it is string[]. So `recs[0].abs` → `recs[0]`;
            `recs.map(r=>r.abs)` → `recs`; `recs.find(r=>r.abs.endsWith(...))` → `recs.find(r=>r.endsWith(...))`;
            `r.prefixLen` → GONE."
  gotcha: "B6's `blankState()` lacks `bareAt` — scanTokens reads only `state.injectedSet` (not bareAt; bareAt comes
           via opts). So blankState needs NO change (the doc confirmed this for the old shape; still true). Do NOT
           add bareAt to blankState."

- file: import-behavior.test.mjs
  why: "L36-39 `run` helper (returns injectFiles result; comment says `text(stripped)` — STALE → `text(verbatim)`).
        L48-50 `has` helper (reads out.blocks — UNCHANGED). 4f L186-195; 4h L199-206 (marker assertions — UNCHANGED,
        already verbatim). 2c L117-123; 5f (non-injection — UNCHANGED). Group 4 header L143-147 (about cleanToken
        TOKEN CLEANUP — not marker stripping; NOT stale, no change)."
  pattern: "`has(out, marker)` joins out.blocks then includes — reads block content, never out.text. So the
            verbatim-prompt change does not affect any assertion; only the L38 comment is stale."
  gotcha: "L143-147 mentions 'stripped' but it's about cleanToken trimming trailing punctuation/GLUE from the TOKEN
           (e.g. '@b.md.*' → 'b.md'), which is UNCHANGED behavior (token cleanup ≠ marker stripping). Do NOT edit it —
           it's accurate. Only L38's `text(stripped)` is stale (it describes the prompt text, which is now verbatim)."

# The product code (UNCHANGED — read-only; the contract the tests migrate TO)
- file: file-injector.ts
  why: "scanTokens L862-894 returns Promise<string[]> (out.push(abs); return out — NO records, NO prefixLen). The
        cands array is internally {idx,token}[] (idx for the code-region exemption), but the OUTPUT is string[].
        injectFiles returns text=verbatim (P1.M1.T1.S3). injectMarkdown emits verbatim content (P1.M1.T1.S2). The
        engine is LANDED — do NOT edit it; the tests migrate to MATCH it."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD + plan-009 engine (P1.M1 LANDED: verbatim delivery; scanTokens → string[])
├── relative-imports.test.mjs    # ← EDIT (B1/B4/B6 + B-group header comment)
├── import-behavior.test.mjs     # ← EDIT (L38 comment only)
├── file-injector.ts             # UNCHANGED (the verbatim engine — LANDED; git diff empty for this task)
├── file-injector.test.mjs       # NOT edited (P1.M2.T1's parallel scope — has its own scanTokens-shape fixes)
├── scripts/typecheck.mjs        # untouched (test-only; .ts unchanged → trivially clean)
├── package.json / PRD.md / README.md   # untouched (README = P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1S1..P1M2T1S3/{research, PRP.md}   # P1.M1 (verbatim engine) LANDED; P1.M2.T1 (main suite) in flight
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
relative-imports.test.mjs    # MODIFIED:
                             #   (1) B1 (L196-197): recs[0].abs → recs[0]; recs.map(r=>r.abs) → recs
                             #   (2) B4 (L220-221): same
                             #   (3) B6 (L232-240): REPURPOSE — drop prefixLen; assert both #@ and bare-@ resolve
                             #       baseDir-relative in one scan; recs.find(r=>r.abs.endsWith(...)) → r.endsWith(...)
                             #   (4) B-group header (L182-184): "records carry abs paths" → "resolved abs paths"
                             #   UNCHANGED: B2/B3/B5/B7 (assert recs.length, not shape); C1-C12/D1-D7/E1-E3 (content
                             #   markers); C9 (the verbatim marker assertion); helpers; fixtures; the test() harness.
import-behavior.test.mjs     # MODIFIED:
                             #   (1) L38 comment: text(stripped) → text(verbatim)
                             #   UNCHANGED: ALL assertions (4f/4h/2c/5f and groups 1-5 — already green); helpers.
# file-injector.ts + file-injector.test.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — scanTokens returns string[] now (file-injector.ts:867,894), NOT {index,prefixLen,abs}[]. P1.M1.T1.S1
//   removed the record shape because prefixLen/index existed only for stripping (gone in plan 009). So `recs[0]` IS
//   the abs path; `recs[0].abs` is undefined; `recs[i].prefixLen` is undefined. Migrate the READS, do NOT try to
//   restore the old shape.

// CRITICAL — prefixLen is DEAD. B6's assertion `a.prefixLen === 2` / `b.prefixLen === 1` tests a removed concept.
//   Do NOT preserve prefixLen. REPURPOSE B6 to assert the still-meaningful property: both #@ and bare-@ resolve
//   baseDir-relative in a single scan (the bareAt:true union). Drop the prefixLen asserts; keep/extend the
//   `recs.find(r => r.endsWith(...))` resolution asserts.

// CRITICAL — the marker assertions (C9, 4f, 4h, 2c/5f) are ALREADY CORRECT. C9/4f/4h assert VERBATIM for
//   missing/unresolved tokens (always the behavior, even pre-plan-009). 2c/5f assert NON-INJECTION (the file isn't
//   injected at all when bareAt is off → its content marker is absent). Do NOT flip any of these — they pass as-is.
//   (Live-verified: import-behavior 23/0; relative-imports C9 passes.)

// GOTCHA — `recs.map((r) => r.abs)` in B1/B4's diagnostic message must become `recs` (the array IS the abs paths
//   now). Leaving `r.abs` in the diagnostic would print `[null,null]` even after the assertion is fixed, hiding
//   the real values on a future failure. Migrate both the ASSERT and the DIAGNOSTIC.

// GOTCHA — B6's `recs.find((r) => r.abs.endsWith("a.md"))` becomes `recs.find((r) => r.endsWith("a.md"))` (r is
//   the abs string). Then assert `a === path.join(root,"dir","a.md")` (not `a.abs === ...`).

// GOTCHA — do NOT touch import-behavior L143-147 (the Group 4 header). It mentions "stripped" but in the context
//   of cleanToken TOKEN CLEANUP (trimming trailing punctuation/glue from the token, e.g. '@b.md.*' → 'b.md'),
//   which is UNCHANGED behavior. Only L38's `text(stripped)` is stale (it describes the PROMPT text, now verbatim).

// GOTCHA — blankState() (relative-imports L188) needs NO change. scanTokens reads only state.injectedSet (dedup);
//   bareAt comes via opts, not state. The old shape's blankState had no bareAt either.

// GOTCHA — file-injector.test.mjs has the SAME scanTokens-shape failures (T1.S1-9/10/12 use .prefixLen/.abs) —
//   those are P1.M2.T1's parallel scope, NOT mine. Do NOT edit file-injector.test.mjs. `npm test` (all three
//   chained) is green only once BOTH P1.M2.T1 and this task land (P1.M3.T1 wires the chain).

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti (alias map). No test runner. test(name,fn)/assert(cond,msg).
//   The gates are `node ./relative-imports.test.mjs` and `node ./import-behavior.test.mjs`. Both load the REAL
//   committed file-injector.ts via jiti (the verbatim engine). npm run typecheck is the .ts gate (UNAFFECTED —
//   test-only; .ts unchanged → trivially 0 errors).
```

## Implementation Blueprint

### The 3 relative-imports fixes (Group B — scanTokens return-shape)

```js
// ── B1 (L196-197) — recs[0] IS the abs now (string[], not records) ──
// BEFORE:
  assert(recs.length === 1 && recs[0].abs === path.join(root, "dir", "b.md"),
    `expected 1 record at dir/b.md, got ${JSON.stringify(recs.map((r) => r.abs))}`);
// AFTER:
  assert(recs.length === 1 && recs[0] === path.join(root, "dir", "b.md"),
    `expected 1 resolved abs at dir/b.md, got ${JSON.stringify(recs)}`);   // recs IS the abs paths

// ── B4 (L220-221) — identical to B1 (bare-@ variant) ──
// BEFORE:
  assert(recs.length === 1 && recs[0].abs === path.join(root, "dir", "b.md"),
    `bare @ must resolve baseDir-relative; got ${JSON.stringify(recs.map((r) => r.abs))}`);
// AFTER:
  assert(recs.length === 1 && recs[0] === path.join(root, "dir", "b.md"),
    `bare @ must resolve baseDir-relative; got ${JSON.stringify(recs)}`);

// ── B6 (L232-240) — REPURPOSE: prefixLen is dead; assert the bareAt:true UNION (both forms resolve) ──
// BEFORE:
await test("B6: prefixLen is correct (2 for #@, 1 for bare @)", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A"); mk(root, "dir/b.md", "B");
  const recs = await mod.scanTokens("#@a.md then @b.md", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: true }, blankState());
  const a = recs.find((r) => r.abs.endsWith("a.md"));
  const b = recs.find((r) => r.abs.endsWith("b.md"));
  assert(a && a.prefixLen === 2, `#@ must carry prefixLen 2; got ${a && a.prefixLen}`);
  assert(b && b.prefixLen === 1, `bare @ must carry prefixLen 1; got ${b && b.prefixLen}`);
});
// AFTER — scanTokens returns string[] (resolved abs; no index/prefixLen — markers are never stripped, §6.4).
//        Repurposed to pin the still-meaningful property: both #@ and bare-@ resolve baseDir-relative in one scan.
await test("B6: both #@ and bare-@ resolve baseDir-relative in a single scan (bareAt:true union)", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A"); mk(root, "dir/b.md", "B");
  const recs = await mod.scanTokens("#@a.md then @b.md", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: true }, blankState());
  const a = recs.find((r) => r.endsWith("a.md"));
  const b = recs.find((r) => r.endsWith("b.md"));
  assert(recs.length === 2, `both #@ and bare-@ must resolve in one scan (the bareAt:true union); got ${recs.length}: ${JSON.stringify(recs)}`);
  assert(a && a === path.join(root, "dir", "a.md"), `#@a.md resolved baseDir-relative; got ${JSON.stringify(a)}`);
  assert(b && b === path.join(root, "dir", "b.md"), `bare @b.md resolved baseDir-relative; got ${JSON.stringify(b)}`);
});
```

### The B-group header comment (L182-184)

```js
// BEFORE:
// GROUP B — scanTokens: baseDir-parameterized scanning + guards.
// Proves the records carry abs paths resolved against `baseDir`, the relative-only + code-exempt
// guards fire, and the bare-@ union (bareAt:true) also resolves baseDir-relative.
// AFTER:
// GROUP B — scanTokens: baseDir-parameterized scanning + guards.
// Proves the resolved abs paths (string[] — scanTokens no longer returns index/prefixLen records; markers are
// detected only to resolve imports, never stripped, §6.4) are baseDir-relative, the relative-only + code-exempt
// guards fire, and the bare-@ union (bareAt:true) also resolves baseDir-relative.
```

### The import-behavior comment (L38)

```js
// BEFORE:
const run = async (cwd, prompt, bareAt) => {
  const out = await mod.injectFiles(prompt, [], ctxFor(cwd), bareAt);
  return out; // { text(stripped), images, injected, paged, blocks, details }
};
// AFTER:
const run = async (cwd, prompt, bareAt) => {
  const out = await mod.injectFiles(prompt, [], ctxFor(cwd), bareAt);
  return out; // { text(verbatim — the prompt is preserved as-typed, §6.4), images, injected, paged, blocks, details }
};
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: FIX B1 (relative-imports.test.mjs L196-197) — recs[0].abs → recs[0]
  - CHANGE the assert: `recs[0].abs === path.join(...)` → `recs[0] === path.join(...)`.
  - CHANGE the diagnostic: `recs.map((r) => r.abs)` → `recs`.
  - DO NOT touch the scanTokens call or opts (unchanged).

Task 2: FIX B4 (relative-imports.test.mjs L220-221) — identical to B1 (bare-@ variant)
  - Same two changes as Task 1.

Task 3: REPURPOSE B6 (relative-imports.test.mjs L232-240) — drop prefixLen; assert the union
  - RENAME: "B6: prefixLen is correct (2 for #@, 1 for bare @)" → "B6: both #@ and bare-@ resolve baseDir-relative
    in a single scan (bareAt:true union)".
  - CHANGE `recs.find((r) => r.abs.endsWith("a.md"))` → `recs.find((r) => r.endsWith("a.md"))` (same for b).
  - REPLACE the two prefixLen asserts with: `recs.length === 2` (the union) + `a === path.join(root,"dir","a.md")`
    + `b === path.join(root,"dir","b.md")` (baseDir-relative resolution for both forms).
  - DO NOT try to preserve prefixLen (it's dead — stripping removed).

Task 4: UPDATE the B-group header comment (relative-imports.test.mjs L182-184)
  - "records carry abs paths" → "resolved abs paths (string[] — scanTokens no longer returns index/prefixLen
    records; markers detected only to resolve imports, never stripped, §6.4)".

Task 5: UPDATE the import-behavior comment (import-behavior.test.mjs L38)
  - `text(stripped)` → `text(verbatim — the prompt is preserved as-typed, §6.4)`.
  - DO NOT touch L143-147 (Group 4 header — about cleanToken TOKEN CLEANUP, accurate, not stale).
  - DO NOT touch any assertion (4f/4h/2c/5f and groups 1-5 — already green).

Task 6: VERIFY gates
  - RUN: node ./relative-imports.test.mjs → EXPECT "Result: 38 passed, 0 failed." (was 35/3). B1/B4/B6 now ✓; C9 + all content-marker cases still ✓.
  - RUN: node ./import-behavior.test.mjs → EXPECT "Result: 23 passed, 0 failed." (already green; comment-only).
  - (belt-and-suspenders) npm run typecheck → 0 errors (the .ts is unchanged; test-only).
  - git diff --stat → relative-imports.test.mjs + import-behavior.test.mjs ONLY (no .ts, no file-injector.test.mjs).
  - IF B6 still fails: you kept a `.abs`/`.prefixLen` read, or the rename left a stale reference. Re-check Task 3.
  - IF a previously-passing case flips: you over-edited (touched a content-marker assertion or a helper). Revert it.
```

### Implementation Patterns & Key Details

```js
// The scanTokens return-shape migration (the core pattern — B1/B4/B6):
// scanTokens now returns Promise<string[]> (resolved abs paths). Every record-field read becomes a direct read:
const recs = await mod.scanTokens(text, baseDir, opts, blankState());   // recs: string[] (was {index,prefixLen,abs}[])
recs[0]          // was recs[0].abs   (B1, B4)
recs             // was recs.map(r => r.abs)  (the diagnostic)
recs.find(r => r.endsWith("a.md"))   // was recs.find(r => r.abs.endsWith("a.md"))  (B6)
// prefixLen is GONE — do not reference it. Repurpose any prefixLen assertion to the underlying property
// (B6: the bareAt:true union — both #@ and bare-@ resolve in one scan).

// The marker assertions stay EXACTLY as-is (they were already verbatim-correct):
has(blocksText(out), "#@ghost.md")   // C9 — missing import verbatim (always correct)
has(o, "@weird.md.bak")              // 4f — extended token exact-only, missing → verbatim
has(o, "@api.md.old")                // 4h — same
!has(out, "B-MARKER")                // 2c/5f — bare-@ inert when OFF → file NOT injected → marker absent (non-injection)
```

### Integration Points

```yaml
FILE_EDITS (relative-imports.test.mjs):
  - B1 (L196-197): recs[0].abs → recs[0]; diagnostic recs.map(r=>r.abs) → recs.
  - B4 (L220-221): same.
  - B6 (L232-240): rename; recs.find(r=>r.abs.endsWith) → r.endsWith; drop prefixLen; assert union + baseDir-relative.
  - B-group header (L182-184): "records carry abs paths" → "resolved abs paths (string[]…)".
  - UNCHANGED: B2/B3/B5/B7; C1-C12/D1-D7/E1-E3; C9 (the verbatim marker assertion); helpers (has/blocksRel/countAbs/
    blocksText); blankState; fixtures; the test()/assert harness.
FILE_EDITS (import-behavior.test.mjs):
  - L38 comment: text(stripped) → text(verbatim).
  - UNCHANGED: ALL assertions (groups 1-5, 4f/4h, 2c/5f); helpers (run/has); Group 4 header L143-147 (cleanToken, accurate).
NO_CHANGES: file-injector.ts (the verbatim engine — LANDED), file-injector.test.mjs (P1.M2.T1's parallel scope),
            scripts/typecheck.mjs, package.json, PRD.md, README.md (P1.M2.T4.S1), all plan/ files.
NO_LOGIC_CHANGE: detection/resolution/dedup/code-exempt/bare-@ logic is UNCHANGED. Only the test ASSERTIONS that
                 read scanTokens' old record shape change (to read the new string[] shape) + 2 comments.
```

## Validation Loop

### Level 1: The two auxiliary suites (the authoritative gates)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs
# Before: "Result: 35 passed, 3 failed." (B1/B4/B6 — scanTokens return-shape).
# After:  "Result: 38 passed, 0 failed."   Exit code 0.
#   B1/B4/B6 now ✓ (recs[0] / union); C9 + C1-C8/C10-C12/D1-D7/E1-E3 still ✓ (content markers + the verbatim marker assert).
# If B1/B4 still fail ("got [null]") → you left recs[0].abs or recs.map(r=>r.abs) (re-check Task 1/2).
# If B6 fails (TypeError or "got 1") → you kept .prefixLen/.abs, or the union assert is wrong (re-check Task 3).
# If a C/D/E case flips → you over-edited a content-marker assertion (revert it — those prove resolution, unaffected).

node ./import-behavior.test.mjs
# Before AND after: "Result: 23 passed, 0 failed."  Exit code 0. (Comment-only edit; no assertion changes.)
#   4f/4h (verbatim extended tokens) ✓; 2c/5f (non-injection) ✓; groups 1-5 ✓.
```

### Level 2: Scope integrity (no .ts, no main-suite edit)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts               # expect EMPTY (the engine is LANDED; tests only)
git diff --stat file-injector.test.mjs         # expect EMPTY (P1.M2.T1's parallel scope — do NOT touch)
git diff --stat                                # expect ONLY relative-imports.test.mjs + import-behavior.test.mjs
# Verify the scanTokens-shape migration is complete (no residual .abs/.prefixLen reads in the aux suites):
grep -n "\.abs\b\|prefixLen" relative-imports.test.mjs import-behavior.test.mjs   # expect 0 hits
```

### Level 3: The primary suite + npm test (cross-suite; depends on the parallel sibling)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs    # NOT this task's scope (P1.M2.T1 owns it). It currently FAILS on T1.S1-9/10/12
                                 # (same scanTokens-shape class). Once P1.M2.T1.S3 lands its fixes, this is green.
npm test                         # all three chained. GREEN only once BOTH P1.M2.T1 (main suite) AND this task land.
                                 # P1.M3.T1.S1 wires the chain. This task makes the TWO AUX suites green; it does
                                 # not touch file-injector.test.mjs.
```

### Level 4: Marker-assertion spot-check (confidence — the live run is authoritative)

```bash
cd /home/dustin/projects/pi-file-injector
# Confirm the marker assertions (the contract's focus) are UNCHANGED and pass:
node ./relative-imports.test.mjs 2>&1 | grep -E "C9|Result:"   # C9 ✓ (the #@ghost.md verbatim marker assertion)
node ./import-behavior.test.mjs 2>&1 | grep -E "4f|4h|2c|5f|Result:"  # all ✓ (verbatim + non-injection)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./relative-imports.test.mjs` → **38 passed, 0 failed** (B1/B4/B6 fixed).
- [ ] `node ./import-behavior.test.mjs` → **23 passed, 0 failed** (comment-only).
- [ ] Zero residual `.abs`/`prefixLen` reads in either aux suite (Level 2 grep → 0).
- [ ] `git diff --stat`: relative-imports.test.mjs + import-behavior.test.mjs ONLY (no .ts, no main suite).

### Feature Validation (migration correctness)

- [ ] B1/B4: `recs[0]` (the abs string) is asserted directly; diagnostics print `recs`.
- [ ] B6: REPURPOSED — no prefixLen; asserts both `#@` and bare-`@` resolve baseDir-relative in one scan (the union).
- [ ] C9 (`#@ghost.md` verbatim), 4f (`@weird.md.bak`), 4h (`@api.md.old`), 2c/5f (non-injection) UNCHANGED and passing.
- [ ] All resolution/content-marker cases (C1-C8/C10-C12/D1-D7/E1-E3, import-behavior groups 1-5) still pass — the
      correct file is still injected (now with its marker preserved in the parent's block, which these don't assert).
- [ ] import-behavior L38 comment updated to `text(verbatim)`.

### Code Quality Validation

- [ ] B6's rename reflects its new assertion (no stale "prefixLen" in the name).
- [ ] The B-group header comment accurately describes the `string[]` return shape.
- [ ] No assertion was FLIPPED that didn't need it (the marker assertions were already verbatim-correct).
- [ ] No new fixtures/helpers/cases; no test()/assert() signature change; no logic change.

### Documentation

- [ ] None beyond the 2 inline comments (item §5: test files). No README (P1.M2.T4.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT try to preserve `prefixLen`.** It's DEAD — plan 009 removed stripping, and `prefixLen` existed only for
  `slice(index, index + prefixLen)`. `scanTokens` returns `string[]` now. B6's prefixLen assertion is obsolete;
  repurpose it to the still-meaningful property (the bareAt:true union). Restoring prefixLen would re-introduce dead
  bookkeeping the engine deliberately dropped.
- ❌ **Do NOT flip any marker assertion (C9/4f/4h/2c/5f).** They were ALREADY verbatim-correct (missing/unresolved
  tokens were always left verbatim; 2c/5f test non-injection, not stripping). Live-verified: import-behavior 23/0,
  relative-imports C9 passes. Flipping them would BREAK correct assertions. The contract's "flip absent→present"
  applies ONLY to assertions of resolved-marker-stripping — and these two suites have NONE.
- ❌ **Do NOT touch import-behavior L143-147.** It mentions "stripped" but in the context of cleanToken TOKEN CLEANUP
  (trimming trailing punctuation/glue from the token), which is UNCHANGED. Only L38's `text(stripped)` is stale
  (it describes the prompt text, now verbatim).
- ❌ **Do NOT edit file-injector.ts (the verbatim engine is LANDED) or file-injector.test.mjs (P1.M2.T1's parallel
  scope — it has its own scanTokens-shape fixes in T1.S1-9/10/12).** `git diff --stat` for both must be empty.
- ❌ **Do NOT leave `recs.map((r) => r.abs)` in a diagnostic.** After the fix `r.abs` is undefined → the diagnostic
  prints `[null]`, hiding real values on a future failure. Migrate the diagnostic to `recs` alongside the assert.
- ❌ **Do NOT add `bareAt` to `blankState()`.** scanTokens reads only `state.injectedSet`; bareAt comes via opts.
  blankState was bareAt-free before and stays so.
- ❌ **Do NOT claim `npm test` is green from this task alone.** It chains all three suites; file-injector.test.mjs is
  P1.M2.T1's scope and currently fails on scanTokens-shape. This task makes the TWO AUX suites green; `npm test` is
  green once P1.M2.T1 also lands (P1.M3.T1 wires the chain).
- ❌ **Do NOT over-edit.** The live run shows exactly 3 failures (B1/B4/B6) + 1 stale comment. If a previously-passing
  case flips after your edit, you touched something you shouldn't have (a content-marker assertion or a helper) — revert.

---

## Confidence Score: 9/10

A small, fully-traced test migration against a LANDED engine, with the live suite state empirically confirmed
(import-behavior 23/0 green; relative-imports 35/3 with B1/B4/B6 the exact failures, all `scanTokens` return-shape).
The contract's prediction ("very few stripping-dependent assertions; the marker ones already assert verbatim") is
confirmed live: ZERO marker assertions need flipping (C9/4f/4h verbatim for missing tokens; 2c/5f non-injection).
The real work is the 3 `scanTokens` return-shape fixes (B1/B4: `.abs`→direct; B6: drop dead `prefixLen`, repurpose
to the bareAt:true union) + 1 stale comment — all with exact old→new quoted verbatim. The PRP nails the one
non-obvious point: `prefixLen` is DEAD (P1.M1.T1.S1 removed it because stripping is gone) — B6 must be REPURPOSED,
not preserved. It also draws the scope boundary cleanly (file-injector.test.mjs + its analogous T1.S1-9/10/12
failures are P1.M2.T1's parallel scope; `npm test` is green only once both land). The -1 reserves for the B6
repurpose judgment (delete vs repurpose — the PRP picks repurpose to preserve the bare-@ union coverage, mirroring
the likely main-suite T1.S1-9 migration) and the cross-suite `npm test` dependency on P1.M2.T1. The implementing
agent edits 3 assertions + 2 comments across 2 files and runs 2 commands.