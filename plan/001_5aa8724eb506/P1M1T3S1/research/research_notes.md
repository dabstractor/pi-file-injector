# Research Notes — P1.M1.T3.S1: `injectFiles` Core Assembly Function

> Researcher goal: pre-verify EVERY API claim and edge case for `injectFiles` so the PRP ships
> exact source + a **pre-run green** validation suite (matching the bar set by T1.S2 / T2.S1).

## 1. Contract source (authoritative)

The **work-item description** (`item_description`) is the authoritative contract — it restates
PRD §5/§6/§9/§10 as an explicit (a)–(k) step list. PRD §9 pseudocode is the reference implementation.
Where the item description and PRD §8's informal labels differ, the **item description wins**
(same precedence rule T1.S2 used for `expandTildeAndResolve`).

Signature (item §3 + §4):
```ts
async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: { cwd: string }
): Promise<{ text: string; images: ImageContent[]; injected: number }>
```
- `ctx` is the **minimal structural type `{ cwd: string }`** — NOT the full `ExtensionContext`.
  This decouples the function from the handler and makes it directly testable with a plain object.
  (api_verification.md §5 confirms `ctx.cwd: string` on the real ExtensionContext, so T3.S2 can pass
  the real `ctx` and it structurally satisfies `{ cwd: string }`.)
- Returns `{ text, images, injected }` where `injected` is a **count** (0 = nothing injected).

## 2. Downstream-consumer contract (the handler, T3.S2 — do NOT implement, just satisfy)

`injectFiles` does NOT return an `InputEventResult`. The handler (T3.S2) translates:
- `injected === 0` → `return { action: "continue" }` (prompt byte-for-byte unchanged).
- `injected > 0`  → `return { action: "transform", text, images }`.

This split is WHY `injectFiles` returns a plain object instead of an `InputEventResult`: it keeps the
core assembly logic handler-agnostic and unit-testable. The item §4 is explicit:
> "0 means nothing was injected → caller returns 'continue'. Non-zero → caller returns 'transform'."

## 3. The two load-bearing subtleties (item §1 RESEARCH NOTE — must not regress)

### 3a. Image-array MERGE, not replace (system_context.md §"Image Array Merging")

> The input runner chains handlers in load order. A `transform` return with `images` present
> **REPLACES** the array (`dist/core/extensions/runner.js:882-920`). Returning only new images
> would DESTROY user-attached images.

`injectFiles` therefore **seeds** `images = [...imagesIn]` and returns that (possibly appended) copy.
Verified two ways (pre-run green, §7):
- `count === 0` → returns the **ORIGINAL** `imagesIn` reference (`r.images === imagesIn`). Item §3(i).
- `count > 0`   → returns the **copy** (`r.images !== imagesIn`, same elements + any appended images).

### 3b. Empty files are INJECTED (intentional divergence from processFileArguments)

Item §1:
> empty files (0 bytes) MUST be injected as `<file name="…">\n\n</file>` — do NOT skip them
> (processFileArguments skips them with `if (stats.size === 0) continue` — this extension
> intentionally injects them per §10 edge cases).

This requires **zero special code** in `injectFiles` — it falls out of the normal text path:
- empty file → `fs.readFile` → empty `Buffer` → `isBinary(Buffer.alloc(0))` returns `false`
  (`Math.min(0,8000)===0`, loop body never runs) → text branch →
  `formatTextFileBlock(abs, "")` → `'<file name="ABS">\n\n</file>'`. ✅ (Pre-run green, §7 test 6.)
- The `count++` still fires, so `injected` correctly reflects the empty file.

## 4. `resizeImage` empirical behavior (the one external dependency)

Verified live (`/tmp/verify_injectfiles.mjs`):
- **Signature** (api_verification.md §2): `(inputBytes: Uint8Array, mimeType, options?) => Promise<ResizedImage | null>`.
  Param is named `inputBytes` in dist — **wrap the Buffer**: `new Uint8Array(buf)`.
- **It is ASYNC and spawns a Worker thread** (Photon WASM), with an in-process fallback on worker
  failure (`dist/utils/image-resize.js`: tries `resizeImageInWorker`, catches, falls back to
  `resizeImageInProcess`). So it never throws for normal images — it resolves `null` on failure.
- **Determinism finding**: for a minimal 2×2 PNG (70 bytes), `resizeImage(...)` resolves **`null`**
  both probe runs. This is the documented "can't bring under maxBytes / can't process" branch.
  → Excellent for testing: the **fallback** path (`resized?.data ?? buf.toString("base64")`) is the
  one deterministically exercised, which is exactly the branch item §1 stresses:
  "Returns null if it can't process → fall back to raw buf.toString('base64')."

Implementation consequence (item §3f):
```ts
const resized = await resizeImage(new Uint8Array(buf), mime);
images.push({
  type: "image",
  data: resized?.data ?? buf.toString("base64"),     // null → raw base64 of ORIGINAL bytes
  mimeType: resized?.mimeType ?? mime,               // null → original mime
});
blocks.push(formatImageBlock(abs, resized));         // null → empty-hints <file name="ABS"></file>
```
Note `formatImageBlock(abs, null)` is SAFE: T2.S1 guards `resized != null ? formatDimensionNote(resized) : undefined`
(so null never reaches `formatDimensionNote`, which would throw on `.wasResized` deref).

