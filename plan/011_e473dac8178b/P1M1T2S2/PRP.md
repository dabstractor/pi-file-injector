---
name: "P1.M1.T2.S2 (plan/011) — LR-3: malformed-range tokens warn instead of vanishing"
prd_ref: "Line-Range feature §6 'LR-3 — malformed ranges are not silent' (normative, fixes verified gap) + §2.2 Grammar (validate: start ≥ 1, end ≥ start; invalid → literal fallback + LR-3 notify) + §8 edge row '#@a.ts:0 / #@a.ts:5-3 → verbatim + warning notify' + §9 LINE-10 + §10 gap register"
target_file: "./file-injector.ts"   # splitLineRange (L172-180) + scanTokens (L1143-1191) + processTokenStream (L1204-1222)
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + `node ./file-injector.test.mjs` 178 passed + `npm test` 4-file green)
depends_on: "The range carriage (splitLineRange/claimKey/scanTokens startLine threading, LR-7) is LANDED and stable. P1.M1.T2.S1 (Implementing, PARALLEL — LR-2 guards in injectFile's non-text branches): DISJOINT functions from T2.S2 (T2.S1=injectFile; T2.S2=splitLineRange/scanTokens/processTokenStream) — no conflict; line numbers may shift slightly, PLACE BY QUOTED TEXT."
consumed_by: "P1.M2.T1.S1 (formalizes the LINE-10 gate alongside LINE-7/9 — T2.S2 ships the fix + LINE-10); P1.M2.T2.S1 (README failure-feedback wording)"
---

# PRP — P1.M1.T2.S2: LR-3 — malformed-range tokens warn instead of vanishing

> **Scope flag:** Source fix in THREE disjoint-from-T2.S1 functions (splitLineRange, scanTokens,
> processTokenStream) + LINE-4's two invalid-case asserts updated in place + the new LINE-10 test. Today a
> token like `#@a.ts:0` fails range validation, falls back to literal-path resolution, fails that too, and
> **vanishes silently** (verbatim, zero feedback). T2.S2 makes it verbatim **+ a hasUI-guarded `warning` notify**:
> `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`. The CRITICAL architectural constraint:
> **scanTokens has NO ctx parameter** — the notify CANNOT fire inside it; scanTokens signals the invalid token
> out via its return records, and processTokenStream (which holds ctx) fires the notify — mirroring the
> SPA-fallback pattern at L956 (`if (ctx.hasUI) ctx.ui?.notify(…)`).

---

## Goal

**Feature Goal:** Implement LR-3 (Line-Range feature §6): a cleaned token whose trailing suffix matched
`/:(\d+)(?:-(\d+))?$/` but FAILED validation (`:0` — start<1; `:5-3` — end<start), and whose **literal**
full-token resolution found no file, is left verbatim (current behavior, unchanged) **AND** reports a
hasUI-guarded warning notify showing the token as typed. Today these tokens vanish with zero feedback
(the verified LR-3 gap, §10).

**Deliverable:**
1. `splitLineRange` (L172-180) gains an invalid marker: the validation-failure branch returns
   `{ path: token, invalid: true }` (was `{ path: token }` — indistinguishable from no-suffix, the root
   defect). No-suffix and valid return shapes stay **byte-identical**.
2. `scanTokens` (L1143-1191) surfaces invalid-range tokens that fail literal resolution as
   `{ path: token, invalidRange: true }` records WITHOUT breaking the exported contract (additive optional
   field; LINE-5 stays green).
3. `processTokenStream` (L1204-1222) — for `invalidRange` records — fires
   `if (ctx.hasUI) ctx.ui?.notify(\`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)\`, "warning")`
   and skips injection (token stays verbatim).
4. LINE-4's two invalid-case asserts updated to the new shape; the new LINE-10 test (spy ctx, 1 positive +
   4 negative sub-asserts).
5. [Mode A] JSDoc on splitLineRange documenting the invalid marker; the notify string documented at the
   firing site.

**Success Definition:**
1. `npm run typecheck` → 0 errors.
2. `node ./file-injector.test.mjs` → **178 passed, 0 failed** (T2.S1's LINE-9 + T2.S2's LINE-10 over the 176
   baseline; LINE-4 modified in place, count unchanged). LINE-5 (scanTokens shape) green.
3. `npm test` → all 4 files green (import-behavior / relative-imports / url-injection untouched).
4. LINE-10 passes: `#@a.ts:0` → `injected:0`, prompt verbatim, exactly ONE notify with type `warning` and the
   exact message. Negatives: missing-file-no-suffix → NO notify; valid range → NO notify; literal `…:0` file
   exists → exact wins, delivered whole, NO notify.
