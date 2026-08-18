# Research Notes — P1.M2.T1.S1 (bugfix 001_a6ffb98ab096): injectMarkdown Step-5 invalidRange guard (BUG-002, LR-3 parity)

**Item:** BUG-002 — a malformed line range (`#@a.md:0`, `:5-3`) inside a DELIVERED markdown file is (a) silently
verbatim (no LR-3 warning — unlike top level) and (b) leaks the RAW unresolved token into `injectFile`, which
`fs.stat`s it against **process.cwd** (if a literal `a.md:0` exists there → injected with a RELATIVE block name,
violating §6.1). Fix: mirror processTokenStream's invalidRange guard into injectMarkdown's Step-5 loop, BEFORE
the claimKey re-check. Plus the MD-LR3 regression test + the Mode-A README sentence. No exported surface change.

---

## 0. Verified current state (line numbers against the live tree; the architecture doc's drifted slightly)

- **Baseline: `Result: 183 passed, 0 failed.`** (182 + the parallel sibling's REND-TIER3-PATH, already landed at
  file-injector.test.mjs:2959). My MD-LR3 → 184. Gate = `0 failed` + `✓ case MD-LR3`, never a fixed count.
- **Parallel sibling P1.M1.T1.S3** (renderer tier-3 fallback): edits `renderInjectedMessage` (:1047-1102) ONLY +
  its REND-TIER3-PATH test (:2959, in the REND cluster) — NO README, NO injectMarkdown. **Zero overlap** with this
  task (code region, test region, and docs all disjoint).

## 1. The bug — exact current code (all line refs live-verified)

**(a) `splitLineRange` invalid ⇒ raw token as path** — `#@a.md:0` (`start<1`) / `:5-3` (`end<start`) →
`{ path: <FULL raw token incl. suffix>, invalid: true }` (unit-pinned at test :3024-3025).

**(b) `scanTokens` invalidRange push (:1234)** — `if (parsed.invalid) { out.push({ path: token, invalidRange: true }); continue; }`
The record's `path` is the RAW token (`"a.md:0"`), NOT resolved against baseDir. **Bypasses localSeen/claimKey
entirely** (the localSeen.add happens only later, for RESOLVED records) ⇒ a repeated malformed marker yields one
record PER occurrence ⇒ (post-fix) one warning per occurrence — top-level parity; document in the test.
Exact-path-wins still applies FIRST (:1230 `resolveImportPath(token, baseDir, opts.tryMdExt)` before the invalid
branch): a literal `a.md:0` **in the markdown's own dir** still resolves + injects whole (intended, unaffected).

**(c) `processTokenStream`'s correct guard (:1274-1278) — THE TEMPLATE (byte-exact, live-verified):**
```ts
    // LR-3 — malformed range (`:0`, `:5-3`): warn (interactive only) and leave verbatim. No claim, no dedup
    // (invalid records are never in injectedSet — localSeen would catch repeats but each scan is per-text anyway).
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
```
Warning string byte-pinned by LINE-10's assertion (test :3298):
`"#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)"` (em dash U+2014, `≥` chars, `M ≥ N ≥ 1`).

