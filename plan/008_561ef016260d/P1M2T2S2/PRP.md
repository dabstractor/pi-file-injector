---
name: "P1.M2.T2.S2 (plan/008) — Renderer output + defensive fallback tests (10 new runCase blocks in file-injector.test.mjs pinning renderInjectedMessage for each file kind, expanded/collapsed, defensive fallback, tildify, and color parity — the PRD §11 #33-38 display cases)"
prd_ref: "PRD §6.3 (Chat display — the MessageRenderer: green toolSuccessBg Box, one read-line per file, expandable), §12.23 (renderer must be defensive, never throw), §12.24 (green choice is deliberate: toolSuccessBg/toolTitle+bold/accent/dim), §12.25 (tildify path display; ctrl+o hardcoded), §11 #33-38 (display test matrix: single/multi/image/binary/paged/color-parity)"
target_file: "./file-injector.test.mjs"   # ADD 10 new runCase blocks (REND-1..REND-10) under a banner BEFORE the Summary block. NO .ts change, NO harness change, NO new fixtures/helpers.
target_language: JavaScript (.mjs test harness, zero-deps, loaded via Pi's jiti); gate = `node ./file-injector.test.mjs` (0 failed; my 10 pass; no existing regression)
depends_on: "P1.M1.T2.S2 (renderInjectedMessage EXPORTED — LANDED, file-injector.ts:627; Box/Text imported from @earendil-works/pi-tui) + the test-harness pi-tui jiti alias (ALREADY present at file-injector.test.mjs:63 — the suite loads the renderer fine: 134 passed, 0 failed as of this writing). P1.M2.T2.S1 (sibling — DELIV-1..6 delivery/stash tests) is LANDED in the same file; my REND- prefix does NOT collide."
consumed_by: "P1.M2.T3.S1 (README Mode B sync). Nothing depends on these test cases at runtime; they are a regression gate for the renderer."
---

# PRP — P1.M2.T2.S2 (plan/008): Renderer output + defensive fallback tests

> **Scope flag:** This is a **test-addition** task. The code under test is **already landed and exported**
> (`renderInjectedMessage`, file-injector.ts:627). I add **10 new `runCase` blocks** to
> `file-injector.test.mjs` that pin the renderer's **display output** (PRD §6.3): one green `read <path>`
> line per file, per-kind suffixes (paged range / image hint / binary note), expanded-vs-collapsed
> child counts, the **defensive fallback** (never throws on malformed/old entries), **tildify**, and
> **color parity** with the `read` tool. **No `.ts` change, no harness change, no new fixtures/helpers.**
> The tests call `mod.renderInjectedMessage` **directly** with hand-crafted `message` objects — no file
> I/O, no hooks, no `captureAllHandlers`/`makeMockCtx`/`FIX`. The sibling P1.M2.T2.S1 owns the
> `DELIV-1`..`DELIV-6` delivery/stash cases; I use the **`REND-`** prefix → zero collision.

---

## Goal

**Feature Goal:** Pin the renderer's display contract (PRD §6.3 / §11 #33-38 / §12.23-25) as runnable
regression cases, so a future change to `renderInjectedMessage` that breaks the per-kind line text, the
expanded/collapsed child structure, the defensive fallback, tildify, or the theme-key (green/color)
discipline is caught deterministically.

**Deliverable:** 10 new `runCase` blocks in `file-injector.test.mjs` under a
`// ── P1.M2.T2.S2 (plan/008): renderer output + defensive fallback ──` banner (`REND-1`…`REND-10`),
placed BEFORE the `// 10. Summary + cleanup + exit.` block (L2510). No other file is touched.

**Success Definition:**
1. `node ./file-injector.test.mjs` → **0 failed**, exit 0; the 10 `REND` cases print ✓; no existing case
   regresses (current baseline 134 passed → 144 after my 10).
2. `REND-1` (collapsed single): `renderInjectedMessage({details:{files:[{path,kind:"text"}]},content}, {expanded:false}, stubTheme)` returns a Box whose `children.length >= 1` and whose `children[0]` rendered text includes `"read"` and the path.
3. `REND-2` (collapsed multi): two files → `children.length === 2`; `children[0]` has the `(ctrl+o to expand)` hint, `children[1]` is a `read` line WITHOUT the hint (hint shown once per box).
4. `REND-3` (paged): `kind:"paged"` + `range:":5-"` → `children[0]` text includes `":5-"` (the range suffix mirrors the read tool).
5. `REND-4` (image): `kind:"image"` + `dimensionHint:"(resized to WxH)"` → `children[0]` text includes the hint.
6. `REND-5` (binary): `kind:"binary"` → `children[0]` text includes `"(binary — not injected)"`.
7. `REND-6` (expanded): `{expanded:true}` for a text file → `children.length` is GREATER than the collapsed case AND a body child renders the file content (plain text, no ANSI).
8. `REND-7` (image not re-rendered): `{expanded:true}` + `kind:"image"` → `children.length === 1` (NO body child — images attach to the user message, not the renderer; §6.4).
9. `REND-8` (defensive fallback): `{details:{}}` (no files array) AND `{content:"…"}` (no details) → no throw; returns a Box with `children.length === 1` whose `children[0]` text is exactly `"read (injected files) (ctrl+o to expand)"` (after trim).
10. `REND-9` (tildify): a path under `os.homedir()` → `children[0]` text starts with `"read ~"` (leading homedir → `~`).
11. `REND-10` (color parity): a SPY theme records that `theme.bg` is called with `"toolSuccessBg"` (after `box.render(80)`), `theme.fg` is called with `"toolTitle"`, `"accent"`, and `"dim"`, and `theme.bold` is called with `"read"` — pinning §11 #38 / §12.24 (the green/read-tool color recipe).
12. `git diff --stat file-injector.ts` is **EMPTY** (the code is landed; tests only).

## User Persona

**Target User:** The developer/CI running `node ./file-injector.test.mjs` — and a future refactorer of
the renderer (e.g. someone tempted to change the theme keys, drop the defensive guard, re-render images,
or alter the per-kind line format).

**Use Case:** `git pull && node ./file-injector.test.mjs` → green, with explicit cases proving: the
renderer draws one green `read <path>` line per file; paged/image/binary get their right suffixes;
expanded view adds the body (but not for images); malformed entries fall back to a single
`read (injected files)` line without throwing; homedir paths tildify; and the exact theme keys that make
it look like the `read` tool are used.

**Pain Points Addressed:** The renderer is the user-visible face of `#@` (PRD §6.3) and the riskiest
display code — it replicates the `read` tool's look using private-ish TUI components (Box/Text), re-parses
`<file>` blocks from `content`, and must NEVER throw (§12.23). No existing case exercises it: the suite
asserts `typeof mod.renderInjectedMessage === "function"` (L133) but never CALLS it. These 10 cases close
that gap and pin every behavior the PRD §6.3/§11 #33-38/§12.23-25 spec mandates.

## Why

- **The renderer is landed but untested at the call level.** P1.M1.T2.S2 shipped `renderInjectedMessage`
  and verified it only via a confidence-only runtime probe (see its `issue_feedback.md`). The suite has a
  `typeof` guard but zero invocations. A regression that swaps `toolSuccessBg`→`customMessageBg` (purple),
  drops the `bodies[i] !== undefined` guard, re-renders images, or breaks the per-kind suffix would ship
  silently. These cases make the probe permanent and runnable.
- **The defensive fallback is a hard PRD requirement (§12.23).** "A thrown renderer is caught by
  `CustomMessageComponent` → Pi's default purple box — acceptable but not the goal." The renderer MUST
  tolerate `{details:{}}`, `{content:"…"}` with no `details`, missing `files`, etc. `REND-8` pins the two
  exact malformed shapes the item specifies and asserts no-throw + the single fallback line.
- **Per-kind line format is spec-driven (§6.3 / §11 #35-37).** Paged shows the range suffix; image shows
  `dimensionHint`; binary shows `(binary — not injected)`. Each is a one-liner in the renderer
  (`readLine`, file-injector.ts:669) that is trivial to break and trivial to pin (`REND-3/4/5`).
- **Color parity is the whole point (§11 #38 / §12.24).** The user's explicit model is "exactly like the
  `read` tool." `REND-10` uses a spy theme to prove the renderer calls the SAME theme keys the read tool
  uses (`toolSuccessBg`, `toolTitle`+bold, `accent`, `dim`) — not the purple skill keys.
- **Decoupled from the sibling delivery tests.** P1.M2.T2.S1 pins DELIVERY (the data + the stash via
  `injectFiles`/`captureAllHandlers`); this task pins DISPLAY (the green box via `renderInjectedMessage`
  direct). The custom message's `details` field is the handshake; S1 pins its shape, S2 pins how the
  renderer consumes it.

## What

No user-visible / API / logic change. **Test additions only.** 10 new `runCase` blocks exercising
`mod.renderInjectedMessage` directly with hand-crafted `message` objects (no file I/O, no hooks).

No new fixtures (no `FIX`/`A_TS` — messages are crafted inline). No new helpers (reuse
`runCase`/`assert`; define ONE tiny local `textOf`/`stubTheme` inside the banner — see blueprint). No
harness change (the pi-tui jiti alias at L63 already resolves). No `.ts` change.

### Success Criteria

- [ ] 10 new cases (`REND-1`…`REND-10`) present under a `P1.M2.T2.S2 (plan/008)` banner, BEFORE the Summary block (L2510).
- [ ] REND-1: collapsed single text → `children.length >= 1`; `textOf(children[0])` includes `"read"` and the path.
- [ ] REND-2: collapsed multi (2 files) → `children.length === 2`; [0] includes `(ctrl+o to expand)`, [1] does NOT.
- [ ] REND-3: paged → `textOf(children[0])` includes the range suffix (`":5-"`).
- [ ] REND-4: image → `textOf(children[0])` includes the `dimensionHint`.
- [ ] REND-5: binary → `textOf(children[0])` includes `"(binary — not injected)"`.
- [ ] REND-6: expanded text → `expanded.children.length > collapsed.children.length` AND the body child's text includes the file content (plain, no ANSI).
- [ ] REND-7: expanded image → `children.length === 1` (no body child).
- [ ] REND-8: `{details:{}}` AND `{content:"…"}` (no details) → no throw; `children.length === 1`; `textOf(children[0]).trim() === "read (injected files) (ctrl+o to expand)"`.
- [ ] REND-9: homedir path → `textOf(children[0])` starts with `"read ~"`.
- [ ] REND-10: spy theme → `bg` called with `"toolSuccessBg"` (after `box.render(80)`); `fg` called with `"toolTitle"`, `"accent"`, `"dim"`; `bold` called with `"read"`.
- [ ] `node ./file-injector.test.mjs` → **0 failed**, exit 0; no existing case regresses.
- [ ] `git diff --stat file-injector.ts` is **EMPTY**; `git diff --stat` touches ONLY `file-injector.test.mjs`.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_
**Yes.** This PRP includes: the EXACT function signature + behavior of the landed renderer
(file-injector.ts:627-700, quoted), the CRITICAL test-seam facts grounded in pi-tui SOURCE
(`Box.children` is public (box.d.ts); `Text.text` is private → use `Text.render(width): string[]`
(text.js), and with the renderer's `new Text(s,0,0)` padding=0 there are NO margins/empty lines, just
content right-padded to `width`), the verified `stubTheme`, the EMPIRICAL probe results (exact
`children.length` + exact `children[0]` text for all 10 cases — see the table below; highlightCode
returns PLAIN text, no ANSI), the spy-theme color-parity technique (readLine calls fg/bold during
construction; box.render triggers bg), the exact harness reuse (`runCase` L90, `assert` L88, `os`
already imported L25, `mod` L72), the insertion point (banner before L2510 Summary), the no-collision
note (REND- vs sibling DELIV-), and the gate. The implementer adds a banner + 10 `runCase` blocks and
runs one command.

### Documentation & References

```yaml
# MUST READ — the display contract this task pins
- file: PRD.md
  why: "§6.3 'Chat display' is the full renderer spec: green toolSuccessBg Box; collapsed = one `read <path><range/hint>` line per file
        (read = toolTitle+bold; path = accent; range = ':<startLine>-' for paged; image appends dimensionHint; binary reads
        '(binary — not injected)'); expand hint '(ctrl+o to expand)' shown ONCE per box (i===0); expanded = full/highlighted content
        below each read line; images NOT re-rendered; tildify homedir→~. §12.23 = defensive (never throw, fallback 'read (injected files)');
        §12.24 = green choice deliberate (toolSuccessBg/toolTitle+bold/accent/dim, NOT purple customMessageBg); §12.25 = tildify + ctrl+o hardcoded.
        §11 #33-38 = the display test matrix (single/multi/image/binary/paged/color-parity)."
  section: "§6.3 (Chat display) + §12.23/§12.24/§12.25 + §11 #33-38"

# MUST READ — the landed renderer I'm testing (read-only; the contract)
- file: file-injector.ts
  why: "L605 FILE_BLOCK_RE = /<file name=\"([^\"]+)\">([\s\S]*?)<\/file>/g (re-parses bodies from message.content — so test content MUST match this format).
        L627 renderInjectedMessage(message, opts:{expanded}, theme):Component — EXPORTED. Reads message?.details?.files ?? [] (defensive);
        re-derives bodies[] from content via FILE_BLOCK_RE (one per BLOCK; paged file emits 2 blocks → bodies has 2 entries but files has 1,
        so bodies[i] for a paged file = its HEAD body). Builds Box(1,1, t=>theme.bg('toolSuccessBg',t)). files.length===0 → fallback
        (1 Text 'read (injected files)' + expandHint; if expanded && content is string → +1 Text raw content). else per file i:
        addChild(Text(readLine(d,theme) + (i===0?expandHint:''))); if expanded && bodies[i]!==undefined && d.kind!=='image' → addChild(Text(theme.fg('toolOutput', lang?highlightCode(body,lang).join('\\n'):body))).
        L669 readLine: toolTitle+bold('read')+' '+accent(tildify(path)) + kind suffix (binary→dim('(binary — not injected)'); image→ dim(dimensionHint)?; paged→warning(range)?; text→nothing).
        L685 expandHint = ' '+dim('(ctrl+o to expand)'). L690 tildify = leading os.homedir()+'/' → '~'."
  pattern: "renderInjectedMessage is a PURE function of (message, opts, theme) — no I/O, no hooks. Tests call it DIRECTLY with crafted messages.
            The Box it returns has a PUBLIC .children: Component[] (inspect children[i] directly; do NOT call box.render unless asserting bg)."
  critical: "highlightCode is the REAL imported function. EMPIRICALLY (probed) it returns PLAIN text — the expanded .ts body has NO ANSI codes —
             so body-content includes-checks are safe. (If a future Pi version makes highlightCode emit ANSI, REND-6's includes-check on the body
             is the canary; the children.length>check is the robust primary assertion.)"

# The pi-tui test seam (grounded in SOURCE — the non-obvious part)
- file: node_modules/@earendil-works/pi-tui/dist/components/box.d.ts  (resolved via the jiti alias at file-injector.test.mjs:63)
  why: "class Box { children: Component[] (PUBLIC); addChild(c); … }. So box.children[i] is the i-th child (each a Text); box.children.length = line count."
  pattern: "Inspect box.children directly. Do NOT call box.render() for content checks (it applies the Box bgFn + padding and is width-dependent)."
- file: node_modules/@earendil-works/pi-tui/dist/components/text.d.ts + text.js
  why: "class Text { private text; render(width): string[] (PUBLIC). text is PRIVATE → access via render(width). The renderer constructs new Text(s,0,0)
        (paddingX=0, paddingY=0) so render(width) = content wrapped to width, NO margins, NO empty padding lines, right-padded with spaces to width."
  pattern: "textOf(child) = child.render(2000).join('\\n'). Use a GENEROUS width (2000) so nothing wraps. .includes() ignores trailing pad; .trim() for exact/startsWith."

# The file you edit (the ONLY change) — add 10 cases; reuse runCase/assert; one tiny local stubTheme/textOf under the banner
- file: file-injector.test.mjs
  why: "runCase L90 (REUSE); assert L88 (REUSE); os imported L25 (REUSE for os.homedir() in REND-9); mod L72 (mod.renderInjectedMessage is the function under test).
        The pi-tui jiti alias is ALREADY at L63 (NO harness change needed — the suite loads the renderer: 134 passed). Insert the banner + 10 runCase blocks
        BEFORE the '// 10. Summary + cleanup + exit.' block at L2510 (after the DELIV-6 case ending ~L2508)."
  pattern: "Each case: const box = mod.renderInjectedMessage(craftedMessage, {expanded}, stubTheme); then assert on box.children.length and textOf(box.children[i]).
            The message is crafted inline: { details:{files:[FileDetail,…]}, content:'<file name=\"…\">\\n…\\n</file>' }. content MUST match FILE_BLOCK_RE."
  gotcha: "Case-ID collision: sibling P1.M2.T2.S1 owns DELIV-1..DELIV-6 (delivery/stash, in the same file). Use REND-1..REND-10 (different prefix, different function)."

# The sibling task — NO collision (it tests DIFFERENT functions via DIFFERENT helpers)
- file: plan/008_561ef016260d/P1M2T2S1/PRP.md
  why: "P1.M2.T2.S1 owns DELIV-1..DELIV-6 (injectFiles return shape + before_agent_start custom message + the pending stash, via captureAllHandlers/makeMockCtx/FIX).
        My REND-1..REND-10 test renderInjectedMessage DIRECTLY (no captureAllHandlers, no makeMockCtx, no FIX, no hooks). Zero file overlap beyond co-residence."

# The predecessor that LANDED the renderer (read-only context — its issue_feedback documents the probe)
- file: plan/008_561ef016260d/P1M1T2S2/issue_feedback.md
  why: "Documents that renderInjectedMessage is EXPORTED + working + that scripts/typecheck.mjs got a pi-tui paths entry (DONE). Notes the jiti test-harness
        pi-tui alias is what makes the renderer loadable from the .mjs — confirmed present at file-injector.test.mjs:63. My task needs NO further harness/jiti change."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.test.mjs    # ← EDITED (+10 REND cases under a banner before the Summary block; reuse runCase/assert/os; one local stubTheme/textOf)
├── file-injector.ts          # ← UNCHANGED (renderInjectedMessage L627 LANDED + EXPORTED; git diff empty)
├── relative-imports.test.mjs # NOT edited
├── import-behavior.test.mjs  # NOT edited
├── scripts/typecheck.mjs     # untouched (pi-tui paths entry already landed by P1.M1.T2.S2)
├── package.json / PRD.md / README.md   # untouched (README = P1.M2.T3.S1)
└── plan/008_561ef016260d/
    ├── architecture/{system_context.md, external_deps.md, test_migration.md}
    ├── P1M1T1S1..P1M1T2S2/{PRP.md|issue_feedback.md, research/}  # the renderer + delivery predecessors (all LANDED)
    ├── P1M2T1S1/{research/, PRP.md}              # file-injector.test.mjs MIGRATION (LANDED, GREEN baseline)
    ├── P1M2T1S2/{research/, PRP.md}              # relative-imports + import-behavior migration (LANDED)
    ├── P1M2T2S1/{research/, PRP.md}              # sibling: DELIV-1..6 delivery/stash tests (LANDED in same file)
    └── P1M2T2S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.test.mjs    # MODIFIED — +1 banner comment + a local stubTheme/textOf + 10 runCase blocks (REND-1..REND-10) before the Summary block (L2510).
                          #           NO harness change, NO new fixtures, NO new exported helpers, NO migration of existing cases.
# file-injector.ts + relative-imports.test.mjs + import-behavior.test.mjs + scripts/typecheck.mjs are NEVER edited. No other files.
```

### Known Gotchas of our codebase & Library Quirks

```js
// CRITICAL — the test seam. Box.children is PUBLIC (pi-tui box.d.ts); Text.text is PRIVATE → read it via Text.render(width): string[].
//   The renderer builds new Text(s, 0, 0) (padding 0), so child.render(W).join("\n") = the content (wrapped to W, right-padded with spaces, NO margins).
//   Use W=2000 (generous → no wrapping). .includes() ignores trailing spaces; .trim() for exact/startsWith checks.

// CRITICAL — highlightCode returns PLAIN text (probed empirically: the expanded .ts body is "hello world", NO \x1b[ ANSI codes).
//   So REND-6's includes-check on the body is safe TODAY. The ROBUST primary assertion is children.length (expanded > collapsed); keep BOTH.

// CRITICAL — bodies[] is indexed per BLOCK, files[] per FILE. A paged file emits 2 blocks (head + directive) but 1 FileDetail, so bodies[i] for a
//   paged file = its HEAD body (the directive block is bodies[i+1], unreached). This is IRRELEVANT to my cases (REND-3 checks the COLLAPSED read line's
//   range suffix, not the expanded body), but DON'T assume bodies.length === files.length for paged. (Text files: 1 block = 1 body = 1 file → aligned.)

// GOTCHA — the expand hint " (ctrl+o to expand)" is appended at i===0 ONLY (per-box, like [skill]); children[1+] in a multi-file box have NO hint.
//   REND-2 pins this: [0] includes the hint, [1] does NOT. The fallback path appends expandHint unconditionally (always 1 child there).

// GOTCHA — stubTheme { fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t } makes every theme call return its text arg → the Text content is the RAW concatenated
//   string. NO styling, NO ANSI. This is how the test inspects UNSTYLED content. (For REND-10 color parity, use a SPY theme that records the keys instead.)

// GOTCHA — case-ID collision. Sibling P1.M2.T2.S1 owns DELIV-1..DELIV-6 in the SAME file. Use REND-1..REND-10 under a distinct
//   `// ── P1.M2.T2.S2 (plan/008): renderer output + defensive fallback ──` banner. Do NOT reuse the DELIV- prefix.

// GOTCHA — the message.content MUST match FILE_BLOCK_RE (/<file name="…">…<\/file>/g) for bodies to be re-derived. Craft content as
//   '<file name="/abs/a.ts">\nhello\n</file>' (note the wrapping \n — the renderer strips leading/trailing \n from the captured body).

// LIBRARY — zero-deps .mjs, loaded via Pi's jiti. The pi-tui alias is ALREADY at file-injector.test.mjs:63 (NO harness change). The gate is
//   `node ./file-injector.test.mjs`. `npm run typecheck` is belt-and-suspenders (the .ts is untouched → trivially clean).
```

## Implementation Blueprint

### Data models and structure

No new data models. The cases assert against the LANDED renderer by crafting `message` objects inline:

```ts
// The crafted message shape (matches what before_agent_start delivers, PRD §6.2):
{
  details: { files: FileDetail[] },   // FileDetail = { path, kind:"text"|"image"|"binary"|"paged", range?, dimensionHint?, chars?, lines?, pagedHeadLines? }
  content: string,                     // the joined <file> blocks — MUST match FILE_BLOCK_RE for bodies to re-derive
}
// Malformed variants for REND-8: { details: {} } (no files array) | { content: "…" } (no details key at all).

// The renderer returns a Box (pi-tui). Box.children: Component[] (PUBLIC). Each child the renderer adds is a Text.
// Text.render(width): string[] (PUBLIC; .text is private). With new Text(s,0,0): render(W) = [content padded to W] (no margins/empty lines).

// stubTheme (unstyled content): { fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t }
// spyTheme   (record keys)    : { fg:(k,t)=>{calls.fg.push(k);return t}, bg:(k,t)=>{calls.bg.push(k);return t}, bold:(t)=>{calls.bold.push(t);return t} }
```

### Empirical probe table (the EXACT behavior to pin — verified against the LANDED renderer)

stubTheme, `textOf = c => c.render(2000).join("\n")`:

| Case | crafted message (essence) | expanded | children.length | children[0] text (trimmed) |
|---|---|---|---|---|
| (a) text | files:[{path:"/abs/a.ts",kind:"text"}], content:`<file name="/abs/a.ts">\nhello world\n</file>` | false | **1** | `read /abs/a.ts (ctrl+o to expand)` |
| (b) multi | files:[{a.ts,text},{b.md,text}] | false | **2** | [0]=`read /abs/a.ts (ctrl+o to expand)` ; [1]=`read /abs/b.md` |
| (c) paged | files:[{path:"/abs/huge.log",kind:"paged",range:":5-"}] | false | **1** | `read /abs/huge.log:5- (ctrl+o to expand)` |
| (d) image | files:[{path:"/abs/pic.png",kind:"image",dimensionHint:"(resized to 1568×1044)"}] | false | **1** | `read /abs/pic.png (resized to 1568×1044) (ctrl+o to expand)` |
| (e) binary | files:[{path:"/abs/data.bin",kind:"binary"}] | false | **1** | `read /abs/data.bin (binary — not injected) (ctrl+o to expand)` |
| (f) expanded | same as (a) | **true** | **2** | [0]=read line ; [1]=`hello world` (PLAIN, no ANSI) |
| (g) image exp. | same as (d) | **true** | **1** | `read /abs/pic.png (resized to WxH) (ctrl+o to expand)` (NO body) |
| (h1) fallback | `{details:{}}` + content | false | **1** | `read (injected files) (ctrl+o to expand)` |
| (h2) fallback | `{content:"<file…>"}` (no details) | false | **1** | `read (injected files) (ctrl+o to expand)` (no throw) |
| (i) tildify | files:[{path:os.homedir()+"/projects/a.ts",kind:"text"}] | false | **1** | `read ~/projects/a.ts (ctrl+o to expand)` (startsWith `read ~`) |

**Color-parity SPY** (spyTheme records calls): after construction `fg`=["toolTitle","accent","dim"], `bold`=["read"]; after `box.render(80)`, `bg`=["toolSuccessBg",…].

### The 10 cases (exact specs — encode as runCase blocks)

```js
// ── P1.M2.T2.S2 (plan/008): renderer output + defensive fallback ──
// ─────────────────────────────────────────────────────────────────────
// Pins PRD §6.3 (the MessageRenderer) + §11 #33-38 (display matrix) + §12.23 (defensive, never throw) +
// §12.24 (green choice deliberate: toolSuccessBg/toolTitle+bold/accent/dim) + §12.25 (tildify; ctrl+o hardcoded).
// Calls mod.renderInjectedMessage DIRECTLY with crafted messages — NO file I/O, NO hooks, NO captureAllHandlers,
// NO fixtures. Reuses runCase/assert (and os, already imported L25). A local stubTheme renders UNSTYLED content
// (every theme fn returns its text arg); a local spyTheme (REND-10) records the theme KEYS for color parity.
//
// TEST SEAM (pi-tui, grounded in source): Box.children is PUBLIC (Component[]) → inspect children[i] directly.
// Text.text is PRIVATE → read via Text.render(width): string[]. The renderer builds new Text(s,0,0) (padding 0),
// so child.render(W).join("\n") = the content (wrapped to W, right-padded with spaces, NO margins). W=2000 → no wrap.
// highlightCode returns PLAIN text (probed) → body includes-checks are ANSI-safe TODAY.
const REND_THEME = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t };
const REND_W = 2000;
const textOf = (child) => child.render(REND_W).join("\n"); // generous width → no wrapping; trailing pad is harmless for .includes()

// REND-1 — COLLAPSED SINGLE FILE (§11 #33). One read line; includes "read" + the path.
await runCase("REND-1", "collapsed single text file: Box has children; [0] includes 'read' + path", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhello world\n</file>' },
    { expanded: false }, REND_THEME);
  assert(box && Array.isArray(box.children) && box.children.length >= 1, `renderer must return a Box with children, got ${JSON.stringify(box?.children?.length)}`);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read"), `children[0] is a read line (includes 'read'), got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("/abs/a.ts"), `children[0] includes the path, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(ctrl+o to expand)"), `children[0] includes the expand hint (i===0), got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-2 — COLLAPSED MULTI-FILE (§11 #34). Two read lines; the expand hint appears ONCE (on [0] only).
await runCase("REND-2", "collapsed multi-file: 2 read lines; hint on [0] only (shown once per box)", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }, { path: "/abs/b.md", kind: "text" }] },
      content: '<file name="/abs/a.ts">\na\n</file>\n<file name="/abs/b.md">\nb\n</file>' },
    { expanded: false }, REND_THEME);
  assert(box.children.length === 2, `two files → two read lines, got ${box.children.length}`);
  const l0 = textOf(box.children[0]), l1 = textOf(box.children[1]);
  assert(l0.includes("/abs/a.ts") && l0.includes("(ctrl+o to expand)"), `[0] is the a.ts read line WITH the hint, got ${JSON.stringify(l0.slice(0, 60))}`);
  assert(l1.includes("/abs/b.md"), `[1] is the b.md read line, got ${JSON.stringify(l1.slice(0, 60))}`);
  assert(!l1.includes("(ctrl+o to expand)"), `[1] must NOT have the expand hint (shown once per box, §6.3), got ${JSON.stringify(l1.slice(0, 60))}`);
});

// REND-3 — PAGED LINE (§11 #37). The read line carries the range suffix (mirrors the read tool's formatReadLineRange).
await runCase("REND-3", "paged file: read line includes the range suffix ':5-'", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/huge.log", kind: "paged", range: ":5-" }] },
      content: '<file name="/abs/huge.log">\nhead line\n</file>\n<file name="/abs/huge.log">directive</file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/huge.log"), `[0] is the huge.log read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes(":5-"), `[0] includes the paged range suffix ':5-', got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-4 — IMAGE LINE (§11 #35). The read line appends the dimensionHint.
await runCase("REND-4", "image file: read line includes the dimensionHint", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/pic.png", kind: "image", dimensionHint: "(resized to 1568×1044)" }] },
      content: '<file name="/abs/pic.png"></file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/pic.png"), `[0] is the pic.png read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(resized to 1568×1044)"), `[0] includes the dimensionHint, got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-5 — BINARY LINE (§11 #36). The read line shows '(binary — not injected)' (model note + display agree).
await runCase("REND-5", "binary file: read line includes '(binary — not injected)'", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/data.bin", kind: "binary" }] },
      content: '<file name="/abs/data.bin"><binary file — contents not injected; use the read tool if needed></file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.includes("read") && line0.includes("/abs/data.bin"), `[0] is the data.bin read line, got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(line0.includes("(binary — not injected)"), `[0] includes the binary note, got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-6 — EXPANDED (§6.3). Expanded renders the file content below the read line → MORE children than collapsed.
await runCase("REND-6", "expanded text file: more children than collapsed; body child carries the content", async () => {
  const msg = { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhello world\n</file>' };
  const collapsed = mod.renderInjectedMessage(msg, { expanded: false }, REND_THEME);
  const expanded = mod.renderInjectedMessage(msg, { expanded: true }, REND_THEME);
  assert(expanded.children.length > collapsed.children.length,
    `expanded must render the body below the read line (more children); collapsed=${collapsed.children.length} expanded=${expanded.children.length}`);
  // the body child (last) carries the file content — PLAIN text (highlightCode returns no ANSI today)
  const body = textOf(expanded.children[expanded.children.length - 1]);
  assert(body.includes("hello world"), `the expanded body child carries the file content, got ${JSON.stringify(body.slice(0, 60))}`);
});

// REND-7 — IMAGE NOT RE-RENDERED (§6.3/§6.4). Expanded image has NO body child (images attach to the user message).
await runCase("REND-7", "expanded image: NO body child (images attach to the user message, not the renderer)", async () => {
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/pic.png", kind: "image", dimensionHint: "(resized to WxH)" }] },
      content: '<file name="/abs/pic.png"></file>' },
    { expanded: true }, REND_THEME);
  assert(box.children.length === 1, `expanded image must have ONE child (the read line only; no body), got ${box.children.length}`);
  assert(textOf(box.children[0]).includes("/abs/pic.png"), `[0] is still the pic.png read line, got ${JSON.stringify(textOf(box.children[0]).slice(0, 60))}`);
});

// REND-8 — DEFENSIVE FALLBACK (§12.23). Malformed entries (no files / no details) never throw; single fallback line.
await runCase("REND-8", "defensive fallback: {details:{}} and {content} (no details) → no throw; 1 child '(injected files)'", async () => {
  // (a) details present but no files array
  let box = mod.renderInjectedMessage({ details: {}, content: '<file name="/abs/x.ts">x</file>' }, { expanded: false }, REND_THEME);
  assert(box && box.children.length === 1, `{details:{}} → single fallback line, got ${box?.children?.length}`);
  assert(textOf(box.children[0]).trim() === "read (injected files) (ctrl+o to expand)",
    `fallback line text, got ${JSON.stringify(textOf(box.children[0]).trim())}`);
  // (b) no details key at all (only content)
  box = mod.renderInjectedMessage({ content: '<file name="/abs/x.ts">x</file>' }, { expanded: false }, REND_THEME);
  assert(box && box.children.length === 1, `{content} (no details) → single fallback line (no throw), got ${box?.children?.length}`);
  assert(textOf(box.children[0]).trim() === "read (injected files) (ctrl+o to expand)",
    `fallback line text (no-details path), got ${JSON.stringify(textOf(box.children[0]).trim())}`);
});

// REND-9 — TILDIFY (§12.25). A path under os.homedir() displays with a leading '~'.
await runCase("REND-9", "tildify: a homedir path displays starting with '~'", async () => {
  const homePath = os.homedir() + "/projects/a.ts";
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: homePath, kind: "text" }] }, content: '<file name="' + homePath + '">\nhi\n</file>' },
    { expanded: false }, REND_THEME);
  const line0 = textOf(box.children[0]);
  assert(line0.startsWith("read ~"), `homedir path is tildified (starts with 'read ~'), got ${JSON.stringify(line0.slice(0, 60))}`);
  assert(!line0.includes(os.homedir()), `the raw homedir must NOT appear (replaced by ~), got ${JSON.stringify(line0.slice(0, 60))}`);
});

