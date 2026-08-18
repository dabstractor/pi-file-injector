# P1.M1.T1.S3 — Research Notes

## Task
Add two module-level const regexes to `file-injector.ts` (after `BARE_AT_RE`, before `MIME_BY_EXT`):
- `URL_INJECT_RE` — `#`-triggered URL candidate detector (disjoint from `#@` file trigger)
- `URL_SHAPE_RE` — anchored shape gate that decides if a candidate token is URL-shaped

No runtime behavior change (nothing reads them until P1.M1.T2.S3 wires the loop).

## Verified codebase facts (direct read/grep, 2024 file HEAD)

### Regex block — file-injector.ts L9-17 (exact, current state)
```
L9 : const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
L10-15: JSDoc for BARE_AT_RE (5 lines)
L16: const BARE_AT_RE     = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
L17: const MIME_BY_EXT: Record<string, string> = {
```
- INSERTION POINT: between L16 (BARE_AT_RE) and L17 (MIME_BY_EXT).
- Both shipped regexes use Unicode lookbehind `(?<![\p{L}\p{N}_…])` + the **`u`** flag — NOT the PRD spec's literal `(?<=\W)`. (architecture/system_context.md Refinement #1.)

### Convention to mirror (Refinement #1)
`URL_INJECT_RE` MUST use the Unicode form `(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu`, NOT the spec's `/(^|(?<=\W))#(?!@)(\S+)/g`. The `(?!@)` lookahead keeps it disjoint with `#@` (file trigger). `u` flag mandatory.

### URL_SHAPE_RE — no Unicode convention needed
URL_SHAPE_RE is an anchored shape-match `^…$` with no lookbehind and no `\p{}` classes. It uses the `i` flag (case-insensitive), NO `u` flag. This is correct per the contract (given verbatim). Only URL_INJECT_RE mirrors the Unicode lookbehind convention.

### capture-group-2 convention (consuming code, for P1.M1.T2.S3)
`cleanToken` is at L91 (exported). `scanTokens` consumes FILE_INJECT_RE/BARE_AT_RE matches as:
```ts
for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2] });
```
So **capture group 2 = the token**. URL_INJECT_RE keeps this convention: `m[2]` is the URL candidate. The P1.M1.T2.S3 loop will be `cleanToken(m[2])` then `URL_SHAPE_RE.test(...)`.

### JSDoc style to mirror (from L10-15 BARE_AT_RE)
- Multi-line `/** ... */`
- References PRD section (e.g. "PRD §4.6") and/or spec section
- Explains the lookbehind/lookahead logic in prose
- Notes the ASCII-equivalent spec form vs the Unicode recommendation
- Notes where it wires in ("Wires into scanTokens via …")
- Mark NOT exported where relevant

## Regex literals (verbatim from contract — do NOT alter)
```ts
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

## Collision behavior (PRD §2.3) — what URL_SHAPE_RE must enforce
| token | matched? | why |
|---|---|---|
| #example.com/path | ✅ | dotted host, alpha TLD |
| #https://x.com/y | ✅ | scheme |
| #sub.example.co.uk/a | ✅ | multi-label host |
| #@file.txt | ✅ file (NOT url) | `#@` claimed by FILE_INJECT_RE; URL_INJECT_RE `(?!@)` |
| # Heading | ❌ | space after # |
| #1234 | ❌ | no dot/scheme |
| #fff / #tag | ❌ | no dot/scheme |
| C# / objective-C# | ❌ | mid-word (# not at boundary) |
| #v1.2 / #3.14 | ❌ | final label numeric → fails alpha-TLD |
| #node.js | ⚠️ shape-match → no-op | alpha TLD `js` matches shape; won't resolve → verbatim |

## Validation (verified in package.json)
- `npm run typecheck` → scripts/typecheck.mjs → tsc --strict over file-injector.ts only (temp tsconfig files:["file-injector.ts"], paths map @earendil-works/* to global pi). Exits 0 on clean.
- `npm test` → `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs`. URL detection tests are P1.M2.T1, NOT added here.
- Surgical proof: `git diff file-injector.ts` must show ONLY the JSDoc + 2 const lines between BARE_AT_RE and MIME_BY_EXT. The `#@` file path must stay byte-for-byte identical (all 3 existing suites pass unchanged).

## Parallel-safety (sibling P1.M1.T1.S2, status Ready/being-implemented)
S2 edits `file-injector.ts` L177 (`FileInjectorConfig` interface — adds `enableUrls?: boolean`). That is ~160 lines AFTER the L16-17 regex block, so S2's edits do NOT shift L9/L16/L17. The two edits are line-disjoint and merge cleanly. To be robust, the implementer should anchor on the `const BARE_AT_RE =` / `const MIME_BY_EXT:` text lines, not raw integers, in case of editor line-number drift.

## Dependencies / consumers
- Consumed by: P1.M1.T2.S1 (constants block — URL_TIMEOUT_MS, URL_MAX_BYTES, etc. will be added alongside in a later step) and P1.M1.T2.S3 (the URL scan+inject loop wires `matchAll(URL_INJECT_RE)` → `URL_SHAPE_RE.test`).
- Does NOT consume S2's output. S2's `enableUrls` field gates the loop (T2.S3), not the regexes.
- Does NOT need any new imports.