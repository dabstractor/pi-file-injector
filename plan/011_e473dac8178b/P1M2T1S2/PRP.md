---
name: "P1.M2.T1.S2 (plan 011) — Gates LINE-8 / LINE-11 / LINE-12: VERIFY the already-delivered LINE-8/8-MD/12/11; ADD LINE-8b (the startLine>1 file-coordinate discriminator LINE-8 cannot express)"
prd_ref: "Line-Range feature §5 (LR-1: resume offset in FILE coordinates — resumeLine = startLine + complete-lines-in-slice-head), §6 (LR-4 past-EOF, LR-5 clamped display), §9 acceptance table (LINE-8/11/12 rows); spec §5.5 (budget/paging, PAGED_THRESHOLD, file-coordinate resume on slices); architecture/system_context.md §5 (harness reality)"
target_file: "./file-injector.test.mjs"   # EDIT: +runCase("LINE-8b") between LINE-8-MD's closing }); and runCase("LINE-12"). VERIFY-ONLY on LINE-8/8-MD/11/12 (already landed, green). NO .ts change.
target_language: JavaScript (.mjs; zero-dep harness; loads the REAL .ts via jiti + Pi's alias map); gate = `node ./file-injector.test.mjs`
depends_on: "LR-1 (P1.M1.T1.S1 — LANDED f2d33dc, shipped LINE-8 + LINE-8-MD), LR-5 (P1.M1.T1.S2 — LANDED a5d0f5f, shipped LINE-12), LR-4 (P1.M1.T2.S3 — LANDED 2e56a86, shipped LINE-11; the commit diff shows file-injector.test.mjs +71). All four gates currently ✓ in the 179/0 run."
consumed_by: "P1.M2.T1.S3 (full-suite green sweep: npm test ×4 + typecheck), P1.M2.T2.S1 (README line-range section)"
---

# PRP — P1.M2.T1.S2: Gates LINE-8 / LINE-11 / LINE-12 (paged slice, past-EOF, clamped display)

> **Scope flag:** Test-only, and SMALLER than the item title suggests — **empirically discovered: LINE-8,
> LINE-8-MD, LINE-12, and LINE-11 are ALL already delivered** (the LR-1/LR-5/LR-4 implementation subtasks
> shipped their gates; all print ✓ in the current **179 passed, 0 failed** run, with coverage EXCEEDING the
> item's contract — verified clause-by-clause). So this PRP is: (1) **VERIFY** (read-only) the four landed
> gates are present, green, and contract-complete; (2) **ADD the ONE genuinely missing discriminator —
> `LINE-8b`** — because LINE-8 uses `:1-999999` (startLine=1), where the contract's sharpest clause
> ("directive offset … **FILE coordinates, not slice-relative**", feature §5) is *mathematically
> indistinguishable* from slice-relative (`1 + headLines ≡ headLines + 1`). A regression computing the
> resume from slice line 1 would still pass LINE-8. LINE-8b (`#@huge.log:3-999999`) separates the two
> formulas by exactly 2 and asserts the slice-relative fingerprint is ABSENT. **No production-code changes**
> — if any gate fails, the regression belongs to the engine (report; do NOT weaken — item §4).

---

## Goal

**Feature Goal:** Complete the LINE-8/11/12 regression-gate triplet from the Line-Range feature §9 acceptance
table: **verify** the landed LINE-8 (LR-1 paged slice: kind "paged", head + `<paged:` directive,
file-coordinate resume, `paged` incremented), LINE-8-MD (markdown variant), LINE-12 (LR-5 clamped
`:2-100000` → `:2-5`), and LINE-11 (LR-4 past-EOF: no empty block, `injected:0`, claim released, warning
notify) are present/green/contract-complete — and **add `LINE-8b`**, the `startLine>1` paged-slice case that
actually discriminates file-coordinate from slice-coordinate resume math (`resumeLine = startLine +
headLines` vs the buggy `1 + headLines`).

**Deliverable:** Modified `./file-injector.test.mjs` (the ONLY file edited): one new `runCase("LINE-8b", …)`
inserted between the `runCase("LINE-8-MD", …)` block's closing `});` and the `runCase("LINE-12", …)` line.
Everything else UNTOUCHED (LINE-1…12, LINE-8/8-MD, LINE-9/10/11/12 byte-identical).

**Success Definition:**
1. `node ./file-injector.test.mjs` → **`0 failed`**; the output contains `✓ case LINE-8`, `✓ case LINE-8-MD`,
   `✓ case LINE-11`, `✓ case LINE-12` (all already ✓ — they must remain so), **and `✓ case LINE-8b`** (new).
2. LINE-8b asserts the discriminating set under `PAGED_FIX`: `r.paged === 1`; `details[0].kind === "paged"`;
   `details[0].range === ":" + (3 + headLines) + "-"`; `details[0].pagedHeadLines === headLines`;
   the directive embeds `offset:` + (3 + headLines); and **the slice-relative fingerprint
   `offset:` + (1 + headLines) is ABSENT**.
3. LINE-8 / LINE-8-MD / LINE-11 / LINE-12 are UNMODIFIED (byte-identical before/after this task).
4. `git diff --stat file-injector.ts` is EMPTY (test-only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` (part of `npm test`, 4 files). These
gates lock the line-range feature's overflow safety (LR-1), failure feedback (LR-4), and honest display (LR-5)
so they can never silently regress.

**Use Case:** A future refactor of `emitText`'s paged-resume math runs the suite → LINE-8b catches a
slice-coordinate regression (resume pointing 2 lines too early, making the model re-read delivered lines and —
with a different startLine — silently skip content); LINE-8/8-MD catch "the slice stopped paging";
LINE-11/12 catch the empty-block/clamped-display gaps reopening.

**Pain Points Addressed:** §9's table lists LINE-7…12 as REQUIRED once LR-1..5 land. All six now exist — but
LINE-8's `startLine=1` token cannot tell file-coordinates from slice-coordinates (the exact clause the
feature spec calls out, §5: "resume offset is in **file coordinates** … so the model's `read` continues at
the correct absolute line of the original file"). LINE-8b closes that hole.

## Why

- **LINE-8b is the only assertion that can fail on the bug the spec describes.** Feature §5: a paged slice's
  directive must resume at `resumeLine = startLine + complete-lines-in-slice-head` — *file* coordinates.
  At `startLine=1`, `startLine + headLines === 1 + headLines`: the correct and the buggy formula agree, so
  LINE-8 (and LINE-8-MD, also `:1-999999`) pass under both. At `startLine=3` they differ by exactly 2, and
  the wrong value points the model's `read` two lines early — redundant tail at best, skipped content if the
  sign flipped. One case pins it.
- **LINE-8/8-MD/11/12 verification closes the item honestly.** The item's "three new runCases" predates the
  discovery that the LR-1/LR-4/LR-5 subtasks shipped their own gates (verified clause-by-clause against the
  contract — see the mapping table; LINE-11 even covers the markdown path, the 0-byte edge, and the
  start==lineCount boundary beyond the contract). Re-adding them would duplicate; the right move is
  verify + retain, then spend the one genuinely-missing assertion.
- **Cheap, surgical, zero-risk to production.** One test case reusing the existing `huge.log` fixture,
  `PAGED_FIX`, and LINE-8's own dynamic `headLines` computation. No `.ts` change; no fixture changes; no
  helper changes; no guard/module-surface edits.

## What

No user-visible/API/logic change. The test file gains ONE runCase (LINE-8b). Everything else is read-only
verification.

### Success Criteria

- [ ] `runCase("LINE-8b", …)` exists, placed after the `runCase("LINE-8-MD", …)` block's closing `});` and
      before the `runCase("LINE-12", …)` line (identifier-based placement; numeric order 8, 8-MD, 8b, 12).
- [ ] LINE-8b body: `mod.injectFiles("Summarize #@huge.log:3-999999", [], PAGED_FIX)`; `headLines` computed
      exactly as LINE-8 does (`(HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length`);
      `resumeLine = 3 + headLines`.
- [ ] LINE-8b asserts: `r.paged === 1`; `r.injected === 1`; `d.kind === "paged"`;
      `d.range === ":" + resumeLine + "-"`; `d.pagedHeadLines === headLines`;
      `r.blocks[1].includes("offset:" + resumeLine)`; **`!r.blocks[1].includes("offset:" + (1 + headLines))`**
      (the slice-relative fingerprint must be ABSENT).
- [ ] `node ./file-injector.test.mjs` → 0 failed; `✓ case LINE-8` + `✓ case LINE-8-MD` + `✓ case LINE-8b` +
      `✓ case LINE-11` + `✓ case LINE-12`.
- [ ] LINE-8 (L3086), LINE-8-MD (L3108), LINE-12 (L3117), LINE-11 (L3201) are UNMODIFIED; LINE-1…7, 9, 10
      untouched; no other case, helper, or fixture changed.
- [ ] `git diff --stat file-injector.ts` EMPTY (test-only).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the empirical discovery (all four gates landed + green at 179/0, with the
clause-by-clause contract→coverage mapping), the mathematical proof of the LINE-8 gap (`1 + headLines ≡
headLines + 1` at startLine=1 — the correct and buggy resume formulas coincide), the exact LINE-8b test body
(verbatim, reusing LINE-8's dynamic headLines computation and PAGED_FIX), the placement landmarks
(identifier-based: after LINE-8-MD's `});`, before `runCase("LINE-12"` — no collision with the landed LINE-7
slot or anything else), the failure-routing rule (a LINE-8b `offset:` failure = engine bug in emitText's
paged-range resume — report, don't weaken), and the single gate. The implementer inserts ONE test case, runs
one command, and confirms five ✓ lines.

### Documentation & References

```yaml
# MUST READ — the harness reality (runCase/FIX/hasBlock/spy pattern; budget fixtures; suite commands)
- file: plan/011_e473dac8178b/architecture/system_context.md
  why: "§5 'Test-harness reality (verified)' documents: runCase(id,desc,fn); mod.injectFiles(text,[],FIX) →
        {text,blocks,details,images,injected,paged,…}; FIX={cwd:TMPDIR} → O-1 inline fallback; PAGED_FIX
        (tokens 10000 / window 50000 / maxTokens 8192 → remaining 23,616, threshold ≈14,170 — also documented
        inside LINE-8's own comment); the notify-spy ctx (url-injection.test.mjs L703 pattern — LINE-10/11 use
        it); a.ts has 4 lines (why the 5-line gates use dedicated fixtures); npm test = 4 files."
  critical: "LINE-8b needs NO notify spy and NO handler capture (a delivery-path case on PAGED_FIX — copy
             LINE-8's direct-pipeline call shape)."

# MUST READ — the spec for the gates (§5 file-coordinate resume; §6 LR-4/LR-5; §9 table)
- file: PRD.md   # (the Line-Range feature — plan/011 delta_prd / prd_snapshot)
  why: "§5: 'the directive's resume offset is in FILE coordinates — resumeLine = startLine +
        complete-lines-in-slice-head — so the model's read continues at the correct absolute line of the
        original file' (THE clause LINE-8b discriminates; LINE-8 cannot at startLine=1). §6: LR-4 (past-EOF →
        verbatim, claim revoked, notify) + LR-5 (clamped display :2-5). §9 table rows LINE-8/11/12."
  section: "Line-Range feature §5 + §6 + §9 (LINE-8/11/12 rows)"

