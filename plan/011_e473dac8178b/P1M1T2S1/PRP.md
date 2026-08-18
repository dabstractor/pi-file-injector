---
name: "P1.M1.T2.S1 (plan/011) — LR-2: images/binaries claim the bare abs (no duplicate bytes)"
prd_ref: "Line-Range feature §3 'Claim by type (LR-2 — normative, fixes verified gap)' + §10 gap register (LR-2) + §12.26 ('images/binaries claim the bare abs — a range is meaningless identity for them and must not duplicate bytes')"
target_file: "./file-injector.ts"   # injectFile's 3 non-text branches (F5 L1247 / F3 L1255 / binary L1275) + file-injector.test.mjs (+LINE-9)
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + `node ./file-injector.test.mjs` 177 passed + `npm test` 4-file green)
depends_on: "P1.M1.T1.S3 (Implementing, PARALLEL — unify the emit quadruple inside emitText ONLY; T2.S1 edits injectFile's non-text branches — DISJOINT functions, no conflict). The range carriage (splitLineRange/claimKey/scanTokens startLine threading, LR-7) is LANDED and stable."
consumed_by: "P1.M2.T1.S1 (adds the formal LINE-9 gate alongside LINE-7/10 — T2.S1 ships the fix + a draft LINE-9; M2.T1.S1 formalizes/verifies); P1.M2.T2.S1 (README image/binary dedup wording)"
---

# PRP — P1.M1.T2.S1: LR-2 — images/binaries claim the bare abs (no duplicate bytes)

> **Scope flag:** Source fix in `injectFile`'s three NON-TEXT branches (F5 empty-image, F3 real-image, binary
> note) + the LINE-9 regression test (both token orders × both file kinds). The pre-read ranged claim at
> L1239-1240 stays untouched (recursion-readiness). Each branch gains a guard at its top: if the BARE abs is
> already claimed → back out the ranged key, emit nothing, return false; otherwise ADD the bare abs as the
> effective claim. Text/markdown claims are untouched (distinct ranges = distinct deliveries, LR-7).
> **emitText is NOT touched** (T1.S3, parallel, owns it — disjoint function).

---

## Goal

**Feature Goal:** Make images and binaries claim the **bare abs** at classification time (LR-2), so
`#@pic.png #@pic.png:3` attaches the image ONCE (not twice) and `#@data.bin #@data.bin:5` emits ONE binary note
(not two), in BOTH token orders. Identical bytes must never be delivered twice.

**Deliverable:** Modified `./file-injector.ts` — a guard inserted at the top of each of the three non-text
branches in `injectFile` (dedup check on bare abs → delete ranged key + return false; else add bare abs).
PLUS modified `./file-injector.test.mjs` — the `LINE-9` runCase (4 sub-asserts: image both orders, binary both
orders) using the existing `pic.png`/`data.bin` fixtures. JSDoc on injectFile's claim semantics (Mode A).

**Success Definition:**
1. `npm run typecheck` → 0 errors.
2. `node ./file-injector.test.mjs` → **177 passed** (176 baseline + LINE-9), 0 failed. Existing image/binary
   cases (3, 4, F3a/b, F5, F4 — all single-token) and LINE-1..8/12 stay green.
3. `npm test` → all 4 test files green (import-behavior / relative-imports / url-injection untouched).
4. Both orders dedup: `#@pic.png #@pic.png:3` AND `#@pic.png:3 #@pic.png` → exactly one `state.images` entry;
   binary twins → exactly one note block; `state.count` bumped once per actually-delivered file.
5. Text/markdown claim behavior UNCHANGED (LINE-6 two-ranges-two-blocks still green; markdown slice+whole
   coexist per LR-7).

## User Persona

**Target User:** A user who writes `#@pic.png` and `#@pic.png:3` in one prompt (or a doc that imports both
forms) and must not pay for — or see — the same image twice.

**Use Case:** `Describe #@pic.png and detail #@pic.png:3` → ONE image attached, one green `read pic.png` line;
the second token dedups to verbatim (the model already has the bytes).

