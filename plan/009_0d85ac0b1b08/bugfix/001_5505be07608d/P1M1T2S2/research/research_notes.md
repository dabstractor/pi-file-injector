# Research Notes — P1.M1.T2.S2 (Add REND-MULTI-E2E integration test: real handler chain with multiple files)

All facts verified first-hand against the working tree at HEAD `b1f0727` ("Fix SEP literal in computeDetailOffsets").
Suite is GREEN: **157 passed, 0 failed**. T1.S1 (SEP fix) LANDED; T2.S1 (REND-MULTI-OFFSET unit test) LANDED at
L2757-2781. T2.S2 (this subtask) adds the E2E counterpart → **158 passed** after.

## 0. The two-test regression coverage design (from regression_test_design.md)

- **REND-MULTI-OFFSET** (T2.S1, LANDED): UNIT test — crafts 2 blocks directly as string literals, calls
  `computeDetailOffsets` MANUALLY, no file I/O, no handlers. Isolates the renderer's offset tier. Uses the
  simple crafted content `function a() { return 1; }` / `function b() { return 2; }`.
- **REND-MULTI-E2E** (T2.S2, this subtask): E2E test — drives the REAL `input` → `before_agent_start` handler
  chain with a multi-file prompt, then renders expanded and asserts EACH file's body. Uses the REAL `a.ts`/
  `b.ts` fixtures. Does NOT call `computeDetailOffsets` manually (the handler does it internally at L1284).

