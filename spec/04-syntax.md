## 4. The `#@` Syntax Specification

### 4.1 Grammar

```
#@<path>          # whole file
#@<path>:N        # only line N         (optional suffix; §17)
#@<path>:N-M      # lines N..M inclusive
```

- The literal two-character trigger `#@`, immediately followed by a path token.
- **Optional line-range suffix** `:N` / `:N-M` — 1-indexed, inclusive, parsed after §4.3 trimming with exact-path-wins precedence; fully specified in §17.
- **`<path>`** = a maximal run of non-whitespace characters (`\S+`), then trailing sentence punctuation is trimmed (see §4.3).
- The trigger must appear at **start-of-string** or **after a non-word character** (so `foo#@bar` mid-word does *not* trigger).

### 4.2 Detection regex

```ts
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
```

- `(^|(?<=\W))` — start-of-string **or** a preceding non-word char (space, `(`, `[`, etc.). Blocks mid-word `#@`.
- `#@` — the literal trigger.
- `(\S+)` — the path token (no spaces).
- **Zero-width anchor note:** `(^|(?<=\W))` consumes nothing, so the full match `m[0]` is **exactly** `#@<path>` — precise for string replacement, no leading-char bookkeeping.
- **Same regex for user prompts and markdown content.** Markdown imports reuse this exact regex; the only differences are a base-directory rule (§4.5) and a code-region filter (§5.6.1).

### 4.3 Token cleanup

