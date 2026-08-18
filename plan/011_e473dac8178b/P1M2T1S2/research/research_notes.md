# Research Notes — P1.M2.T1.S2 (plan 011): Gates LINE-8 / LINE-11 / LINE-12

## Task
Add/verify the LINE-8 (LR-1 paged slice under tight budget), LINE-11 (LR-4 past-EOF start), LINE-12 (LR-5
clamped display) regression gates in file-injector.test.mjs, per the Line-Range feature §9 acceptance table.

## EMPIRICAL DISCOVERY — all three gates are ALREADY LANDED and GREEN
`node ./file-injector.test.mjs` → **179 passed, 0 failed**, including (line numbers current):
- `LINE-8` (L3086, shipped by LR-1 / P1.M1.T1.S1, commit f2d33dc) ✓
- `LINE-8-MD` (L3108, same) ✓ — markdown ranged-paged variant
- `LINE-12` (L3117, shipped by LR-5 / P1.M1.T1.S2, commit a5d0f5f) ✓
- `LINE-11` (L3201, shipped by LR-4 / P1.M1.T2.S3, commit 2e56a86 — the commit's stat shows
  `file-injector.test.mjs | 71 ++` i.e. the gate shipped WITH the fix) ✓
- (Sibling P1.M2.T1.S1's LINE-7 is also landed at L3063 ✓; LINE-9/LINE-10 from LR-2/LR-3 ✓.)
The implementation subtasks shipped their own gates (same pattern S1 discovered). The item's "three new
runCases" predates that. Re-adding them = duplication. The honest decomposition: VERIFY + ADD the ONE
genuinely missing discriminator (LINE-8b, below).

## Contract → coverage mapping (verified against the landed bodies)

### LINE-8 (L3086-3103) — LR-1 paged slice
| Contract clause | Landed coverage |
|---|---|
| tight budget + `#@huge.log:1-999999` | `mod.injectFiles("Summarize #@huge.log:1-999999", [], PAGED_FIX)` ✓ |
| `details[0].kind === 'paged'` | `d.kind === "paged"` ✓ |
| blocks contain head slice AND a `<paged:` directive | `blocks[0].startsWith('<file name="'+HUGE+'">')` + `blocks[0].length < content.length` (head) + `blocks[1].includes("offset:"+resumeLine)` (directive) ✓ |
| directive offset `=== 1 + headCompleteLineCount(head)` | `resumeLine = 1 + headLines` with `headLines` computed from `HUGE_LOG_CONTENT.slice(0,8192)`; asserts `d.range === ":"+resumeLine+"-"` + `d.pagedHeadLines === headLines` + `blocks[1].includes("offset:"+resumeLine)` ✓ |
| `result.paged` incremented | `r.paged === 1` ✓ (+ `r.injected === 1`) ✓ |
| (extras beyond contract) | `d.chars === expectedSliceLen` (slice-length accounting, trailing-newline noted) ✓ |

### LINE-11 (L3201-3230+) — LR-4 past-EOF start
| Contract clause | Landed coverage |
|---|---|
| `#@a.ts:99` on the 5-line fixture w/ spy ctx | (a) text path on inline `lr4_five.txt` (exactly 5 lines `l1..l5\n`) + `spyCtx(notes)` (hasUI:true, notify collector — mirrors LINE-10 / url-injection L703) ✓ |
| NO block with an empty body | `r.blocks.length === 0 && r.details.length === 0` ✓ |
| `injected:0` | `r.injected === 0` ✓ |
| claim released (`#@a.ts:1` later in SAME prompt still injects) | (b) `"…:99 then #@lr4_five.txt:1"` → `r2.injected === 1`, `hasBlock(r2,"l1\n")`, still exactly ONE warning ✓ |
| warning notify w/ line count in message | `notes[0].t === "warning"` + `notes[0].m === "#@<abs>:99 — not injected (file has 5 lines)"` ✓ |
| (extras) | (c) markdown path `#@lr4.md:3` → same failure + "file has 2 lines"; + clamped-END non-failure + 0-byte edge + start==lineCount boundary (per the case's header comment); try/finally inline-fixture cleanup ✓ |

### LINE-12 (L3117-3131) — LR-5 clamped display
| Contract clause | Landed coverage |
|---|---|
| `#@a.ts:2-100000` (5-line file, budget FIX → stays whole) | inline `lr5_five.txt` (`l1..l5\n`) + `FIX` (no budget → O-1 inline) ✓ |
| `details[0].range === ':2-5'` | `d.range === ":2-5"` ✓ |
| (extras) | `d.kind === "text"`; `d.lines === 4`; body `l2\nl3\nl4\nl5`; `!hasBlock("l1\n")`; prompt verbatim ✓ |

## THE ONE GENUINE GAP — LINE-8 cannot discriminate file- vs slice-coordinates
LINE-8 uses `:1-999999` → `startLine = 1` → file-coordinate resume `startLine + headLines` and the
slice-relative formula `1 + headLines` are **numerically identical** (`1 + headLines ≡ headLines + 1`).
The contract's sharpest parenthetical — "(FILE coordinates, **not slice-relative**)" (feature §5:
`resumeLine = startLine + complete-lines-in-slice-head`) — is untestable at startLine=1. A regression that
computed the resume from slice-relative line 1 would still pass LINE-8.

**Fix: LINE-8b** — `#@huge.log:3-999999` under PAGED_FIX. With startLine=3, file-coords (`3 + headLines`)
≠ slice-coords (`1 + headLines`) — off by exactly 2, a sharp discriminator.
- headLines computed the SAME dynamic way LINE-8 does: `(HUGE_LOG_CONTENT.slice(0, 8192).match(/\n/g) || []).length`
  (ASCII fixture → head is exactly 8192 units; robust regardless of the exact line count).
- Asserts: `r.paged === 1`; `d.kind === "paged"`; `d.range === ":" + (3 + headLines) + "-"`;
  `d.pagedHeadLines === headLines`; `r.blocks[1].includes("offset:" + (3 + headLines))`;
  negative: `!r.blocks[1].includes("offset:" + (1 + headLines))` (the slice-relative fingerprint must be ABSENT
  — mirrors LINE-26's smoking-gun discipline). Deliberately NO `chars` assert (line-1/2 removal length math
  adds fragility without adding discrimination; `:1-`'s chars is already pinned by LINE-8).
- ALSO pin the header: `r.blocks[0]` must START the head (first `HEAD_CHARS` of the SLICE — i.e. of lines 3+);
  the head must NOT contain line 1 of the file. Simple robust negative: `!r.blocks[0].split("<file")[1]...` —
  simpler: assert `!r.blocks[0].includes(HUGE_LINES[0])`-style marker. huge.log's first line content is
  deterministic (HUGE_LINES generator); the simplest robust check: `r.blocks[0].length < HUGE_LOG_CONTENT.length`
  (head-sized). Keep the discriminator set tight: paged/kind/range/pagedHeadLines/offset + the offset negative.

## Placement (identifier-based, zero merge friction)
Insert LINE-8b AFTER the `runCase("LINE-8-MD", …)` block's closing `});` (currently ~L3115) and BEFORE the
`runCase("LINE-12", …)` line (~L3117). Numeric order (8, 8-MD, 8b, 12). No overlap with: LINE-7 (sibling S1's,
landed before `// LINE-8`), LINE-11 (landed, after LINE-10), LINE-9/LINE-10 (landed, untouched).

## Harness facts (re-verified)
- `runCase(id, desc, fn)` / `assert(cond, msg)` / `hasBlock(r, needle)` (L202ish) / `FIX = { cwd: TMPDIR }`
  (no budget → O-1 inline-whole) / `PAGED_FIX` (getContextUsage tokens 10000 / window 50000; model.maxTokens
  8192 → remaining 23,616; threshold 0.6×23,616 ≈ 14,170 — documented inside LINE-8's comment).
- `HUGE_LOG_CONTENT` from buildFixtures (~2 MB ASCII; the whole-file paged path trips at this budget — case 20
  already proves whole-file paging; LINE-8/8b prove the SLICE pages).
- Direct-pipeline call: `mod.injectFiles(prompt, [], PAGED_FIX)` — no handler capture needed (LINE-8 pattern).
- Spy ctx (LINE-11 only, already landed): `{ cwd: TMPDIR, hasUI: true, ui: { notify: (m,t)=>notes.push({m,t}) } }`.
- Baseline **179 passed / 0 failed** (moving baseline: LINE-8b → 180). Gate = `0 failed` + the ✓ lines.
- npm test runs 4 .mjs files + typecheck (P1.M2.T1.S3's sweep — not this task's gate).

## Failure routing (item §4)
If LINE-8/8-MD/11/12 (landed) or LINE-8b (new) fails: the bug belongs to the LR-1/LR-4/LR-5 implementation
subtasks (P1.M1.T1.S1/S2, P1.M1.T2.S3 — all LANDED). REPORT with the assert message; do NOT weaken/skip.
For LINE-8b specifically, a failure on `offset:` = the directive computes slice-relative coordinates — an
engine bug in emitText's paged-range resume math (PRD §17.5: `sliceStart + headLines`).

## Scope boundaries
- file-injector.ts: NEVER edited (git diff empty).
- LINE-7/9/10 (sibling S1 + landed LR-2/LR-3): verify ✓ only, byte-identical.
- LINE-8/8-MD/12/11: verify ✓ only, byte-identical (they exceed the contract).
- Other suites (relative-imports / import-behavior / url-injection), README (P1.M2.T2.S1), typecheck sweep
  (P1.M2.T1.S3): untouched.