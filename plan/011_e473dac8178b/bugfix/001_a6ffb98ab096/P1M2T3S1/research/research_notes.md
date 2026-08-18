# P1.M2.T3.S1 Research Notes — BUG-003 (empty-body URL image → F5 note, no attachment)

Date: 2026-08-18 · Session: PRP research (read-only)

## 1. HEADLINE FINDING — a candidate implementation ALREADY EXISTS at HEAD

Commit `fe766bd` ("Mirror F5 empty-image guard into URL image branch (BUG-003)", Aug 18 10:29:17 2026)
already contains, on branch `xiliumz/main`:

| Artifact | Location (current working-tree lines) | State |
|---|---|---|
| Guard in `injectUrl` image branch | `file-injector.ts:946-959` | Present, matches architecture doc (h) placement exactly |
| `URL-IMG-EMPTY` regression test | `url-injection.test.mjs:366-386` (right after DIS-4 :346-360) | Present, all 5 required assertions + exactly-one-fetch spy |
| README Images bullet | `README.md:83-85` (### URLs) | Present — "attaches nothing … same note a 0-byte local image does" |
| No new exports | surface allowlist `file-injector.test.mjs:141-155` | `formatEmptyImageBlock` was already exported (:387) — nothing added |

Verification run this session: `npm test` → 183 + 23 + 38 + 39 passed, 0 failed (URL suite includes
URL-IMG-EMPTY). `npm run typecheck` → 0 errors under --strict.

The task is still marked "Researching" in `plan/…/tasks.json` (uncommitted orchestrator edit) and
`P1M2T3S1/PRP.md` did not exist — hence this PRP session. The PRP therefore specifies the full fix
(standalone, re-derivable from scratch) AND directs the implementer to verify-then-close-gaps.

## 2. Root cause chain (verified against working tree)

1. `readBytesCapped` (`file-injector.ts:882-900`) returns an **EMPTY Buffer, not null**, for a
   zero-length body on BOTH paths: streaming (`Buffer.concat([])`) and no-reader (`Buffer.from(new
   ArrayBuffer(0))`). `null` is returned ONLY on cap overflow.
2. So the existing `if (buf === null) return false;` guard (:945) never catches the empty case.
3. `resizeImage` (external, global pi package via jiti alias) is **deterministically null on empty
   bytes**: `photon.PhotonImage.new_from_byteslice` throws → `catch { return null; }` (traced in
   `…/pi-coding-agent/dist/utils/image-resize-core.js:32-118`).
4. Pre-fix result: `state.images.push({ type:"image", data:"", mimeType })` — empty base64 of an
   empty buffer — the provider-rejected ImageContent shape. (`estimateImageTokens(null)` = 2805 =
   `IMAGE_FALLBACK_TOKENS` :118 is also the wrong cost for 0 bytes, and under a tight budget guard 3
   silently verbatimed the token instead.)

## 3. The guard, verbatim as it exists at HEAD (:946-959)

```ts
      if (buf.length === 0) {
        const f5Block = formatEmptyImageBlock(url);
        state.blocks.push(f5Block);
        state.details.push({ path: url, kind: "image", dimensionHint: undefined });
        subtract(state, Math.ceil(f5Block.length / 4)); // note consumes budget (mirror F5)
        state.count++;
        return true;
      }
```
Plus an 7-line comment (see PRP for full text). Placement: AFTER the `buf === null` check (:945),
BEFORE `const mime`/`resizeImage` (:961-962) and BEFORE guard-3 budget check (:964) — exactly the
architecture doc §(h) placement analysis.

## 4. F5 local template (the mirror source), `file-injector.ts:1363-1378`

`if (mime && buf.length === 0)` → LR-2 ranged-claim normalization (file-specific, NOT mirrored —
URLs have no claimKey; the URL loop already claimed the abs before calling injectUrl) →
`formatEmptyImageBlock(abs)` → blocks.push → `details.push({path, kind:"image", dimensionHint:
undefined})` → `subtract(ceil(len/4))` → (count++ happens in injectFile's tail, :~1378+). injectUrl
owns its own count++ inside the branch (injectUrl returns per-token boolean).

## 5. Test conventions verified (url-injection.test.mjs)

- `FIX = { cwd: TMPDIR }` (:122); `hasBlock(r, needle)` = `r.blocks.some(b => b.includes(needle))` (:127-129).
- `origFetch` saved (:130); every case wraps fetch stub in try/finally restore (a leaked stub poisons later cases / hits real network).
- `makeRes({ ct, body, status, ok, contentLength })` (:143-167): Response-shaped object; `body: ""`
  → single zero-length chunk → deterministic empty-buffer path. Do NOT stub `resizeImage` (external,
  jiti-aliased; harness relies on deterministic null-on-invalid).
- DIS-4 (:346-360) is the non-empty image template — must stay green (byte-exact raw base64 assertions).
- Case labels must be unique; `URL-IMG-EMPTY` is not colliding with the historical BUG-001/BUG-002 labels.

## 6. Semantics / risk notes (from architecture/injection_bug002_003.md, cross-checked)

- Note path ALWAYS delivers — no over-budget turn-away — deliberate F5-parity choice
  (`subtract` clamps at 0, :607-611). Behavior change under tight budgets: empty image used to
  verbatim silently; now returns true + note. No existing test asserted the old behavior.
- Detail `{ path: url (https), kind: "image" }` keeps the input-handler ISSUE-IMG-URL notify axis
  intact ("injected 1 URL") and the renderer's image short-circuit (§6.4: image details never render
  a body; tier-3 pop guard `d.kind !== "image"` at :~1094).
- Model-facing `message.content` changes for the defect case only (note block instead of empty
  attach / silent verbatim) — the "message.content unchanged" invariant applies to correct cases.
- `ctx` param of injectUrl is unused by this guard; no signature change anywhere.

## 7. Sibling/dependency situation (guard against cross-item harm)

- No dependencies (`dependencies: []`); disjoint from BUG-002 (P1.M2.T2.S1, injectMarkdown Step-5 —
  NOTE: that fix is NOT in the working tree despite "Complete" status; out of scope here, flag to
  orchestrator if observed).
- Must not touch: text/html + raw-text paths in injectUrl, DIS-4/FAIL-* cases, the §3.3 guards,
  the module surface (allowlist test), or any exported signature.

## 8. Definition of Done (mirrors sibling subtasks)

`npm test` (4 suites) + `npm run typecheck` green; URL-IMG-EMPTY present and passing; README Images
bullet present; no new exports; plan artifacts (PRP.md + research/) committed; tasks.json P1.M2.T3.S1
status flipped to Complete by the implementer per the sibling commit pattern (e.g. 71e9f45).