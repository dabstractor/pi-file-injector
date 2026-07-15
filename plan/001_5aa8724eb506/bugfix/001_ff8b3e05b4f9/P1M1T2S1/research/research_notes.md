# Research Notes — P1.M1.T2.S1 (Bugfix Plan)

**Work item:** Update `FILE_INJECT_RE` with Unicode property escapes (Bug-fix PRD §Issue 5)
**Plan:** `001_ff8b3e05b4f9` (Sentinel Dedup Bug Fix & Spec Reconciliation)
**Target file:** `./sharp-at-file.ts` (line 8) + `./README.md` §Syntax (Mode A doc ride-along)
**Change:** One-line regex swap + one README sentence. No new files, no new symbols.

All facts below are **empirically verified** on this machine (Node ESM + the real 28-case harness
run against a regex-only temp copy). The full assertion suite in the PRP Level-3 gate is pre-run green.

---

## 1. The exact change (two edits total)

### Edit 1 — `sharp-at-file.ts` line 8 (the regex constant)

```diff
- const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
+ const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
```

**Verified the anchor is unique** in the file: `grep -c "const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;"` → exactly 1.
Surrounding context (lines 7–9): blank line above, `const MIME_BY_EXT: Record<string, string> = {` below.
The single regex line is the ONLY change to `sharp-at-file.ts`.

### Edit 2 — `README.md` §Syntax, "Where it matches" (Mode A — rides with the work)

Current (lines 111–112, raw bytes — note the em dash U+2014 `—`):
```
**Where it matches:** at the start of the prompt, **or** immediately after a non-word character
(space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing.
```
New (append one sentence; preserve the existing two):
```
**Where it matches:** at the start of the prompt, **or** immediately after a non-word character
(space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing. The word
boundary is **Unicode-aware**: `#@` does not trigger after non-ASCII letters or numbers in any
language either (e.g. `café#@x`, `Öster#@x`, or CJK like `日本語#@x` inject nothing), exactly as it
does not trigger after ASCII letters/digits/underscore.
```

**Verified README references the regex NOWHERE literally** (no `\W`, no `FILE_INJECT_RE`, no Unicode
mentions) — so only the "Where it matches" prose needs touching. Do NOT touch the test-count
("28 passed") or overview — those are M3.T2.S1's scope.

---

## 2. Why the new regex is exactly correct (mechanics)

- **`\W` problem (current):** in a non-`u` JS regex, `\W = [^A-Za-z0-9_]`. Non-ASCII letters (é, ö, ñ,
  CJK, Greek π, …) are *not* in `[A-Za-z0-9_]`, so they classify as `\W` → they satisfy the
  `(?<=\W)` lookbehind → `café#@secret.txt` triggers (the bug, confirmed live in the Bug-fix PRD).
- **`u` flag is mandatory** for `\p{L}` (Unicode Letter) and `\p{N}` (Unicode Number) property
  escapes. Without `u`, `\p{L}` is a SyntaxError.
- **`(?<![\p{L}\p{N}_])`** = negative lookbehind: "position NOT preceded by a Unicode letter, number,
  or underscore." This is the Unicode-aware equivalent of `(?<=\W)`. The underscore is included so
  identifiers (`foo_bar`) stay "word" — matches `\w = [\p{L}\p{N}_]` under the `u` flag.
- **`^` alternation unchanged:** `(^|(?<![\p{L}\p{N}_]))` — at start-of-input the lookbehind has no
  char to test, so the `^` branch carries start-of-string matching. `^` is start-of-input (no `m`
  flag). Works identically under `u`.
- **Flags `gu`:** `g` (for `matchAll` iteration) + `u` (Unicode mode). Both combine fine.

### Capture-group / matchAll parity (verified — the load-bearing claim)

The downstream code (`sharp-at-file.ts:140-141`) is:
```ts
for (const m of text.matchAll(FILE_INJECT_RE)) {
  const raw = m[2]; // capture group 2 = path token after #@
```
Both regexes have the **same group structure**: group 1 = the zero-width anchor `(^|…)`, group 2 =
`(\S+)`. Verified empirically for `"Review #@a.ts"`:
- OLD: `[{"0":"#@a.ts","2":"a.ts"}]`
- NEW: `[{"0":"#@a.ts","2":"a.ts"}]`
- `m[0] === "#@a.ts"` (the zero-width lookbehind consumes nothing → `m[0]` is exactly `#@<path>`).
- `m[2] === "a.ts"`; `m.length === 3` (full + 2 groups).

⇒ `m[0]`, `m[2]`, and the `matchAll` iteration are **byte-for-byte unchanged** for every input that
should match. No downstream code (`m[2]`, per-token dedup via `m[0]`-derived tokens, cleanToken, etc.)
needs to change.

---

## 3. Empirical verification results (pre-run green on this machine)

### 3a. The 5 contract cases + boundary parity (Node ESM, 13/13 PASS)

