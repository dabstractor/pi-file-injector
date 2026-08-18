---
name: "P1.M4.T6.S2 — spec/ consistency pass over changeset-touched parts (spec/17 LR-3 clause, BUG-001 bodies[i] drift in spec/09+16+12, rider verification)"
prd_ref: "bugfix PRD §h2.5 Recommendations (BUG-002 bullet: mirror the LR-3 warning into injectMarkdown; BUG-001 bullet: body pairing); work-item contract (a)–(d); architecture/system_context.md § Documentation plan; architecture/spec_ux_bug004_005.md § docs landscape"
target_files: "./spec/17-line-ranges.md (3 small edits: LR-3 in-markdown clause + drop stale sentence; §3 step-3 wording; §8 edge row), ./spec/09-algorithm.md (renderer pseudocode: bodies[i] + 'align by index' header → path-paired FIFO), ./spec/16-appendix-skeleton.md (same pairing fix, incl. name-capture group), ./spec/12-implementation-notes.md (one clause in note 23). spec/06, spec/15, spec/14 = VERIFY-ONLY, zero bytes changed unless a contradiction is found. README.md = FORBIDDEN (sibling task P1.M4.T6.S1). No code, no tests, no package.json."
target_language: Markdown (hand-written spec; contains ts pseudocode blocks. Gates = post-edit greps + one clean-tree confirmation run: npm test all 4 suites + npm run typecheck 0 errors)
depends_on: "ALL SEVEN implementing subtasks COMPLETE in the tree (verified at working-tree HEAD 10d61bc: BUG-001 trio 21bf4fa/c626928/71e9f45, BUG-002 guard (invalidRange ×5), BUG-003 fe766bd, BUG-004 3c0bb5d, BUG-005 10d61bc — ftp rider in spec/15 §2.2/§7/§8 and pass-through rider in spec/14 §14.2 both landed). Mode B: runs after every implementing subtask. Sibling P1.M4.T6.S1 (README sweep, dir P1M4T1S1) may run in parallel — zero file overlap."
consumed_by: "Nothing downstream (final spec task of the changeset)."
research: "plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T6S2/research/research_notes.md (verification snapshot at HEAD 10d61bc: rider states, exact anchors, pre-flight + validation greps all confirmed)"
---

# PRP — P1.M4.T6.S2: spec/ consistency pass over changeset-touched parts

> **Scope flag:** Docs-only, Mode B (final docs sync). Exactly FOUR spec files may gain edits —
> `spec/17-line-ranges.md` (3 small BUG-002/LR-3 edits), `spec/09-algorithm.md`,
> `spec/16-appendix-skeleton.md`, `spec/12-implementation-notes.md` (the BUG-001 `bodies[i]`
> index-pairing drift). THREE parts are verify-only (`spec/06`, `spec/15`, `spec/14` — riders
> confirmed landed at HEAD 10d61bc; record pass/fail, edit ONLY on a found contradiction).
> **No code. No tests. No README. No rewrites.** Every hunk must trace to BUG-001..BUG-005.
> Contract: "do NOT rewrite unrelated spec parts — minimal corrections only, each traceable to
> one of the five PRD issues." Finish with ONE `npm test` + `npm run typecheck` run (clean-tree
> confirmation).

---

## Goal

**Feature Goal:** `spec/` (the hand-written 17-file PRD, source of truth) is consistent with the
shipped behavior of all five fixes: LR-3's wording covers malformed ranges inside DELIVERED
markdown files (mirroring the P1.M2.T2.S1 guard), no spec text describes the pre-BUG-001
`bodies[i]` index pairing, no stale pre-fix sentences remain, and the BUG-004/BUG-005 rider edits
in spec/14 §14.2 and spec/15 §2.2/§7/§8 are confirmed present and internally consistent.

**Deliverable:** Modified `spec/17-line-ranges.md`, `spec/09-algorithm.md`,
`spec/16-appendix-skeleton.md`, `spec/12-implementation-notes.md` (minimal, traceable edits);
a pass/fail verification record for spec/06, spec/15, spec/14; one green clean-tree run.

**Success Definition:**
1. Pre-flight greps (Task 0) confirm all seven dependency fixes + both riders are in the tree —
   spec must never be "corrected" away from shipped behavior.
2. Post-edit greps: `grep -rn "bodies\[i\]" spec/` → zero hits; `grep -rn "align by index" spec/`
   → zero hits; the spec/17 LR-3 bullet contains the in-markdown clause;
   `grep -n "Today these tokens vanish" spec/17-line-ranges.md` → zero hits.
