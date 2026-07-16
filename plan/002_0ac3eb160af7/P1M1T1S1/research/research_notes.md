# Research Notes — P1.M1.T1.S1 (paged-delivery constants, formatPagedDirectiveBlock, widen injectFiles types)

## Task scope (TYPE/SURFACE widening + constants + helper — NO behavioral change)
S1 is the scaffold for PRD §5.5 paged delivery. It adds 5 constants, 1 exported helper, widens the
`injectFiles` ctx param + return type, hardcodes `paged: 0` in both return sites, and updates the
injectFiles JSDoc. Runtime behavior is UNCHANGED (formatPagedDirectiveBlock not yet called; paged always 0).

OUT OF SCOPE (later subtasks, same file):
- S2: budget computation (getContextUsage/model), `let paged`/`let remaining`, the inline-vs-paged
  decision branch at the text-inject site (L199), the `count === 0 && paged === 0` guard change.
- S3: handler notify mode-aware ("N whole, M paged"), factory JSDoc ("No limits" paragraph), destructure `paged`.

## Exact edit sites (current HEAD line numbers — verified via grep; they SHIFT as code is inserted above)
- L17: `const TRAILING_PUNCT = ".,;:!?\")]}>'";` → insert 5 constants AFTER it.
- L110-112: `formatEmptyImageBlock` (ends `}` at L112) → insert `formatPagedDirectiveBlock` AFTER it.
- L114-121: `injectFiles` JSDoc → REWRITE for inline-vs-paged (§5.5) + new ctx/return fields.
- L122-126: `injectFiles` signature → widen `ctx` param (L125) + return type (L126, add `paged: number`).
- L209: early return `if (count === 0) return { text, images: imagesIn, injected: 0 };` → add `, paged: 0`.
- L217: final return `return { text: finalText, images, injected: count };` → add `, paged: 0`.
- DO NOT change the L209 guard (`count === 0`) — S2 changes it to `count === 0 && paged === 0`.
- DO NOT add `let paged = 0;` / `let remaining` — that's S2 (there's no paged variable in S1; both
  returns hardcode `paged: 0`).

## Test harness change (the ONLY test change in S1)
`file-injector.test.mjs` module-surface sanity check (L113-120): 8 `assert(typeof mod.X === "function")`.
ADD one for `formatPagedDirectiveBlock`. Natural spot: after the `formatEmptyImageBlock` assert (L119)
to keep format helpers grouped, OR after `hasValidImageMagic` (L120). Both fine; I'll put it right after
formatEmptyImageBlock. NO behavioral test changes.

## Verified facts (empirical, this machine)
- **Baseline harness: 34 passed, 0 failed** (`node ./file-injector.test.mjs`). Must stay 34/34 after S1.
- **No whole-object equality** on injectFiles return (grep for deepEqual/strictEqual/JSON.stringify(r) =
  empty). Tests access fields only (`r.text`, `r.injected`, `r.images`). → adding `paged: 0` is SAFE;
  no behavioral test breaks.
- **`FIX = { cwd: TMPDIR }`** (test L212) and `makeMockCtx` return `{ cwd, hasUI, ui }` — the mock ctx
  has ONLY `cwd` (and ui/hasUI). So the widened ctx type MUST make `getContextUsage?` and `model?`
  OPTIONAL, or the mock would no longer structurally satisfy the type. (Runtime: jiti transpiles
  without type-checking, so it wouldn't crash anyway — but optional is the honest, correct contract
  and matches the contract spec.)
- **formatPagedDirectiveBlock currently undefined**; **injectFiles return currently has no `paged` field**
  (injected=1 baseline preserved); **all 5 constants currently absent**. Verified by running the
  one-off `/tmp/verify_paged_s1.mjs` gate against current code → all "new surface" checks fail (proving
  the gate is meaningful); after S1 they pass.

