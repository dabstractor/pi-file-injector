---
name: "P1.M2.T2.S1 (bugfix 001_a4cee0dcf39c) — Store the paged directive in FileDetail.directive + render it after the head body in renderInjectedMessage's expanded branch (Issue 3, PRD §6.3)"
prd_ref: "bugfix PRD §h3.2 Issue 3 (Paged-file expanded view omits the paging directive); PRD §6.3 ('Paged files show their head block plus the paged-directive text verbatim'); §6.2 (FileDetail metadata for the renderer); architecture/issue2_3_filedetail_renderer.md ('Issue 3 fix' + 'Renderer change shape')"
target_files: "./file-injector.ts (EDIT emitText paged branch L922-926 + ADD extractDirectiveInner helper + EDIT renderInjectedMessage expanded branch + Mode-A comments) + ./file-injector.test.mjs (ADD REND-PAGED-DIR + ISS3-DIRECTIVE)"
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + `node ./file-injector.test.mjs`)
depends_on: "P1.M2.T1.S1 (FileDetail +directive?/contentStart?/contentLen?; emitText −3 body pushes; +computeDetailOffsets; before_agent_start offset pass) — IN FLIGHT (being re-planned after a halt); treat as a CONTRACT. This task POPULATES the `directive?` field S1 DECLARES. P1.M2.T1.S2 (renderer 3-tier offset body resolution) — LANDED (file-injector.ts:672-689); this task's render edit is additive AFTER its body-resolution block."
consumed_by: "P1.M3.T2.S1 (README — no directive-display language to sync; internal). NOTE: this task runs after P1.M2.T1 (S1+S2) completes; it edits emitText's paged branch (orthogonal to S1's body-removal) + renderInjectedMessage's expanded branch (additive to S2's landed body-resolution). No shared edit-site conflict."
---

# PRP — P1.M2.T2.S1: Store the paged directive in FileDetail + render it after the head in the expanded view (Issue 3, §6.3)

> **Scope flag:** Bugfix for Issue 3 (Minor, PRD §6.3). A paged file's expanded view currently shows only the
> head body — the `<paged: N chars; … read the rest …>` directive (the resume instructions) is never surfaced,
> even though it reaches the model via `message.content`. This task: (1) **populates** `directive` on the paged
> `FileDetail` in `emitText` (hoisting the directive block into a local and storing its inner text via a new
> `extractDirectiveInner` helper); (2) **consumes** it in `renderInjectedMessage`'s expanded branch (a new
> `Text` child after the head body). **Two source edits + one small helper + Mode-A comments + two regression
> cases.** The field `directive?` is DECLARED on `FileDetail` by P1.M2.T1.S1 (a stated dependency); this task
> fills and reads it. The edits are **additive** to both P1.M2.T1.S1 (emitText body-removal — orthogonal field)
> and P1.M2.T1.S2 (the landed renderer offset tier — the directive block goes after it).

---

## Goal

**Feature Goal:** Make expanding (`ctrl+o`) a paged file's green `read <path>:<n>-` line show the head body
**followed by** the `<paged: …>` directive text (the "read the rest with the read tool at offset:…" resume
instructions), per PRD §6.3. The model still receives the directive via `message.content` (unchanged — this is
a display-only gap fix).

**Deliverable:** Two modified files:
- **`./file-injector.ts`** — (a) `emitText` paged branch: hoist `formatPagedDirectiveBlock(...)` into a local
  `directiveBlock`, push it to `state.blocks`, and store `directive: extractDirectiveInner(directiveBlock)` on
  the paged detail; (b) a new private `extractDirectiveInner(block)` helper near `formatPagedDirectiveBlock`;
  (c) `renderInjectedMessage` expanded branch: after the head-body render, add
  `if (d.kind === "paged" && typeof d.directive === "string") box.addChild(new Text(theme.fg("dim", d.directive), 0, 0))`;
  (d) Mode-A comments (emitText paged + FileDetail `directive?`).
- **`./file-injector.test.mjs`** — (a) `REND-PAGED-DIR` (consumer regression): craft a paged detail with
  `directive` + content, render expanded, assert the directive text appears as a child after the head; (b)
  `ISS3-DIRECTIVE` (producer integration): force paging via `PAGED_FIX` + `#@huge.log`, assert the paged detail
  carries `directive` as a string containing `<paged:`.

**Success Definition:**
1. Expanding a paged file's `read` line renders the head body FOLLOWED by the `<paged: …>` directive text (dim).
2. The model-facing `message.content` is unchanged (the directive block is still pushed to `state.blocks` — only
   additionally stored on the detail for display).
