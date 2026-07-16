---
name: "P1.M1.T1.S1 — Extension file scaffold: imports, constants, factory stub"
prd_ref: "PRD §7 (Technical Reference), §8 (File Structure), §4.2/§5.2/§4.3 (constants), Appendix A (Minimal skeleton)"
target_file: "./file-injector.ts"
target_language: TypeScript (jiti transpile-on-load, no tsconfig/package.json)
---

# PRP — P1.M1.T1.S1: Extension File Scaffold

## Goal

**Feature Goal**: Create the loadable single-file Pi extension scaffold `./file-injector.ts` containing the **complete import surface** (PRD §7), the **three module-level constants** (`FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT`), and a **factory stub** (Appendix A) that registers an `input` handler currently returning `{ action: "continue" }` (pure pass-through). This establishes the shared module-level structure that every subsequent subtask (S2 parsing helpers, T2 format helpers, T3 `injectFiles` + real handler) builds upon **in the same file**.

**Deliverable**: One new file at `./file-injector.ts` (project root: `/home/dustin/projects/pi-file-injector/file-injector.ts`), approximately 25–30 lines. Pi must be able to import it without errors (`pi -e ./file-injector.ts`), and its default export must be a function `(pi: ExtensionAPI) => void`.

**Success Definition**:
- [ ] File `./file-injector.ts` exists at the project root.
- [ ] The six import statements appear verbatim exactly as specified (§7) — no additions, no omissions, no reordering of the two type-only imports above their value-import counterparts.
- [ ] `FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT` are declared `const` at **module scope** (not inside the factory) with the exact verified values.
- [ ] Default export is `function (pi: ExtensionAPI)` that calls `pi.on("input", async (event, ctx) => { return { action: "continue" }; })`.
- [ ] `pi` can import the file via jiti with **zero errors**; default export is `typeof === "function"`.
- [ ] A prompt containing `#@somefile.txt` passes through **byte-for-byte unchanged** (stub does nothing yet — real injection is T3.S1/S2).

> **Scope boundary (read carefully):** This subtask produces ONLY the scaffold. Do NOT implement `cleanToken`, `expandTildeAndResolve`, `extOf` (S2), `isBinary` / `format*Block` helpers (T2.S1), `injectFiles` (T3.S1), or the real handler guards/notify/transform (T3.S2). Those later subtasks edit THIS SAME FILE in place, filling in the structure the scaffold establishes.

## User Persona

**Target User**: The implementing AI agent (and, transitively, the end user who will load the finished extension).

**Use Case**: Foundation artifact — no user-facing behavior yet. The scaffold exists so that the moment it is written, the extension is loadable and provably harmless (pass-through), and subsequent subtasks have a stable, typed module shell to extend.

## Why

- **Establishes the single-file module shell.** PRD §8 mandates one file (`file-injector.ts`) with five internal sections. The scaffold creates sections 1 (imports) + 2 (constants) + the factory signature (section 5), so S2/T2/T3 only ever **add** bodies, never restructure.
- **Proves the verified import pattern works** before any logic is written — de-risking the whole milestone. All 6 API claims are pre-verified (see `architecture/api_verification.md`); the scaffold is the executable proof.
- **Module-level constants are shared state.** `FILE_INJECT_RE`, `MIME_BY_EXT`, `TRAILING_PUNCT` are consumed by S2/T2/T3 in the same file, so they must exist at module scope from the start.

## What

A single TypeScript file at the project root with, in order:
1. **Imports** — exactly six statements (two `import type`, one value-import from the Pi package, three Node builtins).
2. **Constants** — three `const` declarations at module scope: the detection regex, the image MIME table, the trailing-punctuation trim set.
3. **Factory** — `export default function (pi: ExtensionAPI)` that registers an `input` handler returning `{ action: "continue" }` (no-op stub).

No `package.json`, no `tsconfig.json`, no `node_modules`, no test files. The extension is dependency-free beyond Pi's own exports + Node builtins.

### Success Criteria

- [ ] `./file-injector.ts` loads via jiti with default export `typeof === "function"` (validation gate below).
- [ ] All three constants present at module scope with exact values.
- [ ] Pass-through verified: a `#@`-containing prompt is returned unchanged.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ — **YES.** This PRP includes the verified Pi install path, the exact import list, the exact constant values (empirically tested), the canonical reference file to mirror, and a verified-working non-interactive validation command. No access to `dist/` internals is required (imports use only exported public APIs).

### Documentation & References

