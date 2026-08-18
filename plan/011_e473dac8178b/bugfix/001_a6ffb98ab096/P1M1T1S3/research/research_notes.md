# Research Notes — P1.M1.T1.S3 (bugfix 001_a6ffb98ab096): Renderer tier-3 fallback — path-aware bodies

## Consumed state (verified this session)

- **S1 LANDED** (commit `21bf4fa`): `computeDetailOffsets` deny-guard now `if (d.kind === "image") continue;`
  (:479) — url pairs through the 0x0A branch unchanged. Test REND-PAGED-URL green.
- **S2 LANDED in working tree** (uncommitted; verified by reading :497-511): deny-guard keeps only image
  skipped; kind-gated `else if (d.kind === "binary")` no-newline branch added (headerLen=openEnd,
  closerLen=7). Baseline now **182/23/38/38** (S2 added 1 test → the 182nd).
- Post-S1+S2: NEW emissions carry contentStart/contentLen for text/paged/url/binary. Only image lacks
  offsets (and never renders a body). **Tier-3 now fires only for OLD persisted / test-crafted entries
  without offsets and without d.body — exactly S3's target.**

## Current code at the S3 site (verbatim, current line numbers — the item contract's numbers
(:1003/:1025-1082/:1036-1042/:1065-1067) predate S1/S2; tree is now 1954 lines)

- `FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g` — **:1025** (module-level, g flag; **group 1
  = path, currently unused**).
- `renderInjectedMessage(message, opts, theme)` — **:1047-1102** (exported; JSDoc :1027-1046; JSDoc line
  :1039 mentions the "`bodies[i] !== undefined` guard").
