# PRP — P1.M1.T1.S2: `FileInjectorConfig` + `enableUrls` field; `readConfig` default-true semantics

**Work item**: P1.M1.T1.S2 (Foundations: dependencies, config, detection regexes → subtask 2 of 4)
**Parent module**: P1.M1 Engine + Dependencies → P1.M1.T1 Foundations
**Delta**: 010 (URL Web-Content Injection `#<url>`)

---

## Goal

**Feature Goal**: Extend the existing `FileInjectorConfig` interface (currently a single-field
one-liner) with a second optional boolean field `enableUrls`, documented via field-level JSDoc, such
that `readConfig` carries the new key through its existing shallow-merge plumbing with **zero changes
to `readConfig`'s body**. The default-true semantics are an emergent property of the unchanged code:
when no config source sets the key, `readConfig` returns `{}` and `cfg.enableUrls` is `undefined` —
which the input handler (P1.M1.T2.S3) will gate as `cfg.enableUrls !== false`. This subtask only
**declares the field + documents it**; it does not consume it.

**Deliverable**:
1. `file-injector.ts` L177 — `interface FileInjectorConfig` converted from a one-liner to a
   two-field, multi-line interface with the exact `enableUrls?: boolean;` field and the exact
   field-level JSDoc specified below. The existing `markdownBareAtImports?: boolean;` field and its
   §4.6 interface-level JSDoc (L175-176) preserved.
2. **No change** to `readConfig` (L196-228), the module-level `cfg` (L1227), the `session_start`
   handler (L1244), or the input handler (L1257). The `!== false` gate is P1.M1.T2.S3, not here.

**Success Definition**: `npm run typecheck` (tsc --strict over file-injector.ts) exits 0; `npm test`
(all three `.mjs` suites, incl. the readConfig unit tests at file-injector.test.mjs L2110+) exits 0;
`grep -n 'enableUrls' file-injector.ts` shows the new field declared exactly once inside the
interface; `readConfig`'s body is byte-for-byte unchanged (`git diff` shows no hunk in L196-228).

---

## User Persona (if applicable)

**Target User**: Pi end-user / operator (the person editing `~/.pi/agent/file-injector.json` or a
project `.pi/file-injector.json`).

**Use Case**: An operator who wants to run Pi **air-gapped** (no network egress from prompts) sets
`{"fileInjector": {"enableUrls": false}}` once; every `#<url>` token thereafter is left verbatim and
**no HTTP request is fired**. Conversely the default (key absent) keeps URL injection enabled.

**User Journey**:
1. Operator opens `~/.pi/agent/file-injector.json` (or `<cwd>/.pi/file-injector.json`, trusted project).
2. Adds `"enableUrls": false`.
3. On next `session_start`, `readConfig` shallow-merges this source → `cfg.enableUrls === false`.
4. (P1.M1.T2.S3) The input handler's `cfg.enableUrls !== false` gate evaluates false → URL tokens
   are skipped entirely, no network call. (This subtask makes step 3 type-correct; step 4 is T2.S3.)

**Pain Points Addressed**: Air-gapped / corporate-firewall / cost-control environments where any
prompt-driven network egress must be disabled globally with one config line (PRD h2.18 "the network-
hygiene / air-gapped opt-out").

---

## Why

- **Business value**: This is the **config seam** for the entire `#<url>` feature's opt-out (PRD
  heading h2.18 "4. Config: `enableUrls` (default `true`)"). Without the field declared on
  `FileInjectorConfig`, downstream subtasks cannot type-safely read `cfg.enableUrls`, and operators
  have no documented air-gap switch.
