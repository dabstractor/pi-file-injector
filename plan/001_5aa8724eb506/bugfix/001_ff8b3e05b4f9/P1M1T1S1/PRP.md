---
name: "P1.M1.T1.S1 — Add per-token dedup check in injectFiles"
prd_ref: "Bug-fix PRD §Overview, §Issue 1 (Duplicate injection when a non-sentinel copy co-loads), §Testing Summary"
target_file: "./file-injector.ts"
change_type: surgical-edit (one line + comment, no new files)
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
---

# PRP — P1.M1.T1.S1: Add Per-Token Dedup Check in `injectFiles`

## Goal

**Feature Goal**: Add a single, cooperation-independent per-token de-duplication check inside the `injectFiles` core function so that a `#@<path>` token whose absolute path **already appears in a `<file name="<abs>">` block in the input `text`** is skipped (not re-injected). This fixes **Issue 1** — every `#@file` being injected twice when a non-sentinel copy of the extension co-loads (the default `pi -e ./file-injector.ts` path in an environment where the extension is also installed globally).

**Deliverable**: A one-line insertion (plus a descriptive comment) inside the existing `injectFiles` function in `./file-injector.ts`, between the `abs` resolution (line 145) and the `let st;` declaration (line 147). No new files. No change to the function's signature, return type, or interface. No change to the test harness (that is a different subtask).

**Success Definition**:
- [ ] The line `if (text.includes('<file name="' + abs + '">')) continue;` exists inside the `for (const m of text.matchAll(FILE_INJECT_RE))` loop, **after** `const abs = expandTildeAndResolve(token, ctx.cwd);` and **before** `let st;`.
- [ ] The existing model-free harness still reports **28 passed, 0 failed** (`node ./file-injector.test.mjs`) — no regression.
- [ ] A one-off verification script (provided verbatim below) shows: clean-text baseline → `injected === 1`; already-injected text (with AND without the sentinel) → `injected === 0`. The non-sentinel case is the direct proof that Issue 1 is fixed.
- [ ] No other code is touched. The sentinel mechanism (`INJECT_SENTINEL`, `SENTINEL_RE`, handler guard, assembly insertion) is **left intact** — removing it is the next subtask (S2).

> **Scope boundary (read carefully):** This subtask adds ONLY the dedup check. It does **NOT** (a) remove the sentinel constants / handler guard / assembly insertion — that is **S2** ("Remove sentinel mechanism entirely", fixes Issues 2 + 6); (b) change the `FILE_INJECT_RE` regex for Unicode — that is **M1.T2.S1** (Issue 5); (c) add or modify test cases in `file-injector.test.mjs` — that is **M2.T1.S1**; (d) touch the README — that is **M3**. Issues 2 (sentinel-in-prompt false-negative) and 6 (assembly format deviation) will **remain after this task by design**; they are S2's scope.

## User Persona

**Target User**: End users of the `#@file` extension — specifically anyone who has the extension installed in **more than one location** (e.g. globally via `~/.pi/agent/extensions/file-injector.ts` AND project-locally or via `-e`), which the README itself recommends as an "always-on" setup.

**Use Case**: A user runs `pi -e ./file-injector.ts -p "Review #@secret.txt"` to test or run the extension. In an environment with a second (e.g. global) copy co-loaded, every file referenced via `#@` is currently injected **twice**, doubling token cost and confusing the model with duplicate content. After this fix, each file is injected **exactly once**.

**Pain Points Addressed**: Silent token-cost doubling and model confusion from duplicated `<file>` blocks on the primary documented usage path (`pi -e …`).

## Why

- **Issue 1 is a Major (borderline Critical) bug affecting every invocation on the primary documented path.** It was missed because the existing F1 test only re-feeds text through the *same* sentinel-stamping handler — it never simulates a non-sentinel co-loaded copy (see Bug-fix PRD §Testing Summary).
- **The current sentinel-based dedup is cooperation-based**: it only suppresses re-injection if the *other* copy also stamped `<!--#@file-injected-->`. A stale/older copy (e.g. the 182-line global version in this environment) injects without stamping, so the sentinel guard never fires and the file is re-injected.
- **Per-token dedup is cooperation-independent**: it checks the *structural evidence* (a `<file name="<abs>">` block for that exact resolved path already in the text), so it catches injection by **any** prior copy — sentinel-aware or not. This is the root-cause fix.

## What