3. `REND-PAGED-DIR` passes (consumer: rendered expanded output contains the directive text after the head body).
4. `ISS3-DIRECTIVE` passes (producer: a real paged injection's detail carries `directive` containing `<paged:`).
5. `npm run typecheck` → 0 errors (`--strict`); `node ./file-injector.test.mjs` → 0 failed (baseline + 2 new);
   the two auxiliary suites stay green.
6. No regression: collapsed paged `readLine` (range suffix), REND-*/PD-* cases, the body-resolution tiers — all unchanged.

## User Persona

**Target User:** A Pi user who expands a paged file's green `read huge.log:<n>-` line to see what was delivered.
Today they see only the head; the "read the rest…" instructions are invisible. After this fix they see the head
AND the directive — matching PRD §6.3 and the read-tool's transparent "here's what you got, here's how to get more" UX.

**Use Case:** `Summarize #@huge.log` (over budget) → the green line reads `read huge.log:1-`; press `ctrl+o` →
the head text appears, followed by a dim `<paged: 50000 chars; head delivered M complete lines; read the rest
with the read tool at offset:N, limit:2000, …>` line telling the user (and confirming to the model) how paging resumes.

**Pain Points Addressed:** The expanded view was silently incomplete — a user inspecting a paged delivery saw no
hint that the file was truncated or how to continue. The directive is the contract for the model-driven paging;
surfacing it in the expanded view makes the delivery honest and inspectable (§6.3).

## Why

- **Closes an explicit PRD display contract.** §6.3: "Paged files show their head block **plus the paged-directive
  text verbatim**." Today only the head shows; the directive (computed and pushed to `content`) is never rendered.
- **The directive is already produced — it just isn't surfaced.** `emitText` computes `formatPagedDirectiveBlock(...)`
  and pushes it to `state.blocks` (→ `message.content` → the model). The gap is purely that the renderer's expanded
  branch reads only the head body. Storing the directive's inner text on the detail + rendering it is a small,
  surgical fix that completes the §6.3 contract without touching delivery or model input.
- **Low-impact, display-only.** The model receives the identical `content` (the directive block is still pushed).
  The collapsed read line (range suffix) is unchanged. Only the EXPANDED view gains one dim Text child per paged file.
- **Composes cleanly with the parallel offset refactor (P1.M2.T1).** S1 declares `directive?` on FileDetail (this
  task's stated dependency) and removes the duplicated `body`; S2 landed the renderer's 3-tier offset body
  resolution. My edits are additive: the `directive:` field is orthogonal to S1's `body:` removal; the directive
  render block goes AFTER S2's body-resolution block. No edit-site conflict.

## What

No user-visible/API/config/model-input change. The paged `FileDetail` gains a populated `directive` string; the
expanded renderer appends one dim Text child per paged file. `message.content` (model input) is unchanged.

### Success Criteria

- [ ] `emitText` paged branch hoists `const directiveBlock = formatPagedDirectiveBlock(abs, content.length, startLine, headLines)`, pushes `directiveBlock` to `state.blocks`, and the paged detail push includes `directive: extractDirectiveInner(directiveBlock)`.
- [ ] A new private `extractDirectiveInner(block)` helper strips `<file name="…">` + `</file>` to return the `<paged: …>` inner text.
- [ ] `renderInjectedMessage` expanded branch, AFTER the existing `if (body !== undefined && d.kind !== "image") { … }` block, adds `if (d.kind === "paged" && typeof d.directive === "string") box.addChild(new Text(theme.fg("dim", d.directive), 0, 0))`.
- [ ] Mode-A comments updated: emitText paged branch (directive captured + stored for §6.3 expanded view) + FileDetail `directive?` field (rendered in the expanded view per §6.3).
- [ ] `REND-PAGED-DIR` passes: a crafted paged detail with `directive` + content → expanded render contains the directive text as a child after the head body.
- [ ] `ISS3-DIRECTIVE` passes: `injectFiles("Summarize #@huge.log", [], PAGED_FIX)` → `r.details[0].kind === "paged"` && `typeof r.details[0].directive === "string"` && `r.details[0].directive.includes("<paged:")`.
- [ ] `npm run typecheck` → 0 errors; `node ./file-injector.test.mjs` → 0 failed; the 2 auxiliary suites green.
- [ ] Collapsed paged `readLine` (range suffix), REND-3 (paged collapsed), PD1-PD8, and the renderer body-resolution tiers are all unchanged.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the exact current `emitText` paged branch (L917-926, quoted), the exact `formatPagedDirectiveBlock`
output shape (L317), the landed renderer expanded branch (L672-689, the S2 3-tier body resolution — quoted), the
exact 4 edits (emitText hoist+store, extractDirectiveInner helper, renderer directive child, Mode-A comments),
the stated dependency on S1's `directive?` field (with the TS2339 → "land S1 first" instruction), the composition
notes (orthogonal to S1's body-removal; additive to S2's landed body-resolution), the 2 regression-case designs
(consumer crafts detail; producer forces paging via PAGED_FIX), the REND cluster location (L2563+; place after
REND-OFFSET L2731), and the gates. The implementer edits 2 files in small additive regions and runs the gates.

### Documentation & References

```yaml
# MUST READ — the Issue 3 fix spec + the renderer-change shape (the directive render block goes after the body block)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/architecture/issue2_3_filedetail_renderer.md
  why: "§'Issue 3 fix' (1) emitText paged branch captures the directive string into the detail (directive?:string);
        (2) renderInjectedMessage expanded branch appends the directive text after the head. §'Renderer change shape'
        shows the post-S2 expanded branch (the 3-tier body resolution) — my directive `if` block goes IMMEDIATELY AFTER
        that body-resolution block. §'FileDetail change' confirms `directive?: string` is paged-only."
  critical: "The doc's renderer block shows BOTH the Issue-2 body resolution AND the Issue-3 directive line. S2 already
             landed the body-resolution half; THIS task adds ONLY the directive `if` block (the last 3 lines). Do NOT
             re-add the body-resolution lines (S2 owns them)."

# MUST READ — the bug contract (Expected/Actual/Root-cause) + §6.3 citation
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/prd_snapshot.md   # bugfix PRD §h3.2 Issue 3
  why: "§h3.2: expanding a paged file's read line shows only the head (detail.body), not the directive; detail has no
        `directive` field (hasOwnProperty('directive') === false). Suggested Fix: store the directive text in the paged
        FileDetail and render it after the head when expanded. Cites PRD §6.3 (paged files show head + directive verbatim)."

# MUST READ — the PRD display contract this task satisfies
- file: PRD.md   # (the main product PRD — §6.3)
  why: "§6.3 'Expanded (ctrl+o)': 'Paged files show their head block plus the paged-directive text verbatim (the
        model-driven paging is unaffected; this is just the expanded view of what was delivered).' This is the contract."
  section: "§6.3 (Chat display — Expanded) + §6.2 (FileDetail)"

# The parallel predecessor's contract (S1 — declares directive?; this task POPULATES it)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T1S1/research/research_notes.md   # (S1 — PRP being re-planned; research notes are the de-facto contract)
  why: "§4 'FileDetail interface': S1 adds `directive?: string` (paged-only), `contentStart?`, `contentLen?`; KEEPS `body?`
        (deprecated). §3 'emitText edits': S1 removes the 3 `body:` pushes (L895/L919/L927) but does NOT set `directive`
        ('The `directive` field is DECLARED in the interface but NOT populated here (P1.M2.T2.S1 populates it).'). So this
        task is the SOLE populator of `directive`; S1 is the sole declarer. Coordinate: do NOT re-declare `directive?` on
        FileDetail (S1 owns the interface change); this task depends on it."
  critical: "REND-11(b) (the nested-</file> BUG-1 E2E) was the S1 halt point — S2 already rewrote it to be forward-compatible
             (asserts on rendered output + simulates computeDetailOffsets). This task does NOT touch REND-11. The `directive?`
             field is the ONLY S1 dependency; if `npm run typecheck` errors TS2339 on `d.directive`/`directive:`, S1 hasn't
             landed — land S1 first (identical pattern to S2's contentStart/contentLen dependency)."

# The LANDED sibling (S2 — the renderer offset tier; my render edit is additive AFTER its body-resolution block)
- file: plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/P1M2T1S2/PRP.md
  why: "S2 LANDED the renderer's 3-tier body resolution at file-injector.ts:672-689 (offset slice → d.body → bodies[i]).
        My directive render block goes AFTER the `if (body !== undefined && d.kind !== 'image') { … }` block (L678-682).
        No overlap with S2's edit. S2's anti-pattern 'Do NOT add the paged-directive render line — that's P1.M2.T2.S1'
        confirms this task OWNS that line."

# The file you edit (source) — the 3 edit regions + the helper
- file: file-injector.ts
  why: "emitText L900-927 (paged branch L917-926 — the producer edit). formatPagedDirectiveBlock L317 (the directive
        shape; my extractDirectiveInner helper goes nearby, ~L320). renderInjectedMessage expanded branch L672-689
        (LANDED S2 body resolution; my directive `if` block goes after L682). FileDetail L347-360 (directive? field —
        DECLARED by S1; my Mode-A comment update rides along)."
  pattern: "emitText pushes blocks then the detail; the paged detail is the LAST push in the paged branch. The renderer
            loops files, renders the collapsed readLine, then (expanded) the body block, then (my edit) the directive."
  gotcha: "`directive: extractDirectiveInner(directiveBlock)` in the emitText push + `d.directive` in the renderer require
           FileDetail to DECLARE `directive?` (S1's edit). Under --strict this is TS2339 if S1 hasn't landed. Stated dependency
           — do NOT shim with `as any` (typed access is the convention); land S1 first if TS2339 appears."

# The file you edit (tests) — 2 new cases
- file: file-injector.test.mjs
  why: "REND cluster L2563-2750: REND_THEME L2563 ({fg,bg,bold}→identity stub); REND-3 L2593 (paged COLLAPSED read line —
        my REND-PAGED-DIR complements it for EXPANDED); REND-11 L2696 (BUG-1); REND-OFFSET L2731 (S2's tier-1). Place
        REND-PAGED-DIR AFTER REND-OFFSET (the offsets/directive cluster). PD cluster L1059+: PD1 L1061 forces paging via
        PAGED_FIX (L412, getContextUsage tokens:10000/contextWindow:50000) + huge.log; ISS3-DIRECTIVE mirrors PD1's setup.
        FIX={cwd:TMPDIR} L360; huge.log fixture exists (buildFixtures). textOf helper (used by REND-*) extracts a child's text."
  pattern: "REND-* cases call mod.renderInjectedMessage({details:{files:[…]}, content:'…'}, {expanded:true}, REND_THEME) and
            inspect box.children via textOf. ISS3-DIRECTIVE calls mod.injectFiles(prompt, [], PAGED_FIX) and reads r.details[0].directive."
  gotcha: "REND-PAGED-DIR must craft a paged detail WITH `directive` AND enough `content` that the head body renders (so the
           directive child is NOT the only child — assert it appears AFTER the body). ISS3-DIRECTIVE asserts `d.directive`
           (NOT `d.body` — S1 removes body), so it's robust to S1's presence/absence."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD (baseline: 147 passed, 0 failed; S2 LANDED, S1 in flight)
├── file-injector.ts             # ← EDIT (emitText paged L922-926; +extractDirectiveInner ~L320; renderer expanded ~L682; comments)
├── file-injector.test.mjs       # ← EDIT (+REND-PAGED-DIR after REND-OFFSET; +ISS3-DIRECTIVE near PD cluster)
├── relative-imports.test.mjs    # run to confirm green (NOT edited)
├── import-behavior.test.mjs     # run to confirm green (NOT edited)
├── scripts/typecheck.mjs        # untouched (--strict gate)
├── package.json / PRD.md / README.md   # untouched (README = P1.M3.T2.S1)
└── plan/008_561ef016260d/bugfix/001_a4cee0dcf39c/
    ├── architecture/{issue1_resolveimportpath.md, issue2_3_filedetail_renderer.md, issue4_image_and_tests.md, system_context.md}
    ├── P1M1T1S1..P1M2T1S2/{research, PRP.md}   # P1.M1.* (Issue 1) LANDED; P1.M2.T1.S2 (renderer offsets) LANDED; P1.M2.T1.S1 (FileDetail/emitText offsets) IN FLIGHT
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED (4 regions, all additive):
                          #   (1) emitText paged branch L922-926: hoist directiveBlock; push it; +directive:extractDirectiveInner(directiveBlock) on the detail
                          #   (2) +extractDirectiveInner private helper (~L320, near formatPagedDirectiveBlock)
                          #   (3) renderInjectedMessage expanded branch (~L683, AFTER the body-render if-block): +paged directive Text child
                          #   (4) Mode-A comments: emitText paged + FileDetail directive? field
                          #   UNCHANGED: formatPagedDirectiveBlock; the renderer body-resolution tiers (S2); collapsed readLine; bodies[] computation;
                          #   the inline/sub-head text detail pushes; image/binary detail pushes; FileDetail field declarations (S1 owns them).
file-injector.test.mjs    # MODIFIED:
                          #   (1) +runCase("REND-PAGED-DIR", …) after REND-OFFSET (L2731): crafted paged detail + content → expanded render contains the directive after the head
                          #   (2) +runCase("ISS3-DIRECTIVE", …) near the PD cluster (L1059+): PAGED_FIX + #@huge.log → r.details[0].directive is a string with <paged:
                          #   UNCHANGED: REND-1..11, REND-OFFSET; PD1-PD8; captureAllHandlers; PAGED_FIX; buildFixtures; sanity list + ASSERTED_EXPORTS.
# No other files. No FileDetail field declarations (S1). No renderer body-resolution (S2). No README (P1.M3.T2.S1).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — this task DEPENDS on P1.M2.T1.S1's `directive?` field on FileDetail. `directive: …` in the emitText push
//   and `d.directive` in the renderer are TS2339 ("Property 'directive' does not exist") under --strict if S1 hasn't
//   landed. This is a STATED DEPENDENCY (the item contract: "directive? is declared on FileDetail by P1.M2.T1.S1; this
//   subtask POPULATES and CONSUMES it"). Do NOT shim with `(d as any)` — typed access is the convention (matches S2's
//   contentStart/contentLen access). If `npm run typecheck` errors TS2339 on directive, S1's FileDetail edit isn't in
//   your tree: land S1 first.

// CRITICAL — do NOT re-declare `directive?` on FileDetail. S1 owns the FileDetail interface change (it adds directive?/
//   contentStart?/contentLen? atomically). Re-declaring it here would conflict at merge. This task depends on S1's
//   declaration; it does not duplicate it. (The Mode-A COMMENT on the directive? field is mine — that's a doc edit, not
//   a re-declaration.)

// CRITICAL — the emitText edit is ADDITIVE and composes with S1's body-removal. S1 removes `body: head` from the paged
//   push; this task ADDS `directive: extractDirectiveInner(directiveBlock)`. Whether `body: head` is present (current
//   tree) or removed (post-S1), the `directive:` addition is an orthogonal field on the same object literal. Apply the
//   directiveBlock hoist + `directive:` field to whatever shape is in the tree when you run.

// CRITICAL — the renderer directive block goes AFTER S2's body-resolution block, not inside it. S2 LANDED (L672-689):
//   `const body = (offset guard) ? slice : (d.body ?? bodies[i]); if (body !== undefined && d.kind !== "image") { …render body… }`.
//   My edit is a SEPARATE `if (d.kind === "paged" && typeof d.directive === "string") { … }` AFTER that block. Do NOT
//   nest it inside the body-render if (the directive must render even if the body is undefined, e.g. a test-crafted
//   paged detail with directive but no body/content offsets).

// GOTCHA — extractDirectiveInner must handle formatPagedDirectiveBlock's output, which has NO newline: `<file name="ABS"><paged: …></file>`.
//   `block.indexOf(">")` = end of `<file name="ABS">`; `block.lastIndexOf("</file>")` = the closer. slice(open+1, close)
//   = `<paged: …>`. A path containing `>` is implausible (`>` is trailing-punct, trimmed from tokens) — the first `>`
//   is reliably the opener's end. Defensive: if open<0 or close<=open, return the block unchanged.

// GOTCHA — render the directive in `theme.fg("dim", …)` (not toolOutput/toolTitle). It's a metadata/instruction line,
//   not file content. Matches the existing dim usage for hints/secondary text (expandHint, the binary "(binary — not
//   injected)" suffix). Keep it a SINGLE Text child (no Box wrapper) so it inherits the green toolSuccessBg from the parent Box.

// GOTCHA — ISS3-DIRECTIVE asserts `d.directive`, NOT `d.body`. S1 removes `body` from real emission; asserting `d.body`
//   would break post-S1. `directive` is set by emitText (this task) at injection time, BEFORE before_agent_start — so
//   `r.details[0].directive` is populated right after injectFiles (no need to drive before_agent_start). Robust to S1.

// GOTCHA — REND-PAGED-DIR crafts the detail DIRECTLY (like REND-OFFSET), so it's independent of S1 + paging fixtures.
//   It needs `content` long enough that the body renders (so the directive isn't the only child) OR assert the directive
//   child exists regardless. Safest: craft a content string with a real <file> block so bodies[i] / d.body resolves, AND
//   a `directive` field; assert the LAST child (or any child) contains the directive text.

// LIBRARY — TypeScript via jiti (transpile-on-load, no build step). typecheck = tsc --strict. renderInjectedMessage is a
//   pure function; the REND-* tests call it directly with crafted messages + REND_THEME. emitText is exported (testable).
//   Gate: npm run typecheck + node ./file-injector.test.mjs (+ 2 auxiliaries, unchanged). Baseline: 147 passed.
```

## Implementation Blueprint

### Data models and structure

No new data model. `FileDetail.directive?` is DECLARED by P1.M2.T1.S1 (string, paged-only). This task POPULATES it
(in emitText) and CONSUMES it (in the renderer). The `extractDirectiveInner` helper is a pure string transform.

```ts
// The directive inner text (what this task stores + renders), from formatPagedDirectiveBlock's output:
//   "<paged: 50000 chars; head delivered 200 complete lines; read the rest with the read tool at offset:201, limit:2000, incrementing offset by 2000 until done>"
// (everything between `<file name="ABS">` and `</file>` — formatPagedDirectiveBlock emits no newline.)
```

### Edit 1 — emitText paged branch (file-injector.ts L922-926): hoist + store the directive

```ts
// BEFORE (L917-926):
    } else {
      // PRD §9 — extract paged locals once (DRY); used by BOTH the directive block and the paged detail.
      const headLines = headCompleteLineCount(head);
      const startLine = headLines + 1; // == headStartLine(head)
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines));
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, body: head });
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }

// AFTER — hoist the directive block; push it; store its inner text on the detail (§6.3 expanded view):
    } else {
      // PRD §9 — extract paged locals once (DRY); used by BOTH the directive block and the paged detail.
      const headLines = headCompleteLineCount(head);
      const startLine = headLines + 1; // == headStartLine(head)
      const directiveBlock = formatPagedDirectiveBlock(abs, content.length, startLine, headLines); // §6.3 — hoist; inner text stored on the detail for the expanded view
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(directiveBlock);
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, body: head, directive: extractDirectiveInner(directiveBlock) });
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }
// NOTE: `body: head` is removed by P1.M2.T1.S1 (orthogonal). Whether present (current) or removed (post-S1),
// the `directive: extractDirectiveInner(directiveBlock)` addition composes unchanged.
```

### Edit 2 — extractDirectiveInner helper (file-injector.ts, near formatPagedDirectiveBlock ~L320)

```ts
/** §6.3 — the INNER text of a paged directive block (the `<paged: …>` resume instructions), for the expanded view.
 *  Strips the wrapping `<file name="…">` opener and `</file>` closer. `formatPagedDirectiveBlock` emits
 *  `<file name="ABS"><paged: …></file>` (no newline), so the inner is everything between the first `>` (end of the
 *  opener) and the last `</file>` (the closer). Defensive: if the markers aren't found, return the block unchanged. */
function extractDirectiveInner(block: string): string {
  const open = block.indexOf(">");        // end of '<file name="…">'
  const close = block.lastIndexOf("</file>");
  return open >= 0 && close > open ? block.slice(open + 1, close) : block;
}
```

### Edit 3 — renderInjectedMessage expanded branch (file-injector.ts, AFTER the body-render block ~L682)

```ts
// BEFORE (L678-689, the LANDED S2 block + the loop close):
      if (body !== undefined && d.kind !== "image") { // images already attached to user msg (§6.4) — skip
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
    }   // ← end of `if (opts.expanded)` … NO directive child today
  }

// AFTER — add the paged directive Text child AFTER the body-render if-block (§6.3):
      if (body !== undefined && d.kind !== "image") { // images already attached to user msg (§6.4) — skip
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
      if (d.kind === "paged" && typeof d.directive === "string") { // §6.3 — paged directive after the head, expanded view only
        box.addChild(new Text(theme.fg("dim", d.directive), 0, 0));
      }
    }
  }
// NOTE: this `if` is a SIBLING of the body-render if (both inside `if (opts.expanded)`), NOT nested in it. The
// directive renders even if the body was undefined (e.g. a test-crafted paged detail with directive but no body).
```

### Edit 4 — Mode-A comments (file-injector.ts)

- **emitText paged comment (~L909-916):** add a note that the directive block is now hoisted and its inner text
  stored on the detail (`directive`) for the §6.3 expanded view (the model still gets the directive via content — unchanged).
- **FileDetail `directive?` field comment (L347-360 region, the line S1 adds):** note it is rendered in the expanded
  view per §6.3 (populated by emitText's paged branch). This is a COMMENT edit on S1's field declaration, not a re-declaration.

### Edit 5 — NEW REND-PAGED-DIR case (file-injector.test.mjs, after REND-OFFSET ~L2731, before the Summary)

```js
// REND-PAGED-DIR — §6.3 paged directive in the expanded view (P1.M2.T2.S1). A paged detail carrying `directive` +
// content renders, when expanded, the head body FOLLOWED BY the directive text (the <paged: …> resume instructions).
// Crafts the detail directly (independent of P1.M2.T1.S1 offsets + paging fixtures — mirrors REND-OFFSET's isolation).
await runCase("REND-PAGED-DIR", "§6.3 expanded paged: head body FOLLOWED BY the <paged: …> directive text (dim)", async () => {
  const headBody = "first 8 KB of the file…";
  const directive = "<paged: 50000 chars; head delivered 200 complete lines; read the rest with the read tool at offset:201, limit:2000, incrementing offset by 2000 until done>";
  const content = '<file name="/abs/huge.log">\n' + headBody + '\n</file>';   // single head block → bodies[0] resolves
  const msg = {
    details: { files: [{ path: "/abs/huge.log", kind: "paged", range: ":201-", body: headBody, directive }] },
    content,
  };
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  const texts = expanded.children.map((c) => textOf(c));
  // the head body renders (tier-2 d.body):
  assert(texts.some((t) => t.includes(headBody)), `expanded paged view shows the head body, got ${JSON.stringify(texts.map((t) => t.slice(0, 40)))}`);
  // the directive renders AFTER the head (§6.3) — the LAST child is the directive:
  assert(texts.some((t) => t.includes("<paged:") && t.includes("read the rest")),
    `expanded paged view shows the <paged: …> directive text (§6.3), got ${JSON.stringify(texts.map((t) => t.slice(0, 40)))}`);
  const bodyIdx = texts.findIndex((t) => t.includes(headBody));
  const dirIdx = texts.findIndex((t) => t.includes("<paged:"));
  assert(dirIdx > bodyIdx, `the directive renders AFTER the head body (§6.3 order), got bodyIdx=${bodyIdx} dirIdx=${dirIdx}`);
});
```

### Edit 6 — NEW ISS3-DIRECTIVE case (file-injector.test.mjs, near the PD cluster ~L1059)

```js
// ISS3-DIRECTIVE — §6.3 producer (P1.M2.T2.S1). A REAL paged injection (huge.log under PAGED_FIX) produces a paged
// FileDetail whose `directive` is populated (the <paged: …> inner text) — proving emitText + extractDirectiveInner.
// Asserts `d.directive` (NOT `d.body` — P1.M2.T1.S1 removes body), so it's robust to S1's presence/absence.
await runCase("ISS3-DIRECTIVE", "§6.3 producer: paged injection → FileDetail.directive carries the <paged: …> inner text", async () => {
  const r = await mod.injectFiles("Summarize #@huge.log", [], PAGED_FIX);
  assert(r.injected === 1, `huge.log delivered (count includes paged), got injected=${r.injected}`);
  assert(r.paged === 1, `huge.log must be PAGED under PAGED_FIX, got paged=${r.paged}`);
  assert(Array.isArray(r.details) && r.details.length === 1, `one paged detail, got ${JSON.stringify(r.details?.length)}`);
  const d = r.details[0];
  assert(d.kind === "paged", `detail kind === 'paged', got ${d.kind}`);
  assert(typeof d.directive === "string" && d.directive.includes("<paged:"),
    `paged detail.directive carries the <paged: …> inner text (populated by emitText), got ${JSON.stringify(d.directive)}`);
  assert(d.directive.includes("read the rest"),
    `directive inner text includes the resume instructions, got ${JSON.stringify(d.directive)}`);
  // the model-facing content is unchanged — the directive block is still pushed to blocks (this fix is display-only):
  assert(blocksText(r).includes("<paged:"),
    `the directive block still reaches the model via content (display-only fix), got ${JSON.stringify(blocksText(r).slice(0, 80))}`);
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD extractDirectiveInner helper (file-injector.ts ~L320, near formatPagedDirectiveBlock)
  - IMPLEMENT: the private helper per Edit 2. Pure string transform; defensive (markers-not-found → return block).
  - DO NOT export it (the regression tests cover it via the rendered output + the detail field).

Task 2: EDIT emitText paged branch (file-injector.ts L922-926) — hoist + store the directive (Edit 1)
  - HOIST `const directiveBlock = formatPagedDirectiveBlock(abs, content.length, startLine, headLines);`
  - PUSH `state.blocks.push(directiveBlock);` (was the inline call)
  - ADD `directive: extractDirectiveInner(directiveBlock)` to the paged detail push.
  - COMPOSES with S1: if `body: head` is still present (current tree), leave it (S1 removes it later); if S1 already
    removed it, just add `directive:`. The field is orthogonal either way.
  - UPDATE the paged-branch comment (Mode A — Edit 4a): note the directive is captured + stored for the §6.3 expanded view.

Task 3: EDIT renderInjectedMessage expanded branch (file-injector.ts ~L683) — the directive Text child (Edit 3)
  - ADD `if (d.kind === "paged" && typeof d.directive === "string") { box.addChild(new Text(theme.fg("dim", d.directive), 0, 0)); }`
    AFTER the existing `if (body !== undefined && d.kind !== "image") { … }` block, INSIDE the `if (opts.expanded)` block.
  - DO NOT nest it inside the body-render if (sibling, not child — the directive renders even if body is undefined).
  - DO NOT touch the body-resolution tiers (S2), bodies[] computation, the image guard, the collapsed readLine, or files.length===0 fallback.

Task 4: Mode-A comments (Edit 4b) — FileDetail directive? field
  - UPDATE the `directive?` field's comment (the line S1 declares) to note it is rendered in the expanded view per §6.3.
  - This is a COMMENT edit on S1's declaration, NOT a re-declaration (do NOT add the field — S1 owns it).

Task 5: ADD REND-PAGED-DIR (file-injector.test.mjs, after REND-OFFSET ~L2731)
  - IMPLEMENT per Edit 5. Crafted paged detail + content; expanded render; assert head body + directive (in order).
  - INDEPENDENT of S1 (crafts detail directly). Mirrors REND-OFFSET's isolation pattern.

Task 6: ADD ISS3-DIRECTIVE (file-injector.test.mjs, near the PD cluster ~L1059)
  - IMPLEMENT per Edit 6. PAGED_FIX + `#@huge.log`; assert r.details[0].directive (string, <paged:, "read the rest").
  - Asserts `d.directive` (NOT d.body) → robust to S1's body-removal.

Task 7: VERIFY gates
  - npm run typecheck → 0 errors (--strict). (REQUIRES S1's directive? field — see Gotchas. If TS2339 on directive,
    land S1 first; do NOT shim with `as any`.)
  - node ./file-injector.test.mjs → 0 failed (baseline 147 + REND-PAGED-DIR + ISS3-DIRECTIVE = 149; REND-*/PD-* unchanged).
  - node ./relative-imports.test.mjs + node ./import-behavior.test.mjs → 0 failed (unchanged — they don't render paged).
  - git diff --stat: file-injector.ts + file-injector.test.mjs only.
```

### Implementation Patterns & Key Details

```ts
// ── extractDirectiveInner (the producer transform) ──
// formatPagedDirectiveBlock emits: `<file name="ABS"><paged: …></file>` (no newline).
const directiveBlock = '<file name="/abs/huge.log"><paged: 50000 chars; head delivered 200 complete lines; read the rest with the read tool at offset:201, limit:2000, incrementing offset by 2000 until done></file>';
extractDirectiveInner(directiveBlock)
// → "<paged: 50000 chars; head delivered 200 complete lines; read the rest with the read tool at offset:201, limit:2000, incrementing offset by 2000 until done>"

// ── emitText paged push (the producer edit) — `directive:` is orthogonal to S1's `body:` removal ──
state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, /* body: head — S1 removes */ directive: extractDirectiveInner(directiveBlock) });

// ── renderInjectedMessage expanded branch (the consumer edit) — AFTER S2's body-resolution block ──
if (opts.expanded) {
  const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")  // S2 (LANDED)
    ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
    : (typeof d.body === "string" ? d.body : bodies[i]);
  if (body !== undefined && d.kind !== "image") { …render body… }                                         // S2 (LANDED)
  if (d.kind === "paged" && typeof d.directive === "string") {                                            // ← THIS TASK (Issue 3)
    box.addChild(new Text(theme.fg("dim", d.directive), 0, 0));
  }
}
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — 4 regions, all additive):
  - emitText paged branch (L922-926): hoist directiveBlock; push it; +directive:extractDirectiveInner(directiveBlock) on the detail.
  - +extractDirectiveInner private helper (~L320, near formatPagedDirectiveBlock).
  - renderInjectedMessage expanded branch (~L683): +paged directive Text child (after the body-render if-block).
  - Mode-A comments: emitText paged branch + FileDetail directive? field.
  - UNCHANGED: formatPagedDirectiveBlock; the 3 body-resolution tiers (S2 LANDED); bodies[] + FILE_BLOCK_RE.lastIndex;
    the image guard; highlightCode/getLanguageFromPath; collapsed readLine; files.length===0 fallback; the inline/sub-head
    text detail pushes; image/binary detail pushes; FileDetail field DECLARATIONS (S1 owns them).
FILE_EDITS (file-injector.test.mjs):
  - +runCase("REND-PAGED-DIR", …) after REND-OFFSET (~L2731).
  - +runCase("ISS3-DIRECTIVE", …) near the PD cluster (~L1059).
  - UNCHANGED: REND-1..11, REND-OFFSET; PD1-PD8; captureAllHandlers; PAGED_FIX; buildFixtures; sanity list + ASSERTED_EXPORTS.
NO_CHANGES: FileDetail field declarations (S1); renderer body-resolution (S2); relative-imports.test.mjs; import-behavior.test.mjs;
            package.json, scripts/typecheck.mjs, PRD.md, README.md (P1.M3.T2.S1), all plan/ files.
NO_MODEL_INPUT_CHANGE: message.content is unchanged — the directive block is still pushed to state.blocks (→ content → the
            model). This fix is DISPLAY-ONLY: it additionally stores the directive's inner text on the detail + renders it.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# CRITICAL: this REQUIRES P1.M2.T1.S1's `directive?` field on FileDetail, because the emitText push sets `directive:` and
#   the renderer reads `d.directive` — both TS2339 under --strict without the field. If you see:
#     "error TS2339: Property 'directive' does not exist on type 'FileDetail'"
#   → S1 hasn't landed in your tree. Land S1 first (it's a stated dependency). Do NOT shim with `(d as any)` — typed
#   access is the convention (matches S2's contentStart/contentLen). extractDirectiveInner is plain string math (no type issue).
```

### Level 2: The primary suite + the 2 new cases

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: REND-PAGED-DIR ✓ + ISS3-DIRECTIVE ✓, then "Result: 149 passed, 0 failed." (baseline 147 + 2 new). Exit 0.
# If REND-PAGED-DIR fails ("<paged:" absent in expanded) → the directive `if` block wasn't added, or was nested inside the
#   body-render if (so it didn't fire when body resolved). Re-check Edit 3: it's a SIBLING of the body-render if.
# If ISS3-DIRECTIVE fails (d.directive absent/not a string) → emitText didn't populate directive (Edit 1/2) OR the file
#   wasn't paged (re-check PAGED_FIX + huge.log; PD1 is the template).
# If REND-3 (paged collapsed) or PD1-PD8 flip → you accidentally changed the collapsed readLine or the blocks push (revert).
# If REND-OFFSET / REND-11 flip → you touched the renderer body-resolution block (revert — that's S2's landed edit).
```

### Level 3: The two auxiliary suites (unchanged — must stay green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./relative-imports.test.mjs    # → 0 failed (doesn't render paged; unchanged)
node ./import-behavior.test.mjs     # → 0 failed (doesn't render paged; unchanged)
```

### Level 4: End-to-end paged-render spot-check (ad hoc — REND-PAGED-DIR is authoritative)

```bash
cd /home/dustin/projects/pi-file-injector
# Force a real paged injection + render expanded; confirm the directive appears after the head (confidence only):
node -e '
  const PIPKG = require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
  const { createJiti } = require(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(__filename, { alias: { "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js", "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js", "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js" } });
  jiti.import("./file-injector.ts").then(async mod => {
    const fs = require("fs"), path = require("path"), os = require("os");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "pg-"));
    fs.writeFileSync(path.join(d, "big.log"), "line\n".repeat(5000));
    const r = await mod.injectFiles("Summarize #@big.log", [], { cwd: d, getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }) });
    const dd = r.details[0];
    console.log("kind:", dd.kind, "| has directive:", typeof dd.directive === "string", "| directive starts:", JSON.stringify((dd.directive || "").slice(0, 40)));
    const box = mod.renderInjectedMessage({ details: { files: r.details }, content: r.blocks.join("\n\n") }, { expanded: true }, { fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t });
    const texts = box.children.map(c => c.render(2000).join("\n"));
    console.log("expanded has <paged: in a child:", texts.some(t => t.includes("<paged:")));
  });
