# Research Notes — P1.M1.T1.S1 (bugfix 001_5505be07608d): Fix SEP literal + matching docstrings in computeDetailOffsets

## Mission
Fix Major Issue 1: the multi-file expanded (`ctrl+o`) view shows corrupted content because `computeDetailOffsets`
uses `const SEP = "\\n\\n";` — a 4-char string (backslash-n-backslash-n) — while the real assembly at L1286 is
`blocks.join("\n\n")` (2 real newlines, length 2). Each `starts[i]` (i≥1) is too large by `2*i`, so the renderer
slices each subsequent file's body at the wrong offset. The fix is THREE edits (all cosmetic-except-SEP):
L354 SEP, L355 comment, L343 JSDoc — change `"\\n\\n"` → `"\n\n"` so `SEP.length === 2`.

**Scope = S1 ONLY:** the SEP literal + the two matching `blocks.join("\\n\\n")` docstrings. The multi-file
regression tests are T2 (REND-MULTI-OFFSET + REND-MULTI-E2E). README review is T3.

## Baseline (MUST stay green — single-block tests have zero drift)
- `node ./file-injector.test.mjs` → **156 passed, 0 failed.**
- `node ./relative-imports.test.mjs` → **38 passed.** / `node ./import-behavior.test.mjs` → **23 passed.** (217 total.)
- `npm run typecheck` → **0 errors** under `--strict`. file-injector.ts ~1412 lines.

## The bug (system_context.md §'The Bug (Issue 1)')
- L354 `const SEP = "\\n\\n";` → TS evaluates `\\n` → `\` + `n` (literal backslash-n), so SEP = `\n\n` =
  **4 chars**. VERIFIED: `"\n\n".length === 2`, buggy `"\\n\\n".length === 4`.
- L1286 `content: blocks.join("\n\n")` → TS evaluates `\n` → real newline, so the join separator = **2 chars**.
- `for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }` uses `SEP.length === 4`, but the
  real join uses 2 → each `starts[i]` (i≥1) is too large by `2*i`. The renderer's tier-1 slice
  `message.content.slice(contentStart, contentStart + contentLen)` then reads the wrong position for every file
  after the first (e.g. `b.ts` body → `"nction b() { return 2; }\n<"` — leading 2 chars lost, 2 trailing garbage).
- **Model is UNAFFECTED**: `message.content` is the correct `blocks.join("\n\n")`; `convertToLlm()` sends it
  verbatim. Only the TUI expanded view reads the corrupted offsets.
- **Existing tests pass**: every renderer offset test (REND-6, REND-11(b), REND-OFFSET, REND-PAGED-DIR) uses a
  single-block `message.content` where `starts[0] === 0` (drift zero). No test exercises multi-file expanded
  rendering through the real handler chain. (That gap is closed by T2.)

## The exact fix — THREE edits in file-injector.ts (computeDetailOffsets + its JSDoc)
| Line | Current (double-backslash → 4-char) | After (single-backslash → 2-char) |
|---|---|---|
| 354 | `  const SEP = "\\n\\n";` | `  const SEP = "\n\n";` |
| 355 | `  // absolute char offset of each block within blocks.join("\\n\\n")` | `  // absolute char offset of each block within blocks.join("\n\n")` |
| 343 | ` *  \`blocks.join("\\n\\n")\` depends on every PRIOR block's length` | ` *  \`blocks.join("\n\n")\` depends on every PRIOR block's length` |

**The escaping, stated plainly:** the source currently has DOUBLE backslashes (`\\n`), which TS parses as a
literal backslash + `n`. Change to SINGLE backslashes (`\n`), which TS parses as a real newline. Result:
`SEP.length` goes 4 → 2, matching `"\n\n".length === 2` at the L1286 join.

## Do NOT change these (already correct — single backslash, length 2)
- **L457**: `//   assembled blocks.join("\n\n"), which emitText cannot know at emit time).`
- **L1286**: `content: blocks.join("\n\n"),` — the ACTUAL assembly (the source of truth SEP must match).

## OUT OF SCOPE — the opener/closer `\\n` in the JSDoc (cosmetic, NOT the separator bug)
The computeDetailOffsets JSDoc (around L360) also contains `<file name="ABS">\\n` and `\\n</file>` describing
the block format. Those `\\n` are in a COMMENT (no runtime effect, no escape processing in comments) — they are
cosmetic prose describing the opener/closer, NOT the separator literal. The item says "Do NOT change any other
line" and scopes exactly 3 edits. LEAVE the opener/closer `\\n` untouched.

## Why the fix is safe (156 tests stay green)
- For a single block, `starts[0] === 0` regardless of `SEP.length` → the first (and only) block's offset is
  unchanged. The existing renderer tests are all single-block → zero drift → unchanged.
- `SEP` is used ONLY inside `computeDetailOffsets` (L354) for the `off += b.length + SEP.length` accumulation.
  Changing 4→2 makes `starts[i]` correct for multi-block; it does not affect single-block (starts[0]=0) or any
  non-renderer code path.
- `SEP` is a local const; no other symbol. typecheck unaffected (string literal value change).

## Scope boundaries (S1 = this subtask ONLY)
- ❌ REND-MULTI-OFFSET unit test (computeDetailOffsets with crafted multi-block) = **T2.S1**.
- ❌ REND-MULTI-E2E integration test (real input → before_agent_start → renderer, multi-file) = **T2.S2**.
- ❌ README expanded-view multi-file doc review = **T3.S1**.
- ❌ Do NOT touch L457 or L1286 (already correct). Do NOT touch the opener/closer `\\n` in the JSDoc.
- ✅ S1 = L354 (SEP) + L355 (comment) + L343 (JSDoc) — three `"\\n\\n"` → `"\n\n"` edits.

## DOCS: none
Internal separator-literal fix; no user-facing/config/API surface change. README L41 already describes the
correct expanded-view behavior ("Press ctrl+o to expand any of them to the full contents"). No edit.

## Verification (standalone, confirms the fix without T2's tests)
```bash
node -e 'console.log("sep buggy len", "\\"+"n"+"\\n".length);'   # not meaningful — instead, after the fix:
# In the fixed file, SEP evaluates to "\n\n" (2 chars). Confirm by the multi-file slice being correct:
#   after S1, run the existing 156-test suite (all single-block → green), then T2 adds the multi-file proof.
# The authoritative in-S1 check is: `grep 'const SEP' file-injector.ts` shows `"\n\n"` (single backslash),
# and `grep 'blocks.join(' file-injector.ts` shows ALL FIVE sites (343/354/355/457/1286) using single-backslash.
```