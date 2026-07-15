# Research Notes — P1.M3.T2.S1 (Update README overview, test count, and known limitations)

This is the **Mode B changeset-level documentation sweep** (SOW §5). It runs AFTER all implementing
subtasks (P1.M1.T1.S1/S2, P1.M1.T2.S1, P1.M2.T1.S1, P1.M2.T2.S1, P1.M3.T1.S1) are complete, and
sweeps README.md for cross-cutting consistency. The running-in-parallel sibling is **P1.M3.T1.S1**
(F3/F5 docs in "Behavior by file type") — its edits are in a textually DISJOINT section, so no edit
collision.

## 1. The actual test count (authoritative — run the harness)

```
$ node ./sharp-at-file.test.mjs
...
Result: 31 passed, 0 failed.
```

**31 passed, 0 failed.** This is the number the README Testing section must reflect. (The contract's
contract spec assumed "was 28"; the README was actually still stale at "23 passed, 0 failed" from the
pre-bugfix P1M2T4S1 era. Either way the target is the **live** count: 31.)

### Case-category breakdown (for the coverage-description wording)
- 14 PRD §11 acceptance cases (#1–#14). Note: #12 and #13(end-to-end-live) are `ℹ` INTEGRATION-only
  (run manually, never affect exit code); #13(per-block template) and all of #1–#11, #14 are `✓`.
- Edge cases: E1 (0-byte text), E2 (parenthesized token), E3 (fenced-code #@), E4 (read error).
- Guards: G1 (extension-source), G2 (steer), G3 (no-#@).
- Headless/notify: H1 (hasUI===false → notify never called).
- Merge contract: M1 (user image preserved at [0]).
- **NEW (bugfix) cases the contract requires the README to mention:**
  - `F1` — per-token dedup prevents re-injection (injectFiles-level).
  - `F1b` — **co-load**: two non-sentinel copies do not double-inject (Issue 1).
  - `F2` — **sentinel-in-prompt**: a prompt containing the literal marker string still injects its
    files (Issue 2 regression).
  - `F3a`/`F3b` — magic-number sniff (mislabeled image → text path; real vs fake bytes).
  - `F5` — 0-byte image → note block, no empty ImageContent.
  - `F4` — notify pluralization.
  - `U1` — **Unicode word-boundary**: `#@` does not fire mid-word in any language (Issue 5).

## 2. Sentinel references in the README — NONE (verification no-op)

```
$ grep -niE 'sentinel|injected-->|<!--#@|injected marker|<!--' README.md
(none found)
```

All `inject*` hits in the README are **normal feature prose** ("whole-file injection", "injects
nothing", "contents not injected", "no injection by this extension", etc.) — none refer to the
sentinel *mechanism* or the `<!--#@file-injected-->` *marker string*. **Contract points (b) and (d)
"remove any reference to a sentinel / 'injected' marker" are already satisfied — no edit needed,
only a grep-based verification.** The sentinel mechanism was removed in P1.M1.T1.S2 and the README
never described it in user-facing prose, so there is nothing to delete.

For completeness: the only remaining `sentinel` string anywhere in the repo lives in **comments** —
`sharp-at-file.ts:140` ("Cooperation-independent: works even when the prior copy was a non-sentinel
[copy]") and several `sharp-at-file.test.mjs` comments. Those are CODE COMMENTS, not user-facing
docs, and are explicitly OUT OF SCOPE (do not edit `.ts` / `.test.mjs`).

## 3. Assembly format — already clean, matches PRD §6.2 (verification no-op)

**PRD §6.2 (authoritative):** `<original prompt text, unchanged>\n\n---\n\n<block 1>\n\n<block 2>`
(pseudocode `const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`;`). No sentinel.

**README describes the assembly in two places, both already clean (no sentinel):**
- **Overview** (README ~line 13): "…appends its contents to the prompt in Pi-native
  `<file name="…">…</file>` blocks, below a `---` separator." ✓
- **Quick start** (README ~line 72-74): "…the file contents appear below a `---` rule in your
  message, and the original `#@path` marker stays in place as a readable reference (the extension
  **appends**, it does not inline-replace)." ✓

Both match PRD §6.2's "append all blocks below the original prompt, separated by a horizontal rule."
**Contract point (c) is satisfied — verification no-op.** Nothing describes an `<!--#@file-injected-->`
insertion in the assembly. No edit needed.

## 4. Unicode-aware word boundary — already documented in Syntax (verification no-op)

README **Syntax** section (~line 112-115) — added by P1.M1.T2.S1's Mode A doc update — reads:

> "**Where it matches:** … It does **not** match mid-word — `foo#@bar` injects nothing. The word
> boundary is **Unicode-aware**: `#@` does not trigger after non-ASCII letters or numbers in any
> language either (e.g. `café#@x`, `Öster#@x`, or CJK like `日本語#@x` inject nothing), exactly as it
> does not trigger after ASCII letters/digits/underscore."

**Contract point (b) "verify the Unicode-aware word boundary is documented" → VERIFIED present in
Syntax.** No edit needed (it is correctly framed as behavior, not a limitation, so it belongs in
Syntax, not Known limitations). The Known-limitations section does NOT mention Unicode (correct — it
is not a limitation).

## 5. Known limitations section — no stale references (verification no-op)

The Known limitations section (README ~line 155-170) lists 5 items: no size gate; paths with spaces;
`#@`+backtick; no directory reads; no globbing. **None mention a sentinel, an "injected" marker, or
the assembly format.** Contract point (b) removal sub-item is satisfied — verification no-op.

## 6. Conclusion — the ONLY real content edit is the Testing section

The sweep reduces to **ONE content edit** (the Testing section) plus a set of deterministic grep
verifications that the other contract points are already satisfied:

- **EDIT (content):** Testing section — count `23` → `31` (or the live `node ./sharp-at-file.test.mjs`
  result), AND extend the coverage sentence to name **co-load dedup**, the **sentinel-in-prompt**
  regression, and **Unicode word-boundary** tests.
- **VERIFY (grep, no-op edits):** (a) zero sentinel/marker references in README; (b) Unicode boundary
  present in Syntax; (c) assembly format clean in Overview + Quick start (matches PRD §6.2); (d) Known
  limitations has no stale sentinel/format reference; (e) scope: only README.md changed, only the
  Testing section's text altered.

## 7. Sibling-coordination boundaries (avoid collision)

| Sibling | Owns | Status | Collision risk |
|---|---|---|---|
| P1.M3.T1.S1 | README § "Behavior by file type" (Image/Empty-image rows + 2 notes bullets) | Running in parallel | NONE — textually disjoint from Testing/Overview/Quick start/Known limitations. Their `oldText` anchors are in a different section, so the Testing edit applies regardless of landing order. |
| P1.M1.T2.S1 | README § "Syntax" (Unicode boundary Mode A doc) | COMPLETE | NONE — already landed; we only VERIFY it. |
| P1.M1.T1.* / P1.M2.* | `.ts` + `.test.mjs` (code + harness) | COMPLETE | NONE — we do not edit code files; we only RUN the harness to read the count. |

## 8. Style / voice conventions (so the Testing edit reads native)

- Em dash is **U+2014** (`—`) for clauses; backticks around code (`node ./sharp-at-file.test.mjs`,
  `#@`, `<file …>`). Bold (`**…**`) for emphasis on key terms (matches the existing README voice —
  e.g. "**unconditional**", "**appends**", "**Unicode-aware**").
- The existing Testing sentence is a single flowing run-on listing coverage groups, ending with the
  count in bold. Extend that same pattern (add the three new groups as bold-led phrases) and bump the
  count. Do NOT restructure into a bullet list — match the existing prose form.
- Keep the existing trailing clauses ("No network, no model API key, and no Pi process are required."
  and the validation_report.md link) unchanged.
