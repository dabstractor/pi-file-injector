# Research Notes — P1.M1.T2.S1

**Work item:** Binary detection + text/image/binary format block helpers
**Target file:** `./file-injector.ts` (in-place edit; S1 scaffold + S2 parsing helpers already present)
**Deliverables:** 4 exported pure functions — `isBinary`, `formatTextFileBlock`, `formatImageBlock`,
`formatBinaryBlock` — inserted at module scope before the factory.

All facts below are **empirically verified** against the installed Pi package
(`@earendil-works/pi-coding-agent`) on this machine, and the full 23-case assertion suite (in the PRP
Level-2 gate) was **pre-run green** against a temp copy of the target file.

---

## 1. Verified API surface (direct source reads)

### 1a. `formatDimensionNote` — signature + behavior

`dist/utils/image-resize.d.ts`:
```ts
export declare function formatDimensionNote(result: ResizedImage): string | undefined;
```

`dist/utils/image-resize.js` (lines 90–96), the actual body:
```js
export function formatDimensionNote(result) {
    if (!result.wasResized) {
        return undefined;              // <- image was NOT resized => undefined
    }
    const scale = result.originalWidth / result.width;
    return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
```

**Confirmed:** `(result: ResizedImage) => string | undefined`; returns `undefined` iff `wasResized === false`.
This is the contract claim, now backed by the source.

### 1b. `ResizedImage` — exact shape + export status

`dist/utils/image-resize-core.d.ts`:
```ts
export interface ResizedImage {
    data: string;          // base64
    mimeType: string;
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    wasResized: boolean;
}
```

`dist/index.d.ts:32` — **`ResizedImage` IS re-exported as a TYPE from the main package**:
```ts
export { formatDimensionNote, type ResizedImage, resizeImage } from "./utils/image-resize.ts";
```
=> It is safe and idiomatic to add `type ResizedImage` to the existing value-import line in
`file-injector.ts`. (Verified: jiti transpiles the inline `type` modifier with no error; it is erased
at runtime — no behavior change, no new runtime dependency.)

### 1c. `processFileArguments` — the format `#@` must match for parity

`dist/cli/file-processor.js` (read completely). The three template strings, verbatim:

| Branch | Template |
|---|---|
| **text** (else) | `` `<file name="${absolutePath}">\n${content}\n</file>\n` `` |
| **image w/ hints** | `` `<file name="${absolutePath}">${processed.hints.join("\n")}</file>\n` `` |
| **image w/o hints** | `` `<file name="${absolutePath}"></file>\n` `` |
| **image fail** | `` `<file name="${absolutePath}">${processed.message}</file>\n` `` |

**CRITICAL PARITY FACT:** `processFileArguments` has **NO binary guard**. A non-image binary falls
through to `await readFile(absolutePath, "utf-8")` → mojibake. This extension's NUL-byte check
(`isBinary`, PRD §5.1) is a **deliberate improvement**, not parity replication. There is no built-in
template for the binary note; the PRD §5.3 string is the authoritative source.

### 1d. Trailing-newline convention (the one intentional difference from parity)

`processFileArguments` emits a trailing `\n` per block because it concatenates with `+=` into one
`text` string. Our extension collects blocks into a `blocks: string[]` array (PRD §6.2) and joins
them; therefore **each helper must OMIT the trailing `\n`** (the assembly join in T3.S1 supplies the
separation). This is explicitly called out in the work-item contract:
> "EXACT match to processFileArguments text format (minus trailing \n which is handled by assembly join)."

Verified: `formatTextFileBlock(...) + "\n"` === processFileArguments text output for the same inputs.

---

## 2. `isBinary` boundary semantics (the subtlest part)

PRD §5.1: "scan the first 8000 bytes for a 0x00 (NUL) byte."
Work item: "scan the first min(buf.length, 8000) bytes."

Implementation chosen:
```ts
export function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}
```

**Boundary behavior (empirically verified, pre-run green):**

