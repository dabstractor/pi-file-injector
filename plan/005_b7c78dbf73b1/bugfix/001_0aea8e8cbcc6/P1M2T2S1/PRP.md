---
name: "P1.M2.T2.S1 (bugfix 001) — Sweep README.md + overview docs for consistency with the verbatim-on-error fix (Mode B docs task; expected outcome: NO edit, record decision; optional minimal L59 tightening)"
prd_ref: "bugfix PRD §h3.0 Issue 1 (verbatim-on-error for unreadable markdown imports); main PRD §5.4 (Missing/dir/read error → verbatim), §10 (Edge Cases: 'Read throws (permissions) → Caught; token left verbatim'), §12.5 ('never throw… leave the token verbatim'), §12.16 (strip resolved markers; failed markers keep verbatim)"
target_file: "./README.md"   # PRIMARY path: READ-ONLY verification + recorded decision (no edit). FALLBACK path: ONE-line minimal tightening at L59 ONLY if the implementer judges transitive permission-parity explicitness adds value.
target_language: Markdown (user-facing doc); gate = `git diff README.md` (empty in primary) + `node ./file-injector.test.mjs` (must stay 122/0 — a docs task must NOT break the suite)
depends_on: "P1.M1.T1.S1 (R_OK gate + Step 3.5 comment incl. resizeImage-residual note + E5 — LANDED, commit 342bd73) + P1.M1.T1.S2 (un-claim on injectFile failure + E6 — LANDED, commit 4d76d00) + P1.M2.T1.S1 (T2.S1-f test-isolation verify — has NO doc surface). This task runs LAST so it sees the final code+comment state."
consumed_by: "(none — this is the final documentation task of the bugfix plan)"
---

# PRP — P1.M2.T2.S1 (bugfix 001): Sweep README.md + overview docs for consistency with the verbatim-on-error fix

> **Scope flag:** This is a **Mode-B documentation task**, and it is a **verification + decision task**: the
> bugfix (Issue 1) restored the documented "leave verbatim on error" guarantee for the markdown-import path — it
> introduces **NO new user-facing behavior and NO new config**. It makes the *code* match the *existing docs*
> (README L52 "permission error → Left as written" + PRD §5.4/§10/§12.5/§12.16 all already say the now-correct
> behavior). So the sweep's job is to **CONFIRM README consistency** with the fixed code, NOT to document
> something new. **The expected outcome (per the item contract) is NO README edit — record the "docs already
> correct" decision.** An OPTIONAL one-line tightening (README L59's parenthetical) is provided as a fallback for
> the implementer to apply ONLY if they judge transitive permission-parity explicitness adds value. `PRD.md` is
> **READ-ONLY** and must never be modified. The resizeImage-throw residual is **NOT** surfaced in the README
> (internal detail, already in the Step 3.5 code comment).

---

## Goal

**Feature Goal:** Confirm that README.md (the sole user-facing doc) accurately describes the now-correct
verbatim-on-error behavior for ALL injection paths — including the markdown-TRANSITIVE-import path that Issue 1
fixed — and that no README sentence implies an unreadable markdown import would be stripped. Decide (and record)
whether any edit is warranted.

**Deliverable:** A RECORDED DECISION (in the task report) that README.md is consistent with the fixed code, PLUS
— in the PRIMARY path — **no file edited** (`git diff README.md` empty). In the OPTIONAL FALLBACK path, a single
minimal accuracy tightening to README L59's parenthetical to make transitive permission-parity explicit. `PRD.md`
is untouched in both paths.

**Success Definition:**
1. README L52 ("Missing file, directory, or permission error → Left as written. Nothing is appended.") is verified
   to hold for markdown transitive imports too (the fix complies; no footnote needed).
2. README L58-59 / L82-84 / L103-111 are verified to imply NOTHING that contradicts "unreadable markdown import →
   marker verbatim." (All pass — see the line-by-line analysis in Implementation Tasks.)
3. The resizeImage-throw residual is deliberately NOT surfaced in the README (internal; already in the code comment).
4. `node ./file-injector.test.mjs` → **122 passed, 0 failed** UNCHANGED (a docs task must not break the suite).
5. `git diff PRD.md` is **EMPTY** (read-only) in both paths; `git diff README.md` is **EMPTY** (primary) or a
   single 1-line tightening (optional fallback).
6. The decision (no-change vs. the optional edit) is RECORDED with rationale.

## User Persona

