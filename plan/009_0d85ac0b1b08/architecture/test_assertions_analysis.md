# Test Assertions Analysis — Prompt Stripping / Marker Removal

Scope: ALL assertions in the three test files that check whether the `#@`/`@` marker is
**stripped** from the prompt or left **verbatim**, plus the harness/invocation pattern and the
helper functions that back those checks. READ-ONLY scout report.

Files covered:
- `file-injector.test.mjs` (2812 lines — the primary gate)
- `relative-imports.test.mjs` (~380 lines)
- `import-behavior.test.mjs` (~210 lines)

---

## 0. The core contract the tests assert against

`injectFiles(text, imagesIn, ctx, bareAt)` (`file-injector.ts:1162`) returns:

- On **no injection** (`file-injector.ts:1228`):
  `{ text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }`
  → `text` is the ORIGINAL prompt, byte-for-byte.
- On **injection** (`file-injector.ts:1246`):
  `{ text: strippedText, images, injected, paged, blocks, details }`
  → `text` is the **STRIPPED PROMPT ONLY** (no `---`, no `<file>` blocks). Block bytes live in
  `r.blocks` (string[]) and `r.details` (FileDetail[]).

Input handler (`file-injector.ts:1306–1323`):
- `{action: "continue"}` on guards (extension-source / steer / no `#@` substring / injected===0).
- `{action: "transform", text, images}` when something is injected — `text` is the stripped prompt;
  the actual `<file>` bytes are stashed and later published by `before_agent_start` as a custom
  message `{customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true,
  details: {files}}` (case DELIV-2, `file-injector.test.mjs:2500–2525`).

This split is the load-bearing invariant every stripping assertion depends on: `r.text`/`out.text`
must contain **only the user's words with resolved tokens de-marked**, never the injected bytes.

---

## 1. file-injector.test.mjs — STRIPPED-prompt assertions (`r.text`/`out.text` without `#@`)

### 1a. Fully-stripped top-level prompt (exact equality)

| # | Line | Case | Assertion |
|---|------|------|-----------|
| 1 | `428` | Case 1 | `r.text === "Review a.ts"` — "text is the stripped prompt only (no blocks, no ---)" |
| 2 | `551` | Case 12 | `out.text === "Review a.ts"` — "handler text is the stripped prompt (blocks now live in the before_agent_start custom message)" |
| 3 | `2477` | DELIV-1 | `r.text === "Review a.ts"` — "r.text is the STRIPPED prompt (no blocks)" |
| 4 | `2500` | DELIV-2 | `out.text === "Review a.ts"` — "input text is stripped (blocks leave the user message)" |

DELIV-1 also pins the **negative** half of the contract (`file-injector.test.mjs:2478–2479`):
- `!r.text.includes("---")` — must NOT contain the old `---` separator.
- `!r.text.includes("<file")` — must NOT contain any `<file>` block (bytes live in `r.blocks`).

### 1b. Top-level marker stripped — `startsWith` (the path stays, `#@` removed)

These assert that the top-level `#@<file>` marker is replaced by the bare path/filename.

