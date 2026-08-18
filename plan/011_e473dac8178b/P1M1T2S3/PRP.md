---
name: "P1.M1.T2.S3 (plan/011) — LR-4: past-EOF start is a failed token (no empty block, claim revoked, notify)"
prd_ref: "Line-Range feature §6 'LR-4 — a start past EOF is a failed token, not an empty block' (normative, fixes verified gap) + §4 'Empty/edge slices' (start past EOF → empty slice → MUST NOT deliver as empty block; end clamps and still delivers) + §8 edge rows '#@a.ts:99 (5-line file) → Verbatim, no block, claim revoked, notify' and '#@empty.txt:1 → Past-EOF on a 0-line file → verbatim + notify' + §9 LINE-11 + §10 gap register"
target_file: "./file-injector.ts"   # + countLines (new, after sliceLines ~L188) + turnAwayPastEof (new) + injectFile's markdown & text branches (~L1310-1326)
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + `node ./file-injector.test.mjs` 178 passed + `npm test` 4-file green)
depends_on: "T1.S1/S2/S3 (Complete/committed: emitText LR-1 range branch + LR-5 + emitWholeText) + T2.S1 (Complete/committed cec5f1d: LR-2 guards in the F5/image/binary branches — NOT the text/markdown branches S3 edits) + T2.S2 (LANDED in tree: LR-3 trio splitLineRange/scanTokens/processTokenStream + LINE-10; baseline 177 passed). Baseline gate GREEN at 177."
consumed_by: "P1.M2.T1.S2 (formalizes the LINE-11 gate alongside LINE-8/12 — T2.S3 ships the fix + LINE-11); P1.M2.T2.S1 (README failure-feedback wording)"
---

# PRP — P1.M1.T2.S3: LR-4 — past-EOF start is a failed token (no empty block, claim revoked, notify)

> **Scope flag:** Source fix in **injectFile's markdown + text branches** (the two line-bearing call paths)
> + ONE new exported pure helper (`countLines`) + ONE new private helper (`turnAwayPastEof`) + the LINE-11
> test + a LINE-4 unit extension + the sanity/ASSERTED_EXPORTS registration. Today `#@a.ts:99` on a 4-line
> file delivers an **empty `<file>` block**, bumps `injected` to 1, and **poisons the claim** (verified in
> research §2). LR-4 makes it a failed token: NO block, NO detail, NO count bump, claim **REVOKED**, token
> verbatim, hasUI-guarded **warning** notify `#@<abs>:99 — not injected (file has 4 lines)`. Mirrors the
> `read` tool, which errors past EOF. A clamped **END** still delivers (clamping is recovery, not failure).
>
> **THE CRITICAL DESIGN FINDING (research §3):** the failure predicate is **`startLine > lineCount(content)`**
> — NOT `slice === ""`. `sliceLines("a\n\nb", 2, 2)` returns `""` for a **legitimate empty line** (line 2
> exists and is empty) which must DELIVER; only the lineCount predicate distinguishes past-EOF from
> empty-line slices. And `countLines` needs an explicit **0-byte → 0 lines** case: `"".split("\n")` is
> `[""]` (length 1), but the spec (PRD §4/§8) pins a 0-byte file at **0** lines so `#@empty.txt:1` fails.

---

## Goal

**Feature Goal:** Implement LR-4 (Line-Range feature §6): a ranged token whose `startLine` exceeds the
file's line count (wc-l semantics) is a **failed token** on BOTH line-bearing call paths (direct text via
injectFile's text branch; markdown via injectFile's markdown branch before injectMarkdown runs): no block
with an empty body is delivered, `state.count` is NOT bumped, the `claimKey(abs, startLine, endLine)` claim
is **revoked** (claim ⟺ delivered, §12.5) so a later valid token of the same file in the SAME prompt still
injects, the token stays verbatim (§6.4), and a hasUI-guarded `warning` notify fires
`#@<abs>:<N> — not injected (file has <L> lines)`. A clamped END (`:2-100000` on a 5-line file) still
delivers (LR-5's clamping is recovery, not failure) — the guard tests ONLY the start.

**Deliverable:**
1. `export function countLines(content: string): number` (new, placed immediately after `sliceLines` ~L188)
   — wc-l line count with the explicit 0-byte→0 case.
2. `function turnAwayPastEof(abs, key, state, ctx, startLine, endLine, lineCount): false` (new, private,
   near injectFile) — the shared turn-away: delete the claim + hasUI-guarded warning notify + `return false`.
3. injectFile's **markdown branch**: hoist `mdContent`, guard `startLine > countLines(mdContent)` →
   `return turnAwayPastEof(...)`, else `injectMarkdown(abs, mdContent, …)` (unchanged call, now with the hoisted content).
4. injectFile's **text branch**: same guard shape around the existing `emitText` call.
5. Test: `countLines` typeof sanity assert + `ASSERTED_EXPORTS` entry; LINE-4 extended with 4 countLines
   unit asserts (in place); **LINE-11** (after LINE-10 ~L3160) — the failing-test-first gate with 6 sub-cases
   (text positive, claim-release ordering, markdown path, clamped-end negative, 0-byte edge, boundary `:5`).
6. [Mode A] JSDoc on `countLines` (wc-l semantics + the 0-byte case + its LR-4 consumer) and on the chosen
   seam (injectFile's claim-semantics block gains the LR-4 paragraph; `turnAwayPastEof` documents the
   contract at its definition).

**Success Definition:**
1. `npm run typecheck` → 0 errors (additive helpers + two guards; ZERO signature changes).
2. `node ./file-injector.test.mjs` → **178 passed, 0 failed** (177 baseline + LINE-11; LINE-4 extended in
   place, count unchanged). LINE-1…LINE-6, LINE-8/8-MD, LINE-9, LINE-10, LINE-12 all green.
3. `npm test` → all 4 files green (import-behavior / relative-imports / url-injection untouched).
4. LINE-11 passes: `#@lr4_five.txt:99` (5-line file) → `injected:0`, verbatim, no block AND no detail,
   ONE warning notify `` `#@${five}:99 — not injected (file has 5 lines)` ``; the claim-release sub-case
   (`:99 then :1` in one prompt) delivers line 1; the markdown path fails identically; `:2-100000` and
   `:5` (boundary) still deliver silently.
5. `git diff --stat` → file-injector.ts + file-injector.test.mjs ONLY; the .ts hunks confined to the two
   new helpers + injectFile's markdown/text branches (NOT emitText, NOT injectMarkdown, NOT the LR-3 trio,
   NOT the F5/image/binary branches).

