# Source Analysis — `file-injector.ts` (BUG-001 / BUG-002 targets)

This report is a line-accurate map of the code regions the two reported bugs touch. It is the
ground-truth reference for the downstream PRP/implementation agents. All line numbers are against the
**current** `file-injector.ts` (1585 lines, `git` clean except plan/ docs).

---

## 1. The `URL_SHAPE_RE` regex constant — `file-injector.ts:36`

**Location:** module-level, immediately after `URL_INJECT_RE` (L25) and before `MIME_BY_EXT` (L37).

**Full definition (L36):**
```ts
const URL_SHAPE_RE = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

**Flags:** `i` only (case-insensitive). NO `u` flag — intentionally, because the regex contains no
`\p{}` classes and no lookbehind (documented in the JSDoc and in `plan/…/P1M1T1S3/PRP.md:103`).

**Two alternatives inside the outer `^( … )$` group:**

- **Alternative A — explicit scheme:**
  `(https?|ftp):\/\/\S+`
  Matches `https://`, `http://`, or `ftp://` followed by any non-space run. Anchored, so the WHOLE
  token must be the URL (e.g. `#https://x.com/y` → cleanToken yields `https://x.com/y` → matches A).

- **Alternative B — scheme-less dotted host (THE BUG):**
  ```
  (?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+    ←  one-or-more labels, each ending in a "."
  [a-z]{2,}                                  ←  FINAL label: 2+ alpha letters (the "alpha TLD" gate)
  (?::\d+)?                                  ←  optional :port
  (?:\/\S*)?                                 ←  optional /path
  ```
  The `+`-quantified group `(?:…\.)+` requires **at least one** dotted label, then a final label of
  **2+ alpha-only letters**.

**Why BUG-001 happens:** the "alpha TLD" gate `[a-z]{2,}` accepts **every programming-language file
extension** as if it were a real TLD, because those extensions are 2+ letter alphabetic strings:
`md`, `go`, `py`, `rs`, `cs`, `ts`, `java`, `tsx`, `png`, `json`, `yaml`, `csv`, `js`, `rb`, `sh`, …
So a bare `main.go` matches Alternative B (`main` + `.` + `go`), `notes.md` matches (`notes` + `.md`),
`config.json` matches, etc. The token is then normalized to `https://main.go` and FETCHED.

**Patterns that correctly FAIL the gate (per JSDoc, L30–35):**
`#Heading` (no dot), `#1234` (no alpha TLD), `#fff` (no dot), `#3.14` (final label `14` is numeric →
fails `[a-z]{2,}`), `#v1.2` (final label `2` numeric → fails), `C#` / `objective-C#` (mid-word `#`,
never a candidate under `URL_INJECT_RE`).

**Residual benign false-positive the code EXPECTS:** `#node.js` — matches the shape (alpha TLD `js`)
but "won't resolve" → 404 → verbatim. **This is the assumption BUG-001 breaks:** real domains like
`main.go`, `notes.md` (etc.) DO resolve, so they are fetched AND their content is injected.

**JSDoc (L27–35)** explicitly claims `#node.js` is "the only residual false-positive class" and that it
is "benign" because it "won't resolve." This claim is false for every real resolvable `<name>.<ext>`
domain.

---

## 2. The URL scan loop in `injectFiles` — `file-injector.ts:1385–1406`

**Signature (L1320):**
```ts
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false,        // §4.6
  enableUrls = true,     // [P1.M1.T2.S3] §4 — default true so direct unit tests get the branch
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }>
```

**The loop (L1385–1406), verbatim:**
```ts
  // [P1.M1.T2.S3] §8 URL branch — scan #<url> tokens and inject via injectUrl (T2.S1). …
  // enableUrls===false → loop body skipped entirely → ZERO network egress (§4 air-gapped opt-out).
  if (enableUrls) {
    for (const m of text.matchAll(URL_INJECT_RE)) {
      const tok = cleanToken(m[2]);
      if (tok && URL_SHAPE_RE.test(tok)) {
        const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
        if (!state.injectedSet.has(abs)) {
          state.injectedSet.add(abs);
          await injectUrl(abs, state, ctx);
        }
      }
    }
  }
```

**Pipeline (per surviving candidate):**
1. `text.matchAll(URL_INJECT_RE)` — `URL_INJECT_RE` (L25) is `/(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu`;
   group 2 = the raw token (everything after `#`, until whitespace), with `(?!@)` so `#@file` is NEVER
   captured here.
2. `cleanToken(m[2])` (L121) — strips trailing punctuation in `TRAILING_PUNCT` (L42 =
   `.,;:!?\")]}>'`) repeatedly.
