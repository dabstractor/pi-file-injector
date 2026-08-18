---
name: "P1.M3.T4.S1 (bugfix 001_a6ffb98ab096) — Autocomplete remap: item-level pass-through for non-@ values (BUG-004)"
prd_ref: "bugfix PRD §h2.3 Issue 3 / BUG-004 (autocomplete remap mangles non-@ values); §h2.5 Recommendation ('In the autocomplete item remap, leave values that do not start with @ (or #@) untouched'); architecture/spec_ux_bug004_005.md (§ BUG-004 provider analysis + fix inputs + test conventions)"
target_files: "./file-injector.ts (EDIT getSuggestions item map ~:1959-1963 — the map body ONLY — + adjust the comment :1955-1956 that becomes TRUE) + ./file-injector.test.mjs (EDIT A1 case :1000-1050 — extend fakeCurrent with a /cmd item, NARROW the :1035 blanket assert, add pass-through asserts) + ./spec/14-autocomplete.md (OPTIONAL one sentence in §14.2)"
target_language: TypeScript (jiti transpile-on-load; gates = `node ./file-injector.test.mjs` 183/0 + `npm run typecheck` --strict 0 errors + the 4-suite `npm test` chain stays green)
depends_on: "Nothing in this plan (BUG-004 is independent of BUG-001..003/005 — disjoint regions). Requires only the shipped autocomplete provider (file-injector.ts :1933-1980) and the A1 test case (:1000-1050) — both verified present."
consumed_by: "P1.M4.T6.S2 (spec/ consistency pass — my optional §14.2 sentence may be folded there instead); P1.M4.T6.S1 (README sweep — NO autocomplete README change from this task; :94 is already accurate)."
---

# PRP — P1.M3.T4.S1: Autocomplete item remap passes non-@ values through untouched (BUG-004)

> **Scope flag:** A surgical, defensive-path bugfix. The `#@` autocomplete provider's `getSuggestions`
> rewrites every suggestion value that doesn't already start `#@` into `#@<value>` — so a non-`@` item
> (e.g. a slash-command `/cmd`) returned by the built-in under an `@` prefix becomes `#@/cmd` (mangled),
> contradicting the adjacent comment's own pass-through promise. The fix: **only `@…` values remap** to
> `#@…`; non-string values, values already starting `#@`, and values NOT starting `@` are returned as the
> **ORIGINAL item object, untouched**. One map body replaced (+ comment made true) + the A1 test case
> extended (with its blanket assertion NARROWED — the flagged trap) + one optional spec sentence.
> `applyCompletion`, the prefix-level guard, the returned shape, and the registration are all UNCHANGED.
> Failing-test-FIRST discipline per the contract. No exported-surface change. No README change.

---

## Goal

**Feature Goal:** `provider.getSuggestions` never mangles a non-`@` suggestion value: a value like
`"/cmd"` returned by the built-in (mixed into an `@`-prefixed result) survives verbatim as `"/cmd"` —
same original object — while genuine `@<path>` file suggestions still remap to `#@<path>`. The comment
above the map ("pass them through untouched so we don't mangle slash-command suggestions") becomes
literally TRUE. `applyCompletion` behavior is unchanged (it gates on the `prefix` argument, not on item
values — pass-through items already insert fine).

**Deliverable:**
- **`file-injector.ts`** — `getSuggestions`'s item map (~:1959-1963): body replaced with an ordered
  pass-through guard chain (non-string → original; `#@…` → original; not-`@` → original; else
  `{ ...it, value: "#" + it.value }`); the comment at ~:1955-1956 adjusted to state the item-level
  pass-through. NOTHING else in the provider changes.
- **`file-injector.test.mjs`** — the A1 case (:1000-1050), edited IN PLACE: `fakeCurrent.getSuggestions`
  gains a third item `{ value: "/cmd", label: "cmd", description: "" }` (hoisted as a const for identity
  asserts); the blanket assertion at ~:1035 (`out.items.length === 2 && out.items.every(…startsWith("#@"))`)
  is NARROWED to the two `@src/…` items; new asserts pin the `/cmd` pass-through (value untouched, strict
  object identity, no `#@/cmd` fingerprint). All other A1 asserts byte-for-byte unchanged.
- **`spec/14-autocomplete.md`** — OPTIONAL one sentence in §14.2 after "each item value `@<path>` →
  `#@<path>`": non-`@` (and non-string) item values are passed through untouched.

**Success Definition:**
1. Failing test FIRST: with the extended A1 fake but BEFORE the source fix, A1 fails (`#@/cmd` produced,
   identity assert fails, fingerprint present) — proving the test bites.
2. After the source fix: `node ./file-injector.test.mjs` → `Result: 183 passed, 0 failed.` (count
   UNCHANGED — in-place A1 extension adds no new case), exit 0.
3. `npm run typecheck` → `type-checks clean under --strict (0 errors)`.
4. `applyCompletion` (deterministic `#@` insert + delegation) unchanged — A1's existing apply asserts
   (deterministic replace, cursor position, non-`#@` delegation) stay green untouched.
