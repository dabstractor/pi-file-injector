# Research Notes — P1.M4.T6.S2: spec/ consistency pass (verification snapshot)

Verified at working-tree HEAD `10d61bc` (BUG-005 commit) with sibling S1's README sweep staged
(`M README.md`). Pre-renumber twin of this PRP lives at `../P1M4T1S2/PRP.md` (untracked) — same
task, pre-renumber ID; this is the canonical pass.

## Task 0 pre-flight greps — ALL VERIFIED (run 2025 session)

| # | Grep | Result |
|---|------|--------|
| 1 | `grep -c "invalidRange" file-injector.ts` | **5** (BUG-002: prompt-level + Step-5 guard both in) |
| 2 | `grep -n "bodiesByPath" file-injector.ts` | :1063 (JSDoc), :1078 (comment), :1091/:1097/:1099 (FIFO build) — BUG-001 tier-3 shipped |
| 3 | `grep -n '(https?|ftp)' file-injector.ts` | :46 URL_SHAPE_RE — BUG-005 shipped |
| 4 | `grep -c "formatEmptyImageBlock" file-injector.ts` | **3** — BUG-003 F5 mirror shipped |
| 5 | `grep -n 'startsWith("@")' file-injector.ts` | :1974 `if (!it.value.startsWith("@")) return it; // non-@ (e.g. '/cmd') → pass through untouched` — BUG-004 shipped |
| 6 | `grep -n '(https?|ftp)' spec/15-url-injection.md` | :71 (§2.2 regex), :333 (§8 regex), :347 (§8 normalization) — rider landed; `"Node supports it"` → 0 hits |
| 7 | `grep -n 'passed through untouched' spec/14-autocomplete.md` | :28 (§14.2 rider landed, commit 3c0bb5d) |

## Edit-set anchors — VERIFIED exact

### spec/17-line-ranges.md (Edit set A)
- **A1** :85 — LR-3 bullet: `- **LR-3 — malformed ranges are not silent.** A cleaned token whose trailing suffix matches `:\d+(-\d+)?` but fails validation (`:0`, `:5-3`), and which resolves to no file, is left verbatim (current behavior) **and** reports a hasUI-guarded warning notify, e.g. `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`. Today these tokens vanish with zero feedback.` → delete trailing stale sentence + `(current behavior)` parenthetical, append in-markdown clause.
- **A2** :43 — `3. Still unresolved → verbatim (LR-3 may add a notify).` → strengthen to "verbatim **and** the LR-3 warning notify (prompt level and delivered-markdown scan alike)".
- **A3** :100 — edge row `| `#@a.ts:0` / `#@a.ts:5-3` | Not a range; literal fallback fails → verbatim **+ warning notify** (LR-3). |` → insert in-markdown row directly under.
- KEEP untouched: :86 LR-4 bullet, :122 acceptance row LINE-10 (top-level wording still true; minimal-sweep rule).

### spec/09-algorithm.md (B1) — bodies[i] drift, THREE anchors not two
- **:402-403** header comment: `Blocks (message.content) and details.files are co-emitted in the same order (§6.4), so they align by index.` ← ALSO DRIFT (blocks and details are NOT 1:1: paged = 2 blocks / 1 detail).
- :406 `// pair each detail with its block body (re-parsed from content) by index`
- :408-412 bodies build loop (FILE_BLOCK_RE already captures name as **group 1**, body group 2 — verified :405)
- :425 `const body = bodies[i];` inside `for (let i = 0; i < files.length; i++)` loop
- Shipped mechanism to mirror: file-injector.ts :1078-1100 — `bodiesByPath = new Map<string,string[]>()`, push per match `q.push(inner)`, pop `bodiesByPath.get(d.path)?.shift()`; JSDoc :1063 names the pop guard.

### spec/16-appendix-skeleton.md (B2)
- :76 — inline regex `/<file name="[^"]+">([\s\S]*?)<\/file>/g` — group 1 = BODY, **no name capture** → must add `name="([^"]+)"` (body becomes m[2]).
- :79 `files.forEach((d, i) => {`; :81 `if (opts.expanded && bodies[i] !== undefined && d.kind !== "image") {`; :83 uses `bodies[i]` twice in the Text line.

### spec/12-implementation-notes.md (B3)
- :25 note 23 clause: `Guard `message.details?.files` (may be absent on old/foreign entries), guard `bodies[i]`, and short-circuit the image expanded-view (images are already attached to the user message; don't re-render them).` → only the `guard bodies[i]` clause changes.

## Verify-only verdicts (set C) — evidence quoted
- **C1 spec/06: PASS.** :94 "each file's full delivered text renders below its `read` line" (per-file promise — now true for url/binary-after-paged); :111 "parallel to `blocks` emission order" (an ORDER claim — pre-order, always true; NOT an index-parity claim). No edit.
- **C2 spec/15: PASS.** §2.2 :71, §7 ftp row (rider diff verified in commit 10d61bc: "accepted by URL_SHAPE_RE … undici has no ftp support … falls back to verbatim via §3.5 catch"), §8 :333/:347. `"Node supports it"` absent (0 hits). No edit.
- **C3 spec/14: PASS.** §14.2 :28 rider sentence landed; §14.3/§14.4 don't contradict. No edit.
- **C4 BUG-003 sweep: PASS.** `grep -i "empty" spec/15` hits only SPA/empty-extraction rows (:40,:160,:169,:379,:446) — no empty-image-body promise anywhere in spec/15. README sibling carries that story. No edit.

## Repo facts
- Gates: `npm test` = all 4 suites (file-injector / import-behavior / relative-imports / url-injection, via package.json); `npm run typecheck` = `node ./scripts/typecheck.mjs` (0 errors expected).
- Working tree: `M README.md` (staged, sibling S1) — do NOT touch; spec/ clean (riders committed).
- No markdown linter; validation = greps + clean-tree run.