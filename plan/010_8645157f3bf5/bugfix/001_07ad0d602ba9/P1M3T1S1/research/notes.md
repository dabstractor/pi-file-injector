# Research Notes — P1.M3.T1.S1 (Update README.md URL detection documentation)

Documentation-only task (Mode B — final changeset-level doc sweep). No source code, no tests, no config.
The deliverable is a single README.md bullet edit.

---

## 1. The exact edit locus — README.md L202 (verified verbatim)

The "URLs need a dotted, alphabetic hostname" bullet is the LAST item in the `## Limits` section
(L187-203), immediately followed by the `## \`#@\` versus \`@\`` section (L205). It is ONE bullet.

Current text (L202, single line in source):
```
- **URLs need a dotted, alphabetic hostname.** A `#<url>` token must be a `http(s)://`/`ftp://` URL **or** a bare host whose final label is 2+ letters (e.g. `example.com`, `api.example.co.uk`). This deliberately rejects `#3.14`, `#v1.2`, `#fff` and other token-like text. As a side effect, **raw IP addresses and `localhost` are not detected as URLs** — `#127.0.0.1:8080`, `#localhost:3000/api`, and even `#http://127.0.0.1` are left verbatim with no fetch and no error. To inject a local dev server, give it a resolvable hostname (an `/etc/hosts` alias, a `*.local` name, or a real domain) rather than an IP or `localhost`.
```

The PROBLEM phrase: "This deliberately rejects `#3.14`, `#v1.2`, `#fff` and other token-like text."
This is phrased as the comprehensive closing safety statement → implies `#filename.ext` is also safe.
Before the BUG-001 fix, `#filename.ext` was NEVER safe (it triggered a live fetch); after the fix it is
explicitly handled (deny-list). The README must say so honestly (PRD h2.5 Recommendations).

---

## 2. The actual JSDoc the README MUST be consistent with (file-injector.ts L27-42)

