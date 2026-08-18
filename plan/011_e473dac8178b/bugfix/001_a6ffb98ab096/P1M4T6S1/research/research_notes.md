# Research Notes — P1.M4.T6.S1 (README.md changeset sweep)

## Task
Sync README.md (the ONLY user doc) with the shipped BUG-001..BUG-005 fixes from changeset
plan/011_e473dac8178b/bugfix/001_a6ffb98ab096. Scope per tasks.json contract: Limits, URLs,
Syntax, Usage sections. Minimal edits — a sweep, not a rewrite. No code changes, no test
changes, no spec/ changes (spec/ is sibling task P1.M4.T6.S2).

## What shipped in the changeset (evidence)

All seven implementing subtasks are Complete (tasks.json). Commits in this changeset:
- `21bf4fa` BUG-001 url offsets, `c626928` BUG-001 binary offsets, `71e9f45` BUG-001 tier-3 path-aware pairing
- `fe766bd` BUG-003 empty-URL-image guard (**also landed the README Images-bullet rider** — the only README touch in this changeset)
- `3c0bb5d` BUG-004 autocomplete pass-through (code only, defensive path)
- BUG-002 fix (P1.M2.T2.S1): committed earlier as part of the markdown guard work; **README rider NEVER landed**
- BUG-005 fix (P1.M3.T5.S1): **uncommitted in the working tree** — file-injector.ts URL_SHAPE_RE now
  `(https?|ftp)`, new shared `URL_SCHEME_RE` used by both the code-extension deny-list guard and
  the https:// normalization (so `ftp://x` stays `ftp://x`), plus spec/15-url-injection.md §7 row
  correction and url-injection.test.mjs additions.

## Per-fix README deltas (the sweep's actual work)

### BUG-005 (EDIT REQUIRED) — ## Limits hostname bullet, README:216
- `grep -i ftp README.md` → ZERO hits today. The bullet's first sentence says a `#<url>` token
  "must be a `http(s)://` URL **or** a bare host…" — now slightly untrue: the gate accepts `ftp://` too.
- Shipped behavior (from worktree diff + corrected spec/15 §7 row at spec/15-url-injection.md:325):
  `#ftp://…` passes URL_SHAPE_RE → bypasses the code-extension deny-list (scheme-bearing) →
  stays `ftp://…` (no https:// mangling) → a fetch IS genuinely attempted (footer spinner may
  flash) → Node's fetch (undici) has no ftp support → throws `TypeError: fetch failed` → §3.5
  catch-all → token falls back verbatim. No block, no injection.
- **Contract wording nuance**: the tasks.json contract suggests "explicit schemes other than
  http(s):// … are not fetched" — that predates the Option A decision (architecture scout
  recommended doc-only Option B; T5.S1 implemented code Option A). A fetch IS attempted now.
  Word the README to match the shipped behavior and the already-corrected spec §7 row, not the
  stale contract sentence. Preserve the contrast with the IP/localhost sentence in the same
  bullet ("left verbatim with no fetch and no error") — ftp differs: fetch attempted, fails.

### BUG-002 (EDIT REQUIRED) — ## Syntax `**Line range.**` paragraph, README:129-134
- Current paragraph covers :10, :10-15, paging of closed ranges, images/binaries ignoring :N,
  multiple ranges, and dedup — but says NOTHING about malformed ranges (`:0`, `:5-3`).
- Shipped behavior (LR-3, now uniform top-level AND inside delivered markdown after P1.M2.T2.S1):
  malformed range → token left exactly as typed (nothing injected for it) + hasUI-guarded
  warning notify; never silently vanishes. The BUG-002 subtask's Mode A rider said this README
  update "rides WITH this subtask" — it never landed (last sentence of paragraph is
  "The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`)."). The sweep adds it.

### BUG-001 (CONFIRM-ONLY) — expanded-view wording at README:50, :62, :119
- Paragraphs describe the green `read <path>` line and ctrl+o expansion generically; no wording
  ever described or implied the old misalignment (URL/binary bodies after a paged file).
  Post-fix the generic wording is simply true. No edit expected.

### BUG-003 (CONFIRM-ONLY) — Images bullet README:83-85
- Rider landed in commit fe766bd: "An image URL whose body comes back empty (0 bytes) attaches
  nothing — it delivers the same "empty image file — 0 bytes" note a 0-byte local image does."
  Confirm it reads coherently in context; no edit expected.

### BUG-004 (CONFIRM-ONLY) — Path completion sentence README:96
- "Path completion works in the editor. Type `#@` and the same file list Pi shows for `@`
  appears; Tab completes it as `#@<path>`." Still accurate — BUG-004 was a defensive-path fix
  (non-@ suggestion values under an @ prefix pass through untouched). No user-visible change; no edit.

## Line-number drift warning
tasks.json/architecture line anchors (:44-46, :61, :94, :209-214, :211) reflect an older README
snapshot. Current (verified by grep -n): expanded-view :50, URLs green-line para :62, Images
bullet :83-85, Path completion :96, Line range para :129-134, Limits URL bullets :211-216,
hostname bullet :216. Locate edits by TEXT ANCHOR, not line number.

## Validation (verified working in this repo)
- `npm test` → node ./file-injector.test.mjs && ./import-behavior.test.mjs && ./relative-imports.test.mjs && ./url-injection.test.mjs
- `npm run typecheck` → node ./scripts/typecheck.mjs
- Docs assertions: `grep -n -i ftp README.md` (expect the new Limits sentence), malformed-range
  sentence grep, `git diff --stat` shows README.md only.
- No test reads README.md (docs-only change; tests must stay green unchanged).

## References
- spec/15-url-injection.md:322-326 (§7 edge table, corrected ftp row) — wording source of truth
- file-injector.ts URL_SHAPE_RE / URL_SCHEME_RE JSDoc + URL scan loop (~:1715-1730 in worktree)
- architecture docs: renderer_bug001.md, injection_bug002_003.md, spec_ux_bug004_005.md, system_context.md