---
name: "P1.M2.T1.S1 (Bugfix) — Rewrite F1 test + add co-load (F1b) & sentinel-in-prompt (F2) harness cases"
prd_ref: "Bug-fix PRD §Issue 1 (duplicate injection / co-load), §Issue 2 (sentinel-in-prompt false-negative), §Issue 6 (assembly format), §Testing Summary ('Test Harness Gaps')"
target_file: "./sharp-at-file.test.mjs (the F1 block, lines ~491-516)"
change_type: ONE in-place edit — replace the current `F1` case with the rewritten `F1` + new `F1b` + new `F2`. Case count 28 → 30.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1 (per-token dedup — Complete) + P1.M1.T1.S2 (sentinel removal — Complete): both ALREADY LANDED in sharp-at-file.ts. P1.M1.T2.S1 (Unicode regex) also landed in file. This task consumes that fixed source."
fixes: "Closes the harness blind spots that let Issues 1 & 2 slip through (Bug-fix PRD §Testing Summary → 'Test Harness Gaps' #1 co-load, #2 sentinel-in-prompt)."
---

# PRP — P1.M2.T1.S1 (Bugfix): Rewrite F1 + add F1b (co-load) + F2 (sentinel-in-prompt)

## Goal

**Feature Goal**: Update the model-free harness `sharp-at-file.test.mjs` so its `F1` case reflects the
**new per-token dedup** mechanism (the sentinel is gone) and add two regression cases for the two
sentinel-rooted bugs the old harness missed: **F1b** (Issue 1 — co-load double-injection) and **F2**
(Issue 2 — sentinel string in the user prompt silently disabling all `#@` injection). The current `F1`
case still references the "sentinel" in its name/comment and passes only by accident (the dedup path);
it must be rewritten to assert the dedup path explicitly.

**Deliverable**: ONE in-place edit to `./sharp-at-file.test.mjs` — replace the entire current `F1`
block (lines ~491-516, unique anchor) with the rewritten `F1` + the new `F1b` + the new `F2`. **No
other file changes. No `.ts` edits. No Unicode tests (those are P1.M2.T2.S1).** The `runCase` count
goes **28 → 30**.

**Success Definition**:
- [ ] `grep -cE 'await runCase\(' sharp-at-file.test.mjs` prints **30** (was 28): F1 rewritten in
      place; F1b, F2 appended.
- [ ] `node ./sharp-at-file.test.mjs` prints **`Result: 30 passed, 0 failed.`** and exits 0 — against
      the ALREADY-FIXED `sharp-at-file.ts` (per-token dedup present, sentinel gone, Unicode regex).
- [ ] The F1 case name is `"F1 — per-token dedup prevents re-injection"` (no longer mentions "sentinel");
      F1b = `"F1b — co-load: two non-sentinel copies do not double-inject (Issue 1)"`;
      F2 = `"F2 — sentinel string in prompt no longer gates injection (Issue 2)"`.
- [ ] F1 asserts: `first.injected===1`, `dedup.injected===0` (per-token dedup on already-injected
      text), `dedup.text===first.text`, handler `action==='continue'` + `notify===undefined`, and
      EXACTLY ONE `<file name="A_TS">` block in `dedup.text`.
- [ ] F1b asserts: `first.injected===1`, `second.injected===0`, `second.text===first.text` (no
      double-append) — the Issue 1 co-load repro at the injectFiles layer.
- [ ] F2 asserts: on prompt `'<!--#@file-injected--> Review #@a.ts'`, `injected===1`, original prompt
      preserved at start, a.ts `<file>` block present, EXACTLY ONE block (no ghost), and handler
      `action==='transform'` (sentinel no longer gates).
- [ ] All 25 unchanged existing cases (1-14, E1-E4, G1-G3, H1, M1, F3a, F3b, F5, F4) still PASS — no
      collateral damage from the edit.

