---
name: "P1.M2.T1.S2 (plan 009) — Migrate ~13 markdown block-marker pairs (26-27 asserts) from stripped → verbatim: resolved #@/@ markers are now PRESENT in delivered blocks (PRD §6.4); flip the hasBlock/!hasBlock polarity"
prd_ref: "PRD §6.4 (Assembly: the prompt/content is never modified — markers preserved), §13.8 (Why verbatim), §5.6 Step 4 (emit verbatim content — markers NOT stripped); architecture/test_assertions_analysis.md §3 (the exact 13-pair inventory) + §4 (verbatim-block assertions that STAY)"
target_file: "./file-injector.test.mjs"   # EDIT IN PLACE — 13 hasBlock/!hasBlock pairs flip polarity; 1 blanket flip (Case 20); 1 +2-guard comment reword (Case 26); ~13 comment rewords "stripped"→"verbatim"
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (the .ts is LANDED — engine verbatim; UNCHANGED here)
depends_on: "P1.M1.T1.S1/S2/S3 + P1.M1.T2.S1 (engine verbatim — LANDED) + P1.M2.T1.S1 (top-level prompt startsWith — ALREADY LANDED commit 8d474d9). The 13 cases currently fail ONLY on their hasBlock pair (startsWith already verbatim); this task is the SOLE remaining slice for them."
consumed_by: "P1.M2.T1.S3 (partial-strip F2/FS1/FS2/FS3 — separate), P1.M2.T2.S1 (relative/import-behavior marker expectations), P1.M2.T3 (re-open regression), P1.M2.T4.S1 (README verbatim sync)"
---

# PRP — P1.M2.T1.S2: Migrate ~13 markdown block-marker pairs to verbatim (resolved markers now PRESENT in blocks)

> **Scope flag:** Test-only migration. The verbatim engine (P1.M1, LANDED) no longer strips resolved `#@`/`@`
> import markers from delivered markdown content (PRD §6.4) — a markdown block's content is the file **exactly
> as read from disk**. ~13 `hasBlock(...)`/`!hasBlock(...)` PAIRS still expect the OLD stripped form (marker
> removed) and are RED. This task flips each pair: the **marker is now PRESENT verbatim** (positive), and the
> **stripped form is now ABSENT** (negative). **No `.ts` change, no README, no logic change.** After this task
> the 13 cases go ✓; suite failures drop 23 → 10 (the remaining 10 are partial-strip S3 + scanTokens unit tests,
> both out of scope). IMPORTANT: S1 (top-level `startsWith`) ALREADY LANDED (commit 8d474d9) — do NOT touch
> `startsWith` lines (already verbatim); this task is ONLY the block-content `hasBlock` pairs.

---

## Goal

**Feature Goal:** Bring `file-injector.test.mjs`'s ~13 markdown block-marker pairs (Cases 15, CRLF-E2E, 19,
20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g) into compliance with the verbatim engine: each pair's
positive assertion now asserts the **marker is PRESENT verbatim** in the block, and the negative asserts the
**stripped form is ABSENT**. The verbatim-block assertions (§4 of the analysis doc — code-exempt/deduped-cycle/
absolute/missing/unreadable/bareAt-off) are ALREADY correct and need NO change. Comments reworded "stripped" →
"verbatim"/"marker preserved".

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): ~13 pairs flipped (POS→verbatim
present, NEG→stripped absent); 1 blanket flip (Case 20 `!includes("#@")` → `includes("#@")`); 1 +2-bug-guard
comment reword (Case 26 L2390 — assertion KEPT, still valid); ~13 accompanying comments reworded. No `.ts`/README/plan edits.