**Pain Points Addressed:** The verified LR-2 gap — the ranged claim (`abs:3`) is added pre-read, before
classification, so the bare `abs` and `abs:3` never collide and the identical image/note is delivered twice.

## Why

- **Closes the verified LR-2 gap.** The spec's gap register (§10): "Image/binary claim the bare abs (no
  duplicate bytes) — **Gap**; verified: `#@pic.png #@pic.png:3` attaches the identical image twice." Identical
  bytes delivered twice is pure waste (image tokens are expensive — ~hundreds each) and a dishonest
  `injected: 2` count.
- **Claim-by-classification is the normative shape.** §3: "the dedup key is chosen by *classification*, not by
  the token. Images and binaries claim the bare `abs` — a range is not part of their identity... (Implementation
  shape: claim with the range key for recursion-readiness before read, then normalize/add the bare key once
  classified, backing out if the bare key collides.)" T2.S1 implements exactly that shape.
- **The pre-read ranged claim must stay.** The claim at L1239-1240 happens before `readFile` so a self-import /
  same-range recursion can't re-enter (recursion-readiness). Only the post-classification normalization is new.

## What

No user-visible change for single tokens (existing behavior). For duplicate image/binary tokens in one prompt
(either order, or across a markdown import chain): ONE delivery, the duplicate left verbatim,
`injected` counts only the delivery.

### Success Criteria

- [ ] Each of the three non-text branches (F5 L1247, F3 L1255, binary L1275) begins with the LR-2 guard:
      `if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }` then
      `state.injectedSet.add(abs);` before the branch's emit statements.
- [ ] The markdown branch (L1272) and text branch (L1282) are UNTOUCHED (ranged claims stay; LR-7).
- [ ] The pre-read ranged claim at L1239-1240 is UNTOUCHED.
- [ ] `catch` un-claim (L1287) still deletes `key` (the ranged key). Consider also deleting the bare abs there
      if the branch may have added it — see Known Gotchas (the simplest correct form: delete BOTH keys in catch;
      a failure means nothing was delivered, so no key should survive).
- [ ] LINE-9 passes: image both orders → `injected===1`, `images.length===1`; binary both orders →
      `injected===1`, exactly one note block.
- [ ] `npm run typecheck` 0 errors; `node ./file-injector.test.mjs` 177 passed; `npm test` 4-file green.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** The exact current
injectFile body (L1231-1290) is quoted in the Blueprint with the three branch insertion points; the claimKey
mechanics (L192-196), the dedup trace for BOTH token orders (including the processTokenStream L1213
stream-loop skip that catches the ranged-then-bare order before injectFile), the existing fixtures
(`pic.png`/PNG_BYTES L242/L221, `data.bin`/BIN L243/L365), the LINE test section placement (after LINE-8-MD
~L3090), the catch-block key-cleanup subtlety, and the T1.S3 disjoint-function boundary are all pinned.

### Documentation & References