### Image files SKIP the NUL-byte check (item §1 + PRD §5.2)
Classification is **by MIME first**, not by binary detection. The `if (mime) { IMAGE } else { TEXT/BINARY }`
branch means an image file is never passed to `isBinary`. This matters for image formats whose encoded
bytes may legitimately contain `0x00` — they must not be misrouted to `formatBinaryBlock`.

## 5. `matchAll(FILE_INJECT_RE)` capture-group behavior (verified live)

`FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g` — the `(^|(?<=\W))` is a **zero-width** anchor, so:
- `m[0]` === exactly `#@<path>` (no leading char consumed).
- `m[2]` === the path token (everything after `#@` up to whitespace).

Verified matrix (all pre-run):
| Input | match? | `m[2]` |
|---|---|---|
| `text #@a.txt` | ✓ | `a.txt` |
| `#@a.txt #@b.md` | ✓✓ | `a.txt`, `b.md` |
| `(#@file.txt)` | ✓ | `file.txt)` ← trailing `)` captured; `cleanToken` trims it |
| `foo#@bar` (mid-word) | ✗ | — (`#@` preceded by word char `o`) |
| `# heading` / `#1234` | ✗ | — (no `#@`) |

`String.matchAll` is used (NOT `.exec` in a loop), so there is **no `lastIndex` stale-state risk**
(system_context.md Risks table mitigation #1 is satisfied for free). `matchAll` creates its own
iterator and does not mutate `FILE_INJECT_RE.lastIndex`.

## 6. Placement & export decision

**Placement** (PRD §8 internal structure): `injectFiles` is section 4 ("Core"), positioned **after**
the format helpers (T2.S1) and **before** the factory (section 5). Stable anchor: insert immediately
above `export default function (pi: ExtensionAPI) {`. T3.S1 does NOT touch the factory stub (T3.S2 owns
the handler body replacement).

**Export decision**: `export` the function (named export). Rationale:
- Enables the model-free Level-2 gate (import + call directly), exactly as T1.S2 and T2.S1 did.
- Pi's loader only checks `mod.default` is a function (api_verification.md §5; T1.S2 PRP verified
  named exports are safe). Zero runtime impact.
- T3.S2 still calls it as a module-local function regardless; the export is additive only.
- The PRD §9 pseudocode writes it non-exported, but the established project pattern (S2/T2.S1) and
  testability both favor `export`. Documented as a deliberate, low-risk choice.

## 7. Pre-run validation summary (reference impl vs. full assertion suite — 45/45 green)

Ran `/tmp/prerun_injectfiles.mjs`: a reference copy of the EXACT target `injectFiles` (with T2.S1
helpers inlined) against 13 scenario groups / 45 assertions. **Result: 45 passed, 0 failed.**

Coverage:
1. No `#@` → `injected:0`, text unchanged, original `imagesIn` returned.
2. `count===0` (missing file) → returns **original `imagesIn` reference** (merge contract A).
3. Directory token → left verbatim, `injected:0`.
4. Single text file → `injected:1`, original text preserved, `\n\n---\n\n` separator, exact block.
5. Multiple files → `injected:2`, blocks appended **in order**, joined with `\n\n`.
6. **Empty file** → `injected:1`, block = `<file name="ABS">\n\n</file>` (intentional divergence).
7. Binary file (NUL byte) → `formatBinaryBlock`, em dash present, **no UTF-8 garbage**.
8. Image file → `injected:1`, `ImageContent` attached (`type:image`, `mimeType:image/png`,
   non-empty base64, no `data:` prefix); **fallback** (`data===rawBase64`, empty-hints block) since
   `resizeImage`→`null` deterministically.
9. Merge contract B (count>0 + user image + image injection) → `images.length===2`, user image at `[0]`.
10. Merge contract C (count>0 + user image + text injection) → returns a **copy** (ref !== imagesIn),
    length 1, copy `[0]` === user image.
11. Original prompt text NOT modified — `#@` markers remain; blocks appended after separator.
12. Mixed (one missing + one valid) → only valid injected (`injected:1`); missing token verbatim.
13. Read error (chmod 000) → caught, token verbatim, remaining tokens still processed. *(Platform-dependent;
    skipped on systems where chmod is ineffective, e.g. running as root. PRP marks this test conditional.)*

## 8. Out-of-scope guardrails (owned by OTHER tasks — do NOT implement in T3.S1)

- **T3.S2** owns: the real handler body — guards (`source==="extension"`, `streamingBehavior==="steer"`,
  `!text.includes("#@")` pre-check), the `injectFiles` CALL, `ctx.ui.notify`, and the
  `{action:"transform"|"continue"}` translation. T3.S1 must leave the factory stub **as-is**.
- **T2.S1** owns: `isBinary`, `formatTextFileBlock`, `formatImageBlock`, `formatBinaryBlock`, and the
  `type ResizedImage` import. T3.S1 **consumes** them — do not redefine.
- **T1.S1/T1.S2** own: constants + `cleanToken`/`expandTildeAndResolve`/`extOf`. T3.S1 **consumes** them.
- **P1.M2.T5.S1** owns: the README.
- No new files, no `package.json`/`tsconfig`/test files. Single-file jiti extension.
