# `#@file`

A [Pi](https://github.com/earendil-works/pi) extension that injects a whole file into your prompt when you write `#@` before the path. The file reaches the model before it replies, the whole file always reaches the model — injected whole when it fits the remaining context, paged via the `read` tool when it doesn't — with no configuration.

## Why

Pi's built-in `@file` injects a file only when you pass it on the command line before a session starts. In the editor, `@` is path autocomplete, and the model has to call a tool to read the file itself.

`#@` always delivers the entire file to the model, in every context: the editor, a `pi -p` one-shot, and RPC. When the file fits the remaining context it is injected whole; when it exceeds the budget it is delivered as a head block plus a paging directive that the model reads through.

`#@spec.md` pulls in everything `spec.md` references with the same `#@` directive — spec-and-its-dependencies in one token, loop-safe via dedup (each file is injected at most once).

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

On submit, each file shows up as a compact green `read <path>` line directly below your message — one line per file, indistinguishable from the `read` tool. Press `ctrl+o` to expand any of them to the full contents. The `#@` trigger is stripped from each reference, so `Review #@a.ts` appears in your message as `Review a.ts`, with the file delivered to the model underneath — never pasted into your message bubble.

Markdown files can import other files. If `spec.md` itself contains `#@api.md`, a single `#@spec.md` delivers both — `spec.md` first, then `api.md` — and the import marker is stripped from `spec.md` the same way a top-level marker is:

```text
#@spec.md          # spec.md contains: see #@api.md
```

Path completion works in the editor. Type `#@` and the same file list Pi shows for `@` appears; Tab completes it as `#@<path>`.

Bare `@` is unchanged, so `Review @a.ts` behaves as before.

## What gets injected

| File | Result |
|---|---|
| Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected when they fit remaining context. Oversize files are delivered as a head block plus a paging directive — the model reads the rest via the `read` tool. Never silently truncated. |
| Image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`) | Attached as an image. |
| Other binary | Not injected. A short note says it was skipped. |
| Missing file, directory, or permission error | Left as written. Nothing is injected. |

A delivered markdown file (`.md` or `.markdown`) is also scanned for relative `#@` imports. Each import it references is delivered as its own block, and is scanned in turn if it is also markdown — so a single `#@spec.md` can pull in a whole tree of docs. The same file-type rules (text / image / binary / missing) apply to each import unchanged.

Text uses Pi's native block format, the same one `@file` uses:

```text
<file name="/abs/path/to/file.ts">
<entire file contents>
</file>
```

That's what the model receives. You won't see it as raw text in the chat — each injected file renders as a green `read <path>` line (just like the `read` tool), with `ctrl+o` to expand. Your own message shows only what you typed.

Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. The check cuts both ways: a real image saved with the wrong extension — a PNG named `photo.jpg`, say — is not attached, because its bytes don't match the `.jpg` signature; it's delivered as a binary note instead. Rename it to its real type to attach it. An empty (0-byte) image attaches nothing.

## Syntax

`#@<path>` is the trigger `#@` followed by a path. The path is a run of non-whitespace characters.

**Where it matches:** at the start of the prompt, or right after a non-word character (a space, `(`, `[`, `>`, etc.). It does not match mid-word, so `foo#@bar` injects nothing. This holds in any language: `café#@x`, `Öster#@x`, and `日本語#@x` inject nothing.

**Trailing punctuation is trimmed.** `#@a.ts.` resolves to `a.ts`. `(#@a.txt)` resolves to `a.txt`. Trimmed characters:

```text
. , ; : ! ? " ' ) ] } >
```

**Extensions are exact.** A reference that already ends in a file extension is matched by that exact name. A missing `#@report.md.bak` is left as written — it never silently resolves to an existing `report.md`, so the model never receives a different file than the one you named. (Markdown formatting glued to a name is different: emphasis like `*@b.md*` or `**@b.md**` is still trimmed, so the file resolves.)

**Paths:** relative (against your current directory), absolute (`#@/etc/hosts`), tilde (`#@~/notes.md`), and `../` all work.

**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an import, using the same grammar. Five rules narrow it:

- **Relative paths only.** Imports resolve against the markdown file's own directory, not your current directory. Absolute (`#@/etc/hosts`) and tilde (`#@~/notes.md`) imports inside a markdown file are ignored and left verbatim. If the same name exists in both the importing file's directory and your current directory, the importing file's directory wins — so `#@file2.md` inside `dir/otherdir/some/file.md` resolves to `dir/otherdir/some/file2.md`, never `./file2.md`. This holds at every nesting depth; your current directory is never consulted for an in-file import.
- **Extension shorthand.** A markdown import may omit the `.md`/`.markdown` extension: `#@PRD` resolves to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats `readme.md`), and a token already ending in any extension is left as-is (so `#@PRD.md` never becomes `PRD.md.md`). This is a markdown-import convenience only — at the prompt you type the full name.
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything. Fenced-code detection is line-ending agnostic — Windows (CRLF) and Unix (LF) markdown files detect code fences identically.
- **Each file is injected at most once.** Across the whole prompt — top-level tokens, every import, and cycles — a given file appears in one block only. Shared dependencies dedup; cycles terminate.
- **Shared budget.** Imports draw on the same context budget as the top-level prompt. When the running total exceeds the window, later files page (head block plus a `read`-tool directive) instead of overflow.

