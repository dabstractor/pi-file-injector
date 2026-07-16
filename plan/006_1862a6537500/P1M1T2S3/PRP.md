---
name: "P1.M1.T2.S3 (plan/006) — Confirm readConfig/SETTINGS_KEY/injectMarkdown JSDoc coherence with §4.5/§4.6"
prd_ref: "PRD §4.5 rule 2/5 (depth-uniform dirname resolution), §4.6 (config sources/precedence/trust gate + bareAt threading)"
target_file: "./file-injector.ts"   # READ-ONLY verification — edit ONLY if a drift is found (none expected; none found at HEAD 1ad7b19)
target_language: TypeScript (JSDoc/comment audit; no behavior change, no tests, no build)
depends_on: "P1.M1.T2.S1 (LANDED at HEAD 1ad7b19: PRD.md:1189 Done-definition 'all 24'→'all 32'; did NOT touch readConfig/SETTINGS_KEY/injectMarkdown — coherence verdict unaffected)"
consumed_by: "NONE downstream. This is a read-only JSDoc-coherence confirmation; it produces a verdict (coherent: no edit) + evidence, not a file change."
---

# PRP — P1.M1.T2.S3: Confirm `readConfig` / `SETTINGS_KEY` / `injectMarkdown` JSDoc coherence with §4.5/§4.6

> **Scope flag:** This is a **read-only VERIFICATION** subtask. Its deliverable is a CONFIRMATION that three
> JSDoc regions in `file-injector.ts` — `readConfig` (L174–183), the `SETTINGS_KEY` const (L167–171), and
> `injectMarkdown` (L790–837) — are coherent with PRD §4.5/§4.6 AND with the shipped code. The expected
> outcome — confirmed by first-hand verification against HEAD `1ad7b19` (and independently by the prior
> research `plan/006_1862a6537500/architecture/research-config-and-resolution.md`) — is **COHERENT: no edit
> needed** (item §3). If, contrary to expectation, a drift were found, a minimal JSDoc edit to match shipped
> behavior would ride here (item §4); the live tree shows NO drift. No behavior change, no tests, no build.

> **Disjoint from S2:** the parallel sibling P1.M1.T2.S2 audits **README.md**'s config section. This task
> audits **file-injector.ts** JSDoc. Different files — no overlap, no conflict. Both are read-only
> doc-coherence confirmations under the v006 doc-audit milestone.

---

## Goal

**Feature Goal:** Re-confirm — against the current tree (HEAD `1ad7b19`) — that the JSDoc on three symbols
in `file-injector.ts` matches the authoritative PRD §4.5/§4.6 spec AND the shipped code behavior, on the
three points the item pins:
  - **(a)** `readConfig` JSDoc (L174–183) lists all **4 sources** in **precedence order**, with the **trust
    gate** ("trusted only" for the two project sources) and the **SETTINGS_KEY form** ("object" for the
    settings.json sources, "whole file" for the dedicated files).
  - **(b)** `SETTINGS_KEY` const comment (L167–171) explains it is the **camelCase settings.json key**
    (distinct from the package `name`), read directly from disk.
  - **(c)** `injectMarkdown` JSDoc (L790–837) notes **dirname(abs) resolution** (depth-uniform, no cwd
    fallback — §4.5 rule 2/5) and **bareAt threading** (`state.bareAt` → scanTokens regardless of depth — §4.6).

**Deliverable:** A **VERDICT — "coherent, no edit needed"** (expected) — backed by a three-way agreement
check (JSDoc ↔ shipped code ↔ PRD §4.5/§4.6) per region, and a `git status --short` proof that **NO file was
modified**. No `file-injector.ts` edit is produced unless a drift is found (none is). The DOCS outcome is
"none — no user-facing/config/API surface change" (item §5).

**Success Definition:** The implementing agent (a) reads each of the three JSDoc regions at its exact line
range, (b) reads the corresponding shipped code body, (c) reads PRD §4.5/§4.6, (d) confirms every property
above holds (JSDoc matches code AND PRD), (e) leaves the working tree clean (`git status --short` empty). If
all properties hold → mark complete, no edit. If any property drifted → make the MINIMAL JSDoc edit to match
shipped behavior (never edit code to match a stale comment), then re-verify the gate.

