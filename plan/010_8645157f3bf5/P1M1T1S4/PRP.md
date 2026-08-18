# PRP — P1.M1.T1.S4: Typecheck-shim decision (verify tsc --strict resolves defuddle/node + linkedom types)

---

## Goal

**Feature Goal**: Empirically verify — against the **actually-installed** packages
(deps from P1.M1.T1.S1, Complete) — that `tsc --strict` with
`moduleResolution: "Bundler"` (the exact config `scripts/typecheck.mjs` writes)
resolves the `defuddle/node` and `linkedom` type specifiers, and **decide** between
two contract branches:

- **(a) CLEAN** — types resolve natively → do NOT create a shim; document
  "none — types resolve natively".
- **(b) TS7016** — a declaration file is missing → create `declarations.d.ts` at
  repo root with faithful module declarations and wire it into the typecheck path.

**Deliverable**: A verified decision. Because the research for this PRP **already
ran the verification** on the installed packages and proved Outcome **(a)**, the
expected deliverable is: **no source change** + a one-file decision record
(`plan/010_8645157f3bf5/P1M1T1S4/research/typecheck-decision.md`) confirming the
outcome. The full Outcome-(b) remediation is specified below as insurance so the
implementing agent never blocks if the environment differs.

**Success Definition**:
- `npm run typecheck` exits 0 today (baseline — trivially true, see Gotcha).
- The **forward-looking minimal probe** (§Validation Level 1) compiles to **0 errors**
  — this is the actual test, because `file-injector.ts` does not import these
  packages yet (imports arrive in P1.M1.T2.S1).
- No `TS7016` for either specifier → Outcome (a) confirmed → **no `declarations.d.ts`
  created**.
- Decision record file written with the verdict.
- (Conditional) If `TS7016` unexpectedly appears → `declarations.d.ts` created with
  the verified shapes + wired into `scripts/typecheck.mjs`, and `npm run typecheck`
  re-passes at 0 errors.

## User Persona

**Target User**: The P1.M1.T2.S1 implementer (who adds `import { Defuddle } from
"defuddle/node"` and `import { parseHTML } from "linkedom"` to `file-injector.ts`)
and downstream maintainers.
**Use Case**: T2.S1 needs certainty that adding those imports will NOT break the
`prepublishOnly`-gated `npm run typecheck` (the CI gate). This task removes that
risk ahead of time.
**Pain Points Addressed**: Eliminates the "will-the-types-resolve?" unknown before
the import line is written; prevents a last-minute typecheck break blocking the
URL pipeline.

## Why

- **De-risk the import step**: P1.M1.T2.S1 adds the only two new bare-specifier
  imports in the whole feature. If they failed to resolve, the CI typecheck gate
  (`prepublishOnly`) would break and block shipping. Verifying *now* (before T2)
  makes T2 a pure additive wiring task.
- **Both packages advertise types**: `defuddle` ships `exports['./node'].types` +
  `typesVersions`; `linkedom` ships `exports['.'].types` + top-level `types`.
  `moduleResolution: "Bundler"` honors the `exports` map → resolution is expected to
  succeed. But "expected" is not "verified" — the contract requires empirical proof.
- **Avoid an unnecessary shim file**: a `declarations.d.ts` that shadows real
  upstream `.d.ts` would drift from the real API and mask future type errors. Proving
  native resolution keeps the repo shim-free.

## What

This is a **verification + decision** task. No runtime behavior. No detection logic.
The agent runs two type checks, observes the result, and either (a) documents "no
shim" or (b) creates and wires a shim. **Expected (and already-proven) result: (a).**

### Success Criteria

- [ ] `npm run typecheck` exits 0 (baseline confirmed).
- [ ] The forward-looking minimal probe (exact commands in Validation Level 1)
      compiles to **0 errors** under TS 5.6 + `moduleResolution: "Bundler"` + `--strict`.
- [ ] Decision record `plan/010_8645157f3bf5/P1M1T1S4/research/typecheck-decision.md`
      exists and states the verdict + the two tsc exit codes observed.
