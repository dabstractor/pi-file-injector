# Research Notes — P1.M1.T1.S2 (Strip `#@` only from injected tokens via index-splice — Issue 2)

Scope: fix Issue 2 — in a *mixed* prompt (≥1 successful + ≥1 failed `#@` token), the blanket
post-loop `text.replace(FILE_INJECT_RE, …)` strips `#@` from FAILED tokens too, violating PRD §6.2
("tokens that did not inject are left byte-for-byte verbatim, `#@` included"). Fix = **index-based
splice**: record `m.index` at each actually-injected success site, then remove exactly the 2 chars
`#@` at each recorded index (high→low). The substring approach is **FORBIDDEN** (empirically corrupts).

---

## 1. S1 (within-run dedup) — CONFIRMED IN THE CURRENT FILE (the contract S2 builds on)

The current `file-injector.ts` (395 lines) ALREADY has S1's infrastructure (S1 finished in parallel):
- L192: `const injectedThisRun = new Set<string>();` (between priorPaths loop and main loop)
- L205: `if (priorPaths.has(abs) || injectedThisRun.has(abs)) continue;` (widened dedup guard)
- L225: `injectedThisRun.add(abs);` (empty-image success site) → L226 `count++;`
- L266: `injectedThisRun.add(abs);` (end-of-try success site) → L267 `count++;`
- DUP1/DUP2/DUP3 tests present; harness = **46 passed, 0 failed** (verified).

S2 piggybacks on S1's two `injectedThisRun.add(abs)` success sites: at the SAME two lines, also push
`m.index` into a new `injectedIndexes` array. (S1's reasoning — 2 sites cover all 5 inject branches
because text-inline/paged/image/binary all fall through to the end-of-try `count++` — applies
identically to the index push.)

## 2. Root cause (confirmed live)

Post-loop assembly (L280), reached only when `count > 0` (the `count===0` path at L278 returns
original text byte-for-byte — already correct):

```ts
const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
```

A blanket `String.replace` over the global regex strips `#@` from EVERY `#@` token, including failed
ones (missing/dir/error) and deduped repeats. PRD §6.2 + §10 require failed tokens to stay verbatim
WITH `#@`. Confirmed live: `Review #@a.ts and check #@missing.ts` → `Review a.ts and check missing.ts`
(`#@missing.ts` lost its `#@`). The single-failed-token case works (count===0 → original text), so the
bug only manifests in MIXED prompts.

## 3. CRITICAL — the substring approach is FORBIDDEN (empirically confirmed)

The bug report's simpler suggestion (`strippedText.replace(whole, whole.slice(2))` per injected match)
has a **substring-collision**: an injected match string can be a PREFIX of another token.
**Empirically verified** (Node, this environment):

```
text = "Review #@a.ts.bak and #@a.ts"   (#@a.ts.bak MISSING→failed; #@a.ts EXISTS→injected)
matches: "#@a.ts.bak"@7   "#@a.ts"@22   ; injected whole = "#@a.ts" @ idx 22

SUBSTRING approach: "Review a.ts.bak and #@a.ts"   ← CORRUPTED + BACKWARDS
  (failed #@a.ts.bak LOST its #@; injected #@a.ts KEPT #@)
INDEX-SPLICE fix:   "Review #@a.ts.bak and a.ts"   ← CORRECT
  (failed keeps #@; injected stripped)
```

`String.replace("#@a.ts", "a.ts")` matches the FIRST occurrence of the literal substring, which lands
INSIDE `#@a.ts.bak` (its prefix), corrupting the failed token and leaving the real injected token
un-stripped. The index-based splice removes characters only at precise recorded start positions → no
ambiguity. **Use the index-splice ONLY.**

## 4. Regex geometry — why `m.index` + slice(i, i+2) is exact (external_deps.md §2, VERIFIED)

`FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu`:
- Group 1 `(^|(?<!…))` is **ZERO-WIDTH** (consumes nothing).
- ⇒ `m.index` is EXACTLY the index of `#`, and `m[0]` is EXACTLY `#@<rawtoken>` (raw = before
  `cleanToken` trims trailing punctuation). `m[0].length === 2 + raw.length`.
- ⇒ removing exactly the 2 chars at `m.index` (chars `i` and `i+1`) drops exactly `#@`, leaving the
  raw token in place (e.g. `#@a.ts.` → `a.ts.`, matching the current "path stays, raw form preserved"
  behavior).

`matchAll` is NON-DESTRUCTIVE on the original `text`, so every `m.index` recorded during the loop is
valid for the ORIGINAL text. Splicing high→low (descending sort) keeps earlier offsets valid as we
mutate `strippedText`.

