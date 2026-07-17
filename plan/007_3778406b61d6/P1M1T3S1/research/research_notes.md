# Research Notes — P1.M1.T3.S1 (plan/007): Verify README.md has no stale test-count or feature references

> **Task type: VERIFICATION-ONLY / Mode B doc sweep.** Read README.md; assert (a) no stale test-count
> reference, (b) no PRD contradiction, (c) behavior descriptions match implemented features. **Expected
> outcome: PASS — README.md is clean; NO edits.** Edit ONLY if a genuine stale reference is found (the
> contract calls this "unlikely").

---

## 1. What this task is (and is NOT)

The v007 delta is a **documentation-only PRD fix** (Done-definition count `24 → 32`, commit `1ad7b19`,
already-applied, zero code changes — per `architecture/delta_analysis.md` and `architecture/system_context.md`).
The count fix lives **exclusively in `PRD.md:1189`** (Appendix A Done-definition prose). **README.md does not
reference that prose at all** — README.md is user-facing docs (install/usage/syntax/limits), not a test-plan doc.

So this subtask is a **read-only coherence check of README.md** against the (unchanged) implemented features.
The deliverable is a **pass/confirm report**. The contract (item §4 OUTPUT) says: "No edits expected."
item §3 LOGIC says: "If README.md is clean (expected), report confirmed."

**The sibling doc gates provide the surrounding context this task is consistent with:**
- **P1.M1.T1.S1 (Complete):** confirmed Done-definition reads "32" + §11 matrix has exactly 32 rows.
- **P1.M1.T1.S2 (Complete):** scanned PRD.md — no OTHER stale "24"-as-test-count (the `| 24 |` row index at
  PRD.md:971 is a row number, not a count — correct, untouched).
- **P1.M1.T2.S1 (Implementing, parallel):** runs `FI_SKIP_E2E=1 bash validate.sh` — the code-regression half.
- **P1.M1.T3.S1 (THIS):** verifies README.md coherence — the doc-sweep half.
- **P1.M1.T3.S2 (Planned):** verifies PRD.md internal consistency. (Independent of T3.S1.)

---

## 2. First-hand verification of README.md (read in full, 136 lines)

### (a) Stale test-count check — PASSED (zero hits)
Ran: `grep -niE "\b(24|32|182|122|38|22)\b|test|cases|done-definition|matrix" README.md`
**Result: NO output.** README.md contains no test-case count, no "test"/"cases"/"matrix"/"done-definition"
word, no number that could be a stale count. It is pure user-facing prose. The 24→32 delta is therefore
**inapplicable** to README.md — there is nothing in it to go stale. This is the expected, contract-mandated
result ("unlikely" a stale reference is found).

### README.md structure (9 sections — verified line anchors)
```
L1   # `#@file`                              # title + intro (paged-delivery phrasing)
L5   ## Why                                  # 3 paragraphs (incl. the composable-for-docs line)
L13  ## Install                              # pi install / pi remove
L21  ## Usage                                # examples + marker-strip + markdown-import example + completion
L45  ## What gets injected                   # 4-row table + markdown-scan note + <file> block-format + images
L66  ## Syntax                               # grammar + Where/Trailing/Paths + **Markdown imports:** (5 rules)
L88  ### Optional: bare-`@` markdown imports # §4.6 config (both forms, 4 precedence sources, trust gate, depth)
L119 ## Limits                               # 9 bullets
L131 ## `#@` versus `@`                      # 2 bullets + closing guidance
```
Matches the section list in the item description (§1): `#@file`, Why, Install, Usage, What gets injected,
Syntax, Optional bare-@ markdown imports, Limits, `#@` versus `@`. ✓

### (b) No PRD contradiction — verified against the PRD selectors (h2.0/h2.1/h2.7)
Every feature the README describes is present and consistent in the PRD, with NO contradiction:

| README claim | PRD source | Consistent? |
|---|---|---|
| `#@<path>` unconditional whole-file delivery | h2.0 Solution | ✓ |
| Paged delivery (head + read-tool directive) when oversize | h2.0/h2.1 §5.5 ref | ✓ |
| Markdown transitive imports (same `#@` directive inside .md) | h2.0 Solution, h2.1 Goal 6 | ✓ |
| Extension shorthand (`#@PRD` → `PRD.md`/`.markdown`) | h2.0 Solution, h2.1 Goal 6 | ✓ |
| Relative-only imports (resolve from md dir; abs/tilde ignored) | h2.1 Goal 6, Non-Goals | ✓ |
| Code is escape hatch (fenced/inline not an import) | h2.1 Goal 6 | ✓ |
| Dedup once across whole prompt (cycles terminate) | h2.1 Goal 6 | ✓ |
| Shared budget (imports page when running total exceeds window) | h2.1 Goal 7 (§5.6.2) | ✓ |
| No transitive imports from non-markdown (only .md/.markdown scanned) | h2.1 Non-Goals | ✓ |
| No extension shorthand at top level (top-level stays exact-match) | h2.1 Non-Goals | ✓ |
| `markdownBareAtImports` opt-in (off by default; 4 sources; trusted-only project) | h2.0 Value prop, h2.1 Goal 3/6 | ✓ |
| Bare-`@` imports stay inside markdown (never injected at prompt) | h2.1 Goal 6, Non-Goals | ✓ |
| File structure: `file-injector.ts` + `package.json` manifest | h2.7 §8 | ✓ |

No README claim contradicts any PRD selector. The README is **more concise** than the PRD (user-facing), but
none of its simplifications are wrong — e.g. README "Five rules" vs PRD's prose are the same rules.

### (c) Behavior descriptions match IMPLEMENTED features — verified against system_context.md checklist
`architecture/system_context.md` "Feature checklist (PRD → code — ALL IMPLEMENTED)" marks every feature
the README describes as ✅ implemented in `file-injector.ts` (1114 lines):
markdown transitive imports, relative-only + resolve-from-dirname, extension shorthand, code escape hatch,
dedup, shared budget, bare-@ option, 4-source config, paged delivery, image/binary/missing handling. **Every
README behavior claim is backed by shipped code** — the README describes nothing unimplemented or speculative.

### Session-006 audit cross-check (the prior coherence confirmation)
`plan/006_1862a6537500/architecture/research-doc-audit.md` Part 3 already audited the README's most complex
section — `### Optional: bare-@ markdown imports` (README.md:88–117) — against PRD §4.6 and found it
**complete and internally consistent** (both config forms ✓; 4 precedence locations ✓; trust gate ✓;
depth-uniform ✓). That audit's only actionable defect was the PRD.md:1189 count (now fixed). **No README
defect was found then, and the v007 delta touched no README content.** So README.md remains coherent.

---

## 3. The verification protocol (what the implementer runs)

This is a read-only check. The "implementation" is three assertion passes + a git-clean check:

1. **(a) Stale-count grep** — `grep -niE "\b(24|32)\b|test|cases|matrix|done-definition" README.md` → expect NO output.
2. **(b) Full read + PRD cross-check** — read README.md (136 lines); confirm every claim traces to the PRD
   selectors (h2.0/h2.1/h2.7) with no contradiction (the table in §2 above is the reference).
3. **(c) Behavior-vs-implementation check** — confirm every README behavior maps to an ✅ row in
   `system_context.md`'s feature checklist (all implemented).
4. **git-clean** — `git status --short README.md` → expect empty (README untouched). This proves the
   verification was read-only and didn't widen scope.

**Edit protocol (only if a genuine stale reference is found — NOT expected):** If grep (a) unexpectedly
returns a stale test-count, fix ONLY that one token (mirroring the PRD.md:1189 fix). Do NOT rewrite
sections, do NOT touch PRD.md/file-injector.ts/tests/package.json. But per research, (a) returns nothing,
so the edit branch should never trigger.

---

## 4. Scope guard (delta_analysis §Risk — binding)

> "Any edit to `file-injector.ts`, tests, `README.md`, or `package.json` would *widen scope* and violate
> the delta's contract."

This is the load-bearing constraint. The default outcome is **PASS — no edit**. The implementer must NOT:
- Rewrite or "improve" README sections (even if wording could be tightened) — that widens scope.
- Touch PRD.md, file-injector.ts, any test, package.json, tsconfig.json, validate.sh.
- Add a test-count reference to README "for completeness" — README deliberately omits test counts (user-facing).

If the README is clean (the verified expectation), the deliverable is a **confirmation report** + an
unchanged `git status`. That IS the success state.

---

## 5. Confidence

**High.** The grep already confirmed (a) returns nothing. The PRD selectors (h2.0/h2.1/h2.7) were read and
every README claim traces cleanly with no contradiction. The feature checklist confirms every described
behavior is implemented. The session-006 audit already confirmed README coherence. The v007 delta touched
zero README content. **Expected result: PASS, README.md unchanged, `git status` clean for README.md.**
