---
name: "P1.M2.T2.S1 — injectMarkdown: pass bareAt:state.bareAt + carry prefixLen through Step 3.5 + strip with prefixLen in Step 4 (with integration tests §11 #25-28 + §10 bare-@ edges)"
prd_ref: "PRD §4.6 (Optional bare-@ markdown imports), §5.6 (Markdown transitive imports — the six-step algorithm + Step 3.5 existence pre-check), §9 (Algorithm pseudocode: injectMarkdown scan call + Step-4 strip), §10 (Edge Cases: bare-@ rows), §11 (Test Plan #25-28)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — injectMarkdown Step 3 scan call + Step 3.5 injectable type + Step 4 strip + JSDoc
target_language: TypeScript (jiti transpile-on-load; `npm run typecheck` = tsc --strict gate; `node ./file-injector.test.mjs` = the regression gate)
depends_on: "P1.M1.T1.S1 (scanTokens bareAt?/prefixLen — LANDED) + P1.M1.T2.S1 (readConfig/FileInjectorConfig/.pi fixture — LANDED) + P1.M2.T1.S1 (State.bareAt + injectFiles 4th bareAt param + top-level bareAt:false + module cfg + session_start — LANDED, suite=107)."
consumed_by: "P1.M3.T1.S1 (full regression + typecheck gate; confirm injectMarkdown still private); P1.M3.T2.S1 (README optional bare-@ subsection)"
---

# PRP — P1.M2.T2.S1: Wire bare-@ into the markdown import branch (`injectMarkdown`) + §11 #25-28 + §10 bare-@ integration tests

> **Scope flag:** This is the **end-to-end bare-`@`-in-markdown wiring**. `injectMarkdown` is the LAST consumer
> of `bareAt`/`prefixLen`: it scans with `bareAt: state.bareAt`, carries `prefixLen` through its Step 3.5
> existence pre-check (so the filter forwards the whole record), and strips each INJECTABLE marker by
> `r.prefixLen` (not the hardcoded `+ 2`). With `bareAt===false` (default) behavior is **byte-for-byte identical**
> to today (the scan gains `bareAt:false` which adds no BARE_AT_RE matches; every record has prefixLen 2; the
> strip is `+ 2 == + r.prefixLen`). Three small source edits + JSDoc + 5 fixtures + 7 integration cases.
> `injectMarkdown` stays **PRIVATE** (exercised via `injectFiles`). Top-level scan/strip UNCHANGED (P1.M2.T1.S1).

---

## Goal

**Feature Goal:** Make `injectMarkdown` honor `state.bareAt` (so a markdown author who opts into
`markdownBareAtImports` can write a bare `@api.md` inside a `.md` and have it imported — wiki-style) and strip
the **correct number of marker chars** per import: 1 for a bare `@`, 2 for `#@` — by reading the `prefixLen`
that `scanTokens` (P1.M1.T1.S1) now attaches to every record. Three edits in the six-step body, all default-safe.

**Deliverable:** Modified `file-injector.ts` (injectMarkdown: Step 3 scan call +`bareAt: state.bareAt`; Step 3.5
`injectable` type annotation widened to `{ index; prefixLen; abs }[]`; Step 4 strip `r.index + 2` → `r.index + r.prefixLen`;
JSDoc Mode-A note) + modified `file-injector.test.mjs` (5 new markdown bare-@ fixtures + 5 path constants + 7
integration cases under a `P1.M2.T2.S1` banner). No new exports, no `injectMarkdown` export, no top-level change.

**Success Definition:**
1. `npm run typecheck` → `0 errors` under `--strict`.
2. `node ./file-injector.test.mjs` → baseline 107 + 7 new = **114 passed, 0 failed**, exit 0.
3. **Byte-for-byte default:** with `bareAt` off (the default — no config, or config `false`), markdown injection
   is identical to today. The existing 107 cases (incl. 92 core + cases 15-24 + MD1/MD2 + EDG-1..4 + T1.S1/T2.S1/M2.T1.S1
   cases) stay GREEN untouched.
4. **bare-@ on works end-to-end:** `injectFiles("…#@notesBare.md…", [], FIX, true)` injects the bare `@api.md`
   inside the markdown AND strips it to `api.md` (prefixLen 1) — proven by #26's smoking-gun guard against the
   `+ 2` bug (`!r.text.includes("Refs pi.md here.")`).
5. **Top-level unaffected:** `injectFiles("…@other.md…", [], FIX, true)` injects NOTHING for the top-level bare-@
   (top-level scan is `bareAt:false` — P1.M2.T1.S1 invariant), proven by #28.

## User Persona

**Target User:** A Pi end-user who opts into bare-`@` markdown imports via `~/.pi/agent/file-injector.json`
(global) or `<project>/.pi/file-injector.json` (trusted only), `{"markdownBareAtImports": true}`. With this
task, that opt-in finally produces user-visible behavior: a markdown file containing `@api.md` gets the file
injected (config → `session_start` → `cfg` → `bareAt` → `state.bareAt` → `injectMarkdown` scan call → match).

**Use Case:** The user writes a wiki-style doc `notes.md` that references `@api.md` (bare `@`, no `#`). With the
opt-in on, `#@notes.md` in the prompt now delivers `notes.md` (its `@api.md` marker stripped to `api.md`) AND
`api.md` itself — `notify "#@ injected 2 whole"`. Without the opt-in (default), `@api.md` stays verbatim in the
notes block and only `notes.md` is delivered (byte-for-byte today).

**User Journey (now complete end-to-end):** config `{"markdownBareAtImports":true}` → `session_start` →
`cfg = await readConfig(ctx)` (P1.M1.T2.S1) → `input` → `bareAt = cfg.markdownBareAtImports === true` →
`injectFiles(…, bareAt)` (P1.M2.T1.S1 Option A) → `state.bareAt = bareAt` (P1.M2.T1.S1) → `injectMarkdown` scans
with `bareAt: state.bareAt` (**THIS TASK**) → bare `@api.md` matched (BARE_AT_RE, prefixLen 1, P1.M1.T1.S1) →
Step 3.5 stat-check keeps it (exists) → Step 4 strips `@` (prefixLen 1, **THIS TASK**) → Step 5 emits notes block →
Step 6 recurses into api.md → `injectFile` injects + bumps count.

**Pain Points Addressed:** Before this task, the entire config→state→scan plumbing (P1.M1+M2.T1) is wired but
DORMANT in markdown: `injectMarkdown`'s scan call still omits `bareAt`, so even with the config on, a bare
`@api.md` inside a markdown is never matched. Worse, even if it were matched, Step 4's hardcoded `+ 2` would
strip 2 chars from a prefixLen-1 marker (leaving `pi.md`). This task closes both gaps — the final wiring + the
prefixLen-aware strip — making the opt-in actually work.

## Why

