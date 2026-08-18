# Feature: Line Ranges (`#@<path>:N` / `#@<path>:N-M`)

> Adds an **optional line-range suffix** to the `#@` file trigger: `#@path:N` delivers only line `N`; `#@path:N-M` delivers lines `N` through `M`, inclusive (1-indexed). The slice flows through the existing file machinery — same `<file>` block format, same green `read` line (now carrying a `:N`/`:N-M` suffix), same budget/paging rules, same markdown import scanning, same verbatim prompt (§6.4). This document specifies the range half and pins its requirements **LR-1 … LR-7** (§10); the whole-file behavior (§4–§6) is unchanged unless explicitly noted.

## 1. Overview & scope

| Token | Meaning | Delivered |
|---|---|---|
| `#@<path>` | whole file — unchanged | §5 |
| `#@<path>:N` | single line | line `N` only |
| `#@<path>:N-M` | inclusive span | lines `N` through `M` |

**Why.** Most `#@` use against large files wants a *window* of them — the hunk under review, the struct at line 40, the changelog entry. Today the user falls back to the `read` tool for that; the range suffix keeps the at-submit, no-round-trip delivery of `#@` for slices.

**In scope:** text and markdown files (a markdown slice is itself scanned for imports — §4 below); dedup identity per **path + range**; the §5.5 budget/paging decision applied to the slice; user feedback for ranges that cannot deliver.

**Out of scope (rejected):**
- **Open-ended `:N-`.** A range must be closed. An open suffix collides with the paged-resume display (`read path:N-`, §6.3), and hides off-by-one typos. `#@a.ts:5-` is not a range token — it resolves as the literal path `a.ts:5-` (which normally fails → verbatim).
- **Character/byte offsets or column ranges.** `:N`/`:N-M` select whole lines only.
- **Ranges on the URL trigger.** `#<url>` (§15) has no line semantics; a `:8080` in a URL is part of the URL. Range parsing never runs on URL tokens.
- **Ranges on images/binaries.** They have no line semantics, so the range is *ignored* — but it must not fragment dedup or duplicate bytes (LR-2).

## 2. Grammar & parsing

The suffix is parsed **after** §4.3 trailing-punctuation trimming, on the cleaned token, anchored at the end:

```ts
const LINE_RANGE_RE = /:(\d+)(?:-(\d+))?$/;
```

1. **Trim first** (§4.3): `#@a.ts:2.` → token `a.ts:2` → range `:2`. Because `:` is itself a trim char, a bare trailing colon (`#@a.ts:`) trims to `a.ts` — whole file, no range.
2. **Validate:** `start ≥ 1`; `end` defaults to `start` (bare `:N` ≡ `:N-N`); `end ≥ start`. A token whose suffix fails validation (`:0`, `:5-3`) is **not** treated as a range — the full token falls back to literal-path resolution (which normally fails → verbatim; see LR-3 for the required notify).
3. **Canonical form:** `:N-N` normalizes to `:N` everywhere (claim key, `FileDetail.range`, display).
4. **Exact path wins:** resolution tries the **full token including the suffix** first. Only if that fails is the suffix stripped and the prefix re-resolved with the range attached. A file literally named `a.ts:10` therefore resolves as-is, whole — no range. (Predictable precedence; a colon-digits filename is never silently reinterpreted.)
5. **Markdown shorthand interaction:** the *stripped* path goes through the normal ladder — `#@PRD:3` inside markdown resolves `PRD` → `PRD.md`/`PRD.markdown` (§4.5 rule 3); top-level stays exact-only (§4.4).

## 3. Resolution & dedup

**Retry ladder (per token, after §4.3 trim):**

1. `resolveImportPath(token, …)` — exact, suffix included.
2. If unresolved: parse the suffix (§2.2). If valid, `resolveImportPath(strippedPath, …)`; on success attach `startLine`/`endLine`.
3. Still unresolved → verbatim (LR-3 may add a notify).

The §4.5 relative-only guard re-runs on the **stripped** path (a markdown import `#@/etc/hosts:10` is ignored just like `#@/etc/hosts`).

**Claim keys (LR-7 — implemented, pinned):** dedup keys on the *resolved* abs plus the *canonical* range:

| Claim | Key | Collapses with |
|---|---|---|
| whole file | `abs` | `#@a.ts`, `#@./a.ts`, an import of `a.ts` |
| ranged | `abs:N` or `abs:N-M` | `#@a.ts:10` and `#@a.ts:10-10` (same key) |

