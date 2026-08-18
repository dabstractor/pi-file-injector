---
name: "P1.M1.T1.S2 (plan/011) — LR-5: clamp the displayed range to the delivered range"
prd_ref: "PRD §17.6 LR-5 (display shows what was delivered — clamped range), §17.4 (end past EOF clamps to the file's last line), §17.9 (gate LINE-12: `:2-100000` → details[0].range === ':2-5'), §17.10 (LR-5 registered as a gap); §6.3 (the read-line range slot shows the delivered range)"
target_file: "./file-injector.ts"   # 1 semantic edit (the rangeSuffix computation) + 3 Mode-A comment touches
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + 3 suites green)
depends_on: "P1.M1.T1.S1 (FULLY LANDED: the range branch runs the full §5.5 decision — inline / sub-head guard / paged with file-coordinate resume; LINE-8/LINE-8-MD green; baseline 174). S1 left the rangeSuffix built from the REQUESTED end and marked the gap: `// the REQUESTED range (LR-5 clamping is S2)`."
consumed_by: "P1.M1.T1.S3 (unify the emit quadruple + rewrite the emitText JSDoc — consumes the clamped rangeSuffix); P1.M2.T1.S2 (formalizes LINE-12 alongside LINE-8/LINE-11); P1.M2.T2.S1 (README clamped-display note)"
---

# PRP — P1.M1.T1.S2: LR-5 — clamp the displayed range to the delivered range

> **Scope flag:** This closes the **LR-5 gap** (PRD §17.6): the whole-slice detail's `range` (and the collapsed
> `read <path>:N-M` line) shows the **REQUESTED** range even when `end` clamped past EOF — `#@a.ts:2-100000` on
> a 5-line file delivers lines 2–5 but displays `read a.ts:2-100000`. The fix: build `rangeSuffix` from the
> **DELIVERED** range (`startLine + newlines-in-slice`). One semantic line + 3 Mode-A comment touches + 1 TDD
> test (LINE-12, RED first). **In-file ranges are byte-identical** → LINE-1…6 stay green by construction. The
> paged path's `:${resumeLine}-` display is UNTOUCHED. Scope = S2 ONLY (S3 owns the JSDoc/quadruple; T2 owns
> LR-2/3/4; M2 owns the formal gates).

---

## Goal

**Feature Goal:** Make `FileDetail.range` (and the collapsed read line) show the **delivered** (clamped) range on
the whole-slice paths: `#@a.ts:2-100000` on a 5-line file → delivered lines 2–5 → `range === ":2-5"` (display and
delivery agree, PRD §17.6/LR-5). The clamping is computed free from the already-sliced content: the slice joins
L lines with L−1 newlines, so `deliveredEnd = startLine + (slice.match(/\n/g)?.length ?? 0)`. Canonical form
(LR-7, pinned): a single delivered line → `:N` (never `:N-N`).

