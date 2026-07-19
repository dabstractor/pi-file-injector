---
name: "P1.M1.T1.S3 (plan/009) — injectFiles: delete resolvedIdx/strippedText; return original prompt verbatim"
prd_ref: "PRD §6.4 (Assembly & shared state — 'The prompt is never modified'; the user message is returned byte-for-byte so re-open re-triggers injection), §13.8 (why the prompt is preserved verbatim — stripping breaks cancel/fork/tree re-injection), §12.10/§12.16 (deliver as custom message; never strip markers), §9 Algorithm (the target injectFiles pseudocode: await processTokenStream(...) then return { text: event.text, ... }). Bugfix/v009 context: arch/system_context.md 'Site 1 — Top-level prompt stripping (injectFiles)'."
target_file: "./file-injector.ts"   # injectFiles body ONLY (two edit sites); the function signature + JSDoc above it are UNCHANGED
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict; S3 is the LAST of S1→S2→S3 — it is the GREEN gate: after S3 the file typechecks with 0 errors)
depends_on: "P1.M1.T1.S1 (Complete, LANDED: processTokenStream → Promise<void>; scanTokens → Promise<string[]>). S3 consumes POST-S1: the `const resolvedIdx = await processTokenStream(...)` assigns void, and `[...resolvedIdx].sort(...)` is the single remaining typecheck error (TS2488) S3 removes."
consumed_by: "P1.M1.T2.S1 (input handler return text:event.text — independent parallel confirmation of the verbatim contract). P1.M2.T1.S1 (migrate top-level prompt assertions ~20: r.text now verbatim). P1.M2.T3.S1 (re-open regression tests). The runtime suites currently CRASH on the void spread; after S3 they RUN again (but fail on stripped-expectation asserts until M2)."
---

# PRP — P1.M1.T1.S3: injectFiles — delete resolvedIdx/strippedText; return original prompt verbatim

> ⚠️ **SCOPE & GATE — READ FIRST.** S3 is the **LAST** of the 3-subtask sequence (S1 → S2 → **S3**) that
> removes ALL `#@` marker stripping from the injection engine (PRD §6.4/§12.16: deliver verbatim). S3 rewrites
> the **body of one function** — `injectFiles` — to (a) drop the `const resolvedIdx =` assignment (processTokenStream
> now returns `void` after S1), (b) DELETE the `let strippedText` + index-splice loop entirely, and (c) return
> the function's first parameter `text` (the original, byte-for-byte prompt) verbatim. **S3 IS THE GREEN GATE:**
> after S3, `npm run typecheck` reports **0 errors** (the one remaining error — `TS2488 Type 'void' must have a
> [Symbol.iterator]` at `file-injector.ts:1190` — is gone). The `.mjs` suites then RUN again (the void-spread
> crash is removed) but FAIL on ~78 stripped-expectation assertions — those are migrated in P1.M2 (out of scope here).

---

## Goal

**Feature Goal:** Make `injectFiles` return the user's **original prompt verbatim** (the `#@<path>` triggers left
exactly where the user typed them, nothing appended, nothing stripped) per PRD §6.4/§13.8, by deleting the two
stripping constructs that are now dead (the `resolvedIdx` assignment, whose source `processTokenStream` now
returns `void`; and the `strippedText` index-splice loop that consumed it) and returning the `text` parameter
directly. This closes the S1→S2→S3 cascade: the file typechecks green (0 errors).

**Deliverable:** Modified `file-injector.ts` — the `injectFiles` body: two contiguous oldText→newText edits
(Edit A: the comment + `const resolvedIdx =` → verbatim comment + bare `await processTokenStream(...)`;
Edit B: delete the stripping comment + `let strippedText` loop → a verbatim-contract comment + `return { text, ... }`).
**Signature unchanged** (same param list incl. `bareAt = false`; same return type shape `{ text; images; injected; paged; blocks; details }`).
No other function touched.

**Success Definition:**
1. `npm run typecheck` → **0 errors** (the `TS2488` at `:1190` is gone; no NEW error introduced).
2. `injectFiles` body contains NO `resolvedIdx`, NO `strippedText`, NO `.slice(0, i)`/`.slice(i + 2)` splice,
   NO "strip"/"stripped"/"start indices of markers" language.
