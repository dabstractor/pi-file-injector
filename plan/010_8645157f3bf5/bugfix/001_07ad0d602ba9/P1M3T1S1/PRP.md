# PRP — P1.M3.T1.S1: Update README.md URL detection documentation (BUG-001 changeset doc sync)

**Work item**: P1.M3.T1.S1 (Changeset-level documentation sync → the single subtask)
**Parent**: P1.M3 Changeset-level documentation sync → P1 URL Shape Gate & Notify Bugfix Release
**Delta**: `plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9` (BUG-001 + BUG-002)
**Mode**: B (final sweep of overview docs — the LAST task before the changeset ships).
**Files touched**: **`README.md` ONLY.** No source, no tests, no config.

---

## Goal

**Feature Goal**: Make the README's user-facing URL-detection documentation **honest** about the
code-extension false-positive class that BUG-001 fixes. The single "URLs need a dotted, alphabetic
hostname" bullet (`README.md` L202) currently closes with *"This deliberately rejects `#3.14`,
`#v1.2`, `#fff` and other token-like text"* — phrased as the comprehensive safety statement, which
gives false confidence that `#filename.ext` is safe (it was never safe; it is now explicitly handled
by the deny-list). Rewrite that bullet so the deny-list is the headline behavior: a scheme-less,
path-less `#word.ext` whose final label is a common code/file extension is treated as a **file
reference** (no fetch), a slash makes it a real domain, and the explicit-scheme form is the workaround
to force-fetch a domain whose TLD collides with a code extension.

**Deliverable**: A modified `README.md` — the single Limits bullet at **L202** expanded in place to
document the deny-list, the slash exception, and the explicit-scheme workaround. **No other line,
heading, or section of the README changes, and no other file changes.**

**Success Definition**:
- The L202 bullet (a) documents that scheme-less, path-less `#word.<code-ext>` tokens are treated as
  file references (no fetch), (b) documents the slash exception (`#example.com/img.png` still fetches),
  (c) documents the explicit-scheme workaround (`#https://foo.sh` vs `#foo.sh`), and (d) no longer
  presents "`#3.14`, `#v1.2`, `#fff`" as the closing/only safety statement.
