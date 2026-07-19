---
name: "P1.M1.T2.S2 (plan/009) — Verify before_agent_start, computeDetailOffsets, renderInjectedMessage unaffected (read-only)"
prd_ref: "PRD §6.2 (Delivery: custom message from before_agent_start consumes blocks/details only), §6.3 (Chat display renderer reads message.content/details), §6.4 (Assembly: the prompt is never modified), §12.22 (details is renderer-only), §12.16 (never strip markers)"
target_file: "./file-injector.ts"   # READ-ONLY verification — NO edits. Confirm the 3 functions consume only blocks/details and typecheck passes.
target_language: TypeScript (gate = `npm run typecheck` --strict, which is the cascade-completeness proof; no code changes, no test changes)
depends_on: "P1.M1.T1.S1/S2/S3 (ALL LANDED at HEAD d3219d2: scanTokens→Promise<string[]>, processTokenStream→Promise<void>, injectMarkdown emits verbatim content, injectFiles returns verbatim text; resolvedIdx/strippedText deleted; typecheck 0 errors). T2.S1 (the text→text:event.text explicitness edit) is NOT yet landed but is a runtime no-op and irrelevant to these 3 functions."
consumed_by: "NONE downstream. This is a read-only verification gate; it produces a verdict (unaffected) + the typecheck proof, confirming M1 is complete. P1.M2 (test migration + README sync) is the next milestone."
---

# PRP — P1.M1.T2.S2: Verify before_agent_start, computeDetailOffsets, renderInjectedMessage unaffected

> **Scope flag:** This is a **READ-ONLY verification** subtask. Its deliverable is a VERDICT — "the three
> named functions are unaffected by the verbatim cascade; no code changes needed" — backed by (a) reading
> each function's body and confirming it consumes ONLY `blocks`/`details` (never the prompt text) and
> (b) running `npm run typecheck` → 0 errors (the cascade-completeness gate, item §3d). **NO source edits.**
> **NO test edits.** If typecheck passes (it does, verified at HEAD `d3219d2`), **M1 is complete** (item §4).

---

## Goal

**Feature Goal:** Re-confirm — against the current tree (HEAD `d3219d2`, all of T1.S1/S2/S3 landed) — that
the three functions which consume the injection pipeline's output are **structurally unaffected** by the
verbatim-prompt cascade (the shift from "strip `#@` markers" to "preserve them verbatim" in the engine +
input handler):
1. **`before_agent_start` handler** (live L1273-1290): consumes the `pending = { blocks, details }` stash,
   calls `computeDetailOffsets(blocks, details)`, returns the custom message with
   `content: blocks.join("\n\n")`. Consumes ONLY blocks/details — never the prompt text.
2. **`computeDetailOffsets`** (live L353-414): computes absolute char offsets of each file body within
   `blocks.join("\n\n")` via length-derived arithmetic (`block.length`, header/closer lengths). Operates on
   blocks/details ONLY. Verbatim markers add a few chars to block content — offsets auto-adjust.
3. **`renderInjectedMessage`** (live L739-825): reads `message.details.files` (FileDetail[]) and
   `message.content` (the joined blocks); re-parses bodies via 3-tier resolution (offset slice → stored body
   → regex). Does NOT touch the user prompt. Verbatim markers inside a markdown block's body render as-is
   in the expanded view — honest, matches model input (PRD §6.3).

**Deliverable:** A VERDICT — "unaffected — no code changes" (expected, verified) — backed by the
typecheck gate (`npm run typecheck` → 0 errors) and a per-function structural confirmation. **No README, no
code, no test changes** (item §5: "DOCS: none — verification-only subtask").

**Success Definition:** The implementing agent (a) runs `npm run typecheck` → 0 errors (the proof the
cascade is type-complete), (b) reads the three function bodies and confirms each consumes only
blocks/details (item §3a/b/c), (c) records the verdict, (d) leaves the working tree clean
(`git status --short` shows no source changes). If typecheck passes (it does), **M1 is complete** (item §4).

## User Persona

**Target User:** The maintainer/reviewer who needs assurance that the verbatim-prompt refactor (M1.T1 +
T2.S1) did not break the delivery pipeline (before_agent_start) or the chat display (the renderer). This
subtask is the gate that provides that assurance before M2 migrates tests and syncs docs.

