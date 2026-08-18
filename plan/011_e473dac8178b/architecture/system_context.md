# System Context — Delta 011: Line-Range Gap Closure (LR-1 … LR-5)

**Repo:** `/home/dustin/projects/pi-file-injector` · **HEAD:** `ef57bd0` (verified 2025-08-18)
**Scope:** close the five verified line-range gaps (LR-1…LR-5) in `file-injector.ts`, add regression
gates LINE-7…LINE-12 to `file-injector.test.mjs`, sync `README.md`. **No spec/ edits** (spec is already
synced to the current PRD). **No new external dependencies.**

## 1. What already shipped (do NOT re-implement)

- **Line-range basics** (commits `5c1434e`/`99e82a5`/`ef57bd0`): grammar + trailing-punct trim, exact-path-wins
  resolution retry, `sliceLines` (trailing-newline semantics = `wc -l`), canonical `claimKey` (`:N` ≡ `:N-N`,
  LR-7 OK), `scanTokens` range carriage, `injectFile`/`injectMarkdown`/`emitText` range params, display suffix,
  tests **LINE-1…LINE-6** (passing).
- **LR-6** (markdown import scan runs on the slice): OK — `injectMarkdown` slices the body for the scan (L1402).
- **Entire URL feature + URL-side PRD deltas** (deny-list, dispatch, spinner, `onUrlFetch`): shipped & tested.
  Awareness only; the existing suites guard it — do not regress.
- **Established patterns from sessions 008–010** (still valid, in
  `plan/010_8645157f3bf5/architecture/{code_map,system_context}.md`): verbatim-prompt delivery (never strip
  markers), claim ⟺ delivered (revoke on failure), shared budget accumulator (`subtract`), O-1 fallback
  (`remaining === null` → never page), notify guarded on `ctx.hasUI`.

## 2. The five gaps (all verified at HEAD)

| ID | Gap | Seam (verified line numbers at HEAD) |
|---|---|---|
| LR-1 | Slice bypasses the §5.5 budget/paging decision | `emitText` range branch **L1303–1312** pushes the slice whole unconditionally; comment L1304 "Closed ranges are intentional extracts…" |
| LR-2 | Images/binaries claim `abs:range` → duplicate bytes | `injectFile` claims `claimKey(abs, startLine, endLine)` at **L1239** before classification; image/binary branches never normalize to bare `abs` |
| LR-3 | Malformed `:0` / `:5-3` silently verbatim | `splitLineRange` (**L170–177**) returns `{path: token}` for invalid suffixes — indistinguishable from "no suffix"; no notify anywhere |
| LR-4 | Past-EOF start delivers an EMPTY `<file>` block | `sliceLines` (**L183–189**) returns `""` when `startLine > lineCount`; range branch pushes empty block, `count++` (L1284), claim stays |
| LR-5 | Display shows requested, not delivered range | `rangeSuffix` built from **requested** `startLine/endLine` at **L1306**; `:2-100000` on a 5-line file displays `:2-100000` |

Normative requirement text: `spec/17-line-ranges.md` §5 (LR-1), §6 (LR-3/4/5), §3 (LR-2 claim-by-type),
§10 (gap register + the quadruple-unification code-quality note), §9 (LINE-7…12 definitions).

## 3. Architectural findings a downstream implementer MUST know

1. **`scanTokens` has NO `ctx` parameter** — signature `scanTokens(text, baseDir, opts, state)` (L1144–1148).
   It is also **exported and directly unit-tested** (LINE-5 calls it with a bare `{blocks:[],…}` state, test
   L3008+). Therefore the LR-3 warning notify **cannot** fire inside `scanTokens`; it must be signaled out
   (e.g. an `invalidRange` marker on a returned record or a parallel list) and fired from a ctx-holding caller
   (`processTokenStream` L1195+, which receives `ctx`, or `injectFiles` L1661 area). Any return-shape change
   must keep `scanTokens`' existing exported contract working (update LINE-5 if the shape grows optional fields).
2. **`injectMarkdown` re-slices inside `emitText`** — L1402 slices the body only for the import scan, then
   **L1412 calls `emitText(abs, content, state, startLine, endLine)` with the FULL content**; `emitText`
   re-slices (L1305). Consequence: fixes made inside `emitText`'s range branch automatically cover markdown
   ranged tokens; fixes made only in `injectFile`'s text branch must be duplicated for the markdown branch.
3. **Claim ownership:** `scanTokens` dedups a scan via a local `localSeen` set (L1182–1184) — it does NOT add
   to `state.injectedSet`. Claims are made in `injectFile` (L1239) and re-asserted idempotently in
   `injectMarkdown` Step 2 (L1397). The only revoke site today is `injectFile`'s catch (L1287).
   LR-2/LR-4 add revoke/normalize paths — keep "claim ⟺ delivered" invariant.
4. **LR-2 covers all three non-text branches** of `injectFile`: F5 empty-image (L1247–1253), F3 real image
   (L255–1271 area, actually L1255–1271), binary note (L1275–1281). Dedup must work in **both token orders**
   (`#@pic.png #@pic.png:3` and `#@pic.png:3 #@pic.png`) — the first image/binary token to *classify* claims
   the bare `abs`; the second finds it claimed → emit nothing, no `count++`, token verbatim.
5. **LR-4 detection rule:** a valid start always yields ≥1 line, so past-EOF ⟺ `startLine > lineCount` where
   `lineCount` uses `sliceLines`' trailing-newline semantics (`content.split("\n")` with final `""` popped
   when content ends in `\n`). A 0-byte file has 0 lines → `#@empty.txt:1` is past-EOF. A clamped **end**
   still delivers (recovery, not failure).
