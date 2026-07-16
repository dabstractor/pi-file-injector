# Research Notes — P1.M1.T2.S3 (Confirm readConfig/SETTINGS_KEY/injectMarkdown JSDoc coherence with §4.5/§4.6)

All facts verified first-hand against the working tree at **HEAD `1ad7b19`** ("Correct PRD Done-definition
test count"). Repo: `/home/dustin/projects/pi-file-injector`. All three test suites green: **122 + 38 + 22
= 182 passed, 0 failed**.

> **VERDICT (confirmed first-hand): COHERENT — no drift, no edit needed.** Each of the three JSDoc regions
> matches its PRD section AND its shipped code. The parallel prior research
> (`plan/006_1862a6537500/architecture/research-config-and-resolution.md`) reached the same verdict with
> exact line numbers; this note re-confirms it against the current HEAD.

---

## 1. The three JSDoc regions under audit (exact line ranges)

| Region | Lines | PRD authority |
|---|---|---|
| `SETTINGS_KEY` const comment | `file-injector.ts:167–171` (JSDoc `/**…*/` + `const SETTINGS_KEY = "fileInjector";` at 171) | §4.6 ("namespaced key `fileInjector`, distinct from the package `name`") |
| `readConfig` JSDoc | `file-injector.ts:174–183` (`/** PRD §4.6 / §9 — read config from up to FOUR sources… */`) | §4.6 (4-source table + precedence + trust gate) |
| `readConfig` body (the shipped behavior the JSDoc must match) | `file-injector.ts:184–216` (`export async function readConfig(...)`) | — |
| `injectMarkdown` JSDoc | `file-injector.ts:790–837` (starts at the `/**` at L790; signature at L838) | §4.5 rule 2/5 (depth-uniform dirname resolution), §4.6 (bareAt threading) |
| `injectMarkdown` body (the shipped behavior) | `file-injector.ts:838–…` (scanTokens call at L849) | — |

---

## 2. readConfig JSDoc ↔ §4.6 ↔ shipped code — three-way agreement

### JSDoc claims (lines 174–183), verbatim intent:
- Lists **all 4 sources** in **precedence order** (1. GLOBAL settings.json key → 2. GLOBAL file → 3. PROJECT
  settings.json key → 4. PROJECT file).
- **Trust gate** stated: sources 3 and 4 marked "**TRUSTED ONLY**".
- **SETTINGS_KEY form** stated: sources 1 and 3 read "the **SETTINGS_KEY object**"; sources 2 and 4 are the
  "whole file".
- **Missing/malformed → {}** (contributes nothing).
- **NEVER throws** (every read/parse try/caught → {}).

### Shipped code (lines 184–216):
```ts
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  const tryReadCfg = async (p) => { try { … return v && typeof v === "object" && !Array.isArray(v) ? … : {}; } catch { return {}; } };
  const tryReadNamespaced = async (p) => { try { … const sub = (v)[SETTINGS_KEY]; return sub && typeof sub === "object" && !Array.isArray(sub) ? … : {}; } catch { return {}; } };
  let cfg = {};
  cfg = { ...cfg, ...(await tryReadNamespaced(path.join(getAgentDir(), "settings.json"))) };       // src 1
  cfg = { ...cfg, ...(await tryReadCfg(path.join(getAgentDir(), "file-injector.json"))) };         // src 2
  if (ctx.isProjectTrusted()) {                                                                   // TRUST GATE (L211)
    cfg = { ...cfg, ...(await tryReadNamespaced(path.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json"))) };  // src 3
    cfg = { ...cfg, ...(await tryReadCfg(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };    // src 4
  }
  return cfg;
}
```

### Verdict per property:
| JSDoc claim | Shipped code | §4.6 table | Coherent? |
|---|---|---|---|
| 4 sources listed | L209, L210, L213, L214 | rows 1–4 | ✅ |
| Precedence (spread sequential, later wins) | L207→L214 sequential spread | "each row overrides the one above" | ✅ |
| Trust gate covers BOTH project sources | L211 `if (isProjectTrusted())` wraps L213+L214; global L209–210 outside | project rows "trusted only" | ✅ |
| SETTINGS_KEY form (sources 1,3 = key obj; 2,4 = whole file) | L209/L213 tryReadNamespaced; L210/L214 tryReadCfg | rows 1,3 `fileInjector` obj; 2,4 whole file | ✅ |
| Missing/malformed → {} | both helpers catch → {} + object guards | "skipped → default, never an error" | ✅ |
| Never throws | every read/parse in try/catch | "never an error" | ✅ |

**readConfig: COHERENT.** ✅

---

## 3. SETTINGS_KEY const comment ↔ §4.6 — agreement

### JSDoc (lines 167–170), verbatim intent:
- "the **camelCase key** under which this extension's config may live inside Pi's **settings.json**".
- "**distinct from the package `name`**".
- "settings.json is **open-schema** (Pi deep-merges and preserves unknown keys through /settings edits +
  flushes), so the key is **stable**".
