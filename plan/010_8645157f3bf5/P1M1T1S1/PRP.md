# PRP — P1.M1.T1.S1: package.json `dependencies` block + `npm install`

**Work item**: P1.M1.T1.S1 (Foundations: dependencies, config, detection regexes → subtask 1 of 4)
**Parent module**: P1.M1 Engine + Dependencies → P1.M1.T1 Foundations
**Delta**: 010 (URL Web-Content Injection `#<url>`)

---

## Goal

**Feature Goal**: Add a top-level `dependencies` block to the repo-root `package.json`
declaring the 5 extraction runtime dependencies (defuddle + its 4 collaborators) as **hard
dependencies**, then run `npm install` so npm generates `package-lock.json` and populates
`node_modules/`. This is the foundational install step that every downstream URL-injection
subtask depends on (the TS import `defuddle/node` / `linkedom` will only resolve after this).

**Deliverable**:
1. `package.json` — a new top-level `dependencies` object with exactly 5 entries and the exact
   version ranges below; existing `peerDependencies` / `peerDependenciesMeta` / `files` / `pi`
   / `scripts` blocks **unchanged**.
2. `package-lock.json` — newly created (none exists today), reflecting the 5 deps + their
   transitive trees.
3. `node_modules/` — populated, containing `defuddle`, `linkedom`, `turndown`,
   `mathml-to-latex`, `temml` and all transitive dependencies.

**Success Definition**: A fresh `npm install` (after editing `package.json`) completes exit 0;
`npm ls defuddle linkedom turndown mathml-to-latex temml` shows all 5 as direct dependencies;
the key entrypoint files `node_modules/defuddle/dist/node.js` and
`node_modules/linkedom/esm/index.js` exist; `npm run typecheck` still passes (no source
change, so it must remain green — this guards against a malformed `package.json`).

---

## Why

- **Business value**: This is the install foundation for the entire `#<url>` feature (PRD
  heading h2.15 "1. Overview & scope", h2.19 "5. Dependencies"). Without these packages
  installed at repo root, the TypeScript that P1.M1.T2.S1 will write (`import { Defuddle }
  from "defuddle/node"`; `import { parseHTML } from "linkedom"`) cannot resolve and the
  test harness cannot run.
- **Why hard `dependencies` and not defuddle's `optionalDependencies`**: defuddle lists
  linkedom/turndown/mathml-to-latex/temml as its OWN `optionalDependencies` (verified in
  `plan/010_8645157f3bf5/architecture/external_deps.md` §1). From *this* package's
  perspective, extraction-without-markdown or extraction-without-a-DOM is a broken feature,
  so they are made **hard, explicit** deps for reliability (PRD h2.19).
- **Why they must be real repo-root `node_modules` entries (not transitive-only)**: the test
  harness `file-injector.test.mjs` loads the extension via jiti with a hand-written `alias`
  map (lines 31–44) that aliases `@earendil-works/*` but does **NOT** alias defuddle/linkedom/
  turndown/mathml-to-latex/temml. Therefore those packages MUST resolve as ordinary
  node_modules lookups from the repo root, i.e. real installed deps. (item_description point 1.)

---

## What

Edit **only** `package.json` (then run `npm install`). No source `.ts` file is touched in
this subtask. No README / docs change (README is P1.M2.T2.S1, a Mode-B final task).

### Exact dependencies block to add

```jsonc
"dependencies": {
  "defuddle": "^0.19.2",
  "linkedom": "^0.18.12",
  "turndown": "^7.2.0",
  "mathml-to-latex": "^1.8.0",
  "temml": "^0.13.3"
}
```

### Success Criteria