## User Persona

**Target User:** A user who types an explicit line range that starts past the file's end — a typo
(`#@a.ts:99` meaning `:9`), a stale line number after an edit, or a mistaken belief about file length.

**Use Case:** User submits `See #@config.ts:99`; config.ts has 12 lines. Today the model receives an
EMPTY `<file>` block (misleading — looks like an empty file) and the UI shows a delivered read line. After
LR-4: nothing is delivered, the token stays verbatim, and a warning appears —
`#@…/config.ts:99 — not injected (file has 12 lines)` — telling the user the real length immediately.

**Pain Points Addressed:** The verified LR-4 gap (§10): "empty block, `injected=1`, a `read a.ts:99` line
today." An empty block misleads the MODEL (reads as an empty file); the poisoned claim silently swallows a
later legitimate token of the same file+range; and the user gets zero feedback. Mirrors the `read` tool,
which errors on past-EOF rather than returning nothing.

## Why

- **Closes the verified LR-4 gap** (§6/§10). The spec pins all four contract elements: no empty block,
  claim revoked, verbatim, warning notify. `claim ⟺ delivered` (§12.5) is the invariant — the existing
  revoke precedent is injectFile's catch (L1329-1331: `state.injectedSet.delete(key); … return false;`),
  which LR-4 mirrors on a new failure axis (semantic, not exceptional).
- **The empty block actively misleads.** `emitWholeText(abs, "", …)` produces `<file name="…">\n\n</file>`
  + a `kind:"text"` detail (lines: 0) + a green read line — the model reads "empty file", the user reads
  "delivered". The read-tool analogy (§6: "errors on past-EOF rather than returning nothing") is the
  designed behavior.
- **The poisoned claim is a latent dedup bug.** Without the revoke, a later `#@a.ts:99` re-encountered
  through a markdown import's scan (injectMarkdown's scanTokens consults `state.injectedSet`) is silently
  verbatim'd forever — a failed delivery permanently suppressing retries. The revoke restores retryability.
- **Minimal, seam-stable shape.** The item leaves the seam open (emitText-signals vs pre-check); this PRP
  picks the pre-check (option b) with the lineCount predicate, requiring ZERO signature changes (research §3)
  and leaving emitText/emitWholeText/injectMarkdown/scanTokens/processTokenStream untouched — disjoint from
  both T2.S1's landed branches and T2.S2's landed trio.

## What

User-visible: a past-EOF ranged token (text OR markdown) now delivers nothing and warns instead of
delivering an empty block; the notify shows the resolved absolute path + canonical range + the file's real
line count. A clamped end still delivers (unchanged). Everything else — whole-file delivery, valid ranges,
empty whole files (`#@empty.txt`), images/binaries with ranges (LR-2 ignores them) — is unchanged.

Externally: one NEW export (`countLines`, pure) + two guards inside injectFile. No signature changes to any
existing function; no config, no renderer, no detail-shape changes.

### Success Criteria

- [ ] `countLines("")` === 0; `("a")` === 1; `("a\n")` === 1; `("a\nb")` === 2; `("l1\n…\l5\n")` === 5
      (pinned by LINE-4's new unit asserts; the 0-byte case is the spec-mandated special case).
- [ ] injectFile's text branch: for `startLine !== undefined && startLine > countLines(content)` → NO
      `emitText` call, NO block, NO detail, NO `state.count++`, `state.injectedSet.delete(key)`, ONE
      hasUI-guarded warning notify, `return false`.
- [ ] injectFile's markdown branch: the SAME guard BEFORE `injectMarkdown` runs (a ranged markdown token
      past EOF fails identically — injectMarkdown is never entered with a past-EOF range).
- [ ] Claim release: `#@five.txt:99 then #@five.txt:1` in ONE prompt → `injected:1` (line 1 delivered),
      exactly ONE notify (the :99). The revoke lands before record 2 processes (single-threaded await chain).