```yaml
# MUST READ — verified architecture recon (already produced for this PRD)
- docfile: plan/001_5aa8724eb506/architecture/external_deps.md
  why: VERIFIED import pattern + the fact that Pi virtualizes its packages via jiti (no local package.json/node_modules/tsconfig needed)
  critical: "The exact 6-line import block is the canonical, tested pattern. Copy it verbatim."

- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: Line-by-line evidence (path:line) that ExtensionAPI.on('input'), InputEvent/InputEventResult, resizeImage, formatDimensionNote, ImageContent, and ctx fields all exist as claimed in v0.80.7
  critical: "InputEventResult shape: { action:'continue' } | { action:'transform', text, images? } | { action:'handled' }. The stub returns the first."

- docfile: plan/001_5aa8724eb506/architecture/extension_patterns.md
  why: "§1 quotes inline-bash.ts (the canonical input-event extension to mirror); §5 documents jiti transpile-on-load + default-export-must-be-a-function requirement; §6 documents the input dispatch/chain semantics"
  critical: "§5: a module whose default export is not a function fails to load with 'Extension does not export a valid factory function'. §5: jiti transpiles ONLY (no type-check) → unused imports do NOT break loading."

- docfile: plan/001_5aa8724eb506/architecture/system_context.md
  why: Concise summary of verified API surface + loading mechanism + risks/mitigations
  section: "Verified API Surface" and "Extension Loading Mechanism"

# Canonical reference file to MIRROR structurally
- file: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/inline-bash.ts
  why: The exact registration shape `export default function (pi: ExtensionAPI) { pi.on("input", async (event, ctx) => {...}) }` and the `{ action: "continue" }` / `{ action: "transform", ... }` return convention
  pattern: "default-exported factory; module-level const regex; handler returns InputEventResult"
  gotcha: "inline-bash declares its regex INSIDE the factory; PRD §8/Appendix A wants the constants at MODULE scope. Follow the PRD (module scope), not inline-bash's placement."

- file: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/hello.ts
  why: Minimal example confirming the bare `export default function (pi: ExtensionAPI) {...}` shape loads cleanly with zero ceremony
  pattern: "smallest possible loadable extension"

# PRD source of truth (read-only reference; do NOT edit PRD.md)
- docfile: PRD.md
  why: "§7 = import list; §4.2 = FILE_INJECT_RE; §5.2 = MIME_BY_EXT; §4.3/§9 = TRAILING_PUNCT + cleanToken (cleanToken itself is S2, NOT this task); Appendix A = exact factory stub body"
  section: "§7, §8, Appendix A"
```

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-file-injector
.
├── .git/
├── .gitignore          # ignores node_modules/, dist/, .pi-subagents/ — does NOT ignore .ts
├── .pi-subagents/      # (subagent debug artifacts, ignored)
├── PRD.md              # READ-ONLY source of truth
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/        # external_deps.md, api_verification.md, extension_patterns.md, system_context.md
        ├── prd_index.txt
        ├── prd_snapshot.md
        ├── tasks.json           # orchestrator-owned, DO NOT TOUCH
        └── P1M1T1S1/
            ├── research/research_notes.md   # this task's research (context for implementer)
            └── PRP.md                       # <-- THIS FILE
# NOTE: there is NO src/, NO package.json, NO tsconfig — this is a greenfield single-file extension.
#       file-injector.ts does NOT exist yet.
```

### Desired Codebase tree with files to be added

```bash
.
├── ... (unchanged)
└── file-injector.ts    # NEW — created by this task. ~25-30 lines.
                        #   Sections: (1) imports, (2) module-level constants, (3) factory stub.
                        #   Responsibility: be loadable + harmless (pass-through) + expose the
                        #   shared constants that S2/T2/T3 will consume in the same file.
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Pi loads extensions via 'jiti' (transpile-on-load). NO tsconfig, NO package.json,
// NO node_modules are required at the extension's location. A bare ./file-injector.ts loads directly.
// (architecture/extension_patterns.md §5; architecture/external_deps.md)

// CRITICAL: The imports `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` are
// VIRTUALIZED/ALIASED by Pi's loader. Do NOT create a local package.json or run npm install.
// Do NOT import from `dist/...` internal paths — use only the exported public API.

// CRITICAL: The module's DEFAULT EXPORT MUST BE A FUNCTION. A non-function default export fails
// to load with: "Extension does not export a valid factory function".

// OK / INTENTIONAL: The scaffold imports resizeImage, formatDimensionNote, os, fs, path that the
// stub body does NOT yet use. jiti is transpile-ONLY (no type-check, no noUnusedLocals), so unused
// imports do NOT break loading. They are REQUIRED by later subtasks (T2/T3) in this same file.
// Do NOT remove them "to clean up" — that would break the shared import surface.

