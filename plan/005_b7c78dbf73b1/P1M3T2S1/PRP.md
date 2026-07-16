---
name: "P1.M3.T2.S1 — Add optional bare-@ markdown-imports subsection to README.md (Syntax + Limits)"
prd_ref: "PRD §4.6 (Optional bare-@ markdown imports — the spec to PARAPHRASE, not copy) + §13.4 (Why almost no config — the opt-in FRAMING) + §4.5 (the markdown-import rules bare-@ reuses) + §4.4 (top-level stays #@-only)"
target_file: "README.md (ONLY). Pure documentation changeset-sync (Mode B). No code, no tests, no config files."
target_language: "Markdown (GitHub-flavored). README prose; one fenced JSON block; one new ### subsection; one new Limits bullet."
depends_on: "P1.M3.T1.S1 (green gate — confirms the feature shipped: suite 114/0, typecheck 0 errors, injectMarkdown private). P1.M1.T1.S1 + P1.M1.T2.S1 + P1.M2.T1.S1 + P1.M2.T2.S1 (the implemented, tested feature this docs task describes). All LANDED."
consumed_by: "The Definition-of-Done for the entire P1 feature (markdownBareAtImports). No downstream consumer — this is the final task."
---

# PRP — P1.M3.T2.S1: README optional bare-`@` markdown-imports subsection

> **Scope flag:** This is a **DOCUMENTATION changeset-sync** task (Mode B — the whole-feature overview
> sweep). The implementing agent writes **only to `README.md`**. No code, no tests, no config files, no
> `file-injector.ts`, no `PRD.md`. Per-symbol JSDoc already shipped with M1/M2 (Mode A); this task is the
> final overview sync that surfaces the now-shipped `markdownBareAtImports` opt-in (PRD §4.6) coherently
> alongside the existing `#@` feature docs. **The feature is DONE** (green gate P1.M3.T1.S1 is the
> precondition); this task only documents it.

---

## Goal

**Feature Goal:** Add a concise, voice-matched subsection to `README.md` that surfaces the shipped
`markdownBareAtImports` opt-in (PRD §4.6) — what it is, how to turn it on, where the config lives, what
it does, and its scope — without duplicating the full §4.6 reference spec. Plus a one-line Limits note
that bare-@ is markdown-only (the prompt is unaffected).

**Deliverable:** An edited `README.md` with exactly two additions and zero edits to existing prose:
1. A new `### Optional: bare-\`@\` markdown imports` (or similarly titled) subsection under `## Syntax`,
   placed **after** the existing Markdown-imports bullet list ("Shared budget" bullet) and **before**
   `## Limits`. Contains: OFF-by-default framing (the ONE opt-in); the `{"markdownBareAtImports": true}`
   JSON snippet in a fenced block; the two config locations (global + trusted-project); the behavior
   (bare `@file.md` inside a delivered markdown file behaves like `#@file.md` — same rules); `#@` still
   works / never double-matched; markdown-only (prompt unaffected).
2. One new bullet in `## Limits` stating bare-@ imports stay inside markdown (prompt never injected).

**Success Definition:**
1. A reader who knows nothing about this codebase can, from `README.md` alone, learn that bare-@
   markdown imports exist, are OFF by default, how to enable them, where the config file lives, what
   the project-trust caveat is, what enabling does, and that it never touches their prompt.
2. The additions match the existing README voice (concise, second-person, example-driven, bold bullet
   leads, fenced code for examples) and use the same code-fence style as the rest of the file.
3. **No reference-spec duplication:** the README contains none of `BARE_AT_RE`, the regex literal,
   `prefixLen`, `§4.6`, or implementation internals — it stays an overview.
4. No existing true claim becomes false (the Usage-section "Bare `@` is unchanged" line stays intact
   and uncontradicted — it describes the prompt-level `@`, a different context from markdown bare-@).
5. All validation gates (fence balance, grep presence/absence, structure, no-stale) pass.

## User Persona

**Target User:** A **Pi end user** reading the extension README to learn what `#@file` does and what
options exist. They are NOT a contributor; they will not read the PRD or source. The README is their
*only* interface to the feature surface.

**Use Case:** "I reference files in my docs as `@file.md` (a common convention), not `#@file.md`. Can
this extension import those? How do I turn it on? Will it also change how `@` works in my prompt?"
The README must answer all three, concisely, in one place.

**User Journey:** user opens README → reads the lede ("no configuration") → browses `## Syntax` → finds
the new "Optional: bare-`@` markdown imports" subsection → learns it's OFF by default, the one opt-in,
how to enable it, where the config goes, the trusted-project caveat, that it mirrors `#@` rules, and
that `#@` still works → scrolls to `## Limits` → sees the one-liner confirming their prompt is never
affected → closes README, satisfied and correctly informed.