3. `URL_SHAPE_RE.test(tok)` — **the shape gate; the locus of BUG-001.**
4. Normalize to absolute: if it already starts with `https?://` keep it, else prepend `https://`.
5. Dedup against `state.injectedSet` (a `Set<string>` seeded with prior `<file name=…>` blocks and
   grown by each successful delivery — `#example.com` and `#https://example.com` collapse to one key).
6. `await injectUrl(abs, state, ctx)` — never throws (full try/catch); returns `true` iff a block/image
   was emitted, else the token is left verbatim.

**Why `#main.go` reaches `fetch`:** the loop runs whenever `enableUrls` is truthy (default true). For
`#main.go`, `cleanToken` → `main.go`, `URL_SHAPE_RE.test("main.go")` → **true** (Alternative B), abs →
`https://main.go`, `injectUrl` issues `fetch("https://main.go", {…})`. If the page resolves and the
extracted markdown is ≥ `URL_MIN_CONTENT` (200) chars, the content is pushed into `state.blocks` and
`state.count` is bumped → **delivered to the model.**

---

## 3. The `enableUrls` config resolution — `file-injector.ts:1322` and `file-injector.ts:1483`

**`enableUrls` parameter default (L1322):** `enableUrls = true` in the `injectFiles` signature. The
JSDoc notes the default-true so direct unit tests get the URL branch.

**Call site — the `input` handler (L1483), verbatim:**
```ts
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true, cfg.enableUrls !== false); // … enableUrls default-enabled (Refinement #2: !== false, NOT === true); false gates ALL network egress
```