# MUST READ — the landed gates this task verifies (do NOT duplicate or modify)
- file: plan/011_e473dac8178b/P1M1T1S1/PRP.md   # (LR-1 — shipped LINE-8 + LINE-8-MD)
- file: plan/011_e473dac8178b/P1M1T1S2/PRP.md   # (LR-5 — shipped LINE-12)
- file: plan/011_e473dac8178b/P1M1T2S3/PRP.md   # (LR-4 — shipped LINE-11)
  why: "Each implementation subtask shipped its acceptance gate WITH the fix (commit stats confirm:
        LR-4's 2e56a86 shows file-injector.test.mjs +71). All four are LANDED and green (179/0, verified
        clause-by-clause — see the mapping table below). This task VERIFIES them — it must not re-add, move,
        or edit them."
  critical: "The LINE-8 comment in-file even says 'Formalized in P1.M2.T1.S2' — this task is the gates'
             formal owner: verify + keep green."

# The file you edit (the ONLY change — insert ONE runCase)
- file: file-injector.test.mjs
  why: "LINE-8 at L3086-3103 (the pattern to mirror: PAGED_FIX call, dynamic headLines, directive-offset
        assert); LINE-8-MD at L3108-3115 (insert AFTER its closing });); LINE-12 at L3117 (insert BEFORE its
        runCase line); LINE-11 at L3201-3230+ (verified, untouched). Helpers: runCase/assert/hasBlock;
        PAGED_FIX + HUGE_LOG_CONTENT + HUGE from buildFixtures (all in scope)."
  pattern: "Mirror LINE-8 exactly: const r = await mod.injectFiles('Summarize #@huge.log:3-999999', [],
            PAGED_FIX); const headLines = (HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length;
            assert on r.paged / d.kind / d.range / d.pagedHeadLines / blocks[1] offset — plus the
            slice-relative-fingerprint negative."
  gotcha: "PLACE BY IDENTIFIER (after the LINE-8-MD block's });, before the LINE-12 runCase) — line numbers
           drift; identifiers don't. Do NOT insert near LINE-7/LINE-9/LINE-10/LINE-11 (all landed; any edit
           there is out of scope)."

