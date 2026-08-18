# Research Notes — P1.M2.T1.S1 (plan 011): Gates LINE-7 / LINE-9 / LINE-10 (resolution, image dedup, malformed notify)

**Item:** Add the three regression gates from the Line-Range feature §9 acceptance table. Empirically
discovered: **LINE-9 and LINE-10 are ALREADY DELIVERED** (added by the LR-2/LR-3 implementation subtasks and
passing); **LINE-7 is ABSENT** — the only gate this task must ADD. Test-only; no production-code changes.

---

## 0. Empirically verified current state (2025-08-18)

- `node ./file-injector.test.mjs` → **`Result: 177 passed, 0 failed.`** (exit 0).
- **LINE-9 EXISTS and passes** (file-injector.test.mjs:3112) — added by P1.M1.T2.S1 (LR-2). Coverage EXCEEDS the
  item's contract: image bare-then-ranged (`#@pic.png and #@pic.png:3` → injected===1, images.length===1,
  images[0].data === PNG_BYTES base64), image ranged-then-bare (reverse order), binary bare+ranged (ONE note
  block via `blocks.filter(...BIN...).length === 1`), binary ranged-then-bare. Both axes, both orders. ✓ contract.
- **LINE-10 EXISTS and passes** (file-injector.test.mjs:3137) — added by P1.M1.T2.S2 (LR-3). Coverage EXCEEDS the
  contract: `#@a.ts:0` → injected===0, `r.text === "See #@a.ts:0 here"` (verbatim), notes.length===1,
  notes[0].t === "warning", notes[0].m === `"#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)"`
  (mentions the range rule; the em-dash/≥ wording is pinned exactly). PLUS 3 negatives: missing file w/o range →
  no notify; valid resolving range (`#@a.ts:2`) → no notify; a LITERAL file named `literal0.ts:0` → resolves
  whole, no notify (the §2.4 exact-path-wins negative for the notify path — inline fixture + finally rmSync).
- **LINE-7 is ABSENT** — no `runCase("LINE-7"` anywhere (grep + suite output confirm; the LINE cluster prints
  LINE-8, LINE-8-MD, LINE-12, LINE-9, LINE-10 only). This is the ONLY missing gate of my three.
- LINE-8 / LINE-8-MD / LINE-12 exist (from LR-1/LR-5). LINE-11 is the PARALLEL SIBLING's (P1.M1.T2.S3 →
  P1.M2.T1.S2) — its PRP inserts LINE-11 AFTER LINE-10 (~L3160). NOT my scope.

⇒ **Task decomposition:** (1) ADD the missing LINE-7 (after LINE-6, before the `// LINE-8` comment L3055);
(2) VERIFY (read-only) LINE-9/LINE-10 exist + pass + match the contract (done — do not duplicate or modify);
(3) suite green. The "three new runCases" phrasing predates the discovery that LR-2/LR-3 shipped their gates.

## 1. LINE-7 — the gate to ADD (§2.4 exact-path-wins; pins PRE-EXISTING behavior)

**Spec:** §2.4 "resolution tries the **full token including the suffix** first. Only if that fails is the suffix
stripped and the prefix re-resolved… A file literally named `a.ts:10` therefore resolves as-is, whole — no range."
§8 edge row: "Literal file `a.ts:10` exists → Exact wins — whole literal file, no range". §9 table: "LINE-7 |
§2.4 | Literal `a.ts:10` file → exact wins, no range". NOT a gap fix — §2.4 shipped with the original feature;
LINE-7 pins it.

**Item contract:** "create a literal file named 'a.ts:10' in TMPDIR → '#@a.ts:10' injects the WHOLE literal file,
no range (details[0].range undefined, body = literal file content)."

**Why the shared `a.ts` fixture makes this test DISCRIMINATING:** `a.ts` already exists (A_TS, 4 lines — LINE-6
shows line 2 = `"  return a + b;"`). The ladder (§3): step 1 resolves the FULL token `a.ts:10` → the literal file
EXISTS → whole file, no range parse. If exact-wins were broken and the range interpretation ran instead, `a.ts:10`
= line 10 of a 4-line file → past-EOF → LR-4 → verbatim → injected===0. So `injected === 1` + the literal marker
present + `range === undefined` is a complete discriminator (three-way: literal-whole vs range-past-EOF vs
a.ts-whole-misfire — the last excluded by `!hasBlock("return a + b;")`).

**Assertions (the discriminating set):**
1. `r.injected === 1` (vs range-past-EOF → 0).
2. `hasBlock(r, "<unique literal marker>")` (the literal content delivered).
3. `hasBlock(r, '<file name="' + lit + '">')` (the delivered file IS the literal `a.ts:10` abs path).
4. `!hasBlock(r, "return a + b;")` (a.ts content NOT delivered — excludes a whole-a.ts misfire).
5. `r.blocks.length === 1` (only the literal file).
6. `r.details[0].kind === "text"`; `r.details[0].range === undefined` (whole file, NO range — the §2.4 contract).
7. `r.text === "See #@a.ts:10 here"` (prompt verbatim, §6.4).

