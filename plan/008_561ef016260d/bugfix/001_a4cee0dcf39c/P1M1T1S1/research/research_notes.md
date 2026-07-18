# Research Notes — P1.M1.T1.S1 (bugfix 001_a4cee0dcf39c): narrowed fmtCut + re-cleanToken retry in resolveImportPath

## Mission
Fix Major Issue 1: `resolveImportPath`'s `extCut` heuristic (`token.match(/^.*\.(?:md|markdown)/)`) greedily
truncates at the LAST `.md` substring, so a MISSING `report.md.backup` silently resolves to the EXISTING
`report.md` → wrong file's contents reach the model, `#@` stripped, no signal (PRD §4.4/§4.5 exact-only
violation). Fix = Option 2: replace the `.md`-truncation with a trailing `*`/`_` formatting-strip + re-cleanToken
retry. Localized to file-injector.ts L150-152 (+ the comment block L144-149). Signature unchanged.

**Scope = S1 ONLY:** the code change + JSDoc/comment update. NOT the import-behavior.test.mjs 4f update or
the primary-gate regression cases (those are S2).

## Baseline (MUST stay green except the one known-expected-red)
- `node ./file-injector.test.mjs` → **145 passed, 0 failed** (primary gate; has NO extCut test → UNAFFECTED by the code change).
- `node ./relative-imports.test.mjs` → **38 passed, 0 failed** (UNAFFECTED).
- `node ./import-behavior.test.mjs` → **22 passed, 0 failed** BEFORE S1; **21 passed, 1 FAILED (test 4f) AFTER S1** —
  this is the KNOWN-EXPECTED-RED: 4f endorses the buggy behavior and is updated to the PRD-compliant outcome in S2.
- `npm run typecheck` → **0 errors** under `--strict`.

## ⭐ The S1 gate is NOT "all three suites green"
S1 changes resolveImportPath's behavior. `import-behavior.test.mjs` test **4f** (L184-188) currently asserts
the BUG: `@weird.md.bak` (only weird.md exists) → weird.md. After S1, `weird.md.bak` (missing, no trailing
glue) → null → verbatim → 4f FAILS. **This is expected and is closed by S2** (which rewrites 4f to assert
null/verbatim). So:
- S1 PASS = typecheck clean + file-injector.test.mjs 145 green + relative-imports 38 green + import-behavior
  has EXACTLY ONE red (4f) and NO others.
