# PRP — P1.M1.T1.S1 (plan/009): scanTokens → Promise<string[]>; processTokenStream → Promise<void>

> **Scope flag:** This is the FIRST of a 3-subtask sequence (S1 → S2 → S3) that removes ALL `#@` marker
> stripping from the injection engine (PRD §6.4/§12.16: deliver the prompt VERBATIM). S1 narrows the two
> scan/process functions to drop the index/`prefixLen` bookkeeping that existed only to support stripping.
> **⚠️ S1 ALONE LEAVES THE FILE NON-TYPECHECKING** — changing these return types breaks `injectMarkdown`
> (L1105, fixed in S2) and `injectFiles` (L1225, fixed in S3). The item explicitly requires implementing
> S1 → S2 → S3 in one pass; the green typecheck + green suites gate is reached only after S3. Scope = S1 ONLY
> (the scanTokens/processTokenStream changes + their JSDoc).

---

## Goal

**Feature Goal:** Simplify the scan/process core for verbatim delivery: `scanTokens` returns resolved abs
paths as `Promise<string[]>` (no index/`prefixLen`), and `processTokenStream` returns `Promise<void>` (no
resolved-index accumulator). Markers are detected ONLY to resolve imports — never stripped (PRD §6.4/§12.16).

**Deliverable:** Modified `file-injector.ts`: `scanTokens` (L856-893) returns `Promise<string[]>` with a
`{idx, token}[]` cands array (no `prefixLen`); `processTokenStream` (L904-919) returns `Promise<void>` with
`bareAt?` harmonized and no `resolved` accumulator; both JSDocs rewritten. The two cascade callers
(`injectMarkdown`, `injectFiles`) are left for S2/S3.

**Success Definition:**
1. `scanTokens` signature is `… : Promise<string[]>`; cands is `{idx, token}[]`; output pushes only `abs`.
2. `processTokenStream` signature is `… : Promise<void>`; opts.bareAt is `bareAt?`; body loops `for (const abs of absPaths)`.
3. Both JSDocs reflect "markers detected, never stripped" (no `prefixLen`/strip language).
4. After S1 alone, `npm run typecheck` reports errors at EXACTLY the 2 cascade sites (injectMarkdown ~L1105/1129/1147, injectFiles ~L1225/1240-1242) and NOWHERE else. (Full green is the S3 gate, after the one-pass S1+S2+S3.)

## Why

- **Removes dead bookkeeping.** The `index`/`prefixLen` fields existed ONLY so callers could strip the `#@`/`@`
  marker (`slice(index, index + prefixLen)`). PRD §6.4/§12.16 (plan/009) mandates verbatim delivery — the
  prompt is never modified — so stripping is gone and the bookkeeping is dead. Dropping it from scanTokens'
  return shape is the natural first step (the callers stop consuming it in S2/S3).
- **Sequence ordering.** The return-type change must land BEFORE the callers are rewritten (S2/S3 consume the
  new shapes). S1 is that return-type change. It cannot be green in isolation (the old callers type-error),
  so the item mandates a single pass S1→S2→S3.
- **`bareAt` harmonization.** scanTokens already had `bareAt?` (optional); processTokenStream had `bareAt`
  (required). Since processTokenStream forwards opts straight to scanTokens and the one caller always passes
  a value, harmonize both to `bareAt?` (a drive-by consistency fix the item calls out).

## What

### User-visible behavior

- **None yet.** S1 changes internal return shapes only. The model-facing output, the prompt text, and the
  renderer are all unchanged at the S1 boundary (the verbatim-prompt behavior lands with S3 + T2).

### Technical behavior (the contract)

- `scanTokens(text, baseDir, opts, state)` → `Promise<string[]>`: resolved abs paths in encounter order
  (depth-first recursion relies on this). Same resolution logic (cleanToken, isAbsoluteOrTilde,
  resolveImportPath, dedup, code-region skip via `inCode(c.idx, …)`); only the returned shape changes.
