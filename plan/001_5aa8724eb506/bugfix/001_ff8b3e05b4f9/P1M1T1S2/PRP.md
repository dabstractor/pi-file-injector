---
name: "P1.M1.T1.S2 — Remove sentinel mechanism entirely (Issues 2 + 6)"
prd_ref: "Bug-fix PRD §Issue 2 (sentinel-in-prompt false negative), §Issue 6 (assembly format deviation), §Overview/§Testing Summary"
target_file: "./sharp-at-file.ts"  # EDIT IN PLACE
change_type: pure-deletion (3 surgical edits; no additions, no new files)
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "P1.M1.T1.S1 (per-token dedup in injectFiles) — CONFIRMED ALREADY IN FILE at lines 147-152"
fixes: "Issue 2 (sentinel-in-prompt false negative); Issue 6 (assembly format deviation). Issue 1 stays fixed via S1's dedup."
---

# PRP — P1.M1.T1.S2: Remove Sentinel Mechanism Entirely

## Goal

**Feature Goal**: Delete the entire F1 sentinel mechanism from `./sharp-at-file.ts` — the two
module-level constants (`INJECT_SENTINEL`, `SENTINEL_RE`), the handler guard
(`if (SENTINEL_RE.test(event.text)) return { action: "continue" }`), the sentinel insertion in the
assembly template, and the F1 JSDoc/comment blocks above each. After removal, the file references
neither symbol anywhere, the assembly matches PRD §6.2 exactly, and re-injection prevention is handled
solely by S1's cooperation-independent per-token dedup.

**Deliverable**: Three surgical in-place edits to `./sharp-at-file.ts` (one block-deletion of the
constants, one line-modification of the assembly, one block-deletion of the handler guard + its
comment). No new files. **No new code is written** — this is a pure subtraction.

**Success Definition**:
- [ ] `grep -cE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts` → **0** (was 4).
- [ ] The assembly line reads exactly `` const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`; ``
      (PRD §6.2 format — no `${INJECT_SENTINEL}`).
- [ ] The handler keeps exactly THREE guards: `source==='extension'`, `streamingBehavior==='steer'`,
      `!event.text?.includes("#@")`. The sentinel guard is gone.
- [ ] The existing model-free harness reports **28 passed, 0 failed** (`node ./sharp-at-file.test.mjs`)
      — no regression. (Verified by static analysis: the F1 test asserts behavior, not the sentinel
      string; per-token dedup now satisfies that behavior.)
- [ ] The throwaway verification script (below) shows: (a) Issue 2 fixed — a prompt containing the
      literal sentinel string PLUS a real `#@a.ts` now injects the file; (b) Issue 6 fixed — no
      sentinel string in injected output; (c) dedup intact — re-feeding first-pass output yields
      `injected===0`.