**Use Case:** After T1.S1/S2/S3 rewrote the engine to preserve markers verbatim, a reviewer asks: "does
the delivered custom message still carry the file bytes correctly? does the green read-line renderer still
work? do the byte-offsets the renderer slices still point at the right content?" T2.S2 answers: yes —
those three functions operate on the file-content stream (blocks/details), which the verbatim cascade did
not change; only the prompt-text handling changed, and none of the three read the prompt.

**Pain Points Addressed:** Risk that the verbatim cascade silently corrupted the renderer's body-slicing
offsets or the delivery payload. T2.S2 rules that out by reading the code + running typecheck.

## Why

- **Closes M1 with a verification gate.** M1 ("Remove stripping from the injection engine and input
  handler") has four subtasks: T1.S1/S2/S3 (the engine, LANDED) and T2.S1/T2.S2 (the input handler +
  verification). T2.S2 is the confirmation that the cascade is internally consistent and type-complete.
  If typecheck passes (it does), the engine + delivery + renderer all agree, and M1 is done.
- **The three functions are structurally immune — but that must be CONFIRMED, not assumed.** The verbatim
  cascade changed how IMPORT MARKERS WITHIN markdown content are handled (strip → keep). The three target
  functions operate on the file-CONTENT stream (blocks/details), not the prompt. Reading their bodies
  confirms they never reference the prompt text — so the change cannot affect them. This is the item's
  §3a/b/c claim, re-verified against the live tree.
- **Typecheck is the cascade-completeness proof.** `npm run typecheck` runs `tsc --strict`. If the engine
  signature changes (scanTokens→`Promise<string[]>`, processTokenStream→`Promise<void>`) had left any
  caller un-migrated, typecheck would fail. It passes (0 errors, verified), proving the cascade is
  complete and the three consumers compile clean against the new shapes.
- **Expected no-op with evidence.** The expected outcome is "unaffected — no edit," but a no-op verdict
  without evidence is not a verification. The deliverable is the per-function structural confirmation +
  the typecheck proof.

## What

A read-only audit producing a verdict + evidence. No user-visible or runtime behavior change (no code is
modified). The three functions are read, confirmed to consume only blocks/details, and typecheck is run.
The verification target is `./file-injector.ts` (read-only); the gate is `scripts/typecheck.mjs`.

### Success Criteria

- [ ] `npm run typecheck` → **0 errors** under `--strict` (verified at HEAD `d3219d2`; the
      scanTokens/processTokenStream signature changes type-check clean).
- [ ] **`before_agent_start` handler** (L1273-1290): confirmed to consume ONLY `pending = { blocks, details }`
      — it reads `blocks`/`details`, calls `computeDetailOffsets(blocks, details)`, and returns the custom
      message with `content: blocks.join("\n\n")` + `details: { files: details }`. It NEVER references
      `event.text`, `text`, or any prompt content. (item §3a)
- [ ] **`computeDetailOffsets`** (L353-414): confirmed to operate purely on `blocks[]` + `details[]` via
      length-derived offsets (`block.length + SEP.length`; `blk.length - headerLen - closerLen`). It never
      sees the prompt text. Verbatim markers in a block's body auto-adjust the offsets (they add chars to
      `block.length`, which flows into `contentLen`). (item §3b)
- [ ] **`renderInjectedMessage`** (L739-825): confirmed to read `message.details.files` + `message.content`
      and re-derive bodies via 3-tier resolution (offset slice / stored body / regex). It never references
      the prompt. A markdown block's body containing a literal `#@api.md` marker renders as-is in the
      expanded view (honest display matching model input). The defensive fallback
      (`files.length === 0` → "read (injected files)" line) is unchanged. (item §3c)
