# `#@file`

A [Pi](https://github.com/earendil-works/pi) extension that injects a whole file into your prompt when you write `#@` before the path. The file reaches the model before it replies, the whole file always reaches the model — injected whole when it fits the remaining context, paged via the `read` tool when it doesn't — with no configuration.

## Why

Pi's built-in `@file` injects a file only when you pass it on the command line before a session starts. In the editor, `@` is path autocomplete, and the model has to call a tool to read the file itself.

`#@` always delivers the entire file to the model, in every context: the editor, a `pi -p` one-shot, and RPC. When the file fits the remaining context it is injected whole; when it exceeds the budget it is delivered as a head block plus a paging directive that the model reads through.

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
| Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected when they fit remaining context. Oversize files are delivered as a head block plus a paging directive — the model reads the rest via the `read` tool. Never silently truncated. |
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

- **No size knob.** `#@` has no user-facing size setting. Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive; the model reads the rest via the `read` tool. The model never holds a file larger than its context window all at once — that is a property of the medium, not of this extension.
- **No spaces in paths.** A space ends the path, so `#@my file.txt` injects a file named `my`. Use the `read` tool for files with spaces.
- **No directories.** `#@src/` is left as-is. Use a `read` or `ls` tool.
- **No globs.** `#@src/*.ts` is a literal path, not a pattern. It resolves only if a file named `*.ts` exists.
- **A backtick right after `#@` blocks it.** Inside a code span like `` `#@a.ts` ``, nothing is injected. To suppress `#@` anywhere, write `# @` with a space.

## `#@` versus `@`

- `#@file` injects the whole file, always, everywhere.
- `@file` is Pi's built-in autocomplete and command-line argument handling. This extension does not change it.

Use `#@` when you want all of a file. Use `@` or the `read` tool when you want to browse or search without loading the whole file.