| Line | Case | Assertion |
|------|------|-----------|
| `996` | U1(c) | `r.text.startsWith("Review a.ts")` — "#@ trigger stripped on successful inject" |
| `1092` | PD1 | `r.text.startsWith("Summarize huge.log")` — "#@huge.log must be stripped to huge.log (path stays)" |
| `1638` | Case 15 | `r.text.startsWith("Review notes.md")` — "top-level #@notes.md marker stripped to notes.md" |
| `1670` | CRLF-E2E | `r.text.startsWith("Read crlf_spec.md")` — "top-level #@crlf_spec.md marker stripped to crlf_spec.md" |
| `1705` | Case 19 | `r.text.startsWith("Read sub/notes.md")` — "top-level #@sub/notes.md marker stripped to sub/notes.md" |
| `1785` | MD2 | `r.text.startsWith("Read sub/outsider.md")` — "top-level #@sub/outsider.md marker stripped to sub/outsider.md" |
| `1882` | Case 21 | `r.text.startsWith("Review notesShorthand.md")` |
| `1897` | Case 22 | `r.text.startsWith("Review notesExactWins.md")` |
| `1915` | Case 23 | `r.text.startsWith("Read sub/ext/notes.md")` |
| `1771` | MD1 | `r.text.startsWith("Review notesMissing.md")` — (the missing *import* is still verbatim, but the top-level marker is stripped) |
| `1941` | EDG-1 | `r.text.startsWith("Review notesGhost.md")` |
| `1954` | EDG-2 | `r.text.startsWith("Review notesAbsent.md")` |
| `1968` | EDG-3 | `r.text.startsWith("Review notesDedup.md")` |
| `1986` | EDG-4 | `r.text.startsWith("Read notesSubPrefix.md")` |

**Count: 14 `startsWith` strip checks + 4 exact-equality + 2 negative (`---`/`<file`) = 20 top-level
stripped-prompt assertions.**

### 1c. PARTIAL strip — injected token stripped, a second token kept verbatim

These are the crucial "Issue 2" regression guards: only **actually-injected** tokens lose `#@`;
failed/ghost/absent/deduped tokens keep `#@` in the SAME prompt.

| Line | Case | Assertion | What stays verbatim |
|------|------|-----------|---------------------|
| `899` | F2 | `r.text.startsWith('<!--#@file-injected--> Review a.ts')` | the sentinel-string token `<!--#@file-injected-->` keeps `#@`; only `#@a.ts` is stripped |
| `915` | FS1 | `r.text.startsWith("Review a.ts")` | `#@missing.ts` |
| `916` | FS1 | `r.text.includes("#@missing.ts") === true` | "the FAILED #@missing.ts must keep its #@ verbatim (PRD §6.2)" |
| `924` | FS2 | `r.text.startsWith("Review a.ts")` | `#@src/` (directory) |
| `925` | FS2 | `r.text.includes("#@src/") === true` | "the directory token #@src/ must keep its #@ verbatim (PRD §6.2)" |
| `933` | FS3 | `r.text.startsWith("Compare a.ts with #@a.ts")` | "first stripped, deduped second keeps #@ (Issue 2)" |

---

## 2. file-injector.test.mjs — VERBATIM-prompt assertions (no stripping happened)

These pin the "nothing injected → prompt unchanged" half of the contract.

| Line | Case | Assertion | Why verbatim |
|------|------|-----------|--------------|
| `481` | Case 5 | `r.text === "Fix #@nope.ts"` | missing file |
| `489` | Case 6 | `r.text === "List #@src/"` | directory (not isFile) |
| `496` | Case 7 | `r.text === "the foo#@bar thing"` | mid-word `#@` not matched |
| `503` | Case 8 | `r.text === "# Heading and #1234"` | no `#@` substring |
| `588` | Case 14 | `r.text === "Review @a.ts"` | bare `@` (no `#`) — byte-for-byte unchanged |
| `628` | E3 | `r.text === "\`code #@a.ts\`"` | fenced trailing backtick not trimmed |
| `643` | E4 | `r.text === "Read #@secret.txt"` | unreadable (chmod 000) |
| `988` | U1(a) | `r.text === "café#@a.ts"` | Unicode letter mid-word (é) |
| `992` | U1(b) | `r.text === "日本語#@a.ts"` | CJK mid-word |
| `1005` | U1(e) | `r.text === "foo#@bar"` | ASCII mid-word still blocked |
| `1932` | Case 24 | `r.text === "See #@specdoc"` | top-level exact-only (no `.md` fallback at the prompt) |
| `2013` | ISS1-TL | `r.text === "Compare #@iss1_report.md.backup with the latest"` | extended token `.backup` exact-only (no `.md` truncation) |
| `2416` | Case 28 | `r.text === "Read @other.md"` | top-level bare-@ never injected (top-level is `#@`-only) |

