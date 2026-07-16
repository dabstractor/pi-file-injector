---
name: "P1.M1.T1.S2 (bugfix 001) — Un-claim abs from injectedSet on injectFile failure (claim ⟺ delivered)"
prd_ref: "bugfix PRD §h3.0 Issue 1 (Suggested Fix: 'Also consider NOT claiming the abs in injectedSet when injectFile ultimately fails'); PRD §5.4/§12.5 (leave verbatim on error); §12 reference pseudocode ('Claims abs on success')"
target_file: "./file-injector.ts"   # 1-line fix in injectFile's catch + 2 doc comments
target_language: TypeScript (jiti transpile-on-load; gate = npm run typecheck --strict + node ./file-injector.test.mjs)
depends_on: "P1.M1.T1.S1 (FULLY LANDED in working tree: R_OK gate in injectMarkdown Step 3.5 L864 + E5 regression case L618-645). S1 did NOT touch injectFile; S2's edit site is the pre-existing catch. S2 closes the image-resizeImage-THROWS residual + TOCTOU window + restores the claim⟺delivered invariant that S1's R_OK gate left open."
consumed_by: "P1.M2.T2.S1 (README/doc sweep — may cite the claim⟺delivered invariant as a hygiene note)"
---

# PRP — P1.M1.T1.S2: Un-claim abs from injectedSet on injectFile failure (claim ⟺ delivered)

> **Scope flag:** This is a **bugfix hygiene subtask** (bugfix 001, Fix site 2). It adds ONE line —
> `state.injectedSet.delete(abs);` — as the first statement of `injectFile`'s catch, plus 2 small doc
> comments, plus ONE focused unit test (E6) that calls the EXPORTED `injectFile` directly. No new exports,
> no new imports, no module-surface change. S1 (Fix site 1, the R_OK gate) is **fully landed** (verified:
> gate at L864, E5 at L618-645, baseline **121 passed**). This subtask restores the clean invariant
> `claim ⟺ delivered` so a failed delivery no longer poisons the dedup set.

---

## Goal

**Feature Goal:** Make `injectFile`'s failure path revoke its pre-read claim of `abs` from
`state.injectedSet`, so the set means **"delivered"** (not "attempted"). A file that exists (stat+isFile
OK) but fails to read/resize must NOT remain claimed — otherwise a later reference to the same path
(`processTokenStream`'s re-check; `injectMarkdown` Step 6's `if (state.injectedSet.has(r.abs)) continue`)
is silently suppressed (never retried) for the rest of the prompt.

**Deliverable:** Modified `file-injector.ts` (1 line added in `injectFile`'s catch L726-728; 2 doc-comment
touchpoints at the claim L684 and the JSDoc L666-669) + modified `file-injector.test.mjs` (new unit case
**E6** after E5, calling `mod.injectFile` directly with a chmod-000 unreadable file).

**Success Definition:**
1. New case E6 is RED before the fix (`state.injectedSet.has(secret) === false` FAILS — path stays claimed),
   GREEN after (`delete(abs)` revokes the claim).
2. `node ./file-injector.test.mjs` → existing **121** + new E6 = **122 passed, 0 failed**, exit 0.
3. `npm run typecheck` → 0 errors under `--strict`.
4. No success-path behavior change (the `delete` fires ONLY in the catch; readable files inject identically).

## Why