> **Scope boundary (read carefully):** This subtask removes ONLY the F1 sentinel. It does **NOT**:
> (a) add/modify the per-token dedup line — that is **S1** (already done, lines 147-152); (b) change
> `FILE_INJECT_RE` for Unicode — that is **M1.T2.S1** (Issue 5); (c) edit `sharp-at-file.test.mjs`
> (even the F1 test's now-misleading name) — that is **M2.T1.S1**; (d) touch the F3/F5/F4 code or
> comments (F3/F5 are documentation-only; M3 documents them); (e) edit README.md — that is **M3**.
> Only F1 (sentinel) is removed.

## User Persona

**Target User**: End users of the `#@file` extension, in two concrete scenarios the sentinel broke:
1. The **copy/paste workflow** (Issue 2): a user re-sends a prior message (which, after injection,
   contained the sentinel comment) and adds a new `#@file` — today that file is silently NOT injected.
2. Any user who wants the injected output to match the PRD's exact format (Issue 6).

**Use Case**: "I pasted my previous prompt that had a `<!--#@file-injected-->` comment in it, added a
new `#@secret.txt`, and sent — the model never saw the new file." After this fix, the new file injects
normally.

**Pain Points Addressed**: Silent total failure of the core feature in a plausible workflow (Issue 2),
and a small but real format/token deviation from the spec (Issue 6).

## Why

- **Issue 2 is Major** — the sentinel guard tests the RAW user prompt before injection, so any prompt
  that happens to contain `<!--#@file-injected-->` causes the handler to `continue` immediately,
  silently dropping ALL `#@` tokens. This is the opposite of PRD §1/§2 ("unconditional injection") and
  §12.5 ("a prompt must never be lost").
- **The sentinel is now fully redundant.** Its only job was re-injection prevention when multiple
  copies co-load (Issue 1). S1's per-token dedup does that job *better* — it is cooperation-independent
  (catches non-sentinel copies too) and structural (checks for the `<file name="<abs>">` block, not a
  secret string). Keeping the sentinel after the dedup exists is dead, buggy code.
- **Issue 6 is Minor** but real: the assembly deviates from PRD §6.2 by inserting the sentinel. LLMs
  process all tokens including HTML comments, so it adds tokens to every injection. Removing the
  sentinel restores byte-exact PRD §6.2 format.

## What

Three edits to `./sharp-at-file.ts`. All are deletions or a one-token modification; **no code is
added**. The three remaining handler guards, the per-token dedup line, the block helpers, the regex,
and all other code are untouched.

### Success Criteria

- [ ] Zero references to `INJECT_SENTINEL` or `SENTINEL_RE` remain.
- [ ] Assembly is `` `${text}\n\n---\n\n${blocks.join("\n\n")}` `` (PRD §6.2).
- [ ] Handler has exactly 3 guards (sentinel guard removed).
- [ ] Harness 28/28; verification script green; jiti load still OK.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact 3 old→new text edits (anchors unique in the
> file), the verified current line numbers (post-S1), a static proof that the harness's F1 test stays
> green (it asserts behavior, not the sentinel string), the root-cause reasoning for both issues, and
> a reproducible model-free verification script. No model/API key needed.

### Documentation & References

```yaml
# MUST READ — sibling PRP (the dedup this task depends on; it is the CONTRACT that makes deletion safe)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M1T1S1/PRP.md
  why: "Defines the per-token dedup line `if (text.includes('<file name=\"' + abs + '\">')) continue;`
        inside the injectFiles for-loop, placed AFTER `const abs = expandTildeAndResolve(...)` and
        BEFORE `let st;`. CONFIRMED already in the file at lines 147-152. S2 removes the sentinel
        ONLY because this dedup is live."
  critical: "Do NOT touch the dedup line. It is the replacement for the sentinel; without it the
        sentinel removal would regress Issue 1 (duplicate injection)."

# MUST READ — exact modification points (Steps 2-4 are this task)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/code_changes_analysis.md
  why: "§'Steps 2-4' specify exactly what to delete: Step 2 = constants (lines ~21-27), Step 3 =
        handler guard (line ~147), Step 4 = assembly line (line ~139). NOTE the line numbers there
        are PRE-S1 estimates; the ACTUAL current line numbers are 18-26 / 248 / 211 — use exact-text
        anchors (below), not line numbers."
  critical: "Step 1 (dedup) is S1 — already done. This task = Steps 2+3+4 ONLY."

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'The Three Interrelated Sentinel Bugs' explains Issues 1/2/6 and the unified fix. §'Test
        Harness Gaps' documents why the F1 test missed Issue 1 (and why it still passes after removal)."
  section: "Issue 2, Issue 6, Unified Fix, Test Harness Gaps"

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "The bug-fix PRD — §Issue 2 and §Issue 6 are this task's acceptance criteria."
  section: "§Issue 2, §Issue 6, §Overview"

# The file being EDITED
- file: ./sharp-at-file.ts
  why: "Contains the 4 sentinel references to remove: consts at lines 25-26 (with the F1 JSDoc at
        ~18-24), assembly at line 211, handler guard at line 248 (with its 4-line F1 comment at
        ~244-247). Read the injectFiles function and the factory before editing."
  pattern: "Match the surrounding code's structure. The edits are pure deletions / a one-token change;
        do NOT reformat adjacent lines."
  gotcha: "Use EXACT-TEXT anchors (the oldText strings in the Implementation Tasks), not line numbers —
        S1's insertion shifted the file and further edits will shift it again. Each oldText below is
        unique in the file."

# The test harness (run for regression; DO NOT modify it)
- file: ./sharp-at-file.test.mjs
  why: "28-case model-free gate. The F1 case (search 'F1 — no re-injection') is the only test touching
        sentinel behavior. It asserts `out.action === 'continue'`, `rec.notify === undefined`, and
        `aCount === 1` on the FIRST pass — all BEHAVIORAL, none check the sentinel string. Per-token
        dedup satisfies these after removal → harness stays 28/28."
  pattern: "imports the REAL ./sharp-at-file.ts via jiti; run `node ./sharp-at-file.test.mjs`."
  gotcha: "The F1 test's NAME/comment will be cosmetically misleading post-removal ('sentinel already
        present') but its assertions still hold. Renaming/adding co-load + sentinel-in-prompt cases is
        M2.T1.S1's scope — do NOT touch the harness here."
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── PRD.md                       # original feature PRD (not the bug-fix PRD)
├── README.md                    # extension docs (M3 updates, NOT this task)
├── sharp-at-file.ts             # ← THE FILE BEING EDITED (249 lines). 4 sentinel refs to remove.
│                                #     S1 dedup already present (lines 147-152).
├── sharp-at-file.test.mjs       # 28-case model-free harness — run, do NOT edit
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/{system_context.md, code_changes_analysis.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}        # the dedup contract (read it)
    └── P1M1T1S2/
        ├── research/research_notes.md      # THIS TASK's research (detailed; read it)
        └── PRP.md                          # ← THIS FILE
```

### Desired Codebase tree with files to be changed

```bash
.
└── sharp-at-file.ts             # MODIFIED — 3 surgical deletions/modification. ~16 lines removed.
                                 #   - constants block (F1 JSDoc + INJECT_SENTINEL + SENTINEL_RE) gone
                                 #   - assembly: ${INJECT_SENTINEL}\n\n removed → PRD §6.2 exact
                                 #   - handler: sentinel guard + F1 comment gone (3 guards remain)
# No new files. No harness changes. No README changes.
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — S1's per-token dedup MUST be in place before this edit. VERIFY before deleting:
//   grep -n "text.includes('<file name=\"' + abs + '\">')" sharp-at-file.ts  → must print one line.
// If that line is absent, STOP — removing the sentinel would regress Issue 1 (duplicate injection).
// (It is present at line 152 as of this writing; S1 is implemented.)

// GOTCHA — use EXACT-TEXT anchors, not line numbers. S1 already shifted the file (~+5 lines). The
// work item's "~21-27 / ~139 / ~147" estimates are PRE-S1; the actual current numbers are
// ~18-26 / 211 / 248. The three oldText strings in "Implementation Tasks" are each UNIQUE in the file.

// GOTCHA — the handler has THREE other guards that must NOT be removed: `source==='extension'`,
// `streamingBehavior==='steer'`, `!event.text?.includes("#@")`. Only the FOURTH (sentinel) goes.

// GOTCHA — the F1 test in sharp-at-file.test.mjs will still PASS (returns continue via per-token
// dedup). Do NOT 'fix' it by editing the harness — that's M2.T1.S1. Its name is cosmetically stale
// but its assertions hold. Leave it.

// OK — pure deletion. jiti transpile still succeeds (fewer symbols, not more). The default export
// (the factory) is unchanged in shape; Pi's "default export must be a function" check still passes.

// OK — `formatEmptyImageBlock`, `hasValidImageMagic`, `isBinary`, `cleanToken`, etc. all reference
// neither INJECT_SENTINEL nor SENTINEL_RE. Removing the sentinel touches ONLY the 4 references.
```

## Implementation Blueprint

### Data models and structure

None. No data model changes. Pure deletion of two constants and one branch; the assembly template
loses one interpolated token. `injectFiles`'s signature/return type and the factory's signature are
unchanged.

### Implementation Tasks (ordered by dependencies)

```yaml
PRE-FLIGHT (do first):
  - VERIFY S1's dedup is present: `grep -n "text.includes('<file name" sharp-at-file.ts` → one line.
    If absent, STOP (removing the sentinel would regress Issue 1).
  - RECORD baseline: `grep -cE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts` → must print 4.

Task 1: EDIT ./sharp-at-file.ts — Edit A: delete the sentinel constants block
  - OBJECTIVE: Remove the F1 JSDoc + INJECT_SENTINEL + SENTINEL_RE (currently lines ~18-26).
  - FIND (exact oldText — UNIQUE in the file):
        const TRAILING_PUNCT = ".,;:!?\")]}>'";

        /** F1 — hidden sentinel stamped on the injected section. A SECOND copy of this extension
         *  (e.g. loaded globally AND project-locally, or two -e copies) re-processes the same
         *  message; the sentinel lets it detect we already injected and skip, avoiding duplicate
         *  blocks. An HTML comment is invisible to the model and survives unchanged through the
         *  transform pipeline. It is emitted ONLY on the appended section — never inside the
         *  per-file <file> block — so it does NOT affect the byte-identical block parity (Phase 5). */
        const INJECT_SENTINEL = "<!--#@file-injected-->";
        const SENTINEL_RE = /<!--#@file-injected-->/;

        /** F3 — magic-number sniff.
  - REPLACE WITH:
        const TRAILING_PUNCT = ".,;:!?\")]}>'";

        /** F3 — magic-number sniff.
  - EFFECT: TRAILING_PUNCT now directly precedes the F3 JSDoc (one blank line between). The two
    sentinel consts and their 7-line JSDoc are gone.

Task 2: EDIT ./sharp-at-file.ts — Edit B: fix the assembly line (Issue 6)
  - OBJECTIVE: Drop ${INJECT_SENTINEL}\n\n from the finalText template; remove the F1 comment above.
  - FIND (exact oldText — UNIQUE; the `const finalText = ` string appears exactly once):
        // F1 — stamp a hidden sentinel on the appended section so a SECOND copy of this extension
        // (loaded from a distinct path) can detect we already injected and skip, avoiding duplicate
        // blocks. Placed AFTER the original prompt + separator, OUTSIDE every <file> block, so it does
        // not touch the byte-identical block content (Phase 5 parity).
        const finalText = `${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}`; // append; original text untouched (PRD §6.2)
  - REPLACE WITH:
        const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`; // append; original text untouched (PRD §6.2)
  - EFFECT: assembly is now EXACT PRD §6.2: <text>\n\n---\n\n<block1>\n\n<block2>. No sentinel token.

Task 3: EDIT ./sharp-at-file.ts — Edit C: delete the handler sentinel guard (Issue 2)
  - OBJECTIVE: Remove the 4-line F1 comment + the SENTINEL_RE guard from the input handler.
  - FIND (exact oldText — UNIQUE; sits after the !includes("#@") guard, before the injectFiles call):
        if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)
        // F1 — if THIS message was already transformed by another copy of this extension (loaded
        // from a distinct path — e.g. global + project-local, or two -e copies), our sentinel is
        // present. Skip to avoid re-injecting the same files (duplicate blocks / token waste).
        if (SENTINEL_RE.test(event.text)) return { action: "continue" };

        const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
  - REPLACE WITH:
        if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

        const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
  - EFFECT: handler now has exactly 3 guards (source/streaming/!includes). The sentinel guard that
    caused Issue 2 (bailing on a raw prompt containing the sentinel string) is gone.

