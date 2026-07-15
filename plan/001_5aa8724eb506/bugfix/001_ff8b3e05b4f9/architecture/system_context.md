# System Context — Sentinel Dedup Bug Fix

## Executive Summary

The `#@file` Whole-File Injection extension (`sharp-at-file.ts`, 249-line repo version) has two Major
bugs and four Minor spec-deviation issues, all stemming from the `F1` anti-duplication sentinel added
beyond the PRD. The sentinel mechanism is **cooperation-based** (relies on all loaded copies stamping
the same sentinel string), which fails when a non-participating copy co-loads. The fix is to replace
sentinel-based dedup with **per-token dedup** (check if a `<file name="<abs>">` block for the resolved
path already exists in the text), which is independent of other copies' cooperation.

## Current State

- **Source file**: `sharp-at-file.ts` (249 lines) — PRD-compliant core + F1 sentinel, F3 magic-number
  sniff, F4 pluralization, F5 empty-image special-case
- **Test harness**: `sharp-at-file.test.mjs` (28 cases, passes 28/28) — model-free, imports the real
  `.ts` via jiti
- **Stale global copy**: `~/.pi/agent/extensions/sharp-at-file.ts` (182 lines, no sentinel/F3/F5) —
  co-exists with the repo copy, causing the duplicate-injection bug
- **README**: Documents the extension's behavior, installation, and design choices

## The Three Interrelated Sentinel Bugs (Issues 1, 2, 6)

All three are fixed by a single change: **remove the sentinel, add per-token dedup**.

### Issue 1 — Duplicate injection (Major)
**Root cause**: `SENTINEL_RE.test(event.text)` guard only fires if the OTHER copy stamped the sentinel.
A non-sentinel copy (e.g. the stale 182-line global version) injects without stamping, so the sentinel
copy runs `injectFiles` again, re-matches the still-present `#@path` token, and re-injects.

### Issue 2 — Sentinel false-negative (Major)
**Root cause**: `SENTINEL_RE.test(event.text)` tests the RAW user prompt before any injection. If the
user's prompt happens to contain `<!--#@file-injected-->` (e.g. from copy/pasting prior output), ALL
`#@` injection is silently suppressed.

### Issue 6 — Assembly format deviation (Minor)
**Root cause**: `INJECT_SENTINEL` is inserted between the `---` separator and the blocks:
`${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}`. This deviates from PRD §6.2.

### Unified Fix
1. **Add per-token dedup** in `injectFiles`: before adding a block, check
   `if (text.includes('<file name="' + abs + '">')) continue;`
2. **Remove**: `INJECT_SENTINEL` constant, `SENTINEL_RE` constant, handler sentinel guard,
   sentinel insertion in assembly
3. **Result**: Assembly returns to exact PRD §6.2 format; dedup is cooperation-independent;
   sentinel-in-prompt false-negative is eliminated

## Verified Pi Internals

### Extension Loader Dedup (`dist/core/extensions/loader.js:507-513`)
```js
const seen = new Set();
const addPaths = (paths) => {
    for (const p of paths) {
        const resolved = path.resolve(p);
        if (!seen.has(resolved)) {
            seen.add(resolved);
            allPaths.push(p);
        }
    }
};
```
- Dedup is by **absolute path** only. Two different paths to the same extension name BOTH load.
- **Load order**: (1) project-local `.pi/extensions/`, (2) global `~/.pi/agent/extensions/`,
  (3) CLI `-e` paths.

### Input Event Runner Chaining (`dist/core/extensions/runner.js:881-920`)
```js
async emitInput(text, images, source, streamingBehavior) {
    let currentText = text;
    let currentImages = images;
    for (const ext of this.extensions) {
        for (const handler of ext.handlers.get("input") ?? []) {
            const event = {
                type: "input",
                text: currentText,          // ← FEEDS PREVIOUS HANDLER'S OUTPUT
                images: currentImages,
                source,
                streamingBehavior,
            };
            const result = (await handler(event, ctx));
            if (result?.action === "handled") return result;
            if (result?.action === "transform") {
                currentText = result.text;   // ← UPDATE FOR NEXT HANDLER
                currentImages = result.images ?? currentImages;
            }
            // "continue" = no-op, currentText passes through
        }
    }
    ...
}
```
- Handlers chain: each handler receives the **output** of the previous handler.
- `transform` updates `currentText` → next handler sees the transformed text (with blocks appended).
- `continue` passes the current text through unchanged → next handler still runs.
- **Confirmed**: when global copy loads first and transforms (injecting files), the repo copy's
  handler receives the already-injected text as `event.text`. The `#@path` token is still in the
  original prompt portion, so without dedup, it gets re-injected.

## Unicode Regex Fix (Issue 5)

### Current regex
```js
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
```
In a non-`u` JS regex, `\W` = `[^A-Za-z0-9_]`. Non-ASCII letters (é, ö, ñ, CJK) are classified as
**non-word**, satisfying the lookbehind. So `café#@secret.txt` triggers injection (confirmed live).

### Proposed fix
```js
const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
```
- `u` flag enables Unicode property escapes.
- `(?<![\p{L}\p{N}_])` = negative lookbehind: position NOT preceded by Unicode letter/number/underscore.
- This is the Unicode-aware equivalent of `(?<=\W)` (preceded by a non-word char).

### Verified behavior (Node.js test)
| Input | Current regex | Proposed regex | Expected |
|---|---|---|---|
| `Review #@a.ts` | ✅ matches | ✅ matches | match |
| `#@a.ts` (start) | ✅ matches | ✅ matches | match |
| `foo#@bar` (mid-word) | ❌ no match | ❌ no match | no match |
| `café#@secret.txt` | ⚠️ matches (BUG) | ❌ no match (FIXED) | no match |
| `日本語#@file` | ⚠️ matches (BUG) | ❌ no match (FIXED) | no match |

## Spec Deviations (Issues 3, 4 — Documentation Only)

### F3 — Magic-number sniff (`hasValidImageMagic`)
- **PRD §5.2**: Route images by extension only.
- **Actual**: Routes by extension, THEN validates actual bytes match the declared image type. A
  mislabeled file (text named `.png`) falls through to text/binary path.
- **Recommendation**: Document as intentional improvement (avoids attaching decoded garbage).

### F5 — Empty-image handling (`formatEmptyImageBlock`)
- **PRD §10**: Empty file → `<file name="…">\n\n</file>` (applies to all file types).
- **Actual**: 0-byte images get `<file name="…"><empty image file — 0 bytes; nothing to attach></file>`
  (avoids attaching empty ImageContent that providers reject).
- **Recommendation**: Document as intentional divergence.

## Test Harness Gaps

The existing 28-case harness has these blind spots:
1. **No co-load simulation**: The F1 test only re-feeds through the SAME sentinel-stamping handler.
   It never simulates a non-sentinel co-loaded copy. This is the root cause of Issue 1.
2. **No sentinel-in-prompt test**: No test covers a user prompt containing the sentinel string.
3. **No Unicode boundary test**: No test covers `café#@file` or CJK text before `#@`.
4. **Integration cases never executed**: PRD §11 #12 and #13 are marked "INTEGRATION" and skipped.

## Files Modified

| File | Changes |
|---|---|
| `sharp-at-file.ts` | Remove sentinel mechanism; add per-token dedup; update regex |
| `sharp-at-file.test.mjs` | Update F1 test; add co-load, sentinel-in-prompt, Unicode tests |
| `README.md` | Document F3/F5 deviations; update behavior table; remove sentinel references |
