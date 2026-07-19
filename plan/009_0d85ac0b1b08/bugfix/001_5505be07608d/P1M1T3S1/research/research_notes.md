# Research Notes — P1.M1.T3.S1 (bugfix 001): Review README.md for expanded-view multi-file documentation accuracy

> **Task type: DOCUMENTATION REVIEW (Mode B).** Read README.md; verify the expanded-view / multi-file
> rendering statements remain accurate now that the T1.S1 SEP fix (LANDED b1f0727) restored correct
> `ctrl+o` expansion for every file (not just the first). **Expected outcome: README.md is ALREADY accurate
> → NO edits.** The contract explicitly says: "do NOT add unnecessary documentation noise for a display-only
> bugfix that restores already-documented behavior." The deliverable is a confirmation (commit/PR note).

---

## 1. What this task is (and the judgment call)

The v009 bugfix fixed a **display-only** bug: the `ctrl+o` expanded view corrupted every file's body after
the first (a `\\n\\n`-vs-`\\n\\n` separator-literal typo in `computeDetailOffsets`, file-injector.ts L354).
**The model-facing `message.content` was always correct** (the core "whole file reaches the model" contract
held); only the TUI renderer's expanded offset-slice was wrong. T1.S1 fixed the literal (commit b1f0727);
T2.S1 + T2.S2 added unit + E2E regression tests.

This subtask (T3.S1) is the **documentation coherence check**: does README.md describe the expanded-view /
multi-file behavior accurately now that the fix landed? The contract's three specific checks (item §3):

- **(a) Line 41** — 'Press `ctrl+o` to expand any of them to the full contents.'
- **(b) Line 72** — '...with `ctrl+o` to expand.'
- **(c) Line 37** — the 'Diff #@a.ts vs #@b.ts' example.

**The judgment call (item §3 + §4):** if README is already accurate (likely) → **no changes**, confirm in a
commit message / PR description. A bugfix/changelog note may be added ONLY if it adds value (e.g. "multi-file
expansion is now regression-tested"). The contract's explicit steer: **"do NOT add unnecessary documentation
noise for a display-only bugfix that restores already-documented behavior."**

---

## 2. First-hand review of README.md (read in full, 148 lines)

### (a) Line 41 — VERIFIED ACCURATE ✅

> "On submit, each file shows up as a compact green `read <path>` line directly below your message — one line
> per file, indistinguishable from the `read` tool. **Press `ctrl+o` to expand any of them to the full
> contents.** `#@` triggers stay in your message exactly as you typed them …"

Analysis:
- "each file shows up as a compact green `read <path>` line — one line per file" → describes the COLLAPSED
  (default) view, which was **always correct** (the bug only affected the expanded body slice). ✓
- "**expand any of them** to the full contents" → the load-bearing phrase. "any of them" = every file can be
  expanded. **Pre-fix this was FALSE** (only file 0 expanded correctly; files ≥1 were corrupted). **Post-fix
  (T1.S1, LANDED) it is TRUE again** — `computeDetailOffsets` now produces correct offsets for all files.
- This is exactly what `system_context.md` §'Documentation Surface' states: *"README.md line 41 … Already
  describes the correct behavior; the fix restores it."*

**Verdict: line 41 accurately describes the restored behavior. No edit needed.**

### (b) Line 72 — VERIFIED ACCURATE ✅

> "That's what the model receives. You won't see it as raw text in the chat — **each injected file renders as
> a green `read <path>` line (just like the `read` tool), with `ctrl+o` to expand.** Your own message shows
> exactly what you typed …"

Analysis:
- "**each injected file** renders as a green `read <path>` line … with `ctrl+o` to expand" → "each" + "to
  expand" correctly asserts every file is expandable. Post-fix this is true (the E2E regression test
  REND-MULTI-E2E locks it in: both a.ts and b.ts bodies render exact).
- The phrase "That's what the model receives" precedes it — and the model-facing `message.content` was always
  byte-correct (the bug never touched it), so this is accurate both pre- and post-fix.

