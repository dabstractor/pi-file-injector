# BUG-001 Research — Renderer body misalignment after a paged file (pi-file-injector)

Repo: `/home/dustin/projects/pi-file-injector` — single-file TS extension `file-injector.ts` (1932 lines + final blank = 1933 per `wc -l`).
All line numbers below are verified against the current working tree via `grep -n` / `sed -n`.

---

## Summary

The expanded chat renderer (`renderInjectedMessage`, `file-injector.ts:1025-1082`) resolves each `FileDetail`'s body with a 3-tier fallback: (1) `contentStart`/`contentLen` offset slice, (2) deprecated `d.body`, (3) regex-recovered `bodies[i]`. `computeDetailOffsets` (`file-injector.ts:462-513`, called from the `before_agent_start` handler at line 1855) only populates `contentStart`/`contentLen` for details of `kind === "text"` or `kind === "paged"` (skip guard at line 475). A **paged** delivery emits TWO `<file>` blocks (head + `<paged: …>` directive) but only ONE detail, so for any message that mixes a paged file with later `url` or `binary` details, the details array and the blocks/bodies array diverge by one — and the tier-3 fallback `bodies[i]` (lines 1065-1067) indexes **blocks**, not **details**, so the url/binary detail renders the *paged directive text* (or whatever block lands at its detail index) as its body. Display-only: the model-facing `message.content` (blocks join) is unaffected.

Kinds that render a body but lack offsets: `url` (line 986) and `binary` (line 1369). `image` (local 1342, URL 934, F5-empty 1322) also lacks offsets but the renderer never renders a body for `kind === "image"` (guard at line 1068), so images are visually safe — though their blocks still occupy a `bodies[]` slot (misalignment is masked only because image bodies are skipped).

Recommended minimal fix (evaluated in "Fix design evaluation"): extend `computeDetailOffsets` to `url` (its block is body-bearing, identical shape to text) and `binary` (block is NOT body-bearing — needs the no-leading-`\n` header/closer math), and/or make tier-3 path-aware instead of index-based.

---

## FileDetail kinds inventory

### The type (verbatim) — `file-injector.ts:538-570`

```ts
/** PRD §6.2/§6.3 per-file metadata (one entry per delivered file). Type-only export — interfaces are
 *  erased at runtime by jiti/TS, so this never appears in the module's runtime surface (no guard impact).
 *  ... In S1, emitText pushes `kind: "text"` (whole + sub-head) and `kind: "paged"` entries; image
 *  (`kind:"image"`, dimensionHint) and binary (`kind:"binary"`) entries are added in injectFile in S2.
 *  `kind:"url"` entries (path = the URL itself, no tildify) are pushed by injectUrl ... */
export interface FileDetail {
  path: string; // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged" | "url"; // +"url": producer injectUrl (T2.S1); renderer = readLine url branch (T2.S2, raw URL no tildify). Safe — no exhaustive switch on .kind.
  chars?: number; // text: content length; paged: FULL content length
  lines?: number; // text: total line count
  range?: string; // paged resume ":N-" OR the user line range ":N" / ":N-M" as DELIVERED — clamped when end > EOF (LR-5; read-tool style)
  pagedHeadLines?: number; // paged: complete lines delivered in the head
  dimensionHint?: string; // image: formatDimensionNote(resized) — UNUSED in S1 (image is S2)
  body?: string; // ... DEPRECATED fallback (old/test entries; renderer prefers contentStart/contentLen).
                 //   Real emission does NOT set this (§12.22 — P1.M2.T1.S1 removes the body pushes).
  directive?: string; // §6.3 paged-only — the <paged: …> directive INNER text ...
  contentStart?: number; // §12.22 — char offset of this file's body within message.content (text/paged only; image/binary omit) ...
  contentLen?: number; // §12.22 — char length of the body slice (text: whole content; paged: the head).
}
```

**Possible kinds: exactly five** — `"text" | "image" | "binary" | "paged" | "url"`. No others (comment: "The kind union is forward-looking").

### Every `state.details.push` site (8 total)

