---
name: "P1.M2.T1.S1 (Bugfix) — Unify handler notify wording to PRD §5.5 (N whole / N whole, M paged) + update the 4 pinning test cases"
prd_ref: "Bug-fix PRD §Issue 3 (notify wording diverges from PRD §5.5 for all-whole prompts), §Overview, §Testing Summary"
target_files: "./file-injector.ts (1 edit: handler msg) + ./file-injector.test.mjs (8 edits: 5 assertion strings + F4 name/messages + §5.5 section comment + PN1 name/comment/message)"
change_type: surgical wording unify (handler ternary → single template) + mechanical `file(s)`→`whole` across 4 test cases. Case count UNCHANGED (stays 49).
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "none code-wise — the handler `msg` is self-contained. Baseline harness is 49/0 (P1.M1.T1.S1 + P1.M1.T1.S2 landed)."
fixes: "Issue 3 — all-whole prompts now read '#@ injected N whole' (was 'N file'/'N files'), matching PRD §5.5."
parallel_with: "P1.M1.T1.S2 (Issue 2 failed-token strip) — DISJOINT regions (S2 edits injectFiles + F2/FS cases; THIS task edits the handler msg + Cases 9/12/F4/PN1). No merge conflict."
---

# PRP — P1.M2.T1.S1 (Bugfix): Unified `whole`/`paged` notify wording (Issue 3)

## Goal

**Feature Goal**: Fix Issue 3 — the handler's notify message uses a **branched ternary** that emits
`N file`/`N files` when `paged===0`, diverging from PRD §5.5's example `#@ injected N whole`. Replace
the ternary with a **single unified expression**: always `#@ injected N whole`, appending `, M paged`
only when paging. Then update the **4 test cases (5 assertions)** that pin the old `file(s)` wording to
`whole`, and refresh their now-stale name/comment text so the harness is internally consistent.

**Deliverable**: 9 surgical exact-text edits across 2 files (1 in `file-injector.ts`, 8 in
`file-injector.test.mjs`), all given verbatim below. **No new files. Case count unchanged (49).**
The notify guard (`if (ctx.hasUI) ctx.ui.notify(msg, "info")`) and the
`return { action: "transform" as const, text, images }` are UNCHANGED (item §3 contract).

**Success Definition**:
- [ ] Handler `msg` is a single template: `` `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}` ``.
      `const whole = injected - paged;` is preserved (still computed and used).
- [ ] All 5 old assertions updated: Case 9 `2 whole`, Case 12 `1 whole`, F4 `1 whole` + `2 whole`,
      PN1 `2 whole`.
- [ ] PN1 name/comment refreshed ('existing plural style preserved' → 'unified whole style'); F4
      name/messages + the §5.5 section comment refreshed to remove stale `file(s)` references.
- [ ] PN2 (`1 whole, 1 paged`), PN3 (`0 whole, 1 paged`), PN4 (headless) UNCHANGED.
- [ ] `node ./file-injector.test.mjs` → **`Result: 49 passed, 0 failed.`**, exit 0.
- [ ] `grep -nE '#@ injected [0-9]+ (file|files)' file-injector.ts file-injector.test.mjs` → **no output**
      (zero old-wording occurrences remain).

> **Scope boundary (read carefully):** This task edits ONLY the handler `msg` (+ its 2 comments) and
> the 4 notify test cases' wording. It does **NOT**: (a) touch `injectFiles` (Issue 1 dedup / Issue 2
> strip — S1 done, S2 parallel on disjoint regions); (b) touch F2/FS1/FS2/FS3 (P1.M1.T1.S2's test
> surface); (c) change the paged directive `offset:0` string (Issue 4 — P1.M2.T2.S1); (d) touch
> PN2/PN3/PN4 (already correct `whole`/`paged` form); (e) edit README (the notify string is not quoted
> there; P1.M3 owns the final doc sweep); (f) change the notify guard, the return, the budget logic,
> or any format helper.

## User Persona

