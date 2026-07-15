---
name: "P1.M1.T3.S1 — injectFiles: core assembly function (token iteration, file dispatch, block/image assembly)"
prd_ref: "PRD §5.1–§5.4 (text/image/binary/missing dispatch), §6.2 (assembly/append/join), §9 (algorithm pseudocode), §10 (edge cases), §12 (gotchas)"
target_file: "./sharp-at-file.ts"  # IN-PLACE EDIT; S1 + S2 + T2.S1 already present (T2.S1 may still be in-flight — see Concurrency note)
target_language: TypeScript (jiti transpile-on-load; no tsconfig/package.json/test framework)
depends_on: "P1.M1.T1.S1 (FILE_INJECT_RE/MIME_BY_EXT/imports), P1.M1.T1.S2 (cleanToken/expandTildeAndResolve/extOf), P1.M1.T2.S1 (isBinary/formatTextFileBlock/formatImageBlock/formatBinaryBlock + type ResizedImage)"
consumed_by: "P1.M1.T3.S2 (input handler: guards, injectFiles call, notify, transform/continue)"
---

# PRP — P1.M1.T3.S1: `injectFiles` Core Assembly Function

## Goal

**Feature Goal**: Add the **single exported async function `injectFiles`** to `./sharp-at-file.ts` — the
core orchestrator that turns a user prompt containing zero or more `#@<path>` markers into a transformed
prompt with whole-file contents **appended** below a `---` rule, plus any image files attached as
`ImageContent`. It is the I/O + assembly heart of the extension: it iterates matches, resolves & stats
each path, classifies by MIME, reads bytes, resizes images, and assembles `{ text, images, injected }`.
It does **not** decide `transform` vs `continue` (that is the handler's job in T3.S2) — it returns a
plain result object with an `injected` **count** that the handler translates.

**Deliverable**: One in-place edit to `./sharp-at-file.ts` — insert `export async function injectFiles(...)`
at module scope, **immediately before** the `export default function (pi: ExtensionAPI) {` factory line.
~45–55 added lines. No new files. The factory stub is left **untouched** (T3.S2 replaces its body).

**Success Definition**:
- [ ] `injectFiles(text, imagesIn, ctx)` matches the exact signature in §3 below and returns
      `{ text, images, injected }` where `injected` is a non-negative integer count.
- [ ] For every `#@<path>` token resolving to a **regular file**: the file is read whole, classified
      (text / image / binary), and either a `<file>` block is appended OR an `ImageContent` is attached
      (image case does BOTH) — and `count` increments.
- [ ] **Image-array MERGE**: `images` is seeded `[...imagesIn]`; `count===0` returns the **original**
      `imagesIn` reference; `count>0` returns the (possibly appended) copy. User-attached images are
      **never** destroyed.
- [ ] **Never throws** — each file's stat/read/resize is in its own try/catch; on error the token is
      left verbatim and processing continues.
- [ ] **Original prompt text is never modified** — `#@` markers remain; blocks are appended after
      `\n\n---\n\n`, joined with `\n\n`.
- [ ] The Level-2 jiti gate (≈40 assertions across 13 scenario groups) passes with exit 0,
      **non-interactively, no model/API key** (proven pre-run green — see Validation Loop).

> **Scope boundary (read carefully):** This subtask adds ONLY `injectFiles`. Do NOT implement the real
> handler body (guards `source==="extension"` / `streamingBehavior==="steer"` / `!text.includes("#@")`,
> the `injectFiles` CALL, `ctx.ui.notify`, or the `{action:"transform"|"continue"}` return) — that is
> **T3.S2**. Do NOT redefine the helpers from S1/S2/T2.S1 — **consume** them. Do NOT modify the imports,
> the constants, the S2/T2.S1 helpers, or the factory stub body.

## User Persona

**Target User**: The implementing AI agent (and, transitively, T3.S2 which calls it, and the end user
who types `#@file`).

**Use Case**: Internal core function. Invoked once per input event by the handler (T3.S2) AFTER the
cheap guards pass. It performs all the file I/O and assembly; the handler just decides what to do with
the result. Keeping it handler-agnostic is what makes it unit-testable with temp files and no model.

**Pain Points Addressed**: Centralizes the fiddly per-token pipeline (match → clean → resolve → stat →
classify → read → resize → assemble) with correct error isolation (one bad token never aborts the rest)
and correct image merging (the subtle "transform replaces images" runner semantics that would silently
drop user images if mishandled).

## Why

- **The defining behavior lives here.** "The whole file, every time, no limit" (PRD §5.1/§13) is
  enacted by reading the entire buffer and passing it straight to `formatTextFileBlock` with no
  truncation/word-count logic anywhere.
- **Correct image merging is non-obvious and load-bearing.** The input runner REPLACES the `images`
  array on `transform` (`dist/core/extensions/runner.js:882-920`, system_context.md "Image Array
  Merging"). Seeding `images = [...imagesIn]` and returning it in full is the only correct strategy.
- **Error isolation prevents prompt loss.** A permission error or unreadable file must never throw out
  of the handler (PRD §12.5). Wrapping each file in its own try/catch guarantees one failure leaves that
  token verbatim while the rest still inject.
- **Handler-agnostic return = testable.** Returning `{text, images, injected}` (a count, not an
  `InputEventResult`) keeps the assembly logic decoupled from Pi's event protocol and unit-testable with
  a plain `{ cwd }` context object.

## What

Insert **one** `export async function injectFiles` declaration into `./sharp-at-file.ts`, positioned at
module scope **immediately before** the `export default function (pi: ExtensionAPI) {` factory line
(PRD §8 internal structure: section 4 "Core", after the section-3 format helpers, before the section-5
factory). It consumes the already-present helpers/consts (`FILE_INJECT_RE`, `MIME_BY_EXT`,
`cleanToken`, `expandTildeAndResolve`, `extOf`, `isBinary`, `formatTextFileBlock`, `formatImageBlock`,
`formatBinaryBlock`, `resizeImage`) and the `ImageContent` type — **no new imports**.

No new files, no `package.json`/`tsconfig`/test files, no edits to imports/constants/helpers/factory.

### Success Criteria

- [ ] `injectFiles` is an exported async function at module scope, before the factory.
- [ ] `injected===0` when no token resolves to a regular file → returns **original** `imagesIn` ref,
      text byte-for-byte unchanged.
- [ ] Text file → block appended after `\n\n---\n\n`; `injected` counts it; original text (incl. marker)
      preserved.
- [ ] Empty file (0 bytes) → injected as `<file name="ABS">\n\n</file>` (**intentional divergence** from
      `processFileArguments`, which skips empty files).
- [ ] Binary file (NUL byte, non-image) → `formatBinaryBlock` note; no decoded garbage.
- [ ] Image file → `ImageContent` attached (`type:"image"`, base64 data, no `data:` prefix) AND a
      `<file>` reference block; `resizeImage` returning `null` falls back to raw `buf.toString("base64")`.
- [ ] Missing file / directory / read error → token left verbatim; other tokens still processed; never throws.
- [ ] `count>0` returns the `images` copy (which may include appended images); user images preserved.
- [ ] Level-2 jiti gate: ≈40 assertions green, exit 0.

## All Needed Context

### Context Completeness Check

> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: the exact verified function source (proven correct via a
> 45/45-green reference pre-run), the full per-token pipeline as an ordered step list (a)–(k), the two
> load-bearing subtleties (image-array merge semantics + empty-file divergence) with runner-internals
> evidence, the empirical `resizeImage` behavior (returns `null` → fallback exercised), the verified
> `matchAll(FILE_INJECT_RE)` capture-group matrix, AND a pre-run-green Level-2 validation suite (≈40
> assertions, model-free) plus the exact jiti alias setup. No `dist/` access required beyond what is quoted.

### Documentation & References

```yaml
# MUST READ — sibling PRPs (the contracts this task consumes)
- docfile: plan/001_5aa8724eb506/P1M1T1S1/PRP.md
  why: "Defines FILE_INJECT_RE (zero-width anchor => m[0]==='#@<path>', m[2]===token), MIME_BY_EXT
        (lowercase keys), TRAILING_PUNCT, and the 6-import surface. injectFiles consumes FILE_INJECT_RE
        + MIME_BY_EXT directly."
  critical: "FILE_INJECT_RE uses matchAll (NOT exec-in-a-loop) => no lastIndex stale-state risk."

- docfile: plan/001_5aa8724eb506/P1M1T1S2/PRP.md
  why: "Defines cleanToken (trim trailing punct, '' => skip), expandTildeAndResolve (~/expand +
        path.resolve(cwd)), extOf (lowercase ext, '' for no-dot/hidden). injectFiles calls all three
        in order per token."
  critical: "extOf LOWERCASES so MIME_BY_EXT[ext] resolves. cleanToken('')==='' is the skip signal."

- docfile: plan/001_5aa8724eb506/P1M1T2S1/PRP.md
  why: "Defines isBinary (NUL in first 8000 bytes), formatTextFileBlock/formatImageBlock/formatBinaryBlock
        (Pi-native <file> tags, NO trailing \\n), and the `type ResizedImage` import. injectFiles calls
        the matching format*Block per classification and passes `resized` (ResizedImage|null) to
        formatImageBlock."
  critical: "formatImageBlock(abs, null) is SAFE — T2.S1 guards null before calling formatDimensionNote.
        Helpers omit trailing \\n because injectFiles joins blocks[]."

# MUST READ — verified architecture recon
- docfile: plan/001_5aa8724eb506/architecture/system_context.md
  why: "'Input Event Dispatch Internals' — the runner REPLACES the images array on transform-with-images.
        §'Image Array Merging' is why images MUST be seeded [...imagesIn]. §'Deliberate Divergences'
        documents the empty-file injection vs processFileArguments."
  section: "Input Event Dispatch Internals + Image Array Merging + Deliberate Divergences + Risks"

- docfile: plan/001_5aa8724eb506/architecture/api_verification.md
  why: "§2 resizeImage signature (inputBytes: Uint8Array => Promise<ResizedImage|null>, async, spawns
        Worker, data is base64 no-prefix). §4 ImageContent {type,data,mimeType}. §5 ctx.cwd is a string
        (so the real ctx structurally satisfies the minimal {cwd:string} param)."
  section: "§2, §4, §5"

# THIS TASK's research (detailed, read it)
- docfile: plan/001_5aa8724eb506/P1M1T3S1/research/research_notes.md
  why: "The (a)-(k) contract restated, the resizeImage null-fallback empirical finding, the matchAll
        capture-group matrix, the merge-contract dual proof (count===0 original-ref vs count>0 copy),
        the empty-file no-special-code proof, and the 45/45 pre-run summary."
  section: "§3 (merge + empty-file), §4 (resizeImage), §5 (matchAll), §7 (pre-run summary)"

# PRD source of truth (read-only; do NOT edit PRD.md)
- docfile: PRD.md
  why: "§9 = the authoritative pseudocode (injectFiles body). §5.1-§5.4 = per-type dispatch. §6.2 =
        append-after-\\n\\n---\\n\\n, join with \\n\\n, do-not-modify-original. §10 = edge-case matrix.
        §12 = gotchas (never throw, resizeImage takes Uint8Array, append not inline)."
  section: "§5.1-§5.4, §6.2, §9, §10, §12"
```

### Verified API quotes (so the implementer never has to open dist/)

**`resizeImage`** (`dist/utils/image-resize.d.ts:11` + `.js`):
```ts
export declare function resizeImage(
  inputBytes: Uint8Array, mimeType: string, options?: ImageResizeOptions
): Promise<ResizedImage | null>;
```
Runtime (`dist/utils/image-resize.js`): tries a **Worker thread** (Photon WASM); on worker error, falls
back to `resizeImageInProcess`. **Resolves `null`** when the image cannot be brought under `maxBytes`
(defaults 2000×2000, ~4.5 MB). Returned `data` is plain base64 via `Buffer.from(buffer).toString("base64")`
— **no `data:` prefix**. → Wrap the Buffer: `new Uint8Array(buf)` (param is named `inputBytes` in dist).

**`ImageContent`** (`node_modules/@earendil-works/pi-ai/dist/types.d.ts:239-243`):
```ts
export interface ImageContent { type: "image"; data: string; mimeType: string; }
```

**Input runner image-array semantics** (`dist/core/extensions/runner.js:882-920`, per system_context.md):
> `transform` with `images` **omitted** → keeps prior images.
> `transform` with `images` **present** → **REPLACES** the array.
→ Returning only `[newImage]` would destroy user images. Seed `[...imagesIn]`, return in full.

### Current Codebase tree

```bash
# Run from project root: /home/dustin/projects/pi-auto-reader
.
├── .gitignore          # ignores node_modules/, dist/, .pi-subagents/ — NOT .ts
├── PRD.md              # READ-ONLY source of truth
├── sharp-at-file.ts    # ← EXISTS after T1.S1+T1.S2 (+ T2.S1 when merged). T3.S1 EDITS THIS.
└── plan/
    └── 001_5aa8724eb506/
        ├── architecture/{api_verification,system_context,external_deps,extension_patterns}.md
        ├── prd_snapshot.md / prd_index.txt
        ├── tasks.json          # orchestrator-owned, DO NOT TOUCH
        ├── P1M1T1S1/{PRP.md, research/}
        ├── P1M1T1S2/{PRP.md, research/}
        ├── P1M1T2S1/{PRP.md, research/}
        └── P1M1T3S1/
            ├── research/research_notes.md   # THIS TASK's research
            └── PRP.md                       # ← THIS FILE
# NOTE: NO src/, NO package.json, NO tsconfig, NO test framework. Single-file jiti extension.
```

### Starting file state (when T3.S1 begins — after T1.S1+T1.S2, and T2.S1's contract is satisfied)

The file `sharp-at-file.ts` already contains (in order): the 6 imports (T2.S1 adds `type ResizedImage`
to the value-import line) → `FILE_INJECT_RE` / `MIME_BY_EXT` / `TRAILING_PUNCT` (S1) → `cleanToken` /
`expandTildeAndResolve` / `extOf` (S2) → `isBinary` / `formatTextFileBlock` / `formatImageBlock` /
`formatBinaryBlock` (T2.S1) → the **factory stub** (`export default function (pi: ExtensionAPI) {
pi.on("input", async (event, ctx) => { return { action: "continue" }; }); }`).

**T3.S1 inserts `injectFiles` immediately above the factory line.** The factory stub is the stable
anchor; T3.S1 does NOT touch it.

### Desired Codebase tree with files to be added

```bash
# T3.S1 adds NO new files. It edits sharp-at-file.ts in place:
sharp-at-file.ts
  # (S1/S2/T2.S1 regions — unchanged)
  #   imports (6, incl type ResizedImage)
  #   const FILE_INJECT_RE / MIME_BY_EXT / TRAILING_PUNCT
  #   export function cleanToken / expandTildeAndResolve / extOf
  #   export function isBinary / formatTextFileBlock / formatImageBlock / formatBinaryBlock
  # (T3.S1 region — NEW: the core orchestrator)
  + export async function injectFiles(text, imagesIn, ctx): Promise<{text, images, injected}> { ... }
  # (factory region — UNCHANGED; T3.S2 will later replace the stub body)
  #   export default function (pi: ExtensionAPI) { pi.on("input", ...) }   // stub stays as-is
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL — Image-array MERGE, not replace. The input runner REPLACES the images array when a
// `transform` result carries `images` (runner.js:882-920). If injectFiles returned only newly-pushed
// images, every user-attached image would be destroyed. Seed `const images = [...imagesIn];` at the
// top and RETURN that array (the copy) on count>0. On count===0, return the ORIGINAL `imagesIn`
// reference (item §3i) so the caller (T3.S2) can detect "nothing changed" and `continue`.

// CRITICAL — resizeImage takes a Uint8Array, NOT a Buffer. Wrap explicitly: `new Uint8Array(buf)`.
// (dist param is named `inputBytes`.) It is ASYNC and spawns a Worker thread; it resolves null (does
// NOT throw) when it can't process/bring-under-maxBytes. The null branch must fall back to the raw
// ORIGINAL bytes: `data: resized?.data ?? buf.toString("base64")`, `mimeType: resized?.mimeType ?? mime`.

// CRITICAL — Image files SKIP the NUL-byte check entirely. Classification is by MIME FIRST:
//   if (mime) { IMAGE path } else { TEXT/BINARY path (isBinary) }
// An image whose encoded bytes happen to contain 0x00 must NOT be routed to formatBinaryBlock.
// (PRD §5.2 / item §1.)

// CRITICAL — Never throw out of injectFiles. Each file's stat+read+resize is wrapped in its OWN
// try/catch. On error: `continue` (leave that token verbatim, do NOT push a block). A single bad
// token must never abort the rest, and a prompt must never be lost. (PRD §5.4, §12.5.)

// CRITICAL — Empty files (0 bytes) are INJECTED, not skipped. This is an INTENTIONAL divergence from
// processFileArguments (which does `if (stats.size === 0) continue`). It needs NO special code: an
// empty Buffer is not binary (isBinary => false) => text branch => formatTextFileBlock(abs, "") =>
// `<file name="ABS">\n\n</file>`. count++ still fires. (PRD §10, item §1.)

// CRITICAL — Do NOT modify the original prompt text. `#@` markers stay in place; blocks are APPENDED
// after `\n\n---\n\n` and joined with `\n\n`. Inlining would wreck the transcript for large files.
// (PRD §6.2, §12.10.)

// GOTCHA — `String.prototype.matchAll` does NOT mutate the global regex's lastIndex (unlike a manual
// exec() loop). Using `for (const m of text.matchAll(FILE_INJECT_RE))` is safe and idiomatic; there
// is no lastIndex-reset step needed. (system_context.md Risks #6 mitigation.)

// GOTCHA — `let st;` is left untyped intentionally. jiti is transpile-only (no type-check), and the
// Stats type isn't reachable via the `promises as fs` namespace without an extra import. `st` is
// always assigned inside its try before `st.isFile()` is read. Matches PRD §9 pseudocode verbatim.

// GOTCHA — `m[2]` is the path token because FILE_INJECT_RE's leading `(^|(?<=\W))` is zero-width.
// Do NOT use `m[1]` (undefined — group 1 is the zero-width alternation, captured only when `^`).
// Do NOT use `m[0]` as the path (it includes the `#@` prefix). Verified: m[2] === token-after-#@.

// OK — Function declarations are HOISTED in module scope. Even if injectFiles is textually placed
// BEFORE the T2.S1 helpers (possible under parallel edits), the runtime calls resolve correctly.
// The IDEAL order (helpers → injectFiles → factory) is achieved because T3.S1 runs after T2.S1
// (dependency order in plan_status), so anchoring "before the factory" lands injectFiles after them.

// OK — Exporting injectFiles (named export) is safe. Pi's loader only checks `mod.default` is a
// function (api_verification.md §5; verified in T1.S2 PRP). The export exists purely to enable the
// model-free Level-2 gate. T3.S2 still calls it as a module-local function regardless.
```

## Implementation Blueprint

### Data models and structure

No new data models. `injectFiles` returns a plain object literal `{ text, images, injected }`:

```ts
// Return shape (NOT an InputEventResult — the handler T3.S2 translates it):
{
  text: string;            // original text if injected===0; else original + "\n\n---\n\n" + blocks.join("\n\n")
  images: ImageContent[];  // === imagesIn (original ref) if injected===0; else the [...imagesIn] copy (+ appended)
  injected: number;        // count of successfully injected files (blocks pushed and/or images attached). 0 = none.
}
```

The `ctx` parameter is the **minimal structural type `{ cwd: string }`** (not the full `ExtensionContext`),
so the function is testable with a plain object and the real `ctx` from T3.S2 satisfies it structurally.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: EDIT ./sharp-at-file.ts (single insert; file already exists from S1+S2+T2.S1)
  - OBJECTIVE: Add the core assembly orchestrator `injectFiles`.
  - INSERT POINT: immediately before `export default function (pi: ExtensionAPI) {` (unique anchor).
  - WRITE: the function from "Exact source" below, VERBATIM.
  - FOLLOW pattern: PRD §9 pseudocode (the authoritative reference implementation).
  - NAMING: injectFiles (exact, camelCase). Exported (named export) for testability.
  - SIGNATURE: async (text: string, imagesIn: ImageContent[], ctx: { cwd: string })
               => Promise<{ text: string; images: ImageContent[]; injected: number }>
  - CONSUMES (already present — do NOT redefine):
      FILE_INJECT_RE, MIME_BY_EXT                      (S1 constants)
      cleanToken, expandTildeAndResolve, extOf         (S2 helpers)
      isBinary, formatTextFileBlock, formatImageBlock, formatBinaryBlock  (T2.S1 helpers)
      resizeImage                                       (S1 value-import)
      ImageContent (type)                              (S1 type-import)
  - NEW IMPORTS: NONE.
  - PLACEMENT: module scope, before the factory. NOT inside the factory.
  - DO NOT (out of scope — owned elsewhere):
      - the real handler body / guards / notify / transform-vs-continue (T3.S2).
      - redefine any S1/S2/T2.S1 helper or constant.
      - modify the factory stub body, the imports, or any prior code.
      - create package.json/tsconfig/test files/README.
```

### Exact source to write (authoritative — copy verbatim, then run the validation gates)

Insert this block immediately above `export default function (pi: ExtensionAPI) {`:

```typescript
/**
 * PRD §9 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read each,
 * append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image), and return the
 * transformed prompt + merged images + count. NEVER throws (each file is isolated in try/catch);
 * tokens that miss/are directories/throw are left verbatim. The original prompt text is NOT modified —
 * blocks are appended after `\n\n---\n\n`, joined with `\n\n` (PRD §6.2). `injected` is a COUNT:
 * 0 => caller (T3.S2) returns {action:"continue"}; >0 => {action:"transform", text, images}.
 */
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: { cwd: string },
): Promise<{ text: string; images: ImageContent[]; injected: number }> {
  const blocks: string[] = [];
  const images = [...imagesIn]; // MERGE — runner REPLACES the array on transform; seed originals (item §3a)
  let count = 0;

  for (const m of text.matchAll(FILE_INJECT_RE)) {
    const raw = m[2]; // capture group 2 = path token after #@ (group 1 is the zero-width ^ anchor)
    const token = cleanToken(raw); // trim trailing punctuation (S2)
    if (!token) continue; // empty after trim => skip, leave verbatim

    const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue; // missing file => leave token verbatim (PRD §5.4)
    }
    if (!st.isFile()) continue; // directory / socket / etc. => leave token verbatim (PRD §5.4)

    const ext = extOf(abs); // lowercase ext, "" for no-dot/hidden (S2)
    const mime = MIME_BY_EXT[ext]; // undefined => not a recognized image => text/binary path

    try {
      if (mime) {
        // IMAGE path (PRD §5.2) — classified by MIME first; SKIPS the NUL-byte check entirely.
        const buf = await fs.readFile(abs);
        const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
        images.push({
          type: "image",
          data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
          mimeType: resized?.mimeType ?? mime, // null => original mime
        });
        blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file> (T2.S1 guards null)
      } else {
        // TEXT / BINARY path (PRD §5.1 / §5.3)
        const buf = await fs.readFile(abs);
        if (isBinary(buf)) {
          blocks.push(formatBinaryBlock(abs)); // §5.3 note — no decoded garbage (em dash U+2014)
        } else {
          blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
        }
      }
      count++;
    } catch {
      // read/resize error => leave THIS token verbatim, keep processing the rest (PRD §5.4, §12.5)
      continue;
    }
  }

  if (count === 0) return { text, images: imagesIn, injected: 0 }; // ORIGINAL ref — nothing changed (item §3i)

  const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`; // append; original text untouched (PRD §6.2)
  return { text: finalText, images, injected: count };
}
```

**Why every line is exactly this:**

| Element | Rationale & source |
|---|---|
| `const images = [...imagesIn]` | **Merge contract.** The runner REPLACES the images array on `transform`-with-images (runner.js:882-920). Seeding the copy preserves user images. Returned in full on `count>0`. |
| `for (const m of text.matchAll(FILE_INJECT_RE))` | Iterates all `#@` matches. `matchAll` does not mutate `lastIndex` (no stale-state bug). `m[2]` is the token (zero-width `(^|(?<=\W))` anchor; verified matrix in research §5). |
| `const raw = m[2]` | Capture group 2 = the path token. NOT `m[0]` (includes `#@`) nor `m[1]` (the zero-width `^`, undefined when the lookbehind matched). |
| `cleanToken(raw)` → `if (!token) continue` | S2 helper trims trailing punctuation. `""` ⇒ token was all-punct/empty ⇒ skip, leave verbatim. |
| `expandTildeAndResolve(token, ctx.cwd)` | S2 helper: `~`/`~/` expand via `os.homedir()`, then `path.resolve(cwd, …)`. Uses `ctx.cwd` (the minimal structural param). |
| `try { st = await fs.stat(abs) } catch { continue }` | Missing file ⇒ leave token verbatim (PRD §5.4). Never throws. |
| `if (!st.isFile()) continue` | Directory / FIFO / socket ⇒ leave token verbatim (PRD §5.4). Only regular files inject. |
| `const mime = MIME_BY_EXT[extOf(abs)]` → `if (mime)` | **Classification by MIME FIRST.** Recognized image ext ⇒ image path; undefined ⇒ text/binary path. Images never reach `isBinary` (PRD §5.2, item §1). |
| `await resizeImage(new Uint8Array(buf), mime)` | Wrap Buffer as Uint8Array (dist param `inputBytes`). Async Worker; resolves `null` on failure. |
| `data: resized?.data ?? buf.toString("base64")` | **Null-fallback.** `resizeImage`→null ⇒ raw base64 of the ORIGINAL image bytes (not `data:` URL). Verified empirically (research §4). |
| `mimeType: resized?.mimeType ?? mime` | Null ⇒ original mime (e.g. `image/png`). |
| `blocks.push(formatImageBlock(abs, resized))` | Image gets BOTH an attached ImageContent AND a `<file>` reference block. `formatImageBlock(abs, null)` is safe — T2.S1 guards null before `formatDimensionNote`. |
| `if (isBinary(buf)) formatBinaryBlock else formatTextFileBlock` | Non-image routing: NUL byte ⇒ binary note (no garbage); else inject ENTIRE file decoded utf8 (no truncation — PRD §5.1 defining behavior). |
| per-file `try { … count++ } catch { continue }` | **Error isolation.** One bad file never aborts the rest; never throws out. `count++` only on success. |
| `if (count === 0) return { text, images: imagesIn, injected: 0 }` | Returns the **ORIGINAL** `imagesIn` reference (not the copy) — signals "nothing changed" so the caller (T3.S2) can `continue`. Text byte-for-byte unchanged. |
| `finalText = \`${text}\n\n---\n\n${blocks.join("\n\n")}\`` | **Append, don't inline.** Original text + horizontal rule + blocks joined by blank line. Original `#@` markers remain (PRD §6.2, §12.10). |
| `return { text: finalText, images, injected: count }` | Returns the copy (`images`) which contains all originals + any appended images. `injected` is the count (>0 ⇒ T3.S2 returns `transform`). |

### Implementation Patterns & Key Details

```typescript
// PATTERN (orchestrator): injectFiles is a thin per-token pipeline that delegates every primitive to
// an already-tested helper (S2 parsing, T2.S1 format/binary). It owns ONLY: iteration, I/O (stat/read),
// the resizeImage call + null-fallback, the ImageContent push, the blocks[]/count accumulation, and
// the final assembly/return shape. This is why it stays readable and why each prior helper is unit-pinned.

// PATTERN (error isolation): the OUTER try/catch wraps the WHOLE per-file body (stat is in its own
// try because a stat-failure must skip classification entirely — there's no `st` to read). Inner
// read/resize errors fall into the same catch via `continue`. Critically, `count++` is INSIDE the try,
// AFTER all work succeeds — so a mid-file error leaves count unincremented and no partial block pushed.

// PATTERN (merge): `images` is the SINGLE source of truth for the image array. It starts as a copy of
// imagesIn, accumulates pushes, and is returned verbatim (on count>0). The original `imagesIn` is
// returned ONLY on count===0. Never construct a fresh array at return time (that would drop originals).

// GOTCHA (count===0 vs count>0 return): these return DIFFERENT array references by design.
//   count===0 => imagesIn (original)   -- caller does `continue`, no transform, nothing to merge.
//   count>0   => images (the copy)     -- caller does `transform` with the full merged array.
// Do NOT "simplify" by always returning `images` — that would return a NEW array on count===0 and
// obscure the "nothing changed" signal. (Item §3i is explicit: return ORIGINAL on count===0.)
```

### Integration Points

```yaml
MODULE sharp-at-file.ts (in-place insert; no build step):
  - insertion: "Immediately before `export default function (pi: ExtensionAPI) {`."
  - new_imports: NONE. resizeImage + ImageContent + all helpers/constants are already imported/present.
  - concurrency: "Function declarations are hoisted, so textual order vs the T2.S1 helpers is
    correctness-irrelevant. T3.S1 runs after T2.S1 (plan_status dependency order), so anchoring
    'before the factory' naturally yields the ideal order: helpers → injectFiles → factory."

NO DATABASE / NO CONFIG / NO ROUTES / NO NEW ENV VARS / NO NEW FILES:
  - "Internal core function. No user-facing, config, or API surface. (PRD §2 Non-Goals: no config.)"

DOWNSTREAM CONSUMER (do NOT implement now — satisfy its contract only):
  - T3.S2 handler will call: `const { text, images, injected } = await injectFiles(event.text,
        event.images ?? [], ctx);` then `if (!injected) return { action: "continue" };` else
        `return { action: "transform" as const, text, images };` (+ `if (ctx.hasUI) ctx.ui.notify(...)`).
  - The `{ cwd: string }` param type means T3.S2 passes the real `ctx` (which has cwd per
        api_verification.md §5) and it satisfies the structural type.
```

## Validation Loop

> This project has **no test framework, no linter, no type-checker** (greenfield single-file jiti
> extension). The `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY. Use the gates below
> — TypeScript/Pi-specific, **verified working on this machine**, requiring **no model/API key**.
> `injectFiles` does real I/O (fs.stat/readFile + resizeImage Worker), so the Level-2 gate creates real
> temp files. The full suite was **pre-run green (45/45)** in research against a reference copy of this
> exact source.

### Level 1: Syntax & Placement (Immediate Feedback)

```bash
cd /home/dustin/projects/pi-auto-reader

# 1a. injectFiles is an exported async function at module scope (column 1).
grep -nE '^export async function injectFiles' sharp-at-file.ts
# Expected: exactly 1 line, anchored at column 1.

# 1b. It sits BEFORE the factory (the insertion anchor).
INJ=$(grep -nE '^export async function injectFiles' sharp-at-file.ts | cut -d: -f1)
FACTORY=$(grep -nE '^export default function \(pi: ExtensionAPI\)' sharp-at-file.ts | cut -d: -f1)
[ -n "$INJ" ] && [ -n "$FACTORY" ] && [ "$INJ" -lt "$FACTORY" ] \
  && echo "OK: injectFiles ($INJ) before factory ($FACTORY)" \
  || echo "FAIL: injectFiles not before factory"

# 1c. The factory stub is STILL a pass-through (T3.S1 must NOT have touched it).
grep -A2 'pi.on("input"' sharp-at-file.ts | grep -q 'action: "continue"' \
  && echo "OK: factory stub intact" || echo "FAIL: factory stub altered (out of scope)"

# 1d. No out-of-scope T3.S2 handler symbols leaked (guards/notify/transform-live in the factory).
grep -nE 'event\.source|streamingBehavior|ctx\.ui\.notify|action: "transform"' sharp-at-file.ts \
  && echo "FAIL: T3.S2 handler symbols present (out of scope)" || echo "OK: no T3.S2 symbols leaked"

# 1e. No new imports were added (S1 already imported everything injectFiles needs).
grep -cE "^import " sharp-at-file.ts   # Expected: 6 (T2.S1's type ResizedImage is inline on line 3, not a new line)

# Expected: 1a prints 1 line; 1b/1c/1d print OK; 1e prints 6.
```

### Level 2: jiti Transpile + Full Assertion Suite (PRIMARY GATE — pre-run green)

This replicates Pi's loader (`jiti.import` with package aliases), imports `injectFiles` + the format
helpers (for building expected strings), creates real temp files (text/binary/empty/dir/missing/png),
and asserts all 13 scenario groups. **Proven pre-run: 45/45 green.** No model, no API key, non-interactive.

```bash
cd /home/dustin/projects/pi-auto-reader
cat > /tmp/gate_t3s1.mjs <<'GATE'
import { createJiti } from "file:///home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs";
import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const PI = "/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": PI + "/dist/index.js",
  "@earendil-works/pi-ai": PI + "/node_modules/@earendil-works/pi-ai/dist/index.js",
}});
const mod = await jiti.import(pathToFileURL("./sharp-at-file.ts").href);

