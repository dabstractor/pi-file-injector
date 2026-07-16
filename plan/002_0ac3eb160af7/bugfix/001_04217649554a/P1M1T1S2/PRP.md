---
name: "P1.M1.T1.S2 — Strip #@ only from actually-injected tokens via index-based splice, leaving failed tokens verbatim (Issue 2)"
prd_ref: "Bug-fix PRD §Overview, §Issue 2 (failed-token #@ stripping in mixed prompts violates PRD §6.2), §Testing Summary"
target_files: "./file-injector.ts" (4 edits) + "./file-injector.test.mjs" (update F2 + add 3 regression cases)
change_type: surgical (1 array decl + 2 index pushes + 1 strip-line rewrite) + test update/additions
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1 — CONFIRMED IN FILE: injectedThisRun set + 2 add(abs) success sites (L192, L205, L225, L266)"
fixes: "Issue 2 (failed #@ tokens stripped in mixed prompts). Issue 1 stays fixed via S1."
---

# PRP — P1.M1.T1.S2: Index-Based `#@` Stripping (Issue 2)

## Goal

**Feature Goal**: Fix Issue 2 — when a prompt contains ≥1 *successful* `#@` token AND ≥1 *failed*
token (missing file / directory / read error), the post-loop blanket `text.replace(FILE_INJECT_RE, …)`
currently strips `#@` from EVERY token (including failed ones), violating PRD §6.2 ("tokens that did
not inject are left byte-for-byte verbatim, `#@` included"). Replace the blanket strip with an
**index-based splice**: record `m.index` at each actually-injected success site, then remove exactly
the 2 chars `#@` at each recorded index (processing high→low). Failed tokens and deduped repeats keep
their `#@` verbatim.

**Deliverable**: Four surgical edits to `./file-injector.ts` (declare `injectedIndexes`; push
`m.index` at the 2 success sites S1 already instrumented with `injectedThisRun.add(abs)`; rewrite the
strip line) **plus** update the F2 test (which currently asserts the bug) and add 3 new regression
cases (FS1 mixed-success+missing, FS2 mixed-success+directory, FS3 Issue1×Issue2 interaction). No new
files. The existing 46-case suite stays green → **49 passed, 0 failed**.

**Success Definition**:
- [ ] `const injectedIndexes: number[] = [];` is declared alongside `injectedThisRun` (post-S1 L192).
- [ ] `injectedIndexes.push(m.index);` is added at BOTH success sites (empty-image L225 + end-of-try
      L266), immediately after each `injectedThisRun.add(abs);`.
- [ ] The blanket strip line (`text.replace(FILE_INJECT_RE, (_m,_boundary,path)=>path)`) is REPLACED by
      the index-based splice: `let strippedText = text; for (i of [...injectedIndexes].sort((a,b)=>b-a))
      strippedText = strippedText.slice(0,i) + strippedText.slice(i+2);`. `finalText` assembly unchanged.
- [ ] Only actually-injected tokens lose `#@`; failed tokens (missing/dir/error) and deduped repeats
      keep `#@` byte-for-byte.
- [ ] F2 updated (failed sentinel token now keeps `#@`); FS1/FS2/FS3 added. Harness = **49/0**.
- [ ] A one-off verification script (below) proves: mixed success+failed → only the injected token is
      stripped; the substring collision (`#@a.ts` ⊂ `#@a.ts.bak`) is handled correctly by the splice.

> **Scope boundary (read carefully):** This subtask fixes **Issue 2 ONLY** via the index-splice. It
> does **NOT**: (a) touch Issue 1's dedup (`injectedThisRun`/`priorPaths`) beyond adding index pushes
> at the same 2 sites — S1 owns dedup; (b) use the substring `text.replace(whole, whole.slice(2))`
> approach — **FORBIDDEN** (empirically corrupts when one match is a prefix of another); (c) change the
> notify wording (Issue 3, P1.M2.T1), the paged directive offset (Issue 4, P1.M2.T2), the budget logic,
> the `count===0` early-return, image/binary/paged handling, or any format helper; (d) edit the README
> (P1.M3). The `count===0` path already returns original text byte-for-byte and is UNCHANGED.

## User Persona

**Target User**: End users who write a prompt mixing a real file reference with one that fails to
resolve — e.g. `Review #@a.ts and also check #@notes-old.md` (where `notes-old.md` was deleted), or
`#@a.ts and list #@src/` (a directory). Today both failed tokens silently lose their `#@`, so the
model can't tell a file-injection was *attempted and failed*.

**Use Case**: After this fix, the model sees `Review a.ts and also check #@notes-old.md` — the
injected `a.ts` content arrives inline (stripped trigger), while the failed `#@notes-old.md` keeps its
`#@` so the model can react (call `read`, ask the user, etc.) per PRD §6.2.

**Pain Points Addressed**: Silent loss of the `#@` signal on failed tokens in mixed prompts — the
opposite of PRD §6.2's "verbatim, `#@` included" guarantee. Also fixes the spec-violating
information loss (the model can no longer distinguish "user mentioned a path" from "nothing happened").

## Why

- **Issue 2 is a Major spec-compliance bug.** PRD §6.2 + §10 explicitly require failed tokens to stay
  verbatim with `#@`. The single-failed-token case already works (count===0 → original text), but the
  MIXED case (the common real-world scenario) strips every `#@`.
- **Root cause is a blanket replace.** `text.replace(FILE_INJECT_RE, (_m,_boundary,path)=>path)` runs
  only when count>0 and strips `#@` from all matches indiscriminately. It cannot tell injected from
  failed.
- **The fix is precise and collision-free.** Record each injected token's `m.index` (group 1 of
  `FILE_INJECT_RE` is zero-width → `m.index` is exactly the `#`), then splice out exactly 2 chars at
  each recorded index, high→low. The substring alternative is rejected (prefix-collision corruption).

