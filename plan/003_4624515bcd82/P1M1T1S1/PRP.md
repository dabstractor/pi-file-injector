# PRP — P1.M1.T1.S1: Introduce shared State + consolidate dedup + subtract helper

> **Scope flag:** This is a **pure refactoring subtask.** Behavior MUST be byte-for-byte identical.
> The regression gate is the existing 52-test suite passing unchanged. No new tests, no new exports,
> no markdown, no recursion. The loop stays linear.

---

## Goal

**Feature Goal:** Replace the scattered locals inside `injectFiles` (`file-injector.ts`) with ONE
shared `const state: State` object, add the `interface State` + a `subtract(state, cost)` helper, and
consolidate the two dedup sets (`priorPaths` + `injectedThisRun`) into `state.injectedSet` — all
**without changing any observable behavior.**

**Deliverable:** A modified `file-injector.ts` that:
1. Declares `interface State { blocks; images; injectedSet; remaining; count; paged }` (mirrors PRD §9).
2. Declares `function subtract(state, cost)` (PRD §9).
3. Rewrites `injectFiles` to allocate a single `const state: State`, compute the budget into
   `state.remaining`, seed `state.injectedSet` with the existing `priorPaths`, and read/write
   `state.*` everywhere — converting exactly the two inline text-budget mutations into `subtract()`
   calls and merging `injectedThisRun` into `state.injectedSet`.
4. Updates the `injectFiles` JSDoc (Mode A) to note the shared `State` and forward-reference the
   whole-prompt budget (PRD §5.6.2).

**Success Definition:** `node ./file-injector.test.mjs` prints **`52 passed, 0 failed.`** The external
signature `injectFiles(text, imagesIn, ctx)` → `Promise<{ text; images; injected; paged }>` and its
return shape are UNCHANGED. The shared `State` + `subtract()` now exist for T1.S2 (helper extraction)
and T2 (markdown).

## Why

- **Structural prerequisite for recursion.** Markdown transitive imports (PRD §5.6, delivered in T2)
  require shared mutable state threaded through a recursive `injectFile` → `injectMarkdown` call chain.
  The current single-function scattered locals cannot be threaded. Introducing `State` now (a
  no-op-behavior refactor) isolates the structural change from the feature change, so each lands green.
- **Consolidates two redundant sets.** `priorPaths` (seeded from `<file>` blocks in text) and
  `injectedThisRun` (within-run) are semantically one accumulator: "paths already claimed." Collapsing
  them into `state.injectedSet` is the exact shape PRD §9 / §6.2 specify, and is provably equivalent
  (see Context → Dedup-equivalence proof).
- **Prepares the budget to span the whole prompt.** PRD §5.6.2 requires one shared `remaining`
  subtracted by text/image/binary across top-level tokens AND imports. Moving `remainingBudget` into
  `state.remaining` (with `subtract()`) is the seam. **This subtask keeps the budget text-only**
  (images/binary do NOT call `subtract` yet — that is T2.S2), preserving byte-for-byte behavior.

## What

User-visible behavior: **identical** (no user-facing change; this is internal). The `#@` extension
behaves exactly as it does today. Concretely:

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → **52 passed, 0 failed** (identical to baseline).
- [ ] `interface State { blocks: string[]; images: ImageContent[]; injectedSet: Set<string>; remaining: number | null; count: number; paged: number }` exists in `file-injector.ts`.
- [ ] `function subtract(state: State, cost: number)` exists and does `if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost);`.
- [ ] `injectFiles` allocates exactly ONE `const state: State` (plus the budget temp) and contains NO `let remainingBudget`, NO separate `priorPaths`/`injectedThisRun` locals used for dedup (the priorPaths seeding loop may be kept or inlined into the `State` initializer).
- [ ] The two inline text-budget mutations (inline-whole fileCost, paged-head `Math.ceil(HEAD_CHARS/4)`) are replaced by `subtract(state, …)`; the sub-head-guard branch (`content.length <= HEAD_CHARS`) still does NOT mutate the budget.
- [ ] The `count === 0` early return still reads `{ text, images: imagesIn, injected: 0, paged: 0 }` — the **ORIGINAL `imagesIn` ref**, not `state.images`.
- [ ] `injectFiles` external signature + return shape `{ text, images, injected, paged }` UNCHANGED.
- [ ] No new exports; the test sanity list (lines ~113–121) is NOT modified.
- [ ] `FILE_INJECT_RE` (Unicode `u` flag, `(?<![\p{L}\p{N}_])`), F3 `hasValidImageMagic` gate, F5
      `formatEmptyImageBlock`, empty-0-byte-text → `formatTextFileBlock` with empty content, the
      `#@` strip (high→low, index-based, 2-char splice), and the `\n\n---\n\n` assembly are all preserved verbatim.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes the exact current-landmarks line map, the precise
