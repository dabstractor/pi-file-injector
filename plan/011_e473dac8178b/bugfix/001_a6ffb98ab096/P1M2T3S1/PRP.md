name: "P1.M2.T3.S1 — BUG-003: F5-mirror empty-body guard in injectUrl's image branch (empty body → formatEmptyImageBlock note, no attachment)"
description: |
  Fix Minor Issue BUG-003 from the end-to-end validation report: `injectUrl`'s image branch lacks
  the F5 empty-body guard the local-file path has. A 200 response with `content-type: image/*` and
  a zero-length body currently attaches an EMPTY ImageContent (`{type:'image', data:'', mimeType}`)
  — the exact provider-rejected shape the local-file F5 guard exists to prevent. Fix = mirror F5:
  empty body → `formatEmptyImageBlock(url)` note block + image detail + count++, NO attachment.
  Scope: `file-injector.ts` (one guard in `injectUrl`), regression test in `url-injection.test.mjs`
  (label `URL-IMG-EMPTY`), one README bullet. No new exports; no signature changes.

---

## ⚠️ CURRENT STATE — READ THIS FIRST (candidate implementation already exists at HEAD)

Commit `fe766bd` on branch `xiliumz/main` (titled "Mirror F5 empty-image guard into URL image
branch (BUG-003)") ALREADY contains a candidate implementation:

- Guard at `file-injector.ts:946-959` — placement and semantics match this PRP's spec exactly.
- Regression test `URL-IMG-EMPTY` at `url-injection.test.mjs:366-386` (immediately after DIS-4).
- README Images bullet at `README.md:83-85`.
- Verified green during PRP research: `npm test` → 183 + 23 + 38 + 39 passed / 0 failed;
  `npm run typecheck` → 0 errors.

**Your job is therefore VERIFY-THEN-CLOSE-GAPS, not blind re-implementation:**

1. Work through Tasks 1–5 below as a checklist against the working tree.
2. If EVERYTHING matches and all gates pass, the code work is done — proceed to bookkeeping (Task 6).
3. If ANY deviation or gap is found, remediate it to match this PRP's spec (the spec below is
   complete and standalone — it fully re-derives the fix from scratch if the guard were absent).
4. Do NOT double-apply the guard (a second `buf.length === 0` branch would be dead code) and do NOT
   delete the existing work to "redo it".

## Goal

**Feature Goal**: A 200 `image/*` URL response with a zero-length body produces the F5 empty-image
note block (`<empty image file — 0 bytes; nothing to attach>`) + an image `FileDetail` + `count++`,
and attaches NOTHING to `state.images` — byte-identical parity with the local-file F5 guard for
0-byte `#@image` files. Non-empty image URLs behave exactly as today.

**Deliverable**: One guard branch in `injectUrl`'s image path (`file-injector.ts`, between the
`buf === null` check and the `mime`/`resizeImage` lines), one regression test case labeled
`URL-IMG-EMPTY` in `url-injection.test.mjs`, and one README `### URLs` Images-bullet sentence.

**Success Definition**: `node ./url-injection.test.mjs` passes with `URL-IMG-EMPTY` green AND
`DIS-4` (non-empty image still attaches, byte-exact) still green; full `npm test` (all 4 suites)
and `npm run typecheck` green; no new module exports (surface-allowlist test
`file-injector.test.mjs:141-155` untouched and passing); README documents the behavior.

## User Persona (if applicable)

**Target User**: A pi user who pastes `#https://example.com/cat.png`-style image URLs (or an agent
that emits them) into a prompt with the pi-file-injector extension loaded.

**Use Case**: The user references an image URL that a server answers with `200` + `image/*` but a
zero-length body (misconfigured endpoint, truncated object-store reply, redirect-to-empty).

**User Journey**: Prompt with `#https://example.com/empty.png` → extension fetches → body is
empty → the model receives a small note block ("empty image file — 0 bytes; nothing to attach")
instead of a broken attachment; the turn does NOT fail at the provider with a 400 for an empty
image part; the chat shows the file counted as injected (`injected 1`).

**Pain Points Addressed**: Pre-fix, the empty `ImageContent` (`data: ""`) could make the whole
provider request fail (400) — one bad URL kills the entire turn. Alternatively, under a tight
budget the token silently verbatimed (inconsistent). Post-fix: graceful note, always.

## Why