**Default-enabled polarity:** the handler passes `cfg.enableUrls !== false` (NOT `=== true`). Because
`readConfig` returns `{}` when sources are missing → `cfg.enableUrls` is `undefined` →
`undefined !== false` is **true** → **URL injection is ON by default with zero configuration.**
(Refinement #2 in `plan/…/architecture/system_context.md`.)

**`FileInjectorConfig` interface (L207):**
```ts
interface FileInjectorConfig {
  markdownBareAtImports?: boolean;
  /** Default true; when false, URL tokens (#<url>) are ignored entirely and NO network request is made … */
  enableUrls?: boolean;
}
```

**Config fields consumed for URL behavior:** ONLY `cfg.enableUrls` (the boolean). There is currently NO
field controlling the scheme-less detection threshold, no allow/deny list, no opt-in for bare-host
detection.

---

## 4. The config loading — `readConfig` (`file-injector.ts:230–283`)

```ts
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
```

**4 sources, shallow-merged in precedence order (each later source overrides earlier; project overrides
global; within a scope the dedicated file overrides the settings key):**
1. GLOBAL `~/.pi/agent/settings.json` → `SETTINGS_KEY` (`"fileInjector"`) sub-object — via `tryReadNamespaced`
2. GLOBAL `~/.pi/agent/file-injector.json` (whole file) — via `tryReadCfg`
3. PROJECT `<cwd>/.pi/settings.json` → `SETTINGS_KEY` sub-object — **TRUSTED ONLY**
4. PROJECT `<cwd>/.pi/file-injector.json` (whole file) — **TRUSTED ONLY**

Both helpers (`tryReadCfg` L234, `tryReadNamespaced` L246) return `{}` on missing/malformed/non-object.
The project sources (3+4) are read only when `ctx.isProjectTrusted()` returns true. `CONFIG_DIR_NAME`
comes from `@earendil-works/pi-coding-agent` (the `.pi` dir); `getAgentDir()` resolves the global agent
dir. **`readConfig` NEVER throws** (every read/parse is try/caught).

**The module-level cache (L1467, L1471):**
```ts
let cfg: FileInjectorConfig = {};   // L1467 — module-level, NOT a closure
…
  pi.on("session_start", async (_e, ctx) => {
    cfg = await readConfig(ctx);    // L1471 — loaded ONCE per session
    …
  });
```
`cfg` is module-level so it persists across the test harness's per-capture factory re-invocations and is
read by the `input` handler. A new config field for the fix would be read here with no other change.

---

## 5. The input-handler notify text — BUG-002 (`file-injector.ts:1480–1494`)

The full `input` handler tail (L1478–1494):
```ts
    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true, cfg.enableUrls !== false); // L1483
    if (!injected) return { action: "continue" }; // L1485 — nothing injected → preserve prompt byte-for-byte

    // §6.2 hand the built blocks+details to before_agent_start …
    pending = { blocks, details }; // L1488

    // §5.5 Notify — …
    const whole = injected - paged;                                                    // L1493
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;    // L1494
    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // L1495
    return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM
```

**BUG-002:** the notify string is HARDCODED `#@ injected ${whole} whole…`. The variable `injected`
(`state.count`) is the UNION of `#@file` deliveries AND `#<url>` deliveries — there is no separate
counter for URL injections. So a URL-only prompt like `Summarize #example.com` sets `injected === 1`,
`paged === 0`, `whole === 1`, and emits the toast `#@ injected 1 whole` even though NO `#@file` token
was present. The `whole`/`paged` axis is also meaningless for URLs (URLs can never be paged — §3.3,
`injectUrl` returns false on over-budget with NO paging). Note: `injectFiles`'s RETURN shape exposes
`injected` and `paged` only — there is no `urls` or `files` breakdown, so the handler cannot currently
distinguish the two without an API change or an additional return field.

---

## 6. `URL_SHAPE_RE` — all usages (grep, source only)

| File | Line | Usage |
|------|------|-------|
| `file-injector.ts` | 35 | JSDoc reference (`URL_SHAPE_RE.test(cleanToken(m[2]))`) |
| `file-injector.ts` | 36 | **Definition** (`const URL_SHAPE_RE = …`) |
| `file-injector.ts` | 1391 | comment in the URL loop JSDoc |
| `file-injector.ts` | 1398 | **the ONLY runtime use**: `if (tok && URL_SHAPE_RE.test(tok)) {` |

**There is exactly ONE runtime call site (L1398).** Tightening `URL_SHAPE_RE` (or adding a guard around
the call site) is a single-point change with no other consumers. The constant is NOT exported (private,
module-level).

---

## 7. `enableUrls` — all source usages (grep)

| File | Line | Usage |
|------|------|-------|
| `file-injector.ts` | 210 | `enableUrls?: boolean;` in `FileInjectorConfig` |
| `file-injector.ts` | 1322 | `enableUrls = true` param default in `injectFiles` |
| `file-injector.ts` | 1394 | comment |
| `file-injector.ts` | 1395 | `if (enableUrls) {` — the gate around the URL loop |
| `file-injector.ts` | 1483 | call site `cfg.enableUrls !== false` (5th arg to `injectFiles`) |

`enableUrls` gates the WHOLE loop body — when `false`, ZERO network egress (the `url-injection.test.mjs`
FAIL-8 case asserts `calls.length === 0`). Any fix that keeps the gate semantics intact preserves that.

---

## 8. `injectUrl` — the fetch + dispatch pipeline (`file-injector.ts:821–905`)

```ts
async function injectUrl(url: string, state: State, ctx: Ctx): Promise<boolean>
```
PRIVATE (not exported). Called only from the URL loop (L1402). The function:
1. Creates an `AbortController` + `setTimeout(URL_TIMEOUT_MS)` (L822–823) — **20 s timeout (L81).**
2. `await fetch(url, { signal, redirect: "follow", headers: { "User-Agent": BROWSER_UA } })` (L826).
   - `!res.ok` → return false (verbatim). (L830)
3. Content-Length > `URL_MAX_BYTES` (`1_000_000`, L83) → return false (L832).
4. Dispatch on content-type:
   - `image/*` → byte read (`readBytesCapped`), `resizeImage`, attach `ImageContent`, push image block,
     `subtract(cost)`, `state.count++`, return true. (L836–857)
   - `text/html` OR body starts with `<` → **defuddle extraction** pipeline (Refinements A/B/C at
     L860–872): `parseHTML(html)` (one arg), polyfill `styleSheets`/`getComputedStyle`, set `doc.URL`,
     `await Defuddle(doc, url, { markdown: true })`, trim `r.content`. If `md.length < URL_MIN_CONTENT`
     (`200`, L85) → **SPA fallback**: notify + return false (verbatim). (L875–878) Else `body =
     (title ? "# title\n\n" : "") + md`.
   - `text/` | json | xml | markdown → raw body (verbatim, no extraction). (L883)
   - else → return false (verbatim). (L885)
5. Over-budget: `state.remaining !== null && cost > state.remaining` → return false (NO paging). (L888)
6. Push `formatUrlBlock(url, body)` to `state.blocks`, push a `FileDetail` `{path:url, kind:"url",
   chars}`, `subtract(cost)`, `state.count++`, return true. (L891–899)
7. Whole body in `try/catch` → return false; `finally` clears the timeout. **NEVER throws.**

**This is the path that delivers `main.go`'s HTML to the model:** when the fetched HTML yields ≥200
chars of defuddle markdown, `state.count++` makes `injectFiles` return `injected >= 1`, and the block
`<file name="https://main.go">…Go homepage…</file>` rides in the `before_agent_start` custom message.

---

## 9. Supporting types — `State` (L488) and `Ctx` (L1028)

**`State` (L488–497):**
```ts
interface State {
  blocks: string[];
  details: FileDetail[];
  images: ImageContent[];
  injectedSet: Set<string>;
  remaining: number | null;
  count: number;
  paged: number;
  bareAt: boolean;
}
```
`count` is the SINGLE counter for ALL successful deliveries (files + URLs). `paged` is the subset of
files delivered head+directive (URLs never increment `paged`). A URL/`#@file` breakdown would require a
new field here (and in the `injectFiles` return) for BUG-002's notify-aware wording.

**`Ctx` (L1028–1039):**
```ts
type Ctx = {
  cwd: string;
  getContextUsage?: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
  hasUI?: boolean;
  ui?: { notify(message: string, type?: "info" | "warning" | "error"): void };
};
```
`ctx.hasUI` + `ctx.ui.notify` are how the SPA fallback (L877) and the input-handler toast (L1495) emit
notices. The notify type union is pinned (`info|warning|error`) so the local `Ctx` stays assignable to
the real `ExtensionContext` under `--strict`.

---

## 10. Helper functions the fix touches

- **`cleanToken(raw)` (L121):** strips trailing `TRAILING_PUNCT` (L42) repeatedly. Applied to the raw
  `URL_INJECT_RE` group-2 token BEFORE `URL_SHAPE_RE.test`. So `#main.go,` → `main.go`, and
  `#main.go.` → `main.go` (trailing `.` stripped) → still matches the gate.
- **`URL_INJECT_RE` (L25):** `/(^|(?<![\p{L}\p{N}_]))#(?!@)(\S+)/gu` — the broad candidate detector.
  Has the `u` flag + Unicode lookbehind. The `(?!@)` makes `#@` disjoint (files claimed by
  `FILE_INJECT_RE`). A fix at the SHAPE-GATE level (not the candidate level) keeps this regex intact.

---

## 11. Existing test coverage relevant to the fix

**`url-injection.test.mjs`** (21 cases). Key cases:
- **COL-4 (L400–410):** `#node.js` IS url-shaped → fetch IS called → 404 → verbatim. Asserts
  `calls.length === 1` and `injected === 0`. **This is the ONLY false-positive shape the suite asserts.**
  Every fetch in this suite is stubbed to 404 (or a controlled response), so a resolvable false-positive
  (`main.go` → 200) is NEVER exercised. The PRD's recommended regression test (assert NO fetch for
  `#filename.ext` prose) does NOT exist yet.
