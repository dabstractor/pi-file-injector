# Research Notes — P1.M1.T1.S2 (plan/011): LR-5 — clamp the displayed range to the delivered range

> First-hand read of: the S1 PRP (contract), `architecture/code_map.md`, and the CURRENT (POST-S1) working tree:
> `emitText` L1292-1333 (the range branch with the full §5.5 decision — **S1 FULLY LANDED**, baseline 174 green),
> `sliceLines` L183-189, `FileDetail` L531-556, the LINE-1..6/LINE-8/LINE-8-MD tests (L2978-3090).
> S1's inline-arm comment literally says `// the REQUESTED range (LR-5 clamping is S2)` — my edit site is marked.

---

## 1. Starting state = POST-S1 (S1 is LANDED; baseline 174 green)

S1 (LANDED, verified in the tree): the range branch now runs the full §5.5 three-way decision (inline /
sub-head guard / paged with FILE-coordinate resume `startLine + headLines`). LINE-8 + LINE-8-MD exist and pass
(172 → 174). S1 deliberately kept `rangeSuffix` built from the **REQUESTED** `end` and marked the gap with two
comments: the inline detail push's `// the REQUESTED range (LR-5 clamping is S2)` and the paged push's
`// paged-resume display, NOT rangeSuffix (the requested range)`.

**S2 is the LR-5 fix**: build `rangeSuffix` from the DELIVERED range on the whole-slice paths. The paged path's
`:${resumeLine}-` display is UNTOUCHED (it is the resume directive, not a range display).

---

## 2. The current code (POST-S1 exact — the edit site)

```ts
  let rangeSuffix: string | undefined;
  if (startLine !== undefined) {
    const end = endLine ?? startLine;
    content = sliceLines(content, startLine, end);
    rangeSuffix = startLine === end ? `:${startLine}` : `:${startLine}-${end}`; // UI: read path:N / path:N-M   ← THE GAP (requested `end`)
    const fileCost = Math.ceil(content.length / 4);
    const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1;
    if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
      // INLINE (whole slice) — fits or budget unknown (O-1) …
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // the REQUESTED range (LR-5 clamping is S2)
      subtract(state, fileCost);
    } else if (content.length <= HEAD_CHARS) {
      // §5.5 sub-head guard — applied to the SLICE length …
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
      subtract(state, fileCost);
    } else {
      // LR-1 — PAGE the slice … (resumeLine = startLine + headLines)
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${resumeLine}-`, pagedHeadLines: headLines, directive: extractDirectiveInner(directiveBlock) }); // paged-resume display, NOT rangeSuffix (the requested range)
      …
    }
    return;
  }
```

**The one-line gap:** `rangeSuffix` uses the requested `end`; the whole-slice arms deliver a CLAMPED slice
(sliceLines clamps `end` past EOF) but display the requested range. `#@a.ts:2-100000` on a 5-line file
delivers lines 2–5 and displays `read a.ts:2-100000`.

---

## 3. Why `deliveredEnd = startLine + newlines-in-slice` is exact (the item's formula, verified)

