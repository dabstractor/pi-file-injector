# Research Notes — P1.M2.T2.S1 (bugfix 001_a4cee0dcf39c)

**Item:** Store the paged directive in the paged `FileDetail` (`directive?`) and render it after the head body
in `renderInjectedMessage`'s expanded branch (Issue 3, PRD §6.3).
**Plan:** plan/008_561ef016260d/bugfix/001_a4cee0dcf39c (Bug Fixes for `#@file` Extension QA Findings).

## The bug (Issue 3, confirmed)

A paged file emits 2 blocks: head (`<file name="abs">\n<head>\n</file>`) + directive
(`<file name="abs"><paged: N chars; …></file>`). The directive reaches the MODEL via `message.content`, but the
renderer's expanded branch renders only the head body — the directive text (the "read the rest with the read
tool at offset:…" resume instructions) is NEVER surfaced in the expanded view. `detail` has no `directive` field.
PRD §6.3: "Paged files show their head block **plus the paged-directive text verbatim**." → display gap.

## Current code state (verified — the baseline I edit)

- **FileDetail** (file-injector.ts:347-360): has `body?: string` ONLY. NO `directive?`/`contentStart?`/`contentLen?`.
- **emitText paged branch** (L917-926): `state.blocks.push(formatTextFileBlock(abs, head)); state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines)); state.details.push({ path: abs, kind: "paged", chars: content.length, range: \`:${startLine}-\`, pagedHeadLines: headLines, body: head });` — the directive block is computed INLINE at L924 but NOT stored on the detail.
- **formatPagedDirectiveBlock** (L317): returns `<file name="ABS"><paged: N chars; head delivered M complete lines; read the rest with the read tool at offset:S, limit:2000, incrementing offset by 2000 until done></file>` (NO newline — unlike formatTextFileBlock).
- **renderInjectedMessage expanded branch** (L672-689): ALREADY has the 3-tier body resolution (offset slice → d.body → bodies[i]) — **P1.M2.T1.S2 is LANDED**. After the body-render `if (body !== undefined && d.kind !== "image") { … }` block (L678-682), there is NO directive child. My task ADDS it.
- **Suite: 147 passed, 0 failed.**

## The two sibling tasks I compose with (both in P1.M2.T1)

- **P1.M2.T1.S2 (LANDED — the renderer offset tier):** renderInjectedMessage L672-689 now resolves the body via
  `(d.contentStart != null && d.contentLen != null && typeof message?.content === "string") ? message.content.slice(…) : (typeof d.body === "string" ? d.body : bodies[i])`.
  REND-11(b) rewritten to be forward-compatible (asserts on rendered output + simulates computeDetailOffsets).
  REND-OFFSET added (tier-1 in isolation). My render edit goes AFTER this body-resolution block — purely additive, no overlap.
