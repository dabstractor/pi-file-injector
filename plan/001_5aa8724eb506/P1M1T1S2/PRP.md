---
name: "P1.M1.T1.S2 — Token parsing & path resolution helpers: cleanToken, expandTildeAndResolve, extOf"
prd_ref: "PRD §4.3 (cleanToken), §4.4 (expandTildeAndResolve), §5.2 (extOf/MIME keys), §3.3 (internal utils), §10 (edge cases), §8 (file structure)"
target_file: "./sharp-at-file.ts"  # EDIT IN PLACE — file created by T1.S1
target_language: TypeScript (jiti transpile-on-load; no tsconfig/package.json/test framework)
depends_on: "P1.M1.T1.S1 (provides imports + FILE_INJECT_RE/MIME_BY_EXT/TRAILING_PUNCT + factory stub)"
consumed_by: "P1.M1.T3.S1 (injectFiles), P1.M1.T2.S1 (no direct use)"
---

# PRP — P1.M1.T1.S2: Parsing & Path-Resolution Helpers

## Goal

**Feature Goal**: Add three **pure, module-scope helper functions** — `cleanToken`,
`expandTildeAndResolve`, `extOf` — to the existing `./sharp-at-file.ts` (created by T1.S1). Together
they form the ordered, I/O-free transform pipeline that T3.S1's `injectFiles` will call once per
`#@<path>` match: raw token → trimmed token → absolute path → lowercased extension.

**Deliverable**: An in-place edit to `./sharp-at-file.ts` adding exactly three **named-exported**
functions positioned between the `TRAILING_PUNCT` constant (from S1) and the `export default function`
factory (from S1). No new files. ~20–25 added lines.

**Success Definition**:
- [ ] `cleanToken(raw: string): string` strips every trailing char present in `TRAILING_PUNCT`
      repeatedly until none remain; returns `""` if fully trimmed; preserves `file.txt`, `~/a/b`,
      `./x`, `../y`; trims trailing `.,;:!?"')]}><`.
- [ ] `expandTildeAndResolve(p: string, cwd: string): string` expands `~` and `~/…` via
      `os.homedir()`, leaves other inputs as-is, then returns `path.resolve(cwd, expanded)`.
      Absolute, `~`, and `../` inputs all resolve correctly (no cwd restriction).
- [ ] `extOf(abs: string): string` returns the lowercased extension (via `path.basename` +
      `lastIndexOf(".")`), or `""` when there is no dot or the only dot is at index 0 (hidden files).
- [ ] All three are `export`-ed (named exports) and loadable via `jiti.import` with Pi's real aliases.
- [ ] The Level-2 assertion suite (25 cases, PRD §10) passes with **zero** model/API key required.
- [ ] Pi's "default export must be a function" loader check still passes (adding named exports does
      NOT break it — verified).

> **Scope boundary:** This subtask adds ONLY these three pure functions. Do NOT implement `isBinary`
> or the `format*Block` helpers (T2.S1), `injectFiles` (T3.S1), or the real handler guards/notify/
> transform (T3.S2). Do NOT touch the imports, constants, or the factory/handler body (S1 owns those).
> Do NOT call `fs.stat`/`fs.readFile`/`resizeImage` here — these helpers are pure and side-effect-free.

## User Persona

**Target User**: The implementing AI agent (and transitively T3.S1, which consumes these helpers, and
the end user who benefits from correct `#@` file injection).

**Use Case**: Foundation layer — no user-facing behavior on its own. Provides the deterministic,
testable transform steps that make T3.S1's assembly logic trivial.

**Pain Points Addressed**: Centralizes the fiddly string/path logic (trailing-punct trimming, tilde
expansion, hidden-file edge case) in isolated, unit-testable pure functions instead of entangling it
with async file I/O in `injectFiles`.

## Why

- **Separation of concerns / testability.** The three steps (trim, resolve, ext) are pure and have
  many edge cases (PRD §10). Isolating them lets us unit-test them with no filesystem, no model, no
  API key — the cheapest, most deterministic validation in the whole milestone.
- **`resolveReadPath` is internal.** Pi's built-in `read` tool resolves paths via the *unexported*
  `resolveReadPathAsync` (`dist/core/tools/read.js:12`, imported from `./path-utils.js` — NOT in
  `dist/index`). Verified: `grep resolveReadPath dist/index.{d.ts,js}` returns nothing. So we
  reimplement the thin tilde-expand step on exported primitives (`os.homedir()` + `path.resolve`)
  per PRD §3.3 — never import from `dist/` internals.