- [ ] IF Outcome (a) (expected): `declarations.d.ts` does NOT exist at repo root;
      `git status` shows NO modified source files (only the new decision-record file
      under `plan/...`).
- [ ] IF Outcome (b) (unexpected): `declarations.d.ts` exists at repo root, is wired
      into `scripts/typecheck.mjs`'s temp-tsconfig `files` array (or via a
      `/// <reference path="declarations.d.ts" />` at the top of `file-injector.ts`),
      and `npm run typecheck` re-passes at 0 errors.

## All Needed Context

### Context Completeness Check

_Pass._ "If someone knew nothing about this codebase, would they have everything
needed?" — **Yes.** The exact probe source, the exact temp-tsconfig, the exact TS
invocation, the verified package.json exports maps, the real `.d.ts` API shapes,
and the complete fallback shim are all given verbatim below. The task requires no
domain inference — only running commands and observing exit codes.

### Documentation & References

```yaml
- file: scripts/typecheck.mjs
  why: THE typecheck path. Writes a temp tsconfig (moduleResolution "Bundler", strict true, skipLibCheck true) with files: [<repo>/file-injector.ts] and paths ONLY for @earendil-works/pi-* — it does NOT add paths for defuddle/linkedom, so those resolve NATIVELY from node_modules via the exports map.
  pattern: |
    compilerOptions: { target ES2022, module ESNext, moduleResolution "Bundler",
      noEmit true, strict true, skipLibCheck true, allowImportingTsExtensions true }
    files: [path.join(ROOT, "file-injector.ts")]
  gotcha: |
    The temp tsconfig is regenerated on every run. If a shim IS needed, either add
    "declarations.d.ts" to this files array OR add /// <reference path="declarations.d.ts" />
    at the TOP of file-injector.ts (the latter needs no script change — preferred).

- file: tsconfig.json
  why: Editor/LSP hints only (NOT used by npm run typecheck — the script writes its own temp tsconfig). Documents the intended compiler options. Already lists "files": ["file-injector.ts"].
  gotcha: Editing THIS file does NOT affect `npm run typecheck`. Do not rely on it for the shim wiring; wire into scripts/typecheck.mjs (temp files array) or via the triple-slash reference in file-injector.ts.

- file: package.json
  why: Confirms the 5 deps are hard "dependencies" (installed by S1) and that "prepublishOnly": "npm run typecheck" makes typecheck the publish/CI gate. "type": "module", "main": "./file-injector.ts".
  gotcha: defuddle/linkedom/turndown/mathml-to-latex/temml are REAL node_modules deps (not aliased like the pi-* peers), so tsc node-walk finds them.

- docfile: plan/010_8645157f3bf5/architecture/external_deps.md
  why: Authoritative verification of the exports/types maps and the real API shapes (defuddle/node + linkedom). Section "Typecheck Impact (for M1.T1.S4)" concludes "npm run typecheck passes WITHOUT a shim ... verify after install."
  section: "## 1. defuddle (TypeScript Declarations)" + "## 2. linkedom" + "## Typecheck Impact"

- docfile: plan/010_8645157f3bf5/P1M1T1S4/research/notes.md
  why: The empirical proof ALREADY RUN for this PRP: --traceResolution excerpts proving both specifiers resolve natively, plus the minimal probe compiling to 0 errors, plus the real .d.ts shapes. The implementing agent's job is to CONFIRM this (re-run the probe), not re-derive it.

- docfile: plan/010_8645157f3bf5/P1M1T1S3/PRP.md
  why: PARALLEL sibling. Adds URL_INJECT_RE + URL_SHAPE_RE constants to file-injector.ts. Does NOT touch imports or the typecheck path → no conflict with S4 (S4 adds no source code under Outcome a).

# Verified package facts (the resolution mechanism):
# defuddle 0.19.2: exports["./node"].types = "./dist/node.d.ts" + typesVersions{"node":["dist/node.d.ts"]}
# linkedom 0.18.13: exports["."].types = "./types/esm/index.d.ts" + top-level "types": "./types/index.d.ts"
# moduleResolution "Bundler" reads exports[].types → both resolve to real .d.ts (no TS7016).
```