POST-FLIGHT:
  - `grep -cE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts` → must print 0 (was 4).
  - Run the Validation Loop gates below.

DO NOT (out of scope):
  * touch the per-token dedup line (S1), the FILE_INJECT_RE regex (M1.T2.S1), the F3/F5/F4 code or
    comments, the three remaining handler guards, any block helper, cleanToken/expandTildeAndResolve/
    extOf/isBinary, sharp-at-file.test.mjs (M2.T1.S1), or README.md (M3).
  * reformat, reorder, or "tidy" adjacent lines — only the three exact edits above.
```

### Implementation Patterns & Key Details

```typescript
// The handler AFTER all three edits (the relevant region):
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };        // GUARD 1 (kept)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // GUARD 2 (kept)
    if (!event.text?.includes("#@")) return { action: "continue" };         // GUARD 3 (kept)
    // (sentinel guard REMOVED — re-injection now handled by per-token dedup in injectFiles)

    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" };        // nothing injected → preserve prompt
    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info");
    return { action: "transform" as const, text, images };
  });
}

// The assembly AFTER Edit B (PRD §6.2 exact):
const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`;

// WHY Issue 2 is fixed: with the sentinel guard gone, a prompt like
//   "ctx: <!--#@file-injected-->\nReview #@a.ts"
// flows to injectFiles. matchAll finds `#@a.ts`; token=a.ts; abs=<cwd>/a.ts; per-token dedup checks
// text for '<file name="<abs>/a.ts">' — NOT present (only the sentinel string + the token are) → does
// NOT skip → file is read + injected. Was: handler bailed at the sentinel guard, injecting nothing.

