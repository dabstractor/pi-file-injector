---
name: "P1.M1.T1.S2 — Extract scanTokens / processTokenStream / injectFile / emitText (recursion-ready)"
prd_ref: "PRD §9 (Algorithm pseudocode: scanTokens/processTokenStream/injectFile/emitText), §5.1-§5.5, §6.2, §12.11/§12.13/§12.17"
target_file: "./file-injector.ts"   # EDIT IN PLACE — T1.S1 already restructured injectFiles around shared State
target_language: TypeScript (jiti transpile-on-load; no tsconfig/lint/test-framework — the .mjs harness IS the gate)
depends_on: "P1.M1.T1.S1 (provides interface State, function subtract, consolidated state.injectedSet, and the linear matchAll loop using state.* that THIS subtask extracts into helpers)"
consumed_by: "P1.M1.T2.S1 (computeCodeRanges/inCode fill the scanTokens skipCode stub; isAbsoluteOrTilde reused not re-declared), P1.M1.T2.S3 (injectMarkdown recurses via injectFile; injectFile's markdown branch added), P1.M1.T2.S2 (image/binary/empty-image subtract calls added to injectFile)"
---

# PRP — P1.M1.T1.S2: Extract scanTokens / processTokenStream / injectFile / emitText (recursion-ready)

> **Scope flag:** This is a **pure structural refactor.** Behavior MUST be byte-for-byte identical.
> The regression gate is the existing 52-test suite passing **unchanged** (`52 passed, 0 failed`).
> No markdown, no recursion, no new behavior — only the linear matchAll loop is split into four
> module-level helpers so `injectFile` can later recurse (T2). Budget stays **text-only** (T2.S2 adds
> image/binary subtract). The ONE non-source edit allowed is appending 4 asserts to the test sanity list.

---

## Goal

**Feature Goal:** Extract four module-level helpers from the POST-T1.S1 linear `injectFiles` loop —
`scanTokens`, `processTokenStream`, `injectFile`, `emitText` — plus the tiny pure `isAbsoluteOrTilde`
guard, and rewire `injectFiles` to be a thin wrapper that calls `processTokenStream`. The internals
become **recursion-ready** (PRD §9 shape) with **zero observable behavior change**.

**Deliverable:** A modified `./file-injector.ts` (in-place edit) where:
1. `scanTokens(text, baseDir, opts, state): { index; abs }[]` — scan-only (no I/O), per-text `localSeen`
   + global `state.injectedSet` dedup; `opts.skipCode` accepted as a **stub no-op** (T2.S1 fills it in);
   `opts.allowAbsTilde` gates `isAbsoluteOrTilde`.
2. `async processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]>` — scan once → re-check
   `state.injectedSet` → `await injectFile(...)` per record → return resolved marker indices (private).
3. `async injectFile(abs, state, ctx): Promise<boolean>` — stat → **CLAIM `abs`** → read → classify
   (F5 → F3 image → binary → emitText, **no markdown branch yet**) → `state.count++`; never throws.
4. `emitText(abs, content, state)` — the inline-vs-paged text decision **lifted verbatim** (whole / sub-head
   guard / head+directive), calling `subtract` exactly where T1.S1 did.
5. `isAbsoluteOrTilde(p): boolean` — `p.startsWith("/") || p.startsWith("~")` (pure; owned here, reused by T2.S1).
6. `injectFiles` becomes a thin wrapper: build budget → build `State` → `await processTokenStream(...)` →
   `count===0`→original refs → strip `#@` high→low over `resolvedIdx` → assemble `finalText` → return.
7. **Export** `scanTokens`, `injectFile`, `emitText`, `isAbsoluteOrTilde`; keep `processTokenStream` and
   `subtract` private. Append 4 asserts to the test sanity list (L113–121).

**Success Definition:** `node ./file-injector.test.mjs` prints **`52 passed, 0 failed.`** The external
signature `injectFiles(text, imagesIn, ctx)` → `Promise<{ text; images; injected; paged }>` and its return
shape are UNCHANGED. Internals are now recursion-ready: `processTokenStream` calls `injectFile`, which
T2.S3 will extend to recurse into markdown imports.

## Why

- **Structural prerequisite for recursion (the whole point of M1.T1).** Markdown transitive imports
  (PRD §5.6, delivered in T2) require `injectFile` → `injectMarkdown` → `injectFile` recursion threading
  one shared `State`. The linear `for (const m of text.matchAll(...))` loop in `injectFiles` cannot express
  "inject this file's imports before the next sibling." Extracting `scanTokens` (scan-only) + `injectFile`
  (per-file classify/emit) is the seam that makes recursion possible — landed green, with no feature change.
- **Scan-before-inject gives cross-subtree dedup (PRD §12.17).** `processTokenStream` runs `scanTokens` over
  the whole prompt *before* injecting, so a later top-level token whose path an earlier import claimed is
  left verbatim. This property is inert at top level today (no recursion) but is the exact shape T2 needs.
- **Isolates structure from feature.** T1.S1 introduced shared `State` (green). T1.S2 extracts helpers
  (green). T2 adds markdown + total-size budget on top of a now-recursion-ready core. Each slice lands green.

## What

User-visible behavior: **identical** (internal refactor). The `#@` extension behaves exactly as it does
today after T1.S1. Concretely:

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → **52 passed, 0 failed** (identical to the POST-T1.S1 baseline).
- [ ] `scanTokens(text, baseDir, { allowAbsTilde; skipCode }, state): { index: number; abs: string }[]`
      exists, is `export`ed, does NO I/O, and for each `FILE_INJECT_RE` match: cleans token → empty-skip →
      (`!allowAbsTilde && isAbsoluteOrTilde` skip) → resolve → (`injectedSet.has || localSeen.has` skip) →
      `localSeen.add` → push `{ index: m.index, abs }`. `skipCode` is a **stub no-op** (comment placeholder
      for T2.S1; do NOT reference `computeCodeRanges`/`inCode`).