- **Shared with T2/T3 in the same file.** Like the constants from S1, these helpers are consumed by
  T3.S1 within `sharp-at-file.ts` itself, so they live at module scope.

## What

Insert three `export function` declarations into `./sharp-at-file.ts`, between the existing
`const TRAILING_PUNCT = ...;` line and the existing `export default function (pi: ExtensionAPI) {…}`.
They are synchronous, pure, and use only the already-imported `path`/`os` plus the `TRAILING_PUNCT`
constant — **no new imports needed** (S1 already imported `node:path` and `node:os`).

No new files, no package.json, no tsconfig, no test files, no README. The extension remains a single
dependency-free file.

### Success Criteria

- [ ] Three named-exported functions present, in module scope, at the specified insertion point.
- [ ] `cleanToken` handles all 13 PRD §10 cases (see Level-2 gate).
- [ ] `expandTildeAndResolve` handles all 6 cases (tilde alone, `~/…`, absolute, `./…`, `../…`, bare).
- [ ] `extOf` handles all 6 cases (normal ext, hidden-file `""`, no-dot `""`, UPPERCASE→lowercase,
      double-ext last-segment, `.env`→`""`).
- [ ] jiti transpile + default-export check still passes; the 25-case assertion suite is green.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP includes the exact insertion anchors (the S1 tail), the verified
> reason `os.homedir()` must be used directly (resolveReadPath is internal — with grep evidence), the
> exact function bodies to write, the full edge-case matrix, and a reproducible, model-free validation
> gate (25 assertions, all pre-run green in this environment).

### Documentation & References

```yaml
# MUST READ — sibling PRP (the contract this task edits on top of)
- docfile: plan/001_5aa8724eb506/P1M1T1S1/PRP.md
  why: "Defines the exact file ./sharp-at-file.ts that S2 edits: the 6 imports, the 3 module-level
        constants (FILE_INJECT_RE, MIME_BY_EXT, TRAILING_PUNCT), and the factory stub. S2 INSERTS its
        three functions between TRAILING_PUNCT and export default."
  critical: "TRAILING_PUNCT is the 12-char set '.,;:!?\")]}>\x27' (the inner \" is escaped). cleanToken
             reads this constant; do not redefine it."

# MUST READ — verified architecture recon
- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: "§1 InputEvent/Result, §5 ctx.cwd/ctx.hasUI (T3.S2 uses these; S2 only needs cwd via param).
        Confirms NO resolveReadPath export exists — justification for the inline os.homedir() step."
  section: "§3.3 (public vs internal utilities cross-ref) + summary table"

- docfile: plan/001_5aa8724eb506/architecture/system_context.md
  why: "'Canonical Reference Pattern' + Risks table document the matchAll() vs global-regex lastIndex
        rule — upstream of cleanToken (T3.S1 owns regex iteration; S2 only receives m[2])."
  section: "Risks & Mitigations (Global regex lastIndex stale)"

- docfile: plan/001_5aa8724eb506/prd_snapshot.md
  why: "§4.3 = cleanToken spec; §4.4 = expandTildeAndResolve spec; §5.2 = MIME_BY_EXT lowercase keys
        (extOf must lowercase to match); §3.3 = resolveReadPath is internal; §10 = edge-case matrix."
  section: "§3.3, §4.3, §4.4, §5.2, §10"

# PRD source of truth (read-only)
- docfile: PRD.md
  why: "Authoritative spec for the three behaviors. §8 lists the helper group (note: PRD §8 calls the
        helper 'expandTilde'; the WORK ITEM authoritatively names it 'expandTildeAndResolve' — use the
        work-item name)."
  section: "§4.3, §4.4, §5.2, §3.3, §10"
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── .gitignore          # ignores node_modules/, dist/, .pi-subagents/ — NOT .ts
├── PRD.md              # READ-ONLY
├── sharp-at-file.ts    # ← EXISTS after T1.S1 (imports + 3 consts + factory stub). S2 EDITS THIS.
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/{api_verification,system_context,external_deps,extension_patterns}.md
        ├── prd_snapshot.md
        ├── tasks.json      # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T1S1/{PRP.md, research/}
        └── P1M1T1S2/
            ├── research/research_notes.md   # THIS TASK's research (detailed, read it)
            └── PRP.md                       # ← THIS FILE
# NOTE: NO src/, NO package.json, NO tsconfig, NO test framework. Single-file jiti extension.
```

