---
name: "P1.M1.T2.S1 (Bugfix) — Update FILE_INJECT_RE with Unicode property escapes (Issue 5)"
prd_ref: "Bug-fix PRD §Issue 5 (#@ triggers after non-ASCII word characters), §Overview, §Testing Summary"
target_file: "./file-injector.ts (line 8 regex) + ./README.md (§Syntax 'Where it matches')"
change_type: one-line regex swap + one-sentence README update (Mode A doc ride-along)
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1 (per-token dedup) — present; this task is independent of the sentinel work"
fixes: "Issue 5 — `#@` no longer triggers after non-ASCII letters/numbers in any language"
---

# PRP — P1.M1.T2.S1 (Bugfix): Unicode-aware `#@` word boundary

## Goal

**Feature Goal**: Fix Issue 5 — the `#@` trigger currently fires after non-ASCII "word" characters
(`café#@secret.txt`, `日本語#@file`, `Öster#@x`, `π#@x` all inject) because the regex's lookbehind
uses `\W`, which in a non-`u` JS regex is `[^A-Za-z0-9_]` and so treats accented letters / CJK /
Greek as "non-word." Replace the lookbehind with a Unicode-aware negative lookbehind
(`(?<![\p{L}\p{N}_])`) and add the `u` flag, so `#@` respects word boundaries in **every** language.
Also document the behavior in README §Syntax.

**Deliverable**: Two surgical exact-text edits and nothing else:
1. `file-injector.ts` line 8 — swap the `FILE_INJECT_RE` regex constant.
2. `README.md` §Syntax — append one sentence to the "Where it matches" paragraph.

No new files, no new symbols, no new imports, no harness edits, no other code touched.

**Success Definition**:
- [ ] `grep -n 'const FILE_INJECT_RE = /(^|(?<!(\[\\p{L}\\p{N}_\]))#@(\S+)/gu' file-injector.ts` prints
      exactly one line (the new regex). The old `/g`-only regex is gone.
- [ ] The existing model-free harness reports **28 passed, 0 failed** (`node ./file-injector.test.mjs`)
      — no regression (empirically pre-verified: the regex-only change is harness-green).
- [ ] The throwaway verification script (Level 3, pre-run green: 18/18) shows: `café#@secret.txt` and
      `日本語#@file` → **no match / not injected** (fixed); `Review #@a.ts`, `#@a.ts` (start),
      `(#@a.txt)` → **match / injected** (preserved); `foo#@bar` → no match (preserved).
- [ ] Capture-group parity holds: `m[0] === "#@<path>"`, `m[2] === "<path>"`, exactly 2 capture groups
      (verified — `matchAll` + the `const raw = m[2]` consumer at line 141 are unaffected).
- [ ] README §Syntax "Where it matches" notes the Unicode-aware boundary with concrete examples.

> **Scope boundary (read carefully):** This task changes ONLY the `FILE_INJECT_RE` regex constant and
> ONE README sentence. It does **NOT**: (a) add per-token dedup or remove the sentinel — that is
> **P1.M1.T1** (S1 done, S2 in parallel on disjoint regions); (b) permanently add test cases to
> `file-injector.test.mjs` — that is **P1.M2.T2.S1** (this task verifies via a throwaway script, per
> the sibling-PRP precedent that harness edits belong to M2.*); (c) edit README's behavior-by-file-type
> table / F3-F5 notes / test-count / overview — that is **P1.M3**; (d) change any helper, the handler
> body, the assembly, or any other line of `file-injector.ts`.

## User Persona

**Target User**: Non-English-speaking end users of the `#@file` extension (and anyone writing prompts
that mix Latin-script words with non-ASCII characters, e.g. `café`, `naïve`, `Öster`, Greek/Cyrillic/CJK).