> **Scope boundary (read carefully):** This task edits ONLY `sharp-at-file.test.mjs`, and ONLY the F1
> block (replaced by F1+F1b+F2). It does **NOT**: (a) touch `sharp-at-file.ts` — the source fix is
> done (the one remaining "sentinel" string is an explanatory COMMENT at line 140, owned by
> P1.M1.T1 — leave it); (b) add Unicode-boundary cases (`café#@x`, CJK) — that is **P1.M2.T2.S1**'s
> dedicated scope (the parallel regex PRP P1.M1.T2.S1 explicitly defers harness café/CJK additions to
> M2.T2.S1); (c) edit any other existing case, the fixture setup, the helpers, or the summary/cleanup;
> (d) edit README (P1.M3 owns docs); (e) introduce a shared block-count helper — reuse the existing
> inline `.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` pattern that the current F1 already uses.

## User Persona

**Target User**: The maintainer (and the CI/harness) who needs the harness to *catch regressions* of
the two Major bugs (Issues 1 & 2) that the original 28-case harness let slip. Also the next implementer
who, reading the F1 case, must understand the CURRENT dedup mechanism (not the deleted sentinel).

**Use Case**: Run `node ./sharp-at-file.test.mjs` as the gate after any change to `sharp-at-file.ts`.
The F1/F1b/F2 cases must fail loudly if someone (a) reintroduces a sentinel guard that false-negatives
on a prompt containing the sentinel string (F2), or (b) removes/breaks the per-token dedup so a
co-loaded second copy re-injects (F1/F1b).

**Pain Points Addressed**: The Bug-fix PRD §Testing Summary calls out "Test Harness Gaps" #1 (no
co-load simulation — the F1 test only re-fed through the same sentinel-stamping handler) and #2 (no
sentinel-in-prompt test). This task closes both gaps with deterministic, model-free cases.

## Why

- **The harness must reflect reality.** The `F1` case name/comment still say "sentinel" and describe a
  sentinel guard that **no longer exists**. A reader is misled; the case passes for the wrong reason
  (dedup, not sentinel). Rewriting it to assert the dedup path makes the harness truthful and pins the
  actual mechanism.
- **Issue 1 (duplicate injection) had no regression test.** The co-load scenario (two copies, one
  non-sentinel) was the root cause of the bug shipping. F1b is the minimal deterministic repro at the
  `injectFiles` layer: two calls, assert the second is a no-op. Cheap, exact, re-runnable.
- **Issue 2 (sentinel false-negative) had no regression test.** A prompt containing the literal
  `<!--#@file-injected-->` string + a valid `#@token` silently dropped injection. F2 nails this: with
  the sentinel removed, the file IS injected; if anyone reintroduces a raw-prompt sentinel guard, F2
  fails (`injected === 0`, `action === continue`).
- **Deterministic & hermetic.** All three cases reuse the existing jiti-imported `injectFiles`/handler
  + the existing `a.ts` fixture. No model, no API key, no Pi process, no network — they fit the
  harness's "model-free gate" ethos exactly.

## What

One `edit` to `./sharp-at-file.test.mjs`: replace the current `F1` block with the rewritten `F1` +
`F1b` + `F2` (exact source in `Implementation Blueprint → Exact source to write`). The new cases sit in
the existing "F1/F3/F5" section, immediately before `F3a`. Net `runCase` delta: **+2** (F1 in place;
F1b, F2 added).

### Success Criteria
- [ ] 30 cases total; `node ./sharp-at-file.test.mjs` → `30 passed, 0 failed`, exit 0.
- [ ] F1/F1b/F2 assert exactly the behaviors listed under Goal.
- [ ] No sentinel references remain in the F1 case name/comment (it describes per-token dedup).
- [ ] All 25 pre-existing cases still pass unchanged.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the exact `oldText` (the current F1 block, byte-for-byte,
> read from the file at lines 491-516) and the exact `newText` (the rewritten F1 + F1b + F2), both
> ready to paste into a single `edit` call. Every assertion in the new cases has been **pre-verified
> green** against the live fixed extension (16/16 sub-assertions pass). The harness conventions
(`runCase`/`assert`/`makeMockCtx`/`captureHandler`, the inline block-count pattern, the in-scope
`mod`/`TMPDIR`/`A_TS`/`FIX`/`A_TS_CONTENT`) are documented. No model/API key needed.