**Target User**: End users (and the PRD's stated UX) who see the `#@ injected N …` toast/notify. PRD
§5.5 specifies the `whole`/`paged` vocabulary because the extension has TWO delivery modes (inline
whole-file vs. paged read-tool handoff); the all-whole notify should use the same `whole` noun for
consistency with the paged case.

**Use Case**: User types `Review #@a.ts` → toast reads `#@ injected 1 whole` (today: `1 file`). User
types a huge file under a tight budget → `#@ injected 0 whole, 1 paged` (already correct). Both now
share the unified `whole` noun.

**Pain Points Addressed**: The all-whole notify diverged from the PRD example and was inconsistent with
the paged notify's `whole` noun. Low-impact wording fix, but it's a literal PRD §5.5 deviation.

## Why

- **PRD §5.5 conformance.** The PRD gives two notify examples — `#@ injected N whole` and
  `#@ injected N whole, M paged`. The `paged===0` branch emitting `N file(s)` is the lone deviation.
- **One-line, zero-risk unify.** The `paged>0` branch already uses the correct `whole`/`paged` form;
  the fix is to reuse that wording for `paged===0` via a single template with an optional paged suffix.
- **Tests pin the old wording** (5 assertions across 4 cases), so the TDD order is: update the
  assertions (they fail against the unchanged handler), then apply the handler fix (they go green).
- **Disjoint from the parallel sibling.** P1.M1.T1.S2 edits `injectFiles` + F2/FS cases; this task
  edits the handler `msg` + Cases 9/12/F4/PN1. No region overlaps → no merge conflict.

## What

9 exact-text edits (verbatim in `Implementation Blueprint → Exact source to write`):
- **Edit 0** (`file-injector.ts`): handler comment + `msg` ternary → single unified template.
- **Edits 1–8** (`file-injector.test.mjs`): Case 9 (L329), Case 12 (L361), F4 name (L704) + F4 assert1
  (L709) + F4 assert2 (L713), §5.5 section comment (L861), PN1 name (L864) + PN1 comment/assert (L865–872).

### Success Criteria
- [ ] Handler `msg` unified; `whole`/`paged`/guard/return intact.
- [ ] 5 old assertions → `whole`; PN1 name/comment refreshed; F4 name/messages + section comment refreshed.
- [ ] PN2/PN3/PN4 untouched; harness 49/49; zero old `file(s)` notify strings remain.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships every edit as a unique exact-text `oldText`/`newText` pair
> (all anchors grep-verified unique), the full 9-edit set has been **applied to a temp copy and run →
> 49/49 green** (research §4), and the implicit-TDD ordering is spelled out. No model/API key needed.

### Documentation & References
```yaml
# MUST READ — this task's verified research (9-edit set pre-run green)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M2T1S1/research/research_notes.md
  why: "§1 the unified msg expression; §2 the 5 assertions (table); §3 the stale name/comment text to
        refresh; §4 the temp-copy 49/49 verification; §5 TDD ordering; §6 scope boundaries."
  critical: "Keep `const whole = injected - paged;`, the notify GUARD, and the RETURN unchanged. The msg
        is the ONLY runtime change in file-injector.ts. All other edits are test wording/comments."

# MUST READ — exact change site + verified fix (Issue 3)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/architecture/code_changes_analysis.md
  why: "§'Issue 3 — Notify wording' pins the handler location, the root cause (paged===0 branch), the
        unified fix expression, and the exact 4 test cases (5 assertions) + PN1 name/comment refresh."
  section: "Issue 3 — Notify wording (Minor)"

- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/prd_snapshot.md
  why: "Bug-fix PRD §Issue 3 (the §5.5 deviation) and §Testing Summary (why the wording case is minor)."
  section: "§Issue 3, §Testing Summary"

# MUST READ — the parallel sibling contract (DISJOINT regions — confirms no collision)
- docfile: plan/002_0ac3eb160af7/bugfix/001_04217649554a/P1M1T1S2/PRP.md
  why: "P1.M1.T1.S2 edits injectFiles (L192/225/266/280) + F2/FS1/FS2/FS3. It does NOT touch the handler
        msg or Cases 9/12/F4/PN1. Confirms this task's regions are disjoint → safe to land in parallel."
  critical: "Do NOT touch injectFiles, F2, or any FS* case — those are S2's scope."

# The files being EDITED
- file: ./file-injector.ts
  why: "The handler `msg` in the `default` factory (the branched ternary). 1 edit: comment + msg → unified."
  pattern: "Keep `const whole = injected - paged;` + the notify guard + the return. Only the msg template
            and its 2 comments change."
  gotcha: "The unified template interpolates `whole` (already computed) — do NOT recompute it. The paged
           suffix is gated on `paged > 0` (a number; 0 is falsy is NOT used here — use the explicit
           `paged > 0 ? … : \"\"`)."

- file: ./file-injector.test.mjs
  why: "4 notify cases pin the old wording (5 assertions). Update them + refresh stale name/comment text."
  pattern: "Mechanical `file`/`files` → `whole` in the assertion expected-strings; refresh the
            name/comment/message strings that reference the old wording (F4, PN1, §5.5 section comment)."
  gotcha: "`#@ injected 2 files` appears 3× (Case 9 L329, F4 L713, PN1 L871) — each edit MUST include
           enough surrounding context (the assert message) to be UNIQUE. The 5 edits below do this.
           PN2/PN3/PN4 are UNTOUCHED (already `whole`/`paged`)."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-auto-reader
.
├── file-injector.ts             # ← EDIT (1 edit: handler msg in the default factory). Baseline 49/0.
├── file-injector.test.mjs       # ← EDIT (8 edits: 5 assertion strings + F4 name/messages + §5.5 comment + PN1 name/comment/message).
├── PRD.md / README.md           # READ-ONLY here (README: notify string not quoted → no doc surface; P1.M3 owns the sweep).
├── package.json                 # untouched
└── plan/002_0ac3eb160af7/bugfix/001_04217649554a/
    ├── architecture/{code_changes_analysis.md, external_deps.md, system_context.md}
    ├── prd_snapshot.md / prd_index.txt / tasks.json / TEST_RESULTS.md
    ├── P1M1T1S1/{PRP.md, research/}     # Issue 1 dedup — DONE (in file)
    ├── P1M1T1S2/{PRP.md, research/}     # Issue 2 strip — PARALLEL (disjoint regions)
    └── P1M2T1S1/
        ├── research/research_notes.md   # THIS TASK's research (9-edit set pre-verified 49/49)
        └── PRP.md                       # ← THIS FILE
```

### Desired Codebase tree with files to be changed
```bash
.
├── file-injector.ts             # MODIFIED — handler msg: branched ternary → unified `whole`[`, M paged`] template (+ comment refresh).
└── file-injector.test.mjs       # MODIFIED — Cases 9/12/F4/PN1: `file(s)` → `whole`; F4/PN1/section name+comment refreshed.
# No new files. No README / injectFiles / F2 / FS* / paged-directive / PN2/PN3/PN4 changes.
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL — keep `const whole = injected - paged;`, the notify guard, and the return UNCHANGED. The
// item §3 contract pins these. Only the `msg` template (+ its comments) changes in file-injector.ts.

// CRITICAL — the paged suffix gate is `paged > 0 ? `, ${paged} paged` : ""` (EXPLICIT `> 0`), NOT a
// truthy check. `paged` is a number; `paged === 0` must yield NO suffix. The unified template is:
//   const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
// Verify: paged===0 → `#@ injected N whole`; paged>0 → `#@ injected N whole, M paged`.

// GOTCHA — `#@ injected 2 files` occurs 3× in the test file (Case 9 L329, F4 L713, PN1 L871). Each edit's
// oldText MUST include the trailing assert MESSAGE to be unique (they differ: "notify message must be
// the count" / "plural prompt must say '2 files'" / "paged===0 must use the existing plural style"). The
// 8 test edits below each carry this distinguishing context.

// GOTCHA — PN2 (`1 whole, 1 paged` L884) and PN3 (`0 whole, 1 paged` L895) already use the paged>0
// branch's wording and are CORRECT. Do NOT touch them. PN4 asserts notify===undefined (headless) — no
// wording string — leave it.

// OK — pure string/wording change. jiti transpiles the single template fine (backtick + nested ternary
// inside `${}` is standard). The harness imports the real .ts via jiti+alias; no model/API key needed.

// IDEMPOTENCY — if the handler `msg` already reads `#@ injected ${whole} whole${paged > 0 ? …}` (a
// parallel pass may have landed it), the oldText anchor (the branched ternary) will NOT be found; run
// Level 2 — if 49/49 and grep shows zero `file(s)` notify strings, the task is already done.
```

## Implementation Blueprint

### Data models and structure
None. No type, signature, control-flow, or return-shape change. `whole = injected - paged` is preserved;
only the `msg` template literal changes (handler) and test assertion/comment strings change (harness).

### Implementation Tasks (ordered by dependencies — IMPLICIT TDD: tests first, then the fix)
```yaml
PRE-FLIGHT:
  - RECORD baseline: `node ./file-injector.test.mjs` → "49 passed, 0 failed".
  - CONFIRM the 5 old assertions exist (anchors for Edits 1–8):
      grep -cE '#@ injected [0-9]+ (file|files)' file-injector.test.mjs   # → 5
  - CONFIRM the handler ternary anchor exists (Edit 0):
      grep -cF 'injected === 1 ? "file" : "files"' file-injector.ts        # → 1
  - IDEMPOTENCY GUARD: if `grep -qE 'injected \${whole} whole\$\{paged > 0' file-injector.ts` AND
    `! grep -qE '#@ injected [0-9]+ (file|files)' file-injector.test.mjs` → already done; run Level 2
    (must be 49/49) and STOP. Do NOT force the edits.

# ── TEST EDITS FIRST (so they fail against the unchanged handler — TDD red) ──────────────
Task 1: EDIT ./file-injector.test.mjs — Edit 1: Case 9 assertion (L329)  [see "Exact source to write"]
Task 2: EDIT ./file-injector.test.mjs — Edit 2: Case 12 assertion (L361)
Task 3: EDIT ./file-injector.test.mjs — Edit 3: F4 case name (L704)
Task 4: EDIT ./file-injector.test.mjs — Edit 4: F4 singular assertion+message (L709)
Task 5: EDIT ./file-injector.test.mjs — Edit 5: F4 plural assertion+message (L713)
Task 6: EDIT ./file-injector.test.mjs — Edit 6: §5.5 section comment (L861)
Task 7: EDIT ./file-injector.test.mjs — Edit 7: PN1 case name (L864)
Task 8: EDIT ./file-injector.test.mjs — Edit 8: PN1 comment + assertion+message (L865–872)

# ── THE FIX (TDD green) ────────────────────────────────────────────────────────────────
Task 9: EDIT ./file-injector.ts — Edit 0: handler comment + msg → unified template

POST-FLIGHT:
  - grep -cE '#@ injected [0-9]+ (file|files)' file-injector.ts file-injector.test.mjs   # → 0 (both files)
  - grep -qF '#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}' file-injector.ts && echo "OK unified msg"
  - Run the Validation Loop gates (Level 1 + Level 2).

DO NOT (out of scope):
  * touch injectFiles, F2, FS1/FS2/FS3 (P1.M1.T1.S2), the paged directive offset (P1.M2.T2.S1),
    PN2/PN3/PN4, the notify guard/return, the budget logic, any format helper, or README (P1.M3).
  * change the notify GUARD (`if (ctx.hasUI) ctx.ui.notify(msg, "info")`) or the RETURN — item §3 pins them.
```

### Exact source to write (authoritative — 9 unique oldText/newText pairs, all pre-verified 49/49)

> Apply as one `edit` call with 9 `edits[]` entries, OR 9 single edits. Every `oldText` is
> grep-confirmed UNIQUE in its file (the 3× `"#@ injected 2 files"` are disambiguated by their trailing
> assert message). **Apply Edits 1–8 (test) before Edit 0 (handler)** for the TDD-red→green sequence.

**Edit 0 — `file-injector.ts` (handler comment + msg):**
```diff
-    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). paged===0 preserves the
-    // existing pluralized "N file(s)" style; paged>0 reports whole and paged counts separately.
-    const whole = injected - paged;
-    const msg = paged > 0
-      ? `#@ injected ${whole} whole, ${paged} paged`
-      : `#@ injected ${injected} ${injected === 1 ? "file" : "files"}`;
-    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // F4 pluralization preserved on the paged===0 path; guarded for print/json headless modes (api_verification §5)
+    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). Unified wording: always
+    // "N whole"; append ", M paged" only when paging. paged===0 → "#@ injected N whole"; paged>0 →
+    // "#@ injected N whole, M paged".
+    const whole = injected - paged;
+    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
+    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // §5.5 unified whole/paged wording; guarded for print/json headless modes (api_verification §5)
```

**Edit 1 — `file-injector.test.mjs` (Case 9, L329) — assertion expected-string only:**
```diff
-  assert(rec.notify && rec.notify.m === "#@ injected 2 files", `notify message must be the count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
+  assert(rec.notify && rec.notify.m === "#@ injected 2 whole", `notify message must be the count, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
```

**Edit 2 — `file-injector.test.mjs` (Case 12, L361) — assertion expected-string only:**
```diff
-  assert(rec.notify && rec.notify.m === "#@ injected 1 file", "notify must fire for the interactive path");
+  assert(rec.notify && rec.notify.m === "#@ injected 1 whole", "notify must fire for the interactive path");
```

**Edit 3 — `file-injector.test.mjs` (F4 case name, L704):**
```diff
-await runCase("F4", "F4 — notify pluralization (1 file / N files)", async () => {
+await runCase("F4", "F4 — notify wording (1 whole / N whole)", async () => {
```

**Edit 4 — `file-injector.test.mjs` (F4 singular assertion + message, L709):**
```diff
-  assert(rec.notify && rec.notify.m === "#@ injected 1 file", `singular prompt must say '1 file', got ${JSON.stringify(rec.notify && rec.notify.m)}`);
+  assert(rec.notify && rec.notify.m === "#@ injected 1 whole", `singular prompt must say '1 whole', got ${JSON.stringify(rec.notify && rec.notify.m)}`);
```

**Edit 5 — `file-injector.test.mjs` (F4 plural assertion + message, L713):**
```diff
-  assert(rec2.notify && rec2.notify.m === "#@ injected 2 files", `plural prompt must say '2 files', got ${JSON.stringify(rec2.notify && rec2.notify.m)}`);
+  assert(rec2.notify && rec2.notify.m === "#@ injected 2 whole", `plural prompt must say '2 whole', got ${JSON.stringify(rec2.notify && rec2.notify.m)}`);
```

**Edit 6 — `file-injector.test.mjs` (§5.5 HANDLER NOTIFY section comment, L861):**
```diff
-// paged is always 0 → they exercise the paged===0 backward-compat path (existing "N file(s)" style).
+// paged is always 0 → they exercise the paged===0 path (unified "N whole" wording).
```

**Edit 7 — `file-injector.test.mjs` (PN1 case name, L864):**
```diff
-await runCase("PN1", "§5.5 notify: all-whole prompt (no budget) → 'N files' (existing style preserved)", async () => {
+await runCase("PN1", "§5.5 notify: all-whole prompt (no budget) → 'N whole' (unified whole style)", async () => {
```

**Edit 8 — `file-injector.test.mjs` (PN1 comment + assertion + message, L865–872):**
```diff
-  // No budget → injectFiles O-1 fallback → all whole → paged=0 → existing pluralized message.
-  const { ctx, rec } = makeMockCtx(TMPDIR);
-  const slot = captureHandler();
-  const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
-  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
-  assert(rec.notify && rec.notify.m === "#@ injected 2 files",
-    `paged===0 must use the existing plural style, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
+  // No budget → injectFiles O-1 fallback → all whole → paged=0 → unified "N whole" message.
+  const { ctx, rec } = makeMockCtx(TMPDIR);
+  const slot = captureHandler();
+  const out = await slot.cb({ text: "Diff #@a.ts vs #@b.ts", source: "interactive", images: [] }, ctx);
+  assert(out.action === "transform", `handler must transform, got '${out.action}'`);
+  assert(rec.notify && rec.notify.m === "#@ injected 2 whole",
+    `paged===0 uses the unified whole style, got ${JSON.stringify(rec.notify && rec.notify.m)}`);
```

### Implementation Patterns & Key Details
```typescript
// PATTERN (unified notify — single template, optional paged suffix):
const whole = injected - paged;                                          // UNCHANGED
const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
//   paged===0 → "#@ injected N whole"            (was "N file"/"N files" — the bug)
//   paged>0   → "#@ injected N whole, M paged"    (already correct — preserved byte-for-byte)
if (ctx.hasUI) ctx.ui.notify(msg, "info");                               // UNCHANGED guard
return { action: "transform" as const, text, images };                   // UNCHANGED return

// WHY `paged > 0 ?` not truthy: paged is a number; the suffix must appear ONLY when paging. The old
//   paged>0 branch already produced the identical "N whole, M paged" string, so this is a strict
//   superset: paged===0 now also says "whole" (the fix), paged>0 is unchanged.

// TDD ORDERING: Edits 1–8 (test) flip the 5 assertions to expect "whole" → they FAIL against the
//   unchanged handler (still emits "file(s)"). Edit 0 (handler unify) flips them to PASS. Level 2
//   enforces 49/49 only after BOTH files are edited.

// GOTCHA (3× duplicate string): `"#@ injected 2 files"` appears at L329 (Case 9), L713 (F4 plural),
//   L871 (PN1). Each edit's oldText includes its unique trailing message so the `edit` tool targets
//   exactly one occurrence. Do NOT use the bare expected-string as an anchor.
```

### Integration Points
```yaml
NO INTEGRATION CHANGE:
  - "Internal wording fix. No new imports, config, API/type-signature change, no docs (README does not
    quote the notify string). The handler still calls injectFiles and destructures {text, images, injected, paged}."
  - "Disjoint from P1.M1.T1.S2 (injectFiles + F2/FS) and P1.M2.T2.S1 (paged directive). Lands cleanly in parallel."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** — a single-file Pi extension validated by a
> **model-free Node ESM harness** (`file-injector.test.mjs`, run via `node`). The `pytest`/`mypy`/`ruff`
> gates DO NOT APPLY. Gates below are project-specific and **verified on this machine**: the full 9-edit
> set was applied to a temp copy → **49/49 green**, zero old-wording strings remaining (research §4).

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. Handler msg unified (single template); old ternary GONE.
grep -qF '#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}' file-injector.ts && echo "OK: unified msg" || echo "FAIL: unified msg missing"
! grep -qF 'injected === 1 ? "file" : "files"' file-injector.ts && echo "OK: old ternary gone" || echo "FAIL: old ternary present"

# 1b. ZERO old 'file(s)' notify strings remain in EITHER file.
test "$(grep -cE '#@ injected [0-9]+ (file|files)' file-injector.ts file-injector.test.mjs | awk -F: '{s+=$2} END{print s}')" = "0" \
  && echo "OK: no old wording remains" || echo "FAIL: old wording still present"

# 1c. The 4 updated cases assert 'whole'.
grep -qE 'rec.notify.m === "#@ injected 2 whole"' file-injector.test.mjs && echo "OK Case9/PN1" || echo "FAIL"
grep -qE 'rec.notify.m === "#@ injected 1 whole"' file-injector.test.mjs && echo "OK Case12/F4" || echo "FAIL"

# 1d. PN2/PN3 UNCHANGED (still 'whole, paged').
grep -qE '#@ injected 1 whole, 1 paged' file-injector.test.mjs && grep -qE '#@ injected 0 whole, 1 paged' file-injector.test.mjs \
  && echo "OK: PN2/PN3 untouched" || echo "FAIL: PN2/PN3 altered"

# 1e. SCOPE LEAK guards — notify guard/return, injectFiles, paged directive untouched.
grep -qF 'if (ctx.hasUI) ctx.ui.notify(msg, "info")' file-injector.ts && echo "OK: notify guard intact" || echo "FAIL"
grep -qF 'return { action: "transform" as const, text, images }' file-injector.ts && echo "OK: return intact" || echo "FAIL"
grep -qF 'offset:0, limit:2000' file-injector.ts && echo "OK: paged directive untouched (P1.M2.T2)" || echo "(verify directive)"

# Expected: every line prints OK.
```

### Level 2: Full Harness (PRIMARY GATE)
```bash
cd /home/dustin/projects/pi-auto-reader
node ./file-injector.test.mjs
# Expected: "Result: 49 passed, 0 failed." exit 0. (Count UNCHANGED — no cases added/removed.)
# Cases 9, 12, F4, PN1 now print with 'whole' wording; PN2/PN3 still print 'whole, paged'.
# If Case 9/12/F4/PN1 FAIL after applying test edits but BEFORE the handler edit → that's the expected
#   TDD-red state; apply Edit 0 (handler) to go green. If they STILL fail after Edit 0 → the unified
#   template is wrong (re-check the `paged > 0 ? … : ""` suffix gate).
# If a NON-notify case fails → you over-edited (e.g. touched injectFiles or a fixture). Re-read the diff.
```

### Level 3: (none — no live-Pi scenario needed)
The notify wording is a pure string change fully covered by the model-free harness (Cases 9/12/F4/PN1/PN2/PN3
exercise the handler's notify path for paged===0 and paged>0). No live-Pi run adds signal beyond Level 2.

### Level 4: (none)

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: unified msg present; old ternary gone; zero old `file(s)` notify strings; Cases 9/12/F4/PN1
      assert `whole`; PN2/PN3 untouched; notify guard/return + paged directive intact.
- [ ] Level 2: `node ./file-injector.test.mjs` → **49 passed, 0 failed**, exit 0.

### Feature Validation
- [ ] Handler: `paged===0` → `#@ injected N whole`; `paged>0` → `#@ injected N whole, M paged`.
- [ ] `const whole = injected - paged;`, the notify guard, and the return UNCHANGED.
- [ ] Cases 9/12/F4/PN1 updated to `whole`; F4/PN1/section name+comment refreshed (no stale `file(s)` refs).
- [ ] PN2 (`1 whole, 1 paged`), PN3 (`0 whole, 1 paged`), PN4 (headless) UNCHANGED.

### Code Quality Validation
- [ ] Only the 9 specified edits (1 handler + 8 test); nothing else.
- [ ] Unified msg uses explicit `paged > 0 ? … : ""` (not a truthy check).
- [ ] No change to: injectFiles (S1/S2), F2/FS* (S2), paged directive (P1.M2.T2), budget, format
      helpers, PN2/PN3/PN4, notify guard/return, README (P1.M3).
- [ ] Inline comments cite PRD §5.5 and the unified wording (no stale "pluralization"/"file(s)" claims).

### Documentation & Deployment
- [ ] No new env vars / config / API surface (internal wording fix).
- [ ] README not edited (the notify string is not quoted there; P1.M3 owns the final sweep).

---

## Anti-Patterns to Avoid
- ❌ Don't change the notify GUARD or the RETURN — item §3 pins them. Only the `msg` template changes in
  `file-injector.ts`.
- ❌ Don't recompute `whole` — keep `const whole = injected - paged;` (already present).
- ❌ Don't use a truthy gate for the paged suffix — `paged === 0` must yield NO suffix. Use the explicit
  `paged > 0 ? `, ${paged} paged` : ""`.
- ❌ Don't use the bare `"#@ injected 2 files"` string as an edit anchor — it appears 3× (Case 9, F4, PN1).
  Each oldText MUST include its unique trailing assert message.
- ❌ Don't touch PN2/PN3/PN4 — they already use the correct `whole`/`paged` form (the paged>0 branch).
- ❌ Don't touch injectFiles / F2 / FS* (P1.M1.T1.S2's disjoint scope) or the paged directive
  `offset:0` (P1.M2.T2.S1).
- ❌ Don't edit README (the notify string is not quoted there; P1.M3 owns the doc sweep).
- ❌ Don't apply the handler edit BEFORE the test edits if you want the TDD-red→green signal — but the
  final 49/49 is identical either way (Level 2 is order-independent).
- ❌ Don't leave stale `file(s)` references in the F4 name/messages, PN1 name/comment, or the §5.5 section
  comment — they'd contradict the new `whole` assertions. (Edits 3/4/5/6/7/8 refresh them.)

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is a 9-edit wording unify (1 handler template + 8 mechanical test string/comment updates),
every edit given as a unique exact-text anchor (grep-verified; the 3× `"#@ injected 2 files"` are
disambiguated by their trailing assert messages). The **complete 9-edit set was applied to a temp copy of
both files and the harness run → 49/49 green**, with zero old `file(s)` notify strings remaining
(research §4). The runtime change is a single template literal (jiti transpiles it trivially); the notify
guard and return are pinned unchanged (item §3). The scope is cleanly disjoint from the parallel sibling
P1.M1.T1.S2 (injectFiles + F2/FS) and from P1.M2.T2.S1 (paged directive) — no merge-conflict surface.
Residual 0.5 is for a possible anchor byte-mismatch (e.g. an em dash or whitespace slip in a multi-line
oldText) — fully caught by Level 1 (1a–1e) + Level 2 (49/49).