- **Why default-`true` via `!== false` (not `=== true`)**: `readConfig` returns `{}` when all four
  sources are missing (existing, verified contract — `let cfg: FileInjectorConfig = {}` at L219).
  So `cfg.enableUrls` is `undefined` by default. `undefined !== false` is `true` → default enabled.
  Using `=== true` would instead default to **disabled** (wrong). This mirrors the documented
  architecture refinement (`plan/010_8645157f3bf5/architecture/system_context.md` Refinement #2) and
  is the INVERSE polarity of `markdownBareAtImports`, which is opt-IN (`=== true`, default false).
- **Why `readConfig` needs no change**: its body builds the result with successive
  `cfg = { ...cfg, ...source }` spreads (L223-228). Object spread copies ALL enumerable own keys —
  it is shape-agnostic. Therefore a source containing `{"enableUrls": ...}` flows through unchanged
  the moment the interface DECLARES the field. Declaring the field IS the entire wiring change.
- **Integration with existing features**: `enableUrls` joins `markdownBareAtImports` under the SAME
  four-source / precedence ladder (PRD h2.18: global settings.json → global file-injector.json →
  project settings.json → project file-injector.json, project honored only when trusted). This
  subtask adds the field; the ladder itself is already shipped and unchanged.

---

## What

Edit **only** `file-injector.ts`, and within it **only** the `FileInjectorConfig` interface (L177).
No other file is touched. No README / docs change (README is P1.M2.T2.S1, a Mode-B final task). No
test file change (URL tests are P1.M2.T1).

### The exact change (minimal, contract-faithful form)

Convert the L177 one-liner into a multi-line interface; keep `markdownBareAtImports` and its existing
§4.6 interface-level JSDoc (L175-176) intact; add `enableUrls` with the EXACT field-level JSDoc below:

```ts
/** §4.6 — config shape. markdownBareAtImports: also match bare "@path" in markdown (opt-in). Loaded on
 *  session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports undefined → false downstream. */
interface FileInjectorConfig {
  markdownBareAtImports?: boolean;
  /** Default true; when false, URL tokens (#<url>) are ignored entirely and NO network request is made (air-gapped opt-out). Read alongside markdownBareAtImports from the same four sources/precedence (spec §4). */
  enableUrls?: boolean;
}
```

(The interface-level JSDoc lines above the `interface` keyword are the EXISTING L175-176 comment,
reproduced unchanged so `markdownBareAtImports`'s documentation is preserved. Only the body changes:
one-liner → two fields, with the mandated `enableUrls` field-level JSDoc.)

### Success Criteria

- [ ] `interface FileInjectorConfig` declares exactly two optional boolean fields:
      `markdownBareAtImports?: boolean;` and `enableUrls?: boolean;`
- [ ] The `enableUrls` field carries the EXACT field-level JSDoc text from the contract (below)
- [ ] `readConfig` (L196-228) is byte-for-byte unchanged (`git diff` shows no hunk there)
- [ ] The module-level `let cfg: FileInjectorConfig = {}` (L1227) is unchanged
- [ ] The `session_start` handler (L1244) and input handler (L1257) are unchanged
- [ ] `npm run typecheck` exits 0 (tsc --strict over file-injector.ts)
- [ ] `npm test` exits 0 (all three `.mjs` suites green — no runtime behavior change)
- [ ] `grep -c 'enableUrls' file-injector.ts` ≥ 1 (the field is declared); the ONLY occurrence in
      this subtask is inside the interface body (call-site usage is P1.M1.T2.S3)

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ — **Yes.** This PRP names the exact file, the exact line (L177), the exact before/after
form of the interface, the exact JSDoc text (verbatim from the contract), the exact lines that must
stay untouched, and the exact validation commands (verified to exist in `package.json` scripts).
No inference required.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: file-injector.ts
  why: "THE file being edited. The FileInjectorConfig interface is at L177 (verified one-liner:
        `interface FileInjectorConfig { markdownBareAtImports?: boolean; }`). Its §4.6 interface-level
        JSDoc is at L175-176. readConfig spans L196-228."
  pattern: "TypeScript `interface` with optional `?:` boolean fields. Field-level `/** ... */` JSDoc
            above each property is valid TS and surfaces in editor hovers."
  gotcha: "Do NOT touch readConfig (L196-228). Its `{ ...cfg, ...source }` shallow-merge (L223-228)
           already passes the new key through — the spread is shape-agnostic. Editing readConfig here
           is out of scope and risks breaking the verified T2.S1-a..d readConfig unit tests."

- file: file-injector.ts  # readConfig body — read to confirm NO change needed
  why: "L196-228 is readConfig. L199-202 = tryReadCfg (parses a dedicated file, casts to
        FileInjectorConfig). L209-214 = tryReadNamespaced (extracts the SETTINGS_KEY 'fileInjector'
        sub-object, casts to FileInjectorConfig). L223-228 = the four `{ ...cfg, ...source }` spreads.
        All three casts now include enableUrls for free once the interface declares it."
  pattern: "`cfg = { ...cfg, ...(await tryReadX(...)) }` — spread copies all own keys regardless of type."
  gotcha: "Adding an optional field is backward-compatible: every existing consumer (readConfig
           internals L199/209/219, module cfg L1227) type-checks unchanged."

