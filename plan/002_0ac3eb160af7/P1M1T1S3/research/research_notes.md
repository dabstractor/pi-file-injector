# Research Notes — P1.M1.T1.S3 (Handler mode-aware notify + factory JSDoc)

> Companion to `../PRP.md`. Captures the verified current state (post-S1+S2) and the exact anchors,
> arithmetic, and test-design decisions behind the PRP. All line numbers are from `grep -n` /
> `read` against the **current** `file-injector.ts` (post-S1+S2) and `file-injector.test.mjs`.

## 1. Current state of the code (post-S1+S2) — VERIFIED by reading the file

S1 (constants + `formatPagedDirectiveBlock` + widened types + `paged:0` returns + JSDoc) and S2
(budget computation + inline-vs-paged branch + `paged++` + final-return `paged`) are BOTH already
landed. S3's job is the handler-side + factory-JSDoc finish.

Relevant current lines in `file-injector.ts`:

- **L308** — handler destructure (NO `paged` yet):
  `const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);`
- **L310** — early-return guard (UNCHANGED by S3; `injected` counts whole+paged, so `!injected`
  still means nothing delivered):
  `if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1)`
- **L311** — the single mode-reporting notify line (guarded on `ctx.hasUI`):
  `if (ctx.hasUI) ctx.ui.notify(` + "`" + `#@ injected ${injected} ${injected === 1 ? "file" : "files"}` + "`" + `, "info"); // F4 ...`
- **L295–300** — factory JSDoc paragraph beginning "No limits, no config: the whole file is
  injected every time — no truncation, no word / byte cap." … ending the paragraph at
  "…never throws (injectFiles isolates each file in its own try/catch)." The same paragraph
  CONTAINS the loop-prevention / steering / never-throw sentence (it is contiguous in the JSDoc),
  so the edit must split at "delivered (downscaled to fit). The handler short-circuits" and keep
  the latter sentence.
- `injectFiles` ALREADY returns `{ text, images, injected: count, paged }` (L274) with `paged`
  populated by S2's branch. **So S3 does NOT touch `injectFiles` at all** — it only consumes
  `paged` in the handler.

## 2. The two production edits (exact anchors, VERIFIED unique)

### Edit A — handler (L308 → L311), one contiguous block
oldText (unique — the destructure line is the ONLY `const { text, images, injected }` in the file):
```
    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1)

    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info"); // F4 — proper pluralization; guarded for print/json headless modes (api_verification §5)
```
 newText (destructure `paged`; compute `whole`; branch the message; guard + notify preserved):
```
    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx); // §5.5 — paged count drives the mode-aware notify below
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered

    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). paged===0 preserves the
    // existing pluralized "N file(s)" style; paged>0 reports whole and paged counts separately.
    const whole = injected - paged;
    const msg = paged > 0
      ? `#@ injected ${whole} whole, ${paged} paged`
      : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // F4 pluralization preserved on the paged===0 path; guarded for print/json headless modes (api_verification §5)
```
The `return { action: "transform" as const, text, images };` (L313) is UNCHANGED and is NOT part of
this edit (it sits below and is already correct).

### Edit B — factory JSDoc (L295–297 portion), keep loop/steering/never-throw
oldText (unique — "No limits, no config" appears once in the file):
```
 * No limits, no config: the whole file is injected every time — no truncation, no word / byte cap.
 * Large files may blow the model's context; that is the documented, intended behavior. Images are
 * downscaled (2000×2000) only because providers reject oversized images; the whole image is still
 * delivered (downscaled to fit). The handler short-circuits (`continue`) when the input originated
```
newText (paged-delivery description; "The handler short-circuits…" kept verbatim on the join line):
```
 * The whole file always reaches the model: injected inline when it fits the remaining context budget,
 * or delivered as a head block plus a paging directive (instructing the model to read the rest via the
 * read tool) when it exceeds it (PRD §5.5). The budget is derived from the active model context window
 * and current usage — no user-facing config. Images are downscaled (2000×2000) because providers reject
 * oversized images. The handler short-circuits (`continue`) when the input originated
```
The remainder of the JSDoc ("…from an extension (loop prevention), is a mid-stream steering nudge
(latency), or simply has no `#@` token — and it never throws…") is UNTOUCHED (it follows the join).

**Convention note:** the item wrote "(2000x2000)" (lowercase x). The EXISTING file uses "2000×2000"
(× = U+00D7), consistent with the rest of the JSDoc. The PRP uses "2000×2000" to match the file.

## 3. Verified API shapes (from `architecture/pi_api_verification.md`)

- **`ctx.ui.notify`** (§5, `ExtensionUIContext`, `dist/core/extensions/types.d.ts`):
  `notify(message: string, type?: "info" | "warning" | "error"): void`. `message` required string,
  `type` optional → defaults "info". Fire-and-forget. → The handler's `ctx.ui.notify(msg, "info")`
  call is type-correct; `msg` is a `string` in both branches.
- **`ctx.hasUI`**: boolean (per `architecture/implementation_insertion_points.md §4` +
  `api_verification §5`). The guard `if (ctx.hasUI)` is preserved verbatim.
- **`InputEventResult`** (§9): `{ action: "continue" } | { action: "transform"; text; images? } |
  { action: "handled" }`. S3 keeps both return shapes (`continue` and `transform`) unchanged.

## 4. Test harness facts (VERIFIED by reading `file-injector.test.mjs`)

- **`makeMockCtx(cwd, { hasUI = true } = {})`** (L126–132): returns
  `{ ctx: { cwd, hasUI, ui: { notify: (m,t)=>{ rec.notify={m,t}; } } }, rec }`. The notify callback
  OVERWRITES `rec.notify` (last-call-wins). Has NO budget fields (no `getContextUsage`, no `model`).
