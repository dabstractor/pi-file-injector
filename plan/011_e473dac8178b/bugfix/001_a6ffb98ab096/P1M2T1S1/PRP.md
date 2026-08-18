---
name: "P1.M2.T1.S1 (bugfix 001_a6ffb98ab096) — injectMarkdown Step-5: skip rec.invalidRange + emit the LR-3 warning (BUG-002: markdown malformed-range silence + raw-token leak)"
prd_ref: "bugfix PRD §h2.3 Issue 1 / h3.1 (BUG-002: malformed line-range tokens inside delivered markdown are silently verbatim AND leak an unresolved raw token into injectFile — process-cwd stat, relative block name); §h2.5 Recommendation 2 ('skip rec.invalidRange exactly like processTokenStream — optionally emit the same LR-3 warning — which also removes the raw-token leak'); spec anchors spec/17-line-ranges.md:85 (LR-3), spec/11-acceptance-tests.md case 44, spec/10-edge-cases.md:79"
target_file: "./file-injector.ts"   # injectMarkdown Step-5 ONLY (:1597-1603): +the invalidRange guard before the claimKey re-check. PLUS file-injector.test.mjs (+MD-LR3 after LINE-10 :3323) and README.md (one Mode-A sentence in the Line range. paragraph)
target_language: TypeScript (jiti transpile-on-load; gates = `npm run typecheck` --strict 0 errors + `node ./file-injector.test.mjs` green; TDD: MD-LR3 RED first, then the guard)
depends_on: "None blocking — scanTokens' invalidRange records (:1234) and processTokenStream's guard (:1274-1278) are LANDED and green (LINE-10 :3291 pins the top-level contract byte-for-byte). The parallel sibling P1.M1.T1.S3 edits renderInjectedMessage (:1047-1102) + REND-TIER3-PATH (:2959) — code/test/doc regions fully disjoint."
consumed_by: "P1.M4.T6.S1 (README changeset sweep — verifies this subtask's Mode-A sentence), P1.M4.T6.S2 (spec consistency pass — LR-3 anchors spec/17:85, spec/11 case 44, spec/10:79 stay accurate)"
---

# PRP — P1.M2.T1.S1: injectMarkdown Step-5 invalidRange guard (BUG-002 — LR-3 parity inside markdown)

> **Scope flag:** Bugfix, surgical: ONE guard block inserted into `injectMarkdown`'s Step-5 loop (:1599, BEFORE
> the claimKey re-check), mirroring `processTokenStream`'s LR-3 guard (:1274-1278) byte-for-byte — same
> hasUI-gated warning string, same `continue`. Plus ONE regression test (**MD-LR3**, TDD RED-first, after LINE-10)
> and ONE Mode-A README sentence. **No signature change** (ctx is already injectMarkdown's 4th param), **no
> exported-surface change**, **no edits to scanTokens or processTokenStream**. The fix closes both BUG-002
> symptoms at once: the missing markdown-level LR-3 warning AND the raw-token-into-injectFile leak
> (`fs.stat("a.md:0")` against process.cwd → relative block name).

---

## Goal

**Feature Goal:** Make a malformed line range (`:0`, `:5-3`) found while scanning a DELIVERED markdown file behave
EXACTLY like the same token at the top level (LR-3): a hasUI-guarded `"warning"` notify naming the token as typed
(byte-identical message), the marker left verbatim, nothing injected, and the raw unresolved token NEVER handed to
`injectFile` (which would `fs.stat` it against **process.cwd** — injecting a literal process-cwd colon-file with a
RELATIVE block name when one exists, §6.1/§4.5 violations).

**Deliverable:** (1) Modified `./file-injector.ts` — the invalidRange guard inserted in injectMarkdown's Step-5
loop, before the `claimKey` re-check; (2) modified `./file-injector.test.mjs` — `runCase("MD-LR3", …)` after
LINE-10's closing `});` (:3323), before the `// LINE-11` comment (RED first, then GREEN); (3) modified
`./README.md` — one sentence appended to the `**Line range.**` paragraph (Mode A, rides with this subtask).

**Success Definition:**
1. `#@badrange.md` (containing `see #@a.md:0 here`) driven via `mod.injectFiles` with a spy ctx → `injected === 1`
   (only badrange.md), NO block containing `name="a.md:0"`, `notes.length === 1`, `notes[0].t === "warning"`,
   `notes[0].m === "#@a.md:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)"` (byte-parity with LINE-10).
2. Headless (`hasUI: false`) → same delivery, ZERO notifies.
3. A repeated malformed marker warns once per occurrence (invalid records bypass localSeen — top-level parity).
4. `node ./file-injector.test.mjs` → `0 failed` (184 = 183 + MD-LR3); LINE-7/8/9/10/11/12 all stay ✓.
5. `npm run typecheck` → 0 errors (`"warning"` is in the `Ctx.ui.notify` union — typecheck enforces it).

## User Persona

**Target User:** A Pi user who writes a line range with a typo (`#@a.md:0`, `#@notes.md:5-3`) — inside a markdown
file that itself gets injected. At the top level they already see a clear warning; inside markdown the marker
currently vanishes SILENTLY (and, in the pathological case, a process-cwd file named literally `a.md:0` gets
injected under a relative name — the model receives a file the user never named).

**Use Case:** `Read #@notes.md` where notes.md contains `see #@api.md:0 here` → the chat shows
`#@api.md:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)` — same feedback as if the typo were at the prompt.

**Pain Points Addressed:** LR-3's "malformed ranges are not silent" contract now holds uniformly (top level AND
markdown); the raw-token leak (process-cwd stat + relative block name) is structurally removed.

