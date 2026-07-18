# Research Notes — P1.M3.T2.S1 (bugfix 001_a4cee0dcf39c)

**Item:** Update README.md for Issue 1 behavior change + Issue 4 intentional-contract note
**Task type:** Documentation changeset-sync (**Mode B — final task**). Summarizes the whole bugfix delta
that is USER-FACING. No code is written by this task. **Only `README.md` is edited.**

---

## 1. What this task IS and IS NOT

- **IS:** A minimal, voice-matched update to `README.md` documenting exactly TWO user-facing behavior
  points surfaced by the QA bugfix effort: (Issue 1) extension-carrying references are now exact-match;
  (Issue 4) the image magic-byte contract.
- **IS NOT:** A description of Issues 2 & 3. The contract is explicit: *"Do not describe internal
  offset/directive implementation details (those are code-internal, not user-facing)."* Issue 2
  (`FileDetail.body` byte duplication → content-offset refactor) is a pure internal-storage change
  with **zero** user-visible behavior. Issue 3 (paged expanded-view now shows the directive) IS
  user-visible but the contract has decided NOT to document it — stay in scope, document only 1 & 4.
- **IS NOT:** A code/test/config change. `file-injector.ts`, the three test harnesses, `scripts/`,
  `package.json`, `PRD.md`, `tsconfig.json` are all **read-only** for this task.
- **Depends on:** ALL implementing subtasks (P1.M1.* Issue-1 fix + tests; P1.M2.* offset/directive;
  P1.M3.T1.S1 test wiring — which has ALREADY landed: `package.json` test script now chains all three
  harnesses). This is the FINAL doc task; it runs last.

---

## 2. Issue 1 — verified shipped behavior (read the IMPLEMENTED source, not just the bug report)

The bug: `resolveImportPath` had an `extCut` heuristic (`token.match(/^.*\.(?:md|markdown)/)`) that
greedily truncated a token after its LAST `.md`/`.markdown` and resolved the truncated candidate when
the full token missed. So a reference to a *missing* `report.md.backup` silently resolved to an
*existing* `report.md`, stripped the `#@`, and delivered the WRONG file. Confirmed false-positive
patterns: `X.md.txt`, `X.md.bak`, `X.md.old`, `X.md/foo`.

**The fix (Option 2 from the bug report — "narrow truncation to trailing markdown-formatting chars")**
— VERIFIED LANDED in `file-injector.ts` lines **162–163**:

```ts
const fmtCut = token.replace(/[*_]+$/, ""); // strip a trailing run of the glue chars cleanToken omits
if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));
```

