---
name: "P1.M1.T2.S3 — injectMarkdown (6-step) + wire markdown into injectFile + cases 15-19"
prd_ref: "PRD §5.6 (Markdown transitive imports), §5.6.1 (code-region detection — REUSED from T2.S1), §4.5 (markdown import rules), §9 (algorithm pseudocode), §11 cases 15-19"
target_file: "./file-injector.ts"   # EDIT IN PLACE — add injectMarkdown; insert MD_EXTS branch in injectFile
target_language: TypeScript (jiti transpile-on-load; no tsconfig/lint/test-framework — the .mjs harness IS the gate)
depends_on: "P1.M1.T2.S1 (DONE: MD_EXTS L40, computeCodeRanges/inCode, scanTokens skipCode/allowAbsTilde) + P1.M1.T2.S2 (DONE/LANDED: estimateImageTokens L360, 3 subtracts in injectFile, gate green at 67). S3 starts POST-T2.S2."
consumed_by: "P1.M1.T2.S4 (shared-budget case 20 reuses injectMarkdown + the injectFiles→injectFile→injectMarkdown recursion; module-surface sync — injectMarkdown is PRIVATE so NO new sanity assert)"
---

# PRP — P1.M1.T2.S3: injectMarkdown (6-step) + wire markdown into injectFile + cases 15-19

> **Scope flag:** ADDITIVE recursion driver. Create ONE new **private** function (`injectMarkdown`, the
> PRD §5.6 six-step algorithm), insert ONE new `else if (MD_EXTS.has(ext))` branch in the existing
> `injectFile` cascade (between image and binary — markdown bypasses the NUL/binary routing so import
> scanning always runs), add markdown fixtures to `buildFixtures`, and add EXACTLY 5 `runCase` blocks
> (PRD §11 cases 15–19). **No new constants** (consume `MD_EXTS` from T2.S1). **No new exports / sanity
> asserts** (injectMarkdown is private; exercised via `injectFiles`). **No new subtract** (emitText owns
> the text cost; T2.S2 owns image/binary). The 67-test suite stays green; +5 markdown cases → **72 passed**.

---

## Goal

**Feature Goal:** Make a delivered `.md`/`.markdown` file an **import source** (PRD §5.6): its decoded
content is scanned for `#@<path>` directives, and each resolved import is itself delivered (and, if
markdown, scanned in turn) — so `#@spec.md` now pulls in everything spec.md references with the same `#@`
directive. Recursion is **relative-only** (§4.5 rule 1), **code-exempt** (§5.6.1, §4.5 rule 3),
**dedup-bounded** (NOT depth-limited — each abs is claimed before its scan, so cycles dedup to verbatim;
§12.13), and **pre-order depth-first** (this file's block, then each import's subtree).

**Deliverable:** A modified `./file-injector.ts` (in-place edit) where:
1. **`async function injectMarkdown(abs, content, state, ctx): Promise<void>`** — PRIVATE (not exported).
   PRD §5.6 six steps: (2) claim self (idempotent); (3) `scanTokens(content, path.dirname(abs),
   { allowAbsTilde: false, skipCode: true }, state)`; (4) strip `#@` from each resolved import marker
   (high→low) → `stripped`; (5) `emitText(abs, stripped, state)` (paged decision on the STRIPPED content);
   (6) recurse depth-first in encounter order: `if (!state.injectedSet.has(r.abs)) await injectFile(r.abs,
   state, ctx)`. Placed near emitText/injectFile (function declarations hoist — any nearby spot is safe).
2. **In `injectFile` (L464–491), a NEW `else if (MD_EXTS.has(ext))` branch inserted BETWEEN the image
   branch (ends at its L481 `subtract(state, estimateImageTokens(resized))`) and `else if (isBinary(buf))`
   (L482):** `await injectMarkdown(abs, buf.toString("utf8"), state, ctx);`. Markdown **bypasses** the
   NUL/binary routing (§5.6 step 1). `state.count++` (L491) is unchanged — runs once per claimed file.
3. **Markdown fixtures added to `buildFixtures`:** `notes.md` (real `#@api.md` + a fenced `#@example.ts`),
   `api.md`, `a.md`/`b.md` (cycle), `notesAbs.md` (`#@/etc/hosts`), `sub/notes.md` + `sub/api.md` (sibling).
4. **EXACTLY 5 new `runCase` blocks (cases 15–19)** using `FIX` (no budget → all whole), asserting block
   order, marker stripping, injected count, and verbatim-unresolved markers.

**Success Definition:** `node ./file-injector.test.mjs` prints `Result: 72 passed, 0 failed.`, exit 0.
The 67 existing cases stay green (S3 is additive; the only behavioral change is markdown files now recurse
— existing `.ts`/`.txt`/`.png`/`.bin`/`.log` fixtures are NOT `.md`, so they are unaffected; the only
NEWly-routed file is markdown, which previously fell through to the text branch and now recurses). The 5
markdown cases (#15–#19) pass.

## Why

- **Transitive context (PRD §5.6 / §4.5).** A spec that says `#@api.md` should pull in api.md's content
  automatically — and if api.md in turn references `#@schema.md`, that too. This is the feature that makes
  `#@spec.md` a one-shot "give me everything this references" anchor. Today a `.md` is plain text (injected
  whole/paged, no scanning); S3 turns it into an import source with the PRD's safety rails (relative-only,
  code-exempt, dedup-bounded).
- **Reuses every T2.S1/T2.S2 primitive.** `scanTokens` already accepts `{ allowAbsTilde, skipCode }`;
  `computeCodeRanges`/`inCode` already implement approximate-CommonMark code-region detection; `emitText`
  already does the paged decision + subtract; `injectFile` already claims abs + classifies. S3 is the
  *assembly* of these into the recursion — no new detection or budget logic.
- **Dedup-bounded recursion (PRD §12.13).** A cycle (`a.md`→`b.md`→`a.md`) terminates because `injectFile`
  claims `a.md` in `injectedSet` *before* scanning it; when `b.md`'s scan reaches `#@a.md`, it is already
  claimed → left verbatim → no re-entry. No depth counter. Each injectable file is processed at most once.

## What

User-visible behavior: a `#@<markdown>.md` token now delivers the markdown **and** everything it imports
(recursively), each as its own `<file>` block, in pre-order (parent's block before its imports'). The
import markers inside a delivered markdown are stripped to the bare path (the `#@` removed, path stays);
unresolved imports (absolute/tilde, inside code, missing, or already-injected) keep `#@` verbatim. With no
budget (the `FIX` mock and the common case), everything is injected whole.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` → `72 passed, 0 failed`, exit 0. The 67 prior cases UNCHANGED (green).
- [ ] `async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void>`
      exists, is **PRIVATE** (no `export`), and implements the PRD §5.6 six steps exactly (claim → scan
      relative-only/outside-code → strip resolved markers → emitText(stripped) → recurse depth-first).
- [ ] `injectFile` has exactly ONE new `else if (MD_EXTS.has(ext))` branch, placed BETWEEN the image
      branch (after its `subtract(state, estimateImageTokens(resized))`) and `else if (isBinary(buf))`.
      Every other line of injectFile (stat/claim/ext/mime/read/images.push/count++/return/catch, the F5
      and image and binary and text branches) is UNTOUCHED.
- [ ] `state.count++` (L491) is unchanged — runs once per claimed file. Markdown's own count bump happens
      in injectFile (after injectMarkdown returns); each import's count bump happens in its own injectFile.
- [ ] NO new subtract in the markdown branch (emitText owns the text cost; T2.S2 owns image/binary).
- [ ] NO new constants (consume `MD_EXTS` from T2.S1). NO new exports / sanity asserts (injectMarkdown private).
- [ ] New markdown cases pass (FIX, no budget): #15 (notes.md→api.md, injected===2, pre-order, marker
      stripped); #16 (fenced `#@example.ts` verbatim, only api.md imported); #17 (a.md↔b.md cycle,
      injected===2 each once, b.md's `#@a.md` verbatim, no loop); #18 (`#@/etc/hosts` ignored relative-only,
      verbatim, injected===1); #19 (sub/notes.md→sub/api.md resolved relative to the md's dir, injected===2).