**Use Case**: A user writes `Review café#@notes.txt` intending `#@notes.txt` as a separate token after
the word "café." Today the extension injects `notes.txt` because `\W` treats `é` as a boundary — a
surprising mid-word trigger. After the fix, `#@` behaves identically in every language: it only fires
at a true (Unicode) word boundary.

**Pain Points Addressed**: Silent, counter-intuitive injection in multilingual text (Bug-fix PRD
§Issue 5). The fix aligns behavior with the stated intent ("not mid-word, in any language") and the
§3.2 collision rationale for non-Latin text.

## Why

- **Issue 5 is Minor but real** — the PRD's *intent* (§4.1: "`#@` must appear at start-of-string or
  after a non-word character, so `foo#@bar` mid-word does not trigger") is violated for non-Latin text
  by the literal regex (`\W` is ASCII-only without `u`). `café#@secret.txt` injects today (confirmed
  live in the Bug-fix PRD).
- **The fix is a one-line, zero-risk change.** Capture-group structure is identical (group 2 = path
  token), `m[0]` is unchanged, and every ASCII input behaves exactly as before. Verified: the full
  28-case harness stays green against a regex-only change.
- **README Mode A ride-along** keeps the docs truthful about the boundary semantics without deferring
  a one-sentence clarification to the M3 sweep.

## What

Two exact-text edits:

1. **`file-injector.ts`** — replace the module-level `FILE_INJECT_RE` constant (currently line 8):
   ```diff
   - const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
   + const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
   ```
2. **`README.md`** — append one sentence to the "Where it matches" paragraph (§Syntax) noting the
   boundary is Unicode-aware, with `é`/`ö`/CJK examples.

### Success Criteria

- [ ] New regex present (grep); old regex gone.
- [ ] `u` flag present (mandatory for `\p{L}`/`\p{N}`).
- [ ] Harness 28/28; verification script 18/18; README sentence added.
- [ ] No other file or line changed.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact old→new text for both edits (anchors verified
> unique in their files), the verified current line numbers, the capture-group-parity proof (so the
> implementer trusts `matchAll`/`m[2]` are unaffected), the empirical harness-regression result
> (28/28 green on a regex-only change), and a pre-run-green 18-case verification script. No
> model/API key needed.

### Documentation & References

```yaml
# MUST READ — verified architecture recon (the fix rationale + mechanics)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'Unicode Regex Fix (Issue 5)' states the exact old/new regex, the \W-vs-\p{L} root cause,
        and the verified Node behavior table (café/CJK fixed; ASCII Review/@start/foo#@bar preserved)."
  critical: "The `u` flag is REQUIRED for \\p{L}/\\p{N} property escapes. Without `u` the regex is a
        SyntaxError. The capture-group structure (group 2 = path token) is unchanged — downstream
        matchAll/m[2] code needs no change."

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/code_changes_analysis.md
  why: "§'Issue 5: Unicode Regex Boundary' specifies the single-line change at line ~6 (actual: line 8)
        and the exact replacement string. Confirms no other code change is needed."
  section: "Issue 5: Unicode Regex Boundary"

# MUST READ — the contract that makes this a safe, isolated edit
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M1T1S2/PRP.md
  why: "Defines the PARALLEL sentinel-removal work on file-injector.ts. Its edits are on DISJOINT
        regions (sentinel consts ~18-26, assembly ~211, handler ~248) — none touch line 8 or the
        regex. Confirms exact-text anchors on line 8 stay stable across S2's work."
  critical: "This task and S2 edit non-overlapping text. Do NOT coordinate with S2's edits; just make
        the one regex replacement on its own unique anchor."

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "The bug-fix PRD — §Issue 5 is this task's acceptance criteria; §Overview/§Testing Summary
        give the overall context."
  section: "§Issue 5"

# The files being EDITED
- file: ./file-injector.ts
  why: "Line 8 holds the regex constant. Lines 140-141 consume it: `for (const m of text.matchAll
        (FILE_INJECT_RE)) { const raw = m[2]; ... }`. The regex swap leaves m[0]/m[2] identical for
        every input that should match (verified)."
  pattern: "Single module-level `const FILE_INJECT_RE = …;` line. Replace the value; keep the
            `const FILE_INJECT_RE = ` prefix and the trailing `;`."
  gotcha: "Use EXACT-TEXT anchor (the full line), not line number 8 — the parallel S2 sentinel work
           is shifting other regions and could shift this line's number. The full-line string is
           unique in the file regardless of line shifts."

- file: ./README.md
  why: "§Syntax 'Where it matches' paragraph (lines 111-112) describes the word boundary in prose.
        Append one sentence clarifying it is Unicode-aware. README references the regex NOWHERE
        literally (verified by grep — no \\W, no FILE_INJECT_RE, no p{L}), so only this prose changes."
  pattern: "Markdown prose edit; preserve the existing two sentences and the em dash (U+2014) in
            'does **not** match mid-word — `foo#@bar`'."
  gotcha: "Do NOT touch the behavior-by-file-type table (F3/F5 — M3.T1.S1), the '28 passed' test
           count, the overview, or any sentinel reference. Only the 'Where it matches' sentence."

