# Research Notes — P1.M1.T2.S2 (Confirm README.md §4.6 config coherence)

All facts verified first-hand against the live tree at HEAD `1ad7b19` ("Correct PRD Done-definition test
count"). Working tree clean. T2.S1 has landed (PRD.md:1189 now reads "all 32 manual test cases").

## 0. The headline finding

**README.md / shipped code / PRD §4.6 all AGREE. NO drift found.** This is a verification subtask whose
expected outcome is "confirmed coherent — no edit needed." The prior audit
(`plan/006_1862a6537500/architecture/research-doc-audit.md` Part 3) reached the same conclusion; this
subtask re-confirms it against the current tree (HEAD advanced twice since the audit; README/§4.6/code
all still agree).

The verification deliverable is a structured comparison + a `git diff` proof that NO file changed (the
"mark complete" path, item §3). Only if a drift were found would a minimal README edit ride here (item §4).

## 1. The README section under test (exact bounds — CORRECTED from item metadata)

The item says "README.md (134 lines), specifically the section (lines 88–117)." Both metadata numbers have
drifted (the README grew by 2 lines); the ACTUAL bounds are:
- **README.md total: 136 lines** (not 134).
- **Section heading: `README.md:88`** — `### Optional: bare-\`@\` markdown imports`
  (heading contains literal backticks around the `@`; a plain `grep "bare-@"` finds NOTHING — search for
  `markdown imports` or the backtick form).
- **Section body: lines 89–117; trailing blank at 118; `## Limits` begins at 119.**
  → Bound the section as **lines 88–118** (or 88–117 for last-content-only). The item's "88–117" is off
  by one on the end (118 is a blank; 117 is the last content line).
- README `##`/`###` heading map (verified): `# \`#@file\`` L1; `## Why` L5; `## Install` L13; `## Usage` L21;
  `## What gets injected` L45; `## Syntax` L66; `### Optional: bare-\`@\` markdown imports` L88; `## Limits`
  L119; `## \`#@\` versus \`@\`` L131.

## 2. The four §4.6 coherence checks — all PASS (re-verified against live code)

### (a) Both config forms documented with examples — PASS
- README L92 introduces both forms ("either of two forms — a dedicated file, or under the `fileInjector`
  key inside Pi's own `settings.json`").
- README L97–99 — dedicated `file-injector.json` example: `{ "markdownBareAtImports": true }`.
- README L100–105 — namespaced-key example inside `settings.json`:
  `{ "defaultModel": "...", "fileInjector": { "markdownBareAtImports": true } }`.

### (b) Four precedence locations listed in order — PASS
README L107–112 (verbatim):
```
Both forms are read from a global and a project location and shallow-merged in this order
(each later one wins; within the same scope the dedicated file beats the `settings.json` key):

1. Global `~/.pi/agent/settings.json` → `fileInjector`
2. Global `~/.pi/agent/file-injector.json`
3. Project `.pi/settings.json` → `fileInjector` — **trusted project only**
4. Project `.pi/file-injector.json` — **trusted project only**
```
Matches PRD §4.6 table rows 1–4 exactly (order + the within-scope "dedicated beats settings key" rule +
the scope "project beats global" rule).

### (c) Trust gate stated for project sources — PASS
- README L111 & L112: both project rows carry `— **trusted project only**`.
- README L113: "The project sources are honored only in a trusted project, so an untrusted checkout can't
  turn it on. (`settings.json` is open-schema, so Pi preserves the `fileInjector` key through `/settings`
  edits.)" — explicit trust-gate statement + the open-schema stability note.

### (d) Depth-uniform property stated — PASS
README L116: "This is uniform at **every** depth: the first file a top-level `#@` token pulls in is not
special-cased — its bare `@` imports are honored exactly like those in files deeper in the chain."

## 3. Shipped-code cross-check — confirms README claims (no drift)

### `readConfig` (file-injector.ts L184–217) — 4-source merge, trust gate, no-throw — all match README
- `SETTINGS_KEY = "fileInjector"` (L171).
- L208–215 spread-merge in EXACTLY the README/PRD order:
  - L209 `tryReadNamespaced(getAgentDir()/settings.json)` — src 1 (global settings key)
  - L210 `tryReadCfg(getAgentDir()/file-injector.json)` — src 2 (global file)
  - L211 `if (ctx.isProjectTrusted()) {` — **single trust gate**
  - L213 `tryReadNamespaced(ctx.cwd/.pi/settings.json)` — src 3 (project settings key)
  - L214 `tryReadCfg(ctx.cwd/.pi/file-injector.json)` — src 4 (project file)
  - L215 `}`
- Spread-merge is sequential → each later key overrides earlier → precedence = global settings key →
  global file → project settings key → project file. ✅ matches README L107–112 + PRD §4.6 table.
- BOTH project sources (L213, L214) are inside the single `if (ctx.isProjectTrusted())` gate (L211–215).
  ✅ matches README "trusted project only" on rows 3–4.
- `tryReadCfg` (L187–193) and `tryReadNamespaced` (L197–205): both `try/catch → {}`; non-object / missing
  `fileInjector` key → `{}`. ✅ matches README "A missing or malformed source ... leaves everything at
  the default, so it never errors."

### `injectMarkdown` (file-injector.ts L838–849) — depth-uniform, no cwd — matches README L116
- L844 `const dir = path.dirname(abs);` — resolves against the markdown's OWN directory, NOT `ctx.cwd`.
- L849 `scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state)`
  — `bareAt: state.bareAt` threaded UNCONDITIONALLY (no per-depth branching, no depth param).
- Signature `(abs, content, state, ctx)` has NO depth argument; recursion is via `injectFile`, no depth
  counter plumbed. ✅ matches README "uniform at every depth ... first file is not special-cased."
- `state.bareAt` set ONCE (file-injector.ts L958) from the `bareAt` param of `injectFiles`; the sole
  caller passes `cfg.markdownBareAtImports === true` (L1037, the input handler). So bare-@ is driven by
  the session-cached `cfg` uniformly at every depth. ✅

## 4. Three-way agreement matrix (README ↔ code ↔ PRD §4.6)

| §4.6 property | README | shipped code | PRD §4.6 | Agree? |
|---|---|---|---|---|
| Two config forms (dedicated + namespaced key) | L92, L97–105 | tryReadCfg + tryReadNamespaced (L187–205) | §4.6 "Config sources" + 2 code blocks | ✅ |
| 4 precedence locations, this order | L109–112 | spread L209,210,213,214 | §4.6 table rows 1–4 | ✅ |
| Within-scope: dedicated file beats settings key | L107 ("within the same scope the dedicated file beats the `settings.json` key") | spread order (file after settings key in each scope) | §4.6 "within a scope the dedicated file overrides" | ✅ |
| Scope: project overrides global | L107 ("each later one wins") | spread order (project after global) | §4.6 "project scope overrides global" | ✅ |
| Trust gate on BOTH project sources | L111–113 | both inside `if (ctx.isProjectTrusted())` L211 | §4.6 table "trusted only" rows 3–4 | ✅ |
| Missing/malformed → default, no error | L116 ("never errors") | try/catch → {} (L187–205) | §4.6 "Loading" para ("never an error") | ✅ |
| Depth-uniform bare-@ (no first-file asymmetry) | L116 | dirname(abs), bareAt always, no depth param (L844,849) | §4.6 "Depth-uniform" para | ✅ |
| Top-level prompt unaffected (always #@) | L118 ("a bare `@path` you type in your prompt is never injected") | top-level scanTokens passes bareAt:false (input handler) | §4.6 "Scope" para | ✅ |

**Zero discrepancies.** Every README claim about the config maps 1:1 to shipped code behavior AND to PRD §4.6.

## 5. The two non-doc drifts (metadata only — NOT README/code drift)

These do NOT require any edit; they're noted so the implementing agent isn't confused by the item's
line-count metadata:
1. **README line count**: item says "134 lines"; actual is **136**. (The README grew by 2 lines at some
   point; the config section content is unchanged.)
2. **Section bounds**: item says "lines 88–117"; actual is **88–118** (heading L88; body 89–117; blank 118;
   `## Limits` at L119). The item's "88–117" is correct for the heading+body but excludes the trailing
   blank — immaterial.
3. **HEAD advanced**: at audit time HEAD was `574bd01`; it is now `1ad7b19` (T2.S1 landed in between as
   commits `e1c4716` + `1ad7b19`). Neither commit touched README's config section or the code's readConfig/
   injectMarkdown, so the coherence verdict is unaffected.

## 6. Expected outcome + verification command (item §3/§4)

Because coherence HOLDS (no drift), this subtask's deliverable is:
- **NO file edit** (item §3: "If all coherent (expected), no edit needed — mark complete").
- **DOCS line (item §5): "none — no user-facing/config/API surface change."**
- **Verification = `git status --short` is empty** (proof nothing was changed) + a printed/recorded
  three-way agreement table (the deliverable evidence).

The verification gate is NOT a test run (no code changed). It is the structured comparison above +
`git diff` showing no changes. If, contrary to expectation, a drift WERE found, the fix would be a
minimal README edit to match code behavior (item §4: "correct the doc to match code behavior, not the
other way"), validated by re-running the comparison — but the live tree shows NO such drift.