- The new wording is **consistent with the actual JSDoc** on `URL_SHAPE_RE` (`file-injector.ts` L27-42)
  — same terminology ("file reference, not a URL", "scheme-less/path-less", "explicit scheme bypasses
  the check") translated to user-facing prose (NO internal refs like `DET-1`/`P1.M1.T2.S3`/`CODE_EXTENSIONS`).
- **No-touch zones are byte-for-byte unchanged**: L50-55 (URL feature examples) and L184 (enableUrls
  config section). **BUG-002 requires zero README change** (the status toast is undocumented — verified).
- `git diff --stat` shows ONLY `README.md` changed; no new headings/sections ("no structural changes").

## Why

- **Honesty of the only user-facing doc.** The README is the sole user-facing documentation. The PRD
  (h2.5 Recommendations) explicitly calls out the L202 framing as giving false confidence. BUG-001
  (P1.M1.T1.S1, Complete) shipped the `CODE_EXTENSIONS` deny-list gate; this task syncs the README so
  the documented behavior matches the shipped behavior.
- **Consistency with the code's own documentation.** Item LOGIC #3c mandates README ↔ JSDoc
  consistency. The JSDoc on `URL_SHAPE_RE` (file-injector.ts L27-42) was already updated by
  P1.M1.T1.S1; the README must agree with it, not contradict or under-state it.
- **Final sweep before ship.** This is Mode B (§5 of the contract): the LAST task that sweeps the
  overview docs for the whole changeset. It is the gate that closes the documentation loop.

## What

**User-visible behavior change: NONE.** This is a documentation edit. The extension behaves exactly as
shipped by BUG-001; the README now *says so*.

**Document change**: rewrite ONE bullet (`README.md` L202). The bullet keeps its heading
("**URLs need a dotted, alphabetic hostname.**") and its IP/`localhost` side-effect paragraph
(unchanged), and gains a middle paragraph documenting the deny-list + slash exception + workaround.

### Success Criteria

- [ ] L202 bullet documents the code-extension deny-list: scheme-less, path-less `#word.ext` whose final
      label is a common code/file extension (`#main.go`, `#notes.md`, `#config.json`, `#node.js`, …) is
      treated as a **file reference**, left verbatim (no fetch, no injection).
- [ ] L202 bullet documents the **slash exception**: a slash makes it a real domain + path, so
      `#example.com/img.png` still fetches.
- [ ] L202 bullet documents the **explicit-scheme workaround**: to fetch a domain whose TLD collides
      with a code extension, write `#https://foo.sh` rather than `#foo.sh`.
- [ ] The "`#3.14`, `#v1.2`, `#fff`" examples are RETAINED as still-true shape-gate rejections but are
      NO LONGER the closing/only safety statement (the deny-list is the headline).
- [ ] Wording is consistent with the actual JSDoc (file-injector.ts L27-42); no internal cross-refs leak
      into user-facing prose.
- [ ] L50-55 (URL examples) and L184 (enableUrls) are byte-for-byte unchanged.
- [ ] No new heading/section ("no structural changes"); `git diff --stat` shows only `README.md`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ — **Yes.** This PRP
quotes the EXACT current L202 bullet (verbatim), the EXACT replacement text (ready to paste), the EXACT
no-touch lines (L50-55, L184), the EXACT JSDoc it must be consistent with (verified from the actual
file-injector.ts L27-42), and the precise validation greps. No inference required.

### Documentation & References

```yaml
# MUST READ — the authoritative design + the actual shipped JSDoc (the consistency target).
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/fix_strategy.md
  why: "The 'BUG-001 → Chosen Approach: Code-Extension Deny-List Gate' section defines the behavior the
        README must describe: scheme-less-only, explicit-scheme bypasses, the ccTLD overlap trade-off
        (.sh/.py), and the force-fetch workaround. Also 'Files Modified' row 'README.md L202' confirms
        THIS task's locus."
  critical: "the README must state the workaround (explicit-scheme form) — fix_strategy.md mandates it."

- file: file-injector.ts
  lines: "L27-42 (the JSDoc on URL_SHAPE_RE — the ACTUAL landed text, the consistency target for LOGIC #3c);
          L44-55 (the CODE_EXTENSIONS JSDoc); L56-~120 (the CODE_EXTENSIONS Set contents)."
  why: "Item LOGIC #3c: README wording MUST be consistent with this JSDoc. The JSDoc is developer-facing
        (mentions DET-1/P1.M1.T2.S3/CODE_EXTENSIONS) — translate its PHRASING to user-facing prose, do NOT
        copy internal refs into the README."
  pattern: 'JSDoc key phrasings to mirror: "scheme-less, PATH-LESS (bare word.ext)"; "treated as a LOCAL
            FILE reference, NOT a URL"; "skips it before fetch"; "A slash-bearing scheme-less token (e.g.
            #example.com/img.png) is a real domain + path and is NOT gated"; "Explicit-scheme tokens
            bypass the deny-list entirely — use that form to force-fetch a domain whose TLD collides with
            a code extension (e.g. #https://node.js, #https://foo.sh)".'
  gotcha: 'CRITICAL: the JSDoc says PATH-LESS. The item_description''s simplified "scheme-less tokens
           ending in a code/file extension" OMITS the path-less qualifier. The README MUST include the
           slash exception (#example.com/img.png still fetches) to be consistent with the JSDoc and
           accurate to the shipped code (a slash makes the token a real domain+path → not gated).'

- file: README.md
  lines: "L202 (THE bullet to edit); L50-55 (URL examples — NO TOUCH); L184 (enableUrls — NO TOUCH)."
  why: "L202 is the only edit site; L50-55 + L184 are verified no-touch zones (see §4 of research notes)."
  pattern: "L202 is the LAST bullet of the '## Limits' section (L187-203); the next line (L205) begins
            '## `#@` versus `@`'. The IP/localhost sentence at the end of L202 is accurate and stays."
  gotcha: "Do NOT add a note to L184 (enableUrls) — the deny-list is ALWAYS active when enableUrls is on,
           NOT a separate config field; implying a knob would be misleading. Do NOT touch L50-55 — the
           examples (#example.com, #https://example.com/api, #https://news.ycombinator.com) use real
           TLDs unaffected by the deny-list."

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M1T1S1/PRP.md
  why: "Confirms BUG-001 is Complete (the gate + JSDoc are shipped) and that README was explicitly DEFERRED
        to THIS task ('README.md NOT touched (P1.M3.T1.S1)')."
  take: "the gate and JSDoc already exist — this PRP only documents them in the README."

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/P1M2T1S1/PRP.md
  why: "Confirms BUG-002 (trigger-aware toast) is NOT a documented API surface ('no README/JSDoc change').
        The README documents the read <path> green lines, NEVER the toast wording."
  take: "BUG-002 requires ZERO README change. Do NOT document the toast (scope creep + contradicts sibling)."
```

### Current Codebase tree (this task's slice — verified)

```bash
README.md                   # ⬅ EDIT: the single L202 "URLs need a dotted, alphabetic hostname" bullet
file-injector.ts            # READ-ONLY (L27-42 JSDoc = consistency target; gate shipped by BUG-001)
*.test.mjs                  # NOT touched (Mode B = docs only)
package.json / tsconfig.json / scripts/*   # NOT touched
plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/{fix_strategy,source_analysis}.md  # READ-ONLY refs
```

### Desired Codebase tree (the only change)

```bash
README.md   # MODIFIED: L202 bullet expanded to document the code-extension deny-list + slash exception
            #           + explicit-scheme workaround. ONE bullet, no structural changes, no new headings.
# (no new files; no other file touched)
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL (path-less nuance): the deny-list gates ONLY scheme-less, PATH-LESS (bare `word.ext`)
     tokens. A slash makes it a real domain + path (#example.com/img.png) → NOT gated → still fetches.
     The README MUST state the slash exception, or it will over-claim and contradict the JSDoc
     (file-injector.ts L33: "scheme-less, PATH-LESS (bare word.ext)"). The item_description simplified
     this to "scheme-less tokens ending in a code/file extension" — follow the JSDoc, not the simplification. -->

<!-- CRITICAL (the workaround MUST appear): to fetch a domain whose TLD collides with a code extension
     (.sh=Saint Helena, .py=Paraguay), the user writes the explicit-scheme form: #https://foo.sh rather
     than #foo.sh. This is the user's escape hatch and fix_strategy.md mandates documenting it. -->

<!-- CRITICAL (no internal refs in user prose): the JSDoc mentions DET-1, DET-2, P1.M1.T2.S3, CODE_EXTENSIONS,
     PRD §2.3. NONE of these belong in the README — it is user-facing. Translate phrasing, not references. -->

<!-- CRITICAL (BUG-002 needs no change): the status toast (BUG-002) is UNDOCUMENTED in the README —
     verified by grep (the README never mentions "#@ injected N whole" or any toast wording; "injected"
     appears only as "file injected into the model's context"). Do NOT add a BUG-002 doc change. -->

<!-- GOTCHA (no separate config): the deny-list is NOT a config field and is always active when enableUrls
     is on. Do NOT add a note to L184 implying a knob, and do NOT add enableUrls→deny-list linkage prose. -->

<!-- GOTCHA (Markdown source layout): L202 is a single source line. The bullet may be long, but keep it as
     ONE bullet (the contract says "confined to the bullet"). Splitting into a second bullet under the same
     bold heading is acceptable IF it reads better, but add no new ##/### heading ("no structural changes"). -->

<!-- GOTCHA (no automated README test): the repo has no markdown linter configured and no README test.
     Validation is human diff review + a JSDoc-consistency cross-check + git diff --stat (see Validation). -->
```

---

## Implementation Blueprint

### (No data models / no code / no API change)

This is a pure-markdown documentation edit. No TypeScript, no types, no exports, no tests, no config.

### The exact edit (single bullet, L202 — ready to paste)

**OLD TEXT** (verbatim from `README.md` L202 — the entire bullet):

```markdown
- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://`/`ftp://` URL **or** a bare host whose final label is 2+ letters (e.g. `example.com`, `api.example.co.uk`). This deliberately rejects `#3.14`, `#v1.2`, `#fff` and other token-like text. As a side effect, **raw IP addresses and `localhost` are not detected as URLs** — `#127.0.0.1:8080`, `#localhost:3000/api`, and even `#http://127.0.0.1` are left verbatim with no fetch and no error. To inject a local dev server, give it a resolvable hostname (an `/etc/hosts` alias, a `*.local` name, or a real domain) rather than an IP or `localhost`.
```

**NEW TEXT** (the rewrite — keeps the heading + opening + IP/localhost paragraph; inserts a deny-list
middle paragraph; reframes the `#3.14/#v1.2/#fff` line so it is no longer the closing safety statement):

```markdown
- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://`/`ftp://` URL **or** a bare host whose final label is 2+ letters (e.g. `example.com`, `api.example.co.uk`). This rejects `#3.14`, `#v1.2`, `#fff` and other token-like text. In a coding agent a bare `#word.ext` is almost always a file reference rather than a website, so a scheme-less token with no path whose final label is a common code/file extension — `#main.go`, `#notes.md`, `#config.json`, `#node.js`, … — is treated as a file reference and left as written (no fetch, nothing injected). A slash makes it a real domain plus a path, so `#example.com/img.png` is still fetched; and an explicit scheme bypasses the check entirely, so to fetch a domain whose TLD collides with a code extension, write `#https://foo.sh` rather than `#foo.sh`. As a side effect, **raw IP addresses and `localhost` are not detected as URLs** — `#127.0.0.1:8080`, `#localhost:3000/api`, and even `#http://127.0.0.1` are left verbatim with no fetch and no error. To inject a local dev server, give it a resolvable hostname (an `/etc/hosts` alias, a `*.local` name, or a real domain) rather than an IP or `localhost`.
```

**What changed, line by line:**
1. `"This deliberately rejects `#3.14`, `#v1.2`, `#fff` and other token-like text."` →
   `"This rejects `#3.14`, `#v1.2`, `#fff` and other token-like text."` (dropped "deliberately";
   these examples stay because they are STILL true rejections by the shape gate — but they are no
   longer the closing safety statement).
2. **INSERTED** a new middle sentence documenting the deny-list: "In a coding agent a bare `#word.ext`
   is almost always a file reference rather than a website, so a scheme-less token with no path whose
   final label is a common code/file extension — `#main.go`, `#notes.md`, `#config.json`, `#node.js`,
   … — is treated as a file reference and left as written (no fetch, nothing injected)."
3. **INSERTED** the slash exception + explicit-scheme workaround: "A slash makes it a real domain
   plus a path, so `#example.com/img.png` is still fetched; and an explicit scheme bypasses the check
   entirely, so to fetch a domain whose TLD collides with a code extension, write `#https://foo.sh`
   rather than `#foo.sh`."
4. The IP/`localhost` side-effect sentence (the rest of the bullet) is **byte-for-byte unchanged**.

> **Consistency proof vs the actual JSDoc (file-injector.ts L27-42):** every load-bearing claim in the
> new text maps to a JSDoc claim — "file reference, not a URL" ↔ "LOCAL FILE reference, NOT a URL";
> "scheme-less token with no path" ↔ "scheme-less, PATH-LESS (bare word.ext)"; "left as written (no
> fetch)" ↔ "skips it before fetch"; "a slash makes it a real domain" ↔ "A slash-bearing scheme-less
> token (e.g. #example.com/img.png) is a real domain + path and is NOT gated"; "an explicit scheme
> bypasses the check … `#https://foo.sh` rather than `#foo.sh`" ↔ "Explicit-scheme tokens bypass the
> deny-list entirely — use that form to force-fetch … (e.g. #https://foo.sh)". No contradictions.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: READ the current state (confirm no upstream drift)
  - VIEW README.md L187-203 (the '## Limits' section) — confirm L202 still matches OLD TEXT above.
  - VIEW file-injector.ts L27-42 (the URL_SHAPE_RE JSDoc) — confirm it matches the consistency target
    in §Documentation & References (the deny-list + path-less + slash exception phrasings).
  - VIEW README.md L50-55 and L184 — confirm the no-touch zones are as described.
  - IF any of these drifted (e.g. another task edited README between this PRP and implementation):
    adapt the OLD TEXT / no-touch lines to the CURRENT file before editing. The edit is anchored by
    TEXT (the OLD TEXT block), so the edit tool matches it even if line numbers shifted.

Task 2: APPLY the single-bullet edit (README.md L202)
  - USE the edit tool with OLD TEXT → NEW TEXT exactly as given above (one edit, the whole bullet).
  - ANCHOR by the full OLD TEXT block (not a line number) so the edit is robust to line drift.
  - PRESERVE: the bullet's bold heading "**URLs need a dotted, alphabetic hostname.**", the opening
    shape-gate sentence, and the entire IP/localhost trailing sentence (byte-for-byte).
  - DO NOT touch any other README line, heading, or section.

Task 3: SELF-VERIFY (the validation gates below)
  - RUN the Level 1-4 checks (git diff --stat, grep no-touch zones, consistency cross-check, manual read).
  - CONFIRM only README.md changed and the bullet reads accurately with no internal refs.
```

### Integration Points

```yaml
README.md:   "EDIT L202 bullet only (deny-list + slash exception + workaround)."
file-injector.ts: "READ-ONLY — L27-42 JSDoc is the consistency target, NOT an edit site."
L50-55 (README): "NO TOUCH (URL examples use real TLDs, unaffected)."
L184 (README): "NO TOUCH (enableUrls; the deny-list is always-on, not a config)."
BUG-002: "NO README CHANGE — the toast is undocumented (verified)."
NO CHANGE TO: "any .ts file, any .mjs test, package.json, tsconfig.json, scripts/, plan/ docs."
```

---

## Validation Loop

> There is no automated README test in this repo. Validation is diff review + a JSDoc-consistency
> cross-check + `git diff --stat`. (The repo has no markdown linter; do NOT block on introducing one.)

### Level 1: Diff scope (only the intended change)

```bash
# Confirm ONLY README.md changed, and the diff is confined to the L202 bullet region.
git diff --stat
# EXPECT: exactly one file — README.md. (No file-injector.ts, no *.mjs, no package.json, etc.)

git diff README.md
# EXPECT: a single hunk around L202. The +lines describe the deny-list, slash exception, workaround.
#         The -line is the old "This deliberately rejects #3.14, #v1.2, #fff …" phrasing.
#         The IP/localhost trailing sentence is UNCHANGED (no +/- there).
```

### Level 2: No-touch zones (byte-for-byte unchanged)

```bash
# L50-55 URL examples — must be byte-identical (none mention the deny-list or code extensions).
sed -n '50,55p' README.md
# EXPECT: the #example.com / #https://example.com/api / #https://news.ycombinator.com examples,
#         unchanged. None should now claim a code-extension carve-out.

# L184 enableUrls — must be byte-identical (no deny-list knob added).
sed -n '184p' README.md
# EXPECT: "`enableUrls` is read from the **same four sources and precedence** … The default is `true`,
#         so `#example.com` works with no configuration at all." — unchanged.

# Negative check: confirm no new heading/section was introduced ("no structural changes").
git diff README.md | grep -E '^\+#+ ' && echo "FAIL: new heading introduced" || echo "OK: no new heading"
```

### Level 3: JSDoc consistency (item LOGIC #3c)

```bash
# The README bullet and the URL_SHAPE_RE JSDoc (file-injector.ts L27-42) must use AGREEMENT terminology.
# Read both, then confirm these load-bearing claims appear (or are faithfully paraphrased) in the README:
#   - "file reference, not a URL"        (JSDoc: "LOCAL FILE reference, NOT a URL")
#   - "scheme-less" + "no path"          (JSDoc: "scheme-less, PATH-LESS")
#   - slash exception / #example.com/img.png still fetches
#   - explicit scheme bypasses / #https://foo.sh workaround
sed -n '202p' README.md      # the edited bullet
sed -n '27,42p' file-injector.ts   # the JSDoc consistency target
# MANUAL: confirm the README paraphrases the JSDoc without contradiction and WITHOUT copying internal
#         refs (DET-1, DET-2, P1.M1.T2.S3, CODE_EXTENSIONS, PRD §2.3) into the user-facing prose.
```

### Level 4: Manual read + sanity (the primary gate)

```bash
# Read the full edited bullet in context (Limits section tail + the next section heading) to confirm
# it flows well and reads as honest user documentation.
sed -n '187,205p' README.md
# EXPECT: the Limits bullets, ending with the rewritten L202 bullet, followed cleanly by
#         "## `#@` versus `@`". No dangling sentence, no broken markdown, no double bullet.

# Sanity: the OLD misleading framing is gone as a closing statement.
grep -c "deliberately rejects" README.md
# EXPECT: 0 (the word "deliberately" was dropped; the #3.14/#v1.2/#fff examples are kept WITHOUT
#         "deliberately" and are no longer the closing safety statement).

# Sanity: the new deny-list content is present.
grep -c "file reference\|left as written" README.md
# EXPECT: >=1 (the deny-list middle sentence landed).
grep -c "#https://foo.sh\|foo.sh" README.md
# EXPECT: >=1 (the explicit-scheme workaround is documented).

# OPTIONAL — if you want a markdown linter (NOT required; the repo has none):
#   npx --yes markdownlint-cli2 README.md || true   # informational only; do not block on style nits
```

### Regression (prove no accidental source drift)

```bash
# A pure-markdown edit cannot break the build, but run these to PROVE nothing else moved.
npm run typecheck   # EXPECT: 0 errors (README is not type-checked; proves file-injector.ts untouched).
npm test            # EXPECT: exit 0, all 4 harnesses green (proves no test/source drift).
```

---

## Final Validation Checklist

### Technical Validation
- [ ] `git diff --stat` shows ONLY `README.md` changed (Level 1).
- [ ] L50-55 and L184 are byte-for-byte unchanged (Level 2).
- [ ] No new heading/section introduced (Level 2 negative check).
- [ ] README bullet is consistent with the actual JSDoc (file-injector.ts L27-42); no internal refs
      leaked into user prose (Level 3).
- [ ] `npm run typecheck` exits 0; `npm test` exits 0 (no source/test drift — Level 4 regression).

### Feature Validation (the documentation content)
- [ ] L202 bullet documents scheme-less, path-less `#word.<code-ext>` → file reference → no fetch.
- [ ] L202 bullet documents the slash exception (`#example.com/img.png` still fetches).
- [ ] L202 bullet documents the explicit-scheme workaround (`#https://foo.sh` vs `#foo.sh`).
- [ ] The `#3.14`/`#v1.2`/`#fff` examples are retained as still-true shape-gate rejections but are no
      longer the closing/only safety statement (the deny-list is the headline).
- [ ] BUG-002 (the toast) required NO README change (verified undocumented) — none was added.

### Code Quality Validation
- [ ] Follows the existing README voice and markdown style (bold bullet headings, em-dashes, inline code).
- [ ] Bullet stays as ONE bullet (or, only if it reads clearly better, two bullets under the SAME bold
      heading) — no structural change.
- [ ] IP/`localhost` trailing sentence preserved byte-for-byte.

### Documentation & Deployment
- [ ] README is self-consistent (no contradiction between the Limits bullet and the feature examples).
- [ ] No new environment variables / config knobs implied (the deny-list is not configurable).

---

## Anti-Patterns to Avoid

- ❌ Don't touch L50-55 or L184 — verified no-touch zones (contract LOGIC #3b).
- ❌ Don't document the BUG-002 toast wording — it is an undocumented surface; adding it is scope creep.
- ❌ Don't copy internal JSDoc refs (DET-1, P1.M1.T2.S3, CODE_EXTENSIONS, PRD §2.3) into user prose.
- ❌ Don't drop the `#3.14`/`#v1.2`/`#fff` examples — they are still TRUE shape-gate rejections; just
  reframe them so the deny-list is the headline and they are not the closing reassurance.
- ❌ Don't omit the **path-less** nuance / slash exception — the JSDoc is explicit ("PATH-LESS"),
  and without it the README over-claims (implies `#example.com/img.png` is blocked, which is false).
- ❌ Don't omit the explicit-scheme workaround (`#https://foo.sh`) — it is the user's escape hatch and
  fix_strategy.md mandates documenting it.
- ❌ Don't edit `file-injector.ts`, any test, `package.json`, `tsconfig.json`, `scripts/*`, or any
  `plan/` doc — this is Mode B (docs only) and the only writable artifact is README.md.
- ❌ Don't add new README headings/sections — "no structural changes".
- ❌ Don't anchor the edit by line number — anchor by the full OLD TEXT block (robust to drift).
- ❌ Don't introduce a markdown linter as a gate — the repo has none; do not block on style tooling.

---

## Confidence Score

**9/10** for one-pass success. The change is a single markdown bullet with the exact OLD/NEW text
provided verbatim, the no-touch zones verified, and the consistency target (the actual JSDoc) quoted
and mapped claim-by-claim. Residual risks: (1) line drift between PRP and implementation — mitigated
by TEXT-anchored edit + Task 1's read-current-state step; (2) an implementer who over-edits (touches
L50-55/L184, documents the toast, copies internal refs) — mitigated by the explicit anti-patterns and
Level 2/3 greps; (3) an implementer who drops the path-less/slash nuance to match the contract's
simplified wording — mitigated by the consistency-proof mapping and the JSDoc-accuracy gotcha. All
three are gated by the validation loop.

---

## Mode-B / Parallel-Safety Note (for the orchestrator / merger)

- **This is the FINAL task in the changeset (Mode B sweep).** It runs after BUG-001 (P1.M1.T1.S1 +
  P1.M1.T2.S1) and BUG-002 (P1.M2.T1.S1 + P1.M2.T2.S1). All four prior subtasks are the CONTRACT this
  PRP assumes shipped (the `CODE_EXTENSIONS` deny-list gate + its JSDoc at file-injector.ts L27-42, and
  the trigger-aware toast). If any prior subtask is NOT yet complete, the README would describe
  unshipped behavior — confirm the dependency state before/as you implement.
- **File overlap with siblings: NONE.** Every prior subtask edits `file-injector.ts` and/or `*.mjs`;
  THIS task edits ONLY `README.md`. No merge conflict possible with any sibling.
- **What "syncs both BUG-001 and BUG-002" means here:** BUG-001's deny-list IS documented (the L202
  rewrite). BUG-002's toast requires NO README change (undocumented surface) — the "sync" for BUG-002
  is the explicit non-change, recorded so the next reader knows it was considered, not forgotten.