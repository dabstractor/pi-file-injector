---
name: "P1.M2.T2.S1 (Bugfix) — Add Unicode word-boundary regression test cases (U1) to the harness"
prd_ref: "Bug-fix PRD §Issue 5 (#@ triggers after non-ASCII word characters), §Overview, §Testing Summary ('Test Harness Gaps' #3 'No Unicode boundary test')"
target_file: "./file-injector.test.mjs (insert ONE new runCase block 'U1' after the F4 case, before the summary section)"
change_type: ONE additive edit — insert a new `U1` case block (5 sub-assertions) at the end of the regression group. Case count 30 → 31.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T2.S1 (Unicode-aware FILE_INJECT_RE — Complete, ALREADY LIVE at file-injector.ts line 8) + P1.M2.T1.S1 (F1/F1b/F2 harness rewrite — Complete, harness now 30 cases). This task consumes BOTH landed changes."
fixes: "Closes Bug-fix PRD §Testing Summary → 'Test Harness Gaps' #3 (No test covers café#@file or CJK text before #@). The fix itself landed in P1.M1.T2.S1; this task adds the permanent regression test."
---

# PRP — P1.M2.T2.S1 (Bugfix): Add Unicode `#@` word-boundary regression tests (`U1`)

## Goal

**Feature Goal**: Add ONE new regression test-case block — **`U1`** ("Unicode word-boundary") — to the
model-free harness `file-injector.test.mjs`, permanently pinning the **Issue 5** fix (the
Unicode-aware `FILE_INJECT_RE` already live at `file-injector.ts` line 8). The `U1` block contains 5
sub-assertions: the two THE-FIX cases (café/CJK no longer trigger mid-word) plus three regression
guards (ASCII-space boundary, start-of-string, and ASCII mid-word still blocked), each calling
`mod.injectFiles(input, [], FIX)` and checking **both `r.injected` and `r.text`**.

**Deliverable**: ONE additive `edit` to `./file-injector.test.mjs` — insert the `U1` block immediately
after the `F4` case (end of the regression group) and immediately before the `// 10. Summary + cleanup + exit.`
section header. **No other file changes. No `.ts` edits. No README edits. No changes to any existing
case, fixture, helper, or the summary/cleanup.** The `runCase` count goes **30 → 31**.

**Success Definition**:
- [ ] `grep -cE 'await runCase\(' file-injector.test.mjs` prints **31** (was 30): only `U1` added.
- [ ] `node ./file-injector.test.mjs` prints **`Result: 31 passed, 0 failed.`** and exits 0 — against
      the ALREADY-FIXED `file-injector.ts` (Unicode regex live).
- [ ] The `U1` block is present and labeled: `await runCase("U1", "U1 — Unicode word-boundary: #@ does not fire mid-word in any language", async () => { … })`.
- [ ] `U1` asserts EXACTLY the 5 contract inputs: (a) `café#@a.ts`→`injected===0`+text verbatim;
      (b) `日本語#@a.ts`→`injected===0`+text verbatim; (c) `Review #@a.ts`→`injected===1`+block present;
      (d) `#@a.ts`→`injected===1`+block present; (e) `foo#@bar`→`injected===0`+text verbatim.
- [ ] Each of the 5 sub-asserts calls `mod.injectFiles(input, [], FIX)` and checks BOTH `r.injected`
      and `r.text` (no other layer/helper/captured-handler involved in `U1`).
- [ ] All 30 pre-existing cases still pass unchanged (no collateral damage from the insertion).

> **Scope boundary (read carefully):** This task edits ONLY `file-injector.test.mjs`, and ONLY inserts
> the `U1` block at the end of the regression group (after `F4`). It does **NOT**: (a) touch
> `file-injector.ts` — the Unicode regex fix is **already live** (P1.M1.T2.S1 = Complete); (b) touch
> `README.md` — the Unicode-aware "Where it matches" sentence was already added by P1.M1.T2.S1; any
> further README sweep is P1.M3.T1/T2; (c) add co-load/dedup/sentinel cases — those are P1.M2.T1.S1
> (already landed); (d) edit any existing case (1-14, E1-E4, G1-G3, H1, M1, F1, F1b, F2, F3a, F3b, F5,
> F4), the fixture setup, the helpers, or the summary/cleanup; (e) introduce a block-count helper or
> new fixture — reuse the existing `A_TS`/`FIX` inline.