**Deliverable:** Modified `file-injector.ts` — the `rangeSuffix` computation (1 line → 5 with the LR-5 comment)
+ 2 inline-comment touches (the inline arm's `// the REQUESTED range (LR-5 clamping is S2)` marker; the paged
arm's "NOT rangeSuffix" comment) + the `FileDetail.range` field comment. Modified `file-injector.test.mjs` —
+`runCase("LINE-12", …)` after LINE-8-MD (TDD, RED first; formalized in P1.M2.T1.S2). 174 → 175.

**Success Definition:**
1. TDD: LINE-12 is RED on the current (POST-S1) code (`range === ":2-100000"`), GREEN after (`":2-5"`).
2. `node ./file-injector.test.mjs` → **175 passed** (174 + LINE-12), incl. LINE-1…6 and LINE-8/LINE-8-MD unchanged.
3. `relative-imports` 38 + `import-behavior` 23 unchanged; `npm run typecheck` → 0 errors.
4. The paged path's `range: \`:${resumeLine}-\`` is byte-for-byte unchanged (LINE-8 stays green).

## Why

- **Honest display (PRD §17.6).** "Showing the requested-but-undelivered range misleads both user and model."
  The user types `:2-100000`, gets lines 2–5, and the collapsed line says `read a.ts:2-100000` — the model
  believes it holds 99,999 lines it does not. LR-5 is normative: display and delivery must agree.
- **The clamp is free.** `sliceLines` already clamps the delivered content (`parts.slice(start-1, end)`); the
  delivered end line is recoverable exactly from the slice: L delivered lines → L−1 internal newlines (verified
  against `sliceLines`' join semantics). No re-read, no re-split of the original.
- **In-file ranges are unaffected.** A range whose `end` is within the file never clamps → `deliveredEnd === end`
  → the suffix string is identical → LINE-1…6 (which use `:3`, `:2-3`) stay green by construction.

## What

### User-visible behavior

- A ranged token whose `end` passes EOF now displays the delivered range: `read a.ts:2-5` (was `read a.ts:2-100000`).
- In-file ranges display exactly as before (`:3`, `:2-3`).
- Paged slices still display the resume directive (`read huge.log:<resumeLine>-`) — unchanged.
- The prompt stays verbatim (`#@a.ts:2-100000` unstripped) — unchanged.

### Technical behavior (the contract)

- In `emitText`'s range branch, AFTER `content = sliceLines(content, startLine, end)`, compute
  `deliveredEnd = startLine + (content.match(/\n/g)?.length ?? 0)` and build
  `rangeSuffix = startLine === deliveredEnd ? \`:${startLine}\` : \`:${startLine}-${deliveredEnd}\``.
- `rangeSuffix` feeds ONLY the two whole-slice detail pushes (inline + sub-head arms) — the paged arm keeps
  `range: \`:${resumeLine}-\`` (the resume directive, NOT a range display).
- `end` REMAINS used by the `sliceLines` call — only the rangeSuffix source changes.

### Success Criteria

- [ ] The rangeSuffix computation uses `deliveredEnd` (not the requested `end`), with the LR-5 comment.
- [ ] `#@lr5_five.txt:2-100000` (5-line file) → `details[0].range === ":2-5"`, `kind === "text"`, `lines === 4`, body = lines 2–5.
- [ ] Canonical form preserved: a single delivered line → `:N` (LINE-1 `:3` green).
- [ ] In-file ranges byte-identical (LINE-1…6 green unchanged).
- [ ] The paged arm byte-for-byte unchanged (LINE-8/LINE-8-MD green; `:${resumeLine}-` display intact).
- [ ] Comments updated (Mode A): the `// the REQUESTED range…` marker → delivered; the paged "NOT rangeSuffix" comment; the `FileDetail.range` field comment.
- [ ] `npm run typecheck` → 0 errors; suites: 175 + 38 + 23.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim POST-S1 range branch (S1 is LANDED — verified in the tree; its inline marker names this subtask), the
exact oldText→newText for all 4 edits, the `sliceLines` join-semantics proof that makes the `deliveredEnd`
formula exact, the full behavior trace table (every affected path: in-file, clamped, canonical, paged, empty),
the LINE-12 test spec (verbatim, RED→GREEN), and the S3/T2/M2 scope boundaries. One semantic line + comments + one test.

### Documentation & References

```yaml
# MUST READ — the LR-5 contract + the LINE-12 gate definition
- file: PRD.md
  why: "§17.6 LR-5 (normative: 'FileDetail.range and the collapsed read line show the CLAMPED range —
        read a.ts:2-5 for #@a.ts:2-100000 on a 5-line file (display and delivery agree)'); §17.4 (end past EOF
        clamps to the file's last line); §17.9 (the gate: LINE-12 | LR-5 | :2-100000 → details[0].range === \":2-5\");
        §17.10 (LR-5 registered as a verified gap); §6.3 (the read-line range slot: 'clamped to what was
        actually delivered, so display and delivery agree')."
  section: "## 6. Failure feedback & honest display — LR-5 + ## 4. Slicing semantics + ## 9. Acceptance tests + §6.3"
  critical: "§17.4: 'end past EOF clamps to the file's last line (:2-100000 on a 5-line file → lines 2–5)' —
             the DELIVERY already clamps (sliceLines); LR-5 fixes only the DISPLAY. A clamped end is recovery,
             not failure (still delivers) — unlike a past-EOF START (LR-4, T2.S3)."

# MUST READ — the S1 contract (the POST-S1 range branch S2 consumes + the S2 marker)
- file: plan/011_e473dac8178b/P1M1T1S1/PRP.md
  why: "S1 (LANDED) rewrote the range branch into the full §5.5 decision and explicitly preserved the gap:
        'The whole-slice detail keeps range: rangeSuffix (the REQUESTED range — LR-5 clamping is S2, not here)'
        and its anti-pattern 'Do NOT clamp or rewrite rangeSuffix … clamping to the delivered range is LR-5 (S2)'.
        S1 also pinned the S3 boundary (no JSDoc rewrite, no quadruple unification)."
  critical: "S2 now DOES clamp rangeSuffix — that is precisely the handoff. Everything else in the branch
             (the decision structure, the paged arm, subtract, state.paged) is S1's contract and stays UNTOUCHED."

# MUST READ — the line-level map (rangeSuffix at the gap site; the paged arm's range)
- file: plan/011_e473dac8178b/architecture/code_map.md
  why: "§emitText maps the range branch incl. 'rangeSuffix is built from the REQUESTED startLine/endLine, so
        :2-100000 on a 5-line file displays read a.ts:2-100000 while delivering lines 2–5. Clamping detection
        is free from the slice: delivered last line = startLine + (newlines in slice)'. Pins every helper."
  critical: "The item's formula is the code_map's. sliceLines (L183-189) joins parts with \\n and pops the
             trailing empty — L delivered lines → exactly L−1 newlines → the formula is exact."

# The file you edit (1 semantic line + 3 comments)
- file: file-injector.ts
  why: "emitText L1292-1333 (POST-S1, verified): the range branch. The edit site is the rangeSuffix line
        (~L1312, `rangeSuffix = startLine === end ? …`) — S1's inline-arm marker comment names S2. The two
        whole-slice detail pushes consume rangeSuffix; the paged push uses `:${resumeLine}-`. FileDetail.range
        field comment at L536. sliceLines L183-189 (join semantics)."
  pattern: "One local (`deliveredEnd`) computed from the ALREADY-SLICED content, feeding the SAME rangeSuffix
            variable → both whole-slice arms pick it up with zero structural change."
  gotcha: "Do NOT derive deliveredEnd from the detail's `lineCount` (lineCount is 0 for an empty slice →
           start−1 ≠ the correct start+0). Use the direct newlines formula. And do NOT touch the `end` local
           (the sliceLines call still needs the requested end)."

# The gate you also edit (+LINE-12)
- file: file-injector.test.mjs
  why: "174 baseline. LINE-1…6 at L2978-3050 (in-file ranges :3 / :2-3 — unchanged expectations); LINE-8 +
        LINE-8-MD at L3051-3090 (the S1 TDD tests — the paged display `:${resumeLine}-`). Insert LINE-12 after
        LINE-8-MD. runCase/assert/hasBlock/FIX/TMPDIR helpers as in LINE-1."
  pattern: "LINE-1's body is the template: injectFiles under FIX (no budget → the inline whole-slice arm),
            assert injected/verbatim/kind/range/lines + block-body content via hasBlock."
  gotcha: "Write the test with the name 'LINE-12' NOW (the S1/LINE-8 precedent: TDD RED-first; it is formalized
           in P1.M2.T1.S2). Use a UNIQUE inline fixture (lr5_five.txt) — do not clobber shared fixtures."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (the rangeSuffix computation + 3 Mode-A comments; nothing else)
├── file-injector.test.mjs    # ← EDITED (+runCase("LINE-12", …) after LINE-8-MD; 174 → 175)
├── relative-imports.test.mjs # run to confirm green (NOT edited)
├── import-behavior.test.mjs  # run to confirm green (NOT edited)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/011_e473dac8178b/
    ├── architecture/{code_map.md, system_context.md, external_deps.md}
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (LANDED): the §5.5-on-slice decision (LR-1)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — the rangeSuffix line → deliveredEnd computation (+LR-5 comment);
                          #                  the inline-arm + paged-arm inline comments; FileDetail.range comment.
file-injector.test.mjs    # MODIFIED — +runCase("LINE-12", …) after LINE-8-MD (RED-first TDD).
# No other files. No new exports. No new imports. No interface changes.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — the formula is exact BECAUSE sliceLines joins with "\n" and pops the trailing empty part:
//   L delivered lines → exactly L−1 internal newlines in the slice → deliveredEnd = startLine + newlines.
//   Do NOT derive deliveredEnd from `lineCount` (the detail's lines field): lineCount is 0 for an EMPTY slice,
//   and start + lineCount − 1 would give start−1 (wrong; the direct formula gives start+0 = start → `:N`).
//   The empty-slice case (past-EOF start) is LR-4's territory (T2.S3) — S2 does not change it (today it also
//   displays `:N`; after S2 it still displays `:N`).

// CRITICAL — `end` (the requested end) REMAINS used: `content = sliceLines(content, startLine, end)`.
//   Only the rangeSuffix SOURCE changes (requested end → deliveredEnd). Do not delete the `end` local.

// CRITICAL — the paged arm is UNTOUCHED. Its `range: `:${resumeLine}-`` is the resume directive (where the
//   model's read continues), NOT a delivered-range display — LINE-8 gates it and must stay green. Only its
//   trailing comment ("NOT rangeSuffix (the requested range)") gets the Mode-A touch since rangeSuffix is no
//   longer "the requested range".

// CRITICAL — in-file ranges are byte-identical BY CONSTRUCTION: when end ≤ file lines, deliveredEnd === end →
//   the same suffix string → LINE-1 (:3), LINE-2 (:2-3), LINE-5/6 stay green without modification. Run them to
//   confirm (the item: "Existing LINE-1…6 fixtures use in-file ranges (:3, :2-3) so their expectations are
//   unchanged — run them to confirm").

// GOTCHA — canonical form (LR-7): `startLine === deliveredEnd` ⟺ the slice has 0 newlines ⟺ exactly one line
//   delivered → `:N` (never `:N-N`). This also covers `:4-100000` on a 4-line file → delivers line 4 only → `:4`.

// GOTCHA — do NOT rewrite the emitText JSDoc (L1292-1298) or unify the cost/lines/push/subtract quadruple —
//   both are S3 (the task tree splits the PRD §17.10 code-quality note there). S2 touches ONLY the rangeSuffix
//   line + the range-describing comments.

// GOTCHA — do NOT add LR-4 behavior (past-EOF start → failed token/notify) — that's T2.S3. S2's formula leaves
//   the empty-slice display exactly as today (`:N`), so LR-4's later change is unperturbed.

// LIBRARY — String.prototype.match(/\n/g)?.length ?? 0 is the existing idiom (the lineCount line right below
//   uses it). No new imports. No signature changes (emitText / FileDetail shapes unchanged).
```

## Implementation Blueprint

### The 4 edits (POST-S1 oldText → POST-S2 newText; identifier-based — line numbers drift)

**Edit 1 — the rangeSuffix computation (THE semantic change):**
```ts
// oldText (inside emitText's range branch, right after content = sliceLines(...)):
    rangeSuffix = startLine === end ? `:${startLine}` : `:${startLine}-${end}`; // UI: read path:N / path:N-M
// newText:
    // LR-5 (PRD §17.6) — the DISPLAYED range is the DELIVERED (clamped) range, not the requested one:
    // sliceLines joins L lines with L−1 newlines, so the last delivered line = startLine + newlines-in-slice.
    // `:2-100000` on a 5-line file delivers lines 2–5 and displays `:2-5` (display and delivery agree).
    // Canonical (LR-7): a single delivered line → `:N` (never `:N-N`).
    const deliveredEnd = startLine + (content.match(/\n/g)?.length ?? 0);
    rangeSuffix = startLine === deliveredEnd ? `:${startLine}` : `:${startLine}-${deliveredEnd}`; // UI: read path:N / path:N-M (clamped to the delivered range)
```

**Edit 2 — the inline-arm comment (Mode A; the code line is UNCHANGED):**
```ts
// oldText:
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // the REQUESTED range (LR-5 clamping is S2)
// newText:
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount, range: rangeSuffix }); // the DELIVERED (clamped) range (LR-5) — clamps only when the requested end passed EOF
```

**Edit 3 — the paged-arm comment (Mode A; the code line is UNCHANGED):**
```ts
// oldText (tail of the paged detail push):
directive: extractDirectiveInner(directiveBlock) }); // paged-resume display, NOT rangeSuffix (the requested range)
// newText:
directive: extractDirectiveInner(directiveBlock) }); // paged-resume display `:${resumeLine}-`, NOT rangeSuffix (the delivered range)
```

**Edit 4 — the FileDetail.range field comment (Mode A):**
```ts
// oldText:
  range?: string; // paged resume ":N-" OR user line range ":N" / ":N-M" (read-tool style)
// newText:
  range?: string; // paged resume ":N-" OR the user line range ":N" / ":N-M" as DELIVERED — clamped when end > EOF (LR-5; read-tool style)
```

### Behavior trace (every path — POST-S2 vs POST-S1)

| Token | File | Slice | \n's | deliveredEnd | POST-S2 range | POST-S1 (today) | Gate |
|---|---|---|---|---|---|---|---|
| `:3` | a.ts (4 lines) | `}` | 0 | 3 | `:3` | `:3` | LINE-1 ✓ unchanged |
| `:2-3` | a.ts | `return…`+`}` | 1 | 3 | `:2-3` | `:2-3` | LINE-2 ✓ unchanged |
| `:2` (start===end) | any | 1 line | 0 | 2 | `:2` | `:2` | canonical ✓ |
| `:2-100000` | lr5_five.txt (5 lines) | `l2\nl3\nl4\nl5` | 3 | 5 | **`:2-5`** | `:2-100000` | **LINE-12 (THE FIX)** |
| `:4-100000` | a.ts (4 lines) | line 4 only | 0 | 4 | `:4` | `:4-100000` | clamp→canonical ✓ |
| `:1-999999` huge.log, PAGED_FIX | ~28k | paged arm | — | — | `:${resumeLine}-` | same | LINE-8 ✓ untouched |
| `:99` (past-EOF start) | 5-line | `""` (empty) | 0 | 99 | `:99` | `:99` | unchanged (LR-4 = T2.S3) |

### The LINE-12 test (TDD — RED first; formalized in P1.M2.T1.S2)

```js
await runCase("LINE-12", "LR-5: #@lr5_five.txt:2-100000 (5-line file) → range ':2-5' (display = delivered, clamped)", async () => {
  // PRD §17.6 LR-5 / §17.9 LINE-12: display shows what was DELIVERED. sliceLines clamps the :2-100000 request
  // to lines 2–5; the detail's range (and the collapsed read line) must show :2-5, not the requested :2-100000.
  const five = path.join(TMPDIR, "lr5_five.txt");                    // UNIQUE inline fixture (no shared collision)
  fsSync.writeFileSync(five, "l1\nl2\nl3\nl4\nl5\n");                 // exactly 5 lines (trailing \n ≠ extra line)
  const r = await mod.injectFiles("See #@lr5_five.txt:2-100000", [], FIX);
  assert(r.injected === 1, `one delivery, got ${r.injected}`);
  assert(r.text === "See #@lr5_five.txt:2-100000", "prompt verbatim (§6.4)");
  const d = r.details[0];
  assert(d.kind === "text", `kind 'text' (FIX = no budget → the inline whole-slice arm), got '${d.kind}'`);
  assert(d.range === ":2-5", `range must be the DELIVERED :2-5 (clamped from :2-100000), got ${JSON.stringify(d.range)}`);
  assert(d.lines === 4, `4 lines delivered (2–5), got ${d.lines}`);
  assert(hasBlock(r, "l2\nl3\nl4\nl5"), `body must be lines 2–5, got ${JSON.stringify(r.blocks)}`);
  assert(!hasBlock(r, "l1\n"), "line 1 must be absent");
});
```
- **Placement**: after LINE-8-MD's closing `});` (the last LINE-* case, ~L3090).
- **RED** on POST-S1: `d.range` is `":2-100000"` → the `":2-5"` assert fails. **GREEN** after Edit 1.

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (the rangeSuffix line in emitText's range branch): requested-`end` source → computed `deliveredEnd`
    (+ the 4-line LR-5 comment). `end` stays for the sliceLines call.
  - comment (the inline whole-slice detail push): "the REQUESTED range (LR-5 clamping is S2)" → "the DELIVERED (clamped) range (LR-5)".
  - comment (the paged detail push tail): "NOT rangeSuffix (the requested range)" → "NOT rangeSuffix (the delivered range)".
  - comment (FileDetail.range field, ~L536): note the line range is the delivered (clamped) range.
  - UNCHANGED: the LR-1 comment block; the three-way decision structure; the paged arm's CODE; the sub-head
    arm's code; `end`/sliceLines/slice computation; subtract; state.paged++; the whole-file branch; the emitText
    JSDoc (S3); claimKey/splitLineRange; the notify.

FILE_EDITS (file-injector.test.mjs):
  - add (after LINE-8-MD): runCase("LINE-12", …) per the spec above.

NO_CHANGES: relative-imports.test.mjs, import-behavior.test.mjs, package.json, scripts/, PRD.md, README.md
            (P1.M2.T2), all plan/ files. NO new exports. NO new imports. NO interface changes.
```

### Implementation Tasks (ordered — TDD: RED first)

```yaml
Task 1 (RED): ADD runCase("LINE-12", …) after LINE-8-MD
  - UNIQUE inline fixture (lr5_five.txt, 5 lines); FIX ctx (no budget → the inline whole-slice arm).
  - Assert: injected===1, verbatim prompt, kind 'text', range === ":2-5", lines === 4, body lines 2–5, no line 1.
  - VERIFY RED: node ./file-injector.test.mjs → LINE-12 FAILS at the range assert (got ":2-100000").

Task 2 (GREEN): REWRITE the rangeSuffix computation (Edit 1)
  - After `content = sliceLines(content, startLine, end)`: compute deliveredEnd from the slice's newlines;
    build rangeSuffix from startLine/deliveredEnd (canonical :N when equal). Keep `end` for the slice call.
  - VERIFY GREEN: node ./file-injector.test.mjs → 175 passed; LINE-1…6 + LINE-8/-MD unchanged.

Task 3 (Mode A): UPDATE the 3 comments (Edits 2-4)
  - The inline-arm marker comment → "the DELIVERED (clamped) range (LR-5)".
  - The paged-arm tail comment → "(the delivered range)".
  - The FileDetail.range field comment → "as DELIVERED — clamped when end > EOF (LR-5)".
  - Do NOT rewrite the emitText JSDoc (S3) or the LR-1 comment block.

Task 4: VERIFY gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 175; node ./relative-imports.test.mjs → 38; node ./import-behavior.test.mjs → 23.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# One new local (deliveredEnd: number) + a recomputed template string — no type impact.
```

### Level 2: The Regression Gate (174 existing + LINE-12)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs        # → 175 passed (LINE-1…6 green — in-file ranges never clamp; LINE-8/-MD green)
node ./relative-imports.test.mjs     # →  38 passed
node ./import-behavior.test.mjs      # →  23 passed
# If LINE-1/LINE-2 flip: deliveredEnd drifted for in-file ranges — re-check the formula (end ≤ lines ⇒ deliveredEnd === end).
# If LINE-8 flips: the paged arm was accidentally touched — its range must remain `:${resumeLine}-`.
```

### Level 3: TDD RED→GREEN + the clamp trace

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case LINE-|Result:"
# Step A (RED, before Task 2): LINE-12 ✗ (range got ":2-100000"). Step B (GREEN, after): all LINE-* ✓ + 175 passed.
# Ad-hoc clamp trace (the deliveredEnd math, no source edit):
node -e '
const content = "l1\nl2\nl3\nl4\nl5\n";
const parts = content.split("\n"); if (parts.at(-1) === "" && content.endsWith("\n")) parts.pop();  // 5 lines
const slice = parts.slice(1, 100000).join("\n");   // :2-100000
console.log(JSON.stringify(slice), "| newlines =", slice.match(/\n/g)?.length ?? 0,
            "| deliveredEnd = 2 +", slice.match(/\n/g)?.length ?? 0, "=", 2 + (slice.match(/\n/g)?.length ?? 0));'
# Expected: "l2\nl3\nl4\nl5" | newlines = 3 | deliveredEnd = 2 + 3 = 5  → range ":2-5". ✓
```

### Level 4: Canonical-form spot check (the :N form survives)

```bash
# LINE-1 already pins :3 (single line → :N). Ad-hoc: a clamped-to-single case (:4-100000 on 4-line a.ts):
node -e '
const content = "a\nb\nc\nd\n"; const parts = content.split("\n"); parts.pop();
const slice = parts.slice(3, 100000).join("\n");   // :4-100000 → delivers only line 4
const deliveredEnd = 4 + (slice.match(/\n/g)?.length ?? 0);
console.log(JSON.stringify(slice), "→ range:", 4 === deliveredEnd ? ":4" : `:4-${deliveredEnd}`);'
# Expected: "d" → range: :4  (canonical single-line form, never :4-4). ✓
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 175 passed; `relative-imports` 38 + `import-behavior` 23.
- [ ] RED→GREEN confirmed for LINE-12.

### Feature Validation (the LR-5 contract)

- [ ] `#@lr5_five.txt:2-100000` (5-line file) → `details[0].range === ":2-5"`, `kind === "text"`, `lines === 4`, body = lines 2–5.
- [ ] Canonical form: a single delivered line → `:N` (LINE-1 `:3` green; the `:4-100000` → `:4` ad-hoc trace).
- [ ] In-file ranges byte-identical (LINE-1…6 green unchanged).
- [ ] The paged arm byte-for-byte unchanged — `range: \`:${resumeLine}-\`` (LINE-8/LINE-8-MD green).
- [ ] The empty-slice (past-EOF start) display unchanged (`:N`) — LR-4's territory unperturbed.

### Code Quality Validation

- [ ] Only the rangeSuffix line changed semantically; `end` still feeds sliceLines; no structural change.
- [ ] deliveredEnd computed from the slice's newlines directly (NOT from lineCount — the empty-slice trap).
- [ ] The emitText JSDoc NOT rewritten (S3); the LR-1 comment block NOT touched; the quadruple NOT unified (S3).
- [ ] No new exports/imports; no interface changes (emitText/FileDetail shapes unchanged).

### Documentation

- [ ] Mode A: the 3 comments updated (the inline-arm marker → delivered; the paged-arm tail; FileDetail.range).
- [ ] No README change (P1.M2.T2).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT build rangeSuffix from the requested `end` anymore.** That IS the gap. The delivered range comes
  from the slice's newline count (`startLine + newlines`). Only `sliceLines` still consumes the requested `end`.
- ❌ **Do NOT derive deliveredEnd from `lineCount`.** lineCount is 0 for an empty slice → `start + lineCount − 1`
  gives `start − 1` (wrong). The direct newlines formula gives `start + 0 = start` → `:N` (today's behavior for
  empty slices — LR-4/T2.S3 will change the whole empty-slice case later; S2 must not perturb it).
- ❌ **Do NOT touch the paged arm.** Its `:${resumeLine}-` is the resume directive (where read continues), not a
  range display. LINE-8 gates it. Only its trailing COMMENT gets the Mode-A touch.
- ❌ **Do NOT rewrite the emitText JSDoc or unify the quadruple.** Both are S3 (the task tree splits the PRD
  §17.10 code-quality note there). S2's comment touches are the 3 range-describing ones ONLY.
- ❌ **Do NOT add LR-4 behavior** (past-EOF start → failed token/notify/claim-revoke) — T2.S3. S2 displays the
  empty slice exactly as today (`:N`), leaving LR-4's change unperturbed.
- ❌ **Do NOT emit `:N-N` for a single delivered line.** Canonical form (LR-7, pinned): `startLine ===
  deliveredEnd` → `:N`. The clamped-to-single case (`:4-100000` on a 4-line file) must show `:4`, not `:4-4`.
- ❌ **Do NOT modify the LINE-1…6 tests.** Their in-file ranges (:3, :2-3) never clamp → identical expectations.
  If any flips, the FORMULA drifted (re-check deliveredEnd === end when end ≤ file lines).
- ❌ **Do NOT reuse a shared fixture for LINE-12.** Use the UNIQUE inline `lr5_five.txt` (5 simple lines) so the
  expected values are crisp and nothing downstream is clobbered.

---

## Confidence Score: 10/10

A one-line semantic change (requested `end` → computed `deliveredEnd`) + 3 comment touches + 1 TDD test, with
the formula proven exact against `sliceLines`' join semantics (L lines → L−1 newlines — verified against the
committed L183-189), every affected path traced (in-file byte-identical; clamped; clamped-to-single canonical;
paged untouched; empty-slice unperturbed), and S1's own inline marker (`// the REQUESTED range (LR-5 clamping is
S2)`) pinning the edit site. The RED→GREEN is deterministic (today `:2-100000`, after `:2-5`), and LINE-1…6 +
LINE-8 stay green by construction. The implementing agent makes 4 edits + 1 test, then runs typecheck + 3 suites.