// WHY Issue 6 is fixed: no `${INJECT_SENTINEL}` in the template → output is `<text>\n\n---\n\n<block>`.

// WHY Issue 1 stays fixed: when a co-loaded copy injects first (no sentinel now), its <file> blocks
// are appended to event.text; THIS copy's injectFiles re-finds the #@token but the per-token dedup
// sees the existing '<file name="<abs>">' block → skip → count 0 → continue. No double injection.
```

### Integration Points

```yaml
NO NEW INTEGRATION POINTS:
  - "Internal deletion. No new imports, no new constants, no config, no API surface, no docs."
  - "User-visible: (a) prompts containing the sentinel comment now inject files normally; (b) injected
    output no longer contains the HTML comment (exact PRD §6.2 format)."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — it is a single-file Pi extension
> validated by a **model-free Node ESM harness** (`sharp-at-file.test.mjs`, 28 cases, `node`). The
> Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. The gates below
> are project-specific and have been **verified by static analysis on this machine** (the harness F1
> test asserts behavior, not the sentinel string; per-token dedup satisfies that behavior post-removal).

### Level 1: Edit Verification (Immediate Feedback)

```bash
# 1a. Zero sentinel references remain.
grep -cE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts
# Expected: 0   (was 4). If >0 → a reference was missed; re-read the file and delete it.

# 1b. No stray sentinel STRING left in the assembly or anywhere.
grep -nF '<!--#@file-injected-->' sharp-at-file.ts
# Expected: no matches.

# 1c. The assembly line is now exact PRD §6.2 (no INJECT_SENTINEL interpolation).
grep -nF 'const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`' sharp-at-file.ts
# (grep -F treats backticks literally; the line must read exactly as shown — no ${INJECT_SENTINEL}.)
# Expected: exactly one matching line.

