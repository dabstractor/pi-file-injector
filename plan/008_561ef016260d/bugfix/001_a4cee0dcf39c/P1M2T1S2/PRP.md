---
name: "P1.M2.T1.S2 (bugfix 001_a4cee0dcf39c) — renderInjectedMessage consumes content offsets: 3-tier body resolution (offset slice → stored body → regex fallback); keep body/regex fallback; Mode-A comment; REND-11 robust + new REND-OFFSET tier-1 case (Issue 2 renderer side, PRD §6.3/§12.22/§12.23)"
prd_ref: "bugfix PRD §h3.1 Issue 2 (FileDetail.body duplication → offset fix); PRD §6.3 (renderer expanded view — full/highlighted body, defensive); §12.22 ('do not duplicate file bytes into details'); §12.23 (defensive rendering — never throw); architecture/issue2_3_filedetail_renderer.md ('Renderer change shape' = the 3-tier body resolution + retained fallback)"
target_files: "./file-injector.ts (EDIT renderInjectedMessage expanded branch L672-673 + Mode-A comment L644-648/L672) + ./file-injector.test.mjs (EDIT REND-11(b) robust; ADD REND-OFFSET tier-1 unit case)"
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + `node ./file-injector.test.mjs`)
depends_on: "P1.M2.T1.S1 (FileDetail +contentStart/contentLen/directive; emitText −3 body pushes; +exported computeDetailOffsets; before_agent_start offset pass) — RUNNING IN PARALLEL; treat as a CONTRACT that lands exactly as specified. This task CONSUMES the offset fields S1 adds."
consumed_by: "P1.M2.T2.S1 (paged directive rendering — independent expanded-view branch addition; this task's 3-tier body resolution coexists), P1.M3.T2.S1 (README — no body-duplication language to sync for the renderer; internal). NOTE: this task runs in PARALLEL with P1.M2.T1.S1; it edits renderInjectedMessage + the REND cluster, which S1 does NOT touch (S1 edits FileDetail/emitText/before_agent_start + adds ISS2-* near the delivery cluster). No shared edit sites."
---

# PRP — P1.M2.T1.S2: renderInjectedMessage consumes content offsets (3-tier body resolution; keep body/regex fallback)

> **Scope flag:** Bugfix for Issue 2's RENDERER side (Minor, PRD §6.3/§12.22/§12.23). P1.M2.T1.S1 (parallel)
> stops storing the duplicated `body` in real `FileDetail`s and instead records `contentStart`/`contentLen`
> offsets into `message.content`. Once `body` is gone from real emission, the renderer's current 2-tier path
> (`d.body ?? bodies[i]`) lets real files fall through to the `bodies[i]` REGEX fallback — which **re-opens
> BUG-1**: a file whose own content contains a literal `</file>` truncates the lazy capture and the expanded
> view MISSES the text after the inner tag. This task closes the regression by adding a **tier-1 offset slice**
> (`message.content.slice(contentStart, contentStart+contentLen)`) that is BUG-1-safe (length-derived, not
> regex), while RETAINING tier-2 (`d.body`) and tier-3 (`bodies[i]` regex) for old/foreign/test entries
> (§6.3/§12.23 defensive rendering). **One renderer edit + one Mode-A comment + one robustness test fix +
> one new tier-1 unit case.** No emitText/before_agent_start/FileDetail edits (S1's scope); no directive
> rendering (P1.M2.T2.S1); no README.

---

## Goal

**Feature Goal:** Make `renderInjectedMessage`'s expanded branch recover each file's body via a **3-tier
preference** — (1) offset slice from `message.content` when the detail carries `contentStart`/`contentLen`
(the post-S1 shape for real injected files), (2) the stored `d.body` (old/foreign/test entries), (3) the
regex-derived `bodies[i]` (last resort). Tier-1 is BUG-1-safe (the offsets are length-derived in S1's
`computeDetailOffsets`, NOT from a regex), so a real file whose content contains a literal `</file>` renders
its FULL body — closing the regression S1's body-removal would otherwise open. The renderer's existing
defensive guarantees (never throw; `files.length===0` fallback; image short-circuit) are unchanged.

**Deliverable:** Two modified files:
- **`./file-injector.ts`** — one edit in `renderInjectedMessage`'s expanded branch (the `const body = …` line,
  L672-673 → 3-tier) + Mode-A comment update (the FALLBACK comment L644-648 + the inline L672). bodies[]
  computation, `FILE_BLOCK_RE.lastIndex = 0`, the `d.kind !== "image"` guard, and `highlightCode`/`getLanguageFromPath`
  are ALL unchanged.
