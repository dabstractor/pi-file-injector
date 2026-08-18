# Research Notes — P1.M3.T4.S1 (BUG-004: autocomplete item-level pass-through)

Date: research session for PRP creation. All facts below verified directly at HEAD `fe766bd`
("Mirror F5 empty-image guard into URL image branch (BUG-003)").

## Source of truth for this PRP

1. `architecture/spec_ux_bug004_005.md` § BUG-004 — provider analysis + fix inputs + test
   conventions. NOTE: its line numbers are PRE-DRIFT (map cited :1904-1908); current code has
   drifted ~+55 lines after BUG-001..003 landed.
2. `prd_snapshot.md` §h2.3 Issue 3 (BUG-004) + §h2.5 Recommendation.
3. `P1M3T1S1/PRP.md` — a COMPLETE prior PRP for this same work item under the pre-renumber task
   numbering (the tasks.json tree was renumbered: that item is now P1.M3.T4.S1). Its content was
   re-anchored against current HEAD and written to `../PRP.md`, which SUPERSEDES it.

## Fresh-verified anchors at HEAD (file-injector.ts, 1987 lines)

- Mangle line (unique content locator, survives any drift): `:1961`
  `if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path`
  — relocate anytime with `grep -n '"#" + v' file-injector.ts`
- Map body: :1959-1963 | comment (states the pass-through promise the code breaks): :1955-1956 |
  prefix-level guard :1957 | returned shape `return { prefix: \`#@${partial}\`, items };` :1964 |
  applyCompletion :1966-1980 (gates on the `prefix` ARGUMENT startsWith("#@"), inserts
  `item.value` verbatim → pass-through items need NO apply change) |
  registration/headless guard :1933-1935 (the SECOND session_start handler; the FIRST at :1833
  is the §4.6 config load — not ours).
- Test site: `file-injector.test.mjs` A1 case :1006-1050; fakeCurrent :1016-1021 (two inline
  `@src/…` items); THE TRAP blanket assert :1035 (`length === 2 && every(startsWith("#@"))`) —
  must be narrowed when a third `/cmd` item is added. captureHandler helper :173-187.
- spec/14-autocomplete.md: §14.2 heading :17, remap clause "each item value `@<path>` → `#@<path>`" :28.
- README: no change needed — autocomplete statements at :7, :210, :221 already accurate.

## Baselines re-verified at HEAD (gates for this task)

- `node ./file-injector.test.mjs` → `Result: 183 passed, 0 failed.`, exit 0.
- `npm run typecheck` → `type-checks clean under --strict (0 errors)`.
- `npm test` = 4-suite && chain (file-injector, import-behavior, relative-imports, url-injection).
- Extending A1 IN PLACE keeps the count at 183 (no new runCase).

## Task-tree context

- BUG-001 (P1.M1.T1, renderer pairing), BUG-002 (P1.M2.T2, injectMarkdown invalidRange guard +
  MD-LR3 case), BUG-003 (P1.M2.T3, injectUrl empty-image guard + URL-IMG-EMPTY case): ALL LANDED.
- Only remaining sibling lane: P1.M3.T5.S1 (BUG-005, URL_SHAPE_RE ftp + normalization sync +
  spec/15 §7) — fully disjoint regions (:43, ~:1646-1660, spec/15) but EARLIER in file-injector.ts,
  so anchor by content if it lands first.
- Downstream: P1.M4.T6.S1 (README sweep — no autocomplete change needed) and P1.M4.T6.S2
  (spec/ consistency — may fold the optional §14.2 sentence instead).

## Fix recap (as specified in the PRP)

Replace the map body with an ordered guard chain: `typeof it.value !== "string"` → return it;
`startsWith("#@")` → return it; `!startsWith("@")` → return it; else `{ ...it, value: "#" + it.value }`.
typeof-first ordering is load-bearing for --strict type narrowing (and removes the latent
`.startsWith is not a function` crash). Pass-through = ORIGINAL object (identity), never a copy.
Update the :1955-1956 comment to match. TDD: red (extended A1 fails on unfixed source showing
`#@/cmd`) → green (183/0, typecheck 0 errors, 4-suite chain).