# 1d. The handler has exactly 3 guards (sentinel guard removed). Count the handler's "return { action:
#     \"continue\" }" lines — there should be 4 total (3 guards + the !injected fallthrough).
awk '/export default function/{f=1} f&&/return \{ action: "continue" \}/{c++} END{print c}' sharp-at-file.ts
# Expected: 4   (source guard + streaming guard + !includes("#@") guard + the `if (!injected)` line).
#   (The sentinel guard was a 5th; removing it brings the count from 5 to 4.)

# 1e. S1's per-token dedup is INTACT (this task must NOT touch it).
grep -n "text.includes('<file name=\"' + abs + '\">')" sharp-at-file.ts
# Expected: exactly one matching line (inside the injectFiles for-loop).

# Expected: 1a prints 0; 1b prints nothing; 1c/1e print one line each; 1d prints 4.
```

### Level 2: Regression — Existing Harness (Component Validation)

```bash
# The project's hermetic model-free gate. MUST remain 28 passed / 0 failed.
# The F1 case still passes: it asserts out.action==='continue' + no notify + 1 block on the FIRST
# pass — all satisfied by per-token dedup post-removal (see research_notes.md §4 for the trace).
node ./sharp-at-file.test.mjs
# Expected: "Result: 28 passed, 0 failed." and exit code 0.
# If the F1 case fails: the per-token dedup line was accidentally removed/altered — restore it
# (S1's contract) and re-run. Do NOT edit the harness to make it pass.
```

### Level 3: Behavior Verification (Issue 2 + Issue 6 fixes — NON-INTERACTIVE, NO MODEL)

Run this throwaway script (do NOT add it to the harness — harness changes are M2.T1.S1's scope). It
proves: (a) Issue 2 — a prompt with the sentinel string AND a real #@file now injects; (b) Issue 6 —
no sentinel in output; (c) dedup intact — re-feeding first-pass output yields injected===0. Uses the
SAME jiti+alias import pattern the harness uses.

```bash
cat > /tmp/verify_sentinel_removed.mjs <<'EOF'
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";

