---
name: "P1.M1.T2.S1 — Update README.md Why / What-gets-injected / Limits / #@-versus-@ for paged delivery"
prd_ref: "PRD §1 Solution/Value, §2 Goals/Non-Goals, §5.1/§5.5 (inline-vs-paged), §6.1 (<file> format), §13.1/§13.2 (honest contract + tradeoff)"
target_file: "./README.md"  # EDIT IN PLACE — Mode B (this IS the changeset-level doc sync)
change_type: 5 surgical exact-text replacements across 4 sections. No code. No tests. No other files.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1–S3 (the paged-delivery behavior this doc describes) — S1/S2 Complete, S3 in progress; README edits are independent of S3 (disjoint file)"
---

# PRP — P1.M1.T2.S1: README Paged-Delivery Doc Sync (Mode B)

## Goal

**Feature Goal**: Reconcile the three (effectively four) factually-stale README sections with the
paged-delivery behavior shipped in P1.M1.T1 (PRD §5.5). The README currently promises "no size
limit / no truncation / No size gate" — the *retracted* framing (PRD §13.1 retracts it as "dishonest").
Replace those claims with the honest contract: **the whole file always reaches the model — injected
whole when it fits the remaining context budget, paged via the `read` tool when it exceeds it — with no
user-facing configuration.** Also fix the closing `#@`-versus-`@` sentence, whose "size limit" clause
is now misleading.

**Deliverable**: 5 surgical exact-text replacements in `./README.md` (the contract's edit "a" spans two
spots: L3 and L9; plus b, c, d). No new files. No code. No tests. Mode B — this task IS the
changeset-level documentation sync.

**Success Definition**:
- [ ] All 5 edits land exactly as specified (L3, L9, L41, L72, L83). `diff` against the pre-verified
      temp copy shows EXACTLY those 5 changed lines, nothing else.
- [ ] Every stale claim is GONE: `grep -nE "no size limit|always injects the entire file|no truncation|No size gate|a size limit|You write it, the file goes in"` → **no matches**.
- [ ] Every new phrase is PRESENT: "the whole file always reaches the model", "always delivers the
      entire file to the model", "head block plus a paging directive", "No size knob", "first ~8 KB",
      "property of the medium, not of this extension", "browse or search without loading the whole file".
- [ ] README markdown stays well-formed: all 8 section headers + the 4-row "What gets injected" table
      intact; line count ~83 (the edits are in-place line swaps).
- [ ] Convention fidelity: backticks around `#@`/`read`/`pi -p`; **straight ASCII apostrophe** in
      "doesn't" (NOT curly U+2019); **U+2014 em dashes** (NOT hyphens).

> **Scope boundary (read carefully):** This task touches ONLY `./README.md`, and within it ONLY the 5
> exact text spans below. It does **NOT**: (a) edit `file-injector.ts` or `file-injector.test.mjs`
> (owned by the parallel P1.M1.T1 chain — disjoint file, no collision); (b) touch the `## Install`,
> `## Usage`, or `## Syntax` sections; (c) touch the `<file>` block code sample (L48–52) — it stays;
> (d) touch the other 3 `## Limits` bullets (no-spaces / no-dirs / no-globs / backtick) or the
> `## Limits` header; (e) edit PRD.md, package.json, or any plan file. It is a pure prose sync.

## User Persona

**Target User**: The extension's end users reading the README to understand what `#@` does. After the
paged-delivery feature shipped, the README's promises ("no size limit", "no truncation", "No size
gate") are now **false** — a 50 MB file no longer "injects 50 MB"; it is paged. Users who rely on the
README would be misled about oversize-file behavior.

**Use Case**: A user writes `#@huge.log` (a 2 MB log under a tight context budget) and consults the
README to understand why the model then issues `read` calls. The updated "What gets injected" row and
"No size knob" bullet explain it: oversize files are delivered as a head block + paging directive.