**Verdict: line 72 accurately describes the restored behavior. No edit needed.**

### (c) Line 37 — VERIFIED, NO RENDERING CLAIM ✅

> ```text
> Diff #@a.ts vs #@b.ts
> ```

This is the Usage example showing a multi-file `#@` prompt. It makes **no claim about expanded rendering** —
it just demonstrates the syntax. Nothing about it is now stale. ✓

### Full scan for any OTHER expanded-view / multi-file / rendering statement

Grepped README.md for `ctrl+o|expand|Diff #@|render|read.*line`. The ONLY expanded-view statements are the
two at L41 and L72 (both verified accurate above). No other claim about multi-file rendering, "expand
together", per-file expansion guarantees, or offset slicing exists in the README. There is:
- **No CHANGELOG.md** and **no `docs/` directory** (confirmed via `system_context.md` §'Documentation Surface'
  and the repo tree). So there is no changelog to update.
- **No "Known issues", "Limitations re: display", or version/release-notes section** in README.md that would
  need a fix entry.
- **No stale claim** like "expansion works for single files" or "multi-file expansion is unsupported" — the
  README's phrasing ("any of them", "each injected file") was always the CORRECT, general statement; the bug
  violated it, the fix honors it.

---

## 3. The judgment call: no edit (the documented behavior is restored, not changed)

The contract's decision tree (item §3) resolves cleanly:

1. **Is README accurate?** YES (lines 41, 72 verified; nothing else touches expanded rendering).
2. **Would a changelog/bugfix note add value?** Marginally, but **no** is the right call:
   - The bug was **display-only** and **transient** (model delivery was always correct). A user-facing README
     documents the product's behavior, not its historical defects. The README never documented the bug, so
     there's nothing to "correct" — the fix makes reality match the docs.
   - There is **no CHANGELOG.md** to append to. Creating a new CHANGELOG convention for a single display-only
     fix is scope creep the contract explicitly cautions against ("do NOT add unnecessary documentation noise").
   - The **regression coverage** (T2.S1 REND-MULTI-OFFSET unit + T2.S2 REND-MULTI-E2E integration) is the
     durable artifact; a README sentence saying "now regression-tested" adds no user value and would itself
     become stale-looking over time.
3. **Item §4 OUTPUT:** "README.md either unchanged (confirmed accurate) or with a minor note if warranted."
   → **unchanged** is warranted here.

**Expected deliverable:** a confirmation (commit message / PR description) that README.md lines 41 and 72
accurately describe the restored `ctrl+o` multi-file expansion, with `git status` showing README.md untouched.

---

## 4. Scope boundary & non-goals (guard against over-editing)

- Do NOT edit README.md. The default outcome is confirmation, not modification. The README's phrasing was
  always the *correct* general statement; the bug violated it, the fix honors it.
- Do NOT create a CHANGELOG.md or `docs/` directory. The project ships neither; inventing one for a display-
  only fix is scope creep (item §3: "do NOT add unnecessary documentation noise").
- Do NOT touch PRD.md, file-injector.ts, the 3 test files, package.json, tsconfig.json, validate.sh.
- Do NOT add a "regression-tested" sentence, a version note, or a bugfix bullet to the README — they add no
  user value and age poorly.
- If (unexpectedly) a stale expanded-view claim were found, the only permitted edit is a surgical rewording
  of THAT sentence to match the restored behavior — not a section rewrite. (Research confirms no such claim
  exists.)

---

## 5. Confidence

**High.** Lines 41 and 72 were read verbatim and verified accurate (both describe the post-fix behavior: every
file expands correctly). The full README was scanned for any other expanded-view / rendering statement — none
exists beyond those two. There is no CHANGELOG/docs dir to update. The contract's explicit steer ("do NOT add
documentation noise for a display-only bugfix that restores already-documented behavior") points squarely at
**no edit**. The T1.S1 fix is LANDED (b1f0727), so the documented behavior is real. **Expected result: README.md
unchanged; confirmation recorded in the commit/PR note.**