- **The last consumer of `bareAt`/`prefixLen`.** P1.M1.T1.S1 built the scan engine (`scanTokens` + `BARE_AT_RE`
  + `prefixLen`); P1.M1.T2.S1 + P1.M2.T1.S1 threaded `bareAt` from config through `State`. `injectMarkdown` is
  the ONLY remaining call site of `scanTokens` that still ignores `bareAt` and the ONLY stripper still hardcoded
  to `+ 2`. Wiring it completes the vertical slice — bare-`@` markdown imports go from "engine exists, nothing
  calls it" to "works end-to-end."
- **Markdown is the only place bare-`@` is allowed (PRD §4.6).** The top-level prompt is `#@`-only (Pi's own
  `@file`/`@mention` would collide). Bare-`@` is deliberately scoped to markdown *content* — authored files
  where there's no live `@` completion. `injectMarkdown` is exactly that boundary, so this is the one scan call
  that must pass `bareAt: state.bareAt`.
- **`prefixLen` was shipped forward precisely for this strip.** P1.M1.T1.S1 attached `prefixLen` to every record
  (2 for `#@`, 1 for bare `@`) "so a consumer can strip the correct marker width" — the seam for THIS task.
  Today all production records happen to have prefixLen 2 (bareAt off), so `+ 2` is coincidentally correct.
  Once bare-`@` records (prefixLen 1) flow, `+ 2` is a correctness bug (strips `@a`, leaving `pi.md`). This task
  fixes it to `+ r.prefixLen`.
- **Step 3.5 must forward `prefixLen`, not drop it.** The existence pre-check (`injectable`) filters `records`
  down to imports that stat-succeed as regular files. `records` now carry `prefixLen`; if `injectable`'s declared
  type stayed `{index, abs}[]`, Step 4 couldn't read `r.prefixLen` (type error). The fix is a TYPE annotation
  widening — the filter body (`injectable.push(r)`) is unchanged (it already forwards the whole record).
- **Decoupled, independently-green subtask.** This task touches ONLY `injectMarkdown` + adds tests. It does not
  touch the top-level scan/strip, `State`, `scanTokens`, `readConfig`, or the factory — all owned by prior
  landed subtasks. Each ships + tests independently.

## What

No user-visible change with the opt-in **off** (default): markdown injection is byte-for-byte identical. With
the opt-in **on** (or the `injectFiles` `bareAt` param `true`), a bare `@path` inside a delivered markdown is
matched, injected, and stripped to its path (1 char removed) — exactly like `#@path` (2 chars removed) but for
the bare marker.

### Success Criteria

- [ ] `injectMarkdown` Step 3 scan call passes `bareAt: state.bareAt` (the SEAM P1.M2.T1.S1 created).
- [ ] `injectMarkdown` Step 3.5 `injectable` type is `{ index: number; prefixLen: number; abs: string }[]`
      (the filter body `injectable.push(r)` is UNCHANGED — it already forwards the whole record).
- [ ] `injectMarkdown` Step 4 strip uses `r.index + r.prefixLen` (NOT `+ 2`); the comment notes r.index is the
      `#` for prefixLen 2 / the `@` for prefixLen 1 (zero-width lookbehind).
- [ ] Steps 5 (`emitText(abs, stripped, state)`) and 6 (recurse `injectable`) are UNCHANGED.
- [ ] `injectMarkdown` JSDoc (Mode A — item §6) documents the bareAt threading + the prefixLen-aware strip.
- [ ] 5 new markdown bare-@ fixtures (`notesBare.md`, `notesEmail.md`, `notesMention.md`, `notesMixDedup.md`,
      `other.md`) + 5 path constants in `buildFixtures`/constants block. Self-contained, non-colliding.
