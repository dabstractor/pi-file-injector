# Research Notes — P1.M1.T2.S2 (Register MessageRenderer + renderInjectedMessage)

All facts verified first-hand against the working tree (file-injector.ts 1143 lines, uncommitted T2.S1
edits present) and the installed Pi packages
(`@earendil-works/pi-coding-agent@0.80.10` + nested `@earendil-works/pi-tui@0.80.10`, global root).

## 0. HEADLINE: T2.S1 is ALREADY LANDED (in the working tree)

Despite the `<parallel_execution_context>` warning that "T2.S1 is currently being implemented," the
working tree ALREADY CONTAINS all of T2.S1's edits (uncommitted):
- `let pending: { blocks: string[]; details: FileDetail[] } | null = null;` closure var (L1056).
- `input` handler destructure includes `blocks, details` (L1069) + `pending = { blocks, details };` stash (L1074).
- `pi.on("before_agent_start", async (_e, _ctx) => { … })` handler present (L1096-1108) returning the
  custom message `{ customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } }`.

So T2.S2 begins from a **POST-T2.S1** state. The `display: true` contract is set; the customType
`"fileInjector.injected"` handshake string is fixed. T2.S2's job: register the renderer for that
customType + implement `renderInjectedMessage`. The "interim default box" T2.S1 documented is replaced
by T2.S2's green read-lines renderer.

## 1. The renderer registration site (the session_start(config) handler, L1059)

The current handler (verified):
```ts
pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });
```
T2.S2 ADDS the `pi.registerMessageRenderer(...)` call AFTER `cfg = await readConfig(ctx);` (same handler).
Item §3b: "in the FIRST session_start handler (L1030, the one that loads cfg), add after readConfig."
No hasUI guard (item §3b: "renderers are no-ops in print/json modes" — registration itself is harmless;
the renderer function is only INVOKED by CustomMessageComponent in TUI mode).

