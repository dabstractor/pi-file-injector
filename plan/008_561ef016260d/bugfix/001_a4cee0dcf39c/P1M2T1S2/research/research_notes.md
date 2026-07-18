# Research Notes — P1.M2.T1.S2 (bugfix 001): renderInjectedMessage consumes content offsets (3-tier body resolution)

## Task
Change `renderInjectedMessage`'s expanded branch to a **3-tier body resolution** so that real injected files
(post-P1.M2.T1.S1, which carry `contentStart`/`contentLen` instead of a duplicated `body`) render their FULL
body via an offset slice — keeping the `d.body` and regex (`bodies[i]`) fallbacks for old/foreign/test entries
(§6.3/§12.23 defensive rendering). Plus Mode-A comment update + REND-11 robustness + a dedicated tier-1 unit case.

## The contract from P1.M2.T1.S1 (the parallel predecessor — assume it lands exactly as specified)

### FileDetail interface (S1 adds; `body` kept DEPRECATED)
```ts
export interface FileDetail {
  path, kind, chars?, lines?, range?, pagedHeadLines?, dimensionHint?;
  body?: string;          // KEPT deprecated — old/test/foreign fallback (renderer tier-2)
  directive?: string;     // DECLARED, populated by P1.M2.T2.S1 (NOT this task)
  contentStart?: number;  // char offset of the body within message.content (text/paged only)
  contentLen?: number;    // char length of the body slice (text: whole; paged: head)
}
```

### S1's other outputs (the input this task consumes)
- `emitText` −3 `body:` pushes (L895/L919/L927) → real files NO LONGER carry `body`.
- `export function computeDetailOffsets(blocks, details)` (new, ~L929) → mutates details: sets contentStart/
  contentLen for text/paged ONLY. headerLen = `'<file name="' + path + '">\n'.length` = 15 + path.length;
  footerLen = 8 (`"\n</file>"`); paged consumes 2 blocks (head + directive); cursor += block.length + 2.
- `before_agent_start` hoists `const content = blocks.join("\n\n")` + calls `computeDetailOffsets(blocks, details)`.
- Added `computeDetailOffsets` to the sanity list + ASSERTED_EXPORTS (S1's guard sync).

### CRITICAL interaction: injectFiles does NOT compute offsets
`injectFiles` returns `{ text, images, injected, paged, blocks, details }` where `details` has NEITHER body
(after S1) NOR offsets. Offsets are computed ONLY in `before_agent_start` via `computeDetailOffsets`. So a test
that calls `injectFiles` directly and renders with the result will hit tier-2 (pre-S1, body) or need an explicit
`computeDetailOffsets` call (post-S1, offsets).

## The current renderer (file-injector.ts) — exact code to edit

### FILE_BLOCK_RE (L620) + bodies[] computation (L649-655) — UNCHANGED (tier-3 fallback)
```ts
const FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;   // L620
// inside renderInjectedMessage (L649-655):
const bodies: string[] = [];
if (typeof message?.content === "string") {
  let m: RegExpExecArray | null;
  FILE_BLOCK_RE.lastIndex = 0;   // L652 — module regex w/ g flag → reset (MUST preserve)
  while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
    bodies.push(m[2].replace(/^\n|\n$/g, ""));   // strip wrapping newlines
  }
}
```

### The expanded branch — THE edit site (L671-677)
```ts
    if (opts.expanded) {
      // Prefer the EXACT stored body (BUG-1 fix); fall back to the regex-derived body for entries without one.   // L672
      const body = typeof d.body === "string" ? d.body : bodies[i];   // L673 ← REPLACE with 3-tier
      if (body !== undefined && d.kind !== "image") {   // L674 — image guard (MUST preserve)
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);   // L675 — unchanged
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;          // L676 — unchanged
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
    }
```

### The NEW 3-tier body resolution (the core edit)
```ts
      // 3-tier body resolution (§12.22): offset slice (real emission, post-P1.M2.T1.S1) → stored body
      // (old/foreign/test) → regex fallback (last resort). Tier-1 slices message.content EXACTLY — BUG-1-safe
      // because the offsets are length-derived (block.length − header − footer), NOT regex: a body containing a
      // literal </file> (which would truncate FILE_BLOCK_RE's lazy capture) slices whole. Tiers 2/3 preserve the
      // §6.3/§12.23 defensive-rendering contract for entries without offsets (REND-* craft body; old persisted msgs).
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body : bodies[i]);
```
(Keep `if (body !== undefined && d.kind !== "image")` + highlightCode/getLanguageFromPath unchanged.)

### Comment to update (Mode A, item §5) — the FALLBACK comment L644-648 + inline L672
Current L644-648 says "emitText now stores the EXACT body in detail.body; the renderer prefers it". After S1,
real emission stores OFFSETS (not body). Update to document the 3 tiers (offset → body → regex) + WHY offsets
are BUG-1-safe (length-derived, not regex).

## BUG-1 recap (why this subtask exists)
A file whose OWN content contains a literal `</file>` (e.g. `nest.ts` = `Example:\n<file name="d">nested</file>\nDONE\n`)
makes FILE_BLOCK_RE's lazy `([\s\S]*?)` truncate at the INNER `</file>` → the regex-derived `bodies[i]` MISSES
the `'DONE'` text after it. Today's renderer avoids BUG-1 via tier-2 (`d.body`, the exact stored body). Once S1
REMOVES body from real emission, real files fall through to `bodies[i]` (regex) → BUG-1 REGRESSES. This subtask
closes the regression: tier-1 (offset slice) replaces body as the exact-recovery path for real files, BUG-1-safe.

## Test impact (file-injector.test.mjs) — the REND cluster

### Helpers (L2564-2566)
```js
const REND_THEME = { fg: (_k, t) => t, bg: (_k, t) => t, bold: (t) => t };   // stubTheme (unstyled)
const REND_W = 2000;
const textOf = (child) => child.render(REND_W).join("\n");
```
`renderInjectedMessage` is a PURE function — pass crafted `{ details:{files:[...]}, content }` + REND_THEME.

### REND-11(b) — THE conflict (breaks post-S1)
```js
// (b) E2E (injectFiles → render), current L2707-2718:
const r = await mod.injectFiles("Review #@nest.ts", [], FIX);   // nest.ts in buildFixtures L236
...
const d = r.details[0];
assert(typeof d.body === "string" && d.body.includes("DONE"), ...);   // ← FAILS post-S1 (body removed)
assert(r.blocks[0].includes("DONE"), ...);                          // OK (model-facing content intact)
const published = { details: { files: r.details }, content: r.blocks.join("\n\n") };
const exp = mod.renderInjectedMessage(published, { expanded: true }, REND_THEME);
const shown = textOf(exp.children[exp.children.length - 1]);
assert(shown.includes("DONE"), ...);   // ← FAILS post-S1 (no offsets → tier-3 regex truncates 'DONE')
```
Post-S1: `injectFiles` details have NO body AND NO offsets (offsets are computed in before_agent_start). So both
asserts break. The current working tree is PRE-S1 (147 passed; body still set), so REND-11(b) passes TODAY but
breaks once S1 lands.

### Robust REND-11(b) fix (passes BOTH pre- and post-S1)
- DROP the brittle `assert(typeof d.body === "string"...)`.
- Simulate before_agent_start's offset pass: `if (typeof mod.computeDetailOffsets === "function") mod.computeDetailOffsets(r.blocks, r.details);`
  (the guard makes it forward-compatible — a no-op pre-S1 when the export is absent; populates offsets post-S1).
- Assert on the RENDERED output only ("DONE" shown) — the renderer's 3-tier resolution handles body (pre-S1, tier-2)
  OR offsets (post-S1, tier-1). This is exactly the BUG-1 display contract.
- Keep `assert(r.blocks[0].includes("DONE"))` (model-facing content intact — delivery unaffected).

### NEW REND-OFFSET unit case (tier-1 in isolation — the primary new behavior)
Craft a detail with `contentStart`/`contentLen` (NO body) + a content string containing a nested `</file>`;
assert the renderer's offset slice shows the EXACT body. Pure renderer test — independent of S1 state (offsets
crafted in-test). Pins tier-1 directly (REND-11(b) exercises it only transitively + needs S1's computeDetailOffsets).

### REND-8 (defensive fallback) — UNAFFECTED
REND-8 tests `files.length === 0` (no details) → the fallback line path. My edit is in the `for (files)` loop's
expanded branch. REND-8 never reaches it. No change needed; it stays green.

### REND-1..7,9,10 — UNAFFECTED
They craft details WITH body (tier-2) or test collapsed lines / colors / tildify. My 3-tier change preserves
tier-2 (`typeof d.body === "string" ? d.body : ...`) → they stay green.

## Module-surface guard — NO change needed for this task
`renderInjectedMessage` is ALREADY in the sanity list (L133) + ASSERTED_EXPORTS (L144). `computeDetailOffsets`
is S1's export (S1 adds it to the guard). My task adds NO new exports. (If the implementer's tree has S1 landed,
the guard already knows computeDetailOffsets; if not, S1 owns that sync. Not my edit.)