5. Must NOT fire for markdown-import scans (injectMarkdown calls scanTokens directly; threading the notify
   there is OPTIONAL and NOT done here — its records flow to injectFile which safely stat-misses and returns false).

## User Persona

**Target User:** A user who types an explicit range with a typo (`#@a.ts:0`, `#@config.ts:5-3`) and today gets
silence — no injection, no explanation.

**Use Case:** User submits `See #@a.ts:0 here`; nothing is injected; a warning appears:
`#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)` — the user sees the typo immediately.

**Pain Points Addressed:** The verified LR-3 gap (§10): "Warning notify on malformed ranges — **Gap** — silent
verbatim today." A user who typed an explicit range has explicit intent; silence is the wrong answer when
nothing is delivered (§6).

## Why

- **Closes the verified LR-3 gap.** The spec's gap register and §6: malformed ranges must not be silent. The
  notify channel already exists (§5.5 Notify; the SPA-fallback notify at L956 is the established pattern).
- **Root defect is a shape ambiguity.** `splitLineRange` returns `{path: token}` for invalid suffixes —
  indistinguishable from no-suffix — so scanTokens cannot tell "no range intended" from "range typo'd". The
  `invalid: true` marker disambiguates with byte-identical valid/no-suffix shapes (zero risk to LINE-4's valid
  asserts, LINE-5, LINE-6, LR-7 claim keys).
- **Exact-path-wins is preserved.** A file literally named `a.ts:0` resolves whole (the exact-first
  `resolveImportPath(token, …)` succeeds → `abs` set → no invalid record → no notify). LINE-10's 4th sub-assert
  pins this.
- **The ctx-less scanTokens constraint forces the signal-out shape.** scanTokens is EXPORTED and unit-tested
  (LINE-5) with signature `(text, baseDir, opts, state)` — adding ctx would break its contract. Surfacing via
  the record + firing from processTokenStream is the minimal, contract-preserving shape (item §1 RESEARCH NOTE).

## What

