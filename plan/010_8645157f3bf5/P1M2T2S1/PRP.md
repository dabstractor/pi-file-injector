name: "P1.M2.T2.S1 — README #<url> section + config + limits + wiring"
description: >
  Documentation-only task (Mode B). Edit README.md to document the shipped #<url> web-page
  injection feature WITHOUT rewriting the existing #@file sections. Five surgical edits:
  (a) broaden the tagline, (b) add a short "URLs" subsection under Usage, (c) add the enableUrls
  config block, (d) add a URL-limits note, (e) verify the bundled-deps install story. One file
  touched: README.md.

---

## Goal

**Feature Goal**: Document the already-shipped `#<url>` web-content-injection feature in `README.md`
so users discover it, know its limits, and know how to disable network egress (`enableUrls: false`) —
while leaving every `#@file` section byte-for-byte unchanged and preserving the "works out of the
box, zero setup" value-prop.

**Deliverable**: An updated `README.md` containing exactly five additions (a–e below), woven into the
existing document structure. No source/test/package changes. No new files.

**Success Definition**:
- README accurately reflects the shipped implementation in `file-injector.ts` (constants, dispatch,
  config, display, failure→verbatim).
- Every pre-existing `#@file` section is untouched (a `git diff README.md` shows ONLY additions + the
  one tagline broadening; no `#@file` paragraph is rewritten).
- `npm test` still exits 0 (README is not referenced by any test; this is a sanity check that nothing
  else was disturbed).
- Markdown renders cleanly and the document reads as if URLs were always part of it.

## Why

- **Discoverability.** The feature is shipped and tested (M1 complete, M2.T1 in flight) but invisible
  to users — the current README (11,298 bytes) mentions only `#@file`. This PRP closes that gap.
- **The contract is the changeset docs.** PRD §9 + the item spec mark this as the Mode-B changeset-level
  documentation; it runs last precisely so it can describe real, landed behavior (no speculation).
- **Air-gapped opt-out must be documented.** `enableUrls: false` disables ALL network egress — a
  security-relevant knob users need to know about.
- **Honest limits.** 20 s timeout, 1 MB cap, no caching, SPA fallback, no-paging asymmetry vs files
  — documenting these prevents confused bug reports.

## What

Five additions to `README.md` ONLY. The section anchors below refer to the current README structure
(see "Current README structure" in Context). **Do NOT rewrite any `#@file` paragraph** — all edits are
either brand-new subsections/bullets or a single tagline broadening.

### Success Criteria

- [ ] **(a) Tagline broadened** to mention web pages alongside files (concise); H1 `#@file` and the
  rest of the opening paragraph preserved.
- [ ] **(b) `### URLs` subsection added under `## Usage`** showing `#example.com` and
  `#https://example.com/api`, the fetch→defuddle→markdown→inject flow, the green `read <url>` line,
  and a short before/after. Includes the concise content-type summary (HTML→markdown, raw text/JSON/XML
  verbatim, images attach, PDF/unhandled left as-is) and a "bundled, nothing extra to install" clause.
- [ ] **(c) `enableUrls` config block added** (default `true`; `false` disables ALL network egress) with
  the `{ "fileInjector": { "enableUrls": false } }` JSON example, referencing the same 4-source
  precedence as `markdownBareAtImports` (no verbatim duplication).
- [ ] **(d) URL-limits note added** to `## Limits`: 20 s fetch timeout, 1 MB response cap, no caching
  (re-open/re-submit/fork re-fetches), SPA/JS-rendered pages fall back to verbatim (defuddle works on
  server-delivered HTML only), over-budget URLs left verbatim (no paging — unlike files).
- [ ] **(e) Install section verified** accurate: the 5 deps are bundled `dependencies`; the user
  installs nothing beyond `pi install`. Zero-setup value-prop preserved (no structural change needed;
  the bundled-deps reassurance lives in the URLs subsection per (b)).
- [ ] `git diff README.md` shows additions + the single tagline edit ONLY — zero `#@file` paragraphs rewritten.
- [ ] `npm test` exits 0.

## All Needed Context