3. The count===0 early return (`return { text, images: imagesIn, ... }`) is UNCHANGED, and the count>0 return
   is now `return { text, ... }` — BOTH paths return the original `text` (the function's first parameter).
4. The runtime suites no longer crash with `resolvedIdx is not iterable` (the void spread is deleted). They will
   FAIL on stripped-expectation assertions — that is expected and owned by P1.M2.

## Why

- **Honors the verbatim-delivery contract (the root cause).** PRD §6.4/§13.8: Pi re-feeds the **stored**
  user-message content on cancel/fork/`/tree`-navigate (`navigateTree` prefills the editor from
  `targetEntry.message.content`, with no extension hook to override). If the extension stripped `#@` from the
  stored message, a re-submitted prompt contains no `#@`, the `input` handler injects nothing, and **the files
  silently vanish on every re-open.** Preserving the prompt verbatim makes re-submission reliably re-trigger
  injection. Stripping's only effect was deleting two characters per marker — negligible; the file bytes always
  lived in the returned `blocks`/`details` (now the `before_agent_start` custom message).
- **Consumes S1's simplified processTokenStream.** S1 narrowed `processTokenStream` to `Promise<void>` (no index
  accumulator). `injectFiles`'s `const resolvedIdx = await processTokenStream(...)` now assigns `void`, and
  `[...resolvedIdx].sort(...)` is the single remaining typecheck error (`TS2488`). S3 removes that cascade.
- **Sequence ordering.** S1 (return shapes) → S2 (`injectMarkdown` caller) → S3 (`injectFiles` caller). S3 is the
  terminal fix that turns the file green. (S2 runs in parallel and owns `injectMarkdown`; the two are disjoint —
  S3 touches only `injectFiles`, S2 only `injectMarkdown` — so neither clobbers the other.)

## What

### User-visible behavior (lands fully after M2 test migrations)

After the full plan, a submitted prompt with `#@a.ts` is stored and displayed **exactly as typed** — the `#@a.ts`
trigger stays in the user message (the file bytes live in the separate green `read a.ts` custom-message block).
Today the trigger is sliced to `a.ts`. The model receives the same file bytes; the only change is cosmetic
(the user bubble shows `Review #@a.ts` instead of `Review a.ts`) and correctness (re-open re-triggers injection).

### Technical behavior (the contract)