const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
  },
});
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const mod = await jiti.import(path.resolve(process.cwd(), "sharp-at-file.ts"));

const TMP = fsSync.mkdtempSync(path.join(os.tmpdir(), "saf-rm-"));
await fs.writeFile(path.join(TMP, "a.ts"), "canary\n");
const A_TS = path.join(TMP, "a.ts");
const FIX = { cwd: TMP };
const SENTINEL = "<!--#@file-injected-->";

let pass=0, fail=0;
const ok=(name,cond,detail="")=>{console.log((cond?"PASS":"FAIL")+": "+name+(cond?"":"  "+detail));cond?pass++:fail++;};

// (c) dedup still works (Issue 1 not regressed) — no sentinel needed now
const first = await mod.injectFiles("Review #@a.ts", [], FIX);
ok("dedup intact: first pass injects (injected===1)", first.injected===1, "got "+first.injected);
ok("Issue 6: first.text has NO sentinel string", !first.text.includes(SENTINEL));
ok("Issue 6: first.text has the --- separator", first.text.includes("\n\n---\n\n"));
ok("Issue 6: first.text has exactly <text>\\n\\n---\\n\\n<block> (block immediately after ---)",
   first.text === "Review #@a.ts\n\n---\n\n" + '<file name="' + A_TS + '">\ncanary\n\n</file>',
   "got: " + JSON.stringify(first.text));
const second = await mod.injectFiles(first.text, [], FIX);
ok("dedup intact: re-feed first-pass text → injected===0", second.injected===0, "got "+second.injected);

// (a) Issue 2 fix — sentinel string in the PROMPT no longer blocks injection (handler-level)
const slot = {};
const pi = { on: (_e, cb) => { slot.cb = cb; } };
mod.default(pi);
const ctx = { cwd: TMP, hasUI: true, ui: { notify: () => {} } };
const promptWithSentinel = "ctx: " + SENTINEL + "\nAlso review: #@a.ts";
const out = await slot.cb({ text: promptWithSentinel, source: "interactive", images: [] }, ctx);
ok("Issue 2: handler returns transform (was continue before fix)", out.action === "transform", "got "+out.action);
ok("Issue 2: the #@a.ts file IS injected despite sentinel in prompt",
   out && out.text && out.text.includes('<file name="' + A_TS + '">'));

fsSync.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
EOF
node /tmp/verify_sentinel_removed.mjs
# Expected: all 7 checks PASS; prints "<n> passed, 0 failed"; exit 0.
# Before this task: the Issue-2 handler check returns action 'continue' (sentinel guard fired) → FAIL.
rm -f /tmp/verify_sentinel_removed.mjs
```

### Level 4: Live Pi Reproduction (Integration — OPTIONAL, needs a model + repo copy only)

Only if a provider/API key is configured. This is the exact Issue 2 repro from the Bug-fix PRD. The
fix is already proven by Level 3; this confirms end-to-end with a real model.

```bash
mkdir -p /tmp/saf-e2e && printf 'The canary is MAROON-PELICAN-4297 once.\n' > /tmp/saf-e2e/secret.txt
# Repo copy ONLY (avoid the stale global copy for a clean Issue-2 signal):
pi --model "deepseek/deepseek-chat" --no-tools -ne -e ./sharp-at-file.ts -p \
  'Here is an HTML comment for context: <!--#@file-injected-->
   Also please review: #@/tmp/saf-e2e/secret.txt
   How many times does MAROON-PELICAN-4297 appear? Reply only: CANARY=<number>'
# Before fix: CANARY=0 (sentinel guard dropped the #@secret.txt). AFTER this fix: CANARY=1.
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: `grep -cE "INJECT_SENTINEL|SENTINEL_RE"` → 0; no `<!--#@file-injected-->` string;
      assembly line matches PRD §6.2; handler has 4 `continue` returns (3 guards + !injected);
      per-token dedup line still present.