### Desired Codebase tree with files to be added

```bash
# S2 adds NO new files. It edits sharp-at-file.ts in place:
sharp-at-file.ts
  # (S1 region — unchanged)
  #   imports (6)
  #   const FILE_INJECT_RE = ...
  #   const MIME_BY_EXT   = ...
  #   const TRAILING_PUNCT = ...
  # (S2 region — NEW: three named-exported pure helpers)
  + export function cleanToken(raw: string): string { ... }
  + export function expandTildeAndResolve(p: string, cwd: string): string { ... }
  + export function extOf(abs: string): string { ... }
  # (S1 region — unchanged)
  #   export default function (pi: ExtensionAPI) { pi.on("input", ...) }   // stub stays as-is
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Tilde expansion MUST use os.homedir() directly. Pi's read tool uses resolveReadPathAsync
// which is NOT exported (only in dist/core/tools/read.js + dist/core/tools/path-utils.js — internal).
// VERIFIED: `grep resolveReadPath dist/index.d.ts dist/index.js` → no matches. Do NOT import dist/.

// GOTCHA: extOf must LOWERCASE the result. MIME_BY_EXT keys are lowercase (png/jpg/jpeg/gif/webp/bmp).
// A token like Foo.PNG must map to "png" so MIME_BY_EXT[extOf(abs)] hits. Uppercase ext → text path
// (bug). Always .toLowerCase() before returning.

// GOTCHA: extOf's hidden-file rule. path.basename("/x/.bashrc") === ".bashrc"; lastIndexOf('.') === 0.
// Use `if (dot <= 0) return ""` to handle BOTH no-dot (-1) AND dot-at-0 (hidden file) in ONE check.

// GOTCHA: use path.join(os.homedir(), p.slice(2)) for the "~/" case (NOT string concat). The work
// item specifies path.join; it's platform-correct and avoids a double slash if homedir has a trailing /.

// OK: These functions are PURE (no fs, no stat, no readFile). T3.S1 does all I/O AFTER calling them.
// expandTildeAndResolve returns a path string that may not exist — that's fine; T3.S1 stat's it and
// leaves the token verbatim if not a regular file (PRD §4.4.3).

// OK: Named exports alongside a default export are safe. Pi's loader only checks `mod.default` is a
// function (see P1M1T1S1 PRP Level-2 gate). Named exports are ignored by that check — VERIFIED.

// GOTCHA: cleanToken should consume the EXISTING TRAILING_PUNCT constant (don't re-declare or
// hardcode the char list). A while-loop with TRAILING_PUNCT.includes(lastChar) is the DRY, escaping-
// free choice. Do NOT rebuild a regex char-class from it (you'd have to escape `]`).
```

## Implementation Blueprint

### Data models and structure

No data models. The only "types" are the function signatures themselves. All three are synchronous
and return `string`. They use the already-imported `path`/`os` and the `TRAILING_PUNCT` constant —
**no new imports** are required.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT ./sharp-at-file.ts  (single edit; the file already exists from T1.S1)
  - OBJECTIVE: Insert three pure, named-exported helper functions at module scope.
  - INSERT POINT: immediately after the line `const TRAILING_PUNCT = ".,;:!?\")]}>'";`
                  and immediately before the line `export default function (pi: ExtensionAPI) {`.
                  (Both are unique anchors established by S1.)
  - WRITE, in this order, the three functions from "Exact source" below:
      (a) export function cleanToken(raw: string): string { ... }
      (b) export function expandTildeAndResolve(p: string, cwd: string): string { ... }
      (c) export function extOf(abs: string): string { ... }
  - FOLLOW pattern: PRD §4.3 (cleanToken), §4.4 (expandTildeAndResolve), §5.2+hidden-file (extOf).
  - NAMING: EXACT — cleanToken, expandTildeAndResolve, extOf (the work item is authoritative; note
            PRD §8 informally writes "expandTilde" — use the longer work-item name).
  - SIGNATURES: (raw: string): string ; (p: string, cwd: string): string ; (abs: string): string.
  - DEPENDENCIES: const TRAILING_PUNCT (S1), node:path, node:os (both imported by S1). No new imports.
  - PLACEMENT: module scope, between the constants block and the factory. NOT inside the factory.
  - DO NOT (out of scope): isBinary, format*Block (T2.S1); injectFiles, real handler (T3.S1/S2);
        any fs/os stat/read calls; any edit to imports/constants/factory.
  - DO NOT create any new file.
