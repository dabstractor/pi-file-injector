# Test Harness Analysis — Bugfix 001_0aea8e8cbcc6

## Harness mechanics (how tests load the real module)

`file-injector.test.mjs` is a zero-dependency ESM script (no test framework). It:

1. Resolves the global pi package via `npm root -g` → `@earendil-works/pi-coding-agent`.
2. Loads jiti from `<PIPKG>/node_modules/jiti/lib/jiti.mjs`, configured with the SAME alias map
   Pi's extension loader uses (`@earendil-works/pi-coding-agent` → dist, `@earendil-works/pi-ai`
   → compat).
3. `jiti.import(<abs path to file-injector.ts>)` → `mod` (the REAL committed module, transpiled).
4. Runs `runCase(n, name, fn)` blocks that throw on failure; prints `✓`/`✗`; exits 1 on any fail.

`mod` exposes: `injectFiles`, `readConfig`, `scanTokens`, `injectFile`, `formatTextFileBlock`,
`emitText`, `isRegularFile`, `resolveImportPath`, etc. (everything `export`ed in the .ts).

### Shared fixtures / context

- `FIX` (harness ~line 383): `{ cwd: TMPDIR, getContextUsage: () => ({tokens:10000, contextWindow:50000, percent:20}) }`.
  Used by most `injectFiles` cases. `TMPDIR` is the harness's temp dir with fixtures (a.ts, huge.log,
  pic.png, data.bin, etc.).
- `makeMockCtx(TMPDIR)` / `captureHandler()`: used by handler-guard cases (G1-G3).
- A tiny 1×1 PNG (harness ~line 182) makes `resizeImage` return `null` DETERMINISTICALLY → the raw
  base64 fallback. **`resizeImage` is NOT mockable** here (hard import — see system_context Finding D).

### Root-skip convention

chmod-based cases MUST guard `if (process.getuid() === 0) { console.log("...skipped..."); return; }`
because chmod 000 is ineffective under root. Established by `E4` and the P1M1T3S1 cases.

## The E4 case — exact template for the new regression test

`file-injector.test.mjs` ~lines 600-615 (TOP-LEVEL unreadable file — works correctly today):

```js
await runCase("E4", "read error (chmod 000) → token verbatim, no throw", async () => {
  if (process.getuid() === 0) {
    console.log("      (skipped: running as root — chmod 000 is ineffective)");
    return;
  }
  const secret = path.join(TMPDIR, "secret.txt");
  fsSync.writeFileSync(secret, "top secret\n");
  fsSync.chmodSync(secret, 0o000);
  try {
    const r = await mod.injectFiles("Read #@secret.txt", [], FIX);
    assert(r.injected === 0, `expected injected===0 on unreadable file, got ${r.injected}`);
    assert(r.text === "Read #@secret.txt", "unreadable-file token must be left verbatim");
  } finally {
    fsSync.chmodSync(secret, 0o644); // restore so cleanup can remove it
  }
});
```

This is the model for the markdown-import unreadable regression case. Place the new case adjacent
to the other markdown-import edge cases (search the harness for `EDG-` / `case 21` / `§10 md edge`)
or right after `E4` so the chmod-000 + finally-restore idiom is colocated.

## New regression case (Issue 1) — specification

**Purpose:** prove the PRIMARY fix. A delivered markdown imports an UNREADABLE file; the parent's
emitted block MUST still contain the literal `#@<path>` marker (verbatim), and NO `<file>` block is
appended for the unreadable import.

Sketch (adapt the E4 idiom; run inside the existing `TMPDIR` or a fresh subdir):