So `resolveImportPath` now builds candidates in this order: `[token, cleanToken(fmtCut)]` (then the
unchanged `.md`/`.markdown` shorthand via `tryMdExt`, which is a SEPARATE rule and untouched). Net
shipped behavior (verified against the architecture note's node-confirmed table):

| Input (raw `\S+`, after cleanToken) | Has trailing `*`/`_` glue? | Result |
|---|---|---|
| `report.md.backup` (missing; `report.md` exists) | NO | exact-only → **left verbatim** (null) ✅ FIXED |
| `X.md.bak` / `X.md.txt` / `X.md.old` / `X.md/foo` (missing) | NO | exact-only → **left verbatim** ✅ FIXED |
| `*@b.md*` / `**@b.md**` / `@b.md.*` (glue; `b.md` exists) | YES | fmtCut strips glue → re-clean drops `.` → retries `b.md` → **resolves to `b.md`** ✅ preserved |
| `my_file.md.*` (underscore INSIDE name + trailing glue) | trailing glue only | `my_file.md` (internal `_` untouched) ✅ |

**What the README must convey (Issue 1, user-facing):**
- A reference that already ends in a file extension is matched by its **exact** name.
- A **missing** `X.md.bak` is left as written — it is NEVER silently resolved to an existing `X.md`.
  (The model never receives a different file than the one you named.)
- The carve-out: markdown **emphasis/formatting** glued to a name (`*@b.md*`, `**@b.md**`) is still
  trimmed, so the file resolves. (Only the trailing `*`/`_` glue is stripped — a real `.bak`/`.txt`
  extension is not.)

**DO NOT document:** the `fmtCut` variable name, the `[*_]+$` regex, `cleanToken`, `resolveImportPath`,
`TRAILING_PUNCT`, line numbers, "candidate[0]/[1]", or the `tryMdExt` shorthand mechanism. Those are
code-internal. README states the user-facing rule + the two examples (missing `.bak` → verbatim;
`*@b.md*` → resolves).

---

## 3. Issue 4 — verified shipped behavior (⚠️ ACCURACY FINDING — contract phrasing is imprecise)

The bug report framed Issue 4 as "image magic-number sniff rejects a *valid* image whose extension ≠
actual type" and noted the README's stricter contract is intentional. The task contract says to
"clarify that a genuine image renamed with a wrong extension (e.g. a PNG named .jpg) is delivered by
its real byte type, not the declared extension."

**⚠️ The contract's phrasing ("delivered by its real byte type") is IMPRECISE vs the shipped code.**
Verified in `file-injector.ts`:

- Line 868 (in `injectFile`): `const mime = MIME_BY_EXT[ext];` — `mime` is derived from the
  **extension** (`MIME_BY_EXT`: png→image/png, jpg/jpeg→image/jpeg; lines 17–20).
- Line 64 `hasValidImageMagic(buf, mime)` validates the bytes against the **declared** type's magic
  signature (PNG = `89 50 4E 47…`; JPEG = `FF D8 FF`; etc.).
- Classification branch (line ~878): `else if (mime && hasValidImageMagic(buf, mime)) { …attach image… }`.
  On mismatch → falls through → line ~898 `else if (isBinary(buf))` → real image bytes contain NUL →
  **binary note**.

**So the actual shipped outcome for a PNG named `photo.jpg`:**
- ext `jpg` → mime `image/jpeg` → `hasValidImageMagic(pngBytes, "image/jpeg")` checks `FF D8 FF` →
  PNG bytes (`89 50…`) FAIL → image branch skipped → `isBinary` → TRUE → **delivered as a binary note,
  NOT attached as an image.**

➡️ The README must state the **accurate** outcome: a real image saved with a mismatched extension is
**not attached** (it becomes a binary note, because its bytes don't match the declared extension's
signature). It is NOT "attached by its real byte type." The user's remedy: rename to the true type.

**The existing README line 66** (the magic-byte paragraph):
> "Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is
> injected as text, not attached as a broken image. An empty (0-byte) image attaches nothing."

This already covers the text-fake direction correctly. It does NOT yet state the converse (real-image-
wrong-extension → binary note). That is the one-line clarification to add. Keep the existing sentences
intact (they are accurate); APPEND the converse.

---

## 4. README.md current state (the canvas) — precise line numbers

README is **138 lines**, 14 code fences (even — balanced). My edits add **zero** fences (both are
prose), so post-edit fence count stays **14** (a hard gate).

```
L1   # `#@file`
L5   ## Why
L13  ## Install
L21  ## Usage
L45  ## What gets injected
L47-53  (the file-type table — Image row "Attached as an image"; Other binary "A short note says it was skipped")
L66     "Images are matched by their real bytes…" paragraph  ← EDIT (b) home (Issue 4)
L68  ## Syntax
L72     **Where it matches:** …
L74     **Trailing punctuation is trimmed.** …
L76-78  ```text  /  . , ; : ! ? " ' ) ] } >  /  ```   (trimmed-chars fence)
L80     **Paths:** …
L82     **Markdown imports:** … Five rules narrow it:
L84       - **Relative paths only.**
L85       - **Extension shorthand.**  ← sibling (markdown-import .md shorthand; leave as-is)
L86       - **Code is the escape hatch.**
L87       - **Each file is injected at most once.**
L88       - **Shared budget.**
L90  ### Optional: bare-`@` markdown imports   (plan-005 addition; leave as-is)
L121 ## Limits
L123-131  (8 bullets)
L133 ## `#@` versus `@`
```

**Placement decisions (from the contract):**
1. **Issue 1 note** → new bolded paragraph in `## Syntax`, placed AFTER the trimmed-chars code fence
   (after L78) and BEFORE `**Paths:**` (L80). This groups the general token-cleanup rules (trailing
   punctuation, then exact-extensions) together, before the markdown-specific bullets. It is a GENERAL
   rule (applies to top-level AND markdown imports — the fix is in `resolveImportPath`, shared by both).
2. **Issue 4 note** → APPEND a sentence to the existing magic-byte paragraph at **L66**. Do not move or
   rewrite the existing (accurate) sentences.

**Voice to match (verified by reading neighbors):** concise, second-person ("you"/"your"), bold lead-in
for each rule (`**Term.**` …), example-driven (backticked `#@report.md.bak`, `*@b.md*`), no marketing
fluff, no first-person-plural, sentence length mirrors neighbors.

**Stale-claim sweep:** The file-type table (L47-53) is still accurate (Image "Attached as an image";
Other binary "A short note says it was skipped") — the magic-byte nuance lives in prose at L66, not the
table. The "Extension shorthand" bullet (L85) is about the markdown `.md`/`.markdown` shorthand
(`#@PRD` → `PRD.md`) — a DIFFERENT rule from the exact-extension rule; leave it, no conflict. No existing
prose becomes false.

---

## 5. Recommended README draft (voice-matched; PRP gives this as a guide)

**Edit (a) — Issue 1: new paragraph in `## Syntax`, after the trimmed-chars fence (after L78), before `**Paths:**` (L80):**

```markdown
**Extensions are exact.** A reference that already ends in a file extension is matched by that exact name. A missing `#@report.md.bak` is left as written — it never silently resolves to an existing `report.md`, so the model never receives a different file than the one you named. (Markdown formatting glued to a name is different: emphasis like `*@b.md*` or `**@b.md**` is still trimmed, so the file resolves.)
```

**Edit (b) — Issue 4: append one sentence to the magic-byte paragraph at L66. BEFORE (current):**

```markdown
Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. An empty (0-byte) image attaches nothing.
```

**AFTER (insert the converse sentence before the final "An empty…" sentence):**

```markdown
Images are matched by their real bytes, not just the extension. A text file renamed `fake.png` is injected as text, not attached as a broken image. The check cuts both ways: a real image saved with the wrong extension — a PNG named `photo.jpg`, say — is not attached, because its bytes don't match the `.jpg` signature; it's delivered as a binary note instead. Rename it to its real type to attach it. An empty (0-byte) image attaches nothing.
```

> Both drafts are accurate to the shipped code (verified in §2 and §3), voice-matched, and minimal.

---

## 6. Validation approach (no markdown linter; gates are greppable + fence-balance)

- `package.json` scripts = `typecheck` + `test` (test now chains all three harnesses — landed by the
  parallel P1.M3.T1.S1; this docs task does NOT run `npm test`/`typecheck` — those are CODE gates).
- No `markdownlint`/`mdformat`; `npx` is available but the existing README was not written to pass
  `markdownlint` → make it OPTIONAL, never a hard gate.
- **Hard gates (deterministic, <1s):**
  1. Code-fence balance unchanged: `grep -c '^```' README.md` == **14** (even). My edits add no fences.
  2. Issue 1 presence: the new "exact" rule + both examples (`report.md.bak` verbatim; `*@b.md*` resolves).
  3. Issue 4 presence: the "PNG named photo.jpg → binary note" converse sentence.
  4. Issue 4 ACCURACY: README does NOT claim a mismatched-extension image is "attached by its real
     type" (that would be a stale/wrong claim — it's a binary note).
  5. Scope: only README.md touched; Issues 2/3 internals (offset/directive/FileDetail) NOT mentioned.
  6. No code-internal leakage: no `fmtCut`, `extCut`, `hasValidImageMagic`, `MIME_BY_EXT`, `resolveImportPath`,
     `cleanToken`, `TRAILING_PUNCT`, line numbers, or regexes in the README.

---

## 7. Scope boundaries (cross-task hygiene)

- This is the FINAL task of the bugfix (plan 008). The implementing subtasks (M1 + M2) and the test
  wiring (M3.T1) are DONE (or in parallel) before this runs. This task touches ONLY `README.md`.
- Do NOT document Issues 2 & 3 — contract item: "Do not describe internal offset/directive implementation
  details." (Issue 2 = internal storage; Issue 3 = display-only, contract-decided-undocumented.)
- Do NOT touch the file-type table (L47-53) — it's still accurate; the magic-byte nuance is prose at L66.
- Do NOT rewrite the existing "Images are matched by their real bytes" sentences (accurate) — APPEND only.
- Do NOT contradict the "Extension shorthand" bullet (L85) — it's a different rule (markdown `.md`
  shorthand); leave it. The new "Extensions are exact" note is the GENERAL exact-match rule.
- Do NOT edit PRD.md (FORBIDDEN — read-only, owned by humans).