## User Persona

**Target User:** Maintainer / reviewer / future implementer who relies on the in-source JSDoc to understand
config loading (§4.6) and markdown import resolution (§4.5), and needs it to agree with the authoritative
PRD and the actual shipped code.

**Use Case:** A reader opens `file-injector.ts` to understand how `markdownBareAtImports` is read or how a
markdown import resolves its path; the JSDoc must not mislead them relative to what the code does or what
the PRD specifies.

**Pain Points Addressed:** In-source doc drift — JSDoc that says one thing while the code (or the PRD) does
another. This subtask is the gate that catches (or, as expected, rules out) such drift in the v006 delta.

## Why

- **Doc coherence gate (the v006 delta's purpose).** Plan 006 is a "Verification & Documentation Coherence
  Gate" — its M1.T2 milestone audits the docs for staleness. T2.S1 fixed the PRD Done-definition count;
  T2.S2 confirms the README config section; **T2.S3 (this) confirms the in-source JSDoc**. Together they
  close the doc-audit findings.
- **Re-confirmation after intervening commits.** A prior scout (`research-config-and-resolution.md`)
  confirmed coherence at an earlier HEAD; this subtask re-confirms the verdict still holds at HEAD `1ad7b19`
  after two intervening commits (`e1c4716`, `1ad7b19`) — neither of which touched `readConfig`/`SETTINGS_KEY`/
  `injectMarkdown` (the commit messages are PRD/README-only).
- **JSDoc is the in-source source of truth.** Unlike the README (user-facing) or the PRD (spec), the JSDoc
  is what a developer reads while editing the code. Drift here is the most likely to cause a future
  implementer to "fix" correct code to match a wrong comment — so confirming it is high-value even though
  no edit is expected.

## What

This is a **read-only audit**. The user-visible behavior of the extension is UNCHANGED (no code change;
the expected outcome is not even a comment change). The "implementation" is: read three JSDoc regions, read
their code bodies, read PRD §4.5/§4.6, fill in the agreement table, and either stop (coherent) or apply a
minimal comment fix (drift). The 182-test gate (122 + 38 + 22) is unaffected either way.

### Success Criteria

- [ ] `readConfig` JSDoc (L174–183) verified: 4 sources in precedence order + trust gate on sources 3–4 +
      SETTINGS_KEY form (obj vs whole-file) — matches code (L184–216) AND §4.6 table.
- [ ] `SETTINGS_KEY` const comment (L167–171) verified: camelCase settings.json key, distinct from package
      `name`, read directly from disk — matches §4.6 prose.
- [ ] `injectMarkdown` JSDoc (L790–837) verified: dirname(abs) resolution (depth-uniform, no cwd fallback) +
      bareAt threading (`state.bareAt`) — matches code (L838–849) AND §4.5 rule 2/5 + §4.6 "Depth-uniform".
- [ ] If coherent (expected): `git status --short` EMPTY — no file modified.
- [ ] If drift found (not expected): the MINIMAL JSDoc-only edit applied; all three test suites still green
      (182 passed) + `npx tsc --noEmit --strict` 0 errors (a JSDoc edit must not introduce a syntax error).
- [ ] DOCS line recorded: "none — no user-facing/config/API surface change" (item §5, expected case).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to verify this
successfully?_ **Yes.** This PRP pins the exact line ranges of all three JSDoc regions and their shipped
code bodies, the exact properties to check per region, the authoritative PRD sections (reproduced in the
selected_prd_content), the prior-research file that already reached the verdict, the disjoint-scope note
vs. S2, and the verified validation commands. The implementing agent reads four small regions and fills in
an agreement table — no inference, no codebase archaeology, no external research.

### Documentation & References

```yaml
# MUST READ — the authoritative spec the JSDoc must agree with
- file: PRD.md
  why: "§4.6 is the authoritative config spec: the 4-source precedence table (rows 1–4), the trust gate
        ('trusted only' on the two project rows), the SETTINGS_KEY form ('fileInjector' object vs whole
        file), 'read directly from disk', 'open-schema / preserves unknown keys / stable'. §4.5 rule 2 is
        'resolution base = dirname(importingMarkdownAbs)'; rule 5 is 'depth-uniform, no cwd fallback'. §4.6
        'Depth-uniform (no first-file asymmetry)' is the bareAt-at-every-depth property. These are the
        properties the three JSDoc regions must state."
  section: "### 4.5 Markdown import directives (rules 2 + 5) + ### 4.6 Optional bare-@ markdown imports"
  critical: "The JSDoc is the thing being AUDITED; the PRD is the AUTHORITY. If they disagree, the JSDoc is
             wrong (not the PRD) — fix the comment, never the PRD or the code. The shipped CODE is a second
             authority alongside the PRD: a comment is coherent only if it matches BOTH."

# MUST READ — the three JSDoc regions + their code bodies (the audit targets)
- file: file-injector.ts
  why: "SETTINGS_KEY const comment L167–171; readConfig JSDoc L174–183 + body L184–216; injectMarkdown JSDoc
        L790–837 + body L838–849 (the scanTokens call at L849 is the load-bearing line for dirname + bareAt)."
  pattern: "For each region, read the JSDoc, then read the immediately-following code body, then confirm each
            JSDoc claim maps to a code fact. (Line numbers are HEAD-1ad7b19 landmarks; re-locate by symbol
            name if they shifted: `grep -n 'const SETTINGS_KEY' file-injector.ts`, `grep -n 'async function
            readConfig' file-injector.ts`, `grep -n 'async function injectMarkdown' file-injector.ts`.)"
  gotcha: "injectMarkdown's JSDoc is LARGE (L790–837, ~47 lines). The two claims this audit cares about are:
           (1) the @param ctx line 'cwd unused — imports resolve from dirname(abs)' + the Step-3 comment at
           L842 '§4.5 rule 2 — imports resolve relative to the markdown's directory, not cwd'; (2) the Step-3
           comment at L846–848 '§4.6 — thread state.bareAt … so a markdown author who opts into
           markdownBareAtImports can write a bare @api.md (prefixLen 1)'. Do not be distracted by the other
           steps (Step 3.5 existence pre-check, etc.) — they are correct but out of scope for THIS audit."

# MUST READ — the prior scout verdict (independent first-hand confirmation, exact line numbers)
- file: plan/006_1862a6537500/architecture/research-config-and-resolution.md
  why: "Already reached the 'COHERENT — no discrepancies found' verdict with per-property evidence tables
        (readConfig 4-source merge L209/210/213/214; trust gate L211; missing→{} L187–206; injectMarkdown
        dirname L842, bareAt L849; no depth param; no ctx.cwd reference). This subtask RE-CONFIRMS that
        verdict at HEAD 1ad7b19 — it is not expected to overturn it."
  critical: "The prior research's line numbers (readConfig L184–217, injectMarkdown L838–849) match this
             PRP's. If a line number shifted, re-locate by symbol — the VERDICT is what must hold, not the
             exact line."

# The full first-hand re-confirmation (this subtask's own research)
- file: plan/006_1862a6537500/P1M1T2S3/research/research_notes.md
  why: "§2/§3/§4 are the three filled-in agreement tables (JSDoc claim ↔ shipped code line ↔ §4.5/§4.6
        clause) for readConfig / SETTINGS_KEY / injectMarkdown respectively. §5 is the verdict + the
        disjoint-from-S2 note + the gate commands. The implementing agent can reproduce these tables by
        reading the regions itself."

