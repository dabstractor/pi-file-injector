---
name: "P1.M3.T1.S1 (Bugfix Docs) — Document F3 magic-number sniff & F5 empty-image handling in README § 'Behavior by file type'"
prd_ref: "Bug-fix PRD §Issue 3 (F3 magic-number sniff deviates from PRD §5.2) and §Issue 4 (F5 empty-image handling deviates from PRD §10)"
target_file: "./README.md (§ 'Behavior by file type' ONLY — the table + the 'Notes on the table' bullets)"
change_type: TWO additive edits to README.md — (1) modify the Image table row + insert a new 'Empty image' row; (2) append two explanatory bullets to 'Notes on the table'. No other file. No .ts. No .test.mjs.
pi_version: "@earendil-works/pi-coding-agent v0.80.7"
depends_on: "F3 (hasValidImageMagic) and F5 (formatEmptyImageBlock) code already LIVE in file-injector.ts (lines 18-52, 78, and the injectFiles branches ~149-176). Harness cases F3a/F3b/F5 already codify the behavior. This task ONLY documents it. No code dependency to land."
fixes: "Closes Bug-fix PRD §Issue 3 + §Issue 4 'Suggested Fix: document the intentional divergence in the README' (both issues' recommended resolution is documentation)."
scope_boundary: "Edits touch ONLY README.md § 'Behavior by file type' (the table rows + the 'Notes on the table' list). Does NOT touch README overview, Testing count, Syntax, Key design choices, or Known limitations — those belong to sibling P1.M3.T2.S1 ('Update README overview, test count, and known limitations', status Planned). Does NOT touch file-injector.ts or file-injector.test.mjs."
---

# PRP — P1.M3.T1.S1 (Bugfix Docs): Document F3 & F5 in README

## Goal

**Feature Goal**: Update README.md § "Behavior by file type" so the F3 magic-number sniff and F5
empty-image handling — both already LIVE in `file-injector.ts` and codified by harness cases
`F3a`/`F3b`/`F5` — are documented as **deliberate, intentional enhancements**, not left as
undocumented spec deviations. A reader of the README must understand: (1) an image is attached only
after BOTH its extension *and* its actual bytes pass a magic-number sniff (a mislabeled `.png` falls
through to text/binary); (2) a 0-byte image attaches nothing and instead emits a note block (an empty
`ImageContent` would be provider-rejected).

**Deliverable**: TWO edits to `./README.md`, both within § "Behavior by file type":
- **Edit 1** — on the **Image** table row, append the magic-number-sniff note to the middle cell, AND
  insert a new **Empty image** row immediately after it.
- **Edit 2** — append two explanatory bullets to the **"Notes on the table"** list (one for F3, one
  for F5), each framed as an intentional enhancement and citing its harness case(s).

**No other file is modified. No `.ts`. No `.test.mjs`. No PRD/tasks.json.**

**Success Definition**:
- [ ] `git diff --name-only` shows ONLY `README.md`.
- [ ] The **Image** row's middle cell now mentions the magic-number sniff / fall-through to
      text/binary.
- [ ] A new **Empty image** row exists, immediately after the Image row, with the exact output string
      `<empty image file — 0 bytes; nothing to attach>` (em dash U+2014, byte-identical to the code).
- [ ] The **"Notes on the table"** list has **4 bullets** (was 2): the 2 existing + 1 for F3 + 1 for F5.
- [ ] The F3 bullet explains: validated by extension AND bytes; mislabeled falls to text/binary; cites
      `F3a`/`F3b`.
- [ ] The F5 bullet explains: 0-byte image attaches nothing; note block emitted; 0-byte *text* is
      unaffected; cites `F5`.
- [ ] All new em dashes are **U+2014** (not hyphens) — consistent with the existing README voice
      (existing bullet 1 explicitly calls out "the `—` in the binary note is an em dash (U+2014)").
- [ ] The table still renders correctly (every row has exactly 3 pipe-separated cells / 2 inner pipes).
- [ ] `node ./file-injector.test.mjs` still passes (defensive — this task must not touch code; if it
      fails, something went out of scope).

> **Scope boundary (read carefully):** This task edits ONLY `README.md`, and ONLY within the
> "Behavior by file type" section (the table + the "Notes on the table" list — README lines ~77-104).
> It does **NOT**: (a) touch `file-injector.ts` (F3/F5 code is already live and harness-verified);
> (b) touch `file-injector.test.mjs` (the parallel sibling P1.M2.T2.S1 owns the `U1` case there —
> disjoint file); (c) touch the README **overview**, **Testing** count, **Syntax**, **Key design
> choices**, or **Known limitations** sections — those are P1.M3.T2.S1's scope (status Planned);
> (d) change any existing prose outside the two named edit regions.