| Test | Expected | Verified |
|---|---|---|
| NUL at byte index **7999** (the 8000th byte) | `true` (within window) | ✅ PASS |
| NUL at byte index **8000** (the 8001st byte) | `false` (past window) | ✅ PASS |
| NUL at byte index **8001** | `false` | ✅ PASS |
| plain ASCII text, no NUL | `false` | ✅ PASS |
| empty buffer (`Buffer.alloc(0)`) | `false` (loop doesn't run) | ✅ PASS |
| multi-byte UTF-8 (日本語), no 0x00 byte | `false` | ✅ PASS |
| exactly 8000 bytes, no NUL | `false` | ✅ PASS |

`Math.min(buf.length, 8000)` + `i < n` gives the half-open window `[0, 8000)` = first 8000 bytes — the
standard reading of "first 8000 bytes." Buffer indexing returns a `number` for valid indices; since the
loop is bounded by `n <= buf.length`, `buf[i]` is always valid (never `undefined`). jiti is
transpile-only so there is no `noUncheckedIndexedAccess` concern.

**Why a loop instead of `buf.subarray(0, 8000).includes(0)`:** both are correct and equivalent; the
loop mirrors the PRD wording literally ("scan the first … bytes for a 0x00") and is trivially readable.
`Buffer.prototype.includes(value: number)` would also work. The loop is chosen for clarity.

---

## 3. Image-block hint logic (three input shapes → two output shapes)

`formatImageBlock(abs, resized)` must handle:

| `resized` argument | `formatDimensionNote` result | Output |
|---|---|---|
| `null` (resizeImage returned null / fallback) | n/a (not called) | `<file name="ABS"></file>` (empty hints) |
| non-null, `wasResized: false` | `undefined` | `<file name="ABS"></file>` (empty hints) |
| non-null, `wasResized: true` | the scale note string | `<file name="ABS"><scale note></file>` |

Implementation:
```ts
export function formatImageBlock(abs: string, resized: ResizedImage | null): string {
  const hint = resized != null ? formatDimensionNote(resized) : undefined;
  return '<file name="' + abs + '">' + (hint ?? "") + '</file>';
}
```

- `resized != null` (loose) covers both `null` and `undefined` defensively. Caller (T3.S1) passes
  `ResizedImage | null` per the contract; the loose check is harmless and robust.
- `hint ?? ""` collapses `undefined` → `""` so the empty-hints case produces exactly
  `<file name="ABS"></file>` (matches `processFileArguments` no-hints branch, verified).

Verified: `formatImageBlock("/pic.png", {wasResized:true, width:500,height:500, originalWidth:1000,
originalHeight:1000, data:"d", mimeType:"image/png"})` → `<file name="/pic.png">[Image: original
1000x1000, displayed at 500x500. Multiply coordinates by 2.00 to map to original image.]</file>`.

---

## 4. Binary note — the em dash is load-bearing

PRD §5.3 / §6.1 (verbatim):
```
<file name="/abs/path/to/data.bin"><binary file — contents not injected; use the read tool if needed></file>
```
The `—` is **U+2014 EM DASH**, not an ASCII hyphen `-` (U+002D) and not an en dash `–` (U+2013).
The .ts source file is UTF-8; jiti handles it transparently. Verified: the assertion
`formatBinaryBlock("/x").includes("\u2014")` → true, and `includes(" - ")` → false.

Implementation:
```ts
export function formatBinaryBlock(abs: string): string {
  return '<file name="' + abs + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
}
```
(Note: in the actual source file the literal em-dash character may be written directly as `—` OR as the
`\u2014` escape — both produce byte-identical output. The PRP gives the escape form so the implementer
can't accidentally substitute a hyphen.)

---

## 5. File-state at implementation time (parallel with T1.S2)

`file-injector.ts` **already contains** S1 (imports, 3 constants, factory stub) AND S2 (cleanToken,
expandTildeAndResolve, extOf) — verified by reading the live file. So when T2.S1 runs, the file has:

```
S1 imports (6 lines)
const FILE_INJECT_RE / MIME_BY_EXT / TRAILING_PUNCT   (S1)
export function cleanToken / expandTildeAndResolve / extOf   (S2)
export default function (pi: ExtensionAPI) { ... }    (S1, still the stub — T3.S2 owns the real body)
```

**T2.S1 changes exactly two regions:**
1. The S1 value-import line gains `type ResizedImage`:
   `import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";`
   (S2 did NOT touch this line — verified by its PRP; no conflict.)
2. Four `export function` declarations inserted immediately before
   `export default function (pi: ExtensionAPI) {` (the stable S1 factory anchor).

**Relative order of S2 helpers vs T2.S1 helpers is functionally irrelevant** — all are independent
module-scope functions. Anchoring on the factory line (not on `extOf`) avoids any conflict with the
parallel S2 edit: both insert above the same unchanged factory line.

---

## 6. Concurrency safety note (for the implementer)

T1.S2 and T2.S1 run in parallel and both edit `file-injector.ts`. The hazard is clobbering. The
mitigation encoded in this PRP: T2.S1's ONLY anchors are (a) the import line (untouched by S2) and
(b) the factory line (untouched by S2). T2.S1 does NOT reference any S2-added symbol as an anchor.
Whoever lands second will still find both anchors intact. (If the orchestrator serializes, even better;
if it doesn't, the edits are on disjoint text regions.) The implementer should run the Level-2 gate
after editing to confirm the final file state (S1+S2+T2.S1) transpiles and all helpers are present.

---

## 7. Scope boundaries (what NOT to do — owned by other subtasks)

- **T1.S1** owns: imports (except the one `type ResizedImage` addition T2.S1 makes), the 3 constants,
  the factory + its stub body.
- **T1.S2** owns: `cleanToken`, `expandTildeAndResolve`, `extOf`. Do not touch.
- **T3.S1** owns: `injectFiles` (the consumer of all four helpers added here — DO NOT implement it now;
  only satisfy its contract). T3.S1 also owns reading the file (`fs.readFile`), the NUL check *call*
  site, MIME classification (`MIME_BY_EXT[extOf(abs)]`), and block/image array assembly + join.
- **T3.S2** owns: the real input-handler body (guards, notify, transform/continue return).
- T2.S1 helpers are **PURE** (no `fs`/I/O, no `resizeImage` call — they RECEIVE a Buffer / a
  `ResizedImage | null`). The only external call is `formatDimensionNote`, which is itself pure.

---

## 8. Validation summary (pre-run on this machine)

- Level-1 grep: 4 `export function` lines at column 1; import line updated; no T3 symbols leaked.
- Level-2 jiti gate: **23 passed, 0 failed** (factory fn check + 4 named exports + 9 isBinary cases +
  5 text cases + 6 image cases + 3 binary cases). Exit 0. NON-INTERACTIVE, NO MODEL/API KEY.
- See the PRP Level-2 block for the exact reproducible script.