local→state conversion table, the dedup-equivalence proof, and the verified validation command. The
implementer edits exactly one file (`file-injector.ts`) and the change is a mechanical
variable-renaming + two-helper-addition.

### Documentation & References

```yaml
# MUST READ — the contract for this exact subtask
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "§MI-1 — the refactor contract: the State interface fields, the dedup-consolidation rule,
        the MI-1 behavior-preservation checklist, and the explicit note that MI-1 budget stays
        text-only (images/binary do NOT subtract yet)."
  section: "## MI-1 — Refactor `injectFiles` into shared `State` + recursive helpers (no behavior change)"
  critical: "Lines cited are commit landmarks (will shift). Use IDENTIFIER names, not line numbers,
             as the stable contract. State fields are pinned exactly."

# MUST READ — the target State/subtract shapes (the final-form pseudocode)
- file: PRD.md
  why: "§9 pseudocode shows the TARGET State interface and subtract() exactly; §6.2 Assembly pins
        each State field's meaning; §5.5 pins the budget math + O-1 fallback; §5.6.2 is the
        forward-referenced whole-prompt budget this subtask prepares (but does not yet implement)."
  section: "## 9. Algorithm (pseudocode)  →  interface State {...} and function subtract(state, cost)"

# MUST READ — what each new field means and the dedup invariant
- file: plan/003_4624515bcd82/architecture/system_context.md
  why: "§1 'External contract (must be preserved verbatim)' (the imagesIn ORIGINAL-ref rule);
        §5.1 dedup keys on resolved abs path (NOT output blocks); §6 budget mock pattern."
  critical: "Architectural fact #1: dedup keys on the resolved abs path, which is why paged delivery
             (2 blocks/path) already coexists with dedup. Keep injectedSet = abs paths."

# The file you edit (the only source change)
- file: file-injector.ts
  why: "The current injectFiles body (landmarks below). 467 lines total."
  pattern: "Linear matchAll loop with scattered locals → convert to a single const state: State."
  gotcha: "The count===0 early return (L338) uses the ORIGINAL imagesIn ref, NOT the images copy.
           Preserving this is byte-for-byte critical (test case 5 asserts the ref identity)."

# The regression gate (run it; do NOT modify it)
- file: file-injector.test.mjs
  why: "1044-line, zero-dependency .mjs acceptance harness (the repo's 'standalone gate' convention;
        no test framework is configured). Imports the REAL committed .ts via jiti + Pi's alias map.
        Asserts the module surface (L113-121) and ~52 named cases. Exits 0 iff all green."
  pattern: "node ./file-injector.test.mjs  # from repo root; exits 0 on success, 1 on any failure"
  gotcha: "The sanity list (L113-121) asserts 9 exports (default, injectFiles, cleanToken,
           formatTextFileBlock, formatImageBlock, formatBinaryBlock, formatEmptyImageBlock,
           formatPagedDirectiveBlock, hasValidImageMagic). State/subtract are NOT in it and MUST NOT
           be added — they are internal. expandTildeAndResolve/extOf/isBinary are also exported (used
           by tests directly) and must remain exported."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE ONLY FILE EDITED (467 lines; injectFiles at L179-355)
├── file-injector.test.mjs    # regression gate (1044 lines; DO NOT EDIT; sanity list L113-121)
├── package.json              # { "pi": { "extensions": ["file-injector.ts"] } } — untouched
├── PRD.md                    # read-only
├── README.md                 # untouched this subtask (Mode B docs land in T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/
    │   ├── codebase_insertion_points.md   # ← MI-1 refactor contract
    │   ├── system_context.md              # ← external contract + dedup facts
    │   └── external_deps.md
    └── P1M1T1S1/
        ├── research/research_notes.md     # ← full conversion map + line landmarks
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts   # MODIFIED — add interface State + subtract(); rewrite injectFiles internals.
                    #                  No other file changes. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the count===0 early return uses the ORIGINAL imagesIn ref (NOT state.images).
//   Current (L338):  if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };
//   After refactor:  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };
//   ↑ still imagesIn. The FINAL return (count>0) uses state.images (the copy). Test case 5 asserts the
//   missing-file path returns imagesIn by identity, so swapping these would FAIL the suite.

// CRITICAL — only TWO budget mutations convert to subtract(); the sub-head guard does NOT.
//   (1) inline-whole:   if (remaining!==null) remaining = Math.max(0, remaining - fileCost)  →  subtract(state, fileCost)
//   (2) paged-head:     remaining = Math.max(0, remaining - Math.ceil(HEAD_CHARS/4))          →  subtract(state, Math.ceil(HEAD_CHARS/4))
//   The sub-head-guard branch (content.length <= HEAD_CHARS inside the paged else) currently mutates
//   NOTHING and must continue to mutate nothing (test PD6 asserts whole delivery under tight budget
//   WITHOUT paging). subtract() adds an internal `if(state.remaining!==null)` guard that is a no-op
//   in case (2) because non-null is guaranteed by being in the `else` branch — net result identical.

// CRITICAL — injectedIndexes STAYS A LOCAL, it is NOT a State field.
//   PRD §9 State = { blocks, images, injectedSet, remaining, count, paged }. The marker-strip index
//   list is a top-level-prompt concern (returned by processTokenStream in T1.S2), not recursion-shared
//   state. Keep `const injectedIndexes: number[] = []` local to injectFiles.

// GOTCHA — dedup is by resolved ABS path, NOT by output <file> blocks. Paged delivery emits 2 blocks
//   per path (head + directive) and that is NOT a dedup collision. state.injectedSet holds ABS PATHS.

// GOTCHA — the budget computation MUST keep its try/catch (getContextUsage can throw; PRD §12.5 never
//   throw). undefined-or-null-tokens → remaining=null (O-1 fallback, inject whole). Test PD3 asserts
//   the unknown-budget path injects huge.log WHOLE.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step; the .mjs test imports file-injector.ts
//   directly. There is no tsc/ruff/pytest here — the ONLY gate is `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

