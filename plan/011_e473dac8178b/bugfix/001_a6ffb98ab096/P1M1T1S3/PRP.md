---
name: "P1.M1.T1.S3 (bugfix 001_a6ffb98ab096) — Renderer tier-3 fallback: path-aware bodies instead of bodies[i]"
prd_ref: "bugfix PRD §h3.0 Issue 1 (BUG-001: expanded view shows the paged directive as the body of any URL/binary file following a paged file) + §h2.5 Recommendation 1 second half ('pairing tier-3 bodies with details through the same path-aware cursor logic computeDetailOffsets uses'); architecture/renderer_bug001.md § Renderer 3-tier analysis + § Fix design evaluation candidate (b) + § Risks 3/4/5"
target_file: "./file-injector.ts"   # renderInjectedMessage ONLY (:1047-1102): the bodies build loop, the tier-3 arm, 3 Mode-A comment touches
target_language: TypeScript (jiti transpile-on-load; gate = `npm run typecheck` --strict 0 errors + 4 suites green; TDD: REND-TIER3-PATH RED first)
depends_on: "P1.M1.T1.S1 (LANDED, commit 21bf4fa: computeDetailOffsets deny-guard — url pairs via 0x0A) + P1.M1.T1.S2 (LANDED in working tree: kind-gated binary no-newline branch; deny-guard now skips only image; baseline 182). After S1+S2 every NEW emission's body-bearing detail carries contentStart/contentLen (tier-1) — tier-3 now fires ONLY for OLD persisted / test-crafted entries lacking offsets AND d.body. S3 repairs exactly those."
consumed_by: "P1.M4.T6.S1 (README changeset sweep — S3 is display-correctness only; README's existing expanded-view description stays accurate post-fix, P1.M4.T6 verifies). No code consumers: exported surface unchanged."
---

# PRP — P1.M1.T1.S3: Renderer tier-3 fallback — path-aware bodies instead of `bodies[i]`

> ⚠️ **SCOPE — READ FIRST.** This is the **second half** of the BUG-001 fix (candidate (b) of the architecture
> evaluation). S1+S2 fixed the FORWARD path (new emissions: url + binary details now get tier-1 offsets in
> `computeDetailOffsets`). S3 fixes the **fallback tier** in `renderInjectedMessage`: `bodies[i]` pairs the
> i-th DETAIL with the i-th BLOCK — and a paged file emits TWO blocks / ONE detail, so every later tier-3
> lookup drifts by one (binary shows the `<paged:` directive; url shows the binary note). The fix: build a
> **path→FIFO** (`bodiesByPath`) in the same exec loop (FILE_BLOCK_RE group 1 = path — already captured,
> currently unused) and pop per-path in the tier-3 arm (the same in-order consumption as
> computeDetailOffsets's `cursorByPath`). **Tiers 1 and 2 are UNTOUCHED.** **TDD: write REND-TIER3-PATH
> first, confirm RED, then fix.** Scope = S3 ONLY (S1/S2 own computeDetailOffsets; README is M4).

---

## Goal

**Feature Goal:** Make the renderer's tier-3 body fallback **path-aware**: an expanded-view body for a detail
without tier-1 offsets and without tier-2 `d.body` (an OLD persisted message — pre-offset custom messages,
foreign/test-crafted entries) is recovered from **that detail's own path's** block(s), consumed in emission
order — never from another file's block because a preceding paged file shifted the index. `bodies[i]`
(detail-index ↔ block-order coupling) is deleted entirely, replaced by `bodiesByPath: Map<string, string[]>`
with FIFO pops.

**Deliverable:**
1. Modified `file-injector.ts` — `renderInjectedMessage` ONLY: (a) the bodies build loop (:1058-1064) becomes
   the `bodiesByPath` build (same loop, group 1 keys the map); (b) the tier-3 arm (:1088-1090) becomes a
   per-path `shift()` gated on `d.kind !== "image"`; (c) 3 Mode-A comment touches (the function-level "BODY
   derivation (3 tiers…)" block :1049-1057; the in-loop "3-tier body resolution…" block :1081-1087; the JSDoc
   `bodies[i] !== undefined` guard mention :1039). **Exported surface unchanged** (bodiesByPath is
   function-local; the module-surface allowlist test must stay green).
2. Modified `file-injector.test.mjs` — ONE new case **REND-TIER3-PATH** (TDD: RED first), placed after
   REND-PAGED-DIR. Baseline **182 → 183** passed.

**Success Definition:**
1. TDD: REND-TIER3-PATH is **RED** on the pre-fix code (the binary detail's expanded body shows `<paged:`,
   the url detail's body shows the binary note) and **GREEN** after (each shows its OWN block's content).
2. All four suites green: `node ./file-injector.test.mjs` → **183 passed, 0 failed**; import-behavior 23,
   relative-imports 38, url-injection 38. `npm run typecheck` → 0 errors.
3. Tier-1 and tier-2 conditions are byte-identical (REND-11, REND-PAGED-DIR, REND-PAGED-URL,
   REND-MULTI-OFFSET, REND-MULTI-E2E all green — they exercise tiers 1/2 only).
4. No `bodies[i]` token remains anywhere in file-injector.ts (code OR comments — including the :1039 JSDoc).
5. BUG-1 caveat stays accurate: tier-3 inners are STILL regex-recovered (a literal `</file>` in content
   truncates the lazy capture) — path-awareness fixes PAIRING, not truncation; tiers 1+2 remain the safe paths.

## Why

- **Closes BUG-001 for old messages.** S1+S2 repaired NEW emissions at the source (offsets at publish time),
  but custom messages persist in session files — every historical `fileInjector.injected` entry (no
  `contentStart`/`contentLen`, no `body`) still renders through tier-3 and mispairs after a paged file:
  prompt `#@big.log and #@note.bin` (big.log paged) → the binary's expanded body shows big.log's `<paged: …>`
  directive, the note never appears; with a URL instead → the URL's body shows the binary note. Display-only
  (message.content is correct) but visibly wrong for a prompt mix the spec explicitly supports (URL spec §6/§7;
  PRD §10 "binary … expanded shows the same note text").
- **The PRD's own recommendation.** §h2.5: "pairing tier-3 bodies with details through the same path-aware
  cursor logic computeDetailOffsets uses … so the expanded view can never mis-pair after a paged file."
  Candidate (b) of the architecture evaluation: "fixes all kinds at once (url, binary, and even old messages
  with no offsets) and removes the detail-index↔block-index coupling entirely."