```yaml
# MUST READ — the normative LR-2 contract + implementation shape
- file: PRD.md  (Line-Range feature §3 "Claim by type (LR-2)" + §10 gap register + §12.26)
  why: "§3: 'on classification image/binary, the effective claim is the bare abs; if that key is already
        claimed, the token is left verbatim (dedup) — never a duplicate attachment. (Implementation shape:
        claim with the range key for recursion-readiness before read, then normalize/add the bare key once
        classified, backing out if the bare key collides.)' §10: the verified gap. §8 edge row: '#@pic.png:3 /
        #@data.bin:5 (+ bare twin) → Range ignored; ONE image/note; bare-path claim (LR-2).'"
  critical: "'the ranged key may remain alongside harmlessly or be normalized/deleted — pick one and note it in
             the JSDoc' (§3 implementation shape). PICK: delete the ranged key on turn-away (a turned-away token
             leaves no key); keep both keys on the deliver path. Document this in the JSDoc."

# MUST READ — the verified seams (injectFile branch lines, claimKey, fixtures, LINE test section)
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "§injectFile table: claim at L1239-1240; F5 L1247-1253; F3 L1255-1271 ('LR-2: no bare-abs claim today');
        binary L1275-1281 ('LR-2: no bare-abs claim today'); markdown L1272-1274; text L1282; count++ L1284;
        catch un-claim L1287. claimKey L192-196. Fixtures: pic.png L242/data.bin L243, PIC L364/BIN L365.
        LINE-1..6 at L2969-3031 ('runCase pattern to extend')."
  critical: "Line numbers are at code_map's HEAD (ef57bd0); the file is now 1833 lines — PLACE BY THE QUOTED
             TEXT in the Blueprint, not raw lines."

# MUST READ — the parallel sibling's boundary (T1.S3 = emitText ONLY)
- file: plan/011_e473dac8178b/P1M1T1S3/PRP.md
  why: "T1.S3 (Implementing, parallel) unifies the emit quadruple INSIDE emitText + rewrites emitText's JSDoc.
        T2.S1 edits injectFile's three non-text branches — DISJOINT functions. Neither clobbers the other;
        both land against the same working tree (line numbers in injectFile may shift slightly if T1.S3's
        emitText refactor changes its length — place by text)."

# The file you edit (source — 3 branch guards + catch cleanup + JSDoc)
- file: file-injector.ts
  why: "injectFile L1231-1290. The guard goes as the FIRST statement of each non-text branch (all three branch
        conditions — mime && buf.length===0, mime && hasValidImageMagic, isBinary(buf) — have abs/key/mime/buf
        in scope at the branch head). The catch at the end deletes key; extend to delete the bare abs too
        (a failure after the guard added it would otherwise poison the bare key)."
  pattern: "Match the branch-comment style (§-cited inline comments). The guard is 2 statements (dedup check +
            bare add) — keep it tight."
  gotcha: "Do NOT touch the markdown branch (L1272) or text branch (L1282) — ranged claims are correct there
           (LR-7: distinct ranges are distinct deliveries). Do NOT touch the pre-read claim at L1239-1240."

# The file you edit (test — +LINE-9 after LINE-8-MD)
- file: file-injector.test.mjs
  why: "LINE section: LINE-1..6 at L2987-3058, LINE-8 L3060, LINE-8-MD L3082, LINE-12 L3091 (T1.S1/S2 landed
        those). Insert LINE-9 after the LINE-8-MD block (~L3090, before LINE-12) or after LINE-12 — anywhere in
        the LINE block. Fixtures: PNG_BYTES L221, pic.png written L242, PIC L364; data.bin L243, BIN L365.
        hasBlock helper used at L470 (boolean). FIX = {cwd: TMPDIR} L363 (no budget → inline). runCase/assert
        throughout. Current count: 176 runCases."
  pattern: "Mirror LINE-6's structure (injectFiles + injected/blocks asserts). Use the filter-count inline for
            the binary-note count (hasBlock is boolean-only): r.blocks.filter(b => b.includes('<file name=\"'+BIN+'\">')).length."
  gotcha: "Each injectFiles call builds a FRESH state (dedup is per-call via state.injectedSet) — the 4
           sub-cases (2 orders × 2 kinds) don't interfere. Reuse pic.png/data.bin — NO new fixtures, no mocking."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectFile: +LR-2 guard at 3 branch heads; catch deletes both keys; JSDoc)
├── file-injector.test.mjs    # ← EDITED (+LINE-9 after the LINE-8-MD block; reuses pic.png/data.bin)
├── import-behavior.test.mjs  # run via npm test (NOT edited)
├── relative-imports.test.mjs # run via npm test (NOT edited)
├── url-injection.test.mjs    # run via npm test (NOT edited)
├── scripts/typecheck.mjs     # untouched (typecheck gate)
└── plan/011_e473dac8178b/
    ├── architecture/{code_map.md, system_context.md, external_deps.md}
    ├── P1M1T1S3/{PRP.md}   # ← T1.S3 (parallel): emitText quadruple — DISJOINT
    └── P1M1T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectFile: LR-2 guard (check bare abs → delete ranged key + return false;
                          #                  else add bare abs) at the head of F5/F3/binary branches; catch deletes
                          #                  both key and bare abs; claim-semantics JSDoc (Mode A).
file-injector.test.mjs    # MODIFIED — +LINE-9 runCase (image both orders + binary both orders; reuses fixtures).
# No other files. emitText UNTOUCHED (T1.S3). No new exports/imports/helpers/fixtures.
```

