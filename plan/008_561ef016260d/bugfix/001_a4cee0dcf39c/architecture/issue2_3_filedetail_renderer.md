# Issues 2 & 3 — `FileDetail.body` duplication (§12.22) + paged expanded-view directive (§6.3)

Both issues live in the `FileDetail` → `emitText` → `renderInjectedMessage` data path. They are
coupled: Issue 2 changes what `FileDetail` carries, Issue 3 adds what the paged detail must carry.
They should be fixed together because both touch the same `FileDetail` interface and the same
renderer expanded branch.

---

## The `FileDetail` interface (`file-injector.ts:336-348`)

```ts
export interface FileDetail {
  path: string;
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;
  lines?: number;
  range?: string;          // paged: ":<startLine>-…"
  pagedHeadLines?: number; // paged: complete lines delivered in head
  dimensionHint?: string;  // image
  body?: string;           // ← ISSUE 2: the EXACT file body (text whole / paged head). Renderer-only.
}
```

The `body` field (lines 344-348) stores the **EXACT** string embedded in the block (whole content for
`text`; the head slice for `paged`). It was added to fix **BUG-1**: a file whose own content contains a
literal `</file>` makes the renderer's `FILE_BLOCK_RE` lazy capture truncate at the INNER `</file>`, so
re-parsing `message.content` mis-truncates. Storing the exact body lets the renderer display correctly
without re-regexing. BUT it duplicates every deliverable file's bytes into `details`, which:

1. Violates **§12.22** (PRD line 1327): "Do **not** duplicate file bytes into `details`."
2. Violates **§6.2** (PRD line 479): "the **bytes** live in `content`...never duplicated."
3. ~Doubles session storage for injected files (the custom message is persisted + re-sent on reload).

### Reproduction (verified)
```
injectFiles("#@data.ts")  // data.ts = "const payload = 'xxx...';\n" (~4 KB)
details[0].body === content bytes  → true   (4020 B duplicated)
detail keys: path,kind,chars,lines,body
```

---

## Issue 2 fix — option (a): store offset+length into `content`, not the body string

Replace `body?: string` with **`contentStart?: number` + `contentLen?: number`** — a byte/char offset
and length into `message.content` (the joined blocks string). The renderer slices
`message.content.slice(start, start+len)` to recover the exact body. This preserves BUG-1 correctness
(the slice is exact, not regex-derived) AND satisfies §12.22 (no duplicated bytes — just two integers).

### Why option (a) over (b) (keep body, document the deviation)
§12.22 is an explicit, emphatic "do NOT duplicate." Option (b) leaves a known storage-cost deviation in
shipped code. Option (a) is the PRD-compliant fix and is low-risk: the offset/length are computed from
the same `content`/`head` strings `emitText` already holds.

### Where the offset comes from
`emitText` does NOT know `message.content` (it pushes into `state.blocks`). The final `content` is
`blocks.join("\n\n")` assembled in the `before_agent_start` handler (line 1213). Two implementation paths:

- **(Preferred) Compute offsets post-hoc in the handler.** After `blocks` is finalized, compute
  `content` and, for each detail, find its block's `[start, start+len)` within `content`. Because blocks
  are joined by `"\n\n"`, a running offset accumulator over `state.blocks` (with `+2` between blocks)
  yields each block's start; the block's own length is `block.length`. The detail must record WHICH
  block index(s) it owns: text=1 block, paged=2 blocks (head + directive). Store `contentStart`/`contentLen`
  for the **body-bearing block** (the head block for paged, the single block for text).
- The renderer expanded branch slices `message.content.slice(contentStart, contentStart+contentLen)`.

### Detail↔block alignment (critical correctness constraint)
- A **text/inline** file = 1 block + 1 detail.
- A **paged** file = 2 blocks (head `<file>` + `<paged:>` directive) + 1 detail.
- An **image/binary** file = 1 block + 1 detail (NO body — these are skipped in the expanded view).
So when computing offsets, map detail→block by emission order, accounting for paged's 2-for-1.
`emitText` already pushes the paged detail ONCE after pushing BOTH blocks (line 914-916), so a
block-counter that increments per `state.blocks.push` lets the detail record its head-block index.