## User Persona

**Target User**: The maintainer (and the CI/harness) who needs the harness to *catch regressions* of
the Issue 5 bug (the old ASCII-only `\W` lookbehind let `café#@secret.txt` / `日本語#@file` trigger
mid-word). Also the next implementer who, reading `U1`, understands the exact boundary semantics of
the current Unicode-aware regex.

**Use Case**: Run `node ./file-injector.test.mjs` as the gate after any change to `file-injector.ts`.
The `U1` case must fail loudly if someone reverts the regex to the ASCII-only `/(^|(?<=\W))#@(\S+)/g`
(café/CJK sub-asserts would inject) OR breaks the `^` alternation / capture-group structure (the
`Review #@a.ts` / `#@a.ts` regression guards would stop matching).

**Pain Points Addressed**: The Bug-fix PRD §Testing Summary calls out "Test Harness Gaps" #3 — "No
Unicode boundary test: no test covers `café#@file` or CJK text before `#@`." The fix shipped in
P1.M1.T2.S1 WITHOUT a permanent harness case (verified only via a throwaway Level-3 script, per the
sibling-PRP precedent that harness edits belong to M2.*). This task closes that gap with a
deterministic, hermetic, model-free `U1` case.

## Why

- **The Issue 5 fix has no permanent regression test.** P1.M1.T2.S1 landed the Unicode-aware regex
  (`/(?<![\p{L}\p{N}_])/…/gu`) and verified it 18/18 via a throwaway script — but deliberately did NOT
  touch the harness (it explicitly deferred café/CJK harness cases to "P1.M2.T2.S1"). Without a
  permanent case, a future revert of the regex would go uncaught by the harness.
- **`U1` pins the exact boundary semantics.** Two sub-asserts prove the FIX (café/CJK no longer fire
  mid-word); three sub-asserts are regression GUARDS that prove the fix did not over-block (space
  boundary and start-of-string still match) and did not change ASCII behavior (mid-word still blocked).
  This mirrors how `F1b`/`F2` pin Issues 1 & 2 (a precedent set by the parallel sibling P1.M2.T1.S1).
- **Deterministic & hermetic.** `U1` reuses the existing jiti-imported `injectFiles` + the existing
  `a.ts` fixture (`A_TS`, `FIX`). No model, no API key, no Pi process, no network — it fits the
  harness's "model-free gate" ethos exactly.

## What

One `edit` to `./file-injector.test.mjs`: insert the `U1` block (exact source in
`Implementation Blueprint → Exact source to write`) immediately after the `F4` case and immediately
before the `// 10. Summary + cleanup + exit.` section header. Net `runCase` delta: **+1**.

### Success Criteria
- [ ] 31 cases total; `node ./file-injector.test.mjs` → `31 passed, 0 failed`, exit 0.
- [ ] `U1` asserts exactly the 5 contract inputs/behaviors listed under Goal.
- [ ] Each sub-assert checks both `r.injected` and `r.text`.
- [ ] All 30 pre-existing cases still pass unchanged.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the exact `oldText` (the unique 3-line summary-section
> header, read byte-for-byte from the file) and the exact `newText` (the `U1` block + the same
> header), ready to paste into a single `edit` call. All 11 sub-assertions (the 5 contract inputs ×
> their injected+text checks) have been **pre-verified green** against the live fixed extension via a
> throwaway script mirroring the harness's exact jiti+alias import. The harness conventions
> (`runCase`/`assert`, the in-scope `mod`/`TMPDIR`/`A_TS`/`FIX`) are documented. No model/API key
> needed.