### Documentation & References
```yaml
# MUST READ — this task's verified research (assertions pre-checked against the live extension)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M2T1S1/research/research_notes.md
  why: "§2 verified dedup behavior; §3 the 16/16 pre-pass sub-assertions for F1/F1b/F2; §4 the exact
        edit anchor + replacement; §5 scope boundaries (esp. NO Unicode tests — M2.T2.S1's scope)."
  critical: "F1's notify check is on the CONTINUE path (notify===undefined). The handler's notify FORMAT
        (F4 pluralization '#@ injected N file/files') is NOT exercised by these 3 cases — do not assert it."

# MUST READ — the bug context (why these cases exist)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "§Issue 1 (co-load double-injection), §Issue 2 (sentinel-in-prompt false-negative), §Testing
        Summary 'Test Harness Gaps' #1 & #2 — these are the acceptance criteria for F1b and F2."
  section: "Issue 1, Issue 2, Testing Summary"

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "'Test Harness Gaps' enumerates exactly the 3 blind spots; 'Current State' confirms the harness
        is 28 cases; the runner-chaining snippet (runner.js:881-920) explains WHY a second copy sees the
        first's transformed text (the co-load mechanism F1b simulates at the injectFiles layer)."
  section: "Test Harness Gaps, Current State, Verified Pi Internals → Input Event Runner Chaining"

# MUST READ — the parallel sibling contract (so we do NOT collide)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M1T2S1/PRP.md
  why: "The Unicode-regex PRP. It edits sharp-at-file.ts (line 8) + README, and EXPLICITLY defers
        café/CJK HARNESS additions to 'P1.M2.T2.S1' (a different task). It does NOT touch the harness.
        So: this task (M2.T1.S1) and M2.T2.S1 own DISJOINT harness regions (F1/F1b/F2 vs café/CJK)."
  critical: "Do NOT add café/CJK/Unicode cases here — that collides with P1.M2.T2.S1. This task is ONLY
        F1 (rewrite) + F1b + F2 (dedup & sentinel-removal regressions)."

# The file being EDITED
- file: ./sharp-at-file.test.mjs
  why: "The 28-case model-free harness. The F1 block (lines 491-516) is the UNIQUE edit anchor."
  pattern: "runCase(label, name, async () => { ... assert(cond, msg) ... }). Reuses module-scope
            mod, TMPDIR, A_TS, B_TS, FIX, A_TS_CONTENT; helpers makeMockCtx/captureHandler/assert."
  gotcha: "Count <file> blocks INLINE with the existing pattern — do NOT add a helper. The em dash
           (U+2014) appears in OTHER case names/comments but NOT in the F1 block; the edit anchor is
           pure ASCII. The case labels 'F1b' and 'F2' are UNUSED today (grep-confirmed) — no collision."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-auto-reader
.
├── PRD.md                       # original feature PRD (read-only; not this task's PRD)
├── README.md                    # extension docs — NOT edited here (P1.M3 owns it)
├── sharp-at-file.ts             # ALREADY FIXED (dedup line ~143, sentinel gone, Unicode regex line 17). DO NOT EDIT.
├── sharp-at-file.test.mjs       # ← EDIT: replace the F1 block (lines ~491-516) with F1 + F1b + F2.
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/{system_context.md, code_changes_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}     # per-token dedup — DONE (in .ts)
    ├── P1M1T1S2/{PRP.md, research/}     # sentinel removal — DONE (in .ts)
    ├── P1M1T2S1/{PRP.md, research/}     # Unicode regex — DONE (in .ts); defers café/CJK harness cases to M2.T2.S1
    └── P1M2T1S1/
        ├── research/research_notes.md   # THIS TASK's research (assertions pre-verified 16/16)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
└── sharp-at-file.test.mjs       # MODIFIED — F1 block replaced by rewritten F1 + new F1b + new F2 (+2 cases → 30 total).
# No new files. No .ts / README / PRD / tasks.json changes.
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL — the edit anchor is the FULL current F1 block (lines ~491-516), not a line number. It is
// UNIQUE (grep -c 'await runCase("F1"' → 1). Match it byte-for-byte (the comment block, the two
// await slot.cb lines broken across 3 lines, the inline aCount regex). A partial match fails the edit.

// CRITICAL — do NOT assert the notify MESSAGE in F1/F1b/F2. Those cases hit the CONTINUE path
// (notify===undefined) or the TRANSFORM path (F2 checks action only). The notify FORMAT is the F4
// pluralization ("#@ injected N file"/"files"), asserted by existing cases 9/12/F4 — not our scope.

// CRITICAL — do NOT add café/CJK/Unicode cases. That is P1.M2.T2.S1 (separate planned task). The
// parallel regex PRP (P1M1T2S1) explicitly assigns café/CJK harness additions to M2.T2.S1. Adding
// them here collides with that sibling task.

// GOTCHA — count <file> blocks with the EXISTING inline pattern (no helper), matching the current F1:
//   (text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length
//   The harness deliberately avoids shared helpers (zero-deps ethos); introducing one diverges from style.

// GOTCHA — F2's prompt contains `<!--#@file-injected-->`. The regex matches BOTH `#@file-injected-->`
// and `#@a.ts`. cleanToken trims the trailing `>` → `file-injected--` → resolves to TMPDIR/file-injected--
// (missing) → skipped. So injected===1 (only a.ts). The "exactly ONE block" assertion proves no ghost
// block. (Pre-verified live.) Do NOT try to assert the ghost path by name — it's brittle; the count-1
// check covers it.

