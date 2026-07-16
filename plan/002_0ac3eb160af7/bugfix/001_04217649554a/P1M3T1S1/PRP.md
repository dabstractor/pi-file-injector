---
name: "P1.M3.T1.S1 (Bugfix Docs) — Review & reconcile README.md against the corrected #@file behavior (Issues 1–4)"
prd_ref: "Bug-fix PRD §Overview, §Testing Summary (changeset-level documentation sync — Mode B)"
target_file: "./README.md ONLY (review the whole file; the single candidate edit is the trigger-stripping sentence in § Usage, line ~31)"
change_type: REVIEW-and-RECONCILE documentation task. RECOMMENDED outcome: NO EDIT (README already accurate). OPTIONAL outcome: one minimal precision clause on the L31 strip sentence. No other file. No .ts. No .test.mjs. No invented mechanics.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "All four fixes are LIVE in file-injector.ts (verified): Issue 1 dedup (injectedThisRun), Issue 2 index-splice strip (L200/L234/L276/L297-298), Issue 3 notify wording, Issue 4 paged directive offset:2001 (L123-129). Harness baseline 49/0. This task only documents; no code dependency to land."
fixes: "Closes the changeset-level documentation-sync requirement (Bug-fix PRD §Overview final task; SOW Mode B). Anticipated resolution: confirm README is consistent with shipped behavior (it is) and make the minimal/no edit."
scope_boundary: "Touches README.md ONLY. Does NOT touch file-injector.ts or file-injector.test.mjs (all four fixes are LIVE and harness-pinned; editing them collides with closed Issues 1–3 and the in-progress Issue 4 P1.M2.T2.S1). Does NOT invent dedup/notify/offset mechanics (Issues 1/3/4 are invisible to the README — never quoted/mentioned)."
---

# PRP — P1.M3.T1.S1 (Bugfix Docs): README sync for corrected `#@file` behavior

## Goal

**Feature Goal**: Review `README.md` against the four shipped bug fixes (Issues 1–4) and reconcile it
so it makes **no stale claim**. The contract anticipates the README is **already accurate**: three of
the four fixes (dedup, notify wording, paged-directive offset) are internal mechanics or model-facing
strings the README never described; the fourth (failed-token `#@` stripping) is already covered by
the README's behavior table ("Left as written"). So the expected outcome is a **documented
no-edit** — OR a single optional precision clause on the trigger-stripping sentence if the
implementer judges it reads naturally and does not over-document.

**Deliverable**: ONE of two outcomes, decided by the implementer after the review:
- **(Recommended) NO EDIT** — README.md unchanged. The review finding (README is accurate) is noted in
  the task's implementation report / commit message. Satisfies the contract's "If upon review
  README.md is already accurate, make the minimal/no edit and note that in the PRP."
- **(Optional) ONE minimal clause** on the L31 trigger-stripping sentence (qualify "each reference" →
  "each reference that resolves" + a short follow-on for non-resolving tokens), ONLY if it reads
  naturally and does not merely restate the existing L44 table row.

**No other file is modified. No `.ts`. No `.test.mjs`. No PRD/tasks.json.**

**Success Definition**:
- [ ] Review completed: every README claim checked against shipped behavior; none is stale.
- [ ] `git diff --name-only` shows ONLY `README.md` — OR nothing (if the no-edit path is taken).
- [ ] If the optional clause is added: L31 now precisely says `#@` is stripped only from references
      that resolve; the failed-token follow-on reads naturally and does not duplicate L44.
- [ ] If the no-edit path is taken: README.md is byte-identical to baseline; the review finding is
      documented (commit message / task notes).
- [ ] NO invented mechanics leaked into README: grep confirms no "dedup"/"duplicate"/"offset:2001"/
      "N whole"/"notify" prose was added (those are internal/model-facing, out of scope).
- [ ] The paged-delivery paragraphs (L9, L41, L72) are UNCHANGED (they remain accurate).
- [ ] `node ./file-injector.test.mjs` still reports **49 passed, 0 failed** (defensive — this task
      must not touch source/tests; if it fails, something went out of scope).

