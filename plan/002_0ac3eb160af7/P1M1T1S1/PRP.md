---
name: "P1.M1.T1.S1 — Add paged-delivery constants, formatPagedDirectiveBlock helper, and widen injectFiles types"
prd_ref: "PRD §5.5 (Oversize files: automatic paged delivery) — 'Constants (defaults to pin)' + 'Page path' directive block"
target_file: "./file-injector.ts" (+ one sanity-check line in ./file-injector.test.mjs)
change_type: surgical multi-edit (constants + 1 exported helper + type widening + JSDoc + 2 return sites); NO behavioral change
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
---

# PRP — P1.M1.T1.S1: Paged-Delivery Constants, `formatPagedDirectiveBlock`, Widen `injectFiles` Types

## Goal

**Feature Goal**: Lay the type-and-constant scaffolding for PRD §5.5 (automatic paged delivery of oversize files) **without changing any runtime behavior**. Add the 5 pinned budget constants (`PAGED_THRESHOLD`, `MARGIN`, `HEAD_BYTES`, `DEFAULT_WINDOW`, `DEFAULT_RESERVE`), a new exported `formatPagedDirectiveBlock(abs, totalBytes)` helper (the paged-delivery directive note), widen `injectFiles`'s `ctx` parameter type (so S2 can read `ctx.getContextUsage()` and `ctx.model`) and its return type (add `paged: number`), hardcode `paged: 0` at both return sites, and update the `injectFiles` JSDoc to describe the inline-vs-paged model. The actual budget computation and inline-vs-paged decision are S2; the handler notify + factory JSDoc are S3.

**Deliverable**: Six precise edits to `./file-injector.ts` + one added sanity-check line in `./file-injector.test.mjs`. No new files. `formatPagedDirectiveBlock` is exported but NOT yet called. `paged` is always `0`. The existing 34-case harness must still report **34 passed, 0 failed** after the only test change (adding the new export to the module-surface sanity check).