```ts
// Add near the top of the file, just before `injectFiles` (or grouped with the other core pieces).
// Mirrors PRD §9 / §6.2 EXACTLY (field names + types + order). NOT exported (internal).
interface State {
  blocks: string[];
  images: ImageContent[];
  injectedSet: Set<string>;   // seeded with priorPaths; holds resolved abs paths → dedup
  remaining: number | null;   // single budget accumulator (§5.5 / §5.6.2)
  count: number;
  paged: number;
}

// PRD §9 — subtract a cost from the shared budget, no-op when budget is unknown (null).
// NOT exported (internal). Used by emitText in T1.S2; for T1.S1 it is called inline from injectFiles.
function subtract(state: State, cost: number): void {
  if (state.remaining !== null) {
    state.remaining = Math.max(0, state.remaining - cost);
  }
}
```

### Local → state conversion map (the whole change in one table)

| Current code (local) | After refactor (state) |
|---|---|
| `const blocks: string[] = []` (L189) | `state.blocks` (seeded `[]`) |
| `const images = [...imagesIn]` (L190) | `state.images` (seeded `[...imagesIn]`) |
| `let count = 0` (L191) | `state.count` (seeded `0`) |
| `let paged = 0` (L192) | `state.paged` (seeded `0`) |
| `let remainingBudget` (L198, with try/catch L199-208) | compute into a temp `remaining`, then seed `state.remaining` |
| `priorPaths` (L220) + `injectedThisRun` (L229) | `state.injectedSet` (seeded with priorPaths; `.add(abs)` at each success site) |
| `injectedIndexes: number[]` (L235) | **STAYS LOCAL** `const injectedIndexes: number[] = []` (NOT in State) |
| dedup check `if (priorPaths.has(abs) \|\| injectedThisRun.has(abs)) continue;` (L248) | `if (state.injectedSet.has(abs)) continue;` |
| empty-image success (L268-270): `injectedThisRun.add(abs); injectedIndexes.push(m.index); count++; continue;` | `state.injectedSet.add(abs); injectedIndexes.push(m.index); state.count++; continue;` |
| inline-whole budget (L300): `if (remainingBudget !== null) remainingBudget = Math.max(0, remainingBudget - fileCost);` | `subtract(state, fileCost);` |
| sub-head guard (L319-322): push whole, NO budget mutation | UNCHANGED (still no budget mutation) |
| paged-head budget (L324): `remainingBudget = Math.max(0, remainingBudget - Math.ceil(HEAD_CHARS / 4));` | `subtract(state, Math.ceil(HEAD_CHARS / 4));` |
| generic success (L329-331): `injectedThisRun.add(abs); injectedIndexes.push(m.index); count++;` | `state.injectedSet.add(abs); injectedIndexes.push(m.index); state.count++;` |
| early return (L338): `if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };` | `if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };` (**ORIGINAL imagesIn ref**) |
| strip (L350-353) over `injectedIndexes` | UNCHANGED (injectedIndexes is still local) |
| finalText (L354): `...${blocks.join("\n\n")}` | `...${state.blocks.join("\n\n")}` |
| final return (L355): `{ text: finalText, images, injected: count, paged }` | `{ text: finalText, images: state.images, injected: state.count, paged: state.paged }` |

