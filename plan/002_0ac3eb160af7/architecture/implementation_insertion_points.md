# Implementation Insertion Points — Paged Delivery (PRD §5.5)

Target file: `/home/dustin/projects/pi-auto-reader/file-injector.ts` (single file, 322 lines total).
This document pins exact line numbers (current HEAD) for every change site the §5.5 paged-delivery
work needs. All line numbers are from `grep -n` against the file as read; they shift when code is
inserted above them — re-derive after each edit.

Reference: PRD §5.5 lives at `prd_snapshot.md:216-249`. Constants to pin:
`PAGED_THRESHOLD = 0.6`, `MARGIN = 8192`, `HEAD_BYTES = 8192`, `DEFAULT_WINDOW = 200000`,
`DEFAULT_RESERVE = 8192`.

---

## 1. Constants section

The constants block is at the very top of the file, **lines 8-17**, after the 6 import lines (1-6):

| Constant | Type | Line | Notes |
|---|---|---|---|
| `FILE_INJECT_RE` | regex `/u` | **8** | `/(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu` |
| `MIME_BY_EXT` | `Record<string,string>` | **9-16** | 6 image exts → mime |
| `TRAILING_PUNCT` | string literal | **17** | `".,;:!?\")]}>'"` |

**Insertion point for new constants:** add `PAGED_THRESHOLD`, `MARGIN`, `HEAD_BYTES`,
`DEFAULT_WINDOW`, `DEFAULT_RESERVE` immediately **after line 17** (after `TRAILING_PUNCT`, before
the blank line 18). This keeps all top-level constants clustered. Suggested form (numbers per PRD):

```ts
const PAGED_THRESHOLD = 0.6; // §5.5 — inject whole if fileCost <= PAGED_THRESHOLD * remaining
const MARGIN = 8192;          // §5.5 — safety bytes subtracted from remaining
const HEAD_BYTES = 8192;      // §5.5 — head block size (~2000 lines, matches read tool default limit)
const DEFAULT_WINDOW = 200000;   // §5.5 — fallback when ctx.model?.contextWindow is absent
const DEFAULT_RESERVE = 8192;    // §5.5 — fallback when ctx.model?.maxTokens is absent
```

⚠️ Note: `DEFAULT_RESERVE` and `MARGIN` are both `8192` by coincidence — they are independent knobs
(MARGIN is the safety subtraction; DEFAULT_RESERVE is the fallback for `maxTokens`). Do not unify.

---

## 2. Format helpers

All four format helpers are clustered in **lines 90-112**:

| Helper | Signature | Line | Body |
|---|---|---|---|
| `formatTextFileBlock` | `(abs, content) => string` | **90-93** | `'<file name="'+abs+'">\n'+content+'\n</file>'` |
| `formatImageBlock` | `(abs, resized) => string` | **95-99** | `<file name="ABS">HINT</file>` |
| `formatBinaryBlock` | `(abs) => string` | **101-105** | em-dash U+2014 binary note |
| `formatEmptyImageBlock` | `(abs) => string` | **107-112** | em-dash U+2014 empty-image note |

**Insertion point for `formatPagedDirectiveBlock`:** add it **immediately after line 112** (after
`formatEmptyImageBlock`, before the blank line 113 and the `injectFiles` JSDoc at 114). This keeps
the format-helper cluster together and places the new paged helper right before its sole consumer.

Per PRD §5.5 "Page path", the directive block must:
- reference the file's full path and estimated size,
- instruct the model to load the remainder via the `read` tool at `offset:0, limit:2000`,
- increment `offset` until the whole file is read.

Suggested signature aligned with the others: `formatPagedDirectiveBlock(abs: string, totalBytes: number): string`.
The **head block** is NOT a new helper — it is `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))`
(§5.5 step 1: "the first `HEAD_BYTES` of the content in a normal `<file name="abs">` block"). So only
the directive note needs a new helper.

---

## 3. `injectFiles` function

**JSDoc:** **lines 114-121** (ends with ` */` on 121).

**Signature + return type:** **lines 122-126**:
```ts
122: export async function injectFiles(
123:   text: string,
124:   imagesIn: ImageContent[],
125:   ctx: { cwd: string },
126: ): Promise<{ text: string; images: ImageContent[]; injected: number }> {
```

⚠️ **CRITICAL — `ctx` param type is `{ cwd: string }`.** §5.5 needs `ctx.getContextUsage()`,
`ctx.model?.contextWindow`, and `ctx.model?.maxTokens` (PRD `prd_snapshot.md:222-224`). **None of
these are currently accessible** — the type must be widened, e.g. to an interface that adds
`getContextUsage?: () => { tokens?: number } | undefined`, `model?: { contextWindow?: number;
maxTokens?: number }`, and/or `modelRegistry?`. See Open Questions §O-1/O-2 in PRD (`prd_snapshot.md:247-248`).

