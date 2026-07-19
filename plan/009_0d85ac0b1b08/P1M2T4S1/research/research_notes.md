# Research Notes — P1.M2.T4.S1 (README.md verbatim doc sync)

Task: update README.md lines 41, 43, 72 so no passage claims `#@` markers are stripped;
instead describe verbatim prompt delivery. Mode B (documentation-only).

---

## 1. Exact target lines (verified, `grep -n`)

| Line | Section | Current text (exact, the load-bearing part) |
|---|---|---|
| **41** | `## Usage` | "...Press `ctrl+o` to expand any of them to the full contents. **The `#@` trigger is stripped from each reference**, so `Review #@a.ts` appears in your message as `Review a.ts`, with the file delivered to the model underneath — never pasted into your message bubble." |
| **43** | `## Usage` | "...delivers both — `spec.md` first, then `api.md` — **and the import marker is stripped from `spec.md` the same way a top-level marker is**:" |
| **72** | `## What gets injected` | "...with `ctrl+o` to expand. **Your own message shows only what you typed.**" |

Source: `grep -n -i strip README.md` → hits ONLY on lines 41 and 43 (nothing else).
`grep -n "Your own message shows only what you typed" README.md` → line 72.

## 2. The NO-TOUCH list (must NOT be edited — these say "left as written/verbatim/as-is"
   for NON-matching tokens, which is the OPPOSITE of stripping and is CORRECT)

| Line | Section | Phrase (verbatim = untouched because nothing matched) |
|---|---|---|
| 60 | What gets injected (table) | Missing/dir/permission error → "Left as written. Nothing is injected." |
| 88 | Syntax | `#@report.md.bak` is "left as written" (exact-extension, no silent resolve) |
| 94 | Syntax (Markdown imports) | absolute/tilde imports "are ignored and left verbatim" |
| 95 | Syntax (Markdown imports) | extension token "is left as-is" |
| 96 | Syntax (Markdown imports) | code-span `#@` "stays verbatim" |
| 135 | Limits | "`#@src/` is left as-is" |

These 6 lines use "left as written"/"left verbatim"/"left as-is" to mean **untouched
because no file matched** — a different concept from **stripping a resolved marker**.
Editing them would conflate the two and introduce errors. Do NOT touch.

## 3. Validation gate discovery

- `grep -ni "strip" README.md` → currently 2 hits (41, 43). AFTER the edit → **0 hits**.
  This is the single cleanest deterministic gate for "no passage claims markers are stripped."
- No markdown/prettier linter config in repo (`.markdownlint*`, `.prettierrc*`, etc. absent).
  So validation is: grep + git-diff scope + the 6 no-touch lines preserved + human readability.
- `npm run test` (3 `.mjs` files) and `npm run typecheck` (`scripts/typecheck.mjs`,
  `files: ["file-injector.ts"]`) do NOT touch README.md → unaffected. Belt-and-suspenders only.

## 4. Rationale (why verbatim) — from PRD §6.4 + §13.8

- Pi re-feeds the STORED user-message text (not the originally-typed text) on cancel+re-open,
  `/tree` navigate, `/fork`, and queued-message dequeue (`agent-session.ts`:
  `navigateTree()` → `_extractUserMessageText()` → `editor.setText`; no extension hook can
  override that prefill). If the extension had stripped `#@`, the stored text would be bare
  paths, the re-submitted prompt would contain no `#@`, and files would silently vanish on
  every re-open. Preserving the prompt verbatim means re-submission re-triggers injection.
- Stripping's only real effect was deleting 2 chars per marker (a handful of tokens); the
  file bytes were ALWAYS in the custom message, never the prompt, in either design.
- Verbatim is strictly better: honest (model + bubble both show exactly what the user typed),
  simpler (no marker-index/prefixLen bookkeeping), re-open-safe.

## 5. Cross-item coordination (plan/009)

- This is the FINAL changeset-level doc task (Mode B). All implementing subtasks
  (P1.M1 + P1.M2.T1/T2/T3) are complete or in progress (T3.S2 running in parallel — adds
  TEST cases, not README). No code dependency; README describes the LANDED verbatim engine.
- Working tree has uncommitted changes: `file-injector.test.mjs` (P1.M2.T3.S1/S2) + `tasks.json`.
  My task touches ONLY `README.md` — no collision with the parallel test work.

## 6. The L41 redundancy judgment call

The item description's "Rewrite to" text for L41 includes a final clause
"Each file renders as a compact green read <path> line below your message" — but L41's
sentences 1-2 ALREADY say that (better: "indistinguishable from the `read` tool",
"ctrl+o to expand"). Keeping both creates redundancy. Decision: replace ONLY sentence 3
(the strip claim), preserving sentences 1-2, and drop the redundant rendering clause from
the new text. This makes the minimal change while honoring the item's intent (remove strip
claim, add verbatim claim + re-trigger rationale + bytes-underneath). Documented in PRP.