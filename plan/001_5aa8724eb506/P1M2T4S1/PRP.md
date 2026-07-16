---
name: "P1.M2.T4.S1 — Manual test matrix: all 14 PRD §11 acceptance cases incl. format parity & @ non-interference"
prd_ref: "PRD §11 (Acceptance Criteria & Test Plan — Manual test matrix + Automated sanity check), §10 (Edge Cases), §13.2 (documented size tradeoff), Appendix A (Done-definition)"
target_file: "./file-injector.test.mjs"  # NEW model-free harness (tests the REAL committed file-injector.ts); plus a validation report.
target_language: JavaScript (Node .mjs; runs the shipped .ts via jiti — NO tsconfig/package.json/test framework exists in this repo)
depends_on: "P1.M1.T1.S1–T3.S2 (the COMPLETE extension — all 8 named exports + default factory must already exist in ./file-injector.ts)"
consumed_by: "P1.M2.T5.S1 (README known-limitations section is informed by this task's validation report/findings)"
---

# PRP — P1.M2.T4.S1: 14-Case Acceptance Test Matrix (model-free harness + validation report)

## Goal

**Feature Goal**: Build a **reusable, model-free, non-interactive acceptance test harness**
(`./file-injector.test.mjs`) that imports the **REAL committed `file-injector.ts`** and asserts **all
14 PRD §11 acceptance cases** plus the §10 edge cases and the 3 handler guards — then RUN it and produce
a **pass/fail validation report** confirming the extension meets Definition of Done. 12 of the 14 cases
are fully automated (no model, no API key, no Pi process); cases #12 (initial `-p`) and #13-end-to-end
(`pi @a.ts` parity) are exercised at the structural/format level automatically AND documented as live-Pi
integration commands.

**Deliverable** (two artifacts):
1. **`./file-injector.test.mjs`** — a single self-contained Node ESM script at the repo root (committed,
   re-runnable) that: resolves the global pi package via `npm root -g`; imports `./file-injector.ts`
   through `jiti` with the verified `alias` config; spins up temp fixtures; runs ~25 named assertions
   covering the 14 cases + edge cases + guards + notify + format parity; prints a per-case `✓/✗` report;
   **exits 0 iff all model-free assertions pass**.
2. **`./plan/001_5aa8724eb506/P1M2T4S1/validation_report.md`** — the actual pass/fail results captured
   from a real run (fulfills the tasks.json OUTPUT: "A pass/fail validation report for all 14 test cases").

**Success Definition**:
- [ ] `node ./file-injector.test.mjs` exits **0** with all ~25 model-free assertions green, printing a
      14-row matrix (cases 1–14) where 12 show `✓ AUTO PASS`, and #12/#13 show `ℹ INTEGRATION` with the
      exact live-Pi command to run manually.
- [ ] Every assertion maps 1:1 to a PRD §11 expected behavior (see "Case → assertion mapping").
- [ ] The harness imports the REAL `file-injector.ts` (not a reference copy) — verified by mutating a
      fixture and seeing the assertion react (or by asserting `mod.injectFiles`/`mod.default` are the
      shipped functions).
