# PRP — P1.M1.T1.S1 (bugfix 001_a4cee0dcf39c): Implement narrowed fmtCut + re-cleanToken retry in resolveImportPath

> **Scope flag:** This is a **Major data-integrity bugfix** (Issue 1): `resolveImportPath`'s `extCut` heuristic
> greedily truncates at the last `.md` substring, so a MISSING `report.md.backup` silently resolves to the
> EXISTING `report.md` — wrong file delivered, `#@` stripped, no signal (violates PRD §4.4/§4.5 exact-only).
> Fix = Option 2: replace `.md`-truncation with a trailing `*`/`_` formatting-strip + re-cleanToken retry.
> **Localized to file-injector.ts L150-152 + the comment block. Signature unchanged.** Scope = S1 ONLY
> (code + JSDoc/comment). Test updates are S2.

---

## Goal

**Feature Goal:** Make `resolveImportPath` honor PRD §4.4/§4.5 "extended tokens are exact-only": a token that
already carries a file extension (`report.md.backup`, `X.md.bak`, `X.md.txt`, `X.md.old`, `X.md/foo`) is tried
as-is and, if missing, returns `null` (marker left verbatim) — NEVER truncated to the base `.md`. A trailing run
of markdown-formatting glue (`*`/`_`) is still stripped (with a re-cleanToken) and retried, preserving the
GROUP-4a–4g formatting cases (`@b.md.*` → `b.md`).

**Deliverable:** Modified `file-injector.ts` (resolveImportPath L150-152: `extCut` → `fmtCut` + re-clean; the
comment block L144-149 + JSDoc L126-138 rewritten). No signature change, no test changes (S2 owns those).

**Success Definition:**
1. `npm run typecheck` → 0 errors.
2. `node ./file-injector.test.mjs` → 145 passed (primary gate; UNAFFECTED — no extCut test there).
3. `node ./relative-imports.test.mjs` → 38 passed (UNAFFECTED).
4. `node ./import-behavior.test.mjs` → **21 passed, 1 failed (test 4f)** — the single KNOWN-EXPECTED-RED
   (4f endorses the bug; S2 rewrites it). NO other case flips.
5. Direct probes return null: `resolveImportPath("report.md.backup", tmp, false)` === null; `=== null` with `true` too.
6. The VERIFIED sequencing table (4a/4b/4c/4d/4g retry resolves; 4f + all FP patterns → null) reproduces exactly.

## Why