A single insertion inside `injectFiles`. After resolving the absolute path of a matched token, and before `stat`-ing the file, check whether the input `text` already contains a `<file name="<abs>">` block for that exact absolute path. If it does, `continue` (skip this token) — it was already injected by a prior copy of the extension in the handler chain.

The check is a plain `String.prototype.includes` substring test (not a regex), so the path characters in `abs` (which may contain `.`, `[`, `]`, `(`, `)`, etc.) need no escaping.

### Success Criteria

- [ ] `injectFiles` called on clean text (no prior `<file>` blocks) injects normally (`injected === 1` for one valid token).
- [ ] `injectFiles` called on text that already contains a `<file name="<abs>">` block for the token's resolved path returns `injected === 0`, regardless of whether a sentinel is present.
- [ ] When ALL tokens are skipped, `injectFiles` returns `{ text, images: imagesIn, injected: 0 }` (the existing `count === 0` branch) → the handler returns `{ action: "continue" }` → no re-injection, no double blocks.
- [ ] The function's return type and interface are unchanged.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ — **YES.** This PRP includes the exact current line numbers, the exact edit (old/new text), the verified root-cause trace through Pi's runner/loader, the verified validation script (which has been run in both directions on this machine), and a precise scope boundary. No access to Pi internals beyond what is quoted is required.

### Documentation & References

```yaml
# MUST READ — bug-fix architecture recon (already produced for this bug-fix plan)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'Verified Pi Internals' quotes the runner chaining (runner.js:881-920) and loader path-dedup
        (loader.js:507-513) that ARE the root cause. §'Unified Fix' specifies this exact one-line check."
  critical: "The dedup MUST scan the `text` PARAMETER (event.text, which may carry a prior copy's
        appended blocks), NOT the local `blocks[]` array. The check is placed BEFORE `fs.stat(abs)`."

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/code_changes_analysis.md
  why: "§'Step 1' gives the EXACT insertion point and the exact line to insert (verbatim). Confirms
        Steps 2-4 (sentinel removal) are a SEPARATE change, NOT this task."
  critical: "This task = Step 1 ONLY. Do not perform Steps 2, 3, 4 (those are S2)."

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: The bug-fix PRD — §Issue 1 (duplicate injection), §Testing Summary (why the harness missed it).
  section: "§Issue 1, §Testing Summary"

# The file being EDITED (read the injectFiles function before editing)
- file: ./file-injector.ts
  why: "The injectFiles function (line 131) and its for-loop (line 140). The insertion site is between
        line 145 (abs resolution) and line 147 (let st;)."
  pattern: "Match the existing inline-comment style (terse, cites PRD section). Insert the dedup line
        with a comment explaining cooperation-independence and the Issue 1 fix."
  gotcha: "`text` here is the function's FIRST PARAMETER (the handler-passed event.text), which may
        already contain <file> blocks appended by a prior copy. It is NOT the local `blocks` array."

# The test harness (run it for regression; DO NOT modify it in this task)
- file: ./file-injector.test.mjs
  why: "The project's hermetic model-free gate (28 cases). Lines 1-70 show the jiti+alias import pattern
        reused by the verification script below. Run `node ./file-injector.test.mjs` → must stay 28/28."
  pattern: "imports the REAL ./file-injector.ts via jiti; named exports on `mod` (injectFiles, cleanToken, format*Block, hasValidImageMagic)"
  gotcha: "Modifying this harness (adding co-load/sentinel tests) is M2.T1.S1's scope — NOT this task."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-file-injector
.
├── PRD.md                       # (original feature PRD — not the bug-fix PRD)
├── README.md                    # extension docs (M3 updates this, NOT this task)
├── file-injector.ts             # ← THE FILE BEING EDITED (249 lines). injectFiles at line 131.
├── file-injector.test.mjs       # model-free harness (28 cases) — run, do NOT edit
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/{system_context.md, code_changes_analysis.md}  # READ for root cause + exact edit
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    └── P1M1T1S1/
        ├── research/research_notes.md   # this task's research
        └── PRP.md                        # ← THIS FILE
```

### Desired Codebase tree with files to be added/changed