- [ ] `async processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]>` exists (PRIVATE),
      calls `scanTokens` once, then per record: `if (state.injectedSet.has(r.abs)) continue; const ok = await injectFile(r.abs, state, ctx); if (ok) resolved.push(r.index);` → returns `resolved`.
- [ ] `async injectFile(abs, state, ctx): Promise<boolean>` exists, is `export`ed, and: `try{st=stat}catch{return false}`;
      `if(!st.isFile())return false`; **`state.injectedSet.add(abs)` (CLAIM, before read)**; `try{buf=readFile; classify; state.count++; return true}catch{return false}`.
      Classification order = **F5 empty-image → F3 image (`hasValidImageMagic`) → `isBinary` → `emitText`** (else-if chain; NO markdown branch).
- [ ] `emitText(abs, content, state)` exists, is `export`ed, and lifts the current text decision VERBATIM:
      whole if `remaining===null || fileCost<=PAGED_THRESHOLD*remaining` (`subtract(state,fileCost)`); else
      sub-head guard (`content.length<=HEAD_CHARS` → whole, NO subtract); else head+directive+`state.paged++`+`subtract(state,Math.ceil(HEAD_CHARS/4))`. Does NOT bump `count`.
- [ ] `isAbsoluteOrTilde(p): boolean` exists, is `export`ed, returns `p.startsWith("/") || p.startsWith("~")`.
- [ ] `injectFiles` contains NO inline `for (const m of text.matchAll(FILE_INJECT_RE))` loop and NO local
      `injectedIndexes`; it calls `processTokenStream(...)` and strips `#@` over the returned `resolvedIdx`.
      Budget computation, `priorPaths` seeding, `State` initializer, the `count===0`→**original `imagesIn` ref**
      early return, and the `\n\n---\n\n` assembly are all UNCHANGED from T1.S1.
