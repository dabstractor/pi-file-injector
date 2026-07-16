---
name: "P1.M1.T1.S3 — Handler notify reports whole-vs-paged mode; update factory JSDoc"
prd_ref: "PRD §5.5 (Notify) — '#@ injected N whole' vs '#@ injected N whole, M paged'; §12.11 'Whole file always reaches the model'; delta_prd PD-2"
target_file: "./file-injector.ts" (2 edits: handler + factory JSDoc) + "./file-injector.test.mjs" (+4 PN cases)
change_type: surgical finish of the §5.5 chain — consume S2's `paged` in the input handler + fix the now-false factory JSDoc
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
---

# PRP — P1.M1.T1.S3: Mode-Aware Handler Notify + Factory JSDoc Update

## Goal

**Feature Goal**: Finish the PRD §5.5 paged-delivery chain at the **handler surface**. The input
handler currently destructures only `{ text, images, injected }` and emits a single
`` `#@ injected N file(s)` `` notify. `injectFiles` (S2) now ALSO returns a `paged` count, so the
handler must (a) destructure `paged`, (b) branch the notify message — `paged > 0` ⇒
`` `#@ injected N whole, M paged` ``; `paged === 0` ⇒ the existing pluralized `` `#@ injected N file(s)` ``
style (PRD §5.5 "Notify"), and (c) update the **factory JSDoc** whose "No limits, no config … the
whole file is injected every time — no truncation" paragraph is now factually false (§12.11, §13.1).

**Deliverable**: Two edits to `./file-injector.ts` (the handler block L308–311; the factory JSDoc
paragraph L295–297-portion) and four new handler-level test cases (PN1–PN4) in
`./file-injector.test.mjs`. `injectFiles`, its types, the early-return guard, and the `transform`
return are all UNCHANGED — S3 only *consumes* the `paged` field S2 already populates.

**Success Definition**:
- [ ] Handler destructures `paged` from `injectFiles` and computes `whole = injected - paged`.
- [ ] Notify is mode-aware: `paged > 0` → `` `#@ injected N whole, M paged` ``; `paged === 0` →
      `` `#@ injected N file(s)` `` (existing style, F4 pluralization preserved).
- [ ] The `if (!injected) return { action: "continue" }` guard and the
      `return { action: "transform", text, images }` are byte-for-byte unchanged.
- [ ] Factory JSDoc's "No limits, no config" paragraph is replaced with the §5.5 inline-vs-paged
      description; the loop-prevention / steering / never-throw sentence is kept verbatim.
- [ ] `node ./file-injector.test.mjs` → **43 passed, 0 failed** (was 39; +4 PN cases). The 39
      existing cases stay green (every existing notify case uses a budget-less ctx → `paged === 0`).

> **Scope boundary (read carefully):** S1 (constants + `formatPagedDirectiveBlock` + widened types +
> `paged:0` returns + JSDoc) and S2 (budget computation + inline-vs-paged branch + `paged++` +
> final-return `paged`) are ALREADY LANDED. S3 does **NOT** touch `injectFiles`, its signature, its
> ctx/return types, the early-return guard, the `transform` return, `makeMockCtx`/`captureHandler`/
> `PAGED_FIX`/`FIX`, or the README (README is **P1.M1.T2**). S3 only (a) consumes `paged` in the
> handler, (b) rewrites the now-false factory JSDoc paragraph, and (c) adds handler-notify tests.

## User Persona

**Target User**: The interactive Pi user (TUI / `pi -p` / RPC). After this change, the inline toast
that confirms a `#@` injection tells them **whether any file was paged** — so a `#@` on a 2 MB log
under a tight budget shows `#@ injected 0 whole, 1 paged` (the model will read it via the `read`
tool) instead of silently implying the whole file is inline.

**Use Case**: User writes `Review #@a.ts and #@huge.log`. The toast reports `#@ injected 1 whole,
1 paged` — they instantly know `a.ts` is inline and `huge.log` is paged, so they understand why the
model may issue `read` calls for the rest of `huge.log`.

**User Journey**: submit prompt → `input` handler runs `injectFiles` → handler computes `whole`/`paged`
→ `ctx.ui.notify(msg, "info")` (guarded on `ctx.hasUI`) → toast surfaces the mode → model replies.