### Current Codebase tree (the files this task touches)

```bash
.
├── file-injector.ts          # NOT modified under Outcome (a). NO defuddle/linkedom imports today.
├── scripts/
│   └── typecheck.mjs         # NOT modified under Outcome (a). (Modified only under Outcome (b).)
├── tsconfig.json             # NOT modified. (Editor hints only; not run by npm run typecheck.)
├── package.json              # NOT modified. (S1 already added the deps + installed them.)
├── node_modules/
│   ├── defuddle/             # PRESENT (S1). dist/node.d.ts + dist/types.d.ts ship.
│   └── linkedom/             # PRESENT (S1). types/esm/index.d.ts ships.
└── plan/010_8645157f3bf5/P1M1T1S4/
    ├── PRP.md                # THIS file.
    ├── research/
    │   ├── notes.md          # (exists) the research record w/ the empirical proof.
    │   └── typecheck-decision.md   # ← CREATED by this task (Outcome a deliverable).
```

### Desired Codebase tree

```bash
# Under the EXPECTED Outcome (a) — the ONLY new artifact:
plan/010_8645157f3bf5/P1M1T1S4/research/typecheck-decision.md   # NEW — verdict + observed exit codes

# Under the UNEXPECTED Outcome (b) — add ALSO:
# declarations.d.ts              # NEW at repo root (faithful module declarations)
# (and either edit scripts/typecheck.mjs files[] OR add /// <reference> to file-injector.ts)
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL: A clean `npm run typecheck` TODAY proves NOTHING about defuddle/linkedom,
// because file-injector.ts does not yet import them (grep confirms zero matches).
// The MEANINGFUL test is the forward-looking minimal probe (Validation Level 1),
// which adds the imports in a throwaway file placed AT THE REPO ROOT (so tsc's
// node-walk finds node_modules) and runs the SAME compiler options. That probe's
// exit code is the decision's real evidence.

// CRITICAL: The probe file MUST live at the repo root (or under it) for tsc's
// node-walk to find node_modules/defuddle + node_modules/linkedom. A probe in /tmp
// will NOT find them. The temp tsconfig can live in /tmp but its "files" entry must
// be the ABSOLUTE repo-root path of the probe.

// CRITICAL: Do NOT add a `paths` mapping for defuddle/linkedom in the probe tsconfig.
// Doing so would ARTIFICIALLY force resolution and invalidate the test — the whole
// point is to verify NATIVE exports-map resolution. paths for @earendil-works/pi-*
// (as the real typecheck script does) is fine; paths for defuddle/linkedom is NOT.

// GOTCHA: skipLibCheck:true (set by the real script) means defuddle/linkedom's OWN
// .d.ts are not deeply checked — only consumer usage is. So a clean probe proves the
// specifier RESOLVES; it does not prove defuddle's .d.ts are internally perfect
// (that is defuddle's problem, not ours).

// GOTCHA: TS 5.6 is what scripts/typecheck.mjs pins (`npx -p typescript@5.6`). Use
// the SAME version in the probe so the result matches what CI will see.

// GOTCHA: linkedom's parseHTML signature is parseHTML(html: any, globals?: any):
// Window & typeof globalThis — it does NOT accept { url }. Setting document.URL = url
// AFTER parsing is the correct pattern (architecture/external_deps.md). This is a
// P1.M1.T2.S1 concern, NOT S4 — the probe deliberately omits the polyfill line so
// its 0-error result is unambiguous. (An exploratory probe WITH `doc.styleSheets = []`
// produced a spurious TS2741 — a consumer-code type error, NOT TS7016, and irrelevant
// to the resolution decision.)

// GOTCHA: tsconfig.json is editor-only; npm run typecheck ignores it. Do not wire a
// shim via tsconfig.json "include" — wire via scripts/typecheck.mjs temp files[] OR
// via a /// <reference> at the top of file-injector.ts.
```

