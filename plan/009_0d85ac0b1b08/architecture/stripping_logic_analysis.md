# Stripping Logic Analysis — `file-injector.ts`

READ-ONLY analysis of the `#@` marker stripping logic. All line numbers are against the current
`/home/dustin/projects/pi-file-injector/file-injector.ts` (1412 lines).

## Executive summary

There are **two distinct stripping sites**, with different mechanisms:

| Site | Function | What gets stripped | Mechanism | Width |
|------|----------|--------------------|-----------|-------|
| **Top-level** (user prompt) | `injectFiles` (post `processTokenStream`) | `#@` markers that ACTUALLY injected | index array `resolvedIdx: number[]` from `processTokenStream` | hardcoded `+ 2` (line 1242) |
| **Markdown** (transitive import) | `injectMarkdown` Step 4 | `#@`/bare `@` markers that are INJECTABLE (stat-succeed + readable) | record array `injectable: {index,prefixLen,abs}[]` | `+ r.prefixLen` (2 or 1) (line 1147) |

The **prompt text returned to the runtime is the STRIPPED prompt** (markers removed, paths kept), NOT
verbatim and NOT the appended blocks. File bodies are delivered to the model via a SEPARATE custom
message published in `before_agent_start` (blocks joined with `\n\n`).

---

## 1. `scanTokens` — lines 856–893

**JSDoc:** lines 826–854 (the big `/** … */` above the signature). Documents `opts.skipCode`,
`opts.allowAbsTilde`, `opts.tryMdExt`, `opts.bareAt`, and the return shape.

**Signature + return type (line 856–861):**

```ts
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<{ index: number; prefixLen: number; abs: string }[]>
```

**YES** — it returns `Promise<{ index: number; prefixLen: number; abs: string }[]>` in text order
(`cands.sort((a, b) => a.idx - b.idx)` at line 878; `out.push({ index: c.idx, prefixLen: c.prefixLen, abs })`
at line 892). `prefixLen` is the marker char width: **2 for `#@`**, **1 for bare `@`** (when `bareAt` is truthy).

**Call sites (2):**
- **line 911** — inside `processTokenStream` (top-level user prompt scan):
  `const records = await scanTokens(text, baseDir, opts, state);`
- **line 1105** — inside `injectMarkdown` Step 3 (markdown import scan):
  `const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);`

---

## 2. `processTokenStream` — lines 904–919

**Signature + return type (lines 904–910):**

```ts
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State,
  ctx: Ctx,
): Promise<number[]>
```

**YES** — returns `Promise<number[]>`. Body (lines 911–919):
- scans once via `scanTokens` (line 911),
- for each record: skips if already claimed (`state.injectedSet.has(r.abs)`, line 913), else `await injectFile(r.abs, state, ctx)` (line 915),
- pushes `r.index` into `resolved` **only if `injectFile` returned true** (line 916–917),
- returns `resolved` (the start indices of markers that ACTUALLY injected).

Note the `opts` here requires `bareAt: boolean` (non-optional), unlike `scanTokens` where it is `bareAt?`.
The top-level caller always passes `bareAt: false`.

**Call site (1):** **line 1225** in `injectFiles`:
```ts
const resolvedIdx = await processTokenStream(
  text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
```

---

## 3. `injectMarkdown` — lines 1094–1159 (the six-step algorithm)

**Signature (line 1094):**
```ts
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void>
```
Returns `Promise<void>`; does NOT bump `state.count` (injectFile owns the single count++ per file).

### Step 3.5 — stat / `fs.access` pre-check — lines 1129–1140

The filter builds `injectable` (only records that will actually deliver):

```ts
const injectable: { index: number; prefixLen: number; abs: string }[] = [];   // line 1129
for (const r of records) {                                                      // line 1130
  try {
    const st = await fs.stat(r.abs);                                            // line 1132
    if (!st.isFile()) continue;          // directory/socket/etc → verbatim      // line 1133
    await fs.access(r.abs, fs.constants.R_OK); // gate strip on READABILITY     // line 1134
    injectable.push(r);                   // forwards WHOLE record (keeps prefixLen) // line 1135
  } catch {
    /* missing / directory / unreadable → leave verbatim (not stripped, not injected) */
  }
}
```

JSDoc for Step 3.5 is at lines 1107–1128. The filter keeps `prefixLen` intact by pushing the whole `r`
(line 1135), explicitly NOT building a new object literal (the codebase_delta §8.2 anti-pattern, per comment).

**Why:** pre-order emission (Step 6) emits THIS file's block BEFORE recursing, so the strip decision
must be made NOW (unlike the top-level path, which can inject-then-strip because the user prompt is not
a pre-order block).

### Step 4 — stripping loop — lines 1145–1147

```ts
let stripped = content;                                                         // line 1145
for (const r of [...injectable].sort((a, b) => b.index - a.index)) {            // line 1146
  stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen); // line 1147
}
```