```

### Exact source to write (authoritative — copy verbatim, then run the validation gates)

```typescript
/** PRD §4.3 — trim every trailing char in TRAILING_PUNCT, repeatedly, until none remain. "" if empty. */
export function cleanToken(raw: string): string {
  let s = raw;
  while (s.length > 0 && TRAILING_PUNCT.includes(s[s.length - 1])) {
    s = s.slice(0, -1);
  }
  return s;
}

/** PRD §4.4 — expand leading ~ / ~/ via os.homedir() (resolveReadPath is internal, unexported),
 *  then resolve against cwd. No cwd restriction: absolute, ~, and ../ all allowed. */
export function expandTildeAndResolve(p: string, cwd: string): string {
  let expanded: string;
  if (p === "~") {
    expanded = os.homedir();
  } else if (p.startsWith("~/")) {
    expanded = path.join(os.homedir(), p.slice(2));
  } else {
    expanded = p;
  }
  return path.resolve(cwd, expanded);
}

/** PRD §5.2 — lowercase extension for MIME_BY_EXT lookup, or "" for no-dot / hidden-file (dot at 0). */
export function extOf(abs: string): string {
  const base = path.basename(abs);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ""; // -1 (no dot) OR 0 (hidden file like .bashrc / .env)
  return base.slice(dot + 1).toLowerCase();
}
```

**Why each function is exactly this:**

| Function | Rationale & source |
|---|---|
| `cleanToken` while-loop + `TRAILING_PUNCT.includes` | PRD §4.3 ("repeatedly … until none remain"). Reads the existing constant directly → DRY, zero escaping bugs. A char-class regex alternative must escape `]`; the loop avoids that. Tokens are short → O(n²) is irrelevant. Returns `""` naturally when fully trimmed (PRD §4.3.2: caller skips). |
| `cleanToken` uses `s[s.length-1]` + `.slice(0,-1)` | Standard JS tail char test/trim. ASCII path chars only → no surrogate-pair concern. |
| `expandTildeAndResolve` three branches | Work-item contract verbatim. `p === "~"` → homedir; `p.startsWith("~/")` → `path.join(homedir, rest)`; else passthrough. `~username` falls to else → resolves to a non-existent path → T3.S1 stat-fails → token left verbatim (acceptable; §4.4 only specifies `~`/`~/`). |
| `path.join(os.homedir(), p.slice(2))` | Work-item-authoritative (vs PRD §4.4's `homedir + "/"`). Platform-correct, no double-slash if homedir trails with `/`. `p.slice(2)` drops the `~/`. |
| `return path.resolve(cwd, expanded)` | PRD §4.4.2. Uniform for all cases: when `expanded` is absolute (homedir, `/etc/...`), resolve returns it unchanged (cwd ignored); when relative (`./x`, `../y`, `a.ts`), resolves against cwd. Implements "No cwd restriction" (§4.4.4). |
| `os.homedir()` direct (not resolveReadPath) | `resolveReadPathAsync` is internal-only (dist/core/tools/read.js:12 → ./path-utils.js; NOT in dist/index). VERIFIED by grep. PRD §3.3 mandates reimplementing on exported primitives. |
| `extOf` via `path.basename` + `lastIndexOf(".")` | Work-item contract. `dot <= 0` unifies no-dot (`-1`) and hidden-file (`0`) → both return `""`. `.toLowerCase()` makes `MIME_BY_EXT[extOf(abs)]` hit the lowercase keys (png/jpg/jpeg/gif/webp/bmp). |
| `export function` (named export) | Work item: "Three exported pure functions available to T2.S1 and T3.S1." Enables the model-free Level-2 test gate (import + assert). Does NOT affect Pi's default-export check. |

### Implementation Patterns & Key Details

```typescript
// PATTERN: pure, side-effect-free transform steps. No try/catch needed — none of these throw on
// normal inputs. (cleanToken on undefined would throw, but the caller — T3.S1 — always passes the
// string m[2]. extOf on any string is total: path.basename never throws.)

