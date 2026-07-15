---
name: "P1.M1.T2.S1 — Binary detection + text/image/binary format block helpers"
prd_ref: "PRD §5.1 (text/binary NUL check), §5.2 (image), §5.3 (binary note), §6.1 (<file> tag format), §6.2 (assembly/join), §7 (imports), §10 (edge cases)"
target_file: "./sharp-at-file.ts" (IN-PLACE EDIT; S1 scaffold + S2 parsing helpers already present)
target_language: TypeScript (jiti transpile-on-load, no tsconfig/package.json)
---

# PRP — P1.M1.T2.S1: Binary Detection + Format Block Helpers

## Goal

**Feature Goal**: Add **four exported pure helper functions** to `./sharp-at-file.ts` — `isBinary`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock` — that produce Pi-native `<file>`-tag strings byte-identical to the built-in `processFileArguments` text/image output, plus a deliberate binary guard (`isBinary`) that the built-in CLI lacks. These are the format primitives consumed by `injectFiles` (T3.S1); they do NOT touch `fs`, do NOT call `resizeImage`, and do NOT decide routing — they receive already-fetched inputs and return strings.

**Deliverable**: Two edits to the existing `./sharp-at-file.ts`:
1. **Import-line edit** (line 3): add `type ResizedImage` to the existing value-import from `@earendil-works/pi-coding-agent`.
2. **Insert 4 `export function` declarations** at module scope, immediately before the `export default function (pi: ExtensionAPI)` factory line (currently line 50).

Each format function returns a single `<file>…</file>` string **without a trailing `\n`** (the assembly `.join()` in T3.S1 supplies separation — this is the one intentional, documented divergence from `processFileArguments`, which appends `\n` per block because it concatenates with `+=`).

**Success Definition**:
- [ ] `isBinary(buf: Buffer): boolean` returns `true` iff a `0x00` NUL byte exists in the first `min(buf.length, 8000)` bytes.
- [ ] `formatTextFileBlock(abs, content)` returns `'<file name="' + abs + '">\n' + content + '\n</file>'`.
- [ ] `formatImageBlock(abs, resized)` calls `formatDimensionNote(resized)` when `resized != null` and emits `'<file name="' + abs + '">' + (hint ?? '') + '</file>'` (empty hints → `<file name="ABS"></file>`).
- [ ] `formatBinaryBlock(abs)` returns the PRD §5.3 note with the **U+2014 em dash** (not a hyphen): `'<file name="' + abs + '"><binary file — contents not injected; use the read tool if needed></file>'`.
- [ ] All four are exported, pure (no I/O), placed at module scope before the factory.
- [ ] The jiti Level-2 gate (factory check + named exports + 23 assertions) passes with exit 0, **non-interactively, no model/API key**.

> **Scope boundary (read carefully):** This subtask produces ONLY the 4 helpers + the one import edit. Do NOT implement `injectFiles` (T3.S1), the real handler body/guards/notify/transform (T3.S2), or any README/test files. Do NOT modify the S1 constants, the S2 parsing helpers, or the factory stub body — only insert above the factory and edit the import line.

## User Persona

**Target User**: The implementing AI agent (and, transitively, the end user of the finished extension).

**Use Case**: These helpers are internal building blocks. They are invoked by `injectFiles` (T3.S1) once per `#@` token: after T3.S1 reads the file bytes and classifies by MIME, it calls the matching `format*Block` to produce the `<file>` string pushed into the `blocks` array. `isBinary` is the router for the text-vs-binary decision (images skip it entirely — classified by MIME first).

**User Journey** (end-to-end, even though T2.S1 is the middle layer): user types `#@data.bin` → T3.S1 reads bytes → `isBinary(buf)===true` & not an image → `formatBinaryBlock(abs)` → block appended → model sees a clean note instead of UTF-8 mojibake.

**Pain Points Addressed**: The built-in CLI `processFileArguments` has **no binary guard** — non-image binaries fall through to `await readFile(abs, "utf-8")` and inject garbage. `isBinary` + `formatBinaryBlock` fix this for the `#@` extension specifically (documented as a deliberate improvement; parity is verified separately in T4.S1).

## Why

