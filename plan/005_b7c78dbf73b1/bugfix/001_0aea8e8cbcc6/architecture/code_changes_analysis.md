# Code Changes Analysis — Bugfix 001_0aea8e8cbcc6

All line numbers refer to the current working-tree `file-injector.ts` (1087 lines, committed
state — NOT modified in `git status`). Verified 2025 by direct read + live repro.

## Issue 1 — Fix site 1 (PRIMARY): Step 3.5 readability gate in `injectMarkdown`

**File:** `file-injector.ts`
**Function:** `injectMarkdown` (lines 824-877)
**Bug site:** Step 3.5 loop, lines 848-856:

```ts
  const injectable: { index: number; prefixLen: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (st.isFile()) injectable.push(r);
    } catch {
      /* missing/unreadable → leave verbatim (not stripped, not injected) */
    }
  }
```

**Defect:** `stat` + `isFile` confirms the path is a regular file but does NOT confirm it is
**readable**. A file that exists yet is unreadable (EACCES on the file itself) passes this check,
lands in `injectable`, has its marker stripped in Step 4 (lines 862-865), and is recursed in Step 6
— where `injectFile`'s `readFile` finally throws and returns `false`, too late: the marker is
already gone from the parent's emitted block.

### Fix (matches PRD Issue 1 "Suggested Fix" verbatim)

Add a readability gate so a marker is stripped ONLY when delivery will truly succeed. Keep the
existing `stat`+`isFile` (it also rejects directories per §5.4) and additionally require
readability via `fs.access(r.abs, fs.constants.R_OK)`:

```ts
  const injectable: { index: number; prefixLen: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (!st.isFile()) continue;            // directory/socket/etc → verbatim (§5.4) — unchanged
      await fs.access(r.abs, fs.constants.R_OK); // ← gate strip on READABILITY (PRD §5.4/§12.5)
      injectable.push(r);
    } catch {
      /* missing / directory / unreadable → leave verbatim (not stripped, not injected) */
    }
  }
```

**Why `fs.access(R_OK)` is the right primitive:**
- It tests the EXACT permission `readFile` needs (read on the file), so `strip ⟺ deliverable`
  for the text/markdown/binary case that dominates.
- Verified: `fs.constants.R_OK === 4` and `fs.constants` IS reachable through the existing
  `import { promises as fs } from "node:fs"` (the `promises` namespace re-exports `constants`).
  **No new import is required.** (Verified live: `node -e 'import("node:fs").then(({promises:fs})=>console.log(fs.constants.R_OK))'` → `4`.)
- `R_OK` on a directory the user can traverse but a file they cannot read → throws → verbatim
  (correct). On a missing file → throws (stat already caught it). On a regular readable file →
  passes → injectable (unchanged happy path).
- TOCTOU: a file could become unreadable between `access` and `readFile`, but that races the
  top-level path too and is acceptable (the `readFile` try/catch in `injectFile` is the final
  safety net and still returns `false`).

**Behavior changes this fix produces (all intended, all per PRD):**
| Import target (inside a delivered markdown) | Before | After |
|---|---|---|
| missing | verbatim ✓ (scanTokens filters) | verbatim ✓ (unchanged) |
| directory | verbatim ✓ (isFile false) | verbatim ✓ (unchanged) |
| **exists, UNREADABLE (EACCES/I-O)** | **marker STRIPPED, no block ✗ BUG** | **verbatim, no block ✓ FIXED** |
| exists, readable (text/md/binary) | stripped + block ✓ | stripped + block ✓ (unchanged) |
| readable image, resize OK | stripped + image ✓ | stripped + image ✓ (unchanged) |
| readable image, resizeImage THROWS | marker stripped, no image ✗ | marker stripped, no image ✗ (RESIDUAL — see below) |

## Issue 1 — Fix site 2 (SECONDARY, hygiene): don't poison `injectedSet` on failed `injectFile`

**File:** `file-injector.ts`
**Function:** `injectFile` (lines 676-728)
**Claim site:** line 684 `state.injectedSet.add(abs); // CLAIM`
**Catch site:** lines 726-727:

```ts
  } catch {
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
```

**Defect:** the claim runs BEFORE `readFile`/`resizeImage`. If the read/resize throws, `injectFile`
returns `false` but the abs STAYS claimed in `injectedSet`. A later reference to the same path
(Step 6's `if (state.injectedSet.has(r.abs)) continue`, or `processTokenStream`'s dedup) is then
suppressed — the failed file "poisons" the path for the whole prompt. The PRD §12 reference
pseudocode comment says "Claims abs on success", but the code claims before the read — an
inconsistency this fix closes.