// IDEMPOTENCY — if the harness ALREADY shows F1b/F2 (a parallel implementer may have landed them,
//   or this PRP is being applied after a prior pass), the oldText anchor (the OLD sentinel-named F1
//   block) will NOT be found. The PRE-FLIGHT idempotency guard handles this: if F1b/F2 exist and the
//   harness is 30/30, the task is done — do NOT force the edit. (The repo was observed at this exact
//   30-case target state during research; the F1/F1b/F2 case names there match this PRP's newText.)

// GOTCHA — the .ts line-140 comment "works even when the prior copy was a non-sentinel version" is
// explanatory prose, NOT a sentinel mechanism. Do NOT "clean it up" — it's out of scope (P1.M1.T1 owns it).

// OK — purely additive + one rewrite to a .mjs harness. jiti is only used at runtime by the harness
// itself (it imports the .ts); the edit adds no imports, no new fixtures, no new module-level state.
```

## Implementation Blueprint

### Data models and structure
None. No data model, type, signature, or control-flow change. This is three `runCase` blocks (one
rewritten, two new) using the harness's existing `assert`/`makeMockCtx`/`captureHandler` helpers and
the existing `a.ts` fixture (`A_TS`, `A_TS_CONTENT`, `FIX = { cwd: TMPDIR }`).

### Implementation Tasks (ordered by dependencies)
```yaml
PRE-FLIGHT:
  - IDEMPOTENCY GUARD (run FIRST — a parallel pass may have already landed these cases):
      if grep -qE 'await runCase\("F1b"|await runCase\("F2"' sharp-at-file.test.mjs; then
        echo "F1b/F2 already present → task already complete; verifying and STOPPING."
        node ./sharp-at-file.test.mjs && exit 0   # must report 30/30; if so, NOTHING more to do.
      fi
    (If this guard fires, the oldText anchor below will NOT be found — that is expected; the target
     state already exists. Do NOT force the edit.)
  - CONFIRM the F1 anchor is present & unique (baseline 28-case state):
      grep -cE 'await runCase\("F1",' sharp-at-file.test.mjs        # → 1
    CONFIRM no F1b/F2 collision (baseline):
      grep -nE 'await runCase\("F1b"|await runCase\("F2"' sharp-at-file.test.mjs   # → (none)
    CONFIRM the source fix is in place (these cases REQUIRE it to pass):
      grep -qE "text.includes\('<file name=\"' \+ abs \+ \"'>" sharp-at-file.ts && echo "dedup present" || echo "MISSING dedup"
      grep -qE 'SENTINEL_RE|INJECT_SENTINEL' sharp-at-file.ts && echo "WARN sentinel still present" || echo "sentinel gone"

