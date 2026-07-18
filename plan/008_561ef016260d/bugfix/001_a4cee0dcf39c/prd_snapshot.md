# Bug Fix Requirements

## Overview

Creative end-to-end QA was performed against the `#@file` extension PRD. The implementation is
substantial and largely faithful: the core `#@<path>` injection, two-mechanism delivery (input →
before_agent_start custom message), chat renderer, markdown transitive imports, extension
shorthand, bare-`@` opt-in, code-region exemption, budget accounting, paged delivery, and Unicode
word-boundary handling all work correctly. The shipped test suite (`file-injector.test.mjs`, 145
cases) passes, as do the two auxiliary scripts (`relative-imports.test.mjs`, `import-behavior.test.mjs`).

However, targeted adversarial probing surfaced **one Major bug** (silent wrong-file injection) and
**three Minor issues** (two PRD deviations, one documented-but-arguable behavior). The Major bug is
a correctness/data-integrity defect: a `#@` reference to a *missing* file whose name has `.md` in
the middle silently resolves to the *base* `.md` file, delivering the wrong content to the model
with no signal. It stems from an `extCut` truncation heuristic in `resolveImportPath` that is not in
the PRD and directly contradicts PRD §4.5's "extended tokens are exact-only" rule.

Testing was performed by loading the real `file-injector.ts` through Pi's own jiti loader (the same
mechanism the test suite uses) and driving `injectFiles`, `resolveImportPath`, the `input` handler,
the `before_agent_start` handler, and `renderInjectedMessage` against hermetic fixtures.

## Critical Issues (Must Fix)

None. Core functionality (injection, delivery, rendering, imports, paging) works. No crashes, no
data loss, no infinite loops were found on the happy paths or the documented edge cases.

## Major Issues (Should Fix)

### Issue 1: `resolveImportPath` truncation heuristic silently injects the WRONG file
**Severity**: Major
**PRD Reference**: §4.5 rule 3 ("tokens already ending in `.md`/`.markdown` **or any other
extension** are exact-only, so `PRD.md` never becomes `PRD.md.md`") and §4.4 (top-level exact-only).
**Expected Behavior**: A `#@` token that already carries a file extension (e.g. `report.md.backup`,
`notes.md.txt`, `api.md.old`) must be treated as **exact-only**. If the exact path does not exist as
a regular file, the token must be **left verbatim** (no injection, `#@` kept). The model must never
receive a different file than the one the user named.
**Actual Behavior**: `resolveImportPath` adds a second "truncated" candidate — the token cut
immediately after its **last** `.md`/`.markdown` — and resolves that if the full token misses. So a
reference to a *missing* `report.md.backup` silently resolves to the *existing* `report.md`, the
`#@` trigger is stripped from the prompt (so the user's message reads `report.md.backup` as though
it were delivered), and the **wrong file's contents** are sent to the model with no warning.
**Steps to Reproduce** (verified against the committed `file-injector.ts`):

```js
// Setup: report.md exists; report.md.backup does NOT.
fs.writeFileSync(cwd + "/report.md", "# Current Report\nSecret draft content.\n");

// User prompt:
const r = await injectFiles("Compare #@report.md.backup with the latest", [], ctx, false);
// r.injected === 1                  (expected 0)
// r.text === "Compare report.md.backup with the latest"   ( #@ stripped — looks delivered)
// r.blocks[0] === '<file name=".../report.md"># Current Report\nSecret draft content.\n</file>'
//   → the model receives report.md, NOT report.md.backup

// Direct probe (top-level, tryMdExt=false):
await resolveImportPath("report.md.backup", cwd, false);   // → ".../report.md"  (should be null)
```

The same defect manifests through **markdown imports** (`index.md` containing `#@report.md.backup`
injects `report.md`) and at the **top level** (the user types the path directly). Confirmed
false-positive patterns (all resolve to the base `.md` despite the named file not existing):
`X.md.txt`, `X.md.bak`, `X.md.old`, `X.md/foo`.

**Why it matters**: This is a silent data-integrity defect. The model is told it has
`report.md.backup` (per the stripped prompt) but actually receives `report.md`. The user has no way
to notice — there is no error, no "file not found", and the collapsed chat line shows the wrong
path's `read` rendering. For files that differ meaningfully (a sanitized export vs. a secret draft;
a backup vs. the current version), this delivers incorrect/sensitive content.

**Root cause** (`file-injector.ts`, `resolveImportPath`):
```ts
const candidates: string[] = [token];
const extCut = token.match(/^.*\.(?:md|markdown)/);   // greedy → cut after the LAST .md/.markdown
if (extCut && extCut[0] !== token) candidates.push(extCut[0]);
for (const cand of candidates) { ... if (await isRegularFile(abs)) return abs; ... }
```
The `extCut` heuristic was added to strip trailing **markdown formatting** (`*@api.md.*`, `**@b.md**`)
glued to a filename by `\S+`. But because it truncates *everything* after the last `.md`/`.markdown`,
it also strips **real extensions** (`.bak`, `.txt`, `.old`) and even path separators (`X.md/foo`),
turning genuine distinct filenames into the base `.md`.