## Verified API types (architecture/pi_api_verification.md — all 9 claims VERIFIED against dist .d.ts)
- **ContextUsage** (`types.d.ts:273-282`): `{ tokens: number | null; contextWindow: number; percent: number | null }`.
  `tokens` IS nullable (e.g. right after compaction). The contract's inline ctx type captures this.
- **getContextUsage()** returns `ContextUsage | undefined` (undefined when model/context unknown, e.g.
  before first LLM response). MUST null-check the whole result before reading `.tokens`.
- **ctx.model** = `Model<any> | undefined`. `Model` (pi-ai types.d.ts:600-618) has `contextWindow: number`
  and `maxTokens: number` as REQUIRED numbers — but `ctx.model` itself can be undefined, so guard it.
  => The contract's widened model type `{ contextWindow: number; maxTokens: number } | undefined` is
  a faithful structural subset (S2 only reads those two fields).
- **read tool DEFAULT_MAX_LINES == 2000** (`truncate.d.ts:10`) — confirms HEAD_BYTES=8192 ≈ 2000 lines
  and the directive's `limit:2000` instruction matches the read tool default.

## The 5 constants (PRD §5.5 "Constants (defaults to pin)") — exact values
```ts
const PAGED_THRESHOLD = 0.6;   // inject whole if fileCost <= PAGED_THRESHOLD * remaining
const MARGIN = 8192;           // safety bytes subtracted from remaining context
const HEAD_BYTES = 8192;       // head block size (~2000 lines, matches read tool DEFAULT_MAX_LINES)
const DEFAULT_WINDOW = 200000; // fallback context window (vestigial — usage.contextWindow preferred)
const DEFAULT_RESERVE = 8192;  // fallback for ctx.model?.maxTokens when model is absent
```
NOTE: MARGIN and DEFAULT_RESERVE are BOTH 8192 by coincidence — independent knobs. Do not unify.
Comment style: match the repo's terse inline comments citing the PRD section.

## formatPagedDirectiveBlock — exact body (em-dash U+2014 for visual consistency w/ formatBinaryBlock)
```ts
/** PRD §5.5 — directive block for a paged (oversize) text file. Emits a <file name="abs"> note giving
 *  the full path + estimated size and instructing the model to load the rest via the read tool at
 *  offset:0, limit:2000 (the read tool's DEFAULT_MAX_LINES), incrementing offset to read it all.
 *  Reuses the em dash (U+2014) from formatBinaryBlock/formatEmptyImageBlock for visual consistency.
 *  The head block is NOT this helper — it is formatTextFileBlock(abs, content.slice(0, HEAD_BYTES)). */
export function formatPagedDirectiveBlock(abs: string, totalBytes: number): string {
  return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first ' + HEAD_BYTES + ' bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>';
}
```
References HEAD_BYTES (constant) by name — stays consistent if HEAD_BYTES changes. For
formatPagedDirectiveBlock("/abs/x.ts", 50000) with HEAD_BYTES=8192 →
`<file name="/abs/x.ts"><large file — estimated 50000 bytes; first 8192 bytes injected above. Use the read tool to load the rest: offset:0, limit:2000, incrementing offset until the entire file is read></file>`
(where — is U+2014).

## Widened injectFiles ctx type (per contract; both new fields OPTIONAL so FIX mock still satisfies)
```ts
ctx: {
  cwd: string;
  getContextUsage?: () => { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
}
```
## Widened return type
```ts
Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }>
```

## jiti / no type-check reminder
The repo has NO tsconfig / tsc step. jiti transpiles TS on load (strips types, no type-check, no
noUnusedLocals). So a slightly-off type wouldn't crash at runtime — but the contract's exact widened
type is the correct, faithful representation and S2 depends on it. Unused-import warnings etc. do not
break loading. The test (.mjs) is plain JS — never type-checked.

## Pi version
`@earendil-works/pi-coding-agent` v0.80.7 (global). `npm root -g` → `/home/dustin/.local/lib/node_modules`.