**Count: 13 verbatim-prompt assertions.**

---

## 3. file-injector.test.mjs — Markdown block content where markers were STRIPPED

When a `#@import` inside a delivered `.md` resolves, the marker is replaced by the bare path **inside
the injected `<file>` block** (in `r.blocks`). These are the `hasBlock(...)` / `!hasBlock(...)`
pairs (the positive asserts the stripped form; the negative asserts the `#@` form is gone).

| Lines | Case | Stripped-form assertion | Negative (no `#@`) assertion |
|-------|------|------------------------|------------------------------|
| `1644–1645` | Case 15 | `hasBlock(r, "Imports api.md here.")` | `!hasBlock(r, "Imports #@api.md here.")` |
| `1674–1675` | CRLF-E2E | `hasBlock(r, "See crlf_after.md")` | `!hasBlock(r, "See #@crlf_after.md")` |
| `1714–1715` | Case 19 | `hasBlock(r, "See api.md.")` | `!hasBlock(r, "See #@api.md.")` |
| `1752–1753` | Case 20 | `r.blocks[iB].includes("Logs: huge.log")` | `!r.blocks[iB].includes("#@")` — **block must contain NO `#@` markers at all** |
| `1795–1796` | MD2 | `hasBlock(r, "See ../shared/api.md here.")` | `!hasBlock(r, "#@../shared/api.md")` |
| `1885–1886` | Case 21 | `hasBlock(r, "Imports api here.")` | `!hasBlock(r, "Imports #@api here.")` |
| `1909–1910` | Case 22 | `hasBlock(r, "Refs guide here.")` | `!hasBlock(r, "Refs #@guide here.")` |
| `1924–1925` | Case 23 | `hasBlock(r, "See api here.")` | `!hasBlock(r, "See #@api here.")` |
| `2017–2018` | EDG-4 | `hasBlock(r, "See sub/notes here.")` | `!hasBlock(r, "See #@sub/notes here.")` |
| `2428–2430` | Case 26 | `hasBlock(r, "Refs api.md here.")` + `!hasBlock(r, "Refs pi.md here.")` (+2 bug guard) | `!hasBlock(r, "Refs @api.md here.")` — prefixLen-1 strip removes only `@` |
| `2435–2436` | Case 27 | `hasBlock(r, "Imports api.md here.")` | `!hasBlock(r, "Imports #@api.md here.")` |
| `2475–2476` | M2.T2.S1-g | `hasBlock(r, "Refs api.md and @api.md.")` | `!hasBlock(r, "Refs #@api.md")` |
| `1991–1992` | EDG-3 | `hasBlock(r, "Imports: specdoc and #@specdoc.md")` | `!hasBlock(r, "Imports: #@specdoc and")` — first dedup-wins marker stripped, second verbatim |

**Count: ~13 stripped-block pairs (26 individual asserts).**

---

## 4. file-injector.test.mjs — Markdown block content where markers were LEFT VERBATIM

These pin that a marker that should NOT be stripped keeps its `#@`/`@` inside the block.