- **Restores a clean, documented invariant.** The PRD §12 reference pseudocode comments "Claims abs on
  success", but the code claims at L684 BEFORE the read and never revokes on failure — a `claimed-but-not-
  delivered` state. This subtask makes the code match the spec: `claim ⟺ delivered`.
- **Closes the residual S1's R_OK gate left open.** S1 (Fix site 1) gates marker-stripping on readability,
  so an UNREADABLE import is never recursed/claimed — that case is fixed. But two paths still claim-then-
  fail: (a) the **image-resizeImage-THROWS residual** — a readable image passes R_OK, gets stripped +
  recursed + claimed, then `resizeImage` throws (the R_OK gate cannot predict a resize failure); (b) the
  **TOCTOU window** — a file readable at Step 3.5 that becomes unreadable before Step 6's readFile. In
  both, abs is claimed but not delivered, poisoning later references. S2 un-claims on failure for BOTH.
- **Honest dedup semantics.** After S2, `injectedSet` accurately tracks delivered paths, so a later
  duplicate reference to a path that FAILED delivery can retry (and fail/verbatim harmlessly) instead of
  being silently suppressed. This is the "Also consider NOT claiming the abs when injectFile ultimately
  fails" suggestion in bugfix PRD §h3.0 Issue 1.

## What

No user-visible / API / config surface change (internal dedup hygiene). Concretely:

### Success Criteria

- [ ] `injectFile`'s catch (L726-728) executes `state.injectedSet.delete(abs);` as its FIRST statement,
      before `return false;`.
- [ ] The claim inline comment (L684) + the injectFile JSDoc (L666-669) note the claim is REVOKED on
      failure ("claim ⟺ delivered", PRD §12.5).
- [ ] E6 unit case present (after E5), RED before the `delete`, GREEN after.
- [ ] `node ./file-injector.test.mjs` → 122 passed (121 + E6), 0 failed; `npm run typecheck` clean.
- [ ] No success-path change: readable text/markdown/binary/image(resize-OK) inject identically (the
      `delete` only fires in the catch). All 121 existing cases stay byte-for-byte green.
- [ ] No new exports / imports; sanity list + ASSERTED_EXPORTS + completeness guard UNCHANGED.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP
gives the exact old→new for the 1-line catch edit + 2 comments, the rigorous safety proof (only
readFile/resizeImage throw; both precede any push; injectMarkdown never throws), the verbatim E6 test
body, the verified module-surface facts (injectFile is already exported/asserted), and both gates. The
implementer edits one function (1 line + 2 comments) + adds one test case, then runs two commands.

### Documentation & References

```yaml
# MUST READ — the precise fix site + safety analysis for THIS subtask
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/code_changes_analysis.md
  why: "§'Issue 1 — Fix site 2 (SECONDARY, hygiene)' gives the exact old→new catch code, the cycle-prevention
        safety analysis (why delete cannot reopen a cycle), the block-list↔claim-set desync proof, and the
        note that this matters for the resizeImage-throw residual + TOCTOU after S1's R_OK gate."
  critical: "The delete MUST be the FIRST statement in the catch (before return false). injectFile's try has
             exactly TWO throwing awaits — readFile (L689) and resizeImage (image branch) — both BEFORE any
             push, so the catch only fires when nothing was delivered for abs (safe to un-claim)."

# MUST READ — the contract for the verbatim-on-error guarantee this hygiene supports
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/P1M1T1S1/PRP.md
  why: "S1 (Fix site 1, FULLY LANDED) added the R_OK gate to injectMarkdown Step 3.5 + case E5. S1 explicitly
        left injectFile's claim/catch UNCHANGED ('Do NOT do Fix site 2 here. That's S2'). This S2 is that fix."
  critical: "S1 is landed (gate at L864, E5 at L618-645, baseline 121). S2 starts POST-S1. The catch edit
             site is UNCHANGED by S1 (S1 touched injectMarkdown, not injectFile)."

# MUST READ — the spec for the hygiene fix (the 'Suggested Fix' tail of Issue 1)
- file: PRD.md  (bugfix PRD §h3.0 Issue 1)
  why: "Issue 1's 'Suggested Fix' ends: 'Also consider NOT claiming the abs in injectedSet when injectFile
        ultimately fails, so a later duplicate can still be retried (currently a failed read poisons the path
        for the whole prompt).' This subtask implements exactly that. §5.4/§12.5 are the verbatim-on-error
        contract; §12 pseudocode 'Claims abs on success' is the invariant this restores."

