---
name: "P1.M1.T2.S1 (plan/009) — Input handler: change return to text: event.text (explicit verbatim)"
prd_ref: "PRD §6.4 (Assembly & shared state — 'Two returns': the input handler returns text: event.text verbatim), §13.8 (why the prompt is preserved verbatim — stripping breaks cancel/fork/tree re-injection), §3.4 (two-mechanism model: input returns text: event.text), §12.10/§12.16 (never strip markers)"
target_file: "./file-injector.ts"   # EDIT IN PLACE — input handler return line (L1265): text → text: event.text
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + structural grep; the .mjs suites are RED from the not-yet-migrated stripped-expectation assertions — migration is P1.M2.T1, out of scope here)
depends_on: "P1.M1.T1.S3 (LANDED in working tree: injectFiles returns the original prompt verbatim as its `text` field — resolvedIdx/strippedText deleted, typecheck 0 errors). T2.S1 consumes that verbatim `text` return and makes the handler's verbatim contract EXPLICIT."
consumed_by: "P1.M1.T2.S2 (read-only verification that before_agent_start/computeDetailOffsets/renderInjectedMessage are unaffected); P1.M2.T1.S1 (migrate ~20 top-level prompt assertions: r.text now verbatim); P1.M2.T4.S1 (README verbatim sync)"
---

# PRP — P1.M1.T2.S1: Input handler: change return to text: event.text (explicit verbatim)

> **Scope flag:** This is a **one-token handler edit** that makes the verbatim-prompt contract EXPLICIT at the
> input-handler boundary (PRD §6.4). T1.S3 (LANDED) already made `injectFiles` return the original prompt
> verbatim as its `text` field, so the `text` destructured in the handler already === `event.text`. Changing
> `return { ..., text, ... }` → `return { ..., text: event.text, ... }` is a **no-op at runtime** (identical
> transform) but pins the verbatim contract at the one place Pi stores as the user message — defense-in-depth
> against a future refactor that might re-introduce stripping inside injectFiles. **No test changes** (the
> suites are RED from the not-yet-migrated stripped-expectation assertions; P1.M2.T1 owns those).

---

## Goal

**Feature Goal:** Make the input handler's verbatim-prompt return EXPLICIT by returning `text: event.text`
instead of the destructured `text` (which already equals `event.text` after T1.S3), per PRD §6.4's "Two returns"
spec (`return { action: "transform", text: event.text, images: state.images }`). This removes any ambiguity
about whether the handler modifies the prompt and robustly pins the verbatim contract at the handler boundary.

