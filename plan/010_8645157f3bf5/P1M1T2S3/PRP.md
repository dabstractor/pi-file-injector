name: "P1.M1.T2.S3 — Wire the URL scan+inject loop into injectFiles + broaden the input handler pre-check"
description: |
  The final wiring task of milestone P1.M1.T2: connect the already-landed `injectUrl` (T2.S1) to the
  top-level `injectFiles` pipeline by (A) adding an `enableUrls = true` seam param, (B) inserting a
  `text.matchAll(URL_INJECT_RE)` → `cleanToken` → `URL_SHAPE_RE` → dedup → `injectUrl` loop that shares
  `state` with the `#@file` path, and (C) broadening the input handler's cheap pre-check from `includes("#@")`
  to `includes("#")` and passing `cfg.enableUrls !== false`. No new functions, types, or constants — pure
  wiring on top of T2.S1 (injectUrl + helpers) and T1.S2/T1.S3 (enableUrls + regexes), both verified landed.

---

## Goal

**Feature Goal**: Make `#<url>` tokens in a user prompt actually trigger the URL fetch+inject pipeline that `injectUrl` (P1.M1.T2.S1) implements — end-to-end, so `#example.com` and `#https://example.com/x` reach the engine, share budget/dedup/count with the `#@file` path, leave failed tokens verbatim, and stay fully disabled (no network egress) when `enableUrls === false`.

**Deliverable**: Three text-disjoint edits in a single file (`file-injector.ts`):
1. **(A)** `injectFiles` signature: add a 5th trailing param `enableUrls = true` (mirrors the existing `bareAt = false` seam; default `true` so direct unit tests get the URL branch by default).
2. **(B)** A URL scan+inject loop inside `injectFiles`, inserted AFTER the `processTokenStream` call and BEFORE the `state.count === 0` early return — sharing the existing `state` (blocks/details/images/injectedSet/remaining/count) so budget/dedup/count span BOTH triggers.
3. **(C)** Input handler: broaden the cheap pre-check `!event.text?.includes("#@")` → `!event.text?.includes("#")` (both triggers contain `#`), and pass `cfg.enableUrls !== false` as the new 5th arg to `injectFiles`. [Mode A] JSDoc on the new param + a comment block on the loop.

**Success Definition**:
- `npm run typecheck` exits 0 — the new param + loop typecheck under `--strict` (every symbol resolves: `cleanToken` is exported, `URL_INJECT_RE`/`URL_SHAPE_RE` are module-level, `injectUrl` + `State` are in-scope; baseline verified 0 errors before this edit).
- `npm test` exits 0 — the module-surface allowlist is UNCHANGED (T2.S3 adds NO new export; it modifies the existing exported `injectFiles` signature additively and edits the private input handler) → all ~25 `#@file` assertions + handler guards stay green (no `#@file` behavior change).
- `injectFiles("see #example.com", [], ctx, false, true)` with a stubbed `globalThis.fetch` yields `injected >= 1` and a block whose `<file name="https://example.com">` envelope appears (deferred to P1.M2.T1 as a committed test; T2.S3 ships the code + typecheck + regression).

## User Persona (if applicable)

**Target User**: Every Pi end-user who types a `#<url>` token into a prompt (and, indirectly, the P1.M2.T1 test author who writes the hermetic dispatch/guard suite).

**Use Case**: User submits `Summarize this article #https://example.com/post`. The input handler now admits it through the broadened pre-check; `injectFiles` scans `URL_INJECT_RE`, the surviving token passes `URL_SHAPE_RE`, normalizes to `https://example.com/post`, dedups, and `await injectUrl(...)` fetches + extracts → the extracted markdown rides in the existing `fileInjector.injected` custom message (the green `read <url>` box, whose renderer branch T2.S2 already landed).

**User Journey**: user types `#example.com` → input handler passes (broadened pre-check + `cfg.enableUrls !== false`) → `injectFiles` builds shared `state` → `processTokenStream` runs the `#@file` path (here: none) → the new URL loop matches → `injectUrl` fetches/extracts, pushes a `kind:"url"` block+detail, `count++` → `state.count > 0` so the early return stays open → `before_agent_start` publishes the blocks → the renderer's url branch draws `read https://example.com (ctrl+o to expand)`.

