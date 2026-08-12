# PRP — P1.M1.T1.S1: Add CODE_EXTENSIONS deny-list constant + integrate the gate in the URL scan loop

**Work item**: P1.M1.T1.S1 (BUG-001: Eliminate code-extension false-positives in URL detection → subtask 1 of 2)
**Parent**: P1.M1 BUG-001 (Implement code-extension deny-list gate) → P1 URL Shape Gate & Notify Bugfix Release
**Delta**: `plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9` (BUG-001)
**Bug ID**: BUG-001 — URL detector fires network fetches (and injects content) for `#filename.ext` prose.

---

## Goal

**Feature Goal**: Stop the `#<url>` scan loop from treating scheme-less `#<word>.<code-ext>` tokens
(e.g. `#main.go`, `#notes.md`, `#config.json`, `#node.js`) as URLs. Add a module-level
`CODE_EXTENSIONS` deny-list `Set<string>` and a post-gate check in the URL scan loop: when
`URL_SHAPE_RE.test(tok)` passes for a **scheme-less** token whose final label (after the last `.`)
is in `CODE_EXTENSIONS`, skip it (no fetch, no normalization, no injection). Explicit-scheme tokens
(`#https://…`, `#http://…`, `#ftp://…`) bypass the deny-list entirely.

**Deliverable** (all in `file-injector.ts` + one new test case):
1. A new module-level `const CODE_EXTENSIONS: Set<string>` placed immediately after `URL_SHAPE_RE`
   (~L37, before `MIME_BY_EXT`).
2. A post-gate `continue`-check inserted inside the URL scan loop at ~L1396–1397 (after the
   `URL_SHAPE_RE.test(tok)` line, before the `abs = …` normalization line).
3. An updated JSDoc block above `URL_SHAPE_RE` (L27–35) that (a) documents the deny-list gate,
   (b) removes the false "node.js is the only residual false-positive and is benign" claim, and
   (c) states that explicit-scheme tokens bypass the deny-list.
4. **TDD anchor test** `DENY-1` in `url-injection.test.mjs` asserting `calls.length === 0` for
   `"edit #main.go"`.
5. **Forced adjacent change** — flip the existing `COL-4` case (`#node.js`) from "fetch CALLED"
   to "ZERO fetch", because implementing the gate necessarily changes `#node.js`'s behavior
   (`.js` is now a denied code extension) and `npm test` must stay green. (See *Scope / forced
   adjacent change* below.)

**Success Definition**: `npm run typecheck` is clean (0 errors); `npm test` is green; the `DENY-1`
case asserts `#main.go` → zero fetch + verbatim; the flipped `COL-4` asserts `#node.js` → zero
fetch; and existing real-domain cases (`DET-1` `#example.com`, `DET-2` `#https://x.com/y`, `FAIL-8`
air-gapped opt-out) remain green (legitimate URL detection is preserved).

---

## Why

- **Bug harm (PRD h2.2 / h3.0)**: `URL_SHAPE_RE`'s scheme-less dotted-host alternative B ends in a
  final-label gate `[a-z]{2,}` that accepts **every** 2+ letter alphabetic string as a "TLD". Every
  common code/file extension (`go`, `md`, `py`, `json`, `png`, `js`, …) is 2+ alpha letters, so
  `#main.go`, `#notes.md`, `#config.json`, `#node.js` all pass the gate and trigger a live
  `fetch("https://<word>.<ext>")`. Two concrete harms: (1) **unwanted network egress** (DNS + HTTP
  the user never asked for), and (2) **unwanted content injection** — when the domain resolves
  (e.g. `main.go` is the real Go site), the extracted HTML is injected into the model's context, so
  `refactor #main.go` delivers the Go homepage instead of referencing a local file.
- **Why this fix shape** (`fix_strategy.md` → "Code-Extension Deny-List Gate"): surgical (only
  scheme-less tokens are affected; explicit-scheme URLs are untouched), preserves legitimate domain
  detection (`com`/`org`/`net`/`io`/`dev`/`app` are NOT code extensions), eliminates the exact
  enumerated false-positive class, single-point change at one call site, no config change required.
- **Why now**: `enableUrls` defaults to `true` (`cfg.enableUrls !== false`, file-injector.ts L1483),
  so this false-positive fires on-by-default for the primary use case (a coding agent where
  `#filename.ext` references are extremely common).

---

## What

**User-visible behavior change**: prose like `edit #main.go`, `see #notes.md`, `#node.js` no longer
triggers a network fetch or content injection — the token is left verbatim in the prompt (as a plain
word, exactly like `#Heading`). Real domains (`#example.com`, `#sub.example.co.uk/path`) and any
explicit-scheme URL (`#https://main.go`, `#https://node.js`) are **unaffected** and still fetch.