### Known Gotchas of our Codebase & Library Quirks

```ts
// CRITICAL — the ranged-then-bare order is caught TWICE (verify both paths stay intact):
//   '#@pic.png:3' first: injectFile claims abs:3 → guard finds bare abs ABSENT → ADDS bare abs → delivers.
//   '#@pic.png' second: processTokenStream L1213 checks has(claimKey(abs)) — the bare abs IS in injectedSet
//   (added by the first branch) → the record is SKIPPED in the stream loop (never reaches injectFile) →
//   verbatim. Even if it reached injectFile, the branch guard would catch it. Do not "simplify" L1213 away.

// CRITICAL — the catch block must clean up BOTH keys. After the guard adds the bare abs, a later failure in
//   the branch (resizeImage throw, etc.) hits `catch { state.injectedSet.delete(key); return false; }` — the
//   RANGED key is deleted but the BARE abs survives → poisoned (a retry of the bare token would be wrongly
//   deduped). FIX: in catch, also `state.injectedSet.delete(abs);` (delete-key + delete-abs is safe even if
//   the guard never ran — deleting an absent Set key is a no-op). Claim ⟺ delivered: a failed delivery must
//   leave NO key.

// CRITICAL — the ranged key on the DELIVER path stays alongside the bare abs (harmless). A later ranged form
//   of the SAME image ('#@pic.png:5' after '#@pic.png:3' delivered) → its injectFile run claims abs:5 → the
//   branch guard sees bare abs PRESENT → deletes abs:5 → turned away. Correct: one image, one delivery. (The
//   alternative — normalizing away the ranged key at delivery — also works but changes more state; the picked
//   shape is minimal. NOTE the choice in the JSDoc per spec §3.)

// CRITICAL — text/markdown branches are UNTOUCHED. '#@a.ts:2 #@a.ts:3' must still deliver TWO blocks (LINE-6)
//   and '#@notes.md:2 #@notes.md' must still deliver slice + whole (LR-7). The LR-2 guard exists ONLY in the
//   three non-text branches. If LINE-6 flips, the guard leaked into the text path.

// GOTCHA — place the guard INSIDE the branch (after the branch condition), not before the if/else chain: the
//   markdown/text branches must not see it. All three non-text branch heads have abs/key/mime/buf in scope.

// GOTCHA — the guard returns false WITHOUT bumping state.count (claim ⟺ delivered; nothing was emitted). The
//   existing `state.count++` at L1284 runs only on the deliver path. Do not add a count++ to the guard path.

// GOTCHA — the F5 (0-byte image) branch also needs the guard: '#@empty.png #@empty.png:3' would otherwise emit
//   TWO empty-image notes. The F5 guard uses the same bare-abs shape (buf.length===0 doesn't change identity).

// LIBRARY — Set<string>.has/add/delete; no type changes. typecheck --strict unaffected. The fixtures
//   (PNG_BYTES/pic.png/data.bin) are real files in TMPDIR written by buildFixtures — no mocking (item §3:
//   'Mock nothing (real fixture images already exist in the test suite)').
```

## Implementation Blueprint

### The exact current injectFile body (L1231-1290, verified) and the 3 insertions