3. `git diff` shows ONLY the four intended spec files (README.md untouched — sibling task).
4. Every changed hunk is annotated in the task report with its BUG ID (BUG-001 or BUG-002);
   verify-only parts show verdicts with quoted evidence.
5. `npm test` (4 suites green) + `npm run typecheck` (0 errors), run once after edits.

## User Persona (if applicable)

**Target User:** The project's future maintainer/contributor reading `spec/` (via `spec/SPEC.md`'s
`@path` index) to understand what the extension actually does — and the AI agents that use spec/
as the implementation contract for future changes.

**Use Case:** Maintainer reads spec/17 §6 to learn what happens to `#@notes.md:0` typed inside a
delivered markdown file; reads spec/09's renderer pseudocode to understand how expanded-view
bodies pair with details after a paged file; reads spec/15 §7 to learn what `#ftp://…` does.

**Pain Points Addressed:** Spec/code drift — the PRD's own findings (BUG-001: spec/06's
expanded-view promises were violated by the shipped renderer; BUG-002: LR-3 was silent inside
markdown) showed spec statements the code didn't honor. The code is now fixed; this task makes
the spec tell the same story, with no stale pre-fix sentences left behind.

## Why

- **The PRD's evidence sentences must become true and stay true.** The PRD cited spec parts as
  evidence of the bugs ("Expanded view shows the extracted markdown" — spec/15 §6; "expanded shows
  the same note text" — PRD §10 rows on spec/06). BUG-001 fixed the code; this pass confirms the
  spec statements are now literally true and removes spec-side descriptions of the broken
  mechanism (`bodies[i]` in spec/09/spec/16/spec/12) that would mislead a future reimplementation.
- **LR-3 parity is a spec-level requirement.** spec/17 §6 is normative ("malformed ranges are not
  silent") but its wording covers only the prompt level, and it retains a stale sentence
  describing the pre-fix silent behavior. The P1.M2.T2.S1 fix extended the warning into the
  delivered-markdown scan; the spec must say so — otherwise a future refactor guided by spec/17
  would regress BUG-002.
- **Rider verification closes the loop.** Mode A riders (spec/15 §2.2/§7/§8 from P1.M3.T5.S1,
  spec/14 §14.2 from P1.M3.T4.S1) landed with their implementing commits; the changeset-level pass
  (this task) is chartered to cross-check they are present AND internally consistent across the
  same file.

## What

Four files gain minimal edits; three are verification-only. No other file changes.

### Edit set A — spec/17-line-ranges.md (traces to BUG-002; the contract's item (a))

- **A1.** §6 LR-3 bullet (grep anchor: `**LR-3 — malformed ranges are not silent.**`, at ~:85):
  delete the stale trailing sentence `Today these tokens vanish with zero feedback.` (pre-fix
  state, now false at BOTH levels), drop the pre-fix parenthetical `(current behavior)`, and
  append the in-markdown clause so the bullet ends:

  > … is left verbatim **and** reports a hasUI-guarded warning notify, e.g. `#@a.ts:0 — not
  > injected (range must be :N or :N-M, M ≥ N ≥ 1)` — uniformly at the prompt **and** inside a
  > delivered markdown file: the import scan's malformed-range guard mirrors the prompt-level one
  > (the marker stays verbatim in the shipped body, the warning fires with `hasUI`, and the raw
  > token is never re-injected as a path).

- **A2.** §3 step 3 (grep anchor: `Still unresolved → verbatim`, at ~:43): change
  `3. Still unresolved → verbatim (LR-3 may add a notify).` to
  `3. Still unresolved → verbatim **and** the LR-3 warning notify (prompt level and delivered-markdown scan alike).`
- **A3.** §8 edge table: add one row directly under the existing row anchored by
  `| \`#@a.ts:0\` / \`#@a.ts:5-3\` |` (~:100; it ends `**+ warning notify** (LR-3). |`):

  > | `#@a.md:0` inside a delivered markdown file | Same as above — marker stays verbatim in the shipped body **+ warning notify** (LR-3 parity between prompt and import scan); the raw token is never resolved or injected. |

- KEEP untouched: the LR-4/LR-5 bullets (~:86-87), the §8 acceptance rows (~:122, LINE-10 — its
  top-level wording remains true), §2.2, everything else.

### Edit set B — BUG-001 renderer-pairing drift (the contract's item (b), mechanics residue)

- **B1. spec/09-algorithm.md** §6.3-region pseudocode (~:400-427). THREE anchors, not two:
  (i) the header comment at ~:402-403 ending `…are co-emitted in the same order (§6.4), so they
  align by index.` is ALSO drift (blocks and details are NOT 1:1 — a paged file is 2 blocks /
  1 detail); (ii) the comment `// pair each detail with its block body (re-parsed from content)
  by index` (~:406) plus the `bodies` array build (~:408-412); (iii) `const body = bodies[i];`
  (~:425). Replace with the shipped path-aware FIFO (exact text in Implementation Blueprint §
  "Renderer pairing"). Note: this block's FILE_BLOCK_RE already captures the name as group 1
  and the body as group 2 (m[2] is pushed today) — no regex change needed here.
- **B2. spec/16-appendix-skeleton.md** skeleton renderer (~:70-84; grep anchors:
  `files.forEach((d, i) =>` and `bodies[i] !== undefined`): same pairing change — NOTE the
  skeleton's inline regex `/<file name="[^"]+">([\s\S]*?)<\/file>/g` does NOT capture the name
  (its group 1 is the BODY, used as m[1] at ~:76); the fix must add the capture group
  `name="([^"]+)"` so paths can be keyed, and the body becomes m[2].
- **B3. spec/12-implementation-notes.md** note 23 (~:25; grep anchor: `` guard `bodies[i]` ``):
  reword the defensive-guard clause to the path-paired pop (see Blueprint). Change ONLY that
  clause; the rest of note 23 stays verbatim.

### Verification-only set C (the contract's items (b) prose + (c)) — record verdicts, fix ONLY on contradiction

- **C1. spec/06-delivery-display.md** (BUG-001 prose): confirm the §6.3 expanded bullet
  (~:94; anchor: `each file's full delivered text renders below its`) and the §6.4 details
  statement (~:111; anchor: `parallel to \`blocks\` emission order`) are literally true post-fix.
  Research verdict: **PASS, no edit** — :94 is a per-file promise now honored; :111 is an ORDER
  statement (pre-order emission), never a 1:1 index-parity claim. Edit only if you find wording
  that describes index-based body recovery or a shared-body claim.
- **C2. spec/15-url-injection.md** (BUG-005 rider): confirm the rider anchors — ~:71 §2.2 regex
  literal `(https?|ftp)`; ~:325 §7 ftp edge row (accepted by gate, undici throws, verbatim via
  §3.5 catch, spinner may flash — the wrong `(Node supports it)` must be gone:
  `grep -n "Node supports it" spec/15-url-injection.md` → 0 hits); ~:333 §8 pseudocode regex;
  ~:347 §8 normalization `/^(https?|ftp):\/\//i`. Sweep `grep -n "https" spec/15-url-injection.md`
  — every hit must be consistent with "gate accepts ftp; only http(s) is fetchable". Research
  verdict: **all landed at commit 10d61bc, internally consistent, no edit.**
- **C3. spec/14-autocomplete.md** (BUG-004 rider): confirm §14.2 (~:28; anchor:
  `passed through untouched`) documents non-`@`/non-`#@`/non-string values passing through, and
  that §14.3/§14.4 don't contradict it. Research verdict: **landed, consistent, no edit.**
- **C4. BUG-003 sweep:** `grep -n -i "empty" spec/15-url-injection.md` — spec/15 makes no
  empty-image-body promise (hits are SPA/empty-extraction §3.4 at :40/:160/:169/:379/:446,
  unrelated), so the README rider (sibling task) carries the whole story. Expected verdict:
  **no spec edit.**

### Success Criteria

- [ ] Task 0 pre-flight greps all hit BEFORE any edit (7 marker greps below).
- [ ] Edit sets A (3 edits) and B (3 files) applied exactly; each annotated with its BUG ID.
- [ ] Verify-only set C: verdicts recorded for C1–C4 with quoted anchor lines; zero edits unless
      a contradiction was found (any such edit documented and traceable).
- [ ] Post-edit greps pass: `bodies\[i\]` → 0 hits in spec/; `align by index` → 0 hits in spec/;
      `Today these tokens vanish` → 0 hits; `inside a delivered markdown file` present in spec/17.
- [ ] `npm test` green (all 4 suites) + `npm run typecheck` → 0 errors, run once after edits.
- [ ] `git diff` → ONLY the intended spec files; README.md and all code files untouched.

## All Needed Context

### Context Completeness Check

"If someone knew nothing about this codebase, could they implement this from the PRP alone?" —
Yes: every edit target is quoted with unique grep anchors (line numbers drift; anchors don't),
exact replacement text is provided for all six edits, the verify-only checks list their anchors
and expected verdicts, and validation is grep + the repo's two gates.

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: spec/17-line-ranges.md
  why: Edit set A — §6 LR-3 bullet (~:85), §3 step 3 (~:43), §8 edge table (~:100)
  pattern: normative bullets "**LR-n — …**" in §6; pipe-table rows in §8; numbered retry-ladder in §3
  gotcha: keep the LR-3 bullet's first sentence intact (it is the normative requirement); only the
    trailing stale sentence, the "(current behavior)" parenthetical, and the appended clause change

- file: spec/09-algorithm.md
  why: Edit B1 — renderInjectedMessage pseudocode (~:400-427); THREE anchors incl. the
    "so they align by index" header comment (~:402-403)
  pattern: ts fenced block; FILE_BLOCK_RE group 1 = name, group 2 = body (m[2] is pushed today)
  gotcha: do NOT retrofit the 3-tier body recovery (offsets/stored-body/regex) into this block —
    one parenthetical acknowledging offsets-first is the maximum allowed

- file: spec/16-appendix-skeleton.md
  why: Edit B2 — skeleton renderer (~:70-84)
  pattern: compressed one-line style inside files.forEach
  gotcha: its inline regex lacks a name capture group (group 1 = body, read as m[1]) — add
    `name="([^"]+)"` and switch the body to m[2], or the keying breaks

- file: spec/12-implementation-notes.md
  why: Edit B3 — note 23 (~:25, "Renderer must be defensive and never throw")
  pattern: numbered bold-lead notes, backticked identifiers
  gotcha: change ONLY the `guard \`bodies[i]\`` clause; the rest of note 23 stays verbatim

- file: spec/06-delivery-display.md
  why: Verify C1 — ~:94 expanded bullet, ~:111 details statement (BUG-001 evidence prose)
  pattern: §6.3 bullets "Collapsed (default):" / "Expanded (ctrl+o):"
  gotcha: expected NO edit — per-file body promise (now true) + pre-order ordering (always true)

- file: spec/15-url-injection.md
  why: Verify C2 — §2.2 (~:71), §7 ftp row (~:325), §8 pseudocode (~:333/:347) ftp rider consistency
  pattern: §7 pipe-table rows; §8 ts pseudocode block
  gotcha: rider landed at commit 10d61bc — if ANY anchor is missing, STOP and report (do not redo
    P1.M3.T5.S1's job; its PRP owns those edits)

- file: spec/14-autocomplete.md
  why: Verify C3 — §14.2 pass-through sentence (~:28)
  pattern: "Option 2 rejected / Shipped: Option 1" narrative
  gotcha: expected landed (commit 3c0bb5d); §14.3 non-goals + §14.4 scope are UNRELATED — do not touch

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T6S2/research/research_notes.md
  why: verification snapshot — rider states, exact anchors at HEAD 10d61bc, pre-flight evidence
  gotcha: HEAD may drift further — re-grep anchors, never trust line numbers

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/system_context.md
  why: § Documentation plan (Mode A vs Mode B split — which rider went where); § verified root
    causes (BUG-001/BUG-002 mechanics this pass must reflect)
  section: "Documentation plan", "Verified root causes"

- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M4T6S1/PRP.md
  why: sibling README-sweep contract (dir P1M4T1S1) — proves ZERO file overlap (it forbids spec/;
    you forbid README.md) and shares the same dependency set
  gotcha: do not duplicate its two README sentences or its spec-adjacent checks

- file: file-injector.ts   # READ-ONLY — pre-flight greps + the mechanism spec edits must mirror
  why: ~:1063-1120 renderInjectedMessage tier-3 `bodiesByPath` FIFO (:1078 comment explains paged
    2-blocks/1-detail; :1091-1100 build; JSDoc :1063 names the pop guard); :46 URL_SHAPE_RE ftp
  gotcha: never edit it; cite it, don't copy whole functions into spec
```

### Current Codebase tree (docs-relevant only)

```bash
# run: git log --oneline -8 && ls spec/
spec/
  SPEC.md                   # index — @path includes per part (01…17); no bodies[i] text (verified)
  06-delivery-display.md    # verify-only (BUG-001 prose promises)
  09-algorithm.md           # EDIT: bodies[i] + "align by index" header → path-paired FIFO (~:400-427)
  12-implementation-notes.md# EDIT: note 23 guard clause (~:25)
  14-autocomplete.md        # verify-only (BUG-004 rider §14.2, landed 3c0bb5d)
  15-url-injection.md       # verify-only (BUG-005 rider §2.2/§7/§8, landed 10d61bc)
  16-appendix-skeleton.md   # EDIT: skeleton pairing + name capture (~:70-84)
  17-line-ranges.md         # EDIT ×3: LR-3 clause (~:85), §3 step 3 (~:43), §8 row (~:100)
README.md                   # FORBIDDEN — sibling P1.M4.T6.S1 (dir P1M4T1S1); staged M in the tree
file-injector.ts            # read-only (pre-flight greps, mechanism reference)
# git log (changeset): 10d61bc BUG-005 | 3c0bb5d BUG-004 | fa724b7/fe766bd BUG-003 |
#   71e9f45/c626928/21bf4fa BUG-001 | BUG-002 guard (invalidRange)
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
# No new files. Four spec parts gain minimal, traceable corrections:
spec/17-line-ranges.md     # LR-3 now covers delivered-markdown scanning; no stale pre-fix claims
spec/09-algorithm.md       # renderer pseudocode pairs bodies by path (paged = 2 blocks / 1 detail)
spec/16-appendix-skeleton.md # skeleton renderer idem (+ name capture group in its regex)
spec/12-implementation-notes.md # note 23's defensive guard names the path-paired pop
```

### Known Gotchas of our codebase & Library Quirks

```markdown
# CRITICAL: spec/ is the source of truth and code matches it NOW — pre-flight greps are a hard
# gate. If any dependency marker is missing, STOP and report rather than "correcting" spec toward
# unshipped behavior.

# CRITICAL: anchor every edit by a grep'd unique string. Line numbers in this PRP are from HEAD
# 10d61bc and WILL drift (rider commits already shifted them once).

# GOTCHA: spec/09's FILE_BLOCK_RE pseudocode already captures the name as group 1 (m[2] = body);
# spec/16's inline regex does NOT (group 1 = body). Adding the capture group to spec/16 is part
# of the fix, not a stylistic choice.

# GOTCHA: spec/09's ~:402 header comment "so they align by index" is drift TOO — blocks and
# details are only order-aligned, never 1:1 (paged = 2 blocks / 1 detail). Fix all three B1
# anchors or grep "bodies\[i\]" still leaves an index-pairing claim behind.

# GOTCHA: the paged caveat is the REASON for path pairing — keep it in the spec comment ("a paged
# path emits TWO blocks — head + directive — but ONE detail, so index pairing drifts +1") so a
# future reader doesn't "simplify" it back to bodies[i].

# GOTCHA: do NOT document the full 3-tier body recovery (offsets / stored body / regex) in
# spec/09 — that's prior-changeset scope, not traceable to BUG-001..005. One parenthetical
# ("real entries recover bodies via stored offsets first; this regex is the defensive fallback")
# is the maximum.

# GOTCHA: spec/15 §8 pseudocode and §2.2 already agree (both `(https?|ftp)`); if you "fix" one,
# you desync the other. Verification only — hands off unless a genuine contradiction appears.

# GOTCHA: sibling task owns README.md (staged M in the tree — that diff is EXPECTED, not yours);
# its two sentences deliberately do NOT duplicate what spec/17 says. Do not port them.

# GOTCHA: leave VCS state alone — earlier subtasks left commits; just don't revert or stage
# unrelated work. The orchestrator handles commit bookkeeping.
```

## Implementation Blueprint

### Data models and structure

None — Markdown spec edits. The "models" are the exact replacement texts:

### Renderer pairing (Edit B1 — spec/09-algorithm.md)

Fix all THREE anchors. First the header comment (~:402-403):

```ts
// CURRENT:  // co-emitted in the same order (§6.4), so they align by index.
// REPLACEMENT:
//          // emitted in the same order (§6.4). Blocks and details are order-aligned but NOT
//          // 1:1 — a paged path emits TWO blocks (head + directive) for ONE detail.
```

Then the bodies build + the loop's body fetch:

```ts
  // CURRENT (drift, BUG-001):
  // pair each detail with its block body (re-parsed from content) by index
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0;
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) bodies.push(m[2].replace(/^\n|\n$/g, ""));
  }
  ...
      const body = bodies[i];

  // REPLACEMENT (path-paired FIFO — mirrors shipped file-injector.ts ~:1063-1120):
  // pair each detail with its block body (re-parsed from content) BY PATH, not by index:
  // a paged path emits TWO blocks (head + directive) but ONE detail, so index pairing drifts
  // +1 per preceding paged file and would show the directive as a following url/binary body.
  // (Real entries recover bodies via stored offsets first; this regex is the defensive fallback.)
  const bodiesByPath = new Map<string, string[]>();   // path → FIFO of block bodies, emission order
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0;
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
      const q = bodiesByPath.get(m[1]) ?? [];
      q.push(m[2].replace(/^\n|\n$/g, ""));
      bodiesByPath.set(m[1], q);
    }
  }
  ...
      const body = bodiesByPath.get(d.path)?.shift(); // pop in emission order; a paged detail pops its head
