---
name: "P1.M4.T6.S1 — README.md changeset sweep (Limits, URLs, Syntax, Usage)"
description: "Sync README.md, the only user doc, with the shipped BUG-001..BUG-005 fixes. Two required edits (Limits ftp sentence, Syntax malformed-range sentence) + three confirm-only passes. Docs-only task: no code, no tests, no spec/ changes."
---

## Goal

**Feature Goal**: README.md fully and accurately describes the behavior shipped by the five bug fixes (BUG-001..BUG-005) in changeset `plan/011_e473dac8178b/bugfix/001_a6ffb98ab096`, with zero statements that contradict the code in `file-injector.ts`.

**Deliverable**: A minimal-diff edit to `README.md` only — (a) one new sentence about malformed line ranges in the `## Syntax` **Line range.** paragraph (BUG-002 rider that never landed), (b) an updated scheme claim + ftp fallback sentence in the `## Limits` hostname bullet (BUG-005 residual documentation), plus a verified confirm-only pass over the BUG-001/BUG-003/BUG-004 anchors. No other file changes.

**Success Definition**: `git diff --stat` shows README.md as the only modified source file; `grep -i ftp README.md` returns the new Limits text; the Syntax paragraph documents malformed-range warn-and-verbatim behavior; `npm test` (4 harnesses) and `npm run typecheck` are green on the untouched code; no README statement contradicts shipped behavior.

## User Persona (if applicable)

**Target User**: A pi extension user installing `pi-file-injector` who reads README.md to learn what `#@file` / `#url` tokens do, their limits, and their edge-case behavior.

**Use Case**: User types a malformed range (`#@a.ts:5-3`) or an ftp URL (`#ftp://mirror.example/x`) and consults README to understand why nothing was injected (a warning notify / a fetch failure leaving the token verbatim).

**Pain Points Addressed**: README currently promises/says nothing about malformed ranges, and its Limits bullet implies only `http(s)://` schemes are URL-shaped — both now diverge from shipped behavior after this changeset.

## Why

- The PRD §Recommendations explicitly requires code and documentation to agree after the BUG-005 decision ("so code and PRD text agree"), and the changeset-level docs task (this one, Mode B in the plan) is the designated sweep point after all seven implementing subtasks completed.
- BUG-002's implementing subtask (P1.M2.T2.S1) carried a Mode A rider to update the README Syntax line-range paragraph, but it never landed (verified: last README-touching commit in this changeset is `fe766bd`, the BUG-003 bullet only). This sweep closes that gap.
- BUG-001's fix changed only display correctness (expanded-view body pairing) — README wording was already generic and remains true, but the sweep must verify rather than assume.

## What

README.md content edits (behavior unchanged — this is documentation only):

1. `## Syntax` → `**Line range.**` paragraph gains a malformed-range sentence: ranges like `:0` or `:5-3` (end before start) inject nothing, are left exactly as typed, and produce a one-line warning — both at the prompt and inside delivered markdown files.
2. `## Limits` → hostname bullet: the first sentence's scheme list expands to include `ftp://`, and the bullet gains a sentence explaining that `ftp://` is recognized but never injects — Node's `fetch` cannot retrieve ftp, the fetch is genuinely attempted and fails, and the token is left as written (the loading indicator may flash briefly).
3. Confirm-only (expected NO edits, record findings): expanded-view paragraphs (BUG-001), the Images bullet empty-body note (BUG-003), the Path-completion sentence (BUG-004).

### Success Criteria

- [ ] README documents malformed-range behavior (`:0`, `:5-3` → verbatim + warning, prompt and markdown-level)
- [ ] README hostname bullet no longer claims only `http(s)://` schemes pass the gate; ftp:// described accurately (attempted fetch → failure → verbatim)
- [ ] ftp wording is consistent with the corrected spec/15 §7 row (spec/15-url-injection.md:325) — README is user-facing prose, spec is source of truth
- [ ] BUG-001/003/004 anchors verified accurate; any edit there (only if a real contradiction is found) is minimal and recorded
- [ ] `git diff --stat` touches README.md only; `npm test` + `npm run typecheck` green

## All Needed Context

### Context Completeness Check

