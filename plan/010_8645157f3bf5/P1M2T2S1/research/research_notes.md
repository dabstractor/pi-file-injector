# Research Notes — P1.M2.T2.S1 (README `#<url>` docs + config + limits + wiring)

## Task
Edit `README.md` ONLY — document the shipped `#<url>` feature. Do NOT rewrite `#@file` sections.
No source/test changes. Docs task (Mode B). Depends on M1 (engine) + M2.T1 (tests) being landed.

## Verified facts from source (`file-injector.ts`) — the implementation we are documenting

### Constants (L81-85)
- `URL_TIMEOUT_MS = 20_000` → **20 s fetch timeout**
- `URL_MAX_BYTES = 1_000_000` → **1 MB response cap (decimal, ~1,000,000 bytes)**
- `URL_MIN_CONTENT = 200` → SPA/empty-extraction floor (defuddle output <200 chars)

### Detection regexes (L26, L36)
- `URL_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu` — a `#` not preceded by a word char, not `#@`.
- `URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i` — must be URL-shaped (scheme:// or bare domain with TLD). ftp:// supported.

### Config `enableUrls` (L210, L1492, L1404)
- `enableUrls?: boolean`, **default true**. Gate is `cfg.enableUrls !== false` (default-ENABLED polarity — architecture Refinement #2).
- When `false`: the URL scan loop body is **skipped entirely → ZERO network egress** (air-gapped opt-out). Tokens left verbatim.
- Read once on `session_start`, cached alongside `markdownBareAtImports`. Same 4 sources/precedence as `markdownBareAtImports` (already documented in README's bare-@ section): global settings.json `fileInjector` → global file-injector.json → project settings.json `fileInjector` (trusted only) → project file-injector.json (trusted only).

### `injectUrl` pipeline (L830-916) — content-type dispatch
1. AbortController 20s timeout; `fetch` with `redirect:"follow"`, browser User-Agent.
2. non-2xx → `return false` (verbatim).
3. `Content-Length > URL_MAX_BYTES` pre-download → `return false` (don't download).
4. `image/*` → byte reader → resize → attach as image (mirror file image path).
5. `text/html` (or sniffed leading `<`) → linkedom parse → defuddle → markdown. If `< URL_MIN_CONTENT` (200) → **SPA fallback**: verbatim + notify `${url}: page appears JS-rendered; left as reference` (type `info`, guarded on `ctx.hasUI`).
6. `text/*`, `json`, `xml`, `rss`, `atom`, `markdown` → raw verbatim (no extraction).
7. else (PDF, octet-stream, …) → `return false` (verbatim).
8. mid-stream overflow (>1MB while reading) → `return false`.
9. over-budget (`cost > state.remaining`) → `return false` (**NO paging** — `read` can't fetch a URL).
10. success → `formatUrlBlock(url, body)` → `<file name="URL">…</file>`; `details.push({path:url, kind:"url", chars})`; subtract cost from shared budget.
11. **NEVER throws** — whole body in try/catch, `return false` on any error → verbatim.

### Display (L1006-1042 `readLine`)
- `kind:"url"` → renders `read <raw-url>` — **NOT tildified, no range/dimension suffix**. Same green (`toolSuccessBg`) box as `read` tool / `#@file`. `ctrl+o` to expand → shows extracted markdown.
- Expanded view re-parses `content` like text files.

## README.md current structure (for exact insertion anchors)
1. H1 `# \`#@file\`` + tagline paragraph.
2. `## Why`
3. `## Install` — `pi install npm:pi-file-injector` / git. (deps bundled → accurate as-is.)
4. `## Usage` — `#@` examples block → "On submit, each file shows up as a compact green read line…" paragraph → "Markdown files can import…" → path completion → bare `@`. (NO existing `###` subsections under Usage.)
5. `## What gets injected` (table — file types).
6. `## Syntax`
7. `### Optional: bare-@ markdown imports` (the config section — 2 forms + 4-source precedence; ends "…See [Limits](#limits).")
8. `## Limits` (flat bullet list)
9. `## #@ versus @`

## package.json (verified)
- `dependencies`: defuddle ^0.19.2, linkedom ^0.18.12, turndown ^7.2.0, mathml-to-latex ^1.8.0, temml ^0.13.3 — **hard deps** (bundled; user installs nothing extra).
- `scripts.test`: 4 files incl. `url-injection.test.mjs`.
- README not referenced by any test → doc edits can't break `npm test`.

## Constraints / gotchas for the doc edit
- Do NOT touch `#@file` sections (Why, Install mechanics, What-gets-injected table, Syntax #@ details, bare-@ config body, file Limits bullets, #@ versus @).
- Preserve "works out of the box, zero setup" value-prop (PRD §9: deps bundled, user installs nothing beyond `pi install`).
- enableUrls config must reference the SAME 4-source precedence as markdownBareAtImports (don't duplicate the list verbatim — reference it to avoid drift).
- "1 MB" = decimal 1,000,000 bytes (URL_MAX_BYTES), not 1,048,576 — keep "1 MB" in prose (accurate enough); avoid claiming "1,048,576".
- URLs never page (explicit asymmetry vs files); over-budget → verbatim.
- No caching: re-open/re-submit/fork re-fetches.
- Only ONE file is edited: `README.md`.

## Parallel-work awareness
- P1.M2.T1.S2 (running in parallel) touches ONLY `url-injection.test.mjs` (Mode A, no README). Zero overlap with this doc task.
- All implementing subtasks (M1.T1, M1.T2, M2.T1.S1) are Complete; M2.T1.S2 is test-only. → The README docs reflect already-landed behavior; nothing this PRP describes is speculative.