```

(The surrounding `for (let i = 0; i < files.length; i++)` loop stays — `i` is still used for the
first-file expand hint; only the body fetch line changes.)

### Skeleton pairing (Edit B2 — spec/16-appendix-skeleton.md)

```ts
  // CURRENT (~:75-84):  const bodies: string[] = [];
  //   for (const m of message.content.matchAll(/<file name="[^"]+">([\s\S]*?)<\/file>/g)) bodies.push(m[1].replace(/^\n|\n$/g, ""));
  //   ... if (opts.expanded && bodies[i] !== undefined && d.kind !== "image") { ... bodies[i] ... }
  // REPLACEMENT (keep the compressed one-line skeleton style):
  const bodiesByPath = new Map<string, string[]>();  // path → FIFO (paged = 2 blocks / 1 detail; index pairing mis-fires)
  if (typeof message?.content === "string")
    for (const m of message.content.matchAll(/<file name="([^"]+)">([\s\S]*?)<\/file>/g)) {
      const q = bodiesByPath.get(m[1]) ?? []; q.push(m[2].replace(/^\n|\n$/g, "")); bodiesByPath.set(m[1], q);
    }
  ...
    if (opts.expanded && d.kind !== "image") {
      const body = bodiesByPath.get(d.path)?.shift();   // path-paired pop (BUG-001); undefined → no body child
      if (body !== undefined) {
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        box.addChild(new Text(theme.fg("toolOutput", lang ? highlightCode(body, lang).join("\n") : body), 0, 0));
      }
    }
