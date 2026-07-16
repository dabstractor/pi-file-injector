# Bug Fix Requirements

## Overview

Creative end-to-end QA of the `#@file` Whole-File Injection extension (`file-injector.ts`, the
current 1088-line repo version) against the PRD. Testing combined: the existing model-free harness
(`file-injector.test.mjs`), ~50 purpose-built adversarial probes against the real module (loaded
through Pi's own jiti + alias mechanism, identical to the harness), live inspection of Pi's
`processFileArguments` source for format parity, simulation of multi-copy handler chaining, and
direct exercise of the registered `input` / `session_start` handlers.

**Overall quality: high.** All previously-reported bugs (sentinel double-injection, sentinel
false-negative, within-prompt dedup gap, mixed-prompt failed-token stripping, `offset:0` paged
directive, "N file" notify wording) are **fixed** in the current version. The single-copy logic is
excellent across an unusually wide adversarial surface: token parsing, Unicode word boundaries,
format parity, image/binary/empty routing, all three handler guards, paging + surrogate-safe head
slicing, code-region detection (fences/inline/tilde/unterminated/info-strings), markdown recursion
(cycles, diamonds, self-imports, relative-`..`, extension shorthand, exact-wins, bare-`@` opt-in at
2 levels of recursion), multi-copy dedup via prior-`<file>`-block seeding, and the shared context
budget all behave per spec.

**However, one real Major bug remains** in the markdown-import error path, plus one Minor
test-harness robustness issue. The Major bug is a silent violation of an explicit, documented
"leave verbatim on error" guarantee, but its trigger is narrow (an imported file that exists yet is
unreadable), so core functionality is not blocked.

---

## Critical Issues (Must Fix)

None. No bug prevents the primary use case (single-file `#@` injection, including markdown
transitive imports) from working, and the handler never throws or loses a prompt.

---

## Major Issues (Should Fix)

### Issue 1: A markdown import whose file exists but is unreadable has its `#@`/`@` marker STRIPPED (silently lost) instead of left verbatim

**Severity**: Major

**PRD Reference**: PRD §5.4 ("Leave the original `#@path` token **verbatim** in the text. No block is
appended for it."), §12.5 ("Wrap all `stat`/`readFile`/`resizeImage` in try/catch; on any error
leave the token verbatim and continue. A prompt must never be lost."), §10 ("`#@nonexistent.txt` →
Token left verbatim; no block; no error"), and the §5.6 step-4 contract ("Missing/dir imports keep
the marker verbatim"). Also directly contradicts the README's "What gets injected" table:
**"Missing file, directory, or permission error → Left as written. Nothing is appended."**

**Expected Behavior**: When a delivered markdown file contains an import directive (`#@api.md` or,
with `markdownBareAtImports` on, `@api.md`) whose target exists (stat succeeds) but cannot be read
(permission denied / I/O error / `resizeImage` throws for an image import), the directive must be
left **byte-for-byte verbatim (`#@api.md` intact)** in the injected markdown block, with **no**
block/image appended for it — exactly like a missing-file import. This matches the top-level path,
which already does this correctly.

**Actual Behavior**: The marker is **stripped to a bare path** (`api.md`) inside the parent
markdown's emitted block, but **no `<file>` block and no image is appended** for it. The model
receives a bare path reference with no content and no `#@` marker, so it has no signal that an
injection was attempted and failed. Additionally, the unreadable file is **claimed in `injectedSet`
before the failed read**, so any later reference to the same path is suppressed (never retried,
never delivered) for the rest of the prompt.

Verified live against the real module:

```
$ # api.md exists but is unreadable (stat OK, readFile EACCES); notes.md imports it
$ chmod 000 api.md
$ injectFiles("Read #@notes.md")   # notes.md = "Notes intro.\n#@api.md\nNotes end.\n"
injected: 1
text:
  Read notes.md

  ---

  <file name="…/notes.md">
  Notes intro.
  api.md          ← '#@' was STRIPPED (should be '#@api.md')
  Notes end.

  </file>

VERIFY:
  '#@api.md' marker present (verbatim, per PRD §5.4/§12.5 + README)?  FALSE   ← BUG
  bare 'api.md' path present (marker stripped)?                       TRUE
  api.md <file> block present (delivered)?                            FALSE
```

**Root cause**: In `injectMarkdown`, Step 3.5 filters imports to `injectable` using only
`fs.stat(r.abs)` + `st.isFile()` — it confirms the path is a regular file but does **not** confirm
it is readable. Step 4 then strips the marker from every `injectable` record *before* Step 5 emits
this file's block and *before* Step 6 calls `injectFile`, which is the first place the bytes are
actually read. `injectFile` claims the abs (`state.injectedSet.add(abs)`) right after its own
stat+isFile, then attempts `fs.readFile`; if that throws it returns `false` — but by then Step 4 has
already removed the marker from the parent's block content, and the claim is sticky. The pre-order
emission order (PRD §5.6 step 5 emits the parent block *before* step 6 recurses) is what forces the
strip decision to be made before delivery is actually attempted.

The **top-level** path is unaffected: `processTokenStream` scans once, then only adds a marker's
index to `resolvedIdx` if `injectFile` returns `true`, so a top-level unreadable `#@api.md` is left
verbatim (and, because nothing injects, the whole prompt is returned byte-for-byte). The asymmetry
is specific to the markdown-import path.

**Steps to Reproduce** (model-free, against the real committed module):

```bash
mkdir -p /tmp/repro && cd /tmp/repro
printf 'API secret\n' > api.md
printf 'Notes intro.\n#@api.md\nNotes end.\n' > notes.md
chmod 000 api.md        # stat succeeds; readFile throws EACCES (run as a non-root user)
node -e '
  import("file:///path/to/probe").then(async ({default:run}) => run());
  // or: load file-injector.ts via jiti (as the test harness does) and call
  //     await mod.injectFiles("Read #@notes.md", [], { cwd: "/tmp/repro", getContextUsage: () => undefined });
  //     then assert r.text.includes("#@api.md") === true   (currently false)
'
chmod 644 api.md        # cleanup
```

A concrete self-contained repro (jiti load identical to `file-injector.test.mjs`) is in the testing
notes below. The same root cause also fires for an **image import** whose `resizeImage` *throws*
(rather than returning `null`): the `#@pic.png` marker is stripped, no image is attached.

**Impact**: Silent, total loss of an import on a plausible restricted-file / permission workflow
(e.g. `#@spec.md` where `spec.md` references a `#@secrets.md` or a file under a restricted
directory). The user sees the marker disappear and assumes the import succeeded, but the model gets
neither the content nor any indication of failure — the opposite of the PRD's "a prompt must never
be lost" and the README's explicit "permission error → Left as written" promise. Narrow trigger
keeps it off the happy path, hence Major rather than Critical.

**Suggested Fix**: Make the Step-3.5 injectability check match `injectFile`'s actual delivery
contract — confirm the file is **readable**, not just that it is a regular file — so a marker is
stripped only when delivery will truly succeed. The cleanest pre-order-preserving option is to
attempt the read (or an `fs.access(p, fs.constants.R_OK)`) in Step 3.5 and drop the record from
`injectable` on failure, e.g.:

```ts
// Step 3.5 — confirm READABLE (not just existing) so a later readFile failure
// cannot strip a marker that never delivers (PRD §5.4 / §12.5 verbatim guarantee).
const injectable: { index: number; prefixLen: number; abs: string }[] = [];
for (const r of records) {
  try {
    const st = await fs.stat(r.abs);
    if (!st.isFile()) continue;
    await fs.access(r.abs, fs.constants.R_OK);   // ← gate strip on readability
    injectable.push(r);
  } catch { /* missing / unreadable → leave verbatim (not stripped, not injected) */ }
}
```

(For full robustness against the `resizeImage`-throw image variant, the access check is not quite
enough — but the read itself happens in `injectFile` and its try/catch already returns `false`; the
key invariant the fix restores is "strip ⟺ deliverable", which `R_OK` + `isFile` covers for the
text/markdown/binary case that dominates. Alternatively, restructure so the strip is applied to the
emitted block *after* recursion completes, stripping only markers whose `injectFile` returned
`true` — but that requires editing an already-pushed block string and is more invasive.)
Also consider NOT claiming the abs in `injectedSet` when `injectFile` ultimately fails, so a later
duplicate can still be retried (currently a failed read poisons the path for the whole prompt).

---

## Minor Issues (Nice to Fix)

### Issue 2: `readConfig` unit test `T2.S1-f` is environment-dependent and fails when a global config sets the key (test-harness isolation gap)

**Severity**: Minor (test quality, not a product bug)

**PRD Reference**: PRD §4.6 (config sources / trust gate) and the test harness `file-injector.test.mjs`
case `T2.S1-f`.

**Expected Behavior**: The test suite passes deterministically regardless of the developer's real
global `~/.pi/agent/settings.json` / `file-injector.json`.

**Actual Behavior**: `T2.S1-f` ("readConfig settings.json key + UNTRUSTED → ignored … trusted →
project value") writes a project `.pi/settings.json` with `fileInjector.markdownBareAtImports =
<flip>` and asserts `trusted.markdownBareAtImports === flip`. Unlike its sibling `T2.S1-e` (which
empties the dedicated file first), `T2.S1-f` does **not** isolate the project dedicated file
`<TMPDIR>/.pi/file-injector.json`, which still holds the build-fixtures value
`{markdownBareAtImports:true}`. readConfig's documented within-scope precedence (dedicated file
**overrides** the settings.json key) then makes `trusted` resolve to `true` regardless of `flip`.
The case therefore fails whenever the captured `GLOBAL_BASELINE` is `true` (i.e. whenever the
developer has dogfooded the option globally) and passes only in a clean environment. Observed live:
`node ./file-injector.test.mjs` reports `✗ case T2.S1-f` with "trusted → settings.json key value
(false), got true" in this environment (global `settings.json` has `"fileInjector":{"markdownBareAtImports":true}`).

**Root cause**: Test isolation — `T2.S1-f` mutates only `PROJ_SETTINGS_PATH` and forgets to empty
`PROJ_FILE_PATH` for the duration of the case (the pattern `T2.S1-e` uses). The implementation
behavior (dedicated file overrides settings.json key within a scope) is intentional and correct.

**Steps to Reproduce**:

```bash
# In an environment where ~/.pi/agent/settings.json contains "fileInjector":{"markdownBareAtImports":true}
node ./file-injector.test.mjs   # → "✗ case T2.S1-f" (Result: … 4 failed on first run; flaky on reorder)
```

**Suggested Fix**: In `T2.S1-f`, empty the project dedicated file for the duration of the case (as
`T2.S1-e` does) and restore it in the `finally`, so the ONLY project source under test is the
settings.json key:

```js
const fileValid = fsSync.existsSync(PROJ_FILE_PATH) ? fsSync.readFileSync(PROJ_FILE_PATH, "utf8") : null;
fsSync.writeFileSync(PROJ_FILE_PATH, "{}");          // ← isolate the dedicated file
writeSettings({ "fileInjector": { markdownBareAtImports: flip } });
try { /* …existing asserts… */ }
finally {
  if (fileValid !== null) fsSync.writeFileSync(PROJ_FILE_PATH, fileValid);
  fsSync.rmSync(PROJ_SETTINGS_PATH, { force: true });
}
```

---

## Testing Summary

- **Total tests performed**: ~70 (120 from the existing harness, of which 1 (`T2.S1-f`) is an
  environment-dependent test bug — Issue 2; plus ~50 new adversarial probes against the real
  `injectFiles` / handler covering: text/image/binary/empty routing, format parity vs Pi's
  `processFileArguments`, mid-word / Unicode-word-boundary / trailing-punct / paren matching,
  missing / directory / read-error / resize-error handling, mixed success+fail stripping, same-file
  dedup (identical + alternate spellings), self-imports, cycles (a→b→a), diamonds, relative-`..`
  imports, extension shorthand (exact-wins, `.markdown` fallback, no-fallback), fenced/inline/tilde/
  unterminated/info-string code-exempt detection, bare-`@` opt-in at 2 recursion levels + in fenced
  code + mid-prose, paged delivery (tight budget, shared budget across files, surrogate-at-boundary
  head slicing, line-count-derived directive offset), multi-copy (2× and 3×) handler-chaining
  dedup, all three input guards (`extension`/`steer`/`no-#@`) + `followUp` processing, headless
  notify, image-merge contract, and module-level `cfg` session_start loading).
- **Passing**: ~69 of the ~70 new probes; 119/120 harness cases (the 1 failure is Issue 2, a test
  bug, not a product bug). All previously-reported bugs verified fixed.
- **Failing**: 1 Major product bug (Issue 1: markdown-import marker stripped on read error); 1
  Minor test-isolation bug (Issue 2).
- **Areas with good coverage**: single-copy token parsing & matching, format parity, image/binary/
  empty routing, all handler guards, paging + surrogate handling + directive offsets, code-region
  detection, markdown recursion (cycles/diamonds/self/shorthand/bare-@), multi-copy dedup, shared
  budget across files.
- **Areas needing more attention**:
  - **Markdown-import error paths** — the existing harness never exercises a markdown import whose
    target exists but is *unreadable* (stat-OK / read-fail); this is exactly the gap that hid
    Issue 1. Recommend adding a harness case that `chmod 000`s an import target (skipped under root)
    and asserts the parent's emitted block still contains the literal `#@<path>`.
  - **`resizeImage`-throw image imports** — same root cause as Issue 1; not covered (resizeImage is
    stubbed in the harness). A unit test injecting a markdown that imports an image, with
    `resizeImage` mocked to throw, would catch the image variant.
  - **Environment-independent config tests** — `T2.S1-f` (Issue 2) assumes an empty global; the
    harness should isolate the dedicated file so it is robust to a dogfooded global config.