- `injectFiles` calls `await processTokenStream(text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx)` — **no assignment** (void return).
- The `state.count === 0` early return is UNCHANGED (already returns the original `text`).
- The count>0 return is `return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details }` — `text` is the function's first parameter (the original, verbatim prompt).
- The `blocks`/`details` arrays are still populated by the injection engine (via `state`) and returned for the caller
  (the `input` handler stashes them for `before_agent_start`'s custom message) — UNCHANGED. The return TYPE is unchanged.

### Success Criteria

- [ ] `npm run typecheck` → **0 errors** (the S3 GREEN gate).
- [ ] No `resolvedIdx` / `strippedText` / `.slice(i + 2)` / "strip ... trigger" token remains in `injectFiles`.
- [ ] `injectFiles` returns `text` (the original param) on BOTH the count===0 and count>0 paths.
- [ ] `injectFiles` signature + the module JSDoc above it are UNCHANGED; `bareAt` param and `state.bareAt` seam intact.
- [ ] Runtime suites no longer crash on `resolvedIdx is not iterable` (failure-on-assertion is expected → M2).

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current `injectFiles` body (verified against the working tree), the two contiguous oldText→newText edits,
the POST-S1 starting state (`processTokenStream → Promise<void>`, confirmed), the single typecheck error S3
removes (`TS2488` at `:1190`, confirmed by running it), and the S2 scope boundary (disjoint — S2 owns
`injectMarkdown`). The implementer applies two edits, then confirms `npm run typecheck` is 0 errors.

### Documentation & References

```yaml
# MUST READ — the verbatim-delivery contract (WHY resolvedIdx/strippedText are deleted)
- file: PRD.md
  why: "§6.4 (Assembly & shared state — 'The prompt is never modified'; the input handler 'leaves event.text
        byte-for-byte intact'); §13.8 (stripping breaks cancel/fork//tree re-injection — the stored content is
        re-fed, so stripped ⇒ no #@ ⇒ no re-injection); §12.10/§12.16 (deliver as a custom message; never strip
        markers). The strippedText loop existed only to strip #@ from the prompt — serving no purpose now the
        bytes live in the custom message, and actively harmful to re-submission."
  section: "### 6.4 + #### 12.16 + ### 13.8"

# MUST READ — the target injectFiles shape (the authoritative pseudocode)
- file: PRD.md
  why: "§9 Algorithm shows the TARGET: `await processTokenStream(event.text, ctx.cwd, {...}, state, ctx)` (no
        assignment), then `return { action: 'transform', text: event.text, images: state.images }` (text VERBATIM).
        That IS the S3 spec (the §9 input handler is the runtime wrapper around this injectFiles contract)."
  section: "## 9 Algorithm (the input handler + processTokenStream call)"

# MUST READ — the contract: S1's shapes + the S2/S3 cascade contract (S3 is the terminal/green fix)
- file: plan/009_0d85ac0b1b08/P1M1T1S1/PRP.md
  why: "S1 = scanTokens→Promise<string[]>, processTokenStream→Promise<void> (LANDED). S1's CASCADE CONTRACT
        names S3 as the terminal fix: after S1, `injectFiles`'s `const resolvedIdx = await processTokenStream`
        assigns void and `[...resolvedIdx].sort(...)` is the lone TS2488. S3 deletes both."
  critical: "S3 consumes POST-S1. After S3 the file is GREEN (0 errors). Do NOT edit scanTokens/processTokenStream
             (S1 owns them) or injectMarkdown (S2 owns it). S3 touches ONLY injectFiles."

# The S2 PRP (parallel sibling) — confirms S2's scope is DISJOINT from S3
- file: plan/009_0d85ac0b1b08/P1M1T1S2/PRP.md
  why: "S2 owns injectMarkdown body + JSDoc ONLY; it explicitly says 'injectFiles NOT edited by S2 (S3 owns it).'
        So S3 and S2 edit disjoint functions — no merge conflict. S3 can proceed assuming S2 lands (or not): the
        injectFiles text S3 edits is STABLE regardless of S2 (S2 touches only injectMarkdown)."

# The authoritative mapping (Site 1 = injectFiles = S3)
- file: plan/009_0d85ac0b1b08/architecture/system_context.md
  why: "'Site 1 — Top-level prompt stripping (injectFiles L1225-1246): Current processTokenStream returns number[]
        ... injectFiles splices each index by +2 to produce strippedText. After: processTokenStream returns void.
        injectFiles returns the original text verbatim.' That is the S3 spec. (Line numbers there are approximate;
        place by IDENTIFIER per the edits below.)"

# The file you edit (ONE function body — two contiguous edits)
- file: file-injector.ts
  why: "injectFiles body. The two edit sites are at :1166-1175 (Edit A) and :1183-1195 (Edit B) in the CURRENT
        working tree. Line numbers are stable for S3 (S2 edits injectMarkdown, above injectFiles, but the injectFiles
        BODY text is identical pre/post-S2 — S3's oldText matches verbatim either way). Place by the literal text
        in Edit A/Edit B, not raw lines."
  pattern: "injectFiles = budget compute → priorPaths seed → State → processTokenStream call → count===0 early
            return → [stripping loop — DELETE] → return. S3 rewrites the processTokenStream-call comment+assignment
            and deletes the stripping loop, leaving the two returns both yielding the original `text`."
  gotcha: "the count===0 early return at :1176 ALREADY returns the original `text` — do NOT touch it. After S3,
           BOTH returns yield `text`; that symmetry is the point."

# typecheck gate (the GREEN gate — S3 is terminal)
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. CURRENT: one error — file-injector.ts(1190,23): TS2488 'Type void
        must have a [Symbol.iterator]'. AFTER S3: 0 errors. That is the S3 gate."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectFiles body: Edit A + Edit B; signature + module JSDoc UNCHANGED)
├── file-injector.test.mjs    # NOT edited (RUNs again post-S3, but FAILS stripped-expectation asserts → M2.T1)
├── import-behavior.test.mjs  # NOT edited (→ M2.T2)
├── relative-imports.test.mjs # NOT edited (→ M2.T2)
├── package.json              # untouched ("test" chains all 3 .mjs; "typecheck" = scripts/typecheck.mjs)
├── scripts/typecheck.mjs     # untouched (the GREEN gate)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{system_context.md, stripping_logic_analysis.md, test_assertions_analysis.md, readme_analysis.md}
    ├── P1M1T1S1/{research/research_notes.md, PRP.md}   # S1 (LANDED): scanTokens→string[], processTokenStream→void
    ├── P1M1T1S2/{research/research_notes.md, PRP.md}   # S2 (parallel): injectMarkdown verbatim — DISJOINT from S3
    └── P1M1T1S3/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectFiles body ONLY:
                          #   Edit A: comment + `const resolvedIdx = await processTokenStream(...)`
                          #           → verbatim comment + `await processTokenStream(...)` (drop assignment)
                          #   Edit B: DELETE stripping comment + `let strippedText` + index-splice loop;
                          #           return `{ text, images: state.images, ... }` (verbatim `text`)
# No other files. No test changes (M2 owns them). No new exports/imports. Signature unchanged.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — S3 IS THE GREEN GATE. S1 (landed) left ONE typecheck error at injectFiles:1190 (TS2488 —
//   `[...resolvedIdx]` spreads void). S2 (parallel) leaves injectMarkdown clean. S3 deletes the spread
//   → 0 errors. Confirm with `npm run typecheck` after the two edits.

// CRITICAL — DELETE THE ENTIRE STRIPPING BLOCK (Edit B): the ~13-line comment + `let strippedText = text`
//   + the `for (const i of [...resolvedIdx].sort((a,b)=>b-a)) { strippedText = strippedText.slice(0,i) +
//   strippedText.slice(i+2); }` loop + the §6.4 "JUST the stripped prompt" comment. Leaving ANY of
//   `resolvedIdx`/`strippedText`/`.slice(i + 2)` behind = either a type error (resolvedIdx is void) or a
//   dangling variable. Edit B is one contiguous oldText→newText to guarantee completeness.

// CRITICAL — the count===0 early return at :1176 ALREADY returns the original `text`:
//     `if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };`
//   Do NOT change it. After Edit B, BOTH the count===0 AND count>0 paths return the original `text` — that
//   symmetry is the verbatim contract. (The count===0 path returns `images: imagesIn` [the ORIGINAL images
//   array, since nothing was injected]; the count>0 path returns `images: state.images` [seeded from imagesIn
//   plus any injected images]. That asymmetry is correct and pre-existing — do not "normalize" it.)

// GOTCHA — `bareAt` (the 4th param, default false) is stored into `state.bareAt` and is the SEAM injectMarkdown
//   reads (S2: `bareAt: state.bareAt`). It is NOT used elsewhere in the injectFiles body. Leave it — do not
//   remove the param or the `bareAt` field on State. S3 changes only the processTokenStream call + the return.

// GOTCHA — the return TYPE is unchanged: `Promise<{ text: string; images: ImageContent[]; injected: number;
//   paged: number; blocks: string[]; details: FileDetail[] }>`. `text` is still `string` — now bound to the
//   original param instead of the spliced local. No callers need a type change.

// GOTCHA — line numbers in the item description (L1162-1246) and arch/system_context (L1225-1246) are
//   APPROXIMATE (the file is 1374 lines now; S2 may shift injectMarkdown above, but the injectFiles BODY text
//   is stable). Place by the literal text in Edit A / Edit B — not raw lines.

// LIBRARY — TypeScript via jiti (no build step). typecheck = tsc --strict (TS 5.6, resolved from the GLOBAL pi
//   package at `npm root -g`/`@earendil-works/pi-coding-agent`). No new imports/exports.
```

---

## Implementation Blueprint

### Edit A — the processTokenStream call (comment + drop the `const` assignment)

Locate by the `const resolvedIdx = await processTokenStream(` line (currently `:1174`) + the 8-line comment
above it. Replace the comment + assignment with a verbatim-contract comment + a bare `await`.

**oldText** (current — `:1166-1175`):
```ts
  // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping.
  // processTokenStream scans ONCE (before any injection) then calls injectFile per record (PRD §12.17),
  // returning the start indices of markers that ACTUALLY injected. Failed tokens (missing/dir/error)
  // and deduped repeats are never returned → they keep '#@' verbatim (PRD §6.2). scanTokens' per-text
  // localSeen + state.injectedSet give cross-subtree dedup (a later token whose path an earlier import
  // claimed is left verbatim); processTokenStream's belt-and-suspenders injectedSet re-check is a no-op
  // at top level in T1.S2 (each abs is already unique in records) but load-bearing for T2 recursion.
  const resolvedIdx = await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
```

**newText**:
```ts
  // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping.
  // processTokenStream scans ONCE (before any injection) then calls injectFile per resolved abs (PRD §12.17);
  // it returns void — it does NOT report marker indices, because markers are NEVER stripped from the prompt
  // (§6.4/§13.8: the user message is returned byte-for-byte verbatim so cancel/fork//tree re-open re-triggers
  // injection). Failed tokens (missing/dir/error) and deduped repeats are never injected → they keep '#@'
  // verbatim (§6.2). scanTokens' per-text localSeen + state.injectedSet give cross-subtree dedup (a later
  // token whose path an earlier import claimed is left verbatim); processTokenStream's belt-and-suspenders
  // injectedSet re-check is a no-op at top level (each abs is already unique in absPaths) but load-bearing
  // for markdown recursion.
  await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
```

> **Why drop the assignment:** after S1, `processTokenStream` returns `Promise<void>`. `const resolvedIdx = ...`
> binds `void`; the only consumer (the `[...resolvedIdx]` spread in Edit B) is being deleted, so the binding is
> now dead AND its consumer is a type error. A bare `await` is correct and silences the TS6133 "unused" / TS2488.

### Edit B — DELETE the stripping loop; return `text` verbatim

Locate by the `// Strip the #@ trigger from each inline marker` comment (currently `:1183`) through the
`return { text: strippedText, ... }` line (currently `:1195`). Replace the whole run (comment + loop + return)
with a verbatim-contract comment + `return { text, ... }`.

**oldText** (current — `:1183-1195`):
```ts
  // Strip the #@ trigger from each inline marker — the PATH stays put as a readable reference. The
  // model doesn't need the #@ syntax (the appended <file name="abs"> blocks carry the data), and
  // every #@ is 2 tokens of pure noise. Reached only when count > 0, so the nothing-injected path
  // above still returns the prompt byte-for-byte (missing/dir/error tokens keep their #@ verbatim).
  // §6.2 — strip the '#@' trigger ONLY from tokens that ACTUALLY injected. Failed tokens
  // (missing/dir/error) and deduped repeats were never returned, so they keep '#@' verbatim.
  // INDEX-BASED SPLICE (not substring replace): an injected match can be a prefix of another token
  // (e.g. '#@a.ts' ⊂ '#@a.ts.bak'), so a substring replace would corrupt the longer token. Group 1
  // of FILE_INJECT_RE is zero-width → m.index is exactly the '#'; removing 2 chars drops exactly
  // '#@'. Process high→low so earlier offsets stay valid.
  let strippedText = text;
  for (const i of [...resolvedIdx].sort((a, b) => b - a)) {
    strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
  }
  // §6.4 — the user message is JUST the stripped prompt (no appended blocks, no `\n\n---\n\n`). The blocks +
  // details are returned for the caller (P1.M1.T2.S1 stashes them for the before_agent_start custom message).
  return { text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
```

**newText**:
```ts
  // §6.4 / §13.8 — the user message is the ORIGINAL `text`, byte-for-byte VERBATIM. Markers are NEVER stripped
  // (no `#@` removal, no appended blocks, no `\n\n---\n\n`): stripping discards the triggers from the STORED
  // message, and Pi re-feeds that stored text on cancel / fork / `/tree`-navigate (`navigateTree` prefills the
  // editor from `targetEntry.message.content`, with no extension hook to override), so a stripped prompt would
  // never re-trigger injection. The file BYTES live only in the returned `blocks`/`details` (the caller — the
  // input handler — stashes them for `before_agent_start`'s custom message); the prompt carries nothing but the
  // user's original text. (The count===0 path above already returns this same `text` verbatim.)
  return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
```

> **Why one contiguous replacement:** the stripping comment, the `strippedText` local, the splice loop, and the
> return are all load-bearing on each other — `strippedText` is produced by the loop and consumed only by the
> return, and the loop consumes `resolvedIdx` (deleted in Edit A). A single oldText→newText guarantees NO
> dangling `strippedText`/`resolvedIdx`/`.slice(i + 2)` reference survives (any survivor is a TS2488/TS2304).

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — injectFiles body ONLY):
  - Edit A (:1166-1175): comment + `const resolvedIdx = await processTokenStream(...)` → verbatim comment +
          bare `await processTokenStream(...)`. (processTokenStream returns void after S1.)
  - Edit B (:1183-1195): DELETE the ~13-line stripping comment + `let strippedText` + the `[...resolvedIdx].sort`
          splice loop + the "JUST the stripped prompt" comment; return `{ text, images: state.images, ... }`
          (the original `text` param, verbatim).
  - UNCHANGED: the function signature (incl. `bareAt = false`); the budget/priorPaths/State setup (:1119-1165);
          the count===0 early return at :1176 (already returns original `text`); the module JSDoc above the
          function; every other function (scanTokens/processTokenStream/injectMarkdown/injectFile/emitText/...).

NO_CHANGES: the three .mjs suites, package.json, scripts/typecheck.mjs, tsconfig.json, PRD.md, README.md,
          all plan/ files. NO new exports (injectFiles is already exported; stays so). NO new imports.
```

### Implementation Tasks (ordered — the S3 portion, the terminal/green fix)

```yaml
Task 1: APPLY Edit A (drop the resolvedIdx assignment)
  - LOCATE the `const resolvedIdx = await processTokenStream(` line + the 8-line comment above it (place by the
    exact text in Edit A oldText; line ~1174 but place by text — S2 may have shifted lines above).
  - REPLACE comment+assignment with the verbatim comment + bare `await processTokenStream(...)`.
  - VERIFY: `grep -n "const resolvedIdx" file-injector.ts` → no matches.

Task 2: APPLY Edit B (delete the stripping loop; return text verbatim)
  - LOCATE the `// Strip the #@ trigger from each inline marker` comment through `return { text: strippedText, ... }`
    (place by the exact text in Edit B oldText; ~lines 1183-1195).
  - REPLACE the whole run with the verbatim-contract comment + `return { text, images: state.images, ... }`.
  - VERIFY: `grep -nE "strippedText|resolvedIdx|slice\(i \+ 2\)" file-injector.ts` → no matches.

Task 3: GREEN GATE (the S3 deliverable)
  - npm run typecheck → EXPECT **0 errors** (the lone TS2488 at :1190 is gone; no new error).
  - If a NEW error appears inside injectFiles, an edit left a dangling reference — re-check Edit A/B for completeness.
  - (Optional sanity) npm test → the suites now RUN (no `resolvedIdx is not iterable` crash) but FAIL on
    stripped-expectation assertions (e.g. `r.text === "Review a.ts"`). That failure is EXPECTED and is migrated
    in P1.M2.T1 — it is NOT an S3 failure. Do NOT "fix" the tests here.
```

### Implementation Patterns & Key Details

```ts
// The verbatim return — both paths now yield the original `text` (the function's first parameter):
//
//   if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }; // (UNCHANGED, :1176)
//   ...
//   return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details }; // (Edit B)
//
// NOTE the deliberate images asymmetry (pre-existing, correct): count===0 returns `images: imagesIn` (nothing
// was injected → the ORIGINAL images array, byte-for-byte); count>0 returns `images: state.images` (seeded from
// imagesIn via `images: [...imagesIn]` in the State setup, plus any injected images). Do NOT "normalize" this.

// ANTI-PATTERN (what S3 removes — reject if it survives):
//   const resolvedIdx = await processTokenStream(...);   // ← binds void (TS would flag consumer)
//   let strippedText = text;
//   for (const i of [...resolvedIdx].sort((a, b) => b - a)) { strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2); }
//   return { text: strippedText, ... };                  // ← stripped, not verbatim (breaks re-open)
```

---

## Validation Loop

### Level 1: Typecheck — the S3 GREEN gate (0 errors)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck          # == node ./scripts/typecheck.mjs (tsc --strict, TS 5.6 via npx)
# CURRENT (pre-S3): file-injector.ts(1190,23): error TS2488: Type 'void' must have a '[Symbol.iterator]()' ...
# AFTER S3:        0 errors.   ← THIS is the S3 gate. (The lone error was the [...resolvedIdx] spread; Edit B deletes it.)
# If a NEW error appears inside injectFiles, an edit left a dangling `strippedText`/`resolvedIdx` reference — re-check.
```

### Level 2: Structural verification (the 2 edits landed; no stale refs)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] resolvedIdx gone:";        grep -c "resolvedIdx" file-injector.ts                      # expect 0
echo "[2] strippedText gone:";       grep -c "strippedText" file-injector.ts                     # expect 0
echo "[3] splice gone:";             grep -cE "slice\(0, i\)|slice\(i \+ 2\)" file-injector.ts   # expect 0
echo "[4] bare await call:";         grep -c "^  await processTokenStream(" file-injector.ts     # expect 1
echo "[5] verbatim return:";         grep -c "return { text, images: state.images" file-injector.ts  # expect 1
echo "[6] count===0 early return unchanged:"; grep -c "state.count === 0" file-injector.ts       # expect 1
echo "[7] signature unchanged:";     grep -c "^export async function injectFiles(" file-injector.ts  # expect 1
echo "[8] no strip-language in injectFiles:"; sed -n '/^export async function injectFiles/,/^}/p' file-injector.ts | grep -cE "strip|stripped|start indices"  # expect 0
# Expected counts: 0,0,0,1,1,1,1,0. If [8] is non-zero, a comment still references stripping — re-check Edit A/B.
```

### Level 3: Suite behavior (RUNs again; assertion failures are EXPECTED → M2)

```bash
cd /home/dustin/projects/pi-file-injector
npm test          # == file-injector.test.mjs && import-behavior.test.mjs && relative-imports.test.mjs
# CURRENT (pre-S3): every injectFiles-call case CRASHES with "resolvedIdx is not iterable" (the void spread).
# AFTER S3:        the crash is GONE — the suites RUN to completion. They will FAIL on ~78 stripped-expectation
#                  assertions (e.g. `r.text === "Review a.ts"` should now be `Review #@a.ts`). THAT FAILURE IS
#                  EXPECTED — it is the P1.M2 migration scope (T1/T2/T3). It is NOT an S3 failure; do NOT edit
#                  the tests here. S3's gate is Level 1 (0 typecheck errors) + Level 2 (structural grep).
```

### Level 4: N/A (no display/runtime validation for an internal return-value change in isolation)

```bash
# injectFiles's verbatim return is observable only end-to-end (the stored user message + the custom-message
# block), which requires the green gate (S3) + the M2 test migrations + (optionally) the P1.M1.T2 input-handler
# confirmation. The S3-internal checks are Level 1 (0 typecheck errors) + Level 2 (structural grep) + the
# no-crash behavior in Level 3.
```

## Final Validation Checklist

### Technical Validation (S3-specific)

- [ ] `npm run typecheck` → **0 errors** (the GREEN gate; the lone TS2488 at `:1190` is gone).
- [ ] Structural grep (Level 2): `resolvedIdx` (0); `strippedText` (0); splice `slice(i + 2)` (0); bare `await processTokenStream(` (1); `return { text, images: state.images` (1); `state.count === 0` (1); signature (1); no strip-language in injectFiles (0).
- [ ] Runtime suites no longer crash with `resolvedIdx is not iterable` (Level 3).

### Feature Validation (the contract)

- [ ] `injectFiles` returns the original `text` param on BOTH the count===0 and count>0 paths (verbatim).
- [ ] No `#@` stripping, no appended blocks, no `\n\n---\n\n` in the returned `text` (PRD §6.4/§13.8).
- [ ] The `blocks`/`details` arrays are still populated and returned (the `before_agent_start` handoff is intact).
- [ ] Return TYPE unchanged (same shape); signature unchanged (incl. `bareAt = false`); `state.bareAt` seam intact.

### Cascade Discipline

- [ ] `scanTokens`/`processTokenStream` NOT edited by S3 (S1 owns them); `injectMarkdown` NOT edited by S3 (S2 owns it).
- [ ] The agent applies S3 as the terminal fix after S1 (landed) [+ S2 if it has landed]; the file is GREEN after S3.
- [ ] Test migrations are NOT done here (P1.M2 owns them); stripped-expectation failures post-S3 are expected.

### Code Quality Validation

- [ ] `injectFiles` signature unchanged (`(text, imagesIn, ctx, bareAt = false) => Promise<{text;images;injected;paged;blocks;details}>`).
- [ ] Budget compute, priorPaths seed, State setup, count===0 early return — all UNCHANGED.
- [ ] No new imports/exports (injectFiles stays exported; nothing new). No new dependencies.

### Documentation

- [ ] Comments in `injectFiles` reflect the verbatim contract (§6.4/§13.8) — no "strip"/"stripped"/"start indices" language.
- [ ] No README/user-facing change in S3 (the README verbatim sync is P1.M2.T4; the display-renderer sync is P1.M2.T4).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT stop at a red typecheck BEFORE applying both edits.** The current single TS2488 at `:1190` is the
  S3 fix site — it is expected pre-S3. Apply Edit A + Edit B, THEN run typecheck (expect 0 errors).
- ❌ **Do NOT edit `injectMarkdown` (S2 owns it) or `scanTokens`/`processTokenStream` (S1 owns them).** S3 touches
  ONLY the `injectFiles` body. S2 is parallel and DISJOINT (different function) — do not clobber its work.
- ❌ **Do NOT leave a partial stripping block.** DELETE the entire comment + `let strippedText` + splice loop +
  "JUST the stripped prompt" comment (Edit B is one contiguous oldText→newText). Any survivor = TS2488 (spreading
  void) or TS2304 (`strippedText` undefined) or a logic bug (returning a spliced string).
- ❌ **Do NOT change the count===0 early return.** It already returns the original `text` (`return { text, images:
  imagesIn, ... }`). After Edit B, BOTH paths return `text` — that symmetry is the contract. (Do not "normalize"
  the `images: imagesIn` vs `images: state.images` asymmetry either — it is correct and pre-existing.)
- ❌ **Do NOT change the `processTokenStream(...)` call ARGS** (`{ allowAbsTilde: true, skipCode: false, tryMdExt:
  false, bareAt: false }`). Only the LEFT-HAND binding changes (`const resolvedIdx =` → nothing). The args encode
  "top-level user prompt: cwd base, abs/tilde allowed, no code-skip, exact-only, bare-@ off" (§4.4).
- ❌ **Do NOT remove the `bareAt` param or `state.bareAt`.** `bareAt` is the SEAM `injectMarkdown` reads (S2:
  `bareAt: state.bareAt`). It is unused elsewhere in the injectFiles body but load-bearing for the markdown path.
- ❌ **Do NOT run the .mjs suites as a GREEN gate.** Post-S3 they RUN (crash gone) but FAIL ~78 stripped-expectation
  assertions — that is the P1.M2 migration. Editing the tests here is scope creep (steals M2's work).
- ❌ **Do NOT trust the item's/arch's line numbers** (L1162-1246 / L1225-1246 are approximate; S2 may shift lines
  above injectFiles). Place by the LITERAL text in Edit A / Edit B oldText.
- ❌ **Do NOT edit the module JSDoc above `injectFiles`** (the `/** #@file — Whole-File Injection... */` block).
  It describes the extension's user-facing behavior and is unchanged by this internal return-value edit. (A separate
  stale comment in `injectFile`'s markdown branch — `:973-979`, "strip resolved #@ markers" — describes injectMarkdown's
  OLD behavior; it is owned by injectMarkdown/S2, NOT S3 — leave it.)

---

## Confidence Score: 9/10

A well-scoped deletion + verbatim-return rewrite of ONE function body, with both edits' exact contiguous
oldText→newText verified against the current working tree, the POST-S1 starting state confirmed (processTokenStream
→ `Promise<void>`; the single typecheck error `TS2488` at `:1190` reproduced), and the S2 scope boundary documented
as disjoint. The -1 reserves for the deferred-green discipline nuance (S3 is itself the green gate — unlike S2, S3
IS expected to typecheck 0-errors on its own, but the .mjs suites remain red until M2, which the implementer must
not mistake for an S3 failure) and the parallel-S2 coordination (the injectFiles body text is stable across S2's
injectMarkdown edits, but the agent must not touch injectMarkdown). Two contiguous edits; the implementing agent
re-runs `npm run typecheck` to confirm 0 errors.