- [ ] Clamped END delivers: `#@lr4_five.txt:2-100000` → lines 2–5 delivered, NO notify (the guard tests
      ONLY startLine; endLine clamping is LR-5's recovery).
- [ ] Boundary: `#@lr4_five.txt:5` (start === lineCount) → line 5 DELIVERS, no notify (only `>` fails).
- [ ] 0-byte file: `#@empty.txt:1` → fails with `(file has 0 lines)`.
- [ ] The notify: `if (ctx.hasUI) ctx.ui?.notify(\`#@${abs}${canonicalRange} — not injected (file has ${n} lines)\`, "warning")`
      — em dash U+2014, type `"warning"` (not "info"), canonical range (`:N`, never `:N-N`), hasUI-guarded
      (headless-safe). The path is the resolved ABS (the typed token is not plumbed to the inject layer —
      see Anti-Patterns).
- [ ] Images/binaries with past-EOF ranges are UNAFFECTED (LR-2: the range is ignored; the guard lives only
      in the text/markdown branches) — LINE-9 stays green.
- [ ] `npm run typecheck` 0 errors; `node ./file-injector.test.mjs` **178 passed**; `npm test` 4-file green.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** The exact
current bodies of both edit-site branches are quoted verbatim with oldText→newText; the CRITICAL predicate
analysis (slice-emptiness false-fails legitimate empty lines — proven with `sliceLines("a\n\nb",2,2)===""`)
is encoded; the countLines 0-byte trap (`"".split("\n")` → `[""]` → length 1 vs the spec's 0) is encoded
with the fixed helper body; the notify-message decision (abs-based, canonical range, why threading the
typed token is forbidden) is documented; the claim-release ordering is traced record-by-record; the
LINE-11 test body is written verbatim (mirroring the landed LINE-10's inline spy pattern); the
sanity/ASSERTED_EXPORTS surface-sync mechanism (which FAILS if countLines isn't registered) is pinned;
and the disjoint-function boundary vs both landed siblings (T2.S1, T2.S2) is explicit.

### Documentation & References

```yaml
# MUST READ — the normative LR-4 contract + the exact notify example
- file: PRD.md  (Line-Range feature §6 LR-4 + §4 Empty/edge slices + §8 edge rows + §9 LINE-11 + §10 gap register)
  why: "§6 LR-4: 'A start past EOF is a failed token, not an empty block… MUST NOT deliver an empty <file>
        block… Leave the token verbatim, revoke the claim (claim ⟺ delivered, §12.5), and notify
        `#@a.ts:99 — not injected (file has 5 lines)`. Mirrors the read tool… A clamped END, by contrast,
        still delivers.' §4: 'end past EOF clamps… a start past EOF yields an empty slice — which MUST NOT
        be delivered as an empty block.' §8: '#@a.ts:99 (5-line file) → Verbatim, no block, claim revoked,
        notify' + '#@empty.txt:1 → Past-EOF on a 0-line file → verbatim + notify.' §9 LINE-11: 'no block,
        no empty body, claim released, notify fired.'"
  critical: "§8 pins the 0-byte file at 0 lines (so :1 is past-EOF) — countLines MUST return 0 for \"\" even
             though \"\".split(\"\\n\") has length 1. §6's example notify uses a relative token for
             readability; the implementable form is abs+canonical-range (the typed token is not plumbed to
             the inject layer — injectFile's signature is EXPORTED and must not change)."

# MUST READ — the verified seams, the bug trace, the predicate analysis, the ordering proof
- file: plan/011_e473dac8178b/P1M1T2S3/research/research_notes.md
  why: "§2 traces today's bug end-to-end (both call paths); §3 is the CRITICAL finding — the predicate is
        startLine > lineCount, NOT slice === \"\" (a legitimate empty line delivers \"\"), plus the 0-byte
        countLines trap; §4 pins the exact edit anchors; §5 the notify decision; §6 the claim-release
        record-by-record ordering proof; §7 the LINE-11 design; §8 the regression surfaces checked."
  critical: "Everything in the PRP's Known Gotchas traces to this file — read it before editing."

# MUST READ — the landed siblings' boundaries (both LANDED; S3 must not touch their hunks)
- file: plan/011_e473dac8178b/P1M1T2S1/PRP.md   (LR-2 — LANDED at cec5f1d)
  why: "T2.S1's guards live in injectFile's F5/image/binary branches (the `if (key !== abs) { … delete(key);
        return false; }` blocks at ~L1265/1280/1303) AND its catch (L1329-1331 deletes key + abs). S3 edits
        the OTHER two branches (markdown/text) — the revoke pattern to copy is T2.S1's catch. Line numbers
        drift; PLACE BY QUOTED TEXT."
- file: plan/011_e473dac8178b/P1M1T2S2/PRP.md   (LR-3 — LANDED in tree)
  why: "T2.S2's trio (splitLineRange invalid marker / scanTokens invalidRange surfacing / processTokenStream
        warning branch + LINE-10 at test L3137) is S3's notify-pattern precedent: type 'warning', em dash,
        hasUI-guarded, `#@${path} — not injected (…)`. LINE-11 mirrors LINE-10's inline spy ctx exactly.
        S3 does NOT touch the trio."

# MUST READ — the architecture map (landmarks; the notify precedent; the fixture/test conventions)
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "sliceLines L183-189 (the '' iff past-EOF claim — refined by research §3: '' ALSO for legit empty
        lines); claimKey L192-196; the Ctx type L1105-1112 (ui?.notify + hasUI); the SPA-notify L956
        precedent; the LINE test section ~L2969+; fixture inventory (a.ts = 4 lines; EMPTY 0-byte)."
  critical: "Line numbers in code_map are at HEAD ef57bd0 — they have DRIFTED (LR-2/LR-3 landed). Re-locate
             by symbol: grep -n 'function sliceLines\\|function claimKey\\|MD_EXTS.has(ext)\\|emitText(abs,
             buf.toString' file-injector.ts."

# The file you edit (source)
- file: file-injector.ts
  why: "countLines: NEW, after sliceLines (~L188). turnAwayPastEof: NEW, near injectFile. injectFile's
        markdown branch tail: `await injectMarkdown(abs, buf.toString(\"utf8\"), state, ctx, startLine,
        endLine);`. injectFile's text branch: `emitText(abs, buf.toString(\"utf8\"), state, startLine,
        endLine);`. `key` is in scope (claimKey computed at the top of injectFile); ctx is a param."
  pattern: "Copy the revoke shape from injectFile's catch (L1329-1331) and the notify shape from
            processTokenStream's LR-3 branch (L1218-1220: `if (ctx.hasUI) ctx.ui?.notify(\`…\`, \"warning\")`)."
  gotcha: "The two branches pass `buf.toString(\"utf8\")` INLINE today — hoist each into a local
           (`mdContent`/`txtContent`) ONCE and use it for both the guard and the existing call. Do NOT
           decode twice."

# The file you edit (test)
- file: file-injector.test.mjs
  why: "Sanity list L114-136 (add the countLines typeof assert after sliceLines at L118); ASSERTED_EXPORTS
        L143-148 (add \"countLines\" — the surface-sync check at L150-156 FAILS otherwise); LINE-4 at L3019
        (extend with countLines unit asserts, in place); LINE-10 at L3137 (the spy-ctx pattern to mirror);
        insert LINE-11 after LINE-10's closing `});`. hasBlock(r, needle) at L202. EMPTY fixture L366."
  pattern: "LINE-11 mirrors LINE-10 exactly: inline spy ctx `{ cwd: TMPDIR, hasUI: true, ui: { notify: (m, t)
            => notes.push({ m, t }) } }` as injectFiles' 3rd param; inline fixtures (lr4_five.txt, lr4.md)
            written in-body and rmSync'd in a finally (LINE-10's literal0 / LINE-12's lr5_five style)."
  gotcha: "The notify-message assert uses the ABS path: `#@${five}:99 — not injected (file has 5 lines)`
           where five = path.join(TMPDIR, \"lr4_five.txt\"). Template-literal it — do NOT concat and get
           the em dash wrong (U+2014, the same char as formatBinaryBlock)."

# typecheck gate
- file: scripts/typecheck.mjs
  why: "npm run typecheck runs tsc --strict. The edits are an additive pure helper + a private helper + two
        guards — no signature changes, no type impact."
```

### Current Codebase tree

```bash
pi-file-injector/                # HEAD cec5f1d + T2.S2's landed LR-3 edits; gate GREEN at 177
├── file-injector.ts             # ← EDITED (+ countLines after sliceLines ~L188; + turnAwayPastEof near
│                                #    injectFile; markdown branch ~L1310-1317; text branch ~L1323-1326)
│                                #   UNTOUCHED: emitText/emitWholeText (T1.*), injectMarkdown,
│                                #   scanTokens/processTokenStream/splitLineRange (T2.S2), F5/image/binary
│                                #   branches + the catch (T2.S1 — the revoke PRECEDENT, not an edit site)
├── file-injector.test.mjs       # ← EDITED (sanity + ASSERTED_EXPORTS + LINE-4 extension + LINE-11)
├── import-behavior.test.mjs     # run via npm test (NOT edited)
├── relative-imports.test.mjs    # run via npm test (NOT edited)
├── url-injection.test.mjs       # run via npm test (NOT edited)
├── scripts/typecheck.mjs        # untouched
└── plan/011_e473dac8178b/
    ├── architecture/code_map.md
    ├── P1M1T1S1..S3/{PRP.md}        # ← LR-1/LR-5/emitText-unify (Complete)
    ├── P1M1T2S1/{PRP.md}            # ← LR-2 (Complete, cec5f1d)
    ├── P1M1T2S2/{PRP.md}            # ← LR-3 (LANDED in tree; the notify precedent)
    └── P1M1T2S3/{research/research_notes.md, PRP.md}   # (this file)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — +export countLines (pure, wc-l, 0-byte→0; JSDoc Mode A);
                          #   +private turnAwayPastEof (revoke + warning notify + return false; JSDoc Mode A);
                          #   injectFile markdown branch: hoist mdContent + the LR-4 guard;
                          #   injectFile text branch: hoist txtContent + the LR-4 guard;
                          #   injectFile JSDoc claim-semantics block: + the LR-4 paragraph (Mode A).
file-injector.test.mjs    # MODIFIED — sanity list +1 typeof assert; ASSERTED_EXPORTS + "countLines";
                          #   LINE-4 +4 countLines unit asserts (in place); + LINE-11 runCase.
# No other files. No signature changes. No new fixtures at module scope (LINE-11's are in-body w/ finally).
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — THE PREDICATE IS startLine > lineCount, NOT slice === "".
//   sliceLines("a\n\nb", 2, 2) === "" — line 2 EXISTS and is EMPTY; that is a LEGITIMATE delivery that
//   MUST NOT fail. Only the lineCount predicate distinguishes past-EOF from an empty-line slice. An
//   emit-side emptiness check (the item's option (a)) false-fails every range that selects genuinely empty
//   lines. The guard therefore lives UPSTREAM (injectFile's two branches), computed on the FULL content.

// CRITICAL — countLines("") MUST return 0 (the spec pins it), but "".split("\n") is [""] (length 1) and
//   "".endsWith("\n") is false, so a naive parts-mirror returns 1. The helper needs the explicit empty-file
//   case: `if (content.length === 0) return 0;`. For NON-empty content the formula
//   `split("\n").length - (endsWith("\n") ? 1 : 0)` is IDENTICAL to sliceLines' internal parts.length —
//   only "" diverges, and the divergence is moot at runtime (the guard fails before sliceLines runs).
//   Pinned by LINE-4's unit asserts.

// CRITICAL — a CLAMPED END still delivers. The guard tests ONLY startLine (start > count). `:2-100000`
//   on a 5-line file: start 2 ≤ 5 → no failure → emitText slices/clamps to 2-5 (LR-5). Failing on the
//   end would break LINE-12. And the boundary: start === lineCount is the LAST line — it DELIVERS
//   (`:5` on 5 lines; only `>` fails). Pinned by LINE-11 (d) and (f).

// CRITICAL — images/binaries NEVER reach the guard (LR-2): the F5/image/binary branches classify FIRST
//   and ignore the range. The guard lives ONLY in the markdown + text branches. Do NOT hoist it above
//   the cascade — a `mime`-set pre-check would be wrong (fake.png fails the magic sniff and falls through
//   to text/binary, so classification order is load-bearing).

// CRITICAL — register countLines in the test's surface-sync or the gate FAILS before any case runs:
//   the check at file-injector.test.mjs L150-156 asserts every shipped function is in ASSERTED_EXPORTS
//   (L143-148) or PURE_HELPERS_NOT_ASSERTED. Add the typeof sanity assert (after L118) AND the
//   ASSERTED_EXPORTS entry. countLines is unit-tested directly (LINE-4) → ASSERTED_EXPORTS, matching
//   splitLineRange/sliceLines.

// CRITICAL — the notify shows the ABS + canonical range, NOT the token as typed. The typed token is not
//   plumbed to the inject layer (scanTokens resolves to abs before pushing records; injectFile's EXPORTED
//   signature must not gain a token param). Canonical form (`:N`, never `:N-N`) matches claimKey + the
//   LR-5 display. LINE-11 pins the exact string; use a template literal with the em dash U+2014.

// CRITICAL — type "warning", NOT "info" (§6 LR-4; the L956 SPA notify is a SHAPE reference, not a type
//   reference — same as LR-3/LINE-10). And hasUI-guarded: `if (ctx.hasUI) ctx.ui?.notify(…)` — headless
//   print/json fires nothing.

// CRITICAL — the claim-release ordering is safe BY CONSTRUCTION: scanTokens records BOTH tokens (its dedup
//   keys on claimKey(abs, s, e) — `abs:99` ≠ `abs:1`), and turnAwayPastEof's delete happens synchronously
//   inside injectFile BEFORE it returns, so every later record (and any later markdown-import scan that
//   consults injectedSet) sees the released key. processTokenStream's belt-and-suspenders re-check
//   (`injectedSet.has(claimKey(rec…))`) tolerates the released key trivially (has → false → proceeds).
//   LINE-11 (b) pins it end-to-end.

// GOTCHA — do NOT delete the bare `abs` in turnAwayPastEof (the catch does, for LR-2's guard-added key).
//   The text/markdown branches never ADD the bare abs for a ranged token (LR-2's normalization runs only
//   in the image/binary branches), so deleting `key` (which IS claimKey(abs, s, e)) alone is correct and
//   minimal. Deleting abs too would WRONGLY release a legitimate whole-file claim made earlier in the prompt.

// GOTCHA — hoist the decode ONCE per branch (`const mdContent` / `const txtContent`) and reuse it for both
//   the guard and the existing call. Compute countLines ONCE into a local (`const total`) — do not call it
//   twice, and do not re-decode the buffer.

// GOTCHA — injectFile's JSDoc still carries a stale line ("NO markdown branch yet — T2.S3" from an old
//   plan). Do NOT fix it here — out of scope; S3's JSDoc addition is the LR-4 paragraph only. (A future
//   doc sweep can clean the stale line.)

// LIBRARY — TypeScript via jiti; the ONLY hard gates are `npm run typecheck` + the 4 test files. The edits
//   are additive (a pure helper, a private helper, two guards) — zero signature changes, so tsc --strict
//   stays clean. turnAwayPastEof's literal `: false` return type documents the fail-fast contract.
```

## Implementation Blueprint

### Edit A — `countLines` (NEW export; place immediately after `sliceLines`'s closing brace, ~L188)

```ts
/** LR-4 (PRD §17.4/§17.6) — the file's line count under the SAME trailing-newline ("wc -l") semantics as
 *  sliceLines: a single trailing final newline does NOT create an extra line. A 0-byte file has 0 lines
 *  (the explicit special case — `"".split("\n")` would naively yield one empty part, but the spec pins
 *  `#@empty.txt:1` as past-EOF). CONSUMER: injectFile's markdown + text branches fail a ranged token whose
 *  startLine exceeds this count (past-EOF start ⟹ failed token: no empty block, claim revoked, warning
 *  notify — mirroring the read tool, which errors past EOF). NOTE for non-empty content this equals
 *  sliceLines' internal parts.length; only "" diverges (1 vs 0), and the guard runs before sliceLines.
 *  PURE: no I/O, no state. Exported for unit testing (LINE-4) — same convention as splitLineRange/sliceLines. */
export function countLines(content: string): number {
  if (content.length === 0) return 0; // 0-byte file → 0 lines (wc -l; PRD §17.4 — "#@empty.txt:1" is past-EOF)
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}
```

### Edit B — `turnAwayPastEof` (NEW private helper; place immediately before injectFile's JSDoc)

```ts
/** LR-4 (PRD §17.6) — shared past-EOF turn-away for injectFile's two line-bearing branches (text + markdown).
 *  Empty delivered slice ⟹ failed token: revoke the path+range claim (claim ⟺ delivered, §12.5 — the same
 *  invariant the catch block enforces for I/O failures), warn (interactive only), and return false so the
 *  caller skips state.count++. The token stays verbatim (§6.4). Mirrors the read tool, which errors past
 *  EOF rather than returning nothing. The notify shows the resolved ABS + the CANONICAL range (the typed
 *  token is not plumbed to the inject layer; abs+range is unambiguous, matching the <file name="abs">
 *  convention and the LR-7 claim keys) and the file's true wc-l line count. */
function turnAwayPastEof(
  abs: string, key: string, state: State, ctx: Ctx,
  startLine: number, endLine: number | undefined, lineCount: number,
): false {
  state.injectedSet.delete(key); // release the claim — a later VALID token of the same file still injects
  if (ctx.hasUI) {
    const rangeSuffix = startLine === (endLine ?? startLine) ? `:${startLine}` : `:${startLine}-${endLine}`; // canonical (LR-7: :N, never :N-N)
    ctx.ui?.notify(`#@${abs}${rangeSuffix} — not injected (file has ${lineCount} lines)`, "warning");
  }
  return false;
}
```

### Edit C — injectFile's markdown branch (hoist the decode + the guard)

**oldText** (current; the branch tail — re-locate by symbol, lines drift):
```ts
      // line range slices the delivered body; import scan still runs on the (sliced) content.
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx, startLine, endLine);
```
**newText**:
```ts
      // line range slices the delivered body; import scan still runs on the (sliced) content.
      // LR-4 (§17.6) — a start past EOF is a failed token for the line-bearing types (markdown included):
      // no block, no detail, no count++, claim revoked, warning notify. A ranged markdown token past EOF
      // must fail exactly like the text path — an empty <file> block would mislead (mirrors the read tool,
      // which errors past EOF). A clamped END still delivers (clamping is LR-5 recovery, not failure).
      const mdContent = buf.toString("utf8");
      if (startLine !== undefined) {
        const total = countLines(mdContent);
        if (startLine > total) return turnAwayPastEof(abs, key, state, ctx, startLine, endLine, total);
      }
      await injectMarkdown(abs, mdContent, state, ctx, startLine, endLine);
```
(Keep the branch's earlier MARKDOWN comment block — the F5/F3/markdown branch comments above this hunk — UNTOUCHED.)

### Edit D — injectFile's text branch (same shape)

**oldText** (current):
```ts
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      emitText(abs, buf.toString("utf8"), state, startLine, endLine);
    }