```js
await runCase("E5", "§5.4 md import of UNREADABLE file → marker verbatim (Issue 1)", async () => {
  if (process.getuid() === 0) { console.log("      (skipped: running as root)"); return; }
  const api = path.join(TMPDIR, "api.md");        // exists but will be unreadable
  const notes = path.join(TMPDIR, "notes.md");    // imports api.md
  fsSync.writeFileSync(api, "API secret\n");
  fsSync.writeFileSync(notes, "Notes intro.\n#@api.md\nNotes end.\n");
  fsSync.chmodSync(api, 0o000);                    // stat OK, readFile EACCES
  try {
    const r = await mod.injectFiles("Read #@notes.md", [], FIX);
    // parent IS delivered (it is readable) — marker stripped at top level
    assert(/Read notes\.md\b/.test(r.text), "top-level #@notes.md marker stripped to notes.md");
    // the unreadable import's marker is LEFT VERBATIM in notes.md's block (Issue 1 fix)
    assert(r.text.includes("#@api.md"),
      `unreadable md import must keep '#@api.md' verbatim (PRD §5.4/§5.6 step 4/§12.5), got:\n${r.text}`);
    // NO <file> block appended for the unreadable import
    assert(!r.text.includes(`<file name="${api}">`),
      "unreadable import must NOT deliver a <file> block");
    assert(r.injected === 1, `only notes.md delivered (api.md unreadable), got ${r.injected}`);
  } finally {
    fsSync.chmodSync(api, 0o644); // restore so TMPDIR cleanup can remove it
  }
});
```

**Naming:** the harness uses free-form string case ids (`E1..E4`, `EDG-1..4`, `T2.S1-f`, …). Pick
`E5` (extends the chmod-error family) or a descriptive id; either is consistent with the existing
convention. Do NOT reuse an existing id.

**Bare-`@` variant (optional, if `markdownBareAtImports` is exercised):** with the option ON, an
unreadable `@api.md` import should likewise keep its `@api.md` marker verbatim (prefixLen 1). The
harness already sets up a bare-`@` markdown fixture (`notesBare.md`); a parallel case can reuse it.
Lower priority — the `#@` case is the PRD-cited trigger.

## Secondary-fix test (Issue 1, claim hygiene)

The cleanest assertion of "claim ⟺ delivered" uses an UNREADABLE top-level file (forces
`injectFile`'s catch) and checks the module does not retain the path as delivered. Since
`injectedSet` is internal State, assert the OBSERVABLE consequence instead: a prompt with TWO
references to the same unreadable path must not behave as if one "delivered". At top level this is
already correct (stripping keys off the boolean), so the assertion is mostly a guard against
regression of the delete-on-fail. Keep it lightweight (1 assertion) and document that the real
value is the invariant, not a user-visible behavior change.

## Issue 2 — the fix is ALREADY in the working tree

**Do NOT re-implement.** `git diff file-injector.test.mjs` shows the whole `T2.S1-*` family was
rewritten to capture a `GLOBAL_BASELINE` and make every case relative to it. `T2.S1-f`
(~lines 1999-2018) already:

1. captures the current dedicated-file content (`fileValid`),
2. writes `"{}"` to `PROJ_FILE_PATH` to NEUTRALIZE it (the exact isolation the PRD asks for),
3. writes the settings.json `fileInjector.markdownBareAtImports = flip` (negation of baseline),
4. asserts `untrusted → baseline` and `trusted → flip`,
5. restores `fileValid` and removes the settings.json in `finally`.

The suite reports **120 passed, 0 failed** in an environment with a dogfooded global config. The
PRD's prose ("does NOT isolate the project dedicated file") describes the PRE-fix committed state,
not the current working tree.

**The plan's Issue-2 task is therefore:** VERIFY the already-applied fix is correct & complete
against PRD §4.6, confirm the full suite is green, and ensure it is RETAINED (committed). Only if a
fresh checkout lacks it should the exact PRD "Suggested Fix" pattern be applied.

## Current suite state (verified)

```
node ./file-injector.test.mjs  →  Result: 120 passed, 0 failed.
```

(120 = pre-existing harness cases incl. the rewritten T2.S1-* family. The new Issue-1 regression
case will be added on top → 121 expected.)

## typecheck gate

```
node ./scripts/typecheck.mjs  →  file-injector.ts type-checks clean under --strict (0 errors)
```

Both fixes are `fs`/`fs.constants` only (already imported) — no new imports, so the gate should
remain green with no tsconfig changes.
