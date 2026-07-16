# Research Notes — P1.M1.T2.S4 (Shared-budget case 20 + edge cases + module-surface sync)

**Scope:** Add PRD §11 case 20 (shared budget across markdown recursion) + 2 PRD §10 edge cases (missing
import → verbatim; outside-cwd `../` import → allowed) + finalize the test's module-surface sanity list.
**Starting point:** POST-S3, VERIFIED LANDED — `node ./file-injector.test.mjs` → **`72 passed, 0 failed`**.
All facts below are first-hand (read committed source + ran live experiments against POST-S3 code).

---

## 1. POST-S3 verified state (the contract S4 builds on)

| Anchor (current line) | Fact |
|---|---|
| file-injector.ts = 797 lines | POST-S3. `injectMarkdown` EXISTS (L578, **PRIVATE** — no `export`). |
| file-injector.ts L37 | `const MD_EXTS = new Set(["md", "markdown"]);` (T2.S1; consumed by injectFile's branch). |
| file-injector.ts L482-488 | injectFile's `else if (MD_EXTS.has(ext)) { await injectMarkdown(abs, buf.toString("utf8"), state, ctx); }` branch (S3), placed BETWEEN image (L481 subtract) and `else if (isBinary(buf))`. |
| file-injector.ts L450-501 | `injectFile` (exported): stat → `state.injectedSet.add(abs)` CLAIM (L471) → read buf → classify cascade (F5 / image / **markdown** / binary / text) → `state.count++` (L499) → return true. Missing/dir/read-throw → return false. |
| file-injector.ts L387-410 | `scanTokens` (exported, SYNC): `FILE_INJECT_RE` matchAll; skipCode → computeCodeRanges+inCode skip; `cleanToken`; `isAbsoluteOrTilde` drop (when !allowAbsTilde); `expandTildeAndResolve(token, baseDir)`; **dedup vs `state.injectedSet` ∪ `localSeen`**; push `{ index: m.index, abs }`. **Does NOT check existence.** Does NOT mutate injectedSet (only localSeen). |
| file-injector.ts L422-432 | `processTokenStream` (PRIVATE): scan → for each record `if (injectedSet.has) continue; const ok = await injectFile(...); if (ok) resolved.push(r.index)`. **Top-level strip is SUCCESS-based** (only injected indices land in `resolved`). This is why a top-level missing token stays verbatim. |
| file-injector.ts L578-602 | `injectMarkdown` (PRIVATE): claim self → `scanTokens(content, dirname(abs), {allowAbsTilde:false, skipCode:true}, state)` → **strip `#@` from ALL records (high→low)** → `emitText(abs, stripped, state)` → recurse `for (r of records) if (!injectedSet.has(r.abs)) await injectFile(...)`. **Strip is NOT success-based — this is the S4 edge-(a) gap (§2).** |
| file-injector.ts L505-535 | `emitText` (exported): `fileCost=ceil(len/4)`; whole if `remaining===null || fileCost<=PAGED_THRESHOLD*remaining`; sub-head guard (`len<=HEAD_CHARS`→whole); else head+directive, `state.paged++`. Owns `subtract` (text cost). |
| file-injector.ts L180-183 | `formatPagedDirectiveBlock`: `'<file name="'+abs+'"><large file — estimated '+totalBytes+' bytes; first '+injectedLines+' lines injected above. Use the read tool to read the rest: offset:'+startLine+', limit:'+READ_LIMIT+', incrementing offset by '+READ_LIMIT+' until the entire file is read></file>'`. **NOT `<paged: ...>`** (that is the PRD §6.1 example; the real code emits `<large file — ...>`). |
| file-injector.test.mjs = 1337 lines, **72 runCase**, Result L1320 | gate is GREEN at 72. |
| file-injector.test.mjs L113-128 | **sanity list = 16 `typeof mod.X === "function"` asserts.** default/injectFiles/cleanToken/formatTextFileBlock/formatImageBlock/formatBinaryBlock/formatEmptyImageBlock/formatPagedDirectiveBlock/hasValidImageMagic (9 MVP) + scanTokens/injectFile/emitText (T1.S2) + isAbsoluteOrTilde/computeCodeRanges/inCode (T2.S1) + estimateImageTokens (T2.S2). S3 added NONE (injectMarkdown private). |
| file-injector.test.mjs L1248-1315 | MARKDOWN TRANSITIVE IMPORTS section (S3 cases 15-19, all FIX/no-budget). |
| file-injector.test.mjs L89 | `runCase(n, name, fn)` — accepts numeric OR string `n`. Numeric = PRD §11 rows; string = named group (E1/F1/CC1/EIT1/BG1/PN1). |
| file-injector.test.mjs L225-232 | path consts (A_TS…HUGE) + `const FIX = { cwd: TMPDIR };` (L232). HUGE at L229. |
| file-injector.test.mjs L252-256 | `PAGED_FIX = { cwd: TMPDIR, getContextUsage: () => ({ tokens: 10000, contextWindow: 50000, percent: 20 }), model: { contextWindow: 50000, maxTokens: 8192 } }`. |
| file-injector.test.mjs L133-143 | `makeMockCtx(cwd, {hasUI=true})` → `{ ctx: { cwd, hasUI, ui: { notify } }, rec }`. |
| file-injector.test.mjs L989-1024 | **merged-ctx pattern** (PN2-PN4): `const { ctx: base, rec } = makeMockCtx(TMPDIR); const ctx = { ...base, getContextUsage: PAGED_FIX.getContextUsage, model: PAGED_FIX.model };` then `const slot = captureHandler(); const out = await slot.cb({ text, source:"interactive", images:[] }, ctx);`. |

---

## 2. ⚠️ CRITICAL FINDING — edge (a) (missing import) REQUIRES A CODE FIX

**The bug.** PRD §10 + item LOGIC (b)(1): "`#@notes.md` where notes.md imports a MISSING api.md → notes.md
injected (marker stripped), `#@api.md` left verbatim in notes.md content, injected===1." But S3's
`injectMarkdown` (L578) **strips `#@` from EVERY record returned by scanTokens** (Step 4), and scanTokens
records a token as soon as it RESOLVES (it does NOT stat). So a missing import's marker is STRIPPED even
though injectFile later returns false (stat ENOENT) and the file is never injected.

**Live proof (POST-S3, ran it):** notesMissing.md = `"# Notes\n\nRefs #@api.md here.\n"` (api.md absent),
prompt `Review #@notesMissing.md`, FIX. Result: `injected===1` ✓, BUT `marker STRIPPED (api.md): true`,
`marker VERBATIM (#@api.md): false`. **The current code shows "Refs api.md here." — WRONG (PRD wants
"Refs #@api.md here.").**

**Why this differs from the top level.** At the top level, `processTokenStream` injects FIRST, then pushes
`r.index` into `resolved` only `if (ok)`; injectFiles strips only `resolved` indices. So a top-level missing
token is verbatim. `injectMarkdown` cannot do the same (inject-then-strip) because **pre-order** (PRD §5.6
step 6) emits THIS file's block BEFORE recursing into imports — the strip must be decided before emission.

**The fix (localized to injectMarkdown; preserves pre-order + all S3 cases).** Add an **existence pre-check**
(stat + isFile) between scan (Step 3) and strip (Step 4). Only imports that stat-succeed-AND-isFile go into
`injectable`; strip only `injectable`; recurse into `injectable`. injectFile re-stats harmlessly.

```ts
async function injectMarkdown(abs, content, state, ctx) {
  state.injectedSet.add(abs);
  const dir = path.dirname(abs);
  const records = scanTokens(content, dir, { allowAbsTilde: false, skipCode: true }, state);
  // §10 / §5.4 — a markdown import resolving to a MISSING file or DIRECTORY is left VERBATIM (its marker
  // is NOT stripped) because nothing is injected for it. Pre-order (§5.6 step 6) emits this file's block
  // BEFORE recursing, so the strip decision is made now via stat. injectFile re-stats harmlessly. A read
  // error (stat-succeeds but read throws, rare/untested) still strips — acceptable; §10 specifies missing only.
  const injectable = [];
  for (const r of records) {
    try { const st = await fs.stat(r.abs); if (st.isFile()) injectable.push(r); } catch { /* missing → verbatim */ }
  }
  let stripped = content;
  for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is '#'; lookbehind zero-width
  }
  emitText(abs, stripped, state); // Step 5 — paged decision on the STRIPPED content
  for (const r of injectable) {                                   // Step 6 — recurse only into injectable
    if (state.injectedSet.has(r.abs)) continue;                   // belt-and-suspenders cross-subtree dedup
    await injectFile(r.abs, state, ctx);
  }
}
```

**Backward-compat with S3 cases 15-19 (all imports EXIST → injectable===records → identical behavior):**
- 15 notes.md→api.md (exists): injectable=[api.md]; strip api.md; recurse injectFile(api.md). ✓ identical.
- 16 fenced #@example.ts is code-exempt (never in records); api.md exists. ✓ identical.
- 17 a.md→b.md→a.md cycle: a.md injectable=[b.md]; strip b.md marker in a.md; injectFile(b.md) claims b.md,
   scans → a.md ALREADY in injectedSet (claimed by injectFile(a.md)) → verbatim → records=[] → b.md block
   keeps `#@a.md`. ✓ identical (cycle dedup unchanged).
- 18 notesAbs.md `#@/etc/hosts`: isAbsoluteOrTilde drops it at scan → records=[] → injectable=[] → no strip. ✓
- 19 sub/notes.md→`#@api.md`→sub/api.md (exists): injectable=[sub/api.md]; strip; recurse. ✓ identical.

**Also fixes (bonus, matches §5.4): a directory import** (`#@src/`) now verbatim (stat-succeeds but
isFile=false → not in injectable). Previously stripped-but-not-injected (same bug class).

---

## 3. Edge (b) (outside-cwd `../` import) ALREADY WORKS — test only, no code change

**Live proof (POST-S3, ran it):** `sub/outsider.md` = `"# Sub\n\nRefs #@../shared/api.md.\n"`,
`shared/api.md` = `"# Shared API\n\nOutside cwd.\n"`, prompt `Read #@sub/outsider.md`, FIX.
Result: `injected===2`, sub/outsider.md block ✓, shared/api.md block ✓, "Outside cwd." present ✓.

**Why it works without a change:** imports resolve relative to `path.dirname(abs)` (the markdown's dir), NOT
`ctx.cwd` (PRD §4.5 rule 2). `#@../shared/api.md` in sub/outsider.md → `expandTildeAndResolve("../shared/api.md",
<sub dir>)` → `<TMPDIR>/shared/api.md`, which is OUTSIDE cwd (<TMPDIR>) but INSIDE the markdown's parent.
`isAbsoluteOrTilde` is false (no leading `/` or `~`) → it resolves + injects. PRD §10 explicitly ALLOWS this:
"Markdown import resolves outside cwd (`#@../shared/api.md` inside notes.md) → Allowed (relative to the
markdown's dir); injected." So MD2 is a pure regression test (assert the resolved path + injected===2).

---

## 4. Case 20 (shared budget) — math + structure VERIFIED

**Mock:** PAGED_FIX (remaining = 50000-10000-8192-8192 = **23616**; PAGED_THRESHOLD·remaining = **14170**).
For the notify sub-assertion: merged ctx (makeMockCtx ui + PAGED_FIX budget) via `captureHandler()`.

**Fixture:** `bigdoc.md` = `"# Bigdoc\n\n- One: #@part1.txt\n- Two: #@part2.txt\n- Three: #@part3.txt\n- Logs: #@huge.log\n"`
+ `part1.txt`/`part2.txt`/`part3.txt` (small, distinct) + reuse the existing `huge.log` (2 MB). Prompt:
`Read #@bigdoc.md`.

**Traced execution under PAGED_FIX (with the §2 fix in place — all 4 imports exist → all injectable):**
1. injectFile(bigdoc.md) → injectMarkdown: records=[part1,part2,part3,huge.log]; injectable=ALL 4; strip all 4
   → stripped ~73 chars; emitText(bigdoc.md, stripped): fileCost=ceil(73/4)=19 ≤ 14170 → **WHOLE**; remaining 23616→23597; count=1.
2. recurse part1.txt ("Part one content.\n"=18): fileCost=5 ≤ 0.6·23597=14158 → WHOLE; remaining→23592; count=2.
3. recurse part2.txt: WHOLE; remaining→23587; count=3.
4. recurse part3.txt: WHOLE; remaining→23582; count=4.
5. recurse huge.log (2 MB, fileCost=⌈2097152/4⌉=524288 ≫ 0.6·23582=14149) → **PAGED** (head+directive);
   paged=1; subtract head cost; count=5.

**Result:** `injected===5`, `paged===1`, whole=4. Block order (pre-order DFS): bigdoc.md, part1, part2, part3,
huge.log(head), huge.log(directive). **notify = "#@ injected 4 whole, 1 paged"** (whole=injected-paged=4).

**Live proof (POST-S3, ran it with a fresh bigdoc + parts + huge.log under PAGED_FIX):**
`injected: 5`, `paged: 1`, all 5 blocks present, `order iB<i1<i2<i3<iH: true`, markers stripped in bigdoc region.
(The directive uses `<large file — estimated N bytes; ... Use the read tool ...>`, NOT `<paged:>` — §1.)

**What "shared budget" proves here:** `remaining` is ONE accumulator decremented at each emission across the
WHOLE recursion (bigdoc block, then part1, part2, part3, then huge.log head). huge.log's decision runs against
the running total (≈23582 after the 4 whole emissions), not in isolation. (huge.log would page even first —
524288≫14170 — so the *flip* is not the signal; the signals are: (a) the accumulator spans the recursion,
(b) huge.log PAGES when imported transitively, (c) notify counts ALL 5 delivered files. The top-level shared-
accumulator FLIP is already proven by BG1-BG3; case 20 proves it spans the markdown recursion.)

---

## 5. Module-surface sync — sanity list is already complete; S4 adds a COMPLETENESS GUARD

**Verified module surface (Object.keys(mod).filter(typeof==="function")) = 19 functions:**
cleanToken, computeCodeRanges, default, emitText, estimateImageTokens, expandTildeAndResolve, extOf,
formatBinaryBlock, formatEmptyImageBlock, formatImageBlock, formatPagedDirectiveBlock, formatTextFileBlock,
hasValidImageMagic, inCode, injectFile, injectFiles, isAbsoluteOrTilde, isBinary, scanTokens.
**injectMarkdown is NOT exported** (`typeof mod.injectMarkdown === "undefined"`). ✓ (S3 kept it private.)

**Sanity list (L113-128, 16 asserts) covers 16 of the 19.** The 3 NOT asserted by name are PURE helpers tested
indirectly: `expandTildeAndResolve`, `extOf`, `isBinary` (intentional — they're exercised via injectFiles paths).
So the curated list is ALREADY complete for the POST-S3 surface. S3 added no assert (injectMarkdown private).

**S4 deliverable = a COMPLETENESS GUARD** (after L128) that pins "the gate asserts the real shipped surface":
1. `shippedFunctions = Object.keys(mod).filter(typeof==="function")`.
2. `ASSERTED_EXPORTS` (the 16 asserted names) ∪ `PURE_HELPERS_NOT_ASSERTED` (the 3 indirect helpers) ⊇ shippedFunctions → no UNEXPECTED exports (catches a future export added without an assert, AND catches injectMarkdown being accidentally exported).
3. `typeof mod.injectMarkdown === "undefined"` (the recursion driver MUST stay private).

Verified: shippedFunctions ⊆ (ASSERTED ∪ PURE) → `unexpected === []`; injectMarkdown undefined → guard PASSES on POST-S3.

---

## 6. Test placement + fixtures + path constants (POST-S3 anchors)

| What | Where | Anchor |
|---|---|---|
| module-surface guard (§5) | AFTER the last sanity assert (L128), before the blank line / section 7 comment | insert after `assert(typeof mod.estimateImageTokens ...)` |
| injectMarkdown fix (§2) | file-injector.ts injectMarkdown body (L578-602) | replace the scan→strip→recurse middle |
| fixtures: bigdoc.md, part1/2/3.txt, notesMissing.md, sub/outsider.md, shared/api.md (+ shared/ mkdir + sub/ exists from S3) | buildFixtures (among the writeFileSync calls ~L200-219) | match existing style |
| path consts: BIGDOC, PART1, PART2, PART3, NOTES_MISSING, OUTSIDER, SHARED_API | after HUGE (L229) / near the md consts S3 added | grouped with existing consts |
| new test section (case 20 + MD1 + MD2) | AFTER case 19's closing `});` (L1315), BEFORE `// 10. Summary` (L1317) | new `// ── SHARED BUDGET + MD EDGES ──` heading |

**Final gate target:** 72 (POST-S3) + 3 (case 20, MD1, MD2) = **`75 passed, 0 failed`**, exit 0. The sanity
list grows from 16 asserts to 16 + the completeness guard (a block, not a single named assert).

---

## 7. No-conflict with siblings / out-of-scope guards

- **S3 (DONE/LANDED):** S4's injectMarkdown fix touches ONLY the scan→strip→recurse middle (adds the stat
  pre-check); the claim/emit/recursion STRUCTURE is S3's. S4 does NOT change the MD_EXTS branch, scanTokens,
  emitText, injectFile's classification, or injectFiles' signature/return.
- **T3.S1 (README, Mode B, later):** S4's doc work is the test-surface guard (item §6 DOCS = Mode A). No
  README change (explicitly deferred to T3.S1).
- **Naming:** new cases are `20` (numeric, PRD §11 row 20) + `MD1`/`MD2` (named markdown edges; the "MD"
  prefix is free — no existing MDn). No collision with E1/F1/CC1/EIT1/BG1/PN1/15-19.
