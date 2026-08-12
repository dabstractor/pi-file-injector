name: "P1.M1.T2.S2 — FileDetail.kind 'url' union member + readLine url renderer branch"
description: |
  Add a `url` branch to the chat renderer's `readLine()` so URL-injected files render as a green
  `read <url>` line (raw URL, no tildify, no range/hint), and ensure the `FileDetail.kind` union
  lists `'url'` (idempotent — T2.S1 likely already added it) with updated JSDoc.

---

## Goal

**Feature Goal**: The chat renderer's collapsed `read`-line box (the green `toolSuccessBg` Box) renders an injected URL as one line — `read https://example.com/api` — in the exact same green/bold/accent styling as a completed `read` tool call, with the URL shown **raw** (no home-directory tildification) and **no** range/hint suffix.

**Deliverable**: Three small, text-disjoint edits in a single file (`file-injector.ts`):
1. **(Idempotent)** Ensure `FileDetail.kind` union includes `"url"` (T2.S1, running in parallel, has likely already landed it — detect-and-skip to stay merge-safe).
2. **(Unique deliverable)** Add a `url` branch to the private `readLine()` function, placed between the `paged` branch and the final text fallback, returning `title + theme.fg("accent", d.path)` (raw URL — **NOT** the pre-tildified `pathPart`).
3. **(Docs)** Update the `FileDetail` JSDoc to list `url` and reconcile T2.S1's handoff note (the renderer branch now exists).

**Success Definition**: `npm run typecheck` exits 0; `npm test` exits 0 (module-surface allowlist unchanged — `readLine` is private, no new export); a url-kind detail renders as `read <raw-url>` (green accent, no tildify, no suffix) with the expanded view showing the extracted markdown body via the existing generic body-recovery path (no renderer change required — verified).

## User Persona (if applicable)

**Target User**: Pi end-user authoring a prompt that contains a `#<url>` token.

**Use Case**: User types `Summarize this article #<https://example.com/post>`. The URL is fetched + HTML→markdown extracted by `injectUrl` (T2.S1). This task (T2.S2) makes the resulting green injection box render a human-readable, URL-faithful collapsed line so the user can see exactly what was injected, visually indistinguishable from a completed `read` tool call.

**User Journey**: User submits prompt → `injectUrl` pushes a `kind:"url"` detail (T2.S1) → `renderInjectedMessage` draws the green Box → `readLine(d)` for the url detail returns the green `read <url>` line → user sees `read https://example.com/post (ctrl+o to expand)` and can press ctrl+o to read the markdown.

**Pain Points Addressed**: Without the explicit url branch, url details fall through to the text fallback — which would tildify the URL (a harmless runtime no-op today, but semantically wrong and brittle if a URL ever collided with a home-relative prefix) and would mis-document intent. An explicit branch makes URL rendering first-class and self-documenting.

## Why

- **PRD §6 (Chat display)**: "Each injected URL is one collapsed line: `read https://example.com/api (ctrl+o to expand)`." This task implements exactly that line.
- **Integration with existing features**: Consumes the `kind:"url"` details that `injectUrl` (T2.S1) emits; produces the visual parity with the built-in `read` tool that the renderer (T2.S1-adjacent `renderInjectedMessage`) already provides for text/image/binary/paged files.
- **Correctness**: URLs are not filesystem paths — they must not be passed through `tildify()` (which collapses a leading `os.homedir()` to `~`). The explicit branch guarantees the raw URL is rendered.

## What

- `FileDetail.kind` accepts `"url"` (it already does as of this writing — T2.S1 landed it; this task makes the addition idempotent and merges cleanly regardless of order).
- `readLine(d, theme)` returns `` `${title} ${theme.fg("accent", d.path)}` `` (raw `d.path`, which holds the URL) when `d.kind === "url"`, with **no** range/dimensionHint/expandHint suffix on the line itself (the `(ctrl+o to expand)` hint is added once per-box by `renderInjectedMessage`, not by `readLine`).
- `FileDetail`'s JSDoc lists `url` alongside text/image/binary/paged, and the inline handoff note is reconciled (branch now exists).