An implementer who has never seen this repo can complete this PRP using only this document plus the files it names: every edit is anchored by exact quoted text, with the shipped behavior spelled out (so no code archaeology is required to word the sentences).

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: README.md
  why: The ONLY file you will edit. Locate edits by TEXT ANCHOR (line numbers below verified 2025-08-18 but may drift)
  pattern: |
    - ## Usage expanded-view para at :50 ("On submit, each file shows up as a compact green `read <path>` line …")
    - ### URLs green-line para at :62; Images bullet at :83-85 (already has the BUG-003 empty-image note, landed in commit fe766bd)
    - Path completion sentence at :96
    - ## Syntax **Line range.** paragraph at :129-134, last sentence "The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`)."
    - ## Limits URL bullets at :211-216; hostname bullet at :216 ("- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://` URL **or** a bare host …")
  gotcha: The tasks.json contract cites older line numbers (:44-46, :61, :94, :211) from a pre-changeset README snapshot — ALWAYS locate by quoted text, never by line number.

- file: spec/15-url-injection.md
  why: Source of truth for ftp behavior; §7 edge-table row at :325 was already corrected by P1.M3.T5.S1
  pattern: "`ftp://` scheme | accepted by `URL_SHAPE_RE` (§2.2 literal), but Node's `fetch` (undici) has no ftp support — the fetch throws (`TypeError: fetch failed`), so the token falls back to verbatim via the §3.5 catch (no block, no injection; the §3.6 footer spinner may flash — a fetch is genuinely attempted)."
  gotcha: DO NOT edit spec/ — that is sibling task P1.M4.T6.S2 (spec/ consistency pass). Mirror its meaning in user-facing prose.

- file: file-injector.ts
  why: Behavior ground truth for the two edits. READ ONLY — do not modify.
  pattern: |
    - URL_SHAPE_RE (~:50): now /^((https?|ftp):\/\/\S+|…)$/i — ftp passes the shape gate
    - URL_SCHEME_RE const (right after URL_SHAPE_RE): shared /^(?:https?|ftp):\/\//i used by BOTH the code-extension deny-list guard and the https:// normalization (~:1721-1726), so `ftp://x` bypasses the deny-list and is never mangled to `https://ftp://x`
    - injectMarkdown Step-5 loop: now skips rec.invalidRange and emits the same LR-3 warning as the top level (BUG-002 fix) — this is why the README sentence covers markdown files too
  gotcha: The BUG-005 fix is UNCOMMITTED in the working tree — `git diff HEAD -- file-injector.ts` shows it; do not be surprised it's not in git log.

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T6S1/research/research_notes.md
  why: This task's research: commit evidence, per-fix deltas, wording-decision rationale
  section: "Per-fix README deltas"

- url: https://nodejs.org/api/globals.html#fetch
  why: Node's fetch (undici) supports http/https only — the factual basis for "Node's fetch cannot retrieve ftp"
  critical: Do not over-claim in README ("ftp is rejected") — the fetch IS attempted and fails; that distinction matters and matches spec §7.

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/spec_ux_bug004_005.md
  why: Background on BUG-004/BUG-005 and the README/docs landscape
  section: README/docs landscape

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/injection_bug002_003.md
  why: Background on BUG-002 (malformed-range parity) if wording details are needed
```

### Current Codebase tree (relevant parts)

```bash
pi-file-injector/
├── README.md                  # ← THE ONLY FILE TO EDIT (221 lines)
├── file-injector.ts           # extension source (READ ONLY here; BUG-005 fix uncommitted in tree)
├── spec/                      # 17-part spec (OFF-LIMITS — sibling task P1.M4.T6.S2)
├── file-injector.test.mjs     # test harnesses (OFF-LIMITS — docs-only task)
├── import-behavior.test.mjs
├── relative-imports.test.mjs
├── url-injection.test.mjs
├── package.json               # scripts: npm test, npm run typecheck
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/          # renderer_bug001.md, injection_bug002_003.md, spec_ux_bug004_005.md
    ├── P1M4T6S1/              # this task: PRP.md, research/research_notes.md
    └── tasks.json             # plan contract (READ ONLY — never modify)
