# Research Notes — P1.M1.T2.S1: README.md — add Extension shorthand bullet

> Documentation-only task. The feature is shipped (P1.M1.T1.S1) and validated (P1.M1.T1.S2). This subtask
> adds ONE bullet to README.md's Markdown-imports subsection. No code, no tests, no external deps.

## 1. The exact insertion target (README.md, confirmed line-by-line)

README.md (103 lines) has a **`## Syntax`** section containing a **Markdown imports** block. The block is
introduced by: *"**Markdown imports:** a `#@` inside a delivered `.md` or `.markdown` file is itself an
import, using the same grammar. Four rules narrow it:"* — followed by exactly **4 bullets** (verified):

```
- **Relative paths only.** Imports resolve against the markdown file's own directory, not your current
  directory. Absolute (`#@/etc/hosts`) and tilde (`#@~/notes.md`) imports inside a markdown file are
  ignored and left verbatim.
- **Code is the escape hatch.** A `#@` inside a fenced or inline code span is not an import — it stays
  verbatim. So a doc can show `` `#@example.ts` `` as an example without importing anything.
- **Each file is injected at most once.** Across the whole prompt — top-level tokens, every import, and
  cycles — a given file appears in one block only. Shared dependencies dedup; cycles terminate.
- **Shared budget.** Imports draw on the same context budget as the top-level prompt. When the running
  total exceeds the window, later files page (head block plus a `read`-tool directive) instead of overflow.
```

**The phrase "Four rules narrow it:"** appears in the intro sentence. Adding a 5th bullet means this
intro count word must be updated to "Five" (otherwise the doc is internally inconsistent — the item
description point 6 explicitly says "does not contradict the existing import bullets").

## 2. WHERE to insert the new bullet (placement decision)

The item description (§3) says: *"Add ONE bullet to README.md's Markdown-imports subsection ... Keep
tone/formatting consistent with the existing bullets. Do NOT edit the four existing import bullets."*

**Logical placement = immediately after the "Relative paths only" bullet** (the first bullet), because:
- The shorthand is a **resolution rule** (how an import token resolves to a file), which is the same
  category as "Relative paths only" (also a resolution rule). The other 3 bullets are about different
  concerns (code-exemption = filtering; dedup = cardinality; budget = accounting).
- PRD §4.5 lists them in this order: rule 1 relative-only, rule 2 base-dir, **rule 3 extension
  shorthand**, rule 4 code-exempt. The README's bullets follow PRD §4.5's grouping (relative +
  code-exempt + dedup + budget are the 4 it surfaces), so inserting shorthand right after relative-only
  mirrors the PRD's rule ordering.
- It does NOT edit any of the 4 existing bullets (it inserts between bullet 1 and bullet 2).

**Alternative considered:** appending as a 5th bullet at the end. Rejected — it would group a resolution
rule away from the other resolution rule (relative-only), breaking topical cohesion. The insertion-after-
relative-only placement is cleaner and the item description's "do not edit the four existing bullets" is
satisfied (insertion is not editing).

## 3. Exact bullet content (from item description §3 + PRD §4.5 rule 3 + delta_analysis)

The item description gives the content in §3:
> "Extension shorthand. An import may omit the `.md`/`.markdown` extension: `#@PRD` resolves to `PRD.md`
> (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats `readme.md`);
> this is a markdown-import convenience only — at the prompt you type the full name."

This is a complete, accurate summary of PRD §4.5 rule 3 + §4.4. Match it to the README's bullet style:
- **Bold lead phrase** (like "Relative paths only.", "Code is the escape hatch.", etc.)
- Concrete example with backticks (`#@PRD`, `PRD.md`, `PRD.markdown`)
- The "exact match wins" invariant (mirrors PRD §4.5 rule 3 + delta_analysis decision matrix case 22)
- The "markdown-import only / top-level types full name" scoping (mirrors PRD §4.4 + delta_analysis case 24)

**Drafted bullet (matching README tone/formatting):**

```markdown
- **Extension shorthand.** A markdown import may omit the `.md`/`.markdown` extension: `#@PRD` resolves
  to `PRD.md` (then `PRD.markdown`) when no bare `PRD` exists. Exact match wins (a bare `readme` beats
  `readme.md`), and a token already ending in any extension is left as-is (so `#@PRD.md` never becomes
  `PRD.md.md`). This is a markdown-import convenience only — at the prompt you type the full name.
```

This adds the "never becomes `PRD.md.md`" clause (mirrors PRD §4.5 rule 3's "so `#@PRD.md` never becomes
`PRD.md.md`" and EDG-2 from T1.S2), which is a sharp edge users will hit. It stays consistent with the
existing bullets' density (each bullet is 2-4 lines, one bold lead, concrete examples in backticks).

