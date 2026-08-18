# PRP — P1.M1.T1.S1 (bugfix 001_a6ffb98ab096): computeDetailOffsets — populate offsets for kind "url"

> **Scope flag:** This is the **first slice of BUG-001** (Major, display-only): the expanded chat view mis-pairs
> bodies after a paged file — a paged delivery emits TWO `<file>` blocks (head + directive) but ONE detail, so a
> following `url`/`binary` detail falls to the renderer's tier-3 `bodies[i]` fallback, which indexes BLOCKS while
> `i` counts DETAILS → the url body renders the `<paged: …>` directive instead of the page markdown. Root cause:
> `computeDetailOffsets` (:475) only processes `text`/`paged`. **S1 = extend the skip-guard to also process
> `kind:"url"`** — its block is body-bearing with a byte-identical envelope to text, so NO math changes. Binary
> is S2 (non-body-bearing block → needs the note branch); the renderer tier-3 fallback is S3. TDD: RED first.

---

## Goal

**Feature Goal:** Give `kind:"url"` details `contentStart`/`contentLen` offsets in `computeDetailOffsets`, so a
URL delivery that follows a paged file in the same prompt renders its OWN body (the extracted markdown) in the
expanded view — never the paged directive.

**Deliverable:** Modified `file-injector.ts` (ONE guard line at :475 + its comment + 2 Mode-A doc sites) +
modified `file-injector.test.mjs` (+ the `REND-PAGED-URL` test in the REND cluster; 180 → 181).

**Success Definition:**
1. TDD: `REND-PAGED-URL` is RED on the current guard (the url detail's offsets are undefined; the renderer's url
   body child shows `<paged:`), GREEN after the one-line guard change.
2. `node ./file-injector.test.mjs` → 181 passed (180 + 1); the other three suites unchanged (38/23/38; 279 → 280 total).
3. `npm run typecheck` → 0 errors under `--strict`.
4. `computeDetailOffsets` signature unchanged; NO math changes (the while-loop scan, 0x0A body-bearing test,
   headerLen/closerLen, SEP `"\n\n"` all untouched); NO new exports.

## Why

- **Correct expanded-view content for a spec-supported prompt mix.** PRD URL-spec §7 explicitly supports
  `#@file.txt and #example.com` in one prompt; URL-spec §6 requires "Expanded view shows the extracted markdown."
  Today, when a paged file precedes the URL, the URL's expanded body shows the paged directive (verified: the
  URL body area renders `<paged: 118890 chars; …>` and the markdown never appears). Display-only — the
  model-facing `message.content` is correct — but it shows visibly wrong content in the chat.
- **The root cause is a one-line omission, and the fix is one line.** `formatUrlBlock` (:833-835) emits
  `<file name="URL">\nCONTENT\n</file>` — a byte-identical envelope to `formatTextFileBlock` — so the existing
  0x0A body-bearing test (:489) and headerLen/closerLen math (:490-493) already pair url blocks correctly. The
  ONLY blocker is the skip-guard at :475. Extending it to process `url` eliminates the mis-pairing for the url
  kind at the source (tier-1 offsets always win over the tier-3 fallback).
- **Sliced to keep binary and the renderer fallback separate.** Binary blocks are NOT body-bearing
  (`<file name="ABS"><binary …></file>` — no leading `\n`), so binary needs a kind-gated note branch (S2). And
  the tier-3 `bodies[i]` fallback should still become path-aware for defensive/old-entry cases (S3). S1 is the
  minimal url fix; the bug-hunt recommendation names exactly this option first.

## What

### User-visible behavior

- Pressing `ctrl+o` on a prompt like `Summarize #@big.log and #example.com/doc` (under a budget that pages
  big.log) now shows the URL's extracted markdown as the URL's body — not a second copy of the paged directive.
  Collapsed read-lines and the model-facing content were already correct and are unchanged.

### Technical behavior (the contract)