5. Prefix-level guard (~:1957) and returned shape (~:1964) unchanged; no exported-surface change.

## User Persona

**Target User:** A Pi TUI user typing `#@<partial>` to path-complete a file injection. Indirectly: any
future built-in provider behavior that mixes non-`@` items (slash-commands, mentions) into an `@`-prefixed
result — today those would be silently mangled into `#@<value>` suggestions that, if accepted, insert
garbage text like `#@/cmd` into the prompt.

**Use Case:** The user types `Review #@src/` → the provider rewrites `#`→space, delegates to pi's
built-in `@` engine, and remaps the file suggestions back to `#@src/…`. If the built-in ever also
returns a non-`@` item under that `@` prefix (a slash-command, a defensive edge), the provider must
leave it exactly as-is instead of fabricating `#@/cmd`.

**User Journey:** type `#@src/` → suggestions list shows `#@src/index.ts`, `#@src/util.ts` (remapped
file items) and — if present — `/cmd` exactly as the built-in produced it; accepting a `#@…` item
inserts `#@<path>` deterministically; the mangled-`#@/cmd` shape can no longer occur.

**Pain Points Addressed:** BUG-004 — the defensive remap contradicted its own comment and its own
purpose ("don't mangle slash-command suggestions"), turning every non-`@` value into a fake `#@` token.
Latent today (pi's `@`-queries normally return only `@`-prefixed values) but a correctness/comment-
contract violation waiting for the first mixed result; also a latent crash (`.startsWith` on a
non-string value) that the same guard chain removes.

## Why

- **Implements the PRD's own Recommendation (§h2.5, BUG-004):** "In the autocomplete item remap, leave
  values that do not start with `@` (or `#@`) untouched." The architecture doc supplies the exact fix
  inputs; this PRP transcribes them against current verified line anchors.
- **Makes the code honest.** The comment at ~:1955-1956 promises pass-through; the ternary at ~:1961
  breaks it (`v = v.startsWith("@") ? "#" + v : "#@" + v` — the else branch prepends `#@` to ANYTHING
  not already `#@`). After the fix, comment and code agree — the comment is adjusted to state the
  item-level enforcement (Mode A).
- **Kills a latent crash too.** `let v = it.value; … v.startsWith(…)` throws if a misbehaving provider
  returns a non-string value. The contract's INPUT note says values "may be non-strings defensively";
  the guard chain's first check (`typeof it.value !== "string" → return it`) removes that hazard in the
  same edit — no extra scope.
- **Zero user-visible regression risk.** The only behavior change is on the defensive path: items whose
  values don't start `@`/`#@`. Every legitimate pi `@`-file suggestion (`@<path>`) takes the identical
  remap it takes today. A1's existing asserts (rewrite, prefix remap, item remap, apply, delegate) all
  stay green — proof by the suite.
- **Bounds the blast radius.** One map body in one closure inside the autocomplete `session_start`
  handler. No exported symbol, no pipeline change, no README churn (the README autocomplete line ~:94
  is already accurate — contract DOCS item 5; the changeset sweep is P1.M4.T6.S1/S2).

## What

No user-visible change on the normal path (pi's `@`-queries return `@`-prefixed values). On the
defensive path (a built-in result mixing non-`@` items under an `@` prefix): those items now pass
through as their original objects instead of being rewritten to `#@<value>`. Non-string values pass
through instead of throwing.

### Success Criteria

- [ ] Map body: `typeof it.value !== "string"` → return the original `it`; `it.value.startsWith("#@")`
      → return `it`; `!it.value.startsWith("@")` → return `it`; only `'@…'` → `{ ...it, value: "#" + it.value }`.
- [ ] Comment at ~:1955-1956 updated to state the item-level pass-through (it becomes TRUE).
- [ ] Prefix-level guard (~:1957), returned shape `return { prefix: \`#@${partial}\`, items };` (~:1964),
      `applyCompletion` (~:1966-1980), and the registration/headless guard (~:1933-1935) — UNCHANGED.
- [ ] A1 (extended in place): fake returns `[@src/index.ts, @src/util.ts, /cmd]` under prefix `"@src/"`;
      asserts — `out.items.length === 3`; `items[0].value === "#@src/index.ts"` and
      `items[1].value === "#@src/util.ts"` (both remapped); the `/cmd` item has `value === "/cmd"`,
      is the SAME object (`=== cmdItem`), and `!out.items.some((i) => i.value === "#@/cmd")`.
- [ ] The blanket assertion (`length === 2 && every(…startsWith("#@"))`) is NARROWED (no longer asserts
      every item is `#@…`) — the contract's flagged trap, handled.
- [ ] All other A1 asserts (seenLines rewrite, prefix remap, out2 delegation, deterministic apply +
      cursor, non-`#@` apply delegation) unchanged and green.
- [ ] Failing-test-first demonstrated: extended A1 fails on the unfixed source; passes after the fix.
- [ ] `node ./file-injector.test.mjs` → `183 passed, 0 failed` (count unchanged); `npm run typecheck`
      → 0 errors; `npm test` (4-suite chain) green.
- [ ] No exported-surface change; no README change; optional spec/14-autocomplete.md §14.2 sentence added.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed to implement this successfully?_ **Yes.**
This PRP includes: the current buggy map VERBATIM with its verified line anchor (~:1959-1963) and the
uniform +55-line drift warning vs. the contract's/arch-doc's older numbers; the exact replacement map
body (guard order + why it is typecheck-safe); the unchanged neighbors enumerated with anchors (prefix
guard, returned shape, applyCompletion internals incl. its prefix-argument gate and verbatim-value
insert); the A1 test VERBATIM structure (:1000-1050) — the fakeCurrent shape, the captureHandler +
ctx capture pattern, the exact blanket-assertion line to narrow (:1035) and its replacement, the
hoisted-const identity-assert trick, and the mangle fingerprint (`#@/cmd`); the failing-test-first
ordering; the parallel-task boundaries (BUG-003 disjoint; BUG-002 shares file-injector.test.mjs but a
different case/region/label — MD-LR3 vs A1); the verified gates and the 183-count invariance; and the
docs surface (comment + optional §14.2 sentence + NO README). The implementer edits two files in two
small regions and runs three commands.

### Documentation & References

```yaml
# MUST READ — the bug analysis + the fix inputs + the test conventions
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/spec_ux_bug004_005.md
  why: "§ BUG-004: the provider pipeline walk (registration → trigger match → rewrite → delegate →
        prefix guard → THE MAP → returned shape → applyCompletion), the mangle semantics ('/cmd' takes
        the '#@' + v branch), the fix-inputs snippet (the guard chain), the A1 test walkthrough, and the
        flagged risk (the blanket every()-assertion trap). § test conventions: captureHandler + fakeCurrent."
  critical: "Its line numbers are PRE-DRIFT (analysis snapshot). The committed code has drifted ≈ +55
             lines (verified): registration :1933-1935, comment :1955-1956, prefix guard :1957, THE MAP
             :1959-1963, returned shape :1964, applyCompletion :1966-1980. ANCHOR BY CONTENT — the
             parallel BUG-002 task edits injectMarkdown (~:1558-1603, BEFORE this region) and will shift
             these numbers again. Locate the map by its unique body text
             ('if (!v.startsWith(\"#@\")) v = v.startsWith(\"@\") ? \"#\" + v : \"#@\" + v;')."

# The PRD sections this implements
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md
  why: "§h2.3 Issue 3 / BUG-004: the repro ('a value like /cmd takes the #+v... no — the #@+v branch →
        #@/cmd'), the comment-contract violation, and 'Verified with a mocked current provider returning
        items [@a.ts, @ab.ts, /cmd] under prefix @a'. §h2.5 Recommendation: 'leave values that do not
        start with @ (or #@) untouched.'"
  section: "h2.3/h3.3 (Issue 3) + h2.5 (Recommendations, BUG-004 bullet)"

# The source file you edit (read the region first)
- file: file-injector.ts
  why: "The autocomplete provider lives in the SECOND session_start handler (~:1933-1985; the FIRST at
        :1833 is the §4.6 config load — do not confuse them). You replace ONLY the map body (~:1959-1963)
        and adjust the comment above (~:1955-1956). Everything else in the closure stays byte-for-byte."
  pattern: "The provider's getSuggestions: match `#@<partial>` at cursor (:1940-1941) → rewrite '#'
            to space (:1946-1948) → `inner = await current.getSuggestions(rewrittenLines, …)` (:1953) →
            abort/empty guard (:1954) → comment (:1955-1956) → prefix guard (:1957) → THE MAP (:1959-1963)
            → `return { prefix: \`#@${partial}\`, items };` (:1964)."
  gotcha: "`applyCompletion` (:1966-1980) gates on the `prefix` ARGUMENT startsWith(\"#@\") and inserts
           `item.value` VERBATIM (`typeof item?.value === \"string\" ? item.value : \"\"`) — it does NOT
           require values to start #@, so pass-through items insert fine. DO NOT touch it. (Its own A1
           asserts pin it.)"

# The test file you edit (the A1 case, verbatim-verified)
- file: file-injector.test.mjs
  why: "A1 at :1000-1050 is THE autocomplete case. captureHandler(\"session_start\") (:1007) reuses the
        shared helper (:173-187). fakeCurrent (:1016-1021) currently returns TWO @src items via an inline
        array. THE TRAP at :1035: `out.items.length === 2 && out.items.every((it) => it.value.startsWith(\"#@\"))`
        — the blanket every() must be NARROWED when the third (/cmd) item is added, or A1 fails for the
        wrong reason. Other asserts to keep verbatim: seenLines rewrite (:1033), prefix remap (:1034),
        first-item value (:1036), out2 delegation (:1039-1040), deterministic apply + cursor
        (:1043-1045), non-#@ apply delegation (:1048-1049)."
  pattern: "Mock pattern (per A1, reuse as-is): `const slot = captureHandler(\"session_start\");` →
            headless no-op checks → fakeCurrent (getSuggestions captures seenLines; applyCompletion
            echoes; shouldTriggerFileCompletion false) → `ctx = { cwd: TMPDIR, ui: { addAutocompleteProvider:
            (f) => { providerFactory = f; } } }` → `await slot.cb({}, ctx)` → `provider =
            providerFactory(fakeCurrent)` → `await provider.getSuggestions([\"Review #@src/\"], 0, len,
            { signal: { aborted: false } })`. No real pi TUI needed."
  gotcha: "The suite count STAYS 183 — extend A1 in place (no new runCase). If you instead add a separate
           `A1-NONAT` case (contract-permitted alternative), you must STILL duplicate your own fake and
           the count becomes 184; the in-place path is the contract's prescriptive one and simpler. Do
           NOT reuse the labels BUG-001/BUG-002/BUG-003 (older bugs). NOTE: the parallel BUG-002 task
           adds an MD-LR3 case elsewhere in this same file (after LINE-10) — different region, unique
           label; do not collide."

# The optional docs file
- file: spec/14-autocomplete.md
  why: "§14.2 'Implementation (shipped) — line-rewrite reuse (Option 1)' (L17-36). Its shipped paragraph
        describes the remap as 'each item value `@<path>` → `#@<path>`'. Add ONE sentence after that
        clause: non-@ (and non-string) item values are passed through untouched. OPTIONAL per contract
        DOCS item 5."
  gotcha: "Do NOT touch §14.3 (Non-goal) or anything else. spec/ is the 17-part spec tree (SPEC.md is
           the index)."

