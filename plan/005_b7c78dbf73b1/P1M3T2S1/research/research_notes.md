# Research Notes — P1.M3.T2.S1

**Item:** Add optional bare-`@` markdown-imports subsection to README.md (Syntax + Limits)
**Task type:** Documentation changeset-sync (Mode B — whole-feature overview). The final sweep after
per-symbol JSDoc rode with M1/M2. **No code is written by this task.**

---

## 1. What this task IS and IS NOT

- **IS:** A surgical, voice-matched addition to `README.md` that surfaces the now-shipped
  `markdownBareAtImports` opt-in (PRD §4.6) coherently alongside the existing `#@` feature docs.
- **IS NOT:** A reference-manual port of §4.6. The contract is explicit: *"Do NOT duplicate the full
  §4.6 spec — README is an overview, not a reference."* So NO `BARE_AT_RE` regex, NO implementation
  internals, NO exhaustive edge-case enumeration.
- **IS NOT:** A code/test change. `file-injector.ts`, the test suite, `scripts/`, `package.json`,
  `PRD.md`, `tsconfig.json` are all **read-only** for this task.
- **Depends on:** P1.M3.T1.S1 (the green gate) — it confirms the feature shipped clean (114 passed,
  0 failed; typecheck 0 errors; `injectMarkdown` private). This docs task runs AFTER that gate.

---

## 2. The feature under documentation (verified against IMPLEMENTED source, not just PRD)

All facts below were confirmed by grepping `file-injector.ts` (the real committed source), so the
README will describe actual behavior, not aspirational spec.

| Fact | Source line(s) in `file-injector.ts` | Value |
|---|---|---|
| Config interface | L146 `interface FileInjectorConfig` | `{ markdownBareAtImports?: boolean }` |
| Config file name | L164, L167 | `file-injector.json` |
| Global location | L164 `path.join(getAgentDir(), "file-injector.json")` | `~/.pi/agent/file-injector.json` |
| Project location | L167 `path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json")` | `<cwd>/.pi/file-injector.json` (`.pi`) |
| Trusted-project gate | L166 `if (ctx.isProjectTrusted())` | project file honored ONLY in a trusted project |
| Merge order | L167 `cfg = { ...cfg, ...projectCfg }` | project OVERRIDES global, shallow merge |
| Load time | L879 `pi.on("session_start", …)` → cached in module-level `cfg` (L871) | read once on session_start, cached for session |
| Missing/malformed | L151–152 "→ {} → false downstream. NEVER throws" | default `markdownBareAtImports: false`, never errors |
| Derived flag | L886 `cfg.markdownBareAtImports === true` → 4th arg to `injectFiles` | `bareAt` boolean |
| Top-level scan | L818 `{ …, bareAt: false }` | prompt is **always** `#@`-only — bare-@ NEVER escapes markdown |
| Markdown scan | L711 `bareAt: state.bareAt` → L488–495 `BARE_AT_RE` | bare `@path` matched in markdown content when on |
| No double-match | L489 "BARE_AT_RE forbids a preceding `#`, so `#@file` appears once" | `#@file` = ONE import, never two |
| Strip width | L495 `prefixLen: 1` for bare-@ (vs `2` for `#@`) | marker stripped to its path identically |

**Net behavior to convey (overview level):** OFF by default → the ONE opt-in → set
`{"markdownBareAtImports": true}` in `file-injector.json` → read from two locations (global +
trusted-project) → when on, a bare `@file.md` inside a delivered markdown file behaves exactly like
`#@file.md` (relative-only / extension-shorthand / code-exempt / dedup / shared-budget rules all
unchanged) → `#@` keeps working and is never double-matched → markdown-only (prompt unaffected).

---

## 3. PRD spec (the authoritative wording to paraphrase, NOT copy)

**§4.6 — "Optional bare-@ markdown imports (config: markdownBareAtImports)":**
- Opt-in; default requires `#@` (§4.5).
- Config: `file-injector.json`, two locations (project overrides global, merged shallowly):
  1. Global `~/.pi/agent/file-injector.json`
  2. Project `<cwd>/.pi/file-injector.json`, honored **only when `ctx.isProjectTrusted()`**.
- `{"markdownBareAtImports": true}` → markdown scanning matches BOTH `#@` and bare `@`. Bare match
  uses `BARE_AT_RE` which forbids a preceding `#` → `#@file` matched once, never twice. Every other
  rule identical. Strip is 1 char (vs 2 for `#@`).
- **Scope: markdown-only.** Top-level prompt unaffected (always `#@`, §4.4); a bare `@path` at the
  prompt stays Pi's existing behavior, never injected. Non-resolving bare tokens left verbatim.
- **Loading:** read on `session_start`, cached for session; missing/malformed → default false, never
  an error.

