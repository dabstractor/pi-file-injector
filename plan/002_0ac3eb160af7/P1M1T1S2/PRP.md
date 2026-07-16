---
name: "P1.M1.T1.S2 — Budget computation and inline-vs-paged decision branch in injectFiles"
prd_ref: "PRD §5.5 (Oversize files: automatic paged delivery) — Budget, Decision, Page path, Multi-file, Open questions O-1/O-2/O-3"
target_file: "./file-injector.ts" (+ paged-delivery tests in "./file-injector.test.mjs")
change_type: surgical-edit (budget logic + branch + final-return) + new harness cases; NO signature change (S1 widened types)
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1 — CONFIRMED IN FILE: 5 constants, formatPagedDirectiveBlock, widened ctx+return types, paged:0 returns"
feeds: "P1.M1.T1.S3 (handler mode-aware notify destructures paged); P1.M1.T2.S1 (README paged-delivery docs)"
---

# PRP — P1.M1.T1.S2: Budget Computation + Inline-vs-Paged Decision Branch

## Goal

**Feature Goal**: Implement PRD §5.5's budget-aware inline-vs-paged decision inside the existing
`injectFiles` text branch. Compute the remaining-context budget ONCE per prompt (best-effort, never
throwing), then for each text file: inject it whole when it fits the budget (or when the budget is
unknown — the O-1 fallback preserving current behavior), or emit a **head block** (first `HEAD_BYTES`)
plus a **paged directive block** when it does not. Add the `paged` counter, decrement a mutable
`remainingBudget` across multi-file prompts, return the computed `paged`, and add 5 paged-delivery
test cases (including a budget-aware mock ctx).

**Deliverable**: Three surgical edits to `./file-injector.ts` (budget+`paged` declaration, the
inline-vs-paged branch, the final-return `paged`) + one edit to `./file-injector.test.mjs` (a new
`PAGED_FIX` budget-aware ctx + 5 new `runCase` blocks). No new files. No signature change (S1 already
widened `ctx`/return types). The existing 34-case harness must grow to **39 passed, 0 failed**.

**Success Definition**:
- [ ] `let paged = 0;` and the budget computation (try/catch, `remainingBudget`) exist in `injectFiles`
      before the token loop, after `let count = 0;`.
- [ ] The text branch decides inline-vs-paged: `if (remainingBudget === null || fileCost <=
      PAGED_THRESHOLD * remainingBudget)` → inline (whole); else head block + directive + `paged++`.
      `content` is hoisted; multi-file subtraction decrements `remainingBudget`.
- [ ] The final return carries the computed `paged` (was hardcoded `0`); the early return stays
      `paged: 0` literal; the guard stays `if (count === 0)` (count===0 ⟹ paged===0).
