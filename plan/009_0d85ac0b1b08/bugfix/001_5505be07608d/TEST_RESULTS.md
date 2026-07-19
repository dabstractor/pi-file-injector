# Bug Fix Requirements

## Overview

End-to-end validation of the `#@file` injection extension against the PRD. Testing covered: the full `input` → `before_agent_start` → renderer pipeline; all file types (text/image/binary/empty-image/paged); markdown transitive imports (relative resolution, extension shorthand, bare-`@` at every depth, code-exempt, cycles, dedup); the context-budget accumulator; the chat renderer (collapsed + expanded); config loading; and the `#@` autocomplete provider.

The core injection contract — **"the whole file reaches the model"** — works correctly in every scenario tested. The model-facing `message.content` is byte-correct for text, images, binaries, paged files, and arbitrarily deep markdown import chains. Markdown imports resolve relative to the importing file's directory at every depth, bare-`@` works at every depth when enabled, cycles terminate, and dedup is sound. The existing 156-case suite passes.

**One Major bug was found** in the chat-display layer: the expanded (`ctrl+o`) view of **multi-file** injections renders corrupted content for every file after the first. The root cause is a single string-literal typo in `computeDetailOffsets` — a separator constant is `"\\n\\n"` (4 chars: backslash-n-backslash-n) instead of `"\n\n"` (2 chars: two newlines), so it does not match the real `blocks.join("\n\n")` used to assemble `message.content`. The resulting `contentStart` offsets drift by +2 per preceding block, and the renderer slices the wrong bytes.

This is classified **Major** (not Critical) because:
- The model still receives correct file contents (the core value proposition is intact).
- The collapsed (default) view is correct — only the `ctrl+o` expanded view is corrupted.
- No data is lost (re-submission, forking, paging all still work).