High→low so earlier offsets stay valid. Width is `r.prefixLen` (2 for `#@`, 1 for bare `@`). Only
INJECTABLE markers are stripped; missing/dir/unreadable/deduped/unresolved markers keep the marker verbatim.

### Step 5 — emit — line 1151
```ts
emitText(abs, stripped, state);   // paged decision runs on the STRIPPED content
```

### Recursion (Step 6) — lines 1154–1158
```ts
for (const r of injectable) {
  if (state.injectedSet.has(r.abs)) continue;   // belt-and-suspenders cross-subtree dedup
  await injectFile(r.abs, state, ctx);           // claims abs, classifies, bumps count, recurses if markdown
}
```

**Recursion contract:** dedup-bounded (each abs claimed in `state.injectedSet` BEFORE its scan), NOT
depth-limited — termination is guaranteed by the finite set of injectable files each processed at most
once (Step 2 self-claim at line 1098: `state.injectedSet.add(abs)`). Pre-order depth-first: parent
block emitted (Step 5) before recursing into imports (Step 6).

**Single call site of `injectMarkdown`:** **line 974** in `injectFile`'s markdown branch:
```ts
await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
```

---

## 4. `injectFiles` — lines 1162–1246

**Signature (lines 1162–1166):**
```ts
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false,
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }>
```

### `resolvedIdx` computed — line 1225
```ts
const resolvedIdx = await processTokenStream(
  text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
```

### Nothing-injected early return — line 1227
```ts
if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] };
```
Returns the ORIGINAL `text` ref (byte-for-byte).

### `strippedText` computed — lines 1240–1242 (top-level strip)
```ts
let strippedText = text;                                                        // line 1240
for (const i of [...resolvedIdx].sort((a, b) => b - a)) {                       // line 1241
  strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);          // line 1242  ← hardcoded + 2
}                                                                              // line 1242
```

### Return — line 1246
```ts
return { text: strippedText, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
```

**The user message is JUST the stripped prompt** — no appended blocks, no `\n\n---\n\n` separator
(comment at lines 1243–1245). Blocks + details are returned for the caller to stash for
`before_agent_start`.

### ⚠ Coupling note (line 1242)
The top-level strip hardcodes `i + 2`. This is safe ONLY because the top-level call passes
`bareAt: false` (line 1225), so `scanTokens` matches `#@` only (prefixLen always 2). If the top-level
path were ever to enable `bareAt`, this `+ 2` would corrupt bare-`@` markers (would leave the `@` and
strip 1 trailing char). The top-level `prefixLen` is discarded at `processTokenStream` line 916
(only `r.index` is pushed into `resolved`). **Not a current bug, but a latent coupling.**

---

## 5. `input` event handler — lines 1305–1324

**Returns STRIPPED text, not verbatim, when injected.** Flow:

- **line 1305** — `pi.on("input", async (event, ctx) => {`
- **lines 1306–1308** — three early returns `{ action: "continue" }` (extension source / steer / no `#@`).
- **line 1310** — `const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true);`
- **line 1311** — `if (!injected) return { action: "continue" };` (nothing injected → preserve prompt byte-for-byte; no stash set).
- **line 1315** — `pending = { blocks, details };` (stash for `before_agent_start`).
- **lines 1320–1321** — UI notify (`#@ injected N whole[, M paged]`), guarded on `ctx.hasUI`.
- **line 1323** — **`return { action: "transform" as const, text, images };`**

The `text` returned here is `injectFiles`' `strippedText` — the prompt with `#@` triggers removed but
**paths kept** as readable references. The file BODIES are NOT in `text`; they are published separately
by `before_agent_start` (the `pending` stash → custom message). So the model sees two things: the
stripped user prompt, then a custom `fileInjector.injected` message whose `content` is `blocks.join("\n\n")`.

---

## 6. `emitText` — line 1000

**Signature:**
```ts
export function emitText(abs: string, content: string, state: State): void
```

Synchronous (NOT async). Body lines 1000–1037. Pushes block(s) onto `state.blocks` and a FileDetail onto
`state.details`, subtracts cost via `subtract(state, …)`, bumps `state.paged` on the page path. Owns the
inline-vs-paged decision. Does NOT bump `state.count`.

**Call sites (2):**
- **line 983** — `injectFile`'s plain-text branch: `emitText(abs, buf.toString("utf8"), state);`
- **line 1151** — `injectMarkdown` Step 5: `emitText(abs, stripped, state);` (runs on the STRIPPED content).

---

## 7. `before_agent_start`, `computeDetailOffsets`, `renderInjectedMessage` — consume blocks/details, NOT prompt text ✓

### `before_agent_start` — lines 1331–1342
- **line 1335** — `computeDetailOffsets(blocks, details);` (mutates details in place, computing absolute
  `contentStart`/`contentLen` over the FINAL `blocks` array).