- `computeDetailOffsets(blocks, details)` processes details of kind `text`, `paged`, **and `url`** — skipping
  only `image` and `binary` (F5-empty-image is kind `"image"`, so it stays skipped). A `url` detail's block is
  located via `blockPath` (URLs never contain `"`, so the capture is exact), passes the 0x0A body-bearing test,
  and receives `contentStart = starts[bi] + headerLen`, `contentLen = blk.length - headerLen - closerLen`.

### Success Criteria

- [ ] The :475 guard is `if (d.kind === "image" || d.kind === "binary") continue;` (url processed; F5 covered by the image skip).
- [ ] The while-loop scan, 0x0A test, headerLen/closerLen math, `cursorByPath`, SEP — all UNCHANGED.
- [ ] `REND-PAGED-URL` present, RED-first, then green; the paged pairing assertion (head block) also green.
- [ ] The computeDetailOffsets JSDoc (:456-461) + the contentStart/contentLen field comments (:564-569) updated (Mode A).
- [ ] 181 passed; typecheck clean; the other three suites unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim current guard line, the verbatim replacement, the cursor-logic trace proving no math changes are
needed, the complete test (copy-adapted from REND-MULTI-OFFSET with the RED path explained), and both gates.
One guard line + a comment + two doc sentences + one test.

### Documentation & References

```yaml
# MUST READ — the full BUG-001 analysis (kinds inventory, block catalog, fix-design evaluation)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/renderer_bug001.md
  why: "§'Block emission catalog' pins formatUrlBlock (:833-835) as BODY-BEARING with the identical envelope to
        formatTextFileBlock (:366-370) — the fact that makes the one-line guard sufficient; the FileDetail kinds
        inventory (8 push sites; url at :986) confirms exactly five kinds and that F5 is kind 'image'; §'Fix
        design evaluation' ranks the computeDetailOffsets extension first."
  critical: "url blocks pass the 0x0A body-bearing test and the existing headerLen/closerLen math pairs them
             exactly — the ONLY blocker is the skip-guard at :475. Binary is NOT body-bearing (no leading \\n)
             and is S2's job, not S1's."

# MUST READ — the bug contract (Expected/Actual/Repro)
- file: PRD.md  (bugfix PRD §h3.0 Issue 1 / BUG-001)
  why: "States the mis-pairing (tier-3 bodies[i] indexes blocks while i counts details — off by one after a paged
        file); the repro prompts (#@big.log + #@note.bin / + #example.com/doc under a tight budget); confirms
        collapsed read-lines and message.content are correct (display-only)."

# The file you edit (ONE guard line + a comment + 2 doc sentences)
- file: file-injector.ts
  why: ":475 the skip-guard (the edit site); :481-499 the while-loop scan (UNCHANGED — blockPath :441-445, the
        0x0A body-bearing test :489, headerLen/closerLen :490-493, cursorByPath); :463 SEP (already the correct
        2-char \"\\n\\n\" — unchanged); :833-835 formatUrlBlock; :985-986 the url block+detail push; :456-461 the
        JSDoc; :564-569 the contentStart/contentLen field comments. The renderer tier-1 slice consumes the new
        offsets (:1025-1082); tier-3 bodies[i] (:1065-1067) becomes path-aware in S3 — NOT here."
  pattern: "The guard change is a skip-set inversion: from allow-list (text/paged) to deny-list (image/binary).
            Deny-list is the right shape because url joins the processed set and S2 adds binary separately."
  gotcha: "F5 (0-byte image) pushes kind 'image' — the deny-list `kind === \"image\"` still skips it. Do NOT
           enumerate F5 separately; it is not its own kind."