```bash
.
└── file-injector.ts             # MODIFIED — +1 line (+comment) inside injectFiles for-loop. Nothing else.
# No new files. No harness changes. No README changes.
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — `text` is the injectFiles FIRST PARAMETER (event.text as passed by the handler),
// which may ALREADY contain <file> blocks appended by a prior copy of the extension in the runner's
// handler chain (runner.js:881-920 feeds each handler the previous handler's transformed text).
// It is NOT the local `blocks[]` array being accumulated in THIS call. The dedup is for CROSS-COPY
// (prior transform) injection, not within-call duplicate tokens. Do not "improve" it to scan `blocks`.

// CRITICAL — the check MUST be a String.includes substring test, NOT a RegExp. `abs` is an absolute
// resolved path that may contain regex-special chars (., [, ], (, ), +, *). includes() sidesteps all
// escaping. The check string '<file name="' + abs + '">' matches the exact prefix emitted by ALL FOUR
// block helpers (formatTextFileBlock / formatImageBlock / formatBinaryBlock / formatEmptyImageBlock).

// CRITICAL — placement is load-bearing: AFTER `const abs = expandTildeAndResolve(token, ctx.cwd)`
// (so `abs` is the same resolved path used elsewhere) and BEFORE `let st; try { st = await fs.stat(abs) }`
// (so a deduped token never does I/O). Skipping before stat also means a deduped token won't re-stat.

// SCOPE — do NOT touch the sentinel in this task. INJECT_SENTINEL, SENTINEL_RE, the handler guard
// `if (SENTINEL_RE.test(event.text)) return { action: "continue" }`, and the assembly line
// `${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}` ALL STAY. (S2 removes them.)
// After this task the assembly still emits the sentinel; Issues 2 & 6 are intentionally still open.

// NON-BREAKING — the existing F1 harness case still passes: it calls injectFiles on CLEAN text (no
// prior block) so the dedup never fires, then feeds the result through the HANDLER (whose sentinel
// guard still fires). The dedup line is not re-invoked in that case. Confirmed: harness is 28/28 now
// and remains 28/28 after this change.
```

## Implementation Blueprint

### Data models and structure

