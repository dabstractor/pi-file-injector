# Issue 1 — `resolveImportPath` truncation heuristic (Major)

## Root cause (confirmed by reproduction)

`file-injector.ts` lines **150–152**, inside `resolveImportPath` (lines 139–162):

```ts
const candidates: string[] = [token];
const extCut = token.match(/^.*\.(?:md|markdown)/); // greedy → cut after the LAST .md/.markdown
if (extCut && extCut[0] !== token) candidates.push(extCut[0]);
```

The `extCut` regex is **greedy** (`^.*`) and matches a `.md`/`.markdown` *substring anywhere*, not only
as a true file extension. For `report.md.backup` it captures `report.md` and pushes it as candidate[1].
When the full token `report.md.backup` does NOT exist (candidate[0] misses), candidate[1] `report.md` is
tried — and if that exists, it is returned. The result: a reference to a **missing** `report.md.backup`
silently resolves to the **existing** `report.md`, the `#@` trigger is stripped, and the wrong file's
contents reach the model.

### Confirmed false-positive patterns (all resolve to the base `.md` despite the named file not existing)
`X.md.txt`, `X.md.bak`, `X.md.old`, `X.md/foo` (path separator also swallowed).

### Reproduction (verified against committed code via jiti)
```
resolveImportPath("report.md.backup", tmp, false)  => "report.md"   (should be null)
injectFiles("Compare #@report.md.backup ...")       => injected:1, text strips #@, blocks[0]=report.md
```
The same defect bites the **markdown-import path** (`injectMarkdown` → `scanTokens(..., tryMdExt:true)`,
line 982) and the **top-level path** (line 1101, `tryMdExt:false`). `extCut` runs regardless of `tryMdExt`.

## The intended purpose of `extCut` (why it exists)

`\S+` in `FILE_INJECT_RE` (line 9) glues markdown formatting onto a filename. `cleanToken` (lines 90–97)
trims only `TRAILING_PUNCT` (line 25) = `.,;:!?\")]}>'` — it does **NOT** strip `*` (italic/bold) or
`` ` ``. So `*see @ARCHITECTURE.md.*` leaves `ARCHITECTURE.md.*` after cleanToken. `extCut` was added to
drop that trailing `*`/`**` by truncating at the last `.md`. The comment at lines 144–149 documents this
rationale and explicitly says "The full token always wins over the truncation" — but that invariant only
holds when the full token **exists**. When it does NOT, the truncation silently wins, which is the bug.

## The PRD contract being violated

- **§4.5 rule 3** (PRD line 237): "tokens already ending in `.md`/`.markdown` **or any other extension**
  are exact-only, so `#@PRD.md` never becomes `PRD.md.md`."
- **§4.4** (PRD line 227): top-level user tokens are exact-match only.
- The `extCut` heuristic is **not in the PRD** and directly contradicts "extended tokens are exact-only."
- `X.md.bak` HAS an extension (`.bak`), so under §4.5 it must be exact-only. If `X.md.bak` doesn't exist
  as a regular file, it must be **left verbatim** (null) — never truncated to `X.md`.

## Chosen fix — PRD option 2 (narrow truncation to trailing markdown-formatting chars)

Replace the `.md`-truncation with a **trailing run** of `*` and `_` (the actual glue characters) stripped
from the token, then retry the EXACT path. This preserves the GROUP-4a–4d formatting cases the
`import-behavior.test.mjs` GROUP-4 suite is designed to protect, while eliminating `.bak`/`.txt`/`.old`/
`/foo` false positives.

