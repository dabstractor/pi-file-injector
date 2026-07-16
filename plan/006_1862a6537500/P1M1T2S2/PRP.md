---
name: "P1.M1.T2.S2 (plan/006) — Confirm README.md markdownBareAtImports config section coherence with §4.6"
prd_ref: "PRD §4.6 (Optional bare-@ markdown imports — config sources & precedence), §4.5 rule 5 (depth-uniform resolution)"
target_file: "./README.md"   # READ-ONLY verification — edit ONLY if a drift is found (none expected; none found at HEAD 1ad7b19)
target_language: Markdown (documentation audit; no code, no tests, no build)
depends_on: "P1.M1.T2.S1 (LANDED at HEAD 1ad7b19: PRD.md:1189 Done-definition 'all 24'→'all 32'; did NOT touch README.md config section or readConfig/injectMarkdown — coherence verdict unaffected)"
consumed_by: "NONE downstream. This is a read-only doc-coherence confirmation; it produces a verdict (coherent: no edit) + evidence, not a file change."
---

# PRP — P1.M1.T2.S2: Confirm README.md `markdownBareAtImports` config section coherence with §4.6

> **Scope flag:** This is a **read-only VERIFICATION** subtask. Its deliverable is a CONFIRMATION that
> README.md's `### Optional: bare-\`@\` markdown imports` section (lines 88–118) is coherent with PRD §4.6
> (the authoritative config spec) AND with the shipped `readConfig`/`injectMarkdown` code. The expected
> outcome — confirmed by first-hand verification against HEAD `1ad7b19` — is **COHERENT: no edit needed**
> (item §3). If, contrary to expectation, a drift were found, a minimal README edit to match code behavior
> would ride here (item §4); but the live tree shows NO drift. No code, no tests, no build.

---

## Goal

**Feature Goal:** Re-confirm — against the current tree (HEAD `1ad7b19`) — that README.md's config
section for `markdownBareAtImports` (the `### Optional: bare-\`@\` markdown imports` heading, lines 88–118)
remains coherent with PRD §4.6 on four points: (a) both config forms documented with examples, (b) all four
precedence locations listed in order, (c) the trust gate ("trusted project only") stated for the two project
sources, (d) the depth-uniform property stated. A prior audit
(`plan/006_1862a6537500/architecture/research-doc-audit.md` Part 3) found no drift; this subtask re-confirms
that finding still holds after two intervening commits.

**Deliverable:** A VERDICT — "coherent, no edit needed" (expected) — backed by a structured three-way
agreement table (README ↔ shipped code ↔ PRD §4.6) and a `git status --short` proof that NO file was
modified. **No README.md edit is produced** unless a drift is found (none is). The DOCS outcome is
"none — no user-facing/config/API surface change" (item §5).

**Success Definition:** The implementing agent (a) reads README.md lines 88–118, (b) reads PRD §4.6, (c)
reads the shipped `readConfig` (file-injector.ts ~L184–217) and `injectMarkdown` (~L838–849), (d) confirms
all four §4.6 properties are documented in README AND match code behavior AND match the PRD table, (e)
leaves the working tree clean (`git status --short` empty). If all four properties hold → mark complete, no
edit. If any property drifted → make the MINIMAL README edit to match code (not the reverse), then re-verify.

## User Persona

**Target User:** Maintainer / reviewer / implementer who relies on README.md as the user-facing config
reference and needs it to agree with the authoritative PRD §4.6 spec and the actual shipped behavior.

**Use Case:** A user reads README's "Optional: bare-`@` markdown imports" section to configure
`markdownBareAtImports`, then compares it with PRD §4.6 (or runs the code) — the three must agree on the
config forms, precedence, trust gate, and depth-uniformity.

**Pain Points Addressed:** Documentation drift between the user-facing README, the spec (PRD §4.6), and the
shipped code. This subtask is the gate that catches (or, as expected, rules out) such drift.

## Why