- **P1.M2.T1.S1 (IN FLIGHT / being re-planned — declares directive? + removes body + adds offsets):** per its
  research notes (the de-facto contract; its PRP is being re-planned after a halt on the REND-11(b) conflict):
  - FileDetail gains `directive?: string`, `contentStart?: number`, `contentLen?: number`; `body?` KEPT (deprecated).
  - emitText removes the 3 `body:` pushes (L895 inline, L919 sub-head, L927 paged).
  - before_agent_start hoists content + calls `computeDetailOffsets(blocks, details)`.
  - emitText does NOT set `directive` (MY task populates it).
  → **MY task's stated dependency: S1 declares `directive?` on FileDetail.** If typecheck errors TS2339 on `d.directive`/`directive:`, S1 hasn't landed — land S1 first (same pattern as S2's dependency on contentStart/contentLen).

## My edits (ADDITIVE — compose with both S1 and S2)

### Edit 1 — emitText paged branch (file-injector.ts L922-926): hoist + store directive
Hoist the directive block into a local; push it; store its INNER text on the detail.
```ts
// CURRENT:
state.blocks.push(formatTextFileBlock(abs, head));
state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines));
state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, body: head });

// AFTER (my edit; composes with S1's later removal of `body: head` — orthogonal fields):
const directiveBlock = formatPagedDirectiveBlock(abs, content.length, startLine, headLines);
state.blocks.push(formatTextFileBlock(abs, head));
state.blocks.push(directiveBlock);
state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, body: head, directive: extractDirectiveInner(directiveBlock) });
```
NOTE: whether `body: head` is present (current) or removed (post-S1), the `directive: extractDirectiveInner(directiveBlock)` addition is orthogonal. The implementer applies the additive `directive:` field + the directiveBlock hoist to whatever shape is in the tree.

### Edit 2 — extractDirectiveInner helper (new, private — file-injector.ts near formatPagedDirectiveBlock)
Strip the `<file name="…">` opener and `</file>` closer to leave the `<paged: …>` inner text.
```ts
/** §6.3 — the INNER text of a paged directive block (the `<paged: …>` resume instructions), for the expanded
 *  view. Strips the wrapping `<file name="…">` opener and `</file>` closer. (formatPagedDirectiveBlock emits
 *  `<file name="ABS"><paged: …></file>` with no newline, so the inner is everything between the first `>` and
 *  the last `</file>`.) */
function extractDirectiveInner(block: string): string {
  const open = block.indexOf(">");        // end of '<file name="…">'
  const close = block.lastIndexOf("</file>");
  return open >= 0 && close > open ? block.slice(open + 1, close) : block;
}
```
Private (not exported) — the regression tests cover it via the rendered output (consumer) + the detail field (producer).

### Edit 3 — renderInjectedMessage expanded branch (file-injector.ts AFTER the body-render block ~L682)
Add the directive Text child AFTER the head body renders.
```ts
// AFTER the existing `if (body !== undefined && d.kind !== "image") { … box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0)); }` block:
if (d.kind === "paged" && typeof d.directive === "string") {   // §6.3 — paged directive after the head, expanded view only
  box.addChild(new Text(theme.fg("dim", d.directive), 0, 0));
}
```
This is AFTER S2's body-resolution block (L672-682) — no overlap. `d.directive` requires S1's FileDetail field (stated dep).

### Edit 4 — Mode-A comments
- emitText paged comment (~L909-916): note the directive is now captured + stored on the detail for the expanded view (§6.3).
- FileDetail `directive?` field comment: note it is rendered in the expanded view per §6.3 (populated by emitText paged branch).

## Test design (file-injector.test.mjs)

- **REND-PAGED-DIR** (CONSUMER — primary regression, per contract §4): craft a paged detail with `directive` +
  content; render expanded; assert the directive text appears as a child AFTER the head body. Independent of S1
  + paging fixtures (crafts the detail directly, like REND-OFFSET). Place AFTER REND-OFFSET (L2731), before Summary.
- **ISS3-DIRECTIVE** (PRODUCER — integration): force paging via `PAGED_FIX` (L412) + `#@huge.log`; assert the
  paged detail carries `directive` as a string containing `<paged:` (tests emitText + extractDirectiveInner).
  Robust to S1 (asserts `d.directive`, not `d.body`).

## Placement / no-conflict
- emitText paged branch: my directiveBlock hoist + `directive:` field are ORTHOGONAL to S1's `body:` removal. Compose cleanly.
- renderer expanded branch: my directive `if` block is AFTER S2's body-resolution block (LANDED). No overlap.
- FileDetail: `directive?` declared by S1 (stated dep). My task does NOT re-declare it (avoid merge conflict).
- Tests: REND-PAGED-DIR after REND-OFFSET (REND/offsets/directive cluster); ISS3-DIRECTIVE near the PD-* paged cluster (L1059+) or the ISS2-* cluster S1 adds. Distinct regions → no merge collision with S1's ISS2-* or S2's REND-OFFSET.

## Gates
- `npm run typecheck` → 0 errors (--strict). REQUIRES S1's `directive?` on FileDetail (TS2339 if absent → land S1 first).
- `node ./file-injector.test.mjs` → 0 failed (baseline 147 + REND-PAGED-DIR + ISS3-DIRECTIVE; REND-*/PD-* unchanged).
- `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` → 0 failed (unchanged — they don't render paged).
- `git diff --stat`: file-injector.ts + file-injector.test.mjs only.

## No docs beyond Mode-A code comments
Item §5: Mode-A comments on emitText paged + FileDetail directive?. No README (P1.M3.T2.S1). PRD read-only.