- file: plan/010_8645157f3bf5/architecture/system_context.md
  why: "Refinement #2 documents the default-true mechanism (`!== false`, NOT `=== true`) and WHY it
        works (readConfig returns {} → undefined). The integration-points table (§2) pins L177 for
        the interface field and explicitly states readConfig (L196-218) needs NO body change."
  section: "§2 'Verified Integration Points' row 'FileInjectorConfig | L177'; §3 'Refinement #2:
            enableUrls default-true via !== false'"

- file: plan/010_8645157f3bf5/P1M1T1S1/research/source_verification.md
  why: "This subtask's own research note: line-by-line contract verification table + why readConfig
        needs no change + parallel-execution safety vs S1 + optional hermetic plumbing check."

- file: package.json  # scripts block — the validation commands
  why: "Defines `scripts.typecheck` (→ scripts/typecheck.mjs → tsc --strict) and `scripts.test`
        (→ 3-file .mjs chain). These are the gates."
  pattern: "\"typecheck\": \"node ./scripts/typecheck.mjs\"; \"test\": \"node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs\""

- file: scripts/typecheck.mjs
  why: "Confirms typecheck runs tsc --strict over file-injector.ts ONLY (temp tsconfig with
        `files: [\"file-injector.ts\"]`), with paths mapping only @earendil-works/*. So this gate does
        NOT depend on P1.M1.T1.S1's newly-installed deps — it validates the interface change in isolation."
  pattern: "Writes temp tsconfig; `files: [path.join(ROOT, 'file-injector.ts')]`; strict:true."

- file: file-injector.test.mjs  # readConfig unit tests — must stay green
  why: "L2110+ hosts the T2.S1-a..d + settings.json readConfig unit tests. They assert on the
        markdownBareAtImports VALUE (e.g. `r.markdownBareAtImports === true`), NOT deepEqual on the
        whole object. Adding enableUrls changes no returned VALUE → all stay green. Read to confirm
        no assertion would break from an extra key appearing on the result object."
  pattern: "`assert(r.markdownBareAtImports === true, ...)` — value assertions, tolerant of extra keys."
  gotcha: "Do NOT add enableUrls assertions to this test file in THIS subtask — URL tests are P1.M2.T1."

# PRD context (provided to this PRP, reproduced for the implementer)
- prd: "h2.18 — 4. Config: enableUrls (default true). Joins markdownBareAtImports under the same four
        sources and precedence. { \"fileInjector\": { \"enableUrls\": true } } default true; set false to
        disable all network egress. When enableUrls === false, URL_INJECT_RE tokens are ignored entirely
        (left verbatim) and no network request is made. Read on session_start, cached for the session."
- prd: "h3.40 — 2.1 Two triggers, disjoint. #@<path> → file; #<url-token> → URL. (Context for WHY the
        field exists; the URL regex itself is P1.M1.T1.S3.)"
```

### Current Codebase tree (verified)

```bash
pi-file-injector-url-injector/
├── file-injector.ts           # ← EDIT THIS (interface at L177 ONLY)
├── file-injector.test.mjs     # readConfig unit tests at L2110+ — must stay green (NOT edited)
├── import-behavior.test.mjs
├── relative-imports.test.mjs
├── package.json               # scripts.typecheck + scripts.test (validation commands)
├── scripts/typecheck.mjs      # tsc --strict wrapper over file-injector.ts
├── tsconfig.json
├── plan/010_8645157f3bf5/
│   ├── architecture/system_context.md   # Refinement #2 (default-true via !== false)
│   ├── P1M1T1S1/PRP.md                   # parallel sibling (package.json deps) — no file overlap
│   └── P1M1T1S2/                         # THIS item
│       ├── PRP.md
│       └── research/source_verification.md
└── spec/
```

### Desired Codebase tree with files to be added/modified

```bash
pi-file-injector.ts            # MODIFIED — L177 interface: one field → two fields + field-level JSDoc
                               #            (NO other line in this file changes)
# No other file created or modified by this subtask.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL: readConfig MUST stay byte-for-byte unchanged. Its `{ ...cfg, ...source }` shallow-merge
// (L223-228) already carries enableUrls through for free — spread copies all own keys regardless of
// the interface shape. Editing readConfig here is out of scope AND risks the verified T2.S1 unit tests.

// CRITICAL: the default-true semantics are EMERGENT, not implemented here. readConfig returns {} when
// all four sources are missing → cfg.enableUrls === undefined. The gate `cfg.enableUrls !== false`
// (which turns undefined into "enabled") is authored in P1.M1.T2.S3's input handler. Do NOT add any
// `!== false` check in this subtask — that is T2.S3.

// CRITICAL: use the EXACT JSDoc text from the contract (below). The contract pins the wording so the
// air-gapped-opt-out behavior is documented at the declaration site for every future reader.

// GOTCHA: field-level JSDoc (a /** */ comment directly above a property inside an interface body) is
// valid TypeScript and is the idiomatic place for per-field docs. The existing markdownBareAtImports
// docs live on the INTERFACE-level comment (L175-176) — preserve that comment verbatim; do not delete
// or rewrite markdownBareAtImports' documentation.