## Why

- **LR-3 parity is the contract.** `splitLineRange` marks `:0`/`:5-3` invalid and `scanTokens` surfaces them as
  `{ path: <raw token>, invalidRange: true }` records precisely so consumers can warn. `processTokenStream` does;
  `injectMarkdown` Step 5 consumes the same records but forgot the guard — an asymmetry, not a design choice.
- **One guard fixes both symptoms.** Skipping invalid records before `injectFile` removes the process-cwd stat
  (no injection attempt ⇒ no relative-block-name leak) AND frees the loop to emit the same warning. The PRD §h2.5
  Recommendation 2 names exactly this: "skip rec.invalidRange records exactly like processTokenStream does (and
  optionally emit the same LR-3 warning), which also removes the raw-token-into-injectFile leak."
- **Order is load-bearing.** The guard MUST precede the belt-and-suspenders `claimKey(rec.path, …)` re-check:
  for an invalid record the "key" is the meaningless relative string `"a.md:0"` — mirroring processTokenStream's
  ordering (guard first, claimKey second) is both correct and consistent.
- **Cheap and zero-risk to valid paths.** Valid records (`invalidRange` undefined) skip the new branch entirely —
  the existing claimKey/injectFile lines are byte-unchanged. No exported surface, no signature, no scanTokens /
  processTokenStream edits.

## What

No user-visible surface change beyond the new warning (which is the point). Markdown-level malformed ranges now
warn + verbatim + never inject; the raw token never reaches `injectFile`. One new test case; one README sentence.

### Success Criteria

- [ ] injectMarkdown Step 5 begins with the invalidRange guard (byte-mirroring :1274-1278): hasUI-gated
      `ctx.ui?.notify(\`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)\`, "warning")` + `continue`.
- [ ] The guard sits BEFORE the `state.injectedSet.has(claimKey(...))` re-check; the claimKey + injectFile lines
      are otherwise byte-unchanged.
- [ ] scanTokens and processTokenStream are UNTOUCHED.
- [ ] `runCase("MD-LR3", …)` exists after LINE-10's `});` (:3323), before `// LINE-11` (:3325); RED before the
      guard, GREEN after (all sub-asserts incl. headless negative + repeated-marker parity).
- [ ] README's `**Line range.**` paragraph gains the malformed-range sentence (Mode A).
- [ ] `node ./file-injector.test.mjs` → 0 failed + `✓ case MD-LR3`; `npm run typecheck` → 0 errors.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact current Step-5 text (oldText for the edit, live-verified :1597-1603), the
exact template guard from processTokenStream (:1274-1278, byte-quoted), the byte-pinned warning string (LINE-10
:3298), the verbatim MD-LR3 test body (spy pattern mirroring LINE-10; inline fixture + finally rmSync; the
repeated-marker localSeen-bypass note), the RED-state trace (why it fails today on `notes.length`), the
placement anchors by identifier (LINE-10's `});` → `// LINE-11` comment), the naming-collision warning (existing
BUG-001/BUG-002 labels are DIFFERENT historical bugs), the README paragraph location + exact sentence, and both
gates with expected counts. The implementer makes 3 edits, runs 2 commands.

