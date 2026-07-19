# Research Notes — P1.M1.T2.S2 (Verify before_agent_start, computeDetailOffsets, renderInjectedMessage unaffected)

All facts verified first-hand against the working tree at HEAD `d3219d2` ("Return original prompt verbatim").
Working tree: only `plan/009_0d85ac0b1b08/tasks.json` modified (orchestrator) + untracked `P1M1T2S1/` — NO
source edits pending. `npm run typecheck` → **0 errors** (confirmed).

## 0. The headline finding

**All three target functions are UNAFFECTED by the verbatim cascade.** This is a READ-ONLY verification
subtask; the expected deliverable is a VERDICT ("unaffected — no code changes") + the typecheck proof. The
item description (§3a/b/c) is correct on every point; this research re-confirms it against the LIVE tree.

The only open item is T2.S1 (the `text` → `text: event.text` explicitness edit) which is NOT yet landed
(L1265 still reads `text, images`). T2.S1 is a NO-OP at runtime (text already === event.text after T1.S3),
so whether T2.S1 has landed or not, the three target functions are unaffected — they never read the prompt
text in the first place.

## 1. The verbatim cascade state (T1.S1/S2/S3 all LANDED at HEAD `d3219d2`)

Verified by reading the live source:
- **`scanTokens` → `Promise<string[]>`** (L862-867): returns the resolved import absPaths as a string[];
  no marker indices, no prefixLen. Markers are detected ONLY to resolve imports.
- **`processTokenStream` → `Promise<void>`** (L911-917): injects depth-first; returns nothing (no
  resolved-index array).
- **`injectMarkdown`** (L1085-1108): Step 4 is `emitText(abs, content, state)` with the VERBATIM content
  (the `content` param — read from disk, unchanged). The OLD Step 3.5 (strip resolved markers high→low)
  and Step 4 (strip) are GONE. The comment at L1099 confirms: "markers are detected ONLY to resolve
  imports, never stripped." Recursion (Step 5) iterates `absPaths` (the string[]), not stripped records.
- **`injectFiles`** (L1179 count===0, L1188 count>0): returns `text` — the ORIGINAL prompt param —
  verbatim on both paths. `resolvedIdx`/`strippedText` are GONE (`grep -c resolvedIdx|strippedText` → 0).
- **`npm run typecheck` → 0 errors.** ✅ The scanTokens/processTokenStream signature changes type-check
  clean under --strict.

So a markdown file's delivered block now contains the LITERAL `#@api.md` marker (not stripped) — exactly
what the item §3c describes. This verbatim content flows into `state.blocks`, which flows into the custom
message's `content` (via `blocks.join("\n\n")`), which is what all three target functions consume.

## 2. The three target functions — all verified UNAFFECTED

