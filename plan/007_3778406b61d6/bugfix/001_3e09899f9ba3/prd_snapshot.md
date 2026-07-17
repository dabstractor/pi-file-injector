# Bug Fix Requirements

## Overview

An independent creative end-to-end QA pass was performed against the `#@file` injection extension, validating the implementation against the full PRD scope (§1–§14): handler guards, path resolution, symlinks, unicode, boundary sizes, dedup, context-budget paging, markdown transitive imports (deep chains, diamonds, cycles, self-imports, binary/image imports), fenced/inline code exemption, output format precision, config sources/precedence/trust, permission handling, image handling, the autocomplete provider, bare-`@` imports, and ReDoS resistance.

**Testing performed:**
- ~120 additional assertions across 14 creative test groups (handler guards, path edge cases, symlinks, unicode, dedup, budget paging, deep/adversarial markdown, output format, config, robustness, images, autocomplete, bare-@, cleanToken).
- Direct unit probes of `computeCodeRanges`, `inCode`, `resolveImportPath`, `scanTokens`, `cleanToken`, `estimateImageTokens`, `hasValidImageMagic`, `readConfig`.
- Full `injectFiles` + real handler (`input` event) integration runs.
- Focused line-ending (LF vs CRLF) impact analysis on markdown code-fence detection.

**Overall quality assessment:** The implementation is exceptionally robust. All 182 existing tests pass, and ~118 of ~120 new creative assertions pass. The recursion/dedup model, budget accounting, paged-delivery line math, code-region detection, and config trust gating are all correct and well-defended. Exactly **one Major bug** was found: **CRLF (Windows) line endings in markdown files silently break fenced-code-block close detection**, which causes every `#@` import appearing after a fenced code block to be treated as code and dropped. No Critical bugs were found.

## Critical Issues (Must Fix)

None.

## Major Issues (Should Fix)

### Issue 1: CRLF line endings break fenced-code-block close detection, silently dropping markdown imports after a fence

**Severity**: Major

**PRD Reference**: §5.6.1 (Code-region detection / approximate CommonMark), §5.6 (Markdown transitive imports), §2 Goal 6 (Markdown transitive imports)

**Expected Behavior**: A markdown file using CRLF (`\r\n`) line endings should behave identically to one using LF (`\n`) line endings. In particular, a fenced code block (```` ``` ````…```` ``` ````) must *close* at its closing fence line, so that any `#@<path>` import directive appearing **after** the fence is recognized as an import and delivered. CommonMark (which §5.6.1 says this approximates) treats `\r\n` and `\r` as line endings.

**Actual Behavior**: When a markdown file has CRLF line endings, the closing fence line is **never recognized as a close**. The fence is treated as *unterminated* and its code range consumes everything from the opening fence to **EOF**. Consequently, every `#@` import after the first fenced code block is classified as "inside code" and is **silently skipped** (left verbatim, not resolved, not injected, no error, no warning).

Reproduction confirms a realistic spec file (`# API Spec` … ```` ```typescript ```` … ```` ``` ```` … `See #@api.md and #@auth.md`) with CRLF endings injects only **1 file** (the spec itself) instead of the expected **3** (spec + api + auth). Both `api.md` and `auth.md` are silently dropped.

**Root Cause**: In `computeCodeRanges` (`file-injector.ts`), content is split with `content.split("\n")`, which leaves a trailing `\r` on each line of a CRLF file. The fence-close regex is built as:
```ts
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");
```
The trailing `[ \t]*$` does **not** permit a carriage return, and `$` (no `m` flag, single-line test) matches only at the true end of the string. So a closing line of `"```\r"` fails to match: after ```` ``` ```` the engine is positioned at the `\r`, `[ \t]*` consumes nothing, and `$` cannot match because `\r` remains before end-of-string. The close is missed → the fence is treated as unterminated → range runs to EOF → all later `#@` matches fall inside the code range → `scanTokens` drops them (§5.6.1 "drop any match whose start index lies inside a code region").

Verified directly:
```
closeRe = /^ {0,3}`{3,}[ \t]*$/
closeRe.test("```")     → true   (LF)
closeRe.test("```\r")   → false  (CRLF — BUG)
```

**Steps to Reproduce**:
1. Create a markdown file with CRLF line endings containing a fenced code block followed by a `#@` import:
   ```bash
   printf '# Title\r\n\r\n```\r\ncode\r\n```\r\n\r\nAfter: #@after.md\r\n' > /tmp/crlf.md
   printf '# after\n' > /tmp/after.md
   ```
2. Run the extension: `injectFiles("Read #@/tmp/crlf.md", [], { cwd: "/tmp" })`.
3. Observe `injected === 1` (only `crlf.md`); `after.md` is NOT injected.
4. The injected `crlf.md` block shows `#@after.md` verbatim (marker not stripped, because it was classified as code).
5. Repeat with LF endings (`\n` instead of `\r\n`) → `injected === 2` (both files). The LF case is the control and works correctly.