**Success Definition**:
- [ ] The 5 constants exist at module scope immediately after `TRAILING_PUNCT` (L17), with exact values.
- [ ] `formatPagedDirectiveBlock(abs, totalBytes)` is exported immediately after `formatEmptyImageBlock` and emits the exact em-dash directive string (verified below).
- [ ] `injectFiles`'s `ctx` param type is widened with OPTIONAL `getContextUsage?` and `model?` fields (so the test mock `FIX = { cwd: TMPDIR }` still satisfies it).
- [ ] `injectFiles`'s return type includes `paged: number`; BOTH return sites (L209, L217) return `paged: 0`.
- [ ] `injectFiles` JSDoc describes inline-vs-paged delivery per §5.5 and the new ctx/return fields.
- [ ] `node ./file-injector.test.mjs` → **34 passed, 0 failed** (the harness's module-surface sanity check gains exactly one `formatPagedDirectiveBlock` assert; no behavioral test changes).
- [ ] A one-off verification script (provided verbatim) shows: `formatPagedDirectiveBlock` is a function producing the exact directive string; `injectFiles` return now has `paged: 0` with `injected` unchanged; all 5 constants present.

> **Scope boundary (read carefully):** This subtask is the §5.5 SCAFFOLD. It does **NOT** (a) add `let paged = 0;` / `let remaining` / budget computation / the inline-vs-paged decision branch at the text-inject site (L199) — that is **S2**; (b) change the L209 guard from `count === 0` to `count === 0 && paged === 0` — that is **S2**; (c) make the handler notify mode-aware ("N whole, M paged") or update the factory JSDoc's "No limits" paragraph or destructure `paged` in the handler — that is **S3**; (d) touch the README — that is **P1.M1.T2**. `paged` is hardcoded `0` everywhere in S1; no `paged` variable exists yet.

## User Persona

**Target User**: The implementing AI agents for S2 and S3 (this subtask gives them the typed surface and constants to build on), and transitively the end user who will get whole-file content even when a `#@`'d file exceeds remaining context.

**Use Case**: Foundation artifact — no user-visible behavior change yet. The constants + widened types + directive helper are the stable surface S2 (budget logic) and S3 (notify) extend.

## Why

- **Unblocks S2/S3 with a typed contract.** S2's budget computation needs `ctx.getContextUsage()` and `ctx.model` (both VERIFIED on `ExtensionContext`); S2's `paged` accounting needs the return type to carry a paged count. Widening the types now (with `paged: 0` no-op) lets S2 fill in logic without touching signatures, and keeps this change hermetic and reversible.
- **Pins the §5.5 constants in one place.** PRD §5.5 "Constants (defaults to pin)" fixes `PAGED_THRESHOLD=0.6`, `MARGIN=8192`, `HEAD_BYTES=8192`, `DEFAULT_WINDOW=200000`, `DEFAULT_RESERVE=8192`. Declaring them now means S2 references named constants, not magic numbers.
- **Delivers the directive helper the §5.5 page path needs.** The page path emits a head block (reuse `formatTextFileBlock`) + a directive block (this new helper). S2 calls it; S1 just defines it.

## What

Six edits to `file-injector.ts` (constants, helper, JSDoc, ctx type, return type, both returns) + one edit to `file-injector.test.mjs` (add the new export to the module-surface sanity check). No call to `formatPagedDirectiveBlock` is added; `paged` is `0` at both returns; no `paged` variable is introduced.

### Success Criteria

- [ ] `formatPagedDirectiveBlock` exported and, for `("/abs/x.ts", 50000)` with `HEAD_BYTES=8192`, returns exactly: `<file name="/abs/x.ts"><large file — estimated 50000 bytes; first 8192 bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>` (where `—` is U+2014).
- [ ] `injectFiles` still injects a whole small file (`injected === 1`) and its return object now also has `paged: 0`.
- [ ] Both return sites carry `paged: 0`; the L209 guard is still `count === 0` (unchanged).
- [ ] The widened `ctx` type's new fields are OPTIONAL (`?`), so `{ cwd: TMPDIR }` still satisfies it.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ — **YES.** This PRP includes the exact current line numbers, every edit as an old→new block anchored on unique text, the verified `ContextUsage`/`model` shapes (with `path:line` evidence), the verified-working one-off validation script, and a precise scope boundary. No access to Pi internals beyond the quoted verification doc is required.

### Documentation & References

```yaml
# MUST READ — §5.5 architecture recon (already produced for this plan)
- docfile: plan/002_0ac3eb160af7/architecture/implementation_insertion_points.md
  why: "§1 pins the constants block (L8-17) and the exact 5 constants to add after L17; §2 pins the
        format-helper cluster (L90-112) and the formatPagedDirectiveBlock insertion after formatEmptyImageBlock;
        §3 pins the injectFiles JSDoc (L114-121), signature (L122-126), and BOTH return sites (L209, L217)."
  critical: "This task = change sites A, B, C, D, E, (partial) I, J ONLY. Sites F/G/H (paged logic) are S2;
        K/L/M (handler notify + factory JSDoc) are S3. The L209 guard is NOT changed in S1 (only paged:0 added)."

- docfile: plan/002_0ac3eb160af7/architecture/pi_api_verification.md
  why: "§1 ContextUsage exact shape {tokens:number|null; contextWindow:number; percent:number|null};
        §2 getContextUsage() returns ContextUsage|undefined; §3 ctx.model has required contextWindow+maxTokens
        numbers but ctx.model itself is |undefined. All VERIFIED against dist .d.ts with path:line."
  critical: "Both new ctx fields MUST be optional (?): getContextUsage and model can each be undefined, and
        the test mock FIX={cwd} omits them. tokens is nullable even when the wrapper is present."

- docfile: plan/002_0ac3eb160af7/prd_snapshot.md
  why: "§5.5 'Constants (defaults to pin)' is the source of truth for the 5 values; 'Page path' step 2
        defines the directive block content (full path + estimated size + read-tool offset:0/limit:2000 instruction)."
  section: "§5.5"

# The file being EDITED
- file: ./file-injector.ts
  why: "All six edits land here. Constants at L8-17; format helpers L90-112 (formatEmptyImageBlock ends L112);
        injectFiles JSDoc L114-121; signature L122-126; early return L209; final return L217."
  pattern: "Match the repo's terse inline-comment style (cite PRD section). New constants/helpers sit in the
        existing clusters (constants at top; format helpers grouped). Em-dash U+2014 (\\u2014) for the paged
        note, matching formatBinaryBlock/formatEmptyImageBlock."
  gotcha: "Both return sites must add `, paged: 0` — but do NOT introduce a `paged` variable or change the
        L209 guard. paged is a hardcoded 0 here; S2 adds the variable + guard change."

# The test harness (run for regression; add ONE sanity-check line)
- file: ./file-injector.test.mjs
  why: "Module-surface sanity check at L113-120 (8 asserts). ADD one for formatPagedDirectiveBlock. Run
        `node ./file-injector.test.mjs` → must stay 34/34."
  pattern: "assert(typeof mod.X === 'function', '...');  — matches the existing 8 lines exactly."
  gotcha: "Tests access injectFiles return by FIELD (r.text / r.injected / r.images) — no whole-object
        equality (VERIFIED by grep). So adding paged:0 to the return breaks NO behavioral test. Do NOT add
        any behavioral test for paging — that's S2's harness work (P1.M2)."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← THE FILE BEING EDITED (323 lines). 6 edits.
├── file-injector.test.mjs       # model-free harness (34 cases) — +1 sanity-check line only
├── PRD.md                       # READ-ONLY
├── README.md                    # P1.M1.T2 touches this (NOT this task)
└── plan/002_0ac3eb160af7/
    ├── architecture/{implementation_insertion_points.md, pi_api_verification.md, system_context.md, test_and_docs_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / delta_*.md
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — +5 constants, +1 exported helper, widened ctx+return types,
│                                #            updated JSDoc, +`, paged: 0` at both returns. No behavior change.
└── file-injector.test.mjs       # MODIFIED — +1 assert (formatPagedDirectiveBlock) in the module-surface
                                 #            sanity check. No behavioral test changes.
# No new files. No README change. No handler/factory changes (S3).
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — both new ctx fields MUST be optional (?). The test mock `FIX = { cwd: TMPDIR }` (test L212)
// and makeMockCtx's `{ cwd, hasUI, ui }` provide ONLY cwd (+ui/hasUI). If getContextUsage/model were
// required, the mock would stop satisfying the type. (Runtime: jiti transpiles w/o type-checking, so it
// wouldn't crash — but optional is the faithful contract and matches the spec.)

// CRITICAL — paged is a HARDCODED 0 at both return sites in S1. Do NOT add `let paged = 0;` and do NOT
// change the L209 guard to `count === 0 && paged === 0`. Those are S2. In S1 there is no paged variable.

// CRITICAL — getContextUsage() returns `ContextUsage | undefined` and ContextUsage.tokens is `number | null`
// (nullable, e.g. right after compaction). The widened ctx type captures both: the optional method AND the
// nullable tokens inside. S2 must null-check the whole result before reading .tokens.

// CRITICAL — ctx.model is `Model | undefined`; Model.contextWindow and Model.maxTokens are REQUIRED numbers,
// but ctx.model itself can be undefined. The widened model type is `{ contextWindow: number; maxTokens:
// number } | undefined` (a faithful structural subset — S2 reads only those two).

// COINCIDENCE — MARGIN (8192) and DEFAULT_RESERVE (8192) are the SAME value for DIFFERENT reasons: MARGIN
// is the safety subtraction from remaining; DEFAULT_RESERVE is the fallback for maxTokens. Do not unify.

// EM-DASH — the directive block uses U+2014 (\u2014) for visual consistency with formatBinaryBlock and
// formatEmptyImageBlock. Use the \u2014 escape (not a literal — char) so the file stays ASCII-safe.

// NO TYPE-CHECK — the repo has no tsconfig/tsc; jiti transpiles only. Types are erased at load, so a
// slightly-off type won't crash — but use the contract's exact widened type (S2 depends on it).
```

## Implementation Blueprint

### Data models and structure

The widened types ARE the data-model change here. No runtime objects change shape (paged is a constant 0).

```typescript
// Widened injectFiles ctx param (both new fields OPTIONAL — FIX={cwd} still satisfies it):
ctx: {
  cwd: string;
  getContextUsage?: () =>
    { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
}
// Widened return type (paged is always 0 in S1; S2 populates it):
Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }>
```

### Implementation Tasks (ordered top-to-bottom in the file; each is one exact edit)

```yaml
Task 1: EDIT ./file-injector.ts — add the 5 §5.5 constants after TRAILING_PUNCT (after L17)
  - FIND (unique anchor):
        const TRAILING_PUNCT = ".,;:!?\")]}>'";

        /** F3 — magic-number sniff.
  - INSERT between TRAILING_PUNCT and the F3 JSDoc (the 5 constants, exact values + terse comments):
        const TRAILING_PUNCT = ".,;:!?\")]}>'";

        /** §5.5 — paged-delivery budget constants (defaults pinned by PRD §5.5 "Constants (defaults to pin)"). */
        const PAGED_THRESHOLD = 0.6;    // inject whole if fileCost <= PAGED_THRESHOLD * remaining
        const MARGIN = 8192;            // safety bytes subtracted from remaining context
        const HEAD_BYTES = 8192;        // head block size (~2000 lines, matches read tool DEFAULT_MAX_LINES=2000)
        const DEFAULT_WINDOW = 200000;  // fallback context window when ctx.model?.contextWindow is absent
        const DEFAULT_RESERVE = 8192;   // fallback for ctx.model?.maxTokens when model is absent

        /** F3 — magic-number sniff.
  - NAMING: SCREAMING_SNAKE_CASE module consts (matches FILE_INJECT_RE / MIME_BY_EXT / TRAILING_PUNCT).
  - NOTE: MARGIN & DEFAULT_RESERVE are both 8192 by coincidence — keep both (independent knobs).

Task 2: EDIT ./file-injector.ts — add formatPagedDirectiveBlock after formatEmptyImageBlock (after L112)
  - FIND (unique anchor — the end of formatEmptyImageBlock + start of injectFiles JSDoc):
        export function formatEmptyImageBlock(abs: string): string {
          return '<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>';
        }

        /**
         * PRD §9 — core assembly.
  - INSERT formatPagedDirectiveBlock between formatEmptyImageBlock's closing `}` and the injectFiles JSDoc:
        export function formatEmptyImageBlock(abs: string): string {
          return '<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>';
        }

        /** PRD §5.5 — directive block for a paged (oversize) text file. Emits a <file name="abs"> note
         *  giving the full path + estimated size and instructing the model to load the rest via the read
         *  tool at offset:0, limit:2000 (the read tool's DEFAULT_MAX_LINES=2000), incrementing offset
         *  until the whole file is read. Reuses the em dash (U+2014) from formatBinaryBlock/formatEmptyImageBlock.
         *  The head block is NOT this helper — it is formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)). */
        export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {
          return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first ' + HEAD_BYTES + ' bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>';
        }

        /**
         * PRD §9 — core assembly.
  - EXPORTED (must be — the test sanity check asserts mod.formatPagedDirectiveBlock). References HEAD_BYTES
    by name (stays consistent if HEAD_BYTES changes). Uses \u2014 (U+2014), NOT a literal em-dash char.

Task 3: EDIT ./file-injector.ts — rewrite injectFiles JSDoc + widen ctx type + widen return type (L114-126)
  - FIND (the full JSDoc + signature block, unique):
        /**
         * PRD §9 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read each,
         * append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image), and return the
         * transformed prompt + merged images + count. NEVER throws (each file is isolated in try/catch);
         * tokens that miss/are directories/throw are left verbatim. The original prompt text is NOT modified —
         * blocks are appended after `\n\n---\n\n`, joined with `\n\n` (PRD §6.2). `injected` is a COUNT:
         * 0 => caller (T3.S2) returns {action:"continue"}; >0 => {action:"transform", text, images}.
         */
        export async function injectFiles(
          text: string,
          imagesIn: ImageContent[],
          ctx: { cwd: string },
        ): Promise<{ text: string; images: ImageContent[]; injected: number }> {
  - REPLACE WITH (updated JSDoc for inline-vs-paged + new ctx/return fields; widened ctx with OPTIONAL
    getContextUsage?/model?; return type adds paged: number):
        /**
         * PRD §9 / §5.5 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read
         * each, and append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image). The
         * whole file ALWAYS reaches the model: injected inline when it fits the remaining context budget,
         * paged via the model's `read` tool when it does not (PRD §5.5). NEVER throws (each file is isolated
         * in try/catch); tokens that miss/are directories/throw are left verbatim. The original prompt text is
         * NOT modified — blocks are appended after `\n\n---\n\n`, joined with `\n\n` (PRD §6.2). `ctx` carries
         * the budget inputs `getContextUsage()` (tokens used) and `model` (contextWindow/maxTokens); both
         * optional so a cwd-only ctx is valid. `injected` counts whole-file injections; `paged` counts files
         * delivered via the page path (PRD §5.5). Return `{injected:0, paged:0}` => caller returns
         * {action:"continue"}; otherwise {action:"transform", text, images}.
         */
        export async function injectFiles(
          text: string,
          imagesIn: ImageContent[],
          ctx: {
            cwd: string;
            getContextUsage?: () =>
              { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
            model?: { contextWindow: number; maxTokens: number } | undefined;
          },
        ): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }> {
  - CRITICAL: both new ctx fields are OPTIONAL (?). Return type adds `paged: number`.

Task 4: EDIT ./file-injector.ts — add `, paged: 0` to the early return (L209)
  - FIND (unique):   if (count === 0) return { text, images: imagesIn, injected: 0 }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
  - REPLACE WITH:    if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
  - DO NOT change the guard (still `count === 0`). S2 changes it to `count === 0 && paged === 0`.

Task 5: EDIT ./file-injector.ts — add `, paged: 0` to the final return (L217)
  - FIND (unique):   return { text: finalText, images, injected: count };
  - REPLACE WITH:    return { text: finalText, images, injected: count, paged: 0 };

Task 6: EDIT ./file-injector.test.mjs — add formatPagedDirectiveBlock to the module-surface sanity check (after L119)
  - FIND (unique — the formatEmptyImageBlock + hasValidImageMagic asserts):
        assert(typeof mod.formatEmptyImageBlock === "function", "mod.formatEmptyImageBlock must be a function (F5)");
        assert(typeof mod.hasValidImageMagic === "function", "mod.hasValidImageMagic must be a function (F3)");
  - REPLACE WITH (insert the new assert between them, keeping format helpers grouped):
        assert(typeof mod.formatEmptyImageBlock === "function", "mod.formatEmptyImageBlock must be a function (F5)");
        assert(typeof mod.formatPagedDirectiveBlock === "function", "mod.formatPagedDirectiveBlock must be a function (§5.5 paged delivery)");
        assert(typeof mod.hasValidImageMagic === "function", "mod.hasValidImageMagic must be a function (F3)");
  - This is the ONLY test change. Do NOT add behavioral paging tests (that's S2's harness work, P1.M2).
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (new helper mirrors the existing block helpers — string concat, em-dash U+2014, JSDoc cites PRD §):
export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {
  return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first '
    + HEAD_BYTES + ' bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, '
    + 'incrementing offset until the entire file is read></file>';
}
// WHY HEAD_BYTES by name (not literal 8192): stays consistent with the head-block slice in S2
//   (formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))). WHY \u2014 not a literal —: ASCII-safe source.

// PATTERN (widened ctx — optional fields, nullable tokens inside the ContextUsage subset):
ctx: {
  cwd: string;
  getContextUsage?: () => ({ tokens: number | null; contextWindow: number; percent: number | null } | undefined);
  model?: { contextWindow: number; maxTokens: number } | undefined;
}
// WHY optional: the test mock FIX = { cwd: TMPDIR } omits both. WHY nullable tokens: ContextUsage.tokens
//   is `number | null` (e.g. right after compaction) — S2 must null-check. WHY model is a structural subset:
//   S2 reads only contextWindow + maxTokens (both REQUIRED numbers on Model, but ctx.model itself is |undefined).

// PATTERN (both returns hardcode paged: 0 — NO paged variable in S1):
if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };   // L209 — guard UNCHANGED
...
return { text: finalText, images, injected: count, paged: 0 };               // L217
// WHY no `let paged`: S1 is a pure surface widening. S2 introduces the variable, the budget, and the
//   inline-vs-paged branch; S2 also changes the L209 guard to `count === 0 && paged === 0`.
```

### Integration Points

```yaml
NO RUNTIME INTEGRATION CHANGE:
  - "Internal type/surface widening only. No new imports, no config, no API surface change, no docs (README
    is P1.M1.T2). The handler still calls injectFiles(event.text, event.images ?? [], ctx) and destructures
    {text, images, injected} — it IGNORES the new paged field until S3 makes notify mode-aware."
  - "formatPagedDirectiveBlock is exported but NOT called in S1 (S2 calls it in the page path)."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension validated by a **model-free Node ESM harness** (`file-injector.test.mjs`, 34 cases, run via `node`). The Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. The gates below are project-specific and have been **verified working on this machine in both directions** (they currently FAIL on the pre-S1 code for the new surface and will PASS after the edits; the 34-case harness is 34/34 now and must stay 34/34).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. The 5 constants exist, in order, right after TRAILING_PUNCT.
for kv in "PAGED_THRESHOLD = 0.6" "MARGIN = 8192" "HEAD_BYTES = 8192" "DEFAULT_WINDOW = 200000" "DEFAULT_RESERVE = 8192"; do
  grep -q "const $kv" file-injector.ts && echo "OK: $kv" || echo "FAIL: missing $kv"
done

# 1b. formatPagedDirectiveBlock is exported and references HEAD_BYTES + \u2014 (em dash).
grep -nE "^export function formatPagedDirectiveBlock" file-injector.ts && \
  grep -q "first ' + HEAD_BYTES + ' bytes injected above" file-injector.ts && \
  grep -q '\\u2014 estimated' file-injector.ts && echo "OK: helper shape" || echo "FAIL: helper shape"

# 1c. ctx widened (optional getContextUsage + model) AND return type has paged.
grep -q "getContextUsage?:" file-injector.ts && grep -q "model?: { contextWindow: number; maxTokens: number }" file-injector.ts \
  && grep -q "injected: number; paged: number" file-injector.ts && echo "OK: types widened" || echo "FAIL: types"

# 1d. BOTH return sites carry paged: 0; the L209 guard is UNCHANGED (still count === 0).
grep -c "paged: 0" file-injector.ts | grep -q "^2$" && echo "OK: both returns have paged: 0" || echo "FAIL: need exactly 2 'paged: 0'"
grep -q "if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }" file-injector.ts && echo "OK: guard unchanged" || echo "FAIL: guard/early-return"

# 1e. Test sanity check gained the formatPagedDirectiveBlock assert.
grep -q 'mod.formatPagedDirectiveBlock === "function"' file-injector.test.mjs && echo "OK: test sanity updated" || echo "FAIL: test sanity"

# 1f. NO paged variable / NO guard change leaked in from S2/S3 (must be absent in S1).
grep -qE "let paged|paged === 0|count === 0 && paged" file-injector.ts && echo "FAIL: S2/S3 logic leaked into S1" || echo "OK: no paged variable / no guard change"

# Expected: every line prints OK.
```

### Level 2: Regression — Existing Harness (Component Validation)

```bash
# The project's hermetic model-free gate. MUST remain 34 passed / 0 failed.
node ./file-injector.test.mjs
# Expected: "Result: 34 passed, 0 failed." and exit code 0.
# The only test change is the +1 sanity-check assert (Task 6). If ANY behavioral case fails, you
# accidentally changed runtime behavior — re-read the diff and confirm you only ADDED paged:0 and the
# helper/constants (no call to formatPagedDirectiveBlock, no branch changes).
```

### Level 3: New-Surface Verification (NO MODEL / NON-INTERACTIVE)

Run this one-off script. It exercises the real module via the same jiti+alias import pattern the harness uses, and proves: `formatPagedDirectiveBlock` is exported and emits the EXACT directive string; `injectFiles` return now carries `paged: 0` with `injected` unchanged; all 5 constants present. **Verified**: against the current pre-S1 code these checks all FAIL (helper undefined, no `paged`, constants absent); after the edits they PASS — while the baseline (`injected: 1`) holds throughout.

```bash
cat > /tmp/verify_paged_s1.mjs <<'EOF'
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const mod = await jiti.import(path.resolve("file-injector.ts"));

let ok = true;
// 1. helper exported + exact directive string (em-dash U+2014, HEAD_BYTES=8192).
const directive = mod.formatPagedDirectiveBlock("/abs/x.ts", 50000);
const expected = '<file name="/abs/x.ts"><large file \u2014 estimated 50000 bytes; first 8192 bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>';
console.log("1. directive exact match:", directive === expected);
if (directive !== expected) { ok = false; console.log("   got:", JSON.stringify(directive)); }

// 2. injectFiles return now has paged: 0; injected unchanged (whole small file still injected).
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), "paged-s1-"));
await fs.writeFile(path.join(TMP, "a.ts"), "canary\n");
const r = await mod.injectFiles("Review #@a.ts", [], { cwd: TMP });
console.log("2. paged present:", "paged" in r, "; paged value:", r.paged, "; injected:", r.injected);
if (!("paged" in r) || r.paged !== 0 || r.injected !== 1) ok = false;
fsSync.rmSync(TMP, { recursive: true, force: true });