> **Scope boundary (read carefully):** This task reviews `README.md` and (at most) edits ONE sentence
> in § Usage (L31). It does **NOT**: (a) touch `file-injector.ts` or `file-injector.test.mjs` — all
> four fixes are LIVE and harness-pinned (49/0); editing them collides with the closed Issues 1–3 and
> the in-progress Issue 4 (P1.M2.T2.S1); (b) add prose about dedup (Issue 1 — internal mechanic),
> the notify wording (Issue 3 — internal), or the paged directive's `offset:2001` (Issue 4 — a
> model-facing string the README never quoted) — the contract explicitly forbids inventing these;
> (c) change the paged-delivery paragraphs (L9/L41/L72), the image-bytes/empty-image note (L54), the
> Syntax section, the Limits section, or the `#@` vs `@` section — all remain accurate; (d) restructure
> the README (keep its tone, headings, table, and section order).

## User Persona

**Target User**: Anyone reading README.md to understand `#@file`'s behavior after the bug fixes — and
the maintainer who needs the README to not contradict the shipped code. The review's job is to
GUARANTEE no reader is misled by a stale claim (e.g., that `#@` is stripped from a missing-file
token, or that paged delivery re-reads the head).

**Use Case**: A user writes `Review #@a.ts and check #@missing.md` and reads README § Usage to learn
what reaches the model. After Issue 2, the injected `a.ts` loses `#@` (`Review a.ts`) while the
failed `#@missing.md` keeps `#@` verbatim. README L31's success example is still correct, and the
L44 table row already says missing/directory tokens are "Left as written" — so a careful reader is
not misled. The review confirms this; the optional clause makes the L31 sentence itself precise.

**Pain Points Addressed**: A README that drifts from shipped behavior erodes trust and generates
false bug reports. This task closes the changeset-level doc gap by verifying (and, optionally,
sharpening) the one README-visible claim touched by the fixes.

## Why