- `processTokenStream(text, baseDir, opts, state, ctx)` → `Promise<void>`: scans once, then injects each
  resolved abs depth-first via `injectFile`. No index accumulator, no return value.

### Success Criteria

- [ ] `scanTokens` returns `Promise<string[]>`; cands is `{idx, token}[]` (no `prefixLen`); output pushes `abs`.
- [ ] `processTokenStream` returns `Promise<void>`; opts.bareAt is `bareAt?`; body is `for (const abs of absPaths) {…}`.
- [ ] Both JSDocs rewritten (no `prefixLen`/strip language; cite §6.4/§12.16 "markers detected, never stripped").
- [ ] After S1 alone: `npm run typecheck` errors are EXACTLY at injectMarkdown + injectFiles (the 2 cascade sites), nowhere else.
- [ ] `idx` STAYS in cands (load-bearing for `inCode`); resolution logic unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current code (scanTokens L856-893, processTokenStream L904-919), verbatim old→new diffs, the precise
cascade sites (injectMarkdown L1105/1129/1147, injectFiles L1225/1240-1242), the deferred-green gate, and the
S2/S3 scope boundary. Two function rewrites + two JSDoc rewrites; the rest is sequencing discipline.

### Documentation & References

```yaml
# MUST READ — the verbatim-delivery contract (why stripping is removed)
- file: PRD.md
  why: "§6.4 (Assembly & shared state: 'The prompt is never modified') + §12.16 ('Never strip markers —
        verbatim delivery everywhere') + §13.8 (why verbatim preserves cancel/fork/re-open re-injection).
        These are the contract S1 serves by dropping the strip bookkeeping."
  section: "### 6.4 + #### 12.16 + ### 13.8"
  critical: "§6.4: scanTokens 'Markers are detected here only to resolve imports — they are NEVER stripped
             from the text — so no index/prefixLen bookkeeping is returned.' That sentence IS the S1 spec."

# MUST READ — the target pseudocode (the exact post-S1 shapes)
- file: PRD.md
  why: "§9 Algorithm shows scanTokens returning Promise<string[]> with `{idx, token}[]` cands and
        processTokenStream returning Promise<void>. That is the authoritative target for S1."
  section: "## 9 Algorithm (scanTokens + processTokenStream)"

# The file you edit (ONE file — two function rewrites + two JSDoc rewrites)
- file: file-injector.ts
  why: "1412 lines (plan/008 display feature landed). scanTokens L856-893 (JSDoc L826-854); processTokenStream
        L904-919 (JSDoc L894-903). CASCADE sites (NOT edited in S1): injectMarkdown scanTokens call L1105 +
        Step 3.5 injectable L1129 + Step 4 strip L1147 (→ S2); injectFiles processTokenStream call L1225 +
        strippedText loop L1240-1242 (→ S3)."
  pattern: "scanTokens keeps `idx` in cands for inCode(c.idx, …) (L882); only `prefixLen` is dropped. The
            resolution body (cleanToken → isAbsoluteOrTilde → resolveImportPath → dedup) is byte-for-byte
            identical — same abs paths, same order, just returned as string[]."
  gotcha: "S1 ALONE breaks typecheck at the 2 cascade sites. That is EXPECTED. Do NOT edit injectMarkdown or
           injectFiles in S1 (they are S2/S3). The file goes green only after the one-pass S1→S2→S3."

# typecheck gate (deferred green)
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. After S1 it WILL error at injectMarkdown + injectFiles (the
        cascade). Confirm the errors are EXACTLY those 2 sites and nowhere else (e.g. no error inside
        scanTokens/processTokenStream themselves). Full green is the S3 gate."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (scanTokens L856-893 → string[]; processTokenStream L904-919 → void; both JSDoc)
├── file-injector.test.mjs    # run AFTER S1+S2+S3 (S1 alone: the suite may not even load if typecheck fails → jiti load error)
├── relative-imports.test.mjs # run AFTER S1+S2+S3
├── import-behavior.test.mjs  # run AFTER S1+S2+S3
├── scripts/typecheck.mjs     # the typecheck gate (red after S1 alone; green after S3)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{stripping_logic_analysis.md, test_assertions_analysis.md, system_context.md, readme_analysis.md}
    └── P1M1.T1.S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — scanTokens → Promise<string[]> (+ {idx,token}[] cands, push abs);
                          #                  processTokenStream → Promise<void> (+ bareAt? harmonization, no resolved);
                          #                  both JSDoc rewritten.
# No other files. No test changes in S1. The cascade callers (injectMarkdown, injectFiles) are S2/S3.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — S1 ALONE IS RED. Changing scanTokens' return type breaks injectMarkdown (L1105: `records` is
//   now string[]; Step 3.5 L1129 + Step 4 L1147 read r.abs/r.index/r.prefixLen → type errors). Changing
//   processTokenStream' return type breaks injectFiles (L1225: `resolvedIdx` is now void; L1240-1242 spread/
//   sort → type errors). These are the EXPECTED cascade. DO NOT fix them in S1. Do S1→S2→S3 in one pass.

// CRITICAL — the typecheck gate for S1 is NOT "0 errors". It is "errors at EXACTLY injectMarkdown +
//   injectFiles, nowhere else." If scanTokens/processTokenStream THEMSELVES have a type error, fix that
//   (it's an S1 defect). But errors at the 2 cascade sites are correct and expected. Full green = S3.

// CRITICAL — `idx` STAYS in the cands array. It is consumed INSIDE scanTokens by `inCode(c.idx, codeRanges)`
//   (L882) for the code-region exemption. Only `prefixLen` is dropped (it had no consumer once stripping is
//   gone). Do NOT remove `idx` or the code-skip breaks.

// GOTCHA — processTokenStream's opts is forwarded straight to scanTokens (L911 `await scanTokens(text,
//   baseDir, opts, state)`). Harmonizing bareAt to `bareAt?` in BOTH keeps them assignable. The one caller
//   (injectFiles L1225) always passes bareAt, so optional is safe.

// GOTCHA — the .mjs test suites load file-injector.ts via jiti. If typecheck fails (S1 alone), jiti may still
//   LOAD the file (jiti transpiles, doesn't full-typecheck), but the runtime cascade (injectMarkdown reading
//   r.abs on a string → undefined; injectFiles spreading void → TypeError) will crash the suites. So the
//   suites are only meaningfully green AFTER S1+S2+S3. Do not run them as an S1-alone gate.

// LIBRARY — `Promise<string[]>` / `Promise<void>` are standard. Dropping the object literal for a bare `abs`
//   string is a trivial type narrowing. No new imports/exports (scanTokens stays exported; processTokenStream
//   stays private).
```

## Implementation Blueprint

### Data models and structure

No `interface` change. The only structural change is the **return shape** of two functions:
- `scanTokens`: `{index, prefixLen, abs}[]` → `string[]`; internal `cands`: `{idx, token, prefixLen}[]` → `{idx, token}[]`.
- `processTokenStream`: `Promise<number[]>` → `Promise<void>`; drops the `resolved: number[]` accumulator.

### Implementation Patterns & Key Details

```ts
// === scanTokens (L856-893) — return string[]; cands drop prefixLen; out pushes abs ===
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<string[]> {                                    // ← was Promise<{index;prefixLen;abs}[]>
  const localSeen = new Set<string>();
  const out: string[] = [];                               // ← was {index;prefixLen;abs}[]
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  const cands: { idx: number; token: string }[] = [];     // ← was {idx;token;prefixLen}[] (idx STAYS for inCode)
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2] });           // ← dropped prefixLen:2
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2] }); // ← dropped prefixLen:1
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue;   // idx still used here
    const token = cleanToken(c.token);
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);
    if (!abs) continue;
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;
    localSeen.add(abs);
    out.push(abs);                                        // ← was {index:c.idx, prefixLen:c.prefixLen, abs}
  }
  return out;
}