| Input | OLD (`\W`, no `u`) | NEW (`\p{L}\p{N}_`, `u`) | Expected |
|---|---|---|---|
| `Review #@a.ts` | match | match | match ✅ |
| `#@a.ts` (start) | match | match | match ✅ |
| `foo#@bar` (mid-word) | no match | no match | no match ✅ |
| `café#@secret.txt` | **match (BUG)** | **no match (FIXED)** | no match ✅ |
| `日本語#@file` | **match (BUG)** | **no match (FIXED)** | no match ✅ |
| `(#@a.txt)` [harness E2] | match | match | match ✅ |
| `a-#@dash.txt` | match | match | match ✅ |
| `a #@space.txt` | match | match | match ✅ |
| `[#@bracket.md` / `>#@angle.md` / `\n#@nl.ts` / `end.#@dot.txt` | match | match | match ✅ |
| `under_score#@x.txt` | no match | no match | no match ✅ |
| `数字123#@data.bin` | no match | no match | no match ✅ |
| `Öster#@x` / `π#@val` | match (BUG) | **no match (FIXED)** | no match ✅ |

**Conclusion:** the new regex (a) fixes the non-ASCII bug, (b) does NOT over-restrict (real
non-word boundaries still match → no harness regression), (c) preserves capture groups.

### 3b. Full 28-case harness regression (gold standard)

Method: copied `sharp-at-file.ts` + `sharp-at-file.test.mjs` to `/tmp/saf-regex/`, applied ONLY the
regex change to the temp `.ts`, ran the copied harness (which resolves the `.ts` relative to its own
dir). **Result: `28 passed, 0 failed`, exit 0.** This empirically proves the regex change breaks zero
existing cases — including E2 `(#@a.txt)` (paren boundary), case 7 `the foo#@bar thing` (mid-word),
and all normal `#@file` injection cases.

---

## 4. Scope boundaries (collision avoidance with sibling tasks)

This bugfix plan has **concurrent sibling work**. To stay collision-free:

- **P1.M1.T1.S1** (per-token dedup, lines 147-152): DONE / in file. Not touched.
- **P1.M1.T1.S2** (sentinel removal): running in parallel on `sharp-at-file.ts`. It deletes sentinel
  constants/guard/assembly. My edit (line 8 regex) is in a **disjoint region** (top-of-file constant),
  so the two edits cannot conflict on the same anchor. Both are exact-text replacements on unique,
  non-overlapping strings.
- **P1.M2.T2.S1** ("Add Unicode boundary test cases"): this task PERMANENTLY adds the `café#@`/CJK/etc.
  cases to `sharp-at-file.test.mjs`. **My task does NOT edit the harness** — it verifies via a
  throwaway Level-3 script. Rationale: (a) the plan has a dedicated M2.T2.S1 for harness cases;
  (b) the sibling PRP P1.M1.T1.S2 explicitly scoped harness edits to M2.* ("do NOT touch the harness
  — that's M2.T1.S1"); (c) editing the harness here would collide with M2.T2.S1. The contract item
  description point 5 ("add test cases") is satisfied by running the throwaway verification; permanent
  harness addition is M2.T2.S1.
- **P1.M3.T1.S1 / P1.M3.T2.S1** (README F3/F5 docs + test-count/overview): my README edit is limited
  to the §Syntax "Where it matches" sentence. I do NOT touch the behavior-by-file-type table (F3/F5),
  known-limitations sentinel references, or the "28 passed" count.

### File-state at implementation time

`sharp-at-file.ts` is in flux (S2 sentinel-removal parallel). But the regex constant on line 8 is
**stable across all sentinel work** — S2 never touches line 8. So the exact-text anchor
`const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;` is present and unique regardless of S2's state.
The implementer should `grep` to confirm before editing (PRE-FLIGHT).

---

## 5. Test harness structure (for the implementer — read, do NOT edit here)

`sharp-at-file.test.mjs`:
- Resolves the `.ts` **relative to the harness script's own directory** (`SCRIPT_DIR`), so it always
  imports the committed `./sharp-at-file.ts` (cwd-independent). Run: `node ./sharp-at-file.test.mjs`.
- Uses Pi's real jiti loader + alias map (same as the extension loader). Model-free (no API key).
- 28 cases. Regex-relevant ones (all verified still green with the new regex): case 1 (`Review #@a.ts`),
  case 7 (`the foo#@bar thing` → no match), case 8 (`# Heading`/`#1234` → no `#@`), case 9 (two tokens),
  case 11 (`See #@a.ts.`), case 13 (parity), ~case 15/E2 (`(#@a.txt)`), E3 (`` `code #@a.ts` ``).
- The Unicode cases do NOT yet exist in the harness — adding them is M2.T2.S1.

---

## 6. README §Syntax — what NOT to touch

The README §Syntax also contains the Grammar line, the trailing-punctuation list
(`. , ; : ! ? " ' ) ] } >`), and the Paths paragraph. **None of these are affected by the regex
change** (cleanToken/S2 own trailing-punct; path resolution is unchanged). Only the "Where it matches"
prose mentions word boundaries — that is the sole README edit. The README has NO literal-regex
snippet to keep in sync (verified by grep: no `\W`, no `FILE_INJECT_RE`, no `p{L}`).