`node_modules` is not installed in this repo (no deps resolved), so the exact `ExtensionAPI` /
input-handler `ctx` shape could not be verified from types here. The caller in the factory handler
(§4 below) receives the real `ctx` from `pi.on("input", (event, ctx) => ...)`, so widening the local
type to accept the richer shape is safe as long as the handler still passes its `ctx` through.

**Local state — lines 127-129:**
```ts
127: const blocks: string[] = [];
128: const images = [...imagesIn];
129: let count = 0;
```
`let count = 0` at **line 129** is the injected-whole counter. A **paged counter** (e.g.
`let paged = 0;`) goes right here, **after line 129**.

**Text/binary branch where `formatTextFileBlock` is called — the §5.5 branch site — lines 194-200:**
```ts
194:   } else {
195:     // TEXT / BINARY path (PRD §5.1 / §5.3) — also the F3 fallback for mislabeled image-ext files.
196:     if (isBinary(buf)) {
197:       blocks.push(formatBinaryBlock(abs));
198:     } else {
199:       blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
200:     }
201:   }
```

**`count++` happens at line 202** (single increment after the image/text/binary branch, inside the
`try` at 169). The `formatEmptyImageBlock` early-return path has its own `count++` at **line 176**
before `continue` at 177.

**This is the inline-vs-paged decision point — line 199.** This is where the §5.5 branch must be
inserted. Per PRD §5.5 "Decision": estimate `fileCost = Math.ceil(content.length / 4)` (heuristic,
per O-3 `prd_snapshot.md:249`), compute `remaining`, and either:
- inline: keep `formatTextFileBlock(abs, content)` as today, OR
- page: push `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))` (head block) + push
  `formatPagedDirectiveBlock(abs, content.length)` (directive), and increment `paged` instead of
  counting toward the whole-count.

The decision must use `buf.toString("utf8")` once and reuse it (currently the toString is inline in
the `blocks.push` call at 199). Recommended refactor: hoist `const content = buf.toString("utf8");`
above the branch, then branch on the budget.

**`count++` placement (line 202) interacts with paged accounting.** If paged files should NOT count
toward `injected` (the "whole" count), then `count++` must move INSIDE the inline branch only, and
`paged++` inside the paged branch. If paged files SHOULD count toward `injected` (simpler, matches
current `if (!injected)` short-circuit), keep `count++` at 202 and add `paged++` alongside. The PRD
notify string (`prd_snapshot.md:240`: "`#@ injected N whole` versus `#@ injected N whole, M paged`")
implies two separate counts, so the cleaner approach is: `count` = whole, `paged` = paged, return
both. **This changes the return type** at line 126 — add `paged: number` (or a mode field).

**Assembly section — lines 209-217:**
```ts
209:   if (count === 0) return { text, images: imagesIn, injected: 0 }; // ORIGINAL ref, byte-for-byte
210: (blank)
211-214: (comment about stripping #@)
215:   const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
216:   const finalText = `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`;
217:   return { text: finalText, images, injected: count };
```
The early-return at **line 209** ("nothing injected → byte-for-byte") must be reconsidered: if
`count === 0 && paged === 0` still means nothing happened; but if paged files exist, `count` could be
0 while work was done. Recommend changing the guard to `if (count === 0 && paged === 0)`. The return
at **line 217** must carry the paged count.

**Remaining-budget accumulator.** §5.5 "Multi-file prompts" (`prd_snapshot.md:238`) requires
subtracting each file's `fileCost` from `remaining` as tokens are processed. Declare a mutable
`let remaining = ...` near the local-state block (after line 129), computed once before the loop
(lines 145-207), and decrement it inside the text branch. **Computing `remaining` requires
`ctx.getContextUsage()` and `ctx.model`**, which the current `ctx: { cwd: string }` type does not
expose — this is the same blocker as the type widening above.

---

## 4. Handler (factory) function

**Factory JSDoc:** **lines 220-244** (module-level `/** #@file — Whole-File Injection Extension */`).
The JSDoc claims "No limits, no config: the whole file is injected every time — no truncation"
(line 238) — **this paragraph must be updated** for §5.5 (inline-when-it-fits, paged-otherwise).

**Factory signature:** **line 245** `export default function (pi: ExtensionAPI) {`

**`input` handler closure:** **lines 246-256**. The three guard lines:
```ts
247: if (event.source === "extension") return { action: "continue" };
248: if (event.streamingBehavior === "steer") return { action: "continue" };
249: if (!event.text?.includes("#@")) return { action: "continue" };
```

**`injectFiles` call:** **line 251**:
```ts
const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
```
If the return type gains `paged`, destructure it here. `ctx` here is the FULL handler ctx (richer
than the `{ cwd: string }` the callee declares) — passing it through is what lets the widened
`injectFiles` ctx type read `model`/`getContextUsage`.

