---
name: "P1.M1.T1.S2 (plan/009) — injectMarkdown: delete Step 3.5 + Step 4; emit verbatim content; update recursion"
prd_ref: "PRD §5.6 (markdown transitive imports — now 5 steps: claim → scan → emit verbatim → recurse), §6.4 (Assembly: the prompt/content is never modified), §12.16 (Never strip markers — verbatim delivery everywhere), §13.8 (why verbatim preserves re-open re-injection), §9 Algorithm (the target injectMarkdown pseudocode)"
target_file: "./file-injector.ts"   # injectMarkdown body + JSDoc ONLY (one function)
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict; S2 is the MIDDLE of S1→S2→S3 — red-in-isolation by design, green only after S3)
depends_on: "P1.M1.T1.S1 (IN FLIGHT — NOT yet landed: scanTokens → Promise<string[]>, processTokenStream → Promise<void>). S2 consumes POST-S1: after S1, injectMarkdown's `records` is typed string[] and Step 3.5/4 are the type-error cascade. S2 fixes that cascade."
consumed_by: "P1.M1.T1.S3 (injectFiles verbatim return — the LAST cascade; after S3 the file typechecks green). P1.M2.T1.S2 (migrate markdown block-content assertions — markers now present verbatim)."
---

# PRP — P1.M1.T1.S2: injectMarkdown — delete Step 3.5 + Step 4; emit verbatim content; update recursion

> ⚠️ **SCOPE & GATE — READ FIRST.** S2 is the **middle** of the 3-subtask sequence (S1 → **S2** → S3) that
> removes ALL `#@` marker stripping from the injection engine (PRD §6.4/§12.16: deliver verbatim). S2 rewrites
> **one function** — `injectMarkdown` — to delete the now-dead Step 3.5 (readability pre-check) + Step 4
> (marker-slice), emit the file's content **verbatim**, and recurse over `absPaths` (the `string[]` S1's
> scanTokens now returns). **S2 ALONE IS NOT GREEN** — after S2, `npm run typecheck` errors at EXACTLY
> `injectFiles` (the S3 cascade), nowhere else. Full green (0 errors + suites) is the S3 gate (+ M2 migrations).
> **Do NOT stop at a red typecheck** and do NOT "fix" injectFiles here (it is S3).

---

## Goal