- **Business value / user impact**: Robustness of the URL-injection feature against real-world
  broken image endpoints. Mirrors the already-shipped local-file F5 behavior, so users get one
  consistent story: "empty image = note, not an error."
- **Integration with existing features**: Reuses `formatEmptyImageBlock` (already exported,
  `file-injector.ts:384-389`), the `subtract()` budget helper (:607-611), the `FileDetail` kind
  `"image"` consumed by the renderer (§6.4 image short-circuit) and by the input handler's
  ISSUE-IMG-URL notify axis ("injected N URL(s)" counts https paths).
- **Problems solved / for whom**: BUG-003 from the merged bug-report PRD (Minor Issues → Issue 2),
  PRD recommendation: "Mirror the F5 empty-image guard into injectUrl's image branch (empty body →
  note block, no attachment)."

## What

User-visible behavior: `#<image-url>` whose response body is empty (0 bytes) injects a note block
`<file name="URL"><empty image file — 0 bytes; nothing to attach></file>` (em dash U+2014), counts
as one injected file, attaches no image. Everything else (non-empty images, HTML, raw text,
guards, budget) unchanged.

Technical requirements:

- Predicate is exactly `buf.length === 0` AFTER `readBytesCapped` and its `null` (overflow) check —
  because `readBytesCapped` returns an EMPTY Buffer (not null) for a zero-length body on BOTH its
  streaming and no-reader paths.
- Placement BEFORE `resizeImage` (no Worker spawn for 0 bytes — it would deterministically return
  null anyway) and BEFORE the §3.3 guard-3 budget check (`estimateImageTokens(null)` = 2805 =
  `IMAGE_FALLBACK_TOKENS` is the wrong cost for 0 bytes; F5 parity means the note ALWAYS delivers —
  the ~15-20 token note cost is negligible and `subtract` clamps at 0).
- Emits: `state.blocks.push(formatEmptyImageBlock(url))`; `state.details.push({ path: url, kind:
  "image", dimensionHint: undefined })`; `subtract(state, Math.ceil(f5Block.length / 4))`;
  `state.count++`; `return true`.
- NO claim back-out: URLs have no `claimKey`; the URL loop in `injectFiles` already claimed the
  absolute URL before calling `injectUrl` (the local F5 path's LR-2 ranged-claim normalization is
  file-specific and is NOT mirrored).
- No signature changes; `ctx` unused by the guard; no new exports (module surface is frozen by the
  allowlist test).

### Success Criteria

- [ ] `URL-IMG-EMPTY` test passes: 200 `image/png` + zero-length body → `r.images.length === 0`,
      note block present (exact string, em dash), `r.injected === 1`,
      `r.details[0].kind === "image"`, exactly ONE fetch of the normalized URL.
- [ ] `DIS-4` still passes: non-empty image body still attaches byte-exact raw base64.
- [ ] All `FAIL-*` guards unchanged (over-budget NON-empty content still verbatims; this fix only
      changes the empty-body image case).
- [ ] Full `npm test` (4 suites) + `npm run typecheck` green.
- [ ] README `### URLs` Images bullet documents the empty-body note behavior.
- [ ] No new exports; `file-injector.test.mjs:141-155` allowlist untouched.

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?"_ — Yes: this PRP includes the exact root-cause chain, the verbatim guard code, the
verbatim test, the exact fixture factory semantics, the F5 mirror template, and runnable gates.
An implementer who never saw the repo can verify/re-derive the fix from this document alone.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: file-injector.ts
  why: The single-file extension being fixed. Relevant regions: URL_SHAPE_RE/gating (:43), constants (:118 IMAGE_FALLBACK_TOKENS), formatters (:384-389 formatEmptyImageBlock), subtract (:607-611), estimateImageTokens (:818-823), readBytesCapped (:882-900), injectUrl (:928-1010; image branch :942-981; the guard :946-959), renderInjectedMessage image short-circuit (~:1094), local F5 guard (:1363-1378), injectFiles URL loop (~:1689-1719).
  pattern: "Branch-per-content-type inside injectUrl; every success branch ends with blocks/details push + subtract + state.count++ + return true; every failure returns false (verbatim)."
  gotcha: "readBytesCapped returns an EMPTY Buffer (not null) for a zero-length body — null ONLY on cap overflow. resizeImage is external and deterministically null on empty bytes."

