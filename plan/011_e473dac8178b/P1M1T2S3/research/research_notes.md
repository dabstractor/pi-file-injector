# Research Notes — P1.M1.T2.S3 (plan/011): LR-4 — past-EOF start is a failed token

All facts verified first-hand against the working tree at **HEAD `cec5f1d`** (LR-2 landed) **plus T2.S2's
landed LR-3 edits** (splitLineRange `invalid: true`, scanTokens `invalidRange`, the processTokenStream
warning branch — all present in the tree; gate GREEN at **177 passed, 0 failed**).
Repo: `/home/dustin/projects/pi-file-injector`.

---

## 1. Dependency state (verified)

| Dependency | Status | Evidence |
|---|---|---|
| T1.S1/S2/S3 (LR-1 + LR-5 + unified emitText) | **Complete/committed** (`f2d33dc`, `a5d0f5f`, `d954487`) | emitText L1346 has the LR-1 range branch + LR-5 clamped display; `emitWholeText` is the single whole-delivery helper |
| T2.S1 (LR-2 claim-by-classification) | **Complete/committed** (`cec5f1d`) | injectFile F5/image/binary branches carry the `if (key !== abs) { … delete(key); return false; }` guards (L1265/L1280/L1303) |
| T2.S2 (LR-3 malformed-range notify) | **LANDED in tree** | splitLineRange returns `{path: token, invalid: true}`; scanTokens pushes `{path: token, invalidRange: true}`; processTokenStream fires the warning; LINE-10 at test L3137; count 177 |

**Baseline: `node file-injector.test.mjs` → 177 passed, 0 failed.** LINE-7/LINE-11 are the only absent
gates (LINE-7 is P1.M2.T1.S1's; **LINE-11 is THIS task's**).

## 2. The verified bug (today's behavior for `#@a.ts:99` on a 4-line file)