let pass = 0, fail = 0;
const T = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("FAIL:", name); } };

// --- exports present ---
T("default export is function", typeof mod.default === "function");
T("injectFiles exported", typeof mod.injectFiles === "function");
const { injectFiles, formatTextFileBlock, formatImageBlock, formatBinaryBlock } = mod;

// --- temp sandbox ---
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "inj-"));
const abs = (rel) => path.resolve(cwd, rel);
await fs.writeFile(abs("note.txt"), "hello world");
await fs.writeFile(abs("multi.md"), "line1\nline2\nline3");
await fs.writeFile(abs("empty.txt"), "");                                   // 0 bytes
await fs.writeFile(abs("data.bin"), Buffer.concat([Buffer.from("HEADER"), Buffer.from([0,1,2,3]), Buffer.from("tail")])); // NUL byte
await fs.mkdir(abs("adir"));                                                // directory
const PNG_HEX = "89504e470d0a1a0a0000000d4948445200000002000000020802000000fd4f4f510000000f49444154789c6360f8cf0000000300014863a0d8a60000000049454e44ae426082";
const pngBuf = Buffer.from(PNG_HEX, "hex");
await fs.writeFile(abs("pic.png"), pngBuf);
const fakeImg = { type: "image", data: "USER_BASE64", mimeType: "image/png" };