# The engine contract (read-only — what LINE-8b pins)
- file: file-injector.ts
  why: "emitText's paged-range branch computes the directive's resume in file coordinates
        (startLine + headLines) per LR-1. LINE-8b pins that math at startLine>1. Do NOT edit the .ts — if
        LINE-8b fails, the bug is an engine regression in the paged-range resume (report, don't paper over)."
  gotcha: "`git diff --stat file-injector.ts` MUST be empty."
```

### Contract → coverage mapping (why verify-only is enough for the four landed gates)

| Gate | Item contract clause | Landed coverage (verified) |
|---|---|---|
| LINE-8 | kind 'paged'; head + `<paged:` directive w/ offset = 1 + headCompleteLineCount(head); paged++ | `r.paged===1`; `d.kind==="paged"`; `d.range===":"+resumeLine+"-"`; `d.pagedHeadLines===headLines`; `blocks[1].includes("offset:"+resumeLine)`; head-block startswith `<file name="'+HUGE+'">` and is head-sized; + `d.chars===expectedSliceLen` (beyond contract) |
| LINE-8-MD | (LR-1 via markdown) | `r.paged===1 && kind 'paged'`; file-coordinate range + pagedHeadLines on the markdown slice |
| LINE-11 | no empty-body block; injected:0; claim released (same-prompt `:1` still injects); warning notify w/ line count | (a) text: injected:0, verbatim, 0 blocks/0 details, exactly one 'warning' notify, exact message `#@<abs>:99 — not injected (file has 5 lines)`; (b) claim-release: `…:99 then #@lr4_five.txt:1` → injected:1, `l1` delivered, still one warning; (c) markdown path `#@lr4.md:3` → "file has 2 lines"; + clamped-END non-failure, 0-byte edge, start==lineCount boundary |
| LINE-12 | `details[0].range === ':2-5'` (5-line file, FIX) | `d.range===":2-5"`; kind 'text'; `d.lines===4`; body `l2\nl3\nl4\nl5`; `!hasBlock("l1\n")`; prompt verbatim |

**The gap:** none of LINE-8/8-MD uses `startLine > 1`, so "file coordinates, **not slice-relative**"
(feature §5) is untested — `1 + headLines ≡ headLines + 1`. LINE-8b supplies it.

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← THE ONLY FILE EDITED (+runCase("LINE-8b") after LINE-8-MD, before LINE-12; 179 passed / 0 failed)
├── file-injector.ts          # UNCHANGED (LR-1..5 all LANDED; the contract these gates pin)
├── import-behavior.test.mjs / relative-imports.test.mjs / url-injection.test.mjs   # NOT edited
├── scripts/typecheck.mjs / package.json / PRD.md / README.md   # untouched (README is P1.M2.T2.S1)
└── plan/011_e473dac8178b/
    ├── architecture/{system_context.md, code_map.md, external_deps.md}
    ├── P1M1T1S1..S3/{PRP.md, research/}   # LR-1/LR-5 (shipped LINE-8/8-MD/12)
    ├── P1M1T2S1..S3/{PRP.md, research/}   # LR-2/LR-3/LR-4 (shipped LINE-9/10/11)
    ├── P1M2T1S1/{research, PRP.md}        # sibling (LINE-7 — LANDED; LINE-9/10 verified)
    └── P1M2T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 runCase: runCase("LINE-8b", "LR-1 file-coordinates:
                          #   #@huge.log:3-999999 → resume = 3 + headLines (slice-relative ABSENT)", …)
                          #   inserted after the LINE-8-MD block's });, before the LINE-12 runCase line.
# file-injector.ts is NEVER edited. LINE-8/8-MD/12/11 are NEVER modified. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — LINE-8, LINE-8-MD, LINE-12, and LINE-11 ALL ALREADY EXIST and pass in the current 179/0 run
//   (L3086/L3108/L3117/L3201). This task does NOT re-add them ("three new runCases" predates the discovery
//   that the implementation subtasks shipped their gates — same situation the sibling S1 hit with LINE-9/10).
//   VERIFY them (run + grep ✓) and leave them byte-identical. Duplicating = redundant cases + merge noise.

// CRITICAL — the LINE-8 gap is REAL: at startLine=1, file-coords (startLine+headLines) and slice-coords
//   (1+headLines) are the SAME NUMBER. LINE-8's offset assert cannot fail on a slice-coordinate regression.
//   LINE-8b (:3-999999) separates them by exactly 2. Both directions asserted: the correct value PRESENT
//   (offset:3+headLines) and the buggy fingerprint ABSENT (!offset:1+headLines) — the smoking-gun discipline
//   the suite already uses (cf. LINE-26's +2-bug guard).

// CRITICAL — compute headLines the SAME way LINE-8 does: (HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length.
//   The fixture is ASCII (LINE-8's comment: "ASCII → head is exactly 8192"), so this is exact. Do NOT
//   hardcode a line count; the dynamic computation is robust to fixture edits.

// GOTCHA — do NOT assert d.chars in LINE-8b. The :1- case's slice length is pinned by LINE-8
//   (content.length - 1, trailing-newline note); for :3- the arithmetic must also subtract lines 1-2 —
//   fragile, and it adds no discrimination (the range/offset asserts carry the case). Keep LINE-8b tight.

// CRITICAL — placement by IDENTIFIER: after the runCase("LINE-8-MD", …) block's closing });, BEFORE the
//   runCase("LINE-12", …) line. Do NOT insert after LINE-10/11 (landed territory), and do NOT touch the
//   landed LINE-7 slot. Zero merge friction with the (already-landed) sibling S1.

// CRITICAL — do NOT paper over a failure. If LINE-8/8-MD/12/11 (landed) or LINE-8b (new) fails, the bug
//   belongs to the LR-1/LR-4/LR-5 implementation subtasks (item §4). REPORT with the assert message — do NOT
//   weaken/skip/re-order. For LINE-8b, an offset failure = emitText computes slice-relative coordinates.

// GOTCHA — suite count is a MOVING BASELINE: currently 179; +LINE-8b → 180. The ROBUST gate is `0 failed`
//   + the five ✓ lines (LINE-8, LINE-8-MD, LINE-8b, LINE-11, LINE-12), never a fixed N.

// GOTCHA — huge.log's slice from line 3 is still ~2 MB → fileCost ~500K ≫ threshold 14,170 → it pages.
//   (PAGED_FIX: remaining 23,616; the whole-file paged path at this budget is already proven by case 20.)

// LIBRARY — zero-dep .mjs; loads the real .ts via jiti from the GLOBAL pi package (npm root -g). runCase/
//   assert/hasBlock/PAGED_FIX/HUGE_LOG_CONTENT/HUGE all exist. The gate is `node ./file-injector.test.mjs`
//   (npm test runs 4 files + typecheck — P1.M2.T1.S3's sweep, not this task's).
```

## Implementation Blueprint

### The LINE-8b test (verbatim — insert after LINE-8-MD's `});`, before the LINE-12 runCase line)

```js
// LINE-8b — LR-1 (PRD §17.5) FILE-COORDINATE discriminator: LINE-8/8-MD use :1-999999 (startLine=1), where
// the correct file-coordinate resume (startLine + headLines) and the slice-relative bug (1 + headLines) are
// the SAME NUMBER — those gates cannot fail on a slice-coordinate regression. :3-999999 separates them by
// exactly 2: the directive MUST embed offset:(3 + headLines), and the slice-relative fingerprint
// offset:(1 + headLines) MUST be absent (smoking-gun discipline, cf. LINE-26). headLines is computed the
// same dynamic way LINE-8 does (ASCII fixture → the 8192-unit head is exact). No chars assert — the :1-
// slice length is already pinned by LINE-8; for :3- the line-1/2 subtraction adds fragility, not coverage.
await runCase("LINE-8b", "LR-1 file-coordinates: #@huge.log:3-999999 → resume = 3 + headLines (slice-relative fingerprint ABSENT)", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log:3-999999", [], PAGED_FIX);
  const headLines = (HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length; // complete lines in the SLICE head
  const resumeLine = 3 + headLines;                                            // startLine=3 → FILE coordinates
  assert(r.paged === 1, `the :3- slice must PAGE under PAGED_FIX, got paged=${r.paged}`);
  assert(r.injected === 1, `one delivery (paged), got injected=${r.injected}`);
  const d = r.details[0];
  assert(d.kind === "paged", `kind must be 'paged', got '${d.kind}'`);
  assert(d.range === `:${resumeLine}-`, `range = FILE-coordinate :${resumeLine}- (3 + ${headLines}), got ${JSON.stringify(d.range)}`);
  assert(d.pagedHeadLines === headLines, `pagedHeadLines = ${headLines}, got ${d.pagedHeadLines}`);
  assert(r.blocks[1].includes("offset:" + resumeLine), `directive must resume at file line ${resumeLine} (startLine 3 + head lines)`);
  assert(!r.blocks[1].includes("offset:" + (1 + headLines)),
    `SMOKING-GUN: slice-relative offset:${1 + headLines} must be ABSENT (file coordinates, not slice-relative — PRD §17.5)`);
  assert(r.blocks[0].startsWith('<file name="' + HUGE + '">') && r.blocks[0].length < HUGE_LOG_CONTENT.length,
    "blocks[0] must be the HEAD block (of the slice), not the full content");
});
```

### Implementation Tasks (ordered)

```yaml
Task 1: ADD runCase("LINE-8b") (the ONLY edit)
  - INSERT the body above, placed AFTER the runCase("LINE-8-MD", …) block's closing `});` and BEFORE the
    `await runCase("LINE-12", …)` line (~L3115-3117). Place by IDENTIFIER (line numbers drift).
  - CTX: PAGED_FIX (direct pipeline call — mirror LINE-8; no spy, no handler capture).
  - DO NOT touch: LINE-1…7, LINE-8, LINE-8-MD, LINE-9, LINE-10, LINE-11, LINE-12, helpers, fixtures.

