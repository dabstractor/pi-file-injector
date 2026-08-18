# Scout findings — BUG-004 (autocomplete remap) + BUG-005 (ftp scheme gate) + docs landscape

Repo: `/home/dustin/projects/pi-file-injector` (read-only recon). Main source `file-injector.ts` = 1932 lines; `README.md` = 221 lines. All line numbers verified with `awk`/`grep -n` on 2025 snapshot at HEAD.

## Summary

- **BUG-004 confirmed**: `file-injector.ts:1906` mangles non-`@` item values (`/cmd` → `#@/cmd`) even though the adjacent comment at lines 1900–1901 promises "pass them through untouched so we don't mangle slash-command suggestions". The pass-through is enforced only at the *prefix* level (line 1902), never at the *item* level. No existing test pins the mangled behavior (the only autocomplete test, case A1 in `file-injector.test.mjs:1003–1049`, feeds exclusively `@`-prefixed fake items), so the fix is unblocked. `applyCompletion` does **not** depend on item values starting with `#@` — it gates on the `prefix` argument only (line 1914), so pass-through items are inserted verbatim by the deterministic replace.
- **BUG-005 confirmed**: spec (`spec/15-url-injection.md` lines 71, 325, 333) defines/promises `ftp` support; code (`file-injector.ts:43`) narrows the scheme to `https?` with no in-code deviation note. The spec's claim "Node supports it" for `fetch(ftp://…)` is factually wrong (undici has no ftp). Option A (regex + normalization at line 1660) yields the same observable outcome as today (verbatim) plus a misleading fetch spinner; Option B (README Limits note + spec row correction) is the low-risk choice. Full comparison below.
- **Docs landscape**: user docs = `README.md` only; `spec/` is a 17-file hand-written PRD (source of truth, `SPEC.md` is its index); no CHANGELOG exists anywhere in the repo.

## BUG-004 provider analysis + fix inputs

### The full registration block — `file-injector.ts:1866–1932`

Explanatory comment (1866–1877), then the handler:

```ts
// file-injector.ts:1866-1877 (comment)
// ── #@ path autocomplete (TUI/RPC only) ─────────────────────────────────────
// pi's built-in `@` completion lists files (gitignore-aware, via `fd`) but only fires when `@`
// sits at a token boundary; `#` glued in front closes it, so `#@` gets no completion on its own
// (verified: merely opening the shouldTriggerFileCompletion gate for `#@` yields nothing — pi's
// @-query extraction is itself boundary-strict). So instead we REUSE pi's file engine without
// reimplementing it: when the cursor is at `#@<partial>`, rewrite that one '#' into a space
// (giving the built-in a clean `@<partial>` at a valid boundary), delegate getSuggestions to the
// built-in, then remap the result back to `#@` (prefix `@<partial>` → `#@<partial>`; each item
// value `@<path>` → `#@<path>`). applyCompletion is handled here for our `#@` prefix so insertion
// is deterministic; everything else delegates. TUI/RPC only (headless print/json is a no-op);
// `pi -p "...#@file..."` is unaffected.

