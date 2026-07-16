# Research Notes — P1.M2.T2.S1

**Item:** `injectMarkdown`: pass `bareAt: state.bareAt` + carry `prefixLen` through Step 3.5 + strip with `prefixLen` in Step 4 (+ §11 #25-28 + §10 bare-@ edge integration tests)

## Upstream contracts (LANDED — verified by running the suite)

- **P1.M1.T1.S1 (LANDED):** `scanTokens` opts has `bareAt?: boolean`; returns
  `Promise<{ index: number; prefixLen: number; abs: string }[]>`; cands-union loop (FILE_INJECT_RE
  always prefixLen 2; BARE_AT_RE when `opts.bareAt` prefixLen 1); dedup keys on resolved `abs`.
  `BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu` (Unicode, `u` flag, `#` excluded by lookbehind so
  `#@file` never double-matches). Verified at file-injector.ts L475-505.
- **P1.M1.T2.S1 (LANDED):** `readConfig`, `FileInjectorConfig`, `CONFIG_DIR_NAME`/`getAgentDir`
  imports, `.pi/file-injector.json` fixture (`{markdownBareAtImports:true}`) in buildFixtures.
- **P1.M2.T1.S1 (LANDED — suite = 107 passing):** `State` has REQUIRED `bareAt: boolean` (file-injector.ts
  L290 `bareAt`); `injectFiles(text, imagesIn, ctx, bareAt = false)` 4th param (Option A); State init
  sets `state.bareAt = bareAt`; top-level `processTokenStream` call passes `bareAt:false` (HARDCODED,
  L799-region); module-level `let cfg`; factory `session_start` config handler + input handler passes
  `cfg.markdownBareAtImports === true`. `makeMockCtx` has `isProjectTrusted`; `captureHandler` returns
  `{cb, all}`. 5 cases M2.T1.S1-a..e (incl. top-level safety case c).

**=> When this task runs, baseline = 107. After my 7 cases: 114. injectFiles' 4th `bareAt` param is the
direct-test entry (Option A — "cleanest for direct unit testing"); my cases use `mod.injectFiles(prompt,
[], FIX, true)` for on / `mod.injectFiles(prompt, [], FIX)` for off (default).**

## The three edit sites in injectMarkdown (current, pre-change — file-injector.ts L692-735)

Read L695-736 verbatim. Three precise change points (all in the six-step body):

1. **Step 3 scan call (L699):**
   ```ts
   const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true }, state);
   ```
   → add `bareAt: state.bareAt`. (`records` is already `{index, prefixLen, abs}[]` from scanTokens.)

2. **Step 3.5 existence pre-check (L710):**
   ```ts
   const injectable: { index: number; abs: string }[] = [];
   ```
   → change the TYPE annotation to `{ index: number; prefixLen: number; abs: string }[]`. The filter body
   `injectable.push(r)` is UNCHANGED (records already carry prefixLen; pushing the whole record forwards it).
   **WHY type-only:** today `injectable.push(r)` compiles (structural subtyping: `{index,prefixLen,abs}`
   is assignable to the narrower `{index,abs}`), but the declared element type lacks `prefixLen`, so Step 4
   CANNOT read `r.prefixLen`. Widening the annotation is what unlocks the prefixLen-aware strip. No runtime
   change to the filter.

3. **Step 4 strip (L723-724):**
   ```ts
   for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
     stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is the '#'
   }
   ```
   → `r.index + 2` becomes `r.index + r.prefixLen`; update the comment (r.index is the `#` for prefixLen 2,
   the `@` for prefixLen 1 — the zero-width lookbehind positions both regexes at the marker's first char).

Steps 5 (emitText on `stripped`) and 6 (recurse over `injectable`) are UNCHANGED — they operate on
`r.abs` (still in the widened type) and don't care about prefixLen.

## Byte-for-byte-default guarantee (the key safety property)

With `bareAt===false` (default): the scan call gains `bareAt:false` (no-op — scanTokens' `if (opts.bareAt)`
already guards BARE_AT_RE, so no new matches); every record has prefixLen 2; Step 4 strips `+ 2` ==
`+ r.prefixLen` (2). So markdown injection is byte-for-byte identical to today. The existing 107 cases
(esp. cases 15-24, MD1/MD2, EDG-1..4) stay GREEN untouched.

## The +2 bug (the regression my #26 assertion must catch)

If Step 4 kept hardcoded `+ 2` while a bare-`@` record (prefixLen 1) flows through: stripping the marker
`@api.md` at index N removes 2 chars (`@a`), leaving `pi.md` instead of `api.md`. So #26 asserts BOTH
`r.text.includes("Refs api.md here.")` (correct) AND `!r.text.includes("Refs pi.md here.")` (the +2 bug's
fingerprint). This is the smoking-gun guard for the prefixLen-aware strip.

## Test design — 7 cases (#25-28 + §10 edges e/f/g), all via direct `injectFiles` (Option A param)

Fixtures to ADD to buildFixtures() (self-contained, non-colliding; buildFixtures is NOT touched by any
parallel task — P1.M2.T1.S1 added none):
- `notesBare.md` = `"# Bare Notes\n\nRefs @api.md here.\n"` — bare `@api.md`; reuses existing `api.md`. (#25, #26)
- `notesEmail.md` = `"# Email\n\nContact user@host.com.\n"` — mid-word `@`. (§10 e)
- `notesMention.md` = `"# Mention\n\nPing @username now.\n"` — bare `@username` (no username.md). (§10 f)
- `notesMixDedup.md` = `"Refs #@api.md and @api.md.\n"` — both forms, same resolved abs. (§10 g)
- `other.md` = `"# Other\n\nTop-level bare-@ target.\n"` — exists, for #28 top-level proof.
- #27 reuses the EXISTING `notes.md` (already has `#@api.md` + fenced `#@example.ts`).

Path constants: `NOTES_BARE`, `NOTES_EMAIL`, `NOTES_MENTION`, `NOTES_MIX_DEDUP`, `OTHER_MD` (+ reuse `API`).

Case mapping (each asserts injected count + marker strip + block presence/absence):
- **#25 (a) off:** `injectFiles("Review #@notesBare.md", [], FIX)` → injected=1; `@api.md` VERBATIM; api.md absent.
- **#26 (b) on:** `injectFiles("Review #@notesBare.md", [], FIX, true)` → injected=2; marker→`api.md` (prefixLen 1);
  assert NOT `pi.md` (+2-bug guard); NOT `@api.md`.
- **#27 (c) on+#@:** `injectFiles("Review #@notes.md", [], FIX, true)` → injected=2; api.md ONCE; `#@api.md`→`api.md`;
  fenced `#@example.ts` still verbatim.
- **#28 (d) on+top-level:** `injectFiles("Read @other.md", [], FIX, true)` → injected=0; other.md absent; byte-for-byte.
- **§10(e) email:** `injectFiles("Read #@notesEmail.md", [], FIX, true)` → injected=1; `user@host.com` VERBATIM.
- **§10(f) mention:** `injectFiles("Read #@notesMention.md", [], FIX, true)` → injected=1; `@username` VERBATIM.
- **§10(g) dedup:** `injectFiles("Review #@notesMixDedup.md", [], FIX, true)` → injected=2; api.md ONCE;
  first `#@api.md`→`api.md`; second `@api.md` VERBATIM.

## Index math for §10(g) (notesMixDedup.md = "Refs #@api.md and @api.md.\n")
- `#` of `#@api.md` at index 5 (FILE_INJECT_RE, prefixLen 2).
- `@` of the second `@api.md` at index 18 (BARE_AT_RE, preceded by space at 17, prefixLen 1).
- cands sorted: [{idx:5,pl:2},{idx:18,pl:1}]. Both resolve to api.md → first recorded, second dropped
  (localSeen). records=[{index:5,prefixLen:2,abs:api.md}]. Step 4 strip slice(0,5)+slice(7) →
  "Refs api.md and @api.md.\n". So first marker stripped, second VERBATIM. Matches EDG-3 pattern.

## Assert helpers available
- `countFileBlocks(text, abs)` (L354) — counts `<file name="abs">` occurrences. Used by case 17 / EDG-3.
- `assert(cond, msg)` — runCase harness (L89).
- `FIX = { cwd: TMPDIR }` (L311). `API` = TMPDIR/api.md (L315).

## Placement
- Source: file-injector.ts L699 (scan call), L710 (injectable type), L724 (Step 4 strip). injectMarkdown
  JSDoc L650-691 — add a Mode-A note on bareAt threading + prefixLen strip.
- Tests: append 7 runCase blocks under a `// ── P1.M2.T2.S1 ──` banner, BEFORE the "10. Summary" block
  (L1960). Add 5 fixtures + 5 path constants near the existing markdown fixtures (~L214-275, L314-350).

## Gates
- `npm run typecheck` → 0 errors (tsc --strict; the injectable type widening is the only type change; the
  scan call opts gains a key that scanTokens already accepts; no cascade).
- `node ./file-injector.test.mjs` → 107 baseline + 7 new = 114 passed, 0 failed, exit 0.
- Existing 107 (incl. 92 core + T1.S1's 6 + T2.S1's 4 + M2.T1.S1's 5) stay GREEN (byte-for-byte default).

## No changes to
- Top-level processTokenStream scan call (bareAt:false — P1.M2.T1.S1 invariant).
- Top-level `#@` strip (`slice(0,i)+slice(i+2)` — top-level is always #@, prefixLen 2).
- State/processTokenStream/injectFiles (P1.M2.T1.S1 owns them).
- scanTokens/BARE_AT_RE (P1.M1.T1.S1 owns them).
- readConfig/FileInjectorConfig (P1.M1.T2.S1 owns them).
- No new exports (injectMarkdown stays PRIVATE). No ASSERTED_EXPORTS edit.
- PRD.md / README.md (README = P1.M3.T2.S1).
