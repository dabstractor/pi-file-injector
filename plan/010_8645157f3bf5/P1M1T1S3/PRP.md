# PRP — P1.M1.T1.S3: URL_INJECT_RE + URL_SHAPE_RE detection regex constants

---

## Goal

**Feature Goal**: Add two module-level const regex constants (`URL_INJECT_RE`, `URL_SHAPE_RE`) to `file-injector.ts`, immediately after the existing `BARE_AT_RE` constant, mirroring the shipped Unicode-lookbehind convention. Each constant carries a JSDoc block explaining its role, its disjointness with the `#@` file trigger, and the prose-rejection behavior. **No runtime behavior change** — nothing reads these constants until P1.M1.T2.S3 wires the URL scan+inject loop.

**Deliverable**: Two new `const` declarations (with JSDoc) inserted between `BARE_AT_RE` (L16) and `MIME_BY_EXT` (L17) in `file-injector.ts`. Edit is the ONLY change. No tests added (those are P1.M2.T1).

**Success Definition**: `npm run typecheck` exits 0; all three existing test suites pass unchanged (`npm test` exits 0); `git diff file-injector.ts` shows ONLY the two JSDoc blocks + two `const` lines added between `BARE_AT_RE` and `MIME_BY_EXT`; the `#@` file-injection path is byte-for-byte unchanged.

## User Persona

**Target User**: Implementer of the URL branch (P1.M1.T2) and downstream maintainer.
**Use Case**: These constants are imported/referenced by the URL scan loop (P1.M1.T2.S3) and documented as the detection contract for the `#<url>` feature.
**Pain Points Addressed**: Establishes the URL-candidate detection regex and the URL-shape gate as stable, named, documented module constants before the pipeline consumes them — decoupling detection from fetch logic.

## Why