// GOTCHA: this subtask is parallel to P1.M1.T1.S1 (package.json deps + npm install). S1 touches
// package.json + node_modules; S2 touches file-injector.ts. ZERO file overlap → no merge conflict.
// S2's typecheck needs only the existing @earendil-works/* peer paths (already mapped in
// typecheck.mjs) — it does NOT depend on S1's installed defuddle/linkedom (those imports are T2.S1).

// GOTCHA: adding an OPTIONAL field (?:) is backward-compatible at the type level. Every existing
// consumer — readConfig internals (L199/209/219 casts), the module-level `let cfg: FileInjectorConfig = {}`
// (L1227) — type-checks unchanged. No call site needs updating in this subtask.
```

---

## Implementation Blueprint

### (No new data models — this EXTENDS an existing interface)

This subtask adds one optional field to an existing TypeScript interface. There are no new services,
tools, modules, or runtime behaviors to author.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: READ file-injector.ts L170-180 to anchor on the exact current form
  - RUN: sed -n '170,180p' file-injector.ts   (or read tool offset=170 limit=11)
  - CONFIRM: L177 is exactly `interface FileInjectorConfig { markdownBareAtImports?: boolean; }`
             (one line) and L175-176 is the §4.6 interface-level JSDoc.
  - WHY: pins the exact text to match in the edit (edits require exact oldText). If the line content
         differs from this PRP, STOP and reconcile — do not guess.

Task 2: EDIT file-injector.ts — convert the L177 one-liner to a two-field interface
  - FILE: file-injector.ts
  - OLD (exact, single line at L177):
        interface FileInjectorConfig { markdownBareAtImports?: boolean; }
  - NEW (multi-line, two fields, enableUrls carries the exact contract JSDoc):
        interface FileInjectorConfig {
          markdownBareAtImports?: boolean;
          /** Default true; when false, URL tokens (#<url>) are ignored entirely and NO network request is made (air-gapped opt-out). Read alongside markdownBareAtImports from the same four sources/precedence (spec §4). */
          enableUrls?: boolean;
        }
  - PRESERVE: the §4.6 interface-level JSDoc at L175-176 (the two `/** ... */` comment lines immediately
              above the `interface` keyword) — do NOT touch them. They remain valid as the umbrella comment.
  - DO NOT EDIT: readConfig (L196-228), module cfg (L1227), session_start handler (L1244), input
                 handler (L1257). The `!== false` gate is P1.M1.T2.S3.
  - INDENTATION: match the file's existing 2-space indentation. The enableUrls JSDoc is a single line
                 (it is one sentence-pair; do not reflow/wrap it — keep the contract wording verbatim).

Task 3: VERIFY the edit is surgical (only the interface changed)
  - RUN: git diff file-injector.ts
  - EXPECT: exactly ONE hunk, spanning only the FileInjectorConfig interface (around L177). No hunk in
            readConfig (L196-228), no hunk at L1227/L1244/L1257.
  - IF the diff touches readConfig or any handler: you are out of scope — revert and redo Task 2.

Task 4: TYPECHECK (primary gate — tsc --strict over file-injector.ts)
  - RUN: npm run typecheck
  - EXPECT: exit 0; stderr ends with "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
  - Adding an optional field cannot introduce a type error; if this fails, the edit malformed the
    interface (e.g. missing brace) — re-read the diff and fix.

Task 5: REGRESSION — existing test suite (proves no runtime behavior change)
  - RUN: npm test
  - EXPECT: exit 0 (all three .mjs suites green). Specifically the readConfig unit tests
            (file-injector.test.mjs L2110+: T2.S1-a..d + settings.json cases) must pass unchanged —
            they assert on markdownBareAtImports VALUES, which this subtask does not alter.

Task 6: (OPTIONAL) hermetic plumbing proof — NOT a file edit, a one-off check
  - To SEE that enableUrls plum through readConfig's shallow-merge without authoring a permanent test:
    reuse the jiti-load + alias pattern from file-injector.test.mjs L31-59 to load file-injector.ts,
    write a temp `<tmp>/.pi/file-injector.json` = {"enableUrls": false}, then:
        const r = await mod.readConfig({ cwd: tmp, isProjectTrusted: () => true });
        assert(r.enableUrls === false, "enableUrls must plumb through readConfig's shallow-merge");
  - This is OPTIONAL: Tasks 4+5 already prove the change is safe and complete for THIS subtask.
    Authoring a permanent enableUrls assertion belongs to P1.M2.T1 (URL tests), not here.
```