The two complement each other: REND-MULTI-OFFSET isolates the buggy function; REND-MULTI-E2E proves the whole
input→before_agent_start→render pipeline produces correct multi-file bodies. Together they close the gap that
let the SEP bug ship (bugfix PRD §h3.0 Suggested Fix: "The existing single-block REND-OFFSET test should be
joined by a multi-block sibling" — REND-MULTI-OFFSET is the unit sibling; REND-MULTI-E2E is the E2E sibling).

## 1. The CRITICAL correction: real fixture content ≠ unit-test crafted content

The item description (§3g, §3h) says assert `function a() { return 1; }` / `function b() { return 2; }`. That
is the content the UNIT test (REND-MULTI-OFFSET) crafts directly as string literals. The E2E test uses the REAL
fixtures, whose content is DIFFERENT (verified file-injector.test.mjs L226-228):
- `A_TS_CONTENT = "export function add(a, b) {\n  return a + b;\n}\n// a small TypeScript fixture for the #@file tests\n"`
- `B_TS_CONTENT = "export const VALUE = 42;\n"`

So the E2E assertions MUST be:
- `textOf(exp.children[1]).includes("export function add")` (a.ts body)
- `textOf(exp.children[3]).includes("export const VALUE = 42")` (b.ts body)

NOT `function a()` / `function b()`. (For the optional 3-file variant, the test writes its OWN c.ts with
`function c() { return 3; }` — that one DOES use the simple content, because the test creates it.)

## 2. The handler chain — captureAllHandlers + makeMockCtx (verified)

### `captureAllHandlers()` (file-injector.test.mjs L185-194)
```js
function captureAllHandlers() {
  const handlers = {};
  const pi = {
    on: (ev, cb) => { (handlers[ev] ??= []).push(cb); },
    registerMessageRenderer: () => {}, // §6.3 no-op stub
  };
  mod.default(pi);   // ONE call → input[0] + before_agent_start[0] share the `pending` closure
  return handlers;    // flat object; each value is an ARRAY
}
```
- Calls `mod.default(pi)` EXACTLY ONCE → `input[0]` and `before_agent_start[0]` share the same factory closure
  (the `pending` stash lives in factory scope). This is load-bearing: the `pending` set by input must be the
  same `pending` read by before_agent_start.
- `handlers.session_start` has length 2 (config-load handler + autocomplete handler). NOT needed for this test
  (cfg defaults to `markdownBareAtImports:false`, correct for `#@`-only prompts — see DELIV-2 comment L2451-2456).

### `makeMockCtx(cwd)` (file-injector.test.mjs L162-168)
```js
function makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, isProjectTrusted, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,
  };
}
```
- Returns `{ ctx, rec }`. ctx has `cwd`, `hasUI:true`, `isProjectTrusted:()=>true`, `ui.notify`.
- **`isProjectTrusted` IS provided** (default `() => true`). The test does NOT need to add it. (The bug report's
  standalone repro added it manually because it didn't use makeMockCtx; makeMockCtx handles it.)

## 3. The DELIV-2 pattern — the handler-chain E2E template (file-injector.test.mjs L2477-2497)

Verified verbatim. The REND-MULTI-E2E test mirrors this structure but:
- uses a 2-file prompt (`Diff #@a.ts vs #@b.ts`) instead of 1-file,
- does NOT call `computeDetailOffsets` manually (before_agent_start does it internally — see §5),
- adds expanded-render body assertions on children[1] and children[3].

Key DELIV-2 lines (the template to follow):
```js
const { ctx } = makeMockCtx(TMPDIR);
const h = captureAllHandlers();
const out = await h.input[0]({ text: "Review #@a.ts", source: "interactive", images: [] }, ctx);
assert(out.action === "transform", ...);
const msg = await h.before_agent_start[0]({}, ctx);  // SAME factory → reads the stashed pending
assert(msg && msg.message, ...);
const m = msg.message;
// assert m.customType, m.content, m.display, m.details.files
```

## 4. The renderer test infrastructure (file-injector.test.mjs L2565-2567)
```js
const REND_THEME = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t };
const REND_W = 2000;
const textOf = (child) => child.render(REND_W).join("\n");
```
- REND_THEME is a plain stub theme (every fn returns its text arg unstyled) → textOf returns the raw text.
- REND_W=2000 (generous → no wrapping). Trailing render padding may exist → use `.includes(expected)` for body
  assertions (NOT `===`), matching REND-MULTI-OFFSET's pattern (L2774-2776).

## 5. before_agent_start calls computeDetailOffsets INTERNALLY (file-injector.ts L1278-1290)

```ts
pi.on("before_agent_start", async (_e, _ctx) => {
  if (!pending) return undefined;
  const { blocks, details } = pending;
  pending = null;
  computeDetailOffsets(blocks, details);   // ← offsets populated HERE (L1284)
  return {
    message: {
      customType: "fileInjector.injected",
      content: blocks.join("\n\n"),
      display: true,
      details: { files: details },
    },
  };
});
```
- The E2E test's `msg.message.details.files[i].contentStart`/`.contentLen` are ALREADY populated by the real
  handler. The renderer's tier-1 offset slice fires AUTOMATICALLY when renderInjectedMessage is called.
- **DO NOT call `computeDetailOffsets` manually in REND-MULTI-E2E** — that would defeat the "E2E" claim (the
  unit REND-MULTI-OFFSET does it because it bypasses the handler chain). This distinction is what makes the
  two tests complementary.

## 6. The expanded-Box child layout — body children at ODD indices

Confirmed by REND-MULTI-OFFSET (L2774-2776). For N text files in expanded mode:
- `children[0]` = read line file0 (+ `(ctrl+o to expand)` hint, shown once per box)
- `children[1]` = body file0
- `children[2]` = read line file1
- `children[3]` = body file1
- ... → body children at ODD indices (1, 3, 5, ...); read lines at EVEN indices (0, 2, 4, ...).

For the 3-file variant: children[5] = body file2.

## 7. Fixtures + insertion point + baseline count

- `A_TS = path.join(TMPDIR, "a.ts")` (L350); `B_TS = path.join(TMPDIR, "b.ts")` (L351). Written in buildFixtures (L233, L238).
- **T2.S1 (REND-MULTI-OFFSET) HAS LANDED** at L2757-2781. So insert REND-MULTI-E2E at **line 2782** (the blank
  line between REND-MULTI-OFFSET's `});` and the REND-PAGED-DIR comment header at L2783/2784). Keeps REND-*
  cases clustered.
- Baseline: **157 passed, 0 failed** (GREEN at b1f0727). After REND-MULTI-E2E: **158 passed**.
- `FIX = { cwd: TMPDIR }` (L361) is for direct `injectFiles` calls ONLY (no hasUI/isProjectTrusted/ui). The
  handler-chain test uses `makeMockCtx(TMPDIR).ctx`, NOT `FIX`.

## 8. The optional 3-file variant (cumulative +4 drift verification)

Per regression_test_design.md Test B. Creates a temporary `c.ts` with `function c() { return 3; }` IN THE TEST
BODY (not a top-level fixture), drives `#@a.ts #@b.ts #@c.ts`, asserts children[5] (body file2) carries
`function c() { return 3; }`. Pre-fix drift would be +4 (2 preceding blocks × +2). Clean up c.ts in a `finally`
block so it doesn't leak into other tests. (The 2-file E2E is the PRIMARY regression test; the 3-file variant
is recommended but optional — it proves the drift is cumulative, not just +2 once.)

## 9. Why this test FAILS pre-T1.S1 and PASSES post-T1.S1

- **Pre-T1.S1** (SEP = `"\\n\\n"`, length 4 vs join `"\n\n"` length 2): `starts[1]` (b.ts's offset) is +2 too
  large → `content.slice(details[1].contentStart, ...)` starts 2 late → body reads
  `"port function add(a, b) {...}\n</file>\n\n<file name=\"...\">\nexport const VALUE = 42;\n"` — wait, the
  scout's correction means the drift corrupts differently than the item's `function a()` example, but the
  PRINCIPLE is identical: the second file's body is shifted +2 chars and bleeds into the next block. The
  assertion `textOf(children[3]).includes("export const VALUE = 42")` FAILS pre-fix.
- **Post-T1.S1** (SEP length 2): offsets correct → children[3] carries exactly b.ts's body → assertion PASSES.

This is the RED-then-GREEN proof of the SEP fix through the FULL handler chain (the unit REND-MULTI-OFFSET
proved it in isolation; REND-MULTI-E2E proves it end-to-end). T1.S1 has LANDED, so this test adds GREEN.

## 10. Validation gates (what T2.S2 owns)

- `node ./file-injector.test.mjs` → **158 passed, 0 failed** (157 baseline + REND-MULTI-E2E), exit 0. The new
  case prints `✓ case REND-MULTI-E2E: …`.
- `node ./relative-imports.test.mjs` → 38 passed; `node ./import-behavior.test.mjs` → 23 passed (unchanged —
  no source change).
- `npm run typecheck` → 0 errors (no source change; file-injector.ts untouched).
- `git diff --stat` → ONLY file-injector.test.mjs changed.

## 11. No-conflict coordination with siblings

- **T1.S1 (LANDED):** the SEP fix in file-injector.ts. T2.S2 consumes it (the E2E test passes because of it).
  No file conflict (T1.S1=source; T2.S2=test).
- **T2.S1 (LANDED):** REND-MULTI-OFFSET unit test (crafts blocks, calls computeDetailOffsets manually). T2.S2
  is the E2E counterpart (real handlers, no manual computeDetailOffsets). DISJOINT test cases; T2.S2 inserts
  AFTER T2.S1's block (L2782). Name "REND-MULTI-E2E" distinct from "REND-MULTI-OFFSET".
- **P1.M1.T3.S1 (upcoming):** README review for expanded-view multi-file docs. T2.S2 is test-only — no doc change.