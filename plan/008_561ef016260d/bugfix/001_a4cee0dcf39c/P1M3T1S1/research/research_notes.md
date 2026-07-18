# Research Notes — P1.M3.T1.S1 (chain all three harnesses into `npm test`)

> A tiny, well-defined wiring task: change `package.json` `scripts.test` from a single-harness
> invocation to an `&&`-chain of all three repo-root harnesses. Research goal: (1) confirm all three
> harnesses are green standalone + share the identical fail-fast exit pattern; (2) pin the exact edit
> (line 9, one string value); (3) confirm no dependency conflict with the parallel P1.M2.T2.S1 task.

---

## 1. The three harnesses (VERIFIED green standalone — snapshot 2025-07-18)

All three live at the repo root, are zero-dependency Node ESM scripts, and share the SAME
`process.exit(failed ? 1 : 0)` pattern → they chain cleanly with `&&` (shell fail-fast on first non-zero exit).

| Harness | File | Exit pattern (line) | Snapshot count | Exit code |
|---|---|---|---|---|
| Primary gate | `file-injector.test.mjs` (213 KB) | `process.exit(failed > 0 ? 1 : 0)` (L2768) | **148 passed, 0 failed** | 0 |
| Issue-1 regression | `import-behavior.test.mjs` (17 KB) | `process.exit(failed ? 1 : 0)` (L274) | **23 passed, 0 failed** | 0 |
| Rel-import regression | `relative-imports.test.mjs` (32 KB) | `process.exit(failed ? 1 : 0)` (L513) | **38 passed, 0 failed** | 0 |

- Each prints a `Result: N passed, M failed` summary line then exits. Exit is **0 ⟺ M === 0**.
- Total cases across the three: 148 + 23 + 38 = **209** (snapshot). NOTE: P1.M2.T2.S1 (parallel) adds 2
  cases to file-injector.test.mjs (REND-PAGED-DIR + ISS3-DIRECTIVE) → ~150 when it lands. The
  load-bearing contract is **each harness `0 failed` + exit 0**, not a fixed total.
- Exactly 3 `*.test.mjs` files at repo root (`ls *.test.mjs`): no fourth harness to wire.

## 2. The current `npm test` + the exact edit (VERIFIED)

`package.json` is 14 lines, 2-space indented, valid JSON. `scripts` block (L7-10):
```json
  "scripts": {
    "typecheck": "node ./scripts/typecheck.mjs",
    "test": "node ./file-injector.test.mjs"
  },
```
- **L8** `typecheck` — PRESERVE (the --strict gate; `npm run typecheck` must still work).
- **L9** `test` — THE edit. Currently `"node ./file-injector.test.mjs"` (no trailing comma — it is the
  LAST key in `scripts`). Target value (from contract LOGIC + architecture/issue4 doc verbatim):
  `"node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs"`
  (still no trailing comma — still the last key).

### Current `npm test` behavior (VERIFIED)
`npm test` runs ONLY file-injector.test.mjs → `Result: 148 passed, 0 failed.` → exit 0. The other two
harnesses are NEVER invoked by `npm test` (grep confirms no other reference to them in package.json/scripts/).

## 3. Why `&&` chaining works (the mechanism — VERIFIED facts)

- **Shell-level fail-fast.** npm runs each `scripts.*` value via the shell (`sh -c` on POSIX, `cmd /c` on
  Windows — both honor `&&` as "run next only if previous exit code 0"). So `A && B && C` runs A, then B
  only if A exited 0, then C only if B exited 0. The chain's exit code = the first non-zero exit, or 0 if
  all three exited 0. npm propagates that exit code → `npm test` exits non-zero if ANY harness fails.
- **The harnesses set the exit code explicitly.** All three call `process.exit(failed ? 1 : 0)` (an
  EXPLICIT synchronous exit with the right code), not just `process.exitCode = …`. So the shell sees the
  code immediately — no reliance on Node's natural-exit code propagation. Robust.