// GOTCHA: TRAILING_PUNCT is a DOUBLE-QUOTED JS string containing a double-quote char, so the `"`
// inside MUST be escaped as `\"`. Exact value: ".,;:!?\")]}>'"  (12 chars). See Implementation.

// GOTCHA: FILE_INJECT_RE uses a lookbehind `(?<=\W)`. Lookbehind is supported by the Node V8 jiti
// targets — VERIFIED it transpiles and runs. Do not "simplify" it to a capturing group; the
// zero-width anchor is what makes matchAll's m[0] come out as EXACTLY "#@<path>" (no leading char).

// GOTCHA: Keep the handler signature `(event, ctx)` even though the stub ignores both. T3.S2 will
// fill in the body using event.source / event.streamingBehavior / event.text / ctx.hasUI / ctx.cwd.
```

## Implementation Blueprint

### Data models and structure

No data models are created in this subtask. The only "structure" is the module shell. The two type-only imports (`ExtensionAPI`, `ImageContent`) are erased at transpile and exist purely to type the factory and (later) the `images` array — they require no runtime artifact.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE ./file-injector.ts (single file, project root)
  - OBJECTIVE: Establish the loadable module shell (imports + module-level constants + factory stub).
  - WRITE, in this exact order:
      (a) The six import statements (verbatim — see "Exact source" below).
      (b) The three module-level const declarations (verbatim — see "Exact source").
      (c) The default-exported factory with the pass-through input handler (verbatim — see "Exact source").
  - FOLLOW pattern: PRD Appendix A "Minimal skeleton" body (the stub handler returns { action: "continue" }).
  - REFERENCE structurally: examples/extensions/inline-bash.ts for the
        `export default function (pi: ExtensionAPI) { pi.on("input", async (event, ctx) => {...}) }`
        registration shape — BUT place constants at MODULE scope (PRD §8), not inside the factory.
  - NAMING: FILE_INJECT_RE, MIME_BY_EXT, TRAILING_PUNCT (exact, SCREAMING_SNAKE_CASE module consts).
  - PLACEMENT: project root. NOT under src/, NOT under plan/. The file's basename is file-injector.ts.
  - DO NOT (out of scope for S1): cleanToken, expandTildeAndResolve, extOf, isBinary,
        formatTextFileBlock/formatImageBlock/formatBinaryBlock, injectFiles, handler guards/notify/transform.
  - DO NOT create: package.json, tsconfig.json, any test file, any README. (README is P1.M2.T5.S1.)
  - DEPENDENCIES: none (this is the file foundation; no prior subtask).
```

### Exact source to write (authoritative — copy verbatim, then run the validation gate)

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};
const TRAILING_PUNCT = ".,;:!?\")]}>'";

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```

**Why every line is exactly this:**

| Element | Rationale & source |
|---|---|
| `import type { ExtensionAPI }` | PRD §7. Type-only; erased at transpile. Types the `pi` factory param. Verified at `dist/core/extensions/types.d.ts`. |
| `import type { ImageContent }` | PRD §7. Type-only. Used by later T3.S1 to type the merged `images` array (`{ type:"image"; data:string; mimeType:string }`, base64, no `data:` prefix). |
| `import { resizeImage, formatDimensionNote }` | PRD §7. **Value imports** (retained at runtime). Used by T2/T3 for image downscaling + dimension note. Unused in stub is INTENTIONAL (jiti is transpile-only; see Gotchas). Verified exported at `dist/index.d.ts:31`. |
| `import { promises as fs }` | PRD §7. Node builtin. T3 uses `fs.stat` / `fs.readFile`. |
| `import * as path` / `import * as os` | PRD §7. Node builtins. S2 uses `path.resolve`/`path.basename`; tilde expand uses `os.homedir()`. |
| `FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g` | PRD §4.2. VERIFIED: `(^|(?<=\W))` is zero-width → `matchAll` yields `m[0]` === exactly `#@<path>` and `m[2]` === the path token. Blocks mid-word `foo#@bar`, `# @file`, `#1234`, emails. |
| `MIME_BY_EXT: Record<string,string>` | PRD §5.2. Exact 6-entry table. Keys are extension (no dot, lowercase). |
| `TRAILING_PUNCT = ".,;:!?\")]}>'"` | PRD §4.3/§9. 12 chars: `. , ; : ! ? " ' ) ] } >`. The `\"` is an escaped `"` inside the double-quoted string. (cleanToken itself is S2 — NOT this task — but the trim set must exist now.) |
| `export default function (pi: ExtensionAPI)` | PRD Appendix A + `inline-bash.ts`. The default export MUST be a function or load fails. |
| `pi.on("input", async (event, ctx) => { return { action: "continue" }; })` | PRD Appendix A stub body. Registers the handler now (so the hook exists); returns the no-op `InputEventResult`. T3.S2 replaces the body with real guards + `injectFiles` call. |