- [ ] `formatPagedDirectiveBlock` (S1's exported, currently uncalled helper) is now CALLED in the
      page path.
- [ ] Existing budget-less tests (`FIX = { cwd }`) are UNCHANGED and still pass (O-1 fallback → whole).
- [ ] `node ./file-injector.test.mjs` → **39 passed, 0 failed** (5 new PAGED cases).
- [ ] A one-off verification script (below) shows: huge.log under a tight budget → PAGED (paged=1,
      head block = first 8192 bytes, directive present); a.ts under same budget → WHOLE; under no
      budget → WHOLE (fallback); multi-file mixed → injected=2, paged=1.

> **Scope boundary (read carefully):** This subtask is the §5.5 **logic + tests**. It does **NOT**:
> (a) make the handler notify mode-aware ("N whole, M paged"), destructure `paged` in the handler, or
> update the factory JSDoc's "No limits" paragraph — that is **S3**; (b) change the `injectFiles`
> signature or the ctx/return types (S1 widened them) — only the bodies/return value change; (c) touch
> the dedup logic, `FILE_INJECT_RE`, image path, binary path, F3/F5/F4 code, or any helper — those are
> unchanged; (d) edit the README — that is **P1.M1.T2**; (e) wire `DEFAULT_WINDOW` into the budget (the
> O-1 fallback uses `null`, not a default window) or change the early-return guard (stays
> `count === 0`).

## User Persona

**Target User**: End users who `#@` a file larger than the model's remaining context. Today the whole
file is injected regardless of size, risking context overflow / a failed request.

**Use Case**: `#@huge.log` (a multi-MB log) in a conversation that already used most of the context.
After this fix: if it fits remaining context it injects whole (unchanged); if it does not, the model
gets the first ~2000 lines inline plus a directive to page the rest via the `read` tool — so the whole
file still reaches the model across the turn, never silently truncated.

**Pain Points Addressed**: Context overflow on large `#@`'d files; the dishonest "no size gate, huge
files just blow the context" framing. The honest contract becomes "the whole file always reaches the
model" (inline or paged).

## Why

- **§5.5 is the core honesty fix.** A file larger than remaining context cannot be injected whole by
  anyone; silently truncating or letting the request fail are both worse than paging. The input
  handler can only rewrite prompt text, so paging is model-driven: emit head + directive, the model
  issues `read` calls.
- **S1 unblocked this with a typed surface.** The 5 constants, `formatPagedDirectiveBlock`, and the
  widened ctx (optional `getContextUsage?` / `model?`) + return type (`paged: number`) are all in
  place. S2 fills in the budget + branch and populates `paged`.
- **Budget is best-effort by design (O-1).** The `input` event fires before the turn, so
  `getContextUsage()` may be `undefined` or its `tokens` `null`. The fallback is always-inline
  (current behavior) — so this change can NEVER make a previously-working prompt worse.

## What

Three edits to `file-injector.ts` + one edit (5 new cases + a mock) to `file-injector.test.mjs`. The
image path, binary path, dedup, regex, and helpers are untouched. The `count` semantics are unchanged
(counts all delivered files; `paged` is a subset).

### Success Criteria

- [ ] Budget computation lives before the loop, wrapped in try/catch (never throws out of injectFiles).
- [ ] Inline-vs-paged branch matches PRD §5.5 Decision exactly: `remainingBudget === null` OR
      `fileCost <= PAGED_THRESHOLD * remainingBudget` → inline; else paged.
- [ ] Page path emits head block `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))` + directive
      `formatPagedDirectiveBlock(abs, content.length)`; `paged++`.
- [ ] Multi-file: `remainingBudget` is mutable and decremented per file (whole: `-fileCost`; paged:
      `-Math.ceil(HEAD_BYTES/4)`).
- [ ] Final return `{ text, images, injected: count, paged }`; early return `{ ..., injected:0,
      paged:0 }`; guard `if (count === 0)` unchanged.
- [ ] Budget-less ctx (`FIX`) → whole injection (case #2 byte-for-byte unchanged); harness 39/39.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact current line numbers (post-S1), all three
> code edits as unique-text old→new blocks, the verified budget formula (with `path:line` API evidence
> and an empirically-validated outcome table), the item-authoritative formula (which differs from the
> PRD pseudocode in one respect — flagged), the 5 new test cases verbatim, and a reproducible
> model-free verification script.

### Documentation & References

```yaml
# MUST READ — sibling PRP (the scaffold this task builds on; it is the CONTRACT)
- docfile: plan/002_0ac3eb160af7/P1M1T1S1/PRP.md
  why: "Defines the 5 constants, formatPagedDirectiveBlock, the widened ctx (optional getContextUsage?/
        model?) and return type (paged: number), and the paged:0 returns. CONFIRMED already in the file.
        S2 populates paged (was hardcoded 0) and CALLS formatPagedDirectiveBlock (was uncalled)."
  critical: "Do NOT touch the signature/types (S1 widened them). Only the bodies + the final-return
        value change. The early-return paged:0 literal STAYS (count===0 ⟹ paged===0)."

# MUST READ — exact change sites + verified API shapes
- docfile: plan/002_0ac3eb160af7/architecture/implementation_insertion_points.md
  why: "§3/§5/§6 pin the injectFiles local-state block (let count), the text branch decision point
        (the formatTextFileBlock call), and the return sites. NOTE: its §3 speculation about changing
        the guard to `count === 0 && paged === 0` is OVERRULED by the item + system_context §7 — the
        guard stays `count === 0`."
  critical: "Use the exact-text anchors in this PRP (post-S1 line numbers); line numbers shifted after S1."

- docfile: plan/002_0ac3eb160af7/architecture/pi_api_verification.md
  why: "§1 ContextUsage = {tokens:number|null; contextWindow:number; percent:number|null};
        §2 getContextUsage() returns ContextUsage|undefined; §3 ctx.model has REQUIRED contextWindow+
        maxTokens but ctx.model itself is |undefined; estimateTokens takes AgentMessage (not string);
        DEFAULT_MAX_LINES=2000. All VERIFIED with path:line against dist."
  critical: "Null-check the WHOLE getContextUsage() result AND .tokens. Both new ctx fields are optional."

- docfile: plan/002_0ac3eb160af7/architecture/system_context.md
  why: "§2 (API summary + O-1/O-2/O-3 resolution), §3 (insertion points), §4 (test harness mock
        patterns — PAGED_FIX example with the exact budget arithmetic), §7 (counting: count unchanged,
        paged subset, guard stays count===0)."
  section: "§2, §3, §4, §7"

- docfile: plan/002_0ac3eb160af7/architecture/test_and_docs_analysis.md
  why: "§1.1-1.3: harness is a standalone .mjs gate; fs/resizeImage NOT mocked (real temp fixtures);
        FIX={cwd} is the budget-less mock; case #2 (huge.log byte-equality) does NOT need to change
        (O-1 fallback). Confirms new paged tests need a budget-aware PAGED_FIX mock."
  section: "§1.1, §1.2, §1.3, §1.7"

- docfile: plan/002_0ac3eb160af7/prd_snapshot.md
  why: "§5.5 is the spec: Budget formula, Decision (PAGED_THRESHOLD), Page path (head + directive),
        Multi-file subtraction, Scope (text only), Open questions O-1/O-2/O-3."
  section: "§5.5"

# The files being EDITED
- file: ./file-injector.ts
  why: "Edit A (after let count = 0; ~L154), Edit B (text branch ~L224), Edit C (final return ~L242).
        Read injectFiles fully before editing; the budget references ctx.getContextUsage?.() and
        ctx.model?.maxTokens (both widened into the type by S1)."
  pattern: "Match the repo's terse inline-comment style (cite PRD §5.5). Hoist `content` once and
        reuse (currently toString is inline in the blocks.push)."
  gotcha: "`remainingBudget === null` is the O-1 fallback and must short-circuit the inline branch for
        ANY file size — that is what keeps budget-less tests (FIX) whole. The item reads
        `usage.contextWindow` (live ContextUsage), NOT ctx.model?.contextWindow; DEFAULT_WINDOW stays
        unused (don't wire it in)."

- file: ./file-injector.test.mjs
  why: "Add PAGED_FIX after FIX (L213); add 5 runCase blocks before the summary section (L741). Run
        `node ./file-injector.test.mjs` → must be 39/39."
  pattern: "runCase(label, name, async () => { ... assert(...) ... }); — matches the existing cases.
        PAGED_FIX = { cwd, getContextUsage: () => ({tokens:10000,contextWindow:50000,percent:20}),
        model:{contextWindow:50000,maxTokens:8192} }."
  gotcha: "Existing cases use FIX (no budget) → whole — DO NOT change them. New cases use PAGED_FIX.
        Reference mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length) for the expected
        directive string (exported helper). HUGE_LOG_CONTENT is the exact ~2MB fixture string."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDIT (3 edits). 348 lines post-S1. injectFiles at ~L137-242.
├── file-injector.test.mjs       # ← EDIT (+PAGED_FIX, +5 runCase). 34 cases → 39.
├── PRD.md                       # READ-ONLY
├── README.md                    # P1.M1.T2 touches this (NOT this task)
└── plan/002_0ac3eb160af7/
    ├── architecture/{implementation_insertion_points.md, pi_api_verification.md, system_context.md, test_and_docs_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / delta_*.md
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # the scaffold contract (read it)
    └── P1M1T1S2/{research/research_notes.md, PRP.md}   # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — +budget computation + let paged (Edit A); text branch
│                                #            becomes inline-vs-paged (Edit B); final return paged (Edit C).
└── file-injector.test.mjs       # MODIFIED — +PAGED_FIX mock + 5 paged-delivery runCase blocks.
# No new files. No signature/type change. No handler/notify/JSDoc change (S3). No README (P1.M1.T2).
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — `remainingBudget === null` MUST short-circuit the inline branch. When ctx has no
// getContextUsage (the existing FIX={cwd} mock, all current tests), remainingBudget is null → INLINE
// regardless of size. This is the O-1 fallback and the reason case #2 (huge.log byte-for-byte) is
// unchanged. Do NOT replace null with DEFAULT_WINDOW — the item explicitly falls back to null.

// CRITICAL — null-check BOTH the getContextUsage() result AND .tokens. getContextUsage() can return
// undefined (input fires before the turn); .tokens can be null (right after compaction). Either → null
// budget → O-1 fallback. Wrap the whole computation in try/catch (if it throws, → null).

// CRITICAL — item reads `usage.contextWindow` for the window, NOT `ctx.model?.contextWindow`.
// reserve = `ctx.model?.maxTokens ?? DEFAULT_RESERVE`. This differs from the PRD §5.5 pseudocode
// (which wrote `window = ctx.model?.contextWindow ?? DEFAULT_WINDOW`); the ITEM is authoritative.
// DEFAULT_WINDOW stays declared-but-unused (don't delete it; don't wire it in).

// CRITICAL — the early-return guard STAYS `if (count === 0)`. count===0 ⟹ paged===0 (paged++ only
// happens in the text paged sub-branch, which is inside the try that does count++). So the early
// return legitimately hardcodes `paged: 0`. Do NOT change to `count === 0 && paged === 0`.

// GOTCHA — hoist `const content = buf.toString("utf8");` ABOVE the branch; both the inline and paged
// paths use it (whole vs slice). Currently toString is inline in the single blocks.push line.

// GOTCHA — decrement remainingBudget in BOTH branches (whole: -fileCost; paged: -ceil(HEAD_BYTES/4))
// using Math.max(0, ...) so it never goes negative. When remainingBudget is null, skip the decrement.

// GOTCHA — the dedup (priorPaths) is built from INPUT text BEFORE the loop; the paged head+directive
// blocks push to the local blocks[] array (appended to finalText AFTER the loop). No feedback loop,
// no collision. Do NOT touch the dedup. (system_context §5.)

// NO TYPE-CHECK — jiti transpiles only; types erased at load. S1's widened ctx type already accepts
// the budget fields, so passing PAGED_FIX at runtime works. PAGED_FIX's getContextUsage/model are
// plain JS objects/arrow-fns — no Pi internals invoked.
```

## Implementation Blueprint

### Data models and structure

No new data models. The only new local state is `let paged = 0;` and `let remainingBudget: number |
null;` (both inside `injectFiles`, before the loop). The return object gains a real `paged` value
(type already declared by S1).

### Implementation Tasks (ordered by dependencies)

```yaml
PRE-FLIGHT:
  - VERIFY S1 scaffold present: `grep -c "formatPagedDirectiveBlock\|PAGED_THRESHOLD = 0.6\|getContextUsage?:" file-injector.ts`
    → expect >= 3. If absent, STOP (S1 not done).
  - RECORD baseline: `node ./file-injector.test.mjs` → "34 passed, 0 failed".

Task 1: EDIT ./file-injector.ts — Edit A: budget computation + `let paged` (after `let count = 0;`)
  - FIND (unique anchor):
        let count = 0;

        // PRIOR-INJECTION SET
  - REPLACE WITH (insert paged counter + the ONCE-per-prompt budget, wrapped in try/catch):
        let count = 0;
        let paged = 0; // §5.5 paged-delivery counter — files delivered head+directive (subset of count)

        // §5.5 BUDGET — remaining context, computed ONCE (best-effort; never throws out of injectFiles).
        // The input event fires BEFORE the turn, so getContextUsage() may be undefined or its tokens
        // null (right after compaction). Either → remainingBudget = null → O-1 fallback: inject WHOLE
        // (current behavior). When available: remaining = window - used - reserve - MARGIN, clamped ≥ 0.
        let remainingBudget: number | null;
        try {
          const usage = ctx.getContextUsage?.();
          if (usage === undefined || usage.tokens === null) {
            remainingBudget = null; // O-1 fallback: budget unknown → inject whole (no paging)
          } else {
            const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
            remainingBudget = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);
          }
        } catch {
          remainingBudget = null; // getContextUsage threw → O-1 fallback (PRD §12.5: never throw)
        }

        // PRIOR-INJECTION SET
  - EFFECT: `paged` exists; `remainingBudget` is null (fallback) under FIX, 23616 under PAGED_FIX.

Task 2: EDIT ./file-injector.ts — Edit B: inline-vs-paged branch (the text inject site)
  - FIND (unique anchor — the text `else` sub-branch's single line):
        } else {
          blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
        }
  - REPLACE WITH (hoist content; branch on budget; call formatPagedDirectiveBlock in the page path):
        } else {
          // §5.5 INLINE-VS-PAGED — the whole file always reaches the model. Inline when it fits the
          // remaining budget (or budget unknown → O-1 fallback); else head block + paged directive.
          const content = buf.toString("utf8");
          const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
          if (remainingBudget === null || fileCost <= PAGED_THRESHOLD * remainingBudget) {
            // INLINE (whole) — current behavior preserved (PRD §5.1)
            blocks.push(formatTextFileBlock(abs, content));
            if (remainingBudget !== null) remainingBudget = Math.max(0, remainingBudget - fileCost);
          } else {
            // PAGED — head block (first HEAD_BYTES) + directive (PRD §5.5 Page path)
            blocks.push(formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)));
            blocks.push(formatPagedDirectiveBlock(abs, content.length));
            paged++;
            remainingBudget = Math.max(0, remainingBudget - Math.ceil(HEAD_BYTES / 4));
          }
        }
  - EFFECT: whole when budget unknown or file fits; head+directive+paged++ otherwise. count++
    (line below, unchanged) still fires for BOTH paths (delivered either way).

Task 3: EDIT ./file-injector.ts — Edit C: final return uses the computed paged
  - FIND (unique):   return { text: finalText, images, injected: count, paged: 0 };
  - REPLACE WITH:    return { text: finalText, images, injected: count, paged };
  - DO NOT touch the early return `if (count === 0) return { ..., injected: 0, paged: 0 };` — it stays
    literal 0 (count===0 ⟹ paged===0). DO NOT change the guard to `count === 0 && paged === 0`.

Task 4: EDIT ./file-injector.test.mjs — add the budget-aware PAGED_FIX mock (after FIX)
  - FIND (unique):   const FIX = { cwd: TMPDIR };
  - REPLACE WITH:
        const FIX = { cwd: TMPDIR };

        // §5.5 paged-delivery mock ctx — a TIGHT budget so oversize text files page. Huge.log (~2 MB,
        // fileCost ~524K) PAGES; a.ts (~97 chars, fileCost ~25) stays WHOLE.
        //   remaining = 50000 - 10000 - 8192 - 8192 = 23616;  PAGED_THRESHOLD * remaining = 14169.6
        const PAGED_FIX = {
          cwd: TMPDIR,
          getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }),
          model: { contextWindow: 50000, maxTokens: 8192 },
        };
  - NOTE: PIC and BIN path constants (pic.png, data.bin) already exist for cases #3/#4 — reuse them.

Task 5: EDIT ./file-injector.test.mjs — add 5 paged-delivery runCase blocks (before the summary section)
  - FIND (unique anchor — the start of the summary block):
        // 10. Summary + cleanup + exit.
  - INSERT IMMEDIATELY BEFORE IT a new PAGED DELIVERY section:
        // ── PAGED DELIVERY (PRD §5.5) — budget-aware inline-vs-paged ────────────────────────────

        await runCase("PD1", "§5.5 paged: huge.log under tight budget → head + directive, paged=1", async () => {
          const r = await mod.injectFiles("Summarize #@huge.log", [], PAGED_FIX);
          assert(r.injected === 1, `huge.log delivered (count includes paged), got injected=${r.injected}`);
          assert(r.paged === 1, `huge.log must be PAGED under PAGED_FIX, got paged=${r.paged}`);
          // head block = first HEAD_BYTES (8192) of the content
          const expectedHead = '<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT.slice(0, 8192) + '\n</file>';
          assert(r.text.includes(expectedHead), "paged head block must contain the first 8192 bytes");
          // directive block = the exported helper's output
          const expectedDirective = mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length);
          assert(r.text.includes(expectedDirective), "paged directive block must be present (full path + size + read instruction)");
          // #@ stripped from the injected marker; the path stays
          assert(r.text.startsWith("Summarize huge.log"), "#@huge.log must be stripped to huge.log (path stays)");
          assert(r.images.length === 0, "text-file paging attaches NO images");
        });

        await runCase("PD2", "§5.5 mixed: small whole + large paged under tight budget", async () => {
          const r = await mod.injectFiles("Review #@a.ts and #@huge.log", [], PAGED_FIX);
          assert(r.injected === 2, `both files delivered, got injected=${r.injected}`);
          assert(r.paged === 1, `exactly one paged (huge.log), got paged=${r.paged}`);
          // a.ts WHOLE (its full content block present), huge.log paged (head + directive present)
          assert(r.text.includes('<file name="' + A_TS + '">\n' + A_TS_CONTENT + '\n</file>'),
            "a.ts must be injected WHOLE (fits budget)");
          assert(r.text.includes('<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT.slice(0, 8192) + '\n</file>'),
            "huge.log must be paged (head block)");
          assert(r.text.includes(mod.formatPagedDirectiveBlock(HUGE, HUGE_LOG_CONTENT.length)),
            "huge.log directive block present");
        });

        await runCase("PD3", "§5.5 O-1 fallback: budget unknown (FIX) → huge.log injected WHOLE, paged=0", async () => {
          // The existing FIX mock has no getContextUsage → remainingBudget null → O-1 fallback → inline.
          // Complements case #2 (byte-equality) by asserting the paged FIELD directly.
          const r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
          assert(r.injected === 1, `huge.log delivered whole under no budget, got injected=${r.injected}`);
          assert(r.paged === 0, `no paging when budget unknown (O-1 fallback), got paged=${r.paged}`);
          assert(r.text.includes('<file name="' + HUGE + '">\n' + HUGE_LOG_CONTENT + '\n</file>'),
            "huge.log must be the FULL content block (not a head slice) under the O-1 fallback");
        });

        await runCase("PD4", "§5.5 images unaffected by budget: pic.png attaches under PAGED_FIX", async () => {
          // Paging is TEXT-only (PRD §5.5 Scope). An image under a tight budget still attaches.
          const r = await mod.injectFiles("Describe #@pic.png", [], PAGED_FIX);
          assert(r.injected === 1, `image delivered, got injected=${r.injected}`);
          assert(r.paged === 0, `images are never paged, got paged=${r.paged}`);
          assert(r.images.length === 1, `image attached under PAGED_FIX, got ${r.images.length}`);
          assert(r.text.includes('<file name="' + PIC + '">'), "image reference block present");
        });

        await runCase("PD5", "§5.5 binaries unaffected by budget: data.bin note under PAGED_FIX", async () => {
          // Paging is TEXT-only. A binary under a tight budget still gets the binary note (no bytes).
          const r = await mod.injectFiles("Inspect #@data.bin", [], PAGED_FIX);
          assert(r.injected === 1, `binary delivered, got injected=${r.injected}`);
          assert(r.paged === 0, `binaries are never paged, got paged=${r.paged}`);
          assert(r.images.length === 0, `binary attaches NO image, got ${r.images.length}`);
          const expectedNote = '<file name="' + BIN + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
          assert(r.text.includes(expectedNote), "binary note block present (unaffected by budget)");
        });

        // 10. Summary + cleanup + exit.
  - EFFECT: harness goes 34 → 39 passed. Verify PIC/BIN constants exist (they back cases #3/#4); if the
    harness names them differently, use the existing names. HUGE/HUGE_LOG_CONTENT/A_TS/A_TS_CONTENT are
    the established fixture constants (cases #2/#1).

DO NOT (out of scope):
  * touch the handler notify, the factory JSDoc, or destructure `paged` in the handler (S3).
  * change the injectFiles signature or ctx/return types (S1) — only bodies + the final return value.
  * change the early-return guard or its `paged: 0` literal; do NOT add `count === 0 && paged === 0`.
  * touch dedup, FILE_INJECT_RE, image/binary paths, F3/F5/F4, helpers, or the module-surface sanity check.
  * wire DEFAULT_WINDOW into the budget. edit the README (P1.M1.T2).
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (budget — computed ONCE, before the loop, never throws):
let remainingBudget: number | null;
try {
  const usage = ctx.getContextUsage?.();              // optional chaining: FIX has no such method
  if (usage === undefined || usage.tokens === null) {
    remainingBudget = null;                            // O-1 fallback → inject whole
  } else {
    const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
    remainingBudget = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);
  }
} catch {
  remainingBudget = null;                              // §12.5: never throw out of injectFiles
}

// PATTERN (inline-vs-paged branch — the §5.5 Decision):
const content = buf.toString("utf8");
const fileCost = Math.ceil(content.length / 4);        // O-3 heuristic (chars/4)
if (remainingBudget === null || fileCost <= PAGED_THRESHOLD * remainingBudget) {
  blocks.push(formatTextFileBlock(abs, content));      // INLINE (whole)
  if (remainingBudget !== null) remainingBudget = Math.max(0, remainingBudget - fileCost);
} else {
  blocks.push(formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)));  // head block
  blocks.push(formatPagedDirectiveBlock(abs, content.length));          // directive (S1 helper)
  paged++;
  remainingBudget = Math.max(0, remainingBudget - Math.ceil(HEAD_BYTES / 4));
}
// count++ below — UNCHANGED — fires for BOTH paths (whole and paged are both "delivered").

// WHY null short-circuits inline: when budget unknown (FIX), remainingBudget===null makes the `||`
//   TRUE → inline for ANY size → case #2 (huge.log byte-for-byte) stays green. This is the O-1 fallback.
// WHY Math.max(0, ...) on decrements: remainingBudget never goes negative; later files see a sane floor.
// WHY usage.contextWindow not ctx.model?.contextWindow: the live ContextUsage carries the ACTUAL current
//   window (may differ from the model's nominal window); the item is authoritative on this.
// WHY count===0 ⟹ paged===0: paged++ is inside the text paged sub-branch, which is inside the try that
//   does count++. So paged ≤ count always → the early-return guard stays `count === 0` (no guard change).
```

### Integration Points

```yaml
NO SIGNATURE/CONFIG CHANGE:
  - "injectFiles signature + ctx/return types unchanged (S1 widened them). The handler still calls
    injectFiles(event.text, event.images ?? [], ctx) and destructures {text, images, injected} — it
    IGNORES the now-populated paged field until S3 makes the notify mode-aware."
  - "formatPagedDirectiveBlock (S1's exported, uncalled helper) is now CALLED in the page path."
  - "No new imports (HEAD_BYTES/PAGED_THRESHOLD/MARGIN/DEFAULT_RESERVE are module consts from S1;
    ctx.getContextUsage/ctx.model are on the widened ctx type from S1)."
  - "No README change (P1.M1.T2). No new env vars / config (PRD §13.4: no user-facing config)."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension validated
> by a **model-free Node ESM harness** (`file-injector.test.mjs`, currently 34 cases, `node`). The
> Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. The gates below are
> project-specific and have been **verified working on this machine** (the budget arithmetic and branch
> outcomes were simulated empirically — see research_notes.md §5).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. `let paged` + the budget computation present before the loop; `remainingBudget` declared.
grep -qE "let paged = 0;" file-injector.ts && grep -q "let remainingBudget: number | null" file-injector.ts \
  && grep -q "ctx.getContextUsage?.()" file-injector.ts && echo "OK: budget+paged declared" || echo "FAIL: budget/paged missing"

# 1b. The inline-vs-paged branch exists and CALLS formatPagedDirectiveBlock in the page path.
grep -q "fileCost <= PAGED_THRESHOLD * remainingBudget" file-injector.ts \
  && grep -q "content.slice(0, HEAD_BYTES)" file-injector.ts \
  && grep -q "formatPagedDirectiveBlock(abs, content.length)" file-injector.ts \
  && grep -q "paged++" file-injector.ts && echo "OK: branch + page path present" || echo "FAIL: branch"

# 1c. Final return uses the computed `paged` (not literal 0); early return still literal 0.
grep -q "return { text: finalText, images, injected: count, paged };" file-injector.ts && echo "OK: final return paged" || echo "FAIL: final return"
grep -q "if (count === 0) return { text, images: imagesIn, injected: 0, paged: 0 };" file-injector.ts && echo "OK: early return+guard unchanged" || echo "FAIL: early return/guard changed"

# 1d. The guard was NOT changed to count === 0 && paged === 0 (it must stay count === 0).
grep -qE "count === 0 && paged === 0" file-injector.ts && echo "FAIL: guard wrongly changed" || echo "OK: guard stays count === 0"

# 1e. DEFAULT_WINDOW was NOT wired into the budget (the fallback uses null).
grep -qE "DEFAULT_WINDOW" file-injector.ts && grep -qE "usage.contextWindow - usage.tokens" file-injector.ts \
  && ! grep -qE "ctx.model\?\.contextWindow \?\? DEFAULT_WINDOW" file-injector.ts \
  && echo "OK: window from usage.contextWindow; DEFAULT_WINDOW unused" || echo "FAIL: window source"

# 1f. Test harness gained PAGED_FIX + 5 PD cases.
grep -q "const PAGED_FIX" file-injector.test.mjs && echo "OK: PAGED_FIX mock" || echo "FAIL: PAGED_FIX"
for c in PD1 PD2 PD3 PD4 PD5; do grep -q "runCase(\"$c\"" file-injector.test.mjs && echo "OK: case $c" || echo "FAIL: case $c"; done

# Expected: every line prints OK.
```

### Level 2: Regression + New Cases — Existing Harness (Component Validation)

```bash
# MUST report 39 passed / 0 failed (was 34; +5 PD cases). The 34 existing cases are unchanged:
# budget-less FIX → O-1 fallback → whole (case #2 byte-for-byte huge.log still green).
node ./file-injector.test.mjs
# Expected: "Result: 39 passed, 0 failed." and exit code 0.
# If an EXISTING case fails: remainingBudget===null did NOT short-circuit the inline branch — re-check
# Edit B's condition order (`remainingBudget === null || ...` must be first). If a PD case fails, read
# the assertion message (most likely: head-block slice mismatch, or paged field not returned).
```

### Level 3: Behavior Verification (the §5.5 logic — NON-INTERACTIVE, NO MODEL)

Run this throwaway script (do NOT add it to the harness). It exercises the REAL `injectFiles` via the
same jiti+alias import pattern, proving: tight budget → huge.log PAGED (head=first 8192 bytes,
directive present, paged=1); a.ts WHOLE; no-budget FIX → huge.log WHOLE (paged=0); mixed → injected=2
paged=1. **Budget arithmetic pre-verified** (research_notes.md §5).

```bash
cat > /tmp/verify_paged_s2.mjs <<'EOF'
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const mod = await jiti.import(path.resolve("file-injector.ts"));

const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "paged-s2-"));
const HUGE_BODY = "line\n".repeat(420000); // ~2.1 MB > HEAD_BYTES(8192)
const HUGE = path.join(TMP, "huge.log");
const SMALL = path.join(TMP, "a.ts");
await fs.writeFile(HUGE, HUGE_BODY);
await fs.writeFile(SMALL, "export const x = 1;\n");

const PAGED_FIX = { cwd: TMP, getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }), model: { contextWindow: 50000, maxTokens: 8192 } };
const FIX = { cwd: TMP };
let pass=0, fail=0; const ok=(n,c,d="")=>{console.log((c?"PASS":"FAIL")+": "+n+(c?"":"  "+d));c?pass++:fail++;};

// 1. tight budget → huge.log PAGED
let r = await mod.injectFiles("Summarize #@huge.log", [], PAGED_FIX);
ok("huge.log PAGED: injected=1", r.injected===1, "got "+r.injected);
ok("huge.log PAGED: paged=1", r.paged===1, "got "+r.paged);
ok("huge.log PAGED: head = first 8192 bytes", r.text.includes('<file name="'+HUGE+'">\n'+HUGE_BODY.slice(0,8192)+'\n</file>'));
ok("huge.log PAGED: directive present", r.text.includes(mod.formatPagedDirectiveBlock(HUGE, HUGE_BODY.length)));
ok("huge.log PAGED: #@ stripped", r.text.startsWith("Summarize huge.log"));

// 2. tight budget → a.ts WHOLE
r = await mod.injectFiles("Review #@a.ts", [], PAGED_FIX);
ok("a.ts WHOLE under budget: injected=1,paged=0", r.injected===1 && r.paged===0, "inj="+r.injected+" paged="+r.paged);
ok("a.ts WHOLE: full content", r.text.includes('<file name="'+SMALL+'">\nexport const x = 1;\n\n</file>') || r.text.includes('<file name="'+SMALL+'">\nexport const x = 1;\n</file>'));

// 3. no budget (FIX) → huge.log WHOLE (O-1 fallback)
r = await mod.injectFiles("Summarize #@huge.log", [], FIX);
ok("O-1 fallback: huge.log WHOLE, paged=0", r.injected===1 && r.paged===0, "inj="+r.injected+" paged="+r.paged);
ok("O-1 fallback: full content (not head slice)", r.text.includes('<file name="'+HUGE+'">\n'+HUGE_BODY+'\n</file>'));

// 4. mixed multi-file → injected=2, paged=1
r = await mod.injectFiles("Review #@a.ts and #@huge.log", [], PAGED_FIX);
ok("mixed: injected=2", r.injected===2, "got "+r.injected);
ok("mixed: paged=1", r.paged===1, "got "+r.paged);

fsSync.rmSync(TMP, { recursive: true, force: true });
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
EOF
node /tmp/verify_paged_s2.mjs
# Expected: all checks PASS; "<n> passed, 0 failed"; exit 0.
rm -f /tmp/verify_paged_s2.mjs
```

### Level 4: Live Pi Paged Delivery (Integration — OPTIONAL, needs a model)

Only if a provider/API key is configured. Confirms a real `#@huge.log` pages end-to-end (the model
receives the head block + directive and can `read` the rest). Level 2/3 already prove the logic.

```bash
mkdir -p /tmp/paged-e2e && head -c 2100000 /dev/urandom | base64 > /tmp/paged-e2e/huge.log
pi --model "deepseek/deepseek-chat" --no-tools -ne -e ./file-injector.ts -p \
  'Summarize #@/tmp/paged-e2e/huge.log in one sentence.'
# Under a typical budget the model's prompt should contain a head block (first ~8KB) + the paged
# directive (instructing read offset:0/limit:2000). If context is ample it may still inject whole —
# that is correct (the decision is budget-dependent). The key invariant: NO silent truncation.
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all edit checks print OK (budget+paged declared; branch + page path; final return `paged`;
      early return/guard unchanged; no `count===0 && paged===0`; window from `usage.contextWindow`;
      PAGED_FIX + 5 PD cases present).
- [ ] Level 2: `node ./file-injector.test.mjs` → **39 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_paged_s2.mjs` → all checks PASS, exit 0.
- [ ] Level 4 (optional): live `#@huge.log` shows head + directive (no silent truncation).

### Feature Validation
- [ ] Tight budget + oversize text → PAGED: head block (first `HEAD_BYTES`) + directive block;
      `paged === 1`; `injected` counts it; `#@` stripped; no image attached.
- [ ] Tight budget + small text → WHOLE (`paged === 0`, full content block).
- [ ] No budget (`FIX`) → O-1 fallback → WHOLE for any size (`paged === 0`); case #2 unchanged.
- [ ] Mixed multi-file → each file's `fileCost` subtracted from `remainingBudget`; `injected` = whole +
      paged; `paged` = paged subset.
- [ ] Images & binaries UNCHANGED by budget (text-only paging); `paged === 0` for them.

### Code Quality Validation
- [ ] Only the three specified code edits + the test edits (PAGED_FIX + 5 PD cases); nothing else.
- [ ] `count++` placement/semantics unchanged; early-return guard stays `count === 0`.
- [ ] Budget computation wrapped in try/catch (never throws out of injectFiles); null-checks both the
      getContextUsage() result and `.tokens`.
- [ ] Dedup, regex, image/binary paths, F3/F5/F4, helpers, signature/types — all untouched.
- [ ] `formatPagedDirectiveBlock` now CALLED (was S1's uncalled export); head block reuses
      `formatTextFileBlock(abs, content.slice(0, HEAD_BYTES))` (no new head helper).

### Documentation & Deployment
- [ ] Inline comments cite PRD §5.5 (budget, Decision, Page path, O-1/O-3).
- [ ] No new env vars / config / API surface (internal logic; PRD §13.4: no user-facing config).
- [ ] Handler notify / factory JSDoc NOT touched here (S3); README NOT touched here (P1.M1.T2).

---

## Anti-Patterns to Avoid

- ❌ Don't change the `injectFiles` signature or ctx/return types — S1 widened them; only the bodies
  and the final-return value change.
- ❌ Don't change the early-return guard to `count === 0 && paged === 0` — it stays `count === 0`
  (count===0 ⟹ paged===0, since paged++ is always paired with count++).
- ❌ Don't reorder the branch condition — `remainingBudget === null ||` MUST be first so budget-less
  ctx (FIX) short-circuits to inline for any file size (this is what keeps case #2 green).
- ❌ Don't wire `DEFAULT_WINDOW` into the budget. The O-1 fallback uses `null` (whole injection), not a
  default window. Read `usage.contextWindow` for the window (the live ContextUsage), not
  `ctx.model?.contextWindow`.
- ❌ Don't forget to decrement `remainingBudget` in BOTH branches (whole: `-fileCost`; paged:
  `-ceil(HEAD_BYTES/4)`), each clamped with `Math.max(0, …)`.
- ❌ Don't wrap the branch arithmetic in try/catch redundantly — only the budget COMPUTATION (the
  getContextUsage call) needs the try/catch; the branch is pure arithmetic.
- ❌ Don't touch the dedup logic, regex, image/binary paths, F3/F5/F4, or helpers — paging is text-only.
- ❌ Don't change `count++` — it counts ALL delivered files (whole + paged); `paged` is a subset.
- ❌ Don't add the handler notify / factory JSDoc / `paged` destructuring here — that's S3.
- ❌ Don't modify the existing 34 cases — they use budget-less `FIX` and must stay green via the O-1
  fallback. Add NEW `PD1`–`PD5` cases with `PAGED_FIX`.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: S1's scaffold is confirmed in place (5 constants, `formatPagedDirectiveBlock`, widened
types, `paged:0` returns), so S2 is a pure body/logic fill at three unique-text anchors. The budget
formula is VERIFIED against the installed Pi types (`ContextUsage`/`model` shapes with path:line
evidence), the item-authoritative detail (read `usage.contextWindow`, not `ctx.model?.contextWindow`)
is flagged, and — critically — the **branch arithmetic and all five outcome scenarios were simulated
empirically in this environment** (PAGED_FIX→23616; huge.log→PAGED head 8192; a.ts→WHOLE; FIX→null→
WHOLE fallback; mixed→injected2/paged1). The O-1 fallback (`remainingBudget === null ||` first) is the
load-bearing guarantee that the existing 34 cases stay green. The 5 new PD cases are given verbatim
and reference existing fixture constants (HUGE/HUGE_LOG_CONTENT/A_TS/PIC/BIN). Residual 1.0 is for a
possible transcription slip in a multi-line edit anchor or a PD-case fixture-name mismatch — fully
caught by Level 1 (1a–1f), Level 2 (39/39), and Level 3.