### Dedup-equivalence proof (why consolidation is behavior-identical)

`state.injectedSet` is initialized = `priorPaths` (the `<file name="…">` blocks already in `text`).
At each per-token check, `state.injectedSet.has(abs)` is equivalent to
`priorPaths.has(abs) || injectedThisRun.has(abs)`, because the set at check time == `{priorPaths} ∪
{abs paths successfully delivered so far this run}`, maintained incrementally via `.add(abs)` at each
success site. Therefore:
- **F1** (a prior block for X blocks re-inject of X): X ∈ priorPaths ⊆ injectedSet → skipped. ✓ (tests F1/F1b/F1c)
- **F1c** (a NEW path Y still injects): Y ∉ priorPaths, not yet added → injects. ✓
- **within-run repeat** (DUP1/DUP2/DUP3): first delivery adds Y; second check sees Y → skipped. ✓

### Implementation Patterns & Key Details

```ts
// === The State initializer in injectFiles (after refactor) ===
// Compute the budget FIRST (preserving the EXACT current math + try/catch), then seed State.
let remaining: number | null;
try {
  const usage = ctx.getContextUsage?.();
  if (usage === undefined || usage.tokens === null) {
    remaining = null; // O-1 fallback: budget unknown → inject whole (no paging)
  } else {
    const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
    remaining = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);
  }
} catch {
  remaining = null; // getContextUsage threw → O-1 fallback (PRD §12.5: never throw)
}

// seed dedup with every <file name="..."> block already in the text (prior copy or @file)
const priorPaths = new Set<string>();
for (const m of text.matchAll(/<file name="([^"]+)">/g)) priorPaths.add(m[1]);

const state: State = {
  blocks: [],
  images: [...imagesIn],        // COPY (runner REPLACES the array on transform)
  injectedSet: priorPaths,      // consolidated dedup: priorPaths ∪ within-run (added at each success)
  remaining,
  count: 0,
  paged: 0,
};

// KEEP the linear loop unchanged in SHAPE; only the variable references change:
const injectedIndexes: number[] = [];   // LOCAL — marker-strip indices (top-level concern, not State)
for (const m of text.matchAll(FILE_INJECT_RE)) {
  // ... raw = m[2]; token = cleanToken(raw); if (!token) continue;
  const abs = expandTildeAndResolve(token, ctx.cwd);
  if (state.injectedSet.has(abs)) continue;   // ← consolidated dedup (was priorPaths.has || injectedThisRun.has)
  // ... stat / isFile guards unchanged (leave verbatim on miss/dir)
  try {
    const buf = await fs.readFile(abs);
    // F5 empty-image branch: state.injectedSet.add(abs); injectedIndexes.push(m.index); state.count++; continue;
    // F3 image / binary / text cascade — all `blocks.push(...)` become `state.blocks.push(...)`,
    //   `images.push(...)` becomes `state.images.push(...)`, `paged++` becomes `state.paged++`.
    //   INLINE-WHOLE budget  →  subtract(state, fileCost);
    //   SUB-HEAD guard       →  NO budget mutation (unchanged)
    //   PAGED-HEAD budget    →  subtract(state, Math.ceil(HEAD_CHARS / 4));
    state.injectedSet.add(abs);
    injectedIndexes.push(m.index);
    state.count++;
  } catch {
    continue;   // read/resize error → leave token verbatim (PRD §5.4, §12.5)
  }
}

if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL imagesIn ref

// strip #@ high→low over injectedIndexes (unchanged — injectedIndexes is still local)
let strippedText = text;
for (const i of [...injectedIndexes].sort((a, b) => b - a)) {
  strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
}
const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`;
return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
```

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    add: interface State {...}   # place just above injectFiles (or near the other core pieces)
    add: function subtract(state, cost)   # place just above injectFiles (or near format helpers)
    rewrite: injectFiles body (L189-355 region) per the conversion map above
    jsdoc: update injectFiles JSDoc (L168-177) — Mode A (see Task 5)

NO OTHER CHANGES:
  - package.json: untouched
  - file-injector.test.mjs: untouched (it is the gate, not an artifact)
  - README.md: untouched (Mode B docs are T3.S1)
  - no new files, no new exports, no new dependencies

BUDGET STAYS TEXT-ONLY (this subtask):
  - text inline-whole  → subtract(state, fileCost)            ✅ converted
  - text paged-head    → subtract(state, ceil(HEAD_CHARS/4))  ✅ converted
  - text sub-head guard → (no mutation)                        ✅ unchanged
  - image attach        → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
  - binary note         → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
  - empty-image note    → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD interface State to file-injector.ts
  - IMPLEMENT: interface State { blocks: string[]; images: ImageContent[]; injectedSet: Set<string>;
              remaining: number | null; count: number; paged: number }
  - PLACEMENT: just above injectFiles (after the pure helpers block, before the injectFiles JSDoc).
  - NAMING/ORDER/TYPES: mirror PRD §9 EXACTLY (do not rename/reorder fields).
  - EXPORT: none (internal interface).

Task 2: ADD function subtract(state, cost) to file-injector.ts
  - IMPLEMENT: function subtract(state: State, cost: number): void {
                 if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost); }
  - PLACEMENT: just above injectFiles (next to interface State).
  - EXPORT: none (internal).

Task 3: REWRITE injectFiles internals (behavior-preserving)
  - REPLACE: the scattered locals (blocks/images/count/paged/remainingBudget/priorPaths/injectedThisRun)
            with ONE const state: State, computed per the Blueprint conversion map.
  - KEEP LOCAL: const injectedIndexes: number[] = []  (NOT a State field).
  - PRESERVE VERBATIM: FILE_INJECT_RE Unicode matchAll loop shape; per-file try/catch; F5 empty-image
            branch order (mime && buf.length===0 BEFORE the F3 magic check); F3 hasValidImageMagic gate;
            isBinary text/binary routing; headSlice/headStartLine/headCompleteLineCount/format* calls;
            sub-head guard (content.length<=HEAD_CHARS → whole, no directive, no budget mutation);
            the count===0 → { text, images: imagesIn, ... } ORIGINAL-ref early return;
            #@ strip high→low (2-char slice at each injectedIndexes offset);
            finalText = strippedText + "\n\n---\n\n" + state.blocks.join("\n\n").
  - CONVERT EXACTLY TWO budget mutations to subtract(): inline-whole fileCost, paged-head ceil(HEAD_CHARS/4).
  - CONSOLIDATE DEDUP: state.injectedSet seeded with priorPaths; per-token check state.injectedSet.has(abs);
            each success site state.injectedSet.add(abs).
  - FOLLOW pattern: existing injectFiles (do not invent new structure — this is a rename + 2-helper-add).
  - DEPENDENCIES: Tasks 1 & 2 (State + subtract must exist before injectFiles references them).

Task 4: VERIFY the external contract is untouched
  - CONFIRM: export async function injectFiles(text, imagesIn, ctx) signature unchanged.
  - CONFIRM: return type Promise<{ text; images; injected; paged }> unchanged.
  - CONFIRM: no new `export` keywords added anywhere; test sanity list (L113-121) needs no edits.
  - CONFIRM: default factory, autocomplete provider, hasValidImageMagic, cleanToken,
            expandTildeAndResolve, extOf, isBinary, format* all untouched.

Task 5: UPDATE injectFiles JSDoc (Mode A — item §6 DOCS)
  - MODIFY: the injectFiles JSDoc (file-injector.ts L168-177).
  - ADD: a note that internal state is now carried in a shared State object
            (blocks / images / injectedSet / remaining / count / paged).
  - ADD: a forward-reference that the budget will span the whole prompt including markdown imports
            (PRD §5.6.2) — phrase as "prepares for"/"forward-reference", do not claim markdown exists yet.
  - PRESERVE: the rest of the JSDoc (PRD §9/§5.5 reference, the never-throws contract, the §6.2 assembly note).
  - NOTE: NO README change (Mode B lands in T3.S1).
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# There is no tsc/lint configured as a gate in this repo. The .mjs harness loads file-injector.ts via
# jiti (Pi's loader), which compiles+runs the TS on import. A syntax/type error in file-injector.ts
# surfaces as the harness failing to import (the sanity asserts at L113-121 never run → process exits
# non-zero with a jiti/TS error). So Level 1 == "the harness loads the file".

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -20
# Expected: the sanity assertions (✓ implicit) then the case matrix. A jiti/TS compile error here
# means your State/subtract/rewrite has a syntax problem — READ the error, fix, re-run.
```

