# Research Notes — P1.M1.T1.S3 (Confirm three §1 requirements are exercised by named test cases)

## Current state (verified this session)

All three suites green (this is the `P1.M1.T1.S1` deliverable, already Complete):

```
file-injector.test.mjs      → 122 passed, 0 failed
relative-imports.test.mjs   →  38 passed, 0 failed
import-behavior.test.mjs    →  22 passed, 0 failed
                                182 passed total, 0 failed
```

Output format (exact strings to assert on at run time):
- `Result: 122 passed, 0 failed.`
- `Result: 38 passed, 0 failed.`
- `Result: 22 passed, 0 failed.`

## The three §1 delta requirements (from contract + arch/system_context.md)

- **A — 4-source config merge (`readConfig`, §4.6).** `SETTINGS_KEY = "fileInjector"`; 4 sources in precedence order; trust gate `ctx.isProjectTrusted()` wraps BOTH project sources; missing/malformed → `{}` no throw.
- **B — Depth-uniform markdown resolution (§4.5 rule 5 + §4.6).** `injectMarkdown()` has NO depth param; base dir is ALWAYS `path.dirname(abs)`; NO `ctx.cwd` in resolution; NO cwd fallback. Applies at every recursion level.
- **C — Depth-uniform bare-@ matching (§4.6).** `markdownBareAtImports` on → bare `@path` honored at EVERY depth incl. the very first imported file (no first-file asymmetry); `BARE_AT_RE` never double-matches `#@`; off (default) → inert at every depth.

## Named-case → file:line map (the core of this subtask)

### Requirement A — `file-injector.test.mjs` (T2.S1-e/-f/-g are at the `settings.json` block)

Group header comment at `:2032` ("readConfig reads the namespaced `fileInjector` key from settings.json too").
Helper `writeSettings()` writes `<TMPDIR>/.pi/settings.json` and removes it in `finally` (sibling isolation).

| ID  | line | exact case title (the `await runCase(...)` first arg) | what it asserts (strong) |
|-----|------|-------------------------------------------------------|--------------------------|
| T2.S1-e | :2045 | `readConfig settings.json {fileInjector:{markdownBareAtImports:true}} + trusted → true` | dedicated file emptied → settings.json KEY alone enables the option (`r.markdownBareAtImports === true`) |
| T2.S1-f | :2063 | `readConfig settings.json key + UNTRUSTED → ignored (baseline); trusted → project value` | untrusted === GLOBAL_BASELINE, trusted === flip (negation), and the two differ (proves gate regardless of env) |
| T2.S1-g | :2086 | `readConfig precedence: file-injector.json overrides settings.json key (false wins)` | dedicated file `false` + settings key `true` → result `false` (dedicated wins within scope) |

(Surrounding context cases T2.S1-a/-b/-c/-d at :1977-2019 cover the dedicated-file merge + trust gate + malformed; T2.S1-h at :2100 covers malformed settings.json. All green.)

### Requirement B — `relative-imports.test.mjs` (GROUP A = `resolveImportPath`, GROUP C = `injectFiles`)

Test harness: `test(name, fn)` helper (`:54`); each case builds a FRESH tmp tree with UNIQUE content markers so an assertion can tell WHICH physical file was chosen. `run(cwd, prompt, bareAt=false)` → real `mod.injectFiles`.

| ID  | line | exact case title | strong assertion (both directions) |
|-----|------|------------------|------------------------------------|
| A1  | :99  | `A1: same name in baseDir AND cwd → baseDir copy wins (the core disambiguation)` | `r === .../nested/x.md` AND `!has(r,"ROOT")` — message explicitly calls out cwd bug |
| A7  | :147 | `A7: missing token → null with NO cwd fallback (a same-named root file must NOT be chosen)` | `r === null` despite cwd-root `ghost.md` existing |
| A9  | :161 | `A9: resolution is independent of process.cwd() when baseDir is absolute` | `process.chdir(os.tmpdir())` then resolves same abs; result identical from unrelated cwd |
| C1  | :255 | `C1: nested file imports same-name file → file-relative copy wins, cwd-root copy loses` | `B-FILE-RELATIVE` present, `B-CWD-ROOT` absent, `countAbs(.../b.md) === 0` (cwd copy ZERO blocks) |
| C2  | :266 | `C2: user's exact deep scenario — #@directory/otherdir/some/file.md → #@file2.md resolves in that dir` | `FILE2-CORRECT` present, `FILE2-WRONG-CWD` absent |