## User Persona

**Target User**: Anyone reading the README to understand `#@file`'s actual behavior — especially
someone surprised that `#@fake.png` (a text file named `.png`) did NOT attach as an image, or that
`#@empty.png` (0 bytes) produced a `<empty image file — 0 bytes; nothing to attach>` note instead of
an empty block. Also the maintainer reconciling the README against the PRD §5.2 / §10 deviations.

**Use Case**: A user writes `#@screenshot.png` where `screenshot.png` is actually a text file (e.g. a
downloaded `.png` that 404'd into an HTML error page, or a deliberately mislabeled test fixture). The
README's Image row must make clear this will fall through to the text/binary path, so the user is not
confused when no image appears in their context.

**Pain Points Addressed**: The Bug-fix PRD §Issue 3 and §Issue 4 both flag F3 and F5 as
"deliberate enhancement; flag for spec reconciliation" whose recommended fix is "document it."
Today the README documents neither — a reader has no way to know these behaviors are intentional
rather than bugs. This task closes that gap.

## Why

- **The PRD explicitly recommends documentation over code change.** Both Issue 3 ("Recommend the
  former — document it") and Issue 4 ("Recommend documenting it") resolve to README documentation as
  the preferred fix, because the behaviors are *better* than the literal PRD (F3 avoids attaching
  decoded garbage; F5 avoids a provider-rejected empty image).
- **The behavior is already shipped and tested.** `hasValidImageMagic` and `formatEmptyImageBlock`
  are live in `file-injector.ts`, and `F3a`/`F3b`/`F5` pin them in the harness. The only missing
  piece is user-facing documentation. This is the lowest-risk, highest-clarity way to "reconcile
  spec vs. implementation."
- **Prevents user confusion / mis-filed bugs.** Without this note, a user seeing `fake.png` injected
  as text (or `empty.png` as a note block) might file a bug. The README now sets the expectation
  upfront: these are deliberate.

## What

Two edits to `./README.md`, both within § "Behavior by file type":

1. **Edit 1 (Image row + new Empty image row)** — replace the single Image table row with:
   (a) the Image row whose middle cell appends the magic-number-sniff note, immediately followed by
   (b) a new "Empty image" row.
2. **Edit 2 ("Notes on the table" bullets)** — append two new bullets to the existing 2-bullet list:
   one explaining F3 (magic-number validation), one explaining F5 (empty-image handling), each citing
   its harness case(s).

The exact `oldText` / `newText` for both edits are given verbatim in
**Implementation Blueprint → Exact source to write** below (byte-verified against the current README).

### Success Criteria
- [ ] Both edits applied; `git diff --name-only` → `README.md` only.
- [ ] Image row middle cell mentions magic-number sniff + fall-through to text/binary.
- [ ] New "Empty image" row present, immediately after Image row, exact output string present.
- [ ] "Notes on the table" has 4 bullets; F3 bullet cites F3a/F3b; F5 bullet cites F5.
- [ ] All em dashes in new content are U+2014; table still renders (2 inner pipes per row).
- [ ] Scope respected: overview / Testing / Syntax / Known limitations / `.ts` / `.test.mjs` untouched.

## All Needed Context

### Context Completeness Check
> _"If someone knew nothing about this codebase, would they have everything needed to implement this
> successfully?"_ — **YES.** This PRP ships: (1) the exact two `oldText` blocks (byte-verbatim reads
> of the current README Image row and the current "Notes on the table" trailing bullet); (2) the
> exact two `newText` blocks (the modified Image row + new Empty image row, and the two new bullets),
> ready to paste into two `edit` calls; (3) the exact output strings to reproduce (the empty-image
> note block, with the em dash verified as U+2014 against the live `.ts` and the harness F5
> assertion); (4) the harness-case citations to include (F3a/F3b/F5, grep-confirmed present); and
> (5) the explicit scope boundaries so the implementer does not collide with sibling tasks. No model,
> no API key, no build step — this is two prose edits to one markdown file.

### Documentation & References
```yaml
# MUST READ — this task's verified research (byte-level, source-confirmed)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/P1M3T1S1/research/research_notes.md
  why: "§2 the exact F3/F5 behavior (order: ext-first then bytes; sniffer coverage; <12-byte
        pre-check; fall-through to text/binary; the exact empty-image note block string with U+2014;
        the 0-byte TEXT contrast). §3 the exact current README state (the Image row line, the
        insertion point, the 2 existing 'Notes on the table' bullets). §4 the style/voice conventions
        (em dash U+2014, backtick tokens, table cell format). §5 the sibling-coordination boundaries."
  critical: "The empty-image note block string MUST byte-match the code: '<empty image file — 0 bytes;
        nothing to attach>' where — is U+2014 (NOT a hyphen). The new 'Empty image' row goes
        IMMEDIATELY AFTER the Image row, BEFORE 'Other binary'. The F3/F5 bullets go AFTER the 2
        existing bullets in 'Notes on the table'."

# MUST READ — the bug context (the deviations this task documents)
- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/prd_snapshot.md
  why: "§Issue 3 (F3 magic-number sniff) and §Issue 4 (F5 empty-image handling) are the acceptance
        criteria. Both recommend 'document the intentional divergence in the README' — this task is
        that documentation."
  section: "Issue 3, Issue 4 (and the parent 'Minor Issues' §h2.3)"

- docfile: plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/architecture/system_context.md
  why: "§'Spec Deviations (Issues 3, 4 — Documentation Only)' — the one-paragraph summary of each
        deviation and its recommendation. Confirms the documentation-only resolution."
  section: "Spec Deviations (Issues 3, 4 — Documentation Only)"

# MUST READ — the code being documented (already LIVE, do NOT edit)
- file: ./file-injector.ts
  why: "F3 = hasValidImageMagic (lines 18-52): routes by ext FIRST, then validates bytes. Sniffer
        covers PNG/JPEG/GIF/WEBP/BMP; <12 bytes fails. On fail → text/binary path, no image.
        F5 = formatEmptyImageBlock (line 78): '<file name=\"' + abs + '\"><empty image file \\u2014
        0 bytes; nothing to attach></file>' — \\u2014 is U+2014 em dash. injectFiles F5 branch
        (~line 149): if (mime && buf.length === 0) → note block, no image."
  pattern: "The exact strings this task must reproduce in the README come from THIS file. Read lines
            18-52 (F3), 78 (F5), and 145-180 (the injectFiles image/empty/text/binary branches)."
  gotcha: "Do NOT edit this file — F3/F5 are already live and harness-verified. This task only
           documents them. Editing the .ts collides with the closed implementation and is out of scope."

# MUST READ — the harness cases that codify the behavior (cite them in the README bullets)
- file: ./file-injector.test.mjs
  why: "F3a (line ~552): fake.png (text body, .png ext) → injected===1, images.length===0, text
        <file> block. F3b (line ~563): hasValidImageMagic unit-level (real PNG passes, text fails,
        <12 fails, real JPEG passes). F5 (line ~571): empty.png (0 bytes) → injected===1,
        images.length===0, '<file name=\"…\"><empty image file \\u2014 0 bytes; nothing to attach>
        </file>'. These case labels are the traceability anchors the README bullets cite."
  pattern: "Cite 'F3a/F3b' and 'F5' in the README bullets (parenthetical), matching the existing
            README's style of citing validation_report.md findings."
  gotcha: "Do NOT edit this file — the parallel sibling P1.M2.T2.S1 owns the U1 case here (disjoint
           region). Reading it confirms the exact strings; editing it is out of scope."

# The file being EDITED
- file: ./README.md
  why: "§ 'Behavior by file type' (README lines ~77-104) is the ONLY edit target. The Image table row
        (line ~82), the new Empty-image row (inserted after it), and the 'Notes on the table' bullets
        (lines ~97-104) are the three touch points."
  pattern: "Markdown table (pipe-delimited, 3 cols); bullet list under 'Notes on the table:'. Em dash
            U+2014 throughout; backticks around tokens/strings/code."
  gotcha: "STAY OUT of README § overview, Testing (count), Syntax, Key design choices, Known
           limitations — those are sibling P1.M3.T2.S1's scope. Two edits only, both in 'Behavior by
           file type'."
```

### Current Codebase tree (run `ls` in the repo root)
```bash
# /home/dustin/projects/pi-file-injector
.
├── PRD.md                       # original feature PRD (read-only; not this task's PRD)
├── README.md                    # ← EDIT (§ 'Behavior by file type' ONLY)
├── file-injector.ts             # F3/F5 code already LIVE (lines 18-52, 78, 149-176). DO NOT EDIT.
├── file-injector.test.mjs       # F3a/F3b/F5 cases codify the behavior. DO NOT EDIT (sibling P1.M2.T2.S1).
└── plan/001_5aa8724eb506/bugfix/001_ff8b3e05b4f9/
    ├── architecture/system_context.md   # §'Spec Deviations (Issues 3, 4)'
    ├── prd_snapshot.md / prd_index.txt / tasks.json
    ├── P1M3T1S1/
    │   ├── research/research_notes.md   # THIS TASK's research (byte-verified)
    │   └── PRP.md                       # ← THIS FILE
    └── P1M3T2.S1/                       # sibling: README overview/test-count/known-limitations (Planned) — DO NOT COLLIDE
```

### Desired Codebase tree with files to be changed
```bash
.
└── README.md                    # MODIFIED — § 'Behavior by file type': Image row note + new Empty
                                 #   image row + 2 new 'Notes on the table' bullets.
# No new files. No .ts / .test.mjs / PRD / tasks.json changes.
```

### Known Gotchas of our codebase & Library Quirks
```markdown
<!-- CRITICAL — the empty-image note block string MUST byte-match the code. The exact string is: -->
<!--   <empty image file — 0 bytes; nothing to attach> -->
<!-- where — is U+2014 (em dash), NOT a hyphen '-' and NOT an en dash '–'. -->
<!-- Source: file-injector.ts line 78 (formatEmptyImageBlock uses \u2014) and the harness F5 -->
<!-- assertion (file-injector.test.mjs ~line 577, also \u2014). Pasting a hyphen here is the #1 failure mode. -->

<!-- CRITICAL — the magic-number sniff routes by EXTENSION FIRST, then validates bytes. -->
<!-- Do NOT describe it as "byte-only routing." The accurate description: a file is attached as an -->
<!-- image only if (extension is a recognized image type) AND (first bytes match that type's signature). -->
<!-- A mislabeled .png (text body) FAILS the byte check and falls through to the TEXT/BINARY path -->
<!-- (injected as text if no NUL byte, else the binary note). See F3a. -->

<!-- GOTCHA — 0-byte handling differs by file type. A 0-byte IMAGE (empty.png) gets the special -->
<!-- note block (F5). A 0-byte TEXT file (empty.txt) does NOT — it follows the text path and injects -->
<!-- as '<file name="…">\n\n</file>' (PRD §10 literal). The F5 bullet must state this contrast so -->
<!-- readers don't think ALL 0-byte files get the note block. -->

<!-- GOTCHA — scope discipline. The contract's three edits (a/b/c) are ALL within README § 'Behavior -->
<!-- by file type'. The sibling P1.M3.T2.S1 owns the README overview / Testing count / Known -->
<!-- limitations. Do NOT "helpfully" update the test count or known-limitations here — that collides -->
<!-- with the sibling and is out of scope. Two edits, one section. -->

<!-- GOTCHA — the new 'Empty image' row goes IMMEDIATELY AFTER the Image row and BEFORE 'Other binary'. -->
<!-- It is a special-case of image, so grouping it adjacent to Image reads naturally. Do not append it -->
<!-- at the end of the table (after 'Read / permission error') — that breaks the logical grouping. -->

<!-- GOTCHA — markdown table integrity. Each row must have exactly 2 inner pipes (3 cells). When -->
<!-- inserting the new row, ensure no stray/missing pipe breaks the table render. The new row's cells: -->
<!--   | **Empty image** (0-byte `.png`/`.jpg`/etc.) | <middle cell> | `<output>` | -->

<!-- IDEMPOTENCY — if a prior pass already added these docs, the oldText anchors below will NOT match -->
<!-- (the Image row / trailing bullet will already contain the new content). Re-read README § 'Behavior -->
<!-- by file type'; if F3/F5 are already documented, verify with the Level-1 greps and STOP. -->
```

## Implementation Blueprint

### Data models and structure
None. Pure markdown prose. No code, types, signatures, or data structures.

### Implementation Tasks (ordered by dependencies)
```yaml
PRE-FLIGHT:
  - IDEMPOTENCY GUARD (run FIRST — a prior pass may have already landed this):
      grep -q 'empty image file' README.md && echo "F5 already documented → verify & maybe STOP"
      grep -qi 'magic-number sniff' README.md && echo "F3 already documented → verify & maybe STOP"
    (If BOTH are present, the task may already be done — run the Level-1 greps to confirm, then STOP.)
  - CONFIRM the current README state matches the oldText anchors below (so the edits will apply):
      grep -qF 'Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag' README.md
      grep -qF 'A broken `#@` **never** breaks your prompt' README.md
    (Both must print a match. If either fails, the README drifted — re-read § 'Behavior by file type'.)
  - CONFIRM scope baseline (defensive — no unintended edits):
      git diff --name-only 2>/dev/null   # should be empty (or only this task's changes)

Task 1: EDIT ./README.md — Image row note + new Empty image row (contract a + b)
  - OBJECTIVE: Append the magic-number-sniff note to the Image row's middle cell, AND insert a new
    'Empty image' row immediately after it.
  - FIND (exact oldText — the current single Image table row):
      <see "Exact source to write" → Edit 1 oldText below>
  - REPLACE WITH (exact newText — modified Image row + new Empty image row):
      <see "Exact source to write" → Edit 1 newText below>
  - DO NOT alter any other table row (Text / Other binary / Missing / Directory / Read-permission).

Task 2: EDIT ./README.md — append 2 bullets to 'Notes on the table' (contract c)
  - OBJECTIVE: Add one bullet explaining F3 (magic-number validation) and one explaining F5
    (empty-image handling), framed as intentional enhancements, each citing its harness case(s).
  - FIND (exact oldText — the current LAST bullet of 'Notes on the table'):
      <see "Exact source to write" → Edit 2 oldText below>
  - REPLACE WITH (exact newText — the same bullet + the 2 new bullets):
      <see "Exact source to write" → Edit 2 newText below>
  - DO NOT alter the 2 existing bullets (dimension-hints bullet, broken-#@ bullet body).

POST-FLIGHT:
  - Run the Level-1 validation greps (string presence, em-dash correctness, bullet count, table integrity).
  - git diff README.md — confirm changes are ONLY in § 'Behavior by file type'.
  - Run Level-2: node ./file-injector.test.mjs (defensive — must still pass; this task touches no code).

DO NOT (out of scope — owned by siblings / closed tasks):
  * Edit file-injector.ts (F3/F5 already live; closed implementation).
  * Edit file-injector.test.mjs (sibling P1.M2.T2.S1 owns the U1 case; disjoint region).
  * Touch README overview / Testing count / Syntax / Key design choices / Known limitations
    (sibling P1.M3.T2.S1's scope, status Planned).
  * Edit PRD.md / tasks.json / prd_snapshot.md (read-only, owned by orchestrator).
```

### Exact source to write (authoritative — copy verbatim into TWO `edit` calls)

---

#### Edit 1 — Image row note + new Empty image row

**`oldText`** (the current single Image table row — byte-verbatim from README line ~82):
```markdown
| **Image** (`.png` `.jpg`/`.jpeg` `.gif` `.webp` `.bmp`) | Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag | `<file name="/abs/path"></file>` *(plus the image is attached)* |
```

**`newText`** (the modified Image row [magic-number note appended] + the new Empty image row directly
after it — the `—` glyphs are **U+2014 em dash**; the `≤` is U+2264 as in the original):
```markdown
| **Image** (`.png` `.jpg`/`.jpeg` `.gif` `.webp` `.bmp`) | Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag — but only after its first bytes pass a magic-number sniff (see notes); a mislabeled file (text named `.png`) falls through to the **text/binary** row instead of attaching as garbage | `<file name="/abs/path"></file>` *(plus the image is attached)* |
| **Empty image** (0-byte `.png`/`.jpg`/etc.) | Attaches **nothing** — an empty `ImageContent` would be rejected by providers, so a note block is emitted instead | `<file name="/abs/path"><empty image file — 0 bytes; nothing to attach></file>` |
```

> **Why this placement:** the new "Empty image" row sits immediately after "Image" and before
> "Other binary" because it is a special-case of image, so grouping it adjacent reads naturally. The
> Image-row middle cell gains a single appended clause ("— but only after …") plus the "(see notes)"
> pointer to the detailed bullet in Edit 2, keeping the table cell concise.

---

#### Edit 2 — append 2 bullets to "Notes on the table"

**`oldText`** (the current LAST bullet of the "Notes on the table" list — byte-verbatim from README
lines ~102-104):
```markdown
- A broken `#@` **never** breaks your prompt. Each file is isolated in its own `try`/`catch`, so a
  missing file, a directory, a permission error, or an unreadable file just leaves the `#@token`
  verbatim and processing continues with the rest.
```

**`newText`** (the same bullet, unchanged, immediately followed by the 2 new bullets — all `—` glyphs
are **U+2014 em dash**):
```markdown
- A broken `#@` **never** breaks your prompt. Each file is isolated in its own `try`/`catch`, so a
  missing file, a directory, a permission error, or an unreadable file just leaves the `#@token`
  verbatim and processing continues with the rest.
- **Images are validated by both extension *and* actual bytes (magic-number sniff).** A file is
  attached as an image only if its extension is a recognized image type *and* its first bytes match
  that type's signature (PNG/JPEG/GIF/WEBP/BMP; files under 12 bytes always fail). A mislabeled file
  (e.g. a text body saved as `fake.png`) therefore falls through to the **text/binary** path and is
  injected as text — it is **not** attached as decoded garbage labeled as an image. This is a
  deliberate, safer improvement over routing by extension alone. *(Harness cases `F3a`, `F3b`.)*
- **A 0-byte image file attaches nothing.** An empty `ImageContent` would be rejected by providers,
  so instead of attaching an empty image the extension emits a note block —
  `<file name="…"><empty image file — 0 bytes; nothing to attach></file>` (the `—` is the same em
  dash, U+2014, used in the binary note) — and attaches no image, while still referencing the path.
  Note the contrast: a 0-byte *text* file is unaffected and injects as `<file name="…">\n\n</file>`;
  only 0-byte *images* get this special-case. This is a deliberate divergence, made to avoid a
  provider-rejected empty image. *(Harness case `F5`.)*
```

---

### Implementation Patterns & Key Details
```markdown
<!-- PATTERN (table cell edit): the Image row's middle cell is the 2nd pipe-delimited field. Append the
     new clause INSIDE that cell (before the closing pipe), do not restructure the row's 3-cell shape.
     The new Empty image row is a fully-formed 3-cell row on its own line, no blank line between it
     and the Image row (markdown tables have no blank lines between rows). -->

<!-- PATTERN (bullet append): the "Notes on the table" list is a contiguous bullet block. Append the
     new bullets immediately after the last existing bullet, no blank line between them (so they stay
     in the same list; a blank line would start a new list block). Each new bullet starts with "- ". -->

<!-- PATTERN (em dash): the README uses U+2014 (—) as its clause separator throughout (binary note,
     prose, existing bullet 1). All new em dashes MUST be U+2014. Existing bullet 1 even documents
     this: "The `—` in the binary note is an em dash (U+2014), not a hyphen." A hyphen "-" is WRONG. -->

<!-- PATTERN (citation): the existing README cites plan/…/P1M2T4S1/validation_report.md for the F1
     finding. The new bullets cite the harness case labels (F3a/F3b/F5) in italics-parenthetical,
     which is more precise and stable than a file path. This matches the README's traceability ethos. -->

<!-- GOTCHA: do NOT describe F3 as "routes by bytes only." The accurate description is ext-FIRST then
     bytes. The whole point of the deviation (vs PRD §5.2 "route by extension only") is the ADDED
     byte check, not a replacement of the extension check. The bullet wording reflects this. -->

<!-- GOTCHA: do NOT imply F5 applies to all 0-byte files. It applies ONLY to recognized image
     extensions whose file is exactly 0 bytes. 0-byte text files follow the text path unchanged.
     The F5 bullet states this contrast explicitly. -->
```

### Integration Points
```yaml
NO NEW INTEGRATION POINTS:
  - "Pure markdown documentation edit. No code, config, env vars, routes, or build step."
  - "Consumes the ALREADY-LIVE F3/F5 code (file-injector.ts lines 18-52, 78, 149-176) as its subject."
  - "Cites the ALREADY-LIVE harness cases (F3a/F3b/F5 in file-injector.test.mjs) for traceability."
  - "If a future change alters F3/F5 behavior, the README bullets (and their harness-case citations)
     must be updated to match — the bullets are the user-facing contract for these behaviors."
```

## Validation Loop

> This repo has **no test framework / linter / type-checker** for prose. The README is plain
> markdown. Validation is therefore: (1) byte-exact string checks (the empty-image note block, the
> em dash), (2) structural checks (table renders, bullet count), (3) scope check (diff confined to
> "Behavior by file type"), and (4) a defensive harness run (must still pass — this task touches no
> code). The Python `pytest`/`mypy`/`ruff` gates from the base template DO NOT APPLY.

### Level 1: Edit Verification (Immediate Feedback)
```bash
cd /home/dustin/projects/pi-file-injector

# 1a. The empty-image note block string is present, with a U+2014 em dash (NOT a hyphen).
grep -qF '<empty image file — 0 bytes; nothing to attach>' README.md \
  && echo "OK: empty-image note present" || echo "FAIL: empty-image note missing"
# Confirm the dash is the em dash (U+2014), not a hyphen (a hyphenated variant would be a bug):
grep -qF '<empty image file - 0 bytes; nothing to attach>' README.md \
  && echo "FAIL: found a HYPHEN version (wrong glyph — must be U+2014)" || echo "OK: no hyphen variant"

# 1b. The magic-number sniff is documented (F3).
grep -qi 'magic-number sniff' README.md && echo "OK: F3 documented" || echo "FAIL: F3 not documented"

# 1c. The new 'Empty image' row exists, immediately after the Image row (table integrity).
grep -qF '| **Empty image** (0-byte `.png`/`.jpg`/etc.) |' README.md \
  && echo "OK: Empty image row present" || echo "FAIL: Empty image row missing"

# 1d. The Image row now mentions the magic-number sniff + fall-through to text/binary.
grep -qF 'falls through to the **text/binary** row' README.md \
  && echo "OK: Image row fall-through note present" || echo "FAIL: Image row note missing"

# 1e. The harness case citations are present.
grep -qF '`F3a`, `F3b`' README.md && echo "OK: F3a/F3b cited" || echo "FAIL: F3a/F3b citation missing"
grep -qF '`F5`' README.md && echo "OK: F5 cited" || echo "FAIL: F5 citation missing"

# 1f. 'Notes on the table' now has 4 bullets (was 2). Count bullet lines in that section.
#     (Count all top-level "- " bullets between 'Notes on the table:' and the next '## ' heading.)
awk '/^Notes on the table:/{f=1;next} /^## /{f=0} f && /^- /{c++} END{print "bullets:", c}' README.md
# Expected: bullets: 4

# 1g. SCOPE CHECK — only README.md changed, and the diff is confined to 'Behavior by file type'.
git diff --name-only | grep -vxE 'README.md' && echo "FAIL: unexpected file changed" || echo "OK: only README.md"
# Confirm no edits leaked into overview / Testing / Known limitations:
git diff README.md | grep -nE '^\+.*(Known limitations|Quick test|Result: .* passed|node ./file-injector)' \
  && echo "WARN: diff may touch out-of-scope sections — inspect" || echo "OK: no out-of-scope edits"

# Expected: empty-image note present (U+2014, no hyphen variant); F3 documented; Empty image row
# present; Image row fall-through note present; F3a/F3b and F5 cited; 4 bullets; only README.md
# changed; no out-of-scope section edits.
```

### Level 2: Defensive Harness Run (must still pass — this task touches no code)
```bash
cd /home/dustin/projects/pi-file-injector
node ./file-injector.test.mjs
# Expected: all cases pass (currently 30; P1.M2.T2.S1 may raise it to 31 in parallel — either way,
# 0 failures), exit 0.
# Rationale: this task edits ONLY README.md, so the harness CANNOT be affected. If it fails, the
# implementer accidentally touched a .ts/.test.mjs file — re-run `git diff --name-only` and revert
# any non-README change.
```

### Level 3: Render Sanity (optional — eyeball the table + bullets)
```bash
cd /home/dustin/projects/pi-file-injector
# Print the 'Behavior by file type' section to eyeball table + bullet rendering.
sed -n '/^## Behavior by file type/,/^## Syntax/p' README.md
# Verify by eye:
#   - The table has 7 data rows now (Text, Image, Empty image, Other binary, Missing, Directory, Read).
#   - Every table row has exactly 2 inner pipes (3 cells) — no broken render.
#   - The 'Notes on the table' list has 4 bullets, all under one contiguous list block.
#   - All em dashes render as — (long dash), not - (hyphen) or – (en dash).
```

### Level 4: N/A (no creative/domain-specific validation for prose)
This is markdown documentation. There is no performance, security, or load dimension. Level 1-3 are
sufficient.

## Final Validation Checklist

### Technical Validation
- [ ] Level 1: empty-image note present with U+2014 (no hyphen variant); F3 documented; Empty image
      row present after Image row; Image row fall-through note present; `F3a`/`F3b`/`F5` cited;
      4 bullets in "Notes on the table"; only README.md changed; no out-of-scope edits.
- [ ] Level 2: `node ./file-injector.test.mjs` still passes 0 failures (defensive).

### Feature Validation
- [ ] A reader of the Image row now knows images require BOTH extension AND valid bytes (magic-number
      sniff), and a mislabeled file falls through to text/binary.
- [ ] A reader of the new Empty image row knows a 0-byte image attaches nothing and emits the note
      block `<empty image file — 0 bytes; nothing to attach>`.
- [ ] The F3 bullet explains the behavior as a deliberate enhancement and cites `F3a`/`F3b`.
- [ ] The F5 bullet explains the behavior as a deliberate divergence, states the 0-byte-text contrast,
      and cites `F5`.

### Code Quality Validation
- [ ] All new em dashes are U+2014 (consistent with existing README voice).
- [ ] Table still renders (7 data rows, 2 inner pipes each).
- [ ] "Notes on the table" is one contiguous 4-bullet list (no stray blank line splitting it).
- [ ] Backticks used around tokens/strings/extensions (`.png`, `<file …>`, `F3a`, etc.) per convention.
- [ ] Scope respected: overview / Testing count / Syntax / Key design choices / Known limitations /
      `.ts` / `.test.mjs` all untouched.

### Documentation & Deployment
- [ ] The two new bullets name the behaviors and their rationale (intentional enhancement), so a
      future reader understands they are deliberate, not bugs.
- [ ] Harness-case citations (`F3a`/`F3b`, `F5`) provide traceability to the pinning tests.

---

## Anti-Patterns to Avoid
- ❌ Don't edit `file-injector.ts` — F3 (`hasValidImageMagic`) and F5 (`formatEmptyImageBlock`) are
  already live and harness-verified. This task only DOCUMENTS them. Editing the `.ts` collides with
  the closed implementation.
- ❌ Don't edit `file-injector.test.mjs` — the parallel sibling P1.M2.T2.S1 owns the `U1` case there
  (disjoint region). Reading it is fine (to confirm the exact strings); editing it is out of scope.
- ❌ Don't touch README sections outside "Behavior by file type" — the overview, Testing count, Syntax,
  Key design choices, and Known limitations belong to sibling P1.M3.T2.S1 (status Planned). Scope
  creep there causes a collision.
- ❌ Don't use a hyphen `-` or en dash `–` where an em dash `—` (U+2014) is required — the
  empty-image note block (`<empty image file — 0 bytes; nothing to attach>`) MUST byte-match the code.
  A wrong glyph is the #1 failure mode; Level-1 grep #1a/1b catches it.
- ❌ Don't describe F3 as "routes by bytes only." The accurate description is **extension first, then
  bytes** — the deviation from PRD §5.2 is the ADDED byte check, not a replacement of the extension
  check. Mis-describing it makes the docs wrong.
- ❌ Don't imply F5 applies to all 0-byte files — it applies ONLY to recognized image extensions that
  are exactly 0 bytes. 0-byte text files follow the text path (`<file>\n\n</file>`). The F5 bullet
  must state this contrast; omitting it misleads readers.
- ❌ Don't insert the new "Empty image" row at the end of the table — it goes immediately after the
  Image row (it is a special-case of image) and before "Other binary." Appending at the end breaks
  the logical grouping.
- ❌ Don't split the "Notes on the table" list with a blank line — the 4 bullets must be one
  contiguous list block; a blank line starts a new (disconnected) list in markdown.
- ❌ Don't update the test count or "Known limitations" to mention F3/F5 — that is P1.M3.T2.S1's job.
  The bullets cite the harness *case labels* (F3a/F3b/F5), not a count.

---

## Confidence Score

**9.5 / 10** for one-pass implementation success.

Rationale: This is two additive prose edits to a single markdown file, each with a byte-verbatim
`oldText` anchor (read directly from the current README) and a ready-to-paste `newText`. Every string
the implementer must reproduce — most critically the empty-image note block
`<empty image file — 0 bytes; nothing to attach>` with its U+2014 em dash — has been byte-verified
against the live `file-injector.ts` (line 78) and the harness F5 assertion (`file-injector.test.mjs`
~line 577). The behavior descriptions (F3: ext-first-then-bytes with fall-through to text/binary; F5:
0-byte-image-only, 0-byte-text unaffected) are confirmed against the actual `injectFiles` branches
(lines 149-176) and the harness cases F3a/F3b/F5. The scope is crisply disjoint from all siblings:
the `.ts` and `.test.mjs` files are not edited (F3/F5 code live; P1.M2.T2.S1 owns U1 on a disjoint
file); the README regions outside "Behavior by file type" are reserved for P1.M3.T2.S1. The residual
0.5 is for two prose-edit failure modes — a wrong dash glyph (hyphen vs U+2014) or a markdown table
malformation (stray/missing pipe) — both of which are deterministically caught by Level-1 greps #1a
(em dash present, no hyphen variant) and #1c/#1f (row present, 4 bullets) plus the Level-3 render
sanity (eyeball the table). No model, no build, no network required.
