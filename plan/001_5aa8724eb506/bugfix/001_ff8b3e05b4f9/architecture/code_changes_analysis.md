# Code Changes Analysis — Exact Modification Points

All line numbers refer to `/home/dustin/projects/pi-file-injector/file-injector.ts` (249 lines).

---

## Issue 1 + Issue 2 + Issue 6: Remove Sentinel, Add Per-Token Dedup

### Step 1: Add per-token dedup in `injectFiles` (line ~98, inside the for-loop)

**Location**: `injectFiles` function, inside `for (const m of text.matchAll(FILE_INJECT_RE))` loop,
after resolving `abs` and BEFORE `fs.stat(abs)`.

**Current code** (lines ~98-103):
```ts
    const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue; // missing file => leave token verbatim (PRD §5.4)
    }
```

**Insert after `abs` resolution, before `stat`**:
```ts
    const abs = expandTildeAndResolve(token, ctx.cwd);

    // PER-TOKEN DEDUP — if a <file> block for this exact absolute path already exists in the text
    // (injected by a prior copy of this extension in the handler chain), skip re-injecting. This is
    // cooperation-independent: works even when the prior copy was a non-sentinel version. Fixes the
    // duplicate-injection bug when global + project-local (or two -e) copies co-load.
    if (text.includes('<file name="' + abs + '">')) continue;

    let st;
    ...
```

### Step 2: Remove sentinel constants (lines ~21-27)

**Remove these lines**:
```ts
/** F1 — hidden sentinel stamped on the injected section. ... */
const INJECT_SENTINEL = "<!--#@file-injected-->";
const SENTINEL_RE = /<!--#@file-injected-->/;
```

### Step 3: Remove sentinel guard from handler (line ~147 in the factory)

**Current code** (inside the `input` handler):
```ts
    // F1 — if THIS message was already transformed by another copy ...
    if (SENTINEL_RE.test(event.text)) return { action: "continue" };
```
**Action**: Delete entirely. Per-token dedup in `injectFiles` makes this redundant.

### Step 4: Remove sentinel from assembly (line ~139)

**Current code**:
```ts
  const finalText = `${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}`;
```
**Replace with** (restores exact PRD §6.2 format):
```ts
  const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`;
```

**Also remove the F1 comment block** above the `const finalText` line.

---

## Issue 5: Unicode Regex Boundary

**Location**: Line ~6, module-level constant.

**Current**:
```ts
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
```

**Replace with**:
```ts
const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
```

**Note**: The `u` flag enables Unicode property escapes. `(?<![\p{L}\p{N}_])` is a negative lookbehind
that blocks `#@` when preceded by a Unicode letter, number, or underscore — the correct Unicode-aware
word boundary. The `^` alternation handles start-of-string (where the lookbehind has nothing to check).

---

## Issue 3: F3 Magic-Number Sniff — Documentation Only

**Location**: `hasValidImageMagic` function (lines ~29-52) and the `isRealImage` check in `injectFiles`.

**No code change needed.** The behavior is correct (avoids attaching decoded garbage as images).
The fix is documenting it in README's behavior-by-file-type table and known-limitations section.

---

## Issue 4: F5 Empty-Image — Documentation Only

**Location**: `formatEmptyImageBlock` function (line ~78) and the 0-byte image check in `injectFiles`.

**No code change needed.** The behavior is correct (avoids attaching empty ImageContent rejected by
providers). The fix is documenting it in README.

---

## Test Harness Changes (`file-injector.test.mjs`)

### Tests to UPDATE (currently codify old sentinel behavior):

**F1 test** (current: "F1 — no re-injection when a sentinel is already present (second copy)"):
- Currently feeds already-injected text through the handler and expects `continue` due to sentinel.
- With sentinel removed, the handler WILL run `injectFiles`, but per-token dedup will skip all already-
  injected paths → `injected === 0` → handler returns `continue`.
- **Update**: Rename to "per-token dedup prevents re-injection". Feed already-injected text through
  `injectFiles` directly and assert `injected === 0`. Also test via the handler to verify `continue`.

### Tests to ADD:

1. **Co-load non-sentinel duplicate test**:
   - Simulate a prior handler that injects WITHOUT a sentinel (simulating the stale 182-line copy).
   - Feed the result through the FIXED `injectFiles`.
   - Assert `injected === 0` (no duplicate blocks).

2. **Sentinel-in-prompt test (Issue 2)**:
   - A prompt containing `<!--#@file-injected-->` AND a valid `#@file` token.
   - Assert the file IS injected (sentinel no longer gates injection).

3. **Unicode boundary test (Issue 5)**:
   - `café#@secret.txt` → NOT injected (Unicode letter before `#@`).
   - `日本語#@file` → NOT injected.
   - `Review #@a.ts` → still injected (correct behavior preserved).

### Harness impact:
- The total case count will increase from 28 to ~31-32.
- The `README.md` mentions "28 passed, 0 failed" → needs updating.

---

## README Changes

### Behavior-by-file-type table:
- **Image row**: Add note about magic-number validation (F3): "Image files are validated by both
  extension AND actual file bytes (magic-number sniff). A file with an image extension but non-image
  content (e.g. text named `.png`) falls through to the text/binary path instead of attaching
  decoded garbage."
- **Empty image row**: Add a new row or note: "A 0-byte image file produces a note block
  `<empty image file — 0 bytes; nothing to attach>` instead of attempting to attach an empty image
  (which providers would reject)."

### Known limitations:
- Remove any reference to the sentinel mechanism (if present).
- Add: "`#@` correctly does not trigger mid-word in any language, including after non-ASCII letters
  (é, ö, ñ, CJK characters) — the trigger uses Unicode-aware word boundaries."

### Testing section:
- Update pass count from "28 passed, 0 failed" to the new count.