# READ for context (the sibling this task is disjoint from — confirms no overlap)
- file: plan/006_1862a6537500/P1M1T2S2/PRP.md
  why: "S2 audits README.md (lines 88–118); S3 audits file-injector.ts JSDoc. Confirming S2's target_file
        is './README.md' (not file-injector.ts) proves the two tasks are disjoint and neither duplicates
        the other."
  critical: "Do NOT edit README.md in this subtask — that is S2's scope. Do NOT edit PRD.md — that is
             human-owned (T2.S1 already fixed the count). This task touches ONLY file-injector.ts JSDoc, and
             only IF a drift is found (none expected)."
```

### Current Codebase tree (audit targets only)

```bash
pi-file-injector/
├── file-injector.ts          # ← AUDIT TARGET (read-only unless drift found):
│                             #    SETTINGS_KEY const + comment   L167–171  (§4.6 key form)
│                             #    readConfig JSDoc               L174–183  (§4.6 4-source/precedence/trust)
│                             #    readConfig body                L184–216  (the shipped behavior)
│                             #    injectMarkdown JSDoc           L790–837  (§4.5 rule 2/5 + §4.6 bareAt)
│                             #    injectMarkdown body            L838–…    (scanTokens call at L849)
├── file-injector.test.mjs    # 122-case gate (read-only reference; unaffected by a JSDoc audit)
├── relative-imports.test.mjs # 38-case gate (read-only reference)
├── import-behavior.test.mjs  # 22-case gate (read-only reference)
├── README.md                 # S2's target — NOT this task's
├── PRD.md                    # read-only authority (§4.5/§4.6) — human-owned
└── plan/006_1862a6537500/
    ├── architecture/research-config-and-resolution.md  # ← prior scout verdict (COHERENT)
    └── P1M1T2S3/{PRP.md, research/research_notes.md}    # ← this subtask