- **Doc coherence gate (the v006 delta's purpose).** Plan 006 is a "Verification & Documentation Coherence
  Gate" — its M1.T2 milestone audits the docs for staleness. T2.S1 fixed the PRD Done-definition count;
  T2.S2 (this) confirms the README config section; T2.S3 confirms the JSDoc. Together they close the
  doc-audit findings.
- **Re-confirmation after intervening commits.** The audit (research-doc-audit.md) ran at an earlier HEAD;
  since then `e1c4716` ("Advance PRD and README coherence tasks") and `1ad7b19` ("Correct PRD Done-definition
  test count") landed. T2.S1's PRD edit (L1189) did not touch README's config section or `readConfig`/
  `injectMarkdown`, but the coherence verdict must be RE-verified against the current tree, not assumed.
- **Expected no-op with evidence.** The expected outcome is "coherent — no edit," but a no-op without
  evidence is not a verification. The deliverable is the structured comparison proving the coherence, plus
  a clean `git status` proving nothing was changed.

## What

A read-only audit producing a verdict + evidence. No user-visible or runtime behavior change (README.md is
documentation; it is not loaded by any code or test). The README section under test:

- **Heading:** `README.md:88` — `### Optional: bare-\`@\` markdown imports`
- **Body:** lines 89–117; trailing blank 118; next heading `## Limits` at 119.
- **Verified bounds: lines 88–118** (item metadata says "88–117" and "134 lines"; actual is 88–118 and 136
  lines — the README grew by 2 lines; these are METADATA drift, not content drift).

### Success Criteria

- [ ] README.md:88–118 documents BOTH config forms with examples (dedicated `file-injector.json` AND the
      `fileInjector` namespaced key in `settings.json`). [§4.6 "Config sources"]
- [ ] README.md lists all FOUR precedence locations in order (global settings key → global file → project
      settings key → project file), matching PRD §4.6 table rows 1–4. [§4.6 table]
- [ ] README.md states the trust gate ("trusted project only") for BOTH project sources (rows 3–4) AND an
      explicit prose statement. [§4.6 "Loading" para]
- [ ] README.md states the depth-uniform property (bare-`@` honored at every depth; first file not
      special-cased). [§4.6 "Depth-uniform" para]
- [ ] Each README claim MATCHES the shipped code: `readConfig` 4-source spread order + single
      `if (ctx.isProjectTrusted())` gate + no-throw on missing/malformed (file-injector.ts ~L184–217);
      `injectMarkdown` resolves against `path.dirname(abs)` (not `ctx.cwd`), threads `bareAt: state.bareAt`
      unconditionally, has no depth param (file-injector.ts ~L838–849).
- [ ] `git status --short` is EMPTY after the subtask (no file modified) — the proof of the no-op verdict.
      (If a drift HAD been found and fixed, `git status` would show `M README.md` instead — but none exists.)
- [ ] DOCS outcome recorded as "none — no user-facing/config/API surface change" (item §5).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives: the exact README section bounds (heading L88, body 89–117, bound
88–118 — CORRECTED from the item's stale "88–117 / 134 lines"), the four §4.6 properties to check with
their README line evidence, the exact shipped-code line ranges to cross-check (`readConfig` L184–217,
`injectMarkdown` L838–849, `state.bareAt` L958), the three-way agreement matrix (pre-filled, verified), the
verified verdict (COHERENT — no edit), and the exact verification commands (`git status --short` must be
empty). The implementing agent reads three doc/code regions, confirms the matrix, and leaves the tree clean.

### Documentation & References

```yaml
# MUST READ — the prior audit (found NO drift; this subtask re-confirms it)
- file: plan/006_1862a6537500/architecture/research-doc-audit.md
  why: "Part 3 is the prior README §4.6 coherence audit: confirms (a) both forms documented, (b) four
        locations in order, (c) trust gate stated, (d) depth-uniform stated. Verdict: 'Complete and
        internally consistent with PRD §4.6. No gaps found.' T2.S2 re-confirms this against the current
        tree (HEAD advanced twice since; README/§4.6/code unaffected by those commits)."
  section: "Part 3 — README.md markdownBareAtImports config section"
  critical: "Part 3's line numbers (88-117) are from the audit-time tree. The README has since grown to 136
             lines; the section is now 88-118 (heading 88, body 89-117, blank 118, ## Limits at 119). The
             CONTENT is unchanged — only the bound shifted by the trailing blank. Use the live bounds."

# MUST READ — the README section under test (the verification target)
- file: README.md
  why: "Lines 88-118 are the `### Optional: bare-`@` markdown imports` section (heading has literal backticks
        around @ — grep for `markdown imports`, not `bare-@`). It documents: both config forms (L92 + L97-105),
        the 4-row precedence list (L107-112), the trust gate (L111-113), and depth-uniformity (L116)."
  pattern: "Each claim must map 1:1 to a PRD §4.6 row AND to a shipped-code line (see the three-way matrix
            in the research notes / Implementation Blueprint)."
  gotcha: "The heading is `### Optional: bare-`@` markdown imports` — the backticks around @ are literal
           markdown. A plain `grep 'bare-@'` matches NOTHING. Search `grep -n 'markdown imports' README.md`
           to locate the heading."

# MUST READ — the authoritative spec to diff the README against
- file: PRD.md
  why: "§4.6 (PRD.md ~L192-231) is the authoritative config spec: the 4-row precedence table (Global
        settings / Global file / Project settings / Project file; trust = always/always/trusted-only/
        trusted-only), the within-scope rule (dedicated file beats settings key), the scope rule (project
        beats global), the trust-gate loading statement, the depth-uniform property, and the top-level-
        unaffected scope. The README must agree with ALL of these."
  section: "### 4.6 Optional bare-@ markdown imports (config: markdownBareAtImports)"
  critical: "PRD §4.6 is the source of truth. If README and §4.6 disagree, the README is wrong (fix the doc
             to match the spec). If §4.6 and the CODE disagree, that is a DIFFERENT subtask (code fix), not
             this one — this subtask only confirms README↔§4.6↔code three-way agreement (which holds)."