## What

Four edits to `file-injector.ts` + F2 update + 3 new test cases. Image/binary/paged/dedup/budget paths
are untouched. The `count===0` early-return is untouched.

### Success Criteria

- [ ] Mixed success+missing: `Review #@a.ts and check #@missing.ts` → `r.text.includes("#@missing.ts")`
      AND `r.text.startsWith("Review a.ts")`.
- [ ] Mixed success+directory: `Review #@a.ts and list #@src/` → `r.text.includes("#@src/")`.
- [ ] Issue1×Issue2: `Compare #@a.ts with #@a.ts` → `r.text.startsWith("Compare a.ts with #@a.ts")` +
      exactly one `<file>` block + `injected===1` (deduped 2nd token keeps `#@`).
- [ ] Substring-collision safe: an injected `#@a.ts` whose match string is a prefix of a failed
      `#@a.ts.bak` does NOT corrupt the longer token (Level-3 script).
- [ ] All existing 46 cases pass (F2 updated); 3 new FS cases pass → **49 passed, 0 failed**.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact current line numbers (post-S1, file is 395
> lines), every edit as a unique-text old→new block, the empirically-verified substring-collision
> failure (with the exact "backwards" output), the empirically-verified index-splice correctness, the
> regex geometry proof (zero-width group 1 ⇒ `m.index` is the `#`), the verbatim F2 update + 3 new test
> cases, and a confirmed-live bug reproduction. The "must-not-break" risk scan (only F2 asserts the
> buggy strip) is included.

### Documentation & References