**Pain Points Addressed**: Before S3, the toast said `#@ injected 2 files` even when one was paged,
implying both were fully inline — misleading once §5.5 paging exists. S3 makes the toast honest about
inline-vs-paged delivery (PRD §13.1 "be honest about it").

## Why

- **Closes the §5.5 chain at the user-visible surface.** S1+S2 made `paged` available; without S3 the
  handler ignores it and the toast lies. The notify is the only user-visible signal of paging (the
  extension cannot call tools itself — PRD §5.5 "the input handler only rewrites prompt text").
- **The factory JSDoc is now wrong.** It claims "no truncation … the whole file is injected every
  time … Large files may blow the model's context; that is the documented, intended behavior." §12.11
  and §13.1 retract that: the whole file still always reaches the model, but **inline when it fits,
  paged when it exceeds the budget**. PRD §5.5 DOCS Mode A requires this code-adjacent doc fix.
- **Zero-risk to existing behavior.** Every legacy notify case uses a budget-less ctx → `paged === 0`
  → the existing message style, so the change is strictly additive for backward compat.

## What

Two edits to `file-injector.ts` (handler block; factory JSDoc paragraph) + four new `runCase`
entries (PN1–PN4) in `file-injector.test.mjs`. No new files, no new exports, no signature change, no
config, no README.

### Success Criteria

- [ ] `paged` is destructured in the handler; `whole = injected - paged` is computed.
- [ ] `paged > 0` → notify message is exactly `` `#@ injected ${whole} whole, ${paged} paged` ``.
- [ ] `paged === 0` → notify message is exactly `` `#@ injected ${injected} ${injected === 1 ? "file" : "files"}` ``.
- [ ] `if (ctx.hasUI) ctx.ui.notify(msg, "info")` — guard + `"info"` type preserved (api_verification §5).
- [ ] Factory JSDoc no longer claims "no truncation"; describes inline-vs-paged per §5.5; the
      loop-prevention / steering / never-throw sentence is unchanged.
- [ ] PN1 (all-whole, no budget) → `"#@ injected 2 files"`; PN2 (mixed, tight budget) →
      `"#@ injected 1 whole, 1 paged"`; PN3 (all-paged) → `"#@ injected 0 whole, 1 paged"`; PN4
      (headless + tight budget) → `notify` NEVER called AND `action === "transform"`.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact current line numbers (post-S1+S2), every
> edit as a unique oldText→newText block, the verified `ctx.ui.notify`/`ctx.hasUI` shapes (with
> `path:line` evidence), the pre-verified budget arithmetic for all four PN cases, the verbatim PN
> test bodies, and the backward-compat proof (why 39 existing cases stay green).

### Documentation & References