User-visible: a NEW warning notify for malformed-range tokens that resolve to no file. Everything else
unchanged (verbatim prompt, injected:0, no block — exactly today's delivery behavior, plus feedback).
Externally: `splitLineRange`'s return type gains an optional `invalid?: boolean`; scanTokens' record type
gains an optional `invalidRange?: boolean` — both additive (LINE-4's two invalid asserts update).

### Success Criteria

- [ ] `splitLineRange("a.ts:0")` → `{ path: "a.ts:0", invalid: true }`; `splitLineRange("a.ts:5-3")` →
      `{ path: "a.ts:5-3", invalid: true }`; `splitLineRange("a.ts")` → `{ path: "a.ts" }` (unchanged);
      `splitLineRange("a.ts:10")` / `("a.ts:10-15")` → unchanged valid shapes.
- [ ] scanTokens surfaces `{ path: token, invalidRange: true }` ONLY when: the token's suffix matched the
      regex AND validation failed AND the exact (full-token) resolution failed. No dedup bookkeeping on the
      record (its path failed resolution by construction — no key collision possible).
- [ ] processTokenStream fires the warning notify (hasUI-guarded, type `"warning"`, em-dash, `#@` + cleaned
      token as typed) for `invalidRange` records and `continue`s (no injectFile call, no count).
- [ ] LINE-4's two invalid asserts updated to the new shape (in place; valid asserts untouched).
- [ ] LINE-10 passes with the exact message string `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`
      and `t === "warning"`.
- [ ] Negatives pinned by LINE-10: missing-file-no-suffix → 0 notifies; valid range → 0 notifies; literal
      `…:0` file exists → delivered whole (`injected:1`, hasBlock) + 0 notifies.
- [ ] LINE-5 green (additive record field; valid records unchanged). LINE-6/7/8/12 green (range machinery untouched).
- [ ] `npm run typecheck` 0 errors; `node ./file-injector.test.mjs` 178 passed; `npm test` 4-file green.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** The exact current
bodies of all three functions are quoted in the Blueprint with exact oldText→newText edits; the CRITICAL
item-vs-LINE-10 reconciliation (the item says "fail BOTH exact and stripped" but LINE-10's `a.ts` EXISTS — the
authoritative rule is literal-resolution-fails, from PRD LR-3 + §2.2 + LINE-10) is documented; the ctx-less
scanTokens constraint and the L956 SPA-notify pattern are pinned; LINE-4's exact two asserts to update and
LINE-5's shape contract are quoted; the LINE-10 test body (spy ctx inline, injectFiles 3rd param is ctx,
literal-file negative with finally cleanup) is written verbatim; the em-dash message string is exact; and the
T2.S1 disjoint-function boundary is explicit.

### Documentation & References

```yaml
# MUST READ — the normative LR-3 contract
- file: PRD.md  (Line-Range feature §6 + §2.2 + §8 edge row + §9 LINE-10 + §10 gap register)
  why: "§6 LR-3: 'A cleaned token whose trailing suffix matches :\\d+(-\\d+)? but fails validation (:0, :5-3),
        and which resolves to no file, is left verbatim (current behavior) AND reports a hasUI-guarded warning
        notify, e.g. `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`.' §2.2: validation rules
        (start ≥ 1; end ≥ start; invalid → literal fallback + LR-3 notify). §9 LINE-10: 'injected:0, verbatim,
        warning notify fired.'"
  critical: "§9's LINE-10 uses '#@a.ts:0' where a.ts EXISTS as a fixture — so the notify's condition is
             LITERAL-resolution-fails, NOT 'both exact and stripped fail' (the item §3b's 'both' wording would
             not notify for LINE-10's own scenario; the PRD's 'resolves to no file' = the token as typed).
             Exact-path-wins: a literal file named a.ts:0 resolving whole → NO notify (§2.4, §8 edge row)."

# MUST READ — the verified seams + the SPA-notify pattern + the LINE test section
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "splitLineRange L170-177 ('returns {path: token} for invalid suffixes, indistinguishable from no-suffix');
        scanTokens L1144-1180 (EXPORTED, unit-tested by LINE-5 at test L3008+, NO ctx param); processTokenStream
        L1195+ (the ctx-holding caller); SPA-fallback notify L956 (`if (ctx.hasUI) ctx.ui?.notify(…, 'info')`)."
  critical: "scanTokens has NO ctx — the notify CANNOT fire inside it; signal out via the record and fire from
             processTokenStream (item §1 RESEARCH NOTE). Line numbers are landmarks; PLACE BY QUOTED TEXT."

# MUST READ — the parallel sibling's boundary (T2.S1 = injectFile; T2.S2 = the scan/parse trio)
- file: plan/011_e473dac8178b/P1M1T2S1/PRP.md
  why: "T2.S1 (Implementing, parallel) adds LR-2 guards inside injectFile's three non-text branches — a DISJOINT
        function from all three of T2.S2's edit sites. Neither clobbers the other; both land against the same
        working tree. T2.S2's file-injector.ts hunks must ALL be in splitLineRange/scanTokens/processTokenStream."
  critical: "Do NOT touch injectFile (T2.S1 owns its branches). Do NOT touch emitText (T1.S3 landed it). Your
             diff's hunks: splitLineRange, scanTokens, processTokenStream, only."

# The file you edit (source)
- file: file-injector.ts
  why: "splitLineRange L172-180 (exported). scanTokens L1143-1191 (exported; return type on L1147-1148; the
        invalid-fallthrough site is the `if (!abs)` block L1174-1183). processTokenStream L1204-1222 (private;
        the loop L1212-1216 gains the invalidRange branch FIRST). SPA-notify precedent at L956."
  pattern: "The processTokenStream notify mirrors L956's shape exactly (if (ctx.hasUI) ctx.ui?.notify(...)) but
            with type 'warning'. Keep the record-field additions optional (`invalid?: true`, `invalidRange?: true`)
            so the exported contract is additive."
  gotcha: "The notify message prepends '#@' to rec.path so it shows the token as typed (item §3c: 'message shows
           the token as typed'). rec.path holds the CLEANED token (post §4.3 trim) — e.g. '#@a.ts:0.' cleans to
           'a.ts:0' and the notify shows '#@a.ts:0 — …'. Em dash U+2014 in the message, matching the binary-note
           convention."

# The file you edit (test)
- file: file-injector.test.mjs
  why: "176 runCases at T2.S2 start (177 after T2.S1's LINE-9 lands). LINE-4 at L3019 (its two invalid asserts
        L3023-3024 are the ones to UPDATE in place; the three valid/no-suffix asserts stay). LINE-5 at L3031
        (shape contract — must stay green). LINE-8-MD L3082 / LINE-12 L3091 — insert LINE-10 after the last LINE
        block (~L3100) or after T2.S1's LINE-9. FIX = {cwd: TMPDIR} L363. hasBlock helper (boolean) used at L470.
        The spy-ctx pattern from url-injection.test.mjs L700-705 (notes.push) — file-injector.test.mjs has NO
        such helper; build the spy inline in LINE-10."
  pattern: "LINE-10 builds its spy ctx inline ({ cwd: TMPDIR, hasUI: true, ui: { notify: (m,t) => notes.push({m,t}) } })
            and passes it as injectFiles' 3rd param (signature L1487-1491: injectFiles(text, imagesIn, ctx)). The
            literal-file negative writes path.join(TMPDIR, 'literal0.ts:0') in the test body and rmSync's it in a
            finally (mirror A2/E4's config/fixture cleanup style)."
  gotcha: "injectFiles' ctx param is 3rd (item §4: 'whose ctx param is 3rd — see L1661'). Do NOT add a
           ctxWithNotifySpy helper at file scope unless you use it twice — inline in LINE-10 is fine."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. The edits are additive optional fields on two return types + a
        notify call — no type impact beyond the widened (still-compatible) shapes."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD d954487 (T1.S1/S2/S3 committed); T2.S1's LR-2 in flight in the working tree
├── file-injector.ts             # ← EDITED (splitLineRange L172-180; scanTokens L1143-1191; processTokenStream L1204-1222)
│                                #   injectFile (T2.S1's, parallel) and emitText (T1.S3's) UNTOUCHED
├── file-injector.test.mjs       # ← EDITED (LINE-4's 2 invalid asserts updated in place; +LINE-10)
├── import-behavior.test.mjs     # run via npm test (NOT edited)
├── relative-imports.test.mjs    # run via npm test (NOT edited)
├── url-injection.test.mjs       # run via npm test (NOT edited; L700-705 is the spy-pattern REFERENCE)
├── scripts/typecheck.mjs        # untouched
└── plan/011_e473dac8178b/
    ├── architecture/{code_map.md, system_context.md, external_deps.md}
    ├── P1M1T1S3/{PRP.md}   # ← T1.S3 (Complete): emitText quadruple + JSDoc
    ├── P1M1T2S1/{PRP.md}   # ← T2.S1 (parallel): LR-2 injectFile guards — DISJOINT
    └── P1M1T2S2/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — splitLineRange: +invalid marker on the validation-failure branch (+JSDoc, Mode A);
                          #   scanTokens: +invalidRange record surfacing (additive field); processTokenStream:
                          #   +invalidRange branch (hasUI-guarded 'warning' notify + continue) with the message
                          #   documented at the firing site.
file-injector.test.mjs    # MODIFIED — LINE-4's two invalid asserts updated in place ({path, invalid:true});
                          #   +LINE-10 runCase (spy ctx; 1 positive + 4 negatives; literal-file fixture in-body w/ finally).
# No other files. injectFile UNTOUCHED (T2.S1). emitText UNTOUCHED (T1.S3, landed). No new exports/imports/helpers.
```

### Known Gotchas of our Codebase & Library Quirks

```ts
// CRITICAL — scanTokens has NO ctx parameter (verified: signature L1143-1148 = (text, baseDir, opts, state)).
//   The notify CANNOT fire inside it. scanTokens signals via the record ({path: token, invalidRange: true});
//   processTokenStream (which has ctx) fires the notify. Do NOT add ctx to scanTokens — it is EXPORTED and
//   unit-tested (LINE-5 calls it with a 4-arg shape + a literal State).

// CRITICAL — the notify condition is LITERAL-resolution-fails, not "both exact and stripped fail". The item
//   §3b says "fail BOTH exact and stripped resolution", but LINE-10 (the required test) uses '#@a.ts:0' where
//   a.ts EXISTS — the stripped path WOULD resolve. The PRD (§6 LR-3: "resolves to no file"; §2.2) + LINE-10
//   are authoritative: invalid suffix + literal token unresolvable → notify. The stripped retry is NEVER
//   attempted for invalid ranges (current behavior, unchanged — the range is meaningless if invalid).

// CRITICAL — exact-path-wins must never notify. A file literally named 'a.ts:0' resolves whole via the
//   exact-first resolveImportPath(token) → abs is set → no invalid record → no notify (§2.4). LINE-10's 4th
//   sub-assert pins this with a real in-body fixture 'literal0.ts:0'.

// CRITICAL — the surfaced record skips ALL dedup bookkeeping. Its path (the raw token) failed resolution by
//   construction, so it can never collide with a claim key. processTokenStream checks `rec.invalidRange` FIRST
//   (before the claimKey lookup) and continues — no key consulted, no key added, no count bump, no injectFile.

// GOTCHA — the message uses an EM DASH (—, U+2014): `#@${rec.path} — not injected (range must be :N or :N-M,
//   M ≥ N ≥ 1)`. rec.path is the CLEANED token; '#@' is prepended so the message shows the token as typed.
//   LINE-10 asserts this string EXACTLY (including the ≥ characters). Use a template literal, not concat.

// GOTCHA — type 'warning', NOT 'info'. The SPA-fallback at L956 uses 'info'; LR-3's spec says "warning notify"
//   (§6) and LINE-10 asserts t === "warning".

// GOTCHA — injectMarkdown calls scanTokens DIRECTLY (L~1300) and iterates records calling injectFile. An
//   invalidRange record flowing there is harmless: injectFile(rec.path) stat-misses the unresolvable literal
//   → returns false → no notify (injectMarkdown's ctx threading is OPTIONAL per item §3 note and NOT done
//   here — the top-level prompt path is REQUIRED and is what LINE-10 tests). Do NOT touch injectMarkdown.

// GOTCHA — duplicate invalid tokens in one prompt (e.g. '#@a.ts:0 twice') fire two notifies. That is
//   acceptable and simplest (the item's "no duplicate notifies per token" clause applies ONLY IF markdown
//   threading were added). Note the choice in the firing-site comment.

// LIBRARY — the ≥ characters in the message are plain BMP chars; the em dash is U+2014 (already used in
//   formatBinaryBlock). No type changes: `invalid?: true` / `invalidRange?: true` are additive optional
//   fields. tsc --strict clean.
```

## Implementation Blueprint

### Edit 1 — splitLineRange gains the invalid marker (L172-180)

**oldText** (the invalid branch, L177):
```ts
  if (!Number.isFinite(start) || start < 1 || !Number.isFinite(end) || end < start) return { path: token };
```
**newText**:
```ts
  // LR-3 (§2.2/§6) — the suffix MATCHED the range regex but failed validation (start<1 or end<start).
  // Mark it `invalid` so scanTokens can distinguish a typo'd range from a plain no-suffix token and surface
  // it for the LR-3 warning notify (fired by processTokenStream). The path stays the RAW token: an invalid
  // range is not a range, so the token falls back to literal resolution (which normally fails → verbatim+notify).
  if (!Number.isFinite(start) || start < 1 || !Number.isFinite(end) || end < start) return { path: token, invalid: true };
```
Plus: (a) widen the return type annotation to `{ path: string; startLine?: number; endLine?: number; invalid?: true }`;
(b) update the JSDoc: "…Invalid suffixes (`:0`, `:5-3`) return `{path: token, invalid: true}` — the raw token
plus the LR-3 marker (valid and no-suffix shapes are unchanged)." The no-suffix early return (`if (!m) return
{ path: token };`) and the valid returns are **byte-identical, UNTOUCHED**.

### Edit 2 — scanTokens surfaces the invalid record (inside the `if (!abs)` block, L1174-1183)

**oldText**:
```ts
    if (!abs) {
      const parsed = splitLineRange(token);
      if (parsed.startLine !== undefined && parsed.path !== token) {
        if (!opts.allowAbsTilde && isAbsoluteOrTilde(parsed.path)) continue;
        abs = await resolveImportPath(parsed.path, baseDir, opts.tryMdExt);
        if (abs) { startLine = parsed.startLine; endLine = parsed.endLine; }
      }
    }
```
**newText**:
```ts
    if (!abs) {
      const parsed = splitLineRange(token);
      // LR-3 — the suffix looked like a range (:N / :N-M) but failed validation, AND the literal token
      // (exact-path-wins) resolved to nothing. Surface it so the ctx-holding caller (processTokenStream)
      // can fire the warning notify — scanTokens has NO ctx (exported contract), so the record IS the signal.
      // No dedup bookkeeping: this path failed resolution by construction (no claim-key collision possible).
      if (parsed.invalid) { out.push({ path: token, invalidRange: true }); continue; }
      if (parsed.startLine !== undefined && parsed.path !== token) {
        if (!opts.allowAbsTilde && isAbsoluteOrTilde(parsed.path)) continue;
        abs = await resolveImportPath(parsed.path, baseDir, opts.tryMdExt);
        if (abs) { startLine = parsed.startLine; endLine = parsed.endLine; }
      }
    }
```
Plus: widen the record type (both the `out` declaration and the return type annotation) to
`{ path: string; startLine?: number; endLine?: number; invalidRange?: true }[]`.

> Order note: the `parsed.invalid` check goes FIRST in the block — an invalid range never gets a stripped
> retry. Note this also means the `isAbsoluteOrTilde` guard does not apply to invalid records (an invalid
> `#@/etc/hosts:0` at top level still notifies — allowAbsTilde is true there anyway; inside markdown it
> surfaces as a record and injectMarkdown's injectFile stat-misses harmlessly, no notify). Acceptable; note
> it in the firing-site comment if you want belt-and-suspenders documentation.

### Edit 3 — processTokenStream fires the notify (the loop, L1212-1216)

**oldText**:
```ts
  const recs = await scanTokens(text, baseDir, opts, state); // scan once, before any injection (opts carries tryMdExt)
  for (const rec of recs) {
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // same path+range already claimed since scan
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, emits block(s); never throws
  }
```
**newText**:
```ts
  const recs = await scanTokens(text, baseDir, opts, state); // scan once, before any injection (opts carries tryMdExt)
  for (const rec of recs) {
    // LR-3 (§6) — malformed-range tokens warn instead of vanishing. scanTokens (no ctx — exported contract)
    // surfaces them as {path: rawToken, invalidRange: true}; fire the hasUI-guarded warning HERE (the SPA-
    // fallback notify pattern, but type 'warning') and skip injection: the token stays verbatim, exactly as
    // before, but the user now SEES the typo. '#@' + the cleaned token shows it as typed. Duplicate invalid
    // tokens notify per occurrence (top-level simplicity; markdown-import scans don't reach this branch —
    // their records flow to injectFile which stat-misses harmlessly).
    if (rec.invalidRange) {
      if (ctx.hasUI) ctx.ui?.notify(`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, "warning");
      continue;
    }
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue; // same path+range already claimed since scan
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine); // claims key, emits block(s); never throws
  }