- [ ] `subtract` is still called EXACTLY twice in the text path (both now inside `emitText`); image/binary/
      empty-image branches in `injectFile` do NOT call `subtract` (that's T2.S2).
- [ ] `injectFiles` external signature + return shape `{ text, images, injected, paged }` UNCHANGED.
- [ ] Test sanity list (L113–121) has exactly 4 new asserts appended (`scanTokens`, `injectFile`, `emitText`,
      `isAbsoluteOrTilde`); the original 9 asserts are untouched; NO other test-harness line changes.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes the POST-T1.S1 starting-state contract, the exact helper
signatures + bodies, the scan-then-inject ≡ linear-loop equivalence proof, the deliberate early-claim
note, the verbatim `emitText` lift, the T2.S1 coordination boundary, and the verified validation command.
The implementer edits one source file + appends 4 lines to the test sanity list, then runs one command.

### Documentation & References

```yaml
# MUST READ — the contract for THIS subtask (extracts the four helpers from T1.S1's loop)
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "§MI-1 'Refactor contract' + 'Extract helpers' bullet list — pins each helper's signature,
        the MI-1 classification branch order (F5→F3→binary→text, NO markdown), the skipCode no-op stub,
        the scan-once-then-inject depth-first shape, and the MI-1 behavior-preservation checklist."
  section: "## MI-1 — Refactor injectFiles into shared State + recursive helpers (no behavior change)"
  critical: "Lines cited are commit landmarks (will shift as T1.S1 lands). Use IDENTIFIER names, not line
             numbers. The MI-1 classification order PRESERVES F3/F5 — it does NOT match the simpler PRD §9
             pseudocode (which omits the gates); the item description reconciles by saying 'preserve F3/F5'."

# MUST READ — the target shapes (final-form pseudocode for all four helpers)
- file: PRD.md
  why: "§9 shows scanTokens/processTokenStream/injectFile/emitText exactly; §12.17 (scan-before-inject),
        §12.13 (recursion bounded by dedup — why injectFile CLAIMS before read), §6.2 (Assembly: strip #@,
        append blocks), §5.5 (the inline-vs-paged math emitText lifts)."
  section: "## 9. Algorithm (pseudocode)"
  critical: "PRD §9's injectFile cascade is SIMPLER than shipped (no F5/F3 inline). OVERRIDE per item
             description: classify F5→F3 image→binary→emitText. PRD §9 ctx is typed `any`; you may use a
             shared `type Ctx` alias or inline — jiti does not type-check, so either compiles."

# MUST READ — the starting state this subtask consumes (POST-T1.S1)
- file: plan/003_4624515bcd82/P1M1T1S1/PRP.md
  why: "T1.S1 is the CONTRACT for what exists when T1.S2 begins: interface State, function subtract,
        consolidated state.injectedSet (seeded with priorPaths), the linear matchAll loop using state.*,
        exactly two subtract() calls (inline-whole + paged-head), count===0→ORIGINAL imagesIn ref."
  critical: "Do NOT re-implement State or subtract (T1.S1 owns them). Do NOT change the budget math or
             priorPaths seeding (T1.S1 owns them). T1.S2 ONLY extracts the loop body into helpers + rewires."

# MUST READ — dedup keys on abs path; external contract (imagesIn ref); budget mock pattern
- file: plan/003_4624515bcd82/architecture/system_context.md
  why: "§1 'External contract (must be preserved verbatim)' (imagesIn ORIGINAL-ref rule); §5.1 dedup keys
        on resolved abs path (NOT output blocks — paged 2-block/path is NOT a collision); §5 scan-before-inject."
  critical: "injectedSet holds resolved ABS PATHS. processTokenStream's belt-and-suspenders injectedSet
             re-check is a no-op at top level (localSeen already deduped) but load-bearing for T2 recursion."

# The file you edit (the only source change)
- file: file-injector.ts
  why: "POST-T1.S1 injectFiles has: interface State, function subtract, ONE const state: State, and a
        linear for-of-matchAll loop using state.*. T1.S2 extracts that loop's body into 4 helpers + rewires."
  pattern: "Linear matchAll loop (state.*) → split into scanTokens (pre-stat work) + injectFile
            (stat→claim→read→classify) + emitText (text decision) + processTokenStream (orchestrator)."
  gotcha: "injectFile receives ONLY abs (no m.index) → it CANNOT push the strip index; processTokenStream
           pushes r.index after injectFile returns true. injectFile does NOT use ctx in T1.S2 (threaded for
           T2 recursion-readiness). The F5 branch in injectFile must NOT `continue` (no loop) — use else-if."

# The regression gate (run it; the ONLY permitted edit is the 4-line sanity-list append below)
- file: file-injector.test.mjs
  why: "1044-line zero-dependency .mjs harness (the repo's 'standalone gate'; no test framework). Imports
        the REAL committed .ts via jiti + Pi's alias map. Sanity list L113-121 asserts 9 exports; ~52 named
        cases. Exits 0 iff all green."
  pattern: "node ./file-injector.test.mjs  # from repo root; exits 0 on success, 1 on any failure"
  gotcha: "The sanity list is a STATIC 9-assert block (does NOT iterate Object.keys(mod)), so adding
           exports without appending would still pass — but the item description says to append for what
           you export. Append ONLY scanTokens/injectFile/emitText/isAbsoluteOrTilde (4 lines) after the
           hasValidImageMagic assert. Do NOT touch any other line of the harness."

# Full first-hand analysis (equivalence proofs + line map) — written for this subtask
- file: plan/003_4624515bcd82/P1M1T1S2/research/research_notes.md
  why: "§2 scan-then-inject ≡ linear-loop equivalence table; §3 early-claim neutrality proof; §4 F3/F5
        classification order reconciliation; §5 verbatim emitText lift; §6 skipCode stub; §7 isAbsoluteOrTilde
        ownership; §8 export decision; §9 POST-T1.S2 injectFiles wrapper."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE SOURCE FILE EDITED (POST-T1.S1: ~470 lines; injectFiles has shared State + linear loop)
├── file-injector.test.mjs    # regression gate (1044 lines; EDIT ONLY the sanity list L113-121: append 4 asserts)
├── package.json              # { "pi": { "extensions": ["file-injector.ts"] } } — untouched
├── PRD.md                    # read-only
├── README.md                 # untouched this subtask (Mode B docs land in T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/
    │   ├── codebase_insertion_points.md   # ← MI-1 refactor contract (helper signatures + branch order)
    │   ├── system_context.md              # ← external contract + dedup facts + budget mock
    │   └── external_deps.md
    ├── P1M1T1S1/PRP.md                    # ← the starting-state contract (POST-T1.S1)
    └── P1M1T1S2/
        ├── research/research_notes.md     # ← full equivalence proofs + line map (this subtask's analysis)
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — add isAbsoluteOrTilde; add scanTokens/processTokenStream/injectFile/emitText
                          #                  (module-level, 3 exported + processTokenStream private); replace
                          #                  injectFiles's linear loop with a processTokenStream(...) call.
file-injector.test.mjs    # MODIFIED — append 4 asserts to the sanity list ONLY (scanTokens, injectFile,
                          #                  emitText, isAbsoluteOrTilde). No other line changes.
# No other files. No new files. No new dependencies.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — injectFile receives ONLY `abs` (no m.index). It CANNOT push the strip index. processTokenStream
//   pushes r.index after injectFile returns true. Net per-file effect (claim + block + count++ + index)
//   is identical to T1.S1's success site, just split across two functions.

// CRITICAL — injectFile CLAIMS abs AFTER stat+isFile, BEFORE read (deliberate, recursion-readying).
//   T1.S1 claimed at the success site (after read+classify). Moving the claim earlier is behavior-neutral
//   at top level (localSeen ensures injectFile is called once per abs; a failed read's claimed abs is
//   discarded with `state` after injectFiles returns; no test asserts injectedSet contents) but ESSENTIAL
//   for T2 recursion (self-import → verbatim; cycle termination). Do NOT move the claim back to the
//   success site — it would break T2's markdown cycle handling.

// CRITICAL — injectFile's F5 branch must NOT `continue` (there is no loop). Use an else-if chain:
//   if (mime && buf.length===0) { F5 } else if (mime && hasValidImageMagic(buf,mime)) { image }
//   else if (isBinary(buf)) { binary } else { emitText(...) }. Each branch falls through to state.count++.
//   This is provably equivalent to the current `if(F5){continue} isRealImage=...; if(mime&&isRealImage){image}else{...}`
//   (F5 short-circuits before hasValidImageMagic in both; mislabeled image-ext → binary/text in both).

// CRITICAL — do NOT reference computeCodeRanges/inCode in scanTokens (they don't exist yet — T2.S1).
//   jiti errors on undefined identifiers at transpile time even if `codeRanges && inCode(...)` short-circuits
//   at runtime. Leave a COMMENT placeholder describing what T2.S1 adds; omit the code check entirely.

// CRITICAL — emitText does NOT bump state.count. injectFile bumps count exactly once per claimed file
//   (whole, paged, image, or binary-note). emitText only pushes block(s) + subtracts + (paged path) paged++.

// CRITICAL — the count===0 early return in injectFiles uses the ORIGINAL imagesIn ref (NOT state.images).
//   The final return (count>0) uses state.images. Test case 5 / any injected===0 path asserts imagesIn identity.

// GOTCHA — dedup keys on resolved ABS path, NOT output <file> blocks. Paged delivery emits 2 blocks/path
//   (head + directive) and is NOT a dedup collision. state.injectedSet holds ABS PATHS.

// GOTCHA — scanTokens records m.index (the index of '#', since FILE_INJECT_RE group 1 is zero-width).
//   Stripping 2 chars at that index drops exactly '#@'. Same as the current index-based strip.

// GOTCHA — subtract stays TEXT-ONLY in T1.S2. Only emitText calls subtract (twice: whole fileCost,
//   paged head ceil(HEAD_CHARS/4)). injectFile's image/binary/empty-image branches do NOT subtract (T2.S2).

// LIBRARY — TypeScript via jiti (Pi's loader). No build step, no tsconfig, no lint, no test framework.
//   The .mjs harness imports file-injector.ts directly. jiti transpiles-on-load (no strict type-check),
//   so a type nit won't fail the gate — but a SYNTAX error or an undefined-identifier reference will fail
//   the harness import (the sanity asserts never run → process exits non-zero with a jiti/TS error).
//   The ONLY gate is `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

T1.S1 already added `interface State` and `function subtract`. T1.S2 adds one pure helper (`isAbsoluteOrTilde`)
and a shared `type Ctx` alias (recommended DRY; optional), then the four extracted helpers. **No new data
models** — `State` is unchanged. The new module-scope additions (place near the existing helpers, before
`injectFiles`):

```ts
// PRD §4.5 / §9 — markdown imports are relative-only; top-level user tokens allow absolute/tilde.
// scanTokens drops these when opts.allowAbsTilde is false. (No-op at top level: allowAbsTilde===true.)
// OWNED BY T1.S2 — T2.S1 REUSES this export (do NOT re-declare it there).
export function isAbsoluteOrTilde(p: string): boolean {
  return p.startsWith("/") || p.startsWith("~");
}

// OPTIONAL DRY (recommended): one ctx type shared by injectFiles / processTokenStream / injectFile.
// If you prefer zero signature churn, type ctx as `any` (PRD §9) in the two new helpers instead.
type Ctx = {
  cwd: string;
  getContextUsage?: () =>
    { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
};
```

### The four helpers (exact bodies)

```ts
/**
 * PRD §9 / §5.6 step 3 — scan a text (user prompt OR markdown content) for `#@` tokens that resolve,
 * WITHOUT injecting. Pure (no I/O, no state mutation beyond the per-text localSeen set). Per-text dedup
 * via localSeen; global state.injectedSet check skips already-claimed paths (prior <file> blocks OR files
 * injected earlier this run / in a parent recursion). Returns { index; abs }[] in text order.
 *
 * opts.skipCode: T1.S2 STUB — top-level scan passes skipCode:false, so NO code check runs. T2.S1 will
 *   add `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` and, inside the loop,
 *   `if (codeRanges && inCode(m.index!, codeRanges)) continue;` (PRD §5.6.1). Do NOT reference those
 *   names here — they do not exist yet.
 * opts.allowAbsTilde: when false, tokens starting with / or ~ are dropped (markdown relative-only, §4.5).
 */
export function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean },
  state: State,
): { index: number; abs: string }[] {
  const localSeen = new Set<string>();
  const out: { index: number; abs: string }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) {
    // (T2.S1 inserts the code-region exemption here when skipCode:true lands.)
    const token = cleanToken(m[2]);          // trim trailing punctuation (§4.3)
    if (!token) continue;                    // empty after trim → leave verbatim
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;  // §4.5 — markdown: relative only
    const abs = expandTildeAndResolve(token, baseDir);              // ~ expand + resolve(baseDir) (§4.4)
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue; // dedup → leave verbatim
    localSeen.add(abs);
    out.push({ index: m.index!, abs });
  }
  return out;
}