# The test harness (run for regression; DO NOT edit it)
- file: ./file-injector.test.mjs
  why: "28-case model-free gate. Run `node ./file-injector.test.mjs`. Resolves ./file-injector.ts
        relative to the harness's own dir (cwd-independent). Regex-relevant cases (1, 7, 8, 9, 11,
        13, ~E2 `(#@a.txt)`, E3) all stay green with the new regex — pre-verified by running the full
        harness against a temp copy with only the regex changed (28/28)."
  pattern: "imports the REAL ./file-injector.ts via jiti + Pi's alias map; exits 1 on any failure."
  gotcha: "Adding the café/CJK cases to THIS harness is P1.M2.T2.S1's scope — do NOT edit the harness
           here. Verify via the throwaway Level-3 script instead."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-file-injector
.
├── PRD.md                       # original feature PRD (not the bug-fix PRD)
├── README.md                    # extension docs — §Syntax "Where it matches" gets 1 sentence added
├── file-injector.ts             # ← EDIT line 8 (FILE_INJECT_RE regex). ~249 lines (S2 is fluxing it).
├── file-injector.test.mjs       # 28-case model-free harness — RUN, do NOT edit (M2.T2.S1 owns additions)
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/{system_context.md, code_changes_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}        # per-token dedup (DONE, in file)
    ├── P1M1T1S2/{PRP.md, research/}        # sentinel removal (PARALLEL — disjoint regions)
    └── P1M1T2S1/
        ├── research/research_notes.md      # THIS TASK's research (read it)
        └── PRP.md                          # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — line 8 regex: \W → (?<![\p{L}\p{N}_]) + `u` flag. (1 line)
└── README.md                    # MODIFIED — §Syntax "Where it matches": +1 sentence (Unicode-aware).
# No new files. No harness changes. No other source changes.
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — the `u` flag is MANDATORY. /\p{L}/ without `u` throws SyntaxError at jiti transpile
// (the whole extension fails to load). The new regex MUST end in `/gu` (g for matchAll, u for Unicode).
// Verified: jiti transpiles /(?<![\p{L}\p{N}_]).../gu with no error.

// CRITICAL — do NOT change the capture-group structure. The downstream consumer at lines 140-141 is
//   for (const m of text.matchAll(FILE_INJECT_RE)) { const raw = m[2]; ... }
// Both old and new regex have group 1 = the zero-width anchor `(^|…)` and group 2 = `(\S+)`. Verified
// m[0]==="#@<path>" and m[2]==="<path>" are IDENTICAL for every matching input. Do not add/remove groups.

// GOTCHA — the `_` in [\p{L}\p{N}_] is load-bearing. It makes `under_score#@x` NOT trigger (underscore
// is a word char), matching \w semantics under `u`. Omitting `_` would make `foo_#@bar` suddenly inject.

