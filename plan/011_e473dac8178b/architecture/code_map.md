# Code Map — verified seams at HEAD `ef57bd0` (all line numbers re-verified)

Primary source: **`file-injector.ts` at the repo root** (1790 lines; NOT `src/`).
Tests: `file-injector.test.mjs` (3332 lines), `url-injection.test.mjs` (1003), `import-behavior.test.mjs`,
`relative-imports.test.mjs`. Docs: `README.md` (221 lines).

## file-injector.ts — constants & helpers (top of file)

| Line | Symbol | Notes |
|---|---|---|
| L88 | `PAGED_THRESHOLD = 0.6` | inject whole if `fileCost <= 0.6 * remaining` |
| L90 | `HEAD_CHARS = 8192` | head block size (UTF-16 units) |
| L92 | `READ_LIMIT = 2000` | read-tool page size quoted in directives |
| L168–169 | `splitLineRange` JSDoc | |
| **L170–177** | `splitLineRange(token)` | regex `/:(\d+)(?:-(\d+))?$/`; **invalid** (`start<1`, `end<start`) returns `{path: token}` — indistinguishable from "no suffix" (LR-3 gap). Valid → `{path, startLine, endLine}` (bare `:N` → `endLine = startLine`) |
| **L183–189** | `sliceLines(content, s, e)` | splits on `\n`, pops final `""` iff content ends with `\n` (wc -l semantics); `startLine < 1 \|\| > parts.length` → `""` (LR-4 signal); else `parts.slice(s-1, e).join("\n")` (end clamps free via Array.slice) |
| **L192–196** | `claimKey(abs, s?, e?)` | bare `abs` \| `abs:N` (when s===e) \| `abs:N-M` — `:N` ≡ `:N-N` (LR-7 OK) |
| ~L393 | `headCompleteLineCount(head)` | newlines in head (complete lines delivered) |
| L411–412 | `formatPagedDirectiveBlock(abs, len, startLine, injectedLines)` | directive text embeds `read the rest with the read tool at offset:<startLine>, limit:2000` |
| — | `headSlice`, `headStartLine`, `extractDirectiveInner`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`, `subtract`, `estimateImageTokens` | the emit-side toolkit; grep for exact lines |

## Notify & ctx seams

| Line | Fact |
|---|---|
| L882, **L956** | SPA-fallback notify (the reference pattern): `if (ctx.hasUI) ctx.ui?.notify(\`…\`, "info"); return false;` |
| **L1105–1112** | `Ctx` type: `getContextUsage?: () => {tokens, contextWindow, percent}`, `hasUI?: boolean`, `ui?: { notify(message: string, type?: "info"\|"warning"|"error"): void }` |
| L1431–1444 | input handler: `getContextUsage` may be undefined/throw → `remaining = null` (O-1) |
| L1661 | `injectFiles(event.text, …)` call in the input handler |
| **L1700** | §5.5 mode-aware notify: `if (ctx.hasUI) ctx.ui.notify(msg, "info")` (driven by `state.paged`) |

## Token pipeline

| Line | Symbol | Contract |
|---|---|---|
| **L1144–1148** | `scanTokens(text, baseDir, opts, state)` — **EXPORTED, no `ctx`** | `opts = {allowAbsTilde, skipCode, tryMdExt, bareAt?}`; returns `{path, startLine?, endLine?}[]` in encounter order |
| L1166–1170 | exact-first resolution | `resolveImportPath(token)` with suffix included — a literal `a.ts:10` file wins whole (LINE-7 seam) |
| **L1171–1180** | range carriage | only if exact fails: `splitLineRange(token)`; treats as range iff `parsed.startLine !== undefined && parsed.path !== token`; **invalid suffixes fall through to "nothing resolved → verbatim"** (LR-3 gap lives here) |
| L1181–1185 | scan dedup | `localSeen` per scan (NOT `injectedSet`); pushes rec |
| **L1195–1215** | `processTokenStream(text, baseDir, opts, state, ctx)` | scan once → per rec: skip if claimed → `injectFile(rec.path, state, ctx, rec.startLine, rec.endLine)`. **This is the ctx-holding caller nearest the LR-3 seam** |
| **L1231–1290** | `injectFile(abs, state, ctx, startLine?, endLine?)` | stat → **claim `claimKey(abs, s, e)` at L1239–1240** → read → classify → emit → `state.count++` (L1284) → `return true`; catch → **un-claim L1287** + `return false` |
| L1247–1253 | F5 empty-image branch | 0-byte image → note block + `{path, kind:"image"}` detail + subtract |
| L1255–1271 | F3 real-image branch | magic-number sniff → resize → `state.images.push({type:"image",…})` + block + detail + subtract. **LR-2: no bare-abs claim today** |
| L1272–1274 | markdown branch | `injectMarkdown(abs, buf.toString("utf8"), state, ctx, startLine, endLine)` |
| L1275–1281 | binary branch | note block + `{path, kind:"binary"}` + subtract. **LR-2: no bare-abs claim today** |
| L1282 | text branch | `emitText(abs, buf.toString("utf8"), state, startLine, endLine)` |

## emitText — the LR-1/LR-5 battleground

| Line | Fact |
|---|---|
| L1291–1298 | JSDoc (inline-vs-paged contract; to be updated for LR-1 — Mode A docs) |
| **L1299** | `emitText(abs, content, state, startLine?, endLine?): void` |
| **L1303–1312** | **RANGE BRANCH (delete/rewrite)** — L1304 comment "Closed ranges are intentional extracts…"; L1305 `content = sliceLines(…)`; **L1306 `rangeSuffix` from REQUESTED lines (LR-5 gap)**; L1307–1311 quadruple copy #1 (push whole, `kind:"text"`, `range: rangeSuffix`, subtract) + early `return` |
| L1315–1322 | whole-file INLINE: `fileCost = ceil(len/4)`, `lineCount`, `remaining === null \|\| fileCost <= PAGED_THRESHOLD*remaining` → whole; quadruple copy #2 |
| L1325–1341 | PAGED: `head = headSlice(content)`; **sub-head guard L1342-ish `content.length <= HEAD_CHARS` → whole** (quadruple copy #3); else head + directive + `kind:"paged"` detail with `range: ':${resumeLine}-'`, `pagedHeadLines`, `directive: extractDirectiveInner(…)`, `state.paged++`, `subtract(ceil(HEAD_CHARS/4))` |
| L1344–1347 | `headLines = headCompleteLineCount(head)`, `resumeLine = headLines + 1` — for slices this becomes `startLine + headLines` (FILE coordinates) |

## injectMarkdown — LR-6 OK / LR-1 & LR-4 interplay

| Line | Fact |
|---|---|
| **L1395–1397** | `injectMarkdown(abs, content, state, ctx, startLine?, endLine?)`; Step 2 idempotent self-claim `claimKey(abs, s, e)` |
| **L1402** | `const body = startLine !== undefined ? sliceLines(content, startLine, endLine ?? startLine) : content` — import scan runs on the slice (LR-6 OK) |
| **L1412** | `emitText(abs, content, state, startLine, endLine)` — **FULL content + range; emitText re-slices** ⇒ emitText-side fixes cover markdown automatically; injectFile-branch-side fixes must be duplicated for the markdown branch |

## State & output shapes

`State = { blocks: string[]; details: FileDetail[]; images: ImageContent[]; injectedSet: Set<string>;
remaining: number | null; count: number; paged: number; bareAt?: boolean }` (see test L696/L1843 literals).
`FileDetail` includes `path`, `kind: "text" | "paged" | "image" | "binary" | …`, `chars?`, `lines?`,
`range?`, `pagedHeadLines?`, `directive?`, `dimensionHint?`. `injectFiles` returns
`{text, blocks, details, images, injected (count), paged, …}` — tests assert on these.

## file-injector.test.mjs fixtures

| Line | Fixture |
|---|---|
| L363 | `FIX = { cwd: TMPDIR }` — no budget → `remaining === null` → inline |
| L415–417 | `PAGED_FIX` — `{tokens:10000, contextWindow:50000, percent:20}` + `model` maxTokens 8192 → remaining 23616, threshold 14169.6; merged-ctx pattern at L1296/1307/1318/1739 |
| L1127–1129 | `TINY_FIX` — 500/6000 → remaining ≤ 0 |
| ~L1563–1713 | existing `huge.log` (~1.83 MB) budget/ordering tests — reuse the fixture for LINE-8 |
| **L2969–3031** | LINE-1…LINE-6 (runCase pattern to extend for LINE-7…12) |
| a.ts | A_TS_CONTENT = 4 lines (`export function add…` / `  return a + b;` / `}` / `// a small TypeScript…`) |

url-injection.test.mjs **L703** — the notify spy: `ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }`.

## README.md

**L127–130** — the "**Line range.**" paragraph; replace **L128** ("Closed ranges inject whole (no paging past
the selection). Images/binaries ignore `:N` / `:N-M`.") with the honest contract. Leave the rest of the file
(deny-list docs, `#@file`/`#<url>` sections) untouched.

## Commands

- `npm test` → 4 test files chained with `&&` (file-injector, import-behavior, relative-imports, url-injection)
- `npm run typecheck` → `node ./scripts/typecheck.mjs`