/**
 * PRD §9 / §12.17 — top-level processor. Scan the text ONCE (before any injection), then inject each
 * resolved token depth-first via injectFile. Returns the start indices of markers that resolved, in scan
 * order, for `#@` stripping by injectFiles. Scan-before-inject gives cross-subtree dedup (a later token
 * whose path an earlier import claimed is left verbatim). PRIVATE — exercised indirectly via injectFiles.
 *
 * The belt-and-suspenders `state.injectedSet.has(r.abs)` re-check is a NO-OP at top level in T1.S2
 * (scanTokens' localSeen already made each abs unique in records); it becomes load-bearing in T2 when
 * injectFile recurses into markdown imports.
 */
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean },
  state: State,
  ctx: Ctx,
): Promise<number[]> {
  const records = scanTokens(text, baseDir, opts, state);   // scan once, before any injection
  const resolved: number[] = [];
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue;             // cross-subtree dedup since scan (no-op at top level in T1.S2)
    const ok = await injectFile(r.abs, state, ctx);         // claims abs, emits block(s); never throws
    if (ok) resolved.push(r.index);
  }
  return resolved;
}

/**
 * PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims `abs` in state.injectedSet AFTER
 * stat+isFile succeed but BEFORE read, so a self-import or mid-recursion re-entry dedups to verbatim
 * (recursion-readiness for T2 markdown; behavior-neutral at top level). NEVER throws: stat miss / !isFile
 * / read or resize error → return false (token left verbatim, PRD §5.4 / §12.5).
 *
 * Classification (preserve F3/F5; NO markdown branch yet — T2.S3): (1) empty image (mime && buf.length===0)
 * → F5 note; (2) real image (mime && hasValidImageMagic) → attach ImageContent + image block; (3) binary
 * (isBinary) → binary note; (4) else → emitText. Budget: ONLY emitText subtracts (T2.S2 adds image/binary).
 * Returns true iff a block/image was emitted (state.count bumped exactly once per claimed file).
 */