- **`./file-injector.test.mjs`** — EDIT REND-11(b) to be robust to the post-S1 shape (assert on rendered output;
  simulate `before_agent_start`'s offset pass when `computeDetailOffsets` is present); ADD a new `REND-OFFSET`
  unit case that crafts a detail with `contentStart`/`contentLen` (no `body`) and asserts the tier-1 offset slice
  renders the EXACT body (incl. a nested `</file>`), pinning tier-1 in isolation.

**Success Definition:**
1. A detail carrying `contentStart`/`contentLen` (no `body`) renders its EXACT body via
   `message.content.slice(contentStart, contentStart+contentLen)` — incl. a body with a literal `</file>` (BUG-1-safe).
2. A detail carrying `body` (no offsets) STILL renders via `d.body` (REND-1..7,9,10,11(a) unchanged); a detail
   with neither renders via `bodies[i]` (regex fallback retained).
3. REND-11 (the BUG-1 regression) passes in BOTH the pre-S1 tree (body → tier-2) and the post-S1 tree (offsets
   → tier-1) — the robust update makes it forward-compatible.
4. REND-8 (defensive fallback, no details) passes unchanged.
5. New REND-OFFSET passes (tier-1 in isolation).
6. `npm run typecheck` → 0 errors (`--strict`); `node ./file-injector.test.mjs` → 0 failed (baseline 147 + REND-OFFSET);
   the two auxiliary suites stay green (unchanged — they don't render).

## User Persona

**Target User:** Pi end-users who expand (`ctrl+o`) an injected file's green `read` line to inspect its contents.
Issue 2's offset fix (S1) + this renderer change mean the expanded view shows the FULL body without duplicating
file bytes into persisted `details` (~halving session storage) AND without regressing BUG-1 (nested `</file>`).

**Use Case:** Inject `#@nest.ts` (whose content contains `<file name="d">nested</file>`); expand → see the full
content incl. text after the inner `</file>` (today's `body` fix preserved via the offset slice).

**Pain Points Addressed:** S1 removes the byte duplication (§12.22) but, without this renderer change, real
files would fall through to the BUG-1-vulnerable regex fallback → silent truncation in the expanded view.
This task keeps the BUG-1 display correctness that the `body` field previously provided.

## Why

- **Closes the BUG-1 regression S1 would open.** S1's body-removal is the §12.22 fix (correct), but the
  renderer must STOP relying on `d.body` for real files and START slicing `message.content` via offsets.
  Without tier-1, real files hit the regex fallback → BUG-1 truncation returns. Tier-1 is the offset-based
  exact-recovery path; it's BUG-1-safe because the offsets are length-derived (block length − header − footer),
  not regex-derived.
- **Retains the defensive-rendering contract (§6.3/§12.23).** Old persisted messages (pre-offset), foreign
  custom messages, and the REND-* unit tests all carry `body` (or nothing). Tier-2 (`d.body`) and tier-3
  (`bodies[i]`) handle them unchanged — the renderer never throws and always shows *something*.
- **Low-risk, surgical.** One expression change + comment + one robustness test fix + one new case. The
  bodies[] computation, image guard, and highlight pipeline are untouched. The change is backward-compatible
  (a detail with `body` still works; a detail with offsets is the new preferred path).
- **Atomic with S1's interface change.** S1 declares `contentStart?`/`contentLen?` on FileDetail; this task
  is the sole consumer in the renderer. Together they deliver the §12.22 fix end-to-end.

## What

No user-visible/API/config change. The renderer's expanded branch recovers the body via 3 tiers instead of 2.
The `bodies[]` regex computation, the collapsed branch, the `files.length===0` fallback, and `readLine` are
unchanged. Tests: REND-11(b) becomes forward-compatible; a new REND-OFFSET pins tier-1.

### Success Criteria

- [ ] The expanded branch resolves `body` via the 3-tier expression: `(d.contentStart != null && d.contentLen != null && typeof message?.content === "string") ? message.content.slice(d.contentStart, d.contentStart + d.contentLen) : (typeof d.body === "string" ? d.body : bodies[i])`.
- [ ] The `if (body !== undefined && d.kind !== "image")` guard + `highlightCode`/`getLanguageFromPath` rendering are unchanged.
- [ ] `FILE_BLOCK_RE.lastIndex = 0` (L652) and the `bodies[]` computation (L649-655) are unchanged (tier-3 retained).
- [ ] The FALLBACK comment (L644-648) + inline comment (L672) document the 3-tier resolution and WHY offsets are BUG-1-safe (Mode A, item §5).
- [ ] REND-11(b) no longer asserts `typeof d.body === "string"` (brittle post-S1); it asserts on the RENDERED output ("DONE" shown) and simulates `before_agent_start`'s offset pass via `if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details)` (forward-compatible).
- [ ] NEW REND-OFFSET case passes: a crafted detail with `contentStart`/`contentLen` (no `body`) + content with a nested `</file>` → tier-1 slice shows the EXACT body.
- [ ] REND-1..10, REND-8, and all non-REND cases pass unchanged; the two auxiliary suites stay green.
- [ ] `npm run typecheck` → 0 errors; `git diff --stat` = file-injector.ts + file-injector.test.mjs only.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact current renderer code (L642-677, quoted), the exact NEW 3-tier expression,
the BUG-1 rationale (why tier-1 must be length-derived not regex), the retained-fallback rationale (§6.3/§12.23),
the S1 contract (FileDetail +offsets; emitText −body; +computeDetailOffsets; before_agent_start offset pass), the
critical interaction (REND-11(b) reads `d.body` from `injectFiles` → breaks post-S1 → must be made robust), the
forward-compatible REND-11(b) rewrite (assert on rendered output; guard `computeDetailOffsets`), the NEW
REND-OFFSET case design (craft offsets + nested `</file>`), the typecheck-gate dependency (S1's FileDetail
fields must exist for `d.contentStart` to compile under --strict), and the no-conflict boundaries (S1 edits
FileDetail/emitText/before_agent_start + ISS2-*; this task edits renderInjectedMessage + REND cluster). The
implementer edits one expression + one comment in the renderer, fixes one test's E2E assertions, adds one case.

### Documentation & References

```yaml
# MUST READ — the renderer-change shape (the 3-tier expression) + the BUG-1 rationale + the retained fallback
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue2_3_filedetail_renderer.md
  why: "§'Renderer change shape (file-injector.ts:664-670)' gives the EXACT target expression:
        `const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === \"string\")
         ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
         : (typeof d.body === \"string\" ? d.body : bodies[i]);` — the 3-tier resolution this task implements.
        §'Issue 2 fix — option (a)' explains offsets are length-derived (BUG-1-safe). §'Blast radius' confirms
        bodies[] regex fallback is RETAINED for old/test entries (§6.3 defensive)."
  critical: "The expression in the doc is the field-name + logic CONTRACT. Copy it verbatim (it already preserves
             the d.body and bodies[i] fallbacks). The doc's ISSUE 3 directive-rendering block is P1.M2.T2.S1's
             scope — do NOT add it here."

# MUST READ — the parallel predecessor's contract (what this task consumes)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T1S1/PRP.md   # (S1 — running in parallel)
  why: "S1 adds FileDetail.contentStart?/contentLen?/directive? (body? kept deprecated); emitText −3 body pushes;
        +exported computeDetailOffsets(blocks, details) (headerLen=15+path.length, footerLen=8, paged=2 blocks,
        cursor += block.length+2); before_agent_start hoists content + calls computeDetailOffsets. S1 does NOT
        touch renderInjectedMessage (it's THIS task's edit site). S1 adds ISS2-OFFSET/ISS2-NOBODY + guard sync."
  critical: "REND-11(b) reads `d.body` from injectFiles — S1 removes body → REND-11(b) breaks post-S1. S1's PRP
             claims 'REND-* stay green (craft body)' but REND-11(b) is an E2E that reads REAL d.body, so it's an
             oversight. This task owns the REND-11(b) robustness fix (it's the BUG-1/renderer task; 'REND-11 still
             passes' is item §4). injectFiles does NOT compute offsets (before_agent_start does) → REND-11(b)'s E2E
             must simulate the offset pass via computeDetailOffsets."

# The bug contract (Expected/Actual/Root-cause) + §12.22/§6.3 citations
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/prd_snapshot.md   # (bugfix PRD §h3.1 Issue 2 + §h3.2 Issue 3)
  why: "§h3.1: body duplicates ~100% of every file's bytes (§12.22 violation); the offset fix is option (a).
        §h3.2: paged expanded-view directive gap (P1.M2.T2.S1 — NOT this task). Cites PRD §12.22 + §6.2."

# The file you edit (the renderer — 1 expression + 1 comment)
- file: file-injector.ts
  why: "renderInjectedMessage L642-677. EDIT: the `const body = …` line (L672-673) → 3-tier. The FALLBACK comment
        (L644-648) + inline comment (L672) → Mode-A 3-tier docs. UNCHANGED: FILE_BLOCK_RE (L620); bodies[]
        computation incl. FILE_BLOCK_RE.lastIndex=0 (L649-655); the `files.length===0` fallback branch (L661-667);
        the collapsed branch's readLine + expandHint (L670); the `if (body !== undefined && d.kind !== 'image')`
        guard (L674); highlightCode/getLanguageFromPath (L675-676); readLine/expandHint/tildify helpers."
  pattern: "Module-level exported function, pure (message:any, opts, theme:any) → Component. message/details are
            `any` (defensive — old/foreign/test messages may have any shape). `files` is typed FileDetail[] (so
            d.contentStart compiles ONLY once S1's FileDetail change lands — see Gotchas)."
  gotcha: "Reading d.contentStart requires FileDetail to DECLARE contentStart (S1's edit). Under --strict this is
           TS2339 if S1 hasn't landed. This is a STATED DEPENDENCY (item/parallel context treat S1 as a contract).
           Do NOT use `(d as any)` to shim it — the item description + architecture doc both read d.contentStart
           directly (typed access is the convention). If typecheck errors TS2339, S1 hasn't merged: land S1 first."

# The test file you edit (REND-11(b) robust + new REND-OFFSET)
- file: file-injector.test.mjs
  why: "REND cluster L2555-2718. REND_THEME L2564 (stubTheme {fg,bg,bold}→identity). textOf L2566. captureAllHandlers
        L184. makeMockCtx L161. buildFixtures L231 (writes nest.ts at L236 = 'Example:\\n<file name=\"d\">nested</file>\\nDONE\\n').
        FIX={cwd:TMPDIR} L360. REND-11 L2696-2718 (a=unit body; b=E2E injectFiles→render). Sanity list L133 +
        ASSERTED_EXPORTS L144 (renderInjectedMessage ALREADY listed — no guard change for this task)."
  pattern: "renderInjectedMessage is a PURE function — call mod.renderInjectedMessage({details:{files:[…]},
            content:'…'}, {expanded:true}, REND_THEME); inspect box.children[i] via textOf(child).render(W).join.
            REND-11(b) calls mod.injectFiles('Review #@nest.ts', [], FIX) (nest.ts exists in fixtures)."
  gotcha: "REND-11(b)'s current `assert(typeof d.body === 'string'…)` is BRITTLE — it passes today (body set
           pre-S1) but FAILS post-S1 (body removed). Rewrite it to assert on the RENDERED output + simulate the
           offset pass. Place REND-OFFSET right AFTER REND-11 (BUG-1/offsets cluster), before the Summary."

# The sibling (no conflict) + the downstream consumer
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T1S1/PRP.md   # (S1 — see above)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T2S1/PRP.md   # (paged directive — downstream)
  why: "S1 edits FileDetail/emitText/before_agent_start + adds ISS2-* (NOT renderInjectedMessage, NOT the REND
        cluster). P1.M2.T2.S1 adds the `d.directive` render line (a SEPARATE addition to the expanded branch —
        coexists with this task's body-resolution change). No shared edit sites with this task."
  critical: "Do NOT add the `if (d.kind === 'paged' && typeof d.directive === 'string')` render line — that's
             P1.M2.T2.S1. This task changes ONLY the `const body = …` line + comment."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD (baseline: 147 passed, 0 failed; PRE-S1 working tree — body still set)
├── file-injector.ts             # ← EDIT renderInjectedMessage (L672-673 expression + L644-648/L672 comment)
├── file-injector.test.mjs       # ← EDIT REND-11(b); ADD REND-OFFSET (after REND-11)
├── relative-imports.test.mjs    # run to confirm green (NOT edited — doesn't render)
├── import-behavior.test.mjs     # run to confirm green (NOT edited)
├── scripts/typecheck.mjs        # untouched (--strict gate)
├── package.json / PRD.md / README.md   # untouched (README is P1.M3.T2.S1)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/{issue1_resolveimportpath.md, issue2_3_filedetail_renderer.md, issue4_image_and_tests.md, system_context.md}
    ├── P1M1T1S1..P1M2T1S1/{research, PRP.md}   # S1 (Issue 2 source) runs in parallel; P1.M1.* (Issue 1) LANDED
    └── P1M2T1S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED (2 regions in renderInjectedMessage):
                          #   (1) expanded branch L672-673: `const body = …` → 3-tier (offset slice → d.body → bodies[i])
                          #   (2) comment L644-648 (FALLBACK) + L672 (inline) → Mode-A 3-tier docs + BUG-1-safety note
                          #   UNCHANGED: bodies[] computation, FILE_BLOCK_RE.lastIndex=0, image guard, highlightCode,
                          #   collapsed branch, files.length===0 fallback, readLine/expandHint/tildify.
file-injector.test.mjs    # MODIFIED:
                          #   (1) REND-11(b) (L2707-2718): drop brittle `assert(typeof d.body===...)`; assert on rendered
                          #       output; simulate offset pass via `if (typeof mod.computeDetailOffsets === "function") …`
                          #   (2) ADD REND-OFFSET case (after REND-11, before Summary): crafted detail with
                          #       contentStart/contentLen (no body) + nested </file> → tier-1 slice shows exact body.
# No other files. No FileDetail/emitText/before_agent_start edits (S1). No directive rendering (P1.M2.T2.S1). No README.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — tier-1 must be the offset SLICE, not a regex. The entire point of this subtask is BUG-1: once S1
//   removes body, real files would fall to the bodies[i] regex, whose lazy `([\s\S]*?)` truncates at an INNER
//   </file>. message.content.slice(contentStart, contentStart+contentLen) is EXACT (S1 derives the offsets from
//   block-string LENGTH, not regex) → BUG-1-safe. Do NOT introduce any regex in the offset path.

// CRITICAL — RETAIN tiers 2 and 3 (d.body + bodies[i]). Old persisted messages (pre-offset), foreign custom
//   messages, and the REND-* unit tests carry body (or nothing). Removing the fallbacks regresses §6.3/§12.23
//   defensive rendering (the renderer must always show SOMETHING and never throw). The 3-tier expression preserves both.

// CRITICAL — typecheck (--strict) requires S1's FileDetail change. `files` is typed FileDetail[] → `d.contentStart`
//   is TS2339 ("Property 'contentStart' does not exist") if S1 hasn't landed. This is a STATED DEPENDENCY (the
//   item description + architecture doc + parallel_execution_context all treat S1 as a contract that lands). Use
//   the typed `d.contentStart` access (matches the doc + the existing typed convention — do NOT shim with `as any`).
//   If `npm run typecheck` errors TS2339 on contentStart, S1's FileDetail edit isn't in your tree: land S1 first.

// CRITICAL — REND-11(b) is BRITTLE post-S1. It reads `d.body` from injectFiles; S1 removes body → the assert
//   `typeof d.body === "string"` fails, AND the render falls to bodies[i] (regex) → BUG-1 truncation → "DONE"
//   absent. injectFiles does NOT compute offsets (before_agent_start does via computeDetailOffsets). FIX: rewrite
//   REND-11(b) to (a) drop the body assert, (b) simulate the offset pass via
//   `if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details)`, (c) assert
//   on the RENDERED output ("DONE" shown). The `if (typeof … === "function")` guard makes it pass pre-S1 (body→tier-2)
//   AND post-S1 (offsets→tier-1).

// GOTCHA — the guard `if (typeof mod.computeDetailOffsets === "function")` is REQUIRED for forward-compat. Pre-S1,
//   computeDetailOffsets doesn't exist (the export is absent) → the guard skips → r.details still has body (pre-S1) →
//   the renderer's tier-2 fires. Post-S1, the export exists → offsets computed → tier-1 fires. Without the guard,
//   REND-11(b) throws `mod.computeDetailOffsets is not a function` pre-S1.

// GOTCHA — REND-OFFSET must craft a body with a nested </file> to PROVE tier-1 is BUG-1-safe (not just "offsets
//   work"). Use fullBody = "a</file>b"; contentStart = headerLen; contentLen = fullBody.length. Assert the rendered
//   body includes "a</file>b" (the regex would truncate to "a"). This is the tier-1-in-isolation proof.

// GOTCHA — do NOT add the paged-directive render line. `if (d.kind === "paged" && typeof d.directive === "string")`
//   is P1.M2.T2.S1's edit. This task changes ONLY the `const body = …` line + the comment.

// GOTCHA — do NOT touch the bodies[] computation or FILE_BLOCK_RE.lastIndex = 0. They are tier-3 (the last-resort
//   fallback) and must stay. The 3-tier expression READS bodies[i] only when tiers 1+2 miss.

// LIBRARY — TypeScript via jiti (transpile-on-load, no build step). typecheck = tsc --strict. renderInjectedMessage
//   is a pure function; the REND-* tests call it directly with crafted messages + a stubTheme. Gate: npm run typecheck
//   + node ./file-injector.test.mjs (+ the 2 auxiliaries, unchanged). Baseline: 147 passed.
```

## Implementation Blueprint

### Edit 1 — renderInjectedMessage expanded branch (file-injector.ts L672-673) — the 3-tier body resolution

```ts
// BEFORE (L671-673):
    if (opts.expanded) {
      // Prefer the EXACT stored body (BUG-1 fix); fall back to the regex-derived body for entries without one.
      const body = typeof d.body === "string" ? d.body : bodies[i];

// AFTER (L672-674) — 3-tier: offset slice (real emission, post-P1.M2.T1.S1) → stored body (old/test) → regex:
    if (opts.expanded) {
      // 3-tier body resolution (§12.22 offset → stored body → regex fallback). Real emission (P1.M2.T1.S1)
      // carries contentStart/contentLen (no duplicated bytes); tier-1 slices message.content EXACTLY — BUG-1-safe
      // because the offsets are length-derived (block.length − header − footer), NOT regex: a body containing a
      // literal </file> (which truncates FILE_BLOCK_RE's lazy capture) slices whole. Tier-2 (d.body) covers
      // old/foreign/test entries still carrying the deprecated body field. Tier-3 (bodies[i]) is the last-resort
      // regex fallback for entries with neither (§6.3/§12.23 defensive rendering).
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body : bodies[i]);
```
The `if (body !== undefined && d.kind !== "image") { … highlightCode … }` block (L674-677) is UNCHANGED.

### Edit 2 — Mode-A comment update (file-injector.ts L644-648) — document the 3 tiers

```ts
// BEFORE (L644-648):
  // FALLBACK body derivation: re-parse message.content with the block regex ONLY when a detail lacks a
  // stored `body` (old/foreign/test entries). BUG-1: a file whose own content contains a literal `</file>`
  // truncates the lazy `([\s\S]*?)` at the INNER `</file>`, so we must NOT rely on re-parsing for real
  // injected files. emitText now stores the EXACT body in `detail.body`; the renderer prefers it and only
  // falls back to the regex for entries without one (e.g. the REND-* unit tests, which pass crafted details).

// AFTER — document the 3-tier resolution + why offsets are BUG-1-safe:
  // BODY derivation (3 tiers, expanded view): (1) offset slice — real injected files (post-P1.M2.T1.S1) carry
  // contentStart/contentLen (char offsets into message.content), so message.content.slice(start, start+len)
  // recovers the EXACT body WITHOUT duplicating file bytes into details (§12.22); (2) stored `body` — old/
  // foreign/test entries (and pre-offset persisted messages) carry the deprecated body field; (3) the regex
  // below — last-resort fallback for entries with neither (§6.3/§12.23 defensive rendering). The regex re-parse
  // is computed UNCONDITIONALLY (cheap; needed for tier 3) but is only USED when tiers 1+2 miss. BUG-1: a file
  // whose own content contains a literal `</file>` truncates the lazy `([\s\S]*?)` at the INNER `</file>`, so
  // tiers 1+2 (length-derived offset / stored body) are the BUG-1-safe paths; tier 3 is regex-vulnerable but
  // only fires for entries without offsets/body (test-crafted / old), where BUG-1 is not a real-world risk.
```

### Edit 3 — REND-11(b) robustness (file-injector.test.mjs L2707-2718)

```js
// BEFORE (L2707-2718) — brittle: reads d.body (removed post-S1) + renders without offsets:
  // (b) E2E (injectFiles → render): a REAL file with a nested </file> produces a detail whose stored body
  //     is exact, and the renderer shows the full content (DONE present), and the model-facing content is
  //     also intact (the delivery contract is unaffected — this bug is display-only per the report).
  const r = await mod.injectFiles("Review #@nest.ts", [], FIX);
  assert(r.injected === 1, `nest.ts was injected, got injected=${r.injected}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `one detail for nest.ts, got ${JSON.stringify(r.details?.length)}`);
  const d = r.details[0];
  assert(typeof d.body === "string" && d.body.includes("DONE"),
    `detail.body carries the full content (incl. 'DONE' after the inner </file>), got ${JSON.stringify(d.body)}`);
  assert(r.blocks[0].includes("DONE"), `the model-facing block carries the full content ('DONE' present), got ${JSON.stringify(r.blocks[0])}`);
  const published = { details: { files: r.details }, content: r.blocks.join("\n\n") };
  const exp = mod.renderInjectedMessage(published, { expanded: true }, REND_THEME);
  const shown = textOf(exp.children[exp.children.length - 1]);
  assert(shown.includes("DONE"), `expanded view of a real nested-</file> file shows the full body ('DONE'), got ${JSON.stringify(shown.slice(0, 80))}`);

// AFTER — forward-compatible: simulate before_agent_start's offset pass; assert on the RENDERED output:
  // (b) E2E (injectFiles → render): a REAL file with a nested </file> renders its FULL body (DONE present) via
  //     the renderer's 3-tier resolution. After P1.M2.T1.S1, injectFiles carries contentStart/contentLen (no body);
  //     offsets are computed in before_agent_start via computeDetailOffsets — simulate that here (injectFiles itself
  //     does not compute them). The `typeof … === "function"` guard makes this pass pre-S1 (body → tier-2) AND
  //     post-S1 (offsets → tier-1). Model-facing content is intact regardless (delivery is unaffected — display-only).
  const r = await mod.injectFiles("Review #@nest.ts", [], FIX);
  assert(r.injected === 1, `nest.ts was injected, got injected=${r.injected}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `one detail for nest.ts, got ${JSON.stringify(r.details?.length)}`);
  // simulate before_agent_start's offset pass (P1.M2.T1.S1) so the renderer's offset tier is exercised post-S1:
  if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details);
  // model-facing content is the full block (delivery unaffected — this bug is display-only per the report):
  assert(r.blocks[0].includes("DONE"), `the model-facing block carries the full content ('DONE' present), got ${JSON.stringify(r.blocks[0].slice(0, 80))}`);
  const published = { details: { files: r.details }, content: r.blocks.join("\n\n") };
  const exp = mod.renderInjectedMessage(published, { expanded: true }, REND_THEME);
  const shown = textOf(exp.children[exp.children.length - 1]);
  assert(shown.includes("DONE"), `expanded view of a real nested-</file> file shows the full body ('DONE') via the renderer's offset/body tier, got ${JSON.stringify(shown.slice(0, 80))}`);
```

### Edit 4 — NEW REND-OFFSET unit case (file-injector.test.mjs, after REND-11, before the Summary)

```js
// REND-OFFSET — §12.22 offset tier (P1.M2.T1.S2). A detail carrying contentStart/contentLen (NOT body) — the
// post-S1 shape for real injected files — must render the EXACT body via message.content.slice in the expanded
// view. Pins tier-1 of the renderer's 3-tier body resolution (offset → body → regex) in isolation, incl. a
// nested-</file> body (BUG-1-safe: the slice is length-derived, not regex — the lazy regex would truncate at
// the inner tag). Independent of S1 state (offsets crafted directly in the test).
await runCase("REND-OFFSET", "offset tier: detail with contentStart/contentLen (no body) renders the exact slice incl. nested </file> (§12.22)", async () => {
  const fullBody = "a</file>b";                                                    // BUG-1 body — a literal </file>
  const block = '<file name="/abs/o.ts">\n' + fullBody + '\n</file>';
  const content = block;                                                           // single block → content === block
  const headerLen = '<file name="/abs/o.ts">\n'.length;                            // 15 + 9 = 24
  const contentStart = headerLen;
  const contentLen = fullBody.length;                                              // 8
  const msg = { details: { files: [{ path: "/abs/o.ts", kind: "text", contentStart, contentLen }] }, content };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const bodyChild = textOf(expanded.children[expanded.children.length - 1]);
  assert(bodyChild.includes("a</file>b"),
    `offset slice (tier-1) shows the EXACT body incl. the inner </file> (BUG-1-safe), got ${JSON.stringify(bodyChild.slice(0, 80))}`);
  // sanity: tier-1 fired (not the regex). The regex alone would yield "a" (truncated at the inner </file>).
  assert(!bodyChild.endsWith("a") || bodyChild.length > 1,
    `tier-1 slice is the FULL body (not the regex-truncated 'a'), got ${JSON.stringify(bodyChild.slice(0, 80))}`);
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT renderInjectedMessage expanded branch (file-injector.ts L672-673) — the 3-tier body resolution
  - REPLACE the single `const body = typeof d.body === "string" ? d.body : bodies[i];` line with the 3-tier
    expression (exact code in Edit 1). The `(d.contentStart != null && d.contentLen != null && typeof message?.content === "string")`
    guard FIRST; then the slice; then `(typeof d.body === "string" ? d.body : bodies[i])`.
  - KEEP `if (body !== undefined && d.kind !== "image") { const lang = …; const rendered = lang ? highlightCode(body, lang).join("\n") : body; box.addChild(...) }` UNCHANGED.
  - DO NOT touch bodies[] computation, FILE_BLOCK_RE.lastIndex, the image guard, highlightCode, the collapsed branch,
    or the files.length===0 fallback.

Task 2: EDIT the Mode-A comments (file-injector.ts)
  - UPDATE the FALLBACK comment (L644-648) → the 3-tier documentation (Edit 2's AFTER text). Cite §12.22 (offset =
    no duplicated bytes), §6.3/§12.23 (tier-2/3 defensive fallback), and the BUG-1-safety note (length-derived, not regex).
  - UPDATE the inline comment (was L672 "Prefer the EXACT stored body…") — it's replaced by Edit 1's 3-tier inline comment.

Task 3: EDIT REND-11(b) (file-injector.test.mjs L2707-2718) — forward-compatible robustness
  - DROP the `assert(typeof d.body === "string" && d.body.includes("DONE"), …)` line (brittle post-S1).
  - ADD `if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details);` after the
    `const d = r.details[0];`-equivalent point (after asserting r.details shape) to simulate before_agent_start's offset pass.
  - KEEP `assert(r.injected === 1)`, the details-length assert, `assert(r.blocks[0].includes("DONE"))`, and the final
    `assert(shown.includes("DONE"))` (now reading the rendered output via the 3-tier resolution).
  - VERIFY pre-S1: `node ./file-injector.test.mjs` → REND-11 ✓ (computeDetailOffsets absent → body still set → tier-2 → DONE).

Task 4: ADD REND-OFFSET (file-injector.test.mjs, after REND-11's closing `});`, before the Summary comment)
  - ADD the case (exact code in Edit 4). fullBody="a</file>b"; contentStart=headerLen; contentLen=fullBody.length.
  - ASSERT the rendered body includes "a</file>b" (tier-1 exact slice; the regex would truncate to "a").
  - NAMING: runCase("REND-OFFSET", "offset tier: detail with contentStart/contentLen (no body) renders the exact slice incl. nested </file> (§12.22)", …).

Task 5: VERIFY gates
  - npm run typecheck → 0 errors (--strict). (REQUIRES S1's FileDetail change to be present — see Gotchas. If TS2339
    on contentStart, land S1 first; do NOT shim with `as any`.)
  - node ./file-injector.test.mjs → 0 failed (baseline 147 + REND-OFFSET = 148; REND-11 robust; REND-1..10/REND-8 unchanged).
  - node ./relative-imports.test.mjs + node ./import-behavior.test.mjs → 0 failed (unchanged — they don't render).
  - git diff --stat: file-injector.ts + file-injector.test.mjs only.
```

### Implementation Patterns & Key Details

```ts
// ── The 3-tier body resolution (the core edit) ──
// message is `any` (defensive); files is FileDetail[] (so d.contentStart compiles once S1 lands).
const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
  ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)   // TIER 1 — offset slice (BUG-1-safe)
  : (typeof d.body === "string" ? d.body : bodies[i]);                     // TIER 2 (body) → TIER 3 (regex)
// then UNCHANGED:
if (body !== undefined && d.kind !== "image") {                            // image guard (§6.4) preserved
  const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
  const rendered = lang ? highlightCode(body, lang).join("\n") : body;
  box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
}

// ── REND-OFFSET tier-1 proof (the new unit case) ──
const fullBody = "a</file>b";                                  // BUG-1: a literal </file> in the content
const block = '<file name="/abs/o.ts">\n' + fullBody + '\n</file>';
const contentStart = '<file name="/abs/o.ts">\n'.length;       // headerLen (24)
const contentLen = fullBody.length;                            // 8
const msg = { details: { files: [{ path: "/abs/o.ts", kind: "text", contentStart, contentLen }] }, content: block };
// renderInjectedMessage(msg, {expanded:true}, REND_THEME) → body = content.slice(24, 32) = "a</file>b" (tier-1, EXACT)
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 2 regions, both in renderInjectedMessage):
  - expanded branch (L672-673): `const body = …` → 3-tier expression.
  - comments (L644-648 FALLBACK + L672 inline): Mode-A 3-tier docs + BUG-1-safety note.
  - UNCHANGED: FILE_BLOCK_RE (L620); bodies[] computation + FILE_BLOCK_RE.lastIndex=0 (L649-655); files.length===0
    fallback (L661-667); collapsed branch readLine/expandHint (L670); image guard (L674); highlightCode/
    getLanguageFromPath (L675-676); readLine/expandHint/tildify helpers; the factory (session_start/input/
    before_agent_start); FileDetail/emitText/computeDetailOffsets (S1's scope).
FILE_EDITS (file-injector.test.mjs):
  - REND-11(b) (L2707-2718): drop brittle body assert; add computeDetailOffsets simulation; assert on rendered output.
  - +runCase("REND-OFFSET", …) after REND-11.
  - UNCHANGED: REND-1..10, REND-8, REND-11(a); captureAllHandlers; makeMockCtx; buildFixtures; sanity list +
    ASSERTED_EXPORTS (renderInjectedMessage already listed); all non-REND cases.
NO_CHANGES: FileDetail/emitText/before_agent_start/computeDetailOffsets (S1's scope), the paged-directive render
            line (P1.M2.T2.S1), relative-imports.test.mjs, import-behavior.test.mjs, package.json,
            scripts/typecheck.mjs, PRD.md, README.md (P1.M3.T2.S1), all plan/ files.
NO_LOGIC_CHANGE: detection/resolution/paging/dedup/config/import logic is UNCHANGED. Only the renderer's body-
                 recovery expression changes (and it's backward-compatible: body/regex fallbacks retained).
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# CRITICAL: this REQUIRES P1.M2.T1.S1's FileDetail change (contentStart?/contentLen?) to be present, because `files`
#   is typed FileDetail[] and `d.contentStart` is TS2339 without the field. If you see:
#     "error TS2339: Property 'contentStart' does not exist on type 'FileDetail'"
#   → S1 hasn't landed in your tree. Land S1 first (it's a stated dependency). Do NOT shim with `as any` — the item
#   description + architecture doc both read d.contentStart directly (typed access is the convention).
```

### Level 2: The primary suite + the new case

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: REND-OFFSET ✓ + REND-11 ✓ (robust), then "Result: 148 passed, 0 failed." (baseline 147 + REND-OFFSET). Exit 0.
# PRE-S1 tree: REND-11(b) ✓ via the `typeof computeDetailOffsets === "function"` guard (skipped) → body still set → tier-2 → DONE.
# POST-S1 tree: REND-11(b) ✓ via computeDetailOffsets simulation → offsets → tier-1 → DONE.
# If REND-1..7/9/10 flip → you changed the body fallback or the image guard (revert — they must stay tier-2/unchanged).
# If REND-8 flips → you touched the files.length===0 fallback (revert).
# If REND-OFFSET fails ("a</file>b" absent) → tier-1 didn't fire; check the offset guard + slice math (contentStart/headerLen).
```

### Level 3: The two auxiliary suites (unchanged — must stay green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 0 failed (doesn't render; unchanged)
node ./import-behavior.test.mjs     # → 0 failed (doesn't render; unchanged)
```

### Level 4: Renderer tier-1 spot-check (ad hoc confidence — REND-OFFSET is authoritative)

```bash
cd /home/dustin/projects/pi-file-injector
# Directly exercise the renderer with a crafted offset-bearing detail (confidence only; REND-OFFSET is the gate):
node -e '
  const PIPKG = require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
  const { createJiti } = require(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(__filename, { alias: { "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js", "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js", "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js" } });
  jiti.import("./file-injector.ts").then(mod => {
    const fullBody = "a</file>b";
    const block = "<file name=\"/abs/o.ts\">\n" + fullBody + "\n</file>";
    const contentStart = "<file name=\"/abs/o.ts\">\n".length, contentLen = fullBody.length;
    const box = mod.renderInjectedMessage({ details: { files: [{ path: "/abs/o.ts", kind: "text", contentStart, contentLen }] }, content: block }, { expanded: true }, { fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t });
    const body = box.children[box.children.length - 1].render(2000).join("\n");
    console.log("tier-1 body:", JSON.stringify(body), "=> includes a</file>b?", body.includes("a</file>b"));
  });
'
# Expected: tier-1 body: "a</file>b" => includes a</file>b? true  (the regex alone would yield "a").
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors (`--strict`). (Requires S1's FileDetail fields — stated dependency.)
- [ ] `node ./file-injector.test.mjs` → 0 failed (148 = baseline 147 + REND-OFFSET; REND-11 robust).
- [ ] `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` → 0 failed (unchanged).
- [ ] `git diff --stat`: file-injector.ts + file-injector.test.mjs only.

### Feature Validation (the 3-tier resolution)

- [ ] A detail with `contentStart`/`contentLen` (no `body`) renders the EXACT body via `message.content.slice` — incl. a nested `</file>` (BUG-1-safe).
- [ ] A detail with `body` (no offsets) renders via `d.body` (REND-1..7,9,10,11(a) unchanged).
- [ ] A detail with neither renders via `bodies[i]` (regex fallback retained).
- [ ] The `d.kind !== "image"` guard + `highlightCode`/`getLanguageFromPath` are unchanged.
- [ ] `FILE_BLOCK_RE.lastIndex = 0` + the `bodies[]` computation are unchanged (tier-3 retained).
- [ ] REND-11 passes in BOTH pre-S1 (body → tier-2) and post-S1 (offsets → tier-1) trees (the robust rewrite).

### Code Quality Validation

- [ ] The 3-tier expression matches the architecture doc's "Renderer change shape" verbatim (offset → body → regex).
- [ ] Tiers 2 + 3 are RETAINED (§6.3/§12.23 defensive rendering preserved — no regression for old/test entries).
- [ ] No regex introduced in the offset path (tier-1 is length-derived via S1's computeDetailOffsets → BUG-1-safe).
- [ ] No `as any` shim on `d.contentStart` (typed access per the convention + the contract; S1 is a stated dependency).
- [ ] Mode-A comments document the 3 tiers + WHY offsets are BUG-1-safe (item §5).
- [ ] REND-OFFSET placed after REND-11 (BUG-1/offsets cluster); no collision with S1's ISS2-* (delivery cluster).

### Documentation

- [ ] Renderer FALLBACK comment (L644-648) + inline comment (L672) updated to the 3-tier docs (Mode A — item §5).
- [ ] NO README change (P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT use a regex for tier-1.** The whole point is BUG-1: an inner `</file>` truncates FILE_BLOCK_RE's lazy
  capture. Tier-1 is `message.content.slice(contentStart, contentStart+contentLen)` — EXACT (S1's offsets are
  length-derived). Re-introducing a regex regresses BUG-1.
- ❌ **Do NOT remove the `d.body` or `bodies[i]` fallbacks.** Old persisted messages, foreign custom messages, and
  the REND-* unit tests carry `body` (or nothing). Removing them regresses §6.3/§12.23 defensive rendering (the
  renderer must always show SOMETHING, never throw). The 3-tier expression keeps both as tiers 2 + 3.
- ❌ **Do NOT touch the bodies[] computation or `FILE_BLOCK_RE.lastIndex = 0`.** They are tier-3 (the last-resort
  fallback). The 3-tier expression reads `bodies[i]` only when tiers 1+2 miss. The unconditional regex re-parse is
  cheap and needed for tier 3.
- ❌ **Do NOT touch the image guard (`d.kind !== "image"`) or highlightCode/getLanguageFromPath.** They are
  unchanged by this task. Only the `const body = …` line + the comment change.
- ❌ **Do NOT add the paged-directive render line (`if (d.kind === "paged" && typeof d.directive === "string")`).**
  That is P1.M2.T2.S1's edit. This task changes ONLY the body-resolution expression + comment.
- ❌ **Do NOT edit FileDetail / emitText / before_agent_start / computeDetailOffsets.** Those are S1's scope. This
  task is the renderer consumer of S1's offset fields.
- ❌ **Do NOT leave REND-11(b) reading `d.body`.** Post-S1, injectFiles carries no body → the assert fails AND the
  render falls to the BUG-1-vulnerable regex. Rewrite REND-11(b) to assert on the RENDERED output + simulate the
  offset pass via `computeDetailOffsets` (guarded by `typeof … === "function"` for forward-compat).
- ❌ **Do NOT shim `d.contentStart` with `(d as any)`.** The item description + architecture doc read `d.contentStart`
  directly (typed access is the convention). `--strict` REQUIRES S1's FileDetail fields — that's a stated dependency,
  not a workaround. If typecheck errors TS2339, land S1 first.
- ❌ **Do NOT skip the `if (typeof mod.computeDetailOffsets === "function")` guard in REND-11(b).** Without it,
  REND-11(b) throws `mod.computeDetailOffsets is not a function` in a pre-S1 tree. The guard makes it pass in both states.
- ❌ **Do NOT place REND-OFFSET in the delivery/ISS2 cluster.** S1 adds ISS2-* there. Place REND-OFFSET after REND-11
  (the BUG-1/offsets cluster) to avoid a merge collision.
- ❌ **Do NOT make REND-OFFSET use a benign body.** It MUST use a nested `</file>` (`"a</file>b"`) to PROVE tier-1 is
  BUG-1-safe (the regex would truncate to `"a"`). A benign body would pass even if tier-1 were broken (tier-3 regex
  would coincidentally recover a body with no inner `</file>`).

---

## Confidence Score: 9/10

A surgical, well-traced renderer change: one expression (the 3-tier body resolution, copied verbatim from the
architecture doc's "Renderer change shape") + one Mode-A comment + one robustness test fix (REND-11(b) made
forward-compatible via the `computeDetailOffsets` guard + asserting on rendered output) + one new tier-1 unit
case (REND-OFFSET, with a nested `</file>` to prove BUG-1-safety). The key insights are all captured: tier-1
must be a length-derived slice (not regex) to stay BUG-1-safe; tiers 2/3 are retained for §6.3/§12.23 defensive
rendering; REND-11(b) is brittle post-S1 and MUST be rewritten (the parallel-predecessor oversight); the
typecheck gate has a stated dependency on S1's FileDetail fields (do NOT `as any`-shim). The no-conflict
boundaries are clear (S1 = FileDetail/emitText/before_agent_start/ISS2-*; P1.M2.T2.S1 = directive line; this
task = renderInjectedMessage expression + REND cluster). The -1 reserves for the typecheck-gate sequencing
risk (S1 must land for `d.contentStart` to compile under --strict) — mitigated by treating S1 as a contract
and a clear "land S1 first" instruction if TS2339 appears. The implementing agent edits one expression + one
comment in the renderer, rewrites one test's E2E assertions, adds one case, then runs 4 commands.