# The file you edit (the only source change)
- file: file-injector.ts
  why: "injectFile L676-728. Claim L684; try-body L689-725 (readFile L689, resizeImage in image branch — the
        only two throwing awaits, both before any push); catch L726-728 (the edit site). State interface L318-325
        (has bareAt L325 — the minimal-state for E6 MUST include bareAt:false)."
  pattern: "The catch is `} catch { return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5) }`.
            Add `state.injectedSet.delete(abs);` as the first line."
  gotcha: "injectFile IS exported (L676) AND in the sanity list (L123) AND in ASSERTED_EXPORTS (L140) — no
           module-surface edit needed. Set.delete is a built-in — no new import. Do NOT touch injectMarkdown
           (S1's R_OK site) or any success-path line."

# The gate you also edit (add E6 unit case)
- file: file-injector.test.mjs
  why: "E4 (L600-615) is the chmod-000/root-skip/try-finally template; E5 (L618-645) is S1's case. E1-E5 exist
        → E6 is FREE. runCase(n,name,fn) at L88 accepts string ids. injectFile is callable as mod.injectFile."
  pattern: "E6 models E4/E5: root-skip → write UNIQUE fixture → chmod 000 → try { await mod.injectFile(...) +
            asserts } finally { chmod 644 }. BUT E6 calls injectFile DIRECTLY with a hand-built state (not
            injectFiles) — a unit test of the failure path."
  gotcha: "State is a TS interface erased at runtime by jiti — a structurally-compatible PLAIN OBJECT works
           ({injectedSet:new Set(),blocks:[],images:[],remaining:null,count:0,paged:0,bareAt:false}). bareAt
           is REQUIRED (L325) even though unused on the failure path (keeps the object structurally complete)."

# README — VERIFY only, no edit (this is internal hygiene; no user-facing promise changes)
- file: README.md
  why: "The README already states 'permission error → Left as written' (S1 brought the code into compliance).
        S2 is internal dedup hygiene (claim⟺delivered) — no user-facing/config/API promise. No edit."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectFile catch L726-728: +delete(abs); claim comment L684; JSDoc L666-669)
