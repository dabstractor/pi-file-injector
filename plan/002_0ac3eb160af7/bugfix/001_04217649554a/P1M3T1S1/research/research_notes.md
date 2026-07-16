# Research Notes — P1.M3.T1.S1 (README sync for the corrected #@file behavior)

**Task**: Review README.md against the four shipped fixes (Issues 1–4) and reconcile. Expected
outcome per contract: **minimal or no edit** — the README is anticipated to already be accurate.

**Method note**: This is documentation-review work. The "research" is reading README.md, the
shipped `file-injector.ts` (to confirm actual behavior), and the four dependency PRPs (as
contracts). I did this directly — no subagents (they would re-read the same files). All findings are
verified against the live source + a 49/0 harness baseline.

---

## 1. The Contract (from item description)

A **review-and-reconcile** task (Mode B, changeset-level). Two checks:
- **(i) Trigger-stripping sentence** (README ~L31): "The `#@` trigger is stripped from each
  reference, so `Review #@a.ts` reaches the model as `Review a.ts` …". Confirm it's still accurate
  for the SUCCESS case (it is). OPTIONALLY add one short clause that a missing/directory token is
  left untouched — ONLY if it reads naturally; do NOT over-document.
- **(ii) Paged-delivery paragraph** (README ~L41, also L9 & L72): "Oversize files are delivered as a
  head block plus a paging directive — the model reads the rest via the `read` tool." Confirm no
  change needed (stays accurate).

Hard constraints:
- Do NOT invent features, dedup details, notify wording, or internal mechanics the user cannot observe.
- If README is already accurate → minimal/no edit, and NOTE that in the PRP.
- Keep README's existing tone and structure.
- OUTPUT: README.md consistent with shipped behavior; the model-free harness must still pass (the
  README sync must NOT touch source/tests).

---

## 2. The four fixes and README visibility (the key analysis)

| Issue | Fix (shipped) | Is it README-visible? |
|---|---|---|
| **1 — within-prompt dedup** (`injectedThisRun` set; same path twice → 1 block) | LIVE (file-injector.ts L192, L205 guard, +2 `add(abs)` sites) | **NO** — internal mechanic. README never describes dedup. Grep confirms no "dedup"/"duplicate" mention. Do NOT document (contract: don't invent dedup details). |
| **2 — failed-token `#@` stripping** (index-splice: only injected tokens lose `#@`) | LIVE (L200 decl, L234+L276 pushes, L297-298 splice) | **PARTIALLY** — the strip EXAMPLE (`Review #@a.ts`→`Review a.ts`) is a success case and is still correct. The failed-token verbatim behavior is ALREADY in the table (L44: "Left as written"). |
| **3 — notify wording** (`N whole` / `N whole, M paged`) | LIVE (handler msg; harness Cases 9/12/F4/PN1) | **NO** — README never quotes the notify message. Grep confirms no "notify"/"whole"/"injected N" mention. Do NOT document (contract: don't invent notify wording). |
| **4 — paged directive offset** (`offset:0` → `offset:2001`) | LIVE (file-injector.ts L123-129) | **NO** — README never quotes the directive string. Grep confirms no "offset:" mention in README. The paged paragraphs (L9/L41/L72) describe "head block plus a paging directive" which is STILL true. |

**Conclusion**: Issues 1, 3, 4 are invisible to the README. **Only Issue 2 touches README-visible
behavior**, and its only strip example is a success case that remains correct. → The README is
already accurate. This matches the contract's anticipation ("If upon review README.md is already
accurate, make the minimal/no edit").

---

## 3. README accuracy audit — line by line

### L31 (the trigger-stripping sentence) — the only candidate for an optional tweak
> "On submit, the file contents appear below a `---` rule. The `#@` trigger is stripped from each
> reference, so `Review #@a.ts` reaches the model as `Review a.ts` with the file appended underneath."

- **Success-case example** (`Review #@a.ts` → `Review a.ts`): **STILL CORRECT** after Issue 2. ✓
- **"stripped from each reference"**: after Issue 2, `#@` is stripped ONLY from successfully-injected
  tokens; failed (missing/dir/error) and deduped-repeat tokens keep `#@`. The word "reference" is
  slightly loose — before the fix it stripped from EVERY token (count>0); after, only injected ones.
  BUT the sentence's example is a success case, so the sentence is accurate for what it illustrates.
- **Failed-token behavior is ALREADY documented** in the table L44: "Missing file, directory, or
  permission error | Left as written. Nothing is appended." ("Left as written" = the token, `#@`
  included, stays verbatim). A reader combining L31 + L44 already gets the full picture.
- **Verdict**: ACCURATE. An OPTIONAL one-clause tweak is possible (qualify "each reference" →
  "each reference that resolves", + a short follow-on) but risks minor redundancy with L44. The
  contract says add it "only if it reads naturally, do not over-document." → Genuinely optional.

### L9 / L41 / L72 (paged-delivery paragraphs) — NO change
- L9: "delivered as a head block plus a paging directive that the model reads through." ✓ still true
- L41: "Oversize files are delivered as a head block plus a paging directive — the model reads the
  rest via the `read` tool. Never silently truncated." ✓ still true
- L72: "Oversize text files are delivered as a head block (first ~8 KB) plus a paging directive; the
  model reads the rest via the `read` tool." ✓ still true (the "first ~8 KB" = HEAD_BYTES=8192,
  unchanged by Issue 4; Issue 4 only changed the directive's OFFSET, which README doesn't quote)