```

### Desired Codebase tree (files touched)

```bash
# EXPECTED OUTCOME — NO files touched:
#   $ git status --short
#   (empty)
# The audit produces a VERDICT, not a file change.

# ONLY IF a drift were found (NOT expected at HEAD 1ad7b19):
file-injector.ts   # MODIFIED — a MINIMAL JSDoc-only edit (comment text) to match shipped behavior.
                   #                  No code, no signature, no constant value change. Then re-run the gate.
# No other files. README.md is S2's. PRD.md is human-owned.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — JSDoc is COMMENTS. A JSDoc edit cannot change runtime behavior, so if a fix is made the
//   182-test gate stays green BY CONSTRUCTION. The only way a JSDoc edit breaks the gate is a SYNTAX
//   error (e.g. an unterminated */ or a stray */ inside the block). If you edit, re-run `npx tsc --noEmit
//   --strict` + the 3 test suites to confirm zero syntax errors.

// CRITICAL — the JSDoc is the AUDIT TARGET; the PRD + the shipped CODE are the AUTHORITIES. If the JSDoc
//   disagrees with either, the JSDoc is wrong — fix the comment. NEVER edit the code or the PRD to match
//   a stale comment. (At HEAD 1ad7b19 no disagreement exists, so no edit is expected.)

// GOTCHA — injectMarkdown's JSDoc is ~47 lines (L790–837) and covers much more than this audit's two
//   claims (it also documents Step 3.5 existence pre-check, the prefixLen strip, the R_OK residual, etc.).
//   Do NOT attempt to audit or "fix" those other clauses — they are out of scope and (per the prior
//   research) correct. This audit checks ONLY: (1) dirname(abs) resolution + no cwd + depth-uniform;
//   (2) bareAt threading. Find those two clauses, confirm them, stop.

// GOTCHA — line numbers are HEAD-1ad7b19 landmarks. If an earlier sibling commit (T2.S1/S2) shifted them,
//   re-locate by SYMBOL NAME, not by line:
//     grep -n 'const SETTINGS_KEY'        file-injector.ts   → the SETTINGS_KEY const
//     grep -n 'export async function readConfig'   file-injector.ts   → readConfig (+ its JSDoc is the /**…*/ immediately above)
//     grep -n 'async function injectMarkdown'      file-injector.ts   → injectMarkdown (+ its JSDoc is the /**…*/ immediately above)
//   The VERDICT (coherent vs drift) is what must hold; the exact line is a convenience.