- [ ] `package.json` parses as valid JSON (`node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`)
- [ ] `package.json.dependencies` is an object with exactly the 5 keys above and exact ranges
- [ ] `package.json.peerDependencies` still lists the 3 `@earendil-works/*` entries (unchanged)
- [ ] `package.json.peerDependenciesMeta` still marks all 3 as `optional: true` (unchanged)
- [ ] `package.json.files` array still `[ "file-injector.ts", "README.md", "LICENSE" ]` (unchanged)
- [ ] `npm install` exits 0
- [ ] `package-lock.json` exists at repo root
- [ ] `npm ls defuddle linkedom turndown mathml-to-latex temml` lists all 5 as direct deps
- [ ] `node_modules/defuddle/dist/node.js` exists
- [ ] `node_modules/linkedom/esm/index.js` exists
- [ ] `npm run typecheck` still passes (regression guard on package.json validity)

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement
this successfully?_ — **Yes.** This PRP names the exact file (`./package.json`), the exact
JSON block to insert, the exact install command, the exact verification targets, and the
exact blocks that must remain untouched. No inference required.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- url: https://docs.npmjs.com/cli/v10/commands/npm-install
  why: "npm install reads package.json dependencies, writes package-lock.json + node_modules/"
  critical: "Run with NO arguments from the repo root. It installs both dependencies and (by default) optionalDependencies of deps. With no existing lock file it creates one fresh."

- url: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies
  why: "Canonical spec of the 'dependencies' field and semver range syntax (^)"
  critical: "^0.19.2 means >=0.19.2 <0.20.0 (caret on 0.x pins the minor). All 5 ranges below are valid and resolve on the registry."

- file: package.json
  why: "THE file being edited. Currently has NO 'dependencies' block — only peerDependencies (3 @earendil-works/*) and peerDependenciesMeta (all optional)."
  pattern: "Top-level JSON object; blocks in order: name, version, description, author, license, type, main, exports, repository, homepage, bugs, keywords, files, pi, scripts, peerDependencies, peerDependenciesMeta."
  gotcha: "JSON — no trailing commas, no comments (this is real package.json, NOT jsonc). The PRD snippet above uses // comments for illustration ONLY; the actual file MUST be plain JSON."

- file: plan/010_8645157f3bf5/architecture/external_deps.md
  why: "Authoritative research on all 5 packages: versions, shipped .d.ts status, exact API surfaces, the defuddle optionalDependencies -> hard-deps rationale, and the linkedom polyfill gotcha (relevant to M1.T2.S1, not this task)."
  section: "§1 defuddle (esp. 'Dependencies in defuddle's own package.json'), §2 linkedom, §3 turndown, §4 mathml-to-latex, §5 temml"

- file: file-injector.test.mjs
  why: "Lines 31–44 define the jiti alias map that aliases @earendil-works/* but NOT defuddle/linkedom/etc. This is WHY the 5 deps must be real repo-root node_modules entries."
  pattern: "createJiti(import.meta.url, { alias: { '@earendil-works/...': PIPKG + '...' } }) — no defuddle/linkedom keys in this map."
  gotcha: "Do NOT add defuddle/linkedom to this alias map. They must resolve normally from node_modules. The fix is installing them as deps (this task), NOT aliasing them."

- file: .gitignore
  why: "Confirms node_modules/ is already ignored (line 'node_modules/') so the install won't pollute git. package-lock.json is NOT ignored — it SHOULD be committed (standard npm practice)."
```

### Current Codebase tree (verified)

```bash
pi-file-injector-url-injector/
├── .envrc
├── .github/workflows/
├── .gitignore                 # ignores node_modules/ ; does NOT ignore package-lock.json
├── LICENSE
├── README.md
├── diag.mjs
├── file-injector.test.mjs     # lines 31-44: jiti alias map (no defuddle/linkedom keys)
├── file-injector.ts           # the extension source (NOT modified in this subtask)
├── import-behavior.test.mjs
├── package.json               # ← EDIT THIS (add 'dependencies' block)
├── plan/010_8645157f3bf5/
│   ├── architecture/
│   │   ├── external_deps.md   # ← authoritative dep research (§1-5)
│   │   ├── code_map.md
│   │   ├── defuddle-linkedom-research.md
│   │   └── system_context.md
│   ├── tasks.json
│   └── ... (prd snapshot, delta files)
├── relative-imports.test.mjs
├── scripts/typecheck.mjs
├── spec/
└── tsconfig.json
# NOTE: NO package-lock.json and NO node_modules/ currently exist (verified via ls).
```

### Desired Codebase tree with files to be added/modified

```bash
pi-file-injector-url-injector/
├── package.json               # MODIFIED — add top-level "dependencies" block (5 entries)
├── package-lock.json          # CREATED by `npm install` (new file; commit it)
└── node_modules/              # CREATED by `npm install` (gitignored)
    ├── defuddle/              # direct dep — dist/node.js + dist/node.d.ts (types shipped)
    ├── linkedom/              # direct dep — esm/index.js + types/esm/index.d.ts (types shipped)
    ├── turndown/              # direct dep — no own .d.ts (used only transitively by defuddle)
    ├── mathml-to-latex/       # direct dep — used only transitively by defuddle
    ├── temml/                 # direct dep — used only transitively by defuddle
    └── ... (transitive deps: css-select, cssom, html-escaper, htmlparser2, uhyphen via linkedom; etc.)