**Technical change**: one new constant + one post-gate `continue` in the URL scan loop. No new
exports (`CODE_EXTENSIONS` is private/module-level). The `injectFiles` return shape is **unchanged**.
The regex `URL_SHAPE_RE` itself is **unchanged** (the gate is a post-regex filter, not a regex edit).

### Success Criteria

- [ ] `CODE_EXTENSIONS` `Set<string>` defined at module level after `URL_SHAPE_RE` (~L37), `npm run typecheck` clean.
- [ ] Scheme-less token whose final label ∈ `CODE_EXTENSIONS` → `continue` (no fetch, no inject). Verified by `DENY-1` (`#main.go` → 0 calls) and flipped `COL-4` (`#node.js` → 0 calls).
- [ ] Explicit-scheme tokens bypass the deny-list: `#https://x.com/y` still fetches (`DET-2` green).
- [ ] Legitimate scheme-less domains still fetch: `#example.com` (`com` ∉ deny-list) → `DET-1` green.
- [ ] `enableUrls===false` still zero-egress: `FAIL-8` green.
- [ ] Prompt preserved verbatim (`r.text === "edit #main.go"`).
- [ ] JSDoc on `URL_SHAPE_RE` updated (deny-list documented; `node.js`-benign claim removed).
- [ ] `npm test` green (all 4 harnesses: file-injector, import-behavior, relative-imports, url-injection).

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this
successfully?_ — **Yes.** This PRP quotes the exact current source at every edit site (with verified
line numbers), gives the exact replacement code, the exact `CODE_EXTENSIONS` contents, the exact
test cases to add/flip, and the exact validation commands. No inference required.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/source_analysis.md
  why: "Line-accurate map of the BUG-001 locus. §1 = URL_SHAPE_RE definition + why every code-ext passes the gate. §2 = the URL scan loop (verbatim, with pipeline). §6 = proves URL_SHAPE_RE has EXACTLY ONE runtime call site (L1398) — single-point change, no other consumers. §10 = cleanToken behavior (trailing-punct strip before the gate)."
  section: "§1 (URL_SHAPE_RE), §2 (URL scan loop), §6 (single call site), §10 (cleanToken)"

- docfile: plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/fix_strategy.md
  why: "Authoritative design reference. 'BUG-001 → Chosen Approach: Code-Extension Deny-List Gate' states: scheme-less-only, explicit-scheme bypasses, gate is an INLINE post-regex filter (NOT a regex change), lists the extension categories, and the COL-4 impact (must flip from fetch-called to no-fetch)."
  section: "BUG-001 section (Chosen Approach + Extensions to Include + COL-4 Test Impact + Risk Assessment)"

- file: file-injector.ts
  why: "THE file being edited. Three edit sites: (1) JSDoc L27-35 + URL_SHAPE_RE L36 (insert CODE_EXTENSIONS after L36, before MIME_BY_EXT L37); (2) URL scan loop L1393-1404 (insert the post-gate continue at ~L1397); (3) the JSDoc text itself."
  pattern: "Module-level consts block L25-42 (URL_INJECT_RE, URL_SHAPE_RE, MIME_BY_EXT, TRAILING_PUNCT) — mirror this style for CODE_EXTENSIONS. The URL scan loop is the ONLY runtime consumer of URL_SHAPE_RE."
  gotcha: "CODE_EXTENSIONS is NOT exported (private). cleanToken (L121, exported) strips trailing '.' so '#main.go.' -> 'main.go' BEFORE the gate — fine. lastIndexOf('.') on a no-dot token returns -1 -> slice(0) = whole token, but such a token cannot reach the check (URL_SHAPE_RE requires either a scheme or a dot)."

- file: url-injection.test.mjs
  why: "The hermetic URL acceptance harness (zero-network; per-case globalThis.fetch stub + calls tracker). (1) Add the DENY-1 TDD anchor (model on FAIL-8 spy pattern). (2) FLIP COL-4 (L400-411) from calls===1 to calls===0. Sections: DETECTION(243) DISPATCH(280) COLLISION(353) SCHEME-LESS NORMALIZATION(434) FAILURE/GUARD(487)."
  pattern: "Each case: `const calls=[]; try { globalThis.fetch = async(url)=>{calls.push(String(url)); return makeRes({...});}; const r = await mod.injectFiles(prompt,[],FIX,false,enableUrls); assert(...); } finally { globalThis.fetch = origFetch; }`. FIX = {cwd: TMPDIR}. makeRes() defaults to text/html 200. Exit code: process.exit(failed>0?1:0)."
  gotcha: "FIX is { cwd: TMPDIR } — no model, no trust gate (L122). mod.injectFiles(prompt, [], FIX, false, enableUrls) is the ONLY entry (regexes are PRIVATE). Existing case ids: DET-1..2, DIS-1..4, COL-1..5, NORM-1, FAIL-1..9 — use a NON-colliding id (recommend 'DENY-1')."

