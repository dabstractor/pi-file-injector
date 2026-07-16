# Delta PRD: `#@file` — Automatic Paged Delivery for Oversize Files

**Status:** Draft · **Delta against:** `plan/001_5aa8724eb506` (MVP, fully implemented) · **Artifact type:** modification to existing `file-injector.ts`

---

## 1. What Actually Changed (Diff Analysis)

A line-by-line diff of the previous PRD (`plan/001_5aa8724eb506/prd_snapshot.md`) vs. the current PRD (`PRD.md`) yields **two** categories of change. Only **one** requires implementation work.

### Change A — Strip the `#@` trigger from injected markers (§6.2, §9, §10 row, §12.10)
The current PRD adds: on a successful injection, strip the `#@` trigger from each inline marker (the **path** stays as a reference); failed tokens keep their `#@` verbatim.

**Already implemented.** `file-injector.ts:215-216` already does:
```ts
const strippedText = text.replace(FILE_INJECT_RE, (_m, _boundary, path) => path);
const finalText = `${strippedText}\n\n---\n\n${blocks.join("\n\n")}`;
```
…and `README.md:31` already documents it. **No delta task.**

### Change B — Automatic paged delivery for oversize files (§5.5) ← THE DELTA
A new §5.5 flips the core contract from *“inject the whole file always, accept that huge files blow the context”* to *“the whole file always **reaches the model**: injected inline when it fits remaining context, paged through the model’s `read` tool when it does not.”* This is accompanied by reframing prose in §1/§2/§13 (same mechanism, no separate implementation) and updated acceptance rows in §10/§11.

**Not implemented.** The current text path always injects the entire file (`file-injector.ts`, `// ENTIRE file, no truncation (§5.1)`), and the notify is a plain count with no whole/paged distinction (`file-injector.ts:254`). **This delta implements §5.5.**

### Removed / reworded (noted for awareness — no tasks)
- §13.5 “Relationship to a possible future size-gated `@` extension” → “Relationship to a size-gated `@`”: now states §5.5 makes a separate `@` extension unnecessary. Pure rationale; nothing to build or remove.

---

## 2. Scope of This Delta

**Add paged delivery to `injectFiles`** so that a text file larger than the model’s remaining context budget is delivered as a head block plus a paging directive (instructing the model to read the rest via the `read` tool) instead of being injected whole (where it would overflow or error). Everything else — detection regex, path resolution, image/binary/missing handling, strip-`#@`, autocomplete provider — is **unchanged**.

### Verified context (resolves PRD §5.5 open questions O-1/O-2/O-3 — no re-research needed)
Evidence captured from the installed package (`@earendil-works/pi-coding-agent`, v0.80.7):

- **O-1 — `ctx.getContextUsage()` population at `input` time.** `ContextUsage` is `{ tokens: number | null; contextWindow: number; percent: number | null }` (`dist/core/extensions/types.d.ts:192`). `tokens` is **explicitly nullable** — “unknown … right after compaction, before next LLM response.” The `input` event fires *before* the turn, so `tokens` may be `null`. `getContextUsage()` itself returns `ContextUsage | undefined`. **⇒ The budget is best-effort.** When `getContextUsage()` is `undefined` OR `tokens` is `null`, fall back to injecting whole (current behavior). `contextWindow` is carried in `ContextUsage` itself, so use it directly when available.
- **O-2 — `ctx.model` shape.** `ctx.model: Model<Api> | undefined` (`dist/core/extensions/types.d.ts` ExtensionContext). `Model<Api>` has `contextWindow: number` and `maxTokens: number`, **both always present** (defaulted to `128000` / `16384` in `model-registry.js parseModels`). No `ctx.modelRegistry` lookup needed; just guard against `ctx.model === undefined` and fall back to whole injection.
- **O-3 — token estimator.** `estimateTokens(message: AgentMessage): number` (`dist/core/compaction/compaction.d.ts:59`) — takes an `AgentMessage`, **not a string**. No exported string-based estimator exists. **⇒ Use the heuristic `fileCost = Math.ceil(content.length / 4)`** (matches the `faux` provider’s internal estimate) — sufficient for a threshold gate.
- **`read` tool default `limit`** is `DEFAULT_MAX_LINES = 2000` (`dist/core/tools/truncate.d.ts:10`) — confirms `HEAD_BYTES = 8192` ≈ 2000 lines, aligning the head block with the directive’s `limit:2000`.

---

## 3. Implementation Requirements

