# Code Changes Analysis — `#@file` Injector Bug Fixes (Issues 1–4)

This document pins the **exact code locations**, the **verified fix strategies**, the **test
impact** for each change, and the **design nuances** the implementing PRP agents must respect. All
line references are to the current committed `file-injector.ts` / `file-injector.test.mjs`.

---

## Issue 1 — Within-prompt dedup gap (Major)

### Location
`injectFiles`, lines ~205–258 (the `for (const m of text.matchAll(FILE_INJECT_RE))` loop).

### Root cause (confirmed)
The `priorPaths` set is populated ONCE before the loop (~L199–204):
```ts
const priorPaths = new Set<string>();
for (const m of text.matchAll(/<file name="([^"]+)">/g)) {
  priorPaths.add(m[1]);
}
```
…and the in-loop dedup check (~L216 `if (priorPaths.has(abs)) continue;`) reads it, but **nothing
ever adds to `priorPaths` after a successful injection**. So a repeat of the same resolved path later
in the same prompt re-injects.

### Verified fix
Introduce a SEPARATE within-run set (do NOT mutate `priorPaths` — see Invariant below) and check it
at the TOP of the loop (before the `fs.stat` work), adding to it after EACH successful inject:
```ts
const injectedThisRun = new Set<string>();
for (const m of text.matchAll(FILE_INJECT_RE)) {
  // … token/abs resolution …
  if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;   // COMBINED dedup check
  // … stat / readFile / classify …
  // after EVERY successful branch (text-inline / paged / image / binary / empty-image):
  injectedThisRun.add(abs);
  count++;
}
```
**Every `count++` site must be paired with `injectedThisRun.add(abs)`** — there are 5 inject sites
(text-inline, paged-text, image, binary, empty-image). Missing any one re-opens the gap for that
file type.

### Why a separate set (Invariant — F1c)
`priorPaths` models "blocks ALREADY in the input text" (from a prior copy or Pi's `@file` argv
expander). F1c asserts that a prior block for path X must NOT block a NEW path Y in the same prompt.
Mutating `priorPaths` in-loop would still be path-keyed (so F1c holds), but a separate
`injectedThisRun` makes the "already in input" vs "injected this pass" distinction explicit and
keeps the diff minimal and reviewable. Either is correct; the SEPARATE set is recommended.

### Test impact
- **No existing test breaks** (F1/F1b/F1c/F1d exercise cross-pass/co-load dedup, never a same-path
  repeat in one prompt).
- **ADD** new regression case(s): same path twice in one prompt (text) → `injected===1`, exactly one
  `<file>` block; same path via two path forms (`#@a.ts` + `#@./a.ts`) → 1 block; image dedup
  (`#@pic.png` twice) → `images.length===1`.

---

## Issue 2 — Failed-token `#@` stripping in MIXED prompts (Major)

### Location
`injectFiles`, post-loop assembly (~L261):
```ts
const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
```
This is reached only when `count > 0` (the `count === 0` path returns the original `text`
byte-for-byte at ~L259).

### Root cause (confirmed)
A blanket `String.replace` over the global regex strips `#@` from EVERY `#@` token when at least one
succeeded — including failed ones. PRD §6.2: "Tokens that did **not** inject … are left byte-for-byte
verbatim, `#@` included."

### Verified fix — RECOMMENDED: index-based splice (robust)
During the loop, record `{ index: m.index, len: m[0].length }` for each ACTUALLY-injected match
(push only on the successful branches, the same 5 sites as Issue 1). After the loop, rebuild `text`
with `#@` removed ONLY at those exact indices:
```ts
const injectedSpans: { index: number; len: number }[] = [];  // push {index: m.index, len: m[0].length} on each successful inject
// …loop…
// after loop, count > 0:
let strippedText = text;
for (const { index, len } of injectedSpans.sort((a, b) => b.index - a.index)) {  // right→left keeps indices valid
  strippedText = strippedText.slice(0, index) + strippedText.slice(index + 2) + /* nothing */;
  // i.e. drop the 2 chars "#@" at the recorded match start; the rest (len-2 path chars) stays.
}
```
Concretely: at each recorded `index`, remove exactly the 2 characters `#@` (chars at `index` and
`index+1`); the path token (`m[0].slice(2)`) stays in place. Sorting descending and splicing
right-to-left keeps earlier indices valid. This is O(n) and collision-free.