| # | Line | Kind | Producer | Block shape pushed alongside |
|---|------|------|----------|-------------------------------|
| 1 | 986 | `"url"` | `injectUrl` (fetched-markdown / raw-text URL) | `formatUrlBlock` — **body-bearing** |
| 2 | 934-938 | `"image"` | `injectUrl` image path (URL image) | `formatImageBlock` — not body-bearing |
| 3 | 1322 | `"image"` | `injectFile` F5 (0-byte image) | `formatEmptyImageBlock` — not body-bearing |
| 4 | 1342 | `"image"` | `injectFile` local image | `formatImageBlock` — not body-bearing |
| 5 | 1369 | `"binary"` | `injectFile` binary | `formatBinaryBlock` — not body-bearing |
| 6 | 1438 | `"paged"` | `emitText` ranged-paged branch | head + directive (2 blocks) |
| 7 | 1478 | `"paged"` | `emitText` whole-file paged branch | head + directive (2 blocks) |
| 8 | 1496-1498 | `"text"` | `emitWholeText` (all 4 whole-delivery paths) | `formatTextFileBlock` — body-bearing |

Verbatim quotes:

**Fetched-markdown / raw-text URL detail — line 986** (after `state.blocks.push(formatUrlBlock(url, body))` at 985):
```ts
    state.details.push({ path: url, kind: "url", chars: body.length }); // FileDetail.kind "url" (Task 3)
```

**Image URL detail — lines 932-940** (injectUrl's image branch):
```ts
      state.blocks.push(formatImageBlock(url, resized)); // mirror L972 (name = url)
      state.details.push({
        path: url,
        kind: "image",
        dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined, // mirror L973
      });
```
→ A fetched **image URL gets `kind: "image"`** (NOT `"url"`), with `path` = the absolute `https://…` URL. Only text/html/json/xml/markdown URLs get `kind: "url"`.

**Binary local file detail — line 1369**:
```ts
      const binBlock = formatBinaryBlock(abs);
      state.blocks.push(binBlock);
      state.details.push({ path: abs, kind: "binary" }); // §6.4 — binary detail
```

**Paged details (whole-file branch) — lines 1475-1479**:
```ts
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(directiveBlock);
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${resumeLine}-`, pagedHeadLines: headLines, directive: extractDirectiveInner(directiveBlock) });
```
(The ranged-paged branch at 1435-1439 pushes the identical shape.) **Note: ONE details.push for TWO blocks.push** — the root of the index divergence.

**Text details — `emitWholeText` lines 1494-1498**:
```ts
  state.blocks.push(formatTextFileBlock(abs, content));
  state.details.push(rangeSuffix === undefined
    ? { path: abs, kind: "text", chars: content.length, lines: lineCount }
    : { path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix });
```

**1:1 invariant with count**: the input handler asserts `details.length === injected` in spirit (comment at 1815-1816: "1:1 invariant: details.length === injected (every count++ pairs with exactly one details.push)").

---

## computeDetailOffsets analysis

**Location**: `file-injector.ts:456-513` (JSDoc 456-461; function 462-513). Exported (`export function`).

**Caller**: exactly one — the `before_agent_start` handler registered at `file-injector.ts:1851-1866`:
```ts
  pi.on("before_agent_start", async (_e, _ctx) => {
    if (!pending) return undefined;
    const { blocks, details } = pending;
    pending = null; // clear regardless — one-shot per prompt (a later no-#@ prompt never re-delivers)
    computeDetailOffsets(blocks, details); // §12.22 (P1.M2.T1.S1) — absolute body offsets ...
    return {
      message: {
        customType: "fileInjector.injected",
        content: blocks.join("\n\n"),        // every <file> block → sent to the LLM ...
        display: true,
        details: { files: details },         // renderer metadata ...
      },
    };
  });
```
`pending` is stashed by the `input` handler (line 1829: `pending = { blocks, details };`). The offset math depends on `SEP = "\n\n"` (line 463) matching the `blocks.join("\n\n")` at line 1856 — this was a past bug (SEP length 4 vs join 2; see tests REND-MULTI-OFFSET / REND-MULTI-E2E).

**Full logic (lines 462-513, verbatim key parts)**:

```ts
export function computeDetailOffsets(blocks: string[], details: FileDetail[]): FileDetail[] {
  const SEP = "\n\n";
  // absolute char offset of each block within blocks.join("\n\n")
  const starts: number[] = [];
  let off = 0;
  for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }
```

Cursor pairing (lines 471-477):
```ts
  const cursorByPath = new Map<string, number>();
  for (let di = 0; di < details.length; di++) {
    const d = details[di];
    if (d.kind !== "text" && d.kind !== "paged") continue; // image/binary/F5 — no displayable body
    const p = d.path;
    let bi = cursorByPath.get(p);
    if (bi === undefined) bi = 0;
```

Body-bearing scan (lines 481-499):
```ts
    while (bi < blocks.length) {
      const blk = blocks[bi];
      const hdr = blockPath(blk);
      if (hdr === p) {
        const openEnd = blk.indexOf(">") + 1; // end of '<file name="…">'
        if (blk.charCodeAt(openEnd) === 0x0A) { // body-bearing text/head block
          const headerLen = openEnd + 1;        // include the '\n'
          const closerLen = "\n</file>".length; // formatTextFileBlock appends '\n</file>'
          const bodyLen = blk.length - headerLen - closerLen;
          if (bodyLen >= 0) { // defensive: malformed block → leave detail untouched
            d.contentStart = starts[bi] + headerLen;
            d.contentLen = bodyLen;
          }
          cursorByPath.set(p, bi + 1); // consumed; a following paged directive block has the same path but is skipped below
          break;
        }
      }
      bi++;
    }
```

Post-loop (lines 503-511):
```ts
    if (bi >= blocks.length) {
      // no body-bearing block found for this detail — leave contentStart/contentLen unset; the renderer's
      // tier-2 (d.body) / tier-3 (regex) fallbacks handle it. ...
      cursorByPath.delete(p);
    } else {
      cursorByPath.set(p, bi + 1);
    }
  }
  return details;
}
```

Mechanics summary:
- `starts[i]` = absolute char offset of block i in the joined content (block lengths + 2-char separators).
- `cursorByPath` maps `detail.path → next block index to try`, so a paged detail consumes its HEAD block and leaves the directive block (same path) unmatched; a later detail with the same path would resume after it (dedup makes that impossible in practice).
- **Body-bearing test** (line 489): `blk.charCodeAt(openEnd) === 0x0A` — the char immediately after the `<file name="…">` opener must be `\n`. `formatTextFileBlock`/`formatUrlBlock` emit `'>\n' + content + '\n</file>'`; the directive/image/binary/empty-image blocks have no `\n` after the opener → skipped (for text/paged details) or never pairable (for skipped kinds).
- **Why url/binary were skipped — JSDoc intent** (lines 456-461): "Image/binary/F5 details have no displayable body and are skipped." The design assumed only `text`/`paged` blocks carry displayable bodies; `url` was overlooked even though `formatUrlBlock` (line 833-835) is body-bearing with the exact same shape as `formatTextFileBlock`. The in-line comment (475) says `// image/binary/F5 — no displayable body` — url is not even mentioned, and binary's *note text* is arguably displayable (the renderer currently shows it via tier-3 when aligned).

---

## Renderer 3-tier analysis

**Location**: `renderInjectedMessage` — `file-injector.ts:1010-1082` (JSDoc 1010-1024; body 1025-1082). Private helpers `readLine` (1086-1105), `expandHint` (1107-1109), `tildify` (1112-1115).

**Registration** (custom message renderer contract) — inside `default(pi)` factory, `session_start` handler at lines 1778-1785:
```ts
  pi.on("session_start", async (_e, ctx) => {
    cfg = await readConfig(ctx);
    pi.registerMessageRenderer("fileInjector.injected", (message, opts, theme) =>
      renderInjectedMessage(message, opts, theme));
  });
```
The `customType: "fileInjector.injected"` string (line 1857) is the handshake. `opts: { expanded: boolean }` mirrors the global ctrl+o toggle. Signature: `(message: any, opts: { expanded: boolean }, theme: any) => Component` — `any`-typed deliberately (JSDoc 1010-1013) to avoid importing Theme/CustomMessage.

**FILE_BLOCK_RE — line 1003** (module-level, `g` flag; shared/lastIndex must be reset):
```ts
const FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
```
Note group 1 = the block's path — unused by the current tier-3 (`bodies.push(m[2]…)`), but available for a path-aware fix.

**bodies[] construction — lines 1036-1042**:
```ts
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0; // module regex w/ g flag → reset before the loop
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
      bodies.push(m[2].replace(/^\n|\n$/g, "")); // strip the wrapping newlines from <file>\n…\n</file>
    }
  }
```
`bodies[i]` = the inner of the **i-th `<file>` block in content**, with one leading/trailing `\n` stripped. The lazy `([\s\S]*?)` truncates at an INNER `</file>` (documented BUG-1; tiers 1+2 are the BUG-1-safe paths).