```

### Note 23 clause (Edit B3 — spec/12-implementation-notes.md)

```markdown
# CURRENT: "… Guard `message.details?.files` (may be absent on old/foreign entries), guard `bodies[i]`,
#           and short-circuit the image expanded-view (…)"
# REPLACEMENT: "… Guard `message.details?.files` (may be absent on old/foreign entries), guard the
#           path-paired body pop (`bodiesByPath.get(d.path)?.shift()` — a paged file is 2 blocks /
#           1 detail, so index pairing mis-fires; BUG-001), and short-circuit the image
#           expanded-view (images are already attached to the user message; don't re-render them)."
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 0: PRE-FLIGHT — verify dependencies + riders in tree (read-only; HARD GATE)
  - RUN (expect all to hit; verified at HEAD 10d61bc — see research notes):
    1. grep -c "invalidRange" file-injector.ts           # ≥3 (was 5 at research time; BUG-002 both guards)
    2. grep -n "bodiesByPath" file-injector.ts           # ≥2 (BUG-001 tier-3 path-aware, ~:1063-1120)
    3. grep -n '(https?|ftp)' file-injector.ts           # ~:46 URL_SHAPE_RE (BUG-005)
    4. grep -c 'formatEmptyImageBlock' file-injector.ts  # ≥2 (BUG-003 F5 mirror)
    5. grep -n 'startsWith("@")' file-injector.ts        # ~:1974 item pass-through (BUG-004)
    6. grep -n '(https?|ftp)' spec/15-url-injection.md   # rider landed (~:71/:333/:347)
    7. grep -n 'passed through untouched' spec/14-autocomplete.md  # rider landed (§14.2 ~:28)
  - IF any marker missing → STOP, report "dependency/rider not landed", edit nothing
  - READ the seven spec parts listed in §Documentation & References (17, 09, 16, 12 fully;
    06, 15, 14 the cited sections)