export async function injectFile(abs: string, state: State, ctx: Ctx): Promise<boolean> {
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return false;                            // missing → leave verbatim (PRD §5.4)
  }
  if (!st.isFile()) return false;            // directory / socket / etc. → leave verbatim (PRD §5.4)
  state.injectedSet.add(abs);                // CLAIM — dedup incl. self-import (recursion-readiness)

  const ext = extOf(abs);
  const mime = MIME_BY_EXT[ext];             // undefined → not a recognized image → text/binary path
  try {
    const buf = await fs.readFile(abs);      // read ONCE; reused by image + text/binary paths
    if (mime && buf.length === 0) {
      // F5 — 0-byte image: emit a note, attach nothing (an empty ImageContent is rejected by providers)
      state.blocks.push(formatEmptyImageBlock(abs));
    } else if (mime && hasValidImageMagic(buf, mime)) {
      // F3 — IMAGE (PRD §5.2): classified by MIME first; SKIPS the NUL-byte check entirely
      const resized = await resizeImage(new Uint8Array(buf), mime);   // Uint8Array; async Worker; null on failure
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"),               // null → raw base64 of ORIGINAL bytes
        mimeType: resized?.mimeType ?? mime,                         // null → original mime
      });
      state.blocks.push(formatImageBlock(abs, resized));             // null → empty-hints <file name="ABS"></file>
    } else if (isBinary(buf)) {
      // BINARY (PRD §5.3) — note, no decoded garbage (em dash U+2014)
      state.blocks.push(formatBinaryBlock(abs));
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      emitText(abs, buf.toString("utf8"), state);
    }
    state.count++;                           // exactly one delivery per claimed file
    return true;
  } catch {
    return false;                            // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
}

/**
 * PRD §9 / §5.5 — inline-vs-paged decision for a text file. Pushes block(s) onto state.blocks and subtracts
 * the block's cost from state.remaining via subtract(). Bumps state.paged on the page path (NOT count —
 * injectFile bumps count once per file). Lifted VERBATIM from the former inline text branch of injectFiles
 * (T1.S1): whole if budget unknown or fileCost ≤ PAGED_THRESHOLD·remaining; sub-head guard (content ≤
 * HEAD_CHARS → whole, no directive, no extra subtract); else head + directive + paged++ + subtract(head cost).
 */
export function emitText(abs: string, content: string, state: State): void {
  const fileCost = Math.ceil(content.length / 4);    // O-3 heuristic (no string estimator exported)
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // INLINE (whole) — current behavior preserved (PRD §5.1)
    state.blocks.push(formatTextFileBlock(abs, content));
    subtract(state, fileCost);
  } else {
    // PAGED — head block (first HEAD_CHARS) + directive (PRD §5.5 Page path), unless sub-head-sized.
    const head = headSlice(content);                 // surrogate-safe first HEAD_CHARS UTF-16 code units
    if (content.length <= HEAD_CHARS) {
      // FINDING 2 — whole content fits the head slice → deliver inline, never page (no directive past EOF)
      state.blocks.push(formatTextFileBlock(abs, content));
    } else {
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head)));
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }
  }
}
```

### The rewired `injectFiles` (thin wrapper)

```ts
export async function injectFiles(text, imagesIn, ctx: Ctx): Promise<{ text; images; injected; paged }> {
  // §5.5 BUDGET — UNCHANGED from T1.S1 (try/catch; undefined/null → null O-1 fallback; never throws).
  let remaining: number | null;
  try {
    const usage = ctx.getContextUsage?.();
    if (usage === undefined || usage.tokens === null) {
      remaining = null;                                  // O-1 fallback: budget unknown → inject whole
    } else {
      const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
      remaining = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);
    }
  } catch {
    remaining = null;                                    // getContextUsage threw → O-1 fallback (§12.5)
  }

  // seed dedup with every <file name="..."> block already in the text (prior copy or @file) — UNCHANGED from T1.S1
  const priorPaths = new Set<string>();
  for (const m of text.matchAll(/<file name="([^"]+)">/g)) priorPaths.add(m[1]);

  const state: State = {
    blocks: [],
    images: [...imagesIn],          // COPY (runner REPLACES the array on transform)
    injectedSet: priorPaths,        // consolidated dedup: priorPaths ∪ within-run (added by injectFile)
    remaining,
    count: 0,
    paged: 0,
  };

  // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping
  const resolvedIdx = await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false }, state, ctx);
  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL imagesIn ref

  // strip '#@' from resolved top-level markers (high→low) — index-based 2-char splice (group 1 zero-width)
  let strippedText = text;
  for (const i of [...resolvedIdx].sort((a, b) => b - a)) {
    strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
  }
  const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`;   // append below the stripped prompt (§6.2)
  return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
}
```

### scan-then-inject ≡ linear-loop equivalence (why this is byte-for-byte)

`scanTokens` records the FIRST occurrence of each resolved abs (per-text `localSeen` + global
`state.injectedSet`). `processTokenStream` calls `injectFile` per record. The linear loop (T1.S1) did
dedup+stat+read per iteration inline. For ANY two top-level tokens A,B resolving to abs_A,abs_B:

| Scenario | Linear (T1.S1) | Scan-then-inject (T1.S2) | Same? |
|---|---|---|---|
| A injects, B = same abs (repeat) | A inject; B `injectedSet.has`→skip | A recorded; B `localSeen.has`→not recorded | ✓ only A stripped |
| A injects, B = different abs | both inject | both recorded, both inject | ✓ |
| A missing (stat throws), B = same abs | both stat-throw→continue | A recorded; B `localSeen`-skipped; A `injectFile`→stat throws→false | ✓ |
| A is dir, B = same abs | both !isFile→continue | A recorded; B skipped; A `injectFile`→!isFile→false | ✓ |
| A read throws, B = same abs | A catch-continue (not claimed); B same | A recorded; B skipped; A `injectFile`→stat ok→CLAIM→read throws→false | ✓ neither injects |
| A in priorPaths (prior `<file>`) | `injectedSet.has`→skip | scanTokens `state.injectedSet.has`→not recorded | ✓ verbatim |

