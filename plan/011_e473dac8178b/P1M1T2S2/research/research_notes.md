# Research Notes — P1.M1.T2.S2 (LR-3: malformed-range tokens warn instead of vanishing)

All facts verified first-hand at HEAD `d954487` (T1.S1/S2/S3 all committed). Working tree: T2.S1 (LR-2) in
flight (uncommitted `M file-injector.ts`) — DISJOINT from T2.S2's scope (T2.S1 = injectFile branches; T2.S2 =
splitLineRange/scanTokens/processTokenStream). Baseline: **176 runCases**; T2.S1 adds LINE-9 → 177; T2.S2
modifies LINE-4 in place and adds LINE-10 → 178 (177 if T2.S1 hasn't landed when T2.S2's gate runs).

## 1. The verified current code (the three edit sites)

### splitLineRange (L172-180, EXPORTED)
```ts
export function splitLineRange(token: string): { path: string; startLine?: number; endLine?: number } {
  const m = /:(\d+)(?:-(\d+))?$/.exec(token);
  if (!m) return { path: token };                                        // no suffix — BYTE-IDENTICAL, UNTOUCHED
  const start = Number(m[1]);
  const end = m[2] !== undefined ? Number(m[2]) : start;
  if (!Number.isFinite(start) || start < 1 || !Number.isFinite(end) || end < start) return { path: token };  // ← L177: invalid → raw fallback (indistinguishable from no-suffix — THE BUG)
  const p = token.slice(0, m.index!);
  return p ? { path: p, startLine: start, endLine: end } : { path: token };
}
```
**Edit:** the invalid branch returns `{ path: token, invalid: true }`. No-suffix and valid shapes UNCHANGED
(byte-identical — LINE-4's three valid asserts stay; its two invalid asserts UPDATE).

### scanTokens (L1143-1191, EXPORTED; unit-tested by LINE-5)
Return type: `Promise<{ path: string; startLine?: number; endLine?: number }[]>`. The relevant block (L1174-1183):
```ts
    let abs = await resolveImportPath(token, baseDir, opts.tryMdExt);   // exact first (literal 'a.ts:10' WINS)
    let startLine: number | undefined;
    let endLine: number | undefined;
    if (!abs) {
      const parsed = splitLineRange(token);
      if (parsed.startLine !== undefined && parsed.path !== token) {
        if (!opts.allowAbsTilde && isAbsoluteOrTilde(parsed.path)) continue;
        abs = await resolveImportPath(parsed.path, baseDir, opts.tryMdExt);
        if (abs) { startLine = parsed.startLine; endLine = parsed.endLine; }
      }
    }
    if (!abs) continue; // nothing resolved → leave verbatim (missing/dir/non-regular)  ← silent drop of a.ts:0
```
**Edit:** in the `if (!abs)` block, add an `else if` on the parsed result: when `parsed.invalid` is true (regex
matched, validation failed, exact resolution of the full token already failed), surface a record
`{ path: token, invalidRange: true }` and `continue` (no dedup bookkeeping needed — it never injects). NO ctx
parameter exists on scanTokens (verified: signature L1143-1148 has text/baseDir/opts/state ONLY) — the notify
CANNOT fire here; signal out via the record and fire from processTokenStream.

### processTokenStream (L1204-1222, private; has `ctx`)
```ts
  const recs = await scanTokens(text, baseDir, opts, state);
  for (const rec of recs) {
    if (state.injectedSet.has(claimKey(rec.path, rec.startLine, rec.endLine))) continue;
    await injectFile(rec.path, state, ctx, rec.startLine, rec.endLine);
  }
```
**Edit:** first check in the loop: `if (rec.invalidRange) { if (ctx.hasUI) ctx.ui?.notify(\`#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)\`, "warning"); continue; }`
Mirrors the SPA-fallback pattern at L956 (`if (ctx.hasUI) ctx.ui?.notify(...)` — the ONLY notify-with-optional-
ui call in the file; type "warning" here, not "info").

## 2. THE CRITICAL RECONCILIATION (item wording vs LINE-10)

The item §3b says surface tokens "that fail BOTH exact and stripped resolution". But LINE-10 (§9) uses
`#@a.ts:0` where **a.ts EXISTS** in TMPDIR (a fixture since the beginning) — the STRIPPED path resolves! So a
literal "both must fail" rule would NOT notify for LINE-10's exact scenario, contradicting the required test.

**Resolution (authoritative sources: PRD LR-3 + §2.2 + LINE-10):** the notify fires when the cleaned token's
trailing suffix MATCHED the range regex but FAILED validation (`:0`, `:5-3`) AND the **literal full-token**
resolution failed (exact-path-wins: a file literally named `a.ts:0` resolving whole → NO notify). The PRD's
wording: "which resolves to no file" = the token as typed resolves to nothing. No stripped retry is attempted
for invalid ranges (that is current behavior and stays). This satisfies all four item §3c MUST-NOT-fire cases:
no range-looking suffix (invalid flag unset), valid ranges that resolve (normal path), invalid+literal-exists
(exact wins → abs set → no record), and markdown-import scans calling scanTokens directly (records consumed
by injectMarkdown — see §4 below).

## 3. The dedup/localSeen interplay (why the surfaced record skips bookkeeping)

The invalid record carries `path: token` (the CLEANED raw token, e.g. `a.ts:0`), which by construction failed
`resolveImportPath` — it can never be a valid claim key collision. processTokenStream `continue`s on it BEFORE
the claimKey check, so no key is consulted or added. If the same invalid token appears twice in one prompt,
TWO notifies fire (acceptable; the item says "no duplicate notifies per token" only IF markdown threading is
added — for top-level, per-token occurrence notifies are fine and simple; if desired, localSeen could hold the
token, but the item doesn't require it — keep it simple, note the choice).

## 4. injectMarkdown calls scanTokens directly (optional threading — NOT required)

injectMarkdown (L~1300) calls `scanTokens(content, dir, {...}, state)` and iterates records calling
`injectFile(r.path,...)`. An invalidRange record's path (e.g. `a.ts:0`) fails stat inside injectFile →
returns false → harmless no-op, NO notify (injectMarkdown has ctx but threading is OPTIONAL per item §3 note;
"top-level prompt path is REQUIRED and is what LINE-10 tests"). Keep injectMarkdown UNTOUCHED — but note
injectFile will be called with the unresolvable literal path and safely return false (stat miss). No change
needed there.

## 5. LINE-4's two invalid asserts (must UPDATE, in place)

Current (test L3023-3024):
```js
assert(JSON.stringify(mod.splitLineRange("a.ts:0")) === JSON.stringify({ path: "a.ts:0" }), ":0 invalid → keep raw");
assert(JSON.stringify(mod.splitLineRange("a.ts:5-3")) === JSON.stringify({ path: "a.ts:5-3" }), "end<start invalid → keep raw");
```
New expectations: `{ path: "a.ts:0", invalid: true }` and `{ path: "a.ts:5-3", invalid: true }`. The three
valid/no-suffix asserts stay UNCHANGED (shapes byte-identical).

## 6. LINE-5 (scanTokens shape contract — must stay green)

LINE-5 (L3031) calls scanTokens on `#@a.ts:2-4` and asserts `arr.length===1`, path/startLine/endLine. The
record-type EXTENSION (adding optional `invalidRange?`) is additive — valid records are unchanged. LINE-5
green. Note the State literal LINE-5 passes (no `bareAt` field needed — it's optional).

## 7. LINE-10 (the new test — spy ctx from url-injection.test.mjs L700-705)

The spy pattern (verified in url-injection.test.mjs):
```js
function ctxWithNotifySpy() {
  const notes = [];
  return { ctx: { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } }, notes };
}
```
file-injector.test.mjs does NOT have this helper — define the spy inline in LINE-10 (or add the helper near
FIX). injectFiles signature (verified L1487-1491): `injectFiles(text, imagesIn, ctx, ...)` — ctx is the **3rd**
param. LINE-10 body:
```js
await runCase("LINE-10", "LR-3: #@a.ts:0 → injected:0, prompt verbatim, warning notify fired", async () => {
  const notes = [];
  const ctx = { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes.push({ m, t }) } };
  const r = await mod.injectFiles("See #@a.ts:0 here", [], ctx);
  assert(r.injected === 0, `injected:0, got ${r.injected}`);
  assert(r.text === "See #@a.ts:0 here", `prompt verbatim, got ${JSON.stringify(r.text)}`);
  assert(notes.length === 1, `exactly one notify, got ${notes.length}`);
  assert(notes[0].t === "warning", `type 'warning', got ${notes[0]?.t}`);
  assert(notes[0].m === "#@a.ts:0 — not injected (range must be :N or :N-M, M ≥ N ≥ 1)",
    `message shows token as typed, got ${JSON.stringify(notes[0]?.m)}`);
  // negative: no-suffix missing file must NOT notify
  const notes2 = [];
  const r2 = await mod.injectFiles("See #@nope.ts", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes2.push({ m, t }) } });
  assert(r2.injected === 0 && notes2.length === 0, `missing file w/o range: NO notify (hasUI-irrelevant), got ${notes2.length}`);
  // negative: valid range that resolves must NOT notify
  const notes3 = [];
  const r3 = await mod.injectFiles("See #@a.ts:2", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes3.push({ m, t }) } });
  assert(r3.injected === 1 && notes3.length === 0, `valid range resolves: NO warning notify, notes=${notes3.length}`);
  // negative (exact-path-wins): literal file 'a.ts:0' exists → resolves whole → NO notify
  fsSync.writeFileSync(path.join(TMPDIR, "literal0.ts:0"), "literal colon-zero file\n");
  try {
    const notes4 = [];
    const r4 = await mod.injectFiles("See #@literal0.ts:0", [], { cwd: TMPDIR, hasUI: true, ui: { notify: (m, t) => notes4.push({ m, t }) } });
    assert(r4.injected === 1 && notes4.length === 0, `literal '…:0' file exists → exact wins, NO notify`);
    assert(hasBlock(r4, "literal colon-zero file"), "literal file delivered whole");
  } finally { fsSync.rmSync(path.join(TMPDIR, "literal0.ts:0"), { force: true }); }
});
```
Place after LINE-9's block (T2.S1's, after LINE-8-MD ~L3090) or after LINE-12 (~L3100) — anywhere in the LINE
block; the natural spot is after LINE-9/LINE-12 at the end of the LINE section.

## 8. Em-dash + message string (exact)

The notify message uses an EM DASH (—, U+2014), matching the binary-note convention:
`` `#@${rec.path} — not injected (range must be :N or :N-M, M ≥ N ≥ 1)` ``
(rec.path is the cleaned token `a.ts:0`; the `#@` prefix is prepended so the message shows the token as typed,
per item §3c.) LINE-10 asserts this string EXACTLY.

## 9. Gates

- `npm run typecheck` → 0 errors (additive optional fields; `invalid?: true` on the return type;
  `invalidRange?: true` on the record type).
- `node ./file-injector.test.mjs` → **178 passed** (177 with T2.S1's LINE-9 + LINE-10; LINE-4 modified in
  place, count unchanged). If T2.S1 hasn't landed yet: 177 (176 + LINE-10).
- `npm test` → all 4 files green (url-injection untouched; the spy helper there is only a PATTERN reference).
- `git diff --stat` → file-injector.ts + file-injector.test.mjs ONLY (injectFile branches are T2.S1's — T2.S2
  must not touch them; T2.S2's hunks are splitLineRange/scanTokens/processTokenStream only).