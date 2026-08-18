---
name: "P1.M1.T1.S2 (bugfix 001_a6ffb98ab096) — computeDetailOffsets: kind-gated binary note branch (no-newline block)"
prd_ref: "bugfix PRD §h3.0 Issue 1 (BUG-001: expanded view shows the paged directive as the body of a following url/binary file) + §h2.5 Recommendation 1 ('or simply compute contentStart/contentLen for the url/binary kinds too — their blocks are body-bearing'); architecture/renderer_bug001.md §Fix design evaluation candidate (a) binary analysis"
target_file: "./file-injector.ts"   # 2 semantic edits (deny-guard + the kind-gated branch) + 2 Mode-A comments
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict + the 4 suites green)
depends_on: "P1.M1.T1.S1 (FULLY LANDED: the :477 guard is now the DENY-list `if (d.kind === 'image' || d.kind === 'binary') continue;` so url pairs via the 0x0A test unchanged; REND-PAGED-URL green; baseline 181). S1 explicitly deferred binary: 'binary blocks are NOT body-bearing (no leading \\n) — they need the kind-gated note branch that S2 builds.'"
consumed_by: "P1.M1.T1.S3 (the path-aware tier-3 fallback — S3's renderer change must not regress S2's tier-1 binary offsets); P1.M1.T1.S3's tests pin the renderer consuming S2's offsets"
---

# PRP — P1.M1.T1.S2: computeDetailOffsets — kind-gated binary note branch (no-newline block)

> ⚠️ **THE KIND-GATE IS LOAD-BEARING.** The 0x0A body-bearing test **double-serves** as the paged-directive-skip
> discriminator: a directive block (`<file name="ABS"><paged: …></file>`) has no leading `\n` → never pairs for
> text/paged. A naive generalization ("if not 0x0A, use no-newline math") would let a **paged** detail pair its
> OWN directive block. The binary branch is therefore **gated on `d.kind === "binary"` ONLY** — text/paged/url
> pairing must stay byte-for-byte unchanged (pinned by regression assertions in the test).

---

## Goal

**Feature Goal:** Complete the `binary` half of the BUG-001 fix (the expanded-view body misalignment after a
paged file): `computeDetailOffsets` now processes `kind === "binary"` details through a **kind-gated no-newline
branch** — `formatBinaryBlock` emits `<file name="ABS"><binary file — …></file>` with NO `\n` after the opener,
so the pairing uses `headerLen = openEnd` and `closerLen = "</file>".length` (7), making the tier-1 slice exactly
the note inner text. A following-binary-after-paged prompt now displays the note (not the directive).

**Deliverable:** Modified `file-injector.ts` — (1) the deny-guard drops `"binary"` (only image stays skipped);
(2) an `else if (d.kind === "binary")` branch inside the pairing loop; (3)-(4) Mode-A comment updates on the
computeDetailOffsets JSDoc + the FileDetail.contentStart/contentLen field comments. Modified
`file-injector.test.mjs` — +`runCase("REND-PAGED-BIN", …)` after REND-PAGED-URL (TDD, RED first). 181 → 182.

**Success Definition:**
1. TDD: REND-PAGED-BIN is RED on POST-S1 (binary has no offsets → the slice assert fails), GREEN after.
2. `node ./file-injector.test.mjs` → **182 passed**, all REND-* unchanged (REND-MULTI-OFFSET / REND-PAGED-URL /
   REND-MULTI-E2E green — text/paged/url pairing byte-for-byte unchanged).
3. `npm run typecheck` → 0 errors; the other 3 suites green via `npm test` (relative-imports 38 /
   import-behavior 23 / url-injection 38, unchanged).
4. The paged-directive skip invariant holds: a paged detail NEVER pairs its directive block (regression assertion).

## Why

