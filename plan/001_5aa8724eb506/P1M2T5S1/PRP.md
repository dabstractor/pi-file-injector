---
name: "P1.M2.T5.S1 — Create README.md: extension purpose, installation, usage, behavior, known limitations"
prd_ref: "PRD §1 (Overview/Solution/Value/Tagline), §2 (Goals/Non-Goals), §4 (Syntax spec), §5 (Behavior by file type), §10 (Edge cases), §12 (Implementation notes), §13 (Design rationale & tradeoffs), Appendix A (tagline)"
target_file: "./README.md"   # NEW — repo root, alongside sharp-at-file.ts + sharp-at-file.test.mjs
target_language: Markdown (GitHub-flavored; renders in pi's renderer, GitHub, VS Code, etc.)
depends_on: "P1.M2.T4.S1 (the VALIDATED extension — all 14 §11 criteria passing; its validation_report.md is the source of truth for ACTUAL behavior). P1.M1.T1–T3 (the shipped sharp-at-file.ts)."
consumed_by: "None — this is the terminal documentation task (Mode B changeset-level doc sweep). Closes milestone P1.M2 / the whole P1 MVP."
---

# PRP — P1.M2.T5.S1: README.md for the `#@file` Whole-File Injection Extension

## Goal

**Feature Goal**: Write one comprehensive, accurate, user-facing **`./README.md`** (repo root) that is the
single source of truth for the `#@file` extension: what it does, how to install it, how to use it, how
it behaves for each file type, why its core design choices are what they are, and exactly what its known
limitations are. Every documented behavior MUST match the **shipped** `sharp-at-file.ts` and the **T4.S1
validation report** — including the one place where actual behavior diverges from the PRD's pre-validation
intent (the fenced-code-block case, Finding F1).

**Deliverable**: A single new file **`./README.md`** (repo root, `/home/dustin/projects/pi-auto-reader/README.md`).
~150–250 lines of GitHub-flavored Markdown. No other files are created or modified.

**Success Definition**:
- [ ] A user who has never seen this repo can, reading ONLY `README.md`: (a) install the extension in
      under a minute, (b) correctly predict whether a given prompt like `Review #@a.ts` or
      `the foo#@bar thing` will inject, and (c) name the four known limitations and the escape hatch.
- [ ] Every behavioral claim in the README is **verified** against `sharp-at-file.ts` (the source) and
      `P1M2T4S1/validation_report.md` (the run evidence). Zero statements that contradict shipped
      behavior. The fenced-code limitation documents the **actual** behavior (no-match when followed by a
      backtick), NOT the PRD §10 row's pre-validation assumption ("still matched").
- [ ] The behavior-by-file-type table, the trigger grammar, and the `<file name="…">` output examples are
      byte-accurate (copy-pasteable strings taken from the source constants).
- [ ] The "Relationship to `@`" section is unambiguous and states `@` is left untouched (test #14).
- [ ] Installation section covers BOTH the auto-discovery placements (global `~/.pi/agent/extensions/`,
      project-local `.pi/extensions/`), the quick-test `pi -e ./sharp-at-file.ts` flag, and `/reload`.
- [ ] The README renders cleanly (valid Markdown, no broken tables/fences), and the examples it contains
      are the SAME examples the test harness `node ./sharp-at-file.test.mjs` actually exercises (so a
      reader can run them and see green).

> **Scope boundary (read carefully):** This is a DOCUMENTATION task. You write `./README.md` and NOTHING
> else. You do NOT touch `sharp-at-file.ts`, `PRD.md`, `tasks.json`, `prd_snapshot.md`, or the
> architecture docs. You do NOT add a `package.json`, `LICENSE`, `CONTRIBUTING.md`, or `CHANGELOG.md`
> (out of scope — this is the one README task). You do NOT invent behavior: every claim is sourced from
> the PRD, the shipped source, or the validation report (cite §/line when non-obvious). When the PRD and
> the shipped behavior disagree (F1), the SHIPPED behavior wins and the PRD intent is noted parenthetically.

## User Persona

**Target User**: A Pi user / developer who wants to attach a whole file to their prompt without the model
needing to call the `read` tool. They may be evaluating the extension, installing it, or debugging why a
particular `#@` token did or did not inject.

**Use Case**: "I'm about to ask Pi to review `a.ts`. Instead of typing the file contents or waiting for a
`read` tool round-trip, I write `Review #@a.ts` and the file is already in the prompt."

**User Journey**: finds the repo → reads `README.md` → copies `sharp-at-file.ts` to
`~/.pi/agent/extensions/` → runs `pi` → types `Review #@a.ts` → sees the model respond about the file's
contents with no `read` tool call. If a `#@` doesn't behave as expected, they scroll to "Known
Limitations" / "Behavior by file type" and find the exact rule that explains it.

**Pain Points Addressed**:
- Pi has no single syntax that unconditionally injects a whole file in EVERY context (`@` only works at
  the CLI; interactively it's just autocomplete). `#@` fills that gap.
- Without a README, a user can't tell `#@` apart from `@`, can't predict binary/missing/dir behavior, and
  has no escape hatch for suppressing `#@` in prose.

## Why

- **README is the changeset-level doc sweep (Mode B).** Per tasks.json, T5.S1 is the final documentation
  task that "only makes sense once the whole change is in place." All implementing subtasks (P1.M1) and
  the acceptance validation (P1.M2.T4.S1) are COMPLETE. This task produces the user-facing artifact.
- **The extension has ZERO config surface** — no env vars, no config files, no flags beyond `-e`. So
  there is deliberately NO `CONFIGURATION.md` and no settings to document. The README is the entire doc
  surface. Keep it that way (PRD §2 Non-Goal: "No config of any kind").
- **The README must reconcile the PRD's spec with the shipped reality.** The validation report (T4.S1)
  found one place where actual behavior differs from the PRD §10 edge-case note (F1: `#@` inside a fenced
  code block does NOT inject, because a trailing backtick isn't trimmed). The README is where this is
  documented honestly. Recording the PRD's intent AND the actual behavior prevents a future "bug" report
  that is actually correct, documented behavior.
- **Format parity with `pi @file` is a selling point** (test #13) and should be stated: the same
  `<file name="/abs/path">\n<content>\n</file>` block the built-in emits, so the model sees identical
  structure regardless of whether the user wrote `#@` or `@` at the CLI.

## What

Create ONE new file: `./README.md` at the repo root. It must contain, top-to-bottom, these sections
(titles are recommended but may be reworded; the CONTENT of each is mandatory):

1. **Title + tagline** — the H1 `# #@file` and the exact PRD §1.3 / Appendix-A tagline:
   *"`#@file` — inject the whole file, every time, everywhere."*
2. **What it does** (1–2 short paragraphs) — a dedicated `#@<path>` syntax that unconditionally injects
   the **entire** contents of a file into the model's context at prompt-submission time. Works in every
   context (interactive TUI, the initial `pi -p`/CLI message, and RPC) because it hooks Pi's `input`
   event inside `prompt()` — not argv parsing. No size limit, no config.
3. **Installation** — the three ways to load it (see "Implementation Blueprint" for exact commands).
4. **Quick start / Usage** — copy-pasteable example prompts (see the exact 4–6 examples in the blueprint).
5. **Behavior by file type** — a table with one row per file type (text, image, non-image binary,
   missing/dir/error) and the exact block each produces.
6. **Syntax reference** — the `#@<path>` grammar, the detection rule (start-of-string or after a non-word
   char; NOT mid-word), trailing-punctuation trimming, tilde/absolute/`..` paths all allowed.
7. **Key design choices** — why `#@` is separate from `@`, why there's no size limit, why no config.
8. **Known limitations** — the 5 documented limitations (see blueprint; include the F1 nuance).
9. **Relationship to `@`** — explicit: `#@` = whole file always; `@` = Pi's existing behavior, untouched.
10. **Testing / verification** — the one command to run the model-free acceptance harness.

### Success Criteria

- [ ] `./README.md` exists at repo root and renders as valid GFM (tables and fenced code blocks intact).
- [ ] All 10 sections above are present and non-stub.
- [ ] The behavior table's block strings are byte-identical to the `format*Block` outputs in
      `sharp-at-file.ts` (cross-check against the source constants — see blueprint).
- [ ] The known-limitations section documents the **actual** fenced-code behavior (F1: no-match when
      followed by a backtick; workaround `# @`), not the PRD §10 assumption.
- [ ] Installation section names the global path `~/.pi/agent/extensions/sharp-at-file.ts`, the
      project-local path `.pi/extensions/sharp-at-file.ts`, and the `pi -e ./sharp-at-file.ts` flag, plus
      `/reload` for hot reload.
- [ ] The "Relationship to `@`" section explicitly states bare `@` is unaffected (PRD §2, test #14).

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the exact 10-section structure, the VERIFIED tagline string,
the byte-accurate block formats (lifted from `sharp-at-file.ts` constants + `validation_report.md`), the
VERIFIED install paths (from pi's own `docs/extensions.md` + `architecture/extension_patterns.md` §5),
the EXACT 4–6 usage examples (the same ones `sharp-at-file.test.mjs` runs), the VERIFIED F1 fenced-code
finding (with the precise explanation of WHY a backtick isn't trimmed), a README format reference
(`examples/extensions/subagent/README.md`), and a single re-runnable verification command. The
implementer needs no access to `dist/` and no external research — everything is in the repo + the PRD.

### Documentation & References

```yaml
# MUST READ — the artifact being documented (READ-ONLY; this is the source of truth for ACTUAL behavior)
- file: ./sharp-at-file.ts
  why: "The COMPLETE shipped extension. The README's every behavioral claim is verified against this file.
        Read the 8 exports + the default factory, the FILE_INJECT_RE / MIME_BY_EXT / TRAILING_PUNCT
        constants, the 3 handler guards, the injectFiles assembly, and the format*Block helpers."
  pattern: "default(pi){ pi.on('input', async(event,ctx)=>{ 3 guards; await injectFiles(...); notify;
            transform/continue }) }"
  critical: "TRAILING_PUNCT is the literal string \".,;:!?\\\")]}>'\" — note the LAST char is an
        apostrophe (U+0027), NOT a backtick (U+0060). This single fact drives the F1 known-limitation:
        a `#@a.ts` token followed by a backtick is NOT trimmed, so the path `a.ts\\`` does not resolve
        and nothing is injected. Document this exactly."

# MUST READ — the validation report (the EVIDENCE for shipped behavior, incl. the F1 divergence)
- docfile: plan/001_5aa8724eb506/P1M2T4S1/validation_report.md
  why: "Authoritative post-validation results. The 14-row §11 matrix (all pass), the edge/guard/headless
        rows, the 2 live-integration confirmations (#12 -p, #13 parity), and Finding F1 (the fenced-code
        ACTUAL behavior the README must document). The README's 'Testing' section cites this report."
  section: "The 14-row matrix + 'Findings / F1' + 'Re-run instructions'"
  critical: "F1 states: shipped behavior for `#@` inside backticks is injected===0 (NOT 1). The README
        must document the workaround `# @` (space) and note that a `#@` immediately followed by a
        backtick won't inject. Quote the finding's reasoning verbatim if helpful."

# MUST READ — the PRD (READ-ONLY; cite §s for design rationale, never contradict the shipped source)
- docfile: PRD.md
  why: "§1 = tagline + value proposition. §2 = Goals/Non-Goals (the 'no config / no size gate' contract).
        §4 = syntax grammar + detection regex + cleanup + path resolution. §5 = behavior-by-file-type.
        §10 = edge-case checklist. §12 = implementation notes (loop prevention, steer skip, append-not-
        inline). §13 = design rationale (why #@ not @, why no config, the size tradeoff). Appendix A =
        tagline + done-definition."
  section: "§1, §2, §4, §5, §10, §12, §13, Appendix A"
  gotcha: "PRD §10 row '##@file## inside a fenced code block' says 'Still matched/injected (known minor
        limitation)'. The SHIPPED behavior differs (F1: not injected). When documenting, lead with the
        actual behavior and note the PRD intent parenthetically — do NOT silently copy the PRD's claim."

# MUST READ — the model-free acceptance harness (the README's examples + the verification command)
- file: ./sharp-at-file.test.mjs
  why: "The exact example prompts the README should mirror (Review #@a.ts, Summarize #@huge.log, Describe
        #@pic.png, Inspect #@data.bin, Diff #@a.ts vs #@b.ts, Read #@~/notes.md, See #@a.ts., Review @a.ts)
        AND the one re-runnable verification command: `node ./sharp-at-file.test.mjs`. Reuse these
        examples verbatim so a reader can run the harness and see them pass."

# SHOULD READ — install conventions + README format references (verified against the installed package)
- docfile: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md
  why: "The authoritative install guide. 'Extension Locations' table: global ~/.pi/agent/extensions/*.ts,
        project-local .pi/extensions/*.ts. 'Quick Start' shows `pi -e ./my-extension.ts`. 'Placement for
        /reload' note: auto-discovered locations hot-reload with /reload; -e is for quick tests only.
        'Available Imports' table (the extension imports are all from the supported packages)."
  section: "Quick Start + Extension Locations + Available Imports"
  critical: "jiti transpiles on load — NO build step, NO package.json, NO tsconfig needed. State this in
        the README (a common user question). npm deps 'just work' only if a package.json is present; this
        extension has ZERO npm deps, so none of that applies — keep install to 'copy the .ts file'."

- docfile: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/subagent/README.md
  why: "A complete, well-structured example README for a Pi extension (Features → Structure → Installation
        → Security Model → Usage → Output → Limitations). Mirror its tone and section discipline; the
        #@file README is simpler (single file, no security model) but should feel equally professional."
  pattern: "H1 title + one-line description; fenced ```bash for install commands; tables for structured
        info; a 'Limitations' section with bullets; copy-pasteable usage examples."

- docfile: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/README.md
  why: "The canonical 'extension examples' index README — shows the house style for tables + per-extension
        one-liners + the `cp permission-gate.ts ~/.pi/agent/extensions/` install idiom."

# SHOULD READ — extension-loading recon (the exact discovery order + the -e flag mechanics)
- docfile: plan/001_5aa8724eb506/architecture/extension_patterns.md
  why: "§5 'Extension loading mechanism' — discovery order (project-local .pi/extensions → global
        ~/.pi/agent/extensions → explicit -e paths), the -e/--extension flag (repeatable), jiti
        transpile-on-load (no tsconfig), and the dedup-by-path rule. Cite if a user asks 'why didn't mine
        load' (e.g. they put it in the wrong dir, or a project isn't trusted)."
  section: "§5 (Extension loading mechanism)"

# SHOULD READ — the prior subtask contracts (what the shipped functions GUARANTEE — backstops for claims)
- docfile: plan/001_5aa8724eb506/P1M1T3S1/PRP.md
  why: "injectFiles contract: seeds images=[...imagesIn] (MERGE — user images preserved at [0]); returns
        ORIGINAL imagesIn ref when count===0; each file isolated in try/catch (NEVER throws);
        finalText = text + '\\n\\n---\\n\\n' + blocks.join('\\n\\n'); original text NOT mutated (the #@
        markers stay). The README's 'append, not inline-replace' claim rests on this."
- docfile: plan/001_5aa8724eb506/P1M1T3S2/PRP.md
  why: "Handler contract: guard order source→steer→includes('#@'); notify fires IFF ctx.hasUI && injected>0
        with msg `#@ injected ${injected} file(s)` type 'info'; success returns
        {action:'transform', text, images}. The README's 'works in print/json mode (no notify)' claim
        rests on the hasUI guard."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── .gitignore            # ignores node_modules/, dist/, .pi-subagents/ — NOT README.md ✓
├── PRD.md                # READ-ONLY source of truth (cite §s; do NOT edit)
├── sharp-at-file.ts      # ← COMPLETE shipped extension (8 exports + default). READ-ONLY; the README
│                         #   documents THIS file's actual behavior.
├── sharp-at-file.test.mjs# ← model-free acceptance harness. README examples mirror its prompts; the
│                         #   'Testing' section cites `node ./sharp-at-file.test.mjs`.
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/{api_verification,system_context,external_deps,extension_patterns}.md
        ├── prd_snapshot.md / prd_index.txt / tasks.json   # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T{1,2,3}*/{PRP.md, research/}              # the complete extension's contracts
        ├── P1M2T4S1/{PRP.md, research/, validation_report.md}  # the validation this README cites
        └── P1M2T5S1/
            ├── research/        # (optional; findings live inline in this PRP)
            └── PRP.md           # ← THIS FILE
# NOTE: NO README.md exists yet. NO package.json, NO tsconfig, NO LICENSE — and none should be added
#       (this task creates ONLY README.md). The repo is intentionally minimal: one .ts + one .mjs.
```

### Desired Codebase tree with files to be added

```bash
README.md                # NEW — repo root. ~150–250 lines GFM. The SOLE user-facing doc for the extension.
                         #   Responsibility: let a user install, use, predict behavior, and find the
                         #   limitations/escape hatch — all accurately, sourced from the shipped .ts +
                         #   the T4.S1 validation report.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — TRAILING_PUNCT does NOT include the backtick. The shipped constant is the literal string
     ".,;:!?\")]}'"  (last char = apostrophe U+0027, NOT backtick U+0060). This is WHY a `#@a.ts` token
     immediately followed by a backtick resolves to the path `a.ts`` (no such file) → injected===0. The
     README's fenced-code limitation must explain this precisely (F1), and must NOT say " #@ is matched
     inside code blocks" (that was the PRD §10 pre-validation assumption — disproven by the harness). -->

<!-- CRITICAL — behavior is APPEND, not inline-replace. The original prompt text (including the literal
     `#@path` markers) is preserved byte-for-byte; the `<file>…</file>` blocks are appended after a
     `\n\n---\n\n` separator, joined to each other with `\n\n`. Document this: the marker STAYS in the
     user's message bubble (as a readable reference), and the file content appears below the rule. -->

<!-- CRITICAL — `@` is UNTOUCHED. The regex only matches `#@` (hash-then-at), never bare `@`. Test #14
     proves `Review @a.ts` is byte-for-byte unchanged. The README must state this unambiguously so users
     don't fear installing it alongside Pi's built-in @ autocomplete / @mention. -->

<!-- CRITICAL — there is NO size gate, by design. A `#@` on a 50 MB file injects 50 MB. The README must
     state this honestly AND explain it's the point (PRD §13.1/§13.2): for partial/large reads, the user
     uses Pi's `read` tool with offset/limit. Do NOT soften this into "it truncates large files" — it
     does not, and saying so would be a factual error against the shipped source + test #2. -->

<!-- CRITICAL — images are resized to 2000×2000 (hardcoded default of resizeImage), NOT because of config
     but because providers REJECT oversized images. The whole image is still delivered (downscaled to
     fit). This is NOT a contradiction of "no config" — it's a correctness requirement. State it as such. -->

<!-- GOTCHA — the binary note uses an em dash (U+2014), not a hyphen-minus. The exact shipped string is:
     `<binary file \u2014 contents not injected; use the read tool if needed>`
     If you paste it into the README, paste the em dash (—), not "-". The harness asserts the em dash. -->

<!-- GOTCHA — injectFiles NEVER throws. Each file is wrapped in its own try/catch; a missing/dir/perm-
     error/unreadable file just leaves the `#@token` verbatim and processing continues. The README should
     reassure users: "a broken `#@` never breaks your prompt." -->

<!-- GOTCHA — the notify message is `#@ injected N file(s)` (note: "file(s)" literal, N is the integer
     count), shown only when ctx.hasUI is true (skipped in print/-p and json modes). If you quote it in
     the README, quote it exactly. -->

<!-- GOTCHA — the README is rendered by Pi's own Markdown renderer, GitHub, and VS Code. Stick to
     standard GFM: ATX headings (#), pipe tables, triple-backtick fenced code blocks with a language
     hint (```bash / ``` / ```text). Avoid HTML <details> unless trivially simple; avoid raw <img> tags. -->

<!-- GOTCHA — NO package.json exists in this repo and NONE should be created. The extension is a single
     .ts file with ZERO npm dependencies (it only imports from the Pi-provided aliased packages + node
     builtins). Do NOT add a 'package.json / dependencies' section to the README. -->

<!-- GOTCHA — do NOT add the repo to .gitignore or create any auxiliary files (LICENSE, CHANGELOG,
     CONTRIBUTING). This task = README.md only. -->
```

## Implementation Blueprint

### Data models and structure

No code. The README is pure prose + Markdown. The only "structure" is the section order (the 10 sections
in "What" above). Use this skeleton:

```markdown
# #@file

> #@file — inject the whole file, every time, everywhere.

<1–2 sentence elevator pitch: what it is, for which tool (Pi).>

## What it does
<§1.1/§1.2 — dedicated #@<path> syntax; unconditional; whole file; every context; hooks the input event>

## Installation
<global / project-local / quick-test, + /reload + zero-build note>

## Quick start
<4–6 copy-pasteable example prompts in a fenced block>

## Behavior by file type
<pipe table: one row per type → exact block produced>

## Syntax
<grammar: #@<path>; detection rule; trailing-punct trim; tilde/abs/.. allowed; NOT mid-word>

## Key design choices
<why separate from @; why no size limit; why no config>

## Known limitations
<5 bullets incl. the F1 fenced-code ACTUAL behavior + escape hatch>

## Relationship to @
<#@ = whole file always; @ = unchanged; coexist>

## Testing
<`node ./sharp-at-file.test.mjs`; what it asserts; cite the validation report>
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE ./README.md (repo root; NEW file — the ONLY deliverable)
  - OBJECTIVE: comprehensive, accurate user-facing docs sourced from sharp-at-file.ts + PRD + T4.S1 report.
  - STRUCTURE (top-to-bottom — the 10 sections below; titles may be reworded, content is mandatory):

    (S1) TITLE + TAGLINE.
         - H1: `# #@file` (the leading `# ` then the literal `#@file`).
         - Blockquote with the EXACT PRD §1.3 / Appendix-A tagline (copy verbatim, incl. the backticks
           and the em-dashes are NOT in this string — it uses regular hyphens):
             `> `#@file` — inject the whole file, every time, everywhere.`
         - One-line elevator pitch naming Pi, e.g.:
           "A [Pi](https://github.com/earendil-works/pi-coding-agent) extension that lets you attach an
           ENTIRE file to your prompt by writing `#@<path>` anywhere — the file lands in the model's
           context before it replies, with no `read` tool round-trip."

    (S2) WHAT IT DOES. Two short paragraphs sourced from PRD §1.1/§1.2:
         - Para 1: `#@<path>` is a dedicated, unconditional, whole-file injection trigger. When you write
           it anywhere in a submitted prompt, the ENTIRE referenced file is read and its contents are
           appended to the prompt in Pi-native `<file name="…">…</file>` blocks. No size limit, no config.
         - Para 2: it works identically in every context — interactive TUI messages, the initial
           `pi -p`/CLI message, and RPC — because it hooks Pi's `input` event (which fires inside
           `AgentSession.prompt()` for ALL inputs), NOT argv parsing. Contrast: Pi's built-in `@file`
           only expands at the CLI before the session starts.

    (S3) INSTALLATION. Three options, each a fenced ```bash block. Sourced from pi's docs/extensions.md:
         - GLOBAL (recommended for "always on"):
             ```bash
             mkdir -p ~/.pi/agent/extensions
             cp sharp-at-file.ts ~/.pi/agent/extensions/sharp-at-file.ts
             ```
           then start `pi` (or run `/reload` if already running).
         - PROJECT-LOCAL (per-repo; loads after the project is trusted):
             ```bash
             mkdir -p .pi/extensions
             cp sharp-at-file.ts .pi/extensions/sharp-at-file.ts
             ```
         - QUICK TEST (one-off, no install):
             ```bash
             pi -e ./sharp-at-file.ts
             ```
           (also show the `-p` form: `pi -e ./sharp-at-file.ts -p "Review #@a.ts"`.)
         - A short note: "No build step, no dependencies. Pi loads `.ts` extensions via jiti
           (transpile-on-load), so the single `sharp-at-file.ts` file is all you need." (Cite pi docs.)

    (S4) QUICK START. One fenced block with 4–6 copy-pasteable prompts — use the SAME prompts the test
         harness asserts (so a reader can `node ./sharp-at-file.test.mjs` and see them pass):
             ```text
             Review #@a.ts
             Describe #@pic.png
             Summarize #@~/notes.md
             Diff #@a.ts vs #@b.ts
             See #@a.ts.          # trailing punctuation is trimmed automatically
             Review @a.ts         # bare @ is UNCHANGED — no injection by this extension
             ```
         Follow with a 1–2 sentence "what happens" note: the file contents appear below a `---` rule in
         your message; the original `#@path` marker stays as a readable reference.

    (S5) BEHAVIOR BY FILE TYPE — a pipe table. Each row's "Output" cell must be the byte-accurate block
         from sharp-at-file.ts (verify against formatTextFileBlock/formatImageBlock/formatBinaryBlock):
           | File type | What `#@path` does | Output appended to your prompt |
           |---|---|---|
           | Text (`.ts`, `.md`, `.json`, `.log`, …) | Entire file contents injected, no truncation | `<file name="/abs/path">\n<entire contents>\n</file>` |
           | Image (`.png` `.jpg`/`.jpeg` `.gif` `.webp` `.bmp`) | Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag | `<file name="/abs/path"></file>` (plus the image is attached) |
           | Other binary (NUL byte detected, not an image) | NOT decoded — a clear note instead of garbage | `<file name="/abs/path"><binary file — contents not injected; use the read tool if needed></file>` |
           | Missing file | Token left exactly as you wrote it | (nothing appended) |
           | Directory (`#@src/`) | Token left exactly as you wrote it | (nothing appended) |
           | Read/permission error | Token left exactly as you wrote it | (nothing appended) |
         NOTE for the image row: the `<file name="…"></file>` may include dimension hints when the image
         is resized; on tiny/undecodable images `resizeImage` returns null and the hints are empty (the
         raw image bytes are still attached). Keep the row's "(plus the image is attached)" phrasing.

    (S6) SYNTAX. Sourced from PRD §4. Verify against FILE_INJECT_RE in sharp-at-file.ts:
         - Grammar: `` `#@<path>` `` — the two-char trigger `#@` immediately followed by a path token
           (a maximal run of non-whitespace characters).
         - Where it matches: at the start of the prompt, OR right after a non-word character (space,
           `(`, `[`, etc.). It does NOT match mid-word (`foo#@bar` → no injection).
         - Trailing punctuation is trimmed: `` `#@a.ts.` `` → `a.ts`; `` `(#@a.txt)` `` → `a.txt`. Trimmed
           chars: `.` `,` `;` `:` `!` `?` `"` `'` `)` `]` `}` `>`.
         - Paths: relative (resolved against the current working directory), absolute (`#@/etc/hosts`),
           tilde (`#@~/notes.md`), and `../` are ALL allowed. No cwd restriction — you asked for it.

    (S7) KEY DESIGN CHOICES. Three short subsections (PRD §13):
         - "Why a new `#@` symbol instead of reusing `@`" (§13.3): `@` is already overloaded (interactive
           autocomplete + CLI inject); `#@` is unambiguous, collision-free with markdown headings, issue
           `#1234`, and `user@host` email, and it reads as "force/sharp/inject." Bonus: you can type `#`
           then use Pi's `@` path-completion to fill the path, yielding `#@path`.
         - "Why no size limit" (§13.1/§13.2): the whole point. `#@` is the predictable "give the model all
           of this file" affordance; gating it would make it a worse `@`-with-config. Tradeoff: a careless
           `#@` on a huge file can blow the context window — that's accepted (it's your explicit action).
           For partial/large reads, use Pi's `read` tool with `offset`/`limit`.
         - "Why no config" (§13.4): configuring it would defeat its purpose. No env vars, no settings, no
           flags beyond `pi -e`. (The 2000×2000 image resize is a correctness requirement — providers
           reject oversized images — not a user-facing knob.)

    (S8) KNOWN LIMITATIONS — a bulleted list of exactly these 5 (sourced from PRD §4.4/§4.3/§13.2 + the
         T4.S1 validation_report.md Finding F1). LEAD WITH ACTUAL BEHAVIOR for the fenced case:
           - **No size gate (by design).** `#@` on a 50 MB file injects 50 MB and may overflow the model's
             context window. This is intended. For large files, use Pi's `read` tool with `offset`/`limit`.
           - **Paths with spaces can't be expressed.** A space ends the path token (`#@my file.txt`
             injects `my`). Use the `read` tool for such files. (PRD §4.4 known limitation.)
           - **`#@` immediately followed by a backtick does not inject.** Inside a fenced code block
             (`` `#@a.ts` ``), the captured token is `` a.ts` ``; the trailing backtick is NOT in the
             trimmed-punctuation set, so the path `` a.ts` `` doesn't resolve and nothing is injected
             (the token is left verbatim). This is the shipped, tested behavior. To reliably suppress
             `#@` anywhere in prose or code, write `# @` (with a space). *(The PRD's edge-case note had
             assumed `#@` inside code blocks would still inject; the shipped extension is safer — it does
             not. See the validation report, Finding F1.)*
           - **No directory reads.** `#@some/dir/` is left as a literal token. Use a `read`/`ls` tool.
           - **No globbing / multi-file.** `#@src/*.ts` is a single path token (the literal path
             `src/*.ts`), not a glob expansion.
         (Optional 6th, only if space: "Mid-stream steering is skipped for latency" — but this is internal,
         arguably not user-facing; prefer to keep the list to the 5 user-visible ones.)

    (S9) RELATIONSHIP TO @. Short, explicit (PRD §13.5):
         - `#@file` → whole file, always, everywhere (this extension).
         - `@file` → Pi's built-in behavior (interactive path autocomplete / `@mention`; CLI argv
           inject). UNCHANGED by this extension — the regex only matches `#@`, never bare `@`.
         - They coexist: use `#@` for "I know I want all of it"; use `@` (or the `read` tool) when you
           want partial/size-gated input.
         Cite test #14: `Review @a.ts` is byte-for-byte unchanged.

    (S10) TESTING. One fenced block + 2 sentences:
             ```bash
             node ./sharp-at-file.test.mjs     # model-free; exits 0 iff all assertions pass
             ```
         Note: the harness imports the REAL `sharp-at-file.ts` (via jiti, like Pi's loader), runs all 14
         PRD §11 acceptance cases + edge cases + handler guards, and prints a pass/fail matrix. See
         `plan/001_5aa8724eb506/P1M2T4S1/validation_report.md` for the full recorded results (23 passed,
         0 failed at last run). No network, no model API key, no Pi process required.

  - NAMING/PLACEMENT: file `README.md` at the REPO ROOT (alongside `sharp-at-file.ts`). NOT under
        plan/, NOT in a subdirectory. (GitHub and most tools surface a root README.md automatically.)
  - FOLLOW pattern: the section discipline + fenced-```bash install idioms of
        examples/extensions/subagent/README.md and examples/extensions/README.md. GFM pipe tables.
  - DEPENDENCIES: none (Markdown only). Do NOT create package.json/LICENSE/etc.

Task 2: SELF-VERIFY the README against the source (NO code changes — cross-check only)
  - For EACH behavioral claim in the README, open sharp-at-file.ts and confirm the claim matches the
    constant/function. Specifically confirm:
      * the behavior table's block strings equal formatTextFileBlock/formatImageBlock/formatBinaryBlock
        outputs (S5);
      * the trimmed-punctuation char list in S6 equals the TRAILING_PUNCT constant (and that the backtick
        is ABSENT — drives S8 bullet 3);
      * the "append after `---`, original text preserved" claim in S4/S2 matches injectFiles' finalText
        assembly (`text + "\n\n---\n\n" + blocks.join("\n\n")`);
      * the "never throws / broken #@ doesn't break your prompt" reassurance matches the per-file
        try/catch in injectFiles;
      * the F1 limitation (S8 bullet 3) matches validation_report.md Finding F1 (injected===0 for the
        backtick case), NOT the PRD §10 row.
  - If ANY claim is wrong: fix the README (it's YOUR file this task) — never edit sharp-at-file.ts.
```

### Implementation Patterns & Key Details

```markdown
<!-- PATTERN: tagline is a blockquote, rendered verbatim. The exact string (from PRD §1.3 / Appendix A):
> `#@file` — inject the whole file, every time, everywhere.
Note: the backticks wrap `#@file`; the dashes are regular ASCII hyphens (NOT em dashes). Copy it exactly. -->

<!-- PATTERN: the behavior table is the single most-referenced part. Make the "Output" column copy-
     pasteable and byte-accurate. The three non-trivial cells (lifted from sharp-at-file.ts):

  TEXT   ->  <file name="/abs/path/to/file.ts">
             <entire file contents>
             </file>
             (i.e. `'<file name="' + abs + '">\n' + content + '\n</file>'`)

  IMAGE  ->  <file name="/abs/path/to/img.png"></file>     (+ the image is attached as an ImageContent)
             (empty hints when resizeImage returns null; may include dimension hints otherwise)

  BINARY ->  <file name="/abs/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
             (the "—" between "file" and "contents" is an EM DASH U+2014, not a hyphen)

  Represent newlines inside table cells as literal newlines (GFM allows multi-line cell content if the
  pipe table is well-formed) OR as `⏎`/`\n` placeholders with a legend. Prefer a small fenced example
  block under the table for the multi-line text case, keeping the table cell single-line. -->

<!-- PATTERN: every install command is a fenced ```bash block (renders a copy button on GitHub).
     Show `mkdir -p` before `cp` so the command works on a fresh machine. -->

<!-- PATTERN: link Pi once (to its repo/docs) on first mention, then refer to it as "Pi".
     DO NOT link to internal plan/ paths (those are maintainer-only and may not ship). -->

<!-- PATTERN: keep "Known limitations" honest and specific. Each bullet should let a user answer "is this
     my situation?" in one read. The fenced-code bullet is the subtlest — explain the backtick mechanic
     in one sentence so it's not just "sometimes it doesn't work." -->

<!-- CRITICAL: do NOT promise behavior the extension doesn't have. In particular, do NOT claim:
       - "truncates large files" (it does the OPPOSITE — test #2 proves byte-for-byte whole-file inject);
       - "respects a maxWords/maxBytes setting" (there is NO setting — PRD §2 Non-Goal);
       - "reads directories" / "expands globs" (it does neither — left verbatim);
       - " #@ works inside fenced code blocks" (it does NOT when a backtick follows — F1).
     Every one of these would be a factual error against the shipped source. -->
```

### Integration Points

```yaml
NO production integration changes (documentation-only task).
FILE LAYOUT:
  - creates: ./README.md (repo root; the sole new file)
  - reads (READ-ONLY, for accuracy): ./sharp-at-file.ts, ./sharp-at-file.test.mjs, PRD.md,
        plan/001_5aa8724eb506/P1M2T4S1/validation_report.md, the architecture/*.md docs, and the
        installed pi package's docs/extensions.md + examples/extensions/**/README.md.
GIT:
  - README.md is NOT in .gitignore (the gitignore only lists node_modules/, dist/, .pi-subagents/) → it
        will be tracked. Do NOT modify .gitignore.
  - Do NOT add the repo to .gitignore; do NOT create LICENSE/CHANGELOG/CONTRIBUTING/package.json.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# 1. Markdown is valid + renders (pick whichever is available; all exit 0 on valid GFM):
npx --yes markdownlint-cli2 ./README.md        # if npx is available; config-free GFM lint
# OR a quick structural sanity check (headings + that the tagline + install fence are present):
grep -n "^# #@file" ./README.md && \
grep -n "inject the whole file, every time, everywhere" ./README.md && \
grep -n "pi -e ./sharp-at-file.ts" ./README.md && \
grep -n "node ./sharp-at-file.test.mjs" ./README.md && \
echo "README structure OK"
# Expected: all 5 grep lines print + "README structure OK". If any is missing, the section is absent —
# add it. (No hard line-count requirement, but expect ~150–250 lines.)
```

### Level 2: Accuracy Cross-Check (the PRIMARY gate for a docs task)

```bash
# 2a. The README's behavioral claims must match the SHIPPED source. Run the model-free harness — if it's
#     green, every behavior the README documents (text/image/binary/missing/dir/mid-word/multi/tilde/
#     trailing-punct/bare-@) is confirmed live against the real sharp-at-file.ts:
node ./sharp-at-file.test.mjs
# Expected: "X passed, 0 failed" and exit 0. If it fails, the README (or the extension) is describing
# behavior that doesn't match — for THIS task, fix the README to match the harness's actual results
# (do NOT touch sharp-at-file.ts; that belongs to the M1 subtasks).

# 2b. The single most error-prone claim — the F1 fenced-code behavior. Confirm the README documents the
#     ACTUAL behavior (no-match when followed by a backtick), not the PRD §10 assumption:
grep -n "backtick" ./README.md     # must mention the backtick mechanic
# And confirm the README does NOT assert " #@ is matched inside code blocks":
! grep -n "matched inside" ./README.md || echo "WARNING: re-check the fenced-code limitation wording"
```

### Level 3: Integration (Manual — does the README's promise hold in real Pi?)

```bash
# 3a. Install per the README's GLOBAL instructions and exercise a documented example:
mkdir -p ~/.pi/agent/extensions
cp ./sharp-at-file.ts ~/.pi/agent/extensions/sharp-at-file.ts
# Then either start `pi` and type:  Review #@<some-local-file>
# ...or use -p (the README documents this form too):
pi -e ./sharp-at-file.ts -p "Review #@sharp-at-file.ts"
# Expected: the model's prompt already contains the file in a <file name="…"> block; the model reviews
# it WITHOUT calling the read tool (confirm in the transcript / user-message bubble). This is acceptance
# case #12, already confirmed live in the validation report.

# 3b. Confirm bare @ is untouched (the README's "Relationship to @" claim):
pi -e ./sharp-at-file.ts -p "Review @sharp-at-file.ts"
# Expected: the literal "@sharp-at-file.ts" reaches the model unchanged (no injection by this extension).

# 3c. Confirm format parity with the built-in @file (the README's selling point):
pi @sharp-at-file.ts "ok"     # built-in CLI @file expansion
# Expected: emits <file name="/abs/sharp-at-file.ts">\n<content>\n</file> — byte-identical CONTENT to
# the #@ block (only the per-block trailing \n / assembly differ). This is acceptance case #13.
```

### Level 4: Creative & Domain-Specific Validation

```bash
# 4a. Render preview — does it look right in a real Markdown renderer? Open in VS Code's preview, or:
npx --yes markdown-to-html ./README.md > /tmp/readme.html 2>/dev/null && echo "renders" || echo "(no renderer; visual check skipped)"
# Expected: the behavior table renders as a table; fenced ```bash blocks render as code; the tagline
# blockquote renders as a quote. Fix any broken pipe-table syntax (unescaped `|` in cells, missing
# header separator row).

# 4b. Cold-read test (the ultimate docs gate): hand the README to someone unfamiliar with the repo and
# ask: (i) how do you install it? (ii) what does `#@data.bin` do? (iii) how do you stop `#@` from
# triggering in a code block? If they can't answer from the README alone, the relevant section is too
# thin or ambiguous — revise it.

# 4c. Link rot check — any external links (e.g. the Pi repo URL) resolve:
grep -oE 'https?://[^ )]+' ./README.md | sort -u | while read -r url; do
  curl -sI "$url" -o /dev/null -w "%{http_code} $url\n" || echo "FAIL $url"
done
# Expected: 200 for each. Fix or remove any dead links (keep the Pi repo/docs links — they are stable).
```

## Final Validation Checklist

### Technical Validation

- [ ] `./README.md` exists at repo root (NOT in a subdirectory; NOT under plan/).
- [ ] Renders as valid GFM: all pipe tables well-formed (header + separator row); all fenced code blocks
      closed; no stray HTML. (Level 1 + Level 4a.)
- [ ] All 10 sections present and non-stub (Level 1 grep checks pass).
- [ ] `node ./sharp-at-file.test.mjs` exits 0 (Level 2a) — confirms the documented behaviors match the
      shipped source.
- [ ] The F1 fenced-code limitation documents the ACTUAL behavior (backtick → no-match), with the `# @`
      escape hatch (Level 2b).
- [ ] No external links are dead (Level 4c).

### Feature (Documentation) Validation

- [ ] Tagline matches PRD §1.3 / Appendix A verbatim.
- [ ] Behavior table's block strings are byte-accurate vs `format*Block` in `sharp-at-file.ts`.
- [ ] Trimmed-punctuation char list matches the `TRAILING_PUNCT` constant (backtick ABSENT).
- [ ] Installation covers global (`~/.pi/agent/extensions/`), project-local (`.pi/extensions/`), and
      `pi -e ./sharp-at-file.ts`, plus `/reload` and the zero-build note.
- [ ] Usage examples mirror the test harness prompts (a reader can run them and see green).
- [ ] "Relationship to @" states bare `@` is untouched (test #14).
- [ ] Known limitations cover all 5 (no size gate, spaces-in-paths, fenced-code/backtick, no dirs, no globs).

### Code Quality Validation

- [ ] Every claim is sourced (PRD §, `sharp-at-file.ts` export/constant, or validation report) — no
      invented behavior.
- [ ] Where the PRD and shipped behavior diverge (F1), the README leads with shipped behavior.
- [ ] Professional tone; copy-pasteable fenced commands; no maintainer-internal `plan/` links in the
      user-facing body (the "Testing" section MAY cite the validation report path since it ships with
      the repo).
- [ ] No anti-patterns: no "sometimes truncates" (false), no config knobs documented (there are none),
      no claims of directory/glob support (there is none).

### Scope Discipline

- [ ] ONLY `./README.md` created. No `package.json`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `.gitignore`
      edits.
- [ ] `sharp-at-file.ts` UNCHANGED. `PRD.md` UNCHANGED. `tasks.json` / `prd_snapshot.md` UNCHANGED.
- [ ] `sharp-at-file.test.mjs` UNCHANGED (this task documents it, doesn't modify it).

---

## Anti-Patterns to Avoid

- ❌ Don't copy the PRD's §10 " #@ inside a fenced code block: Still matched/injected" claim verbatim —
  that was a pre-validation assumption DISPROVEN by the harness (F1). Document the actual behavior
  (no-match when a backtick follows) and note the PRD intent parenthetically.
- ❌ Don't describe `#@` as "a configurable injector" or mention settings/env vars — it has none (PRD §2,
  §13.4). The only "flag" is `pi -e`, which is a Pi flag, not an extension setting.
- ❌ Don't promise truncation, chunking, offset/limit, globbing, or directory reads — none exist (PRD §2
  Non-Goals). Saying they do is a factual error.
- ❌ Don't paste the binary note with a hyphen instead of an em dash — the shipped string uses U+2014
  (the harness asserts it). Paste the real `—`.
- ❌ Don't hardcode maintainer-specific absolute paths (`/home/dustin/...`) in install examples — use
  `~/.pi/agent/extensions/` and `./sharp-at-file.ts` so the commands work for anyone.
- ❌ Don't link to internal `plan/.../PRP.md` files from the user-facing body (they're planning artifacts,
  not user docs). The "Testing" section may cite `plan/.../P1M2T4S1/validation_report.md` since that
  report ships in the repo and is the evidence for the test claims.
- ❌ Don't create any file other than `./README.md`. (No LICENSE, no package.json, no CHANGELOG.)
- ❌ Don't edit `sharp-at-file.ts`, `PRD.md`, `tasks.json`, `prd_snapshot.md`, or `.gitignore`.

---

## Confidence Score

**9/10.** Every load-bearing fact for a docs task is already in hand, first-hand:
- ✅ The shipped extension's exact behavior, constants, and exports — read in full (`sharp-at-file.ts`).
- ✅ The post-validation evidence — read in full (`validation_report.md`), INCLUDING the F1 fenced-code
  divergence that corrects a PRD §10 assumption (the one place the README must not blindly copy the PRD).
- ✅ The authoritative install conventions — read in full (pi's `docs/extensions.md` "Extension Locations"
  + "Quick Start" + the `/reload` placement note; `extension_patterns.md` §5 loading mechanics).
- ✅ README format reference — read in full (`examples/extensions/subagent/README.md`,
  `examples/extensions/README.md`): section discipline, fenced-```bash install idioms, pipe tables.
- ✅ The exact example prompts + the one re-runnable verification command — from `sharp-at-file.test.mjs`.
- ✅ The PRD sections for design rationale — §1/§2/§4/§5/§10/§13/Appendix A.
- The −1 is the inherent "a human's cold-read may find a phrasing ambiguous" residual (mitigated by the
  Level 4b cold-read test + the Level 2 accuracy cross-check against the harness).
```
