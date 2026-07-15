# Research Notes — P1.M1.T1.S2 (Remove sentinel mechanism entirely)

Scope: a **deletion task** — remove all 4 references to the F1 sentinel mechanism from the existing
`./sharp-at-file.ts`, restoring exact PRD §6.2 assembly format. Fixes **Issue 2** (sentinel-in-prompt
false negative) and **Issue 6** (assembly format deviation). Depends on **P1.M1.T1.S1** (per-token
dedup) being in place.

---

## 1. Dependency on S1 — CONFIRMED IN PLACE

The work item states: "The sentinel removal is safe ONLY because per-token dedup now handles
re-injection prevention." **Verified S1 is already implemented** in the current file:

```
147:    // PER-TOKEN DEDUP — if a <file> block for this exact absolute path already exists in `text`
148:    // (injected by a prior copy of this extension in the runner's input-handler chain), skip
149:    // re-injecting. Cooperation-independent: works even when the prior copy was a non-sentinel
150:    // version (the default `pi -e` path when a global copy co-loads). Fixes Issue 1. Uses a plain
151:    // substring test so path chars ([ ] . ( ) …) need no escaping; matches all 4 block prefixes.
152:    if (text.includes('<file name="' + abs + '">')) continue;
```

So when S2 runs, the per-token dedup is live inside the `injectFiles` for-loop. This is the **sole
reason** the sentinel can be deleted: re-injection prevention (the sentinel's only job) is now done
structurally (a `<file name="<abs>">` block already in `text` ⇒ skip), independent of any sentinel
string and independent of whether a co-loaded copy stamps one.

## 2. The 4 sentinel references — EXACT locations (current line numbers, post-S1)

`grep -nE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts` → exactly 4 hits:

| # | Line | What | Edit |
|---|------|------|------|
| 1 | ~18-24 | `/** F1 — hidden sentinel stamped … */` JSDoc (7 lines) | **DELETE** (with #2/#3) |
| 2 | 25 | `const INJECT_SENTINEL = "<!--#@file-injected-->";` | **DELETE** |
| 3 | 26 | `const SENTINEL_RE = /<!--#@file-injected-->/;` | **DELETE** |
| 4 | 211 | `const finalText = \`${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}\`;` | **MODIFY** → drop `${INJECT_SENTINEL}\n\n` |
| 5 | ~244-247 | `// F1 — if THIS message was already transformed …` comment (4 lines) + guard | **DELETE** (handler) |
| 6 | 248 | `if (SENTINEL_RE.test(event.text)) return { action: "continue" };` | **DELETE** |

(Items 1-3 are one contiguous block to delete; 5-6 are one contiguous block; 4 is a one-line modify.
→ **3 surgical edits**.)

Note: the work item estimated lines ~21-27 / ~139 / ~147, but S1's dedup insertion shifted the file;
the ACTUAL current numbers are above. The PRP uses **exact-text anchors** (not line numbers) so the
edits are robust to further shifts.

## 3. The three exact edits (anchors are unique in the file)

### Edit A — delete the sentinel constants block
Sits between `const TRAILING_PUNCT = …;` (unique) and `/** F3 — magic-number sniff…` (unique). Delete
the F1 JSDoc + both consts, leaving TRAILING_PUNCT directly followed by the F3 JSDoc (one blank line).

### Edit B — fix the assembly line (Issue 6)
Unique line (only occurrence of `const finalText = `). Remove the 4-line F1 comment above it and
change `${INJECT_SENTINEL}\n\n` out of the template. Restores exact PRD §6.2:
`${text}\n\n---\n\n${blocks.join("\n\n")}`.

### Edit C — delete the handler sentinel guard (Issue 2)
Sits between the `!event.text?.includes("#@")` guard (unique) and the `injectFiles` call (unique).
Delete the 4-line F1 comment + the `if (SENTINEL_RE.test(event.text)) return {…}` line. The three
REMAINING handler guards (`source==='extension'`, `streamingBehavior==='steer'`, `!includes("#@")`)
are **untouched**.

After all three edits: `grep -cE "INJECT_SENTINEL|SENTINEL_RE" sharp-at-file.ts` → **0**.

## 4. CRITICAL — the existing 28-case harness STAYS GREEN (verified by static analysis)

The harness's **F1 test** (sharp-at-file.test.mjs, case "F1") is the only test touching sentinel
behavior. It asserts **behavior, not the sentinel string**:

```js
const first = await mod.injectFiles("Review #@a.ts", [], FIX);
const out = await slot.cb({ text: first.text, source: "interactive", images: first.images }, ctx);
assert(out.action === "continue", …);              // ← behavior
assert(rec.notify === undefined, …);               // ← behavior
const aCount = (first.text.match(/<file name="…a.ts…">/g) || []).length;
assert(aCount === 1, …);                           // ← count, on first.text (1 pass only)
```

**Why it still passes after sentinel removal** (traced with S1's dedup live):
1. `first = injectFiles("Review #@a.ts")` → clean text, no `<file>` block for a.ts → dedup does NOT
   fire → injects → `first.text = "Review #@a.ts\n\n---\n\n<file name="<abs>/a.ts">…"` (NO sentinel
   after Edit B), count=1.
2. Feed `first.text` through the handler:
   - `source==="interactive"` → not extension → continue
   - `streamingBehavior` undefined → not steer → continue
   - `!event.text.includes("#@")` → text STILL contains `#@a.ts` → guard does NOT fire → proceed
   - **(sentinel guard DELETED by Edit C)** → proceed
   - `injectFiles(first.text, …)` runs: matchAll re-finds `#@a.ts`; token=a.ts; abs=<abs>/a.ts;
     **PER-TOKEN DEDUP fires** (`first.text.includes('<file name="<abs>/a.ts">')` → TRUE) → `continue`;
     count stays 0 → returns `{ text: first.text, images, injected: 0 }`.
   - `!injected` → handler returns `{ action: "continue" }`; notify NOT called.
3. Assertions: `out.action === "continue"` ✓ ; `rec.notify === undefined` ✓ ; `aCount === 1` (on
   `first.text`, which has exactly one block from the single first pass) ✓.

**No other test references the sentinel string.** All count>0 cases use `startsWith` / `includes` /
`endsWith` / block-presence checks (never full-text equality); all full-text `===` checks are on
count===0 cases (where injectFiles returns the original text untouched — sentinel never added).
**→ Harness remains 28 passed / 0 failed.**

The F1 test's NAME/comment ("when a sentinel is already present") becomes cosmetically misleading
after removal, but its assertions still hold. Renaming/relabeling it (and adding co-load +
sentinel-in-prompt cases) is **M2.T1.S1's scope** — explicitly NOT this task.

## 5. The fixes this task delivers

- **Issue 2 (sentinel-in-prompt false negative):** the handler's `SENTINEL_RE.test(event.text)` guard
  tested the RAW user prompt before injection and bailed if it contained the literal
  `<!--#@file-injected-->`. Deleting the guard (Edit C) means such prompts now flow to `injectFiles`,
  where per-token dedup only skips paths that already have a `<file>` block — a brand-new `#@a.ts`
  with no prior block IS injected. **Fixed.**
- **Issue 6 (assembly format deviation):** Edit B drops `${INJECT_SENTINEL}\n\n`, so the assembly is
  exactly `<text>\n\n---\n\n<block1>\n\n<block2>` (PRD §6.2). **Fixed.**
- **Issue 1 (duplicate injection):** already fixed by S1's per-token dedup. Removing the sentinel
  does not regress it — in fact it removes the now-dead, cooperation-dependent code path. (The dedup
  is the live fix; the sentinel would have done nothing useful once dedup exists.)

## 6. Verification script (Issue 2 + Issue 6 + dedup still works)

After the edits, a throwaway Node script (NOT added to the harness) proves all three:
- Issue 2: prompt containing `<!--#@file-injected-->` AND `#@a.ts` → handler returns `transform` and
  the a.ts block is present (was: `continue` / no injection before Edit C).
- Issue 6: `injectFiles` output contains NO `<!--#@file-injected-->`; assembly is
  `<text>\n\n---\n\n<block>`.
- Dedup intact: re-feeding first-pass output through `injectFiles` → `injected===0`.

Uses the SAME jiti+alias import pattern the harness uses (verified in S1's PRP). No model/API key.

## 7. Scope boundaries (what S2 must NOT do)

- ❌ Do NOT add or change the per-token dedup line (S1 owns it; it's already correct).
- ❌ Do NOT change `FILE_INJECT_RE` for Unicode (that's M1.T2.S1, Issue 5).
- ❌ Do NOT edit `sharp-at-file.test.mjs` — not even the F1 test's name/comment (that's M2.T1.S1).
- ❌ Do NOT touch the F3/F5/F4 code or comments (F3/F5 are documentation-only per the bugfix PRD; M3
  documents them). Only F1 (sentinel) is removed.
- ❌ Do NOT edit README.md (M3.T1/T2).
- ❌ Do NOT touch the three remaining handler guards, the block helpers, `cleanToken`/`expandTildeAndResolve`/`extOf`, or `isBinary`.
- ✅ DO make exactly three edits: delete constants block (Edit A), modify assembly (Edit B), delete
  handler guard (Edit C). Then verify 0 sentinel references + harness 28/28.