### Success Criteria

- [ ] `readLine({ path: "https://example.com/api", kind: "url" }, theme)` returns a string of the form `read https://example.com/api` where `read` is toolTitle+bold, the URL is accent-colored, and the URL is byte-for-byte the input (no `~`, no leading/trailing mutation, no appended range/hint).
- [ ] `FileDetail.kind` union includes `"url"`.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0 (no module-surface break — `readLine` stays private).
- [ ] No change to `renderInjectedMessage` (expanded-view url-body display is handled by the existing generic 3-tier body recovery — verified; see Context).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_ **Yes** — the three edits are specified with exact current source text, exact placement, and the one load-bearing gotcha (do NOT reuse the pre-tildified `pathPart` for the url branch). The parallel-coordination reality (union member likely already present) is explicitly handled via an idempotency instruction.

### Documentation & References

```yaml
# PRD — the green read-line box spec (the readLine url branch mirrors the text branch, minus tildify)
- docfile: spec/  # the merged PRD §6.3 "Chat display" + §6 (URL display extension)
  why: "§6.3 defines readLine's per-kind branches; §6 says the url line is identical to text but the path is the URL (no tildify) and has no range."
  critical: "PRD §6.3: range is empty for whole text/image/binary; the url branch mirrors the text branch's no-range, no-dimensionHint shape. The (ctrl+o to expand) hint is added ONCE per box by renderInjectedMessage (expandHint at i===0), NOT per-line by readLine — so readLine must NOT append it."

# The previous (parallel) PRP — establishes that T2.S1 ALREADY adds the union member
- file: plan/010_8645157f3bf5/P1M1T2S1/PRP.md
  why: "T2.S1's Task 3 adds the FileDetail.kind 'url' member (injectUrl pushes kind:'url' details). Its Parallel-Safety Note states: 'S1 produces it first — the merger should treat the member as already-present when S2 runs (S2 = readLine branch only).'"
  pattern: "Treat the union member as ALREADY PRESENT; make Edit A idempotent (detect-and-skip). The unique deliverable is the readLine branch + JSDoc."
  gotcha: "T2.S1 also leaves a handoff JSDoc comment on the union line saying 'the readLine renderer branch lands in T2.S2'. Edit C must reconcile that note once the branch EXISTS."

# The exact function this task edits — read its current body before editing
- file: file-injector.ts  # readLine() — ~L820–L836 (search: `function readLine(d: FileDetail`)
  why: "readLine computes pathPart = theme.fg('accent', tildify(d.path)) ONCE at the top, shared by all branches."
  pattern: "Each kind is a guard-then-return if-chain: binary → '… (binary — not injected)'; image → path + optional dimensionHint; paged → path + range; text fallback → bare path. The url branch follows the SAME shape as the text fallback but with the RAW url."
  gotcha: "GOTCHA #1 (load-bearing): do NOT reuse `pathPart` for the url branch — it carries tildify. Call theme.fg('accent', d.path) fresh. tildify is a runtime no-op for URLs today (a URL never starts with home+'/'), but the branch must bypass it to be semantically correct and self-documenting."

# The tildify helper — confirms why the raw call is needed
- file: file-injector.ts  # tildify() — search: `function tildify(abs: string)`
  why: "tildify(abs) = home && abs.startsWith(home + '/') ? '~' + abs.slice(home.length) : abs. For URLs the startsWith test is always false → no-op. The url branch sidesteps tildify by using d.path raw."

# VERIFIED NON-ISSUE — why no renderer change is needed (read to confirm, do NOT edit)
- file: file-injector.ts  # renderInjectedMessage() body-recovery 3-tier + computeDetailOffsets() guard
  why: "computeDetailOffsets SKIPS url details (guard: kind !== 'text' && kind !== 'paged' → continue), so url details get NO contentStart/contentLen. renderInjectedMessage then falls through tier 1 (offsets) and tier 2 (d.body) to tier 3 (bodies[i] regex index-match), which recovers the url markdown body from the <file name='URL'>…</file> block injectUrl emits. d.kind !== 'image' is true → body DISPLAYS."
  critical: "Item contract says 'No changes to renderInjectedMessage.' This is CORRECT and verified: url bodies display via the generic tier-3 regex fallback. The only accepted limitation (tier-3 is BUG-1 vulnerable if a body contains a literal </file>) is out of T2.S2 scope (would be P1.M2.T1.S1 — adding url to computeDetailOffsets for tier-1 offsets). Do NOT 'fix' it here."

# Test surface — the module-surface allowlist guard
- file: file-injector.test.mjs  # ASSERTED_EXPORTS allowlist (~L136–156)
  why: "Confirms readLine is PRIVATE → adding a branch changes NOTHING in the runtime export surface → npm test stays green."
  gotcha: "Do NOT add `export` to readLine. If you do, the allowlist guard fails npm test with 'module ships functions not in the sanity list'."
```

### Current Codebase tree (the file this task touches)

```bash
.
├── file-injector.ts          # EDIT (3 text-disjoint edits): union-member idempotent guard, readLine url branch, FileDetail JSDoc
├── file-injector.test.mjs    # NOT modified (readLine is private; no new export)
├── scripts/typecheck.mjs     # NOT modified
├── tsconfig.json             # NOT modified (editor-only; npm run typecheck ignores it)
└── plan/010_8645157f3bf5/P1M1T2S2/
    ├── PRP.md                # THIS file.
    └── research/notes.md     # line-precise research record.
```

### Desired Codebase tree with files to be added

```bash
# No NEW files. file-injector.ts gains (all in-place, ≤4 lines net):
#   L471 area  FileDetail.kind union  — "url" ENSURED present (idempotent; likely already there from T2.S1)
#   L471 area  union-line JSDoc        — handoff note reconciled (branch now exists)
#   ~L462–470  interface JSDoc         — "url" listed in the kind enumeration prose
#   ~L815 area readLine()              — +3 lines: `if (d.kind === "url") { return … }` before the text fallback
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL (GOTCHA #1): readLine computes `pathPart = theme.fg("accent", tildify(d.path))` ONCE at the top.
//   The url branch MUST NOT reuse `pathPart` — it carries tildify. Use `theme.fg("accent", d.path)` RAW:
//     if (d.kind === "url") { return `${title} ${theme.fg("accent", d.path)}`; }
//   (Item example uses theme.fg('accent', d.path), NOT pathPart. tildify is a no-op for URLs today but
//    semantically wrong + brittle — the branch bypasses it.)

// CRITICAL (PARALLEL COORD): The FileDetail.kind "url" union member is LIKELY ALREADY PRESENT (T2.S1,
//   running in parallel, adds it in its own Task 3 because injectUrl pushes kind:"url" details and needs
//   it for ITS typecheck). Current source line 471 reads:
//     kind: "text" | "image" | "binary" | "paged" | "url"; // +"url": added by T2.S1 (producer); …
//   Edit A is IDEMPOTENT: if the line already ends with `| "url"` → SKIP the edit. Only add it if absent.
//   Do NOT match the item description's STALE oldText `kind: 'text' | 'image' | 'binary' | 'paged';` — that
//   line no longer exists; match the CURRENT line (with T2.S1's comment) for Edit C (JSDoc reconcile).

// CRITICAL (NO RENDERER CHANGE): Do NOT edit renderInjectedMessage. URL expanded-view bodies display via
//   the generic 3-tier body recovery (tier 3 = bodies[i] regex index-match) — verified working. See Context.

// GOTCHA (NO NEW EXPORT): readLine is PRIVATE. Do NOT add `export`. The file-injector.test.mjs allowlist
//   (~L136–156) fails npm test on any unregistered export.

// GOTCHA (HINT IS PER-BOX, NOT PER-LINE): The "(ctrl+o to expand)" hint is appended by renderInjectedMessage
//   via expandHint(theme) at i===0 — NOT by readLine. readLine returns the bare line (title + path[+suffix]).
//   So the url branch appends NOTHING after the path (mirrors the text fallback's bare `return `${title} ${pathPart}``).
```

## Implementation Blueprint

### Data models and structure

No new runtime models. One type-level union member (already present from T2.S1) and one JSDoc update:

```ts
// FileDetail.kind (line ~471) — "url" MUST be present. T2.S1 likely already added it.
export interface FileDetail {
  path: string;                                                    // for url: the URL itself (NOT tildified)
  kind: "text" | "image" | "binary" | "paged" | "url";             // ← "url" (idempotent: ensure present)
  chars?: number;                                                  // url: body.length (set by injectUrl, T2.S1)
  // … (existing fields unchanged; url details carry path + kind + chars only — no range/lines/body)
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ENSURE FileDetail.kind "url" (file-injector.ts, ~line 471) — IDEMPOTENT
  - READ the current union line (search: `kind: "text"`).
  - IF the line already contains `| "url"` → SKIP this edit (T2.S1 landed it). Go to Task 3.
  - ELSE (defensive — T2.S1 somehow didn't land it):
      CHANGE: `kind: "text" | "image" | "binary" | "paged";`
           → `kind: "text" | "image" | "binary" | "paged" | "url";`
  - WHY: injectUrl (T2.S1) pushes { kind: "url", … } details; the union must accept it. readLine's url branch
         (Task 2) also narrows on d.kind === "url", which requires the member.
  - SAFETY: verified — no exhaustive switch/assertNever on .kind in the codebase (all consumers are
         if-chains with a default/fallback). Adding "url" cannot break a closed enumeration.
  - DO NOT duplicate the member if present — `| "url" | "url"` is a lint/type smell.

Task 2: ADD the readLine url branch (file-injector.ts, in readLine(), BETWEEN the paged branch and the
         final `return `${title} ${pathPart}`; // whole text (no suffix)` line) — THE UNIQUE DELIVERABLE
  - INSERT exactly:
        if (d.kind === "url") {
          // PRD §6 — raw URL (d.path holds the URL), NOT tildified; no range/dimensionHint suffix.
          return `${title} ${theme.fg("accent", d.path)}`;
        }
  - CRITICAL: use `theme.fg("accent", d.path)` (RAW) — do NOT reuse the top-of-function `pathPart`
         (which is `theme.fg("accent", tildify(d.path))`). See GOTCHA #1.
  - PLACEMENT: after `if (d.kind === "paged") { return … }` and BEFORE `return `${title} ${pathPart}`;`.
         (Order among the kind branches does not affect correctness — all are guard-then-return — but
         placing it last-but-one keeps the text fallback as the true final default, matching convention.)
  - NAMING/SHAPE: identical to the text fallback (`${title} ${<path>}`) save the raw-vs-tildified path.
  - DO NOT append an expandHint / range / dimensionHint — readLine never appends the per-box hint.
  - FOLLOW pattern: the existing image/binary/paged branches in the same function.

Task 3: UPDATE JSDoc (file-injector.ts, FileDetail interface + union-line comment)
  - 3a. Interface JSDoc prose (~lines 462–470): add "url" to the kind enumeration. The current prose lists
         text/paged/image/binary; append a clause naming url, e.g.:
           "`kind:"url"` entries (path = the URL itself, no tildify) are pushed by injectUrl (P1.M1.T2.S1)
            and rendered by readLine's url branch (P1.M1.T2.S2 — raw URL, no range/hint)."
  - 3b. Union-line inline comment (line 471): RECONCILE the T2.S1 handoff note. The current comment says
         "the readLine renderer branch lands in T2.S2. url details render via readLine's default branch
         until then". Now that the branch EXISTS, update to reflect that — e.g.
         "// +"url": producer injectUrl (T2.S1); renderer = readLine url branch (T2.S2, raw URL no tildify)."
  - WHY: [Mode A] docs ride with the work; keeps the handoff note honest post-implementation.
  - MATCH the existing JSDoc style (PRD-section anchors, concise, single-line where possible).

Task 4: VALIDATE (no code)
  - RUN: `npm run typecheck` → EXPECT exit 0 (union member present + url branch typechecks + no `any`/unsafe).
  - RUN: `npm test`        → EXPECT exit 0 (readLine private → export surface unchanged → allowlist green).
```

### Implementation Patterns & Key Details

```ts
// ───────── readLine — the url branch mirrors the text fallback but BYPASSES tildify ─────────
function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const pathPart = theme.fg("accent", tildify(d.path));   // shared by text/image/binary/paged
  if (d.kind === "binary") {
    return `${title} ${pathPart} ${theme.fg("dim", "(binary — not injected)")}`;
  }
  if (d.kind === "image") {
    return `${title} ${pathPart}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  }
  if (d.kind === "paged") {
    return `${title} ${pathPart}${theme.fg("warning", d.range ?? "")}`;
  }
  // ── NEW (Task 2): url branch — raw d.path (the URL), NOT the tildified pathPart ──
  if (d.kind === "url") {
    return `${title} ${theme.fg("accent", d.path)}`; // PRD §6 — raw URL, no range/hint (url branch)
  }
  return `${title} ${pathPart}`; // whole text (no suffix)
}
// NOTE: `title` and `pathPart` are already in scope — the url branch reuses `title` and uses d.path raw.
//       No new local needed. theme.fg("accent", …) is already used 4× in this function → no new API.
```

### Integration Points

```yaml
DATABASE: none.
CONFIG: none.
ROUTES: none.
REGISTRY: none.
DOWNSTREAM CONSUMERS:
  - renderInjectedMessage (same file): calls readLine(d, theme) per detail. With the url branch, a
    kind:"url" detail now renders `read <raw-url>` instead of falling through to the (tildified) text
    fallback. No call-site change needed — readLine is already called for every detail.
  - P1.M1.T2.S3 (URL loop wiring): pushes kind:"url" details via injectUrl; once wired, end-to-end the
    green box shows `read <url>` lines. T2.S2's branch is what makes those lines render correctly.
  - P1.M2.T1.S1 (hermetic tests): may add a renderer test asserting `readLine`-via-renderer output for a
    url detail (e.g. `read https://example.com/x`). T2.S2 ships the code; the test belongs to M2.
PARALLEL COORDINATION:
  - vs P1.M1.T2.S1 (injectUrl — Implementing in parallel): T2.S1 adds the FileDetail.kind "url" member.
    T2.S2's Edit A is idempotent (detect-and-skip). The readLine edit (~L815) is TEXT-DISJOINT from
    T2.S1's edits (imports L8, constants ~L66, the L735→736 function gap) → clean merge either order.
    T2.S2's JSDoc reconcile (Edit C) only applies AFTER T2.S1's comment lands — match the CURRENT line.
```

## Validation Loop

### Level 1: Syntax & Style (the HARD GATE — run first and last)

```bash
# Proves the union member resolves + the url branch typechecks under --strict (theme is `any`, so the
# theme.fg call is unchecked, but the `d.kind === "url"` narrowing + `${title} …` template type fine).
npm run typecheck
# Expected: exit 0, "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
# If TS2367/TS2339 on d.kind/d.path → the FileDetail union lost "url" (Task 1 didn't land) — re-check.
```

### Level 2: Unit Tests (regression — readLine is private, so this proves no module-surface break)

```bash
# The module-surface allowlist guard (file-injector.test.mjs ~L136–156) FAILS on any new unregistered
# export. readLine stays PRIVATE → surface unchanged → existing ~25 #@file assertions + handler guards
# stay green. (Loads via jiti from the global pi package; if it fails ONLY on a missing global pi,
# `npm run typecheck` remains the authoritative gate.)
npm test
# Expected: exit 0.
# NOTE: behavioral url-renderer assertions are P1.M2.T1's job. T2.S2 ships code + typecheck + regression.
```

### Level 3: Integration Testing (OPTIONAL dev-time smoke — NOT committed)

```bash
# readLine is private, so a direct functional smoke needs a TEMPORARY export. OPTIONAL confidence-build;
# the default path is typecheck (L1) + existing-tests-green (L2). If you want immediate visual feedback:
#
# 1. TEMPORARILY `export` readLine in file-injector.ts.
# 2. Smoke via the project jiti loader:
node --input-type=module -e '
  const mod = await import("./file-injector.ts");          // via jiti in real use
  const theme = { fg: (_t, s) => s, bold: (s) => s, bg: (_t, s) => s };  // passthrough theme
  const out = mod.readLine({ path: "https://example.com/api", kind: "url" }, theme);
  console.log(JSON.stringify(out));
  console.assert(out === "read https://example.com/api", "url branch must render raw URL, no tildify, no suffix");
'
# Expected: prints "read https://example.com/api" and the assert passes.
# 3. REMOVE the temporary `export` before committing (readLine ships PRIVATE).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (Behavioral matrix — url detail rendering across the renderer, expanded-view markdown display — is
#  formalized as hermetic tests in P1.M2.T1.S1/S2. T2.S2 delivers typechecked, spec-faithful readLine code;
#  P1.M2.T1 proves the end-to-end green-box rendering. No live network in CI.)
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` exits 0 (union member present + url branch typechecks under `--strict`).
- [ ] `npm test` exits 0 (readLine private → export surface unchanged → allowlist green).

### Feature Validation
- [ ] `readLine({ path: "https://example.com/api", kind: "url" }, theme)` renders `read https://example.com/api` (raw URL — no `~`, no suffix).
- [ ] The url branch uses `theme.fg("accent", d.path)` (raw), NOT the tildified `pathPart` (GOTCHA #1).
- [ ] The url branch is placed between the `paged` branch and the text fallback.
- [ ] `FileDetail.kind` includes `"url"` (idempotent — not duplicated if T2.S1 already added it).
- [ ] No change to `renderInjectedMessage` (expanded-view url-body display handled by existing tier-3 regex recovery — verified).

### Code Quality Validation
- [ ] `readLine` remains PRIVATE (no `export`) — `file-injector.test.mjs` allowlist untouched.
- [ ] Follows the existing if-chain-with-return pattern of the sibling branches in `readLine`.
- [ ] JSDoc lists `url`; the T2.S1 handoff note is reconciled (branch now exists, not "lands later").

### Documentation & Deployment
- [ ] [Mode A] `FileDetail` interface JSDoc lists `url`; union-line comment reconciled.
- [ ] No new environment variables or config.

---

## Anti-Patterns to Avoid

- ❌ Don't reuse the top-of-function `pathPart` for the url branch — it carries `tildify(d.path)`. Use `theme.fg("accent", d.path)` raw.
- ❌ Don't append an expandHint / range / dimensionHint in the url branch — `readLine` never appends the per-box hint (that's `renderInjectedMessage`'s job at `i===0`); range/dimensionHint are paged/image-specific.
- ❌ Don't duplicate the `| "url"` union member if it's already present (T2.S1 lands it first). Edit A is idempotent: detect-and-skip.
- ❌ Don't edit `renderInjectedMessage` or `computeDetailOffsets` — url expanded-view display is handled generically (tier-3 regex `bodies[i]`). Touching them is scope creep / P1.M2.T1.S1 territory.
- ❌ Don't `export` `readLine` — the module-surface allowlist guard (`file-injector.test.mjs` ~L136–156) breaks `npm test` on any unregistered export.
- ❌ Don't match the item description's STALE `oldText` for the union line (`kind: 'text' | 'image' | 'binary' | 'paged';`) — that line no longer exists; T2.S1 already changed it. Read the CURRENT line first.

---

## Confidence Score

**9 / 10** for one-pass success. The task is three tiny, text-disjoint edits in a single private function
+ a type union + JSDoc. The exact current source text, the exact placement, and the one load-bearing
gotcha (bypass the tildified `pathPart`) are all specified. The parallel-coordination risk (the union
member may already be present from T2.S1) is explicitly handled with an idempotency instruction so the
edit succeeds regardless of merge order. The expanded-view display concern is verified as a non-issue
(url bodies recover via the existing tier-3 regex). Residual risk: a JSDoc `oldText` mismatch if T2.S1's
exact comment wording differs from what's quoted here — mitigated by instructing the implementer to
read the current line first and reconcile rather than blind-match. Behavioral renderer tests are
deferred to P1.M2.T1 (correct scope split).