# Research Notes — P1.M2.T2.S2 (plan/008): Renderer output + defensive fallback tests

**Task:** Add unit tests pinning `renderInjectedMessage` output for each file kind,
expanded/collapsed behavior, the defensive fallback, tildify, and color parity.
These are the PRD §11 #33–38 display test cases (+ §12.23 defensive, §12.25 tildify, §12.24 color).

**Scope flag:** TEST-ADDITION only. The renderer (`renderInjectedMessage`) is **LANDED + exported**
(file-injector.ts:627). `git diff --stat file-injector.ts` is EMPTY. I add `runCase` blocks only.

---

## 1. What I'm testing (the function under test)

`mod.renderInjectedMessage(message, opts:{expanded:boolean}, theme)` (file-injector.ts:627) — the
MessageRenderer registered for `customType:"fileInjector.injected"`. Returns a `Component` (a green
`Box` from `@earendil-works/pi-tui`). It is a PURE function of its 3 args — no file I/O, no hooks, no
session state — so the tests call it DIRECTLY with hand-crafted `message` objects (no `injectFiles`,
no `captureAllHandlers`, no fixtures).

The renderer:
1. reads `message?.details?.files ?? []` (FileDetail[]) — defensive (old/foreign entries → []).
2. re-parses `<file name="…">…</file>` blocks from `message.content` via module-level `FILE_BLOCK_RE`
   (file-injector.ts:605) → `bodies: string[]` (one per BLOCK, NOT per file — paged emits 2 blocks).
3. builds a `Box(1, 1, t => theme.bg("toolSuccessBg", t))`.
4. if `files.length === 0` → DEFENSIVE FALLBACK: one Text `"read (injected files) (ctrl+o to expand)"`;
   if `expanded && typeof content==="string"` → a 2nd Text with the raw content.
5. else per file i: `addChild(new Text(readLine(d,theme) + (i===0 ? expandHint : "")))`; if `expanded`
   and `bodies[i] !== undefined` and `d.kind !== "image"` → `addChild(new Text(theme.fg("toolOutput",
   lang ? highlightCode(body,lang).join("\n") : body)))`.

`readLine` (file-injector.ts:669): `toolTitle+bold("read")` + `" "` + `accent(tildify(path))` + suffix
by kind: binary → `dim("(binary — not injected)")`; image → optional `dim(dimensionHint)`; paged →
`warning(range)`; text → nothing. `expandHint` = `dim(" (ctrl+o to expand)")`. `tildify` (L690):
leading `os.homedir()+"/"` → `"~"`.

---

## 2. The test seam: how to inspect a rendered Component (CRITICAL — grounded in pi-tui source)

**Box (pi-tui dist/components/box.d.ts):** `children: Component[]` is **PUBLIC**. So
`box.children[i]` is the i-th child (each child is a `Text`). `box.children.length` = number of lines.

**Text (pi-tui dist/components/text.d.ts + text.js):** `text` is **PRIVATE**. Access via the PUBLIC
`render(width): string[]`. The renderer constructs `new Text(s, 0, 0)` — paddingX=0, paddingY=0 — so
`render(width)` returns the content wrapped to `width` with NO margins and NO empty padding lines,
right-padded with spaces to `width` (no customBgFn on the Text; bg is on the Box). To read the clean
content: `child.render(W).join("\n")` then `.includes(...)` (trailing spaces are harmless for includes)
or `.trim()` for an exact/startsWith check. **Use a GENEROUS width (2000) so nothing wraps.**

**stubTheme:** `{ fg:(_k,t)=>t, bg:(_k,t)=>t, bold:(t)=>t }` — every theme call returns its text arg
unchanged, so the Text content is the RAW concatenated string. **NO ANSI** is produced: empirically
`highlightCode` returns plain text (the expanded `.ts` body is plain `"hello world"`, no `\x1b[` codes),
so body-content includes-checks are safe even for code files.

---

## 3. Empirical probe results (the EXACT behavior to pin — run `/tmp/probe` style script)

stubTheme, RW=2000, `textOf = c => c.render(RW).join("\n")`:

