# Regression Test Design — Multi-file Expanded View

## The Gap

All existing renderer tests craft **single-block** `message.content`:
- `REND-OFFSET` — one block, crafted offsets → `starts[0] === 0`, drift = 0
- `REND-11(b)` — one file through `injectFiles` → one block
- `REND-6` — one file expanded
- `REND-PAGED-DIR` — one paged head block

No test exercises multi-file expanded rendering through the real
`input` → `before_agent_start` → `computeDetailOffsets` → `renderInjectedMessage` path.

## Test Design

### Approach: Full E2E through the handler chain

Follow the `DELIV-2` pattern (captureAllHandlers → input → before_agent_start) combined with
the `REND-11(b)` pattern (injectFiles → computeDetailOffsets → renderInjectedMessage expanded).

### Two Complementary Tests

**Test A — REND-MULTI-OFFSET (handler chain E2E)**

This is the primary regression test — it exercises the exact gap:

1. Use `captureAllHandlers()` to get the factory handlers from ONE `mod.default(pi)` call.
2. Drive `input[0]` with a multi-file prompt: `Diff #@a.ts vs #@b.ts` (using existing `A_TS`, `B_TS` fixtures).
3. Drive `before_agent_start[0]` to get the published message.
4. The published message already has `computeDetailOffsets` called (line 1282 of file-injector.ts).
5. Render expanded via `mod.renderInjectedMessage(msg.message, { expanded: true }, REND_THEME)`.
6. Extract body children and assert EACH file's body equals its actual content.

**Test B — REND-MULTI-3FILE (3-file +2 drift verification)**

Same pattern but with 3 files to verify cumulative drift (+2, +4) is fixed:
- `#@a.ts #@b.ts #@c.ts` (or reuse existing fixtures — may need a `c.ts` fixture)
- Alternatively, reuse a markdown transitive import chain: `#@spec.md` → `#@api.md` → `#@arch.md`

### Assertion Pattern

For each file `i`, find its body child in the expanded Box and assert:

```js
const bodyChild = textOf(expanded.children[bodyChildIndex]);
assert(bodyChild.includes(expectedContent),
  `file ${i} expanded body must be exact, got ${JSON.stringify(bodyChild.slice(0, 80))}`);
```

The expanded Box layout for N text files is:
- `[0]` read line for file 0 + expand hint
- `[1]` body for file 0
- `[2]` read line for file 1
- `[3]` body for file 1
- ...

So body children are at odd indices (1, 3, 5, ...).

### Where to Place the Test

After the existing `REND-OFFSET` test block (around line 2748), as a sibling — it extends the
offset-tier coverage from single-file to multi-file. Use the `REND-` prefix for consistency.

### Available Fixture Constants

From the test file (already set up at the top):
- `A_TS` = `path.join(TMPDIR, "a.ts")` — `function a() { return 1; }`
- `B_TS` = `path.join(TMPDIR, "b.ts")` — `function b() { return 2; }`
- `A_TXT` = `path.join(TMPDIR, "a.txt")` — text content

For a 3rd file, either:
- Add a `C_TS` fixture (write `function c() { return 3; }` to `path.join(TMPDIR, "c.ts")`)
- Or use the markdown chain fixtures (`NOTES`, `API`)

### Important: The Fix Must Come First

The regression test should **FAIL** before the fix (proving it catches the bug) and **PASS**
after the fix. The test depends on `P1.M1.T1.S1` (the separator fix).

## Minimal Unit Test Alternative

A lighter-weight alternative that doesn't need file I/O — craft blocks + details directly:

```js
const blocks = [
  '<file name="/abs/a.ts">\nfunction a() { return 1; }\n</file>',
  '<file name="/abs/b.ts">\nfunction b() { return 2; }\n</file>',
];
const details = [
  { path: "/abs/a.ts", kind: "text" },
  { path: "/abs/b.ts", kind: "text" },
];
mod.computeDetailOffsets(blocks, details);
const content = blocks.join("\n\n");
// Assert details[0].contentStart slices correctly
assert(content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen)
  === "function a() { return 1; }", "a.ts offset correct");
assert(content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen)
  === "function b() { return 2; }", "b.ts offset correct");
```

This directly tests `computeDetailOffsets` in isolation — the smallest test that would have caught the bug.