**Pain Points Addressed**: Until T2.S3, `injectUrl` is dead code (no caller) and `#<url>` tokens never reach the engine — they fall out at the `includes("#@")` pre-check and (even if they didn't) at `state.count === 0`. This task closes the loop.

## Why

- **Completes milestone P1.M1.T2.** T2.S1 built the pipeline; T2.S2 built the renderer branch; T2.S3 is the wiring that makes `#<url>` actually do something. Without it the entire URL half is inert.
- **Honors the shared-state design (PRD §8 / §9.** Both triggers (`#@file`, `#<url>`) mutate ONE `state` object so budget, dedup, and count are coherent across both. The loop placement (after the file scan, before the count check) is the single load-bearing detail that makes a URL-only prompt work.
- **Default-enabled, disable-able (PRD §4).** `enableUrls !== false` (default `true`) means the feature ships ON; setting `enableUrls: false` in any config source gates ALL network egress (the loop body never runs) — the air-gapped opt-out.

## What

- `injectFiles(text, imagesIn, ctx, bareAt = false, enableUrls = true)` — the new 5th param. Default `true` (direct unit tests); the input handler passes the real `cfg.enableUrls !== false`.
- Inside `injectFiles`, between the `processTokenStream` call and the `state.count === 0` early return: a `text.matchAll(URL_INJECT_RE)` loop that, when `enableUrls` is truthy, for each match runs `cleanToken(m[2])` → `URL_SHAPE_RE.test(tok)` → normalize to absolute form → dedup against `state.injectedSet` → `await injectUrl(abs, state, ctx)`.
- Input handler pre-check broadened to `!event.text?.includes("#")`; the `injectFiles(...)` call gains the 5th arg `cfg.enableUrls !== false`.
- The verbatim-prompt return (`text: event.text`) is UNCHANGED — failed URL tokens stay verbatim exactly like failed `#@` tokens (PRD §6.4/§13.8).

### Success Criteria

- [ ] `injectFiles` accepts `enableUrls` as a 5th param, default `true`.
- [ ] The URL loop runs ONLY when `enableUrls` is truthy; when falsy, ZERO network egress (the loop body is skipped entirely).
- [ ] The loop is placed AFTER `processTokenStream` and BEFORE the `state.count === 0` check (so URL-only prompts reach the engine and `injectUrl`'s `count++` keeps the early return open).
- [ ] Dedup uses `state.injectedSet` keyed on the ABSOLUTE URL form (`#example.com` and `#https://example.com` collapse to one `https://example.com`).
- [ ] The input handler pre-check is `includes("#")` and passes `cfg.enableUrls !== false` (default enabled — NOT `=== true`).
- [ ] `npm run typecheck` exits 0; `npm test` exits 0 (module-surface allowlist unchanged).
- [ ] No `#@file` behavior change (existing tests stay byte-for-byte green).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_ **Yes.** All three edits are specified with their CURRENT exact source text (line numbers shifted because T2.S1/T2.S2 landed ~210+25 lines — the item description's L1114/L1184/L1186/L1255/L1257/L1227 are STALE), exact placement, and the three load-bearing invariants (loop placement, `!== false` gate, shared `state`). Every consumed symbol is located and its signature verified against the live source.

### Documentation & References

```yaml
# The PRD pseudocode for the URL branch (the scan loop this task wires in)
- docfile: spec/  # merged PRD §8 "Pseudocode — the URL branch" + §9 merge table + §4 enableUrls
  why: "§8 shows the exact scan→cleanToken→shape→normalize→dedup→injectUrl pipeline; §4 pins the default-true + disable semantics."
  critical: |
    PRD §8 places the loop "after seeding state and BEFORE/AFTER the file token loop" and keys dedup by
    absolute form. This task places it AFTER processTokenStream (so files claim injectedSet first) and
    BEFORE the count check (so count++ in injectUrl keeps the early return open). §4: enableUrls default
    TRUE → gate is `!== false`, NOT `=== true`.

# Architecture — the verified line numbers + the enableUrls-polarity refinement (LOAD-BEARING)
- docfile: plan/010_8645157f3bf5/architecture/system_context.md
  why: "§2 has the (pre-T2.S1) line numbers; §3 Refinement #2 is the `!== false` gate rationale."
  critical: |
    Refinement #2: readConfig returns {} when sources are missing → cfg.enableUrls is undefined by
    default → the gate MUST be `cfg.enableUrls !== false` (default ENABLED). `=== true` would DISABLE
    URLs by default (wrong). This is the INVERSE polarity of `markdownBareAtImports === true` (opt-IN).
    NOTE: §2's line numbers (L1114 etc.) are PRE-T2.S1; the CURRENT numbers are in this PRP's Tasks.

# The producer PRP — defines injectUrl's exact contract (the thing this loop calls)
- file: plan/010_8645157f3bf5/P1M1T2S1/PRP.md
  why: "injectUrl(url, state, ctx): Promise<boolean> — PRIVATE, never throws, count++ exactly once on
        success, mutates shared state (blocks/details/images/remaining/count), returns false→verbatim."
  pattern: "injectUrl is the analog of injectFile for URLs: claim-free (URLs dedup via injectedSet at the
            loop, NOT inside injectUrl), budget-aware (subtract via the shared State), count-bumping."
  gotcha: "injectUrl does NOT touch state.paged (URLs never page, §3.3). The notify `whole = injected -
           paged` math therefore counts URL successes as 'whole' — correct count, cosmetically imprecise
           wording; OUT of T2.S3 scope (do not change the notify)."

# The parallel sibling PRP — readLine url branch (ALREADY LANDED; confirms FileDetail.kind 'url' present)
- file: plan/010_8645157f3bf5/P1M1T2S2/PRP.md
  why: "Confirms the readLine url renderer branch + FileDetail.kind 'url' member exist (verified at
        file-injector.ts L1018 + L472). T2.S3 does NOT touch either."
  gotcha: "T2.S2 is DONE in source. Do NOT re-add the union member or re-add the readLine branch."

# The regex producer PRP — URL_INJECT_RE (group 2) + URL_SHAPE_RE contract
- file: plan/010_8645157f3bf5/P1M1T1S3/PRP.md
  why: "URL_INJECT_RE is /gu-flagged (matchAll-legal; group 2 = token). URL_SHAPE_RE is anchored ^…$
        (use .test()). cleanToken(m[2]) strips trailing TRAILING_PUNCT before the shape gate."
  gotcha: "matchAll REQUIRES the `g` flag — URL_INJECT_RE has it (verified L26). Do NOT re-declare either
           regex; both are module-level constants consumed read-only by this loop."

# The config producer PRP — enableUrls on FileInjectorConfig
- file: plan/010_8645157f3bf5/P1M1T1S2/PRP.md
  why: "enableUrls?: boolean is on FileInjectorConfig (verified L210); readConfig shallow-merges it onto
        the module-level `cfg` (L1439) on session_start. The handler reads cfg.enableUrls."
  gotcha: "cfg.enableUrls is undefined by default (readConfig → {}) → see Refinement #2 above."

# The file being edited (the ONLY source file this task touches)
- file: file-injector.ts  # injectFiles (L1326 sig, L1391 processTokenStream call, L1394 count check) + input handler (L1467 pre-check, L1469 injectFiles call)
  why: "The three edit sites. Read the CURRENT text before editing (line numbers shifted from the item
        description's stale L1114/L1255/L1257)."
  pattern: "Mirror the `bareAt` seam for the new `enableUrls` param; mirror processTokenStream's
            state-threading for the loop (it already mutates the shared `state`)."
  gotcha: "GOTCHA (placement): the loop MUST sit between L1392 and L1394 — after processTokenStream (so
           files claim injectedSet first) and before the count check (so injectUrl's count++ keeps the
           early return open for URL-only prompts). Putting it before processTokenStream or after the
           count check BREAKS URL-only prompts."

# Test surface — the module-surface allowlist guard
- file: file-injector.test.mjs  # ASSERTED_EXPORTS allowlist (~L136–156)
  why: "Confirms injectFiles is ALREADY exported (the only export T2.S3 touches). T2.S3 changes its
        SIGNATURE additively (adds a default-valued trailing param) — callers that omit it are unaffected
        → the allowlist (which checks export NAMES, not arity) stays green."
  gotcha: "Do NOT add a new export. injectUrl stays PRIVATE (T2.S1's decision); T2.S3 consumes it in-module."

# Test harness constraints (for P1.M2.T1 — read so you don't pre-empt them)
- file: plan/010_8645157f3bf5/architecture/system_context.md  # §4 Test Harness Constraints
  why: "Hermetic URL tests call injectFiles(prompt, [], ctx, bareAt, enableUrls) directly with
        globalThis.fetch stubbed. The enableUrls param T2.S3 adds is the SEAM those tests use. Do NOT
        wire URLs any other way (e.g. a second exported function) — the seam IS the param."
```

### Current Codebase tree (the file this task touches)

```bash
.
├── file-injector.ts          # EDIT (3 text-disjoint edits): injectFiles signature + URL loop + input handler
├── file-injector.test.mjs    # NOT modified (injectFiles already exported; signature change is additive)
├── import-behavior.test.mjs  # NOT modified
├── relative-imports.test.mjs # NOT modified
├── scripts/typecheck.mjs     # NOT modified
├── tsconfig.json             # NOT modified (editor-only; npm run typecheck ignores it)
├── package.json              # NOT modified (S1 installed deps; no new deps here)
└── plan/010_8645157f3bf5/P1M1T2S3/
    ├── PRP.md                # THIS file.
    └── research/notes.md     # line-precise research record + safety analysis.
```

### Desired Codebase tree with files to be added

```bash
# No NEW files. The single edited file, file-injector.ts, gains (all in-place):
#   L1330 area  injectFiles signature  — +1 param: `enableUrls = true` (5th, after `bareAt = false`)
#   L1392–L1394 injectFiles body       — +~12 lines: the URL scan+inject loop (inserted in the blank line
#                                        between the processTokenStream call and the count===0 early return)
#                                        + a [Mode A] comment block on the loop
#   L1467       input handler          — pre-check `includes("#@")` → `includes("#")` (1 token)
#   L1469       input handler          — injectFiles call gains 5th arg `cfg.enableUrls !== false`
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL (GOTCHA — loop PLACEMENT is load-bearing): the URL loop MUST be inserted AFTER the
//   processTokenStream call (L1391–L1392) and BEFORE the `state.count === 0` early return (L1394).
//   WHY: injectUrl does `state.count++` on success (verified L830). If the loop ran AFTER the count
//   check, a URL-only prompt (no #@file) would early-return at count===0 BEFORE any URL is injected →
//   #<url> tokens would never reach the engine. If it ran BEFORE processTokenStream, files wouldn't
//   get first claim on injectedSet (minor; in practice URLs ≠ abs paths, but the invariant is cleaner
//   this way). The single blank line between L1392 and L1394 is the correct insertion point.

// CRITICAL (GOTCHA — enableUrls polarity): the handler gate is `cfg.enableUrls !== false`
//   (default ENABLED), NOT `=== true`. readConfig returns {} when sources are missing → cfg.enableUrls
//   is undefined by default. `=== true` would DISABLE URLs by default (violates spec §4 "default true").
//   This is the INVERSE polarity of `markdownBareAtImports === true` (which is an opt-IN). The INJECTFILES
//   param default is `true` (so direct unit tests get the branch); the handler passes the REAL cfg value.

// CRITICAL (GOTCHA — stale line numbers): the item description cites L1114/L1184/L1186/L1255/L1257/L1227.
//   These are PRE-T2.S1. T2.S1 added ~210 lines and T2.S2 added ~25. The CURRENT verified positions are:
//     injectFiles signature .... L1326 (bareAt param at L1330)
//     processTokenStream call .. L1391–L1392
//     state.count === 0 ........ L1394
//     input handler pre-check .. L1467
//     injectFiles call ......... L1469
//     module-level cfg ......... L1439 (`let cfg: FileInjectorConfig = {};`)
//   ALWAYS read the current text (grep) before writing the edit oldText.

// CRITICAL (NO NEW EXPORT): T2.S3 adds NO export. injectFiles is ALREADY exported (L1326); changing its
//   signature additively (a default-valued trailing param) does not change the export NAME → the
//   file-injector.test.mjs allowlist (~L136–156) stays green. injectUrl stays PRIVATE (T2.S1's call).

// GOTCHA (matchAll requires `g`): URL_INJECT_RE (L26) is `/gu`-flagged → `text.matchAll(URL_INJECT_RE)`
//   is legal. If URL_INJECT_RE lacked `g`, matchAll would THROW. (Verified present — do NOT re-declare.)

// GOTCHA (shared state, not a fresh accumulator): the loop mutates the SAME `state` object processTokenStream
//   uses (blocks/details/images/injectedSet/remaining/count/paged). Do NOT build a separate URL state.
//   injectUrl already does state.count++ and subtract(state, cost) internally — the loop just calls it.

// GOTCHA (dedup key = ABSOLUTE form): normalize BEFORE the injectedSet check so `#example.com` (→
//   `https://example.com`) and `#https://example.com` (→ `https://example.com`) collapse to one.
//   const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;

// GOTCHA (NO notify change): the existing notify (`#@ injected N whole[, M paged]`, L1478) counts
//   state.count (which includes URL successes; injectUrl never touches state.paged → URLs count as
//   "whole"). The WORDING is cosmetically imprecise for URL-only prompts but the COUNT is correct and
//   the contract scopes the wording change OUT of T2.S3. Do NOT edit the notify.

// GOTCHA (verbatim prompt UNCHANGED): injectFiles returns the ORIGINAL `text`; the handler returns
//   `text: event.text` (L1481). A failed URL (network/over-budget/SPA/unhandled-type) → injectUrl
//   returns false → no block → the #<url> token stays in the prompt byte-for-byte, EXACTLY like a
//   failed #@file. No stripping anywhere (PRD §6.4/§13.8: cancel/fork/re-open re-triggers injection).
```

## Implementation Blueprint

### Data models and structure

No new runtime models. No new types. No new constants. One additive signature change (a default-valued trailing param) + one inserted loop + two single-line handler edits. All consumed symbols (`URL_INJECT_RE`, `URL_SHAPE_RE`, `cleanToken`, `injectUrl`, `state.injectedSet`, `state.count`) are verified present from prior tasks.

```ts
// The ONLY signature change (additive; default-valued → existing 4-arg callers unaffected):
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false,
  enableUrls = true, // ← NEW (P1.M1.T2.S3): the URL-branch seam; default true for direct unit tests; the input handler passes cfg.enableUrls !== false
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }> { /* … */ }
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the enableUrls param to injectFiles (file-injector.ts, L1330 area)
  - READ the current signature (grep `export async function injectFiles`).
  - CHANGE the line:
        bareAt = false, // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
    INTO TWO lines:
        bareAt = false, // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
        enableUrls = true, // [P1.M1.T2.S3] §4 — URL #<url> injection enabled? Default true so direct unit tests get the branch; the input handler passes the real `cfg.enableUrls !== false` (default-enabled; see architecture Refinement #2).
  - WHY: this is the SEAM both the loop (Task 2) and the handler (Task 3) read. Mirrors the existing
         `bareAt` trailing-param pattern (default for direct callers; real value from cfg in the handler).
  - GOTCHA: default `true`, NOT derived from cfg. The handler is responsible for passing the cfg value;
             injectFiles itself never reads cfg. (Direct unit tests pass enableUrls explicitly.)
  - SAFETY: additive default-valued trailing param → every existing 4-arg call (the handler today, and any
             test calling injectFiles(text, images, ctx, bareAt)) is unaffected at runtime.

Task 2: INSERT the URL scan+inject loop (file-injector.ts, in the BLANK LINE between the processTokenStream
         call at L1391–L1392 and the `state.count === 0` early return at L1394) — THE UNIQUE DELIVERABLE
  - READ the current text around L1391–L1394 (grep `await processTokenStream` and `state.count === 0`).
  - INSERT (with a [Mode A] comment block) into the single blank line between them:
        // [P1.M1.T2.S3] §8 URL branch — scan #<url> tokens and inject via injectUrl (T2.S1). Shares the
        // SAME `state` as the #@file path above (blocks/details/images/injectedSet/remaining/count), so
        // budget, dedup, and count are coherent across BOTH triggers. Placement is load-bearing: AFTER
        // processTokenStream (files claim injectedSet first) and BEFORE the count===0 check (injectUrl's
        // count++ keeps the early return open for URL-only prompts). Pipeline: matchAll(URL_INJECT_RE,
        // group 2 = token) → cleanToken (strip trailing punct, §4.3) → URL_SHAPE_RE shape gate →
        // normalize to absolute form → dedup on state.injectedSet (absolute key → #example.com and
        // #https://example.com collapse) → await injectUrl (never throws; false → token left verbatim).
        // enableUrls===false → loop body skipped entirely → ZERO network egress (§4 air-gapped opt-out).
        if (enableUrls) {
          for (const m of text.matchAll(URL_INJECT_RE)) {
            const tok = cleanToken(m[2]);
            if (tok && URL_SHAPE_RE.test(tok)) {
              const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
              if (!state.injectedSet.has(abs)) {
                state.injectedSet.add(abs);
                await injectUrl(abs, state, ctx);
              }
            }
          }
        }
  - CRITICAL: place it in the blank line BETWEEN `…, state, ctx);` (end of processTokenStream call) and
         the `if (state.count === 0) return { … }` line. NOT before processTokenStream; NOT after the
         count check. (See GOTCHA on placement.)
  - DO NOT redeclare URL_INJECT_RE / URL_SHAPE_RE / cleanToken / injectUrl — all are module-level /
         exported / in-scope (verified L26/L36/L121/L830). The loop only READS the regexes and CALLS the
         functions.
  - DO NOT add a try/catch around the loop — injectUrl NEVER throws (T2.S1's §3.5 contract). A throw here
         would propagate out of injectFiles, which violates the never-throw-out invariant; injectUrl's own
         internal try/catch + finally guarantee it can't.
  - DO NOT touch state.paged (URLs never page; injectUrl handles its own count++/subtract internally).

Task 3: BROADEN the input handler pre-check + pass enableUrls (file-injector.ts, L1467 + L1469)
  - 3a. READ the current pre-check (grep `event.text?.includes("#@")`).
        CHANGE: `if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)`
             → `if (!event.text?.includes("#")) return { action: "continue" }; // [P1.M1.T2.S3] cheap pre-check: both triggers (#@file, #<url>) contain '#' (§12.4)`
  - 3b. READ the current injectFiles call (grep `await injectFiles(event.text`).
        CHANGE the call's arg list — append a 5th arg — so:
            await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);
          becomes:
            await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true, cfg.enableUrls !== false); // [P1.M1.T2.S3] §4 — enableUrls default-enabled (Refinement #2: !== false, NOT === true); false gates ALL network egress
        (Preserve the existing trailing // … comment tail if present; the edit is purely the 5th arg + a
         concise §4 note. Match the existing comment style.)
  - WHY: the pre-check must admit `#<url>` prompts (they contain `#`, not `#@`); the 5th arg wires the
         real config value. The `!== false` polarity is load-bearing (Refinement #2).
  - GOTCHA (pre-check is a SUPERSET, safe): a `#`-bearing prose prompt (e.g. `# Heading`, `# 1234`) now
         passes the pre-check but matches NEITHER `#@` (FILE_INJECT_RE) NOR a URL shape (URL_SHAPE_RE) →
         injectFiles returns injected:0 → the handler's `if (!injected) return { action: "continue" }`
         (L1471) preserves it byte-for-byte. Only a (cheap) no-op regex scan is added. `C# rocks` is
         blocked even as a candidate (the lookbehind `(?<![\p{L}\p{N}_])` rejects `#` after a word char).
  - DO NOT change the verbatim return (`text: event.text`, L1481) or the notify (L1478).

Task 4: VALIDATE (no code)
  - RUN: `npm run typecheck` → EXPECT exit 0 (the loop resolves cleanToken/URL_*_RE/injectUrl; the new
         param has a default; the handler's 5th arg is a boolean).
  - RUN: `npm test` → EXPECT exit 0 (module-surface allowlist unchanged — injectFiles already exported,
         no new export; all #@file assertions + handler guards green; no #@file behavior change).
```

### Implementation Patterns & Key Details

```ts
// ───────── Task 1: the enableUrls seam (mirrors the bareAt seam directly above it) ─────────
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false,
  enableUrls = true, // ← NEW: default true (direct unit tests); handler passes cfg.enableUrls !== false
): Promise<{ /* …unchanged… */ }> {
  // … (budget + priorPaths + state construction unchanged) …

  await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);

  // ── NEW (Task 2): the URL branch — shares `state` with the #@file path ──
  if (enableUrls) {
    for (const m of text.matchAll(URL_INJECT_RE)) {
      const tok = cleanToken(m[2]);
      if (tok && URL_SHAPE_RE.test(tok)) {
        const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
        if (!state.injectedSet.has(abs)) {
          state.injectedSet.add(abs);
          await injectUrl(abs, state, ctx);   // never throws; count++ on success; false → verbatim
        }
      }
    }
  }

  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };
  // … (rest of injectFiles unchanged) …
}

// ───────── Task 3: the input handler (pre-check broadened + 5th arg) ─────────
pi.on("input", async (event, ctx) => {
  if (event.source === "extension") return { action: "continue" };
  if (event.streamingBehavior === "steer") return { action: "continue" };
  if (!event.text?.includes("#")) return { action: "continue" }; // ← broadened (was "#@")
  const { text, images, injected, paged, blocks, details } = await injectFiles(
    event.text, event.images ?? [], ctx,
    cfg.markdownBareAtImports === true,
    cfg.enableUrls !== false, // ← NEW 5th arg (default-enabled; Refinement #2)
  );
  if (!injected) return { action: "continue" };
  // … (pending stash + notify + verbatim return UNCHANGED) …
});
// NOTE: every symbol in the loop (URL_INJECT_RE, URL_SHAPE_RE, cleanToken, injectUrl, state) is already
//       declared/exported by prior tasks — the loop only consumes them. No redeclaration, no new export.
```

### Integration Points

```yaml
IMPORTS: none (no new imports; URL_INJECT_RE/URL_SHAPE_RE are module-level since T1.S3; cleanToken is
         exported since the original file; injectUrl is in-module since T2.S1).
DATABASE: none.
CONFIG:
  - consumed: FileInjectorConfig.enableUrls (L210, from T1.S2) — read off the module-level `cfg`
    (L1439) in the input handler as `cfg.enableUrls !== false`. readConfig already shallow-merges it
    on session_start (no readConfig change).
ROUTES: none.
REGISTRY: none.
DOWNSTREAM CONSUMERS:
  - injectUrl (T2.S1, L830): now has a CALLER. Called once per surviving, deduped URL. Its contract
    (never throws, count++ on success, subtract on success, false→verbatim) is what makes the loop a
    pure `await` with no surrounding error handling.
  - P1.M2.T1.S1/S2 (hermetic tests): call injectFiles(prompt, [], ctx, bareAt, enableUrls) directly with
    globalThis.fetch stubbed. The enableUrls param T2.S3 adds IS the seam those tests use to exercise
    the branch without the handler.
  - P1.M2.T2.S1 (README docs): documents the #<url> trigger + enableUrls + the wiring (this task).
PARALLEL/SEQUENCE COORDINATION:
  - vs P1.M1.T2.S1 (injectUrl — DONE in source): T2.S3 CONSUMES injectUrl. No overlap; clean.
  - vs P1.M1.T2.S2 (readLine url branch — DONE in source): T2.S3 does NOT touch the renderer. Clean.
  - vs P1.M1.T1.S2/S3 (enableUrls + regexes — DONE): T2.S3 consumes them. Clean.
  - vs P1.M2.T1 (tests — PLANNED): T2.S3 ships the code + typecheck + regression; P1.M2.T1 ships the
    behavioral dispatch/guard tests (globalThis.fetch stubbed). Do NOT pre-empt P1.M2.T1's tests here.
```

## Validation Loop

### Level 1: Syntax & Style (the HARD GATE — run first and last)

```bash
# Proves the new param + the loop typecheck under --strict: cleanToken is exported, URL_INJECT_RE/
# URL_SHAPE_RE are module-level RegExp (matchAll + .test both legal), injectUrl is in-scope, state.
# injectedSet is Set<string>, and the handler's 5th arg is boolean. Baseline verified 0 errors pre-edit.
npm run typecheck
# Expected: exit 0, "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
# If TS2554 on the injectFiles call → you forgot the 5th arg in the handler, or added it in the wrong spot.
# If TS2304 (cleanToken/URL_*_RE/injectUrl not found) → a prior task didn't land; re-check producers.
```

### Level 2: Unit Tests (regression — proves no module-surface break + no #@file behavior change)

```bash
# The module-surface allowlist (file-injector.test.mjs ~L136–156) checks export NAMES, not arity.
# injectFiles is ALREADY exported; T2.S3 changes its signature additively (a default-valued trailing
# param) → existing 4-arg callers unaffected → the allowlist stays green. The ~25 #@file assertions +
# the 3 handler guards + the headless/notify path must all still pass (the file path is byte-for-byte
# unchanged; the broadened pre-check only ADDS prompts that previously short-circuited — it never
# removes a #@file prompt). Loads via jiti from the GLOBAL pi package.
npm test
# Expected: exit 0. (Requires the global pi package for the jiti loader. If it fails ONLY due to a
#   missing global pi, `npm run typecheck` remains the authoritative gate — see the S3/S1 PRP Level 2 note.)
# NOTE: behavioral URL dispatch/guard tests are P1.M2.T1's job (globalThis.fetch stubbed). T2.S3 ships
#   code + typecheck + regression.
```

### Level 3: Integration Testing (OPTIONAL dev-time smoke — NOT committed; defer behavioral to P1.M2.T1)

```bash
# The loop is now wired, so a hermetic smoke is possible by stubbing globalThis.fetch. OPTIONAL
# confidence-building — the default path is typecheck (L1) + existing-tests-green (L2). If you want
# immediate end-to-end feedback (NEVER real network):
node --input-type=module -e '
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(
    "<html><body><article><p>" + ("A sufficiently long article body to clear the two hundred character SPA empty-extraction floor so defuddle returns real markdown content for the test to assert on. ".repeat(2)) + "</p></article></body></html>",
    { headers: { "content-type": "text/html" }, status: 200 });
  try {
    // Load via the project jiti loader (the path file-injector.test.mjs uses), then:
    //   const r = await mod.injectFiles("see #example.com please", [], { cwd: "." }, false, true);
    //   console.log({ injected: r.injected, hasBlock: r.blocks.some(b => b.includes("<file name=\"https://example.com\">")) });
    // Expected (with a rich-enough fixture + jiti import): injected >= 1, hasBlock === true.
  } finally { globalThis.fetch = orig; }
'
# Then confirm the DISABLE path makes ZERO network calls:
node --input-type=module -e '
  let called = 0; globalThis.fetch = async () => { called++; return new Response("", { status: 404 }); };
  try {
    //   const r = await mod.injectFiles("see #example.com", [], { cwd: "." }, false, false); // enableUrls=false
    //   console.assert(called === 0, "enableUrls=false must make ZERO fetch calls");
  } finally { globalThis.fetch = orig; }
'
# (Both smokes need the real jiti import line; the point is: enableUrls=true injects, enableUrls=false
#  makes no network call. P1.M2.T1 formalizes these as committed hermetic tests.)
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (The full behavioral matrix — content-type dispatch × the three guards × SPA fallback × image byte path
#  × enableUrls:false no-egress × dedup-by-absolute-form × URL-only-prompt-reaches-engine — is formalized
#  as hermetic tests in P1.M2.T1.S1/S2 with globalThis.fetch stubbed. T2.S3 delivers the wiring + typecheck
#  + regression; P1.M2.T1 proves behavior. No live network in CI.)
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` exits 0 (new param + loop typecheck under `--strict`).
- [ ] `npm test` exits 0 (module-surface allowlist unchanged — injectFiles already exported; no new export; all `#@file` assertions + handler guards green).

### Feature Validation
- [ ] `injectFiles` accepts `enableUrls` as a 5th param (default `true`), placed AFTER `bareAt = false`.
- [ ] The URL loop is inserted AFTER the `processTokenStream` call and BEFORE the `state.count === 0` early return (the load-bearing placement).
- [ ] The loop runs ONLY when `enableUrls` is truthy; `enableUrls === false` → the loop body is skipped (ZERO network egress).
- [ ] The loop uses the shared `state` (NOT a fresh accumulator) — same `blocks`/`details`/`images`/`injectedSet`/`remaining`/`count` as the `#@file` path.
- [ ] Dedup keys on the ABSOLUTE URL form (`#example.com` and `#https://example.com` collapse to `https://example.com`) via `state.injectedSet`.
- [ ] The input handler pre-check is `includes("#")` (broadened from `"#@"`).
- [ ] The input handler passes `cfg.enableUrls !== false` as the 5th arg (default-ENABLED — NOT `=== true`).
- [ ] The verbatim-prompt return (`text: event.text`) and the notify are UNCHANGED.

### Code Quality Validation
- [ ] No new export (injectFiles signature change is additive; injectUrl stays private).
- [ ] No redeclaration of `URL_INJECT_RE` / `URL_SHAPE_RE` / `cleanToken` / `injectUrl` (all consumed read-only).
- [ ] No try/catch added around the loop (injectUrl never throws — T2.S1's §3.5 contract).
- [ ] Follows the existing `bareAt` trailing-param seam convention for the new `enableUrls` param.
- [ ] [Mode A] JSDoc on the `enableUrls` param + a comment block on the loop (shared-state design + cleanToken/URL_SHAPE_RE/dedup pipeline).

### Documentation & Deployment
- [ ] [Mode A] comment block on the URL loop documents the shared-state design, the load-bearing placement, and the cleanToken → URL_SHAPE_RE → normalize → dedup → injectUrl pipeline.
- [ ] No new environment variables or config keys (enableUrls already on FileInjectorConfig from T1.S2).

---

## Anti-Patterns to Avoid

- ❌ Don't place the loop BEFORE `processTokenStream` or AFTER the `state.count === 0` check — it MUST sit between them (after files claim `injectedSet`; before the count check so `injectUrl`'s `count++` keeps the early return open for URL-only prompts).
- ❌ Don't use `cfg.enableUrls === true` — that DISABLES URLs by default (cfg.enableUrls is `undefined` when unset). Use `cfg.enableUrls !== false` (default-enabled, Refinement #2).
- ❌ Don't match the item description's STALE line numbers (L1114/L1184/L1186/L1255/L1257/L1227) — those are pre-T2.S1. Grep the CURRENT positions first (injectFiles ~L1326, processTokenStream call ~L1391, count check ~L1394, pre-check ~L1467, injectFiles call ~L1469).
- ❌ Don't add a new export, redeclare the regexes, or wrap the loop in try/catch — injectFiles is already exported, the regexes are module-level, and `injectUrl` never throws.
- ❌ Don't build a separate URL state accumulator — the loop mutates the SAME `state` object `processTokenStream` uses (shared budget/dedup/count is the whole point).
- ❌ Don't dedup before normalizing to absolute form — `#example.com` and `#https://example.com` must collapse to ONE inject (`https://example.com`). Normalize FIRST, then check `state.injectedSet`.
- ❌ Don't change the notify wording or the verbatim return — the count is already correct (injectUrl's `count++`); the wording is cosmetically imprecise for URL-only prompts but explicitly OUT of T2.S3 scope.
- ❌ Don't pre-empt P1.M2.T1's behavioral tests — T2.S3 ships the wiring + typecheck + regression only.

---

## Confidence Score

**9 / 10** for one-pass success. This is pure wiring on top of two already-landed producers (T2.S1 `injectUrl` + helpers; T2.S2 readLine branch) and two config/regex producers (T1.S2 `enableUrls`; T1.S3 `URL_INJECT_RE`/`URL_SHAPE_RE`) — all verified present in the current source, with the baseline `npm run typecheck` confirmed green (0 errors). The three edits are text-disjoint, additive, and each specified with its exact current source text. The three load-bearing invariants (loop placement, `!== false` polarity, shared `state`) are each called out with a CRITICAL gotcha. The only residual risk is an `oldText` mismatch if a between-now-and-implementation edit shifts the surrounding lines — mitigated by instructing the implementer to grep the current positions before writing each edit, and by keeping the `oldText` anchors minimal and unique. Behavioral dispatch/guard validation is correctly deferred to P1.M2.T1 (T2.S3's scope is wiring + typecheck + regression).

---