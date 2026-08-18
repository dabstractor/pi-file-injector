# Research Notes — P1.M1.T1.S3 (Unify the emit quadruple + rewrite emitText JSDoc)

## State consumed (verified this session)

- S1 LANDED (commit `f2d33dc`): range branch runs the full §5.5 decision; paged slice resumes in FILE coords.
- S2 LANDED in working tree (verified by reading L1308-1317: `deliveredEnd` clamping + `rangeSuffix` from DELIVERED
  range; LINE-12 present). S2's PRP `consumed_by` names S3 as the consumer of the clamped rangeSuffix.
- Baselines: file-injector **175/0**, import-behavior **23/0**, relative-imports **38/0**, url-injection **38/0**.
  `npm test` chains all four. `npm run typecheck` clean (0 errors).
- emitText: L1299 `export function emitText(abs, content, state, startLine?, endLine?): void`. Callers: injectFile
  L1282 and injectMarkdown L1444 (both pass full content + range; emitText re-slices — LR-6/LR-1 seam).

## The quadruple copies — FOUR whole-delivery sites, not three (correction to the contract's count)

The contract counts 3 (range-whole, inline-whole, sub-head-whole), but POST-S2 the code has **4 literal copies**
(the range branch has BOTH an inline arm and a sub-head-guard arm). Verified `kind: "text"` pushes at L1323, L1329,
L1352, L1376 and 4× `subtract(state, fileCost)`:

| # | Site (current lines) | Detail shape | Notes |
|---|---|---|---|
| 1 | Range INLINE arm (~L1318-1324) | `{path, kind:"text", chars, lines, range: rangeSuffix}` | LR-5 comment on the push |
| 2 | Range SUB-HEAD guard arm (~L1325-1331) | same, `range: rangeSuffix` | `content.length <= HEAD_CHARS` guard |
| 3 | Whole-file INLINE (~L1347-1354) | `{path, kind:"text", chars, lines}` (no range) | §12.22 comment |
| 4 | Whole-file SUB-HEAD guard (~L1367-1377) | same, no range | **F1 comment** (PD-SUBHEAD-BUDGET target) |

Common quadruple at every site: `fileCost = Math.ceil(content.length/4)`,
`lineCount = content.length === 0 ? 0 : (newlines ?? 0) + 1`, `state.blocks.push(formatTextFileBlock(abs, content))`,
`state.details.push({...})`, `subtract(state, fileCost)`.

The two PAGED arms (range ~L1332-1341, whole ~L1378-1386) are NOT whole deliveries — UNTOUCHED (they push
head + directive, `kind:"paged"` detail with `directive: extractDirectiveInner(...)`, `paged++`,
`subtract(Math.ceil(HEAD_CHARS/4))`).

## CRITICAL constraint — PD-SUBHEAD-BUDGET introspects emitText SOURCE (file-injector.test.mjs:1168-1182)

```js
const src = fsSync.readFileSync(path.join(process.cwd(), "file-injector.ts"), "utf8");
const fnStart = src.indexOf("function emitText(");
const fnBody = src.slice(fnStart, src.indexOf("\n}", fnStart) + 2);
const guardIdx = fnBody.indexOf("content.length <= HEAD_CHARS");
const guardBlock = fnBody.slice(guardIdx, fnBody.indexOf("} else {", guardIdx));
assert(guardBlock.includes("subtract(state, fileCost)"), ...);  // F1 fix present
```

After unification the guard arm becomes a single `emitWholeText(...)` call → the literal `subtract(state, fileCost)`
leaves emitText's body → **this test FAILS unless its mechanism is re-pointed**. The test's *expectation* (F1: a
whole delivery always subtracts its full fileCost) is PRESERVED and STRENGTHENED by the refactor (one subtract site
covers all four paths). The PRP sanctions exactly ONE test-mechanism edit: PD-SUBHEAD-BUDGET scrapes
`emitWholeText`'s body for `subtract(state, fileCost)` AND asserts the sub-head guard calls `emitWholeText`.
Its explanatory comment updates accordingly. All behavioral expectations (LINE-1…6, LINE-8/8-MD, LINE-12, PD*,
PAGED_FIX etc.) stay green WITHOUT edits.