**Note on test coverage**: This behavior is *endorsed* by `import-behavior.test.mjs` test **4f**
(`'@weird.md.bak' (only weird.md) → weird.md`), which frames the truncation fallback as intended.
That test encodes the PRD-violating behavior and is the reason the bug persisted. Note also that
`import-behavior.test.mjs` is **not** wired into `npm test` (only `file-injector.test.mjs` is), so
the primary gate does not exercise it either way.

**Suggested Fix**: Reconcile the markdown-formatting goal with the PRD's exact-only rule. Options,
in rough order of preference:
1. **Remove the `extCut` heuristic entirely** and accept that markdown-formatted references
   (`*@api.md.*`) do not resolve (left verbatim) — this is the literal PRD §4.3/§4.5 behavior. The
   PRD's `cleanToken` deliberately trims only `.,;:!?\")]}>'` and *not* `*`/`_`; the formatting-glue
   case is a known, accepted limitation.
2. **Narrow the truncation to trailing markdown-formatting chars only** — after cleanToken, strip a
   *trailing run* of `*` and `_` (the actual glue characters) and retry the exact path, instead of
   truncating at `.md`. This preserves the GROUP-4a–4d formatting cases without creating `.bak`/`.txt`
   false positives. `X.md.bak` would then be left verbatim (correct), while `@b.md.*` would still
   resolve to `b.md`.
3. At minimum, **only apply truncation when the dropped suffix is non-alphanumeric/non-path** (so
   `.bak`, `.txt`, `.old`, `/foo` never trigger it).

Whichever fix is chosen, `import-behavior.test.mjs` test **4f** must be updated to assert the
PRD-compliant outcome (verbatim / null), and a regression case for `X.md.bak`-style false positives
should be added to the primary `file-injector.test.mjs` gate.

## Minor Issues (Nice to Fix)

### Issue 2: `FileDetail.body` duplicates file bytes, violating PRD §12.22
**Severity**: Minor
**PRD Reference**: §12.22 ("**Do not** duplicate file bytes into `details` — the renderer re-parses
them from `content` … keeping `details` cheap and the model input uncontaminated.") and §6.2
("`details` carry *only* metadata the renderer needs … the **bytes** live in `content` … never
duplicated into the model input").
**Expected Behavior**: `FileDetail` should carry only metadata (path, kind, line counts, range,
dimension hint). The renderer should re-derive file bodies from `message.content`. `details` should
be cheap.
**Actual Behavior**: `emitText` (and the image/binary branches) store the **full file body** in
`detail.body`:
```ts
state.details.push({ path: abs, kind: "text", ..., body: content });   // full content duplicated
```
Measured: for two ~4 KB files, `content` (→ model) is 4068 bytes and `details.body` (renderer-only)
is 4020 bytes — i.e. **~100% of every deliverable file's bytes are stored twice** in the custom
message. Because the custom message is **persisted** in the session (§6.2) and re-sent on reload,
this roughly **doubles session storage** for injected files.
**Root cause / justification**: The `body` field was added to fix **BUG-1** — the renderer's
fallback `FILE_BLOCK_RE` regex truncates a file whose own content contains a literal `</file>`. That
is a real bug, and storing the exact body is a legitimate fix. But it contradicts the PRD's explicit
"don't duplicate bytes" instruction.
**Steps to Reproduce**:
```js
fs.writeFileSync(cwd + "/data.ts", "const payload = '" + "x".repeat(4000) + "';\n");
const r = await injectFiles("#@data.ts", [], ctx, false);
// r.blocks.join("\n\n").includes(r.details[0].body) === true  (same bytes in content AND details.body)
```
**Suggested Fix**: Keep the BUG-1 correctness fix but avoid the duplication. Options: (a) store a
byte/char **offset+length** into `content` for each detail instead of the body string (the renderer
slices `content`); or (b) keep `body` but acknowledge the PRD deviation explicitly and document the
storage cost. Option (a) preserves both BUG-1 correctness and §12.22's "cheap details" goal.

### Issue 3: Paged-file expanded view omits the paging directive (PRD §6.3)
**Severity**: Minor
**PRD Reference**: §6.3 ("**Paged files show their head block plus the paged-directive text
verbatim** (the model-driven paging is unaffected; this is just the expanded view of what was
delivered).").
**Expected Behavior**: When the user expands (`ctrl+o`) a paged file's green `read` line, the
expanded view should show the **head block** *and* the **paged-directive text** (the
`<paged: N chars; head delivered M complete lines; read the rest …>` block).
**Actual Behavior**: The renderer's expanded branch reads only `detail.body` (the head). The
directive block — which lives in `message.content` as a second `<file>` block and carries the
resume instructions — is **never surfaced** in the expanded view. `detail` has no field carrying
the directive text (`hasOwnProperty(pd, "directive") === false`).
**Root cause** (`renderInjectedMessage`, expanded branch):
```ts
const body = typeof d.body === "string" ? d.body : bodies[i];   // head only — directive not stored/recovered
```
**Steps to Reproduce**: inject a >8 KB file under a tight budget (`getContextUsage` returning a small
window); expand the resulting `read huge.log:<n>-` line — only the head text appears, not the
"read the rest with the read tool at offset:…" directive.
**Suggested Fix**: Either store the directive text in the paged `FileDetail` (e.g. `directive?:
string`) and render it after the head when expanded, or have the expanded view re-parse the paired
directive block from `content`. Low impact (the directive still reaches the *model* via `content`;
this is purely a display gap), hence Minor.

### Issue 4: Image magic-number sniff rejects a *valid* image whose extension ≠ actual type (PRD §5.2)
**Severity**: Minor (documented as intentional in README, but deviates from the PRD's
extension-based classification)
**PRD Reference**: §5.2 ("Recognized image extensions (case-insensitive) … For an image file: 1.
read 2. resize 3. attach.") — classification is purely by extension; there is no magic-byte
validation step.
**Expected Behavior** (strict PRD): `#@photo.jpg` attaches the image (resized) regardless of the
underlying byte format, because the extension says `image/jpeg`.
**Actual Behavior**: The F3 `hasValidImageMagic` enhancement validates the bytes against the declared
type and, on mismatch, falls through to the text/binary path. A genuine PNG renamed `photo.jpg`
fails the JPEG magic check and is delivered as a **binary note** (not attached as an image).
**Steps to Reproduce**:
```js
fs.writeFileSync(cwd + "/icon.jpg", <valid 1×1 PNG bytes>);
const r = await injectFiles("#@icon.jpg", [], ctx, false);
// r.details[0].kind === "binary"   (PRD §5.2 would yield kind:"image")
```
**Note**: This is **documented and deliberate** — the README states "Images are matched by their
real bytes, not just the extension. A text file renamed `fake.png` is injected as text." The
tradeoff (a real image with a mismatched extension is lost) appears to be accepted. Flagged here
only because it is a behavioral deviation from PRD §5.2; no fix is required if the team confirms
the README's stricter contract is the intended one. If so, the PRD §5.2 wording should be updated to
mention the magic-byte validation.