- [ ] Level 2: `node ./sharp-at-file.test.mjs` → **28 passed, 0 failed**, exit 0.
- [ ] Level 3: `/tmp/verify_sentinel_removed.mjs` → all checks PASS, exit 0.
- [ ] Level 4 (optional): live Issue-2 repro shows `CANARY=1` (was `0`).

### Feature Validation
- [ ] Issue 2 fixed: a prompt containing the sentinel string PLUS a valid `#@file` injects the file
      (handler returns `transform`, block present).
- [ ] Issue 6 fixed: `injectFiles` output contains no sentinel; assembly is `<text>\n\n---\n\n<blocks>`.
- [ ] Issue 1 NOT regressed: re-feeding first-pass output through `injectFiles` yields `injected===0`
      (per-token dedup handles it without the sentinel).
- [ ] The three remaining handler guards (`extension`/`steer`/`!includes("#@")`) still fire correctly
      (covered by harness cases G1/G2/G3).

### Code Quality Validation
- [ ] Only the three exact edits (A: constants block, B: assembly line, C: handler guard) were made.
- [ ] No code added; no adjacent lines reformatted/reordered.
- [ ] Per-token dedup line, regex, F3/F5/F4 code+comments, block helpers, the three other guards — all
      untouched.
- [ ] Test harness (`sharp-at-file.test.mjs`) and README — untouched.
- [ ] `grep -cE "INJECT_SENTINEL|SENTINEL_RE"` = 0.

### Documentation & Deployment
- [ ] No new env vars / config / API surface (pure internal deletion).
- [ ] The sentinel's JSDoc/comment blocks are removed too (no dangling docs referencing deleted code).
- [ ] README still mentions "sentinel"? → leave for M3 to reconcile (NOT this task's file).

---

## Anti-Patterns to Avoid

- ❌ Don't remove the sentinel **before verifying S1's per-token dedup is present** — without it,
  Issue 1 (duplicate injection) regresses. (Run the PRE-FLIGHT grep first.)
- ❌ Don't use line numbers as anchors — S1 shifted the file and each edit shifts it further. Use the
  exact `oldText` strings in the Implementation Tasks (each is unique in the file).
- ❌ Don't remove any of the three OTHER handler guards (`extension`/`steer`/`!includes("#@")`) — only
  the sentinel guard goes. They have independent, load-bearing purposes (loop prevention / latency /
  cheap pre-check).
- ❌ Don't edit `sharp-at-file.test.mjs` to "fix" the F1 test — it still passes (it asserts behavior,
  satisfied by per-token dedup). Renaming it and adding co-load/sentinel-in-prompt cases is M2.T1.S1.
- ❌ Don't touch the per-token dedup line (S1), the `FILE_INJECT_RE` regex (M1.T2.S1), or the
  F3/F5/F4 code/comments (M3 documents them).
- ❌ Don't "tidy" the file while you're in there — reordering or reformatting adjacent lines risks
  colliding with sibling tasks and obscures the diff. Make exactly the three specified edits.
- ❌ Don't leave the F1 JSDoc/comment blocks behind when deleting the constants/guard — they'd dangle
  and reference deleted symbols. Each edit's `oldText` includes the comment block; the `newText` omits it.
- ❌ Don't add a comment like "// sentinel removed" in place of the deleted code — the diff should be a
  clean subtraction; the commit history (and this PRP) document the rationale.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a pure-deletion task with three exactly-specified text edits at unique anchors,
verified current line numbers, and a static proof that the only sentinel-touching test (harness F1)
asserts behavior (not the sentinel string) — behavior that S1's per-token dedup (confirmed already in
the file at lines 147-152) now satisfies. The dependency (S1) is satisfied; the validation gates are
fully non-interactive (no model/API key). The residual 0.5 is for a possible transcription slip in an
`oldText` anchor (e.g., a trailing-space mismatch) — fully caught by Level 1 (`grep -c` must be 0) and
Level 2 (harness 28/28). If the per-token dedup line were somehow absent, the PRE-FLIGHT gate halts
the task before any deletion — guarding against the one regression risk (Issue 1).