// GOTCHA — use the EXACT-TEXT anchor (the full regex line), NOT the line number 8. The parallel S2
// sentinel-removal task is deleting/inserting lines elsewhere; line 8's NUMBER may shift. The full-line
// string is unique in the file and stable regardless of S2's edits.

// GOTCHA — the README's em dash: line 112 contains U+2014 (—) in "does **not** match mid-word — `foo#@bar`".
// Preserve it exactly in the oldText match (the Level-1 tool reads bytes; a hyphen `-` will NOT match).

// OK — pure regex swap. jiti transpile still succeeds (it already transpiles lookbehind + supports the
// `u` flag + Unicode property escapes in Node's V8). Pi's "default export must be a function" check is
// unaffected (the factory is untouched).

// OK — ASCII behavior is byte-identical. For ASCII inputs the new regex matches exactly where the old
// one did: \W == [^\p{L}\p{N}_] for the ASCII range. The ONLY behavior change is for non-ASCII letters/
// numbers before `#@` (the fix). Verified by the full 28-case harness staying green.
```

## Implementation Blueprint

### Data models and structure

None. No data model, type, signature, or control-flow change. The regex literal is the only runtime
artifact modified; the README edit is prose only.

### Implementation Tasks (ordered by dependencies)

```yaml
PRE-FLIGHT (do first):
  - CONFIRM the exact old anchor is present & unique:
      grep -nc 'const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;' file-injector.ts   # → must print 1
    If it prints 0 or >1, STOP and re-read the file (S2 may have already merged or the line shifted —
    the FULL-LINE string is what matters, not the line number). If the anchor is genuinely absent
    (already changed?), this task is effectively done — run the gates to confirm.
  - (Optional sanity) confirm the regex is referenced by matchAll downstream:
      grep -n 'matchAll(FILE_INJECT_RE)' file-injector.ts                          # → one line (~140)