### FileDetail change
```ts
export interface FileDetail {
  path: string;
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;
  lines?: number;
  range?: string;
  pagedHeadLines?: number;
  dimensionHint?: string;
  directive?: string;        // ← ISSUE 3: paged-only; the <paged: ...> directive text, for expanded view
  contentStart?: number;     // ← ISSUE 2: char offset of this file's body block within message.content
  contentLen?: number;       // ← ISSUE 2: char length of the body block (the <file>…</file> INNER text)
}
```
(Remove `body?: string`.) Image/binary details omit `contentStart/contentLen` (no displayable body —
unchanged from today's `body` omission). `directive` is set ONLY for `kind === "paged"`.

---

## Issue 3 fix — store the paged-directive text and render it in the expanded view

### The gap (confirmed)
A paged file emits 2 blocks: head (`<file name="abs">\n<head>\n</file>`) + directive
(`<file name="abs"><paged: N chars; head delivered M complete lines; read the rest …></file>`).
The directive block reaches the **model** via `content` (line 1213), but the renderer's expanded branch
(line 665) reads only `detail.body` (the head). The directive text is never surfaced in the expanded
view, contradicting **§6.3** (PRD lines 507-508): "Paged files show their head block **plus the
paged-directive text verbatim**."

### Reproduction (verified, forced paging with a 50 KB file + tight budget)
```
injectFiles("#@huge.log")  // paged
detail.kind: paged, detail.range: :1-, detail has 'directive' field? false
blocks: 2 (head + directive); content has <paged:? true
detail keys: path,kind,chars,range,pagedHeadLines,body   (no directive)
```

### Fix
1. `emitText` paged branch (line 916): capture the directive string produced by
   `formatPagedDirectiveBlock(...)` into the detail (`directive?: string`) instead of only pushing it
   to `state.blocks`. The directive is ALREADY computed (line 915) — store a reference.
2. `renderInjectedMessage` expanded branch (line 665-667): after rendering the head body, if
   `d.kind === "paged"` and `d.directive` is set, append the directive text (the INNER text of the
   `<paged: …>` block) as an additional rendered line. The directive's inner text is
   `<paged: N chars; head delivered M complete lines; read the rest with the read tool at offset:S,
   limit:2000, incrementing offset by 2000 until done>`.

### Renderer change shape (`file-injector.ts:664-670`)
```ts
if (opts.expanded) {
  const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
    ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)   // ISSUE 2 fix
    : (typeof d.body === "string" ? d.body : bodies[i]);                     // fallback for old/test entries
  if (body !== undefined && d.kind !== "image") {
    const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
    const rendered = lang ? highlightCode(body, lang).join("\n") : body;
    box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
  }
  if (d.kind === "paged" && typeof d.directive === "string") {               // ISSUE 3 fix
    box.addChild(new Text(theme.fg("dim", d.directive), 0, 0));
  }
}
```
The `body` fallback (old `d.body` / regex `bodies[i]`) is retained for the REND-* unit tests and
old/foreign entries (defensive rendering, §6.3), so the change is backward compatible.

---

## Blast radius

- **`emitText`** (lines 878-927): 3 detail-push sites. Text pushes add `contentStart/contentLen`
  (computed post-hoc) — or record block index for later offset computation. Paged push adds `directive`.
- **`renderInjectedMessage`** (lines 631-671): expanded branch reads `contentStart/contentLen` (Issue 2)
  + appends `directive` (Issue 3). Keep `bodies[]` regex fallback for old entries.
- **`before_agent_start` handler** (lines 1206-1220): compute `content` then post-process details to
  fill `contentStart/contentLen` from the block-offset accumulator. This is the cleanest place because
  `content` is assembled here.
- **`FileDetail` interface** (lines 336-348): add `directive?`, `contentStart?`, `contentLen?`; remove
  `body?` (or keep it deprecated for test compatibility — see note).
- **Tests**: `file-injector.test.mjs` has renderer unit tests (REND-*) that pass crafted details. These
  may use `body` — verify and update to `contentStart/contentLen` OR keep a `body` fallback. The PRD's
  §6.3 "defensive rendering" clause supports keeping a fallback, so the safest plan keeps `body` as an
  optional deprecated field used only by the fallback path, while real emission uses offsets. **Decision:
  keep `body?` as a deprecated fallback field to preserve test compatibility and defensive rendering;
  add the offset fields for real emission; this is the lowest-risk path.**

## Test impact
- `file-injector.test.mjs`: add a case asserting `details[i]` for a real injected file does NOT carry a
  `body` equal to `content` bytes (it should carry offsets), and a renderer case asserting the expanded
  paged view includes the directive text.
- A nested-`</file>` regression case (BUG-1) must STILL pass under the offset approach (the slice is
  exact regardless of inner `</file>`).
