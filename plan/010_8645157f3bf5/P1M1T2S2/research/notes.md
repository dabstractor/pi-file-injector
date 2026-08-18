# Research Notes — P1.M1.T2.S2

**Item**: `FileDetail.kind 'url' union member + readLine url renderer branch`
**Scope**: 3 edits in ONE file (`file-injector.ts`). No new files. No new exports.

## Ground-truth verification (read against current `file-injector.ts`)

### 1. Union member `url` — ALREADY PRESENT (parallel coord)
Line 471 (current):
```ts
kind: "text" | "image" | "binary" | "paged" | "url"; // +"url": added by T2.S1 (producer); the readLine renderer branch lands in T2.S2. url details render via readLine's default branch until then (the kind union member is safe — no exhaustive switch on .kind).
```
**T2.S1 (running in parallel) has ALREADY landed the union member** — confirmed by T2.S1's PRP parallel-safety note ("S1 produces it first; S2 = readLine branch only"). Therefore **T2.S2 MUST be idempotent on the union member**: detect `| "url"` present → skip. If somehow absent → add it. The implementer's edit `oldText` for the union line must match the CURRENT line (with the T2.S1 comment), NOT the item-description's stale `kind: 'text' | 'image' | 'binary' | 'paged';`.

### 2. readLine — current body (the unique T2.S2 work)
```ts
function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const pathPart = theme.fg("accent", tildify(d.path));   // ← tildify applied ONCE here, for ALL branches
  if (d.kind === "binary") {
    return `${title} ${pathPart} ${theme.fg("dim", "(binary — not injected)")}`;
  }
  if (d.kind === "image") {
    return `${title} ${pathPart}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  }
  if (d.kind === "paged") {
    return `${title} ${pathPart}${theme.fg("warning", d.range ?? "")}`;
  }
  return `${title} ${pathPart}`; // whole text (no suffix)
}
```
**GOTCHA #1 (load-bearing)**: `pathPart` is built with `tildify(d.path)`. The url branch MUST NOT reuse `pathPart` — it must call `theme.fg("accent", d.path)` RAW (URLs are not home-relative; tildify is semantically wrong even though it's a runtime no-op for URLs, since a URL never `startsWith(home + "/")`). Item example: `if (d.kind === "url") { return \`${title} ${theme.fg('accent', d.path)}\`; }` — note `theme.fg('accent', d.path)`, NOT `pathPart`.
**Placement**: insert the `url` branch BETWEEN the `paged` branch and the final `return ... // whole text (no suffix)`.

### 3. tildify (helper, line ~845)
```ts
function tildify(abs: string): string {
  const home = os.homedir();
  return home && abs.startsWith(home + "/") ? "~" + abs.slice(home.length) : abs;
}
```
For a URL like `https://example.com/x`, `abs.startsWith(home + "/")` is always false → no-op. Confirms tildify is a harmless-but-semantically-wrong no-op for URLs; the url branch bypasses it by using `d.path` raw.

### 4. Expanded-view display — VERIFIED NON-ISSUE (no renderer change needed)
- `computeDetailOffsets` (line 387, P1.M2.T1.S1-owned) sets `contentStart/contentLen` ONLY for `text`/`paged`:
  `if (d.kind !== "text" && d.kind !== "paged") continue;` (line 424). So **url details get NO offsets**.
- `injectUrl` (T2.S1) pushes `{ path: url, kind: "url", chars: body.length }` — NO `body` field, NO offsets.
- `renderInjectedMessage` body-recovery 3-tier (line ~983):
  ```ts
  const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
    ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)   // tier 1 (offsets) — MISS for url
    : (typeof d.body === "string" ? d.body : bodies[i]);                     // tier 2 (body) — MISS; tier 3 (regex bodies[i]) — HIT
  if (body !== undefined && d.kind !== "image") { … display … }              // url !== image → DISPLAYS
  ```
  Tier 3 (`bodies[i]`) = the pre-computed `FILE_BLOCK_RE` regex match of `<file name="URL">…md…</file>` blocks from `message.content`, indexed in parallel with `details`. Since injectUrl emits a `<file name="URL">\n…\n</file>` block (formatUrlBlock, T2.S1), the regex matches it and `bodies[i]` recovers the markdown. **URL bodies DO display in expanded view via tier 3.** No renderer change. ✓
- **Known accepted limitation (out of T2.S2 scope)**: tier-3 regex is BUG-1 vulnerable if a url body contains a literal `</file>` (truncates early). For HTML→markdown extraction this is unlikely; if it matters, it's P1.M2.T1.S1 territory (adding `url` to `computeDetailOffsets`' guard so url details get tier-1 offsets). NOT a T2.S2 concern — the item explicitly says "No changes to renderInjectedMessage."

### 5. Module-surface / test impact
- `readLine` is PRIVATE (not exported). Adding a branch does NOT change the runtime export surface.
- `file-injector.test.mjs` enforces an `ASSERTED_EXPORTS` allowlist (L136–156 per T2.S1 PRP) — unchanged.
- Gate: `npm run typecheck` (union present + branch typechecks) + `npm test` (no regression, allowlist green).
- Behavioral url-renderer tests (e.g. construct a url detail, assert `read <url>` line) belong to **P1.M2.T1**. T2.S2 ships code + typecheck + regression only.

## The 3 edits (final form)

**Edit A (idempotent union — likely a no-op since T2.S1 landed it):**
If line 471 already contains `| "url"` → SKIP. Else: `kind: "text" | "image" | "binary" | "paged";` → add `| "url"`.

**Edit B (readLine url branch):** between paged branch and final return:
```ts
  if (d.kind === "url") {
    return `${title} ${theme.fg("accent", d.path)}`; // PRD §6 — raw URL, NOT tildified; no range/hint (url branch)
  }
```

**Edit C (JSDoc):** 
- Interface JSDoc: add url to the kind enumeration prose.
- Inline comment on union line: reconcile the T2.S1 handoff note (the branch now EXISTS, no longer "lands in T2.S2").