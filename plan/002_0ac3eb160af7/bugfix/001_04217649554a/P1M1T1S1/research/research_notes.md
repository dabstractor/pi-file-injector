# Research Notes — P1.M1.T1.S1 (within-run dedup set in injectFiles — Issue 1)

## Task scope (Issue 1 ONLY — within-prompt same-path dedup; TDD)
A file referenced by >1 `#@` token in ONE prompt is currently injected for every occurrence (bug).
Fix: add a SEPARATE within-run Set (`injectedThisRun`) checked at the top of the loop, populated
after EACH successful inject. Do NOT mutate `priorPaths` (F1c invariant). TDD: add 3 failing
regression tests first, implement, tests pass.

OUT OF SCOPE (separate subtasks):
- S2: Issue 2 — failed-token `#@` stripping in MIXED prompts (the blanket `text.replace(FILE_INJECT_RE,…)`
  post-loop). DO NOT touch the stripping/assembly in S1.
- P1.M2: Issues 3 (notify wording) & 4 (paged directive offset).
- P1.M3: README sync.

## CONFIRMED LIVE (this machine, against current file-injector.ts via jiti)
- 'Compare #@a.ts with #@a.ts' → injected===2, TWO <file> blocks (BUG; should be 1/1 after fix).
- 'See #@pic.png and #@pic.png' → images.length===2 (BUG; should be 1 after fix).
- (per bug report) '#@a.ts' + '#@./a.ts' (two path forms, same abs) → 2 blocks (BUG; 1 after fix).
After the fix these become 1/1, 1, and 1 respectively. → regression tests are MEANINGFUL.

## Root cause (confirmed, code_changes_analysis.md Issue 1)
`priorPaths` (Set<string>) is built ONCE before the loop from `<file name="…">` blocks already in
the INPUT text (L183-186). The in-loop guard `if (priorPaths.has(abs)) continue;` (L199) reads it,
but NOTHING adds to it after a successful injection. So a repeat of the same resolved abs later in
the same prompt re-injects. Fix = a SEPARATE `injectedThisRun` set (keep priorPaths untouched so the
"prior block for X doesn't block NEW path Y" F1c invariant holds).

## Verified control flow — EXACTLY 2 count++ sites (covers all 5 inject branches)
All 5 inject paths (text-inline, paged-text, image, binary, empty-image) flow to exactly TWO `count++`
statements:
- L219: empty-image branch — `blocks.push(formatEmptyImageBlock(abs)); count++; continue;`
- L259: end-of-try `count++` — reached by image, binary, text-inline, AND paged (the paged branch does
  `paged++` at L254 then falls through to L259). So paged files ARE counted in both `count` and `paged`.
=> Add `injectedThisRun.add(abs);` immediately before EACH of those 2 count++ statements. This covers
   all 5 inject branches with the minimal 2 insertions. (Do NOT add a separate add in the paged branch —
   it reaches L259, so the L259 add covers it.)

## Exact edit anchors (current HEAD; verified via sed)
- L183-188: priorPaths declaration + main loop start. Insert `const injectedThisRun = new Set<string>();`
  AFTER the priorPaths loop's closing `}` (L186), before the blank + main FILE_INJECT_RE loop (L188).
- L199: `if (priorPaths.has(abs)) continue;` → widen to `if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;`
- L218-221 (empty-image): `blocks.push(formatEmptyImageBlock(abs));\n        count++;` → insert
  `injectedThisRun.add(abs);` BEFORE `count++;`.
- L259 (end-of-try): `      count++;` (the last stmt in the try, before `} catch {`) → insert
  `injectedThisRun.add(abs);` BEFORE it.
- DO NOT mutate priorPaths. DO NOT change the L266 `if (count === 0) return {...}` early return.
  DO NOT touch the post-loop stripping (Issue 2 / S2).

## F1c invariant (MUST still pass after S1)
F1c (test L540): prior `<file name="A_TS">` in input + a NEW `#@b.ts` token → must inject b.ts (1 block)
and NOT re-inject a.ts. Because `injectedThisRun` is SEPARATE from `priorPaths` and only tracks THIS
run's injections, F1c is unaffected: priorPaths still blocks only input-text paths; injectedThisRun
blocks only same-run repeats. b.ts is new in both sets → injects. ✓

## Test harness conventions (for the 3 new regression cases)
- Run: `node ./file-injector.test.mjs` → exits 0 iff all pass. Baseline NOW: 43 passed, 0 failed.
  After S1: 43 existing + 3 new = 46 passed, 0 failed.
- Reuse: `FIX = { cwd: TMPDIR }`, fixtures `a.ts`/`b.ts`/`pic.png`, constants `A_TS`/`B_TS`/`PIC`
  (PIC = path.join(TMPDIR,"pic.png"), a valid PNG so hasValidImageMagic passes → image branch).
- Counting <file> blocks (escape the abs path for RegExp):
  `(r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length`
- Image count: `r.images.length`.
- Existing dedup cluster: F1 (L501), F1b (L528), F1c (L540), F1d (L558). Add the 3 new cases right
  after F1d (keeps dedup cases grouped). Suggested labels: "DUP1"/"DUP2"/"DUP3" (or F1e/F1f/F1g).

## 3 regression test cases (assert injected/block/image count ONLY — NOT stripping; stripping is S2)
- DUP1: `mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX)` → `r.injected === 1` AND exactly ONE
  `<file name="A_TS">` block.
- DUP2: `mod.injectFiles("Diff #@a.ts against #@./a.ts", [], FIX)` (two path forms → same abs) →
  exactly ONE `<file name="A_TS">` block (and r.injected === 1).
- DUP3: `mod.injectFiles("See #@pic.png and #@pic.png", [], FIX)` → `r.images.length === 1` (and
  exactly ONE `<file name="PIC">` reference block).

## Issue 1 × Issue 2 interaction (NOT asserted in S1 — deferred to S2's tests)
After BOTH issues fixed, a deduped 2nd token keeps its `#@` (it "did not inject"). For
`Compare #@a.ts with #@a.ts` the FINAL text is `Compare a.ts with #@a.ts` + one block. But in S1
the stripping is still the blanket replace, so BOTH `#@` get stripped → `Compare a.ts with a.ts`.
=> S1's regression tests assert ONLY injected count + block/image count, NOT the `#@`-stripping of
   the deduped token. (S2 changes stripping + adds the interaction assertion.)

## Pi version
`@earendil-works/pi-coding-agent` v0.80.7 (global).
