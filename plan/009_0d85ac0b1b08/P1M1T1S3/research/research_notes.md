# Research Notes — P1.M1.T1.S3 (injectFiles: delete resolvedIdx/strippedText; return verbatim)

## Where this sits in the sequence (plan 009, P1.M1.T1)

Three-subtask cascade removing ALL `#@` marker stripping from the injection engine:
- **S1 (Complete, LANDED):** `scanTokens` → `Promise<string[]>`; `processTokenStream` → `Promise<void>`.
- **S2 (in parallel — owns `injectMarkdown` body + JSDoc ONLY):** delete Step 3.5 + Step 4, emit verbatim.
- **S3 (THIS — owns `injectFiles` ONLY):** delete `resolvedIdx` assignment + `strippedText` loop; return `text` verbatim.

S3 is the LAST cascade fix. After S3, `npm run typecheck` is GREEN (0 errors). The .mjs suites then RUN
again (no crash) but FAIL on ~78 stripped-expectation assertions — those are migrated in P1.M2 (T1/T2/T3).

## Verified current state (this session)

### processTokenStream (S1 landed) — `file-injector.ts:911-927`
```ts
async function processTokenStream(
  text, baseDir,
  opts: { allowAbsTilde; skipCode; tryMdExt; bareAt?: boolean },
  state, ctx,
): Promise<void> {                       // ← void (S1); no index accumulator
  const absPaths = await scanTokens(text, baseDir, opts, state);
  for (const abs of absPaths) {
    if (state.injectedSet.has(abs)) continue;
    await injectFile(abs, state, ctx);
  }
}
```
JSDoc at :903 confirms: "nothing is stripped, so there is no index accumulator to return."

### injectFiles (S3 target) — `file-injector.ts:1111-1247` (sig at :1111; body ends ~:1247)

Exact current text at the two edit sites (VERIFIED against working tree):

**EDIT A site — :1166-1175** (the comment + `const resolvedIdx =` assignment):
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

**EDIT B site — :1183-1195** (the stripping comment + `let strippedText` loop + return):
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

**UNCHANGED — the count===0 early return at :1176:**
```ts
  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
```
After S3 BOTH return paths return the original `text` (this one already does).

## Cascade evidence (the typecheck gate is well-defined)

Current `npm run typecheck` (post-S1, pre-S2/S3) → **EXACTLY ONE error**:
```
file-injector.ts(1190,23): error TS2488: Type 'void' must have a '[Symbol.iterator]()' method that returns an iterator.
```
That is `[...resolvedIdx]` spreading `void` — the S3 fix site. There are NO other errors (injectMarkdown
currently typechecks clean — whether S2 landed or not is moot; S3's gate is "this error gone → 0 errors").

Current .mjs suites (post-S1) → CRASH at every injectFiles call with `resolvedIdx is not iterable`:
```
✗ case DELIV-1 (...): resolvedIdx is not iterable
✗ case DELIV-2 (...): resolvedIdx is not iterable
... (every case that injects something)
```
After S3 the crash goes away (the spread is deleted); the suites then RUN but FAIL on stripped-expectation
assertions (e.g. `r.text === "Review a.ts"` when it's now `Review #@a.ts`) — migrated in P1.M2.

## Scope boundary (parallel execution with S2)

- **S3 owns `injectFiles` ONLY** (body — the two edit sites above). It does NOT touch the JSDoc above the
  function (the big `/** #@file — Whole-File Injection... */` module doc) — that's module-level, unchanged.
- **S2 owns `injectMarkdown` body + JSDoc** — do NOT touch it (parallel).
- OBSERVED stale comment OUT of S3 scope: `file-injector.ts:973-979` (injectFile's markdown-branch comment,
  "strip resolved #@ markers → emit this block (paged decision on the STRIPPED content)") describes injectMarkdown's
  OLD behavior. It lives in `injectFile`, not `injectFiles`, and describes the markdown path S2 owns → leave it
  for S2/M2. Flagged here so the implementer doesn't "fix" it and conflict with S2.

## Validation commands (verified working)

- `npm run typecheck` == `node ./scripts/typecheck.mjs` → tsc --strict (TS 5.6 via npx) against global pi .d.ts.
- `npm test` == `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs`.
- S3 GATE = `npm run typecheck` → **0 errors** (the one error at :1190 gone). Suites are NOT a green gate (M2 owns migrations).