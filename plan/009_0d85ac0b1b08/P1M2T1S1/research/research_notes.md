# Research Notes — P1.M2.T1.S1 (plan 009): Migrate ~20 top-level prompt assertions from stripped → verbatim

**Item:** The engine (P1.M1, LANDED at HEAD d3219d2) now returns the prompt **verbatim** (`#@` preserved; PRD §6.4/§13.8)
instead of stripped. ~20 test assertions in `file-injector.test.mjs` still expect the STRIPPED form and are RED.
Migrate them: 4 exact-equality + 14 `startsWith` → verbatim; 2 negative (`!includes("---")`/`!includes("<file")`) UNCHANGED.
Test-only; no `.ts` change.

---

## 0. The contract — why verbatim, and what r.text now is

PRD §6.4 + §13.8: the `input` handler / `injectFiles` **never modifies** `event.text` — the `#@<path>` triggers
stay exactly where the user typed them (so cancel/fork/`/tree`-navigate re-submission re-triggers injection).
So `r.text` / `out.text` is now **the input prompt byte-for-byte** (with `#@`). Block bytes still live ONLY in
`r.blocks` / the `before_agent_start` custom message (unchanged).

Confirmed in `file-injector.ts`: `injectFiles` returns `text` verbatim (L1179 nothing-injected returns original
`text`; L1188 returns `text` unchanged); the input handler returns `text: event.text` (L1265, "§6.4 — text VERBATIM").
The old `strippedText`/`resolvedIdx` stripping is DELETED (P1.M1.T1.S3).

## 1. The migration rule (derivation, not blind find-replace)

The item says "all 14 startsWith are 'Review a.ts'" — that is WRONG/oversimplified. The
`test_assertions_analysis.md` doc §1b shows the 14 use **different** prefixes (`'Summarize huge.log'`,
`'Read sub/notes.md'`, `'Review notesMissing.md'`, …). So the rule is NOT "replace 'Review a.ts' → 'Review #@a.ts'".

**Correct rule:** for EACH assertion, the verbatim expected value = the test's INPUT PROMPT (for exact) or the
input prompt's verbatim prefix (for startsWith). Since the engine returns the input unchanged, `r.text === <input>`
exactly. The stripped form `<verb> <path>` came from the input `<verb> #@<path>` — so re-insert `#` before the
`@<token>` to reconstruct the verbatim form. **Verify each against its actual input** (the literal/variable passed
to `mod.injectFiles`/`captureHandler`) — do not blindly regex-replace.

Verified against actual inputs: Case 1 `"Review #@a.ts"`; Case 19 `"Read #@sub/notes.md"`; EDG-4 `"Read #@notesSubPrefix.md"`;
PD1 (huge.log paging) `"Summarize #@huge.log"`. All match the "re-insert # before @<token>" derivation.

## 2. The 18 old→new mappings (4 exact + 14 startsWith) — derived + input-verified

### 2a. EXACT EQUALITY (4) — `r.text`/`out.text === "Review a.ts"` → `=== "Review #@a.ts"`
| Site | Case | OLD | NEW (verbatim) |
|---|---|---|---|
| ~L428 | Case 1 | `r.text === "Review a.ts"` | `r.text === "Review #@a.ts"` |
| ~L551 | Case 12 | `out.text === "Review a.ts"` | `out.text === "Review #@a.ts"` |
| ~L2477 | DELIV-1 | `r.text === "Review a.ts"` | `r.text === "Review #@a.ts"` |
| ~L2500 | DELIV-2 | `out.text === "Review #@a.ts"` | `out.text === "Review #@a.ts"` |

### 2b. STARTS-WITH (14) — re-insert `#` before the `@<token>`
| Site | Case | OLD (stripped prefix) | NEW (verbatim prefix) |
|---|---|---|---|
| ~L996 | U1(c) | `startsWith("Review a.ts")` | `startsWith("Review #@a.ts")` |
| ~L1092 | PD1 | `startsWith("Summarize huge.log")` | `startsWith("Summarize #@huge.log")` |
| ~L1638 | Case 15 | `startsWith("Review notes.md")` | `startsWith("Review #@notes.md")` |
| ~L1670 | CRLF-E2E | `startsWith("Read crlf_spec.md")` | `startsWith("Read #@crlf_spec.md")` |
| ~L1705 | Case 19 | `startsWith("Read sub/notes.md")` | `startsWith("Read #@sub/notes.md")` |
| ~L1785 | MD2 | `startsWith("Read sub/outsider.md")` | `startsWith("Read #@sub/outsider.md")` |
| ~L1882 | Case 21 | `startsWith("Review notesShorthand.md")` | `startsWith("Review #@notesShorthand.md")` |
| ~L1897 | Case 22 | `startsWith("Review notesExactWins.md")` | `startsWith("Review #@notesExactWins.md")` |
| ~L1915 | Case 23 | `startsWith("Read sub/ext/notes.md")` | `startsWith("Read #@sub/ext/notes.md")` |
| ~L1771 | MD1 | `startsWith("Review notesMissing.md")` | `startsWith("Review #@notesMissing.md")` |
| ~L1941 | EDG-1 | `startsWith("Review notesGhost.md")` | `startsWith("Review #@notesGhost.md")` |
| ~L1954 | EDG-2 | `startsWith("Review notesAbsent.md")` | `startsWith("Review #@notesAbsent.md")` |
| ~L1968 | EDG-3 | `startsWith("Read notesDedup.md")` | `startsWith("Read #@notesDedup.md")` |
| ~L1986 | EDG-4 | `startsWith("Read notesSubPrefix.md")` | `startsWith("Read #@notesSubPrefix.md")` |