- **`captureHandler(event = "input")`** (L134–137): builds a fake `pi` whose `on(ev,cb)` stashes the
  callback; returns `{ cb }`. Tests call `await slot.cb(payload, ctx)` with a crafted payload.
- **`PAGED_FIX`** (L218–222): `{ cwd: TMPDIR, getContextUsage: () => ({tokens:10000,
  contextWindow:50000, percent:20}), model: {contextWindow:50000, maxTokens:8192} }`. Has the budget
  fields but NO `hasUI` / NO `ui.notify`.
- **`FIX`** (the plain cwd-only mock, used by the 34 legacy cases): `{ cwd: TMPDIR }` — no budget.
- Fixture constants (L159–211): `A_TS`, `A_TS_CONTENT` (~90 chars), `B_TS`/`B_TS_CONTENT`,
  `HUGE`, `HUGE_LOG_CONTENT` (~2 MB), `PIC`, `BIN`, etc. `buildFixtures()` writes them all; S2's
  PD1–PD5 already exercise `HUGE` + `A_TS` under `PAGED_FIX`, proving the fixtures exist & page.

### The ctx-shape gap S3's tests must bridge
`makeMockCtx` gives notify-recording `ui` + `hasUI` but NO budget. `PAGED_FIX` gives budget but NO
`ui`/`hasUI`. To test the **handler-level** paged notify, a test needs BOTH. Decision: in each new
PN case, build a merged ctx by spreading `makeMockCtx`'s base and overlaying `PAGED_FIX`'s budget:
```js
const { ctx: base, rec } = makeMockCtx(TMPDIR);
const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };
```
This is faithful to the item ("verify the notify via the existing makeMockCtx helper which records
ctx.ui.notify calls") and does NOT modify `makeMockCtx` (zero risk to the 10+ cases that depend on
its current shape). The PRP specifies this verbatim.

### Backward-compat proof (why S3 breaks ZERO existing notify cases)
EVERY existing notify case (F4 pluralization L656, case #9 multi-file L315, case #12 interactive
L~355, H1 headless L482) uses a budget-less ctx (`makeMockCtx(TMPDIR)`). Under no budget,
`injectFiles` takes the O-1 fallback → `paged === 0` for every file → the handler's `paged > 0`
branch is FALSE → the notify falls through to the existing `` `#@ injected ${injected} ${injected===1?'file':'files'}` ``
message. So all existing assertions (`"1 file"`, `"2 files"`, `notify === undefined`) hold unchanged.

## 5. Budget arithmetic for the PN cases (PRE-VERIFIED)

`PAGED_FIX`: `remainingBudget = max(0, 50000 − 10000 − 8192(maxTokens) − 8192(MARGIN)) = 23616`.
Threshold = `PAGED_THRESHOLD * remainingBudget = 0.6 * 23616 = 14169.6`.

| Case | Prompt | a.ts fileCost | huge.log fileCost | whole | paged | notify string |
|---|---|---|---|---|---|---|
| PN1 | `Diff #@a.ts vs #@b.ts` (no budget) | — (fallback) | — | 2 | 0 | `#@ injected 2 files` |
| PN2 | `Review #@a.ts and #@huge.log` (PAGED_FIX) | ceil(90/4)=23 ≤ 14169.6 → WHOLE | ceil(2M/4)=524288 > 14169.6 → PAGED | 1 | 1 | `#@ injected 1 whole, 1 paged` |
| PN3 | `Summarize #@huge.log` (PAGED_FIX) | — | 524288 → PAGED | 0 | 1 | `#@ injected 0 whole, 1 paged` |
| PN4 | `Summarize #@huge.log` (PAGED_FIX, hasUI=false) | — | PAGED | 0 | 1 | (notify NEVER called) |

`whole = injected − paged`: PN2 `2−1=1`; PN3 `1−1=0`. PN4 asserts `rec.notify === undefined` (headless
guard suppresses notify even on the `paged>0` path) AND `out.action === "transform"`.

Order independence (sanity): in PN2, a.ts is matched before huge.log → a.ts WHOLE first; but even if
reversed, huge.log PAGES (count=1,paged=1, remaining −= ceil(8192/4)=2048 → 21568), then a.ts WHOLE
(23 ≤ 0.6×21568=12940.8). Same counts either way. ✓

## 6. Case count & placement

- Current: `node ./file-injector.test.mjs` → **39 passed, 0 failed** (verified by running it).
  (`grep -c 'runCase('` = 40 = 1 function decl + 39 calls; 2 `integrationCase` rows don't count.)
- S3 adds 4 NEW `runCase` calls (PN1–PN4) after PD5 (L~807) and before the "Summary + cleanup +
  exit" section (L809). → expected **43 passed, 0 failed**.
- The new section needs its own banner comment to match the harness style (see PD's
  `// ── PAGED DELIVERY …` banner at L748).

## 7. Out of scope (explicitly NOT touched by S3)

- `injectFiles` body / signature / types (S1+S2 own these — `paged` is already returned).
- The `if (!injected) return { action: "continue" }` guard semantics (unchanged; `injected`
  already counts whole+paged so `!injected` ⟺ nothing delivered).
- README (P1.M1.T2 owns the Mode-B doc touch).
- `makeMockCtx` / `captureHandler` / `PAGED_FIX` / `FIX` shapes (unchanged; PN cases MERGE them).
- The factory JSDoc's loop-prevention / steering / never-throw sentence (kept verbatim).
- Autocomplete provider, dedup, regex, image/binary paths (unchanged).