Task 2: VERIFY the landed LINE-8 / LINE-8-MD / LINE-11 / LINE-12 (read-only — do NOT modify)
  - RUN: node ./file-injector.test.mjs 2>&1 | grep -E "LINE-(8|8b|11|12)|Result:"
  - EXPECT: `✓ case LINE-8` + `✓ case LINE-8-MD` + `✓ case LINE-8b` (new) + `✓ case LINE-11` +
    `✓ case LINE-12` + `Result: 180 passed, 0 failed.` (The gate is 0 failed + the five ✓ lines.)
  - CROSS-CHECK (read-only) the contract mapping (the table above): LINE-8 covers kind/head/directive/paged++;
    LINE-11 covers no-empty-block + claim-release (same-prompt :1) + notify w/ line count (+ markdown path,
    0-byte edge, boundary); LINE-12 covers ':2-5' clamped (+ kind/lines/body). All exceed the contract.

Task 3: VERIFY scope + no-regression
  - git diff file-injector.test.mjs → the ONLY hunk is the inserted LINE-8b block.
  - git diff file-injector.test.mjs | grep -c "^+await runCase"  → 1 (only LINE-8b added).
  - git diff file-injector.test.mjs | grep -E "^[-+].*LINE-(8|11|12)[^b]" → NO output (landed gates untouched;
    LINE-8b's own mentions are the + lines only).
  - git diff --stat file-injector.ts → EMPTY. (Belt-and-suspenders: npm run typecheck → 0 errors.)

Task 4: IF ANY GATE FAILS — report, do not paper over
  - LINE-8/8-MD/11/12 failing = the landed LR-1/LR-4/LR-5 regressed (or were never as green as believed).
  - LINE-8b failing on `offset:` = emitText computes the paged-range resume SLICE-relative — an engine bug
    (feature §5: resumeLine = startLine + complete-lines-in-slice-head). REPORT the assert message; do NOT
    weaken/skip/re-order the test (item §4: "failures route back to the dependency subtasks").
```

### Integration Points

```yaml
FILE_EDITS (file-injector.test.mjs — the ONLY file):
  - +runCase("LINE-8b", …) between the LINE-8-MD block's closing }); and the LINE-12 runCase line.
  - UNCHANGED: LINE-1…7, LINE-8, LINE-8-MD, LINE-9, LINE-10, LINE-11, LINE-12; all helpers (runCase/assert/
    hasBlock/blocksText); all fixtures (buildFixtures — huge.log/PAGED_FIX/HUGE_LOG_CONTENT reused as-is);
    the module-surface guard (no new exports); every other case.

NO_CHANGES: file-injector.ts (git diff empty), the 3 other .mjs suites, scripts/typecheck.mjs, package.json,
            PRD.md, README.md (P1.M2.T2.S1), all plan/ files. No new fixtures (LINE-8b reuses huge.log).
            No notify spy (delivery-path case). No handler capture.
```

## Validation Loop

### Level 1: The gate — suite green + the five ✓

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "LINE-(8|8b|11|12)|Result:"
# Expected:
#   ✓ case LINE-8: LR-1: tight budget + #@huge.log:1-999999 → kind:'paged', head + directive, file-coordinate resume
#   ✓ case LINE-8-MD: LR-1 via markdown: tight budget + #@bigmd.md:1-999999 → paged (injectMarkdown re-slices in emitText)
#   ✓ case LINE-8b: LR-1 file-coordinates: #@huge.log:3-999999 → resume = 3 + headLines (slice-relative fingerprint ABSENT)
#   ✓ case LINE-11: LR-4: #@five.txt:99 (5-line file) → no block, claim released, warning notify
#   ✓ case LINE-12: LR-5: #@lr5_five.txt:2-100000 (5-line file) → range ':2-5' (display = delivered, clamped)
#   Result: 180 passed, 0 failed.
# If LINE-8b ✗ on the positive offset assert → emitText computes slice-relative coordinates: ENGINE bug — report.
# If LINE-8b ✗ on the negative (fingerprint PRESENT) → same engine bug seen from the other side — report.
# If LINE-8/8-MD/11/12 ✗ → a landed gate regressed — report (do NOT edit those cases to mask it).
```

### Level 2: Landed gates unmodified (byte-identical)

```bash
cd /home/dustin/projects/pi-file-injector
git diff file-injector.test.mjs | grep -c "^+await runCase"       # expect 1 (only LINE-8b's runCase added)
git diff file-injector.test.mjs | grep -E "^-.*LINE-"             # expect NO output (nothing removed)
git diff file-injector.test.mjs | grep -cE "^[-+].*runCase"       # expect exactly 1 (+LINE-8b only)
```

### Level 3: No-regression (the 179 baseline stays green + 1)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "✗|Result:"
# Expected: NO ✗ lines; Result: 180 passed, 0 failed. (Baseline was 179/0; +LINE-8b → 180. The gate is 0 failed.)
```

### Level 4: Scope integrity

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat file-injector.ts    # expect EMPTY (test-only)
git diff --stat                     # expect ONLY file-injector.test.mjs beyond the pre-existing working-tree state
npm run typecheck                   # belt-and-suspenders: 0 errors (no .ts change)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → 0 failed; the five ✓ lines (LINE-8, LINE-8-MD, **LINE-8b**, LINE-11, LINE-12).
- [ ] `git diff --stat file-injector.ts` EMPTY (test-only).
- [ ] (Belt-and-suspenders) `npm run typecheck` → 0 errors.

### Feature Validation (the gates)

- [ ] LINE-8b: `#@huge.log:3-999999` under PAGED_FIX → `paged===1`, `injected===1`, `kind==="paged"`,
      `range===":"+(3+headLines)+"-"`, `pagedHeadLines===headLines`, directive embeds `offset:(3+headLines)`,
      **`offset:(1+headLines)` ABSENT**, head block is head-sized.
- [ ] LINE-8 (verified, landed): `:1-999999` → kind 'paged', head + directive, resume `1+headLines`, paged++, chars.
- [ ] LINE-8-MD (verified, landed): the markdown slice pages with the same file-coordinate resume.
- [ ] LINE-11 (verified, landed): past-EOF → injected:0, 0 blocks/details, claim released (same-prompt `:1`
      injects), one 'warning' notify `#@<abs>:99 — not injected (file has 5 lines)`; + markdown path, 0-byte
      edge, boundary.
- [ ] LINE-12 (verified, landed): `:2-100000` on the 5-line fixture → `range===":2-5"`, kind 'text', lines 4,
      body l2–l5, l1 absent, prompt verbatim.

### Code Quality Validation

- [ ] LINE-8b mirrors the landed LINE-8 pattern (PAGED_FIX direct call, dynamic headLines, §-cite comments,
      assert messages that quote the contract + the expected value).
- [ ] Placement by identifier (after LINE-8-MD's `});`, before LINE-12) — numeric order, zero merge friction.
- [ ] No new fixtures/helpers; no module-surface/guard edits; no `.ts` change; landed gates byte-identical.

### Documentation

- [ ] None (tests are self-documenting — item §5; the §-cite comments in the LINE-8b body carry the rationale).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT re-add or "improve" LINE-8/8-MD/12/11.** They are LANDED (L3086/L3108/L3117/L3201), green, and
  exceed the contract (clause-by-clause mapping verified). Duplicate cases are noise; modifying them risks
  breaking a landed gate. Verify only — then add LINE-8b for the one hole.
- ❌ **Do NOT skip LINE-8b as "redundant with LINE-8".** It is NOT: at startLine=1 the file-coordinate and
  slice-coordinate resume formulas coincide (`1+headLines ≡ headLines+1`), so LINE-8/8-MD pass under the
  slice-relative bug. LINE-8b is the only gate that can fail on it.
- ❌ **Do NOT assert `d.chars` in LINE-8b.** The `:1-` slice length is LINE-8's; for `:3-` the line-1/2
  subtraction arithmetic adds fragility without discrimination. Keep the case tight.
- ❌ **Do NOT hardcode headLines or the line count.** Compute it dynamically exactly as LINE-8 does
  (`HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g)`); the ASCII-fixture comment in LINE-8 explains why it's exact.
- ❌ **Do NOT omit the smoking-gun negative.** `!blocks[1].includes("offset:" + (1 + headLines))` is the
  discriminators's other half (the suite's established discipline — cf. LINE-26's +2-bug guard). Assert BOTH
  the correct value PRESENT and the buggy fingerprint ABSENT.
- ❌ **Do NOT paper over any failure.** Item §4: failures route back to the dependency subtasks (LR-1/LR-4/LR-5,
  all LANDED). Report with the assert message; do NOT weaken/skip/re-order.
- ❌ **Do NOT insert LINE-8b after LINE-10/11 or near LINE-7.** All landed territory. Place between LINE-8-MD's
  `});` and the LINE-12 runCase (identifier-based).
- ❌ **Do NOT assert a fixed suite count.** The baseline moves (179 → 180 here; the sweep task S3 runs after).
  The gate is `0 failed` + the five ✓ lines.
- ❌ **Do NOT edit file-injector.ts** or any other file. `git diff --stat` beyond file-injector.test.mjs (vs the
  pre-existing working tree) means scope creep.

---

## Confidence Score: 9/10

The task decomposed to ONE insertion (LINE-8b) + a read-only verification of four already-landed gates —
empirically confirmed (all ✓ in the current 179/0 run, with a clause-by-clause contract→coverage mapping
showing each exceeds the item's contract). The LINE-8b body is given verbatim with the mathematical proof of
the gap it closes (`1 + headLines ≡ headLines + 1` at startLine=1 — the "FILE coordinates, not slice-relative"
clause of feature §5 is untestable at startLine=1), the both-directions assertion (correct PRESENT + buggy
fingerprint ABSENT, the suite's smoking-gun discipline), and identifier-based placement that collides with
nothing. The -1 reserves for the (unlikely but honest) possibility that LINE-8b exposes a genuine
slice-coordinate bug in emitText — in which case the correct action is reporting, not editing, per the item's
explicit failure-routing rule — and for minor line-number drift (mitigated by identifier-based placement).
The implementing agent inserts ONE test case, runs one command, and confirms five ✓ lines.