// === processTokenStream (L904-919) — return void; bareAt? harmonized; no resolved accumulator ===
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },  // ← bareAt? (was required)
  state: State,
  ctx: Ctx,
): Promise<void> {                                        // ← was Promise<number[]>
  const absPaths = await scanTokens(text, baseDir, opts, state);   // ← was `records`
  for (const abs of absPaths) {
    if (state.injectedSet.has(abs)) continue;             // cross-subtree dedup since scan
    await injectFile(abs, state, ctx);                    // claims abs, emits block(s), recurses
  }
  // ← removed: const resolved / `if (ok) resolved.push(r.index)` / `return resolved`
}
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 2 function rewrites + 2 JSDoc rewrites):
  - scanTokens (L856-893): return Promise<string[]>; cands {idx,token}[]; out string[]; push abs. KEEP idx
    (inCode). KEEP the resolution body verbatim. KEEP bareAt?.
  - processTokenStream (L904-919): return Promise<void>; opts.bareAt → bareAt?; body loops absPaths; remove
    resolved accumulator + return.
  - scanTokens JSDoc (L826-854): rewrite — resolved abs paths in encounter order; markers detected only to
    resolve, NEVER stripped (§6.4/§12.16); no index/prefixLen bookkeeping.
  - processTokenStream JSDoc (L894-903): rewrite — Promise<void>; scans once before injecting; depth-first;
    prompt text NOT modified (§6.4).
  - UNCHANGED (cascade — DO NOT touch in S1): injectMarkdown L1094-1160 (scanTokens call L1105, Step 3.5
    L1129, Step 4 strip L1147) → S2; injectFiles L1162-1246 (processTokenStream call L1225, strippedText
    L1240-1242) → S3.

