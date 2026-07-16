# Research Notes — P1.M1.T3.S1 (README markdown transitive imports, Mode B)

> **Task type: documentation-only (Mode B sync).** No code change, no test change. The only deliverable is
> an in-place edit of `README.md` adding markdown transitive-import content to 5 sections. This runs LAST
> (depends on every implementing subtask P1.M1.T2.S1–S4 being landed and green).

---

## 1. The current README.md — full structure (verified, 83 lines)

Read in full on 2025-07-16. Sections + line anchors (stable landmark; numbers shift as we add lines):

| Section | Lines | Content | Touched by S1? |
|---|---|---|---|
| `# #@file` (title + intro) | 1–3 | One-line pitch + paged-delivery phrasing ("injected whole when it fits… paged via read tool when it doesn't") | NO |
| `## Why` | 5–9 | 2 paragraphs: (1) built-in `@file` CLI-only; (2) `#@` always whole, paged when oversize | **YES — add 1 line** |
| `## Install` | 11–17 | `pi install` / `pi remove` | NO |
| `## Usage` | 19–35 | Fenced example block (5 lines) + "On submit…" marker-strip explanation + path-completion + "Bare @ unchanged" | **YES — add markdown-import example** |
| `## What gets injected` | 37–54 | 4-row table (Text/Image/Other binary/Missing) + `<file>` block-format example + "Images matched by real bytes" | **YES — add a markdown-scan note** |
| `## Syntax` | 56–68 | `#@<path>` grammar + **Where it matches:** + **Trailing punctuation is trimmed.** + **Paths:** | **YES — add Markdown imports subsection** |
| `## Limits` | 70–76 | 5 bullets (No size knob / No spaces / No directories / No globs / A backtick right after `#@` blocks it) | **YES — add 3 bullets** |
| `## `#@` versus `@`` | 78–83 | 2 bullets + closing guidance | NO (leave as-is) |

### Paged-delivery consistency check (contract OUTPUT clause 4)
The README is **already** paged-delivery-current (plan 002). Verified all paged phrases remain correct and
non-contradictory with the new markdown content:
- Intro (L2–3): "injected whole when it fits the remaining context, paged via the `read` tool when it doesn't" ✓
- Why (L9): "when it exceeds the budget it is delivered as a head block plus a paging directive" ✓
- Table Text row (L39): "Entire contents injected when they fit remaining context. Oversize files are delivered as a head block plus a paging directive… Never silently truncated." ✓
- Limits "No size knob" (L72): "Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive" ✓