- [ ] [Mode A] JSDoc on `injectMarkdown` (recursion contract: relative-only, code-exempt, dedup-bounded
      NOT depth-limited, pre-order depth-first; claim is idempotent since injectFile pre-claims; emitText
      runs on the STRIPPED content so directive text doesn't bias the budget).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP includes: the verified POST-T2.S2 starting state (exact lines for the
injectFile cascade L464–491, the wiring anchor = the image branch's `subtract(state,
estimateImageTokens(resized))` line + the `else if (isBinary(buf))` line; emitText at L505; scanTokens at
L387 with the fully-implemented opts; MD_EXTS at L40; injectFile claims abs at L461), the exact
injectMarkdown body (the PRD §9 six-step pseudocode transcribed), the exact one-branch wiring edit, the
exact fixture contents + buildFixtures append point, the 5 case-by-case test specs with exact assertions +
the traced proofs of injected===2 / cycle-termination / relative-resolution, the merged-ctx-irrelevant
note (cases 15–19 use FIX directly), and the verified validation command (`node ./file-injector.test.mjs`).
The implementer edits one source file + appends fixtures + a test section, then runs one command.

### Documentation & References

```yaml
# MUST READ — the six-step algorithm + the safety rails (verbatim pseudocode for injectMarkdown)
- file: PRD.md
  why: "§5.6 is the six-step algorithm (claim → scan relative-only/outside-code → strip → emit on
        stripped → recurse depth-first pre-order). §4.5 narrows markdown imports (relative-only; resolve
        from dirname(importingMarkdownAbs); code-exempt). §5.6.1 = code-region detection (REUSED from
        T2.S1 — do not reimplement). §5.6 step 1 = 'markdown is always treated as text (bypasses the
        NUL/binary routing so import scanning always runs)' → the injectFile branch MUST precede isBinary.
        §10 edge rows + §11 cases 15-19 are the behavior spec for the tests. §9 gives the injectMarkdown
        pseudocode verbatim."
  section: "### 5.6 Markdown transitive imports (+ §4.5 + §5.6.1 + §9 algorithm + §11 rows 15-19)"
  critical: "Step 5 emits on the STRIPPED content (so the directive text the model won't see does not bias
             the budget). Step 6 recurses in ENCOUNTER ORDER (pre-order: this block, then each import's
             subtree). Step 2 'claim self' is satisfied by injectFile's pre-claim (L461) — the injectMarkdown
             claim is idempotent (Set.add). Cycle termination is by dedup (§12.13), NOT a depth counter."

# MUST READ — the MI-2 insertion-point contract (injectMarkdown signature + the wiring point)
- file: plan/003_4624515bcd82/architecture/codebase_insertion_points.md
  why: "## MI-2 'New recursion driver' pins injectMarkdown(abs, content, state, ctx): Promise<void> and
        its six steps. ## MI-2 'Wire markdown into injectFile' pins: 'insert the markdown branch AFTER
        image, BEFORE binary: else if (MD_EXTS.has(ext)) { await injectMarkdown(...) }. Markdown bypasses
        NUL/binary routing.' Also confirms 'injectMarkdown MAY be kept private (exercised indirectly via
        injectFiles)' and the test fixtures list."
  section: "## MI-2 — Markdown imports + total-size budget → 'New recursion driver' + 'Wire markdown into injectFile'"
  critical: "The branch order empty-image → image → MARKDOWN → binary → text is load-bearing (§5.6 step 1 /
             system_context §5.3 fact 3). Do NOT place markdown after isBinary — a .md with a NUL byte would
             then be a binary note (no import scan)."

# MUST READ — the recursion/budget facts + the FIX mock (no-budget → inject whole)
- file: plan/003_4624515bcd82/architecture/system_context.md
  why: "§5 fact 2 'Recursion is bounded by dedup, not depth — claims its own abs before scanning;
        self-imports dedup to verbatim; no depth counter (§12.13)'. §5 fact 3 'Markdown bypasses the §5.1
        NUL/binary routing; order = empty-image → image → markdown → binary → text'. §5 fact 5 'Scan-before-
        inject at top level; markdown does its own scan+strip+emit+recurse in injectMarkdown'. §1 confirms
        the external contract injectFiles(...) is preserved (S3 does not change its signature/return)."
  section: "## 5 Key Architectural Facts (facts 2, 3, 5) + ## 1"
  critical: "Cases 15-19 use FIX={cwd:TMPDIR} (§6 mock pattern) → remaining===null → emitText injects whole
             (no paging). So injected===count, paged===0 for all 5. The paged path is exercised in S4's
             case 20, NOT here."

# MUST READ — the contract for what exists when S3 begins (POST-T2.S2, VERIFIED LANDED)
- file: plan/003_4624515bcd82/P1M1T2S2/PRP.md
  why: "S2 is the CONTRACT and is DONE: estimateImageTokens (exported), 3 subtract wirings in injectFile
        (F5/image/binary), gate green at 67. S3 CONSUMES these — does NOT re-add any subtract (emitText
        owns text), does NOT touch the image/binary branches, does NOT redeclare MD_EXTS (T2.S1 owns it).
        S3 only ADDS injectMarkdown + the MD_EXTS branch + fixtures + 5 tests."
  critical: "S3's markdown branch is DISJOINT from S2's subtract lines (S2: inside F5/image/binary branches;
             S3: a new branch between image and binary). No merge conflict."

# MUST READ — the scanTokens/computeCodeRanges contract S3 calls (T2.S1, DONE)
- file: plan/003_4624515bcd82/P1M1T2S1/PRP.md
  why: "T2.S1 is the CONTRACT for scanTokens' opts: skipCode:true → precompute code regions + skip inCode
        matches; allowAbsTilde:false → drop / or ~ tokens. injectMarkdown calls
        scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state) — these opts are already
        implemented. MD_EXTS is the module const from T2.S1. S3 does NOT touch scanTokens/computeCodeRanges."
  critical: "scanTokens returns { index; abs }[] where index is m.index (the position of '#', since the
             lookbehind/anchor is zero-width). Stripping slice(0, index) + slice(index+2) removes exactly '#@'."