# MUST READ — the shipped code the README must match (readConfig: 4-source merge + trust gate)
- file: file-injector.ts
  why: "`readConfig` (lines 184-217) implements the 4-source spread-merge in EXACTLY the README/§4.6 order
        (L209 global settings key, L210 global file, L211 `if (ctx.isProjectTrusted()) {`, L213 project
        settings key, L214 project file, L215 `}`). `SETTINGS_KEY = \"fileInjector\"` (L171). `tryReadCfg`
        (L187-193) and `tryReadNamespaced` (L197-205) both `try/catch → {}` (missing/malformed → default,
        no throw). This is the behavior the README's 'never errors' + 'trusted project only' claims describe."
  pattern: "Read L184-217 to confirm: (1) spread order = README L109-112 = PRD §4.6 table; (2) BOTH project
            sources inside the single trust gate; (3) no-throw on missing/malformed."
  gotcha: "The spread-merge is sequential, so precedence = LAST write wins. The order in code (global settings
           key FIRST, project file LAST) exactly matches README's 'each later one wins' list. Do not
           're-order' anything — it is already correct."

# MUST READ — the shipped code the README's depth-uniform claim must match (injectMarkdown)
- file: file-injector.ts
  why: "`injectMarkdown` (line 838) resolves imports against `path.dirname(abs)` (L844 — NOT ctx.cwd), passes
        `bareAt: state.bareAt` UNCONDITIONALLY in the scanTokens opts (L849), and has NO depth parameter
        (signature is `(abs, content, state, ctx)`). `state.bareAt` is set ONCE (L958) from cfg; the sole
        caller passes `cfg.markdownBareAtImports === true` (L1037). This is the behavior the README's
        'uniform at every depth ... first file is not special-cased' claim (L116) describes."
  pattern: "Read L838-849 to confirm: dirname(abs) base, unconditional bareAt, no depth param. Read L958 +
            L1037 to confirm bareAt is cfg-driven and set once."
  gotcha: "There is NO depth counter anywhere in the file (`grep depth` finds only doc comments). Depth-uniformity
           is a structural property (resolution base is always dirname(abs)), not an enforced limit. The README
           claim matches this exactly."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD 1ad7b19, working tree CLEAN