- Do NOT weaken/skip 4f in S1, and do NOT edit import-behavior.test.mjs in S1 (that's S2). Just acknowledge
  the single expected red.

## The exact fix (issue1_resolveimportpath.md §"Candidate fix shape" — VERIFIED)
File: `file-injector.ts`, `resolveImportPath` (L139-162). Replace L150-152.

**Current (L150-152, BUGGY):**
```ts
const candidates: string[] = [token];
const extCut = token.match(/^.*\.(?:md|markdown)/); // greedy → cut after the LAST .md/.markdown
if (extCut && extCut[0] !== token) candidates.push(extCut[0]);
```
**After (Option 2 — narrowed formatting strip + re-clean):**
```ts
const candidates: string[] = [token];
// Narrow markdown-formatting fallback: strip a trailing run of the glue chars cleanToken does NOT
// handle (* and _), then re-clean (to drop a now-exposed trailing ".") and retry the EXACT path.
// Preserves GROUP-4a–4g (@b.md.* → b.md) WITHOUT turning X.md.bak/.txt/.old into X.md (PRD §4.4/§4.5
// exact-only for extended tokens). A genuine weird.md.bak is candidate[0] and wins if it exists; if it
// does NOT, the retry is STILL an exact path test (no .md substring truncation) → missing → null.
const fmtCut = token.replace(/[*_]+$/, "");
if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));
```
- `const candidates: string[] = [token];` STAYS (L150).
- The candidate loop (L153-160) + the `tryMdExt` extensionless-.md fallback STAY UNCHANGED.
- The comment block (L144-149) is REWRITTEN (see DOCS) — the old comment describes the `.md`-truncation rationale.

## ⭐ The VERIFIED sequencing table (the fix MUST reproduce this exactly — node-confirmed)
| input (raw \S+) | cleanToken | fmtCut (`[*_]+$`) | re-cleanToken | result |
|---|---|---|---|---|
| 4a `b.md.*`        | `b.md.*`      | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4b `b.md.**`       | `b.md.**`     | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4c `b.md*`         | `b.md*`       | `b.md`       | `b.md`        | retry→resolves ✓ |
| 4d `my_file.md.*`  | `my_file.md.*`| `my_file.md.`| `my_file.md`  | retry→resolves ✓ (underscore INSIDE name untouched) |
| 4g `x.markdown.*`  | `x.markdown.*`| `x.markdown.`| `x.markdown`  | retry→resolves ✓ |
| 4f `weird.md.bak`  | `weird.md.bak`| (no trailing glue → fmtCut===token) | — | only candidate[0]; misses → **null** (FIXED) ✓ |
| FP `report.md.backup` | (no glue)  | —            | —             | exact-only → **null** ✓ |
| FP `X.md.txt`/`.bak`/`.old`/`/foo` | (no glue) | — | —           | exact-only → **null** ✓ |

## ⭐ CRITICAL: the re-cleanToken(fmtCut) is load-bearing
Without it, 4d/4g leave a trailing `.`: `my_file.md.*` → fmtCut `my_file.md.` → (no re-clean) candidate[1]
`my_file.md.` → isRegularFile(`…/my_file.md.`) → false (does NOT stat as `my_file.md`) → 4d/4g BREAK.
fmtCut strips the glue (`*`/`_`); re-cleanToken strips the now-exposed sentence punct (`.`). Both steps required.

## Why the primary gate stays green
`file-injector.test.mjs` (145 cases) has ZERO references to `extCut`/`report.md.backup`/`weird.md.bak`/`fmtCut`
(grep-confirmed). It neither endorses nor rejects the truncation behavior. So the code change does not flip
any primary-gate case. S2 ADDS the false-positive regression cases to the primary gate.

## Why import-behavior 4f is the ONLY red (and 4e stays green)
- 4e (L177-181): `@weird.md.bak` with BOTH weird.md.bak AND weird.md existing → weird.md.bak wins (candidate[0]
  = full token, exists). After S1: still candidate[0], still exists → still wins. 4e STAYS GREEN. ✓
- 4f (L184-188): `@weird.md.bak` with ONLY weird.md existing → OLD: extCut truncates to weird.md → resolves.
  AFTER S1: no trailing glue → only candidate[0] weird.md.bak → misses → null → verbatim. 4f's assertion
  `has(o, "MD-MARKER")` FAILS (no MD-MARKER). → 4f RED. Closed by S2.

## Call sites / blast radius (localized)
- `resolveImportPath` has exactly ONE call site: `scanTokens` L760.
- `scanTokens` is reached from two entry points: markdown imports (L982, `tryMdExt:true`) and top-level
  prompts (L1101 via processTokenStream, `tryMdExt:false`).
- The fix is localized to L150-152 + the comment. No signature change. No downstream consumer change
  (`scanTokens` receives a string|null abs either way).

## DOCS (Mode A — rides with S1)
- Rewrite the resolveImportPath comment block (L144-149): describe the NEW narrowed formatting-strip behavior
  (trailing `*`/`_` + re-cleanToken, NOT `.md`-substring truncation); cite PRD §4.4/§4.5 exact-only for
  extended tokens; note `_` inside a name is never stripped (only a trailing run); note the re-clean is
  load-bearing. Update the resolveImportPath JSDoc (L126-138) similarly if it mentions the truncation.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ Update import-behavior.test.mjs test 4f → PRD-compliant (verbatim/null) = **S2**.
- ❌ Add false-positive regression cases to file-injector.test.mjs (top-level + markdown-import) = **S2**.
- ❌ Wire import-behavior.test.mjs into `npm test` = **M3.T1.S1**.
- ❌ Do NOT change the candidate loop, the tryMdExt extensionless-.md fallback, cleanToken, TRAILING_PUNCT,
  or resolveImportPath's signature/return type.
- ❌ Do NOT include backtick (`` ` ``) in the strip class — the GROUP-4 tests only cover `*`/`_`; the minimal
  correct class is `[*_]+$` (issue doc: "the minimal correct class is `[*_]+$`").
- ✅ S1 = replace extCut (L151-152) with fmtCut + re-clean; rewrite the comment (L144-149) + JSDoc.

## Verification (standalone, before/after coding — confirms the table without S2's tests)
```bash
node -e '
const TRAILING_PUNCT=".,;:!?\\\")]}>\x27"; function cleanToken(s){while(s.length&&TRAILING_PUNCT.includes(s[s.length-1]))s=s.slice(0,-1);return s;}
for(const t of ["b.md.*","b.md.**","b.md*","my_file.md.*","x.markdown.*","weird.md.bak","report.md.backup","X.md.txt"]){
  const fmt=t.replace(/[*_]+$/,""); const cand=[t]; if(fmt!==t&&fmt!=="")cand.push(cleanToken(fmt));
  console.log(JSON.stringify(t).padEnd(22),"fmtCut=",JSON.stringify(fmt).padEnd(16),"candidates=",JSON.stringify(cand));
}'
# Expected: b.md.*→[b.md.*,b.md]; b.md.**→[b.md.**,b.md]; b.md*→[b.md*,b.md]; my_file.md.*→[my_file.md.*,my_file.md];
#           x.markdown.*→[x.markdown.*,x.markdown]; weird.md.bak→[weird.md.bak] (no retry); report.md.backup→[report.md.backup]; X.md.txt→[X.md.txt]
```