None. No data model changes. `injectFiles`'s signature and return type are unchanged:
`async (text: string, imagesIn: ImageContent[], ctx: { cwd: string }) => Promise<{ text: string; images: ImageContent[]; injected: number }>`.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT ./file-injector.ts — insert per-token dedup inside the injectFiles for-loop
  - OBJECTIVE: Skip a matched #@token if its resolved absolute path already appears in a <file> block in `text`.
  - FIND (exact, current text at lines 145-147):
        const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

        let st;
  - REPLACE WITH (insert the dedup + comment between abs and `let st;`):
        const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

        // PER-TOKEN DEDUP — if a <file> block for this exact absolute path already exists in `text`
        // (injected by a prior copy of this extension in the runner's input-handler chain), skip
        // re-injecting. Cooperation-independent: works even when the prior copy was a non-sentinel
        // version (the default `pi -e` path when a global copy co-loads). Fixes Issue 1. Uses a plain
        // substring test so path chars ([ ] . ( ) …) need no escaping; matches all 4 block prefixes.
        if (text.includes('<file name="' + abs + '">')) continue;

        let st;
  - ANCHOR uniqueness: the string `const abs = expandTildeAndResolve(token, ctx.cwd);` appears exactly
    ONCE in the file (inside injectFiles). Safe as an edit anchor.
  - DO NOT:
      * remove or alter INJECT_SENTINEL / SENTINEL_RE / the handler sentinel guard / the assembly line
        (those are S2).
      * change FILE_INJECT_RE (that is M1.T2.S1).
      * edit file-injector.test.mjs or README.md (separate subtasks).
      * scan the local `blocks` array instead of `text` — the contract is explicit: check `text`.
  - DEPENDENCIES: none (injectFiles and its helpers already exist and are unchanged).
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (the exact insertion, comment trimmed to match repo's terse inline style):
for (const m of text.matchAll(FILE_INJECT_RE)) {
    const raw = m[2];
    const token = cleanToken(raw);
    if (!token) continue;

    const abs = expandTildeAndResolve(token, ctx.cwd);

    // PER-TOKEN DEDUP — <file> block for this abs already in text (prior copy injected) → skip.
    // Cooperation-independent (catches non-sentinel copies). Substring test ⇒ no path-char escaping.
    if (text.includes('<file name="' + abs + '">')) continue;   // ← THE ONLY NEW LINE

    let st;
    try { st = await fs.stat(abs); } catch { continue; }
    // ... rest unchanged ...
}

// WHY before stat: a deduped token performs NO I/O (no stat, no readFile). Cheap and correct.
// WHY substring not regex: abs may contain '.', '[', ']', '(', ')' — all regex-special; includes() is safe.
// WHY it fixes Issue 1: the runner feeds each handler the PREVIOUS handler's transformed text
//   (dist/core/extensions/runner.js:881-920). A prior non-sentinel copy appended <file name="<abs>">
//   blocks to event.text WITHOUT a sentinel; this check sees them and skips → count stays 0 →
//   injectFiles returns {… injected: 0} → handler returns { action: "continue" } → no double-inject.
```

### Integration Points

```yaml
NO NEW INTEGRATION POINTS:
  - "Internal logic change only. No new imports, no new constants, no config, no API surface, no docs."
  - "The dedup is transparent to the user: files are simply no longer injected twice when multiple
    copies of the extension are loaded."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension validated by a **model-free Node ESM harness** (`file-injector.test.mjs`, 28 cases, run via `node`). The Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. The gates below are project-specific and have been **verified working on this machine in both directions** (they currently FAIL on the buggy code and will PASS after the fix).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. The new dedup line is present, inside injectFiles, before fs.stat(abs), and references `text` + `abs`.
grep -n "text.includes('<file name=\"' + abs + '\">')" file-injector.ts
# Expected: exactly ONE matching line, located between the `expandTildeAndResolve` line and `let st;`.

# 1b. Placement check: the dedup line must come AFTER `const abs =` and BEFORE `await fs.stat(abs)`.
awk '/const abs = expandTildeAndResolve/{a=NR} /text.includes..<file name/{d=NR} /await fs.stat.abs/{s=NR}
     END{print "abs="a" dedup="d" stat="s; exit !(a && d && s && a < d && d < s)}' file-injector.ts \
  && echo "OK: order abs < dedup < stat" || echo "FAIL: dedup not between abs and stat"

# 1c. Sentinel mechanism is INTACT (this task must NOT remove it — S2 does):
grep -cE "INJECT_SENTINEL|SENTINEL_RE" file-injector.ts
# Expected: >= 4 (constant def ×2 + handler guard + assembly). If 0 → you accidentally removed the sentinel; revert that.

# Expected: 1a prints one line; 1b prints OK; 1c prints >= 4.
```

### Level 2: Regression — Existing Harness (Component Validation)

```bash
# The project's hermetic model-free gate. MUST remain 28 passed / 0 failed.
node ./file-injector.test.mjs
# Expected: "Result: 28 passed, 0 failed." and exit code 0.
# If ANY case fails: the dedup insertion broke something. Re-read the failure, confirm you did not
# alter the sentinel/regex/format functions, and fix before proceeding.
```

### Level 3: New-Behavior Verification (the Issue 1 fix — NON-INTERACTIVE, NO MODEL)

Run this one-off script (do NOT add it to the harness — harness changes are M2.T1.S1's scope). It exercises the real `injectFiles` via the same jiti+alias import pattern the harness uses, and proves the dedup fires on prior-injected text **with and without** a sentinel. **Verified**: against the current un-fixed code the two dedup cases print `injected=1` (the bug); after the fix they print `injected=0`.

```bash
cat > /tmp/verify_dedup.mjs <<'EOF'
import { execSync } from "node:child_process";
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
const mod = await jiti.import(path.resolve("file-injector.ts"));

const TMP = await fs.mkdtemp(path.join(os.tmpdir(), "dedup-"));
await fs.writeFile(path.join(TMP, "a.ts"), "canary\n");
const ctx = { cwd: TMP };

const first = await mod.injectFiles("Review #@a.ts", [], ctx);
console.log("baseline (clean text)            : injected=" + first.injected + "   [MUST be 1]");

const second = await mod.injectFiles(first.text, [], ctx);
console.log("dedup (prior copy, WITH sentinel): injected=" + second.injected + "   [MUST be 0]");

const noSentinel = first.text.replace("<!--#@file-injected-->\n\n", "");
const third = await mod.injectFiles(noSentinel, [], ctx);
console.log("dedup (prior copy, NON-sentinel) : injected=" + third.injected + "   [MUST be 0]  <-- Issue 1 fix");

fsSync.rmSync(TMP, { recursive: true, force: true });

const ok = first.injected === 1 && second.injected === 0 && third.injected === 0;
console.log(ok ? "ALL PASS" : "FAIL");
process.exit(ok ? 0 : 1);
EOF
node /tmp/verify_dedup.mjs
# Expected: baseline injected=1; both dedup cases injected=0; prints "ALL PASS"; exit 0.
# If the non-sentinel case is 1 → the dedup line is missing/misplaced (Issue 1 NOT fixed).
rm -f /tmp/verify_dedup.mjs
```

### Level 4: Live Pi Co-Load Reproduction (Integration — OPTIONAL, needs a model)

Only if a provider/API key is configured AND a second (e.g. global `~/.pi/agent/extensions/file-injector.ts`) copy is present. This is the exact repro from the Bug-fix PRD §Issue 1. The fix is already proven by Level 3; this just confirms end-to-end.

```bash
mkdir -p /tmp/saf-e2e && printf 'The canary is MAROON-PELICAN-4297 once.\n' > /tmp/saf-e2e/secret.txt
# NOTE: this exercises the handler (sentinel guard STILL present until S2). With BOTH copies loaded:
pi --model "deepseek/deepseek-chat" --no-tools -e ./file-injector.ts -p \
  'Review #@/tmp/saf-e2e/secret.txt — how many <file> blocks and how many MAROON-PELICAN-4297? Reply: BLOCKS=<n> CANARY=<n>'
# Before fix: BLOCKS=2 CANARY=2. AFTER this fix: BLOCKS=1 CANARY=1 (dedup fires on the repo copy).
# (Issue 2 — sentinel-in-prompt — is NOT fixed by this task; that's S2.)
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: grep finds exactly one dedup line; `awk` confirms order `abs < dedup < stat`; sentinel refs still ≥ 4.
- [ ] Level 2: `node ./file-injector.test.mjs` → **28 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_dedup.mjs` → baseline `1`, both dedup cases `0`, "ALL PASS", exit 0.
- [ ] Level 4 (optional): live co-load repro shows `BLOCKS=1 CANARY=1` (was `2`/`2`).

### Feature Validation
- [ ] `injectFiles` on clean text still injects (`injected === 1` for one valid token) — no over-dedup.
- [ ] `injectFiles` on text already containing `<file name="<abs>">` for the token returns `injected === 0`, **with and without** a sentinel present.
- [ ] When all tokens are deduped, the existing `count === 0` branch returns `{ text, images: imagesIn, injected: 0 }` → handler returns `{ action: "continue" }`.
- [ ] Return type/interface unchanged.

### Code Quality Validation
- [ ] Only ONE line (+ comment) added; no other code changed.
- [ ] Sentinel mechanism, regex, format helpers, handler guards — all untouched.
- [ ] Test harness (`file-injector.test.mjs`) and README — untouched.
- [ ] Dedup checks the `text` parameter (not the local `blocks` array), using `String.includes` (not regex).

### Documentation & Deployment
- [ ] No new env vars / config / API surface (internal logic change, transparent to the user).
- [ ] Inline comment on the new line explains *why* (cooperation-independent, Issue 1 fix).

---

## Anti-Patterns to Avoid

- ❌ Don't scan the local `blocks[]` array instead of the `text` parameter — the dedup is for cross-copy (prior handler transform) injection; the contract is explicit: check `text` only.
- ❌ Don't use a `RegExp` for the check — `abs` may contain regex-special chars (`.` `[` `]` `(` `)` `*` `+`); use `String.includes`.
- ❌ Don't place the check before `abs` is resolved, or after `fs.stat` — it must be after `expandTildeAndResolve` (so `abs` matches the path used in prior `<file>` blocks) and before any I/O.
- ❌ Don't remove or alter the sentinel in this task (`INJECT_SENTINEL`, `SENTINEL_RE`, handler guard, assembly) — that's S2. Issues 2 and 6 remain open by design after this task.
- ❌ Don't edit `file-injector.test.mjs` (add co-load/sentinel tests) — that's M2.T1.S1. The Level-3 verify script is a throwaway, not a harness change.
- ❌ Don't change `FILE_INJECT_RE` for Unicode here — that's M1.T2.S1 (Issue 5).
- ❌ Don't "improve" by also deduping within a single call (e.g. `#@./a.ts` + `#@a.ts`) — out of scope; the check intentionally only sees prior-transform text.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: The change is a single, exactly-specified line at a verified line-number anchor, with a one-line old→new edit. The root cause is traced through quoted Pi runner/loader internals; the fix is cooperation-independent by construction and matches the prefix of all four block helpers. The validation gate has been **run on this machine in both directions**: it currently reports the bug (dedup cases `injected=1`) and will report success (`injected=0`) after the one-line fix; the existing 28-case harness is 28/28 and provably unaffected (the F1 case exercises the handler's sentinel guard on clean-text output, never re-invoking `injectFiles` on already-injected text). The only residual risk is mis-scoping (accidentally removing the sentinel or editing the harness) — fully caught by Level 1 (1c) and Level 2.