```

### Known Gotchas of our codebase & Library Quirks

```bash
# CRITICAL: package.json is PLAIN JSON, not jsonc. The PRD h2.19 snippet uses // comments
# for illustration — those MUST NOT appear in the real file or npm install fails with a
# JSON parse error. Strip all comments.

# CRITICAL: JSON does not allow trailing commas. When inserting the dependencies block,
# ensure the preceding block's closing brace/bracket is followed by a comma, and the new
# block has no trailing comma after its last entry.

# GOTCHA: semver caret on 0.x pins the MINOR, not the major.
#   ^0.19.2 -> >=0.19.2 <0.20.0   (defuddle: installs exactly 0.19.2, the latest)
#   ^0.18.12 -> >=0.18.12 <0.19.0 (linkedom: installs 0.18.13, the latest 0.18.x)
#   ^0.13.3 -> >=0.13.3 <0.14.0   (temml: installs 0.13.4, the latest 0.13.x)
#   ^7.2.0 -> >=7.2.0 <8.0.0      (turndown: installs 7.2.4)
#   ^1.8.0 -> >=1.8.0 <2.0.0      (mathml-to-latex: installs 1.8.0)
# So the EXACT installed versions may differ from the pinned floor — that is expected and
# correct. package-lock.json pins the resolved versions.

# GOTCHA: npm 11.x (this repo has npm 11.18.0, node v26.7.0) writes lockfileVersion 3.

# GOTCHA: Do NOT add defuddle/linkedom/turndown/mathml-to-latex/temml to the jiti alias
# map in file-injector.test.mjs. They must resolve via normal node_modules lookup. The
# reason they need to be REAL deps (this task) is precisely so they resolve that way.

# GOTCHA: Do NOT touch the 'files' array. npm resolves dependencies from the registry at
# install time — the 'files' array only governs what is packed into the published tarball,
# not what gets installed into node_modules. The 5 deps are fetched by npm regardless.

# GOTCHA: Do NOT touch peerDependencies / peerDependenciesMeta. The @earendil-works/*
# packages are PROVIDED BY the Pi host runtime (optional peer deps) and must stay optional
# peer deps. They are a separate concern from the npm-fetched extraction runtime deps.