| Line | Case | Assertion | Why verbatim |
|------|------|-----------|--------------|
| `668` | E5 | `hasBlock(r, "#@perm_api.md") === true` | unreadable markdown import (PRD §5.4/§12.5) |
| `1652` | Case 16 | `hasBlock(r, "#@example.ts")` | fenced code block → code-exempt (§5.6.1) |
| `1689` | Case 17 | `hasBlock(r, "Back #@a.md.")` | deduped cycle (a.md already claimed before b.md scanned it) |
| `1697` | Case 18 | `hasBlock(r, "#@/etc/hosts")` | absolute import ignored (markdown relative-only) |
| `1774–1775` | MD1 | `hasBlock(r, "Refs #@ghost.md here.")` + `!hasBlock(r, "Refs ghost.md here.")` | missing import target (§10 fix) |
| `1962–1963` | EDG-1 | `hasBlock(r, "Refs #@ghost here.")` + `!hasBlock(r, "Refs ghost here.")` | no-match extensionless shorthand |
| `1976–1977` | EDG-2 | `hasBlock(r, "Refs #@absent.md here.")` + `!hasBlock(r, "Refs absent.md here.")` | missing already-extended token (exact-only) |
| `2035` | ISS1-MD | `hasBlock(r, "See #@iss1_report.md.backup here.")` | missing extended token `.backup` (no `.md` truncation) |
| `2421` | Case 25 | `hasBlock(r, "Refs @api.md here.")` | bareAt off → bare-@ not scanned |
| `2438` | Case 27 | `hasBlock(r, "#@example.ts")` | fenced code-exempt even with bareAt on |
| `2460` | M2.T2.S1-e | `hasBlock(r, "Contact user@host.com.")` | mid-word `@` (BARE_AT_RE word-char lookbehind) |
| `2468` | M2.T2.S1-f | `hasBlock(r, "Ping @username now.")` | unresolved `@` mention (no username.md) |

**Count: ~12 verbatim-block assertions.**

---

## 5. relative-imports.test.mjs & import-behavior.test.mjs — marker expectations

These two suites focus on **resolution correctness** (file-relative vs cwd-relative) and check
markers via the `has()`/`hasBlock()` helper on **joined block content**. They do NOT assert on
`r.text` (the stripped prompt) — `relative-imports.test.mjs` even defines `blocksText` but never
reads `out.text`. The marker-relevant assertions:

### relative-imports.test.mjs

- **C9** (`relative-imports.test.mjs:344`): `has(blocksText(out), "#@ghost.md")` — "the missing
  relative-import marker must be left VERBATIM" + `!has(blocksText(out), "GHOST-ROOT")` (no cwd
  fallback). This is the only explicit marker-retention assertion; the rest (C1–C8, C10–C12, D1–D7,
  E1–E3) assert on **content markers** like `"B-FILE-RELATIVE"`, `"B-MARKER"` to prove the correct
  *file* was injected, not marker stripping.
- The header comment (`relative-imports.test.mjs:11`) codifies the rule: absolute/tilde imports
  inside a markdown "are ignored and left verbatim — markdown is relative-only" (this is what
  file-injector.test.mjs Case 18 pins at `:1697`).

### import-behavior.test.mjs

Uses `has(out, marker)` where `out.blocks.join("\n\n")` is searched (helper at
`import-behavior.test.mjs:~49`). Marker-relevant assertions:

- **4f** (`import-behavior.test.mjs:194`): `has(o, "@weird.md.bak")` — "the literal @weird.md.bak
  reference must be left VERBATIM in a.md's block" (extended token `.bak` exact-only, only
  weird.md exists → NOT truncated, NOT stripped). Also `!has(o, "MD-MARKER")`.
- **4h** (`import-behavior.test.mjs:205`): `has(o, "@api.md.old")` — "the literal @api.md.old
  reference must be left VERBATIM" (`.old` exact-only).
- **2c / 5f**: `!has(o, "B-MARKER")` and `!has(o, "C-MARKER")` — with `markdownBareAtImports` OFF,
  bare `@` must be inert (content absent). These verify non-injection, not stripping per se.

---

## 6. Helper functions

### file-injector.test.mjs (`:188–205`)

```js
function blocksText(r) { return r.blocks.join("\n\n"); }                 // join block array
function hasBlock(r, needle) { return r.blocks.some((b) => b.includes(needle)); }
function countFileBlocks(text, abs) {
  // counts '<file name="ABS">' openers in `text`, regex-escaping abs
  return (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
}
```

- `blocksText` is the bridge to the P1.M2.T2.S1 return shape: since `r.text` no longer carries the
  blocks, content checks operate on `r.blocks.join("\n\n")`.
- `hasBlock` searches **each block independently** (so a needle that spans two blocks won't match —
  relevant if a future change splits content across blocks).