### Optional: bare-`@` markdown imports

Off by default — `#@` works with no config at all, and stays the only thing that ever triggers injection at the prompt. This is the one opt-in.

If your docs already reference files as a bare `@file.md` (no `#`), you can make a delivered markdown file treat that the same way as `#@file.md`. Set `markdownBareAtImports` to `true`. It can live in either of two forms — a dedicated file, or under the `fileInjector` key inside Pi's own `settings.json`, alongside your other Pi settings:

```json
// ~/.pi/agent/file-injector.json — dedicated file
{ "markdownBareAtImports": true }
```
```jsonc
// or, inside ~/.pi/agent/settings.json — namespaced key
{
  "defaultModel": "anthropic/claude-sonnet-4",
  "fileInjector": { "markdownBareAtImports": true }
}
```

Both forms are read from a global and a project location and shallow-merged in this order (each later one wins; within the same scope the dedicated file beats the `settings.json` key):

1. Global `~/.pi/agent/settings.json` → `fileInjector`
2. Global `~/.pi/agent/file-injector.json`
3. Project `.pi/settings.json` → `fileInjector` — **trusted project only**
4. Project `.pi/file-injector.json` — **trusted project only**

The project sources are honored only in a trusted project, so an untrusted checkout can't turn it on. (`settings.json` is open-schema, so Pi preserves the `fileInjector` key through `/settings` edits.)

When it's on, a bare `@api.md` inside a delivered markdown file imports exactly like `#@api.md`: relative-only paths, extension shorthand, code-exempt, deduped against everything else, and drawing on the same shared budget. `#@` keeps working unchanged and is never matched twice — a `#@api.md` is one import, not two. A missing or malformed source (or one that doesn't set the key) leaves everything at the default, so it never errors. This is uniform at **every** depth: the first file a top-level `#@` token pulls in is not special-cased — its bare `@` imports are honored exactly like those in files deeper in the chain.

It affects markdown content only — a bare `@path` you type in your prompt is never injected. See [Limits](#limits).

## Limits

- **No size knob.** `#@` has no user-facing size setting. Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive; the model reads the rest via the `read` tool. The model never holds a file larger than its context window all at once — that is a property of the medium, not of this extension.
- **No spaces in paths.** A space ends the path, so `#@my file.txt` injects a file named `my`. Use the `read` tool for files with spaces.
- **No directories.** `#@src/` is left as-is. Use a `read` or `ls` tool.
- **No globs.** `#@src/*.ts` is a literal path, not a pattern. It resolves only if a file named `*.ts` exists.
- **A backtick right after `#@` blocks it.** Inside a code span like `` `#@a.ts` ``, nothing is injected. To suppress `#@` anywhere, write `# @` with a space.
- **Markdown imports are relative-only.** A `#@` inside a `.md`/`.markdown` file that points at an absolute or tilde path is ignored, never resolved.
- **Only markdown is scanned.** A `#@` inside an injected `.ts`, `.json`, image, or any other non-markdown file is inert — only `.md`/`.markdown` pull in further files.
- **Bare-`@` imports stay inside markdown.** Even with `markdownBareAtImports` on, a bare `@path` in your prompt is never injected — the setting only changes what a delivered markdown file pulls in. `#@` remains the sole prompt-level trigger.
- **No autocomplete for in-file imports.** The `#@` path completer runs in the editor prompt only. Import directives live inside markdown files (written by hand), where your editor's normal file completion applies.

## `#@` versus `@`

- `#@file` injects the whole file, always, everywhere.
- `@file` is Pi's built-in autocomplete and command-line argument handling. This extension does not change it.

Use `#@` when you want all of a file. Use `@` or the `read` tool when you want to browse or search without loading the whole file.
