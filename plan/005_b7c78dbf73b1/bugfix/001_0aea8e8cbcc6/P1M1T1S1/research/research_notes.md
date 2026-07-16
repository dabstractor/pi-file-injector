# Research Notes — P1.M1.T1.S1 (bugfix 001): R_OK readability gate in injectMarkdown Step 3.5 + regression test

## Mission
Fix Issue 1 (Major): a markdown import whose target EXISTS (stat-OK) but is UNREADABLE (readFile EACCES)
has its `#@`/`@` marker STRIPPED in the parent's emitted block (Step 4), yet no block/image is appended
(Step 6's injectFile fails on readFile). This violates PRD §5.4/§12.5/§10/§5.6-step-4 "leave verbatim on
error" + the README "permission error → Left as written" row. Fix = add an `fs.access(R_OK)` gate to
injectMarkdown Step 3.5 so a record is `injectable` iff stat-OK && isFile && READABLE. Add regression case E5.

**Scope = S1 ONLY:** the R_OK gate + the E5 regression test. NOT the "un-claim on failure" (Fix site 2 = S2);
NOT the image-resize-throw structural residual (out of scope, documented only).

## Baseline (MUST stay green)
- `node ./file-injector.test.mjs` → **120 passed, 0 failed.**
- `npm run typecheck` → **"0 errors"** under `--strict`.
- Working tree: file-injector.ts is 1087 lines, UNMODIFIED.

## Root cause (system_context.md "Data flow through the bug site")
```
Step 3   scanTokens → records[]          (only RESOLVED = existing regular files)
Step 3.5 for r in records: stat+isFile → injectable[]   ← checks EXISTENCE only, NOT readability  ← BUG SITE
Step 4   strip '#@'/'@' from each injectable (high→low) → `stripped`
Step 5   emitText(abs, stripped, state)                  ← block PUSHED here (pre-order)
Step 6   for r in injectable: await injectFile(r.abs)    ← readFile happens HERE; may throw → false (TOO LATE)
```
The pre-order contract (block emitted Step 5, BEFORE recursion Step 6) forces the strip decision (Step 4)
BEFORE delivery is attempted (Step 6). Step 3.5's job is to PREDICT deliverability — but `stat`+`isFile`
does not imply `readFile` will succeed (EACCES on the file itself). The TOP-LEVEL path is unaffected:
processTokenStream strips a marker only when injectFile returns true (inject-then-strip). The asymmetry is
markdown-path-specific.

scanTokens/resolveImportPath already filter MISSING and DIRECTORY imports (stat via isRegularFile), so those
keep their marker verbatim today. The ONLY unhandled class is exists-but-unreadable.

## The exact fix (code_changes_analysis.md §"Fix site 1" — PRIMARY)
File: `file-injector.ts`, function `injectMarkdown` (L824-877), Step 3.5 loop L848-856.

**Current (L848-856):**
```ts
const injectable: { index: number; prefixLen: number; abs: string }[] = [];
for (const r of records) {
  try {
    const st = await fs.stat(r.abs);
    if (st.isFile()) injectable.push(r);
  } catch {
    /* missing/unreadable → leave verbatim (not stripped, not injected) */
  }
}
```

**After:**
```ts
const injectable: { index: number; prefixLen: number; abs: string }[] = [];
for (const r of records) {
  try {
    const st = await fs.stat(r.abs);
    if (!st.isFile()) continue;                       // directory/socket/etc → verbatim (§5.4) — unchanged
    await fs.access(r.abs, fs.constants.R_OK);         // ← gate strip on READABILITY (PRD §5.4/§12.5)
    injectable.push(r);
  } catch {
    /* missing / directory / unreadable → leave verbatim (not stripped, not injected) */
  }
}
```

## Why fs.access(R_OK) is the right primitive (VERIFIED)
- `fs` is `import { promises as fs } from "node:fs"` (L4). `fs.constants.R_OK === 4` IS reachable through the
  promises namespace at runtime (Node ≥18). **No new import.** Verified live:
  `node -e 'import("node:fs").then(({promises:fs})=>console.log(fs.constants.R_OK, typeof fs.access))'` → `4 function`.
- Tests the EXACT permission readFile needs → `strip ⟺ deliverable` for text/markdown/binary (the dominant case).
- R_OK on a directory the user can traverse but a file they cannot read → throws → verbatim. On missing → throws
  (stat already caught it). On a regular readable file → passes → injectable (happy path unchanged).

## Behavior-change table (all intended, all per PRD)
| Import target (inside delivered markdown) | Before | After |
|---|---|---|
| missing | verbatim ✓ | verbatim ✓ (unchanged) |
| directory | verbatim ✓ (isFile false) | verbatim ✓ (unchanged) |
| **exists, UNREADABLE (EACCES/IO)** | **marker STRIPPED, no block ✗ BUG** | **verbatim, no block ✓ FIXED** |
| exists, readable (text/md/binary) | stripped + block ✓ | stripped + block ✓ (unchanged) |
| readable image, resize OK | stripped + image ✓ | stripped + image ✓ (unchanged) |
| readable image, resizeImage THROWS | marker stripped, no image ✗ | marker stripped, no image ✗ (RESIDUAL — see below) |

## Residual (OUT OF SCOPE — documented in the Step 3.5 comment only)
A readable image (`#@pic.png`) whose `resizeImage` THROWS (not returns null): passes stat+isFile+R_OK
(readable!) but injectFile's resizeImage throws → marker stripped, no image. R_OK cannot predict a resize
failure without running the resize (expensive, duplicative). Fully closing it needs the structural "strip only
markers whose injectFile returned true" approach (PRD calls it "more invasive" — edits an already-pushed block).
Acceptable to defer: resizeImage is documented to return null (not throw); a throw is an internal error, not a
normal workflow (contrast: an unreadable restricted file IS a normal workflow — that's what Issue 1 fixes).
NOTE this residual in the Step 3.5 comment + the narrow TOCTOU residual (file becomes unreadable between
access and readFile — backstopped by injectFile's readFile try/catch → false).

## ⭐ CRITICAL gotcha for the E5 regression test: use UNIQUE fixture names
The item's illustrative "api.md"/"notes.md" names would CLOBBER the SHARED buildFixtures entries
(`fsSync.writeFileSync(path.join(TMPDIR,"notes.md"), …)` L214; `…,"api.md", …` L215) that LATER markdown cases
depend on (case 15, 16, MD1 at test L1569, cases 17-20). E5 is placed right after E4 (~L615), well BEFORE
those cases — so overwriting notes.md/api.md mid-suite would break them.

→ Use UNIQUE names, e.g. `perm_api.md` (chmod 000) + `perm_notes.md` (body imports `#@perm_api.md`). The
finally restores chmod 644 on perm_api.md only (for TMPDIR cleanup). No shared fixture is touched.
The item's "api.md"/"notes.md" are illustrative; the regression just needs an UNREADABLE imported file + a
READABLE parent markdown. Mirror E4's exact structure (L599-615): root-skip guard, try/finally chmod 644.

## E5 test spec (modeled on E4, TDD: RED → implement → GREEN)
Place right after E4 (~L615). Use `runCase("E5", "…", async () => { … })`.
```js
await runCase("E5", "markdown import of unreadable file → marker verbatim in parent block, no block, injected=1", async () => {
  if (process.getuid() === 0) {
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  const api = path.join(TMPDIR, "perm_api.md");          // UNIQUE name (do NOT clobber shared api.md)
  const notes = path.join(TMPDIR, "perm_notes.md");      // UNIQUE name (do NOT clobber shared notes.md)
  fsSync.writeFileSync(api, "API secret\n");
  fsSync.writeFileSync(notes, "Notes intro.\n#@perm_api.md\nNotes end.\n");
  fsSync.chmodSync(api, 0o000);
  try {
    const r = await mod.injectFiles("Read #@perm_notes.md", [], FIX);
    assert(r.injected === 1, `expected injected===1 (only perm_notes.md; perm_api.md unreadable), got ${r.injected}`);
    assert(r.text.includes("#@perm_api.md") === true, "the unreadable import marker must be LEFT VERBATIM in the parent block (PRD §5.4/§12.5)");
    assert(!r.text.includes('<file name="' + api + '">'), "no <file> block must be appended for the unreadable import");
    assert(r.text.includes('<file name="' + notes + '">'), "the parent markdown block IS delivered (readable)");
  } finally {
    fsSync.chmodSync(api, 0o644); // restore so TMPDIR cleanup can remove it
  }
});
```
RED before the fix: `r.text.includes("#@perm_api.md")===true` FAILS (marker stripped to bare `perm_api.md`).
GREEN after the fix: R_OK gate drops perm_api.md from injectable → marker not stripped → verbatim.

## Gates
1. `node ./file-injector.test.mjs` → existing 120 + new E5 = 121 passed, 0 failed, exit 0.
2. `npm run typecheck` → 0 errors (fs.access/fs.constants.R_OK are standard; no new import; no new export).
3. TDD order: add E5 (RED) → implement the R_OK gate → E5 GREEN → full suite GREEN.

## Scope boundaries (S1 = this subtask ONLY)
- ❌ Fix site 2 "un-claim abs on injectFile failure" (claim ⟺ delivered) = S2.
- ❌ Image-resize-throw structural fix (strip-after-recursion) = out of scope; residual only.
- ❌ README edit = no edit expected (README.md:52 already states "permission error → Left as written"; this fix
  brings the code INTO compliance — just VERIFY the row still matches, no edit).
- ❌ No new exports (injectMarkdown is PRIVATE); no module-surface guard change.
- ❌ Do NOT reuse the shared api.md/notes.md fixture names in E5 (clobber risk → use perm_api.md/perm_notes.md).

## Docs (Mode A — rides with the work)
- Update the injectMarkdown Step 3.5 comment (L837-847): "READABILITY PRE-CHECK" (not just existence); cite
  PRD §5.4/§12.5; add the ONE-LINE residual note (TOCTOU + resizeImage-throw → still stripped; backstopped by
  injectFile's try/catch → no crash, no block).
- VERIFY README.md:52 ("Missing file, directory, or permission error → Left as written. Nothing is appended.")
  still matches — no edit (the fix complies with existing docs).