### Documentation & References

```yaml
# MUST READ — the complete code context: the flow (splitLineRange → scanTokens → the two consumers), the fix
# body verbatim, the test conventions, the risks (naming collision, localSeen bypass, exact-path-wins note)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/injection_bug002_003.md
  why: "§'BUG-002 scan/notify/markdown flow' traces the whole path with verbatim code: (a) splitLineRange's
        invalid cases (:0 start<1, :5-3 end<start) → raw token as path; (b) scanTokens' invalidRange push
        (bypasses localSeen/claimKey); (c) processTokenStream's correct guard (the template); (d) injectMarkdown
        Steps 1-6 + the unguarded Step 5 + why the guard must precede the claimKey re-check; (e) injectFile's
        as-is stat (process.cwd) → the leak. §'BUG-002 fix inputs' gives the exact insertion. §Risks: naming
        collision, repeat-warns-per-occurrence, exact-path-wins-in-md-dir unaffected, notify type union."
  critical: "The doc's line numbers have drifted slightly (it says :1558-1561; live Step 5 is :1597-1603; the
             guard template is :1274-1278) — place by the quoted TEXT, not the doc's line numbers. The doc's
             'process-cwd leak repro via process.chdir' variant is OPTIONAL and NOT required — chdir is global
             mutable state; the guard makes the leak unreachable and MD-LR3 asserts the behavior."

# MUST READ — the bug contract (repro, consequences, the §6.1 relative-name violation)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md   # (bugfix PRD §h2.3 Issue 1 / h3.1)
  why: "States both symptoms (silent verbatim inside markdown; the verified relative-block-name injection
        '<file name=\"a.md:0\">' when a literal colon-file exists in the process cwd) and the §h2.5 Recommendation
        this PRP implements. Spec anchors: spec/17-line-ranges.md:85 (LR-3), spec/11-acceptance-tests.md case 44,
        spec/10-edge-cases.md:79."

# MUST READ — the byte-parity contract (LINE-10 pins the top-level LR-3 behavior this fix mirrors)
- file: file-injector.test.mjs   # (READ the LINE-10 case, :3291-3323)
  why: "LINE-10 is the template MD-LR3 mirrors: the spy ctx pattern, the exact assertion string (:3298), the
        negatives discipline, the inline literal-colon-file + finally rmSync. MD-LR3 inserts immediately after
        LINE-10's closing `});` (:3323), before the `// LINE-11 — LR-4 …` comment (:3325)."
  pattern: "const notes = []; mod.injectFiles(prompt, [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) =>
            notes.push({ m, t }) } }); then assert notes[0]?.m === \"#@a.ts:0 — not injected (range must be :N or
            :N-M, M ≥ N ≥ 1)\" — byte-identical string for markdown parity (em dash U+2014, ≥ chars)."
  gotcha: "⚠️ NAMING COLLISION (architecture doc §Summary): the repo's EXISTING test labels \"BUG-001\"/\"BUG-002\"
           (~:3308 area, and url-injection.test.mjs DIS-1b/DIS-3) refer to EARLIER, DIFFERENT bugs. This task's
           label is **MD-LR3** (unique). Never name the new case BUG-002."

# The file you edit (the guard)
- file: file-injector.ts
  why: "injectMarkdown signature :1546 (ctx IS the 4th param — no change); Step-3 scan :1551 (produces the recs);
        Step 5 :1597-1603 (the edit site — exact current text in the Blueprint). processTokenStream's guard
        :1274-1278 (the byte-template). injectFile :1294+ (the leak target — stat as-is vs process.cwd; NOT edited).
        scanTokens' invalidRange push :1234 (NOT edited)."
  pattern: "Mirror the guard byte-for-byte (comment adapted to the markdown context). hasUI-guarded + optional
            chaining (ctx.ui?.notify) exactly like the template. 'warning' literal is typecheck-guarded."
  gotcha: "The guard goes BEFORE the claimKey re-check (:1600) — claimKey('a.md:0', undefined, undefined) is a
           meaningless relative string; processTokenStream's ordering (guard first) is the contract."

