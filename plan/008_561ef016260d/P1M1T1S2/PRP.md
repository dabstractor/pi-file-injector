---
name: "P1.M1.T1.S2 (plan/008) — image/binary detail pushes + change injectFiles return shape (strip the --- concat)"
prd_ref: "PRD §6.2 (FileDetail interface + custom-message delivery), §6.4 (Assembly: details parallel to blocks; user message is stripped prompt ONLY — no appended blocks), §9 Algorithm (injectFile image/binary detail pushes; injectFiles returns blocks+details, no --- concat)"
target_file: "./file-injector.ts"   # SOURCE-ONLY — no test files (migration is P1.M2.T1)
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + structural grep; the test suite is INTENTIONALLY red after S2 — migration is M2.T1)
depends_on: "P1.M1.T1.S1 (FULLY LANDED: FileDetail interface L335, State.details L347, emitText text/paged detail pushes L771, constructor details:[] ~L951). S2 completes the per-file metadata (image/binary/empty-image) S1 deferred + surfaces blocks/details in the return + strips the \\n\\n---\\n\\n concat."
consumed_by: "P1.M1.T2.S1 (the input handler stashes {blocks, details} → before_agent_start custom message); P1.M2.T1.S1 (migrates the ~230 test assertions from r.text to r.blocks/r.details)"
---

# PRP — P1.M1.T1.S2: image/binary detail pushes + change injectFiles return shape (strip the `---` concat)

> ⚠️ **SCOPE & GATE — READ FIRST.** This is a **SOURCE-ONLY** change to `file-injector.ts` (6 edits). It is **NOT
> additive** — it changes `injectFiles`' return shape and STRIPS the `\n\n---\n\n` concatenation from the output
> text. **This INTENTIONALLY breaks the existing test suite** (~230 assertions across all three .mjs files read
> the OLD `r.text` shape with appended blocks; they now fail). **The deterministic gate is `npm run typecheck`
> → 0 errors + a structural grep confirming the edits.** The red suite is the EXPECTED intermediate state of the
> sequenced migration (S1 → S2 → T2 → M2); re-greening is **P1.M2.T1** (a separate subtask). **DO NOT edit test
> files, revert source, or weaken the change to make the suite green** — that defeats the migration.

---

## Goal

**Feature Goal:** (1) Complete per-file `FileDetail` metadata collection by adding image / empty-image / binary
detail pushes in `injectFile` (S1 deferred these; it only did text/paged in `emitText`). (2) Surface the built
`blocks` + `details` in the `injectFiles` return, and STRIP the `\n\n---\n\n` concatenation so the user message
is the stripped prompt ONLY — the seam consumed by P1.M1.T2.S1 (stash → `before_agent_start` custom message).

**Deliverable:** Modified `file-injector.ts` (6 edits: 3 detail pushes in `injectFile`; the `injectFiles` return
type gains `blocks`/`details`; the early return adds `blocks: [], details: []`; the final return drops the
`finalText` concat and returns `strippedText` + `blocks` + `details`). **No test changes.** No new files.

**Success Definition:**
1. `npm run typecheck` → 0 errors under `--strict` (the return-type change compiles; the factory destructure
   at L1062 ignores the new fields, so it still compiles).
2. Structural grep confirms: the `\n\n---\n\n` concat line is DELETED; the final return has
   `blocks: state.blocks, details: state.details`; the early return has `blocks: [], details: []`; the 3 detail
   pushes (image/empty-image/binary) are present in `injectFile`.
3. The test suite is RED in the EXPECTED way (~230 `r.text`-shape failures: blocks/`---` no longer in `r.text`).
   This is NOT a regression — it is the intended intermediate state; M2.T1 migrates the assertions to `r.blocks`/`r.details`.
4. `file-injector.ts` is the ONLY changed file.

## Why

- **Completes the metadata collection the renderer needs.** PRD §6.2/§6.3 deliver files as a custom message
  whose `details.files` array drives a green, collapsible `read <path>` renderer. S1 collected text/paged
  details in `emitText`; image/binary/empty-image flow through separate `injectFile` branches, so their details
  MUST be pushed there. Without S2, image/binary files would have a `<file>` block but NO `FileDetail` → the
  renderer (T2.S2) couldn't draw their `read <path>` lines.
