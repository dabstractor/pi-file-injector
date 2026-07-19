# Research Notes — P1.M1.T2.S1: Input handler return text: event.text (explicit verbatim)

> One-token handler edit. T1.S3 (the dependency) LANDED: injectFiles returns the original prompt verbatim as
> its `text` field. This subtask makes the input handler's verbatim contract EXPLICIT by returning
> `text: event.text` instead of the destructured `text` (which already equals event.text). No behavior change;
> a clarity/correctness-intent edit per PRD §6.4.

## 1. T1.S3 contract — LANDED (verified first-hand)

T1.S3 (parallel/previous, status "Implementing" but ALREADY in the working tree) removed all `#@` stripping
from `injectFiles`. Confirmed via grep + typecheck:
- `grep -c "resolvedIdx|strippedText" file-injector.ts` → **0** (both gone).
- `injectFiles` returns:
  - count===0 early return (L1179): `return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };`
  - count>0 final return (L1188): `return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };`
  - In BOTH, `text` is the function's first parameter (the original, byte-for-byte prompt). NO stripping.
- `npm run typecheck` → **0 errors** (the S3 green gate is met).

∴ After T1.S3, the `text` field destructured in the input handler === `event.text` (the original prompt).
T2.S1's change (`text` → `text: event.text`) is a NO-OP at runtime; it makes the verbatim contract explicit.

## 2. The exact current input handler (file-injector.ts L1247-1265, verified)

```ts
  pi.on("input", async (event, ctx) => {                           // L1247
    if (event.source === "extension") return { action: "continue" }; // L1248 (short-circuit, UNCHANGED)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // L1249 (UNCHANGED)
    if (!event.text?.includes("#@")) return { action: "continue" }; // L1250 (UNCHANGED)

    const { text, images, injected, paged, blocks, details } =     // L1252 — destructure (text === event.text after T1.S3)
      await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);
    if (!injected) return { action: "continue" };                   // L1253 (UNCHANGED — nothing injected)

    pending = { blocks, details };                                  // L1257 (UNCHANGED — the stash)

    const whole = injected - paged;                                 // L1261-1263 notify (UNCHANGED)
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info");
    return { action: "transform" as const, text, images };          // L1265 — ← THE EDIT: text → text: event.text
  });
```

**The single edit (L1265):**
- oldText: `    return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images`
- newText: `    return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open re-triggers injection)`

(The `images` field stays `images` — it's `state.images` from injectFiles, seeded from `event.images` plus any
injected images. Only `text` becomes `event.text` explicitly.)

## 3. Why this is a no-op at runtime (but still worth doing)

After T1.S3, `text` (destructured from injectFiles' return) === `event.text` byte-for-byte (injectFiles returns
its first param verbatim). So `return { ..., text, ... }` and `return { ..., text: event.text, ... }` produce
identical transforms. The change is purely:
- **Explicitness** (PRD §6.4 "Two returns": `return { action: "transform", text: event.text, images }` — the
  spec writes `event.text` directly). A reader of the handler sees the verbatim contract immediately, without
  having to know that injectFiles returns its first param unmodified.
- **Robustness against future drift.** If a future refactor made injectFiles transform `text` (e.g. re-introducing
  stripping by mistake), the handler would silently propagate the modified text. Returning `event.text` directly
  pins the verbatim contract at the handler boundary — the one place Pi stores as the user message.

The item §3b notes keeping the `text` destructure is "harmless and useful for debugging" — agree. The destructure
keeps `text` available (e.g. for a future debug log) and its equality with `event.text` is a useful invariant
signal. Do NOT remove `text` from the destructure.

## 4. What stays UNCHANGED (item §3c/§3d)

- The 3 short-circuit guards (L1248-1250: extension source / steer / no-#@).
- The `!injected` early return (L1253: `{ action: "continue" }` — nothing injected, no stash, prompt preserved).
- The `pending = { blocks, details }` stash (L1257).
- The notify (L1261-1264).
- The `images` field in the return (stays `images` — the merged image list from injectFiles).
- The `text` destructure at L1252 (kept — harmless, useful for debugging; item §3b).

## 5. The PRD §6.4 / §13.8 verbatim contract (the "why")

PRD §6.4 "Two returns (not one)": the input handler returns `return { action: "transform", text: event.text,
images: state.images }` (text **verbatim**). PRD §13.8 "Why the prompt is preserved verbatim": stripping `#@`
breaks every re-submission path (cancel/fork/`/tree`-navigate re-feed the STORED user-message content; a stripped
prompt has no `#@` → the input handler injects nothing → files silently vanish on re-open). Returning `event.text`
verbatim makes the stored prompt identical to the original, so injection re-triggers automatically. T1.S3 made
injectFiles honor this; T2.S1 makes the handler's return EXPLICITLY honor it (defense-in-depth at the boundary).

## 6. Coordination / no-conflict

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S3 (Implementing, LANDED in tree) | injectFiles body: deleted resolvedIdx/strippedText; returns verbatim text | T2.S1 CONSUMES the landed verbatim `text` return. No file-region conflict (S3=injectFiles body; T2.S1=input handler return line). |
| P1.M1.T2.S2 (Planned) | Verify before_agent_start, computeDetailOffsets, renderInjectedMessage unaffected (read-only) | Orthogonal (T2.S2 is a read-only verification; T2.S1 is the one-line edit). |
| P1.M2.T1.S1 (Planned) | Migrate ~20 top-level prompt assertions (r.text now verbatim) | Consumes the verbatim behavior T2.S1 makes explicit. Different file (test). No conflict. |
| P1.M2.T4.S1 (Planned) | README verbatim sync | Different file (README). No conflict. |

**Critical no-conflict:** T2.S1 edits ONE line (L1265) in the input handler. S3 (landed) edited injectFiles
body (disjoint). T2.S2 is read-only. No overlapping edits.

## 7. Validation approach

The gate is `npm run typecheck` → 0 errors (unchanged from the S3-green state; `event.text` is a `string`,
matching the transform's `text: string` field). The runtime suites are RED from the not-yet-migrated
stripped-expectation assertions (P1.M2.T1 owns that) — T2.S1 does NOT touch tests. A structural grep confirms
the one edit landed. A one-line runtime probe (optional) confirms `out.text === event.text` (the input.text)
after the transform — but since `text` already equaled `event.text` after S3, this probe passing is a foregone
conclusion; the real value of T2.S1 is the explicitness/robustness at the handler boundary.

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck   # → 0 errors (the gate; unchanged from S3-green)
grep -c 'text: event.text' file-injector.ts   # → expect 1 (the edit landed)
```

No test run is meaningful as a T2.S1 gate (the suites are red from M2's pending migration; T2.S1 changes no
assertion-relevant behavior — `text` already equaled `event.text`).