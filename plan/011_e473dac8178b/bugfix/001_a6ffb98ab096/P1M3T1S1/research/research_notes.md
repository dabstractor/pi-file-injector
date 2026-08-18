# Research Notes — BUG-004: autocomplete remap item-level pass-through (P1.M3.T4.S1)

> Task: make the `#@` autocomplete provider's getSuggestions item remap leave non-`@` suggestion
> values untouched (a `/cmd` value must survive as `/cmd`, not become `#@/cmd`). Small surgical
> bugfix: one map body in `file-injector.ts` + the A1 case in `file-injector.test.mjs` (+ optional
> one sentence in spec/14-autocomplete.md §14.2). Research verified the current code/test verbatim.

---

## 1. The bug (verified against CURRENT committed code)

**NOTE — line drift:** the contract + architecture doc cite pre-drift numbers (:1878-1925 region).
The code has drifted ≈ **+55 lines** (P1.M1 fixes landed). Current verified anchors:

| Anchor (arch doc → current) | Content |
|---|---|
| :1878-1880 → **:1933-1935** | the SECOND `pi.on("session_start", …)` (autocomplete one; the FIRST at :1833 is the §4.6 config load); headless guard :1934 `if (!ctx.ui || typeof ctx.ui.addAutocompleteProvider !== "function") return;`; registration :1935 |
| :1885 → :1940-1941 | `before.match(/#@([^@\s]*)$/)`; no match → delegate to `current.getSuggestions` |
| :1891-1896 → :1946-1948 | `hashIdx = cursorCol - partial.length - 2`; `< 0` → delegate; else rewrite `#`→space |
| :1898-1899 → :1953-1954 | `const inner = await current.getSuggestions(rewrittenLines, …)`; abort/empty guard |
| :1900-1901 → **:1955-1956** | the comment "Only remap built-in FILE suggestions (prefix `@…`). If the built-in somehow returned non-@ items, pass them through untouched…" — TODAY FALSE; becomes TRUE with the fix |
| :1902 → **:1957** | prefix-level guard `if (!inner.prefix.startsWith("@")) return inner;` — **STAYS** |
| :1904-1908 → **:1959-1963** | **THE BUG** (mangle line ~:1961) |
| :1909 → :1964 | `return { prefix: \`#@${partial}\`, items };` — **STAYS** |
| :1911-1925 → **:1966-1980** | `applyCompletion` — **UNCHANGED** (gates on the `prefix` ARGUMENT `.startsWith("#@")` at :1969-ish; inserts `item.value` verbatim via `typeof item?.value === "string" ? item.value : ""`; else delegates). Does NOT require values to start `#@` → pass-through items insert fine. |

**The buggy map (current :1959-1963, verbatim):**
```ts
        const items = inner.items.map((it) => {
          let v = it.value;
          if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path
          return v === it.value ? it : { ...it, value: v };
        });
```
Mangle semantics: `'/cmd'` → doesn't start `#@` → doesn't start `@` → takes `"#@" + v` → **`'#@/cmd'`**.
Only `'@src/x'` remaps correctly (`"#" + v` → `'#@src/x'`). Values already `'#@…'` return the ORIGINAL
object (`v === it.value` branch). A non-STRING value would throw `.startsWith is not a function`
(latent crash — also fixed by the typeof guard).

## 2. The fix (contract LOGIC item 3 + arch-doc "fix inputs")

Replace the map body so ONLY `'@…'` values remap; everything else returns the ORIGINAL item object:
- non-string `it.value` → `return it` (defensive; also kills the latent `.startsWith` crash)
- `it.value.startsWith("#@")` → `return it` (already ours)
- NOT `it.value.startsWith("@")` → `return it` (the `/cmd` pass-through — BUG-004)
- else → `return { ...it, value: "#" + it.value }` (`@path → #@path`, the only remap)

Unchanged: prefix guard (:1957), returned shape (:1964), applyCompletion (:1966-1980), registration
+ headless guard (:1933-1935). No exported surface change (all inside the factory closure).

**Typecheck safety:** the guard order (`typeof it.value !== "string"` FIRST, early-return) narrows
`it.value` to `string` for the subsequent `.startsWith` calls — compiles under `--strict` whether
pi declares `value: string` (redundant-but-legal check) or `unknown` (required narrowing). The
CURRENT code already compiles calling `.startsWith` directly, so the declared type is string-compatible;
the typeof guard is RUNTIME-defensive (a misbehaving provider can return anything — contract INPUT
note: "values may be non-strings defensively").

## 3. The test site (verified verbatim — file-injector.test.mjs)

A1 case at **:1000-1050** (banner :1000-1005; `await runCase("A1", …)` :1006):
- :1007-1008 `captureHandler("session_start")` (helper at :173-187; fake-pi capture; includes a
  `registerMessageRenderer: () => {}` stub)
- :1010-1012 headless-guard no-op checks (`{cwd}` and `{cwd, ui:{}}` must not throw)
- **:1016-1021 fakeCurrent** — getSuggestions :1018 returns `{ prefix: "@src/", items: [@src/index.ts,
  @src/util.ts] }` (values + labels + description ""), captures `seenLines`; applyCompletion echoes;
  shouldTriggerFileCompletion → false