# MUST READ — the full first-hand verification (this subtask): injectMarkdown body, traces, fixtures
- file: plan/003_4624515bcd82/P1M1T2S3/research/research_notes.md
  why: "§1 POST-T2.S2 verified state (exact injectFile lines + the wiring anchor); §2 the EXACT injectMarkdown
        body (transcribed from PRD §9); §3 the one-branch wiring edit; §4 fixture design + per-case TRACES
        proving injected===2 / cycle-termination / relative-resolution; §5 no-conflict with S2/S4."

# EXTERNAL — the CommonMark rules the code-region detection approximates (already shipped by T2.S1)
- url: https://spec.commonmark.org/0.30/#fenced-code-blocks
  why: "T2.S1's computeCodeRanges approximates this (fenced blocks + inline code are code → #@ inside is
        exempt). S3 REUSES it via scanTokens(skipCode:true). No change — cite for the code-exempt rationale
        (the escape hatch for markdown that documents the #@ syntax itself, §4.5 rule 3)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDIT (POST-T2.S2 ~700 lines): MD_EXTS L40; scanTokens L387 (opts DONE);
│                             #    injectFile L450-498 [F5 L464 / image L470 (+subtract L481) / binary
│                             #    L482 (+subtract) / text L488]; emitText L505 (owns subtract);
│                             #    estimateImageTokens L360 (S2); injectMarkdown DOES NOT EXIST (S3 adds).
├── file-injector.test.mjs    # gate (1162 lines; 67 runCase; 16 sanity asserts L113-128). EDIT: add md
│                             #   fixtures in buildFixtures (L197-238) + path consts (after L246) + a new
│                             #   MARKDOWN TRANSITIVE IMPORTS section (after CC9 ~L1137, before summary L1141).
├── package.json              # { "pi": { "extensions": ["file-injector.ts"] } } — untouched
├── PRD.md                    # read-only
├── README.md                 # untouched (Mode B docs are T3.S1)
└── plan/003_4624515bcd82/
    ├── architecture/
    │   ├── codebase_insertion_points.md   # ← MI-2 injectMarkdown sig + wiring point
    │   ├── system_context.md              # ← dedup-bounded recursion + FIX mock + branch order
    │   └── external_deps.md               # ← no new deps; path.dirname already imported
    ├── P1M1T2S1/PRP.md                    # ← scanTokens opts + MD_EXTS contract (DONE)
    ├── P1M1T2S2/PRP.md                    # ← estimateImageTokens + subtracts contract (DONE/LANDED)
    └── P1M1T2S3/
        ├── research/research_notes.md     # ← full first-hand verification (this subtask)
        └── PRP.md                          # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — add private `async function injectMarkdown(abs, content, state, ctx)`
                          #                  (place near emitText ~L537, before injectFiles L539; hoisted);
                          #                  insert `else if (MD_EXTS.has(ext)) { await injectMarkdown(...); }`
                          #                  branch in injectFile between the image branch (after its L481
                          #                  subtract) and `else if (isBinary(buf))` (L482). NO other changes.
file-injector.test.mjs    # MODIFIED — add markdown fixtures inside buildFixtures (notes.md/api.md/a.md/
                          #                  b.md/notesAbs.md/sub/notes.md/sub/api.md) + a `sub/` mkdir;
                          #                  add path consts (NOTES/API/A_MD/B_MD/NOTES_ABS/SUB_NOTES/SUB_API)
                          #                  + a `countFileBlocks` helper + a MARKDOWN TRANSITIVE IMPORTS
                          #                  section (5 runCase blocks: cases 15-19) after CC9, before summary.
# No other files. No new files. No new dependencies.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — MD_EXTS ALREADY EXISTS (file-injector.ts L40, module-scope const from T2.S1, NOT exported).
//   Its JSDoc says "consumed by the markdown branch T2.S3 adds to injectFile." Do NOT redeclare it.
//   Reference it directly in the injectFile branch: `else if (MD_EXTS.has(ext))`.

// CRITICAL — the markdown branch MUST be BEFORE `else if (isBinary(buf))`, NOT after. PRD §5.6 step 1:
//   "Markdown is always treated as text (it bypasses the §5.1 NUL/binary routing so import scanning
//   always runs)." If you place it AFTER isBinary, a .md with a stray NUL byte becomes a binary note
//   and its imports are never scanned. The order is: empty-image (F5) → image (F3) → MARKDOWN → binary → text.
//   (system_context §5.3 fact 3; codebase_insertion_points.md "Wire markdown into injectFile".)

// CRITICAL — Step 2 "claim self" is IDEMPOTENT. injectFile ALREADY claims abs at L461
//   (`state.injectedSet.add(abs)`) BEFORE the classify cascade reaches the markdown branch. The
//   `state.injectedSet.add(abs)` at the top of injectMarkdown is therefore a redundant no-op (Set.add is
//   idempotent) — INCLUDE IT ANYWAY (it matches the PRD §5.6 step-2 contract, makes injectMarkdown
//   self-contained against self-imports, and costs nothing). Do NOT add a second `state.count++` or a
//   depth counter — count is bumped once by injectFile (L491); termination is by dedup (§12.13).

// CRITICAL — emitText is called with the STRIPPED content (Step 5), NOT the raw content. PRD §5.6 step 5:
//   "Apply the §5.5 inline-vs-paged decision to the STRIPPED content (so directive text the model won't
//   see doesn't bias the budget)." emitText(abs, stripped, state) — NOT emitText(abs, content, state).

// CRITICAL — the strip is on THIS markdown file's content (Step 4), a DIFFERENT scope from the top-level
//   prompt strip. injectMarkdown strips `#@` from IMPORT markers in the markdown content (high→low slice
//   on each record.index). injectFiles strips `#@` from TOP-LEVEL markers in the user prompt. They are
//   independent; do NOT conflate them. Unresolved/deduped/absolute/inside-code markers keep `#@` verbatim
//   (they were never in records, so the strip never touches them).

// CRITICAL — PRE-ORDER depth-first. Step 5 (emit this block) runs BEFORE Step 6 (recurse into imports).
//   So the parent's <file> block is pushed BEFORE its imports' blocks. (notes.md block, then api.md block.)
//   Do NOT reorder: emitting after recursion would put children before the parent (wrong context order).

// CRITICAL — scanTokens is called with EXACTLY { allowAbsTilde: false, skipCode: true } and baseDir =
//   path.dirname(abs). allowAbsTilde:false → / and ~ imports are ignored (relative-only, §4.5 rule 1,
//   case 18). skipCode:true → computeCodeRanges runs + inCode matches are skipped (code-exempt, §5.6.1,
//   case 16). baseDir = dirname(abs) → imports resolve relative to the MARKDOWN's dir (§4.5 rule 2, case 19),
//   NOT cwd. These opts + baseDir are the entire difference between a top-level scan and a markdown scan.

// CRITICAL — injectMarkdown is PRIVATE (no `export`). The item §6 DOCS explicitly says "Keep injectMarkdown
//   private if not unit-tested directly (it is exercised via injectFiles)." So NO sanity assert, NO direct
//   mod.injectMarkdown call in tests. All 5 cases go through mod.injectFiles(prompt, [], FIX). (Contrast:
//   injectFile/emitText/scanTokens ARE exported + in the sanity list; injectMarkdown is the private driver
//   like processTokenStream.)

// GOTCHA — `ext` and `buf` are IN SCOPE at the markdown-branch insertion site (declared L462-463 inside
//   injectFile: `const ext = extOf(abs); const mime = …; … const buf = await fs.readFile(abs);`). The
//   branch reads `MD_EXTS.has(ext)` and passes `buf.toString("utf8")` to injectMarkdown. `ctx` is injectFile's
//   parameter (threaded through to injectMarkdown for the recursive injectFile calls).

// GOTCHA — `state.count++` (L491) is SHARED across the recursion. For notes.md importing api.md:
//   injectFile(notes.md) → injectMarkdown → recurse injectFile(api.md) [api.md count++ =1] → back in
//   injectFile(notes.md) [notes.md count++ =2]. Final count===2. injectMarkdown/emitText do NOT bump count.
//   So a markdown file with N imports → injected === 1 + N (self + imports). This is what the tests assert.

// GOTCHA — recursion termination is GUARANTEED without a depth counter. injectFile claims abs (L461) before
//   scanning; scanTokens checks state.injectedSet and leaves already-claimed paths verbatim (records excludes
//   them). So a cycle (a.md→b.md→a.md) injects each ONCE: a.md claimed before its scan; b.md's `#@a.md` sees
//   a.md in injectedSet → verbatim → records=[] → no recurse into a.md. (§12.13; case 17.)

// GOTCHA — sub/api.md MUST have DISTINCT content from the top-level api.md. Case 19 proves imports resolve
//   relative to the markdown's dir (sub/notes.md's `#@api.md` → sub/api.md, NOT TMPDIR/api.md). If both
//   api.md files had identical content, a wrong (cwd-based) resolution would still inject plausible-looking
//   content and the test would pass for the wrong reason. sub/api.md content = "Sibling API in sub/.";
//   top-level api.md = "Top-level API surface." — the test asserts the former is present and the latter is NOT.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step, no tsconfig, no lint, no test framework.
//   The .mjs harness imports file-injector.ts directly. jiti transpiles-on-load. A SYNTAX error or an
//   UNDEFINED-IDENTIFIER reference (e.g. referencing MD_EXTS, or injectMarkdown, or injectFile before
//   declaration) fails the harness import → sanity asserts never run → exit non-zero. TS `async function`
//   declarations HOIST, so injectMarkdown can be placed anywhere in the file and still be callable from
//   injectFile; place it near emitText/injectFile for readability. The ONLY gate is `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### `injectMarkdown` — private recursion driver (place near emitText ~L537, before injectFiles L539)

```ts
/**
 * PRD §5.6 — markdown transitive imports (the six-step algorithm). Called by injectFile's markdown branch
 * (a delivered .md/.markdown is an import source). Recursion contract:
 *   • RELATIVE-ONLY (§4.5 rule 1): imports starting with / or ~ are ignored (left verbatim) — only relative
 *     tokens resolve. (Contrast: top-level user tokens allow / and ~.)
 *   • CODE-EXEMPT (§5.6.1 / §4.5 rule 3): a #@ inside a fenced block or inline code span is NOT an import
 *     — left verbatim, never stripped. (Detection is approximate-CommonMark, reused from scanTokens.)
 *   • DEDUP-BOUNDED, NOT depth-limited (§12.13): each abs is claimed in state.injectedSet BEFORE its scan,
 *     so a self-import or cycle (a.md→b.md→a.md) dedups to verbatim and cannot recurse infinitely. The set
 *     of injectable files is finite and each is processed at most once — termination is guaranteed without
 *     a depth counter.
 *   • PRE-ORDER depth-first: this file's block is emitted (Step 5) BEFORE recursing into imports (Step 6),
 *     so the model sees a parent's context before the detail it pulls in.
 *
 * Six steps (PRD §5.6):
 *   2. Claim self (idempotent: injectFile pre-claimed abs; included for contract self-containedness).
 *   3. scanTokens(content, dirname(abs), { allowAbsTilde:false, skipCode:true }) → resolved import records.
 *   4. Strip '#@' from each resolved marker (high→low, leaving the path) → `stripped` = block content.
 *      Unresolved/deduped/absolute/inside-code markers keep '#@' verbatim (never in records).
 *   5. emitText(abs, stripped, state) — the paged decision runs on the STRIPPED content (so directive text
 *      the model won't see does not bias the budget). emitText owns the subtract + paged bump (NOT count).
 *   6. Recurse into imports in ENCOUNTER order: if not already claimed, await injectFile(abs) (which claims,
 *      classifies, bumps count, and recurses again if the import is itself markdown).
 *
 * PRIVATE — exercised indirectly via injectFiles (PRD §11 cases 15-19). Does NOT bump count (injectFile
 * owns the single count++ per claimed file; imports bump count in their own injectFile).
 *
 * @param abs     the importing markdown's absolute path (already claimed by injectFile; resolution base = dirname)
 * @param content the markdown's decoded UTF-8 content (buf.toString("utf8") from injectFile)
 * @param state   the shared State (blocks/images/injectedSet/remaining/count/paged) threaded across the prompt
 * @param ctx     threaded to the recursive injectFile calls (cwd unused — imports resolve from dirname(abs))
 */
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void> {
  // Step 2 — CLAIM SELF (idempotent: injectFile already added abs; included per PRD §5.6 step-2 contract).
  state.injectedSet.add(abs);

  const dir = path.dirname(abs); // §4.5 rule 2 — imports resolve relative to the markdown's directory, not cwd

  // Step 3 — scan for imports: relative-only (allowAbsTilde:false), outside code (skipCode:true).
  const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);

  // Step 4 — strip '#@' from each resolved import marker (high→low so earlier offsets stay valid), leaving
  // the path. `stripped` becomes THIS file's block content.
  let stripped = content;
  for (const r of [...records].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is the '#' (lookbehind is zero-width)
  }

  // Step 5 — emit THIS file's block. The paged decision runs on the STRIPPED content (§5.6 step 5).
  emitText(abs, stripped, state); // emitText owns formatTextFileBlock + subtract + the paged head/directive + state.paged++

  // Step 6 — recurse into imports, depth-first, ENCOUNTER ORDER (pre-order). Each record.abs already passed
  // dedup at scan time; the injectedSet re-check is belt-and-suspenders (cross-file dedup since the scan).
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(r.abs, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
}
```

> **NOTE:** `scanTokens` (L387), `emitText` (L505), `injectFile` (L450), `path` (imported L5), `State`/`Ctx`
> (types) are all in scope. `MD_EXTS` is NOT referenced inside injectMarkdown (only in the injectFile branch).
> Place injectMarkdown anywhere in the helper region; `async function` declarations hoist, so even placing it
> before injectFile works. Recommended: immediately after emitText (~L537), before injectFiles (L539), so the
> textual order reads injectFile → emitText → injectMarkdown → injectFiles.

### `injectFile` — insert the markdown branch (one surgical edit, between image and binary)

The POST-T2.S2 image/binary region (showing the EXACT anchor):

```ts
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
    } else if (isBinary(buf)) {
      // BINARY (PRD §5.3) — note, no decoded garbage (em dash U+2014)
```

**S3 edit — insert the markdown branch between those two lines:**

```ts
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
    } else if (MD_EXTS.has(ext)) {
      // MARKDOWN (PRD §5.6) — text block + transitive imports. Markdown bypasses the §5.1 NUL/binary routing
      // so import scanning always runs (§5.6 step 1). injectMarkdown (§5.6 six steps): claim self → scan
      // relative-only imports outside code → strip resolved #@ markers → emit this block (paged decision on
      // the STRIPPED content) → recurse depth-first (pre-order). Recursion is dedup-bounded (each abs claimed
      // before its scan; cycles dedup to verbatim), NOT depth-limited. injectFile owns the count++ + the claim.
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
    } else if (isBinary(buf)) {
      // BINARY (PRD §5.3) — note, no decoded garbage (em dash U+2014)
```

Leave EVERY other line of injectFile UNTOUCHED: the stat/claim (L454-461), ext/mime (L462-463), the F5 and
image and binary and text branches, `state.count++` (L491), `return true`, the try/catch. **Do NOT add a
subtract in the markdown branch** (injectMarkdown→emitText owns the text cost; T2.S2 owns image/binary).

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD private injectMarkdown to file-injector.ts (near emitText ~L537, before injectFiles L539)
  - IMPLEMENT: async function injectMarkdown(abs, content, state, ctx): Promise<void> per the Blueprint —
            Step 2 claim (idempotent); Step 3 scanTokens(content, path.dirname(abs), {allowAbsTilde:false,
            skipCode:true}, state); Step 4 strip high→low → stripped; Step 5 emitText(abs, stripped, state);
            Step 6 for-each-record `if (!state.injectedSet.has(r.abs)) await injectFile(r.abs, state, ctx)`.
  - NAMING: injectMarkdown (camelCase; private — NO `export`).
  - PLACEMENT: immediately after emitText, before injectFiles. (async function declarations hoist; any
            nearby spot is safe, but this reads cleanest.)
  - DEPENDENCIES: scanTokens (L387), emitText (L505), injectFile (L450), path (L5), State/Ctx (types),
            MD_EXTS (L40 — referenced ONLY in injectFile's branch, not in injectMarkdown). ALL already present.
  - JSDOC: [Mode A] cite PRD §5.6; spell the recursion contract (relative-only, code-exempt, dedup-bounded
            NOT depth-limited, pre-order depth-first); note Step 2 claim is idempotent (injectFile pre-claims);
            note Step 5 runs on the STRIPPED content; note it does NOT bump count (injectFile owns count++).
  - GOTCHA: do NOT add `state.count++` or a depth counter inside injectMarkdown. count is bumped by injectFile
            (L491) once per claimed file; imports bump it in their own injectFile.

Task 2: INSERT the MD_EXTS branch in injectFile (between the image branch's L481 subtract and L482 isBinary)
  - EDIT: insert `} else if (MD_EXTS.has(ext)) { await injectMarkdown(abs, buf.toString("utf8"), state, ctx); }`
            (with the JSDoc comment per the Blueprint) between `subtract(state, estimateImageTokens(resized));`
            and `} else if (isBinary(buf)) {`.
  - PRESERVE: every other line of injectFile (stat/claim/ext/mime/read/F5/image/binary/text branches/count++/
            return/catch). The cascade ORDER becomes F5 → image → MARKDOWN → binary → text (load-bearing).
  - DEPENDENCIES: MD_EXTS (L40), injectMarkdown (Task 1). ext + buf + ctx are in scope (declared L462-463 / param).
  - GOTCHA: the branch MUST be BEFORE isBinary (markdown bypasses NUL/binary routing, §5.6 step 1). A .md with
            a stray NUL byte must still be scanned for imports — placing it after isBinary would route such a
            file to the binary note and skip its imports.
  - VERIFY (after Task 2): the gate MUST still be 67 passed, 0 failed. NO existing fixture is .md, so the new
            branch is inert for all 67 cases — they are byte-for-byte identical to POST-T2.S2. (If any case
            flips, you disturbed injectFile beyond the one inserted branch — diff against the Blueprint.)

Task 3: ADD markdown fixtures to file-injector.test.mjs buildFixtures (inside the function, ~before the
        huge.log computation, OR alongside the existing writeFileSync calls at L207-219)
  - ADD (simple writeFileSync + one mkdir, matching the existing fixture style):
      fsSync.writeFileSync(path.join(TMPDIR, "notes.md"), "# Notes\n\nImports #@api.md here.\n\n```\n#@example.ts\n```\n");
      fsSync.writeFileSync(path.join(TMPDIR, "api.md"), "# API\n\nTop-level API surface.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "a.md"), "# A\n\nRefs #@b.md.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "b.md"), "# B\n\nBack #@a.md.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "notesAbs.md"), "# Abs\n\nIgnored #@/etc/hosts here.\n");
      fsSync.mkdirSync(path.join(TMPDIR, "sub"), { recursive: true });   // match the existing src/ mkdir
      fsSync.writeFileSync(path.join(TMPDIR, "sub", "notes.md"), "# Sub Notes\n\nSee #@api.md.\n");
      fsSync.writeFileSync(path.join(TMPDIR, "sub", "api.md"), "# Sub API\n\nSibling API in sub/.\n");
  - GOTCHA: sub/api.md content ("Sibling API in sub/.") is DELIBERATELY distinct from top-level api.md
            ("Top-level API surface.") — case 19 asserts the former is present and the latter is NOT, proving
            resolution is relative to the markdown's dir (not cwd).
  - GOTCHA: notes.md has BOTH a real `#@api.md` (prose) AND a fenced `#@example.ts` (code-exempt). It serves
            BOTH case 15 (injected===2: notes.md + api.md; example.ts is code → skipped) and case 16 (the
            fenced `#@example.ts` left verbatim). Do NOT split into two fixtures.
  - PRESERVE: the existing fixtures (a.ts/b.ts/a.txt/pic.png/data.bin/empty.txt/fake.png/empty.png/src/) and
            the huge.log computation. Append the markdown writes among them (order does not matter).

Task 4: ADD path constants + a countFileBlocks helper to file-injector.test.mjs (after the existing path
        constants block, ~after `const SRC = ...; const FIX = { cwd: TMPDIR };` at L245-246)
  - ADD:
      const NOTES = path.join(TMPDIR, "notes.md");
      const API = path.join(TMPDIR, "api.md");
      const A_MD = path.join(TMPDIR, "a.md");
      const B_MD = path.join(TMPDIR, "b.md");
      const NOTES_ABS = path.join(TMPDIR, "notesAbs.md");
      const SUB_NOTES = path.join(TMPDIR, "sub", "notes.md");
      const SUB_API = path.join(TMPDIR, "sub", "api.md");
      function countFileBlocks(text, abs) {
        return (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
      }
  - PATTERN: the path constants match A_TS/B_TS/HUGE/etc. (L226-244). countFileBlocks dedupes the inline
            regex-count pattern used by F1/F1c/DUP1/etc. (escape-special-chars + match length).

Task 5: ADD the MARKDOWN TRANSITIVE IMPORTS test section to file-injector.test.mjs
  - PLACE: a new section AFTER CC9's closing `});` (~L1137) and BEFORE the `// 10. Summary ...` comment
            at L1141. Heading: `// ── MARKDOWN TRANSITIVE IMPORTS (PRD §5.6) — cases 15-19 (FIX, no budget) ──`
  - IMPLEMENT: EXACTLY 5 runCase blocks (15-19), each calling `mod.injectFiles(prompt, [], FIX)`. Per the
            per-case specs in "Test Case Specs" below. Use the established runCase(n, name, fn) form with
            numeric n (15-19) to match PRD §11 rows. Use countFileBlocks + indexOf for ordering/counts.
  - GOTCHA: all 5 use FIX ({ cwd: TMPDIR }, no budget) → emitText injects WHOLE → injected===count, paged===0.
            Do NOT use PAGED_FIX (the shared-budget paged case is S4's case 20, NOT here).
  - GOTCHA: for marker-stripping assertions, check a UNIQUE substring of the stripped content (e.g. "Imports
            api.md here.") AND the negation ("Imports #@api.md here." must NOT appear) — robust against the
            fenced `#@example.ts` which IS left verbatim in the same notes.md block.
  - PRESERVE: every existing test case + the 16 sanity asserts + the summary/exit logic.

Task 6: VERIFY — run the gate
  - RUN: cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs
  - EXPECT: `Result: 72 passed, 0 failed.` (67 + 5), exit 0.
  - CONFIRM: the 67 original cases ALL stay green (the new MD_EXTS branch is inert for non-.md fixtures; the
            only NEWly-routed files are .md). If ANY original case flips, you disturbed injectFile beyond the
            one inserted branch, or redeclared MD_EXTS/estimateImageTokens — diff injectFile against the Blueprint.
```

### Test Case Specs (the 5 runCase blocks — exact assertions)

```js
// Case 15 — md import: notes.md imports api.md → both blocks, marker stripped, injected===2.
await runCase(15, "md import: notes.md imports api.md → both blocks (pre-order), marker stripped, injected=2", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX);
  assert(r.injected === 2, `expected injected===2 (notes.md + api.md), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Review notes.md"), "top-level #@notes.md marker stripped to notes.md");
  const iNotes = r.text.indexOf('<file name="' + NOTES + '">');
  const iApi = r.text.indexOf('<file name="' + API + '">');
  assert(iNotes !== -1 && iApi !== -1, "both notes.md and api.md blocks must be present");
  assert(iNotes < iApi, "notes.md block must appear BEFORE api.md block (pre-order depth-first: parent then import)");
  // the import marker inside notes.md is stripped to the bare path (the fenced #@example.ts is left verbatim)
  assert(r.text.includes("Imports api.md here."), "notes.md block: resolved import marker stripped to api.md");
  assert(!r.text.includes("Imports #@api.md here."), "the resolved import marker must NOT retain #@");
});

// Case 16 — md code-exempt: #@example.ts inside a fenced block is left verbatim; only api.md is imported.
await runCase(16, "md code-exempt: fenced #@example.ts left verbatim; only api.md imported", async () => {
  const r = await mod.injectFiles("Review #@notes.md", [], FIX);  // same notes.md as #15
  assert(r.injected === 2, `only notes.md + api.md injected (example.ts is code-exempt), got ${r.injected}`);
  // the fenced #@example.ts is left VERBATIM in the notes.md block (code-region exemption, §5.6.1)
  assert(r.text.includes("#@example.ts"), "the fenced #@example.ts must be left VERBATIM (code-exempt, not stripped)");
  // example.ts is never imported (code-exempt → never resolved, never stat'd; it is not even a fixture)
  assert(!r.text.includes('<file name="' + path.join(TMPDIR, "example.ts") + '">'),
    "example.ts must NOT be injected (inside a fenced block → code-exempt)");
});

// Case 17 — md cycle: a.md ↔ b.md → each injected once, b.md's #@a.md verbatim, no loop, injected===2.
await runCase(17, "md cycle: a.md↔b.md → each once, b.md's #@a.md verbatim, no loop, injected=2", async () => {
  const r = await mod.injectFiles("Start #@a.md", [], FIX);
  assert(r.injected === 2, `a.md + b.md injected once each (cycle terminates via dedup), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  const iA = r.text.indexOf('<file name="' + A_MD + '">');
  const iB = r.text.indexOf('<file name="' + B_MD + '">');
  assert(iA !== -1 && iB !== -1, "both a.md and b.md blocks present");
  assert(iA < iB, "a.md block before b.md block (pre-order: a.md then its import b.md)");
  assert(countFileBlocks(r.text, A_MD) === 1, `a.md must appear exactly ONCE (dedup), got ${countFileBlocks(r.text, A_MD)}`);
  assert(countFileBlocks(r.text, B_MD) === 1, `b.md must appear exactly ONCE (dedup), got ${countFileBlocks(r.text, B_MD)}`);
  // b.md's #@a.md is LEFT VERBATIM: a.md was claimed (in injectFile) before b.md scanned it → dedup → verbatim.
  assert(r.text.includes("Back #@a.md."), "b.md's #@a.md must be left VERBATIM (a.md already injected → deduped, NOT stripped)");
});

// Case 18 — md abs rejected: #@/etc/hosts inside notesAbs.md is ignored (relative-only), verbatim, injected===1.
await runCase(18, "md abs rejected: #@/etc/hosts ignored (relative-only), verbatim, only notesAbs.md injected", async () => {
  const r = await mod.injectFiles("Read #@notesAbs.md", [], FIX);
  assert(r.injected === 1, `only notesAbs.md injected (absolute import ignored), got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  // the #@/etc/hosts marker is left VERBATIM (relative-only rule fires BEFORE resolution/stat)
  assert(r.text.includes("#@/etc/hosts"), "the absolute #@/etc/hosts must be left VERBATIM (relative-only, not resolved)");
  assert(!r.text.includes('<file name="/etc/hosts">'), "/etc/hosts must NOT be injected (relative-only rule)");
});

// Case 19 — md relative base: sub/notes.md imports api.md → resolved as sub/api.md (the md's dir), injected===2.
await runCase(19, "md relative base: sub/notes.md's #@api.md → sub/api.md (md's dir, not cwd), injected=2", async () => {
  const r = await mod.injectFiles("Read #@sub/notes.md", [], FIX);
  assert(r.injected === 2, `sub/notes.md + sub/api.md injected, got ${r.injected}`);
  assert(r.paged === 0, `no paging without budget, got paged=${r.paged}`);
  assert(r.text.startsWith("Read sub/notes.md"), "top-level #@sub/notes.md marker stripped to sub/notes.md");
  const iSubNotes = r.text.indexOf('<file name="' + SUB_NOTES + '">');
  const iSubApi = r.text.indexOf('<file name="' + SUB_API + '">');
  assert(iSubNotes !== -1 && iSubApi !== -1, "both sub/notes.md and sub/api.md blocks present");
  assert(iSubNotes < iSubApi, "sub/notes.md block before sub/api.md block (pre-order)");
  // CRITICAL: api.md resolved as sub/api.md (relative to the markdown's dir), NOT TMPDIR/api.md.
  assert(r.text.includes("Sibling API in sub/."), "sub/api.md's DISTINCT content present (proves resolution relative to md dir)");
  assert(!r.text.includes("Top-level API surface."), "the top-level api.md must NOT be injected (resolution is relative to the md's dir)");
  // sub/notes.md's #@api.md marker stripped to api.md
  assert(r.text.includes("See api.md."), "sub/notes.md's import marker stripped to api.md");
  assert(!r.text.includes("See #@api.md."), "the resolved import marker must NOT retain #@");
});
```

### Integration Points

```yaml
FILE EDITS:
  - modify: file-injector.ts
    add (private function, after emitText ~L537, before injectFiles L539): async function injectMarkdown
    edit (injectFile, between the image branch's L481 subtract and `else if (isBinary(buf))` L482):
          insert `else if (MD_EXTS.has(ext)) { await injectMarkdown(abs, buf.toString("utf8"), state, ctx); }`
    preserve: MD_EXTS (L40), scanTokens (L387, opts already DONE), emitText (L505, owns subtract),
              estimateImageTokens (L360, S2), the 3 injectFile subtracts (S2), injectFiles (signature/return
              UNCHANGED), State/subtract/processTokenStream, the factory, the autocomplete provider.

  - modify: file-injector.test.mjs
    add (buildFixtures, ~L207-219 among the writeFileSync calls): notes.md, api.md, a.md, b.md, notesAbs.md,
          sub/ mkdir, sub/notes.md, sub/api.md (exact contents per Task 3).
    add (after the path constants ~L246): NOTES/API/A_MD/B_MD/NOTES_ABS/SUB_NOTES/SUB_API consts + countFileBlocks helper.
    add (new section, after CC9 ~L1137, before summary L1141): MARKDOWN TRANSITIVE IMPORTS — 5 runCase (15-19).
    preserve: the 16 sanity asserts + every existing test case + the summary/exit logic.

NO OTHER CHANGES:
  - package.json: untouched
  - README.md: untouched (Mode B docs are T3.S1)
  - no new files, no new dependencies, no new constants, no new exports/sanity asserts

BEHAVIOR FOR NON-MARKDOWN FILES: UNCHANGED.
  - The new MD_EXTS branch is inert for every existing fixture (a.ts/b.ts/a.txt/pic.png/data.bin/empty.txt/
    fake.png/empty.png/huge.log) — none are .md/.markdown. They fall through to image/binary/text exactly as
    POST-T2.S2. This is why all 67 existing cases stay green byte-for-byte.

BEHAVIOR FOR MARKDOWN FILES: NEW (recursion). A delivered .md now also delivers its resolved imports.
  - count = 1 (self) + N (resolved imports). paged depends on budget (FIX → 0; the paged case is S4 #20).
  - Import markers stripped to bare path; unresolved/deduped/absolute/inside-code markers keep #@ verbatim.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No tsc/lint gate. The .mjs harness loads file-injector.ts via jiti (Pi's loader), transpiling+running
# the TS on import. A SYNTAX error or an UNDEFINED-IDENTIFIER reference (e.g. referencing MD_EXTS, or
# injectMarkdown before its declaration, or a typo'd helper) surfaces as the harness failing to import —
# the sanity asserts never run → process exits non-zero with a jiti/TS error.

cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | head -25
# Expected: the 16 sanity asserts pass, then the case matrix begins (now incl. rows 15-19).
# A jiti/TS error here means: (a) injectMarkdown referenced before declaration (place near emitText —
# async function declarations hoist, but keep it tidy), (b) a typo (injectMarkdown/MD_EXTS/scanTokens),
# (c) malformed syntax in the inserted branch. READ the error, fix, re-run.
```

### Level 2: The Regression Gate (the ONLY gate that matters)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected EXACTLY:
#   ... (matrix rows, incl. your new case 15 / 16 / 17 / 18 / 19 rows) ...
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 72 passed, 0 failed.        # 67 (POST-T2.S2) + 5 markdown cases
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL: the 67 original cases MUST all stay green. If the count is <67, a prior case regressed:
#   - You disturbed injectFile beyond the one inserted MD_EXTS branch (e.g. changed the cascade order,
#     moved state.count++, added a subtract to the markdown branch). Diff injectFile against the Blueprint.
#   - You redeclared MD_EXTS or estimateImageTokens (jiti "Identifier already declared" → import fails
#     BEFORE any test runs → you'd see 0 passed, not <67).
# If it's exactly 72, you're done. The sanity list stays at 16 (injectMarkdown is private → no assert added).
```

### Level 3: Targeted invariant checks (if any case regresses)

```bash
# A prior TEXT case (e.g. case 1 a.ts, E1 empty.txt, FS1) flips → you changed how non-md files route.
#   The ONLY allowed injectFile change is +1 new `else if (MD_EXTS.has(ext))` branch. a.ts/a.txt/etc. have
#   ext "ts"/"txt" → MD_EXTS.has(...) is false → they take the SAME branch as before (binary/text). If a
#   text case flipped, you accidentally moved code in injectFile — diff line-by-line against the Blueprint.

# A prior IMAGE/BINARY case (case 3 pic.png, case 4 data.bin, PD4, PD5) flips → you placed the markdown
#   branch in the wrong spot (e.g. before the image branch, or after isBinary). Re-check: the branch is
#   BETWEEN the image branch (after its subtract) and `else if (isBinary(buf))`. png/bin are not .md →
#   unaffected, but a misplaced branch could short-circuit them.

# Your new case 15 (injected != 2) → likely causes:
#   - injectMarkdown not wired into injectFile (the MD_EXTS branch missing or misplaced) → notes.md is
#     treated as plain text → injected===1 (notes.md block, no api.md). Check the branch is present.
#   - scanTokens called with wrong opts (e.g. skipCode:false) → the fenced #@example.ts would be scanned
#     → example.ts resolves to a missing path → still injected===2, but case 16 would fail (example.ts
#     wrongly stripped). Ensure { allowAbsTilde: false, skipCode: true }.
#   - emitText called with `content` instead of `stripped` → the block retains the #@api.md marker → case
#     15's `!r.text.includes("Imports #@api.md here.")` fails. Ensure Step 5 uses `stripped`.

# Your new case 17 (cycle does NOT terminate / injected != 2) → likely causes:
#   - injectFile's claim (L461) was disturbed → cycles loop infinitely (test hangs) or double-inject.
#     injectFile MUST claim abs BEFORE classification. Do NOT remove the L461 claim.
#   - injectMarkdown's belt-and-suspenders `if (state.injectedSet.has(r.abs)) continue;` removed → still
#     safe (scanTokens already dedups), but keep it for the documented cross-subtree guard.

# Your new case 19 (api.md resolves to TMPDIR/api.md instead of sub/api.md) → likely cause:
#   - scanTokens called with baseDir = ctx.cwd instead of path.dirname(abs). Imports MUST resolve relative
#     to the markdown's dir. Ensure `const dir = path.dirname(abs); scanTokens(content, dir, ...)`.

# Re-run focusing on failures:
node ./file-injector.test.mjs 2>&1 | grep -E "FAIL|Result:|case 1[5-9]|sanity"
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None beyond Level 2. No model, no network, no server, no DB.
# Optional manual sanity (proves the recursion visually — NOT required for the gate):
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "md-"));
  fs.writeFileSync(path.join(d, "spec.md"), "# Spec\n\nSee #@api.md.\n");
  fs.writeFileSync(path.join(d, "api.md"), "# API\n\nThe API.\n");
  const r = await mod.injectFiles("Review #@spec.md", [], { cwd: d });
  console.log("injected:", r.injected, "paged:", r.paged);
  console.log(r.text);
'
# Expected: injected===2; the text shows "Review spec.md\n\n---\n\n<file ...spec.md>...(marker→api.md)...
# </file>\n\n<file ...api.md>...The API....</file>". (Mirrors case 15.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → `72 passed, 0 failed`, exit code 0.
- [ ] No jiti/TS compile error (the 16 sanity asserts all run; injectMarkdown is private → no new assert).
- [ ] `injectMarkdown` exists as a PRIVATE module-level function (no `export`); `MD_EXTS`/`estimateImageTokens`
      are NOT redeclared (reused from T2.S1/T2.S2).
- [ ] `injectFile` has exactly ONE new `else if (MD_EXTS.has(ext))` branch, placed BETWEEN the image branch
      (after its `subtract(state, estimateImageTokens(resized))`) and `else if (isBinary(buf))`. The rest of
      injectFile is unchanged; `state.count++` (L491) is unchanged.

### Feature Validation

- [ ] The 67 original cases stay green (the MD_EXTS branch is inert for non-.md fixtures).
- [ ] Case 15: notes.md→api.md, injected===2, notes.md block before api.md block, import marker stripped.
- [ ] Case 16: fenced `#@example.ts` left verbatim; only api.md imported (injected===2).
- [ ] Case 17: a.md↔b.md cycle, injected===2, each block once, b.md's `#@a.md` verbatim, no loop.
- [ ] Case 18: `#@/etc/hosts` ignored (relative-only), verbatim, injected===1, no /etc/hosts block.
- [ ] Case 19: sub/notes.md→sub/api.md (resolved relative to the md's dir, NOT cwd), injected===2; sub/api.md's
      distinct content present, top-level api.md's content absent.

### Code Quality Validation

- [ ] `injectMarkdown` is PRIVATE (not exported); `injectFile`/`emitText`/`scanTokens` exports UNCHANGED.
- [ ] NO new subtract in the markdown branch (emitText owns text; T2.S2 owns image/binary — do NOT double-count).
- [ ] NO new constants, NO new exports, NO new sanity asserts.
- [ ] scanTokens called with `{ allowAbsTilde: false, skipCode: true }` and `baseDir = path.dirname(abs)`.
- [ ] emitText called with the STRIPPED content (Step 5), not the raw content.
- [ ] Step 5 (emit) runs BEFORE Step 6 (recurse) → pre-order block order (parent before imports).

### Documentation

- [ ] JSDoc on `injectMarkdown` (PRD §5.6; the recursion contract: relative-only, code-exempt,
      dedup-bounded NOT depth-limited, pre-order depth-first; claim idempotent; emitText on stripped content;
      does not bump count). [Mode A — item §6 DOCS]
- [ ] No README change (explicitly deferred to T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT place the markdown branch AFTER `isBinary`.** PRD §5.6 step 1: markdown bypasses the NUL/binary
  routing so import scanning always runs. A `.md` with a stray NUL byte must still be scanned. Order:
  empty-image → image → **markdown** → binary → text.
- ❌ **Do NOT redeclare `MD_EXTS`.** T2.S1 owns it (L40). Reference it in the injectFile branch.
- ❌ **Do NOT add a `subtract` in the markdown branch.** injectMarkdown→emitText owns the text cost (emitText
  already subtracts at its whole/paged sites). T2.S2 owns image/binary. Adding one here double-counts markdown.
- ❌ **Do NOT add `state.count++` or a depth counter inside injectMarkdown.** count is bumped once per claimed
  file by injectFile (L491); imports bump count in their own injectFile. Termination is by dedup (§12.13), not depth.
- ❌ **Do NOT call emitText with the raw `content`.** Step 5 uses the STRIPPED content (`stripped`), so directive
  text the model won't see doesn't bias the budget (PRD §5.6 step 5).
- ❌ **Do NOT reorder Step 5 (emit) after Step 6 (recurse).** Pre-order requires the parent's block BEFORE its
  imports' blocks. Emit-then-recurse is load-bearing for context order.
- ❌ **Do NOT pass `ctx.cwd` as the scan baseDir.** Imports resolve relative to `path.dirname(abs)` (the
  markdown's directory), NOT cwd (PRD §4.5 rule 2). cwd-based resolution breaks case 19.
- ❌ **Do NOT export `injectMarkdown` or add a sanity assert for it.** It is private (exercised via injectFiles,
  per item §6 DOCS). Adding an export would force a sanity assert + a module-surface change owned by T2.S4.
- ❌ **Do NOT touch scanTokens/computeCodeRanges/inCode/emitText/estimateImageTokens/injectFiles/the factory/the
  autocomplete provider.** S3 only ADDS injectMarkdown + the MD_EXTS branch + fixtures + 5 tests. Every other
  function is a sibling's contract (T2.S1/T2.S2/T1.S2).
- ❌ **Do NOT use PAGED_FIX for cases 15-19.** The item §5 MOCKING pins FIX (no budget → all whole). The
  shared-budget paged case is S4's case 20, NOT S3. Using PAGED_FIX here would make injected/paged assertions
  budget-dependent and brittle.
- ❌ **Do NOT give sub/api.md the same content as top-level api.md.** Case 19 proves resolution is relative to
  the md's dir by asserting sub/api.md's DISTINCT content is present and top-level api.md's is absent. Identical
  contents would let a wrong (cwd-based) resolution pass the test.
- ❌ **Do NOT skip Level 2.** The 72-test gate is authoritative. If any original case flips, you changed
  behavior beyond the one inserted branch — the ONLY allowed injectFile diff is +1 MD_EXTS branch.

---

## Confidence Score: 9/10

A tightly-scoped additive subtask: ONE new private function (`injectMarkdown`, the PRD §5.6 six-step algorithm
transcribed verbatim from PRD §9) + ONE new `else if (MD_EXTS.has(ext))` branch in injectFile (between image
and binary — the load-bearing order) + markdown fixtures + exactly 5 test cases (15-19, all on the FIX
no-budget mock). Every primitive injectMarkdown needs — `scanTokens` (with the skipCode/allowAbsTilde opts
already DONE by T2.S1), `emitText` (owns the text subtract), `injectFile` (claims abs, classifies, bumps
count) — is already present POST-T2.S2. S3 adds NO new constant, NO new export, NO new subtract, NO new sanity
assert. The PRP includes: the verified POST-T2.S2 starting state (exact injectFile line numbers + the unique
wiring anchor = the image branch's `subtract(state, estimateImageTokens(resized))` line + the `else if
(isBinary(buf))` line), the exact injectMarkdown body, the exact one-branch wiring edit, the exact fixture
contents (with the deliberate content-distinction for case 19), the 5 case-by-case test specs with exact
assertions + traced proofs of injected===2 / cycle-termination / relative-resolution, and the single
authoritative green gate (67→72). The -1 reserves for: (a) the subtle "markdown bypasses isBinary" ordering
(a natural mistake — mitigated by an explicit Anti-Pattern + the fact that every existing fixture is non-.md
so a misplacement would surface as an image/binary case flipping), and (b) case 19's relative-resolution
assertion needing DISTINCT sub/api.md content (mitigated by the explicit fixture content + the
"Top-level API surface." negation assertion). The implementing agent edits one source file + appends
fixtures + a test section, then runs one command.
