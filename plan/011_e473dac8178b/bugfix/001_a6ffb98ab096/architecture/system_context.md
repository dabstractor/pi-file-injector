# System Context — Bugfix changeset 001_a6ffb98ab096 (pi-file-injector)

Synthesized from direct code verification + three scout reports (see sibling files
`renderer_bug001.md`, `injection_bug002_003.md`, `spec_ux_bug004_005.md` for full detail,
verbatim code, and test patterns). Downstream PRP agents MUST read the relevant sibling
file for their bug before planning implementation.

## Project shape

- **Single-file extension**: `file-injector.ts` (1932 lines) at repo root. It is BOTH the
  package main (`package.json` `pi.extensions`) and the only production source. No `src/`.
- **Tests**: 4 standalone zero-dependency ESM harnesses — `file-injector.test.mjs` (~3578
  lines, incl. renderer/REND cluster, LINE-* line-range cluster, A1 autocomplete),
  `import-behavior.test.mjs`, `relative-imports.test.mjs`, `url-injection.test.mjs`
  (DET/FAIL/DIS/CB clusters). No framework: bare `assert` + `runCase(name, desc, fn)`
  matrix, exit 1 on any failure. `npm test` runs all four.
- **Typecheck**: `npm run typecheck` → `scripts/typecheck.mjs` (tsc --strict --noEmit via
  global pi install aliases). PRD states both currently pass — baseline is green.
- **Docs**: `README.md` (221 lines) is the ONLY user doc. `spec/*.md` (17 files) is the
  hand-written feature PRD (source of truth; `SPEC.md` is an index that includes parts via
  `@path`). No CHANGELOG. `plan/` = engineering artifacts (do not treat as docs).
- **External deps**: `@earendil-works/pi-coding-agent` (resizeImage, formatDimensionNote),
  `pi-ai`, `pi-tui` (Box/Text) — optional peerDeps, resolved at runtime by pi's jiti
  (package `main` is the .ts itself).

## Hard invariants for EVERY fix in this changeset

1. **No new exports.** `file-injector.test.mjs:141-155` pins the module surface with an
   allowlist; an unregistered export fails the suite. Fixes must be in-place edits.
2. **Test label collisions.** Existing case labels `BUG-001`/`BUG-002` (file-injector.test.mjs
   ~3308, url-injection DIS-1b/DIS-3) refer to OLDER, different bugs. New regression labels
   MUST be unique — approved names: `REND-PAGED-URL`, `REND-PAGED-BIN`, `REND-TIER3-PATH`,
   `MD-LR3`, `URL-IMG-EMPTY`, `A1-NONAT`, `DET-FTP`.
3. **Model-facing `message.content` must not change.** All 5 bugs are display/robustness/
   spec-parity; BUG-003 changes `state.images` only in the empty-body case (which is
   provider-rejected today). Everything else must keep the LLM-visible bytes identical.
4. **Implicit TDD**: every subtask = failing test first, then fix, then suite green
   (`npm test` + `npm run typecheck`).
5. Notify calls must use the `("info" | "warning" | "error")` union (typecheck enforces).

## Verified root causes (line numbers at HEAD, pre-fix)

| Bug | Root cause locus | Nature |
|---|---|---|
| BUG-001 (Major) | `computeDetailOffsets` skip-guard file-injector.ts:475 (only `text`/`paged` get offsets) + tier-3 `bodies[i]` at 1065-1067 indexes BLOCKS (2 per paged file) while `i` indexes DETAILS → url/binary details mis-pair after a paged file | Display-only |
| BUG-002 (Minor) | `injectMarkdown` Step-5 loop 1556-1561 lacks the `rec.invalidRange` guard that `processTokenStream` has at 1234-1237; raw token (e.g. `a.md:0`) leaks into `injectFile` (process-cwd stat, relative block name) and no LR-3 warning fires inside markdown | Robustness/parity |
| BUG-003 (Minor) | `injectUrl` image branch 920-942 lacks the F5 empty-body guard (local path has it at 1308-1323); `readBytesCapped` returns an EMPTY Buffer (not null) for zero-length bodies → empty `ImageContent` attached | Robustness |
| BUG-004 (Minor) | getSuggestions item remap 1904-1908 (mangle at 1906) rewrites non-`@` values to `#@<v>` despite the pass-through comment at 1900-1901; `applyCompletion` (1911-1925) does NOT depend on values starting `#@` | Latent/defensive |
| BUG-005 (Minor) | `URL_SHAPE_RE` at 43 accepts `https?` only vs spec/15 §2.2 line 71 `(https?|ftp)` + §7 line 325; coupled normalization at 1660 (`/^https?:\/\//i`) would mangle ftp → `https://ftp://…` if only the regex changed | Spec parity |

## Approved fix designs (decision records)