# The gate you also edit (+1 test)
- file: file-injector.test.mjs
  why: "180 baseline. REND_THEME :2586 ({fg/bg/bold passthrough}); textOf helper (used by REND-MULTI-OFFSET);
        REND-MULTI-OFFSET :2778-2801 is the copy-source pattern (crafted blocks+details → computeDetailOffsets →
        slice assertions → render E2E). Place REND-PAGED-URL after REND-MULTI-OFFSET (~:2801). The label is free
        (grep-verified; the older BUG-001 label is taken by an earlier shipped bug)."
  pattern: "Crafted literals only — no fs fixtures, no mocking. Assert the OFFSET slice first (unit), then the
            renderer child (E2E). Locate the url read line by findIndex (the paged detail emits 3 children:
            read line + head body + directive text per REND-PAGED-DIR) — do NOT hardcode child indices."
  gotcha: "The url-injection suite (url-injection.test.mjs, 38 cases) is a 4th suite — run it too (it exercises
           injectUrl end-to-end; the guard change can only affect its display paths, but confirm green)."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. A guard-condition change + comment edits → no type impact → clean."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (:475 guard + comment; :456-461 JSDoc; :564-569 field comments)
├── file-injector.test.mjs    # ← EDITED (+REND-PAGED-URL after REND-MULTI-OFFSET ~:2801). 180 → 181.
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── url-injection.test.mjs    # run to confirm green (NOT edited — the 4th suite, 38 cases)
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/{renderer_bug001.md, injection_bug002_003.md, spec_ux_bug004_005.md, system_context.md}
    └── P1.M1.T1.S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — :475 skip-guard extended to process kind "url"; comment updated;
                          #                  :456-461 JSDoc + :564-569 field comments (Mode A).
file-injector.test.mjs    # MODIFIED — +runCase("REND-PAGED-URL", …) after REND-MULTI-OFFSET (~:2801). 180 → 181.
# No other files. No new exports. computeDetailOffsets signature unchanged.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — invert the guard to a DENY-list, do not extend the allow-list with a third equality. The target
//   is `if (d.kind === "image" || d.kind === "binary") continue;` — processing text/paged/url and skipping
//   image/binary (F5 is kind "image", so it stays skipped). An allow-list form
//   (`kind !== "text" && kind !== "paged" && kind !== "url"`) is equivalent TODAY but a deny-list is the shape
//   S2 extends (binary leaves the deny-list for its own branch) and it reads as intent.

// CRITICAL — do NOT touch the while-loop math. formatUrlBlock's envelope is byte-identical to
//   formatTextFileBlock (`<file name="URL">\nBODY\n</file>`), so blockPath matches URL names (URLs contain no
//   '"'), the 0x0A body-bearing test passes, and headerLen/closerLen compute the exact body length. The guard
//   is the ONLY blocker — verified by the architecture's block-emission catalog.

// CRITICAL — the paged-directive skip must stay. The directive block `<file name="ABS"><paged: …></file>` has
//   NO leading \n → fails the 0x0A test → never pairs. That is what keeps a paged detail consuming exactly ONE
//   block (the head) and leaves the directive unclaimed. Do not "simplify" the body-bearing test.

// GOTCHA — in the renderer E2E assertion, do NOT hardcode child indices. The paged detail's expanded view emits
//   THREE children (read line + head body + directive text — see REND-PAGED-DIR), so the url read line is at
//   index 3 and the url body at 4. Locate the url read line via findIndex(kids, t => t.includes("read") &&
//   t.includes(<a URL-specific substring>)) and assert the NEXT child.

// GOTCHA — RED-path arithmetic: on the current guard the url detail keeps contentStart/contentLen undefined, so
//   content.slice(undefined, NaN) yields "" (or slice(undefined, undefined) the whole string — either way it
//   !== urlBody) → the unit assertion fails; and the renderer falls to tier-3 bodies[1] (the directive inner)
//   → the E2E assertion fails. BOTH red paths are the bug's signature; both go green via tier-1.

// LIBRARY — computeDetailOffsets mutates `details` in place and returns it; the test reads details[1].contentStart
//   AFTER the call (the REND-MULTI-OFFSET pattern). REND_THEME passes theme calls through, so textOf(child) is
//   the raw string. jiti loads the real Box/Text — no mocking needed for crafted literals.
```

## Implementation Blueprint

### Data models and structure

No model change. `FileDetail` already has `kind: "url"` in its union and `contentStart?`/`contentLen?` fields —
S1 only changes WHICH kinds get them populated. `computeDetailOffsets(blocks, details): FileDetail[]` signature
unchanged.

### Implementation Patterns & Key Details

```ts
// === computeDetailOffsets :475 — BEFORE → AFTER (the ONLY code change) ===