- **Only `paged` breaks the 1:1 invariant.** Every other kind emits 1 block / 1 detail (see the cardinality
  table in renderer_bug001.md) — `bodies[i]` was accidentally correct until a paged file precedes, then drifts
  cumulatively (+1 per paged detail). Path-keyed FIFOs are immune by construction.

## What

### User-visible behavior

Expanding (ctrl+o) an OLD injected-files message that mixed a paged file with later URL/binary files now
shows each file's OWN content: the URL's extracted markdown under its `read <url>` line, the binary's note
under its line, the paged file's head plus its dim directive. Before S3: the URL/binary bodies showed the
paged directive / each other's content. Collapsed read-lines and the model-facing content were always correct
and are unchanged.

### Technical behavior (the contract)

- The `FILE_BLOCK_RE` exec loop builds `bodiesByPath: Map<string, string[]>` — key = group 1 (the block's
  path/URL), value = FIFO of group-2 inners (one leading/trailing `\n` stripped, as today) in match order.
  A paged path queues TWO inners (head, then directive); every other path queues one.
- The tier-3 arm pops: `d.kind !== "image" ? bodiesByPath.get(d.path)?.shift() : undefined`. A paged detail
  pops its path's FIRST inner (the head) — the directive inner stays queued forever (harmless: run-dedup
  guarantees no other detail shares that path). Images never pop. A path with no queued inner (mismatched
  old entry) → `undefined` → no body child (the existing `body !== undefined` guard).
- Tiers 1+2: byte-identical conditions and slices. The image guard and the paged-directive dim child are
  untouched.

### Success Criteria

