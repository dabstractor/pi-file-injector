## 13. Design Rationale & Tradeoffs

### 13.1 Why unconditional delivery (no silent size gate)
The user wants **"inject the entire file every time. No maxWords, no config."** The earlier framing of this as "no size gate, accept that huge files blow the context" was dishonest: the model's context window is a hard limit, and a file larger than the remaining context cannot be injected whole by anyone. The honest contract is "the whole file always reaches the model": injected inline when it fits, paged through the model's `read` tool when it does not (§5.5). There is still no silent truncation and no size knob for the user.

### 13.2 The tradeoff (be honest about it)
For files that fit remaining context, behavior is unchanged: the whole file is injected inline. For files that exceed it, the tradeoff is that the file arrives **paged** rather than in one block:
- The model reads the file across the turn via the `read` tool, so it sees all of it but never holds all of it simultaneously (impossible past the context window).
- Paging is model-driven: the extension emits a directive, the model issues the reads. This is reliable for typical `#@` tasks (review, summarize, diff) but not guaranteed, because the `input` handler can only rewrite prompt text; it cannot force a tool call.
- The alternatives are worse: silently truncating the file (the model works from a partial file with no signal), or letting the request fail (the user gets an error and must retry by hand).

### 13.3 Why a separate symbol instead of reusing `@`
- `@` is overloaded (autocomplete + CLI inject). Overloading it further with "inject whole file interactively" would be ambiguous and would change existing behavior.
- `#@` is unambiguous, collision-free (§3.2), and signals stronger intent — the `#` reads as "force/sharp/inject."
- The `#` does **not** piggyback on Pi's `@` autocomplete on its own — Pi's file-completion gate only fires for `@` at a token boundary, and `#` glued in front closes it. Path completion for `#@` is provided by a separate autocomplete provider (see §14).

### 13.4 Why (almost) no user-facing config
There is still no configuration *required*, and no knobs for the things that should just work: the inline-vs-paged decision is computed from the active model's context window and the current usage estimate (§5.5), and there are no toggles for format, image handling, paging, or the context budget — those stay derived/fixed. The one opt-in is `markdownBareAtImports` (§4.6): a bare `@file.md` is a widespread doc convention, and forcing `#@` inside markdown would fight existing docs. It is opt-in (default off) precisely so the default stays zero-setup and unambiguous — `#@` remains the only thing that ever triggers injection at the prompt, and bare-`@` matching never escapes markdown content. Knobs for anything else would reintroduce the complexity the user asked to remove.

### 13.5 Relationship to a size-gated `@`
With §5.5, `#@` itself covers both the inline and the oversize cases, so a separate size-gated `@` extension is no longer needed for token-economy reasons. `@` stays as Pi's built-in autocomplete and CLI argument handling, unchanged. If a future feature wants `@` to inline small files interactively (which `#@` already does), it can be built independently; it does not compete with this PRD.

### 13.6 Why markdown transitive imports, and why these guards

`#@` already delivers a whole file; markdown files are the one format that commonly *references other files by path* in-band. Letting `#@spec.md` pull in everything `spec.md` points at matches user intent ("give me the spec and its dependencies") with **no new syntax** — the import directive is the same `#@<path>`.

The three guards are deliberate:
- **Relative-only + resolve-from-the-md's-dir** makes imports portable and stops a shared markdown doc from silently pulling `/etc/passwd` or `~/.ssh/id_rsa`. Top-level user tokens stay unrestricted (the user typed them deliberately).
- **Dedup (each abs once)** bounds recursion for free — cycles terminate, shared dependencies are injected once. No fragile depth counter.
- **Code is exempt** because markdown's primary use of `#@` in the wild is *documenting* `#@`. Without the exemption, every doc that shows a `#@` example would import a stray file. Fenced/inline code is the natural escape hatch.

The cost is real: a single `#@` can now balloon to many files. That is why imports share the single context budget (§5.6.2) and page when the running total exceeds remaining — the model never silently receives more than fits, and the total filesize of every file (top-level plus imports) is accounted for in one accumulator.

**Why extension shorthand, and why markdown-only.** Markdown imports are authored in files where there is no live path completion (§14 is prompt-only), so a bare `#@PRD` is a natural way to reference the `PRD.md` doc — `#@` is a strong enough import signal that an extensionless name matching a markdown file after appending `.md`/`.markdown` should be treated as an exact match. The fallback is deliberately scoped to markdown imports and to *extensionless* tokens: exact-match always wins (a bare `PRD` file beats `PRD.md`), an explicit `#@PRD.md` never becomes `PRD.md.md`, and top-level prompt tokens stay exact-only (the user has autocomplete there). Dedup keys on the resolved abs, so `#@PRD` and `#@PRD.md` in the same file inject once.

### 13.7 Why custom messages + a renderer (compact display), and its one tradeoff

The user asked that injected files appear in the chat **exactly like the `read` tool** — compact green `read <path>` lines, one per file, expandable — while the model still receives the full contents. This section explains the mechanism and the single honest tradeoff.