```ts
export async function injectFile(abs: string, state: State, ctx: Ctx, startLine?: number, endLine?: number): Promise<boolean> {
  let st;
  try { st = await fs.stat(abs); } catch { return false; }
  if (!st.isFile()) return false;
  const key = claimKey(abs, startLine, endLine);
  state.injectedSet.add(key); // ← PRE-READ RANGED CLAIM — UNTOUCHED (recursion-readiness)

  const ext = extOf(abs);
  const mime = MIME_BY_EXT[ext];
  try {
    const buf = await fs.readFile(abs);
    if (mime && buf.length === 0) {
      // ═══ INSERT LR-2 GUARD HERE (F5) ═══
      if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }
      state.injectedSet.add(abs);
      // ── existing F5 body (note + detail + subtract) UNCHANGED ──
    } else if (mime && hasValidImageMagic(buf, mime)) {
      // ═══ INSERT LR-2 GUARD HERE (F3) — same 2 statements ═══
      if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }
      state.injectedSet.add(abs);
      // ── existing F3 body (resize + images.push + block + detail + subtract) UNCHANGED ──
    } else if (MD_EXTS.has(ext)) {
      // ── markdown branch UNTOUCHED (LR-7 ranged claims) ──
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx, startLine, endLine);
    } else if (isBinary(buf)) {
      // ═══ INSERT LR-2 GUARD HERE (binary) — same 2 statements ═══
      if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }
      state.injectedSet.add(abs);
      // ── existing binary body (note + detail + subtract) UNCHANGED ──
    } else {
      emitText(abs, buf.toString("utf8"), state, startLine, endLine); // ── text UNTOUCHED ──
    }
    state.count++;
    return true;
  } catch {
    state.injectedSet.delete(key);       // ── existing ranged un-claim
    state.injectedSet.delete(abs);       // ═══ ADD: bare-abs un-claim (guard may have added it; no-op if absent) ═══
    return false;
  }
}
```

With comments (write them into the source — one shared comment per branch is fine; cite LR-2):
```ts
// LR-2 (§3 claim-by-type) — images/binaries have no line semantics: a range is meaningless identity for
// them, so the EFFECTIVE claim is the bare abs. If it is already claimed (an earlier bare OR ranged
// delivery of the same image/binary), back out the ranged pre-claim and turn this token away (verbatim,
// no count++ — claim ⟺ delivered; identical bytes are never delivered twice). On the deliver path the
// ranged pre-claim stays alongside harmlessly (a later ranged form hits this same bare-abs check).
if (state.injectedSet.has(abs)) { state.injectedSet.delete(key); return false; }
state.injectedSet.add(abs);
```

### The dedup trace (why both orders work — verify against this)

| Prompt | injectFile #1 | injectFile #2 / stream skip | Result |
|---|---|---|---|
| `#@pic.png #@pic.png:3` | claims `abs`; guard: bare absent → add `abs`; deliver | claims `abs:3`; guard: bare PRESENT → delete `abs:3`, return false | 1 image ✓ |
| `#@pic.png:3 #@pic.png` | claims `abs:3`; guard: bare absent → add `abs`; deliver | stream L1213: `has(abs)` TRUE → skipped (never reaches injectFile) | 1 image ✓ |
| `#@data.bin #@data.bin:5` (and reverse) | same shape, binary branch | same shape | 1 note ✓ |
| `#@a.ts:2 #@a.ts:3` | text — NO guard | text — distinct keys deliver | 2 blocks (LINE-6) ✓ |
| `#@notes.md:2 #@notes.md` | markdown — NO guard | markdown — `abs:2` vs `abs` distinct | slice + whole (LR-7) ✓ |
| `#@pic.png:3 #@pic.png:5` | claims `abs:3`, adds `abs`, delivers | claims `abs:5`; guard: bare PRESENT → delete, away | 1 image ✓ |

### The LINE-9 test (insert after the LINE-8-MD block, ~L3090)