**Feature Goal:** Make `injectMarkdown` deliver a markdown file's content **verbatim** (import markers
preserved, never stripped) per PRD §6.4/§12.16, by deleting the two steps that existed only to support
stripping (Step 3.5 readability pre-check; Step 4 marker-slice) and emitting the unmodified `content`. The
recursion is updated to iterate `absPaths: string[]` (S1's scanTokens return shape).

**Deliverable:** Modified `file-injector.ts` — the `injectMarkdown` body (delete Step 3.5 + Step 4; rename
`records`→`absPaths`; `emitText(abs, content, …)`; `for (const abs2 of absPaths)`) + its JSDoc (5-step,
"never stripped" contract). **Signature unchanged** (`async (abs, content, state, ctx) => Promise<void>`).
No other function touched.

**Success Definition:**
1. After S2: `npm run typecheck` errors are EXACTLY at `injectFiles` (the S3 cascade: `resolvedIdx` void,
   strippedText spread/sort), NOWHERE else. `injectMarkdown` itself has NO type error.
2. `injectMarkdown` body: Step 3.5 + Step 4 fully deleted; `emitText(abs, content, state)` (verbatim);
   recursion over `absPaths` (string[]) with `abs2`/`injectedSet.has(abs2)`/`injectFile(abs2, …)`.
3. The `injectMarkdown` JSDoc reflects the 5-step algorithm + the "markers detected only to resolve imports,
   NEVER stripped" contract (no Step 3.5/4/'stripped'/'injectable'/'prefixLen' language).

## Why

- **Honors the verbatim-delivery contract.** PRD §6.4/§12.16/§13.8: the prompt AND delivered file content are
  never modified. Step 4 stripped `#@` from the markdown's own block content — but the bytes live in the custom
  message (§6.2), so stripping the marker served no purpose (it was an honest reference) and added complexity
  (the Step 3.5 readability pre-check existed ONLY to decide which markers to strip). Deleting both is strictly
  simpler and correct.
- **Consumes S1's simplified scanTokens.** S1 narrowed scanTokens to `Promise<string[]>` (no index/prefixLen).
  Step 3.5/4 consumed `.index`/`.prefixLen`/`.abs` — dead bookkeeping once stripping is gone. S2 removes the
  cascade type-errors S1 deliberately left at injectMarkdown.
- **Sequence ordering.** S1 (return shapes) → S2 (injectMarkdown caller) → S3 (injectFiles caller). S2 cannot
  be green in isolation (injectFiles is still red); the agent proceeds to S3 after S2.

## What

### User-visible behavior (lands fully after S3 + M2)

After the full sequence, a delivered markdown file's `<file>` block contains its content **exactly as read from
disk** — import markers (`#@api.md`) stay in place as honest references, never stripped. (Today they're sliced
out.) The model receives the same bytes; the only difference is cosmetic (the markers remain in the block text).

### Technical behavior (the contract)

- `injectMarkdown` keeps Step 2 (claim self) + Step 3 (scan → `absPaths: string[]`). It DELETES Step 3.5 + 4.
- Step 4 (was 5): `emitText(abs, content, state)` — paged decision on VERBATIM content.
- Step 5 (was 6): `for (const abs2 of absPaths) { if (injectedSet.has(abs2)) continue; await injectFile(abs2, …); }`.
- Dedup, pre-order emission, and the belt-and-suspenders `injectedSet` re-check are UNCHANGED.

### Success Criteria

- [ ] `injectMarkdown` body has NO Step 3.5 (no `injectable` array, no stat/fs.access pre-check loop) and NO Step 4 (no `stripped`, no slice loop).
- [ ] `const absPaths = await scanTokens(...)` (renamed from `records`).
- [ ] `emitText(abs, content, state)` (verbatim — was `emitText(abs, stripped, state)`).
- [ ] Recursion: `for (const abs2 of absPaths)` + `injectedSet.has(abs2)` + `injectFile(abs2, state, ctx)`.
- [ ] JSDoc: 5-step; "never stripped" contract; no Step 3.5/4/'stripped'/'injectable'/'prefixLen' language.
- [ ] After S2: typecheck errors ONLY at `injectFiles`; `injectMarkdown` clean.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current `injectMarkdown` body + JSDoc (verified against the working tree), the verbatim oldText→newText
for the body (one contiguous replacement), the target JSDoc text, the POST-S1 starting state (scanTokens→string[]),
the deferred-green gate (errors only at injectFiles), and the S3 scope boundary. The implementer edits one
function body + its JSDoc, then confirms the typecheck cascade narrowed to injectFiles.

### Documentation & References

```yaml
# MUST READ — the contract: S1's shapes + the S2/S3 cascade contract
- file: plan/009_0d85ac0b1b08/P1M1T1S1/PRP.md
  why: "S1 = scanTokens→Promise<string[]>, processTokenStream→Promise<void> (IN FLIGHT, not yet landed). S1's
        CASCADE CONTRACT section specifies EXACTLY what S2 does: 'L1105 records→absPaths; DELETE Step 3.5
        (injectable filter); DELETE Step 4 (strip loop); Step 4 becomes emitText(abs, content, state);
        Step 5 iterate absPaths → for (const abs2 of absPaths) {…}'. S1 explicitly leaves injectMarkdown red."
  critical: "S2 consumes POST-S1. After S1, `records` is typed string[] (TS infers), so Step 3.5's r.abs/r.index/
             r.prefixLen + Step 4's slice are type errors — the cascade S2 fixes. Do NOT edit scanTokens/processTokenStream
             (S1 owns them) or injectFiles (S3 owns it)."

# MUST READ — the verbatim-delivery contract (WHY Step 3.5 + 4 are deleted)
- file: PRD.md
  why: "§6.4 (Assembly: 'The prompt is never modified' — and by §12.16, delivered content neither); §12.16
        ('Never strip markers — verbatim delivery everywhere'); §13.8 (stripping breaks cancel/fork/re-open
        re-injection). Step 4 stripped markers from the markdown's OWN block — serving no purpose now the bytes
        live in the custom message. Step 3.5 existed only to gate that stripping."
  section: "### 6.4 + #### 12.16 + ### 13.8"

# MUST READ — the target injectMarkdown shape (the authoritative 5-step pseudocode)
- file: PRD.md
  why: "§9 Algorithm shows the TARGET injectMarkdown: claim self → scanTokens→absPaths → emitText(abs, content)
        → for (const abs2 of absPaths) recurse. That IS the S2 spec."
  section: "## 9 Algorithm (injectMarkdown)"

# The file you edit (ONE function body + its JSDoc)
- file: file-injector.ts
  why: "injectMarkdown body (the Step 2→6 region) + its JSDoc (the 'six-step algorithm' comment block). Line
        numbers SHIFT after S1 lands (S1 rewrites scanTokens/processTokenStream above injectMarkdown) — place
        by IDENTIFIER: the `async function injectMarkdown(abs, content, state, ctx)` signature + the
        'Step 3.5'/'Step 4'/'injectable'/'stripped' landmarks. The body text is identical pre/post-S1."
  pattern: "The body is a contiguous run: scanTokens call → Step 3.5 comment+loop → Step 4 comment+loop →
            Step 5 emit → Step 6 recurse. S2 replaces that whole run with the 5-step verbatim version."
  gotcha: "S2 is RED-in-isolation (injectFiles cascade). The gate is 'errors ONLY at injectFiles', NOT '0 errors'.
           Do NOT run the .mjs suites as an S2 gate — with injectFiles still red, the runtime cascade crashes them."

# typecheck gate (deferred green — the cascade-shape check)
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. After S2: errors at injectFiles ONLY (resolvedIdx void; strippedText
        spread/sort). injectMarkdown itself clean. Full 0-errors is the S3 gate."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectMarkdown body: delete Step 3.5+4, verbatim emit, absPaths recurse; + JSDoc)
├── file-injector.test.mjs    # NOT edited (green only after S3 + M2; red now)
├── relative-imports.test.mjs # NOT edited
├── import-behavior.test.mjs  # NOT edited
├── scripts/typecheck.mjs     # untouched (the cascade-shape gate)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{stripping_logic_analysis.md, test_assertions_analysis.md, system_context.md, readme_analysis.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (IN FLIGHT): scanTokens→string[], processTokenStream→void
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectMarkdown body (delete Step 3.5 + Step 4; records→absPaths;
                          #                  emitText(abs, content, state); for (const abs2 of absPaths) recurse)
                          #                  + injectMarkdown JSDoc (5-step, "never stripped").
# No other files. No test changes. No new exports/imports. Signature unchanged.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — S2 IS RED-IN-ISOLATION BY DESIGN. S1 (in flight) leaves injectMarkdown + injectFiles red; S2 fixes
//   injectMarkdown; injectFiles stays red until S3. The S2 gate is "typecheck errors ONLY at injectFiles" — NOT
//   "0 errors". Do NOT stop at a red typecheck; do NOT "fix" injectFiles (S3). Proceed S1→S2→S3.

// CRITICAL — DELETE Step 3.5 AND Step 4 ENTIRELY (comment + code). Step 3.5 = the `injectable` array + the
//   stat/fs.access(R_OK) loop (~34 lines incl. comment); Step 4 = `let stripped = content` + the slice loop
//   (~9 lines incl. comment). Leaving ANY reference to `injectable`/`stripped`/`r.abs`/`r.index`/`r.prefixLen`
//   behind = a type error (records is now string[]) or a dangling variable. The body replacement (Edit 1) is
//   one contiguous oldText→newText to guarantee completeness.

// CRITICAL — `records` is typed `string[]` AFTER S1 (TS infers from scanTokens' new return type). The Step 3.5
//   loop `for (const r of records)` would bind `r: string`, so `r.abs`/`r.index`/`r.prefixLen` are the cascade
//   type errors. S2 renames to `absPaths` (cosmetic clarity) and the recursion binds `abs2: string` (clean).

// CRITICAL — `emitText(abs, content, state)` runs the paged decision on the VERBATIM content (markers present).
//   This slightly increases the budget estimate (the marker chars are counted) — acceptable per §6.4 ("negligible").
//   Do NOT try to "subtract the marker chars" — verbatim means verbatim.

// GOTCHA — the scanTokens(...) call args are UNCHANGED: { allowAbsTilde: false, skipCode: true, tryMdExt: true,
//   bareAt: state.bareAt }. S1 made bareAt optional; passing `state.bareAt` (a boolean) is fine. Only the
//   LEFT-HAND binding changes (records → absPaths).

// GOTCHA — Step numbers shift: old Step 5 (emit) → new Step 4; old Step 6 (recurse) → new Step 5. The PRD §5.6
//   Step 1 (read/decode) is in injectFile, not injectMarkdown; injectMarkdown does Steps 2-5. Match PRD §9's
//   numbering (Step 4 = emit, Step 5 = recurse) in both code comments and JSDoc.

// GOTCHA — line numbers in the item description (L1094-1159, L1040-1093) are the CURRENT pre-S1 numbers; S1's
//   scanTokens/processTokenStream rewrite shifts them. Place by IDENTIFIER (the function signature + the
//   'Step 3.5'/'Step 4'/'injectable'/'stripped' landmarks), using the exact text in Edit 1 — not raw lines.

// LIBRARY — TypeScript via jiti (no build step). typecheck uses tsc --strict. No new imports/exports (injectMarkdown
//   stays private; the `fs`/`path` it used for Step 3.5 are still imported but now unused by injectMarkdown —
//   they remain used elsewhere, so do NOT remove the imports).
```

## Implementation Blueprint

### Edit 1 — the BODY (one contiguous oldText → newText)

Locate by the `const records = await scanTokens(...)` line + the `Step 3.5`/`Step 4`/`Step 5`/`Step 6` comments.
Replace the entire run from the scanTokens call through the closing `}` of Step 6's for-loop.

**oldText** (current — the scanTokens call → Step 3.5 → Step 4 → Step 5 → Step 6):
```ts
  const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 3.5 — READABILITY PRE-CHECK (PRD §5.4 / §10 / §12.5). scanTokens records a token as soon as it
  // RESOLVES (it does NOT stat), so a markdown import resolving to a MISSING file, DIRECTORY, or a file
  // that EXISTS but is UNREADABLE would otherwise have its '#@' marker stripped (Step 4) even though
  // injectFile later returns false and nothing is injected for it. PRD §5.4/§12.5/§10 require such markers
  // be left VERBATIM. Pre-order (§5.6 step 6) emits THIS file's block BEFORE recursing, so the strip
  // decision must be made NOW (the top-level path can inject-then-strip because the user prompt is not a
  // pre-order block; the markdown path cannot). Stat each import; keep only those that stat-succeed AND are
  // regular files (isFile also rejects directories, matching injectFile's own check and §5.4: directory →
  // verbatim), AND additionally gate on readability via fs.access(R_OK) so a marker is stripped ONLY when
  // delivery will truly succeed for the text/markdown/binary case that dominates (PRD §5.4/§12.5: on any
  // error leave the token verbatim). injectFile re-stats harmlessly on recursion.
  // ACCEPTED NARROW RESIDUAL: the R_OK gate predicts readability, NOT resize success — a READABLE image
  // whose resizeImage THROWS (rather than returning null) still gets stripped, because we cannot predict
  // a resize failure without running the resize (expensive, duplicative). That is out of scope here; the
  // full closure is the structural "strip only markers whose injectFile returned true" approach (PRD calls
  // it "more invasive"). It is backstopped by injectFile's own try/catch (no crash, no block appended).
  // TOCTOU: a file could become unreadable between this access and injectFile's readFile, but that races
  // the top-level path too and is acceptable (injectFile's readFile try/catch is the final safety net).
  // TYPE-ONLY widening: records carry prefixLen (scanTokens P1.M1.T1.S1); widening the declared element type
  // lets Step 4 read r.prefixLen. The filter body (injectable.push(r)) forwards the WHOLE record unchanged —
  // do NOT build a new object literal here (that would DROP prefixLen, the codebase_delta §8.2 anti-pattern).
  // No new import: fs.constants.R_OK (=== 4) is reachable via the existing `import { promises as fs }`.
  const injectable: { index: number; prefixLen: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (!st.isFile()) continue; // directory/socket/etc → verbatim (§5.4) — unchanged
      await fs.access(r.abs, fs.constants.R_OK); // gate strip on READABILITY (PRD §5.4 / §12.5)
      injectable.push(r);
    } catch {
      /* missing / directory / unreadable → leave verbatim (not stripped, not injected) */
    }
  }

  // Step 4 — strip the marker from each INJECTABLE import (high→low so earlier offsets stay valid), leaving
  // the path. `stripped` becomes THIS file's block content. Missing/dir imports keep the marker verbatim.
  // §4.6 — strip by the marker's width: prefixLen 2 for `#@` (r.index is the '#'), 1 for bare `@` (r.index is
  // the '@'); both regexes' lookbehinds are zero-width, so r.index is always the marker's first char.
  let stripped = content;
  for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);
  }

  // Step 5 — emit THIS file's block. The paged decision runs on the STRIPPED content (§5.6 step 5).
  emitText(abs, stripped, state); // emitText owns formatTextBlock + subtract + the paged head/directive + state.paged++

  // Step 6 — recurse into INJECTABLE imports, depth-first, ENCOUNTER ORDER (pre-order). Missing/dir imports
  // are absent here (they would no-op in injectFile anyway). The injectedSet re-check is belt-and-suspenders
  // (cross-subtree dedup since the scan).
  for (const r of injectable) {
    if (state.injectedSet.has(r.abs)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(r.abs, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
```

**newText** (PRD §9 target — 5-step verbatim):
```ts
  const absPaths = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 4 — emit THIS file's block. The paged decision runs on the VERBATIM content (import markers are NOT
  // stripped — §6.4/§12.16: the file is delivered exactly as read from disk). emitText owns formatTextFileBlock
  // + subtract + the paged head/directive + state.paged++.
  emitText(abs, content, state);

  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const abs2 of absPaths) {
    if (state.injectedSet.has(abs2)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(abs2, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
```

> **Why one contiguous replacement:** Step 3.5 + Step 4 are interleaved with the emit (Step 5) and recurse
> (Step 6) they gate. A single oldText→newText guarantees NO dangling `injectable`/`stripped`/`r.abs`/`r.index`
> reference survives (any survivor is a type error or a `ReferenceError`).

### Edit 2 — the JSDoc (replace the whole comment block)

Replace the entire `/** PRD §5.6 — markdown transitive imports (the six-step algorithm)… */` block (the one
immediately above `async function injectMarkdown(...)`) with:

```ts
/**
 * PRD §5.6 — markdown transitive imports (the five-step algorithm). Called by injectFile's markdown branch
 * (a delivered .md/.markdown is an import source). Recursion contract:
 *   • RELATIVE-ONLY (§4.5 rule 1): imports starting with / or ~ are ignored (left verbatim) — only relative
 *     tokens resolve. (Contrast: top-level user tokens allow / and ~.)
 *   • CODE-EXEMPT (§5.6.1 / §4.5 rule 3): a #@ inside a fenced block or inline code span is NOT an import
 *     — left verbatim, never stripped. (Detection is approximate-CommonMark, reused from scanTokens.)
 *   • DEDUP-BOUNDED, NOT depth-limited (§12.13): each abs is claimed in state.injectedSet BEFORE its scan,
 *     so a self-import or cycle (a.md→b.md→a.md) dedups to verbatim and cannot recurse infinitely. The set
 *     of injectable files is finite and each is processed at most once — termination is guaranteed without
 *     a depth counter.
 *   • PRE-ORDER depth-first: this file's block is emitted (Step 4) BEFORE recursing into imports (Step 5),
 *     so the model sees a parent's context before the detail it pulls in.
 *   • VERBATIM DELIVERY (§6.4/§12.16): markers are detected here ONLY to resolve imports — they are NEVER
 *     stripped from the delivered content. The block is emitted on the verbatim `content` exactly as read
 *     from disk (import markers stay as honest references; the bytes also live in the custom message, §6.2).
 *
 * Five steps (PRD §5.6; Step 1 read/decode is in injectFile):
 *   2. Claim self (idempotent: injectFile pre-claimed abs; included for contract self-containedness).
 *   3. scanTokens(content, dirname(abs), { allowAbsTilde:false, skipCode:true, tryMdExt:true, bareAt:state.bareAt })
 *      → absPaths: string[] (resolved import paths in encounter order). §4.6 markdown-only bare-@ opt-in:
 *      passes bareAt: state.bareAt (the seam created in injectFiles — derived from cfg.markdownBareAtImports).
 *   4. emitText(abs, content, state) — the paged decision runs on the VERBATIM content (§6.4: markers NOT
 *      stripped). emitText owns the subtract + paged bump (NOT count).
 *   5. Recurse into absPaths in ENCOUNTER order: if not already claimed, await injectFile(abs) (which claims,
 *      classifies, bumps count, and recurses again if the import is itself markdown).
 *
 * PRIVATE — exercised indirectly via injectFiles (PRD §11 cases 15-19 + 20/MD1/MD2). Does NOT bump count
 * (injectFile owns the single count++ per claimed file; imports bump count in their own injectFile).
 *
 * @param abs     the importing markdown's absolute path (already claimed by injectFile; resolution base = dirname)
 * @param content the markdown's decoded UTF-8 content (buf.toString("utf8") from injectFile) — delivered VERBATIM
 * @param state   the shared State (blocks/images/injectedSet/remaining/count/paged) threaded across the prompt
 * @param ctx     threaded to the recursive injectFile calls (cwd unused — imports resolve from dirname(abs))
 */
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — injectMarkdown ONLY):
  - body: replace the scanTokens-call → Step 6 run with the 5-step verbatim version (Edit 1). Net: records→absPaths;
          DELETE Step 3.5 (injectable + stat/fs.access loop) + Step 4 (stripped + slice loop); emitText(abs, content, state);
          for (const abs2 of absPaths) { injectedSet.has(abs2); injectFile(abs2, …) }.
  - JSDoc: replace the whole comment block with the 5-step "never stripped" version (Edit 2).
  - UNCHANGED: the signature; Step 2 (claim self); dir = path.dirname(abs); the scanTokens(...) call args;
          emitText; injectFile; scanTokens; processTokenStream; injectFiles (S3); every helper.

NO_CHANGES: the three .mjs suites, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports (injectMarkdown stays private). NO new imports (fs/path remain used elsewhere; Step 3.5 no longer
uses fs.stat/fs.access inside injectMarkdown, but those are still used by injectFile/isRegularFile — do NOT remove imports).
```

### Implementation Tasks (ordered — the S2 portion of the one-pass S1→S2→S3)

```yaml
Task 1: REPLACE the injectMarkdown body (Edit 1)
  - LOCATE by the `const records = await scanTokens(...)` line + the Step 3.5/4/5/6 comments (line numbers shift
    after S1; use the text in Edit 1's oldText).
  - REPLACE the whole run (scanTokens call → Step 6 for-loop close) with the 5-step verbatim version (Edit 1 newText).
  - VERIFY no `records`/`injectable`/`stripped`/`r.abs`/`r.index`/`r.prefixLen` token remains in injectMarkdown.

Task 2: REPLACE the injectMarkdown JSDoc (Edit 2)
  - REPLACE the whole `/** PRD §5.6 — markdown transitive imports (the six-step algorithm)… */` block with the
    5-step "never stripped" version (Edit 2 text).
  - VERIFY no 'Step 3.5'/'Step 4 strip'/'stripped'/'injectable'/'prefixLen'/'readability pre-check' language remains.

Task 3: CASCADE CHECK (the S2 gate — NOT green)
  - npm run typecheck → EXPECT errors at injectFiles ONLY (resolvedIdx void; strippedText spread/sort).
  - Confirm: NO error inside injectMarkdown itself (if there is, Edit 1 left a dangling reference — re-check).
  - This is the S2 gate. Then PROCEED to S3 (injectFiles verbatim return) in the same pass.

Task 4 (after S3): GREEN GATE
  - npm run typecheck → 0 errors (the S3 gate).
  - The .mjs suites: cases asserting STRIPPED markdown-block content will FAIL (markers now present) — migrated in M2.
```

## Validation Loop

### Level 1: Typecheck — the S2 cascade gate (RED at injectFiles is expected)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# AFTER S2: EXPECT errors at EXACTLY injectFiles (the S3 cascade):
#   - `resolvedIdx` is now void (processTokenStream → Promise<void> after S1) but injectFiles spreads/sorts it.
# Confirm: NO error inside injectMarkdown (its body/JSDoc are clean after Edit 1+2), and NO error anywhere else.
# This RED-at-injectFiles is the S2 gate. Do NOT fix injectFiles here — proceed to S3.
```

### Level 2: Structural verification (the 2 edits landed)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] records renamed:";            grep -c "const absPaths = await scanTokens(content, dir" file-injector.ts   # expect 1
echo "[2] Step 3.5 gone:";              grep -c "Step 3.5\|injectable:" file-injector.ts                            # expect 0
echo "[3] Step 4 strip gone:";          grep -c "let stripped = content\|stripped.slice" file-injector.ts           # expect 0
echo "[4] verbatim emit:";              grep -c "emitText(abs, content, state)" file-injector.ts                    # expect 1
echo "[5] absPaths recursion:";         grep -c "for (const abs2 of absPaths)" file-injector.ts                     # expect 1
echo "[6] JSDoc 5-step + never-stripped:"; grep -c "five-step algorithm\|NEVER stripped from the delivered content" file-injector.ts  # expect ≥1
echo "[7] no stale refs in injectMarkdown:"; sed -n '/async function injectMarkdown/,/^}/p' file-injector.ts | grep -cE "records|injectable|stripped|r\.abs|r\.index|r\.prefixLen"  # expect 0
# Expected counts: 1,0,0,1,1,≥1,0. If [7] is non-zero, Edit 1 left a dangling reference (a type error).
```

### Level 3: Suite gate (after S1→S2→S3; test migrations are M2)

```bash
# Only meaningful after S3 (green typecheck). Do NOT run as an S2-alone gate — injectFiles is still red, so the
# runtime cascade crashes the suites. After S3, cases asserting STRIPPED markdown-block content (e.g. a case
# asserting the block has "Imports api.md here." with the #@ removed) will FAIL — those are migrated in M2.T1.S2.
```

### Level 4: N/A (no display/runtime validation for an internal body rewrite in isolation)

```bash
# injectMarkdown's verbatim behavior is observable only end-to-end (the delivered <file> block content), which
# requires the green gate (S3) + the M2 test migrations. The S2-internal checks are Level 1 (cascade shape) +
# Level 2 (structural grep).
```

## Final Validation Checklist

### Technical Validation (S2-specific)

- [ ] After S2: `npm run typecheck` errors ONLY at `injectFiles`; `injectMarkdown` itself clean.
- [ ] Structural grep (Level 2): records→absPaths (1); Step 3.5/injectable (0); stripped/slice (0); `emitText(abs, content, state)` (1); `for (const abs2 of absPaths)` (1); no stale refs in injectMarkdown (0).

### Feature Validation (the contract)

- [ ] `injectMarkdown` body: Step 3.5 (injectable + stat/fs.access loop) DELETED; Step 4 (stripped + slice loop) DELETED.
- [ ] `emitText(abs, content, state)` — verbatim content (was `emitText(abs, stripped, state)`).
- [ ] Recursion: `for (const abs2 of absPaths)` + `injectedSet.has(abs2)` + `injectFile(abs2, state, ctx)`.
- [ ] JSDoc: 5-step; "never stripped from the delivered content" contract; no Step 3.5/4/'stripped'/'injectable'/'prefixLen' language.

### Cascade Discipline

- [ ] `scanTokens`/`processTokenStream` NOT edited by S2 (S1 owns them); `injectFiles` NOT edited by S2 (S3 owns it).
- [ ] The agent proceeds S1 → S2 → S3 in one pass (the file is red between them).
- [ ] After S3: `npm run typecheck` → 0 errors (the green gate).

### Code Quality Validation

- [ ] `injectMarkdown` signature unchanged (`async (abs, content, state, ctx) => Promise<void>`).
- [ ] Step 2 (claim self), `dir = path.dirname(abs)`, the scanTokens call args, dedup, pre-order emission — all UNCHANGED.
- [ ] No new imports/exports (injectMarkdown stays private; fs/path still used elsewhere — not removed).

### Documentation

- [ ] injectMarkdown JSDoc reflects the 5-step algorithm + the verbatim-delivery contract (Mode A).
- [ ] No README/user-facing change in S2 (the README verbatim sync is M2.T4).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT expect S2 to typecheck green.** S2 fixes injectMarkdown but injectFiles is still red (S3). The S2
  gate is "errors ONLY at injectFiles." Claiming "0 errors after S2" is false and hides the S3 cascade.
- ❌ **Do NOT fix injectFiles here.** The `resolvedIdx`/`strippedText` deletion + verbatim return is S3. Editing
  it in S2 is scope creep and steals S3's work. Proceed to S3 after S2.
- ❌ **Do NOT leave a partial Step 3.5/4.** DELETE both entirely (comment + code). Leaving any `injectable`/
  `stripped`/`r.abs`/`r.index`/`r.prefixLen` reference = a type error (records is string[]) or a `ReferenceError`.
  The single contiguous oldText→newText (Edit 1) guarantees completeness.
- ❌ **Do NOT change the scanTokens(...) call args.** Only the LEFT-HAND binding changes (`records`→`absPaths`).
  `bareAt: state.bareAt` stays (S1 made bareAt optional; passing a boolean is fine).
- ❌ **Do NOT subtract marker chars from the budget.** `emitText(abs, content, state)` runs on VERBATIM content;
  the marker chars are counted (negligible per §6.4). Verbatim means verbatim — don't try to be clever.
- ❌ **Do NOT edit scanTokens/processTokenStream (S1) or emitText/injectFile.** S2 touches ONLY injectMarkdown
  (body + JSDoc). emitText already takes `(abs, content, state)` — it needs no change (it receives verbatim content).
- ❌ **Do NOT run the .mjs suites as an S2-alone gate.** With injectFiles still red, the runtime cascade
  (spreading void) crashes them. The suites are meaningful only after the green gate (S3) + M2 migrations.
- ❌ **Do NOT remove the `fs`/`path` imports.** Step 3.5 no longer uses `fs.stat`/`fs.access` inside injectMarkdown,
  but those are still used by injectFile/isRegularFile/resolveImportPath elsewhere. The imports stay.
- ❌ **Do NOT trust the item's line numbers** (L1094-1159, L1040-1093 are pre-S1; S1 shifts them). Place by
  IDENTIFIER — the `async function injectMarkdown(...)` signature + the Step 3.5/4/5/6 comment landmarks — using
  Edit 1's exact oldText.

---

## Confidence Score: 9/10

A well-scoped deletion + verbatim-emit rewrite of ONE function, with the exact contiguous oldText→newText
(verified against the current source) and the PRD §9 target as the authoritative shape. The -1 reserves for
the deferred-green discipline (S2 is red-in-isolation by design — the agent must continue to S3 without
stopping or "fixing" injectFiles prematurely) and the JSDoc rewrite precision (a large comment block; the
target text is given verbatim to avoid leaving any Step 3.5/4/'stripped' reference behind). One function body +
one JSDoc; the implementing agent re-runs typecheck to confirm the cascade narrowed to injectFiles.