(GROUP C also has C3–C12 covering `../`, multi-level chains, shorthand, .markdown, code-exempt, missing→verbatim, dedup, cycle — all reinforce "no cwd fallback at any depth".)

### Requirement C — depth-uniform bare-@ (relative-imports.test.mjs GROUP D + import-behavior.test.mjs GROUP 2 & 5)

**relative-imports.test.mjs GROUP D** (`:375` header "first-level bare-@ (BUG CLASS 2): markdownBareAtImports on"):

| ID  | line | exact case title | asserts |
|-----|------|------------------|---------|
| D1  | :382 | `D1: the user's exact case — first imported file uses bare @ → honored (full imp chain)` | bare-@ entry imports whole chain `[imp1,imp2,imp3,main2]` |
| D2  | :396 | `D2: bare @ works at EVERY depth (no first-level asymmetry): @→@→@` | A,B,C markers all present (depth 0→1→2) |
| D4  | :416 | `D4: setting OFF → bare @ is inert in the first AND every imported file (only #@ imports)` | `B-MARKER` absent, `injected === 1` |
| D5  | :435 | `D5: real handler + hermetic project config ON → first-level bare @ honored end-to-end` | via real `input` handler, `action === "transform"`, chain `[imp1,imp2,main2]` |
| D6  | :448 | `D6: real handler counts EVERY file across a bare-@ chain in the notify message` | `notified === "#@ injected 4 whole"` |
| D7  | :464 | `D7: real handler + hermetic project config OFF → first-level bare @ inert (only #@ imports)` | handler yields `[main2.md]` only |

**import-behavior.test.mjs** (`run(cwd,prompt,bareAt)` → `mod.injectFiles`; GROUP 5 uses the REAL handler with cfg loaded from live settings):

| ID  | line | exact case title | asserts |
|-----|------|------------------|---------|
| 2a  | :91  | `2a: depth-1 file may use bare @ (prompt #@a.md; a.md has '@b.md'; b.md has '@c.md') → A,B,C all injected` | chain honored across depths |
| 2b  | :101 | `2b: the FIRST imported file must NOT require #@ (same chain, a.md bare @ only)` | B-MARKER present — pins the reported bug |
| 2c  | :110 | `2c: with setting OFF, bare @ in a markdown file is inert (only #@ imports) — regression guard` | B-MARKER absent |
| 5a  | :200 | `5a: depth-0 EXACT user line '*...@ARCHITECTURE.md.*' (bare @, italic+glue) → imports [injectFiles]` | ARCH-MARKER present |
| 5b  | :208 | `5b: SAME via the REAL handler path (cfg from live settings → bareAt derived inside handler)` | `action === "transform"` |
| 5c  | :217 | `5c: depth-0 plain bare-@ (own line, no glue) → imports` | B-MARKER present |
| 5d  | :224 | `5d: depth-0 bare-@ ALSO via the real handler path (plain, no glue)` | transform + B-MARKER |
| 5e  | :231 | `5e: NO asymmetry — depth-0 AND depth-1 bare-@ BOTH honored (setting on)` | B AND C both present |
| 5f  | :241 | `5f: setting OFF → bare-@ inert at depth-0 AND depth-1 (regression guard)` | B AND C both absent |

## Conclusion of research

ALL named cases from the contract definition are PRESENT, RUN, and assert the correct behavior with
strong (two-direction: positive + explicit-negative-bug-message) assertions. No case is missing and
none are weakened. This subtask is a pure verification pass: confirm presence + green + correct
assertions, then emit the confirmation table. No code change is expected (unless the re-run surfaces
a regression, in which case the contract forbids weakening/deleting — fix the offending function).