- [ ] 7 new integration cases pass (#25-28 + §10 e/f/g), via direct `mod.injectFiles(prompt, [], FIX[, true])`
      (Option A param — the established pattern for cases 15-24). #26 includes the `+ 2`-bug smoking-gun guard.
- [ ] `injectMarkdown` stays **PRIVATE** (no export; no ASSERTED_EXPORTS edit). NO changes to: top-level scan
      call (`bareAt:false`), top-level `#@` strip (`+ 2`), `State`, `processTokenStream`, `injectFiles`,
      `scanTokens`, `BARE_AT_RE`, `readConfig`, the factory, `captureHandler`/`makeMockCtx`.
- [ ] Existing 107 cases stay GREEN (byte-for-byte default — `bareAt:false` adds no matches; prefixLen always 2;
      `+ 2 == + r.prefixLen`).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_ **Yes.**
This PRP includes: the exact current `injectMarkdown` body (L692-735, read verbatim — the three edit sites with
their precise line refs against the LANDED M2.T1.S1 tree), the CRITICAL type-only Step 3.5 insight (why widening
the `injectable` annotation unlocks Step 4 without touching the filter body), the `+ 2`-bug mechanics (why a
prefixLen-1 strip under `+ 2` leaves `pi.md` — and the exact assertion that catches it), the byte-for-byte-default
proof (bareAt:false → no new matches → prefixLen always 2 → `+ 2 == + r.prefixLen`), the index math for the dedup
case (g), the 5 fixture specs (reusing existing `api.md`), the 7 exact test specs (reusing `countFileBlocks`,
`FIX`, `API`, the existing `notes.md`), and both verified gates. The implementer edits one source file in 3 small
regions + JSDoc, and one test file (5 fixtures + 5 constants + 7 cases).

### Documentation & References

```yaml
# MUST READ — the function-level delta contract for THIS plan (§8 is the injectMarkdown change spec)
- file: plan/005_b7c78dbf73b1/architecture/codebase_delta.md
  why: "§8 pins the THREE edits verbatim: (1) Step 3 scan call +`bareAt: state.bareAt`; (2) Step 3.5 `injectable`
        becomes {index;prefixLen;abs}[] — 'the filter forwards the WHOLE record (do NOT drop prefixLen here)';
        (3) Step 4 strip `+ r.prefixLen` replacing `+ 2`. §11 Mode-A docs: injectMarkdown JSDoc rides WITH the work."
  critical: "§8.2 is explicit: 'records already have [prefixLen]; the filter just forwards the whole record' — so the
             Step 3.5 change is a TYPE-ANNOTATION widening ONLY. Do NOT restructure the filter or build a new object.
             The existing `injectable.push(r)` already forwards prefixLen; only the declared element type narrows
             what Step 4 can read. Widening it is the entire change."

# MUST READ — the spec for §4.6 (markdown-only, opt-in, prefixLen strip) + §5.6 (the six steps + Step 3.5) + §10 + §11 #25-28
- file: PRD.md
  why: "§4.6 'Effect': 'The marker is stripped to its path just like #@ (stripping 1 char instead of 2).' §5.6
        defines the six steps + Step 3.5 existence pre-check (a markdown import resolving to a MISSING file/dir
        is left verbatim, NOT stripped — PRESERVE this). §10 rows: '@api.md in a.md (exists) → marker stripped to
        api.md'; '#@api.md with the option on → matched once by #@, never double-matched'; '@username in prose
        (option on; no username.md) → left verbatim'; 'user@host.com in markdown (option on) → not matched
        (mid-word)'; '@api.md at the top level (option on) → Unaffected'. §11 #25-28 are the exact integration specs."
  section: "### 4.6 (Effect + Scope paragraphs) + ## 5.6 (six steps + 3.5) + ## 10 (bare-@ rows) + ## 11 (#25-28)"

# The PREDECESSOR PRP (the State.bareAt + injectFiles-4th-param + top-level bareAt:false CONTRACT I consume)
- file: plan/005_b7c78dbf73b1/P1M2T1S1/PRP.md
  why: "LANDED (suite=107). State has REQUIRED `bareAt: boolean`; `injectFiles(text, imagesIn, ctx, bareAt = false)`
        — the 4th param (Option A) is the direct-test entry I call as `mod.injectFiles(prompt, [], FIX, true)`;
        `state.bareAt = bareAt` is set in injectFiles; the top-level processTokenStream call passes `bareAt:false`
        (HARDCODED — do NOT touch). The SEAM this task reads is exactly `state.bareAt`."
  critical: "P1.M2.T1.S1's anti-pattern list: 'Do NOT touch injectMarkdown. Its scan call, injectable type, Step-4
             strip = ALL P1.M2.T2.S1.' — that is THIS task. Also: injectFiles has NO `!text.includes('#@')` pre-check
             (that guard is in the INPUT handler, not injectFiles), so `injectFiles('Read @other.md', [], FIX, true)`
             runs the full pipeline (processTokenStream with bareAt:false) → injected=0. Used by #28."

# The engine PRP (the scanTokens prefixLen CONTRACT I consume)
- file: plan/005_b7c78dbf73b1/P1M1T1S1/PRP.md
  why: "LANDED. scanTokens opts `{allowAbsTilde, skipCode, tryMdExt, bareAt?: boolean}`; returns
        `Promise<{index, prefixLen, abs}[]>`; cands union (FILE_INJECT_RE prefixLen 2; BARE_AT_RE when bareAt
        prefixLen 1); dedup on resolved abs. BARE_AT_RE forbids a preceding `#` (no double-match) and a preceding
        word char (user@host.com / Unicode excluded). My `records`/`injectable` already carry prefixLen — I just
        USE it in Step 4."
  critical: "scanTokens' bareAt is OPTIONAL (so my scan call adding `bareAt: state.bareAt` typechecks — state.bareAt
             is a boolean, a valid value for an optional boolean opt). The records ALWAYS carry prefixLen regardless
             of bareAt (2 for #@ always; 1 for bare-@ when matched)."

# The file you edit (source) — the 3 small regions + JSDoc
- file: file-injector.ts
  why: "~1010 lines (post M2.T1.S1). injectMarkdown L692 (PRIVATE async); Step 3 scan call L699; Step 3.5
        `injectable` type annotation L710 (`{ index: number; abs: string }[]`); Step 4 strip L723-724
        (`stripped.slice(0, r.index) + stripped.slice(r.index + 2)`); Step 5 emitText L730; Step 6 recurse L733.
        JSDoc L650-691. State.bareAt L290 (LANDED). scanTokens L475 (LANDED, bareAt?/prefixLen)."
  pattern: "injectMarkdown is the markdown six-step branch called by injectFile (L589). Its scan call is the ONLY
            scanTokens caller that still omits bareAt (the other two — processTokenStream L799 top-level, always
            bareAt:false; and scanTokens unit tests — already pass it)."
  gotcha: "Step 3.5 today compiles because `{index,prefixLen,abs}` (records) is assignable to the narrower
           `{index,abs}` (injectable declared type) via structural subtyping — so `injectable.push(r)` typechecks.
           But the declared element type lacks prefixLen → Step 4 CANNOT read `r.prefixLen` (error). Widening the
           annotation to `{index,prefixLen,abs}[]` is the fix; the push body is byte-for-byte unchanged."

# The gate you also edit (test harness) — 5 fixtures + 5 constants + 7 cases
- file: file-injector.test.mjs
  why: "~1980 lines. buildFixtures L198-275 (markdown fixtures at L214-237; ADD my 5 fixtures here with the §4.6
        banner). Path constants L314-350 (ADD my 5 constants here). countFileBlocks helper L354 (REUSE). FIX={cwd:TMPDIR}
        L311; API=TMPDIR/api.md L315; NOTES=TMPDIR/notes.md L314 (REUSE for #27). Existing markdown integration cases
        15-19 at L1399-1456 (the ASSERTION IDIOMS to mirror: r.injected count, r.text.includes('Imports api.md here.'),
        !r.text.includes('Imports #@api.md here.'), countFileBlocks===1, pre-order indexOf). EDG-3 dedup at L1709 (the
        dedup idiom for g). T1.S1-8..13 scanTokens bare-@ unit tests at L1753-1836 (the bare-@/prefixLen vocabulary).
        Place my 7 cases under a `// ── P1.M2.T2.S1 ──` banner BEFORE the '10. Summary' block L1960."
  pattern: "new runCase blocks call `mod.injectFiles(prompt, [], FIX, true)` (bareAt on) or `mod.injectFiles(prompt,
            [], FIX)` (bareAt off default). Assert on r.injected (the count), r.paged, r.text.includes(...) for
            stripped/verbatim markers, and countFileBlocks(r.text, ABS) for dedup. Mirror cases 15/EDG-3 exactly."
  gotcha: "buildFixtures is NOT touched by any parallel task (P1.M2.T1.S1 added none — it reuses the .pi fixture from
           T2.S1). So adding my 5 markdown fixtures here is collision-free. Reuse the EXISTING api.md (#25/#26/#27/g)
           and notes.md (#27) — do NOT duplicate them. #28 needs a NEW other.md (a top-level bare-@ target that must
           EXIST so a wrong top-level bareAt:true would inject it → the assertion injected===0 is meaningful)."

# VERIFIED API — state.bareAt is the boolean seam (set by P1.M2.T1.S1 in the injectFiles State literal)
- file: plan/005_b7c78dbf73b1/architecture/api_verification.md
  why: "State is built inside injectFiles (P1.M2.T1.S1) and threaded into injectMarkdown as the 3rd arg. state.bareAt
        is a plain boolean (true when cfg.markdownBareAtImports===true). My scan call `bareAt: state.bareAt` reads it
        directly. No ctx/cfg needed in injectMarkdown — bareAt arrives via State (the decoupling P1.M2.T1.S1 chose)."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "`npm run typecheck` runs tsc --strict against the global pi .d.ts. Must stay 0 errors. The ONLY type change
        is the `injectable` annotation widening (L710). The scan call opts gains `bareAt: state.bareAt` — scanTokens'
        bareAt is OPTIONAL (accepts boolean) so this is typecheck-clean. Step 4 reads `r.prefixLen` — valid only after
        the widening lands. No cascade (injectMarkdown is private; no caller sees its internals)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (injectMarkdown L699 scan call; L710 injectable type; L724 Step-4 strip; L650 JSDoc)
├── file-injector.test.mjs    # ← EDITED (buildFixtures +5 fixtures; constants +5; +7 cases before L1960 Summary)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README = P1.M3.T2.S1)
└── plan/005_b7c78dbf73b1/
    ├── architecture/{codebase_delta.md (§8 = my contract), api_verification.md, system_context.md}
    ├── P1M1T1S1/{research, PRP.md}   # LANDED: BARE_AT_RE + scanTokens bareAt?/prefixLen
    ├── P1M1T2S1/{research, PRP.md}   # LANDED: readConfig + FileInjectorConfig + .pi fixture
    ├── P1M2T1S1/{research, PRP.md}   # LANDED: State.bareAt + injectFiles 4th param + top-level bareAt:false + cfg/session_start
    └── P1M2T2S1/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — injectMarkdown: Step 3 scan call +bareAt:state.bareAt; Step 3.5 injectable type
                          #                   widened to {index,prefixLen,abs}[]; Step 4 strip +r.prefixLen; JSDoc Mode-A note.
file-injector.test.mjs    # MODIFIED — buildFixtures +5 markdown fixtures (notesBare/notesEmail/notesMention/notesMixDedup/
                          #                   other.md); constants +5 (NOTES_BARE/NOTES_EMAIL/NOTES_MENTION/NOTES_MIX_DEDUP/
                          #                   OTHER_MD); +7 runCase integration cases (#25-28 + §10 e/f/g).
# No other files. No new files. No new exports (injectMarkdown stays PRIVATE). No ASSERTED_EXPORTS/guard edit.
# No top-level scan/strip change. No State/scanTokens/readConfig/factory change.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the Step 3.5 change is a TYPE-ANNOTATION widening ONLY. The existing filter compiles today because
//   `{index,prefixLen,abs}` (records, from scanTokens) is assignable to the narrower declared `{index,abs}`
//   (injectable) via structural subtyping — so `injectable.push(r)` typechecks. BUT the declared element type lacks
//   `prefixLen`, so Step 4 CANNOT read `r.prefixLen` (tsc error today if you tried). The fix: widen the annotation
//   to `{ index: number; prefixLen: number; abs: string }[]`. The filter BODY (`injectable.push(r)`) is byte-for-byte
//   UNCHANGED — it already forwards the whole record (prefixLen included). Do NOT restructure the loop or build a new
//   object literal (a literal `{index:r.index, abs:r.abs}` would DROP prefixLen — exactly the anti-pattern codebase_delta
//   §8.2 warns against: "do NOT drop prefixLen here").

// CRITICAL — Step 4 MUST use `r.index + r.prefixLen`, NOT `+ 2`. With bareAt on, a bare `@api.md` record has
//   prefixLen 1; its `r.index` is the `@` (BARE_AT_RE's match starts at `@` — the lookbehind (?<![\p{L}\p{N}_#]) is
//   zero-width). Stripping `+ 2` would remove `@a` (2 chars), leaving `pi.md` instead of `api.md`. With prefixLen 2
//   (#@), r.index is the `#`; `+ 2` removes `#@` correctly — so `+ r.prefixLen` is `+ 2` for #@ (unchanged) and `+ 1`
//   for bare-@ (the fix). The #26 test's `!r.text.includes("Refs pi.md here.")` is the smoking-gun guard.