**§13.4 — "Why (almost) no user-facing config" (the WHY-it's-opt-in):**
- Still no config *required*; no knobs for format/image/paging/budget (derived/fixed).
- The ONE opt-in is `markdownBareAtImports`: bare `@file.md` is a widespread doc convention;
  forcing `#@` inside markdown would fight existing docs.
- **It is opt-in (default off) precisely so the default stays zero-setup and unambiguous — `#@`
  remains the only thing that ever triggers injection at the prompt, and bare-@ matching never
  escapes markdown content.** ← THIS is the framing the README must echo.

**Key voice cue from §13.4:** "the default stays zero-setup and unambiguous." The README already says
"with no configuration" in its lede — the new subsection must reinforce (not undermine) that: bare-@
is the *one* escape hatch, everything else is still zero-config.

---

## 4. README.md current state (the canvas)

**Voice/style (must match):**
- Concise, direct, second person ("you", "your").
- Example-driven: short `text`/`json` code fences for concrete examples.
- Bold lead-in for each bullet point (`**Term.**` …).
- A Markdown table for file types (`## What gets injected`).
- No internal anchor links; no ordered lists currently (bullets dominate). A `1. 2.` for the two
  locations is acceptable but a compact bullet form also fits.

**Structure (heading anchors):**
```
L1   # `#@file`
L5   ## Why
L13  ## Install
L21  ## Usage              ← has "Bare `@` is unchanged, so `Review @a.ts` behaves as before." (PROMPT-level @ — KEEP, still correct)
L45  ## What gets injected
L66  ## Syntax
L81     **Markdown imports:** … Five rules narrow it:
L82-86    - Relative paths only / Extension shorthand / Code is escape hatch / Each file at most once / Shared budget
L88  ## Limits
L89-96    8 bullets incl. "Markdown imports are relative-only" (L94) + "Only markdown is scanned" (L95)
L99  ## `#@` versus `@`
```

**Placement decisions (from the contract):**
1. **New `### ` subsection** goes UNDER `## Syntax` (L66), AFTER the last Markdown-imports bullet
   ("Shared budget", L86), BEFORE `## Limits` (L88). Title ~ `### Optional: bare-\`@\` markdown imports`.
2. **One-line note** in `## Limits` stating bare-@ is markdown-only (prompt unaffected). Best thematic
   home: immediately after "Only markdown is scanned." (L95), grouping markdown-scope limits.

**Code-fence accounting (hard validation gate):**
- Current `grep -c '^```' README.md` = **10** (even → balanced). 
- Adding ONE ```` ```json ```` block = +2 fences → expected **12** after edit (still even).
- If the implementer adds the block, fence count must be **even** post-edit (12). An odd count = a
  broken fence = a real defect.

**Stale-claim sweep (no existing content becomes wrong):**
- The one existing "bare `@`" mention (L44-ish, Usage: "Bare `@` is unchanged, so `Review @a.ts`
  behaves as before.") describes the PROMPT-level `@` — still 100% correct (top-level scan hardcodes
  `bareAt: false`, L818). **KEEP it; do not soften or contradict it.** The new subsection is about
  `@` *inside markdown files*, a different context — no conflict.
- No existing mention of `markdownBareAtImports`, `file-injector.json`, or bare-@ imports anywhere in
  README (confirmed: grep returned nothing). So nothing to *edit* for staleness; this is pure ADD.

---

## 5. Recommended README draft (voice-matched; the PRP gives this as a guide, not a straitjacket)

**Add under `## Syntax`, after the "Shared budget" bullet (after L86), before `## Limits`:**

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

**Add to `## Limits`, right after "Only markdown is scanned." (after L95):**

```markdown
- **Bare-`@` imports stay inside markdown.** Even with `markdownBareAtImports` on, a bare `@path` in your prompt is never injected — the setting only changes what a delivered markdown file pulls in. `#@` remains the sole prompt-level trigger.
```

**Cross-link anchor note:** the `[Limits](#limits)` link targets `## Limits` → GitHub anchor `#limits`
(lowercase, spaces→hyphens). Valid. If the implementer prefers no internal links (README uses none
today), the trailing "See Limits below." phrasing is an equally valid substitute — either satisfies
the "coherently alongside" requirement.

---

## 6. Validation approach (no markdown linter in repo)

- `package.json` scripts = only `typecheck` + `test` (both are CODE gates, owned by P1.M3.T1.S1 —
  this docs task does NOT run them; they are green by precondition).
- No `markdownlint`/`mdformat` installed; `npx` is available but the existing README was NOT written
  to pass `markdownlint` (long lines, etc.), so a `markdownlint-cli` run would noise on PRE-EXISTING
  style → make it OPTIONAL, never a hard gate.
- **Hard gates (all greppable, deterministic, run in <1s):**
  1. Code-fence balance: `grep -c '^```' README.md` is **even** (expected 12).
  2. Presence: `markdownBareAtImports`, `file-injector.json`, both paths, the JSON snippet.
  3. Absence (no spec duplication): no `BARE_AT_RE`, no regex literal, no `prefixLen`, no `4.6`/`§`.
  4. Structure: a new `### ` heading exists, and it sits between `## Syntax` content and `## Limits`.
  5. No-stale: the Usage "Bare `@` is unchanged" line is intact; grep finds exactly ONE new `markdownBareAtImports` cluster.

---

## 7. Scope boundaries (cross-task hygiene)

- This is the FINAL task of the P1 (`markdownBareAtImports`) feature. The implementation (M1+M2) and
  the green gate (M3.T1) are DONE before this runs. This task only touches `README.md`.
- Do NOT touch the per-symbol JSDoc in `file-injector.ts` (Mode A already done in M1/M2) — contract
  item 5 ("per-symbol JSDoc already rode with M1/M2").
- Do NOT add docs for any *future* feature (e.g. a size-gated `@`, §13.5) — README documents only
  what ships. The non-Goals/§13.5 are design rationale, not user-facing.
