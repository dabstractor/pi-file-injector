# System Context — Bug Fix: Multi-file expanded view corrupted content

## Project Overview

**pi-file-injector** is a Pi coding-agent extension (`file-injector.ts`, 1359 lines) that implements
the `#@file` injection syntax. When a user types `Diff #@a.ts vs #@b.ts`, the extension:

1. **`input` handler** — intercepts the prompt text, resolves every `#@<path>` token, reads file
   contents, and stashes `{ blocks, details }` in a closure-scoped `pending` variable.
2. **`before_agent_start` handler** — publishes the stashed data as a custom message:
   `{ customType: "fileInjector.injected", content: blocks.join("\n\n"), details: { files } }`.
3. **Renderer** (`renderInjectedMessage`) — draws the green `read <path>` lines (collapsed) and
   the expanded body content (ctrl+o) in the TUI chat.

The **core contract** — "the whole file reaches the model" — works correctly. The model-facing
`message.content` is byte-correct. The bug is in the **display layer only**.

## The Bug (Issue 1 — Major)

### Root Cause

`computeDetailOffsets()` (line 353) computes absolute char offsets for each file's body within
`message.content`, so the renderer can slice the body without duplicating file bytes into `details`.

**Line 354:** `const SEP = "\\n\\n";` — This is the **4-character string** `\n\n` (backslash-n-backslash-n),
NOT two real newlines. But the actual content assembly at **line 1286** uses:

```ts
content: blocks.join("\n\n"),   // ← 2-char separator (real newlines)
```

So `SEP.length === 4` but the real separator `"\n\n".length === 2`. Each `starts[i]` (for `i ≥ 1`)
is too large by `2 * i`. The renderer slices `message.content.slice(contentStart, contentStart + contentLen)`
at the wrong position.

### Impact

- **Model is unaffected** — `message.content` is correct (uses real `"\n\n"`).
- **Collapsed view is correct** — only the read line (no body slice).
- **Expanded (ctrl+o) view is corrupted** for every file after the first: the body is shifted
  by +2 chars per preceding block (missing leading chars, showing trailing garbage).

### Affected Lines

| Line | Content | Issue |
|------|---------|-------|
| 343 | `*  blocks.join("\\n\\n")` (docstring) | Wrong separator in comment |
| 354 | `const SEP = "\\n\\n";` | **THE BUG** — 4-char string instead of 2-char |
| 355 | `// blocks.join("\\n\\n")` (comment) | Wrong separator in comment |

**Already correct** (reference points):
- Line 457: `assembled blocks.join("\n\n")` — correct
- Line 1286: `content: blocks.join("\n\n")` — correct (the assembly point)

### The Fix

Change `"\\n\\n"` → `"\n\n"` on lines 343, 354, and 355. This makes `computeDetailOffsets`'s
SEP match the actual `blocks.join("\n\n")` used on line 1286.

## The Rendering Pipeline (3-Tier Body Resolution)

`renderInjectedMessage()` (line 742) resolves each file's expanded body via 3 tiers:

1. **Tier 1 (offset slice):** `message.content.slice(d.contentStart, d.contentStart + d.contentLen)`
   — Used for real injected files (post-computeDetailOffsets). This is the tier that reads the
   buggy offsets. Always wins when `contentStart != null && contentLen != null`.

2. **Tier 2 (stored body):** `d.body` — Deprecated fallback for old/test entries.

3. **Tier 3 (regex fallback):** `bodies[i]` from `FILE_BLOCK_RE` — Last-resort; correct but
   never reached for real injected files because tier-1 always sets offsets.

The bug means tier-1 produces wrong slices. Tier-3 (the correct regex fallback) is never reached
because `computeDetailOffsets` always sets `contentStart`/`contentLen`.

## Issue 2 — Minor (Informational, No Fix Required)

`computeCodeRanges` closing-fence test uses `closeRe = /^ {0,3}{fenceChar}{fenceLen,}[ \t]*\r?$/`
which is stricter than PRD §5.6.1 pseudocode (requires whitespace-only after the fence run).
This is proper CommonMark behavior and is more correct than the pseudocode. No fix needed.

## Test Infrastructure

### Framework
- **Zero-dependency Node ESM script** — no test runner (no mocha/vitest/jest).
- Run via `node ./file-injector.test.mjs` (exits 0 on success, 1 on failure).
- Loads the REAL `file-injector.ts` via jiti (Pi's own loader mechanism with the same alias map).
- **156 test cases** in `file-injector.test.mjs` (all pass pre-fix).

### Key Test Helpers
- `runCase(name, description, async fn)` — runs a test case, catches errors, prints ✓/✗.
- `assert(cond, msg)` — throws on failure.
- `captureAllHandlers()` — registers the extension via `mod.default(pi)` and returns `{ event: [cb,…] }`
  so the input→before_agent_start `pending` stash shares ONE factory closure.
- `makeMockCtx(cwd, opts)` — mock context with `cwd`, `hasUI`, `isProjectTrusted`, `ui.notify`.
- `textOf(child)` — extracts text from a rendered Component via `child.render(2000).join("\n")`.
- `REND_THEME` — stub theme: `{ fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t }` (unstyled).
- `FIX` — fixture dir: `{ cwd: TMPDIR }`.

### Existing Renderer Tests (All Single-Block — The Gap)
- `REND-1` — collapsed single file
- `REND-6` — expanded single file (more children than collapsed)
- `REND-11(b)` — BUG-1 regression: nested `</file>` in a single file
- `REND-OFFSET` — offset tier with single block, crafted `contentStart`/`contentLen`
- `REND-PAGED-DIR` — paged directive, single head block

**None of these exercise multi-file expanded rendering through the real handler chain.** This is
exactly the gap that allowed Issue 1 to ship.

### Delivery Tests (Closest to What We Need)
- `DELIV-2` — drives `captureAllHandlers()` → `input[0]` → `before_agent_start[0]` for a SINGLE file
  and asserts the published message shape.
- `REND-11(b)` — drives `injectFiles` → `computeDetailOffsets` → `renderInjectedMessage` for a
  single file and checks the expanded body.

The regression test should follow the DELIV-2 + REND-11(b) pattern but with **multiple files**.

### Fixture Files Available
- `A_TS` = `path.join(TMPDIR, "a.ts")` — content: `function a() { return 1; }`
- `B_TS` = `path.join(TMPDIR, "b.ts")` — content: `function b() { return 2; }`
- `A_TXT` = `path.join(TMPDIR, "a.txt")` — content: `text content here`
- Markdown chain fixtures: `NOTES`, `API`, `A_MD`, `B_MD`, etc.

## Documentation Surface

- `README.md` line 41: "Press `ctrl+o` to expand any of them to the full contents." — Already
  describes the correct behavior; the fix restores it.
- No `CHANGELOG.md`, no `docs/` directory.
- No user-facing config surface, CLI flags, or env vars affected by this fix.
- The fix is internal (display-only offset computation); no public API changes.