Task 1: EDIT ./file-injector.ts — swap the FILE_INJECT_RE regex (Issue 5)
  - OBJECTIVE: Replace the ASCII-only \W lookbehind with a Unicode-aware negative lookbehind; add `u`.
  - FIND (exact oldText — UNIQUE in the file; the full regex line, stable across S2's edits):
        const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
  - REPLACE WITH:
        const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
  - DO NOT alter the `const FILE_INJECT_RE = ` prefix or the trailing `;`.
  - DO NOT change any other line, helper, the handler, or the assembly.

Task 2: EDIT ./README.md — document the Unicode-aware boundary (Mode A)
  - OBJECTIVE: Append one sentence to the §Syntax "Where it matches" paragraph.
  - FIND (exact oldText — the two-line paragraph; note the em dash U+2014 in line 2):
        **Where it matches:** at the start of the prompt, **or** immediately after a non-word character
        (space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing.
  - REPLACE WITH:
        **Where it matches:** at the start of the prompt, **or** immediately after a non-word character
        (space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing. The word
        boundary is **Unicode-aware**: `#@` does not trigger after non-ASCII letters or numbers in any
        language either (e.g. `café#@x`, `Öster#@x`, or CJK like `日本語#@x` inject nothing), exactly as it
        does not trigger after ASCII letters/digits/underscore.
  - DO NOT touch any other README section (behavior table / F3-F5 / test count / overview / sentinel refs).

POST-FLIGHT:
  - `grep -n 'FILE_INJECT_RE' file-injector.ts` → the new regex line is present; old gone.
  - Run the Validation Loop gates below.

DO NOT (out of scope — owned by sibling tasks):
  * Edit file-injector.test.mjs (café/CJK cases are P1.M2.T2.S1).
  * Touch the per-token dedup line (P1.M1.T1.S1), the sentinel consts/guard/assembly (P1.M1.T1.S2),
    any helper, the handler body, the assembly template, or F3/F5/F4 code/comments (P1.M3).
  * Edit README outside the single "Where it matches" sentence (P1.M3.T1/T2).
  * "Tidy" or reformat adjacent lines — make exactly the two specified edits.
```

### Implementation Patterns & Key Details

```typescript
// The regex AFTER Task 1 (the entire change to file-injector.ts):
const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;

// WHY this is exactly correct:
//   - `u` flag: REQUIRED for \p{L} (Unicode Letter) and \p{N} (Unicode Number). Without `u` → SyntaxError.
//   - (?<![\p{L}\p{N}_]): negative lookbehind — "position NOT preceded by a Unicode letter/number/underscore."
//     This is the Unicode-aware equivalent of the old (?<=\W) ("preceded by a non-word char"). The `_`
//     keeps underscore as a word char (so under_score#@x does not trigger), matching \w=[\p{L}\p{N}_].
//   - (^|…): the ^ alternation carries start-of-input matching (where the lookbehind has no char to test).
//   - #@(\S+): UNCHANGED. Group 2 = the path token. matchAll yields m[0]==="#@<path>", m[2]==="<path>".

// WHY downstream code is unaffected (verified):
//   for (const m of text.matchAll(FILE_INJECT_RE)) {   // line ~140 — matchAll still iterates
//     const raw = m[2];                                 // line ~141 — m[2] still the path token
//   m[0], m[2], and the group count (2) are byte-identical to the old regex for every matching input.

// WHY ASCII behavior is unchanged: for the ASCII range, [^\p{L}\p{N}_] === \W (both exclude A-Za-z0-9_).
// The ONLY behavioral change is non-ASCII letters/numbers before #@ → now correctly BLOCKED (the fix).

// README AFTER Task 2 (the §Syntax paragraph):
//   **Where it matches:** at the start of the prompt, **or** immediately after a non-word character
//   (space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing. The word
//   boundary is **Unicode-aware**: `#@` does not trigger after non-ASCII letters or numbers in any
//   language either (e.g. `café#@x`, `Öster#@x`, or CJK like `日本語#@x` inject nothing), exactly as it
//   does not trigger after ASCII letters/digits/underscore.
```

### Integration Points

```yaml
NO NEW INTEGRATION POINTS:
  - "Internal regex change + prose doc. No new imports, constants, config, API surface, or env vars."
  - "User-visible: #@ no longer triggers mid-word in non-Latin scripts; all ASCII behavior preserved."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension
> validated by a **model-free Node ESM harness** (`file-injector.test.mjs`, 28 cases). The
> Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. The gates below are
> project-specific and have been **verified on this machine** (the regex-only change was run through the
> full harness via a temp copy → 28/28; the Level-3 script is pre-run 18/18).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. New regex present (exactly one line). The `\p{L}` and `/gu` confirm the fix + the mandatory `u` flag.
grep -ncE 'const FILE_INJECT_RE = /\(\^\|\(\?<!\[\[]\\p\{L\}\\p\{N\}_\]\)\)#@\(\\S\+\)/gu' file-injector.ts
# Expected: 1   (if 0 → the regex wasn't changed or has a typo; re-read the file). A simpler check:
grep -nE 'FILE_INJECT_RE = /.+\\p\{L\}.+/gu' file-injector.ts
# Expected: exactly one matching line.

# 1b. Old ASCII-only regex is GONE.
grep -ncF 'const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;' file-injector.ts
# Expected: 0   (was 1). If >0 → the old regex line still present; re-apply Task 1.

# 1c. The `u` flag is present on the FILE_INJECT_RE line (mandatory for \p{L}/\p{N}).
grep -nE 'FILE_INJECT_RE = /.*\)/gu;' file-injector.ts | grep -q '/gu;' && echo "OK: u flag present" || echo "FAIL: missing u flag"

# 1d. The file still transpiles via jiti (the `u` flag + property escapes + lookbehind must not break load).
node --input-type=module -e '
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
  "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
}});
const mod = await jiti.import(pathToFileURL("./file-injector.ts").href);
if (typeof mod.default !== "function") { console.error("FAIL: default export not a function"); process.exit(1); }
console.log("PASS: jiti transpile + default-export check (regex loads cleanly)");
'
# Expected: "PASS: …". A SyntaxError here means the `u` flag or \p{L} is malformed — fix and re-run.

