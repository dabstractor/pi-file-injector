---
name: "P1.M3.T2.S1 (Mode B Docs Sweep) — Update README Testing count (→31) + coverage, and verify changeset-wide consistency (no sentinel refs; Unicode boundary present; assembly format clean)"
prd_ref: "Bug-fix PRD §Overview (harness pass count), §Testing Summary (areas needing attention: co-load / sentinel / Unicode coverage), §Issue 6 (assembly format must match §6.2)"
target_file: "./README.md (§ 'Testing' content edit; + read-only verification of Overview / Quick start / Syntax / Known limitations)"
change_type: ONE content edit to README.md § 'Testing' (bump pass count 23→31 and extend the coverage sentence to name co-load dedup, sentinel-in-prompt, and Unicode word-boundary tests). Plus a set of read-only grep VERIFICATIONS that the remaining contract points are already satisfied (zero sentinel refs; Unicode boundary present in Syntax; assembly format clean in Overview/Quick start). No other file. No .ts. No .test.mjs. No PRD/tasks.json.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "ALL implementing subtasks complete: P1.M1.T1.S1/S2 (sentinel removed, per-token dedup added), P1.M1.T2.S1 (Unicode regex + Syntax Mode A doc), P1.M2.T1.S1 (F1/F1b/F2 harness cases), P1.M2.T2.S1 (U1 harness case), P1.M3.T1.S1 (F3/F5 behavior-table docs — runs in parallel; textually disjoint, no collision). The harness now reports `Result: 31 passed, 0 failed.` This task reads that count and reflects it in the README."
fixes: "Closes the Mode B changeset-level documentation sweep (SOW §5) for bugfix 001. Specifically satisfies contract (a) test-count + coverage update, and contract (b)(c)(d) which are VERIFICATIONS (all already satisfied — see research)."
scope_boundary: "Edits ONLY README.md § 'Testing' (the prose paragraph that contains 'At last run: … passed, 0 failed'). Does NOT edit any other README section text. Does NOT touch sharp-at-file.ts (sentinel already removed in P1.M1.T1.S2), sharp-at-file.test.mjs (harness cases owned by P1.M2.*), README § 'Behavior by file type' (owned by the parallel sibling P1.M3.T1.S1), README § 'Syntax' (Unicode boundary already landed by P1.M1.T2.S1), or PRD.md/tasks.json. The other contract points are satisfied by read-only greps, not edits."
---

# PRP — P1.M3.T2.S1 (Mode B Docs Sweep): README Testing count + changeset consistency

## Goal

**Feature Goal**: Perform the final **changeset-level documentation sweep** of `README.md` after all
implementing bugfix subtasks have landed, so that the README is internally consistent with the
shipped code. Concretely: (1) the **Testing** section reflects the **actual** harness result (`31
passed, 0 failed`) and names the three new coverage areas the bugfix added — **co-load dedup**, the
**sentinel-in-prompt** regression, and **Unicode word-boundary** tests; and (2) every other
cross-cutting contract point is **verified** consistent (zero references to the sentinel mechanism;
the Unicode-aware word boundary is documented; the assembly format described in the README matches
PRD §6.2 with no sentinel insertion).

**Deliverable**: ONE content edit to `./README.md` § "Testing" (bump count + extend coverage
sentence). The remaining contract items (b)/(c)/(d) are **read-only grep verifications** — research
confirmed they are already satisfied, so NO additional edits are required; the implementer runs the
greps to confirm and reports the result.

**No other file is modified. No `.ts`. No `.test.mjs`. No PRD/tasks.json.**

**Success Definition**:
- [ ] `git diff --name-only` shows ONLY `README.md`.
- [ ] The Testing section's pass count matches the LIVE `node ./sharp-at-file.test.mjs` output
      (currently **31 passed, 0 failed**) — implementer MUST run the harness and use the number it
      prints, not a hardcoded value.
- [ ] The Testing coverage sentence now mentions **co-load dedup**, **sentinel-in-prompt**, and
      **Unicode word-boundary** tests (the three areas the contract names).
- [ ] (Verification) `grep -niE 'sentinel|<!--#@|injected-->' README.md` prints NOTHING (zero
      sentinel/marker references anywhere in the README).
- [ ] (Verification) The Unicode-aware word boundary is documented (present in § "Syntax":
      `grep -q 'Unicode-aware' README.md`).
- [ ] (Verification) The assembly format described in Overview + Quick start contains no sentinel
      insertion and matches PRD §6.2 (`text\n\n---\n\nblocks`) — read-only eyeball.
- [ ] (Verification) § "Known limitations" contains no sentinel/format reference (grep-clean).
- [ ] `node ./sharp-at-file.test.mjs` still passes 0 failures (defensive — this task touches no code).