NO_CHANGES: the three .mjs suites, package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files.
NO new exports (scanTokens stays exported; processTokenStream stays private). NO new imports.
```

### CASCADE CONTRACT — what S2 and S3 must do (the agent does all three in one pass)

```yaml
S2 (injectMarkdown, L1094-1160):
  - L1105: `const records = await scanTokens(...)` is now `string[]`. Rename to `absPaths`.
  - DELETE Step 3.5 (the `injectable` filter at L1129 — it existed to gate stripping; with verbatim delivery
    every resolved abs is injected). 
  - DELETE Step 4 (the strip loop at L1145-1147 — `stripped = …slice(… r.index + r.prefixLen)`).
  - Step 4 becomes: emit the VERBATIM content (`emitText(abs, content, state)` — content as read from disk).
  - Step 5 (recurse): iterate `absPaths` (string[]) → `for (const abs2 of absPaths) { if (injectedSet.has(abs2)) continue; await injectFile(abs2, state, ctx); }`.

S3 (injectFiles, L1162-1246):
  - L1225: `const resolvedIdx = await processTokenStream(...)` is now `void`. Drop the assignment → `await processTokenStream(text, ctx.cwd, {…}, state, ctx);`.
  - DELETE the strippedText loop (L1240-1242) and `strippedText`.
  - The return becomes verbatim: `return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };`
    (text is the ORIGINAL prompt, unchanged — §6.4).

NOTE: S2 and S3 are SEPARATE subtasks with their own PRPs. This PRP covers S1 ONLY. The cascade section above
is context so the agent understands WHY S1 is red-in-isolation and what the next steps are. Do the full
S1→S2→S3 pass, then run the green gate (Validation below).
```

### Implementation Tasks (ordered — S1 portion of the one-pass S1→S2→S3)

```yaml
Task 1: REWRITE scanTokens (L856-893) → Promise<string[]>
  - Change return type to Promise<string[]>; out to string[]; cands to {idx, token}[]; drop prefixLen from
    both push sites; out.push(abs). KEEP idx (inCode). KEEP the resolution body verbatim. KEEP bareAt?.
  - VERIFY: scanTokens itself has no internal type error (the only post-S1 errors are at the 2 cascade sites).

