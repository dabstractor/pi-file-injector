# External Dependencies & Module Surface

## Module Exports (file-injector.ts)

The extension exports these functions (validated by the test sanity checks at lines 117-134):

| Export | Purpose | Relevant to Bug Fix |
|--------|---------|---------------------|
| `default` | Extension factory: `default(pi)` registers handlers | Entry point for tests |
| `injectFiles(text, images, ctx)` | Core injection: resolves `#@` tokens, reads files, returns `{ text, blocks, details, injected }` | Test helper for unit-level tests |
| `computeDetailOffsets(blocks, details)` | **THE BUGGY FUNCTION** — computes `contentStart`/`contentLen` per detail | **Primary fix target** |
| `renderInjectedMessage(message, opts, theme)` | Chat renderer — reads offsets to slice `message.content` | Secondary (consumer of offsets) |
| `computeCodeRanges(lines, fenceChar, fenceLen)` | Code-region detection (§5.6.1) | Issue 2 (minor, no fix) |
| `formatTextFileBlock(name, content)` | Builds `<file name="ABS">\n...\n</file>` blocks | Understanding block format |
| Other helpers | `cleanToken`, `scanTokens`, `injectFile`, `emitText`, etc. | Not directly relevant |

## Block Format (for offset math)

Text files are emitted as:
```
<file name="/abs/path">\n<content>\n</file>
```

- `headerLen` = `'<file name="/abs/path">\n'.length` (the opener + newline)
- `closerLen` = `'\n</file>'.length` (8 chars)
- `bodyLen` = `block.length - headerLen - closerLen`

The body sits between the `\n` after `>` and the `\n` before `</file>`.

## Content Assembly

Multiple blocks are joined with `"\n\n"` (two real newlines):
```ts
content: blocks.join("\n\n")
```

So for blocks `[B0, B1, B2]`:
- `starts[0]` = 0
- `starts[1]` = `B0.length + 2`
- `starts[2]` = `B0.length + 2 + B1.length + 2`

With the buggy SEP (`"\\n\\n"`, length 4):
- `starts[1]` = `B0.length + 4` (too large by 2)
- `starts[2]` = `B0.length + 4 + B1.length + 4` (too large by 4)

## Peer Dependencies (Pi Ecosystem)

The extension imports from three Pi packages (peer dependencies, resolved via jiti alias map):

1. `@earendil-works/pi-coding-agent` — the Pi agent core (provides the `pi` extension API)
2. `@earendil-works/pi-ai` — AI model abstractions
3. `@earendil-works/pi-tui` — TUI components (`Box`, `Text`, `Component` types)

**No new external dependencies are introduced by this bug fix.**

## Test Infrastructure Dependencies

- **jiti** — TypeScript loader (nested in the global Pi package; not a direct dep)
- Node.js built-ins only: `child_process`, `fs`, `path`, `os`, `url`

## No External Documentation Needed

This bug fix does not introduce any new technology, library, or pattern that would require
external documentation research. The fix is a single-character string literal correction
plus a regression test using existing patterns.