# Research Notes — P1.M2.T2.S1 (Bugfix): Add Unicode word-boundary regression test cases

## 1. Task contract (verbatim from the work item)

Add ONE new test-case block labeled **`U1`** (Unicode boundary) to `file-injector.test.mjs` with
these 5 assertions, each using `mod.injectFiles(input, [], FIX)` and checking **both `r.injected`
and `r.text`**:

| # | Input            | Expected `injected` | Why                                                | Kind              |
|---|------------------|---------------------|----------------------------------------------------|-------------------|
| a | `café#@a.ts`     | `0`                 | `é` is a Unicode letter → `#@` is mid-word          | THE FIX (Issue 5) |
| b | `日本語#@a.ts`    | `0`                 | CJK chars are Unicode letters → mid-word            | THE FIX (Issue 5) |
| c | `Review #@a.ts`  | `1`                 | space before `#@` is a boundary                     | regression guard  |
| d | `#@a.ts`         | `1`                 | start-of-string                                     | regression guard  |
| e | `foo#@bar`       | `0`                 | ASCII mid-word still blocked                        | regression guard  |

Net case-count change: **30 → 31** (one new `runCase` block; the 5 assertions are sub-asserts inside
it). The contract explicitly says "Total case count increases by 1."

## 2. Baseline state of the repo (read & verified)

- `file-injector.ts` line 8 — **the Unicode regex is ALREADY LIVE** (P1.M1.T2.S1 = Complete):
  ```js
  const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
  ```
  This task does NOT touch the `.ts`. It only adds harness cases that assert this regex's behavior.
- `file-injector.test.mjs` — currently **30 cases** (P1.M2.T1.S1 = Complete; F1 rewritten + F1b + F2
  present). `grep -cE 'await runCase\(' file-injector.test.mjs` → `30`.
- `grep -nE 'await runCase\("U1"|café|日本語' file-injector.test.mjs` → **(none)** — clean baseline,
  no collision with the `U1` label or the café/CJK literals.
- The `a.ts` fixture exists at `TMPDIR/a.ts` (`const A_TS = path.join(TMPDIR, "a.ts");` at line 201);
  `const FIX = { cwd: TMPDIR };` at line 212. Both are the exact inputs the contract requires.

## 3. Insertion point (read lines 581–605)

The F-series (regression) block ends with `F4` (lines 581–587), immediately followed by the
"10. Summary + cleanup + exit." section header (lines 589–591):

```
585:   await slot2.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx2);
586:   assert(rec2.notify && rec2.notify.m === "#@ injected 2 files", `...`);
587: });
588: (blank)
589: // ──────────────────────────────────────────────────────────────────────────────
590: // 10. Summary + cleanup + exit.
591: // ──────────────────────────────────────────────────────────────────────────────
```

**Decision:** insert the `U1` block AFTER `F4`'s closing `});` (line 587) and BEFORE the summary
section header (line 589). Rationale: `U1` is a regression case for a validation-report finding
(Issue 5), so it belongs with the F-series regression group; placing it at the END of that group
(after F4) keeps F1/F1b/F2 (P1.M2.T1.S1) and F3a/F3b/F5/F4 untouched and avoids touching any other
case. The minimal unique edit anchor is the 3-line summary-section header (unique due to its middle
line "10. Summary + cleanup + exit.").

## 4. Assertion design (pre-verified GREEN — 11/11 sub-asserts)

Ran a throwaway script mirroring the harness's exact jiti+alias import (`/tmp/verify_u1.mjs`). Result:

```
PASS: (a) café#@a.ts injected===0
PASS: (a) café#@a.ts text verbatim
PASS: (b) 日本語#@a.ts injected===0
PASS: (b) 日本語#@a.ts text verbatim
PASS: (c) Review #@a.ts injected===1
PASS: (c) Review #@a.ts startsWith input
PASS: (c) Review #@a.ts includes block
PASS: (d) #@a.ts injected===1
PASS: (d) #@a.ts includes block
PASS: (e) foo#@bar injected===0
PASS: (e) foo#@bar text verbatim
11 passed, 0 failed
```

All 5 contract assertions confirmed against the live fixed extension. The assertions:

- **No-match cases (a, b, e):** `r.injected === 0` AND `r.text === <input>` (byte-for-byte verbatim —
  matches the harness convention used by cases 5/6/7/8/E3/E4: unchanged text is the proof of "no match").
- **Match cases (c, d):** `r.injected === 1` AND `r.text` contains the `<file name="<A_TS>">` block.
  (c) additionally asserts the original prompt is preserved verbatim at the start (case-1/12/13 convention).

## 5. Harness conventions reused (no new imports / helpers / fixtures)

- `runCase(n, name, fn)` — `n` is the label string for non-PRD cases (same as `"E1"`, `"F1"`, `"M1"`,
  …). `U1` follows this pattern exactly.
- `assert(cond, msg)` — throws on failure; caught by `runCase`, counted in `passed`/`failed`.
- `mod.injectFiles(text, images, { cwd })` — the function under test; returns `{ text, images, injected }`.
- `A_TS`, `FIX` — existing module-scope constants; no new fixtures needed (reuses `a.ts`).
- **Em dash U+2014 (—)** is used in other case NAMES/comments; the new U1 block also uses it in its
  name (`"U1 — Unicode word-boundary: …"`). The `oldText` anchor (the summary header) is pure ASCII +
  box-drawing dashes (U+2500 `─`), which is fine — but I note it explicitly so the implementer does not
  confuse the two dash glyphs.

## 6. Scope boundaries (do NOT collide with sibling tasks)

This task edits **ONLY** `file-injector.test.mjs`, adding **ONLY** the `U1` block. It does **NOT**:

- (a) touch `file-injector.ts` — the Unicode regex is already live (P1.M1.T2.S1, Complete).
- (b) touch `README.md` — the Unicode-aware "Where it matches" sentence was already added by
  P1.M1.T2.S1; any further README sweep is P1.M3.T1/T2.
- (c) touch any existing case — F1/F1b/F2 (P1.M2.T1.S1), F3a/F3b/F5/F4, 1-14, E1-E4, G1-G3, H1, M1
  are all untouched. U1 is appended at the end of the regression group.
- (d) add a co-load/dedup/sentinel case — those are P1.M2.T1.S1 (already landed).
- (e) introduce a block-count helper or new fixture — reuse `A_TS`/`FIX` inline.

## 7. Risk / confidence

- **Risk:** minimal. One additive `edit` (insert before a unique anchor). Every assertion is
  pre-verified green (11/11). No `.ts`/README change. The regex this depends on is already landed.
- **Idempotency:** if `U1` is already present (a prior pass), the pre-flight guard detects it; the
  case-count gate (31) and full-harness gate (31 passed) confirm done without forcing a re-edit.
- **Confidence: 9.5/10.** Residual 0.5 is for a possible transcription slip (wrong dash glyph, or
  pasting the block in the wrong region) — fully caught by Level-1 (case count = 31, U1 present, no
  other case touched) + Level-2 (full harness 31/31).