```
**newText**:
```ts
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      // LR-4 (§17.6) — past-EOF start ⟹ failed token (see turnAwayPastEof / the markdown branch above for
      // the full contract). startLine === lineCount is the LAST line and still DELIVERS; only > fails.
      const txtContent = buf.toString("utf8");
      if (startLine !== undefined) {
        const total = countLines(txtContent);
        if (startLine > total) return turnAwayPastEof(abs, key, state, ctx, startLine, endLine, total);
      }
      emitText(abs, txtContent, state, startLine, endLine);
    }
```

### Edit E — injectFile's JSDoc (Mode A; append to the CLAIM SEMANTICS block, ~L1240-1251)

Append after the existing LR-2 paragraph:

```ts
 * LR-4 (§17.6 — past-EOF starts): a ranged token whose startLine exceeds the file's wc-l line count is a
 * FAILED token on both line-bearing paths (text + markdown): empty delivered slice ⟹ NO block, NO detail,
 * NO count++, the path+range claim REVOKED (claim ⟺ delivered, §12.5), the token verbatim, and a
 * hasUI-guarded warning notify `#@<abs>:<N> — not injected (file has <L> lines)` — mirroring the read
 * tool, which errors past EOF rather than returning nothing. A clamped END still delivers (LR-5 recovery).
 * The predicate is startLine > countLines(content) — NOT slice emptiness (a legitimate empty line
 * delivers "" and must not fail). Images/binaries never reach the guard (LR-2 ignores their ranges).