```yaml
# MUST READ — sibling PRP (the dedup instrumentation S2 builds on; the CONTRACT)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M1T1S1/PRP.md
  why: "Defines injectedThisRun (L192), the widened dedup guard (L205), and the 2 add(abs) success
        sites (empty-image L225, end-of-try L266). CONFIRMED already in the file. S2 pushes m.index at
        those SAME 2 sites and rewrites the strip line (L280)."
  critical: "Do NOT touch injectedThisRun/priorPaths/dedup guard. S2 ADDS injectedIndexes + 2 pushes +
        1 strip rewrite. The 2 sites cover all 5 inject branches (same reasoning as S1's add() calls)."

# MUST READ — exact change sites + verified fix strategy
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/code_changes_analysis.md
  why: "§'Issue 2' pins the root cause (blanket replace), the RECOMMENDED index-splice fix, WHY the
        substring approach is rejected (prefix collision: '#@a.ts' ⊂ '#@a.ts.bak'), the regex facts
        making m.index reliable, the F2 test update, and the Issue1×Issue2 interaction (deduped 2nd
        token keeps #@)."
  critical: "Use the index-splice, NOT substring replace. Sort injectedIndexes descending and splice
        right→left so earlier offsets stay valid. The item's injectedIndexes:number[] (just indices,
        always splice 2 chars) is authoritative over the doc's {index,len} sketch — len is always 2."

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/external_deps.md
  why: "§2 'FILE_INJECT_RE match geometry' VERIFIES group 1 is zero-width → m.index is exactly the '#'
        and m[0] is exactly '#@<rawtoken>'. §5 documents the harness load mechanism (jiti + alias)."
  section: "§2, §5"

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/system_context.md
  why: "Confirms the live bug reproduction (mixed prompts strip failed #@) and the test landscape."
  section: "Issue 2"

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/prd_snapshot.md
  why: "Bug-fix PRD — §Issue 2 (the §6.2 violation) and §Testing Summary (why F2 enforced the bug and
        why mixed prompts were untested)."
  section: "§Issue 2, §Testing Summary"

# The files being EDITED
- file: ./file-injector.ts
  why: "Edit A (injectedIndexes decl after L192), Edit B (push m.index at L225 empty-image), Edit C
        (push m.index at L266 end-of-try), Edit D (rewrite strip line L280). The count===0 early-return
        (L278) and the finalText assembly (L281) are UNCHANGED."
  pattern: "Match the repo's terse inline-comment style (cite Issue 2 / PRD §6.2). The index push sits
        immediately after each injectedThisRun.add(abs); the splice replaces the one blanket-replace line."
  gotcha: "Use slice(0,i)+slice(i+2) (drop EXACTLY 2 chars '#@'); sort indices DESCENDING before
        splicing so earlier offsets stay valid. NEVER use text.replace(whole, whole.slice(2)) — it
        corrupts on prefix collisions (empirically confirmed)."

- file: ./file-injector.test.mjs
  why: "Update F2 (L636 assertion + comment); add FS1/FS2/FS3 after the F2 block. Run
        `node ./file-injector.test.mjs` → must be 49/49."
  pattern: "await runCase('FSx', 'label', async () => { const r = await mod.injectFiles(...); assert(...); });"
  gotcha: "Reuse FIX={cwd:TMPDIR}, A_TS, SRC fixtures. F2's handler-level assert (out.action===transform)
        is UNCHANGED. Risk scan: only F2 asserts blanket-strip of a FAILED token — no other test breaks."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDIT (4 edits in injectFiles, L192/225/266/280). No behavior change for pure-success or pure-fail prompts.
├── file-injector.test.mjs       # ← EDIT (update F2 L636 + add FS1/FS2/FS3 after F2). 46 → 49 cases.
├── PRD.md / README.md           # READ-ONLY here (README sync is P1.M3)
└── plan/002_0ac3eb160af7/bugfix/001_04217649554a/
    ├── architecture/{code_changes_analysis.md, external_deps.md, system_context.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # the dedup contract (read it)
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — +injectedIndexes decl, +2 m.index pushes, blanket strip → index-splice.
└── file-injector.test.mjs       # MODIFIED — F2 assertion/comment updated (failed token keeps #@); +3 FS cases.
# No new files. No dedup/notify/paged-directive/budget/format-helper changes. No README (P1.M3).
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — NEVER use the substring approach `text.replace(whole, whole.slice(2))`. Empirically
// confirmed corruption: an injected '#@a.ts' is a prefix of a failed '#@a.ts.bak'; replace() matches
// the FIRST occurrence of the literal substring, lands inside the longer token, and corrupts it
// (failed token loses #@, injected token KEEPS #@ — backwards). Use the INDEX-SPLICE.

// CRITICAL — sort injectedIndexes DESCENDING ((a,b)=>b-a) and splice right→left. Each splice shifts
// only chars to the RIGHT of the index, so processing high→low keeps lower (earlier) indices valid.

// CRITICAL — slice(0, i) + slice(i + 2) drops EXACTLY the 2 chars '#@'. Group 1 of FILE_INJECT_RE is
// zero-width, so m.index is exactly the '#' and m[0] is exactly '#@'+rawtoken. No leading-char math.

// CRITICAL — push m.index ONLY at the 2 success sites (empty-image L225, end-of-try L266) — the SAME
// lines where S1 added injectedThisRun.add(abs). Failed tokens (missing/dir/error) `continue` before
// any push; deduped repeats `continue` at the widened guard (L205) before any push. So their indices
// are never recorded → they keep '#@'. Do NOT add a 3rd push in the paged branch (it reaches L266).

// GOTCHA — matchAll is NON-DESTRUCTIVE on the original text, so each m.index is valid for the ORIGINAL
// text. We splice a COPY (strippedText) high→low, so the recorded indices stay correct.

// GOTCHA — the count===0 early-return (L278) is UNCHANGED. It returns original text byte-for-byte,
// which is already correct for pure-fail prompts. The index-splice only runs when count>0 (L280+).

// NO TYPE-CHECK — jiti transpiles only. injectedIndexes:number[] is erased at load. The harness imports
// the real .ts via jiti+alias; no model/API key needed.
```