**Green Box + no-details fallback — lines 1045-1053**:
```ts
  const box = new Box(1, 1, (t: string) => theme.bg("toolSuccessBg", t));
  if (files.length === 0) { // defensive fallback (no details — old/foreign entry)
    box.addChild(new Text(theme.fg("toolTitle", theme.bold("read")) + " " +
      theme.fg("dim", "(injected files)") + expandHint(theme), 0, 0));
    if (opts.expanded && typeof message?.content === "string") {
      box.addChild(new Text(theme.fg("toolOutput", message.content), 0, 0));
    }
    return box;
  }
```

**Per-file loop + THE 3-TIER RESOLUTION — lines 1054-1076** (verbatim, the bug locus):
```ts
  for (let i = 0; i < files.length; i++) {
    const d = files[i];
    // one read line per file; expand hint ONCE per box (i===0), matching the [skill] precedent (PRD §6.3)
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? expandHint(theme) : ""), 0, 0));
    if (opts.expanded) {
      // 3-tier body resolution (§12.22 offset → stored body → regex fallback). ...
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body : bodies[i]);
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
  return box;
```

- **Tier-1** (1065-1066a): offset slice `message.content.slice(d.contentStart, d.contentStart + d.contentLen)` — BUG-1-safe, exact.
- **Tier-2** (1066b-1067a): deprecated `d.body` (old/foreign/test entries; real emission stopped setting it).
- **Tier-3** (1067b): `bodies[i]` — **`i` is the DETAIL index but `bodies` is indexed by BLOCK order**. Whenever a preceding detail emitted more blocks than details (only paged: 2 blocks / 1 detail), every later detail's tier-3 lookup is off by one (cumulative: +1 per preceding paged file).
- Images never render a body (1068). Binary renders its body with NO syntax highlight (`lang` undefined, 1069). Paged renders `d.directive` (dim) AFTER the head body (1073-1075).

**readLine() per kind — lines 1086-1105** (verbatim):
```ts
function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const pathPart = theme.fg("accent", tildify(d.path));
  if (d.kind === "binary") {
    return `${title} ${pathPart} ${theme.fg("dim", "(binary — not injected)")}`;
  }
  if (d.kind === "image") {
    return `${title} ${pathPart}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  }
  if (d.kind === "paged") {
    return `${title} ${pathPart}${theme.fg("warning", d.range ?? "")}`;
  }
if (d.kind === "url") {
    // PRD §6 — raw URL (d.path holds the URL), NOT tildified; no range/dimensionHint suffix.
    return `${title} ${theme.fg("accent", d.path)}`;
  }
  // whole text — still show :N / :N-M when the user asked for a line range
  return `${title} ${pathPart}${d.range ? theme.fg("warning", d.range) : ""}`;
}
```
(Note: the `url` branch at line 1098 is mis-indented in source but functional.)

**Paged directive rendering**: not via bodies — the directive block's inner text is pre-extracted at emit time (`extractDirectiveInner(directiveBlock)`, lines 434-440) and stored on the detail as `directive`; the renderer appends it as a dim `Text` child only when `opts.expanded` (1073-1075).

**Concrete misalignment walkthrough** (prompt: `#@huge.log #@data.bin #https://x.dev/doc` where huge.log pages):
- blocks = `[headBlock(huge.log), directiveBlock(huge.log), binaryBlock(data.bin), urlBlock(x.dev/doc)]`; details = `[paged(huge.log), binary(data.bin), url(x.dev/doc)]`.
- computeDetailOffsets: paged pairs with block 0; binary & url skipped (line 475) → no `contentStart`/`contentLen`, no `body`.
- bodies = `[headBody, "<paged: …>" inner, "<binary file — …>" inner, urlDocBody]`.
- Expanded render: binary detail (i=1) tier-3 → `bodies[1]` = **the `<paged: …>` directive text** shown as data.bin's "body". url detail (i=2) tier-3 → `bodies[2]` = **the binary note text** shown as the URL's body. Each subsequent detail shows the previous kind's body (classic off-by-one cascade).

---

## Block emission catalog

All format functions at top of file; shapes verified verbatim:

**`formatTextFileBlock` — lines 366-370** (BODY-BEARING):
```ts
export function formatTextFileBlock(abs: string, content: string): string {
  return '<file name="' + abs + '">\n' + content + '\n</file>';
}
```
Shape: `<file name="ABS">\nCONTENT\n</file>` — one detail per block (kind text or paged-head).