- **No escaping needed.** Inside a JSON string value, `&` is a literal character (JSON only mandates
  escaping of `"`, `\`, and control chars — `&` is NOT one of them). So `"node a.mjs && node b.mjs"` is
  valid JSON as-is. Do NOT HTML-entity-encode (`&amp;`) and do NOT backslash-escape.

## 4. Dependencies & constraints (from contract + architecture doc)

- **MUST land AFTER P1.M1.T1.S2** (Complete per plan_status). That subtask FLIPPED import-behavior.test.mjs
  test **4f** (was asserting the PRD-violating truncation; now asserts verbatim/null) and added test **4h**.
  Wiring import-behavior.test.mjs into `npm test` BEFORE 4f was fixed would make `npm test` immediately red
  (4f was the bug). P1.M1.T1.S2 is Complete → import-behavior.test.mjs is now green (23/0 confirmed) → safe
  to wire. ✅ (Snapshot confirms 23/0.)
- **Zero-deps ethos.** Do NOT add a test framework (vitest/jest/mocha) or a runner (npm-run-all/run-s) or
  any `devDependencies`. Plain `&&` chaining is the convention. Adding deps would violate the repo's
  zero-dependency stance (PRD §8: "no runtime dependencies"; the harnesses are "zero-dependency Node ESM").
- **Preserve everything else.** Surgical edit to L9 only. L8 `typecheck` unchanged. `"type":"module"`,
  `"pi":{"extensions":["file-injector.ts"]}`, name/version/description/private — all byte-for-byte unchanged.
- **Ordering.** file-injector.test.mjs FIRST (the primary gate, most cases — fail-fast there surfaces the
  most important failure first), then the two regression suites (import-behavior, relative-imports).
- **Mock: none.** (Gate/wiring task — runs the real harnesses.)
- **Mode A docs.** None beyond package.json itself (the script is self-documenting). README sweep = P1.M3.T2.S1.

## 5. No conflict with the parallel P1.M2.T2.S1 (VERIFIED)

P1.M2.T2.S1 (Issue 3, paged-directive display) edits `file-injector.ts` (emitText paged branch +
renderInjectedMessage expanded branch) and `file-injector.test.mjs` (REND-PAGED-DIR + ISS3-DIRECTIVE
cases). It does NOT touch `package.json`. P1.M3.T1.S1 edits ONLY `package.json` L9. The two are
orthogonal — no shared edit site, no merge conflict. When P1.M2.T2.S1 lands, file-injector.test.mjs
grows from 148 → ~150 cases, but it remains green standalone, so the wired `npm test` chain stays green.

## 6. Validation plan (the deliverable is a green `npm test` chain)

1. **Before editing** (contract item 1, last sentence): confirm all three green standalone — DONE
   (148/0, 23/0, 38/0). If any is red, STOP — fix/escalate that harness first (do NOT wire a red suite).
2. **Edit** package.json L9 to the `&&` chain.
3. **After editing**: `npm test` → expect all three summary lines (in order) and exit 0. `npm run typecheck`
   still works (preserved). Confirm a deliberately-broken harness would fail the chain (reasoning: `&&`
   fail-fast — optional smoke; do NOT actually break a committed harness).
4. Verify package.json is still valid JSON (`node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'`).

## 7. Confidence notes

Confidence 10/10. This is a one-line, well-understood edit with a verified target string, verified
standalone-green inputs, a verified shared exit pattern, and no dependency/framework addition. The only
"risk" is a JSON syntax slip (malformed string), which the post-edit `JSON.parse` check + `npm test` run
catch instantly. The task is smaller than most PRP-bearing items; the PRP's value is pinning the exact
string, the exact line, the no-escaping JSON fact, and the fail-fast mechanism so the implementer can't
fumble the trivial-but-easy-to-overcomplicate edit.