- :1022-1025 `ctx = { cwd: TMPDIR, ui: { addAutocompleteProvider: (f) => { providerFactory = f; } } }`;
  `await slot.cb({}, ctx)`; assert factory captured
- :1027-1029 `provider = providerFactory(fakeCurrent)`; triggerCharacters includes "@"
- :1032 `const out = await provider.getSuggestions(["Review #@src/"], 0, len, {signal:{aborted:false}})`
- :1033 `seenLines[0] === "Review  @src/"` (rewrite '#'-→space)
- :1034 `out.prefix === "#@src/"` (prefix remap)
- **:1035 THE TRAP** — `assert(out && out.items.length === 2 && out.items.every((it) => it.value.startsWith("#@")), …)`
  — blanket `length===2 && every(#@)` FAILS the moment a non-@ fake item is added. MUST be narrowed.
- :1036 `out.items[0].value === "#@src/index.ts"`
- :1039-1040 out2 delegation (input `"Review @src/"` → prefix stays `"@src/"`)
- :1043-1045 applyCompletion deterministic replace + cursor
- :1048-1049 non-#@ apply delegates; :1050 `});`

**Test plan (contract: FAILING TEST FIRST, extend A1 in place):**
1. Hoist three item consts (`atItem1`, `atItem2`, `cmdItem = { value: "/cmd", label: "cmd", description: "" }`);
   fakeCurrent returns `items: [atItem1, atItem2, cmdItem]`.
2. Narrow :1035 → `length === 3` + scoped pair assert (`items[0].value === "#@src/index.ts" &&
   items[1].value === "#@src/util.ts"`).
3. Add pass-through asserts: `cmd.value === "/cmd"`; **`cmd === cmdItem` (strict identity — the
   ORIGINAL object, not a copy)**; `!out.items.some((i) => i.value === "#@/cmd")` (mangle fingerprint
   absent). Keep every other A1 assert byte-for-byte.
4. Run → A1 FAILS on the unfixed code (`'#@/cmd'` produced; identity fails; fingerprint present).
   THEN apply the source fix → re-run → green.
Label: contract allows "A1-NONAT" (separate case) OR in-place extension — in-place is the contract's
prescriptive path ("extend the A1 fakeCurrent … CRITICAL: narrow the existing blanket assertion") and
keeps the suite count at **183** (no new case). Do NOT reuse BUG-001/BUG-002/BUG-003 labels (older bugs).

## 4. Parallel-task boundaries (no conflicts — verified)

- **BUG-003 (the P1M2T2S1 PRP, "previous work item" per parallel context):** edits injectUrl's image
  branch (~:945-946) + url-injection.test.mjs (+URL-IMG-EMPTY) + README `### URLs` Images bullet
  (~:82). FULLY DISJOINT from BUG-004 (autocomplete region ~:1933-1980, A1 case :1000-1050,
  spec/14-autocomplete.md). It does not touch file-injector.test.mjs.
- **BUG-002 (referenced in that PRP as the sibling P1.M2.T1.S1, plan_status "Implementing"):** edits
  injectMarkdown Step-5 (~:1558-1603) + **file-injector.test.mjs** (+MD-LR3 after LINE-10) + README
  "Line range." paragraph. Shares file-injector.test.mjs with my A1 edit — different region (A1
  :1000-1050 vs MD-LR3 at LINE-10), different label (MD-LR3 vs A1) → no collision. Its source edit is
  BEFORE my region → my absolute file-injector.ts line numbers SHIFT (+~6-10) once it lands. **Anchor
  every edit by CONTENT, not line number.**
- **BUG-005 (P1.M3.T5.S1):** URL_SHAPE_RE ~:43 + spec/15 — disjoint.

## 5. Baselines + gates (verified NOW)

- `node ./file-injector.test.mjs` → **Result: 183 passed, 0 failed.** (count stays 183 with in-place
  A1 extension — no new case is added, A1's asserts grow)
- `npm test` → **4-suite `&&` chain** (file-injector → import-behavior → relative-imports →
  url-injection; verified in package.json) — all green
- `npm run typecheck` → `tsc --strict` via scripts/typecheck.mjs → 0 errors (baseline clean; my change
  is narrowing-safe by construction)

## 6. Docs surface

- file-injector.ts :1955-1956 comment — keep/adjust to state the ITEM-LEVEL pass-through (it becomes
  TRUE). Mode A.
- spec/14-autocomplete.md §14.2 "Implementation (shipped) — line-rewrite reuse (Option 1)" (L17-36):
  the shipped paragraph ends its remap description with "each item value `@<path>` → `#@<path>`" —
  add ONE sentence after it: non-@ (and non-string) item values are passed through untouched.
  OPTIONAL per contract. spec/ dir = 17 numbered parts + SPEC.md index.
- README.md autocomplete line ~:94 — already accurate → **NO change** (contract DOCS item 5; the
  changeset sweep is P1.M4.T6.S1/S2).

## 7. Confidence

9/10 — surgical single-map fix with a contract-specified shape, verbatim current code/test anchors,
an explicitly-flagged trap (the :1035 blanket assert) handled, identity-preserving pass-through
assertable via a hoisted const, and typecheck-safe guard ordering. −1 for line drift from parallel
tasks (mitigated by content anchoring).