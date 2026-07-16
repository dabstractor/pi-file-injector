---
name: "P1.M1.T1.S1 — Add within-run dedup set to injectFiles so a same-path repeat in one prompt injects once (Issue 1)"
prd_ref: "Bug-fix PRD §Overview, §Issue 1 (within-prompt dedup gap), §Testing Summary"
target_files: "./file-injector.ts" (4 edits) + "./file-injector.test.mjs" (3 new regression cases, TDD)
change_type: surgical (1 new Set decl + widen 1 guard + 2 add() insertions) + TDD regression tests
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
---

# PRP — P1.M1.T1.S1: Within-Run Dedup Set in `injectFiles` (Issue 1)

## Goal

**Feature Goal**: Fix Issue 1 — a file referenced by more than one `#@` token in a **single prompt** is currently injected for *every* occurrence (e.g. `Compare #@a.ts with #@a.ts` → 2 blocks; `See #@pic.png and #@pic.png` → 2 images; `#@a.ts` + `#@./a.ts` → 2 blocks). Add a SEPARATE within-run `Set<string>` named `injectedThisRun` that is checked (alongside the existing `priorPaths`) at the top of the token loop and populated after **every** successful injection, so a same-path repeat in one prompt injects **once**. The existing `priorPaths` set (input-text blocks) is left untouched, preserving the F1c invariant (a prior block for path X must not block a NEW path Y).

**Deliverable**: Four precise edits to `./file-injector.ts` (declare `injectedThisRun`; widen the dedup guard; add `injectedThisRun.add(abs)` before each of the 2 `count++` sites) **plus** three new regression test cases in `./file-injector.test.mjs` (TDD: add the failing tests first, then implement, then they pass). No behavioral change for non-repeated tokens; the existing 43-case suite stays green (→ 46 total after the 3 new cases pass).

**Success Definition**:
- [ ] `Compare #@a.ts with #@a.ts` → `injected === 1` and exactly ONE `<file name="<A_TS>">` block.
- [ ] `#@a.ts` + `#@./a.ts` (two path forms, same resolved abs) → exactly ONE `<file name="<A_TS>">` block.
- [ ] `See #@pic.png and #@pic.png` → `images.length === 1`.
- [ ] The existing 43 cases (incl. F1/F1b/F1c/F1d) still pass → **46 passed, 0 failed** total.
- [ ] `priorPaths` is NOT mutated in-loop (F1c still injects a genuinely-new `b.ts` alongside a prior `a.ts` block).