- file: url-injection.test.mjs
  why: The zero-network acceptance harness this task's regression test lives in. FIX (:122), hasBlock (:127-129), origFetch (:130), makeRes (:143-167), DIS-4 (:346-360), URL-IMG-EMPTY (:366-386).
  pattern: "Per-case fetch stub: try { globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({...}); }; ... } finally { globalThis.fetch = origFetch; } — restored ALWAYS (a leaked stub poisons later cases / hits real network)."
  gotcha: "makeRes({ body: \"\" }) yields a single ZERO-LENGTH chunk — the deterministic empty-buffer fixture. Do NOT stub resizeImage (external, jiti-aliased; harness relies on deterministic null-on-invalid)."

- file: README.md
  why: User-facing docs; the ### URLs Images bullet (:83-85) documents this behavior.
  pattern: "Concise bullet style under '### URLs' → 'By content type:' list."
  gotcha: "Keep the existing sentence about # vs #@ disjointness untouched."

- docfile: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/injection_bug002_003.md
  why: The pre-researched code context for this exact fix — §(a) injectUrl flow, §(b) readBytesCapped empty-vs-null, §(c) resizeImage null-on-empty (traced into the global pi package), §(d) exact block/note formatter shapes, §(e) estimateImageTokens, §(f) F5 local guard verbatim, §(g) test conventions, §(h) guard-placement analysis (why after buf-null, before resizeImage, before guard 3), Risks.
  section: "## BUG-003 injectUrl image path" through "## Shared test conventions" and "## Risks"

- docfile: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md
  why: The merged bug-fix PRD — Minor Issue 2 (BUG-003) definition + Recommendations line this PRP implements.
  section: "Minor Issues (Nice to Fix) → Issue 2" and "Recommendations" (bullet 3)

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M2T3S1/research/research_notes.md
  why: This session's research: the already-at-HEAD finding (commit fe766bd), root-cause chain, verified line numbers, green-suite evidence.
  pattern: "Verification checklist mapping spec → working tree."
  gotcha: "Line numbers were verified against the CURRENT working tree; re-grep after any edits."

- file: file-injector.test.mjs
  why: Surface-allowlist test (:141-155) freezes the module's exports — proves 'no new exports'. Also holds imageRes() (:3492-3510) used by ISSUE-IMG-URL notify tests (must stay green).
  pattern: "Standalone .mjs harness, jiti-loads the real file-injector.ts."
  gotcha: "formatEmptyImageBlock is ALREADY in the allowlist — do not re-export or rename anything."

- url: https://github.com/dabstractor/pi-file-injector
  why: Repo upstream; README on main shows the published behavior docs this fix extends.
  critical: "No external library research is needed — everything (resizeImage, ImageContent) is already in-repo/peer and pre-traced in the architecture doc."
```

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase

```bash
pi-file-injector/
├── file-injector.ts            # THE single-file extension (1987 lines) — fix target (injectUrl image branch :942-981)
├── file-injector.test.mjs      # main acceptance harness (183 cases; surface allowlist :141-155)
├── import-behavior.test.mjs    # harness (23 cases)
├── relative-imports.test.mjs   # harness (38 cases)
├── url-injection.test.mjs      # URL harness (39 cases) — URL-IMG-EMPTY lives here (:366-386)
├── README.md                   # user docs — ### URLs Images bullet (:83-85)
├── scripts/typecheck.mjs       # npm run typecheck (tsc --strict, 0 errors expected)
├── spec/                       # feature specs (15-urls.md is the URL spec; §5.2 image path)
├── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
│   ├── architecture/           # injection_bug002_003.md (THIS task's pre-research), system_context.md, …
│   ├── prd_snapshot.md         # merged bug-fix PRD (BUG-003 = Minor Issue 2)
│   ├── tasks.json              # orchestrator-owned status tree
│   └── P1M2T3S1/               # this work item (PRP.md + research/)
├── package.json                # scripts: test = 4 harnesses chained; typecheck
└── tsconfig.json
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
# NO new files. Three MODIFIED files only:
├── file-injector.ts            # +14 lines: one guard branch in injectUrl's image path (:946-959)
├── url-injection.test.mjs      # +22 lines: URL-IMG-EMPTY case after DIS-4 (:366-386)
└── README.md                   # Images bullet extended (~2 lines, :83-85)
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: readBytesCapped (file-injector.ts:882-900) returns an EMPTY Buffer — NOT null — for a
// zero-length body, on BOTH paths (streaming: Buffer.concat([]); no-reader: Buffer.from(new
// ArrayBuffer(0))). null is returned ONLY on cap overflow. So `if (buf === null) return false;`
// never catches the empty case; the F5-mirror predicate is exactly `buf.length === 0`.