- file: file-injector.ts  # the URL scan loop, VERBATIM (verified L1393-1404)
  why: "Exact current code to edit. The post-gate check goes between the `if (tok && URL_SHAPE_RE.test(tok)) {` line and the `const abs = ...` line."
  pattern: |
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

### Current Codebase tree (verified)

```bash
pi-file-injector-url-injector/
├── file-injector.ts           # EDIT: JSDoc L27-35, +CODE_EXTENSIONS ~L37, URL loop L1393-1404
├── file-injector.test.mjs     # unchanged (export-allowlist harness — no new exports, so unaffected)
├── import-behavior.test.mjs   # unchanged
├── relative-imports.test.mjs  # unchanged
├── url-injection.test.mjs     # EDIT: +DENY-1 (new), FLIP COL-4 (L400-411)
├── package.json               # scripts.test chains all 4 .mjs harnesses (&&); typecheck via scripts/typecheck.mjs
├── scripts/typecheck.mjs      # tsc --strict against globally-installed pi .d.ts (temp tsconfig + paths)
├── tsconfig.json              # editor/LSP hints only (typecheck.mjs writes its own temp tsconfig)
├── README.md                  # UNCHANGED in this subtask (P1.M3.T1.S1 owns README sync)
└── plan/010_8645157f3bf5/bugfix/001_07ad0d602ba9/architecture/{source_analysis,fix_strategy,test_analysis,system_context}.md
```

### Desired Codebase tree (files modified — no new files)

```bash
file-injector.ts        # MODIFIED: +CODE_EXTENSIONS const (~L37); +post-gate continue (URL loop ~L1397); JSDoc rewrite (L27-35)
url-injection.test.mjs  # MODIFIED: +DENY-1 case (TDD anchor, 'edit #main.go' → 0 calls); COL-4 flipped (calls 1→0)
# (no new files; no new exports; injectFiles return shape unchanged)
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL (TDD ordering): the item contract REQUIRES writing the failing DENY-1 test FIRST, then
// implementing the gate, then watching DENY-1 go red→green. Do gate-first and you skip the TDD proof.

// CRITICAL (forced adjacent change — KEEP npm test GREEN): implementing the gate makes the EXISTING
// COL-4 case (#node.js) change behavior — '.js' is in CODE_EXTENSIONS, so #node.js stops fetching.
// COL-4 currently asserts calls.length===1; after the gate it is 0 → COL-4 FAILS. You MUST flip
// COL-4's assertions to calls.length===0 as part of this subtask, otherwise `npm test` exits 1 and
// S1's own Level-3 validation gate is unmet. (The BROADER no-fetch matrix — main.py, notes.md,
// config.json, image.png, etc. — is P1.M1.T2.S1's scope; do NOT add it here.)

// CRITICAL (scheme-less detection): a token is "scheme-less" iff it does NOT start with http://,
// https://, OR ftp://. URL_SHAPE_RE Alternative A accepts all three. The deny-list MUST test all
// three so an explicit ftp:// token is not mis-gated. Reuse the SAME scheme test the normalization
// uses: !/^https?:\/\//i.test(tok) && !/^ftp:\/\//i.test(tok). (Equivalent: !/^(https?|ftp):\/\//i.test(tok).)

// GOTCHA (final-label extraction): use tok.slice(tok.lastIndexOf(".") + 1).toLowerCase(). For
// 'main.go' -> 'go'; 'notes.md' -> 'md'; 'app.co.uk' -> 'uk' (NOT a code ext -> still fetches, correct);
// 'sub.example.com/path' -> 'com' (lastIndexOf finds the LAST '.', the one before 'com'... wait):
//   NOTE: lastIndexOf('.') finds the last '.' in the WHOLE token including '/path'. For
//   'sub.example.com/path' the last '.' is before 'com', and there's no '.' in '/path', so
//   finalLabel = 'com' -> not a code ext -> fetches. CORRECT. But for a token like 'a.b/c.d' the
//   last '.' is before 'd' -> finalLabel='d' (D language source) -> would be blocked. That is an
//   acceptable, conservative trade-off (rare shape; use #https://a.b/c.d to force-fetch).

// GOTCHA (ccTLD overlap): a few extensions ARE real ccTLDs (.sh=Saint Helena, .py=Paraguay). In a
// CODING AGENT, #foo.sh and #foo.py almost always mean a shell script / Python file, not a foreign
// website. Blocking them is the correct trade-off. Users who need the website use #https://foo.sh.
// Do NOT add real gTLDs/ccTLDs (com, org, net, io, dev, app, ai, co, me, xyz, sh-as-TLD...) to the
// deny-list — that would break legitimate URL detection (DET-1, DET-2).

// GOTCHA (no regex change): do NOT edit URL_SHAPE_RE itself. The gate is an inline post-regex filter.
// Editing the regex risks Alternative A (explicit scheme) regressions and is out of scope.

// GOTCHA (no new export): CODE_EXTENSIONS is module-level and PRIVATE. file-injector.test.mjs enforces
// a strict export allowlist — adding an export here (even "just to test it") will fail that harness.
// The gate is exercised ONLY through injectFiles(prompt, [], FIX, false, enableUrls), like every
// other url-injection case.

// GOTCHA (enableUrls gate is OUTER): the deny-list lives INSIDE `if (enableUrls)`. When enableUrls===false
// the whole loop is skipped (FAIL-8 asserts calls===0). The deny-list must NOT be hoisted outside the
// enableUrls gate (it is irrelevant when URL injection is off — and the no-egress invariant is already
// proven by the outer gate).
```