Task 2: REWRITE processTokenStream (L904-919) → Promise<void>
  - Change return type to Promise<void>; opts.bareAt → bareAt?; body `const absPaths = await scanTokens(…);
    for (const abs of absPaths) { if (injectedSet.has(abs)) continue; await injectFile(abs, state, ctx); }`.
    Remove resolved accumulator + return.
  - VERIFY: processTokenStream itself has no internal type error.

Task 3: REWRITE both JSDocs (Mode A)
  - scanTokens (L826-854): no prefixLen/strip language; resolved abs paths in encounter order; markers
    detected only to resolve, never stripped (§6.4/§12.16).
  - processTokenStream (L894-903): Promise<void>; scans once before injecting; depth-first; prompt NOT modified.

Task 4: CASCADE CHECK (S1-specific gate — NOT green)
  - npm run typecheck → EXPECT errors at injectMarkdown (~L1105/1129/1147) + injectFiles (~L1225/1240-1242).
  - Confirm NO error inside scanTokens or processTokenStream themselves, and no error anywhere else.
  - This is the S1 gate. Then PROCEED to S2 (injectMarkdown) and S3 (injectFiles) in the same pass.

Task 5 (after S2+S3): GREEN GATE
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs + relative-imports.test.mjs + import-behavior.test.mjs → green (the test
    migrations are M2, but the runtime behavior — verbatim prompt — is in place after S3; existing tests that
    asserted stripped text will go RED and are migrated in M2).
```

## Validation Loop

### Level 1: Typecheck — the S1 cascade gate (RED-IN-FILE is expected)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# AFTER S1 ALONE: EXPECT errors at EXACTLY:
#   - injectMarkdown: `records`/`injectable` now string[] but Step 3.5/4 read .abs/.index/.prefixLen (~L1105/1129/1147)
#   - injectFiles: `resolvedIdx` now void but strippedText loop spreads/sorts it (~L1225/1240-1242)
# Confirm: NO error inside scanTokens (L856-893) or processTokenStream (L904-919) themselves.
# This RED is the S1 gate. Do NOT fix the cascade here — proceed to S2 (injectMarkdown) then S3 (injectFiles).
```

### Level 2: Typecheck — the GREEN gate (after S1 → S2 → S3 in one pass)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected (post-S3): "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If errors remain at injectMarkdown/injectFiles, S2/S3 are incomplete. If errors appear elsewhere, S1 over-reached.
```

### Level 3: Suite gate (after S1 → S2 → S3; test migrations are M2)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # post-S3: cases asserting STRIPPED text will FAIL (e.g. "Review a.ts" vs "Review #@a.ts")
node ./relative-imports.test.mjs     # marker-presence expectations may flip
node ./import-behavior.test.mjs      # marker-presence expectations may flip
# These RED cases are EXPECTED after S3 (the prompt is now verbatim) and are migrated to verbatim assertions in M2.
# S1's own success does NOT require these green — it requires the scanTokens/processTokenStream shapes + the cascade.
```

### Level 4: Isolated shape verification (confirms scanTokens/processTokenStream independent of the cascade)

```bash
# Ad-hoc: after S1, confirm scanTokens still resolves the same abs paths (just as string[]). This is hard to
# do in isolation because injectMarkdown/injectFiles are red. The cleanest in-S1 check is the typecheck
# cascade shape (Level 1): scanTokens/processTokenStream have NO internal error; only the 2 callers do.
# Full behavioral verification waits for the green gate (Level 2) + M2 test migration.
```

## Final Validation Checklist

### Technical Validation (S1-specific)