> **Scope boundary (read carefully):** This task edits ONLY README.md § "Testing". It does **NOT**:
> (a) edit `sharp-at-file.ts` (sentinel already removed in P1.M1.T1.S2; code is closed);
> (b) edit `sharp-at-file.test.mjs` (harness owned by P1.M2.* — this task only RUNS it to read the
> count); (c) edit README § "Behavior by file type" (owned by the **parallel sibling P1.M3.T1.S1** —
> its Image/Empty-image rows and F3/F5 bullets are in a textually DISJOINT section; let it land);
> (d) edit README § "Syntax" (the Unicode-boundary doc already landed there in P1.M1.T2.S1 — this
> task only VERIFIES it); (e) edit PRD.md / tasks.json / prd_snapshot.md (read-only, orchestrator-owned).

## User Persona

**Target User**: Anyone who reads the README to judge the extension's quality and coverage — a
potential adopter checking "how well-tested is this?", a maintainer reviewing the bugfix, or a
contributor about to extend the harness. They must see an accurate pass count and an honest
description of what the harness covers, not a stale "23 passed" number that predates the bugfix.

**Use Case**: A reviewer runs `node ./sharp-at-file.test.mjs`, sees `31 passed, 0 failed`, then opens
the README to understand what those 31 cases cover. The README's Testing section must (a) report the
same number, and (b) name the three new coverage areas (co-load dedup, sentinel-in-prompt, Unicode
boundary) so the reviewer understands the bugfix added real regression coverage, not just a code fix.

**Pain Points Addressed**: The README Testing section is currently stale ("23 passed, 0 failed") and
its coverage description omits the three bugfix-relevant test families. A reader who trusts the
README would believe the harness is smaller and narrower than it is. This task closes that gap and
verifies the rest of the README never described the (now-removed) sentinel mechanism.

## Why

- **The contract (SOW §5 Mode B) requires a final cross-cutting docs sweep.** This IS that sweep. Its
  job is to ensure README.md is internally consistent with the shipped code after all implementing
  subtasks land — no stale counts, no phantom mechanism references, the assembly format the README
  describes matches the code's actual output.
- **Stale counts erode trust.** The README has said "23 passed" since the pre-bugfix P1M2T4S1 era;
  the harness now runs 31 cases (added F1/F1b/F2/U1 and others). A reviewer who runs the harness and
  sees 31 but reads "23" in the README loses confidence in the docs. Updating it is cheap and
  high-value.
- **The verification points are cheap insurance.** Research already confirmed the sentinel mechanism
  is unmentioned in README prose and the assembly format is clean — but running the greps as a final
  gate guarantees no regression slipped in (e.g. a copy/paste reintroduced a marker string). The
  greps take seconds and catch a class of consistency bug that prose review misses.

## What

ONE content edit to `./README.md` § "Testing", plus read-only verifications:

1. **Content edit — Testing section**: bump the pass count to the LIVE harness result (**31**) and
   extend the coverage sentence to name the three new coverage areas. The exact `oldText`/`newText`
   are given verbatim in **Implementation Blueprint → Exact source to write** below.
2. **Verification (no edits) — sentinel absence**: confirm zero sentinel/marker references anywhere
   in the README.
3. **Verification (no edits) — Unicode boundary present**: confirm § "Syntax" documents the
   Unicode-aware word boundary (landed by P1.M1.T2.S1).
4. **Verification (no edits) — assembly format clean**: confirm Overview + Quick start describe the
   `\n\n---\n\n<blocks>` format with no sentinel insertion (matches PRD §6.2).
5. **Verification (no edits) — Known limitations clean**: confirm no stale sentinel/format reference.
6. **Defensive harness run**: `node ./sharp-at-file.test.mjs` must still pass 0 failures (this task
   touches no code; a failure means an out-of-scope file was accidentally edited).

### Success Criteria
- [ ] Only `README.md` changed; only its "Testing" section text altered.
- [ ] Testing pass count == LIVE harness output (run it; currently 31).
- [ ] Testing coverage sentence names co-load dedup, sentinel-in-prompt, Unicode word-boundary.
- [ ] All four verification greps pass (sentinel-absent, Unicode-present, format-clean,
      limitations-clean).
- [ ] Harness still passes 0 failures.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: (1) the byte-verbatim `oldText` of the current Testing
> paragraph (read directly from README lines 190-193) and a ready-to-paste `newText` with the count
> bumped to 31 and the three coverage phrases added; (2) the exact, copy-pasteable grep commands for
> every verification point, each with the expected output; (3) the authoritative source of the count
> (`node ./sharp-at-file.test.mjs` → `Result: 31 passed, 0 failed.`), so the implementer does not
> have to guess; (4) the PRD §6.2 assembly format verbatim, to eyeball-verify the README's Overview
> and Quick start descriptions against it; and (5) explicit scope boundaries so the implementer does
> not collide with the parallel sibling P1.M3.T1.S1 (different README section). No model, no API key,
> no build step — one prose edit + grep checks.