**Fixture mechanics:** inline `fsSync.writeFileSync(path.join(TMPDIR, "a.ts:10"), "LR7 literal colon file — line one\nLR7 line two\n")`
+ `finally { fsSync.rmSync(lit, { force: true }); }` — mirroring LINE-10's `literal0.ts:0` inline-fixture pattern
exactly. Linux allows `:` in filenames (platform note in the item: fine here, CI is Linux). No collision: `a.ts:10`
is a DISTINCT filename from `a.ts`; LINE-1…6 have ALREADY run (sequential `await runCase`) before LINE-7 executes;
no later case references `a.ts:10`. TMPDIR is mkdtemp-per-run and removed at suite end, so even a missed cleanup
is harmless — but keep the finally for tidiness + mid-case-throw safety.

**No notify spy needed:** successful delivery with FIX (`{cwd: TMPDIR}` — no `hasUI`, no `ui`) → the hasUI-guarded
notify never fires. FIX is the suite convention for happy-path direct calls.

**Placement:** immediately AFTER LINE-6's closing `});` (~L3054) and BEFORE the `// LINE-8 — LR-1…` comment
(~L3055) — keeps the cluster in numeric order and CANNOT collide with the parallel sibling's LINE-11 (which goes
after LINE-10 ~L3160). Place by identifier (the `runCase("LINE-6"` block + the `// LINE-8` comment), not raw
line numbers.

## 2. LINE-9 / LINE-10 — VERIFY ONLY (already delivered; do not duplicate/modify)

The item's contract → existing coverage mapping (every element present, verified by reading L3112-3160):

| Contract element | Existing coverage |
|---|---|
| `#@pic.png #@pic.png:3` → exactly ONE state.images entry | LINE-9 r1: `injected===1`, `images.length===1`, data === PNG_BYTES base64 |
| AND the reverse order likewise | LINE-9 r1b: `#@pic.png:3 and #@pic.png` → injected===1, images===1 |
| binary twin pair → ONE binary note block | LINE-9 r2/r2b: `.bin` fixture (NUL bytes), both orders, `filter(...).length === 1` |
| `#@a.ts:0` → injected:0 | LINE-10: `injected === 0` |
| r.text verbatim | LINE-10: `r.text === "See #@a.ts:0 here"` |
| warning notify mentioning the range rule | LINE-10: `t === "warning"`, `m === "#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)"` |

Both print `✓` in the current 177/0 run. **Do NOT modify, move, or duplicate them.** If a fresh checkout somehow
lacks them (they may be part of the uncommitted `M file-injector.test.mjs` working-tree diff), re-adding per the
contract is the fallback — but empirically they are present and green.

## 3. Harness facts (from system_context.md §5, verified)

- `runCase(id, desc, fn)`; `mod.injectFiles(text, [], FIX)` → `{text, blocks, details, images, injected, paged…}`;
  `assert(cond, msg)`; `hasBlock(r, needle)` (L202). `FIX = {cwd: TMPDIR}` (L363) — no budget → O-1 inline.
- Notify spy (LINE-10's landed form, mirroring url-injection.test.mjs L703): inline
  `{ cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }` as the 3rd injectFiles param.
  (LINE-7 needs NO spy — happy path with FIX.)
- `a.ts` = A_TS (L362), 4 lines, line 2 `"  return a + b;"` (from LINE-6's asserts) — the not-delivered marker.
- Suite: 177 passed currently. +LINE-7 → 178. The parallel sibling's LINE-11 (+1, after LINE-10) may land before
  or after — the robust gate is `0 failed` + `✓ case LINE-7` / `✓ LINE-9` / `✓ LINE-10`, not a fixed count.

## 4. No-conflict boundaries

- **Parallel sibling P1.M1.T2.S3 (LR-4):** edits file-injector.ts (+countLines/turnAwayPastEof) + extends LINE-4's
  unit asserts IN PLACE + inserts LINE-11 AFTER LINE-10 (~L3160). My LINE-7 (after LINE-6) shares NO edit site.
- **P1.M2.T1.S2 (LINE-8/11/12 formalization):** LINE-8/8-MD/12 already exist and pass; S2 verifies/hardens them +
  lands LINE-11 alongside. Not my scope (my three are 7/9/10).
- **No production-code changes:** LINE-7 pins pre-existing §2.4 behavior. If LINE-7 FAILS, the regression belongs
  to the engine (report back, do NOT paper over by weakening the test) — item §4 explicit.

## 5. Gates

- `node ./file-injector.test.mjs` → 0 failed; `✓ case LINE-7` + `✓ case LINE-9` + `✓ case LINE-10`.
  (LINE-1…6 and every other case untouched → the 177 baseline stays green; count becomes 178, or 179 if the
  sibling's LINE-11 has landed.)
- `git diff --stat file-injector.ts` → EMPTY relative to the working tree at task start (test-only).
- (`npm run typecheck` unaffected — no .ts change.)