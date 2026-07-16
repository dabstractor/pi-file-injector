# Research Notes — P1.M1.T2.S1 (Plan 002: Paged Delivery)

**Work item:** Update README.md Why, What-gets-injected, Limits, and `#@`-versus-`@` sections for paged delivery
**Plan:** `002_0ac3eb160af7` (Paged Delivery for Oversize Files, PRD §5.5)
**Target file:** `./README.md` ONLY (Mode B — this IS the changeset-level doc sync). No code, no tests.
**Change:** 5 surgical exact-text replacements across 4 sections (the contract's edit "a" spans L3 + L9).

All facts below are **empirically verified** by applying all 5 edits to a temp copy of the real
README and diffing — the resulting diff is exactly 5 changed lines (L3, L9, L41, L72, L83), nothing
else. The complete change set is reproduced in §6.

---

## 1. What the README must reflect (the paged-delivery behavior from P1.M1.T1)

P1.M1.T1.S1–S3 (the parallel/sibling chain) implements PRD §5.5:
- A text file is injected **whole** when it fits the model's remaining context budget; otherwise it is
  **paged** — a head block (first `HEAD_BYTES = 8192` ≈ 8 KB ≈ 2000 lines) plus a directive block that
  instructs the model to read the rest via the `read` tool at `offset:0, limit:2000`, incrementing.
- The budget is derived from the active model's context window + current usage — **no user-facing config**.
- The model never holds a file larger than its context window all at once (a property of the medium).
- Handler notify (T1.S3): `#@ injected N whole, M paged` when `paged > 0`, else the existing
  `#@ injected N file(s)` style.

**The honest contract (PRD §13.1):** "the whole file always reaches the model — injected inline when
it fits, paged through the `read` tool when it does not." The README's old "no size limit / no
truncation / No size gate" framing was the *retracted* framing and is now factually stale.

---

## 2. The exact current README state (verified — 83 lines, 3647 bytes)

Section headers (line numbers): `1 # #@file`, `5 ## Why`, `11 ## Install`, `19 ## Usage`,
`37 ## What gets injected`, `56 ## Syntax`, `70 ## Limits`, `78 ## #@ versus @`.

**The 5 stale anchors the contract targets** (verified unique; exact bytes via `cat -A`):

| # | Line | Exact current text (anchor) |
|---|------|------------------------------|
| a1 | L3 | `…The file reaches the model before it replies, with no size limit and no configuration.` |
| a2 | **L9** (contract said "L7-9" — imprecise; the target text is on L9) | `` `#@` always injects the entire file, in every context: the editor, a `pi -p` one-shot, and RPC. You write it, the file goes in. `` |
| b | L41 | `` \| Text (`.ts`, `.md`, `.json`, `.log`, etc.) \| Entire contents injected, no truncation. \| `` |
| c | L72 | `` - **No size gate.** `#@` on a 50 MB file injects 50 MB and can overflow the model's context. For large files, use Pi's `read` tool with `offset` and `limit`. `` |
| d | L83 | `` Use `#@` when you want all of a file. Use `@` or the `read` tool when you want part of a file or a size limit. `` |

**CRITICAL:** the contract's line references are imprecise (it called the L9 paragraph "L7-9"). Use
**exact-text anchors**, not line numbers — the same rule the sibling PRPs (e.g. P1M1T1S3) enforce.

### Stale-term sweep (verified — every stale occurrence is covered)

`grep -nEi "size|truncat|entire file|limit" README.md` before edits yields: L3 (`no size limit`),
L9 (`always injects the entire file`), L41 (`no truncation`), **L50** (`<entire file contents>` — code
sample, INTENTIONALLY LEFT, see §4), L70 (`## Limits` header — keep), L72 (`No size gate`), L83
(`a size limit`). After the 5 edits, the only remaining matches are the intentional ones (L50 code
sample, L70 header, and the NEW paged-delivery phrasing). Verified: no stale claim survives.

---

## 3. README markdown conventions to PRESERVE (verified by inspection)

These are the load-bearing style facts — the contract's prose quotes drop them, so the implementer
must re-apply them. (Precedent: sibling PRP P1M1T1S3 rendered the contract's "(2000x2000)" as the
file's "2000×2000" convention.)

- **Inline-code backticks:** the README wraps every `#@`, `@`, `@file`, `pi -p`, `read`, `offset`,
  `limit`, and file extension (`.ts`, etc.) in backticks. → The contract's plain "read tool" /
  "#@ always delivers" / "pi -p" MUST be rendered as `` `read` `` / `` `#@` `` / `` `pi -p` `` to match.
- **Apostrophes are STRAIGHT ASCII** (`'`, 0x27) — verified: `model's` on L72 is straight `'`, NOT the
  curly U+2019. → The new "doesn't" (edit a1) MUST use a straight `'`. (First temp-copy run
  accidentally used a curly apostrophe — caught and fixed.)
- **Em dashes are U+2014** (`—`) — verified (`cat -A` shows `M-bM-^@M-^T`). → New text "directive — the
  model" / "at once — that is" uses U+2014, NOT a hyphen `-` or en dash `–`.
- **Table format:** `| File | Result |` header + `|---|---|` separator + 4 data rows. The Text row
  (L41) gets longer but stays a single markdown table line (tables support long cell content). The
  other 3 rows + the header are unchanged.

---

## 4. What is deliberately NOT changed (scope boundary)

- **The `<file>` block code sample (L48–52)** — `` <file name="/abs/path/to/file.ts">\n<entire file contents>\n</file> ``.
  Still ACCURATE: files that fit the budget are injected whole in exactly this format (the common
  path). The contract edit (b) scopes to the TABLE row only; the code sample is not mentioned. Leave it.
- **Install, Usage, Syntax** sections — explicitly out of scope ("No other README sections change").
- **The "## Limits" header (L70)** and the other 3 Limits bullets (no spaces / no directories / no
  globs / backtick) — unrelated to paging; only the "No size gate" bullet (L72) changes.
- **`file-injector.ts` / `file-injector.test.mjs`** — owned by the parallel P1.M1.T1 chain (S1–S3).
  This task is README-only; no collision (disjoint file).

---

## 5. Validation approach (no test framework, no markdownlint)

- The repo has **no test framework, no linter, no markdownlint** (package.json has zero dependencies;
  `command -v markdownlint` finds nothing). Like the code tasks, validation is **grep-based +
  diff-based**.
- The PRIMARY gate is a 3-part grep sweep on the edited README: (1) all 5 NEW phrases present;
  (2) all stale phrases GONE; (3) markdown structure intact (headers + table rows still present).
- The gold-standard check is `diff` of the result against the pre-verified temp copy in §6 — it must
  show exactly the 5 changed lines.

---

## 6. The complete, pre-verified change set (the authoritative oldText → newText)

Verified by applying to `/tmp/README.paged2.md` and `diff README.md /tmp/README.paged2.md` → exactly
these 5 line changes, exit 1 (differ), no other lines touched. Em-dashes are U+2014; the apostrophe in
"doesn't" is straight ASCII `'`.

```
L3:
- …The file reaches the model before it replies, with no size limit and no configuration.
+ …The file reaches the model before it replies, the whole file always reaches the model — injected whole when it fits the remaining context, paged via the `read` tool when it doesn't — with no configuration.

L9:
- `#@` always injects the entire file, in every context: the editor, a `pi -p` one-shot, and RPC. You write it, the file goes in.
+ `#@` always delivers the entire file to the model, in every context: the editor, a `pi -p` one-shot, and RPC. When the file fits the remaining context it is injected whole; when it exceeds the budget it is delivered as a head block plus a paging directive that the model reads through.

L41:
- | Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected, no truncation. |
+ | Text (`.ts`, `.md`, `.json`, `.log`, etc.) | Entire contents injected when they fit remaining context. Oversize files are delivered as a head block plus a paging directive — the model reads the rest via the `read` tool. Never silently truncated. |

L72:
- - **No size gate.** `#@` on a 50 MB file injects 50 MB and can overflow the model's context. For large files, use Pi's `read` tool with `offset` and `limit`.
+ - **No size knob.** `#@` has no user-facing size setting. Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive; the model reads the rest via the `read` tool. The model never holds a file larger than its context window all at once — that is a property of the medium, not of this extension.

L83:
- Use `#@` when you want all of a file. Use `@` or the `read` tool when you want part of a file or a size limit.
+ Use `#@` when you want all of a file. Use `@` or the `read` tool when you want to browse or search without loading the whole file.
```

**Note on edit a1:** the contract specifies a verbatim *phrase swap* ("with no size limit and no
configuration" → "the whole file always reaches the model — … — with no configuration"). The resulting
L3 sentence reads "The file reaches the model before it replies, the whole file always reaches the
model — …" (the phrase "reaches the model" appears twice). This is mildly redundant but is exactly
what the contract prescribes; apply it verbatim — do NOT silently reword it (that would deviate from
the contract and is out of scope for this doc-sync task).
