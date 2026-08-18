# Validation Report — `pi-file-injector` (`#@file` + `#<url>`)

**Validator:** automated + manual E2E against the real Pi runtime (v0.84.1)
**Date:** 2025-08-12
**Verdict:** ⚠️ **PASS with 3 minor issues** (no critical/major defects; the extension is functionally correct end-to-end)

---

## Executive Summary

The extension (`file-injector.ts`, 1594 lines) implements two triggers — `#@<path>` (whole-file injection) and `#<url>` (URL → defuddle → markdown injection) — per the PRD. Validation combined the project's 241 unit assertions, a strict type-check, a new 23-assertion handler-lifecycle E2E harness, and live runs against the real `pi` binary with a **request-capturing mock provider** to inspect exactly what the model receives.

**Functionally, the extension is correct and production-ready in isolation:**
- `#@file` → verbatim prompt + one custom message carrying the `<file>` block (the §6.2 contract, verified by intercepting the provider request: `system, user(prompt), user(<file>)` — exactly 3 messages, one file block).
- `#@image` → exactly one `ImageContent` attached to the user message + one ref block.
- `#<url>` → page fetched, defuddle-extracted to markdown, one custom message.
- Markdown transitive imports → parent + children delivered, markers preserved verbatim, deduped, cycle-safe.
- Verbatim prompt delivery (cancel/fork/re-open re-trigger safety, §6.4) confirmed.
- Performance pathology fixed: 200 000 backticks process in **4 ms** (the old regex was O(n²), ~8 s).

The three findings are all **minor** (dead code + two documentation gaps). None affect correctness.

---

## Methodology