// BEFORE:
//   if (d.kind !== "text" && d.kind !== "paged") continue; // image/binary/F5 — no displayable body

// AFTER:
    if (d.kind === "image" || d.kind === "binary") continue; // no displayable body (F5 is kind "image").
    // url blocks ARE body-bearing (formatUrlBlock ≡ the formatTextFileBlock envelope `<file name="X">\nBODY\n</file>`),
    // so they pair through the same 0x0A test + headerLen/closerLen math below — no special-casing needed.

// (everything below — blockPath, the while-loop scan, the 0x0A body-bearing test, headerLen/closerLen,
//  cursorByPath, the not-found defensive path, SEP "\n\n" — is UNCHANGED)
```

### Cursor-logic trace (why NO math changes are needed — verified)

blocks = `[pagedHead(P), pagedDirective(P), urlBlock(U)]`, details = `[paged(P), url(U)]`:
1. Paged detail (P): cursor 0 → blocks[0] matches P AND is 0x0A body-bearing → pairs the head; `cursorByPath.set(P, 1)`.
2. Url detail (U): no cursor for U → bi=0 → blocks[0] (P≠U) skip → blocks[1] (P≠U, and no 0x0A anyway) skip →
   blocks[2] (U, 0x0A) → pairs; offsets computed from `starts[2]`.
Distinct paths → independent cursors → zero interference. Same-path imports dedup upstream, so the trace is complete.

### The test (TDD RED-first; verbatim)

```js
await runCase("REND-PAGED-URL", "BUG-001(url): kind 'url' gets offsets — after a paged file the url body pairs with ITS block (not the directive)", async () => {
  const PAGED_PATH = "/abs/big.log";
  const URL = "https://example.com/doc";
  const head = "H".repeat(50);
  const urlBody = "# Extracted page markdown\n\nSome prose from the URL.\n";
  const pagedHeadBlock = '<file name="' + PAGED_PATH + '">\n' + head + '\n</file>';
  const pagedDirectiveBlock = '<file name="' + PAGED_PATH + '"><paged: 118890 chars; head delivered 212 complete lines; read the rest with the read tool at offset:213, limit:2000, incrementing offset by 2000 until done></file>';
  const urlBlock = '<file name="' + URL + '">\n' + urlBody + '\n</file>';
  const blocks = [pagedHeadBlock, pagedDirectiveBlock, urlBlock];
  const content = blocks.join("\n\n");
  const details = [
    { path: PAGED_PATH, kind: "paged", chars: 118890, range: ":213-", pagedHeadLines: 212 },
    { path: URL, kind: "url", chars: urlBody.length },
  ];
  mod.computeDetailOffsets(blocks, details);
  // (a) THE regression assertion — the url detail's offsets recover ITS body, never the directive.
  const sliceUrl = content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen);
  assert(sliceUrl === urlBody, `url offset slice must be the exact URL markdown, got ${JSON.stringify(sliceUrl.slice(0, 60))}`);
  assert(!sliceUrl.includes("<paged:"), "url body must NOT be the paged directive");
  // (b) paged pairing unchanged (head block; the directive is skipped by the 0x0A test).
  const slicePaged = content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen);
  assert(slicePaged === head, `paged head slice unchanged, got ${JSON.stringify(slicePaged.slice(0, 40))}`);
  // (c) E2E through the renderer — locate the url READ line, then the NEXT child is the markdown.
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const kids = expanded.children.map(textOf);
  const urlLineIdx = kids.findIndex((t) => t.includes("read") && t.includes("example.com"));
  assert(urlLineIdx !== -1, "the url read line must be present in the expanded view");
  const urlBodyChild = String(kids[urlLineIdx + 1]);
  assert(urlBodyChild.includes("Extracted page markdown"),
    `the child after the url read line must carry the markdown, got ${JSON.stringify(urlBodyChild.slice(0, 80))}`);
  assert(!urlBodyChild.includes("<paged:"), "the url body child must not be the directive");
});
```
RED on the current guard: (a) fails (contentStart undefined → the slice is not urlBody) AND (c) fails (tier-3
`bodies[1]` = the directive inner). GREEN after: tier-1 offsets pair the url block exactly.

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (:475): the skip-guard → `if (d.kind === "image" || d.kind === "binary") continue;` + the updated
    inline comment (F5 is kind "image"; url blocks are body-bearing, same envelope as text).
  - update (:456-461 JSDoc): the "Image/binary/F5 … skipped" sentence → url details now get offsets (body-bearing,
    identical envelope); binary remains skipped here and lands via the note branch (P1.M1.T1.S2).
  - update (:564-569 contentStart/contentLen field comments): "(text/paged/url; image/binary omit — binary via
    the note branch, P1.M1.T1.S2)".
  - UNCHANGED: the while-loop scan (:481-499); blockPath; SEP (:463); formatUrlBlock; the url push (:985-986);
    renderInjectedMessage (tier-1 consumes; tier-3 is S3); emitText/injectFile/injectUrl.

FILE_EDITS (file-injector.test.mjs):
  - add (after REND-MULTI-OFFSET ~:2801): runCase("REND-PAGED-URL", …) verbatim above.

NO_CHANGES: the other three .mjs suites, package.json, scripts/, PRD.md, README.md (P1.M4.T6), all plan/ files.
NO new exports. computeDetailOffsets signature unchanged.
```