- **Surfaces blocks+details and strips the append.** PRD §6.4: the user message is "JUST the stripped prompt"
  (no appended bytes — they now live in the custom message, §6.2). S2 removes the `\n\n---\n\n` concat and
  returns `blocks`/`details` so P1.M1.T2.S1 can stash them for the `before_agent_start` custom message. This is
  the structural seam between "collect files" (M1.T1) and "deliver as a custom message" (M1.T2).
- **Keeps the migration sequenced and reviewable.** Doing the return-shape change as its own source-only
  subtask (S2) — separate from the test migration (M2.T1) and the delivery wiring (T2.S1) — makes each step
  small and auditable. The intermediate red suite is the explicit handoff signal to M2.T1.

## What

### User-visible behavior (intermediate state — expected)

After S2 (and before T2.S1 lands): `injectFiles` returns the new 6-field shape, but the factory `input` handler
(L1062) still destructures only `{ text, images, injected, paged }` and returns `{ action: "transform", text,
images }`. So the user message becomes the **stripped prompt only** (blocks are collected into the return but
not yet delivered to the model — there's no `before_agent_start` stash yet). Files reach the model again once
T2.S1 wires the stash + custom message. **S2's gate is source correctness + typecheck, NOT end-to-end delivery.**

### Technical behavior (the contract)

- `injectFile` pushes a `FileDetail` in the image, empty-image, and binary branches (parallel to each block push).
- `injectFiles` returns `{ text, images, injected, paged, blocks, details }` where `text` is the stripped prompt
  (NO `\n\n---\n\n`, NO `<file>` blocks). `blocks: state.blocks`; `details: state.details`.
- The early return (`count===0`) returns `{ text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }`.

### Success Criteria

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `injectFile` image branch pushes `{ path: abs, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined }`.
- [ ] `injectFile` empty-image branch pushes `{ path: abs, kind: "image", dimensionHint: undefined }`.
- [ ] `injectFile` binary branch pushes `{ path: abs, kind: "binary" }`.
- [ ] `injectFiles` return type is `Promise<{ text; images; injected; paged; blocks: string[]; details: FileDetail[] }>`.
- [ ] The early return (`count===0`) includes `blocks: [], details: []` (and keeps `images: imagesIn`).
- [ ] The `\n\n---\n\n` concat line is DELETED; the final return is `{ text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details }`.
- [ ] The string `\n\n---\n\n` no longer appears in any output path (only in comments L315/L955, which are fine).
- [ ] `file-injector.ts` is the ONLY changed file; no test file touched.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
6 exact oldText→newText edits (verified against the POST-S1 working tree), the loud expected-red-suite framing,
the intermediate-state explanation (factory ignores new fields until T2.S1), the `formatDimensionNote`-imported
fact, and the deterministic gate (typecheck + structural grep). The implementer edits one file, runs typecheck,
confirms the structure, and STOPS (the red suite is expected; M2.T1 owns re-greening).

### Documentation & References

```yaml
# MUST READ — the migration strategy + the expected breakage (why the red suite is OK)
- file: plan/008_561ef016260d/architecture/test_migration.md
  why: "Documents the OLD return (`r.text` = stripped prompt + `\\n\\n---\\n\\n` + blocks) vs the NEW return
        (6-field object; `r.text` = stripped prompt only). Lists the ~170 + helper assertions that break and
        the M2.T1 migration patterns (r.text → r.blocks/r.details). Confirms S2 is source-only."
  critical: "S2 INTENTIONALLY breaks the suite. The migration is M2.T1. Do NOT edit tests in S2."

# MUST READ — the contract: S1 is landed; S2 completes image/binary details + the return-shape change
- file: plan/008_561ef016260d/P1M1T1S1/PRP.md
  why: "S1 (LANDED) added FileDetail + State.details + emitText text/paged details — ADDITIVE, 188 green. S1
        explicitly DEFERRED image/binary details (S2), the return-shape change (S2), the --- concat removal
        (S2), and the renderer/two-hook split (T2). S2 is the deferred source work."
  critical: "S2 consumes S1's FileDetail + State.details. The detail pushes use the FileDetail.kind union
             ('image'/'binary') S1 declared forward-looking. emitText is UNCHANGED by S2 (S1 owns text/paged)."

# MUST READ — the spec: details parallel to blocks; user message is stripped prompt only
- file: PRD.md
  why: "§6.2 (FileDetail interface + the custom message's content=blocks.join, details.files); §6.4 (Assembly:
        details parallel to blocks; the user message is 'JUST the stripped prompt' — no appended bytes); §9
        Algorithm (injectFile image/binary detail pushes verbatim; injectFiles returns blocks+details, no concat)."
  section: "### 6.2 + ### 6.4 + ## 9 Algorithm (injectFile/injectFiles tail)"
  critical: "§9 injectFile is the authoritative target for the image detail push: `state.details.push({ path:
             abs, kind: 'image', dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined })`."

# The file you edit (the ONLY change — 6 source edits)
- file: file-injector.ts
  why: "POST-S1 (1114 lines). injectFile L698-760 (image branch ~L716-724, empty-image ~L705-710, binary ~L748-752);
        injectFiles signature L930-935; early return L1000; final concat+return L1012-1013. formatDimensionNote
        imported L3. FileDetail L335. State.details L347. Factory destructure L1062 (NOT edited)."
  pattern: "Each detail push goes IMMEDIATELY after the matching `state.blocks.push(...)` in injectFile (one
            detail per block emission → details stays index-parallel to blocks, §6.4)."
  gotcha: "The string `\\n\\n---\\n\\n` appears at L1012 (the concat — DELETE), L315 (a comment — leave), L955
           (a comment — leave). Only the L1012 OUTPUT-PATH occurrence is removed."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict on file-injector.ts. The return-type change + the factory's
        destructure (which ignores the new fields) both compile clean. This is S2's deterministic gate."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE ONLY FILE EDITED (6 source edits: 3 detail pushes + return-type + early-return + final-return)
├── file-injector.test.mjs    # NOT edited (RED after S2 — migration is M2.T1)
├── relative-imports.test.mjs # NOT edited (RED after S2 — migration is M2.T1)
├── import-behavior.test.mjs  # NOT edited (RED after S2 — migration is M2.T1)
├── scripts/typecheck.mjs     # untouched (the typecheck gate — S2's deterministic check)
└── plan/008_561ef016260d/
    ├── architecture/{system_context.md, external_deps.md, test_migration.md}
    ├── P1M1T1.S1/{research/research_notes.md, PRP.md}   # ← S1 (LANDED): FileDetail + State.details + emitText details
    └── P1M1T1.S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — 6 edits: +image/empty-image/binary detail pushes in injectFile;
                          #                  injectFiles return type +blocks/+details; early return +blocks:[],+details:[];
                          #                  DELETE the finalText concat → return strippedText + blocks + details.
# NO other files. NO test edits. NO new files. NO new exports (FileDetail already exported by S1). NO new imports.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — S2 INTENTIONALLY BREAKS THE TEST SUITE. ~230 assertions read the OLD `r.text` (stripped prompt +
//   "\n\n---\n\n" + blocks). After S2, r.text is the stripped prompt ONLY; blocks move to r.blocks. The suite
//   goes RED. This is EXPECTED (the sequenced migration's intermediate state). The deterministic gate is
//   typecheck + structural grep. DO NOT edit tests (M2.T1) or revert source to force green.

// CRITICAL — the gate is `npm run typecheck` (0 errors), NOT the test suite. The return-type change must
//   compile; the factory's destructure (L1062 `const { text, images, injected, paged } = ...`) ignores the new
//   fields → still compiles. If typecheck fails, the return-type annotation or a detail push is malformed.

// CRITICAL — the detail push goes IMMEDIATELY AFTER the matching `state.blocks.push(...)` in each injectFile
//   branch, so state.details stays index-parallel to state.blocks (the renderer pairs them by index, §6.4).
//   Do NOT push details before the block push, or in a different order.

// CRITICAL — keep the early return's `images: imagesIn` (the ORIGINAL ref). Only ADD `blocks: [], details: []`.
//   Swapping imagesIn → state.images there would break the count===0 identity contract (even post-migration).

// GOTCHA — formatDimensionNote is ALREADY imported (L3). The image detail's `resized ? formatDimensionNote(resized)
//   ?? undefined : undefined` matches PRD §9 verbatim: resized null → undefined; resized non-null → the note
//   (string|undefined), with `?? undefined` normalizing any null. Do NOT re-import it.

// GOTCHA — `kind: "image"` / `kind: "binary"` in the pushed object literals are contextually typed by
//   `state.details: FileDetail[]` (no `as const` needed) — matches S1's emitText text/paged pushes.

// GOTCHA — the intermediate non-delivery state: after S2, the factory handler (L1062) ignores blocks/details,
//   so files are collected but NOT delivered to the model until T2.S1 wires the stash + before_agent_start.
//   This is the expected seam, NOT a bug. S2's gate is source correctness, not end-to-end delivery.

// LIBRARY — TypeScript via jiti (no build step). typecheck uses tsc --strict via scripts/typecheck.mjs (resolves
//   the global pi .d.ts). FileDetail is a type-only export (S1) → `details: FileDetail[]` in the return type
//   resolves. No runtime/ guard impact (interfaces are erased).
```

## Implementation Blueprint

### The 6 edits (exact oldText → newText)

**Edit 1 — EMPTY-IMAGE detail push** (injectFile, after the F5 block push):
```ts
// oldText:
      const f5Block = formatEmptyImageBlock(abs);
      state.blocks.push(f5Block);
      subtract(state, Math.ceil(f5Block.length / 4)); // §5.6.2 — note consumes budget
// newText:
      const f5Block = formatEmptyImageBlock(abs);
      state.blocks.push(f5Block);
      state.details.push({ path: abs, kind: "image", dimensionHint: undefined }); // §6.4 — empty-image detail (parallel to the block push)
      subtract(state, Math.ceil(f5Block.length / 4)); // §5.6.2 — note consumes budget
```

**Edit 2 — IMAGE detail push** (injectFile, after the image block push):
```ts
// oldText:
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
// newText:
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      state.details.push({ path: abs, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined }); // §6.4 — image detail (dimensionHint from resize)
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
```

**Edit 3 — BINARY detail push** (injectFile, after the binary block push):
```ts
// oldText:
      const binBlock = formatBinaryBlock(abs);
      state.blocks.push(binBlock);
      subtract(state, Math.ceil(binBlock.length / 4)); // §5.6.2 — note consumes budget
// newText:
      const binBlock = formatBinaryBlock(abs);
      state.blocks.push(binBlock);
      state.details.push({ path: abs, kind: "binary" }); // §6.4 — binary detail
      subtract(state, Math.ceil(binBlock.length / 4)); // §5.6.2 — note consumes budget
```

**Edit 4 — injectFiles return type** (L935):
```ts
// oldText: ): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }> {
// newText: ): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }> {
```

**Edit 5 — early return** (L1000, count===0):
```ts
// oldText: if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
// newText: if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
```

**Edit 6 — final concat + return** (L1012-1013, DELETE the concat):
```ts
// oldText:
  const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`; // append below the stripped prompt (PRD §6.2)
  return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
// newText:
  // §6.4 — the user message is JUST the stripped prompt (no appended blocks, no `\n\n---\n\n`). The blocks +
  // details are returned for the caller (P1.M1.T2.S1 stashes them for the before_agent_start custom message).
  return { text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 6 edits, ONE file):
  - injectFile: +3 detail pushes (empty-image L~711, image L~723, binary L~750), each immediately after its
    matching state.blocks.push(...). NOTHING else in injectFile changes (claim, stat, classify order, count++,
    catch un-claim all UNCHANGED).
  - injectFiles: return-type annotation L935 (+blocks/+details); early return L1000 (+blocks:[],+details:[]);
    final return L1012-1013 (DELETE the finalText concat → return strippedText + blocks + details).
  - UNCHANGED: emitText (S1 owns text/paged details); scanTokens; injectMarkdown; processTokenStream; the
    strip loop; subtract math; state.paged++; the factory input handler (L1062 destructure — T2.S1 rewires it);
    every helper; every format* function.

NO_CHANGES: the three .mjs test files (RED after S2 — M2.T1 migrates), package.json, scripts/typecheck.mjs,
            PRD.md, README.md, all plan/ files. NO new exports. NO new imports.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the 3 detail pushes in injectFile (Edits 1-3)
  - EMPTY-IMAGE branch: after `state.blocks.push(f5Block);` add the image/undefined detail push.
  - IMAGE branch: after `state.blocks.push(formatImageBlock(abs, resized));` add the image/dimensionHint detail push.
  - BINARY branch: after `state.blocks.push(binBlock);` add the binary detail push.
  - EACH push goes IMMEDIATELY after its block push (index-parallel to blocks, §6.4).
  - DO NOT touch the claim, stat, classify order, subtract, count++, or catch.

Task 2: CHANGE the injectFiles return shape (Edits 4-6)
  - Edit 4 (L935): add `blocks: string[]; details: FileDetail[]` to the return type annotation.
  - Edit 5 (L1000): add `blocks: [], details: []` to the early return (keep `images: imagesIn`).
  - Edit 6 (L1012-1013): DELETE the `const finalText = ...` line; change the return to
    `{ text: strippedText, ..., blocks: state.blocks, details: state.details }`.
  - DO NOT touch the strip loop, subtract, state.paged, or the budget computation.

Task 3: VERIFY the deterministic gate
  - npm run typecheck → 0 errors (the return-type change compiles; the factory destructure ignores new fields).
  - Structural grep (Level 2 below): confirm the 6 edits landed + the `\n\n---\n\n` concat is gone from the output path.

Task 4: ACKNOWLEDGE the expected red suite (do NOT "fix" it)
  - Run `node ./file-injector.test.mjs` → EXPECT many FAILs (all "r.text no longer contains `<file>`/`---`").
    This is the intended intermediate state. M2.T1 migrates the assertions. DO NOT edit tests or revert source.
```

## Validation Loop

### Level 1: Typecheck (THE deterministic gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails: the return-type annotation is malformed, OR a detail push has a wrong shape (re-check Edits 1-6).
# The factory destructure (L1062) ignores the new fields → it compiles. This is the gate that MATTERS for S2.
```

### Level 2: Structural grep (confirm the 6 edits landed)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] image detail push:";       grep -c 'kind: "image", dimensionHint: resized' file-injector.ts          # expect 1
echo "[2] empty-image detail push:"; grep -c 'kind: "image", dimensionHint: undefined' file-injector.ts        # expect 1
echo "[3] binary detail push:";      grep -c 'kind: "binary"' file-injector.ts                                 # expect 1
echo "[4] return type has blocks+details:"; grep -c 'blocks: string\[\]; details: FileDetail\[\]' file-injector.ts  # expect 1
echo "[5] early return has blocks+details:"; grep -c 'injected: 0, paged: 0, blocks: \[\], details: \[\]' file-injector.ts  # expect 1
echo "[6] final return has blocks+details:"; grep -c 'blocks: state.blocks, details: state.details' file-injector.ts  # expect 1
echo "[7] --- concat DELETED from output path:"; grep -c 'finalText' file-injector.ts                          # expect 0
# Expected: all counts as noted (1,1,1,1,1,1,0). If any is off, re-check the corresponding edit.
# (The `\n\n---\n\n` literal remains ONLY in comments L315/L955 — those are fine; grep `finalText` targets the output path.)
```

### Level 3: Expected-red suite acknowledgment (NOT a regression — do NOT fix)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "Result:|FAIL" | head -5
# Expected: MANY failures (the suite was 128 green POST-S1; now most r.text assertions fail). Final line shows
# "Result: <small number> passed, <large number> failed." This is the INTENDED intermediate state.
# The failures are ALL "r.text no longer contains `<file>`/`---`" shape mismatches — NOT type errors, NOT crashes.
# (If you see a TypeError/crash, that's a real S2 bug — re-check the edits. If you see only assertion-shape
#  failures, that's the expected red — M2.T1 migrates them.)
#
# ⚠️ DO NOT edit the test files. DO NOT revert the source. The red suite is the handoff signal to P1.M2.T1.
```

### Level 4: Optional positive runtime probe (confidence only — not a gate)

```bash
# A throwaway probe (do NOT commit) confirming the new 6-field shape at runtime. Mirror the harness's jiti loader:
cat > /tmp/s2-probe.mjs <<'EOF'
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PIPKG = require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const jiti = require(PIPKG + "/node_modules/jiti/jiti.js");   // adapt path if needed
const mod = jiti(require)("./file-injector.ts", { alias: { "@earendil-works/pi-coding-agent": PIPKG } });
const fs = require("fs"), path = require("path"), os = require("os");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s2-"));
fs.writeFileSync(path.join(dir, "a.ts"), "export const x = 1;\n");
const r = await mod.injectFiles("Review #@a.ts", [], { cwd: dir });
console.log("keys:", Object.keys(r).sort().join(","));
console.log("text has ---?:", r.text.includes("\n\n---\n\n"));
console.log("text has <file>?:", r.text.includes("<file"));
console.log("blocks is array:", Array.isArray(r.blocks), "len:", r.blocks.length);
console.log("details is array:", Array.isArray(r.details), "len:", r.details.length);
console.log("detail[0]:", JSON.stringify(r.details[0]));
fs.rmSync(dir, { recursive: true, force: true });
EOF
node /tmp/s2-probe.mjs; rm -f /tmp/s2-probe.mjs
# Expected: keys include blocks,details; text has ---? false; text has <file>? false; blocks/details are arrays
# with len 1; detail[0] has kind:"text" (S1's emitText push). This proves the return-shape change works at runtime.
# (If the jiti path doesn't resolve, skip this probe — Level 1+2 are the deterministic gate.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] Structural grep (Level 2): all 7 checks pass (3 detail pushes; return type; early return; final return; `finalText` gone).
- [ ] `git diff --stat` shows ONLY `file-injector.ts` changed.

### Feature Validation (the contract)

- [ ] `injectFile` pushes image / empty-image / binary details (each right after its block push).
- [ ] `injectFiles` returns `{ text, images, injected, paged, blocks, details }`; `text` is stripped prompt ONLY.
- [ ] The `\n\n---\n\n` concat is DELETED from the output path (the `finalText` line is gone).
- [ ] The early return (`count===0`) includes `blocks: [], details: []` and keeps `images: imagesIn`.

### Scope & Gate Integrity

- [ ] NO test file edited (the red suite is expected; migration is M2.T1).
- [ ] NO revert/weakening to force the suite green.
- [ ] emitText, scanTokens, injectMarkdown, processTokenStream, the strip loop, subtract math, the factory
      handler — all UNCHANGED.
- [ ] No new exports (FileDetail already exported by S1); no new imports.

### Documentation

- [ ] The 1-line comment on the new final return explains the seam (blocks+details returned for T2.S1 to stash).
- [ ] No README/user-facing change (internal signature change; Mode A: none).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT treat the red test suite as a regression.** S2 INTENTIONALLY changes the return shape; the ~230
  `r.text`-shape assertions are EXPECTED to fail. The deterministic gate is `npm run typecheck` + structural grep.
  Re-greening is M2.T1's job. Editing tests here = scope creep into another subtask.
- ❌ **Do NOT revert the source or weaken the change to make the suite green.** That defeats the entire migration
  (the whole point is to move blocks out of `r.text` into `r.blocks`).
- ❌ **Do NOT edit the factory `input` handler (L1062).** It destructures `{ text, images, injected, paged }` and
  ignores the new fields — that's correct for the intermediate state. T2.S1 rewires it to stash `{ blocks, details }`.
  Adding the stash here = scope creep into T2.S1.
- ❌ **Do NOT push image/binary details in emitText.** Those branches don't flow through emitText; they're in
  injectFile. S1 owns text/paged (emitText); S2 owns image/empty-image/binary (injectFile). Keep the sites separate.
- ❌ **Do NOT push a detail BEFORE its block push, or in a different order.** details MUST be index-parallel to
  blocks (the renderer pairs them by index, §6.4). Each detail push goes IMMEDIATELY after its matching block push.
- ❌ **Do NOT change the early return's `images: imagesIn` to `state.images`.** The ORIGINAL-ref identity contract
  must hold (only ADD `blocks: [], details: []`).
- ❌ **Do NOT re-import `formatDimensionNote`.** It's already imported (L3). The image detail push uses it directly.
- ❌ **Do NOT leave the `finalText` concat line in place.** Edit 6 DELETES it. Leaving it = the `---` still in the
  output path = the seam is broken for T2.S1.
- ❌ **Do NOT add image/binary details with `as const` on the kind.** The object literal is contextually typed by
  `state.details: FileDetail[]` (matches S1's emitText pushes) — `as const` is unnecessary.

---

## Confidence Score: 9/10

Six precise, well-bounded source edits (3 detail pushes + return-type + early-return + final-return), each with
exact oldText→newText verified against the POST-S1 working tree. `formatDimensionNote` is imported; `FileDetail`
is exported (S1); the factory destructure ignores the new fields → typecheck stays clean. The deterministic gate
(typecheck + structural grep) is unambiguous. The -1 reserves for the UNUSUAL gate (an intentionally-red suite):
the implementing agent must understand the red suite is the EXPECTED intermediate state and must NOT edit tests,
revert source, or wire the factory stash (all out of scope — M2.T1 / T2.S1 respectively). The PRP flags this
loudly in the scope header, the success criteria, Level 3, and the anti-patterns.