### Implementation Patterns & Key Details

```typescript
// PATTERN (registration): mirror inline-bash.ts / hello.ts / PRD Appendix A.
//   A default-exported factory receives the ExtensionAPI and wires event handlers.
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    // STUB (T3.S2 replaces this body): currently a pure pass-through.
    // Valid InputEventResult shapes (architecture/api_verification.md §1):
    //   { action: "continue" }                                  <- this stub
    //   { action: "transform"; text: string; images?: ... }     <- T3.S1/S2
    //   { action: "handled" }
    return { action: "continue" };
  });
}

// PATTERN (constant placement): PRD §8 puts constants at MODULE scope (not inside the factory).
// Rationale: they are shared by the helpers + injectFiles added by S2/T2/T3 in THIS file.
// inline-bash.ts declares its regex inside the factory; do NOT copy that placement detail —
// copy only the registration SHAPE from inline-bash.ts.
```

### Integration Points

```yaml
EXTENSION LOADING (no build step):
  - mechanism: "Pi's jiti loader transpiles ./file-injector.ts on import. No tsconfig/package.json needed."
  - discovery: "Explicit: `pi -e ./file-injector.ts`. (Global ~/.pi/agent/extensions/ and project .pi/extensions/
    discovery are NOT used for this task — the file lives at the project root and is loaded via -e.)"

NO DATABASE / NO CONFIG / NO ROUTES / NO NEW ENV VARS:
  - "This is an internal scaffold. No user-facing, config, or API surface change. (PRD §2 Non-Goals: no config.)"
```

## Validation Loop

> This project has **no test framework, no linter, no type-checker configured** (it is a greenfield single-file extension). The Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. Use the gates below — they are TypeScript/Pi-specific and have been **verified working on this machine**.

### Level 1: Syntax & Transpile (Immediate Feedback)

```bash
# 1a. File exists at the right place (project root, not under src/ or plan/).
test -f ./file-injector.ts && echo "OK: file present" || echo "FAIL: missing ./file-injector.ts"

# 1b. Eyeball the three constants + factory are at MODULE scope (not nested in the factory):
grep -nE '^(const FILE_INJECT_RE|const MIME_BY_EXT|const TRAILING_PUNCT|export default function)' ./file-injector.ts
# Expected: 4 lines, all anchored at column 1 (no leading whitespace) → confirms module scope.

# Expected: all commands succeed; the grep prints exactly the 4 expected lines.
```

### Level 2: Load via jiti (Component Validation — NON-INTERACTIVE, NO MODEL/API KEY)

This is the **primary gate**. It replicates exactly what Pi's loader does (`jiti.import` with the package aliases) and proves the scaffold transpiles + exports a valid factory — without launching the TUI or calling any model.

```bash
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./file-injector.ts").href);
if (typeof mod.default !== "function") { console.error("FAIL: default export is not a function (got " + typeof mod.default + ")"); process.exit(1); }
console.log("PASS: default export is", typeof mod.default);
'
# Expected: prints "PASS: default export is function". Exit code 0.
# If it prints FAIL or throws (e.g. "Extension does not export a valid factory function",
# a syntax error, or an unresolvable import): READ the error, fix the file, re-run.
```

### Level 3: Authoritative Pi Loader (System Validation)

```bash
# Confirms Pi's REAL loader (with its real getAliases()) accepts the file.
# -e loads the extension; -ne disables discovery so ONLY our -e file loads; -p makes it non-interactive.
# NOTE: -p will attempt ONE model turn after loading — it requires a configured provider.
# If no provider/API key is set, the extension still LOADS (load happens before the model call);
# a model/provider error AFTER "extension loaded" does NOT indicate a scaffold failure.
pi -e ./file-injector.ts -ne -p "scaffold load check" 2>&1 | tee /tmp/pi_load.log
grep -qiE "error|invalid factory|does not export" /tmp/pi_load.log && echo "FAIL: load error above" || echo "OK: no load error"
# Expected: no "Extension does not export a valid factory function" / syntax / import errors.
# (Optional — Level 2 already proves load. Use this for final confidence if a provider is configured.)
```

### Level 4: Scaffold-Specific Behavior Check (Pass-Through)