### Implementation Tasks (ordered — TDD: RED first)

```yaml
Task 1 (RED): ADD the REND-PAGED-URL test (after REND-MULTI-OFFSET ~:2801)
  - Copy the verbatim test above (crafted literals; the REND-MULTI-OFFSET pattern).
  - VERIFY RED: node ./file-injector.test.mjs → REND-PAGED-URL FAILS at assertion (a) (sliceUrl !== urlBody —
    contentStart undefined) — and would fail (c) too (tier-3 shows <paged:>). Exactly ONE new red; all 180 stay green.

Task 2 (GREEN): CHANGE the :475 skip-guard
  - `if (d.kind === "image" || d.kind === "binary") continue;` + the updated comment (deny-list; F5 = kind "image";
    url body-bearing ≡ text envelope).
  - VERIFY GREEN: node ./file-injector.test.mjs → 181 passed (180 + REND-PAGED-URL), 0 failed.

Task 3 (Mode A): UPDATE the two doc sites
  - computeDetailOffsets JSDoc (:456-461): url now processed; binary via S2's note branch.
  - FileDetail.contentStart/contentLen comments (:564-569): "(text/paged/url; image/binary omit — binary via the
    note branch, P1.M1.T1.S2)".

Task 4: VERIFY gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 181; relative-imports 38; import-behavior 23; url-injection 38 (280 total).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# A guard-condition change + comment edits → no type impact.
```

### Level 2: The Regression Gate (180 existing + 1 new)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 181 passed (REND cluster incl. REND-MULTI-OFFSET/E2E/PAGED-DIR all green)
node ./relative-imports.test.mjs     # →  38 passed
node ./import-behavior.test.mjs      # →  23 passed
node ./url-injection.test.mjs        # →  38 passed (the url suite — the guard change touches its display path)
# If an existing REND case flips: the guard over-reached (re-check ONLY image/binary are skipped).
# If a url-injection case flips: inspect — injectUrl end-to-end should be unaffected (offsets are display-only).
```

### Level 3: TDD RED→GREEN confirmation

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case REND-PAGED-URL|Result:"
# Step A (RED, before Task 2): "✗ case REND-PAGED-URL: … url offset slice must be the exact URL markdown…"
# Step B (GREEN, after Task 2): "  ✓ case REND-PAGED-URL: …" + "Result: 181 passed, 0 failed."
```

