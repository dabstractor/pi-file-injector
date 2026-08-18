# Research Notes — P1.M1.T2.S3 (URL scan+inject loop wiring + input handler pre-check)

Verified against `file-injector.ts` (HEAD after T2.S1 + T2.S2 landed; baseline `npm run typecheck`
= 0 errors). The line numbers in the item description are STALE (pre-T2.S1); T2.S1 added ~210 lines.
All numbers below are the CURRENT verified positions.

## 0. Producer / sibling state at T2.S3 start (VERIFIED present in source)

| Producer | Deliverable | Verified location | Status for T2.S3 |
|---|---|---|---|
| P1.M1.T1.S2 | `enableUrls?: boolean` on `FileInjectorConfig` | L210 | CONSUMED (handler reads `cfg.enableUrls`) |
| P1.M1.T1.S3 | `URL_INJECT_RE` (group 2 = token) | L26 | CONSUMED (scan loop `text.matchAll`) |
| P1.M1.T1.S3 | `URL_SHAPE_RE` (anchored shape gate) | L36 | CONSUMED (`URL_SHAPE_RE.test(tok)`) |
| P1.M1.T2.S1 | `injectUrl(url, state, ctx): Promise<boolean>` | L830 | CONSUMED (the loop calls it) |
| P1.M1.T2.S1 | `FileDetail.kind += "url"` | L472 | ALREADY PRESENT (no-op for T2.S3) |
| P1.M1.T2.S1 | `readBodyCapped` / `readBytesCapped` / `formatUrlBlock` | L767/L789/L758 | used INTERNALLY by injectUrl (T2.S3 does NOT call them) |
| P1.M1.T2.S2 | `readLine` url renderer branch | L1018 | ALREADY PRESENT (no-op for T2.S3) |

**Both T2.S1 and T2.S2 have LANDED.** T2.S3 is PURELY the wiring task: add the `enableUrls` seam, the
scan+inject loop, and broaden the pre-check. No new functions, no new types, no new constants.

## 1. The THREE edit sites (CURRENT verified line numbers + exact source text)

### Edit A — `injectFiles` signature (L1326–L1331): add 5th param `enableUrls = true`
```ts
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false, // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }> {
```
→ add a 5th trailing param `enableUrls = true` (mirrors the `bareAt` seam pattern; default `true` so
direct unit tests like `injectFiles(prompt, [], ctx, false, true)` get the URL branch by default).

### Edit B — URL scan+inject loop: INSERT between L1392 (`processTokenStream` call end) and L1394 (`state.count === 0` early return)
Current (L1391–L1394):
```ts
  await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);

  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)
```
Insert the loop in the blank line between them. The loop MUST sit here (not before processTokenStream,
not after the count check) because:
- AFTER processTokenStream → files claim `state.injectedSet` first; a URL whose absolute form collided
  with a delivered file path would be deduped (defense-in-depth; in practice URLs never collide with abs paths).
- BEFORE the `state.count === 0` check → because `injectUrl` does `state.count++` on success, so a
  URL-ONLY prompt (no `#@file`) leaves `state.count > 0` and the early return correctly stays open.

### Edit C — input handler (L1467 + L1469): broaden pre-check + pass 5th arg
Current (L1467):
```ts
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)
```
→ `if (!event.text?.includes("#")) return { action: "continue" };` (both triggers contain `#`).
Current (L1469):
```ts
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true); // ...
```
→ append 5th arg `cfg.enableUrls !== false`.

## 2. The exact loop body (from the item contract, validated against current source)

```ts
if (enableUrls) {
  for (const m of text.matchAll(URL_INJECT_RE)) {
    const tok = cleanToken(m[2]);
    if (tok && URL_SHAPE_RE.test(tok)) {
      const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
      if (!state.injectedSet.has(abs)) {
        state.injectedSet.add(abs);
        await injectUrl(abs, state, ctx);
      }
    }
  }
}
```