# CRITICAL: This subtask does NOT write any TypeScript import of defuddle/linkedom yet.
# That is P1.M1.T2.S1. If you add `import { Defuddle } from "defuddle/node"` in this
# subtask you are out of scope — keep this purely to package.json + npm install.
```

---

## Implementation Blueprint

### (No data models / no source code in this subtask)

This subtask modifies a JSON manifest and runs an install command only. There are no data
models, services, tools, or TypeScript to author.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT package.json — add the top-level "dependencies" block
  - FILE: ./package.json (repo root)
  - INSERT a new top-level key "dependencies" with exactly these 5 entries:
      "defuddle": "^0.19.2",
      "linkedom": "^0.18.12",
      "turndown": "^7.2.0",
      "mathml-to-latex": "^1.8.0",
      "temml": "^0.13.3"
  - PLACEMENT: flexible. Recommended: insert it immediately AFTER the "keywords" array
    (so the logical grouping is: identity -> keywords -> runtime deps -> peer deps).
    Alternatively after "peerDependenciesMeta". Either is valid; do NOT split existing blocks.
  - PRESERVE byte-for-byte: "name", "version", "description", "author", "license", "type",
    "main", "exports", "repository", "homepage", "bugs", "keywords", "files", "pi",
    "scripts", "peerDependencies", "peerDependenciesMeta".
  - JSON HYGIENE: plain JSON (no // comments, no trailing commas). Ensure a comma separates
    the block before "dependencies" and that "dependencies"'s closing brace is followed by
    a comma if another block follows.
  - FOLLOW pattern: the existing "peerDependencies" block (same shape: object of name->range).

Task 2: VERIFY package.json is valid JSON before installing
  - RUN: node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies))"
  - EXPECT: [ 'defuddle', 'linkedom', 'turndown', 'mathml-to-latex', 'temml' ]
  - If this throws (e.g. "Unexpected token /" or "Unexpected token }"), the JSON is malformed
    (likely a leftover // comment or trailing comma) — fix before proceeding.

Task 3: RUN npm install (creates package-lock.json + node_modules/)
  - COMMAND: npm install
  - RUN FROM: repo root (/home/dustin/projects/pi-file-injector-url-injector)
  - EXPECT: exit code 0; "added N packages" summary; package-lock.json now present.
  - NOTE: node_modules/ is gitignored (.gitignore line 1), so it will not be staged. That is
    correct and expected. package-lock.json is NOT ignored and SHOULD be committed.

Task 4: VERIFY the install (the deliverable acceptance checks)
  - RUN: npm ls defuddle linkedom turndown mathml-to-latex temml
    -> all 5 shown as direct (top-level) deps with resolved versions; exit 0, no "UNMET".
  - RUN: test -f node_modules/defuddle/dist/node.js && echo OK
    -> prints OK (this is the entrypoint that `import { Defuddle } from "defuddle/node"` resolves to).
  - RUN: test -f node_modules/linkedom/esm/index.js && echo OK
    -> prints OK (linkedom runtime entry).
  - RUN: ls node_modules | grep -E '^(defuddle|linkedom|turndown|mathml-to-latex|temml)$'
    -> all 5 names listed.
  - RUN: npm run typecheck
    -> exits 0 (no source changed; this is a regression guard proving package.json is still
       valid and the project's existing typecheck is not broken). NOTE: this is NOT yet
       validating defuddle/linkedom type resolution for our code (that is M1.T1.S4) — here
       it simply confirms we did not break the existing build.

Task 5: COMMIT (hand-off note — actual commit is the orchestrator's job, not this PRP's)
  - Stage: package.json AND package-lock.json (both). Do NOT stage node_modules/ (gitignored).
  - node_modules/ MUST remain unstaged — confirm with `git status` showing it absent.
```

### Implementation Patterns & Key Details

The resulting `package.json` (illustrative — exact whitespace up to the editor, but block
content must match exactly):

```jsonc
{
  "name": "pi-file-injector",
  "version": "0.1.2",
  // ... (description, author, license, type, main, exports, repository, homepage, bugs unchanged) ...
  "keywords": [ /* unchanged */ ],
  "dependencies": {
    "defuddle": "^0.19.2",
    "linkedom": "^0.18.12",
    "turndown": "^7.2.0",
    "mathml-to-latex": "^1.8.0",
    "temml": "^0.13.3"
  },
  "files": [ /* unchanged: file-injector.ts, README.md, LICENSE */ ],
  "pi": { /* unchanged */ },
  "scripts": { /* unchanged */ },
  "peerDependencies": { /* unchanged: 3 @earendil-works/* */ },
  "peerDependenciesMeta": { /* unchanged: all 3 optional */ }
}
```

(Remember: real file is plain JSON — the `//` comments above are for this PRP only.)

### Integration Points