- **Silent data-integrity defect.** The model is told it has `report.md.backup` (per the stripped prompt) but
  actually receives `report.md`. No error, no "file not found", the collapsed chat line shows the wrong path's
  `read` rendering. For files that differ meaningfully (a sanitized export vs. a secret draft; a backup vs. the
  current version), this delivers incorrect/sensitive content. Directly violates PRD §4.5 rule 3 ("tokens
  already ending in `.md`/`.markdown` or any other extension are exact-only") and §4.4 (top-level exact-only).
- **The `extCut` heuristic is not in the PRD.** It was added to strip trailing markdown formatting
  (`*@api.md.*`) that `\S+` glues onto a filename, but because it truncates *everything after the last `.md`*,
  it also strips real extensions (`.bak`, `.txt`, `.old`) and path separators (`X.md/foo`).
- **Option 2 reconciles the formatting goal with the exact-only rule.** Stripping only a *trailing run* of the
  actual glue chars (`*`/`_`) + re-cleaning preserves GROUP-4a–4g (`@b.md.*` → `b.md`) while eliminating every
  `.bak`/`.txt`/`.old`/`/foo` false positive. (Option 1 — remove entirely — would break the agreed GROUP-4
  behavior; Option 2 is the chosen fix per the issue doc.)

## What

### User-visible behavior

- A `#@`/`@` token carrying a real extension (`report.md.backup`, `weird.md.bak`, `X.md.txt`, `X.md.old`) that
  does NOT exist as a regular file is now **left verbatim** (`#@` kept, no injection) — instead of silently
  resolving to the base `.md`. Matches missing-file/directory behavior.
- A token with trailing markdown formatting (`@b.md.*`, `@b.md.**`, `@b.md*`, `@my_file.md.*`, `@x.markdown.*`)
  STILL resolves to the base `.md` (the glue is stripped, the exact path is retried). GROUP-4a–4g unchanged.

### Technical behavior (the contract)

- `resolveImportPath` builds `candidates = [token]`, then if `fmtCut = token.replace(/[*_]+$/, "")` differs and
  is non-empty, pushes `cleanToken(fmtCut)` as candidate[1]. The candidate loop + the `tryMdExt` extensionless
  `.md`/`.markdown` fallback are UNCHANGED.

### Success Criteria

- [ ] file-injector.ts L150-152 uses `fmtCut = token.replace(/[*_]+$/, "")` + `cleanToken(fmtCut)` retry (no `extCut`).
- [ ] The candidate loop (L153-160) + `tryMdExt` fallback are UNCHANGED; `resolveImportPath` signature/return unchanged.
- [ ] The VERIFIED sequencing table reproduces (4a–4d/4g retry resolves; 4f + all FP → null).
- [ ] typecheck clean; primary gate (145) + relative-imports (38) green; import-behavior has EXACTLY ONE red (4f).
- [ ] Comment block (L144-149) + JSDoc (L126-138) describe the narrowed formatting-strip behavior + cite PRD §4.4/§4.5.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
exact current code (L150-152), the exact replacement, the VERIFIED sequencing table (node-confirmed), the
load-bearing re-clean explanation, the precise gate expectation (including the one expected-red), and a
standalone verification script. One localized edit + a comment rewrite.

### Documentation & References

```yaml
# MUST READ — the VERIFIED sequencing table + the chosen fix shape (the fix MUST reproduce this table exactly)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue1_resolveimportpath.md
  why: "§'Candidate fix shape' gives the exact old→new code; §'VERIFIED sequencing' is the node-confirmed table
        for GROUP-4a–4g + every false-positive pattern; §'CRITICAL' explains why re-cleanToken(fmtCut) is
        load-bearing (4d/4g leave a trailing '.'. without it); §'Test impact' identifies import-behavior 4f as
        the known-red; §'Call sites' confirms the fix is localized (one call site: scanTokens L760)."
  critical: "The fix MUST reproduce the VERIFIED table exactly. The minimal correct strip class is [*_]+$ (do
             NOT add backtick — the GROUP-4 tests only cover * and _). re-cleanToken(fmtCut) is load-bearing."

# MUST READ — the bug contract (Expected/Actual/Root-cause/Suggested-fix) + PRD refs
- file: PRD.md  (bugfix PRD §h3.0 Issue 1)
  why: "States the §4.4/§4.5 exact-only contract being violated; lists the confirmed false-positive patterns
        (X.md.txt/.bak/.old//foo); frames Option 2 as the chosen reconciliation. Notes import-behavior 4f
        endorses the bug and must be updated (S2)."

# The file you edit (ONE localized edit + comment rewrite)
- file: file-injector.ts
  why: "resolveImportPath L139-162; the extCut at L150-152 is the edit site; the comment block L144-149 + JSDoc
        L126-138 are the docs edit. cleanToken L90-97 trims only TRAILING_PUNCT (L25 = .,;:!?\\\")]}>' — NOT */_).
        The candidate loop L153-160 + tryMdExt fallback STAY UNCHANGED. One call site: scanTokens L760."
  pattern: "cleanToken is the existing sentence-punct trimmer; the fix REUSES it on fmtCut to drop the now-exposed
            trailing '.' (e.g. my_file.md.* → fmtCut my_file.md. → cleanToken → my_file.md)."
  gotcha: "Do NOT consult path.extname of the fmtCut retry for the .md fallback — that is the separate tryMdExt
           rule (unchanged). The retry is an EXACT path test only."

# The gate with the known-expected-red
- file: import-behavior.test.mjs
  why: "Test 4f (L184-188) asserts the BUG (@weird.md.bak only-weird.md → weird.md). After S1 it FAILS (weird.md.bak
        missing, no trailing glue → null → verbatim). Test 4e (L177-181, both exist → weird.md.bak wins) STAYS GREEN.
        4f is updated in S2 — do NOT edit it in S1."
  gotcha: "import-behavior.test.mjs is NOT in npm test (only file-injector.test.mjs is). Run it explicitly to
           confirm the SINGLE expected red (4f) and no others."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (resolveImportPath L150-152 extCut→fmtCut; comment L144-149 + JSDoc L126-138)
├── file-injector.test.mjs    # run to confirm green (NOT edited — no extCut test there; S2 adds regression cases)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run — 4f EXPECTED-RED after S1 (NOT edited in S1; S2 rewrites 4f)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/issue1_resolveimportpath.md   # ← the VERIFIED table + chosen fix shape
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — resolveImportPath: extCut (L151-152) → fmtCut + cleanToken(fmtCut) retry;
                          #                  comment block (L144-149) + JSDoc (L126-138) rewritten.
# No other files. No test changes in S1 (S2 owns test 4f + primary regression cases).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — re-cleanToken(fmtCut) is LOAD-BEARING. fmtCut = token.replace(/[*_]+$/, "") strips the glue, but
//   for 4d/4g that leaves a trailing "." (my_file.md.* → my_file.md.). isRegularFile("…/my_file.md.") is FALSE
//   (does not stat as my_file.md). cleanToken(fmtCut) drops that exposed "." → my_file.md → resolves. Without
//   the re-clean, 4d/4g break. (Verified: the table's "re-cleanToken" column is the step that makes them pass.)

// CRITICAL — the S1 gate is NOT "all three suites green". import-behavior.test.mjs test 4f endorses the bug;
//   after S1 it goes RED (weird.md.bak missing → null → verbatim, but 4f asserts MD-MARKER present). This is
//   EXPECTED and is closed by S2. S1 PASS = typecheck clean + file-injector (145) + relative-imports (38)
//   green + import-behavior has EXACTLY ONE red (4f) and no others. Do NOT edit import-behavior.test.mjs in S1.

// CRITICAL — the minimal strip class is [*_]+$ (star + underscore, trailing run only). Do NOT add backtick:
//   the GROUP-4 tests only cover * and _, and the issue doc explicitly says "the minimal correct class is [*_]+$".
//   Underscore INSIDE a name (my_file.md) is NEVER stripped — only a TRAILING run; my_file.md.* → my_file.md.

// GOTCHA — do NOT consult path.extname of the fmtCut retry for the .md fallback. The tryMdExt extensionless-.md
//   fallback is a SEPARATE rule (§4.5 rule 3), applied inside the unchanged candidate loop, and only when
//   path.extname(cand)==="". The fmtCut retry is an EXACT path test only (candidate[1] fed to the same loop).

// GOTCHA — 4e (both weird.md.bak AND weird.md exist) STAYS GREEN after S1: candidate[0] = full token weird.md.bak,
//   it exists → wins. Only 4f (only weird.md exists) flips, because weird.md.bak is no longer truncated to weird.md.

// LIBRARY — String.replace(/[*_]+$/, "") with no `g` flag and a `$`-anchored class strips exactly one trailing
//   run (correct). cleanToken is idempotent on already-clean input. No regex `u`/`m` flags needed.
```

## Implementation Blueprint

### Data models and structure

No data-model change. `resolveImportPath(token, baseDir, tryMdExt): Promise<string | null>` signature unchanged.
The fix swaps one heuristic (`extCut`) for another (`fmtCut` + re-clean) and rewrites its explanatory comment.

### Implementation Patterns & Key Details

```ts
// === resolveImportPath (L139-162) — replace L150-152; keep the candidate loop + tryMdExt UNCHANGED ===

// BEFORE (L150-152, BUGGY — greedy .md-substring truncation):
//   const candidates: string[] = [token];
//   const extCut = token.match(/^.*\.(?:md|markdown)/); // greedy → cut after the LAST .md/.markdown
//   if (extCut && extCut[0] !== token) candidates.push(extCut[0]);

// AFTER (Option 2 — narrowed formatting strip + re-clean; PRD §4.4/§4.5 exact-only for extended tokens):
  const candidates: string[] = [token];
  // Narrow markdown-formatting fallback: strip a trailing run of the glue chars cleanToken does NOT handle
  // (* and _), then re-clean (to drop a now-exposed trailing ".") and retry the EXACT path. Preserves
  // GROUP-4a–4g (@b.md.* → b.md) WITHOUT turning X.md.bak/.txt/.old/foo into X.md. A genuine weird.md.bak
  // is candidate[0] and wins if it exists; if it does NOT, the retry is STILL an exact path test (no .md
  // substring truncation) → missing → null (PRD §4.4/§4.5 exact-only for extended tokens).
  const fmtCut = token.replace(/[*_]+$/, "");
  if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));

  // (the candidate loop + tryMdExt fallback below are UNCHANGED — fmtCut retry is just candidate[1])
  for (const cand of candidates) {
    const abs = expandTildeAndResolve(cand, baseDir);
    if (await isRegularFile(abs)) return abs;
    if (tryMdExt && path.extname(cand) === "") {
      if (await isRegularFile(abs + ".md")) return abs + ".md";
      if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
    }
  }
  return null;
```

### The VERIFIED sequencing table (the fix MUST reproduce this — node-confirmed)

| input (raw `\S+`) | cleanToken | fmtCut (`[*_]+$`) | re-cleanToken | result |
|---|---|---|---|---|
| 4a `b.md.*`        | `b.md.*`      | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4b `b.md.**`       | `b.md.**`     | `b.md.`      | `b.md`        | retry→resolves ✓ |
| 4c `b.md*`         | `b.md*`       | `b.md`       | `b.md`        | retry→resolves ✓ |
| 4d `my_file.md.*`  | `my_file.md.*`| `my_file.md.`| `my_file.md`  | retry→resolves ✓ (underscore INSIDE name untouched) |
| 4g `x.markdown.*`  | `x.markdown.*`| `x.markdown.`| `x.markdown`  | retry→resolves ✓ |
| 4f `weird.md.bak`  | `weird.md.bak`| (no trailing glue → fmtCut===token) | — | only candidate[0]; misses → **null** (FIXED) ✓ |
| FP `report.md.backup` | (no glue)  | —            | —             | exact-only → **null** ✓ |
| FP `X.md.txt`/`.bak`/`.old`/`/foo` | (no glue) | — | —           | exact-only → **null** ✓ |

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — ONE localized edit + comment/JSDoc rewrite):
  - change (L150-152): replace the `extCut` match+push with `fmtCut = token.replace(/[*_]+$/, "")` +
    `if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));`. Keep `const candidates = [token];`.
  - UNCHANGED: the candidate loop (L153-160); the tryMdExt extensionless-.md/.markdown fallback; cleanToken;
    TRAILING_PUNCT; expandTildeAndResolve; isRegularFile; the signature; the return type.
  - rewrite (comment L144-149 + JSDoc L126-138): describe the narrowed formatting-strip (trailing */_ + re-clean,
    NOT .md-substring truncation); cite PRD §4.4/§4.5 exact-only; note _ inside a name is never stripped; note
    the re-clean is load-bearing.