```

### Edit F — test: sanity + ASSERTED_EXPORTS + LINE-4 extension + LINE-11

**F1 — sanity list** (after the sliceLines assert, test ~L118):
```js
assert(typeof mod.countLines === "function", "mod.countLines must be a function (LR-4 wc-l line count; 0-byte → 0)");
```
**F2 — ASSERTED_EXPORTS** (test ~L143-148): add `"countLines"` to the set (after `"sliceLines"`).
**F3 — LINE-4 extension** (in place, inside the LINE-4 case ~L3019-3029; after the existing sliceLines asserts):
```js
  // LR-4 — countLines unit pins (wc-l semantics + the 0-byte special case the naive parts-mirror gets wrong).
  assert(mod.countLines("") === 0, "0-byte file → 0 lines (spec: #@empty.txt:1 is past-EOF)");
  assert(mod.countLines("a") === 1, "no trailing newline → 1 line");
  assert(mod.countLines("a\n") === 1, "single trailing newline ≠ extra line (wc -l)");
  assert(mod.countLines("l1\nl2\nl3\nl4\nl5\n") === 5, "5 lines with trailing newline → 5");
```
**F4 — LINE-11** (insert after LINE-10's closing `});`, ~L3160):

```js
// LINE-11 — LR-4 (§17.6): a start past EOF is a FAILED token — no empty <file> block, no detail, no count
// bump, the claim REVOKED (a valid token of the same file, later in the SAME prompt, still injects), the
// token verbatim, and one hasUI-guarded warning notify (mirrors the read tool, which errors past EOF).
// Covers BOTH line-bearing paths (direct text + markdown), the clamped-END non-failure, the 0-byte edge,
// and the start==lineCount boundary. Spy ctx mirrors LINE-10; fixtures are inline w/ finally cleanup.
await runCase("LINE-11", "LR-4: #@five.txt:99 (5-line file) → no block, claim released, warning notify", async () => {
  const five = path.join(TMPDIR, "lr4_five.txt");            // inline, unique (no shared collision)
  fsSync.writeFileSync(five, "l1\nl2\nl3\nl4\nl5\n");          // exactly 5 lines (trailing \n ≠ extra line)
  const md = path.join(TMPDIR, "lr4.md");
  fsSync.writeFileSync(md, "m1\nm2\n");                        // 2-line markdown
  const spyCtx = (notes) => ({ cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } });
  try {
    // (a) Positive — text path: past-EOF start fails cleanly (the verified LR-4 gap, now closed).
    const notes = [];
    const r = await mod.injectFiles("See #@lr4_five.txt:99", [], spyCtx(notes));
    assert(r.injected === 0, `injected:0 (nothing delivered), got ${r.injected}`);
    assert(r.text === "See #@lr4_five.txt:99", `prompt verbatim, got ${JSON.stringify(r.text)}`);
    assert(r.blocks.length === 0 && r.details.length === 0, `NO block and NO detail (no empty body), got ${r.blocks.length}/${r.details.length}`);
    assert(notes.length === 1 && notes[0].t === "warning", `exactly one 'warning' notify, got ${JSON.stringify(notes)}`);
    assert(notes[0].m === `#@${five}:99 — not injected (file has 5 lines)`,
      `message = abs + canonical range + wc-l count (em dash), got ${JSON.stringify(notes[0].m)}`);

    // (b) Claim released — the VALID :1, later in the SAME prompt, still injects (scanTokens recorded
    //     both keys; the revoke lands inside injectFile before record 2 processes).
    const notes2 = [];
    const r2 = await mod.injectFiles("See #@lr4_five.txt:99 then #@lr4_five.txt:1", [], spyCtx(notes2));
    assert(r2.injected === 1, `:1 still injects after the failed :99 (claim released), got ${r2.injected}`);
    assert(hasBlock(r2, "l1\n"), "line 1 delivered");
    assert(notes2.length === 1 && notes2[0].m.includes(":99"), `still exactly the one :99 warning, got ${JSON.stringify(notes2)}`);

    // (c) Markdown path — a ranged markdown token past EOF fails the SAME way (injectFile guards before
    //     injectMarkdown runs; no empty block, no import scan on an empty body).
    const notes3 = [];
    const r3 = await mod.injectFiles("See #@lr4.md:3", [], spyCtx(notes3));
    assert(r3.injected === 0 && r3.blocks.length === 0, `markdown past-EOF: injected:0, no block, got ${r3.injected}/${r3.blocks.length}`);
    assert(notes3.length === 1 && notes3[0].m === `#@${md}:3 — not injected (file has 2 lines)`,
      `markdown notify (2 lines), got ${JSON.stringify(notes3[0]?.m)}`);

    // (d) Negative — a clamped END still DELIVERS (clamping is LR-5 recovery, NOT failure).
    const notes4 = [];
    const r4 = await mod.injectFiles("See #@lr4_five.txt:2-100000", [], spyCtx(notes4));
    assert(r4.injected === 1 && hasBlock(r4, "l2\nl3\nl4\nl5"), `:2-100000 clamps and DELIVERS lines 2-5`);
    assert(notes4.length === 0, `clamped end: NO notify, got ${notes4.length}`);

    // (e) Edge (§17.4/§17.8) — a 0-byte file has 0 lines, so :1 is past-EOF (countLines("") === 0).
    const notes5 = [];
    const r5 = await mod.injectFiles("See #@empty.txt:1", [], spyCtx(notes5));
    assert(r5.injected === 0 && r5.blocks.length === 0, `0-byte file :1 → no empty block, got ${r5.injected}/${r5.blocks.length}`);
    assert(notes5.length === 1 && notes5[0].m === `#@${EMPTY}:1 — not injected (file has 0 lines)`,
      `0-line notify, got ${JSON.stringify(notes5[0]?.m)}`);

    // (f) Boundary — startLine === lineCount is the LAST line: DELIVERS, does NOT fail (only > fails).
    const notes6 = [];
    const r6 = await mod.injectFiles("See #@lr4_five.txt:5", [], spyCtx(notes6));
    assert(r6.injected === 1 && hasBlock(r6, "l5\n"), `:5 (== lineCount) delivers line 5`);
    assert(notes6.length === 0, `boundary: NO notify, got ${notes6.length}`);
  } finally {
    fsSync.rmSync(five, { force: true });
    fsSync.rmSync(md, { force: true });
  }
});
```

### Implementation Tasks (ordered)

```yaml
Task 1: CONFIRM the landed baseline (the dependencies)
  - CMD: node file-injector.test.mjs 2>&1 | grep Result: → "Result: 177 passed, 0 failed." (LINE-10 present ⇒ T2.S2 LANDED).
  - CMD: grep -n 'invalidRange' file-injector.ts | head -3 → present (the LR-3 branch in processTokenStream).
  - CMD: grep -n 'injectMarkdown(abs, buf.toString' file-injector.ts → the markdown-branch anchor (Edit C).
  - If the baseline is not 177 green, STOP and report.