```yaml
NPM / REGISTRY:
  - source: "npm public registry (registry.npmjs.org)"
  - resolves: "defuddle ^0.19.2, linkedom ^0.18.12, turndown ^7.2.0, mathml-to-latex ^1.8.0, temml ^0.13.3"
  - verified-latest: "defuddle 0.19.2, linkedom 0.18.13, turndown 7.2.4, mathml-to-latex 1.8.0, temml 0.13.4"

GIT:
  - stage: "package.json, package-lock.json"
  - ignore: "node_modules/ (already in .gitignore)"
  - do-not-stage: "node_modules/ (verify absent from `git status`)"

NO CHANGES REQUIRED TO (this subtask is out of scope for all of these):
  - "files array — npm fetches deps from the registry at install time, not from files"
  - "peerDependencies / peerDependenciesMeta — Pi host provides @earendil-works/*"
  - "file-injector.test.mjs alias map — defuddle/linkedom resolve via normal node_modules"
  - "any .ts source — imports land in P1.M1.T2.S1"
  - "README.md / docs — README is P1.M2.T2.S1"
```

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Validate package.json is well-formed JSON (must pass before npm install)
node -e "const p=require('./package.json'); \
  console.log('deps:', Object.keys(p.dependencies).sort().join(',')); \
  console.log('peers:', Object.keys(p.peerDependencies).sort().join(',')); \
  console.log('files:', JSON.stringify(p.files));"

# EXPECT deps: defuddle,linkedom,mathml-to-latex,temml,turndown
# EXPECT peers: @earendil-works/pi-ai,@earendil-works/pi-coding-agent,@earendil-works/pi-tui
# EXPECT files: ["file-injector.ts","README.md","LICENSE"]
# If anything differs or this throws -> fix package.json before proceeding.

# Confirm exact ranges (no drift from the contract)
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.dependencies,null,2));"
# EXPECT exactly:
# { "defuddle": "^0.19.2", "linkedom": "^0.18.12", "turndown": "^7.2.0",
#   "mathml-to-latex": "^1.8.0", "temml": "^0.13.3" }
```

### Level 2: Install + Dependency Tree

```bash
# Run the install (creates package-lock.json + node_modules/)
npm install
# EXPECT: exit 0; summary line like "added N packages in Xs".

# Verify all 5 resolve as DIRECT deps
npm ls defuddle linkedom turndown mathml-to-latex temml
# EXPECT: a tree with all 5 at the top level and their transitive children; exit 0; no "UNMET".

# Verify the key entrypoint files exist (these are what later subtasks import)
test -f node_modules/defuddle/dist/node.js && echo "defuddle entry OK"
test -f node_modules/linkedom/esm/index.js && echo "linkedom entry OK"
# EXPECT: both lines printed.
```

### Level 3: Regression (System Validation)

```bash
# The project's existing typecheck gate (scripts/typecheck.mjs). No source changed, so it
# MUST remain green — this proves package.json is still valid and we broke nothing.
npm run typecheck
# EXPECT: exit 0.

# OPTIONAL (does NOT test #<url> — that feature isn't built yet): run the existing model-free
# acceptance harness to confirm the @file feature is unbroken by the manifest change. This is
# a belt-and-suspenders regression check, not a functional gate for THIS subtask.
npm test
# EXPECT: exit 0 (the 14-row matrix all green). Requires the global pi package present
# (file-injector.test.mjs resolves `npm root -g`/`@earendil-works/pi-coding-agent`).
# NOTE: this harness does NOT yet exercise URL injection (that is P1.M2.T1).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Confirm node_modules is gitignored (not staged) and package-lock.json will be committed.
git status --short
# EXPECT: "M  package.json" (or " M package.json") and "?? package-lock.json".
# CRITICAL: node_modules/ must NOT appear here. If it does, .gitignore is broken — STOP.

