---
name: "P1.M2.T3.S2 (plan/009) — Add markdown verbatim regression test (import markers preserved in delivered content): 2 new runCase blocks (MDV-1 #@ chain, MDV-2 bare-@ chain) pinning that resolved import markers survive VERBATIM in the delivered <file> block while the import still resolves+injects (PRD §5.6 + §6.4)"
prd_ref: "PRD §5.6 (Markdown transitive imports — markers are detected ONLY to resolve imports, NEVER stripped from the content; Step 4 emits the verbatim file-as-read), §6.4 (Assembly & shared state — the prompt is returned byte-for-byte; delivered content is never modified), §10 Edge Cases (markdown import rows), §11 #15/#17"
target_file: "./file-injector.test.mjs"   # ADD 2 new runCase blocks (MDV-1, MDV-2) under a banner BEFORE the Summary block (L2860), AFTER REOPEN-4 (~L2857). NO .ts change, NO aux-suite change, NO harness change, NO buildFixtures change. Each case writes its OWN self-contained fixtures inside the test body (CRLF-E2E pattern).
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (MDV-1/2 ✓; 0 new failures; the 6 pre-existing failures UNCHANGED → "Result: 150 passed, 6 failed.")
depends_on: "P1.M1 (the verbatim engine — LANDED: injectMarkdown emits verbatim content via emitText L1095, no Step 3.5/4 stripping; injectFiles returns text verbatim L1178/L1188; bareAt 4th-param seam L1115/L1164 → injectMarkdown threads state.bareAt to scanTokens L1096) + P1.M2.T1.S2 (Case 15 marker assertion migrated to verbatim L1644). The suite runs against the LANDED verbatim file-injector.ts."
consumed_by: "P1.M3.T1.S1 (wire all three suites into npm test). Nothing depends on these cases at runtime; they are a regression gate for the verbatim-delivered-content contract (markdown import markers survive)."
---

# PRP — P1.M2.T3.S2 (plan/009): markdown verbatim regression test (import markers preserved in delivered content)