// CRITICAL: resizeImage (imported from @earendil-works/pi-coding-agent, jiti-aliased in tests) is
// deterministically null on empty bytes: photon throws → catch → null. Never stub it in tests —
// the harness relies on this real behavior (same reason DIS-4's raw-base64 fallback works).

// CRITICAL: estimateImageTokens(null) === IMAGE_FALLBACK_TOKENS === 2805 (file-injector.ts:118) —
// a nonsense cost for 0 bytes. That is WHY the guard must sit BEFORE the guard-3 budget check:
// F5 parity = the note always delivers (subtract clamps at 0, :607-611); no over-budget turn-away.

// CRITICAL: the note text uses an EM DASH (U+2014): formatEmptyImageBlock (:384-389) →
// '<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>'.
// Test assertions must match it exactly (the committed test uses a literal —).

// CRITICAL: NO new exports — the module surface is frozen by the allowlist test
// (file-injector.test.mjs:141-155). formatEmptyImageBlock is already exported; just call it.

// CRITICAL: fetch stubs in url-injection.test.mjs MUST be saved/restored per case in try/finally
// (origFetch at :130). A leaked stub poisons every later case (or hits the real network).

// GOTCHA: No claim back-out on this path. URLs have no claimKey; the injectFiles URL loop already
// claimed the absolute URL before injectUrl runs. The local F5 path's LR-2 ranged-claim
// normalization (:1367-1371) is file-specific and is deliberately NOT mirrored.

// GOTCHA: state.count++ lives INSIDE injectUrl branches (it returns a per-token boolean), unlike
// injectFile whose F5 relies on injectFile's trailing count++ — different mechanics, same
// observable ("the note counts as a delivery").

// GOTCHA: detail kind must be "image" (not "url"): (1) the renderer's §6.4 short-circuit skips
// body rendering for image details and the tier-3 pop guard is `d.kind !== "image"`; (2) the input
// handler's ISSUE-IMG-URL notify axis counts https paths as URLs either way — intact.

// GOTCHA: Tests are zero-dependency standalone .mjs scripts (NO pytest/vitest/jest). Pattern is
// assert(cond, msg) + runCase(label, name, fn) with a PASS/FAIL matrix; exit 1 on any failure.
// ruff/mypy do NOT apply — `npm run typecheck` (tsc --strict) is the only static gate.
```

## Implementation Blueprint

### Data models and structure

No data-model changes. The fix only USES existing shapes (all already defined in file-injector.ts):

```typescript
// FileDetail (already exists — the shape pushed to state.details):
{ path: string /* the absolute https URL */, kind: "image", dimensionHint: undefined }

// The note block (already exists — formatEmptyImageBlock, :384-389, exported):
'<file name="' + url + '"><empty image file \u2014 0 bytes; nothing to attach></file>'

// State fields touched (already exist): state.blocks: string[], state.details: FileDetail[],
// state.remaining: number | null (via subtract), state.count: number.
// NOTHING is pushed to state.images (that is the whole point of the fix).
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: VERIFY (or CREATE) the guard in file-injector.ts injectUrl image branch
  - LOCATE: injectUrl (:928). The image branch starts at `if (ct.startsWith("image/")) {` (:943).
    The guard sits BETWEEN `if (buf === null) return false; // §3.3 guard 2b` (:945) and
    `const mime = ct.split(";")[0].trim();` (:961).
  - EXPECTED CODE (verbatim, including comment — matches commit fe766bd):
      if (buf.length === 0) {
        // BUG-003 / F5 mirror (:1306-1323) — a 0-byte image body would attach an EMPTY ImageContent (data: "",
        // which providers reject). readBytesCapped returns an EMPTY Buffer (not null) for a zero-length body, so
        // the null check above never caught it. Emit the note instead: block + image detail + the note's cost,
        // count++ → delivered (true). Before mime/resizeImage (no Worker spawn for 0 bytes — resizeImage is
        // deterministically null on empty bytes) and before the guard-3 budget check (F5 parity: the note always
        // delivers; its ~15-20 token cost is negligible). No claim back-out (URLs have no claimKey).
        const f5Block = formatEmptyImageBlock(url);
        state.blocks.push(f5Block);
        state.details.push({ path: url, kind: "image", dimensionHint: undefined });
        subtract(state, Math.ceil(f5Block.length / 4)); // note consumes budget (mirror F5)
        state.count++;
        return true;
      }
  - SEMANTICS TO CONFIRM (why each line is load-bearing):
    * after the buf-null check → the predicate needs buf; overflow already turned away
    * before resizeImage → no Worker spawn for 0 bytes (deterministic null anyway)
    * before guard 3 → never charge 2805 for 0 bytes; F5 parity = note ALWAYS delivers
    * kind:"image" detail → renderer short-circuit + ISSUE-IMG-URL axis (see Gotchas)
    * no claimKey manipulation → URL loop already claimed (see Gotchas)
  - IF ABSENT (clean-tree scenario): insert exactly the block above at the specified position.