### Context Completeness Check
✅ Passes "No Prior Knowledge" test: an agent unfamiliar with the repo gets (1) the exact current
README structure with section anchors, (2) the exact verified implementation facts (constants,
dispatch, config polarity, SPA message, display behavior) with file:line references, (3) ready-to-paste
recommended text for each of the 5 edits, and (4) the hard constraint (don't touch `#@file` sections).

### Documentation & References

```yaml
- prd_section: "§1 Overview & scope (h2.15)"
  why: "The two-trigger table (#@file vs #<url>), the 'what it does' paragraph, and the value-prop
        preservation note ('works out of the box, zero setup' is preserved — deps bundled)."
  critical: "Bundled-not-user-installed is a hard promise to keep in the docs."

- prd_section: "§4 Config: enableUrls (h2.18)"
  why: "default true; false → tokens ignored entirely + NO network request (air-gapped opt-out);
        same 4 sources/precedence as markdownBareAtImports; read on session_start, cached for session."

- prd_section: "§5 Dependencies (h2.19)"
  why: "The 5 hard deps (defuddle/linkedom/turndown/mathml-to-latex/temml) are bundled; Pi packages
        stay optional peerDependencies. Drives edit (e)."

- prd_section: "§6 Chat display (h2.20)"
  why: "URLs reuse the green read-line; FileDetail.kind 'url'; URL shown raw (no tildify). Drives (b)."

- prd_section: "§7 Edge cases (h2.21) + §3.3/§3.4/§3.5"
  why: "Drives the Limits note (d): SPA fallback, no-paging, timeout, cap, raw-text/JSON path,
        enableUrls:false zero-egress."

- prd_section: "§9 Integration with the spec (h2.23)"
  why: "The merge table maps exactly to edits (a)–(e): tagline broaden, enableUrls config, the §5
        bundled-deps note, etc."

- file: file-injector.ts
  lines: "URL_TIMEOUT_MS=20_000 L81; URL_MAX_BYTES=1_000_000 L83; URL_MIN_CONTENT=200 L85;
          enableUrls?: boolean L210; enableUrls default L1331; gate cfg.enableUrls!==false L1492;
          URL scan loop (enableUrls===false skipped → zero egress) L1404-1411; injectUrl L830-916;
          SPA notify `${url}: page appears JS-rendered; left as reference` L886; formatUrlBlock L758;
          readLine kind 'url' (raw URL, no tildify) L1026-1029."
  why: "This IS the source of truth for every factual claim in the docs. Re-read before writing prose
        so the README never drifts from the code."
  gotcha: "URL_MAX_BYTES is decimal 1,000,000 — write '1 MB' in prose, never '1,048,576'.
           enableUrls gate is !== false (default-ENABLED), NOT === true.
           injectUrl NEVER throws and NEVER pages — over-budget → verbatim."

- file: package.json
  lines: "dependencies block (5 entries); scripts.test (4 files); peerDependencies/peerDependenciesMeta."
  why: "Confirms deps are bundled hard-deps (edit e) and README isn't tested (doc edits can't break tests)."

- pattern_file: README.md
  sections: "## Install (pi install npm:pi-file-injector), ## Usage (@ examples + green-line paragraph),
             ### Optional: bare-@ markdown imports (the 4-source config precedence to reference in edit c),
             ## Limits (flat bullet list — append URL bullets in edit d)."
  why: "These are the exact insertion anchors and the style/voice to match (terse, no marketing fluff)."
  gotcha: "Match the existing voice: short declarative sentences, code fences for examples, no emojis."
```

### Current README structure (insertion anchors)

```
# `#@file`                              ← H1 brand (KEEP); tagline paragraph below → EDIT (a)
## Why                                  ← KEEP (do not touch)
## Install                              ← verify only → EDIT (e) — likely NO change needed
## Usage                                ← EDIT (b): add `### URLs` subsection here
   (@ examples block)
   ("On submit, each file shows up as a compact green read line…" paragraph)
   ("Markdown files can import other files…" paragraph)
   (path completion)
   (bare @)
## What gets injected                   ← KEEP (file-type table — do not rewrite)
## Syntax                               ← KEEP
### Optional: bare-@ markdown imports   ← the config section; ends "…See [Limits](#limits)."
                                        ← EDIT (c): add enableUrls config subsection AFTER this
## Limits                               ← EDIT (d): append URL-limits bullets here
## #@ versus @                          ← KEEP
```

### Desired codebase tree (this task's only change)

```
README.md          ← MODIFIED: 5 additions (a–e) + 1 tagline broadening. Nothing else.
```
(No source, test, package, or new-file changes.)

### Known Gotchas of our codebase & Library Quirks

```text
# CRITICAL — Do NOT rewrite #@file sections. The diff must show ADDITIONS + the single tagline
# broadening only. If you find yourself rewording a #@ paragraph, STOP — you're out of scope.

# CRITICAL — enableUrls is default-ENABLED. The gate is `cfg.enableUrls !== false`, NOT `=== true`.
# Docs must say "default true; set false to disable all network egress" — never imply it's off by default.

# CRITICAL — "1 MB" cap is decimal 1,000,000 bytes (URL_MAX_BYTES), NOT 1,048,576. Use "1 MB" in prose;
# do NOT write "1,048,576 bytes" or "1 MiB".

# CRITICAL — URLs NEVER page. Over-budget → verbatim (the read tool can't fetch a URL). This asymmetry
# vs files is a deliberate design point — state it explicitly in the Limits note.

# CRITICAL — No caching. Re-open / re-submit / fork re-fetches fresh. State it.

# CRITICAL — SPA fallback only fires for HTML where defuddle extracts <200 chars; it is NOT a general
# "JS page" detector. Phrase as "JS-rendered pages (defuddle works on server-delivered HTML only)".

# QUIRK — README is not referenced by any test, so `npm test` is a regression sanity check, not a
# markdown validator. Still run it to confirm nothing else was touched.
```

## Implementation Blueprint

### Data models and structure
None — pure documentation. The only "model" is the README's section structure (above).

### Implementation Tasks (ordered by dependencies — all independent edits to README.md)

> All five edits target `README.md`. Do them in any order, but verify the final `git diff` shows ONLY
> these changes. Recommended text is provided below each task — paste/adapt to match the existing voice.

```yaml
Task 1: EDIT (a) — broaden the tagline (H1 + opening paragraph)
  - ANCHOR: the opening paragraph directly under `# \`#@file\``.
  - CURRENT first sentence:
      "A [Pi](https://github.com/earendil-works/pi) extension that injects a whole file into your
       prompt when you write `#@` before the path."
  - REPLACE its first sentence (keep the rest of the paragraph — "The file reaches the model…")
    with a version that mentions web pages, e.g.:
      "A [Pi](https://github.com/earendil-works/pi) extension that injects whole files and web pages
       into your prompt. Write `#@` before a file path, or `#` before a URL."
  - CONSTRAINT: KEEP the H1 `# \`#@file\`` unchanged (it is the npm package brand). KEEP all
    subsequent sentences of the opening paragraph ("The file reaches the model before it replies…").
    Keep it concise — one sentence change.
  - WHY: PRD §9 merge table row "§1/§2 value-prop → optionally broaden the tagline to mention web pages."

Task 2: EDIT (b) — add `### URLs` subsection under `## Usage`
  - ANCHOR: inside `## Usage`, AFTER the "On submit, each file shows up as a compact green `read <path>`
    line directly below your message…never pasted into your message bubble." paragraph and BEFORE
    "Markdown files can import other files."
    (Rationale: that paragraph explains the green-line rendering that URLs share, so the second trigger
    belongs immediately after it; then markdown imports, path completion, bare-@ follow.)
  - ADD a `### URLs` subsection. Recommended content (adapt to match voice):

        ### URLs

        Write `#` before a URL anywhere in your prompt to fetch the page, extract it to markdown, and
        inject that — the same way `#@` injects a file:

        ```text
        Summarize #example.com
        What does #https://example.com/api return?
        Diff #https://news.ycombinator.com vs #@local-notes.md
        ```

        Both `#example.com` (bare domain) and `#https://example.com/api` (full URL) work. On submit
        the page is fetched, the boilerplate is stripped, and the main content is converted to
        markdown by [defuddle](https://github.com/kepano/defuddle) before it reaches the model. Each
        URL renders as a green `read <url>` line — identical to the `read` tool and to `#@file` — and
        `ctrl+o` expands it to the extracted markdown. The `#` trigger stays in your message exactly
        as you typed it, so cancelling and re-opening, forking, or re-submitting re-fetches the page.

        Before / after:

        ```text
        # you type:
        Summarize #example.com
        # you see (green line, ctrl+o to expand):
        read https://example.com (ctrl+o to expand)
        # the model receives:
        <file name="https://example.com">
        # Page Title

        …extracted markdown body…
        </file>
        ```

        By content type:

        - **HTML pages** → extracted to markdown (boilerplate/nav/scripts stripped) and injected.
        - **Raw text, JSON, XML, RSS, Atom** → injected verbatim (no extraction).
        - **Images** (`#https://example.com/cat.png`) → attached as an image, same as `#@image`.
        - **Anything else** (e.g. a PDF, unknown content type) → left as written; nothing is injected.

        The extraction libraries (defuddle and friends) are bundled with the package — you install
        nothing beyond `pi install`. See [Limits](#limits) for the fetch timeout, size cap, and the
        no-paging / no-caching behavior. `#` is disjoint from `#@`, so `#@file.txt` and
        `#https://example.com` in the same prompt both work.

  - CONSTRAINT: keep it SHORT (the table above is the long-form; the prose stays tight). Match the
    README's existing terse voice. Do NOT duplicate the full content-type dispatch from the source —
    the 4 bullets above are enough.

Task 3: EDIT (c) — add the `enableUrls` config block
  - ANCHOR: AFTER the `### Optional: bare-@ markdown imports` subsection (which ends with
    "…See [Limits](#limits).") and BEFORE `## Limits`.
  - ADD a new subsection. Recommended content:

        ### URLs: `enableUrls` (network egress)

        URL injection is on by default. Set `enableUrls` to `false` to disable **all** network egress —
        every `#<url>` token is then left verbatim and no request is made (the air-gapped opt-out):

        ```jsonc
        // ~/.pi/agent/settings.json — namespaced key
        {
          "fileInjector": { "enableUrls": false }
        }
        ```
        ```json
        // or, ~/.pi/agent/file-injector.json — dedicated file
        { "enableUrls": false }
        ```

        `enableUrls` is read from the **same four sources and precedence** as
        `markdownBareAtImports` (above): global `settings.json` → global `file-injector.json` → project
        `settings.json` → project `file-injector.json` (project sources honored only in a trusted
        project). It is read once when a session starts and cached for that session. The default is
        `true`, so `#example.com` works with no configuration at all.

  - CONSTRAINT: do NOT re-list the 4 sources in full — reference "the same four sources and precedence
    as markdownBareAtImports (above)" to avoid drift between the two config blocks.

Task 4: EDIT (d) — append URL-limits bullets to `## Limits`
  - ANCHOR: the end of the existing `## Limits` bullet list (append new bullets; do not modify
    existing `#@file` bullets).
  - ADD a short lead-in + bullets. Recommended content:

        - **URLs: 20 s fetch timeout.** A page that doesn't respond in 20 seconds is left as written.
        - **URLs: 1 MB response cap.** A page whose body exceeds 1 MB is left as written (not paged).
        - **URLs: no caching.** Every injection fetches fresh — cancelling and re-opening, forking, or
          re-submitting re-fetches the page.
        - **URLs: JS-rendered pages fall back to verbatim.** Extraction works on server-delivered HTML
          only. A single-page app that loads its content with JavaScript usually yields too little to
          extract, so the `#<url>` token is left as a reference (with a short notice) instead.
        - **URLs never page.** Unlike `#@file` (which pages oversize files through the `read` tool), an
          over-budget URL is left verbatim — the `read` tool can't fetch a URL.

  - CONSTRAINT: keep each bullet to one line/sentence. Match the existing `## Limits` voice ("No size
    knob.", "No spaces in paths.", etc.).

Task 5: EDIT (e) — verify the Install section (likely NO change)
  - VERIFY the `## Install` section is still accurate: it shows
    `pi install npm:pi-file-injector` (and the git form). The 5 extraction deps are bundled
    `dependencies` in package.json, so the user installs nothing extra — the existing install commands
    are correct as-is.
  - EXPECTED OUTCOME: no edit required. The "bundled, nothing extra to install" reassurance already
    lives in the new `### URLs` subsection (Task 2's closing clause). Do NOT add redundant install
    steps. Only if you find the Install section makes a now-false claim would you touch it — and even
    then, prefer fixing the claim over restructuring.
  - CONSTRAINT: preserve the "works out of the box, zero setup" value-prop. Do NOT add a manual
    `npm install defuddle` step anywhere.

Task 6: SELF-VALIDATE the diff
  - `git diff README.md` → confirm ONLY additions + the single tagline sentence edit. No `#@file`
    paragraph rewritten, no section deleted.
  - `npm test` → exit 0 (sanity; README isn't tested).
  - Eyeball-render: headings nest correctly (### under ##), code fences balanced, anchor
    `[Limits](#limits)` still resolves, no broken markdown.
```

### Implementation Patterns & Key Details

```text
# ── Voice/style to match (from the existing README) ──
# * Terse, declarative, no marketing fluff, no emojis.
# * Code fences (```text / ```json / ```jsonc) for all examples — never inline-prose code that should be fenced.
# * "Left as written" / "left verbatim" = the README's idiom for the failure→token-untouched behavior. Use it.
# * Cross-link sections with lowercased anchors: [Limits](#limits), [Usage](#usage).

# ── The one sentence you ARE allowed to change vs. the many you must NOT ──
# Edit (a) touches exactly ONE sentence (the tagline opener). Everything else in the opening paragraph,
# and EVERY paragraph in Why / Install / the @ examples / What-gets-injected / Syntax / bare-@ config /
# file-Limits-bullets / #@-versus-@, is READ-ONLY for this task. When in doubt, don't touch it.

# ── Disjoint-trigger framing ──
# `#@` (file) and `#` (URL) are disjoint: `#@file` is never a URL, `#url` is never a file. Say so once
# in the Usage subsection so users aren't surprised that both work in the same prompt.
```

### Integration Points

```yaml
README.md:
  - add: `### URLs` subsection inside `## Usage` (edit b)
  - add: `### URLs: enableUrls (network egress)` subsection after the bare-@ config, before `## Limits` (edit c)
  - append: 5 URL bullets to the `## Limits` list (edit d)
  - modify: ONE sentence in the opening tagline paragraph (edit a)
  - verify: `## Install` — no change expected (edit e)

SOURCE/TESTS/PACKAGE: no change (Mode B docs task; README isn't imported or tested).
```

## Validation Loop

### Level 1: Markdown sanity (immediate)
```bash
# Confirm the file parses as valid markdown and headings nest correctly (### must sit under a ##).
# If you have a markdown linter:
npx --yes markdownlint-cli README.md 2>/dev/null || echo "(no markdownlint — eyeball-render instead)"
# Eyeball checks:
#   - `### URLs` and `### URLs: enableUrls…` are under `## Usage` and after `## Syntax` respectively
#     (i.e. `###` never appears without a parent `##`).
#   - All ``` fences are balanced (count must be even):  grep -c '```' README.md  # → even number
#   - The [Limits](#limits) anchor still resolves (a `## Limits` heading still exists).
grep -c '```' README.md   # even?
```

### Level 2: Scope gate — the "don't touch #@file" contract (the core validation)
```bash
# The diff must show ONLY additions + the single tagline sentence edit. Assert no #@file paragraph
# was rewritten by checking that every removed (-) line is part of the ONE tagline sentence.
git diff README.md
# Manual review against this checklist:
#   [ ] Why section:                 unchanged
#   [ ] Install section:             unchanged (or only a verified fix if it was wrong)
#   [ ] Usage @ examples block:      unchanged
#   [ ] What gets injected table:    unchanged
#   [ ] Syntax section:              unchanged
#   [ ] bare-@ config subsection:    unchanged (enableUrls is ADDED after it, not merged into it)
#   [ ] #@-file Limits bullets:      unchanged (URL bullets are APPENDED, existing ones untouched)
#   [ ] #@ versus @:                 unchanged
#   [ ] Only ONE -line block:        the old tagline sentence (edit a)
```

### Level 3: Build/test regression (sanity — README isn't tested, but confirm nothing else moved)
```bash
npm test            # all 4 files exit 0 — proves no source/test/package file was disturbed
npm run typecheck   # exit 0 — proves file-injector.ts / package.json untouched
```

### Level 4: Content accuracy (read-through against source)
```bash
# For each factual claim in the new sections, confirm it matches file-injector.ts:
#   - "20 seconds"          → URL_TIMEOUT_MS = 20_000            (file-injector.ts L81)
#   - "1 MB"                → URL_MAX_BYTES = 1_000_000          (L83)
#   - "default true"        → enableUrls default L1331; gate L1492 (!== false)
#   - "no caching"          → no cache in injectUrl (L830-916); re-submit re-runs scan (L1404)
#   - "never page"          → over-budget return false, no formatPaged… call (L901-904)
#   - "SPA < … verbatim"    → URL_MIN_CONTENT=200 + notify L884-887
#   - "raw text/JSON/XML"   → ct.includes json/xml/markdown → body=html (L894-898)
#   - "image attaches"      → image branch L851-862
#   - "<file name=URL>"     → formatUrlBlock L758, L905
#   - "read <url> line"     → readLine kind 'url' L1026-1029 (raw URL, no tildify)
grep -n "URL_TIMEOUT_MS\|URL_MAX_BYTES\|enableUrls\|formatUrlBlock\|appears JS-rendered" file-injector.ts
```

## Final Validation Checklist

### Technical Validation
- [ ] `grep -c '```' README.md` is even (all fences balanced).
- [ ] `git diff README.md` shows additions + the single tagline edit ONLY.
- [ ] `npm test` exits 0 (4 files).
- [ ] `npm run typecheck` exits 0 (source untouched).

### Feature Validation (the 5 edits)
- [ ] (a) Tagline mentions web pages; H1 + rest of opener preserved.
- [ ] (b) `### URLs` under `## Usage`: both trigger forms, defuddle mention, green `read <url>` line,
      before/after, 4-bullet content-type summary, bundled-deps clause.
- [ ] (c) `enableUrls` config block: default true, `false` = zero egress, JSON example, 4-source ref.
- [ ] (d) 5 URL bullets in `## Limits`: 20 s timeout, 1 MB cap, no caching, SPA fallback, no paging.
- [ ] (e) Install section verified accurate (no redundant/extra steps added).

### Code Quality (docs edition)
- [ ] Voice matches the existing terse README (no marketing fluff, no emojis).
- [ ] Section anchors resolve (`[Limits](#limits)` etc.).
- [ ] `###` headings correctly nested under `##`.
- [ ] No duplicated 4-source config list (enableUrls references markdownBareAtImports).
- [ ] "1 MB" used (not 1,048,576); enableUrls framed as default-true.

### Documentation & Deployment
- [ ] Every `#@file` section byte-for-byte unchanged.
- [ ] "Works out of the box, zero setup" value-prop preserved.
- [ ] README reads as if URLs were always part of the feature set.

---

## Anti-Patterns to Avoid

- ❌ Don't rewrite any `#@file` paragraph — the whole task is ADDITIVE plus one tagline sentence.
- ❌ Don't re-list the 4 config sources under `enableUrls` — reference `markdownBareAtImports` to avoid drift.
- ❌ Don't add a manual `npm install defuddle` step — deps are bundled; zero setup is a promise.
- ❌ Don't claim caching exists — re-open/re-submit/fork re-fetches.
- ❌ Don't imply URLs page — they don't (read tool can't fetch a URL).
- ❌ Don't write "1,048,576 bytes" or "1 MiB" — the cap is decimal 1,000,000.
- ❌ Don't say `enableUrls` defaults to false — it defaults to true (`!== false` gate).
- ❌ Don't merge the `enableUrls` block INTO the bare-@ subsection — add it as a sibling subsection after it.
- ❌ Don't touch the `## What gets injected` table — it's a file-type table; URL behavior lives in the Usage subsection + Limits.
- ❌ Don't add the `### URLs` subsection at the very end of Usage — place it right after the green-line paragraph (logical grouping of the two triggers).

## Confidence Score: 9/10
One-pass success is very high: the feature is already shipped and line-verified against
`file-injector.ts`, the 5 edits are fully specified with exact anchors and ready-to-paste text, and the
"don't touch #@file" contract is enforced by a diff-based validation gate. Residual risk is purely
stylistic (matching the terse voice) — mitigated by explicit recommended text per edit and a read-through
against source in Level 4.