```js
// LINE-9 — LR-2 (§3 claim-by-type): images/binaries claim the BARE abs — a range is meaningless identity for
// them, so a bare+ranged pair (EITHER order) delivers exactly ONE image / ONE note (identical bytes never
// delivered twice). Reuses the existing pic.png (PNG_BYTES) + data.bin fixtures — no new fixtures, no mocks.
await runCase("LINE-9", "LR-2: #@pic.png #@pic.png:3 → ONE image (both orders); #@data.bin #@data.bin:5 → ONE note", async () => {
  // image — bare then ranged
  const r1 = await mod.injectFiles("Describe #@pic.png and #@pic.png:3", [], FIX);
  assert(r1.injected === 1, `bare+ranged image pair: exactly ONE delivery, got injected=${r1.injected}`);
  assert(r1.images.length === 1, `exactly ONE images entry (no duplicate bytes), got ${r1.images.length}`);
  assert(r1.images[0].data === PNG_BYTES.toString("base64"), "the one image is the real PNG base64");
  // image — ranged then bare
  const r1b = await mod.injectFiles("Describe #@pic.png:3 and #@pic.png", [], FIX);
  assert(r1b.injected === 1 && r1b.images.length === 1, `reverse order also ONE image, got injected=${r1b.injected} images=${r1b.images.length}`);
  // binary — bare then ranged
  const r2 = await mod.injectFiles("Inspect #@data.bin and #@data.bin:5", [], FIX);
  assert(r2.injected === 1, `binary twin: one delivery, got injected=${r2.injected}`);
  assert(r2.blocks.filter((b) => b.includes('<file name="' + BIN + '">')).length === 1,
    `exactly ONE binary note block, got ${r2.blocks.filter((b) => b.includes('<file name="' + BIN + '">')).length}`);
  // binary — ranged then bare
  const r2b = await mod.injectFiles("Inspect #@data.bin:5 and #@data.bin", [], FIX);
  assert(r2b.injected === 1 && r2b.blocks.filter((b) => b.includes('<file name="' + BIN + '">')).length === 1,
    `reverse binary order also ONE note`);
});
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — injectFile only):
  - F5 branch head (L~1247): + LR-2 guard (2 statements + comment).
  - F3 branch head (L~1255): + the same guard.
  - binary branch head (L~1275): + the same guard.
  - catch block (L~1287): + `state.injectedSet.delete(abs);` after the existing delete(key).
  - injectFile JSDoc: claim-semantics note (Mode A — item §5): "claim ⟺ delivered; images/binaries claim the
    bare abs — a range is meaningless identity for them; on dedup the ranged pre-claim is backed out and the
    token left verbatim; on the deliver path the ranged key stays alongside harmlessly."
  - UNCHANGED: the pre-read ranged claim (L1239-1240); the markdown branch; the text branch / emitText call;
    state.count++ placement; scanTokens/processTokenStream (the L1213 stream skip is load-bearing — leave it).

FILE_EDITS (file-injector.test.mjs):
  - + LINE-9 runCase after the LINE-8-MD block (~L3090). Reuses PNG_BYTES/PIC/BIN/FIX/mod/injectFiles/assert.

NO_CHANGES: emitText (T1.S3, parallel); the other three test files; package.json; scripts/typecheck.mjs;
            PRD.md; README.md (P1.M2.T2.S1 owns it); all plan/ files. No new exports/imports/helpers/fixtures.
```

### Implementation Tasks (ordered)

```yaml
Task 1: ADD the LR-2 guard to the F5 branch (2 statements + the LR-2 comment).
Task 2: ADD the same guard to the F3 branch.
Task 3: ADD the same guard to the binary branch.
Task 4: EXTEND the catch to delete the bare abs too (one line after delete(key)).
Task 5: UPDATE the injectFile JSDoc (claim semantics, Mode A — the picked ranged-key policy).
Task 6: ADD the LINE-9 runCase (after LINE-8-MD; reuses pic.png/data.bin; 4 sub-assert groups).
Task 7: VERIFY gates:
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 177 passed (176 + LINE-9), 0 failed. Spot-check: cases 3/4 (single image/
    binary), F3a/b, F5, F4, LINE-1..8/12, LINE-6 (text ranges) all green.
  - npm test → all 4 files green.
  - git diff --stat → file-injector.ts + file-injector.test.mjs only (emitText untouched).
```

## Validation Loop

### Level 1: Typecheck

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: 0 errors (Set<string> ops; no type changes).
```

### Level 2: The main suite (+LINE-9; existing image/binary/range cases green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 177 passed, 0 failed." — LINE-9 ✓; LINE-1..8/12 ✓; cases 3/4, F3a/b, F5, F4 ✓; LINE-6 ✓.
# If LINE-6 (two text ranges → two blocks) FAILS: the guard leaked into the text path — re-check placement.
# If a single-token image/binary case FAILS: the guard fired spuriously (check it is inside the non-text
#   branches and only turns away when the bare abs is ALREADY claimed).
```

### Level 3: The full 4-file gate

```bash
cd /home/dustin/projects/pi-file-injector
npm test   # file-injector && import-behavior && relative-imports && url-injection — all green
```