**Why `localSeen`-in-scan ≡ `injectedSet`-at-success for observable output:** if A fails (missing/dir/read),
B (same abs) fails identically (deterministic FS) — so whether B is pre-skipped by `localSeen` or fails
again at `injectFile`, the outcome is identical. If A succeeds, B is correctly deduped in both. No test can
distinguish "first fails, second succeeds" (files don't work that way). Block order is preserved: `matchAll`
yields in text order → scanTokens records in that order → processTokenStream calls injectFile in that order.
`m.index` is the index of `#` (group 1 zero-width); stripping 2 chars there drops `#@` — identical to today.

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    add: export function isAbsoluteOrTilde(p): boolean     # pure guard; owned here, reused by T2.S1
    add: (optional) type Ctx = {...}                        # DRY alias shared by injectFiles/processTokenStream/injectFile
    add: export function scanTokens(text, baseDir, opts, state): { index; abs }[]
    add: async function processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]>   # PRIVATE
    add: export async function injectFile(abs, state, ctx): Promise<boolean>
    add: export function emitText(abs, content, state): void
    rewrite: injectFiles body — DELETE the inline `for (const m of text.matchAll(FILE_INJECT_RE))` loop
             and the local `injectedIndexes`; KEEP budget computation, priorPaths seeding, State initializer,
             the count===0→ORIGINAL-imagesIn early return, and the finalText assembly. Replace the loop with
             `const resolvedIdx = await processTokenStream(text, ctx.cwd, {allowAbsTilde:true,skipCode:false}, state, ctx);`
             and strip `#@` over `resolvedIdx` (high→low) exactly as before.
    placement: put isAbsoluteOrTilde/scanTokens/processTokenStream/injectFile/emitText between the existing
             pure helpers (headSlice/formatPagedDirectiveBlock) and the injectFiles JSDoc. Keep interface State
             and function subtract (from T1.S1) where they are.

  - modify: file-injector.test.mjs   # THE ONLY non-source edit; append 4 asserts to the sanity list
    append: (after the `assert(typeof mod.hasValidImageMagic === "function", ...)` line — currently ~L121)
            assert(typeof mod.scanTokens === "function", "mod.scanTokens must be a function (scan-only, recursion-ready)");
            assert(typeof mod.injectFile === "function", "mod.injectFile must be a function (stat→claim→classify→count)");
            assert(typeof mod.emitText === "function", "mod.emitText must be a function (inline-vs-paged text decision)");
            assert(typeof mod.isAbsoluteOrTilde === "function", "mod.isAbsoluteOrTilde must be a function (§4.5 markdown relative-only guard)");
    preserve: the original 9 asserts and EVERY other line of the harness untouched.

NO OTHER CHANGES:
  - package.json: untouched
  - README.md: untouched (Mode B docs are T3.S1)
  - no new files, no new dependencies