# The sibling PRP (parallel context — boundary confirmation, NOT a dependency)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M2T2S1/PRP.md
  why: "The 'previous work item' per the parallel-execution context (BUG-003: injectUrl image branch +
        url-injection.test.mjs + README URLs bullet). FULLY DISJOINT from this task — it does not touch
        the autocomplete region, file-injector.test.mjs, or spec/14. Its baselines (183/0 primary suite;
        4-suite npm test chain) match my verification."
  critical: "It also flags the OTHER parallel sibling — BUG-002 (injectMarkdown Step-5 + an MD-LR3 case
             in file-injector.test.mjs + a README line-range paragraph). BUG-002 edits file-injector.ts
             BEFORE the autocomplete region → expect ~+6-10 line drift after it lands. Anchor by content."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts            # ← EDITED: getSuggestions item map (~:1959-1963) + comment (~:1955-1956) ONLY
├── file-injector.test.mjs      # ← EDITED: A1 case (:1000-1050) — extend fake, narrow :1035, add pass-through asserts
├── import-behavior.test.mjs    # untouched (suite 2 of the npm test chain)
├── relative-imports.test.mjs   # untouched (suite 3)
├── url-injection.test.mjs      # untouched (suite 4; BUG-003's lane)
├── scripts/typecheck.mjs       # untouched (the --strict gate)
├── package.json                # untouched (npm test = 4-suite && chain)
├── spec/
│   ├── 14-autocomplete.md      # ← OPTIONAL one sentence in §14.2
│   └── …(16 more parts + SPEC.md)
├── README.md                   # untouched (autocomplete line ~:94 already accurate)
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/{spec_ux_bug004_005.md (THE analysis), renderer_bug001.md, injection_bug002_003.md, system_context.md}
    └── P1M?T?S?/{research, PRP.md}   # sibling PRPs (BUG-001/002/003 lanes + this one)