But it **does violate explicit PRD acceptance criteria** (§6.3 expanded view; §11 test #34 "Both expand together on ctrl+o") for the most common multi-file use case (`Diff #@a.ts vs #@b.ts`, `#@spec.md` with transitive imports, etc.).

---

## Critical Issues (Must Fix)

_None._

---

## Major Issues (Should Fix)

### Issue 1: Multi-file expanded (`ctrl+o`) view shows corrupted content — `computeDetailOffsets` uses wrong separator literal

**Severity**: Major (borderline Critical — violates an explicit PRD §11 acceptance criterion for a primary use case)

**PRD Reference**:
- §6.3 "Expanded (`ctrl+o`): each file's full delivered text renders below its `read` line."
- §11 test #33 "display — single file": `ctrl+o` shows the full highlighted contents.
- §11 test #34 "display — multi-file": `Diff #@a.ts vs #@b.ts` — "Both expand together on `ctrl+o`."
- §11 test #37 "display — paged": expanded shows head + directive.
- §12.22 (the offset-tier design that introduced `computeDetailOffsets`).

**Expected Behavior**

When a prompt resolves to N files (multiple top-level `#@` tokens, a markdown import chain, or a paged file following any other file), pressing `ctrl+o` to expand the green `read`-lines box must show each file's **exact** delivered body below its `read` line. For `Diff #@a.ts vs #@b.ts` the user must see:
- `a.ts` → `function a() { return 1; }`
- `b.ts` → `function b() { return 2; }`

**Actual Behavior**

The first file's expanded body is correct, but **every subsequent file's expanded body is shifted by +2 characters per preceding block** (missing its first 2·k chars and showing 2·k trailing garbage chars from the next block's header). For the `Diff #@a.ts vs #@b.ts` scenario the user sees:
- `a.ts` → `function a() { return 1; }` ✓
- `b.ts` → `nction b() { return 2; }\n<` ✗ (leading `"fu"` lost; trailing `"\n<"` garbage)

For a 3-file prompt (`#@a.ts #@b.ts #@c.ts`) the drift is +4 for the third file (`c.ts` → `"</f"`-prefixed garbage). For a markdown chain `spec.md → api.md → arch.md` (the PRD's headline transitive-import feature, §1/§5.6), `spec.md` renders correctly but `api.md` and `arch.md` render corrupted.

**Root Cause**

`file-injector.ts` line 354:

```ts
export function computeDetailOffsets(blocks: string[], details: FileDetail[]): FileDetail[] {
  const SEP = "\\n\\n";   // ← BUG: this is the 4-char string `\n\n` (backslash-n-backslash-n)
  ...
  for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }  // SEP.length === 4
  ...
  d.contentStart = starts[bi] + headerLen;
```

But `before_agent_start` (line 1286) joins with the **2-char** separator (two real newlines):

```ts
content: blocks.join("\n\n"),
```

`"\n\n".length === 2`, but `SEP.length === 4`, so each `starts[i]` (for `i ≥ 1`) is too large by `2 * i`. The renderer then prefers these length-derived offsets (its tier-1 path) and slices `message.content.slice(contentStart, contentStart + contentLen)` at the wrong position:

```ts
const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
  ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)   // ← wrong start
  : (typeof d.body === "string" ? d.body : bodies[i]);                     // ← correct regex fallback never reached
```

Because `computeDetailOffsets` always sets `contentStart`/`contentLen` for body-bearing blocks, the (correct) regex fallback `bodies[i]` is never used — the buggy tier-1 slice always wins. `contentLen` itself is correct (it is derived from the individual block's length, not the separator); only `contentStart` drifts.

The model is unaffected: `message.content` is the correct `blocks.join("\n\n")` string, and `convertToLlm()` sends that to the LLM verbatim. Only the TUI renderer's expanded view reads the corrupted offsets.

**Why the existing test suite did not catch it**

Every relevant renderer test (`REND-6`, `REND-11(b)`, `REND-OFFSET`, `REND-PAGED-DIR`) crafts a **single-block** `message.content`, where `starts[0] === 0` and the drift is zero. No automated test exercises multi-file expanded rendering through the real `input` → `before_agent_start` → `computeDetailOffsets` → `renderInjectedMessage` path. PRD §11 test #34 is listed as a manual/integration case only.

**Steps to Reproduce**

1. Load the extension (`pi -e .` or copy to `~/.pi/agent/extensions/`).
2. Create two small files: `a.ts` = `function a() { return 1; }`, `b.ts` = `function b() { return 2; }`.
3. In the TUI, submit: `Diff #@a.ts vs #@b.ts`
4. Observe the green box below the user bubble: collapsed shows two correct `read` lines.
5. Press `ctrl+o` to expand.
6. **Observe**: `a.ts` body is correct; `b.ts` body reads `nction b() { return 2; }\n<` (corrupted — first two chars missing, trailing garbage).

Equivalent repro for the transitive-import headline feature:
1. `spec.md` contains `#@api.md`; `api.md` contains `#@arch.md`; `arch.md` is a leaf.
2. Submit `#@spec.md`, press `ctrl+o`.
3. `spec.md` body is correct; `api.md` and `arch.md` bodies are corrupted (drift +2 and +4).

Standalone Node repro (no TUI/model needed) — confirms via the real `input` + `before_agent_start` handlers and the real renderer:

```js
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
  "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
}});
const mod = await jiti.import(path.resolve("./file-injector.ts"));
const r = fs.mkdtempSync("/tmp/bg-");
fs.writeFileSync(path.join(r, "a.ts"), "function a() { return 1; }");
fs.writeFileSync(path.join(r, "b.ts"), "function b() { return 2; }");
const cbs = {};
mod.default({ on: (ev, cb) => { (cbs[ev] ??= []).push(cb); }, registerMessageRenderer: () => {} });
for (const cb of cbs.session_start) await cb({}, { cwd: r, isProjectTrusted: () => true });
const ctx = { cwd: r, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} } };
await cbs.input[0]({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
const { message } = await cbs.before_agent_start[0]({}, ctx);
for (const d of message.details.files) {
  const sliced = message.content.slice(d.contentStart, d.contentStart + d.contentLen);
  console.log(path.basename(d.path), "→", JSON.stringify(sliced));
}
// ACTUAL:   a.ts → "function a() { return 1; }"
//           b.ts → "nction b() { return 2; }\n<"        ← corrupted
// EXPECTED: a.ts → "function a() { return 1; }"
//           b.ts → "function b() { return 2; }"
```

**Suggested Fix**

One-character change in `file-injector.ts` line 354 — use a real two-newline separator so it matches `blocks.join("\n\n")` on line 1286:

```diff
 export function computeDetailOffsets(blocks: string[], details: FileDetail[]): FileDetail[] {
-  const SEP = "\\n\\n";
-  // absolute char offset of each block within blocks.join("\\n\\n")
+  const SEP = "\n\n";
+  // absolute char offset of each block within blocks.join("\n\n")
   const starts: number[] = [];
   let off = 0;
   for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }
```

(Also update the matching docstring on line 343 which currently says `blocks.join("\\n\\n")`.)

After this fix, the offset tier produces correct slices for any number of files, and the BUG-1-safe length-derived offsets work as designed for bodies that contain a literal `</file>`.

**Regression test to add** (the gap that let this ship): drive the real `input` + `before_agent_start` handlers with a **multi-file** prompt (e.g. `Diff #@a.ts vs #@b.ts vs #@c.ts`) and assert that `renderInjectedMessage(msg, { expanded: true }, theme)`'s body child for **every** file equals that file's actual content — not just the first. The existing single-block `REND-OFFSET` test should be joined by a multi-block sibling.

---

## Minor Issues (Nice to Fix)

### Issue 2: `computeCodeRanges` closing-fence test is stricter than PRD §5.6.1 pseudocode (divergence, not a defect)

**Severity**: Minor (informational — the shipped behavior is more CommonMark-correct, just diverges from the literal pseudocode)

**PRD Reference**: §5.6.1 — pseudocode checks only "≥ `fenceLen` of the same fence char after 0–3 leading spaces" (allows trailing non-whitespace on the closing fence).

**Actual Behavior**

`computeCodeRanges` builds `closeRe = /^ {0,3}{fenceChar}{fenceLen,}[ \t]*\r?$/`, which requires the closing-fence line to be **whitespace-only** after the fence run (strict CommonMark). The PRD pseudocode would treat e.g. ` ```foo ` as a valid closing fence; the shipped code treats it as non-closing, so the fenced range extends to EOF.

Example where they diverge:

```
```python
code
```foo
#@bar.md
```
- PRD pseudocode: ` ```foo ` closes the fence; `#@bar.md` is **outside** code → imported (if `bar.md` exists).
- Shipped: ` ```foo ` does **not** close; the fence runs to EOF; `#@bar.md` is **inside** code → exempt (left verbatim).

**Impact**

In practice this is benign-to-better: real markdown almost never puts non-whitespace after a closing fence, and the shipped behavior is proper CommonMark. The only observable difference is that the shipped code treats a few more `#@` markers as inert (inside an unclosed fence) than the pseudocode would. No data corruption; at worst a marker the user expected to import is left verbatim. **No fix required** — noted only so reviewers are aware the implementation intentionally tightened the PRD pseudocode. If strict PRD conformance is desired, drop `[ \t]*\r?$` from `closeRe` and instead count the leading fence-run length as the pseudocode shows.

---

## Testing Summary

- **Total probes performed**: ~50 distinct scenarios across 7 ad-hoc harnesses (in addition to running the project's 156-case suite, the 23-case import-behavior suite, and the 38-case relative-imports suite — all of which pass).
- **Passing**: the core injection pipeline (text/image/binary/empty-image/paged), markdown transitive imports (relative resolution at every depth, extension shorthand, bare-`@` at every depth, code-exempt, cycles, dedup, self-import), budget accumulator, config loading + trust gating + precedence, collapsed chat rendering, color/path parity, verbatim prompt preservation (cancel/fork/re-open safety), and the `#@`-only top-level safety invariant.
- **Failing**: 1 Major — multi-file **expanded** view (`ctrl+o`) renders corrupted bodies for every file after the first (Issue 1).
- **Areas with good coverage**: model-facing delivery (`message.content`), markdown resolution semantics, dedup/termination, config layer, collapsed rendering.
- **Areas needing more attention (test-suite gaps)**: the renderer's expanded view was only tested with single-block crafted messages; there is no automated end-to-end test that injects ≥2 files through the real handlers and asserts each file's expanded body. This is exactly the gap that allowed Issue 1 to ship. Adding the regression test described in Issue 1 would prevent recurrence.