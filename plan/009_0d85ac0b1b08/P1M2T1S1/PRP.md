---
name: "P1.M2.T1.S1 (plan 009) — Migrate ~20 top-level prompt assertions from stripped → verbatim (r.text/out.text now preserve #@)"
prd_ref: "PRD §6.4 (Assembly: the prompt is never modified — #@ preserved), §13.8 (Why verbatim — stripping breaks re-submission), §10 (terminology note: user message is always the prompt verbatim); architecture/test_assertions_analysis.md §1a/§1b/§1c (the exact assertion inventory)"
target_file: "./file-injector.test.mjs"   # EDIT IN PLACE — 4 exact-equality + 14 startsWith → verbatim; 2 negative UNCHANGED; comment wording updates
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (the .ts is LANDED at HEAD d3219d2 — UNCHANGED here)
depends_on: "P1.M1.T1.S1/S2/S3 + P1.M1.T2.S1 (ALL LANDED at HEAD d3219d2: engine returns the prompt VERBATIM — #@ preserved; strippedText/resolvedIdx deleted). The suite is currently RED on the ~20 stripped assertions; this task migrates them."
consumed_by: "P1.M2.T1.S2 (markdown block-marker assertions — the ~13 hasBlock/!hasBlock pairs that stay RED after this task), P1.M2.T1.S3 (partial-strip F2/FS1/FS2/FS3), P1.M2.T3 (re-open regression), P1.M2.T4.S1 (README verbatim sync)"
---

# PRP — P1.M2.T1.S1: Migrate ~20 top-level prompt assertions to verbatim (r.text/out.text preserve #@)

> **Scope flag:** Test-only migration. The engine (P1.M1, LANDED) now returns the prompt **verbatim** (`#@`
> preserved, PRD §6.4/§13.8) — `r.text`/`out.text` is the input prompt byte-for-byte. ~20 assertions still expect
> the OLD stripped form and are RED. This task migrates them: **4 exact-equality** (`=== "Review a.ts"` →
> `=== "Review #@a.ts"`) + **14 `startsWith`** (re-insert `#` before the `@<token>`, matching each test's input).
> **2 negative** assertions (`!includes("---")`/`!includes("<file")`) are UNCHANGED (still valid under verbatim).
> **No `.ts` change, no README, no logic change.** IMPORTANT: this is NOT "make the suite green" — 9 of the 14
> startsWith cases ALSO have markdown block-marker assertions (P1.M2.T1.S2's scope) and stay RED on those; this
> task makes the ~20 *top-level* assertions pass (9 cases go fully green; 9 have their startsWith fixed but
> remain red on the block part until S2).

---

## Goal

**Feature Goal:** Bring `file-injector.test.mjs`'s ~18 top-level prompt assertions (4 exact-equality + 14
`startsWith` on `r.text`/`out.text`) into compliance with the verbatim engine: each expected value is reconstructed
to the VERBATIM form (the input prompt with `#@` preserved), per PRD §6.4/§13.8. The 2 negative shape assertions
stay (verbatim prompt still has no `---` and no `<file>`). Assert-message/inline comments updated from "stripped"
to "verbatim"/"#@ preserved".

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): 4 exact-equality assertions + 14
`startsWith` assertions migrated to verbatim; ~18 accompanying comments/messages reworded. No `.ts`/README/plan edits.