├── file-injector.test.mjs    # ← EDITED (+E6 unit case after E5 ~L645, before G1)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README verify-only, no edit)
└── plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/
    ├── architecture/{code_changes_analysis.md, system_context.md, test_harness_analysis.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (FULLY LANDED) — the R_OK gate + E5
    └── P1M1T1S2/
        ├── research/research_notes.md   # ← safety proof + E6 design + line map
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectFile catch: +`state.injectedSet.delete(abs);` (first line);
                          #                  claim inline comment (L684) + JSDoc (L666-669) note claim⟺delivered.
file-injector.test.mjs    # MODIFIED — +runCase("E6", …) after E5 (~L645), before G1. NO sanity/guard/fixture edits.
# No other files. No new files. No new exports. No new imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the delete MUST be the FIRST statement in the catch, before `return false;`. If placed after
//   `return`, it is unreachable dead code (the fix would silently not apply → E6 stays RED).

// CRITICAL — only TWO awaits inside injectFile's try can throw: fs.readFile(abs) (L689) and resizeImage(...)
//   (image branch). BOTH precede any push (F5/image/binary/text pushes come after the read/resize succeeds).
//   So when the catch fires, NOTHING was pushed for abs (no block, no image, no count++). Un-claiming abs
//   therefore NEVER desynchronizes the block list from the claim set. (Verified by grep: the only `await`s
//   in the try are readFile + resizeImage.)

// CRITICAL — the markdown branch (`await injectMarkdown(...)`) does NOT throw (all its I/O is try/caught;
//   emitText is pure string math). So the catch NEVER fires for a successfully-read markdown file — the
//   delete never revokes a claim on a file whose block WAS emitted. This is the key safety property.

// CRITICAL (test) — E6 calls mod.injectFile DIRECTLY (a unit test), NOT injectFiles. State is a TS interface
//   ERASED at runtime by jiti → pass a structurally-compatible PLAIN OBJECT (the .mjs test is untyped).
//   The object MUST include bareAt:false (State L325) even though unused on the failure path.

// CRITICAL (test) — E6's fixture name MUST be unique (unclaim_secret.txt), not a shared fixture (a.ts/api.md/
//   notes.md/etc.). E6 writes+chmods it inline (like E4/E5); unique names avoid any cross-case collision.

// GOTCHA — root-skip: chmod 000 is INEFFECTIVE as root (root reads anything). E6 MUST `if (process.getuid()
//   === 0) { console.log("      (skipped: ...)"); return; }` like E4/E5. Skipped → runCase catches no throw
//   → counts as PASS (accepted limitation; CI runs non-root).

// GOTCHA — cycle-prevention is PRESERVED. Cycle termination keys on SUCCESS-path claims (injectFile claims
//   abs → injectMarkdown Step 2 re-claims before scan → re-import dedups to verbatim). A file that FAILED
//   to read never reaches injectMarkdown → no scan → no cycle through a failed node can exist. The delete
//   fires only in the catch (failure), after which abs is abandoned — it cannot reopen a cycle.

// LIBRARY — Set.prototype.delete is a built-in (returns boolean; no throw). No new import. TypeScript via
//   jiti (no build step); the gate is `npm run typecheck` (--strict) + `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

No data-model change. `injectedSet` stays `Set<string>` (State L321). The fix is a `Set.delete` call in
an existing catch — no new field, no new type.

### The fix (exact old → new)

**Edit 1 — `injectFile` catch (file-injector.ts L726-728):** add the un-claim as the first statement.

```ts
// BEFORE:
  } catch {
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }

// AFTER:
  } catch {
    state.injectedSet.delete(abs); // failure → UN-CLAIM so the path is NOT poisoned (claim ⟺ delivered; PRD §12.5)
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
```

**Edit 2 — claim inline comment (L684):** note the claim is revoked on failure.

```ts
// BEFORE:
  state.injectedSet.add(abs); // CLAIM — dedup incl. self-import (recursion-readiness)

// AFTER:
  state.injectedSet.add(abs); // CLAIM — dedup incl. self-import (recursion-readiness); REVOKED on failure (claim ⟺ delivered, see catch)
```

**Edit 3 — injectFile JSDoc (L666-669):** the claim sentence gains a "revoked on failure" clause.

```ts
// BEFORE:
 * PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims `abs` in state.injectedSet AFTER
 * stat+isFile succeed but BEFORE read, so a self-import or mid-recursion re-entry dedups to verbatim
 * (recursion-readiness for T2 markdown; behavior-neutral at top level). NEVER throws: stat miss / !isFile
 * / read or resize error → return false (token left verbatim, PRD §5.4 / §12.5).

// AFTER:
 * PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims `abs` in state.injectedSet AFTER
 * stat+isFile succeed but BEFORE read, so a self-import or mid-recursion re-entry dedups to verbatim
 * (recursion-readiness for T2 markdown; behavior-neutral at top level). The pre-read claim is REVOKED on
 * the read/resize failure path (claim ⟺ delivered, PRD §12.5) so a file that fails delivery does not
 * poison dedup. NEVER throws: stat miss / !isFile / read or resize error → return false (un-claimed) +
 * token left verbatim (PRD §5.4 / §12.5).
```

### Safety proof (why the `delete` is correct — encode in the JSDoc rationale)

1. **Only readFile (L689) and resizeImage (image branch) can throw inside the try** (grep-verified — the
   only two `await`s). Both execute BEFORE any `state.blocks`/`state.images` push AND before `state.count++`
   (L725). ∴ when the catch fires, **nothing was delivered for `abs`**.
2. **The markdown branch never throws** (`injectMarkdown` try/catches all its I/O; `emitText` is pure). ∴
   the catch never fires for a markdown file whose own block WAS emitted — the delete never revokes a
   "delivered" claim.
3. **Cycle-prevention keys on SUCCESS-path claims.** `injectFile(abs)` → `injectMarkdown` → Step 2
   re-claims `abs` before scanning → re-import dedups. A file that failed to read never reaches
   `injectMarkdown` → no scan → no cycle through a failed node. The delete (catch-only) cannot reopen a cycle.
4. **No block-list↔claim-set desync:** the delete fires only when no block/image was pushed for `abs`.

### The E6 test (exact body — append after E5's `});` ~L645, before the `runCase("G1", ...)` block)

```js
// E6 — §12.5 / hygiene: injectFile must UN-CLAIM abs on the read/resize FAILURE path so a failed delivery
// does NOT poison state.injectedSet (claim ⟺ delivered). DIRECT unit test of the EXPORTED injectFile with a
// hand-built State (the unexported State TYPE is erased by jiti → a structurally-compatible plain object works).
// chmod 000 → stat OK → claim → readFile EACCES → catch MUST delete(abs) → return false. (root-skip: chmod 000
// is ineffective as root — same caveat as E4/E5.)
await runCase("E6", "injectFile read-failure un-claims abs (claim ⟺ delivered) — no poisoned dedup", async () => {
  if (process.getuid() === 0) {
    // chmod is ineffective when running as root — skip with a note (same caveat as E4/E5).
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  const secret = path.join(TMPDIR, "unclaim_secret.txt"); // UNIQUE fixture name (no shared-fixture collision)
  fsSync.writeFileSync(secret, "unreadable\n");
  fsSync.chmodSync(secret, 0o000);
  try {
    // minimal State — the TS interface is erased at runtime; a structurally-compatible plain object works.
    // bareAt is REQUIRED (State L325) even though unused on the failure path.
    const state = {
      injectedSet: new Set(),
      blocks: [],
      images: [],
      remaining: null,
      count: 0,
      paged: 0,
      bareAt: false,
    };
    // ctx is UNUSED on the failure path (stat OK → claim → readFile throws → catch → delete → return false
    // before any block/image push), but pass a structurally-valid ctx for cleanliness.
    const result = await mod.injectFile(secret, state, { cwd: TMPDIR, getContextUsage: () => undefined });
    assert(result === false, `failed read must return false, got ${result}`);
    // THE FIX: the failure path must UN-CLAIM abs so a later duplicate reference can retry (not be silently suppressed)
    assert(state.injectedSet.has(secret) === false,
      `failed injectFile must NOT leave the path claimed (claim ⟺ delivered; a poisoned dedup set suppresses later retries), got has=${state.injectedSet.has(secret)}`);
    assert(state.count === 0, `nothing delivered on failure, got count=${state.count}`);
    assert(state.blocks.length === 0, `no block pushed on failure, got blocks.length=${state.blocks.length}`);
  } finally {
    fsSync.chmodSync(secret, 0o644); // restore so TMPDIR cleanup can remove it
  }
});
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — injectFile ONLY):
  - catch (L726-728): +`state.injectedSet.delete(abs);` as the FIRST line (before return false).
  - claim comment (L684): append "; REVOKED on failure (claim ⟺ delivered, see catch)".
  - JSDoc (L666-669): add the "revoked on failure (claim ⟺ delivered, PRD §12.5)" clause to the claim sentence.
  - UNCHANGED: the stat try/catch (L678-682), the claim line itself (L684), the whole try-body (L686-725),
    injectMarkdown (S1's R_OK site L837-877), scanTokens, processTokenStream, resolveImportPath, emitText,
    every other function. No new import. No new export.

FILE_EDITS (file-injector.test.mjs — append E6 ONLY):
  - add (after E5's `});` ~L645, before `runCase("G1", ...)` ~L647): the E6 runCase block (see Blueprint).
  - NO edits to: sanity list (L113-128), ASSERTED_EXPORTS (L138-141), completeness guard (L143-153),
    buildFixtures, any existing case (incl. S1's E5).

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md (verify-only, no edit), all plan/ files.
NO new exports. NO new imports. injectMarkdown stays PRIVATE. No module-surface guard edit.
```