The registered customType MUST be the exact string `"fileInjector.injected"` (the handshake with
T2.S1's before_agent_start return at L1099). A typo = the renderer never fires.

## 2. The VERIFIED API surface (read from the .d.ts files — NOT guessed)

### registerMessageRenderer + MessageRenderer (`pi-coding-agent/dist/core/extensions/types.d.ts`)
```ts
// L816
export interface MessageRenderOptions { expanded: boolean; }
// L822
export type MessageRenderer<T = unknown> = (
  message: CustomMessage<T>, options: MessageRenderOptions, theme: Theme,
) => Component | undefined;
// L891 (inside interface ExtensionAPI)
registerMessageRenderer<T = unknown>(customType: string, renderer: MessageRenderer<T>): void;
```
- `registerMessageRenderer` is a METHOD on `ExtensionAPI` (the `pi` factory arg): `pi.registerMessageRenderer(...)`.
- The options param is the NAMED interface `MessageRenderOptions { expanded: boolean }` (structurally
  identical to inline `{ expanded: boolean }` — either works in a TS signature).
- The renderer MAY return `undefined` (the `| undefined` in the return type).
- `MessageRenderer`/`MessageRenderOptions` are re-exported from the main package (dist/index.d.ts:19).

### Theme — the fg/bg split (HIGHEST-RISK, confirmed) (`pi-coding-agent/dist/modes/interactive/theme/theme.d.ts`)
```ts
// L4 — FOREGROUND keys (ThemeColor)
export type ThemeColor = "accent" | ... | "dim" | ... | "toolTitle" | "toolOutput" | ... | "warning" | ...;
// L5 — BACKGROUND keys (ThemeBg)
export type ThemeBg = "selectedBg" | "userMessageBg" | "customMessageBg" | "toolPendingBg" | "toolSuccessBg" | "toolErrorBg";
// L19-21 (class Theme)
fg(color: ThemeColor, text: string): string;
bg(color: ThemeBg, text: string): string;
bold(text: string): string;
```
**The fg/bg split is enforced by the type signatures.** This is the trap the item description flags:
- `toolSuccessBg` is `ThemeBg` → MUST use `theme.bg("toolSuccessBg", text)`.
- `theme.fg("toolSuccessBg", ...)` is a **TypeScript COMPILE ERROR** (`"toolSuccessBg"` ∉ `ThemeColor`).
- `toolTitle`, `accent`, `dim`, `toolOutput`, `warning` are `ThemeColor` → use `theme.fg(...)`.
- `theme.bold(text)` takes ONLY text (no key).

Theme-key map for the renderer (all VERIFIED against L4-5):
| Key | Set | Correct call | Used for |
|---|---|---|---|
| `toolSuccessBg` | ThemeBg | `theme.bg("toolSuccessBg", t)` | the Box bgFn (green box) |
| `toolTitle` | ThemeColor | `theme.fg("toolTitle", …)` | the bold "read" title |
| `accent` | ThemeColor | `theme.fg("accent", …)` | the tildified path |
| `dim` | ThemeColor | `theme.fg("dim", …)` | "(ctrl+o to expand)", "(binary — not injected)", dimensionHint |
| `warning` | ThemeColor | `theme.fg("warning", …)` | the paged range suffix (":<startLine>-") |
| `toolOutput` | ThemeColor | `theme.fg("toolOutput", …)` | the expanded file content |

### Box + Text + Component (`@earendil-works/pi-tui`)
Package: `@earendil-works/pi-tui@0.80.10` (NESTED dep at `…/pi-coding-agent/node_modules/@earendil-works/pi-tui`).
```ts
// box.d.ts:5-12
class Box implements Component {
  constructor(paddingX?: number, paddingY?: number, bgFn?: (text: string) => string);
  addChild(component: Component): void; removeChild(component: Component): void;
  clear(): void; setBgFn(bgFn?: (text: string) => string): void;
  render(width: number): string[]; // + invalidate(), private applyBg
}
// text.d.ts:5,13-14
class Text implements Component {
  constructor(text?: string, paddingX?: number, paddingY?: number, customBgFn?: (text: string) => string);
  setText(text: string): void; setCustomBgFn(customBgFn?: (text: string) => string): void;
  render(width: number): string[]; // + invalidate()
}
// tui.d.ts:10-24
interface Component { render(width: number): string[]; handleInput?(data: string): void; wantsKeyRelease?: boolean; invalidate(): void; }
```
**CRITICAL constructor asymmetry:**
- `Box(paddingX?, paddingY?, bgFn?)` — bgFn is the THIRD arg.
- `Text(text?, paddingX?, paddingY?, customBgFn?)` — **text is the FIRST arg** (asymmetry with Box).
- The item description's `new Text(theme.fg(...), 0, 0)` matches the verified Text signature (text, 0, 0).
  ✅ Item is correct here.
- `new Box(1, 1, (t) => theme.bg("toolSuccessBg", t))` matches the verified Box signature (paddingX=1,
  paddingY=1, bgFn). ✅ Item is correct.
- `Box.applyBg` applies bgFn to EVERY rendered child line (matches the read-tool green box).
- `Box`/`Text` are RUNTIME class VALUES (must be value imports, NOT `import type`). `Component` is a
  TYPE (must be `import { type Component }`).

### highlightCode + getLanguageFromPath (MAIN package, NOT pi-tui)
```ts
// pi-coding-agent dist/modes/interactive/theme/theme.d.ts:110,114 — re-exported from dist/index.d.ts:29
function highlightCode(code: string, lang?: string): string[];   // ANSI-styled lines array
function getLanguageFromPath(filePath: string): string | undefined;
```
Both are named exports of `@earendil-works/pi-coding-agent` (the SAME import path file-injector.ts L3
already uses for resizeImage/CONFIG_DIR_NAME). Add them to that existing import — do NOT add a new import
from pi-tui for these (they're in the main package).

## 3. The imports to add (file-injector.ts L1-6)

Current L1-6 (verified):
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";   // ← already imported (tildify uses os.homedir())
```
T2.S2 edits:
1. **ADD `highlightCode, getLanguageFromPath`** to the L3 pi-coding-agent import (alongside resizeImage etc.).
2. **ADD a NEW import line** (the first pi-tui import in this file):
   `import { Box, Text, type Component } from "@earendil-works/pi-tui";`
   (`Box`/`Text` value imports; `Component` type-only. `os` is already imported — no change for tildify.)

## 4. The HIGHEST-RISK finding: the jiti alias (test-harness load)

The project has **NO local `node_modules`**. The test harness (`file-injector.test.mjs`) loads
file-injector.ts via jiti with an alias map (L~50-58). The CURRENT alias map has entries for
`@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` but **NO entry for `@earendil-works/pi-tui`**.

**Empirically confirmed (run, not guessed):**
- A project-dir file with `import { Box } from "@earendil-works/pi-tui"` → `Cannot find module
  '@earendil-works/pi-tui'` under the test harness's jiti (FAILS).
- Adding the alias `"@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js"`
  → `Box`/`Text` resolve as runtime functions; `new Box(...).addChild(new Text(...)).render(40)` returns
  `string[]` (PASSES).

**Why this matters for T2.S2:** T2.S2 ADDS the `import { Box, Text, type Component } from "@earendil-works/pi-tui"`
line. That import is evaluated at MODULE-LOAD time in ALL modes (the extension loads via jiti regardless of
mode). So the moment T2.S2 lands, the test harness will FAIL TO LOAD file-injector.ts
(`Cannot find module`) unless the alias is added.

**SCOPE BOUNDARY (critical):** The alias edit belongs to **P1.M2.T2.S2** (renderer tests), NOT this
subtask (P1.M1.T2.S2 = the renderer implementation). T2.S2 (this) does NOT edit the test harness. But T2.S2
MUST:
- (a) Pass `npm run typecheck` (tsc resolves pi-tui via the global root — typecheck is GREEN regardless of
  the test alias; tsc doesn't use the jiti alias map).
- (b) Acknowledge in the PRP that the test-suite LOAD will break until M2.T2.S2 adds the alias, and that
  this is EXPECTED (the suite was already RED from T1.S2's return-shape change; the load failure is a
  DIFFERENT, additional breakage that M2.T2.S2 fixes). T2.S2's gate is typecheck + structural grep — NOT
  the test suite (which is already red and about to get harder to load).

In a REAL `pi` process, the extension loads via Pi's own jiti rooted at the global pkg, where pi-tui
resolves via nested `node_modules` — so no alias is needed in production. The alias is purely a
test-harness concern.

## 5. The renderInjectedMessage algorithm (item §3c-f, traced to verified APIs)

Place: module level, AFTER `estimateImageTokens` (L591) and the format helpers, BEFORE the `injectFiles`
core (or alongside the other module-level helpers). It must be DEFINED before the factory references it
(TS function declarations hoist, but co-locate with helpers for readability). Export it (item §3g) so
P1.M2.T2.S2 tests can call it directly.

```ts
const FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;

/** [Mode A JSDoc: PRD §6.3] */
export function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component {
  const files: FileDetail[] = message?.details?.files ?? [];           // defensive (old/foreign entry)
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0;                                       // module regex w/ g flag → reset
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null)
      bodies.push(m[2].replace(/^\n|\n$/g, ""));                       // strip the wrapping newlines
  }
  const box = new Box(1, 1, (t: string) => theme.bg("toolSuccessBg", t));  // green, like a completed read call
  if (files.length === 0) {                                            // defensive fallback
    box.addChild(new Text(theme.fg("toolTitle", theme.bold("read")) + " " +
      theme.fg("dim", "(injected files)") + expandHint(theme), 0, 0));
    if (opts.expanded && typeof message?.content === "string")
      box.addChild(new Text(theme.fg("toolOutput", message.content), 0, 0));
    return box;
  }
  for (let i = 0; i < files.length; i++) {
    const d = files[i];
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? expandHint(theme) : ""), 0, 0));
    if (opts.expanded) {
      const body = bodies[i];
      if (body !== undefined && d.kind !== "image") {                  // images already attached to user msg
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
    }
  }
  return box;
}