## 4. The intro count word ("Four" → "Five")

The intro sentence currently reads: *"Four rules narrow it:"*. After adding the shorthand bullet there
are 5 bullets. **Change "Four" → "Five"** to keep the doc internally consistent. This is NOT "editing one
of the four existing import bullets" (the item's prohibition) — it's updating a count word in the intro
sentence that would otherwise be wrong. The item description point 6 ("does not contradict the existing
import bullets") is satisfied by this consistency fix; leaving "Four" with 5 bullets WOULD be a
contradiction. Flag this explicitly in the PRP as the one unavoidable wording tweak beyond the pure
insertion.

## 5. Cross-check: the example `#@PRD` → `PRD.md` matches real fixtures

- **P1.M1.T1.S1** (parallel, the resolution core) creates fixtures `README`/`README.md`/`PRD.md`/
  `only.markdown`/`.env` and tests `resolveImportPath` directly. The `PRD.md` fixture exists, so the
  `#@PRD` → `PRD.md` example in the bullet is backed by a real passing test in S1.
- **P1.M1.T1.S2** case 21 uses `#@api` → `api.md` (semantically identical — extensionless → `.md`).
  Case 22 proves exact-wins (`guide` beats `guide.md`). Case 24 proves top-level-exact-only.
- The bullet's example (`#@PRD`) is illustrative for the README; the test fixtures use `api`/`guide`/
  `specdoc` to avoid name collisions (documented in T1.S2's PRP). The README is user-facing prose, so
  `#@PRD` (the PRD's own canonical example, §4.5 rule 3 + §13.6) is the right choice — it matches what
  the PRD and delta PRD use everywhere.

**No contradiction** between the README example and the tests: both demonstrate the same
extensionless→`.md`→`.markdown` ladder; the README uses the PRD's canonical `PRD` token, the tests use
collision-safe fixtures.

## 6. What MUST stay unchanged (the item's explicit prohibitions)

Per item description §3: "Do NOT edit the four existing import bullets, the `#@`-vs-`@` note, the Limits
section, the install/usage sections, or the file-type table." Concretely, the ONLY changes to README.md are:
1. Insert the one new "Extension shorthand" bullet (after "Relative paths only").
2. Change "Four rules narrow it:" → "Five rules narrow it:" (consistency).

Everything else — the Why section, Install, Usage, the `#@spec.md` paragraph, the What-gets-injected table,
the Syntax intro, the other 3 import bullets, Limits (all 8 bullets), the `#@` versus `@` section — is
byte-for-byte preserved.

## 7. Validation approach (documentation has no test gate)

There is no test harness assertion for README content. The item description §6 specifies the verification:
"re-read the surrounding README subsection to confirm the bullet reads coherently in context and does not
contradict the existing import bullets." Concretely:
- `cat README.md` or `read README.md` and eyeball the Syntax → Markdown imports block.
- Confirm 5 bullets, intro says "Five", no contradiction with relative-only / code-exempt / dedup / budget.
- Confirm `#@PRD` example is consistent with the Usage section's `#@spec.md` example (both extensionless-
  or-named markdown imports; no conflict).
- Optional: `git diff README.md` shows ONLY the 1 inserted bullet + the "Four"→"Five" word change.

The broader plan gate (`node ./file-injector.test.mjs`) is UNAFFECTED — README.md is not loaded by the
harness (it imports file-injector.ts via jiti). So the doc change cannot break any test. The PRP's
validation section makes this explicit (Level 1 = eyeball; Level 2 = git diff scope; no test run needed).

## 8. Coordination / no-conflict with sibling tasks

| Sibling | Owns | T2.S1 relationship |
|---|---|---|
| P1.M1.T1.S1 (Complete) | resolveImportPath/isRegularFile/async scanTokens/tryMdExt wiring + per-file JSDoc (Mode A) + README/README.md/PRD.md fixtures | T2.S1 documents the shipped behavior. No file conflict (T2.S1 edits README.md; S1/S2 edit file-injector.ts/.test.mjs). |
| P1.M1.T1.S2 (Ready, parallel) | 8 acceptance runCases (21–24, EDG-1..4) in file-injector.test.mjs | T2.S1 is the Mode B changeset doc; T1.S2's cases are the acceptance proof T2.S1 references. No file conflict. |
| (none beyond) | — | T2.S1 is the ONLY changeset-level doc task in this delta (per item §7). |

**Critical no-conflict:** T2.S1 edits README.md ONLY. S1/S2 edit file-injector.ts / file-injector.test.mjs.
No overlapping files. The README content describes behavior that S1 shipped + S2 validates — by the time
T2.S1 lands, the behavior is fixed and tested.