**Target User:** A `#@file` extension user reading README.md to learn what happens when an import target can't be
read (a restricted file under `#@spec.md`, an unreadable file in a shared doc tree, a permission error mid-import).

**Use Case:** The user has `#@spec.md` where `spec.md` references `#@secrets.md` (or a file in a restricted dir)
they lack read access to. They want the README to tell them, truthfully, what happens: the marker stays verbatim
and nothing is appended — no silent loss.

**User Journey:** User reads README "What gets injected" table → sees "Missing file, directory, or permission error
→ Left as written. Nothing is appended." → reads the markdown-imports paragraph ("the same file-type rules … apply
to each import unchanged") → correctly concludes the permission-error rule covers transitive imports too. (This
journey was already TRUE in the docs; Issue 1 made the code match it. This task verifies the docs still tell that
truth clearly.)

**Pain Points Addressed:** Before the bugfix, the code SILENTLY contradicted the README on the unreadable-import
path (stripped instead of verbatim) — a user trusting the README would be misled. After the fix the code complies;
this task ensures the README still says exactly the right thing and isn't subtly wrong or ambiguous now that the
code enforces it.

## Why

- **The bugfix changed code, not docs.** Issue 1 was a code/doc DIVERGENCE: the README (and PRD §5.4/§10/§12.5)
  always promised "permission error → Left as written," but the markdown-import path stripped the marker. The fix
  brings the code INTO compliance. So the doc sweep's value is a CONSISTENCY CONFIRMATION, not new documentation —
  and a confirmation that no README sentence became subtly inaccurate or ambiguous once the code enforces the rule.
- **Markdown transitive imports are the subtler surface.** The L52 table reads as "top-level" to a casual reader;
  the L59 sentence ("the same file-type rules … apply to each import unchanged") is what extends it to transitive
  imports. This task confirms that extension is unambiguous after the fix.
- **Mode B runs last, sees the final state.** This task declares dependencies on S1 (R_OK gate + comment + E5),
  S2 (un-claim + E6), and M2.T1.S1 (test isolation), so it reviews the FINAL code+comment+test state. The
  resizeImage-residual code comment (the "one-line note" the item §3c mentions) was already added by S1 to the
  Step 3.5 comment (file-injector.ts L848-854) — so the residual is documented WHERE it belongs (code), not the README.
- **Avoids doc drift.** A recorded "verified consistent, no change" decision is itself a deliverable: it tells the
  next maintainer the docs were checked against the fix and are correct, so a future regression is detectable.

## What

