# Research Notes — P1.M1.T1.S2: Extract scanTokens / processTokenStream / injectFile / emitText

> First-hand analysis of the committed `file-injector.ts` (467 lines, baseline), the T1.S1 PRP
> (contract for the POST-T1.S1 starting state), `architecture/codebase_insertion_points.md` §MI-1,
> `architecture/system_context.md`, `file-injector.test.mjs` (sanity list L113–121), and PRD §9.
> Baseline gate confirmed: **`52 passed, 0 failed.`**

---

## 1. Starting state = POST-T1.S1 (this subtask runs AFTER T1.S1 lands)

T1.S1 (parallel, in flight) delivers `injectFiles` restructured around ONE shared `const state: State`:
- `interface State { blocks; images; injectedSet; remaining; count; paged }` exists (PRD §9 shape).
- `function subtract(state, cost)` exists (`if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost)`).
- `injectFiles` allocates ONE `state`, computes budget into `state.remaining`, seeds `state.injectedSet`
  with `priorPaths` (every `<file name="…">` in text), and the **linear `for (const m of text.matchAll(FILE_INJECT_RE))`
  loop is STILL INLINE** — using `state.*` everywhere, with `const injectedIndexes: number[]` local.
- Exactly TWO `subtract()` calls exist (inline-whole `fileCost`, paged-head `ceil(HEAD_CHARS/4)`); the
  sub-head-guard branch mutates nothing. Image/binary/empty-image do NOT subtract (that's T2.S2).
- `count===0` early return uses the **ORIGINAL `imagesIn` ref** (not `state.images`); final return uses `state.images`.

T1.S2 consumes that exact state and **replaces the linear loop** with `processTokenStream(...)`. No new
behavior; internals become recursion-ready.

---

## 2. THE KEY EQUIVALENCE: scan-then-inject == linear loop (top level)

This is the proof that T1.S2 stays byte-for-byte. The linear loop (T1.S1) does dedup+stat+read per
iteration **inline**; T1.S2 splits it into scan (scanTokens) → inject (injectFile via processTokenStream).

**scanTokens** records the FIRST occurrence of each resolved abs (per-text `localSeen` + global
`state.injectedSet` check), WITHOUT stat/read. **processTokenStream** then calls `injectFile` per record
(re-checking `state.injectedSet.has(abs)` — belt-and-suspenders for cross-subtree dedup once markdown
recurses in T2; a **no-op at top level** because localSeen already made each abs unique in `records`).

Equivalence cases (A,B = two top-level tokens resolving to abs_A, abs_B):

| Scenario | Linear (T1.S1) | Scan-then-inject (T1.S2) | Same? |
|---|---|---|---|
| A injects, B = same abs (repeat) | A: inject; B: `injectedSet.has`→skip | A recorded; B: `localSeen.has`→not recorded | ✓ only A's index stripped |
| A injects, B = different abs | both inject | both recorded, both inject | ✓ |
| A missing (stat throws), B = same abs | both stat-throw→continue; neither claimed | A recorded; B `localSeen`-skipped; A `injectFile`→stat throws→false; B absent | ✓ neither injects |
| A is dir (!isFile), B = same abs | both !isFile→continue | A recorded; B skipped; A `injectFile`→!isFile→false | ✓ |
| A read throws, B = same abs | A: stat ok, read throws→catch continue (NOT claimed); B: same | A recorded; B skipped; A `injectFile`: stat ok→CLAIM→read throws→false; B absent | ✓ neither injects (see §3 for the claim-timing nuance) |
| A in priorPaths (prior `<file>` block) | `injectedSet.has`→skip | scanTokens `state.injectedSet.has`→not recorded | ✓ verbatim |

**Why localSeen-in-scan ≡ injectedSet-at-success for observable output:** if A fails (missing/dir/read),
B (same abs) would fail identically (deterministic FS), so whether B is pre-skipped by `localSeen` or
fails again at `injectFile`, the outcome is identical (both verbatim, neither injected). If A succeeds,
B is correctly deduped in both models. **No test can distinguish** "first fails, second succeeds" — that
is not how files work. ∴ scan-then-inject is byte-for-byte equivalent at the top level.

**Block order is preserved:** `matchAll` yields matches in text order; scanTokens pushes records in that
order; processTokenStream iterates records in that order; injectFile pushes blocks in call order. Same
pre-order as the linear loop. ✓

**`m.index` correctness:** FILE_INJECT_RE group 1 `(^|(?<![\p{L}\p{N}_]))` is zero-width → `m.index` is
the index of `#`. scanTokens records `m.index`; processTokenStream returns it; injectFiles strips 2 chars
there (drops `#@`). Identical to the current index-based strip. ✓

---

## 3. EARLY-CLAIM in injectFile is behavior-neutral (but recursion-readying) — DELIBERATE

T1.S1 claims abs at the SUCCESS site (after read+classify succeed, inside try). The item description +
PRD §9 require T1.S2's `injectFile` to claim **after stat+isFile succeed, BEFORE read**:
```
try { st = await fs.stat(abs); } catch { return false; }
if (!st.isFile()) return false;
state.injectedSet.add(abs);   // CLAIM — before read
try { const buf = await fs.readFile(abs); ...classify...; state.count++; return true; }
catch { return false; }
```
**Behavior-neutral at top level** (proven in §2): a failed read still claims abs, but `localSeen`
guarantees `injectFile` is called at most once per abs per top-level run, and `state` is discarded after
`injectFiles` returns — so the claimed-but-failed abs never affects observable output. **Essential for
recursion-readiness (T2):** when `injectFile` recurses via `injectMarkdown`, claiming before read
prevents re-entry into the same file mid-subtree (self-import → verbatim). The implementer must NOT move
the claim back to the success site (that would break T2's cycle termination). No existing test asserts
`injectedSet` contents (it is internal), so early-claim cannot flip any case.

---

## 4. injectFile classification — preserve F3/F5 (item description OVERRIDES PRD §9 pseudocode order)

PRD §9's injectFile pseudocode shows a simpler `if (mime) { image } else if (MD_EXTS) { md } ...` cascade
WITHOUT the F5 empty-image or F3 magic gates inline. But the **shipped** code (plan 001/002) HAS F5 + F3,
and the **item description explicitly requires preserving them**:
> "CLASSIFY IN THIS ORDER (preserve F3/F5): (1) image ext && buf.length===0 → formatEmptyImageBlock;
>  (2) image ext && hasValidImageMagic(buf,mime) → image; (3) isBinary → binary; (4) else → emitText."

∴ injectFile's cascade = (1) F5 → (2) F3 image → (3) binary → (4) emitText, as an else-if chain. This is
provably equivalent to the current `if(F5){continue} isRealImage=...; if(mime&&isRealImage){image}else{text/binary}`
structure: F5 short-circuits before `hasValidImageMagic` in both; a mislabeled image-ext (`mime && !magic`)
falls to binary/text in both. **NO markdown branch** (item: "NO markdown branch yet" — that's T2.S3).

**Budget in injectFile:** ONLY emitText subtracts (text whole/head). Image/binary/empty-image do NOT call
`subtract` in T1.S2 (T2.S2 wires those). Preserves byte-for-byte budget behavior.

**injectFile has NO access to `m.index`** (it receives `abs` only) → it cannot push the strip index.
processTokenStream pushes `r.index` after `injectFile` returns `true`. Net per-file effect identical to
T1.S1's success site (claim + block + count++ + index), just split across two functions.

---

## 5. emitText = VERBATIM lift of the current text decision (POST-T1.S1 subtract calls)

`emitText(abs, content, state)` (no ctx — pure text decision, no I/O, no recursion) is the current inline
text branch lifted verbatim, including the two `subtract()` calls T1.S1 added and the sub-head guard that
mutates nothing:
- whole if `state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining` → push whole block + `subtract(state, fileCost)`.
- else: `head = headSlice(content)`; if `content.length <= HEAD_CHARS` → push whole, NO subtract (sub-head guard, FINDING 2);
  else push head block + `formatPagedDirectiveBlock(...)` + `state.paged++` + `subtract(state, Math.ceil(HEAD_CHARS/4))`.
emitText does NOT bump `count` (injectFile bumps count once per file, whole or paged). Identical math → identical PD/PN test outcomes.

---

## 6. scanTokens `skipCode` STUB (do NOT implement computeCodeRanges/inCode — that's T2.S1)

scanTokens accepts `opts.skipCode` for recursion-readiness (T2 markdown passes `skipCode:true`), but in
T1.S2 the top-level call is `{ skipCode: false }` and `computeCodeRanges`/`inCode` do NOT exist yet
(T2.S1). **Do NOT reference `inCode`/`computeCodeRanges` in T1.S2's scanTokens** — jiti would error on the
undefined identifier even though the `codeRanges && inCode(...)` short-circuits at runtime. Instead, leave
a **comment placeholder** describing exactly what T2.S1 adds, and omit the code check entirely (codeRanges
is implicitly null). T2.S1 then:
1. implements `computeCodeRanges` + `inCode`;
2. changes scanTokens to `const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;` and adds
   `if (codeRanges && inCode(m.index!, codeRanges)) continue;` inside the loop.

---

## 7. isAbsoluteOrTilde — CREATED HERE (owned by T1.S2, reused by T2.S1)

scanTokens references `isAbsoluteOrTilde(token)` (gated by `!opts.allowAbsTilde`). It does not exist yet.
`codebase_insertion_points.md` lists it under MI-2 helpers, but scanTokens NEEDS it now, so **T1.S2 owns
its creation**. It is a pure one-liner: `p.startsWith("/") || p.startsWith("~")`. **T2.S1 must NOT
re-declare it** — reuse this export. (At top level `opts.allowAbsTilde === true`, so the check never
fires; it becomes load-bearing in T2 markdown scanning with `allowAbsTilde:false`.)

---

## 8. Export decision + the ONE permitted test-harness edit

Item: "Export scanTokens/emitText/injectFile as needed by tests; update the module-surface sanity list
in file-injector.test.mjs (~L113-121) ONLY for helpers you actually export."

Decision: **export `scanTokens`, `injectFile`, `emitText`, `isAbsoluteOrTilde`** (the four named/needed
helpers); keep `processTokenStream` + `subtract` **private** (orchestrator + budget helper, exercised
indirectly via injectFiles). Then **append 4 asserts** to the sanity list (after the `hasValidImageMagic`
assert, currently line 121) — the ONLY permitted edit to `file-injector.test.mjs`:
```js
assert(typeof mod.scanTokens === "function", "mod.scanTokens must be a function (scan-only, recursion-ready)");
assert(typeof mod.injectFile === "function", "mod.injectFile must be a function (stat→claim→classify→count)");
assert(typeof mod.emitText === "function", "mod.emitText must be a function (inline-vs-paged text decision)");
assert(typeof mod.isAbsoluteOrTilde === "function", "mod.isAbsoluteOrTilde must be a function (§4.5 markdown relative-only guard)");
```
The sanity list is a STATIC 9-assert block (it does NOT iterate `Object.keys(mod)`), so exporting without
appending would still pass the gate — but appending keeps the "prove we loaded the real file" check
meaningful and matches the item's explicit instruction. Append-only = low risk.

---

## 9. POST-T1.S2 injectFiles = thin wrapper

```ts
export async function injectFiles(text, imagesIn, ctx) {
  // budget computation — UNCHANGED from T1.S1 (try/catch; undefined/null→null O-1 fallback)
  let remaining; try { const usage = ctx.getContextUsage?.(); remaining = (usage===undefined||usage.tokens===null) ? null : Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN); } catch { remaining = null; }
  const priorPaths = new Set(); for (const m of text.matchAll(/<file name="([^"]+)">/g)) priorPaths.add(m[1]);
  const state: State = { blocks: [], images: [...imagesIn], injectedSet: priorPaths, remaining, count: 0, paged: 0 };
  const resolvedIdx = await processTokenStream(text, ctx.cwd, { allowAbsTilde: true, skipCode: false }, state, ctx);
  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL imagesIn ref
  let strippedText = text;
  for (const i of [...resolvedIdx].sort((a, b) => b - a)) strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
  const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`;
  return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
}
```
- Budget math + priorPaths seeding + State initializer: **UNCHANGED from T1.S1**.
- The linear loop + local `injectedIndexes` are REPLACED by `processTokenStream(...)` → `resolvedIdx`.
- `count===0` early return still uses ORIGINAL `imagesIn`; final return uses `state.images`. (Critical: test case 5 / any injected===0 path asserts `imagesIn` identity.)

---

## 10. OUT OF SCOPE (owned by T2) — do NOT create in T1.S2

- `MD_EXTS`, `INLINE_CODE_RE`, `FENCE_OPEN_RE`, `IMAGE_FALLBACK_TOKENS` constants → T2.S1.
- `computeCodeRanges`, `inCode`, `estimateImageTokens` helpers → T2.S1.
- `injectMarkdown` recursion driver + the markdown branch in injectFile → T2.S3.
- `subtract` calls for image/binary/empty-image → T2.S2 (T1.S2 keeps budget TEXT-ONLY).
- README changes → T3.S1.

---

## 11. Confidence: 9/10

Tightly-scoped structural refactor (linear loop → 4 module-level helpers) with a complete equivalence
proof (§2), a verbatim emitText lift (§5), a deliberate early-claim note (§3), and one authoritative green
gate (`52 passed, 0 failed`). The -1 reserves for: (a) the one test-harness sanity-list append (low risk,
but it IS an edit to the gate file), and (b) the `ctx` typing choice across 3 functions (jiti doesn't
type-check, so any reasonable shape compiles, but a shared `type Ctx` alias is cleanest).