- "the extension **reads it directly from disk** (Pi exposes no public settings accessor to extensions)".

### §4.6 authority:
- "a namespaced key (`fileInjector`, **distinct from the package `name`**) inside Pi's own `settings.json`".
- "Pi exposes **no public settings accessor** to extensions, so both forms are **read directly from disk**".
- "`settings.json` is **open-schema** and Pi **preserves unknown keys** through `/settings` edits and
  flushes, so the namespaced key is **stable**".

### Verdict: every clause in the const comment maps 1:1 to §4.6 prose. **SETTINGS_KEY comment: COHERENT.** ✅

---

## 4. injectMarkdown JSDoc ↔ §4.5 rule 2/5 + §4.6 (bareAt) ↔ shipped code — agreement

### JSDoc claims the audit must verify:
1. **dirname(abs) resolution** — `@param abs` says "resolution base = dirname"; `@param ctx` says
   "**cwd unused** — imports resolve from dirname(abs)"; Step 3 comment (L842) says "§4.5 rule 2 — imports
   resolve relative to the markdown's directory, **not cwd**".
2. **Depth-uniform, no cwd fallback** — the "DEDUP-BOUNDED, NOT depth-limited" bullet + the absence of any
   `depth` parameter; resolution is **always** dirname(abs) at every recursion level (§4.5 rule 5).
3. **bareAt threading** — Step 3 comment says "§4.6 — **thread state.bareAt** (set from cfg in
   injectFiles — the P1.M2.T1.S1 seam) so a markdown author who opts into `markdownBareAtImports` can write
   a bare `@api.md` (prefixLen 1). `bareAt:false` (default) → BARE_AT_RE is not run → records are
   byte-for-byte identical to today (all prefixLen 2)."

### Shipped code (lines 838–849):
```ts
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void> {
  state.injectedSet.add(abs);                                          // Step 2 claim (idempotent)
  const dir = path.dirname(abs);                                       // §4.5 rule 2 — dirname, NOT cwd
  const records = await scanTokens(content, dir,                       // baseDir = dir (dirname)
      { allowAbsTilde: false, skipCode: true, tryMdExt: true,          // relative-only, code-exempt, ext-shorthand
        bareAt: state.bareAt },                                        // §4.6 — bareAt threaded, no depth gate
      state);
  …
}
```

### Verdict per property:
| JSDoc claim | Shipped code | §4.5/§4.6 | Coherent? |
|---|---|---|---|
| Resolve against `path.dirname(abs)` | L842 `const dir = path.dirname(abs)`; L849 `scanTokens(content, dir, …)` | §4.5 rule 2 "dirname(importingMarkdownAbs)" | ✅ |
| `ctx.cwd` never consulted (no cwd fallback) | no `ctx.cwd` reference in injectMarkdown; `@param ctx` "cwd unused" | §4.5 rule 5 "ctx.cwd is never consulted" | ✅ |
| Depth-uniform (no first-file special case; no depth param) | no `depth` param; same code path at every recursion level | §4.5 rule 5 + §4.6 "Depth-uniform (no first-file asymmetry)" | ✅ |
| `bareAt` threaded from state regardless of depth | L849 `bareAt: state.bareAt` unconditionally; `state.bareAt` set once in injectFiles from cfg | §4.6 "applies at every recursion depth, including the very first file" | ✅ |

**injectMarkdown: COHERENT.** ✅

---

## 5. Conclusion

All three regions (readConfig JSDoc L174–183, SETTINGS_KEY comment L167–171, injectMarkdown JSDoc L790–837)
are **coherent** with PRD §4.5/§4.6 and with the shipped code (`readConfig` L184–216, `injectMarkdown`
L838–849). **No drift found. No edit needed.** The expected outcome of this subtask is a CONFIRMATION verdict
+ a clean working tree (`git status --short` empty). DOCS line: "none — no user-facing/config/API surface
change" (item §5).

### Disjoint from S2 (the parallel sibling)
S2 (P1.M1.T2.S2) targets **README.md**'s config section (lines 88–118). S3 (this) targets **file-injector.ts**
JSDoc (readConfig/SETTINGS_KEY/injectMarkdown). **Different files — no overlap, no conflict.** Both are
read-only doc-coherence confirmations under the v006 doc-audit milestone.

### Gate (unchanged by this task)
- `node file-injector.test.mjs` → 122 passed, 0 failed.
- `node relative-imports.test.mjs` → 38 passed, 0 failed.
- `node import-behavior.test.mjs` → 22 passed, 0 failed.
- `npx tsc --noEmit --strict` (the S1 sibling gate) → 0 errors (JSDoc is comments; this task touches none).
- `git status --short` → EMPTY (no edit is the expected outcome).
