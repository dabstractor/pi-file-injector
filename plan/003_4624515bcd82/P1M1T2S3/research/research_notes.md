# Research Notes — P1.M1.T2.S3 (injectMarkdown 6-step + wire + cases 15-19)

All facts verified first-hand against the **working tree** (HEAD past T2.S1 *and* T2.S2 — S2 has
LANDED, verified by running the gate: `Result: 67 passed, 0 failed.`). Repo:
`/home/dustin/projects/pi-file-injector`.

> **NOTE on dependency state:** the parallel-execution context said "S2 is being implemented." It is in
> fact **DONE** in the working tree: `estimateImageTokens` exists at `file-injector.ts:360`; injectFile
> has the 3 `subtract` wirings (F5 L476, image L481, binary L487); the gate is green at **67 tests**
> (61 POST-T2.S1 + S2's 6: EIT1–EIT3 + BG1–BG3). S3 therefore starts from a clean **POST-T2.S2** tree.

---

## 1. POST-T2.S2 starting state (VERIFIED — the CONTRACT for S3)

### Source: `file-injector.ts` (~700 lines)
- **Constants present (T2.S1):** `MD_EXTS` (L40), `IMAGE_FALLBACK_TOKENS` (L42), `INLINE_CODE_RE`,
  `FENCE_OPEN_RE`. **S3 CONSUMES `MD_EXTS` — does NOT redeclare it.**
- **Pure helpers present + exported (T2.S1):** `isAbsoluteOrTilde` (L343), `computeCodeRanges` (L…),
  `inCode`. `scanTokens` (L387) has the `skipCode`/`allowAbsTilde` options **fully implemented**
  (`const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` + `if (codeRanges &&
  inCode(m.index!, codeRanges)) continue;` + `if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;`).
  **S3 CALLS scanTokens with `{ allowAbsTilde: false, skipCode: true }` — no scanTokens change needed.**
- **estimateImageTokens** (L360, exported) + **subtract** (private) — both landed by T2.S2. S3 reuses
  them via `emitText` (which already calls subtract for text). **S3 adds NO new subtract.**
- **injectFile (L450–498) — the classify cascade (POST-T2.S2, the wiring target):**
  ```
  L464  if (mime && buf.length === 0)            → F5 empty-image  (+ subtract, S2)
  L470  else if (mime && hasValidImageMagic(...)) → image attach    (+ subtract estimateImageTokens, S2)
  L482  else if (isBinary(buf))                  → binary note     (+ subtract, S2)
  L488  else                                     → emitText (text)  (emitText owns subtract)
  L491  state.count++;  return true;
  ```
  **S3 INSERTS a new `else if (MD_EXTS.has(ext)) { await injectMarkdown(abs, buf.toString("utf8"), state, ctx); }`
  branch BETWEEN the image branch (after its L481 subtract) and `else if (isBinary(buf))` (L482).**
  This is the load-bearing ordering (PRD §5.6 step 1 / system_context §5.3 fact 3): markdown MUST come
  BEFORE `isBinary` so a markdown file with a stray NUL byte is still treated as text (import scanning
  always runs). injectFile pre-claims `abs` at L461 (`state.injectedSet.add(abs)`) BEFORE classification.
- **injectMarkdown does NOT exist yet** — S3 CREATES it. It is PRIVATE (not exported) — exercised via
  injectFiles (item §6 DOCS: "Keep injectMarkdown private").
- **emitText (L505)** — pushes text block(s) + subtracts. **injectMarkdown calls emitText(abs,
  stripped, state) — emitText owns the budget subtract; injectMarkdown does NOT subtract directly.**

### Test: `file-injector.test.mjs` (1162 lines; **67 runCase**; **16 sanity asserts**)
- Sanity list L113–128 (16 asserts incl. `estimateImageTokens` from S2). **S3 adds ZERO sanity asserts**
  (injectMarkdown is private). The list is UNTOUCHED.
- **CC9 ends ~L1137**; the **summary block** (`// 10. Summary + cleanup + exit.`) starts at **L1141**.
  **S3's MARKDOWN IMPORTS test section inserts BETWEEN CC9's closing `});` and the L1141 summary.**
- **runCase(n, name, fn)** — `n` is the PRD §11 case number (1–14 numeric, or string tags E/G/H/.../PD/PN/CC).
  **S3 uses numeric 15–19** to match the PRD §11 manual matrix rows (consistent with cases 1–14).
- **buildFixtures()** (L197–238) writes simple files via `fsSync.writeFileSync(path.join(TMPDIR, X), …)`,
  creates a `src/` dir via `fsSync.mkdirSync(..., { recursive: true })`, and returns `{ HUGE_LOG_CONTENT }`
  (huge.log written AFTER the return). **S3 adds markdown fixtures INSIDE buildFixtures** (simple writes)
  + a `sub/` dir (mkdir recursive).
- **FIX = { cwd: TMPDIR }** (L245) — no budget → `remaining===null` → inject whole (O-1 fallback).
  **All 5 new cases (15–19) use FIX** (item §5 MOCKING: "FIX={cwd:TMPDIR} (no budget → all whole)").
- **Block-count helper:** existing cases inline `(r.text.match(new RegExp('<file name="' + ABS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length`.
  S3 will define a tiny `countFileBlocks(text, abs)` helper at the top of its section to dedupe this.

---

## 2. The injectMarkdown algorithm (PRD §5.6 six steps — EXACT body, from PRD §9 pseudocode)

```ts
/**
 * PRD §5.6 — markdown transitive imports (six steps). Called by injectFile's markdown branch.
 * Recursion contract: RELATIVE-ONLY imports (§4.5), CODE-EXEMPT (§5.6.1), DEDUP-BOUNDED (not
 * depth-limited — §12.13), PRE-ORDER depth-first (this block, then each import's subtree).
 */
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void> {
  // Step 2 — CLAIM SELF (idempotent: injectFile already added abs at its claim site L461; included to
  //          match the PRD §5.6 step-2 contract + make injectMarkdown self-contained against self-imports).
  state.injectedSet.add(abs);

  const dir = path.dirname(abs); // Step 3 base = the importing markdown's directory (§4.5 rule 2)

  // Step 3 — scan for imports: relative-only (allowAbsTilde:false), outside code (skipCode:true).
  const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);

  // Step 4 — strip '#@' from each resolved import marker (high→low), leaving the path. `stripped`
  //          becomes THIS file's block content. Unresolved/deduped/absolute/inside-code markers keep '#@'.
  let stripped = content;
  for (const r of [...records].sort((a, b) => b.index - a.index))
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2);

  // Step 5 — emit THIS file's block. Paged decision runs on the STRIPPED content (so directive text the
  //          model won't see does not bias the budget). emitText owns the subtract + paged bump.
  emitText(abs, stripped, state);

  // Step 6 — recurse into imports, depth-first, ENCOUNTER ORDER (pre-order). Each record.abs already
  //          passed dedup at scan time; the injectedSet re-check is belt-and-suspenders (cross-file
  //          dedup since the scan — handles a sibling subtree that claimed the same path meanwhile).
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue;
    await injectFile(r.abs, state, ctx); // injectFile claims abs, classifies, bumps count, (recurse if md)
  }
}
```

**Key correctness properties (proven by the traces in §4):**
1. **count semantics:** injectFile bumps `state.count` ONCE per claimed file (L491). injectMarkdown +
   emitText do NOT bump count. So a markdown file with N imports → count = 1 (self) + N (imports). ✓
2. **Pre-order block order:** Step 5 emits THIS block BEFORE Step 6 recurses → parent's block precedes
   its imports' blocks. (notes.md block, then api.md block.) ✓
3. **Cycle termination:** injectFile claims abs at L461 BEFORE classification/scanning. When b.md's
   `#@a.md` is scanned, a.md is ALREADY in injectedSet → deduped to verbatim → records=[] → no recurse.
   No depth counter needed; termination is guaranteed (finite file set, each claimed once). ✓
4. **Budget:** emitText (Step 5) subtracts the markdown's own block cost; each import's injectFile
   subtracts via its branch (text→emitText, image→estimateImageTokens, binary→note). All share
   `state.remaining`. S3 adds NO new subtract (T2.S2 already wired image/binary; emitText owns text). ✓

---

## 3. The injectFile wiring (one new branch, between image and binary)

```ts
    // (existing image branch ends with:)
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
+   } else if (MD_EXTS.has(ext)) {
+     // MARKDOWN (PRD §5.6) — text block + transitive imports. Markdown bypasses the §5.1 NUL/binary
+     // routing so import scanning always runs (§5.6 step 1). injectMarkdown (§5.6 six steps): claim self
+     // → scan relative-only imports outside code → strip resolved #@ markers → emit this block (paged
+     // decision on the STRIPPED content) → recurse depth-first (pre-order). Recursion is dedup-bounded
+     // (each abs claimed before its scan; cycles dedup to verbatim), NOT depth-limited.
+     await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
    } else if (isBinary(buf)) {   // (existing binary branch)
```

- **`ext` and `buf` are in scope** (declared at L462/L463: `const ext = extOf(abs); const mime = …; …
  const buf = await fs.readFile(abs);`). `MD_EXTS` is the module const from T2.S1 (L40).
- **Markdown bypasses `isBinary`:** a `.md` with a NUL byte must still be scanned for imports. The
  branch MUST precede `else if (isBinary(buf))`. ✓ (matches system_context §5.3 + codebase_insertion_points)
- **`state.count++` (L491) is SHARED** — runs once for the markdown file (after injectMarkdown returns)
  AND once per import (in each import's own injectFile). The markdown branch adds no extra count logic. ✓
- **No new subtract in the markdown branch** — injectMarkdown→emitText subtracts the text cost. ✓

---

## 4. Fixture design + per-case traces (proves the assertions)

**Fixtures (added to buildFixtures, all under TMPDIR via real fs):**

| Fixture | Content | Used by |
|---|---|---|
| `notes.md` | `# Notes\n\nImports #@api.md here.\n\n```\n#@example.ts\n```\n` | #15, #16 |
| `api.md` | `# API\n\nTop-level API surface.\n` | #15 (imported by notes.md) |
| `a.md` | `# A\n\nRefs #@b.md.\n` | #17 |
| `b.md` | `# B\n\nBack #@a.md.\n` | #17 |
| `notesAbs.md` | `# Abs\n\nIgnored #@/etc/hosts here.\n` | #18 |
| `sub/notes.md` | `# Sub Notes\n\nSee #@api.md.\n` | #19 |
| `sub/api.md` | `# Sub API\n\nSibling API in sub/.\n` | #19 (DISTINCT content from top-level api.md) |

> **Why ONE notes.md serves #15 AND #16:** notes.md has a real `#@api.md` (prose) + a fenced
> `#@example.ts` (code-exempt). For #15 the fenced example.ts is skipped (code) → injected===2
> (notes.md + api.md). For #16 the SAME run proves the fenced `#@example.ts` is left verbatim. The two
> cases assert DIFFERENT properties of the same structural result. This matches the item's fixture list
> ("a fenced ```#@example.ts``` inside notes.md for the code-exempt case") exactly.

**Trace — Case 15 (`Review #@notes.md`, FIX):**
1. injectFiles → processTokenStream scans prompt → records=[{notes.md}]. injectFile(notes.md): claim,
   read, `MD_EXTS.has("md")` → injectMarkdown(notes.md).
2. injectMarkdown(notes.md): dir=TMPDIR. scanTokens(content, TMPDIR, {allowAbsTilde:false,skipCode:true}).
   `#@api.md` (prose, before fence) → NOT in code → record. `#@example.ts` (inside fence) → inCode → skip.
   records=[{api.md}]. strip `#@api.md`→`api.md`. emitText(notes.md, stripped) → notes.md block. recurse:
   injectFile(api.md) → markdown → injectMarkdown(api.md): records=[] → emitText(api.md) → api.md block.
3. counts: api.md++ (=1), notes.md++ (=2). **injected===2.** Block order: notes.md, api.md. ✓
   - notes.md block contains "Imports api.md here." (marker stripped). ✓
   - top-level `#@notes.md` stripped to `notes.md` by injectFiles. ✓

**Trace — Case 17 (`Start #@a.md`, FIX):**
1. injectFile(a.md): claim a.md. markdown → injectMarkdown(a.md). scanTokens → `#@b.md` (prose) →
   record. strip. emitText(a.md). recurse: injectFile(b.md).
2. injectFile(b.md): claim b.md. markdown → injectMarkdown(b.md). scanTokens(b.md content) → `#@a.md`:
   cleanToken→"a.md", resolve→a.md abs, **injectedSet.has(a.md)===true** (claimed step 1) → dedup, leave
   verbatim. records=[]. strip (nothing). emitText(b.md) [block keeps "#@a.md" verbatim]. recurse: none.
3. counts: b.md++ (=1), a.md++ (=2). **injected===2.** Each block ONCE. b.md block has "Back #@a.md."
   verbatim (NOT stripped — deduped, not resolved). **No loop.** ✓

**Trace — Case 18 (`Read #@notesAbs.md`, FIX):**
1. injectFile(notesAbs.md): claim. markdown → injectMarkdown. scanTokens(content, TMPDIR, {allowAbsTilde:false,…}).
   `#@/etc/hosts`: cleanToken→"/etc/hosts", **isAbsoluteOrTilde→true**, allowAbsTilde:false → `continue`
   (skip — leave verbatim). records=[]. strip (nothing). emitText(notesAbs.md) [block keeps "#@/etc/hosts"
   verbatim]. recurse: none.
2. count=1. **injected===1.** No block for /etc/hosts (relative-only rule fires BEFORE resolution/stat). ✓

**Trace — Case 19 (`Read #@sub/notes.md`, FIX):**
1. processTokenStream scans prompt → `#@sub/notes.md`: expandTildeAndResolve("sub/notes.md", TMPDIR) →
   TMPDIR/sub/notes.md. injectFile(SUB_NOTES): claim. markdown → injectMarkdown.
2. **dir = path.dirname(TMPDIR/sub/notes.md) = TMPDIR/sub.** scanTokens(content, **TMPDIR/sub**, …).
   `#@api.md`: resolve("api.md", TMPDIR/sub) → **TMPDIR/sub/api.md = SUB_API** (NOT TMPDIR/api.md!).
   record. strip. emitText(sub/notes.md). recurse: injectFile(SUB_API) → markdown → emitText(sub/api.md).
3. counts: SUB_API++ (=1), SUB_NOTES++ (=2). **injected===2.** sub/api.md's DISTINCT content
   ("Sibling API in sub/.") present; top-level api.md ("Top-level API surface.") NOT present. ✓

---

## 5. No-conflict coordination with siblings

- **T2.S1 (DONE):** owns MD_EXTS + computeCodeRanges/inCode + scanTokens opts. S3 CONSUMES all three
  (MD_EXTS in the injectFile branch; scanTokens called with skipCode:true/allowAbsTilde:false).
- **T2.S2 (DONE):** owns estimateImageTokens + the 3 injectFile subtracts. S3's markdown branch is
  INSERTED between the image branch (with S2's subtract) and the binary branch (with S2's subtract).
  **Disjoint regions** — S3 does not touch S2's subtract lines. S3 adds NO new subtract (emitText owns
  text; imports subtract via their own injectFile branch).
- **T2.S4 (upcoming):** shared-budget case 20 (a markdown importing 3 files + big.log under PAGED_FIX) +
  module-surface sync. S3 ships the injectMarkdown function + the wiring + cases 15-19; S4 will build on
  it for the budget-aware case 20 and re-verify the surface. S3 must leave injectMarkdown in a clean,
  reusable state (it already takes state+ctx, so S4 just needs new fixtures + a PAGED_FIX case).

---

## 6. Validation gate (verified command)

`cd /home/dustin/projects/pi-file-injector && node ./file-injector.test.mjs`
→ expected `Result: <67 + 5> passed, 0 failed.` = **72 passed, 0 failed**, exit 0.
- The 67 existing cases (incl. S2's EIT1–EIT3/BG1–BG3 and the 14 numeric §11 cases) MUST all stay green.
- S3 adds EXACTLY 5 cases (15–19) + ZERO sanity asserts (injectMarkdown is private).
- Markdown bypassing isBinary is the one regression risk: verify no existing binary/text case flips
  (a.md/api.md/etc. are NEW fixtures; existing text files a.ts/b.ts/a.txt are NOT .md → unaffected).