// GOTCHA — do NOT confuse this task with S2 (README.md) or T2.S1 (PRD.md count). Each doc lives in a
//   different file; each subtask owns exactly one. `git status --short` empty at the end proves you did
//   not accidentally edit the wrong file.
```

## Implementation Blueprint

There is no data model and no new code. The "implementation" is a **three-region verification checklist**.
For each region: (1) read the JSDoc, (2) read the shipped code body, (3) read the PRD clause, (4) confirm
each JSDoc claim maps to both a code fact and a PRD clause. The expected result of every check is ✅.

### Verification Tasks (the whole "implementation")

```yaml
Task 1: VERIFY readConfig JSDoc coherence (file-injector.ts L174–183 ↔ body L184–216 ↔ PRD §4.6 table)
  - READ: the JSDoc block at L174–183 (the `/** PRD §4.6 / §9 — read config from up to FOUR sources… */`).
  - READ: the body at L184–216 (readConfig + tryReadCfg + tryReadNamespaced + the 4 spread-merge lines).
  - READ: PRD §4.6 "Config sources" table (the 4 rows) + "Loading" paragraph.
  - CONFIRM each property:
      (a) 4 sources listed → code has 4 spread lines (global settings L209, global file L210, project
          settings L213, project file L214). ✅ expected.
      (b) Precedence order (each later overrides) → spread-merge is sequential (L207→L214). ✅ expected.
      (c) Trust gate on BOTH project sources → `if (ctx.isProjectTrusted())` at L211 wraps L213+L214;
          global L209–210 outside the gate. ✅ expected.
      (d) SETTINGS_KEY form → L209/L213 use tryReadNamespaced (the SETTINGS_KEY object); L210/L214 use
          tryReadCfg (whole file). ✅ expected.
      (e) Missing/malformed → {} → both helpers catch + object-guard. ✅ expected.
      (f) Never throws → every read/parse in try/catch. ✅ expected.
  - OUTCOME: if all 6 ✅ → readConfig is COHERENT (no edit). If any ✗ → the JSDoc drifted; make the
    MINIMAL comment edit so the JSDoc matches the code (e.g. correct a source count, a precedence note,
    or the trust-gate wording). Do NOT edit the code.