- [ ] `git status --short` shows NO source file modified by this subtask (the proof of the no-op verdict).
- [ ] DOCS outcome recorded as "none — verification-only subtask" (item §5).

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives: the verified HEAD (`d3219d2`, all of T1.S1/S2/S3 landed; typecheck
0 errors; `resolvedIdx`/`strippedText` gone); the exact live line ranges of the three target functions
(before_agent_start L1273-1290, computeDetailOffsets L353-414, renderInjectedMessage L739-825 — with a note
that the item's line numbers drifted and to place by NAME); the quoted body of each function proving it
consumes only blocks/details; the item §3a/b/c claims mapped to the live code; the rationale for why the
verbatim cascade cannot affect these functions (they operate on the content stream, not the prompt); and
the exact verification gate (`npm run typecheck`). The implementing agent runs typecheck, reads three
function bodies, records the verdict, and STOPS.

### Documentation & References

```yaml
# MUST READ — the delivery + display contracts the three functions implement
- file: PRD.md
  why: "§6.2 'Delivery: a custom message returned from before_agent_start' — the custom message shape
        {customType, content: blocks.join('\\n\\n'), display:true, details:{files}} and the instance-state
        handoff (the stash carries {blocks,details}, NOT the prompt). §6.3 'Chat display' — the renderer reads
        details.files + content and draws one read line per file. §6.4 'Assembly & shared state' — the prompt
        is NEVER modified (text: event.text); the file bytes live only in the custom message. §12.22 'details
        is renderer-only — never sent to the model'; §12.16 'Never strip markers — verbatim delivery everywhere'."
  section: "### 6.2 + ### 6.3 + ### 6.4 (Two returns) + #### 12.22 + #### 12.16"
  critical: "§6.4: the input handler returns text:event.text VERBATIM; the file bytes go ONLY into the custom
             message via before_agent_start. The three target functions consume that custom-message payload
             (blocks/details), not the prompt. §12.16: markers are never stripped — a markdown block's content
             carries the literal #@marker, which is what the renderer displays (honest, matches model input)."

# MUST READ — the contract: T1.S1/S2/S3 are LANDED; the verbatim cascade is complete
- file: plan/009_0d85ac0b1b08/P1M1T1S1/PRP.md   # (and S2, S3)
  why: "T1.S1 changed scanTokens→Promise<string[]> and processTokenStream→Promise<void> (no resolved indices).
        T1.S2 made injectMarkdown emit VERBATIM content (deleted Step 3.5 + Step 4 strip). T1.S3 made injectFiles
        return the original prompt verbatim (deleted resolvedIdx/strippedText). Together they complete the
        verbatim cascade. T2.S2 verifies the cascade did not break the three downstream consumers."
  critical: "All three are LANDED at HEAD d3219d2 (verified: grep resolvedIdx|strippedText → 0; typecheck 0
             errors; scanTokens L862 returns Promise<string[]>; processTokenStream L911 returns Promise<void>;
             injectMarkdown L1099 comment 'markers are detected ONLY to resolve imports, never stripped';
             injectFiles L1179/L1188 return `text` verbatim). T2.S2 does NOT re-edit them."

# MUST READ — the parallel sibling (T2.S1, NOT yet landed, irrelevant to this verdict)
- file: plan/009_0d85ac0b1b08/P1M1T2S1/PRP.md
  why: "T2.S1 is the one-line input-handler edit `text` → `text: event.text` (explicitness). It is a NO-OP at
        runtime (text already === event.text after T1.S3). The three target functions do NOT read the prompt,
        so whether T2.S1 has landed is irrelevant to T2.S2's verdict. T2.S2 does NOT depend on T2.S1 landing
        first — the verification holds at the current HEAD regardless."
  critical: "Do NOT wait for T2.S1. Do NOT edit the input handler (T2.S1 owns it). T2.S2 is read-only
             verification of the THREE NAMED functions, independent of the input-handler return wording."

# The file you audit (READ-ONLY — NO edits)
- file: file-injector.ts
  why: "1354 lines at HEAD d3219d2. The three target functions: before_agent_start handler (L1273-1290, inside
        the factory); computeDetailOffsets (L353-414, module-level export); renderInjectedMessage (L739-825,
        module-level export). The pending stash is set at L1257 (input handler). The custom message is returned
        at L1280-1288. All three functions consume ONLY blocks/details (verified by reading their bodies)."
  pattern: "Place functions by NAME (grep), not by the item's line numbers — the file shifted during T1.S1/S2/S3.
            `grep -n 'pi.on(\"before_agent_start\"|function computeDetailOffsets|function renderInjectedMessage'`."
  gotcha: "The item's line numbers (L1331-1342, L353-423, L739-825, L1317, L1333-1341) are from a slightly
           earlier state; the live tree is at L1273-1290 / L353-414 / L739-825 / L1257 / L1277-1289. The
           FUNCTIONS themselves match the item's §3a/b/c descriptions exactly — only the line numbers drifted."

# the verification gate (the cascade-completeness proof)
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict over file-injector.ts (resolving the global pi packages). It is the
        deterministic gate: if the T1.S1 signature changes (scanTokens/processTokenStream return types) had left
        any caller un-migrated, typecheck would fail. It passes (0 errors, verified at HEAD d3219d2), proving the
        cascade is complete and the three consumers compile clean against the new shapes."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD d3219d2, working tree clean (only orchestrator's tasks.json + untracked P1M1T2S1/)
├── file-injector.ts             # ← READ-ONLY audit target (1354 lines; POST T1.S1/S2/S3)
│                                #   before_agent_start handler: L1273-1290 (factory)
│                                #   computeDetailOffsets:        L353-414  (module export)
│                                #   renderInjectedMessage:       L739-825  (module export)
│                                #   pending stash set:           L1257     (input handler)
├── file-injector.test.mjs       # NOT edited (RED from T1.S3 — P1.M2.T1 migrates)
├── relative-imports.test.mjs    # NOT edited (RED — P1.M2.T2)
├── import-behavior.test.mjs     # NOT edited (RED — P1.M2.T2)
├── scripts/typecheck.mjs        # untouched (the gate — T2.S2 runs it; 0 errors)
├── package.json                 # untouched
├── PRD.md / README.md           # read-only (README verbatim sync is P1.M2.T4)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{system_context.md, stripping_logic_analysis.md, test_assertions_analysis.md, readme_analysis.md}
    ├── P1M1T1S1/{PRP.md}   # ← S1 (Complete): scanTokens→string[], processTokenStream→void
    ├── P1M1T1S2/{PRP.md}   # ← S2 (Complete): injectMarkdown verbatim
    ├── P1M1T1S3/{PRP.md}   # ← S3 (Complete): injectFiles verbatim return
    ├── P1M1T2S1/{PRP.md}   # ← T2.S1 (parallel, NOT yet landed): text→text:event.text (no-op; irrelevant here)
    └── P1M1T2S2/
        ├── research/research_notes.md   # ← verified live state + per-function body quotes + typecheck proof
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
# EXPECTED: NO files touched. `git status --short` shows no source changes after this subtask.
file-injector.ts    # UNCHANGED (read-only audit; the three functions are unaffected — no edit needed).
# No other files. No code. No tests. No new files.
```

### Known Gotchas of our codebase & Library Quirks

```markdown
<!-- CRITICAL — the EXPECTED outcome is "unaffected, NO edit." Verified first-hand at HEAD d3219d2: all three
     functions consume ONLY blocks/details (never the prompt); typecheck is 0 errors. Do NOT invent a drift
     to "justify" an edit. If your re-check confirms the three bodies match item §3a/b/c, the deliverable is
     the verdict + the typecheck proof. Editing a correct function would INTRODUCE a bug. -->

<!-- CRITICAL — the item's line numbers are STALE (metadata drift), the functions are NOT. Item cites
     before_agent_start L1331-1342, computeDetailOffsets L353-423, renderInjectedMessage L739-825, stash L1317,
     consume L1333-1341. The LIVE tree is L1273-1290, L353-414, L739-825, L1257, L1277-1289. The file shifted
     during T1.S1/S2/S3. Place by NAME: `grep -n 'pi.on("before_agent_start"\|function computeDetailOffsets\|
     function renderInjectedMessage' file-injector.ts`. Do NOT treat the line-number mismatch as drift to fix. -->

<!-- CRITICAL — T2.S1 (the text→text:event.text edit) is NOT yet landed and is IRRELEVANT to this verdict.
     T2.S1 is a runtime no-op (text already === event.text after T1.S3). The three target functions do NOT
     read the prompt, so whether T2.S1 has landed cannot affect them. Do NOT wait for T2.S1; do NOT edit the
     input handler (T2.S1 owns it). T2.S2 is independent. -->

<!-- GOTCHA — the verification gate is TYPECHECK, NOT the test suite. The .mjs suites are INTENTIONALLY RED
     (from T1.S3's return-shape change; ~78 stripped-expectation assertions like `r.text === "Review a.ts"`
     that should now be `Review #@a.ts`). P1.M2.T1 owns migrating them. T2.S2 does NOT run the suite as a gate
     and does NOT edit tests. Running the suite would show the red state — that is the expected P1.M2.T1 handoff,
     NOT a T2.S2 concern and NOT a regression. -->

<!-- GOTCHA — file-injector.ts is NOT modified by this subtask. If `git status --short` shows `M file-injector.ts`
     after T2.S2, either an accidental edit was made (revert it) or T2.S1 landed in the meantime (fine — but
     T2.S2 itself makes no edit). The proof of the no-op verdict is a clean `git status` for source files. -->

<!-- LIBRARY — TypeScript via jiti (no build step). typecheck = tsc --strict (scripts/typecheck.mjs). The three
     functions type-check clean against the new T1.S1 return shapes (scanTokens: Promise<string[]>,
     processTokenStream: Promise<void>) — confirmed by the 0-errors typecheck. No type change is needed. -->
```

## Implementation Blueprint

### The verification procedure (read-only — no edit expected)

**Step 1 — Run the gate (typecheck).**
```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# EXPECTED: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# This is the cascade-completeness proof (item §3d). If it fails, the T1.S1 signature changes left a caller
# un-migrated — but it passes at HEAD d3219d2 (verified). If it fails in your tree, STOP and report: the
# cascade was incomplete and M1 is NOT complete (the item §3d gate failed).
```

**Step 2 — Locate the three functions (by NAME, not line number).**
```bash
cd /home/dustin/projects/pi-file-injector
grep -n 'pi.on("before_agent_start"\|^export function computeDetailOffsets\|^export function renderInjectedMessage' file-injector.ts
# EXPECTED (at HEAD d3219d2): before_agent_start ~L1273; computeDetailOffsets L353; renderInjectedMessage L739.
# (Line numbers may shift; place by name.) Read each function's body.
```

**Step 3 — Confirm before_agent_start consumes ONLY blocks/details (item §3a).**
Read the handler body (live L1273-1290). Confirm:
- It reads `const { blocks, details } = pending;` — the stash carries ONLY blocks + details (NOT the prompt).
- It calls `computeDetailOffsets(blocks, details)`.
- It returns `{ message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } }`.
- It NEVER references `event.text`, `text`, or any prompt content. (It can't — the handler signature is
  `async (_e, _ctx) =>`, and the stash only carries blocks/details.)
- The `pending` stash is set in the input handler at L1257 (`pending = { blocks, details }`) and cleared
  one-shot here (`pending = null`). The stash carries NO prompt text.
- **Verdict: UNAFFECTED.** The verbatim-prompt change is invisible to this handler.

**Step 4 — Confirm computeDetailOffsets operates on blocks/details via LENGTH-derived offsets (item §3b).**
Read the function body (live L353-414). Confirm:
- It computes `starts[]` via `off += b.length + SEP.length` (pure length arithmetic over `blocks`).
- For each detail, it finds the matching body-bearing block and sets
  `d.contentStart = starts[bi] + headerLen; d.contentLen = blk.length - headerLen - closerLen;` (length-derived).
- It NEVER references the prompt text (it receives only `blocks` + `details` as params).
- A verbatim `#@api.md` marker inside a markdown block's body makes `blk.length` a few chars larger →
  `contentLen` auto-includes those chars → the offset the renderer slices still points at the WHOLE body.
  **No code change needed.**