- **Distinct ranges are distinct claims:** `#@a.ts:10 #@a.ts:20` → two blocks; `#@a.ts:10 #@a.ts:10` → one.
- **Range and whole coexist:** `#@a.ts:10 #@a.ts` → slice block *and* whole-file block. The whole-file claim does not satisfy a ranged token or vice versa (they deliver different bytes).
- **Claim by type (LR-2 — normative, fixes verified gap):** the dedup key is chosen by *classification*, not by the token. Images and binaries claim the **bare `abs`** — a range is not part of their identity. Rationale: identical bytes must never be delivered twice; the current implementation claims `abs:range` before classifying, so `#@pic.png #@pic.png:3` attaches the **same image twice** and `#@data.bin #@data.bin:5` emits two identical binary notes. Required: on classification image/binary, the effective claim is the bare `abs`; if that key is already claimed, the token is left verbatim (dedup) — never a duplicate attachment. (Implementation shape: claim with the range key for recursion-readiness before read, then normalize/add the bare key once classified, backing out if the bare key collides.)

## 4. Slicing semantics (per file type)

**Line semantics.** `sliceLines(content, N, M)` splits the decoded UTF-8 text on `\n`; a single trailing final newline does **not** create an extra empty line (matches `wc -l` / editor counts — a 3-line file with trailing `\n` has exactly 3 lines). Lines are 1-indexed, inclusive. CRLF content keeps its `\r` (bytes are preserved verbatim within the slice; §6.4).

**Text files (§5.1):** the decoded content is first sliced to the range; everything downstream (budget decision §5.5, block format §6.1) applies to the slice.

**Markdown (§5.6 — LR-6, implemented, pinned):** the delivered body is the slice, and the **import scan runs on the slice** — import discovery matches exactly what the model sees. `#@notes.md:2` where the import sits on line 2: import resolved. `#@notes.md:1`: not. The parent claims its `abs:range` key. A whole-file token of the same markdown is a separate claim; shared imports dedup normally through the global set.

**Images / binaries (§5.2/§5.3):** range ignored (LR-2). One attachment/note per file, claimed bare.

**Empty/edge slices:** `end` past EOF clamps to the file's last line (`:2-100000` on a 5-line file → lines 2–5). A `start` past EOF yields an empty slice — which MUST NOT be delivered as an empty block; see LR-4.

## 5. Budget & paging on slices — LR-1 (normative; fixes verified gap)

**The §5.5 inline-vs-paged decision applies to the sliced content, not only to whole files.** Compute `fileCost = Math.ceil(slice.length / 4)` on the **slice** and decide against the shared running `remaining` exactly as for a whole file:

- fits (or `remaining === null`, O-1 fallback) → inject the slice whole;
- exceeds `PAGED_THRESHOLD · remaining` → **page the slice**: head block (first `HEAD_CHARS` of the slice) + directive; the directive's resume offset is in **file coordinates** — `resumeLine = startLine + complete-lines-in-slice-head` — so the model's `read` continues at the correct absolute line of the original file;
- the §5.5 sub-head guard applies to the slice (a slice that fits `HEAD_CHARS` injects whole even if the threshold tripped);
- a paged slice counts in `state.paged` and the `N whole, M paged` notify like any paged text.

**Why (gap being fixed).** "A range is a deliberate extract" justifies *not forcing the model to page past the range end* — it does not justify suspending overflow protection *within* the range. The current implementation injects the slice whole unconditionally: under a budget where `#@huge.log` (1.83 MB) correctly pages, `#@huge.log:1-999999` delivers the full 1.83 MB inline (~457K estimated tokens against a 50K window), even at 98% budget utilization, and a typo'd end value silently disables the safety valve. A bounded selection must degrade exactly like a whole-file token.

## 6. Failure feedback & honest display — LR-3, LR-4, LR-5 (normative; fix verified gaps)