- [ ] `scanTokens` returns `Promise<string[]>`; cands is `{idx, token}[]`; output pushes `abs`; `idx` retained for `inCode`.
- [ ] `processTokenStream` returns `Promise<void>`; opts.bareAt is `bareAt?`; body loops `absPaths`.
- [ ] Both JSDocs rewritten (no `prefixLen`/strip language; "markers detected, never stripped" per §6.4/§12.16).
- [ ] After S1 alone: `npm run typecheck` errors are EXACTLY at injectMarkdown + injectFiles (the 2 cascade sites), nowhere else.

### Cascade Discipline

- [ ] injectMarkdown NOT edited in S1 (it's S2); injectFiles NOT edited in S1 (it's S3).
- [ ] The agent proceeds S1 → S2 → S3 in one pass (the file is red between them).
- [ ] After S3: `npm run typecheck` → 0 errors (the green gate).

### Code Quality Validation

- [ ] Resolution logic in scanTokens (cleanToken, isAbsoluteOrTilde, resolveImportPath, dedup, code-skip) byte-for-byte unchanged.
- [ ] `idx` retained (load-bearing for `inCode`); only `prefixLen` dropped.
- [ ] `bareAt` harmonized to `bareAt?` in both functions.
- [ ] No new exports/imports; scanTokens stays exported, processTokenStream stays private.

### Documentation

- [ ] scanTokens + processTokenStream JSDoc reflect the new return types + verbatim-delivery contract.
- [ ] No README/user-facing change in S1 (the README verbatim sync is M2.T4).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT expect S1 to typecheck green.** S1 changes two return types that two callers consume; the file is
  red until S2+S3. The S1 gate is "errors at EXACTLY the 2 cascade sites, nowhere else." Claiming "0 errors
  after S1" is false and hides the cascade.
- ❌ **Do NOT fix the cascade in S1.** injectMarkdown (Step 3.5/4 deletion + verbatim emit) is S2; injectFiles
  (resolvedIdx/strippedText deletion + verbatim return) is S3. Editing them here is scope creep and steals S2/S3's work.
- ❌ **Do NOT drop `idx` from cands.** It is consumed INSIDE scanTokens by `inCode(c.idx, codeRanges)` (L882) for
  the code-region exemption. Only `prefixLen` (which had no consumer post-stripping) is dropped.
- ❌ **Do NOT change the resolution logic.** cleanToken, isAbsoluteOrTilde, resolveImportPath, the dedup check,
  and the code-region skip are byte-for-byte identical. S1 changes ONLY the returned shape (object → string)
  and the cands internal shape (drop prefixLen). Same abs paths, same order.
- ❌ **Do NOT run the .mjs suites as an S1-alone gate.** With injectMarkdown/injectFiles red, the runtime
  cascade (reading `.abs` on a string → undefined; spreading `void` → TypeError) will crash them. The suites
  are meaningful only after the green gate (S3) + the M2 test migrations.
- ❌ **Do NOT leave processTokenStream's `bareAt` required.** The item calls for harmonizing both to `bareAt?`
  (scanTokens is already optional; processTokenStream forwards opts to it). Keep them consistent.
- ❌ **Do NOT touch injectMarkdown's JSDoc (L1062-1091) or the Step 3.5/Step 4 comments.** Those describe the
  stripping that S2 removes; rewriting them belongs to S2, not S1. S1 rewrites ONLY scanTokens + processTokenStream JSDoc.

---

## Confidence Score: 9/10

A precisely-scoped return-shape change to two functions, with the exact old→new diffs and the cascade fully
enumerated (the 2 break sites, what S2/S3 do to each). The PRD §9 pseudocode gives the authoritative target
shapes; the architecture confirms the call sites and the harmonization. The only complexity is the
deferred-green discipline: S1 is red-in-isolation by design, and the agent must continue to S2/S3 without
stopping. The -1 reserves for the discipline risk (an agent might "fix" the cascade prematurely or declare S1
done at a red typecheck) and for ensuring `idx` is retained (dropping it would silently break code-region
exemption — but that surfaces as an S1-internal typecheck error, caught immediately). One file; two function
rewrites + two JSDoc rewrites, then proceed to S2/S3.