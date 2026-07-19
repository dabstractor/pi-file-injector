# Research Notes — P1.M2.T1.S3 (plan 009)

## Task: Migrate partial-strip (F2/FS1/FS2/FS3) + verify verbatim-prompt (~13) assertions

Test-only migration in `file-injector.test.mjs`. Engine (P1.M1) + S1 (top-level startsWith,
commit 8d474d9) are LANDED. S2 (hasBlock pairs) is running in parallel (disjoint line ranges).

---

## 1. Engine contract (LANDED — verified, read-only)

`injectFiles` (`file-injector.ts:1111`) returns `r.text` = the ORIGINAL prompt VERBATIM in BOTH
branches (P1.M1.T1.S3 deleted the `strippedText` bookkeeping):
- L1179: `if (state.count === 0) return { text, ... }` — nothing injected → `text` unchanged.
- L1188: `return { text, images: state.images, injected: state.count, ... }` — injected → `text`
  is STILL the unmodified input prompt (the `text` variable was never reassigned to a stripped form).

Input handler (`file-injector.ts:1265`):
`return { action: "transform", text: event.text, images }` — VERBATIM (§6.4/§13.8).

⇒ **`r.text` is byte-for-byte the input prompt, always** — whether 0 or N files injected.
This is the single fact the partial-strip migration encodes: the old "injected marker stripped,
failed marker kept #@" asymmetry NO LONGER EXISTS — every marker is verbatim.

---

## 2. Scope: the 4 PARTIAL-STRIP cases (my migration) — CURRENT verified lines

Prompts + current assertions (read from working tree HEAD 8d474d9):

### F2 (runCase L890; prompt L896; assert L899)
- prompt: `const prompt = '<!--#@file-injected--> Review #@a.ts';`
- L899 (RED): `assert(r.text.startsWith('<!--#@file-injected--> Review a.ts'), "only the injected #@a.ts is stripped (→ a.ts); the failed sentinel token keeps its #@ verbatim (Issue 2 fix)");`
- → NEW: `r.text.startsWith('<!--#@file-injected--> Review #@a.ts')` — the injected `#@a.ts` now
  KEEPS `#@` (both tokens verbatim). reword msg: drop "stripped (→ a.ts)"; both verbatim (§6.4).

### FS1 (runCase L912; prompt L913; asserts L915-916)
- prompt: `"Review #@a.ts and check #@missing.ts"`
- L915 (RED): `assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");`
- L916 (PASS): `assert(r.text.includes("#@missing.ts") === true, ...)` — STAYS (already verbatim).
- → NEW L915: `r.text.startsWith("Review #@a.ts")` (both verbatim); reword msg.

### FS2 (runCase L921; prompt L922; asserts L924-925)
- prompt: `"Review #@a.ts and list #@src/"`
- L924 (RED): `assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");` — **IDENTICAL to L915**
- L925 (PASS): `assert(r.text.includes("#@src/") === true, ...)` — STAYS.
- → NEW L924: `r.text.startsWith("Review #@a.ts")`; reword msg.

### FS3 (runCase L928; prompt L929; assert L933)
- prompt: `"Compare #@a.ts with #@a.ts"` (two identical tokens)
- L933 (RED): `assert(r.text.startsWith("Compare a.ts with #@a.ts"), ...)` — first was stripped,
  deduped second kept `#@`.
- → NEW: `r.text.startsWith("Compare #@a.ts with #@a.ts")` (BOTH verbatim — first keeps `#@` now;
  deduped second was always verbatim). Exact-equality `r.text === "Compare #@a.ts with #@a.ts"`
  is ALSO valid (prompt is exactly that string) and slightly stronger; either passes.