Task 2: WRITE THE FAILING TEST FIRST (TDD — item §4 "Failing test first")
  - Apply Edits F1-F4 (sanity + ASSERTED_EXPORTS + LINE-4 extension + LINE-11). countLines does not exist
    yet → the sanity assert throws at import → RED. (Optionally skip this run and go straight to Task 3;
    either way the gate must be RED-then-GREEN, never weakened.)

Task 3: ADD countLines (Edit A) — the exported wc-l helper with the 0-byte case + Mode A JSDoc.
Task 4: ADD turnAwayPastEof (Edit B) — the private shared turn-away (revoke + warning notify + false).
Task 5: GUARD the markdown branch (Edit C) and the text branch (Edit D) — hoist the decode, guard, pass through.
Task 6: APPEND the LR-4 paragraph to injectFile's JSDoc (Edit E — Mode A, item §5).
Task 7: VERIFY gates:
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 178 passed, 0 failed (LINE-11 ✓; LINE-4 ✓ w/ the new unit asserts;
    LINE-1/2/3/5/6/8/8-MD/9/10/12 ✓ — all prior behavior intact).
  - npm test → 4 files green.
  - git diff --stat → file-injector.ts + file-injector.test.mjs ONLY; the .ts hunks confined to countLines +
    turnAwayPastEof + injectFile's markdown/text branches + injectFile's JSDoc.
