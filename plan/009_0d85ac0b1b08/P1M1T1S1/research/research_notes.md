# Research Notes — P1.M1.T1.S1 (plan/009): scanTokens → Promise<string[]>; processTokenStream → Promise<void>

## Mission
The first of a 3-subtask sequence (S1/S2/S3) that removes ALL `#@` marker stripping from the injection engine
(PRD §6.4/§12.16: deliver the prompt VERBATIM). S1 narrows the two scan/process functions to drop the
index/prefixLen bookkeeping that existed only to support stripping:
- `scanTokens` → `Promise<string[]>` (resolved abs paths, encounter order; no index/prefixLen).
- `processTokenStream` → `Promise<void>` (no resolved-index accumulator).
Both JSDocs rewritten to the "markers detected, never stripped" contract.

## ⚠️ CRITICAL CASCADE — S1 ALONE LEAVES THE FILE NON-TYPECHECKING
Changing these two return types breaks the TWO callers that consume the old shapes:
1. **injectMarkdown L1105** — `const records = await scanTokens(...)` then Step 3.5 (`injectable: {index, prefixLen, abs}[]` L1129) + Step 4 strip (`r.index + r.prefixLen` L1147). After S1 `records` is `string[]` → `r.abs`/`r.index`/`r.prefixLen` are type errors. → **S2 fixes** (delete Step 3.5 + Step 4; emit verbatim content; recurse over `string[]`).
2. **injectFiles L1225** — `const resolvedIdx = await processTokenStream(...)` then `strippedText` loop (L1240-1242 `[...resolvedIdx].sort(...)`). After S1 `resolvedIdx` is `void` → spread/sort type errors. → **S3 fixes** (delete resolvedIdx/strippedText; return `text` verbatim).

**The item explicitly says: "The file will NOT type-check until S2 and S3 are complete — implement all three
subtasks in sequence within one pass."** So S1's gate is NOT a standalone `npm run typecheck` (it WILL fail at
exactly the 2 cascade sites). S1 is "correct in isolation + only the 2 expected cascade errors." The green
typecheck + green suites gate is achieved after S1→S2→S3 in one pass. DO NOT try to fix the cascade in S1.