No user-visible / API / config / code change. In the PRIMARY path, **no file is edited** — this is a read-only
review + a recorded decision + a suite run (as a regression guard). The OPTIONAL FALLBACK edits exactly ONE line
of README.md (L59's parenthetical) for explicitness. `PRD.md` is never touched.

### Success Criteria

- [ ] README L52 verified: "permission error → Left as written" holds for markdown transitive imports (fix complies).
- [ ] README L59 verified: "the same file-type rules … apply to each import unchanged" subsumes the L52 permission
      row (transitive parity is already implied; no footnote needed).
- [ ] README L82-84 (5 markdown rules) verified: none imply an unreadable import would be stripped.
- [ ] README L103-111 (bare-@) verified: "imports exactly like #@api.md" inherits the unreadable→verbatim behavior.
- [ ] The resizeImage-throw residual is NOT surfaced in the README (it is in the Step 3.5 code comment by S1).
- [ ] `node ./file-injector.test.mjs` → **122 passed, 0 failed** (unchanged).
- [ ] `git diff PRD.md` is **EMPTY** (read-only — never modified).
- [ ] `git diff README.md` is **EMPTY** (PRIMARY), OR a single 1-line L59 parenthetical tightening (OPTIONAL fallback).
- [ ] The decision (PRIMARY no-change OR the optional edit) is RECORDED in the task report with rationale.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact current README text at every relevant line (L52 table row, L58-59 paragraph,
L82-84 rules, L103-111 bare-@), the exact PRD cross-references the docs must match (§5.4/§10/§12.5/§12.16 — all
already correct), the verified final code+comment state (S1+S2 LANDED; suite 122/0; the Step 3.5 comment already
documents the resizeImage residual), the line-by-line consistency analysis (every relevant README statement checked
vs. the fix), the DECISION (PRIMARY = no edit, record; OPTIONAL = the exact one-line L59 tightening), the explicit
"do NOT surface the resizeImage residual in README" rule, the doc-surface inventory (README is the ONLY user-facing
doc; no docs/ dir, no CHANGELOG; PRD is read-only), and the gates (`git diff` constraints + the suite must stay
green). The implementer reads README.md + the relevant PRD sections + the Step 3.5 comment, runs the analysis, and
records the decision.

### Documentation & References

```yaml
# MUST READ — the bug being fixed (verbatim-on-error for unreadable markdown imports) + the fix's behavior table
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/code_changes_analysis.md
  why: "§'Fix site 1' gives the R_OK gate + the behavior-change table (ONLY 'exists + unreadable' flips stripped→
        verbatim; missing/dir/readable-text/md/binary/image-resize-OK all byte-for-byte unchanged). §'Image-resize-
        throw residual' is the documented-only residual (out of scope; backstopped by injectFile try/catch). Use this
        as the GROUND TRUTH the README must match."
  critical: "The fix introduces NO new user-facing behavior or config — it makes the code comply with EXISTING docs.
             So the sweep confirms consistency; it does not document something new."

# MUST READ — the root-cause data flow (why the markdown path strips eagerly; why the top-level path already worked)
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/architecture/system_context.md
  why: "§'Data flow through the bug site' explains the Step 3→3.5→4→5→6 ordering + the pre-order emit/strip asymmetry.
        Confirms the top-level path ALWAYS handled unreadable correctly (processTokenStream strips only on injectFile
        true); Issue 1 was markdown-path-only. So README's general table row was always TRUE for top-level; the fix
        makes it true for markdown imports too."

# MUST READ — the spec the docs must match (ALL of these ALREADY state the now-correct behavior; PRD is read-only)
- file: PRD.md
  why: "§10 row 'Read throws (permissions) | Caught; token left verbatim; other tokens still processed.' §5.4 'Missing /
        directory / read error' → verbatim, no block. §12.5 'Never throw out of the handler… on any error leave the
        token verbatim.' §12.16 'Failed/deduped/absolute/inside-code markers keep #@ verbatim everywhere.' These confirm
        the docs were ALWAYS correct and the code now matches — they are NOT edited (read-only)."
  section: "## 10 (Edge Cases — 'Read throws (permissions)' + bare-@ rows) + ## 5.4 + ## 12.5 + ## 12.16"

# THE FILE UNDER REVIEW (PRIMARY: read-only; OPTIONAL FALLBACK: one line at L59)
- file: README.md
  why: "The ONLY user-facing doc (~9.3 KB; no docs/ dir, no CHANGELOG). The sweep target. Relevant lines: L52 (the
        'What gets injected' table, 4th row 'Missing file, directory, or permission error → Left as written. Nothing
        is appended.'); L58-59 (markdown-import paragraph — 'The same file-type rules (text / image / binary / missing)
        apply to each import unchanged' — the OPTIONAL tightening site); L82-84 (the 5 markdown-import rules — none
        touch the error path); L103-111 (bare-@ imports — 'imports exactly like #@api.md')."
  pattern: "The L52 table is GENERAL (all injection contexts). L59 extends it to transitive imports via 'the same
            file-type rules apply to each import unchanged'. So the permission-verbatim guarantee already covers
            transitive imports by implication — this is why the PRIMARY outcome is 'no edit'."
  gotcha: "L59's parenthetical '(text / image / binary / missing)' ABBREVIATES the 4 table rows (the 4th 'Missing file,
           directory, or permission error' → 'missing'). It omits 'directory/permission' from the abbreviation. This is
           NOT inaccurate ('the same file-type rules apply unchanged' subsumes the full table), but it is the ONE place
           a tightening could make transitive permission-parity EXPLICIT (the OPTIONAL fallback)."

# The verified final code state (so the docs review is grounded in what the code actually does)
- file: file-injector.ts
  why: "injectMarkdown Step 3.5 (L848-856): R_OK gate LANDED (commit 342bd73). The Step 3.5 COMMENT (L837-854) already
        documents READABILITY gating + the ACCEPTED resizeImage-throw residual + TOCTOU. injectFile catch (S2, commit
        4d76d00): un-claims abs on failure (claim ⟺ delivered). So the code+comment state is FINAL; the README review
        confirms the docs describe THIS state. (You do NOT edit file-injector.ts in this task — it is read-only context.)"
  critical: "The resizeImage-throw residual is ALREADY documented in the Step 3.5 code comment (by S1). Item §3c: if a
             one-line note adds value, add it to the CODE COMMENT (already done), NOT the README. So do NOT surface it
             in README — surfacing an internal edge (resizeImage is contractually null-on-failure) would confuse the
             happy-path reader for no user benefit."

# The upstream verify task (P1.M2.T1.S1) — has NO doc surface; do NOT duplicate its work
- file: plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/P1M2T1S1/PRP.md
  why: "P1.M2.T1.S1 verifies the T2.S1-f test-isolation fix (Issue 2) — a TEST-HARNESS-ONLY item with no doc surface.
        Its anti-pattern list is explicit: 'No README/PRD/plan edits. (The bugfix plan's P1.M2.T2.S1 owns the Issue 1
        README/doc sweep — NOT this item.)' So THIS task owns the README sweep; the test-isolation item does not."
```

### Current Codebase tree

```bash
pi-file-injector/
├── README.md                # ← REVIEWED (PRIMARY: read-only; OPTIONAL FALLBACK: one line at L59)
├── PRD.md                   # ← READ-ONLY (NEVER modified by this or any task)
├── file-injector.ts         # ← READ-ONLY context (R_OK gate L848-856 + comment L837-854 LANDED; NOT edited here)
├── file-injector.test.mjs   # ← READ-ONLY (run as the regression guard; NOT edited here)
├── scripts/typecheck.mjs    # untouched
├── package.json             # untouched
└── plan/005_b7c78dbf73b1/bugfix/001_0aea8e8cbcc6/
    ├── architecture/{code_changes_analysis.md, system_context.md, test_harness_analysis.md}  # ground truth (internal)
    ├── P1M1T1S1/{research, PRP.md}   # LANDED (R_OK gate + comment + E5)
    ├── P1M1T1S2/{research, PRP.md}   # LANDED (un-claim + E6)
    ├── P1M2T1S1/{research, PRP.md}   # Issue 2 verify (no doc surface)
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
# PRIMARY path (expected): NO files touched. Read-only review + recorded decision + suite run.
README.md               # UNCHANGED (verified consistent — decision recorded, no edit)
PRD.md                  # UNCHANGED (read-only)

# OPTIONAL FALLBACK path (ONLY if the implementer judges L59 explicitness adds value):
README.md               # MODIFIED — ONE line: L59 parenthetical tightened to name the permission/unreadable case
                        #           for transitive parity (exact before/after in Implementation Tasks Task 4).
PRD.md                  # UNCHANGED (read-only under either branch)
# file-injector.ts / file-injector.test.mjs are NEVER edited under either branch.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — this is a VERIFICATION + DECISION task. The bugfix changed CODE, not docs: the README (L52) and PRD
     (§5.4/§10/§12.5/§12.16) ALWAYS stated the now-correct "permission error → Left as written" behavior. The fix
     brings the markdown-import path INTO compliance. So the EXPECTED outcome is NO README edit — record the decision.
     Edit ONLY if the L59 parenthetical's omission of the permission case is judged worth making explicit. -->

<!-- CRITICAL — PRD.md is READ-ONLY. NEVER modify PRD.md (this task or any task). `git diff PRD.md` MUST be empty. -->

<!-- CRITICAL — do NOT surface the resizeImage-throw residual in README. It is an internal edge (resizeImage is
     contractually null-on-failure; a throw is an unexpected internal error, not a normal user workflow). It is
     ALREADY documented in the Step 3.5 code comment (file-injector.ts L848-854, by S1). Item §3c: if a one-line
     note adds value, it goes in the CODE COMMENT (already done), NOT the README. Surfacing it would confuse the
     happy-path reader for no user benefit. -->

<!-- GOTCHA — README is the ONLY user-facing doc. There is NO docs/ directory and NO CHANGELOG (verified by ls).
     The plan's architecture/*.md files are INTERNAL PLANNING artifacts (already accurate; owned by the plan; not
     user-facing; no sweep needed). So "README.md + overview docs" reduces to README.md (+ the read-only PRD cross-
     references). Do not invent docs to sweep. -->

<!-- GOTCHA — a docs task must NOT break the suite. `node ./file-injector.test.mjs` must stay 122 passed, 0 failed.
     If it regresses, you accidentally edited a code/test file — revert it (this task touches ONLY README.md, and
     only in the OPTIONAL fallback). -->

<!-- GOTCHA — the L59 parenthetical '(text / image / binary / missing)' is an ABBREVIATION, not an exhaustive list.
     'The same file-type rules apply to each import unchanged' is the load-bearing clause — it subsumes the full L52
     table (including 'Missing file, directory, or permission error'). So L59 is NOT inaccurate; tightening it is
     purely an explicitness/cosmetic choice. Do not over-edit (the item contract says "make the minimal edit"). -->

<!-- GOTCHA — if you apply the OPTIONAL L59 tightening, keep it to ONE line and mirror the table's own wording
     ('Missing file, directory, or permission error') so the parenthetical + the table row stay in lockstep. Do not
     restructure the paragraph, add a footnote, or touch L82-84/L103-111 (those are verified correct as-is). -->
```

## Implementation Blueprint

### Data models and structure

None. This is a documentation review. There is no data model, no code, no test change in the PRIMARY path. The
OPTIONAL fallback is a single-line string edit to README.md L59.

### The README line-by-line consistency analysis (encode as the review the implementer performs)

Read README.md in full, then confirm EACH relevant statement against the fixed code + PRD. This is the substance of
the task — the analysis that supports the decision:

| README line | Statement | vs. fixed code + PRD | Verdict |
|---|---|---|---|
| **L52** (table, 4th row) | "Missing file, directory, or permission error → Left as written. Nothing is appended." | The fix makes the markdown-import UNREADABLE case COMPLY (was stripped → now verbatim). Table is general (all contexts). PRD §10 "Read throws (permissions) → Caught; token left verbatim"; §5.4; §12.5; §12.16 all agree. | ✓ CORRECT. No footnote needed. |
| **L58-59** (markdown paragraph) | "The same file-type rules (text / image / binary / missing) apply to each import unchanged." | "The same file-type rules apply unchanged" SUBSUMES the full L52 table (incl. the permission row). So transitive imports inherit the permission-verbatim guarantee. The parenthetical abbreviates the 4th row to "missing". | ✓ NOT inaccurate (subsumed). OPTIONAL tightening site (L59 parenthetical). |
| **L82-84** (5 markdown rules) | Relative-only / extension shorthand / code-exempt / dedup / shared budget. | NONE describe or imply the error/permission path. They cover matching + resolution + dedup + budget. The "verbatim on error" behavior is covered by L52+L59, which the rules don't contradict. | ✓ No rule implies stripping-on-error. |
| **L103** (bare-@) | "a bare @api.md … imports exactly like #@api.md: relative-only paths, extension shorthand, code-exempt, deduped … and drawing on the same shared budget." | "imports exactly like #@api.md" INHERITS all #@ error behavior (incl. unreadable → verbatim). | ✓ No inaccuracy (inherits the error behavior). |
| **L111** (Limits) | "Markdown imports are relative-only." / "Only markdown is scanned." / "Bare-@ imports stay inside markdown." | NONE describe the error path. | ✓ No inaccuracy. |

**Cross-check vs. PRD (all ALREADY correct; read-only):** §10 "Read throws (permissions) → Caught; token left
verbatim"; §5.4 "Missing / directory / read error" → verbatim; §12.5 "on any error leave the token verbatim";
§12.16 "Failed/deduped/absolute/inside-code markers keep `#@` verbatim everywhere." The README matches these.

**Cross-check vs. the resizeImage residual:** the Step 3.5 code comment (file-injector.ts L848-854, by S1) already
documents it ("ACCEPTED NARROW RESIDUAL: a READABLE image whose resizeImage THROWS … still gets stripped … out of
scope … backstopped by injectFile's own try/catch"). The README must NOT mention it (internal; see Known Gotchas).

### Implementation Tasks (ordered — PRIMARY path is review-only)

```yaml
Task 1 (PRIMARY — REVIEW, read-only): read README.md in full + run the line-by-line analysis
  - READ: README.md (whole file, ~9.3 KB). Note the relevant lines: L52 table row; L58-59 paragraph; L82-84 rules; L103-111 bare-@.
  - RUN the line-by-line consistency analysis (the table above) against the fixed code + PRD §5.4/§10/§12.5/§12.16.
  - EXPECT (per the analysis): every relevant statement PASSES — the README already describes the now-correct behavior.
    L52 "permission error → Left as written" now holds for markdown transitive imports too (the fix complies). L59
    "the same file-type rules apply to each import unchanged" subsumes the permission row. No rule implies stripping-on-error.
  - DO NOT edit anything in Task 1. This is read-only confirmation.

Task 2 (PRIMARY — CONFIRM the resizeImage residual is NOT a README concern)
  - READ: file-injector.ts Step 3.5 comment (L837-854) — confirm it already documents the resizeImage-throw residual
    ("ACCEPTED NARROW RESIDUAL … out of scope … backstopped by injectFile's own try/catch").
  - DECIDE: per item §3c, do NOT surface the residual in README (it is an internal edge; resizeImage is contractually
    null-on-failure; surfacing would confuse the happy-path reader). The one-line note already lives in the CODE COMMENT.
  - This is a DECISION, not an edit. Record it: "resizeImage-throw residual — NOT surfaced in README (internal; already
    documented in the Step 3.5 code comment by S1)."

Task 3 (PRIMARY — RUN the suite as a regression guard + confirm no code/test edit)
  - RUN: node ./file-injector.test.mjs → EXPECT "Result: 122 passed, 0 failed.", exit 0.
    (A docs task must not break the suite. 122 = baseline + E5 (R_OK) + E6 (un-claim).)
  - RUN: git diff --stat README.md → EXPECT EMPTY (PRIMARY: no edit). (If Task 4 applied the fallback, this is the 1-line edit.)
  - RUN: git diff --stat PRD.md → EXPECT EMPTY (read-only; NEVER modified).
  - RUN: git diff --stat file-injector.ts file-injector.test.mjs → EXPECT EMPTY (this task touches neither).

Task 4 (OPTIONAL FALLBACK — apply the L59 tightening; ONLY if Task 1 judges explicitness adds value):
  - TRIGGER: the implementer reviews L59's parenthetical '(text / image / binary / missing)' and JUDGES that making
    the transitive permission-parity EXPLICIT helps a reader (it is NOT a correctness fix — L59 is already accurate).
    If they judge "the subsumption is clear enough," SKIP Task 4 (PRIMARY outcome = no edit).
  - EDIT README.md L59 — the MINIMAL tightening. Keep it ONE line; mirror the table's own wording. Exact before/after:
      BEFORE (current L59):
        "… The same file-type rules (text / image / binary / missing) apply to each import unchanged."
      AFTER (tightened — names the permission case for transitive parity):
        "… The same file-type rules (text / image / binary / missing or unreadable) apply to each import unchanged."
    (Rationale: "missing or unreadable" mirrors the L52 table row "Missing file, directory, or permission error" and
     makes explicit that an import whose target is unreadable is left verbatim — the exact behavior Issue 1 restored.)
  - DO NOT restructure the paragraph, add a footnote, or touch L52/L82-84/L103-111 (verified correct as-is).
  - DO NOT edit PRD.md (read-only). DO NOT edit file-injector.ts / file-injector.test.mjs.
  - RE-RUN Task 3 gates: suite still 122/0; git diff README.md = the ONE line; git diff PRD.md = empty.

Task 5 (REPORT — RECORD the decision): the deliverable is the recorded decision
  - Report: (a) the line-by-line analysis outcome (all relevant README statements PASS); (b) which path ran
            (PRIMARY no-edit, or OPTIONAL L59 tightening applied — quote the exact before/after if the latter);
            (c) the resizeImage-residual decision (NOT surfaced in README — in the code comment); (d) the suite Result
            line (122 passed, 0 failed); (e) git diff README.md / PRD.md / file-injector.ts / file-injector.test.mjs status.
```

### Implementation Patterns & Key Details

```markdown
<!-- The PRIMARY decision-record text (use this verbatim if no edit is applied):
     "README.md is CONSISTENT with the verbatim-on-error fix. No edit needed.
      - L52 ('Missing file, directory, or permission error → Left as written. Nothing is appended.') holds for
        markdown transitive imports too — the R_OK fix (P1.M1.T1.S1) makes the code comply.
      - L59 ('the same file-type rules … apply to each import unchanged') subsumes the L52 permission row, so
        transitive parity is already implied.
      - L82-84 (5 rules) and L103-111 (bare-@) imply nothing that contradicts 'unreadable import → verbatim'.
      - The resizeImage-throw residual is NOT surfaced in README (internal; already in the Step 3.5 code comment).
      PRD.md untouched (read-only). Suite: 122 passed, 0 failed." -->

<!-- If the OPTIONAL L59 tightening IS applied, append to the decision-record:
     "Applied a one-line tightening at README.md L59: '(text / image / binary / missing)' → '(text / image / binary /
      missing or unreadable)' to make the transitive permission-parity explicit (mirrors the L52 table row). No other
      README/PRD/code change." -->
```

### Integration Points

```yaml
FILE_EDITS:
  - PRIMARY path: NONE (read-only review + recorded decision + suite run; README verified consistent).
  - OPTIONAL FALLBACK path (ONLY if L59 explicitness is judged valuable): README.md L59 — parenthetical
    '(text / image / binary / missing)' → '(text / image / binary / missing or unreadable)' (ONE line; minimal).

NO_CHANGES (either path): PRD.md (READ-ONLY — never modified), file-injector.ts (R_OK gate + comment LANDED; not
  edited here), file-injector.test.mjs (NOT edited here), package.json, scripts/typecheck.mjs, all plan/ files,
  README.md lines OTHER than L59 (in the fallback).

NO_NEW_BEHAVIOR: the bugfix introduces no new user-facing behavior or config — it makes the code match existing docs.
  So this task confirms consistency; it does not document something new.
```

## Validation Loop

### Level 1: The suite run (the regression guard — a docs task must not break it)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 122 passed, 0 failed.", exit 0. (122 = baseline + E5 R_OK + E6 un-claim; T2.S1-f isolated.)
# If this regresses, you accidentally edited a code/test file — revert it (this task touches ONLY README.md, and
# only in the OPTIONAL fallback). The suite is the proof the docs task broke nothing.
```

### Level 2: The README review checks (read-only)

```bash
cd /home/dustin/projects/pi-file-injector
# (a) The L52 table row is present and unchanged (the load-bearing verbatim-on-error guarantee):
grep -n "Missing file, directory, or permission error" README.md
# Expected: README.md:52 (the table row). ONE hit. Unchanged.

# (b) The L59 markdown-import "same rules" clause (subsumes the permission row; OPTIONAL tightening site):
grep -n "The same file-type rules" README.md
# Expected: README.md:59. (PRIMARY: reads '(text / image / binary / missing)'; FALLBACK: '(text / image / binary / missing or unreadable)'.)

# (c) Confirm NO README mention of the resizeImage residual (it stays in the code comment, not the docs):
grep -niE "resizeImage|resize" README.md || echo "OK: README does not mention resizeImage (correct — internal detail)"
# Expected: "OK: README does not mention resizeImage …" (the residual is in file-injector.ts L848-854, NOT README).

# (d) Confirm the Step 3.5 code comment DOES document the residual (so it is not lost):
grep -n "ACCEPTED NARROW RESIDUAL" file-injector.ts
# Expected: file-injector.ts:<~850> (the comment S1 added). Confirms the residual is documented WHERE it belongs.
```

### Level 3: The diff constraints (the gate on what changed)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat README.md
# Expected (PRIMARY): EMPTY (no edit). (FALLBACK: README.md | 2 +- — ONE line changed.)

git diff --stat PRD.md
# Expected: EMPTY — ALWAYS (PRD is read-only; never modified by this or any task).

git diff --stat file-injector.ts file-injector.test.mjs
# Expected: EMPTY — ALWAYS (this task touches neither).

git diff README.md | head -40   # (only meaningful in the FALLBACK; verify the change is exactly the L59 parenthetical)
# Expected (FALLBACK): a single -/+ pair on the L59 parenthetical; nothing else.
```

### Level 4: PRD cross-reference confirmation (the spec the docs match — read-only)

```bash
cd /home/dustin/projects/pi-file-injector
# Confirm the PRD sections the README must match all already state the now-correct behavior (read-only; NOT edited):
grep -n "Read throws (permissions)" PRD.md                  # §10 — "Caught; token left verbatim"
grep -n "leave the token verbatim" PRD.md                   # §12.5 — "on any error leave the token verbatim"
grep -n "keep \`#@\` verbatim everywhere\|keep \`#@\` verbatim\|keep #@" PRD.md   # §12.16 — failed markers verbatim
# Expected: hits in §10 / §12.5 / §12.16. These confirm the docs were ALWAYS correct and the code now matches —
# they are NOT edited (PRD read-only). This is the cross-reference that grounds the "no README change needed" decision.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → **122 passed, 0 failed**, exit 0 (a docs task broke nothing).
- [ ] `git diff --stat PRD.md` is **EMPTY** (read-only — never modified).
- [ ] `git diff --stat file-injector.ts file-injector.test.mjs` is **EMPTY** (this task touches neither).
- [ ] `git diff --stat README.md` is **EMPTY** (PRIMARY), OR a single 1-line L59 change (OPTIONAL fallback).

### Feature Validation (the consistency the task confirms)

- [ ] README L52 "permission error → Left as written" verified to hold for markdown transitive imports (fix complies).
- [ ] README L59 "the same file-type rules apply to each import unchanged" verified to subsume the L52 permission row.
- [ ] README L82-84 (5 rules) verified — none imply an unreadable import would be stripped.
- [ ] README L103-111 (bare-@) verified — "imports exactly like #@api.md" inherits the unreadable→verbatim behavior.
- [ ] The resizeImage-throw residual is NOT surfaced in README (internal; in the Step 3.5 code comment).

### Code Quality Validation

- [ ] (PRIMARY) no file edited — the decision is RECORDED with rationale.
- [ ] (FALLBACK) the L59 edit is ONE line, minimal, mirrors the L52 table wording, and touches nothing else.
- [ ] No PRD edit (read-only). No code/test edit. No restructuring, no footnote, no new section.

### Documentation & Deployment

- [ ] The decision (no-change vs. the optional edit) is RECORDED in the task report with the line-by-line rationale.
- [ ] If the FALLBACK was applied, the exact before/after is recorded so a future maintainer can audit the tightening.
- [ ] The resizeImage-residual decision (NOT in README; in code comment) is recorded.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT modify PRD.md.** It is READ-ONLY (owned by humans). `git diff PRD.md` MUST be empty. The PRD sections
  (§5.4/§10/§12.5/§12.16) already state the correct behavior — you cross-REFERENCE them, you do not edit them.
- ❌ **Do NOT surface the resizeImage-throw residual in README.** It is an internal edge (resizeImage is contractually
  null-on-failure; a throw is unexpected, not a user workflow). It is ALREADY in the Step 3.5 code comment (S1).
  Item §3c: the note belongs in the CODE COMMENT (done), NOT the README. Surfacing it would confuse happy-path readers.
- ❌ **Do NOT invent docs to sweep.** README.md is the ONLY user-facing doc (no `docs/` dir, no CHANGELOG — verified).
  The plan's architecture/*.md are internal planning artifacts (already accurate; not user-facing). "README + overview
  docs" reduces to README.md + the read-only PRD cross-references.
- ❌ **Do NOT over-edit README in the fallback.** The OPTIONAL L59 tightening is ONE line (the parenthetical). Do not
  restructure the paragraph, add a footnote, or touch L52/L82-84/L103-111 (all verified correct as-is). "Make the
  minimal edit" (item contract).
- ❌ **Do NOT treat this as "document new behavior."** The bugfix introduces NO new user-facing behavior or config —
  it makes the code comply with EXISTING docs. So the task CONFIRMS consistency; the expected outcome is NO edit.
- ❌ **Do NOT edit file-injector.ts or file-injector.test.mjs.** This is a docs task. The R_OK gate, the un-claim, the
  Step 3.5 comment, E5, E6, and T2.S1-f are all LANDED. You only review README.md against them.
- ❌ **Do NOT break the suite.** `node ./file-injector.test.mjs` must stay 122 passed, 0 failed. If it regresses, you
  edited a code/test file by mistake — revert it.
- ❌ **Do NOT duplicate P1.M2.T1.S1's work.** That task verifies the T2.S1-f test-isolation (Issue 2) and has NO doc
  surface (its PRP is explicit: "No README/PRD/plan edits"). This task owns the Issue 1 README sweep only.

---

## Confidence Score: 10/10

This is a verification + decision task and the outcome is already established by the analysis: the bugfix changed
CODE, not docs — README L52 ("permission error → Left as written"), L59 ("the same file-type rules apply to each
import unchanged"), and the L82-84/L103-111 rules ALL already describe the now-correct behavior, and the PRD
§5.4/§10/§12.5/§12.16 cross-references confirm the docs were ALWAYS correct. The fix (S1 R_OK gate, LANDED commit
342bd73; S2 un-claim, LANDED commit 4d76d00) makes the markdown-import path COMPLY. The resizeImage residual is
already documented in the Step 3.5 code comment (file-injector.ts L848-854, by S1), so it correctly stays out of
the README. The PRIMARY path is read-only (review + record decision + suite run at 122/0); the OPTIONAL fallback
is a single, precisely-specified L59 parenthetical tightening. README is the only user-facing doc (no docs/ dir,
no CHANGELOG); PRD is read-only. The only judgment call is PRIMARY-vs-fallback, which the PRP resolves with a clear
recommendation (PRIMARY = no edit; the L59 subsumption is clear enough) and an exact fallback spec. The implementing
agent reads README + the relevant PRD sections + the Step 3.5 comment, runs the analysis, records the decision, and
runs the suite + git-diff gates.