- **Verdict**: NO change. The `offset:0`→`offset:2001` change is a model-facing directive string the
  README never quoted, so it is invisible to these paragraphs.

### L54 (image bytes / empty-image) — NO change (not part of THIS plan's 4 issues)
- "Images are matched by their real bytes… An empty (0-byte) image attaches nothing." This is the
  F3/F5 behavior from a PRIOR plan (already documented). None of Issues 1–4 touch it. Leave it.

### Other README claims — spot-checked, all still accurate
- L3 ("paged via the read tool when it doesn't"), L7 (`@file` CLI-only), L60 (Unicode boundary),
  L73 (no spaces), L76 (backtick blocks), L80-83 (#@ vs @). None invalidated by Issues 1–4. ✓

---

## 4. The decision: NO-EDIT (recommended) vs OPTIONAL minimal clause

**Recommended: NO-EDIT.** The README is already accurate. The four fixes changed internal mechanics
(1, 3), a model-facing directive string not quoted in README (4), and a strip behavior whose only
documented example is a success case (2) — with the failed-token case already covered by the table.
Documenting the review finding (in the PRP + a brief implementation note) satisfies "note that in the
PRP."

**Optional minimal clause (if the implementer judges it reads naturally):** a one-line precision
qualifier on L31 — "stripped from each reference that resolves" + a short follow-on sentence for the
non-resolving case. Decision criterion: add it ONLY if it does not read as over-documentation and
does not merely restate the L44 table row. (My assessment: it borders on redundant with L44, so the
default is to NOT add it. The PRP provides the exact optional edit so the choice is one paste.)

---

## 5. Scope boundaries (do NOT collide with siblings / closed work)

- **NO source/test edits.** This task touches `README.md` ONLY. The four fixes are all LIVE and
  harness-pinned (49/0). Touching `file-injector.ts` or `file-injector.test.mjs` would collide with
  the closed Issues 1–3 and the in-progress Issue 4 (P1.M2.T2.S1).
- **NO new mechanics in prose.** Do NOT add: dedup behavior (Issue 1 — internal), the notify wording
  (Issue 3 — internal), the `offset:2001` directive (Issue 4 — model-facing, not user-facing), or any
  other internal detail the user cannot observe. The contract is explicit on this.
- **NO restructure.** Keep the README's existing tone, headings, table, and section order. Any edit
  is a sentence-level change inside § "Usage" (L31) — nothing else.
- This is the ONLY changeset-level docs task (P1.M3 has just T1.S1). No sibling README task to avoid.

---

## 6. Validation approach for documentation work

No linter applies to prose. Validation is:
1. **Accuracy check**: the (optionally edited) L31 must still be true for the success case; no claim
   contradicts shipped behavior. Grep-confirm no invented mechanics leaked in.
2. **Scope check**: `git diff --name-only` → README.md ONLY; `git diff README.md` confined to L31
   (if edited). Source/test files untouched.
3. **Harness still passes**: `node ./file-injector.test.mjs` → 49/0 (defensive — must not break; if
   it fails, the task accidentally touched source/tests).
4. **Markdown sanity**: if L31 is edited, the paragraph still renders as one paragraph (no broken
   structure).

---

## 7. Risk assessment

VERY LOW. The overwhelmingly likely outcome is a NO-EDIT (or a one-line optional precision tweak).
The only failure modes: (1) over-documenting — adding dedup/notify/offset details the contract
forbids (caught by the grep scope checks); (2) accidentally editing source/tests (caught by
`git diff --name-only` + the harness run); (3) making the optional clause read awkwardly/redundantly
(mitigated by defaulting to NO-EDIT and providing the exact optional text). All caught by the
Level-1 validation greps.