```

### Desired Codebase tree (files touched by THIS task)

```bash
file-injector.ts          # MODIFIED — getSuggestions item map body (~:1959-1963) → ordered pass-through
                          #   guard chain (non-string / '#@…' / non-'@' → original object; '@…' → remap)
                          #   + the comment above (~:1955-1956) adjusted to state the item-level pass-through.
file-injector.test.mjs    # MODIFIED — A1 case (:1000-1050) IN PLACE: hoist atItem1/atItem2/cmdItem consts;
                          #   fakeCurrent returns all three; NARROW the :1035 blanket assert; add the
                          #   /cmd pass-through asserts (value untouched, === cmdItem, no '#@/cmd').
spec/14-autocomplete.md   # OPTIONAL — one sentence in §14.2 after "each item value `@<path>` → `#@<path>`".
# NOTHING else. No new files. No exported-surface change. No README. No applyCompletion/guard/shape edits.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — LINE DRIFT. The contract + arch doc cite :1904-1908/:1906/:1902/:1909/:1911-1925/:1878-1880;
//   those are PRE-DRIFT (analysis snapshot). Current verified: map :1959-1963 (mangle ~:1961), comment
//   :1955-1956, prefix guard :1957, returned shape :1964, applyCompletion :1966-1980, registration
//   :1933-1935. The parallel BUG-002 task edits injectMarkdown (~:1558-1603, EARLIER in the file) and
//   will shift this region again (+~6-10). LOCATE THE MAP BY CONTENT — its body is unique:
//     if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path
//   `grep -n '"#" + v' file-injector.ts` finds it in any drift state.

