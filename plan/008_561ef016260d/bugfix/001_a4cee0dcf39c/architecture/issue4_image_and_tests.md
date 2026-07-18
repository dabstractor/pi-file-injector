# Issue 4 — Image magic-number sniff (§5.2 deviation) + Test-suite wiring

## Issue 4 — deliberate deviation, documentation-only

### The behavior (confirmed, documented)
`hasValidImageMagic(buf, mime)` (`file-injector.ts:62-90`) validates a file's bytes against the MIME
type declared by its extension BEFORE attaching it as an image. A genuine PNG renamed `photo.jpg` fails
the JPEG magic check and is delivered as a **binary note** (not attached as an image). This **deviates
from PRD §5.2** (PRD lines 294-314), which describes image classification as purely extension-based
(read → resize → attach, no magic-byte step).

**However**, this is **deliberate and documented** in `README.md:66`:
> "Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is
> injected as text, not attached as a broken image. An empty (0-byte) image attaches nothing."

The PRD (this bug-fix doc) flags it as "no fix is required if the team confirms the README's stricter
contract is the intended one." The implementation is the stricter, safer contract (never attach decoded
garbage). **Decision for this plan: no code change.** The PRD §5.2 wording is read-only (we do not edit
PRD.md). The README is the source of truth and already documents it correctly. This issue is **not a
code task** — it is recorded here for completeness and excluded from the implementation milestones.

### Why NOT to "fix" it to match §5.2 literally
Attaching a text file as an "image" (because it is named `.png`) would push decoded garbage into the
image array and produce a broken/invalid image to the provider. The magic-byte sniff is a genuine
robustness improvement. Reverting it would reintroduce a worse bug. The README contract is the intended
one. No subtask needed.

---

## Test-suite wiring (cross-cutting, applies to all issues)

### Current state (confirmed)
`package.json` line 9:
```json
"test": "node ./file-injector.test.mjs"
```
`npm test` runs ONLY `file-injector.test.mjs`. `import-behavior.test.mjs` (257 lines) and
`relative-imports.test.mjs` (513 lines) are **standalone scripts not wired into `npm test`**.

### Why this matters
- `import-behavior.test.mjs` test **4f** encodes the PRD-VIOLATING truncation behavior (Issue 1) and is
  the reason the bug persisted. After fixing 4f to assert the PRD-compliant outcome, this suite MUST be
  gated so the truncation behavior is protected going forward.
- `relative-imports.test.mjs` documents BUG CLASS 1 & 2 (its header, lines 1-19) and is a regression
  guard. It should also be gated.
- All three harnesses share the identical zero-dependency pattern: `process.exit(failed ? 1 : 0)`. They
  can be chained with `&&` in the `test` script; the chain fails fast on the first non-zero exit.

### The fix
`package.json` `test` script becomes:
```json
"test": "node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"
```
This is a `package.json` + documentation change (Mode A docs ride with it). It must land AFTER Issue 1's
test 4f fix (so the newly-wired suite is green), hence it depends on the Issue 1 subtask.

### Test harness patterns (for implementers)
- **Load mechanism** (shared): resolve global pi via `npm root -g`, load jiti from
  `PIPKG + "/node_modules/jiti/lib/jiti.mjs"`, `createJiti(import.meta.url, { alias: {...} })`,
  `jiti.import(path.resolve("file-injector.ts"))`.
- **`file-injector.test.mjs`**: `assert(cond,msg)`, `runCase(n,name,fn)` tally, `matrixRows` print.
  Mock ctx: `{ cwd, hasUI:false, isProjectTrusted:()=>true, ui:{ notify:()=>{} } }`. Paged-path:
  add `getContextUsage` + `model`.
- **`import-behavior.test.mjs`**: `test(name,fn)`, `assert(c,m)`, `mk(dir,rel,body)`, `run(cwd,prompt,bareAt)`
  passes `bareAt` as 4th positional arg. GROUP-1..5 sections. Exits `failed ? 1 : 0`.
- **`relative-imports.test.mjs`**: same pattern; BUG CLASS 1 & 2 regression guards.