### Requirement PD-1 — Budget-aware paged delivery in `injectFiles`
Modify `injectFiles` (currently `(text, imagesIn, ctx: { cwd: string })`) to compute a remaining-context budget per text file and branch between **inject-whole** (current behavior, when the file fits) and **paged** (head block + directive, when it would overrun the budget). **Scope: text files only.** Images are already resized (§5.2); non-image binaries already get a note (§5.3); neither path changes.

**Rules (PRD §5.5):**
1. **Compute budget once per prompt** (before the token loop), best-effort:
   - `usage = ctx.getContextUsage()`; if `usage === undefined` or `usage.tokens === null` → **no paging** this turn (every text file injects whole; current behavior). This is the documented O-1 fallback.
   - Otherwise: `window = usage.contextWindow`; `used = usage.tokens`; `reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE`; `remaining = window - used - reserve - MARGIN`. Clamp `remaining` to a floor (e.g. `≥ 0`) before use.
   - If `ctx.model === undefined` → still use `DEFAULT_WINDOW`/`DEFAULT_RESERVE` with the same `usage.tokens` if present; otherwise fall back to whole.
2. **Per text-file decision**, after reading + the existing binary check, before formatting the block:
   - `fileCost = Math.ceil(content.length / 4)` (O-3 heuristic).
   - If `remaining` is unknown (no budget) OR `fileCost <= PAGED_THRESHOLD * remaining` → **inject whole** (current `formatTextFileBlock`). Subtract `fileCost` from `remaining` so later tokens in the same prompt see an updated budget (PRD §5.5 “Multi-file prompts”).
   - Else → **paged path**: emit (a) a head block = `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))`, then (b) a paging directive block naming the absolute path + estimated total bytes, instructing the model to `read` the remainder at `offset:0, limit:2000`, incrementing `offset` until the file is exhausted. Do **not** subtract the full `fileCost` for a paged file (only the head cost ≈ `Math.ceil(HEAD_BYTES / 4)`), since the bulk is read via the tool across the turn.
3. **Counting.** `injected` stays a single count of files delivered (whole **or** paged both count as delivered). Add a second counter `paged` so the handler notify can report mode. The `count === 0 → continue` (byte-for-byte) path is unchanged.
4. **Never throw.** Budget computation must live inside the existing per-file try/catch; any error → leave the token verbatim and continue (PRD §12.5).

**New constants (pin at module top, near `TRAILING_PUNCT`):**
`PAGED_THRESHOLD = 0.6`, `MARGIN = 8192`, `HEAD_BYTES = 8192`, `DEFAULT_WINDOW = 200000`, `DEFAULT_RESERVE = 8192`.

**New format helpers** (pure, alongside the existing `format*Block` helpers):
- `formatPagedDirectiveBlock(abs: string, totalBytes: number): string` — emits the `<file name="…">…</file>` directive block. Exact wording from PRD §5.5: note the file is large, give its absolute path and estimated byte size, instruct the model to load the remainder with the `read` tool at `offset:0, limit:2000`, incrementing `offset` until the entire file is read. (Reuse the em-dash `—` convention from the existing binary/empty-image notes for visual consistency.)
- The head block **reuses** `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))` — no new helper needed.

**Signature change.** `injectFiles`’s `ctx` param widens from `{ cwd: string }` to `{ cwd: string; getContextUsage?: () => ContextUsage | undefined; model?: { contextWindow: number; maxTokens: number } | undefined }`. Passing the real `ctx` (an `ExtensionContext`, which satisfies this structurally) is already what the handler does at `file-injector.ts:251`; keep the structurally-typed param so the pure core stays testable in isolation (mirrors the existing pattern at `file-injector.ts:183`).

- **Mode A docs:** Update the JSDoc on `injectFiles` and the default-export factory. Both currently say the whole file is injected with **no limit / large files may blow context** — that is now wrong. Reword to: the whole file always reaches the model; injected whole when it fits remaining context, paged via the model’s `read` tool when it does not. Reference PRD §5.5.

### Requirement PD-2 — Handler notify reports whole vs. paged mode
Update the single notify line (`file-injector.ts:254`) so the surfaced message distinguishes mode, guarded on `ctx.hasUI` (unchanged). `injectFiles` must return `paged` alongside `injected` (PD-1 counting rule 3).
- All-whole: `#@ injected N whole` (or `N whole file(s)` — keep existing pluralization style).
- Any-paged: `#@ injected N whole, M paged` (only include the `M paged` segment when `paged > 0`).
- `injected === 0` still returns `continue` (byte-for-byte) — unchanged.

- **Mode A docs:** none beyond the PD-1 JSDoc touch.

---

## 4. Acceptance — Updated & New Cases