// CRITICAL — THE TRAP (contract-flagged). file-injector.test.mjs A1 ~:1035:
//     assert(out && out.items.length === 2 && out.items.every((it) => it.value.startsWith("#@")), …)
//   Adding a third (/cmd) fake item WITHOUT narrowing this makes A1 fail on length===2 (and every()) —
//   the wrong reason, before your new asserts even run. Narrow FIRST (length===3 + the scoped pair
//   assert), THEN add the pass-through asserts. Failing-test-first still works: on unfixed source the
//   narrowed asserts fail via the '#@/cmd' fingerprint / identity check.

// CRITICAL — the fix is an ORDERED guard chain; the ORDER is load-bearing for typecheck. Put
//   `typeof it.value !== "string"` FIRST with an early `return it` — control-flow analysis then narrows
//   `it.value` to `string` for every subsequent `.startsWith` call, so the map compiles under --strict
//   whether pi declares the field `string` (redundant-but-legal) or `unknown` (required narrowing).
//   The current code compiles `.startsWith` directly, so the declared type is string-compatible; the
//   typeof guard is RUNTIME defense (contract INPUT: "values may be non-strings defensively") and also
//   removes the latent crash (`.startsWith is not a function` on a non-string).

// CRITICAL — identity, not just value. The pass-through contract is "returned as the ORIGINAL item
//   object (untouched)". Assert it strictly: hoist `const cmdItem = { value: "/cmd", label: "cmd",
//   description: "" };` in A1, use it in the fake's items array, then assert `out.items.find(...) === cmdItem`
//   (===). The buggy code would return a COPY `{ ...it, value: "#@/cmd" }` — both the value assert AND
//   the identity assert fail pre-fix; post-fix both hold. (The arch doc's fix returns `it` itself —
//   identity preserved.)

// GOTCHA — do NOT touch the neighbors. The prefix-level guard (:1957), the returned shape (:1964), and
//   applyCompletion (:1966-1980) all stay byte-for-byte. applyCompletion needs NO pass-through handling:
//   it gates on the `prefix` ARGUMENT startsWith("#@") and inserts `item.value` verbatim — a "/cmd"
//   item would only be inserted by OUR apply if the USER accepted it under a "#@…" prefix, which is the
//   built-in/edge's decision, not the remap's. A1's existing apply asserts pin the current behavior.

// GOTCHA — two session_start handlers exist (:1833 = §4.6 config load, FIRST; :1933 = autocomplete,
//   SECOND). The config one is NOT yours. `captureHandler("session_start")` in A1 captures BOTH
//   (helper returns {cb: last, all}) — A1's existing `slot.cb` invocations drive the LAST-registered
//   (autocomplete) one; that behavior is already green, keep the calls as-is.

// GOTCHA — suite count invariance. Extending A1 in place adds NO case: expect `Result: 183 passed,
//   0 failed.` after the fix (same as baseline). If you chose the separate A1-NONAT case instead, the
//   count becomes 184 — either is contract-permitted, but do not mix both.

// LIBRARY — jiti transpiles file-injector.ts on load (no strict check at load); `npm run typecheck`
//   (tsc --strict via scripts/typecheck.mjs, resolving the GLOBAL pi .d.ts) is the type gate. Both
//   must pass. The test harness loads the REAL committed file via jiti with pi's alias map — no mocking
//   of the module, only the fakeCurrent provider mock per A1's established pattern.
```

## Implementation Blueprint

### Data models and structure

No data models change. The autocomplete item shape is pi's (`{ value, label, description, … }`); the
provider result shape stays `{ prefix, items }`. The fix only changes WHICH items are copied vs
passed through by reference:

```ts
// BEFORE (~:1959-1963) — the BUG: any value not already '#@' is force-prefixed (mangles '/cmd';
// also crashes on a non-string value):
const items = inner.items.map((it) => {
  let v = it.value;
  if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path
  return v === it.value ? it : { ...it, value: v };
});

// AFTER — ordered pass-through guard chain (BUG-004): ONLY '@…' values remap; everything else is
// the ORIGINAL item object. typeof-first ordering narrows it.value to string for the startsWith calls.
const items = inner.items.map((it) => {
  if (typeof it.value !== "string") return it; // defensive: non-string → untouched (also no .startsWith crash)
  if (it.value.startsWith("#@")) return it; // already ours
  if (!it.value.startsWith("@")) return it; // non-@ (e.g. a slash-command '/cmd') → pass through untouched
  return { ...it, value: "#" + it.value }; // @path → #@path — the ONLY remap
});
```

### Implementation Tasks (ordered by dependencies — FAILING TEST FIRST per the contract)

```yaml
Task 1: EDIT the A1 case — extend the fake (file-injector.test.mjs :1014-1021)
  - HOIST three consts just above fakeCurrent (replacing the inline item array):
      const atItem1 = { value: "@src/index.ts", label: "index.ts", description: "" };
      const atItem2 = { value: "@src/util.ts", label: "util.ts", description: "" };
      const cmdItem = { value: "/cmd", label: "cmd", description: "" };   // BUG-004: the non-@ item
  - fakeCurrent.getSuggestions returns { prefix: "@src/", items: [atItem1, atItem2, cmdItem] }
    (seenLines capture, applyCompletion echo, shouldTriggerFileCompletion false — unchanged).
  - ADD a banner comment line in the A1 header noting the /cmd item pins BUG-004 pass-through.