### Implementation Patterns & Key Details

```ts
// PATTERN: optional boolean field on an existing config interface (mirror markdownBareAtImports).
//   The `?:` makes the field optional → backward-compatible with every existing consumer.
interface FileInjectorConfig {
  markdownBareAtImports?: boolean;   // existing field — PRESERVE, opt-IN (=== true), default false
  /** <EXACT contract JSDoc — see Task 2 NEW block> */
  enableUrls?: boolean;              // NEW field — opt-OUT (gate is `!== false` in T2.S3), default true
}

// CRITICAL DETAIL — the two fields have OPPOSITE polarity. Do not "unify" them:
//   markdownBareAtImports: opt-IN  → consumer gates `cfg.markdownBareAtImports === true` (undef → false)
//   enableUrls:            opt-OUT → consumer gates `cfg.enableUrls !== false`           (undef → true)
// This subtask DECLARES enableUrls only; the `!== false` gate is authored in P1.M1.T2.S3.

// WHY readConfig needs no change (the non-obvious part):
//   readConfig builds its result via successive spreads (L223-228):
//     cfg = { ...cfg, ...(await tryReadNamespaced(<global settings.json>)) };
//     cfg = { ...cfg, ...(await tryReadCfg(<global file-injector.json>)) };
//     if (ctx.isProjectTrusted()) {
//       cfg = { ...cfg, ...(await tryReadNamespaced(<project settings.json>)) };
//       cfg = { ...cfg, ...(await tryReadCfg(<project file-injector.json>)) };
//     }
//   Object spread copies ALL enumerable own keys regardless of the interface — so a source
//   {"enableUrls": false} (or {"fileInjector": {"enableUrls": false}}) flows straight through.
//   tryReadCfg/tryReadNamespaced CAST the parsed JSON to FileInjectorConfig; once the interface
//   declares enableUrls, that cast is type-correct. No body edit required.
```

### Integration Points