- [ ] REND-TIER3-PATH: RED pre-fix, GREEN post-fix (each body child carries its OWN path's content; no body child contains `<paged:`).
- [ ] `grep -c "bodies\[i\]" file-injector.ts` → 0 (code + comments + JSDoc).
- [ ] `bodiesByPath` present: build site (the exec loop) + consume site (the tier-3 arm). No other changes to the function.
- [ ] Tiers 1/2 untouched; all four suites green (183/23/38/38); typecheck 0 errors; module-surface allowlist green (no new exports).

---

## All Needed Context

### Context Completeness Check

_If someone knew nothing about this codebase, would they have everything needed?_ **Yes.** The exact current
code at both edit sites (verbatim oldText below, verified against the working tree), the path→FIFO design
with its three edge rules (paged queues two; images never pop; missing path → undefined), the TDD test code
(fixtures + child-index map + assertions), the must-stay-green neighbor tests with reasons, and verified
validation commands. Line numbers are current (post-S1/S2, tree = 1954 lines) — the item contract's numbers
(:1003/:1025-1082/:1036-1042/:1065-1067) predate S1/S2 and are shifted; place edits by the literal text.

### Documentation & References

```yaml
# MUST READ — the authoritative analysis (root cause, candidate (b) design, edges, risks)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/architecture/renderer_bug001.md
  why: "§ Renderer 3-tier analysis (the verbatim bug locus + walkthrough); § Fix design evaluation candidate
        (b) ('bodiesByPath: Map<string, string[]> … per-detail pop-with-cursor mirrors cursorByPath'; the
        same-path-twice edge; the directive-stays-queued edge); § Risks 3 (tier-3 wrong for old messages under
        fix (a) — only (b) repairs them), 4 (no existing test pins url/binary bodies after a paged file — hence
        REND-TIER3-PATH), 5 (module-surface guard — no new exports)."
  critical: "The doc's LINE NUMBERS are pre-S1/S2 (tree was 1932; now 1954). Use its CODE SHAPES and DESIGN,
             not its line numbers. Current sites: FILE_BLOCK_RE :1025, renderInjectedMessage :1047, bodies loop
             :1058-1064, tier-3 arm :1088-1090, image guard :1091."

# MUST READ — the cursor semantics being mirrored
- file: file-injector.ts
  why: "computeDetailOffsets :467-536 (post-S2): `cursorByPath: Map<string, number>` — details consume their
        path's blocks IN EMISSION ORDER; a paged detail consumes its head and the directive stays unmatched.
        The tier-3 FIFO (array + shift()) reproduces exactly this in-order per-path consumption."
  pattern: "cursorByPath comment at :475-478 ('index of the next unmatched block, keyed by path, so a paged
            detail (head then directive) consumes the head …')."
  gotcha: "Do NOT edit computeDetailOffsets — S1/S2 own it (S2 landed in the working tree). S3's territory is
           renderInjectedMessage ONLY."

# MUST READ — the S2 parallel contract (disjoint region)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/P1M1T1S2/PRP.md
  why: "S2's consumed_by names S3: 'the path-aware tier-3 fallback — S3's renderer change must not regress
        S2's tier-1 binary offsets; S3's tests pin the renderer consuming S2's offsets.' S2 edits
        computeDetailOffsets (:467-536); S3 edits renderInjectedMessage (:1047-1102) — DISJOINT."
  critical: "After S1+S2, NEW url/binary details have tier-1 offsets and never reach tier-3. S3's test must
             therefore SIMULATE an old message: craft details WITHOUT contentStart/contentLen and WITHOUT d.body."

# The test seam (copy the pattern)
- file: file-injector.test.mjs
  why: "REND-MULTI-OFFSET (:2778 pre-S1; now ~:2800) is the canonical 'craft blocks + details, render expanded,
        assert body children' pattern: REND_THEME stub + REND_W + `textOf = (child) => child.render(REND_W).join(\"\\n\")`
        (Box.children public; Text.text private → read via render). Insert REND-TIER3-PATH after REND-PAGED-DIR
        (locate by its runCase label, ~:2934)."
  gotcha: "jiti loads the REAL pi-tui Box/Text (alias map at test :50-72) — children are real Text instances."

# The bug report (steps-to-reproduce + expected display)
- file: plan/011_e473dac8178b/bugfix/001_a6ffb98ab096/prd_snapshot.md
  why: "§h2.2/§h3.0 Issue 1: the exact repro (big.log paged + note.bin / URL; expanded view shows '<paged: …>'
        twice, never the note) and §h2.5 Recommendation 1's second half — S3's normative source."
```

### Current Codebase tree (verification targets)

```bash
pi-file-injector/
├── file-injector.ts            # ← EDITED: renderInjectedMessage only (bodies loop + tier-3 arm + 3 comments)
├── file-injector.test.mjs      # ← EDITED: +REND-TIER3-PATH (after REND-PAGED-DIR); 182 → 183
├── import-behavior.test.mjs    # untouched (23)
├── relative-imports.test.mjs   # untouched (38)
├── url-injection.test.mjs      # untouched (38)
└── scripts/typecheck.mjs       # untouched (strict only — no noUnusedLocals)
```

### Desired Codebase tree (files touched)

```bash
file-injector.ts          # renderInjectedMessage: bodies[] → bodiesByPath (build in the same exec loop);
                          # tier-3 arm → gated per-path shift(); Mode-A comments ×3. NO new exports.
file-injector.test.mjs    # +REND-TIER3-PATH (TDD RED-first). NO other test edits.
```

### Known Gotchas of our codebase & Library Quirks

```ts
// CRITICAL — TDD ORDER: write REND-TIER3-PATH and RUN IT FIRST. Pre-fix it must FAIL with the binary body
//   containing "<paged:" (that's the bug). If it passes pre-fix, the fixture is wrong (check the details lack
//   contentStart/contentLen AND d.body — else tiers 1/2 intercept and tier-3 never fires).

// CRITICAL — REPLACE bodies[] ENTIRELY, don't keep both. After the fix nothing consumes bodies[i]; the dead
//   array is cruft (strict has no noUnusedLocals so tsc won't flag it — grep discipline instead: 0 hits).
//   The `body !== undefined` guard at :1091 keeps working: `bodiesByPath.get(d.path)?.shift()` is
//   `string | undefined` for BOTH a missing path and an empty queue.

// CRITICAL — POP ONLY IN THE TIER-3 ARM, GATED ON kind !== "image". Tiers 1+2 are evaluated first (unchanged);
//   a detail served by tier-1/2 must NOT consume a queue slot (keeps cursor semantics clean), and image
//   details must NEVER pop (their block inner — image hint / F5 note — stays queued; harmless).

// CRITICAL — THE PAGED EDGE IS THE WHOLE POINT. A paged path queues TWO inners (head, directive). The paged
//   detail pops the FIRST (the head) — matching cursorByPath, which pairs a paged detail with its head block.
//   The directive inner is never popped by anyone (run-dedup ⇒ no second detail shares the path). Do NOT
//   "clean it up" — that's the designed residue.

// GOTCHA — FILE_BLOCK_RE is MODULE-LEVEL with the g flag: the existing `FILE_BLOCK_RE.lastIndex = 0` reset
//   at :1061 is load-bearing (shared regex state); keep it in the rewritten loop.

// GOTCHA — BUG-1 (literal `</file>` in content truncates the lazy `([\s\S]*?)`) is NOT fixed by S3 and MUST
//   NOT be claimed as fixed: path-awareness repairs PAIRING, not truncation. Tiers 1+2 (offset slice / d.body)
//   remain the BUG-1-safe paths; keep the comment saying exactly that.

// GOTCHA — line numbers here are CURRENT (post-S2 tree, 1954 lines): FILE_BLOCK_RE :1025, renderInjectedMessage
//   :1047-1102, bodies loop :1058-1064, tier-3 arm :1088-1090, image guard :1091. The item contract's numbers
//   (:1003/:1025-1082/:1036-1042/:1065-1067) are pre-S1/S2 — SHIFTED. Place edits by the literal oldText.

// GOTCHA — module-surface allowlist (file-injector.test.mjs:141-155) rejects unregistered exports: bodiesByPath
//   is a function-LOCAL const — invisible to Object.keys(mod). Do NOT export it.
```

---

## Implementation Blueprint

### Edit 1 — the bodies build loop → `bodiesByPath` (:1058-1064)

**oldText** (current, verbatim):
```ts
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0; // module regex w/ g flag → reset before the loop
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
      bodies.push(m[2].replace(/^\n|\n$/g, "")); // strip the wrapping newlines from <file>\n…\n</file>
    }
  }