- `countFileBlocks` is the dedup/parity counter (escaped regex, global match).

### relative-imports.test.mjs (`:71–80`)

```js
const has = (text, marker) => (text ?? "").includes(marker);
const blocksRel = (text, root) =>
  [...(text ?? "").matchAll(/<file name="([^"]+)">/g)].map((m) => path.relative(root, m[1]));
const countAbs = (text, abs) =>
  (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
const blocksText = (r) => (r?.blocks ?? []).join("\n\n");
```

- `has` is a null-safe `includes`.
- `blocksRel` extracts every `<file name="ABS">` path **relative to root** — makes assertions read
  as cwd-relative strings (e.g. `["imp1.md", "imp2.md"]`), the key tool for file-relative-vs-cwd
  disambiguation.
- `countAbs` mirrors `countFileBlocks` in the main suite.
- `blocksText` is the local equivalent of the main suite's join.

### import-behavior.test.mjs (`:~48–50`)

```js
const has = (out, marker) => (out.blocks ?? []).join("\n\n").includes(marker);
```

- A one-liner that joins `out.blocks` then `includes` — same effect as the other suites' `has` +
  `blocksText` combined.

---

## 7. Harness pattern — how tests invoke the extension

Two complementary invocation modes, both used heavily:

### Mode A — Direct pipeline call (`mod.injectFiles`)

```js
const r = await mod.injectFiles(prompt, imagesIn, ctx, bareAt);
// r = { text, images, injected, paged, blocks, details }
```

- `ctx` is a plain mock: `{ cwd, hasUI, isProjectTrusted, ui: { notify }, getContextUsage?, model? }`
  (see `makeMockCtx` `:170–178`, `ctxFor` in the other suites).
- `bareAt` (4th arg) is OPTIONAL — defaults `false`. Direct callers pass `true` to exercise the
  bare-@ engine without going through config.
- `FIX` = `{ cwd: TMPDIR }` (no budget → O-1 fallback → all whole). `PAGED_FIX` / `TINY_FIX` add a
  `getContextUsage` + `model` to trip the page threshold.
- This is what the bulk of Cases 1–28, EDG-x, FS1–3, U1, PD1–8, E1–E6, F1–F5, DUP1–3, MD1/MD2,
  ISS1-TL/MD use.

### Mode B — Handler capture (`mod.default(pi)` + manual callback drive)

```js
function captureHandler(event = "input") {
  const cbs = [];
  const pi = { on: (ev, cb) => { if (ev === event) cbs.push(cb); },
               registerMessageRenderer: () => {} };
  mod.default(pi);                 // registers handlers into cbs
  return { cb: cbs[cbs.length - 1], all: cbs };
}
function captureAllHandlers() { /* captures input + session_start + before_agent_start */ }
```

Then drive the captured callbacks:
```js
const { ctx, rec } = makeMockCtx(TMPDIR);
const h = captureAllHandlers();
const out = await h.input[0]({ text, source: "interactive", images: [] }, ctx);   // → {action, text, images}
const msg = await h.before_agent_start[0]({}, ctx);                                // → {message: {customType, content, display, details}}
// session_start must be driven FIRST when a project config matters (D5/D6):
for (const cb of (cbs.session_start ?? [])) await cb({}, { cwd, isProjectTrusted: () => true });
```

- **CRITICAL**: `captureAllHandlers()` calls `mod.default(pi)` ONCE so `input` + `before_agent_start`
  share the SAME factory closure (the `pending` stash handoff — case DELIV-3 pins the one-shot
  read-and-clear semantics). `captureHandler` is the legacy single-event variant (`.cb` = last handler).
- Handler return contract: `{action: "continue"}` (guards / nothing injected) or
  `{action: "transform", text, images}` (injected). The stripped `text` lives in `out.text`; the
  block bytes are in the `before_agent_start` custom message `msg.message.content`.
