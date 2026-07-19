# Research Notes — P1.M1.T1.S2 (plan/009): injectMarkdown — delete Step 3.5 + Step 4; emit verbatim; update recursion

> First-hand read of: the S1 PRP (the scanTokens→string[] / processTokenStream→void contract — S1 NOT yet
> landed in the working tree, but treated as the POST-S1 starting state), PRD §9 (the target 5-step verbatim
> injectMarkdown), §6.4/§12.16 (the "never strip" contract), and the current `file-injector.ts` injectMarkdown
> body (L1094-1160) + JSDoc (L1040-1093).

---

## 1. Starting state = POST-S1 (S1 in flight; S2 consumes its output)

S1 (parallel, NOT yet landed — `processTokenStream` still `Promise<number[]>` L910, reads `r.abs` L913) changes:
- `scanTokens` → `Promise<string[]>` (resolved abs paths; no index/prefixLen bookkeeping — §6.4).
- `processTokenStream` → `Promise<void>` (no resolved-index accumulator).

S1 does NOT touch `injectMarkdown`. So the injectMarkdown body text is identical pre/post-S1 (only its line
numbers shift after S1's scanTokens/processTokenStream rewrites above it). **S2 edits injectMarkdown against
the POST-S1 contract**: after S1, `const records = await scanTokens(...)` is typed `string[]` (TS infers), so
Step 3.5's `r.abs`/`r.index`/`r.prefixLen` and Step 4's slice are the type-error cascade S1 predicts. S2 fixes
that cascade by renaming `records`→`absPaths` and deleting the now-dead Step 3.5/4.

---

## 2. S2 is the MIDDLE of the S1→S2→S3 sequence (deferred-green discipline)

- **S1** (in flight): scanTokens→string[], processTokenStream→void. File goes RED at 2 cascade sites
  (injectMarkdown + injectFiles).
- **S2** (THIS task): rewrite injectMarkdown → 5-step verbatim. Fixes the injectMarkdown cascade. File is now
  RED at ONLY injectFiles (the S3 site).
- **S3** (next): rewrite injectFiles → verbatim return. Fixes the last cascade. File goes GREEN (typecheck 0).

**S2's gate is NOT "typecheck green."** After S2, `npm run typecheck` errors are EXACTLY at `injectFiles` (the
S3 cascade: `resolvedIdx` is void; strippedText loop spreads/sorts it), NOWHERE else. injectMarkdown itself is
clean. This mirrors S1's cascade-gate pattern. Full green (typecheck 0 + suites) is the S3 gate (+ M2 test
migrations for the verbatim-prompt assertions).

---

## 3. The verbatim-delivery contract (WHY Step 3.5 + Step 4 are deleted)

PRD §6.4 + §12.16 + §13.8: **the prompt is never modified; markers are NEVER stripped.** Stripping `#@` from
delivered markdown content (Step 4) existed only to produce "clean" block text — but the bytes now live in the
custom message (§6.2), and stripping the marker from the markdown's OWN content served no purpose (the marker
is an honest reference). Verbatim delivery is strictly better (honest, simpler, and re-open-safe). Therefore:
- **Step 3.5** (the stat/fs.access readability pre-check building `injectable[]`) existed ONLY to gate WHICH
  markers got stripped. With no stripping, every resolved abs is injected (or harmlessly no-ops in injectFile);
  the readability check is redundant with injectFile's own stat (L947). DELETE it.
- **Step 4** (the `let stripped = content` + the marker-slicing loop) existed ONLY to strip. DELETE it.
- **Step 5→4** (emit): now runs on the VERBATIM `content` (not `stripped`).
- **Step 6→5** (recurse): iterates `absPaths` (string[]) instead of `injectable` (record[]).