6. **LR-5 clamp falls out of the slice:** delivered last line = `startLine + (newlines in slice)` — the slice
   contains `deliveredLineCount − 1` newlines. `:2-100000` on a 5-line file → slice has 3 newlines → `:2-5`.
   Canonical form: delivered start === delivered end → `:N` (not `:N-N`). On the **paged** path the detail
   range is the resume directive `:<resumeLine>-` where `resumeLine = startLine + complete-lines-in-slice-head`
   (FILE coordinates — the read tool must continue at the absolute line of the original file).
7. **Quadruple copies:** the `fileCost`/`lineCount`/`push`/`subtract` quadruple exists **3×** in `emitText` —
   range branch L1307–1311, inline-whole L1318–1322, sub-head-whole L1337–1341. Spec §10 note (normative per
   PRD R1): unify into one helper instead of adding a 4th copy when landing LR-1.
8. **Existing FINDING-1/FINDING-2 machinery is reusable:** `headSlice(content)`, `headCompleteLineCount(head)`
   (~L393), `formatPagedDirectiveBlock(abs, len, startLine, injectedLines)` (L411–412 — directive text embeds
   `offset:<startLine>, limit:2000`), `extractDirectiveInner` (detail.directive). Sub-head guard
   (`content.length <= HEAD_CHARS` → whole, L1342) applies to the **slice length** for LR-1.
9. **Constants:** `PAGED_THRESHOLD = 0.6` (L88), `HEAD_CHARS = 8192` (L90), `READ_LIMIT = 2000` (L92).
10. **Notify pattern (the seam to copy):** SPA fallback `if (ctx.hasUI) ctx.ui?.notify(\`…\`, "info")` (L956);
    §5.5 handler notify `if (ctx.hasUI) ctx.ui.notify(msg, "info")` (L1700). Ctx type: `hasUI?: boolean`,
    `ui?: { notify(message: string, type?: "info"|"warning"|"error"): void }` (L1105–1112). LR-3/LR-4 use
    `"warning"`.
11. **Paged slices count in `state.paged`** → they appear in the existing "N whole, M paged" mode-aware notify
    (L1672–1700). No new notify channel needed for LR-1.

## 4. Line-number drift (PRD citations vs HEAD)

PRD was written against ~the same commit but a few citations drift by 2–9 lines (verified at HEAD):
`splitLineRange` cited L172 → **fn at L170–177**; `sliceLines` cited L183 → **L183–189 ✓**; `claimKey` L192 ✓;
`injectFile` claim cited L1235 → **L1239–1240**; `emitText` range branch cited L1282–1294 → **branch L1303–1312,
fn at L1299**; `injectFile` fn L1231; catch/un-claim L1286–1289. **Always grep, never trust the PRD's line
numbers blindly.**

## 5. Test-harness reality (verified)

- `runCase(id, desc, fn)` harness; `mod.injectFiles(text, [], FIX)` returns `{text, blocks, details, images,
  injected, …}`; helpers `assert`, `hasBlock(r, needle)`.
- **Budget fixtures:** `FIX = {cwd: TMPDIR}` (L363) — no `getContextUsage` → `remaining === null` → O-1 inline
  fallback. `PAGED_FIX` (L415–417): tokens 10000 / window 50000 / maxTokens 8192 → `remaining = 23616`,
  threshold `0.6·23616 = 14169.6`; merged-ctx pattern `const ctx = { ...base, getContextUsage:
  PAGED_FIX.getContextUsage, model: PAGED_FIX.model }` (L1296+). `TINY_FIX` (L1127–1129): 500/6000 → remaining
  clamps ≤ 0 (everything pages). **LINE-8** wants PAGED_FIX (or TINY_FIX) + the existing ~1.83 MB `huge.log`
  fixture (used by budget tests ~L1563–1713).
- **Notify spy pattern:** `ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }`
  (url-injection.test.mjs L703) — reuse for LINE-10/LINE-11.
- `a.ts` fixture (A_TS_CONTENT) has **4 lines** (LINE-1 comments); LINE-11's "5-line file" and LINE-12 need a
  small fixture or reuse another file — implementer's choice, keep names non-colliding.
- **Commands:** `npm test` = `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node
  ./relative-imports.test.mjs && node ./url-injection.test.mjs` (4 files); `npm run typecheck` =
  `node ./scripts/typecheck.mjs`. Both must stay green.

## 6. README seam

`README.md` **L127–130** (the "**Line range.**" paragraph). Sentence to replace at **L128**: "Closed ranges
inject whole (no paging past the selection). Images/binaries ignore `:N` / `:N-M`." Do NOT touch the `#@file`
syntax/`#<url>` sections (deny-list docs shipped in commit `1757a27`).

## 7. Done-definition (from PRD §4)

LR-1…LR-5 flip to OK per `spec/17-line-ranges.md` §10; LINE-1…LINE-12 pass; `npm test` (4 suites) +
`npm run typecheck` green; existing URL/file/import behavior unchanged (their suites guard it); README no
longer claims ranges never page.

## 8. Explicit NON-goals (awareness only)

- No `spec/` edits — the spec is already synced to the current PRD.
- No URL-side work (deny-list, dispatch, spinner, `onUrlFetch` all shipped & tested).
- No re-implementation of LR-6/LR-7 (OK at HEAD).
- No new config surface, no new exports required beyond what the fixes need.