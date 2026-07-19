# Research Notes — P1.M1.T2.S1: Add REND-MULTI-OFFSET unit test (computeDetailOffsets, multiple crafted blocks)

> Test-only subtask. Adds ONE regression case (`REND-MULTI-OFFSET`) to `file-injector.test.mjs` that crafts two
> `<file>` blocks directly (no file I/O), calls `mod.computeDetailOffsets`, and asserts BOTH files' bodies slice
> correctly from the assembled `content`. This is the minimal test that would have caught the SEP bug (P1.M1.T1.S1)
> — the existing single-block `REND-OFFSET` has zero drift; this multi-block sibling exposes the +2/block drift.

## 1. T1.S1 contract (the fix being locked in) — confirmed via its PRP

T1.S1 (parallel, "Implementing") fixes `computeDetailOffsets`'s `SEP` literal: `"\\n\\n"` (4-char, the bug) →
`"\n\n"` (2-char, matching the real `blocks.join("\n\n")` assembly at L1286). After T1.S1:
- `SEP.length === 2` → `starts[i]` is the true absolute offset of block `i`.
- `details[i].contentStart = starts[i] + headerLen` is correct for EVERY file (not just the first).
- `content.slice(contentStart, contentStart + contentLen)` returns the exact body.

T2.S1's test PASSES after T1.S1 and WOULD FAIL before it (`details[1]` slices wrong bytes — drift +2). The test
is the behavioral proof T1.S1 defers ("the multi-file proof is T2's job").

**No file conflict:** T1.S1 edits `file-injector.ts` (the SEP literal + 2 docstrings). T2.S1 edits
`file-injector.test.mjs` (appends one `runCase` block). Disjoint files.

## 2. The exact insertion point + infrastructure (verified first-hand)

**The sibling template — `REND-OFFSET` (file-injector.test.mjs L2728-2745):**
```js
await runCase("REND-OFFSET", "offset tier: detail with contentStart/contentLen (no body) renders the exact slice incl. nested </file> (§12.22)", async () => {
  const fullBody = "a</file>b";
  const block = '<file name="/abs/o.ts">\n' + fullBody + '\n</file>';
  const content = block;                           // single block → content === block
  const headerLen = '<file name="/abs/o.ts">\n'.length;
  const contentStart = headerLen;
  const contentLen = fullBody.length;
  const msg = { details: { files: [{ path: "/abs/o.ts", kind: "text", contentStart, contentLen }] }, content };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const bodyChild = textOf(expanded.children[expanded.children.length - 1]);
  assert(bodyChild.includes("a</file>b"), `... got ${JSON.stringify(bodyChild.slice(0, 80))}`);
});
```

**The infrastructure (all already defined in the renderer-test section, ~L2557-2567):**
- `runCase(name, desc, async fn)` — the harness (tallies passed/failed; `assert(cond, msg)` throws on fail).
- `mod` — the jiti-loaded module (has `computeDetailOffsets` at L353 + `renderInjectedMessage` at L742, both exported).
- `REND_THEME = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t }` — identity theme (no ANSI codes; raw text).
- `REND_W = 2000` — generous render width (no wrapping).
- `textOf = (child) => child.render(REND_W).join("\n")` — render a child to a string.

**The expanded-Box layout for N text files** (from regression_test_design.md, confirmed by REND-6/REND-PAGED-DIR):
`[0]` read line file 0 (+ expand hint), `[1]` body file 0, `[2]` read line file 1, `[3]` body file 1, ...
→ **body children at ODD indices (1, 3, 5, ...).**

**Insertion point:** Place `REND-MULTI-OFFSET` **right AFTER the `REND-OFFSET` block's closing `});`** (~L2745)
and BEFORE the `REND-PAGED-DIR` comment block (~L2747). It's a direct sibling extension of REND-OFFSET from
single-block to multi-block. (Item §1: "Place this test right AFTER the existing REND-OFFSET test block.")

## 3. The exact test (per item §3 + regression_test_design.md "Minimal Unit Test Alternative")

```js
// REND-MULTI-OFFSET — §12.22 offset tier, MULTI-BLOCK (the gap that let the SEP bug ship). REND-OFFSET uses a
// SINGLE block (starts[0]===0, drift zero); this sibling crafts TWO blocks so details[1].contentStart depends on
// SEP.length matching the real join separator. Pre-T1.S1 (SEP="\\n\\n", length 4 vs join "\n\n" length 2),
// details[1] slices "nction b()..." (drift +2 — missing "fu", trailing garbage). Post-T1.S1 it slices the exact
// body. Also renders expanded and asserts each body child (odd indices 1 and 3) carries the correct content.
await runCase("REND-MULTI-OFFSET", "§12.22 multi-block offset tier: computeDetailOffsets + expanded render — EACH file's body is exact (the +2/block drift regression)", async () => {
  const block0 = '<file name="/abs/a.ts">\nfunction a() { return 1; }\n</file>';
  const block1 = '<file name="/abs/b.ts">\nfunction b() { return 2; }\n</file>';
  const blocks = [block0, block1];
  const content = blocks.join("\n\n");              // the real assembly (L1286) — 2-char separator
  const details = [{ path: "/abs/a.ts", kind: "text" }, { path: "/abs/b.ts", kind: "text" }];
  mod.computeDetailOffsets(blocks, details);       // populates contentStart/contentLen (mutates details in place)
  // (a) FIRST file — correct even pre-fix (starts[0]===0). Pins the baseline.
  assert(content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen) === "function a() { return 1; }",
    `a.ts offset slice is exact (starts[0]===0, drift zero even pre-fix), got ${JSON.stringify(content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen))}`);
  // (b) SECOND file — THE regression assertion. Pre-T1.S1 (SEP.length 4): drift +2 → "nction b() { return 2; }\n<".
  //     Post-T1.S1 (SEP.length 2): exact body. This is the line that FAILS before the fix and PASSES after.
  assert(content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen) === "function b() { return 2; }",
    `b.ts offset slice is exact (NO +2 drift — SEP.length must match the join separator), got ${JSON.stringify(content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen))}`);
  // (c) END-TO-END through the renderer: expanded view, each body child (odd indices 1 and 3) carries the content.
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const bodyA = textOf(expanded.children[1]);       // [0]=read a.ts, [1]=body a.ts
  const bodyB = textOf(expanded.children[3]);       // [2]=read b.ts, [3]=body b.ts
  assert(bodyA.includes("function a() { return 1; }"),
    `expanded body child [1] (a.ts) carries the exact content, got ${JSON.stringify(bodyA.slice(0, 80))}`);
  assert(bodyB.includes("function b() { return 2; }"),
    `expanded body child [3] (b.ts) carries the exact content (NO drift), got ${JSON.stringify(bodyB.slice(0, 80))}`);
});
```