// CRITICAL — byte-for-byte DEFAULT guarantee. With bareAt===false (the default): (a) the scan call gains
//   `bareAt:false`, which adds NO BARE_AT_RE matches (scanTokens' `if (opts.bareAt)` guards it) — so records are
//   byte-for-byte identical to today (only #@ matches, all prefixLen 2); (b) Step 4 strips `+ r.prefixLen` == `+ 2`
//   (every record has prefixLen 2). So markdown injection is identical to today; the 107 existing cases stay GREEN.
//   This is the load-bearing safety property — if ANY existing markdown case flips, you changed behavior when bareAt
//   is off (re-check that you passed `bareAt: state.bareAt`, NOT `bareAt: true`, in the scan call).

// GOTCHA — Step 6 (recurse) reads `r.abs` only (`if (state.injectedSet.has(r.abs)) continue; await injectFile(r.abs,…)`).
//   `r.abs` is in the widened `{index,prefixLen,abs}` type → unchanged. Do NOT touch Step 6. Step 5 (`emitText(abs,
//   stripped, state)`) operates on `stripped` (already prefixLen-aware after Step 4) and `abs` (the file path) — also
//   unchanged.

// GOTCHA — `injectFiles` has NO `!text.includes("#@")` pre-check (that guard is in the INPUT handler, not injectFiles).
//   So `mod.injectFiles("Read @other.md", [], FIX, true)` runs processTokenStream in FULL — which passes bareAt:false
//   (P1.M2.T1.S1 hardcoded) → no top-level bare-@ match → injected=0. This is why #28's `injected===0` is meaningful:
//   if the top-level scan WRONGLY passed bareAt:true, @other.md would inject → injected=1 → assertion fails.

// GOTCHA — reuse EXISTING api.md (TMPDIR/api.md = "# API\n\nTop-level API surface.\n", buildFixtures L215) for #25/#26/
//   #27/g. It exists; a bare `@api.md` resolves to it. Do NOT create a second api.md fixture. #27 reuses the EXISTING
//   notes.md (L214, has `#@api.md` + fenced `#@example.ts`). Only #28 needs a NEW top-level target (other.md) that
//   must EXIST so the top-level-exclusion assertion is meaningful.

// GOTCHA — the +2-bug guard assertion (`!r.text.includes("Refs pi.md here.")`) is fragile to fixture wording. If you
//   change notesBare.md's content, recompute: the bare-@ marker's index + a wrong +2 strip leaves the tail after the
//   first char of the path. For "Refs @api.md here.": `@` at index 5; +2 removes indices 5-6 ("@a") → "Refs pi.md
//   here." So assert the WRONG output "pi.md" is absent AND the RIGHT output "api.md" is present. Both together pin it.