// 3. cwd-only ctx still accepted (widened fields are optional) — structural check via a second call.
const r2 = await mod.injectFiles("Review #@a.ts", [], { cwd: TMP }); // TMP gone => injected 0, but no throw
console.log("3. cwd-only ctx accepted (no throw):", !("err" in r2));
fsSync.rmSync(TMP, { recursive: true, force: true });

// 4. all 5 constants present with exact values.
const src = fsSync.readFileSync("file-injector.ts", "utf8");
for (const [k, v] of [["PAGED_THRESHOLD","0.6"],["MARGIN","8192"],["HEAD_BYTES","8192"],["DEFAULT_WINDOW","200000"],["DEFAULT_RESERVE","8192"]]) {
  const present = src.includes(`const ${k} = ${v}`);
  console.log(`4. const ${k} = ${v}:`, present);
  if (!present) ok = false;
}
console.log(ok ? "ALL PASS" : "FAIL");
process.exit(ok ? 0 : 1);
EOF
node /tmp/verify_paged_s1.mjs
# Expected: 1=true; 2= paged present true / paged value 0 / injected 1; 3=true; 4= all true; "ALL PASS"; exit 0.
rm -f /tmp/verify_paged_s1.mjs
```

### Level 4: (none — no behavioral change to validate live)

S1 changes no runtime behavior (paged always 0, helper uncalled), so there is no live-Pi scenario to exercise. Live paged-delivery validation belongs to S2 (the actual budget + branch). Skip.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all six edit checks print OK (constants, helper shape, widened types, both `paged: 0`, guard unchanged, test sanity updated, NO S2/S3 logic leaked).
- [ ] Level 2: `node ./file-injector.test.mjs` → **34 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_paged_s1.mjs` → directive exact match; `paged` present/0 with `injected` 1; cwd-only ctx accepted; 5 constants present; "ALL PASS", exit 0.