function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const pathPart = theme.fg("accent", tildify(d.path));
  if (d.kind === "binary") return `${title} ${pathPart} ${theme.fg("dim", "(binary — not injected)")}`;
  if (d.kind === "image")  return `${title} ${pathPart}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  if (d.kind === "paged")  return `${title} ${pathPart}${theme.fg("warning", d.range ?? "")}`;
  return `${title} ${pathPart}`;                                       // whole text
}

function expandHint(theme: any): string { return " " + theme.fg("dim", "(ctrl+o to expand)"); }

function tildify(abs: string): string {
  const home = os.homedir();
  return home && abs.startsWith(home + "/") ? "~" + abs.slice(home.length) : abs;
}
```

**Type-safety notes:**
- `theme` is typed `any` (item §3c) to avoid importing the full `Theme` class just for the renderer
  signature. tsc under --strict accepts `any` (no implicit-any error because it's explicit). The fg/bg
  calls are unchecked at compile time when theme is `any` — so the fg/bg discipline is ENFORCED BY CODE
  REVIEW + the item's explicit mapping, not by the compiler. (Alternative: type theme as `Theme` imported
  from pi-coding-agent → compile-time enforcement. The PRP offers both; item §3 uses `any` so the default
  is `any` with a note that `Theme` is available if stricter typing is wanted. The M2.T2.S2 tests will pass
  a fake theme object, so `any` keeps the test seam simple.)