**Success Definition:**
1. The 4 exact-equality sites assert the verbatim prompt (`r.text === "Review #@a.ts"` / `out.text === "Review #@a.ts"`).
2. The 14 `startsWith` sites assert the verbatim prefix (re-inserted `#` before `@<token>`, verified against each test's input).
3. The 2 negative assertions (`!r.text.includes("---")`, `!r.text.includes("<file")` at DELIV-1) are UNCHANGED and still pass.
4. **9 cases go fully GREEN** (Case 1, 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2). The other 9 startsWith
   cases (15, CRLF-E2E, 19, MD2, 21, 22, 23, EDG-3, EDG-4) have their `startsWith` FIXED — they no longer fail on
   the top-level line; they remain RED ONLY on their markdown block-marker assertions (P1.M2.T1.S2's scope).
5. `git diff --stat file-injector.ts` is EMPTY (test-only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs`. The verbatim engine change (P1.M1) is
landed; the test suite must follow so the gate reflects the new (correct, re-open-safe) contract.

**Use Case:** After this task (and S2/S3), `node ./file-injector.test.mjs` → green. This task delivers the
top-level-prompt slice of that migration.

**Pain Points Addressed:** The suite is RED on ~20 stale stripped-prompt assertions after the P1.M1 engine change.
This task clears the top-level-prompt failures (the S2/S3 slices clear the rest).

## Why

- **The engine deliberately stopped stripping (PRD §13.8).** Stripping `#@` broke every re-submission path
  (cancel/ESC, fork, `/tree` navigate, queued-message dequeue): Pi re-feeds the STORED user-message text, so a
  stripped prompt has no `#@` → injection silently vanishes on re-open. Verbatim is strictly better (honest,
  simpler, re-open-safe). The tests MUST assert verbatim.
- **Mechanical but precision-critical.** 18 assertions, each a deterministic old→new transformation. The risk is
  (a) blindly find-replacing "Review a.ts" (WRONG — the 14 startsWith use DIFFERENT prefixes per the analysis doc)
  or (b) mis-reconstructing a verbatim prefix that doesn't match the test's actual input. The PRP gives the exact
  old→new for every site, derived from each test's input prompt (verified).
- **Decomposed from the larger migration for safety.** The full test migration spans top-level (this task),
  markdown block markers (S2), and partial-strip (S3). Isolating the top-level slice localizes the change and
  makes the validation precise (9 cases green; 9 fixed-but-pending-S2).

## What

No user-visible/API/logic change. The test file's ~18 top-level prompt assertions change their EXPECTED VALUE
(stripped → verbatim); the cases, fixtures, helpers, and the pass/fail matrix are structurally unchanged. Comments
reworded from "stripped" to "verbatim"/"#@ preserved".

### Success Criteria

- [ ] 4 exact-equality: `r.text`/`out.text === "Review #@a.ts"` (was `"Review a.ts"`).
- [ ] 14 `startsWith`: verbatim prefix with `#` re-inserted before `@<token>` (per the table; each verified against its input).
- [ ] 2 negative (`!includes("---")`, `!includes("<file")`) UNCHANGED.
- [ ] Comments/messages at the 18 sites reworded "stripped"/"marker removed" → "verbatim"/"#@ preserved (PRD §6.4).
- [ ] 9 cases fully GREEN (1, 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2).
- [ ] The 9 startsWith cases with block-marker assertions (15, CRLF-E2E, 19, MD2, 21, 22, 23, EDG-3, EDG-4) no
      longer fail on the `r.text.startsWith(…)` line (they fail only on the `hasBlock`/`!hasBlock` pair = S2).
- [ ] `git diff --stat file-injector.ts` EMPTY.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the verbatim contract (§6.4/§13.8 — `r.text` === input prompt byte-for-byte), the
CRITICAL correction that the 14 startsWith use DIFFERENT prefixes (not all "Review a.ts"), the exact old→new table
for all 18 sites (derived + input-verified), the comment-rewording rule, the validation nuance (9 green / 9
fixed-but-pending-S2), the out-of-scope boundaries (partial-strip=S3, block-markers=S2, .ts=LANDED), and the
single gate. The implementer edits ONE file at 18 sites, then runs the suite + greps the failures.

### Documentation & References

```yaml
# MUST READ — the exact assertion inventory (line numbers + the stripped-form text + which cases have block assertions)
- file: plan/009_0d85ac0b1b08/architecture/test_assertions_analysis.md
  why: "§1a lists the 4 exact-equality stripped assertions (L428/L551/L2477/L2500); §1b lists the 14 startsWith
        stripped assertions WITH THEIR ACTUAL PREFIXES (NOT all 'Review a.ts' — they're 'Summarize huge.log',
        'Read sub/notes.md', 'Review notesMissing.md', etc.); §1c lists the negative pair (L2478-2479, UNCHANGED);
        §3 lists the markdown block-marker pairs (S2's scope — these are why 9 cases stay RED after this task);
        §4 lists the verbatim-block assertions (MD1/EDG-1/EDG-2's block assertions STAY VALID → those 3 go GREEN)."
  critical: "The item's claim that all 14 startsWith are 'Review a.ts' is WRONG. Use the doc's §1b table (the actual
             prefixes) + this PRP's old→new table. The derivation rule: re-insert '#' before the '@<token>' to match
             the test's INPUT prompt (the engine returns it unchanged). VERIFY each against its input."

# MUST READ — the verbatim contract (why r.text is now the input unchanged)
- file: PRD.md
  why: "§6.4 'Assembly & shared state' — 'The prompt is never modified… the #@<path> triggers stay exactly where
        the user typed them.' §13.8 'Why the prompt is preserved verbatim' — stripping breaks re-submission
        (cancel/fork//tree/dequeue re-feed stored text). §10 terminology note — 'the user message is always the
        user's prompt verbatim (#@ preserved; §6.4)'. These are the rationale the migrated assertions encode."
  section: "### 6.4 + ### 13.8 + ## 10 (terminology note)"

# The file you edit (the ONLY change)
- file: file-injector.test.mjs
  why: "~2812 lines. The 18 sites: Case 1 (~L427), Case 12 (~L551), U1(c) (~L996), PD1 (~L1092), Case 15 (~L1638),
        CRLF-E2E (~L1670), Case 19 (~L1705), MD2 (~L1785), Case 21 (~L1882), Case 22 (~L1897), Case 23 (~L1915),
        MD1 (~L1771), EDG-1 (~L1941), EDG-2 (~L1954), EDG-3 (~L1968), EDG-4 (~L1986), DELIV-1 (~L2477-2479),
        DELIV-2 (~L2500). Helpers: runCase/assert/FIX/hasBlock (unchanged)."
  pattern: "Each site is a single assert(...) call. The OLD expected is the stripped form; the NEW is the verbatim
            form (input prompt with #@). Reconstruct by reading the test's input (the literal passed to
            mod.injectFiles / captureHandler) — the verbatim expected IS that input (exact) or its verbatim prefix (startsWith)."
  gotcha: "Place by the ASSERTION TEXT (the unique stripped string, e.g. `r.text.startsWith(\"Read sub/notes.md\")`),
           not raw line numbers — lines may have drifted ±a few. The stripped string is unique per site."

# The engine contract (LANDED — read-only; what r.text now is)
- file: file-injector.ts
  why: "injectFiles L1179 (nothing-injected → returns original `text`), L1188 (returns `text` verbatim); input
        handler L1265 (`text: event.text` — §6.4 VERBATIM). The old strippedText/resolvedIdx is DELETED. Do NOT
        edit file-injector.ts — it's the landed contract the tests migrate TO."
  gotcha: "`git diff --stat file-injector.ts` MUST be empty. The tests change to MATCH the .ts; the .ts is not touched."

# The parallel sibling (READ-ONLY — no conflict)
- file: plan/009_0d85ac0b1b08/P1M1T2S2/PRP.md
  why: "P1.M1.T2.S2 is a READ-ONLY verification ('NO source edits. NO test edits.' — its PRP frontmatter). It
        produces a verdict + typecheck proof for before_agent_start/computeDetailOffsets/renderInjectedMessage.
        It does NOT touch file-injector.test.mjs → zero overlap with this task."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD d3219d2 (engine verbatim change LANDED)
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (~2812 lines; currently RED on the ~20 stripped assertions)
├── file-injector.ts             # UNCHANGED (engine verbatim — the contract the tests migrate TO)
├── relative-imports.test.mjs    # NOT edited (P1.M2.T2.S1)
├── import-behavior.test.mjs     # NOT edited (P1.M2.T2.S1)
├── scripts/typecheck.mjs        # untouched
├── package.json / PRD.md / README.md   # untouched (README is P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1.S1..P1M1T2.S2/{PRP.md, research/}   # the engine verbatim change (ALL LANDED)
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — 4 exact-equality + 14 startsWith → verbatim (re-insert # before @<token>,
                          #                  per each test's input); ~18 comments/messages "stripped"→"verbatim";
                          #                  2 negative assertions UNCHANGED.
# file-injector.ts is NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the 14 startsWith use DIFFERENT prefixes, NOT all "Review a.ts". The item's claim is wrong; the
//   test_assertions_analysis.md §1b table + this PRP's table give the actual prefixes (Summarize huge.log,
//   Read sub/notes.md, Review notesMissing.md, …). Re-insert '#' before the @<token> PER SITE.

// CRITICAL — reconstruct the verbatim form from each test's INPUT, not by blind find-replace. The engine returns
//   the input prompt byte-for-byte, so r.text === <input>. Read the literal/variable passed to mod.injectFiles /
//   captureHandler at each site; the verbatim expected IS that input (exact) or its verbatim prefix (startsWith).
//   Verified: Case 1 "Review #@a.ts"; Case 19 "Read #@sub/notes.md"; EDG-4 "Read #@notesSubPrefix.md".

// CRITICAL — this task does NOT make the suite green. 9 of the 14 startsWith cases ALSO have markdown block-marker
//   assertions (hasBlock("Imports api.md here.") / !hasBlock("Imports #@api.md here.") — §3 of the analysis doc,
//   P1.M2.T1.S2's scope). Under verbatim those block markers are ALSO preserved → those assertions are RED until S2.
//   After this task: 9 cases GREEN; 9 cases fixed-on-startsWith but RED-on-block (S2). Validate by grepping the
//   failure messages (the startsWith line must NO LONGER appear; only the hasBlock/!hasBlock line should).

// CRITICAL — do NOT touch the partial-strip cases (F2/FS1/FS2/FS3, ~L899-933). They assert a MIXED prompt (one
//   token stripped, one verbatim) and need different handling — P1.M2.T1.S3's scope (item explicit).

// CRITICAL — do NOT touch the markdown block-marker pairs (~13 hasBlock/!hasBlock — §3 of the doc). P1.M2.T1.S2.
//   Touching them here = scope creep + merge conflict with S2.

// GOTCHA — MD1/EDG-1/EDG-2 go FULLY GREEN after the startsWith fix (not just fixed-on-startsWith). Their markdown
//   IMPORT is MISSING/no-match → the marker was ALWAYS verbatim in the block (§4 verbatim-block) → that assertion
//   stays valid. Only their top-level startsWith was RED. (Confirms the 9-GREEN count.)

// GOTCHA — place by ASSERTION TEXT (the unique stripped string), not raw line numbers. Lines drift. The stripped
//   string (e.g. `startsWith("Read sub/outsider.md")`) is unique per site → safe match target.

// GOTCHA — the 2 negative assertions (DELIV-1 ~L2478-2479: !includes("---"), !includes("<file")) STAY. Under verbatim,
//   r.text === "Review #@a.ts" → no "---", no "<file" → both !includes still pass. Do NOT "migrate" them.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti + alias map. runCase(n,name,fn)/assert(cond,msg). The gate is
//   `node ./file-injector.test.mjs` (NOT fully green until S2/S3 — expected). No typecheck impact (test-only).
```

## Implementation Blueprint

### The migration transformation (applied per-site)

For EACH of the 18 sites:
1. **Read the test's input** — the literal/variable passed to `mod.injectFiles(prompt, …)` or `captureHandler`'s
   `{ text: prompt, … }`. The verbatim expected = that input (exact) or its prefix (startsWith).
2. **Rewrite the expected value** — re-insert `#` before the `@<token>` (the stripped `<verb> <path>` → verbatim `<verb> #@<path>`).
3. **Reword the comment/message** — "stripped"/"marker removed" → "verbatim"/"#@ preserved (PRD §6.4)".

### The 18 old→new table (derived + input-verified)

**EXACT EQUALITY (4):**
```js
// Case 1 (~L427):    assert(r.text === "Review a.ts", `text is the stripped prompt only (no blocks, no ---), got ${JSON.stringify(r.text)}`);
//                  → assert(r.text === "Review #@a.ts", `text is the verbatim prompt (#@ preserved; no blocks, no ---), got ${JSON.stringify(r.text)}`);
// Case 12 (~L551):   assert(out.text === "Review a.ts", …"handler text is the stripped prompt (blocks now live in the before_agent_start custom message)"…);
//                  → assert(out.text === "Review #@a.ts", …"handler text is the verbatim prompt (#@ preserved; blocks live in the before_agent_start custom message)"…);
// DELIV-1 (~L2477):  assert(r.text === "Review a.ts", …"r.text is the STRIPPED prompt (no blocks)"…);
//                  → assert(r.text === "Review #@a.ts", …"r.text is the verbatim prompt (#@ preserved; no blocks)"…);
// DELIV-2 (~L2500):  assert(out.text === "Review a.ts", …"input text is stripped (blocks leave the user message)"…);
//                  → assert(out.text === "Review #@a.ts", …"input text is verbatim (#@ preserved; blocks leave the user message)"…);
```

**STARTS-WITH (14) — re-insert `#` before `@<token>`:**
```js
// U1(c)   (~L996):  r.text.startsWith("Review a.ts")           → r.text.startsWith("Review #@a.ts")
// PD1     (~L1092): r.text.startsWith("Summarize huge.log")    → r.text.startsWith("Summarize #@huge.log")
// Case 15 (~L1638): r.text.startsWith("Review notes.md")       → r.text.startsWith("Review #@notes.md")
// CRLF    (~L1670): r.text.startsWith("Read crlf_spec.md")     → r.text.startsWith("Read #@crlf_spec.md")
// Case 19 (~L1705): r.text.startsWith("Read sub/notes.md")     → r.text.startsWith("Read #@sub/notes.md")
// MD2     (~L1785): r.text.startsWith("Read sub/outsider.md")  → r.text.startsWith("Read #@sub/outsider.md")
// Case 21 (~L1882): r.text.startsWith("Review notesShorthand.md")  → r.text.startsWith("Review #@notesShorthand.md")
// Case 22 (~L1897): r.text.startsWith("Review notesExactWins.md")  → r.text.startsWith("Review #@notesExactWins.md")
// Case 23 (~L1915): r.text.startsWith("Read sub/ext/notes.md")     → r.text.startsWith("Read #@sub/ext/notes.md")
// MD1     (~L1771): r.text.startsWith("Review notesMissing.md")    → r.text.startsWith("Review #@notesMissing.md")
// EDG-1   (~L1941): r.text.startsWith("Review notesGhost.md")      → r.text.startsWith("Review #@notesGhost.md")
// EDG-2   (~L1954): r.text.startsWith("Review notesAbsent.md")     → r.text.startsWith("Review #@notesAbsent.md")
// EDG-3   (~L1968): r.text.startsWith("Read notesDedup.md")        → r.text.startsWith("Read #@notesDedup.md")
// EDG-4   (~L1986): r.text.startsWith("Read notesSubPrefix.md")    → r.text.startsWith("Read #@notesSubPrefix.md")
```
(For each, ALSO reword the trailing comment/msg from "stripped to X"/"marker stripped" → "preserved verbatim"/"#@ preserved".)

**NEGATIVE (2) — UNCHANGED:**
```js
// DELIV-1 (~L2478-2479): assert(!r.text.includes("---"), …); assert(!r.text.includes("<file"), …);
//   STAY AS-IS — the verbatim prompt still has no "---" separator and no "<file>" blocks (bytes live in r.blocks).
```

### Implementation Tasks (ordered)

```yaml
Task 1: MIGRATE the 4 exact-equality sites (Case 1, Case 12, DELIV-1, DELIV-2)
  - For each: change the expected "Review a.ts" → "Review #@a.ts"; reword the msg/comment "stripped" → "verbatim (#@ preserved)".
  - VERIFY input: each uses the literal "Review #@a.ts" (Case 1/12/DELIV-1/DELIV-2 all use this prompt).
  - RUN: node ./file-injector.test.mjs → Case 1, 12, DELIV-1, DELIV-2 now ✓ (they have no block-marker assertions).

Task 2: MIGRATE the 14 startsWith sites (per the table above)
  - For each: re-insert '#' before the @<token> in the prefix; reword the comment "stripped to X" → "preserved verbatim".
  - VERIFY each against its input prompt (the literal passed to mod.injectFiles/captureHandler):
      U1(c)="Review #@a.ts"; PD1="Summarize #@huge.log"; Case15="Review #@notes.md"; CRLF="Read #@crlf_spec.md";
      Case19="Read #@sub/notes.md"; MD2="Read #@sub/outsider.md"; Case21="Review #@notesShorthand.md";
      Case22="Review #@notesExactWins.md"; Case23="Read #@sub/ext/notes.md"; MD1="Review #@notesMissing.md";
      EDG-1="Review #@notesGhost.md"; EDG-2="Review #@notesAbsent.md"; EDG-3="Read #@notesDedup.md";
      EDG-4="Read #@notesSubPrefix.md".
  - RUN after each batch: confirm the startsWith line no longer fails for that case.
  - AFTER ALL 14: 5 cases go FULLY GREEN (U1, PD1, MD1, EDG-1, EDG-2 — their block assertions are verbatim/stay-valid);
      9 cases stay RED ONLY on their block-marker pair (15, CRLF-E2E, 19, MD2, 21, 22, 23, EDG-3, EDG-4 = S2's scope).

Task 3: LEAVE the 2 negative assertions (DELIV-1 ~L2478-2479) UNCHANGED
  - Do NOT touch `!r.text.includes("---")` / `!r.text.includes("<file")`. They pass under verbatim (prompt has neither).

Task 4: VERIFY the validation nuance (NOT "suite green")
  - RUN: node ./file-injector.test.mjs 2>&1 | grep -E "✗ case|Result:"
  - EXPECT: 9 cases ✓ (1, 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2). The 9 block-bearing cases (15, CRLF-E2E,
    19, MD2, 21, 22, 23, EDG-3, EDG-4) STILL ✗ — but their failure message must reference the hasBlock/!hasBlock
    BLOCK assertion, NOT the r.text.startsWith line.
  - GREP the failure details for the 9: confirm NONE mention "startsWith" or the top-level prompt text — only
    "hasBlock"/"blocks"/the block needle. (If a startsWith failure remains, that site wasn't migrated.)
  - The partial-strip cases (F1/F1b/F1d/F2/FS1/FS2/FS3) and scanTokens unit tests (T1.S1-*) REMAIN RED — they are
    S3's / out-of-scope. Do NOT chase them here.
  - git diff --stat file-injector.ts → EMPTY.
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - 4 exact-equality sites (~L427/L551/L2477/L2500): expected "Review a.ts" → "Review #@a.ts"; msg/comment reworded.
  - 14 startsWith sites (~L996/L1092/L1638/L1670/L1705/L1785/L1882/L1897/L1915/L1771/L1941/L1954/L1968/L1986):
      prefix re-inserts '#' before @<token> (per the table); comment reworded.
  - 2 negative sites (~L2478-2479): UNCHANGED.
  - UNCHANGED: all helpers (runCase/assert/FIX/hasBlock/blocksText/countFileBlocks), makeMockCtx, captureHandler,
    captureAllHandlers, buildFixtures, the partial-strip cases (F2/FS1/FS2/FS3), the markdown block-marker pairs
    (S2's scope), the verbatim-prompt assertions (§2 of the doc — they already expect verbatim), every other case.

NO_CHANGES: file-injector.ts (git diff empty), relative-imports.test.mjs (P1.M2.T2.S1), import-behavior.test.mjs
            (P1.M2.T2.S1), scripts/typecheck.mjs, package.json, PRD.md, README.md (P1.M2.T4.S1), all plan/ files.
```

## Validation Loop

### Level 1: The 9 GREEN cases pass

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "✓ case (1|12|U1|PD1|MD1|EDG-1|EDG-2|DELIV-1|DELIV-2)[ :]"
# Expected: 9 ✓ lines (these cases have only top-level prompt assertions, or their block assertions are verbatim/stay-valid).
# Before this task: case 1, 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2 were ✗ (on the stripped-prompt assertion).
```

### Level 2: The 9 block-bearing cases — startsWith FIXED (fail only on the block pair = S2)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -A1 "✗ case \(15\|CRLF-E2E\|19\|MD2\|21\|22\|23\|EDG-3\|EDG-4\)"
# Expected: each still ✗, BUT the failure detail (the "→ <msg>" line) references a hasBlock/!hasBlock BLOCK assertion
# (e.g. "expected block to include 'Imports api.md here.'" or "!hasBlock(...'Imports #@api.md here.'...)") — NOT the
# r.text.startsWith top-level line.
# If any failure detail still mentions "startsWith" or the top-level prompt text → that site wasn't migrated (re-check).
```

### Level 3: No top-level-prompt failure remains anywhere

```bash
cd /home/dustin/projects/pi-file-injector
# Grep ALL failure details for any surviving stripped-prompt assertion (none should remain after this task):
node ./file-injector.test.mjs 2>&1 | grep -iE "stripped prompt|marker stripped|startsWith\(\"(Review|Read|Summarize) [a-z]"
# Expected: NO matches (every top-level stripped assertion has been migrated to verbatim).
# (The partial-strip F2/FS1/FS2/FS3 cases will still fail — they're S3; their failure msgs mention "startsWith" but
#  with a MIXED prompt like 'Review a.ts ... #@missing.ts' — those are out of scope. Confirm they're the partial-strip
#  cases, not the 18 top-level ones.)
```

### Level 4: Scope integrity (no .ts change)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts    # expect EMPTY (test-only migration; the .ts is the landed verbatim contract)
git diff --stat                    # expect ONLY file-injector.test.mjs
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → the 9 GREEN cases (1, 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2) ✓.
- [ ] The 9 block-bearing cases (15, CRLF-E2E, 19, MD2, 21, 22, 23, EDG-3, EDG-4) fail ONLY on hasBlock/!hasBlock
      (S2's scope) — NOT on `r.text.startsWith`.
- [ ] No surviving "stripped prompt"/"marker stripped" failure in the top-level cases (Level 3 grep clean for the 18).
- [ ] `git diff --stat file-injector.ts` EMPTY.

### Feature Validation (the migration correctness)

- [ ] 4 exact-equality: `r.text`/`out.text === "Review #@a.ts"` (verbatim).
- [ ] 14 startsWith: verbatim prefix with `#` re-inserted before `@<token>`, matching each test's input prompt.
- [ ] 2 negative (`!includes("---")`, `!includes("<file")`) UNCHANGED.
- [ ] Comments/messages reworded "stripped" → "verbatim"/"#@ preserved" (PRD §6.4).

### Code Quality Validation

- [ ] Each verbatim expected value was reconstructed from the test's ACTUAL input (not a blind find-replace of "Review a.ts").
- [ ] Placement by ASSERTION TEXT (unique stripped string), not raw line numbers (lines drift).
- [ ] No edits to the partial-strip cases (S3), the markdown block-marker pairs (S2), helpers, fixtures, or the .ts.

### Documentation

- [ ] None (test-only; no user-facing surface — item §5).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT blind find-replace "Review a.ts" → "Review #@a.ts".** The 14 startsWith use DIFFERENT prefixes
  (`'Summarize huge.log'`, `'Read sub/notes.md'`, …). Reconstruct each from its test's INPUT prompt.
- ❌ **Do NOT expect the suite to go green.** 9 cases have markdown block-marker assertions (S2's scope) that stay
  RED. This task's gate is "9 GREEN + 9 startsWith-fixed-but-block-pending-S2", NOT "0 failed".
- ❌ **Do NOT touch the partial-strip cases (F2/FS1/FS2/FS3).** They assert a MIXED prompt (one stripped + one
  verbatim) — P1.M2.T1.S3's scope (item explicit).
- ❌ **Do NOT touch the markdown block-marker pairs (hasBlock/!hasBlock).** P1.M2.T1.S2. Touching them here is
  scope creep + a merge-collision risk with S2.
- ❌ **Do NOT "migrate" the 2 negative assertions** (`!includes("---")`/`!includes("<file")`). They stay valid
  under verbatim (the prompt has neither). Leave them unchanged.
- ❌ **Do NOT edit file-injector.ts.** The engine verbatim change is LANDED (d3219d2). Tests migrate TO it.
  `git diff --stat file-injector.ts` MUST be empty.
- ❌ **Do NOT trust raw line numbers.** Lines drift. Match by the unique stripped assertion TEXT
  (e.g. `r.text.startsWith("Read sub/outsider.md")`).
- ❌ **Do NOT change the assertion SHAPE** (don't convert startsWith to ===, or vice versa). The item is about the
  expected VALUE (stripped → verbatim), not the assertion shape. Keep startsWith as startsWith; === as ===.
- ❌ **Do NOT reword comments to drop the PRD citation.** Keep "PRD §6.4" / "verbatim" wording so the rationale is clear.
- ❌ **Do NOT touch relative-imports.test.mjs / import-behavior.test.mjs.** Those are P1.M2.T2.S1.

---

## Confidence Score: 9/10

A mechanical, well-traced migration: 18 top-level assertions (4 exact + 14 startsWith) with the EXACT old→new
table derived and input-verified (Case 1/19/EDG-4/PD1 confirmed against their actual input prompts), plus the
critical correction that the 14 startsWith use DIFFERENT prefixes (not the item's "all Review a.ts"), plus the
validation nuance (9 GREEN / 9 fixed-but-pending-S2 — the suite is NOT green until S2+S3). The -1 reserves for:
(a) line-number drift (mitigated by text-based placement + the unique stripped strings), and (b) the implementer
needing to VERIFY each of the 14 startsWith prefixes against its input (the table gives the derived forms, but a
quick confirmation read prevents a mis-reconstruction). The single gate (run + grep the failure details) is
unambiguous. The implementing agent edits ONE file at 18 small sites, then runs + greps.