```yaml
# MUST READ — §5.5 architecture recon (this task = change sites K, L, M ONLY)
- docfile: plan/002_0ac3eb160af7/architecture/implementation_insertion_points.md
  why: "§4 pins the factory JSDoc (L220-244), the injectFiles call (L251), the notify line (L254),
        and the unchanged transform return (L255). It explicitly flags the 'No limits' paragraph as
        'now false' and the notify as needing the mode-aware template literal."
  critical: "Sites A–J are S1/S2 (DONE). S3 = K (factory JSDoc), L (destructure paged), M (notify).
        The guard and transform return are UNCHANGED."

# MUST READ — verified Pi API shapes (ctx.ui.notify, ctx.hasUI, InputEventResult)
- docfile: plan/002_0ac3eb160af7/architecture/pi_api_verification.md
  why: "§5: ctx.ui.notify(message: string, type?: 'info'|'warning'|'error'): void — so passing a
        string `msg` + 'info' is type-correct in BOTH branches. §9: InputEventResult shapes; S3 keeps
        the 'continue' and 'transform' shapes unchanged."
  section: "§5 (ctx.ui.notify), §9 (InputEventResult)"

# MUST READ — the §5.5 PRD source (Notify wording + the honest-contract paragraphs)
- docfile: plan/002_0ac3eb160af7/prd_snapshot.md
  why: "§5.5 'Notify' is the exact wording source: '#@ injected N whole' vs '#@ injected N whole,
        M paged'. §12.11 / §13.1 retract the 'no truncation' claim the JSDoc still makes."
  section: "§5.5 Notify; §12.11; §13.1"

# The PRPs S3 builds on (S1+S2 ALREADY LANDED — S3 consumes their outputs)
- docfile: plan/002_0ac3eb160af7/P1M1T1S1/PRP.md
  why: "S1 widened injectFiles' return type to include `paged: number` and added the constants +
        formatPagedDirectiveBlock. S3 relies on `paged` being in the return type."
- docfile: plan/002_0ac3eb160af7/P1M1T1S2/PRP.md
  why: "S2 made injectFiles actually POPULATE `paged` (the inline-vs-paged branch + `paged++` + the
        final `return { …, paged }`). S3 is the handler-side consumer of that field."

# The files being EDITED
- file: ./file-injector.ts
  why: "Two edits. Handler block at L308-311 (destructure + guard + notify). Factory JSDoc paragraph
        at L295-300 (split at 'delivered (downscaled to fit). The handler short-circuits')."
  pattern: "Terse inline comments citing PRD sections (§5.5, §12.x). Template literals with backticks.
        Em-dash — and × (U+00D7) for '2000×2000' match the existing JSDoc convention."
  gotcha: "The factory JSDoc paragraph is CONTIGUOUS — the loop/steering/never-throw sentence shares
        the paragraph. The edit must keep that sentence verbatim; only the no-truncation/images portion
        is replaced."

- file: ./file-injector.test.mjs
  why: "Add PN1-PN4 after PD5 (before the 'Summary + cleanup + exit' section). Uses the existing
        makeMockCtx + captureHandler + PAGED_FIX unchanged — PN cases MERGE them via object spread."
  pattern: "runCase(id, name, async () => { … assert(...) … }). Banner comment before the section
        (match the '// ── PAGED DELIVERY …' banner style)."
  gotcha: "makeMockCtx has NO budget fields; PAGED_FIX has NO ui/hasUI. PN2/PN3/PN4 build a merged ctx:
        { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model }. PN1 uses plain
        makeMockCtx (no budget → O-1 fallback → all whole → paged===0)."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDITED (2 edits: handler L308-311; factory JSDoc L295-300). post-S1+S2.
├── file-injector.test.mjs       # ← EDITED (+4 PN cases). model-free harness, currently 39 passed.
├── PRD.md                       # READ-ONLY
├── README.md                    # P1.M1.T2 (NOT this task)
└── plan/002_0ac3eb160af7/
    ├── architecture/{implementation_insertion_points.md, pi_api_verification.md, …}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / delta_prd.md
    └── P1M1T1S3/{research/research_notes.md, PRP.md}   # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
├── file-injector.ts             # MODIFIED — handler destructures `paged` + mode-aware notify;
│                                #            factory JSDoc "No limits" paragraph → §5.5 description.
└── file-injector.test.mjs       # MODIFIED — +4 runCase (PN1-PN4) handler-notify tests.
# No new files. No README. No injectFiles changes. No helper/mock changes.
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — `paged` is ALREADY in injectFiles' return type AND populated (S1+S2). S3 only consumes
// it in the handler. Do NOT re-add it, re-type it, or touch injectFiles.

// CRITICAL — the `if (!injected)` guard is UNCHANGED. `injected` counts whole+paged (S2 made count++
// fire for BOTH paths), so `injected === 0` STILL means nothing was delivered. Do not change it to
// `!injected && !paged` or similar.

// CRITICAL — `whole = injected - paged` is correct ONLY because paged ⊆ count (S2 guarantees
// paged++ always pairs with count++). whole is therefore always ≥ 0. Do not guard it.

// CRITICAL — the factory JSDoc paragraph is CONTIGUOUS. The oldText anchor ENDS at
// "…delivered (downscaled to fit). The handler short-circuits (`continue`) when the input originated"
// so the loop-prevention / steering / never-throw sentence is preserved on the join line. Do NOT
// delete that sentence — the item explicitly says to keep it.

// CONVENTION — the item wrote "(2000x2000)" (lowercase x) but the file uses "2000×2000" (× = U+00D7),
// matching the rest of the JSDoc. Use "2000×2000" for consistency.

// CONVENTION — `ctx.ui.notify(msg, "info")`: `msg` is a string in both branches (api_verification §5:
// notify(message: string, type?: 'info'|'warning'|'error'): void). The "info" type is preserved.

// NO TYPE-CHECK — the repo has no tsconfig/tsc; jiti transpiles only. Types are erased at load. The
// handler's `ctx` is the FULL ExtensionContext (richer than injectFiles' narrowed type) — passing it
// through is what already lets injectFiles read model/getContextUsage (unchanged by S3).
```