## CRITICAL constraint — module-surface completeness guard (test ~L140-160)

`ASSERTED_EXPORTS` ∪ `PURE_HELPERS_NOT_ASSERTED` must cover every shipped function; any extra export fails
("module ships functions not in the sanity list"). **⇒ `emitWholeText` must be PRIVATE** (like `injectMarkdown`,
which the guard asserts is NOT exported). Do NOT `export` it; do NOT add it to either set. Precedent: the guard
exists precisely to catch untested exports; private helpers are invisible to `Object.keys(mod)`.

## JSDoc state (L1291-1298) + the stale "intentional extracts" wording

Current JSDoc: "Lifted VERBATIM from the former inline text branch of injectFiles (T1.S1): whole if budget unknown
or fileCost ≤ PAGED_THRESHOLD·remaining; sub-head guard (content ≤ HEAD_CHARS → whole, no directive, no extra
subtract); else head + directive + paged++ + subtract(head cost)." — pre-LR-1, says nothing about slices/clamping.
The contract's target wording (verbatim, from item §4):
"the §5.5 inline-vs-paged decision applies to the sliced content exactly as to a whole file (sub-head guard on the
slice; paged slices resume in FILE coordinates — resumeLine = startLine + complete-lines-in-slice-head);
FileDetail.range shows the delivered (clamped) range, or :<resumeLine>- when paged" — plus a mention of
`emitWholeText` as the single whole-delivery helper.

"Closed ranges are intentional extracts … no paging" (the stale pre-LR-1 wording): **already gone** — S1 replaced
the L1304 comment. `grep "intentional extract"` → 0 hits. Remaining: "deliberate extract" at L1302 inside S1's
LR-1 RATIONALE comment ("a range is a deliberate extract, but that justifies not paging PAST the range end, not
suspending overflow protection WITHIN it") — that is CORRECT post-LR-1 reasoning; KEEP it.

## Helper design (behavior byte-identical)

```ts
function emitWholeText(abs: string, content: string, state: State, rangeSuffix?: string): void {
  const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
  const lineCount = content.length === 0 ? 0 : (content.match(/\n/g)?.length ?? 0) + 1; // empty → 0
  state.blocks.push(formatTextFileBlock(abs, content));
  state.details.push(rangeSuffix === undefined
    ? { path: abs, kind: "text", chars: content.length, lines: lineCount } // §12.22 — offsets computed by computeDetailOffsets in before_agent_start
    : { path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // LR-5: the DELIVERED (clamped) range
  subtract(state, fileCost);
}
```

- Detail object shapes must be preserved EXACTLY: whole-file details have NO `range` key (a `range: undefined`
  property is observably different under `Object.keys`/deep-equal; conditionally build the object).
- `lineCount` empty→0 rule preserved (0-byte file / empty slice).
- The DECISION (`state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining`) stays in emitText at
  each branch; those sites may keep a local `fileCost` for the condition only (pure recompute is byte-identical).
  The quadruple-as-a-unit (cost+lines+push+subtract) exists ONCE — in the helper.
- Placement: immediately after `emitText` (before injectMarkdown's JSDoc), private, with a JSDoc of its own.

## Validation (verified commands)

```bash
npm run typecheck                        # 0 errors
node ./file-injector.test.mjs            # 175 passed, 0 failed (PD-SUBHEAD-BUDGET re-pointed)
node ./import-behavior.test.mjs          # 23
node ./relative-imports.test.mjs         # 38
node ./url-injection.test.mjs            # 38
npm test                                 # chains all four
# structural: exactly ONE `kind: "text"` push (in emitWholeText); ONE subtract(state, fileCost);
# emitWholeText called 4×; NOT exported; grep "intentional extracts" → 0.
```