### Documentation & References
```yaml
# MUST READ — this task's verified research (assertions pre-checked 11/11 against the live extension)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M2T2S1/research/research_notes.md
  why: "§2 confirms the baseline (harness 30 cases, U1/café/CJK absent — clean); §3 the exact insertion
        point (after F4, before the summary header, lines 587-591); §4 the 11/11 pre-pass; §5 the
        harness conventions reused; §6 the scope boundaries (NO .ts/README/existing-case edits)."
  critical: "The 5 no-match/match assertions are pre-verified. For no-match cases assert r.text ===
        <input> (verbatim); for match cases assert r.text includes '<file name=\"' + A_TS + '\">'. Do
        NOT add a handler/captured-slot layer to U1 — the contract is injectFiles-only."

# MUST READ — the bug context (why U1 exists)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "§Issue 5 is this task's acceptance criteria; §Testing Summary 'Test Harness Gaps' #3 is the
        gap U1 closes."
  section: "Issue 5, Testing Summary"

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'Unicode Regex Fix (Issue 5)' — the verified Node.js behavior table (café/CJK FIXED; ASCII
        Review/@start/foo#@bar preserved) and the exact old/new regex. Confirms the U1 assertions."
  section: "Unicode Regex Fix (Issue 5), Test Harness Gaps"

# MUST READ — the dependency that makes U1 pass (ALREADY LIVE)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M1T2S1/PRP.md
  why: "The Unicode-regex PRP. It landed `const FILE_INJECT_RE = /(^|(?<![\\p{L}\\p{N}_]))#@(\\S+)/gu;`
        at file-injector.ts line 8 AND the README 'Unicode-aware' sentence, and EXPLICITLY deferred
        café/CJK HARNESS additions to 'P1.M2.T2.S1' (THIS task). Confirms the .ts + README work is done
        and out of scope here."
  critical: "Do NOT re-edit the regex or the README — both are landed and complete. This task ONLY adds
        the harness U1 case that P1.M1.T2.S1 deferred to it."

# MUST READ — the parallel sibling contract (so we do NOT collide)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M2T1S1/PRP.md
  why: "The dedup/sentinel harness PRP (F1/F1b/F2). It edits the F1 BLOCK (lines ~491-516 region),
        which is DISJOINT from this task's insertion anchor (after F4, ~line 587). It owns F1/F1b/F2;
        THIS task owns U1. No region overlap."
  critical: "Do NOT touch F1/F1b/F2 (P1.M2.T1.S1's scope, already landed). U1 is appended AFTER F4,
        the last case before the summary section — a different, non-overlapping region."

# The file being EDITED
- file: ./file-injector.test.mjs
  why: "The 30-case model-free harness. The insertion anchor is the unique 3-line summary-section
        header (lines 589-591: '// 10. Summary + cleanup + exit.' between two U+2500 dash lines)."
  pattern: "runCase(label, name, async () => { ... assert(cond, msg) ... }). Reuses module-scope
            mod, TMPDIR, A_TS, FIX; helpers makeMockCtx/captureHandler/assert (U1 needs only assert +
            mod.injectFiles + A_TS + FIX)."
  gotcha: "U1 is injectFiles-ONLY (no captured handler/makeMockCtx/notify layer) — the contract
           specifies `mod.injectFiles(input, [], FIX)` for all 5 sub-asserts. The em dash (U+2014 —)
           appears in the U1 case NAME and comments; the box-drawing dash (U+2500 ─) appears in the
           section-comment separators and the anchor. Do NOT confuse the two glyphs when matching the
           anchor (the anchor is pure U+2500 + ASCII). The label 'U1' is UNUSED today
           (grep-confirmed) — no collision."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-file-injector
.
├── PRD.md                       # original feature PRD (read-only; not this task's PRD)
├── README.md                    # extension docs — NOT edited here (P1.M1.T2.S1 already added the
│                                #                          'Unicode-aware' sentence; P1.M3 owns the rest)
├── file-injector.ts             # ALREADY FIXED (Unicode regex LIVE at line 8; dedup line ~143;
│                                #                       sentinel gone). DO NOT EDIT.
├── file-injector.test.mjs       # ← EDIT: insert the U1 block after F4, before the summary header (+1 → 31).
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/{system_context.md, code_changes_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}     # per-token dedup — DONE (in .ts)
    ├── P1M1T1S2/{PRP.md, research/}     # sentinel removal — DONE (in .ts)
    ├── P1M1T2S1/{PRP.md, research/}     # Unicode regex + README sentence — DONE; deferred café/CJK
    │                                    #   harness cases to THIS task (M2.T2.S1)
    ├── P1M2T1S1/{PRP.md, research/}     # F1/F1b/F2 harness cases — DONE (harness now 30 cases)
    └── P1M2T2S1/
        ├── research/research_notes.md   # THIS TASK's research (assertions pre-verified 11/11)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