The stub must be a no-op: it must not transform ANY prompt, including ones containing `#@`.

```bash
# Directly exercise the registered handler against a #@ prompt and assert it returns { action: "continue" }.
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./file-injector.ts").href);
// Build a minimal stub ExtensionAPI that records the registered input handler, then invoke it.
let handler = null;
const pi = { on: (ev, fn) => { if (ev === "input") handler = fn; } };
mod.default(pi);
if (!handler) { console.error("FAIL: no input handler registered"); process.exit(1); }
const event = { type: "input", text: "Review #@a.ts please", images: [], source: "interactive" };
const ctx = { cwd: process.cwd(), hasUI: false };
const result = await handler(event, ctx);
const ok = result && result.action === "continue";
console.log(JSON.stringify(result));
if (!ok) { console.error("FAIL: stub did not pass through (expected action=continue)"); process.exit(1); }
console.log("PASS: stub is a no-op pass-through for a #@ prompt");
'
# Expected: prints {"action":"continue"} then "PASS: stub is a no-op pass-through for a #@ prompt". Exit 0.
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: `./file-injector.ts` exists; the 4 module-scope lines grep at column 1.
- [ ] Level 2: jiti gate prints `PASS: default export is function` (exit 0).
- [ ] Level 3 (optional, if provider configured): no load error in `pi -e ... -p` output.
- [ ] Level 4: stub returns `{"action":"continue"}` for a `#@` prompt.

### Feature Validation
- [ ] All six imports present, verbatim, in the specified order.
- [ ] `FILE_INJECT_RE` = `/(^|(?<=\W))#@(\S+)/g` (lookbehind intact, global flag).
- [ ] `MIME_BY_EXT` has exactly the 6 entries (png/jpg/jpeg/gif/webp/bmp) with the exact MIME strings.
- [ ] `TRAILING_PUNCT` = `".,;:!?\")]}>'"` (escaped `"`; 12 chars).
- [ ] Default export is `function (pi: ExtensionAPI)` registering an `input` handler that returns `{ action: "continue" }`.
- [ ] NO out-of-scope code added (no cleanToken/helpers/injectFiles/real-handler-logic — those are S2/T2/T3).

### Code Quality Validation
- [ ] Constants at MODULE scope (PRD §8), not nested inside the factory.
- [ ] Factory signature `(event, ctx)` retained (T3.S2 will use both).
- [ ] No `package.json` / `tsconfig.json` / test files / README created (out of scope; README is P1.M2.T5.S1).
- [ ] No import from `dist/...` internals (public exported APIs only).

### Documentation & Deployment
- [ ] No new env vars, config, or user-facing surface (PRD §2: no config).
- [ ] File is self-documenting (the constant names + PRD § references suffice for S1).

---

## Anti-Patterns to Avoid

- ❌ Don't create a `package.json`, `tsconfig.json`, or `node_modules` — Pi virtualizes its packages via jiti; these are unnecessary and may confuse the loader.
- ❌ Don't `npm install` anything — the extension is dependency-free beyond Pi's exports + Node builtins.
- ❌ Don't import from `dist/...` internal paths — unstable surface; use only exported public APIs (`resizeImage`, `formatDimensionNote`, `ExtensionAPI`, `ImageContent`).
- ❌ Don't remove the "unused" imports (`resizeImage`, `formatDimensionNote`, `os`, `fs`, `path`) — they are the shared import surface for T2/T3 in this same file; jiti is transpile-only so they don't hurt.
- ❌ Don't place the constants inside the factory — PRD §8 mandates module scope so S2/T2/T3 can use them.
- ❌ Don't implement `cleanToken`, `injectFiles`, the format helpers, or the real handler here — that is S2/T2/T3. S1 is the shell only. Adding them now violates scope and risks collision with those subtasks.
- ❌ Don't change the regex to "simplify" the lookbehind — the zero-width anchor is load-bearing for `m[0] === "#@<path>"` correctness used by later replacement logic.
- ❌ Don't forget to escape the `"` inside `TRAILING_PUNCT` (`\"`) — an unescaped quote breaks the string literal at transpile.

---

## Confidence Score

**9 / 10** for one-pass implementation success.

Rationale: The task is small (~25 lines), fully prescriptive (exact source provided), every API claim is pre-verified against the installed package with `path:line` evidence, the regex and constants have been empirically tested in this environment, and the validation gate (jiti transpile + factory-export check) has been **verified working** non-interactively without a model. The only residual risk is a transcription slip (e.g., mis-escaping `TRAILING_PUNCT`'s inner quote) — fully caught by Level 2 and Level 4 gates.