`sliceLines` (L183-189):
```ts
const parts = content.split("\n");
if (parts.length > 0 && parts[parts.length - 1] === "" && content.endsWith("\n")) parts.pop();  // trailing \n ≠ extra line
if (startLine < 1 || startLine > parts.length) return "";
return parts.slice(startLine - 1, endLine).join("\n");   // ← JOIN with \n, NO trailing newline
```
The slice is `parts.slice(start-1, end).join("\n")` — for **L delivered lines, exactly L−1 internal newlines**
(no trailing \n from the join; the source trailing-\n was popped). ∴ last delivered line = `startLine + newlines`.
Also: `lineCount` in the detail = `newlines + 1` (non-empty), i.e. `deliveredEnd = startLine + lineCount − 1` —
BUT deriving from lineCount is WRONG for empty slices (lineCount=0 → start−1 ≠ start+0). Use the direct newlines
formula (the item's), which handles the empty slice as `deliveredEnd = startLine` (`:N` — the LR-4 case, T2.S3's
territory; S2 doesn't perturb it: today an empty slice also shows `:N` since startLine===end).

## 4. Behavior trace (POST-S2 vs POST-S1)

| Token | File | Slice | \n's | deliveredEnd | POST-S2 range | POST-S1 (today) | Gate |
|---|---|---|---|---|---|---|---|
| `:3` | a.ts (4 lines) | `}` | 0 | 3 | `:3` | `:3` | LINE-1 green ✓ |
| `:2-3` | a.ts | `return…` + `}` | 1 | 3 | `:2-3` | `:2-3` | LINE-2 green ✓ |
| `:2` (startLine===end) | any | 1 line | 0 | 2 | `:2` | `:2` | canonical (LR-7) ✓ |
| `:2-100000` | lr5_five.txt (5 lines) | `l2\nl3\nl4\nl5` | 3 | 5 | **`:2-5`** | `:2-100000` ✗ | **LINE-12 (THE FIX)** |
| `:4-100000` | a.ts (4 lines) | line 4 only | 0 | 4 | `:4` | `:4-100000` | clamp-to-single ✓ |
| `:1-999999` huge.log under PAGED_FIX | ~28k | paged path | — | — | `:${resumeLine}-` | same | LINE-8 green (untouched) |
| `:99` (past-EOF) | 5-line | `""` (empty) | 0 | 99 | `:99` | `:99` | unchanged (LR-4 = T2.S3) |

In-file ranges never clamp → LINE-1…6 expectations unchanged BY CONSTRUCTION (the item: "run them to confirm").

## 5. The edit (POST-S1 oldText → POST-S2 newText)

**Edit 1 — the rangeSuffix computation (one line → five):**
```ts
// oldText:
    rangeSuffix = startLine === end ? `:${startLine}` : `:${startLine}-${end}`; // UI: read path:N / path:N-M
// newText:
    // LR-5 (PRD §17.6) — the DISPLAYED range is the DELIVERED (clamped) range, not the requested one: sliceLines
    // joins L lines with L−1 newlines, so the last delivered line = startLine + newlines-in-slice. `:2-100000`
    // on a 5-line file delivers lines 2–5 and displays `:2-5` (display and delivery agree). Canonical (LR-7):
    // a single delivered line → `:N` (never `:N-N`).
    const deliveredEnd = startLine + (content.match(/\n/g)?.length ?? 0);
    rangeSuffix = startLine === deliveredEnd ? `:${startLine}` : `:${startLine}-${deliveredEnd}`; // UI: read path:N / path:N-M (clamped to the delivered range)
```
(`end` REMAINS used by the `sliceLines(content, startLine, end)` call — only the rangeSuffix source changes.)

**Edit 2 — the inline-arm comment (Mode A):**
```ts
// oldText:  … range: rangeSuffix }); // the REQUESTED range (LR-5 clamping is S2)
// newText:  … range: rangeSuffix }); // the DELIVERED (clamped) range (LR-5) — clamped only when the requested end passed EOF
```

**Edit 3 — the paged-arm comment (Mode A; the CODE is untouched):**
```ts
// oldText:  … directive: extractDirectiveInner(directiveBlock) }); // paged-resume display, NOT rangeSuffix (the requested range)
// newText:  … directive: extractDirectiveInner(directiveBlock) }); // paged-resume display `:${resumeLine}-`, NOT rangeSuffix (the delivered range)
```

**Edit 4 — FileDetail.range field comment (L536, Mode A):**
```ts
// oldText:  range?: string; // paged resume ":N-" OR user line range ":N" / ":N-M" (read-tool style)
// newText:  range?: string; // paged resume ":N-" OR the user line range ":N" / ":N-M" as DELIVERED (clamped when end > EOF, LR-5; read-tool style)
```

Do NOT touch: the LR-1 comment block (L1299-1304), the paged code, the sub-head arm's code, the emitText JSDoc
(L1292-1298 — S3 owns its rewrite), the whole-file branch, `sliceLines`, `claimKey`.

## 6. The LINE-12 test (TDD, RED first; formalized in P1.M2.T1.S2)

Per the PRD §17.9 gate table: "LINE-12 | LR-5 | `:2-100000` → `details[0].range === \":2-5\"`". Written NOW
with the LINE-12 name (the S1/LINE-8 precedent: "write it now (TDD, RED first); it becomes the formal gate there").

```js
await runCase("LINE-12", "LR-5: #@lr5_five.txt:2-100000 (5-line file) → range ':2-5' (display = delivered, clamped)", async () => {
  const five = path.join(TMPDIR, "lr5_five.txt");                       // UNIQUE inline fixture
  fsSync.writeFileSync(five, "l1\nl2\nl3\nl4\nl5\n");                    // exactly 5 lines (trailing \n ≠ extra line)
  const r = await mod.injectFiles("See #@lr5_five.txt:2-100000", [], FIX);
  assert(r.injected === 1, `one delivery, got ${r.injected}`);
  assert(r.text === "See #@lr5_five.txt:2-100000", "prompt verbatim (§6.4)");
  const d = r.details[0];
  assert(d.kind === "text", `kind 'text' (FIX = no budget → inline arm), got '${d.kind}'`);
  assert(d.range === ":2-5", `range must be the DELIVERED :2-5 (clamped from :2-100000), got ${JSON.stringify(d.range)}`);
  assert(d.lines === 4, `4 lines delivered (2–5), got ${d.lines}`);
  assert(hasBlock(r, "l2\nl3\nl4\nl5"), "body is lines 2–5");
  assert(!hasBlock(r, "l1\n"), "line 1 must be absent");
});
```
- **Placement**: after LINE-8-MD's closing `});` (the last LINE-* case; LINE-8-MD is at ~L3073).
- **RED** on POST-S1: `d.range` is `":2-100000"` → the `":2-5"` assertion fails. **GREEN** after Edit 1.
- FIX (no budget) → `remaining === null` → the INLINE whole-slice arm fires → the arm Edit 1 feeds. The paged
  arm's display is already gated by LINE-8 (`:${resumeLine}-`) — untouched.

## 7. Gate

- `npm run typecheck` → 0 errors (no signature/model changes; one local + one recomputed string).
- `node ./file-injector.test.mjs` → **175 passed** (174 + LINE-12), incl. LINE-1…6 + LINE-8/-MD unchanged.
- `node ./relative-imports.test.mjs` → 38; `node ./import-behavior.test.mjs` → 23 (untouched — no interface change).
- Total after S2: 175 + 38 + 23 = 236.

## 8. Scope discipline (what S2 does NOT do)

- No LR-1 changes (S1 landed; the paged path + its `:${resumeLine}-` display untouched).
- No LR-2/3/4 (T2: bare-claim, malformed notify, past-EOF handling — the empty-slice `:99` display is unchanged).
- No quadruple unification, no emitText JSDoc rewrite (S3).
- No formal-gate sweep (P1.M2.T1), no README (P1.M2.T2).
- No interface changes: `emitText(abs, content, state, startLine?, endLine?)` and `FileDetail` shapes unchanged.

## 9. Confidence: 10/10

A one-line semantic change (requested `end` → computed `deliveredEnd`) + 3 comment touches + 1 TDD test, with
the formula proven exact against `sliceLines`' join semantics (L lines → L−1 newlines), every affected path
traced (in-file ranges byte-identical; the paged path untouched; the empty slice unperturbed), and S1's own
inline marker (`// the REQUESTED range (LR-5 clamping is S2)`) pinning the edit site. -0: the RED→GREEN is
deterministic (today `:2-100000`, after `:2-5`), and LINE-1…6/LINE-8 stay green by construction.