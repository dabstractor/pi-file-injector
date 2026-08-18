# Research notes — P1.M4.T1.S1 (README.md changeset sweep: Limits, URLs, Syntax, Usage)

Verified at HEAD `3c0bb5d` (BUG-004 landed) on 2025 snapshot. README.md working tree == HEAD (not in `git status`).

## 1. Changeset state (which riders already landed in README)

`git log --oneline -- README.md` → the ONLY changeset-era README commit is `fe766bd` (BUG-003
Images rider). Older commits (1e9346d line-range paging, etc.) predate the bug report (`ccb1162`).

- BUG-001 (3 subtasks, commits 21bf4fa / c626928 / 71e9f45): no README rider — by design
  (P1M1T1S3 PRP: "README untouched … existing expanded-view description stays accurate post-fix").
- BUG-002 (plan: Complete): **its Mode-A README rider is NOT in README at HEAD.**
  `grep -n -i "malformed" README.md` → only line 179 ("a missing or malformed source" — the
  config-json sentence, unrelated). No sentence anywhere documents the LR-3 malformed-range
  warning (top level or markdown-level). → this sweep must ADD it.
- BUG-003 (commit fe766bd): Images rider present at README :82–84 ("An image URL whose body /
  comes back empty (0 bytes) attaches nothing — it delivers the same "empty image file — 0 bytes"
  note a 0-byte local image does."). Coherent in context. Verify only.
- BUG-004 (commit 3c0bb5d, P1.M3.T4.S1 PRP): NO README change required — PRP's consumed_by line
  says "NO autocomplete README change from this task; :210/:221 are already accurate". Verify only.
- BUG-005 (P1.M3.T5.S1, still Planned): PRP explicitly defers the ftp Limits bullet to THIS task
  ("the ftp Limits bullet lands THERE, not here"). Plan chose Option A: extend URL_SHAPE_RE to
  `(https?|ftp)`, sync the :1715 normalization site, correct spec/15 §7. Post-fix semantics:
  `#ftp://example.com/x` passes the shape gate → normalization keeps `ftp://…` intact →
  onUrlFetch spinner fires → `fetch` throws (undici has no ftp) → catch → verbatim.
  ⇒ README sentence must say: explicit schemes other than http(s):// are not fetched and are
  left as written (gate accepts, Node fetch cannot retrieve).

## 2. README line map — item description (old, pre-rider) vs verified HEAD (223 lines)

Riders shifted lines by +2 after `### URLs`. Grep patterns are authoritative; line numbers are HEAD state.

| Item description's anchor | Old line | Verified HEAD line | Grep pattern (authoritative) |
|---|---|---|---|
| `## Usage` | :31 | :31 | `^## Usage` |
| expanded-view description | :44–46 | :50 | `On submit, each file shows up` |
| `### URLs` | :52 | :52 | `^### URLs$` |
| URLs green-read line | :61 | :62 | `Both \`#example.com\`` |
| URLs Images bullet (BUG-003 rider) | :82 | :82–84 | `comes back empty (0 bytes)` |
| autocomplete sentence | :94 | :96 | `Path completion works in the editor` |
| `## What gets injected` | :98 | :100 | `^## What gets injected` |
| `## Syntax` | :121 | :123 | `^## Syntax` |
| Line-range paragraph | :126–134 | :127–130 | `\*\*Line range\.\*\*` |
| Markdown imports rules | :136–149 | :142–148 | `\*\*Markdown imports:\*\*` |
| `## Limits` | :198 | :200 | `^## Limits` |
| URL bullets (timeout…never page) | :209–214 | :211–215 | `URLs: 20 s fetch timeout` … `URLs never page` |
| hostname bullet | :211 | :216 | `URLs need a dotted, alphabetic hostname` |
| `## #@ versus @` | :216 | :218 | `^## #@ versus` |

## 3. Exact current text of the two edit targets (for precise `edit` oldText matching)

### :216 hostname bullet (single physical line; opening excerpt)

```
- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://` URL **or** a bare host whose final label is 2+ letters (e.g. `example.com`, `api.example.co.uk`). This rejects `#3.14`, `#v1.2`, `#fff` and other token-like text. …
```
(continues through the code-extension deny-list explanation, `#https://foo.sh`, the raw-IP/localhost
side effect, ending with "… rather than an IP or `localhost`.")