## Implementation Blueprint

### Data models and structure

One new local: `const injectedIndexes: number[] = [];` inside `injectFiles` (alongside
`injectedThisRun`). No type/signature change (the return shape `{ text, images, injected, paged }` is
unchanged). The array is purely internal bookkeeping for precise `#@` removal.

### Implementation Tasks (ordered by dependencies)

```yaml
PRE-FLIGHT:
  - VERIFY S1 present: `grep -c "injectedThisRun" file-injector.ts` → >= 4 (decl + guard + 2 adds).
    If absent, STOP (S1 not done — S2 depends on its 2 success sites).
  - RECORD baseline: `node ./file-injector.test.mjs` → "46 passed, 0 failed".

Task 1: EDIT ./file-injector.ts — Edit A: declare injectedIndexes (after L192, alongside injectedThisRun)
  - FIND (unique anchor):
        const injectedThisRun = new Set<string>();

        for (const m of text.matchAll(FILE_INJECT_RE)) {
  - REPLACE WITH (insert the index array between the dedup set and the main loop):
        const injectedThisRun = new Set<string>();

        // Issue 2 — start indices of tokens that ACTUALLY injected (pushed at each success site below).
        // Used after the loop to strip '#@' from EXACTLY those tokens (failed/dir/error and deduped
        // repeats are never pushed → they keep '#@' verbatim, PRD §6.2). Group 1 of FILE_INJECT_RE is
        // zero-width, so m.index is exactly the '#'; splicing out 2 chars drops exactly '#@'.
        const injectedIndexes: number[] = [];

        for (const m of text.matchAll(FILE_INJECT_RE)) {

Task 2: EDIT ./file-injector.ts — Edit B: push m.index at the empty-image success site (L225)
  - FIND (unique — the empty-image branch):
          if (mime && buf.length === 0) {
            blocks.push(formatEmptyImageBlock(abs));
            injectedThisRun.add(abs); // within-run dedup (Issue 1)
            count++;
            continue;
          }
  - REPLACE WITH (add the index push immediately after injectedThisRun.add, before count++):
          if (mime && buf.length === 0) {
            blocks.push(formatEmptyImageBlock(abs));
            injectedThisRun.add(abs); // within-run dedup (Issue 1)
            injectedIndexes.push(m.index); // record injected-token index for precise #@ strip (Issue 2)
            count++;
            continue;
          }

Task 3: EDIT ./file-injector.ts — Edit C: push m.index at the end-of-try success site (L266)
  - FIND (unique — the last statements in the try, before `} catch {`):
            }
          }
          injectedThisRun.add(abs); // within-run dedup (Issue 1) — covers text-inline/paged/image/binary
          count++;
        } catch {
  - REPLACE WITH (add the index push immediately after injectedThisRun.add, before count++):
            }
          }
          injectedThisRun.add(abs); // within-run dedup (Issue 1) — covers text-inline/paged/image/binary
          injectedIndexes.push(m.index); // record injected-token index for precise #@ strip (Issue 2)
          count++;
        } catch {
  - NOTE: the paged branch (paged++ above) reaches this count++, so this single push covers paged
    files too — do NOT add a 3rd push inside the paged branch (mirrors S1's reasoning).

Task 4: EDIT ./file-injector.ts — Edit D: replace the blanket strip with the index-based splice (L280)
  - FIND (unique):
        const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
  - REPLACE WITH:
        // §6.2 — strip the '#@' trigger ONLY from tokens that ACTUALLY injected (Issue 2). Failed tokens
        // (missing/dir/error) and deduped repeats were never pushed, so they keep '#@' verbatim.
        // INDEX-BASED SPLICE (not substring replace): an injected match can be a prefix of another token
        // (e.g. '#@a.ts' ⊂ '#@a.ts.bak'), so a substring replace would corrupt the longer token. Group 1
        // of FILE_INJECT_RE is zero-width → m.index is exactly the '#'; removing 2 chars drops exactly
        // '#@'. Process high→low so earlier offsets stay valid.
        let strippedText = text;
        for (const i of [...injectedIndexes].sort((a, b) => b - a)) {
          strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
        }
  - EFFECT: L281 `const finalText = `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`;` is UNCHANGED
    (it references strippedText, now a `let`). The count===0 early-return (L278) is UNCHANGED.

Task 5: EDIT ./file-injector.test.mjs — update F2 (it currently asserts the BUG)
  - FIND (unique — F2's buggy assertion + comment):
        assert(r.text.startsWith('<!--file-injected--> Review a.ts'), "both #@ markers stripped (sentinel's #@ too); paths remain as inline references");
  - REPLACE WITH (the failed sentinel token now KEEPS its #@; only the injected #@a.ts is stripped):
        assert(r.text.startsWith('<!--#@file-injected--> Review a.ts'), "only the injected #@a.ts is stripped (→ a.ts); the failed sentinel token keeps its #@ verbatim (Issue 2 fix)");
  - NOTE: F2's other asserts (injected===1, the <file> block, aCount===1, handler out.action===transform)
    are UNCHANGED — they still hold. Only the buggy prefix assertion + its comment change.

Task 6: EDIT ./file-injector.test.mjs — add 3 regression cases (FS1/FS2/FS3) AFTER the F2 runCase block
  - FIND (unique — the END of the F2 block, right before the F3a case):
        const out = await slot.cb({ text: prompt, source: "interactive", images: [] }, ctx);
        assert(out.action === "transform", `handler must transform (sentinel no longer gates), got '${out.action}'`);
      });

      await runCase("F3a",
  - INSERT BETWEEN the F2 closing `});` and `await runCase("F3a",` (verbatim; reuse FIX, A_TS, SRC):

      await runCase("FS1", "FS1 — mixed success+missing: failed token keeps #@ (Issue 2)", async () => {
        const r = await mod.injectFiles("Review #@a.ts and check #@missing.ts", [], FIX);
        assert(r.injected === 1, `a.ts injected (count=1), got injected=${r.injected}`);
        assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
        assert(r.text.includes("#@missing.ts") === true, `the FAILED #@missing.ts must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
        const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
        assert(aCount === 1, `exactly 1 <file> block (a.ts only); missing.ts injected nothing (got ${aCount})`);
      });

      await runCase("FS2", "FS2 — mixed success+directory: failed token keeps #@ (Issue 2)", async () => {
        const r = await mod.injectFiles("Review #@a.ts and list #@src/", [], FIX);
        assert(r.injected === 1, `a.ts injected (count=1), got injected=${r.injected}`);
        assert(r.text.startsWith("Review a.ts"), "the injected #@a.ts is stripped to a.ts");
        assert(r.text.includes("#@src/") === true, `the directory token #@src/ must keep its #@ verbatim (PRD §6.2), got text=${JSON.stringify(r.text.slice(0, 60))}`);
      });

      await runCase("FS3", "FS3 — Issue1×Issue2: deduped repeat keeps #@ (first stripped)", async () => {
        // Same path twice: Issue 1 dedup SKIPS the 2nd (it does not inject); Issue 2 strips #@ only from
        // actually-injected tokens. ⇒ first stripped to a.ts, deduped second KEEPS its #@. One block.
        const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
        assert(r.injected === 1, `same path twice injects ONCE (Issue 1), got injected=${r.injected}`);
        assert(r.text.startsWith("Compare a.ts with #@a.ts"), `first stripped, deduped second keeps #@ (Issue 2), got text=${JSON.stringify(r.text.slice(0, 40))}`);
        const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
        assert(aCount === 1, `exactly ONE <file> block for a.ts (got ${aCount})`);
      });

  - EFFECT: harness goes 46 → 49 passed. Verify SRC fixture exists (it backs case #6: `const SRC = ...`;
    the directory `src/` is created by buildFixtures — FS2 relies on `#@src/` resolving to that dir).