try {
  // 1. No #@ => injected 0, text unchanged
  const r1 = await injectFiles("hello there", [], { cwd });
  T("no-#@ injected===0", r1.injected === 0);
  T("no-#@ text unchanged", r1.text === "hello there");
  T("no-#@ returns [] images", Array.isArray(r1.images) && r1.images.length === 0);

  // 2. count===0 (missing file) => ORIGINAL imagesIn reference + token verbatim
  const imagesIn2 = [fakeImg];
  const r2 = await injectFiles("Review #@nonexistent.txt please", imagesIn2, { cwd });
  T("missing injected===0", r2.injected === 0);
  T("missing text unchanged", r2.text === "Review #@nonexistent.txt please");
  T("missing returns ORIGINAL imagesIn ref", r2.images === imagesIn2);

  // 3. directory token => verbatim, injected 0
  const r3 = await injectFiles("see #@adir/", [fakeImg], { cwd });
  T("dir injected===0", r3.injected === 0);
  T("dir text verbatim", r3.text === "see #@adir/");

  // 4. single text file => append after separator, original preserved, exact block
  const r4 = await injectFiles("Look #@note.txt", [], { cwd });
  T("text injected===1", r4.injected === 1);
  T("text marker preserved", r4.text.startsWith("Look #@note.txt"));
  T("text has --- separator", r4.text.includes("\n\n---\n\n"));
  T("text exact output", r4.text === "Look #@note.txt\n\n---\n\n" + formatTextFileBlock(abs("note.txt"), "hello world"));

  // 5. multiple files => order preserved, joined with \n\n, injected 2
  const r5 = await injectFiles("#@note.txt then #@multi.md", [], { cwd });
  T("multi injected===2", r5.injected === 2);
  const b1 = formatTextFileBlock(abs("note.txt"), "hello world");
  const b2 = formatTextFileBlock(abs("multi.md"), "line1\nline2\nline3");
  T("multi exact output", r5.text === "#@note.txt then #@multi.md\n\n---\n\n" + b1 + "\n\n" + b2);

  // 6. EMPTY file => injected as <file name="ABS">\n\n</file> (intentional divergence)
  const r6 = await injectFiles("#@empty.txt", [], { cwd });
  T("empty injected===1", r6.injected === 1);
  T("empty block blank-content", r6.text.endsWith(formatTextFileBlock(abs("empty.txt"), "")));
  T("empty block literal", r6.text.includes('<file name="' + abs("empty.txt") + '">\n\n</file>'));

  // 7. binary file => formatBinaryBlock (em dash), NO garbage
  const r7 = await injectFiles("#@data.bin", [], { cwd });
  T("binary injected===1", r7.injected === 1);
  T("binary uses formatBinaryBlock", r7.text.endsWith(formatBinaryBlock(abs("data.bin"))));
  T("binary has em dash U+2014", r7.text.includes("\u2014"));
  T("binary no decoded garbage", !r7.text.includes("HEADER"));

  // 8. IMAGE path => ImageContent attached; fallback when resizeImage null
  const pngRawB64 = pngBuf.toString("base64");
  const r8 = await injectFiles("#@pic.png", [], { cwd });
  T("image injected===1", r8.injected === 1);
  T("image attached (len 1)", r8.images.length === 1);
  T("image type=image", r8.images[0].type === "image");
  T("image mimeType=image/png", r8.images[0].mimeType === "image/png");
  T("image data non-empty base64", typeof r8.images[0].data === "string" && r8.images[0].data.length > 0);
  T("image data no data: prefix", !r8.images[0].data.startsWith("data:"));
  T("image block is <file> tag", r8.text.includes('<file name="' + abs("pic.png") + '">'));
  // resizeImage deterministically returns null for this tiny PNG in this env => fallback branch:
  if (r8.images[0].data === pngRawB64) {
    T("image FALLBACK data===raw base64", r8.images[0].data === pngRawB64);
    T("image FALLBACK block empty hints", r8.text.endsWith(formatImageBlock(abs("pic.png"), null)));
  } else {
    T("image RESIZED branch (data differs from raw)", r8.images[0].data !== pngRawB64);
  }

  // 9. MERGE contract: user image preserved when injecting an image (count>0)
  const r9 = await injectFiles("#@pic.png", [fakeImg], { cwd });
  T("merge-image len===2", r9.images.length === 2);
  T("merge-image user[0] preserved", r9.images[0] === fakeImg);
  T("merge-image new[1] attached", r9.images[1].type === "image" && r9.images[1].mimeType === "image/png");

  // 10. MERGE contract: count>0 with TEXT file returns a COPY (ref !== imagesIn) containing user image
  const imagesIn10 = [fakeImg];
  const r10 = await injectFiles("#@note.txt", imagesIn10, { cwd });
  T("merge-text injected===1", r10.injected === 1);
  T("merge-text returns NEW array (ref differs)", r10.images !== imagesIn10);
  T("merge-text copy len 1", r10.images.length === 1);
  T("merge-text copy[0]===user image", r10.images[0] === fakeImg);

  // 11. original prompt text NOT modified; markers remain; blocks appended after separator
  const r11 = await injectFiles("Please review #@note.txt carefully", [], { cwd });
  T("marker remains", r11.text.startsWith("Please review #@note.txt carefully"));
  T("appended after separator", r11.text === "Please review #@note.txt carefully\n\n---\n\n" + formatTextFileBlock(abs("note.txt"), "hello world"));

  // 12. mixed: one missing + one valid => only valid injected; missing token verbatim
  const r12 = await injectFiles("#@nope.txt and #@note.txt", [], { cwd });
  T("mixed injected===1", r12.injected === 1);
  T("mixed missing token verbatim", r12.text.startsWith("#@nope.txt and #@note.txt"));
  T("mixed only note appended", r12.text.endsWith(formatTextFileBlock(abs("note.txt"), "hello world")));

  // 13. read error caught (chmod 000) => token verbatim, others continue [platform-dependent]
  await fs.writeFile(abs("noperm.txt"), "secret");
  let ranNoperm = false;
  try {
    await fs.chmod(abs("noperm.txt"), 0o000);
    // Confirm the restriction actually took effect (no-op if running as root / unsupported FS)
    const mode = (await fs.stat(abs("noperm.txt"))).mode & 0o777;
    if (mode === 0 && process.getuid?.() !== 0) {
      ranNoperm = true;
      const r13 = await injectFiles("#@noperm.txt and #@note.txt", [], { cwd });
      T("noperm injected===1 (only readable)", r13.injected === 1);
      T("noperm note still appended", r13.text.endsWith(formatTextFileBlock(abs("note.txt"), "hello world")));
      T("noperm never threw", typeof r13 === "object");
    }
  } catch { /* chmod unsupported — skip */ }
  finally { try { await fs.chmod(abs("noperm.txt"), 0o644); } catch {} }
  if (!ranNoperm) console.log("   [skip] noperm test (chmod ineffective on this platform/user) — non-blocking");
} finally {
  await fs.rm(cwd, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
GATE
node /tmp/gate_t3s1.mjs
# Expected: "NN passed, 0 failed", exit 0. (Pre-run: 45 passed, 0 failed.)
# If any FAIL: READ the failure name, compare against the exact-source block, fix, re-run.
```

### Level 3: Authoritative Pi Loader (System Validation — optional confidence)

```bash
cd /home/dustin/projects/pi-auto-reader
# Confirms Pi's REAL loader (with its real getAliases()) still accepts the edited file.
# -e loads the extension; -ne disables discovery so ONLY our -e file loads; -p makes it non-interactive.
# NOTE: -p attempts ONE model turn after loading — requires a configured provider. The extension LOADS
# before any model call; a provider error AFTER load does NOT indicate an injectFiles failure.
# ALSO: the factory is STILL the pass-through stub (T3.S2 not yet applied), so even a #@ prompt is
# returned unchanged — that is CORRECT for this subtask.
pi -e ./sharp-at-file.ts -ne -p "injectFiles load check #@a.txt" 2>&1 | tee /tmp/pi_t3s1.log
grep -qiE "error|invalid factory|does not export|is not defined" /tmp/pi_t3s1.log \
  && echo "FAIL: load error above" || echo "OK: no load error"
# Expected: no "does not export a valid factory function" / syntax / import errors.
# (Level 2 already proves load + behavior; use this only for final confidence if a provider is set.)
```

### Level 4: Cross-Subtask State Check (S1+S2+T2.S1+T3.S1 coexist)

After editing, the file must still contain ALL prior work — none clobbered — and the factory stub must
remain the pass-through (T3.S2 owns its replacement).

```bash
cd /home/dustin/projects/pi-auto-reader
echo "--- S1 constants ---"
grep -cE '^const (FILE_INJECT_RE|MIME_BY_EXT|TRAILING_PUNCT)' sharp-at-file.ts        # Expected: 3
echo "--- S2 helpers ---"
grep -cE '^export function (cleanToken|expandTildeAndResolve|extOf)' sharp-at-file.ts  # Expected: 3
echo "--- T2.S1 helpers ---"
grep -cE '^export function (isBinary|formatTextFileBlock|formatImageBlock|formatBinaryBlock)' sharp-at-file.ts  # Expected: 4
echo "--- T3.S1 core ---"
grep -cE '^export async function injectFiles' sharp-at-file.ts                         # Expected: 1
echo "--- factory stub still pass-through ---"
grep -A2 'pi.on("input"' sharp-at-file.ts | grep -q 'action: "continue"' \
  && echo "OK: factory stub intact (T3.S2 will replace it)" || echo "FAIL: factory stub altered"
# Expected: 3, 3, 4, 1, and "OK: factory stub intact".
```

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: `injectFiles` grep at column 1 before the factory; factory stub intact; no T3.S2 symbols;
      import count still 6.
- [ ] Level 2: jiti gate prints `NN passed, 0 failed` (pre-run 45/0), exit 0.
- [ ] Level 3 (optional, if provider configured): no load error in `pi -e ... -p` output.
- [ ] Level 4: S1 (3) + S2 (3) + T2.S1 (4) + T3.S1 (1) + factory stub all coexist.

### Feature Validation
- [ ] `injected===0` (no valid token) returns ORIGINAL `imagesIn` ref + byte-for-byte unchanged text.
- [ ] Text file → entire content injected in a `<file>` block appended after `\n\n---\n\n`.
- [ ] Empty file (0 bytes) → `<file name="ABS">\n\n</file>` (injected, NOT skipped).
- [ ] Binary file (NUL) → `formatBinaryBlock` note with em dash; no garbage.
- [ ] Image file → `ImageContent` attached (base64, no `data:`) + `<file>` block; null-resize fallback
      uses raw `buf.toString("base64")`.
- [ ] Missing / directory / read-error → token left verbatim; others still processed; never throws.
- [ ] Multiple files → blocks appended in order, joined with `\n\n`, `injected` counts each.
- [ ] Merge: user images preserved on both count===0 (original ref) and count>0 (copy with appends).
- [ ] Original prompt text never modified — `#@` markers remain in place.

### Code Quality Validation
- [ ] `injectFiles` at MODULE scope, before the factory (PRD §8 section 4 placement).
- [ ] Exact signature: `async (text: string, imagesIn: ImageContent[], ctx: { cwd: string })`.
- [ ] Exported (named export) for testability — does not break Pi's default-export check.
- [ ] No new imports; no new files; no edits to imports/constants/S2+T2.S1 helpers/factory body.
- [ ] Each file isolated in its own try/catch; `count++` inside the try after success only.
- [ ] `images` seeded `[...imagesIn]`; original `imagesIn` returned only on count===0.

### Documentation & Deployment
- [ ] No new env vars, config, or user-facing surface (PRD §2: no config).
- [ ] JSDoc cites PRD §9 + the count→continue/transform contract for the T3.S2 implementer.
- [ ] Function is self-documenting (descriptive names + PRD § references + inline comments).

---

## Anti-Patterns to Avoid

- ❌ Don't return a fresh `images` array on `count===0` — return the **original** `imagesIn` reference.
  The caller (T3.S2) relies on the "nothing changed" signal to `continue`; a new array obscures it
  (item §3i). On `count>0`, return the seeded `images` copy.
- ❌ Don't pass a `Buffer` to `resizeImage` — it takes `Uint8Array`. Wrap: `new Uint8Array(buf)`.
  (dist param is named `inputBytes`.)
- ❌ Don't let `resizeImage`'s null return leak `undefined` into `ImageContent.data` — fall back to
  `buf.toString("base64")` (and `mime` for mimeType). A null return means "couldn't process", not "skip".
- ❌ Don't run `isBinary` on image files — classify by MIME **first** (`if (mime)`), so images skip the
  NUL check entirely. An image's bytes may legitimately contain `0x00` and must not be misrouted to
  `formatBinaryBlock` (PRD §5.2, item §1).
- ❌ Don't skip empty files — inject them as `<file name="ABS">\n\n</file>`. This is the INTENTIONAL
  divergence from `processFileArguments` (which does `if (stats.size === 0) continue`). No special code
  is needed; the text path handles it naturally (PRD §10, item §1).
- ❌ Don't throw out of `injectFiles` — wrap each file's stat/read/resize in its own try/catch and
  `continue` on error. A prompt must never be lost (PRD §5.4, §12.5).
- ❌ Don't modify the original prompt text or inline-replace `#@` markers — append blocks after
  `\n\n---\n\n`, joined with `\n\n` (PRD §6.2, §12.10). Large files would wreck the transcript otherwise.
- ❌ Don't put `count++` outside the try — it must increment ONLY on full success (after read/resize/format
  all succeed), so a mid-file error leaves count unincremented and no partial block pushed.
- ❌ Don't implement the handler body (guards/notify/transform-vs-continue) — that is T3.S2. Leave the
  factory stub as the pass-through.
- ❌ Don't redefine any S1/S2/T2.S1 helper or constant — consume them. No new imports.
- ❌ Don't use `m[0]` or `m[1]` for the path token — `m[2]` is the token after `#@` (group 1 is the
  zero-width `^` alternation; `m[0]` includes the `#@` prefix).
- ❌ Don't add truncation, word counts, or byte limits anywhere — "the whole file, every time" is the
  defining behavior of `#@` (PRD §5.1, §12.11, §13).

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: The function body is fully prescriptive (exact source provided, copied from PRD §9 and
verified), and the **entire implementation + its 45-assertion validation suite were pre-run green**
against a reference copy in this environment (research §7). Every API claim is pre-verified with
`path:line` evidence: `resizeImage`'s `Uint8Array` param + async-Worker + null-on-failure (empirically
confirmed it returns `null` for the test PNG → the fallback branch is the one deterministically
exercised, matching item §1's emphasis); the runner's image-array-REPLACE semantics (justifying the
merge seed); `matchAll(FILE_INJECT_RE)` capture-group behavior (verified matrix); and the empty-file
no-special-code path. The two load-bearing subtleties (merge contract + empty-file divergence) each
have dedicated assertion groups. Residual 0.5 risk is a transcription slip (e.g., `m[1]` instead of
`m[2]`, returning the copy on count===0, or forgetting the `new Uint8Array(buf)` wrap) — all fully
caught by Level 1 grep + the 45-assertion Level 2 gate.