**Notify line — exact, line 254:**
```ts
if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info");
```
Per PRD §5.5 "Notify" (`prd_snapshot.md:240`), this must become mode-aware:
"`#@ injected N whole` versus `#@ injected N whole, M paged`". Update the template literal to include
the paged count when `paged > 0`. The `ctx.hasUI` guard stays (headless print/json guard).

**Return:** **line 255** `return { action: "transform" as const, text, images };` — unchanged.

---

## 5. Inline-vs-paged branch insertion point (the key change)

**Exact location: line 199**, inside the `else` text/binary branch (lines 194-200), in the
`!isBinary(buf)` sub-branch. Current single line:

```ts
199:       blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
```

This is the ONLY site where a whole text file's content is turned into an inline block. The §5.5
decision (inline vs head-block+directive) is inserted here, wrapping this call. See §3 above for the
recommended hoist of `content = buf.toString("utf8")` and the branch logic.

Binary path (line 197) and image path (lines 185-193) are **out of scope** for §5.5 paging
(`prd_snapshot.md:239`: "Paged delivery applies to text only. Images are already resized...
Non-image binaries already get a note").

---

## 6. `let count = 0` (paged counter site)

**`let count = 0;` is at line 129.** A paged counter (`let paged = 0;`) goes on the next line
(after 129, before the blank 130). If a `remaining` budget accumulator is needed (§5.5 multi-file),
it is also declared here.

---

## 7. Regex divergence from PRD §4.2

**Current (line 8):**
```ts
const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
```

The character class is `[\p{L}\p{N}_]` (letter, number, underscore).

⚠️ **This differs from PRD §4.2.** (PRD §4.2 was not reproduced in the §5.5 task excerpt, but the
task explicitly flags the divergence.) The lookbehind `(?<![\p{L}\p{N}_])` treats `_` as a word char
for boundary purposes; if PRD §4.2 specifies a different boundary (e.g. excluding `_`, or using a
`(?<!\w)` ASCII form), the regex at **line 8** and its **second use at line 215**
(`text.replace(FILE_INJECT_RE, ...)`) must both be reconciled. Both uses must stay consistent —
the same regex tokenizes on the way in and strips on the way out. **This is out of scope for §5.5
unless §5.5 work touches tokenization; flagged for awareness only.**

---

## Summary of change sites (ordered top-to-bottom)

| # | Line(s) | Change |
|---|---|---|
| A | after 17 | Add 5 constants (`PAGED_THRESHOLD`, `MARGIN`, `HEAD_BYTES`, `DEFAULT_WINDOW`, `DEFAULT_RESERVE`) |
| B | after 112 | Add `formatPagedDirectiveBlock(abs, totalBytes)` helper |
| C | 114-121 | Update `injectFiles` JSDoc (paged path, new ctx fields) |
| D | 125 | Widen `ctx` type: `{ cwd: string }` → add `getContextUsage?`, `model?`, (resolve O-1/O-2) |
| E | 126 | Widen return type: add `paged: number` (or mode) |
| F | after 129 | Add `let paged = 0;` and `let remaining = ...` |
| G | 194-200 / esp. 199 | Insert inline-vs-paged decision; hoist `content` |
| H | 202 | Reconcile `count++` with paged accounting |
| I | 209 | Change guard to `count === 0 && paged === 0` |
| J | 217 | Return paged count |
| K | 220-244 | Update factory JSDoc ("No limits" claim is now false) |
| L | 251 | Destructure `paged` from `injectFiles` |
| M | 254 | Notify: mode-aware template literal |

---

## Open questions / risks (carry into implementation)

- **O-1/O-2 (PRD `prd_snapshot.md:247-248`):** Is `ctx.getContextUsage()` populated at `input` time?
  Is `ctx.model` shape `{ provider, id }` or does it carry `contextWindow`/`maxTokens`? `node_modules`
  is absent in this repo so the `ExtensionAPI` type could not be inspected here. **Verify against the
  installed `@earendil-works/pi-coding-agent` types before finalizing the widened `ctx` type.** If
  unavailable/unreliable, fall back to always-inline (current behavior) and treat paging as best-effort.
- **O-3 (PRD `prd_snapshot.md:249`):** No string-based token estimator is exported; use
  `fileCost = Math.ceil(content.length / 4)` (chars-per-token heuristic). Sufficient for a threshold gate.
- **Notify pluralization (line 254):** current code pluralizes on `injected === 1`. The §5.5 two-count
  form needs care — "N whole, M paged" pluralizes "whole" on N and "paged" on M independently.
- **`count` semantics:** decide whether paged files count toward `injected` (affects the line-209
  byte-for-byte short-circuit and the line-252 `if (!injected)` guard). Two separate counts is cleaner.
- **Regex (line 8 / 215):** diverges from PRD §4.2 per the task flag. Out of §5.5 scope unless touched.