Task 1: EDIT ./sharp-at-file.test.mjs — replace the F1 block with F1 + F1b + F2
  - OBJECTIVE: Rewrite F1 to assert per-token dedup; add F1b (co-load Issue 1) + F2 (sentinel-in-prompt Issue 2).
  - FIND (exact oldText — the ENTIRE current F1 block, lines ~491-516, UNIQUE in the file):
        <see "Exact source to write" → oldText below>
  - REPLACE WITH (exact newText — rewritten F1 + F1b + F2):
        <see "Exact source to write" → newText below>
  - DO NOT alter any other line, case, fixture, helper, comment, or the summary/cleanup.
  - DO NOT add imports, fixtures, or a block-count helper (use the inline pattern).

POST-FLIGHT:
  - grep -cE 'await runCase\(' sharp-at-file.test.mjs   # → 30 (was 28)
  - grep -nE 'await runCase\("F1"|await runCase\("F1b"|await runCase\("F2"' sharp-at-file.test.mjs   # → 3 distinct lines
  - Run the Validation Loop gates (Level 1 + Level 2).

DO NOT (out of scope — owned by sibling tasks):
  * Edit sharp-at-file.ts (source fix done; line-140 comment is P1.M1.T1's).
  * Add café/CJK/Unicode cases (P1.M2.T2.S1).
  * Edit README (P1.M3.T1/T2).
  * Touch any existing case other than F1, or the fixture/helper/summary sections.
```

### Exact source to write (authoritative — copy verbatim into ONE `edit` call)

**`oldText`** — the current F1 block (match byte-for-byte; it is unique in the file):
```javascript
await runCase("F1", "F1 — no re-injection when a sentinel is already present (second copy)", async () => {
  // A SECOND copy of the extension receives the FIRST copy's transformed text (original prompt +
  // sentinel + blocks). It must detect the sentinel and NOT re-inject. Tested at both layers:
  //   (a) injectFiles itself is a pure function of text — so we pass already-injected text in and
  //       confirm it returns the SAME text/count-0 (the sentinel guard lives in the HANDLER; here we
  //       verify injectFiles is idempotent-safe by checking it doesn't double-append when given
  //       text that already ends in our block — the handler is what carries the guard).
  //   (b) the HANDLER guard: feed already-sentinel'd text through the captured handler and assert
  //       action==='continue' with no notify and no extra blocks.
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  // (b) handler guard — the load-bearing fix.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb(
    { text: first.text, source: "interactive", images: first.images },
    ctx,
  );
  assert(out.action === "continue", `second copy must short-circuit on the sentinel, got '${out.action}'`);
  assert(rec.notify === undefined, "second copy must NOT notify (nothing re-injected)");
  // The returned nothing-changed: first.text already has exactly ONE <file> block for a.ts.
  const aCount = (first.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `first pass must produce exactly 1 block for a.ts (got ${aCount}) — re-injection guard prevents a 2nd`);
});
```

**`newText`** — the rewritten F1 + F1b + F2 (all assertions pre-verified green against the live extension):
```javascript
await runCase("F1", "F1 — per-token dedup prevents re-injection", async () => {
  // The sentinel mechanism is GONE (P1.M1.T1). Re-injection is now prevented by PER-TOKEN DEDUP
  // inside injectFiles: if a `<file name="<abs>">` block for the resolved path already exists in
  // `text`, the token is skipped — cooperation-independent (works against ANY prior copy, sentinel or
  // not). Simulate a SECOND copy receiving the first copy's already-injected text: (a) injectFiles
  // returns injected===0 with unchanged text; (b) the captured handler short-circuits to `continue`
  // (no notify); and the text retains EXACTLY ONE `<file>` block for a.ts (not two).
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(first.injected === 1, `first pass must inject a.ts (got ${first.injected})`);

  // (a) injectFiles-level: already-injected text → injected===0 (per-token dedup), text unchanged.
  const dedup = await mod.injectFiles(first.text, first.images, FIX);
  assert(dedup.injected === 0, `dedup pass must return injected===0 (got ${dedup.injected})`);
  assert(dedup.text === first.text, "dedup pass must not alter the text (idempotent)");

  // (b) handler-level: the second-copy handler returns continue (injectFiles injected 0), no notify.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: first.text, source: "interactive", images: first.images }, ctx);
  assert(out.action === "continue", `second copy must short-circuit to continue (got '${out.action}')`);
  assert(rec.notify === undefined, "second copy must NOT notify (nothing re-injected)");

  // Exactly ONE <file> block for a.ts in the injected text — the dedup prevented a duplicate.
  const aCount = (dedup.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `injected text must contain exactly 1 <file> block for a.ts (got ${aCount})`);
});