### Documentation & References
```yaml
# MUST READ — this task's verified research (byte-level, source-confirmed)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M3T2S1/research/research_notes.md
  why: "§1 the authoritative live test count (31) and the case-category breakdown (so the coverage
        sentence wording is accurate — co-load=F1b, sentinel-in-prompt=F2, Unicode=U1). §2–5 the
        verification results (zero sentinel refs in README; Unicode boundary already in Syntax;
        assembly format already clean in Overview/Quick start; Known limitations already clean).
        §7 the sibling-coordination boundaries (P1.M3.T1.S1 owns Behavior-by-file-type — disjoint).
        §8 the style/voice conventions (em dash U+2014, bold key terms, extend the existing run-on
        sentence — do NOT restructure into bullets)."
  critical: "The pass count MUST be read from a FRESH `node ./sharp-at-file.test.mjs` run, not
        hardcoded — it is currently 31; if a future test lands between PRP-write and implementation,
        use the number the harness actually prints. The coverage sentence must name all THREE areas
        (co-load dedup, sentinel-in-prompt, Unicode word-boundary) — omitting any one fails the
        contract."

# MUST READ — the bug context (the changeset this sweep closes out)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'The Three Interrelated Sentinel Bugs' + §'Unicode Regex Fix' + §'Test Harness Gaps' explain
        WHY the three new coverage areas exist (co-load/F1b, sentinel-in-prompt/F2, Unicode/U1) and
        confirm the sentinel mechanism was removed. §'Files Modified' table row 'README.md' lists the
        doc tasks (this is the final one)."
  section: "The Three Interrelated Sentinel Bugs; Unicode Regex Fix; Test Harness Gaps; Files Modified"

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "§Overview (harness was 28/28 at audit time — the bugfix raised it to 31), §Testing Summary
        ('Areas needing more attention: multi-copy/co-existence, live -p/-e integration, sentinel
        robustness, Unicode boundary') — these are the gaps the new cases fill, and what the README
        coverage sentence must now reflect."
  section: "Overview; Testing Summary"

# MUST READ — the authoritative assembly format (to eyeball-verify the README against)
- file: ./PRD.md
  why: "§6.2 Assembly specifies the exact output: `<original prompt text, unchanged>\\n\\n---\\n\\n
        <block 1>\\n\\n<block 2>` (pseudocode `const finalText = `${text}\\n\\n---\\n\\n
        ${blocks.join("\\n\\n")}`;`). NO sentinel. The README's Overview + Quick start assembly
        descriptions must match this. (Read-only — PRD.md is orchestrator-owned, never edit.)"
  pattern: "Read PRD.md §6.2 (lines ~242-268). Compare to README § Overview (line ~13: 'appends its
            contents to the prompt in Pi-native `<file name=\"…\">…</file>` blocks, below a `---`
            separator') and § Quick start (lines ~72-74: 'the file contents appear below a `---`
            rule … the extension **appends**, it does not inline-replace'). Both already match —
            verification only."
  gotcha: "Do NOT edit PRD.md. It is read-only. This task only reads §6.2 to verify the README."

# The source of truth for the count (RUN it — do not edit it)
- file: ./sharp-at-file.test.mjs
  why: "RUN `node ./sharp-at-file.test.mjs`; the final line `Result: 31 passed, 0 failed.` is the
        number the README must reflect. Also documents what the new cases cover (F1b=co-load,
        F2=sentinel-in-prompt, U1=Unicode) via inline comments — useful for wording the coverage
        sentence."
  pattern: "The new cases appear after the PRD §11 cases and edge/guard/headless cases:
            F1 (per-token dedup), F1b (co-load — Issue 1), F2 (sentinel-in-prompt — Issue 2),
            F3a/F3b (magic-number), F5 (empty image), F4 (pluralization), U1 (Unicode boundary)."
  gotcha: "Do NOT edit this file. The harness is owned by P1.M2.* (closed). This task only RUNS it.
           Editing it is out of scope and would collide with the closed implementation."

# The code whose behavior the README describes (already shipped — do NOT edit)
- file: ./sharp-at-file.ts
  why: "Confirms the sentinel mechanism is GONE (no INJECT_SENTINEL / SENTINEL_RE constant; the only
        remaining 'sentinel' string is a CODE COMMENT at line 140 explaining the per-token dedup is
        cooperation-independent). This is why the README has no sentinel references to remove."
  pattern: "injectFiles now does per-token dedup: before adding a block it checks if a
            `<file name=\"<abs>\">` block for that path already exists in the text; if so it skips.
            Assembly is `${text}\\n\\n---\\n\\n${blocks.join(\"\\n\\n\")}` — exact PRD §6.2, no
            sentinel insertion."
  gotcha: "Do NOT edit this file — the bugfix implementation is closed (P1.M1.T1.S1/S2). Any edit
           here collides with the closed work and is out of scope for a documentation task."

