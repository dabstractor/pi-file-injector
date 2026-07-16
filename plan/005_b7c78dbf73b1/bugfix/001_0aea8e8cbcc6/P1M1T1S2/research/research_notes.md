# Research Notes — P1.M1.T1.S2: Un-claim abs from injectedSet on injectFile failure (claim ⟺ delivered)

> First-hand read of: the S1 PRP (contract — S1 is FULLY LANDED in the working tree), `architecture/
> code_changes_analysis.md` (§'Fix site 2' = this subtask, + safety analysis), `file-injector.ts`
> (injectFile L676-728, State L318-325), and `file-injector.test.mjs` (sanity list L113-128,
> ASSERTED_EXPORTS L138-141, E4 chmod-000 template L600-615, E5 L618-645, E* ids, tail summary L2247+).
> Baseline (POST-S1): **121 passed, 0 failed.**

---

## 1. Starting state = POST-S1 (S1 is fully landed, not just in-flight)

Verified in the working tree: S1's R_OK gate IS applied (`injectMarkdown` Step 3.5 L864
`await fs.access(r.abs, fs.constants.R_OK)`), the Step-3.5 comment is updated (L845-858), and S1's
regression case **E5** is present (L618-645, "markdown import of unreadable file → marker verbatim").
The "Implementing" plan status is stale; the tree is POST-S1. ∴ my S2 starts from a 121-green tree.

S2 (THIS task) = Fix site 2: un-claim `abs` in `injectFile`'s catch. S1 did NOT touch injectFile, so
the edit site is exactly the pre-existing catch. S2's value POST-S1 (per item §1 + arch doc): the
**image-resizeImage-THROWS residual** (a readable image passes R_OK, gets stripped+recursed+claimed,
then resizeImage throws → poisoned claim) + the **TOCTOU window** (readable at Step 3.5, unreadable at
Step 6 readFile) + restoring the clean invariant `claim ⟺ delivered`. S1 fixed the marker-strip; S2
fixes the dedup-set poisoning.

---

## 2. The bug (precise)

`injectFile` (file-injector.ts L676-728):
- L684: `state.injectedSet.add(abs); // CLAIM` — AFTER stat+isFile, BEFORE readFile.
- L689: `const buf = await fs.readFile(abs);` — can throw (EACCES on an unreadable regular file).
- image branch: `const resized = await resizeImage(...)` — can throw (residual S1's R_OK can't predict).
- L725: `state.count++; return true;` — success.
- L726-728 (catch): `} catch { return false; ... }` — returns false but LEAVES abs claimed.

Defect: if readFile/resizeImage throws, injectFile returns `false` but abs STAYS in `injectedSet`.
A later reference to the same abs (`processTokenStream` ~L659 re-check; `injectMarkdown` Step 6
~L874 `if (state.injectedSet.has(r.abs)) continue`) is then silently suppressed — the failed file
"poisons" the path for the whole prompt (never retried, never delivered). The PRD §12 reference
pseudocode comments "Claims abs on success" — the code claims before the read. This subtask closes
that inconsistency: `claim ⟺ delivered`.

---

## 3. The fix (one line + comments)

Add `state.injectedSet.delete(abs);` as the FIRST statement in the catch, before `return false;`:

```ts
// BEFORE (L726-728):
  } catch {
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }

// AFTER:
  } catch {
    state.injectedSet.delete(abs); // failure → UN-CLAIM so the path is not poisoned (claim ⟺ delivered; PRD §12.5)
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
```

Plus two Mode-A doc touchpoints (item §6): the claim inline comment (L684) + the injectFile JSDoc
claim sentence (L666-669), both noting the claim is revoked on failure.

---

## 4. Safety proof (why the delete cannot break cycle-prevention or desync blocks↔claims)