> After the PRIMARY fix (R_OK gate), an UNREADABLE import is never in `injectable`, so Step 6 never
> recurses into it and never claims it — the poisoning for the unreadable case is already moot.
> This secondary fix matters for the **image-resize-throw** residual (a readable image that passes
> R_OK, gets stripped, recursed, claimed, then `resizeImage` throws) and for TOCTOU / future-proofing.
> It restores the clean invariant `claim ⟺ delivered`.

### Fix

Delete the abs from `injectedSet` on the failure path so the set means "delivered", not "attempted":

```ts
  } catch {
    state.injectedSet.delete(abs); // failure → un-claim so the path is NOT poisoned (retryable)
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
```

**Safety analysis (cycle-prevention dedup is PRESERVED):**
- Cycle prevention does NOT depend on a failed claim persisting. The self-claim that breaks a cycle
  happens on the SUCCESS path: `injectFile(abs)` claims `abs` (line 684) BEFORE calling
  `injectMarkdown`, whose Step 2 re-claims `abs` (idempotent) BEFORE scanning; any re-import of
  `abs` is then deduped. The `delete` only fires in the `catch` (failure), AFTER which `abs` is
  abandoned anyway — a cycle cannot form through a file that failed to read.
- A failed file has emitted NO block/image for itself (verified: in `injectFile`, `readFile` throws
  before any `state.blocks`/`state.images` push; for the image branch `resizeImage` is awaited
  BEFORE the image/block push, so a throw pushes nothing). `injectMarkdown` does not throw (all its
  I/O is try/caught; `emitText` does not throw) so the markdown branch never reaches this `catch`.
  Therefore un-claiming never desynchronizes the block list from the claim set.
- Self-import edge: a markdown importing ITSELF is unreadable only to itself — it is claimed by
  Step 2 before scan, so `scanTokens` dedups it to verbatim regardless. Unaffected.

**Test surface:** the cleanest unit assertion is on `injectedSet` membership after a forced
failure. Because `resizeImage` is a hard import (Finding D), the most reliable trigger is an
UNREADABLE file at top level (`processTokenStream` → `injectFile` → `readFile` throws): assert
that after `injectFiles("Read #@unreadable.txt")` the path is not retained as "delivered". (At top
level the claim-poisoning is not directly user-visible because stripping keys off the boolean
return, but the set-accuracy assertion still proves the invariant.)

## Image-resize-throw residual (OUT OF SCOPE for this changeset — documented)

A markdown that imports a READABLE image (`#@pic.png`) whose `resizeImage` **throws** (rather than
returning `null`) still has its marker stripped, because `pic.png` passes `stat`+`isFile`+`R_OK`
(readable!) but `injectFile`'s `resizeImage` then throws. The R_OK gate cannot predict a resize
failure without actually running the resize (expensive, duplicative). Fully closing this variant
needs the structural "strip only markers whose `injectFile` returned true" approach, which the PRD
calls "more invasive" (it requires editing an already-pushed block string or restructuring the
pre-order emit).

**Why this is acceptable to defer:**
1. The PRD itself frames it as a residual of the recommended R_OK fix ("covers for the
   text/markdown/binary case that dominates").
2. `resizeImage` is documented to return `null` on failure, not throw; a throw is an unexpected
   internal error, not a normal user workflow (contrast: an unreadable restricted file IS a normal
   workflow — that is what Issue 1 is about, and it IS fixed).
3. It is not currently reachable by the harness (Finding D) and was never observed in the ~70
   probes; the fix for the dominant case removes the only reported, reproduced trigger.

The fix should be NOTED in code (a comment at the R_OK gate) and in `system_context.md` so a future
changeset can pick up the structural fix if resize-throws become a real concern.

## Issue 2 — NO source change; VERIFY the already-applied test fix

`file-injector.ts` is unchanged. `file-injector.test.mjs` already contains the fix (uncommitted).
See `test_harness_analysis.md`.

## Insertion points summary (for the PRP)

| Change | File | Function | Lines | New import? |
|---|---|---|---|---|
| R_OK readability gate | file-injector.ts | injectMarkdown Step 3.5 | 848-856 | No (`fs.constants` already reachable) |
| Un-claim on failure | file-injector.ts | injectFile catch | 726-727 | No |
| Regression test (md import unreadable) | file-injector.test.mjs | new case (E4 template) | after ~615 | No |
| T2.S1-f fix | file-injector.test.mjs | (ALREADY PRESENT ~1999-2018) | — | — |

## Quality gate

- `node ./scripts/typecheck.mjs` → must stay clean (`file-injector.ts` under `--strict`, 0 errors).
- `node ./file-injector.test.mjs` → must stay 120+/120+ passing (the new regression case is added
  on top; the chmod-000 case must be root-skipped like E4).