## Implementation Blueprint

### Data models and structure

None. No models, no state, no runtime code. (Outcome (b) would add ambient
`declare module` declarations only.)

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: BASELINE — confirm npm run typecheck is green today
  - RUN: npm run typecheck
  - EXPECT: exit 0, prints "typecheck: file-injector.ts type-checks clean under --strict (0 errors)"
  - NOTE: this is trivially true (no imports yet) — it only proves the toolchain works,
    NOT that defuddle/linkedom resolve. Task 2 is the real test.
  - IF it fails: the failure is UNRELATED to defuddle/linkedom (no such imports exist).
    Do NOT attribute it to this task — investigate the actual error (likely a missing
    global pi install; see S3 PRP Level 2 note) before continuing.

Task 2: DECISION EVIDENCE — run the forward-looking minimal probe (the real test)
  - CREATE a throwaway file at REPO ROOT named __probe_types__.ts with EXACTLY this content:
        import { Defuddle, type DefuddleResponse, type DefuddleOptions } from "defuddle/node";
        import { parseHTML } from "linkedom";
        export async function probe(html: string, url: string): Promise<DefuddleResponse> {
          const { document } = parseHTML(html);
          const opts: DefuddleOptions = { markdown: true, url };
          return Defuddle(document, url, opts);
        }
  - CREATE a temp tsconfig (in $(mktemp -d)) mirroring scripts/typecheck.mjs EXACTLY,
    with files: ["<ABSOLUTE repo-root path>/__probe_types__.ts"] and NO paths for
    defuddle/linkedom (baseUrl = repo root). See "Probe harness" below for the exact script.
  - RUN: npx --yes -p typescript@5.6 tsc -p <temp-tsconfig> --noEmit
  - OBSERVE the exit code and any TS error codes:
      * exit 0  → Outcome (a): types resolve natively. GO TO Task 3a.
      * TS7016 ("Could not find a declaration file for module 'defuddle/node'" or '...linkedom')
                → Outcome (b): shim required. GO TO Task 3b.
      * any OTHER TS error (e.g. TS2xxx/TS27xx type errors) → re-check the probe source;
        the probe content above is verified to compile clean. If you edited it, revert.
        A non-7016 error is NOT a resolution failure and does NOT trigger the shim.
  - CLEANUP: rm __probe_types__.ts and the temp tsconfig dir IMMEDIATELY (repo must be pristine).