- `registerMessageRenderer` is stubbed as a no-op (tests don't render; the real renderer is
  `mod.renderInjectedMessage`, exercised by the REND-x cases).
- Used by Cases 9, 12, 14, G1–G3, H1, F2, F4, A1, PN1–PN4, DELIV-2/3, and the handler-driven
  relative/import-behavior cases (`runViaHandler`, `runHandler`).

### Loading mechanism (shared by all three suites)

The `.ts` is loaded via jiti from the **global** pi package (`npm root -g`), with the same alias map
Pi's extension loader uses — so the tests run against the REAL committed `file-injector.ts`
(`:39–66`):
```js
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, { alias: { "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js", ... } });
const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));
```

---

## 8. Summary counts

| Category | file-injector.test.mjs | relative-imports | import-behavior |
|----------|------------------------|------------------|-----------------|
| Stripped prompt (`r.text`/`out.text` exact) | 4 | 0 | 0 |
| Stripped prompt (`r.text`/`out.text` `startsWith`) | 14 | 0 | 0 |
| Negative shape (`!includes("---")` / `!includes("<file")`) | 2 | 0 | 0 |
| Partial strip (stripped + verbatim in same prompt) | 6 (across F2/FS1/FS2/FS3) | 0 | 0 |
| Verbatim prompt (`r.text === input`) | 13 | 0 | 0 |
| Stripped import marker inside block (hasBlock + !hasBlock pair) | ~13 pairs (26 asserts) | 0 | 0 |
| Verbatim import marker inside block | ~12 | 1 (C9 `#@ghost.md`) | 2 (`@weird.md.bak`, `@api.md.old`) |
| **Total stripping/marker assertions** | **~78** | **1** | **2** |

---

## 9. Start Here / implications for a marker-stripping change

- **First file to open**: `file-injector.test.mjs` — the matrix at `:425–650` (Cases 1–14) defines the
  canonical stripped/verbatim contract; Cases 15–28 (`:1634–2440`) extend it to markdown imports.
- Any change to the **stripping logic** (where `#@`/`@` is removed from the prompt or from a
  markdown body) must keep:
  1. `r.text`/`out.text` stripped-only, no `---`, no `<file>` (Cases 1, 12, DELIV-1, DELIV-2).
  2. **Failed/ghost/deduped/code-exempt/absolute/unreadable tokens keep `#@`** in BOTH `r.text`
     (FS1/FS2/FS3/F2) AND inside blocks (Case 16/17/18, MD1, EDG-1/2, E5, M2.T2.S1-e/f, ISS1-MD).
  3. The partial-strip asymmetry (Issue 2): only **injected** tokens are stripped (FS3's
     "first stripped, deduped second keeps `#@`" is the sharpest guard).
  4. The prefixLen-1 vs prefixLen-2 strip distinction for bare-@ (Case 26's `!hasBlock("Refs pi.md
     here.")` is the +2-bug fingerprint guard).
- The `r.text` vs `r.blocks` split is **not optional**: `hasBlock`/`blocksText`/`has` all read
  `r.blocks`; `r.text` is checked separately and must never contain block bytes.

## 10. Residual risks / open questions

- The suites assert `r.text.startsWith(...)` rather than exact equality for most markdown-import
  cases — a change that appends unexpected trailing text to `r.text` (while preserving the prefix)
  would NOT be caught. Only Cases 1/5/6/7/8/12/14/E3/E4/U1(a,b,e)/24/ISS1-TL/28/DELIV-1/DELIV-2 use
  exact equality.
- `relative-imports.test.mjs` and `import-behavior.test.mjs` never assert on `r.text` at all — they
  only check block content via `has`. If the prompt-stripping layer regressed but block content
  stayed correct, those two suites would not catch it. The main suite carries the entire
  stripped-prompt burden.
- Tests rely on the **global** pi package being installed (`npm root -g`) and jiti resolving from
  inside it — an environment without the global package cannot run ANY of these tests (they throw at
  module load, `:28–37`).