---
name: "P1.M4.T6.S1 (dir: P1M4T1S1 — pre-renumber path) — README.md changeset sweep (Limits, URLs, Syntax, Usage)"
prd_ref: "bugfix PRD §h2.5 Recommendations (BUG-005 bullet: 'Either document the https?-only narrowing in the README's Limits section … so code and PRD text agree'); work-item contract (verify-and-complete changeset-level README coherence); architecture/spec_ux_bug004_005.md § README/docs landscape + § Option comparison"
target_files: "./README.md (ONLY file modified — one mandatory sentence append in ## Limits hostname bullet; one conditional sentence append in ## Syntax Line range paragraph; zero rewrites)"
target_language: Markdown (user docs; no build. Gates = clean-tree confirmation: `npm test` all 4 suites green + `npm run typecheck` 0 errors, run ONCE after the edit; docs greps below)"
depends_on: "ALL SEVEN implementing subtasks COMPLETE in the tree before you start: P1.M1.T1.S1/S2/S3 (BUG-001, commits 21bf4fa/c626928/71e9f45), P1.M2.T2.S1 (BUG-002 injectMarkdown invalidRange guard), P1.M2.T3.S1 (BUG-003, commit fe766bd), P1.M3.T4.S1 (BUG-004, commit 3c0bb5d), P1.M3.T5.S1 (BUG-005 ftp shape gate — still Planned at PRP-writing time; see Task 0 pre-flight). Docs sweep is Mode B: it runs LAST, after every dependency."
consumed_by: "Nothing downstream (final docs task of the changeset). Sibling P1.M4.T6.S2 (spec/ consistency pass) is SEPARATE — do not touch spec/ files."
research: "plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T1S1/research/research_notes.md (verified line map at HEAD 3c0bb5d, rider states, exact edit-target text, pre-flight greps)"
---

# PRP — P1.M4.T6.S1: README.md changeset sweep (Limits, URLs, Syntax, Usage)