### Implementation Tasks (ordered by dependencies — TDD: RED first)

```yaml
Task 1 (RED): ADD unit case E6 to file-injector.test.mjs (after E5 ~L645, before G1)
  - MODEL on E4/E5 (L600-645): root-skip `if (process.getuid() === 0) { console.log("      (skipped: running as root — chmod 000 is ineffective)"); return; }`;
    write a UNIQUE fixture; chmod 000; try { await mod.injectFile(...) + asserts } finally { chmod 644 }.
  - FIXTURE: const secret = path.join(TMPDIR, "unclaim_secret.txt"); (UNIQUE — no shared-fixture collision).
  - STATE (plain object — jiti erases the State type): { injectedSet:new Set(), blocks:[], images:[],
            remaining:null, count:0, paged:0, bareAt:false } (bareAt REQUIRED per L325).
  - CALL: const result = await mod.injectFile(secret, state, { cwd: TMPDIR, getContextUsage: () => undefined });
  - ASSERT: (a) result === false; (b) state.injectedSet.has(secret) === false  ← THE BUG (RED before fix);
            (c) state.count === 0; (d) state.blocks.length === 0.
  - FINALLY: fsSync.chmodSync(secret, 0o644); (restore so TMPDIR cleanup works).
  - VERIFY RED: run `node ./file-injector.test.mjs` → E6 FAILS on assertion (b) (path currently STAYS claimed).
    (result===false already holds — the existing behavior; only the injectedSet assertion is RED.)

Task 2 (GREEN): ADD `state.injectedSet.delete(abs);` to injectFile's catch (file-injector.ts L726-728)
  - EDIT: insert `state.injectedSet.delete(abs); // failure → UN-CLAIM so the path is NOT poisoned (claim ⟺ delivered; PRD §12.5)`
          as the FIRST statement of the catch, before `return false;`.
  - EDIT (claim comment L684): append "; REVOKED on failure (claim ⟺ delivered, see catch)".
  - EDIT (JSDoc L666-669): add the "revoked on failure (claim ⟺ delivered, PRD §12.5)" clause (see Blueprint).
  - DO NOT touch: the claim line itself, the try-body, stat try/catch, injectMarkdown, any success path.
  - VERIFY GREEN: run `node ./file-injector.test.mjs` → E6 PASSES (path un-claimed).