**How Pi itself achieves compact display (the precedent).** The `[skill]` block collapses because Pi *hard-codes* `parseSkillBlock()` in the TUI's `case "user"` renderer: it detects `<skill …>…</skill>` XML **inside the user-message text**, splits it out, and renders a collapsible `SkillInvocationMessageComponent` (purple `customMessageBg`) plus the remainder as a normal user message. The model still gets the full `<skill>` XML because it's in the stored text. The `read` tool, meanwhile, renders via `ToolExecutionComponent` — a `Box` with `toolSuccessBg` (green) and a `read <path>` call line (`toolTitle`+bold), collapsing the result until expanded.

**Why we cannot reuse the skill trick for `<file>` blocks.** There is **no** extension hook to make `UserMessageComponent` collapse arbitrary `<file>` blocks that live *inside* user-message text — `parseSkillBlock` is the only such parser and it is core, not extensible. So as long as the file bytes stay in the user message (the old design), they are shown in full in the user bubble with no way to hide them. **Compact display therefore requires the bytes to leave the user message.**

**The mechanism we use (all public API, zero core changes).** Move the bytes into a **custom message**:
- A `before_agent_start` handler returns `{ message: { customType, content, display:true, details } }`. Pi appends it **after** the user message, **persists** it, and — via `convertToLlm()` (`role:"custom"` → user-role message) — **sends it to the LLM**. So the model still receives every `<file name="…">…</file>` block, byte-identical in content.
- A `MessageRenderer` registered for that `customType` returns a green `Box` (`toolSuccessBg`) with one `read <path>` line per file (collapsible/expandable), replicating the `read` tool's look using the same theme keys (`toolTitle`, `accent`, `dim`).
- The `input` handler still does all file I/O (it attaches images and stashes the built blocks+details for `before_agent_start` through a one-shot closure stash, §6.2) but **leaves the prompt text verbatim** (§6.4) so cancel/fork/re-open re-trigger injection.

**The one tradeoff (be honest about it).** The model's input changes from **one** user message (`prompt` + appended `<file>` blocks) to **two** user messages (`prompt`, then the custom→user message with the `<file>` blocks). The *content* is byte-identical; only the message *boundary* differs. In practice this is benign-to-better: providers treat consecutive user messages fine, the files are still clearly associated with the prompt, and nothing is lost, added, or rewritten. It is **not** a change to what the model is told — only to how it is parcelled. This is the unavoidable cost of compact display at the extension level: the bytes must live where the TUI renders via a registered renderer, and that is a separate message.

**Why this is strictly better than the alternatives.**
- *Append to prompt text + display-only custom entry (dual render).* Rejected: `UserMessageComponent` would still print the full bytes in the user bubble; the user would see the content twice (once expanded, once as read lines). No suppression hook exists.
- *Monkeypatch `UserMessageComponent`/`parseSkillBlock`.* Rejected: depends on Pi internals (unstable), breaks across versions, and violates "no core patch."
- *Wait for Pi core to add `<file>` collapsing.* Out of scope (this is an extension) and unbounded (may never ship).

**Why green / read-tool styling, not purple / skill styling.** The user's explicit model is the `read` tool ("exactly as though the read tool were called"), and the example shows green lines. `toolSuccessBg` + `toolTitle` is the literal color/bold recipe the `read` tool's completed call uses; `customMessageBg` (purple) would make injected files look like skills instead. We keep only the collapse/expand affordance in common with skills, because it is the right UX for "summary line → full content."

### 13.8 Why the prompt is preserved verbatim (no `#@` stripping)

The first draft of this spec stripped `#@` from the user prompt (leaving a bare path) and from delivered markdown import markers, on the theory that a "cleaner" bubble was worth it. That was a mistake: **stripping breaks every re-submission path.**

When the user cancels a request (ESC), forks the conversation, or navigates the session tree (`/tree`) back to a user message and re-submits, Pi does **not** replay the original typed text — it re-feeds the **stored** user-message content. This was verified in `agent-session.ts`: `navigateTree()` computes the editor prefill as `_extractUserMessageText(targetEntry.message.content)` and the interactive layer then calls `editor.setText(editorText)`. There is **no** extension hook to override that prefill — `session_before_tree` can cancel or alter the summary but not the editor text, and `session_tree` fires *before* `editor.setText`, so calling `ctx.ui.setEditorText()` there is silently clobbered (and deferring it via `setTimeout` is a racy hack, not a design). The same stored-content replay applies to follow-up/steer dequeue (`restoreQueuedMessagesToEditor`) and to forks.

Consequence: if the extension had transformed `Review #@a.ts` → `Review a.ts` before storing, the re-submitted prompt contains no `#@`, the `input` handler finds nothing to inject, and **the files silently vanish on every re-open.** The only way to make re-submission reliably re-trigger injection is for the stored prompt to still contain `#@` — i.e. **do not strip.**

So the extension leaves `event.text` byte-for-byte intact (it still attaches images via the `images` field and still publishes the `<file>` blocks via the `before_agent_start` custom message). The cost is purely cosmetic: the user bubble shows `Review #@a.ts` instead of `Review a.ts`. That cost is negligible — stripping's only real effect was deleting two characters per marker (a handful of tokens), never any file bytes (those were always in the custom message). Verbatim delivery is strictly better: honest (model and bubble both show exactly what the user typed), simpler (no marker-index/`prefixLen` bookkeeping anywhere — not in the input handler, not in `injectMarkdown`, not in `scanTokens`), and re-open-safe across cancel, fork, `/tree`, and queued-message dequeue.

---