```

### Desired Codebase tree with files to be added/changed

```bash
# ONLY ONE FILE MODIFIED:
M README.md        # +2 small edits (Syntax malformed-range sentence; Limits ftp scheme wording)
# NOTHING else. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```python
# CRITICAL: Line-number drift. The plan contract and architecture docs cite README lines from an
# older snapshot (:44-46, :61, :94, :211). Current verified anchors: :50, :62, :96, :216. ALWAYS
# locate edit sites by the quoted text anchors in this PRP, never by bare line numbers.

# CRITICAL: The tasks.json contract for this subtask suggests wording "explicit schemes other
# than http(s):// (e.g. ftp://…) are not fetched and are left as written" — that sentence PREDATES
# the implemented Option A (P1.M3.T5.S1 extended URL_SHAPE_RE to accept ftp). Shipped behavior:
# a fetch IS genuinely attempted (footer spinner may flash) and FAILS (undici has no ftp client),
# then the token falls back verbatim. Write what shipped, mirroring spec/15 §7 (:325), not the
# stale contract sentence.

# CRITICAL: scope fence. README.md ONLY. Do NOT touch spec/ (P1.M4.T6.S2), file-injector.ts,
# tests, tasks.json, or PRD artifacts. Do NOT "helpfully" rewrite other README sections — the
# contract mandates "Keep edits minimal — this is a sweep, not a rewrite."

# GOTCHA: preserve the internal contrast inside the hostname bullet — the IP/localhost sentence
# says "left verbatim with no fetch and no error", while ftp is "fetch attempted, fails, left
# written". Do not collapse these into one claim; they are deliberately different.

# GOTCHA: README is user-facing prose (no undici/TypeError/regEx internals). Spec-level mechanics
# live in spec/15. Keep README sentences in README's established voice (see neighboring bullets).

# GOTCHA: no test reads README.md; a green `npm test` proves nothing about doc content — the
# grep assertions in the Validation Loop are the actual gate for this task.

# NOTE: The BUG-005 code changes sit UNCOMMITTED in the working tree (git status: M file-injector.ts,
# M spec/15-url-injection.md, M url-injection.test.mjs). That is expected — do not commit them,
# do not revert them; your README edit coexists with them.
```

## Implementation Blueprint

### Data models and structure

None — documentation-only task. The "model" is README.md's section structure (Usage / URLs / What gets injected / Syntax / Limits / `#@` versus `@`), which stays byte-identical except the two targeted edits.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: VERIFY the ground truth (read-only, before editing)
  - READ README.md in full (221 lines) — confirm the anchors quoted in the Documentation & References YAML
  - RUN: git log --oneline -- README.md  (confirm fe766bd is the last README touch: the BUG-003 Images bullet)
  - RUN: grep -n -i ftp README.md  (expect: no matches — this is the gap you will close)
  - RUN: git diff HEAD -- file-injector.ts  (see the uncommitted BUG-005 Option A: URL_SHAPE_RE (https?|ftp) + URL_SCHEME_RE)
  - READ spec/15-url-injection.md:322-326 (the corrected §7 ftp row — your wording mirror)
  - CHECKPOINT: if any anchor cannot be found (README changed since this PRP), STOP, re-locate by
    nearest text, and record the drift in your completion notes.

Task 2: EDIT README.md ## Syntax — malformed-range sentence (BUG-002 rider, never landed)
  - LOCATE: ## Syntax → the **Line range.** paragraph; its final sentence is
    "The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`)."
  - ADD one sentence immediately after it (draft — polish allowed, facts fixed):
    "A malformed range — `:0`, or `:5-3` (end before start) — injects nothing: the token is left
    exactly as you typed it and a one-line warning explains why, both in your prompt and inside a
    delivered markdown file."
  - FACTS that must survive any rewording: (1) nothing injected for that token, (2) token stays
    verbatim, (3) a warning is shown, (4) identical behavior at prompt level and markdown-import level.
  - DO NOT touch the other sentences of the paragraph (paging, multiple ranges, dedup — all accurate).

