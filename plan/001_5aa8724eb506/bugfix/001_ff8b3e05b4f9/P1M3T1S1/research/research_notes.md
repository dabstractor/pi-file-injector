# Research Notes — P1.M3.T1.S1 (Document F3/F5 in README)

**Task**: Document the F3 magic-number sniff and F5 empty-image handling in README.md's
"Behavior by file type" section.

**Method note**: This is documentation-only work. The "research" is reading the exact source the
docs must describe, which I did directly (not via subagents — subagents would re-read the same files
and add no signal). All findings below are byte-level verified against the live source.

---

## 1. The Contract (from item description)

Three edits, ALL confined to README.md § "Behavior by file type":

- **(a)** Image table row: add a note that images are validated by BOTH extension AND actual file
  bytes (magic-number sniff). A file with an image extension but non-image content falls through to
  the text/binary path. (Prevents attaching decoded garbage as an image.)
- **(b)** New row (or note) for empty image files (0-byte `.png`/`.jpg`/etc.): produces the
  `<empty image file — 0 bytes; nothing to attach>` note block, no image attached. (Avoids sending
  an empty ImageContent that providers would reject.)
- **(c)** "Notes on the table" section: add bullet points explaining BOTH F3 and F5 as intentional
  enhancements.

**Scope boundary**: edits touch ONLY README.md § "Behavior by file type" (the table + the "Notes on
the table" list). NOT the overview, NOT "Known limitations", NOT "Syntax", NOT the test count. Those
belong to the sibling P1.M3.T2.S1 ("Update README overview, test count, and known limitations" —
status Planned). Do not collide.

---

## 2. The Actual Behavior (verified against sharp-at-file.ts + harness)

### F3 — `hasValidImageMagic(buf, mime)` (sharp-at-file.ts lines 18-52)
- **Order**: Routes by EXTENSION FIRST (`MIME_BY_EXT[ext]`), THEN validates the actual bytes match
  the declared image type. NOT extension-only (the deviation from PRD §5.2).
- **Sniffer coverage**: PNG (`89 50 4E 47 0D 0A 1A 0A`), JPEG (`FF D8 FF`), GIF (`47 49 46 38` =
  "GIF8"), WEBP (`RIFF`…"WEBP"), BMP (`42 4D` = "BM"). Standard signatures only.
- **Pre-check**: `if (buf.length < 12) return false;` — any file under 12 bytes fails the sniff.
  (Safe: all valid images exceed 12 bytes.)
- **On sniff FAIL** (the `else` branch in `injectFiles`, ~line 159): the file falls through to the
  TEXT/BINARY path. If it has a NUL byte → binary note; otherwise → injected as a text `<file>` block
  with its ACTUAL content. **No image attached.**
- **Harness codification**: `F3a` (fake.png = text body, `.png` ext → `injected===1`, `images.length===0`,
  text block `<file name="<FAKE_PNG>">\nthis is not really a PNG, just text\n\n</file>`); `F3b`
  (unit-level: real PNG passes, text bytes fail, too-short fails, real JPEG header passes).

### F5 — `formatEmptyImageBlock(abs)` (sharp-at-file.ts line 78)
- **Exact output**: `<file name="<abs>"><empty image file — 0 bytes; nothing to attach></file>`
  where `—` is **U+2014 (em dash)** (source: `\u2014` in both the .ts and the harness F5 assertion).
- **Trigger**: `if (mime && buf.length === 0)` in `injectFiles` (~line 149) — ONLY for recognized
  image extensions whose file is exactly 0 bytes. Emits the note block, attaches NOTHING, increments
  count, `continue`s.
- **Rationale**: an empty `ImageContent` would be rejected by providers. Reuses the em-dash
  convention from the binary note for visual consistency.
- **Contrast**: 0-byte TEXT files (e.g. `empty.txt`) still follow the PRD §10 literal path and
  inject as `<file name="…">\n\n</file>` (the text path has no 0-byte special-case). ONLY 0-byte
  IMAGES get the special note block.
- **Harness codification**: `F5` (empty.png = 0 bytes → `injected===1`, `images.length===0`,
  text includes `<file name="<EMPTY_PNG>"><empty image file — 0 bytes; nothing to attach></file>`).

---

## 3. README.md § "Behavior by file type" — exact current state (the edit targets)

### The table (lines 79-85)
```
| File type | What `#@path` does | Output appended to your prompt |
|---|---|---|
| **Text** (`.ts`, `.md`, `.json`, `.log`, …) | Entire file contents injected, no truncation | `<file name="/abs/path">`<br>`<entire contents>`<br>`</file>` |
| **Image** (`.png` `.jpg`/`.jpeg` `.gif` `.webp` `.bmp`) | Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag | `<file name="/abs/path"></file>` *(plus the image is attached)* |
| **Other binary** (a NUL byte is detected, and it's not an image) | NOT decoded — a clear note instead of garbage | `<file name="/abs/path"><binary file — contents not injected; use the read tool if needed></file>` |
| **Missing file** | Token left exactly as you wrote it | *(nothing appended)* |
| **Directory** (`#@src/`) | Token left exactly as you wrote it | *(nothing appended)* |
| **Read / permission error** | Token left exactly as you wrote it | *(nothing appended)* |
```

**The Image row (line 82) — target for edit (a).** Its middle cell today says:
"Attached as an image (auto-resized ≤2000×2000 so providers accept it) AND a reference tag"
→ must gain the magic-number-sniff note (validated by BOTH ext AND bytes; mislabeled falls through).

**Insertion point for edit (b)** — new "Empty image" row goes IMMEDIATELY AFTER the Image row
(line 82), BEFORE the "Other binary" row (line 83). (It's a special-case of image; grouping it
adjacent to Image reads naturally. The contract permits "new row OR note"; a row is clearest in a
table.)

### "Notes on the table" (lines 97-104) — target for edit (c)
Currently 2 bullets:
1. (image row dimension hints + "`—` in the binary note is an em dash (U+2014), not a hyphen")
2. (a broken `#@` never breaks your prompt — each file isolated in try/catch)

→ Append TWO new bullets: one for F3 (magic-number validation), one for F5 (empty-image handling),
each framed as an intentional enhancement.

---

## 4. Style/Voice conventions to match (consistency = quality here)

- **Em dash**: README uses `—` (U+2014) liberally as a clause separator (binary note, prose
  throughout). The new empty-image note block and bullets must use U+2014, NOT a hyphen `-` or en
  dash. (Existing bullet 1 even explicitly calls this out: "The `—` in the binary note is an em dash
  (U+2014), not a hyphen.")
- **Backtick-fenced tokens**: file extensions (`.png`), output strings (`<file …>`), and code-ish
  terms are wrapped in backticks. New content follows this.
- **Row "Output" column format**: literal output in backticks, with `<br>` for multi-line blocks;
  parenthetical asides in italics `*(...)*`.
- **Tone**: factual, brief, no hedging. New bullets should mirror the matter-of-fact register of the
  existing two bullets (and the "Key design choices" rationale voice).
- **Cross-references**: the existing README links to
  `plan/001_5aa8724eb506/P1M2T4S1/validation_report.md` for the F1 finding. The new F3/F5 bullets
  could optionally cite the same validation report / the harness cases (F3a/F5) for traceability —
  recommended, matches existing style.

---

## 5. Parallel / sibling coordination (NO collision)

- **P1.M2.T2.S1** (Implementing, in parallel): edits `sharp-at-file.test.mjs` ONLY (adds the `U1`
  Unicode regression case). Disjoint file → zero collision with README work.
- **P1.M3.T2.S1** (Planned, future): "Update README overview, test count, and known limitations."
  Touches README § overview / Testing / Known limitations — NOT § "Behavior by file type". This task
  must stay OUT of those sections to avoid collision. Confirmed: the contract's three edits are all
  within "Behavior by file type".
- **No `.ts` edits** here (F3/F5 code is already live and harness-verified). Pure docs.

---

## 6. Validation approach for documentation work

No compiler/linter applies to prose. Validation is:
1. **Byte-exact string check**: the empty-image note block string in the README must byte-match the
   code (`<empty image file — 0 bytes; nothing to attach>` with U+2014). Grep-verify.
2. **Structural check**: table still parses (correct pipe count per row); "Notes on the table" now
   has 4 bullets (was 2).
3. **Scope check**: `git diff README.md` shows changes ONLY in the "Behavior by file type" region
   (lines ~77-104); overview / Known limitations / Syntax untouched.
4. **No harness regression**: `node ./sharp-at-file.test.mjs` still passes (this task doesn't touch
   `.ts` or `.test.mjs`, but confirm nothing was accidentally broken — defensive gate).

---

## 7. Risk assessment

LOW risk. Single-file prose edits with byte-exact targets pre-verified against the source. The only
real failure modes are: (1) wrong dash glyph (hyphen vs U+2014) in the empty-image note block;
(2) mangling the markdown table (pipe count / row insertion breaking the table render);
(3) scope creep into sections owned by P1.M3.T2.S1. All three are caught by the Level-1 validation
greps in the PRP.
