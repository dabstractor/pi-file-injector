# Research Notes — P1.M2.T1.S2 (plan 009): Migrate ~13 markdown block-marker pairs to verbatim

## Task
In `file-injector.test.mjs`, ~13 `hasBlock(...)`/`!hasBlock(...)` PAIRS (26-27 asserts) checked that a
markdown block's resolved `#@`/`@` import marker was STRIPPED to the bare path. The verbatim engine
(P1.M1.T1.S2, LANDED) no longer strips markers from delivered markdown content (PRD §6.4) — so these
assertions FLIP: the marker is now PRESENT verbatim, the stripped form is absent. Test-only; file-injector.ts
NOT edited.

## STATE — S1 (P1.M2.T1.S1) ALREADY LANDED
`git log --oneline` → `8d474d9 Migrate top-level prompt assertions to verbatim`. Working tree CLEAN.
**Implication:** the top-level `r.text.startsWith(...)` lines are ALREADY verbatim — the 13 cases currently
fail ONLY on their hasBlock pair (confirmed: baseline failures all cite the hasBlock "stripped to X" message,
NOT a startsWith message). My task is the SOLE remaining slice for these 13 cases. After S2: all 13 go ✓.

## Baseline (current): 127 passed, 23 failed
The 23 failures:
- **My 13 hasBlock-pair cases**: 15, CRLF-E2E, 19, 20, MD2, 21, 22, 23, EDG-3, EDG-4, 26, 27, M2.T2.S1-g.
- **Partial-strip (S3's scope)**: F1, F1b, F1d, F2, FS1, FS2, FS3 (7).
- **scanTokens unit tests (return-shape change P1.M1.T1.S1)**: T1.S1-9, T1.S1-10, T1.S1-12 (3).
After S2: 23 − 13 = **10 failed** (the 7 partial-strip + 3 scanTokens — both OUT of scope).

## The transformation rule (SWAP-PAIR — recommended over the item's literal "both positive")
For each pair, the OLD form was `hasBlock(r, STRIPPED)` + `!hasBlock(r, VERBATIM_MARKER)`. Under verbatim
delivery the marker is PRESENT and the stripped form is ABSENT. The cleanest non-redundant flip SWAPS the
needles' polarity:
- POS: `hasBlock(r, VERBATIM_MARKER)` — the marker is present verbatim.
- NEG: `!hasBlock(r, STRIPPED)` — the stripped form is absent (proves it wasn't stripped).
(Both needles already exist in the test — just swap which is positive vs negative. This honors the item's
intent — "markers now present verbatim" — without the redundant duplicate the item's literal "make both
positive on the verbatim marker" would produce. EITHER form passes; swap-pair is strictly better coverage.)
SUBSTRING-SAFETY VERIFIED for all 13: the STRIPPED needle is NOT a contiguous substring of the verbatim
content (the `#@`/`@` marker breaks contiguity) → `!hasBlock(r, STRIPPED)` is genuinely TRUE under verbatim.

## The 13 pairs — exact current lines + fixture content + old→new

Helpers (UNCHANGED — already read r.blocks): `hasBlock(r, needle) = r.blocks.some(b => b.includes(needle))`.

| # | Case | Lines (current) | Fixture (verbatim content) | OLD POS (stripped) | OLD NEG (marker absent) | NEW POS (verbatim) | NEW NEG (stripped absent) |
|---|------|----|----|----|----|----|----|
| 1 | Case 15 | 1644-1645 | notes.md: `Imports #@api.md here.` | `hasBlock(r,"Imports api.md here.")` | `!hasBlock(r,"Imports #@api.md here.")` | `hasBlock(r,"Imports #@api.md here.")` | `!hasBlock(r,"Imports api.md here.")` |
| 2 | CRLF-E2E | 1674-1675 | crlf_spec.md: `See #@crlf_after.md` | `hasBlock(r,"See crlf_after.md")` | `!hasBlock(r,"See #@crlf_after.md")` | `hasBlock(r,"See #@crlf_after.md")` | `!hasBlock(r,"See crlf_after.md")` |
| 3 | Case 19 | 1714-1715 | sub/notes.md: `See #@api.md.` | `hasBlock(r,"See api.md.")` | `!hasBlock(r,"See #@api.md.")` | `hasBlock(r,"See #@api.md.")` | `!hasBlock(r,"See api.md.")` |
| 4 | Case 20 | 1752-1753 | bigdoc.md: `...- Logs: #@huge.log` | `r.blocks[iB].includes("Logs: huge.log")` | `!r.blocks[iB].includes("#@")` (BLANKET) | `r.blocks[iB].includes("Logs: #@huge.log")` | `r.blocks[iB].includes("#@")` (FLIP blanket→positive; item: "remove or flip to includes('#@')") |
| 5 | MD2 | 1793-1794 | sub/outsider.md: `See #@../shared/api.md here.` | `hasBlock(r,"See ../shared/api.md here.")` | `!hasBlock(r,"#@../shared/api.md")` | `hasBlock(r,"#@../shared/api.md")` | `!hasBlock(r,"See ../shared/api.md here.")` |
| 6 | Case 21 | 1887-1888 | notesShorthand.md: `Imports #@api here.` | `hasBlock(r,"Imports api here.")` | `!hasBlock(r,"Imports #@api here.")` | `hasBlock(r,"Imports #@api here.")` | `!hasBlock(r,"Imports api here.")` |
| 7 | Case 22 | 1905-1906 | notesExactWins.md: `Refs #@guide here.` | `hasBlock(r,"Refs guide here.")` | `!hasBlock(r,"Refs #@guide here.")` | `hasBlock(r,"Refs #@guide here.")` | `!hasBlock(r,"Refs guide here.")` |
| 8 | Case 23 | 1921-1922 | sub/ext/notes.md: `See #@api here.` | `hasBlock(r,"See api here.")` | `!hasBlock(r,"See #@api here.")` | `hasBlock(r,"See #@api here.")` | `!hasBlock(r,"See api here.")` |
| 9 | EDG-4 | 1993-1994 | notesSubPrefix.md: `See #@sub/notes here.` | `hasBlock(r,"See sub/notes here.")` | `!hasBlock(r,"See #@sub/notes here.")` | `hasBlock(r,"See #@sub/notes here.")` | `!hasBlock(r,"See sub/notes here.")` |
| 10 | Case 27 | 2403-2404 | notes.md: `Imports #@api.md here.` (reuses #15's fixture) | `hasBlock(r,"Imports api.md here.")` | `!hasBlock(r,"Imports #@api.md here.")` | `hasBlock(r,"Imports #@api.md here.")` | `!hasBlock(r,"Imports api.md here.")` |
| 11 | M2.T2.S1-g | 2448-2449 | notesMixDedup.md: `Refs #@api.md and @api.md.` (BOTH verbatim now) | `hasBlock(r,"Refs api.md and @api.md.")` | `!hasBlock(r,"Refs #@api.md")` | `hasBlock(r,"Refs #@api.md and @api.md.")` | `!hasBlock(r,"Refs api.md and @api.md.")` |
| 12 | EDG-3 | 1972-1973 | notesDedup.md: `Imports: #@specdoc and #@specdoc.md` (BOTH verbatim now) | `hasBlock(r,"Imports: specdoc and #@specdoc.md")` | `!hasBlock(r,"Imports: #@specdoc and")` | `hasBlock(r,"Imports: #@specdoc and #@specdoc.md")` | `!hasBlock(r,"Imports: specdoc and")` |
| 13 | Case 26 (bare-@, prefixLen-1) | 2387-2390 | notesBare.md: `Refs @api.md here.` (bare-@ NOT stripped now) | `hasBlock(r,"Refs api.md here.")` (L2387) | `!hasBlock(r,"Refs @api.md here.")` (L2388) | `hasBlock(r,"Refs @api.md here.")` (L2387) | `!hasBlock(r,"Refs api.md here.")` (L2388) |

## Special cases detail

### Case 26 — 3 asserts (L2387, L2388, L2390 +2 bug guard)
- L2387 POS `hasBlock(r,"Refs api.md here.")` → `hasBlock(r,"Refs @api.md here.")` (verbatim marker present).
- L2388 NEG `!hasBlock(r,"Refs @api.md here.")` → `!hasBlock(r,"Refs api.md here.")` (stripped form absent).
- L2390 +2 bug guard `!hasBlock(r,"Refs pi.md here.")` → **KEEP** (still TRUE: content is `Refs @api.md here.`
  → `Refs pi.md here.` absent). REWORD the comment: under verbatim NO stripping occurs, so the +2-prefixLen
  bug is moot; `pi.md` never appears. (Keeping it preserves test count; it's a now-redundant-but-valid guard.)
- Case 26's OTHER asserts (`injected===2`, `paged===0`, `iNotes<iApi`) STAY VALID (resolution unchanged).

### Case 20 — blanket `!includes("#@")` (L1753)
- L1752 POS `includes("Logs: huge.log")` → `includes("Logs: #@huge.log")` (verbatim marker).
- L1753 NEG `!includes("#@")` (blanket "no #@ at all") → **FLIP to `includes("#@")`** (positive: block now
  CONTAINS verbatim `#@` markers — bigdoc.md has 4 of them). (Item: "remove or flip to includes('#@')".)
  Alternative: swap-pair NEG `!includes("Logs: huge.log")`. Either passes; the item's literal flip is primary.

### Dedup cases (EDG-3, M2.T2.S1-g) — BOTH markers now verbatim
OLD semantics: first marker = dedup-winner → STRIPPED; second = deduped → verbatim. Under verbatim: NEITHER
stripped (both present as on disk). The dedup STILL affects INJECTION (`countFileBlocks === 1` stays valid —
api.md/specdoc.md injected once); it no longer affects CONTENT. POS needle → the full verbatim line;
NEG needle → the "first-stripped" form is now absent. (Comments must change from "first stripped, second
verbatim" → "both verbatim (dedup affects injection, not content)".)

## Verbatim-block assertions that STAY UNCHANGED (§4 of the analysis doc — NOT my scope)
These already assert markers are present verbatim (code-exempt / deduped-cycle / absolute / missing /
unreadable / bareAt-off). They were ALWAYS correct and need NO change: E5 (L668), Case 16 (L1652), Case 17
(L1689), Case 18 (L1697), MD1 (L1774-1775), EDG-1 (L1962-1963), EDG-2 (L1976-1977), ISS1-MD (L2035),
Case 25 (L2370 bareAt-off), Case 27 fenced (L2406 `#@example.ts`), M2.T2.S1-e/f (L2460/L2468).
**Do NOT touch these.** Only the §3 STRIPPED pairs flip.

## Gates
- `node ./file-injector.test.mjs` → my 13 cases ✓; failures drop 23 → 10. (Remaining 10: F1/F1b/F1d/F2/
  FS1/FS2/FS3 partial-strip = S3; T1.S1-9/10/12 scanTokens return-shape = separate. OUT of scope.)
- Validate by grepping failure messages: NONE of my 13 cases' hasBlock "stripped to X" messages remain.

## Scope boundaries (do NOT touch)
- The `r.text.startsWith(...)` lines (S1 — ALREADY LANDED/verbatim).
- Partial-strip cases F2/FS1/FS2/FS3 (S3).
- scanTokens unit tests T1.S1-9/10/12 (scanTokens return-shape — separate concern, not "markdown block content").
- The verbatim-block assertions (§4 — already correct).
- file-injector.ts (git diff empty — engine is the landed verbatim contract).
- relative-imports.test.mjs / import-behavior.test.mjs (P1.M2.T2.S1).
- Helpers (hasBlock/blocksText/countFileBlocks — already read r.blocks, unchanged).