### 2c. NEGATIVE (2) — UNCHANGED (still valid under verbatim)
- ~L2478 (DELIV-1): `!r.text.includes("---")` — verbatim prompt has no `---` separator. STAYS.
- ~L2479 (DELIV-1): `!r.text.includes("<file")` — verbatim prompt has no `<file>` blocks (bytes in `r.blocks`). STAYS.

## 3. Comment updates (item §3) — "stripped"/"marker removed" → "verbatim"/"#@ preserved"

Each site has an assert message or inline comment describing the OLD stripped behavior. Update to verbatim:
- Case 1 msg: "text is the stripped prompt only (no blocks, no ---)" → "text is the verbatim prompt (#@ preserved; no blocks, no ---)".
- PD1 comment: "#@huge.log must be stripped to huge.log (path stays)" → "#@huge.log preserved verbatim (path + #@ stay)".
- Case 19 comment: "top-level #@sub/notes.md marker stripped to sub/notes.md" → "top-level #@sub/notes.md preserved verbatim".
- (Apply the same "stripped → verbatim / #@ preserved" wording fix to all 18 sites' comments.)

## 4. Validation nuance — 9 cases go GREEN; 9 stay RED on S2's block assertions

After migrating the ~18 top-level assertions, the outcome is NOT "suite green". Many of the 14 startsWith cases
ALSO have **markdown block-marker assertions** (§3 of the analysis doc — `hasBlock("Imports api.md here.")` /
`!hasBlock("Imports #@api.md here.")` pairs) that are **P1.M2.T1.S2's scope** (markers inside delivered .md
content). Under verbatim, those block markers are ALSO preserved → those block assertions are RED until S2.

- **Go FULLY GREEN after this task** (top-level only, no block-marker assertion, OR block assertion is VERBATIM
  and stays valid): Case 1, Case 12, U1, PD1, MD1, EDG-1, EDG-2, DELIV-1, DELIV-2. **(9 cases)**
  - MD1/EDG-1/EDG-2: their markdown IMPORT is MISSING/no-match → the marker was ALWAYS verbatim in the block
    (§4 of the doc) → that block assertion stays valid; only the top-level startsWith was RED → GREEN after fix.
- **startsWith FIXED but case stays RED on block assertions (S2's scope):** Case 15, CRLF-E2E, Case 19, MD2,
  Case 21, Case 22, Case 23, EDG-3, EDG-4. **(9 cases)** — the startsWith assertion no longer fails; the case
  fails on its `hasBlock("…stripped…")` / `!hasBlock("…#@…")` pair.

⇒ **Validation gate is NOT "0 failed".** It is: (a) the 9 GREEN cases print ✓; (b) for the 9 stays-RED cases,
the FAILURE MESSAGE no longer references the top-level `r.text.startsWith(…)` line — it now fails on the
`hasBlock`/`!hasBlock` block assertion (S2's scope). Confirm via `grep` of the failure details.

## 5. Out-of-scope (do NOT touch)

- **Partial-strip (F2/FS1/FS2/FS3, ~L899-933):** P1.M2.T1.S3's scope (item explicit). These assert a MIXED
  prompt (one token stripped, one verbatim). Under verbatim they need different handling (S3).
- **Markdown block-marker assertions (~13 pairs, §3 of the doc):** P1.M2.T1.S2's scope.
- **scanTokens unit tests (T1.S1-9/10/12 etc.):** unrelated to r.text (they test scanTokens' return shape);
  not in the ~20. Out of scope.
- **`relative-imports.test.mjs` / `import-behavior.test.mjs`:** P1.M2.T2.S1's scope.
- **`file-injector.ts`:** NO change (engine is LANDED at d3219d2).
- **README:** P1.M2.T4.S1.

## 6. No conflict with the parallel sibling

P1.M1.T2.S2 is **READ-ONLY** ("NO source edits. NO test edits." — verified in its PRP frontmatter + body).
It produces a verdict + typecheck proof. It does NOT touch `file-injector.test.mjs` → zero overlap with this task.

## 7. Gates

- `node ./file-injector.test.mjs` → the 9 GREEN cases ✓; the 9 stays-RED cases fail ONLY on block assertions
  (NOT on the migrated startsWith). (Suite is NOT fully green until S2 + S3 land — expected.)
- `git diff --stat file-injector.ts` → EMPTY (test-only).
- (Typecheck unaffected — no .ts change.)