### Level 4: Scope verification (emitText untouched; no other file)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat   # expect: file-injector.ts, file-injector.test.mjs ONLY
# emitText's internals are T1.S3's (parallel) — confirm your diff's file-injector.ts hunks are all inside
# injectFile (the three branch heads + the catch + the JSDoc).
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` → 0 errors.
- [ ] `node ./file-injector.test.mjs` → 177 passed, 0 failed.
- [ ] `npm test` → 4 files green.
- [ ] `git diff --stat` → exactly file-injector.ts + file-injector.test.mjs.

### Feature Validation (LR-2)
- [ ] `#@pic.png #@pic.png:3` → 1 delivery, 1 images entry (and reverse order too).
- [ ] `#@data.bin #@data.bin:5` → 1 delivery, 1 note block (and reverse order too).
- [ ] Ranged-then-ranged image pair (`:3` then `:5`) → 1 image.
- [ ] Text ranges still deliver distinctly (LINE-6); markdown slice+whole coexist (LR-7).
- [ ] A failed image read (catch) leaves NO key (ranged and bare both deleted).

### Scope Discipline
- [ ] Pre-read ranged claim L1239-1240 UNTOUCHED; markdown/text branches UNTOUCHED; emitText UNTOUCHED (T1.S3).
- [ ] processTokenStream L1213 stream skip UNTOUCHED (it catches the ranged-then-bare order).
- [ ] No new exports/imports/helpers/fixtures; LINE-9 reuses PNG_BYTES/PIC/BIN/FIX.

### Documentation
- [ ] injectFile JSDoc documents claim semantics incl. the picked ranged-key policy (delete on turn-away; keep
      alongside on deliver) — Mode A, rides with the work (item §5).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch the markdown or text branches.** Their ranged claims are correct (LR-7). The guard exists
  only in F5/F3/binary. If LINE-6 flips, the guard leaked.
- ❌ **Do NOT move or remove the pre-read ranged claim (L1239-1240).** It is recursion-readiness (self-import /
  same-range re-entry). LR-2 ADDS the bare-abs claim post-classification; it does not replace the ranged one.
- ❌ **Do NOT bump state.count on the turn-away path.** Claim ⟺ delivered: nothing was emitted, so injected
  must not count it. Return false, no count++.
- ❌ **Do NOT leave the bare abs poisoned after a branch failure.** The catch must delete BOTH keys (the ranged
  `key` AND the bare `abs`). Deleting an absent key is a no-op — safe in every path.
- ❌ **Do NOT touch processTokenStream's L1213 skip.** It is the first catch for the ranged-then-bare order
  (the bare key added by the earlier branch makes the stream skip the later bare record). The branch guard is
  the second catch. Both stay.
- ❌ **Do NOT add new fixtures or mocks.** pic.png (PNG_BYTES) and data.bin already exist in buildFixtures
  (L242-243; PIC L364, BIN L365). Reuse them (item §3: "Mock nothing").
- ❌ **Do NOT edit emitText or its JSDoc.** T1.S3 (parallel) owns emitText. Your diff's file-injector.ts hunks
  must all be inside injectFile.
- ❌ **Do NOT normalize away the ranged key on the deliver path.** The picked policy (spec §3 allows either):
  ranged key stays alongside, harmlessly; it is deleted only on turn-away. Note the choice in the JSDoc.

---

## Confidence Score: 9/10

A tightly-scoped fix: one 2-statement guard replicated at three verified branch heads + one catch-cleanup line
+ JSDoc + one test reusing existing fixtures. The dedup trace covers both token orders (including the
processTokenStream stream-skip path), the ranged-then-ranged pair, and the text/markdown non-interference
(LINE-6/LR-7 stay green). The T1.S3 boundary is disjoint (emitText vs injectFile branches). The -1 reserves
for: (a) the catch-block bare-abs cleanup being easy to miss (a poisoned bare key after a resize failure would
wrongly dedup a retry — the PRP flags it CRITICAL), and (b) line-number drift from the parallel T1.S3 emitText
refactor (place by the quoted text, not raw lines). Gates: typecheck 0 errors, main suite 177 passed, npm test
4-file green.