- `message` is `any` (item §3c). `CustomMessage<T>` could be imported for stricter typing, but the
  defensive `?.details?.files ?? []` pattern works with `any`.
- The `Component` return type is the imported type — `renderInjectedMessage` is typed to return `Component`.

## 6. The defensive guarantees (PRD §12.23)

- `message?.details?.files ?? []` — old/foreign entries with no details → files=[] → the fallback branch
  (single "read (injected files)" line + raw content when expanded). Never throws.
- `bodies[i]` guarded with `!== undefined` — if a detail has no matching block (malformed), the expanded
  view skips it (no crash).
- `d.kind !== "image"` short-circuit in the expanded view — images are already attached to the user
  message (PRD §6.4); don't re-render them.
- `typeof message?.content === "string"` guard — if content is missing/non-string, bodies stays [] →
  expanded view shows nothing (graceful).
- The renderer NEVER throws (PRD §12.23: a thrown renderer → CustomMessageComponent catches → Pi's default
  purple box). Defensive coding is the goal; the fallback is last-resort.

## 7. Validation gates (what T2.S2 owns vs. what it does NOT)

**T2.S2 OWNS (the deterministic gate):**
- `npm run typecheck` → 0 errors under --strict. (tsc resolves pi-tui via the global root; the fg/bg
  discipline is NOT compile-enforced if theme is `any`, but the import/type resolution must be clean.)
- Structural grep: the new imports; the `pi.registerMessageRenderer("fileInjector.injected", …)` call in
  session_start(config); `export function renderInjectedMessage`; `readLine`; `expandHint`; `tildify`.

**T2.S2 does NOT own (out of scope):**
- The test suite (RED from T1.S2's return-shape change; M2.T1 migrates). T2.S2 does NOT edit tests.
- The jiti pi-tui alias (M2.T2.S2's concern). T2.S2 ACKNOWLEDGES the test-load will fail until M2.T2.S2
  adds the alias, but does not add it (scope boundary).
- The README (Mode B, M2.T3.S1).

**The expected post-T2.S2 state:** typecheck GREEN; structural greps pass; the test suite STILL fails to
LOAD file-injector.ts under jiti (the new pi-tui import has no alias) — this is the EXPECTED intermediate
state handed to M2.T2.S2 (which adds the alias + the renderer tests). T2.S2 must NOT "fix" the load by
editing the test harness alias (that's M2.T2.S2).

## 8. No-conflict coordination with siblings

- **T2.S1 (LANDED in working tree):** owns the factory delivery seam (pending/input-stash/before_agent_start).
  T2.S2 ADDS the renderer registration to T2.S1's session_start(config) handler (one line after
  readConfig) — a DISJOINT region of that handler. No conflict. The customType string is the handshake.
- **M2.T1.S1/S2 (upcoming):** migrate ~230 test assertions from r.text to r.blocks/r.details. T2.S2 does
  NOT touch tests. M2.T1 will need the jiti pi-tui alias too (to load the file at all) — but that's part
  of M2.T1's test-migration scope, or M2.T2.S2's. T2.S2 flags it.
- **M2.T2.S2 (upcoming):** renderer output + defensive fallback tests. Calls `renderInjectedMessage`
  directly (that's why T2.S2 EXPORTS it). M2.T2.S2 adds the jiti pi-tui alias so the file loads.
- **M2.T3.S1 (upcoming):** README Mode B (user-facing display description). T2.S2 is internal (Mode A
  JSDoc only); no user-facing doc.