### :127–130 Line range paragraph (4 hard-wrapped lines)

```
**Line range.** `#@a.ts:10` delivers only line 10. `#@a.ts:10-15` delivers lines 10–15 inclusive. The collapsed read line shows `read a.ts:10` or `read a.ts:10-15`.
A closed range that exceeds the remaining context budget is delivered as a head slice plus a paging directive, exactly like a whole file (no paging past the selection unless the budget demands it). Images/binaries ignore `:N` / `:N-M`.
Different ranges of the same file each inject: `#@a.ts:10 #@a.ts:20` is two blocks; `#@a.ts:10 #@a.ts` is the slice plus the whole file.
The same path+range still collapses to one (`#@a.ts:10 #@a.ts:10`).
```

## 4. Verification-only items (b), (d), (e) — analysis

- **(b) BUG-001, expanded view**: :50 "On submit, each file shows up as a compact green `read <path>`
  line … Press `ctrl+o` to expand any of them to the full contents." and :62 "Each URL renders as a
  green `read <url>` line … `ctrl+o` expands it to the extracted markdown." Neither sentence ever
  implied the misalignment (no claim about *which* body appears after paging; generic per-file
  wording). Post-fix they are simply true. Also checked `## What gets injected` rendering paragraph
  (~:117 "each injected file renders as a green `read <path>` line … with `ctrl+o` to expand") —
  accurate. **No rewording needed.**
- **(d) BUG-003 rider**: :82–84 reads coherently inside the "By content type" list. **No change.**
- **(e) BUG-004 autocomplete**: :96 "Path completion works in the editor. Type `#@` and the same
  file list Pi shows for `@` appears; Tab completes it as `#@<path>`." BUG-004 changed only the
  defensive non-`@` item path (invisible to users). Limits :210 "No autocomplete for in-file
  imports" unaffected. **No change.**

## 5. Pre-flight greps proving all 7 dependency fixes landed (README must not document unshipped behavior)

1. BUG-005: `grep -n "(https?|ftp)" file-injector.ts` → URL_SHAPE_RE (~:43) contains ftp.
2. BUG-002: `grep -n "invalidRange" file-injector.ts` → ≥3 hits incl. one in injectMarkdown's
   Step-5 loop (~:1590s region).
3. BUG-003: `grep -n "formatEmptyImageBlock" file-injector.ts` → call inside injectUrl image
   branch (~:945+).
4. BUG-004: `grep -n 'startsWith("@")' file-injector.ts` → item-level pass-through map
   (~:1959–1963).
5. Baseline: `npm test` (4 suites) + `npm run typecheck` green BEFORE any edit.

## 6. Validation commands (verified against package.json)

- `npm test` → `node ./file-injector.test.mjs && node ./import-behavior.test.mjs && node ./relative-imports.test.mjs && node ./url-injection.test.mjs` (docs-only change must keep all green).
- `npm run typecheck` → `node ./scripts/typecheck.mjs` (0 errors).
- `git diff --stat README.md` → expect ~1 modified line + 1 added line; `wc -l README.md` → 224.
- `grep -n "ftp" README.md` → exactly 1 hit (the new Limits sentence).
- `grep -c "malformed" README.md` → 2 (config :179 + the new Syntax sentence).

## 7. Out of scope (owned elsewhere)

- `spec/` files (incl. spec/15 §7 ftp row, spec/14 §14.2) → sibling P1.M4.T6.S2 (spec consistency pass).
- Any code/test/package.json/CHANGELOG change. No CHANGELOG exists in the repo (verified via find).
- Rewriting/rewheeling any section — "Keep edits minimal — this is a sweep, not a rewrite."