```

### Edit 4 — LINE-4's two invalid asserts (update IN PLACE, test L3023-3024)

**oldText**:
```js
  assert(JSON.stringify(mod.splitLineRange("a.ts:0")) === JSON.stringify({ path: "a.ts:0" }), ":0 invalid → keep raw");
  assert(JSON.stringify(mod.splitLineRange("a.ts:5-3")) === JSON.stringify({ path: "a.ts:5-3" }), "end<start invalid → keep raw");
```
**newText**:
```js
  assert(JSON.stringify(mod.splitLineRange("a.ts:0")) === JSON.stringify({ path: "a.ts:0", invalid: true }), ":0 invalid → raw token + LR-3 invalid marker");
  assert(JSON.stringify(mod.splitLineRange("a.ts:5-3")) === JSON.stringify({ path: "a.ts:5-3", invalid: true }), "end<start invalid → raw token + LR-3 invalid marker");
```
(The three valid/no-suffix asserts directly above are UNTOUCHED — the shapes are byte-identical.)

### Edit 5 — the LINE-10 test (insert after the last LINE block — after T2.S1's LINE-9 or after LINE-12 ~L3100)

```js
// LINE-10 — LR-3 (§6): a malformed-range token (`:0`, `:5-3`) that resolves to no file warns instead of
// vanishing. Injected:0, prompt verbatim, ONE warning notify with the token as typed. Negatives: no-suffix
// missing files stay silent; valid ranges that resolve stay silent; a LITERAL file named `…:0` resolves whole
// (exact-path-wins) with NO notify. Spy ctx mirrors url-injection.test.mjs's ctxWithNotifySpy (notes.push);
// injectFiles' ctx param is 3rd.
await runCase("LINE-10", "LR-3: #@a.ts:0 → injected:0, prompt verbatim, warning notify fired", async () => {
  const notes = [];
  const r = await mod.injectFiles("See #@a.ts:0 here", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } });
  assert(r.injected === 0, `injected:0 (nothing delivered), got ${r.injected}`);
  assert(r.text === "See #@a.ts:0 here", `prompt verbatim (#@a.ts:0 untouched), got ${JSON.stringify(r.text)}`);
  assert(notes.length === 1, `exactly one notify fired, got ${notes.length}`);
  assert(notes[0]?.t === "warning", `notify type 'warning', got ${notes[0]?.t}`);
  assert(notes[0]?.m === "#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)",
    `message shows the token as typed (em dash, ≥ chars), got ${JSON.stringify(notes[0]?.m)}`);

  // Negative: a missing file with NO range-looking suffix stays silent (the common missing-file path).
  const notes2 = [];
  await mod.injectFiles("See #@nope.ts", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes2.push({ m, t }) } });
  assert(notes2.length === 0, `missing file w/o range: NO notify, got ${notes2.length}`);

  // Negative: a VALID range that resolves stays silent (delivers normally).
  const notes3 = [];
  const r3 = await mod.injectFiles("See #@a.ts:2", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes3.push({ m, t }) } });
  assert(r3.injected === 1 && notes3.length === 0, `valid range resolves: injected=1, NO notify (notes=${notes3.length})`);

  // Negative (§2.4 exact-path-wins): a file LITERALLY named '…:0' resolves whole — never notifies.
  const lit = path.join(TMPDIR, "literal0.ts:0");
  fsSync.writeFileSync(lit, "literal colon-zero file\n");
  try {
    const notes4 = [];
    const r4 = await mod.injectFiles("See #@literal0.ts:0", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes4.push({ m, t }) } });
    assert(r4.injected === 1 && notes4.length === 0, `literal '…:0' file exists → exact wins, delivered whole, NO notify`);
    assert(hasBlock(r4, "literal colon-zero file"), "the literal file's content was delivered");
  } finally {
    fsSync.rmSync(lit, { force: true });
  }
});
```

### Implementation Tasks (ordered)

```yaml
Task 1: EDIT splitLineRange — the invalid branch returns {path: token, invalid: true}; widen the return type;
        update the JSDoc (invalid marker documented — Mode A, item §5). Valid/no-suffix shapes UNTOUCHED.