### Why NOT the naive `text.replace(whole, whole.slice(2))`
The bug report's simpler suggestion (replace each injected match substring) has a **substring-collision
risk**: an injected match string can be a prefix of another match (e.g. `#@a.ts` is a prefix of
`#@a.ts.bak`). `String.replace("#@a.ts", "a.ts")` matches the FIRST occurrence of the literal
substring, which — depending on match order — can land inside the longer token and corrupt it. The
index-based splice removes characters only at the precise recorded start positions, so there is no
ambiguity. (The implementing agent MAY use the substring approach if it first proves no injected
match is a prefix of another, but the index approach is strictly safer and is recommended.)

### Regex facts that make `m.index` reliable
`FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu` — group 1 `(^|(?<!…))` is **zero-width**
(consumes nothing), so `m.index` is exactly the index of the `#`, and `m[0]` is exactly `#@<rawtoken>`
(raw token = BEFORE `cleanToken` trims trailing punctuation). Removing the 2 chars at `m.index`
drops exactly `#@`, leaving the raw token (e.g. `#@a.ts.` → `a.ts.` — matching the current "path
stays, raw form preserved" behavior).

### Test impact — CRITICAL: F2 asserts the buggy behavior
- **UPDATE F2** (`file-injector.test.mjs` ~L614): currently asserts
  `r.text.startsWith('<!--file-injected--> Review a.ts')` — i.e. it asserts the failed
  `#@file-injected-->` token LOST its `#@`. After the fix, that token must KEEP `#@`, so the
  assertion becomes `r.text.startsWith('<!--#@file-injected--> Review a.ts')` (the successful
  `#@a.ts` is still stripped to `a.ts`).
- **ADD** new regression case(s): mixed success+fail prompt
  (`Review #@a.ts and check #@missing.ts`) → `r.text.includes("#@missing.ts")===true` AND
  `r.text.startsWith("Review a.ts")`; mixed success+directory (`Review #@a.ts and list #@src/`) →
  `#@src/` kept verbatim.

### Issue 1 × Issue 2 interaction (design decision — document it)
When the SAME path appears twice in one prompt, Issue 1's dedup SKIPS the 2nd token (it does not
inject). Issue 2 strips `#@` only from ACTUALLY-injected tokens. Therefore the **deduped 2nd token
keeps its `#@`** (it "did not inject"). Result for `Compare #@a.ts with #@a.ts`:
`Compare a.ts with #@a.ts` + one `<file>` block. This is the literal reading of PRD §6.2 ("strip
from each injected marker"; "tokens that did not inject left verbatim, `#@` included") and matches
the bug report's stated fix intent ("strip `#@` only from tokens that actually injected"). The
implementer should add an explicit assertion for this interaction and note it in the README if it
feels surprising.

---

## Issue 3 — Notify wording (Minor)

### Location
The `input` handler in the `default` factory (~L288–292):
```ts
const whole = injected - paged;
const msg = paged > 0
  ? `#@ injected ${whole} whole, ${paged} paged`
  : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`;
```

### Root cause (confirmed)
The `paged===0` branch says `N file` / `N files`; PRD §5.5 Notify examples say `#@ injected N whole`
(versus `#@ injected N whole, M paged`).

### Verified fix
Unify on the PRD wording — always use `whole`, append `, M paged` only when paging:
```ts
const whole = injected - paged;
const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
```

### Test impact (verified by grep — 5 assertions across 4 cases, all `file(s)`→`whole`)
- **UPDATE Case 9** (~L329): `"#@ injected 2 files"` → `"#@ injected 2 whole"`.
- **UPDATE Case 12** (~L361): `"#@ injected 1 file"` → `"#@ injected 1 whole"`.
- **UPDATE F4** (~L661 & L665): `1 file` → `1 whole`; `2 files` → `2 whole`.
- **UPDATE PN1** (~L823): `"#@ injected 2 files"` → `"#@ injected 2 whole"` (also refresh its name/comment from "existing plural style preserved" → "unified whole style").
- PN2 (~L836, `1 whole, 1 paged`) and PN3 (~L847, `0 whole, 1 paged`) already use the `paged>0` branch and are UNCHANGED.

---

## Issue 4 — Paged directive `offset:0` re-reads the head (Minor)

### Location
`formatPagedDirectiveBlock` (~L126–127):
```ts
return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first '
  + HEAD_BYTES + ' bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, '
  + 'incrementing offset until the entire file is read></file>';
```

### Root cause (confirmed)
Pi's read tool `offset` is **1-indexed**: `startLine = offset ? Math.max(0, offset - 1) : 0`
(`dist/core/tools/read.js`), and `offset ?? 1` when omitted. So `offset:0` is treated as "start at
line 1" — the model re-reads the first ~2000 lines already injected as the head. The directive's own
wording ("load the **rest**") contradicts "offset:0". Compounding: the head is measured in **bytes**
(`HEAD_BYTES=8192`, ~2000 lines) but the read window in **lines** (`limit:2000`), so the two windows
don't align.

### Verified fix — pick ONE internally-consistent option
**Reviewer finding (important):** `offset:0` and `offset:1` are IDENTICAL — Pi's read tool does
`offset ? Math.max(0, offset-1) : 0`, so both start at line 1. So changing `0`→`1` is cosmetic and
buys nothing. The root inconsistency is that the head is BYTES while the read window is LINES; you
cannot compute an EXACT line offset that skips an 8192-byte head. BUT the PRD itself frames
`HEAD_BYTES = 8192 (about 2000 lines, matching the read tool's default limit)`, so an APPROXIMATE
line offset is consistent with the PRD's own equivalence.

**Option A (resume past the head — recommended, smallest diff):** keep the byte head block; change
ONLY the directive string to point past it, e.g.
`"…first ~2000 lines injected above. Use the read tool to read the rest: offset:2001, limit:2000,
incrementing offset by 2000 until the entire file is read."` This keeps the head (immediate content)
AND avoids re-reading it, and `offset:2001` is consistent with the PRD's `8192 bytes ≈ 2000 lines`
framing. PD1/PD2's head-block assertions stay valid; only the directive string changes.
**Option B (page from the start, drop the head):** drop the head block, emit only a directive to read
from `offset:1, limit:2000` onward. Simplest and fully consistent, but loses the "immediate content"
benefit and is a larger diff (changes the two-block paged structure + PD1/PD2 head assertions).
**Option C (make the head line-based):** truly exact (head = first 2000 lines, directive `offset:2001`)
but SCOPE-EXPANDING — it changes `content.slice(0, HEAD_BYTES)` to a line split and contradicts the
PRD's explicit `HEAD_BYTES` byte pin. Only if the PRD is amended.
Either A or B satisfies the bug report ("pick one and make the directive internally consistent").
Recommend A.

### Test impact
- PD1/PD2 assert the directive via `mod.formatPagedDirectiveBlock(HUGE, …)` — they compare against
  the **helper's own output**, so any helper-string change is auto-matched and they do NOT break.
  BUT they assert PRESENCE not CORRECTNESS (would pass even for `offset:banana`). **ADD a hardcoded-
  string assertion** (e.g. `assert(r.text.includes("offset:2001, limit:2000"))`) to pin that the
  directive actually points past the head (the reviewer's test-quality note).

---

## Cross-cutting: Documentation (per SOW §5)

- **Mode A (doc-with-work)**: none of the four fixes changes user-facing config, CLI flags, env
  vars, or exported type signatures. The notify wording (Issue 3) and the paged directive string
  (Issue 4) are not quoted in `README.md`, so no per-subtask doc update is required. Each subtask's
  `context_scope` DOCS line says "none — no user-facing/config/API surface change" (Mode A).
- **Mode B (changeset-level, final task)**: a final "Sync changeset-level documentation" task
  reviews `README.md` to ensure the paged-delivery paragraph (~L41) and the trigger-stripping note
  (~L31) still align with the corrected behavior (failed tokens keep `#@`; paged directive no longer
  re-reads the head). It depends on every implementing subtask.

## Implementation order recommendation
Issue 1 → Issue 2 (both edit the loop body's "after successful inject" bookkeeping; sequencing avoids
conflicts and lets Issue 2 reuse Issue 1's inject-site enumeration). Issues 3 & 4 are independent
single-line/single-helper edits and can follow in any order. The final docs-sync task runs last.