## Implementation Blueprint

### Data models and structure

No data-model change. The handler consumes the `paged: number` field S2 already returns:

```typescript
// injectFiles return (UNCHANGED by S3 — S2 populates it):
Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }>
//   injected = whole + paged (count++ fires for both paths);  paged = files delivered head+directive.

// Handler-side derived value (NEW in S3, local to the handler):
const whole = injected - paged;   // paged ⊆ injected ⟹ whole ≥ 0 always
```

### Implementation Tasks (ordered top-to-bottom in the file; each is one exact edit)

```yaml
Task 1: EDIT ./file-injector.ts — handler: destructure paged + mode-aware notify (L308-311)
  - FIND (unique anchor — this is the ONLY `const { text, images, injected }` in the file):
        const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
        if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1)

        if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info"); // F4 — proper pluralization; guarded for print/json headless modes (api_verification §5)
  - REPLACE WITH (destructure paged; compute whole; branch the message; guard + "info" preserved;
        the transform return BELOW this block is NOT part of this edit and stays unchanged):
        const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx); // §5.5 — paged count drives the mode-aware notify below
        if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered

        // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). paged===0 preserves the
        // existing pluralized "N file(s)" style; paged>0 reports whole and paged counts separately.
        const whole = injected - paged;
        const msg = paged > 0
          ? `#@ injected ${whole} whole, ${paged} paged`
          : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`;
        if (ctx.hasUI) ctx.ui.notify(msg, "info"); // F4 pluralization preserved on the paged===0 path; guarded for print/json headless modes (api_verification §5)
  - DO NOT include the `return { action: "transform" as const, text, images };` line in this edit —
        it follows unchanged.
  - DO NOT change the `if (!injected)` guard. `injected` already counts whole+paged (S2).

Task 2: EDIT ./file-injector.ts — factory JSDoc: replace the "No limits" paragraph (L295-300 portion)
  - FIND (unique anchor — "No limits, no config" appears once in the file):
        * No limits, no config: the whole file is injected every time — no truncation, no word / byte cap.
        * Large files may blow the model's context; that is the documented, intended behavior. Images are
        * downscaled (2000×2000) only because providers reject oversized images; the whole image is still
        * delivered (downscaled to fit). The handler short-circuits (`continue`) when the input originated
  - REPLACE WITH (§5.5 inline-vs-paged description; KEEP "The handler short-circuits…" verbatim on the
        join line so the loop-prevention / steering / never-throw sentence that follows is untouched):
        * The whole file always reaches the model: injected inline when it fits the remaining context budget,
        * or delivered as a head block plus a paging directive (instructing the model to read the rest via the
        * read tool) when it exceeds it (PRD §5.5). The budget is derived from the active model context window
        * and current usage — no user-facing config. Images are downscaled (2000×2000) because providers reject
        * oversized images. The handler short-circuits (`continue`) when the input originated
  - NOTE: use "2000×2000" (× = U+00D7) to match the existing JSDoc convention (the item's "(2000x2000)"
        is the same value rendered in plain ASCII). Do NOT touch the lines AFTER the join (loop prevention,
        steering, never-throw) — they are out of scope and already correct.

Task 3: EDIT ./file-injector.test.mjs — add PN1-PN4 after PD5 (before the "Summary + cleanup + exit" section)
  - FIND (unique anchor — the END of PD5 + the start of the summary section banner):
        });

        // ──────────────────────────────────────────────────────────────────────────────
        // 10. Summary + cleanup + exit.
        // ──────────────────────────────────────────────────────────────────────────────
  - INSERT BETWEEN them (the full PN section, verbatim — see "Test bodies" below). The PD5 `});`
        stays; the section-10 banner stays; the new block goes in between.
  - NAMING: PN1-PN4 (Paged Notify) to parallel PD1-PD5 (Paged Delivery, data-level). These are
        HANDLER-level (notify) cases; PN distinguishes them from the data-level PD cases.
  - DO NOT modify makeMockCtx / captureHandler / PAGED_FIX / FIX — PN cases MERGE them via spread.
  - DO NOT modify any existing case (F4, #9, #12, H1, PD1-PD5 all stay green — see backward-compat note).
```

#### Test bodies (verbatim — paste as the PN section in Task 3)