Task 2: EDIT scanTokens — inside `if (!abs)`, the `parsed.invalid` check FIRST (surface the record, continue);
        widen the record type (out declaration + return annotation). No dedup bookkeeping on the record.
Task 3: EDIT processTokenStream — the invalidRange branch first in the loop (hasUI-guarded 'warning' notify
        with the exact message; continue). Document the notify string at the firing site (Mode A, item §5).
Task 4: UPDATE LINE-4's two invalid asserts in place (the exact oldText→newText above). Valid asserts untouched.
Task 5: ADD the LINE-10 runCase (after the last LINE block; the verbatim body above — spy ctx inline, 4 negatives,
        the literal-file fixture written in-body and rmSync'd in a finally).
Task 6: VERIFY gates:
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 178 passed (T2.S1's LINE-9 + LINE-10 over 176; LINE-4 in-place). If T2.S1
    hasn't landed yet: 177 (176 + LINE-10). LINE-5, LINE-6, LINE-7/8/12, LINE-9 (if landed) all green.
  - npm test → all 4 files green.
  - git diff --stat → file-injector.ts + file-injector.test.mjs ONLY; the .ts hunks are ALL inside
    splitLineRange/scanTokens/processTokenStream (NOT injectFile — T2.S1's; NOT emitText — T1.S3's).
```

## Validation Loop

### Level 1: Typecheck

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: 0 errors. The edits are additive optional fields + a notify call. If tsc complains about the
# record/return types, re-check BOTH annotations were widened (scanTokens' return type AND its `out` local).
```

### Level 2: The main suite (LINE-4 updated; LINE-10 added; all prior green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 178 passed, 0 failed." (or 177 if T2.S1's LINE-9 hasn't landed yet).
# Spot-check: LINE-4 ✓ (new invalid shape); LINE-5 ✓ (valid scanTokens records unchanged); LINE-10 ✓;
#   LINE-6 ✓ (text ranges still deliver distinctly); LINE-9 ✓ (if landed — injectFile untouched by T2.S2).
# If LINE-10's message assert fails: compare char-for-char (em dash U+2014, ≥ chars, '— not injected (range
#   must be :N or :N-M, M ≥ N ≥ 1)').
# If the literal-file negative fails: the invalid check ran BEFORE exact resolution — re-check Edit 2 (the
#   parsed.invalid branch is INSIDE `if (!abs)`, i.e. AFTER the exact resolveImportPath already failed).
```

### Level 3: The full 4-file gate

```bash
cd /home/dustin/projects/pi-file-injector
npm test   # file-injector && import-behavior && relative-imports && url-injection — all green
# url-injection must stay green: URL tokens never reach splitLineRange (§1 out-of-scope; the URL branch
# resolves before the file scan — verified in system_context.md).
```

### Level 4: Scope verification

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat   # expect: file-injector.ts, file-injector.test.mjs ONLY
# Inspect the .ts hunks: ALL must be inside splitLineRange / scanTokens / processTokenStream. injectFile's
# branches are T2.S1's (parallel) — if your diff touches them, you've collided; re-scope.
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` → 0 errors.
- [ ] `node ./file-injector.test.mjs` → 178 passed (177 pre-T2.S1), 0 failed.
- [ ] `npm test` → 4 files green.
- [ ] `git diff --stat` → file-injector.ts + file-injector.test.mjs only; .ts hunks confined to the trio.

### Feature Validation (LR-3)
- [ ] `#@a.ts:0` (a.ts exists, no literal `a.ts:0` file) → injected:0, verbatim, ONE warning notify with the
      exact message `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`.
- [ ] `:5-3` same shape (covered by the splitLineRange unit assert; optionally add an injectFiles-level case).
- [ ] Missing-file-no-suffix → silent. Valid range → silent (delivers). Literal `…:0` file → delivers whole, silent.
- [ ] No hasUI → no notify fires (headless safe — the `if (ctx.hasUI)` guard).
- [ ] LINE-5 green (scanTokens valid-record shape unchanged); LINE-6/7/8/12 green (range machinery untouched).

### Scope Discipline
- [ ] injectFile UNTOUCHED (T2.S1's branches); emitText UNTOUCHED (T1.S3's); injectMarkdown UNTOUCHED (its
      direct scanTokens call flows invalid records to injectFile → harmless stat-miss, no notify).
- [ ] scanTokens' signature UNCHANGED (no ctx added); only its return type widens additively.
- [ ] No new exports/imports/helpers/fixtures (LINE-10's literal file is in-body with finally cleanup).

### Documentation
- [ ] splitLineRange JSDoc documents the invalid marker (Mode A, item §5).
- [ ] The notify string is documented at the processTokenStream firing site (Mode A, item §5).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT add a ctx parameter to scanTokens.** It is exported and unit-tested (LINE-5's 4-arg call). The
  notify MUST fire from processTokenStream via the record signal (item §1's CRITICAL constraint).
- ❌ **Do NOT require "both exact and stripped resolution to fail".** The item §3b's wording contradicts
  LINE-10 (a.ts exists → stripped would resolve). The authoritative rule (PRD §6/§2.2): invalid suffix +
  literal token unresolvable → notify. The stripped retry is never attempted for invalid ranges.
- ❌ **Do NOT notify when a literal `…:0` file resolves.** Exact-path-wins (§2.4): the exact-first
  resolveImportPath succeeds → abs set → no invalid record → no notify. LINE-10's 4th sub-assert pins it.
- ❌ **Do NOT change valid/no-suffix splitLineRange shapes.** LINE-4's three valid asserts and every consumer
  depend on byte-identical shapes; only the validation-failure branch gains `invalid: true`.
- ❌ **Do NOT add dedup bookkeeping for invalid records.** Their path failed resolution — no key collision is
  possible. processTokenStream checks invalidRange BEFORE the claimKey lookup and continues.
- ❌ **Do NOT use notify type 'info'.** LR-3 is a warning (§6; LINE-10 asserts t === "warning"). The L956 SPA
  pattern is a shape reference, not a type reference.
- ❌ **Do NOT touch injectFile, emitText, or injectMarkdown.** injectFile is T2.S1's (parallel, LR-2);
  emitText is T1.S3's (landed); injectMarkdown's direct scanTokens call is harmless without threading
  (records → injectFile → stat-miss → false, no notify; threading is explicitly optional per item §3).
- ❌ **Do NOT forget the finally cleanup of the literal fixture** in LINE-10 (`literal0.ts:0` must not leak
  into TMPDIR for later tests).
- ❌ **Do NOT hand-build the message with concat and get the dash wrong.** Use the template literal exactly as
  specified: `` `#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)` `` (em dash U+2014).

---

## Confidence Score: 9/10

Three tightly-scoped function edits (a marker on one return branch, a record-surfacing check, a notify branch)
+ an in-place test update + one new test, all traced to quoted live code. The CRITICAL reconciliation (the
item's "both resolutions fail" vs LINE-10's existing-fixture reality → literal-resolution-fails rule) is
resolved from the authoritative PRD and encoded in the blueprint + anti-patterns. The ctx-less-scanTokens
constraint and its record-signal workaround are pinned to the L956 SPA-notify precedent. The -1 reserves for:
(a) the parallel T2.S1 sharing file-injector.ts (disjoint functions, but line numbers drift — the PRP mandates
placing by quoted text and a Level-4 hunk-scope check), and (b) the exact notify-message string (em dash + ≥
characters must match LINE-10's assert byte-for-byte — the PRP gives it verbatim in both places). Gates:
typecheck 0 errors, main suite 178 passed (177 pre-T2.S1), npm test 4-file green.