- **Format parity with the CLI.** PRD §6.1 requires the model to see identical `<file>` structure whether a file came from `@file` (CLI) or `#@file` (extension). The three `format*Block` helpers encode the exact verified template strings from `dist/cli/file-processor.js` so `injectFiles` cannot drift.
- **Isolating the binary decision.** `isBinary` is pure and independently testable (23 pre-run assertions cover boundaries). Keeping it out of `injectFiles` means T3.S1 stays a thin orchestrator and the 8000-byte window logic is unit-pinned.
- **Preparing the image-dimension hint.** `formatDimensionNote` is already imported (S1) but unused until now. `formatImageBlock` is its first consumer; it must return `undefined` when the image was NOT resized, which the `hint ?? ''` collapse turns into the empty-hints form `<file name="ABS"></file>`.

## What

Edit the existing `./sharp-at-file.ts` (currently: 6 imports + 3 module constants + 3 S2 helper functions + factory stub, ≈ 55 lines). Exactly two regions change:

1. **Line 3** — the value-import gains `type ResizedImage`:
   ```ts
   import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
   ```
2. **Before the factory** (the `export default function (pi: ExtensionAPI) {` line) — insert the four functions (exact source in Implementation Blueprint).

No new files. No `package.json`/`tsconfig.json`/test files. The `type ResizedImage` import is erased at transpile (type-only) so it adds no runtime dependency — jiti is transpile-only and handles the inline `type` modifier cleanly (verified).

### Success Criteria

- [ ] Four new `export function` declarations appear at module scope, before the factory, named exactly `isBinary`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`.
- [ ] Import line contains `type ResizedImage` alongside `resizeImage, formatDimensionNote`.
- [ ] `formatTextFileBlock("/a.txt","hi") + "\n"` === `'<file name="/a.txt">\nhi\n</file>\n'` (processFileArguments text parity).
- [ ] `formatBinaryBlock` output contains `"\u2014"` (em dash) and NOT `" - "` (ASCII hyphen).
- [ ] `isBinary(Buffer.from([0,1,2]))` === `true`; `isBinary(Buffer.from("plain text"))` === `false`.
- [ ] No trailing `\n` on any helper's return (assembly owns separation).
- [ ] jiti Level-2 gate: `23 passed, 0 failed`, exit 0.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ — **YES.** This PRP ships: the exact verified import edit, the exact source for all four functions, the exact `processFileArguments` template strings (with `path:line` evidence), the `formatDimensionNote` body (quoted from source so the `undefined`-on-not-resized behavior is unambiguous), the live file-state (line numbers confirmed), the em-dash gotcha, the trailing-`\n` rationale, AND a pre-run-green 23-assertion non-interactive validation script. No access to `dist/` internals is required beyond what is quoted.

### Documentation & References

```yaml
# MUST READ — verified architecture recon (already produced for this PRD)
- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: "§2/§3: resizeImage + formatDimensionNote exported from dist/index.d.ts:31-32; ResizedImage shape; formatDimensionNote returns undefined when !wasResized. §4: ImageContent is base64 no-prefix (NOT needed here — image attachment is T3.S1)."
  critical: "formatDimensionNote(result) returns undefined iff result.wasResized === false. formatImageBlock MUST collapse undefined → '' to get the empty-hints <file name='ABS'></file> form."

- docfile: plan/001_5aa8724eb506/architecture/extension_patterns.md
  why: "§2 quotes processFileArguments verbatim — the templates these helpers must mirror. Also documents that processFileArguments has NO binary guard (§2 'Parity implications'), making isBinary a deliberate improvement."
  critical: "Text parity template: `<file name=\"${absolutePath}\">\\n${content}\\n</file>\\n`. Our helper omits the trailing \\n (assembly join owns separation)."

- docfile: plan/001_5aa8724eb506/P1M1T2S1/research/research_notes.md
  why: "Per-function rationale, boundary table for isBinary (NUL at byte 7999 → true, 8000 → false), the three image-input shapes table, and the pre-run validation summary (23/0 green)."
  section: "§2 (isBinary boundaries), §3 (image hint logic), §4 (em dash), §5 (file state), §8 (validation summary)"

# PRD source of truth (read-only; do NOT edit PRD.md)
- docfile: PRD.md
  why: "§5.1 = isBinary contract (scan first 8000 bytes for 0x00); §5.3/§6.1 = binary note string verbatim (em dash); §6.1 = text/image/binary <file> format; §6.2 = why no trailing \\n (blocks joined, not +=-concatenated); §10 = edge cases (data.bin → binary note; empty file → empty text block)."
  section: "§5.1, §5.3, §6.1, §6.2, §10 (data.bin + empty-file rows)"

# Verified source-of-truth files (quoted inline below so the implementer need not open them)
- file: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/utils/image-resize.js
  why: "formatDimensionNote body — proves the undefined-when-not-resized branch and the exact note string."
  pattern: "function formatDimensionNote(result) { if (!result.wasResized) return undefined; ... }"