**Only TWO awaits can throw inside injectFile's try** (grep-confirmed): `fs.readFile(abs)` (L689) and
`resizeImage(...)` (image branch). Both precede ANY push:
- readFile throws → NO push happened (it's the first statement of the try). Nothing delivered for abs.
- resizeImage throws → the F5 branch didn't fire (buf.length !== 0 for a real image) AND the image
  branch's `images.push`/`blocks.push` are AFTER the `await resizeImage` → nothing pushed for abs.
- The markdown branch (`await injectMarkdown(...)`) does NOT throw (all its I/O is try/caught; emitText
  is pure). So the catch NEVER fires for a successfully-read markdown file.

∴ when the catch fires, **nothing was pushed for abs** (no block, no image, no count++). Un-claiming
`abs` never desynchronizes the block list from the claim set.

**Cycle-prevention is preserved:** cycle termination keys on SUCCESS-path claims. The self-claim that
breaks a cycle is: `injectFile(abs)` claims abs (L684) → calls `injectMarkdown` → Step 2 re-claims abs
(idempotent) BEFORE scanning → any re-import of abs dedups to verbatim. A file that FAILED to read never
reaches `injectMarkdown`, so no scan, no cycle through a failed node can exist. The `delete` only fires
in the catch (failure), AFTER which abs is abandoned anyway — it cannot reopen a cycle. Self-import edge
(a markdown importing itself) is claimed by Step 2 before scan → deduped regardless; unaffected.

---

## 5. The test (E6 — direct unit test of the EXPORTED injectFile; TDD RED→GREEN)

`injectFile` IS exported (L676) AND in the sanity list (L123) AND in ASSERTED_EXPORTS (L140) → callable
directly as `mod.injectFile(abs, state, ctx)` with a hand-built state. The unexported `State` TYPE is
erased by jiti at runtime, so a **structurally-compatible plain object** works (the .mjs test is untyped).

**E6** (modeled on E4/E5 chmod-000 idiom; id E6 is FREE — only E1-E5 exist):
- root-skip (`process.getuid() === 0` → chmod 000 ineffective as root; same caveat as E4/E5).
- write a UNIQUE regular file `unclaim_secret.txt`; chmod 000.
- build minimal state `{ injectedSet: new Set(), blocks: [], images: [], remaining: null, count: 0,
  paged: 0, bareAt: false }` (matches State L318-325; bareAt is REQUIRED — L325).
- `const result = await mod.injectFile(secret, state, { cwd: TMPDIR, getContextUsage: () => undefined });`
  (ctx is UNUSED on the failure path — stat OK → claim → readFile throws → catch → delete → return false
  before any block/image push; but pass a structurally-valid ctx for cleanliness).
- assert `result === false`; `state.injectedSet.has(secret) === false` (**the BUG** — RED before fix);
  `state.count === 0`; `state.blocks.length === 0` (nothing delivered).
- finally: `fsSync.chmodSync(secret, 0o644)` (restore so TMPDIR cleanup removes it).

**TDD:** write E6 → run RED (path STAYS claimed → `state.injectedSet.has(secret) === false` FAILS) → add
the `delete` → run GREEN. The `result === false` assertion holds BOTH before and after (existing
behavior unchanged — the delete only adds a side effect, not a return-value change).

---

## 6. Placement landmarks (line numbers shift only trivially post-S1; use IDENTIFIERS)

| What | Landmark |
|---|---|
| Source fix | `injectFile`'s catch block — the `} catch { return false; // read/resize error ... }` (L726-728). |
| Claim comment | `state.injectedSet.add(abs); // CLAIM ...` (L684). |
| JSDoc | the `* PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims abs...` block (L666-675). |
| Test case E6 | AFTER E5's closing `});` (L645) and BEFORE the `runCase("G1", ...)` guard block (L647). Keeps E* grouped. |
| NO edits to | sanity list (L113-128), ASSERTED_EXPORTS (L138-141), completeness guard (L143-153), buildFixtures, any existing case. injectMarkdown (S1's site) UNCHANGED. |

---

## 7. Why no module-surface / sanity-list change

`injectFile` is ALREADY exported + asserted + in ASSERTED_EXPORTS (S1/earlier subtasks added it). E6
calls `mod.injectFile` directly — no NEW export is exercised. ∴ the sanity list, ASSERTED_EXPORTS, and
the completeness guard are UNTOUCHED. The fix adds zero new exports / zero new imports (Set.delete is a
built-in). injectMarkdown stays PRIVATE.

---

## 8. Confidence: 9/10

A one-line hygiene fix (`Set.delete` in a catch) with a rigorous safety proof (only readFile/resizeImage
throw; both precede any push; injectMarkdown never throws), a self-contained RED→GREEN unit test of the
exported injectFile, and a 121-green baseline. The -1 reserves for: (a) the root-skip limitation (E6 is
a no-op as root, same as E4/E5 — CI runs non-root); (b) the doc-edit precision (3 small comment
touchpoints — easy to mis-place if the implementer paraphrases the JSDoc). The implementing agent edits
one source function (1 line + 2 comments) + adds one test case, then runs `npm run typecheck` +
`node ./file-injector.test.mjs`.