DO NOT (out of scope):
  * use the substring text.replace(whole, whole.slice(2)) approach — FORBIDDEN (corrupts).
  * touch injectedThisRun/priorPaths/dedup guard (S1) — only ADD index pushes at the same 2 sites.
  * add a 3rd push in the paged branch (it reaches L266 — redundant, mirrors S1).
  * change the count===0 early-return, finalText assembly, notify wording (Issue 3), paged directive
    (Issue 4), budget, image/binary/paged handling, or any format helper.
  * edit README (P1.M3).
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (the index-based splice — replaces the blanket replace):
let strippedText = text;
for (const i of [...injectedIndexes].sort((a, b) => b - a)) {   // high→low keeps earlier offsets valid
  strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);   // drop exactly '#@'
}
const finalText = `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`;   // UNCHANGED

// PATTERN (the 2 success sites — push m.index right after S1's injectedThisRun.add):
if (mime && buf.length === 0) {
  blocks.push(formatEmptyImageBlock(abs));
  injectedThisRun.add(abs);            // Issue 1 (S1)
  injectedIndexes.push(m.index);       // Issue 2 (this task)
  count++;
  continue;
}
// … image/binary/text-inline/paged branches …
injectedThisRun.add(abs);              // Issue 1 (S1) — covers text-inline/paged/image/binary
injectedIndexes.push(m.index);         // Issue 2 (this task) — same coverage
count++;