```yaml
TYPESCRIPT INTERFACE (the ONLY integration surface this subtask touches):
  - file: "file-injector.ts"
  - location: "L177 — interface FileInjectorConfig"
  - change: "add `enableUrls?: boolean;` as a second field + the exact field-level JSDoc"

NO CHANGE REQUIRED TO (explicitly out of scope):
  - "readConfig body (L196-228) — shallow-merge already carries the key"
  - "module-level `let cfg: FileInjectorConfig = {}` (L1227) — optional field is backward-compatible"
  - "session_start handler (L1244) — calls readConfig unchanged"
  - "input handler (L1257) — the `cfg.enableUrls !== false` GATE is P1.M1.T2.S3, not this subtask"
  - "any test file — URL tests are P1.M2.T1; existing readConfig tests already assert on values"
  - "README.md / docs — README is P1.M2.T2.S1 (Mode-B final task)"
  - "package.json / node_modules — owned by the parallel P1.M1.T1.S1 subtask (no file overlap)"

DOWNSTREAM CONSUMER (what this subtask ENABLES, not implements):
  - "P1.M1.T2.S3 will read `cfg.enableUrls !== false` in the input handler (L1257) and pass it as the
     new 5th arg to injectFiles. The field declared here is what makes that read type-safe."
```

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Confirm the interface now has both fields (quick structural check)
grep -n 'enableUrls\|markdownBareAtImports' file-injector.ts
# EXPECT: a line inside the interface declaring `enableUrls?: boolean;` AND the existing
#         `markdownBareAtImports?: boolean;`. The interface-level §4.6 JSDoc (L175-176) may also
#         mention markdownBareAtImports — that is the preserved comment, not a second declaration.

# Confirm the exact JSDoc text is present (contract fidelity)
grep -F 'Default true; when false, URL tokens (#<url>) are ignored entirely and NO network request is made (air-gapped opt-out).' file-injector.ts
# EXPECT: exactly one match (the enableUrls field-level JSDoc).

# Confirm the diff is surgical (ONLY the interface hunk)
git diff --stat file-injector.ts
# EXPECT: "1 file changed, N insertions(+), M deletions(-)" with N≈3,M≈1 (one-liner → multi-line).
git diff file-injector.ts
# EXPECT: a single hunk around L177. NO hunk in readConfig (L196-228), L1227, L1244, or L1257.
# If the diff touches readConfig or any handler → out of scope; revert and redo.
```

### Level 2: Type Check (Primary Gate)

```bash
# tsc --strict over file-injector.ts (via scripts/typecheck.mjs). Adding an optional field CANNOT
# introduce a type error; this gate confirms the interface is still well-formed after the edit.
npm run typecheck
# EXPECT: exit 0; final stderr line: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)".
# NOTE: this gate needs only the existing @earendil-works/* peer paths (already mapped in
#       typecheck.mjs). It does NOT depend on P1.M1.T1.S1's installed defuddle/linkedom.
```

### Level 3: Regression (System Validation)

```bash
# The full model-free acceptance harness (3-file .mjs chain). No runtime behavior changed in this
# subtask (readConfig body + all handlers untouched), so every existing assertion must stay green.
# This is the belt-and-suspenders proof that adding the field broke nothing at runtime.
npm test
# EXPECT: exit 0 (all three suites green). Requires the global pi package present
# (file-injector.test.mjs resolves `npm root -g`/`@earendil-works/pi-coding-agent`).
# NOTE: the readConfig unit tests (file-injector.test.mjs L2110+: T2.S1-a..d + settings.json) assert
#       on markdownBareAtImports VALUES — they must pass unchanged. This subtask does NOT yet exercise
#       URL injection or the enableUrls gate (those are P1.M1.T2.S3 / P1.M2.T1).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# (OPTIONAL) Hermetic plumbing proof — confirm enableUrls actually flows through readConfig's
# unchanged shallow-merge, WITHOUT authoring a permanent test (that is P1.M2.T1). Reuse the jiti-load
# + alias pattern from file-injector.test.mjs L31-59 to load file-injector.ts, then:
#
#   const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s2-plumb-"));
#   fs.mkdirSync(path.join(tmp, ".pi"), { recursive: true });
#   fs.writeFileSync(path.join(tmp, ".pi", "file-injector.json"), JSON.stringify({ enableUrls: false }));
#   const r = await mod.readConfig({ cwd: tmp, isProjectTrusted: () => true });
#   assert(r.enableUrls === false, "enableUrls must plumb through readConfig's shallow-merge");
#
# And the default-true emergent check (no source sets the key):
#   const base = await mod.readConfig({ cwd: path.join(os.tmpdir(), "nonexistent"), isProjectTrusted: () => false });
#   assert(base.enableUrls === undefined, "absent key → undefined (the default-true mechanism)");
#
# EXPECT: both assertions pass. This proves the field is wired into the config ladder end-to-end
#         even though the consumer gate (cfg.enableUrls !== false) lands in P1.M1.T2.S3.
```

---

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` exits 0 (Level 2 — primary gate)
- [ ] `npm test` exits 0 (Level 3 — regression; no runtime behavior change)
- [ ] `git diff file-injector.ts` shows exactly ONE hunk, only the FileInjectorConfig interface