Task 2: EDIT the A1 case — narrow the trap + add pass-through asserts (:1035-1036 region)
  - REPLACE the blanket assert (:1035) with:
      assert(out && out.items.length === 3, `three items expected (2 @src + 1 /cmd), got ${out && out.items.length}`);
      assert(out.items[0].value === "#@src/index.ts" && out.items[1].value === "#@src/util.ts",
        `both @src items must remap to '#@…' (got ${JSON.stringify(out.items.map((i) => i.value))})`);
  - ADD (BUG-004 asserts):
      const cmd = out.items.find((i) => i.label === "cmd");
      assert(cmd && cmd.value === "/cmd",
        `non-@ item must pass through UNTOUCHED as '/cmd' (BUG-004; got ${JSON.stringify(cmd && cmd.value)})`);
      assert(cmd === cmdItem, "pass-through must return the ORIGINAL item object (identity, not a copy)");
      assert(!out.items.some((i) => i.value === "#@/cmd"), "BUG-004 mangle fingerprint '#@/cmd' must be absent");
  - KEEP :1036 (`out.items[0].value === "#@src/index.ts"`) and ALL other A1 asserts verbatim.

Task 3: RUN — confirm the FAILING test bites (TDD red)
  - `node ./file-injector.test.mjs 2>&1 | grep -A3 '"A1"'` (or full run) → A1 MUST FAIL:
    the '/cmd' assert sees '#@/cmd' (mangle) and/or the identity assert fails (a copy was returned).
    If A1 does NOT fail, the fake/assert edits didn't take — fix before touching the source.

Task 4: EDIT the source map (file-injector.ts ~:1959-1963; locate by content — see Gotchas)
  - REPLACE the map body with the ordered guard chain (AFTER-form above).
  - ADJUST the comment above (~:1955-1956) to state the item-level pass-through, e.g.:
      // Only remap built-in FILE suggestions (prefix `@…`). Enforced per item below (BUG-004):
      // non-string values, values already '#@…', and values NOT starting '@' (e.g. a slash-command
      // '/cmd') are passed through as their ORIGINAL item object — only '@…' values remap to '#@…'.
  - DO NOT touch: the prefix guard (:1957), the returned shape (:1964), applyCompletion (:1966-1980),
    the registration/headless guard (:1933-1935), or anything else in the file.

Task 5: VERIFY gates
  - `node ./file-injector.test.mjs` → `Result: 183 passed, 0 failed.` (A1 now green; count UNCHANGED).
  - `npm run typecheck` → `type-checks clean under --strict (0 errors)`.
  - `npm test` → the 4-suite chain stays green (file-injector + import-behavior + relative-imports + url-injection).

Task 6 (OPTIONAL): spec/14-autocomplete.md §14.2 — one sentence
  - After "each item value `@<path>` → `#@<path>`" in the shipped-Option-1 paragraph, add:
    "Item values that do not start with `@` (or `#@`) — for example a stray slash-command suggestion
    mixed into an `@` query — are passed through untouched, as are non-string values."
  - If skipped, note it for P1.M4.T6.S2 (spec consistency pass) — either is contract-acceptable.
```

### Implementation Patterns & Key Details

```ts
// The A1 fake + provider-capture pattern (established, reuse as-is — file-injector.test.mjs :1006-1032):
const slot = captureHandler("session_start");
await slot.cb({}, { cwd: TMPDIR });            // headless no-op (no ctx.ui)
await slot.cb({}, { cwd: TMPDIR, ui: {} });    // no addAutocompleteProvider fn → no-op
// ... fakeCurrent (Task 1) ...
const ctx = { cwd: TMPDIR, ui: { addAutocompleteProvider: (f) => { providerFactory = f; } } };
await slot.cb({}, ctx);                        // the autocomplete session_start registers the factory
const provider = providerFactory(fakeCurrent); // wrap the fake built-in
const out = await provider.getSuggestions(["Review #@src/"], 0, "Review #@src/".length, { signal: { aborted: false } });

// The identity-assert trick (the pass-through's strongest pin): hoisting cmdItem lets you assert the
// provider returned the VERY SAME object (===), not a shallow copy — the buggy code's {...it, value}
// copy fails this even if the value were accidentally right; the fixed guard chain returns `it` itself.
```

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - getSuggestions item map (~:1959-1963): body → ordered pass-through guard chain (4 branches).
  - Comment (~:1955-1956): restated to the item-level pass-through (becomes TRUE). [Mode A]
  - UNCHANGED: trigger match/rewrite (:1940-1948), abort/empty guard (:1954), prefix guard (:1957),
    returned shape (:1964), applyCompletion (:1966-1980), shouldTriggerFileCompletion, the
    session_start registration + headless guard (:1933-1935), the config-load session_start (:1833).

FILE_EDITS (file-injector.test.mjs):
  - A1 case (:1000-1050) IN PLACE: +3 hoisted item consts; fake items array uses them (+cmdItem);
    :1035 blanket assert NARROWED (length===3 + scoped pair); +4 pass-through asserts (find-by-label,
    value === "/cmd", === cmdItem identity, no "#@/cmd" fingerprint); A1 header comment +1 line.
  - UNCHANGED: every other A1 assert; every other case; captureHandler/makeMockCtx helpers;
    ASSERTED_EXPORTS / module-surface guard (no export changes).

OPTIONAL FILE_EDITS (spec/14-autocomplete.md):
  - §14.2 shipped-Option-1 paragraph: +1 sentence on non-@ / non-string pass-through.

NO_CHANGES: applyCompletion behavior; prefix-level guard; returned shape; exported surface; README.md
            (autocomplete line ~:94 already accurate); package.json; scripts/typecheck.mjs; the three
            other test files; all plan/ files. No new files.
```