**Pain Points Addressed**: The README contradicts the shipped behavior (PRD §13.1: the old framing was
"dishonest"). This task makes the README truthful about inline-vs-paged delivery.

## Why

- **Truth-in-docs.** P1.M1.T1 shipped automatic paged delivery (PRD §5.5). The README's "no size
  limit / no truncation / No size gate" claims are now factually wrong and must be reconciled.
- **The honest contract (PRD §13.1).** "The whole file always reaches the model: injected inline when
  it fits, paged through the `read` tool when it does not." The README should say exactly this.
- **The `#@`-versus-`@` distinction shifted.** With paging, `#@` handles oversize automatically, so
  "Use `@` or `read` when you want … a size limit" is misleading — `#@` no longer has a size limit to
  contrast with. The real distinction is "all of a file" vs "browse/search without loading the whole file."
- **Mode B = this is THE doc sync.** Unlike Mode A (code-adjacent JSDoc, done in P1.M1.T1.S3), Mode B
  is the user-facing README reconciliation. No code changes here; pure documentation.

## What

5 exact-text replacements in `./README.md`, applied top-to-bottom. Full oldText→newText blocks are in
the Implementation Blueprint (Task 1). Summary of the 4 sections touched:

| Edit | Line | Section | Change |
|---|---|---|---|
| a1 | L3 | `# #@file` intro | "with no size limit and no configuration" → inline-or-paged phrasing + "no configuration" |
| a2 | L9 | `## Why` body | "always injects the entire file … You write it, the file goes in." → "always delivers the entire file to the model … head block plus a paging directive" |
| b | L41 | `## What gets injected` table (Text row) | "Entire contents injected, no truncation." → fits-remaining-context + paged delivery + "Never silently truncated." |
| c | L72 | `## Limits` (1st bullet) | "No size gate … injects 50 MB … use the `read` tool" → "No size knob … head block (first ~8 KB) + paging directive … property of the medium" |
| d | L83 | `## #@ versus @` (closing) | "…part of a file or a size limit." → "…browse or search without loading the whole file." |

### Success Criteria

- [ ] The 5 edits above are applied verbatim (anchors match the REAL README bytes; see Gotchas).
- [ ] Stale-claim grep returns nothing (see Level 1b).
- [ ] New-phrase grep returns all hits (see Level 1a).
- [ ] `diff README.md <pre-verified temp copy>` = exactly the 5 lines (Level 3).
- [ ] No other file changed.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the verbatim current README text for all 5 anchors
> (verified unique via `cat -A`), the exact newText (rendered in the README's markdown convention:
> backticks, straight apostrophes, U+2014 em dashes), the pre-verified `diff` (exactly 5 lines), the
> stale-term sweep proving nothing is missed, and a 3-part grep validation gate. No model/API key, no
> build, no linter needed.

### Documentation & References

