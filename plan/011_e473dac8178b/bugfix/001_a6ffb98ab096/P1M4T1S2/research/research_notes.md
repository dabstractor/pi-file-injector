# Research Notes — P1.M4.T6.S2 (dir: P1M4T1S2) — spec/ consistency pass over changeset-touched parts

Verified against tree at commit `10d61bc` (BUG-005 landed; ALL seven implementing subtasks of the
changeset are now in the tree). Line anchors below are at that HEAD — they drift; the PRP uses
grep anchors.

## 1. Repo facts (verified)

- `spec/` = 17-file hand-written feature PRD (source of truth). `spec/SPEC.md` is the index using
  `@path` includes (one line per part, e.g. `@01-overview.md  Overview`). No CHANGELOG.
- No `src/`; single-file extension `file-injector.ts` at repo root. 4 zero-dep ESM test harnesses;
  `npm test` runs all four; `npm run typecheck` → 0 errors (green baseline through 10d61bc).
- Git log (bugfix changeset): 21bf4fa/c626928/71e9f45 (BUG-001), fe766bd (BUG-003),
  3c0bb5d (BUG-004), 10d61bc (BUG-005). BUG-002 guard landed with the MD-LR3 work.
- Sibling task P1.M4.T6.S1 (dir P1M4T1S1) = README.md sweep — touches ONLY README.md; ZERO file
  overlap with this task (spec/ only). It explicitly forbids touching spec/ ("Sibling P1.M4.T6.S2
  (spec/ consistency pass) is SEPARATE — do not touch spec/ files").

## 2. Rider states (contract item (c) inputs) — ALL LANDED

- **spec/15-url-injection.md (BUG-005 rider, commit 10d61bc):**
  - :71 §2.2 `URL_SHAPE_RE` literal includes `(https?|ftp)` ✓
  - :325 §7 edge row — ftp accepted by gate; "Node's `fetch` (undici) has no ftp support — the
    fetch throws (`TypeError: fetch failed`), so the token falls back to verbatim via the §3.5
    catch (…the §3.6 footer spinner may flash — a fetch is genuinely attempted)" — the factually
    wrong "(Node supports it)" is GONE ✓
  - :333 §8 pseudocode `URL_SHAPE_RE` matches §2.2 ✓
  - :347 §8 normalization `/^(https?|ftp):\/\//i.test(tok)` — the coupled-site sync ✓
  - Code matches: `file-injector.ts:46` URL_SHAPE_RE + JSDoc :28-51; ftp never appears elsewhere.
  - No other https?-only claims in spec/15 (grep "https" hits are the four above + scheme-less
    default `https://` prefixing, which is consistent — scheme-LESS hosts still default to https).
- **spec/14-autocomplete.md (BUG-004 rider, commit 3c0bb5d):** §14.2 :28 carries the pass-through
  sentence: "Item values that do not start with `@` (or `#@`) — for example a stray slash-command
  suggestion mixed into an `@` query — are passed through untouched, as are non-string values."
  Internally consistent with the Option-1 remap story above it and with §14.3/§14.4. ✓
- **BUG-003 (empty URL image):** spec/15 has NO empty-image promise (grep "empty" → only
  SPA/empty-extraction §3.4 rows, unrelated to images). Docs plan put the BUG-003 rider in README
  only. Nothing to sync in spec/ — verification-only, expected verdict: no edit.
- **spec/06-delivery-display.md:** :94 expanded bullet ("each file's full delivered text renders
  below its `read` line"; "Paged files show their head block plus the paged-directive text
  verbatim") — literally true post-BUG-001 for url/binary-after-paged mixes. :111 "details …
  parallel to `blocks` emission order (text/head/directive/image-ref/binary each push their
  detail(s))" — an ORDER statement, still true; the renderer no longer relies on index parity but
  the sentence never claimed 1:1. Expected verdict: NO edit to spec/06.

## 3. Residual drift found (this task's edits)

### (a) spec/17-line-ranges.md — LR-3 in-markdown clause MISSING + stale pre-fix sentence

- §6 LR-3 bullet (~:85, grep anchor `**LR-3 — malformed ranges are not silent.**`): wording covers
  only the cleaned-token/top-level case, and ends with the now-FALSE sentence
  "Today these tokens vanish with zero feedback." (describes the pre-LR-3-fix state; both levels
  now warn — top level since the LR-3 fix, delivered-markdown scan since P1.M2.T2.S1's
  injectMarkdown Step-5 guard). Also "(current behavior)" after "left verbatim" is pre-fix framing.
- §3 step 3 (~:43, anchor `Still unresolved → verbatim`): "(LR-3 may add a notify)" — weak "may";
  the notify is required.
- §8 edge table (~:95-112): has the top-level row `#@a.ts:0` / `#@a.ts:5-3` (~:100) but NO row for
  a malformed range inside a delivered markdown file.
- §2.2 item 2 (~:32) and §5 markdown LR-6 block (~:64) describe in-markdown scanning of VALID
  ranges/imports but never malformed-suffix behavior in markdown.
- Shipped behavior to mirror (P1.M2.T2.S1): injectMarkdown Step-5 skips `rec.invalidRange`
  records exactly like processTokenStream, emits the byte-identical hasUI-guarded warning, and the
  raw token is never passed to injectFile (kills the process-cwd stat / relative-block-name leak).

### (b) BUG-001 display drift — `bodies[i]` index pairing still described in THREE spec parts

- **spec/09-algorithm.md :404-427** (`renderInjectedMessage` pseudocode, grep anchors
  `pair each detail with its block body (re-parsed from content) by index` and `const body = bodies[i];`):
  builds `bodies: string[]` from `FILE_BLOCK_RE` and pairs detail i with `bodies[i]` — exactly the
  mechanism BUG-001 replaced. Shipped code (file-injector.ts ~:1049-1120) uses tier-3
  `bodiesByPath` Map<path, FIFO of body inners>, popped in emission order; the JSDoc documents why
  (paged path = 2 blocks / 1 detail → index pairing drifts +1 and shows the directive as a
  following url/binary file's body).
- **spec/16-appendix-skeleton.md :70-84** (skeleton renderer, anchors `files.forEach((d, i) =>` and
  `bodies[i] !== undefined`): same `bodies[i]` pairing; NOTE its inline regex
  `/<file name="[^"]+">([\s\S]*?)<\/file>/g` does NOT capture the name — group 1 is the BODY.
  A path-paired rewrite must ADD a name capture group `name="([^"]+)"`.
- **spec/12-implementation-notes.md note 23 (~:25, anchor `guard \`bodies[i]\``)**: defensive advice
  "Guard `message.details?.files` …, guard `bodies[i]`, and short-circuit the image expanded-view"
  — the guard is now the path-paired pop; wording needs the minimal update.
- NOT this changeset's scope: spec/09 pseudocode predates the 3-tier body recovery (offsets /
  stored body / regex) — do NOT retrofit full tier documentation (prior-changeset simplification,
  not traceable to BUG-001..005). One parenthetical acknowledging offsets-first is the maximum.
- spec/06: verification only (see §2). Its prose never described pairing mechanics.

## 4. Scope discipline (contract item (d))

- Allowed files: spec/17, spec/09, spec/16, spec/12 (+zero-byte edits possible nowhere else —
  spec/06/15/14 are verify-only). Every hunk must trace to BUG-001 (the bodies[i] trio),
  BUG-002 (spec/17 LR-3), or confirm riders (BUG-004/005 = no edit expected).
- README.md is the sibling task's file — DO NOT TOUCH.
- No code/test/package.json edits. `npm test` + `npm run typecheck` run ONCE after edits
  (clean-tree confirmation, not a docs test).

## 5. Pre-flight marker greps (all must hit at start)

```
grep -c "invalidRange" file-injector.ts            # ≥3 (BUG-002: processTokenStream + injectMarkdown Step-5)
grep -n "bodiesByPath" file-injector.ts            # ≥2 (BUG-001 tier-3 path-aware)
grep -n '(https?|ftp)' file-injector.ts            # BUG-005 gate + normalization sync (commit 10d61bc)
grep -n 'formatEmptyImageBlock' file-injector.ts   # BUG-003 F5 mirror in injectUrl image branch
grep -n 'startsWith("@")' file-injector.ts         # BUG-004 item-level pass-through
grep -n '(https?|ftp)' spec/15-url-injection.md    # rider landed (:71/:325/:333/:347)
grep -n 'passed through untouched' spec/14-autocomplete.md  # rider landed (:28)
```

## 6. Post-edit validation greps

```
grep -n "inside a delivered markdown file" spec/17-line-ranges.md   # present (LR-3 clause)
grep -n "Today these tokens vanish" spec/17-line-ranges.md          # ZERO hits (stale sentence gone)
grep -rn "bodies\[i\]" spec/                                        # ZERO hits (BUG-001 drift gone)
grep -n "bodiesByPath" spec/09-algorithm.md spec/16-appendix-skeleton.md  # present
git diff --stat                                                      # only the intended spec files
```

## 7. Numbering note

Plan-status calls this item **P1.M4.T6.S2**; the work directory is **P1M4T1S2** (pre-renumber
path) — same convention as the sibling PRP (P1M4T1S1 = P1.M4.T6.S1).