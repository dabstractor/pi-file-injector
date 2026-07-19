---
name: "P1.M2.T1.S3 (plan 009) — Migrate the 4 PARTIAL-STRIP prompt assertions (F2/FS1/FS2/FS3) from 'injected-token-stripped, failed-token-kept-#@' → ALL tokens verbatim; VERIFY the ~13 verbatim-prompt exact-equality assertions still pass unchanged"
prd_ref: "PRD §6.4 (Assembly — the prompt is never modified; #@ preserved verbatim), §13.8 (Why verbatim — re-open safety), §10 Edge Cases (failed/dir/deduped tokens left verbatim); architecture/test_assertions_analysis.md §1c (the 4 partial-strip cases) + §2 (the 13 verbatim-prompt cases)"
target_file: "./file-injector.test.mjs"   # EDIT IN PLACE — 4 startsWith assertions (L899/L915/L924/L933) re-pointed to the verbatim marker; ~4 comment/msg rewords. The 13 verbatim-prompt assertions (L481+…) need NO edit — verify only.
target_language: JavaScript (.mjs zero-deps test harness, loaded via Pi jiti); gate = `node ./file-injector.test.mjs` (engine verbatim is LANDED — UNCHANGED here)
depends_on: "P1.M1.T1.S1/S2/S3 + P1.M1.T2.S1 (engine verbatim — LANDED) + P1.M2.T1.S1 (top-level startsWith already verbatim, commit 8d474d9 — LANDED). The 4 partial-strip cases currently fail ONLY on their startsWith line."
consumed_by: "P1.M2.T2.S1 (relative/import-behavior marker expectations), P1.M2.T3 (re-open regression), P1.M2.T4.S1 (README verbatim sync). NOTE: S2 (the ~13 hasBlock pairs) runs in PARALLEL — its edits are at L1644+ (DISJOINT from S3's L890-933); both compose cleanly."
---

# PRP — P1.M2.T1.S3: Migrate the 4 partial-strip prompt assertions to verbatim (+ verify 13 verbatim-prompt cases)

> **Scope flag:** Test-only migration. The verbatim engine (P1.M1, LANDED) + S1 top-level startsWith
> (commit 8d474d9, LANDED) already make `r.text` byte-for-byte the input prompt on EVERY path
> (`file-injector.ts:1179` and `:1188` both return the unmodified `text`; `:1265` returns
> `event.text`). The OLD "partial-strip asymmetry" — only the token that ACTUALLY injected had its
> `#@` stripped, while the failed/directory/deduped one kept `#@` (the "Issue 2" regression guard) —
> no longer exists: **every `#@` marker survives** (injected + failed + dir + deduped alike). The 4
> cases (F2/FS1/FS2/FS3) still assert the old stripped form and are RED; this task re-points each
> `startsWith` to the verbatim marker and rewords the comments. **No `.ts` change, no README, no
> logic change.** The ~13 verbatim-prompt exact-equality assertions (§2 of the analysis doc) are
> ALREADY correct and need NO edit — they are verified to still pass. After this task the 4 partial-
> strip cases go ✓ (suite failures 23→19 if before S2; 10→6 if after).

---

## Goal

**Feature Goal:** Bring `file-injector.test.mjs`'s 4 partial-strip prompt cases (F2, FS1, FS2, FS3)
into compliance with the verbatim engine: each `r.text.startsWith(...)` is re-pointed from the OLD
"stripped injected marker" form to the NEW "verbatim marker" form — because under verbatim delivery
the injected `#@a.ts` KEEPS its `#@` just like the failed/directory/deduped tokens. The accompanying
`includes()` checks (FS1 `#@missing.ts`, FS2 `#@src/`) were ALREADY verbatim-correct and stay. The
~13 verbatim-prompt exact-equality assertions are verified to still pass (no edit). Comments are
reworded: drop "stripped to a.ts" / "only the injected…is stripped" / "first stripped, deduped
second keeps #@" → "prompt delivered verbatim — all #@ markers preserved (§6.4)".

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): 4 `startsWith`
assertions re-pointed (L899 F2, L915 FS1, L924 FS2, L933 FS3); ~4 comment/msg rewords. No `.ts`,
no README, no other test file, no plan edits.

**Success Definition:**
1. F2, FS1, FS2, FS3 → ✓ (was ✗). Each `startsWith` now expects the verbatim marker (`#@a.ts`).
2. The ~13 verbatim-prompt exact-equality assertions (Case 5/6/7/8/14/E3/E4/U1(a,b,e)/Case24/
   ISS1-TL/Case28) STILL pass (they were already green; this confirms no regression).