# The file being EDITED (only its 'Testing' section)
- file: ./README.md
  why: "§ 'Testing' (README lines ~184-193) is the ONLY edit target — specifically the prose paragraph
        at lines 190-193 that ends 'At last run: **23 passed, 0 failed.**'. The other README sections
        (Overview, Quick start, Syntax, Known limitations, Behavior by file type) are READ-ONLY for
        this task — verified via grep, not edited."
  pattern: "Prose paragraph in the 'Testing' section, single run-on sentence listing coverage groups
            ending with the bold count. Extend the same pattern; keep the trailing clauses
            ('No network, no model API key …' and the validation_report.md link) unchanged."
  gotcha: "STAY OUT of § 'Behavior by file type' (parallel sibling P1.M3.T1.S1 owns it) and
           § 'Syntax' (Unicode boundary already landed by P1.M1.T2.S1 — verify only). One edit, in
           'Testing' only."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-auto-reader
.
├── PRD.md                       # original feature PRD (read-only; §6.2 is the assembly-format source of truth)
├── README.md                    # ← EDIT (§ 'Testing' ONLY); + read-only verify of Overview/Quick start/Syntax/Known limitations
├── sharp-at-file.ts             # sentinel ALREADY REMOVED (P1.M1.T1.S2); per-token dedup live. DO NOT EDIT.
├── sharp-at-file.test.mjs       # harness now reports `31 passed, 0 failed`. RUN it for the count. DO NOT EDIT.
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/system_context.md   # §'Test Harness Gaps' / §'Files Modified'
    ├── prd_snapshot.md / prd_index.txt / tasks.json
    ├── P1M3T1S1/                        # parallel sibling: README § 'Behavior by file type' (F3/F5). DISJOINT — no collision.
    └── P1M3T2S1/
        ├── research/research_notes.md   # THIS TASK's research (byte-verified; the live count=31)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
└── README.md                    # MODIFIED — § 'Testing': pass count 23→31 + coverage sentence names
                                 #   co-load dedup / sentinel-in-prompt / Unicode word-boundary.
# No new files. No .ts / .test.mjs / PRD / tasks.json changes.
```

### Known Gotchas of our codebase & Library Quirks
```markdown
<!-- CRITICAL — the pass count must be the LIVE harness output, not a hardcoded number. RUN -->
<!-- `node ./sharp-at-file.test.mjs` and read its final line. It currently prints -->
<!-- `Result: 31 passed, 0 failed.` Use that exact number in the README. If a future test lands -->
<!-- and the count changes, use the new number. Hardcoding "23" (the stale README value) is a bug. -->

