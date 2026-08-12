# Validation Report — pi-file-injector / url-injector

**Validator scope:** deep codebase analysis + an independent end-to-end probe (the real
extension loaded through Pi's own `jiti` loader) against the PRD's stated findings.

**Headline:** Both issues described in the PRD (**BUG-001 Major** and **BUG-002 Minor**)
are **already fixed** in the current `file-injector.ts`, are covered by regression tests,
and **do not reproduce** under an independent hermetic probe that uses the PRD's exact
reproduction steps. The full automated gate (`npm run typecheck` + the four `.mjs` suites,
257 assertions) is green, and an additional **45/45** independent probe passed.

Two **minor** issues were found independently during this validation (neither is a
functional regression; both are documentation / cosmetic).

---

## How validation was performed

| Phase | Command | Result |
|---|---|---|
| 1. Type checking | `npm run typecheck` (tsc --strict against pi's shipped `.d.ts`) | **PASS** — 0 errors |
| 2. Acceptance suites | `npm test` → `file-injector` (163) + `import-behavior` (23) + `relative-imports` (38) + `url-injection` (33) | **PASS** — 257 / 257 |
| 3. Independent E2E probe | `validate.sh` Phase 3 (real extension via jiti, fetch stubbed) | **PASS** — 45 / 45 |

Phase 3 does **not** reuse the project's own assertions: it loads the committed
`file-injector.ts` fresh, stubs `globalThis.fetch` to record calls, and exercises the
PRD's exact repro inputs (`#main.go`, `#notes.md`, …; `refactor #main.go now`; URL-only
notify) plus positive controls (real domain fetches, explicit-scheme bypass, the
`enableUrls:false` air-gap).

---

## PRD findings — re-checked (both NOT PRESENT)

### BUG-001 (Major) — "URL detector fires for `#filename.ext`" — **DOES NOT REPRODUCE**
The PRD claims `URL_SHAPE_RE` (file-injector.ts:43) matches every code-file extension as
an alpha-TLD, so `#main.go` / `#notes.md` / `#config.json` etc. trigger a live fetch on
by default, and that `main.go` resolves to the real Go homepage and gets injected.

**Actual current code:** a `[BUG-001]` code-extension deny-list (`CODE_EXTENSIONS`,
file-injector.ts:56-69) is consulted in the URL scan loop (file-injector.ts:1438-1450):
a scheme-less, **path-less** bare `word.ext` token whose final label is a known code/file
extension is skipped `continue` **before** any fetch, normalization, or injection. The
README documents this behavior. The 10 exact PRD repro tokens were each verified to make
**zero** fetch calls and inject nothing, and the second harm (`refactor #main.go now`
delivering the Go homepage) was verified to inject nothing even when `main.go` is stubbed
to return a rich 200 `text/html` body. Regression coverage: `url-injection.test.mjs`
BUG1-1 … BUG1-12 (including BUG1-11, the content-injection harm guard, and BUG1-12, the
explicit-scheme bypass). Independently re-verified here.

### BUG-002 (Minor) — "notify says `#@ injected` for URL-only prompts" — **DOES NOT REPRODUCE**
The PRD claims the input-handler notify (then file-injector.ts:1494) is hardcoded to
``#@ injected ${whole} whole`` so a `#example.com`-only prompt shows the wrong trigger.

**Actual current code:** the notify is now trigger-aware with three branches
(file-injector.ts:1543-1561): files-only → `#@ injected N whole[, M paged]`; URLs-only →
`injected N URL[s]`; mixed → both axes. A URL-only prompt was driven through the **real**
factory (`input` handler with a `ui.notify` spy) and produced `injected 1 URL` (no `#@`).
Regression coverage: `file-injector.test.mjs` BUG2-1 … BUG2-4. Independently re-verified
here.

---

## Issues found independently

### Issue 1 (Minor) — URL-injection spec table is stale; contradicts the code and the README
**Severity:** Minor (documentation drift; no functional impact)
**Location:** `spec/15-url-injection.md` lines ~96-99 (the §2.3-equivalent collision
table) and line ~263 (the §3.5 edge-case table).

The spec still describes the **superseded pre-fix** behavior for code-extension tokens:

> `| #node.js | ⚠️ URL shape → no-op | alpha TLD js matches shape; node.js won't resolve → left verbatim (§3.5) |`
> "The last row is the only residual false-positive class (`#word.letters`), and the no-op fallback makes it benign…"

and:

> `| #node.js | URL-shaped → resolves false → verbatim (no-op). |`

This contradicts both the **code** (the `CODE_EXTENSIONS` deny-list denies `#node.js` —
and `#main.go`, `#notes.md`, … — *before* fetch, treating them as local-file references,
not as "URL-shaped no-ops") and the **README** (which documents the deny-list and the
`#https://…` escape hatch). It is also the exact stale claim the PRD's own BUG-001
description quotes as still-true. A maintainer reading the spec would be misled about the
mechanism and the false-positive scope. Suggested fix: update the two rows to state the
deny-list behavior and remove the "only residual / benign" sentence (or note that the
README is authoritative). This is doc-only; the shipped behavior is correct.

### Issue 2 (Minor) — Image-URL-only prompt still shows `#@ injected 1 whole`
**Severity:** Minor (cosmetic; same inconsistency class as the now-fixed BUG-002)
**Location:** `file-injector.ts` ~1547 (the notify `urlCount`/`fileCount` derivation) and
~1583 (the notify text).

The trigger-aware notify counts only text/html/json/xml URLs (`kind === "url"`) as URLs;
image URLs are `kind: "image"` and are counted as **files** (the code comment explicitly
marks this "out of scope"). Consequently a prompt that injects **only** an image URL —
e.g. `see #https://example.com/cat.png` returning `image/png` — produces the toast
`#@ injected 1 whole` (verified by driving the real input handler), which references the
`#@` glyph for a prompt that used the `#` URL trigger. This is the same glyph/trigger
mismatch BUG-002 eliminated for text URLs, scoped to image URLs. It is a documented
design choice (image URLs are delivered like `#@image` files, so "whole" is otherwise
apt), so the priority is low — but it is a real, observable user-facing inconsistency.

---

## Notes / observations (not counted as issues)

- **Test counts vs. PRD:** the PRD states "159 + 23 + 38 + 21"; the repo today yields
  163 + 23 + 38 + 33 (257 total). The deltas are exactly the BUG-001 (BUG1-*) and
  BUG-002 (BUG2-*) regression cases added when the fixes landed — consistent with the
  bugs already being resolved.
- The four-source config precedence (global→project, trusted-project gating for project
  sources, missing/malformed → `{}` never-throws) and the `enableUrls !== false`
  default-on semantics were inspected and behave as documented.
- `injectUrl` never throws (non-2xx / DNS / TLS / timeout / cap / over-budget / SPA /
  unhandled-type all → verbatim) and the `read`-tool-style green renderer path is
  exercised by the suite; no defect observed.

---

## Recommendations

1. Update `spec/15-url-injection.md` so the collision and edge-case tables match the
   deny-list behavior in the code/README (Issue 1).
2. (Optional, low priority) Make the notify image-aware so an image-URL-only prompt does
   not report `#@ injected` (Issue 2), or document the image-URL case explicitly.

## Summary
- Total issues found: **2** (both Minor)
- Critical: 0 · Major: 0 · Minor: 2
- PRD-described BUG-001 and BUG-002: **already fixed and covered by regression tests**;
  independently confirmed not reproducible.