// LIBRARY — TypeScript via jiti (Pi's loader). No build step. jiti transpiles-on-load (no strict type-check at load),
//   BUT `npm run typecheck` (tsc --strict) IS a separate gate that WILL catch the `r.prefixLen` read if the injectable
//   widening didn't land. Both gates: `npm run typecheck` AND `node ./file-injector.test.mjs`.
```

## Implementation Blueprint

### Data models and structure

No new data models. `scanTokens` (P1.M1.T1.S1) ALREADY returns `{ index: number; prefixLen: number; abs: string }[]`.
`State` (P1.M2.T1.S1) ALREADY has `bareAt: boolean`. This task only changes how `injectMarkdown` CONSUMES those.

The one type-level edit is widening the `injectable` array's declared element type so Step 4 can read `prefixLen`:

```ts
// Step 3.5 — BEFORE (L710): the declared type DROPS prefixLen (a latent bug once bare-@ records flow).
const injectable: { index: number; abs: string }[] = [];
// Step 3.5 — AFTER: forward the WHOLE record (prefixLen included). The filter body (injectable.push(r)) is UNCHANGED.
const injectable: { index: number; prefixLen: number; abs: string }[] = [];
```

### The source edits (file-injector.ts — injectMarkdown, L692-735)

```ts
// ── (1) Step 3 scan call (L699) — add bareAt: state.bareAt ──
// BEFORE:
const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true }, state);
// AFTER:
// §4.6 — bare-@ markdown imports opt-in: thread state.bareAt (set from cfg in injectFiles) into the scan.
// bareAt:false (default) → BARE_AT_RE not run → byte-for-byte identical to today (records all prefixLen 2).
const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

// ── (2) Step 3.5 injectable type (L710) — widen to carry prefixLen (TYPE-ONLY; filter body unchanged) ──
// BEFORE:
const injectable: { index: number; abs: string }[] = [];
// AFTER: (the `injectable.push(r)` body below is UNCHANGED — r already has prefixLen from records; widening the
//        declared type is what lets Step 4 read r.prefixLen. Do NOT build a new object — that would drop prefixLen.)
const injectable: { index: number; prefixLen: number; abs: string }[] = [];

// ── (3) Step 4 strip (L723-724) — r.index + 2 → r.index + r.prefixLen ──
// BEFORE:
for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
  stripped = stripped.slice(0, r.index) + stripped.slice(r.index + 2); // m.index is the '#' (lookbehind is zero-width)
}
// AFTER:
for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
  // §4.6 — strip the marker by its width: prefixLen 2 for `#@` (r.index is the '#'), 1 for bare `@` (r.index is the
  // '@'). Both regexes' lookbehinds are zero-width, so r.index is always the marker's first char. The path stays.
  stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);
}
// Steps 5 (emitText(abs, stripped, state)) and 6 (recurse over injectable, r.abs) — UNCHANGED.
```

### The test-harness edits (file-injector.test.mjs)

```js
// ── (4) buildFixtures — ADD 5 markdown bare-@ fixtures (near L214-237, with a §4.6 banner) ──
//   Reuse the EXISTING api.md (#25/#26/#27/g) and notes.md (#27). Self-contained, non-colliding names.
// ── §4.6 bare-@ markdown-import fixtures (PRD §4.6 — P1.M2.T2.S1 cases #25-28 + §10 e/f/g). ──
//   notesBare.md: a bare `@api.md` (reuses the existing top-level api.md). notesEmail.md: a mid-word `user@host.com`
//   (excluded by BARE_AT_RE's word-char lookbehind). notesMention.md: a bare `@username` (no username.md → not
//   resolved). notesMixDedup.md: BOTH `#@api.md` and `@api.md` (same resolved abs → dedup). other.md: a top-level
//   bare-@ TARGET that must EXIST so #28's top-level-exclusion assertion is meaningful (a wrong bareAt:true would
//   inject it). global ~/.pi/agent/file-injector.json is NOT touched (real home dir). ──
fsSync.writeFileSync(path.join(TMPDIR, "notesBare.md"), "# Bare Notes\n\nRefs @api.md here.\n");
fsSync.writeFileSync(path.join(TMPDIR, "notesEmail.md"), "# Email\n\nContact user@host.com.\n");
fsSync.writeFileSync(path.join(TMPDIR, "notesMention.md"), "# Mention\n\nPing @username now.\n");
fsSync.writeFileSync(path.join(TMPDIR, "notesMixDedup.md"), "Refs #@api.md and @api.md.\n");
fsSync.writeFileSync(path.join(TMPDIR, "other.md"), "# Other\n\nTop-level bare-@ target.\n");

// ── (5) Path constants (near L314-350) ──
const NOTES_BARE = path.join(TMPDIR, "notesBare.md");
const NOTES_EMAIL = path.join(TMPDIR, "notesEmail.md");
const NOTES_MENTION = path.join(TMPDIR, "notesMention.md");
const NOTES_MIX_DEDUP = path.join(TMPDIR, "notesMixDedup.md");
const OTHER_MD = path.join(TMPDIR, "other.md");
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT Step 3 scan call (file-injector.ts injectMarkdown L699)
  - CHANGE: add `bareAt: state.bareAt` to the scanTokens opts literal.
  - ADD a §4.6 comment (markdown-only opt-in; bareAt:false default → byte-for-byte; state.bareAt is the P1.M2.T1.S1 seam).
  - DO NOT touch any other scanTokens caller (processTokenStream top-level L799 stays bareAt:false).

Task 2: EDIT Step 3.5 injectable type (file-injector.ts L710)
  - CHANGE the type annotation ONLY: `{ index: number; abs: string }[]` → `{ index: number; prefixLen: number; abs: string }[]`.
  - DO NOT touch the filter body (`injectable.push(r)` already forwards the whole record incl. prefixLen).
  - DO NOT build a new object literal in the push (that would DROP prefixLen — the §8.2 anti-pattern).