| Case | message | expanded | children.length | children[0] text (trimmed) |
|---|---|---|---|---|
| (a) text | `{details:{files:[{path:"/abs/a.ts",kind:"text"}]}, content:'<file name="/abs/a.ts">\nhello world\n</file>'}` | false | **1** | `read /abs/a.ts (ctrl+o to expand)` |
| (b) multi | two files a.ts+b.md | false | **2** | [0]=`read /abs/a.ts (ctrl+o to expand)` ; [1]=`read /abs/b.md` (NO hint) |
| (c) paged | `{files:[{path:"/abs/huge.log",kind:"paged",range:":5-"}]}`, content head+directive blocks | false | **1** | `read /abs/huge.log:5- (ctrl+o to expand)` |
| (d) image | `{files:[{path:"/abs/pic.png",kind:"image",dimensionHint:"(resized to 1568×1044)"}]}` | false | **1** | `read /abs/pic.png (resized to 1568×1044) (ctrl+o to expand)` |
| (e) binary | `{files:[{path:"/abs/data.bin",kind:"binary"}]}` | false | **1** | `read /abs/data.bin (binary — not injected) (ctrl+o to expand)` |
| (f) expanded text | same as (a) | **true** | **2** | [0]=read line ; [1]=`hello world` (the body — PLAIN, no ANSI) |
| (g) image expanded | same as (d) | **true** | **1** | `read /abs/pic.png (resized to WxH) (ctrl+o to expand)` (NO body — short-circuit) |
| (h1) fallback `{details:{}}` | content present | false | **1** | `read (injected files) (ctrl+o to expand)` |
| (h2) fallback no details | `{content:"<file…>"}` (no `details`) | false | **1** | `read (injected files) (ctrl+o to expand)` (no throw) |
| (h3) fallback expanded | `{details:{}, content:"<file…>RAWBODY</file>"}` | true | **2** | [0]=fallback ; [1]=`<file name="/abs/x.ts">RAWBODY</file>` (raw content) |
| (i) tildify | `{files:[{path: homedir+"/projects/a.ts", kind:"text"}]}` | false | **1** | `read ~/projects/a.ts (ctrl+o to expand)` (startsWith `read ~`) |

**Color-parity SPY probe** (spyTheme records calls): after construction `fg` keys = `["toolTitle",
"accent", "dim"]`, `bold` = `["read"]`; after `box.render(80)`, `bg` keys = `["toolSuccessBg",…]`
(once per rendered line). → pins §11 #38 / §12.24 (green = toolSuccessBg; title = toolTitle+bold;
path = accent; hint = dim).

---

## 4. The harness I reuse (file-injector.test.mjs)

- `runCase(n, name, fn)` (L90) — `fn` throws on failure (use `assert`); prints ✓/✗; records a matrix row.
- `assert(cond, msg)` (L88) — throws Error(msg) on false.
- `os` IS imported (L25, `import * as os from "node:os"`) — tildify case uses `os.homedir()`.
- `mod` is the jiti-imported module (L72); `mod.renderInjectedMessage` is the function under test.
- **The pi-tui jiti alias is ALREADY present (L63)** — the suite loads the renderer fine
  (current run: **134 passed, 0 failed**). NO harness/jiti change needed for this task.
- **Insertion point:** a new banner + `REND-1`..`REND-10` runCase blocks placed BEFORE the
  `// 10. Summary + cleanup + exit.` block at **L2510** (after the `DELIV-6` case ending ~L2508).

## 5. No collision + no scope leak

- **Sibling P1.M2.T2.S1** owns `DELIV-1`..`DELIV-6` (delivery/custom-message/stash, via
  `captureAllHandlers`/`injectFiles`). My cases use prefix **`REND-`** and test a DIFFERENT function
  (`renderInjectedMessage` direct) — zero overlap, zero ID collision.
- **NO file I/O, NO fixtures** (FIX/A_TS/B_TS unused), **NO `captureAllHandlers`/`makeMockCtx`**,
  **NO hooks**, **NO `.ts` change**, **NO harness change**, **NO README/PRD**.
- The 25 markdown/bare-@/config cases are P1.M2.T1.S1's (LANDED, GREEN). I don't touch them.

## 6. The 10 cases (REND-1..REND-10) → PRD §11 #33–38 + §12.23/24/25

| ID | Item letter | PRD ref | Pins |
|---|---|---|---|
| REND-1 | (a) collapsed single | §11 #33 | children>=1; [0] includes "read" + the path |
| REND-2 | (b) collapsed multi | §11 #34 | children===2; [0] has hint, [1] is read line WITHOUT hint |
| REND-3 | (c) paged line | §11 #37 | [0] includes the range suffix (":5-") |
| REND-4 | (d) image line | §11 #35 | [0] includes the dimensionHint |
| REND-5 | (e) binary line | §11 #36 | [0] includes "(binary — not injected)" |
| REND-6 | (f) expanded | §6.3 | expanded.children.length > collapsed.children.length; body child present |
| REND-7 | (g) image not re-rendered | §6.3/§6.4 | expanded image children===1 (NO body) |
| REND-8 | (h) defensive fallback | §12.23 | {details:{}} AND {content} (no details) → no throw, 1 child "(injected files)" |
| REND-9 | (i) tildify | §12.25 | homedir path → [0] startsWith "read ~" |
| REND-10 | (color parity — bonus) | §11 #38 / §12.24 | spy theme: bg=toolSuccessBg, fg has toolTitle+accent+dim, bold="read" |

---

## 7. Gate

`node ./file-injector.test.mjs` → **0 failed** (current 134 + my 10 = 144), exit 0; 10 `REND-` lines
print ✓; no existing case flips. `git diff --stat file-injector.ts` EMPTY. `git diff --stat` touches
ONLY `file-injector.test.mjs` (no collision with the .ts or sibling test files).