**(d) `injectMarkdown` signature (:1546) — ctx IS the 4th param; NO signature change:**
```ts
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx, startLine?: number, endLine?: number): Promise<void> {
```
Step 3 scan (:1551) `const recs = await scanTokens(body, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);`
**Step 5 (:1597-1603) — THE BUG (live-verified current text):**
```ts
  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const rec of recs) {
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, classifies, bumps count, recurses again if markdown
  }
```
No invalidRange check; the `claimKey(rec.path,…)` re-check (:1600) mis-computes for invalid records
(`claimKey("a.md:0", undefined, undefined)` → the meaningless relative string `"a.md:0"`), so the guard MUST be
inserted BEFORE it (mirrors processTokenStream's ordering).

**(e) The leak path — `injectFile` (signature :1294-ish; stat first line):** takes the string as-is, no
baseDir join. `fs.stat("a.md:0")` resolves against **process.cwd()** (the repo root during `npm test`): no such
file → throw → `return false` → SILENT verbatim (today's observed RED). If a literal `a.md:0` DID exist in
process.cwd → injected with RELATIVE block name `'<file name="a.md:0">'` (§6.1 violation + §4.5 dir violation).

## 2. The fix (minimal, mirrors (c) exactly; insert at :1599, before the claimKey line)

```ts
  for (const rec of recs) {
    // LR-3 — malformed range (`:0`, `:5-3`) found while scanning a DELIVERED markdown: same contract as
    // processTokenStream — warn (interactive only), leave verbatim, never hand the raw token to injectFile
    // (BUG-002: fs.stat would resolve it against process.cwd, not this markdown's dir).
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, classifies, bumps count, recurses again if markdown
  }
```
- `ctx` already in scope (4th param) — **no signature/type changes**; `rec`'s scanTokens type already carries
  `invalidRange?: true`. `npm run typecheck`: `"warning"` is in the notify union ("info"|"warning"|"error") ✓.
- Byte-identical message to top-level ⇒ one assertion string serves both paths (LINE-10 parity).
- Do NOT touch scanTokens or processTokenStream (item §3 explicit; the architecture doc's "BUG-002 fix inputs"
  gives this exact insertion).

## 3. The MD-LR3 regression test (TDD — RED first)

**Placement:** immediately after LINE-10's closing `});` (:3323 — the block ends with the literal0.ts:0
`finally { fsSync.rmSync(lit, …) }`), BEFORE the `// LINE-11 — LR-4 …` comment (:3325). Place by IDENTIFIER.
**Label `MD-LR3`** — unique. ⚠️ Naming-collision warning (architecture doc): the repo's EXISTING test labels
"BUG-001"/"BUG-002" (~:3308 area + url-injection DIS-1b/DIS-3) refer to DIFFERENT historical bugs — do not reuse.

**Fixture:** `a.md` ALREADY exists (buildFixtures :257, content `"# A\n\nRefs #@b.md.\n"`, const A_MD :378) —
reuse, don't rewrite. `badrange.md` written INLINE (LINE-10/LINE-11 discipline: inline + finally rmSync):
`fsSync.writeFileSync(path.join(TMPDIR, "badrange.md"), "see #@a.md:0 here\n")`.
(Trace: badrange.md's token `a.md:0` → exact resolve fails (no such file in TMPDIR) → invalid branch →
invalidRange record → [fixed] warn+skip. a.md itself is never imported — the malformed token never resolves.)

**Body (mirrors LINE-10's spy pattern):**
```js
await runCase("MD-LR3", "BUG-002(new): malformed range inside a DELIVERED markdown → LR-3 warning + verbatim + no raw-token injection", async () => {
  const bad = path.join(TMPDIR, "badrange.md");
  fsSync.writeFileSync(bad, "see #@a.md:0 here\n");
  try {
    const notes = [];
    const r = await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } });
    assert(r.injected === 1, `only badrange.md delivered (a.md:0 is malformed → skipped), got injected=${r.injected}`);
    assert(!r.blocks.some((b) => b.includes('name="a.md:0"')), `no a.md:0 block (raw token never reaches injectFile / no relative-name leak)`);
    assert(notes.length === 1, `exactly one warning fired (markdown-level LR-3 parity), got ${notes.length}`);
    assert(notes[0]?.t === "warning", `type 'warning', got ${notes[0]?.t}`);
    assert(notes[0]?.m === "#@a.md:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)",
      `byte-parity with the top-level LR-3 message, got ${JSON.stringify(notes[0]?.m)}`);
    assert(hasBlock(r, "see #@a.md:0 here"), `the malformed marker stays VERBATIM inside badrange.md's block`);
    assert(r.text === "Read #@badrange.md", `top-level prompt verbatim, got ${JSON.stringify(r.text)}`);
    // Headless negative: hasUI:false → same delivery, ZERO notifies (the guard is hasUI-gated; the spy present
    // but unreached proves the gate, not a missing ui).
    const notes2 = [];
    const r2 = await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: false, ui: { notify: (m, t) => notes2.push({ m, t }) } });
    assert(r2.injected === 1 && notes2.length === 0, `headless: still delivers badrange.md, NO notify (notes=${notes2.length})`);
    // Repeated malformed marker: invalid records bypass localSeen → warns ONCE PER OCCURRENCE (top-level parity).
    fsSync.writeFileSync(bad, "see #@a.md:0 and #@a.md:5-3 here\n");
    const notes3 = [];
    await mod.injectFiles("Read #@badrange.md", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes3.push({ m, t }) } });
    assert(notes3.length === 2, `two malformed markers → two warnings (one per occurrence; invalid records bypass localSeen), got ${notes3.length}`);
    assert(notes3[0]?.m.includes("#@a.md:0") && notes3[1]?.m.includes("#@a.md:5-3"), `each warning names its own token`);
  } finally {
    fsSync.rmSync(bad, { force: true });
  }
});
```
**RED today (traced):** without the guard, `injectFile("a.md:0")` stats against the repo root (process.cwd) →
ENOENT → `false` → silent ⇒ `r.injected===1` ✓, `!blocks.some(name="a.md:0")` ✓ BUT `notes.length === 1` ✗
(got 0) ⇒ MD-LR3 fails on the notify assert. GREEN after Edit 1.
(The full process-cwd leak repro — literal `a.md:0` in a chdir'd dir — is now UNREACHABLE by the fix; an optional
belt-and-suspenders `process.chdir` variant is NOT required; skip it — chdir is global mutable state.)

## 4. README (Mode A — rides with this subtask, item §5)

The `**Line range.**` paragraph (README.md:~126-131, live-verified: starts "**Line range.** `#@a.ts:10` delivers
only line 10…" ends "…`#@a.ts:10 #@a.ts:10` is one block." region) — APPEND one sentence:
"A malformed range (`:0`, `:5-3`) is never treated as a path: the marker is left untouched and a warning is
shown — including inside imported markdown files."
(The later P1.M4.T6.S1 sweep verifies the changeset's docs; this targeted sentence is THIS subtask's Mode-A duty.)

## 5. Gates

- `node ./file-injector.test.mjs` → 0 failed (184 = 183 + MD-LR3); `✓ case MD-LR3`; LINE-10 (:3291), LINE-11
  (:3329), LINE-7 (:~3260s) + every other case stay green.
- `npm run typecheck` → 0 errors (the notify literal "warning" is in the Ctx.ui.notify union — typecheck guards it).
- `git diff`: file-injector.ts (ONE hunk: Step 5) + file-injector.test.mjs (ONE hunk: MD-LR3) + README.md (one sentence).
- npm test (all 4 files) stays green — relative-imports/import-behavior/url-injection untouched (they don't drive
  malformed markdown ranges; url-injection's own notify cases unaffected).