Task 2: VERIFY (or CREATE) the URL-IMG-EMPTY regression test in url-injection.test.mjs
  - PLACEMENT: immediately AFTER the DIS-4 case (:346-360), BEFORE the "COLLISION" section header.
  - EXPECTED CODE (verbatim — matches commit fe766bd):
      // URL-IMG-EMPTY — BUG-003 (F5 parity): a 200 image/* response with a ZERO-LENGTH body must deliver the
      // empty-image NOTE (block + image detail + count) with NO ImageContent attachment — mirroring the local F5
      // guard for 0-byte #@image files. Before the fix this attached {type:"image", data:"", mimeType} (the
      // provider-rejected shape) and charged estimateImageTokens(null)=2805 for 0 bytes. makeRes({body:""}) is the
      // deterministic zero-length-chunk fixture (Buffer.from("") → the reader's single chunk is zero-length).
      await runCase("URL-IMG-EMPTY", "image URL with empty body → F5 note block + image detail, NO attachment (BUG-003)", async () => {
        const calls = [];
        const origFetch = globalThis.fetch;
        try {
          globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "image/png", body: "" }); };
          const r = await mod.injectFiles("#https://example.com/empty.png", [], FIX, false, true);
          assert(calls.length === 1 && calls[0] === "https://example.com/empty.png", `exactly one fetch of the normalized URL, got ${JSON.stringify(calls)}`);
          assert(r.images.length === 0, `NO ImageContent for a 0-byte image body (the provider-rejected shape), got images.length=${r.images.length}`);
          assert(hasBlock(r, '<file name="https://example.com/empty.png"><empty image file — 0 bytes; nothing to attach></file>'),
            `the F5 note block must be delivered (em dash U+2014), got blocks=${JSON.stringify(r.blocks)}`);
          assert(r.injected === 1, `the note counts as a delivery (count++), got injected=${r.injected}`);
          assert(r.details.length === 1 && r.details[0].kind === "image", `one image detail, got ${JSON.stringify(r.details)}`);
        } finally {
          globalThis.fetch = origFetch;
        }
      });
  - NAMING: label `URL-IMG-EMPTY` is unique (historical BUG-001/BUG-002 labels mean older bugs).
  - GOTCHA: the hasBlock needle uses a literal em dash — (U+2014), matching formatEmptyImageBlock.
  - DO NOT stub resizeImage (external; deterministic null-on-invalid is relied upon).

Task 3: VERIFY (or ADD) the README.md documentation
  - LOCATE: README ### URLs section, "By content type:" list, Images bullet (:83-85).
  - EXPECTED TEXT (verbatim — matches commit fe766bd):
      - **Images** (`#https://example.com/cat.png`) → attached as an image, same as `#@image`. An image URL whose body
        comes back empty (0 bytes) attaches nothing — it delivers the same "empty image file — 0 bytes" note a 0-byte
        local image does.
  - PRESERVE: the surrounding bullets (HTML pages / Raw text / Anything else) and the trailing
    "# is disjoint from #@" sentence — untouched.

Task 4: RUN THE VALIDATION GATES (see Validation Loop)
  - npm run typecheck            → 0 errors
  - node ./url-injection.test.mjs → 40/40 incl. URL-IMG-EMPTY + DIS-4
  - npm test                     → 183 + 23 + 38 + 40 all green
  - ANY failure → root-cause and fix before proceeding (do not weaken assertions).