## Gates
- `npm run typecheck` → 0 errors (`--strict`). The 3-tier uses `d.contentStart`/`d.contentLen` (optional numbers
  on FileDetail post-S1). PRE-S1 these fields don't exist on the interface → TS would ERROR on `d.contentStart`.
  MITIGATION: the renderer's `message`/`d` are typed `any` (the renderer signature is `(message: any, ...)` and
  `files: FileDetail[]` but `d` is accessed loosely). VERIFY: typecheck passes pre-S1 (the `any` message means
  `d.contentStart` is allowed even if FileDetail lacks the field — `d` comes from `message?.details?.files ?? []`
  which is typed FileDetail[]... need to confirm `d.contentStart` compiles pre-S1).
  → CHECK: if FileDetail lacks contentStart pre-S1, `d.contentStart` is a TS error under --strict. The robust
    fix: access via bracket/index or cast. BUT the architecture doc + S1 PRP both show the renderer reading
    `d.contentStart` directly, implying FileDetail HAS the field. Since S1 lands in parallel and adds the field,
    the MERGED state compiles. For a PRE-S1 tree, the implementer may need `(d as any).contentStart` OR rely on
    S1 landing first. The PRP will note this and recommend the field access that matches S1's interface.
- `node ./file-injector.test.mjs` → 0 failed (baseline 147 + REND-OFFSET; REND-11 robust). 
- `node ./relative-imports.test.mjs` + `node ./import-behavior.test.mjs` → 0 failed (unchanged — don't render).

## Scope boundaries
- file-injector.ts: EDIT renderInjectedMessage expanded branch (L672-673) + comment (L644-648, L672). UNCHANGED:
  bodies[] computation, FILE_BLOCK_RE.lastIndex reset, image guard, highlightCode/getLanguageFromPath, readLine,
  the collapsed branch, the fallback (files.length===0) branch. NO emitText/before_agent_start/FileDetail edits
  (S1's scope). NO directive rendering (P1.M2.T2.S1's scope).
- file-injector.test.mjs: EDIT REND-11(b); ADD REND-OFFSET. UNCHANGED: REND-1..10, REND-8, all other cases,
  captureAllHandlers, makeMockCtx, buildFixtures, the sanity list + ASSERTED_EXPORTS.
- No other files. No README (P1.M3.T2.S1).