```javascript
// ── §5.5 HANDLER NOTIFY (PRD §5.5 Notify) — mode-aware notify via the input handler ──────
// The handler now destructures `paged` from injectFiles and reports whole-vs-paged mode. The existing
// notify cases (F4 pluralization, #9 multi-file, #12 interactive, H1 headless) use a budget-less ctx →
// paged is always 0 → they exercise the paged===0 backward-compat path (existing "N file(s)" style).
// PN1–PN4 cover the paged>0 path and the headless guard under paging. PN2/PN3/PN4 build a budget-aware
// mock ctx that MERGES makeMockCtx's notify-recording ui+hasUI with PAGED_FIX's tight budget (the two
// existing mocks are complementary: makeMockCtx has ui but no budget; PAGED_FIX has budget but no ui).

await runCase("PN1", "§5.5 notify: all-whole prompt (no budget) → 'N files' (existing style preserved)", async () => {
  // No budget → injectFiles O-1 fallback → all whole → paged=0 → existing pluralized message.
  const { ctx, rec } = makeMockCtx(TMPDIR);
  const slot = captureHandler();
  const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 2 files",
    `paged===0 must use the existing plural style, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
  assert(rec.notify.t === "info", `notify type must be 'info', got '${rec.notify && rec.notify.t}'`);
});

await runCase("PN2", "§5.5 notify: mixed prompt (tight budget) → '1 whole, 1 paged'", async () => {
  // Merged ctx: makeMockCtx's notify-recording ui + hasUI, + PAGED_FIX's tight budget.
  // a.ts (small, ~90 chars) → WHOLE; huge.log (~2 MB) → PAGED. injected=2, paged=1, whole=1.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Review #@a.ts and #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 1 whole, 1 paged",
    `mixed prompt must report whole + paged counts, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

await runCase("PN3", "§5.5 notify: all-paged prompt (tight budget) → '0 whole, 1 paged'", async () => {
  // Only huge.log, tight budget → PAGED. injected=1, paged=1, whole=0.
  const { ctx: base, rec } = makeMockCtx(TMPDIR);
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
  assert(rec.notify && rec.notify.m === "#@ injected 0 whole, 1 paged",
    `all-paged prompt must report 0 whole + paged count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
});

await runCase("PN4", "§5.5 notify: headless (hasUI===false) + tight budget → notify NEVER called", async () => {
  // The hasUI guard must suppress notify even on the paged>0 path (huge.log paged).
  const { ctx: base, rec } = makeMockCtx(TMPDIR, { hasUI: false });
  const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
  const slot = captureHandler();
  const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  assert(out.action === "transform", `handler must still transform when headless, got '${out.action}'`);
  assert(rec.notify === undefined, "notify must NEVER fire when ctx.hasUI===false, even under paging");
});
```

### Implementation Patterns & Key Details

```typescript
// PATTERN (handler notify — mode-aware, backward-compatible). The paged===0 branch is the EXISTING
// message verbatim, so every budget-less ctx (all legacy notify cases) is unchanged:
const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx);
if (!injected) return { action: "continue" };              // guard UNCHANGED (injected counts whole+paged)
const whole = injected - paged;                              // paged ⊆ injected ⟹ whole ≥ 0
const msg = paged > 0
  ? `#@ injected ${whole} whole, ${paged} paged`            // §5.5 Notify (paged path)
  : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`; // existing style (whole path)
if (ctx.hasUI) ctx.ui.notify(msg, "info");                  // guard + "info" preserved
// WHY whole = injected - paged (not a separate counter): injected already counts BOTH paths (S2's
//   count++ fires for whole AND paged). Deriving whole avoids a third return field and matches the
//   PRD §5.5 "Notify" wording ("N whole, M paged") directly.

// PATTERN (factory JSDoc — honest contract). The OLD paragraph claimed "no truncation … large files
// may blow the model's context; that is the documented, intended behavior." §12.11/§13.1 retract
// that: inline when it fits, paged when it exceeds. The NEW text says so explicitly and cites §5.5.
// The loop-prevention / steering / never-throw sentence is KEPT (it is still true and in scope-keep).
```

### Integration Points

