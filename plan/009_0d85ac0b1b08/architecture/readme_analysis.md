# README Analysis — pi-file-injector

Source: `/home/dustin/projects/pi-file-injector/README.md` (read-only, 150 lines).
Companion: `tsconfig.json`, `scripts/typecheck.mjs`, `package.json`.

---

## 1. Full text around line 41 — "The `#@` trigger is stripped from each reference"

Exact line (README.md:41), the single long paragraph:

> On submit, each file shows up as a compact green `read <path>` line directly below your message — one line per file, indistinguishable from the `read` tool. Press `ctrl+o` to expand any of them to the full contents. The `#@` trigger is stripped from each reference, so `Review #@a.ts` appears in your message as `Review a.ts`, with the file delivered to the model underneath — never pasted into your message bubble.

**Surrounding context (README.md:33–49):**
- Lines 33–39: fenced `text` block of usage examples (`Review #@a.ts`, `Describe #@pic.png`, `Summarize #@~/notes.md`, `Diff #@a.ts vs #@b.ts`, `See #@a.ts.`).
- Line 41: the strip paragraph (quoted above).
- Line 43: the markdown-import strip paragraph (see §2 below).
- Lines 45–47: fenced example `#@spec.md  # spec.md contains: see #@api.md`.
- Line 49: path completion note. Line 51: bare `@` unchanged note.

Key semantics on line 41:
- After injection the user-visible message text has `#@` removed → `Review #@a.ts` → `Review a.ts`.
- The file content goes "underneath" (delivered to the model as a separate green `read <path>` line), **never pasted into your message bubble**.
- Each reference → exactly one green `read <path>` line, `ctrl+o` expands.

---

## 2. Full text around line 43 — "the import marker is stripped from spec.md"

Exact line (README.md:43):

> Markdown files can import other files. If `spec.md` itself contains `#@api.md`, a single `#@spec.md` delivers both — `spec.md` first, then `api.md` — and the import marker is stripped from `spec.md` the same way a top-level marker is:

Immediately followed by fenced example (README.md:45–47):
```text
#@spec.md          # spec.md contains: see #@api.md
```

Semantics on line 43:
- Markdown-in-markdown imports: `#@api.md` inside a delivered `spec.md` is resolved as an import.
- Delivery order: importing file first (`spec.md`), then the imported file (`api.md`).
- The in-file `#@` import marker is **stripped from the delivered markdown content** — same stripping rule applied to both top-level prompt tokens and in-file imports.

---

## 3. ALL other sections mentioning stripping, markers, or how the prompt appears after injection

Full grep results across README (terms: strip / remove / "never pasted" / "appears in your message" / "renders" / "delivered to the model" / "left as" / verbatim). Every match:

| Line | Section | Text / gist |
|---|---|---|
| 27 | Install | "To uninstall, run `pi remove npm:pi-file-injector`." (unrelated to prompt stripping — uninstall only) |
| **41** | Usage | Top-level marker stripped; `Review #@a.ts` → `Review a.ts`; file "never pasted into your message bubble". *(primary)* |
| **43** | Usage | In-file import marker stripped from delivered `spec.md` "the same way a top-level marker is". *(primary)* |
| 60 | What gets injected (table) | Missing file / dir / permission error → "Left as written. Nothing is injected." (NOT a strip — the literal token is left untouched; no injection happens) |
| **72** | What gets injected | "You won't see it as raw text in the chat — each injected file renders as a green `read <path>` line (just like the `read` tool), with `ctrl+o` to expand. **Your own message shows only what you typed.**" *(primary — describes post-injection appearance)* |
| 88 | Syntax | "A missing `#@report.md.bak` is left as written — it never silently resolves... Markdown formatting glued to a name is different: emphasis like `*@b.md*` or `**@b.md**` is still trimmed, so the file resolves." (trailing-punctuation / markdown-emphasis trimming of the path token, distinct from `#@`-marker stripping) |
| 94 | Syntax (Markdown imports) | Absolute/tilde imports inside markdown "are ignored and left verbatim." (NOT stripped — left in place, no injection) |
| 95 | Syntax (Markdown imports) | "a token already ending in any extension is left as-is" (extension-shorthand rule, not marker stripping) |
| 96 | Syntax (Markdown imports) | "A `#@` inside a fenced or inline code span is not an import — it stays verbatim." (code = escape hatch, marker left intact) |
| 135 | Limits | "No directories. `#@src/` is left as-is." (dir token left untouched, not a strip) |

**Summary of "what appears after injection" guarantees (the 3 primary lines: 41, 43, 72):**
1. Line 41 — the user's own message bubble has `#@` removed from each token; file content is delivered as a separate green `read <path>` line, never pasted into the bubble.
2. Line 43 — the same stripping applies to in-file markdown imports (marker removed from the delivered markdown text).
3. Line 72 — the `<file>…</file>` block format is what the *model* receives; the *user* never sees raw text, only the green `read <path>` line; "Your own message shows only what you typed."