- **FAIL-8 (L659–668):** `enableUrls === false` → `calls.length === 0` (air-gapped opt-out). Any fix
  must keep this passing.
- The harness drives the private pipeline via `mod.injectFiles(prompt, [], FIX, false, enableUrls)` —
  regexes are PRIVATE, exercised only through `injectFiles`.

**`file-injector.test.mjs`:** enforces a strict export allowlist. If the fix adds an exported helper
(e.g. an extension-blocklist), it must be added to the allowlist assertion or the test fails.

---

## 12. README framing to update (`README.md` ~L202–205)

The "URLs need a dotted, alphabetic hostname" paragraph (L202) currently frames the gate as:
> "This deliberately rejects `#3.14`, `#v1.2`, `#fff` and other token-like text."

This gives false confidence that `#filename.ext` is safe. The PRD recommends either tightening the
regex OR documenting the false-positive class honestly. Any code fix should be reflected here.

---

## 13. Fix-impact summary (single-point locus)

- **BUG-001** is fixed at ONE call site: `URL_SHAPE_RE` (L36) and/or the gate `URL_SHAPE_RE.test(tok)`
  at L1398. Tightening the scheme-less alternative B (or adding a code-extension/TLD blocklist) is the
  minimal change. The loop structure, dedup, normalization, and `injectUrl` are unaffected. The only
  in-repo consumer of the constant is L1398.
- **BUG-002** is fixed in the `input` handler notify (L1494) and, if a URL/`#@file` breakdown is wanted
  in the wording, requires either (a) a new return field from `injectFiles` (e.g. `urls` count) +
  `State` field, or (b) a simpler approach (trigger-aware string based on whether the prompt contained
  `#@`). The `injectFiles` return shape (L1417) is currently `{text, images, injected, paged, blocks,
  details}`.

**Both fixes are local, the symbols are private/module-level, and `npm run typecheck` + the existing
159+23+38+21 suite form the regression baseline.**