// file-injector.ts:1878-1932 (verbatim)
pi.on("session_start", (_event, ctx) => {
  if (!ctx.ui || typeof ctx.ui.addAutocompleteProvider !== "function") return; // headless print/json guard
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ["@"], // typing the @ in #@ (re)evaluates suggestions
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const before = line.slice(0, cursorCol);
      const m = before.match(/#@([^@\s]*)$/); // our trigger ending at the cursor
      if (!m) return current.getSuggestions(lines, cursorLine, cursorCol, options); // not #@ → built-in owns it
      const partial = m[1];

      // Rewrite the '#' immediately before our '@' into a space. The '@', the partial, and the
      // cursor position are unchanged, so the built-in lists exactly the files it would for a
      // normal `@<partial>` mention — gitignore-aware, sorted, fuzzy — via `fd`.
      const hashIdx = cursorCol - partial.length - 2; // index of '#' (before '@' + partial)
      if (hashIdx < 0) return current.getSuggestions(lines, cursorLine, cursorCol, options);
      const rewrittenLine = line.slice(0, hashIdx) + " " + line.slice(hashIdx + 1);
      const rewrittenLines = lines.slice();
      rewrittenLines[cursorLine] = rewrittenLine;

      const inner = await current.getSuggestions(rewrittenLines, cursorLine, cursorCol, options);
      if (options.signal?.aborted || !inner || inner.items.length === 0) return inner; // nothing / aborted
      // Only remap built-in FILE suggestions (prefix `@…`). If the built-in somehow returned
      // non-@ items, pass them through untouched so we don't mangle slash-command suggestions.
      if (!inner.prefix.startsWith("@")) return inner;

      const items = inner.items.map((it) => {
        let v = it.value;
        if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path
        return v === it.value ? it : { ...it, value: v };
      });
      return { prefix: `#@${partial}`, items };
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      // Deterministic insert for our #@ items: replace `prefix` (which ends at the cursor) with
      // `item.value`, place the cursor just past it. Delegate anything else to the built-in.
      if (typeof prefix === "string" && prefix.startsWith("#@")) {
        const line = lines[cursorLine] ?? "";
        const before = line.slice(0, cursorCol);
        if (before.endsWith(prefix)) {
          const start = cursorCol - prefix.length;
          const value = typeof item?.value === "string" ? item.value : "";
          const newLines = lines.slice();
          newLines[cursorLine] = before.slice(0, start) + value + line.slice(cursorCol);
          return { lines: newLines, cursorLine, cursorCol: start + value.length };
        }
      }
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },
    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true; // built-in decides
    },
  }));
}
```

Line-anchored details:
- Provider contract: object returned from factory `(current) => ({ triggerCharacters: ["@"], getSuggestions(lines, cursorLine, cursorCol, options) → Promise<{prefix, items}> | inner, applyCompletion(lines, cursorLine, cursorCol, item, prefix) → {lines, cursorLine, cursorCol}, shouldTriggerFileCompletion })`. Registration: `ctx.ui.addAutocompleteProvider(factory)` inside `pi.on("session_start", …)` (line 1878–1880).
- `#@` detection: line 1885 `/#@([^@\s]*)$/` on the text before the cursor; non-match → delegate unchanged (1886).
- `#`→space rewrite: lines 1891–1896 (`hashIdx = cursorCol - partial.length - 2`; negative → delegate, 1893).
- Delegation + abort guard: 1898–1899.
- **Prefix-level guard: line 1902** `if (!inner.prefix.startsWith("@")) return inner;`
- **The bug — item remap: lines 1904–1908**; mangle site is line 1906. A value like `"/cmd"` (no `@`) takes the `:#@" + v` branch → `"#@/cmd"`, contradicting the comment on 1900–1901.
- Returned shape: line 1909 `{ prefix: `#@${partial}`, items }` — prefix always starts `#@`; note `partial` can be `""`.
- `applyCompletion` delegation gate: line 1914 checks **the `prefix` argument** startsWith `#@` — it never inspects `item.value`. Insert uses `item.value` verbatim (1919–1921). So pass-through items are inserted as-is under our `#@` prefix — exactly the intended behavior.

### Fix inputs