```

**newText**:
```ts
  // BUG-001 (P1.M1.T1.S3) — tier-3 is PATH-AWARE: path → FIFO of block-body inners, in emission (match)
  // order — the same in-order per-path consumption as computeDetailOffsets's cursorByPath. Group 1 (the
  // block's path) was captured but unused pre-S3. A paged path queues TWO inners (head, then the directive):
  // a paged detail pops the head and the directive inner is never consumed — which is why the old
  // bodies[i] index pairing (detail index ↔ block order) drifted +1 per preceding paged file (2 blocks,
  // 1 detail) and showed the directive as a following url/binary file's body.
  const bodiesByPath = new Map<string, string[]>();
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0; // module regex w/ g flag → reset before the loop
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
      const inner = m[2].replace(/^\n|\n$/g, ""); // strip the wrapping newlines from <file>\n…\n</file>
      const q = bodiesByPath.get(m[1]);
      if (q !== undefined) q.push(inner);
      else bodiesByPath.set(m[1], [inner]);
    }
  }
```

### Edit 2 — the tier-3 arm (:1088-1090)

**oldText** (current, verbatim):
```ts
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body : bodies[i]);
```

**newText**:
```ts
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body
          : (d.kind !== "image" ? bodiesByPath.get(d.path)?.shift() : undefined)); // BUG-001: per-path FIFO pop (emission order); image never renders/pops