Task 5: CONFIRM NO COLLATERAL DAMAGE
  - git diff: only the three intended files differ from pre-fix baseline (if applying fresh).
  - Surface allowlist (file-injector.test.mjs:141-155) passing = no new exports.
  - ISSUE-IMG-URL notify tests (file-injector.test.mjs, imageRes() :3492-3510) still green.
  - FAIL-6 (over-budget NON-empty body → verbatim) unchanged — the note path is empty-body-only.

Task 6: BOOKKEEPING (per the sibling-subtask pattern, e.g. commits 71e9f45 / fe766bd)
  - This PRP.md + research/research_notes.md are committed under
    plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M2T3S1/.
  - tasks.json: flip P1.M2.T3.S1 (and P1.M2.T3 / P1.M2 if fully done) Researching → Complete in
    the implementation commit, exactly as sibling subtasks did.
  - IF the code/test/README were already complete at HEAD and no gap was found, the commit will
    contain only the plan/ artifacts; if gaps were fixed, the code fixes ride in the same commit
    with a message matching the sibling style.
```

### Implementation Patterns & Key Details

```typescript
// PATTERN: every injectUrl success branch (mirror the branch's own tail, :961-981):
//   push block → push detail → subtract(cost) → state.count++ → return true
// The empty-image guard is the SAME shape with cost = ceil(f5Block.length / 4) instead of a
// tile estimate, and with NO state.images.push.

// PATTERN: failure = `return false` (token left verbatim, §3.5 "never throws"). The empty-body
// case is NOT a failure — it is a DELIVERY (the note). That is the F5-parity decision.

// CRITICAL: pre-fix defect trace (why this is a bug, not a style issue):
//   buf = empty Buffer → resizeImage → null (deterministic) → cost = 2805 →
//   guard 3 passes (remaining === null or ≥ 2805) →
//   state.images.push({ type: "image", data: "", mimeType })  ← provider-rejected shape
//   (or, under a tight budget: silent verbatim of a 200-image URL — also wrong).

// CRITICAL: do not "fix" the local F5 path (:1363-1378) — it is the SOURCE of the mirror and
// already correct. Do not touch readBytesCapped, the text paths, or the §3.3 guards.

// NOTE: model-facing message.content DOES change for the defect case (note block instead of an
// empty attach / silent verbatim). The project invariant "model-facing content unchanged" applies
// to CORRECT cases; BUG-003 is a defect case by definition (bug-report PRD, Minor Issue 2).
```

### Integration Points

```yaml
NO database / config / routes / API changes. The only integration surfaces:

BUDGET (state.remaining, shared files+URLs):
  - subtract(state, Math.ceil(f5Block.length / 4)) — subtract clamps at 0 (file-injector.ts:607-611);
    no over-budget turn-away for the note (deliberate F5 parity; see architecture doc Risks).

RENDERER (renderInjectedMessage):
  - The kind:"image" detail hits the §6.4 short-circuit — images never render a body child;
    tier-3 pop guard is `d.kind !== "image"` (~:1094). Nothing to change there.

INPUT-HANDLER NOTIFY (ISSUE-IMG-URL axis):
  - "injected N URL(s)" counts details whose path is an https URL — the note's image detail keeps
    that counting intact. No change needed.

DOCS:
  - README.md ### URLs → Images bullet only (Task 3).

MODULE SURFACE:
  - Frozen (allowlist test). formatEmptyImageBlock already exported — no surface change.
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# This is a TypeScript single-file extension — tsc --strict is the only static gate (no ruff/mypy).
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)"

# Quick sanity that the module still loads through the real harness:
node ./url-injection.test.mjs 2>&1 | tail -3
```

### Level 2: Unit Tests (Component Validation)

```bash
# Targeted: the URL suite (URL-IMG-EMPTY + DIS-4 + FAIL-* + COLLISION all in one run)
node ./url-injection.test.mjs
# Expected: "Result: 40 passed, 0 failed." — including:
#   ✓ case URL-IMG-EMPTY: image URL with empty body → F5 note block + image detail, NO attachment
#   ✓ case DIS-4: dispatch: image/png → images[] + image detail, bytes preserved byte-exact

# Negative-proof variant (only if the guard had to be re-created): temporarily comment the guard
# out, re-run — URL-IMG-EMPTY MUST fail (proves the test bites), then restore. Do not commit the
# commented-out state.
```

### Level 3: Integration Testing (System Validation)

```bash
# Full project gate — all four standalone harnesses chained:
npm test
# Expected (post-fix counts): 183 passed / 23 passed / 38 passed / 40 passed, 0 failed anywhere.
# (183/23/38/39 were the pre-URL-IMG-EMPTY green counts at PRP-research time; URL suite becomes 40.)