**Pain Points Addressed:** Without this subsection, a user with `@file.md`-style docs has NO README
signal that the feature exists or how to opt in — they'd have to read PRD §4.6 or the source. Worse,
they might wrongly assume bare `@` *already* imports in markdown (it doesn't, by default) or that
enabling it changes prompt behavior (it can't). The subsection + Limits note remove both confusions.

## Why

- **The feature shipped undocumented at overview level.** P1.M1 + P1.M2 implemented and tested
  `markdownBareAtImports` (114 passing tests, green typecheck, confirmed by gate P1.M3.T1.S1). The
  per-symbol JSDoc rode with the code (Mode A). But `README.md` — the user-facing overview — still
  says "no configuration" with no mention of the one opt-in. This task closes that gap (Mode B).
- **Reinforces, doesn't undermine, the zero-config default.** PRD §13.4's whole point is that the opt-in
  exists *precisely so the default stays zero-setup and unambiguous* (`#@` is the only prompt trigger;
  bare-@ never escapes markdown). The README lede says "with no configuration" — the new subsection must
  frame bare-@ as "the ONE opt-in, OFF by default" so the lede's promise still reads true.
- **Prevents two specific misconceptions.** (1) "bare `@` already imports in markdown" — false by default;
  the subsection states OFF-by-default. (2) "enabling it changes my prompt" — impossible (top-level scan
  hardcodes `bareAt: false`); the Limits one-liner states markdown-only.
- **Integration with existing feature docs.** The subsection sits inside `## Syntax` right after the
  Markdown-imports rules it reuses (relative-only / extension shorthand / code-exempt / dedup / shared
  budget), so the reader sees "here are the `#@`-in-markdown rules" immediately followed by "and you can
  opt in to the same rules for bare `@`." The Limits bullet groups with the existing markdown-scope limits.

## What

**User-visible behavior:** The README gains a new `### ` subsection under `## Syntax` and one new bullet
under `## Limits`. No behavior of the extension changes (this is docs-only). The new content conveys:

1. **Default + framing (echo §13.4):** OFF by default; `#@` works with no config; this is the ONE opt-in
   so the default stays zero-setup and `#@` remains the only prompt-level trigger.
2. **How to enable:** `{"markdownBareAtImports": true}` in `file-injector.json`, shown in a fenced
   ```json block.
3. **Where the config lives (two locations, project overrides global):**
   - Global: `~/.pi/agent/file-injector.json`
   - Project: `.pi/file-injector.json` in the current directory — honored **only in a trusted project**
     (an untrusted checkout cannot enable it).
4. **What enabling does:** a bare `@file.md` inside a delivered markdown file is treated exactly like
   `#@file.md` — same relative-only / extension-shorthand / code-exempt / dedup / shared-budget rules.
5. **`#@` keeps working, never double-matched:** a `#@file.md` is one import, not two.
6. **Robustness (one line):** a missing/unreadable config (or one without the key) leaves the default,
   so it never errors.
7. **Scope (also carried in the Limits bullet):** markdown-only — a bare `@path` typed in the prompt is
   never injected.

**Limits one-liner:** bare-@ imports stay inside markdown; even with the setting on, a prompt-level
bare `@path` is never injected; `#@` remains the sole prompt-level trigger.

### Success Criteria

- [ ] `README.md` has a new `### ` subsection under `## Syntax`, titled to convey "optional bare-@
      markdown imports," placed AFTER the "Shared budget" bullet and BEFORE `## Limits`.
- [ ] The subsection states: OFF by default; the `{"markdownBareAtImports": true}` snippet in a fenced
      ```json block; both config locations with the trusted-project caveat; bare `@file.md` behaves like
      `#@file.md` (same rules); `#@` still works / never double-matched.
- [ ] `## Limits` has exactly one new bullet stating bare-@ is markdown-only (prompt unaffected).
- [ ] The new content matches the existing README voice (concise, second-person, bold bullet leads,
      fenced code) and uses consistent code-fence style.
- [ ] **No spec duplication:** README contains none of `BARE_AT_RE`, a regex literal, `prefixLen`, `§`,
      or `4.6`.
- [ ] **No stale claims:** the Usage-section line "Bare `@` is unchanged, so `Review @a.ts` behaves as
      before." is intact and uncontradicted; no other existing prose was altered.
- [ ] All validation gates pass (fence balance even; grep presence/absence; structure; no-stale).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to make this edit
successfully?_ **Yes.** This PRP includes: the exact README heading structure with line numbers (the
canvas), the exact placement (after the "Shared budget" bullet; before `## Limits`), a complete
voice-matched **recommended draft** for both the subsection and the Limits bullet (so the agent can
largely transcribe + tune rather than invent), the full list of facts to convey (each verified against
the implemented `file-injector.ts`, not just the PRD), the framing to echo (§13.4), the things NOT to
do (no spec duplication, no editing existing prose, no touching non-README files), and deterministic
greppable validation gates. The agent opens `README.md`, applies two additions, runs the grep checks.

### Documentation & References

```yaml
# MUST READ — the existing README (the canvas + the voice to match); this is the ONLY file you edit
- file: README.md
  why: "The doc under edit. Voice to match: concise, second-person, bold bullet leads, fenced code for
        examples, a Markdown table for file types, no internal anchor links (a [Limits](#limits) link is
        the one acceptable exception — anchor 'limits' is valid). Lede says 'with no configuration' —
        your new subsection must reinforce (not undermine) that promise by framing bare-@ as the ONE opt-in."
  pattern: "## Syntax (L66): intro + 'Markdown imports:' (L81) + 5 bullets (L82-86: Relative-only,
            Extension shorthand, Code is escape hatch, Each file at most once, Shared budget). Insert the
            new ### subsection AFTER L86, BEFORE ## Limits (L88). ## Limits (L88): 8 bullets (L89-96);
            insert the new markdown-scope bullet right AFTER 'Only markdown is scanned.' (L95)."
  gotcha: "L44-area Usage line 'Bare `@` is unchanged, so Review @a.ts behaves as before.' describes the
           PROMPT-level @ — it is STILL CORRECT (top-level scan hardcodes bareAt:false). Do NOT edit or
           contradict it. Your new content is about @ INSIDE markdown files — a different context."

# MUST READ — the PRD spec to PARAPHRASE (NOT copy verbatim, NOT port the reference internals)
- file: PRD.md
  why: "§4.6 is the authoritative feature spec — the wording to paraphrase at overview level. §13.4 is
        the WHY-it's-opt-in framing the README must echo ('the default stays zero-setup and unambiguous;
        #@ remains the only prompt trigger; bare-@ never escapes markdown'). §4.5 lists the markdown-import
        rules bare-@ reuses (relative-only, extension shorthand, code-exempt, dedup, shared budget)."
  section: "### 4.6 (Optional bare-@ markdown imports) + ### 13.4 (Why almost no config) + ### 4.5 (rules)"
  critical: "DO NOT duplicate §4.6 internals in the README: no BARE_AT_RE, no regex literal
             /(^|(?<=[^\\w#]))@(\\S+)/g, no prefixLen, no '§4.6'. README is an overview, not a reference
             (contract item 3: 'Do NOT duplicate the full §4.6 spec')."

# MUST READ — the implementation, to confirm every fact you state is TRUE (describe shipped behavior)
- file: file-injector.ts
  why: "Verify the README will describe ACTUAL behavior. Key facts (all grep-confirmed): config interface
        L146 { markdownBareAtImports?: boolean }; config file name L164/L167 'file-injector.json'; global
        path L164 getAgentDir() → ~/.pi/agent/file-injector.json; project path L167 <cwd>/.pi/file-injector.json
        (CONFIG_DIR_NAME='.pi'); trusted-gate L166 if(ctx.isProjectTrusted()); merge L167 project-overrides-global;
        load L879 on session_start → cached L871; missing/malformed L151-152 → {} → false, NEVER throws;
        top-level scan L818 bareAt:false (prompt ALWAYS #@-only); markdown scan L711 bareAt:state.bareAt;
        no double-match L489 BARE_AT_RE forbids preceding #."
  pattern: "Read-only. DO NOT edit. This is the source of truth for 'what does enabling actually do?'"
  gotcha: "getAgentDir() resolves to ~/.pi/agent (PRD §4.6 states path.join(getAgentDir(),'file-injector.json')
           = ~/.pi/agent/file-injector.json). CONFIG_DIR_NAME='.pi' (code comment L149). Both confirmed."

# The green gate that is the PRECONDITION (read to know the feature is DONE before you document it)
- file: plan/005_b7c78dbf73b1/P1M3T1S1/PRP.md
  why: "Confirms the feature shipped clean (suite 114 passed/0 failed; typecheck 0 errors; injectMarkdown
        private). Its deliverable is a confirmation, not files. You may assume the feature is exactly as
        the M1/M2 PRPs + this source specify. You do NOT run those gates (they are CODE gates, owned by
        M3.T1; this is a docs task)."
  pattern: "Precondition, not your work. If the gate is somehow RED, the feature isn't done — escalate,
            do not document aspirational behavior."

# The recommended draft (in the research notes) — a near-complete voice-matched starting point
- file: plan/005_b7c78dbf73b1/P1M3T2S1/research/research_notes.md
  why: "Section 5 contains a complete recommended draft for BOTH the ### subsection and the Limits bullet,
        voice-matched to the existing README, with the fence accounting (10 → expected 12) and the
        cross-link anchor note. The implementing agent can largely transcribe + tune rather than invent."
  section: "## 5. Recommended README draft"
```

### Current Codebase tree

```bash
pi-file-injector/
├── README.md                # ← EDIT (the ONLY file this task touches): +1 ### subsection, +1 Limits bullet
├── file-injector.ts         # read-only (verify facts; do NOT edit — JSDoc already shipped in M1/M2)
├── file-injector.test.mjs   # read-only (code gate; owned by P1.M3.T1.S1; this task does NOT run it)
├── scripts/typecheck.mjs    # read-only (code gate; owned by P1.M3.T1.S1)
├── package.json             # read-only (scripts: typecheck + test only; no markdown-lint script)
├── tsconfig.json            # read-only
├── PRD.md                   # read-only (the spec to paraphrase; NEVER edit per FORBIDDEN OPERATIONS)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{system_context.md, codebase_delta.md, api_verification.md}  # read-only context
    └── P1M?T?S?/{research, PRP.md}   # the green-gate PRP + M1/M2 implementation PRPs (read-only)
```

### Desired Codebase tree (files touched by THIS task)

```bash
README.md    # +1 new `### Optional: bare-@ markdown imports` subsection under `## Syntax`
             # +1 new bullet under `## Limits` (markdown-only scope)
             # (NO other files. NO edits to existing README prose — pure ADD.)
```

### Known Gotchas of our codebase & Library Quirks

```markdown
# CRITICAL — EDIT ONLY README.md. This is docs-only. Do NOT touch file-injector.ts (JSDoc shipped in
#   M1/M2 — Mode A is done), file-injector.test.mjs / scripts/typecheck.mjs / package.json (code gates,
#   owned by M3.T1), PRD.md (FORBIDDEN — read-only), tsconfig.json, or any plan/ file. Two additions to
#   one file. If you are editing a .ts/.mjs file, STOP — you are out of scope.

# CRITICAL — DO NOT DUPLICATE THE §4.6 REFERENCE SPEC (contract item 3). README is an overview. Forbidden
#   in the README after your edit: `BARE_AT_RE`, the regex literal `/(^|(?<=[^\w#]))@(\S+)/g`, `prefixLen`,
#   `§4.6`, `§4.5`, or any line-number/implementation detail. Paraphrase behavior, do not port internals.

# CRITICAL — DO NOT EDIT EXISTING PROSE (pure ADD). The Usage-section line "Bare `@` is unchanged, so
#   `Review @a.ts` behaves as before." describes the PROMPT-level @ and is STILL CORRECT (top-level scan
#   hardcodes bareAt:false, file-injector.ts L818). KEEP it. Do not soften ("unless you enable…") or
#   contradict it. Your new content is about @ INSIDE delivered markdown files — a different context.

# CRITICAL — MATCH THE VOICE. Concise, second-person ("you"/"your"), bold bullet leads (**Term.** …),
#   fenced code for concrete examples (the existing file uses ```text and the file-type table). No
#   marketing fluff, no hedging, no first-person-plural ("we"). Mirror sentence length of neighbors.

# GOTCHA — CODE-FENCE BALANCE IS A HARD GATE. Current `grep -c '^```' README.md` = 10 (even). You are
#   adding ONE fenced ```json block = +2 fences → expected 12 (even). An ODD result post-edit = a broken
#   fence = a real defect. Count fences before and after; the JSON block MUST have an opening AND a
#   closing ``` line. (Inside a nested ```markdown example block, fence the inner ```json with 4 backticks
#   ````json```` if you nest examples — but the recommended draft avoids nesting, so plain ```json suffices.)

# GOTCHA — THE TRUSTED-PROJECT CAVEAT IS NON-NEGOTIABLE CONTENT. file-injector.ts L166 gates the project
#   config behind ctx.isProjectTrusted(). The README MUST state the project file is "honored only in a
#   trusted project" (or equivalent) — omitting it would be a stale/incorrect claim (an untrusted
#   checkout CANNOT enable bare-@ via a project file). State it explicitly.

# GOTCHA — FRAME AS "THE ONE OPT-IN," NOT "a config option." PRD §13.4: the opt-in exists PRECISELY so
#   the default stays zero-setup and #@ stays the only prompt trigger. The README lede says "with no
#   configuration." Your subsection must reinforce that ("#@ works with no config at all … this is the
#   one opt-in"), never undermine it (do NOT say "configure the extension" / "settings" plural / imply
#   other knobs exist — there are none).

# GOTCHA — NO MARKDOWN LINTER IN REPO. package.json has only typecheck + test (both CODE gates, owned by
#   M3.T1 — this task does NOT run them). Validation is greppable checks (see Validation Loop), not a
#   linter. `npx markdownlint-cli` exists via npx but the EXISTING README was not written to pass it (long
#   lines, etc.) — so a lint run would noise on pre-existing style. Treat markdownlint as OPTIONAL only.
```

## Implementation Blueprint

> **There is no "data model" and no "new code files" for a docs task.** The blueprint below is the
> **exact edit specification** (placement + content + voice) plus the recommended draft to transcribe.

### Edit specification (two additions, zero edits to existing prose)

```yaml
EDIT 1 — NEW SUBSECTION under ## Syntax (the ONLY structural heading addition):
  - INSERT POSITION: directly AFTER the last Markdown-imports bullet ("- **Shared budget.** …", README.md
    L86) and directly BEFORE the "## Limits" heading (README.md L88). One blank line above and below the
    new ### heading (match the file's section spacing).
  - HEADING LEVEL: ### (so it nests under ## Syntax; do NOT use ## — that would peer with Syntax/Limits).
  - HEADING TEXT: convey "optional bare-@ markdown imports." Recommended: "### Optional: bare-`@` markdown
    imports" (backticks around the `@`, matching the file's backtick-the-symbol style). Alternatives
    ("### Optional: bare @ markdown imports", "### Bare-@ markdown imports (opt-in)") are acceptable if
    they match voice; pick the clearest.
  - CONTENT (convey, in this order, paraphrased to match voice — see recommended draft in research notes §5):
      (a) OFF by default; #@ works with no config; this is the ONE opt-in (echo §13.4 framing).
      (b) What it's for: docs that reference files as a bare @file.md (no #).
      (c) The {"markdownBareAtImports": true} snippet in a fenced ```json block.
      (d) Two config locations (global ~/.pi/agent/file-injector.json; project .pi/file-injector.json),
          project overrides global, and the project file is honored ONLY in a trusted project.
      (e) Effect: a bare @file.md inside a delivered markdown file imports exactly like #@file.md — same
          relative-only / extension-shorthand / code-exempt / dedup / shared-budget rules.
      (f) #@ keeps working unchanged and is never matched twice (a #@file.md is one import, not two).
      (g) Robustness (one line): missing/unreadable config (or key unset) leaves the default → never errors.
      (h) Scope: markdown-only — a bare @path typed in the prompt is never injected (cross-link to #limits
          OR restate in the Limits bullet; do BOTH lightly is fine, but the CANONICAL statement is the
          Limits bullet per contract item 2b).

EDIT 2 — NEW BULLET under ## Limits:
  - INSERT POSITION: directly AFTER the "- **Only markdown is scanned.** …" bullet (README.md L95) and
    BEFORE the "- **No autocomplete for in-file imports.** …" bullet (README.md L96). Groups all
    markdown-scope limits together.
  - FORMAT: a single bullet with a bold lead, matching the existing Limits bullets.
  - CONTENT: state that bare-@ imports stay inside markdown — even with markdownBareAtImports on, a
    prompt-level bare @path is never injected; the setting only changes what a delivered markdown file
    pulls in; #@ remains the sole prompt-level trigger. ONE line (contract item 2b). Recommended wording
    in research notes §5.
```

### Recommended draft (transcribe + tune to voice — from research notes §5)

> The implementing agent may use this near-verbatim (it is already voice-matched) or rephrase to better
> fit local rhythm. Either way, it MUST satisfy the Edit-specification content checklist above.

**Subsection (under `## Syntax`, after the "Shared budget" bullet):**

````markdown
### Optional: bare-`@` markdown imports

Off by default — `#@` works with no config at all, and stays the only thing that ever triggers injection at the prompt. This is the one opt-in.

If your docs already reference files as a bare `@file.md` (no `#`), you can make a delivered markdown file treat that the same way as `#@file.md`. Put this in `file-injector.json`:

```json
{ "markdownBareAtImports": true }
```

The file is read from two places — a project file overrides a global one:

1. **Global:** `~/.pi/agent/file-injector.json`
2. **Project:** `.pi/file-injector.json` in your current directory — honored **only in a trusted project**, so an untrusted checkout can't turn it on.

When it's on, a bare `@api.md` inside a delivered markdown file imports exactly like `#@api.md`: relative-only paths, extension shorthand, code-exempt, deduped against everything else, and drawing on the same shared budget. `#@` keeps working unchanged and is never matched twice — a `#@api.md` is one import, not two. A missing or unreadable config file (or one that doesn't set the key) leaves everything at the default, so it never errors.

It affects markdown content only — a bare `@path` you type in your prompt is never injected. See [Limits](#limits).
````

**Limits bullet (under `## Limits`, after the "Only markdown is scanned." bullet):**

```markdown
- **Bare-`@` imports stay inside markdown.** Even with `markdownBareAtImports` on, a bare `@path` in your prompt is never injected — the setting only changes what a delivered markdown file pulls in. `#@` remains the sole prompt-level trigger.
```

### Implementation Patterns & Key Details

```markdown
# PLACEMENT (the load-bearing detail — get the anchor lines right):
#   - Subsection: AFTER "- **Shared budget.**" bullet (L86), BEFORE "## Limits" (L88).
#   - Limits bullet: AFTER "- **Only markdown is scanned.**" bullet (L95), BEFORE "- **No autocomplete
#     for in-file imports.**" bullet (L96).
#   - Use blank-line spacing identical to neighbors (one blank line between blocks).

# VOICE (match the existing file — read 3 neighbor bullets aloud before writing):
#   - Second person ("you"/"your"), present tense, declarative.
#   - Bold the lead term of each bullet (**Term.** rest-of-sentence).
#   - Fenced code for the JSON snippet (```json), matching the file's fenced-example style.
#   - Backtick symbols/paths (`#@`, `@file.md`, `file-injector.json`, `~/.pi/agent/...`).

# CROSS-LINK ANCHOR:
#   - "## Limits" → GitHub anchor "#limits" (lowercase; spaces→hyphens). A [Limits](#limits) link is
#     valid. The existing README uses NO internal links, so if you prefer parity, "See Limits below."
#     is an equally valid substitute. Either satisfies the "coherently alongside" requirement.

# WHAT NOT TO STATE (spec-duplication guard):
#   - No regex, no BARE_AT_RE, no prefixLen, no "§4.6"/"§4.5", no line numbers, no "session_start",
#     no "merged shallowly" (say "a project file overrides a global one" instead).
#   - No enumeration of every §4.5 rule by number — name the behaviors (relative-only, extension
#     shorthand, code-exempt, deduped, shared budget) as the README's own Markdown-imports bullets
#     already do; you may reference "the same rules above" to avoid re-listing.
```

### Integration Points

```yaml
FILES TOUCHED:
  - README.md        # +1 ### subsection (under ## Syntax), +1 bullet (under ## Limits). Pure ADD.

NO_CHANGES (read-only for this task):
  - file-injector.ts             # JSDoc shipped in M1/M2 (Mode A done); do NOT edit
  - file-injector.test.mjs       # code gate (M3.T1); do NOT run or edit
  - scripts/typecheck.mjs        # code gate (M3.T1); do NOT run or edit
  - package.json / tsconfig.json # no script/config changes
  - PRD.md                       # FORBIDDEN (read-only per FORBIDDEN OPERATIONS)
  - plan/**                      # read-only context
  - any new file                 # none — this task writes ONLY to README.md
```

## Validation Loop

> For a docs task there is no compile/test/run loop. Validation is **deterministic greppable checks**
> that confirm the two additions landed, the voice/structure holds, no spec was duplicated, and no
> existing claim went stale. All run in <1s. (The CODE gates — `npm run typecheck`,
> `node ./file-injector.test.mjs` — are owned by P1.M3.T1.S1 and are GREEN by precondition; this task
> does NOT run them.)

### Level 1: Structural & style checks (immediate, after the edit)

```bash
cd /home/dustin/projects/pi-file-injector

# 1a) Code-fence balance — MUST be even (expected 12: was 10, +2 for the new ```json block).
test "$(grep -c '^```' README.md)" -eq 12 && echo "fences balanced (12)" || echo "FENCE MISMATCH: $(grep -c '^```' README.md) — expected 12"
# Expected: "fences balanced (12)". An odd count = a broken fence = a real defect. Fix before proceeding.

# 1b) The new ### subsection exists and is UNDER ## Syntax (heading hierarchy intact).
grep -n "^### Optional: bare-\`@\` markdown imports\|^### .*bare.*markdown import" README.md
# Expected: exactly ONE ### line. If you titled it differently, adjust the grep; the point is one new ###.

# 1c) Heading order: ## Syntax ... (new ###) ... ## Limits (the subsection must sit BETWEEN them).
awk '/^## Syntax/{s=NR} /^### / && s && !l {sub=NR} /^## Limits$/{l=NR} END{print "Syntax="s" subsection="sub" Limits="l}' README.md
# Expected: Syntax < subsection < Limits (all three line numbers present, ascending). If subsection is
# absent (0) or outside the Syntax..Limits range, placement is wrong — move it.

# 1d) The new Limits bullet exists exactly once.
grep -c "^- \*\*Bare-\`@\` imports stay inside markdown\.\*\*\|^.- .*bare-@.*markdown.*prompt is never injected" README.md
# Expected: 1 (exactly one new markdown-scope bullet). If you worded it differently, grep for your wording.
```

### Level 2: Content-presence & spec-duplication-absence checks

```bash
# 2a) PRESENCE — every required fact is stated (all must print ≥1 match).
for kw in "markdownBareAtImports" "file-injector.json" "\~/.pi/agent/file-injector.json" ".pi/file-injector.json" "trusted project"; do
  printf "%-40s " "$kw:"; grep -c "$kw" README.md
done
# Expected: each line prints ≥1. Any 0 → a required fact is missing — add it.
#   markdownBareAtImports:  ≥1  (the JSON key)
#   file-injector.json:     ≥1  (config file name)
#   ~/.pi/agent/...:        ≥1  (global location)
#   .pi/file-injector.json: ≥1  (project location)
#   trusted project:        ≥1  (the non-negotiable trust caveat)

# 2b) PRESENCE — the enabling snippet is a fenced JSON block with the key set true.
grep -A1 '^```json$' README.md | grep -q '"markdownBareAtImports": true' && echo "snippet present" || echo "MISSING json snippet"
# Expected: "snippet present".

# 2c) ABSENCE — NO §4.6 reference-spec internals leaked into the README (all must print 0).
for bad in "BARE_AT_RE" '\\\\w#' "prefixLen" "§4.6" "§4.5" "session_start"; do
  printf "%-14s " "$bad:"; grep -c "$bad" README.md
done
# Expected: each prints 0. Any >0 → spec duplication — remove it (README is an overview, not a reference).

# 2d) ABSENCE — no accidental edit to existing prose (the Usage line about prompt-@ is intact & singular).
grep -c "Bare \`@\` is unchanged, so \`Review @a.ts\` behaves as before" README.md
# Expected: 1 (unchanged). 0 → you edited/deleted it — restore it. >1 → you duplicated it — remove the copy.
```

### Level 3: Cohesion & no-stale-claim check (read-through)

```bash
# 3a) The new content does not contradict the zero-config lede. The lede still says "no configuration";
#     confirm it is intact AND that the new subsection frames bare-@ as the ONE opt-in (OFF by default).
grep -c "with no configuration" README.md      # Expected: ≥1 (lede intact).
grep -c "Off by default\|off by default\|opt-in" README.md   # Expected: ≥1 (new framing present).
# If both ≥1, the lede's promise and the opt-in framing coexist correctly.

# 3b) Whole-file render sanity — confirm the markdown is structurally sound (headings nest, no stray fence).
#     Optional: if a markdown renderer is handy, eyeball it. mdsel gives a cheap structure view:
npx --yes @earendil-works/mdsel README.md 2>/dev/null || grep -nE "^#{1,4} " README.md
# Expected: a clean heading outline with the new ### nested under ## Syntax, before ## Limits. (mdsel may
# not be installed; the grep fallback lists all headings — verify the new ### is present and well-placed.)
```

### Level 4: Domain-specific / final read-through

```bash
# 4a) OPTIONAL markdownlint — the EXISTING README was NOT written to pass it (long lines etc.), so expect
#     pre-existing style noise. Run ONLY to confirm YOUR new lines don't introduce NEW error classes
#     (unclosed fence, bad heading). Do NOT treat pre-existing warnings as failures.
npx --yes markdownlint-cli README.md 2>&1 | grep -iE "fence|heading|MD040|MD041" || echo "no new fence/heading issues from markdownlint"
# Expected (best case): "no new fence/heading issues …". Pre-existing line-length/other style notes are
# out of scope — do NOT rewrite the file to satisfy them.

# 4b) Human read-through (the real Level-4 gate): open README.md and read ## Syntax → new ### → ## Limits
#     top to bottom. Confirm:
#     - A reader learns bare-@ exists, is OFF by default, how to enable, where config lives, the trust
#       caveat, what enabling does, that #@ still works / isn't double-matched, and that the prompt is
#       unaffected.
#     - The voice matches neighbors (no fluff, second-person, bold leads).
#     - Nothing duplicates the §4.6 reference internals.
#     - The Usage "Bare @ is unchanged" line still reads true.
```

## Final Validation Checklist

### Technical Validation

- [ ] Level 1 passed: fence count is **12** (even); one new `### ` subsection sits between `## Syntax`
      content and `## Limits`; one new Limits bullet sits after "Only markdown is scanned.".
- [ ] Level 2 passed: all 5 required facts present (`markdownBareAtImports`, `file-injector.json`,
      `~/.pi/agent/file-injector.json`, `.pi/file-injector.json`, `trusted project`); the
      `{"markdownBareAtImports": true}` JSON snippet is in a fenced block; **zero** spec internals
      (`BARE_AT_RE`, regex, `prefixLen`, `§4.6`, `§4.5`, `session_start`); the Usage line is intact.
- [ ] Level 3 passed: lede ("with no configuration") intact AND new "Off by default / opt-in" framing
      present (they coexist without contradiction).
- [ ] Level 4 passed: human read-through confirms a zero-context reader is fully informed; no NEW
      markdownlint fence/heading errors introduced (pre-existing style notes are out of scope).

### Feature Validation

- [ ] All success criteria from "What" section met (subsection content checklist a–h; Limits one-liner).
- [ ] The additions match the existing README voice and code-fence style.
- [ ] No existing true claim became false (Usage "Bare `@` is unchanged" line intact and uncontradicted).
- [ ] No reference-spec duplication (README stays an overview, not a §4.6 port).

### Code Quality / Scope Validation

- [ ] **Only `README.md` was edited.** No `.ts`, `.mjs`, `package.json`, `tsconfig.json`, `PRD.md`, or
      `plan/` file was touched.
- [ ] The edit is **pure ADD** (two insertions); no existing README prose was rewritten or deleted.
- [ ] File placement matches the desired tree (one file, two additions).

### Documentation

- [ ] Code is self-documenting (README prose is clear; no dangling TODOs/placeholders).
- [ ] The trusted-project caveat is stated explicitly (non-negotiable; an untrusted checkout cannot enable).
- [ ] No new environment variables or config keys invented (only the existing `markdownBareAtImports`).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit any file other than `README.md`.** This is docs-only. No `.ts`/`.mjs`/`package.json`/
  `tsconfig.json`/`PRD.md`/`plan/` edits. (Two additions to one file.)
- ❌ **Do NOT duplicate the §4.6 reference spec.** No `BARE_AT_RE`, no regex literal, no `prefixLen`, no
  `§4.6`. README is an overview. Paraphrase behavior, do not port internals. (Contract item 3.)
- ❌ **Do NOT edit existing README prose (pure ADD).** Especially do not touch or contradict the Usage
  "Bare `@` is unchanged, so `Review @a.ts` behaves as before." line — it describes the PROMPT-level `@`,
  still correct. Your content is about `@` INSIDE markdown files. (Contract item 4: "No stale claims.")
- ❌ **Do NOT omit the trusted-project caveat.** `file-injector.ts` L166 gates the project config behind
  `ctx.isProjectTrusted()`. Omitting it would be an incorrect claim (an untrusted checkout cannot enable
  bare-@ via a project file). State it explicitly.
- ❌ **Do NOT undermine the zero-config lede.** The README says "with no configuration." Frame bare-@ as
  "the ONE opt-in, OFF by default," never as "a setting" / "configure the extension" / "settings" plural
  (there are no other knobs — §13.4). Echo §13.4's framing, do not fight it.
- ❌ **Do NOT introduce a broken code fence.** Count fences before/after; the new ```json block needs an
  opening AND closing ``` (10 → 12, even). An odd count is a real defect.
- ❌ **Do NOT run or edit the CODE gates** (`npm run typecheck`, `node ./file-injector.test.mjs`). They
  are owned by P1.M3.T1.S1 (GREEN by precondition). This docs task neither runs nor touches them.
- ❌ **Do NOT document future/aspirational features** (e.g. a size-gated `@`, §13.5). README documents
  only what ships. Non-Goals/§13.5 are design rationale, not user-facing.
- ❌ **Do NOT invent voice.** Match the existing README: concise, second-person, bold bullet leads, fenced
  code. If unsure, transcribe the recommended draft (research notes §5) and tune lightly.

---

## Confidence Score: 9/10

This is among the most deterministic tasks in the plan: a pure-add documentation edit to ONE file, with a
complete voice-matched recommended draft already authored in the research notes (§5), every required fact
verified against the implemented `file-injector.ts` (not aspirational spec), exact placement given by
heading + line anchors, and deterministic greppable validation gates (fence balance, presence/absence,
structure, no-stale) that run in <1s. The feature it documents is DONE (green gate P1.M3.T1.S1 is the
precondition). The -1 reserves for the one genuine judgment call: the exact prose wording / whether to use
a `[Limits](#limits)` cross-link vs. "See Limits below." (both valid; the implementing agent tunes to local
rhythm). The implementing agent opens `README.md`, transcribes/tunes the two additions, runs the grep
checks, and reads it through. No code is written.