## 5. The 4 code edits (exact current anchors, post-S1)

### Edit A — declare injectedIndexes alongside the dedup set (after L192)
Insert between `const injectedThisRun = new Set<string>();` (L192, unique) and the main `for` loop.

### Edit B — push m.index at the empty-image success site (L225, after injectedThisRun.add)
`injectedIndexes.push(m.index);` immediately after the L225 `injectedThisRun.add(abs);` (before
`count++;`).

### Edit C — push m.index at the end-of-try success site (L266, after injectedThisRun.add)
`injectedIndexes.push(m.index);` immediately after the L266 `injectedThisRun.add(abs);` (before
`count++;`).

### Edit D — replace the blanket strip (L280) with the index-based splice
Replace `const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);` with:
```ts
let strippedText = text;
for (const i of [...injectedIndexes].sort((a, b) => b - a)) {
  strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
}
```
(L281 `const finalText = `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`;` is UNCHANGED — it
references `strippedText` which is now a `let`.) The `count===0` early-return (L278) is UNTOUCHED — it
already returns original text byte-for-byte.

## 6. Issue 1 × Issue 2 interaction (verified)

When the SAME path appears twice, Issue 1's dedup SKIPS the 2nd token (it does `continue` BEFORE any
push). Issue 2 strips `#@` only from tokens whose index was pushed (i.e. actually injected). ⇒ **the
deduped 2nd token keeps its `#@`** (it "did not inject"). Verified for `Compare #@a.ts with #@a.ts`:
first `#@a.ts` (idx pushed) → stripped to `a.ts`; second `#@a.ts` (deduped, NOT pushed) → keeps `#@`.
Result: `Compare a.ts with #@a.ts` + ONE `<file>` block. This is the literal reading of PRD §6.2 and
matches the bug report's intent. Add an explicit assertion (FS3).

## 7. Test impact — F2 asserts the BUG; 3 new cases

- **UPDATE F2** (test L636): currently asserts `r.text.startsWith('<!--file-injected--> Review a.ts')`
  (the failed sentinel token `<!--#@file-injected-->` LOST its `#@`). After the fix that token KEEPS
  `#@` → change to `r.text.startsWith('<!--#@file-injected--> Review a.ts')`, and fix the comment
  ("both #@ markers stripped" → "only the injected #@a.ts is stripped; the failed sentinel token keeps
  its #@"). F2's handler-level assert (`out.action === "transform"`) is UNCHANGED.
- **ADD FS1** (mixed success+missing): `Review #@a.ts and check #@missing.ts` →
  `r.text.includes("#@missing.ts")===true` AND `r.text.startsWith("Review a.ts")`.
- **ADD FS2** (mixed success+directory): `Review #@a.ts and list #@src/` → `r.text.includes("#@src/")===true`.
- **ADD FS3** (Issue1×Issue2): `Compare #@a.ts with #@a.ts` → `r.text.startsWith("Compare a.ts with #@a.ts")`
  AND exactly ONE `<file name="A_TS">` block AND `r.injected===1`.

**Risk scan (grep):** the ONLY other tests asserting a stripped prompt prefix are SINGLE-injected-token
prompts (case #1 L233, case #11/#12 region L707, PD L784) — those still strip correctly (the injected
token's index is pushed). Case #6 (directory, L296-298) is `count===0` → original text → UNCHANGED.
**No existing test other than F2 breaks.** Harness: 46 → **49 passed**.

## 8. Scope boundaries (what S2 must NOT do)

- ❌ Do NOT use the substring `text.replace(whole, whole.slice(2))` approach — it corrupts (§3).
- ❌ Do NOT touch Issue 1's dedup (S1 owns injectedThisRun/priorPaths) — S2 only ADDS index bookkeeping
  at the same 2 success sites and changes the strip line.
- ❌ Do NOT touch the notify wording (Issue 3, P1.M2.T1) or the paged directive offset (Issue 4,
  P1.M2.T2), the budget logic, the count===0 early-return, or any format helper.
- ❌ Do NOT change image/binary/paged handling — the index push lives at the 2 success sites, covering
  all branches uniformly.
- ❌ Do NOT edit README (P1.M3) or add a 3rd push site in the paged branch (it reaches the end-of-try
  count++, so the L266 push covers it — same as S1's add() reasoning).
- ✅ DO: Edit A (declare injectedIndexes), Edit B+C (push m.index at 2 sites), Edit D (index-splice
  strip), update F2, add FS1/FS2/FS3. Verify 49 passed + index-splice correctness.