- **Verdict: UNAFFECTED.** Length-derived offsets adjust automatically to verbatim content.

**Step 5 — Confirm renderInjectedMessage reads message.content/details, never the prompt (item §3c).**
Read the function body (live L739-825). Confirm:
- It reads `files = message?.details?.files ?? []` and `message.content` (the joined blocks).
- It re-derives each body via 3-tier resolution: tier-1 offset slice
  (`message.content.slice(d.contentStart, d.contentStart + d.contentLen)` — uses the offsets
  computeDetailOffsets set); tier-2 stored `d.body` (deprecated); tier-3 regex (`FILE_BLOCK_RE`).
- It NEVER references the prompt text (it receives `message` — the custom message — not the user message).
- A markdown block's body containing a literal `#@api.md` marker renders AS-IS in the expanded view
  (tier-1 slice includes the marker chars; tier-3 regex captures them in the body). This is CORRECT and
  HONEST — the model sees the same content (the custom message's content), so the display matches the
  model input (PRD §6.3: the renderer shows "what was delivered"). **No code change needed.**
- The defensive fallback (`files.length === 0` → single "read (injected files)" line + raw content) is
  UNCHANGED.
- **Verdict: UNAFFECTED.** The renderer displays the verbatim content honestly, matching model input.

**Step 6 — Record the verdict + prove the no-op.**
```bash
git status --short
# EXPECTED: no source file modified by T2.S2 (only the orchestrator's tasks.json + untracked plan/ dirs,
# neither of which is T2.S2's doing). This is the proof of the no-op verdict.
```
- Record: "All three functions unaffected. typecheck 0 errors. M1 complete."
- DOCS (item §5): "none — verification-only subtask."

### Implementation Tasks (ordered)

```yaml
Task 1: RUN the gate — npm run typecheck
  - RUN: `cd /home/dustin/projects/pi-file-injector && npm run typecheck`
  - EXPECT: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
  - This is the item §3d gate (cascade-completeness proof). If it passes (it does at HEAD d3219d2), the
    T1.S1 signature changes (scanTokens→Promise<string[]>, processTokenStream→Promise<void>) type-check
    clean and the three consumers compile against the new shapes.
  - IF IT FAILS: STOP. The cascade is incomplete (a caller wasn't migrated). Report the typecheck error —
    M1 is NOT complete. (Not expected at HEAD d3219d2; verified passing.)

Task 2: READ before_agent_start (item §3a) — confirm it consumes ONLY blocks/details
  - LOCATE: `grep -n 'pi.on("before_agent_start"' file-injector.ts` (live ~L1273).
  - CONFIRM: reads `const { blocks, details } = pending`; calls `computeDetailOffsets(blocks, details)`;
    returns `{ message: { customType:"fileInjector.injected", content: blocks.join("\n\n"), display:true,
    details:{files:details} } }`; handler sig is `(_e, _ctx)` (no prompt access); `pending` set at L1257
    carries only {blocks,details}.
  - VERDICT: UNAFFECTED (the handler never sees the prompt text).

Task 3: READ computeDetailOffsets (item §3b) — confirm length-derived offsets over blocks/details
  - LOCATE: `grep -n '^export function computeDetailOffsets' file-injector.ts` (live L353).
  - CONFIRM: `starts[]` via `off += b.length + SEP.length`; `d.contentStart/contenLen` via
    `starts[bi] + headerLen` and `blk.length - headerLen - closerLen`; params are `(blocks, details)` only.
  - VERDICT: UNAFFECTED (verbatim markers auto-adjust via blk.length; no prompt access).

Task 4: READ renderInjectedMessage (item §3c) — confirm it reads message.content/details, never the prompt
  - LOCATE: `grep -n '^export function renderInjectedMessage' file-injector.ts` (live L739).
  - CONFIRM: reads `message?.details?.files ?? []` + `message.content`; 3-tier body resolution
    (offset slice / stored body / regex); params are `(message, opts, theme)`; never references the prompt.
  - VERDICT: UNAFFECTED (a markdown block's body with a literal #@marker renders as-is — honest, matches
    model input; defensive fallback unchanged).

Task 5: RECORD the verdict + prove the no-op
  - RUN: `git status --short` → EXPECT no source file modified by T2.S2.
  - RECORD: "All three functions unaffected. typecheck 0 errors. M1 complete." (item §4).
  - DOCS (item §5): "none — verification-only subtask."
```

### Integration Points

```yaml
FILE_EDITS: NONE (expected, verified). file-injector.ts is read-only for this subtask.
  - The three target functions are UNAFFECTED by the verbatim cascade (they consume only blocks/details).
  - If a drift HAD been found (none is), the only acceptable response would be to STOP and report — NOT to
    edit the function (item §3: "READ-ONLY verification — do NOT modify these functions"). A drift would
    mean the cascade broke something and M1 is NOT complete; the fix belongs to a new subtask, not T2.S2.

NO_CODE / NO_TESTS / NO_NEW_FILES: verification only. file-injector.ts is not modified; the .mjs suites are
  not run as a gate (they are RED from T1.S3 — P1.M2.T1 migrates them); no new files.

NO_CONFLICT_WITH_SIBLINGS:
  - T2.S1 (parallel, NOT yet landed): the text→text:event.text edit. A no-op at runtime; irrelevant to the
    three target functions (they don't read the prompt). T2.S2 does not depend on T2.S1 landing.
  - P1.M2.T1 (upcoming): migrates the red suite to verbatim assertions. T2.S2 does not touch tests.
  - P1.M2.T4 (upcoming): README verbatim sync. T2.S2 is internal verification — no user-facing doc.
```

## Validation Loop

### Level 1: Typecheck (THE gate — item §3d)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# EXPECTED: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# This is the cascade-completeness proof. The T1.S1 signature changes (scanTokens→Promise<string[]>,
# processTokenStream→Promise<void>) and the T1.S2/S3 verbatim changes all type-check clean.
# If it fails: the cascade left a caller un-migrated — STOP, report the error, M1 is NOT complete.
# (Verified passing at HEAD d3219d2.)
```

### Level 2: Structural read (confirm the three function bodies match item §3a/b/c)

```bash
cd /home/dustin/projects/pi-file-injector
echo "=== before_agent_start (locate + read) ===";
grep -n 'pi.on("before_agent_start"' file-injector.ts
# Read the handler body. CONFIRM: consumes pending={blocks,details}; calls computeDetailOffsets(blocks,details);
# returns custom message with content: blocks.join("\n\n"); never references event.text/text. (item §3a)

echo "=== computeDetailOffsets (locate + read) ===";
grep -n '^export function computeDetailOffsets' file-injector.ts
# Read the function body. CONFIRM: starts[] via b.length+SEP.length; contentLen via blk.length-headerLen-closerLen;
# params (blocks, details) only; never sees the prompt. (item §3b)

echo "=== renderInjectedMessage (locate + read) ===";
grep -n '^export function renderInjectedMessage' file-injector.ts
# Read the function body. CONFIRM: reads message.details.files + message.content; 3-tier body resolution;
# params (message, opts, theme); never references the prompt; defensive fallback unchanged. (item §3c)
```

### Level 3: No-op proof (the verification gate)

```bash
cd /home/dustin/projects/pi-file-injector
git status --short
# EXPECTED: NO source file modified by T2.S2. The only working-tree changes should be the orchestrator's
# plan/009.../tasks.json (not yours) and untracked plan/009.../P1M1T2S{1,2}/ dirs (the PRPs).
# If `M file-injector.ts` appears: either an accidental edit was made (revert: `git checkout file-injector.ts`)
# or T2.S1 landed in the meantime (fine — but T2.S2 itself makes no edit). The proof of the no-op verdict
# is that T2.S2 leaves source files untouched.
git diff --stat file-injector.ts   # EXPECTED: empty (no stat output). Belt-and-suspenders.
```

### Level 4: Red-suite acknowledgment (NOT a T2.S2 gate — do NOT run/fix)

```bash
# The .mjs suites are INTENTIONALLY RED from T1.S3 (~78 stripped-expectation assertions). P1.M2.T1 migrates
# them. T2.S2 does NOT run the suite as a gate and does NOT edit tests. If you run it expecting validation,
# you will see the red state — that is the expected P1.M2.T1 handoff, NOT a T2.S2 regression.
# (Optional, for context only — NOT required: `node ./file-injector.test.mjs 2>&1 | grep Result:` shows
#  the same red state as post-T1.S3. T2.S2 changes no assertion-relevant behavior.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict` (the item §3d gate; verified passing at HEAD `d3219d2`).
- [ ] `git status --short` shows NO source file modified by T2.S2 (the no-op proof).

### Feature (Audit) Validation

- [ ] **before_agent_start** (item §3a): confirmed it consumes ONLY `pending = { blocks, details }`, calls
      `computeDetailOffsets(blocks, details)`, returns the custom message with `content: blocks.join("\n\n")`,
      and never references the prompt text.
- [ ] **computeDetailOffsets** (item §3b): confirmed it operates on `blocks[]` + `details[]` via length-derived
      offsets (`block.length + SEP.length`; `blk.length - headerLen - closerLen`); verbatim markers auto-adjust.
- [ ] **renderInjectedMessage** (item §3c): confirmed it reads `message.details.files` + `message.content`
      (3-tier body resolution), never the prompt; verbatim markers render as-is (honest); defensive fallback
      unchanged.
- [ ] VERDICT recorded: "All three functions unaffected. typecheck 0 errors. M1 complete." (item §4).

### Scope & Gate Integrity

- [ ] NO file edited (read-only verification). NO code, NO tests, NO README.
- [ ] NO dependence on T2.S1 landing (the three functions don't read the prompt; T2.S1 is a no-op regardless).
- [ ] NO running/fixing the red suite (P1.M2.T1 owns migration).
- [ ] The item's stale line numbers are NOT treated as drift (place by function NAME).

### Documentation

- [ ] DOCS outcome: "none — verification-only subtask" (item §5).
- [ ] No README/user-facing change (README verbatim sync is P1.M2.T4).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT edit any of the three functions.** Item §3 is explicit: "READ-ONLY verification — do NOT modify
  these functions." They are unaffected (verified). Editing a correct function would INTRODUCE a bug. If you
  genuinely find a drift, STOP and report — the fix belongs to a new subtask, not T2.S2.
- ❌ **Do NOT invent a drift to justify an edit.** The expected outcome (verified first-hand at HEAD `d3219d2`)
  is "unaffected — no code changes." All three functions consume only blocks/details; typecheck is 0 errors.
- ❌ **Do NOT treat the item's stale line numbers as drift.** The item cites L1331-1342/L1317/L1333-1341; the
  live tree is L1273-1290/L1257/L1277-1289 (the file shifted during T1). The FUNCTIONS match the item's §3a/b/c
  descriptions exactly. Place by NAME (`grep -n`), not by line number.
- ❌ **Do NOT wait for T2.S1 to land.** T2.S1 (`text`→`text:event.text`) is a runtime no-op (text already ===
  event.text after T1.S3) and is irrelevant to the three target functions (they don't read the prompt). T2.S2
  is independent; the verification holds at the current HEAD regardless.
- ❌ **Do NOT run the test suite as a gate.** The .mjs suites are INTENTIONALLY RED from T1.S3 (~78 stripped-
  expectation assertions). P1.M2.T1 migrates them. T2.S2's gate is typecheck + the structural read — NOT the
  suite. Running it will show red; that is the expected P1.M2.T1 handoff, NOT a T2.S2 regression.
- ❌ **Do NOT edit PRD.md, README.md, the tests, or any source file.** This is a read-only verification. The
  only output is the verdict + the typecheck proof + (optionally) research notes in the research/ subdir.
- ❌ **Do NOT re-edit the engine (scanTokens/processTokenStream/injectMarkdown/injectFiles).** T1.S1/S2/S3 own
  them and they are LANDED. T2.S2 only READS the three named consumers to confirm they are unaffected.
- ❌ **Do NOT conflate "the prompt is verbatim" with "the file content changed."** The verbatim cascade changed
  how IMPORT MARKERS WITHIN markdown content are handled (strip → keep). The file CONTENT (blocks) now includes
  literal markers — but that content is then treated identically by computeDetailOffsets (length-derived) and
  renderInjectedMessage (display whatever is in content). The PROMPT text (event.text) is a separate stream none
  of the three functions read.

---

## Confidence Score: 10/10

A read-only verification subtask whose outcome ("all three functions unaffected — no code changes") has been
verified first-hand at HEAD `d3219d2`: `npm run typecheck` → 0 errors; all three function bodies read and
confirmed to consume ONLY blocks/details (before_agent_start reads `pending={blocks,details}` and returns
`content: blocks.join("\n\n")`; computeDetailOffsets uses length-derived offsets over `blocks[]`;
renderInjectedMessage reads `message.content`/`message.details.files` and never the prompt). The verbatim
cascade (T1.S1/S2/S3 all LANDED) changed how markers within markdown content are handled, but the three
consumers operate on the content stream (blocks/details), which is unaffected — verbatim markers auto-adjust
the length-derived offsets and render honestly in the expanded view. The PRP includes the corrected live line
ranges (the item's line numbers drifted; place by NAME), the quoted body of each function, the item §3a/b/c
claims mapped to live code, the rationale for structural immunity, and the exact verification gate (typecheck
+ structural read + clean `git status`). The implementing agent runs typecheck, reads three function bodies,
records the verdict, and STOPS — leaving source files untouched. There is no code path, no test run, no build,
and no ambiguity. M1 is complete if typecheck passes (it does).