## 4. Why this catches the bug (the drift arithmetic)

`computeDetailOffsets` builds `starts[]` via `off += b.length + SEP.length`. With the buggy `SEP = "\\n\\n"`
(length 4) vs the real join `"\n\n"` (length 2):
- `starts[0] = 0` (correct — no drift for the first block).
- `starts[1] = block0.length + 4` but the REAL offset of block1 in `content` is `block0.length + 2` →
  `details[1].contentStart` is **+2 too large**.
- `content.slice(details[1].contentStart, ...)` then starts 2 chars late → misses `"fu"` and reads 2 chars into
  the next block's header (`"\n<"`).

Assertion (b) — `content.slice(details[1].contentStart, ...) === "function b() { return 2; }"` — FAILS pre-fix
(gets `"nction b() { return 2; }\n<"`) and PASSES post-fix. That's the regression catch.

Assertion (a) PASSES both pre- and post-fix (`starts[0] === 0` regardless of SEP.length) — it's the baseline
that confirms the test harness is wired correctly (if (a) failed, the test itself is malformed, not the bug).

## 5. `computeDetailOffsets` mutates `details` in place (verified at L353)

The function signature is `computeDetailOffsets(blocks, details): FileDetail[]` but it MUTATES the passed
`details` array's elements (sets `contentStart`/`contentLen` on each). The item §3d says "Calls
`mod.computeDetailOffsets(blocks, details)` to populate contentStart/contentLen" — so the test reads
`details[0].contentStart` AFTER the call. The return value is the same (mutated) array; either reading works.
This matches the real `before_agent_start` usage at L1282: `computeDetailOffsets(blocks, details);` (return
discarded; the passed `details` is then stashed in the message).

## 6. The test count increment

The harness tallies `passed`/`failed` via `runCase`. Adding ONE `runCase` block increments the total by 1.
Post-T1.S1 + T2.S1: the suite goes from 156 → 157 passed (file-injector.test.mjs); the other two suites (38 + 23)
are untouched. The final `Result: N passed, 0 failed.` line reflects the +1.

## 7. Coordination / no-conflict

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Implementing, parallel) | file-injector.ts SEP literal + 2 docstrings | T2.S1's test PASSES after S1; WOULD FAIL before. No file conflict (S1=source; T2.S1=test). |
| P1.M1.T2.S2 (Planned) | REND-MULTI-E2E integration test (real handler chain: captureAllHandlers → input → before_agent_start → render) | Complementary: T2.S1 is the minimal UNIT test (crafts blocks directly, no I/O); T2.S2 is the full E2E through the handlers. Both land in file-injector.test.mjs but at different sites (T2.S1 after REND-OFFSET; T2.S2 likely near DELIV-/REND-11). No collision if T2.S2 uses a distinct name (REND-MULTI-E2E). |
| P1.M1.T3.S1 (Planned) | README review | Different file. No conflict. |

**Critical no-conflict:** T2.S1 appends ONE `runCase` block after REND-OFFSET (~L2745). It uses only existing
infrastructure (`runCase`, `assert`, `mod`, `REND_THEME`, `REND_W`, `textOf`) — no new helpers, no new fixtures,
no file I/O. The name `REND-MULTI-OFFSET` is distinct from every existing case.

## 8. Validation approach

The gate is `node ./file-injector.test.mjs` → `<baseline + 1> passed, 0 failed` (the new case prints ✓).
**IMPORTANT sequencing:** T2.S1's test PASSES only after T1.S1 (the SEP fix) lands. If T1.S1 hasn't landed,
REND-MULTI-OFFSET FAILS (assertion (b) gets the drifted slice) — that's the designed RED-then-GREEN signal
(item §4: "would FAIL before the SEP fix and PASSES after it"). The implementing agent should:
1. Confirm T1.S1 has landed (`grep 'const SEP' file-injector.ts` → `"\n\n"` single-backslash).
2. Add the test.
3. Run `node ./file-injector.test.mjs` → expect the new case ✓ + all existing green.

If T1.S1 hasn't landed yet (parallel), the test still ADDS correctly; it just FAILS until S1 lands — which is
the intended regression-catching behavior. typecheck is unaffected (test-only, no .ts change).