Task 3: EDIT Step 4 strip (file-injector.ts L723-724)
  - CHANGE: `stripped.slice(r.index + 2)` → `stripped.slice(r.index + r.prefixLen)`.
  - UPDATE the comment (prefixLen 2 for #@ / r.index is '#'; prefixLen 1 for bare @ / r.index is '@'; lookbehind zero-width).
  - DO NOT touch Step 5 (emitText) or Step 6 (recurse) — they use stripped/r.abs, unchanged.

Task 4: UPDATE injectMarkdown JSDoc (file-injector.ts L650-691) [Mode A — item §6]
  - ADD a note in the six-step docblock: Step 3 now passes `bareAt: state.bareAt` (§4.6 markdown-only opt-in; the
    seam P1.M2.T1.S1 created); Step 3.5 `injectable` carries `prefixLen`; Step 4 strips `r.index + r.prefixLen`
    (1 for bare `@`, 2 for `#@`). Note the byte-for-byte-default guarantee (bareAt:false → no new matches → +2==+prefixLen).

Task 5: ADD 5 fixtures + 5 path constants (file-injector.test.mjs buildFixtures ~L237 + constants ~L350)
  - SEE the test-harness edits above. Reuse EXISTING api.md (#25/#26/#27/g) and notes.md (#27).
  - DO NOT duplicate api.md/notes.md. DO NOT touch the .pi fixture (T2.S1 owns it). DO NOT touch other fixtures.

Task 6: ADD 7 integration cases (file-injector.test.mjs, under a `// ── P1.M2.T2.S1 ──` banner, before L1960 Summary)
  - All via direct `mod.injectFiles(prompt, [], FIX[, true])` (Option A param — the established pattern for 15-24).
  - (a) #25 default-off: `mod.injectFiles("Review #@notesBare.md", [], FIX)` → injected===1, paged===0;
        `r.text.includes("Refs @api.md here.")` (VERBATIM); `!r.text.includes('<file name="'+API+'">')`;
        countFileBlocks(r.text, API)===0. Banner note: bareAt defaults false → bare-@ not scanned.
  - (b) #26 on: `mod.injectFiles("Review #@notesBare.md", [], FIX, true)` → injected===2, paged===0;
        both NOTES_BARE + API blocks present, NOTES_BARE before API (pre-order);
        `r.text.includes("Refs api.md here.")` (prefixLen 1 strip — '@' removed);
        `!r.text.includes("Refs @api.md here.")` (marker must not retain '@');
        `!r.text.includes("Refs pi.md here.")` (SMOKING-GUN +2-bug guard: +2 would leave 'pi.md').
  - (c) #27 on+#@: `mod.injectFiles("Review #@notes.md", [], FIX, true)` → injected===2 (notes.md reuses existing,
        has #@api.md); countFileBlocks(r.text, API)===1 (matched ONCE, no double-match);
        `r.text.includes("Imports api.md here.")` & `!r.text.includes("Imports #@api.md here.")` (prefixLen 2 strip);
        `r.text.includes("#@example.ts")` (fenced code still verbatim, code-exempt even with bareAt on).
  - (d) #28 on+top-level: `mod.injectFiles("Read @other.md", [], FIX, true)` → injected===0; `r.text === "Read @other.md"`
        (byte-for-byte — count===0 returns original); `!r.text.includes('<file name="'+OTHER_MD+'">')`.
        Banner note: top-level scan is bareAt:false (P1.M2.T1.S1); a WRONG bareAt:true would inject other.md → injected===1.
  - (e) §10 email: `mod.injectFiles("Read #@notesEmail.md", [], FIX, true)` → injected===1 (only notesEmail.md);
        `r.text.includes("Contact user@host.com.")` (mid-word @ VERBATIM — BARE_AT_RE word-char lookbehind).
  - (f) §10 mention: `mod.injectFiles("Read #@notesMention.md", [], FIX, true)` → injected===1;
        `r.text.includes("Ping @username now.")` (no username.md → not resolved → VERBATIM).
  - (g) §10 dedup: `mod.injectFiles("Review #@notesMixDedup.md", [], FIX, true)` → injected===2 (notesMixDedup.md + api.md);
        countFileBlocks(r.text, API)===1 (dedup on resolved abs);
        `r.text.includes("Refs api.md and @api.md.")` (first #@ stripped to api.md; second @ VERBATIM);
        `!r.text.includes("Refs #@api.md")` (first marker must not retain #@).
  - NAMING: runCase(25, …) / runCase(26, …) / runCase(27, …) / runCase(28, …) for the PRD matrix cases;
    runCase("M2.T2.S1-e", …) / ("M2.T2.S1-f", …) / ("M2.T2.S1-g", …) for the §10 edges (mirror the EDG-* naming).
  - NOTE in the banner: these exercise the FULL injection pipeline via injectFiles' bareAt param (Option A); the
    config→session_start→input→injectFiles path is covered by P1.M2.T1.S1's integration tests (M2.T1.S1-a..c).

Task 7: VERIFY gates (no code change)
  - npm run typecheck → 0 errors. (If it fails: "Property 'prefixLen' does not exist on type '{index;abs}'" at L724 →
    Task 2 didn't widen the injectable type. "Property 'bareAt' does not exist" at the scan call → state.bareAt missing,
    i.e. P1.M2.T1.S1 didn't land — re-check L290.)
  - node ./file-injector.test.mjs → 107 baseline + 7 new = 114 passed, 0 failed, exit 0. ALL existing cases GREEN.
```

### Implementation Patterns & Key Details

```ts
// The CRITICAL edit — Step 4 prefixLen-aware strip. r.index is the marker's FIRST char for BOTH regexes
// (the lookbehinds are zero-width). prefixLen is 2 for #@ (r.index → '#'), 1 for bare @ (r.index → '@').
//   "#@api.md" at index i: slice(0,i)+slice(i+2) → "api.md"  (correct today; unchanged by +r.prefixLen since 2==2)
//   "@api.md"  at index i: slice(0,i)+slice(i+1) → "api.md"  (CORRECT; the +2 bug would do slice(i+2) → "pi.md")
for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
  stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);
}
// High→low sort PRESERVES earlier offsets (strip from the end backward) — UNCHANGED from today.

// The Step 3.5 type widening (the ONLY other source change besides the scan call). The push body is identical:
const injectable: { index: number; prefixLen: number; abs: string }[] = [];   // was { index; abs }[]
for (const r of records) {                                                     // records: {index,prefixLen,abs}[] (scanTokens)
  try {
    const st = await fs.stat(r.abs);
    if (st.isFile()) injectable.push(r);                                       // forwards the WHOLE record (prefixLen kept)
  } catch { /* missing/unreadable → verbatim */ }
}
// PRESERVE Step 3.5's existence pre-check entirely (PRD §10 / §5.4): a markdown import resolving to a MISSING
// file/dir is left VERBATIM, not stripped. This is an improvement over PRD §9 pseudocode — DO NOT remove it.
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - injectMarkdown Step 3 scan call (L699): opts +`bareAt: state.bareAt`.
  - injectMarkdown Step 3.5 injectable type (L710): widen to {index; prefixLen; abs}[] (TYPE-ONLY; push body unchanged).
  - injectMarkdown Step 4 strip (L723-724): `r.index + 2` → `r.index + r.prefixLen`; update comment.
  - injectMarkdown JSDoc (L650-691): +Mode-A note (bareAt threading + prefixLen strip + byte-for-byte default).
  - UNCHANGED: Step 5 (emitText L730); Step 6 (recurse L733); Step 2 (claim self L697); the rest of injectMarkdown.
  - UNCHANGED: top-level processTokenStream scan call (L799 bareAt:false); top-level #@ strip (+2); State (L282);
    processTokenStream (L523); injectFiles (L712 sig + L783 State init + L799 scan call); scanTokens (L475);
    BARE_AT_RE (L15); readConfig/FileInjectorConfig (L146/155); factory; autocomplete; every helper.

FILE_EDITS (file-injector.test.mjs):
  - buildFixtures (~L237): +5 markdown bare-@ fixtures (notesBare/notesEmail/notesMention/notesMixDedup/other.md) under a §4.6 banner.
  - constants (~L350): +5 path constants (NOTES_BARE/NOTES_EMAIL/NOTES_MENTION/NOTES_MIX_DEDUP/OTHER_MD).
  - new cases (before L1960 Summary): +7 runCase blocks (#25/#26/#27/#28 + M2.T2.S1-e/f/g) under a `// ── P1.M2.T2.S1 ──` banner.
  - UNCHANGED: ASSERTED_EXPORTS, PURE_HELPERS_NOT_ASSERTED, sanity list, captureHandler/makeMockCtx (M2.T1.S1 owns them),
    every existing fixture/constant/case, the .pi fixture (T2.S1).

NO_CHANGES: package.json, scripts/typecheck.mjs, PRD.md, README.md, all plan/ files. NO new files. NO new exports
             (injectMarkdown stays PRIVATE; no ASSERTED_EXPORTS edit). NO top-level scan/strip change.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it fails:
#   - "Property 'prefixLen' does not exist on type '{ index: number; abs: string; }'" at injectMarkdown Step 4 (L724)
#     → Task 2 didn't widen the `injectable` annotation. Fix: `{ index: number; prefixLen: number; abs: string }[]`.
#   - "Property 'bareAt' does not exist on type 'State'" at the Step 3 scan call → P1.M2.T1.S1 didn't land (re-check
#     State L282-290 has `bareAt: boolean`). It DID (suite was 107) — re-check you're reading state.bareAt not a typo.
#   - Anything about scanTokens opts → scanTokens' bareAt is OPTIONAL (L478); `bareAt: state.bareAt` (boolean) is valid.
```

### Level 2: The Regression + New-Tests Gate (the .mjs suite)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 7 new cases (25, 26, 27, 28, M2.T2.S1-e/f/g) print ✓, then:
#   ──────────────────────────────────────────────────────────────────────────
#   Result: 114 passed, 0 failed.        (107 baseline + 7 new)
#   ──────────────────────────────────────────────────────────────────────────
# Exit code 0.
#
# CRITICAL checks:
#   - The 107 existing cases (92 core + T1.S1's 6 + T2.S1's 4 + M2.T1.S1's 5) MUST stay GREEN. If ANY markdown case
#     flips (esp. 15-24, MD1/MD2, EDG-1..4), you changed behavior when bareAt is off — re-check the Step 3 scan call
#     passes `bareAt: state.bareAt` (NOT `bareAt: true`), and Step 4 uses `+ r.prefixLen` (every default record has
#     prefixLen 2, so the strip is `+ 2` — identical to today).
#   - Case #26 MUST pass BOTH `r.text.includes("Refs api.md here.")` AND `!r.text.includes("Refs pi.md here.")`.
#     If the SECOND fails (pi.md present), Step 4 still hardcodes `+ 2` → fix Task 3. If the FIRST fails, the bare-@
#     marker wasn't matched/injected → fix Task 1 (scan call bareAt) or the fixture.
#   - Case #28 MUST be injected===0. If injected===1, the top-level scan passed bareAt:true — but that's P1.M2.T1.S1's
#     call (L799), NOT this task's. Re-check you didn't accidentally touch the top-level scan call.
```

### Level 3: Targeted invariant checks

```bash
node ./file-injector.test.mjs 2>&1 | grep -iE "M2.T2.S1|#2[5-8]|bare-@|prefixLen|top-level|Result:|15 |16 |17 |MD1|EDG-3"
# Expected: 7 ✓ for the new cases; cases 15/16/17/MD1/EDG-3 still ✓; "Result: 114 passed, 0 failed."
#
# If #25 ✗ (injected 2, api.md present) → bareAt treated as on by default; the scan call passed bareAt:true or
#   state.bareAt leaked true (it shouldn't — injectFiles defaults false). Re-check Task 1 + that you call injectFiles
#   WITHOUT the 4th arg for #25.
# If #26 ✗ "pi.md" → Step 4 still +2 (Task 3 bug). If #26 ✗ "api.md absent" → the bare-@ wasn't matched (Task 1 scan
#   call missing bareAt, or fixture wording). If #26 ✗ injected≠2 → api.md not injected (check fixture api.md exists).
# If #27 ✗ (api.md twice) → BARE_AT_RE double-matched #@ (T1.S1 regression — but #27 uses #@notes.md, no bare-@, so
#   this would indicate a scanTokens bug; re-run T1.S1-10). If #27 ✗ "Imports #@api.md" → prefixLen-2 strip regressed.
# If #28 ✗ (injected 1) → top-level scan passed bareAt:true (NOT this task — P1.M2.T1.S1 L799); do NOT "fix" it here.
# If (e) ✗ (user@host.com stripped) → BARE_AT_RE matched mid-word (T1.S1 regression — re-run T1.S1-11).
# If (g) ✗ (api.md twice) → dedup not keyed on resolved abs (scanTokens regression — re-run T1.S1-12).
# If ANY existing markdown case ✗ → default-off behavior changed; see Level 2 CRITICAL checks.
```

### Level 4: End-to-end bare-@ sanity (ad hoc, NOT part of the gate)

```bash
# Prove the prefixLen-aware strip directly (run ad hoc):
node -e '
  const j = require("jiti")();
  const mod = j("./file-injector.ts");
  const fs = require("fs"), path = require("path"), os = require("os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bare-"));
  fs.writeFileSync(path.join(d, "api.md"), "# API\n");
  fs.writeFileSync(path.join(d, "n.md"), "Refs @api.md here.\n");
  mod.injectFiles("R #@n.md", [], { cwd: d }, true).then(r => {
    console.log("injected:", r.injected, "| stripped-marker present:", r.text.includes("Refs api.md here."),
      "| +2-bug fingerprint absent:", !r.text.includes("Refs pi.md here."));
  });
'
# Expected: injected: 2 | stripped-marker present: true | +2-bug fingerprint absent: true
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → `0 errors` under `--strict`.
- [ ] `node ./file-injector.test.mjs` → `114 passed, 0 failed`, exit 0 (107 baseline + 7 new).
- [ ] The 107 existing cases stay GREEN (byte-for-byte default — the load-bearing safety property).
- [ ] No new exports (injectMarkdown stays PRIVATE; no ASSERTED_EXPORTS/guard edit).

### Feature Validation (the wiring this task owns)

- [ ] `injectMarkdown` Step 3 scan call passes `bareAt: state.bareAt` (the P1.M2.T1.S1 seam).
- [ ] `injectMarkdown` Step 3.5 `injectable` type is `{ index; prefixLen; abs }[]` (filter body UNCHANGED).
- [ ] `injectMarkdown` Step 4 strip uses `r.index + r.prefixLen` (1 for bare @, 2 for #@).
- [ ] #25 default-off: a bare `@api.md` in a markdown is NOT imported (verbatim), injected=1.
- [ ] #26 on: a bare `@api.md` IS imported AND stripped to `api.md` (prefixLen 1); the `+ 2`-bug fingerprint (`pi.md`) is ABSENT.
- [ ] #27 on: a `#@api.md` with bareAt on is matched ONCE (no double-match), injected=2.
- [ ] #28 on: a top-level bare `@other.md` (existing file) is NOT injected (injected=0) — top-level is #@-only.
- [ ] §10(e): `user@host.com` in a markdown (on) is left verbatim (mid-word @ excluded).
- [ ] §10(f): `@username` in prose (on, no username.md) is left verbatim (not resolved).
- [ ] §10(g): `#@api.md` + `@api.md` in one file (on) → api.md injected ONCE; first stripped, second verbatim.

### Code Quality Validation

- [ ] Step 3.5 change is a TYPE-ANNOTATION widening ONLY (the `injectable.push(r)` body is byte-for-byte unchanged).
- [ ] Step 3.5 existence pre-check (PRD §10/§5.4) is PRESERVED (missing/dir imports left verbatim, not stripped).
- [ ] Steps 5 + 6 UNCHANGED (operate on `stripped` + `r.abs`; don't care about prefixLen).
- [ ] No object literal built in Step 3.5's push (would DROP prefixLen — the §8.2 anti-pattern).
- [ ] Top-level scan call (`bareAt:false`) + top-level `#@` strip (`+ 2`) UNCHANGED (P1.M2.T1.S1 invariant).
- [ ] `State`/`processTokenStream`/`injectFiles`/`scanTokens`/`BARE_AT_RE`/`readConfig`/factory UNCHANGED.
- [ ] Reused EXISTING `api.md` + `notes.md` fixtures (no duplication); `countFileBlocks`/`FIX`/`API` reused.

### Documentation

- [ ] injectMarkdown JSDoc (Mode A — item §6) documents: bareAt threading (`bareAt: state.bareAt`); Step 3.5 carries
      prefixLen; Step 4 strips `r.index + r.prefixLen`; byte-for-byte-default guarantee. [Rides WITH the work.]
- [ ] NO README change (Mode B = P1.M3.T2.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT build a new object in Step 3.5's push.** `injectable.push(r)` already forwards the WHOLE record
  (prefixLen included). A literal like `injectable.push({ index: r.index, abs: r.abs })` would DROP prefixLen —
  exactly the codebase_delta §8.2 anti-pattern ("do NOT drop prefixLen here"). The fix is a TYPE widening ONLY.
- ❌ **Do NOT keep Step 4 as `+ 2`.** With bare-@ records (prefixLen 1), `+ 2` strips `@a`, leaving `pi.md` instead
  of `api.md`. Use `r.index + r.prefixLen`. #26's `!r.text.includes("Refs pi.md here.")` catches this regression.
- ❌ **Do NOT pass `bareAt: true` (or `bareAt: cfg.…`) in the Step 3 scan call.** Pass `bareAt: state.bareAt` — the
  SEAM P1.M2.T1.S1 created. `bareAt: true` would force bare-@ matching even with the opt-in off, breaking the default.
- ❌ **Do NOT touch the top-level scan call or the top-level `#@` strip.** The top-level scan is `bareAt:false`
  (P1.M2.T1.S1, §4.6 markdown-only); the top-level strip is `+ 2` (top-level is always #@, prefixLen 2). Both stay.
  #28's `injected===0` depends on the top-level `bareAt:false` — if it fails, the bug is in P1.M2.T1.S1's call, NOT here.
- ❌ **Do NOT touch Step 5 (emitText) or Step 6 (recurse).** They operate on `stripped` (already prefixLen-aware) and
  `r.abs` (in the widened type) — unchanged by this task.
- ❌ **Do NOT remove or alter the Step 3.5 existence pre-check.** It's an intentional improvement over PRD §9 pseudocode
  (a markdown import resolving to a MISSING file/dir is left verbatim, not stripped — PRD §10/§5.4). MD1 + EDG-1/EDG-2
  pin it. PRESERVE it; only widen the `injectable` type annotation.
- ❌ **Do NOT export `injectMarkdown` or add it to ASSERTED_EXPORTS.** It stays PRIVATE (exercised via `injectFiles`,
  like cases 15-24). No guard/sanity edit.
- ❌ **Do NOT create a second `api.md` or `notes.md` fixture.** Reuse the EXISTING ones (buildFixtures L214-215). Only
  add the 5 NEW self-contained fixtures (notesBare/notesEmail/notesMention/notesMixDedup/other.md).
- ❌ **Do NOT drive the new cases through `session_start`/`input` captureHandler.** Use the direct `injectFiles` 4th
  param (`mod.injectFiles(prompt, [], FIX, true)`) — the Option-A entry P1.M2.T1.S1 built precisely for this. The
  config→handler path is covered by P1.M2.T1.S1's M2.T1.S1-a..c; this task isolates the injectMarkdown wiring.
- ❌ **Do NOT make #28's assertion depend on `injectFiles`' pre-check.** injectFiles has NO `!text.includes("#@")`
  guard (that's in the input handler). So `injectFiles("Read @other.md", [], FIX, true)` runs the full pipeline →
  processTokenStream(bareAt:false) → injected=0 — meaningful (a wrong top-level bareAt:true would inject other.md).

---

## Confidence Score: 9/10

A tightly-bounded, default-safe wiring subtask with a precise contract (codebase_delta §8 + three LANDED predecessor
PRPs; suite already at 107). The three source edits are the smallest possible: one scan-call key (`bareAt: state.bareAt`),
one type-annotation widening (`injectable` carries `prefixLen` — the filter body is byte-for-byte unchanged), and one
strip expression (`+ 2` → `+ r.prefixLen`). The byte-for-byte-default guarantee is provable by tracing: `bareAt:false`
→ scanTokens' `if (opts.bareAt)` skips BARE_AT_RE → all records prefixLen 2 → `+ r.prefixLen` == `+ 2`. The PRP nails
the two non-obvious load-bearing points: (1) the Step 3.5 change is **type-only** (widening unlocks Step 4's
`r.prefixLen` read; building a new object would DROP prefixLen — the §8.2 anti-pattern); (2) the `+ 2` bug's fingerprint
is `pi.md` (stripping `@a` from `@api.md`), caught explicitly by #26's `!r.text.includes("Refs pi.md here.")`. The 7
test specs reuse existing fixtures + the `countFileBlocks`/`FIX`/`API` idioms from cases 15/EDG-3, and mirror the
T1.S1-8..13 scanTokens bare-@ vocabulary end-to-end. The -1 reserves for the `injectable`-type-vs-push trap (easy to
get wrong by restructuring the filter; instantly caught by typecheck) and the fixture-wording fragility of the `+ 2`-bug
guard (if notesBare.md's content changes, recompute the fingerprint). The implementing agent edits one source file in
3 regions + JSDoc, and one test file (5 fixtures + 5 constants + 7 cases), then runs two commands.
