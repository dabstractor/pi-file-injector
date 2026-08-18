# Research Notes — P1.M2.T1.S1 (BUG-002: trigger-aware status notify)

Verbatim-verified facts (source: `file-injector.ts`, architecture `source_analysis.md`/`test_analysis.md`,
calibrated defuddle probe from the sibling feature plan). The item contract (LOGIC a–d) is authoritative;
these notes CONFIRM it against the real code and line numbers.

## 1. The buggy notify block — VERIFIED (file-injector.ts, input handler)

The input handler (`pi.on("input", …)`) tail. Current exact text (line numbers DRIFT vs. the contract's
L1493–1495 because P1.M1.T1.S1's `CODE_EXTENSIONS` gate landed nearby; the contract itself cites L1478–1495
from `source_analysis.md §5`). Anchor by TEXT, not line number:

```ts
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true, cfg.enableUrls !== false); // destructure INCLUDES details
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte

    // §6.2 hand the built blocks+details to before_agent_start …
    pending = { blocks, details };            // ← details is available HERE (the fix point)

    // §5.5 Notify — … "N whole"; append ", M paged" only when paging. …
    const whole = injected - paged;
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // guarded for headless modes
    return { action: "transform" as const, text: event.text, images };
```

BUG-002: `msg` is hardcoded `#@ injected ${whole} whole…` regardless of trigger. A URL-only prompt
(`see #example.com`) sets injected===1, paged===0 → toast `#@ injected 1 whole` though NO `#@file` was present.

## 2. Why `details[].kind` is the fix key (NO new return field)

- `injectFiles` returns `{ text, images, injected, paged, blocks, details }` (destructured in the handler).
- `details: FileDetail[]` has ONE entry per successful delivery; union `kind: "text" | "image" | "binary" | "paged" | "url"` (file-injector.ts:504).
- `details.length === injected === state.count` (VERIFIED: every `count++` is paired with exactly one `details.push` —
  image/binary/text/paged at L1203/1216/1229/1256/1280/1289→count++ L1235; URL text/html/json/xml at L937→L939;
  URL image at L889→L895).
- URLs delivered as text/html/json/xml push `kind:"url"` (L937). So:
  `urlCount = details.filter(d => d.kind === "url").length;` and `fileCount = injected - urlCount;`.
- **NUANCE (document, don't "fix")**: a URL that returns an IMAGE (`#x.com/img.png` → injectUrl image path)
  pushes `kind:"image"` (L889), NOT `"url"`. The contract explicitly filters `kind==="url"`, so an image-URL
  counts as a "file" in the notify (would show `#@ injected 1 whole`). This is out of scope for BUG-002's
  wording fix (the bug is about text/HTML URL-only prompts); the failing test uses text/html → `kind:"url"`.

## 3. The exact trigger-aware wording (item LOGIC b) — derived & verified

After `pending = { blocks, details };`, before the notify:
```ts
const urlCount = details.filter((d) => d.kind === "url").length;
const fileCount = injected - urlCount;
```
Then the msg (three mutually-exclusive branches — urlCount===0 is the byte-for-byte-preserved file-only path):

```ts
let msg;
if (urlCount === 0) {
  const whole = injected - paged;                                          // EXACT existing string (file-only)
  msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
} else if (fileCount === 0) {
  msg = `injected ${urlCount} URL${urlCount > 1 ? "s" : ""}`;             // URL-only: NO '#@', NO whole/paged
} else {
  const fileWhole = fileCount - paged;                                     // mixed
  msg = `#@ injected ${fileWhole} whole${paged > 0 ? `, ${paged} paged` : ""}, ${urlCount} URL${urlCount > 1 ? "s" : ""}`;
}
if (ctx.hasUI) ctx.ui.notify(msg, "info");   // type + guard UNCHANGED
```
- `whole` (file-only) / `fileWhole` (mixed) = `(fileCount) - paged`. Since URLs never page (injectUrl returns
  false on over-budget with NO paging), `paged` ⊆ files, so `fileCount - paged` is the whole-file count.
- The `urlCount === 0` branch is byte-for-byte the ORIGINAL string (PRD: "Existing file-only notify behavior
  is byte-for-byte preserved"). Do NOT change it.

## 4. The failing-first handler test — VERIFIED harness (file-injection.test.mjs, NOT url-injection.test.mjs)

**File choice rationale**: the parallel sibling P1.M1.T2.S1 is editing `url-injection.test.mjs` (COL-4 +
BUG1-* block). P1.M1.T2.S1's own PRP states BUG-002 notify tests belong in `file-injection.test.mjs`
("vs P1.M2.T2.S1 … edits file-injection.test.mjs (notify wording), NOT url-injection.test.mjs. No overlap.").
So BUG-002 notify tests → **file-injection.test.mjs** to avoid the parallel conflict and respect that contract.

Reusable helpers ALREADY in file-injection.test.mjs (test_analysis §7):
```js
function captureHandler(event = "input") {
  const cbs = [];
  const pi = { on: (ev, cb) => { if (ev === event) cbs.push(cb); }, registerMessageRenderer: () => {} };
  mod.default(pi);
  return { cb: cbs[cbs.length - 1], all: cbs };   // .cb = the input handler
}
function makeMockCtx(cwd, { hasUI = true, isProjectTrusted = () => true } = {}) {
  const rec = {};
  return { ctx: { cwd, hasUI, isProjectTrusted, ui: { notify: (m, t) => { rec.notify = { m, t }; } } }, rec };
}
```
Driving pattern (mirrors Case 9: `await slot.cb({ text, source:"interactive", images:[] }, ctx)` → assert `rec.notify.m`).

**cfg semantics (verified)**: `cfg` is module-level `{}` (L1467), reassigned only in session_start (L1471).
`captureHandler()` does NOT fire session_start → cfg stays `{}` → `cfg.enableUrls` undefined →
`undefined !== false` === **true** → URLs ENABLED in the handler with zero config. readConfig returns `{}`
when no config files exist (TMPDIR), so even if session_start fired, enableUrls stays enabled. Robust.

**Fetch stub**: file-injection.test.mjs has NO `makeRes`/`RICH_HTML`/`origFetch` (those live in url-injection.test.mjs).
So the failing test defines a SELF-CONTAINED inline stub + a rich-HTML body. The rich HTML MUST yield >200 chars
of defuddle markdown or injectUrl's SPA fallback fires (injected===0 → notify never fires → the case can't assert
the wording). Calibrated (sibling feature plan): a `<article>` + title + 3 substantial paragraphs (~3 KB) yields
**1024 chars** of markdown — reliably clears the 200-char floor.

**The failing assertion** (before the fix the handler emits `#@ injected 1 whole`; after, `injected 1 URL`):
```js
assert(out.action === "transform", `…`);
assert(rec.notify, "notify must fire (a URL WAS injected)");
assert(!rec.notify.m.includes("#@"), `URL-only notify must NOT contain '#@'; got ${JSON.stringify(rec.notify.m)}`);
assert(rec.notify.t === "info", `…`);
```

## 5. Validation commands (verified)

```bash
node --check ./file-injector.test.mjs       # syntax (fast)
node ./file-injector.test.mjs               # BUG2-1 fails BEFORE the fix, passes AFTER
npm run typecheck                           # file-injector.ts typechecks clean under --strict
npm test                                    # all 4 test files green (after the fix)
```
No new exports → the module-surface allowlist guard (file-injection.test.mjs L136–156) stays green.
No new State/return field → injectFiles shape unchanged.