**Paged head + directive emission** — `emitText` whole-file branch lines 1470-1480 (ranged variant 1430-1441): pushes `formatTextFileBlock(abs, head)` THEN `formatPagedDirectiveBlock(...)`, but only ONE details.push (`kind:"paged"`). **TWO blocks / ONE detail.**

**`formatPagedDirectiveBlock` — lines 410-428** (NOT body-bearing):
```ts
export function formatPagedDirectiveBlock(abs: string, len: number, startLine: number, injectedLines: number): string {
  return '<file name="' + abs + '"><paged: ' + len + ' chars; head delivered ' + injectedLines + ' complete lines; read the rest with the read tool at offset:' + startLine + ', limit:' + READ_LIMIT + ', incrementing offset by ' + READ_LIMIT + ' until done></file>';
}
```
Shape: `<file name="ABS"><paged: …></file>` — no `\n` after opener → fails the 0x0A body-bearing test → correctly skipped by computeDetailOffsets, but it DOES occupy a `bodies[]` slot via FILE_BLOCK_RE.

**`formatImageBlock` — lines 371-376** (NOT body-bearing):
```ts
export function formatImageBlock(abs: string, resized: ResizedImage | null): string {
  const hint = resized != null ? formatDimensionNote(resized) : undefined;
  return '<file name="' + abs + '">' + (hint ?? "") + '</file>';
}
```
Shape: `<file name="ABS">HINT</file>` or `<file name="ABS"></file>` — hint (if any) becomes a bodies[] entry; renderer never shows it (image skip).

**`formatBinaryBlock` — lines 377-382** (NOT body-bearing):
```ts
export function formatBinaryBlock(abs: string): string {
  return '<file name="' + abs + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
}
```
Shape: `<file name="ABS"><binary file — contents not injected; use the read tool if needed></file>` — **no body between newline delimiters at all**; the entire inner is a fixed note string. **Has no body** in the `>\n…\n</file>` sense. (One detail per block, kind binary.)

**`formatEmptyImageBlock` — lines 383-390** (NOT body-bearing):
```ts
export function formatEmptyImageBlock(abs: string): string {
  return '<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>';
}
```
F5: one block / one detail (kind image, line 1322). Occupies a bodies[] slot with the note inner; renderer skips (image).

**`formatUrlBlock` — lines 828-835** (BODY-BEARING; private, not exported):
```ts
/** §3.2/§6.1 — the URL injection block. Same `<file name="…">\n…\n</file>` envelope as formatTextFileBlock, ... */
function formatUrlBlock(url: string, content: string): string {
  return '<file name="' + url + '">\n' + content + '\n</file>';
}
```
Shape: `<file name="URL">\nMARKDOWN\n</file>` — **byte-for-byte the same envelope as formatTextFileBlock**, with the URL as the name attr. One block / one detail (kind url, line 986).

**Block/detail cardinality table**:

| Kind | Blocks | Details | bodies[] slots consumed | Renders body in expanded view? |
|------|--------|---------|--------------------------|-------------------------------|
| text | 1 | 1 | 1 | Yes (tier-1 offsets) |
| paged | 2 | 1 | 2 | Yes (head via offsets) + directive child |
| image (local/URL) | 1 | 1 | 1 | No (skipped) |
| image F5 | 1 | 1 | 1 | No (skipped) |
| binary | 1 | 1 | 1 | Yes (tier-3 today — misaligned after paged) |
| url | 1 | 1 | 1 | Yes (tier-3 today — misaligned after paged) |

Only `paged` breaks the 1:1 blocks↔details correspondence. `bodies[i]` is therefore correct ONLY while zero paged details precede index i (and while every detail lacks tier-1/2 hits).

Supporting helpers:
- `extractDirectiveInner` — lines 430-440: slices between the first `>` and the last `</file>`.
- `blockPath` — lines 441-445: `/^<file name="([^"]+)">/.exec(block)` → group 1 = path/URL (works for URLs; only fails if the name contains a `"` — cleanToken'd URL tokens can't, and `\S+` tokens carry no spaces).

---

## Fix design evaluation

### Candidate (a): compute `contentStart`/`contentLen` for url/binary kinds in `computeDetailOffsets`

