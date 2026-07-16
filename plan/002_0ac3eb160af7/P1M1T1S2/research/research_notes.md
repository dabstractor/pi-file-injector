# Research Notes — P1.M1.T1.S2 (Budget computation + inline-vs-paged decision branch)

Scope: implement PRD §5.5's budget-aware inline-vs-paged decision in `injectFiles`
(`./file-injector.ts`), and add paged-delivery tests to `./file-injector.test.mjs`. Consumes S1's
scaffold (5 constants + `formatPagedDirectiveBlock` + widened ctx/return types + `paged: 0` returns),
which is **CONFIRMED already in the file (348 lines)**.

---

## 1. S1 scaffold — CONFIRMED IN PLACE (the contract S2 builds on)

`grep`/read of the current `file-injector.ts` confirms S1 is fully implemented:

| S1 artifact | Location | State |
|---|---|---|
| `PAGED_THRESHOLD=0.6`, `MARGIN=8192`, `HEAD_BYTES=8192`, `DEFAULT_WINDOW=200000`, `DEFAULT_RESERVE=8192` | lines 20-25 (after `TRAILING_PUNCT` L17) | ✅ present |
| `export function formatPagedDirectiveBlock(abs, totalBytes)` | line 126 | ✅ exported, **uncalled** (S2 calls it) |
| widened `ctx` type: optional `getContextUsage?: () => ({tokens:number\|null; contextWindow:number; percent:number\|null}\|undefined)`, optional `model?: {contextWindow:number; maxTokens:number}\|undefined` | injectFiles signature (~L140-146) | ✅ present |
| return type `Promise<{text; images; injected; paged}>` | same | ✅ present |
| early return `{..., injected:0, paged:0}` | line 234 | ✅ present (S2 leaves as literal `0`) |
| final return `{..., injected:count, paged:0}` | line 242 | ⬜ S2 changes `paged:0` → `paged` |

S1's `paged` is a **hardcoded 0** everywhere. S2 introduces `let paged`, the budget computation, the
inline-vs-paged branch, calls `formatPagedDirectiveBlock`, and returns the computed `paged`.

## 2. The 3 code edits (exact current anchors, post-S1)

### Edit A — budget computation + `let paged` (after `let count = 0;` at line 154)
Insert immediately after `  let count = 0;` (unique) and before the `// PRIOR-INJECTION SET` comment
block. Adds `let paged = 0;` and the ONCE-per-prompt budget computation wrapped in try/catch.

### Edit B — inline-vs-paged branch (replace line 224)
The single line `blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)`
(inside the text `else` sub-branch) becomes the budget-aware branch. Hoist `content = buf.toString("utf8")`.

### Edit C — final return (line 242)
`return { text: finalText, images, injected: count, paged: 0 };` → `paged` (the variable).
The early return (line 234) stays `paged: 0` literal (see §4).

## 3. Budget computation — VERIFIED against installed Pi (pi_api_verification.md)

VERIFIED facts (all from `pi_api_verification.md` + `system_context.md §2`):
- `ctx.getContextUsage()` returns `ContextUsage | undefined`. Must null-check the WHOLE result.
- `ContextUsage = { tokens: number | null; contextWindow: number; percent: number | null }`.
  `tokens` is nullable ("unknown right after compaction") — null-check `.tokens` too.
- `ctx.model` is `Model | undefined`; `Model.contextWindow` and `Model.maxTokens` are REQUIRED numbers.
- `estimateTokens` (exported) takes `AgentMessage`, NOT a string → no string estimator. Use
  `fileCost = Math.ceil(content.length / 4)` (O-3 heuristic, matches faux provider).
- `read` tool `DEFAULT_MAX_LINES = 2000` → confirms `HEAD_BYTES = 8192` ≈ 2000 lines.

**Item-authoritative formula** (NOTE: differs slightly from PRD §5.5 pseudocode — the ITEM is the
contract; it reads `usage.contextWindow`, NOT `ctx.model?.contextWindow`):

```ts
let remainingBudget: number | null;
try {
  const usage = ctx.getContextUsage?.();
  if (usage === undefined || usage.tokens === null) {
    remainingBudget = null;                       // O-1 fallback → inject WHOLE
  } else {
    const window  = usage.contextWindow;          // from the live ContextUsage, not ctx.model
    const used    = usage.tokens;
    const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
    remainingBudget = Math.max(0, window - used - reserve - MARGIN);
  }
} catch {
  remainingBudget = null;                         // getContextUsage threw → O-1 fallback (§12.5)
}
```

**`DEFAULT_WINDOW` is declared by S1 but UNUSED by S2** — the O-1 fallback path (usage undefined /
tokens null) sets `remaining = null` rather than substituting a default window. This is intentional:
"budget unknown → always inject whole (current behavior)". DEFAULT_WINDOW remains a pinned spec
constant for documentation/future use; do NOT delete it and do NOT wire it in.

## 4. count semantics — guard stays `if (count === 0)` (PD-1 rule 3)

The item (3c) + `system_context.md §7` are AUTHORITATIVE: **`count++` (line 227, was 202) is
UNCHANGED** — it counts ALL delivered files (whole AND paged). `paged++` happens only inside the
text paged sub-branch, which is inside the same `try` that does `count++`. Therefore:

> **paged <= count always ⟹ count===0 ⟹ paged===0**