| Phase | What ran | Result |
|---|---|---|
| 1. Type check | `npm run typecheck` (strict, against pi's shipped `.d.ts`) | ✅ clean, 0 errors |
| 2. Unit tests | `npm test` → `file-injector.test.mjs` (159) + `import-behavior.test.mjs` (23) + `relative-imports.test.mjs` (38) + `url-injection.test.mjs` (21) | ✅ 241/241 pass |
| 3a. Handler-lifecycle E2E | New harness: loads the extension via pi's jiti loader, drives the full `session_start → input → before_agent_start → MessageRenderer` chain with a mock `ExtensionAPI`, asserts 8 real workflows | ✅ 23/23 pass |
| 3b. Real-pi runtime smoke | Spawns `pi -ne -e ./file-injector.ts --mode json -p "…#@file…"` and confirms the custom `<file>` message is emitted after the verbatim user message | ✅ §6.2 contract holds |
| 3c. Provider-request capture | Pointed pi at a mock OpenAI-compatible server and inspected the **actual HTTP request body** to verify message structure (file-block count, image count) | ✅ single-copy delivery correct |

### Workflows exercised (mirroring README usage)
1. `Review #@a.ts` → file delivered; prompt verbatim.
2. `Describe #@pic.png` → image attached.
3. `Summarize #@notes.md` (notes.md imports `#@api.md`) → both files, pre-order, deduped.
4. `Fix #@nope.ts` (missing) → verbatim, no injection, no error.
5. `Look at @a.ts` (bare `@`) → untouched (Pi's `@` preserved).
6. `source: "extension"` → loop-prevention short-circuit.
7. MessageRenderer registered + defensive (no throw on malformed details).
8. `enableUrls: false` config → URL tokens produce no fetch.
9. `#<url>` live → defuddle markdown extracted and delivered to the model.

---

## Issues Found

### Issue 1 — Dead code: `headStartLine` is defined but never called *(minor, code cleanliness)*
**Location:** `file-injector.ts:326`
**Evidence:** `grep -n headStartLine file-injector.ts` → only the definition (L326) and two comment references (L1236, L1254). The actual paged-delivery path computes `startLine = headLines + 1` inline (L1254) using `headCompleteLineCount`; `headStartLine` is never invoked and is not exported or referenced by any test.
**Impact:** None functionally. It is leftover/dead code that computes the same value the inline expression does.
**Suggested fix:** Delete the `headStartLine` function (or call it instead of the inline `headLines + 1` for DRY).

### Issue 2 — Numeric IPs and `localhost` are not recognized as URLs; undocumented in README *(minor, usability/docs)*
**Location:** `URL_SHAPE_RE` (`file-injector.ts:36`) and README "Limits" section.
**Evidence:**
```
URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9]…\.)+[a-z]{2,}…)$/i
```
This requires a dotted host whose **final label is 2+ alpha letters** (to avoid matching `#3.14`, `#v1.2`, `#fff`). Verified:
```
127.0.0.1:8731/   → not-url ✗     localhost:3000/  → not-url ✗
example.com       → URL ✓
```
Consequence: a developer who writes `#localhost:3000/api` or `#127.0.0.1:8080` to inject a **local dev server** (a very common use case) gets a silent no-op — the token is left verbatim, no fetch, no error, no injection. The model just sees the literal text.
**Impact:** This is **by design** per PRD §2.3 (collision avoidance) and the code is spec-compliant. The defect is purely that the README's "Limits" section (which lists timeout, size cap, no-caching, SPA fallback, no-paging) **omits this constraint**. Users will hit it unexpectedly.
**Suggested fix:** Add a "Limits" row such as: "*URLs must use a hostname with a dotted, alphabetic TLD (e.g. `example.com`). Raw IP addresses (`#127.0.0.1`) and `localhost` are not detected as URLs — use `#http://…` explicitly is not enough either, as the host shape still requires an alpha TLD; for local services use a resolvable hostname.*"

### Issue 3 — Concurrent-copy double-injection hazard is not surfaced in the README *(minor, docs/UX)*
**Location:** README "Install" section; extension dedup logic (`injectFiles`, `priorPaths`).
**Evidence:** The extension deduplicates injections **within a single loaded copy** (`state.injectedSet`). It cannot deduplicate against a *second* concurrently-loaded copy (separate module, separate state). During validation, the test environment had an **older, file-only copy** of `pi-file-injector` registered as a global pi package *and* the current copy loaded via `-e`. With both active, every `#@file` was delivered to the model **twice** (4 messages, 2 `<file>` blocks) while `#<url>` was delivered once (the older copy lacks URL support):
```
Two copies loaded, #@file  → provider request: [system, user, user(<file>), user(<file>)]  ← doubled
Single copy (-ne), #@file  → provider request: [system, user, user(<file>)]                ← correct (§6.2)
```
This is an inherent limitation acknowledged in code comments ("single-copy guidance") but **not in the user-facing README**. The README's uninstall instruction (`pi remove npm:pi-file-injector`) also does not cover local-path or git installs, so a user upgrading from the older file-only `pi-file-injector` to this version may silently double-inject files.
**Impact:** No data loss; model behavior usually still correct but context-token usage (and image cost) is doubled while two copies coexist. Latent until the old copy is removed.
**Suggested fix:** Add a short README note warning that only one copy of the extension should be active, and that upgrading users should remove any prior `pi-file-injector` install (npm/git/local) before installing this version.

---

## What was verified working (no defects)

- **§6.2 delivery contract** (intercepted provider request, single copy): `system` → `user`(verbatim prompt, `#@` preserved) → `user`(`<file>` block). Exactly one custom message; one file block.
- **§6.4 verbatim prompt** — `#@`/`#` markers preserved byte-for-byte in the stored user message (cancel/fork/re-open re-trigger safety).
- **Markdown transitive imports** — `notes.md` + `api.md` both delivered, pre-order, deduped, relative-only resolution honored, code-block exemption works.
- **Image injection** — exactly one resized `ImageContent` attached; correct MIME; magic-byte validation (a text file renamed `.png` is treated as text, not a broken image).
- **URL injection** — defuddle extraction to markdown works end-to-end (verified with a controlled local HTTP server + alpha-TLD hostname); content-type dispatch (HTML/json/xml/image); 20 s timeout; 1 MB cap; SPA `<200`-char fallback; `enableUrls:false` network opt-out.
- **Guards** — `source:"extension"` loop prevention; steering skip; never-throws robustness; one-shot `before_agent_start` stash.
- **MessageRenderer** — registered for `fileInjector.injected`; defensive (no throw on malformed/old details); returns a Component.
- **Performance** — `computeCodeRanges` on a 200 000-backtick pathological input completes in 4 ms (the linear-time `inlineCodeRanges` rewrite holds).
- **Config** — four-source precedence (`markdownBareAtImports`, `enableUrls`) read correctly; trusted-project gating; missing/malformed sources default safely.

---

## Appendix: Investigation note (the "doubling" red herring)

Initial E2E runs showed injected file content and images appearing **twice** in the provider request. Extensive instrumentation proved the extension itself fires each handler **exactly once** (`factory=1, input=1, before_agent_start=1`, returns one message / one image) — the duplication originated outside the extension. Root cause: a **second, older copy** of `pi-file-injector` (file-only, no URL support) was registered as a global pi package in this environment and ran alongside the `-e` copy, double-injecting files but not URLs. Running with `-ne` (no global extensions) + a single `-e` confirmed correct single-copy delivery. This is documented as **Issue 3** above (a docs/migration gap), not an extension defect.