Task 1: EDIT SET A — spec/17-line-ranges.md (BUG-002 traceable; contract item (a))
  - A1: grep -n "LR-3 — malformed ranges" → apply the What §A1 replacement
    (delete "Today these tokens vanish with zero feedback.", drop "(current behavior)",
    append the in-markdown clause verbatim from What §A1)
  - A2: grep -n "Still unresolved → verbatim" → apply the What §A2 replacement
  - A3: grep -n '#@a.ts:0' → insert the What §A3 row directly under the :100 edge-table row
  - KEEP: LR-4/LR-5 bullets, §8 acceptance rows, §2.2, everything else

Task 2: EDIT SET B — BUG-001 bodies[i] drift (contract item (b) mechanics)
  - B1: spec/09-algorithm.md — grep -n "align by index", "by index", "bodies\[i\]" → apply ALL
    THREE Blueprint "Renderer pairing" replacements (header comment + bodies build + pop)
  - B2: spec/16-appendix-skeleton.md — grep -n "files.forEach" → apply the Blueprint
    "Skeleton pairing" replacement (ADD the name capture group; body becomes m[2])
  - B3: spec/12-implementation-notes.md — grep -n "guard \`bodies\[i\]\`" → apply the
    Blueprint "Note 23 clause" replacement
  - DO NOT: document the 3-tier recovery beyond the one parenthetical; reformat neighboring code