For each captured raw token `r`:
1. **Trim trailing punctuation** repeatedly: remove any of `` . , ; : ! ? " ' ) ] } > `` from the end until none remain. (Preserves `file.txt`, `~/a/b`, `./x`, `../y`.)
2. If empty after trimming → skip (leave as-is in text).
3. **No escape hatch needed.** (Unlike `@`, there's no need for `##@`; if a user wants a literal `#@`, they... won't, it's not real prose. If ever needed, `#@` inside a fenced code block is still matched — document this as a known minor limitation, or note `# @` with a space avoids it.)

### 4.4 Path resolution (top-level user tokens)

For cleaned token `p` in the **user prompt**:
1. **Tilde expansion:** if `p` starts with `~`, replace a leading `~/` with `os.homedir() + "/"` (or `~` alone with homedir).
2. **Resolve:** `const abs = path.resolve(ctx.cwd, p);`
3. **`fs/promises.stat(abs)`:**
   - throws / not found → **not a file** → leave the `#@p` token verbatim in the text (no injection). *(Do not throw out of the handler.)*
   - is a directory → leave token verbatim.
   - not a regular file → leave token verbatim.
4. **No cwd restriction.** The user explicitly wrote `#@`; absolute paths, `~/...`, and `../...` are all allowed (same trust model as the built-in `read` tool with an explicit path).

> **No extension shorthand here.** Top-level user tokens are exact-match only — a `#@PRD` with no bare `PRD` file is left verbatim (it does **not** fall back to `PRD.md`). The `.md`/`.markdown` shorthand is a markdown-import convenience (§4.5); at the prompt the user has path autocomplete (§14) and types the full name.
>
> **Known limitation (document, do not fix):** paths containing spaces cannot be expressed (a space ends the token). Users with such files use the `read` tool.

### 4.5 Markdown import directives (same grammar, narrower rules)

A markdown file (`.md`/`.markdown`) may contain `#@<path>` directives using **exactly the grammar above** (§4.1–§4.3). Two rules narrow their resolution relative to a top-level user token, one adds extension shorthand, and one rule exempts code:

1. **Relative only.** An import whose cleaned token starts with `/` or `~` is **ignored** (left verbatim in the injected content, not resolved). Only relative tokens are resolved.
2. **Resolution base = the importing markdown file's directory.** `path.resolve(dirname(importingMarkdownAbs), token)`. (Top-level user tokens still resolve against `ctx.cwd`, §4.4.)
3. **Extension shorthand.** When the cleaned token has no file extension (`path.extname(token) === ""` — e.g. `PRD`, `sub/notes`), resolution tries `<exact>.md` then `<exact>.markdown` if the exact path is not an existing regular file: `#@PRD` → `PRD.md` (or `PRD.markdown`). Exact-match wins (a bare `PRD` file beats `PRD.md`); tokens already ending in `.md`/`.markdown` or any other extension are exact-only, so `#@PRD.md` never becomes `PRD.md.md`. Top-level user tokens do **not** get this fallback (exact-match only, §4.4).
4. **Code is exempt.** A `#@<path>` occurring inside a fenced code block or inline code is **not** an import — it is left verbatim. This is the escape hatch for markdown that documents the `#@` syntax itself. Detection is approximate-CommonMark (§5.6.1). (Resolved imports are likewise never stripped from surrounding text — see §6.4.)

5. **Depth-uniform, no cwd fallback.** These rules apply identically at **every** recursion level — the markdown file a top-level `#@` token points directly at is not special-cased relative to files deeper in the chain. Resolution is *always* `dirname(importingMarkdownAbs)`; `ctx.cwd` is never consulted for an in-file import. Consequently a same-named file in **both** the importing file's directory and `ctx.cwd` resolves to the importing file's directory (the cwd copy is never chosen, never falls back), and a token that is missing in the importing file's directory stays verbatim even if a same-named file happens to exist under `ctx.cwd`.

Everything else — token cleanup (§4.3), dedup, file-type handling, paging, budget — applies to imports exactly as to top-level tokens.

### 4.6 Optional bare-`@` markdown imports (config: `markdownBareAtImports`)

By default a markdown import **requires** the `#@` prefix (§4.5). Some doc conventions write file references as a bare `@file.md` (no `#`); to support those without making `#@` mandatory inside markdown, the extension exposes one opt-in setting.

**Config sources.** The setting may live in either of two forms — a dedicated extension file, or a namespaced key (`fileInjector`, distinct from the package `name`) inside Pi's own `settings.json`, co-located with the rest of the user's settings. Pi exposes no public settings accessor to extensions, so both forms are read directly from disk (same pattern as the dedicated file). `settings.json` is open-schema and Pi preserves unknown keys through `/settings` edits and flushes, so the namespaced key is stable. The setting is read from up to four locations and shallow-merged in precedence order — each row overrides the one above; project scope overrides global; within a scope the dedicated file overrides the `settings.json` key:

| # | Source | Path | Key / form | Trust |
|---|---|---|---|---|
| 1 | Global settings | `~/.pi/agent/settings.json` | `fileInjector` (object) | always |
| 2 | Global extension file | `~/.pi/agent/file-injector.json` | whole file | always |
| 3 | Project settings | `<cwd>/.pi/settings.json` | `fileInjector` (object) | trusted only |
| 4 | Project extension file | `<cwd>/.pi/file-injector.json` | whole file | trusted only |

```jsonc
// ~/.pi/agent/settings.json — namespaced key among other Pi settings
{
  "defaultModel": "anthropic/claude-sonnet-4",
  "fileInjector": { "markdownBareAtImports": true }
}
```
```json
// ~/.pi/agent/file-injector.json — dedicated file
{ "markdownBareAtImports": true }
```

**Effect.** When `markdownBareAtImports === true`, markdown import scanning (§5.6) matches **both** `#@<path>` *and* a bare `@<path>`. The bare match uses `BARE_AT_RE = /(^|(?<=[^\w#]))@(\S+)/g` — an `@` at start-of-string or after a non-word char that is **not `#`**, so `#@file` is matched once (by `#@`), never twice. Every other rule — relative-only resolution, extension shorthand (§4.5 rule 3), code-exempt (rule 4), dedup, paging, budget — applies identically. As with `#@`, the bare marker is **detected** to resolve the import but **never stripped** from the content (§6.4).

**Depth-uniform (no first-file asymmetry).** Bare-`@` matching applies at **every** recursion depth, including the very first file a top-level `#@` token pulls in. There is no level at which a delivered markdown file must use `#@` while deeper files may use `@`; the scan in §5.6 step 3 runs `BARE_AT_RE` for every markdown file it processes, and the resolution base is always `dirname(abs)` of *that* file (§4.5 rule 2/5) — never `ctx.cwd` — regardless of depth.

**Scope.** Bare-`@` matching is **markdown-only**. The top-level user prompt is unaffected (always `#@`, §4.4); a bare `@path` at the prompt stays Pi's existing behavior and is never injected by this extension. Non-resolving bare tokens (e.g. `@username` with no matching file) are left verbatim, so a prose mention imports only when it happens to name a real file relative to the markdown's directory.

**Loading.** Config is read on `session_start` (which provides `ctx.cwd` and `ctx.isProjectTrusted()`) and cached for the session; the `input` handler reads the cached value. All four sources are tried in precedence order; a missing or malformed source (or a missing `fileInjector` key) is skipped → default (`markdownBareAtImports: false`), never an error.

---

