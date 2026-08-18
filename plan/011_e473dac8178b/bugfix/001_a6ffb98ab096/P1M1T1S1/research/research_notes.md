# Research Notes — P1.M1.T1.S1 (bugfix 001_a6ffb98ab096): computeDetailOffsets offsets for kind "url"

## Mission
The first slice of BUG-001 (Major, display-only): the expanded chat view mis-pairs bodies after a paged file —
a paged delivery emits TWO blocks (head + directive) but ONE detail, so a following url/binary detail falls to
the renderer's tier-3 `bodies[i]` fallback which indexes BLOCKS while `i` counts DETAILS → the url body shows
the `<paged: …>` directive. Root: `computeDetailOffsets` (:475) only processes text/paged. **S1 = extend the
skip-guard to also process `kind:"url"`** (its block is body-bearing, identical envelope to text — NO math
changes). Binary is S2 (its block is NOT body-bearing — needs the no-newline branch); the renderer tier-3
fallback is S3. TDD: write REND-PAGED-URL RED first.

## Baseline (MUST stay green)
- `node ./file-injector.test.mjs` → **180 passed**; relative-imports 38; import-behavior 23; **url-injection 38**
  (a 4th suite now) = 279 total. `npm run typecheck` → 0 errors. file-injector.ts 1932 lines; test 3577.