> **Scope boundary (read carefully):** This subtask fixes **Issue 1 ONLY**. It does **NOT** (a) change the post-loop `#@`-stripping / assembly logic — that is **S2** (Issue 2: failed tokens must keep `#@` in mixed prompts); (b) touch the notify wording (Issue 3, P1.M2.T1) or the paged directive offset (Issue 4, P1.M2.T2); (c) change the `count === 0` early-return, the paged-delivery budget, or any format helper; (d) sync the README (P1.M3). The S1 regression tests assert **only** injected count + block/image count — they deliberately do **not** assert on `#@`-stripping of the deduped 2nd token (that's an Issue 1×Issue 2 interaction resolved in S2; in S1 the blanket strip still removes both `#@`).

## User Persona

**Target User**: End users who reference the same file more than once in a single prompt (e.g. `Compare #@a.ts with #@a.ts`, or paste a path twice via different spellings). Today they silently get duplicate content + doubled token cost. After the fix, each referenced file is delivered exactly once per prompt.

## Why

- **Issue 1 is a Major correctness bug.** The extension ships an explicit per-token dedup feature (tests F1/F1b/F1c/F1d), but that dedup only covers *cross-pass / co-load* re-injection — it never tracks *within-prompt* repeats, so the feature's own contract ("inject the file once") is violated for the simplest multi-mention case.
- **Root cause is a missing update.** `priorPaths` (the dedup set) is built once before the loop from blocks already in the input text; nothing adds to it after a successful injection. So a repeat of the same resolved path later in the same prompt sees no prior block and re-injects.
- **The fix is minimal and surgical**: a separate `injectedThisRun` set, checked at the top of the loop (before any I/O) and populated at each of the 2 `count++` sites. Two insertions cover all 5 inject branches (empty-image has its own `count++`; text-inline/paged/image/binary all share the end-of-try `count++`).

## What

Four edits to `file-injector.ts` + three new regression test cases (added first, per TDD). The dedup guard becomes `if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;` (still before `fs.stat`, so a deduped token does no I/O). After each successful injection, `injectedThisRun.add(abs)` records the path. `priorPaths` is read-only in-loop.

### Success Criteria

- [ ] A same-path repeat (any file type: text/image/binary/empty-image/paged) injects exactly once.
- [ ] Two different path forms resolving to the same abs (e.g. `a.ts` and `./a.ts`) dedup to one injection.
- [ ] F1c still passes: a prior `<file name="A_TS">` block + a new `#@b.ts` token injects `b.ts` once.
- [ ] `priorPaths` set is not mutated inside the loop.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ — **YES.** This PRP includes the exact current line numbers, every edit as an old→new block anchored on unique text, the verified control flow (2 `count++` sites cover all 5 inject branches), the verbatim 3 regression tests matching the harness conventions, and a confirmed-live bug reproduction. The F1c invariant (must-not-break) is spelled out with its exact test reference.

### Documentation & References

```yaml
# MUST READ — bug-fix architecture recon (already produced for this plan)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/code_changes_analysis.md
  why: "§'Issue 1' pins the root cause (priorPaths built once, never updated in-loop), the verified fix
        (separate injectedThisRun set, combined guard at loop top, add() after each count++), and the
        F1c invariant (WHY a separate set — don't mutate priorPaths)."
  critical: "There are 5 inject branches but only 2 count++ statements (empty-image L219 + end-of-try
        L259). Add injectedThisRun.add(abs) before EACH count++ — 2 insertions cover all 5 branches.
        The paged branch (paged++ at L254) falls through to the L259 count++, so it IS covered."

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/system_context.md
  why: Confirms the live bug reproduction and the F1/F1b/F1c/F1d test landscape.
  section: "Issue 1"

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/prd_snapshot.md
  why: Bug-fix PRD — §Issue 1 (within-prompt dedup gap), §Testing Summary (why F1–F1d missed it).
  section: "§Issue 1, §Testing Summary"

# The file being EDITED
- file: ./file-injector.ts
  why: "injectFiles: priorPaths decl L183-186; dedup guard L199; empty-image count++ L219; end-of-try
        count++ L259. All 4 edits land in this ~80-line span."
  pattern: "Match the existing terse inline-comment style. The new set sits beside priorPaths; the
        widened guard keeps the same single-line form; the add() calls sit immediately before each count++."
  gotcha: "Do NOT add injectedThisRun.add(abs) inside the paged branch — it reaches the L259 count++, so the
        L259 add covers it. Do NOT mutate priorPaths. Do NOT touch the post-loop stripping (Issue 2/S2)."

# The test harness (TDD: add 3 cases; run for regression)
- file: ./file-injector.test.mjs
  why: "Model-free harness, run via `node ./file-injector.test.mjs`. Baseline: 43 passed. Reuse FIX={cwd:TMPDIR},
        A_TS/B_TS/PIC constants, a.ts/b.ts/pic.png fixtures. Existing dedup cluster F1(L501)/F1b(L528)/
        F1c(L540)/F1d(L558) — add the 3 new cases right after F1d."
  pattern: "await runCase('ID', 'label', async () => { const r = await mod.injectFiles(...); assert(...); });"
  gotcha: "Count <file> blocks with a RegExp that ESCAPES the abs path (A_TS.replace(/[.*+?^${}()|[\]\\]/g,'\\\\$&')).
        S1 tests assert injected count + block/image count ONLY — NOT #@-stripping (that's Issue 2/S2)."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDITED (4 edits in injectFiles, ~L183-259 span). No behavior change for non-repeats.
├── file-injector.test.mjs       # ← EDITED (+3 regression cases after F1d). Baseline 43 → 46 after.
├── PRD.md / README.md           # READ-ONLY here (README sync is P1.M3)
└── plan/002_0ac3eb160af7/bugfix/001_04217649554a/
    ├── architecture/{code_changes_analysis.md, system_context.md, external_deps.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — +1 Set decl, widened dedup guard, +2 injectedThisRun.add() calls.
└── file-injector.test.mjs       # MODIFIED — +3 regression cases (DUP1/DUP2/DUP3) after the F1d case.
# No new files. No README/notify/paged-directive changes (those are P1.M2/P1.M3). No stripping change (S2).
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — use a SEPARATE set (injectedThisRun), do NOT mutate priorPaths. priorPaths models "blocks
// already in the INPUT text" (prior copy / Pi @file expander). F1c asserts a prior block for X must NOT
// block a NEW path Y. Mutating priorPaths in-loop would still be path-keyed (F1c holds), but a separate
// set keeps the "in input" vs "injected this pass" distinction explicit and the diff minimal. (Recommended
// by code_changes_analysis.md §Issue 1 "Why a separate set".)

// CRITICAL — only 2 count++ sites cover all 5 inject branches. The paged branch does paged++ (L254) then
// FALLS THROUGH to the end-of-try count++ (L259) — so adding injectedThisRun.add(abs) before the L259
// count++ ALSO covers paged files. Do NOT add a 3rd add() in the paged branch (redundant + confusing).

// CRITICAL — keep the dedup guard BEFORE fs.stat (it already is, at L199). A deduped token must do NO I/O
// (no stat, no readFile). Just widen the condition; don't move it.

// SCOPE — do NOT touch the post-loop stripping `text.replace(FILE_INJECT_RE, (_m,_boundary,path)=>path)`
// (that is Issue 2 / S2). In S1 the blanket strip still removes #@ from BOTH repeat tokens; S1's regression
// tests therefore assert ONLY injected/block/image counts, NOT the #@-stripping of the deduped 2nd token.

// INVARIANT — count===0 early return (L266) is UNCHANGED. paged files count toward `count` (they reach L259),
// so a prompt with only paged repeats still has count>0 and returns a transform. The dedup never drives
// count to 0 for a prompt that has ≥1 distinct injectable file.

// NO TYPE-CHECK — the repo has no tsconfig/tsc; jiti transpiles only. Set<string> is erased at load.
```

## Implementation Blueprint

### Data models and structure

One new local: `const injectedThisRun = new Set<string>();` inside `injectFiles`. No type/signature change (the return shape `{ text, images, injected, paged }` is unchanged). The set is purely internal bookkeeping.

### Implementation Tasks (TDD order — tests first, then the 4 source edits)

```yaml
Task 1 (TDD — RED): EDIT ./file-injector.test.mjs — add 3 regression cases AFTER the F1d case (~L558 block)
  - OBJECTIVE: Pin the within-run dedup behavior. These FAIL on current code (injected===2 / images.length===2),
    PASS after Task 2.
  - INSERT (verbatim; reuse FIX, A_TS, B_TS, PIC, and the escaped-RegExp block-count idiom from F1c):

    await runCase("DUP1", "DUP1 — within-prompt same-path repeat injects ONCE (text) (Issue 1)", async () => {
      const r = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], FIX);
      assert(r.injected === 1, `same path twice must inject ONCE, got injected=${r.injected}`);
      const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
      assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
    });

    await runCase("DUP2", "DUP2 — two path forms of the same file inject ONCE (Issue 1)", async () => {
      // 'a.ts' and './a.ts' both resolve to the same absolute path → dedup to one injection.
      const r = await mod.injectFiles("Diff #@a.ts against #@./a.ts", [], FIX);
      assert(r.injected === 1, `two path forms (same file) must inject ONCE, got injected=${r.injected}`);
      const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
      assert(aCount === 1, `must contain exactly ONE <file> block for a.ts, got ${aCount}`);
    });

    await runCase("DUP3", "DUP3 — within-prompt same-image repeat attaches ONCE (Issue 1)", async () => {
      const r = await mod.injectFiles("See #@pic.png and #@pic.png", [], FIX);
      assert(r.images.length === 1, `same image twice must attach ONCE, got images.length=${r.images.length}`);
      const picCount = (r.text.match(new RegExp('<file name="' + PIC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
      assert(picCount === 1, `must contain exactly ONE <file> reference block for pic.png, got ${picCount}`);
    });

  - RUN (expect 3 NEW FAILURES, 43 existing still PASS):
        node ./file-injector.test.mjs   # → "46 passed" is impossible yet; expect "43 passed, 3 failed"
                                         #   (DUP1/DUP2/DUP3 fail: injected===2 / images.length===2)
  - PLACE: immediately after the F1d `runCase(...)` block (keeps dedup cases grouped).

Task 2 (TDD — GREEN): EDIT ./file-injector.ts — 4 edits to injectFiles
  Edit 2a — declare injectedThisRun after the priorPaths loop (after L186, before the main loop):
    - FIND (unique):
          const priorPaths = new Set<string>();
          for (const m of text.matchAll(/<file name="([^"]+)">/g)) {
            priorPaths.add(m[1]);
          }

          for (const m of text.matchAll(FILE_INJECT_RE)) {
    - REPLACE WITH (insert the within-run set between the two loops):
          const priorPaths = new Set<string>();
          for (const m of text.matchAll(/<file name="([^"]+)">/g)) {
            priorPaths.add(m[1]);
          }

          // WITHIN-RUN DEDUP (Issue 1) — paths injected by THIS pass. Checked alongside priorPaths at the
          // top of the loop so a same-path repeat in one prompt (e.g. "Compare #@a.ts with #@a.ts", or
          // "#@a.ts" + "#@./a.ts") injects ONCE. SEPARATE from priorPaths so the F1c invariant holds (a
          // prior block for X must not block a NEW path Y). Populated after each successful inject below.
          const injectedThisRun = new Set<string>();

          for (const m of text.matchAll(FILE_INJECT_RE)) {

  Edit 2b — widen the dedup guard (L199):
    - FIND (unique):   if (priorPaths.has(abs)) continue;
    - REPLACE WITH:    if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;
    - (Still before fs.stat → a deduped token does no I/O. Comment above it can stay as-is.)

  Edit 2c — add injectedThisRun.add(abs) before the empty-image count++ (L219):
    - FIND (unique):
          if (mime && buf.length === 0) {
            blocks.push(formatEmptyImageBlock(abs));
            count++;
            continue;
          }
    - REPLACE WITH:
          if (mime && buf.length === 0) {
            blocks.push(formatEmptyImageBlock(abs));
            injectedThisRun.add(abs); // within-run dedup (Issue 1)
            count++;
            continue;
          }

  Edit 2d — add injectedThisRun.add(abs) before the end-of-try count++ (L259):
    - FIND (unique — the last statement in the try, immediately before `    } catch {`):
              }
            }
          }
          count++;
        } catch {
    - REPLACE WITH (insert the add() immediately before count++):
              }
            }
          }
          injectedThisRun.add(abs); // within-run dedup (Issue 1) — covers text-inline/paged/image/binary
          count++;
        } catch {
    - NOTE: the paged branch (paged++ above) falls through to this count++, so it is covered by THIS add().

Task 3 (TDD — confirm GREEN): re-run the harness
  - RUN:  node ./file-injector.test.mjs
  - EXPECT: "Result: 46 passed, 0 failed." (43 existing + DUP1/DUP2/DUP3), exit 0.

Task 4: VERIFY no scope leak — grep guards
  - See Level 1 checks (4b/4c/4d): priorPaths NOT mutated in-loop; stripping line unchanged; no paged-branch add.
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (the combined dedup guard — checked once, at loop top, before any I/O):
for (const m of text.matchAll(FILE_INJECT_RE)) {
  const raw = m[2];
  const token = cleanToken(raw);
  if (!token) continue;
  const abs = expandTildeAndResolve(token, ctx.cwd);

  if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;   // ← widened (Issue 1)
  // … stat / readFile / classify …
  // (empty-image branch)
  if (mime && buf.length === 0) {
    blocks.push(formatEmptyImageBlock(abs));
    injectedThisRun.add(abs);                                       // ← Issue 1
    count++;
    continue;
  }
  // … image / binary / text-inline / paged branches …
  injectedThisRun.add(abs);                                         // ← Issue 1 (covers all 4 remaining branches)
  count++;
}

// WHY 2 add() calls cover 5 branches: empty-image has its own count++; text-inline, paged, image, and
//   binary ALL fall through to the single end-of-try count++ (the paged branch does paged++ first, then
//   continues to count++). So the add() before that count++ records every non-empty-image injection.

// WHY a separate set: priorPaths = "already in the INPUT text" (read-only in-loop, F1c invariant).
//   injectedThisRun = "injected by THIS pass" (write after each success). Keeping them separate makes the
//   two semantics explicit and leaves F1c (prior a.ts block + new b.ts token → inject b.ts) untouched.
```

### Integration Points

```yaml
NO INTEGRATION CHANGE:
  - "Internal correctness fix. No new imports, no config, no API/type-signature change, no docs (README is
    P1.M3). The handler still calls injectFiles and destructures {text, images, injected, paged} unchanged."
  - "paged files are still counted in BOTH count and paged (they reach the end-of-try count++); the dedup
    set records their abs like any other, so a repeated paged file also dedups to one delivery."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension validated by a **model-free Node ESM harness** (`file-injector.test.mjs`, run via `node`). The Python-oriented `pytest`/`mypy`/`ruff` gates DO NOT APPLY. The gates below are project-specific and have been **verified on this machine**: baseline is **43 passed, 0 failed**; the bug is **confirmed live** (`Compare #@a.ts with #@a.ts` → injected===2/blocks=2; `See #@pic.png and #@pic.png` → images.length===2); after S1 these become 1/1 and 1, and the suite goes to **46 passed, 0 failed**.

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. injectedThisRun declared exactly once, between the priorPaths loop and the main loop.
test "$(grep -c 'const injectedThisRun = new Set<string>();' file-injector.ts)" -eq 1 && echo "OK: set declared" || echo "FAIL"

# 1b. dedup guard widened (combined check); priorPaths NOT mutated in-loop.
grep -q 'if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;' file-injector.ts && echo "OK: guard widened" || echo "FAIL: guard"
! grep -qE 'priorPaths\.(add|set|delete|clear)' file-injector.ts && echo "OK: priorPaths read-only in-loop" || echo "FAIL: priorPaths mutated"

# 1c. exactly 2 injectedThisRun.add(abs) calls (empty-image + end-of-try); NO add inside the paged branch.
test "$(grep -c 'injectedThisRun.add(abs);' file-injector.ts)" -eq 2 && echo "OK: 2 add() calls" || echo "FAIL: need exactly 2 add() calls"

# 1d. SCOPE LEAK guards — stripping line unchanged (Issue 2 / S2), notify & paged-directive untouched.
grep -q 'text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path)' file-injector.ts && echo "OK: stripping unchanged (S2 scope)" || echo "FAIL: stripping altered"
grep -q 'offset:0, limit:2000' file-injector.ts && echo "OK: paged directive untouched (P1.M2.T2 scope)" || echo "(note: directive may already differ — verify not edited here)"

# 1e. 3 regression cases added (DUP1/DUP2/DUP3).
for id in DUP1 DUP2 DUP3; do grep -q "runCase(\"$id\"" file-injector.test.mjs && echo "OK: $id present" || echo "FAIL: missing $id"; done

# Expected: every line prints OK.
```

### Level 2: Regression + New Behavior — Full Harness (TDD GREEN)

```bash
node ./file-injector.test.mjs
# Expected: "Result: 46 passed, 0 failed." and exit 0.
# TDD note: if you ran this right after Task 1 (tests only), it showed "43 passed, 3 failed" (DUP1/2/3 RED).
# After Task 2 (the 4 source edits) it must be 46/0 (GREEN). If any of the original 43 now FAIL, you broke
# an invariant (most likely F1c — re-check that priorPaths is NOT mutated and injectedThisRun is separate).
```

### Level 3: Direct Bug-Fix Confirmation (NON-INTERACTIVE, NO MODEL)

Run this one-off to prove the exact bug-report scenarios flipped from buggy→fixed. **Verified**: against current pre-fix code it prints the BUGGY values (2/2 and 2); after S1 it prints 1/1 and 1.

```bash
cat > /tmp/verify_withinrun_dedup.mjs <<'EOF'
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
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), "wr-dedup-"));
await fs.writeFile(path.join(TMP, "a.ts"), "export const X = 1;\n");
const PNG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x49,0x48,0x44,0x52,0,0,0,1,0,0,0,1,8,6,0,0,0,0x1f,0x15,0xc4,0x89,0x49,0x44,0x41,0x54,0x78,0x9c,0x63,0,1,0,0,5,0,1,0x0d,0x0a,0x2d,0xb4,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);
await fs.writeFile(path.join(TMP, "pic.png"), PNG);
const ctx = { cwd: TMP };
let ok = true;
const r1 = await mod.injectFiles("Compare #@a.ts with #@a.ts", [], ctx);
console.log("(a) same-path twice : injected=" + r1.injected + " blocks=" + ((r1.text.match(/<file name="/g)||[]).length) + "  [expect 1/1]");
if (r1.injected !== 1 || (r1.text.match(/<file name="/g)||[]).length !== 1) ok = false;
const r2 = await mod.injectFiles("Diff #@a.ts against #@./a.ts", [], ctx);
console.log("(b) two path forms  : injected=" + r2.injected + " blocks=" + ((r2.text.match(/<file name="/g)||[]).length) + "  [expect 1/1]");
if (r2.injected !== 1 || (r2.text.match(/<file name="/g)||[]).length !== 1) ok = false;
const r3 = await mod.injectFiles("See #@pic.png and #@pic.png", [], ctx);
console.log("(c) image twice     : images.length=" + r3.images.length + "  [expect 1]");
if (r3.images.length !== 1) ok = false;
fsSync.rmSync(TMP, { recursive: true, force: true });
console.log(ok ? "ALL PASS" : "FAIL"); process.exit(ok ? 0 : 1);
EOF
node /tmp/verify_withinrun_dedup.mjs
# Expected: (a) injected=1 blocks=1 ; (b) injected=1 blocks=1 ; (c) images.length=1 ; "ALL PASS" ; exit 0.
rm -f /tmp/verify_withinrun_dedup.mjs
```

### Level 4: (none — no live-Pi scenario needed)

The fix is a pure in-process dedup; the model-free harness + Level 3 one-off fully cover it. No live-Pi run adds signal beyond Level 2/3.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all checks print OK (set declared once; guard widened; priorPaths read-only; exactly 2 add() calls; stripping/directive unchanged; DUP1/2/3 present).
- [ ] Level 2: `node ./file-injector.test.mjs` → **46 passed, 0 failed**, exit 0 (was 43/0 before; TDD RED→GREEN observed).
- [ ] Level 3: `/tmp/verify_withinrun_dedup.mjs` → (a) 1/1, (b) 1/1, (c) images.length 1, "ALL PASS", exit 0.

### Feature Validation
- [ ] Same-path repeat (text) → injected===1, one block.
- [ ] Two path forms (same abs) → injected===1, one block.
- [ ] Same image twice → images.length===1.
- [ ] F1c still injects a genuinely-new `b.ts` alongside a prior `a.ts` block (priorPaths not mutated).

### Code Quality Validation
- [ ] Only the 4 specified `file-injector.ts` edits + 3 test cases; nothing else.
- [ ] `injectedThisRun` declared beside `priorPaths`; add() calls sit immediately before each `count++`.
- [ ] No paged-branch add() (redundant — it reaches the end-of-try count++).
- [ ] No change to: post-loop stripping (S2), notify wording (P1.M2.T1), paged directive (P1.M2.T2), count===0 early-return, README (P1.M3).

### Documentation & Deployment
- [ ] No new env vars / config / API surface (internal correctness fix; README does not describe dedup).

---

## Anti-Patterns to Avoid

- ❌ Don't mutate `priorPaths` in-loop — use the SEPARATE `injectedThisRun` set (keeps F1c's "prior X doesn't block new Y" guarantee explicit and the diff minimal).
- ❌ Don't add a 3rd `injectedThisRun.add(abs)` inside the paged branch — it falls through to the end-of-try `count++`, so the add() before that count++ already covers it.
- ❌ Don't move the dedup guard after `fs.stat` — a deduped token must do NO I/O. Widen the condition in place (L199).
- ❌ Don't touch the post-loop `#@`-stripping (`text.replace(FILE_INJECT_RE, …)`) — that's Issue 2 / S2. S1's regression tests intentionally do NOT assert on stripping of the deduped 2nd token.
- ❌ Don't change the `count === 0` early-return, the paged budget, or any format helper — out of scope.
- ❌ Don't assert `#@`-stripping of the deduped repeat token in S1's tests — after S1 the blanket strip still removes both `#@` (the "deduped token keeps `#@`" outcome is the Issue 1×Issue 2 interaction, resolved+asserted in S2).
- ❌ Don't skip the TDD RED step — add DUP1/2/3 first and confirm they FAIL (injected===2 / images.length===2) before implementing; this proves the tests actually exercise the bug.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: The fix is minimal (1 set decl + 1 widened guard + 2 add() calls), the control flow is fully verified (exactly 2 `count++` sites cover all 5 inject branches; the paged branch falls through to the end-of-try count++), and the bug is **confirmed live** on this machine (the Level-3 script currently prints the buggy 2/2 and 2; after S1 it prints 1/1 and 1). The F1c "must-not-break" invariant is structurally guaranteed by using a separate set that never touches `priorPaths`. The TDD flow (RED→GREEN) plus the Level-1 scope-leak guards (priorPaths read-only; exactly 2 add() calls; stripping/directive unchanged) fully bound the change. Residual risk is a mis-counted add() site (e.g. adding a 3rd in the paged branch, or missing one) — caught by Level 1 (1c) and Level 2 (a paged-only repeat would mis-dedup if the end-of-try add were missed, surfacing in DUP-style coverage).