Item LOGIC #3c mandates README ↔ JSDoc consistency. The JSDoc landed by P1.M1.T1.S1 (status: Complete)
is the source of truth. Verified the ACTUAL current text (not the PRP's intended text):

```
/** PRD §2.3 — an anchored shape gate ... [BUG-001] Code-extension deny-list: a scheme-less, PATH-LESS
 *  (bare `word.ext`) token whose final label (after the last '.', lowercased) is a known code/file
 *  extension (e.g. `#main.go`, `#notes.md`, `#config.json`, `#node.js`) is treated as a LOCAL FILE
 *  reference, NOT a URL — the URL scan loop skips it before fetch (see `CODE_EXTENSIONS`). ...
 *  A slash-bearing scheme-less token (e.g. `#example.com/img.png`) is a real domain + path and is
 *  NOT gated. Explicit-scheme tokens (`#https://…`, `#http://…`, `#ftp://…`) bypass the deny-list
 *  entirely — use that form to force-fetch a domain whose TLD collides with a code extension
 *  (e.g. `#https://node.js`, `#https://foo.sh`). ... */
```

**CRITICAL nuance the contract under-specifies:** the deny-list is **scheme-less AND PATH-LESS**
(bare `word.ext`) only. A slash-bearing scheme-less token (`#example.com/img.png`) is NOT gated because
its alpha-TLD final label is the TLD (`com`), not the path extension. The item_description's simplified
"scheme-less tokens ending in a common code/file extension" omits the PATH-LESS qualifier. The README
should be accurate to the JSDoc (document the slash exception), since LOGIC #3c requires consistency.

**Key phrasings to mirror in the README (translated to user-facing prose — NO internal refs like
DET-1/P1.M1.T2.S3/CODE_EXTENSIONS in user docs):**
- "treated as a [local] file reference, not a URL"
- "skips it before fetch" / "no fetch, no injection"
- "scheme-less, path-less" (or "bare `word.ext`")
- slash exception: "`#example.com/img.png` still fetches"
- workaround: "explicit scheme bypasses the check" / "force-fetch a domain whose TLD collides with a
  code extension — `#https://foo.sh` rather than `#foo.sh`"

---

## 3. BUG-002 requires ZERO README change (verified)

The README documents the `read <path>` green lines (L43, L55, L110) and ctrl+o — but NEVER the status
toast wording. `grep -i "toast\|notify" README.md` → no matches; the word "injected" appears only in
the sense of "file injected into the model's context", never the toast text `#@ injected N whole`.
So BUG-002's behavior (trigger-aware toast: `injected N URL[s]`) is an UNDOCUMENTED surface and needs
no README edit. This matches the P1.M2.T1.S1 PRP's explicit stance ("the toast is not a documented
API surface — no README/JSDoc change").

The item_description's "syncs documentation for both BUG-001 and BUG-002" framing means: this is the
FINAL changeset doc sweep, and BUG-002 happens to require no change. The PRP must make this explicit so
the implementer does NOT invent a BUG-002 doc change (e.g. documenting the toast) — that would be scope
creep and would contradict the sibling PRP.

---

## 4. No-touch zones (verified — these MUST stay byte-for-byte unchanged)

- **L50-55 (URL feature examples)**: `#example.com`, `#https://example.com/api`,
  `#https://news.ycombinator.com` — all use real TLDs (`.com`/`.net`/`.org`-style), none collide with
  a code extension. The deny-list does not affect them. Contract LOGIC #3b: NO change here. ✔
- **L184 (enableUrls config)**: "The default is `true`, so `#example.com` works with no configuration
  at all." The deny-list is ALWAYS active when enableUrls is on — it is NOT a separate config field.
  Contract LOGIC #3b: NO note needed here. ✔ (Adding one would imply a knob that doesn't exist.)

---

## 5. Behavior summary being documented (from fix_strategy.md + P1.M1.T1.S1 PRP)

| Token shape | Detected as URL? | Fetches? | Why |
|---|---|---|---|
| `#https://x.com/y` (explicit scheme) | yes | yes | Alternative A — bypasses deny-list entirely |
| `#example.com` (bare, real TLD `com`) | yes | yes | Alternative B; `com` ∉ deny-list |
| `#main.go` (bare, code ext) | **no** (NEW) | **no** | scheme-less + path-less + final label `go` ∈ deny-list |
| `#example.com/img.png` (bare + slash) | yes | yes | slash → real domain + path; NOT path-less → not gated |
| `#https://foo.sh` (explicit scheme) | yes | yes | explicit scheme bypasses deny-list (the workaround) |
| `#3.14`, `#v1.2`, `#fff` | no | no | fail the alpha-TLD shape gate (numeric/short final label) |
| IP / `localhost` | no | no | not dotted-alpha-host (unchanged side effect) |

The deny-list covers ~120 common code/config/doc/image/archive extensions (see CODE_EXTENSIONS in
file-injector.ts L56). A few overlap real ccTLDs (`.sh`=Saint Helena, `.py`=Paraguay) — in a coding
agent `#foo.sh`/`#foo.py` mean a script / Python file; force-fetch via `#https://foo.sh`.

---

## 6. Validation approach (no test framework for README)

There is no automated README test. Validation is:
1. Human diff review of the single bullet (does it read well? accurate? no internal refs leaked?).
2. Consistency cross-check vs the actual JSDoc (file-injector.ts L27-42) — terminology must agree.
3. `git diff --stat` confirms ONLY README.md changed (1 file, no structural changes).
4. grep confirms L50-55 and L184 are byte-for-byte unchanged; grep confirms no new heading/section.
5. Optional: `npx markdownlint-cli2 README.md` if a linter is desired (NOT required; the repo has none).

`npm run typecheck` and `npm test` are unaffected by a pure-markdown edit but SHOULD still pass
(README isn't type-checked; running them proves no accidental source drift). The primary gate is the
human/consistency review.

---

## 7. Out of scope (guard against scope creep)

- Do NOT document the status toast wording (BUG-002 surface, undocumented — §3 above).
- Do NOT touch L50-55 examples or L184 enableUrls section (§4 above).
- Do NOT add new README headings/sections ("no structural changes").
- Do NOT edit file-injector.ts, any test, package.json, or any config (Mode B = docs only).
- Do NOT add internal cross-refs (DET-1, P1.M1.T2.S3, CODE_EXTENSIONS, §2.3) to user-facing prose.