**No stale "no size limit" / "entire contents no truncation" phrases exist** (plan 002 already removed them).
The new markdown budget line ("imports share the single context budget and page when the running total is
exceeded") is **consistent** with these — it is the same budget, just spanning the recursion. No contradiction.

---

## 2. The markdown-import contract to document (verified against file-injector.ts + PRD)

The behavior is fully landed (S1+S2+S3 done; S4 lands the §10 missing-import edge in parallel). Verified by
reading the actual `file-injector.ts`:

| Behavior | Code site | Documented in README section |
|---|---|---|
| Only `.md`/`.markdown` are import sources | `MD_EXTS = new Set(["md","markdown"])` (L37); branch in `injectFile` L482 | Table note (c) + Limit bullet (e) |
| Imports are relative-only; abs/tilde ignored verbatim | `scanTokens(content, dir, { allowAbsTilde: false, skipCode: true })` (L594); `isAbsoluteOrTilde` drop (L403) | Syntax Markdown imports (d) + Limit (e) |
| Resolve from the markdown file's own directory, NOT cwd | `dir = path.dirname(abs)` (L591) | Syntax Markdown imports (d) |
| `#@` inside fenced/inline code is NOT an import | `computeCodeRanges` (L258) + `inCode` (L325) + `skipCode:true` skip (L400) | Syntax Markdown imports (d) escape hatch |
| Each file injected at most once (dedup; cycles terminate) | `injectedSet` claim-self (Step 2) + per-file `localSeen` + global re-check | Syntax Markdown imports (d) + Why line (a) |
| Imports share the single context budget; page when exceeded | `estimateImageTokens`/`subtract` (L481); shared `state.remaining` (§5.6.2) | Syntax Markdown imports (d) |
| Top-level completion exists; in-file imports get NO autocomplete | autocomplete provider (top-level-only, PRD §14.4) | Limit bullet (e) |

### §10 edge (lands via S4, in parallel) — documentation stance
S4 makes a markdown import resolving to a **missing file/directory leave its `#@` marker verbatim** (the stat
pre-check). This is the **same behavior as a top-level missing token** (left as written, nothing appended).
The README already documents the top-level missing-file case ("Missing file, directory, or permission error →
Left as written. Nothing is appended."). The markdown path is consistent with this, so **no separate bullet is
needed** — the general "each import is delivered as its own block" note in (c) covers it (a missing import just
yields no block, consistent with the table's missing row). Keep the docs behavior-focused, not edge-focused.

---

## 3. Exact edits per the contract (item_description clauses a–e)

The contract (from `<item_description>`) maps 1:1 to `codebase_insertion_points.md` §"MI-3 README".
Drafted prose is in the PRP's Implementation Blueprint. Tone: prose-first, concise, examples in fenced
```` ```text ```` blocks — matches the existing README style exactly. Every edit is an **in-place insertion**
that preserves the surrounding section; no section is rewritten.

- **(a) Why** → append ONE line (3rd paragraph): `#@spec.md` pulls in everything it references, same `#@`
  directive, loop-safe via dedup.
- **(b) Usage** → add a markdown-import example: prompt `#@spec.md` where spec.md contains `#@api.md`
  delivers both.
- **(c) What gets injected** → add a note paragraph (after the table, before the `<file>` block-format
  example): a delivered `.md`/`.markdown` is scanned for relative `#@` imports; each delivered as its own
  block, recursed if markdown.
- **(d) Syntax** → add a `**Markdown imports.**` subsection (bold-header style, matching **Paths:**): the
  4-rule contract (relative-only + resolve-from-md-dir; code is the escape hatch; dedup-once; shared budget).
- **(e) Limits** → add 3 bullets: relative-only; only-markdown-is-scanned (non-markdown `#@` inert);
  no autocomplete for in-file directives.

---

## 4. Validation approach (documentation-only)

There is **no automated test for README content** (and we do NOT add one — the PRP scope is README only; the
test harness `file-injector.test.mjs` does not exercise README). Validation is:

1. **Structural completeness** — all 5 sections (Why/Usage/Table/Syntax/Limits) updated; no unrelated section
   touched (Install, `#@` vs `@`, intro, paged-delivery phrases all unchanged).
2. **Accuracy** — every claim matches the landed code (verified in §2 above).
3. **Consistency** — no contradiction with the paged-delivery wording (verified in §1); no stale "no size
   limit" / "entire contents no truncation" introduced.
4. **Regression non-impact** — `node ./file-injector.test.mjs` still prints `75 passed, 0 failed` (README
   does not affect code, but confirms nothing else was accidentally edited). This is the existing gate from
   S4; README edits must not change the count.

---

## 5. Scope boundary & non-goals (guard against over-editing)

Per contract clause 3 ("leave … as-is unless directly touched") and OUTPUT clause 4:
- Do NOT touch the intro (L1–3), Install (L11–17), or `## `#@` versus `@`` (L78–83).
- Do NOT modify the existing table ROWS (Text/Image/Other binary/Missing) — only ADD a note paragraph.
- Do NOT modify the paged-delivery phrases in Why/Why/Table/Limits — they are correct (plan 002).
- Do NOT add a §14.4 deep-dive, a code-region-detection algorithm, or token-cost formulas — the README is a
  user-facing quickstart, not the PRD. Keep it at the same abstraction level as the existing prose.
- Do NOT edit `file-injector.ts`, `file-injector.test.mjs`, `package.json`, `PRD.md`, or any plan file.
