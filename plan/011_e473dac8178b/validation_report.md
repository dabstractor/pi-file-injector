# Validation Report — pi-file-injector

**Date:** 2026-08-18 · **Validator scope:** PRD (#@file + #URL injection + line ranges, spec/ §1–§17) vs. implementation at `file-injector.ts` (HEAD `e5448b3`, v0.1.2) · **Pi host:** 0.84.1 (PRD targeted 0.80.7 — all exercised APIs remain compatible)

## Verdict at a glance

The extension is **functionally excellent**. Every user-facing workflow in the README and every acceptance-critical behavior in the PRD that was tested passed — including 13 real end-to-end runs through the actual `pi` CLI with a live model, and a 94-URL live-fetch corpus with zero failures. Three minor issues were found (one stale doc claim, one dead spec-promised feature path, one cosmetic metadata inconsistency). **None are critical or major; none break a user workflow.**

## How it was validated

`./validate.sh` (this repo, executable) runs six phases — all green (28 checks passed, 0 failed):

| Phase | What | Result |
|---|---|---|
| 1. Type checking | `scripts/typecheck.mjs` — tsc `--strict` against pi's shipped `.d.ts` | ✅ 0 errors |
| 2. Unit tests | `npm test` — 4 suites (file-injector 180, import-behavior 23, relative-imports 38, url-injection 38) | ✅ 279 passed, 0 failed |
| 3. Data-level probes | Real extension loaded via pi's jiti loader; 12 probes (paging/LR-1 file-coordinate resume, LR-3/LR-4 warning notifies, prior-`<file>` dedup, URL-in-markdown no-fetch, empty file, ftp verbatim, renderer 3-tier + defensive fallback, config trust gating, egress gating, binary/magic-sniff routing, helper semantics) | ✅ 12/12 |
| 4. E2E (real `pi -ne -e` runs, `--mode json`, live model) | 13 scenarios — see below | ✅ 13/13 |
| 5. URL corpus | `tools/url-corpus.mjs` — 94 live URLs across 12 categories | ✅ 0 failures (77 pass, 17 baseline-record) |
| 6. Packaging | `npm pack --dry-run`, pi manifest, version/tag consistency | ✅ all |

### E2E scenarios (real pi, real model, real network)

- **E1** basic `#@a.ts`: prompt stored **verbatim** (`#@` preserved), custom message `fileInjector.injected` carries the `<file>` block, model answers from the injected content (its reasoning confirmed "file content was provided inline").
- **E2** format parity with Pi's built-in `@file` (PRD acceptance #13): the emitted block is **byte-identical** to `processFileArguments`' expansion.
- **E3** markdown transitive imports: `#@docs/b.md` → `[docs/b.md, a.ts, docs/c.md]` pre-order depth-first, resolved relative to the importing file's dir (a deliberately-wrong `#@docs/c.md` inside `docs/` was correctly *not* resolved — no cwd fallback).
- **E4** line range `#@a.ts:2-3`: only lines 2–3 delivered; detail range `:2-3`.
- **E5** missing file: token left verbatim, no injection, prompt intact.
- **E6** binary (NUL) → note block; text-bytes-named-`fake.png` → routed as **text** (magic-number sniff works both ways).
- **E7** real 8×8 PNG: attached as `image/png` ImageContent to the user message + reference block; model answered "Red".
- **E8** dedup: `#@a.ts` + `#@./a.ts` + `#@<abs>` → exactly one block.
- **E9** collision matrix: bare `@a.ts`, mid-word `foo#@bar`, deny-listed `#main.go` → zero injection.
- **E10** directory-manifest load: `pi -e <dir>` resolves `file-injector.ts` via the `"pi"` manifest.
- **E11** live URL `#nodejs.org`: fetched → defuddle-extracted markdown (>200 chars) injected as `kind:"url"`; model summarized the page.
- **E12** `enableUrls:false` in a **trusted** project `.pi/file-injector.json`: URL gated (no fetch), file still injected; in an *untrusted* dir the project config is correctly ignored (trust gating verified both ways).
- **E13** session persistence: the custom message is written as a `custom_message` entry in the session file (the reload/re-render/re-send contract of §6.2).

### Additional manual checks

- TUI mode boots cleanly with the extension loaded (renderer + autocomplete registration on `session_start`, no crash).
- Prior-`<file>`-block seeding dedups re-injection; URLs inside delivered markdown are never fetched (prompt-only URL scan, per spec).
- Empty file → empty `<file>` block, counted; empty image (F5) and raw-base64 fallback covered by unit tests.
- `example.com` correctly left verbatim via the 200-char SPA floor (its extracted markdown is genuinely 149 chars); HN/nodejs.org extract normally.
- Node `fetch` rejects `ftp://` ("unknown scheme") — see Issue 2.

---

## Issues Found (3 — all minor)

### 1. [Minor · documentation] README claims line ranges never page — stale vs. shipped LR-1 behavior
**Location:** `README.md:128` — "Closed ranges inject whole (no paging past the selection)."
**Evidence:** The shipped LR-1 fix makes an oversize range slice run the same §5.5 budget/paging decision as a whole file: a live probe of a 4 MB `#@huge.log:5-40000` under a tight budget delivered `kind:"paged"` with head + directive resuming at `:83-` (5 + 78 head lines, file coordinates), and regression gate LINE-8 pins exactly this. Plan 011's own phase description states "sync README.md (which currently claims ranges never page)" — and task **P1.M2.T2 "Sync changeset-level documentation" is still `[Planned]`/unstarted**. The README currently *understates* the overflow protection users get for ranges.
**Impact:** User-facing misinformation about safety behavior only; the code is correct per spec §17.5.
**Fix:** One-line README update ("a range that exceeds the remaining context is delivered as head + paging directive, like a whole file") and completing plan task P1.M2.T2.

### 2. [Minor · spec/impl gap] `ftp://` URLs pass the shape gate but can never be fetched
**Location:** `URL_SHAPE_RE` accepts `ftp://`; `injectUrl` passes it to `fetch()`.
**Evidence:** Node's undici `fetch` rejects non-HTTP(S) schemes — verified: `fetch("ftp://example.com/pub/test")` → `FETCH ERROR: fetch failed | cause: unknown scheme`. The extension handles this gracefully (token left verbatim, no crash, no notify — verified live through `injectFiles`), but spec §15's edge-case table promises "`ftp://` scheme | supported by URL_SHAPE_RE; fetch via `fetch` (Node supports it)" — the parenthetical is factually wrong. This is a silently-dead path a user could reasonably expect to work, with zero feedback.
**Impact:** ftp URLs (rare in practice) silently don't work; no crash, no data loss.
**Fix:** Either drop `ftp` from `URL_SHAPE_RE` (recommended — then such tokens are ordinary prose), or document them as unsupported in spec/README.

### 3. [Minor · cosmetic/internal] `FileDetail.lines` off-by-one vs. the wc-l semantics used for ranges
**Location:** `emitWholeText` — `lineCount = newlines + 1`.
**Evidence:** A 4-line file ending with a newline (87-byte `a.ts` fixture) records `lines: 5` in the detail, while `countLines`/`sliceLines` — which drive range validation, clamping, and past-EOF checks — use wc-l semantics (4). Verified in a live run's detail payload (`chars: 87, lines: 5`). The renderer does not currently display `lines`, so nothing user-visible is affected today, but the field is internally inconsistent and would mislead a future consumer.
**Impact:** None today; latent inconsistency only.
**Fix:** Reuse `countLines(content)` in `emitWholeText`.

---

## Observations (non-blocking, not counted as issues)

1. **Environment: a second, divergent copy of this extension is registered as a user package** (`../../projects/pi-file-injector-url-injector` in `~/.pi/agent/settings.json`; its `file-injector.ts` differs from this repo's). The README's own "⚠️ Only one copy at a time" warning says two concurrently-loaded copies double-inject every `#@file` and double image cost. All E2E above used `-ne` to isolate this repo's copy. Worth removing the stale install (`pi remove ../../projects/pi-file-injector-url-injector`) — but that's machine state, not a codebase defect.
2. **plan/011 tasks.json is dirty/stale:** modified-uncommitted; phase P1 shows `[Planned]` while all its implementation subtasks are `[Complete]`; P1.M2.T1 shows `[Ready]` although its LINE-7…12 gates exist and pass. Plan metadata hygiene only (plan/ is read-only for this validation).
3. **`diag.mjs` hardcodes `~/projects/test-repo` (nonexistent)** — a dev-only diagnostic; running it throws ENOENT. Not shipped in the npm package (files allowlist excludes it). No user impact.
4. **SPA-floor wording:** genuinely tiny static pages (e.g. example.com, 149 extracted chars) trip the 200-char floor and get the "page appears JS-rendered; left as reference" notice. Spec §3.4 mandates exactly this behavior and message; noting only that the wording can mislead for small-but-static pages.
5. **URL trailing-punctuation trimming** (via `cleanToken`, §2.2): a URL that legitimately ends with `)` (e.g. some Wikipedia links in prose) loses that character. Spec-conformant and shared with the file trigger; documented tradeoff, listed for completeness.

## PRD/implementation coverage cross-check

- **§4 syntax** (trigger, boundaries incl. Unicode, punctuation trim, tilde/absolute, top-level exact-match): implemented and verified (E2E + unit + D12).
- **§5 file behavior** (text/image/binary/missing, magic-byte sniff F3, empty-image F5, paging §5.5 with actual-head-line directive, shared budget §5.6.2): verified (E1/E2/E6/E7, D1, unit gates PD/LINE).
- **§5.6 markdown imports** (relative-only, file-dir base, `.md`/`.markdown` shorthand, code-exempt incl. CRLF, dedup-bounded recursion, slice-scan LR-6): verified (E3, relative-imports suite).
- **§6 delivery/display** (custom message after user message, verbatim prompt §6.4, renderer tiers, session persistence): verified (E1, E13, D8; TUI boot smoke).
- **§4.6/§15 config** (4-source precedence, trust gating, `markdownBareAtImports` honored at every depth, `enableUrls` default-on/off): verified (E12, D9, D10; user's global config has bare-`@` on and a live run imported via bare `@`).
- **§15 URL injection** (shape gate, deny-list, content-type dispatch, sniff-never-overrides [BUG-002], 20 s/1 MB guards, no paging, SPA fallback, footer spinner via `setStatus`, notify wording [BUG-002 fix]): verified (E11, corpus, unit CB cases). Exception: ftp (Issue 2).
- **§17 line ranges** (LR-1…LR-7 incl. all five formerly-open gaps): all verified closed (D1–D3, LINE-7…12 gates, E4).
- **README claims vs. reality:** accurate except Issue 1 (ranges paging).
- **PRD non-goals respected:** no truncation, no `@` interference (E9), no core patching, single-file package + thin manifest.

## Bottom line

For production use (interactive sessions, `-p` one-shots, URL injection, markdown doc-trees, line ranges, oversize paging, config gating), the extension behaves correctly and robustly across every tested path — with graceful verbatim fallback everywhere something can't be delivered. The three findings are documentation/cosmetic-tier; none block release, though Issue 1's README line should be synced (it misdescribes a safety behavior) and Issue 2's dead `ftp://` path is worth a one-token fix in a follow-up.