```yaml
NO RUNTIME INTEGRATION CHANGE:
  - "Handler-only change + a doc comment. No new imports, no config, no API surface change, no new
    exports. injectFiles already returns `paged` (S2); the handler just reads it now."
  - "The notify still fires only when ctx.hasUI (api_verification §5 — print/json headless modes get
    no toast). The 'info' type is unchanged."
  - "README is NOT touched here (P1.M1.T2 owns the Mode-B doc sync). The factory JSDoc (code-adjacent)
    is the only doc touched — PRD §5.5 DOCS Mode A."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension
> validated by a **model-free Node ESM harness** (`file-injector.test.mjs`, currently 39 cases, run
> via `node`). The Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY.
> The gates below are project-specific and have been **verified working on this machine**: the harness
> currently reports 39 passed / 0 failed; after S3 it must report 43 / 0.

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. Handler destructures paged AND computes whole AND branches the message.
grep -q "const { text, images, injected, paged } = await injectFiles" file-injector.ts \
  && grep -q "const whole = injected - paged;" file-injector.ts \
  && grep -q "const msg = paged > 0" file-injector.ts && echo "OK: handler mode-aware" || echo "FAIL: handler"

# 1b. BOTH message branches are present (paged path + existing-style path).
grep -q '`#@ injected ${whole} whole, ${paged} paged`' file-injector.ts \
  && grep -q '`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`' file-injector.ts \
  && echo "OK: both notify branches" || echo "FAIL: notify branches"

# 1c. The guard + "info" type + hasUI are preserved; the OLD single-line notify is GONE.
grep -q "if (!injected) return { action: \"continue\" };" file-injector.ts \
  && grep -q 'ctx.ui.notify(msg, "info")' file-injector.ts \
  && grep -q "if (ctx.hasUI)" file-injector.ts && echo "OK: guard/type/hasUI preserved" || echo "FAIL: guard/type"
grep -q 'ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info")' file-injector.ts \
  && echo "FAIL: old single-line notify still present" || echo "OK: old notify removed"

# 1d. Factory JSDoc: the "No limits / no truncation" claim is GONE; the §5.5 description is present;
#     the loop-prevention sentence is KEPT.
grep -q "No limits, no config" file-injector.ts && echo "FAIL: stale 'No limits' claim still in JSDoc" || echo "OK: stale claim removed"
grep -q "always reaches the model: injected inline when it fits the remaining context budget" file-injector.ts \
  && grep -q "paging directive" file-injector.ts && echo "OK: §5.5 JSDoc present" || echo "FAIL: §5.5 JSDoc"
grep -q "The handler short-circuits (\`continue\`) when the input originated" file-injector.ts \
  && echo "OK: loop/steering/never-throw sentence kept" || echo "FAIL: kept-sentence dropped"

# 1e. Test harness gained PN1-PN4; makeMockCtx/captureHandler/PAGED_FIX/FIX are UNCHANGED.
for c in PN1 PN2 PN3 PN4; do grep -q "runCase(\"$c\"" file-injector.test.mjs && echo "OK: case $c" || echo "FAIL: case $c"; done
grep -q "const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };" file-injector.test.mjs \
  && echo "OK: merged budget-aware ctx" || echo "FAIL: merged ctx"
# makeMockCtx signature unchanged (still 2-arg, hasUI default true):
grep -q "function makeMockCtx(cwd, { hasUI = true } = {})" file-injector.test.mjs && echo "OK: makeMockCtx unchanged" || echo "FAIL: makeMockCtx changed"

# Expected: every line prints OK.
```

### Level 2: Regression + New Cases — Existing Harness (Component Validation)

```bash
# MUST report 43 passed / 0 failed (was 39; +4 PN cases). The 39 existing cases are unchanged:
# every legacy notify case (F4, #9, #12, H1) uses a budget-less ctx → paged===0 → existing message.
node ./file-injector.test.mjs
# Expected: "Result: 43 passed, 0 failed." and exit code 0.
# If an EXISTING notify case fails (e.g. F4/#9/#12): the paged===0 branch is NOT byte-identical to the
#   old single-line notify — re-check Task 1's else-branch matches the old template literal exactly.
# If a PN case fails: read the assertion message. Most likely a budget-arithmetic slip (see research
#   notes §5) or the merged ctx dropped hasUI/ui (re-check the spread order: ...base FIRST, then budget).
```

### Level 3: Behavior Verification (the §5.5 notify logic — NON-INTERACTIVE, NO MODEL)

The PN cases in Level 2 already exercise the handler end-to-end via `captureHandler()`. This
throwaway script is an INDEPENDENT cross-check of the four notify outcomes against the REAL handler
(without relying on the harness's runCase plumbing). Run it, then delete it.

```bash
cat > /tmp/verify_notify_s3.mjs <<'EOF'
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

