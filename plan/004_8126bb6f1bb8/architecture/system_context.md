# System Context — plan/004 (Markdown Import Extension Shorthand)

## What this is

A **delta feature** on the already-shipped `#@file` Pi extension. It is NOT a new project.

- **Project:** `pi-file-injector` — a single-file Pi TypeScript extension (`file-injector.ts`) that lets a
  user inject a whole file into their prompt via the `#@<path>` syntax.
- **Delta scope (this plan):** Add **markdown import extension shorthand**. A `#@<path>` directive *inside*
  an injected markdown file may omit its `.md`/`.markdown` extension — `#@PRD` resolves to `PRD.md` (then
  `PRD.markdown`) when no bare `PRD` file exists. This is **markdown-import-only**; top-level user-prompt
  tokens stay **exact-match**.
- **Delta-from:** plan/003 (Markdown Transitive Imports) — **Complete**. The full markdown-import engine
  (§5.6) is already shipped and green.

## Baseline state (verified before decomposition)

| Check | Result |
|---|---|
| `node ./file-injector.test.mjs` | **77 passed, 0 failed** (green baseline) |
| `npm run typecheck` | **0 errors** under `--strict` against the real Pi `.d.ts` |
| `file-injector.ts` size | 831 lines |
| `file-injector.test.mjs` size | 1501 lines |
| Git branch | `main` (3 local commits ahead of origin) |

## Architecture in one paragraph

The extension hooks Pi's `input` event (fires for every prompt — interactive TUI, `-p` one-shot, RPC).
The handler (`injectFiles`) scans `event.text` for `#@<path>` tokens via `scanTokens`, resolves each to an
absolute path, reads it, and appends Pi-native `<file name="abs">…</file>` blocks below a `---` rule.
`processTokenStream` orchestrates top-level tokens (scan-once → inject each depth-first). `injectFile`
classifies by type (image / markdown / binary / text). `injectMarkdown` runs the six-step recursive import
algorithm: claim self → scan for `#@` imports → strip resolved markers → emit this block → recurse into
imports. A single shared `State` object (`blocks`, `images`, `injectedSet`, `remaining`, `count`, `paged`)
threads through the entire prompt so dedup, budget accounting, and ordering span top-level tokens AND all
transitive imports.

## The shared State (unchanged by this delta)

```ts
interface State {
  blocks: string[];         // <file>…</file> strings, pre-order depth-first
  images: ImageContent[];   // seeded from event.images, appended for images
  injectedSet: Set<string>; // resolved absolute paths CLAIMED so far → dedup (self/cross-file/cycle)
  remaining: number | null; // single context-budget accumulator (null = unknown → inject whole)
  count: number;            // files delivered (whole + paged + image + binary note)
  paged: number;            // subset delivered via the §5.5 page path
}
```

## Dedup model (the key invariant this delta leans on)

Dedup keys on the **resolved absolute path**. This is already true; the delta only changes *which* abs a
markdown-import token resolves to (a shorthand `#@PRD` now resolves to `/…/PRD.md`). Because dedup runs on
the resolved abs, `#@PRD` and `#@PRD.md` in the same file **collapse to one injection** — this is the free
correctness win the shorthand gets from the existing dedup, and it is exactly why `scanTokens` must become
async: it can no longer resolve a token to an abs without statting candidate paths first (exact → `.md` →
`.markdown`), so it cannot know the dedup key until it stats.

## What does NOT change

- File-type handling (image / binary / text / markdown classify).
- Paging / budget / total-size accounting (§5.5, §5.6.2).
- Code-region detection (§5.6.1).
- The `input` event handler signature and return contract.
- Pi APIs used (`resizeImage`, `formatDimensionNote`, `ImageContent`).
- Top-level user-prompt resolution (stays exact-match — `tryMdExt: false`).
- README structure (one bullet added to the Markdown-imports subsection).
- package.json / tsconfig.json / scripts/.