1. `scanTokens` (L1147-1198): exact resolve of `a.ts:99` fails → `splitLineRange` VALID (`:99`) →
   resolve `a.ts` → rec `{path: A_TS, startLine:99, endLine:99}`; **dedup keys on the CLAIM key**
   (`claimKey(abs, s, e)` — L1182: `if (state.injectedSet.has(key) || localSeen.has(key)) continue`), so
   `a.ts:99` and `a.ts:1` are DISTINCT records/keys (`abs:99` vs `abs:1`). ✓ (the item's ordering premise holds)
2. `processTokenStream` (L1210-1226): belt-check `injectedSet.has(abs:99)`? no → `injectFile(abs, …, 99, 99)`.
3. `injectFile` (L1253): stat ✓ → **claim `abs:99`** (L1272-1273) → read → text branch (L1324) → `emitText(abs, content, state, 99, 99)`.
4. `emitText` range branch (L1356): `content = sliceLines(content, 99, 99)` → `""` (99 > 4 parts);
   `deliveredEnd = 99 + 0` → `rangeSuffix = ":99"`; `fileCost = 0 ≤ PAGED_THRESHOLD·remaining` →
   `emitWholeText(abs, "", state, ":99")` → **pushes an EMPTY `<file>` block + a `kind:"text"` detail
   (lines: 0)**; subtract(0).
5. Back in injectFile: **`state.count++` (L1326) → `injected:1`**; the `abs:99` claim STAYS POISONED.

= the verified LR-4 gap (PRD §6/§10): empty block, injected=1, claim poisoned, zero feedback.

**The markdown twin:** `injectFile`'s MD branch (L1310-1317) → `injectMarkdown(abs, content, …, 99, 99)`
(L1481): `body = sliceLines(content, 99, 99)` = `""` → `scanTokens("")` → no imports → Step 4
`emitText(abs, content, state, 99, 99)` (L1496 — passes FULL content + range; emitText re-slices) → same
empty-block bug, then `state.count++`. **Both call paths must fail.**

## 3. THE CRITICAL DESIGN FINDING — the failure predicate is `startLine > lineCount`, NOT `slice === ""`

`sliceLines` returns `""` in **two** different situations:

| Input | sliceLines result | Meaning |
|---|---|---|
| `sliceLines("l1\n…\l5", 99, 99)` | `""` | **past-EOF** (99 > 5 parts) — must FAIL (LR-4) |
| `sliceLines("a\n\nb", 2, 2)` | `""` | **a LEGITIMATE empty line** (line 2 exists, is empty) — must DELIVER |

So an emit-side `slice === ""` check (the item's seam option (a)) would **false-fail every range that
selects genuinely empty lines**. The correct predicate — the item's own option (b) — is
**`startLine > lineCount(content)`** computed BEFORE emission, where `lineCount` uses the SAME
trailing-newline ("wc -l") semantics as sliceLines. **Seam decision: option (b).**

### Why option (b) over option (a) — the full reasoning

1. **Correctness first:** only the lineCount predicate distinguishes past-EOF from empty-line slices; the
   check needs the FULL content's line count, which both injectFile branches have (the buffer) — emitText's
   post-slice view cannot express it without re-counting anyway.
2. **No signature churn:** option (a) needs `emitText` (EXPORTED, unit-tested) → `boolean` AND
   `injectMarkdown` (private) → `boolean` (its Step-4 emitText failure must propagate to injectFile so
   count++ is skipped). Option (b) needs ZERO signature changes: injectFile already holds `ctx` (the
   notify), `key` (the claim to revoke), and the buffer (the count).
3. **The item names exactly these two sites:** "(b) injectFile's text branch AND injectMarkdown's ranged
   path pre-check" — but with the check hoisted into **injectFile's markdown branch (before calling
   injectMarkdown)**, injectMarkdown needs NO change at all (it is the only ranged entry into
   injectMarkdown; guarding the caller covers it).

### The countLines helper — and the 0-byte special case (the second trap)

Mirroring sliceLines' parts computation naively is WRONG for the empty file:

```ts
"".split("\n")            // → [""]  → length 1 (no pop: "".endsWith("\n") is false)
```

So a parts-mirror says a 0-byte file has **1** line — but the spec (PRD §4 "Empty/edge slices" + §8 edge
row `#@empty.txt:1`) says a 0-byte file has **0** lines and `:1` is past-EOF. The helper needs the explicit
empty-file case:

```ts
export function countLines(content: string): number {
  if (content.length === 0) return 0;                 // 0-byte file → 0 lines (wc -l; PRD §17.4)
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}
```

Verified against every spec case: `""`→0, `"a"`→1, `"a\n"`→1 (trailing \n ≠ extra line), `"a\nb"`→2,
`"l1\n…\nl5\n"`→5, A_TS_CONTENT (4 lines, trailing \n)→4. For NON-empty content this is IDENTICAL to
sliceLines' internal parts.length (pop iff endsWith "\n") — the only divergence is `""` (parts=1, count=0),
and the divergence is moot at runtime because the upstream check fails before sliceLines ever runs.

## 4. The two edits + one helper (exact anchors, current tree)

**Edit A — new exported `countLines`** (place immediately after `sliceLines`, ends L188).
Export requires: a typeof sanity assert (after the sliceLines assert, test L118) + `"countLines"` added to
`ASSERTED_EXPORTS` (test L143-148) — otherwise the surface-sync check at L150-156 FAILS
("module ships functions not in the sanity list").

**Edit B — new private `turnAwayPastEof(abs, key, state, ctx, startLine, endLine, lineCount): false`**
(place near injectFile): deletes the claim key (`claim ⟺ delivered`, mirroring the catch at L1329-1331) +
hasUI-guarded `ctx.ui?.notify(…, "warning")` + `return false` (so injectFile skips `state.count++`).

**Edit C — injectFile, markdown branch (L1310-1317).** Current tail:
```ts
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx, startLine, endLine);
```
→ hoist `const mdContent = buf.toString("utf8");`, guard
`if (startLine !== undefined && startLine > countLines(mdContent)) return turnAwayPastEof(…);`, then
`await injectMarkdown(abs, mdContent, …)`.

**Edit D — injectFile, text branch (L1323-1326).** Current:
```ts
      emitText(abs, buf.toString("utf8"), state, startLine, endLine);
```
→ same shape: hoist `const txtContent`, guard, then `emitText(abs, txtContent, …)`.

`emitText`, `emitWholeText`, `injectMarkdown`, `scanTokens`, `processTokenStream`, `splitLineRange`,
`sliceLines`, the F5/image/binary branches (T2.S1's), the LR-3 trio (T2.S2's) — ALL UNTOUCHED.

## 5. The notify message — decided form

The item says "token shown as typed", but the typed token is NOT plumbed to the inject layer: injectFile
receives `abs` (scanTokens resolves before pushing records), and processTokenStream's `rec.path` is
likewise the resolved abs. Threading the raw token would break injectFile's EXPORTED signature. **Decided
form (unambiguous, consistent with the `<file name="abs">` convention and the canonical range keys):**

```
#@${abs}${startLine === (endLine ?? startLine) ? `:${startLine}` : `:${startLine}-${endLine}`} — not injected (file has ${n} lines)
```

- Canonical range (`:N`, never `:N-N`) — matches claimKey + LR-5 display.
- Em dash U+2014; type `"warning"` (NOT "info" — §6 LR-4 + LINE-10's precedent).
- hasUI-guarded (`if (ctx.hasUI) ctx.ui?.notify(…)`) — headless-safe, mirrors L956/L1219.
- LINE-11 pins it exactly: `` `#@${five}:99 — not injected (file has 5 lines)` `` (five = the abs).

## 6. Ordering / claim-release analysis (item §4's verification demand)

Prompt `#@five.txt:99 then #@five.txt:1` (5-line file):
1. scanTokens: rec1 key `abs:99`, rec2 key `abs:1` — BOTH recorded (distinct keys; §1 above).
2. rec1 → injectFile: claim `abs:99` → LR-4 guard trips → `turnAwayPastEof` **deletes `abs:99`** (synchronous,
   before injectFile returns) → notify → `return false` → **no count++**.
3. rec2 → belt-check `injectedSet.has(abs:1)`? no → injectFile: claim `abs:1` → slice line 1 → deliver → count++.

Result: `injected:1`, line 1 delivered, exactly ONE warning. The revoke happens strictly before later
records process (single-threaded await chain), and the belt-and-suspenders re-check tolerates the released
key by construction (`has(abs:99)` → false). A poisoned claim (no revoke) would only bite a LATER
`#@five.txt:99` re-encountered via a markdown import scan (injectMarkdown's scanTokens consults
`state.injectedSet`) — the revoke fixes that too (claim ⟺ delivered).

## 7. Test plan (LINE-11 + LINE-4 extension + sanity/surface)

- **Sanity list** (L118, after sliceLines): `assert(typeof mod.countLines === "function", …)`; **ASSERTED_EXPORTS**
  (L143-148): add `"countLines"`.
- **LINE-4 extension** (in place, L3019-3029): +4 unit asserts pinning countLines: `""`→0, `"a"`→1,
  `"a\n"`→1, `"l1\n…l5\n"`→5.
- **LINE-11** (after LINE-10, ~L3160; mirrors LINE-10's inline spy ctx `{ cwd: TMPDIR, hasUI: true,
  ui: { notify: (m,t) => notes.push({m,t}) } }` as injectFiles' 3rd param):
  - (a) text positive: `#@lr4_five.txt:99` (inline 5-line fixture `"l1\nl2\nl3\nl4\nl5\n"`) →
    `injected:0`, verbatim, `blocks.length===0 && details.length===0`, ONE warning
    `` `#@${five}:99 — not injected (file has 5 lines)` ``.
  - (b) claim-release: `#@lr4_five.txt:99 then #@lr4_five.txt:1` → `injected:1`, hasBlock("l1\n"),
    exactly 1 notify (the :99).
  - (c) markdown path: inline `lr4.md` = `"m1\nm2\n"` → `#@lr4.md:3` → injected:0, no block, ONE warning
    `` `#@${md}:3 — not injected (file has 2 lines)` ``.
  - (d) clamped-END negative: `#@lr4_five.txt:2-100000` → DELIVERS l2-l5, NO notify.
  - (e) 0-byte edge: `#@empty.txt:1` (existing EMPTY fixture) → injected:0, no block, warning
    `(file has 0 lines)`.
  - (f) boundary: `#@lr4_five.txt:5` (start == lineCount) → DELIVERS line 5, NO notify (no off-by-one).
  - Inline fixtures `lr4_five.txt` + `lr4.md` written in-body, rmSync'd in `finally` (LINE-10/LINE-12 style).

## 8. Regression surfaces checked

- LINE-1/2/3/6/8/8-MD/12: all deliver VALID ranges (start ≤ count) — the guard never trips. ✓
- E1 (`#@empty.txt`, whole): startLine undefined → guard skipped → whole empty-file delivery unchanged. ✓
- LINE-9 (LR-2): image/binary branches untouched — the guard lives in text/markdown branches only;
  `#@pic.png:99` never reaches it (range ignored for images/binaries by classification order). ✓
- LINE-10 (LR-3): scan-level invalid ranges never reach injectFile (processTokenStream continues first). ✓
- No existing test pins the OLD empty-block past-EOF behavior (grepped: no `:99`/`empty.txt:1` cases). ✓

## 9. Gates

- `npm run typecheck` → 0 errors (additive helper + two guards; no signature changes).
- `node ./file-injector.test.mjs` → **178 passed** (177 + LINE-11; LINE-4 extended in place), 0 failed.
- `npm test` → 4 files green (import-behavior / relative-imports / url-injection untouched).
- `git diff --stat` → file-injector.ts + file-injector.test.mjs only; the .ts hunks confined to
  countLines (new) + turnAwayPastEof (new) + injectFile's markdown/text branches. NOT: emitText,
  emitWholeText, injectMarkdown, the LR-3 trio (T2.S2's), the F5/image/binary branches (T2.S1's).