Re-run the full §11 matrix is unnecessary; the strip-`#@`, image, binary, missing, mid-word, `@`-non-interference, and autocomplete behaviors are untouched. **Delta validation focuses on the size path:**

| # | Setup | Input | Expected |
|---|---|---|---|
| PD-T1 (was #2) | `huge.log` (50 MB, > remaining context) | `Summarize #@huge.log` | Head block (first ~8 KB) injected inline; paging directive appended naming the abs path + size and instructing `read` at `offset:0, limit:2000`, incrementing; notify says `whole, M paged`; the model reads the rest via `read`. Never silently truncated. |
| PD-T2 (small) | `a.ts` (~50 words, fits) | `Review #@a.ts` | Injected whole as today; **no** directive; notify `whole`. Confirms small-file path unchanged. |
| PD-T3 (multi, mixed) | small `a.ts` + large `huge.log` | `Diff #@a.ts and #@huge.log` | `a.ts` whole, `huge.log` paged; budget for `huge.log` reflects `a.ts`’s subtraction; notify `1 whole, 1 paged`. |
| PD-T4 (budget unknown) | `huge.log`; force `getContextUsage()` → undefined (e.g. fresh session / right after compaction where `tokens` is null) | `Summarize #@huge.log` | Falls back to **whole** injection (current behavior); notify `whole`. No crash. |
| PD-T5 (regression) | `pic.png` | `Describe #@pic.png` | Image attached + reference block; **no** paging (images out of scope). Unchanged. |
| PD-T6 (regression) | `data.bin` (NUL) | `Inspect #@data.bin` | Binary note block; **no** paging. Unchanged. |
| PD-T7 (regression) | bare `@a.ts` | `Review @a.ts` | Byte-for-byte unchanged; no injection. |

**Done-definition for this delta:** PD-T1…PD-T4 pass with no uncaught errors; the model receives *all* of every `#@`-injected file (whole for fits, head+paged-rest for oversize); PD-T5…PD-T7 confirm no regression; the budget unknown case (PD-T4) gracefully degrades to whole injection.

---

## 5. Documentation Impact

**Mode A — doc-with-work (rides with PD-1):** the two JSDoc blocks in `file-injector.ts` (on `injectFiles` and the default-export factory) currently over-promise “no limit; large files may blow context.” Update both to describe paged delivery per §5.5. No other code-adjacent docs change.

**Mode B — changeset-level (final requirement, depends on PD-1 + PD-2):** `README.md` is now stale and must be synced:
- **“Why”** (line 3): “with no size limit” framing is still conceptually true but the implied overflow claim is wrong; reword to “the whole file always reaches the model — injected whole when it fits, paged via the `read` tool when it doesn’t.”
- **“What gets injected” table** (line 41, Text row): add that large text files exceeding remaining context are delivered as a head block plus a paging directive (the model reads the rest via `read`), never silently truncated.
- **“Limits”** (line 72, *No size gate* bullet): this is now **factually wrong** (`#@` no longer just injects 50 MB and overflows — it pages). Replace the bullet: there is no user-facing size knob; oversize text is paged automatically; the model never holds a file larger than its context all at once (a property of the medium, not the extension).

This is a genuine cross-cutting doc sync that only makes sense once PD-1/PD-2 land → it becomes the final task.

---

## 6. Proposed Breakdown (for the breakdown agent)

**One phase, one milestone, three tasks** — proportionate to a single-function medium feature:

- **Phase PD1 — Paged Delivery for Oversize Files**
  - **Milestone PD1.M1 — Implement & Validate Paged Delivery**
    - **Task PD1.M1.T1 — Budget-aware paged delivery in `injectFiles`** (PD-1 + PD-2 code; JSDoc Mode A touch): new constants, `formatPagedDirectiveBlock`, budget computation with O-1/O-2 fallbacks, per-text-file inline-vs-paged branch, multi-file `remaining` subtraction, `paged` counter, signature widening, and the handler notify update. ~2 subtasks (helpers+constants; core branch + notify).
    - **Task PD1.M1.T2 — Acceptance validation** (§4): execute PD-T1…PD-T7; confirm whole/paged/unknown-budget/mixed behaviors and no regression against the untouched paths.
    - **Task PD1.M1.T3 — Sync changeset-level documentation** (Mode B): rewrite the stale README “Why”, “What gets injected”, and “Limits” sections to reflect paged delivery. Depends on T1 + T2.

**What this delta does NOT include** (keep scope tight): no new syntax, no image/binary/missing/dir changes, no strip-`#@` work (done), no autocomplete changes, no re-validation of the full 14-case MVP matrix beyond the size-path rows.