---

## Implementation Blueprint

### (No data models / no API change)

`CODE_EXTENSIONS` is a plain `Set<string>` literal. No interfaces, no return-shape change, no new
exports. The `State`/`Ctx`/`FileDetail` types are untouched.

### The exact `CODE_EXTENSIONS` set to implement

Use the union of the item_description baseline (the contract floor: "Include at minimum these
categories") and the `fix_strategy.md` supplements. All entries **lowercase, no leading dot**.
(Both docs are internal; the union is strictly more robust. The union is the authoritative set for
this PRP.)

```ts
/** [BUG-001] Code-extension deny-list. A scheme-less `#<word>.<ext>` token whose final label (the
 *  substring after the LAST '.', lowercased) is in this Set is treated as a LOCAL FILE reference,
 *  NOT a URL — the URL scan loop skips it (no fetch, no normalization, no injection). Explicit-scheme
 *  tokens (#https://…, #http://…, #ftp://…) bypass this list entirely. Covers the common coding /
 *  config / doc / image / archive extensions. NOT a real-TLD list: com/org/net/io/dev/app/ai/co/me/xyz
 *  etc. are deliberately ABSENT so legitimate domains still fetch (DET-1, DET-2). A few entries overlap
 *  real ccTLDs (.sh, .py): in a coding agent these mean a script / Python file; force-fetch via
 *  #https://foo.sh. Trivially extendable — it is a plain Set. NOT exported. */
const CODE_EXTENSIONS: Set<string> = new Set([
  // programming languages
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "kts", "cs", "cpp",
  "cc", "cxx", "c", "h", "hpp", "hxx", "swift", "php", "pl", "pm", "lua", "r", "scala", "clj",
  "cljs", "cljc", "ex", "exs", "erl", "hs", "ml", "mli", "fs", "fsi", "vb", "dart", "groovy", "el",
  "scm", "rkt", "zig", "nim", "jl", "d", "f", "f90", "pas", "cob", "asm", "s", "v",
  // web / markup
  "html", "htm", "css", "scss", "sass", "less", "styl", "vue", "svelte", "astro",
  // config / data
  "xml", "json", "json5", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "sql",
  "graphql", "gql", "proto", "csv", "tsv", "properties", "gradle", "cmake",
  // scripts
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "awk",
  // images
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif", "heic", "avif",
  // documents
  "md", "markdown", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf", "tex", "bib",
  "rst", "adoc",
  // binary / archives / build artifacts
  "db", "sqlite", "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "lock", "log", "min", "map", "wasm",
]);
```

> If you prefer to implement exactly the item_description floor and skip the `fix_strategy.md`
> supplements, the **required-minimum** additions beyond the floor are: `kts, cxx, hxx, pm, cljs,
> cljc, exs, mli, fsi, cob, s, astro`. Including them costs nothing and closes gaps; the union above
> is recommended.

### Implementation Tasks (ordered by dependencies — TDD)

```yaml
Task 1: WRITE THE FAILING TEST FIRST (TDD anchor) — url-injection.test.mjs
  - FILE: url-injection.test.mjs
  - ADD a new case "DENY-1" (NON-colliding with DET-1..2, DIS-1..4, COL-1..5, NORM-1, FAIL-1..9).
    RECOMMENDED placement: a new section header `console.log("\nCODE-EXTENSION DENY-LIST (BUG-001)")`
    inserted AFTER the "SCHEME-LESS NORMALIZATION" group (which ends before "FAILURE / GUARD" at L487)
    OR immediately after the COLLISION group. Either is fine.
  - MODEL the case on the FAIL-8 spy pattern (per-case globalThis.fetch stub + calls tracker + try/finally restore).
  - EXACT case body (see "Test code to add" below): enableUrls===true (5th param true); prompt
    "edit #main.go"; assert calls.length===0, r.injected===0, r.blocks.length===0,
    r.text==="edit #main.go".
  - VERIFY RED: run `node ./url-injection.test.mjs` -> DENY-1 MUST FAIL with "calls=1" (the gate does
    not exist yet → main.go IS fetched). This red run is the TDD proof that the test is meaningful.
    (Also note: at this point COL-4 still passes — it hasn't been touched yet.)

Task 2: ADD the CODE_EXTENSIONS constant — file-injector.ts
  - FILE: file-injector.ts
  - INSERT the `const CODE_EXTENSIONS: Set<string> = new Set([...])` block (see "The exact
    CODE_EXTENSIONS set" above, INCLUDING its JSDoc) immediately AFTER the `URL_SHAPE_RE` definition
    (L36) and BEFORE `MIME_BY_EXT` (L37). One blank line of separation above and below, matching the
    existing const-block spacing.
  - NAMING: CODE_EXTENSIONS (SCREAMING_SNAKE_CASE — matches URL_SHAPE_RE, URL_INJECT_RE, MIME_BY_EXT).
  - TYPE: `Set<string>` (explicit annotation; entries lowercase, no dot).
  - VISIBILITY: module-level, NOT exported.

Task 3: ADD the post-gate continue check — file-injector.ts URL scan loop (~L1396-1397)
  - FILE: file-injector.ts, the `if (enableUrls) { ... }` URL loop (L1393-1404)
  - INSERT the deny-list block BETWEEN the `if (tok && URL_SHAPE_RE.test(tok)) {` line and the
    `const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;` line. See "Loop edit" below.
  - SEMANTICS: scheme-less = !/^https?:\/\//i.test(tok) && !/^ftp:\/\//i.test(tok). If scheme-less,
    finalLabel = tok.slice(tok.lastIndexOf(".") + 1).toLowerCase(); if CODE_EXTENSIONS.has(finalLabel)
    -> `continue` (skip the rest of this matchAll iteration: no abs, no dedup, no fetch).
  - PRESERVE: the `const abs = ...` normalization line, the injectedSet dedup, the injectUrl call —
    byte-for-byte. The only structural change is the inserted `if (...) { ... continue; }` block.
  - PRESERVE: the OUTER `if (enableUrls)` gate (the deny-list goes INSIDE it; do not hoist it out).

Task 4: UPDATE the JSDoc on URL_SHAPE_RE — file-injector.ts L27-35
  - FILE: file-injector.ts, the `/** PRD §2.3 ... */` block above URL_SHAPE_RE
  - REMOVE the false claim: "Residual benign false-positive: #node.js matches the shape (alpha TLD js)
    but won't resolve → the no-op fallback (PRD §3.5, P1.M1.T2) leaves it verbatim."
  - ADD: documentation of the CODE_EXTENSIONS deny-list gate — scheme-less tokens whose final label
    is a known code extension are treated as FILE references, not URLs (skipped before fetch);
    explicit-scheme tokens (#https://…, #http://…, #ftp://…) bypass the deny-list; use the explicit-
    scheme form to force-fetch a domain whose TLD collides with a code extension (.sh, .py). Point at
    CODE_EXTENSIONS (L37) and the gate in the URL loop. Keep the existing accurate content (the
    accepted/rejected shape examples, the i-flag/no-u-flag note, the NOT-exported note).

Task 5: FLIP COL-4 (forced adjacent change to keep npm test green) — url-injection.test.mjs L400-411
  - FILE: url-injection.test.mjs, the `runCase("COL-4", ...)` block
  - WHY: the gate (Task 3) makes #node.js stop fetching ('.js' ∈ CODE_EXTENSIONS). COL-4 currently
    asserts calls.length===1; it MUST now assert calls.length===0 or `npm test` exits 1.
  - EDIT: change the case name + comment to reflect "code-extension → deny-list → ZERO fetch"; change
    the assertion `assert(calls.length === 1, ...)` -> `assert(calls.length === 0, ...)`; keep the
    `r.injected === 0` and no-block assertions (still true). See "COL-4 flip" below.
  - NOTE: this is the MINIMAL keep-green change. The broader no-fetch matrix (notes.md, config.json,
    image.png, main.py, etc.) is P1.M1.T2.S1 — do NOT add it in this subtask.

Task 6: VERIFY GREEN (TDD completion + regression)
  - RUN: `npm run typecheck` -> 0 errors (CODE_EXTENSIONS typed; no new exports; loop edit type-clean).
  - RUN: `node ./url-injection.test.mjs` -> DENY-1 PASSES (red→green TDD proof); COL-4 passes (flipped);
    DET-1/DET-2/NORM-1/FAIL-8 all pass (legitimate detection + air-gapped opt-out preserved).
  - RUN: `npm test` -> all 4 harnesses green (file-injector, import-behavior, relative-imports, url-injection).
```

### Implementation Patterns & Key Details

**Loop edit (Task 3) — exact before/after:**

```ts
// BEFORE (verbatim, L1393-1404):
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

// AFTER — only the deny-list block is inserted (everything else byte-for-byte identical):
  if (enableUrls) {
    for (const m of text.matchAll(URL_INJECT_RE)) {
      const tok = cleanToken(m[2]);
      if (tok && URL_SHAPE_RE.test(tok)) {
        // [BUG-001] Code-extension deny-list: a scheme-less token whose final label is a known
        // code/file extension is a LOCAL FILE reference, not a URL — skip it (no fetch, no
        // normalization, no injection). Explicit-scheme tokens (#https://…/#http://…/#ftp://…)
        // bypass this check entirely (URL_SHAPE_RE Alternative A). See CODE_EXTENSIONS + the JSDoc
        // on URL_SHAPE_RE. Mirrors the scheme test used by the normalization below it.
        if (!/^https?:\/\//i.test(tok) && !/^ftp:\/\//i.test(tok)) {
          const finalLabel = tok.slice(tok.lastIndexOf(".") + 1).toLowerCase();
          if (CODE_EXTENSIONS.has(finalLabel)) continue;
        }
        const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
        if (!state.injectedSet.has(abs)) {
          state.injectedSet.add(abs);
          await injectUrl(abs, state, ctx);
        }
      }
    }
  }
```

**Test code to add (Task 1) — the DENY-1 TDD anchor:**

```js
// ══════════════════════════════════════════════════════════════════════════════
// CODE-EXTENSION DENY-LIST (BUG-001) — scheme-less #<word>.<code-ext> is a FILE ref, not a URL.
// ══════════════════════════════════════════════════════════════════════════════
console.log("\nCODE-EXTENSION DENY-LIST (BUG-001)");

// DENY-1 — [BUG-001] a scheme-less token whose final label is a known code extension ('main.go' ->
// 'go') is treated as a LOCAL FILE reference: ZERO fetch, ZERO injection, prompt verbatim. The fetch
// SPY (not the absence of a stub) proves the no-network invariant. enableUrls===true (default) — this
// is the on-by-default false-positive class. Explicit-scheme forms (#https://main.go) bypass the
// deny-list and are covered by the broader regression matrix in P1.M1.T2.S1.
await runCase("DENY-1", "deny-list: 'edit #main.go' → code-extension final label → ZERO fetch + verbatim", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({}); }; // spy — would be a bug if called
    const r = await mod.injectFiles("edit #main.go", [], FIX, false, true); // enableUrls===true (5th param)
    assert(calls.length === 0, `#main.go final label 'go' is a code extension → must NOT fetch; calls=${JSON.stringify(calls)}`);
    assert(r.injected === 0, `nothing injected; injected=${r.injected}`);
    assert(r.blocks.length === 0, "no block appended");
    assert(r.text === "edit #main.go", `prompt preserved verbatim; got ${JSON.stringify(r.text)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

**COL-4 flip (Task 5) — exact replacement of the L400-411 block:**

```js
// COL-4 — [BUG-001] #node.js final label 'js' is a known code extension → the code-extension
// deny-list (P1.M1.T1.S1) now treats it as a FILE reference, NOT a URL → ZERO fetch. (Previously this
// asserted fetch CALLED + 404; the deny-list gates scheme-less code-extension tokens BEFORE the fetch,
// so #node.js no longer reaches the network. The explicit-scheme form #https://node.js still fetches.)
await runCase("COL-4", "collision: #node.js code-extension → deny-list → ZERO fetch + verbatim", async () => {
  const calls = [];
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return makeRes({ status: 404, ok: false }); };
    const r = await mod.injectFiles("#node.js", [], FIX, false, true);
    assert(calls.length === 0, `#node.js final label 'js' is a code extension → must NOT fetch; calls=${calls.length}`);
    assert(r.injected === 0, `no block; got injected===${r.injected}`);
    assert(!hasBlock(r, '<file name="https://node.js">'), "no block appended");
  } finally {
    globalThis.fetch = origFetch;
  }
});
```

### Integration Points

```yaml
SOURCE (file-injector.ts):
  - new-const: "CODE_EXTENSIONS: Set<string> — module-level, after URL_SHAPE_RE (L36), before MIME_BY_EXT (L37). NOT exported."
  - loop-edit: "insert deny-list `if (schemeLess) { ...; if (CODE_EXTENSIONS.has(finalLabel)) continue; }` inside `if (tok && URL_SHAPE_RE.test(tok)) {`, before `const abs = ...` (~L1396-1397)."
  - jsdoc: "rewrite the `/** PRD §2.3 ... */` block (L27-35) above URL_SHAPE_RE."

TESTS (url-injection.test.mjs):
  - add-case: "DENY-1 (new) — 'edit #main.go' → calls===0, injected===0, blocks===0, verbatim."
  - flip-case: "COL-4 (L400-411) — #node.js: calls 1→0, keep injected===0 + no-block assertions."
  - preserve: "DET-1 (#example.com → fetch), DET-2 (#https://x.com/y → fetch), NORM-1, FAIL-8 (enableUrls:false → 0 calls) — all MUST stay green."

NO CHANGE TO:
  - "URL_SHAPE_RE regex itself (gate is a post-regex filter)."
  - "URL_INJECT_RE, cleanToken, injectUrl, State, Ctx, FileDetail, injectFiles signature/return shape."
  - "file-injector.test.mjs (export allowlist — no new export, so unaffected)."
  - "README.md (P1.M3.T1.S1 owns the docs sync)."
  - "package.json / tsconfig.json / scripts/*."
```

---

## Validation Loop

### Level 1: Type-check (Immediate Feedback)

```bash
# After editing file-injector.ts: strict type-check against pi's shipped .d.ts.
npm run typecheck
# EXPECT: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# If it errors: CODE_EXTENSIONS must be typed `Set<string>` (TS will infer it from `new Set([...])`
# but the explicit annotation matches house style); ensure `continue` is inside the for-of (not the
# if), and that no symbol is accidentally exported.
```

### Level 2: TDD Red → Green (the DENY-1 proof)

```bash
# STEP A — write DENY-1 FIRST (Task 1), BEFORE the gate. Run ONLY the URL harness:
node ./url-injection.test.mjs
# EXPECT (RED): DENY-1 FAILS with "...must NOT fetch; calls=[\"https://main.go\"]". This proves the
# test is meaningful. (COL-4 still PASSES at this point — it is unchanged until Task 5.)

# STEP B — implement the gate (Tasks 2-3) + flip COL-4 (Task 5) + update JSDoc (Task 4). Re-run:
node ./url-injection.test.mjs
# EXPECT (GREEN): DENY-1 PASSES (red→green); COL-4 PASSES (flipped to calls===0); DET-1, DET-2,
# NORM-1, FAIL-8, and all others PASS. Summary "Result: N passed, 0 failed." Exit 0.
```

### Level 3: Full Regression (System Validation)

```bash
# All 4 model-free harnesses chained (the project's only test gate — no framework configured).
npm test
# EXPECT: exit 0. Runs file-injector.test.mjs && import-behavior.test.mjs &&
#         relative-imports.test.mjs && url-injection.test.mjs.
# GUARDS: file-injector.test.mjs export-allowlist (no new export -> unaffected); import-behavior +
#         relative-imports exercise the #@file path (untouched -> unaffected).
# Requires the GLOBAL pi package (each harness runs `npm root -g` to locate @earendil-works/pi-coding-agent).
```

### Level 4: Targeted Behavior Spot-Checks (optional, hermetic)

```bash
# Quick hermetic confirmation that the deny-list gates ONLY scheme-less code-ext tokens and leaves
# explicit-scheme + real-domain tokens alone. (Run ad-hoc; not part of the committed suite.)
node --input-type=module -e '
  // Reuse the harness loader by importing the real module via the same jiti path used by the suite.
  // (If that is awkward, just trust DET-1/DET-2/NORM-1/FAIL-8 in Level 2/3 — they already prove these.)
  console.log("Spot-check is covered by DET-1 (real domain fetches), DET-2 (explicit scheme fetches),");
  console.log("DENY-1 (scheme-less code-ext does NOT fetch), and FAIL-8 (enableUrls:false no fetch).");
'
```

---

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors (Level 1).
- [ ] DENY-1 went RED before the gate, GREEN after (Level 2 — TDD proof).
- [ ] `node ./url-injection.test.mjs` → exit 0, "0 failed" (Level 2).
- [ ] `npm test` → exit 0, all 4 harnesses green (Level 3).

### Feature Validation (BUG-001 specifically)

- [ ] `#main.go` → ZERO fetch + verbatim (DENY-1).
- [ ] `#node.js` → ZERO fetch + no block (flipped COL-4).
- [ ] `#example.com` → STILL fetches (DET-1 green — `com` ∉ deny-list).
- [ ] `#https://x.com/y` → STILL fetches (DET-2 green — explicit scheme bypasses deny-list).
- [ ] `enableUrls===false` → ZERO fetch (FAIL-8 green — outer gate intact).
- [ ] Prompt preserved verbatim (`r.text === "edit #main.go"`).
- [ ] JSDoc on URL_SHAPE_RE documents the deny-list and drops the `node.js`-benign claim.

### Code Quality Validation

- [ ] `CODE_EXTENSIONS` is module-level, `SCREAMING_SNAKE_CASE`, typed `Set<string>`, NOT exported.
- [ ] Loop edit is a pure insertion (the normalization/dedup/injectUrl lines are byte-for-byte unchanged).
- [ ] Deny-list check is INSIDE `if (enableUrls)` and INSIDE `if (tok && URL_SHAPE_RE.test(tok))`.
- [ ] Scheme-less test covers http/https/ftp (no explicit-scheme token is mis-gated).
- [ ] No new exports (file-injector.test.mjs export-allowlist unaffected).

### Documentation

- [ ] JSDoc on `URL_SHAPE_RE` updated (the ONLY docs change in this subtask — Mode A, rides with the code).
- [ ] README.md NOT touched (P1.M3.T1.S1).

---

## Anti-Patterns to Avoid

- ❌ Don't implement the gate before writing DENY-1 — the item contract mandates TDD (red→green). A
  test written only after the fix cannot prove it was ever failing.
- ❌ Don't skip the COL-4 flip — the gate necessarily breaks COL-4; leaving it red fails `npm test`.
- ❌ Don't edit `URL_SHAPE_RE` itself — the gate is a post-regex inline filter (per fix_strategy.md).
- ❌ Don't add the broader no-fetch matrix (notes.md, config.json, image.png, …) — that's P1.M1.T2.S1.
- ❌ Don't export `CODE_EXTENSIONS` — file-injector.test.mjs enforces a strict export allowlist.
- ❌ Don't add real gTLDs/ccTLDs (com, org, io, dev, app, …) to the deny-list — that breaks DET-1/DET-2.
- ❌ Don't hoist the deny-list outside `if (enableUrls)` — the air-gapped opt-out (FAIL-8) relies on the
  outer gate being the sole egress control; the deny-list is irrelevant when URLs are off.
- ❌ Don't test only `!/^https?:\/\//i.test(tok)` for scheme-less — that mis-gates `ftp://` tokens. Test
  http/https AND ftp (or use the combined `/^(https?|ftp):\/\//i`).
- ❌ Don't touch README.md / package.json / tsconfig.json / other harnesses in this subtask.

---

## Scope / forced adjacent change (read this — it reconciles S1 ↔ T2.S1)

**The item's OUTPUT (point 4) lists only the `file-injector.ts` edits.** Its point 3c mandates exactly
ONE new test (the `DENY-1`-equivalent `#main.go` → 0 calls). **But implementing the gate changes
`#node.js`'s behavior** (`.js` ∈ `CODE_EXTENSIONS`), and the **existing committed** `COL-4` case
asserts `#node.js` → `calls===1`. After the gate lands, `COL-4` is `calls===0` → it FAILS →
`npm test` exits 1 → S1's Level-3 validation gate is unmet.

**Resolution (directed here for one-pass success):** S1 flips `COL-4`'s assertions to `calls===0` as
the **minimal keep-green change**. This is forced by the gate, not new scope. The **broader** no-fetch
matrix (a table of `#notes.md`, `#config.json`, `#image.png`, `#main.py`, `#utils.rs`, … — the PRD's
"add a non-hermetic test that asserts NO fetch for representative `#filename.ext` prose" recommendation)
belongs to **P1.M1.T2.S1** ("Update COL-4 and add no-fetch regression tests"). If the orchestrator
runs S1 and T2.S1 sequentially, S1 leaves `COL-4` already flipped; T2.S1 then adds the matrix (and may
polish `COL-4`'s comment). No conflict — the work composes cleanly.

**Files this subtask touches:** `file-injector.ts` (3 edits), `url-injection.test.mjs` (+DENY-1, flip
COL-4). Nothing else.

---

## Confidence Score

**9/10** — One-pass success is highly likely. The contract is deterministic: the exact constant
contents (cited from two internal docs), the exact loop edit (before/after quoted verbatim from the
verified source), the exact test cases (add DENY-1 modeled on FAIL-8; flip COL-4 with the exact
assertion change), and the forced COL-4 reconciliation are all spelled out. Residual risks: (a) a
typo in the `CODE_EXTENSIONS` entries (caught by the DENY-1/COL-4 cases + the categories are
explicit); (b) mis-placing the `continue` outside the `for-of` (caught by `npm run typecheck` —
`continue` outside a loop is a TS error); (c) an implementer who skips the COL-4 flip and ships a red
`npm test` (this PRP makes the flip mandatory and explains why). All three are gated by the validation
loop.