// PATTERN: the three form an ordered pipeline consumed by T3.S1:
//     const raw = m[2];                              // from matchAll(FILE_INJECT_RE)  [T3.S1]
//     const cleaned = cleanToken(raw);               // -> "" means skip (leave verbatim) [S2]
//     if (cleaned === "") continue;                  // [T3.S1]
//     const abs = expandTildeAndResolve(cleaned, ctx.cwd);  // [S2]
//     const st = await fs.stat(abs);                 // [T3.S1] — not found/dir => leave verbatim
//     const ext = extOf(abs);                        // [S2] — "" or lowercase ext
//     const mime = MIME_BY_EXT[ext];                 // [T3.S1] — undefined => text path

// GOTCHA: do NOT stat/readFile inside these helpers. Purity is what makes them unit-testable
// without a filesystem. All I/O is T3.S1's responsibility.
```

### Integration Points

```yaml
MODULE sharp-at-file.ts (in-place edit; no build step):
  - insertion: "After `const TRAILING_PUNCT = ...;`, before `export default function ...`."
  - new_imports: NONE. `node:path` and `node:os` are already imported by S1.

NO DATABASE / NO CONFIG / NO ROUTES / NO NEW ENV VARS / NO NEW FILES:
  - "Internal helpers. No user-facing, config, or API surface. (PRD §2 Non-Goals: no config.)"

DOWNSTREAM CONSUMERS (do not implement them now — just satisfy their contract):
  - T3.S1 injectFiles: calls cleanToken -> expandTildeAndResolve -> extOf (pipeline above).
  - T2.S1: does NOT use these three (it adds isBinary + format*Block).
```

## Validation Loop

> This project has **no test framework, no linter, no type-checker** (greenfield single-file jiti
> extension). The `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. Use the gates
> below — TypeScript/Pi-specific, **verified working on this machine**, and requiring **no model/API
> key** (the helpers are pure).

### Level 1: Syntax & Placement (Immediate Feedback)

```bash
# 1a. The three functions exist as NAMED EXPORTS at module scope (not nested in the factory).
grep -nE '^export function (cleanToken|expandTildeAndResolve|extOf)' ./sharp-at-file.ts
# Expected: exactly 3 lines, all anchored at column 1 (no leading whitespace) → module scope.

# 1b. They sit BETWEEN the TRAILING_PUNCT const and the factory (insertion point respected).
awk '/const TRAILING_PUNCT/{t=NR} /^export default function/{d=NR}
     /^export function (cleanToken|expandTildeAndResolve|extOf)/{print NR": "$0}' ./sharp-at-file.ts
# Expected: the 3 helper line numbers are all > TRAILING_PUNCT line and < default-export line.

# 1c. No stray new imports were added (S1 already imported path/os).
grep -nE "^import " ./sharp-at-file.ts | wc -l
# Expected: 6 (unchanged from S1).

# 1d. No out-of-scope helpers leaked in (isBinary/format*Block/injectFiles are T2/T3).
grep -nE '\b(isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock|injectFiles)\b' ./sharp-at-file.ts
# Expected: no matches.
```

### Level 2: Transpile + 25-case assertion suite (Component Validation — NON-INTERACTIVE, NO MODEL)

This is the **primary gate**. It (a) proves the file still transpiles + exports a valid factory via
jiti with Pi's real aliases, and (b) imports the three named functions and asserts all PRD §10 edge
cases. **Pre-run in this environment: 25 passed, 0 failed.**