Cross-checked against every symbol it references:
- `URL_INJECT_RE` (L26): `/gu` flagged → `matchAll` is legal (matchAll REQUIRES the `g` flag). Group 2
  is the token after `#` (mirrors FILE_INJECT_RE's group-2 convention).
- `cleanToken` (L121, exported): strips trailing `TRAILING_PUNCT` (`.`,`,`,`;`,`:`,`!`,`?`,`"`,`)`,
  `]`,`}`,`>`,`'`) → e.g. `#example.com.` → `"example.com"`.
- `URL_SHAPE_RE` (L36): anchored `^…$` → `.test()` gate accepts scheme + dotted-alpha-TLD shapes,
  rejects `#Heading` / `#1234` / `#fff`.
- `state.injectedSet` (L501): `Set<string>` seeded with priorPaths; SAME set the file path uses →
  dedup spans BOTH triggers. Dedup key = ABSOLUTE URL form → `#example.com` and `#https://example.com`
  collapse to one (`https://example.com`).
- `injectUrl` (L830): private, `Promise<boolean>`, never throws, does `state.count++` exactly once on
  success, mutates shared `state` (blocks/details/images/remaining/count). Returns `false` → token left
  verbatim (no block appended).

## 3. The `enableUrls !== false` gate (Refinement #2 — load-bearing)

`readConfig` (L196–218 region) returns `{}` when all sources are missing. So `cfg.enableUrls` is
`undefined` by default. The gate MUST be `cfg.enableUrls !== false` (default ENABLED), NOT `=== true`
(which would DISABLE URLs by default, violating spec §4 "default `true`"). This is the INVERSE polarity
of `markdownBareAtImports === true` (an opt-IN). Verified in `architecture/system_context.md` Refinement #2.

## 4. Pre-check broadening safety analysis

`includes("#@")` → `includes("#")` is a SUPERSET pre-check. Prompts that now pass it but contain no
real trigger (e.g. `# Heading`, `# 1234`, `C# rocks`):
- `# Heading`: FILE_INJECT_RE needs `#@` → no file match. URL_INJECT_RE matches `#Heading` (token
  `Heading`), but `URL_SHAPE_RE.test("Heading")` = false (no scheme, no dotted host) → no URL inject.
- Result: `injectFiles` returns `injected: 0` → handler's `if (!injected) return { action: "continue" }`
  (L1471) preserves the prompt byte-for-byte. No behavior change, only a (cheap) no-op regex scan.
- `C# rocks`: the lookbehind `(?<![\p{L}\p{N}_])` blocks `#` preceded by a word char (`C` is `\p{L}`) →
  not even a candidate. Safe.

So broadening to `#` is correct and only costs one extra regex scan on `#`-bearing prose prompts.

## 5. The shared-state invariant (why the loop placement is load-bearing)

`injectFiles` builds ONE `state` object (L1373–L1382): `blocks`, `details`, `images`, `injectedSet`,
`remaining`, `count`, `paged`, `bareAt`. Both `processTokenStream` (files) and the new URL loop mutate
this SAME object. Consequences:
- **Budget**: `remaining` is subtracted by both `injectFile`/`emitText` (text) AND `injectUrl`. A URL
  checked AFTER files sees the already-reduced `remaining` → the §3.3 over-budget guard in `injectUrl`
  (`state.remaining !== null && cost > state.remaining`) correctly accounts for files already delivered.
- **Dedup**: `injectedSet` is shared → a URL and a file with the same resolved key dedup (in practice
  never happens; URLs ≠ abs paths, but the invariant holds).
- **Count**: `injectUrl` does `state.count++` → the L1394 `state.count === 0` early-return correctly
  stays open for URL-only prompts (no `#@file`). This is the SINGLE reason the loop must precede the
  count check.
- **Paged**: `injectUrl` NEVER touches `state.paged` (URLs never page, §3.3). The `whole = injected -
  paged` notify math (L1478) is unaffected structurally (URL successes raise `count`/`injected` but not
  `paged` → they count as "whole"). The notify WORDING (`"#@ injected N whole"`) is cosmetically
  imprecise for URL-only prompts but the COUNT is correct and the contract explicitly scopes this OUT
  (no notify change in T2.S3).

## 6. Verbatim-prompt invariant (UNCHANGED)

`injectFiles` returns the ORIGINAL `text` (never modified — §6.4/§13.8). The handler returns
`text: event.text` (L1481) verbatim. A URL that fails injection (network error / over-budget / SPA /
unhandled content-type) → `injectUrl` returns `false` → no block → the `#<url>` token stays in the
prompt byte-for-byte, EXACTLY like a failed `#@file` token. No stripping, anywhere. This is why
cancel/fork/`/tree`-navigate re-triggers injection.

## 7. Validation gates (verified executable)

- `npm run typecheck` → `scripts/typecheck.mjs` runs `tsc --strict` (moduleResolution Bundler, paths
  only for `@earendil-works/*`). The new param + loop typecheck (all symbols resolve: cleanToken
  exported, URL_*_RE module-level, injectUrl in-scope, state.injectedSet: Set<string>). Baseline = 0
  errors (confirmed by running it pre-edit).
- `npm test` → `&&` chain of three `.mjs` files. The module-surface allowlist
  (`file-injector.test.mjs` ~L136–156) is UNCHANGED (T2.S3 adds NO new export — it modifies the
  EXISTING exported `injectFiles` signature additively and edits the private input handler). The ~25
  `#@file` assertions + handler guards stay green (no `#@file` behavior change). Requires the global pi
  package for the jiti loader; if absent, typecheck is the authoritative gate.

## 8. Out of scope (scope discipline — do NOT do these)

- Changing the notify wording (cosmetically imprecise for URL-only; count is correct; contract scopes out).
- Adding URL behavioral tests (those are P1.M2.T1.S1/S2 with `globalThis.fetch` stubbed).
- Touching `injectUrl` / `readBodyCapped` / `readBytesCapped` / `formatUrlBlock` (T2.S1 owns them).
- Touching `readLine` / `renderInjectedMessage` (T2.S2 owns them; url branch already present).
- Adding a `kind:"url"` union member (already present from T2.S1).
- Any network call (the loop only runs `injectUrl` which does the fetch; tests stub `globalThis.fetch`).