└── file-injector.test.mjs       # MODIFIED — U1 block inserted after F4 (+1 case → 31 total).
# No new files. No .ts / README / PRD / tasks.json changes.
```

### Known Gotchas of our codebase & Library Quirks
```javascript
// CRITICAL — the Unicode regex this case depends on is ALREADY LIVE (file-injector.ts line 8):
//   const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
// Confirm it (PRE-FLIGHT) before editing. If it is NOT live, U1's café/CJK sub-asserts will FAIL —
// that means P1.M1.T2.S1 regressed, NOT that U1 is wrong. This task assumes the fix is present.

// CRITICAL — U1 is injectFiles-ONLY. Do NOT add a captured-handler/makeMockCtx/notify layer. The
// contract specifies `mod.injectFiles(input, [], FIX)` for ALL 5 sub-asserts, checking r.injected +
// r.text. (Contrast F1/F1b/F2, which DO exercise the handler — those are P1.M2.T1.S1's scope.)

// CRITICAL — for no-match cases (a, b, e) assert r.text === <input> BYTE-FOR-BYTE (verbatim). This is
// the harness convention for "no match" (cases 5/6/7/8/E3/E4). For match cases (c, d) assert
// r.injected===1 AND r.text.includes('<file name="' + A_TS + '">'). (c) also asserts the original
// prompt is preserved at the start (case-1/12/13 convention).

// GOTCHA — two different dash glyphs are near the edit region:
//   • U+2014 '—' (em dash): used in case NAMES/comments, including U1's name and comments.
//   • U+2500 '─' (box-drawing horizontal): used in section-comment separators, including the anchor.
// The edit ANCHOR (oldText below) is pure U+2500 dash lines + ASCII ("10. Summary + cleanup + exit.").
// Do NOT substitute one dash for the other when matching — the edit tool compares bytes.

// GOTCHA — the label 'U1' is unused in the harness today (grep-confirmed). Do NOT collide with the
// PRD case numbers (1-14) — string labels (E1/G1/F1/M1/U1) are the harness's convention for non-PRD
// cases; U1 follows it exactly.

// GOTCHA — the .ts line-8 regex and the README 'Unicode-aware' sentence are NOT this task's to touch.
// P1.M1.T2.S1 landed them and is Complete. Editing them here collides with that sibling task.

// IDEMPOTENCY — if the harness ALREADY shows U1 (a prior pass), the oldText anchor (the summary
//   header) will STILL match (U1 is inserted BEFORE it, so the header is unchanged), but the case
//   count will already be 31. The PRE-FLIGHT idempotency guard handles this: if U1 exists and the
//   harness is 31/31, the task is done — do NOT force a second insertion (it would create a DUPLICATE
//   U1, making the count 32 and the duplicate's assertions still pass but the count wrong).
```

## Implementation Blueprint

### Data models and structure
None. No data model, type, signature, or control-flow change. This is ONE `runCase` block (`"U1"`)
using the harness's existing `assert` helper and the existing `a.ts` fixture (`A_TS`, `FIX = { cwd: TMPDIR }`).

### Implementation Tasks (ordered by dependencies)
```yaml
PRE-FLIGHT:
  - IDEMPOTENCY GUARD (run FIRST — a prior pass may have already landed U1):
      if grep -qE 'await runCase\("U1"' file-injector.test.mjs; then
        echo "U1 already present → task already complete; verifying and STOPPING."
        [ "$(grep -cE 'await runCase\(' file-injector.test.mjs)" = "31" ] && node ./file-injector.test.mjs && exit 0
        # if count != 31 OR harness fails, re-read the file (a partial/duplicate U1 exists).
      fi
    (If this guard fires AND the harness is 31/31, NOTHING more to do. Do NOT insert U1 again.)
  - CONFIRM the dependency (the regex this case asserts) is LIVE:
      grep -qE 'const FILE_INJECT_RE = /\(\^\|\(\?<!\[\\p\{L\}\\p\{N\}_\]\)\)#@\(\\S\+\)/gu' file-injector.ts \
        && echo "Unicode regex live" || echo "MISSING regex — P1.M1.T2.S1 regressed; U1 will FAIL"
  - CONFIRM no U1 collision (baseline 30-case state):
      grep -nE 'await runCase\("U1"' file-injector.test.mjs   # → (none) at baseline
    CONFIRM baseline case count:
      grep -cE 'await runCase\(' file-injector.test.mjs       # → 30
    CONFIRM the insertion anchor is present & unique:
      grep -ncF '// 10. Summary + cleanup + exit.' file-injector.test.mjs   # → 1