NO_CHANGES: the three .mjs suites (S2 owns test 4f + primary regression cases), package.json, scripts/typecheck.mjs,
            PRD.md, README.md, all plan/ files. No signature change. No new exports/imports.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: STANDALONE-VERIFY the fmtCut/re-clean logic (confirms the table before touching the file)
  - RUN the node one-liner in Validation Level 4. Confirm the candidates column matches the VERIFIED table.
  - This de-risks the edit: if the standalone output differs, fix the regex/re-clean BEFORE editing file-injector.ts.

Task 2: REPLACE extCut with fmtCut + re-clean (file-injector.ts L150-152)
  - CHANGE: `const extCut = token.match(/^.*\.(?:md|markdown)/); if (extCut && extCut[0] !== token) candidates.push(extCut[0]);`
    → `const fmtCut = token.replace(/[*_]+$/, ""); if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));`
  - KEEP `const candidates: string[] = [token];` (L150). KEEP the candidate loop + tryMdExt fallback UNCHANGED.
  - CRITICAL: the retry is `cleanToken(fmtCut)` — NOT `fmtCut` alone (load-bearing; see Gotchas).

Task 3: REWRITE the comment block (L144-149) + JSDoc (L126-138)
  - DESCRIBE: trailing */_ formatting-strip + re-cleanToken retry; PRD §4.4/§4.5 exact-only for extended tokens;
    _ inside a name never stripped (only a trailing run); the re-clean drops the exposed trailing ".".
  - REMOVE the old ".md-substring truncation" rationale ("A filename's extension is its natural terminator…").
  - CITE: PRD §4.4 (top-level exact-only) + §4.5 rule 3 (extended tokens exact-only).

