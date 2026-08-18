# Delta PRD — Line-Range Gap Closure (LR-1 … LR-5)

**Status:** Draft · **Base:** PRD snapshot in `plan/011_e473dac8178b/prd_snapshot.md` vs previous session's PRD (session 010, URL injection — Complete) · **Code verified at HEAD `ef57bd0`**

## 1. Diff analysis (what actually changed)

The delta between the previous PRD and the current PRD is **two areas**, with very different implementation states:

### A. Line Ranges (`#@<path>:N` / `#@<path>:N-M`) — NEW feature spec + main-spec merge points → **PARTIALLY IMPLEMENTED, 5 verified gaps remain**

The current PRD adds a full feature spec (`spec/17-line-ranges.md`, already written and synced — verified identical to the PRD's feature section) plus merge-point text across the main spec (§2 Goal 1 + new Non-Goal, §4.1 grammar, §5.1/§5.5/§5.6 Step 3 slice semantics, §6.2 `FileDetail.range` dual meaning, §6.3 collapsed-line suffix, §10 edge rows, §11 rows #43–47, §12 note 26 — **all already present in `spec/`; no spec-writing work is in scope**).

Code state at HEAD (`ef57bd0`): the basics shipped in commits `5c1434e`/`99e82a5`/`ef57bd0` — `splitLineRange` (L172), `sliceLines` (L183), `claimKey` (L192), `scanTokens` range carriage (L1140–1186), `injectFile` range params (L1219+), `emitText` range branch (L1282), display suffix, and tests **LINE-1…LINE-6 passing** (`file-injector.test.mjs` L2969–3031). Per the spec's own gap register (§10, spec time commit `5c1434e`) — re-verified against HEAD — the requirements below are **still open**:

| ID | Requirement | Verified gap at HEAD |
|---|---|---|
| **LR-1** | The slice goes through the §5.5 budget/paging decision | `emitText` range branch (L1282–1294) comment says *"Closed ranges are intentional extracts: always inject the slice whole (no paging past the range)"* — the slice bypasses the budget decision entirely. A typo'd `:1-999999` on a 1.83 MB file delivers ~457K est. tokens inline against a 50K window. |
| **LR-2** | Images/binaries claim the **bare `abs`** (no duplicate bytes) | `injectFile` claims `claimKey(abs, startLine, endLine)` (L1235) for **all** types before classification. `#@pic.png #@pic.png:3` claims `abs` and `abs:3` → the **same image attached twice**; binary twin emits two identical notes. |
| **LR-3** | Malformed ranges (`:0`, `:5-3`) are not silent | `splitLineRange` returns `{path: token}` for invalid suffixes (indistinguishable from "no suffix") → literal fallback fails → verbatim with **zero feedback**. No notify anywhere. |
| **LR-4** | A start past EOF is a failed token, not an empty block | `sliceLines` returns `""` when `start > lineCount`; `emitText` pushes an **empty `<file>` block**, `count++`, claim stays, a `read a.ts:99` line renders. |
| **LR-5** | Display shows the delivered (clamped) range | `rangeSuffix` is built from the **requested** `startLine/endLine`; `:2-100000` on a 5-line file displays `read a.ts:2-100000` while delivering lines 2–5. |

LR-6 (markdown import scan runs on the slice) and LR-7 (canonical claim keys, `:N` ≡ `:N-N`) are **OK at HEAD** — no work.

### B. URL-spec refinements — **ALREADY IMPLEMENTED at HEAD; awareness only, NO tasks**

The current PRD also updates the URL half (`spec/15-url-injection.md`): the `CODE_EXTENSIONS` deny-list for `#word.ext` tokens (§2.3), `application/xhtml+xml` + sniff-only-when-Content-Type-unknown dispatch (§3.1), and the new §3.6 download-feedback footer spinner (`!file-injector` status key, `onUrlFetch` hook). All of this is **in the code and tested** — verified: `CODE_EXTENSIONS` L44–56 + gate at L1505–1516 (commits `32c9456`, `b8aeac0`), dispatch fix L933–960 (commit `46dc0b6`, tests DIS-1b/`text/xml`), spinner + `onUrlFetch` L1428/L1521/L1577–1652, regression tests COL-4/BUG1-* in `url-injection.test.mjs`, README deny-list docs (commit `1757a27`). Do not re-implement; do not regress (the existing suites guard it).

**This delta PRD therefore covers exactly one thing: closing LR-1…LR-5, their regression gates (LINE-7…LINE-12), and the README sync.**

---

## 2. Scope delta — requirements

All changes are in **`file-injector.ts`** (HEAD: 1790 lines), **`file-injector.test.mjs`**, and **`README.md`**. The `spec/` directory is already synced to the current PRD — no spec edits. Prior research in `plan/010_8645157f3bf5/architecture/` (code_map conventions, system_context) remains valid for the surrounding machinery; line numbers cited here were re-verified at HEAD.

### R1 — LR-1 + LR-5: slice budget/paging & honest display (`emitText` range branch)

Rewrite the `emitText` (L1282–1294) range branch so the sliced content flows through the **same §5.5 decision** as a whole file:

- Compute `fileCost` on the **slice**; if `remaining === null` or it fits `PAGED_THRESHOLD · remaining` → inject the slice whole (current behavior). Sub-head guard applies to the slice.
- Otherwise **page the slice**: head block (first `HEAD_CHARS` of the slice) + directive whose resume offset is in **file coordinates** — `resumeLine = startLine + complete-lines-in-slice-head` — so the model's `read` continues at the correct absolute line. Detail becomes `kind: "paged"` with `range: ":<resumeLine>-"`; `state.paged++`.
- **Clamp the displayed range** (LR-5): when `end` exceeds the file's last line, `FileDetail.range` and the read line show the delivered range (`:2-5`, not `:2-100000`). Clamping detection comes free from the slice: delivered last line = `startLine + (newlines in slice)`.
- **Code-quality (normative, spec §10 note):** unify the cost/lines/push/subtract quadruple in `emitText` instead of adding a fourth near-identical copy (there are already three).
- Markdown ranged slices already pass `startLine/endLine` through `injectMarkdown` (L1271) — the paged decision applies to the sliced markdown body identically; the import scan stays on the slice (LR-6, already OK).

**Mode A docs:** JSDoc on `emitText` — replace the "Closed ranges are intentional extracts … no paging" comment with the LR-1 contract (slice runs the §5.5 decision; paged-slice directives resume in file coordinates; clamped display). Rides with the work.

### R2 — LR-2: claim-by-classification for images/binaries (`injectFile`)

`injectFile` (L1233–1236) currently claims `claimKey(abs, startLine, endLine)` before classification. Change per the spec's stated implementation shape:

- Keep the pre-read claim with the **range key** (recursion-readiness, unchanged).
- Once classified **image or binary** (all three branches: empty-image F5, real-image F3, binary note), the effective claim is the **bare `abs`**: if `injectedSet` already contains the bare `abs`, this token is a duplicate → emit nothing (leave verbatim, no count bump); otherwise add the bare key (the ranged key may remain alongside harmlessly, or be normalized). Never attach the same bytes twice.
- Text/markdown keep claiming `abs:N` / `abs:N-M` (distinct ranges are distinct deliveries; unchanged).
- Docs: **Mode A** — JSDoc on `injectFile` claim semantics ("claim ⟺ delivered; images/binaries claim the bare abs — a range is meaningless identity for them"). Rides with the work.

### R3 — LR-3 + LR-4: failure feedback (malformed & past-EOF ranges)

- **LR-3 (malformed):** make the invalid-suffix case distinguishable from "no suffix" — e.g. `splitLineRange` gains an `invalid?: boolean` marker (or a sibling probe used only by `scanTokens`). When a token's suffix matched `:\d+(-\d+)?` but failed validation (`:0`, `:5-3`) **and** the literal fallback resolves to no file, fire a hasUI-guarded warning notify, e.g. `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`, and leave the token verbatim (existing behavior). The notify must NOT fire for tokens with no range-looking suffix or for valid ranges that resolve.
- **LR-4 (past-EOF start):** an empty slice means a failed token. Detection: `startLine > line count of the file` (a valid start always yields ≥1 line; a 0-byte file has 0 lines, so `#@empty.txt:1` is also past-EOF). Behavior: **no block, no detail, no count bump**; revoke the claim (claim ⟺ delivered, §12.5 — same pattern as the existing catch at L1286); notify `#@a.ts:99 — not injected (file has 5 lines)` (hasUI-guarded). A clamped **end** still delivers (clamping is recovery, not failure).
- Where: past-EOF is knowable at slice time — either in `emitText` (signal failure upward so `injectFile` skips its `count++` and un-claims) or before emission in `injectFile`'s text branch. The exact seam is the implementer's choice, but the contract is: **empty delivered slice ⟹ verbatim + revoked claim + notify**, mirroring how the URL SPA fallback notifies (guarded `ctx.ui?.notify`, `ctx.hasUI`).
- Docs: **Mode A** — JSDoc on `splitLineRange` (invalid marker) and the notify strings. Rides with the work.

### R4 — Regression gates: LINE-7 … LINE-12 (spec §17.9 / PRD §11)

Add to `file-injector.test.mjs` (same harness/pattern as LINE-1…6 at L2969–3031; notify assertions follow the `ui: { notify: (m, t) => notes.push(...) }` spy pattern already used in `url-injection.test.mjs` L703):

| ID | Covers | Asserts |
|---|---|---|
| LINE-7 | §2.4 exact-path-wins | Literal file `a.ts:10` exists → exact wins, whole literal file, no range |
| LINE-8 | LR-1 | Tight budget (mock `getContextUsage` low remaining): `#@huge.log:1-999999` → `kind:"paged"`, head + directive, resume in file coordinates |
| LINE-9 | LR-2 | `#@pic.png #@pic.png:3` → ONE `images` entry; binary twin → one note |
| LINE-10 | LR-3 | `#@a.ts:0` → `injected:0`, verbatim, warning notify fired |
| LINE-11 | LR-4 | `#@a.ts:99` (5-line file) → no block, no empty body, claim released (a repeat token still injects), notify fired |
| LINE-12 | LR-5 | `:2-100000` (5-line file) → `details[0].range === ":2-5"` |

Also keep every existing suite green: `npm test` (4 files) and `npm run typecheck`.

Docs: **Mode A** — none (tests are self-documenting).

### R5 — Mode B: sync changeset-level documentation (README)

`README.md` L127–130 documents the line-range feature but **contradicts LR-1**: L128 says "Closed ranges inject whole (no paging past the selection)." Final task, depends on R1–R4:

- Replace that sentence with the honest contract: a range runs the same budget decision as a whole file — under a tight budget the slice arrives as head + paging directive (resume in file coordinates); it is never silently truncated.
- Document failure feedback: malformed (`:0`, `:5-3`) and past-EOF starts are left verbatim with a warning notify (never an empty block).
- Document clamped display (`read a.ts:2-5` for `:2-100000`) and the image/binary bare-path dedup (a range on an image/binary is ignored and never duplicates the bytes).
- Do not touch the `#@file` / `#<url>` README sections (deny-list docs already shipped, commit `1757a27`).

---

## 3. Reference to completed work (do not re-implement)

- **Line-range basics** (grammar, slicing, claim keys, display suffix, LR-6/LR-7, LINE-1…6): shipped — reuse `splitLineRange` / `sliceLines` / `claimKey` / the `scanTokens` range carriage as-is except where R1–R3 modify them.
- **URL feature + all URL-side deltas** (deny-list, dispatch fix, spinner, `onUrlFetch`, corpus suite): shipped and tested (session 010 + commits `32c9456`…`65c9981`). Awareness only.
- **Verbatim-prompt / claim⟺delivered / budget-accumulator patterns**: established in sessions 008–010 — extend them; do not invent new seams.

## 4. Suggested breakdown shape

One phase, two milestones, ~4 tasks (small, focused):

- **P1.M1.T1** — LR-1 + LR-5 in `emitText` (R1), incl. quadruple unification + JSDoc.
- **P1.M1.T2** — LR-2 claim-by-classification in `injectFile` (R2) + LR-3/LR-4 failure feedback (R3).
- **P1.M2.T1** — LINE-7…LINE-12 regression gates + full `npm test`/typecheck green (R4).
- **P1.M2.T2** — README sync (R5; Mode B — depends on all above).

**Done-definition:** all five gaps closed per spec `spec/17-line-ranges.md` §10 (LR-1…LR-5 flip to OK); LINE-1…LINE-12 pass; `npm test` (4 suites) and `npm run typecheck` green; existing URL/file/import behavior byte-for-byte unchanged (their suites guard it); README no longer claims ranges never page.