## Baseline (the STARTING point — green; S1 will disturb it temporarily)
- `node ./file-injector.test.mjs` → **150 passed**; `relative-imports` 38; `import-behavior` 23 (211 total).
- `npm run typecheck` → **0 errors**. file-injector.ts is **1412 lines** (plan/008's display feature landed: FileDetail L432, details L460, computeDetailOffsets L353, renderer L734+, pending stash, before_agent_start).

## Verified current landmarks (file-injector.ts, 1412 lines)
- **scanTokens L856-893** (JSDoc L826-854): `export async function scanTokens(text, baseDir, opts:{allowAbsTilde,skipCode,tryMdExt,bareAt?}, state): Promise<{index:number; prefixLen:number; abs:string}[]>`.
  - `cands: {idx, token, prefixLen}[]` (L873); pushes `{idx:m.index!, token:m[2], prefixLen:2}` for FILE_INJECT_RE (L874), `…, prefixLen:1}` for BARE_AT_RE (L875).
  - `out: {index, prefixLen, abs}[]` (L863); pushes `{index:c.idx, prefixLen:c.prefixLen, abs}` (L886).
  - `idx` STAYS in cands — needed for `inCode(c.idx, codeRanges)` (L882).
- **processTokenStream L904-919** (JSDoc L894-903): `async function processTokenStream(text, baseDir, opts:{allowAbsTilde,skipCode,tryMdExt,bareAt}, state, ctx): Promise<number[]>` (note: bareAt REQUIRED here, vs optional in scanTokens).
  - `const records = await scanTokens(...)` (L911); `const resolved: number[] = []` (L912); loop `for (const r of records) { if (injectedSet.has(r.abs)) continue; const ok = await injectFile(r.abs, state, ctx); if (ok) resolved.push(r.index); }` (L913-917); `return resolved` (L918).
- **Cascade site 1 (S2)**: injectMarkdown L1094; scanTokens call L1105; Step 3.5 `injectable` L1129; Step 4 strip L1145-1147.
- **Cascade site 2 (S3)**: injectFiles L1162; processTokenStream call L1225; `strippedText` loop L1240-1246; return L1246.

## The exact S1 changes

### scanTokens (L856-893)
```diff
- ): Promise<{ index: number; prefixLen: number; abs: string }[]> {
+ ): Promise<string[]> {
    const localSeen = new Set<string>();
-   const out: { index: number; prefixLen: number; abs: string }[] = [];
+   const out: string[] = [];
    const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
-   const cands: { idx: number; token: string; prefixLen: number }[] = [];
-   for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
-   if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
+   const cands: { idx: number; token: string }[] = [];
+   for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2] });
+   if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2] });
    cands.sort((a, b) => a.idx - b.idx);
    for (const c of cands) {
      if (codeRanges && inCode(c.idx, codeRanges)) continue;   // idx STAYS — needed for inCode
      const token = cleanToken(c.token);
      if (!token) continue;
      if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;
      const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);
      if (!abs) continue;
      if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;
      localSeen.add(abs);
-     out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
+     out.push(abs);
    }
    return out;
```
- `idx` STAYS in cands (load-bearing for `inCode(c.idx, …)`). Only `prefixLen` is dropped.
- opts.bareAt stays `bareAt?` (already optional).
- Resolution logic (cleanToken, isAbsoluteOrTilde, resolveImportPath, dedup, code-region skip) UNCHANGED → same abs paths, same order.

### processTokenStream (L904-919)
```diff
  async function processTokenStream(
    text: string,
    baseDir: string,
-   opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
+   opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
    state: State,
    ctx: Ctx,
- ): Promise<number[]> {
-   const records = await scanTokens(text, baseDir, opts, state);
-   const resolved: number[] = [];
-   for (const r of records) {
-     if (state.injectedSet.has(r.abs)) continue;
-     const ok = await injectFile(r.abs, state, ctx);
-     if (ok) resolved.push(r.index);
-   }
-   return resolved;
+ ): Promise<void> {
+   const absPaths = await scanTokens(text, baseDir, opts, state);   // scan once, before any injection
+   for (const abs of absPaths) {
+     if (state.injectedSet.has(abs)) continue;               // cross-subtree dedup since scan
+     await injectFile(abs, state, ctx);                      // claims abs, emits block(s), recurses
+   }
  }
```
- `bareAt` harmonized to `bareAt?` (matches scanTokens; the only caller, injectFiles L1225, always passes a value).
- Removes `resolved` accumulator, the `if (ok) resolved.push(r.index)` line, and `return resolved`.

### JSDoc rewrites (Mode A — rides with S1)
- **scanTokens JSDoc (L826-854)**: remove ALL `prefixLen`/"so a consumer can strip" language. Document: returns resolved abs paths in ENCOUNTER ORDER (depth-first recursion relies on this); markers detected ONLY to resolve imports — NEVER stripped (§6.4, §12.16); async because resolution stats candidate paths; opts.bareAt additionally matches bare `@path` via BARE_AT_RE; per-text dedup via localSeen on the resolved abs.
- **processTokenStream JSDoc (L894-903)**: document `Promise<void>` (no strip indices); scans once before injecting; each resolved abs injected depth-first via injectFile; the prompt text is NOT modified (§6.4).

## Scope boundaries (S1 = this subtask ONLY)
- ❌ injectMarkdown rewrite (delete Step 3.5 + Step 4; emit verbatim; recurse over string[]) = **S2**.
- ❌ injectFiles rewrite (delete resolvedIdx/strippedText; return text verbatim) = **S3**.
- ❌ input handler `return { text: event.text }` verbatim = **T2.S1**.
- ❌ before_agent_start / computeDetailOffsets / renderInjectedMessage verification = **T2.S2**.
- ❌ test migration (stripped→verbatim assertions) = **M2**.
- ❌ README sync = **M2.T4**.
- ✅ S1 = scanTokens → string[] + processTokenStream → void + bareAt harmonization + both JSDocs. The cascade breakages at injectMarkdown/injectFiles are EXPECTED (S2/S3).

## Why idx stays but prefixLen goes
- `idx` (the marker's start index) is consumed INSIDE scanTokens by `inCode(c.idx, codeRanges)` (L882) to decide code-region exemption. It is NOT returned. So it stays in the internal `cands` array.
- `prefixLen` (2 for `#@`, 1 for `@`) was returned ONLY so a consumer could strip the marker (`slice(index, index + prefixLen)`). With stripping removed, it has no consumer. Drop it from cands AND from the output.

## DOCS: Mode A (rides with the code change)
Rewrite the scanTokens + processTokenStream JSDoc to reflect the new return types + the "markers detected,
never stripped" contract (§6.4/§12.16). Internal-function docs; no user-facing/config/API surface change.