Task 4: VERIFY gates (the S1 gate — NOT "all three green")
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 145 passed (UNAFFECTED).
  - node ./relative-imports.test.mjs → 38 passed (UNAFFECTED).
  - node ./import-behavior.test.mjs → 21 passed, 1 FAILED (4f) — the SINGLE expected red; no other case flips.
  - Confirm 4e STAYS GREEN (both exist → weird.md.bak wins).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# The fix swaps one string-heuristic for another; cleanToken + replace are standard; no type impact.
```

### Level 2: The primary gate + relative-imports (MUST stay green — they have no extCut test)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 145 passed, 0 failed (UNAFFECTED — no extCut/weird.md.bak test here)
node ./relative-imports.test.mjs     # →  38 passed, 0 failed (UNAFFECTED)
# If EITHER flips a case, the edit over-reached (re-check you did NOT touch the candidate loop or tryMdExt).
```

### Level 3: The import-behavior gate (EXACTLY ONE expected red — 4f)

```bash
cd /home/dustin/projects/pi-file-injector
node ./import-behavior.test.mjs 2>&1 | tail -20
# Expected: "21 passed, 1 failed" (or the suite's equivalent tally) with the ONE failure being test 4f:
#   "4f: truncation fallback when only the .md exists — '@weird.md.bak' (only weird.md) → weird.md"
#   (its assertion `has(o, "MD-MARKER")` now fails because weird.md.bak → null → verbatim → no MD-MARKER).
# Confirm: 4e (both exist → weird.md.bak wins) is STILL GREEN, and NO case other than 4f is red.
# This red is EXPECTED — S2 rewrites 4f to assert the PRD-compliant verbatim/null outcome.
```

