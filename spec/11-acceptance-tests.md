## 11. Acceptance Criteria & Test Plan

Load the extension:
```bash
pi -e ./file-injector.ts            # quick test (file)
pi -e .                             # quick test (directory — resolves via package.json manifest)
# or install as a package:  pi install .
# or copy to ~/.pi/agent/extensions/file-injector.ts and use /reload
```

### Manual test matrix

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | small `a.ts` (~50 words) | `Review #@a.ts` | Model receives the prompt plus a `<file name="/abs/a.ts">…</file>` custom message (no `read` tool call). In the TUI the user bubble reads `Review #@a.ts` (verbatim — `#@` preserved, §6.4) and a green `read a.ts (ctrl+o to expand)` line appears below it. |
| 2 | `huge.log` (50 MB) | `Summarize #@huge.log` | If it fits remaining context: injected whole, no `read` call. If it exceeds it: head block + paged directive (§5.5); the model pages the rest via `read`. Notify reflects the mode. |
| 3 | `pic.png` | `Describe #@pic.png` | `ImageContent` attached; `<file name="…">…</file>` reference appended; inline marker `#@pic.png` stays verbatim in the prompt (§6.4). |
| 4 | `data.bin` (binary) | `Inspect #@data.bin` | Binary note block appended; no decoded garbage. |
| 5 | missing | `Fix #@nope.ts` | Token left verbatim; prompt otherwise unchanged; model handles. |
| 6 | directory | `List #@src/` | Token left verbatim. |
| 7 | mid-word | `the foo#@bar thing` | **No** expansion (`#@` preceded by word char). |
| 8 | markdown/issue | `# Heading and #1234` | **No** expansion (no `#@`). |
| 9 | multi | `Diff #@a.ts vs #@b.ts` | Both injected; notify says `2 whole`. |
| 10 | tilde | `Read #@~/notes.md` | Expanded; injected. |
| 11 | trailing punct | `See #@a.ts.` | Period trimmed; `a.ts` injected. |
| 12 | initial CLI message | `pi -p "Review #@a.ts"` (extension loaded) | `a.ts` injected in the `-p` run too (input event fires for initial message). |
| 13 | format parity | compare `#@a.ts` output vs `pi @a.ts "x"` CLI output | Both emit `<file name="/abs/a.ts">\n<content>\n</file>` with identical content. |
| 14 | `@` unaffected | `Review @a.ts` (interactive) | `@a.ts` left as literal text (Pi's existing behavior preserved); no injection by this extension. |
| 15 | md import | `notes.md` containing `#@api.md`; `#@notes.md` | `notes.md` block delivered verbatim (marker `#@api.md` preserved) then `api.md` block; notify `2 whole`; no `read` calls. |
| 16 | md code-exempt | `notes.md` with `` `#@example.ts` `` in a fenced block + a real `#@api.md` | Only `api.md` imported; `#@example.ts` left verbatim in code. |
| 17 | md cycle | `a.md`→`#@b.md`, `b.md`→`#@a.md`; `#@a.md` | `a.md` + `b.md` injected once each; `b.md`'s `#@a.md` verbatim; no loop; notify `2 whole`. |
| 18 | md abs rejected | `notes.md` with `#@/etc/hosts`; `#@notes.md` | `/etc/hosts` not imported; marker verbatim; only `notes.md` injected. |
| 19 | md relative base | `sub/notes.md` imports `api.md` (sibling); `#@sub/notes.md` | `api.md` resolved as `sub/api.md` (relative to the md's dir), injected. |
| 20 | budget total | `#@a.md` importing 3 files + `#@big.log` (huge) | Imports share budget with top-level; `big.log` pages when total exceeds remaining; notify counts all delivered files. |
| 21 | md ext-shorthand | `notes.md` imports `#@api` (`api.md` exists); `#@notes.md` | `notes.md` block (verbatim; `#@api` preserved) then `api.md` block; notify `2 whole`. |
| 22 | md ext exact-wins | `notes.md` imports `#@readme` where both `readme` and `readme.md` exist; `#@notes.md` | Bare `readme` (exact) injected, not `readme.md`; notify `2 whole`. |
| 23 | md ext `.markdown` | `#@api` where only `api.markdown` exists; `#@notes.md` | Resolves to `api.markdown`; injected. |
| 24 | top-level no fallback | `#@PRD` at top level, only `PRD.md` exists | Left verbatim (exact-only at top level); no injection. |
| 25 | bare-`@` off (default) | `notes.md` with `@api.md` (exists); `#@notes.md` | `api.md` **not** imported (default); only `notes.md`; `@api.md` left verbatim. |
| 26 | bare-`@` on | config `markdownBareAtImports:true`; `notes.md` with `@api.md` (exists); `#@notes.md` | `notes.md` block (verbatim; `@api.md` preserved) then `api.md` block; notify `2 whole`. |
| 27 | bare-`@` on, `#@` still works | config on; `notes.md` with `#@api.md`; `#@notes.md` | `#@api.md` matched once, injected once; notify `2 whole`. |
| 28 | bare-`@` on, top-level unaffected | config on; prompt `#@notes.md` (notes imports `@x.md`); also type `@other.md` in prompt | `@other.md` at top level left as Pi's `@` behavior (not injected); only the `#@` chain runs. |
| 29 | bare-`@` via settings.json | `markdownBareAtImports:true` under `fileInjector` in settings.json; `notes.md` with `@api.md` (exists); `#@notes.md` | Same as #26 but via the settings.json key: `api.md` imported (bare), notify `2 whole`. |
| 30 | md relative disambiguation | `dir/a.md` imports `#@b.md`; **both** `dir/b.md` and `./b.md` exist; `#@dir/a.md` | `dir/b.md` injected (the md's dir wins); cwd-root `./b.md` has zero blocks. Proves resolution is file-relative, not cwd-relative. |
| 31 | md relative, deep + cwd-indep. | `directory/otherdir/some/file.md` imports `#@file2.md`; only `…/some/file2.md` exists; also a stray `./file2.md`; `#@directory/otherdir/some/file.md` | `…/some/file2.md` injected (the importing file's dir), never `./file2.md`. |
| 32 | bare-`@` first-file + chain | config on; prompt `#@a.md`; `a.md`→`@b.md`→`@c.md` (all bare `@`) | `a.md`, `b.md`, `c.md` all injected; the first imported file's bare-`@` is honored (no asymmetry vs. deeper files); notify `3 whole`. |
| 33 | **display — single file** | `Review #@a.ts` | User bubble: `Review #@a.ts` (verbatim). Below it: one green box line `read a.ts (ctrl+o to expand)`. `ctrl+o` shows the full highlighted contents; `ctrl+o` again collapses. Indistinguishable from a completed `read a.ts` tool call except the prompt retains `#@`. |
| 34 | **display — multi-file** | `Diff #@a.ts vs #@b.ts` | User bubble: `Diff #@a.ts vs #@b.ts` (verbatim). Below: two green lines `read a.ts` / `read b.ts` (one hint). Both expand together on `ctrl+o`. Notify `2 whole`. |
| 35 | **display — image** | `Describe #@pic.png` | Green line `read pic.png (resized to WxH)`; image renders via the user-message attachment. Expanded view does **not** duplicate the image. |
| 36 | **display — binary** | `Inspect #@data.bin` | Green line `read data.bin (binary — not injected)`; expanded shows the note. |
| 37 | **display — paged** | `Summarize #@huge.log` (over budget) | Green line `read huge.log:<startLine>-`; expanded shows head + directive; model pages the rest via `read`. Notify `0 whole, 1 paged`. |
| 38 | **display — color parity** | side-by-side: `#@a.ts` vs a real agent `read a.ts` | Both green boxes use identical `toolSuccessBg`; both `read` titles use `toolTitle`+bold; both paths use `accent`. Visually identical (the only difference: `#@` line appears at submit, no spinner). |
| 39 | **display — reload** | inject `#@a.ts`, reply, `/exit`, reopen session | The green `read a.ts` line re-renders from the persisted custom message; the model still has the `<file>` content on continuation. |
| 40 | **display — print mode** | `pi -p "Review #@a.ts"` | No TUI rendering; model still receives the `<file>` block via the custom message (verify in `--mode json` that a user-role message carries the `<file>` block after the prompt). |
| 41 | **model input — structure** | `#@a.ts` with extension loaded; inspect provider request (`before_provider_request`) | Two user-role messages: `[verbatim prompt — #@a.ts preserved]` then `[<file name="/abs/a.ts">…</file>]`. The prompt text is byte-identical to what the user typed (§6.4). |
| 42 | **re-open re-injection** | `Review #@a.ts`; cancel (ESC); `/tree` → select the user message → resubmit unchanged | Editor prefilled with `Review #@a.ts` (verbatim); resubmit re-creates the `<file>` custom message (no `read` call); model receives `a.ts` again. Confirms decorators survive cancel/re-open (§13.8). |
| 43 | line range — basic | `Review #@a.ts:10` (a.ts ≥ 10 lines) | Line 10 only in the block; green `read a.ts:10`; prompt verbatim; notify `1 whole` (§17). |
| 44 | range — malformed | `See #@a.ts:0` (and `#@a.ts:5-3`) | Token left verbatim; nothing injected; **warning notify** names the token and the rule (LR-3). |
| 45 | range — past EOF | `See #@a.ts:99` (5-line file) | No block, no `read` line, `injected 0`; warning notify `… file has 5 lines` (LR-4). |
| 46 | range — oversize slice | tight budget; `Summarize #@huge.log:1-999999` | Slice **pages**: head + directive resuming at the correct absolute line; notify `0 whole, 1 paged` (LR-1). |
| 47 | range — image/binary | `Describe #@pic.png and #@pic.png:3` | Image attached **once**; one `read pic.png` line; range not shown (LR-2). |

### Automated sanity check (optional)

Beyond the in-process `sharp-at-test` command above, two standalone Node scripts (zero-dep, load the real extension via Pi's jiti loader) pin the behaviors in this section as runnable regression gates:

- **`file-injector.test.mjs`** — the full §11 matrix + §10 edges (the project's `npm test`); line ranges are the `LINE-1 … LINE-12` cases (§17.9 — `LINE-7 … LINE-12` land with LR-1/LR-2/LR-3/LR-4/LR-5).
- **`relative-imports.test.mjs`** — focused on the two properties that are easiest to regress: **(a)** every `[#]@path` inside a delivered markdown resolves relative to that file's directory at every depth (never `ctx.cwd`; a same-named cwd-root file never wins, and a missing-in-dir import never falls back to cwd), and **(b)** with `markdownBareAtImports` on, bare-`@` is honored at **every** depth including the very first imported file (cases 30–32 above). Covers four layers: `resolveImportPath`, `scanTokens`, `injectFiles`, and the real `input` handler with a hermetic project config.

```ts
pi.registerCommand("sharp-at-test", {
  description: "Self-test for #@ injection",
  handler: async (_args, ctx) => {
    // create temp text + binary + markdown (with imports) files; run scanTokens/injectFile
    // on sample strings; assert: text injected, binary noted, missing left, email/mid-word
    // not matched, markdown imports resolved relative to the md's dir, code-block imports
    // skipped, cycle terminates, each path injected once.
    ctx.ui.notify("sharp-at self-test passed", "info");
  },
});
```

---