```

### Integration Points

```yaml
FILE EDITS (file-injector.ts):
  - add (after sliceLines ~L188): export countLines — pure, wc-l, 0-byte→0 (JSDoc Mode A).
  - add (before injectFile's JSDoc): private turnAwayPastEof — revoke + hasUI 'warning' notify + `: false` (JSDoc Mode A).
  - edit (injectFile markdown branch): hoist mdContent; `if (startLine !== undefined && startLine >
        countLines(mdContent)) return turnAwayPastEof(abs, key, state, ctx, startLine, endLine, countLines(mdContent))`
        — compute the count ONCE into `total`; then injectMarkdown(abs, mdContent, …).
  - edit (injectFile text branch): the same guard around the emitText call.
  - edit (injectFile JSDoc): + the LR-4 paragraph in the claim-semantics block.
  - preserve: emitText/emitWholeText (T1.*), injectMarkdown (untouched — guarded at its caller), the LR-3
        trio splitLineRange/scanTokens/processTokenStream (T2.S2), the F5/image/binary branches + the catch
        (T2.S1 — the revoke PRECEDENT), sliceLines/claimKey, the input handler, the renderer.

FILE EDITS (file-injector.test.mjs):
  - add: the countLines typeof sanity assert (after sliceLines ~L118) + "countLines" in ASSERTED_EXPORTS.
  - extend: LINE-4's unit block (+4 countLines asserts, in place).
  - add: LINE-11 (after LINE-10 ~L3160; the verbatim body above — inline spy ctx, inline fixtures w/ finally).

NO OTHER CHANGES:
  - No signature changes anywhere (injectFile/emitText/injectMarkdown keep their exact signatures).
  - No new module-scope fixtures (LINE-11's lr4_five.txt/lr4.md are in-body w/ finally cleanup).
  - No README change (P1.M2.T2.S1 owns the failure-feedback wording). No PRD change (read-only).
```

## Validation Loop

### Level 1: Typecheck

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: 0 errors. The edits are an additive pure helper, a private helper, and two guards.
# If tsc errors on turnAwayPastEof's literal `: false` return annotation, drop the literal (plain boolean).
```

### Level 2: The main suite (LINE-11 added; LINE-4 extended; ALL prior green)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: "Result: 178 passed, 0 failed."
# Spot-check: LINE-4 ✓ (incl. the 4 countLines asserts); LINE-11 ✓ (all 6 sub-cases); LINE-10 ✓ (LR-3
#   untouched); LINE-9 ✓ (image/binary branches untouched); LINE-8/8-MD ✓ (LR-1 paged slices unaffected —
#   their starts are ≤ count); LINE-12 ✓ (:2-100000 clamps + delivers — the guard must NOT fire on the END).
#
# If LINE-11 (a) fails with a BLOCK present: the guard didn't run — check Edit D landed in the TEXT branch
#   (not somewhere else) and that it returns BEFORE emitText.
# If LINE-11 (b) fails (injected !== 1): the revoke didn't land — turnAwayPastEof must delete `key`.
# If LINE-11 (d) fails (no delivery): you failed on the END too — the guard tests ONLY startLine (>).
# If LINE-11 (f) fails: off-by-one — the predicate is `startLine > total`, not `>=`.
# If LINE-11 (e) fails with "(file has 1 lines)": countLines lacks the 0-byte case (Edit A's first line).
# If the suite dies BEFORE any case ("module ships functions not in the sanity list: countLines"):
#   F2 (ASSERTED_EXPORTS) didn't land.
# If ANY prior LINE case flips: you guarded something you shouldn't have (e.g. hoisted the check above the
#   cascade — breaking LINE-9 — or touched emitText). Diff against the Blueprint.
```

### Level 3: The full 4-file gate

```bash
cd /home/dustin/projects/pi-file-injector
npm test   # file-injector && import-behavior && relative-imports && url-injection — all green
# import-behavior/relative-imports/url-injection do not exercise past-EOF ranges; they must be unchanged.
```

### Level 4: Scope verification (the hunk boundary vs BOTH landed siblings)

```bash
cd /home/dustin/projects/pi-file-injector
git diff --stat        # expect: file-injector.ts, file-injector.test.mjs ONLY
# Inspect the .ts hunks: ALL must be in (1) the new countLines after sliceLines, (2) the new turnAwayPastEof,
#   (3) injectFile's markdown branch, (4) injectFile's text branch, (5) injectFile's JSDoc.
# MUST NOT appear: emitText/emitWholeText bodies, injectMarkdown, scanTokens/processTokenStream/
#   splitLineRange (T2.S2's landed LR-3), the F5/image/binary branches or the catch (T2.S1's landed LR-2 —
#   the catch is the PATTERN you copied, not a site you edited).
```

## Final Validation Checklist

### Technical Validation
- [ ] `npm run typecheck` → 0 errors.
- [ ] `node ./file-injector.test.mjs` → 178 passed, 0 failed.
- [ ] `npm test` → 4 files green.
- [ ] `git diff --stat` → file-injector.ts + file-injector.test.mjs only; hunks confined to the 5 sanctioned sites.

### Feature Validation (LR-4)
- [ ] `#@lr4_five.txt:99` (5-line) → injected:0, verbatim, `blocks.length===0 && details.length===0`, ONE
      warning notify `` `#@${five}:99 — not injected (file has 5 lines)` ``.
- [ ] Claim release: `:99 then :1` in one prompt → injected:1 (line 1 delivered), one notify.
- [ ] Markdown path: `#@lr4.md:3` (2-line md) → fails identically (`file has 2 lines`).
- [ ] Clamped END delivers (`:2-100000` → lines 2-5, NO notify); boundary `:5` delivers line 5.
- [ ] 0-byte: `#@empty.txt:1` → fails with `(file has 0 lines)`.
- [ ] countLines unit pins: ""→0, "a"→1, "a\n"→1, 5-line→5.
- [ ] Images/binaries with past-EOF ranges unaffected (LINE-9 green — LR-2 ignores their ranges).

### Scope Discipline
- [ ] emitText / emitWholeText / injectMarkdown / scanTokens / processTokenStream / splitLineRange UNTOUCHED.
- [ ] injectFile's F5/image/binary branches + the catch UNTOUCHED (T2.S1's; the catch is the copied precedent).
- [ ] No signature changes; countLines registered in the sanity list + ASSERTED_EXPORTS.
- [ ] turnAwayPastEof deletes ONLY `key` (never the bare abs).

### Documentation
- [ ] countLines JSDoc: wc-l semantics, the 0-byte special case, its LR-4 consumer, purity (Mode A, item §5).
- [ ] turnAwayPastEof JSDoc: the empty-slice-⟹-failed-token contract, the read-tool mirror, the abs+canonical-range
      notify rationale (Mode A, item §5).
- [ ] injectFile JSDoc claim-semantics block: the LR-4 paragraph appended (Mode A, item §5).
- [ ] The stale "NO markdown branch yet" JSDoc line left alone (out of scope — noted, not fixed).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT use slice-emptiness as the failure predicate.** `sliceLines("a\n\nb", 2, 2) === ""` is a
  LEGITIMATE empty-line delivery. Only `startLine > countLines(content)` distinguishes past-EOF. An
  emit-side `if (content === "") return` (the item's option (a) done naively) false-fails empty lines.
- ❌ **Do NOT let countLines return 1 for a 0-byte file.** `"".split("\n")` is `[""]`; the explicit
  `if (content.length === 0) return 0;` is spec-mandated (`#@empty.txt:1` must fail with "0 lines").
- ❌ **Do NOT fail on the END.** `:2-100000` on a 5-line file DELIVERS (LR-5 clamping is recovery). The
  guard tests ONLY `startLine > total` — and `startLine === total` (the last line) DELIVERS too.
- ❌ **Do NOT hoist the guard above injectFile's classify cascade.** Images/binaries ignore ranges (LR-2);
  classification order is load-bearing (fake.png falls through the magic sniff to text/binary). The guard
  lives in the markdown + text branches ONLY — hoisting breaks LINE-9.
- ❌ **Do NOT thread the typed token into injectFile** to make the notify "as typed". Its signature is
  EXPORTED and unit-tested; the resolved abs + canonical range is the decided, unambiguous form. LINE-11
  pins the abs-based string — do not "improve" it into a signature change.
- ❌ **Do NOT use notify type 'info'** (the L956 SPA notify is a shape reference, not a type reference).
  LR-4 is `"warning"` (§6; LINE-11 asserts `t === "warning"`).
- ❌ **Do NOT delete the bare `abs` in turnAwayPastEof.** The text/markdown branches never add it for ranged
  tokens (that's LR-2's image/binary normalization); deleting it would wrongly release an earlier
  whole-file claim of the same file.
- ❌ **Do NOT touch emitText, emitWholeText, injectMarkdown, scanTokens, processTokenStream, splitLineRange,
  the F5/image/binary branches, or the catch.** They are T1.*/T2.S1/T2.S2's landed work. The catch is the
  PATTERN you copy — not an edit site.
- ❌ **Do NOT forget the ASSERTED_EXPORTS registration.** The surface-sync check (test L150-156) fails the
  whole import ("module ships functions not in the sanity list: countLines") before any case runs.
- ❌ **Do NOT weaken LINE-11 to force green.** Every sub-case is load-bearing: (b) proves the claim-release
  ordering; (d) proves clamping survives; (f) proves no off-by-one; (e) proves the 0-byte semantics.
- ❌ **Do NOT skip Level 4.** Both siblings share file-injector.ts and are LANDED; the hunk-scope check is
  what proves S3 didn't collide with them.

---

## Confidence Score: 9/10

Two guarded branches + two small helpers + one test, all traced to quoted live code at the 177-green
baseline (S2's LR-3 LANDED in tree, verified). The PRP resolves the item's open seam decision with a
proven correctness argument (the slice-emptiness false-failure trap → the lineCount predicate), pins the
second trap (the 0-byte countLines case, spec-mandated 0 vs the naive 1), gives the exact notify-message
form with its rationale (abs + canonical range; threading the typed token forbidden), traces the
claim-release ordering record-by-record (scanTokens' claim-key dedup → synchronous revoke → belt-check
tolerance), and writes LINE-11 verbatim in the landed LINE-10's exact test idiom (inline spy ctx, inline
fixtures with finally). The surface-sync mechanism (ASSERTED_EXPORTS) that would otherwise fail the import
is pinned. The -1 reserves for: (a) line-number drift from the two landed siblings (mitigated by
quoted-text anchors + the Level-4 hunk check), and (b) the em-dash/≥ message-string exactness (mitigated by
the verbatim template literals in both the source edit and the test assert). Gates: typecheck 0 errors,
main suite **178 passed**, npm test 4-file green.