- **Detection contract for the `#<url>` feature**: these two regexes define *what counts as a URL candidate* and *what shape a candidate must have to be treated as a URL*. Defining them now (before the pipeline) makes P1.M1.T2 a pure wiring task.
- **Consistency with shipped code**: `FILE_INJECT_RE` and `BARE_AT_RE` use the Unicode lookbehind `(?<![\p{L}\p{N}_…])` + the `u` flag. `URL_INJECT_RE` must match this convention (architecture Refinement #1) — NOT the PRD spec's literal `(?<=\W)` ASCII form.
- **Disjointness guarantee**: the `(?!@)` negative lookahead ensures `#@file` is matched ONLY by `FILE_INJECT_RE`, never as a URL candidate. This is the foundation of the "two triggers, disjoint" grammar (PRD §2.1).
- **Collision-free prose**: `URL_SHAPE_RE`'s alpha-TLD/scheme gate leaves `#Heading`, `#1234`, `#fff`, `#3.14`, `#v1.2`, `C#` untouched as ordinary prose (PRD §2.3).

## What

Two new module-level `const` declarations, each preceded by a JSDoc block, added to `file-injector.ts` between the `BARE_AT_RE` constant and the `MIME_BY_EXT` constant. They are **NOT exported** (consumed only within the module, like `FILE_INJECT_RE`/`BARE_AT_RE`). No imports added. No other line touched.

### Success Criteria

- [ ] `URL_INJECT_RE` is present as a module-level `const` with the exact literal `/^.../gu` form specified below.
- [ ] `URL_SHAPE_RE` is present as a module-level `const` with the exact literal `/^...$/i` form specified below.
- [ ] Both are located between `BARE_AT_RE` and `MIME_BY_EXT`.
- [ ] Each has a multi-line JSDoc block above it covering the required points (see Implementation Tasks).
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0 (all 3 existing suites unchanged).
- [ ] `git diff file-injector.ts` shows ONLY the additions described above.

## All Needed Context

### Context Completeness Check

_Pass_: "If someone knew nothing about this codebase, would they have everything needed to implement this successfully?" — **Yes.** The exact regex literals are given verbatim; the exact insertion anchors (`const BARE_AT_RE =` … `const MIME_BY_EXT:`) are named; the JSDoc content requirements are enumerated; the validation commands are verified against `package.json`. No external library or API knowledge is required — this is two regex constants matching an existing in-file convention.

### Documentation & References

```yaml
- file: file-injector.ts
  why: The ONLY file edited. Contains the regex block (L9-16) where both new constants are inserted after BARE_AT_RE (L16), before MIME_BY_EXT (L17).
  pattern: |
    L9 : const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;   ← Unicode lookbehind + `u` flag CONVENTION TO MIRROR
    L10-15: /** JSDoc for BARE_AT_RE */ (5 lines)                    ← JSDoc STYLE TO MIRROR
    L16: const BARE_AT_RE     = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
    L17: const MIME_BY_EXT: Record<string, string> = { ... }        ← INSERT IMMEDIATELY BEFORE THIS
  gotcha: |
    Anchor on the TEXT `const BARE_AT_RE =` and `const MIME_BY_EXT:`, not on raw line numbers —
    the parallel sibling P1.M1.T1.S2 edits L177 (~160 lines below) and line numbers can drift.
    The L9-L17 block itself is unaffected by S2, but text anchors are safer.

- docfile: plan/010_8645157f3bf5/architecture/system_context.md
  why: "Refinement #1 — Regex form: Unicode lookbehind, not `\W`" states URL_INJECT_RE MUST use the Unicode form, explicitly NOT the spec's literal `(?<=\W)` form. This is the authoritative convention source.
  section: "## 3. Three Architecture Refinements → Refinement 1"

- docfile: plan/010_8645157f3bf5/P1M1T1S3/research/notes.md
  why: Verified codebase facts: exact current regex block, cleanToken location (L91), matchAll capture-group-2 usage (L887), JSDoc style, collision table, parallel-safety analysis.

# PRD spec sections (the source of the regex semantics):
- PRD §2.1 "Two triggers, disjoint" — why (?!@) exists
- PRD §2.2 "Detection regexes" — the spec's ASCII literal form (NOTE: superseded for URL_INJECT_RE by Refinement #1's Unicode form)
- PRD §2.3 "Collision table" — the prose-rejection cases URL_SHAPE_RE must enforce
- PRD §8 "Pseudocode — the URL branch" — shows both constants consumed by the loop
```

### Current Codebase tree (regex neighborhood only — this task touches a 3-line span)

```bash
file-injector.ts
  L9   const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
  L10  /** ... JSDoc for BARE_AT_RE ... */        ← (5 lines)
  L16  const BARE_AT_RE     = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
  L17  const MIME_BY_EXT: Record<string, string> = {   ← INSERT the two new consts immediately above this line
```

### Desired Codebase tree (the only delta)

```bash
file-injector.ts   (MODIFY — insert between L16 and L17)
  + /** ... JSDoc for URL_INJECT_RE ... */
  + const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;
  + /** ... JSDoc for URL_SHAPE_RE ... */
  + const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL: The shipped FILE_INJECT_RE (L9) and BARE_AT_RE (L16) use the Unicode lookbehind
// `(?<![\p{L}\p{N}_…])` WITH the `u` flag — NOT the PRD spec's literal `(?<=\W)` (ASCII).
// URL_INJECT_RE MUST mirror this Unicode form (architecture Refinement #1).
// Copy the EXACT literal from this PRP — do NOT transcribe from PRD §2.2 (which shows the old ASCII form).

// GOTCHA: URL_SHAPE_RE has NO `u` flag (it uses `i` only) — it has no `\p{}` classes and no
// lookbehind, so the Unicode convention does not apply to it. This is intentional and correct.

// GOTCHA: Both constants are module-local (NOT exported), exactly like FILE_INJECT_RE/BARE_AT_RE.
// Do NOT add `export`.

// GOTCHA: The `#@` file-injection path MUST stay byte-for-byte identical. Do NOT touch L9, L10-15, or L16.
// This edit is purely additive (2 consts + 2 JSDoc blocks inserted at one location).

// GOTCHA: line numbers L9/L16/L17 are pre-parallel-S2 anchors. S2 edits L177 (~160 lines below this
// block), so it does not shift this block. But anchor your edit on the TEXT of BARE_AT_RE / MIME_BY_EXT,
// not on raw integers, to be robust to any editor line drift.
```

## Implementation Blueprint

### Data models and structure

None — this task adds no types, no models, no state. It adds two literal regex constants.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: MODIFY file-injector.ts — insert URL_INJECT_RE + URL_SHAPE_RE after BARE_AT_RE, before MIME_BY_EXT
  - ANCHOR: the single edit boundary is the newline between `const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;` and `const MIME_BY_EXT: Record<string, string> = {`.
  - INSERT (in this exact order, verbatim):
      1. JSDoc block for URL_INJECT_RE (see "JSDoc content" below)
      2. `const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;`
      3. JSDoc block for URL_SHAPE_RE (see "JSDoc content" below)
      4. `const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;`
  - DO NOT alter: L9 (FILE_INJECT_RE), L10-15 (BARE_AT_RE JSDoc), L16 (BARE_AT_RE), or anything else.
  - DO NOT add `export`. DO NOT add imports. DO NOT add other constants (URL_TIMEOUT_MS etc. belong to P1.M1.T2.S1).
  - NAMING: URL_INJECT_RE, URL_SHAPE_RE (SCREAMING_SNAKE_CASE, matching FILE_INJECT_RE/BARE_AT_RE/MIME_BY_EXT).
  - PLACEMENT: immediately before `const MIME_BY_EXT:`.
  - DEPENDENCIES: none. No consumer exists yet (consumers arrive in P1.M1.T2.S1 + P1.M1.T2.S3).

# JSDoc content requirements (mirror the BARE_AT_RE JSDoc style at L10-15: multi-line `/** ... */`,
# reference the relevant PRD/spec section, explain the regex mechanics in prose):

JSDoc for URL_INJECT_RE MUST state:
  - Purpose: detects a URL candidate — a `#` at start-of-string OR after a non-word char (Unicode),
    NOT followed by `@` — capturing the candidate token in group 2 (mirrors FILE_INJECT_RE/BARE_AT_RE group-2 convention).
  - Disjointness: the `(?!@)` negative lookahead means `#@` is NEVER matched here (it is claimed
    exclusively by FILE_INJECT_RE); the two triggers are disjoint (PRD §2.1).
  - Convention: the Unicode lookbehind `(?<![\p{L}\p{N}_])` + the `u` flag MIRROR the shipped
    FILE_INJECT_RE (NOT the PRD §2.2 literal `(?<=\W)` ASCII form) — see architecture Refinement #1.
  - Wiring note: will be consumed by the URL scan loop via `text.matchAll(URL_INJECT_RE)` → `m[2]`
    in P1.M1.T2.S3; capture group 2 is the token. NOT exported.

JSDoc for URL_SHAPE_RE MUST state:
  - Purpose: an anchored shape gate — a candidate token is a URL iff it has an explicit scheme
    (https?|ftp) OR a dotted host whose final label is an alpha TLD (2+ letters); optional :port
    and optional path. Case-insensitive (`i` flag, no `u` flag).
  - Prose rejection (PRD §2.3): this gate leaves ordinary `#word` prose untouched — specifically
    `#Heading`, `#1234` (issue ref), `#fff` (hex), `#3.14`, `#v1.2` (final label numeric → fails
    alpha-TLD), and `C#`/`objective-C#` (mid-word, never a candidate) are all NOT matched.
  - Accepted shapes: `#example.com/path`, `#https://x.com/y`, `#sub.example.co.uk/a`.
  - Residual benign false-positive: `#node.js` matches shape (alpha TLD `js`) but won't resolve →
    the no-op fallback (PRD §3.5, P1.M1.T2) leaves it verbatim.
  - Wiring note: consumed by the URL loop as `URL_SHAPE_RE.test(cleanToken(m[2]))` in P1.M1.T2.S3.
    NOT exported.

Task 2: VALIDATE (see Validation Loop below) — no separate implementation task.
```

### Implementation Patterns & Key Details

```ts
// === EXACT literals to insert (copy verbatim — do NOT retype from the PRD, which shows the OLD ASCII form) ===

/**
 * <URL_INJECT_RE JSDoc per requirements above>
 */
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;

/**
 * <URL_SHAPE_RE JSDoc per requirements above>
 */
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;

// === How the constants will be CONSUMED (NOT your concern to implement — context only, arrives in P1.M1.T2.S3) ===
// for (const m of event.text.matchAll(URL_INJECT_RE)) {   // m[2] == candidate token (group 2)
//   const tok = cleanToken(m[2]);                          // cleanToken at L91, strips TRAILING_PUNCT
//   if (tok && URL_SHAPE_RE.test(tok)) { ... }            // shape gate; non-matches left as prose
// }
```

### Integration Points

```yaml
IMPORTS: none (no new imports needed — these are pure literal regex consts).
DATABASE: none.
CONFIG: none (the `enableUrls` gate from P1.M1.T1.S2 gates the CONSUMING loop in P1.M1.T2.S3, not these constants).
ROUTES: none.
REGISTRY: none (NOT exported; module-local, like FILE_INJECT_RE).
CONSUMERS (future, do not implement): P1.M1.T2.S1 (constants block sits nearby), P1.M1.T2.S3 (URL scan+inject loop).
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# From repo root. Run after the single edit.
npm run typecheck
# Expected: exit 0, no TS errors. (tsc --strict over file-injector.ts via scripts/typecheck.mjs;
# regex literals are literal expressions — they typecheck trivially, but this also catches any
# accidental syntax breakage from the edit.)

# Confirm the edit is purely additive and correctly placed:
git diff --stat file-injector.ts
git diff file-injector.ts
# Expected: ONLY additions between `const BARE_AT_RE = ...` and `const MIME_BY_EXT:`.
# Specifically: 2 JSDoc blocks + 2 `const` lines, and NOTHING else (FILE_INJECT_RE/BARE_AT_RE/MIME_BY_EXT unchanged).
```

### Level 2: Unit Tests (Component Validation)

```bash
# This task adds NO new tests (URL detection tests are P1.M2.T1).
# Run the existing suites to PROVE the #@ file path is byte-for-byte unchanged:
npm test
# Expected: exit 0. Runs: file-injector.test.mjs && import-behavior.test.mjs && relative-imports.test.mjs.
# (Requires the global pi package present for the jiti test loader. If `npm test` fails ONLY due to
# a missing global pi, fall back to `npm run typecheck` as the authoritative gate for this task —
# but first try `npm install -g @earendil-works/pi-coding-agent` per the repo's test harness.)
```

### Level 3: Integration Testing (System Validation)

Not applicable at this stage — nothing consumes the constants yet (the URL loop is P1.M1.T2.S3). There is no endpoint to hit and no runtime behavior to observe. The constants are inert until wired.

A lightweight manual sanity check (optional) — load the module and confirm the constants exist with the right shape:

```bash
node --input-type=module -e '
  // jiti resolves the .ts via the global pi alias map (mirrors the test harness loader).
  // If jiti/global-pi is unavailable, this check is optional — typecheck + git diff are authoritative.
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  let jiti; try { jiti = require(require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent/node_modules/jiti") } catch { console.log("[skip] jiti unavailable — typecheck is authoritative"); process.exit(0); }
  const mod = jiti("./file-injector.ts");
  // URL_INJECT_RE/URL_SHAPE_RE are NOT exported, so we cannot read them directly.
  // This check only confirms the module loads without throwing.
  console.log("[ok] file-injector.ts loads cleanly");
'
```

### Level 4: Creative & Domain-Specific Validation

For this task, the most valuable domain validation is a **regex behavior spot-check** against the PRD §2.3 collision table. Run in a throwaway `node -e` (no file changes):

```bash
node --input-type=module -e '
const URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu;
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
const test = (line, expectCand, expectShape) => {
  const m = [...line.matchAll(URL_INJECT_RE)].map(x=>x[2]);
  const cand = m.length > 0;
  const shape = cand && URL_SHAPE_RE.test(m[0]);
  const ok = (cand===expectCand) && (!expectCand || shape===expectShape);
  console.log((ok?"PASS":"FAIL"), JSON.stringify(line), "→ cand="+cand+" shape="+shape, m);
};
// (text, expectCandidate, expectShape)
test("#example.com/path",     true,  true);   // dotted host, alpha TLD
test("#https://x.com/y",      true,  true);   // scheme
test("#sub.example.co.uk/a",  true,  true);   // multi-label host
test("#@file.txt",            false, false);  // #@ → file trigger, NOT a URL candidate (?!@)
test("# Heading",             false, false);  // space after #; group2 would be "" — no candidate
test("#1234",                 true,  false);  // candidate, but shape fails (no dot/scheme)
test("#fff",                  true,  false);  // candidate, shape fails
test("#v1.2",                 true,  false);  // candidate, final label numeric → fails alpha-TLD
test("#3.14",                 true,  false);  // candidate, shape fails
test("C#",                    false, false);  // mid-word # not at boundary
test("#node.js",              true,  true);   // shape matches (benign no-op at fetch time)
'
# Expected: all PASS. This proves the exact literals behave per PRD §2.3.
# NOTE: "#1234" produces a candidate (URL_INJECT_RE matches) but URL_SHAPE_RE.test fails → left as prose.
# This is the correct, intended two-stage behavior.
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 (all 3 existing suites pass unchanged)
- [ ] `git diff file-injector.ts` shows ONLY the 2 JSDoc blocks + 2 `const` lines between `BARE_AT_RE` and `MIME_BY_EXT`

### Feature Validation
- [ ] `URL_INJECT_RE` literal is exactly `/(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu` (Unicode lookbehind + `u` flag — Refinement #1, NOT the spec's `(?<=\W)` form)
- [ ] `URL_SHAPE_RE` literal is exactly `/^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i` (`i` flag, no `u` flag)
- [ ] Both constants located between `BARE_AT_RE` and `MIME_BY_EXT`
- [ ] URL_INJECT_RE JSDoc covers: `(?!@)` disjointness with `#@`, Unicode-lookbehind convention mirroring FILE_INJECT_RE, capture group 2 = token
- [ ] URL_SHAPE_RE JSDoc covers: alpha-TLD/dot/scheme shape gate; `#Heading`/`#1234`/`#fff`/`#3.14`/`#v1.2` left as prose
- [ ] Level 4 regex spot-check: all cases PASS per PRD §2.3

### Code Quality Validation
- [ ] Follows existing naming (SCREAMING_SNAKE_CASE) and placement (module-local const block) conventions
- [ ] NOT exported (matches FILE_INJECT_RE/BARE_AT_RE)
- [ ] No new imports, no other constants added (URL_TIMEOUT_MS etc. are P1.M1.T2.S1)
- [ ] `#@` file-injection path byte-for-byte unchanged

### Documentation & Deployment
- [ ] JSDoc on both constants is self-documenting and references the relevant PRD sections (§2.1/§2.2/§2.3)

---

## Anti-Patterns to Avoid

- ❌ Don't transcribe the regex from PRD §2.2 — it shows the OLD ASCII form `(?<=\W)`. Use the Unicode form from THIS PRP (Refinement #1). Copy the literal verbatim from the "Implementation Patterns" block above.
- ❌ Don't add the `u` flag to URL_SHAPE_RE, and don't remove it from URL_INJECT_RE — the flag sets are intentional and specified exactly.
- ❌ Don't export the constants — they are module-local, like FILE_INJECT_RE/BARE_AT_RE.
- ❌ Don't add URL_TIMEOUT_MS / URL_MAX_BYTES / BROWSER_UA / injectUrl / any other URL code — those belong to P1.M1.T2.S1 / T2.S3. This task is ONLY the two detection regexes.
- ❌ Don't add tests — URL detection tests are P1.M2.T1. Adding them here pollutes the diff and risks merge conflicts with the dedicated test task.
- ❌ Don't touch L9 (FILE_INJECT_RE), L10-15 (BARE_AT_RE JSDoc), L16 (BARE_AT_RE), or any line below the insertion point.
- ❌ Don't anchor the edit on raw line numbers — anchor on the TEXT `const BARE_AT_RE =` and `const MIME_BY_EXT:` (parallel S2 edits a line ~160 below this block).
- ❌ Don't skip the Level 4 regex spot-check — it is the cheapest way to prove the literals behave per the collision table before the pipeline consumes them.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success. The task is small (two literal regex consts + JSDoc), the exact literals are given verbatim, the insertion anchors are named text lines, the convention to mirror is verified in-source, and the validation (typecheck + test + git diff + regex spot-check) is deterministic. The only residual risk is a test-harness failure from a missing global pi package (environmental, not logic) — for which `npm run typecheck` + `git diff` are authoritative fallbacks.

## Parallel-Safety Note (for the orchestrator / merger)

Sibling **P1.M1.T1.S2** edits `file-injector.ts` at L177 (`FileInjectorConfig` interface, ~160 lines below this block). The two edits are **line-disjoint** and merge cleanly. This task's edit boundary (BARE_AT_RE → MIME_BY_EXT) is unaffected by S2. Both can land in either order without conflict. Both should independently prove surgical scope via `git diff`.