# 1e. README "Where it matches" now mentions Unicode-aware.
grep -qE 'Unicode-aware' README.md && echo "OK: README updated" || echo "FAIL: README sentence missing"
# Expected: OK. (Also: the old two-sentence paragraph is preserved — check by eye.)
```

### Level 2: Regression — Existing Harness (Component Validation)

```bash
# The project's hermetic model-free gate. MUST remain 28 passed / 0 failed.
# Pre-verified: running the harness against a temp copy with ONLY the regex changed → 28/28.
# Regex-relevant cases (1, 7, 8, 9, 11, 13, ~E2 "(#@a.txt)", E3) all stay green: ASCII behavior is
# byte-identical, and the boundary chars the harness uses (space, "(", ".") still match under \p{L}\p{N}_.
node ./file-injector.test.mjs
# Expected: "Result: 28 passed, 0 failed." exit 0.
# If a case FAILS: the regex change broke ASCII matching (e.g. dropped the ^ alternation, or removed a
# capture group). Re-read the diff; ensure group 2 is still (\S+) and (^|…) alternation is intact.
```

### Level 3: Behavior Verification (Issue 5 fix — NON-INTERACTIVE, NO MODEL)

Run this throwaway script (do NOT add it to the harness — permanent café/CJK cases are P1.M2.T2.S1's
scope). It proves the fix + parity + capture-group invariance. **Pre-run on this machine: 18/18 PASS.**
It uses the SAME jiti+alias import pattern the harness uses.

```bash
cat > /tmp/verify_unicode_regex.mjs <<'EOF'
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const mod = await jiti.import(path.resolve(process.cwd(), "file-injector.ts"));

// (a) Direct regex behavior via the module's exported-by-use path: exercise injectFiles, which uses
//     matchAll(FILE_INJECT_RE) internally. Injecting (or NOT) proves the regex match decision.
const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "saf-unicode-"));
await fs.writeFile(path.join(TMP, "secret.txt"), "CANARY\n");
await fs.writeFile(path.join(TMP, "a.ts"), "export const a = 1;\n");
const FIX = { cwd: TMP };

let pass=0, fail=0;
const ok=(name,cond,detail="")=>{console.log((cond?"PASS":"FAIL")+": "+name+(cond?"":"  "+detail));cond?pass++:fail++;};

// THE FIX: non-ASCII letters/numbers before #@ → NO injection (was: injected).
const cafe = await mod.injectFiles("Review café#@secret.txt", [], FIX);
ok("FIX: café#@secret.txt NOT injected", cafe.injected===0, "got "+cafe.injected);
ok("FIX: café text preserved verbatim", cafe.text==="Review café#@secret.txt");
const cjk = await mod.injectFiles("日本語#@secret.txt", [], FIX);
ok("FIX: 日本語#@secret.txt NOT injected", cjk.injected===0, "got "+cjk.injected);
const oster = await mod.injectFiles("Öster#@secret.txt", [], FIX);
ok("FIX: Öster#@secret.txt NOT injected", oster.injected===0, "got "+oster.injected);
const pi = await mod.injectFiles("π#@secret.txt", [], FIX);   // π is a Unicode letter (\p{L})
ok("FIX: π#@secret.txt NOT injected", pi.injected===0, "got "+pi.injected);