**Success Definition:**
1. All 13 cases (15, CRLF-E2E, 19, 20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g) → ✓ (was ✗).
2. Suite failures drop **23 → 10** (remaining: F1/F1b/F1d/F2/FS1/FS2/FS3 partial-strip + T1.S1-9/10/12 scanTokens — out of scope).
3. ZERO surviving "stripped to X" / "marker must NOT retain #@" block-content assertions (grep clean).
4. The verbatim-block assertions (§4) and the `startsWith` lines (S1, landed) are UNCHANGED.
5. `git diff --stat file-injector.ts` is EMPTY (test-only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs`. The verbatim engine change (P1.M1)
is landed; the markdown block-marker assertions must follow so the gate reflects the new (correct, re-open-safe,
honest) contract: delivered content is the file as-read, markers preserved.

**Use Case:** After this task, `node ./file-injector.test.mjs` → 10 failed (down from 23); the 13 markdown-import
marker cases are green. (Full green pending S3 + scanTokens migration.)

**Pain Points Addressed:** 13 cases are RED on stale stripped-marker assertions after the P1.M1 verbatim change.
This task clears the markdown-block-marker slice.

## Why

- **The engine deliberately stopped stripping markdown content (PRD §6.4/§5.6 Step 4).** Stripping import
  markers from delivered blocks was inconsistent with verbatim prompt delivery and made the delivered content
  silently differ from the file on disk. Verbatim is honest + simpler. The tests MUST assert markers are present.
- **S1 already landed the top-level slice.** The `startsWith` lines are verbatim (commit 8d474d9). The 13 cases
  now fail ONLY on their block-content pair — this task is the precise remaining slice for them.
- **Mechanical but precision-critical.** 13 pairs, each a deterministic polarity-flip. The risk is (a) leaving a
  pair half-flipped (POS flipped but NEG not), (b) mishandling the dedup cases (EDG-3/M2.T2.S1-g where BOTH
  markers are now verbatim), or (c) touching the verbatim-block assertions (§4) that are already correct. The
  PRP gives the exact old→new for every pair (derived from each fixture's actual content).

## What

No user-visible/API/logic change. The test file's ~13 block-marker pairs flip polarity (stripped-present +
marker-absent → marker-present + stripped-absent); the cases, fixtures, helpers, and pass/fail matrix are
structurally unchanged. Comments reworded "stripped" → "verbatim"/"marker preserved (PRD §6.4)".

### Success Criteria

- [ ] All 13 pairs flipped: POS asserts the verbatim marker is PRESENT; NEG asserts the stripped form is ABSENT.
- [ ] Case 20's blanket `!r.blocks[iB].includes("#@")` → `r.blocks[iB].includes("#@")` (flipped positive; item §3c).
- [ ] Case 26's +2-bug guard (L2390 `!hasBlock(r,"Refs pi.md here.")`) KEPT (still valid); its comment reworded
      to note verbatim makes the +2-prefixLen bug moot.
- [ ] Dedup cases (EDG-3, M2.T2.S1-g): POS → the FULL verbatim line (both markers present); NEG → the
      "first-stripped" form is absent; comments note dedup affects injection, not content.
- [ ] ~13 comments reworded "stripped to X"/"marker must NOT retain #@"/"prefixLen-N strip" → "verbatim"/"marker preserved (§6.4)".
- [ ] The 13 cases (15, CRLF-E2E, 19, 20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g) → ✓.
- [ ] Suite: 23 failed → 10 failed.
- [ ] `git diff --stat file-injector.ts` EMPTY; `startsWith` lines + §4 verbatim-block assertions UNCHANGED.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the verbatim contract (§6.4 — delivered markdown content = file as-read, markers
preserved), the critical state fact (S1 ALREADY LANDED — `startsWith` already verbatim; the 13 cases fail ONLY
on hasBlock), the exact old→new table for all 13 pairs (derived from each fixture's actual content, line-verified),
the swap-pair transformation rule (+ why it's preferred over the item's literal "both positive"), the substring-safety
proof (the stripped needle is NOT a contiguous substring of verbatim content → the NEG is genuinely true), the 3
special cases (Case 20 blanket flip; Case 26 +2-guard keep+reword; dedup EDG-3/M2.T2.S1-g both-verbatim), the
out-of-scope boundaries (partial-strip=S3; scanTokens T1.S1-*=separate; §4 verbatim-block=already-correct;
startsWith=S1-landed), and the single gate (run + grep failure messages). The implementer edits ONE file at 13
small pair-sites, then runs + greps.

### Documentation & References

```yaml
# MUST READ — the exact 13-pair inventory (line numbers + the stripped-form text + the verbatim-block §4 list)
- file: plan/009_0d85ac0b1b08/architecture/test_assertions_analysis.md
  why: "§3 'Markdown block content where markers were STRIPPED' = the 13 pairs (my scope): each row has the
        stripped-form POS + the no-#@ NEG. §4 'Markdown block content where markers were LEFT VERBATIM' = the
        ~12 assertions ALREADY correct (code-exempt/deduped-cycle/absolute/missing/unreadable/bareAt-off) —
        DO NOT TOUCH. §6 documents the helpers (hasBlock reads r.blocks.some). §8 gives the counts."
  critical: "ONLY §3 flips. §4 stays. The doc's line numbers have minor drift (±a few) — match by the unique
             stripped assertion TEXT, not raw line numbers. This PRP's table has the CURRENT verified lines."

# MUST READ — the verbatim contract (why markers are now present in blocks)
- file: PRD.md
  why: "§6.4 'Assembly & shared state' — the prompt AND delivered content are never modified; markers preserved.
        §5.6 Step 4 'emit this file's block' — 'Apply the §5.5 decision to the VERBATIM content (the file exactly
        as read from disk — import markers are *not* stripped; §6.4)'. §13.8 'Why verbatim'. These are the
        rationale the flipped assertions encode."
  section: "### 6.4 + ### 5.6 (Step 4) + ### 13.8"

# The file you edit (the ONLY change)
- file: file-injector.test.mjs
  why: "The 13 pair-sites: Case 15 (L1644-1645), CRLF-E2E (L1674-1675), Case 19 (L1714-1715), Case 20 (L1752-1753),
        MD2 (L1793-1794), Case 21 (L1887-1888), Case 22 (L1905-1906), Case 23 (L1921-1922), EDG-3 (L1972-1973),
        EDG-4 (L1993-1994), Case 26 (L2387-2390), Case 27 (L2403-2404), M2.T2.S1-g (L2448-2449). Helpers hasBlock/
        blocksText/countFileBlocks (L197-205) — UNCHANGED (already read r.blocks)."
  pattern: "Each pair is two assert(...) calls. The OLD POS asserts the stripped form present; OLD NEG asserts the
            #@ form absent. FLIP: POS → verbatim marker present; NEG → stripped form absent. Match by the unique
            stripped assertion TEXT (e.g. `hasBlock(r, \"Imports api.md here.\")`), not raw line numbers."
  gotcha: "Case 15 (L1644) and Case 27 (L2403) use the SAME fixture (notes.md `Imports #@api.md here.`) and the
           SAME pair text — they're 2 sites, flip BOTH identically. grep `Imports api.md here.` finds both."

# The engine contract (LANDED — read-only; what the block content now is)
- file: file-injector.ts
  why: "injectMarkdown emits the VERBATIM content (P1.M1.T1.S2 LANDED) — no Step 3.5/Step 4 stripping. The
        delivered block content === the file as-read (markers preserved). Do NOT edit file-injector.ts."
  gotcha: "`git diff --stat file-injector.ts` MUST be empty. The tests change to MATCH the .ts."

# The landed sibling (READ-ONLY — already done; do NOT re-touch)
- file: plan/009_0d85ac0b1b08/P1M2T1S1/PRP.md   # (S1 — LANDED commit 8d474d9)
  why: "S1 migrated the ~20 top-level prompt assertions (4 exact + 14 startsWith) to verbatim. Its PRP's
        'consumed_by' explicitly defers the ~13 block-marker pairs to THIS task (S2). The startsWith lines are
        ALREADY verbatim in the working tree — DO NOT touch them. Confirm: `git log --oneline | head -1` shows
        '8d474d9 Migrate top-level prompt assertions to verbatim'."
  critical: "S1 LANDED means the 13 cases fail ONLY on their hasBlock pair (not startsWith). After S2 ALL 13 go
             ✓ (not '9 green + 4 pending' as a pre-S1 world would be). Validate: failures drop 23 → 10."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD 8d474d9 (engine verbatim + S1 top-level migration LANDED; working tree CLEAN)
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (13 hasBlock pairs currently RED; startsWith already verbatim)
├── file-injector.ts             # UNCHANGED (engine verbatim — the contract the tests migrate TO)
├── relative-imports.test.mjs    # NOT edited (P1.M2.T2.S1)
├── import-behavior.test.mjs     # NOT edited (P1.M2.T2.S1)
├── scripts/typecheck.mjs        # untouched
├── package.json / PRD.md / README.md   # untouched (README is P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1.S1..P1M2T1S1/{PRP.md, research/}   # engine verbatim (LANDED) + S1 top-level (LANDED 8d474d9)
    └── P1M2T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — 13 hasBlock/!hasBlock pairs flip polarity (POS→verbatim present,
                          #                  NEG→stripped absent); Case 20 blanket flip; Case 26 +2-guard
                          #                  comment reword (assertion kept); ~13 comments "stripped"→"verbatim".
# file-injector.ts is NEVER edited. startsWith lines + §4 verbatim-block assertions UNCHANGED. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — S1 (top-level startsWith) ALREADY LANDED (commit 8d474d9). The 13 cases fail ONLY on their hasBlock
//   pair. DO NOT touch any r.text.startsWith(...) line — it's already verbatim and passing. This task is ONLY the
//   block-content hasBlock pairs. (Confirm: `git log --oneline | head -1` → '8d474d9 Migrate top-level prompt…'.)

// CRITICAL — use the SWAP-PAIR flip, NOT the item's literal "make both positive on the verbatim marker". The item's
//   literal wording (POS→verbatim, NEG→flip-to-positive-verbatim) yields a REDUNDANT DUPLICATE (two identical
//   hasBlock(r,"…#@api.md…") asserts). The swap-pair is strictly better: POS asserts the verbatim marker PRESENT;
//   NEG asserts the stripped form ABSENT (proves it wasn't stripped). BOTH needles already exist in the test — just
//   swap which is positive vs negative. Both approaches PASS; swap-pair gives non-redundant coverage.

// CRITICAL — substring-safety (why the swap-pair NEG is genuinely TRUE). The stripped needle (e.g. "Imports api.md
//   here.") is NOT a contiguous substring of the verbatim content ("Imports #@api.md here.") — the "#@" between
//   "Imports " and "api.md" breaks contiguity. Verified for ALL 13. So !hasBlock(r, STRIPPED) is TRUE under verbatim.
//   (Do NOT worry that "api.md" appears in both — the FULL stripped phrase with its leading word is what's absent.)

// CRITICAL — Case 15 (L1644) and Case 27 (L2403) are the SAME pair (both on notes.md `Imports #@api.md here.`).
//   grep `Imports api.md here.` finds BOTH — flip both identically. Don't flip one and miss the other.

// CRITICAL — dedup cases (EDG-3 L1972-1973, M2.T2.S1-g L2448-2449): under verbatim BOTH markers are present (the
//   dedup affects INJECTION — countFileBlocks===1 stays valid — NOT content). POS → the FULL verbatim line
//   (e.g. "Imports: #@specdoc and #@specdoc.md"); NEG → the "first-stripped" form ("Imports: specdoc and") is absent.
//   Reword comments: "first stripped, second verbatim" → "both verbatim (dedup affects injection, not content)".

// CRITICAL — Case 20's blanket (L1753 `!r.blocks[iB].includes("#@")`) is NOT a per-marker swap — it's a blanket
//   "no #@ at all". Under verbatim bigdoc.md has 4 #@ markers → the blanket is FALSE. The item says "remove or flip
//   to includes('#@')". FLIP to `r.blocks[iB].includes("#@")` (positive: block now contains verbatim markers).
//   L1752 POS → `includes("Logs: #@huge.log")` (the verbatim marker). (Alt: swap-pair NEG `!includes("Logs: huge.log")`.)

// CRITICAL — Case 26's +2-bug guard (L2390 `!hasBlock(r,"Refs pi.md here.")`) STAYS (still TRUE: content is
//   `Refs @api.md here.` → `Refs pi.md here.` absent). REWORD its comment: under verbatim NO stripping occurs, so
//   the +2-prefixLen bug is moot; `pi.md` never appears. (Keeping it preserves test count; it's a now-redundant-
//   but-valid guard. Do NOT delete it.)

// GOTCHA — the §4 verbatim-block assertions (E5/Case16/17/18/MD1/EDG-1/EDG-2/ISS1-MD/Case25/Case27-fenced/
//   M2.T2.S1-e/f) are ALREADY correct (they always asserted markers present). DO NOT touch them — only §3 flips.

// GOTCHA — place by ASSERTION TEXT (the unique stripped string), not raw line numbers. Lines drift. The stripped
//   phrase (e.g. `hasBlock(r, "See api.md.")`) is unique per site → safe match target.

// GOTCHA — the partial-strip cases (F2/FS1/FS2/FS3) and scanTokens unit tests (T1.S1-9/10/12) REMAIN RED after
//   this task — they are S3's / a separate concern. Do NOT chase them. Suite goes 23→10 failed, NOT to 0.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti + alias map. runCase(n,name,fn)/assert(cond,msg). The gate is
//   `node ./file-injector.test.mjs`. No typecheck impact (test-only). Helpers hasBlock/blocksText read r.blocks.
```

## Implementation Blueprint

### The transformation rule (applied per-pair)

For EACH of the 13 pairs:
1. **Identify the two needles** — the POS needle (stripped form, e.g. `"Imports api.md here."`) and the NEG needle
   (verbatim marker, e.g. `"Imports #@api.md here."`). Both already exist in the test.
2. **SWAP their polarity** — POS becomes `hasBlock(r, VERBATIM_MARKER)` (marker present); NEG becomes
   `!hasBlock(r, STRIPPED)` (stripped form absent).
3. **Reword the comments/messages** — "stripped to X" / "marker must NOT retain #@"/"prefixLen-N strip" →
   "marker preserved verbatim (PRD §6.4)" / "stripped form absent".

### The 13 old→new table (CURRENT verified lines + fixture-derived)

**STANDARD SWAP-PAIR (10 pairs) — POS→verbatim, NEG→stripped-absent:**
```js
// Case 15 (L1644-1645):  hasBlock(r,"Imports api.md here.") / !hasBlock(r,"Imports #@api.md here.")
//                     → hasBlock(r,"Imports #@api.md here.") / !hasBlock(r,"Imports api.md here.")
// CRLF-E2E (L1674-1675): hasBlock(r,"See crlf_after.md") / !hasBlock(r,"See #@crlf_after.md")
//                      → hasBlock(r,"See #@crlf_after.md") / !hasBlock(r,"See crlf_after.md")
// Case 19 (L1714-1715):  hasBlock(r,"See api.md.") / !hasBlock(r,"See #@api.md.")
//                      → hasBlock(r,"See #@api.md.") / !hasBlock(r,"See api.md.")
// MD2 (L1793-1794):      hasBlock(r,"See ../shared/api.md here.") / !hasBlock(r,"#@../shared/api.md")
//                      → hasBlock(r,"#@../shared/api.md") / !hasBlock(r,"See ../shared/api.md here.")
// Case 21 (L1887-1888):  hasBlock(r,"Imports api here.") / !hasBlock(r,"Imports #@api here.")
//                      → hasBlock(r,"Imports #@api here.") / !hasBlock(r,"Imports api here.")
// Case 22 (L1905-1906):  hasBlock(r,"Refs guide here.") / !hasBlock(r,"Refs #@guide here.")
//                      → hasBlock(r,"Refs #@guide here.") / !hasBlock(r,"Refs guide here.")
// Case 23 (L1921-1922):  hasBlock(r,"See api here.") / !hasBlock(r,"See #@api here.")
//                      → hasBlock(r,"See #@api here.") / !hasBlock(r,"See api here.")
// EDG-4 (L1993-1994):    hasBlock(r,"See sub/notes here.") / !hasBlock(r,"See #@sub/notes here.")
//                      → hasBlock(r,"See #@sub/notes here.") / !hasBlock(r,"See sub/notes here.")
// Case 27 (L2403-2404):  hasBlock(r,"Imports api.md here.") / !hasBlock(r,"Imports #@api.md here.")
//                      → hasBlock(r,"Imports #@api.md here.") / !hasBlock(r,"Imports api.md here.")   // SAME as Case 15
// Case 26 POS/NEG (L2387-2388): hasBlock(r,"Refs api.md here.") / !hasBlock(r,"Refs @api.md here.")
//                              → hasBlock(r,"Refs @api.md here.") / !hasBlock(r,"Refs api.md here.")   // bare-@, prefixLen-1
```

**DEDUP PAIRS (2) — BOTH markers now verbatim; POS → full verbatim line:**
```js
// EDG-3 (L1972-1973):    hasBlock(r,"Imports: specdoc and #@specdoc.md") / !hasBlock(r,"Imports: #@specdoc and")
//                      → hasBlock(r,"Imports: #@specdoc and #@specdoc.md") / !hasBlock(r,"Imports: specdoc and")
//   (fixture notesDedup.md = "Imports: #@specdoc and #@specdoc.md" — BOTH verbatim now; dedup affects injection only)
// M2.T2.S1-g (L2448-2449): hasBlock(r,"Refs api.md and @api.md.") / !hasBlock(r,"Refs #@api.md")
//                        → hasBlock(r,"Refs #@api.md and @api.md.") / !hasBlock(r,"Refs api.md and @api.md.")
//   (fixture notesMixDedup.md = "Refs #@api.md and @api.md." — BOTH verbatim now)
```

**SPECIAL — Case 20 blanket flip (L1752-1753):**
```js
// L1752: r.blocks[iB].includes("Logs: huge.log")  → r.blocks[iB].includes("Logs: #@huge.log")   // verbatim marker
// L1753: !r.blocks[iB].includes("#@")              → r.blocks[iB].includes("#@")                  // FLIP blanket→positive
//   (bigdoc.md has 4 #@ markers — under verbatim the block CONTAINS them; the old "no #@ at all" blanket is FALSE)
//   msg: "bigdoc.md block must contain NO '#@' markers" → "bigdoc.md block now CONTAINS verbatim #@ markers (§6.4)"
```

**SPECIAL — Case 26 +2-bug guard (L2390) — KEPT, comment reworded:**
```js
// L2390: assert(!hasBlock(r, "Refs pi.md here."), "SMOKING-GUN: '+2' bug would strip '@a' → 'pi.md'; …")
//   KEEP the assertion (still TRUE — content is "Refs @api.md here." → "Refs pi.md here." absent).
//   REWORD the msg: "redundant under verbatim (no stripping → +2-prefixLen bug cannot occur); 'pi.md' never appears (§6.4)"
```

### Implementation Tasks (ordered)

```yaml
Task 1: FLIP the 10 standard swap-pairs (Case 15, CRLF-E2E, 19, MD2, 21, 22, 23, EDG-4, 27, Case 26 POS/NEG)
  - For each: swap the POS/NEG needles (POS→verbatim marker present; NEG→stripped form absent); reword the comment/msg.
  - NOTE: Case 15 (L1644-1645) and Case 27 (L2403-2404) are the SAME pair text — flip BOTH (grep `Imports api.md here.`).
  - RUN after the batch: `node ./file-injector.test.mjs 2>&1 | grep "case 15\|CRLF\|case 19\|MD2\|case 21\|case 22\|case 23\|EDG-4\|case 27\|case 26"` → those cases' failure messages must NO LONGER cite the "stripped to X" hasBlock line.

Task 2: FLIP the 2 dedup pairs (EDG-3 L1972-1973, M2.T2.S1-g L2448-2449)
  - POS → the FULL verbatim line (both markers present); NEG → the "first-stripped" form absent.
  - REWORD comments: "first stripped, second verbatim (deduped)" → "both verbatim (dedup affects injection, not content; §6.4)".
  - KEEP the countFileBlocks===1 assertion (dedup still holds for injection).

Task 3: FLIP Case 20's blanket (L1752-1753)
  - L1752 POS → includes("Logs: #@huge.log"); L1753 → includes("#@") (flipped positive); reword msg.
  - KEEP the paged-delivery asserts (hugeTags===2, <paged:, "with the read tool"), injected/paged counts, notify — UNAFFECTED.

Task 4: REWORD Case 26's +2-bug guard (L2390) — KEEP assertion, reword comment
  - The assertion `!hasBlock(r, "Refs pi.md here.")` STAYS (still true under verbatim). Reword the msg to note verbatim
    makes the +2-prefixLen bug moot. Do NOT delete the line.

Task 5: VERIFY gates
  - node ./file-injector.test.mjs → 13 cases ✓ (15, CRLF-E2E, 19, 20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g).
  - Result line: "10 failed" (down from 23). The 10 remaining: F1/F1b/F1d/F2/FS1/FS2/FS3 (partial-strip, S3) +
    T1.S1-9/T1.S1-10/T1.S1-12 (scanTokens return-shape, separate) — OUT of scope.
  - GREP: no surviving "stripped to" / "must NOT retain #@" block-content msg in the 13 cases.
  - git diff --stat file-injector.ts → EMPTY.
```

### Implementation Patterns & Key Details

```js
// ── The swap-pair flip (the standard transformation) ──
// OLD (stripped engine): the resolved marker was REMOVED from the delivered block content.
//   assert(hasBlock(r, "Imports api.md here."), "…stripped to api.md");          // POS: stripped form present
//   assert(!hasBlock(r, "Imports #@api.md here."), "…must NOT retain #@");       // NEG: marker absent
// NEW (verbatim engine): the marker is PRESERVED; the delivered content == the file as-read.
//   assert(hasBlock(r, "Imports #@api.md here."), "…marker preserved verbatim (§6.4)");  // POS: marker present
//   assert(!hasBlock(r, "Imports api.md here."), "…stripped form absent (not stripped)"); // NEG: stripped absent

// ── Dedup pair (EDG-3): both markers now verbatim ──
// OLD: hasBlock(r,"Imports: specdoc and #@specdoc.md")  // first stripped→specdoc, second verbatim
// NEW: hasBlock(r,"Imports: #@specdoc and #@specdoc.md") // BOTH verbatim (dedup affects injection, not content)
//      !hasBlock(r,"Imports: specdoc and")               // the "first-stripped" form is now absent

// ── Case 20 blanket flip ──
// OLD: r.blocks[iB].includes("Logs: huge.log") / !r.blocks[iB].includes("#@")  // "no #@ at all"
// NEW: r.blocks[iB].includes("Logs: #@huge.log") / r.blocks[iB].includes("#@") // marker present + block has #@
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - 10 standard swap-pairs (L1644-1645/1674-1675/1714-1715/1793-1794/1887-1888/1905-1906/1921-1922/1993-1994/
    2403-2404/2387-2388): POS→verbatim marker; NEG→stripped form absent; comment reworded.
  - 2 dedup pairs (L1972-1973 EDG-3, L2448-2449 M2.T2.S1-g): POS→full verbatim line; NEG→first-stripped form absent.
  - Case 20 blanket (L1752-1753): POS→includes("Logs: #@huge.log"); L1753→includes("#@") (flipped positive).
  - Case 26 +2-guard (L2390): assertion KEPT; comment reworded (verbatim → +2 bug moot).
  - ~13 accompanying comments/messages "stripped"→"verbatim"/"marker preserved (§6.4)".
  - UNCHANGED: all helpers (hasBlock/blocksText/countFileBlocks); the r.text.startsWith lines (S1 LANDED);
    the §4 verbatim-block assertions (E5/Case16/17/18/MD1/EDG-1/EDG-2/ISS1-MD/Case25/Case27-fenced/M2.T2.S1-e/f);
    the partial-strip cases (F2/FS1/FS2/FS3 = S3); scanTokens unit tests (T1.S1-9/10/12); countFileBlocks/injected/
    paged/ordering asserts in each case (resolution+dedup+paging unchanged); every other case.
NO_CHANGES: file-injector.ts (git diff empty), relative-imports.test.mjs (P1.M2.T2.S1), import-behavior.test.mjs
            (P1.M2.T2.S1), scripts/typecheck.mjs, package.json, PRD.md, README.md (P1.M2.T4.S1), all plan/ files.
NO_LOGIC_CHANGE: detection/resolution/dedup/paging/code-exempt logic UNCHANGED. Only the marker-PRESENCE
                 expectation in the delivered block content changes (stripped→verbatim).
```

## Validation Loop

### Level 1: The 13 cases go GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "✓ case (15|CRLF-E2E|19|20|MD2|21|22|23|EDG-3|EDG-4|26|27|M2.T2.S1-g)\b"
# Expected: 13 ✓ lines. Before this task: 13 ✗ (each citing a "stripped to X" hasBlock message).
```

### Level 2: Suite failures drop 23 → 10

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "Result:"
# Expected: "Result: 137 passed, 10 failed." (was 127 passed, 23 failed; +13 cases pass, −13 failures).
# The 10 remaining failures: F1, F1b, F1d, F2, FS1, FS2, FS3 (partial-strip = S3) + T1.S1-9, T1.S1-10,
# T1.S1-12 (scanTokens return-shape = separate). These are OUT of scope — do NOT chase them.
```

### Level 3: No surviving stripped-marker block assertion

```bash
cd /home/dustin/projects/pi-file-injector
# Grep ALL failure details for surviving "stripped to" block-content messages (none should remain for the 13):
node ./file-injector.test.mjs 2>&1 | grep -iE "stripped to|must NOT retain #@|marker stripped"
# Expected: NO matches from the 13 cases. (The partial-strip F2/FS1/FS2/FS3 cases will still reference "stripped"
#  in their MIXED-prompt assertions — those are S3's scope. Confirm any survivors are F*/FS*, not the 13.)
# Also grep the FILE for surviving stripped-block assertions:
grep -nE 'hasBlock\(r, "Imports api\.md here|hasBlock\(r, "See [a-z]|hasBlock\(r, "Refs [a-z]|includes\("Logs: huge\.log' file-injector.test.mjs
# Expected: 0 matches (all migrated to the verbatim form). The verbatim-block §4 assertions (hasBlock(r,"#@example.ts")
#  etc.) SHOULD still appear — those are the ALREADY-correct ones, not the migrated §3 pairs.
```

### Level 4: Scope integrity (no .ts change; startsWith + §4 untouched)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts            # expect EMPTY (test-only; .ts is the landed verbatim contract)
git log --oneline | head -1                 # expect '8d474d9 Migrate top-level prompt assertions to verbatim' (S1 LANDED)
git diff --stat                             # expect ONLY file-injector.test.mjs
# Confirm startsWith lines are UNCHANGED (already verbatim from S1):
grep -c 'r\.text\.startsWith("Review #@' file-injector.test.mjs   # expect the S1 verbatim forms (non-zero)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → the 13 cases (15, CRLF-E2E, 19, 20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g) ✓.
- [ ] Result: "10 failed" (down from 23). Remaining 10 = partial-strip (S3) + scanTokens (separate).
- [ ] No surviving "stripped to"/"must NOT retain #@" block-content assertion in the 13 cases (Level 3 grep clean).
- [ ] `git diff --stat file-injector.ts` EMPTY; startsWith lines + §4 verbatim-block assertions UNCHANGED.

### Feature Validation (the migration correctness)

- [ ] 10 standard swap-pairs: POS asserts the verbatim marker PRESENT; NEG asserts the stripped form ABSENT.
- [ ] 2 dedup pairs: POS → full verbatim line (both markers present); NEG → first-stripped form absent.
- [ ] Case 20: L1752 → `includes("Logs: #@huge.log")`; L1753 blanket → `includes("#@")` (flipped positive).
- [ ] Case 26 +2-guard (L2390) KEPT (assertion still true); comment reworded (verbatim → +2 bug moot).
- [ ] Comments/messages reworded "stripped" → "verbatim"/"marker preserved (PRD §6.4)".

### Code Quality Validation

- [ ] Each verbatim needle was derived from the fixture's ACTUAL content (not a blind find-replace).
- [ ] The swap-pair used (non-redundant POS+NEG), not the item's literal "both positive on the verbatim marker" duplicate.
- [ ] Placement by ASSERTION TEXT (unique stripped phrase), not raw line numbers (lines drift).
- [ ] Case 15 (L1644) and Case 27 (L2403) BOTH flipped (same pair text — grep finds both).
- [ ] No edits to startsWith (S1 LANDED), §4 verbatim-block assertions, partial-strip cases (S3), scanTokens tests, helpers, or the .ts.

### Documentation

- [ ] None (test-only; no user-facing surface — item §5).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch the `r.text.startsWith(...)` lines.** S1 ALREADY LANDED them verbatim (commit 8d474d9). This task
  is ONLY the block-content `hasBlock` pairs. Touching startsWith = scope creep + re-editing landed work.
- ❌ **Do NOT use the item's literal "make both positive on the verbatim marker".** That yields a REDUNDANT DUPLICATE
  (two identical `hasBlock(r,"…#@api.md…")`). Use the SWAP-PAIR: POS→verbatim present, NEG→stripped absent
  (non-redundant, both needles already exist).
- ❌ **Do NOT flip only half a pair.** Each pair has a POS and a NEG — flip BOTH (POS→verbatim, NEG→stripped-absent).
  Leaving the NEG as `!hasBlock(r, VERBATIM)` makes it FALSE under verbatim → the case stays ✗.
- ❌ **Do NOT touch the §4 verbatim-block assertions** (E5/Case16/17/18/MD1/EDG-1/EDG-2/ISS1-MD/Case25/Case27-fenced/
  M2.T2.S1-e/f). They were ALWAYS correct (markers present). Only the §3 STRIPPED pairs flip.
- ❌ **Do NOT delete Case 26's +2-bug guard (L2390).** It's still TRUE under verbatim (`Refs pi.md here.` absent).
  KEEP it; reword the comment. Deleting it loses a (now-redundant-but-valid) guard + changes test count.
- ❌ **Do NOT chase the partial-strip cases (F2/FS1/FS2/FS3) or scanTokens tests (T1.S1-9/10/12).** They stay ✗ after
  this task — they're S3's / a separate concern. The suite goes 23→10 failed, NOT to 0.
- ❌ **Do NOT edit file-injector.ts.** The engine verbatim change is LANDED. Tests migrate TO it. `git diff --stat file-injector.ts` MUST be empty.
- ❌ **Do NOT trust raw line numbers.** Lines drift. Match by the unique stripped assertion TEXT.
- ❌ **Do NOT forget Case 27 (L2403-2404).** It uses the SAME pair text as Case 15 — grep `Imports api.md here.`
  finds both; flip both.
- ❌ **Do NOT change the dedup count assertions** (`countFileBlocks(...) === 1`). Dedup still holds for INJECTION
  (one block per resolved abs); only the CONTENT markers flip (both verbatim now).
- ❌ **Do NOT mishandle Case 20's blanket.** L1753 `!includes("#@")` is a BLANKET (not a per-marker swap). Under
  verbatim the block HAS `#@` → flip to `includes("#@")` (positive), per the item's explicit "remove or flip".

---

## Confidence Score: 9/10

A mechanical, well-traced migration: 13 hasBlock/!hasBlock pairs with the EXACT old→new table derived from each
fixture's actual content (line-verified against the current file), the swap-pair transformation rule (non-redundant,
substring-safety proven for all 13), the 3 special cases handled precisely (Case 20 blanket flip; Case 26 +2-guard
keep+reword; dedup EDG-3/M2.T2.S1-g both-verbatim), and the critical state fact that S1 ALREADY LANDED (so the 13
cases fail ONLY on hasBlock → all 13 go ✓ after S2; failures drop 23→10). The -1 reserves for: (a) line-number drift
(mitigated by text-based placement + the unique stripped phrases), and (b) the implementer needing to flip BOTH halves
of each pair and BOTH Case 15/27 sites (the table + grep commands make this explicit). The single gate (run + grep the
failure messages) is unambiguous. The implementing agent edits ONE file at 13 small pair-sites, then runs + greps.