- **line 1339** — `content: blocks.join("\n\n"),` (the model-visible text is the JOINED BLOCKS, not the prompt).
- **line 1341** — `details: { files: details }` (renderer metadata; `convertToLlm` ignores details → NOT extra model text).

Confirmed: consumes `blocks` + `details` (the built file blocks), NOT the user prompt text. One-shot
per prompt: `pending` cleared unconditionally at line 1333.

### `computeDetailOffsets` — lines 353–423
Signature: `export function computeDetailOffsets(blocks: string[], details: FileDetail[]): FileDetail[]`.
Computes char offsets of each file body WITHIN `blocks.join("\n\n")` (length-derived, BUG-1-safe). Operates
on `blocks` + `details` only.

### `renderInjectedMessage` — lines 739–825
Signature: `export function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component`.
Reads `message.details.files` (the FileDetail array, line 741) and `message.content` (the joined blocks,
line 745+) for body recovery (3-tier: offset slice → stored `body` → regex fallback). It is a TUI
display component over the custom message's blocks/details — it does NOT touch the user prompt text.

**All three confirmed to consume blocks/details, never prompt text.**

---

## Data-flow diagram (stripping-relevant)

```
input event.text (raw prompt, e.g. "...#@a.md...#@b.ts...")
  │
  ▼
injectFiles  ──► processTokenStream(text, cwd, {allowAbsTilde:true, skipCode:false, tryMdExt:false, bareAt:false})
  │                  │
  │                  ├─ scanTokens(...) → records: {index,prefixLen,abs}[]   (prefixLen discarded below)
  │                  └─ for each record: injectFile(abs) ──► (markdown branch) injectMarkdown(abs, content)
  │                                                                       │
  │                                                                       ├─ Step3  scanTokens(content, dir, {allowAbsTilde:false, skipCode:true, tryMdExt:true, bareAt:state.bareAt})
  │                                                                       ├─ Step3.5 stat + fs.access(R_OK) → injectable[]
  │                                                                       ├─ Step4   stripped = slice out r.index..r.index+prefixLen  (prefixLen-aware)
  │                                                                       ├─ Step5   emitText(abs, stripped)  → blocks/details
  │                                                                       └─ Step6   recurse injectFile(abs)
  │                  │
  │                  └─ returns resolvedIdx: number[]   (indices where injectFile returned true)
  │
  ├─ strippedText = splice i..i+2 for each i in resolvedIdx   (HARDCODED +2, line 1242)
  └─ return { text: strippedText, images, injected, paged, blocks, details }
        │
        ▼
input handler: pending = { blocks, details };  return { action:"transform", text: strippedText, images }
        │                                              └─ STRIPPED prompt (paths kept, #@ removed)
        ▼
before_agent_start: computeDetailOffsets(blocks, details);
  return { message: { customType:"fileInjector.injected", content: blocks.join("\n\n"), details:{files:details} } }
                                                          └─ file BODIES go here, separate from the prompt
```

---

## Residual risks / observations

1. **Top-level strip hardcodes `+ 2` (line 1242)** while `processTokenStream` already had access to
   `r.prefixLen` but discards it (returns `number[]`, not records). Safe today only because top-level
   `bareAt` is hardcoded `false` (line 1225). If top-level bare-`@` were ever enabled, the `+ 2` would
   mis-strip. Hardening: have `processTokenStream` return `{index, prefixLen}[]` and strip by `prefixLen`.

2. **injectMarkdown Step 3.5 `fs.access(R_OK)` does NOT predict resize success** (documented accepted
   residual, lines 1122–1123): a READABLE image whose `resizeImage` THROWS still gets its marker stripped,
   because the gate cannot predict a resize failure. Backstopped by `injectFile`'s try/catch (no crash,
   no block appended) but the marker is gone from the parent's content.

3. **TOCTOU** between the Step 3.5 `fs.access` and `injectFile`'s `readFile` (documented, lines 1124–1125):
   a file could become unreadable in between. Backstopped by `injectFile`'s read try/catch.

4. **Two strip widths diverge by design**: top-level uses index-only + 2; markdown uses prefixLen. They
   are consistent ONLY at the current default (`bareAt:false` everywhere → both 2). Any change enabling
   bare-`@` at top level must update the top-level strip.

5. **`processTokenStream.opts.bareAt` is `boolean` (required) but `scanTokens.opts.bareAt` is `boolean?`
   (optional).** Minor type inconsistency — harmless because the only caller always passes a boolean.

---

## Start here

Open **`file-injector.ts:1225`** (`injectFiles`) — that is the single top-level strip decision point and
the bridge between `processTokenStream` (returns `number[]`) and the `strippedText` splice at line 1242.
Then **`file-injector.ts:1094`** (`injectMarkdown`) for the markdown-side strip (Step 3.5 at 1129, Step 4
at 1145). These two functions are where ANY change to stripping logic must land.