```bash
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./sharp-at-file.ts").href);

// (a) factory still valid
if (typeof mod.default !== "function") { console.error("FAIL: default export not a function"); process.exit(1); }

// (b) three named exports present
for (const n of ["cleanToken","expandTildeAndResolve","extOf"]) {
  if (typeof mod[n] !== "function") { console.error("FAIL: missing export "+n); process.exit(1); }
}
const { cleanToken, expandTildeAndResolve, extOf } = mod;

const cwd = process.cwd();
let pass=0, fail=0;
const eq=(name,got,want)=>{const ok=got===want;console.log((ok?"PASS":"FAIL")+": "+name+" => "+JSON.stringify(got)+(ok?"":" (want "+JSON.stringify(want)+")"));ok?pass++:fail++;};

// cleanToken (PRD §4.3 / §10)
eq("cleanToken file.txt",       cleanToken("file.txt"),     "file.txt");
eq("cleanToken file.txt.",      cleanToken("file.txt."),    "file.txt");
eq("cleanToken file.txt)",      cleanToken("file.txt)"),    "file.txt");
eq("cleanToken ./x",            cleanToken("./x"),          "./x");
eq("cleanToken ~/a/b",          cleanToken("~/a/b"),        "~/a/b");
eq("cleanToken ../y",           cleanToken("../y"),         "../y");
eq("cleanToken empty",          cleanToken(""),             "");
eq("cleanToken all-punct ...",  cleanToken("..."),          "");
eq("cleanToken mid comma a,b",  cleanToken("a,b"),          "a,b");
eq("cleanToken trailing comma", cleanToken("a.txt,"),       "a.txt");
eq("cleanToken trailing quote", cleanToken("x.md\""),       "x.md");
eq("cleanToken bracket ]",      cleanToken("y.md]"),        "y.md");
eq("cleanToken angle >",        cleanToken("z.md>"),        "z.md");

// expandTildeAndResolve (PRD §4.4 / §10)
eq("tilde alone",  expandTildeAndResolve("~", cwd),         os.homedir());
eq("tilde slash",  expandTildeAndResolve("~/notes.md", cwd),path.join(os.homedir(),"notes.md"));
eq("absolute",     expandTildeAndResolve("/etc/hosts", cwd),"/etc/hosts");
eq("relative ./x", expandTildeAndResolve("./x", cwd),       path.resolve(cwd,"x"));
eq("parent ../y",  expandTildeAndResolve("../y", cwd),      path.resolve(cwd,"../y"));
eq("bare name",    expandTildeAndResolve("a.ts", cwd),      path.resolve(cwd,"a.ts"));

// extOf (PRD §5.2 + hidden-file rule)
eq("extOf file.txt",    extOf("/a/b/file.txt"), "txt");
eq("extOf .bashrc",     extOf("/home/d/.bashrc"),"");
eq("extOf no-ext",      extOf("/a/Makefile"),   "");
eq("extOf UPPER->lower",extOf("/a/Foo.PNG"),    "png");
eq("extOf double-ext",  extOf("/a/x.tar.gz"),   "gz");
eq("extOf .env",        extOf("/a/.env"),       "");

console.log("\n"+pass+" passed, "+fail+" failed");
if (fail) process.exit(1);
console.log("PASS: default export is function + 3 named exports + all assertions green");
'
# Expected: prints "PASS: ..." after "25 passed, 0 failed". Exit code 0.
# If it prints FAIL or throws (syntax error, unresolvable import, wrong return): READ the error,
# fix the file, re-run. Common causes: forgot `export`, mis-named function, extOf not lowercasing,
# expandTildeAndResolve using string concat instead of path.join (still passes — but use path.join).
```

### Level 3: Authoritative Pi Loader (System Validation — optional, needs provider only for the turn)

```bash
# Confirms Pi's REAL loader still accepts the edited file. -e loads it; -ne disables discovery so
# ONLY our -e file loads; -p makes it non-interactive. NOTE: -p attempts ONE model turn after load
# — it needs a configured provider. The extension LOADS before any model call; a provider error
# AFTER load does NOT indicate an S2 failure. Level 2 already proves load + behavior.
pi -e ./sharp-at-file.ts -ne -p "helper sanity: #@a.txt" 2>&1 | tee /tmp/pi_s2.log
grep -qiE "error|invalid factory|does not export" /tmp/pi_s2.log && echo "FAIL: load error above" || echo "OK: no load error"
# Expected: no "Extension does not export a valid factory function" / syntax / import errors.
# (The stub still passes #@ through unchanged; real injection is T3.S1/S2.)
```

### Level 4: Pipeline-wiring sanity (forward contract with T3.S1 — READ-ONLY check here)

