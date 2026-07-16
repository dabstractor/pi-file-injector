# System Context — Delta 002: Paged Delivery for Oversize Files

**Project:** `pi-auto-reader` (`#@file` Whole-File Injection Extension for Pi)
**Delta scope:** Add automatic paged delivery (PRD §5.5) to the existing, fully-implemented MVP.
**Status:** All research complete. PRD claims verified against installed Pi v0.80.7.

---

## 1. Current System State

The project is a **single-file Pi TypeScript extension** (`file-injector.ts`, ~322 lines) that hooks
the `input` event to expand `#@<path>` tokens into whole-file `<file name="…">` blocks. It is
**fully implemented** (MVP from plan/001) with comprehensive tests (34 assertion cases + 2
integration cases in `file-injector.test.mjs`, ~760 lines).

### What exists and works
- `#@<path>` detection with Unicode-aware word-boundary regex
- Text file injection (whole content, no truncation)
- Image attachment (resize → ImageContent, magic-number sniff, empty-image guard)
- Binary file detection (NUL-byte heuristic → note block)
- Missing/directory/read-error → token left verbatim
- `#@` trigger stripping from injected markers
- Prior-injection dedup (defense against duplicate copies in the handler chain)
- Loop prevention (`source === "extension"` skip)
- Steering skip (`streamingBehavior === "steer"` skip)
- `#@` autocomplete provider (TUI/RPC only, line-rewrite reuse of Pi's `@` engine)
- Pluralized notify message

### What does NOT exist (the delta)
- **No context-budget awareness.** `injectFiles` always injects the entire file regardless of size.
  Its `ctx` param is typed `{ cwd: string }` — it cannot access `getContextUsage()` or `ctx.model`.
- **No paged delivery.** A 50 MB file is injected whole, potentially overflowing the model's context.
- **No whole-vs-paged distinction in the notify.** The notify is a simple `#@ injected N file(s)`.

---

## 2. API Verification Summary (all 9 claims VERIFIED)

Source: `@earendil-works/pi-coding-agent` v0.80.7 at `/home/dustin/.local/lib/node_modules/`
Full details in: `pi_api_verification.md`

| API | Status | Key Finding |
|-----|--------|-------------|
| `ContextUsage` | ✅ VERIFIED | `{ tokens: number \| null; contextWindow: number; percent: number \| null }`. `tokens` is nullable ("unknown right after compaction"). |
| `ctx.getContextUsage()` | ✅ VERIFIED | Returns `ContextUsage \| undefined`. Must null-check the whole result AND `.tokens`. |
| `ctx.model` | ✅ VERIFIED | `Model<any> \| undefined`. `Model` has `contextWindow: number` and `maxTokens: number` (both required numbers). |
| `ExtensionContext` | ✅ VERIFIED | Has `cwd`, `model`, `getContextUsage`, `hasUI`, `ui`, `modelRegistry`, `mode`, etc. |
| `ctx.ui.notify` | ✅ VERIFIED | `notify(message: string, type?: "info" \| "warning" \| "error"): void` |
| `DEFAULT_MAX_LINES` | ✅ VERIFIED | `2000` (confirms `HEAD_BYTES = 8192` ≈ 2000 lines) |
| `estimateTokens` | ✅ VERIFIED | Takes `AgentMessage`, not a string → use `Math.ceil(content.length / 4)` heuristic |
| `resizeImage` / `formatDimensionNote` / `ResizedImage` | ✅ VERIFIED | All exported from main package. `ResizedImage.data` is base64 string. |
| `InputEvent` / `InputEventResult` | ✅ VERIFIED | `{ type, text, images?, source, streamingBehavior? }`; result is `continue \| transform \| handled` |

### O-1/O-2/O-3 Resolution (from delta_prd §2, confirmed by research)
- **O-1:** `getContextUsage()` may return `undefined` at `input` time (before the turn). `tokens`
  may also be `null`. **⇒ Budget is best-effort.** When unavailable → fall back to whole injection.
- **O-2:** `ctx.model` carries `contextWindow` and `maxTokens` directly (both numbers). No
  `modelRegistry` lookup needed. Guard against `ctx.model === undefined`.
- **O-3:** No string-based token estimator. Use `fileCost = Math.ceil(content.length / 4)`.

---

## 3. Implementation Insertion Points

Full details in: `implementation_insertion_points.md`. Key sites (current line numbers):

| Site | Lines | Change |
|------|-------|--------|
| Constants (`FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT`) | 8–17 | Add 5 new constants after L17 |
| Format helpers (`formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`) | 90–112 | Add `formatPagedDirectiveBlock` after L112 |
| `injectFiles` signature + `ctx: { cwd: string }` | 122–126 | Widen `ctx` type + return type |
| Local state (`let count = 0`) | 129 | Add `let paged = 0;` + `let remainingBudget` |
| Text/binary branch (line 199 = inline-vs-paged decision point) | 194–200 | Insert budget branch at L199 |
| `count++` | 202 | Unchanged — still counts ALL delivered files |
| Assembly + early-return guard | 209–217 | Add `paged` to returns |
| Factory JSDoc ("No limits" paragraph) | 220–244 | Rewrite for paged delivery |
| Handler: `injectFiles` call + notify | 251, 254 | Destructure `paged`; mode-aware notify |

### The inline-vs-paged decision point (critical)
**Current code at line 199:**
```ts
blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
```
**Must become:**
```ts
const content = buf.toString("utf8");
const fileCost = Math.ceil(content.length / 4);
if (remainingBudget === null || fileCost <= PAGED_THRESHOLD * remainingBudget) {
  // INLINE (whole) — current behavior
  blocks.push(formatTextFileBlock(abs, content));
  if (remainingBudget !== null) remainingBudget -= fileCost;
} else {
  // PAGED — head block + directive
  blocks.push(formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)));
  blocks.push(formatPagedDirectiveBlock(abs, content.length));
  paged++;
  remainingBudget -= Math.ceil(HEAD_BYTES / 4);
}
```

---

## 4. Test Harness Architecture

Full details in: `test_and_docs_analysis.md`. Key findings:

### Framework
- **Standalone `.mjs` script**, no test framework. Zero dependencies. Asserts directly, exits `0`/`1`.
- Loads the REAL `file-injector.ts` via `jiti` aliased to the global Pi package.
- Run: `node ./file-injector.test.mjs`

### Mock patterns (critical for paged delivery tests)
- **`fs` is NOT mocked.** Real files in a temp dir (`os.tmpdir()/"saf-..."`). Fixtures written by
  `buildFixtures()`.
- **`resizeImage` is NOT mocked.** A tiny 1×1 PNG makes it return `null` deterministically.
- **`FIX = { cwd: TMPDIR }`** — the mock ctx used by all existing test cases. It has ONLY `cwd`.
  No `getContextUsage()`, no `model`.
- **`makeMockCtx(cwd, { hasUI })`** — richer mock for handler-level tests: `{ cwd, hasUI, ui: { notify } }`.

### Existing test case #2 (huge.log) — does NOT need to change
Test case #2 uses `FIX = { cwd: TMPDIR }` — no budget. Under paged delivery, the O-1 fallback fires
(`getContextUsage()` is undefined → no paging → inject whole). **Case #2 continues to assert
byte-for-byte whole injection of the ~2 MB file.** It becomes the regression test for the
"budget unknown → whole injection" path (delta_prd PD-T4).

### New paged delivery tests — need a budget-aware mock ctx
To trigger paging, a new mock ctx must provide `getContextUsage()` returning a tight budget:
```js
const PAGED_FIX = {
  cwd: TMPDIR,
  getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }),
  model: { contextWindow: 50000, maxTokens: 8192 },
};
// remaining = 50000 - 10000 - 8192 - 8192 = 23616
// PAGED_THRESHOLD * remaining = 0.6 * 23616 = 14170
// huge.log fileCost = ceil(2097152 / 4) = 524288 >> 14170 → PAGED
// a.ts fileCost = ceil(200 / 4) = 50 << 14170 → WHOLE
```

### Module surface sanity check
Test lines 117–124 assert the module exports a specific list. If `formatPagedDirectiveBlock` is
exported, this list must be updated.

---

## 5. Dedup-vs-Paging Analysis (NON-ISSUE)

The scout flagged a potential collision: F1/F1c tests assert each resolved path produces exactly one
`<file name="<path>">` block. Paging produces TWO blocks per path (head + directive).

**Analysis: This is a non-issue.** The dedup logic operates on the INPUT text's pre-existing
`<file>` blocks, not on the `blocks[]` array being built:

```ts
// Before the loop — scans INPUT text only
const priorPaths = new Set<string>();
for (const m of text.matchAll(/<file name="([^"]+)">/g)) {
  priorPaths.add(m[1]);
}
// Per token — checks if path was ALREADY in the input
if (priorPaths.has(abs)) continue;
```

The paged file's head block and directive block are pushed to `blocks[]`, which is only appended to
`finalText` AFTER the loop. They never feed back into `priorPaths`. Each `#@path` token is matched
exactly once by `matchAll(FILE_INJECT_RE)`. **No dedup collision occurs.**

---

## 6. README Sections to Update

Full current content in: `test_and_docs_analysis.md`. Three sections are stale:

1. **Line 3 ("Why"):** "with no size limit" — must become "the whole file always reaches the model —
   injected whole when it fits, paged via the `read` tool when it doesn't"
2. **Line 41 ("What gets injected" table, Text row):** "Entire contents injected, no truncation." —
   must add paged delivery for oversize files
3. **Line 72 ("Limits", "No size gate" bullet):** Factually wrong — `#@` now pages instead of
   overflowing. Replace with "No size knob" framing.

---

## 7. Constants and Format Reference

### New constants (PRD §5.5)
```
PAGED_THRESHOLD = 0.6   // inject whole if fileCost <= PAGED_THRESHOLD * remaining
MARGIN          = 8192  // safety bytes subtracted from remaining context
HEAD_BYTES      = 8192  // head block size (~2000 lines, matches read tool DEFAULT_MAX_LINES)
DEFAULT_WINDOW  = 200000 // fallback context window when ctx.model is absent
DEFAULT_RESERVE = 8192  // fallback maxTokens reserve when ctx.model is absent
```

### `formatPagedDirectiveBlock` format
```xml
<file name="/abs/path/to/file.log"><large file — estimated N bytes; first 8 KB injected above. Use the read tool to load the rest: read offset:0, limit:2000, incrementing offset until the entire file is read></file>
```
Uses em-dash (U+2014) for consistency with the existing binary/empty-image notes.

### Budget computation (per prompt, before the token loop)
```
usage = ctx.getContextUsage?.()
if (usage === undefined || usage.tokens === null) → remaining = null (fallback: inject all whole)
else:
  window   = usage.contextWindow
  used     = usage.tokens
  reserve  = ctx.model?.maxTokens ?? DEFAULT_RESERVE
  remaining = max(0, window - used - reserve - MARGIN)
```

### Counting (PD-1 rule 3)
- `injected` (count) = ALL delivered files (whole + paged). Unchanged semantics.
- `paged` = subset that were paged. New counter.
- `whole` = `injected - paged` (computed in handler for notify).
- Early-return guard `if (count === 0)` is UNCHANGED (count still means "anything delivered").

### Handler notify
- `paged === 0`: `#@ injected N file(s)` (existing style)
- `paged > 0`: `#@ injected W whole, M paged` where W = `injected - paged`, M = `paged`