- bodies build loop — **:1058-1064** (lastIndex reset :1061; `bodies.push(m[2].replace(/^\n|\n$/g, ""))` :1063).
- "BODY derivation (3 tiers…)" function-level comment — **:1049-1057** (Mode A target #1).
- In-loop "3-tier body resolution…" comment — **:1081-1087** (Mode A target #2).
- THE tier resolution — **:1088-1090**:
  ```ts
  const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
    ? message.content.slice(d.contentStart, d.contentStart + d.contentStart + d.contentLen)   // (see note)
    : (typeof d.body === "string" ? d.body : bodies[i]);
  ```
  (exact: `message.content.slice(d.contentStart, d.contentStart + d.contentLen)` then the ternary arm
  `: (typeof d.body === "string" ? d.body : bodies[i]);`)
- image/body guard — **:1091**: `if (body !== undefined && d.kind !== "image")`.
- paged directive child — **:1096-1098**.

## computeDetailOffsets cursor semantics to mirror (:477-530, post-S2)

`cursorByPath: Map<string, number>` = per-path next-block index; details consume their path's blocks **in
emission order**; a paged detail consumes its HEAD (first body-bearing match) and the directive block
(same path, not body-bearing) stays unconsumed. The FIFO equivalent for tier-3: a per-path ARRAY with
`shift()` (pop-from-front) reproduces exactly this in-order consumption — simplest cursor encoding.

## The misalignment S3 fixes (old-message walkthrough)

files=[paged(big.log), binary(note.bin), url(x.dev/doc)], no offsets anywhere, no d.body:
- content blocks: [head(big.log), directive(big.log), binaryBlock, urlBlock] → bodies[] =
  [headBody, "<paged: …>", "<binary file — …>", urlBody].
- Pre-fix tier-3: binary (i=1) → bodies[1] = **"<paged: …>"** (BUG); url (i=2) → bodies[2] = **the binary
  note** (BUG). Drift is +1 per preceding paged file (only paged emits 2 blocks / 1 detail).
- Post-fix: binary pops bodiesByPath["/abs/note.bin"][0] = its OWN note; url pops its OWN markdown. The
  paged detail pops its path's FIRST inner (the head); the directive inner stays queued forever — harmless
  (no other detail shares that path; run-dedup guarantees path uniqueness among details).

## Design decisions (candidate (b) from renderer_bug001.md §Fix design evaluation)

1. **REPLACE `bodies[]` entirely with `bodiesByPath: Map<string, string[]>`** (built in the SAME exec loop,
   using group 1). After the fix nothing consumes `bodies[i]`; a dead array is cruft (strict has no
   noUnusedLocals, but dead code is the anti-pattern). The `body !== undefined` guard at :1091 keeps working:
   `bodiesByPath.get(d.path)?.shift()` → `string | undefined` (missing path OR empty queue).
2. **Pop ONLY in the tier-3 arm, gated on `d.kind !== "image"`**: tiers 1+2 are evaluated first (unchanged
   conditions); the pop happens only when tier-3 is actually consulted AND the detail renders a body.
   Images never pop (their block inner — image hint / F5 note — stays queued, harmless).
3. **Tiers 1 and 2 untouched** — same conditions, same slices. Tier-1 is the BUG-1-safe path (offset slices
   whole past a literal `</file>`); S3 must not regress url/binary details back to regex-only.
4. **BUG-1 caveat stays accurate**: the path-aware tier-3 STILL uses the regex-recovered inners (lazy
   `([\s\S]*?)` truncates at an inner `</file>`) — path-awareness fixes PAIRING, not truncation. Tiers 1+2
   remain the BUG-1-safe paths; comment says so.

## Test plan — REND-TIER3-PATH (TDD: RED first)

Place in file-injector.test.mjs after REND-PAGED-DIR (:2931 region). Pattern: REND-MULTI-OFFSET (craft
blocks + details, call the renderer directly with `{expanded:true}`, read children via
`textOf(child)` = `child.render(REND_W).join("\n")`; REND_THEME/REND_W at :2577-2584).

Old-message simulation — details WITHOUT contentStart/contentLen and WITHOUT d.body:
```js
const pagedHead   = '<file name="/abs/big.log">\nHEAD-CONTENT-LINE-1\nHEAD-CONTENT-LINE-2\n</file>';
const directiveBl = '<file name="/abs/big.log"><paged: 118890 chars; head delivered 212 complete lines; read the rest with the read tool at offset:213, limit:2000, incrementing offset by 2000 until done></file>';
const binaryBl    = '<file name="/abs/note.bin"><binary file — contents not injected; use the read tool if needed></file>';
const urlBl       = '<file name="https://example.com/doc">\nURL-DOC-MARKDOWN-BODY\n</file>';
const content = [pagedHead, directiveBl, binaryBl, urlBl].join("\n\n");
const details = [
  { path: "/abs/big.log", kind: "paged", range: ":213-", directive: "paged: 118890 chars …" },
  { path: "/abs/note.bin", kind: "binary" },
  { path: "https://example.com/doc", kind: "url", chars: 21 },
];
```
Expanded children (7): [0] read big.log:213- +hint · [1] HEAD body · [2] dim directive (d.directive) ·
[3] read note.bin · [4] binary note body · [5] read url · [6] url body.

Assertions (RED pre-fix — binary body shows "<paged:" and url body shows the binary note):
- `children.length === 7`
- textOf(children[1]) includes "HEAD-CONTENT-LINE-1"
- textOf(children[4]) includes "binary file — contents not injected" AND NOT includes "<paged:"
- textOf(children[6]) includes "URL-DOC-MARKDOWN-BODY" AND NOT includes "<paged:" AND NOT includes "binary file"
- textOf(children[2]) includes the directive text (the ONLY child allowed to show it — it's the dim
  d.directive display, not a body)

## Must-stay-green neighbors

- REND-6 (:2649): single text detail, no offsets/body → tier-3; single block → path-pop returns the same
  body as bodies[0]. Passes.
- REND-7 (:2670): image detail, content `<file name="/abs/pic.png"></file>` → no body child; image never
  pops. Passes.
- REND-11 (:2719): uses d.body (tier-2) — untouched. REND-PAGED-DIR (:2934): uses d.body (tier-2) —
  untouched. REND-PAGED-URL (S1) / REND-MULTI-OFFSET / REND-MULTI-E2E: tier-1 offsets — untouched.
- Module-surface allowlist (:141-155): S3 adds NO exports (bodiesByPath is function-local). Must stay green.

## Validation (verified commands)

```bash
npm run typecheck                    # 0 errors (strict only; no noUnusedLocals)
node ./file-injector.test.mjs        # 183 passed (182 + REND-TIER3-PATH), 0 failed
node ./import-behavior.test.mjs      # 23
node ./relative-imports.test.mjs     # 38
node ./url-injection.test.mjs        # 38
npm test                             # chains all four
# structural: grep "bodies\[i\]" file-injector.ts → 0 hits (incl. JSDoc); grep "bodiesByPath" → build + consume sites
```

## Parallel-S2 discipline

S2 owns `computeDetailOffsets` (:467-536); S3 owns `renderInjectedMessage` (:1047-1102) + its comments +
the new test. Disjoint regions — no conflict. S3 must NOT touch computeDetailOffsets or S2's binary branch.