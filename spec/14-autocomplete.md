## 14. Interactive Path Autocomplete (TUI)

`#@` is a two-character trigger, and Pi's built-in `@` file-completion (gitignore-aware, powered by
`fd`) only fires when `@` sits at a token boundary. A `#` glued immediately in front of the `@`
closes that gate, so — out of the box — typing `#@` yields **no** path suggestions; the user must
type the full path by hand.

### 14.1 Hook

Pi exposes `ctx.ui.addAutocompleteProvider(factory)` (TUI/RPC modes only; see Pi's
`docs/extensions.md` → "Autocomplete Providers"). The factory wraps the built-in provider (received
as `current`) and can override three levers: `getSuggestions`, `applyCompletion`, and
`shouldTriggerFileCompletion` (the gate). The extension registers it on `session_start`, guarded for
headless print/json modes. This is purely a TUI affordance — headless `pi -p "...#@file..."` is
unaffected (the user types the full path; injection still runs via the `input` handler).

### 14.2 Implementation (shipped) — line-rewrite reuse (Option 1)

**Option 2 (gate override) was tried first and rejected.** Overriding only
`shouldTriggerFileCompletion` to return `true` at `#@<partial>` (delegating the rest to the built-in)
produced **no suggestions**: Pi's built-in `@`-query extraction is itself boundary-strict
(`CombinedAutocompleteProvider.extractAtPrefix` requires `@` at a token boundary), so opening the
gate alone is insufficient. Reverted.

**Shipped: Option 1 — line-rewrite reuse.** In `getSuggestions`, detect `#@<partial>` at the cursor,
rewrite that one `#` into a space (so the built-in sees a clean `@<partial>` at a valid boundary),
delegate to `current.getSuggestions(...)`, then remap the result back to `#@`: `prefix "@<partial>"`
→ `"#@<partial>"` and each item value `@<path>` → `#@<path>`. `applyCompletion` is implemented
inline for `#@` prefixes (deterministic replace, cursor placed after the inserted value) and
delegates otherwise; `shouldTriggerFileCompletion` delegates to the built-in unchanged. This reuses
Pi's entire file engine — gitignore-aware `fd` listing, sorting, fuzzy matching — with **zero**
reimplementation; only a one-character line rewrite and a prefix/value remap are added.

A last-resort **Option 4** (reimplement file listing via `fd`/`git ls-files`, à la Pi's
`github-issue-autocomplete` example) remains documented but was **not** needed — reuse through
`current` works.

### 14.3 Non-goal

No suffix-style `@<file>#` trigger. It would inherit Pi's `@` completion for free but demands a
trailing `#` the user must type (and often backspace an inserted boundary for), and it makes `#` a
suffix marker that collides with prose. `#@` (prefix) with a completion provider is strictly better.

### 14.4 Scope note (markdown imports are injection-only)

The autocomplete provider (§14.2) only helps the user type a **top-level** `#@path` in the prompt.
Import directives **inside** an injected markdown file are never typed in the editor, so they get no
autocomplete — and they need none (the markdown author writes them by hand in the file, where normal
file-path completion in their editor applies). The import path is resolved relative to the markdown
file's directory (§4.5), not the prompt cwd; an extensionless import token also tries `.md`/`.markdown`
(§4.5).

---