## Testing Summary

- **Total tests performed**: ~45 ad-hoc adversarial probes (loaded the real extension via jiti;
  drove `injectFiles`, `resolveImportPath`, `injectFile`, `scanTokens`, the `input` /
  `before_agent_start` handlers, and `renderInjectedMessage` against hermetic temp fixtures),
  plus re-running the 3 shipped suites (145 + 22 + 17 cases, all green).
- **Passing**: ~42 of the adversarial probes; all 184 shipped-suite cases.
- **Failing / unexpected**: 3 (Issue 1 Major; Issues 2–3 Minor); 1 documented deviation (Issue 4).
- **Areas with good coverage** (verified correct):
  - Core `#@<path>` injection, strip-to-path, and `continue` on no-`#@`.
  - Two-mechanism delivery: `input` stashes `{blocks,details}`; `before_agent_start` publishes the
    single `fileInjector.injected` custom message; one-shot stash clear; `source:"extension"` /
    steering short-circuits; no-`#@` → `before_agent_start` returns `undefined` (no phantom).
  - File-type handling: text, image (resize + magic sniff), binary (NUL note), empty file, empty
    image (0-byte note), missing/directory (verbatim).
  - Markdown transitive imports: relative-only resolution, file-relative base at every depth,
    extension shorthand (`#@PRD` → `PRD.md`/`.markdown`), exact-wins, code-region exemption
    (fenced + inline, CRLF + LF), cycle termination via dedup, cross-subtree dedup.
  - Bare-`@` opt-in: markdown-only, never double-matches `#@`, honored at every depth (case 32),
    top-level unaffected, email/`@mention` excluded.
  - Budget: single shared accumulator, paged delivery with surrogate-safe head slice and
    line-count-correct resume offset, sub-head guard, image/binary cost subtraction.
  - Notify wording (`N whole[, M paged]`), `ctx.hasUI` guard, Unicode word boundaries (`café#@x`,
    `日本語#@x` do not match — a deliberate, README-documented improvement over the PRD's ASCII
    `\W`).
  - Renderer: green `toolSuccessBg` box, one `read <path>` line per file, hint once per box,
    defensive fallback for missing `details`, BUG-1 (nested `</file>`) fixed via stored body.
  - Path autocomplete provider (line-rewrite reuse; not exercised live, but structurally sound).
- **Areas needing attention**:
  - `resolveImportPath` truncation heuristic (Issue 1) — the only correctness defect; a wrong file
    can reach the model silently.
  - `FileDetail.body` duplication (Issue 2) — storage cost + PRD §12.22 deviation.
  - Paged expanded-view directive (Issue 3) — display gap vs. PRD §6.3.
  - The `import-behavior.test.mjs` suite is **not** part of `npm test`; consider wiring it in (after
    fixing test 4f) so the truncation behavior is gated going forward.
