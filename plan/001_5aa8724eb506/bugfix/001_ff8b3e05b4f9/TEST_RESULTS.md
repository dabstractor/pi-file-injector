# Bug Fix Requirements

## Overview

Creative end-to-end QA of the `#@file` Whole-File Injection extension (`file-injector.ts`,
249-line repo version) against the PRD. Testing combined the existing 28-case model-free harness
(which **passes 28/28**), faithful jiti-based simulation of Pi's input-event runner chaining, and —
critically — **live end-to-end runs of real Pi `v0.80.7`** with a real model (the two cases the
harness marks "INTEGRATION / run manually" and never actually executes: PRD §11 #12 and #13).

**Overall quality:** The single-copy logic is excellent — token parsing, format parity, image/binary
routing, guards, and error containment all behave per spec. **However, two real, user-facing bugs
were found on the primary documented usage path** (`pi -e ./file-injector.ts …`), both stemming from
the `F1` anti-duplication sentinel added beyond the PRD. They were missed by the standard validation
because (a) the harness's own `F1` test only re-feeds text through the *same* sentinel-stamping
handler, and (b) the live `-p`/`-e` integration cases were never run.

The headline issue: in this environment (and in any environment where the extension is also installed
globally — which the README itself recommends as the "always on" install), **every `#@file` is
injected TWICE**, doubling token cost and feeding the model duplicate content, silently.

---

## Critical Issues (Must Fix)

None. Core injection fundamentally works (files are read, formatted, and delivered to the model).

---

## Major Issues (Should Fix)

### Issue 1: Duplicate file injection when a non-sentinel copy co-loads (default `pi -e` path doubles every file)

**Severity**: Major (borderline Critical — affects **every** invocation on the primary documented path)

**PRD Reference**: PRD §11 (acceptance command `pi -e ./file-injector.ts …`), PRD §6.2 / §9 ("append
all blocks below the original prompt" — singular injection), and the `F1` sentinel's own code comment
which claims to handle "loaded globally AND project-locally, or two -e copies" to "avoid duplicate
blocks."

**Expected Behavior**: A `#@file` token injects the file **exactly once**, regardless of how many
copies of the extension are loaded. The `F1` sentinel's documented contract is that a second copy
"can detect we already injected and skip, avoiding duplicate blocks."

**Actual Behavior**: When a **non-sentinel** copy of the extension is also loaded (e.g. an older
version, or any build that does not stamp `<!--#@file-injected-->`), the new (sentinel) copy's guard
`if (SENTINEL_RE.test(event.text)) return { action: "continue" }` does **not** fire (the other copy
never stamped the sentinel), so `injectFiles` runs again, re-finds the still-present `#@path` token in
the original prompt text, and injects the same file a **second** time. Every file in the prompt is
duplicated.

This is **live in the current environment**: a stale 182-line global copy
(`~/.pi/agent/extensions/file-injector.ts`, no sentinel / no F3 / no F5) co-exists with the 249-line
repo copy. Pi's loader dedups extensions by **absolute path**
(`dist/core/extensions/loader.js:507-513`, `seen = new Set()` on `path.resolve(p)`), so the two
distinct paths **both** load (global first via discovery, then `-e`). Running the exact command the
PRD §11 and README prescribe for testing double-injects.

**Steps to Reproduce** (real Pi, confirmed):

```bash
# fixture with a unique canary
mkdir -p /tmp/saf-e2e && printf 'The canary is MAROON-PELICAN-4297 once.\n' > /tmp/saf-e2e/secret.txt

# DEFAULT documented test path (PRD §11 / README) — loads BOTH global + repo copies:
pi --model "deepseek/deepseek-chat" --no-tools -e ./file-injector.ts -p \
  'Review #@/tmp/saf-e2e/secret.txt — how many <file> blocks and how many MAROON-PELICAN-4297? Reply: BLOCKS=<n> CANARY=<n>'
# OBSERVED:  BLOCKS=2  CANARY=2   ← injected TWICE
```

Control tests prove each copy alone is correct:
```bash
pi … -ne -e ./file-injector.ts -p '… #@/tmp/saf-e2e/secret.txt …'   # repo copy ONLY → BLOCKS=1 CANARY=1  ✓
pi …                  -p '… #@/tmp/saf-e2e/secret.txt …'            # global copy ONLY  → BLOCKS=1 CANARY=1  ✓
```

A jiti simulation that chains both real handlers in Pi's verified load order (global → repo,
mirroring `dist/core/extensions/runner.js:882-920`) reproduces the same: 2 `<file>` blocks for one
`#@a.ts`. Scoping confirms the `F1` sentinel **does** work when both copies are sentinel-aware
(two identical repo copies → 1 block), so the bug is specifically: **the dedup is cooperation-based
and fails against any non-participating co-loaded copy.**

**Impact**: Doubles token usage and confuses the model with duplicate content on the primary
documented path. Also breaks PRD §11 acceptance #12 (`pi -p "Review #@a.ts"`) and #13 (format-parity
comparison) which were never live-executed by the harness.