Task 3: VERIFY-ONLY SET C (contract items (b) prose + (c)) — record verdicts with quoted lines
  - C1: spec/06 — grep -n "full delivered text renders" (§6.3 expanded bullet ~:94) and
    grep -n "parallel to" (§6.4 details bullet ~:111). Expected PASS (per-file promise + order claim).
  - C2: spec/15 — confirm the rider anchors (§2.2 regex ~:71, §7 ftp row, §8 regex ~:333, §8
    normalization ~:347); sweep grep -n "https" spec/15-url-injection.md for contradictions; confirm
    "(Node supports it)" is absent: grep -n "Node supports it" spec/15-url-injection.md → 0 hits
  - C3: spec/14 — grep -n "passed through untouched" → read §14.2 in full; §14.3/§14.4 uncontradicted
  - C4: BUG-003 — grep -n -i "empty" spec/15-url-injection.md → only SPA/§3.4 rows (no image
    promise); README sibling carries the story. Expected: no edit.
  - ON CONTRADICTION ONLY: minimal clause fix, annotated with its BUG ID in the task report

Task 4: SCOPE AUDIT (contract item (d))
  - RUN: git diff --stat            # ONLY the intended spec files (≤4 unless C forced a fix);
                                     # the staged README.md diff belongs to the sibling — leave it
  - RUN: git diff -- spec/          # your hunks only (README is staged by S1 — not yours to touch)
  - REVIEW each hunk: maps to BUG-001 or BUG-002 (or a documented C-fix)? If not — revert it.

