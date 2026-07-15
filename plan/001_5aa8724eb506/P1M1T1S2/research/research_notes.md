# Research Notes — P1.M1.T1.S2 (cleanToken, expandTildeAndResolve, extOf)

Scope: three **pure, module-scope helper functions** added to the *existing* `./sharp-at-file.ts`
(created by T1.S1). No new files. No runtime state. These feed the downstream pipeline
(T3.S1 `injectFiles`).

---

## 1. What T1.S1 produces (CONTRACT — assume it exists verbatim)

`./sharp-at-file.ts` (project root) ends, after S1, with this exact tail:

```ts
const TRAILING_PUNCT = ".,;:!?\")]}>'";

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
```

Above `TRAILING_PUNCT` are the other two module-level constants (`FILE_INJECT_RE`,
`MIME_BY_EXT`) and the six imports (see P1M1T1S1/PRP.md "Exact source to write").

**Insertion point for S2:** immediately after the `TRAILING_PUNCT = ...;` line and
immediately before the `export default function ...` line. Both anchors are unique in the file.

The constants S2 depends on (already present from S1):
- `FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g`  — S2 does NOT use the regex itself; it consumes the
  *captured token* `m[2]` (= the `(\S+)` group). Regex iteration is T3.S1's job.
- `TRAILING_PUNCT = ".,;:!?\")]}>'"`  — the 12-char trim set. S2's `cleanToken` reads it.
- `MIME_BY_EXT: Record<string,string>` — lowercase keys (png/jpg/jpeg/gif/webp/bmp). S2's `extOf`
  must return LOWERCASE so T3.S1's `MIME_BY_EXT[extOf(abs)]` lookup matches.

## 2. The pipeline these helpers serve (T3.S1 `injectFiles`)

```
text
 → matchAll(FILE_INJECT_RE)            // T3.S1 — global regex via matchAll (no lastIndex bug)
   → m[2]  (the raw path token, e.g. "file.txt.)")
     → cleanToken(m[2])                 // S2: trim trailing punct → "file.txt", or "" to skip
       → expandTildeAndResolve(cleaned, ctx.cwd)   // S2: ~ + path.resolve → absolute
         → fs.stat(abs)                 // T3.S1: must be a regular file
           → extOf(abs)                 // S2: lowercase ext → MIME_BY_EXT[ext] lookup (image vs text)
```

So the three functions are a **pure, ordered transform** with no I/O. `stat`/`readFile`
happen downstream in T3.S1, never here.

## 3. Verified facts backing each function

### cleanToken (PRD §4.3 / §10)
- **Behavior:** repeatedly strip any trailing char present in `TRAILING_PUNCT` until the last
  char is NOT in the set. Return `""` if everything was stripped.
- **Must preserve:** `file.txt`, `~/a/b`, `./x`, `../y` (none end in a trim char).
- **Must trim:** trailing `. , ; : ! ? " ' ) ] } >` (e.g. `file.txt.` → `file.txt`,
  `a.txt,` → `a.txt`, `file.txt)` → `file.txt`).
- **Edge from §10:** `(#@file.txt)` → token captured as `file.txt)` → cleaned to `file.txt`.
- **Choice: while-loop with `TRAILING_PUNCT.includes()`** (uses the existing constant directly,
  zero escaping pitfalls). A char-class regex alternative exists but must escape `]`; the loop
  is clearer and DRY. Tokens are short (paths) → O(n²) worst case is irrelevant.
- **NOT this function's job:** matching the regex (T3.S1), deciding skip-vs-keep (T3.S1 reads the
  `""` return and leaves the token verbatim per §4.3.2).

### expandTildeAndResolve (PRD §4.4 / §10 / §3.3)
- **Tilde expansion uses `os.homedir()` directly** because the built-in `resolveReadPath` /
  `resolveReadPathAsync` is **NOT exported** — VERIFIED: `grep resolveReadPath` on
  `dist/index.d.ts` + `dist/index.js` returns **nothing**; only `dist/core/tools/read.js:12`
  imports `resolveReadPathAsync` internally from `./path-utils.js`. So we cannot reuse it.
  (api_verification.md §3.3 / prd_snapshot.md §3.3 confirm "❌ internal".)
- **Three branches** (per work item contract):
  1. `p === "~"` → `os.homedir()`
  2. `p.startsWith("~/")` → `path.join(os.homedir(), p.slice(2))`
  3. else → `p` as-is
  then `return path.resolve(cwd, expanded)` unconditionally.