```

(`bodiesByPath.get(d.path)?.shift()` → `string | undefined`; the existing `body !== undefined` guard at :1091
handles a missing path / empty queue exactly as `bodies[i] === undefined` did.)

### Edit 3 — the in-loop 3-tier comment (:1081-1087)

**oldText** (current, verbatim):
```ts
      // 3-tier body resolution (§12.22 offset → stored body → regex fallback). Real emission (P1.M2.T1.S1)
      // carries contentStart/contentLen (no duplicated bytes); tier-1 slices message.content EXACTLY — BUG-1-safe
      // because the offsets are length-derived (block.length − header − footer), NOT regex: a body containing a
      // literal </file> (which truncates FILE_BLOCK_RE's lazy capture) slices whole. Tier-2 (d.body) covers
      // old/foreign/test entries still carrying the deprecated body field. Tier-3 (bodies[i]) is the last-resort
      // regex fallback for entries with neither (§6.3/§12.23 defensive rendering).
```

**newText**:
```ts
      // 3-tier body resolution (§12.22 offset → stored body → PATH-AWARE regex fallback). Real emission
      // (P1.M2.T1.S1) carries contentStart/contentLen (no duplicated bytes); tier-1 slices message.content
      // EXACTLY — BUG-1-safe because the offsets are length-derived (block.length − header − footer), NOT
      // regex: a body containing a literal </file> (which truncates FILE_BLOCK_RE's lazy capture) slices
      // whole. Tier-2 (d.body) covers old/foreign/test entries still carrying the deprecated body field.
      // Tier-3 (BUG-001, P1.M1.T1.S3) is the last-resort fallback for entries with neither — PATH-AWARE: it
      // pops this detail's path's next queued inner (FIFO, emission order; the same in-order consumption as
      // computeDetailOffsets's cursorByPath), so it can never show another file's block after a paged file
      // (2 blocks / 1 detail broke the old bodies[i] index pairing). Image details never render a body and
      // never pop. BUG-1 caveat (unchanged): the inners are still regex-recovered — a literal </file> in
      // content truncates the lazy capture — tiers 1+2 remain the BUG-1-safe paths (§6.3/§12.23 defensive
      // rendering).
```

### Edit 4 — the function-level "BODY derivation" comment (:1049-1057)

Replace the tier-3 clause. **oldText** (current, verbatim):
```ts
  // below — last-resort fallback for entries with neither (§6.3/§12.23 defensive rendering). The regex re-parse
  // is computed UNCONDITIONALLY (cheap; needed for tier 3) but is only USED when tiers 1+2 miss. BUG-1: a file
  // whose own content contains a literal `</file>` truncates the lazy `([\s\S]*?)` at the INNER `</file>`, so
  // tiers 1+2 (length-derived offset / stored body) are the BUG-1-safe paths; tier 3 is regex-vulnerable but
  // only fires for entries without offsets/body (test-crafted / old), where BUG-1 is not a real-world risk.
```
**newText**:
```ts
  // below — last-resort fallback for entries with neither, PAIRED BY PATH (BUG-001, P1.M1.T1.S3: the path→FIFO
  // `bodiesByPath`, popped in emission order like computeDetailOffsets's cursorByPath — the old bodies[i]
  // index pairing mis-fired after a paged file: 2 blocks / 1 detail) (§6.3/§12.23 defensive rendering). The
  // regex re-parse is computed UNCONDITIONALLY (cheap; needed for tier 3) but is only USED when tiers 1+2 miss.
  // BUG-1: a file whose own content contains a literal `</file>` truncates the lazy `([\s\S]*?)` at the INNER
  // `</file>`, so tiers 1+2 (length-derived offset / stored body) are the BUG-1-safe paths; tier 3 is
  // regex-vulnerable (pairing is path-safe; truncation is not fixed) but only fires for entries without
  // offsets/body (test-crafted / old), where BUG-1 is not a real-world risk.
