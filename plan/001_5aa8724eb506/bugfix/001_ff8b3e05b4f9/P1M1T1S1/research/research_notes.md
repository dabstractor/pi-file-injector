# Research Notes — P1.M1.T1.S1 (Add per-token dedup check in injectFiles)

## Task scope (SURGICAL — one line + comment)
Inside `injectFiles`'s `for (const m of text.matchAll(FILE_INJECT_RE))` loop, AFTER resolving `abs`
(line 145) and BEFORE `let st;` (line 147), insert:
```ts
    if (text.includes('<file name="' + abs + '">')) continue;
```
(+ a descriptive comment). Fixes Issue 1 (duplicate injection when a non-sentinel copy co-loads).

OUT OF SCOPE (other subtasks): removing the sentinel constants/guard/assembly (S2), the Unicode
regex fix (M1.T2.S1), harness test additions (M2.T1.S1 / M2.T2.S1), README changes (M3).

## Exact insertion site (verified line numbers in file-injector.ts, 249 lines)
```
145:    const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)
146:  (blank)
147:    let st;
148:    try {
149:      st = await fs.stat(abs);
```
Insert between 145 and 147. Edit anchors on `const abs = ...\n\n    let st;`.

## Why this fixes Issue 1 (co-load duplicate injection) — VERIFIED via runner chaining
Pi runner (`dist/core/extensions/runner.js:881-920`) chains input handlers: each handler receives the
PREVIOUS handler's transformed `event.text`. Loader dedups extensions by ABSOLUTE PATH only
(`loader.js:507-513`, `seen = new Set()` on `path.resolve(p)`) — so global + repo (two distinct paths)
BOTH load. Trace after the fix:
1. Global (non-sentinel) copy runs first → injectFiles → appends `<file name="/abs/a.ts">…` block,
   returns transform. Text now has the block but NO sentinel.
2. Repo copy runs second → handler guards pass (source≠ext, not steer, text has `#@`) → sentinel guard
   does NOT fire (no sentinel in text) → injectFiles runs → NEW dedup:
   `text.includes('<file name="/abs/a.ts">')` === TRUE → `continue` → count stays 0 → returns
   `{text, images: imagesIn, injected: 0}` → handler `if (!injected) return continue`. ✓ No double-inject.

## Scope boundary — what stays AFTER this task (S2 removes it next)
- `INJECT_SENTINEL` / `SENTINEL_RE` constants: STILL PRESENT.
- Handler sentinel guard `if (SENTINEL_RE.test(event.text)) return continue`: STILL PRESENT
  → Issue 2 (sentinel-in-prompt false-negative) NOT yet fixed (that's S2).
- Assembly `${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks…}`: STILL HAS SENTINEL
  → Issue 6 (format deviation) NOT yet fixed (that's S2).
=> After S1: Issue 1 FIXED. Issues 2 + 6 still open (intentional — S2's scope).

## The dedup check string matches ALL 4 format functions' prefix — VERIFIED
Every block helper emits a block beginning exactly with `<file name="<abs>">`:
- formatTextFileBlock: `'<file name="' + abs + '">\n' + content + '\n</file>'`
- formatImageBlock:    `'<file name="' + abs + '">' + (hint ?? "") + '</file>'`
- formatBinaryBlock:   `'<file name="' + abs + '"><binary file …>'`
- formatEmptyImageBlock: `'<file name="' + abs + '"><empty image file …>'`
So `text.includes('<file name="' + abs + '">')` catches any prior-injected block regardless of type.

## `text` is the INPUT param, NOT the accumulated `blocks` array — IMPORTANT
The check scans the `text` parameter (event.text as passed by the handler — may already contain blocks
from a prior copy's transform). It does NOT scan the local `blocks[]` being built in THIS call. So:
- Cross-copy dedup (the bug): WORKS (prior transform put blocks into event.text).
- Within-call duplicate tokens (e.g. `#@./a.ts` + `#@a.ts`, same abs): NOT deduped by this check
  (blocks aren't in `text` mid-iteration). That is OUT OF SCOPE and not part of Issue 1. Do not
  "improve" the check to scan `blocks` — the contract is explicit: check `text` only, before stat.

## Uses `includes()` not regex — VERIFIED no escaping needed
The check is a plain substring test. Path characters `[ ] . ( ) * +` need no escaping (would be a
landmine in a RegExp). `abs` is an absolute resolved path; concatenation is safe.

## Validation gate — VERIFIED WORKING on this machine (both directions)
`/tmp/verify_dedup.mjs` (provided verbatim in the PRP) exercises 3 cases via the real injectFiles
through jiti (same import pattern as the harness):
- baseline (clean text)        → injected=1   (correct now; stays 1 after fix)
- dedup (prior w/ sentinel)    → injected=1 NOW (BUG) → 0 after fix
- dedup (prior NON-sentinel)   → injected=1 NOW (BUG) → 0 after fix  ← THE ISSUE 1 FIX
Ran against CURRENT un-fixed code: both dedup cases return 1 (proving the test catches the bug).
After the one-line fix they return 0. Existing harness `node ./file-injector.test.mjs` → 28/28 now
and must remain 28/28 after (the F1 test still passes: it feeds already-sentinel'd text through the
HANDLER, whose sentinel guard still fires; the dedup in injectFiles is not re-invoked on it).

## Existing test harness — how it works (for the implementer)
- `file-injector.test.mjs` (577 lines, 28 cases). Run: `node ./file-injector.test.mjs` (exits 0 on
  all-pass, 1 on any fail). Model-free / hermetic (no API key, no Pi process).
- Imports the REAL `./file-injector.ts` via jiti with Pi's alias map (lines 1-70): resolves global
  pi root via `npm root -g`, loads `createJiti` from `<PIPKG>/node_modules/jiti/lib/jiti.mjs`, sets
  alias `@earendil-works/pi-coding-agent` → `<PIPKG>/dist/index.js`, `@earendil-works/pi-ai` →
  `<PIPKG>/node_modules/@earendil-works/pi-ai/dist/compat.js`, then `jiti.import(TS_PATH)`.
- Named exports available on `mod`: `injectFiles`, `cleanToken`, `formatTextFileBlock`,
  `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`, `hasValidImageMagic`. `mod.default`
  is the factory.
- DO NOT modify this harness in S1 (adding co-load/sentinel tests is M2.T1.S1's scope).

## Pi version
`@earendil-works/pi-coding-agent` v0.80.7 (global). `npm root -g` → `/home/dustin/.local/lib/node_modules`.
