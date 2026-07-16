# Research Notes — P1.M2.T1.S1 (Bugfix): Unify handler notify wording to PRD §5.5 (`N whole` / `N whole, M paged`)

> **Task type**: surgical 2-file edit. (1) Replace the handler's branched notify `msg` with a single
> unified expression (Issue 3). (2) Update the 4 test cases (5 assertions) that pin the old `file(s)`
> wording to `whole`, plus refresh their stale name/comment text. **No new files. No count change
> (stays 49). No README.** I run in PARALLEL with P1.M1.T1.S2 (Issue 2 — failed-token stripping); the
> regions are DISJOINT (S2 edits `injectFiles` + F2/FS cases; this task edits the handler `msg` +
> Cases 9/12/F4/PN1).

## 0. Verified repo state (as of this research)

- `file-injector.ts` (handler `default` factory): the notify block is a **branched ternary**:
  ```ts
  const whole = injected - paged;
  const msg = paged > 0
    ? `#@ injected ${whole} whole, ${paged} paged`
    : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`;
  ```
  → `paged===0` emits `N file`/`N files` (the bug); `paged>0` emits `N whole, M paged` (already correct).
- `file-injector.test.mjs`: **baseline = 49 passed, 0 failed** (P1.M1.T1.S2's FS1/FS2/FS3 already
  landed; my task keeps the count at 49 — no add/remove, only assertion/comment updates).
- `README.md`: does NOT quote the notify string (grep-confirmed) → **no doc surface** (Mode A: none).

## 1. The fix (PRD §5.5 Notify — exact wording)

PRD §5.5 gives two examples: `#@ injected N whole` (all-whole) and `#@ injected N whole, M paged`
(paging). Unify on `whole` always, append `, M paged` only when paging:
```ts
const whole = injected - paged;
const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
```
- `paged===0` → `` `#@ injected ${whole} whole` `` → e.g. `#@ injected 2 whole`. ✓
- `paged>0` → `` `#@ injected ${whole} whole, ${paged} paged` `` → e.g. `#@ injected 1 whole, 1 paged`. ✓
- `const whole = injected - paged;` is UNCHANGED (already computed). The notify guard
  `if (ctx.hasUI) ctx.ui.notify(msg, "info");` and the `return { action: "transform" as const, text, images };`
  are UNCHANGED (item §3 contract). Only the `msg` expression + its comments change.

## 2. The 4 test cases to update (5 assertion occurrences — all `file(s)` → `whole`)

Grep `#@ injected [0-9]+ (file|files)` in `file-injector.test.mjs` returns exactly these 5 (the item's
4 cases):

| Line | Case | Old assertion | New assertion |
|---|---|---|---|
| 329 | 9 (multi-file) | `rec.notify.m === "#@ injected 2 files"` | `=== "#@ injected 2 whole"` |
| 361 | 12 (interactive) | `rec.notify.m === "#@ injected 1 file"` | `=== "#@ injected 1 whole"` |
| 709 | F4 (singular) | `rec.notify.m === "#@ injected 1 file"` | `=== "#@ injected 1 whole"` |
| 713 | F4 (plural) | `rec2.notify.m === "#@ injected 2 files"` | `=== "#@ injected 2 whole"` |
| 871 | PN1 (all-whole) | `rec.notify.m === "#@ injected 2 files"` | `=== "#@ injected 2 whole"` |

**Already correct — LEAVE UNTOUCHED** (item §4): PN2 (L884 `1 whole, 1 paged`), PN3 (L895
`0 whole, 1 paged`), PN4 (headless, no notify-string assert). These use the `paged>0` branch which is
already correct.

## 3. Stale name/comment text to refresh (truthfulness — avoid contradictions after the wording change)

The item explicitly requires the **PN1** name/comment refresh ('existing plural style preserved' →
'unified whole style'). The following are the same kind of staleness and should be refreshed so the
file is internally consistent (all are within the 4 affected cases / the §5.5 notify section):