# The README you edit (Mode A — one sentence)
- file: README.md
  why: "## Syntax → the '**Line range.**' paragraph (~:126-131): currently covers :N/:N-M delivery, paging,
        images/binaries ignoring ranges, multi-range injects, and same-range dedup — but NOT malformed ranges.
        Append ONE sentence (Blueprint) so the docs match the now-uniform warn behavior. The later P1.M4.T6.S1
        sweep verifies the changeset's docs; this sentence is THIS subtask's duty (item §5: 'rides WITH this
        subtask; do not create a separate docs subtask')."

# The parallel sibling (READ-ONLY context — zero overlap, do not touch its regions)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M1T1S3/PRP.md
  why: "S3 (implementing in parallel) edits renderInjectedMessage (:1047-1102) + its REND-TIER3-PATH test (:2959,
        in the REND cluster) and explicitly does NOT touch README. This task's regions — injectMarkdown Step 5
        (:1597), MD-LR3 (:3323+), README Syntax — are fully disjoint from S3's. Baseline note: S3's test already
        landed (suite at 183); with MD-LR3 → 184. Gate on `0 failed` + `✓ MD-LR3`, not a fixed count."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (ONE hunk: injectMarkdown Step 5 +invalidRange guard)
├── file-injector.test.mjs    # ← EDITED (ONE hunk: +MD-LR3 after LINE-10 :3323, before // LINE-11 :3325)
├── README.md                 # ← EDITED (ONE sentence appended to the **Line range.** paragraph)
├── import-behavior.test.mjs / relative-imports.test.mjs / url-injection.test.mjs   # NOT edited (stays green)
├── scripts/typecheck.mjs / package.json / PRD.md   # untouched
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/{injection_bug002_003.md, renderer_bug001.md, spec_ux_bug004_005.md, system_context.md}
    ├── P1M1T1S1..S3/{PRP.md, research/}   # BUG-001 renderer fixes (S1/S2 landed; S3 parallel — disjoint)
    └── P1M2T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectMarkdown Step 5 (:1597-1603): +invalidRange guard (4 lines + comment)
                          #   before the claimKey re-check; claimKey/injectFile lines byte-unchanged.
file-injector.test.mjs    # MODIFIED — +runCase("MD-LR3", …) after LINE-10's `});` (:3323); inline badrange.md
                          #   fixture + finally rmSync; spy ctx; headless negative; repeated-marker parity assert.
README.md                 # MODIFIED — ONE sentence appended to the **Line range.** paragraph (malformed ranges
                          #   left untouched + warned, including inside imported markdown files).
# scanTokens / processTokenStream UNTOUCHED. No other files. No exported-surface change.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the guard MUST be inserted BEFORE the claimKey re-check. For an invalid record,
//   claimKey("a.md:0", undefined, undefined) === "a.md:0" — a meaningless relative string as a claim key.
//   processTokenStream's order (guard first, claimKey second) is the contract; mirroring it exactly also keeps
//   the two loops structurally identical for future readers.

// CRITICAL — the warning string must be BYTE-IDENTICAL to the top-level one (LINE-10 :3298 pins it):
//   `#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`
//   em dash U+2014 (—), "≥" chars, exact wording. rec.path is the RAW token as typed ("a.md:0"), so the markdown
//   warning reads exactly like the top-level one. ONE assertion string serves both paths.

// CRITICAL — hasUI-guard + optional chaining, exactly like the template: `if (ctx.hasUI) ctx.ui?.notify(...)`.
//   Headless (hasUI:false) → zero notifies even when a ui object is present (MD-LR3's headless negative proves
//   the GATE, not a missing ui). "warning" is in Ctx.ui.notify's union ("info"|"warning"|"error") — npm run
//   typecheck enforces the literal.

// CRITICAL — ⚠️ TEST-LABEL COLLISION: the repo's EXISTING "BUG-001"/"BUG-002" case labels (file-injector.test.mjs
//   ~:3308 area; url-injection DIS-1b/DIS-3) refer to EARLIER, DIFFERENT historical bugs (code-extension deny-list;
//   URL-notify wording). This task's label is MD-LR3 (unique). Never name it BUG-002.