- **`url`**: trivially safe. `formatUrlBlock` is body-bearing with the exact `>\n…\n</file>` envelope (line 833-835) that the existing 0x0A test (line 489) and `headerLen/closerLen` math (490-491) already handle. The change is one guard edit at line 475 (`if (d.kind !== "text" && d.kind !== "paged" && d.kind !== "url") continue;` — binary handled separately or also added). URL `path` keys `cursorByPath` fine; `blockPath` matches URL names.
- **`binary`**: NOT body-bearing in the newline sense — `formatBinaryBlock` has no `\n` after the opener (line 380-382). Extending the guard alone would make the while-loop skip the binary block (0x0A test fails) → `bi >= blocks.length` → cursor deleted → no offsets → still tier-3. To actually give binary offsets you must add a second branch: if `blk.charCodeAt(openEnd) !== 0x0A` but the block matches `d.path` and kind is binary, compute `headerLen = openEnd`, `closerLen = "</file>".length` (no newline), so the slice is the note inner `<binary file — contents not injected; use the read tool if needed>`. That reproduces exactly what tier-3 shows today when correctly aligned (REND-5 pins the collapsed line; no expanded-binary test pins the body). Feasible, ~6 lines, but touches the pairing loop's core invariant ("body-bearing = 0x0A") which currently double-serves as the "skip paged directive blocks" discriminator. If generalized naively, a `paged` detail's scan could pair with its own DIRECTIVE block (also no 0x0A) — the directive skip depends on the 0x0A test failing. Guard: only apply the no-newline branch when `d.kind === "binary"` (or check the inner starts with `<binary ` / `<empty image `), keeping text/paged pairing unchanged.
- **Scope**: fixes only details from the CURRENT run (offsets computed at publish time). Old persisted messages (no offsets) still hit tier-3 — acceptable per the code's own framing (tier-3 is "last-resort … old/foreign/test").
- **Risk**: small, additive; `computeDetailOffsets` is exported and directly unit-tested (REND-MULTI-OFFSET), so regression coverage exists for the text/paged paths.

### Candidate (b): make tier-3 pair details to blocks with path-aware cursor logic

Replace `bodies[i]` with a per-path queue built from the SAME regex scan: group 1 of `FILE_BLOCK_RE` (line 1003) already captures the path, so `bodiesByPath: Map<string, string[]>` (append per match; per-detail pop-with-cursor mirrors `cursorByPath`). 

- **Fixes all kinds at once** (url, binary, and even old messages with no offsets) and removes the detail-index↔block-index coupling entirely.
- **Edge: same URL/path injected twice** — impossible within one run: `injectedSet` dedup (files: claimKey at injectFile 1259-1261; URLs: normalized-abs check at lines 1655-1660 `if (!state.injectedSet.has(abs))`) means a path appears at most once in details. But a path CAN appear twice in bodies[] (paged head + directive). With path-keyed queues, a `paged` detail pops the head body and the directive inner stays queued — harmless, since no other detail shares that path. (A path-aware tier-3 would also need to skip the `<paged:` inner for paged details, or accept it's never popped — it isn't, because the paged detail pops only once.)
- **Edge: directive block re-pairing** — with cursor semantics identical to computeDetailOffsets (pop in order), the paged detail consumes the FIRST body for its path (the head), never the directive — provided the queue pops in emission order, which `exec` loop guarantees.
- **Edge: BUG-1** — tier-3 remains regex-vulnerable (inner `</file>` truncation); path-awareness does not change that (tiers 1+2 remain the safe paths).
- **Risk**: medium — changes renderer control flow for the fallback tier; every REND-* test that relies on `bodies[i]` alignment (REND-6, REND-11(a) uses d.body so unaffected, REND-PAGED-DIR uses d.body) still passes because they use single-file or crafted-body messages, but new dedup assumptions (path uniqueness) become load-bearing.

### Verdict

**(a) for `url` alone is the smallest, safest change** (one-line guard; envelope identical to text; test via a mixed paged+url message). **Binary needs either (a)+a no-newline branch or (b)**; the no-newline branch must be kind-gated so the paged-directive skip logic is untouched. The most robust minimal combination is: (a) add `"url"` to the guard at 475; (a′) add a kind-gated binary branch (`headerLen = openEnd`, `closerLen = 7` when `d.kind === "binary"` and `hdr === p`); leave tier-3 as-is (it stays as the old-message fallback). If the team prefers one mechanism, (b) is the deeper fix but touches the renderer's fallback tier for every kind.