BUDGET STAYS TEXT-ONLY (this subtask) — identical to T1.S1:
  - text inline-whole  → subtract(state, fileCost)            ✅ inside emitText
  - text paged-head    → subtract(state, ceil(HEAD_CHARS/4))  ✅ inside emitText
  - text sub-head guard → (no mutation)                        ✅ inside emitText (unchanged)
  - image attach        → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
  - binary note         → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
  - empty-image note    → (no subtract)                        ⛔ NOT in this subtask (T2.S2)
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD isAbsoluteOrTilde + (optional) type Ctx to file-injector.ts
  - IMPLEMENT: export function isAbsoluteOrTilde(p): boolean { return p.startsWith("/") || p.startsWith("~"); }
  - IMPLEMENT (optional, recommended): type Ctx = { cwd; getContextUsage?; model? } matching injectFiles's
            inline ctx type; then use `ctx: Ctx` in injectFiles + the two new helpers. (Safe fallback: type
            ctx as `any` in processTokenStream/injectFile and leave injectFiles's inline type as-is.)
  - PLACEMENT: with the other pure helpers (near cleanToken/expandTildeAndResolve), before the injectFiles JSDoc.
  - EXPORT: isAbsoluteOrTilde YES; Ctx NO (type alias, erased at runtime).

Task 2: ADD scanTokens to file-injector.ts
  - IMPLEMENT: export function scanTokens(text, baseDir, opts, state): { index: number; abs: string }[]
            per the Blueprint body. NO I/O. Per-text localSeen + state.injectedSet dedup. skipCode = comment
            stub (do NOT reference computeCodeRanges/inCode).
  - DEPENDENCIES: cleanToken, expandTildeAndResolve, isAbsoluteOrTilde (Task 1), FILE_INJECT_RE, State (T1.S1).
  - EXPORT: YES.

Task 3: ADD emitText to file-injector.ts
  - IMPLEMENT: export function emitText(abs, content, state): void — VERBATIM lift of the current inline text
            decision (whole / sub-head guard / head+directive), with the two subtract() calls. Does NOT bump count.
  - DEPENDENCIES: formatTextFileBlock, formatPagedDirectiveBlock, headSlice, headStartLine, headCompleteLineCount,
            subtract, PAGED_THRESHOLD, HEAD_CHARS, State (all exist post-T1.S1).
  - EXPORT: YES.

Task 4: ADD injectFile to file-injector.ts
  - IMPLEMENT: export async function injectFile(abs, state, ctx): Promise<boolean> per the Blueprint body.
            stat→!isFile→CLAIM→read→classify(F5→F3 image→binary→emitText)→count++→return true; catch→return false.
            ctx threaded for T2 recursion-readiness (UNUSED in T1.S2). NO markdown branch.
  - DEPENDENCIES: scanTokens NOT needed here; emitText (Task 3), extOf, MIME_BY_EXT, hasValidImageMagic,
            resizeImage, formatImageBlock, formatEmptyImageBlock, isBinary, formatBinaryBlock, State, fs.
  - EXPORT: YES.

Task 5: ADD processTokenStream to file-injector.ts
  - IMPLEMENT: async function processTokenStream(text, baseDir, opts, state, ctx): Promise<number[]> per the
            Blueprint body. scanTokens once → per record re-check injectedSet → await injectFile → push r.index on ok.
  - DEPENDENCIES: scanTokens (Task 2), injectFile (Task 4), State.
  - EXPORT: NO (private — exercised via injectFiles).

Task 6: REWRITE injectFiles into a thin wrapper (behavior-preserving)
  - DELETE: the inline `for (const m of text.matchAll(FILE_INJECT_RE)) {...}` loop body and the local
            `const injectedIndexes: number[] = []`.
  - KEEP VERBATIM: budget computation (try/catch, O-1 fallback), priorPaths seeding loop, the `const state: State`
            initializer, the `count===0`→`{ text, images: imagesIn, injected: 0, paged: 0 }` ORIGINAL-ref early
            return, and the `\n\n---\n\n${state.blocks.join("\n\n")}` assembly.
  - ADD: `const resolvedIdx = await processTokenStream(text, ctx.cwd, { allowAbsTilde: true, skipCode: false }, state, ctx);`
  - CHANGE: the strip loop now iterates `resolvedIdx` (was `injectedIndexes`) — same high→low 2-char splice.
  - CONFIRM: external signature `injectFiles(text, imagesIn, ctx)` + return shape UNCHANGED.
  - DEPENDENCIES: Tasks 1–5 + State/subtract (T1.S1).

Task 7: APPEND 4 asserts to the test sanity list (the ONE permitted harness edit)
  - EDIT: file-injector.test.mjs — insert 4 `assert(typeof mod.X === "function", "...")` lines immediately
            after the existing `assert(typeof mod.hasValidImageMagic === "function", ...)` line (~L121), for
            scanTokens, injectFile, emitText, isAbsoluteOrTilde (exact text in Integration Points above).
  - PRESERVE: the original 9 asserts and every other line of the harness.
  - DEPENDENCIES: Tasks 1–4 (the 4 exports must exist or these asserts throw).

Task 8: VERIFY the external contract is untouched
  - CONFIRM: export async function injectFiles(text, imagesIn, ctx) signature unchanged; return type
            Promise<{ text; images; injected; paged }> unchanged.
  - CONFIRM: the 9 original sanity-list exports + default factory + autocomplete provider all still present
            and loadable; expandTildeAndResolve/extOf/isBinary/cleanToken/format*/hasValidImageMagic untouched.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No tsc/lint configured as a gate. The .mjs harness loads file-injector.ts via jiti (Pi's loader), which
# transpiles+runs the TS on import. A SYNTAX error or an UNDEFINED-IDENTIFIER reference (e.g. accidentally
# naming computeCodeRanges/inCode in scanTokens) surfaces as the harness failing to import — the sanity
# asserts never run → process exits non-zero with a jiti/TS error. So Level 1 == "the harness loads the file".

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -20
# Expected: the sanity assertions (now 13 of them: 9 original + your 4) pass, then the case matrix begins.
# A jiti/TS error here means a helper has a syntax problem or references an undefined name — READ the error,
# fix, re-run. (Common trap: referencing computeCodeRanges/inCode before T2.S1 — leave the skipCode stub as a COMMENT.)
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
# The suite (all must stay green): cases 1-14, E1-E4, G1-G3, H1, M1, F1/F1b/F1c/F1d, F2, FS1-FS3, F3a/F3b,
# F5, F4, U1, A1, DUP1-DUP3, PD1-PD8, PN1-PN4 — identical to the POST-T1.S1 baseline.
# If ANY case flips to FAIL, your extraction changed behavior — diff against the Blueprint bodies + the
# equivalence table. The sanity-list count is now 13 (9 + 4); if it's not, your Task 7 edit didn't land.
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# These cases are most sensitive to THIS refactor. If one breaks, here is the likely cause:

# F1/F1b/F1c/F1d/DUP1/DUP2/DUP3 (dedup) → each abs injected ONCE.
#   If FAIL: scanTokens's localSeen/injectedSet check, OR processTokenStream's belt-and-suspenders re-check,
#            diverged from the linear loop's injectedSet.has. Re-check the equivalence table.

# Case 5 (missing file) / any injected===0 path → asserts imagesIn ref identity.
#   If FAIL: you returned state.images instead of imagesIn in the count===0 early return (must be UNCHANGED
#            from T1.S1 — this PRP does not touch that line).

# FS1/FS2/FS3 (failed tokens keep #@) → strip touches ONLY resolved markers.
#   If FAIL: processTokenStream pushed r.index for a failed injectFile, OR scanTokens recorded an abs that
#            should have been skipped. resolvedIdx must contain ONLY indices where injectFile returned true.

# PD1/PD2/PN2/PN3 (paged delivery) → head+directive, paged count correct.
#   If FAIL: emitText's math drifted from the verbatim lift (check subtract args: fileCost for whole,
#            ceil(HEAD_CHARS/4) for paged head; sub-head guard mutates nothing).

# PD3 (O-1 fallback, budget unknown) → huge.log injected WHOLE, paged=0.
#   If FAIL: the budget computation try/catch or undefined/null→null branch was altered (must be UNCHANGED).

# PD6 (sub-head guard) → WHOLE under tight budget, NO directive.
#   If FAIL: emitText accidentally subtracted or emitted a directive in the sub-head branch.

# F3a/F3b (magic gate) + F5 (empty image) → mislabeled image-ext → text/binary; 0-byte image → F5 note.
#   If FAIL: injectFile's classification order drifted from F5→F3 image→binary→emitText (else-if chain).

# U1 (Unicode regex) + case 1 (basic inject) → zero-width anchor, index-based strip.
#   If FAIL: scanTokens recorded the wrong index, or the strip loop iterates the wrong array (resolvedIdx).

# Re-run focusing on failures (cases share fixtures):
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|sanity"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2 for this subtask. There is no model, no network, no server, no DB.
# Optional smoke (proves the live loader path works end-to-end, NOT required for the gate):
#   echo 'Review #@file-injector.ts' | pi -p "$(cat -)" 2>/dev/null | head -5 || true
# (The 52-test harness is the authoritative gate. The 4 new sanity asserts prove the helpers are exported.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `52 passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error when the harness imports file-injector.ts (the 13 sanity asserts all run).
- [ ] `scanTokens`, `processTokenStream`, `injectFile`, `emitText` exist as module-level functions.
- [ ] `isAbsoluteOrTilde` exists and is exported; scanTokens references it (NOT computeCodeRanges/inCode).
- [ ] `injectFiles` has NO inline matchAll loop and NO local `injectedIndexes`; it calls `processTokenStream`.
- [ ] Exactly TWO `subtract(state, …)` calls exist (both inside `emitText`); injectFile's image/binary/F5 branches have none.

### Feature Validation (behavior preservation)

- [ ] `injectFiles` external signature + return shape `{ text, images, injected, paged }` UNCHANGED.
- [ ] `count===0` early return uses ORIGINAL `imagesIn` (not `state.images`) — UNCHANGED from T1.S1.
- [ ] Dedup still blocks prior-block paths (F1) and same-path repeats (DUP1-3); new paths still inject (F1c).
- [ ] Budget text-only behavior preserved: PD1/PD2 page, PD3 injects whole, PD6 sub-head whole, PD4/PD5
      (image/binary) UNAFFECTED by budget (no subtract in injectFile's image/binary/F5 branches).
- [ ] `#@` strip is index-based, high→low, only on resolved markers (FS1/FS2/FS3 green) — now over `resolvedIdx`.
- [ ] F3 magic gate + F5 empty-image + Unicode regex + `\n\n---\n\n` assembly all green (U1, F3a/b, F5, case 1).
- [ ] injectFile claims abs AFTER stat+isFile, BEFORE read (recursion-ready; verify the `.add(abs)` placement).

### Code Quality Validation

- [ ] `scanTokens`, `injectFile`, `emitText`, `isAbsoluteOrTilde` are EXPORTED; `processTokenStream` + `subtract` are NOT.
- [ ] Test sanity list has exactly 4 appended asserts (13 total); the original 9 + every other harness line untouched.
- [ ] scanTokens's `skipCode` is a comment-placeholder stub (no reference to T2.S1's computeCodeRanges/inCode).
- [ ] injectFile's classification is an else-if chain (F5 → F3 image → binary → emitText); NO `continue`, NO markdown branch.
- [ ] emitText does NOT bump count (injectFile does, once per claimed file); emitText's math is the verbatim lift.
- [ ] No rationale comments lost (FINDING 1/2, F1/F1c, Issue 1/2, O-1 fallback) — relocate them into the helpers they now describe.

### Documentation

- [ ] JSDoc on each extracted helper (Mode A — item §6 DOCS): scanTokens (scan-only + localSeen/injectedSet
      dedup + skipCode stub note), processTokenStream (scan-then-inject depth-first + cross-subtree dedup),
      injectFile (stat→claim→classify→count, never throws, claim-before-read rationale), emitText (inline-vs-paged, calls subtract).
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT change behavior.** This is a loop-body extraction into 4 helpers + a rewire. If a test flips,
  you changed logic, not just structure. Re-read the Blueprint bodies and the equivalence table.
- ❌ **Do NOT reference `computeCodeRanges`/`inCode` in scanTokens.** They are T2.S1. Leave a comment
  placeholder; jiti errors on undefined identifiers even inside a short-circuited `&&`.
- ❌ **Do NOT re-declare `isAbsoluteOrTilde` in T2.S1.** T1.S2 owns it. (Documented here for the coordination;
  T2.S1 reuses this export.)
- ❌ **Do NOT add a markdown branch to injectFile** (no `MD_EXTS`/`injectMarkdown` — that's T2.S3).
- ❌ **Do NOT add `subtract` calls for image/binary/empty-image.** Those are T2.S2. Adding them now breaks
  PD4/PD5 byte-for-byte (the budget would mutate where it currently does not).
- ❌ **Do NOT move the injectFile claim back to the success site.** Claim AFTER stat+isFile, BEFORE read —
  recursion-readiness (T2 self-import/cycle handling) depends on it, and it is behavior-neutral at top level.
- ❌ **Do NOT push the strip index from injectFile.** injectFile has no `m.index`; processTokenStream pushes
  `r.index` after `injectFile` returns true. Pushing a wrong index breaks FS1/FS2/FS3.
- ❌ **Do NOT bump `count` in emitText.** injectFile bumps count once per claimed file (whole/paged/image/binary).
- ❌ **Do NOT touch `subtract`/`State`/budget-math/priorPaths-seeding.** T1.S1 owns them; T1.S2 only consumes.
- ❌ **Do NOT lose the ORIGINAL-ref early return.** `count===0` returns `images: imagesIn`, NOT `state.images`.
- ❌ **Do NOT edit any line of file-injector.test.mjs EXCEPT appending the 4 sanity asserts.** The harness is
  the gate; one append-only edit is permitted, nothing else.
- ❌ **Do NOT export `processTokenStream` or `subtract`** (they stay private; exercised via injectFiles).

---

## Confidence Score: 9/10

A tightly-scoped structural refactor: extract four module-level helpers from T1.S1's linear loop + rewire
`injectFiles` to call `processTokenStream`. The PRP includes the exact helper bodies, the
scan-then-inject ≡ linear-loop equivalence proof, the deliberate early-claim note, the verbatim `emitText`
lift, the T2.S1 coordination boundary (skipCode stub + isAbsoluteOrTilde ownership), and a single
authoritative green gate (`52 passed, 0 failed`). The -1 reserves for: (a) the one test-harness sanity-list
append (low risk, but it IS an edit to the gate file), and (b) the `ctx` typing choice across 3 functions
(jiti doesn't type-check, so any reasonable shape compiles, but a shared `type Ctx` alias is cleanest).
The implementing agent edits one source file + appends 4 lines to the harness, then runs one command.