| Line | Where | Old | New |
|---|---|---|---|
| 704 | F4 case **name** | `"F4 — notify pluralization (1 file / N files)"` | `"F4 — notify wording (1 whole / N whole)"` |
| 709 | F4 assert **message** | `` `singular prompt must say '1 file', …` `` | `` `singular prompt must say '1 whole', …` `` |
| 713 | F4 assert **message** | `` `plural prompt must say '2 files', …` `` | `` `plural prompt must say '2 whole', …` `` |
| 861 | §5.5 section **comment** | `…the paged===0 backward-compat path (existing "N file(s)" style).` | `…the paged===0 path (unified "N whole" wording).` |
| 864 | PN1 case **name** | `'N files' (existing style preserved)` | `'N whole' (unified whole style)` |
| 865 | PN1 inline **comment** | `…paged=0 → existing pluralized message.` | `…paged=0 → unified "N whole" message.` |
| 872 | PN1 assert **message** | `` `paged===0 must use the existing plural style, …` `` | `` `paged===0 uses the unified whole style, …` `` |

The Case 9 / Case 12 assert *messages* are generic ("notify message must be the count", "notify must
fire for the interactive path") — no `file(s)` reference, so they need no change (only the expected
string changes).

## 4. GOLD-STANDARD verification (applied the full 9-edit set to a TEMP COPY → 49/49)

The complete edit set (1 handler edit + 8 test edits: 5 assertion expected-strings + F4 name/messages
+ section comment + PN1 name/comment/message) was applied to `/tmp/fi-verify/` copies of both files and
the harness run:
```
✓ case 9:  multi-file: both injected in order; notify count
✓ case 12: handler transforms interactive input (input event fires for -p)
✓ case F4: F4 — notify wording (1 whole / N whole)
✓ case PN1: §5.5 notify: all-whole prompt (no budget) → 'N whole' (unified whole style)
✓ case PN2: §5.5 notify: mixed prompt (tight budget) → '1 whole, 1 paged'
✓ case PN3: §5.5 notify: all-paged prompt (tight budget) → '0 whole, 1 paged'
Result: 49 passed, 0 failed.
```
And `grep '#@ injected [0-9]+ (file|files)' file-injector.ts file-injector.test.mjs` → **none remaining**.
→ The edit set is correct and complete; the target state is green.

## 5. Implicit TDD ordering (item §3)

"update the assertions first so they fail, then apply the fix." Concretely: applying the 5 test
assertion-string changes BEFORE the handler `msg` change makes those 5 cases FAIL (handler still emits
`file(s)`). Then the handler `msg` unify flips them to PASS. (The PRP lists the edits in this order and
the Level-2 gate enforces 49/49 only after BOTH files are edited.)

## 6. Scope boundaries (disjoint from the parallel sibling P1.M1.T1.S2)

- **DO NOT** touch `injectFiles` (Issue 1 dedup / Issue 2 strip live there — S1 done, S2 in progress).
  This task edits ONLY the handler `msg` (+ its 2 comments) in the `default` factory.
- **DO NOT** touch F2 / FS1 / FS2 / FS3 (Issue 2's test surface — P1.M1.T1.S2 owns them).
- **DO NOT** touch the paged directive `offset:0` string (Issue 4 — P1.M2.T2.S1).
- **DO NOT** touch PN2/PN3/PN4 (already correct `whole`/`paged` form).
- **DO NOT** edit README (the notify string is not quoted there; P1.M3 owns the final doc sweep).
- The handler's `injected`/`paged` come from `injectFiles`'s return shape `{text, images, injected,
  paged}` — UNCHANGED by S1/S2, so the handler edit is safe regardless of S2's landing state.

## 7. Where the deliverables live

- PRP: `plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2T1S1/PRP.md`
- This research: `.../P1M2T1S1/research/research_notes.md`
- The ONLY files edited: `file-injector.ts` (1 edit) + `file-injector.test.mjs` (8 edits).