// WHY index not substring: substring replace matches the FIRST literal occurrence; an injected '#@a.ts'
//   is a prefix of a failed '#@a.ts.bak', so replace corrupts the longer token. Index splice removes
//   chars only at recorded positions → collision-free. (Empirically confirmed.)
// WHY high→low: each slice(0,i)+slice(i+2) shifts chars right of i leftward by 2; processing descending
//   means already-processed (higher) indices don't affect unprocessed (lower) ones.
// WHY failed tokens are safe: they `continue` (missing/dir/error) or hit the dedup guard BEFORE any
//   push, so their m.index is never recorded → they're untouched by the splice → keep '#@'.
```

### Integration Points

```yaml
NO INTEGRATION CHANGE:
  - "Internal correctness fix. No new imports, no config, no API/type-signature change, no docs (README
    is P1.M3). The handler still calls injectFiles and destructures {text, images, injected, paged}."
  - "injectedThisRun (Issue 1) and injectedIndexes (Issue 2) coexist at the same 2 success sites; they
    are independent (a Set<string> for dedup, a number[] for stripping)."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — a single-file Pi extension validated by a
> **model-free Node ESM harness** (`file-injector.test.mjs`, run via `node`). The `pytest`/`mypy`/`ruff`
> gates DO NOT APPLY. Gates below are project-specific and **verified on this machine**: baseline is
> **46 passed, 0 failed**; the bug is **confirmed live** (mixed prompts strip failed `#@`); the
> substring-collision failure and the index-splice fix are **empirically demonstrated** (research §3).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. injectedIndexes declared exactly once, alongside injectedThisRun (before the main loop).
test "$(grep -c 'const injectedIndexes: number[] = \[\];' file-injector.ts)" -eq 1 && echo "OK: array declared" || echo "FAIL"

# 1b. exactly 2 injectedIndexes.push(m.index) calls (empty-image + end-of-try); NO 3rd in the paged branch.
test "$(grep -c 'injectedIndexes.push(m.index);' file-injector.ts)" -eq 2 && echo "OK: 2 push calls" || echo "FAIL: need exactly 2 push(m.index)"

# 1c. the blanket strip line is GONE; the index-splice is present (slice(0, i) + slice(i + 2)).
! grep -q 'text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path)' file-injector.ts && echo "OK: blanket strip removed" || echo "FAIL: blanket strip still present"
grep -q 'strippedText.slice(0, i) + strippedText.slice(i + 2)' file-injector.ts && echo "OK: index-splice present" || echo "FAIL: splice missing"
grep -q '\[...injectedIndexes\].sort((a, b) => b - a)' file-injector.ts && echo "OK: descending sort" || echo "FAIL: need descending sort"

# 1d. SCOPE LEAK guards — dedup/notify/paged-directive/budget untouched.
grep -q 'if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;' file-injector.ts && echo "OK: dedup guard unchanged (S1)" || echo "FAIL: dedup guard altered"
grep -q 'offset:0, limit:2000' file-injector.ts && echo "OK: paged directive untouched (P1.M2.T2)" || echo "(verify directive not edited here)"

# 1e. F2 updated + 3 FS cases present; NO substring approach leaked in.
grep -q "r.text.startsWith('<!--#@file-injected--> Review a.ts')" file-injector.test.mjs && echo "OK: F2 updated (failed token keeps #@)" || echo "FAIL: F2 not updated"
for id in FS1 FS2 FS3; do grep -q "runCase(\"$id\"" file-injector.test.mjs && echo "OK: case $id present" || echo "FAIL: missing $id"; done
! grep -qE 'text\.replace\(whole, whole\.slice\(2\)\)|\.replace\(m\[0\], m\[0\]\.slice' file-injector.ts && echo "OK: no forbidden substring approach" || echo "FAIL: substring approach leaked"

