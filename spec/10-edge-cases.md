## 10. Edge Cases (implementer checklist)

> **Terminology note (post-display feature):** throughout this table, “a block is delivered / appended” now means *the `<file>` block is added to the single custom message* (§6.2) and *rendered as one green `read <path>` line* (§6.3) — **not** appended into the user's prompt text. The user message is always the user's prompt verbatim (`#@` preserved; §6.4). Dedup, ordering, paging, and file-type semantics are unchanged.

| Case | Expected behavior |
|---|---|
| No `#@` in prompt | `continue` (no work); `before_agent_start` returns `undefined` (no stash). |
| `#@nonexistent.txt` | Token left verbatim; no block; no error. |
| `#@some/dir/` (directory) | Token left verbatim. |
| `text #@a.txt more` | File delivered (green `read a.txt` line below the bubble); the prompt is stored **verbatim** — `#@a.txt` stays in place, so re-open re-triggers (§6.4). |
| Multiple `#@a.txt #@b.md` | Both delivered (two `read` lines, in order); notify `2 whole`. |
| Same path twice (`#@a.ts` + `#@./a.ts`, or `#@a.md` that imports `a.ts`) | Injected once across the **whole prompt** (shared `injectedSet`, including imports); repeats left verbatim. |
| `#@huge.log` (50 MB) | If it fits remaining context: injected whole. If it exceeds it: head block + paged directive (§5.5). Never silently truncated. |
| `#@data.bin` (binary, NUL) | Binary note delivered (rendered as `read data.bin (binary — not injected)`); no garbage. |
| `#@pic.png` | Image attached as `ImageContent` (resized) to the user message; reference delivered + rendered as `read pic.png (resized …)`. |
| `#@~/notes.md` | Tilde-expanded; resolved; injected. |
| `#@/etc/hosts` (absolute) | Resolved; injected (explicit user intent). |
| `#@file.txt.` (trailing period) | Period trimmed → `file.txt`; injected. |
| `(#@file.txt)` | `(` is non-word → matches; token `file.txt)` → trimmed to `file.txt`; injected. |
| `foo#@bar` (mid-word) | **Not matched** (`#@` preceded by word char `o`). |
| `# @file` (space between) | **Not matched** (trigger is `#@`, not `# @`). |
| Markdown `# Heading` / issue `#1234` | **Not matched** (no `#@`). |
| `#@file` inside a fenced code block (user prompt) | Still matched/injected (known minor limitation; use `# @` or rephrase to avoid). |
| Read throws (permissions) | Caught; token left verbatim; other tokens still processed. |
| `resizeImage` returns `null` | Fall back to raw base64 of original image bytes. |
| Empty file (0 bytes) | Injected as empty `<file name="…">\n\n</file>` — correct and cheap. |
| `source === "extension"` | Skipped entirely (loop prevention). |
| Mid-stream steering | Skipped entirely (latency). |
| RPC / print mode (`ctx.hasUI === false`) | Still injects; skip the `notify`. |
| Initial CLI/`-p` message containing `#@file` | **Also injected** (input event fires in `prompt()`). |
| `#@spec.md` that imports `#@api.md` | Both injected: `spec.md` block delivered **verbatim** (import marker `#@api.md` preserved), then `api.md` block. Notify `2 whole`. |
| Markdown import is itself markdown (`a.md`→`b.md`→`c.md`) | All three injected, pre-order: `a.md`, `b.md`, `c.md`. Each once. |
| Cycle (`a.md`→`b.md`→`a.md`) | `a.md` injected once (claimed before its own scan); `b.md`'s `#@a.md` left verbatim. No infinite loop. |
| Markdown import with absolute/tilde (`#@/etc/hosts` inside `a.md`) | Ignored (relative-only); left verbatim as `#@/etc/hosts` in injected content. |
| `#@path` inside fenced/inline code in `a.md` | Not an import; left verbatim. (Escape hatch for documenting `#@`.) |
| `#@notes.md` where `notes.md` imports a missing `api.md` | `notes.md` injected (verbatim); `#@api.md` left verbatim in `notes.md` content (unresolved). |
| `#@notes.md` where `notes.md` imports a 50 MB `big.log` | `big.log` evaluated against the shared budget; paged if it exceeds remaining. Counted in notify. |
| Markdown import resolves outside cwd (`#@../shared/api.md` inside `notes.md`) | Allowed (relative to the markdown's dir); injected. |
| Markdown import with a same-named file in BOTH the md's dir AND cwd (`#@b.md` inside `dir/a.md`; both `dir/b.md` and `./b.md` exist) | `dir/b.md` injected (md's dir wins); cwd-root `./b.md` never chosen. Resolution is file-relative at every depth. |
| Markdown import missing in the md's dir but present under cwd (`#@ghost.md` inside `dir/a.md`; only `./ghost.md` exists) | Left verbatim (`#@ghost.md`); **no** cwd fallback — the cwd copy is never injected. |
| Markdown import w/o extension (`#@PRD` in `a.md`; `PRD.md` exists) | Resolves to `PRD.md` (extension shorthand); injected & scanned. The `#@PRD` marker stays verbatim in `a.md`'s block. |
| Markdown import w/o extension, `.markdown` (`#@PRD`; only `PRD.markdown`) | Resolves to `PRD.markdown`; injected. |
| Markdown import, exact beats shorthand (`#@readme`; both `readme` and `readme.md`) | Bare `readme` (exact) wins; `readme.md` not imported. |
| Markdown import w/o extension, no match (`#@ghost`; no `ghost`/`ghost.md`/`ghost.markdown`) | Not resolved; left verbatim (`#@ghost`). |
| Markdown import already extended (`#@PRD.md` in `a.md`; missing) | Exact-only (no `PRD.md.md`); left verbatim. |
| Markdown dedup across shorthand (`#@PRD` + `#@PRD.md` in same file) | Same resolved abs → injected once; second marker left verbatim. |
| Top-level extensionless (`#@PRD` in prompt; only `PRD.md`) | Exact-only at top level; left verbatim. |
| Missing `.md` at top level (`#@nope.md`) | Token left verbatim (missing); no scanning. |
| Markdown imports push total over budget | Later files page against the running total; never silently exceed (§5.6.2). |
| `markdownBareAtImports` off (default); `@api.md` in `a.md` | Bare `@` not matched; left verbatim. Only `#@` imports. |
| `markdownBareAtImports` on; `@api.md` in `a.md` (file exists) | Imported (bare-`@`); marker stays verbatim in `a.md`'s block. Same rules as `#@`. |
| `markdownBareAtImports` on; bare `@` in the FIRST imported file (prompt `#@a.md`; `a.md` contains `@b.md`) | `b.md` imported — the first file is not special-cased; bare-`@` is honored at depth 0→1 just like deeper levels. No `#@` required inside `a.md`. |
| `markdownBareAtImports` on; bare-`@` chain across depths (prompt `#@a.md`; `a.md`→`@b.md`→`@c.md`) | `a.md`, `b.md`, `c.md` all injected; every level honored (no asymmetry between first and deeper files). |
| `#@api.md` with the option on | Matched once by `#@` (bare regex skips a `#`-preceded `@`); never double-matched. |
| `@username` in prose (option on; no `username.md`) | Not resolved → left verbatim. Prose imports only if it names a real file. |
| `@api.md` at the top level (option on) | Unaffected — top-level is `#@`-only; Pi's normal `@` behavior. |
| `user@host.com` in markdown (option on) | Not matched (`@` mid-word); left verbatim. |
| Project `markdownBareAtImports: true` in an **untrusted** project | Ignored (`isProjectTrusted()` false); global value used. |
| Missing/malformed config (settings key or `file-injector.json`) | Defaults to `false`; no error, no behavior change. |
| `markdownBareAtImports` under `fileInjector` in `settings.json` | Read like the dedicated file; co-located with the user's other Pi settings. |
| Both `settings.json` key and `file-injector.json` set in the same scope | Dedicated `file-injector.json` wins within that scope; project overrides global. |
| **Chat display — single file** | User bubble = verbatim prompt (e.g. `Review #@a.ts`); directly below, one green (`toolSuccessBg`) `read a.ts (ctrl+o to expand)` line. Model receives the verbatim prompt + `<file name="/abs/a.ts">…</file>` custom message. |
| **Chat display — multiple files** | One green `read <path>` line per file, in emission order, under the user bubble; `ctrl+o` expands all (unit expand, like `[skill]`). Notify still says `N whole`. |
| **Chat display — image** | Green `read img.png (resized to 1568×1044)` line; the image itself is attached to the user message above (as today). Expanded view repeats the reference line only (no double image). |
| **Chat display — binary** | Green `read data.bin (binary — not injected)` line; expanded shows the same note text. |
| **Chat display — paged** | Green `read huge.log:<startLine>-` line (range suffix, like the read tool); expanded shows the head + the paged directive text; the model pages the rest via `read` as before. |
| **Chat display — markdown imports** | One `read <path>` line per file across the whole transitive set (parent before children, pre-order); all in the single green box. |
| `ctrl+o` expand/collapse | Toggles the whole injected-files box between the read lines and full contents (mirrors `[skill]` block behavior). |
| Session reload | The custom message is persisted; on reload it re-renders via the same renderer (green read lines) and is re-sent to the model on continuation (same as old appended text). |
| **Cancel + re-open** | Submit `Review #@a.ts`, cancel (ESC) mid-reply, re-open via `/tree` (select the user message). The editor is prefilled with the **verbatim** `Review #@a.ts` (decorators preserved); resubmit re-triggers injection and re-creates the custom message. No files lost (§6.4, §13.8). |
| **Fork at a user message** | Fork at the `Review #@a.ts` user message. The forked session's prompt retains `#@a.ts` (stored verbatim), so the first turn in the fork injects `a.ts` as normal — no manual re-`#@` needed. |
| **Queued follow-up dequeue** | A queued (steer/followUp) message that contained `#@` is restored to the editor verbatim on dequeue; re-submit re-triggers injection. |
| `#@` in print / JSON mode (`-p`, `--mode json`) | No TUI, so the renderer is never called; the custom message still delivers the `<file>` blocks to the model (files are *not* lost in non-interactive modes). |
| `before_agent_start` registered by another extension | Independent; our handler consumes only our stash. Other extensions' messages render separately. Our stash is empty unless our `input` handler ran and found `#@`. |
| `input` short-circuits (extension source / steering) but `before_agent_start` still fires | Stash empty → `before_agent_start` returns `undefined`; no phantom injection. |
| Renderer throws | Caught by `CustomMessageComponent`; falls back to Pi's default `[fileInjector.injected]` purple box. Never crashes the TUI. (Renderer is defensive; this is a last resort.) |
| Old/foreign `fileInjector.injected` entry with no `details.files` | Renderer fallback: single `read (injected files)` line + raw `content` when expanded (§6.3). |
| `#@a.ts:3` / `#@a.ts:2-3` | Only lines 3 / 2–3 delivered; `read a.ts:3` / `read a.ts:2-3`; prompt verbatim (§17). |
| `#@a.ts:0` / `#@a.ts:5-3` (invalid) | Not a range — literal fallback fails → verbatim **+ warning notify** (LR-3). |
| `#@a.ts:99` on a 5-line file | Past-EOF start → verbatim, no block, claim revoked, notify — never an empty block (LR-4). |
| `#@a.ts:2-100000` on a 5-line file | Lines 2–5 delivered; displayed `read a.ts:2-5` (clamped, LR-5). |
| `#@a.ts:10` + `#@a.ts:10-10` / + `#@a.ts:20` / + `#@a.ts` | Same canonical key → one block / two distinct ranges → two / range + whole → two (§17.3). |
| `#@pic.png:3` (+ `#@pic.png`), `#@data.bin:5` | Range ignored; image attached / note delivered **once**; bare-path claim (LR-2). |
| `#@huge.log:1-999999` under a tight budget | The **slice** pages — head + directive, resume in file coordinates (LR-1). |
| `#@notes.md:2` (import on line 2) vs `:1` | Import resolved / not — the scan runs on the slice (LR-6). |
| Literal file named `a.ts:10` exists | Exact path wins — whole literal file, no range (§17.2). |

---

