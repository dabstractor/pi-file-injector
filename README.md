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