**Other kinds lacking offsets**: `image` (1342 — local, has a real block but no body render), URL-image (934), F5 empty image (1322). None render bodies (guard 1068) → no offsets needed; do NOT add them (their blocks would fail the 0x0A test anyway; only the F5/empty-image inner notes would "pair").

**Additional edge cases for the implementer**:
1. Same URL injected twice → deduped at 1655-1660 (`#example.com` and `#https://example.com` normalize to the same abs). No duplicate url details.
2. Multiple paged files → drift is CUMULATIVE (+1 bodies-slot per paged detail) — a regression test should use paged + TWO body-bearing kinds to pin both shifts.
3. `blockPath` regex (441-445) requires the name attr to contain no `"`; fine for real emissions.
4. `bodies.push(m[2].replace(/^\n|\n$/g, ""))` strips only ONE leading/trailing `\n` — a url detail fix via offsets does NOT strip; slice content is the exact body (better).
5. The post-loop `cursorByPath.set(p, bi + 1)` (line 509) is redundant-but-harmless after an in-loop `break` (line 497 already set the same value).
6. computeDetailOffsets mutates `details` in place and returns them (chaining); idempotent per call (fresh `cursorByPath`).
7. `SEP` (line 463) must stay `"\n\n"` to match the join at line 1856 — the historical drift bug.

---

## Test conventions

**Files**: all renderer/offset tests live in **`file-injector.test.mjs`** (`/home/dustin/projects/pi-file-injector/file-injector.test.mjs`, ~3578 lines). The other three suites (`import-behavior.test.mjs`, `relative-imports.test.mjs`, `url-injection.test.mjs`) contain NO renderer tests — url-injection.test.mjs only mocks `registerMessageRenderer` indirectly via its own jiti harness and has no `render`/`Box`/`Text`/`expand` assertions (only "JS-rendered" SPA-notify prose).

**Relevant test clusters in file-injector.test.mjs**:
- Lines 136-137: module-surface asserts `renderInjectedMessage` and `computeDetailOffsets` are functions; line 148: the export allowlist ("module ships functions not in the sanity list" guard — a fix must NOT add new exports, or must update this list).
- Lines 2577-2584: REND cluster preamble — `REND_THEME` stub (`{ fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t }`), `REND_W = 2000`, and the test seam: `const textOf = (child) => child.render(REND_W).join("\n");` — Box.children is public; Text.text is private so read via `Text.render(width)`.
- REND-1..REND-11, REND-OFFSET (2754), REND-MULTI-OFFSET (2778 — calls `mod.computeDetailOffsets(blocks, details)` directly at 2784), REND-MULTI-E2E (2808 — drives `input` → `before_agent_start` via `captureAllHandlers()`, renderer at 2825), REND-MULTI-3FILE (2830), REND-PAGED-DIR (2855).

**How the TS module is loaded (no transpile step in tests)** — lines 50-72: jiti loaded from the GLOBAL pi install by absolute dynamic import, with pi's own alias map:
```js
const jitiLib = PIPKG + "/node_modules/jiti/lib/jiti.mjs";
const { createJiti } = await import(jitiLib);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const mod = await jiti.import(TS_PATH);
```
→ `Box`/`Text` are the REAL pi-tui components (not mocked); `renderInjectedMessage` returns a real `Box` whose `.children` are real `Text` instances.

**Mock pi factory**: `captureHandler` (line ~172) and `captureAllHandlers` (line 188) stub `registerMessageRenderer: () => {}` and capture `on(event, cb)` handlers; `makeMockCtx(cwd)` (line 165) supplies `ctx: { cwd, hasUI, isProjectTrusted, ui.notify }`.