- file: /home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.js
  why: "The four processFileArguments template lines — the parity targets."
  pattern: "line 59 text: `<file name=\"${absolutePath}\">\\n${content}\\n</file>\\n`; line 49 image w/hints; line 52 image w/o hints; line 38 image w/message"
  gotcha: "These all end with \\n because file-processor uses += into one text string. Our helpers MUST NOT include the trailing \\n (PRD §6.2 assembles via blocks.join)."
```

### Verified source quotes (so the implementer never has to open dist/)

**`formatDimensionNote` body** (`dist/utils/image-resize.js:91-97`):
```js
export function formatDimensionNote(result) {
    if (!result.wasResized) {
        return undefined;              // <- image was NOT resized => undefined
    }
    const scale = result.originalWidth / result.width;
    return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
```

**`processFileArguments` templates** (`dist/cli/file-processor.js`, all lines end `\n`):
| Line | Branch | Template |
|------|--------|----------|
| 59 | text | `` `<file name="${absolutePath}">\n${content}\n</file>\n` `` |
| 49 | image w/ hints | `` `<file name="${absolutePath}">${processed.hints.join("\n")}</file>\n` `` |
| 52 | image w/o hints | `` `<file name="${absolutePath}"></file>\n` `` |
| 38 | image w/ message | `` `<file name="${absolutePath}">${processed.message}</file>\n` `` |

**`ResizedImage` re-export** (`dist/index.d.ts:32`):
```ts
export { formatDimensionNote, type ResizedImage, resizeImage } from "./utils/image-resize.ts";
```
→ Safe to import `type ResizedImage` from the main package (same line pattern the implementer will mirror).

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── .git/
├── .gitignore          # ignores node_modules/, dist/, .pi-subagents/
├── .pi-subagents/      # (subagent debug artifacts, ignored)
├── PRD.md              # READ-ONLY source of truth
├── sharp-at-file.ts    # <-- EDIT IN PLACE. Currently holds S1 (imports+consts+factory stub) + S2 (3 helpers).
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/        # api_verification.md, extension_patterns.md, external_deps.md, system_context.md
        ├── prd_index.txt
        ├── prd_snapshot.md
        ├── tasks.json           # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T1S1/{PRP.md, research/}
        ├── P1M1T1S2/{PRP.md, research/}
        └── P1M1T2S1/
            ├── research/research_notes.md   # detailed per-function rationale + boundary table
            └── PRP.md                       # <-- THIS FILE
# NOTE: NO package.json, NO tsconfig, NO test files, NO node_modules. Single-file jiti extension.
```

### Live file state (confirmed by grep at PRP-writing time)

```
line  3: import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";   # <- EDIT (add type ResizedImage)
line  5: import { promises as fs } from "node:fs";
line  6: import * as path from "node:path";
line  7: import * as os from "node:os";
line  9: const FILE_INJECT_RE = ...      # S1 — DO NOT TOUCH
line 10-17: const MIME_BY_EXT = ...      # S1 — DO NOT TOUCH
line 18: const TRAILING_PUNCT = ...      # S1 — DO NOT TOUCH
line 20: export function cleanToken(...)        # S2 — DO NOT TOUCH
line 30: export function expandTildeAndResolve  # S2 — DO NOT TOUCH
line 43: export function extOf(...)             # S2 — DO NOT TOUCH
line 50: export default function (pi: ExtensionAPI) {   # <- INSERT 4 FUNCTIONS ABOVE THIS LINE
```
The factory line (50) is the **stable anchor**: S2 did not touch it, so inserting above it never collides with the parallel S2 edit.

### Desired Codebase tree with files to be added

```bash
sharp-at-file.ts   # MODIFIED (no new files). Adds:
                   #   - `type ResizedImage` to the import line
                   #   - 4 exported pure functions before the factory:
                   #       isBinary(buf: Buffer): boolean
                   #       formatTextFileBlock(abs: string, content: string): string
                   #       formatImageBlock(abs: string, resized: ResizedImage | null): string
                   #       formatBinaryBlock(abs: string): string
                   # File grows by ~22 lines (import edit is 1 line; 4 functions ~21 lines incl. blanks/comments).
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: The em dash in formatBinaryBlock is U+2014 (—), NOT an ASCII hyphen (U+002D) or en dash
// (U+2013). The PRD §5.3 string is authoritative. Use the \u2014 escape in source so it can't be
// mis-typed as "-". Verified: formatBinaryBlock output must .includes("\u2014") === true.

// CRITICAL: Every helper MUST OMIT the trailing \n. processFileArguments appends \n per block because
// it builds one string with +=; our extension collects blocks[] and T3.S1 joins them (PRD §6.2).
// Including \n here would double-space the output.

// CRITICAL: isBinary scans ONLY the first min(buf.length, 8000) bytes — half-open window [0, 8000).
// A NUL at byte index 7999 (the 8000th byte) => true; at index 8000 (8001st byte) => false.
// This is for ROUTING non-image binaries to the binary note, NOT for size gating (PRD §5.1 explicit).
// Image files SKIP this check entirely — they are classified by MIME first in injectFiles (T3.S1).

// GOTCHA: formatImageBlock must call formatDimensionNote ONLY when resized != null. Passing null to
// formatDimensionNote would throw (it dereferences result.wasResized). The `resized != null ? ... : undefined`
// guard prevents that. Use loose != (covers null AND undefined defensively).

// GOTCHA: hint ?? "" (nullish coalescing) collapses the undefined from formatDimensionNote into "" so
// the empty-hints case emits exactly <file name="ABS"></file> (processFileArguments line-52 parity).
// Do NOT use `hint || ""` — that would also clobber a falsy-but-valid string (not an issue here, but
// ?? is the correct semantic: only null/undefined trigger the fallback).

// GOTCHA: `type ResizedImage` uses the INLINE `type` modifier inside a value-import statement. jiti
// (transpile-only) erases it at runtime — no new runtime dependency, no behavior change. Verified.

// GOTCHA: Pi loads via jiti — no tsconfig/package.json. Buffer indexing returns number for valid
// indices; since the isBinary loop is bounded by n <= buf.length, buf[i] is never undefined.
```

## Implementation Blueprint

### Data models and structure

No new data models. The one type-level addition is `ResizedImage` (imported as a type), used only to type the `formatImageBlock` second parameter. Its verified shape (for reference — do not construct it here; T3.S1 produces it via `resizeImage`):

```ts
// From dist/utils/image-resize-core.d.ts (re-exported from the main package)
interface ResizedImage {
  data: string;          // base64
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  wasResized: boolean;   // <- formatDimensionNote branches on this
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT the import line (line 3 of sharp-at-file.ts)
  - OBJECTIVE: Add the type-only ResizedImage import so formatImageBlock's param is typed.
  - CHANGE: `import { resizeImage, formatDimensionNote } from "@earendil-works/pi-coding-agent";`
         → `import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";`
  - WHY VERIFIED: dist/index.d.ts:32 exports `type ResizedImage` from this exact module path.
  - NAMING: `type ResizedImage` (PascalCase interface; inline `type` modifier).
  - DO NOT: change any other import, reorder existing imports, or add a separate `import type { ResizedImage }` line.

Task 2: INSERT four exported functions immediately BEFORE `export default function (pi: ExtensionAPI)`
  - OBJECTIVE: The four pure helpers (exact source below). Place at module scope, after extOf, before the factory.
  - ANCHOR: the factory line (currently line 50). This line is untouched by the parallel S2 task, so
            inserting above it is concurrency-safe regardless of task ordering.
  - NAMING: isBinary, formatTextFileBlock, formatImageBlock, formatBinaryBlock (exact, camelCase).
  - SIGNATURES (exact):
      isBinary(buf: Buffer): boolean
      formatTextFileBlock(abs: string, content: string): string
      formatImageBlock(abs: string, resized: ResizedImage | null): string
      formatBinaryBlock(abs: string): string
  - PURITY: no fs, no resizeImage, no I/O. The ONLY external call is formatDimensionNote (itself pure).
  - DEPENDENCIES: formatDimensionNote (already imported in S1), ResizedImage type (added in Task 1).
  - DO NOT (out of scope, owned elsewhere):
      - injectFiles (T3.S1) — the consumer; do not write it.
      - fs.readFile / the NUL-check CALL SITE / MIME classification / block+image assembly (T3.S1).
      - the real handler body / guards / notify / transform (T3.S2).
      - README, test files, package.json (P1.M2.T5.S1 / never).
```

### Exact source to write (authoritative — copy verbatim)

**Edit 1 — import line** (replace the existing line 3 verbatim):
```typescript
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
```

**Edit 2 — insert this block immediately above `export default function (pi: ExtensionAPI) {`:**
```typescript
/** PRD §5.1 — scan the first min(buf.length, 8000) bytes for a 0x00 NUL byte. Routes non-image
 *  binaries to the binary note. Image files skip this (classified by MIME first in injectFiles). */
export function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/** PRD §6.1 / processFileArguments line-59 parity — minus the trailing \n (assembly join owns it). */
export function formatTextFileBlock(abs: string, content: string): string {
  return '<file name="' + abs + '">\n' + content + '\n</file>';
}

/** PRD §5.2/§6.1 / processFileArguments lines 49/52 parity. Empty/undefined hint => <file name="ABS"></file>. */
export function formatImageBlock(abs: string, resized: ResizedImage | null): string {
  const hint = resized != null ? formatDimensionNote(resized) : undefined;
  return '<file name="' + abs + '">' + (hint ?? "") + '</file>';
}

/** PRD §5.3/§6.1 — em dash (U+2014) is load-bearing; no built-in equivalent (deliberate improvement
 *  over processFileArguments, which has no binary guard). */
export function formatBinaryBlock(abs: string): string {
  return '<file name="' + abs + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
}
```

**Why every line is exactly this:**

| Element | Rationale & source |
|---|---|
| `Math.min(buf.length, 8000)` + `i < n` | PRD §5.1 + work-item contract. Half-open window `[0, 8000)` = first 8000 bytes. NUL at index 7999 → true, 8000 → false (boundary table pre-run green). |
| `buf[i] === 0` | The NUL byte 0x00. Buffer indexing returns number for valid indices; loop bounded by `n <= buf.length` so never undefined. |
| `'<file name="' + abs + '">\n' + content + '\n</file>'` | String-concat form of processFileArguments line 59 minus trailing `\n`. Byte-identical to `` `<file name="${abs}">\n${content}\n</file>` ``. |
| `resized != null ? formatDimensionNote(resized) : undefined` | Guards the null case (resizeImage returned null in T3.S1 fallback). Loose `!=` covers null AND undefined. formatDimensionNote throws on null deref, so the guard is mandatory. |
| `hint ?? ""` | Nullish coalescing: collapses the `undefined` (image wasResized===false) into `""` → empty-hints form `<file name="ABS"></file>` (line-52 parity). |
| `'\u2014'` | U+2014 EM DASH. Escape form prevents accidental hyphen substitution. Source is UTF-8; jiti handles it; the escape and a literal `—` produce byte-identical output. |
| `'<file name="' + abs + '">'` prefix on image & binary | Matches processFileArguments `<file name="${absolutePath}">` — absolute resolved path as `name`. |

### Implementation Patterns & Key Details

```typescript
// PATTERN (purity): all four helpers are pure string/bool producers. No `await`, no `fs`, no `resizeImage`.
// They receive already-fetched inputs (a Buffer, a content string, a ResizedImage|null, an abs path).
// T3.S1 is responsible for the I/O (fs.readFile), the MIME lookup (MIME_BY_EXT[extOf(abs)]), the
// isBinary CALL, and the block/image array assembly + join.

// PATTERN (string construction): use plain '+' concatenation (matches the existing S2 helpers'
// style in this file and avoids template-literal nesting confusion). Template literals would also
// be correct; either is acceptable as long as the bytes match processFileArguments.

// PATTERN (trailing newline): NONE of the helpers append '\n'. processFileArguments does (+= concat);
// we don't (blocks.join in T3.S1). This is the single intentional, documented divergence. If you
// add '\n', Level-2 assertion `formatTextFileBlock("/a","hi") === '<file name="/a">\nhi\n</file>'`
// (no trailing \n) will FAIL.

// PATTERN (em dash): always emit via '\u2014'. Never type "-". The PRD §5.3 source string is the
// authority; the binary note is a custom format with no built-in equivalent.
```

### Integration Points

```yaml
IMPORTS (edit one line):
  - file: sharp-at-file.ts line 3
  - change: add `, type ResizedImage` to the existing value-import from @earendil-works/pi-coding-agent
  - rationale: "dist/index.d.ts:32 re-exports type ResizedImage from this module. Type-only; erased at transpile."

MODULE SCOPE (insert 4 functions):
  - location: "after extOf (S2), before export default function (pi: ExtensionAPI)"
  - rationale: "All helpers are module-scope pure functions consumed by injectFiles (T3.S1). The factory
    line is the stable anchor untouched by the parallel S2 edit."

DOWNSTREAM CONSUMERS (do NOT implement now — contract only):
  - T3.S1 injectFiles: "calls isBinary(buf) for non-image files; calls the matching format*Block(abs, ...)
    per token; pushes results into blocks[]; joins with a separator; returns { action:'transform', text, images }."
  - T3.S1 owns: "fs.readFile, MIME classification, the resizeImage call (produces ResizedImage|null),
    ImageContent attachment, block/image/injected assembly."
  - T3.S2 owns: "the real handler body (guards, notify, transform/continue)."

NO DATABASE / NO CONFIG / NO ROUTES / NO ENV VARS:
  - "Pure internal helpers. No user-facing, config, or API surface. (PRD §2 Non-Goals: no config.)"
```

## Validation Loop

> This project has **no test framework, no linter, no type-checker** (greenfield single-file extension). The Python-oriented `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. Use the gates below — TypeScript/Pi-specific, **verified working on this machine, non-interactive, no model/API key**.

### Level 1: Syntax & Placement (Immediate Feedback)

```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. Import line updated (type ResizedImage present, still a value-import line).
grep -nE '^import \{ resizeImage, formatDimensionNote, type ResizedImage \} from "@earendil-works/pi-coding-agent";' sharp-at-file.ts \
  && echo "OK: import line correct" || echo "FAIL: import line missing type ResizedImage"

# 1b. All four helpers present, exported, at module scope (column 1, before the factory).
grep -nE '^export function (isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock)\b' sharp-at-file.ts
# Expected: exactly 4 lines, all anchored at column 1.

# 1c. Factory still present and AFTER the helpers (helpers inserted above it, not below).
FACTORY=$(grep -nE '^export default function \(pi: ExtensionAPI\)' sharp-at-file.ts | cut -d: -f1)
LAST_HELPER=$(grep -nE '^export function (isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock)\b' sharp-at-file.ts | tail -1 | cut -d: -f1)
[ "$LAST_HELPER" -lt "$FACTORY" ] && echo "OK: helpers before factory (helper=$LAST_HELPER factory=$FACTORY)" || echo "FAIL: helpers not before factory"

# 1d. No out-of-scope T3 symbols leaked (injectFiles / fs.readFile / real-handler logic).
grep -nE 'injectFiles|fs\.(readFile|stat)|event\.source|streamingBehavior' sharp-at-file.ts && echo "FAIL: T3 symbols present (out of scope)" || echo "OK: no T3 symbols leaked"

# Expected: 1a/1c/1d print OK; 1b prints exactly the 4 function lines.
```

### Level 2: jiti Transpile + 23-Assertion Suite (PRIMARY GATE — pre-run green)

This replicates Pi's loader (`jiti.import` with package aliases) and exercises every helper across all input shapes. **No model, no API key, non-interactive.**

```bash
cd /home/dustin/projects/pi-auto-reader
node --input-type=module -e '
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./sharp-at-file.ts").href);

let pass = 0, fail = 0;
const T = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("FAIL:", name); } };

// --- factory + named exports present ---
T("default export is function", typeof mod.default === "function");
T("isBinary exported", typeof mod.isBinary === "function");
T("formatTextFileBlock exported", typeof mod.formatTextFileBlock === "function");
T("formatImageBlock exported", typeof mod.formatImageBlock === "function");
T("formatBinaryBlock exported", typeof mod.formatBinaryBlock === "function");

// --- isBinary boundaries ---
T("isBinary NUL at 0", mod.isBinary(Buffer.from([0,1,2])) === true);
T("isBinary NUL at 7999 (window edge)", mod.isBinary(Buffer.concat([Buffer.alloc(7999,65), Buffer.from([0])])) === true);
T("isBinary NUL at 8000 (past window)", mod.isBinary(Buffer.concat([Buffer.alloc(8000,65), Buffer.from([0])])) === false);
T("isBinary plain ASCII", mod.isBinary(Buffer.from("plain text no nul")) === false);
T("isBinary empty buffer", mod.isBinary(Buffer.alloc(0)) === false);
T("isBinary utf8 multibyte no nul", mod.isBinary(Buffer.from("日本語")) === false);
T("isBinary exactly 8000 bytes no nul", mod.isBinary(Buffer.alloc(8000,65)) === false);
T("isBinary large ASCII no nul", mod.isBinary(Buffer.alloc(20000,65)) === false);
T("isBinary large with nul at 15000 (past window)", mod.isBinary(Buffer.concat([Buffer.alloc(15000,65), Buffer.from([0]), Buffer.alloc(4999,65)])) === false);

// --- formatTextFileBlock (processFileArguments line-59 parity, minus trailing \n) ---
T("text basic", mod.formatTextFileBlock("/a.txt","hi") === "<file name=\"/a.txt\">\nhi\n</file>");
T("text empty content", mod.formatTextFileBlock("/e.txt","") === "<file name=\"/e.txt\">\n\n</file>");
T("text multiline content", mod.formatTextFileBlock("/m.md","a\nb\nc") === "<file name=\"/m.md\">\na\nb\nc\n</file>");
T("text no trailing newline", !mod.formatTextFileBlock("/a.txt","hi").endsWith("\n"));
T("text parity vs template", mod.formatTextFileBlock("/x.ts","c") + "\n" === "<file name=\"/x.ts\">\nc\n</file>\n");

// --- formatImageBlock (processFileArguments lines 49/52 parity) ---
const RESIZED_TRUE = { data:"d", mimeType:"image/png", originalWidth:1000, originalHeight:1000, width:500, height:500, wasResized:true };
const RESIZED_FALSE = { data:"d", mimeType:"image/png", originalWidth:500, originalHeight:500, width:500, height:500, wasResized:false };
T("image null resized => empty hints", mod.formatImageBlock("/p.png", null) === "<file name=\"/p.png\"></file>");
T("image wasResized false => empty hints", mod.formatImageBlock("/p.png", RESIZED_FALSE) === "<file name=\"/p.png\"></file>");
T("image wasResized true => scale note", mod.formatImageBlock("/p.png", RESIZED_TRUE) === "<file name=\"/p.png\">[Image: original 1000x1000, displayed at 500x500. Multiply coordinates by 2.00 to map to original image.]</file>");
T("image hint starts with [Image:", mod.formatImageBlock("/p.png", RESIZED_TRUE).includes(">[Image:") === true);
T("image no trailing newline", !mod.formatImageBlock("/p.png", RESIZED_TRUE).endsWith("\n"));
T("image absolute path preserved", mod.formatImageBlock("/abs/dir/p.png", null).includes("/abs/dir/p.png") === true);

// --- formatBinaryBlock (PRD §5.3; em dash U+2014 load-bearing) ---
T("binary basic shape", mod.formatBinaryBlock("/d.bin") === "<file name=\"/d.bin\"><binary file \u2014 contents not injected; use the read tool if needed></file>");
T("binary has em dash U+2014", mod.formatBinaryBlock("/d.bin").includes("\u2014") === true);
T("binary NOT ascii hyphen", mod.formatBinaryBlock("/d.bin").includes(" - ") === false);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
'
# Expected: "23 passed, 0 failed", exit 0.
# If any FAIL: READ the failure name, compare against the exact-source block above, fix, re-run.
```

### Level 3: Authoritative Pi Loader (System Validation — optional confidence)

```bash
cd /home/dustin/projects/pi-auto-reader
# Confirms Pi's REAL loader (with its real getAliases()) accepts the edited file.
# -e loads the extension; -ne disables discovery; -p makes it non-interactive.
# NOTE: -p attempts ONE model turn after loading — requires a configured provider. The extension
# still LOADS before the model call; a provider error AFTER load does NOT indicate a helper failure.
pi -e ./sharp-at-file.ts -ne -p "helper load check" 2>&1 | tee /tmp/pi_t2s1.log
grep -qiE "error|invalid factory|does not export|is not defined" /tmp/pi_t2s1.log && echo "FAIL: load error above" || echo "OK: no load error"
# Expected: no "does not export a valid factory function" / syntax / import errors.
# (Level 2 already proves load + behavior; use this only for final confidence if a provider is set.)
```

### Level 4: Cross-Subtask State Check (S1+S2+T2.S1 coexist)

After editing, the file must still contain ALL prior work (S1 imports/constants/factory stub + S2 helpers) — none clobbered.

```bash
cd /home/dustin/projects/pi-auto-reader
echo "--- S1 constants still present ---"
grep -cE '^const (FILE_INJECT_RE|MIME_BY_EXT|TRAILING_PUNCT)' sharp-at-file.ts   # Expected: 3
echo "--- S2 helpers still present ---"
grep -cE '^export function (cleanToken|expandTildeAndResolve|extOf)' sharp-at-file.ts   # Expected: 3
echo "--- T2.S1 helpers present ---"
grep -cE '^export function (isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock)' sharp-at-file.ts   # Expected: 4
echo "--- factory still present + still a stub (returns continue) ---"
grep -A2 'pi.on("input"' sharp-at-file.ts | grep -q 'action: "continue"' && echo "OK: factory stub intact" || echo "FAIL: factory stub altered (out of scope)"
# Expected: 3, 3, 4, and "OK: factory stub intact".
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: import line grep passes; 4 helpers at column 1 before the factory; no T3 symbols leaked.
- [ ] Level 2: jiti gate prints `23 passed, 0 failed`, exit 0.
- [ ] Level 3 (optional, if provider configured): no load error in `pi -e ... -p` output.
- [ ] Level 4: S1 (3 consts) + S2 (3 helpers) + T2.S1 (4 helpers) + factory stub all coexist.

### Feature Validation
- [ ] `isBinary` boundary: NUL at byte 7999 → true; at 8000 → false; empty buffer → false.
- [ ] `formatTextFileBlock` + `"\n"` === processFileArguments text template (line-59 parity).
- [ ] `formatImageBlock`: null/`wasResized:false` → empty hints; `wasResized:true` → scale note.
- [ ] `formatBinaryBlock` contains `\u2014` (em dash), not ASCII hyphen.
- [ ] No helper appends a trailing `\n`.
- [ ] No helper performs I/O or calls `resizeImage` (only `formatDimensionNote`, pure).

### Code Quality Validation
- [ ] Helpers at MODULE scope, before the factory (matches S1/S2 placement; PRD §8 single-file structure).
- [ ] Import edit is a minimal 1-line change (added `type ResizedImage` inline, no reorder).
- [ ] Em dash emitted via `\u2014` escape (not a typed hyphen).
- [ ] `hint ?? ""` (nullish coalescing), not `|| ""`.
- [ ] `resized != null` loose check (covers null + undefined).
- [ ] No `package.json` / `tsconfig.json` / test files / README created.

### Documentation & Deployment
- [ ] No new env vars, config, or user-facing surface (PRD §2: no config).
- [ ] JSDoc on each helper cites the PRD section it implements (§5.1/§5.2/§5.3/§6.1).
- [ ] Helpers are self-documenting (descriptive names + the PRD § references).

---

## Anti-Patterns to Avoid

- ❌ Don't append a trailing `\n` to any helper — `processFileArguments` does (it `+=`-concatenates); this extension joins a `blocks[]` array (PRD §6.2). Adding `\n` double-spaces the output and fails the Level-2 `endsWith("\n")` assertions.
- ❌ Don't substitute an ASCII hyphen `-` (or en dash `–`) for the em dash `—` in `formatBinaryBlock`. Use `\u2014`. The PRD §5.3 string is authoritative; it's a custom format with no built-in equivalent.
- ❌ Don't call `formatDimensionNote(resized)` without first checking `resized != null` — it dereferences `result.wasResized` and throws on null/undefined. The `resizeImage` fallback in T3.S1 passes null, which must reach this helper.
- ❌ Don't use `hint || ""` — use `hint ?? ""`. `||` would also clobber a falsy-but-valid string (defensive correctness; `??` only falls back on null/undefined, which is exactly the `formatDimensionNote`-returns-`undefined` case).
- ❌ Don't implement `injectFiles`, the `isBinary` CALL site, MIME classification, `fs.readFile`, `ImageContent` attachment, or the real handler body — those are T3.S1/T3.S2. This task is the format primitives only.
- ❌ Don't modify the S1 constants, the S2 helpers, or the factory stub body — only edit the import line and insert above the factory.
- ❌ Don't add a separate `import type { ResizedImage }` line — use the inline `type` modifier on the existing value-import (matches the package's own re-export style at `dist/index.d.ts:32`).
- ❌ Don't gate `isBinary` on file size — it is a CONTENT check (NUL byte) for routing non-image binaries, explicitly NOT a size gate (PRD §5.1: "only to route non-image binaries to §5.3, not to gate size").
- ❌ Don't create `package.json`/`tsconfig.json`/test files — jiti transpiles on load; this is a dependency-free single-file extension.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: The four functions are small (~21 lines total), fully prescriptive (exact source provided), and every API claim is pre-verified against the installed package with `path:line` evidence (`formatDimensionNote` body quoted verbatim; `processFileArguments` templates quoted verbatim; `ResizedImage` re-export confirmed). The full 23-assertion suite (including the load-bearing boundary cases: NUL at byte 7999 vs 8000, em dash vs hyphen, empty-hints vs scale-note, no-trailing-`\n`) was **pre-run green** in the research phase against a temp copy of the target file. The live file-state (line numbers) was re-confirmed at PRP-writing time. Residual 0.5 risk is a transcription slip (e.g., typing `-` instead of `\u2014`, or adding a stray `\n`) — fully caught by Level 1 + Level 2 gates.