## Validation Loop

### Level 1: The failing test FIRST (TDD red — proves the test bites)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -B1 -A4 'A1 —'
# After Tasks 1-2 (test edits) and BEFORE Task 4 (source fix): the A1 row MUST print ✗ with detail
# like `non-@ item must pass through UNTOUCHED as '/cmd' (BUG-004; got "#@/cmd")` or the identity
# assert failing. If A1 is GREEN here, your test edits didn't take — re-check the fake items array
# actually includes cmdItem and the new asserts actually run (not shadowed).
```

### Level 2: The source fix + primary suite (TDD green)

```bash
# After Task 4:
node ./file-injector.test.mjs
# Expected: `Result: 183 passed, 0 failed.` — count UNCHANGED (in-place A1 extension), A1 ✓.
# Targeted: node ./file-injector.test.mjs 2>&1 | grep -E 'A1|Result:'
#   → the A1 row ✓ and `Result: 183 passed, 0 failed.`
# If A1 ✗ on identity (`=== cmdItem`): the map returns a copy for pass-through — re-check the guard
#   chain returns `it` (NOT { ...it }) in all three pass-through branches.
# If A1 ✗ on '/cmd' value: the '#@' + v mangle branch survived — the map body wasn't fully replaced.
```

### Level 3: Typecheck + the full chain

```bash
npm run typecheck
# Expected: `typecheck: file-injector.ts type-checks clean under --strict (0 errors)`, exit 0.
# If it errors on the map: the typeof guard is not FIRST / a .startsWith call precedes the narrowing —
# reorder the chain exactly as specified (typeof → '#@' → not-'@' → remap).