# Confirm defuddle's own optionalDependencies are now satisfied as hard deps of THIS package
# (sanity: defuddle/node should be importable via node once jiti/bundler resolves it — but
# we do NOT add TS imports in this subtask; this is a plain node require smoke test only):
node -e "import('defuddle/node').then(m => console.log('defuddle/node keys:', Object.keys(m))).catch(e => { console.error('IMPORT FAILED:', e.message); process.exit(1); });"
# EXPECT: prints a list including "Defuddle" (the async function). This confirms the install
# is functional, not just present on disk. (Exit 1 only if the dynamic import throws.)
# NOTE: This is a runtime smoke test of the INSTALL, not of our extension code.
```

---

## Final Validation Checklist

### Technical Validation

- [ ] `package.json` is valid JSON (Task 2 / Level 1 passes)
- [ ] `package.json.dependencies` has exactly the 5 entries with exact ranges
- [ ] `npm install` exit 0 (Task 3)
- [ ] `package-lock.json` created at repo root
- [ ] `npm ls defuddle linkedom turndown mathml-to-latex temml` — all 5 direct, exit 0
- [ ] `node_modules/defuddle/dist/node.js` exists
- [ ] `node_modules/linkedom/esm/index.js` exists
- [ ] `npm run typecheck` exit 0 (Level 3 regression guard)

### Feature Validation

- [ ] Existing `peerDependencies` (3 `@earendil-works/*`) unchanged
- [ ] Existing `peerDependenciesMeta` (all 3 `optional: true`) unchanged
- [ ] `files` array unchanged (`file-injector.ts`, `README.md`, `LICENSE`)
- [ ] No `.ts` source modified (scope boundary respected)
- [ ] No README / docs change (deferred to P1.M2.T2.S1)
- [ ] `node_modules/` not staged by git (gitignored)

### Code Quality Validation

- [ ] `package.json` is plain JSON (no `//` comments, no trailing commas)
- [ ] Block ordering / indentation consistent with the rest of the file
- [ ] `package-lock.json` reflects the 5 direct deps + transitive trees

### Documentation & Deployment

- [ ] No new env vars introduced
- [ ] No README change required (the dependency declaration IS the documentation for this subtask)

---

## Anti-Patterns to Avoid

- ❌ Don't copy the `//` comments from the PRD h2.19 snippet into the real `package.json` — it
  is plain JSON and will fail to parse.
- ❌ Don't add a trailing comma after the last entry in `dependencies`.
- ❌ Don't touch `peerDependencies`, `peerDependenciesMeta`, `files`, `pi`, or `scripts`.
- ❌ Don't add defuddle/linkedom/etc. to the jiti `alias` map in `file-injector.test.mjs` — they
  must resolve via normal node_modules lookup (that's the whole point of this task).
- ❌ Don't write any `import { Defuddle } from "defuddle/node"` or `import { parseHTML } from
  "linkedom"` in this subtask — that is P1.M1.T2.S1.
- ❌ Don't change the `files` array thinking npm needs it to install deps — the `files` array
  only affects the published tarball, not `npm install` resolution.
- ❌ Don't commit `node_modules/` — it is gitignored and must stay out of git.
- ❌ Don't pin exact versions (drop the `^`) "for safety" — the PRD explicitly specifies `^`
  ranges; follow the contract exactly.

---

## Scope Boundaries (respect the plan)

- **IN SCOPE (this subtask)**: edit `package.json` dependencies block; `npm install`; verify.
- **NEXT subtasks (do NOT do here)**:
  - P1.M1.T1.S2 — `FileInjectorConfig` + `enableUrls` field (config).
  - P1.M1.T1.S3 — `URL_INJECT_RE` + `URL_SHAPE_RE` detection regex constants.
  - P1.M1.T1.S4 — typecheck-shim decision: verify `tsc --strict` resolves `defuddle/node` +
    linkedom types (conditional — likely unnecessary, per external_deps.md §1, but verified).
- **DOWNSTREAM**: P1.M1.T2.S1 writes the `injectUrl` pipeline that actually imports
  `defuddle/node` and `linkedom`; it depends on THIS subtask having installed them.

---

## Confidence Score

**9/10** — One-pass success is highly likely. The contract is fully deterministic: exact file,
exact JSON block, exact ranges (all registry-verified to resolve), exact install command, and
exact verification targets. The only residual risk is a JSON syntax slip (comment/trailing
comma), which Level 1 validation catches before `npm install`.