Equivalently, probe `computeCodeRanges` directly:
```js
const ranges = mod.computeCodeRanges("```\r\n#@inside.txt\r\n```\r\n#@outside.txt\r\n");
// ranges === [[0, 39]]  (single range to EOF — close not detected)
mod.inCode("...#@outside.txt...".indexOf("#@outside.txt"), ranges); // → true  (WRONG; should be false)
```

**Impact**:
- **Silent data loss.** The user writes `#@spec.md` expecting "spec + everything it references." With CRLF + a code fence, the post-fence references vanish with no signal. This directly violates PRD §2 Goal 6 and the §5.6 contract.
- **Common trigger.** CRLF is the default line ending on Windows and appears frequently in cross-platform repositories (Git `core.autocrlf=true`, files round-tripped through certain editors/IDEs, docs exported from Office/Notion). Any such markdown with a code fence + a later `#@` import is affected.
- **No workaround signal.** Nothing errors, notifies, or logs. The markdown file is still injected (so it looks like the extension ran), but its imports are missing.
- **Zero existing test coverage.** None of the 182 tests in `file-injector.test.mjs`, `relative-imports.test.mjs`, or `import-behavior.test.mjs` use CRLF line endings, so this regression is invisible to the current gate.

**Scope of the fix**: Only `computeCodeRanges`' fence-close detection is affected. The fence *open* detection (`FENCE_OPEN_RE`, not end-anchored) works under CRLF. Inline-code detection (`inlineCodeRanges`, position-based, not line-based) is unaffected. Token capture (`FILE_INJECT_RE`'s `\S+` stops at `\r`, which is whitespace) is unaffected. Head line counting (`headStartLine`/`headCompleteLineCount` count `\n` only — one per line for both LF and CRLF) is unaffected. So the fix is localized to the close-line test.

**Suggested Fix** (two equivalent options; either fully resolves it):

Option A — tolerate a trailing `\r` in the close regex:
```ts
const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");
```

Option B — strip a trailing `\r` from each line at test time (normalize without disturbing char offsets, since `lineStart` is computed from the original `lines[i].length + 1`):
```ts
if (closeRe.test(lines[j].replace(/\r$/, ""))) { ... }
```

Recommendation: Option A is the smaller, most localized change and matches the "approximate CommonMark" framing (CommonMark treats `\r\n` and `\r` as line endings). Add regression tests that exercise CRLF markdown with (a) a fence followed by an import (must inject), (b) a fence containing a `#@` (must stay verbatim/code), and (c) mixed LF/CRLF line endings in one file.

## Minor Issues (Nice to Fix)

None that represent defects. The following are documented *intentional divergences* from the literal PRD pseudocode and are listed only so a reviewer does not mistake them for bugs:

- **Image magic-number validation (`hasValidImageMagic`)** — PRD §5.2 classifies images by extension only; the implementation additionally validates the real bytes before attaching. A text file renamed `fake.png` is injected as text rather than attached as a broken/garbage image. This better satisfies PRD §2 Goal 4 ("correct file-type handling … not garbage") and is documented in the README. Not a defect.
- **Unicode-aware trigger regexes** — PRD §4.2/§4.6 give the ASCII forms `(?<=\W)` / `(?<=[^\w#])`; the implementation uses Unicode-class forms `(?<![\p{L}\p{N}_])` / `(?<![\p{L}\p{N}_#])` with the `u` flag. This makes mid-word exclusion correct for non-ASCII text (e.g. `café#@x`, `日本語#@x` do not match), matching the README's stated behavior. Not a defect.
- **Empty-image note (`formatEmptyImageBlock`)** — PRD §5.2 does not special-case 0-byte images; the implementation emits a note instead of attaching an empty `ImageContent` (which providers reject). This is a robustness improvement. Not a defect.
- **Linear-time inline-code detection (`inlineCodeRanges`)** — replaces the PRD's regex `/(`+)([\s\S]*?)\1(?!`)/g` (O(n²) on long unmatched backtick runs) with an O(n) implementation producing byte-identical spans. Not a defect.

## Testing Summary
- Total tests performed: ~120 new creative assertions + 182 existing suite assertions (all existing pass; ~118 of ~120 new pass, with the 2 "failures" being test-harness cursor-position errors on my side, not product defects).
- Passing: ~300
- Failing (product): 1 distinct defect (CRLF fence-close), manifested across multiple scenarios.
- Areas with good coverage: handler guards; top-level path resolution (absolute/relative/tilde/../); symlinks (file/broken/dir); unicode content & filenames; emoji; boundary file sizes (exactly HEAD_CHARS, +1); dedup (same-abs, prior `<file>` blocks, cross-subtree); budget (undefined/null/throw/tight → whole vs paged); paged-directive line accuracy for long-lined files; sub-head guard; markdown chains (5-level, diamond, cycle, self-import); markdown importing binary/image; fenced code (backtick/tilde/nested/info-string/unterminated/close-with-info); inline code; output format (block, separator, stripped prompt, notify whole/paged, no-UI); config (trust gate, 4-source precedence, settings.json key, dedicated file); permissions (unreadable top-level, unreadable md import via R_OK gate); image handling (valid/mislabeled/0-byte/user-images-preserved); autocomplete (registration, no-ui guard, getSuggestions remap, applyCompletion); bare-@ (on/off, top-level-excluded, mid-word-excluded, dedup); cleanToken (all punct variants); ReDoS resistance (100k backticks in ~2ms); pre-order DFS import ordering.
- Areas needing more attention: **CRLF / Windows line-ending handling in markdown code-fence detection** (the one defect found). Recommend also adding `\r`-only (classic Mac) and mixed-ending cases to the regression suite as defense-in-depth, though `\r`-alone is essentially extinct.
