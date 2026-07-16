# PRP — P1.M1.T1.S1 (bugfix 001): Add R_OK readability gate to injectMarkdown Step 3.5 + regression test

> **Scope flag:** This is a **bugfix** for Issue 1 (Major): a markdown import whose target EXISTS but is
> UNREADABLE has its `#@`/`@` marker silently STRIPPED instead of left verbatim (PRD §5.4/§12.5/§10).
> The fix is ONE `fs.access(R_OK)` line in `injectMarkdown` Step 3.5 + ONE regression test (E5).
> **Scope = S1 ONLY.** The "un-claim on failure" hygiene fix (S2) and the image-resize-throw structural
> residual are OUT OF SCOPE here (documented only).

---

## Goal

**Feature Goal:** Restore the "leave verbatim on read error" guarantee for the markdown-import path:
when a delivered markdown file contains an import (`#@api.md` / `@api.md`) whose target exists (stat-OK)
but is unreadable (EACCES on readFile), the marker must stay byte-for-byte verbatim in the parent's emitted
block and no block/image appended — exactly like a missing-file import and exactly like the top-level path.

**Deliverable:** Modified `file-injector.ts` (injectMarkdown Step 3.5 loop L848-856 gains an
`await fs.access(r.abs, fs.constants.R_OK)` gate; Step 3.5 comment updated) + modified
`file-injector.test.mjs` (new regression case E5 placed after E4).

**Success Definition:**
1. New case E5 is RED before the fix (marker stripped → `r.text.includes("#@perm_api.md")===false`), GREEN after.
2. `node ./file-injector.test.mjs` → existing 120 + new E5 = **121 passed, 0 failed**, exit 0.
3. `npm run typecheck` → 0 errors under `--strict`.
4. No other behavior changes (missing/directory/readable-text/markdown/binary/image-resize-OK all byte-for-byte identical).

## Why