await runCase("F1b", "F1b — co-load: two non-sentinel copies do not double-inject (Issue 1)", async () => {
  // Direct Issue 1 repro at the injectFiles layer. A prior copy (here another injectFiles call, since
  // the sentinel is gone) injects, then a second copy processes the result. Because injectFiles no
  // longer stamps a sentinel, the second copy relies SOLELY on per-token dedup. Assert the second
  // pass injects nothing AND appends no blocks (first.text === second.text).
  const first = await mod.injectFiles("Review #@a.ts", [], FIX);
  assert(first.injected === 1, `first copy must inject a.ts (got ${first.injected})`);
  const second = await mod.injectFiles(first.text, first.images, FIX);
  assert(second.injected === 0, `second copy must inject nothing — per-token dedup (got ${second.injected})`);
  assert(second.text === first.text, "second copy must append NO additional blocks (first.text === second.text)");
});

await runCase("F2", "F2 — sentinel string in prompt no longer gates injection (Issue 2)", async () => {
  // Issue 2 regression: the old sentinel guard tested the RAW user prompt and short-circuited on ANY
  // `<!--#@file-injected-->` substring, silently dropping ALL #@ tokens. With the sentinel removed
  // (P1.M1.T1.S2), a prompt containing the literal sentinel string AND a valid #@token must STILL
  // inject the file. (`#@file-injected-->` resolves (after cleanToken trims the trailing `>`) to a
  // missing path and is left verbatim; `#@a.ts` injects.)
  const prompt = '<!--#@file-injected--> Review #@a.ts';
  const r = await mod.injectFiles(prompt, [], FIX);
  assert(r.injected === 1, `a.ts must be injected despite the sentinel string in the prompt (got ${r.injected})`);
  assert(r.text.startsWith(prompt), "original prompt text must be preserved verbatim at the start");
  assert(r.text.includes('<file name="' + A_TS + '">'), "injected text must contain the a.ts <file> block");
  // Exactly ONE block (a.ts) — no spurious block from the ghost `#@file-injected-->` token.
  const aCount = (r.text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
  assert(aCount === 1, `exactly 1 <file> block (a.ts); no ghost block from the sentinel token (got ${aCount})`);

  // Handler-level: the input event transforms (does NOT short-circuit on the sentinel substring).
  const { ctx } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: prompt, source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform (sentinel no longer gates), got '${out.action}'`);
});
```

### Implementation Patterns & Key Details
```javascript
// PATTERN (per-token dedup assertion): the defining test is "a second pass over first-pass output is a
// NO-OP." Both F1 (handler layer) and F1b (injectFiles layer) express this. F1 adds the exactly-one-
// block check + the handler continue/no-notify; F1b adds the byte-equality first.text===second.text.
// They are complementary, NOT redundant: F1 proves the runner-facing handler path; F1b isolates
// injectFiles' idempotency independent of the handler.

// PATTERN (sentinel false-negative regression): F2 puts the sentinel substring IN THE USER PROMPT
// (not in injected output) alongside a valid #@token. Before the fix the handler's
// SENTINEL_RE.test(event.text) short-circuited → injected 0. After: injectFiles runs, a.ts injects.
// The "exactly ONE block" check also guards against the ghost `#@file-injected-->` token injecting a
// spurious block for TMPDIR/file-injected--.

// GOTCHA: makeMockCtx's recorder sets rec.notify={m,t} on call, undefined otherwise. F1 asserts
// rec.notify===undefined (continue path, no notify). F2 destructures only {ctx} (it does not check
// notify — the transform path WOULD notify, but the case asserts action only, intentionally).
```

### Integration Points
```yaml
NO NEW INTEGRATION POINTS:
  - "Pure test-harness edit. No new imports, fixtures, helpers, config, or env vars."
  - "Consumes the ALREADY-FIXED sharp-at-file.ts (per-token dedup + sentinel removal + Unicode regex)."
  - "If the .ts is later reverted (sentinel reintroduced, or dedup removed), F2 / F1+F1b fail loudly —
     that is the intended regression signal."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker**. The gate is the model-free Node ESM
> harness itself (`sharp-at-file.test.mjs`). The Python `pytest`/`mypy`/`ruff` gates from the base
> template DO NOT APPLY. The gates below are project-specific and **verified on this machine**.

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. Case count is now 30 (was 28): F1 rewritten in place; F1b, F2 added.
[ "$(grep -cE 'await runCase\(' sharp-at-file.test.mjs)" = "30" ] && echo "OK: 30 cases" || echo "FAIL: case count != 30"

# 1b. The three target labels are present and distinct.
grep -qE 'await runCase\("F1", "F1 — per-token dedup prevents re-injection"' sharp-at-file.test.mjs && echo "OK F1" || echo "FAIL F1"
grep -qE 'await runCase\("F1b", "F1b — co-load' sharp-at-file.test.mjs && echo "OK F1b" || echo "FAIL F1b"
grep -qE 'await runCase\("F2", "F2 — sentinel string in prompt' sharp-at-file.test.mjs && echo "OK F2" || echo "FAIL F2"

# 1c. The OLD sentinel-named F1 is GONE (no leftover "sentinel is already present" case name).
grep -qE 'no re-injection when a sentinel is already present' sharp-at-file.test.mjs \
  && echo "FAIL: old F1 name still present" || echo "OK: old F1 name removed"

# 1d. No café/CJK/Unicode cases were added (that's P1.M2.T2.S1's scope — must stay absent here).
grep -qE 'café|日本語|\\p\{L\}' sharp-at-file.test.mjs \
  && echo "WARN: Unicode case present (out of scope for THIS task)" || echo "OK: no Unicode cases (correct)"

# 1e. No shared block-count helper was introduced (reuse the inline pattern).
grep -qE 'function (countBlocks|countFileBlocks|blockCount)\b' sharp-at-file.test.mjs \
  && echo "WARN: helper introduced (diverges from harness style)" || echo "OK: no helper (inline pattern reused)"

# Expected: 30 cases; F1/F1b/F2 present; old F1 name gone; no Unicode cases; no helper.
```

### Level 2: Full Harness (Component Validation — PRIMARY GATE)
```bash
cd /home/dustin/projects/pi-auto-reader
node ./sharp-at-file.test.mjs
# Expected: "Result: 30 passed, 0 failed." exit 0.
# The new F1/F1b/F2 lines print: "  ✓ case F1: …", "  ✓ case F1b: …", "  ✓ case F2: …".
# If F1/F1b FAIL: the .ts dedup is broken/removed (re-check `grep "text.includes('<file name=" sharp-at-file.ts`).
# If F2 FAILS: a sentinel guard was reintroduced in the handler (re-check `grep SENTINEL sharp-at-file.ts` → should be only the line-140 comment).
# If a PRE-EXISTING case FAILS: the edit accidentally damaged an adjacent region — re-read the diff.
```

### Level 3: Targeted Behavior Re-check (NON-INTERACTIVE, NO MODEL — optional confidence)
The exact F1/F1b/F2 assertions were pre-verified green (16/16) via a throwaway script that mirrors the
harness's jiti+alias import. To re-confirm in isolation (does NOT touch the harness):
```bash
cd /home/dustin/projects/pi-auto-reader
# (See research/research_notes.md §3 for the verified 16-assertion script; or simply trust Level 2,
#  which runs the identical assertions inside the real harness.) Level 2 is authoritative.
```

### Level 4: Regression Intent (optional — proves the cases WOULD fail on the buggy code)
These cases are regression tests; they must fail against the BUGGY (pre-fix) behavior. Not required to
run, but documents the intent:
- **F1b fails on buggy code**: if `injectFiles` had no dedup, `second.injected === 1` (re-injects) and
  `second.text !== first.text` (double-append) — Issue 1.
- **F2 fails on buggy code**: if the handler had `SENTINEL_RE.test(event.text) → continue`, the handler
  returns `continue` (not `transform`) and `injectFiles` is never called → `injected === 0` — Issue 2.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: 30 cases; F1/F1b/F2 present & distinct; old sentinel-named F1 gone; no Unicode cases;
      no helper introduced.
- [ ] Level 2: `node ./sharp-at-file.test.mjs` → **30 passed, 0 failed**, exit 0.

### Feature Validation
- [ ] F1: `first.injected===1`; `dedup.injected===0`; `dedup.text===first.text`; handler
      `action==='continue'` + `notify===undefined`; exactly ONE `<file>` block for a.ts in `dedup.text`.
- [ ] F1b: `first.injected===1`; `second.injected===0`; `second.text===first.text` (Issue 1 co-load repro).
- [ ] F2: on `'<!--#@file-injected--> Review #@a.ts'`, `injected===1`; prompt preserved at start;
      a.ts `<file>` block present; exactly ONE block; handler `action==='transform'` (Issue 2 regression).
- [ ] All 25 pre-existing cases still pass (no collateral damage).

### Code Quality Validation
- [ ] Only the F1 block was replaced (with F1+F1b+F2); no other line/case/fixture/helper/summary touched.
- [ ] New cases reuse `assert`/`makeMockCtx`/`captureHandler` + the inline block-count pattern (no helper).
- [ ] No new imports, fixtures, or module-level state.
- [ ] Case labels F1b, F2 do not collide (grep-confirmed unused before the edit).
- [ ] No `.ts`/README/PRD/tasks.json changes.

### Documentation & Deployment
- [ ] No new env vars / config / API surface (pure harness edit).
- [ ] The F1 case name/comment now describe per-token dedup (truthful to the current mechanism).
- [ ] F1b/F2 name the Issue they regress (Issue 1 / Issue 2) for future readers.

---

## Anti-Patterns to Avoid
- ❌ Don't add café/CJK/Unicode cases — that is **P1.M2.T2.S1**'s scope (the parallel regex PRP defers
  them there). Adding them here collides with that sibling task.
- ❌ Don't edit `sharp-at-file.ts` — the source fix is done; the line-140 "sentinel" comment is
  explanatory prose owned by P1.M1.T1 (leave it).
- ❌ Don't assert the notify MESSAGE in F1/F1b/F2 — they hit the continue path (`notify===undefined`) or
  check action only. The notify format (F4 `file`/`files`) is asserted by existing cases 9/12/F4.
- ❌ Don't introduce a shared block-count helper — reuse the existing inline
  `.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` pattern (matches the harness's zero-helper ethos + F1's style).
- ❌ Don't match the F1 anchor by line number — the "F1/F3/F5" region shifts if other cases are added.
  Use the full-block exact-text anchor (unique, stable).
- ❌ Don't touch any existing case (1-14, E1-E4, G1-G3, H1, M1, F3a, F3b, F5, F4) — only the F1 block
  is replaced; F1b/F2 are appended right after it.
- ❌ Don't edit README, the summary/cleanup section, or the fixture setup.
- ❌ Don't "fix" the F2 ghost token by asserting its path by name (`TMPDIR/file-injected--`) — it's
  brittle (depends on cleanToken's exact `-->` trim). The "exactly ONE block" count check covers it.
- ❌ Don't change the case count expectation to anything other than 30 (28 + 2). If you find 31/29, you
  added/dropped a case unintentionally — re-read the diff.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a single in-place `edit` to one `.mjs` harness file, replacing one uniquely-anchored
block (the current F1, lines 491-516, grep-confirmed unique) with three `runCase` blocks whose every
assertion has been **pre-verified green (16/16)** against the live fixed extension via a throwaway
script mirroring the harness's exact jiti+alias import. The new cases reuse only existing helpers
(`assert`/`makeMockCtx`/`captureHandler`) and existing fixtures (`a.ts`/`A_TS`/`FIX`/`A_TS_CONTENT`) —
no new imports, fixtures, or state. The scope is crisply disjoint from the parallel sibling (P1.M2.T2.S1
owns café/CJK Unicode cases; this task owns F1/F1b/F2 dedup+sentinel cases). The source fix this task
depends on (per-token dedup + sentinel removal) is **already landed and confirmed** (harness 28/28
today). The residual 0.5 is for a possible byte-mismatch in the `oldText` anchor (a whitespace/comment
slip) — fully caught by Level-1c (old F1 name gone) + Level-2 (full harness must report 30/30).