The extension already owns a status-notify channel (§5.5 Notify; §15's spinner/notify). A user who typed an explicit range has explicit intent; silence is the wrong answer when nothing is delivered.

- **LR-3 — malformed ranges are not silent.** A cleaned token whose trailing suffix matches `:\d+(-\d+)?` but fails validation (`:0`, `:5-3`), and which resolves to no file, is left verbatim (current behavior) **and** reports a hasUI-guarded warning notify, e.g. `#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)`. Today these tokens vanish with zero feedback.
- **LR-4 — a start past EOF is a failed token, not an empty block.** `#@a.ts:99` on a 5-line file MUST NOT deliver an empty `<file>` block (current behavior: empty block, `injected=1`, a `read a.ts:99` line). Leave the token verbatim, revoke the claim (claim ⟺ delivered, §12.5), and notify `#@a.ts:99 — not injected (file has 5 lines)`. Mirrors the `read` tool, which errors on past-EOF rather than returning nothing. A clamped **end**, by contrast, still delivers (the intersecting lines) — clamping a typo'd end is recovery, not failure.
- **LR-5 — display shows what was delivered.** When `end` clamps, `FileDetail.range` and the collapsed read line show the **clamped** range: `read a.ts:2-5` for `#@a.ts:2-100000` on a 5-line file (display and delivery agree). Showing the requested-but-undelivered range misleads both user and model.

## 7. Chat display (extends §6.3)

A ranged text slice renders through the normal read-line with the range suffix in the existing `range` slot: `read a.ts:10` / `read a.ts:10-15` (warning color, read-tool parity). Paged slices render like paged text (`read huge.log:<resumeLine>-`). No suffix on image/binary lines (LR-2 — the range is ignored there). The prompt stays verbatim (`#@a.ts:10` unstripped — §6.4), so re-open/fork/re-submit re-triggers identically.

## 8. Edge cases (extends §10)

| Case | Expected behavior |
|---|---|
| `#@a.ts:3` | Line 3 only; `read a.ts:3`; prompt verbatim. |
| `#@a.ts:2-3` | Lines 2–3 inclusive; `read a.ts:2-3`. |
| `#@a.ts:2.` | Trim first → line 2 (§2.1). |
| `#@a.ts:0` / `#@a.ts:5-3` | Not a range; literal fallback fails → verbatim **+ warning notify** (LR-3). |
| `#@a.ts:99` (5-line file) | Verbatim, no block, claim revoked, **notify** (LR-4). |
| `#@a.ts:2-100000` (5-line file) | Lines 2–5 delivered; displayed `read a.ts:2-5` (LR-5). |
| `#@empty.txt:1` | Past-EOF on a 0-line file → verbatim + notify (LR-4). |
| `#@a.ts:10` and `#@a.ts:10-10` | Same canonical key → one block (LR-7). |
| `#@a.ts:2 #@a.ts:3` / `#@a.ts:2 #@a.ts` | Two blocks / slice + whole (LR-7). |
| `#@pic.png:3` / `#@data.bin:5` (+ bare twin) | Range ignored; ONE image/note; bare-path claim (LR-2). |
| `#@huge.log:1-999999`, tight budget | Slice pages: head + directive, `resumeLine` in file coordinates (LR-1). |
| `#@notes.md:2` (import on line 2) | Import resolved — scan runs on the slice (LR-6); `:1` → not. |
| `#@PRD:3` inside markdown | Shorthand ladder on the stripped path → `PRD.md:3`-style slice. |
| Literal file `a.ts:10` exists | Exact wins — whole literal file, no range (§2.4). |
| `#https://x/y` / URL tokens | Unaffected — ranges never run on URL tokens (§1). |

## 9. Acceptance tests (extends §11)

Manual-matrix rows are added to §11 (#43–#47). Automated: `file-injector.test.mjs` carries `LINE-1 … LINE-6` (slice basics, trim, unit helpers, `scanTokens` shape, dedup matrix) — **already passing**; `LINE-7 … LINE-12` are required once LR-1/LR-2/LR-3/LR-4/LR-5 land:

| ID | Covers | Asserts |
|---|---|---|
| LINE-7 | §2.4 | Literal `a.ts:10` file → exact wins, no range |
| LINE-8 | LR-1 | Tight budget: `#@huge.log:1-999999` → `kind:"paged"`, head + directive, file-coordinate resume |
| LINE-9 | LR-2 | `#@pic.png #@pic.png:3` → ONE `images` entry; binary twin → one note |
| LINE-10 | LR-3 | `#@a.ts:0` → `injected:0`, verbatim, warning notify fired |
| LINE-11 | LR-4 | `#@a.ts:99` → no block, no empty body, claim released, notify fired |
| LINE-12 | LR-5 | `:2-100000` → `details[0].range === ":2-5"` |

## 10. Requirement & gap register

| ID | Requirement | Status at spec time (commit `5c1434e`) |
|---|---|---|
| LR-1 | Slice goes through the §5.5 budget/paging decision | **Gap** — verified: 1.83 MB slice injected whole under a budget that pages the whole file |
| LR-2 | Image/binary claim the bare `abs` (no duplicate bytes) | **Gap** — verified: `#@pic.png #@pic.png:3` attaches the identical image twice |
| LR-3 | Warning notify on malformed ranges | **Gap** — silent verbatim today |
| LR-4 | Past-EOF start → verbatim, no empty block, notify | **Gap** — empty block, `injected=1`, `read a.ts:99` line today |
| LR-5 | Display the delivered (clamped) range | **Gap** — shows the requested `:2-100000` |
| LR-6 | Markdown import scan runs on the slice | OK |
| LR-7 | Canonical claim keys (`:N` ≡ `:N-N`); distinct-range dedup | OK |

Code-quality note (non-normative): when landing LR-1, unify the cost/lines/push/subtract quadruple in `emitText` (three near-identical copies after the range branch) rather than adding a fourth.

## 11. Integration with the spec (merge points)

| Spec part | Change |
|---|---|
| §2 Goals | Goal 1 mentions the range suffix; Non-Goals exclude char/column/open-ended ranges |
| §4.1 Grammar | Optional suffix in the grammar block |
| §5.1 / §5.5 | Slice before the budget decision; decision applies to the slice (LR-1) |
| §5.6 Step 3 | Scanned content is the slice (LR-6) |
| §6.2 / §6.3 | `FileDetail.range` dual meaning; read-line suffix |
| §10 / §11 | Edge rows + acceptance rows #43–#47 |
| §12 | Gotcha note (range claims, slice budget, feedback) |

---