```bash
# Confirm the three functions + the S1 constants compose into the exact pipeline T3.S1 will call.
# This does NOT run injectFiles (T3.S1); it only verifies the pieces fit: cleanToken output feeds
# expandTildeAndResolve, whose output feeds extOf, and extOf output indexes MIME_BY_EXT.
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./sharp-at-file.ts").href);
// Simulate T3.S1 calling the pipeline for a raw token "pic.PNG)" captured by FILE_INJECT_RE.
const cwd = process.cwd();
const cleaned = mod.cleanToken("pic.PNG)");                       // -> "pic.PNG"
const abs = mod.expandTildeAndResolve(cleaned, cwd);              // -> cwd/pic.PNG
const ext = mod.extOf(abs);                                       // -> "png"  (lowercased!)
console.log("pipeline:", JSON.stringify({cleaned, abs, ext}));
// T3.S1 would now do: MIME_BY_EXT[ext] -> "image/png" (image path). Confirm the lowercase contract:
if (ext !== "png") { console.error("FAIL: extOf must lowercase so MIME_BY_EXT keys hit"); process.exit(1); }
console.log("PASS: pipeline composes; extOf lowercases for MIME_BY_EXT lookup");
'
# Expected: prints {"cleaned":"pic.PNG)","... no — cleaned":"pic.PNG",...} then PASS. Exit 0.
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: 3 `export function` lines grep at column 1; positioned between TRAILING_PUNCT and
      `export default`; import count still 6; no T2/T3 symbols present.
- [ ] Level 2: jiti gate prints `25 passed, 0 failed` then `PASS: ...`. Exit 0.
- [ ] Level 3 (optional, if provider configured): no load error in `pi -e ... -p` output.

### Feature Validation
- [ ] `cleanToken` passes all 13 cases (preserves `file.txt`/`~/a/b`/`./x`/`../y`; trims trailing
      `.,;:!?"')]}><`; `""` for empty/all-punct; does NOT trim mid-string comma).
- [ ] `expandTildeAndResolve` passes all 6 cases (`~`, `~/…`, absolute, `./…`, `../…`, bare name).
- [ ] `extOf` passes all 6 cases (normal ext, hidden-file `""`, no-dot `""`, UPPERCASE→lowercase,
      double-ext last-segment, `.env`→`""`).
- [ ] extOf returns LOWERCASE so `MIME_BY_EXT[extOf(abs)]` resolves (Level-4 confirms).

### Code Quality Validation
- [ ] Three functions at MODULE scope (PRD §8), not nested in the factory.
- [ ] Exact names: `cleanToken`, `expandTildeAndResolve`, `extOf` (work-item-authoritative).
- [ ] Exact signatures: `(raw: string): string`, `(p: string, cwd: string): string`, `(abs: string): string`.
- [ ] Named exports present (enables model-free testing; does not break Pi's default-export check).
- [ ] No new imports added; no new files created; no edits to imports/constants/factory body.
- [ ] No I/O (no fs.stat/readFile/resizeImage) — helpers remain pure.

### Documentation & Deployment
- [ ] No new env vars, config, or user-facing surface (PRD §2: no config).
- [ ] Inline JSDoc on each function cites the PRD section (§4.3/§4.4/§5.2) for the next implementer.

---

## Anti-Patterns to Avoid

- ❌ Don't create any new file — edit `./sharp-at-file.ts` in place (it already exists from S1).
- ❌ Don't add new imports — `node:path` and `node:os` are already imported by S1.
- ❌ Don't touch the imports, the three constants, or the factory/handler body — S1 owns those.
- ❌ Don't implement `isBinary`/`format*Block` (T2.S1), `injectFiles` (T3.S1), or the real handler
  (T3.S2) here. Adding them now violates scope and risks collision with those subtasks.
- ❌ Don't put `fs.stat`/`fs.readFile`/`resizeImage` in these helpers — they must stay pure so they're
  unit-testable without a filesystem.
- ❌ Don't import `resolveReadPath`/`resolveReadPathAsync` from `dist/...` — it's internal/unexported
  (verified by grep). Use `os.homedir()` + `path.resolve()` directly (PRD §3.3).
- ❌ Don't forget to `.toLowerCase()` in `extOf` — uppercase extensions would miss the lowercase
  `MIME_BY_EXT` keys and wrongly route images to the text path.
- ❌ Don't rebuild TRAILING_PUNCT as a regex char-class inside `cleanToken` (you'd have to escape `]`).
  Use the existing constant via `.includes()` in a while-loop.
- ❌ Don't name the resolver just `expandTilde` (PRD §8's informal label) — the work item
  authoritatively names it `expandTildeAndResolve`.
- ❌ Don't drop the `export` keyword to "keep it clean" — the work item requires exported functions,
  and the export is what enables the model-free Level-2 test gate.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: The task is small (~20 lines of pure logic), every function body is given verbatim, all
edge cases are enumerated and **empirically pre-verified** (25/25 green in this environment via the
exact Level-2 script), the `resolveReadPath`-is-internal claim is backed by grep evidence, the
insertion anchors are unique and established by the sibling S1 PRP, and the validation gate is
fully non-interactive (no model/API key needed). Residual risk: a transcription slip (e.g., dropping
`export`, or forgetting `.toLowerCase()`) — fully caught by Level-1 grep + the 25-assertion suite.