```
(The two preceding lines of that block — tiers 1 and 2 — are unchanged; anchor the edit on the clause above.)

### Edit 5 — the JSDoc guard mention (:1039)

**oldText** (current, verbatim): `` `bodies[i] !== undefined` guard; image expanded-view short-circuit ``
**newText**: `` `bodiesByPath` pop guard (missing path / empty FIFO → no body child); image expanded-view short-circuit ``

### Edit 6 — the test (file-injector.test.mjs, TDD: insert FIRST, run, confirm RED)

Insert immediately **after the REND-PAGED-DIR case** (locate by `await runCase("REND-PAGED-DIR", …)`):

```js
// REND-TIER3-PATH — BUG-001 (P1.M1.T1.S3): the tier-3 fallback is PATH-AWARE. Simulates an OLD persisted
// message (pre-offset custom_message): details carry NO contentStart/contentLen and NO d.body, so the
// renderer must recover bodies via tier-3. A paged file emits TWO blocks (head + directive) but ONE detail —
// the old bodies[i] pairing indexed BLOCKS by DETAIL position, so the binary showed the <paged: directive
// and the url showed the binary note. Post-fix each detail pops its OWN path's FIFO inner.
await runCase("REND-TIER3-PATH", "BUG-001(old msg): tier-3 pairs by PATH — after a paged file, url/binary bodies are their OWN content (not the directive)", async () => {
  const pagedHead = '<file name="/abs/big.log">\nHEAD-CONTENT-LINE-1\nHEAD-CONTENT-LINE-2\n</file>';
  const directiveBl = '<file name="/abs/big.log"><paged: 118890 chars; head delivered 212 complete lines; read the rest with the read tool at offset:213, limit:2000, incrementing offset by 2000 until done></file>';
  const binaryBl = '<file name="/abs/note.bin"><binary file — contents not injected; use the read tool if needed></file>';
  const urlBl = '<file name="https://example.com/doc">\nURL-DOC-MARKDOWN-BODY\n</file>';
  const content = [pagedHead, directiveBl, binaryBl, urlBl].join("\n\n"); // the real assembly separator
  const details = [ // OLD message: no contentStart/contentLen, no body — tier-3 territory by construction
    { path: "/abs/big.log", kind: "paged", range: ":213-", directive: "<paged: 118890 chars; head delivered 212 complete lines; read the rest with the read tool at offset:213, limit:2000, incrementing offset by 2000 until done>" },
    { path: "/abs/note.bin", kind: "binary" },
    { path: "https://example.com/doc", kind: "url", chars: 21 },
  ];
  const box = mod.renderInjectedMessage({ details: { files: details }, content }, { expanded: true }, REND_THEME);
  // children: [0] read big.log:213- (+hint) · [1] HEAD body · [2] dim d.directive · [3] read note.bin ·
  //           [4] binary note body · [5] read url · [6] url body  → 7 total
  assert(box.children.length === 7, `expanded = 3 read lines + 3 bodies + 1 dim directive; got ${box.children.length}`);
  const headBody = textOf(box.children[1]);
  assert(headBody.includes("HEAD-CONTENT-LINE-1"), `paged detail pops its path's FIRST inner (the head), got ${JSON.stringify(headBody.slice(0, 60))}`);
  const binBody = textOf(box.children[4]);
  assert(binBody.includes("binary file — contents not injected"), `binary body is its OWN note, got ${JSON.stringify(binBody.slice(0, 60))}`);
  assert(!binBody.includes("<paged:"), `BUG-001: binary body must NOT show the paged directive, got ${JSON.stringify(binBody.slice(0, 80))}`);
  const urlBody = textOf(box.children[6]);
  assert(urlBody.includes("URL-DOC-MARKDOWN-BODY"), `url body is its OWN markdown, got ${JSON.stringify(urlBody.slice(0, 60))}`);
  assert(!urlBody.includes("<paged:") && !urlBody.includes("binary file"), `BUG-001: url body must show neither the directive nor the binary note, got ${JSON.stringify(urlBody.slice(0, 80))}`);
  // the directive text appears ONLY as the paged detail's own dim d.directive child ([2]) — never as a body
  assert(textOf(box.children[2]).includes("paged:"), `[2] is the dim directive child (the one legitimate directive display)`);
});
```

**Pre-fix expectation (RED):** bodies = `[headBody, "<paged: …>", "<binary file — …>", urlBody]`; the binary
detail (i=1) renders `bodies[1]` = `<paged: …>` → the `!binBody.includes("<paged:")` assert fails. Run
`node ./file-injector.test.mjs` and confirm exactly that failure mode before applying Edits 1-5.

### Integration Points

```yaml
FILE_EDITS (file-injector.ts — renderInjectedMessage ONLY, :1047-1102):
  - Edit 1: bodies loop → bodiesByPath build (same exec loop; group 1 keys; group 2 inner, 1× \n stripped).
  - Edit 2: tier-3 arm → `(d.kind !== "image" ? bodiesByPath.get(d.path)?.shift() : undefined)`.
  - Edits 3/4/5: Mode-A comment updates (in-loop 3-tier block; function-level BODY-derivation clause; JSDoc guard mention).
  - UNCHANGED: tier-1/tier-2 conditions; the image guard (:1091); the paged dim-directive child (:1096-1098);
          the no-details fallback; readLine/expandHint/tildify; computeDetailOffsets (S1/S2 territory);
          FILE_BLOCK_RE itself (:1025).