const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "notify-s3-"));
await fs.writeFile(path.join(TMP, "a.ts"), "export function add(a,b){return a+b;}\n");
await fs.writeFile(path.join(TMP, "b.ts"), "export const V=42;\n");
await fs.writeFile(path.join(TMP, "huge.log"), "line\n".repeat(420000)); // ~2.1 MB

// capture the input handler exactly like the harness does
const slot = {};
const pi = { on: (ev, cb) => { if (ev === "input") slot.cb = cb; } };
mod.default(pi);

// notify-recording ctx factories (mirror makeMockCtx)
function ctxWith(cwd, { hasUI = true, budget = false } = {}) {
  const rec = {};
  const base = { cwd, hasUI, ui: { notify: (m, t) => { rec.notify = { m, t }; } } };
  const ctx = budget ? { ...base, getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }), model: { contextWindow: 50000, maxTokens: 8192 } } : base;
  return { ctx, rec };
}
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { console.log((c ? "PASS" : "FAIL") + ": " + n + (c ? "" : "  " + d)); c ? pass++ : fail++; };

// PN1: all-whole, no budget → existing style
let r = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctxWith(TMP).ctx);
ok("PN1 msg '#@ injected 2 files'", r.action === "transform"); // rec not returned here; check via re-run below
{ const { ctx, rec } = ctxWith(TMP); await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
  ok("PN1 notify '#@ injected 2 files'", rec.notify && rec.notify.m === "#@ injected 2 files", JSON.stringify(rec.notify && rec.notify.m)); }

// PN2: mixed, tight budget → '1 whole, 1 paged'
{ const { ctx, rec } = ctxWith(TMP, { budget: true }); const out = await slot.cb({ text: "Review #@a.ts and #@huge.log", source: "interactive", images: [] }, ctx);
  ok("PN2 transform", out.action === "transform"); ok("PN2 notify '#@ injected 1 whole, 1 paged'", rec.notify && rec.notify.m === "#@ injected 1 whole, 1 paged", JSON.stringify(rec.notify && rec.notify.m)); }

// PN3: all-paged, tight budget → '0 whole, 1 paged'
{ const { ctx, rec } = ctxWith(TMP, { budget: true }); const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  ok("PN3 transform", out.action === "transform"); ok("PN3 notify '#@ injected 0 whole, 1 paged'", rec.notify && rec.notify.m === "#@ injected 0 whole, 1 paged", JSON.stringify(rec.notify && rec.notify.m)); }

// PN4: headless + tight budget → notify NEVER called, still transforms
{ const { ctx, rec } = ctxWith(TMP, { hasUI: false, budget: true }); const out = await slot.cb({ text: "Summarize #@huge.log", source: "interactive", images: [] }, ctx);
  ok("PN4 transform", out.action === "transform"); ok("PN4 notify undefined", rec.notify === undefined, JSON.stringify(rec.notify)); }

fsSync.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
EOF
node /tmp/verify_notify_s3.mjs
# Expected: all checks PASS; "<n> passed, 0 failed"; exit 0.
rm -f /tmp/verify_notify_s3.mjs
```

### Level 4: (none required — no new runtime integration)

S3 changes a user-visible toast string + a code comment; Levels 1–3 fully cover it. A live Pi run is
optional (only if a provider/key is configured) to eyeball the toast text in the TUI after a
`#@huge.log` under a tight budget — but it adds no signal beyond Level 3.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: all edit checks print OK (handler mode-aware; both notify branches; guard/type/hasUI
      preserved; old notify gone; stale JSDoc claim gone; §5.5 JSDoc present; kept-sentence retained;
      PN1–PN4 present; merged ctx present; makeMockCtx unchanged).
- [ ] Level 2: `node ./file-injector.test.mjs` → **43 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_notify_s3.mjs` → all checks PASS, exit 0.

### Feature Validation
- [ ] `paged === 0` (all-whole, or no budget) → notify is `` `#@ injected N file(s)` `` (existing style;
      F4/#9/#12 pluralization preserved).