> **Scope flag:** This is a **test-addition** task. The engine under test is **already landed and verbatim**
> (P1.M1: `injectMarkdown` Step 4 calls `emitText(abs, content, state)` on the file-as-read content — import
> markers are NEVER stripped, §6.4; `injectFiles` returns `text` verbatim). I add **2 new `runCase` blocks** to
> `file-injector.test.mjs` that pin the **verbatim-delivered-content contract** for markdown imports (PRD §5.6
> + §6.4): a resolved `#@api.md` (or bare `@api.md` under `markdownBareAtImports`) inside a markdown file
> survives **literally** in that file's `<file>` block — it is NOT stripped to `api.md` — AND the import still
> resolves+injects (api.md's block is present). **No `.ts` change, no aux-suite change, no harness change, no
> buildFixtures change.** Each case writes its OWN self-contained fixtures inside the test body (the CRLF-E2E
> pattern at L1655), reuses `hasBlock`/`FIX`/`runCase`/`assert`/`fsSync`/`TMPDIR`/`path`. Prefix `MDV-`
> (no collision with `DELIV-`/`F1`/`T1.S1-`/`REOPEN-`/`M2.T2.S1-`/`MD1`/`MD2`/`CRLF-E2E`/`EDG-`).

---

## Goal

**Feature Goal:** Pin the verbatim-delivered-content contract for markdown transitive imports (PRD §5.6 + §6.4)
as runnable regression cases, so a future change that re-introduces import-marker stripping (the pre-plan-009
behavior — `injectMarkdown` Step 3.5/4 stripped resolved `#@api.md` → `api.md` in the block) is caught
deterministically. Two angles: (1) the canonical `#@` chain — top-level `#@mdVerbatim.md` → mdVerbatim.md
contains `#@apiVerbatim.md` → apiVerbatim.md is injected → mdVerbatim.md's block carries the LITERAL
`#@apiVerbatim.md` marker (not stripped); (2) the bare-`@` chain under `markdownBareAtImports` ON — mdBare.md
contains `@apiBare.md` → the bare marker survives verbatim in the block while the import still resolves.

**Deliverable:** 2 new `runCase` blocks in `file-injector.test.mjs` under a
`// ── P1.M2.T3.S2 (plan/009): markdown verbatim regression (import markers preserved) ──` banner (`MDV-1`,
`MDV-2`), placed AFTER the `REOPEN-4` case (~L2857) and BEFORE the `// 10. Summary + cleanup + exit.` block
(L2860). No other file touched.

**Success Definition:**
1. `node ./file-injector.test.mjs` → the 2 `MDV` cases print ✓; **0 NEW failures** (the suite's 6 pre-existing
   failures — `F1`/`F1b`/`F1d`/`T1.S1-9`/`T1.S1-10`/`T1.S1-12`, all P1.M2.T1's scope — stay EXACTLY as-is;
   passed count rises 148 → 150).
2. `MDV-1` (`#@` chain): `injectFiles("Review #@mdVerbatim.md", [], FIX)` → `r.text === "Review #@mdVerbatim.md"`
   (top-level marker verbatim); `r.blocks.length === 2` (mdVerbatim.md + apiVerbatim.md, pre-order);
   `hasBlock(r, "See #@apiVerbatim.md for details.")` (import marker PRESERVED VERBATIM in the block);
   `!hasBlock(r, "See apiVerbatim.md for details.")` (the STRIPPED form is ABSENT — content is verbatim, not stripped);
   `hasBlock(r, '<file name="' + API_VERBATIM + '">')` (apiVerbatim.md STILL INJECTED despite the marker surviving).
3. `MDV-2` (bare-`@` chain, `markdownBareAtImports` ON): `injectFiles("Review #@mdBare.md", [], FIX, true)` →
   `r.text === "Review #@mdBare.md"` (top-level `#@` verbatim); `r.blocks.length === 2` (mdBare.md + apiBare.md);
   `hasBlock(r, "See @apiBare.md for details.")` (bare marker PRESERVED VERBATIM);
   `!hasBlock(r, "See apiBare.md for details.")` (stripped form ABSENT);
   `hasBlock(r, '<file name="' + API_BARE + '">')` (apiBare.md injected via the bare-`@` import).
4. `git diff --stat file-injector.ts` is **EMPTY**; `git diff --stat` touches ONLY `file-injector.test.mjs`.

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` — and a future refactorer tempted to
"clean up" the delivered markdown by stripping resolved import markers (the pre-plan-009 behavior) for a tidier
`<file>` block.

**Use Case:** `git pull && node ./file-injector.test.mjs` → the 2 MDV cases prove: a markdown file whose content
contains a `#@import.md` (or bare `@import.md`) delivers that content VERBATIM (the marker survives) while the
import STILL resolves and injects. A stripping regression would flip `hasBlock(r, "See #@apiVerbatim.md for details.")`
to ✗ (the marker got stripped) — loud and deterministic.

**Pain Points Addressed:** Plan 009 reversed an earlier stripping design: before P1.M1, `injectMarkdown`
stripped resolved import markers from the delivered content (so the model saw `api.md` not `#@api.md` in the
block). That was an unnecessary mutation of delivered bytes (§6.4: "markers are detected only to resolve
imports — never stripped from content"). The regression is silent at runtime (no error — the model just sees a
slightly different string) and the existing Case 15 covers it on the SHARED notes.md with a single one-line
assert whose TITLE still reads "marker stripped". MDV-1/MDV-2 model the FULL chain with DEDICATED fixtures and a
crisp verbatim-vs-stripped assertion pair, making the contract explicit and the regression noisy.

## Why

- **The contract is subtle and the regression is silent.** §6.4 mandates delivered content is NEVER modified —
  import markers are detected ONLY to resolve the import, then left in place. If `injectMarkdown` ever strips
  them again, no error fires: api.md still injects fine; only the marker string inside mdVerbatim.md's block
  changes (`#@apiVerbatim.md` → `apiVerbatim.md`). MDV-1/MDV-2's `hasBlock(… "#@apiVerbatim.md …")` +
  `!hasBlock(… "apiVerbatim.md …")` pair makes that flip a test failure.
- **Complementary, not duplicative.** Case 15 (L1634) asserts the marker-preserved fact on the SHARED notes.md
  fixture as ONE line among its pre-order two-block structure focus (and its title still says "marker stripped").
  MDV-1 DELIBERATELY models the full chain (top-level → nested import → injection → verbatim-in-block) with a
  dedicated fixture and an explicit stripped-form-absent assertion. Case 26 (bare-@ ON) covers the bare-@ path
  on the SHARED notesBare.md; MDV-2 covers it with a dedicated chain fixture and pins `r.text` + `blocks.length`
  + the stripped-absent form. CRLF-E2E (L1655) is the closest style sibling (self-contained fixtures + verbatim
  assert) but it is a CRLF/fence regression, not the canonical import-marker chain. REOPEN-1..4 (P1.M2.T3.S1,
  already in the tree) pin the VERBATIM PROMPT (re-submission robustness); MDV pins the VERBATIM DELIVERED
  CONTENT (import markers survive inside the block). Different invariant.
- **Self-contained fixtures avoid coupling.** The shared `notes.md` (buildFixtures L252) has content Case 15/16/
  MD1/#27 depend on; reusing it would duplicate Case 15 and couple MDV to a fixture that could change. MDV-1/MDV-2
  write their OWN fixtures inside the test body (the CRLF-E2E pattern), with unique non-colliding names — fully
  decoupled and explicit. No buildFixtures edit (no ripple to the 6 pre-existing cases or the 28+ others).
- **Decoupled from the parallel sibling.** P1.M2.T3.S1 (already landed in the tree) added `REOPEN-1..4` to the
  MAIN suite ONLY. This task ALSO adds to the MAIN suite, AFTER REOPEN-4. Disjoint case IDs (`MDV-` vs `REOPEN-`);
  no fixture collision (MDV fixtures are written inside the test body with unique names). P1.M2.T2.S1 (the aux
  suites) is DONE — disjoint files. No conflict.

## What

No user-visible / API / logic change. **Test additions only.** 2 new `runCase` blocks exercising the
verbatim-delivered-content contract via direct `mod.injectFiles` calls (Mode A — the same mode Case 15/26 use).
Each case writes 2 self-contained fixtures (a `.md` parent + a target `.md`) into TMPDIR inside the test body,
runs `injectFiles`, and asserts: top-level marker verbatim (`r.text`), block count (`r.blocks.length === 2`),
marker PRESERVED (`hasBlock` the `#@`/`@` form), stripped form ABSENT (`!hasBlock` the bare-path form), and the
target STILL INJECTED (`hasBlock` the target's `<file name=…>` opener). No new helpers (reuse `hasBlock`/`FIX`/
`runCase`/`assert`/`fsSync`/`TMPDIR`/`path`). No harness change. No `.ts` change.

### Success Criteria

- [ ] 2 new cases (`MDV-1`, `MDV-2`) present under a `P1.M2.T3.S2 (plan/009)` banner, AFTER `REOPEN-4` (~L2857), BEFORE the Summary block (L2860).
- [ ] MDV-1: `injectFiles("Review #@mdVerbatim.md", [], FIX)` → `text==="Review #@mdVerbatim.md"`, `blocks.length===2`, `hasBlock(r,"See #@apiVerbatim.md for details.")`, `!hasBlock(r,"See apiVerbatim.md for details.")`, `hasBlock(r,'<file name="'+API_VERBATIM+'">')`.
- [ ] MDV-2: `injectFiles("Review #@mdBare.md", [], FIX, true)` → `text==="Review #@mdBare.md"`, `blocks.length===2`, `hasBlock(r,"See @apiBare.md for details.")`, `!hasBlock(r,"See apiBare.md for details.")`, `hasBlock(r,'<file name="'+API_BARE+'">')`.
- [ ] `node ./file-injector.test.mjs` → MDV-1/2 ✓; **0 NEW failures**; the 6 pre-existing failures unchanged → "Result: 150 passed, 6 failed."
- [ ] `git diff --stat file-injector.ts` EMPTY; `git diff --stat` touches ONLY `file-injector.test.mjs`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the EXACT verbatim behavior grounded in the LANDED code (`injectMarkdown` Step 4
calls `emitText(abs, content, state)` on the verbatim file-as-read content — file-injector.ts:1095, quoted;
`injectFiles` returns `text` verbatim in BOTH paths — L1178/L1188, quoted; the `bareAt` 4th-param seam —
L1115/L1164, threaded to `scanTokens` at L1096), the verified harness (`hasBlock` L200, `FIX` ~L356,
`runCase` L90, `assert` L81, `fsSync`/`TMPDIR`/`path` module-loaded), the CRLF-E2E self-contained-fixture
pattern to mirror (L1655, quoted), the Case 15/26 siblings (the migrated one-line assert + the bare-@ ON case,
read for complementarity), the copy-ready code for both cases (below), the insertion point (banner after
REOPEN-4 ~L2857, before the Summary block L2860), the CRITICAL baseline gotcha (148/6 → 150/6; the 6 are out
of scope), the no-collision note (MDV- vs all existing prefixes; fixture names verified absent), and the gate.
The implementer adds a banner + 2 `runCase` blocks (each writing its own fixtures) and runs one command.

### Documentation & References

```yaml
# MUST READ — the verbatim-delivered-content contract this task pins
- file: PRD.md
  why: "§5.6 'Markdown transitive imports' Step 4: 'Apply the inline-vs-paged decision to the VERBATIM content
        (the file exactly as read from disk — import markers are NOT stripped; §6.4)'. Step 3: 'Markers are
        detected here only to resolve imports — they are never stripped from the content … so no index/prefixLen
        bookkeeping is recorded.' §6.4 'Assembly & shared state': 'the user message is always the user's prompt
        verbatim (#@ preserved)'; delivered blocks are never mutated. §11 #15 (md import): the notes.md block is
        'delivered verbatim (marker #@api.md preserved)'."
  section: "§5.6 (Steps 3 + 4 — markers detected only to resolve, never stripped; emit verbatim) + §6.4"
  critical: "The whole point: the import marker string (#@api.md / @api.md) MUST survive LITERALLY in the
             delivered <file> block. MDV-1/MDV-2 pin hasBlock(… the #@/@ form …) AND !hasBlock(… the stripped
             bare-path form …). If you ever see the marker stripped, the verbatim-delivered-content contract
             regressed."

# MUST READ — the verbatim engine I'm testing (read-only; the contract)
- file: file-injector.ts
  why: "L1085 injectMarkdown(abs, content, state, ctx): Step 2 claim self; Step 3 scanTokens(content, dir,
        { allowAbsTilde:false, skipCode:true, tryMdExt:true, bareAt: state.bareAt }, state) → absPaths (resolved
        import paths, encounter order; markers NEVER stripped — comment L1095 'markers are detected ONLY to
        resolve imports, never stripped'); Step 4 emitText(abs, content, state) emits the VERBATIM content;
        Step 5 recurse depth-first. L1111 injectFiles(text, imagesIn, ctx, bareAt=false): the 4th param bareAt
        is the §4.6 seam; L1164 state.bareAt=bareAt threaded into injectMarkdown→scanTokens. L1178 count===0
        return { text, … } (text = ORIGINAL ref, verbatim); L1188 count>0 return { text, images, injected,
        paged, blocks, details } (SAME text ref — comment 'byte-for-byte VERBATIM'). L1177 the TOP-LEVEL
        processTokenStream scan hardcodes bareAt:false (top-level is #@-only; §4.6 markdown-only invariant)."
  pattern: "injectMarkdown emits content VERBATIM (emitText on the file-as-read bytes); injectFiles returns the
            prompt text verbatim. The bareAt 4th param affects ONLY markdown import scanning, never top-level.
            Tests assert: r.text === prompt (top-level #@ verbatim); hasBlock(r, '<#@/@marker>…') (survives in
            the block); !hasBlock(r, '<stripped>…') (stripped form absent); hasBlock(r, '<file name=\"target\">')
            (target still injected)."
  critical: "There is NO Step 3.5/Step 4 stripping anywhere (plan 009 / P1.M1.T1.S2 DELETED it). If you see the
             marker stripped in the block, the contract regressed — REPORT it; do NOT weaken the assert."

# The test harness (grounded in the live helpers + the CRLF-E2E pattern)
- file: file-injector.test.mjs
  why: "L200 function hasBlock(r, needle) { return r.blocks.some((b) => b.includes(needle)); } — THE helper for
        'does any block contain this substring.' L81 assert(cond,msg); L90 runCase(n,name,fn). ~L356 FIX={cwd:TMPDIR};
        L212 TMPDIR=fsSync.mkdtempSync(path.join(os.tmpdir(),'saf-')); fsSync/path/os module-loaded at top.
        L1655 CRLF-E2E — THE pattern to mirror: writes its OWN fixtures inside the test body
        (fsSync.writeFileSync(path.join(TMPDIR,'crlf_spec.md'), …)), runs injectFiles('Read #@crlf_spec.md',[],FIX),
        asserts hasBlock(r,'See #@crlf_after.md') + !hasBlock(r,'See crlf_after.md')."
  pattern: "Self-contained fixture: const p=path.join(TMPDIR,'mdVerbatim.md'); fsSync.writeFileSync(p,'See #@apiVerbatim.md for details.\\n');
            const t=path.join(TMPDIR,'apiVerbatim.md'); fsSync.writeFileSync(t,'# API Verbatim\\n\\nImport-chain target content.\\n');
            const r=await mod.injectFiles('Review #@mdVerbatim.md',[],FIX); … REUSE hasBlock/FIX/runCase/assert/fsSync/TMPDIR/path."
  gotcha: "Do NOT add fixtures to buildFixtures (L232) — it is shared by 28+ cases; changes ripple. Write fixtures
           INSIDE the test body (CRLF-E2E pattern), with UNIQUE non-colliding names (mdVerbatim/apiVerbatim/mdBare/
           apiBare — verified absent via grep)."

# The migrated sibling + the bare-@ ON case (read for complementarity, NOT duplication)
- file: file-injector.test.mjs   # Case 15 (L1634), Case 26 (L2384), CRLF-E2E (L1655)
  why: "Case 15 asserts hasBlock(r,'Imports #@api.md here.') + !hasBlock(r,'Imports api.md here.') on the SHARED
        notes.md as ONE line among its pre-order two-block-structure focus (title still says 'marker stripped').
        Case 26 (bare-@ ON, 4th param true) asserts hasBlock(r,'Refs @api.md here.') on the SHARED notesBare.md.
        CRLF-E2E is the self-contained-fixture style model. MDV-1/MDV-2 are DELIBERATE regression cases: dedicated
        chain fixtures, the full-chain shape (r.text + blocks.length + marker-present + stripped-absent +
        target-injected), citing §5.6/§6.4 as rationale. Mirror their STYLE (runCase + assert with diagnostics);
        do NOT reuse their fixtures (coupling) or their IDs (collision)."
  critical: "MDV-1/MDV-2 are LEANER but SHARPER than Case 15 — they model the WHOLE chain (top-level verbatim,
             2 blocks pre-order, marker survives, stripped form absent, target still injected) with a dedicated
             fixture each. Do not re-assert pre-order index ordering (Case 15 owns that) — blocks.length===2 +
             hasBlock(target) suffices for the verbatim-content contract."

# The baseline reality — the suite is RED (6 pre-existing failures, NOT mine)
- file: file-injector.test.mjs   # F1/F1b/F1d (~L800-820), T1.S1-9/10/12 (L2055-2103)
  why: "These 6 cases FAIL at baseline (148 passed, 6 failed — REOPEN-1..4 already raised 144→148). F1/F1b/F1d
        depend on the OLD stripping model (dedup-after-strip); T1.S1-9/10/12 read the DEAD .prefixLen/.abs fields
        (scanTokens now returns string[]). ALL are P1.M2.T1's main-suite-migration scope — NOT mine. My MDV cases
        pass cleanly regardless. I MUST NOT touch these 6 (scope creep into P1.M2.T1)."
  critical: "After my work: 150 passed, 6 failed (my 2 added + green; the 6 unchanged). The gate is 'MDV-1/2 ✓
             AND 0 NEW failures' — NOT '0 failed'. Do not 'fix' the 6; do not report them as your problem."

# The parallel sibling (already landed — read for placement, no collision)
- file: file-injector.test.mjs   # REOPEN-1..4 (L2791-2857), Summary block (L2860)
  why: "P1.M2.T3.S1 (already in the working tree) added REOPEN-1..4 (verbatim PROMPT / re-submission robustness)
        BEFORE the Summary block. MDV goes AFTER REOPEN-4 (~L2857), BEFORE the Summary block (L2860). Disjoint
        case IDs (MDV- vs REOPEN-); disjoint fixtures (MDV writes its own; REOPEN reused a.ts). No conflict."
```

### Current Codebase tree (read-only overview — this task edits ONLY file-injector.test.mjs)

```bash
pi-file-injector/                # HEAD + plan-009 verbatim engine (P1.M1 LANDED) + P1.M2.T1 migration + P1.M2.T3.S1 REOPEN cases
├── file-injector.test.mjs       # ← THE ONLY FILE EDITED (+2 MDV cases under a banner after REOPEN-4 ~L2857, before Summary L2860)
├── file-injector.ts             # UNCHANGED (the verbatim engine — LANDED; git diff empty)
├── relative-imports.test.mjs    # NOT edited (P1.M2.T2.S1's scope — DONE)
├── import-behavior.test.mjs     # NOT edited (P1.M2.T2.S1's scope — DONE)
├── scripts/typecheck.mjs        # untouched (.ts unchanged → trivially clean)
├── package.json / PRD.md / README.md   # untouched (README = P1.M2.T4.S1)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{test_assertions_analysis.md, stripping_logic_analysis.md, readme_analysis.md, system_context.md}
    ├── P1M1T1S1..P1M2T3S1/{research, PRP.md}   # P1.M1 (verbatim engine) LANDED; P1.M2.T1 (migration) LANDED; P1.M2.T3.S1 (REOPEN) LANDED in-tree
    └── P1M2T3S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 banner comment + 2 runCase blocks (MDV-1, MDV-2) after REOPEN-4 (~L2857),
                          #           before the Summary block (L2860). Each case writes its OWN fixtures in the
                          #           test body (CRLF-E2E pattern). NO harness change, NO buildFixtures change,
                          #           NO new exported helpers, NO migration of existing cases.
# file-injector.ts + relative-imports.test.mjs + import-behavior.test.mjs + scripts/typecheck.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the suite is RED at baseline (148 passed, 6 failed). The 6 failures are PRE-EXISTING and OUT OF
//   SCOPE: F1/F1b/F1d (~L800-820, dedup-after-strip — depend on the OLD model) + T1.S1-9/10/12 (L2055-2103,
//   read DEAD .prefixLen/.abs). They are P1.M2.T1's main-suite-migration job, NOT mine. My 2 MDV cases pass
//   cleanly regardless. GATE = "MDV-1/2 ✓ AND 0 NEW failures" — NOT "0 failed". Do NOT touch the 6.

// CRITICAL — injectMarkdown emits content VERBATIM (file-injector.ts:1095 emitText(abs, content, state) on the
//   file-as-read bytes). There is NO Step 3.5/Step 4 stripping anywhere (plan 009 / P1.M1.T1.S2 DELETED it).
//   architecture/stripping_logic_analysis.md documents the OLD stripping — that is SUPERSEDED. Trust the LIVE
//   .ts. The import marker (#@api.md / @api.md) survives LITERALLY in the delivered <file> block. MDV-1/MDV-2
//   pin hasBlock(marker) + !hasBlock(stripped). If hasBlock(stripped) is TRUE, the contract regressed — REPORT it.

// CRITICAL — the 4th `bareAt` param to injectFiles (L1115) is the §4.6 seam: it affects ONLY markdown import
//   scanning (injectMarkdown threads state.bareAt → scanTokens at L1096), NEVER the top-level scan (L1177
//   hardcodes bareAt:false). So for MDV-2 (bare-@ chain), pass `true` as the 4th param: the top-level #@mdBare.md
//   resolves via FILE_INJECT_RE (always), and mdBare.md's bare @apiBare.md resolves via BARE_AT_RE (bareAt on).
//   For MDV-1 (#@ chain), OMIT the 4th param (defaults false) — the #@ marker needs no bareAt.

// GOTCHA — write fixtures INSIDE the test body (CRLF-E2E pattern, L1655), NOT in buildFixtures (L232). The shared
//   notes.md/notesBare.md/api.md fixtures are depended on by Case 15/16/25/26/27/MD1 — do NOT touch them. Use
//   UNIQUE non-colliding names: mdVerbatim/apiVerbatim/mdBare/apiBare (verified absent via grep). Each MDV case
//   writes its own 2 fixtures (a .md parent + a target .md) into TMPDIR before calling injectFiles.

// GOTCHA — hasBlock(r, needle) (L200) does a SUBSTRING `.includes(needle)` across r.blocks. For the verbatim
//   assertion, pass a distinctive substring of the fixture content that CONTAINS the marker:
//   hasBlock(r, "See #@apiVerbatim.md for details.") — and for the stripped-absent check:
//   !hasBlock(r, "See apiVerbatim.md for details.") (the SAME sentence WITHOUT the # — proves the # survived).
//   Make the needle SPECIFIC (the full sentence, not just "#@apiVerbatim.md") so a partial/false match is impossible.

// GOTCHA — case-ID collision: DELIV-/F1/T1.S1-/REOPEN-/M2.T2.S1-/MD1/MD2/CRLF-E2E/EDG- all exist. Use MDV-1/MDV-2
//   (Markdown Verbatim — distinct from MD1/MD2 which are §10 markdown EDGES). Fixture names mdVerbatim/apiVerbatim/
//   mdBare/apiBare are verified absent (grep returns nothing).

// GOTCHA — the path constants API_VERBATIM/API_BARE are NOT pre-declared (they're local to each test body, like
//   CRLF-E2E's crlfSpec/crlfAfter). Declare them inside the runCase fn: const API_VERBATIM=path.join(TMPDIR,'apiVerbatim.md').

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti (alias map, file-injector.test.mjs:39-66). No test runner.
//   The gate is `node ./file-injector.test.mjs`. npm run typecheck is belt-and-suspenders (.ts untouched → 0 errors).
```

## Implementation Blueprint

### Data models and structure

No new data models. The cases assert against the LANDED verbatim engine by reusing existing helpers + writing
self-contained fixtures:

```js
// Mode A (both MDV cases): direct pipeline call with optional bareAt 4th param.
const r = await mod.injectFiles(prompt, [], FIX, bareAt);   // r = { text, images, injected, paged, blocks, details }
// r.text === prompt ALWAYS (verbatim — the top-level #@ survives; §6.4).
// r.blocks[i] is a <file name="ABS">\n<content>\n</file> string. The markdown parent's block carries its
//   content VERBATIM — the import marker (#@apiVerbatim.md / @apiBare.md) survives LITERALLY inside it.

// Self-contained fixtures (CRLF-E2E pattern): write inside the test body, unique names, into TMPDIR.
const parent = path.join(TMPDIR, "mdVerbatim.md");
const target = path.join(TMPDIR, "apiVerbatim.md");
fsSync.writeFileSync(parent, "See #@apiVerbatim.md for details.\n");
fsSync.writeFileSync(target, "# API Verbatim\n\nImport-chain target content.\n");
```

### The 2 cases (exact specs — encode as runCase blocks)

```js
// ── P1.M2.T3.S2 (plan/009): markdown verbatim regression (import markers preserved in delivered content) ──
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pins PRD §5.6 (Step 4: emit the VERBATIM content — import markers are NOT stripped) + §6.4 (delivered
// content is never modified). Models the FULL chain: top-level #@parent.md → parent.md contains a #@/@import
// marker → the target is injected → the marker survives LITERALLY in parent.md's <file> block (NOT stripped to
// the bare path). A stripping regression (the pre-plan-009 injectMarkdown Step 3.5/4) would flip the
// hasBlock(marker) assert to ✗. Each case writes its OWN self-contained fixtures (CRLF-E2E pattern, L1655) —
// do NOT touch buildFixtures (shared by 28+ cases). REUSE hasBlock/FIX/runCase/assert/fsSync/TMPDIR/path — no
// new helpers. Prefix MDV- (no collision with DELIV-/F1/T1.S1-/REOPEN-/M2.T2.S1-/MD1/MD2/CRLF-E2E/EDG-).

// MDV-1 — #@ IMPORT-MARKER CHAIN (verbatim in delivered content). The canonical case: a top-level #@mdVerbatim.md
// whose content contains #@apiVerbatim.md. The import RESOLVES (apiVerbatim.md is injected) AND the marker
// SURVIVES verbatim in mdVerbatim.md's block (not stripped to "apiVerbatim.md").
await runCase("MDV-1", "md verbatim: top-level #@mdVerbatim.md → its #@apiVerbatim.md marker survives VERBATIM in the block (NOT stripped) while apiVerbatim.md still injects (§5.6/§6.4)", async () => {
  // Self-contained fixtures (CRLF-E2E pattern): unique non-colliding names, written into TMPDIR.
  const MD_VERBATIM = path.join(TMPDIR, "mdVerbatim.md");
  const API_VERBATIM = path.join(TMPDIR, "apiVerbatim.md");
  fsSync.writeFileSync(MD_VERBATIM, "See #@apiVerbatim.md for details.\n");
  fsSync.writeFileSync(API_VERBATIM, "# API Verbatim\n\nImport-chain target content.\n");
  const r = await mod.injectFiles("Review #@mdVerbatim.md", [], FIX);   // bareAt defaults false — #@ needs no bareAt
  // (a) top-level prompt is VERBATIM (§6.4): the #@mdVerbatim.md marker survives in r.text.
  assert(r.text === "Review #@mdVerbatim.md", `r.text must be the verbatim prompt (#@ preserved — §6.4), got ${JSON.stringify(r.text)}`);
  // (b) BOTH files injected, pre-order depth-first (mdVerbatim.md then its import apiVerbatim.md).
  assert(r.injected === 2, `expected injected===2 (mdVerbatim.md + apiVerbatim.md), got ${r.injected}`);
  assert(Array.isArray(r.blocks) && r.blocks.length === 2, `r.blocks must have length 2 (parent + import), got ${JSON.stringify(r.blocks?.length)}`);
  // (c) THE KEYSTONE: the import marker SURVIVES VERBATIM in mdVerbatim.md's delivered block (§5.6 Step 4 / §6.4).
  assert(hasBlock(r, "See #@apiVerbatim.md for details."), `mdVerbatim.md block: the import marker #@apiVerbatim.md must be PRESERVED VERBATIM (§5.6/§6.4), got blocks=${JSON.stringify(r.blocks)}`);
  // (d) the STRIPPED form is ABSENT (proves the # survived — content is verbatim, not stripped to bare path).
  assert(!hasBlock(r, "See apiVerbatim.md for details."), `the stripped form 'See apiVerbatim.md' must be ABSENT (content is verbatim, §6.4) — a stripping regression would make this PRESENT, got blocks=${JSON.stringify(r.blocks)}`);
  // (e) apiVerbatim.md was STILL INJECTED despite the marker being preserved (the import resolved+injected).
  assert(hasBlock(r, '<file name="' + API_VERBATIM + '">'), `apiVerbatim.md must STILL be injected (the import resolved), got blocks=${JSON.stringify(r.blocks)}`);
});

