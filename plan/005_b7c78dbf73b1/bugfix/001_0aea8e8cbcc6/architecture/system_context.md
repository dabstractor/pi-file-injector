# System Context — Bugfix 001_0aea8e8cbcc6

## Scope

Two issues surfaced by end-to-end QA of `file-injector.ts` (the 1087-line `#@file`
Whole-File Injection extension):

- **Issue 1 (Major)** — A markdown transitive import whose target file EXISTS (stat OK,
  isFile OK) but is UNREADABLE (readFile throws EACCES / I/O error) has its `#@`/`@` marker
  STRIPPED to a bare path inside the parent markdown's emitted block, with NO `<file>` block
  appended and NO error. This silently violates the explicit "leave verbatim on read-error"
  guarantee (PRD §5.4, §5.6 step 4, §12.5; README "permission error → Left as written").
- **Issue 2 (Minor, test-harness only)** — `readConfig` unit case `T2.S1-f` was
  environment-dependent.

## ⚠️ REALITY-CHECK FINDINGS (verified by running the real code)

These findings OVERRIDE the PRD's prose where they differ. They were established by:

1. Reading the current working-tree source.
2. Loading the real `file-injector.ts` through Pi's jiti+alias loader (identical to the
   test harness) and exercising `injectFiles` directly.
3. Running `node ./file-injector.test.mjs` in the current environment.
4. `git diff` / `git status` on the working tree.

### Finding A — Issue 1 is CONFIRMED PRESENT (reproduced live)

Repro (run as non-root; `file-injector.ts` is at the committed state, NOT modified in `git status`):

```
api.md   = "API secret\n"            (chmod 000 → stat OK, readFile EACCES)
notes.md = "Notes intro.\n#@api.md\nNotes end.\n"
await injectFiles("Read #@notes.md", [], { cwd, getContextUsage: () => undefined })
```

Result (observed):
- `injected: 1`
- parent block contains bare `api.md` (the `#@` was STRIPPED)
- `r.text.includes("#@api.md")` → **false** (BUG — should be `true`, verbatim)
- no `<file>` block for `api.md` is appended

This matches the PRD's Issue 1 description exactly. The bug is real and live.

### Finding B — Issue 2 is ALREADY FIXED in the working tree (uncommitted)

`git status` shows `file-injector.test.mjs` as MODIFIED (` M`), but `file-injector.ts` is NOT
modified. `git diff file-injector.test.mjs` shows the ENTIRE `T2.S1-*` series was rewritten to be
environment-independent:

- A `GLOBAL_BASELINE` is captured once (`readConfig` against a nonexistent project dir).
- `T2.S1-f` now (lines ~1999-2018): captures the existing dedicated-file content, writes `"{}"` to
  `PROJ_FILE_PATH` to **neutralize** it (the exact isolation the PRD asks for), uses `flip` =
  negation of baseline, asserts `untrusted → baseline` and `trusted → flip`, and restores in
  `finally`.

The full suite currently reports **120 passed, 0 failed** — `T2.S1-f` PASSES in an environment
whose global `~/.pi/agent/settings.json` DOES set `fileInjector.markdownBareAtImports:true`.

➡️ **Implication for the plan:** Issue 2 needs NO new implementation. The plan includes a single
VERIFY-and-retain task (confirm the fix is present/correct against PRD §4.6; ensure it survives;
commit it). If a future fresh checkout lacks it, apply the exact pattern from the PRD's Suggested
Fix — but in the current tree it is already done.

### Finding C — The existing harness NEVER exercises a markdown import whose target is unreadable

`grep` confirms the harness has an `E4` case for the **top-level** unreadable file (chmod 000 →
verbatim), which works correctly. But there is NO case for a **markdown import** of an unreadable
file — this is exactly the gap that hid Issue 1. The `E4` case (file-injector.test.mjs ~lines
600-615) is the template for the new regression case.

### Finding D — `resizeImage` is a hard module import, not injectable

`file-injector.ts` line 3: `import { resizeImage, ... } from "@earendil-works/pi-coding-agent"`.
It is resolved at load time via jiti alias; it is NOT passed through `ctx`. The harness therefore
CANNOT easily mock `resizeImage` to throw — so the image-resize-throw variant of Issue 1 cannot be
covered by a normal harness case without jiti interception / monkey-patching. See
`code_changes_analysis.md` §"Image-resize-throw residual".

## Module map (relevant functions)

| Function | Lines | Role |
|---|---|---|
| `isRegularFile(p)` | 117-125 | `fs.stat(p).isFile()`, try/catch→false. Used by `resolveImportPath`. |
| `resolveImportPath(token, baseDir, tryMdExt)` | 138-152 | Exact → `.md` → `.markdown`; returns abs or null. STATS each candidate (existence + isFile). |
| `scanTokens(text, baseDir, opts, state)` | 600-648 | Finds resolved `#@`/`@` imports. **Only records imports that RESOLVE** (exist as regular files). Returns `{index, prefixLen, abs}[]`. |
| `processTokenStream` (top-level) | 648-674 | Scans ONCE, then injects; pushes to `resolved` **only if `injectFile` returns true** → top-level unreadable tokens stay verbatim. |
| `injectFile(abs, state, ctx)` | 676-728 | stat→claim(line 684)→readFile→classify→emit→count++. `catch`(726-727) returns false. **Claims abs BEFORE the read** (the poisoning). |
| `emitText(abs, content, state)` | 738-822 | Inline-vs-paged decision; pushes block(s). |
| `injectMarkdown(abs, content, state, ctx)` | 824-877 | The six-step algorithm. **Step 3.5** (848-856) is the bug site; **Step 4** (862-865) strips; **Step 5** (867) emits BEFORE **Step 6** (870-875) recurses. |
| `injectFiles` | 879-995 | Public entry; builds State, scans top-level, assembles text + images. |

## Data flow through the bug site (injectMarkdown)

```
Step 3   scanTokens → records[]   (only RESOLVED, i.e. existing regular files)
Step 3.5 for r in records: stat+isFile → injectable[]   ← checks EXISTENCE only, NOT readability
Step 4   strip '#@'/'@' from each injectable record (high→low) → `stripped`
Step 5   emitText(abs, stripped, state)                  ← block is PUSHED here (pre-order)
Step 6   for r in injectable: await injectFile(r.abs,...) ← readFile happens HERE; may throw → false
```

The asymmetry vs. the top-level path: at top level, `processTokenStream` strips a marker only when
`injectFile` returns true (inject-then-strip). In the markdown path, the pre-order contract
(block emitted in Step 5, before recursion in Step 6) forces the strip decision (Step 4) to be
made BEFORE delivery is attempted (Step 6). Step 3.5's job is to predict deliverability — but it
checks only `stat`+`isFile`, which a later `readFile` failure falsifies. `stat` succeeding does
NOT imply `readFile` will succeed (EACCES on the file, not its parent dir).

## Why scanTokens does NOT already save us

`resolveImportPath` (and thus `scanTokens`) confirms existence + isFile via `isRegularFile`. So
MISSING files and DIRECTORIES are already filtered out before Step 3.5 — those keep their marker
verbatim and work correctly today. The ONLY class that passes existence but fails delivery is
**exists-but-unreadable** (EACCES / I/O error on the file itself). That is precisely the gap
Step 3.5 must close by additionally confirming READABILITY.