**Suggested Fix**: Make re-injection detection **independent of the other copy's cooperation**.
Robust options:
  1. **Per-token dedup**: before injecting a resolved `#@path`, skip it if a `<file name="<abs>">`
     block for that exact absolute path already exists in the (already-transformed) text. This catches
     injection by *any* prior copy regardless of sentinel.
  2. Or detect the injected section structurally (a `\n\n---\n\n` separator immediately followed by
     `<file name=` blocks) rather than relying on a secret sentinel string.
  3. Additionally (operational hygiene): document that only one copy should be installed, and/or have
     the extension refuse to load if an identical-name extension is already registered — but the
     *code* fix (1 or 2) is required because users will inevitably end up with stale copies.

---

### Issue 2: Sentinel string in the user prompt silently disables ALL `#@` injection (false negative)

**Severity**: Major

**PRD Reference**: PRD §1 / §2 Goal 1 ("unconditionally injects the entire contents"), PRD §12.5 ("A
prompt must never be lost"). Introduced by the `F1` sentinel guard:
`if (SENTINEL_RE.test(event.text)) return { action: "continue" }`.

**Expected Behavior**: A prompt that contains a valid `#@path` token always injects that file. The
sentinel guard should only suppress *re-processing of this extension's own prior output*, never a
genuine user prompt.

**Actual Behavior**: Because the guard tests the sentinel against the **raw user prompt**
(`event.text`) **before** any injection, any prompt that happens to contain the literal string
`<!--#@file-injected-->` causes the handler to `continue` immediately — **all** `#@` tokens in that
prompt are silently dropped, with no error and no notify. This is a realistic workflow: a user
copy/pastes their previous message (which, after injection, contained the sentinel) to continue a
conversation and adds a new `#@file`; or pastes the extension's output while debugging; or includes
HTML containing that comment. Result: the new file is **not** injected at all.

**Steps to Reproduce** (real Pi, repo copy only via `-ne -e`, confirmed):

```bash
pi --model "deepseek/deepseek-chat" --no-tools -ne -e ./file-injector.ts -p \
  'Here is an HTML comment for context: <!--#@file-injected-->
   Also please review: #@/tmp/saf-e2e/secret.txt
   How many times does MAROON-PELICAN-4297 appear? Reply only: CANARY=<number>'
# OBSERVED:  CANARY=0   ← the valid #@secret.txt was silently NOT injected
# Expected:  CANARY=1
```

**Impact**: Silent, total failure of the core feature in a plausible copy/paste workflow — the
opposite of the PRD's "unconditional" / "a prompt must never be lost" guarantees.

**Suggested Fix**: Do not gate on a bare substring of the raw user prompt. Either (a) remove the
sentinel guard entirely in favor of the per-token dedup from Issue 1 (which makes it redundant), or
(b) only treat the sentinel as a re-injection marker when it appears in the **appended section**
(after a `\n\n---\n\n`), never when it could be part of the user's own prose.

---

## Minor Issues (Nice to Fix)

### Issue 3: `F3` magic-number sniff deviates from PRD §5.2 (route-by-extension-only)

**Severity**: Minor (deliberate enhancement; flag for spec reconciliation)

**PRD Reference**: PRD §5.2 ("Given an existing regular file … classify by extension … and branch")
and §3.3 table ("`detectSupportedImageMimeTypeFromFile(path)` … → small inline MIME table"). The PRD
routes images **by extension only**.

**Expected Behavior (per PRD)**: A file named `foo.png` is treated as an image purely by extension,
regardless of its bytes.

**Actual Behavior**: The repo version added `hasValidImageMagic(buf, mime)`. A `.png`/`.jpg`/etc.
whose bytes fail the magic-number sniff (e.g. a text file mislabeled `.png`) falls through to the
**text/binary** path and is injected as text (or a binary note), with **no image attached**. This is
arguably *better* than the PRD (avoids attaching decoded garbage labeled as an image), but it is a
behavioral deviation from the literal spec and is not mentioned in the PRD or README. If a provider
or future Pi build ever produces a valid-but-unusual image header the sniffer doesn't recognize, a
legitimate image would be silently downgraded to text. (Current sniffer covers standard PNG/JPEG/GIF/
WEBP/BMP signatures and is safe for all normal images; the `< 12` byte pre-check is also safe since
valid images exceed 12 bytes.)

**Steps to Reproduce**: `printf 'just text\n' > fake.png` then `#@fake.png` → injected as a text
`<file>` block, no `ImageContent` attached (harness case `F3a` codifies this as the expected
behavior, but it contradicts PRD §5.2).

**Suggested Fix**: Reconcile spec vs. implementation — either update the PRD/README to document the
magic-number validation as an intentional improvement over `processFileArguments`, or make the sniff
lenient (treat magic-mismatch as a *warning*, still attaching the image per the extension contract).
Recommend the former (document it).

### Issue 4: `F5` empty-image handling deviates from PRD §10 ("empty file → `<file>\n\n</file>`")

**Severity**: Minor (deliberate enhancement; flag for spec reconciliation)

**PRD Reference**: PRD §10 edge-case table: "Empty file (0 bytes) → Injected as empty
`<file name="…">\n\n</file>` — correct and cheap." This row is not qualified by file type, so it
applies to a 0-byte image too.

**Expected Behavior (per PRD)**: A 0-byte `empty.png` yields `<file name="/abs/empty.png">\n\n</file>`.

**Actual Behavior**: The repo version special-cases 0-byte images via `formatEmptyImageBlock` → emits
`<file name="/abs/empty.png"><empty image file — 0 bytes; nothing to attach></file>` and attaches no
image. (Rationale: an empty `ImageContent` would be rejected by providers — a reasonable concern the
PRD's literal behavior would in fact trigger.) This is a divergence from the PRD §10 literal output.
(0-byte **text** files still follow the PRD and inject as `<file>\n\n</file>`.)

**Steps to Reproduce**: `: > empty.png` then `#@empty.png` → produces the empty-image note block, not
the PRD's `<file>\n\n</file>` (harness case `F5` codifies this as expected).

**Suggested Fix**: Document the intentional divergence in the PRD/README (the PRD's literal behavior
would attach an empty, provider-rejected image), or align the output. Recommend documenting it.

### Issue 5: `#@` triggers after non-ASCII "word" characters (Unicode `\W` lookbehind quirk)

**Severity**: Minor

**PRD Reference**: PRD §4.1 ("The trigger must appear at start-of-string or after a non-word
character (so `foo#@bar` mid-word does *not* trigger)") and §4.2 regex
`/(^|(?<=\W))#@(\S+)/g`. The *intent* is "not mid-word," but `\W` in a non-`u` JS regex is
`[^A-Za-z0-9_]`, so non-ASCII letters (é, ö, ñ, CJK, etc.) count as **non-word** and satisfy the
lookbehind.

**Expected Behavior (intent)**: `#@` should not trigger in the middle of a word in any language.

**Actual Behavior**: `café#@secret.txt` (or `日本語#@file`) **does** trigger injection, because the
character before `#@` is a non-ASCII letter classified as `\W`. Confirmed live:

```bash
pi … -ne -e ./file-injector.ts -p 'Review café#@/tmp/saf-e2e/secret.txt … CANARY=<n>'
# OBSERVED:  CANARY=1   ← injected, despite #@ being "mid-word" in café#@…
```

This follows the literal PRD regex, so it is arguably "per spec," but it contradicts the stated
intent and the §3.2 collision rationale for non-Latin text.

**Suggested Fix**: If matching the intent matters, add the `u` flag and use a Unicode-aware boundary
(`(?<![\p{L}\p{N}_])`), or document that `#@` triggers after any non-`[A-Za-z0-9_]` character
(including accented letters). Low priority.

### Issue 6: Assembled output no longer matches PRD §6.2 exact format (sentinel inserted)

**Severity**: Minor

**PRD Reference**: PRD §6.2 specifies the assembly as
`<original prompt>\n\n---\n\n<block 1>\n\n<block 2>` (and the §9 pseudocode
`` `${text}\n\n---\n\n${blocks.join("\n\n")}` ``).

**Actual Behavior**: The repo version inserts the sentinel between the rule and the blocks:
`` `${text}\n\n---\n\n${INJECT_SENTINEL}\n\n${blocks.join("\n\n")}` ``, i.e. an extra
`<!--#@file-injected-->\n\n`. The code comment claims the HTML comment is "invisible to the model";
in practice LLMs process **all** tokens including HTML comments, so this adds tokens to every
injection and slightly alters the exact format the PRD specifies. Per-**block** format parity (PRD
§11 #13) is preserved (the sentinel lives outside the `<file>` blocks), but the full assembly is not
byte-identical to the PRD §6.2 spec or to `pi @file`.

**Suggested Fix**: If the sentinel is retained (see Issues 1–2), accept the format note; if the
sentinel is replaced by per-token dedup (Issue 1 fix), the assembly returns to the exact PRD §6.2
format. Update the README/PRD to acknowledge the assembly includes the marker.

---

## Testing Summary

- **Total tests performed**: 28 (existing harness) + 5 live real-Pi end-to-end runs (Tests A–E) +
  2 jiti runner-chaining simulations (duplicate-injection repro + F1 scope).
- **Passing**: 28/28 model-free harness cases; 2/2 control runs (single-copy = correct injection);
  1/1 F1-scope simulation (two identical new copies dedup correctly).
- **Failing**: 2 live end-to-end scenarios on the default documented path (Issue 1: duplicate
  injection; Issue 2: sentinel false-negative), plus 4 spec-deviation findings (Issues 3–6).
- **Areas with good coverage**: single-copy token parsing, text/image/binary/empty routing, format
  parity, all three handler guards (extension-source / steer / no-`#@`), headless notify path, image
  merge contract, error containment.
- **Areas needing more attention**:
  - **Multi-copy / co-existence scenarios** — the harness only ever tests one copy; the `F1` test
    re-feeds through the *same* handler and never simulates a non-sentinel co-loaded copy. This is
    the root cause of Issue 1 slipping through.
  - **Live `-p` / `-e` integration** — PRD §11 #12 and #13 are marked "INTEGRATION / run manually"
    and were never executed by the harness. Running them (as done here) immediately surfaces Issue 1.
  - **Sentinel robustness** — no test covers a user prompt that legitimately contains the sentinel
    string (Issue 2).
  - **Spec reconciliation** — the `F3`/`F5` enhancements (Issues 3–4) and the assembly format
    (Issue 6) deviate from the literal PRD and are undocumented as such.

**Environment**: Pi `@earendil-works/pi-coding-agent` v0.80.7 (global), real model
`deepseek/deepseek-chat` with `--no-tools` (so the model could only report what was already injected
into its context, not call `read`). Repo copy: `file-injector.ts` (249 lines, sentinel/F3/F5/F4).
Stale global copy: `~/.pi/agent/extensions/file-injector.ts` (182 lines, no sentinel/F3/F5).