Task 3 (VERIFY): run both gates
  - npm run typecheck → 0 errors under --strict (Set.delete is a built-in; no type issue).
  - node ./file-injector.test.mjs → 122 passed (121 + E6), 0 failed, exit 0.
  - Confirm no existing case (esp. E4/E5, markdown 15-20/MD1/MD2) regressed.

Task 4 (DOCS verify): README.md
  - VERIFY no user-facing promise changed (S2 is internal dedup hygiene; README's "permission error → Left as
    written" already holds from S1). NO edit.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# Set.delete is a built-in; the catch edit adds no type surface. (If it errors, you touched more than the catch.)
```

### Level 2: The gate — full suite green + E6 GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: E6 prints ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 122 passed, 0 failed.        (121 POST-S1 baseline + E6)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
# If a LATER markdown case (15-20/MD1/MD2) or E5 regressed, you touched injectMarkdown or a shared fixture —
# re-scope to injectFile's catch ONLY. If E6 stays RED, the delete isn't the first catch statement (dead code).
```

### Level 3: TDD RED→GREEN confirmation

```bash
# Step A (RED): with E6 added but the catch UNCHANGED, E6 must FAIL on assertion (b):
#   "failed injectFile must NOT leave the path claimed" → currently STAYS claimed → ✗
# Step B (GREEN): after adding `state.injectedSet.delete(abs);` as the first catch statement, E6 must PASS:
node ./file-injector.test.mjs 2>&1 | grep -E "case E6|Result:"
# Expected: "  ✓ case E6: injectFile read-failure un-claims abs …" + "Result: 122 passed, 0 failed."
# Note: if running as ROOT, E6 is skipped (chmod 000 ineffective) and prints the skip note — it still counts
# as PASS (runCase caught no throw). Run as non-root to actually exercise the failure path.
```

### Level 4: Targeted behavior check (success paths unchanged)

```bash
# The delete fires ONLY in the catch. Success-path cases must be byte-for-byte identical:
node ./file-injector.test.mjs 2>&1 | grep -E "case 1:|case 15:|case 20:|case E4:|case E5:|case MD1:|Result:"
# Expected: all ✓ (readable text/markdown/binary/image inject identically; top-level unreadable E4 + markdown
# unreadable E5 still verbatim). The claim⟺delivered change is observably inert on every success path.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 122 passed (121 + E6), 0 failed, exit 0.
- [ ] No new imports (`Set.delete` is a built-in); no new exports; no module-surface/sanity-list/guard edit.

### Feature Validation (behavior)

- [ ] E6 RED before the delete (path stays claimed), GREEN after (path un-claimed).
- [ ] `injectFile` failure path: `result === false` AND `state.injectedSet.has(abs) === false` AND
      `state.count === 0` AND `state.blocks.length === 0` (nothing delivered, nothing poisoned).
- [ ] Success paths unchanged: readable text/markdown/binary/image(resize-OK) inject identically (cases 1-20,
      MD1/MD2 green). The delete fires ONLY in the catch.
- [ ] Top-level unreadable (E4) + markdown unreadable (E5) still verbatim (S1's fixes intact).

### Code Quality Validation

- [ ] The `delete` is the FIRST statement of the catch (before `return false;`) — not dead code.
- [ ] The claim inline comment (L684) + JSDoc (L666-669) note "claim ⟺ delivered" / "revoked on failure" (PRD §12.5).
- [ ] injectMarkdown (S1's R_OK site), scanTokens, processTokenStream, the claim line, and the try-body UNCHANGED.
- [ ] E6 uses a UNIQUE fixture (unclaim_secret.txt) + root-skip + try/finally chmod-restore; minimal state
      includes bareAt:false.

### Documentation

- [ ] injectFile JSDoc + claim comment updated (Mode A — item §6): claim revoked on failure (claim ⟺ delivered).
- [ ] README.md NOT edited (internal hygiene; no user-facing promise change). S1 already brought the code
      into compliance with README's "permission error → Left as written".

---

## Anti-Patterns to Avoid

- ❌ **Do NOT place `state.injectedSet.delete(abs);` AFTER `return false;`.** It would be unreachable dead code
  → E6 stays RED. It MUST be the FIRST statement of the catch.
- ❌ **Do NOT touch the claim line, the try-body, injectMarkdown, or any success path.** The fix is the catch
  ONLY (+ 2 doc comments). S1 owns injectMarkdown's R_OK gate; leave it. The claim at L684 STAYS (it's correct
  on the success path — the delete just revokes it on failure).
- ❌ **Do NOT add the delete anywhere except injectFile's catch.** It is NOT needed in the stat try/catch
  (L678-681: a stat miss claims nothing — the claim is at L684, AFTER the stat try/catch). It is NOT needed
  after `if (!st.isFile()) return false;` (L683: also before the claim). ONLY the read/resize catch (L726-728)
  revokes a claim that was made.
- ❌ **Do NOT worry about cycle-regression.** The safety proof (Blueprint) shows cycle-prevention keys on
  success-path claims; a failed read never reaches injectMarkdown → no cycle through a failed node. The
  catch-only delete cannot reopen a cycle.
- ❌ **Do NOT call injectFiles in E6.** E6 is a DIRECT unit test of the exported `mod.injectFile` with a
  hand-built state (the cleanest assertion of the injectedSet invariant). Calling injectFiles would conflate
  the claim-revocation with the whole pipeline.
- ❌ **Do NOT omit `bareAt: false` from E6's minimal state.** State L325 has `bareAt`; while unused on the
  failure path, including it keeps the object structurally complete (and matches the item §3 spec verbatim).
- ❌ **Do NOT reuse a shared fixture name in E6** (a.ts/api.md/notes.md/secret/etc.). Use `unclaim_secret.txt`
  (unique) to avoid any cross-case collision. E4 uses `secret`; E5 uses perm_api.md/perm_notes.md — pick distinct.
- ❌ **Do NOT edit the README.** S2 is internal dedup hygiene; S1 already brought the code into compliance with
  README's "permission error → Left as written". Verify only, no edit.
- ❌ **Do NOT skip the root-guard in E6.** As root, chmod 000 is ineffective (root reads anything) → the test
  would not exercise the failure path. Mirror E4/E5's `if (process.getuid() === 0) { … return; }`.

---

## Confidence Score: 9/10

A one-line hygiene fix (`Set.delete` as the first catch statement) with a rigorous safety proof (only
readFile/resizeImage throw inside the try; both precede any push; injectMarkdown never throws → the catch
never fires for a delivered markdown), a self-contained RED→GREEN unit test of the exported `injectFile`,
and a 121-green POST-S1 baseline. The -1 reserves for: (a) the root-skip limitation (E6 is a no-op as root,
same as E4/E5 — CI runs non-root); (b) the doc-edit precision (3 small comment touchpoints — easy to
mis-place if the implementer paraphrases the JSDoc instead of appending the clause). The implementing agent
edits one source function (1 line + 2 comments) + adds one test case, then runs `npm run typecheck` +
`node ./file-injector.test.mjs`.