'
# Expected: kind: paged | has directive: true | directive starts: "<paged: …" ; expanded has <paged: in a child: true
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors (`--strict`). (Requires S1's `directive?` field — stated dependency.)
- [ ] `node ./file-injector.test.mjs` → 0 failed (149 = baseline 147 + REND-PAGED-DIR + ISS3-DIRECTIVE).
- [ ] `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` → 0 failed (unchanged).
- [ ] `git diff --stat`: file-injector.ts + file-injector.test.mjs only.

### Feature Validation (the §6.3 contract)

- [ ] `emitText` paged branch stores `directive: extractDirectiveInner(directiveBlock)` on the paged detail (ISS3-DIRECTIVE).
- [ ] `renderInjectedMessage` expanded branch renders the directive text AFTER the head body (REND-PAGED-DIR).
- [ ] The collapsed paged readLine (range suffix) is unchanged (REND-3 passes).
- [ ] `message.content` still carries the directive block (ISS3-DIRECTIVE asserts `blocksText(r).includes("<paged:")` — model input unchanged).
- [ ] The directive renders in `theme.fg("dim", …)` (a single Text child; inherits the green Box bg).

### Code Quality Validation

- [ ] The emitText edit is ADDITIVE (composes with S1's body-removal — orthogonal fields on the same push).
- [ ] The renderer edit is a SIBLING of the body-render if (not nested) — fires even if body is undefined.
- [ ] `extractDirectiveInner` is defensive (markers-not-found → return the block unchanged); pure string math.
- [ ] No `as any` shim on `d.directive` (typed access per the convention; S1 is a stated dependency).
- [ ] No re-declaration of `directive?` on FileDetail (S1 owns the interface change; this task only comments it).
- [ ] Mode-A comments on emitText paged + FileDetail directive? (item §5).

### Documentation

- [ ] emitText paged comment + FileDetail directive? field comment updated (Mode A — item §5).
- [ ] NO README change (P1.M3.T2.S1). PRD read-only.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT re-declare `directive?` on FileDetail.** P1.M2.T1.S1 owns the FileDetail interface change (adds directive?/
  contentStart?/contentLen? atomically). This task DEPENDS on S1's declaration; it does not duplicate it. (The Mode-A
  comment on the field is a doc edit, not a re-declaration.) If typecheck errors TS2339, land S1 — don't add the field here.
- ❌ **Do NOT shim `d.directive` / `directive:` with `(d as any)` / `(detail as any)`.** Typed access is the convention
  (matches S2's contentStart/contentLen). `--strict` REQUIRES S1's FileDetail field — that's a stated dependency, not a
  workaround. If TS2339, land S1 first.
- ❌ **Do NOT nest the directive `if` inside the body-render `if`.** It must be a SIBLING (both inside `if (opts.expanded)`),
  so the directive renders even when the body is undefined (e.g. a test-crafted paged detail with directive but no body/
  offsets). Nesting it would skip the directive whenever the body resolves.
- ❌ **Do NOT touch the renderer body-resolution block (S2), `bodies[]`, `FILE_BLOCK_RE.lastIndex`, the image guard, or
  `highlightCode`.** Those are S2's landed edit + the unchanged rendering pipeline. This task adds ONE `if` block after them.
- ❌ **Do NOT change `formatPagedDirectiveBlock`, the collapsed `readLine`, the range suffix, or the `state.blocks` push
  order.** The directive block is still pushed to `state.blocks` (→ model content) — this fix only ADDITIONALLY stores its
  inner text on the detail. Reorder/change and you break PD1-PD8 + the model input.
- ❌ **Do NOT remove `body: head` from emitText.** That's S1's job (orthogonal). This task ADDS `directive:`; leave `body:`
  exactly as it is in your tree (present pre-S1, removed post-S1 — either way `directive:` composes).
- ❌ **Do NOT assert `d.body` in ISS3-DIRECTIVE.** S1 removes body from real emission; asserting it breaks post-S1. Assert
  `d.directive` (set by this task at emit time, robust to S1).
- ❌ **Do NOT make REND-PAGED-DIR depend on paging fixtures or S1.** Craft the paged detail directly (like REND-OFFSET) so
  it's isolated and passes regardless of S1's state. Use `body` in the crafted detail so the head renders (tier-2) AND a
  `directive` field; assert both appear, directive after head.
- ❌ **Do NOT export `extractDirectiveInner`.** It's a private helper; the regression tests cover it via the rendered output
  (REND-PAGED-DIR) + the detail field (ISS3-DIRECTIVE). Exporting adds a module-surface/guard sync for no benefit.
- ❌ **Do NOT place REND-PAGED-DIR / ISS3-DIRECTIVE where they collide with S1's ISS2-* or S2's REND-OFFSET.** REND-PAGED-DIR
  goes after REND-OFFSET (the REND/offsets/directive cluster); ISS3-DIRECTIVE near the PD cluster. Distinct regions.

---

## Confidence Score: 9/10

A surgical, display-only bugfix with a precise contract (architecture doc §"Issue 3 fix" + §"Renderer change shape" +
the item's exact edit spec). The four edits are small and additive: hoist+store the directive in emitText (orthogonal
to S1's body-removal), a defensive `extractDirectiveInner` string helper, one `if` block in the renderer's expanded
branch (additive to S2's LANDED body-resolution), and Mode-A comments. The PRP nails the three coordination points:
(1) **stated dependency on S1's `directive?` field** (TS2339 → land S1; no `as any` shim — matches S2's pattern);
(2) **the emitText edit composes with S1's body-removal** (orthogonal fields — apply to whatever shape is in the tree);
(3) **the renderer directive `if` is a SIBLING of the body-render `if`** (not nested — fires even when body is undefined,
so test-crafted paged details render the directive). The two regression cases split cleanly: REND-PAGED-DIR (consumer,
crafted-detail, isolated from S1/paging) + ISS3-DIRECTIVE (producer, PAGED_FIX+huge.log, asserts `d.directive` not `d.body`
→ robust to S1). The model input (`message.content`) is provably unchanged (the directive block is still pushed). The -1
reserves for the S1 sequencing risk (S1 is being re-planned after a halt; if it's delayed, this task's typecheck gate is
blocked until S1 lands) — mitigated by treating S1 as a contract with a clear "land S1 first" instruction if TS2339 appears,
identical to the dependency pattern S2 already established. The implementing agent edits 2 files in small additive regions
and runs 4 commands.