Task 5: CLEAN-TREE CONFIRMATION (run ONCE, after all edits)
  - RUN: npm test          # all 4 suites green (file-injector / import-behavior / relative-imports / url-injection)
  - RUN: npm run typecheck # 0 errors (node ./scripts/typecheck.mjs)
```

### Implementation Patterns & Key Details

```markdown
# PATTERN: minimal-traceable editing. Every hunk answers "which BUG made this necessary?" in a
# nearby comment or the task report. Example — B1's comment does double duty (mechanism + why):
#   // a paged path emits TWO blocks (head + directive) but ONE detail, so index pairing drifts
#   // +1 per preceding paged file and would show the directive as a following url/binary body.

# PATTERN: LR-3 parity wording — the spec clause mirrors what the code does at BOTH call sites
# (processTokenStream and injectMarkdown Step-5): marker verbatim in the shipped body, hasUI-
# guarded warning, raw token never re-injected as a path (that last phrase kills the BUG-002
# process-cwd stat / relative-block-name leak forever in spec terms).

# CRITICAL: spec pseudocode stays pseudocode — mirror the shipped MECHANISM (bodiesByPath FIFO
# popped in emission order), not the full function; don't paste file-injector.ts into spec/.
```

### Integration Points

```yaml
CODE: none (read-only greps + mechanism mirroring only)
README: none — README.md belongs to sibling P1.M4.T6.S1 (dir P1M4T1S1); do not touch
SPEC INDEX: none — spec/SPEC.md needs no change (part list and titles unchanged)
CONFIG / ROUTES / DATABASE: none apply
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# No markdown linter in this repo — verify by inspection + grep:
grep -n "inside a delivered markdown file" spec/17-line-ranges.md   # present (A1 clause)
grep -n "Today these tokens vanish" spec/17-line-ranges.md          # ZERO hits (stale sentence gone)
grep -n "may add a notify" spec/17-line-ranges.md                   # ZERO hits (A2 landed)
grep -rn "bodies\[i\]" spec/                                        # ZERO hits anywhere
grep -rn "align by index" spec/                                     # ZERO hits (B1 header fixed)
grep -n "bodiesByPath" spec/09-algorithm.md spec/16-appendix-skeleton.md  # present in both
# Re-read each edited region: table pipes aligned with neighbors, ts fences still balanced,
# spec cross-refs (§numbers) valid — A1 references no new §; B-comments reference none either.
```

### Level 2: Unit Tests (Component Validation)

```bash
# None for docs — the repo has no spec/markdown test. Level 3's clean-tree run covers regression.
```

### Level 3: Integration Testing (System Validation)

```bash
# Clean-tree confirmation (required by the work-item contract — run ONCE after edits):
npm test            # expect: all 4 suites pass
npm run typecheck   # expect: 0 errors
# Scope:
git diff --stat     # ONLY intended spec files (spec/17, spec/09, spec/16, spec/12; +any C-fix)
                    # staged README.md (sibling S1) is expected and untouched by you