### Level 4: Standalone table verification (node one-liner — confirms the fix without S2's tests)

```bash
node -e '
const TRAILING_PUNCT=".,;:!?\\\")]}>\x27"; function cleanToken(s){while(s.length&&TRAILING_PUNCT.includes(s[s.length-1]))s=s.slice(0,-1);return s;}
for(const t of ["b.md.*","b.md.**","b.md*","my_file.md.*","x.markdown.*","weird.md.bak","report.md.backup","X.md.txt"]){
  const fmt=t.replace(/[*_]+$/,""); const cand=[t]; if(fmt!==t&&fmt!=="")cand.push(cleanToken(fmt));
  console.log(JSON.stringify(t).padEnd(22),"fmtCut=",JSON.stringify(fmt).padEnd(16),"candidates=",JSON.stringify(cand));
}'
# Expected candidates:
#   "b.md.*"          → ["b.md.*","b.md"]            (4a retry)
#   "b.md.**"         → ["b.md.**","b.md"]           (4b retry)
#   "b.md*"           → ["b.md*","b.md"]             (4c retry)
#   "my_file.md.*"    → ["my_file.md.*","my_file.md"] (4d retry — _ inside untouched)
#   "x.markdown.*"    → ["x.markdown.*","x.markdown"] (4g retry)
#   "weird.md.bak"    → ["weird.md.bak"]             (4f NO retry → exact-only → null) ✓ FIXED
#   "report.md.backup"→ ["report.md.backup"]         (FP → null) ✓
#   "X.md.txt"        → ["X.md.txt"]                 (FP → null) ✓
# ALSO direct-probe the real module after the fix (S2 adds these as primary-gate cases):
#   await mod.resolveImportPath("report.md.backup", TMPDIR, false) === null
#   await mod.resolveImportPath("report.md.backup", TMPDIR, true)  === null
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 145 passed; `node ./relative-imports.test.mjs` → 38 passed.
- [ ] `node ./import-behavior.test.mjs` → EXACTLY ONE red (4f); 4e + all others green.
- [ ] The standalone table verification (Level 4) matches the VERIFIED sequencing table exactly.

### Feature Validation (behavior)

- [ ] `resolveImportPath("report.md.backup", tmp, false)` === null; same with `true`.
- [ ] GROUP-4a/4b/4c/4d/4g retry still resolves (`@b.md.*` → `b.md`, etc.).
- [ ] `weird.md.bak` (missing) → null → marker verbatim (4f's new outcome; the fix; 4f's assertion is the red).
- [ ] 4e (both exist) → `weird.md.bak` still wins (candidate[0]).
- [ ] Candidate loop + tryMdExt fallback UNCHANGED (path.extname of the retry is NOT consulted for .md appending).

### Code Quality Validation

- [ ] Only L150-152 (extCut→fmtCut) + the comment (L144-149) + JSDoc (L126-138) change.
- [ ] `cleanToken(fmtCut)` (re-clean) is present — NOT bare `fmtCut` (load-bearing).
- [ ] Strip class is `[*_]+$` (no backtick); `_` inside a name is never stripped.
- [ ] No signature change; no new exports/imports; no test edits in S1.

### Documentation

- [ ] resolveImportPath comment (L144-149) + JSDoc (L126-138) describe the narrowed formatting-strip + re-clean; cite PRD §4.4/§4.5.
- [ ] No README/user-facing change in S1 (the README sync for Issue 1 is a later milestone).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT drop the re-cleanToken(fmtCut).** `fmtCut` alone leaves `my_file.md.` (trailing `.`) for 4d/4g,
  which does NOT stat as `my_file.md` → 4d/4g break. The retry MUST be `cleanToken(fmtCut)`.
- ❌ **Do NOT edit import-behavior.test.mjs (or any test) in S1.** Test 4f's rewrite + primary-gate regression
  cases are S2. S1 owns the CODE + JSDoc only. The 4f red is expected; do not "fix" it by editing the test.
- ❌ **Do NOT claim "all three suites green."** S1's gate is: typecheck + primary (145) + relative-imports (38)
  green + import-behavior EXACTLY ONE red (4f). Mis-stating the gate hides a real regression or masks the expected red.
- ❌ **Do NOT change the candidate loop or the tryMdExt fallback.** The fmtCut retry is just candidate[1] fed to
  the EXISTING loop. The extensionless-.md fallback is a separate §4.5 rule — do NOT consult path.extname of the
  retry for .md appending.
- ❌ **Do NOT widen the strip class.** Use `[*_]+$` only (star + underscore, trailing run). Do NOT add backtick
  (the GROUP-4 tests only cover `*`/`_`; the issue doc says the minimal correct class is `[*_]+$`). Underscore
  INSIDE a name (`my_file.md`) is never stripped — only a trailing run.
- ❌ **Do NOT truncate at `.md`.** The whole point is to STOP matching `.md` as a substring. The retry strips
  trailing GLUE (`*`/`_`) and re-cleans; it never cuts the token at a `.md` boundary. `report.md.backup` has no
  trailing glue → only candidate[0] → exact-only → null.
- ❌ **Do NOT touch resolveImportPath's signature or return type.** It stays `(token, baseDir, tryMdExt) => Promise<string | null>`.
  The single call site (scanTokens L760) needs no change.

---

## Confidence Score: 9/10

A localized, well-specified fix: one heuristic (`extCut`) swapped for another (`fmtCut` + re-clean), with the
VERIFIED sequencing table (node-confirmed) as the authoritative spec and a standalone verification script that
de-risks the edit before touching the file. The architecture doc pins the exact old→new code, the load-bearing
re-clean, the one expected-red (import-behavior 4f → S2), and the localized blast radius (one call site). The
primary gate (145) has no extCut test → stays green. The -1 reserves for the re-clean-is-load-bearing trap
(forgetting it silently breaks 4d/4g, caught only by S2's GROUP-4 tests which aren't run in S1 — so the standalone
Level-4 check is the in-S1 guard) and the gate-discipline nuance (the import-behavior 4f red is expected, not a
regression). One file; the implementing agent re-runs `npm run typecheck` + the three suite commands.