// GOTCHA — invalid records bypass localSeen/claimKey in scanTokens (:1234 pushes and continues BEFORE any
//   localSeen.add) ⇒ a markdown containing the same malformed token TWICE produces TWO records ⇒ TWO warnings
//   (one per occurrence) — top-level parity by design. MD-LR3 asserts this (notes3.length === 2); note it in a
//   comment so a future reader doesn't "fix" it as a duplicate-warning bug.

// GOTCHA — exact-path-wins still applies FIRST (scanTokens :1230 resolves the FULL token before the invalid
//   branch): a literal file named `a.md:0` IN THE MARKDOWN'S OWN DIRECTORY still resolves + injects whole
//   (intended, §2.4, unaffected by this fix — LINE-7 pins it). This fix removes only the PROCESS-CWD leak.

// GOTCHA — injectMarkdown is PRIVATE: drive it via mod.injectFiles("Read #@badrange.md", [], spyCtx) (same as
//   every existing markdown case). Never import/call injectMarkdown directly.

// GOTCHA — a.md ALREADY exists in buildFixtures (:257, "# A\n\nRefs #@b.md.\n"; const A_MD :378) — REUSE it;
//   do not rewrite it. Only badrange.md is new (inline write + finally rmSync, mirroring LINE-10's literal-file
//   discipline). Note: badrange.md's malformed token never resolves, so a.md (and its nested #@b.md) never enter
//   the run — the fixture is clean.

// GOTCHA — the architecture doc's process.chdir leak-repro variant is OPTIONAL and NOT required: process.chdir
//   is global mutable state (would affect concurrently... well, sequentially-run later cases if the finally
//   failed); the guard makes the leak structurally unreachable and MD-LR3 asserts the behavior end-to-end. Skip it.

// LIBRARY — TypeScript via jiti (no build step); gates = npm run typecheck (tsc --strict) + node ./file-injector.test.mjs.
//   Zero-dep .mjs harness; runCase/assert/hasBlock exist; TMPDIR is mkdtemp-per-run (rm'd at suite end) — the
//   finally rmSync is throw-safety/tidiness, not leak-prevention.
```

## Implementation Blueprint

### Edit 1 — the guard (file-injector.ts, injectMarkdown Step 5 :1597-1603)

```ts
// BEFORE (current, live-verified):
  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const rec of recs) {
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, classifies, bumps count, recurses again if markdown
  }

// AFTER:
  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const rec of recs) {
    // LR-3 — malformed range (`:0`, `:5-3`) found while scanning a DELIVERED markdown: same contract as
    // processTokenStream — warn (interactive only), leave verbatim, never hand the raw token to injectFile
    // (BUG-002: fs.stat would resolve it against process.cwd, not this markdown's dir).
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, classifies, bumps count, recurses again if markdown
  }
```
(`ctx` is already the 4th param — NO signature change. The claimKey + injectFile lines are byte-unchanged. Do NOT
touch scanTokens or processTokenStream.)

### Edit 2 — the MD-LR3 regression test (file-injector.test.mjs; TDD — add FIRST, confirm RED, then apply Edit 1)

Insert immediately after LINE-10's closing `});` (:3323 — LINE-10 ends with the `literal0.ts:0` finally +
`});`), BEFORE the `// LINE-11 — LR-4 …` comment (:3325). Place by IDENTIFIER (line numbers drift).