git diff -- spec/   # your hunks only
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Spec-vs-code cross-checks (the point of the whole task):
grep -n "bodiesByPath" file-injector.ts | head -3   # the shipped mechanism the spec now mirrors
grep -n "invalidRange" file-injector.ts | head -4   # both guard sites (prompt + markdown scan)
grep -n '(https?|ftp)' spec/15-url-injection.md     # 3 rider hits, matching file-injector.ts:46
# Traceability audit: list every hunk from `git diff -U1 -- spec/` and annotate BUG-001/BUG-002
# (or the C-contradiction that forced it). A hunk with no BUG ID = scope violation → revert.
```

## Final Validation Checklist

### Technical Validation

- [ ] Task 0 pre-flight: all 7 marker greps hit before any edit.
- [ ] Edit sets A (A1–A3) and B (B1–B3, incl. spec/09's header comment) applied; Level-1 greps pass.
- [ ] Set C verdicts recorded for C1–C4 with quoted anchor lines; edits only on contradiction.
- [ ] `npm test` green + `npm run typecheck` 0 errors (one run, after edits).
- [ ] `git diff --stat` → only intended spec files; README.md not touched by you.

### Feature Validation

- [ ] All success criteria from "What" met.
- [ ] spec/17 LR-3 now covers prompt AND delivered-markdown; no stale pre-fix sentences remain.
- [ ] No spec part describes index-based body pairing; spec/09+16 pseudocode pairs by path with
      the paged 2-blocks/1-detail caveat; spec/12 note 23 names the path-paired pop.
- [ ] spec/15 §2.2/§7/§8 internally consistent (rider verified); spec/14 §14.2 consistent.

### Code Quality Validation

- [ ] Spec voice/style preserved (normative bullets, pipe tables, pseudocode fences, §refs,
      compressed skeleton style in spec/16).
- [ ] Net diff is a handful of hunks — a sweep, not a rewrite; unrelated parts untouched.
- [ ] Every hunk traceable to BUG-001..BUG-005 (annotated in the task report).

### Documentation & Deployment

- [ ] spec/SPEC.md index still accurate (titles/list unchanged — verify with head -12).
- [ ] No code, test, config, or README changes; no new files.

---

## Anti-Patterns to Avoid

- ❌ Don't rewrite or "improve" unrelated spec parts — minimal corrections only, each traceable
  to BUG-001..BUG-005; when in doubt, verify and leave alone.
- ❌ Don't trust line numbers (this PRP's or the work-item contract's) — grep anchors only.
- ❌ Don't touch README.md (sibling P1.M4.T6.S1's file — its staged diff is expected) or redo the
  spec/15/spec/14 riders (P1.M3.T5.S1 / P1.M3.T4.S1 own those edits — you only VERIFY them).
- ❌ Don't fix only two of spec/09's three B1 anchors — `grep "align by index"` must also go to zero.
- ❌ Don't retrofit the 3-tier body recovery, tier-1 offset mechanics, or any prior-changeset
  simplification into spec/09 — BUG-001's traceable fix is the path-aware pairing.
- ❌ Don't edit spec before the pre-flight gate passes — spec must describe SHIPPED behavior.
- ❌ Don't run npm test/typecheck in a loop — the contract says once, after edits.

---

**Confidence Score: 9/10** — one-pass success highly likely: docs-only with all six edit texts
pre-written against grep-verified anchors re-confirmed at working-tree HEAD 10d61bc, rider states
confirmed landed (spec/15 and spec/14 checked in the working tree, including the "Node supports
it" absence), zero file overlap with the parallel README sweep, and validation is mechanical
(greps + one clean-tree run). Residual risks: line drift from the sibling's README commit
(mitigated by grep anchors) and the judgment call on spec/06's "parallel to `blocks` emission
order" wording (research verdict: order claim, not index-parity — left alone unless contradicted).