Task 3a: OUTCOME (a) — NO SHIM  [EXPECTED — already proven by this PRP's research]
  - DO NOT create declarations.d.ts.
  - DO NOT modify file-injector.ts, scripts/typecheck.mjs, or tsconfig.json.
  - WRITE the decision record (Task 4).
  - DONE.

Task 3b: OUTCOME (b) — SHIM  [UNEXPECTED — insurance only]
  - PRECONDITION: Task 2 produced TS7016 for defuddle/node and/or linkedom.
  - CREATE declarations.d.ts at REPO ROOT with the faithful declarations below
    ("Fallback shim content"). Use the REAL shapes (already captured in
    research/notes.md §4) — do NOT guess.
  - WIRE the shim into the typecheck path. PREFERRED (no script edit): add as the FIRST
    line of file-injector.ts:
        /// <reference path="declarations.d.ts" />
    (tsc picks up referenced .d.ts automatically; works for both the real script and editors.)
    ALTERNATIVE (edit the script): in scripts/typecheck.mjs, change
        files: [path.join(ROOT, "file-injector.ts")]
    to
        files: [path.join(ROOT, "file-injector.ts"), path.join(ROOT, "declarations.d.ts")]
  - ONLY declare the module(s) that actually hit TS7016 (defuddle/node and/or linkedom).
    Never declare turndown/mathml-to-latex/temml (not imported directly).
  - RE-RUN npm run typecheck → MUST exit 0.
  - WRITE the decision record (Task 4), noting Outcome (b) + which specifiers needed shimming.

Task 4: DOCUMENT — write the decision record (ALWAYS, both outcomes)
  - FILE: plan/010_8645157f3bf5/P1M1T1S4/research/typecheck-decision.md
  - CONTENT (keep it short, factual):
      * Outcome: (a) CLEAN — no shim  OR  (b) shim created for [...]
      * Evidence: the two exit codes observed (Task 1 baseline, Task 2 probe).
      * Verdict line: "defuddle/node resolves natively: YES/NO (via exports map under Bundler)"
        and the same for linkedom.
      * If (a): "declarations.d.ts NOT created — types resolve natively."
      * If (b): list the file(s) changed (declarations.d.ts, file-injector.ts top line / typecheck.mjs).
  - This file IS the [Mode A] "docs ride with the work" deliverable for this task.
```

### Probe harness (exact, copy-pasteable — used by Task 2)

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"   # repo root
REPO="$(pwd)"
cat > "$REPO/__probe_types__.ts" <<'EOF'
import { Defuddle, type DefuddleResponse, type DefuddleOptions } from "defuddle/node";
import { parseHTML } from "linkedom";
export async function probe(html: string, url: string): Promise<DefuddleResponse> {
  const { document } = parseHTML(html);
  const opts: DefuddleOptions = { markdown: true, url };
  return Defuddle(document, url, opts);
}
EOF
TMPDIR="$(mktemp -d)"
cat > "$TMPDIR/tsconfig.json" <<EOF
{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","noEmit":true,"strict":true,"skipLibCheck":true,"allowImportingTsExtensions":true,"baseUrl":"$REPO"},"files":["$REPO/__probe_types__.ts"]}
EOF
npx --yes -p typescript@5.6 tsc -p "$TMPDIR/tsconfig.json" --noEmit
echo "probe tsc exit: $?"
rm -f "$REPO/__probe_types__.ts"; rm -rf "$TMPDIR"
# EXPECTED (Outcome a): exit 0, no output. A TS7016 line → Outcome (b).
```

### Fallback shim content (Outcome b ONLY — faithful to the real .d.ts)

If Task 2 ever yields `TS7016`, create `declarations.d.ts` at repo root with ONLY the
module(s) that errored. These declarations match the **actual installed** `.d.ts`
shapes (see `research/notes.md §4`):

```ts
// declarations.d.ts — ONLY if TS7016 occurs (Outcome b). Do NOT create under Outcome (a).

// Needed only if `defuddle/node` hit TS7016:
declare module "defuddle/node" {
  export interface DefuddleMetadata {
    title: string; description: string; domain: string; favicon: string; image: string;
    language: string; parseTime: number; published: string; author: string; site: string;
    schemaOrgData: unknown; wordCount: number;
  }
  export interface DefuddleResponse extends DefuddleMetadata {
    content: string;
    contentMarkdown?: string;
    extractorType?: string;
    metaTags?: { name?: string | null; property?: string | null; content: string | null }[];
    debug?: { contentSelector: string; removals: { step: string; selector?: string; reason?: string; text: string }[] };
    profile?: Record<string, number>;
    variables?: { [key: string]: string };
  }
  export interface DefuddleOptions {
    markdown?: boolean; url?: string; useAsync?: boolean; separateMarkdown?: boolean;
    removeImages?: boolean; debug?: boolean; contentSelector?: string; language?: string;
    includeReplies?: boolean | "extractors"; profile?: boolean;
    fetch?: typeof globalThis.fetch;
    // (non-exhaustive — add fields as file-injector.ts uses them)
  }
  export function Defuddle(
    input: Document | string | { window: { document: Document; location: { href: string } } },
    url?: string,
    options?: DefuddleOptions
  ): Promise<DefuddleResponse>;
  export { DefuddleClass } from ...; // omit unless used; DefuddleClass is not needed by this package
}

// Needed only if `linkedom` hit TS7016 (very unlikely — linkedom ships types):
declare module "linkedom" {
  export function parseHTML(html: string, globals?: any): Window & typeof globalThis;
  // add DOMParser, Event, etc. only if file-injector.ts imports them
}
```

> Prefer the **non-exhaustive** form (`declare module "defuddle/node";` with no body)
> only as a last resort — a bodyless declaration types everything as `any`, defeating
> `--strict`. The typed form above is strongly preferred and matches the real API.

### Integration Points

```yaml
IMPORTS: none added under Outcome (a). Outcome (b) adds /// <reference> OR a temp-tsconfig files entry — NOT a runtime import.
DATABASE: none.
CONFIG: none.
ROUTES: none.
REGISTRY: none.
DOWNSTREAM CONSUMER: P1.M1.T2.S1 (adds the real imports to file-injector.ts). It reads THIS task's decision record to know the imports are safe to add. Under Outcome (a) T2.S1 adds the imports as-is; under (b) it relies on the shim already in place.
```

## Validation Loop

### Level 1: Syntax & Style (the DECISION gate — run first)

```bash
# (1) Baseline typecheck (trivially clean; proves toolchain).
npm run typecheck
# Expected: exit 0.

# (2) THE decision evidence — the forward-looking minimal probe.
#     Run the exact "Probe harness" block above. Expected (Outcome a): exit 0, no output.
#     A TS7016 line for defuddle/node or linkedom → Outcome (b); follow Task 3b.
```

### Level 2: Unit Tests (no test code added — confirm existing suites still green)

```bash
# This task adds NO tests and NO source code under Outcome (a). Run the existing suites
# to prove nothing regressed (relevant only under Outcome (b), where file-injector.ts
# gains a /// <reference> line — the test harness loads via jiti, which ignores it).
npm test
# Expected: exit 0 (file-injector.test.mjs && import-behavior.test.mjs && relative-imports.test.mjs).
# (Requires the global pi package for the jiti loader. If `npm test` fails ONLY due to a
# missing global pi, `npm run typecheck` remains the authoritative gate — see S3 PRP Level 2.)
```

### Level 3: Integration Testing (the publish/CI gate)

```bash
# The real gate this task protects: prepublishOnly runs typecheck.
npm run typecheck
# Expected: exit 0 BOTH today AND after P1.M1.T2.S1 adds the imports (the probe in
# Level 1 is what proves the post-import state ahead of time).
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Optional: re-confirm NATIVE resolution (not paths-shimmed) by tracing one specifier.
# Reuse the Probe harness but append "--traceResolution" and grep for the resolution line:
npx --yes -p typescript@5.6 tsc -p "$TMPDIR/tsconfig.json" --noEmit --traceResolution 2>&1 \
  | grep -E "Module name 'defuddle/node' was successfully resolved|Module name 'linkedom' was successfully resolved"
# Expected (Outcome a): BOTH lines present, pointing at node_modules/.../*.d.ts.
# Their presence = native exports-map resolution succeeded = the decision is (a).
# (This exact trace is already captured in research/notes.md §3 — re-running is a confirmation only.)
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` exits 0 (Task 1 baseline).
- [ ] Forward-looking minimal probe (Task 2) exits 0 / or yields a clear TS7016.
- [ ] Decision recorded in `plan/010_8645157f3bf5/P1M1T1S4/research/typecheck-decision.md`.

### Feature Validation (Outcome a — expected)
- [ ] `declarations.d.ts` does NOT exist at repo root.
- [ ] `git status` shows NO modified source files (file-injector.ts / typecheck.mjs / tsconfig.json / package.json untouched).
- [ ] Only new file is `research/typecheck-decision.md` (under plan/, which is plan-managed).

### Feature Validation (Outcome b — unexpected, if triggered)
- [ ] `declarations.d.ts` exists at repo root with faithful shapes (real API, not `any`).
- [ ] Shim wired: `/// <reference path="declarations.d.ts" />` at top of file-injector.ts OR `declarations.d.ts` added to `scripts/typecheck.mjs` temp-tsconfig `files`.
- [ ] `npm run typecheck` re-exits 0 WITH the shim in place.
- [ ] Only the specifier(s) that hit TS7016 are declared (never turndown/mathml-to-latex/temml).

### Code Quality Validation
- [ ] No guesswork: API shapes in any shim match `research/notes.md §4` (verified from real `.d.ts`).
- [ ] Repo left pristine after the probe (throwaway `__probe_types__.ts` + temp tsconfig removed).
- [ ] The probe used TS 5.6 and `moduleResolution: "Bundler"` with NO `paths` for defuddle/linkedom (native-resolution test, not an artificial pass).

### Documentation & Deployment
- [ ] Decision record is self-contained (states outcome + the exit codes observed + per-specifier verdict).
- [ ] P1.M1.T2.S1's implementer can read the decision record and proceed without re-verifying.

---

## Anti-Patterns to Avoid

- ❌ Don't treat a clean `npm run typecheck` TODAY as proof the types resolve — `file-injector.ts` has no defuddle/linkedom imports yet. The forward-looking probe (Task 2) is the real evidence.
- ❌ Don't put the probe in `/tmp` — tsc won't find `node_modules`. Put it at the repo root (absolute path) and clean it up immediately.
- ❌ Don't add a `paths` mapping for `defuddle`/`linkedom` in the probe tsconfig — that bypasses native exports-map resolution and makes the test meaningless.
- ❌ Don't create `declarations.d.ts` "just in case" under Outcome (a). A shim that shadows real upstream `.d.ts` drifts from the real API and masks future type errors. Outcome (a) = no shim.
- ❌ Don't wire a shim via `tsconfig.json` — `npm run typecheck` ignores it (it writes its own temp tsconfig). Wire via `scripts/typecheck.mjs` `files[]` OR a `/// <reference>` at the top of `file-injector.ts`.
- ❌ Don't use bodyless `declare module "x";` if a typed form is feasible — it types everything as `any`, defeating `--strict`. Use the faithful typed form in "Fallback shim content".
- ❌ Don't declare turndown / mathml-to-latex / temml — they are transitive-only (never imported directly), so they can never hit TS7016 in our code.
- ❌ Don't touch the URL_INJECT_RE/URL_SHAPE_RE region of `file-injector.ts` (parallel sibling P1.M1.T1.S3 owns it). Under Outcome (a) you touch NO source; under (b) the only edit is a top-of-file `/// <reference>` line — text-disjoint from S3's regex block.

---

## Confidence Score

**9.5 / 10** for one-pass success. The decision is **already empirically proven** by this
PRP's research (both specifiers resolve natively → Outcome (a) → no source change). The
implementing agent's job reduces to *confirming* two exit codes and writing a one-file
record. The full Outcome-(b) remediation is specified verbatim as insurance, so even the
unexpected branch is unblocked in one pass. The only residual risk is environmental (e.g. a
different TS version or a corrupted node_modules) — which the Level 4 trace + the explicit
TS-5.6 pin guard against.

## Parallel-Safety Note (for the orchestrator / merger)

- **vs P1.M1.T1.S3** (regex constants, "Implementing" in parallel): S3 edits the
  `BARE_AT_RE`→`MIME_BY_EXT` region of `file-injector.ts`. Under **Outcome (a)**
  (expected), S4 touches **no** source file → zero overlap, zero conflict, either order.
  Under **Outcome (b)** (unexpected), S4's only `file-injector.ts` edit is a single
  `/// <reference>` line at the **top** of the file — text-disjoint from S3's regex block,
  merges cleanly.
- **vs P1.M1.T1.S1/S2** (deps, config — both Complete): S4 only reads their outputs
  (installed node_modules; the `enableUrls` config is irrelevant to type resolution).
  No interaction.