- **The contract anticipates the README is already accurate** (item description: "If upon review
  README.md is already accurate, make the minimal/no edit and note that in the PRP"). The research
  confirms this: Issues 1/3/4 are invisible to the README (internal mechanics / model-facing strings
  never quoted), and Issue 2's only documented strip example is a success case that remains correct —
  with the failed-token case already in the L44 table.
- **A documented review IS the deliverable** for changeset-level docs (SOW Mode B). Confirming "no
  stale claim" with evidence is a real outcome, not a non-task: it prevents future drift and records
  that the fixes were checked against the user-facing docs.
- **Minimal edit = minimal risk.** The four fixes shipped with their own harness regression tests
  (F2 updated; FS1/FS2/FS3 added; PD1 hardcoded pin). The README is the last user-facing surface;
  a no-edit (or a one-clause precision tweak) cannot regress behavior and cannot break the harness.

## What

A two-part review, then a decision:

1. **Review** README.md against shipped behavior for the four fixes (see "All Needed Context" for the
   per-fix visibility table). Confirm: (i) the L31 strip sentence is still accurate for the success
   case (it is); (ii) the paged-delivery paragraphs (L9/L41/L72) need no change (they don't).
2. **Decide** no-edit (recommended) vs the optional one-clause precision tweak (L31), using the
   criterion: add the clause ONLY if it reads naturally and does not merely restate the L44 table.

The exact optional edit (oldText/newText) is given verbatim in **Implementation Blueprint → Exact
source to write** below. The no-edit path requires only documenting the finding.

### Success Criteria
- [ ] Review finding recorded (README accurate; per-fix visibility confirmed).
- [ ] Either README unchanged (no-edit) OR L31 edited exactly as specified (optional); nothing else.
- [ ] `git diff --name-only` ⊆ {README.md}; if edited, `git diff README.md` confined to L31.
- [ ] No invented-mechanics prose (grep guard).
- [ ] `node ./file-injector.test.mjs` → 49/0.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: (1) the per-fix README-visibility analysis (which fixes
> are invisible vs which touches README), with grep-confirmed evidence; (2) the line-by-line README
> accuracy audit (L31, L9/L41/L72, L54 — all confirmed still accurate); (3) the exact optional edit
> (byte-verbatim oldText/newText for L31, with the em dash / apostrophe conventions noted); (4) the
> decision criterion (no-edit recommended; add the clause only if it reads naturally and doesn't
> restate L44); (5) the explicit scope boundaries so the implementer does not invent mechanics or
> touch source/tests; and (6) the 49/0 harness baseline. No model, no API key, no build — it is a
> documentation review with at most one sentence edit.

### Documentation & References
```yaml
# MUST READ — this task's verified research (per-fix visibility + line-by-line audit)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M3T1S1/research/research_notes.md
  why: "§2 the per-fix README-visibility table (Issues 1/3/4 invisible; only Issue 2 touches README
        and its only example is a success case). §3 the line-by-line accuracy audit (L31 accurate;
        L9/L41/L72 unchanged; L54 out of scope). §4 the no-edit-vs-optional decision. §5 the scope
        boundaries (no source/test edits; no invented mechanics)."
  critical: "The README is ALREADY accurate. The recommended outcome is NO EDIT. The optional L31
        clause is genuinely optional and risks minor redundancy with the L44 table row ('Missing file,
        directory, or permission error | Left as written'). Default to no-edit unless the clause
        reads naturally. Do NOT add dedup/notify/offset prose (Issues 1/3/4 are invisible to README)."

# MUST READ — the changeset-level doc requirement + the per-fix analysis
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/code_changes_analysis.md
  why: "§'Cross-cutting: Documentation (per SOW §5)' explicitly states: none of the four fixes
        changes user-facing config/CLI/env/exports; the notify wording (Issue 3) and paged directive
        string (Issue 4) are NOT quoted in README; so NO per-subtask doc update was required (Mode A).
        THIS task (Mode B) reviews README to ensure the paged-delivery paragraph (~L41) and the
        trigger-stripping note (~L31) still align. Confirms the 'minimal/no edit' expectation."
  section: "Cross-cutting: Documentation (per SOW §5)"

# MUST READ — the four fixes' contracts (what shipped; treat as the behavior source of truth)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M1.T1.S1/PRP.md
  why: "Issue 1 (dedup) contract — INTERNAL mechanic. Confirms it is not README-visible (the README
        never describes dedup)."
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M1.T1.S2/PRP.md
  why: "Issue 2 (index-splice strip) contract — the ONLY fix that touches README-visible behavior.
        Confirms: only successfully-injected tokens lose #@; failed (missing/dir/error) and deduped
        repeats keep #@ verbatim. The README L31 success example remains correct; the L44 table
        already covers the failed case. FS1/FS2/FS3 pin this."
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2.T1.S1/PRP.md
  why: "Issue 3 (notify wording) contract — INTERNAL. README never quotes the notify message."
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2.T2.S1/PRP.md
  why: "Issue 4 (paged directive offset:0→offset:2001) contract — MODEL-FACING string. README never
        quotes the directive string; the paged paragraphs (L9/L41/L72) describe 'head block plus a
        paging directive' which is still true."

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/prd_snapshot.md
  why: "Bug-fix PRD §Overview + §Testing Summary frame this as the changeset-level docs task."
  section: "§Overview, §Testing Summary"

# The file under REVIEW (edit ONLY L31, and only on the optional path)
- file: ./README.md
  why: "The user-facing docs. The single candidate edit is the trigger-stripping sentence in § Usage
        (L31). The paged-delivery paragraphs (L9/L41/L72), the image note (L54), Syntax, Limits, and
        '#@ vs @' are all reviewed and confirmed accurate — UNCHANGED."
  pattern: "Terse, plain-prose voice; backticks around tokens/paths; em dash (U+2014 —) and curly
            apostrophe (') are NOT used (README uses plain ASCII hyphen '-' and straight apostrophe
            '). Match this if editing L31 — see the Exact source gotcha."
  gotcha: "Do NOT edit anything except L31 (and only on the optional path). Do NOT add mechanics.
           Do NOT touch source/tests. The 49/0 harness must still pass after this task."

# The shipped source (READ for accuracy verification — DO NOT EDIT)
- file: ./file-injector.ts
  why: "Confirms shipped behavior. Issue 1: injectedThisRun (L192/L205). Issue 2: injectedIndexes
        (L200), push at L234+L276, index-splice at L297-298 (only injected tokens lose #@). Issue 4:
        formatPagedDirectiveBlock returns 'offset:2001, limit:2000' (L129) — a model-facing string the
        README does not quote. HEAD_BYTES=8192 (L22) and the byte head block are unchanged (so L72's
        'first ~8 KB' is still accurate)."
  pattern: "Read-only reference. Grep-verified: 'injectedIndexes' / 'strippedText.slice' / 'offset:2001'
            are all LIVE. The blanket strip ('text.replace(FILE_INJECT_RE, ...)') is GONE."
  gotcha: "Do NOT edit this file. All four fixes are LIVE and harness-pinned (49/0). Editing it
           collides with the closed Issues 1–3 and the in-progress Issue 4 (P1.M2.T2.S1)."
```

### Per-fix README-visibility table (the core analysis — drives the no-edit conclusion)
```yaml
Issue 1 (within-prompt dedup):        INTERNAL mechanic.   README never mentions dedup.  → NOT documented (forbidden).
Issue 2 (failed-token #@ stripping):  README-VISIBLE (partial). L31 strip EXAMPLE is a success case — still correct.
                                                          L44 table already says failed tokens are "Left as written".
                                                          → OPTIONAL precision clause on L31 (or no edit).
Issue 3 (notify wording):             INTERNAL.            README never quotes the notify message. → NOT documented.
Issue 4 (paged directive offset):     MODEL-FACING string. README never quotes "offset:". L9/L41/L72 stay accurate. → NOT documented.
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-auto-reader
.
├── README.md                    # ← REVIEW (edit L31 ONLY on the optional path; else unchanged)
├── file-injector.ts             # READ-ONLY (all 4 fixes LIVE). DO NOT EDIT.
├── file-injector.test.mjs       # READ-ONLY (49/0 harness). DO NOT EDIT.
├── PRD.md                       # READ-ONLY (owned by humans)
├── package.json                 # untouched
└── plan/002_0ac3eb160af7/bugfix/001_04217649554a/
    ├── architecture/{code_changes_analysis.md, external_deps.md, system_context.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json
    ├── P1M1T1S1/{PRP.md, research/}     # Issue 1 dedup — DONE (in file)
    ├── P1M1T1S2/{PRP.md, research/}     # Issue 2 strip — DONE (in file)
    ├── P1M2T1S1/{PRP.md, research/}     # Issue 3 notify wording — DONE (in file)
    ├── P1M2T2S1/{PRP.md, research/}     # Issue 4 paged offset:2001 — DONE (in file)
    └── P1M3T1S1/
        ├── research/research_notes.md   # THIS TASK's research (per-fix visibility + audit)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
└── README.md                    # UNCHANGED (no-edit path) OR L31 precision clause (optional path).
# No new files. No .ts / .test.mjs / PRD / tasks.json changes.
```

### Known Gotchas of our codebase & Library Quirks
```markdown
<!-- CRITICAL — the README is ALREADY accurate. The recommended outcome is NO EDIT. Do not "find" an
     edit just to make a change; the contract explicitly allows the minimal/no-edit outcome and asks
     that it be NOTED. Three of the four fixes (dedup, notify, paged offset) are invisible to the
     README; the fourth (strip) has its only documented example as a success case that is still
     correct, with the failed case already in the L44 table. -->

<!-- CRITICAL — do NOT invent mechanics. The contract forbids adding dedup details (Issue 1), notify
     wording (Issue 3), the offset:2001 directive (Issue 4), or any other internal detail the user
     cannot observe. Grep-guard: after the task, README.md must contain NONE of: 'dedup', 'duplicate',
     'offset:2001', 'offset:0', 'N whole', 'injected N'. (These belong to the source/tests, not the
     user-facing README.) -->

<!-- GOTCHA — README punctuation conventions (relevant ONLY if taking the optional L31 edit). The
     README uses a PLAIN ASCII hyphen '-' (not the em dash U+2014 '—') and a STRAIGHT apostrophe "'"
     (not a curly one). It does NOT use the '—' em dash that the source/test files use. Match the
     README's ASCII style in any edit; do not import the em-dash convention from the .ts/.test.mjs. -->

<!-- GOTCHA — L31's only example ('Review #@a.ts' → 'Review a.ts') is a SUCCESS case. It is still
     correct after Issue 2. The optional clause's job is to PRECISELY qualify 'each reference' (only
     resolving references are stripped), NOT to change the success example. Do not alter the example. -->

<!-- GOTCHA — the L44 table row already says: 'Missing file, directory, or permission error | Left as
     written. Nothing is appended.' So the failed-token verbatim behavior is ALREADY documented. The
     optional L31 clause risks restating this; the decision criterion explicitly weighs this redundancy. -->

<!-- GOTCHA — the paged-delivery paragraphs (L9/L41/L72) describe 'head block plus a paging directive'
     and (L72) 'first ~8 KB'. Issue 4 changed only the directive's OFFSET (a model-facing string the
     README never quotes); HEAD_BYTES=8192 and the byte head are unchanged. So these paragraphs are
     STILL ACCURATE — do NOT edit them. -->

<!-- IDEMPOTENCY — if L31 already says 'each reference that resolves' (a prior pass took the optional
     path), the oldText anchor below will not match; re-read L31, confirm it, and STOP (task done). -->
```

## Implementation Blueprint

### Data models and structure
None. Pure markdown prose review + at most one sentence edit. No code, types, or data structures.

### Implementation Tasks (ordered by dependencies)
```yaml
PRE-FLIGHT (the REVIEW):
  - RECORD the harness baseline (defensive — this task must not break it):
      node ./file-injector.test.mjs        # → "Result: 49 passed, 0 failed." exit 0
  - CONFIRM all four fixes are LIVE in the source (so the README is being reconciled against the
    SHIPPED behavior, not a stale copy):
      grep -c 'injectedThisRun' file-injector.ts                  # Issue 1 — expect >= 4
      grep -c 'injectedIndexes' file-injector.ts                  # Issue 2 — expect >= 4
      grep -q 'strippedText.slice(0, i) + strippedText.slice(i + 2)' file-injector.ts   # Issue 2 splice
      grep -q 'offset:2001, limit:2000' file-injector.ts          # Issue 4 — expect match
    (If any of these is ABSENT, the dependency is NOT live — STOP and flag it; do not reconcile the
     README against un-shipped behavior.)
  - CONFIRM the README baseline (so the edit anchors / no-edit state are known):
      grep -c 'stripped from each reference' README.md            # → 1 (the L31 sentence)
      grep -c 'head block plus a paging directive' README.md      # → 3 (L9/L41/L72; note L9 phrasing differs slightly)

REVIEW STEP 1 — verify the L31 strip sentence is still accurate (Issue 2):
  - READ README.md L31. Confirm the success example ('Review #@a.ts' → 'Review a.ts') is correct
    (it is — Issue 2 strips #@ only from injected tokens; this example IS an injected token).
  - READ README.md L44 (the table row: 'Missing file, directory, or permission error | Left as
    written.'). Confirm the failed-token verbatim behavior is ALREADY documented (it is).
  - DECISION POINT: Is the L31 sentence misleading as-is? (Per research: NO — its example is a
    success case and the failed case is in L44.) If you judge an OPTIONAL precision clause reads
    naturally without restating L44 → take Task A (the optional edit). Else → take Task B (no edit).

REVIEW STEP 2 — verify the paged-delivery paragraphs (Issue 4):
  - READ README.md L9, L41, L72. Confirm each still says 'head block plus a paging directive' and
    (L72) 'first ~8 KB'. These are accurate (Issue 4 changed only the directive's offset, which the
    README never quotes; HEAD_BYTES=8192 is unchanged). → NO EDIT to L9/L41/L72.

# ── PATH A (OPTIONAL): the one minimal precision clause on L31 ─────────────────────────────
Task A: EDIT ./README.md — qualify "each reference" + a short failed-token follow-on (L31).
  - FIND (exact oldText — the current L31 sentence, byte-verbatim):
      <see "Exact source to write" → Path A oldText>
  - REPLACE WITH (exact newText — the qualified sentence + follow-on, README ASCII style):
      <see "Exact source to write" → Path A newText>
  - CRITERION (re-read after applying): the clause must read naturally and NOT merely restate the L44
    table row. If it reads as over-documentation → REVERT to baseline (git checkout README.md) and
    take Path B instead. The default/recommended path is B (no edit).

# ── PATH B (RECOMMENDED): no edit; document the finding ───────────────────────────────────
Task B: NO EDIT to README.md.
  - RECORD the review finding in the task's implementation report / commit message:
      "Reviewed README.md against shipped Issues 1–4. Issues 1/3/4 are internal/model-facing and
       never described in the README; Issue 2's only strip example (L31) is a success case that
       remains correct, and the failed-token verbatim behavior is already documented in the L44
       table ('Left as written'). The paged-delivery paragraphs (L9/L41/L72) are accurate (Issue 4
       changed only the directive offset, which the README never quotes). No edit required."
  - This satisfies the contract's "If upon review README.md is already accurate, make the minimal/no
    edit and note that in the PRP."

POST-FLIGHT (both paths):
  - SCOPE CHECK (README only; no source/test touched):
      git diff --name-only | grep -vxE 'README.md' && echo "FAIL: unexpected file changed" || echo "OK: only README.md (or nothing)"
  - INVENTED-MECHANICS GUARD (no dedup/notify/offset prose leaked in):
      ! grep -qEi 'dedup|duplicate|offset:2001|offset:0|injected [0-9]|whole, [0-9]+ paged' README.md \
        && echo "OK: no invented mechanics" || echo "FAIL: invented-mechanics prose leaked into README"
  - PAGED-PARAGRAPHS-UNCHANGED GUARD (Issue 4 is invisible to README):
      git diff README.md | grep -nE '^[-+].*(head block plus a paging directive|first ~8 KB)' \
        && echo "FAIL: paged paragraph edited (out of scope)" || echo "OK: paged paragraphs untouched"
  - HARNESS STILL GREEN (defensive):
      node ./file-injector.test.mjs        # → 49 passed, 0 failed

DO NOT (out of scope — closed/in-progress work + forbidden mechanics):
  * Edit file-injector.ts or file-injector.test.mjs (all four fixes LIVE + harness-pinned; Issue 4
    is in progress at P1.M2.T2.S1).
  * Add prose about dedup (Issue 1), notify wording (Issue 3), or the offset:2001 directive (Issue 4)
    — the contract explicitly forbids inventing these internal/model-facing mechanics.
  * Edit any README section other than (optionally) the L31 sentence: not L9/L41/L72 (paged), not L54
    (image bytes — a prior plan's F3/F5, out of scope here), not Syntax/Limits/#@ vs @.
  * Restructure the README (keep its tone, headings, table, section order).
  * Edit PRD.md / tasks.json / prd_snapshot.md (read-only, owned by orchestrator).
```

### Exact source to write (Path A — OPTIONAL; copy verbatim ONLY if taking the optional path)

> **Path B (no edit) is the recommended default.** Path A is provided so the choice is a single paste.
> README punctuation convention: **plain ASCII hyphen `-`** and **straight apostrophe `'`** — the
> README does NOT use the em dash (U+2014) or curly quotes that the `.ts`/`.test.mjs` use. Match ASCII.

**Path A — `oldText`** (the current L31 sentence, byte-verbatim; note the straight apostrophe in
`#@` is not present here, and the plain hyphen in `file`):
```markdown
On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath.
```

**Path A — `newText`** (qualify "each reference" → "each reference that resolves"; add a short
failed-token follow-on in the same plain ASCII style; keeps the success example unchanged):
```markdown
On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference that resolves, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath. A reference whose file is missing or is a directory is left as written, `#@` included.
```

> **Why this wording (if taken):** "that resolves" precisely encodes the Issue 2 fix (only
> successfully-injected tokens lose `#@`) without naming the internal mechanic. The follow-on sentence
> mirrors the contract's suggested clause ("a token whose file is missing or is a directory is left
> untouched") in the README's voice. The success example is byte-unchanged. **Re-read after applying**:
> if it reads as over-documentation or merely restates the L44 table row, REVERT and take Path B.

### Implementation Patterns & Key Details
```markdown
<!-- PATTERN (the review): for each of the four fixes, ask "is this README-visible?" — dedup NO,
     notify NO, paged-offset NO (model-facing string not quoted), strip PARTIAL (success example
     only; failed case already in L44). The conclusion "README already accurate" follows directly. -->

<!-- PATTERN (the optional clause): the smallest change that encodes the fix's user-visible effect is
     qualifying 'each reference' to 'each reference that resolves'. This is precise (only resolving
     references are stripped) without naming internal mechanics (no 'dedup', no 'index-splice'). -->

<!-- GOTCHA: README ASCII style. The README uses '-' (hyphen) and "'" (straight apostrophe) throughout
     — e.g. L44 'Left as written', L72 'first ~8 KB'. It does NOT use the em dash '—' (U+2014) that
     file-injector.ts (formatBinaryBlock/formatEmptyImageBlock/formatPagedDirectiveBlock) and the test
     harness use. If you take Path A, keep ASCII; do not import the em-dash convention. -->

<!-- GOTCHA: do not touch L54 ('Images are matched by their real bytes... An empty (0-byte) image
     attaches nothing.'). That documents F3/F5 from a PRIOR plan; none of Issues 1–4 touch it. -->

<!-- GOTCHA: the paged paragraphs (L9/L41/L72) are accurate. Issue 4 changed the directive's OFFSET
     (offset:0 → offset:2001), a model-facing string the README never quotes. HEAD_BYTES=8192 is
     unchanged, so L72's 'first ~8 KB' is correct. Do NOT edit these paragraphs. -->
```

### Integration Points
```yaml
NO INTEGRATION CHANGE:
  - "Pure documentation review + at most one sentence edit. No code, config, env vars, routes, build."
  - "Consumes the four LIVE fixes (file-injector.ts) as the accuracy reference. The README is the
     last user-facing surface reconciled against them."
  - "If a future change alters strip/dedup/notify/paged behavior, this README section (L31) is the
     user-facing contract to re-review; the harness cases (F2/FS1-3/PD1) are the source of truth."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** for prose. README is plain markdown.
> Validation is: (1) accuracy (no stale claim; no invented mechanics), (2) scope (`git diff` confined
> to README.md — and to L31 if edited), (3) a defensive harness run (must stay 49/0; this task touches
> no source/tests). The Python `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY.

### Level 1: Review & Scope Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. DEPENDENCIES LIVE — the README is reconciled against SHIPPED behavior (not a stale copy).
grep -q 'injectedThisRun' file-injector.ts && echo "OK: Issue 1 dedup live" || echo "FAIL: Issue 1 not live"
grep -q 'strippedText.slice(0, i) + strippedText.slice(i + 2)' file-injector.ts && echo "OK: Issue 2 splice live" || echo "FAIL: Issue 2 not live"
grep -q 'offset:2001, limit:2000' file-injector.ts && echo "OK: Issue 4 directive live" || echo "FAIL: Issue 4 not live"

# 1b. SCOPE — only README.md changed (or nothing, on the no-edit path).
git diff --name-only | grep -vxE 'README.md' && echo "FAIL: unexpected file changed" || echo "OK: only README.md (or no change)"

# 1c. INVENTED-MECHANICS GUARD — no dedup/notify/offset prose leaked into the README.
! grep -qEi 'dedup|duplicate|offset:2001|offset:0|injected [0-9]|whole, [0-9]+ paged' README.md \
  && echo "OK: no invented mechanics" || echo "FAIL: invented-mechanics prose leaked"

# 1d. PAGED-PARAGRAPHS-UNCHANGED — Issue 4 is invisible to README (the directive string is not quoted).
git diff README.md | grep -nE '^[-+].*(head block plus a paging directive|first ~8 KB|paging directive)' \
  && echo "FAIL: paged paragraph edited (out of scope)" || echo "OK: paged paragraphs untouched"

# 1e. IF PATH A TAKEN — the L31 sentence is now qualified (and the success example is unchanged).
git diff README.md | grep -qE '^\+.*each reference that resolves' && echo "OK: Path A clause present" \
  || echo "(Path B / no-edit: L31 unchanged — acceptable)"

# 1f. IF PATH A TAKEN — the success example 'Review #@a.ts' → 'Review a.ts' is byte-preserved.
grep -qF 'so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath' README.md \
  && echo "OK: success example preserved" || echo "FAIL: success example altered"

# Expected: 1a all OK; 1b OK; 1c OK; 1d OK; 1e OK (Path A) or the no-edit note (Path B); 1f OK (Path A).
```

### Level 2: Defensive Harness Run (must stay green — this task touches no source/tests)
```bash
cd /home/dustin/projects/pi-auto-reader
node ./file-injector.test.mjs
# Expected: "Result: 49 passed, 0 failed." exit 0.
# Rationale: this task edits ONLY README.md, so the harness CANNOT be affected. If it fails, the
# implementer accidentally touched a .ts/.test.mjs file — run `git diff --name-only` and revert any
# non-README change.
```

### Level 3: Render & Readability Sanity (eyeball the L31 paragraph if Path A taken)
```bash
cd /home/dustin/projects/pi-auto-reader
# Print § Usage to eyeball L31 (and confirm the paragraph still renders as one paragraph).
sed -n '/^## Usage/,/^## What gets injected/p' README.md
# Verify by eye:
#   - The strip sentence reads naturally; the optional clause (if present) does not over-document.
#   - The success example ('Review #@a.ts' → 'Review a.ts') is intact.
#   - No em dash (—) or curly quotes imported from the .ts/.test.mjs — README uses ASCII '-' and "'".
#   - The paged-delivery mentions (none in § Usage; they are in § Why / § What gets injected / § Limits)
#     are unchanged.
```

### Level 4: N/A (no creative/domain-specific validation for a doc review)
A documentation review has no performance, security, or load dimension. Level 1-3 are sufficient.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all four fixes confirmed LIVE; scope = README.md only (or no change); no invented
      mechanics; paged paragraphs untouched; (if Path A) the clause is present and the success example
      is byte-preserved.
- [ ] Level 2: `node ./file-injector.test.mjs` → **49 passed, 0 failed** (defensive; must not break).

### Feature Validation
- [ ] REVIEW COMPLETE: every README claim checked against shipped behavior; none is stale.
- [ ] The L31 strip sentence is confirmed accurate for the success case (Issue 2).
- [ ] The paged-delivery paragraphs (L9/L41/L72) are confirmed accurate (Issue 4 invisible to README).
- [ ] Decision recorded: Path A (optional clause) OR Path B (no edit) — with the rationale noted.

### Code Quality Validation
- [ ] If Path A: README ASCII style preserved (plain hyphen, straight apostrophe); no em dash imported;
      success example byte-unchanged; one paragraph, no broken structure.
- [ ] No invented mechanics (dedup / notify wording / offset:2001) added to the README.
- [ ] Source/tests untouched; harness green; scope confined to README.md (and to L31 if edited).

### Documentation & Deployment
- [ ] The review finding is documented (commit message / task report) — especially on the no-edit path,
      so future readers know the README was checked against the fixes and found accurate.
- [ ] No new env vars / config / API surface (pure documentation task).

---

## Anti-Patterns to Avoid
- ❌ Don't manufacture an edit. The contract explicitly allows the minimal/no-edit outcome and the
  research confirms the README is already accurate. If the optional L31 clause reads as
  over-documentation or restates the L44 table, REVERT and take the no-edit path. "No change, finding
  documented" is a successful outcome.
- ❌ Don't invent mechanics. The contract forbids adding dedup details (Issue 1), notify wording
  (Issue 3), the `offset:2001` directive (Issue 4), or any internal detail the user cannot observe.
  These belong to the source/tests, not the user-facing README.
- ❌ Don't edit `file-injector.ts` or `file-injector.test.mjs` — all four fixes are LIVE and
  harness-pinned (49/0); Issue 4 is still in progress at P1.M2.T2.S1. Editing them collides with that
  work and is out of scope.
- ❌ Don't edit the paged-delivery paragraphs (L9/L41/L72) — Issue 4 changed only the directive's
  model-facing offset string, which the README never quotes; `HEAD_BYTES=8192` is unchanged, so L72's
  "first ~8 KB" is still correct. These paragraphs are accurate.
- ❌ Don't touch L54 (image bytes / empty-image) — that documents F3/F5 from a PRIOR plan; none of
  Issues 1–4 touch it.
- ❌ Don't import the em-dash (U+2014 `—`) or curly-quote convention from the `.ts`/`.test.mjs` into
  the README. The README uses plain ASCII `-` (hyphen) and `'` (straight apostrophe). Match the
  README's existing style in any edit.
- ❌ Don't alter the L31 success example (`Review #@a.ts` → `Review a.ts`) — it is still correct after
  Issue 2. The optional clause only QUALIFIES "each reference", it does not change the example.
- ❌ Don't restructure the README — keep its tone, headings, table, and section order. Any edit is a
  sentence-level change inside § Usage (L31).

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a documentation review with a recommended **no-edit** outcome (or at most one
optional sentence edit), so the implementation surface is tiny. The core analysis is **verified
against the live source**: all four fixes are confirmed LIVE in `file-injector.ts` (grep-confirmed —
`injectedThisRun`, `injectedIndexes`/`strippedText.slice`, `offset:2001, limit:2000`), the harness is
**49/0 green** at baseline, and the README is grep-audited line-by-line (L31 accurate for the success
case; L9/L41/L72 accurate; no dedup/notify/offset prose present to sync). The per-fix
README-visibility table proves Issues 1/3/4 are invisible to the README and only Issue 2 touches a
README-visible claim — whose only documented example is a success case that remains correct, with the
failed-token case already in the L44 table. The optional Path A edit is provided as a byte-verbatim
oldText/newText pair in the README's ASCII style. Scope is crisply bounded: README.md only (and only
L31 on the optional path); source/tests are read-only; no invented mechanics (grep-guarded). The
residual 0.5 is for the Path A judgment call (whether the optional clause "reads naturally" vs
over-documents) — fully mitigated by defaulting to the no-edit Path B and reverting Path A if it reads
as redundant with L44. No model, no build, no network required.
