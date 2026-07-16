# #@file

> `#@file` — inject the whole file, every time, everywhere.

A [Pi](https://github.com/earendil-works/pi) extension that lets you attach an
**entire** file to your prompt by writing `#@<path>` anywhere. The file lands in the model's
context *before* it replies — no `read` tool round-trip, no size limit, no configuration.

## What it does

`#@<path>` is a dedicated, **unconditional** whole-file injection trigger. When you write it
anywhere in a submitted prompt, the extension reads the **entire** referenced file and appends its
contents to the prompt in Pi-native `<file name="…">…</file>` blocks, below a `---` separator.
There is no size limit and no config: whatever file you name, the model gets all of it.

It works identically in **every** context — interactive TUI messages, the initial `pi -p` / CLI
message, and RPC — because it hooks Pi's `input` event (which fires inside `AgentSession.prompt()`
for *all* inputs), **not** argv parsing. Contrast: Pi's built-in `@file` only expands when passed as
a CLI argument *before* the session starts; interactively, bare `@` is just path autocomplete.

## Installation

The extension is a single `.ts` file with **zero npm dependencies** and **no build step** — Pi
loads `.ts` extensions via [jiti](https://github.com/unjs/jiti) (transpile-on-load). There are two
install models: **copy the `.ts`** into an auto-discovered extensions dir, or install the **repo as
a pi package** with `pi install`. The repo carries a thin `package.json` whose `"pi"` manifest
declares `sharp-at-file.ts`, so the directory itself is a loadable package — this is what makes
`pi install .` work and what prevents the `Cannot find module '<dir>'` crash if the directory is
ever handed to the loader directly (e.g. registered as a package or passed to `-e`).

Pick whichever placement fits your workflow.

### Global (recommended for "always on")

```bash
mkdir -p ~/.pi/agent/extensions
cp sharp-at-file.ts ~/.pi/agent/extensions/sharp-at-file.ts
```

Then start `pi` (or run `/reload` if a session is already running — extensions in the
auto-discovered locations hot-reload).

### Project-local (per-repo)

```bash
mkdir -p .pi/extensions
cp sharp-at-file.ts .pi/extensions/sharp-at-file.ts
```

Project-local extensions load after the project is trusted.

### As a package (`pi install`)

The repo is a valid pi package — its `package.json` declares `sharp-at-file.ts` under a `"pi"`
manifest — so you can install it by path instead of copying a file:

```bash
pi install .                            # current directory
pi install /abs/path/to/pi-auto-reader  # absolute path
```

This registers the directory in `~/.pi/agent/settings.json` (`packages`) and loads the extension
from there on every `pi` start. Use `pi remove .` (or the path you installed with) to uninstall.
Pick this **or** the copy method — not both (see the warning below).

### ⚠ Upgrading? Install exactly ONE copy (delete the old one)

Pi can load this extension from several places — the **global** `~/.pi/agent/extensions/` dir, a
**project-local** `.pi/extensions/` dir, **and** any directory registered via `pi install`. Co-loads
are now largely self-healing: the `#@` trigger is **stripped** once a file injects, so a later copy
(legacy or current) finds no marker to re-inject — and per-token dedup suppresses earlier copies.
The only residual double-injection case is **two stale (pre-strip, pre-dedup) copies**, a narrow
user error. Even so, one copy is the clean rule — see [`validation_report.md`](validation_report.md)
finding **F-NEW-1** for the history.

**When upgrading, delete the old copy first** — don't just add the new one elsewhere:

```bash
rm -f ~/.pi/agent/extensions/sharp-at-file.ts   # remove a stale GLOBAL copy
rm -f .pi/extensions/sharp-at-file.ts           # …and/or a stale PROJECT-LOCAL copy
pi remove .                                      # …and/or a `pi install` package registration
# then install the new copy in exactly ONE of the locations above
```

The safe rule: **one copy, one location.** The `pi -e ./sharp-at-file.ts` quick-test path is always
safe regardless (it co-loads cleanly and dedups against any global copy).

### Quick test (one-off, no install)

```bash
pi -e ./sharp-at-file.ts
```

…or combined with an initial message, the `-p` form documents the same path:

```bash
pi -e ./sharp-at-file.ts -p "Review #@a.ts"
```

> `pi -e` is for quick tests; it does **not** hot-reload. Use one of the auto-discovery locations
> above for day-to-day use.

## Quick start

```text
Review #@a.ts
Describe #@pic.png
Summarize #@~/notes.md
Diff #@a.ts vs #@b.ts
See #@a.ts.          # trailing punctuation is trimmed automatically
Review @a.ts         # bare @ is UNCHANGED — no injection by this extension
```

When you submit one of these, the file contents appear below a `---` rule in your message. The
extension **appends** (it does not inline-replace) and strips the `#@` trigger from each reference,
so `Review #@a.ts` reaches the model as `Review a.ts` — the path stays as a readable link to the
appended block, and the 2-token `#@` syntax is dropped as noise. (Tokens that don't resolve —
missing file, directory, read error — are left byte-for-byte verbatim, `#@` included.) These are the
exact prompts the test harness exercises, so you can run `node ./sharp-at-file.test.mjs` and watch
them pass.

**Path completion:** in the TUI, `#@` autocompletes file paths — type `#@` and start the path, and
the same gitignore-aware file list Pi uses for `@` pops up; Tab completes it as `#@<path>`. (The
extension registers a completion provider that reuses Pi's `@` engine; TUI/RPC only — headless
`pi -p` just takes the literal path.)

## Behavior by file type

| File type | What `#@path` does | Output appended to your prompt |
|---|---|---|
| **Text** (`.ts`, `.md`, `.json`, `.log`, …) | Entire file contents injected, no truncation | `<file name="/abs/path">`<br>`<entire contents>`<br>`</file>` |
| **Image** (`.png` `.jpg`/`.jpeg` `.gif` `.webp` `.bmp`) | Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag — but only after its first bytes pass a magic-number sniff (see notes); a mislabeled file (text named `.png`) falls through to the **text/binary** row instead of attaching as garbage | `<file name="/abs/path"></file>` *(plus the image is attached)* |
| **Empty image** (0-byte `.png`/`.jpg`/etc.) | Attaches **nothing** — an empty `ImageContent` would be rejected by providers, so a note block is emitted instead | `<file name="/abs/path"><empty image file — 0 bytes; nothing to attach></file>` |
| **Other binary** (a NUL byte is detected, and it's not an image) | NOT decoded — a clear note instead of garbage | `<file name="/abs/path"><binary file — contents not injected; use the read tool if needed></file>` |
| **Missing file** | Token left exactly as you wrote it | *(nothing appended)* |
| **Directory** (`#@src/`) | Token left exactly as you wrote it | *(nothing appended)* |
| **Read / permission error** | Token left exactly as you wrote it | *(nothing appended)* |

For the text case, a single block looks like this (byte-identical to Pi's built-in `@file` block
format — the `name` attribute is the resolved absolute path):

```text
<file name="/abs/path/to/file.ts">
<entire file contents, no truncation, no offset/limit>
</file>
```

Notes on the table:

- The image row's `<file name="…"></file>` may carry dimension hints when the image is resized; on
  tiny or undecodable images `resizeImage` returns `null` and the hints are empty (the raw image
  bytes are still attached). The `—` in the binary note is an em dash (U+2014), not a hyphen.
- A broken `#@` **never** breaks your prompt. Each file is isolated in its own `try`/`catch`, so a
  missing file, a directory, a permission error, or an unreadable file just leaves the `#@token`
  verbatim and processing continues with the rest.
- **Images are validated by both extension *and* actual bytes (magic-number sniff).** A file is
  attached as an image only if its extension is a recognized image type *and* its first bytes match
  that type's signature (PNG/JPEG/GIF/WEBP/BMP; files under 12 bytes always fail). A mislabeled file
  (e.g. a text body saved as `fake.png`) therefore falls through to the **text/binary** path and is
  injected as text — it is **not** attached as decoded garbage labeled as an image. This is a
  deliberate, safer improvement over routing by extension alone. *(Harness cases `F3a`, `F3b`.)*
- **A 0-byte image file attaches nothing.** An empty `ImageContent` would be rejected by providers,
  so instead of attaching an empty image the extension emits a note block —
  `<file name="…"><empty image file — 0 bytes; nothing to attach></file>` (the `—` is the same em
  dash, U+2014, used in the binary note) — and attaches no image, while still referencing the path.
  Note the contrast: a 0-byte *text* file is unaffected and injects as `<file name="…">\n\n</file>`;
  only 0-byte *images* get this special-case. This is a deliberate divergence, made to avoid a
  provider-rejected empty image. *(Harness case `F5`.)*

## Syntax

**Grammar:** `` `#@<path>` `` — the two-character trigger `#@` immediately followed by a path token,
where `<path>` is a maximal run of non-whitespace characters.

**Where it matches:** at the start of the prompt, **or** immediately after a non-word character
(space, `(`, `[`, `>`, etc.). It does **not** match mid-word — `foo#@bar` injects nothing. The word
boundary is **Unicode-aware**: `#@` does not trigger after non-ASCII letters or numbers in any
language either (e.g. `café#@x`, `Öster#@x`, or CJK like `日本語#@x` inject nothing), exactly as it
does not trigger after ASCII letters/digits/underscore.

**Trailing punctuation is trimmed.** `` `#@a.ts.` `` resolves to `a.ts`; `` `(#@a.txt)` `` resolves
to `a.txt`. The trimmed characters are exactly:

```text
. , ; : ! ? " ' ) ] } >
```

**Paths:** relative (resolved against the current working directory), absolute
(`#@/etc/hosts`), tilde (`#@~/notes.md`, `#@~`), and `../` are **all** allowed. There is no cwd
restriction — you asked for the file, you get the file.

## Key design choices

### Why a new `#@` symbol instead of reusing `@`

`@` is already overloaded in Pi: interactively it means path *autocomplete*, and at the CLI it means
*inject a file* (parsed from argv before the session starts). Overloading it further would be
ambiguous and would change existing behavior. `#@` is unambiguous and collision-free with Markdown
`#` headings, issue references like `#1234`, and `user@host` email addresses — and the `#` reads as
"force/sharp/inject." And `#@` is fully path-completable in the TUI: the extension registers a
completion provider that reuses Pi's own gitignore-aware `@` engine, so `#@` lists and Tab-completes
files exactly like `@` (details in PRD §14).

### Why no size limit

The whole point. `#@` is the predictable "give the model **all** of this file" affordance; gating it
would make it a worse `@`-with-config rather than a distinct tool. The tradeoff is honest: a careless
`#@` on a huge file can blow the model's context window or trigger a provider error. That's accepted
— it's your explicit, deliberate action (you typed a non-default symbol). For partial or large reads,
use Pi's `read` tool with `offset`/`limit`.

### Why no config

Configuring this feature would defeat its purpose. The contract is "always, entirely." There are no
env vars, no settings files, and no flags beyond `pi -e` (which is a Pi flag, not an extension
setting). The one apparent knob — the 2000×2000 image resize — is a *correctness* requirement
(providers reject oversized images), not a user-facing configuration. The whole image is still
delivered, downscaled to fit.

## Known limitations

- **No size gate (by design).** `#@` on a 50 MB file injects 50 MB and may overflow the model's
  context window. This is intended. For large files, use Pi's `read` tool with `offset`/`limit`.
- **Paths with spaces can't be expressed.** A space ends the path token, so `#@my file.txt` injects
  the file `my` (not `my file.txt`). Use the `read` tool for files with spaces in their names.
- **`#@` immediately followed by a backtick does not inject.** Inside a fenced code block
  (`` `#@a.ts` ``), the captured path token is `` a.ts` ``; the trailing backtick is **not** in the
  trimmed-punctuation set above, so the path `` a.ts` `` does not resolve and nothing is injected
  (the token is left verbatim). To reliably suppress `#@` anywhere in prose or code, write `# @`
  (with a space). *(An early design note had assumed `#@` inside code blocks would still inject; the
  shipped extension is safer — it does not. See
  [`plan/001_5aa8724eb506/P1M2T4S1/validation_report.md`](plan/001_5aa8724eb506/P1M2T4S1/validation_report.md),
  Finding F1.)*
- **No directory reads.** `#@some/dir/` is left as a literal token. Use a `read` or `ls` tool.
- **No globbing / multi-file expansion.** `#@src/*.ts` is treated as a single literal path token
  (`src/*.ts`), not a glob. It will not resolve unless a file literally named `*.ts` exists.

## Relationship to `@`

- **`#@file`** → whole file, always, everywhere (this extension).
- **`@file`** → Pi's built-in behavior (interactive path autocomplete / `@mention`; CLI argv inject).
  **Unchanged** by this extension — the trigger regex only matches `#@` (hash-then-at), never bare
  `@`.

The two coexist: use `#@` when you know you want **all** of a file; use `@` (or the `read` tool)
when you want partial or size-gated input. Confirmed by the acceptance harness (case #14):
`Review @a.ts` is byte-for-byte unchanged.

## Testing

```bash
node ./sharp-at-file.test.mjs     # model-free; exits 0 iff all assertions pass
```

The harness imports the **real** `sharp-at-file.ts` (via jiti, exactly like Pi's loader), runs all
14 PRD §11 acceptance cases plus edge cases, the three handler guards, the headless/notify path,
**co-load dedup** (a non-sentinel co-loaded copy must not double-inject a file), the
**structural multi-file dedup** guard (a prior `<file>` block for one path must not suppress a
different new file), the **mixed-pair co-load limit** (a dedup copy followed by a genuine
non-dedup legacy copy — pins the documented one-directional dedup limit, F-NEW-1), the
**sentinel-in-prompt** regression (a prompt containing the literal marker still injects its files),
and **Unicode word-boundary** tests (`#@` does not fire mid-word in any language), and prints a
pass/fail matrix. At last run: **34 passed, 0 failed.** No network, no model API key, and no Pi
process are required. See
[`plan/001_5aa8724eb506/P1M2T4S1/validation_report.md`](plan/001_5aa8724eb506/P1M2T4S1/validation_report.md)
for the full recorded results, including the two live-`pi` integration confirmations (the `-p` path
and the end-to-end format parity with `@file`).