### Feature Validation

- [ ] `interface FileInjectorConfig` declares exactly two optional boolean fields
- [ ] The `enableUrls` field carries the EXACT contract JSDoc text (Level 1 grep -F matches once)
- [ ] `readConfig` (L196-228) byte-for-byte unchanged
- [ ] Module-level `cfg` (L1227), session_start handler (L1244), input handler (L1257) unchanged
- [ ] No `!== false` / `=== true` gate added in this subtask (that is P1.M1.T2.S3)
- [ ] No other file modified (no test file, no README, no package.json)

### Code Quality Validation

- [ ] 2-space indentation consistent with the rest of the file
- [ ] markdownBareAtImports' existing §4.6 interface-level JSDoc (L175-176) preserved verbatim
- [ ] Field-level JSDoc placed directly above the `enableUrls` property (surfaces in editor hovers)
- [ ] Optional `?:` used (backward-compatible — no consumer forced to set the field)

### Documentation & Deployment

- [ ] The exact field-level JSDoc documents the air-gapped opt-out at the declaration site
- [ ] No new env vars; no README change (README is P1.M2.T2.S1)

---

## Anti-Patterns to Avoid

- ❌ Don't edit `readConfig` (L196-228) — its shallow-merge already carries `enableUrls` for free.
  Editing it is out of scope and risks the verified T2.S1-a..d readConfig unit tests.
- ❌ Don't add the `cfg.enableUrls !== false` gate anywhere in this subtask — that is P1.M1.T2.S3's
  input handler. This subtask only DECLARES the field.
- ❌ Don't rewrite or delete markdownBareAtImports' existing §4.6 interface-level JSDoc (L175-176) —
  preserve it verbatim as the umbrella comment.
- ❌ Don't paraphrase the enableUrls JSDoc — use the EXACT contract text (the wording is pinned).
- ❌ Don't make `enableUrls` required (drop the `?:`) — it must stay optional so the default-true
  mechanism (undefined → enabled) works and all existing consumers stay valid.
- ❌ Don't "unify" the two fields' polarity. They are intentionally opposite: markdownBareAtImports is
  opt-IN (`=== true`, default false); enableUrls is opt-OUT (gate `!== false`, default true).
- ❌ Don't add an `enableUrls` assertion to the existing test files — permanent URL/config tests are
  P1.M2.T1. (The optional Level 4 check is a throwaway, not a committed test.)
- ❌ Don't touch package.json or node_modules — that is the parallel P1.M1.T1.S1 subtask's scope.

---

## Scope Boundaries (respect the plan)

- **IN SCOPE (this subtask)**: add `enableUrls?: boolean;` + its exact field-level JSDoc to the
  `FileInjectorConfig` interface at file-injector.ts L177; validate via typecheck + existing tests.
- **PARALLEL sibling (no overlap)**: P1.M1.T1.S1 edits package.json + runs npm install. S2 edits
  file-injector.ts. The two cannot conflict.
- **NEXT subtasks (do NOT do here)**:
  - P1.M1.T1.S3 — `URL_INJECT_RE` + `URL_SHAPE_RE` detection regex constants.
  - P1.M1.T1.S4 — typecheck-shim decision (verify tsc --strict resolves defuddle/node + linkedom types).
  - P1.M1.T2.S1 — `injectUrl` pipeline (the `import { Defuddle } from "defuddle/node"` + linkedom code).
  - P1.M1.T2.S3 — the input-handler gate `cfg.enableUrls !== false` + 5th `injectFiles` arg (the field's
    actual CONSUMER; this subtask makes that read type-safe).

---

## Confidence Score

**9/10** — One-pass success is highly likely. The contract is fully deterministic: the exact file,
the exact line (L177), the exact before/after interface text, the exact (verbatim) JSDoc, and the
explicit "do not touch readConfig" constraint are all verified against source. Adding one optional
field is backward-compatible at the type level and produces no runtime change, so both gates
(typecheck + existing tests) are near-certain to stay green. The single residual risk is an
accidental edit to readConfig or a handler — caught immediately by `git diff` (Level 1) before any
validation runs.