**Representative renderer test to copy (verbatim, REND-MULTI-OFFSET, lines 2778-2801)** — it is the closest pattern for a "paged + url/binary offsets" test (crafts blocks, calls computeDetailOffsets, renders expanded, asserts exact body slices):
```js
await runCase("REND-MULTI-OFFSET", "§12.22 multi-block offset tier: computeDetailOffsets + expanded render — EACH file's body is exact (the +2/block drift regression)", async () => {
  const block0 = '<file name="/abs/a.ts">\nfunction a() { return 1; }\n</file>';
  const block1 = '<file name="/abs/b.ts">\nfunction b() { return 2; }\n</file>';
  const blocks = [block0, block1];
  const content = blocks.join("\n\n");              // the real assembly (file-injector.ts L1286) — 2-char separator
  const details = [{ path: "/abs/a.ts", kind: "text" }, { path: "/abs/b.ts", kind: "text" }];
  mod.computeDetailOffsets(blocks, details);       // populates contentStart/contentLen (mutates details in place)
  // (a) FIRST file — correct even pre-fix (starts[0]===0). Pins the baseline (if this fails, the test is malformed).
  const sliceA = content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen);
  assert(sliceA === "function a() { return 1; }",
    `a.ts offset slice is exact (starts[0]===0, drift zero even pre-fix), got ${JSON.stringify(sliceA)}`);
  // (b) SECOND file — THE regression assertion. ...
  const sliceB = content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen);
  assert(sliceB === "function b() { return 2; }",
    `b.ts offset slice is exact (NO +2 drift — SEP.length must match the join separator), got ${JSON.stringify(sliceB)}`);
  // (c) END-TO-END through the renderer: expanded view, each body child (odd indices 1 and 3) carries the content.
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const bodyA = textOf(expanded.children[1]);       // [0]=read a.ts (+hint), [1]=body a.ts
  const bodyB = textOf(expanded.children[3]);       // [2]=read b.ts, [3]=body b.ts
  assert(bodyA.includes("function a() { return 1; }"),
    `expanded body child [1] (a.ts) carries the exact content, got ${JSON.stringify(bodyA.slice(0, 80))}`);
  assert(bodyB.includes("function b() { return 2; }"),
    `expanded body child [3] (b.ts) carries the exact content (NO drift), got ${JSON.stringify(bodyB.slice(0, 80))}`);
});
```
For an E2E-style test, copy REND-MULTI-E2E (2808-2828): `makeMockCtx` + `captureAllHandlers()` → `h.input[0]({text, source:"interactive", images:[]}, ctx)` → `h.before_agent_start[0]({}, ctx)` → `mod.renderInjectedMessage(msg, {expanded:true}, REND_THEME)` → `textOf(box.children[…])`.

**How tests run** — `package.json` scripts:
```json
  "scripts": {
    "typecheck": "node ./scripts/typecheck.mjs",
    "test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs",
    "prepublishOnly": "npm run typecheck"
  }
```
Plain node scripts (no framework); each exits 0 on all-pass. `scripts/typecheck.mjs`: resolves the GLOBAL pi install via `npm root -g`, writes a temp tsconfig (`--strict`, `noEmit`, `moduleResolution: Bundler`, `paths` mapping `@earendil-works/pi-coding-agent` → global `dist/index.d.ts`, `pi-ai` → compat.d.ts, `pi-tui` → nested `dist/index.d.ts`), and runs `npx -p typescript@5.6 tsc -p … --listFiles`; exits non-zero on any error.

---

## Risks

1. **Display-only blast radius** (severity: LOW for correctness, HIGH for UX confusion): the model-facing `message.content` is unaffected; only the TUI expanded view mispairs bodies. Collapsed read lines are correct (they use only `FileDetail` fields, not bodies).
2. **Fix (a) binary branch can silently break the paged-directive skip**: the 0x0A test double-serves as "is body-bearing" AND "is not the paged directive block". Any generalization must be kind-gated (only `binary` accepts a no-newline inner) or the paged detail could pair its own directive block.
3. **Tier-3 remains wrong for old persisted messages** under fix (a): historical custom messages (no offsets) still index `bodies[i]` by detail index. Only fix (b) repairs those.
4. **No existing test pins url/binary expanded bodies after a paged file** — the misalignment is currently untested; any fix should add a regression test in the REND cluster (pattern: REND-MULTI-OFFSET / REND-MULTI-E2E with a paged fixture + a binary/URL detail).
5. **Module-surface guard** (file-injector.test.mjs:141-155) rejects unregistered exports — the fix must not add new exports (or must extend the allowlist at line 148).
6. **URL bodies can contain literal `</file>`** (scraped HTML→markdown can) — offset slices are BUG-1-safe; do not regress url details back to regex-only paths.
7. **`highlightCode` on url bodies**: url details use `getLanguageFromPath(d.path)` (line 1069) — a URL path like `…/x.dev/doc` yields no language; harmless, but a path ending `.md` would highlight; existing behavior, unchanged by either fix.
8. **jiti alias dependency**: tests bind to a global pi install; CI environments must have it or all suites fail (pre-existing condition, not introduced by the fix).