**Deliverable:** Modified `./file-injector.ts` — ONE line (the input handler's transform return, L1265):
`return { action: "transform" as const, text, images };` → `return { action: "transform" as const, text: event.text, images };`
(with the trailing comment updated to cite §6.4 verbatim). Every other line of the handler (short-circuits,
destructure, `!injected` early-return, `pending` stash, notify) and every other line of the file is UNCHANGED.

**Success Definition:**
1. `npm run typecheck` → 0 errors (unchanged from the T1.S3-green state; `event.text` is `string`, matching the transform's `text: string` field).
2. Structural grep confirms `text: event.text` appears in the input handler's transform return.
3. The `text` destructure at L1252 is KEPT (item §3b: harmless + useful for debugging; its equality with `event.text` is an invariant signal).
4. The `images` field in the return stays `images` (the merged list from injectFiles — NOT `event.images`).
5. The 3 short-circuits, the `!injected` early-return, the `pending` stash, and the notify are UNCHANGED.
6. No test file edited (the red suite is the expected P1.M2.T1 handoff).

## User Persona

**Target User:** The implementer/reviewer who reads the input handler and needs to see — at a glance — that the
prompt is returned verbatim (not transformed, not stripped). And the future maintainer who must not accidentally
re-introduce stripping.

**Use Case:** A reader opens the factory's input handler to understand the `#@` delivery contract. They see
`return { action: "transform", text: event.text, images }` — the verbatim contract is immediate and unambiguous
(no need to trace that injectFiles happens to return its first param unmodified).

**Pain Points Addressed:** Latent ambiguity. Today the handler returns the destructured `text`, which a reader
must trace back through `injectFiles` to confirm is verbatim. If a future refactor transformed `text` inside
injectFiles (e.g. re-introduced stripping by mistake), the handler would silently propagate the modified text.
`text: event.text` pins the contract at the boundary.

## Why

- **Honors PRD §6.4's explicit spec.** §6.4 "Two returns (not one)" writes the input handler's return as
  `return { action: "transform", text: event.text, images: state.images }` (text **verbatim**). The current
  code returns the destructured `text`, which IS verbatim after T1.S3 — but the spec's intent is to name
  `event.text` directly. T2.S1 aligns the code with the spec's letter, not just its (current) behavior.
- **Defense-in-depth at the handler boundary.** The input handler is the ONE place Pi stores as the user message.
  Returning `event.text` directly means no future change inside `injectFiles` (accidental stripping, a new
  transform, a refactor) can silently corrupt the stored prompt. The verbatim invariant — which makes
  cancel/fork/`/tree`-navigate re-trigger injection (§13.8) — is pinned at the boundary, not dependent on a
  downstream function's continued correctness.
- **Free clarity.** The change is a no-op at runtime (text already === event.text after T1.S3) and costs one
  token. The readability + robustness gain is well worth it.
- **Completes the §6.4 contract surface.** T1.S3 made injectFiles honor verbatim; T2.S1 makes the handler's
  return explicitly honor it. Together they close the "the stored prompt is exactly what the user typed" loop.

## What

No user-visible or runtime behavior change (the transform is identical — `text` already equaled `event.text`).
Externally, nothing observable changes. The edit is internal clarity/robustness.

### Success Criteria

- [ ] The input handler's transform return (L1265) reads `return { action: "transform" as const, text: event.text, images };`
      (was `text`).
- [ ] `npm run typecheck` → 0 errors.
- [ ] The `text` destructure at L1252 is UNCHANGED (kept for debugging; item §3b).
- [ ] The `images` field stays `images` (NOT changed to `event.images` — it's the merged list from injectFiles).
- [ ] The 3 short-circuits (L1248-1250), the `!injected` early-return (L1253), the `pending` stash (L1257),
      and the notify (L1261-1264) are byte-for-byte UNCHANGED.
- [ ] No test file edited; no other source line changed.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ **Yes.** This PRP gives the exact current return line (L1265, quoted verbatim with its comment),
the exact one-line oldText→newText, the verified POST-T1.S3 state (injectFiles returns verbatim; typecheck 0
errors; `resolvedIdx`/`strippedText` gone), the PRD §6.4/§13.8 rationale (why verbatim), the item §3b guidance
(keep the `text` destructure), and the deterministic gate (typecheck + structural grep). The implementer makes
ONE one-line edit and re-runs typecheck.

### Documentation & References

```yaml
# MUST READ — the verbatim contract (the "why" of text: event.text)
- file: PRD.md
  why: "§6.4 'Two returns (not one)' writes the input handler's return as
        `return { action: 'transform', text: event.text, images: state.images }` (text VERBATIM). §13.8 explains
        WHY: Pi re-feeds the STORED user-message content on cancel/fork//tree-navigate, so a stripped prompt would
        never re-trigger injection. §3.4 shows the same `text: event.text` in the two-mechanism diagram."
  section: "### 6.4 (Two returns) + ### 13.8 + ### 3.4"
  critical: "The spec names `event.text` directly in the return — not a destructured local. T2.S1 aligns the code.
             This is a no-op at runtime (text already === event.text after T1.S3) but pins the contract at the boundary."

# MUST READ — the contract: T1.S3 is landed; injectFiles returns verbatim text
- file: plan/009_0d85ac0b1b08/P1M1T1S3/PRP.md
  why: "T1.S3 (LANDED) deleted resolvedIdx/strippedText from injectFiles; it returns the original `text` param
        verbatim on both the count===0 and count>0 paths. T2.S1's `text` destructure therefore already ===
        `event.text`. T1.S3's 'consumed_by' names T2.S1: 'input handler return text:event.text — independent
        parallel confirmation of the verbatim contract.'"
  critical: "T1.S3 is DONE (verified: grep resolvedIdx|strippedText → 0; typecheck 0 errors; injectFiles L1179/L1188
             return `text`). T2.S1 is the explicitness follow-up. Do NOT re-edit injectFiles (S3 owns it)."

# The file you edit (ONE line — the input handler's transform return)
- file: file-injector.ts
  why: "1361 lines. Input handler at L1247-1265. The transform return is L1265:
        `return { action: \"transform\" as const, text, images }; // rewrite prompt with injected content + merged images`.
        The destructure at L1252 includes `text` (KEPT per item §3b). The `!injected` early-return L1253, the
        `pending` stash L1257, and the notify L1261-1264 are UNCHANGED."
  pattern: "Mirror the existing return shape exactly — only `text` becomes `text: event.text`. The trailing
            comment changes to cite §6.4 verbatim (replacing the stale 'rewrite prompt with injected content'
            wording, which described the OLD stripped design)."
  gotcha: "Do NOT change `images` to `event.images`. `images` is the MERGED list from injectFiles (seeded from
           event.images plus any injected images). Only `text` becomes `event.text`. Do NOT remove `text` from the
           destructure (item §3b: keep it — harmless + useful for debugging)."

# typecheck gate (unchanged from T1.S3-green)
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. `event.text` is `string` (the InputEvent.text field), matching the
        transform's `text: string` field. The edit introduces no type change. Current state: 0 errors (T1.S3-green)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← THE ONLY FILE EDITED (input handler L1265: text → text: event.text)
├── file-injector.test.mjs    # NOT edited (RED from T1.S3 — stripped-expectation migration is P1.M2.T1)
├── relative-imports.test.mjs # NOT edited (RED — P1.M2.T2)
├── import-behavior.test.mjs  # NOT edited (RED — P1.M2.T2)
├── scripts/typecheck.mjs     # untouched (the typecheck gate — T2.S1's deterministic check; 0 errors)
├── package.json              # untouched
├── PRD.md / README.md        # read-only (README verbatim sync is P1.M2.T4)
└── plan/009_0d85ac0b1b08/
    ├── architecture/{system_context.md, stripping_logic_analysis.md, test_assertions_analysis.md, readme_analysis.md}
    ├── P1M1T1S1/{PRP.md}   # ← S1 (Complete): scanTokens→string[], processTokenStream→void
    ├── P1M1T1S2/{PRP.md}   # ← S2 (Complete): injectMarkdown verbatim
    ├── P1M1T1S3/{PRP.md}   # ← S3 (LANDED): injectFiles verbatim return (the dependency)
    └── P1M1T2S1/
        ├── research/research_notes.md   # ← verified POST-T1.S3 state + the one-line edit + rationale
        └── PRP.md                         # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — ONE line (input handler transform return L1265):
                          #   `text` → `text: event.text` (+ comment updated to cite §6.4 verbatim).
# NO other files. NO test edits. NO new exports/imports. NO other source line changed.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — this is a ONE-LINE, ONE-TOKEN edit. Change ONLY the `text` field in the transform return to
//   `text: event.text`. Do NOT touch `images` (it's the merged list from injectFiles, NOT event.images).
//   Do NOT touch any other line of the handler or the file.

// CRITICAL — KEEP the `text` destructure at L1252. Item §3b: "keeping it is harmless and useful for debugging.
//   Prefer keeping it for now and documenting that text === event.text (verbatim)." Removing it is NOT required
//   and would lose a useful local. The destructure's `text` is simply no longer used in the return (event.text
//   is used directly), but it remains available for any debug log.

// CRITICAL — do NOT change `images` to `event.images`. The return's `images` is the MERGED list from injectFiles
//   (state.images, seeded from event.images via `[...event.images ?? []]` plus any injected images). Only `text`
//   becomes `event.text` (the verbatim prompt). Swapping images would drop injected images — a real bug.

// CRITICAL — T1.S3 is LANDED. injectFiles returns verbatim `text` (L1179 count===0, L1188 count>0; both return
//   the original `text` param). `resolvedIdx`/`strippedText` are GONE (grep → 0). typecheck is 0 errors. So the
//   `text` destructured at L1252 already === `event.text`. T2.S1's edit is a no-op at runtime — its value is
//   explicitness + robustness at the handler boundary, NOT a behavior change.

// GOTCHA — the trailing comment on the return line currently says "rewrite prompt with injected content + merged
//   images". That wording is STALE (it described the OLD stripped-appended design). Update it to cite §6.4 verbatim
//   (e.g. "§6.4 — text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open
//   re-triggers injection)"). This is part of the one-line edit.

// GOTCHA — the .mjs suites are INTENTIONALLY RED (from T1.S3; ~78 stripped-expectation assertions like
//   `r.text === "Review a.ts"` that should now be `Review #@a.ts`). T2.S1 does NOT migrate them (P1.M2.T1 owns
//   that). T2.S1's gate is typecheck + structural grep — NOT the test suite. Running the suite will show the same
//   red state as post-T1.S3 (T2.S1 changes no assertion-relevant behavior).

// LIBRARY — TypeScript via jiti (no build step). typecheck = tsc --strict. `event.text` is `string` (InputEvent.text),
//   matching the transform's `text: string` field. No type change. No new imports/exports.
```

## Implementation Blueprint

### The one edit (exact oldText → newText)

**oldText** (current — L1265):
```ts
    return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images
```

**newText**:
```ts
    return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open re-triggers injection; §13.8)
```

Only `text` → `text: event.text` (+ the comment). The `images` field, the `as const`, the `action: "transform"`,
and the rest of the handler are UNCHANGED.

### Implementation Patterns & Key Details

```ts
// The input handler — before and after (ONLY the return line changes):

// BEFORE (L1265):
//   return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images

// AFTER (L1265):
//   return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM (event.text, ...)

// Why this is a no-op at runtime (after T1.S3):
//   - injectFiles returns its first param (`text`, which is `event.text`) verbatim — L1188.
//   - the destructure `const { text, ... } = await injectFiles(event.text, ...)` binds `text` === `event.text`.
//   - so `return { ..., text, ... }` and `return { ..., text: event.text, ... }` produce identical transforms.
// The value is EXPLICITNESS (a reader sees the verbatim contract immediately) + ROBUSTNESS (a future refactor
// of injectFiles cannot silently corrupt the stored prompt — the handler pins event.text at the boundary).
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — ONE line):
  - input handler transform return (L1265): `text` → `text: event.text`; comment updated to cite §6.4 verbatim.
  - UNCHANGED: the 3 short-circuits (L1248-1250); the destructure incl. `text` (L1252, KEPT per item §3b);
        the `!injected` early-return (L1253); the `pending = { blocks, details }` stash (L1257); the notify
        (L1261-1264); the `images` field in the return (stays `images`); injectFiles (S3 owns it); every other
        function; the factory's other handlers (session_start config, before_agent_start, session_start autocomplete).

NO_CHANGES: the three .mjs suites (RED from T1.S3 — P1.M2 owns migration), package.json, scripts/typecheck.mjs,
            PRD.md, README.md, all plan/ files. NO new exports. NO new imports.
```

### Implementation Tasks (ordered)

```yaml
Task 1: EDIT the input handler transform return (the one line)
  - LOCATE L1265: `return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images`
    (place by the exact text; line ~1265 but place by text — the file is 1361 lines).
  - REPLACE with: `return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open re-triggers injection; §13.8)`
  - DO NOT: touch `images`, the `as const`, the `action: "transform"`, or any other line.
  - DO NOT: remove `text` from the destructure at L1252 (item §3b: keep it).

Task 2: VERIFY the gate
  - npm run typecheck → EXPECT 0 errors (unchanged from T1.S3-green; event.text is string).
  - Structural grep (Level 2): confirm `text: event.text` appears once in the input handler return.
  - ACKNOWLEDGE the red suite (Level 3): the .mjs suites remain red (from T1.S3's stripped-expectation asserts).
    T2.S1 changes no assertion-relevant behavior — do NOT edit tests (P1.M2.T1 owns migration).
```

## Validation Loop

### Level 1: Typecheck (THE deterministic gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# (Unchanged from the T1.S3-green state — event.text is string, matching the transform's text: string field.)
# If it fails: the edit introduced a typo (e.g. text:event.text without the space is fine; a malformed key is not).
```

### Level 2: Structural grep (confirm the one edit landed)

```bash
cd /home/dustin/projects/pi-file-injector
echo "[1] text: event.text in the return:"; grep -c 'text: event.text' file-injector.ts   # expect 1
echo "[2] old 'as const, text, images' gone:"; grep -c 'as const, text, images }' file-injector.ts   # expect 0
echo "[3] text destructure kept:"; grep -c 'const { text, images, injected, paged, blocks, details }' file-injector.ts   # expect 1
echo "[4] images field unchanged (not event.images):"; grep -c 'text: event.text, images }' file-injector.ts   # expect 1
# Expected counts: 1, 0, 1, 1. If [1] is 0 the edit didn't land; if [2] is 1 the old line is still there.
```

### Level 3: Red-suite acknowledgment (NOT a T2.S1 gate — do NOT fix)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "Result:|FAIL" | head -3
# Expected: the SAME red state as post-T1.S3 (~78 stripped-expectation failures, e.g.
# `r.text === "Review a.ts"` should now be `Review #@a.ts`). T2.S1 changes no assertion-relevant behavior
# (text already === event.text after S3), so the pass/fail counts are IDENTICAL to post-T1.S3.
# ⚠️ DO NOT edit the tests. DO NOT revert the source. The red suite is the P1.M2.T1 handoff signal.
```

### Level 4: Optional runtime probe (confidence only — not a gate; foregone conclusion)

```bash
# A throwaway probe confirming out.text === event.text (the input handler's input). Since text already equaled
# event.text after T1.S3, this passing is a foregone conclusion — the real value of T2.S1 is explicitness.
cat > /tmp/t2s1-probe.mjs <<'EOF'
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PIPKG = require("child_process").execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const jiti = require(PIPKG + "/node_modules/jiti/jiti.js");
const mod = jiti(require)("./file-injector.ts", { alias: { "@earendil-works/pi-coding-agent": PIPKG } });
const fs = require("fs"), path = require("path"), os = require("os");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t2s1-"));
fs.writeFileSync(path.join(dir, "a.ts"), "export const x = 1;\n");
const pi = { handlers: {}, on(ev, cb) { (this.handlers[ev] ??= []).push(cb); } };
mod.default(pi);
const ctx = { cwd: dir, hasUI: false };
await pi.handlers["session_start"][0]?.({}, ctx);
const inputText = "Review #@a.ts";
const out = await pi.handlers["input"][0]({ text: inputText, source: "interactive", images: [] }, ctx);
console.log("out.text === event.text:", out.text === inputText, "| out.text:", JSON.stringify(out.text));
fs.rmSync(dir, { recursive: true, force: true });
EOF
node /tmp/t2s1-probe.mjs; rm -f /tmp/t2s1-probe.mjs
# Expected: out.text === event.text: true | out.text: "Review #@a.ts"  (the #@ is preserved verbatim).
# (If the jiti path doesn't resolve, skip this probe — Level 1+2 are the deterministic gate.)
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] Structural grep (Level 2): `text: event.text` (1); old `as const, text, images }` (0); `text` destructure (1); `text: event.text, images }` (1).
- [ ] `git diff --stat` shows ONLY `file-injector.ts` changed (one line).

### Feature Validation (the contract)

- [ ] The input handler's transform return reads `return { action: "transform" as const, text: event.text, images };`.
- [ ] `images` stays `images` (the merged list — NOT `event.images`).
- [ ] The `text` destructure at L1252 is KEPT (item §3b).
- [ ] The 3 short-circuits, the `!injected` early-return, the `pending` stash, and the notify are UNCHANGED.

### Scope & Gate Integrity

- [ ] NO test file edited (the red suite is the expected T1.S3 handoff; P1.M2.T1 migrates).
- [ ] NO other source line changed (only L1265).
- [ ] injectFiles, the helpers, the other factory handlers — all UNCHANGED.
- [ ] No new exports; no new imports.

### Documentation

- [ ] The trailing comment on the return line cites §6.4 verbatim (replacing the stale "rewrite prompt with
      injected content" wording that described the OLD stripped design).
- [ ] No README/user-facing change (the README verbatim sync is P1.M2.T4; display-renderer sync is P1.M2.T4).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT change `images` to `event.images`.** The return's `images` is the MERGED list from injectFiles
  (state.images = `[...event.images ?? []]` + injected images). Only `text` becomes `event.text`. Swapping images
  would drop injected images — a real bug.
- ❌ **Do NOT remove `text` from the destructure.** Item §3b explicitly says keep it ("harmless and useful for
  debugging"). Its equality with `event.text` is a useful invariant signal; removing it is unnecessary churn.
- ❌ **Do NOT touch any other line.** This is a one-token edit (`text` → `text: event.text`) on one line (L1265).
  The short-circuits, the `!injected` early-return, the `pending` stash, the notify, and the rest of the file
  are all UNCHANGED.
- ❌ **Do NOT edit the test files.** The .mjs suites are RED from T1.S3's stripped-expectation assertions; P1.M2.T1
  migrates them. T2.S1's gate is typecheck + structural grep (the edit changes no assertion-relevant behavior —
  `text` already equaled `event.text` after S3).
- ❌ **Do NOT treat this as a behavior change.** It is a no-op at runtime (after T1.S3) — its value is explicitness
  + robustness at the handler boundary. Do not "test" it as if it changes output; the runtime probe (Level 4) is a
  foregone conclusion.
- ❌ **Do NOT re-edit injectFiles.** T1.S3 owns it (and it's LANDED — verbatim return, 0 typecheck errors). T2.S1
  edits ONLY the input handler's return line.
- ❌ **Do NOT leave the stale comment.** The old "rewrite prompt with injected content + merged images" comment
  described the OLD stripped-appended design. Update it to cite §6.4 verbatim as part of the one-line edit.
- ❌ **Do NOT trust the item description's line numbers** (it says L1306-1324; the actual handler is at L1247-1265
  — the file is 1361 lines and line numbers shifted during S1/S2/S3). Place by the literal text in the oldText.

---

## Confidence Score: 10/10

A single one-token edit (`text` → `text: event.text`) on one line (L1265), with the exact oldText verified
against the current working tree, the POST-T1.S3 state confirmed (injectFiles returns verbatim; typecheck 0
errors; `resolvedIdx`/`strippedText` gone), the PRD §6.4/§13.8 rationale documented, the item §3b "keep the
destructure" guidance respected, and the deterministic gate (typecheck + structural grep) unambiguous. The edit
is a no-op at runtime (text already === event.text after S3) — its value is explicitness + robustness at the
handler boundary. The red suite is the expected T1.S3 handoff (P1.M2.T1 migrates), not a T2.S1 concern. The
implementer makes one one-line edit and re-runs typecheck. No residual risk.