### (a) `before_agent_start` handler (L1273-1290) — consumes ONLY blocks/details
Verified body (quoted key lines):
```ts
pi.on("before_agent_start", async (_e, _ctx) => {
  if (!pending) return undefined;
  const { blocks, details } = pending;              // ← reads ONLY blocks + details from the stash
  pending = null;                                    // one-shot clear
  computeDetailOffsets(blocks, details);             // ← operates on blocks/details ONLY
  return {
    message: {
      customType: "fileInjector.injected",
      content: blocks.join("\n\n"),                  // ← the joined <file> blocks (verbatim markers included)
      display: true,
      details: { files: details },                   // ← renderer metadata
    },
  };
});
```
- The `pending` stash is set in the input handler (L1257): `pending = { blocks, details }`. It carries
  the `<file>` blocks + FileDetail metadata — **NOT the prompt text**. (The prompt text is returned
  separately on the input handler's transform; it never enters `pending`.)
- The handler never references `event.text`, `text`, or any prompt content. It is structurally impossible
  for the verbatim-prompt change to affect this handler.
- The verbatim markers are already IN `blocks` (T1.S2's `injectMarkdown` emitText'd the verbatim content),
  so `content: blocks.join("\n\n")` already contains them — no change needed.

### (b) `computeDetailOffsets` (L353-414) — operates on blocks/details, length-derived offsets
Verified body: the function computes absolute char offsets of each file body within
`blocks.join("\n\n")` via length arithmetic:
```ts
const SEP = "\n\n";
const starts: number[] = [];
let off = 0;
for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }  // ← length-derived
// ...then for each detail, find the matching body-bearing block and set:
//   d.contentStart = starts[bi] + headerLen;
//   d.contentLen   = blk.length - headerLen - closerLen;   (also length-derived)
```
- The offsets are derived from `block.length` and the header/closer lengths — NOT from regex matching the
  body content. So a verbatim `#@api.md` marker inside a block's body simply makes `block.length` a few
  chars larger; `contentLen` auto-adjusts (`block.length - headerLen - closerLen` includes those chars).
  The offsets remain CORRECT with no code change. This is the item §3b claim, confirmed.
- The function touches ONLY `blocks[]` + `details[]`. It never sees the prompt text.

### (c) `renderInjectedMessage` (L739-825) — reads message.content/details, never the prompt
Verified body (key logic):
```ts
export function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component {
  const files: FileDetail[] = message?.details?.files ?? [];           // defensive
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    // tier-3 regex fallback: re-parse bodies from message.content via FILE_BLOCK_RE
  }
  const box = new Box(1, 1, (t) => theme.bg("toolSuccessBg", t));
  if (files.length === 0) { /* defensive fallback */ return box; }
  for (let i = 0; i < files.length; i++) {
    const d = files[i];
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? expandHint(theme) : ""), 0, 0));
    if (opts.expanded) {
      // 3-tier body resolution:
      const body = (d.contentStart != null && d.contentLen != null)
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)   // tier-1: offset slice
        : (typeof d.body === "string" ? d.body : bodies[i]);                    // tier-2/3
      if (body !== undefined && d.kind !== "image") { /* render highlighted/raw */ }
    }
  }
  return box;
}
```
- The renderer reads `message.content` (the joined blocks) + `message.details.files`. It never references
  the prompt text. A markdown block's body now contains the literal `#@api.md` marker — it renders as
  text in the expanded view (tier-1 offset slice includes those chars; tier-3 regex includes them in the
  captured body). This is CORRECT and HONEST: the model sees the same content (the custom message's
  content), so the display matches the model input (PRD §6.3 — the renderer shows "what was delivered").
  No change needed. This is the item §3c claim, confirmed.
- The defensive fallback (`files.length === 0` → single "read (injected files)" line + raw content) is
  UNCHANGED. The `message?.details?.files ?? []` guard still handles old/foreign entries.

## 3. Why the three functions are structurally immune to the verbatim change

The verbatim cascade changed HOW MARKERS ARE HANDLED (strip → keep) inside the INJECTION ENGINE
(scanTokens/processTokenStream/injectMarkdown/injectFiles) and inside the INPUT HANDLER return. The three
target functions operate on a DIFFERENT data stream: the `blocks`/`details` arrays (the file CONTENT),
which the engine produces. They never touch the prompt text (the user's `event.text`), which is the only
thing the verbatim cascade's "strip → keep" change affects.

Concretely:
- The prompt text is returned on the input handler's `transform` (`text`/`event.text`) → stored as the
  user message. None of the three functions read the user message.
- The file CONTENT lives in `state.blocks` → `pending` → `before_agent_start`'s custom message `content`.
  This is what the three functions consume. The verbatim cascade did NOT change how content is built
  (emitText still calls formatTextFileBlock with the content param); it changed only whether IMPORT
  MARKERS WITHIN a markdown file's content are stripped before emitText. T1.S2 made injectMarkdown pass
  the VERBATIM content to emitText (no strip), so the markers are now in the content — but that content
  is then treated identically by computeDetailOffsets (length-derived) and renderInjectedMessage (display
  whatever is in content).

## 4. The verification gate (item §3d)

`npm run typecheck` (scripts/typecheck.mjs runs `tsc --strict`).
- **VERIFIED: 0 errors** at HEAD `d3219d2`.
- The scanTokens→`Promise<string[]>` and processTokenStream→`Promise<void>` signature changes (T1.S1)
  type-check clean. The verbatim injectMarkdown/injectFiles (T1.S2/S3) type-check clean.
- This is the gate: if typecheck passes (it does), the cascade is type-complete and the three functions
  are unaffected (they consume only blocks/details, which still type-check against the unchanged
  `blocks: string[]`/`details: FileDetail[]` shapes).
- T2.S1's pending `text` → `text: event.text` edit (not yet landed) will also type-check clean
  (`event.text` is `string`, matching the transform's `text: string` field) — but it is irrelevant to the
  three target functions regardless (they don't read the prompt).

## 5. Expected outcome + deliverable

Because the three functions are UNAFFECTED (verified by reading their bodies + the typecheck gate), this
subtask's deliverable is:
- **NO code edit** (item §3: "READ-ONLY verification — do NOT modify these functions").
- **DOCS: none — verification-only subtask** (item §5).
- **Verification = `npm run typecheck` → 0 errors** (the gate, item §3d) + a recorded verdict per
  function (item §3a/b/c) confirming it consumes only blocks/details and is unaffected.
- If typecheck passes (it does), **M1 is complete** (item §4: "If typecheck passes, M1 is complete").

The verification gate is NOT a test run (no code changed). It is the typecheck + the structural
confirmation (the three functions' bodies match the item's §3a/b/c descriptions). If — contrary to
expectation — typecheck had failed, that would indicate the cascade was incomplete (a signature mismatch
somewhere); but it passes, so the cascade is complete and M1 is done.

## 6. No-conflict coordination with siblings

- **T2.S1 (parallel, NOT yet landed):** the one-line `text` → `text: event.text` input-handler edit. It
  is a no-op at runtime (text already === event.text after T1.S3). The three target functions don't read
  the prompt, so T2.S1's landing (or not) is irrelevant to T2.S2's verdict. T2.S2 does NOT depend on
  T2.S1 landing first — the verification holds at the current HEAD regardless.
- **P1.M2.T1 (upcoming):** migrates the ~78 stripped-expectation test assertions to verbatim. T2.S2 does
  NOT touch tests. The red suite (from T1.S3's return-shape change) is the P1.M2.T1 handoff — NOT a T2.S2
  concern. T2.S2's gate is typecheck, not the suite.
- **P1.M2.T4 (upcoming):** README verbatim sync. T2.S2 is internal verification — no user-facing doc.

## 7. The item's line numbers vs. the live tree (metadata drift, not a concern)

The item description cites:
- before_agent_start: L1331-1342 → actual L1273-1290 (the handler body is ~17 lines; shifted earlier).
- computeDetailOffsets: L353-423 → actual L353-414 (close; the function is ~61 lines).
- renderInjectedMessage: L739-825 → actual L739-825 (matches exactly).
- input handler stash: L1317 → actual L1257 (`pending = { blocks, details }`).
- before_agent_start consume: L1333-1341 → actual L1277-1289.

These are line-number drifts (the file shifted during T1.S1/S2/S3); the FUNCTIONS themselves are at the
cited names and their BODIES match the item's §3a/b/c descriptions exactly. Place by function NAME
(`grep -n "pi.on(\"before_agent_start\"\|function computeDetailOffsets\|function renderInjectedMessage"`),
not by line number. This is metadata drift, not a content discrepancy.