# Type gate again after any edits:
npm run typecheck
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (a) Prove the provider-rejected shape is gone — one-off REPL-style check via the harness module:
#     (mentally map to URL-IMG-EMPTY's assertions) images.length === 0 AND blocks contain the note.
# (b) Renderer safety — the note's kind:"image" detail must not render a body child in the
#     expanded view: covered structurally by the §6.4 short-circuit (image details never do);
#     file-injector.test.mjs renderer cases (REND-*) must stay green in `npm test`.
# (c) No-network invariant: URL-IMG-EMPTY's `calls` tracker asserts EXACTLY one fetch — no
#     retries, no egress beyond the single request (spec §4).
# (d) git hygiene: `git status --short` — only the three intended files (+ plan/ artifacts);
#     `git diff --stat` against pre-fix baseline if applying fresh.
```

## Final Validation Checklist

### Technical Validation

- [ ] All validation levels completed successfully
- [ ] `npm test` green: all 4 suites (URL suite at 40 cases incl. URL-IMG-EMPTY)
- [ ] `npm run typecheck` clean (0 errors, --strict)
- [ ] No new module exports (surface allowlist `file-injector.test.mjs:141-155` passing)

### Feature Validation

- [ ] All success criteria from "What" section met
- [ ] Empty-body image URL: `r.images.length === 0`, note block with em dash, `injected === 1`,
      `details[0].kind === "image"`, exactly one fetch
- [ ] Non-empty image URL (DIS-4): byte-exact raw base64 attach — unchanged
- [ ] Over-budget non-empty content (FAIL-6): still verbatims — unchanged
- [ ] README Images bullet present and accurate

### Code Quality Validation

- [ ] Guard placed after `buf === null` check, before `mime`/`resizeImage`, before guard 3
- [ ] Comment explains the WHY (empty-Buffer-not-null, no Worker spawn, F5 parity, no claim back-out)
- [ ] Test follows the suite's stub/restore + calls-tracker conventions
- [ ] No changes outside the three intended files (except plan/ artifacts)

### Documentation & Deployment

- [ ] README updated (Task 3 text)
- [ ] No new environment variables or configuration
- [ ] Plan artifacts committed; tasks.json status flipped per sibling pattern

---

## Anti-Patterns to Avoid

- ❌ Don't re-implement from scratch what already verifies green at HEAD (fe766bd) — verify, then
  close gaps only
- ❌ Don't place the guard AFTER `resizeImage`/guard 3 (Worker spawn for 0 bytes + wrong 2805 cost
  + possible silent verbatim under tight budgets)
- ❌ Don't push anything to `state.images` on the empty path — the note is the delivery
- ❌ Don't add a `claimKey` back-out — URLs have no claimKey (that's the LOCAL F5 path's concern)
- ❌ Don't stub `resizeImage` in tests — it's external and deterministically null-on-invalid
- ❌ Don't leak a fetch stub (always restore `globalThis.fetch` in `finally`)
- ❌ Don't use a hyphen `-` instead of the em dash U+2014 in note assertions
- ❌ Don't touch the local F5 path, the text paths, or the §3.3 guards — read-only context
- ❌ Don't add exports or change any signature — the surface allowlist will fail

---

## Confidence Score

**10/10** — one-pass success. The candidate implementation already exists at HEAD and was verified
green during PRP research (all 4 suites + typecheck); this PRP contains the complete standalone
spec (verbatim guard, verbatim test, verbatim README text, exact placement rationale, runnable
gates), so the implementing agent either confirms the green state or re-derives the fix exactly.

## Cross-Item Notes for the Implementer (context, not scope)

- This subtask is INDEPENDENT (`dependencies: []`); do not "helpfully" fix BUG-002 (injectMarkdown
  Step-5) or BUG-004/005 — they belong to other sessions.
- Observation from PRP research (report to the orchestrator, do NOT act): the working tree does NOT
  contain the BUG-002 Step-5 `invalidRange` guard despite P1.M2.T2.S1 being marked Complete —
  possibly the T2.S1 session's commit (fe766bd) bundled this task's BUG-003 fix instead. That is
  for the orchestrator to reconcile; it does not affect this PRP's scope.