# Expected: every line prints OK.
```

### Level 2: Regression + New Cases — Full Harness

```bash
node ./file-injector.test.mjs
# Expected: "Result: 49 passed, 0 failed." and exit 0 (was 46/0 before; F2 updated, +FS1/FS2/FS3).
# If an EXISTING case other than F2 fails: you over-stripped or under-stripped. Most likely cause: you
# pushed m.index at the wrong site (e.g. inside the paged branch AND end-of-try = double-push), or you
# changed the descending sort. Re-read the failure and the Level-1 1b check.
```

### Level 3: Behavior Verification (the Issue 2 fix + collision safety — NON-INTERACTIVE, NO MODEL)

Run this throwaway script. It proves: mixed success+failed → only injected stripped; the substring
collision (`#@a.ts` ⊂ `#@a.ts.bak`) is handled correctly by the splice; multi-injected all stripped;
Issue1×Issue2 deduped-repeat keeps `#@`. Uses the same jiti+alias import pattern as the harness.

```bash
cat > /tmp/verify_issue2_splice.mjs <<'EOF'
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
  "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
}});
const mod = await jiti.import(path.resolve("file-injector.ts"));
const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "iss2-"));
fsSync.writeFileSync(path.join(TMP, "a.ts"), "export const X = 1;\n");
fsSync.mkdirSync(path.join(TMP, "src"), { recursive: true });
const ctx = { cwd: TMP };
let pass=0, fail=0; const ok=(n,c,d="")=>{console.log((c?"PASS":"FAIL")+": "+n+(c?"":"  "+d));c?pass++:fail++;};

// (a) mixed success + missing → only injected stripped; failed keeps #@
let r = await mod.injectFiles("Review #@a.ts and check #@missing.ts", [], ctx);
ok("mixed success+missing: startsWith 'Review a.ts'", r.text.startsWith("Review a.ts"), JSON.stringify(r.text.slice(0,40)));
ok("mixed success+missing: failed keeps #@missing.ts", r.text.includes("#@missing.ts"));

// (b) mixed success + directory → directory token keeps #@
r = await mod.injectFiles("Review #@a.ts and list #@src/", [], ctx);
ok("mixed success+dir: startsWith 'Review a.ts'", r.text.startsWith("Review a.ts"));
ok("mixed success+dir: keeps #@src/", r.text.includes("#@src/"));

// (c) substring-collision safety: injected '#@a.ts' is a prefix of failed '#@a.ts.bak'
//     (a.ts.bak does NOT exist; a.ts DOES). Substring replace would corrupt; splice must not.
r = await mod.injectFiles("Fix #@a.ts.bak then review #@a.ts", [], ctx);
ok("collision: failed keeps #@a.ts.bak", r.text.includes("#@a.ts.bak"), JSON.stringify(r.text.slice(0,50)));
ok("collision: injected a.ts stripped", r.text.includes("review a.ts"), JSON.stringify(r.text));

// (d) multi-injected → all stripped
r = await mod.injectFiles("A #@a.ts B", [], ctx);
ok("single injected stripped", r.text.startsWith("A a.ts B"));

// (e) Issue1×Issue2: deduped repeat keeps #@ (first stripped)
r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], ctx);
ok("dedup repeat: startsWith 'Compare a.ts with #@a.ts'", r.text.startsWith("Compare a.ts with #@a.ts"), JSON.stringify(r.text.slice(0,40)));
ok("dedup repeat: exactly 1 block", r.injected === 1 && (r.text.match(/<file name="/g)||[]).length === 1);

// (f) pure-fail prompt → original text byte-for-byte (count===0 path, unchanged)
r = await mod.injectFiles("Check #@missing.ts only", [], ctx);
ok("pure-fail: original verbatim (count===0)", r.text === "Check #@missing.ts only" && r.injected === 0);

fsSync.rmSync(TMP, { recursive: true, force: true });
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
EOF
node /tmp/verify_issue2_splice.mjs
# Expected: all checks PASS; "<n> passed, 0 failed"; exit 0.
# Before this task: the mixed cases (a)/(b) print FAIL (failed token lost #@). After: PASS.
rm -f /tmp/verify_issue2_splice.mjs
```

### Level 4: (none — no live-Pi scenario needed)

The fix is pure in-process text handling; the model-free harness + Level 3 one-off fully cover it. No
live-Pi run adds signal beyond Level 2/3.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all checks print OK (array declared once; exactly 2 push calls; blanket strip gone +
      splice present + descending sort; dedup/directive untouched; F2 updated; FS1/2/3 present; no
      substring approach).