- [ ] `paged > 0` (mixed) → notify is `` `#@ injected N whole, M paged` `` (e.g. PN2: `1 whole, 1 paged`).
- [ ] `paged > 0` (all-paged) → notify is `` `#@ injected 0 whole, M paged` `` (e.g. PN3: `0 whole, 1 paged`).
- [ ] `ctx.hasUI === false` → `ctx.ui.notify` is NEVER called, even on the `paged > 0` path (PN4);
      the handler still returns `{ action: "transform" }`.
- [ ] Factory JSDoc no longer claims "no truncation"; describes inline-vs-paged per §5.5; the
      loop-prevention / steering / never-throw sentence is unchanged.

### Code Quality Validation
- [ ] Only the two specified `file-injector.ts` edits + the four PN cases; nothing else.
- [ ] `injectFiles`, its signature/types, the early-return guard, and the `transform` return are
      byte-for-byte unchanged.
- [ ] `makeMockCtx` / `captureHandler` / `PAGED_FIX` / `FIX` are unchanged (PN cases MERGE them).
- [ ] `whole = injected - paged` relies on the S2 invariant `paged ⊆ injected` (count++ fires for both
      paths); no extra guard added.
- [ ] JSDoc uses "2000×2000" (× = U+00D7) matching the existing convention.

### Documentation & Deployment
- [ ] Factory JSDoc updated to the §5.5 inline-vs-paged description (PRD §5.5 DOCS Mode A).
- [ ] No new env vars / config / exports / API surface (PRD §13.4: no user-facing config).
- [ ] README NOT touched here (P1.M1.T2 owns the Mode-B doc sync).

---

## Anti-Patterns to Avoid

- ❌ Don't touch `injectFiles`, its signature, its ctx/return types, the budget computation, or the
  inline-vs-paged branch — S1+S2 own those and they are DONE. S3 only *reads* `paged`.
- ❌ Don't change the `if (!injected) return { action: "continue" }` guard. `injected` already counts
  whole+paged (S2), so `!injected` ⟺ nothing delivered. Do not add `&& !paged`.
- ❌ Don't introduce a third return field (`whole`) on `injectFiles`. `whole` is a handler-local
  derivation (`injected - paged`); `injectFiles` stays `{ text, images, injected, paged }`.
- ❌ Don't change the `paged === 0` notify message — it MUST be byte-identical to the old single-line
  notify (`` `#@ injected ${injected} ${injected === 1 ? "file" : "files"}` ``) so F4/#9/#12 stay green.
- ❌ Don't drop the `ctx.hasUI` guard or change the `"info"` type — headless print/json modes must stay
  toast-free (api_verification §5); PN4 guards this explicitly.
- ❌ Don't delete the factory JSDoc's loop-prevention / steering / never-throw sentence — the item says
  to keep it; only the no-truncation/images portion is replaced.
- ❌ Don't modify `makeMockCtx` / `captureHandler` / `PAGED_FIX` / `FIX` to add budget fields — that
  risks the 10+ cases that depend on their current shape. PN cases MERGE them via `{ ...base, … }`.
- ❌ Don't use "2000x2000" (ASCII x) in the JSDoc — the file uses "2000×2000" (× = U+00D7); match it.
- ❌ Don't touch the README — that is P1.M1.T2 (Mode B). The factory JSDoc (Mode A) is the only doc here.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: S3 is the smallest, most surgical step in the §5.5 chain — two unique-text edits to
`file-injector.ts` (the handler block, anchored on the only `const { text, images, injected }` in the
file; and the only `No limits, no config` paragraph) plus four verbatim test cases. S1+S2 are
confirmed landed (the budget constants, `formatPagedDirectiveBlock`, the widened return type carrying
`paged`, the inline-vs-paged branch, and the final `return { …, paged }` are all present in the current
file), so `paged` is genuinely available to consume. The change is **provably backward-compatible**:
every legacy notify case uses a budget-less ctx → `paged === 0` → the else-branch is byte-identical to
the old single-line notify. The four PN outcomes were **pre-verified arithmetically** in this
environment (PAGED_FIX → remaining 23616; a.ts ~23 fileCost → WHOLE; huge.log ~524288 → PAGED; whole =
injected−paged = 1/0 for PN2/PN3). The residual 1.0 is for a possible transcription slip in the
contiguous handler-block anchor or the JSDoc join line — fully caught by Level 1 (1a–1e), Level 2
(43/43), and Level 3.
