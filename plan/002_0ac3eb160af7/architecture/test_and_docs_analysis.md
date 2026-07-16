# Test, README & package.json Analysis — `#@file` (pi-file-injector)

> Scouting artifact. Documents the existing acceptance harness, README, and package.json so a
> follow-up agent can plan **paged-delivery** changes (size-gated chunking) without re-reading them.
> All paths are absolute repo-root paths unless noted. No files were modified.

---

## 1. `file-injector.test.mjs` (760 lines) — the acceptance harness

### 1.1 Framework & load mechanism
- **No test framework.** The repo's convention is a "standalone `.mjs` gate": a zero-dependency
  Node ESM script that asserts directly and exits `0`/`1`. There is no `node:test`, no Vitest, no
  package.json `scripts.test` — you run it bare: `node ./file-injector.test.mjs`.
- **Imports the REAL committed `./file-injector.ts`** — not a stub. It bootstraps `jiti` from
  inside the globally-installed pi package and aliases the pi internals exactly the way Pi's own
  extension loader does (lines 38–73):
  ```js
  const PIPKG = resolvePiPackageRoot();                 // npm root -g + "/@earendil-works/pi-coding-agent"
  const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(import.meta.url, {
    alias: {
      "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
      "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    },
  });
  const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));
  ```
- **Module surface asserted** (sanity, lines 117–124): the harness requires the real module to
  export `default` (the factory), `injectFiles`, `cleanToken`, `formatTextFileBlock`,
  `formatImageBlock`, `formatBinaryBlock`, `formatEmptyImageBlock`, `hasValidImageMagic`.
  ⚠️ A paged-delivery change that adds/renames exports would need this list (and every call site)
  updated.

### 1.2 How `injectFiles` is imported & called
- `mod.injectFiles(text, images, ctx)` is the unit under test for every data-path case. Signature
  inferred from call sites (e.g. lines 232, 696): `(text: string, images: ImageContent[], ctx: {cwd})`
  → returns `{ text, images, injected: number }`.
  - `injected===0` contract (lines 277–280, 286, 700): returns the **original `images` ref
    unchanged** (the "merge contract") and `text` **byte-for-byte unchanged**.
  - `injected>0` contract: `text` gains blocks appended under a `\n\n---\n\n` separator; the inline
    `#@<path>` trigger is stripped to just the path (e.g. `Review #@a.ts` → `Review a.ts`).
- Handler path is exercised through `captureHandler()` (see 1.4).