### CRITICAL gotcha: L915 and L924 are byte-identical lines
`assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");` appears at
BOTH L915 (FS1) and L924 (FS2). The edit tool requires a UNIQUE oldText ⇒ each edit MUST include a
disambiguating neighbor line:
- FS1 (L915): include L916 (`assert(r.text.includes("#@missing.ts") ...)`) as the trailing context.
- FS2 (L924): include L925 (`assert(r.text.includes("#@src/") ...)`) as the trailing context.
Alternatively, edit each 2-line block (L915-916, L924-925) as a unit. Do NOT use a find-replace
that hits both (it would, but produces the same result — safe; still, text-based uniqueness is the
tool constraint).

---

## 3. Scope: the ~13 VERBATIM-PROMPT cases (VERIFY ONLY — no change)

Already `r.text === "<prompt with #@>"` (exact equality). All PASS at HEAD (none in failure list).
Source: architecture/test_assertions_analysis.md §2. CURRENT verified lines:

| Line | Case | Assertion |
|------|------|-----------|
| 481 | Case 5 | `r.text === "Fix #@nope.ts"` (missing) |
| 489 | Case 6 | `r.text === "List #@src/"` (directory) |
| 496 | Case 7 | `r.text === "the foo#@bar thing"` (mid-word) |
| 503 | Case 8 | `r.text === "# Heading and #1234"` (no #@) |
| 588 | Case 14 | `r.text === "Review @a.ts"` (bare @) |
| 628 | E3 | `r.text === "\`code #@a.ts\`"` (fenced) |
| 643 | E4 | `r.text === "Read #@secret.txt"` (unreadable) |
| 988 | U1(a) | `r.text === "café#@a.ts"` (Unicode) |
| 992 | U1(b) | `r.text === "日本語#@a.ts"` (CJK) |
| 1005 | U1(e) | `r.text === "foo#@bar"` (ASCII mid-word) |
| 1932 | Case 24 | `r.text === "See #@specdoc"` (exact-only) |
| 2013 | ISS1-TL | `r.text === "Compare #@iss1_report.md.backup with the latest"` (extended token) |
| 2416 | Case 28 | `r.text === "Read @other.md"` (top-level bare-@) |

⇒ These encode "nothing injected / only failed tokens → prompt byte-for-byte unchanged". They are
ALREADY correct under verbatim and need NO edit. Verification = confirm they're in the PASS list
after the 4 partial-strip edits. If any FAILS, the engine regressed (a prompt with no resolved token
was modified) — escalate, do NOT patch the assertion.

(Note: L428 Case 1 `r.text === "Review #@a.ts"` and L2477 DELIV-1 are top-level INJECTION cases that
S1 already migrated to verbatim — not in the §2 verify set, but they're green and confirm the
injection path is also verbatim.)

---

## 4. Out of scope (DO NOT TOUCH) — explicit boundaries

- **F1 / F1b / F1d (runCase L759 / L786 / L817):** dedup-across-passes tests. Their premise
  ("stripping #@ post-inject makes dedup bidirectional" — F1d's literal title) is a SEPARATE
  engine-behavior concern, NOT a partial-strip assertion. They remain RED after S3 (expected).
  Belongs to a dedup/re-open task (likely P1.M2.T3), not this migration.
- **scanTokens unit tests T1.S1-9 / T1.S1-10 / T1.S1-12:** return-shape (`scanTokens → string[]`);
  separate concern. Remain RED.
- **S2's hasBlock pairs (Cases 15/CRLF-E2E/19/20/MD2/21/22/23/EDG-3/EDG-4/26/27/M2.T2.S1-g at
  L1644+):** S2 (parallel) owns these. My lines (L890-933) are DISJOINT from S2's (L1644+) — no
  overlap, edits compose cleanly.
- **The §4 verbatim-block assertions** (E5/Case16/17/18/MD1/EDG-1/EDG-2/ISS1-MD/Case25/etc.):
  always-correct block-content checks. Untouched.
- **file-injector.ts, relative-imports.test.mjs, import-behavior.test.mjs, README.md, PRD.md:**
  untouched (git diff empty for all but file-injector.test.mjs).

---

## 5. Baseline + expected counts (parallel-aware)

Current baseline (HEAD 8d474d9, S1 landed; S2 + S3 NOT yet landed): **127 passed, 23 failed.**
The 23 failures = F1, F1b, F1d, F2, FS1, FS2, FS3, case15, CRLF-E2E, case19, case20, MD2, case21,
case22, case23, EDG-3, EDG-4, T1.S1-9, T1.S1-10, T1.S1-12, case26, case27, M2.T2.S1-g.

S3 fixes exactly 4: **F2, FS1, FS2, FS3 → ✓.**
- If S3 lands BEFORE S2: failures 23 → 19 (the 13 hasBlock cases remain RED until S2).
- If S3 lands AFTER S2 (S2 LANDED): failures 10 → 6. Remaining 6 = F1, F1b, F1d, T1.S1-9,
  T1.S1-10, T1.S1-12 (all out of scope).

The implementer must verify the 4 partial-strip cases go ✓ AND the 13 verbatim-prompt cases stay ✓,
regardless of S2's state. (grep the ✓/✗ lines for F2/FS1/FS2/FS3 + the 13 verbatim cases.)

---

## 6. Harness & helpers (unchanged)

- `runCase(n, name, fn)` (L90) / `assert(cond, msg)` (L81): zero-deps .mjs; gate = `node ./file-injector.test.mjs`.
- `hasBlock(r, needle)` / `blocksText(r)` / `countFileBlocks(text, abs)` (L~188-205): read r.blocks.
  Not used by the partial-strip assertions (they read `r.text`).
- Mode A: `mod.injectFiles(prompt, imagesIn, ctx, bareAt)` → `{text, images, injected, paged, blocks, details}`.
- All 4 partial-strip cases use Mode A (direct pipeline) with `FIX = { cwd: TMPDIR }` (no budget →
  all whole). F2 also has a handler-level sub-check (captureHandler) that asserts `out.action ===
  "transform"` — UNAFFECTED (it checks action, not text).

---

## 7. The key conceptual insight (for the comment rewords)

The old "partial-strip asymmetry" was: in a prompt with TWO `#@` tokens, only the one that
ACTUALLY injected had its `#@` stripped; the failed/directory/deduped one kept `#@`. This was the
"Issue 2" regression guard (don't strip `#@` from tokens that didn't inject).

Under verbatim delivery (PRD §6.4/§13.8): **there is no stripping at all.** Every `#@` marker
survives — injected, failed, directory, deduped, all verbatim. The `r.text` is the input prompt
byte-for-byte. So:
- F2: `r.text === '<!--#@file-injected--> Review #@a.ts'` (input verbatim).
- FS1: `r.text === "Review #@a.ts and check #@missing.ts"` (input verbatim).
- FS2: `r.text === "Review #@a.ts and list #@src/"` (input verbatim).
- FS3: `r.text === "Compare #@a.ts with #@a.ts"` (input verbatim).

The startsWith assertions become trivially true (prefix of the unchanged prompt). The `includes`
checks (L916 `#@missing.ts`, L925 `#@src/`) were ALREADY verbatim-correct and stay.

Comment reword: remove "stripped to a.ts" / "only the injected ... is stripped" / "first stripped,
deduped second keeps #@" language. New: "prompt delivered verbatim — all #@ markers preserved
(§6.4); injected, failed, and deduped tokens alike keep their #@". For FS3: "both tokens verbatim
(dedup affects injection count, not the prompt)".

---

## 8. Confidence

9/10. A precise, well-bounded migration: 4 assertions (exact old→new derived from each prompt's
literal text, line-verified at HEAD), the engine contract confirmed (r.text verbatim in both
branches), the 13 verbatim-prompt cases confirmed already-passing, out-of-scope boundaries explicit
(F1/F1b/F1d dedup; scanTokens; S2's disjoint lines). The -1 reserves for: (a) the L915/L924
identical-line disambiguation (mitigated by including the following includes() line as context), and
(b) parallel-ordering uncertainty in the failure-count assertion (23→19 if before S2; 10→6 if after —
the PRP gives both so the implementer can verify either way).