Task 1: EDIT ./file-injector.test.mjs — insert the U1 block before the summary section header
  - OBJECTIVE: Add the U1 regression case (Issue 5) with the 5 contract sub-assertions.
  - FIND (exact oldText — the unique 3-line summary-section header, lines 589-591):
        <see "Exact source to write" → oldText below>
  - REPLACE WITH (exact newText — the U1 block + the same 3-line header):
        <see "Exact source to write" → newText below>
  - DO NOT alter any other line, case, fixture, helper, comment, or the summary/cleanup.
  - DO NOT add imports, fixtures, or a handler/captured-slot layer (U1 is injectFiles-only).

POST-FLIGHT:
  - grep -cE 'await runCase\(' file-injector.test.mjs   # → 31 (was 30)
  - grep -nE 'await runCase\("U1"' file-injector.test.mjs   # → 1 line
  - Run the Validation Loop gates (Level 1 + Level 2).

DO NOT (out of scope — owned by sibling tasks):
  * Edit file-injector.ts (Unicode regex is live; P1.M1.T2.S1 = Complete).
  * Edit README.md (P1.M1.T2.S1 added the 'Unicode-aware' sentence; P1.M3 owns the rest).
  * Touch F1/F1b/F2 (P1.M2.T1.S1, Complete) or any existing case.
  * Add a co-load/dedup/sentinel case (P1.M2.T1.S1's scope, already landed).
```

### Exact source to write (authoritative — copy verbatim into ONE `edit` call)

**`oldText`** — the unique 3-line summary-section header (it is the ONLY occurrence of
"10. Summary + cleanup + exit." in the file; the separator lines are U+2500 box-drawing dashes):
```javascript
// ──────────────────────────────────────────────────────────────────────────────
// 10. Summary + cleanup + exit.
// ──────────────────────────────────────────────────────────────────────────────
```

**`newText`** — the `U1` block inserted BEFORE the same header (all assertions pre-verified green
11/11 against the live fixed extension; the em dashes in the name/comments are U+2014, matching the
harness's other case names):
```javascript
// ── U1: Unicode word-boundary regression (Issue 5) ────────────────────────────
await runCase("U1", "U1 — Unicode word-boundary: #@ does not fire mid-word in any language", async () => {
  // Issue 5 regression guard. FILE_INJECT_RE is now /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu (P1.M1.T2.S1): the
  // `u` flag enables Unicode property escapes, and the negative lookbehind treats Unicode letters /
  // numbers / underscore as word chars. So #@ no longer triggers after non-ASCII letters (é, ö, ñ, CJK,
  // …). Each sub-assert calls injectFiles and checks BOTH r.injected and r.text (verbatim for no-match).
  // (a) THE FIX: é is a Unicode letter → #@ is mid-word in café#@a.ts → NO match → injected===0, text verbatim.
  let r = await mod.injectFiles("café#@a.ts", [], FIX);
  assert(r.injected === 0, `(a) café#@a.ts must NOT inject (é is a Unicode letter, mid-word), got ${r.injected}`);
  assert(r.text === "café#@a.ts", `(a) café#@a.ts text must be unchanged when not matched`);
  // (b) THE FIX: CJK characters are Unicode letters → 日本語#@a.ts is mid-word → NO match → injected===0, text verbatim.
  r = await mod.injectFiles("日本語#@a.ts", [], FIX);
  assert(r.injected === 0, `(b) 日本語#@a.ts must NOT inject (CJK are Unicode letters, mid-word), got ${r.injected}`);
  assert(r.text === "日本語#@a.ts", `(b) 日本語#@a.ts text must be unchanged when not matched`);
  // (c) REGRESSION GUARD: a SPACE before #@ is a boundary → Review #@a.ts still injects → injected===1.
  r = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(r.injected === 1, `(c) Review #@a.ts must inject (space before #@ is a boundary), got ${r.injected}`);
  assert(r.text.startsWith("Review #@a.ts"), `(c) original prompt must be preserved verbatim at start`);
  assert(r.text.includes('<file name="' + A_TS + '">'), `(c) injected text must contain the a.ts <file> block`);
  // (d) REGRESSION GUARD: start-of-string (^ alternation) → #@a.ts still injects → injected===1.
  r = await mod.injectFiles("#@a.ts", [], FIX);
  assert(r.injected === 1, `(d) #@a.ts must inject (start-of-string boundary), got ${r.injected}`);
  assert(r.text.includes('<file name="' + A_TS + '">'), `(d) injected text must contain the a.ts <file> block`);
  // (e) REGRESSION GUARD: ASCII mid-word is STILL blocked → foo#@bar → NO match → injected===0, text verbatim.
  r = await mod.injectFiles("foo#@bar", [], FIX);
  assert(r.injected === 0, `(e) foo#@bar must NOT inject (ASCII mid-word, still blocked), got ${r.injected}`);
  assert(r.text === "foo#@bar", `(e) foo#@bar text must be unchanged when not matched`);
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. Summary + cleanup + exit.
// ──────────────────────────────────────────────────────────────────────────────
```

### Implementation Patterns & Key Details
```javascript
// PATTERN (no-match assertion): for inputs where #@ must NOT trigger, assert BOTH injected===0 AND
// r.text === <input> byte-for-byte (verbatim). This is the harness convention for "no match" (cases
// 5/6/7/8/E3/E4). Sub-asserts (a), (b), (e) use it. The verbatim check is the real proof — injected===0
// alone could pass even if the text were mangled; the equality pins "nothing changed."

// PATTERN (match assertion): for inputs where #@ MUST trigger, assert BOTH injected===1 AND
// r.text.includes('<file name="' + A_TS + '">'). Sub-asserts (c), (d) use it. (c) additionally asserts
// the original prompt is preserved at the start (r.text.startsWith("Review #@a.ts")), matching cases
// 1/12/13. (d) does not assert startsWith because the input IS the token (#@a.ts has no leading text).

// PATTERN (regression-guard intent): the 5 sub-asserts are a balanced set — 2 prove the FIX (café/CJK
// now blocked), 3 prove the fix did not over-block (space boundary + start-of-string still match;
// ASCII mid-word still blocked). If someone reverts to /(^|(?<=\W))#@(\S+)/g, (a) and (b) FAIL
// (injected===1). If someone over-corrects (e.g. drops the ^ alternation), (d) FAILS (injected===0).
// If someone breaks ASCII matching, (c)/(e) FAIL.

// GOTCHA: U1 does NOT use makeMockCtx/captureHandler/notify. It is purely an injectFiles-layer test
// (the contract specifies mod.injectFiles(input, [], FIX) for all 5 sub-asserts). Contrast F1/F1b/F2,
// which DO exercise the handler — those are P1.M2.T1.S1's scope, already landed.

// GOTCHA: the café (é, U+00E9) and 日本語 (CJK) literals are multi-byte UTF-8 in the source. The harness
// file is UTF-8; pasting them verbatim is correct (Node reads .mjs as UTF-8). Do NOT escape them to
// \uXXXX — the sibling cases (E3/F3a/F5) use \u2014 for the em dash ONLY inside string bodies; the
// café/CJK literals here are fine as raw UTF-8 (matches the Issue 5 repro in the PRD).
```

### Integration Points
```yaml
NO NEW INTEGRATION POINTS:
  - "Pure test-harness edit. No new imports, fixtures, helpers, config, or env vars."
  - "Consumes the ALREADY-FIXED file-injector.ts (Unicode regex live at line 8)."
  - "If the .ts regex is later reverted to the ASCII-only /(^|(?<=\W))#@(\S+)/g, U1 sub-asserts (a) and
     (b) FAIL loudly (café/CJK inject) — that is the intended regression signal."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker**. The gate is the model-free Node ESM
> harness itself (`file-injector.test.mjs`). The Python `pytest`/`mypy`/`ruff` gates from the base
> template DO NOT APPLY. The gates below are project-specific and **verified on this machine**.

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-file-injector

# 1a. Case count is now 31 (was 30): only U1 added.
[ "$(grep -cE 'await runCase\(' file-injector.test.mjs)" = "31" ] && echo "OK: 31 cases" || echo "FAIL: case count != 31"

# 1b. The U1 block is present (exactly ONE occurrence — guards against a duplicate insertion).
[ "$(grep -cE 'await runCase\("U1"' file-injector.test.mjs)" = "1" ] && echo "OK: exactly 1 U1" || echo "FAIL: U1 count != 1"

# 1c. The U1 case name is correct (asserts the Unicode-boundary intent).
grep -qE 'await runCase\("U1", "U1 — Unicode word-boundary: #@ does not fire mid-word in any language"' file-injector.test.mjs \
  && echo "OK U1 name" || echo "FAIL U1 name"

# 1d. All 5 contract inputs are present in U1 (café, 日本語, Review #@a.ts, #@a.ts, foo#@bar).
for s in 'café#@a.ts' '日本語#@a.ts' 'Review #@a.ts' '"#@a.ts"' 'foo#@bar'; do
  grep -qF "$s" file-injector.test.mjs && echo "OK: $s present" || echo "FAIL: $s missing"
done

# 1e. No .ts / README change (regression: the dependency edits belong to P1.M1.T2.S1, already landed).
git diff --name-only 2>/dev/null | grep -E 'file-injector.ts|README.md' \
  && echo "FAIL: .ts/README unexpectedly changed" || echo "OK: only .test.mjs changed (or git unavailable)"

# Expected: 31 cases; exactly 1 U1; U1 name correct; all 5 inputs present; no .ts/README change.
```

### Level 2: Full Harness (Component Validation — PRIMARY GATE)
```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 31 passed, 0 failed." exit 0.
# The U1 line prints: "  ✓ case U1: U1 — Unicode word-boundary: #@ does not fire mid-word in any language".
# If U1 FAILS on (a)/(b): the .ts regex was reverted to ASCII-only /(^|(?<=\W))#@(\S+)/g — re-check
#   `grep -nE 'FILE_INJECT_RE = /.+\\p\{L\}.+/gu' file-injector.ts` (must print 1 line with /gu).
# If U1 FAILS on (c)/(d): the regex's ^ alternation or capture-group structure was broken — re-read
#   file-injector.ts line 8 + the matchAll consumer (~line 131).
# If U1 FAILS on (e): ASCII mid-word matching regressed — same re-check as (c)/(d).
# If a PRE-EXISTING case FAILS: the edit accidentally damaged an adjacent region (e.g. pasted U1 in the
#   wrong place, or mangled the summary header) — re-read the diff.
```

### Level 3: Targeted Behavior Re-check (NON-INTERACTIVE, NO MODEL — optional confidence)
The exact U1 assertions were pre-verified green (11/11) via a throwaway script that mirrors the
harness's jiti+alias import. To re-confirm in isolation (does NOT touch the harness):
```bash
cd /home/dustin/projects/pi-file-injector
# (See research/research_notes.md §4 for the verified 11-assertion script; or simply trust Level 2,
#  which runs the identical assertions inside the real harness.) Level 2 is authoritative.
```

### Level 4: Regression Intent (optional — proves the case WOULD fail on the buggy code)
This case is a regression test; it must fail against the BUGGY (pre-fix) behavior. Not required to
run, but documents the intent:
- **U1 (a)/(b) fail on buggy code**: if the regex were the old `/(^|(?<=\W))#@(\S+)/g` (no `u`, ASCII
  `\W`), then `é`/CJK are classified as non-word → the lookbehind passes → `café#@a.ts` and
  `日本語#@a.ts` match → `injected===1` and text is transformed (NOT verbatim). Both sub-asserts FAIL.
- **U1 (c)/(d)/(e) pass on both buggy and fixed code**: these are PARITY guards (ASCII behavior is
  unchanged by the fix), so they pass regardless — they guard against a future OVER-correction.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: 31 cases; exactly ONE `U1`; U1 name correct; all 5 inputs present; no `.ts`/README change.
- [ ] Level 2: `node ./file-injector.test.mjs` → **31 passed, 0 failed**, exit 0.

### Feature Validation
- [ ] `U1` (a): `mod.injectFiles("café#@a.ts", [], FIX)` → `injected===0` AND `r.text === "café#@a.ts"`.
- [ ] `U1` (b): `mod.injectFiles("日本語#@a.ts", [], FIX)` → `injected===0` AND `r.text === "日本語#@a.ts"`.
- [ ] `U1` (c): `mod.injectFiles("Review #@a.ts", [], FIX)` → `injected===1` AND `r.text.startsWith("Review #@a.ts")` AND `r.text` includes the `<file name="<A_TS>">` block.
- [ ] `U1` (d): `mod.injectFiles("#@a.ts", [], FIX)` → `injected===1` AND `r.text` includes the `<file name="<A_TS>">` block.
- [ ] `U1` (e): `mod.injectFiles("foo#@bar", [], FIX)` → `injected===0` AND `r.text === "foo#@bar"`.
- [ ] All 30 pre-existing cases still pass (no collateral damage).

### Code Quality Validation
- [ ] Only the `U1` block was inserted (before the summary header); no other line/case/fixture/helper/summary touched.
- [ ] `U1` reuses `assert` + `mod.injectFiles` + `A_TS` + `FIX` only (no new imports, fixtures, helpers, handler/captured-slot layer).
- [ ] No new module-level state; case label `U1` does not collide (grep-confirmed unused before the edit).
- [ ] No `.ts`/README/PRD/tasks.json changes.

### Documentation & Deployment
- [ ] No new env vars / config / API surface (pure harness edit).
- [ ] The `U1` case name/comment name the Issue it regresses (Issue 5) for future readers.
- [ ] The café/CJK literals are raw UTF-8 (matching the Issue 5 repro in the PRD), not `\u`-escaped.

---

## Anti-Patterns to Avoid
- ❌ Don't edit `file-injector.ts` — the Unicode regex fix is **already live** (P1.M1.T2.S1 = Complete).
  Editing it here collides with that sibling task and is out of scope.
- ❌ Don't edit `README.md` — the "Unicode-aware" sentence was already added by P1.M1.T2.S1; the
  remaining README sweep is P1.M3.T1/T2.
- ❌ Don't touch `F1`/`F1b`/`F2` (P1.M2.T1.S1, Complete) or any existing case — `U1` is INSERTED after
  `F4` and before the summary header; it must not modify any other region.
- ❌ Don't add a handler/captured-slot/notify layer to `U1` — the contract specifies
  `mod.injectFiles(input, [], FIX)` for all 5 sub-asserts (injectFiles-only). The handler layer is
  F1/F1b/F2's scope.
- ❌ Don't assert `r.injected` alone for no-match cases — also assert `r.text === <input>` byte-for-byte
  (the verbatim check is the real proof of "no match"). The harness convention (cases 5/6/7/8/E3/E4).
- ❌ Don't `\u`-escape the café (é) / 日本語 literals — paste them raw UTF-8 (the harness file is UTF-8,
  and this matches the Issue 5 repro in the PRD). Only the em dash (—) inside string BODIES is
  `\u2014`-escaped elsewhere in the harness (E3/F3a/F5); the café/CJK inputs are fine raw.
- ❌ Don't confuse the two dash glyphs near the edit region: U+2014 `—` (em dash, in case names/comments)
  vs U+2500 `─` (box-drawing, in section-comment separators + the anchor). The `oldText` anchor uses
  U+2500 + ASCII; match it byte-for-byte.
- ❌ Don't insert `U1` twice — the PRE-FLIGHT idempotency guard detects an existing `U1`. A second
  insertion creates a duplicate (count 32) that still passes assertions but breaks the count contract.
- ❌ Don't change the case-count expectation to anything other than 31 (30 + 1). If you find 32/30, you
  duplicated or dropped a case unintentionally — re-read the diff.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a single additive `edit` to one `.mjs` harness file, inserting ONE `runCase` block
(`U1`) before a unique, stable 3-line anchor (the summary-section header — the ONLY occurrence of
"10. Summary + cleanup + exit." in the file). Every one of the 11 sub-assertions (the 5 contract
inputs × their injected+text checks) has been **pre-verified green (11/11)** against the live fixed
extension via a throwaway script mirroring the harness's exact jiti+alias import. The new case reuses
only existing helpers (`assert`) and existing fixtures (`a.ts`/`A_TS`/`FIX`) — no new imports,
fixtures, helpers, or state, and no handler/captured-slot layer (the contract is injectFiles-only).
The scope is crisply disjoint from all siblings: the `.ts` regex + README sentence are already landed
(P1.M1.T2.S1 = Complete); the dedup/sentinel harness cases (F1/F1b/F2) are already landed
(P1.M2.T1.S1 = Complete) on a disjoint region; `U1` is appended after `F4` with no overlap. The
dependency this task requires (the Unicode regex at `file-injector.ts` line 8) is **already present and
confirmed**. The residual 0.5 is for a possible transcription slip (wrong dash glyph in the anchor,
duplicate insertion, or pasting U1 in the wrong region) — fully caught by Level-1 (case count = 31,
exactly ONE `U1`, all 5 inputs present, no `.ts`/README change) + Level-2 (full harness must report
31/31).