### 1.3 Mocks: what is and ISN'T mocked
- **fs is NOT mocked.** Real `node:fs`/`promises` against a temp dir (`os.tmpdir()/"saf-..."`,
  lines 127, 139). Fixtures are written by `buildFixtures()` (lines 168–203):
  `a.ts`, `b.ts`, `a.txt`, `pic.png` (1×1 PNG), `data.bin` (NUL bytes → binary), `empty.txt` (0B),
  `fake.png` (text body, .png ext), `empty.png` (0B image), `src/` (dir), `huge.log` (~2 MB,
  computed so case #2 can assert byte-equality without bloating the repo). A home-dir notes file
  is written for the tilde case and removed in cleanup (lines 125–126, 218, 649–656).
- **`resizeImage` is NOT mocked either.** The comment at lines 148–150 explains the *shipped*
  behavior: the tiny 1×1 PNG makes `resizeImage()` return `null` *deterministically*, so case #3
  exercises the **fallback path** (raw base64, empty-hints block) without any injection. The string
  `resizeImage` appears only in comments (lines 148, 245, 259), never as a mock.
  ⚠️ **For paged delivery:** if paging changes image handling or the resize branch, the comment
  about determinism may need revision; the tiny-PNG fixture is deliberately non-random to stay
  stable.
- **The only mocks are two tiny factories:**
  - `makeMockCtx(cwd, {hasUI=true})` (lines 134–140) → `{ ctx: {cwd, hasUI, ui:{notify}}, rec }`.
    `ctx.ui.notify(m,t)` is recorded into `rec.notify = {m,t}`. `hasUI:false` models the headless
    path; `ui:{}` (no `notify`) models a malformed ctx for the autocomplete headless guard.
  - `captureHandler(event="input")` (lines 142–147) → calls `mod.default(pi)` with a fake `pi` whose
    `on(ev,cb)` stores the callback, so the test can invoke `slot.cb(payload, ctx)` directly with
    crafted `{text, source, streamingBehavior?, images}` payloads.

### 1.4 Helpers / harness scaffolding (lines 86–132)
- `assert(cond, msg)` — throws on falsy.
- `runCase(n, name, fn)` — runs one assertion block; on success prints `✓ case n: name` and pushes
  `{n,name,status:"PASS"}`; on throw prints `✗` with the message and pushes a `FAIL` row. `n` may be
  a number (PRD §11 case) **or a string** (edge/guard cases E1–E4, G1–G3, H1, M1, F1–F5, U1, A1).
- `integrationCase(n, name, command, expected)` — records an `INTEGRATION` row and prints the exact
  `pi …` shell command to run manually; **never affects the exit code** (keeps the gate hermetic —
  no model key / no Pi process / no network). Two exist: case 12 (`pi -e … -p "Review #@a.ts"`) and
  case 13 (`pi @a.ts "x"`), at lines 348–352 and 378–381.
- `passed`/`failed` counters drive `process.exit(failed>0?1:0)` (line 658). Summary printed at
  lines 644–656.

### 1.5 Case inventory — count & coverage
**34 `runCase` assertions + 2 `integrationCase` entries = 36 named rows.**

PRD §11 acceptance matrix (numbered 1–14), lines 230–382:
| # | Name | Key assertion |
|---|------|---------------|
| 1 | single text file | injected===1; `<file name=…>\n<content>\n</file>` block; separator `\n\n---\n\n` |
| 2 | huge file byte-for-byte | ~2 MB injected **entire**, `endsWith` exact block; explicit length check |
| 3 | image attached | images[0].type==="image", mimeType, raw base64 (no `data:` prefix), empty-hints block |
| 4 | non-image binary | note block with em-dash U+2014, no decoded garbage |
| 5 | missing file | injected===0; text verbatim; **images ref unchanged** |
| 6 | directory | injected===0; token verbatim (not `isFile()`) |
| 7 | mid-word `#@` | no match (`foo#@bar`) |
| 8 | markdown `#`/`#1234` | no `#@` → no match |
| 9 | multi-file | injected===2; blocks in source order; **notify fires** `"#@ injected 2 files"` type `info` |
| 10 | tilde expansion | `#@~/file` → `os.homedir()` path |
| 11 | trailing punctuation | `#@a.ts.` → resolves to `a.ts` |
| 12 | interactive/`-p` transform | handler `action==="transform"`; notify `"#@ injected 1 file"` |
| 13 | format parity | block byte-identical to pi's `@file` template; `formatTextFileBlock` parity |
| 14 | bare `@` | injected===0; text verbatim; handler `action==="continue"`, no notify |

Edge/guard cases (string ids), lines 392–616:
- **E1** empty 0-byte text file → `<file name=…>\n\n</file>` (NOT skipped).
- **E2** parenthesized token `(#@a.txt)` → trimmed, resolves.
- **E3** fenced-code-block `` `#@a.ts` `` → trailing backtick not in `TRAILING_PUNCT` → unresolved →
  injected===0 (documented limitation; README should note `# @` escape).
- **E4** read error `chmod 000` → token verbatim, no throw (skipped when `uid===0`).
- **G1** guard `source==="extension"` → `continue` (loop prevention), no notify.
- **G2** guard `streamingBehavior==="steer"` → `continue` (latency), no notify.
- **G3** guard no `#@` substring → `continue` (cheap pre-check), no notify.
- **H1** headless `hasUI===false` → still `transform`, notify **never** called.
- **M1** merge contract → user image stays at `images[0]`, injected appended at `[1]`.
- **F1 / F1b / F1c / F1d** per-token & structural dedup (Issue 1 / F-NEW-1): already-injected text →
  injected===0; multi-file new file still injects; `#@` stripping makes dedup bidirectional vs
  legacy copies (a hand-built `legacyInject` with the old `\W` regex and no dedup, lines 575–592).
- **F2** sentinel string in prompt no longer gates (Issue 2): `<!--#@file-injected--> … #@a.ts` still
  injects a.ts; both `#@` stripped; handler transforms.
- **F3a / F3b** mislabeled image: `.png` with text body → text block, no garbage image; `hasValidImageMagic`
  sniffs real PNG/JPEG headers, rejects text/short buffers.
- **F5** 0-byte image → note block `<empty image file — 0 bytes; nothing to attach>`, **no** empty
  ImageContent attached.
- **F4** notify pluralization: `"1 file"` vs `"2 files"`.
- **U1** Unicode word-boundary (Issue 5): `café#@a.ts`, `日本語#@a.ts` do NOT match; `Review #@a.ts`
  and `#@a.ts` (start) DO; `foo#@bar` still blocked.
- **A1** `#@` autocomplete (lines 668–715): `session_start` handler installs a provider via
  `ctx.ui.addAutocompleteProvider`; rewrites `#`→space for pi's built-in `@` engine, remaps prefix
  and items back to `#@`, deterministic `applyCompletion`; headless-guarded (no `ctx.ui` → no-op).

### 1.6 Cleanup & exit
- Always removes the temp dir and the home-dir notes file (best-effort, lines 649–656).
- `process.exit(failed>0?1:0)` (line 658).

### 1.7 What would need updating for **paged-delivery** tests
This is the load-bearing section for the follow-up task. Today every text case asserts
**entire-content / no-truncation**:
- **Case #2** (lines 236–248) is the canonical "no size gate" assertion: it requires the ~2 MB
  fixture to be injected byte-for-byte and `endsWith` the full block. Paging will **invert** this —
  a large file must be chunked, so case #2 must change from "entire, no truncation" to a
  paging-specific assertion (e.g. page count, page size, continuation markers). The comment block
  at lines 217–224 explaining "entire file / no truncation" must be rewritten.
- **Cases #1 and #13** assert a single exact `<file>` block containing the full content. Under
  paging these likely become multiple pages/blocks, so the byte-equality expectations (`expectedBlock`
  built from full `A_TS_CONTENT`) need to become page-aware.
- **E1** (0-byte file) may need a "no pages / empty page" definition.
- **README "Limits → No size gate"** (line 72) is explicitly contradicted by paging; the test's
  comments reference this contract and must be reconciled.
- New cases to add: page-boundary correctness, last-page marker, mid-file continuation, interaction
  with the **per-token dedup** cases (F1/F1c) — a chunked file is multiple `<file>` blocks for the
  *same path*, which collides with the dedup logic that keys on `<file name="<path>">`. **This is a
  high-risk integration point**: dedup currently treats each resolved path as inject-once; paging
  produces N blocks per path and the dedup set logic (asserted in F1c) would suppress pages 2..N.
  The harness already encodes the dedup contract precisely, so any paging design must update F1/F1c
  or the paging transport must not reuse the `<file name=…>` block as the dedup key.
- `mod` surface sanity (lines 117–124) must list any new paging exports the design adds.
- The two `integrationCase` commands (12, 13) are model-free and stay hermetic; they don't need
  paging changes unless the paged output changes what a human would eyeball in a transcript.

---

## 2. `README.md` (83 lines) — full content + sections to update

### 2.1 Full current content (reproduced verbatim)
```markdown
# `#@file`

A [Pi](https://github.com/earendil-works/pi) extension that injects a whole file into your prompt when you write `#@` before the path. The file reaches the model before it replies, with no size limit and no configuration.

## Why

Pi's built-in `@file` injects a file only when you pass it on the command line before a session starts. In the editor, `@` is path autocomplete, and the model has to call a tool to read the file itself.

`#@` always injects the entire file, in every context: the editor, a `pi -p` one-shot, and RPC. You write it, the file goes in.

## Install

```bash
pi install git:github.com/dabstractor/pi-file-injector
```

Restart Pi if a session is already open. To uninstall, run `pi remove git:github.com/dabstractor/pi-file-injector`.

## Usage

Write `#@` and a path anywhere in your prompt:

```text
Review #@a.ts
Describe #@pic.png
Summarize #@~/notes.md
Diff #@a.ts vs #@b.ts
See #@a.ts.
```

On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath.

Path completion works in the editor. Type `#@` and the same file list Pi shows for `@` appears; Tab completes it as `#@<path>`.

Bare `@` is unchanged, so `Review @a.ts` behaves as before.

## What gets injected

| File | Result |
|---|---|
| Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected, no truncation. |
| Image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`) | Attached as an image. |
| Other binary | Not injected. A short note says it was skipped. |
| Missing file, directory, or permission error | Left as written. Nothing is appended. |

Text uses Pi's native block format, the same one `@file` uses:

```text
<file name="/abs/path/to/file.ts">
<entire file contents>
</file>
```

Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. An empty (0-byte) image attaches nothing.

## Syntax

`#@<path>` is the trigger `#@` followed by a path. The path is a run of non-whitespace characters.

**Where it matches:** at the start of the prompt, or right after a non-word character (a space, `(`, `[`, `>`, etc.). It does not match mid-word, so `foo#@bar` injects nothing. This holds in any language: `café#@x`, `Öster#@x`, and `日本語#@x` inject nothing.

**Trailing punctuation is trimmed.** `#@a.ts.` resolves to `a.ts`. `(#@a.txt)` resolves to `a.txt`. Trimmed characters:

```text
. , ; : ! ? " ' ) ] } >
```

**Paths:** relative (against your current directory), absolute (`#@/etc/hosts`), tilde (`#@~/notes.md`), and `../` all work.

## Limits

- **No size gate.** `#@` on a 50 MB file injects 50 MB and can overflow the model's context. For large files, use Pi's `read` tool with `offset` and `limit`.
- **No spaces in paths.** A space ends the path, so `#@my file.txt` injects a file named `my`. Use the `read` tool for files with spaces.
- **No directories.** `#@src/` is left as-is. Use a `read` or `ls` tool.
- **No globs.** `#@src/*.ts` is a literal path, not a pattern. It resolves only if a file named `*.ts` exists.
- **A backtick right after `#@` blocks it.** Inside a code span like `` `#@a.ts` ``, nothing is injected. To suppress `#@` anywhere, write `# @` with a space.

## `#@` versus `@`

- `#@file` injects the whole file, always, everywhere.
- `@file` is Pi's built-in autocomplete and command-line argument handling. This extension does not change it.

Use `#@` when you want all of a file. Use `@` or the `read` tool when you want part of a file or a size limit.
```

### 2.2 The three sections that need paged-delivery updates (exact quotes + line numbers)

**1) 'Why' section — line 3 + lines 5–9.** The opening promise is "no size limit":
> L3: "A [Pi](...) extension that injects a whole file into your prompt when you write `#@` before the path. The file reaches the model before it replies, **with no size limit** and no configuration."

> L7–9 (## Why body): "`#@` **always injects the entire file**, in every context: the editor, a `pi -p` one-shot, and RPC. You write it, the file goes in."
Paging redefines "entire file" → "entire file, delivered in pages"; the "no size limit" framing must be reconciled with size-gated chunking.

**2) 'What gets injected' table — lines 39–52.** Row 1 + the block-format code sample both promise whole content:
> L41: `| Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected, no truncation. |`

> L48–52 (code sample):
```text
<file name="/abs/path/to/file.ts">
<entire file contents>
</file>
```
Under paging the table row should describe paged delivery (page size, count, continuation), and the block sample likely gains a page index / marker. The image row (L42) and binary/missing rows (L43–44) are probably unaffected.

**3) 'Limits' section — lines 70–76.** The first bullet is the exact contract paging removes:
> L72: "- **No size gate.** `#@` on a 50 MB file injects 50 MB and can overflow the model's context. For large files, use Pi's `read` tool with `offset` and `limit`."

The remaining limits (L73–76: no spaces in paths, no directories, no globs, backtick suppression) are unrelated to paging and likely stay. Also note the closing **`#@` versus `@`** section (L78–83) ends with "Use `@` or the `read` tool when you want part of a file or a size limit" — a paging feature that delivers partial files would blur that distinction and may need a sentence there too.

---

## 3. `package.json` (10 lines) — full contents

```json
{
  "name": "pi-file-injector",
  "version": "0.1.0",
  "private": true,
  "description": "#@file — inject the whole file, every time, everywhere. A Pi extension.",
  "type": "module",
  "pi": {
    "extensions": ["file-injector.ts"]
  }
}
```

Notes:
- `"private": true` — not published to a registry; distributed via `pi install git:...`.
- `"type": "module"` — ESM.
- `"pi": { "extensions": ["file-injector.ts"] }` — the **only** entry point Pi loads. Any paging
  code must live in (or be imported by) `file-injector.ts`; there is no second file to add here.
- **No `scripts`, no `dependencies`, no `devDependencies`.** The test harness is zero-dependency by
  design (it pulls `jiti` and pi internals from the *global* pi install at runtime). A paged-delivery
  feature that wants e.g. a tokenizer/char-count lib would either stay dependency-free (match the
  ethos) or require introducing the first `dependencies` entry — a scope decision worth flagging.
- `description` says "inject the whole file, every time, everywhere" — consistent with the README
  promise that paging would refine.

---

## 4. Cross-cutting risks for paged delivery (summary)
1. **Dedup-vs-paging collision (highest risk).** F1/F1c assert that each resolved path injects
   exactly one `<file name="<path>">` block and that a second block for the same path is suppressed.
   Paging produces N blocks per path → the existing dedup set logic would drop pages 2..N. Either
   the paging transport must not key dedup on the bare `<file name=…>` block, or the dedup contract
   (and tests F1, F1c) must be redefined for paged blocks.
2. **Test case #2's identity.** It is the "no size gate / no truncation" anchor; paging inverts its
   core assertion. Its ~2 MB fixture is the natural input for a paging test.
3. **README `Limits` L72 + `Why` L3 + table L41.** All three directly state whole-file/no-truncation
   and must be rewritten together for internal consistency.
4. **No second source file.** `package.json` loads only `file-injector.ts`; paging logic must be
   contained there or imported from it (and imports mean the first `dependencies` entry).
5. **Module surface list** in the test sanity block (L117–124) must track any new exports.
6. **`resizeImage` determinism comment** (L148) and the tiny-PNG fixture: if paging touches image
   handling, revisit; otherwise leave as the stable fallback-path driver.