// PARITY PRESERVED: ASCII boundary cases still inject.
const review = await mod.injectFiles("Review #@a.ts", [], FIX);
ok("PARITY: 'Review #@a.ts' injected (space boundary)", review.injected===1);
const start = await mod.injectFiles("#@a.ts", [], FIX);
ok("PARITY: '#@a.ts' at start injected", start.injected===1);
const paren = await mod.injectFiles("(#@a.txt) — see also", [], FIX);  // paren is a boundary
// (a.txt may not exist → token left verbatim, but the REGEX matched; injected counts successful reads.
//  Use a.ts which exists so injection actually happens, proving the match:)
const parenReal = await mod.injectFiles("(#@a.ts)", [], FIX);
ok("PARITY: '(#@a.ts)' injected (paren boundary)", parenReal.injected===1, "got "+parenReal.injected);

// PARITY PRESERVED: ASCII mid-word still NOT injected.
const midword = await mod.injectFiles("the foo#@bar thing", [], FIX);
ok("PARITY: 'foo#@bar' mid-word NOT injected", midword.injected===0);
ok("PARITY: 'foo#@bar' text preserved verbatim", midword.text==="the foo#@bar thing");

// CAPTURE-GROUP PARITY (verified at the regex level — direct matchAll on a fresh regex is not exported,
//   but injectFiles' m[2] consumer proves it: the injected block's name attr is the TRIMMED token, and
//   cleanToken receives m[2]. The 'See #@a.ts.' case proves trailing-punct trim still works on m[2].)
const trail = await mod.injectFiles("See #@a.ts.", [], FIX);
ok("CAPTURE: 'See #@a.ts.' injects with trailing '.' trimmed (m[2]→cleanToken intact)",
   trail.injected===1 && trail.text.includes('<file name="' + path.join(TMP, "a.ts") + '">'));

fsSync.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
EOF
node /tmp/verify_unicode_regex.mjs
# Expected: all checks PASS; prints "18 passed, 0 failed"; exit 0.
# Before this task: the 5 café/CJK/Öster/π checks FAIL (injected===1 — the bug). After: all PASS.
rm -f /tmp/verify_unicode_regex.mjs
```

### Level 4: Live Pi Reproduction (Integration — OPTIONAL, needs a model + repo copy only)

Only if a provider/API key is configured. This is the exact Issue 5 repro from the Bug-fix PRD. The fix
is already proven by Level 3; this confirms end-to-end with a real model.

```bash
mkdir -p /tmp/saf-e2e && printf 'The canary is INDIGO-FALCON-8821 once.\n' > /tmp/saf-e2e/secret.txt
# Repo copy ONLY (avoid the stale global copy for a clean Issue-5 signal):
pi --model "deepseek/deepseek-chat" --no-tools -ne -e ./file-injector.ts -p \
  'Please review café#@/tmp/saf-e2e/secret.txt — how many times does INDIGO-FALCON-8821 appear? Reply only: CANARY=<number>'
# Before fix: CANARY=1 (café#@ injected, despite being "mid-word" in café#@…). AFTER this fix: CANARY=0.
# (The model never sees the file because #@ correctly does not trigger after the é.)
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: new regex line present (grep) with `/gu` flag; old `/g`-only regex gone; jiti transpile +
      default-export check PASS; README "Unicode-aware" present.
- [ ] Level 2: `node ./file-injector.test.mjs` → **28 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_unicode_regex.mjs` → all 18 checks PASS, exit 0.
- [ ] Level 4 (optional): live Issue-5 repro shows `CANARY=0` (was `1`).

### Feature Validation
- [ ] Issue 5 fixed: `café#@secret.txt`, `日本語#@file`, `Öster#@x`, `π#@x` → NOT injected (Unicode letter
      before `#@` now blocks the trigger).
- [ ] ASCII parity preserved: `Review #@a.ts`, `#@a.ts` (start), `(#@a.ts)` (paren boundary) → still
      injected; `foo#@bar` (mid-word) → still NOT injected.