Minimal change at 1904–1908 (matches the comment's promise):

```ts
const items = inner.items.map((it) => {
  if (typeof it.value !== "string" || (!it.value.startsWith("@") && !it.value.startsWith("#@"))) return it; // non-@ → pass through untouched
  if (it.value.startsWith("#@")) return it; // already ours
  return { ...it, value: "#" + it.value }; // @path → #@path
});
```

- **Interaction with the prefix guard (1902)**: unchanged. The remap block only ever runs when `inner.prefix` starts with `@`; non-`@` *items* under an `@` *prefix* is precisely the defensive case the comment describes. Today that case is silently corrupted instead.
- **Interaction with `{ prefix: `#@${partial}`, items }`**: none — the prefix is built from `partial`, not from items.
- **Does applyCompletion depend on values starting with `#@`?** No (see above, line 1914/1919). The `#@`-branch inserts any string value deterministically; anything with a non-`#@` prefix argument still delegates (1925).
- **Any test asserting the current mangled behavior?** No. `file-injector.test.mjs` case A1 (1003–1049) only feeds `@`-prefixed items. Caution: line 1036 asserts `out.items.every((it) => it.value.startsWith("#@"))` — if the implementer adds a non-`@` fake item to A1 to pin the fix, that assertion must be narrowed to the `@`-items (e.g. check the two `@src/…` items are remapped AND the `/cmd` item is untouched).

## BUG-004 test conventions

Only `file-injector.test.mjs` tests autocomplete (grep across all four test files + `diag.mjs`: `addAutocompleteProvider`/`getSuggestions` appear nowhere else).

### Handler-capture mock — `file-injector.test.mjs:173–187`

```ts
function captureHandler(event = "input") {
  const cbs = [];
  const pi = {
    on: (ev, cb) => { if (ev === event) cbs.push(cb); }, // capture by event name (factory registers both input + session_start)
    registerMessageRenderer: () => {}, // §6.3 no-op stub — the session_start handler registers the chat renderer (T2.S2); tests don't render
  };
  mod.default(pi); // registers handlers; cbs holds EVERY handler for `event` (input: 1; session_start: 2 after §4.6 config)
  return { cb: cbs[cbs.length - 1], all: cbs }; // .cb = LAST handler (backward compat for ~30 callers); .all = every handler for `event`
}
```

(`mod` is the jiti-loaded TS module: `const mod = await jiti.import(TS_PATH);` at line 72; `makeMockCtx` at 165–172 exists but A1 builds its own lighter ctx.)

### The A1 case verbatim — `file-injector.test.mjs:1003–1049`

```ts
// ── A1: #@ autocomplete reuses pi's @ file engine via line-rewrite (Option 1) ─────
// The factory also registers a `session_start` handler that installs an autocomplete provider via
// ctx.ui.addAutocompleteProvider, so `#@` gets path completion by reusing pi's built-in `@` engine
// (PRD §14). Option 2 (gate override) was tried and produced nothing — reverted. This case pins
// the shipped Option 1 behavior: rewrite '#'→space, delegate, remap prefix/items back to #@, and a
// deterministic applyCompletion for #@ prefixes. Headless-guarded (no ctx.ui → no-op).
await runCase("A1", "A1 — #@ autocomplete: rewrites '#'→space for built-in, remaps result to #@, deterministic apply", async () => {
  const slot = captureHandler("session_start");
  assert(typeof slot.cb === "function", "factory must register a session_start handler");

  // Headless guard: no ctx.ui.addAutocompleteProvider → no-op, must not throw.
  await slot.cb({}, { cwd: TMPDIR });
  await slot.cb({}, { cwd: TMPDIR, ui: {} });

  // Fake built-in: simulates pi's @ file completion. Captures the lines it received and returns
  // file items whose prefix/value carry the '@' (as pi does), so we can assert the #@ remap.
  let seenLines = null;
  const fakeCurrent = {
    getSuggestions: async (lines) => { seenLines = lines.map((l) => l.slice()); return { prefix: "@src/", items: [{ value: "@src/index.ts", label: "index.ts", description: "" }, { value: "@src/util.ts", label: "util.ts", description: "" }] }; },
    applyCompletion: (lines, line, col) => ({ lines, cursorLine: line, cursorCol: col }),
    shouldTriggerFileCompletion: () => false,
  };
  let providerFactory = null;
  const ctx = { cwd: TMPDIR, ui: { addAutocompleteProvider: (f) => { providerFactory = f; } } };
  await slot.cb({}, ctx);
  assert(typeof providerFactory === "function", "session_start must call ctx.ui.addAutocompleteProvider with a factory");

  const provider = providerFactory(fakeCurrent);
  assert(Array.isArray(provider.triggerCharacters) && provider.triggerCharacters.includes("@"),
    `triggerCharacters must include "@" (got ${JSON.stringify(provider.triggerCharacters)})`);

  // getSuggestions: #@<partial> → rewrite '#' to space, delegate, remap to #@.
  const out = await provider.getSuggestions(["Review #@src/"], 0, "Review #@src/".length, { signal: { aborted: false } });
  assert(seenLines && seenLines[0] === "Review  @src/", `built-in must see '#' rewritten to space, got ${JSON.stringify(seenLines && seenLines[0])}`);
  assert(out && out.prefix === "#@src/", `prefix must be remapped to '#@src/', got ${JSON.stringify(out && out.prefix)}`);
  assert(out && out.items.length === 2 && out.items.every((it) => it.value.startsWith("#@")), `every item value must be remapped to start with '#@' (got ${JSON.stringify(out && out.items.map((i) => i.value))})`);
  assert(out.items[0].value === "#@src/index.ts", `first item value must be '#@src/index.ts', got ${out.items[0].value}`);

  // Non-#@ input delegates to the built-in UNCHANGED (no rewrite, no remap — prefix stays '@src/').
  const out2 = await provider.getSuggestions(["Review @src/"], 0, "Review @src/".length, { signal: { aborted: false } });
  assert(out2 && out2.prefix === "@src/", "non-#@ must delegate to built-in unchanged (prefix '@src/', not remapped)");

  // applyCompletion: #@ prefix → deterministic replace; cursor lands after the inserted value.
  const applied = provider.applyCompletion(["Review #@src/"], 0, "Review #@src/".length, { value: "#@src/index.ts", label: "index.ts" }, "#@src/");
  assert(applied.lines[0] === "Review #@src/index.ts", `apply must produce 'Review #@src/index.ts', got ${JSON.stringify(applied.lines[0])}`);
  assert(applied.cursorCol === "Review #@src/index.ts".length, `cursor must land at end of inserted value (got ${applied.cursorCol})`);

  // applyCompletion: non-#@ prefix delegates to the built-in (returns defined value).
  const delegated = provider.applyCompletion(["x"], 0, 1, { value: "y", label: "y" }, "z");
  assert(delegated !== undefined, "non-#@ apply must delegate to built-in (return defined)");
});
```

Copy pattern for the fix's new sub-case: add a third item (e.g. `{ value: "/cmd", label: "cmd", description: "" }`) to `fakeCurrent.getSuggestions`'s returned items, then assert `out.items.find(i => i.value === "/cmd")` is untouched (same object value `/cmd`, not `#@/cmd`), and adjust the `every(startsWith("#@"))` assertion on line 1036 to the two `@src/…` items. All calls are `await`ed inside `runCase` (hermetic; `runCase` at ~line 92 catches per-case throws).

### Documented contract — `spec/14-autocomplete.md`

§14.2 (lines 17–36) is the contract. Key sentence (lines 26–31):

> **Shipped: Option 1 — line-rewrite reuse.** In `getSuggestions`, detect `#@<partial>` at the cursor, rewrite that one `#` into a space (so the built-in sees a clean `@<partial>` at a valid boundary), delegate to `current.getSuggestions(...)`, then remap the result back to `#@`: `prefix "@<partial>"` → `"#@<partial>"` and each item value `@<path>` → `#@<path>`. `applyCompletion` is implemented inline for `#@` prefixes (deterministic replace, cursor placed after the inserted value) and delegates otherwise; `shouldTriggerFileCompletion` delegates to the built-in unchanged.

The spec says remap `@<path>` → `#@<path>` only — it never sanctions prefixing non-`@` values. §14.3 Non-goal (38–42) and §14.4 Scope note (44–56) are unrelated to the remap. **There is no spec section on non-@ item pass-through** — the pass-through intent exists only as the in-code comment at `file-injector.ts:1900–1901`. A spec one-liner addition to §14.2 (or just the code-comment fix) covers documentation.

## BUG-005 spec-vs-code deviation + option comparison

### Spec side — `spec/15-url-injection.md`

§2.2 (lines 63–80), verbatim regex block (ftp on **line 71**):

```ts
// Files — unchanged (§4.2)
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;

// URL candidate — a '#' (not '#@') at start-of-string or after a non-word char.
const URL_INJECT_RE  = /(^|(?<=\W))#(?!@)(\S+)/g;

// A candidate token is a URL iff it has a scheme OR a dotted host with an alpha TLD.
const URL_SHAPE_RE   =
  /^((https?|ftp):\/\/\S+                                  // explicit scheme
   |(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}        // scheme-less: label(s).alphaTLD
     (?::\d+)?                                              // optional port
     (?:\/\S*)?)$/i;                                        // optional path/query/fragment
```

§7 edge table row (**line 325**), verbatim:

| Case | Behavior |
|---|---|
| `ftp://` scheme | supported by `URL_SHAPE_RE`; fetch via `fetch` (Node supports it). |

Other ftp mentions in spec/: `spec/15-url-injection.md:333` — §8 pseudocode repeats the spec regex `const URL_SHAPE_RE  = /^((https?|ftp):\/\/\S+|…)$/i;`. That's the complete set (grep -i ftp over spec/, README, source, tests found no others). Note the spec's parenthetical "(Node supports it)" is **wrong**: Node's `fetch` (undici) throws `TypeError: fetch failed` for `ftp:` URLs.

### Code side — `file-injector.ts`

`URL_SHAPE_RE` JSDoc + const, lines 27–43 (verbatim, the scheme sentence is the narrowing):

```ts
/** PRD §2.3 — an anchored shape gate: a candidate token is treated as a URL iff it has an explicit scheme
 *  (`https?`) OR a dotted host whose final label is an alpha TLD (2+ letters); optional `:port` and
 *  optional `/path`. Case-insensitive (`i` flag; no `u` flag — no `\p{}` classes or lookbehind here).
 *  … (BUG-001 deny-list text) … Accepted shapes include `#example.com/path`, `#https://x.com/y`,
 *  `#sub.example.co.uk/a`. … Wires into the URL loop as
 *  `URL_SHAPE_RE.test(cleanToken(m[2]))` (P1.M1.T2.S3). NOT exported. */
const URL_SHAPE_RE = /^((https?):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
```

The narrowing is documented only implicitly — the JSDoc says "an explicit scheme (`https?`)" (line 28) — there is **no deviation note** ("ftp dropped") anywhere in code or README.

### All URL_SHAPE_RE usages (grep results)

- `file-injector.ts:43` — the const (see above).
- `file-injector.ts:1646` — the shape gate inside the URL scan loop (loop at 1643–1667):
  ```ts
  if (enableUrls) {
    for (const m of text.matchAll(URL_INJECT_RE)) {
      const tok = cleanToken(m[2]);
      if (tok && URL_SHAPE_RE.test(tok)) {
        … // [BUG-001] deny-list guard at 1656:
        if (!/^https?:\/\//i.test(tok) && !tok.includes("/")) { … CODE_EXTENSIONS … }
        const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;   // line 1660 — normalization
        if (!state.injectedSet.has(abs)) {
          state.injectedSet.add(abs);
          onUrlFetch?.(abs); // line 1663 — spinner fires here, before network egress
          await injectUrl(abs, state, ctx);
        }
      }
    }
  }
  ```
- `file-injector.ts:42` (JSDoc self-reference), `:1639` (pipeline comment), `:1654–1655` (deny-list comment pointing back at it). Test references: `file-injector.test.mjs:3451`, `url-injection.test.mjs:418` (both comments only — no test imports the regex; it is NOT exported).
- `cleanToken` (lines 161–167) only trims trailing punctuation `TRAILING_PUNCT` — orthogonal to schemes; an `ftp://…` token survives `cleanToken` unchanged except trailing punctuation.

### Where fetch failures land — `injectUrl`, `file-injector.ts:906–994`

The entire body is wrapped; the catch is silent (no notify):

```ts
// file-injector.ts:908-912
async function injectUrl(url: string, state: State, ctx: Ctx): Promise<boolean> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS); // §3.3 guard 1
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
// file-injector.ts:988-993
  } catch {
    return false; // §3.5 timeout/network/throw → verbatim (never throws)
  } finally {
    clearTimeout(to); // always release the AbortController timer
  }
```

`return false` → the scan loop's `await injectUrl(abs, state, ctx)` (line 1664) discards it → token stays verbatim; `state.count` unbumped. Note the URL loop comment at 1641 already documents: "injectUrl (never throws; false → token left verbatim)".

### Existing shape-gate tests — `url-injection.test.mjs`

Fetch is stubbed via `globalThis.fetch` with a calls tracker (restored in `finally`); detection asserted via `calls` + block envelope. Representative tests, verbatim (lines 261–271):

```ts
// DET-2 — fully-qualified scheme token injects verbatim (no normalization needed).
await runCase("DET-2", "detection: #https://x.com/y → injected, fetch called with the exact URL", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ ct: "text/html", body: RICH_HTML }); };
    const r = await mod.injectFiles("#https://x.com/y", [], FIX, false, true);
    assert(r.injected === 1, `expected injected===1, got ${r.injected}`);
    assert(hasBlock(r, '<file name="https://x.com/y">'), 'block must carry the <file name="https://x.com/y"> envelope');
    assert(r.details.length === 1 && r.details[0].kind === "url", `detail kind must be 'url', got ${r.details[0]?.kind}`);
    assert(calls.length === 1 && calls[0] === "https://x.com/y", `fully-qualified URL fetched as-is; calls=${JSON.stringify(calls)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

And the scheme-less normalization counterpart (lines 245–258, DET-1): `#example.com` → `calls[0] === "https://example.com"` + `r.text === "#example.com"` verbatim. COL-2 (389–396) proves non-URL-shaped tokens produce **zero** fetch calls. **No ftp test exists in any test file**; spec §2.3's collision table doesn't list ftp either.

### Option comparison

**Option A — add `ftp` to URL_SHAPE_RE** (`/^((https?|ftp):\/\//`):
- Hidden coupling #1: line 1660 normalization `/^https?:\/\//i.test(tok) ? tok : "https://" + tok` does NOT recognize `ftp://` → would produce `https://ftp://example.com` (garbage). Must become `/^(https?|ftp):\/\//i`. Same test-site pattern at line 1656 (deny-list guard) technically also needs syncing, though `ftp://…` always contains `/` so it bypasses that guard regardless.
- Net runtime behavior: `fetch("ftp://…")` throws immediately (undici: no ftp) → caught at line 990 → `false` → verbatim — i.e. **identical outcome to today's rejection at the gate**, except now (a) the footer spinner fires via `onUrlFetch` (line 1663) on a fetch guaranteed to fail (UX noise; §3.6 spinner contract says spinner shows "for a REAL fetch"), and (b) the token enters `state.injectedSet` (harmless).
- Tests: no existing test changes (none exercise ftp); would add one asserting `#ftp://example.com` → verbatim, `fetch` called with the un-mangled `ftp://example.com` URL (pins the line-1660 fix).
- Docs: JSDoc (27–43), spec/15 lines 71, 325, 333 — the §7 row's "(Node supports it)" must be corrected regardless.

**Option B — document the narrowing only**:
- README `## Limits` (starts line 198): the bullet at **line 211** — "**URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://` URL **or** a bare host…" — is the natural home; append one sentence, e.g. "Explicit schemes other than `http(s)://` (e.g. `ftp://…`) are not fetched and are left as written." No other README section mentions schemes: `### URLs` (52–96) says "Both `#example.com` (bare domain) and `#https://example.com/api` (full URL) work" (line 61) — already http(s)-consistent, no sync needed.
- Spec: correct the §7 row 325 (mark ftp unsupported-by-fetch) and optionally §2.2/§8 to match shipped code, or add a deviation note.
- Zero code, zero test, zero behavior change.

**Recommendation input**: Option B. Option A changes no user-visible outcome (ftp still never injects) while adding spinner noise and a second scheme-test site to keep in sync; without a real ftp client it only "honors" half of the spec row (the regex half, not the fetch half). If Option A is chosen anyway, the line-1660 normalization change is mandatory.

## README/docs landscape

### Doc surfaces

1. **`README.md`** (221 lines) — the only user-facing doc. Section headings (line numbers): `# #@file` (1), `## Why` (5), `## Install` (13), `## Usage` (31), `### URLs` (52), `## What gets injected` (98), `## Syntax` (121), `### Optional: bare-@ markdown imports` (150), `### URLs: enableUrls (network egress)` (181), `## Limits` (198), `## #@ versus @` (216).
2. **`spec/`** — hand-written PRD, source of truth for behavior (not generated; no generator in `scripts/` or `tools/` — `scripts/typecheck.mjs`, `tools/url-corpus.{mjs,data.mjs}` only). `spec/SPEC.md` is a Draft-status index that imports the 17 parts via `@path` references: 01-overview … 17-line-ranges. Behavior-relevant parts: 04-syntax, 05-file-behavior, 06-delivery-display, 09-algorithm, 10-edge-cases, 11-acceptance-tests, 12-implementation-notes, 14-autocomplete, 15-url-injection, 17-line-ranges.
3. **No CHANGELOG** (`find . -maxdepth 2 -iname "*changelog*"` → nothing).
4. `plan/001…011_*` are per-run engineering artifacts (prd snapshots, task json, bug-hunt logs) — not user docs; ignore for the docs-sync task.

### README sections for the changeset-level docs task

- **Expanded chat view display**: `## Usage` lines 44–46 ("each file shows up as a compact green `read <path>` line … Press `ctrl+o` to expand … The file bytes are delivered to the model underneath — never pasted into your message bubble"); `### URLs` line 61 (green `read <url>` line, `ctrl+o`); `## What gets injected` lines 113–119 (native block format + green read line rendering).
- **Markdown imports + line ranges**: `## Usage` lines 38–42 (line-range syntax summary); `## Syntax` lines 126–134 (`**Line range.**` paragraph); `## Syntax` lines 136–149 (`**Markdown imports:**` five-rule list); `### Optional: bare-@ markdown imports` (150–180, config + precedence); `## What gets injected` line 119 (markdown rescanning).
- **URL images**: `### URLs` lines 78–83 ("By content type" list — **Images** bullet at line 82: "`#https://example.com/cat.png` → attached as an image, same as `#@image`").
- **Autocomplete**: `## Usage` line 94 ("Path completion works in the editor. Type `#@` and the same file list Pi shows for `@` appears; Tab completes it as `#@<path>`."); `## Limits` line 207 ("**No autocomplete for in-file imports.** …").
- **Limitations**: `## Limits` (198–214) — 17 bullets; BUG-005 Option B note goes in the "URLs need a dotted, alphabetic hostname" bullet at line 211.
- URL injection behavior sections needing sync if URL behavior ever changes: `### URLs` (52–96) and `### URLs: enableUrls` (181–196) and the URL bullets in `## Limits` (209–214).

## Risks

- **BUG-004 fix**: A1's blanket assertion `out.items.every((it) => it.value.startsWith("#@"))` (`file-injector.test.mjs:1036`) will fail if a non-`@` fake item is added without narrowing it — the implementer must scope that assertion (high likelihood of tripping; it's the only autocomplete regression net).
- The BUG-004 defect is defensive-path-only: reachable only when the built-in returns an `@` prefix with non-`@` item values — no live reproduction was confirmed against real pi internals; severity = latent correctness/comment-contract violation, not a user-visible everyday bug.
- **BUG-005 Option A** carries the line-1660 normalization trap (`https://ftp://…` mangling) — a regex-only change is insufficient and would create a NEW bug class; also fires the fetch spinner (line 1663) for a guaranteed failure.
- Spec §7 row (`spec/15-url-injection.md:325`) contains a factual error ("Node supports it") that survives either option unless the spec row is edited.
- `URL_SHAPE_RE` is NOT exported; any new shape-gate test must go through `injectFiles` with stubbed `globalThis.fetch` (DET pattern) — direct regex tests are impossible without an export change.
- Docs: two sources of truth (README vs spec/15) can drift further if only one is updated for BUG-005; the changeset docs task should touch both (or explicitly mark spec as historical).