### Level 2: The Regression Gate (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   ... (matrix rows) ...
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 52 passed, 0 failed.
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# The suite covers (all must stay green): cases 1-14, E1-E4, G1-G3, H1, M1, F1/F1b/F1c/F1d,
# F2, FS1-FS3, F3a/F3b, F5, F4, U1, A1, DUP1-DUP3, PD1-PD8, PN1-PN4.
# If ANY case flips to FAIL, your refactor changed behavior — diff against the conversion map.
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# These are the cases most sensitive to THIS refactor. If one breaks, here is the likely cause:

# Case 5 (missing file) / any injected===0 path → asserts imagesIn ref identity.
#   If FAIL: you returned state.images instead of imagesIn in the count===0 early return.

# PD3 (O-1 fallback, budget unknown) → huge.log injected WHOLE, paged=0.
#   If FAIL: your budget computation dropped the try/catch or the undefined/null→null branch.

# PD1/PD2/PN2/PN3 (paged delivery) → head+directive, paged count correct.
#   If FAIL: a subtract() conversion changed the numeric result (check ceil(HEAD_CHARS/4) and fileCost).

# PD6 (sub-head guard) → WHOLE under tight budget, NO directive.
#   If FAIL: you accidentally added a subtract to the sub-head-guard branch.

# F1/F1b/F1c/F1d/DUP1/DUP2/DUP3 (dedup) → exact-path / within-run repeat blocks ONCE.
#   If FAIL: the injectedSet seeding or .add placement diverged from priorPaths/injectedThisRun.