## Verified landmarks (file-injector.ts)
- **:475 THE SKIP-GUARD (the edit site)**: `if (d.kind !== "text" && d.kind !== "paged") continue; // image/binary/F5 — no displayable body`
  → becomes `if (d.kind === "image" || d.kind === "binary") continue;` (process text/paged/**url**; F5 is kind
  "image" so `kind === "image"` still covers it).
- **:481-499 the while-loop scan (UNCHANGED)**: pairs via `blockPath(blk)` (:441-445, `/^<file name="([^"]+)">/`
  — works for URL names); body-bearing test `blk.charCodeAt(openEnd) === 0x0A` (:489); `headerLen = openEnd+1`,
  `closerLen = "\n</file>".length`, `bodyLen = blk.length - headerLen - closerLen` (:490-493); the paged-directive
  block fails 0x0A → skipped (UNCHANGED behavior).
- **:833-835 `formatUrlBlock`**: `'<file name="' + url + '">\n' + content + '\n</file>'` — **byte-identical
  envelope to formatTextFileBlock (:366-370)** → the existing math already pairs url blocks. The ONLY blocker
  was the guard.
- **:986 the url detail push**: `state.details.push({ path: url, kind: "url", chars: body.length })` alongside
  `state.blocks.push(formatUrlBlock(url, body))` (:985).
- **:456-461 computeDetailOffsets JSDoc** (Mode-A site): the sentence "Image/binary/F5 details have no displayable
  body and are skipped." → update to reflect url now processed; binary via S2's note branch.
- **:564-569 FileDetail.contentStart/contentLen field comments** (Mode-A site): "(text/paged only; image/binary
  omit)" → "(text/paged/url; image/binary omit — binary via the note branch, P1.M1.T1.S2)".
- SEP at :463 is `"\n\n"` (the previously-fixed 2-char form) — UNCHANGED.
- The renderer: `renderInjectedMessage` (:1025-1082) tier-1 = contentStart/contentLen slice; tier-3 = `bodies[i]`
  (:1065-1067) — the mis-pairing S1 eliminates for url (S3 makes tier-3 path-aware for any残り cases).

## Cursor-logic trace (why the fix is safe with NO math changes)
blocks = [pagedHead(P), pagedDirective(P), urlBlock(U)]; details = [paged(P), url(U)]:
1. paged detail (path P): bi=0 → blocks[0] path P matches, 0x0A body-bearing → pairs head, `cursorByPath.set(P, 1)`, break.
2. url detail (path U): bi=0 (no cursor for U) → blocks[0] path P≠U skip; blocks[1] path P≠U skip (directive never
   pairs — different path from U AND fails 0x0A); blocks[2] path U, 0x0A body-bearing → pairs, offsets computed.
Different paths → separate cursors; no interference. Same-path duplicates (impossible across distinct files per
the JSDoc) unchanged.

## The exact change (ONE guard line + its comment + 2 Mode-A doc sites)
```diff
-    if (d.kind !== "text" && d.kind !== "paged") continue; // image/binary/F5 — no displayable body
+    if (d.kind === "image" || d.kind === "binary") continue; // no displayable body (F5 is kind "image");
+                                                             // url blocks ARE body-bearing (formatUrlBlock ≡ formatTextFileBlock envelope)
```
Plus:
- JSDoc (:456-461): "…skipped" sentence → url details now get offsets too (body-bearing, same envelope as text);
  binary remains skipped here and lands via the note branch in P1.M1.T1.S2.
- contentStart/contentLen field comments (:564-569): "(text/paged/url; image/binary omit — binary via the note
  branch, P1.M1.T1.S2)".

## The test (TDD RED-first; label REND-PAGED-URL — free, verified; place in the REND cluster after REND-MULTI-OFFSET ~:2801)
Follows REND-MULTI-OFFSET (:2778-2801): crafted literals + `mod.computeDetailOffsets` + a render E2E via
`mod.renderInjectedMessage(msg, {expanded:true}, REND_THEME)` (REND_THEME at :2586; textOf helper exists).
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
  // (a) THE regression assertion — the url detail's offsets recover ITS body, not the directive.
  const sliceUrl = content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen);
  assert(sliceUrl === urlBody, `url offset slice must be the exact URL markdown, got ${JSON.stringify(sliceUrl.slice(0, 60))}`);
  assert(!sliceUrl.includes("<paged:"), "url body must NOT be the paged directive");
  // (b) paged pairing unchanged (head block; directive skipped by the 0x0A test).
  const slicePaged = content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen);
  assert(slicePaged === head, `paged head slice unchanged, got ${JSON.stringify(slicePaged.slice(0, 40))}`);
  // (c) E2E through the renderer — locate the url READ line, then assert the NEXT child is the markdown.
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const kids = expanded.children.map(textOf);
  const urlLineIdx = kids.findIndex((t) => t.includes("read") && t.includes("example.com"));
  assert(urlLineIdx !== -1, "the url read line must be present");
  const urlBodyChild = kids[urlLineIdx + 1];
  assert(urlBodyChild.includes("Extracted page markdown"),
    `the child after the url read line must carry the markdown, got ${JSON.stringify(String(urlBodyChild).slice(0, 80))}`);
  assert(!String(urlBodyChild).includes("<paged:"), "the url body child must not be the directive");
});
```
**RED on current code (both paths)**: the guard skips the url detail → `details[1].contentStart` undefined →
`content.slice(undefined, NaN)` → sliceUrl is NOT === urlBody → (a) fails. Renderer: the url detail falls to
tier-3 `bodies[1]` (the directive inner) → the url body child shows `<paged:` → (c) fails. **GREEN after**:
tier-1 offsets pair the url block exactly.
NOTE (c)'s index-robust locate (`findIndex` on the read line) tolerates the paged detail emitting extra children
(read line + head body + directive text per REND-PAGED-DIR) — do NOT hardcode child indices.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ Binary offsets (kind-gated no-newline note branch) = **S2**.
- ❌ Renderer tier-3 path-aware bodies (replacing bodies[i]) = **S3**.
- ❌ BUG-002/003/004/005 = **P1.M2/P1.M3**.
- ❌ README sweep = **P1.M4.T6**.
- ✅ S1 = the :475 guard + its comment + the 2 Mode-A doc sites + the REND-PAGED-URL test. NO math changes; NO
  new exports; computeDetailOffsets signature unchanged; SEP :463 unchanged; the while-loop scan unchanged.

## DOCS: Mode A (rides with S1)
- computeDetailOffsets JSDoc (:456-461): url now processed (body-bearing, same envelope); binary skipped here,
  lands via S2's note branch.
- FileDetail.contentStart/contentLen comments (:564-569): "(text/paged/url; image/binary omit — binary via the
  note branch, P1.M1.T1.S2)".
- NO README change (P1.M4.T6 sweeps).