// REND-10 — COLOR PARITY (§11 #38 / §12.24). A spy theme proves the renderer uses the read-tool theme keys.
await runCase("REND-10", "color parity: toolSuccessBg (bg) + toolTitle/accent/dim (fg) + bold('read') — the read-tool recipe", async () => {
  const calls = { fg: [], bg: [], bold: [] };
  const spy = { fg: (k, t) => { calls.fg.push(k); return t; }, bg: (k, t) => { calls.bg.push(k); return t; }, bold: (t) => { calls.bold.push(t); return t; } };
  const box = mod.renderInjectedMessage(
    { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhi\n</file>' },
    { expanded: false }, spy);
  // readLine builds its string eagerly → fg/bold are called during construction
  assert(calls.fg.includes("toolTitle"), `fg uses toolTitle for the 'read' title (read-tool parity), got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.fg.includes("accent"), `fg uses accent for the path (read-tool parity), got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.fg.includes("dim"), `fg uses dim for the expand hint, got fg=${JSON.stringify(calls.fg)}`);
  assert(calls.bold.includes("read"), `bold is applied to 'read' (read-tool parity), got bold=${JSON.stringify(calls.bold)}`);
  // the Box bgFn (toolSuccessBg) fires on box.render(width) — prove the GREEN key, not the purple customMessageBg
  box.render(80);
  assert(calls.bg.includes("toolSuccessBg"), `bg uses toolSuccessBg (GREEN, the read tool's completed-call color; NOT purple customMessageBg), got bg=${JSON.stringify(calls.bg)}`);
  assert(!calls.bg.includes("customMessageBg"), `must NOT use customMessageBg (purple = skills, §12.24), got bg=${JSON.stringify(calls.bg)}`);
});
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD the banner + local stubTheme/textOf + 10 runCase blocks (file-injector.test.mjs, before the Summary block at L2510)
  - ADD a banner comment: `// ── P1.M2.T2.S2 (plan/008): renderer output + defensive fallback ──` (cite PRD §6.3/§11 #33-38/§12.23-25; note: calls
    renderInjectedMessage DIRECTLY — no I/O/hooks/fixtures; reuses runCase/assert/os; local stubTheme/spyTheme; test seam = Box.children public + Text.render).
  - ADD the local `const REND_THEME = …`, `const REND_W = 2000`, `const textOf = (child) => child.render(REND_W).join("\n");` (scoped under the banner).
  - ADD the 10 runCase blocks (REND-1..REND-10) verbatim per the blueprint above.
  - NAMING: `REND-1`..`REND-10` (NOT `DELIV-` — collides with sibling P1.M2.T2.S1's DELIV-1..6 in the same file).
  - PLACEMENT: BEFORE the `// 10. Summary + cleanup + exit.` block (L2510); after the DELIV-6 case (~L2508) is natural.
  - DO NOT: add fixtures (FIX/A_TS unused); add exported helpers; modify runCase/assert/captureAllHandlers; touch the 25 markdown/bare-@/config cases;
    touch file-injector.ts; touch the other two test files; touch scripts/typecheck.mjs.

Task 2: VERIFY the gate
  - RUN: node ./file-injector.test.mjs → EXPECT "Result: 144 passed, 0 failed." (current 134 + my 10), exit 0; the 10 REND cases print ✓; no existing ✗.
  - RUN: git diff --stat file-injector.ts → EXPECT EMPTY (the code is landed; tests only).
  - RUN: git diff --stat → EXPECT ONLY file-injector.test.mjs (no collision with .ts, sibling test files, or scripts/typecheck.mjs).
  - (belt-and-suspenders) npm run typecheck → 0 errors (the .ts is untouched → trivially clean).
  - IF a REND case fails:
      REND-1/2/3/4/5 line text wrong → the per-kind readLine format regressed (file-injector.ts:669) — NOT this task's code; report it.
      REND-6 expanded.children.length not > collapsed → the body render guard broke (bodies[i] check) — NOT this task's code; report it.
      REND-7 image has a body child → the image short-circuit (d.kind!=="image") broke — NOT this task's code; report it.
      REND-8 throws → the defensive guard (message?.details?.files ?? []) broke — NOT this task's code; report it.
      REND-9 not tildified → tildify (file-injector.ts:690) broke — NOT this task's code; report it.
      REND-10 wrong theme keys → the color discipline (§12.24) broke — NOT this task's code; report it.
      "Cannot find module '@earendil-works/pi-tui'" → the jiti alias at L63 was removed — NOT this task's code; report it (do NOT add a new alias).
```

### Implementation Patterns & Key Details

```js
// The renderer-call pattern (ALL 10 cases): craft a message, call the renderer DIRECTLY, inspect box.children.
const box = mod.renderInjectedMessage(
  { details: { files: [{ path: "/abs/a.ts", kind: "text" }] }, content: '<file name="/abs/a.ts">\nhello\n</file>' },
  { expanded: false },                       // { expanded: true } for REND-6/7
  REND_THEME);                               // { fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t } → unstyled content
// box.children is PUBLIC (Component[]); each child is a Text. Read a child's text via render(width):
const line = textOf(box.children[0]);        // child.render(2000).join("\n") — content padded to 2000, no wrap, no margins
line.includes("read");  line.includes("/abs/a.ts");  line.trim() === "read /abs/a.ts (ctrl+o to expand)";

// The color-parity pattern (REND-10): a SPY theme records the theme KEYS.
const calls = { fg: [], bg: [], bold: [] };
const spy = { fg:(k,t)=>{calls.fg.push(k);return t}, bg:(k,t)=>{calls.bg.push(k);return t}, bold:(t)=>{calls.bold.push(t);return t} };
const box = mod.renderInjectedMessage(msg, { expanded: false }, spy);  // readLine → fg/bold recorded NOW
box.render(80);                              // Box bgFn → bg recorded NOW (toolSuccessBg per rendered line)
calls.bg.includes("toolSuccessBg");  calls.fg.includes("toolTitle");

// CRITICAL: message.content MUST match FILE_BLOCK_RE (/<file name="…">…<\/file>/g) or bodies[] stays empty.
//   Craft content as '<file name="/abs/a.ts">\nhello\n</file>' (the renderer strips the wrapping \n from the captured body).
```

### Integration Points

```yaml
FILE_EDITS (the ONLY file):
  - file-injector.test.mjs: +1 banner comment + a local (REND_THEME, REND_W, textOf) + 10 runCase blocks (REND-1..REND-10) before the Summary block (L2510).
    REUSES runCase (L90), assert (L88), os (L25, for os.homedir() in REND-9), mod (L72, mod.renderInjectedMessage). NO new fixtures; NO harness change;
    NO new exported helpers (textOf/REND_THEME are local to the banner); NO migration of existing cases.
NO_CHANGES: file-injector.ts (git diff empty — the renderer is LANDED + EXPORTED), relative-imports.test.mjs + import-behavior.test.mjs (not in scope),
            scripts/typecheck.mjs (pi-tui paths entry already landed by P1.M1.T2.S2), package.json, PRD.md, README.md (P1.M2.T3.S1), all plan/ files.
NO_LOGIC_CHANGE: the renderer is UNCHANGED — this task adds TESTS that pin the landed display contract.
```

## Validation Loop

### Level 1: The suite run (the authoritative gate)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: the 10 REND cases print ✓, then "Result: 144 passed, 0 failed.", exit 0.
#   (current baseline 134 + my 10). LOAD-BEARING: "0 failed" + the 10 REND ✓ + no existing case flips to ✗.
# If a REND case shows ✗ → see Task 2's failure-triage (the renderer is LANDED; a REND failure is almost certainly
#   a real renderer regression to REPORT, not a bug in my test — UNLESS I mis-crafted the message content).
# If an EXISTING case flips to ✗ → you accidentally edited it or the harness; revert (this task adds cases ONLY).
```

### Level 2: Targeted checks (the 10 new cases + scope)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "REND-|Result:|✗ case" | head -20
# Expected: 10 "✓ case REND-…" lines; "Result: 144 passed, 0 failed."; ZERO "✗ case" lines.

# Scope integrity — only file-injector.test.mjs changed; the .ts and sibling files are untouched:
git diff --stat file-injector.ts            # expect EMPTY
git diff --stat file-injector.test.mjs      # expect the file (the +banner + textOf/stubTheme + 10 cases)
git diff --stat relative-imports.test.mjs import-behavior.test.mjs scripts/typecheck.mjs   # expect EMPTY
```

### Level 3: Belt-and-suspenders (typecheck — the .ts is untouched → trivially clean)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# (The .mjs is untyped; the .ts is unchanged → 0 errors regardless. This just confirms no accidental .ts edit.)
```

### Level 4: Cross-reference the landed contract (read-only — confirm the shapes my cases assert)

```bash
cd /home/dustin/projects/pi-file-injector
grep -n "export function renderInjectedMessage" file-injector.ts   # the renderer (L627)
grep -n 'theme.bg("toolSuccessBg"' file-injector.ts                # the green Box bgFn
grep -n "message?.details?.files ?? \\[\\]" file-injector.ts       # the defensive fallback guard (§12.23)
grep -n "d.kind !== \"image\"" file-injector.ts                    # the image expanded-view short-circuit (REND-7)
grep -n "function tildify" file-injector.ts                        # the homedir→~ display (REND-9, §12.25)
# Expected: hits at each — these are the exact contract lines REND-1..10 pin.
```

## Final Validation Checklist

### Technical Validation

- [ ] `node ./file-injector.test.mjs` → **0 failed**, exit 0; 10 `REND` cases print ✓; no existing case regresses.
- [ ] `git diff --stat file-injector.ts` is **EMPTY** (the renderer is landed; tests only).
- [ ] `git diff --stat` touches ONLY `file-injector.test.mjs` (no collision with the .ts, the sibling test files, or scripts/typecheck.mjs).

### Feature Validation (the contracts the 10 cases pin)

- [ ] REND-1: collapsed single → `children.length >= 1`; `textOf(children[0])` includes "read" + path + hint.
- [ ] REND-2: collapsed multi → `children.length === 2`; hint on [0] only.
- [ ] REND-3: paged → `textOf(children[0])` includes `":5-"`.
- [ ] REND-4: image → `textOf(children[0])` includes the dimensionHint.
- [ ] REND-5: binary → `textOf(children[0])` includes "(binary — not injected)".
- [ ] REND-6: expanded text → `expanded.children.length > collapsed.children.length` AND body includes content.
- [ ] REND-7: expanded image → `children.length === 1` (no body).
- [ ] REND-8: `{details:{}}` AND `{content}` (no details) → no throw; 1 child; exact fallback text.
- [ ] REND-9: homedir path → `textOf(children[0])` starts with "read ~".
- [ ] REND-10: spy theme → bg has "toolSuccessBg" (+ not "customMessageBg"); fg has toolTitle/accent/dim; bold has "read".

### Code Quality Validation

- [ ] Calls `mod.renderInjectedMessage` DIRECTLY with crafted messages — no file I/O, no hooks, no `captureAllHandlers`/`makeMockCtx`/`FIX`.
- [ ] Uses the public test seam correctly: `box.children` (public) + `child.render(width)` (Text.text is private); generous width (2000) to avoid wrapping.
- [ ] REUSES `runCase`/`assert`/`os` — no new exported helpers (textOf/REND_THEME/spy are local to the banner).
- [ ] Case IDs `REND-1`..`REND-10` (non-colliding with sibling `DELIV-1`..`DELIV-6`).
- [ ] The color-parity case uses a spy theme (not the unstyled stub) and calls `box.render(80)` to trigger the bg — the only case that calls box.render.

### Documentation

- [ ] None (test additions only — item §5 "DOCS: none"). No README/PRD change (README = P1.M2.T3.S1).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT call `box.render(width)` for CONTENT checks.** Box.render applies the Box bgFn + padding and is width-dependent; inspect
  `box.children[i]` (the Text components) directly via `child.render(width)` instead. The ONLY case that calls `box.render` is REND-10
  (color parity) — and only to trigger the bgFn so the spy records the `toolSuccessBg` key.
- ❌ **Do NOT access `child.text` directly.** `Text.text` is PRIVATE (pi-tui text.d.ts). Read it via the PUBLIC `child.render(width): string[]`
  (join + includes/trim). At runtime the field exists, but relying on it is fragile — use the public API.
- ❌ **Do NOT use a narrow render width.** `Text.render(width)` wraps to `width`; a narrow width splits a read line across multiple strings and
  breaks `.includes()`. Use `REND_W = 2000` (generous → no wrapping) so each child is one content string.
- ❌ **Do NOT mis-craft `message.content`.** The renderer re-derives bodies via `FILE_BLOCK_RE` (`<file name="…">…</file>`). If content doesn't
  match, `bodies[]` is empty and REND-6's body check fails. Craft content exactly as `'<file name="/abs/a.ts">\nhello\n</file>'` (the renderer
  strips the wrapping `\n`). The fallback cases (REND-8) need content too (for the no-files path it's present but unused; for the no-details path
  it's what the fallback would render expanded — but REND-8 is collapsed so content is just along for the ride).
- ❌ **Do NOT use the `DELIV-` prefix.** Sibling P1.M2.T2.S1 owns `DELIV-1`..`DELIV-6` in the same file. Use `REND-1`..`REND-10`.
- ❌ **Do NOT edit `file-injector.ts`** (the renderer is LANDED + EXPORTED) **or `relative-imports.test.mjs`/`import-behavior.test.mjs`/`scripts/typecheck.mjs`**.
  `git diff --stat` for all four must be empty.
- ❌ **Do NOT add a jiti alias or harness change.** The pi-tui alias is ALREADY at `file-injector.test.mjs:63` (the suite loads the renderer: 134 passed).
  Adding another alias is a harness change outside this task's scope.
- ❌ **Do NOT assume `bodies.length === files.length` for paged files.** A paged file emits 2 blocks (head + directive) but 1 FileDetail, so `bodies`
  has 2 entries for it. This is irrelevant to my cases (REND-3 checks the COLLAPSED read line, not the expanded paged body), but don't write an
  assertion that assumes 1:1 for paged.
- ❌ **Do NOT add docs.** Item §5: "DOCS: none — test additions only." README = P1.M2.T3.S1; PRD is read-only.

---

## Confidence Score: 9/10

A tightly-bounded test-addition task against LANDED, EXPORTED code (`renderInjectedMessage`, file-injector.ts:627). Every one of the 10 cases is
**grounded in an empirical probe** of the actual shipped renderer (the probe table gives exact `children.length` and exact `children[0]` text for all
10 cases + the spy-theme color-parity results), so the assertion specs are not guesses — they are observed behavior pinned as regression gates. The
PRP nails the one non-obvious part — the **test seam**: `Box.children` is public (inspect directly) but `Text.text` is private (read via
`Text.render(width)`), and with the renderer's `new Text(s,0,0)` a generous width yields one clean content string. It also confirms `highlightCode`
returns plain text (no ANSI) today, so body includes-checks are safe, with `children.length` as the robust primary assertion. It reuses only
`runCase`/`assert`/`os`/`mod` (no new fixtures/helpers), uses the `REND-` prefix to avoid collision with the sibling `DELIV-` cases, and requires
zero harness/jiti change (the pi-tui alias is already present and the suite is green). The -1 reserves for the highlightCode-plain-text assumption
(if a future Pi version makes highlightCode emit ANSI, REND-6's body includes-check is the canary — but the `children.length >` assertion is the
robust primary and is ANSI-independent). The implementing agent adds a banner + a local `textOf`/`stubTheme` + 10 `runCase` blocks and runs one command.