The marker text left in the delivered content adds a negligible number of chars to the budget estimate (a
handful of `#@`/path tokens per file) — acceptable (§6.4: "stripping's only real effect was deleting two
characters per marker — negligible").

---

## 4. The exact edits (POST-S1; identifier-based landmarks — line numbers shift after S1)

### Edit 1 — the BODY (one contiguous replacement)

**oldText** (current, from `const records = await scanTokens(...)` through the end of Step 6's for-loop):
the scanTokens call → Step 3.5 (comment + `injectable` filter) → Step 4 (comment + `stripped` slice loop) →
Step 5 (`emitText(abs, stripped, …)`) → Step 6 (`for (const r of injectable) { … injectFile(r.abs, …) }`).

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

Net: `records`→`absPaths`; Step 3.5 (≈34 lines: comment + `injectable` loop) DELETED; Step 4 (≈9 lines:
comment + `stripped` slice loop) DELETED; `emitText(abs, stripped, …)`→`emitText(abs, content, …)`; Step 6
loop `r`/`injectable`/`r.abs`→`abs2`/`absPaths`/`abs2`. The `scanTokens(...)` call args are UNCHANGED
(`bareAt: state.bareAt` stays — S1 made bareAt optional, passing a boolean is fine).

### Edit 2 — the JSDoc (replace the whole comment block)

Replace the current `/** PRD §5.6 — markdown transitive imports (the six-step algorithm)… */` block with a
5-step version: title "five-step"; keep the RELATIVE-ONLY / CODE-EXEMPT / DEDUP-BOUNDED / PRE-ORDER bullets
(update Step refs: emit=Step 4, recurse=Step 5); ADD a VERBATIM bullet ("markers detected only to resolve
imports, NEVER stripped — §6.4/§12.16; block emitted on verbatim content"); replace the "Six steps" numbered
list (2/3/3.5/4/5/6) with a "Five steps" list (2 claim, 3 scan→absPaths string[], 4 emit verbatim, 5 recurse);
REMOVE all Step 3.5 / Step 4 / 'stripped' / 'injectable' / 'prefixLen' / readability-pre-check language; keep
the @param block + the PRIVATE note.

---

## 5. What does NOT change (scope discipline)

- `injectMarkdown` signature: `async (abs, content, state, ctx) => Promise<void>` — UNCHANGED.
- Step 2 (claim self: `state.injectedSet.add(abs)`) — UNCHANGED.
- The `dir = path.dirname(abs)` + the scanTokens call args — UNCHANGED.
- `emitText`, `injectFile`, `scanTokens`, `processTokenStream`, `injectFiles` — UNCHANGED by S2 (injectFiles is S3).
- Dedup semantics: scanTokens' localSeen + the belt-and-suspenders `injectedSet.has(abs2)` re-check — UNCHANGED.
- Pre-order emission: this file's block (Step 4) emitted BEFORE recursing (Step 5) — UNCHANGED (just renumbered).

---

## 6. S2's gate (cascade-shape, NOT green)

- `npm run typecheck` after S2: errors EXACTLY at `injectFiles` (the S3 cascade: `resolvedIdx` void;
  strippedText spread/sort), NOWHERE else. injectMarkdown itself has NO type error.
- If injectMarkdown STILL errors after S2 → the edit left a `records`/`injectable`/`stripped`/`r.abs`/`r.index`
  reference behind (re-check Edit 1 deleted Step 3.5 AND Step 4 entirely).
- Full green (0 errors + suites) is the S3 gate.

---

## 7. Confidence: 9/10

A well-scoped deletion + verbatim-emit rewrite of one function, with the exact oldText→newText (verified
against the current source) and the PRD §9 target as the authoritative shape. The -1 reserves for the
deferred-green discipline (S2 is red-in-isolation by design — the agent must NOT stop at a red typecheck or
"fix" injectFiles prematurely, which is S3) and the JSDoc rewrite precision (a big comment block; the PRP
gives the target bullets + numbered list to avoid leaving any Step 3.5/4/'stripped' reference behind). One
function body + one JSDoc; the implementing agent re-runs typecheck to confirm the cascade narrowed to injectFiles.