**Distinction to preserve when editing:** "left as written / left verbatim / left as-is" (lines 60, 88, 94, 95, 96, 135) means the token is **untouched because nothing matched** — this is the opposite of stripping and must not be conflated with marker removal.

---

## 4. Overall README structure (headings/sections)

Title + 8 sections. Do not touch these anchors if editing body content:

| Line | Heading | Notes |
|---|---|---|
| 1 | `# `#@file`` | Title |
| 5 | `## Why` | 3 short paragraphs (lines 7, 9, 11) |
| 13 | `## Install` | npm + git install, uninstall note |
| 29 | `## Usage` | **Contains the two strip paragraphs (41, 43)** — highest-relevance section |
| 53 | `## What gets injected` | file-type table (55–60) + `<file>` block format (66–73) + image-bytes section (75) |
| 76 | `## Syntax` | trigger grammar: where it matches (78), trailing punctuation (82–86), extensions exact (88), paths (90), markdown imports 5-rule list (92–98) |
| 100 | `### Optional: bare-`@` markdown imports` | sub-heading under Syntax; `markdownBareAtImports` config (102–129) |
| 131 | `## Limits` | bulleted limitations (133–141) |
| 143 | `## `#@` versus `@`` | final contrast section (145–150) |

No `## Contributing`, `## License`, or `## Changelog` sections exist. LICENSE is a separate repo-root file.

---

## 5. How type checking works

### `tsconfig.json` (repo root) — editor/LSP hints only
- Header comment (lines 1–4) explicitly states: **this file is NOT run directly by tsc.** It documents the intended compiler options. The committed `files: ["file-injector.ts"]` and options (`target ES2022`, `module ESNext`, `moduleResolution Bundler`, `noEmit`, `strict`, `skipLibCheck`, `allowImportingTsExtensions`, `baseUrl .`) mirror what the runtime wrapper generates, but tsc cannot use it directly because the pi `.d.ts` lives outside the repo in the global `node_modules`.

### `scripts/typecheck.mjs` — the real type-check entrypoint
Invoked via `npm run typecheck` (package.json:42). Flow:
1. **Resolve ROOT** (lines 14–18): `cwd` if `file-injector.ts` exists there, else one dir up from the script.
2. **Resolve global pi package** (lines 21–30): `npm root -g` → `@earendil-works/pi-coding-agent`. Fails hard (exit 1) if not found.
3. **Locate pi type defs** (lines 32–38):
   - `PI_TYPES = <piPkg>/dist/index.d.ts`
   - `PIAI_TYPES = <piPkg>/node_modules/@earendil-works/pi-ai/dist/index.d.ts`
   - Fails hard if `PI_TYPES` missing.
4. **Write a temp tsconfig** (lines 40–63) in a mkdtemp dir, with:
   - Same compilerOptions as the committed tsconfig.
   - `paths` mappings:
     - `@earendil-works/pi-coding-agent` → `PI_TYPES`
     - `@earendil-works/pi-ai` → `PIAI_TYPES` if present, else `compat.d.ts` fallback
     - `@earendil-works/pi-tui` → `<piPkg>/node_modules/@earendil-works/pi-tui/dist/index.d.ts` (NESTED dep — comment at lines 56–62 explains tsc Bundler resolution does not walk up for a project-root `files:` entry, hence the explicit mapping)
   - `files: [<ROOT>/file-injector.ts]`
5. **Run tsc** (lines 65–71): `npx --yes -p typescript@5.6 tsc -p <tmpconfig> --listFiles`, `stdio: "inherit"`. On success prints "file-injector.ts type-checks clean under --strict (0 errors)". On TS error, sets `process.exitCode = 1`.
6. **Cleanup** (finally, line 73): removes the temp dir.

CI-ready (exits non-zero on any TS error). Matches `validate.sh`'s Phase 1 so local + CI agree (per the header comment).

### `package.json` scripts (lines 41–44)
- `"typecheck": "node ./scripts/typecheck.mjs"`
- `"test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"` (3 test files chained with `&&` — all must pass)
- `"prepublishOnly": "npm run typecheck"` (gates publish on a clean type-check; notably does NOT run tests pre-publish)

### Constraints / risks for type-check changes
- pi must be installed **globally** (`npm root -g`); a project-level install will not satisfy `typecheck.mjs`.
- TypeScript version is pinned to `5.6` via `npx -p typescript@5.6` — independent of any local TS.
- The committed `tsconfig.json` and the generated temp tsconfig must stay in sync on compilerOptions; drift would make editor hints disagree with CI.
- The `--strict` flag is load-bearing (PRD: "type-checks clean under --strict").

---

## Notes for downstream agents
- If the task is to edit the two strip paragraphs (lines 41, 43) or the appearance description (line 72), keep the three-way distinction: (a) marker stripped from visible prompt, (b) content delivered as a separate `read <path>` line, (c) "left as written" = no match, untouched.
- Section anchors/heading lines (table in §4) are stable targets; preserve them to avoid breaking in-doc links like `[Limits](#limits)`.