> **Scope flag:** Docs-only, Mode B. This IS the changeset-level documentation task — it runs after
> every implementing subtask. Exactly ONE mandatory edit (the BUG-005 scheme sentence in `## Limits`),
> ONE conditional edit (the BUG-002 malformed-range sentence in `## Syntax`, add only if the
> dependency's Mode-A rider is absent — at PRP-research HEAD it WAS absent), and four
> verification-only checks (BUG-001 expanded-view wording, BUG-003 Images bullet, BUG-004
> autocomplete sentence, `## #@ versus @`). **No code. No tests. No spec/ files. No rewrites.**
> "Keep edits minimal — this is a sweep, not a rewrite."

---

## Goal

**Feature Goal:** README.md is consistent with the shipped behavior of all five fixes (BUG-001..005):
the Limits section documents the scheme reality (`ftp://` accepted by the gate but not fetchable →
never injected), the Syntax section documents malformed-range behavior IF the BUG-002 rider didn't
land it, and every section the fixes touched reads coherently with no stale claims.

**Deliverable:** Modified `README.md` —
1. **Mandatory:** one sentence appended to the `## Limits` hostname bullet (`- **URLs need a dotted,
   alphabetic hostname.** …`): explicit schemes other than `http(s)://` (e.g. `ftp://…`) are not
   fetched and are left as written (BUG-005 residual documentation).
2. **Conditional:** one sentence appended to the `## Syntax` `**Line range.**` paragraph documenting
   malformed ranges (left verbatim + warning, prompt and in-markdown alike) — ADD ONLY IF absent
   (grep first; at research HEAD `3c0bb5d` it was absent — `grep -ci "malformed" README.md` → 1,
   the unrelated config sentence at :179).
3. Verified-accurate, untouched: expanded-view sentences, URLs Images bullet, autocomplete sentence.

**Success Definition:**
1. Pre-flight (Task 0) confirms all seven dependency fixes are in the tree (greps below) — README
   must never document unshipped behavior.
2. Post-edit greps: `grep -c "ftp" README.md` → exactly 1; the malformed-range sentence present
   (either yours or the landed rider) exactly once in `## Syntax`; `git diff --stat` shows only
   README.md with ≤2 changed regions.
3. `npm test` (4 suites, all green) and `npm run typecheck` (0 errors) run once on the edited tree —
   confirming a clean tree, not testing docs.
4. Zero wording changes beyond the two appends unless a verification check FAILS (decision rules below).

## User Persona (if applicable)

**Target User:** A pi user reading the README to learn what `#<url>` tokens do — specifically one who
tries `#ftp://example.com/file` and wonders why nothing was injected, or who types `#@x.md:5-3` inside
a doc and wonders what happened.

**Use Case:** User scans `## Limits` before relying on URL injection; the scheme sentence sets the
expectation that only `http(s)` is actually retrievable. User scans `## Syntax` line-range rules; the
malformed-range sentence explains the verbatim + warning behavior.

**Pain Points Addressed:** README/code drift — the PRD (§h2.5) explicitly flags "document the
https?-only narrowing in the README's Limits section … so code and PRD text agree." Post-BUG-005 the
gate accepts `ftp://` but Node's fetch (undici) cannot retrieve it, so the token is silently left
verbatim — a Limit worth one sentence.

## Why

- **PRD §h2.5 Recommendation (BUG-005) demands README/code agreement.** The shipped behavior (either
  pre- or post-BUG-005) is user-identical for ftp: token left as written, nothing fetched into the
  prompt. The Limits bullet already discusses schemes ("must be a `http(s)://` URL **or** a bare
  host…", "an explicit scheme bypasses the check entirely, so … write `#https://foo.sh`") — the new
  sentence completes that discussion: only `http(s)://` is actually fetched.
- **Closes the sweep contract.** Every implementing subtask deliberately deferred README work here
  (BUG-001 subtasks: "No README change (P1.M4.T6 sweeps)"; BUG-005 PRP: "the ftp Limits bullet lands
  THERE, not here"; BUG-004 PRP: "NO autocomplete README change"). This task is where the changeset's
  user-facing story becomes whole.
- **Robust wording choice.** The sentence "Explicit schemes other than `http(s)://` … are not fetched
  and are left as written" is accurate whether the ftp token dies at the shape gate or at the fetch
  throw — it describes the user-visible outcome, not the mechanism. No coupling to BUG-005's internals.

## What

README.md gains ≤2 sentences (one per the two appends above); nothing is removed or reworded unless a
verification check below FAILS. No other file changes.

### Verification checks (fix ONLY on failure — research verdicts given)

- **(b) BUG-001 — expanded-view wording** (`## Usage` :50 "On submit, each file shows up as a compact
  green `read <path>` line … Press `ctrl+o` to expand any of them to the full contents." and
  `### URLs` :62 "Each URL renders as a green `read <url>` line — identical to the `read` tool and to
  `#@file` — and `ctrl+o` expands it to the extracted markdown."). **Research verdict: accurate,
  no change.** These sentences are generic per-file claims that never implied the old body
  misalignment. Fix only if you find wording claiming a single shared body, wrong-content pairing, or
  anything contradicting "each file expands to ITS full contents."
- **(c-part-1) BUG-003 rider** (`### URLs` Images bullet :82–84: "An image URL whose body comes back
  empty (0 bytes) attaches nothing — it delivers the same "empty image file — 0 bytes" note a 0-byte
  local image does."). **Research verdict: present (commit fe766bd), coherent** with the
  `## What gets injected` sentence "An empty (0-byte) image attaches nothing." No change.
- **(c-part-2) BUG-002 rider** — grep `\*\*Line range\.\*\*` paragraph (`## Syntax` :127–130 at HEAD)
  for a malformed-range sentence (`grep -i "malformed" README.md`). **At research HEAD: ABSENT**
  (only hit was the config sentence :179). If still absent → do Task 2 (conditional append). If the
  rider landed meanwhile → read it in context, fix only if it contradicts post-fix behavior
  (malformed = left verbatim + warning, uniformly at prompt AND inside delivered markdown).
- **(d) BUG-004 — autocomplete sentence** (:96 "Path completion works in the editor. Type `#@` and
  the same file list Pi shows for `@` appears; Tab completes it as `#@<path>`."). **Research verdict:
  accurate, no change** — BUG-004 altered only the defensive non-`@` item path, invisible to users.
  Also glance at `## #@ versus @` (:218) and the Limits "No autocomplete for in-file imports" bullet
  (:210) — both unaffected. Fix only on a concrete contradiction.
- **(a) BUG-005 — ALWAYS the mandatory edit** (Task 1), regardless of verification outcomes.

### Success Criteria

- [ ] Task 0 pre-flight greps all pass (all 7 dependency fixes confirmed in tree) BEFORE any edit.
- [ ] Limits hostname bullet ends with the scheme sentence; `grep -c "ftp" README.md` → exactly 1.
- [ ] Syntax Line range paragraph carries exactly one malformed-range sentence (landed rider or yours).
- [ ] Verification checks (b), (c-part-1), (d) each recorded as pass/fail; failures fixed minimally.
- [ ] `npm test` green (all 4 suites), `npm run typecheck` → 0 errors, run once after edits.
- [ ] `git diff --stat` → ONLY README.md; ≤2 hunks; net +≤2 lines (unless a verification failure
      legitimately demanded a fix — then document it in the task report).

## All Needed Context

### Context Completeness Check

"If someone knew nothing about this codebase, could they implement this from the PRP alone?" — Yes:
every edit target is quoted verbatim with unique anchor strings (grep-anchored, not line-number
anchored — riders may shift lines), the exact sentence to write is given, the conditional logic has
an explicit grep decision, and validation is grep + the repo's two gates.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: README.md
  why: THE file being edited — read fully once (223 lines at HEAD) before any edit
  pattern: hard-wrapped prose (~100-110 col), ## sections, - **bold lead.** bullets in ## Limits
  gotcha: line numbers in the work-item contract (:211 etc.) are PRE-rider (221-line tree); use the
    grep anchors in this PRP — at HEAD 223 lines the hostname bullet is :216, Line range para :127-130

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T1S1/research/research_notes.md
  why: verified line map (old vs HEAD anchors), rider states at HEAD 3c0bb5d, pre-flight greps
  pattern: §2 line-map table, §5 pre-flight greps, §6 validation greps
  gotcha: HEAD may have moved (BUG-005/P1.M3.T5.S1 lands after research) — re-grep, don't trust lines

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/spec_ux_bug004_005.md
  why: § README/docs landscape (section map) + § BUG-005 Option comparison (the Limits sentence is
    Option B's wording, still accurate post-Option-A because it describes outcome not mechanism)
  section: "README/docs landscape", "Option comparison"
  gotcha: that doc's line numbers are ALSO pre-rider (221-line README); anchors only

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M3T5S1/PRP.md
  why: BUG-005's contract — confirms it defers the README bullet HERE and lands ftp in URL_SHAPE_RE
    with the :1715 normalization sync (gate accepts ftp → fetch throws → verbatim)
  gotcha: do NOT re-do its spec/15 §7 correction (that's its job / S2's review), only README

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M3T4S1/PRP.md
  why: BUG-004's contract — consumed_by line confirms "NO autocomplete README change from this task"
  gotcha: its code region is getSuggestions item map (~:1959-1963) — irrelevant to README, cite only

- url: https://github.com/dabstractor/pi-file-injector
  why: the published README renders on npm/GitHub — keep markdown valid (no broken emphasis/links)
  critical: the new sentence must not break the existing [Limits](#limits) anchor links elsewhere
```

### Current Codebase tree (docs-relevant only)

```bash
# run: ls + git log --oneline -8 in repo root
README.md            # 223 lines at HEAD 3c0bb5d — the ONLY user doc; the ONLY file you edit
file-injector.ts     # 1932+ lines — read-only for pre-flight greps (Task 0), never edit
spec/                # 17-file hand-written PRD + SPEC.md index — OFF-LIMITS (sibling task S2)
package.json         # scripts: typecheck / test (4 chained suites) — your clean-tree gates
# git log (README-relevant): 3c0bb5d BUG-004 code-only | fe766bd BUG-003 Images rider (last README
# commit) | 71e9f45/c626928/21bf4fa BUG-001 code-only | earlier commits predate the bug report
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
README.md            # +1 mandatory sentence (Limits/hostname bullet), +1 conditional sentence
                     # (Syntax/Line range paragraph) — no new files anywhere
```

### Known Gotchas of our codebase & Library Quirks

```markdown
# CRITICAL: Line anchors drift. The work-item contract cites :211/:44-46/:94 (221-line tree);
# riders pushed the tree to 223 lines at research HEAD, and the BUG-005 commit may shift more.
# ALWAYS anchor edits by grep'd unique strings (given below), never by line number.

# CRITICAL: README must not document unshipped behavior. Task 0's greps are a hard gate — if any
# dependency's code marker is missing, STOP and report (do not write its sentence).

# GOTCHA: No CHANGELOG exists in this repo (verified) — do not create one.

# GOTCHA: The sentence "not fetched and are left as written" is deliberately outcome-worded so it is
# true both pre-BUG-005 (gate rejects ftp) and post-BUG-005 (gate accepts, undici fetch throws →
# catch → verbatim). Do NOT word it as "rejected by the URL shape check" — that would re-drift
# after BUG-005 lands. (Post-BUG-005 the gate DOES accept ftp; Node fetch cannot retrieve it.)

# GOTCHA: README prose is hard-wrapped (~100-110 chars/line) — wrap the appended sentences to match
# the neighboring lines (see the BUG-003 rider's continuation-line style at :83-84).

# GOTCHA: ## Limits bullets start "- **Bold lead.**" — append your sentence INSIDE the existing
# hostname bullet (it is one physical line ending "…rather than an IP or `localhost`."),
# not as a new bullet.
```

## Implementation Blueprint

### Data models and structure

None — Markdown documentation. The two "models" are the exact sentences:

```markdown
# 1) MANDATORY — append to the end of the ## Limits hostname bullet
#    (bullet ends with: "rather than an IP or `localhost`.")
Explicit schemes other than `http(s)://` (e.g. `ftp://…`) are not fetched and are left as written.

# 2) CONDITIONAL — append to the end of the ## Syntax **Line range.** paragraph
#    (paragraph's last line: "The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`).")
A malformed range (`#@a.ts:0`, `#@a.ts:5-3`) is left verbatim with a warning — at the prompt and inside a delivered markdown file alike.
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 0: PRE-FLIGHT — verify all seven dependency fixes are in the tree (read-only; HARD GATE)
  - RUN (in repo root, expect all to hit):
    1. grep -n '(https?|ftp)' file-injector.ts        # BUG-005: URL_SHAPE_RE (~:43) contains ftp
    2. grep -n 'invalidRange' file-injector.ts        # BUG-002: ≥3 hits incl. injectMarkdown Step-5
    3. grep -n 'formatEmptyImageBlock' file-injector.ts  # BUG-003: call inside injectUrl image branch
    4. grep -n 'startsWith("@")' file-injector.ts     # BUG-004: item-level pass-through map (~:1959+)
    5. git log --oneline | grep -E 'tier-3|computeDetailOffsets|binary|url'  # BUG-001 trio landed
  - RUN baseline: npm test && npm run typecheck   # must be green BEFORE you edit
  - IF any marker missing → STOP, report "dependency not landed", do not edit README
  - READ README.md fully once (223+ lines)

Task 1: MANDATORY EDIT — README.md ## Limits hostname bullet (BUG-005)
  - FIND (grep anchor, unique): the single line starting "- **URLs need a dotted, alphabetic hostname.**"
    (## Limits section; at research HEAD :216; it ends "…rather than an IP or `localhost`.")
  - APPEND (same physical line or a wrapped continuation per neighboring style):
    " Explicit schemes other than `http(s)://` (e.g. `ftp://…`) are not fetched and are left as written."
  - PLACEMENT: inside that bullet, NOT a new bullet; ## Limits is the last section before `## #@ versus @`
  - DO NOT: word it via the shape-gate mechanism (see Gotchas); touch any other Limits bullet

Task 2: CONDITIONAL EDIT — README.md ## Syntax Line range paragraph (BUG-002 sweep-closure)
  - DECIDE: grep -i "malformed" README.md — if a malformed-range sentence exists in the
    **Line range.** paragraph (grep -n '\*\*Line range\.\*\*' → paragraph at ~:127-130), SKIP to 3
  - IF ABSENT (research-HEAD state): APPEND after the paragraph's last line
    (unique anchor: "The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`)."):
    " A malformed range (`#@a.ts:0`, `#@a.ts:5-3`) is left verbatim with a warning — at the prompt and inside a delivered markdown file alike."
  - ACCURACY: post-BUG-002 both paths warn (LR-3 parity: processTokenStream + injectMarkdown Step-5);
    hasUI-guarded notify, token stays verbatim. One sentence, no examples beyond the two tokens shown.
  - DO NOT: duplicate the "Images/binaries ignore :N" sentence or re-explain paging

Task 3: VERIFICATION-ONLY SWEEP — record pass/fail for each; fix minimally ONLY on failure
  - CHECK (b) BUG-001: grep -n "On submit, each file shows up" README.md  (:50 region) and
    grep -n "Both \`#example.com\`" README.md (:62 region) — verdict expected PASS (see What §)
  - CHECK (c-1) BUG-003: grep -n "comes back empty (0 bytes)" README.md (:82-84) — expected PRESENT
  - CHECK (d) BUG-004: grep -n "Path completion works in the editor" README.md (:96) — expected PASS;
    also read ## #@ versus @ (:218) and the "No autocomplete for in-file imports" Limits bullet
  - ON FAILURE: edit ONLY the contradicted sentence, keep the fix to one clause; note it in the report

Task 4: CLEAN-TREE CONFIRMATION (docs-only — gates confirm the tree, not the prose)
  - RUN: npm test          # all 4 suites green (file-injector / import-behavior / relative-imports / url-injection)
  - RUN: npm run typecheck # 0 errors
  - RUN: git diff --stat   # ONLY README.md, ≤2 hunks (plus any justified verification fix)
  - RUN docs greps (see Validation Level 3)
```

### Implementation Patterns & Key Details

```markdown
# PATTERN: minimal-append editing (the whole task's shape). Anchor on a unique grep'd string,
# append inside the existing structure, match the neighbor's wrap style. Example — Task 1 result
# (hostname bullet, wrapped like its neighbors):
- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://` URL **or** a bare
  host whose final label is 2+ letters … give it a resolvable hostname (an `/etc/hosts` alias, a
  `*.local` name, or a real domain) rather than an IP or `localhost`. Explicit schemes other than
  `http(s)://` (e.g. `ftp://…`) are not fetched and are left as written.

# GOTCHA: never introduce a scheme claim the code contradicts. Today's truth (all states):
# http(s) → fetched; ftp and any other explicit scheme → token verbatim, nothing injected.
```

### Integration Points

```yaml
CODE: none (read-only greps only)
SPEC: none — spec/15 §7 ftp row and spec/14 §14.2 belong to P1.M3.T5.S1 / P1.M4.T6.S2. DO NOT EDIT spec/.
CONFIG: none
ANALYTICS/BILLING: none
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Markdown sanity — no lint tool is configured in this repo; verify by inspection + grep:
grep -n "ftp" README.md            # exactly 1 hit (your new sentence)
grep -ci "malformed" README.md     # 2 (config :179-region + your Syntax sentence) — or 1 if rider landed elsewhere
grep -n "](#limits)" README.md     # existing anchor links still intact (count unchanged)
# Re-read both edited regions in full — emphasis marks balanced, no double spaces after periods
# beyond the file's existing style, wrap width matches neighbors.
```

### Level 2: Unit Tests (Component Validation)

```bash
# None for docs — the repo has no markdown linter/test. Level 4's clean-tree run covers regression.
```

### Level 3: Integration Testing (System Validation)

```bash
# Clean-tree confirmation (required by the work-item contract — run ONCE after edits):
npm test            # expect: file-injector / import-behavior / relative-imports / url-injection all pass
npm run typecheck   # expect: 0 errors
# Docs greps:
grep -c "ftp" README.md                                  # 1
git diff --stat                                          # README.md only, ≤2 hunks
git diff README.md | grep -c "^+"                        # ≤4 added lines (2 sentences, possibly wrapped)
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Behavioral cross-check that the new Limits sentence matches the shipped code (post-BUG-005):
grep -n '(https?|ftp)' file-injector.ts | head -3        # gate accepts ftp …
# … and Node's fetch cannot retrieve it (undici has no ftp client) → outcome = verbatim, i.e.
# "not fetched and are left as written" is exactly what a user observes. No runtime test needed —
# the dependency subtasks already pinned this in url-injection.test.mjs.
# Rendered-README spot check: open README.md in an editor/previewer; confirm the Limits bullet and
# the Syntax paragraph render as single logical blocks (no broken list structure).
```

## Final Validation Checklist

### Technical Validation

- [ ] Task 0 pre-flight: all 5 marker greps hit; `npm test` + `npm run typecheck` green pre-edit.
- [ ] Task 1 done: hostname bullet carries the scheme sentence; `grep -c "ftp" README.md` = 1.
- [ ] Task 2 decided by grep; sentence present exactly once in `## Syntax` (yours or landed rider).
- [ ] Task 3: pass/fail recorded for (b), (c-1), (d); any fix is a minimal clause.
- [ ] Post-edit: `npm test` green; `npm run typecheck` 0 errors; `git diff --stat` → README.md only.

### Feature Validation

- [ ] All success criteria from "What" met.
- [ ] Manual: re-read `## Limits` and `## Syntax` end-to-end — no contradiction with
      `### URLs` (:52–96) or `## #@ versus @` sections.
- [ ] README documents only shipped behavior (pre-flight gate proves it).
- [ ] No spec/ file touched (S2's job); no code/test file touched.

### Code Quality Validation

- [ ] Edits follow the file's existing conventions (hard-wrap ~100-110, `- **bold lead.**` bullets).
- [ ] Sentences are outcome-worded (no mechanism drift risk — see Gotchas).
- [ ] Net diff ≤ +4 lines unless a verification failure justified more (documented if so).

### Documentation & Deployment

- [ ] README renders correctly on GitHub/npm (balanced markdown, intact anchors).
- [ ] No environment variables, config, or install steps introduced (none apply).

---

## Anti-Patterns to Avoid

- ❌ Don't rewrite or "improve" unrelated README prose — this is a sweep, not a rewrite.
- ❌ Don't trust line numbers from the work-item contract or architecture doc — grep anchors only.
- ❌ Don't edit `spec/` (P1.M4.T6.S2), code, tests, or package.json; don't create a CHANGELOG.
- ❌ Don't word the ftp sentence around the shape-gate mechanism ("rejected by the check") — post-BUG-005
  the gate ACCEPTS ftp and the fetch itself fails; describe the user-visible outcome.
- ❌ Don't skip Task 0 — documenting an unshipped fix is the one way this task can ship a lie.
- ❌ Don't add the malformed-range sentence if the dependency's rider already landed it (duplicate).

---

**Confidence Score: 9/10** — one-pass success highly likely: docs-only, both sentences pre-written,
every anchor grep-verified at HEAD with drift handling, conditional logic has an explicit decision
grep, and validation is mechanical. The one residual: HEAD will move when P1.M3.T5.S1 (BUG-005) lands
— mitigated by Task 0's marker greps and outcome-worded sentences that are true in both states.