```js
// MD-LR3 — BUG-002 (bug-hunt 001_a6ffb98ab096): a malformed line range inside a DELIVERED markdown behaves
// EXACTLY like the top level (LR-3): one hasUI-guarded warning naming the raw token, marker verbatim in the
// delivered block, nothing injected, and the raw token never reaching injectFile (which would fs.stat it against
// process.cwd — the old relative-block-name leak). Byte-parity with LINE-10's message. Note: invalid records
// bypass localSeen in scanTokens, so a REPEATED malformed marker warns once PER OCCURRENCE (top-level parity).
// ⚠️ Label is MD-LR3 — the repo's older BUG-001/BUG-002 labels are DIFFERENT historical bugs.
await runCase("MD-LR3", "BUG-002(md): malformed range inside a delivered markdown → LR-3 warning + verbatim + no raw-token injection", async () => {
  const bad = path.join(TMPDIR, "badrange.md");
  fsSync.writeFileSync(bad, "see #@a.md:0 here\n"); // a.md already exists (buildFixtures); a.md:0 does NOT (→ invalid branch)
  try {
    const notes = [];
    const r = await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } });
    assert(r.injected === 1, `only badrange.md delivered (the malformed a.md:0 import is skipped), got injected=${r.injected}`);
    assert(!r.blocks.some((b) => b.includes('name="a.md:0"')), `no a.md:0 block — the raw token never reaches injectFile (no process-cwd stat, no relative-name leak), got ${JSON.stringify(r.blocks)}`);
    assert(notes.length === 1, `exactly one warning (markdown-level LR-3 parity with the top level), got ${notes.length}`);
    assert(notes[0]?.t === "warning", `notify type 'warning', got ${notes[0]?.t}`);
    assert(notes[0]?.m === "#@a.md:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)",
      `byte-parity with the top-level LR-3 message, got ${JSON.stringify(notes[0]?.m)}`);
    assert(hasBlock(r, "see #@a.md:0 here"), `the malformed marker stays VERBATIM inside badrange.md's delivered block`);
    assert(r.text === "Read #@badrange.md", `top-level prompt verbatim, got ${JSON.stringify(r.text)}`);

    // Headless negative: hasUI:false → same delivery, ZERO notifies (the spy is present but the gate holds —
    // proves the hasUI guard, not a missing ui object).
    const notes2 = [];
    const r2 = await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: false, ui: { notify: (m, t) => notes2.push({ m, t }) } });
    assert(r2.injected === 1 && notes2.length === 0, `headless: badrange.md still delivered, NO notify (notes=${notes2.length})`);

    // Repeated malformed marker: invalid records bypass localSeen → one warning PER OCCURRENCE (parity by design).
    fsSync.writeFileSync(bad, "see #@a.md:0 and #@a.md:5-3 here\n");
    const notes3 = [];
    await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes3.push({ m, t }) } });
    assert(notes3.length === 2, `two malformed markers → two warnings (one per occurrence; invalid records bypass localSeen), got ${notes3.length}`);
    assert(notes3[0]?.m.includes("#@a.md:0") && notes3[1]?.m.includes("#@a.md:5-3"), `each warning names its own token as typed`);
  } finally {
    fsSync.rmSync(bad, { force: true }); // inline-fixture discipline (LINE-10/LINE-11 pattern)
  }
});
```
**RED today (traced):** without the guard, `injectFile("a.md:0")` → `fs.stat` vs the repo root (process.cwd) →
ENOENT → `false` → silent verbatim ⇒ the first two asserts pass but `notes.length === 1` fails (got 0). GREEN
after Edit 1.

### Edit 3 — README (Mode A; one sentence, rides with this subtask per item §5)

In `README.md` ## Syntax, the `**Line range.**` paragraph (starts `**Line range.** \`#@a.ts:10\` delivers only
line 10…`, ends `…The same path+range still collapses to one (\`#@a.ts:10 #@a.ts:10\`).`), APPEND:

```
A malformed range (`:0`, `:5-3`) is never treated as a path: the marker is left untouched and a warning is shown — including inside imported markdown files.
```

### Implementation Tasks (ordered — TDD)