### Why option 2 over option 1 (remove extCut entirely)
The `import-behavior.test.mjs` GROUP-4 suite (cases 4a `@b.md.*`→`b.md`, 4b `@b.md.**`, 4c `*see @b.md*`,
4d `@my_file.md.*`) documents an agreed-with-user behavior: markdown emphasis glued to a `.md` filename
should still resolve. Option 1 (remove extCut) would break 4a–4d and require deleting those tests.
Option 2 keeps 4a–4d working AND fixes the data-integrity bug. NOTE: underscore `_` must be handled
carefully — it IS a valid filename char (case 4d `my_file.md.*`), so we strip trailing `*`/`_` *only as
a formatting run*, but `_` inside the name is never stripped (cleanToken already preserves it; the
trailing-strip must not touch `my_file.md`'s leading underscore).

### Candidate fix shape (lines 150–152 become) — VERIFIED against all GROUP-4 cases
```ts
const candidates: string[] = [token];
// Narrow markdown-formatting fallback: strip a trailing run of the glue chars cleanToken does NOT
// handle (* and _), then re-clean (to drop a now-exposed trailing ".") and retry the EXACT path.
// Preserves GROUP-4a–4g (@b.md.* → b.md) WITHOUT turning X.md.bak/.txt/.old into X.md. A genuine
// weird.md.bak is candidate[0] and wins if it exists; if it does NOT, the retry is STILL an exact
// path test (no .md substring truncation), so a missing weird.md.bak with no weird.md stays verbatim
// (PRD §4.4/§4.5 exact-only).
const fmtCut = token.replace(/[*_]+$/, "");
if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));
```

### VERIFIED sequencing (run this exact table before coding — node-confirmed):
| input (raw \S+) | cleanToken | fmtCut (`[*_]+$`) | re-cleanToken | result |
|---|---|---|---|---|
| 4a `b.md.*`        | `b.md.*`      | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4b `b.md.**`       | `b.md.**`     | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4c `b.md*`         | `b.md*`       | `b.md`       | `b.md`        | retry→resolves ✓ |
| 4d `my_file.md.*`  | `my_file.md.*`| `my_file.md.`| `my_file.md`  | retry→resolves ✓ (underscore INSIDE name untouched) |
| 4g `x.markdown.*`  | `x.markdown.*`| `x.markdown.`| `x.markdown`  | retry→resolves ✓ |
| 4f `weird.md.bak`  | `weird.md.bak`| (no trailing glue) | —      | only candidate[0]; misses → **null** (FIXED) ✓ |
| FP `report.md.backup` | (no glue) | —            | —             | exact-only → **null** ✓ |
| FP `X.md.txt`/`.bak`/`.old`/`/foo` | (no glue) | — | —        | exact-only → **null** ✓ |

**CRITICAL**: the re-`cleanToken(fmtCut)` step is load-bearing — without it, 4d/4g leave a trailing
`.` (`my_file.md.`) which does NOT stat as `my_file.md`, breaking those cases. fmtCut strips the glue
(`*`/`_`); re-cleanToken strips the exposed sentence punctuation (`.`). Backtick (\`) is also a glue
char cleanToken omits; evaluate whether to include it in the class — the GROUP-4 tests only cover
`*`/`_`, so the minimal correct class is `[*_]+$`. Do NOT consult `path.extname` of the retry for the
`.md` fallback (that is the separate `tryMdExt` rule, unchanged).

## Test impact

- **`import-behavior.test.mjs` test 4f** (lines 208–213) currently asserts the PRD-VIOLATING outcome
  (`@weird.md.bak` only-weird.md-exists → `weird.md`). **Must be updated** to assert the PRD-compliant
  outcome: `weird.md.bak` missing → token left verbatim, `injected === 0`, no `MD-MARKER`. Test 4e
  (both exist → `weird.md.bak` wins) stays valid.
- **`import-behavior.test.mjs` is NOT in `npm test`** (package.json line 9). It must be wired in
  (see Milestone M3) so the truncation behavior is gated going forward.
- **`file-injector.test.mjs`** (primary gate) needs new regression cases for the false-positive patterns
  at both top-level and markdown-import paths.

## Call sites / blast radius

- `resolveImportPath` has exactly ONE call site: `scanTokens` line 760.
- `scanTokens` is reached from two entry points: markdown imports (line 982, `tryMdExt:true`) and
  top-level prompts (line 1101 via `processTokenStream`, `tryMdExt:false`).
- The fix is **localized to lines 150–152** and the regex constant. No signature change. No downstream
  consumer change (`scanTokens` receives a string|null abs either way).