├── README.md                    # ← READ-ONLY target of the audit (section L88-118; total 136 lines)
├── PRD.md                       # ← READ-ONLY spec (§4.6 ~L192-231; L1189 Done-def already fixed by T2.S1)
├── file-injector.ts             # ← READ-ONLY cross-check (readConfig L184-217; injectMarkdown L838-849)
├── file-injector.test.mjs       # untouched (no test gate for a doc-audit no-op)
├── relative-imports.test.mjs    # untouched
├── package.json                 # untouched
└── plan/006_1862a6537500/
    ├── architecture/
    │   ├── research-doc-audit.md              # ← Part 3 = the prior README §4.6 audit (verdict: no drift)
    │   └── research-config-and-resolution.md  # ← the readConfig/injectMarkdown code analysis (verdict: matches §4.6)
    ├── P1M1T2S1/               # ← LANDED (PRD L1189 fix; did not touch README/code coherence)
    └── P1M1T2S2/
        ├── research/research_notes.md   # ← the three-way agreement matrix + corrected line bounds (this subtask)
        └── PRP.md                        # (this file)
```

### Desired Codebase tree (files touched)

```bash
# EXPECTED: NO files touched. `git status --short` empty after the subtask.
# (If a drift were found — none is — the only acceptable change would be: M README.md, minimal edit.)
README.md    # UNCHANGED (read-only audit; no drift found at HEAD 1ad7b19)
# No other files. No code. No tests. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — the EXPECTED outcome is "coherent, NO edit." Verified first-hand at HEAD 1ad7b19: README
     L88-118, readConfig L184-217, injectMarkdown L838-849, PRD §4.6 all agree on all four properties.
     Do NOT invent a drift to "justify" an edit. If your re-check confirms the matrix below, the deliverable
     is the verdict + a clean `git status --short`. Editing README when it is already correct would INTRODUCE
     drift (the opposite of this subtask's purpose). -->

<!-- CRITICAL — the item's line metadata is STALE, the README content is NOT. Item says "134 lines, lines
     88-117"; actual is "136 lines, section 88-118 (heading 88, body 89-117, blank 118, ## Limits at 119)".
     The README grew by 2 lines at some point; the config-section CONTENT is unchanged. Do NOT treat the
     line-count mismatch as a drift to fix — it is metadata drift in the item description, not doc drift.
     Use the LIVE bounds (grep `markdown imports` to find the heading). -->

<!-- GOTCHA — the README heading is `### Optional: bare-`@` markdown imports` with LITERAL backticks around
     the @. A plain `grep 'bare-@'` matches NOTHING (the backtick breaks the literal). Locate the heading
     with `grep -n 'markdown imports' README.md` (→ L88) or `grep -n '^### ' README.md`. -->

<!-- GOTCHA — PRD.md is normally READ-ONLY and this subtask does NOT edit it (T2.S1 was the one sanctioned
     PRD edit). This subtask's only possible edit target is README.md, and ONLY if a README drift is found
     (none is). Do not touch PRD.md, file-injector.ts, or any test file. -->

<!-- GOTCHA — README.md is NOT loaded by any code or test (file-injector.ts/.test.mjs don't import it). So
     a README edit (if one were needed) cannot break any build or test. Conversely, there is NO test gate
     for this subtask — validation is the three-way agreement matrix + `git status --short` being empty. -->

<!-- GOTCHA — if §4.6 and the CODE disagreed, that would be a CODE-FIX subtask, not this one. This subtask
     confirms three-way (README ↔ §4.6 ↔ code) agreement. All three agree at HEAD 1ad7b19 (verified). The
     only "fix" this subtask could produce is a README edit to match §4.6/code — and none is needed. -->
```

## Implementation Blueprint

### The verification procedure (read-only — no edit expected)

**Step 1 — Read the README section (live bounds).**
```bash
cd /home/dustin/projects/pi-file-injector
# Locate the heading (literal backticks around @ → don't grep "bare-@"):
grep -n 'markdown imports' README.md     # → 88:### Optional: bare-`@` markdown imports
# Read the full section (heading 88 → blank before ## Limits at 119):
sed -n '88,118p' README.md
```
Confirm the section contains: both config forms (L92 intro + L97–99 dedicated + L100–105 namespaced); the
4-row precedence list (L107–112); the trust gate (L111–112 rows + L113 prose); depth-uniformity (L116);
top-level-unaffected (L118).

**Step 2 — Read PRD §4.6 (the spec).**
```bash
sed -n '192,231p' PRD.md     # §4.6 full text incl. the 4-row precedence table
```
Confirm the table rows (1 Global settings/always, 2 Global file/always, 3 Project settings/trusted-only,
4 Project file/trusted-only), the within-scope + scope rules, the trust-gate loading statement, the
depth-uniform para, the top-level-unaffected scope para.

**Step 3 — Read the shipped code (cross-check).**
```bash
sed -n '171p;184,217p' file-injector.ts    # SETTINGS_KEY + readConfig (4-source merge + trust gate + no-throw)
sed -n '838,849p' file-injector.ts          # injectMarkdown (dirname(abs), unconditional bareAt, no depth param)
sed -n '958p;1037p' file-injector.ts        # state.bareAt set once; caller passes cfg.markdownBareAtImports===true
```

**Step 4 — Build the three-way agreement matrix (the deliverable evidence).**

| §4.6 property | README (live line) | shipped code (live line) | PRD §4.6 | Agree? |
|---|---|---|---|---|
| Two config forms (dedicated + namespaced key) | L92, L97–105 | tryReadCfg L187–193 + tryReadNamespaced L197–205 | §4.6 "Config sources" + 2 code blocks | ✅ |
| 4 precedence locations, this order | L109–112 | spread L209,210,213,214 | §4.6 table rows 1–4 | ✅ |
| Within-scope: dedicated file beats settings key | L107 | spread order (file after key per scope) | §4.6 "within a scope…" | ✅ |
| Scope: project overrides global | L107 ("each later wins") | spread order (project after global) | §4.6 "project overrides global" | ✅ |
| Trust gate on BOTH project sources | L111–113 | both inside `if (ctx.isProjectTrusted())` L211 | §4.6 table "trusted only" rows 3–4 | ✅ |
| Missing/malformed → default, no error | L116 ("never errors") | try/catch → {} L187–205 | §4.6 "Loading" ("never an error") | ✅ |
| Depth-uniform bare-@ (no first-file asymmetry) | L116 | dirname(abs) L844, bareAt always L849, no depth param | §4.6 "Depth-uniform" | ✅ |
| Top-level prompt unaffected (always #@) | L118 | top-level scanTokens bareAt:false | §4.6 "Scope" | ✅ |

(All eight rows verified ✅ at HEAD `1ad7b19` — see `research/research_notes.md` §4.)

**Step 5 — Record the verdict.**
- If all eight rows are ✅ (expected, verified): **VERDICT = "coherent, no edit needed."** Record the matrix
  as evidence. DO NOT edit any file. DOCS line = "none — no user-facing/config/API surface change" (item §5).
- If any row is ❌ (NOT expected; would indicate drift): make the MINIMAL README.md edit to match code
  behavior (item §4: "correct the doc to match code behavior, not the other way"), then re-run Steps 1–4 to
  confirm the row flips to ✅. Record the drift + the fix. (At HEAD `1ad7b19` this branch is NOT taken.)

**Step 6 — Prove the no-op (the verification gate).**
```bash
git status --short     # EXPECTED: empty (no file modified). This is the proof of the no-op verdict.
```
If `git status` shows `M README.md`, either a drift was found and fixed (re-verify the matrix is now all ✅),
or an accidental edit was made (revert it — the expected outcome is no change).

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: READ README.md lines 88-118 (the config section) — locate via `grep -n 'markdown imports' README.md`
  - CONFIRM the section contains: both config forms (L92 + L97-99 + L100-105); 4-row precedence list
            (L107-112); trust gate (L111-113); depth-uniform (L116); top-level-unaffected (L118).
  - GOTCHA: the heading has literal backticks around @ — grep `markdown imports`, not `bare-@`.
  - GOTCHA: live bounds are 88-118 (item says 88-117; the trailing blank is L118). Metadata drift, not content.

Task 2: READ PRD.md §4.6 (~L192-231) — the authoritative spec
  - CONFIRM the 4-row table (Global settings/always, Global file/always, Project settings/trusted-only,
            Project file/trusted-only), the within-scope + scope rules, the trust-gate loading statement,
            the depth-uniform para, the top-level-unaffected scope para.

Task 3: READ shipped code — readConfig (file-injector.ts L171, L184-217) + injectMarkdown (L838-849) + state.bareAt (L958, L1037)
  - CONFIRM readConfig: 4-source spread order (L209,210,213,214) = README L109-112 = PRD table; BOTH project
            sources inside single `if (ctx.isProjectTrusted())` gate (L211-215); tryReadCfg/tryReadNamespaced
            try/catch → {} (no-throw on missing/malformed).
  - CONFIRM injectMarkdown: resolves against path.dirname(abs) (L844, NOT ctx.cwd); threads bareAt:
            state.bareAt unconditionally (L849); NO depth param (signature (abs, content, state, ctx)).
  - CONFIRM state.bareAt set once (L958) from cfg; caller passes cfg.markdownBareAtImports === true (L1037).

Task 4: BUILD the three-way agreement matrix (the deliverable evidence) — 8 rows, one per §4.6 property
  - For each property: README line ↔ code line ↔ PRD §4.6 row → ✅ or ❌.
  - EXPECTED (verified at HEAD 1ad7b19): all 8 rows ✅. (See the matrix in the Implementation Blueprint.)

Task 5: RECORD the verdict
  - IF all 8 ✅ (expected): VERDICT = "coherent, no edit needed." NO file edit. DOCS = "none — no
            user-facing/config/API surface change" (item §5).
  - IF any ❌ (NOT expected): minimal README.md edit to match code (item §4), then re-run Tasks 1-4 to
            confirm the row flips to ✅. (This branch is NOT taken at HEAD 1ad7b19.)

Task 6: VERIFY — git status is clean (the no-op proof)
  - RUN: `git status --short`
    EXPECT: empty (no file modified). This is the proof that the no-op verdict was correctly enacted.
  - IF `M README.md` appears: either a drift was found+fixed (re-verify the matrix is all ✅) OR an
            accidental edit was made (revert it). At HEAD 1ad7b19 the expected result is EMPTY.
```

### Integration Points

```yaml
FILE_EDITS: NONE (expected). README.md is read-only for this subtask; no drift found at HEAD 1ad7b19.
  - IF a drift were found (none is), the only acceptable edit would be: M README.md, minimal change to
    match code behavior (item §4: "correct the doc to match code behavior, not the other way"). The edit
    would be validated by re-running the three-way matrix and confirming the drifted row flips to ✅.

NO_CODE / NO_TESTS / NO_NEW_FILES: documentation audit only. README.md is not loaded by any code or test.

NO_PRD_EDIT: PRD.md is read-only for this subtask (T2.S1 was the one sanctioned PRD edit, already landed).
  §4.6 is the SOURCE OF TRUTH the README is diffed against — do not modify it.

NO_CONFLICT_WITH_SIBLINGS:
  - T2.S1 (LANDED): fixed PRD.md:1189 Done-definition; did NOT touch README's config section or
    readConfig/injectMarkdown. Coherence verdict unaffected.
  - T2.S3 (upcoming): confirms readConfig/SETTINGS_KEY/injectMarkdown JSDoc coherence with §4.5/§4.6. T2.S2
    (README) and T2.S3 (JSDoc) touch DISJOINT doc surfaces (README.md vs file-injector.ts comments). No overlap.
```

## Validation Loop

### Level 1: Read scope (the four §4.6 properties are present in README)

```bash
cd /home/dustin/projects/pi-file-injector
# Locate the section (literal backticks around @ → grep the stable substring):
grep -n 'markdown imports' README.md        # → 88:### Optional: bare-`@` markdown imports
# Read the full section:
sed -n '88,118p' README.md
# EXPECT: both forms (L92 + L97-99 + L100-105); 4-row list (L107-112); trust gate (L111-113);
#         depth-uniform (L116); top-level-unaffected (L118). All four §4.6 properties present.
```

### Level 2: Three-way agreement (README ↔ code ↔ PRD §4.6)

```bash
cd /home/dustin/projects/pi-file-injector
# PRD §4.6 (the spec):
sed -n '192,231p' PRD.md
# readConfig (4-source merge + trust gate):
sed -n '171p;184,217p' file-injector.ts
# injectMarkdown (dirname(abs), unconditional bareAt, no depth):
sed -n '838,849p' file-injector.ts
# state.bareAt (set once from cfg):
sed -n '958p;1037p' file-injector.ts
# BUILD the 8-row matrix (Implementation Blueprint). EXPECT: all 8 ✅ at HEAD 1ad7b19.
# If any row is ❌, follow Task 5's drift branch (minimal README edit → re-verify). Not expected.
```

### Level 3: No-op proof (the verification gate)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# EXPECTED: EMPTY (no file modified). This is the proof of the "coherent, no edit needed" verdict.
#
# If `M README.md` appears:
#   - A drift was found + fixed → re-run Level 2, confirm the drifted row is now ✅. (Not expected at 1ad7b19.)
#   - OR an accidental edit was made → `git checkout README.md` to revert, then re-confirm Level 1-2.
git diff --stat      # EXPECTED: empty (no stat output). Belt-and-suspenders companion to `git status`.
```

### Level 4: No regression to code/tests (README isn't loaded — sanity)

```bash
cd /home/dustin/projects/pi-file-injector
# README.md is NOT imported by any code or test, so a README edit (had one been needed) cannot break a build.
# Optional belt-and-suspenders (NOT required — the gate is Level 3's clean `git status`):
#   node ./file-injector.test.mjs && node ./relative-imports.test.mjs
#   → still "182 passed, 0 failed." (P1.M1.T1.S1 baseline; this subtask cannot have changed it.)
```

## Final Validation Checklist

### Technical Validation

- [ ] README.md lines 88–118 read; all four §4.6 properties present (both forms, 4 locations, trust gate,
      depth-uniform).
- [ ] PRD §4.6 read; the 4-row precedence table + within-scope/scope/trust/depth-uniform/scope paras confirmed.
- [ ] Shipped code read: `readConfig` (L184–217) 4-source spread + single trust gate + no-throw;
      `injectMarkdown` (L838–849) dirname(abs) + unconditional bareAt + no depth param; `state.bareAt` (L958,
      L1037) set once from cfg.
- [ ] Three-way agreement matrix built: all 8 rows ✅ (expected at HEAD `1ad7b19`).
- [ ] `git status --short` is EMPTY (no file modified) — the no-op proof.

### Feature (Audit) Validation

- [ ] VERDICT recorded: "coherent — no edit needed" (expected) OR "drift found + minimal README fix" (not
      expected at HEAD `1ad7b19`).
- [ ] DOCS line recorded: "none — no user-facing/config/API surface change" (item §5) — because no drift.
- [ ] The README section's claims each map 1:1 to a PRD §4.6 row AND a shipped-code line.

### Code Quality Validation

- [ ] NO file edited (expected). If a drift was found and fixed, the edit is MINIMAL (only the drifted claim)
      and the matrix re-verified to all ✅.
- [ ] No PRD.md edit (T2.S1 was the one sanctioned PRD edit; this subtask is README-only).
- [ ] No code/test file touched.

### Documentation

- [ ] DOCS = "none — no user-facing/config/API surface change" (item §5, no-drift branch). [Mode A]
- [ ] No README change (coherent). No JSDoc change (that is T2.S3). No PRD change (that was T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT invent a drift to justify an edit.** The expected outcome (verified first-hand at HEAD `1ad7b19`)
  is "coherent — no edit needed." All 8 matrix rows are ✅. Editing a correct README would INTRODUCE drift.
- ❌ **Do NOT treat the item's stale line metadata as drift.** The item says "134 lines, lines 88–117"; actual
  is "136 lines, section 88–118." The README GREW by 2 lines; the config-section CONTENT is unchanged. This is
  metadata drift in the item description, not doc drift — do not "fix" the line count.
- ❌ **Do NOT grep `bare-@` to find the heading.** The heading has literal backticks around the `@`
  (`### Optional: bare-\`@\` markdown imports`), so `grep 'bare-@'` matches NOTHING. Use
  `grep -n 'markdown imports' README.md` (→ L88).
- ❌ **Do NOT edit PRD.md.** PRD.md is read-only for this subtask (T2.S1 was the one sanctioned PRD edit,
  already landed). §4.6 is the SOURCE OF TRUTH the README is diffed against — do not modify it.
- ❌ **Do NOT edit code or test files.** This is a doc-coherence audit. If §4.6 and the CODE disagreed, that
  would be a different (code-fix) subtask — not this one. (They agree at HEAD `1ad7b19`.)
- ❌ **Do NOT run a test suite expecting it to validate the README.** README.md is not loaded by any code or
  test. Validation is the three-way matrix + `git status --short` being empty. (Running the suite is optional
  belt-and-suspenders only; it cannot be affected by this subtask.)
- ❌ **Do NOT "fix" the README to match a misreading of §4.6.** Read §4.6 carefully: the 4-row table, the
  within-scope rule (dedicated file beats settings key), the scope rule (project beats global), the trust gate
  (both project sources), the depth-uniform property. The README matches ALL of these. If you think you found
  a mismatch, re-read §4.6 and the code before editing — the verified verdict is NO mismatch.
- ❌ **Do NOT duplicate T2.S3's work.** T2.S3 confirms the JSDoc on `readConfig`/`SETTINGS_KEY`/`injectMarkdown`
  (in file-injector.ts). T2.S2 confirms the README config section. Disjoint surfaces — do not edit JSDoc here.

---

## Confidence Score: 10/10

A read-only verification subtask whose expected outcome ("coherent — no edit") has been verified first-hand
against HEAD `1ad7b19`: all 8 rows of the three-way agreement matrix (README ↔ shipped code ↔ PRD §4.6) are ✅.
The PRP includes the CORRECTED live line bounds (section 88–118, total 136 lines — the item's "88–117 / 134"
is stale metadata, not drift), the exact README evidence per property (L92, L97–105, L107–112, L111–113,
L116, L118), the exact code cross-check lines (`readConfig` L184–217 spread + trust gate; `injectMarkdown`
L838–849 dirname+bareAt+no-depth; `state.bareAt` L958/L1037), the heading-search gotcha (literal backticks →
grep `markdown imports`), the prior-audit reference (research-doc-audit.md Part 3, same verdict), and the
exact verification gate (`git status --short` empty = no-op proof). The implementing agent reads three
doc/code regions, confirms the matrix, records the verdict, and leaves the tree clean. There is no code path,
no test, no build, and no ambiguity — and the one possible edit branch (drift found) is explicitly NOT taken
at this HEAD. The -0 reserves nothing: this is a confirmed no-op with a complete evidence trail.