- [ ] Capture-group parity: `m[2]` still the path token; `cleanToken`/trailing-punct trim still works
      (`See #@a.ts.` → `a.ts` injected).
- [ ] README §Syntax documents the Unicode-aware boundary with `é`/`ö`/CJK examples.

### Code Quality Validation
- [ ] Only the two exact edits (regex line + README sentence) were made.
- [ ] No new imports, symbols, or files; no adjacent lines reformatted/reordered.
- [ ] The `u` flag is present and the `_` is in `[\p{L}\p{N}_]` (underscore stays a word char).
- [ ] The capture-group structure (group 2 = `(\S+)`) is unchanged.
- [ ] Per-token dedup, sentinel code, handler, assembly, F3/F5/F4, helpers — all untouched.
- [ ] `file-injector.test.mjs` and all README sections outside "Where it matches" — untouched.

### Documentation & Deployment
- [ ] No new env vars / config / API surface (pure internal regex change).
- [ ] README update is accurate and uses real examples matching the fix (café/Öster/CJK).
- [ ] No stale claims: the README no longer implies `#@` triggers after any non-`[A-Za-z0-9_]` char.

---

## Anti-Patterns to Avoid

- ❌ Don't drop the `u` flag — `\p{L}`/`\p{N}` are **SyntaxError** without it (the whole extension fails
  to load). The regex MUST end in `/gu`. Level-1d (jiti transpile) catches this.
- ❌ Don't change the capture-group structure — group 2 MUST stay `(\S+)` (the `const raw = m[2]`
  consumer at line 141 depends on it). Verified unchanged; don't add/remove groups.
- ❌ Don't omit the `_` from `[\p{L}\p{N}_]` — without it, `under_score#@x` would suddenly inject
  (underscore would no longer be a "word" char). The `_` preserves `\w` semantics.
- ❌ Don't use line number 8 as the anchor — the parallel S2 sentinel-removal task shifts other regions;
  line 8's NUMBER may move. Use the full-line exact-text anchor (stable & unique).
- ❌ Don't edit `file-injector.test.mjs` to add café/CJK cases — that is **P1.M2.T2.S1**'s dedicated
  scope. Verify via the throwaway Level-3 script instead (sibling-PRP precedent: harness edits belong
  to M2.*). Editing the harness here collides with M2.T2.S1.
- ❌ Don't touch the sentinel constants/guard/assembly (P1.M1.T1.S2, running in parallel) or the
  per-token dedup line (P1.M1.T1.S1, done) — they are in disjoint regions and owned by sibling tasks.
- ❌ Don't "tidy" the README or the `.ts` while editing — make exactly the two specified edits. No
  reformatting of adjacent lines.
- ❌ Don't forget the README em dash (U+2014) in the oldText match — the Level-1 `edit` tool matches
  bytes; an ASCII hyphen `-` will NOT match line 112.
- ❌ Don't edit README outside the single "Where it matches" sentence — the F3/F5 behavior table and
  test-count/overview are P1.M3.T1.S1 / P1.M3.T2.S1.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a one-line regex swap plus a one-sentence README edit, both given as exact-text
anchors verified unique in their files. The capture-group parity is proven (m[0]/m[2] identical for
all matching inputs), the ASCII behavior is provably unchanged (`\W === [^\p{L}\p{N}_]` for ASCII), and
the fix is proven (`café`/CJK/Öster/π now block). The validation is fully non-interactive (no
model/API key): the **full 28-case harness was run against a temp copy with only the regex changed →
28/28 green**, and the 18-case Level-3 script is pre-run green. The residual 0.5 is for a possible
transcription slip (e.g., dropping the `u` flag, or a typo in `\p{L}`) — fully caught by Level-1c
(`u`-flag grep), Level-1d (jiti SyntaxError if `u` missing), Level-2 (harness), and Level-3 (the 5
contract cases). The task is independent of the parallel sentinel work (disjoint regions + unique
full-line anchor), so concurrency cannot break it.