### Level 4: N/A (no live-render validation beyond the crafted-literal E2E — the renderer path IS covered)

```bash
# The REND-PAGED-URL (c) leg drives the REAL renderInjectedMessage with the REAL Box/Text (jiti) — that is the
# display validation. No TUI/model run is needed for a display-offset fix pinned at the unit + renderer tiers.
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 181 passed; relative-imports 38 + import-behavior 23 + url-injection 38 (280 total).
- [ ] RED→GREEN confirmed for REND-PAGED-URL.

### Feature Validation (the contract)

- [ ] The :475 guard processes `text`/`paged`/`url`; skips only `image`/`binary` (F5 covered by the image skip).
- [ ] The url detail's offset slice === the exact URL markdown body (never the directive).
- [ ] The paged detail still pairs with the HEAD block only (the directive skipped by 0x0A).
- [ ] The renderer's url body child (after the url read line) carries the markdown, not `<paged:`.

### Code Quality Validation

- [ ] NO math changes (while-loop scan, 0x0A test, headerLen/closerLen, cursorByPath, SEP — all untouched).
- [ ] computeDetailOffsets signature unchanged; no new exports; no changes to renderInjectedMessage (S3 owns tier-3).
- [ ] The binary kind is STILL skipped (S2's branch is next, not here).

### Documentation

- [ ] computeDetailOffsets JSDoc (:456-461) + contentStart/contentLen comments (:564-569) updated (Mode A).
- [ ] No README change (P1.M4.T6 sweeps).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT touch the while-loop math.** `formatUrlBlock`'s envelope is byte-identical to `formatTextFileBlock`;
  the existing 0x0A test + headerLen/closerLen already pair url blocks. The guard is the ONLY change. Any math
  "adjustment" is over-reach that risks the paged/text pairings.
- ❌ **Do NOT add binary in this subtask.** Binary blocks are NOT body-bearing (no leading `\n`) — they need the
  kind-gated note branch that S2 builds. Adding a binary hack here (e.g. special-casing the 0x0A test) would
  break the paged-directive skip invariant.
- ❌ **Do NOT touch the renderer tier-3 fallback.** Making `bodies[i]` path-aware is S3. S1 fixes the SOURCE
  (offsets exist → tier-1 always wins for url); tier-3 remains the defensive fallback for old/foreign entries.
- ❌ **Do NOT hardcode child indices in the renderer assertion.** The paged detail emits 3 children in expanded
  view (read line + head + directive text). Locate the url read line via findIndex and assert the NEXT child.
- ❌ **Do NOT change the guard to an allow-list with three equalities.** Use the deny-list
  (`image || binary`) — it states the intent (no displayable body), covers F5 via kind "image", and is the shape
  S2 extends when binary leaves the deny-list for its own branch.
- ❌ **Do NOT rename the test label.** `REND-PAGED-URL` (the older `BUG-001` label is taken). Do not reuse
  REND-MULTI-OFFSET's name either — this test's contract (paged + url mix) is distinct.
- ❌ **Do NOT skip the url-injection suite.** It is the 4th gate (38 cases) and exercises injectUrl end-to-end;
  a guard change inside computeDetailOffsets must leave it green (offsets are display-only).

---

## Confidence Score: 10/10

A one-line guard inversion with the root cause, the envelope-identity fact (formatUrlBlock ≡ formatTextFileBlock —
verified in the architecture's block-emission catalog), a complete cursor-logic trace proving no math changes, a
verbatim test with both RED paths explained (undefined-offsets unit failure + tier-3 directive-render E2E failure),
and four green suites as the baseline. The only things that can go wrong are scope over-reach (touching the math,
adding binary, editing tier-3) — each explicitly fenced. One guard line + a comment + two doc sentences + one test;
the implementing agent re-runs `npm run typecheck` + the four suite commands.