- [ ] Level 2: `node ./file-injector.test.mjs` → **49 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_issue2_splice.mjs` → all checks PASS (incl. the substring-collision safety),
      exit 0.

### Feature Validation
- [ ] Mixed success+missing → injected stripped, failed keeps `#@`.
- [ ] Mixed success+directory → directory token keeps `#@`.
- [ ] Substring-collision safe: injected `#@a.ts` (prefix of failed `#@a.ts.bak`) doesn't corrupt the
      longer token.
- [ ] Issue1×Issue2: `Compare #@a.ts with #@a.ts` → first stripped, deduped second keeps `#@`, 1 block.
- [ ] Pure-fail prompt unchanged (count===0 path); multi-injected all stripped.

### Code Quality Validation
- [ ] Only the 4 specified `file-injector.ts` edits + F2 update + 3 FS cases; nothing else.
- [ ] `injectedIndexes` declared beside `injectedThisRun`; push(m.index) sits immediately after each
  `injectedThisRun.add(abs)`.
- [ ] No 3rd push in the paged branch (redundant — reaches the end-of-try push).
- [ ] Index-splice uses descending sort + `slice(0,i)+slice(i+2)`; blanket substring replace removed.
- [ ] No change to: dedup (S1), notify (P1.M2.T1), paged directive (P1.M2.T2), budget, count===0
  early-return, image/binary/paged handling, format helpers, README (P1.M3).

### Documentation & Deployment
- [ ] Inline comments cite Issue 2 / PRD §6.2 and explain WHY index-splice (not substring).
- [ ] No new env vars / config / API surface (internal correctness fix; README does not describe the
      strip mechanism in detail).

---

## Anti-Patterns to Avoid

- ❌ Don't use the substring `text.replace(whole, whole.slice(2))` — it corrupts when an injected match
  is a prefix of another token (`#@a.ts` ⊂ `#@a.ts.bak`); empirically confirmed to strip the WRONG
  token (backwards). Use the index-based splice.
- ❌ Don't splice left→low (ascending) — each splice shifts later chars; you MUST sort descending and
  splice high→low so earlier recorded offsets stay valid.
- ❌ Don't push `m.index` at the wrong site or twice for the paged branch — the 2 sites (empty-image +
  end-of-try) cover all 5 branches; a 3rd push in the paged branch double-records and breaks stripping.
- ❌ Don't touch Issue 1's dedup (`injectedThisRun`/`priorPaths`/guard) — S2 only ADDS index
  bookkeeping at the same 2 sites S1 instrumented, plus rewrites the strip line.
- ❌ Don't change the `count===0` early-return or the `finalText` assembly — the early-return already
  returns original text byte-for-byte (correct); finalText references `strippedText` unchanged.
- ❌ Don't forget to UPDATE F2 — it currently asserts the BUG (`<!--file-injected-->`, i.e. the failed
  sentinel token lost its `#@`). After the fix that token keeps `#@`.
- ❌ Don't add behavioral assertions on `#@`-stripping to S1's DUP tests (S1 left them strip-agnostic)
  — but DO add the Issue1×Issue2 assertion as the new FS3 case (it's this task's interaction).
- ❌ Don't change the notify wording / paged directive / budget / format helpers — out of scope
  (P1.M2 / P1.M3).

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: S1's instrumentation is confirmed in the file (the 2 `injectedThisRun.add(abs)` success
sites are exactly where S2 adds the index pushes), so S2 is a minimal 4-edit change at unique-text
anchors. The root cause is **confirmed live** (mixed prompts strip failed `#@`), and — critically —
**both the forbidden substring approach's corruption AND the index-splice's correctness are
empirically demonstrated** in this environment (the collision `#@a.ts` ⊂ `#@a.ts.bak` corrupts under
substring replace; the splice handles it correctly). The regex geometry (zero-width group 1 ⇒
`m.index` is the `#`) is VERIFIED in external_deps.md §2. The "must-not-break" surface is fully
scanned: only F2 asserts the buggy strip (updated), and all other prefix assertions are
single-injected-token prompts (still stripped). The 3 new FS cases + the Level-3 collision check fully
bound the behavior. Residual 1.0 is for a possible anchor slip in a multi-line edit (e.g. the
end-of-try `}`-nesting) or a missing F2-comment update — caught by Level 1 (1a–1e), Level 2 (49/49),
and Level 3.