TEST_EDITS (file-injector.test.mjs): +REND-TIER3-PATH after REND-PAGED-DIR. NO other test edits
  (REND-6/7/11, REND-PAGED-DIR/URL, REND-MULTI-* stay green UNEDITED).

NO new exports (module-surface allowlist :141-155 must stay green — bodiesByPath is function-local).
```

### Implementation Tasks (ordered — TDD)

```yaml
Task 1: ADD the test (Edit 6) and confirm RED
  - INSERT REND-TIER3-PATH after the REND-PAGED-DIR case (locate by its runCase label).
  - RUN node ./file-injector.test.mjs → EXPECT exactly 1 failure: REND-TIER3-PATH with the binary body
    containing "<paged:" (the bug). If it PASSES pre-fix, the fixture is leaking into tier-1/2 — verify the
    crafted details have NO contentStart/contentLen and NO body field.

Task 2: APPLY Edits 1-5 (the fix + Mode-A comments)
  - LOCATE by literal oldText (line numbers shift with S2; the texts above are current).
  - VERIFY no bodies[i] token remains: grep -c "bodies\[i\]" file-injector.ts → 0.

Task 3: GREEN GATE
  - node ./file-injector.test.mjs → 183 passed, 0 failed (REND-TIER3-PATH green; REND-6/7/11,
    REND-PAGED-DIR/URL, REND-MULTI-OFFSET/E2E/3FILE all green — tiers 1/2 untouched).
  - node ./import-behavior.test.mjs (23) · node ./relative-imports.test.mjs (38) · node ./url-injection.test.mjs (38).
  - npm run typecheck → 0 errors.