# FS1/FS2/FS3 (failed tokens keep #@) → strip only touches injected markers.
#   If FAIL: injectedIndexes push/strip logic drifted (it should be UNCHANGED — it stays local).

# Run a single conceptual re-check by re-running the whole suite (cases share fixtures):
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2 for this subtask. There is no model, no network, no server, no DB.
# Optional smoke (proves the live loader path works end-to-end, not required for the gate):
#   echo 'Review #@file-injector.ts' | pi -p "$(cat -)" 2>/dev/null | head -5 || true
# (The 52-test harness is the authoritative gate.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `52 passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error when the harness imports file-injector.ts.
- [ ] `interface State` exists with the EXACT 6 fields/types/order from PRD §9.
- [ ] `function subtract(state, cost)` exists and matches PRD §9 exactly.
- [ ] `injectFiles` has exactly ONE `const state: State` and no `let remainingBudget`.
- [ ] Exactly TWO `subtract(state, …)` calls were added (inline-whole, paged-head); sub-head guard has none.

### Feature Validation (behavior preservation)

- [ ] `injectFiles` external signature + return shape `{ text, images, injected, paged }` UNCHANGED.
- [ ] `count===0` early return uses ORIGINAL `imagesIn` (not `state.images`).
- [ ] Dedup still blocks prior-block paths (F1) and same-path repeats (DUP1-3); new paths still inject (F1c).
- [ ] Budget text-only behavior preserved: PD1/PD2 page, PD3 injects whole, PD6 sub-head whole, PD4/PD5
      (image/binary) UNAFFECTED by budget (no subtract yet).