<!-- CRITICAL — the coverage sentence must name ALL THREE areas the contract requires: -->
<!--   (1) co-load dedup (the F1b case — two non-sentinel copies don't double-inject), -->
<!--   (2) sentinel-in-prompt (the F2 case — a prompt containing the literal marker still injects), -->
<!--   (3) Unicode word-boundary tests (the U1 case — #@ does not fire mid-word in any language). -->
<!-- Omitting any one fails contract point (a). The ready-to-paste newText below includes all three. -->

<!-- GOTCHA — most of the contract is VERIFICATION, not editing. Research confirmed: -->
<!--   - ZERO sentinel/marker references anywhere in README.md (contract b/d removal sub-items: no-op). -->
<!--   - The Unicode-aware word boundary is ALREADY documented in § 'Syntax' by P1.M1.T2.S1 (contract b: no-op). -->
<!--   - The assembly format in Overview + Quick start is ALREADY clean, matching PRD §6.2, no sentinel -->
<!--     (contract c: no-op). -->
<!-- Do NOT go hunting for sentinel text to delete — there is none. Run the grep VERIFICATIONS to -->
<!-- confirm, then STOP. Only the Testing section needs a real edit. -->

<!-- GOTCHA — sibling scope discipline. The parallel sibling P1.M3.T1.S1 edits README § 'Behavior by -->
<!-- file type' (Image row note, new Empty-image row, 2 F3/F5 bullets). That section is textually -->
<!-- DISJOINT from the Testing section, so the edits do not collide regardless of landing order. -->
<!-- Do NOT touch § 'Behavior by file type', § 'Syntax', § 'Known limitations', or § 'Quick start' — -->
<!-- verify them read-only, do not edit them. (Syntax's Unicode doc and the assembly format are already -->
<!-- correct; editing them would be scope creep and could collide with closed/parallel siblings.) -->

<!-- GOTCHA — the only remaining 'sentinel' string in the whole repo is in CODE COMMENTS: -->
<!--   sharp-at-file.ts:140  and  several sharp-at-file.test.mjs comments. -->
<!-- Those are NOT user-facing docs and are explicitly OUT OF SCOPE (do not edit .ts/.test.mjs). The -->
<!-- verification grep targets README.md ONLY. -->

<!-- IDEMPOTENCY — if a prior pass already updated the Testing count to 31 and added the three -->
<!-- coverage phrases, the oldText anchor below will NOT match (the paragraph will already contain -->
<!-- 'co-load dedup' / '31 passed'). Re-read README § 'Testing'; if it already reflects 31 + the three -->
<!-- areas, run the verification greps to confirm the rest and STOP (the task is already done). -->
```

## Implementation Blueprint

### Data models and structure
None. Pure markdown prose. No code, types, signatures, or data structures.

### Implementation Tasks (ordered by dependencies)
```yaml
PRE-FLIGHT:
  - RUN THE HARNESS FIRST (the count is data, not a guess):
      cd /home/dustin/projects/pi-auto-reader && node ./sharp-at-file.test.mjs
    Read the final line `Result: <N> passed, 0 failed.` — that <N> (currently 31) is the number the
    README must show. If it is NOT 0 failures, STOP and investigate (the code changes must be landed
    first; this task assumes all implementing subtasks are complete).
  - IDEMPOTENCY GUARD (a prior pass may have already landed this):
      grep -qF 'co-load dedup' README.md && echo "coverage sentence may already be updated → verify"
      grep -qF '**31 passed, 0 failed.**' README.md && echo "count may already be 31 → verify"
    (If BOTH match, the Testing edit may already be done — run all verification greps to confirm the
     whole task, then STOP.)
  - CONFIRM the current README Testing paragraph matches the oldText anchor below:
      grep -qF 'At last run: **23 passed, 0 failed.**' README.md
    (Must match. If it fails, the README drifted — re-read § 'Testing' and adapt the oldText.)
  - CONFIRM scope baseline (defensive — no unintended edits):
      git diff --name-only 2>/dev/null   # should be empty (or only this task's changes)

Task 1: EDIT ./README.md § 'Testing' — bump count to 31 + extend coverage sentence (contract a)
  - OBJECTIVE: Replace the single Testing prose paragraph so the pass count reflects the LIVE harness
    result (31) and the coverage sentence names co-load dedup, sentinel-in-prompt, and Unicode
    word-boundary tests.
  - FIND (exact oldText — byte-verbatim from README lines 190-193):
      <see "Exact source to write" → Edit oldText below>
  - REPLACE WITH (exact newText — count=31, three coverage phrases added, trailing clauses preserved):
      <see "Exact source to write" → Edit newText below>
      NOTE: if the LIVE harness count is NOT 31, substitute the actual number into the bold.
  - DO NOT alter the bash code block above the paragraph, the trailing "No network, no model API key,
    and no Pi process are required." clause, or the validation_report.md link line.

POST-FLIGHT — VERIFICATIONS (contract b/c/d — read-only greps; no edits expected):
  - SENTINEL ABSENCE (contract b/d removal): the grep below must print NOTHING.
      grep -niE 'sentinel|<!--#@|injected-->|injected marker' README.md
    (Expected: no output. If it prints anything, that is a sentinel/marker reference to remove — but
     research found none, so a hit means an unexpected regression; inspect and remove it, scoped to
     README.md prose only.)
  - UNICODE BOUNDARY PRESENT (contract b verify): must match.
      grep -q 'Unicode-aware' README.md && echo "OK" || echo "MISSING — add to § Syntax"
    (Expected: OK. The doc is in § 'Syntax', landed by P1.M1.T2.S1.)
  - ASSEMBLY FORMAT CLEAN (contract c verify — eyeball + grep): the Overview and Quick start assembly
    descriptions must contain NO sentinel insertion and must match PRD §6.2.
      grep -qE 'below a .---. (rule|separator)' README.md && echo "OK: assembly described" || echo "CHECK"
      grep -niE 'injected-->|<!--#@file' README.md   # must be empty (already covered above)
    (Expected: assembly described via '---' separator, no marker. Eyeball § Overview line ~13 and
     § Quick start lines ~72-74 against PRD.md §6.2.)
  - KNOWN LIMITATIONS CLEAN (contract b verify): no sentinel/format reference there.
      awk '/^## Known limitations/{f=1;next} /^## /{f=0} f' README.md | grep -niE 'sentinel|<!--#@|---\\n\\n|assembly' || echo "OK: clean"
    (Expected: 'OK: clean'. The 5 limitation bullets name none of these.)
  - SCOPE CHECK: only README.md changed, and only its Testing section's text altered.
      git diff --name-only | grep -vxE 'README.md' && echo "FAIL: unexpected file" || echo "OK: only README.md"
      git diff README.md | grep -nE '^[+-]' | grep -viE 'Testing|passed|co-load|sentinel-in-prompt|Unicode|headless|guard|edge|acceptance|harness'
    (The second line should print nothing meaningful — all changed lines belong to the Testing edit.
     If it prints a line from another section, an out-of-scope edit leaked — revert it.)
  - DEFENSIVE HARNESS RUN: must still pass 0 failures (this task touches no code).
      node ./sharp-at-file.test.mjs   # expect: Result: 31 passed, 0 failed. exit 0.

DO NOT (out of scope — owned by siblings / closed tasks / orchestrator):
  * Edit sharp-at-file.ts (sentinel removed in P1.M1.T1.S2; closed).
  * Edit sharp-at-file.test.mjs (harness owned by P1.M2.*; closed).
  * Edit README § 'Behavior by file type' (parallel sibling P1.M3.T1.S1).
  * Edit README § 'Syntax' (Unicode boundary landed by P1.M1.T2.S1; verify only).
  * Edit README § 'Overview' / 'Quick start' / 'Known limitations' (verify only — research found them
    already correct; editing is scope creep).
  * Edit PRD.md / tasks.json / prd_snapshot.md / prd_index.txt (read-only, orchestrator-owned).
```

### Exact source to write (authoritative — copy verbatim into ONE `edit` call)

---

#### Edit — README § 'Testing' paragraph (count → 31 + three coverage phrases)

**`oldText`** (byte-verbatim from README lines 190-193 — the single prose paragraph under the bash
code block):
```markdown
The harness imports the **real** `sharp-at-file.ts` (via jiti, exactly like Pi's loader), runs all
14 PRD §11 acceptance cases plus edge cases, the three handler guards, and the headless/notify path,
and prints a pass/fail matrix. At last run: **23 passed, 0 failed.** No network, no model API key,
and no Pi process are required.
```

**`newText`** (same paragraph; count bumped to **31**; three new coverage areas inserted as
bold-led phrases; trailing clauses unchanged — all em dashes are **U+2014** where used):
```markdown
The harness imports the **real** `sharp-at-file.ts` (via jiti, exactly like Pi's loader), runs all
14 PRD §11 acceptance cases plus edge cases, the three handler guards, the headless/notify path,
**co-load dedup** (a non-sentinel co-loaded copy must not double-inject a file), the
**sentinel-in-prompt** regression (a prompt containing the literal marker still injects its files),
and **Unicode word-boundary** tests (`#@` does not fire mid-word in any language), and prints a
pass/fail matrix. At last run: **31 passed, 0 failed.** No network, no model API key, and no Pi
process are required.
```

> **Why this wording:** the existing paragraph is one run-on sentence enumerating coverage groups
> (acceptance cases, edge cases, guards, headless/notify) before the bold count. The newText extends
> that SAME pattern with three new bold-led groups — co-load dedup, sentinel-in-prompt, Unicode
> word-boundary — each with a one-clause gloss, then keeps the unchanged count clause and trailing
> "No network …" clause. This matches the README's existing voice (bold key terms, em dash clauses,
> no bullet restructuring) and names exactly the three areas the contract requires.

> **Count substitution:** the `**31 passed, 0 failed.**` value is the LIVE harness result as of
> PRP-write. If `node ./sharp-at-file.test.mjs` prints a different number when you run it in
> PRE-FLIGHT, substitute that number (keep the `**<N> passed, 0 failed.**` shape).

---

### Implementation Patterns & Key Details
```markdown
<!-- PATTERN (prose-paragraph edit): the Testing paragraph is ONE sentence listing coverage groups,
     separated by commas, ending with the bold count clause, then a second sentence ("No network …").
     Extend the enumeration in place — do NOT restructure into a bullet list (the README deliberately
     uses flowing prose here; a bullet list would break the voice and is out of scope). -->

<!-- PATTERN (bold key terms): the README bolds the salient noun of each coverage group it wants to
     emphasize ("**unconditional**", "**appends**", "**Unicode-aware**"). The newText bolds the three
     new group names — **co-load dedup**, **sentinel-in-prompt**, **Unicode word-boundary** — so they
     read as first-class coverage areas, matching the existing voice. -->

<!-- PATTERN (em dash U+2014): the README uses — (U+2014) as its clause separator throughout. The
     newText uses it only where a gloss needs an em-dash clause; elsewhere it uses parentheses
     (matching the existing "plus edge cases, the three handler guards, and the headless/notify path"
     comma style). No hyphens stand in for em dashes. -->

<!-- GOTCHA: the count is DATA. Always run the harness in PRE-FLIGHT and use its number. The newText
     hardcodes 31 only because that is the current live value; if it changed, update it. Never
     restore the stale "23". -->

<!-- GOTCHA: contract points (b), (c), (d) are VERIFICATIONS, not edits. Research (research_notes.md
     §2–5) confirmed: zero sentinel refs in README; Unicode boundary already in Syntax; assembly
     format already clean in Overview/Quick start; Known limitations already clean. Running the
     POST-FLIGHT greps CONFIRMS this; if a grep unexpectedly hits, only then make a scoped README
     prose fix. Do not preemptively edit those sections "to be safe" — that is scope creep and risks
     colliding with closed/parallel siblings. -->
```

### Integration Points
```yaml
NO NEW INTEGRATION POINTS:
  - "Pure markdown documentation edit. No code, config, env vars, routes, or build step."
  - "Consumes the LIVE harness result (node ./sharp-at-file.test.mjs → 31 passed) as its data source."
  - "Consumes the already-shipped bugfix (sentinel removed, per-token dedup, Unicode regex) as its
     subject — the README prose must stay consistent with that code."
  - "If a future change alters the harness case count, the README Testing count must be re-run and
     updated to match (the count clause is the user-facing accuracy contract)."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** for prose. The README is plain markdown.
> Validation is therefore: (1) the live harness run (the count is data), (2) byte-exact string checks
> (count, coverage phrases, sentinel absence), (3) scope check (diff confined to the Testing section),
> and (4) a defensive harness re-run (must still pass — this task touches no code). The Python
> `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY.

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. The pass count reflects the LIVE harness result (run it first, then check the README matches).
node ./sharp-at-file.test.mjs | tail -1     # prints: Result: <N> passed, 0 failed.
grep -qF "**31 passed, 0 failed.**" README.md && echo "OK: count present" || echo "FAIL: count missing/wrong"
# (Substitute the actual <N> above into the grep if it is not 31.)

# 1b. The three required coverage areas are named.
grep -qF '**co-load dedup**' README.md && echo "OK: co-load dedup" || echo "FAIL: co-load dedup missing"
grep -qF '**sentinel-in-prompt**' README.md && echo "OK: sentinel-in-prompt" || echo "FAIL: sentinel-in-prompt missing"
grep -qF '**Unicode word-boundary**' README.md && echo "OK: Unicode word-boundary" || echo "FAIL: Unicode missing"

# 1c. The stale count is gone (no "23 passed" left).
grep -qF '**23 passed, 0 failed.**' README.md && echo "FAIL: stale 23 still present" || echo "OK: stale count removed"

# 1d. (Verification contract b/d) ZERO sentinel/marker references anywhere in README.
grep -niE 'sentinel|<!--#@|injected-->|injected marker' README.md && echo "FAIL: sentinel/marker ref found" || echo "OK: no sentinel/marker refs"

# 1e. (Verification contract b) Unicode-aware word boundary is documented.
grep -q 'Unicode-aware' README.md && echo "OK: Unicode boundary documented" || echo "FAIL: Unicode boundary missing"

# 1f. (Verification contract c) Assembly format described via '---' separator (matches PRD §6.2).
grep -qE 'below a `---` (rule|separator)' README.md && echo "OK: assembly format described" || echo "CHECK: eyeball Overview/Quick start vs PRD §6.2"

# 1g. SCOPE CHECK — only README.md changed.
git diff --name-only | grep -vxE 'README.md' && echo "FAIL: unexpected file changed" || echo "OK: only README.md"
# Confirm the diff touches only the Testing paragraph (no out-of-scope section edits):
git diff README.md | grep -nE '^\+' | grep -viE 'co-load dedup|sentinel-in-prompt|Unicode word-boundary|31 passed|must not double|literal marker|does not fire mid-word|non-sentinel co-loaded|headless/notify|acceptance cases|handler guards|edge cases|pass/fail matrix|harness imports|real.*sharp-at-file|jiti|prints a' \
  && echo "WARN: added line outside expected set — inspect" || echo "OK: all additions belong to the Testing edit"

# Expected: count present (matching live N, not 23); all three coverage phrases present; stale 23
# gone; no sentinel/marker refs; Unicode boundary documented; assembly format described; only
# README.md changed; all additions belong to the Testing paragraph.
```

### Level 2: Defensive Harness Run (must still pass — this task touches no code)
```bash
cd /home/dustin/projects/pi-auto-reader
node ./sharp-at-file.test.mjs
# Expected: `Result: 31 passed, 0 failed.` (or the current live count), exit 0.
# Rationale: this task edits ONLY README.md prose, so the harness CANNOT be affected. If it fails or
# the count dropped, the implementer accidentally touched a .ts/.test.mjs file — re-run
# `git diff --name-only` and revert any non-README change.
```

### Level 3: Render Sanity (optional — eyeball the Testing section)
```bash
cd /home/dustin/projects/pi-auto-reader
# Print the 'Testing' section to eyeball paragraph rendering.
sed -n '/^## Testing/,/^## /p' README.md
# Verify by eye:
#   - The paragraph reads as one flowing sentence enumerating coverage groups, ending with the bold
#     count, then the "No network …" sentence.
#   - The three new bold phrases (co-load dedup, sentinel-in-prompt, Unicode word-boundary) each have
#     a short gloss in parentheses and read naturally in the enumeration.
#   - The bold count shows the LIVE number (31), not 23.
#   - The validation_report.md link line is intact and unchanged.
# Also eyeball § Overview (line ~13) and § Quick start (lines ~72-74) against PRD.md §6.2 to confirm
# the assembly format description is still clean (--- separator, no marker).
```

### Level 4: N/A (no creative/domain-specific validation for prose)
This is markdown documentation. There is no performance, security, or load dimension. Level 1-3 are
sufficient.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: README pass count matches the live harness (`31` unless the harness changed); the three
      coverage phrases (co-load dedup / sentinel-in-prompt / Unicode word-boundary) all present; stale
      `23` gone; zero sentinel/marker refs in README; Unicode boundary documented; assembly format
      described; only README.md changed; all additions belong to the Testing paragraph.
- [ ] Level 2: `node ./sharp-at-file.test.mjs` still passes 0 failures (defensive).

### Feature Validation
- [ ] A reader who runs the harness (sees `31 passed, 0 failed`) and opens the README sees the SAME
      number in the Testing section.
- [ ] A reader understands the harness now covers the three bugfix-relevant areas (co-load dedup,
      sentinel-in-prompt regression, Unicode word-boundary) — the coverage sentence names them.
- [ ] A reader finds NO mention of a sentinel mechanism or `<!--#@file-injected-->` marker anywhere in
      the README (consistent with the code, where it was removed).
- [ ] A reader finds the Unicode-aware word boundary documented (in § Syntax) and the assembly format
      matching PRD §6.2 (in § Overview / § Quick start).

### Code Quality Validation
- [ ] The Testing edit follows the existing README voice (one flowing sentence, bold key terms, em
      dash U+2014 clauses, no bullet restructuring).
- [ ] The bold count is the LIVE harness number (run, not hardcoded-from-PRP).
- [ ] Scope respected: § Behavior by file type (sibling P1.M3.T1.S1), § Syntax (sibling P1.M1.T2.S1),
      § Overview / Quick start / Known limitations (verify-only), `.ts`, `.test.mjs`, PRD.md,
      tasks.json all untouched.

### Documentation & Deployment
- [ ] The Testing section is the single source of truth a reader consults for "how tested is this?"
      and now accurately reflects the shipped harness (count + coverage).
- [ ] No phantom mechanism references remain — the README is internally consistent with the
      sentinel-free, per-token-dedup, Unicode-regex code.

---

## Anti-Patterns to Avoid
- ❌ Don't hardcode the pass count from the PRP — RUN `node ./sharp-at-file.test.mjs` and use its
  number. The PRP's `31` is the value at PRP-write time; if the harness changed, use the new number.
  Restoring the stale "23" is the #1 failure mode.
- ❌ Don't omit any of the three required coverage phrases (co-load dedup, sentinel-in-prompt, Unicode
  word-boundary). The contract explicitly names all three; the newText includes all three.
- ❌ Don't edit `sharp-at-file.ts` or `sharp-at-file.test.mjs` — the bugfix code and harness are closed
  (P1.M1.* / P1.M2.*). This task only RUNS the harness to read the count. Editing collides with the
  closed implementation.
- ❌ Don't edit README § 'Behavior by file type' — the parallel sibling P1.M3.T1.S1 owns it (Image row
  note, Empty-image row, F3/F5 bullets). It is a textually disjoint section; let it land.
- ❌ Don't edit README § 'Syntax', § 'Overview', § 'Quick start', or § 'Known limitations' — research
  confirmed they are already correct (Unicode boundary present; assembly format clean; no sentinel
  refs). They are VERIFY-ONLY. Editing them is scope creep and risks colliding with closed siblings.
- ❌ Don't restructure the Testing paragraph into a bullet list — match the existing flowing-prose
  voice (one sentence enumerating coverage groups). Restructuring breaks the README's voice and is
  out of scope.
- ❌ Don't go hunting for sentinel text to delete — there is NONE in the README (confirmed by grep).
  Run the verification grep to confirm, then STOP. The only real edit is the Testing count/coverage.
- ❌ Don't conflate the word "injection" (the feature's name — appears throughout the README as normal
  prose: "whole-file injection", "injects nothing") with the "sentinel mechanism" / "injected marker"
  string. The verification grep targets `sentinel|<!--#@|injected-->|injected marker` — it must NOT
  flag normal "injection" prose. If it does (it won't), inspect before deleting anything.
- ❌ Don't edit PRD.md / tasks.json / prd_snapshot.md / prd_index.txt — they are read-only,
  orchestrator-owned. This task only READS PRD §6.2 to verify the README's assembly description.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a single prose-paragraph edit to one markdown file, with a byte-verbatim
`oldText` anchor (read directly from the current README lines 190-193) and a ready-to-paste
`newText`. Every value the implementer must reproduce is verified against a live source: the pass
count (`31`) comes from actually running `node ./sharp-at-file.test.mjs` (final line
`Result: 31 passed, 0 failed.`); the three coverage areas come from the harness's own case comments
(F1b = co-load, F2 = sentinel-in-prompt, U1 = Unicode); the PRD §6.2 assembly format is read
verbatim (lines 242-268) to eyeball-verify the README's Overview/Quick start descriptions against it.
The bulk of the contract (points b/c/d) is read-only verification that research already confirmed is
satisfied (zero sentinel refs in README; Unicode boundary in Syntax; assembly format clean), so the
implementer runs deterministic greps and reports — no guessing. The scope is crisply disjoint from
all siblings: the `.ts`/`.test.mjs` are closed (only RUN the harness); README § 'Behavior by file
type' is the parallel sibling P1.M3.T1.S1's disjoint section; § 'Syntax' landed in P1.M1.T2.S1. The
residual 0.5 is for one data-dependency failure mode — using a stale/hardcoded count instead of the
live harness number — which is deterministically caught by Level-1 greps #1a (count present) and #1c
(stale `23` gone), plus the PRE-FLIGHT instruction to run the harness first. No model, no build, no
network required.
