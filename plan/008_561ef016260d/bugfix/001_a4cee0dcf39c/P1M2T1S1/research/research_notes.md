# Research Notes — P1.M2.T1.S1 (bugfix 001_a4cee0dcf39c): FileDetail offsets + emitText stops duplicating body + before_agent_start offset computation (Issue 2, §12.22)

**Item:** Eliminate `FileDetail.body` byte duplication (PRD §12.22) by replacing the duplicated body string
with char offsets (`contentStart`/`contentLen`) into `message.content`. Remove `body:` from the 3 emitText
detail pushes. Compute offsets in `before_agent_start` (where `content = blocks.join("\n\n")` is assembled).
Declare `directive?` (populated by P1.M2.T2.S1). Keep `body?` as a deprecated fallback for old/test entries.

---

## 0. The contract — what changes, what stays

- **FileDetail** (file-injector.ts:347) gains `contentStart?: number`, `contentLen?: number`, `directive?: string`.
  `body?: string` is KEPT (deprecated fallback — the REND-* unit tests + old/foreign entries + the renderer
  fallback path still use it; removing it would break the defensive-rendering contract, §6.3/§12.23).
- **emitText** (L889-927): the 3 `body:` pushes are REMOVED — L895 (`body: content` inline), L919 (`body: content`
  sub-head), L927 (`body: head` paged). Real emission carries NO body bytes (§12.22-compliant).
- **before_agent_start** (L1219-1232): `content = blocks.join("\n\n")` is currently INLINE in the return object
  (L1226). Hoist it to a local; then compute offsets via a new exported helper `computeDetailOffsets(blocks, details)`.
- **Renderer** (L662-674): NOT touched by this task (P1.M2.T1.S2 changes it to prefer
  `content.slice(contentStart, contentStart+contentLen)` over `d.body`/`bodies[i]`). My task only ADDS the fields
  the renderer will consume. The field names (`contentStart`/`contentLen`) match the issue2_3 doc's renderer shape.

## 1. The offset math (the crux — derived from block-string LENGTH, BUG-1-safe)

`message.content = blocks.join("\n\n")` (2-char separator between blocks). The body-bearing blocks are text/head
blocks produced by `formatTextFileBlock(abs, content)` = `'<file name="' + abs + '">\n' + content + '\n</file>'`.
So within a block, the body starts at `headerLen` and has length `block.length - headerLen - footerLen`, where:
- **headerLen** = `('<file name="' + path + '">\n').length` — i.e. `<file name="` (12) + path + `">` (2) + `\n` (1) = `15 + path.length`.
- **footerLen** = `'\n</file>'.length` = **8** (constant).