- **BUG-001 — two-layer fix** (research verdict, both layers planned):
  1. Extend `computeDetailOffsets` to `kind:"url"` (its `formatUrlBlock` envelope at 833-835
     is byte-identical to `formatTextFileBlock` 366-370 → existing 0x0A body-bearing test +
     header/closer math work unchanged).
  2. Add a **kind-gated binary branch** for `kind:"binary"` (`formatBinaryBlock` 380-382 has
     NO `\n` after the opener; body = whole inner note): when pairing a binary detail, accept
     a matching-path block whose char-after-opener ≠ 0x0A with `headerLen = openEnd`,
     `closerLen = "</file>".length`. The kind-gate is CRITICAL: the 0x0A test double-serves
     as the paged-directive-skip discriminator — a naive generalization would let a paged
     detail pair its own directive block.
  3. Make tier-3 **path-aware** (renderer 1036-1067): `FILE_BLOCK_RE` group 1 (line 1003)
     already captures each block's path; build a per-path FIFO of bodies and pair details by
     path+cursor instead of `bodies[i]`. This repairs OLD persisted messages (session
     resume re-renders them) where offsets never existed.
- **BUG-002** — mirror `processTokenStream`'s exact guard into Step 5, BEFORE the
  `claimKey` re-check: skip `rec.invalidRange` records + emit the byte-identical hasUI-guarded
  warning notify. `ctx` is already injectMarkdown's 4th param (line 1537) — no signature change.
- **BUG-003** — F5 mirror inserted AFTER `if (buf === null) return false;` (923) and BEFORE
  `resizeImage` (925) / the budget check: `buf.length === 0` → push `formatEmptyImageBlock(url)`,
  push detail `{path: url, kind: "image", dimensionHint: undefined}`, subtract note cost,
  `state.count++`, `return true`. (Before resize = no Worker spawn; before budget = F5 parity:
  the note always delivers; `estimateImageTokens(null)===2805` is the wrong cost for 0 bytes.)
- **BUG-004** — item-level pass-through in the 1904-1908 map: non-string / non-`@`-prefixed /
  already-`#@` values returned untouched; only `@…` values get `"#" + v`. No interaction with
  the prefix guard (1902) or applyCompletion (1914/1919).
- **BUG-005** — chosen: **Option A+ (spec-literal gate + coupled-site sync + spec correction)**.
  Extend `URL_SHAPE_RE` to the spec's literal `(https?|ftp)` AND fix the normalization at 1660
  to `/^(https?|ftp):\/\//i` (mandatory — regex-only would mangle `ftp://…` → `https://ftp://…`).
  Runtime outcome stays verbatim (undici throws on ftp → catch at 988-993 → false). Correct the
  factually-wrong spec §7 row 325 parenthetical "(Node supports it)" and sync JSDoc 27-43.
  Rationale: spec defines the SHAPE gate literally; code should match it, and the graceful
  fetch-failure path already exists. Residual cost (spinner fires on a doomed fetch via
  `onUrlFetch` 1663) is honest ("immediately before network egress" — egress IS attempted).

## Documentation plan (per SOW §5)

- Mode A riders (ride with the implementing subtask): BUG-001 → JSDoc on
  `computeDetailOffsets`/`FileDetail` (offsets now cover url/binary). BUG-002 → README
  `## Syntax` "Line range." paragraph (warn-inside-markdown consistency). BUG-003 → README
  `### URLs` Images bullet (empty image URL → note). BUG-004 → code comment + optional
  spec/14 §14.2 one-liner. BUG-005 → JSDoc + spec/15 §2.2/§7/§8 sync.
- Mode B final task: README changeset-level sweep (final task of the final milestone,
  depends on ALL implementing subtasks).

## Test seams (shared, see sibling files for verbatim templates)

- jiti harness (file-injector.test.mjs:24-77): `npm root -g` + aliases to global pi dist;
  real Box/Text.
- ctx mocks: notify-spy arrays `{cwd, hasUI:true, ui:{notify:(m,t)=>notes.push({m,t})}}`;
  headless `hasUI:false`; `FIX = {cwd: TMPDIR}`; `LOW_BUDGET_CTX` for guard-3.
- fetch stubbing: save/restore `globalThis.fetch` in try/finally per case; `makeRes({ct,
  body, status, ok, contentLength})` (url-injection 143-167) — `body:""` is the deterministic
  zero-length-chunk fixture.
- Renderer: `REND_THEME` passthrough stub; `textOf = (c) => c.render(2000).join("\n")`;
  REND-MULTI-OFFSET (2778-2801) direct-offsets pattern; REND-MULTI-E2E (2808-2828)
  input→before_agent_start→render pattern.
- Private functions (`injectMarkdown`, `injectUrl`, `formatUrlBlock`) are NOT exported —
  drive them via `mod.injectFiles(...)`; `URL_SHAPE_RE` not exported → assert via
  `globalThis.fetch` calls (DET pattern).