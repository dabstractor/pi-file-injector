# Research Notes — P1.M1.T1.S1 (plan/005): BARE_AT_RE + prefixLen + restructure scanTokens (union #@ + bare-@)

## Mission
The **engine building block** for optional bare-`@` markdown imports (PRD §4.6). Add `BARE_AT_RE`, add a
`bareAt` opt to `scanTokens`, add a `prefixLen` field to each returned record, and restructure the scan loop
to build a union `cands` array from BOTH `FILE_INJECT_RE` (prefixLen 2) and `BARE_AT_RE` (prefixLen 1, only
when `bareAt`). **Byte-for-byte identical when `bareAt` is absent/false.** This subtask touches ONLY
`scanTokens` + adds unit tests. Consumers (processTokenStream/injectFiles/injectMarkdown) are wired in P1.M2.

## Baseline (MUST stay green)
- `node ./file-injector.test.mjs` → **92 passed, 0 failed.**
- `npm run typecheck` → **"0 errors"** under `--strict`.

## Verified facts (first-hand, working tree 879-line file-injector.ts)
- L8: `const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;` — NOT exported (a const); Unicode-aware. PRESERVE.
- L432: `export async function scanTokens(text, baseDir, opts:{allowAbsTilde;skipCode;tryMdExt}, state): Promise<{index;abs}[]>`. Body = single `for (const m of text.matchAll(FILE_INJECT_RE))` loop. Reads ONLY `state.injectedSet` (for dedup). bareAt comes via opts (item note 2), NOT State.
- L471: `async function processTokenStream(...)` — PRIVATE; opts `{allowAbsTilde;skipCode;tryMdExt}`; L478 `await scanTokens(text, baseDir, opts, state)` (forwards opts). Returns `Promise<number[]>`.
- L648 (injectMarkdown Step 3): `await scanTokens(content, dir, { allowAbsTilde:false, skipCode:true, tryMdExt:true }, state)` — no bareAt.
- L677: `const injectable: { index: number; abs: string }[] = []` — looser type (NO prefixLen); `injectable.push(r)` from records is subtype-assignable even after records gain prefixLen.
- L685 (injectMarkdown Step 4): `stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2);` — HARDCODED `+2`. Stays correct because production records always have prefixLen:2 (bareAt off). P1.M2.T2.S1 changes it to `+r.prefixLen`.
- L747 (injectFiles): `await processTokenStream(text, ctx.cwd, { allowAbsTilde:true, skipCode:false, tryMdExt:false }, state, ctx)` — no bareAt.
- `BARE_AT_RE`/`bareAt`/`prefixLen`/`markdownBareAtImports` — grep-confirmed ABSENT pre-delta.
- Test sanity list L113-130 (18 typeof asserts incl. resolveImportPath, isRegularFile). ASSERTED_EXPORTS Set L139-141 (18 names). COMPLETENESS guard filters `typeof mod[k]==="function"` — so BARE_AT_RE (a const) is NOT subject to it. `scanTokens` already asserted (plan 004).
- Existing scanTokens unit test T1.S1-7 at test L1593 calls `mod.scanTokens("…", TMPDIR, { allowAbsTilde:true, skipCode:false, tryMdExt:false }, state)` — **WITHOUT bareAt**. Its State literal has NO bareAt field (plan 005's State.bareAt is P1.M2.T1.S1).

## ⭐ CRITICAL DECISION: `bareAt` is OPTIONAL (`bareAt?: boolean`), NOT required
The architecture delta §5 shows the FULL-target signature `opts:{…; bareAt: boolean}` (required), but those
consumers are P1.M2's job ("Consumed by P1.M2.T1.S1 and P1.M2.T2.S1"). If T1.S1 makes `bareAt` REQUIRED, the
typecheck CASCADES:
- processTokenStream L478 forwards its own opts (typed `{allowAbsTilde;skipCode;tryMdExt}`, no bareAt) → scanTokens requiring bareAt → **type error**.
- injectMarkdown L648 literal `{allowAbsTilde:false,skipCode:true,tryMdExt:true}` → **type error**.
- injectFiles L747 (via processTokenStream) → **type error**.
- The existing T1.S1-7 test (L1593) calls scanTokens WITHOUT bareAt → at runtime it's undefined (fine for .mjs), but the production cascade breaks gate 2.

**Therefore `bareAt?: boolean` (optional).** Then:
- All existing call sites compile UNCHANGED (bareAt optional → absent = undefined).
- Behavior: `if (opts.bareAt)` → undefined OR false both SKIP bare-@ matching → byte-for-byte identical.
- typecheck GREEN (gate 2).
- Scope respected: T1.S1 touches only scanTokens + unit tests; P1.M2 wires bareAt through and MAY harden it to required once every call site passes it.

The item's "Add bareAt:boolean" is the conceptual contract; `bareAt?: boolean` is the pragmatic realization that satisfies all three gates (typecheck + byte-for-byte + scope). Use `if (opts.bareAt)` (NOT `opts.bareAt === true` is also fine; both treat undefined/false identically).

## BARE_AT_RE — VERIFIED via node one-liner (recommended Unicode form)
```ts
const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;  // markdown opt-in (§4.6); NOT after # or a word char
```
Verified matches/exclusions:
| input | FILE_INJECT_RE | BARE_AT_RE | notes |
|---|---|---|---|
| `#@file` | idx 0, g2 "file" | **(none)** | lookbehind forbids preceding `#` → no double-match ✓ |
| `@api.md` | (none) | idx 0, g2 "api.md" | start anchor ✓ |
| `Review @api.md here` | (none) | idx 7, g2 "api.md" | preceded by space ✓ |
| `user@host.com` | (none) | (none) | mid-word `@` excluded ✓ |
| `café@x` / `日本語@x` | (none) | (none) | Unicode `\p{L}` excludes ✓ |
| ` #@a.md and @b.md ` | idx 1 (a.md) | idx 12 (b.md) | both fire, distinct markers ✓ |
PRD §4.6 literal `/(^|(?<=[^\w#]))@(\S+)/g` is also acceptable (ASCII paths identical); the Unicode form is RECOMMENDED for consistency with the shipped FILE_INJECT_RE. Document the choice in a comment.

## scanTokens delta (L432) — opts +prefixLen(optional bareAt); return +prefixLen; cands union
```diff
  export async function scanTokens(
    text: string,
    baseDir: string,
-   opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean },
+   opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },   // bareAt OPTIONAL
    state: State,
- ): Promise<{ index: number; abs: string }[]> {
+ ): Promise<{ index: number; prefixLen: number; abs: string }[]> {
    const localSeen = new Set<string>();
-   const out: { index: number; abs: string }[] = [];
+   const out: { index: number; prefixLen: number; abs: string }[] = [];
    const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
-   for (const m of text.matchAll(FILE_INJECT_RE)) {
+   // candidate markers: "#@" always (prefixLen 2); bare "@" when opts.bareAt (prefixLen 1).
+   // BARE_AT_RE forbids a "#" before the "@", so "#@file" matches once, not twice.
+   const cands: { idx: number; token: string; prefixLen: number }[] = [];
+   for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
+   if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
+   cands.sort((a, b) => a.idx - b.idx);
+   for (const c of cands) {
-     if (codeRanges && inCode(m.index!, codeRanges)) continue;
+     if (codeRanges && inCode(c.idx, codeRanges)) continue;            // §5.6.1 — code is exempt
-     const token = cleanToken(m[2]);
+     const token = cleanToken(c.token);
      if (!token) continue;
      if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;
-     const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);
+     const abs = await resolveImportPath(token, baseDir, opts.tryMdExt);  // dedup keys on RESOLVED abs
      if (!abs) continue;
      if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;
      localSeen.add(abs);
-     out.push({ index: m.index!, abs });
+     out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
    }
    return out;
  }
```

## Why byte-for-byte holds when bareAt is absent/false
- cands gets ONLY FILE_INJECT_RE matches (prefixLen 2). The sort is a no-op (matchAll already yields index-ascending). The per-candidate body is the EXISTING logic verbatim. → records are `{index, prefixLen:2, abs}` — same set, same order, same abs as today, just with an extra prefixLen field.
- processTokenStream uses `r.index` only (unchanged). injectMarkdown Step-4 uses `r.index + 2` (correct: all production records have prefixLen:2). Adding prefixLen to the type is subtype-assignable into `injectable:{index,abs}[]`. typecheck clean.

## TDD unit tests (item §5) — call mod.scanTokens directly; state = {blocks:[],images:[],injectedSet:new Set(),remaining:null,count:0,paged:0} (no bareAt field; scanTokens reads only injectedSet)
Fixtures exist: TMPDIR/api.md, TMPDIR/a.md, TMPDIR/b.md (buildFixtures). Cases:
- (a) bareAt:false, content "Review @api.md here" → [] (no #@; bare-@ not scanned). tryMdExt:true, skipCode:false.
- (b) bareAt:true, content "@api.md and #@b.md" → TWO records: {index:0, prefixLen:1, abs:api.md} and {index:<#>, prefixLen:2, abs:b.md}. (Assert both prefixLens present, correct abs.)
- (c) no-double-match: bareAt:true, content "#@a.md" → EXACTLY ONE record {index:0, prefixLen:2, abs:a.md}.
  (Asserts correct end-state. NOTE: dedup-on-resolved-abs masks a hypothetical same-path double at the record level — the authoritative # exclusion is the verified regex above, since BARE_AT_RE isn't exported. The implementer may add a one-line regex sanity in a comment.)
- (d) bareAt:true, content "email user@host.com" → [] (mid-word @ excluded; nothing resolves).
- (e) dedup: bareAt:true, content "#@api.md @api.md" → ONE record {index:0, prefixLen:2, abs:api.md} (both resolve to api.md; second dropped via localSeen).
- (f) code-exempt: bareAt:true, skipCode:true, content "```\n@api.md\n```" → [] (@api.md inside fenced block → inCode → skipped).

## Why NO module-surface guard change
- BARE_AT_RE is a `const` (not a function) → the COMPLETENESS guard (`Object.keys(mod).filter(k => typeof mod[k]==="function")`) ignores it. No ASSERTED_EXPORTS edit. No sanity-assert edit (scanTokens already asserted). No new exported functions in this subtask.

## Scope boundary — what T1.S1 does NOT do
- ❌ State.bareAt field (P1.M2.T1.S1).
- ❌ processTokenStream/injectFiles bareAt wiring (P1.M2.T1.S1).
- ❌ injectMarkdown bareAt wiring + Step-4 `+r.prefixLen` (P1.M2.T2.S1).
- ❌ CONFIG_DIR_NAME/getAgentDir imports, FileInjectorConfig, readConfig (P1.M1.T2.S1).
- ❌ README (P1.M3.T2.S1).
- ❌ Do NOT make bareAt required (breaks typecheck cascade; see CRITICAL DECISION).

## Gates
1. `node ./file-injector.test.mjs` → existing 92 + new 6 unit tests all PASS, exit 0.
2. `npm run typecheck` → 0 errors (bareAt optional → no cascade).
3. No guard edits needed (BARE_AT_RE is a const).

## BARE_AT_RE placement
Near FILE_INJECT_RE (L8), as `const BARE_AT_RE = …` (NOT exported), with a comment citing PRD §4.6 + the Unicode recommendation + the critical # exclusion property.