npm test
# Expected: all four suites green (file-injector 183/0 → import-behavior → relative-imports →
# url-injection), exit 0. (Confirms no cross-suite regression; the parallel tasks' suites are intact.)
```

### Level 4: Behavioral spot-check (ad hoc, NOT part of the gate)

```bash
# Optional direct probe of the fixed remap via jiti (mirrors A1 without the suite):
node -e '
(async () => {
  const { execSync } = require("node:child_process");
  const path = require("node:path");
  const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
  const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
  const jiti = createJiti(import.meta.url, { alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js" } });
  const mod = await jiti.import(path.resolve("file-injector.ts"));
  let factory = null;
  const pi = { on: () => {}, registerMessageRenderer: () => {} };
  // minimal capture: drive the factory default export with a fake pi that grabs the session_start cb
  let sb = null; pi.on = (ev, cb) => { if (ev === "session_start") sb = cb; };
  mod.default(pi);
  await sb({}, { ui: { addAutocompleteProvider: (f) => { factory = f; } } });
  const cmdItem = { value: "/cmd", label: "cmd", description: "" };
  const p = factory({ getSuggestions: async () => ({ prefix: "@a", items: [
    { value: "@a.ts", label: "a.ts", description: "" }, cmdItem ] }),
    applyCompletion: () => ({}), shouldTriggerFileCompletion: () => false });
  const out = await p.getSuggestions(["x #@a"], 0, 5, { signal: { aborted: false } });
  console.log("remap:", out.items[0].value, "| passthrough:", out.items[1].value,
    "| identity:", out.items[1] === cmdItem, "| mangle absent:", !out.items.some(i => i.value === "#@/cmd"));
}) ();'
# Expected: remap: #@a.ts | passthrough: /cmd | identity: true | mangle absent: true
```

## Final Validation Checklist

### Technical Validation

- [ ] Failing-test-first demonstrated: extended A1 failed on unfixed source (Level 1), passed after (Level 2).
- [ ] `node ./file-injector.test.mjs` → `Result: 183 passed, 0 failed.` (count unchanged).
- [ ] `npm run typecheck` → `--strict (0 errors)`.
- [ ] `npm test` → 4-suite chain green.

### Feature Validation (BUG-004 closed)

- [ ] A `'/cmd'` item under an `@`-prefixed inner result survives as `'/cmd'` — the ORIGINAL object (`===`).
- [ ] `'@src/index.ts'` / `'@src/util.ts'` still remap to `'#@src/…'` (the only remap branch).
- [ ] Values already `'#@…'` and non-string values pass through untouched (no crash).
- [ ] The mangle fingerprint `'#@/cmd'` is asserted ABSENT.
- [ ] The comment above the map now states the item-level pass-through — TRUE, matching behavior.

### Invariant Validation (what did NOT change)

- [ ] Prefix-level guard (`if (!inner.prefix.startsWith("@")) return inner;`) byte-for-byte unchanged.
- [ ] Returned shape `return { prefix: \`#@${partial}\`, items };` unchanged.
- [ ] `applyCompletion` unchanged — deterministic `#@` insert + delegation (A1's apply asserts untouched).
- [ ] Registration + headless guard unchanged; no exported-surface change (module-surface guard green).
- [ ] The :1035 blanket assertion narrowed (not deleted); all other A1 asserts verbatim.

### Code Quality / Scope Validation

- [ ] Only the map body + comment in file-injector.ts; only the A1 region in file-injector.test.mjs.
- [ ] Guard order: `typeof` first (typecheck-safe narrowing), then `#@`, then not-`@`, then remap.
- [ ] No labels reused (BUG-001/002/003 off-limits; A1 kept for the in-place extension).
- [ ] No README change; optional spec/14 §14.2 sentence (or explicitly deferred to P1.M4.T6.S2).

### Documentation

- [ ] Mode A: the source comment now documents the item-level pass-through. [Rides with the work.]
- [ ] spec/14-autocomplete.md §14.2 sentence added OR consciously deferred to P1.M4.T6.S2.

---

## Anti-Patterns to Avoid

- ❌ **Do NOT add the third fake item without narrowing the :1035 blanket assert.** The `length === 2 &&
  every(startsWith("#@"))` assertion is the flagged trap — it fails on LENGTH before your new asserts run,
  making the red look like a test bug rather than the BUG-004 repro. Narrow it (length===3 + scoped pair).
- ❌ **Do NOT remap-copy pass-through items.** The contract is "returned as the ORIGINAL item object
  (untouched)" — `return it;`, never `return { ...it };` in the three pass-through branches. The
  identity assert (`=== cmdItem`) enforces this; a copy fails it.
- ❌ **Do NOT reorder the guard chain.** `typeof it.value !== "string"` must be FIRST (early return) so
  TypeScript narrows `it.value` to string for the `.startsWith` calls — putting a `.startsWith` before
  the typeof guard risks a `--strict` error (if the declared type is loose) or the latent runtime crash.
- ❌ **Do NOT touch applyCompletion, the prefix guard, or the returned shape.** applyCompletion gates on
  the `prefix` ARGUMENT (not item values) and inserts `item.value` verbatim — pass-through items already
  insert fine. "Fixing" it is scope creep that A1's existing apply asserts would catch.
- ❌ **Do NOT skip the failing-test-first step.** The contract mandates it ("Failing test FIRST"). If the
  extended A1 passes BEFORE the source fix, your test doesn't pin the bug — the fake or the asserts are
  wrong; fix the test, not the discipline.
- ❌ **Do NOT add a new runCase / reuse bug labels.** Extend A1 IN PLACE (count stays 183). If you
  genuinely prefer a separate case, it MUST be labeled `A1-NONAT` with its own fake (count 184) — never
  `BUG-001`/`BUG-002`/`BUG-003` (older bugs), and never both variants at once.
- ❌ **Do NOT edit the README or any other spec section.** The autocomplete README line (~:94) is already
  accurate (contract DOCS item 5); the changeset sweep is P1.M4.T6.S1/S2. The ONLY optional doc is one
  sentence in spec/14-autocomplete.md §14.2.
- ❌ **Do NOT chase live pi internals.** BUG-004 is a defensive-path fix verified entirely through the
  mocked `current` provider (A1's `fakeCurrent` pattern) — no real TUI, no real `fd` invocation, no
  attempt to reproduce a mixed `@`+slash-command result from real pi (it doesn't produce one today;
  that's why the bug is latent).

---

## Confidence Score: 9/10

A surgical, contract-specified fix with verified anchors: the buggy map is transcribed verbatim with its
current line number (~:1959-1963, +55 from the contract's pre-drift numbers — flagged and content-anchored),
the replacement guard chain is given exactly (with the typecheck-load-bearing typeof-first ordering and
the runtime-crash removal as a bonus), the A1 test site is transcribed verbatim (:1000-1050) with THE
trap (:1035 blanket assert) explicitly narrowed, the identity-assert trick (hoisted `cmdItem` + `===`)
pins the "original object, untouched" semantics, and the failing-test-first ordering is enforced as a
gate. The parallel siblings are confirmed disjoint (BUG-003: injectUrl/url-injection.test.mjs/README-URLs;
BUG-002: injectMarkdown + an MD-LR3 case elsewhere in file-injector.test.mjs — shared file, different
region, unique labels). The −1 reserves for the line drift from BUG-002 landing first (mitigated: every
edit anchored by unique content, with a grep one-liner to relocate the map) and the minor uncertainty in
pi's declared item-value type (typeof-first ordering makes the map compile either way; the typecheck
gate confirms). The implementing agent edits two files in two small regions, demonstrates red→green,
and runs three verified commands.