Task 2: VERIFY SETTINGS_KEY const comment coherence (file-injector.ts L167–171 ↔ PRD §4.6 prose)
  - READ: the JSDoc at L167–170 + `const SETTINGS_KEY = "fileInjector";` at L171.
  - READ: PRD §4.6 ("namespaced key (`fileInjector`, distinct from the package `name`)", "read directly
          from disk", "open-schema", "preserves unknown keys").
  - CONFIRM the comment states: (a) it is the camelCase settings.json key; (b) distinct from the package
          `name`; (c) read directly from disk (no public settings accessor); (d) settings.json is open-
          schema / Pi preserves unknown keys → the key is stable. ✅ expected on all 4.
  - OUTCOME: if all ✅ → COHERENT (no edit). If any clause is missing/wrong → minimal comment fix.

Task 3: VERIFY injectMarkdown JSDoc coherence (file-injector.ts L790–837 ↔ body L838–849 ↔ PRD §4.5 rule 2/5 + §4.6)
  - READ: the JSDoc at L790–837 (focus on the two in-scope clauses — see Known Gotchas; do NOT audit the
          other ~40 lines of Step 3.5 / R_OK / prefixLen prose).
  - READ: the body at L838–849 (esp. L842 `const dir = path.dirname(abs)` and L849 the scanTokens call
          with `bareAt: state.bareAt`).
  - READ: PRD §4.5 rule 2 ("dirname(importingMarkdownAbs)"), rule 5 ("depth-uniform, no cwd fallback"),
          §4.6 "Depth-uniform (no first-file asymmetry)" + "the resolution base is always dirname(abs)".
  - CONFIRM:
      (a) dirname(abs) resolution — the JSDoc @param ctx says "cwd unused — imports resolve from
          dirname(abs)"; the Step-3 comment (L842) cites §4.5 rule 2; code L842+L849 use dir=dirname(abs)
          as baseDir. ✅ expected.
      (b) Depth-uniform, no cwd fallback — the JSDoc "DEDUP-BOUNDED, NOT depth-limited" bullet + the
          ABSENCE of any `depth` parameter; code has no `ctx.cwd` reference in injectMarkdown. ✅ expected.
      (c) bareAt threading — the Step-3 comment (L846–848) says "§4.6 — thread state.bareAt … bare @api.md
          (prefixLen 1)"; code L849 passes `bareAt: state.bareAt` unconditionally (no depth gate). ✅ expected.
  - OUTCOME: if all 3 ✅ → injectMarkdown is COHERENT (no edit). If any ✗ → minimal comment fix.

Task 4: RECORD the verdict + confirm the working tree
  - EXPECTED (all regions coherent): `git status --short` is EMPTY. Record the verdict "COHERENT — no edit"
    + the DOCS line "none — no user-facing/config/API surface change". Done.
  - ONLY IF a drift was fixed in Task 1/2/3: re-run the gate (`node file-injector.test.mjs` → 122 passed;
    `node relative-imports.test.mjs` → 38; `node import-behavior.test.mjs` → 22; `npx tsc --noEmit --strict`
    → 0 errors). Confirm `git status --short` shows ONLY `file-injector.ts` modified (not README.md, not
    PRD.md). Record the drift + the minimal fix in the verdict.
```

### Integration Points

```yaml
NONE — this is a read-only audit. There is no DATABASE, CONFIG, ROUTES, or code integration.
  - If (and only if) a drift fix is made: the only integration point is `file-injector.ts` JSDoc text.
    JSDoc is erased at runtime (jiti strips comments), so the 182-test gate is unaffected unless the edit
    introduced a syntax error (re-run tsc + the suites to rule that out).
```

## Validation Loop

### Level 1: Syntax & Style (only relevant IF a JSDoc edit was made)

```bash
# A JSDoc edit cannot change behavior, but it CAN introduce a comment-syntax error (e.g. a stray */ ).
# If NO edit was made (expected), skip this level entirely — there is nothing to check.
# If an edit WAS made, confirm the TS still transpiles + the suites still pass:

cd /home/dustin/projects/pi-file-injector
npx tsc --noEmit --strict file-injector.ts 2>&1 | head -5
# Expected: no output (0 errors). A "Unterminated comment" or "Unexpected token" here means the JSDoc edit
# broke the comment delimiters — fix the */ alignment and re-run.
```

### Level 2: The regression gate (the authoritative check — run EITHER way)

```bash
cd /home/dustin/projects/pi-file-injector
node file-injector.test.mjs    2>&1 | tail -3   # Expected: Result: 122 passed, 0 failed.
node relative-imports.test.mjs 2>&1 | tail -2   # Expected: Result: 38 passed, 0 failed.
node import-behavior.test.mjs  2>&1 | tail -2   # Expected: Result: 22 passed, 0 failed.
# Total: 182 passed, 0 failed. (This is the v006 §1 "182 passed, 0 failed" requirement, already met at HEAD 1ad7b19.)
# A JSDoc-only edit cannot change these counts. If a count changed, the edit was NOT comment-only — diff
# file-injector.ts and revert any accidental code change.
```

### Level 3: The verdict gate (the PRIMARY deliverable of this subtask)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# EXPECTED (no drift found): EMPTY output — no file modified. This empty output IS the success signal:
#   the audit confirmed coherence and correctly changed nothing.
# IF a drift was fixed: output is exactly ` M file-injector.ts` (and NOTHING else — not README.md, not
#   PRD.md). If README.md or PRD.md appear, you edited the wrong file — revert and re-do the audit on
#   file-injector.ts only.
git diff --stat   # IF a fix was made: confirms only file-injector.ts changed, and only comment lines.
```

### Level 4: Creative / Domain-Specific Validation

```bash
# None. There is no model, network, server, DB, or new feature. The "domain-specific validation" IS the
# three-region agreement check in Tasks 1–3 (the JSDoc ↔ code ↔ PRD tables in research_notes.md §2–§4).

# Optional: re-locate the symbols by name (proves the audit is robust to line-number drift):
grep -n 'const SETTINGS_KEY'             file-injector.ts   # the const + its JSDoc above
grep -n 'export async function readConfig'  file-injector.ts   # readConfig + its JSDoc above
grep -n 'async function injectMarkdown'     file-injector.ts   # injectMarkdown + its JSDoc above
```

## Final Validation Checklist

### Technical Validation

- [ ] `git status --short` is EMPTY (expected: no edit) OR shows only ` M file-injector.ts` (drift fixed).
- [ ] If an edit was made: `npx tsc --noEmit --strict file-injector.ts` → 0 errors (no comment-syntax break).
- [ ] All three test suites green: 122 + 38 + 22 = 182 passed, 0 failed (unchanged either way).

### Feature Validation (the audit itself)

- [ ] readConfig JSDoc (L174–183): 4 sources + precedence + trust gate + SETTINGS_KEY form — coherent with
      code (L184–216) AND §4.6.
- [ ] SETTINGS_KEY comment (L167–171): camelCase settings.json key, distinct from package name, read from
      disk — coherent with §4.6.
- [ ] injectMarkdown JSDoc (L790–837): dirname(abs) + depth-uniform/no-cwd-fallback + bareAt threading —
      coherent with code (L838–849) AND §4.5 rule 2/5 + §4.6.
- [ ] Verdict recorded: "COHERENT — no edit needed" (expected) OR the specific drift + minimal fix.

### Code Quality Validation

- [ ] (If no edit — expected): no code-quality dimension applies; the tree is untouched.
- [ ] (If a fix was made): the edit is JSDoc-ONLY (no code, signature, constant, or value change); it
      matches shipped behavior (not the reverse); it does not touch README.md (S2) or PRD.md (human-owned).

### Documentation

- [ ] DOCS line: "none — no user-facing/config/API surface change" (item §5, expected case).
      (If a drift fix rode here: the DOCS line instead names the JSDoc region corrected — but none is expected.)

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit the code to match a stale comment.** The PRD + shipped code are the authorities; the JSDoc
  is the audit target. If they disagree, fix the comment. (At HEAD 1ad7b19 they agree — no edit expected.)
- ❌ **Do NOT edit README.md.** That is S2's scope (P1.M1.T2.S2). This task touches ONLY file-injector.ts
  JSDoc, and only if a drift is found.
- ❌ **Do NOT edit PRD.md.** It is human-owned; T2.S1 already fixed its Done-definition count.
- ❌ **Do NOT audit/rewrite the ENTIRE injectMarkdown JSDoc.** It is ~47 lines covering Step 3.5, the R_OK
  residual, prefixLen, etc. — all correct and OUT OF SCOPE. This audit checks ONLY the dirname-resolution
  and bareAt-threading clauses. Find them, confirm them, stop.
- ❌ **Do NOT treat a non-empty `git status` as success.** The expected outcome is an EMPTY `git status
  --short`. A modification means either you found (and fixed) a drift (record it) OR you edited something
  you shouldn't have (revert — re-read the Anti-Patterns).
- ❌ **Do NOT re-run heavy research.** The prior scout (`research-config-and-resolution.md`) + this task's
  `research_notes.md` already did the first-hand verification with exact line numbers. The implementing
  agent's job is to READ four small regions and confirm — not to re-derive the architecture.
- ❌ **Do NOT invent drift to "be productive".** A verification task that finds nothing is a SUCCESS, not a
  failure. The expected + confirmed verdict is COHERENT — no edit. Manufacturing an edit where none is
  needed is itself a form of drift.

---

## Confidence Score: 10/10

This is a read-only doc-coherence audit of three small JSDoc regions, all of which have ALREADY been
confirmed coherent — twice: once by the prior scout (`research-config-and-resolution.md`, with per-property
line evidence) and once by this PRP's own first-hand read against HEAD `1ad7b19` (recorded in
`research_notes.md` §2–§4 as filled-in agreement tables). The expected outcome is a VERDICT ("coherent, no
edit") + an empty `git status`. The PRP pins the exact line ranges of each JSDoc region + its code body, the
exact properties to check per region, the authoritative PRD sections (reproduced in the selected_prd_content),
the disjoint-from-S2 note, and the verified gate commands (122 + 38 + 22 = 182 passed). There is no
inference, no new code, no external dependency, no build. The only residual risk — a future commit shifting
the line numbers between now and execution — is fully mitigated by the re-locate-by-symbol instructions
(`grep -n` on the function/const names). The implementing agent reads four regions, fills in a table, and
records the verdict.