So the early-return guard **stays `if (count === 0)`** (NOT `count === 0 && paged === 0`), and the
early return legitimately hardcodes `paged: 0` (literal). This is CLEANER than the
`implementation_insertion_points.md §3` / S1-PRP speculation (which floated `count === 0 && paged ===
0`); the item + system_context override that. (S1's Level-1 gate 1f checked `let paged` is ABSENT —
that gate was S1-only; after S2 `let paged` is expected and S2's gates supersede it.)

`injected` = whole + paged; `paged` = paged subset; `whole = injected - paged` (S3 computes this for
the mode-aware notify).

## 5. Empirically verified branch outcomes (Node sim, this environment)

Constants: PAGED_THRESHOLD=0.6, MARGIN=8192, HEAD_BYTES=8192, DEFAULT_RESERVE=8192.

```js
const PAGED_FIX = { cwd:"/x",
  getContextUsage:()=>({tokens:10000,contextWindow:50000,percent:20}),
  model:{contextWindow:50000,maxTokens:8192} };
const FIX = { cwd:"/x" };                      // existing test mock — NO budget
```
| Input | ctx | remaining | fileCost | PAGED_THRESHOLD×remaining | Result |
|---|---|---|---|---|---|
| huge.log (2097152 B) | PAGED_FIX | 23616 | 524288 | 14169.6 | **PAGED** (head 8192 + directive) |
| a.ts (97 chars) | PAGED_FIX | 23616 | 25 | 14169.6 | **WHOLE** |
| huge.log (2097152 B) | FIX | null | — | — | **WHOLE** (O-1 fallback) |
| multi: a.ts then huge.log | PAGED_FIX | 23616→23592 | — | — | a.ts WHOLE, huge.log **PAGED**; injected=2, paged=1 |
| multi: huge.log then a.ts | PAGED_FIX | 23616→21568 | — | — | huge.log **PAGED**, a.ts WHOLE; injected=2, paged=1 |

**Critical regression guarantee:** under `FIX` (no `getContextUsage`), `remaining === null` → the
`if (remainingBudget === null || ...)` short-circuits to the INLINE branch for ANY file size. So
existing case #2 (huge.log byte-for-byte whole) is **unchanged** and still passes.

## 6. Test harness — current baseline + new cases needed

Baseline: `node ./file-injector.test.mjs` → **34 passed, 0 failed** (run on this machine). The harness
imports the REAL `file-injector.ts` via jiti (aliased to the global Pi package); fs and resizeImage are
NOT mocked (real temp fixtures). `FIX = { cwd: TMPDIR }` (line 213) is the budget-less mock all
existing cases use → O-1 fallback → whole injection.

**New paged-delivery tests (S2's scope — no separate P1.M2 in this plan):** add a budget-aware mock
`PAGED_FIX` (right after `FIX`, line 213) and 5 new `runCase` blocks in a new "PAGED DELIVERY" section
inserted before the `// 10. Summary + cleanup + exit.` block (line 741). Cases:

1. **P1 — paged single**: huge.log under PAGED_FIX → injected=1, paged=1; text has head block
   `<file name="HUGE">\n` + `HUGE_LOG_CONTENT.slice(0,8192)` + `\n</file>`; text has directive
   `mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length)`; `#@huge.log` stripped to `huge.log`;
   `r.images` length 0.
2. **P2 — multi-file mixed**: `#@a.ts and #@huge.log` under PAGED_FIX → injected=2, paged=1; a.ts whole
   block present; huge.log head+directive present.
3. **P3 — O-1 fallback (explicit paged field)**: huge.log under FIX → injected=1, paged=0, whole block
   present (NOT paged). [Complements case #2's byte-equality; asserts the `paged` field directly.]
4. **P4 — images unaffected by budget**: pic.png under PAGED_FIX → injected=1, paged=0, image attached
   (images.length===1). [Budget branch is text-only.]
5. **P5 — binaries unaffected by budget**: data.bin under PAGED_FIX → injected=1, paged=0, binary note
   block present. [Budget branch is text-only.]

Harness count: 34 → **39 passed** (5 new runCase blocks; integration cases unchanged).

`PAGED_FIX` (item-authoritative example):
```js
const PAGED_FIX = {
  cwd: TMPDIR,
  getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }),
  model: { contextWindow: 50000, maxTokens: 8192 },
};
```

## 7. Dedup-vs-paging — NON-ISSUE (system_context §5)

The prior-injection dedup (`priorPaths` set, built BEFORE the loop by scanning INPUT text's existing
`<file name="…">` blocks) operates on the INPUT `text`, NOT the local `blocks[]` array. The paged
head+directive blocks are pushed to `blocks[]` and only appended to `finalText` AFTER the loop — they
never feed back into `priorPaths`. Each `#@path` is matched once by `matchAll`. **No collision.** (Do
not touch the dedup logic.)

## 8. Scope boundaries (what S2 must NOT do)

- ❌ Do NOT change the handler notify / factory JSDoc / destructure `paged` in the handler — **S3**.
- ❌ Do NOT change the early-return guard to `count === 0 && paged === 0` — it stays `count === 0`
  (count===0 ⟹ paged===0).
- ❌ Do NOT touch the dedup logic, regex, image path, binary path, F3/F5/F4, cleanToken, or any helper.
- ❌ Do NOT wire `DEFAULT_WINDOW` into the budget (the O-1 fallback uses `null`, not a default window).
- ❌ Do NOT edit README (P1.M1.T2) or the module-surface sanity check (S1 already added
  formatPagedDirectiveBlock there).
- ❌ Do NOT change `count++` placement or semantics (counts all delivered; paged is a subset).
- ✅ DO make exactly: Edit A (budget+paged), Edit B (branch), Edit C (final return `paged`); add
  PAGED_FIX + 5 runCase blocks. Then verify 39 passed.