- **Closes the binary half of a verified Major display bug.** BUG-001 (PRD §h3.0): after a paged file (2 blocks,
  1 detail), a following binary detail fell to the tier-3 `bodies[i]` regex fallback, whose index counts BLOCKS
  while `i` counts DETAILS — the binary's expanded body showed the `<paged: …>` directive and the note text
  never appeared. The PRD §10 row "Chat display — binary … expanded shows the same note text" is the contract.
- **The minimal, safest fix (the arch verdict).** `renderer_bug001.md` evaluates the candidates and recommends
  "(a′) add a kind-gated binary branch (`headerLen = openEnd`, `closerLen = 7` when `d.kind === 'binary'` and
  `hdr === p`)". ~6 lines, additive, guarded; the alternative (a path-aware tier-3) is the deeper fix and is
  S3's — S2 + S3 compose per the verdict ("the most robust minimal combination").
- **Tier-1 offsets are BUG-1-safe by construction** — length-derived (`blk.length − header − closer`), not
  regex — so the note text (which contains no `</file>`) and every future body slice exactly.

## What

### User-visible behavior

- `Summarize #@big.log and inspect #@note.bin` under a tight budget, expanded: the binary's body area now shows
  `binary file — contents not injected; use the read tool if needed` (un-highlighted — the renderer's
  lang-undefined path), and the `<paged: …>` directive appears exactly once (big.log's own body slot). Collapsed
  read-lines and the model-facing `message.content` were always correct — unchanged.

### Technical behavior (the contract)

- The deny-guard becomes `if (d.kind === "image") continue;` — binary enters the pairing loop.
- Inside `if (hdr === p)`, after the 0x0A branch: `else if (d.kind === "binary")` computes
  `headerLen = openEnd`, `closerLen = "</file>".length`, `bodyLen = blk.length − headerLen − closerLen`,
  `contentStart = starts[bi] + headerLen` (defensive `bodyLen >= 0`), then `cursorByPath.set(p, bi + 1); break;`.
- text/paged/url paths: **byte-for-byte unchanged** (their scans still skip non-0x0A blocks via `bi++` because
  their kind is not "binary" — this IS the directive-skip preservation).

### Success Criteria

- [ ] The deny-guard skips ONLY `"image"`; binary is processed.
- [ ] The `else if (d.kind === "binary")` branch exists with `headerLen = openEnd` / `closerLen = 7` math + the kind-gate comment.
- [ ] REND-PAGED-BIN green: binary slice === the exact note text; paged slice === head (never the directive); renderer E2E shows the note.
- [ ] All existing REND-* green (text/paged/url pairing unchanged); `npm run typecheck` 0 errors; 4 suites green.
- [ ] Mode A: the computeDetailOffsets JSDoc + FileDetail offset-field comments describe the landed note branch.

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** This PRP gives the
verbatim POST-S1 pairing loop (S1 is LANDED — the deny-guard at :477 verified), the exact oldText→newText for
all 4 edits, the block-shape math verified against `formatBinaryBlock`'s exact emission, the kind-gate risk
explained + regression-pinned, the REND-PAGED-BIN test verbatim (modeled on S1's landed REND-PAGED-URL), and
the S3/M2 scope boundaries. Two small edits + two comments + one test.

### Documentation & References

```yaml
# MUST READ — the BUG-001 contract + the binary-branch math + the kind-gate guard
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/renderer_bug001.md
  why: "§Fix design evaluation candidate (a) 'binary' analysis gives the EXACT branch math ('headerLen = openEnd,
        closerLen = \\\\\"</file>\\\\\".length (no newline), so the slice is the note inner') AND the critical
        risk + guard ('the directive skip depends on the 0x0A test failing … only apply the no-newline branch
        when d.kind === \\\\\"binary\\\\\", keeping text/paged pairing unchanged'). §Verdict names (a′) as the
        recommended minimal combination with S1's url fix. §'Additional edge cases' items 2 (cumulative drift —
        the test uses paged + binary), 5 (the redundant-but-harmless post-loop set), 7 (SEP = \\\"\\\\n\\\\n\\\")."
  critical: "The kind-gate is the whole design. Generalizing the no-newline math beyond kind 'binary' breaks the
             paged-directive skip. The test MUST assert the paged slice is the head, never the directive."

# MUST READ — the S1 contract (the POST-S1 guard + the S2 handoff)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M1T1S1/PRP.md
  why: "S1 (LANDED) shipped the URL half: the deny-list guard `if (d.kind === 'image' || d.kind === 'binary')
        continue;` + REND-PAGED-URL + the JSDoc forward-reference 'binary lands via the note branch
        (P1.M1.T1.S2)'. S1's anti-patterns explicitly reserve the binary branch for S2."
  critical: "Post-S1 state: binary STILL skipped (S2's job); url pairs via the 0x0A test unchanged (S1's landed
             invariant — S2 must not perturb it). Baseline 181."

# MUST READ — the bug report (repro, root cause, the PRD contract row)
- file: PRD.md  (bugfix PRD §h3.0 Issue 1 + §h2.5)
  why: "The verified repro ('the binary note text never appears; the directive shows twice'), the root cause
        (computeDetailOffsets skips url/binary → tier-3 bodies[i] misalignment), and the contract row
        ('Chat display — binary … expanded shows the same note text')."
  section: "### Issue 1 (BUG-001) + Recommendations #1"

# The file you edit (2 semantic edits + 2 comments)
- file: file-injector.ts
  why: "computeDetailOffsets :462-513 — the deny-guard :477; the pairing loop's `if (hdr === p)` block (the
        0x0A branch ~:487-498 — insert the else-if after its closing brace). formatBinaryBlock :380-382 (the
        no-newline emission). The binary detail push :~1377 (`{ path: abs, kind: 'binary' }`). The JSDoc :~470
        ('binary lands via the note branch (P1.M1.T1.S2)'). FileDetail.contentStart comments :~564."
  pattern: "Mirror the 0x0A branch's structure (defensive bodyLen>=0, cursorByPath.set, break) with the
            no-newline math; gate on d.kind === 'binary'."
  gotcha: "Do NOT touch the 0x0A branch, the post-loop cursor code, SEP, blockPath, or the url comment — those
           are S1's landed contract. Only the guard line + the new else-if + the 2 comments change."

# The gate you also edit (+REND-PAGED-BIN)
- file: file-injector.test.mjs
  why: "181 baseline. S1's REND-PAGED-URL at :2809 is the VERBATIM template (blocks [pagedHead, pagedDirective,
        X] + details [paged, x]; assert (a) x's slice, (b) the paged head slice + never the directive,
        (c) renderer E2E via REND_THEME/textOf). Insert REND-PAGED-BIN right after it (before REND-MULTI-E2E)."
  pattern: "Craft the binary block via the SAME formatBinaryBlock emission (use \\u2014 for the em dash in the
            expected text); assert details[1].contentStart/contentLen slice === the note inner."
  gotcha: "RED is by construction on POST-S1 (binary skipped → contentStart undefined → slice('') ≠ the note).
           textOf/REND_THEME are module-scope (S1's landed test uses them)."
```

### Current Codebase tree

```bash
pi-file-injector/
├── file-injector.ts          # ← EDITED (deny-guard :477; the kind-gated else-if in the pairing loop; 2 comments)
├── file-injector.test.mjs    # ← EDITED (+runCase("REND-PAGED-BIN", …) after REND-PAGED-URL; 181 → 182)
├── relative-imports.test.mjs # run via npm test (NOT edited)
├── import-behavior.test.mjs  # run via npm test (NOT edited)
├── url-injection.test.mjs    # run via npm test (NOT edited)
├── scripts/typecheck.mjs     # untouched (the typecheck gate)
└── plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/
    ├── architecture/renderer_bug001.md   # ← the candidate-(a) binary analysis + the kind-gate guard
    └── P1M1T1S1/{research/research_notes.md, PRP.md}   # ← S1 (LANDED): the url half + the S2 handoff
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # MODIFIED — deny-guard drops "binary"; + the kind-gated no-newline binary branch;
                          #                  the computeDetailOffsets JSDoc + FileDetail offset-field comments.
file-injector.test.mjs    # MODIFIED — +runCase("REND-PAGED-BIN", …) after REND-PAGED-URL.
# No other files. No new exports. No new imports. No renderer changes (tier-1 consumes offsets implicitly).
```

### Known Gotchas of our Codebase & Library Quirks

```ts
// ⚠️ CRITICAL — THE KIND-GATE IS LOAD-BEARING. The 0x0A test double-serves as the paged-directive-skip
//   discriminator: directive blocks have no leading \n → they never pair for text/paged. The no-newline math
//   must fire ONLY for d.kind === "binary". A naive "else { no-newline math }" would let a paged detail pair
//   its OWN directive block. The test pins: slicePaged === head && !slicePaged.includes("<paged:").

// CRITICAL — the binary branch's math differs from the 0x0A branch in BOTH offsets: headerLen = openEnd
//   (NOT openEnd + 1 — there is no \n after the opener) and closerLen = "</file>".length (7, NOT
//   "\n</file>".length = 8 — formatBinaryBlock appends a bare </file>). The slice is the WHOLE note inner
//   text INCLUDING its angle brackets: "<binary file — contents not injected; use the read tool if needed>".

// CRITICAL — image STAYS skipped (the guard becomes `if (d.kind === "image") continue;`). Image/F5/URL-image
//   blocks never render a body (the renderer's d.kind !== "image" guard ~:1074); adding them would let the
//   F5/empty-image inner notes "pair" (arch doc "Other kinds": do NOT add).

// GOTCHA — blk.indexOf(">") + 1 finds the opener's closing '>'. A path containing '>' would mis-find — the
//   SAME pre-existing assumption as the 0x0A branch's openEnd (blockPath requires no '"' but '>' is technically
//   possible). Real emissions are fine; the failure mode is defensive no-offsets → tier-3. No NEW risk.

// GOTCHA — the em dash (U+2014) in the note is 1 UTF-16 code unit; blk.length/contentStart/contentLen are all
//   UTF-16 code-unit indices → consistent. In the TEST, write the expected note with \u2014 (matching
//   formatBinaryBlock's emission exactly) — a literal — typed differently could still be U+2014, but \u2014 is
//   unambiguous.

// GOTCHA — keep the in-branch `cursorByPath.set(p, bi + 1); break;` (mirror the 0x0A branch). The post-loop
//   `else { cursorByPath.set(p, bi + 1); }` (arch edge #5: redundant-but-harmless after break) stays UNCHANGED.

// GOTCHA — do NOT touch tier-3 (bodies[i]) — that's S3 (the path-aware fallback for old/foreign messages).
//   S2's offsets make tier-1 serve real binary emissions; tier-3 remains the last-resort fallback.

// LIBRARY — charCodeAt/openEnd/length are UTF-16 code-unit ops (consistent throughout). No new imports/exports
//   (computeDetailOffsets is already exported; the branch is internal). No signature changes.
```

## Implementation Blueprint

### The 4 edits (POST-S1 oldText → newText; identifier-based — line numbers drift)

**Edit 1 — the deny-guard (:477): drop `"binary"`:**
```ts
// oldText:
    if (d.kind === "image" || d.kind === "binary") continue; // no displayable body (F5 is kind "image").
// newText:
    if (d.kind === "image") continue; // image never renders a body (renderer's kind!=="image" guard); F5 is kind "image".
```

**Edit 2 — the kind-gated no-newline branch (inside `if (hdr === p)`, immediately after the 0x0A block's closing brace):**
```ts
// oldText (the tail of the 0x0A branch — the anchor):
          cursorByPath.set(p, bi + 1); // consumed; a following paged directive block has the same path but is skipped below
          break;
        }
      }
      bi++;
// newText:
          cursorByPath.set(p, bi + 1); // consumed; a following paged directive block has the same path but is skipped below
          break;
        } else if (d.kind === "binary") {
          // BINARY NOTE BRANCH (BUG-001, P1.M1.T1.S2) — formatBinaryBlock emits `<file name="ABS"><binary …></file>`
          // with NO '\n' after the opener, so the 0x0A body-bearing test fails; the displayable body is the whole
          // note inner text. The KIND-GATE is load-bearing: without it a paged detail could pair its OWN directive
          // block (also no 0x0A) — text/paged/url pairing stays byte-for-byte unchanged.
          const headerLen = openEnd;             // no '\n' to include (vs openEnd + 1 in the 0x0A branch)
          const closerLen = "</file>".length;    // 7 — no leading '\n' (formatBinaryBlock appends a bare '</file>')
          const bodyLen = blk.length - headerLen - closerLen;
          if (bodyLen >= 0) { // defensive: malformed block → leave detail untouched
            d.contentStart = starts[bi] + headerLen;
            d.contentLen = bodyLen;
          }
          cursorByPath.set(p, bi + 1); // consumed
          break;
        }
      }
      bi++;
```

**Edit 3 — Mode A: the computeDetailOffsets JSDoc (the sentence S1 forward-referenced):**
```ts
// oldText: *  here (F5 is kind "image"); binary lands via the note branch (P1.M1.T1.S2). Url details DO get offsets —
// newText: *  here (F5 is kind "image"). Binary details pair via a KIND-GATED no-newline branch (P1.M1.T1.S2):
//           *  formatBinaryBlock emits no '\n' after the opener, so headerLen = openEnd and closerLen = 7 — the
//           *  slice is the note inner text. The gate keeps the 0x0A test as the paged-directive-skip for
//           *  text/paged (a paged detail NEVER pairs its directive). Url details DO get offsets —
```

**Edit 4 — Mode A: the FileDetail.contentStart/contentLen field comments:**
```ts
// oldText (the kind list S1 wrote): "(text/paged/url; image/binary omit — binary via the note branch, P1.M1.T1.S2)"
// newText: "(text/paged/url/binary — binary via the kind-gated no-newline note branch, P1.M1.T1.S2; image omits)"
```

### Behavior trace (all kinds, POST-S2 — text/paged/url unchanged)

| kind | deny-guard | pairing branch | tier-1 offsets | renderer expanded body |
|---|---|---|---|---|
| text | processed | 0x0A (unchanged) | ✓ unchanged math | exact body slice |
| paged | processed | 0x0A on HEAD; directive skipped (0x0A fails; kind ≠ binary) | ✓ unchanged | head slice (+ directive text) |
| url | processed | 0x0A (S1; envelope ≡ text) | ✓ | extracted markdown |
| **binary** | **processed (NEW)** | **else-if no-newline (kind-gated)** | **✓ note inner** | **note text, un-highlighted** |
| image | skipped (only kind) | — | none | none (renderer guard) |

### The REND-PAGED-BIN test (TDD — RED first; verbatim spec)

```js
await runCase("REND-PAGED-BIN", "BUG-001(binary): kind 'binary' gets offsets — after a paged file the binary note pairs with ITS block (not the directive)", async () => {
  const PAGED_PATH = "/abs/big.log";
  const BIN = "/abs/note.bin";
  const head = "H".repeat(50);
  const pagedHeadBlock = '<file name="' + PAGED_PATH + '">\n' + head + '\n</file>';
  const pagedDirectiveBlock = '<file name="' + PAGED_PATH + '"><paged: 118890 chars; head delivered 212 complete lines; read the rest with the read tool at offset:213, limit:2000, incrementing offset by 2000 until done></file>';
  const binaryNote = '<binary file \u2014 contents not injected; use the read tool if needed>';
  const binaryBlock = '<file name="' + BIN + '">' + binaryNote + '</file>';   // NO '\n' after the opener
  const blocks = [pagedHeadBlock, pagedDirectiveBlock, binaryBlock];
  const content = blocks.join("\n\n");
  const details = [
    { path: PAGED_PATH, kind: "paged", chars: 118890, range: ":213-", pagedHeadLines: 212 },
    { path: BIN, kind: "binary" },
  ];
  mod.computeDetailOffsets(blocks, details);
  // (a) THE regression assertion — the binary detail's offsets recover the note inner, never the directive.
  const sliceBin = content.slice(details[1].contentStart, details[1].contentStart + details[1].contentLen);
  assert(sliceBin === binaryNote, `binary offset slice must be the exact note text, got ${JSON.stringify(sliceBin.slice(0, 60))}`);
  assert(!sliceBin.includes("<paged:"), "binary body must NOT be the paged directive");
  // (b) THE KIND-GATE INVARIANT — paged pairing unchanged: the head, never its own directive block.
  const slicePaged = content.slice(details[0].contentStart, details[0].contentStart + details[0].contentLen);
  assert(slicePaged === head, `paged head slice unchanged (directive still NEVER pairs), got ${JSON.stringify(slicePaged.slice(0, 40))}`);
  assert(!slicePaged.includes("<paged:"), "paged slice must never be the directive");
  // (c) E2E renderer — the child after the binary read line carries the note (lang undefined → un-highlighted).
  const expanded = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  const kids = expanded.children.map(textOf);
  const binLineIdx = kids.findIndex((t) => t.includes("read") && t.includes("note.bin"));
  assert(binLineIdx !== -1, "the binary read line must be present in the expanded view");
  const binBodyChild = String(kids[binLineIdx + 1]);
  assert(binBodyChild.includes("binary file \u2014 contents not injected"),
    `the child after the binary read line must carry the note text, got ${JSON.stringify(binBodyChild.slice(0, 80))}`);
  assert(!binBodyChild.includes("<paged:"), "the binary body child must not be the directive");
});
```
- **Placement**: immediately after REND-PAGED-URL's `});` (before the REND-MULTI-E2E comment block).
- **RED on POST-S1**: binary is still deny-guarded → `details[1].contentStart` is `undefined` →
  `content.slice(undefined, NaN)` → `""` → `sliceBin === binaryNote` fails. ✓
- **GREEN after**: the branch computes offsets → the slice is exactly the note inner text.

### Integration Points

```yaml
FILE_EDITS (file-injector.ts):
  - change (:477 deny-guard): drop `|| d.kind === "binary"` (image-only skip).
  - add (the pairing loop, after the 0x0A branch's closing brace, inside `if (hdr === p)`):
    the `else if (d.kind === "binary")` no-newline branch (headerLen = openEnd; closerLen = 7; defensive
    bodyLen>=0; cursorByPath.set + break).
  - comment (computeDetailOffsets JSDoc): replace the "binary lands via the note branch (P1.M1.T1.S2)"
    forward-reference with the landed-branch description (kind-gated; directive-skip preserved).
  - comment (FileDetail.contentStart/contentLen): "(text/paged/url/binary; image omits)" + the note-branch note.
  - UNCHANGED: the 0x0A branch's math; the post-loop cursor code; SEP; blockPath; starts[]; the url comment;
    renderInjectedMessage (tier-1 consumes the offsets implicitly at ~:1072; the lang-undefined path ~:1075
    already renders binary un-highlighted); formatBinaryBlock; the binary detail push.

FILE_EDITS (file-injector.test.mjs):
  - add (after REND-PAGED-URL): runCase("REND-PAGED-BIN", …) per the spec above.

NO_CHANGES: the other 3 .mjs suites, package.json, scripts/, PRD.md, README.md (P1.M4.T6), all plan/ files.
NO new exports. NO new imports. NO renderer changes (S3 owns tier-3; S2 is offsets only).
```

### Implementation Tasks (ordered — TDD: RED first)

```yaml
Task 1 (RED): ADD runCase("REND-PAGED-BIN", …) after REND-PAGED-URL
  - Craft blocks [pagedHead, pagedDirective, binaryBlock] + details [paged, binary]; call
    mod.computeDetailOffsets; assert (a) the binary slice === the note, (b) the paged slice === head (never the
    directive — the kind-gate invariant), (c) the renderer E2E binary body child carries the note.
  - VERIFY RED: node ./file-injector.test.mjs → REND-PAGED-BIN FAILS (sliceBin is "" — no offsets for binary).

Task 2 (GREEN): THE 2 semantic edits
  - Edit 1 (:477): the deny-guard drops "binary" (image-only).
  - Edit 2: the kind-gated else-if branch (headerLen = openEnd, closerLen = 7) after the 0x0A branch.
  - VERIFY GREEN: node ./file-injector.test.mjs → 182 passed; all REND-* green (text/paged/url unchanged).

Task 3 (Mode A): THE 2 comment edits
  - The computeDetailOffsets JSDoc sentence + the FileDetail offset-field comments (describe the landed
    kind-gated note branch; the directive-skip preserved).

Task 4: VERIFY gates
  - npm run typecheck → 0 errors.
  - node ./file-injector.test.mjs → 182; npm test (all 4 files) → relative-imports 38 / import-behavior 23 /
    url-injection 38 unchanged.
```

## Validation Loop

### Level 1: Typecheck (the --strict gate)

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# Expected: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)", exit 0.
# The branch reuses the loop's existing locals (blk/openEnd/starts/bi) — no type surface changes.
```

### Level 2: The regression gate (181 existing + REND-PAGED-BIN)

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs   # → 182 passed (all REND-* green: MULTI-OFFSET / PAGED-URL / MULTI-E2E unchanged)
npm test                        # all 4 files: relative-imports 38 / import-behavior 23 / url-injection 38
# If a REND-* text/paged/url case flips: the kind-gate leaked — re-check the else-if fires ONLY for
# d.kind === "binary" (text/paged scans must still skip non-0x0A blocks via bi++).
# If REND-MULTI-OFFSET flips: the 0x0A math was accidentally touched — it must be UNCHANGED.
```

### Level 3: TDD RED→GREEN + the kind-gate trace

```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs 2>&1 | grep -E "case REND-|Result:"
# Step A (RED, before Task 2): REND-PAGED-BIN ✗ (sliceBin "" — binary has no offsets on POST-S1).
# Step B (GREEN, after): all REND-* ✓ + "Result: 182 passed, 0 failed."
# Ad-hoc math trace (the no-newline offsets, no source edit):
node -e '
const abs = "/abs/note.bin";
const blk = `<file name="${abs}"><binary file \u2014 contents not injected; use the read tool if needed></file>`;
const openEnd = blk.indexOf(">") + 1;
const headerLen = openEnd, closerLen = "</file>".length;
console.log("openEnd:", openEnd, "| charCode after opener:", blk.charCodeAt(openEnd),
            "| bodyLen:", blk.length - headerLen - closerLen);
console.log("slice:", JSON.stringify(blk.slice(headerLen, blk.length - closerLen)));'
# Expected: openEnd = 22 | charCode 60 ('<', NOT 0x0A) | bodyLen 67 | slice "<binary file — contents not injected; use the read tool if needed>". ✓
```

### Level 4: N/A (no live-TUI validation for a unit-level offsets fix; the renderer E2E is in the test)

```bash
# The renderer is exercised headlessly in REND-PAGED-BIN part (c) (renderInjectedMessage + REND_THEME/textOf —
# the established convention; no live pi run needed for an offsets change).
```

## Final Validation Checklist

### Technical Validation

- [ ] `npm run typecheck` → 0 errors under `--strict`.
- [ ] `node ./file-injector.test.mjs` → 182 passed; `npm test` → all 4 files green (38/23/38 unchanged).
- [ ] RED→GREEN confirmed for REND-PAGED-BIN.

### Feature Validation (the binary half of BUG-001)

- [ ] Binary details carry contentStart/contentLen; the tier-1 slice is exactly the note inner text.
- [ ] After a paged file, the binary's expanded body is the note (never the `<paged:` directive).
- [ ] The renderer E2E binary body child carries the note (lang-undefined → un-highlighted).
- [ ] The kind-gate invariant: the paged detail's slice is the head, NEVER its directive (regression assertion).

### Code Quality Validation

- [ ] Only the guard line + the new else-if change semantically; the 0x0A branch, post-loop cursor code, SEP,
      blockPath, and the renderer are UNCHANGED.
- [ ] The branch is gated on `d.kind === "binary"` ONLY (with the load-bearing comment).
- [ ] No new exports/imports; no renderer changes (S3 owns tier-3); no image/F5 offsets added.

### Documentation

- [ ] Mode A: the computeDetailOffsets JSDoc + FileDetail offset-field comments describe the landed note branch.
- [ ] No README change (P1.M4.T6).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT generalize the no-newline math beyond `kind === "binary"`.** The 0x0A test double-serves as the
  paged-directive-skip discriminator; a bare `else` would let a paged detail pair its OWN directive block. The
  gate is the design (arch doc's explicit guard; S1's anti-pattern warning).
- ❌ **Do NOT reuse the 0x0A branch's math for binary.** Binary differs in BOTH offsets: `headerLen = openEnd`
  (no `\n` after the opener — not `openEnd + 1`) and `closerLen = 7` (bare `</file>` — not `"\n</file>".length`).
- ❌ **Do NOT drop `"image"` from the deny-guard entirely.** The guard keeps skipping image (F5 is kind "image";
  image/URL-image/F5 never render bodies — the renderer's kind guard; the arch doc's "Other kinds": do NOT add).
- ❌ **Do NOT touch tier-3 (`bodies[i]`) or the renderer.** S3 owns the path-aware tier-3 fallback; S2 is
  offsets only (renderInjectedMessage consumes them implicitly at tier-1). Changing the renderer here is S3 scope creep.
- ❌ **Do NOT touch the 0x0A branch, the post-loop cursor code, SEP, or blockPath.** Those are S1's landed (and
  pre-existing) contract; a flip in REND-MULTI-OFFSET/PAGED-URL/MULTI-E2E means you over-reached.
- ❌ **Do NOT add offsets for image/F5/URL-image kinds.** They never render a body; only the F5/empty-image inner
  notes would "pair" — a regression, not a fix (arch doc "Other kinds").
- ❌ **Do NOT write the expected note text with a different dash.** Use `\u2014` in the test (matching
  formatBinaryBlock's emission exactly) — a hyphen `-` or en dash would fail the exact-equality assert.
- ❌ **Do NOT forget the regression assertion on the paged slice.** The kind-gate's whole point is that the
  paged detail STILL pairs its head and never the directive — part (b) of the test pins it; omitting it leaves
  the invariant unguarded against a future "simplification".

---

## Confidence Score: 10/10

Two small, well-bounded edits (drop "binary" from the deny-guard + a 4-line-math kind-gated else-if) + 2
comment touches + 1 TDD test modeled verbatim on S1's landed REND-PAGED-URL, with the math verified against
`formatBinaryBlock`'s exact emission (no-`\n` opener, bare `</file>` closer, em dash = 1 UTF-16 unit), the
kind-gate risk explicitly handled and regression-pinned, RED by construction (binary lacks offsets on POST-S1),
and every sibling gate green by construction (text/paged/url paths untouched). The implementing agent makes
4 edits + 1 test, then runs typecheck + the 4 suites.