```

## Validation Loop

### Level 1: Typecheck

```bash
cd /home/dustin/projects/pi-file-injector
npm run typecheck
# EXPECT: "typecheck: file-injector.ts type-checks clean under --strict (0 errors)" + exit 0.
# Note: `bodiesByPath.get(d.path)?.shift()` is string | undefined — flows into the existing body !== undefined
# guard; no type change needed anywhere.
```

### Level 2: The suites

```bash
node ./file-injector.test.mjs     # EXPECT: 183 passed, 0 failed (was 182; +REND-TIER3-PATH)
node ./import-behavior.test.mjs   # EXPECT: 23 passed, 0 failed
node ./relative-imports.test.mjs  # EXPECT: 38 passed, 0 failed
node ./url-injection.test.mjs     # EXPECT: 38 passed, 0 failed
npm test                          # chains all four
```

### Level 3: Structural verification (the refactor landed cleanly)

```bash
grep -c "bodies\[i\]" file-injector.ts                      # expect 0 (code + comments + JSDoc)
grep -c "bodiesByPath" file-injector.ts                     # expect ≥3 (build comment, build, pop) — no export
grep -c "export" file-injector.ts | tail -1                 # unchanged export count (surface untouched)
grep -n "REND-TIER3-PATH" file-injector.test.mjs            # expect exactly 1 hit (the runCase)
```

### Level 4: N/A (display-only fix; the REND cluster IS the domain validation)

```bash
# The renderer is only observable via the test seam (real pi-tui Box/Text through jiti) — REND-TIER3-PATH is
# the end-to-end display gate. No runtime/manual step adds signal beyond it.
```

## Final Validation Checklist

### Technical Validation

- [ ] TDD honored: REND-TIER3-PATH RED pre-fix (binary body shows `<paged:`), GREEN post-fix.
- [ ] `npm run typecheck` → 0 errors.
- [ ] Suites: 183 / 23 / 38 / 38, all 0 failed; `npm test` exits 0.

### Feature Validation (the BUG-001 contract)

- [ ] Old-message simulation: after a paged file, the binary body shows its OWN note; the url body shows its OWN markdown; no body child contains `<paged:`.
- [ ] The paged detail pops its path's FIRST inner (head); the directive appears ONLY as the dim d.directive child.
- [ ] Tier-1/tier-2 conditions byte-identical (REND-11, REND-PAGED-DIR, REND-PAGED-URL, REND-MULTI-* green unedited).
- [ ] Image details never pop; REND-7 green unedited.

### Code Quality Validation

- [ ] No `bodies[i]` token anywhere (grep 0); no dead `bodies` array retained.
- [ ] No new exports (module-surface allowlist :141-155 green).
- [ ] computeDetailOffsets untouched (S1/S2 territory; S2's kind-gated binary branch intact).
- [ ] BUG-1 caveat comments accurate (pairing path-safe; truncation unfixed; tiers 1+2 the safe paths).

### Documentation (Mode A)

- [ ] In-code 3-tier comments (both blocks) + JSDoc guard mention describe the path-aware tier-3.
- [ ] README untouched (P1.M4.T6 owns the changeset sweep; the existing expanded-view description stays accurate post-fix).

---

## Anti-Patterns to Avoid

- ❌ **Do NOT write the fix before the test.** REND-TIER3-PATH must be demonstrated RED first — a fix committed without the RED run proves nothing about the bug.
- ❌ **Do NOT let the test fixture leak into tiers 1/2.** The crafted details must have NO `contentStart`/`contentLen` and NO `body` — otherwise tier-1/2 intercept and the test passes pre-fix (a false green that pins nothing).
- ❌ **Do NOT touch tiers 1/2, the image guard, or the dim-directive child.** S3 changes ONLY the tier-3 arm and the bodies build. Any change to the tier-1 condition regresses the BUG-1-safe path for url/binary (S1/S2's work).
- ❌ **Do NOT edit computeDetailOffsets.** S1/S2 own it; S2 landed its kind-gated binary branch — S3's renderer change must not regress it (S2's consumed_by contract).
- ❌ **Do NOT pop for image details or on tier-1/2 hits.** Pop ONLY in the tier-3 arm, gated `kind !== "image"` — keeps the FIFO cursor semantics clean.
- ❌ **Do NOT "clean up" the never-popped directive inner.** A paged path's second queue entry staying unconsumed is the designed residue (mirrors cursorByPath leaving the directive block unmatched).
- ❌ **Do NOT claim BUG-1 is fixed.** Path-awareness fixes PAIRING, not the lazy-capture truncation on a literal `</file>` in content — keep the caveat comments saying exactly that.
- ❌ **Do NOT export bodiesByPath** (module-surface allowlist fails) and do NOT keep the dead `bodies` array alongside the map.
- ❌ **Do NOT trust the item contract's line numbers** (:1003/:1025-1082/:1036-1042/:1065-1067 are pre-S1/S2). Place edits by the literal oldText (current: FILE_BLOCK_RE :1025, bodies loop :1058-1064, tier-3 :1088-1090).

---

## Confidence Score: 9/10

A surgical, well-precedented fallback-tier rewrite: the design (path→FIFO mirroring cursorByPath) is the PRD's
own recommendation and is fully evaluated in the architecture doc (candidate (b), including both edges — paged
queues two inners; directive residue); both edit sites' oldText is verified verbatim against the post-S2 tree;
the TDD test (fixtures, child-index map, assertions, expected RED failure mode) is given in full; the
must-stay-green neighbors are enumerated with reasons; baselines (182/23/38/38, typecheck clean) are verified
this session. The -1 reserves for the parallel-S2 coordination (disjoint regions, but S3's test asserts tier-3
behavior that coexists with S2's tier-1 offsets — if S2's working-tree state shifts lines again, edits place by
literal text, which the PRP enforces) and the JSDoc/comment rewrite precision (three comment sites must end
consistent — the grep gates catch stragglers).