- **Honors an explicit, documented contract.** PRD §5.4 ("Leave the original `#@path` token **verbatim**…
  No block is appended"), §12.5 ("on any error leave the token verbatim… a prompt must never be lost"), §10
  ("`#@nonexistent.txt` → Token left verbatim; no block; no error"), §5.6 step-4 ("Missing/dir imports keep
  the marker verbatim"), and README.md:52 ("Missing file, directory, or permission error → Left as written.
  Nothing is appended."). The code currently violates this only on the markdown-import read-error path.
- **Closes a silent total-loss bug.** On a plausible restricted-file workflow (`#@spec.md` where spec.md
  references `#@secrets.md` or a file under a restricted dir), the user sees the marker vanish and assumes
  the import succeeded — but the model gets neither content nor any failure signal. Narrow trigger (exists +
  unreadable) keeps it off the happy path, hence Major not Critical.
- **Restores parity with the top-level path.** The top-level path already handles this correctly
  (`processTokenStream` strips only when `injectFile` returns true). The markdown path cannot do inject-then-
  strip because its pre-order contract emits the parent block (Step 5) before recursion (Step 6) — so the
  strip decision (Step 4) must be made eagerly. The R_OK gate makes Step 3.5's deliverability PREDICTION
  match `injectFile`'s actual delivery (readability) for the dominant text/markdown/binary case.

## What

### User-visible behavior

- A markdown import whose target exists but cannot be read (permission denied / I/O error) now keeps its
  `#@`/`@` marker **verbatim** in the injected markdown block, with no block/image appended — instead of
  being silently stripped to a bare path. This matches missing-file imports, directory imports, and the
  top-level path.
- All other import behaviors (missing, directory, readable text/markdown/binary, readable image with
  successful resize) are byte-for-byte unchanged.

### Technical behavior (the contract)

- `injectMarkdown` Step 3.5: a `records` entry becomes `injectable` iff `stat` succeeds AND `st.isFile()` AND
  `fs.access(abs, fs.constants.R_OK)` passes. A thrown access (ENOENT/EACCES/IO) drops the record from
  `injectable` (→ marker not stripped in Step 4, not recursed in Step 6 → verbatim).

### Success Criteria

- [ ] Step 3.5 loop calls `await fs.access(r.abs, fs.constants.R_OK)` after the `isFile()` check, inside the existing try/catch.
- [ ] Step 3.5 comment documents READABILITY gating (PRD §5.4/§12.5) + the TOCTOU/resizeImage-throw residual.
- [ ] E5 regression case present, RED before the gate, GREEN after.
- [ ] Existing 120 tests pass byte-for-byte; `npm run typecheck` clean.
- [ ] No new imports (fs.constants.R_OK is reachable via the existing `import { promises as fs }`).
- [ ] No new exports; injectMarkdown stays PRIVATE.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives
the exact current Step 3.5 code (L848-856), the exact replacement, the verified `fs.access`/`R_OK` reachability
proof, the E5 test spec (verbatim, modeled on E4 L599-615), the CRITICAL unique-fixture-name gotcha, and both
verified gates. One source file + one test file; one loop edit + one comment + one test case.

### Documentation & References

```yaml
# MUST READ — the precise fix site + behavior-change table + residual analysis
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/code_changes_analysis.md
  why: "§'Fix site 1 (PRIMARY)' gives the exact Step 3.5 old→new code, the fs.access/R_OK justification, and
        the behavior-change table. §'Fix site 2' is S2 (OUT OF SCOPE here). §'Image-resize-throw residual'
        is the documented-only residual to NOTE in the comment."
  critical: "The fix is `if (!st.isFile()) continue; await fs.access(r.abs, fs.constants.R_OK); injectable.push(r);`
             — keep stat+isFile (rejects dirs) AND add the R_OK gate, all inside the existing try/catch."

# MUST READ — the root-cause data flow (why the markdown path strips eagerly)
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/system_context.md
  why: "§'Data flow through the bug site' shows the Step 3→3.5→4→5→6 ordering and why pre-order emission
        forces an eager strip (vs. the top-level inject-then-strip). Explains why scanTokens does NOT already
        save us (it filters missing/dir, not unreadable)."

# MUST READ — the spec for verbatim-on-error
- file: PRD.md  (bugfix PRD §h3.0 Issue 1)
  why: "Issue 1 states Expected/Actual/Root-cause/Suggested-fix. The 'Suggested Fix' is the R_OK gate (verbatim).
        §5.4/§12.5/§10/§5.6-step-4 are the contract references."

# The file you edit (the only source change)
- file: file-injector.ts
  why: "1087 lines. `import { promises as fs } from \"node:fs\"` L4 (fs.access + fs.constants.R_OK reachable, NO new import).
        injectMarkdown L824-877; Step 3.5 loop L848-856 (the edit site); Step 3.5 comment L837-847 (the docs edit).
        injectFile L676-728 (claim L684, catch L726-727) — UNCHANGED here (S2 touches the catch)."
  pattern: "isRegularFile (L117-119) already uses the stat+isFile+try/catch idiom; the R_OK gate extends it."
  gotcha: "fs.constants.R_OK === 4 is reachable via the promises namespace (verified live). Do NOT add a new import."

# The gate you also edit (add E5 regression case)
- file: file-injector.test.mjs
  why: "2238 lines. E4 (L599-615) is the EXACT template for E5 (chmod 000 + root-skip + try/finally chmod 644).
        buildFixtures writes SHARED notes.md (L214) + api.md (L215) — cases 15/16/MD1(L1569)/17-20 depend on them."
  pattern: "runCase('E5', '…', async () => { root-skip; write unique fixtures; chmod 000; try { injectFiles + 4 asserts } finally { chmod 644 } })."
  gotcha: "CRITICAL: use UNIQUE fixture names (perm_api.md / perm_notes.md) — NOT api.md/notes.md — or you
           clobber the shared buildFixtures entries that later markdown cases depend on (E5 runs at ~L615, before them)."

# README — VERIFY only, no edit
- file: README.md
  why: "L52 'Missing file, directory, or permission error → Left as written. Nothing is appended.' ALREADY states
        the correct behavior. This fix brings the code INTO compliance. No edit — just confirm the row still matches."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectMarkdown Step 3.5 loop L848-856 + comment L837-847)
├── file-injector.test.mjs    # ← EDITED (+E5 regression case after E4 ~L615)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README L52 verify-only, no edit)
└── plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/
    ├── architecture/{code_changes_analysis.md, system_context.md, test_harness_analysis.md}
    └── P1M1T1S1/{research/research_notes.md, PRP.md}  # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectMarkdown Step 3.5: +await fs.access(r.abs, fs.constants.R_OK); comment updated.
file-injector.test.mjs    # MODIFIED — +runCase("E5", …) after E4 (~L615). NO guard/sanity/fixture-shared edits.
# No other files. No new files. No new exports. No new imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — fs.constants.R_OK is reachable through `import { promises as fs } from "node:fs"` (NO new import).
//   The `promises` namespace re-exports `constants`. Verified live: fs.constants.R_OK === 4, typeof fs.access === "function".

// CRITICAL (test) — use UNIQUE fixture names in E5 (perm_api.md / perm_notes.md), NOT api.md / notes.md.
//   buildFixtures writes SHARED notes.md (L214) + api.md (L215); cases 15/16/MD1(L1569)/17-20 read them. E5 runs
//   at ~L615 (before those). Overwriting api.md/notes.md mid-suite (even with chmod restored) changes their CONTENT
//   and breaks later markdown cases. Unique names avoid the collision entirely; finally restores only the chmod.

// CRITICAL — keep the gate INSIDE the existing try/catch. fs.access throws on EACCES/ENOENT/IO; the catch must
//   drop the record (→ verbatim). Do NOT let access throw escape the loop.

// GOTCHA — the R_OK gate does NOT close the image-resize-throw residual: a READABLE image (passes R_OK) whose
//   resizeImage THROWS still gets stripped. That is OUT OF SCOPE (structural fix, "more invasive"). NOTE it in
//   the Step 3.5 comment as an accepted narrow residual, backstopped by injectFile's try/catch (no crash, no block).

// GOTCHA — this subtask does NOT touch injectFile's claim/catch (Fix site 2 = S2). The "un-claim on failure"
//   (claim ⟺ delivered) is a SEPARATE subtask. After the R_OK gate, an unreadable import is never in injectable,
//   so it's never recursed/claimed — the S2 poisoning for the unreadable case is already moot; S2 matters for the
//   resizeImage-throw residual + TOCTOU + future-proofing.

// LIBRARY — fs.access(p, mode) throws (does not return a boolean) on failure; the try/catch idiom is correct.
//   R_OK === 4 (read permission). Node ≥18 (engines.node >= 22.19.0 per the pi package).
```

## Implementation Blueprint

### Data models and structure

No data-model change. The fix is a one-line gate inside an existing loop. `injectable` keeps its type
`{ index: number; prefixLen: number; abs: string }[]`; the `injectable.push(r)` forwards the whole record
unchanged (do NOT build a new object literal — that would DROP prefixLen, per codebase_delta §8.2 anti-pattern).

### Implementation Patterns & Key Details

```ts
// === injectMarkdown Step 3.5 (file-injector.ts L848-856) — BEFORE → AFTER ===

// BEFORE (the bug — checks EXISTENCE only, not readability):
//   const injectable: { index: number; prefixLen: number; abs: string }[] = [];
//   for (const r of records) {
//     try {
//       const st = await fs.stat(r.abs);
//       if (st.isFile()) injectable.push(r);
//     } catch { /* missing/unreadable → leave verbatim */ }
//   }

// AFTER (gate strip on READABILITY so strip ⟺ deliverable for text/md/binary):
  const injectable: { index: number; prefixLen: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (!st.isFile()) continue;                    // directory/socket/etc → verbatim (§5.4) — unchanged
      await fs.access(r.abs, fs.constants.R_OK);      // ← gate strip on READABILITY (PRD §5.4 / §12.5)
      injectable.push(r);
    } catch {
      /* missing / directory / unreadable → leave verbatim (not stripped, not injected) */
    }
  }
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (L848-856 Step 3.5 loop): `if (st.isFile()) injectable.push(r);`
    → `if (!st.isFile()) continue; await fs.access(r.abs, fs.constants.R_OK); injectable.push(r);`
  - update (L837-847 Step 3.5 comment): "READABILITY PRE-CHECK" (not just existence); cite PRD §5.4/§12.5;
    add ONE-LINE residual note: an import readable at Step 3.5 that fails at Step 6's readFile (TOCTOU) or whose
    image resizeImage THROWS (not returns null) will still be stripped — accepted narrow residual, backstopped by
    injectFile's try/catch (no crash, no block). Full closure is the structural strip-after-recursion fix (deferred).
  - UNCHANGED: imports (L4 already has `promises as fs`); injectFile (L676-728, incl. claim L684 + catch L726-727 = S2);
    scanTokens; resolveImportPath; Step 3/4/5/6 logic; every other function.

FILE_EDITS (file-injector.test.mjs):
  - add (after E4, ~L615): runCase("E5", …) — see Task 3. UNIQUE fixture names (perm_api.md / perm_notes.md).
  - NO edits to: sanity list, ASSERTED_EXPORTS, completeness guard, buildFixtures (shared entries), any existing case.

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md (L52 verify-only, no edit), all plan/ files.
NO new exports. NO new imports. injectMarkdown stays PRIVATE.
```

### Implementation Tasks (ordered by dependencies — TDD: RED first)

```yaml
Task 1 (RED): ADD regression case E5 to file-injector.test.mjs (after E4, ~L615)
  - MODEL on E4 (L599-615) EXACTLY: root-skip guard `if (process.getuid() === 0) { console.log("      (skipped: running as root — chmod 000 is ineffective)"); return; }`;
    write UNIQUE fixtures; chmod 000 the import target; try { injectFiles + asserts } finally { chmod 644 }.
  - FIXTURES (UNIQUE — do NOT clobber shared api.md/notes.md):
      const api = path.join(TMPDIR, "perm_api.md");
      const notes = path.join(TMPDIR, "perm_notes.md");
      fsSync.writeFileSync(api, "API secret\n");
      fsSync.writeFileSync(notes, "Notes intro.\n#@perm_api.md\nNotes end.\n");
      fsSync.chmodSync(api, 0o000);
  - CALL: const r = await mod.injectFiles("Read #@perm_notes.md", [], FIX);
  - ASSERT: (a) r.injected === 1; (b) r.text.includes("#@perm_api.md") === true (marker VERBATIM in parent block);
            (c) !r.text.includes('<file name="' + api + '">') (no block for perm_api.md);
            (d) r.text.includes('<file name="' + notes + '">') (parent block IS delivered).
  - FINALLY: fsSync.chmodSync(api, 0o644); (restore so TMPDIR cleanup works).
  - VERIFY RED: run `node ./file-injector.test.mjs` → E5 FAILS on assertion (b) (marker currently stripped).
    (If E5 PASSES before the fix, the test is wrong — re-check it exercises the markdown-import path, not top-level.)

Task 2 (GREEN): ADD the R_OK gate to injectMarkdown Step 3.5 (file-injector.ts L848-856)
  - CHANGE: `if (st.isFile()) injectable.push(r);` → `if (!st.isFile()) continue; await fs.access(r.abs, fs.constants.R_OK); injectable.push(r);`
  - KEEP inside the existing try/catch (access throws → record dropped → verbatim).
  - NO new import (fs.constants.R_OK reachable via `import { promises as fs }`).
  - UPDATE the Step 3.5 comment (L837-847): READABILITY (not just existence); PRD §5.4/§12.5; residual note (TOCTOU + resizeImage-throw).
  - DO NOT touch injectFile's claim/catch (S2), scanTokens, resolveImportPath, or any other function.

Task 3 (VERIFY): run both gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 121 passed, 0 failed (existing 120 + E5 GREEN), exit 0.
  - Confirm no shared fixture (api.md/notes.md) was clobbered (cases 15/16/MD1/17-20 still pass).

Task 4 (DOCS verify): README.md L52
  - VERIFY "Missing file, directory, or permission error → Left as written. Nothing is appended." still matches
    the now-correct code. NO edit (the fix complies with existing docs).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# fs.access + fs.constants.R_OK are standard Node APIs reachable via the existing promises import — no type issue.
```

### Level 2: The Regression Gate (existing 120 must stay green) + E5 GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: all 120 existing cases PASS + E5 PASS. Final line: "Result: 121 passed, 0 failed.", exit 0.
# If a LATER markdown case (15/16/MD1/17-20) fails, you clobbered a shared fixture — switch E5 to UNIQUE names.
# If E5 fails (still RED), the R_OK gate isn't wired (re-check Task 2: access must be AFTER isFile, inside try/catch).
```

### Level 3: TDD RED→GREEN confirmation

```bash
# Step A (RED): with E5 added but Step 3.5 UNCHANGED, E5 must FAIL on assertion (b):
#   "the unreadable import marker must be LEFT VERBATIM" → currently stripped → ✗
# Step B (GREEN): after adding the R_OK gate, E5 must PASS:
node ./file-injector.test.mjs 2>&1 | grep -E "case E5|Result:"
# Expected: "  ✓ case E5: markdown import of unreadable file → marker verbatim …" + "Result: 121 passed, 0 failed."
```

### Level 4: Targeted behavior check (the behavior-change table)

```bash
# Spot-check that the gate does NOT regress the happy path (readable import still strips + injects):
node ./file-injector.test.mjs 2>&1 | grep -E "case 15:|case 16:|case MD1:|case 20:|case E4:"
# Expected: all ✓ (readable markdown imports still strip+inject; top-level unreadable E4 still verbatim).
# fs.access(R_OK) passes for readable regular files → injectable unchanged → no behavior delta on the happy path.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 121 passed (120 existing + E5), 0 failed, exit 0.
- [ ] No new imports (`fs.constants.R_OK` reachable via existing `import { promises as fs }`).
- [ ] No new exports; injectMarkdown stays PRIVATE; no module-surface guard edit.

### Feature Validation (behavior)

- [ ] E5 RED before the gate (marker stripped), GREEN after (marker verbatim).
- [ ] Unreadable markdown import → marker verbatim in parent block, no block appended, injected counts only the parent (PRD §5.4/§12.5).
- [ ] Missing/directory imports still verbatim (scanTokens/isFile unchanged).
- [ ] Readable text/markdown/binary imports still strip + inject (R_OK passes for readable files — cases 15-20/MD1 green).
- [ ] Top-level unreadable (E4) still verbatim (top-level path untouched).

### Code Quality Validation

- [ ] The R_OK gate is INSIDE the existing try/catch (access throws → record dropped → verbatim).
- [ ] `injectable.push(r)` forwards the WHOLE record (prefixLen preserved — no new object literal).
- [ ] injectFile's claim/catch UNCHANGED (S2 is a separate subtask).
- [ ] No shared fixture clobbered (E5 uses perm_api.md/perm_notes.md).

### Documentation

- [ ] Step 3.5 comment updated: READABILITY gating (PRD §5.4/§12.5) + TOCTOU/resizeImage-throw residual note.
- [ ] README.md L52 VERIFIED to still match (no edit — fix complies with existing docs).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT add a new import.** `fs.constants.R_OK` is reachable through the existing `import { promises as fs } from "node:fs"`
  (the promises namespace re-exports `constants`). Verified live: `fs.constants.R_OK === 4`.
- ❌ **Do NOT move the access call OUTSIDE the try/catch.** `fs.access` THROWS on failure (EACCES/ENOENT/IO); it must
  be caught so the record is dropped (→ verbatim), not crash the handler.
- ❌ **Do NOT reuse the shared api.md/notes.md fixture names in E5.** buildFixtures writes them (L214-215) and cases
  15/16/MD1/17-20 read them AFTER E5 (~L615). Overwriting → content change → broken later cases. Use perm_api.md/perm_notes.md.
- ❌ **Do NOT do Fix site 2 (un-claim on failure) here.** That's S2 — a separate subtask. After the R_OK gate, an
  unreadable import is never in injectable, so it's never recursed/claimed; S2 matters for the resizeImage-throw
  residual + TOCTOU, not this subtask. Leave injectFile's claim (L684) and catch (L726-727) UNCHANGED.
- ❌ **Do NOT attempt the image-resize-throw structural fix.** A readable image whose resizeImage throws is an accepted
  residual (out of scope). Just NOTE it in the Step 3.5 comment; the full fix is "more invasive" (strip-after-recursion).
- ❌ **Do NOT build a new object literal in `injectable.push(...)`.** Forward the WHOLE record `r` so prefixLen is
  preserved (codebase_delta §8.2 anti-pattern — a new `{index, abs}` literal would DROP prefixLen and break bare-@ stripping).
- ❌ **Do NOT edit the README.** README.md:52 already states "permission error → Left as written" — this fix brings the
  code INTO compliance. Verify only, no edit.
- ❌ **Do NOT reorder stat/isFile/access.** Keep `stat` → `!isFile() continue` → `access(R_OK)` → `push`. isFile must
  still reject directories (§5.4); access adds the readability layer on top.

---

## Confidence Score: 9/10

A one-line gate (`fs.access(R_OK)`) inside an existing try/catch, plus a self-contained regression test modeled
exactly on the existing E4. The architecture docs (`code_changes_analysis.md` Fix site 1, `system_context.md`
data-flow) give the precise old→new code, the verified `R_OK` reachability, the behavior-change table, and the
documented residual. Both gates (typecheck, 120-test suite) are green today; the only RED→GREEN is E5. The -1
reserves for the unique-fixture-name gotcha (easy to miss if the implementer literally reuses api.md/notes.md —
would silently break later markdown cases) and the "don't do S2 / don't do the structural residual" scope
discipline. One source file + one test file; the implementing agent re-runs two commands.