// MDV-2 — BARE-@ IMPORT-MARKER CHAIN (markdownBareAtImports ON, verbatim in delivered content). The bare-@
// variant: a top-level #@mdBare.md whose content contains a BARE @apiBare.md. With bareAt:true (4th param),
// the bare import RESOLVES (apiBare.md is injected) AND the bare marker SURVIVES verbatim in mdBare.md's block
// (not stripped to "apiBare.md"). Pins the same contract for the §4.6 opt-in bare-@ path.
await runCase("MDV-2", "md verbatim (bare-@ on): top-level #@mdBare.md → its BARE @apiBare.md marker survives VERBATIM in the block (NOT stripped) while apiBare.md still injects (§4.6/§5.6/§6.4)", async () => {
  // Self-contained fixtures (CRLF-E2E pattern): unique non-colliding names, written into TMPDIR.
  const MD_BARE = path.join(TMPDIR, "mdBare.md");
  const API_BARE = path.join(TMPDIR, "apiBare.md");
  fsSync.writeFileSync(MD_BARE, "See @apiBare.md for details.\n");
  fsSync.writeFileSync(API_BARE, "# API Bare\n\nBare-at import target content.\n");
  const r = await mod.injectFiles("Review #@mdBare.md", [], FIX, true);   // 4th param bareAt=true (§4.6) — enables bare-@ markdown imports
  // (a) top-level prompt is VERBATIM (§6.4): the #@mdBare.md marker survives in r.text (the bare @ is INSIDE
  //     mdBare.md's content, delivered verbatim; the top-level scan is #@-only regardless of bareAt — L1177).
  assert(r.text === "Review #@mdBare.md", `r.text must be the verbatim prompt (#@ preserved — §6.4), got ${JSON.stringify(r.text)}`);
  // (b) BOTH files injected (mdBare.md + its bare-@ import apiBare.md).
  assert(r.injected === 2, `expected injected===2 (mdBare.md + apiBare.md via bare-@ import), got ${r.injected}`);
  assert(Array.isArray(r.blocks) && r.blocks.length === 2, `r.blocks must have length 2 (parent + bare-@ import), got ${JSON.stringify(r.blocks?.length)}`);
  // (c) THE KEYSTONE: the BARE import marker SURVIVES VERBATIM in mdBare.md's delivered block (§5.6 Step 4 / §6.4).
  assert(hasBlock(r, "See @apiBare.md for details."), `mdBare.md block: the bare import marker @apiBare.md must be PRESERVED VERBATIM (§4.6/§5.6/§6.4), got blocks=${JSON.stringify(r.blocks)}`);
  // (d) the STRIPPED form is ABSENT (proves the @ survived — content is verbatim, not stripped to bare path).
  assert(!hasBlock(r, "See apiBare.md for details."), `the stripped form 'See apiBare.md' must be ABSENT (content is verbatim, §6.4) — a stripping regression would make this PRESENT, got blocks=${JSON.stringify(r.blocks)}`);
  // (e) apiBare.md was STILL INJECTED via the bare-@ import (bareAt on → BARE_AT_RE ran → resolved).
  assert(hasBlock(r, '<file name="' + API_BARE + '">'), `apiBare.md must STILL be injected (the bare-@ import resolved under markdownBareAtImports), got blocks=${JSON.stringify(r.blocks)}`);
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the banner + 2 runCase blocks (file-injector.test.mjs, AFTER REOPEN-4 ~L2857, BEFORE the Summary block L2860)
  - ADD a banner comment: `// ── P1.M2.T3.S2 (plan/009): markdown verbatim regression (import markers preserved) ──`
    (cite PRD §5.6 Step 4 / §6.4; note: self-contained fixtures CRLF-E2E pattern; reuse hasBlock/FIX/runCase/assert;
    prefix MDV-; do NOT touch buildFixtures).
  - ADD the 2 runCase blocks (MDV-1, MDV-2) verbatim per the blueprint above. Each writes its OWN 2 fixtures
    (parent .md + target .md) inside the test body, then calls injectFiles, then asserts the 5 facts.
  - NAMING: `MDV-1`, `MDV-2` (NOT `DELIV-`/`F1`/`T1.S1-`/`REOPEN-`/`MD1`/`MD2`/`CRLF-E2E` — all exist).
  - FIXTURE NAMES: mdVerbatim/apiVerbatim/mdBare/apiBare (verified non-colliding via grep). DECLARED LOCALLY
    inside each runCase fn (like CRLF-E2E's crlfSpec/crlfAfter), NOT in the module-level path-constant block.
  - PLACEMENT: AFTER the REOPEN-4 case (its closing `});` ~L2857); BEFORE the `// 10. Summary + cleanup + exit.`
    block (L2860). One blank line separator above and below the banner.
  - DO NOT: edit buildFixtures (L232); add module-level path constants; add helpers (reuse hasBlock/FIX/runCase/
    assert/fsSync/TMPDIR/path); modify existing cases (DELIV-/F1/T1.S1-/REOPEN-/Case 15/26/CRLF-E2E); touch
    file-injector.ts; touch the aux suites; touch scripts/typecheck.mjs.

Task 2: VERIFY the gate
  - RUN: node ./file-injector.test.mjs → EXPECT "Result: 150 passed, 6 failed." (current 148 + my 2), exit 1
    (the 6 pre-existing failures keep exit code 1 — they are NOT mine). The 2 MDV cases print ✓.
    LOAD-BEARING: the 2 MDV ✓ appear; NO existing case flips from ✓ to ✗ (no new failures beyond the known 6).
  - RUN: node ./file-injector.test.mjs 2>&1 | grep -E "MDV-|Result:" → 2 "✓ case MDV-…" lines; "Result: 150 passed, 6 failed."
  - RUN: git diff --stat file-injector.ts → EXPECT EMPTY (tests only).
  - RUN: git diff --stat → EXPECT ONLY file-injector.test.mjs (no .ts, no aux suites, no scripts/typecheck.mjs).
  - (belt-and-suspenders) npm run typecheck → 0 errors (the .ts is untouched → trivially clean).
  - IF an MDV case fails:
      MDV-1/2 hasBlock(marker) === false → the import marker is being STRIPPED (the exact regression this catches;
        injectMarkdown Step 3.5/4 reintroduced) — REPORT it; do NOT weaken the assert to the stripped form.
      MDV-1/2 !hasBlock(stripped) fails (stripped is PRESENT) → same regression (stripping reintroduced) — REPORT it.
      MDV-1/2 injected !== 2 / !hasBlock(target) → the import did NOT resolve (bareAt wrong for MDV-2, or a
        resolveImportPath regression) — for MDV-2 check the 4th param is `true`; for MDV-1 check FIX.cwd===TMPDIR.
      MDV-1/2 r.text !== prompt → the verbatim PROMPT contract regressed (injectFiles L1178/L1188) — NOT this
        task's code; report it.
      "Cannot find module" / jiti error → the harness alias (L39-66) was disturbed — NOT this task's code; report it.
```

### Implementation Patterns & Key Details

```js
// Self-contained-fixture pattern (CRLF-E2E L1655 is the model): write fixtures INSIDE the test body.
await runCase("MDV-1", "…", async () => {
  const MD_VERBATIM = path.join(TMPDIR, "mdVerbatim.md");          // declared LOCALLY (not module-level)
  const API_VERBATIM = path.join(TMPDIR, "apiVerbatim.md");
  fsSync.writeFileSync(MD_VERBATIM, "See #@apiVerbatim.md for details.\n");
  fsSync.writeFileSync(API_VERBATIM, "# API Verbatim\n\nImport-chain target content.\n");
  const r = await mod.injectFiles("Review #@mdVerbatim.md", [], FIX);  // bareAt omitted → false (#@ needs none)
  r.text === "Review #@mdVerbatim.md";                               // top-level #@ verbatim (§6.4)
  r.blocks.length === 2;                                              // parent + import, pre-order
  hasBlock(r, "See #@apiVerbatim.md for details.");                   // marker PRESERVED verbatim (§5.6/§6.4) — KEYSTONE
  !hasBlock(r, "See apiVerbatim.md for details.");                    // stripped form ABSENT (proves # survived)
  hasBlock(r, '<file name="' + API_VERBATIM + '">');                  // target STILL injected
});

// The bare-@ variant (MDV-2): pass `true` as the 4th param (§4.6 seam — markdown-only, top-level unaffected).
const r = await mod.injectFiles("Review #@mdBare.md", [], FIX, true);   // bareAt on → bare @apiBare.md resolves
hasBlock(r, "See @apiBare.md for details.");                            // bare marker PRESERVED verbatim
!hasBlock(r, "See apiBare.md for details.");                            // stripped form ABSENT

// CRITICAL: the verbatim-vs-stripped ASSERTION PAIR is the heart of this regression test.
//   hasBlock(r, "See #@apiVerbatim.md for details.")   → the marker SURVIVED (the # is still there)
//   !hasBlock(r, "See apiVerbatim.md for details.")    → the stripped form (no #) is ABSENT
//   These two TOGETHER pin that the # survived AND was not replaced. If stripping is reintroduced, the FIRST
//   flips to false (marker gone) AND the SECOND flips to true (stripped present) — a loud, unambiguous failure.
//   Make the needle the FULL SENTENCE (not just "#@apiVerbatim.md") so a partial/false substring match is impossible.

// CRITICAL: reuse ONLY hasBlock/FIX/runCase/assert/fsSync/TMPDIR/path. No new fixtures in buildFixtures; no new helpers.
// CRITICAL: the suite is RED at baseline (6 pre-existing failures) — your gate is "MDV-1/2 ✓ + 0 NEW failures", NOT "0 failed".
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - file-injector.test.mjs: +1 banner comment + 2 runCase blocks (MDV-1, MDV-2) AFTER REOPEN-4 (~L2857), BEFORE
    the Summary block (L2860). Each case writes its OWN 2 fixtures inside the test body (CRLF-E2E pattern).
    REUSES hasBlock (L200), FIX (~L356), runCase (L90), assert (L81), fsSync/TMPDIR/path (module-loaded), mod
    (the jiti-loaded extension). NO new fixtures in buildFixtures; NO module-level path constants; NO harness
    change; NO new exported helpers; NO migration of existing cases.
NO_CHANGES: file-injector.ts (git diff empty — the verbatim engine is LANDED), relative-imports.test.mjs +
            import-behavior.test.mjs (P1.M2.T2.S1's scope — DONE), scripts/typecheck.mjs, package.json, PRD.md,
            README.md (P1.M2.T4.S1), all plan/ files.
NO_LOGIC_CHANGE: the engine is UNCHANGED — this task adds TESTS that pin the landed verbatim-delivered-content
                 contract (markdown import markers survive in the <file> block).
```

## Validation Loop

### Level 1: The suite run (the authoritative gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 150 passed, 6 failed." (current baseline 148 + my 2). The 6 failures are PRE-EXISTING
#   (F1/F1b/F1d/T1.S1-9/T1.S1-10/T1.S1-12 — P1.M2.T1's scope, NOT mine). Exit code is 1 BECAUSE of those 6,
#   not because of my cases. LOAD-BEARING: the 2 MDV cases print ✓; NO existing case flips ✓→✗.
# If an MDV case shows ✗ → see Task 2's failure-triage (an MDV failure is almost certainly a real
#   verbatim-delivered-content regression to REPORT — hasBlock(marker) ✗ or !hasBlock(stripped) ✗ means
#   stripping was reintroduced, the exact bug this catches).
# If an EXISTING case flips to ✗ beyond the known 6 → you accidentally edited it or buildFixtures; revert.
```

### Level 2: Targeted checks (the 2 new cases + scope)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "MDV-|Result:" | head
# Expected: 2 "✓ case MDV-…" lines; "Result: 150 passed, 6 failed.". ZERO "✗ case MDV-" lines.

# Scope integrity — only file-injector.test.mjs changed; the .ts, the aux suites, and scripts are untouched:
git diff --stat file-injector.ts                    # expect EMPTY (the engine is LANDED; tests only)
git diff --stat file-injector.test.mjs              # expect the file (+banner + 2 cases)
git diff --stat relative-imports.test.mjs import-behavior.test.mjs scripts/typecheck.mjs   # expect EMPTY
git diff --stat                                     # expect ONLY file-injector.test.mjs
```

### Level 3: Belt-and-suspenders (typecheck — the .ts is untouched → trivially clean)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# (The .mjs is untyped; the .ts is unchanged → 0 errors regardless. Confirms no accidental .ts edit.)
```

### Level 4: Cross-reference the landed contract (read-only — confirm the behavior my cases pin)

```bash
cd /home/dustin/projects/pi-file-injector
grep -n "emitText(abs, content" file-injector.ts                # injectMarkdown Step 4 emits VERBATIM content (L1095)
grep -n "markers are detected ONLY to resolve imports, never stripped" file-injector.ts  # the no-strip contract
grep -n "return { text" file-injector.ts                        # injectFiles returns text verbatim (L1178 + L1188)
grep -n "bareAt = false" file-injector.ts                       # the §4.6 4th-param seam (L1115)
grep -n "bareAt: state.bareAt" file-injector.ts                 # injectMarkdown threads bareAt to scanTokens (L1096)
# Expected: hits at each — these are the exact contract lines MDV-1/MDV-2 pin.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → "Result: 150 passed, 6 failed." (my 2 added + green; the 6 pre-existing failures UNCHANGED).
- [ ] The 2 `MDV` cases print ✓; ZERO `✗ case MDV-` lines; NO existing case flips ✓→✗ beyond the known 6.
- [ ] `git diff --stat file-injector.ts` is **EMPTY**; `git diff --stat` touches ONLY `file-injector.test.mjs`.

### Feature Validation (the contracts the 2 cases pin)

- [ ] MDV-1: `injectFiles("Review #@mdVerbatim.md", [], FIX)` → `text==="Review #@mdVerbatim.md"`, `injected===2`, `blocks.length===2`, `hasBlock(r,"See #@apiVerbatim.md for details.")`, `!hasBlock(r,"See apiVerbatim.md for details.")`, `hasBlock(r,'<file name="'+API_VERBATIM+'">')`.
- [ ] MDV-2: `injectFiles("Review #@mdBare.md", [], FIX, true)` → `text==="Review #@mdBare.md"`, `injected===2`, `blocks.length===2`, `hasBlock(r,"See @apiBare.md for details.")`, `!hasBlock(r,"See apiBare.md for details.")`, `hasBlock(r,'<file name="'+API_BARE+'">')`.

### Code Quality Validation

- [ ] Calls `mod.injectFiles` (Mode A) — no `scanTokens`, no dedup sentinels, no rendering, no handler capture.
- [ ] REUSES `hasBlock`/`FIX`/`runCase`/`assert`/`fsSync`/`TMPDIR`/`path` — no new helpers, no new module-level constants.
- [ ] Each case writes its OWN self-contained fixtures inside the test body (CRLF-E2E pattern) — NO `buildFixtures` edit.
- [ ] Fixture names `mdVerbatim`/`apiVerbatim`/`mdBare`/`apiBare` are UNIQUE and non-colliding (grep-verified absent).
- [ ] Case IDs `MDV-1`/`MDV-2` (non-colliding with `DELIV-`/`F1`/`T1.S1-`/`REOPEN-`/`M2.T2.S1-`/`MD1`/`MD2`/`CRLF-E2E`/`EDG-`).
- [ ] MDV-2 passes `true` as the 4th `bareAt` param (§4.6 seam — markdown-only bare-@ imports; top-level unaffected).

### Documentation

- [ ] None (test additions only — item §5 "DOCS: none"). No README/PRD change (README = P1.M2.T4.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT "fix" the 6 pre-existing failures** (`F1`/`F1b`/`F1d`/`T1.S1-9`/`T1.S1-10`/`T1.S1-12`). They are
  P1.M2.T1's main-suite-migration scope (dedup-after-strip + dead `.prefixLen`/`.abs` reads). Touching them is
  scope creep; it will conflict with P1.M2.T1 and obscure whether YOUR cases are green. Your gate is
  "MDV-1/2 ✓ AND 0 NEW failures", NOT "0 failed".
- ❌ **Do NOT weaken the verbatim-vs-stripped pair if it fails.** `hasBlock(r, "See #@apiVerbatim.md for details.")`
  + `!hasBlock(r, "See apiVerbatim.md for details.")` is the heart of this regression test. If the marker is
  stripped, BOTH flips fire — that is the exact bug this task exists to catch. REPORT it as a real engine
  regression (injectMarkdown Step 3.5/4 stripping reintroduced); do NOT change the assert to tolerate the
  stripped form or drop the `!hasBlock(stripped)` check.
- ❌ **Do NOT reuse the shared `notes.md`/`notesBare.md`/`api.md` fixtures** for the MDV cases. Case 15/16/25/26/27/MD1
  depend on their exact content; asserting on `notes.md` would DUPLICATE Case 15's one-line marker assert and
  couple MDV to a fixture that could change. Write DEDICATED fixtures inside the test body (mdVerbatim/apiVerbatim/
  mdBare/apiBare — the CRLF-E2E pattern).
- ❌ **Do NOT add fixtures to `buildFixtures` (L232).** It is shared by 28+ cases; a change ripples and risks
  flipping a pre-existing case (violating "0 NEW failures"). Write fixtures INSIDE each `runCase` fn body.
- ❌ **Do NOT use a vague needle** like `hasBlock(r, "#@apiVerbatim.md")`. Use the FULL SENTENCE
  (`"See #@apiVerbatim.md for details."`) so a partial/false substring match is impossible, and so the paired
  stripped check (`"See apiVerbatim.md for details."`) is unambiguous (the SAME sentence without the `#`).
- ❌ **Do NOT forget the 4th `bareAt` param for MDV-2.** `injectFiles("Review #@mdBare.md", [], FIX, true)` —
  the `true` is the §4.6 seam that enables bare-@ markdown imports. Without it, the bare `@apiBare.md` does NOT
  resolve → `injected===1` and `!hasBlock(API_BARE)` → MDV-2 fails (correctly — bareAt was off). MDV-1 OMITS it
  (the `#@` marker needs no bareAt).
- ❌ **Do NOT use the `DELIV-`/`REOPEN-`/`MD1`/`MD2`/`F1`/`T1.S1-`/`CRLF-E2E`/`EDG-` prefix** (collides with
  existing cases). Use `MDV-1`/`MDV-2`. `MDV` is distinct from `MD1`/`MD2` (which are §10 markdown EDGES).
- ❌ **Do NOT add new helpers** (a local `writeMdPair`/`assertVerbatim`/etc.). Reuse `hasBlock`/`FIX`/`runCase`/
  `assert`/`fsSync`/`TMPDIR`/`path` exactly as CRLF-E2E does. New exported helpers are a harness change outside
  this task's scope.
- ❌ **Do NOT edit `file-injector.ts`** (the verbatim engine is LANDED) **or `relative-imports.test.mjs`/
  `import-behavior.test.mjs`/`scripts/typecheck.mjs`/`buildFixtures`**. `git diff --stat` for all of those must
  be empty.
- ❌ **Do NOT trust architecture/stripping_logic_analysis.md's "stripping" wording.** It documents the PRE-plan-009
  behavior. Under verbatim, `injectMarkdown` emits content VERBATIM (no Step 3.5/4). Trust the LIVE file-injector.ts
  (L1095 `emitText(abs, content, state)`). If you assert the marker is STRIPPED, your case will FAIL — the contract
  is verbatim.
- ❌ **Do NOT re-assert pre-order block INDEX ordering** (the `findIndex` + `iNotes < iApi` dance Case 15 does).
  Case 15 owns that angle. For the verbatim-content contract, `blocks.length===2` + `hasBlock(target)` suffices —
  it proves both files are present without coupling to emission-order internals.

---

## Confidence Score: 9/10

A tightly-bounded test-addition task against LANDED, verbatim code (`injectMarkdown` Step 4 emits the verbatim
file-as-read content via `emitText(abs, content, state)`, file-injector.ts:1095 — import markers are detected
ONLY to resolve imports and NEVER stripped; `injectFiles` returns `text` verbatim, L1178/L1188; the `bareAt`
4th-param seam threads `state.bareAt` into `injectMarkdown`→`scanTokens`, L1115/L1164/L1096). Each of the 2
cases is grounded in the **live** verbatim contract (not the superseded stripping-logic wording), and the
keystone is the verbatim-vs-stripped ASSERTION PAIR (`hasBlock(marker)` + `!hasBlock(stripped)`) — the exact
pair that flips loudly if import-marker stripping is ever reintroduced (the pre-plan-009 behavior). The PRP
nails the non-obvious choices: **self-contained fixtures inside the test body** (the CRLF-E2E pattern, NOT
buildFixtures — to avoid coupling to the shared notes.md/notesBare.md/api.md that 6+ cases depend on), the
**full-sentence needle** (so a partial substring match is impossible), the **`bareAt` 4th param for MDV-2 only**
(the §4.6 markdown-only seam; MDV-1 omits it), and the **unique non-colliding fixture + case-ID names**
(mdVerbatim/apiVerbatim/mdBare/apiBare + MDV-/MDV-2, grep-verified absent). It is explicit and honest about the
**RED baseline** (148 passed, 6 failed — REOPEN-1..4 already raised 144→148; the 6 are P1.M2.T1's scope, NOT
mine) so the implementing agent does not mistake them for its own failures or try to "fix" them. It complements
(rather than duplicates) Case 15 (one-line marker assert on the shared fixture), Case 26 (bare-@ ON on the shared
fixture), CRLF-E2E (style sibling, different focus), and REOPEN-1..4 (verbatim PROMPT, not verbatim CONTENT).
The -1 reserves for the cross-suite RED baseline (the agent must read "150 passed, 6 failed" correctly and not
panic) and the small chance the agent forgets the `true` 4th param for MDV-2 (the PRP forbids it and explains
why — without it, bare-@ does not resolve and MDV-2 fails). The implementing agent adds a banner + 2 `runCase`
blocks (each writing its own fixtures) and runs one command.