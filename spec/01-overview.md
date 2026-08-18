## 1. Overview

### Problem
Pi has no simple, consistent way to say **"put this entire file into the model's context right now."**

- The existing `@file` syntax only auto-reads when passed as a **CLI argument** (`pi @file.txt "question"`). It is parsed from argv by `processFileArguments()` *before* the session starts.
- **Inside the interactive editor**, typing `@file.txt` only triggers path *autocomplete*; on submit the literal text `@file.txt` is sent and the model must call the `read` tool itself.
- Worse, `@file` is **overloaded**: it means "autocomplete a path" interactively *and* "inject a file" at the CLI. Users cannot express a clear, unconditional "inject the whole file" intent in either context without it being ambiguous.

### Solution
A new, dedicated syntax: **`#@<path>`**. It is an **unconditional file-delivery** trigger: whatever file the user names, the model receives all of it. When the user writes `#@filename.txt` anywhere in a prompt and submits, the extension reads the file and delivers it to the model **before** the model sees it. If the file fits the model's remaining context it is delivered whole; if it exceeds the remaining context it is delivered in pages the model reads through the `read` tool (see §5.5). No configuration either way.

**How delivery works (and how it looks).** Files are *not* pasted into the user's prompt text. Instead the extension delivers them as a single **custom message** (`customType: "fileInjector.injected"`) that a `before_agent_start` handler returns after the user message is built (§6.2). That custom message **participates in LLM context** — Pi's `convertToLlm()` maps `role:"custom"` to a user-role message — so the model receives every `<file name="/abs/path">…</file>` block it always did, byte-identical in content (§13.7 documents the one consequence: the model's input is now two user messages instead of one). Simultaneously the extension **registers a `MessageRenderer`** for that `customType` (§6.3) that draws the injected files in the chat exactly like the built-in `read` tool: a green box (theme color `toolSuccessBg`) showing **one `read <path>` line per file** when collapsed, expanding on `ctrl+o` to the full file contents — the same collapse/expand affordance the `[skill]` block uses, but green and one-line-per-file. To the end user it is indistinguishable from the agent having called `read` on each file itself; the only difference is that the files are attached at submit time instead of after a model round-trip. The user's own message bubble shows exactly what they typed — the `#@<path>` triggers are **preserved verbatim** (§6.4), so cancelling and re-opening the request, forking, or re-submitting the prompt re-triggers injection — and never the raw file contents (those render as the green `read` lines below).

`#@` is deliberately a **different symbol** from `@` so there is zero ambiguity:
- `@file` → Pi's existing behavior (autocomplete interactively; inject at CLI). Left untouched.
- `#@file` → **always** delivers the whole file to the model, in every context (injected whole when it fits remaining context, paged when it exceeds it; see §5.5).

**Markdown transitive imports.** When a delivered file is markdown (`.md`/`.markdown`), the extension also scans its *contents* for further `#@<path>` directives and delivers those files too — recursively, because an imported markdown file is itself scanned. This turns a single `#@spec.md` into "spec.md plus everything spec.md points at," with no extra syntax: the import directive inside a markdown file is the **same** `#@<path>` the user types in a prompt. **Extension shorthand:** a markdown import may omit the `.md`/`.markdown` extension — `#@PRD` resolves to `PRD.md` (or `PRD.markdown`) when no bare `PRD` file exists, because `#@` is a strong import signal and an extensionless name that matches a markdown file after appending `.md`/`.markdown` is treated as an exact match (markdown imports only; top-level tokens stay exact-match). Three guards keep it sane and loop-free: (1) imports resolve **relative to the markdown file's own directory** and absolute/tilde paths are ignored (so a shared doc can't pull arbitrary home/system files), (2) **each absolute path is injected at most once across the entire prompt**, which bounds recursion for free, and (3) `#@` inside fenced or inline code is not an import — code is the escape hatch for a markdown doc that wants to *document* the `#@` syntax. Full spec in §5.6.

### Value proposition
- **One syntax, every context.** Because the extension hooks the `input` event (which fires for *every* prompt — interactive typed messages *and* the initial CLI/`-p` message), `#@file` works identically whether you launch with it or type it mid-session. (See §3.)
- **Explicit intent.** `#@` can't be confused with a path-completion trigger or an email-style `@mention`. The user is saying "give the model this whole file," and that's exactly what happens.
- **Composable for docs.** `#@spec.md` pulls in everything `spec.md` references with the *same* `#@` directive — spec-and-its-dependencies in one token, loop-safe via dedup (§5.6).
- **Reads like a `read`, not like a paste.** Injected files render in the chat as compact, green, collapsible `read <path>` lines (one per file) — visually identical to the built-in `read` tool's completed-call rendering and to how `[skill]` blocks collapse/expand — while the model still receives the full `<file>` contents. The user's message bubble shows the prompt verbatim (`#@` preserved so cancel/fork/re-open re-trigger injection; §6.4); the file bytes never appear in the bubble. No config; it is how `#@` always looks.
- **Zero config by default.** No setup is required — `#@` works out of the box. The inline-vs-paged decision is computed automatically from the active model's context window and current usage (§5.5), and there are no knobs for format, image handling, paging, budget, or display. The single user-facing setting is the opt-in `markdownBareAtImports` (§4.6), off by default.

### Tagline
> "`#@file`: the whole file, every time, everywhere."

---

