# Research Notes — P1.M2.T1.S1 (Bugfix): Rewrite F1 test + add co-load (F1b) & sentinel-in-prompt (F2) tests

> **Task type**: TEST-HARNESS edit only. The source fix (`file-injector.ts`: per-token dedup +
> sentinel removal) is **already landed** (P1.M1.T1 — Complete). The parallel item P1.M1.T2.S1
> (Unicode regex) is also landed in the file. This task updates the model-free harness
> `file-injector.test.mjs` so the F1 case reflects the NEW dedup mechanism and adds two regression
> cases for the two sentinel-rooted bugs (Issue 1 co-load double-injection; Issue 2 sentinel-in-prompt
> false-negative). **No `.ts` edits. No Unicode tests (those are P1.M2.T2.S1's separate scope).**

## 0. Verified current state of the repo (as of this research)

- `file-injector.ts` (239 lines): per-token dedup present (line ~143
  `if (text.includes('<file name="' + abs + '">')) continue;`); sentinel mechanism GONE (no
  `SENTINEL_RE`/`INJECT_SENTINEL` constant, no handler guard, no sentinel in assembly); Unicode regex
  present (line 17 `/(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu`). The ONLY remaining "sentinel" string is a
  **comment** at line 140 ("works even when the prior copy was a non-sentinel version") — explanatory,
  not a mechanism; NOT in scope to touch.
- `file-injector.test.mjs` (36 KB): **28 cases, passes 28/0** (confirmed by running
  `node ./file-injector.test.mjs`). The current `F1` case (lines 491-516) still references the
  "sentinel" in its name/comment and asserts `action==='continue'` — it passes **by accident** because
  the per-token dedup makes `injectFiles` return `injected===0` on already-injected text (the handler
  then returns `continue`). The item wants this case REWRITTEN to assert the dedup path explicitly.
- The handler's notify format is the **F4 pluralization**: `` `#@ injected ${injected} ${injected === 1 ? "file" : "files"}` ``
  → `"#@ injected 1 file"` / `"#@ injected 2 files"`. (Existing cases 9, 12, F4 already assert this and
  pass. My new cases check `notify === undefined` on the continue path, so this format is not exercised
  by F1/F1b/F2 — no conflict.)

## 1. The harness's conventions (so the edit matches style exactly)

- `runCase(label, name, asyncFn)` — runs `asyncFn`; an `assert(cond, msg)` throw = FAIL; records a
  matrix row. `label` is the case id (e.g. `"F1"`); `name` is the short human label.
- `assert(cond, msg)` — bare throw-on-fail helper (zero-deps ethos).
- `makeMockCtx(cwd, { hasUI = true })` → `{ ctx, rec }`. `ctx = { cwd, hasUI, ui: { notify } }`;
  `rec.notify` is `undefined` until notify fires, then `{ m, t }`.
- `captureHandler()` → `{ slot }` where `slot.cb` is the registered `input` handler.
  Call: `await slot.cb({ text, source, images, streamingBehavior? }, ctx)`.
- Module-level in scope for every case: `mod`, `TMPDIR`, `A_TS` (abs path of `a.ts`), `B_TS`, `FIX = { cwd: TMPDIR }`,
  `A_TS_CONTENT`, plus all other fixture paths. Fixtures are built once before cases run.
- The current F1 counts `<file>` blocks **inline** (no shared helper):
  `(text.match(new RegExp('<file name="' + A_TS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length`.
  New cases reuse this exact inline pattern to match the harness style (do NOT introduce a helper).

## 2. Verified dedup behavior (the load-bearing logic for F1/F1b)

`injectFiles(text, imagesIn, ctx)` after the fix (trace confirmed live):
- For each `#@<token>` match: `cleanToken` → `expandTildeAndResolve(token, cwd)` → `abs`. **Before**
  stat/read, it checks `if (text.includes('<file name="' + abs + '">')) continue;` — a plain substring
  test. If a block for that exact absolute path is already in `text` (injected by a prior copy in the
  runner chain, OR by a prior `injectFiles` call in the same process), the token is SKIPPED (count not
  incremented). This is **cooperation-independent** (works against any prior copy, sentinel or not).
- Net effect on already-injected text: every `#@` token whose block already exists → skipped →
  `count === 0` → returns `{ text, images: imagesIn, injected: 0 }` (the ORIGINAL text/images refs,
  unchanged). The handler then returns `{ action: "continue" }` (`if (!injected) return continue`).

So a SECOND pass over first-pass output is a no-op: `second.injected === 0` AND `second.text === first.text`.

## 3. Per-case verification (all 16 sub-assertions PASS against the live extension)

Ran a throwaway script mirroring the harness's jiti+alias import. **16/16 PASS.**

### F1 (rewritten) — "per-token dedup prevents re-injection"
| Sub-assertion | Result |
|---|---|
| `first = injectFiles("Review #@a.ts", [], FIX)` → `first.injected === 1` | PASS |
| `dedup = injectFiles(first.text, first.images, FIX)` → `dedup.injected === 0` | PASS |
| `dedup.text === first.text` (idempotent) | PASS |
| handler on `{text: first.text, source:"interactive"}` → `out.action === "continue"` | PASS |
| handler `rec.notify === undefined` | PASS |
| exactly ONE `<file name="A_TS">` block in `dedup.text` | PASS |

### F1b (added) — "co-load: two non-sentinel copies do not double-inject" (Issue 1 repro)
| Sub-assertion | Result |
|---|---|
| `first = injectFiles("Review #@a.ts", [], FIX)` → `first.injected === 1` | PASS |
| `second = injectFiles(first.text, first.images, FIX)` → `second.injected === 0` | PASS |
| `second.text === first.text` (no double-append) | PASS |
| exactly ONE `<file name="A_TS">` block in `second.text` | PASS |

### F2 (added) — "sentinel string in prompt no longer gates injection" (Issue 2 regression)
Prompt: `'<!--#@file-injected--> Review #@a.ts'`
| Sub-assertion | Result |
|---|---|
| `injectFiles(prompt, [], FIX)` → `injected === 1` (a.ts injected despite the sentinel substring) | PASS |
| `r.text.startsWith(prompt)` (original preserved verbatim) | PASS |
| `r.text` contains `<file name="A_TS">` block | PASS |
| exactly ONE `<file name="A_TS">` block (no ghost block for the `#@file-injected-->` token) | PASS |
| handler on `{text: prompt, source:"interactive"}` → `out.action === "transform"` | PASS |

**Why F2 works:** the `<!--#@file-injected-->` substring is no longer gated (sentinel guard removed).
The regex matches BOTH `#@file-injected-->` and `#@a.ts`. The first resolves (after `cleanToken` trims
the trailing `>` → `file-injected--`) to `TMPDIR/file-injected--`, which does not exist → skipped
(missing-file path). The second (`#@a.ts`) injects normally. `count === 1`. Before the fix, the handler
would have `SENTINEL_RE.test(prompt)` → `continue` before ever calling `injectFiles` → `injected === 0`
(the bug). Now: `injected === 1`.

## 4. The exact edit (anchor + replacement)

**File**: `file-injector.test.mjs`. **Anchor**: the current `F1` block (lines 491-516), unique in the
file (only one `await runCase("F1",` — confirmed by grep). **No existing `F1b` or `F2` label** (confirmed
— no collision).

**Replace** the entire current `F1` block with: the rewritten `F1` + new `F1b` + new `F2`. This is a
single `edit` call with one `oldText`/`newText` pair (the new cases sit in the same "F1/F3/F5" section,
between the old F1 and F3a). The `runCase` count goes **28 → 30** (F1 rewritten in place; F1b, F2 added).

The exact `oldText` (the current F1 block) and `newText` (F1 + F1b + F2) are in the PRP
`Implementation Blueprint → Exact source to write`, ready to paste into an `edit` tool call.

## 5. Scope boundaries (what NOT to do)

- Do NOT edit `file-injector.ts` (source fix is done; the line-140 "sentinel" comment is explanatory,
  owned by P1.M1.T1 — leave it).
- Do NOT add Unicode-boundary tests (`café#@x`, CJK) — that is **P1.M2.T2.S1** (separate planned task).
  The parallel PRP P1.M1.T2.S1 explicitly states harness additions for café/CJK belong to M2.T2.S1.
- Do NOT touch any existing case (1-14, E1-E4, G1-G3, H1, M1, F3a, F3b, F5, F4) — only the F1 block is
  replaced, and F1b/F2 are appended right after it.
- Do NOT introduce a shared block-count helper — reuse the existing inline
  `.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` pattern (matches the harness's zero-helper ethos + the
  current F1's own style).
- Do NOT edit README (P1.M3 owns docs).

## 6. Where the deliverables live

- PRP: `plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M2T1S1/PRP.md`
- This research: `.../P1M2T1S1/research/research_notes.md`
- The ONLY file the implementing agent edits: `file-injector.test.mjs` (one `edit`: replace F1 block
  with F1 + F1b + F2).