```yaml
# MUST READ — the contract this README must describe
- docfile: plan/002_0ac3eb160af7/architecture/test_and_docs_analysis.md
  why: "§2 reproduces the CURRENT README verbatim + §2.2 identifies the 3 stale sections (Why L3+L7-9,
        table L41, Limits L72) and flags the L78-83 closing sentence. This is the authoritative map
        of what is stale."
  critical: "§2.2's line references are imprecise in spots (it says 'L7-9' for the paragraph that is
        actually on L9; it does NOT list L3 separately). Use EXACT-TEXT anchors from the verbatim
        README in §2.1, not line numbers."

# MUST READ — the PRD source of truth for the honest contract wording
- docfile: plan/002_0ac3eb160af7/prd_snapshot.md
  why: "§5.5 (paged delivery: head block + directive, HEAD_BYTES=8192≈8KB, model reads via `read`),
        §5.1 (whole when it fits), §13.1 ('the whole file always reaches the model'), §13.2 (the
        tradeoff), §2 Non-Goals ('no silent truncation', 'no user-facing size config'). The README's
        new phrasing mirrors these."
  section: "§1 Solution, §2 Goals/Non-Goals, §5.1, §5.5, §13.1, §13.2"

# MUST READ — the sibling PRP whose behavior this doc describes (and whose convention to mirror)
- docfile: plan/002_0ac3eb160af7/P1M1T1S3/PRP.md
  why: "Defines the handler notify strings ('#@ injected N whole, M paged') and the factory JSDoc
        rewrite (Mode A) — the code-adjacent counterpart of THIS Mode B README sync. Its 'Gotchas'
        set the convention precedent: render the contract's plain ASCII in the file's style
        ('2000x2000' → '2000×2000'). Apply the same rule here ('read tool' → '`read` tool')."
  critical: "S3 edits file-injector.ts/.test.mjs — a DISJOINT file from README. No collision. The two
        tasks can run in parallel safely."

# The file being EDITED
- file: ./README.md
  why: "83-line user-facing doc. The 5 anchors are on L3, L9, L41, L72, L83. Read it in full before
        editing (it's short)."
  pattern: "Plain GitHub-flavored markdown. Backticks for all inline code (`#@`, `read`, `pi -p`,
            extensions). Straight ASCII apostrophes (model's). U+2014 em dashes. One-line table rows."
  gotcha: "The contract's prose quotes DROP the backticks and use plain 'read tool'. RE-APPLY the
           README's backtick convention (see Known Gotchas). Also: the contract's line refs are
           imprecise — match exact text, not line numbers."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # parallel P1.M1.T1 chain edits this — NOT this task
├── file-injector.test.mjs       # parallel P1.M1.T1 chain edits this — NOT this task
├── package.json                 # no deps; NOT touched
├── PRD.md                       # READ-ONLY
├── README.md                    # ← THE FILE BEING EDITED (5 exact-text swaps; Mode B doc sync)
└── plan/002_0ac3eb160af7/
    ├── architecture/{test_and_docs_analysis.md, pi_api_verification.md, …}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / delta_prd.md
    ├── P1M1T1S{1,2,3}/{PRP.md, research/}   # the paged-delivery code (S1/S2 done, S3 in progress)
    └── P1M1T2S1/
        ├── research/research_notes.md      # THIS TASK's research (read it — has the verified diff)
        └── PRP.md                          # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
└── README.md                    # MODIFIED — 5 exact-text replacements (L3, L9, L41, L72, L83).
                                 #   Why/What-gets-injected/Limits/#@-vs-@ reconciled with §5.5.
# No code changes. No test changes. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
CRITICAL — use EXACT-TEXT anchors, not line numbers. The contract said "L7-9" but the target paragraph
  is on L9; the architecture doc's line refs are estimates. Each oldText below is the FULL exact span
  (verified unique in the file via cat -A). Copy it byte-for-byte.

CRITICAL — APOSTROPHES ARE STRAIGHT ASCII (' = 0x27), NOT curly (U+2019). Verified: `model's` on L72
  is straight. The new "doesn't" (edit a1) MUST use a straight '. (A first draft accidentally used a
  curly apostrophe — caught and fixed.) Editors with "smart quotes" can silently curl these — disable
  smart-quote replacement when editing, or paste the exact bytes.

CRITICAL — EM DASHES ARE U+2014 (—), NOT hyphens (-) or en dashes (–). Verified. The new text
  "directive — the model" / "at once — that is" uses U+2014. Do not substitute ASCII "-".

CONVENTION — INLINE-CODE BACKTICKS. The README wraps `#@`, `@`, `@file`, `pi -p`, `read`, `offset`,
  `limit`, and every extension in backticks. The contract's prose quotes drop them ("read tool",
  "#@ always delivers", "pi -p one-shot"). RE-APPLY backticks: `read`, `#@`, `pi -p`. (Precedent:
  sibling PRP P1M1T1S3 rendered the contract's "2000x2000" as the file's "2000×2000".)

OK — "~8 KB" (edit c) matches the shipped HEAD_BYTES = 8192 constant (PRD §5.5). Use "~8 KB" verbatim
  (not "8192 bytes" or "8KB").

OK — the L41 table row gets long but stays a SINGLE markdown table line. GFM tables support long cell
  content; it renders with wrapping. Do NOT split it across lines (that breaks the table).

OK — edit a1 produces a mildly redundant sentence ("The file reaches the model … the whole file always
  reaches the model —"). This is EXACTLY what the contract prescribes (a verbatim phrase swap). Apply
  it as specified; do NOT silently reword it — deviating from the contract is out of scope.

NO LINTER — the repo has no markdownlint / no test framework / no deps. Validation is grep + diff
  (see Validation Loop). Do not try to `npm run` anything.
```

## Implementation Blueprint

### Data models and structure

None. This is a pure prose edit to a markdown file. No types, no code, no schema.

### Implementation Tasks (ordered by file position; each is one exact edit)

```yaml
Task 1: EDIT ./README.md — apply the 5 exact-text replacements (top-to-bottom)
  - Use the `edit` tool with FIVE entries in ONE call (all oldTexts are unique, non-overlapping).
  - Each oldText is verified to appear EXACTLY ONCE in README.md.
  - Do NOT edit any other span. Do NOT reformat adjacent lines.

  Edit a1 (L3 — the opening intro sentence):
    FIND:    with no size limit and no configuration
    REPLACE: the whole file always reaches the model — injected whole when it fits the remaining context, paged via the `read` tool when it doesn't — with no configuration
    (NOTE: straight apostrophe in "doesn't"; U+2014 em dashes; `read` in backticks.)

  Edit a2 (L9 — the ## Why body paragraph; replaces the whole paragraph):
    FIND:    `#@` always injects the entire file, in every context: the editor, a `pi -p` one-shot, and RPC. You write it, the file goes in.
    REPLACE: `#@` always delivers the entire file to the model, in every context: the editor, a `pi -p` one-shot, and RPC. When the file fits the remaining context it is injected whole; when it exceeds the budget it is delivered as a head block plus a paging directive that the model reads through.
    (NOTE: `#@` and `pi -p` in backticks; the "You write it, the file goes in." sentence is intentionally dropped — the contract reword replaces the whole paragraph.)

  Edit b (L41 — the "What gets injected" table, Text row):
    FIND:    | Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected, no truncation. |
    REPLACE: | Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected when they fit remaining context. Oversize files are delivered as a head block plus a paging directive — the model reads the rest via the `read` tool. Never silently truncated. |
    (NOTE: stays ONE table line; U+2014 em dash; `read` in backticks. Do NOT touch the other 3 table rows.)

  Edit c (L72 — the "## Limits" first bullet):
    FIND:    - **No size gate.** `#@` on a 50 MB file injects 50 MB and can overflow the model's context. For large files, use Pi's `read` tool with `offset` and `limit`.
    REPLACE: - **No size knob.** `#@` has no user-facing size setting. Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive; the model reads the rest via the `read` tool. The model never holds a file larger than its context window all at once — that is a property of the medium, not of this extension.
    (NOTE: straight apostrophe in "model's" is in the OLD text only; new text has no apostrophe. U+2014 em dash before "that is a property". `#@`/`read` in backticks. Do NOT touch the other 4 Limits bullets or the header.)

  Edit d (L83 — the "## #@ versus @" closing sentence):
    FIND:    Use `#@` when you want all of a file. Use `@` or the `read` tool when you want part of a file or a size limit.
    REPLACE: Use `#@` when you want all of a file. Use `@` or the `read` tool when you want to browse or search without loading the whole file.
    (NOTE: the first sentence is UNCHANGED; only the second sentence's tail changes — "part of a file or a size limit" → "browse or search without loading the whole file".)

POST-FLIGHT:
  - Run the Validation Loop gates below.
  - The expected `diff` is EXACTLY 5 changed lines (L3, L9, L41, L72, L83). See Level 3.

DO NOT (out of scope):
  * Edit file-injector.ts / file-injector.test.mjs (parallel P1.M1.T1 chain — disjoint file).
  * Touch the Install / Usage / Syntax sections, the ## Limits header, the other 4 Limits bullets,
    the other 3 table rows, or the <file> block code sample (L48-52 — still accurate for the inline path).
  * Reformat/reorder/rewrap adjacent lines or "tidy" the markdown. Only the 5 exact spans change.
  * Edit PRD.md, package.json, or any plan/ file.
```

### Implementation Patterns & Key Details

```markdown
# PATTERN — exact-text phrase swap, preserving the README's markdown convention. The contract gives
# prose; the file uses backticks + straight apostrophes + U+2014 em dashes. Each newText below is the
# contract's prose RENDERED IN THE FILE'S CONVENTION (precedent: P1M1T1S3 "2000×2000").

# PATTERN — keep each edit MINIMAL. Edit a1 swaps one phrase mid-sentence (the sentence's period and
#   preceding text are untouched). Edits a2/c/d replace whole lines/bullets. Edit b swaps one table row.
#   None of them touch adjacent lines.

# WHY edit a1 is a phrase swap (not a full-sentence rewrite): the contract explicitly says
#   "Replace [the phrase] with: 'the whole file always reaches the model — … — with no configuration'."
#   The result is mildly redundant but is exactly what's prescribed; do not "improve" it.

# WHY the code sample (L48-52) is untouched: it shows the inline <file> block format, which is STILL
#   exactly what a whole-file (fits-budget) injection produces. The paged path adds a head block + a
#   directive block, but the inline sample remains accurate for the common case. The contract scopes
#   edit (b) to the table row only.
```

### Integration Points

```yaml
NO RUNTIME INTEGRATION:
  - "Pure documentation edit. No imports, no config, no API surface, no env vars, no code path."
  - "Disjoint from the parallel P1.M1.T1 code tasks (which edit file-injector.ts/.test.mjs). Safe to
    run concurrently; no file conflict."
  - "User-visible: the README now truthfully describes inline-vs-paged delivery (PRD §5.5/§13.1)."
```

## Validation Loop

> This repo has **no test framework, no linter, no markdownlint** (package.json has zero dependencies).
> Like the code tasks, validation is **grep-based + diff-based**, fully non-interactive (no model, no
> build). The gates below have been **verified on this machine**: applying all 5 edits to a temp copy
> and `diff`ing produced exactly the 5 expected line changes.

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. All NEW phrases are PRESENT (9 spot-checks).
for ph in \
  "paged via the \`read\` tool when it doesn" \
  "always delivers the entire file to the model" \
  "head block plus a paging directive that the model reads through" \
  "Entire contents injected when they fit remaining context" \
  "Never silently truncated" \
  "No size knob" \
  "first ~8 KB" \
  "property of the medium, not of this extension" \
  "browse or search without loading the whole file"; do
  grep -qF "$ph" README.md && echo "PRESENT: $ph" || echo "MISSING: $ph"
done
# Expected: all 9 print PRESENT.

# 1b. All STALE phrases are GONE.
for ph in "no size limit" "always injects the entire file" "no truncation" "No size gate" "a size limit" "You write it, the file goes in"; do
  grep -qF "$ph" README.md && echo "STILL PRESENT (FAIL): $ph" || echo "gone (good): $ph"
done
# Expected: all 6 print "gone (good)".

# 1c. Convention fidelity — NO curly apostrophe snuck in; em dashes are U+2014.
grep -nP "doesn\u2019t|model\u2019s" README.md && echo "FAIL: curly apostrophe present (use straight ')" || echo "OK: straight apostrophes"
grep -qP "directive \xE2\x80\x94 the model" README.md && grep -qP "at once \xE2\x80\x94 that is" README.md && echo "OK: U+2014 em dashes" || echo "FAIL: em dash wrong/missing"
```

### Level 2: Markdown Structure (Component Validation)

```bash
# 2a. All 8 section headers still present and in order.
grep -nE "^#{1,3} " README.md
# Expected: 8 header lines: # `#@file`, ## Why, ## Install, ## Usage, ## What gets injected,
#           ## Syntax, ## Limits, ## `#@` versus `@` (in that order).

# 2b. The "What gets injected" table is intact (header + separator + 4 data rows = 6 table lines).
grep -nE "^\| " README.md
# Expected: 6 lines starting with '|' — the header (| File | Result |), the separator (|---|---|), and
#           the 4 data rows (Text/Image/Other binary/Missing). The Text row is the edited (longer) one.

# 2c. Line count is ~83 (edits are in-place line swaps; should stay 83).
wc -l README.md
# Expected: 83 (±1). A large swing means an edit accidentally added/removed lines — re-check.

# 2d. No stale "size"/"truncation" claim survives anywhere except the intentional code sample + header.
grep -nEi "size|truncat|entire file|no limit" README.md
# Expected: only the NEW paged-delivery phrasing (L3/L9/L41/L72), the "<entire file contents>" code
#           sample (L50), the "## Limits" header (L70), and legitimate "context window"/"budget" uses.
#           NO "no size limit" / "no truncation" / "No size gate" / "a size limit".
```

### Level 3: Gold-Standard Diff (System Validation — NON-INTERACTIVE)

Reproduce the pre-verified change set in a temp copy and `diff`. The result must be EXACTLY the 5
changed lines (L3, L9, L41, L72, L83) — nothing else.

```bash
# Build the EXPECTED result in a temp copy using the SAME 5 replacements, then diff against the edited README.
cp README.md /tmp/readme_actual.md   # the just-edited README
# (Re-derive the expected copy from a known-good baseline is overkill; instead, assert the diff shape:)
git --no-pager diff --no-color README.md 2>/dev/null | grep -E '^[-+]' | grep -vE '^[-+]{3}' | wc -l
# Expected: 10 (5 removed "-" lines + 5 added "+" lines = 10 content diff lines). If not 10, an edit
# touched more/fewer than 5 lines — re-read the file and re-apply only the 5 specified spans.
# (If README.md is not yet git-tracked, skip this; rely on Level 1+2.)

# Eyeball the 5 changed lines for correctness:
git --no-pager diff --no-color README.md 2>/dev/null || true
```

### Level 4: (none required — pure documentation)

This task changes README prose only. Levels 1–3 fully cover it. A live `pi` run adds no signal (the
README is not executed). Optionally render the markdown in a previewer to eyeball table wrapping, but
GFM tables handle the long Text row fine (verified).

## Final Validation Checklist

### Technical Validation
- [ ] Level 1a: all 9 new phrases PRESENT.
- [ ] Level 1b: all 6 stale phrases GONE.
- [ ] Level 1c: straight apostrophes (no curly); U+2014 em dashes present.
- [ ] Level 2: 8 headers in order; 6 table lines intact; line count ~83; no stale claim in the size/limit sweep.
- [ ] Level 3: git diff shows exactly 10 content lines (5 `-` / 5 `+`).

### Feature Validation
- [ ] `## Why` (L3 + L9): the opening promise no longer says "no size limit"; it describes
      inline-or-paged delivery with no configuration.
- [ ] `## What gets injected` Text row (L41): describes fits-remaining-context + paged delivery +
      "Never silently truncated." The other 3 rows + the `<file>` code sample are unchanged.
- [ ] `## Limits` first bullet (L72): now "No size knob" describing the head-block + paging directive;
      the "property of the medium" honesty clause is present. The other 4 bullets + header unchanged.
- [ ] `## #@ versus @` closing (L83): the misleading "size limit" clause is replaced with "browse or
      search without loading the whole file."

### Code Quality Validation
- [ ] Only the 5 exact text spans changed; no adjacent lines reformatted/reordered.
- [ ] Markdown convention preserved: backticks (`#@`/`read`/`pi -p`/extensions), straight apostrophes,
      U+2014 em dashes.
- [ ] Install / Usage / Syntax sections untouched; code sample (L48-52) untouched; other table rows
      and Limits bullets untouched.
- [ ] No code file, test file, package.json, PRD, or plan file touched.

### Documentation & Deployment
- [ ] README now truthfully reflects PRD §5.5 paged delivery (the "honest contract" of §13.1).
- [ ] No new env vars / config (PRD §13.4: no user-facing config) — the README still says "no
      configuration" / "no user-facing size setting."
- [ ] Internal consistency: no remaining claim contradicts another (e.g. no "no size limit" elsewhere).

---

## Anti-Patterns to Avoid

- ❌ Don't use line numbers as anchors — the contract's "L7-9" is imprecise (the paragraph is on L9).
  Use the exact-text spans in Task 1 (each verified unique in the file).
- ❌ Don't drop the README's backtick convention. The contract's prose says "read tool" / "#@ always
  delivers" / "pi -p" — render these as `` `read` `` / `` `#@` `` / `` `pi -p` `` to match the README
  (precedent: P1M1T1S3's "2000×2000").
- ❌ Don't use a curly apostrophe (U+2019) in "doesn't" — the README uses straight ASCII `'` (verified:
  `model's` is straight). Disable editor smart-quote replacement.
- ❌ Don't substitute an ASCII hyphen `-` for the U+2014 em dash `—`. The README uses em dashes.
- ❌ Don't "improve" edit a1's mildly redundant sentence ("…reaches the model … the whole file always
  reaches the model —"). It's a verbatim phrase swap per the contract; deviating is out of scope.
- ❌ Don't touch the `<file>` block code sample (L48-52) — it's still accurate for the inline (whole-file)
  path and the contract scopes edit (b) to the table row only.
- ❌ Don't touch the Install / Usage / Syntax sections, the `## Limits` header, the other 4 Limits
  bullets, the other 3 table rows, or the `#@`-versus-`@` bullets (only the closing sentence changes).
- ❌ Don't edit `file-injector.ts` or `file-injector.test.mjs` — those are the parallel P1.M1.T1 chain's
  territory (disjoint file; no conflict, but stay out).
- ❌ Don't reformat/rewrap adjacent lines or "tidy" the markdown while editing — only the 5 exact spans.
- ❌ Don't run `npm`/`markdownlint`/a build — the repo has no deps, no linter, no build step. Validation
  is grep + diff only.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a pure prose edit — 5 exact-text replacements in a single short (83-line) markdown
file, each oldText verified unique (via `cat -A`) and each newText rendered in the file's verified
markdown convention (backticks, straight apostrophes, U+2014 em dashes). The complete change set was
**pre-verified by applying all 5 edits to a temp copy and `diff`ing** — the result is exactly the 5
expected line changes (L3, L9, L41, L72, L83), nothing else. A stale-term sweep confirms every stale
claim ("no size limit" / "no truncation" / "No size gate" / "a size limit" / "always injects the entire
file") is covered and no stale claim survives. The task is disjoint from the parallel P1.M1.T1 code
chain (README vs `file-injector.ts`/`.test.mjs`), so concurrency cannot break it. The validation is
fully non-interactive (grep + diff, no model/build/linter). The residual 0.5 is for a possible
transcription slip — the apostrophe (curly vs straight) or em-dash (hyphen vs U+2014) — fully caught by
Level 1c (explicit byte checks) and Level 3 (the 10-line diff count).