Task 3: EDIT README.md ## Limits — hostname bullet scheme wording + ftp sentence (BUG-005 residual)
  - LOCATE: ## Limits → the bullet starting "- **URLs need a dotted, alphabetic hostname.**"
  - EDIT its first sentence: "A `#<url>` token must be a `http(s)://` URL **or** a bare host whose
    final label is 2+ letters" → include ftp in the scheme list, e.g.
    "…must be an `http(s)://` or `ftp://` URL **or** a bare host…".
  - APPEND one sentence at the end of the bullet (draft — polish allowed, facts fixed):
    "`ftp://` is recognized but never injects: Node's `fetch` cannot retrieve ftp, so the fetch is
    genuinely attempted, fails, and the token is left as written (the loading indicator may flash
    briefly)."
  - FACTS that must survive: (1) ftp passes the shape gate (hence "recognized"), (2) a fetch IS
    attempted (contrast with the IP/localhost sentence's "no fetch"), (3) it fails, (4) token left
    as written / nothing injected.
  - KEEP the rest of the bullet byte-identical (deny-list, #https://foo.sh escape hatch, IP/localhost note).

Task 4: CONFIRM-ONLY pass (expected: zero edits; record findings either way)
  - BUG-001 — expanded-view wording at the ## Usage para ("On submit, each file shows up as a
    compact green `read <path>` line … Press `ctrl+o` to expand"), the ### URLs green-line para
    ("Each URL renders as a green `read <url>` line … `ctrl+o` expands it to the extracted
    markdown"), and the ## What gets injected display para. None of these ever described body
    pairing, so the BUG-001 fix needs no rewording. Edit ONLY if you find a sentence that is now
    false; keep it minimal and note it.
  - BUG-003 — ### URLs Images bullet (three sentences ending with the 0-byte note landed in
    fe766bd). Confirm it reads coherently in context; no edit expected.
  - BUG-004 — Path completion sentence ("Path completion works in the editor. Type `#@` and the
    same file list Pi shows for `@` appears; Tab completes it as `#@<path>`."). BUG-004 changed
    only a defensive path (non-@ suggestion values now pass through untouched) — nothing
    user-visible. No edit expected.
  - SWEEP for stragglers: grep -n 'http(s)' README.md and skim the Limits URL bullets (:211-216)
    for any other scheme claim that now contradicts the ftp gate change. Fix only direct contradictions.

Task 5: VALIDATE (see Validation Loop) and report
  - RUN npm test && npm run typecheck (both must pass — the tree must be clean-broken-by-nothing)
  - RUN the grep assertions below
  - RUN git diff --stat — expect exactly: `README.md | <n> +-` (plus the pre-existing uncommitted
    BUG-005 files file-injector.ts / spec/15-url-injection.md / url-injection.test.mjs and plan/
    artifacts, which you must NOT have touched — verify with `git diff --stat -- README.md` and
    confirm the other files' diffs are unchanged from Task 1's baseline)
```

### Implementation Patterns & Key Details

```python
# This is a docs task — the "pattern" is minimal-diff surgical editing:
# 1. NEVER reflow or re-wrap untouched lines: the README uses hard-wrapped prose (some bullets
#    wrap at ~90 cols, others run long). Match the wrap style of the immediate neighborhood.
# 2. One logical change per edit site; both edits are additive sentences (plus a two-word scheme
#    list change), not restructuring.
# 3. README voice: second person, em-dashes, backticked tokens (`#@a.ts:5-3`, `ftp://`),
#    bold lead-ins only where neighbors use them. Mirror the surrounding bullet style.
# 4. Do not introduce internal jargon (undici, URL_SHAPE_RE, LR-3, §3.5) into README —
#    those live in spec/15; README speaks behavior only.
```

### Integration Points

```yaml
NONE:
  - No code, config, routes, or data integrations. The only "integration" is textual coherence
    with spec/15-url-injection.md §7 (owned by sibling task P1.M4.T6.S2 — do not edit spec/).
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Markdown sanity: no lint tool is configured in this repo; rely on structure checks instead.
grep -c '^## ' README.md        # heading structure intact (expect same count as before your edit)
git diff README.md             # review: only the two edit sites + any Task-4 finding
# Expected: diff shows additive sentences only; no reflowed paragraphs.
```

### Level 2: Content Assertions (the real gate for a docs task)

```bash
# BUG-005 sentence landed (was: zero ftp mentions before this task)
grep -n -i 'ftp' README.md
# Expected: >= 2 matches — the scheme list in the hostname bullet AND the ftp fallback sentence.

# BUG-002 sentence landed
grep -n '5-3' README.md && grep -n -i 'malformed' README.md
# Expected: the Syntax malformed-range sentence present, mentioning the warning and markdown files.

# BUG-003 rider still present (landed earlier in fe766bd — must not be lost)
grep -n 'empty image file — 0 bytes' README.md   # or the “empty (0 bytes)” phrasing in the Images bullet

# No stale http(s)-only scheme claim remains
grep -n 'must be a `http(s)://` URL' README.md
# Expected: no match (the phrase was updated to include ftp://)
```

### Level 3: Full Suite (confirm the tree is still healthy)

```bash
npm test            # node ./file-injector.test.mjs && import-behavior && relative-imports && url-injection
npm run typecheck   # node ./scripts/typecheck.mjs
# Expected: all green, byte-identical behavior (no code changed).

git status --short
# Expected: README.md newly modified; pre-existing uncommitted changes (file-injector.ts,
# spec/15-url-injection.md, url-injection.test.mjs, plan/ artifacts) unchanged from baseline.
```

### Level 4: Coherence Review (manual pass)

```bash
# Read the three edited/verified regions in final form:
sed -n '/## Syntax/,/Trailing punctuation/p' README.md     # malformed-range sentence in context
sed -n '/## Limits/,/## `#@/p' README.md                   # hostname bullet end-to-end
# Check: sentences flow with neighbors; no duplicated claims; ftp wording does not contradict the
# IP/localhost sentence ("no fetch") in the same bullet; markdown-level claim in the Syntax
# sentence matches the "Markdown imports" rules five bullets above it.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm test` — all 4 harnesses pass
- [ ] `npm run typecheck` — passes
- [ ] `git diff --stat` — README.md is the only file YOU modified

### Feature Validation

- [ ] Syntax paragraph documents malformed ranges: verbatim + warning, prompt and markdown level
- [ ] Limits hostname bullet lists `ftp://` in the scheme set and explains attempted-fetch-fails-verbatim
- [ ] ftp wording consistent with spec/15-url-injection.md §7 (:325) corrected row
- [ ] BUG-001 expanded-view wording verified accurate (no edit unless a real contradiction found)
- [ ] BUG-003 Images bullet verified present and coherent (landed in fe766bd)
- [ ] BUG-004 Path-completion sentence verified accurate (no edit)
- [ ] All Level-2 grep assertions pass

### Code Quality Validation

- [ ] Minimal-diff discipline: additive sentences only; no section rewrites; neighbor wrap style matched
- [ ] No internal jargon (URL_SHAPE_RE, undici, LR-3, §-refs) leaked into README prose
- [ ] spec/, tests, code, tasks.json, plan artifacts untouched

### Documentation & Deployment

- [ ] README remains the single user doc; no new files created
- [ ] Findings from the confirm-only passes recorded in the completion report (even "no edit needed")

## Anti-Patterns to Avoid

- ❌ Don't rewrite sections wholesale — the contract says sweep, not rewrite; reviewers will reject large diffs
- ❌ Don't copy the stale tasks.json wording "not fetched" for ftp — a fetch IS attempted; mirror shipped behavior and spec §7
- ❌ Don't edit spec/15-url-injection.md even for a typo you notice there — that's P1.M4.T6.S2's file
- ❌ Don't add test cases or touch code — this task ships docs only
- ❌ Don't reflow/re-wrap untouched lines (creates diff noise and merge risk)
- ❌ Don't cite implementation internals (undici, TypeError, regexes) in user-facing README prose

---

## Confidence Score

**9/10** — Docs-only task with both required edits fully specified (exact anchors, draft wording, fixed facts), behavior ground truth pinned to code diff + corrected spec §7 row, and validation reduced to deterministic greps + the standard green-suite gate. The single residual uncertainty is minor wording polish, which cannot break behavior.