- [ ] `#@` strip is index-based, high→low, only on injected markers (FS1/FS2/FS3 green).
- [ ] F3 magic gate + F5 empty-image + Unicode regex + `\n\n---\n\n` assembly all green (U1, F3a/b, F5, case 1).

### Code Quality Validation

- [ ] `State` and `subtract` are NOT exported (test sanity list L113-121 unchanged).
- [ ] `injectedIndexes` remains a local in `injectFiles` (not hoisted into State).
- [ ] No comments deleted that explain invariants (budget O-1, F1/F1c, Issue 1/2, FINDING 1/2); the
      refactor relocates variable names but the rationale comments should travel with the code.
- [ ] The linear `matchAll` loop SHAPE is unchanged (no recursion, no helper extraction — that is T1.S2).

### Documentation

- [ ] injectFiles JSDoc updated (Mode A): notes shared State + forward-references whole-prompt budget (§5.6.2).
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT change behavior.** This is a rename + 2-helper-add. If a test flips, you changed logic,
  not just representation. Re-read the conversion map and the dedup-equivalence proof.
- ❌ **Do NOT add `subtract` calls for image/binary/empty-image.** Those are T2.S2. Adding them now
  breaks PD4/PD5 byte-for-byte (the budget would mutate where it currently does not).
- ❌ **Do NOT extract `scanTokens`/`processTokenStream`/`injectFile`/`emitText`.** That is T1.S2. Keep
  the linear `for (const m of text.matchAll(FILE_INJECT_RE))` loop inline in `injectFiles`.
- ❌ **Do NOT export `State` or `subtract`, and do NOT touch the test sanity list (L113-121).**
- ❌ **Do NOT move `injectedIndexes` into State.** It is a top-level marker-strip concern (T1.S2 makes
  it the return value of `processTokenStream`), not recursion-shared state.
- ❌ **Do NOT lose the ORIGINAL-ref early return.** `count===0` returns `images: imagesIn`, NOT
  `images: state.images`. The final return (`count>0`) uses `state.images`.
- ❌ **Do NOT add a budget mutation to the sub-head-guard branch** (`content.length <= HEAD_CHARS`
  inside the paged else). It currently mutates nothing and must stay mutation-free (PD6).
- ❌ **Do NOT drop the budget try/catch** or the `usage===undefined || usage.tokens===null → null`
  branch. PD3 depends on the O-1 fallback injecting whole.
- ❌ **Do NOT modify any other file** (test harness, package.json, README, PRD). One file, one change.

---

## Confidence Score: 9/10

This is a tightly-scoped, mechanical refactor with a complete conversion map, a dedup-equivalence
proof, an exact field/type contract, and a single authoritative green gate (`52 passed, 0 failed`).
The -1 reserves for the small risk of a comment-relocation or field-order typo; the gate catches both
instantly. The implementing agent edits exactly one file and re-runs one command.