### Feature Validation
- [ ] `formatPagedDirectiveBlock("/abs/x.ts", 50000)` returns the exact expected directive string (em-dash U+2014, `first 8192 bytes`, read-tool `offset:0, limit:2000` instruction).
- [ ] `injectFiles` on a small file returns `injected: 1, paged: 0` (behavior unchanged; new field present).
- [ ] Both return sites carry `paged: 0`; the L209 guard is still `count === 0`.
- [ ] Widened ctx fields are optional; `{ cwd }`-only ctx is still valid.

### Code Quality Validation
- [ ] Only the six specified edits to `file-injector.ts` + one assert line in the test; nothing else.
- [ ] New constants/helpers placed in their existing clusters (constants at top; format helpers grouped before injectFiles).
- [ ] Em-dash uses `\u2014` escape (ASCII-safe source), matching `formatBinaryBlock`/`formatEmptyImageBlock`.
- [ ] No `formatPagedDirectiveBlock` call added (S2 calls it); no `let paged` / guard change (S2); no handler/notify/factory-JSDoc change (S3); no README change (P1.M1.T2).

### Documentation & Deployment
- [ ] `injectFiles` JSDoc updated to describe inline-vs-paged per §5.5 and the new ctx/return fields (Mode A).
- [ ] No new env vars / config / API surface (internal type/surface widening, transparent to the user).