```yaml
Task 1 (RED): ADD runCase("MD-LR3") (Edit 2) after LINE-10's `});`, before // LINE-11
  - INLINE fixture badrange.md ("see #@a.md:0 here\n") + finally rmSync; reuse the existing a.md (buildFixtures).
  - RUN: node ./file-injector.test.mjs → MD-LR3 ✗ on `notes.length === 1` (got 0 — the silent path). CONFIRM RED.
    (Every other case stays ✓ — the test is purely additive.)

Task 2 (GREEN): INSERT the invalidRange guard into injectMarkdown Step 5 (Edit 1)
  - EXACT old→new above; guard BEFORE the claimKey re-check; byte-mirror :1274-1278 (comment adapted).
  - DO NOT touch scanTokens / processTokenStream / the claimKey+injectFile lines / injectFile / the signature.
  - RUN: node ./file-injector.test.mjs → MD-LR3 ✓; Result: 184 passed, 0 failed (183 baseline + MD-LR3).

Task 3 (DOCS): APPEND the malformed-range sentence to README's **Line range.** paragraph (Edit 3)
  - ONE sentence; no other README change (the P1.M4.T6.S1 sweep verifies later).

Task 4 (VERIFY gates)
  - npm run typecheck → 0 errors ("warning" is in the notify union).
  - node ./file-injector.test.mjs → 0 failed; ✓ MD-LR3; LINE-7/8/8-MD/9/10/11/12 + REND-TIER3-PATH all ✓.
  - npm test (all 4 files) → green (the other 3 suites are untouched; url-injection's notify cases unaffected).
  - git diff --stat: file-injector.ts + file-injector.test.mjs + README.md ONLY (one hunk each).
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — ONE hunk):
  - injectMarkdown Step 5 (:1597-1603): +the invalidRange guard (4 lines + a 3-line comment) at the top of the
    for-loop body, before the claimKey re-check. UNCHANGED: the claimKey + injectFile lines (byte-identical),
    the Step-3 scan (:1551), the signature (:1546), scanTokens (:1158-1247), processTokenStream (:1270-1284),
    injectFile, splitLineRange — everything else.

FILE_EDITS (file-injector.test.mjs — ONE hunk):
  - +runCase("MD-LR3", …) after LINE-10's closing `});` (:3323), before the // LINE-11 comment (:3325).
  - UNCHANGED: LINE-1..12, LINE-8-MD, REND-* (incl. the sibling's REND-TIER3-PATH :2959), MDV-*, BUG2-*, all
    helpers/fixtures/cases. No buildFixtures change (badrange.md is inline).

FILE_EDITS (README.md — ONE sentence):
  - APPEND to the **Line range.** paragraph in ## Syntax. No other section.

NO_CHANGES: the 3 other .mjs suites, scripts/typecheck.mjs, package.json, PRD.md, all plan/ files. No new
            exports/helpers. No module-surface/guard edits (injectMarkdown stays PRIVATE).
```

## Validation Loop

### Level 1: TDD — RED → GREEN on MD-LR3

```bash
cd /home/dustin/projects/pi-file-injector
# Step A (after Task 1, before Task 2): MD-LR3 must FAIL on the notify assert:
node ./file-injector.test.mjs 2>&1 | grep -A1 "case MD-LR3"
#   Expected: ✗ case MD-LR3 → "exactly one warning (markdown-level LR-3 parity), got 0"  (the silent path)
# Step B (after Task 2): GREEN:
node ./file-injector.test.mjs 2>&1 | grep -E "case MD-LR3|Result:"
#   Expected: "  ✓ case MD-LR3: BUG-002(md): malformed range inside a delivered markdown → …" + "Result: 184 passed, 0 failed."
```

### Level 2: No regression (the LR cluster + the whole suite stay green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case LINE-|case MD-LR3|case REND-TIER3|✗|Result:"
# Expected: LINE-1..6, LINE-7, LINE-8, LINE-8-MD, LINE-9, LINE-10, LINE-11, LINE-12, MD-LR3, REND-TIER3-PATH
#           all ✓; NO ✗ lines; Result: 184 passed, 0 failed.
# (LINE-10 is the byte-parity source; LINE-11 exercises markdown past-EOF notifies nearby — both must hold.)
```

### Level 3: Typecheck + the other suites

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck          # → 0 errors ("warning" is in the Ctx.ui.notify union — the literal is enforced)
npm test                   # → all 4 files green (relative-imports / import-behavior / url-injection untouched)
```

### Level 4: Scope integrity (3 files, one hunk each)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat            # file-injector.ts + file-injector.test.mjs + README.md (nothing else)
git diff file-injector.ts  # ONE hunk: the Step-5 guard; scanTokens/processTokenStream byte-unchanged
# Optional trace probe (confidence only): the RED path is proven by Task 1's Step A; no further probing needed.
```

## Final Validation Checklist

### Technical Validation

- [ ] TDD: MD-LR3 RED before the guard (fails on `notes.length === 1`, got 0), GREEN after.
- [ ] `node ./file-injector.test.mjs` → 184 passed, 0 failed; `✓ case MD-LR3`.
- [ ] `npm run typecheck` → 0 errors; `npm test` → all 4 suites green.
- [ ] `git diff --stat`: exactly file-injector.ts + file-injector.test.mjs + README.md.

### Feature Validation (the BUG-002 contract)

- [ ] Markdown-level malformed range → ONE `"warning"` notify, message byte-identical to the top-level LR-3 string
      naming `#@a.md:0`; `injected === 1` (only the parent); NO block with `name="a.md:0"`; marker verbatim in the
      delivered block; top-level prompt verbatim.