- **`path.resolve` handles all cases uniformly:** when `expanded` is already absolute (homedir,
  `/etc/...`), `path.resolve(cwd, expanded) === expanded` (cwd ignored). When relative (`./x`,
  `../y`, `a.ts`), it resolves against `cwd`. This matches §4.4 "No cwd restriction" (absolute,
  `~`, `../` all allowed — same trust model as the built-in `read` tool).
- **GOTCHA on `path.join` vs string concat:** PRD §4.4 says `os.homedir() + "/"`. The work item
  specifies `path.join(os.homedir(), p.slice(2))`, which is platform-correct and avoids a
  double-slash if homedir ever has a trailing slash. Use `path.join` (work-item-authoritative).
- **`~username` NOT supported** → falls to else → `path.resolve(cwd, "~user")` → stat fails →
  token left verbatim. Acceptable (§4.4 only specifies `~` and `~/`).

### extOf (PRD §5.2 MIME keys + hidden-file rule)
- **Input:** an absolute path (from `expandTildeAndResolve`).
- **Logic:** `base = path.basename(abs)`; `dot = base.lastIndexOf(".")`; if `dot <= 0` return `""`
  (`-1` = no dot; `0` = hidden file like `.bashrc`/`.env`); else return `base.slice(dot+1).toLowerCase()`.
- **`dot <= 0` is the key insight:** unifies the two "return ''" cases (no dot, dot-at-0) in one check.
- **Must lowercase** so `MIME_BY_EXT[extOf(abs)]` hits the lowercase keys (png/jpg/jpeg/gif/webp/bmp).
  e.g. `Foo.PNG` → `png` ✓. `x.tar.gz` → `gz` (last segment only — correct; `.tar.gz` is not an image,
  falls through to text path, which is fine).
- **NOT this function's job:** deciding image-vs-text (T3.S1 does `if (MIME_BY_EXT[ext]) …`).

## 4. matchAll() / global-regex note (CONTEXT ONLY — not implemented by S2)

The work item explicitly calls out: the detection regex uses a zero-width lookbehind
`(^|(?<=\W))` which consumes NOTHING, so `m[0]` is exactly `#@<path>` and there is NO
`lastIndex`-stale bug when using `String.matchAll()` (unlike `RegExp.test()`/`exec()` with the
global flag). This is documented in `architecture/system_context.md` ("Canonical Reference
Pattern" § + Risks table: "Global regex lastIndex stale → Reset FILE_INJECT_RE.lastIndex = 0 or
use matchAll()"). **S2's functions never touch the regex** — they only receive `m[2]` (the
already-captured token). This note is here so S2's author understands the upstream contract:
`cleanToken` is called once per match with exactly the `(\S+)` capture.

## 5. Empirical verification (run in this environment — see §7)

All 25 edge cases (cleanToken ×13, expandTildeAndResolve ×6, extOf ×6) PASS against the exact
implementations specified in the PRP. Reproducible Node one-liner in the PRP's Level-2 gate.

## 6. Validation strategy (NO test framework in this project)

This is a greenfield single-file extension — no `pytest`/`mypy`/`ruff`, no `package.json`,
no `tsconfig`. Mirror T1.S1's approach: validate via `jiti.import` (the same loader Pi uses),
then call the three **named-exported** functions directly with `node --input-type=module` and
assert results. This needs NO model/API key and NO running TUI — the functions are pure.

**Why named exports (`export function …`):** the work item says "Three exported pure functions
available to T2.S1 and T3.S1." Exporting them (a) satisfies the contract literally, (b) lets the
Level-2 gate import + assert them without launching Pi, (c) does NOT affect Pi's "default export
must be a function" check (that check only inspects `mod.default`). VERIFIED safe: named exports
alongside a default export are standard ESM and jiti handles them transparently.

## 7. Scope boundaries (what S2 must NOT do)

- ❌ Do NOT touch the imports, the three constants, or the factory/handler (S1 owns those).
- ❌ Do NOT implement `isBinary` / `formatTextFileBlock` / `formatImageBlock` / `formatBinaryBlock`
  (T2.S1).
- ❌ Do NOT implement `injectFiles` or the real handler guards/notify/transform (T3.S1/S2).
- ❌ Do NOT call `fs.stat` / `fs.readFile` / `resizeImage` here — these helpers are pure.
- ❌ Do NOT create any new file (no test file, no package.json, no README).
- ✅ DO insert exactly three functions, between `TRAILING_PUNCT` and `export default`.