---

## Anti-Patterns to Avoid

- ❌ Don't make `getContextUsage` / `model` REQUIRED on the ctx type — the test mock `FIX = { cwd: TMPDIR }` omits them; they MUST be optional (`?`).
- ❌ Don't introduce a `let paged = 0` variable or change the L209 guard to `count === 0 && paged === 0` — those are S2. In S1, `paged` is a hardcoded `0` literal at both return sites.
- ❌ Don't call `formatPagedDirectiveBlock` anywhere yet — S2 wires it into the page path. Exporting it (and the test sanity-check assert) is all S1 does with it.
- ❌ Don't touch the handler notify, the factory JSDoc's "No limits" paragraph, or destructure `paged` in the handler — those are S3.
- ❌ Don't add behavioral paging tests to the harness — that's P1.M2 (S2's harness work). S1's only test change is the one module-surface sanity-check assert.
- ❌ Don't unify `MARGIN` and `DEFAULT_RESERVE` (both 8192) — independent knobs.
- ❌ Don't use a literal em-dash `—` character; use the `\u2014` escape to keep the source ASCII-safe (matches the existing helpers).
- ❌ Don't change the `injected` semantics or the existing return fields — `paged` is purely ADDITIVE; existing tests read `r.text`/`r.injected`/`r.images` by field (no whole-object equality), so adding `paged: 0` breaks nothing.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: The change is a pure type/surface widening with six precisely-anchored old→new edits (all anchors verified unique in the current file), exact constant values and helper body drawn from PRD §5.5, and a widened ctx type faithful to the VERIFIED `ContextUsage`/`Model` shapes (with `path:line` evidence). It is a strict no-behavioral-change task (`paged` hardcoded 0, helper uncalled). The validation gate has been **run on this machine in both directions**: all new-surface checks currently FAIL on pre-S1 code (proving meaningfulness) and the 34-case harness is 34/34 (and provably unaffected — no whole-object equality on the return, mock ctx stays valid because the new fields are optional). The only residual risk is a transcription slip (e.g. missing the `?` on a new ctx field, or forgetting one of the two `paged: 0` returns) — fully caught by Level 1 (1c/1d/1f) and Level 3.