Image/binary blocks have NO displayable body (image: no body shown, attached to user msg; binary: the note IS
the whole inner content but has no `</file>`-wrapped body to offset — handled by the renderer's regex fallback).
So **only text + paged details get contentStart/contentLen**; image/binary get NEITHER (per item §3c).

The cursor walks `details` and `blocks` IN PARALLEL (1 detail ↔ 1 block for text/image/binary; 1 detail ↔ 2
blocks for paged [head + directive]). `blockStart` advances by `block.length + 2` per consumed block (the +2 is
the `\n\n` join separator before the next block; harmless after the last block since no detail reads it then).

```ts
const FILE_HEADER = (p: string) => '<file name="' + p + '">\n';
const FILE_FOOTER_LEN = 8;   // "\n</file>"

export function computeDetailOffsets(blocks: string[], details: FileDetail[]): void {
  let blockStart = 0, blockIdx = 0;
  for (const d of details) {
    const consume = d.kind === "paged" ? 2 : 1;
    if (d.kind === "text" || d.kind === "paged") {
      const headBlock = blocks[blockIdx];                 // the body-bearing block (head for paged)
      const headerLen = FILE_HEADER(d.path).length;
      d.contentStart = blockStart + headerLen;
      d.contentLen = headBlock.length - headerLen - FILE_FOOTER_LEN;
    }
    for (let k = 0; k < consume; k++) blockStart += blocks[blockIdx + k].length + 2;  // +2 for the "\n\n" join
    blockIdx += consume;
  }
}
```

**Worked example (2 text files, paths /x.ts and /y.md, bodies "hello"/"world"):**
- blocks[0] = `<file name="/x.ts">\nhello\n</file>` (len 33). blocks[1] = `<file name="/y.md">\nworld\n</file>` (len 33).
- content = blocks[0] + "\n\n" + blocks[1].
- detail[0] (/x.ts, text): headerLen = 15+5 = 20; contentStart = 0+20 = 20; contentLen = 33-20-8 = 5. → content.slice(20,25) = "hello". ✓
- after detail[0]: blockStart = 0 + 33 + 2 = 35 (start of blocks[1] in content). blockIdx = 1.
- detail[1] (/y.md, text): headerLen = 15+5 = 20; contentStart = 35+20 = 55; contentLen = 33-20-8 = 5. → content.slice(55,60) = "world". ✓

**Paged example (1 paged file /big.log, head "H…", directive D):**
- blocks[0] = head block, blocks[1] = directive block. detail[0] (paged): consume=2; contentStart = 0 + headerLen;
  contentLen = headBlock.length - headerLen - 8 (the HEAD body). The directive block is consumed (cursor advances)
  but NOT offset (the directive text is surfaced separately by P1.M2.T2.S1 via `d.directive`). ✓

**BUG-1 safety:** a text file whose content is `"x</file>y"` → its block is `<file name="P">\nx</file>y\n</file>`.
The offset slice `content.slice(contentStart, contentStart+contentLen)` = `"x</file>y"` (EXACT — derived from
block LENGTH, not regex). The old regex `FILE_BLOCK_RE` lazy-capture would truncate at the inner `</file>` → `"x"`.
So offsets preserve the BUG-1 fix that `body` was added for, WITHOUT duplicating bytes. ✓

## 2. before_agent_start edit — hoist content + call the helper

```ts
// CURRENT (L1219-1232): content is INLINE in the return.
pi.on("before_agent_start", async (_e, _ctx) => {
  if (!pending) return undefined;
  const { blocks, details } = pending;
  pending = null;
  return { message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } };
});
// AFTER: hoist content; compute offsets (§12.22 — offset-based body source, no duplicated bytes).
pi.on("before_agent_start", async (_e, _ctx) => {
  if (!pending) return undefined;
  const { blocks, details } = pending;
  pending = null;
  const content = blocks.join("\n\n");
  computeDetailOffsets(blocks, details);   // §12.22 — fill contentStart/contentLen for text/paged details
  return { message: { customType: "fileInjector.injected", content, display: true, details: { files: details } } };
});
```
`computeDetailOffsets` reads `blocks` (does NOT mutate them — item §3c "Do NOT mutate blocks") and MUTATES
`details` (sets contentStart/contentLen). It is EXPORTED for direct unit-testing of the offset math (the join-
separator accounting + paged-2-block + header/footer lengths are intricate; a focused unit test is far cleaner
than forcing a paged fixture through captureAllHandlers). → module-surface guard sync (sanity + ASSERTED_EXPORTS).

## 3. emitText edits — remove the 3 `body:` pushes

- **L895** (inline whole): `state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, body: content });`
  → drop `, body: content` → `{ path: abs, kind: "text", chars: content.length, lines: lineCount }`.
- **L919** (sub-head fits head slice): same → drop `, body: content`.
- **L927** (paged): `state.details.push({ path: abs, kind: "paged", chars: content.length, range: ..., pagedHeadLines: headLines, body: head });`
  → drop `, body: head`.
- Image (L855) + binary (L868) + empty-image (L842) detail pushes NEVER set body → UNCHANGED.
- The `directive` field is DECLARED in the interface but NOT populated here (P1.M2.T2.S1 populates it).

## 4. FileDetail interface (file-injector.ts:347) — atomic field additions

```ts
export interface FileDetail {
  path: string;
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;
  lines?: number;
  range?: string;
  pagedHeadLines?: number;
  dimensionHint?: string;
  body?: string;              // DEPRECATED fallback (old/test entries; renderer prefers contentStart/contentLen). Real emission does NOT set this (§12.22).
  directive?: string;         // §6.3 paged-only — the <paged: …> directive text for the expanded view (populated by P1.M2.T2.S1; declared here for an atomic interface change).
  contentStart?: number;      // §12.22 — char offset of this file's body within message.content (text/paged only; image/binary omit).
  contentLen?: number;        // §12.22 — char length of the body slice (text: whole content; paged: the head).
}
```

## 5. Test design (file-injector.test.mjs)

`captureAllHandlers` EXISTS (L184) + delivery tests use input→before_agent_start (L2477+). The REND-* tests
(L2567+) call `renderInjectedMessage` DIRECTLY with crafted `body` — they stay GREEN via the renderer's retained
`d.body`/`bodies[i]` fallback (P1.M2.T1.S2 keeps that fallback; my task doesn't touch the renderer). So:

- **ISS2-OFFSET** (UNIT — `mod.computeDetailOffsets` directly with crafted blocks+details): covers
  text-multi (join math), paged (2-block consume, head offset), image (NO offset), + a nested-`</file>` body
  (BUG-1: slice is exact). Asserts contentStart/contentLen per detail + `content.slice(...) === expected body`
  + image has no contentStart.
- **ISS2-NOBODY** (INTEGRATION — `captureAllHandlers`): real `#@data.ts` → drive input → before_agent_start →
  `msg.message.details.files[0]` has contentStart/contentLen, `hasOwnProperty('body') === false`, and
  `msg.message.content.slice(start, start+len) === data.ts content`.
- Module-surface guard: add `computeDetailOffsets` to the sanity list (~L128-139) + `ASSERTED_EXPORTS` (~L140-144).

## 6. Scope / no-conflict guards

- **No conflict with the parallel sibling P1.M1.T1.S2** (TEST-ONLY: rewrites import-behavior 4f, adds ISS1-TL/ISS1-MD
  to file-injector.test.mjs after EDG-4). S1.S2 touches ONLY the two `.mjs` files; my task touches file-injector.ts
  + file-injector.test.mjs (adds ISS2-* cases). Both add cases to file-injector.test.mjs — place ISS2-* in a
  DISTINCT region (near the REND-* cluster or the delivery tests, NOT after EDG-4 where ISS1-* land) to avoid
  merge collision. (The PRP will specify placement near the delivery/REND cluster, ~L2477+ or ~L2661+.)
- **No conflict with P1.M2.T1.S2** (the renderer): it consumes `contentStart/contentLen` + keeps the `body`/regex
  fallback. My field names match its expected shape. I do NOT touch the renderer.
- **No conflict with P1.M2.T2.S1** (directive): it POPULATES `directive` (which I DECLARE here). emitText does NOT
  set directive in my task.

## 7. Gates

- `npm run typecheck` → 0 errors (--strict). The new fields are optional; computeDetailOffsets is straightforward.
- `node ./file-injector.test.mjs` → green (baseline + ISS2-OFFSET + ISS2-NOBODY; REND-* stay green via fallback).
- `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` → green (unchanged — they don't read body).
- `git diff --stat file-injector.ts` shows the FileDetail + emitText + before_agent_start + computeDetailOffsets changes.

## 8. Docs (Mode A — rides with the work)

Update the FileDetail interface JSDoc (L336-348): document contentStart/contentLen as the §12.22-compliant
offset-based body source; mark `body?` as a deprecated fallback for old/test entries; document `directive?`
(paged-only, populated by P1.M2.T2.S1). Cite PRD §12.22 + §6.2. No README change (that's P1.M3.T2.S1).