- [ ] The harness is **cwd-independent**: it resolves `./file-injector.ts` and the pi package by absolute
      path (`path.resolve` from the test file's dir + `npm root -g`), NOT a hardcoded `/home/dustin/...`.
- [ ] The validation report records the actual counts (e.g. "25 passed, 0 failed") + any deviations, and
      lists the 2 integration commands with their expected observations.
- [ ] **No modification to `file-injector.ts`, PRD.md, tasks.json, or prd_snapshot.md.** If a test
      fails, it is REPORTED here, not silently fixed — the fix belongs to the owning M1 subtask
      (tasks.json: "Any bugs found feed back into the implementing subtasks (T1-T3) for fixes").

> **Scope boundary (read carefully):** This is a VALIDATION task. You BUILD a test harness and RUN it;
> you do NOT edit the extension, the PRD, or the orchestrator files. You do NOT write README.md (that is
> P1.M2.T5.S1). You do NOT invent a test framework (none exists; the project's pattern is standalone
> `.mjs` scripts — this PRP specifies the exact one). The harness MUST be hermetic and deterministic: no
> network, no model API key, no interactive TUI. Tiny fixed fixtures (not 50 MB files) prove the
> "entire file / no truncation" contract via exact byte-equality.

## User Persona

**Target User**: The maintainer/validator who must confirm the shipped extension meets PRD §11 before
declaring Definition of Done and writing the README (P1.M2.T5.S1).

**Use Case**: Run one command — `node ./file-injector.test.mjs` — and get an unambiguous pass/fail
verdict across all 14 acceptance cases without launching Pi, typing into a TUI, or spending model tokens.
Re-run it after any future change to `file-injector.ts` to catch regressions.

**User Journey**: clone repo → `node ./file-injector.test.mjs` → harness auto-detects global pi,
imports the real `.ts`, builds temp fixtures, prints `✓ case 1 … ✓ case 14`, exits 0 → validator records
counts in `validation_report.md` → README (T5.S1) can cite "all 14 §11 cases pass".

**Pain Points Addressed**: PRD §11 is literally a "Manual test matrix" that today requires a human
driving the TUI / a real model for every case. That is slow, non-repeatable, and token-expensive. Most
cases are deterministic structural properties (block format, token-presence, regex no-match, guard
returns) that an automated gate can assert instantly. The 2 genuinely-live cases (#12 `-p`, #13 e2e
parity) are still documented as exact commands so a human runs only those.

## Why

- **Acceptance = the gate before "done".** PRD Appendix A's Done-definition is "all 14 manual test cases
  in §11 pass; no uncaught errors; … prompts without `#@` (including bare `@file`) are byte-for-byte
  unchanged; `#@` works in both interactive and initial `-p` messages." This task produces the evidence.
- **The extension already exports everything needed for model-free testing.** `injectFiles`,
  `cleanToken`, `expandTildeAndResolve`, `extOf`, `isBinary`, `formatTextFileBlock`, `formatImageBlock`,
  `formatBinaryBlock`, and the `default` factory are all named/default exports of `file-injector.ts`
  (deliberately, per P1M1T3S1 research §6: "Enables the model-free Level-2 gate"). A test can import and
  drive them directly — no Pi runtime required.
- **Format parity (#13) is structural, not behavioral.** Both `#@` and the built-in `@file` emit the
  same `<file name="ABS">\n<content>\n</file>` template (verified against `dist/cli/file-processor.js`).
  Parity is therefore assertable by string comparison against the documented template, no live Pi needed.
- **Cheap regression insurance.** A committed `.mjs` gate that exits non-zero on regression protects
  every future edit to the extension — far cheaper than re-running the 14-case manual matrix by hand.

## What

Create ONE new file `./file-injector.test.mjs` (repo root) and ONE report
`./plan/001_5aa8724eb506/P1M2T4S1/validation_report.md`. The harness:

1. **Resolves the global pi package root** via `npm root -g` (verified: →
   `/home/dustin/.local/lib/node_modules`; package at `…/@earendil-works/pi-coding-agent`).
2. **Imports the real `./file-injector.ts`** via `createJiti(...).import(absPath)` with the verified
   `alias` map (see "Verified import mechanism").
3. **Captures the default handler** via a mock `pi = { on: (_ev, cb) => { rec.cb = cb } }` + mock `ctx`
   with a `notify` recorder, then drives `rec.cb(event, ctx)` to test guards/notify/transform/continue.
4. **Creates temp fixtures** in `mkdtempSync(os.tmpdir(), "saf-")`: `a.ts`, `b.ts`, `huge.log` (~2 MB of
   repeated lines), `pic.png` (the fixed 67-byte 1×1 PNG below), `data.bin` (Buffer with a `0x00` NUL
   byte), `empty.txt` (0 bytes), `src/` (a directory), and `~/sharp-at-notes.md` (written into
   `os.homedir()` then removed in cleanup).
5. **Runs the 14 cases** (see "Case → assertion mapping") + §10 edge cases + 3 guards, each as a named
   assertion via a tiny `assert(cond, msg)` helper that increments pass/fail counters and prints
   `✓`/`✗ case N: <name>`.
6. **Integration cases (#12, #13 e2e)**: print `ℹ INTEGRATION (run manually): <exact command>` and do
   NOT affect the exit code (keep the gate hermetic). #13 *format* parity IS asserted model-free.
7. **Exits `process.exit(failed ? 1 : 0)`** and cleans up the temp dir + the `~/sharp-at-notes.md` file.

### Success Criteria

- [ ] `node ./file-injector.test.mjs` prints a 14-row matrix; exits 0 with 0 model-free failures.
- [ ] Cases #1–#11 and #14 are `✓ AUTO PASS` (12 automated cases).
- [ ] #13 *format parity* is `✓ AUTO PASS` (model-free); #13 *e2e* and #12 are `ℹ INTEGRATION`.
- [ ] Edge cases (empty file, mid-word, markdown/issue, read-error-on-chmod-000-when-not-root, missing,
      directory) + 3 guards (source==="extension", steer, no-`#@`) are asserted.
- [ ] `validation_report.md` records the actual counts and the 2 integration commands + expected output.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the VERIFIED jiti+alias import snippet (probed live; the
> one non-obvious mechanism), the VERIFIED `npm root -g` resolver, the VERIFIED mock pi/ctx handler
> pattern, the VERIFIED `processFileArguments` parity templates (with `file-processor.js:line` evidence),
  the VERIFIED tiny-image `resizeImage→null` determinism + whole-image-parity fact, the EXACT fixed
  PNG fixture bytes, a per-case assertion spec for all 14 + edges, and a Level-2 gate definition that
  needs no model/API key/Pi-process. No `dist/` spelunking required by the implementer.

### Documentation & References

```yaml
# MUST READ — the artifact under test (READ-ONLY this task)
- file: ./file-injector.ts
  why: "The COMPLETE shipped extension. Exports: cleanToken, expandTildeAndResolve, extOf, isBinary,
        formatTextFileBlock, formatImageBlock, formatBinaryBlock, injectFiles, and default (the
        (pi)=>void factory). The harness imports THIS file — not a reference copy."
  pattern: "default(pi){pi.on('input', async(event,ctx)=>{…3 guards…; await injectFiles(…); notify; transform/continue})}"
  gotcha: "injectFiles takes ctx:{cwd:string} (a STRUCTURAL type, not full ExtensionContext) — so a plain
        {cwd:dir} object is a valid argument. It returns {text,images,injected} where injected is a COUNT."

# MUST READ — verified architecture recon (the contracts the harness asserts against)
- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: "§1 InputEvent/InputEventResult exact shapes (source union, streamingBehavior, action variants).
        §5 ExtensionContext: ctx.cwd (string), ctx.hasUI (bool), ctx.ui.notify(message, type?:'info'|'warning'|'error')
        — the mock ctx must provide exactly {cwd, hasUI, ui:{notify}}."
  section: "§1, §5"
  critical: "notify's 2nd arg is named `type` (NOT `level`), constrained to info|warning|error. The handler
        passes the literal 'info'. The mock recorder captures {m, t}."

- docfile: plan/001_5aa8724eb506/architecture/system_context.md
  why: "'Input Event Dispatch Internals' (runner.js:882-920): transform-with-images REPLACES the array;
        'Critical: Image Array Merging' — the multi/image cases must assert images are MERGED (user image
        preserved at [0]). 'Format Parity with processFileArguments' table — the #13 expected templates.
        'Deliberate Divergences' — binary→note, empty→injected (NOT skipped), missing→token-verbatim
        (NOT exit). These divergences ARE the assertions for cases #2/#4/#5 and the empty edge case."
  section: "Input Event Dispatch Internals + Critical: Image Array Merging + Format Parity + Deliberate Divergences"

- docfile: plan/001_5aa8724eb506/architecture/external_deps.md
  why: "resizeImage(inputBytes: Uint8Array, mime, opts?) => Promise<ResizedImage|null>; defaults 2000x2000,
        4.5MB; returns null if it can't process → fallback data===buf.toString('base64'). ImageContent
        data is raw base64 (NO data: prefix). Drives the #3 image assertions."

# MUST READ — the prior subtask contracts (what the shipped functions guarantee)
- docfile: plan/001_5aa8724eb506/P1M1T3S1/PRP.md
  why: "injectFiles contract: seeds images=[...imagesIn] (MERGE), returns ORIGINAL imagesIn ref when
        count===0 (assert: r.images === imagesIn on the no-op path) and a COPY when >0; each file isolated
        in try/catch (NEVER throws); finalText = text + '\\n\\n---\\n\\n' + blocks.join('\\n\\n'); original
        text is NOT mutated (assert: the '#@' markers remain)."
  critical: "injected is a NUMBER (count), not a boolean — assert r.injected === 2 for the multi case, not ==true."

- docfile: plan/001_5aa8724eb506/P1M1T3S2/PRP.md
  why: "Handler contract: guard order source→steer→includes('#@'); each guard returns {action:'continue'};
        notify fires IFF ctx.hasUI && injected>0, msg `#@ injected ${injected} file(s)`, type 'info';
        success returns {action:'transform', text, images}. Assert all of these via the mock pi/ctx."

# THIS TASK's research (the verified import mechanism + per-case mapping)
- docfile: plan/001_5aa8724eb506/P1M2T4S1/research/research_notes.md
  why: "§2 the VERIFIED createJiti+alias snippet (probe4.mjs) — load-bearing; copy verbatim. §3 the mock
        pi/ctx pattern. §4 processFileArguments exact templates (file-processor.js:24-64) for parity. §5
        tiny-image resizeImage→null determinism + whole-image-parity. §6 the full Case→assertion table."
  section: "§2, §3, §4, §5, §6"

# PRD source of truth (read-only; do NOT edit PRD.md)
- docfile: PRD.md
  why: "§11 = the 14-case manual matrix (authoritative expected behaviors). §10 = edge-case checklist.
        §13.2 = the documented size tradeoff (case #2 — whole file injected, no gate). Appendix A =
        Done-definition (the success bar this task produces evidence for)."
  section: "§10, §11 (h3.19), §13.2, Appendix A"
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-file-injector
.
├── .gitignore            # ignores node_modules/, dist/, .pi-subagents/ — NOT .ts/.mjs ✓
├── PRD.md                # READ-ONLY source of truth
├── file-injector.ts      # ← COMPLETE extension under test (8 exports + default). DO NOT EDIT.
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/{api_verification,system_context,external_deps,extension_patterns}.md
        ├── prd_snapshot.md / prd_index.txt
        ├── tasks.json          # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T{1,2,3}*/{PRP.md, research/}   # the complete extension's contracts
        └── P1M2T4S1/
            ├── research/research_notes.md      # THIS TASK's verified research
            ├── PRP.md                          # ← THIS FILE
            └── validation_report.md            # ← THIS TASK CREATES (after running the harness)
# NOTE: NO src/, NO package.json, NO tsconfig, NO test framework. The harness is a standalone .mjs
#       that loads .ts via jiti (Pi's own loader mechanism). It is committed (NOT a /tmp script).
```

### Desired Codebase tree with files to be added

```bash
file-injector.test.mjs   # NEW — repo root. ~180–240 lines. Model-free acceptance harness.
                         #   Responsibility: import real file-injector.ts via jiti+alias; run the 14
                         #   PRD §11 cases + edges + guards as assertions; exit 0 iff all pass.
plan/001_5aa8724eb506/P1M2T4S1/validation_report.md   # NEW — captured pass/fail counts + 2 integration cmds.
```

### Known Gotchas of our codebase & Library Quirks

```javascript
// CRITICAL — jiti is NESTED inside the global pi package; it is NOT resolvable from an arbitrary dir.
//   `import { createJiti } from "jiti"` from /tmp FAILS (ERR_MODULE_NOT_FOUND, verified). You MUST use a
//   dynamic absolute import: `const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs")`.
//   PIPKG = (await npm root -g) + "/@earendil-works/pi-coding-agent".

// CRITICAL — the alias map is MANDATORY. file-injector.ts imports "@earendil-works/pi-coding-agent" and
//   "@earendil-works/pi-ai", which are NOT resolvable from the project cwd (verified MODULE_NOT_FOUND).
//   Pi's own loader passes these aliases (loader.js:84-88). Replicate verbatim:
//     alias = {
//       "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",   // package.json main (NOT "/index.js")
//       "@earendil-works/pi-ai":           PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js", // compat entry
//     };
//   Wrong values → "Cannot find module '@earendil-works/pi-coding-agent'" from inside the .ts (verified).

// CRITICAL — import the REAL file by ABSOLUTE path resolved from THIS script's dir, not a hardcoded path:
//     const TS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "file-injector.ts");
//   So the harness is cwd-independent and works for any maintainer, not just /home/dustin.

// CRITICAL — the mock ctx must be a STRUCTURAL match to what the handler reads: { cwd: string, hasUI: boolean,
//   ui: { notify(message, type?) } }. The handler also guards notify on `ctx.hasUI` — to test the headless
//   (print/json) path, set hasUI:false and assert notify is NEVER called.

// CRITICAL — injectFiles takes ctx:{cwd:string} (structural), NOT the full ExtensionContext. Passing the
//   plain {cwd:dir} mock is correct AND is exactly why T3.S1 made the type structural (testability).

// GOTCHA — `resizeImage` on a tiny 1×1 PNG (67 bytes) resolves `null` DETERMINISTICALLY (verified). So the
//   image case (#3) deterministically exercises the FALLBACK: data===raw base64, mimeType unchanged, block
//   `<file name="ABS"></file>` (empty hints). Use this fixed PNG — do NOT generate a random image (which
//   would non-deterministically hit the resize branch and make the assertion flaky).

// GOTCHA — `String.prototype.matchAll` is used (NOT a lastIndex-mutating .exec loop), so there is NO regex
//   lastIndex stale-state risk. Do not "fix" the global regex by resetting lastIndex in the harness.

// GOTCHA — assert `injected` with === against the integer (2 for multi), never == truthy. It is a COUNT.

// GOTCHA — chmod-000 read-error test is PLATFORM-CONDITIONAL: ineffective when running as root
//   (process.getuid()===0). Guard it: `if (process.getuid() !== 0)` — else SKIP with a printed note (same
//   caveat P1M1T3S1 used). Do NOT let it falsely pass or falsely fail.

// GOTCHA — the tilde case (#10) writes into os.homedir(). CLEAN IT UP in a finally block (rm the test file)
//   so the harness leaves no litter in the user's home dir. Use a uniquely-named file like
//   ".sharp-at-test-notes.md" to avoid clobbering anything real.

// GOTCHA — case #13 PARITY is about the per-block FORMAT, not the assembly. Pi concatenates raw
//   (`text += block + "\n"`); we join with "\n\n" under "---". So assert our formatTextFileBlock output
//   equals `<file name="ABS">\n${content}\n</file>` (the file-processor.js:59 template MINUS its trailing
//   "\n", which our assembly owns). Do NOT assert the whole transformed text equals Pi's — only the block.
```

## Implementation Blueprint

### Data models and structure

No production data models. The harness defines only test-local shapes:

```typescript
// Minimal mock types (the harness implements these as plain JS objects — no type annotations needed
// since the file is .mjs, but these document the required structural shapes).
type MockPi  = { on: (event: "input", handler: (e: InputEvent, ctx: MockCtx) => Promise<InputEventResult>) => void };
type MockCtx = { cwd: string; hasUI: boolean; ui: { notify: (message: string, type?: "info"|"warning"|"error") => void } };
type Recorder = { cb?: (e: InputEvent, ctx: MockCtx) => Promise<InputEventResult>; notify?: { m: string; t: string } };

// The harness's tiny assertion helper
function assert(cond: boolean, msg: string): void;   // throws on false; counts pass/fail
function caseRow(n: number, name: string, status: "PASS"|"FAIL"|"INTEGRATION", detail?: string): void;
```

`InputEvent` / `InputEventResult` shapes are quoted verbatim below (verified, `dist/core/extensions/types.d.ts`).

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE ./file-injector.test.mjs (repo root; NEW file)
  - OBJECTIVE: a self-contained model-free harness asserting all 14 PRD §11 cases + edges + guards.
  - STRUCTURE (top-to-bottom):
      (a) Imports: node:fs (promises + sync), node:path, node:os, node:child_process (execSync),
          node:url (fileURLToPath).
      (b) PIPKG resolver: const PIPKG = execSync("npm root -g").toString().trim()
          + "/@earendil-works/pi-coding-agent". (Add a friendly error if `dist/index.js` is missing.)
      (c) jiti + alias import (VERIFIED snippet — copy from "Verified import mechanism" verbatim).
      (d) Load the real extension: const TS = path.resolve(dirname(fileURLToPath(import.meta.url)),
          "file-injector.ts"); const mod = await jiti.import(TS);
      (e) Sanity: assert typeof mod.default==="function" && typeof mod.injectFiles==="function" (proves
          we loaded the REAL file, not a stub).
      (f) Mock pi/ctx factory + a tiny assert() helper + pass/fail counters + a results[] array.
      (g) Fixture setup: mkdtempSync; write a.ts (~50 words), b.ts, huge.log (2 MB), pic.png (FIXED bytes
          below), data.bin (Buffer [0x00,0x01,...]), empty.txt (0 bytes), mkdirSync("src"). Plus a
          HOME-relative notes file for the tilde case (cleanup in finally).
      (h) The 14 cases as a sequence of await runCase(N, name, async () => { …asserts… }) calls — each
          uses mod.injectFiles(...) for logic cases and the captured handler (mod.default(mockPi)) for
          guard/notify/transform cases. See "Case → assertion mapping".
      (i) Edge cases + 3 guards (see below).
      (j) Integration printout: for #12 and #13-e2e, push a row with status INTEGRATION and the exact
          command (do not throw / do not count against exit code).
      (k) Print the 14-row matrix + summary "X passed, Y failed". Cleanup temp dir + home notes file in
          a finally. process.exit(failed ? 1 : 0).
  - NAMING: file `file-injector.test.mjs`; helper functions assert/caseRow/runCase (snake/camel per JS
        norm). NO new exports — the script is a runnable program, not a library.
  - FOLLOW pattern: the verified probe snippets (research §2/§3) + the project's standalone-.mjs-gate
        convention (P1M1 research). Do NOT introduce vitest/mocha/node:test (none configured; the bare
        assert() helper matches the project's zero-deps ethos).
  - PLACEMENT: repo root (alongside file-injector.ts) so `node ./file-injector.test.mjs` is the command.
  - DEPENDENCIES: node builtins only + the global pi package's nested jiti (via dynamic import). ZERO
        npm installs. ZERO new package.json.

Task 2: RUN the harness and CREATE ./plan/001_5aa8724eb506/P1M2T4S1/validation_report.md
  - COMMAND: `node ./file-injector.test.mjs` (capture full stdout).
  - WRITE validation_report.md with: date, node version, `pi --version`, the 14-row matrix as recorded,
        the summary counts, and a "Findings" section (any ✗ rows → the owning M1 subtask that must fix;
        if all pass, state "All 14 §11 acceptance criteria met; Definition of Done (Appendix A) satisfied
        for the model-free subset; #12/#13-integration pending a live pi run"). Include the 2 integration
        commands and their expected observations verbatim.
  - IF any model-free assertion FAILS: do NOT edit file-injector.ts in this task. Record the failure,
        name the owning subtask (T1.S2/T2.S1/T3.S1/T3.S2), and mark the report "BLOCKED — fix in <subtask>".
        (tasks.json: "Any bugs found feed back into the implementing subtasks (T1-T3) for fixes".)
```

### Case → assertion mapping (the heart of the harness — implement each as one runCase)

Use `path.resolve` on the temp dir for all `abs` expectations. `inj` = result of `await mod.injectFiles(text, [], {cwd:FIX})`.

| # | Input text | Assertions (model-free) |
|---|---|---|
| **1** | `"Review #@a.ts"` | `inj.injected===1`; `inj.text.startsWith("Review #@a.ts")` (original preserved); `inj.text.includes("\n\n---\n\n")`; the appended block === `'<file name="'+A_TS+'">\n'+A_TS_CONTENT+'\n</file>'` (exact). |
| **2** | `"Summarize #@huge.log"` | `inj.injected===1`; `inj.text.includes("\n\n---\n\n")`; the block's content (between `>\n` and `\n</file>`) === `HUGE_LOG_CONTENT` BYTE-FOR-BYTE (proves NO truncation). Compute expected = `<file name="HUGE">\n${HUGE}\n</file>`. |
| **3** | `"Describe #@pic.png"` | `inj.injected===1`; `inj.images.length===1`; `img.type==="image"`; `img.mimeType==="image/png"`; `img.data.length>0`; `!img.data.startsWith("data:")`; `img.data===PNG.toString("base64")` (whole-image parity, fallback); `inj.text.includes('<file name="'+PIC+'">')`; the block === `'<file name="'+PIC+'"></file>'` (empty hints, resize→null). |
| **4** | `"Inspect #@data.bin"` | `inj.injected===1`; the block === `'<file name="'+BIN+'"><binary file \u2014 contents not injected; use the read tool if needed></file>'` (em dash U+2014); assert the block body is EXACTLY that fixed note (no decoded garbage bytes). |
| **5** | `"Fix #@nope.ts"` | `inj.injected===0`; `inj.text==="Fix #@nope.ts"` (verbatim); `inj.images===ORIGINAL_REF` (count===0 returns original array — merge contract). |
| **6** | `"List #@src/"` | `inj.injected===0` (directory → `!st.isFile()` → leave token); `inj.text==="List #@src/"`. |
| **7** | `"the foo#@bar thing"` | `inj.injected===0` (mid-word `#@` preceded by word char → regex no-match); `inj.text==="the foo#@bar thing"`. |
| **8** | `"# Heading and #1234"` | `inj.injected===0` (no `#@`); `inj.text==="# Heading and #1234"`. |
| **9** | `"Diff #@a.ts vs #@b.ts"` | `inj.injected===2`; `inj.text` contains BOTH blocks; block order is a.ts THEN b.ts (indexof a_ts < indexof b_ts). HANDLER: notify `m==="#@ injected 2 file(s)"`, `t==="info"`. |
| **10** | `"Read #@~/<homefile>"` | `inj.injected===1`; block path === `path.join(os.homedir(), "<homefile>")` (tilde expanded). Cleanup the home file in finally. |
| **11** | `"See #@a.ts."` | `inj.injected===1` (trailing `.` trimmed by cleanToken); block path === A_TS (resolved to a.ts, not a.ts.). |
| **12** | (handler, `source:"interactive"`) | Assert the input event fires for an interactive message: handler(mockPi) → `out=await cb({text:"Review #@a.ts", source:"interactive", images:[]}, ctxHasUI)` → `out.action==="transform"` (proves the hook path). **PLUS** print `ℹ INTEGRATION: pi -e ./file-injector.ts -p "Review #@a.ts"` with expected: the transformed prompt reaches the model with a.ts content; no `read` tool call. |
| **13** | `"Review #@a.ts"` (FORMAT parity) | Construct expected from the SAME a.ts content using the `processFileArguments` template: `'<file name="'+A_TS+'">\n'+A_TS_CONTENT+'\n</file>'`. Assert our block === expected (byte-identical — proves `#@` block format == `@file` block format). **PLUS** print `ℹ INTEGRATION: pi @a.ts "x"` to compare e2e. |
| **14** | `"Review @a.ts"` (bare @) | `inj.injected===0` (no `#@` substring); `inj.text==="Review @a.ts"` (byte-for-byte unchanged — @ non-interference). Also assert the handler returns `{action:"continue"}` (the `!text.includes("#@")` guard). |

**Edge cases (§10) — add as extra runCase rows:**
- `#@empty.txt` (0 bytes) → `inj.injected===1`; block === `'<file name="'+EMPTY+'">\n\n</file>'`.
- `(#@a.txt)` → token `a.txt)` trimmed to `a.txt` → `inj.injected===1`, block path === A_TXT.
- `#@file` inside a fenced code block (`` `code #@a.ts` ``) → STILL matched (documented limitation) → `inj.injected===1` (assert the known behavior; the README T5.S1 will document the workaround `# @`).
- read-error: `chmod 000` on a file (Linux/macOS, `process.getuid()!==0`) → `inj.injected===0`, token verbatim, NO throw. SKIP with a printed note if root.
- `source:"extension"` → handler returns `{action:"continue"}` (loop prevention), no notify.
- `streamingBehavior:"steer"` → handler returns `{action:"continue"}` (latency skip), no notify.
- `ctx.hasUI===false` (headless print/json) + an injecting prompt → handler returns `transform` BUT notify is NEVER called (`rec.notify===undefined`).

### Verified import mechanism (copy this verbatim — it is THE load-bearing snippet)

```javascript
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

// 1. Resolve the GLOBAL pi package root (it is NOT resolvable from the project cwd).
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";

// 2. Load jiti (nested in pi) by ABSOLUTE dynamic import, then give it the alias map Pi's own loader uses.
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai":           PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});

// 3. Import the REAL committed extension (resolve relative to THIS script so it's cwd-independent).
const TS  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "file-injector.ts");
const mod = await jiti.import(TS);
// mod.default          -> (pi)=>void factory
// mod.injectFiles      -> async (text, imagesIn, {cwd}) => {text, images, injected}
// mod.cleanToken / expandTildeAndResolve / extOf / isBinary / format*Block -> the pure helpers
```

### Mock pi/ctx + handler capture (copy verbatim)

```javascript
function makeMockCtx(cwd, { hasUI = true } = {}) {
  const rec = {};
  return {
    ctx: { cwd, hasUI, ui: { notify: (m, t) => { rec.notify = { m, t }; } } },
    rec,
  };
}
function captureHandler(mod) {
  const slot = {};
  const pi = { on: (_event, cb) => { slot.cb = cb; } };
  mod.default(pi);                 // registers the handler
  return slot;                     // call await slot.cb(event, ctx) => InputEventResult
}
```

### Fixed PNG fixture (tiny 1×1, 67 bytes — makes the image case deterministic)

```javascript
// A minimal valid 1×1 PNG. resizeImage() returns null on this deterministically → exercises the
// fallback path (data === raw base64, empty-hints block). Do NOT randomize — a random image may
// non-deterministically hit the resize branch and make case #3 flaky.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
```

### Integration Points

```yaml
NO production integration changes (validation-only task).
HARNESS-LOCAL:
  - resolves: "<npmRoot>/@earendil-works/pi-coding-agent" (global; read-only)
  - imports:  "./file-injector.ts" (the shipped extension; read-only this task)
  - creates:  temp dir via mkdtempSync(os.tmpdir()) + one file in os.homedir() (both cleaned in finally)
EXIT CONTRACT:
  - process.exit(0)  iff all model-free assertions pass
  - process.exit(1)  on any model-free failure (with a printed ✗ row + the failing assertion)
  - integration rows (#12, #13-e2e) NEVER affect the exit code
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# The harness is plain .mjs — no transpile, no linter configured. Validate it parses + runs:
node --check ./file-injector.test.mjs        # syntax check (exit 0 = parses)
# Expected: no output, exit 0. If errors, READ them — it is almost always a missing await or a typo.
```

### Level 2: Unit / Component (the harness IS the Level-2 gate)

```bash
# Run the acceptance matrix. THIS IS THE PRIMARY GATE.
node ./file-injector.test.mjs
# Expected output: a 14-row matrix (12 ✓ AUTO PASS, #12 ℹ INTEGRATION, #13 ✓ AUTO PASS for format +
#   ℹ INTEGRATION for e2e) + N edge/guard rows all ✓ + a summary "X passed, 0 failed". Exit 0.
# If exit 1: read the ✗ row, identify the owning subtask (T1.S2 parsing / T2.S1 formats / T3.S1
#   injectFiles / T3.S2 handler), record in validation_report.md, and STOP — do not edit the extension.
```

### Level 3: Integration (the 2 live-Pi cases — run manually, document in the report)

```bash
# Case #12 — initial -p message (extension loaded, no model needed if a print/echo mode exists; else a
#   short model run). The input event fires inside prompt() for the -p message too.
pi -e ./file-injector.ts -p "Review #@a.ts"
# Expected: the prompt the model receives ALREADY contains a.ts in a <file name="…"> block (the model
#   does NOT call the read tool). Confirm by observing the user message bubble / transcript.

# Case #13 — end-to-end format parity vs the built-in @file CLI expander.
pi @a.ts "x"          # built-in @file argv expansion (runs pre-prompt())
# Expected: emits a block `<file name="/abs/a.ts">\n<content>\n</file>` — byte-identical CONTENT to the
#   #@ block our harness already asserted in case #13 (format-level). Differences are ONLY: trailing
#   per-block "\n" (Pi raw-concats; we join under "---") and edge cases (Pi exits on missing; we don't).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Regression safety: mutate a fixture and confirm the harness reacts (proves it tests the REAL file,
#   not a stale copy). TEMPORARY edit — revert after.
#   e.g. append a line to a.ts, re-run, confirm case #1's exact-block assertion fails (content changed),
#   then `git checkout -- a.ts`-equivalent (the fixture is temp, so just re-run clean).
node ./file-injector.test.mjs        # after a deliberate fixture change → case #1 should ✗, proving liveness

# Determinism: run the harness 3× back-to-back — identical pass counts every time (no flakiness from
#   resizeImage, temp dirs, or home-dir races). The fixed tiny PNG is what makes #3 deterministic.
for i in 1 2 3; do node ./file-injector.test.mjs >/dev/null || echo "run $i FAILED"; done
# Expected: no "FAILED" lines (exit 0 all 3 runs).
```

## Final Validation Checklist

### Technical Validation

- [ ] `node --check ./file-injector.test.mjs` exits 0 (parses).
- [ ] `node ./file-injector.test.mjs` exits **0** with all model-free assertions green.
- [ ] Harness is cwd-independent (resolves `./file-injector.ts` + PIPKG by absolute path; no hardcoded
      `/home/dustin/...`).
- [ ] Harness imports the REAL `file-injector.ts` (sanity-asserts `typeof mod.default==="function"` and
      reacts to a fixture mutation — Level 4).
- [ ] No `npm install` needed (node builtins + nested jiti only); no new package.json/tsconfig.

### Feature Validation (the 14 §11 cases)

- [ ] Cases #1–#11, #14 → `✓ AUTO PASS` (12 automated).
- [ ] Case #13 format parity → `✓ AUTO PASS`; #13 e2e → `ℹ INTEGRATION` with the exact `pi @a.ts` cmd.
- [ ] Case #12 → handler returns `transform` for `source:"interactive"` (auto) + `ℹ INTEGRATION` `pi -p` cmd.
- [ ] Edge cases: empty file, parenthesized token, fenced-code-block match, chmod-000 (when not root),
      missing, directory — all asserted.
- [ ] 3 guards: `source==="extension"`→continue, `steer`→continue, no-`#@`→continue — all asserted.
- [ ] Headless path: `hasUI===false` → handler returns `transform` but notify is NEVER called.
- [ ] Merge contract: count===0 returns original `images` ref; count>0 with a user image preserves it at [0].

### Report & Documentation

- [ ] `validation_report.md` records date, node/pi versions, the 14-row matrix, summary counts, findings.
- [ ] Any ✗ row is attributed to its owning M1 subtask (NOT silently fixed here).
- [ ] The 2 integration commands + expected observations are in the report verbatim.

### Code Quality Validation

- [ ] Follows the project's standalone-`.mjs`-gate convention (P1M1 research); no new test framework.
- [ ] File placement: `file-injector.test.mjs` at repo root; report under `P1M2T4S1/`.
- [ ] Cleanup: temp dir + home-dir notes file removed in `finally` (no litter).
- [ ] Anti-patterns avoided: no hardcoded absolute maintainer paths; no random image fixtures; no
      counting integration rows against the exit code; no edits to `file-injector.ts`/PRD/tasks.json.

### Scope Discipline

- [ ] `file-injector.ts` UNCHANGED. `PRD.md` UNCHANGED. `tasks.json`/`prd_snapshot.md` UNCHANGED.
- [ ] No README.md created (that is P1.M2.T5.S1 — this task only feeds it findings).
- [ ] No size gate / config / truncation added anywhere (PRD §2 Non-Goals, §12.11, §13 — out of scope).

---

## Anti-Patterns to Avoid

- ❌ Don't inline a *reference copy* of the functions (the M1 gates did that from `/tmp`). Acceptance must
  import the REAL `file-injector.ts` via jiti — a reference copy can drift from the shipped artifact.
- ❌ Don't use a random/large image for case #3 — `resizeImage` is non-deterministic on real images. Use
  the fixed 67-byte 1×1 PNG so the fallback path (data === raw base64) is deterministic.
- ❌ Don't hardcode `/home/dustin/.local/lib/...`. Resolve via `npm root -g` + `path.resolve(import.meta.url)`.
- ❌ Don't count the #12/#13-integration rows against the exit code — that makes the gate non-hermetic
  (it would fail on machines without a model API key). Print them as `ℹ INTEGRATION`.
- ❌ Don't "fix" a failing assertion by editing `file-injector.ts`. REPORT it; the fix belongs to M1.
- ❌ Don't edit `file-injector.ts`, `PRD.md`, `tasks.json`, or `prd_snapshot.md`.
- ❌ Don't add a 50 MB fixture to assert "no truncation". The contract is "entire file" — a 2 MB fixture
  with exact byte-equality proves it without bloating the repo or slowing the run.
- ❌ Don't introduce vitest/mocha/node:test. The repo has no test runner configured; the bare `assert()`
  helper matches the project's zero-dependency ethos and the established `.mjs`-gate pattern.

---

## Confidence Score

**9/10.** Every load-bearing unknown has been resolved by a live probe in this research session:
- ✅ jiti import + alias config (probe4.mjs): WORKS — returns default + 8 named exports, runs injectFiles
  + handler on real temp files.
- ✅ `npm root -g` resolver: WORKS — locates the global pi package + dist/index.js + nested jiti + pi-ai compat.
- ✅ mock pi/ctx handler capture: WORKS — transform + notify + continue-guard all observed.
- ✅ tiny-image determinism + whole-image parity (probe_img2.mjs): WORKS — data === raw base64, empty block.
- ✅ empty-file edge case: WORKS — `<file name="ABS">\n\n</file>`.
- ✅ processFileArguments parity templates: read from `dist/cli/file-processor.js:24-64`.
- The only non-automatable residue (#12 `-p`, #13 e2e) is explicitly scoped as documented-integration.
- −1 only for the inherent "a future pi version could move jiti/the alias map" risk (mitigated by
  `npm root -g` resolution + the sanity asserts that fail loudly if the layout changes).