- [ ] Headless (`hasUI:false`) → same delivery, ZERO notifies.
- [ ] Repeated malformed markers → one warning per occurrence (invalid records bypass localSeen — asserted + commented).
- [ ] The raw token never reaches `injectFile` (the process-cwd stat / relative-block-name leak is structurally gone).
- [ ] Valid records unaffected (claimKey + injectFile lines byte-unchanged; LINE-1..12 + every markdown case green).

### Code Quality Validation

- [ ] The guard mirrors processTokenStream (:1274-1278) byte-for-byte (message + hasUI gate + optional chaining).
- [ ] The guard precedes the claimKey re-check (ordering matches the top-level loop).
- [ ] scanTokens / processTokenStream UNTOUCHED; injectMarkdown stays PRIVATE (driven via mod.injectFiles).
- [ ] Test label `MD-LR3` (no collision with the historical BUG-001/BUG-002 labels); inline fixture + finally rmSync.
- [ ] README sentence appended to the correct paragraph, one sentence only.

### Documentation

- [ ] Mode-A comment on the guard cites LR-3 + BUG-002 (why the raw token must not reach injectFile).
- [ ] README `**Line range.**` paragraph documents malformed-range warn behavior incl. inside imported markdown.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT insert the guard AFTER the claimKey re-check.** For an invalid record the "key" is the meaningless
  relative string `"a.md:0"`; the guard must come first (processTokenStream's ordering is the contract).
- ❌ **Do NOT alter the warning string.** It must be byte-identical to the top-level LR-3 message (em dash, `≥`
  chars, exact wording) — LINE-10 :3298 pins it; MD-LR3 asserts the same string for `a.md:0`.
- ❌ **Do NOT touch scanTokens or processTokenStream.** The records and the top-level guard are LANDED and green;
  this task mirrors the guard into the one consumer that lacks it. (Item §3 explicit.)
- ❌ **Do NOT drop the hasUI guard or the optional chaining.** `if (ctx.hasUI) ctx.ui?.notify(...)` — headless
  must stay silent; MD-LR3's headless negative pins it (spy present, gate held).
- ❌ **Do NOT name the test BUG-002.** The repo's existing BUG-001/BUG-002 labels are DIFFERENT historical bugs —
  use **MD-LR3**.
- ❌ **Do NOT "fix" the repeat-warning behavior.** Two malformed markers → two warnings is top-level PARITY by
  design (invalid records bypass localSeen); assert it + comment it, don't dedupe it.
- ❌ **Do NOT rewrite a.md or add it to buildFixtures.** a.md already exists (:257/:378) — reuse. Only badrange.md
  is new (inline + finally rmSync).
- ❌ **Do NOT add the process.chdir leak-repro variant.** The guard makes the leak unreachable; MD-LR3 asserts
  the behavior end-to-end. chdir is global mutable state — skip it.
- ❌ **Do NOT touch the sibling's regions.** renderInjectedMessage (:1047-1102), REND-TIER3-PATH (:2959) — S3's
  territory (parallel). Your regions: Step 5 (:1597), MD-LR3 (:3323+), README Syntax.
- ❌ **Do NOT expand the README edit.** ONE sentence in the Line range. paragraph (the P1.M4.T6 sweep owns the
  changeset-wide pass).

---

## Confidence Score: 9/10

A surgical, fully-traced fix: ONE guard block (verbatim template from :1274-1278, live-verified), ONE TDD test
(complete body given, RED-state traced — today the silent path yields `notes.length === 0`), ONE README sentence.
The warning string is byte-pinned by LINE-10; the placement anchors are identifier-based (LINE-10's `});` →
`// LINE-11`); the naming-collision trap (historical BUG-001/BUG-002 labels) and the localSeen-bypass parity
nuance are both flagged; the parallel sibling's regions are verified disjoint (code/test/docs). The -1 reserves
for line-number drift (all anchors given as quoted text + identifiers, mitigating) and the em-dash/`≥` byte-parity
risk if the implementer retypes the string instead of copying it (MD-LR3's exact-match assert catches any drift
immediately). The implementing agent makes 3 edits and runs 2 commands.