3. FS1's `includes("#@missing.ts")` (L916) and FS2's `includes("#@src/")` (L925) are UNCHANGED
   (they were already verbatim-correct).
4. Suite failures drop by 4 (23→19 standalone, or 10→6 if S2 has landed). Remaining failures
   (F1/F1b/F1d dedup, T1.S1-9/10/12 scanTokens) are OUT of scope.
5. `git diff --stat file-injector.ts` is EMPTY (test-only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs`. The verbatim engine is
landed; the partial-strip prompt assertions must follow so the gate reflects the new (correct,
re-open-safe, honest) contract: the user prompt is delivered byte-for-byte, `#@` preserved whether
or not the token injected.

**Use Case:** After this task, `node ./file-injector.test.mjs` shows F2/FS1/FS2/FS3 ✓ and the 13
verbatim-prompt cases still ✓. (Full green pending S2's hasBlock pairs + F1/F1b/F1d dedup +
scanTokens migration, all separate.)

**Pain Points Addressed:** 4 cases are RED on stale stripped-marker `startsWith` assertions after
the P1.M1 verbatim change. This task clears the partial-strip slice.

## Why

- **The engine deliberately stopped stripping the prompt (PRD §6.4/§13.8).** Stripping `#@` from
  injected tokens broke every re-submission path (cancel/fork/`/tree` re-open) — the stored prompt
  would lose its triggers and files would silently vanish on re-open. Verbatim delivery fixes that:
  `r.text` is the input prompt, always. The partial-strip tests MUST reflect "all markers verbatim".
- **The "Issue 2" asymmetry is obsolete.** The old guard verified "only inject tokens get stripped;
  failed tokens keep `#@`". Under verbatim NOTHING is stripped, so the distinction collapses: every
  marker is verbatim. The tests become simpler (no mixed stripped/verbatim state to assert).
- **Mechanical but precision-critical.** 4 assertions, each a deterministic needle swap. The risks
  are (a) the L915/L924 byte-identical lines (need disambiguating context for a unique edit), (b)
  accidentally touching the `includes()` lines that must stay, or (c) editing a verbatim-prompt case
  that needs NO change. The PRP gives the exact old→new for each of the 4 (derived from each prompt's
  literal text) and the explicit verify-only list for the 13.

## What

No user-visible/API/logic change. The test file's 4 partial-strip `startsWith` assertions are
re-pointed to the verbatim marker; their comments/messages are reworded. The cases, fixtures,
helpers, invocation mode (Mode A direct pipeline), and the handler-level sub-check in F2 are
structurally unchanged. The 13 verbatim-prompt exact-equality assertions are verified (not edited).

### Success Criteria

- [ ] F2 (L899): `startsWith('<!--#@file-injected--> Review a.ts')` → `startsWith('<!--#@file-injected--> Review #@a.ts')`.
- [ ] FS1 (L915): `startsWith("Review a.ts")` → `startsWith("Review #@a.ts")`; L916 `includes("#@missing.ts")` UNCHANGED.
- [ ] FS2 (L924): `startsWith("Review a.ts")` → `startsWith("Review #@a.ts")`; L925 `includes("#@src/")` UNCHANGED.
- [ ] FS3 (L933): `startsWith("Compare a.ts with #@a.ts")` → `startsWith("Compare #@a.ts with #@a.ts")` (exact-equality also valid).
- [ ] ~4 comments/messages reworded: drop "stripped to a.ts"/"only the injected…stripped"/"first stripped, deduped second keeps #@"; → "verbatim — all #@ markers preserved (§6.4)".
- [ ] F2, FS1, FS2, FS3 → ✓.
- [ ] The 13 verbatim-prompt cases (Case 5/6/7/8/14/E3/E4/U1(a,b,e)/Case24/ISS1-TL/Case28) STILL ✓.
- [ ] `git diff --stat file-injector.ts` EMPTY; no edit to any `includes()` line, any verbatim-prompt line, or the handler-level sub-check.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the verbatim contract (engine returns `r.text` = input prompt on BOTH
paths — `file-injector.ts:1179` and `:1188`; input handler `:1265` returns `event.text`), the exact
old→new for all 4 partial-strip assertions (derived from each prompt's literal text, line-verified at
HEAD 8d474d9), the L915/L924 byte-identical-line disambiguation rule, the explicit verify-only list
of the 13 verbatim-prompt cases (with line numbers), the out-of-scope boundaries (F1/F1b/F1d dedup;
scanTokens; S2's disjoint L1644+ lines; §4 verbatim-block assertions), and the single gate (run +
grep the ✓/✗ lines). The implementer edits ONE file at 4 small assertion sites, rewords ~4 comments,
then runs + greps.

### Documentation & References

```yaml
# MUST READ — the 4-partial-strip inventory (§1c) + the 13 verbatim-prompt list (§2)
- file: plan/009_0d85ac0b1b08/architecture/test_assertions_analysis.md
  why: "§1c 'PARTIAL strip — injected token stripped, a second token kept verbatim' = my 4 cases
        (F2 L899, FS1 L915-916, FS2 L924-925, FS3 L933) with the exact current assertions. §2
        'VERBATIM-prompt assertions' = the 13 verify-only cases. NOTE: the doc describes the OLD
        stripping contract (it was written pre-migration) — it tells you what the tests CURRENTLY
        assert; THIS PRP tells you the NEW verbatim target."
  critical: "§1c is my edit set (4 cases). §2 is my verify set (13 cases, NO edit). §3 (the ~13
             hasBlock pairs) is S2's set (parallel) — DO NOT TOUCH. Line numbers drift ±a few;
             match by the unique assertion TEXT."

# MUST READ — the verbatim contract (why r.text is now the input prompt)
- file: PRD.md
  why: "§6.4 'Assembly & shared state' — 'The prompt is never modified… the #@<path> triggers stay
        exactly where the user typed them'. §13.8 'Why the prompt is preserved verbatim (no #@
        stripping)' — stripping broke re-submission (cancel/fork/tree re-open). These are the
        rationale the re-pointed assertions encode."
  section: "### 6.4 + ### 13.8"

# The file you edit (the ONLY change)
- file: file-injector.test.mjs
  why: "The 4 assertion sites: F2 (runCase L890; prompt L896; assert L899), FS1 (runCase L912;
        prompt L913; asserts L915-916), FS2 (runCase L921; prompt L922; asserts L924-925), FS3
        (runCase L928; prompt L929; assert L933). runCase/assert harness at L81/L90."
  pattern: "Each partial-strip case calls mod.injectFiles(prompt, [], FIX) (Mode A direct pipeline),
            then asserts on r.text. The startsWith is the line to re-point; the includes() (FS1/FS2)
            STAYS. F2 also has a handler sub-check (captureHandler → out.action === 'transform') that
            is UNAFFECTED (it checks action, not text)."
  gotcha: "L915 (FS1) and L924 (FS2) are BYTE-IDENTICAL: `assert(r.text.startsWith(\"Review a.ts\"),
           \"the injected #@a.ts is stripped to a.ts\");`. The edit tool needs a UNIQUE oldText ⇒
           include the following includes() line as disambiguating context (L916 #@missing.ts for
           FS1; L925 #@src/ for FS2), or edit each 2-line block as a unit."

# The engine contract (LANDED — read-only; confirms r.text is verbatim)
- file: file-injector.ts
  why: "injectFiles (L1111): L1179 `if (state.count === 0) return { text, ... }` (text unchanged);
        L1188 `return { text, ... }` (text STILL the unmodified input — P1.M1.T1.S3 deleted the
        strippedText bookkeeping). Input handler L1265 `return { action:'transform', text: event.text,
        images }`. BOTH paths → r.text is the input prompt byte-for-byte. Do NOT edit file-injector.ts."
  gotcha: "`git diff --stat file-injector.ts` MUST be empty. The tests change to MATCH the .ts."

# The landed sibling (READ-ONLY — already done; do NOT re-touch)
- file: plan/009_0d85ac0b1b08/P1M2T1S1/PRP.md   # (S1 — LANDED commit 8d474d9)
  why: "S1 migrated the ~20 top-level prompt assertions (4 exact + 14 startsWith) to verbatim — e.g.
        L428 Case 1 `r.text === \"Review #@a.ts\"`, L996 U1(c) `startsWith(\"Review #@a.ts\")`,
        L1092 PD1 `startsWith(\"Summarize #@huge.log\")`. Confirm: `git log --oneline | head -1` →
        '8d474d9 Migrate top-level prompt assertions to verbatim'. The top-level startsWith lines
        are ALREADY verbatim — DO NOT touch them."

# The parallel sibling (READ-ONLY — running concurrently; disjoint line ranges)
- file: plan/009_0d85ac0b1b08/P1M2T1S2/PRP.md   # (S2 — parallel)
  why: "S2 migrates the ~13 markdown hasBlock pairs (Cases 15/CRLF-E2E/19/20/MD2/21/22/23/EDG-3/
        EDG-4/26/27/M2.T2.S1-g) at L1644+. S2 explicitly lists F2/FS1/FS2/FS3 as OUT OF ITS SCOPE.
        S3's edits (L890-933) are DISJOINT from S2's (L1644+) — no overlap, the two compose cleanly
        if both land. Do NOT edit any hasBlock pair (that's S2)."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD 8d474d9 (engine verbatim + S1 top-level LANDED; working tree CLEAN)
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (4 partial-strip startsWith currently RED)
├── file-injector.ts             # UNCHANGED (engine verbatim — r.text is the input prompt, both paths)
├── relative-imports.test.mjs    # NOT edited (P1.M2.T2.S1)
├── import-behavior.test.mjs     # NOT edited (P1.M2.T2.S1)
├── scripts/typecheck.mjs        # untouched
├── package.json / PRD.md / README.md   # untouched (README is P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1.S1..P1M2T1S1/{PRP.md, research/}   # engine verbatim (LANDED) + S1 top-level (LANDED 8d474d9)
    ├── P1M2T1S2/{research/research_notes.md, PRP.md}   # S2 (parallel — hasBlock pairs at L1644+)
    └── P1M2T1S3/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — 4 startsWith assertions re-pointed to the verbatim marker
                          #                  (F2 L899, FS1 L915, FS2 L924, FS3 L933); ~4 comment/msg
                          #                  rewords "stripped"→"verbatim (§6.4)".
# file-injector.ts is NEVER edited. The 13 verbatim-prompt assertions + the includes() lines + the
# §4 verbatim-block assertions + F2's handler sub-check + S2's hasBlock pairs are all UNCHANGED.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — r.text is the INPUT PROMPT verbatim on BOTH engine paths (file-injector.ts:1179 + :1188;
//   input handler :1265 returns event.text). P1.M1.T1.S3 deleted the strippedText bookkeeping. So:
//   F2  r.text === '<!--#@file-injected--> Review #@a.ts'
//   FS1 r.text === "Review #@a.ts and check #@missing.ts"
//   FS2 r.text === "Review #@a.ts and list #@src/"
//   FS3 r.text === "Compare #@a.ts with #@a.ts"
//   The startsWith assertions become trivially true (prefix of the unchanged prompt). The "partial-
//   strip asymmetry" (injected stripped, failed kept) NO LONGER EXISTS — every marker is verbatim.

// CRITICAL — L915 (FS1) and L924 (FS2) are BYTE-IDENTICAL lines:
//   assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
//   The edit tool requires a UNIQUE oldText. Disambiguate by including the FOLLOWING line as context:
//     FS1: include L916  assert(r.text.includes("#@missing.ts") === true, ...);
//     FS2: include L925  assert(r.text.includes("#@src/") === true, ...);
//   OR edit each 2-line block (L915-916, L924-925) as one oldText unit. Do NOT find-replace blindly.

// CRITICAL — do NOT touch the includes() lines. FS1 L916 `includes("#@missing.ts") === true` and
//   FS2 L925 `includes("#@src/") === true` were ALREADY verbatim-correct (the failed/dir token always
//   kept its #@, even under the old stripping engine). They STAY unchanged. Only the startsWith flips.

// CRITICAL — the ~13 verbatim-prompt exact-equality assertions (L481/489/496/503/588/628/643/988/
//   992/1005/1932/2013/2416) are ALREADY correct (they always asserted r.text === "<prompt with #@>").
//   They need NO edit. VERIFY they pass. If any FAILS → the engine regressed (a prompt with no
//   resolved token was modified) — escalate, do NOT patch the assertion.

// CRITICAL — S1 (top-level startsWith) ALREADY LANDED (commit 8d474d9). The top-level startsWith
//   lines (e.g. L996 "Review #@a.ts", L1092 "Summarize #@huge.log") are already verbatim. DO NOT
//   touch them. This task is ONLY the 4 PARTIAL-STRIP cases (F2/FS1/FS2/FS3 in the L890-933 block).

// CRITICAL — F1/F1b/F1d (runCase L759/L786/L817) are dedup-across-passes tests, NOT partial-strip
//   assertions. Their premise (F1d's literal title: "stripping #@ post-inject makes dedup
//   bidirectional") is a SEPARATE engine-behavior concern. They REMAIN RED after S3 (expected) —
//   do NOT chase them. Belongs to a dedup/re-open task (likely P1.M2.T3), not this migration.

// GOTCHA — S2 (parallel) edits the hasBlock pairs at L1644+. S3 edits L890-933. DISJOINT — no overlap.
//   Do NOT edit any hasBlock(...) / !hasBlock(...) pair; that's S2.

// GOTCHA — match by ASSERTION TEXT, not raw line numbers. Lines drift ±a few across sibling edits.
//   The unique targets: F2's `'<!--#@file-injected--> Review a.ts'`, FS3's `"Compare a.ts with #@a.ts"`.

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti + alias map. runCase(n,name,fn)/assert(cond,msg).
//   The gate is `node ./file-injector.test.mjs`. No typecheck impact (test-only). FIX = {cwd: TMPDIR}
//   (no budget → all whole). F2 also exercises the input handler (captureHandler) — UNAFFECTED.
```

## Implementation Blueprint

### The transformation rule (applied per-case)

For EACH of the 4 partial-strip cases:
1. **Re-point the `startsWith` needle** from the OLD stripped form (e.g. `"Review a.ts"`) to the NEW
   verbatim form (e.g. `"Review #@a.ts"`). The injected `#@a.ts` now KEEPS its `#@`.
2. **Leave the `includes()` checks** (FS1 `#@missing.ts`, FS2 `#@src/`) UNCHANGED — they were already
   verbatim-correct.
3. **Reword the comment/msg** — drop "stripped to a.ts" / "only the injected…stripped" / "first
   stripped, deduped second keeps #@"; → "prompt delivered verbatim — all #@ markers preserved
   (§6.4); injected + failed + dir + deduped tokens alike keep their #@". For FS3: "both tokens
   verbatim (dedup affects injection count, not the prompt)".

### The 4 old→new table (CURRENT verified lines + prompt-derived)

```js
// F2 (L899):   r.text.startsWith('<!--#@file-injected--> Review a.ts')
//           → r.text.startsWith('<!--#@file-injected--> Review #@a.ts')
//   (prompt L896 = '<!--#@file-injected--> Review #@a.ts' — the sentinel token #@file-injected-->
//    never resolved (left verbatim); #@a.ts injected (now ALSO verbatim). Both keep #@.)
//   msg: "only the injected #@a.ts is stripped (→ a.ts); the failed sentinel token keeps its #@
//         verbatim (Issue 2 fix)" → "prompt delivered verbatim — BOTH #@ tokens preserved (§6.4);
//         the injected #@a.ts no longer loses its #@ (no stripping under verbatim delivery)"

// FS1 (L915):  r.text.startsWith("Review a.ts")
//           → r.text.startsWith("Review #@a.ts")
//   (prompt L913 = "Review #@a.ts and check #@missing.ts" — #@a.ts injected (verbatim now),
//    #@missing.ts failed (verbatim). Both keep #@.)
//   msg: "the injected #@a.ts is stripped to a.ts" → "prompt delivered verbatim — the injected
//        #@a.ts keeps its #@ (§6.4)"
//   L916 includes("#@missing.ts") === true  → UNCHANGED (already verbatim-correct)

// FS2 (L924):  r.text.startsWith("Review a.ts")
//           → r.text.startsWith("Review #@a.ts")
//   (prompt L922 = "Review #@a.ts and list #@src/" — #@a.ts injected (verbatim now), #@src/ dir
//    (verbatim). Both keep #@.)
//   msg: "the injected #@a.ts is stripped to a.ts" → "prompt delivered verbatim — the injected
//        #@a.ts keeps its #@ (§6.4)"
//   L925 includes("#@src/") === true  → UNCHANGED (already verbatim-correct)

// FS3 (L933):  r.text.startsWith("Compare a.ts with #@a.ts")
//           → r.text.startsWith("Compare #@a.ts with #@a.ts")
//   (prompt L929 = "Compare #@a.ts with #@a.ts" — two identical tokens; first injected (was
//    stripped→a.ts, now verbatim #@a.ts), second deduped (always verbatim #@a.ts). BOTH verbatim now.)
//   msg: "first stripped, deduped second keeps #@ (Issue 2)" → "BOTH #@ tokens verbatim (dedup
//        affects injection count, not the prompt; §6.4)"
//   (Alternative: exact equality `r.text === "Compare #@a.ts with #@a.ts"` — slightly stronger,
//    also passes. startsWith is fine for consistency with F2/FS1/FS2.)
```

### Implementation Tasks (ordered)

```yaml
Task 1: RE-POINT F2's startsWith (L899)
  - OLD: assert(r.text.startsWith('<!--#@file-injected--> Review a.ts'), "only the injected #@a.ts is stripped (→ a.ts); …")
  - NEW: assert(r.text.startsWith('<!--#@file-injected--> Review #@a.ts'), "prompt delivered verbatim — BOTH #@ tokens preserved (§6.4); the injected #@a.ts no longer loses its #@ …")
  - NOTE: F2's prompt (L896) is already '<!--#@file-injected--> Review #@a.ts' — the NEW startsWith needle is literally the prompt. (The input is byte-for-byte the output.)
  - UNCHANGED: the injected/countFileBlocks asserts (r.injected===1, aCount===1) and the handler sub-check (out.action === "transform").

Task 2: RE-POINT FS1's startsWith (L915) — keep L916 includes()
  - OLD L915: assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
  - NEW L915: assert(r.text.startsWith("Review #@a.ts"), "prompt delivered verbatim — the injected #@a.ts keeps its #@ (§6.4)");
  - KEEP L916: assert(r.text.includes("#@missing.ts") === true, …)  UNCHANGED.
  - DISAMBIGUATION: L915 and L924 are byte-identical. Edit the L915-916 block as one oldText unit (include L916's #@missing.ts line) so the match is unique.

Task 3: RE-POINT FS2's startsWith (L924) — keep L925 includes()
  - OLD L924: assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
  - NEW L924: assert(r.text.startsWith("Review #@a.ts"), "prompt delivered verbatim — the injected #@a.ts keeps its #@ (§6.4)");
  - KEEP L925: assert(r.text.includes("#@src/") === true, …)  UNCHANGED.
  - DISAMBIGUATION: edit the L924-925 block as one oldText unit (include L925's #@src/ line) so the match is unique (vs L915-916).

Task 4: RE-POINT FS3's startsWith (L933)
  - OLD: assert(r.text.startsWith("Compare a.ts with #@a.ts"), `first stripped, deduped second keeps #@ (Issue 2), …`);
  - NEW: assert(r.text.startsWith("Compare #@a.ts with #@a.ts"), `BOTH #@ tokens verbatim (dedup affects injection count, not the prompt; §6.4), …`);
  - (exact-equality `r.text === "Compare #@a.ts with #@a.ts"` is an acceptable alternative.)

Task 5: REWORD the runCase-name/comment for FS3 (L928-930) — optional but recommended for honesty
  - The runCase NAME still says "FS3 — Issue1×Issue2: deduped repeat keeps #@ (first stripped)" and the
    block comment (L930) says "⇒ first stripped to a.ts, deduped second KEEPS its #@". Under verbatim
    there is no "first stripped" — reword to "both verbatim (dedup affects injection count only)".
    (The case's injected===1 + aCount===1 asserts STAY — dedup still holds for injection.)

Task 6: VERIFY gates
  - node ./file-injector.test.mjs → F2, FS1, FS2, FS3 ✓ (the 4 partial-strip cases).
  - The 13 verbatim-prompt cases STILL ✓ (Case 5/6/7/8/14/E3/E4/U1(a,b,e)/Case24/ISS1-TL/Case28).
  - Result: 23→19 failed (standalone, before S2) OR 10→6 failed (after S2). Remaining: F1/F1b/F1d
    (dedup, out of scope) + T1.S1-9/10/12 (scanTokens, separate) [+ S2's 13 if S2 hasn't landed].
  - git diff --stat file-injector.ts → EMPTY.
```

### Implementation Patterns & Key Details

```js
// ── The partial-strip re-point (the transformation) ──
// OLD (stripping engine): in a 2-token prompt, only the token that ACTUALLY injected lost its #@;
//   the failed/dir/deduped one kept #@. (The "Issue 2" regression guard.)
//   assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
//   assert(r.text.includes("#@missing.ts") === true, "the FAILED #@missing.ts keeps its #@ (§6.2)");
// NEW (verbatim engine): NOTHING is stripped — every #@ marker survives. r.text === the input prompt.
//   assert(r.text.startsWith("Review #@a.ts"), "prompt verbatim — injected #@a.ts keeps #@ (§6.4)");
//   assert(r.text.includes("#@missing.ts") === true, …);   // UNCHANGED — was already verbatim-correct

// ── FS3: the dedup case, both tokens now verbatim ──
// OLD: assert(r.text.startsWith("Compare a.ts with #@a.ts"), "first stripped, deduped second keeps #@");
// NEW: assert(r.text.startsWith("Compare #@a.ts with #@a.ts"), "BOTH verbatim (dedup affects count, not prompt)");
//   (dedup still holds for INJECTION — injected===1, aCount===1 — only the PROMPT markers both survive)
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - F2 startsWith (L899): '… Review a.ts' → '… Review #@a.ts'; msg reworded.
  - FS1 startsWith (L915): "Review a.ts" → "Review #@a.ts"; msg reworded; L916 includes() UNCHANGED.
  - FS2 startsWith (L924): "Review a.ts" → "Review #@a.ts"; msg reworded; L925 includes() UNCHANGED.
  - FS3 startsWith (L933): "Compare a.ts with #@a.ts" → "Compare #@a.ts with #@a.ts"; msg reworded.
  - FS3 runCase name/comment (L928/L930): "first stripped" → "both verbatim (dedup affects count)" (optional).
  - UNCHANGED: the includes() lines (L916/L925); the injected/countFileBlocks asserts in each case;
    F2's handler sub-check (out.action === "transform"); the 13 verbatim-prompt exact-equality
    assertions (L481/489/496/503/588/628/643/988/992/1005/1932/2013/2416); the top-level startsWith
    lines (S1 LANDED); the §4 verbatim-block assertions; F1/F1b/F1d (dedup); scanTokens tests;
    S2's hasBlock pairs (L1644+).
NO_CHANGES: file-injector.ts (git diff empty), relative-imports.test.mjs, import-behavior.test.mjs,
            scripts/typecheck.mjs, package.json, PRD.md, README.md, all plan/ files.
NO_LOGIC_CHANGE: detection/resolution/dedup/paging/code-exempt logic UNCHANGED. Only the marker-
                 PRESENCE expectation in the 4 partial-strip startsWith assertions changes (stripped→verbatim).
```

## Validation Loop

### Level 1: The 4 partial-strip cases go GREEN

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case (F2|FS1|FS2|FS3)\b"
# Expected: 4 ✓ lines. Before this task: 4 ✗ (each citing "stripped to a.ts" / "first stripped, deduped second keeps #@").
```

### Level 2: The 13 verbatim-prompt cases STILL pass (no regression)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case (5|6|7|8|14|E3|E4|U1\(a\)|U1\(b\)|U1\(e\)|24|ISS1-TL|28)\b"
# Expected: 13 ✓ lines (all were already green; confirms the verbatim-prompt contract holds).
# If ANY shows ✗ → the engine regressed (a no-injection prompt was modified). Escalate; do NOT patch the assertion.
```

### Level 3: Suite failure count drops by 4 (parallel-aware)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "Result:"
# Expected (standalone, S2 NOT yet landed): "Result: 131 passed, 19 failed." (was 127 passed, 23 failed; +4 cases pass).
# Expected (after S2 landed): "Result: 141 passed, 6 failed." (was 137 passed, 10 failed; +4 cases pass).
# The remaining failures: F1, F1b, F1d (dedup-across-passes, out of scope) + T1.S1-9, T1.S1-10,
# T1.S1-12 (scanTokens return-shape, separate). [+ S2's 13 hasBlock pairs if S2 hasn't landed yet.]
```

### Level 4: Scope integrity (no .ts change; includes() + verbatim-prompt lines untouched)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.test.mjs   # expect ONLY file-injector.test.mjs changed
git diff --stat file-injector.ts          # expect EMPTY (test-only; .ts is the landed verbatim contract)
git log --oneline | head -1               # expect '8d474d9 Migrate top-level prompt assertions to verbatim' (S1 LANDED)
# Confirm the includes() lines are UNCHANGED (still assert the verbatim marker is present):
grep -nE 'includes\("#@missing.ts"\)|includes\("#@src/"\)' file-injector.test.mjs   # expect 2 lines, ===true
# Confirm NO surviving "stripped to a.ts" / "first stripped" message in the 4 cases:
grep -nE 'stripped to a\.ts|only the injected.*stripped|first stripped, deduped' file-injector.test.mjs
# Expected: 0 matches among F2/FS1/FS2/FS3. (Other cases may still say "stripped" — e.g. S2's hasBlock
#  pairs if S2 hasn't landed, or F1d's dedup title — those are NOT my scope.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → F2, FS1, FS2, FS3 ✓.
- [ ] The 13 verbatim-prompt cases (Case 5/6/7/8/14/E3/E4/U1(a,b,e)/Case24/ISS1-TL/Case28) STILL ✓.
- [ ] Result: 23→19 failed (standalone) or 10→6 failed (after S2). Remaining = F1/F1b/F1d + scanTokens (+ S2's 13 if not landed).
- [ ] `git diff --stat file-injector.ts` EMPTY; includes() lines + verbatim-prompt lines UNCHANGED.

### Feature Validation (the migration correctness)

- [ ] F2 (L899): `startsWith('<!--#@file-injected--> Review #@a.ts')` — both tokens verbatim.
- [ ] FS1 (L915): `startsWith("Review #@a.ts")`; L916 `includes("#@missing.ts")` UNCHANGED.
- [ ] FS2 (L924): `startsWith("Review #@a.ts")`; L925 `includes("#@src/")` UNCHANGED.
- [ ] FS3 (L933): `startsWith("Compare #@a.ts with #@a.ts")` — both tokens verbatim (dedup affects count, not prompt).
- [ ] Comments/messages reworded: "stripped to a.ts"/"only the injected…stripped"/"first stripped, deduped second keeps #@" → "verbatim — all #@ markers preserved (§6.4)".

### Code Quality Validation

- [ ] Each startsWith needle was derived from the case's literal prompt (not a blind find-replace).
- [ ] The L915/L924 byte-identical lines were disambiguated (each edit included its following includes() line / 2-line block).
- [ ] The includes() lines (L916/L925) were LEFT UNCHANGED (already verbatim-correct).
- [ ] No edits to the 13 verbatim-prompt cases, the top-level startsWith (S1 LANDED), the §4 verbatim-block assertions, F1/F1b/F1d, scanTokens tests, the handler sub-check, helpers, or the .ts.

### Documentation

- [ ] None (test-only; no user-facing surface — item §5 DOCS: none).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch the `includes()` lines** (FS1 L916 `#@missing.ts`, FS2 L925 `#@src/`). They were
  ALWAYS verbatim-correct (failed/dir tokens kept `#@` even under stripping). Only the `startsWith`
  flips. Editing them would either be a no-op or risk breaking the already-passing assertion.
- ❌ **Do NOT edit any of the 13 verbatim-prompt exact-equality assertions** (L481/489/496/503/588/
  628/643/988/992/1005/1932/2013/2416). They were ALWAYS correct. VERIFY only. If one fails, the
  ENGINE regressed — escalate, don't patch.
- ❌ **Do NOT find-replace `startsWith("Review a.ts")` blindly.** L915 and L924 are byte-identical.
  Use the disambiguating context (the following `includes()` line) or edit each 2-line block as a unit.
- ❌ **Do NOT touch the top-level `startsWith` lines** (L996/L1092/L1638/etc.). S1 ALREADY LANDED
  them verbatim (commit 8d474d9). This task is ONLY the 4 partial-strip cases in the L890-933 block.
- ❌ **Do NOT chase F1/F1b/F1d.** They are dedup-across-passes tests (F1d's premise "stripping #@
  post-inject makes dedup bidirectional" is a separate engine-behavior concern). They REMAIN RED —
  expected. Not this task's scope.
- ❌ **Do NOT chase the scanTokens tests** (T1.S1-9/10/12) or S2's hasBlock pairs (L1644+). Separate.
- ❌ **Do NOT edit file-injector.ts.** The engine verbatim change is LANDED. Tests migrate TO it.
  `git diff --stat file-injector.ts` MUST be empty.
- ❌ **Do NOT change the injected/countFileBlocks asserts** (r.injected===1, aCount===1, etc.) or
  F2's handler sub-check (out.action === "transform"). Dedup + injection counts + the handler
  transform are UNAFFECTED by verbatim prompt delivery — only the `r.text` marker-PRESENCE changes.
- ❌ **Do NOT over-engineer FS3.** `startsWith("Compare #@a.ts with #@a.ts")` is sufficient and
  consistent with F2/FS1/FS2. Exact-equality is a valid alternative but not required.

---

## Confidence Score: 9/10

A precise, well-bounded migration: 4 partial-strip `startsWith` assertions with the EXACT old→new
table derived from each prompt's literal text (line-verified at HEAD 8d474d9), the engine contract
confirmed (r.text is the input prompt on both paths — `file-injector.ts:1179`/`:1188`; handler
`:1265`), the 13 verbatim-prompt cases confirmed already-passing (verify-only), the includes() lines
explicitly preserved, and the out-of-scope boundaries clear (F1/F1b/F1d dedup; scanTokens; S2's
disjoint L1644+ lines; §4 verbatim-block). The -1 reserves for: (a) the L915/L924 byte-identical
lines needing disambiguating context for a unique edit (mitigated by the 2-line-block guidance), and
(b) parallel-ordering uncertainty in the failure-count assertion (23→19 standalone vs 10→6 after S2
— the PRP gives both so the implementer verifies either way). The single gate (run + grep the ✓/✗
lines for the 4 partial-strip + 13 verbatim cases) is unambiguous. The implementing agent edits ONE
file at 4 small assertion sites, rewords ~4 comments, then runs + greps.