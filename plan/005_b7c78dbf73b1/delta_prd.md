# DELTA PRD: Optional `markdownBareAtImports` config setting

**Status:** Draft · **Base:** `#@file` extension (shipped, 92/92 tests green, `npm run typecheck` clean) · **Artifact type:** Pi TypeScript extension (`file-injector.ts`)

> **Provenance.** This is a focused delta on the already-shipped `#@file` whole-file-injection extension.
> The previous session (plan/004) shipped the **markdown-import extension shorthand** (`#@PRD` → `PRD.md`),
> leaving the extension "no config required." This delta adds **one opt-in setting** —
> `markdownBareAtImports` — so a bare `@file.md` (no `#`) inside a markdown file is also treated as an
> import. It does **not** change default behavior: `markdownBareAtImports` defaults to `false`, and the
> top-level user prompt stays `#@`-only forever.
>
> **Proportional sizing.** This is a *medium* feature addition: one config subsystem (read + merge + trust
> gate), one new regex, one new `prefixLen` field threaded through the scan/strip, ~12 new test cases, and
> one README subsection. **One phase, one milestone, three tasks.** It is larger than a tweak (a new
> config-loading path is genuinely new) but it is a single coherent feature — it does not warrant a
> multi-phase structure.

---

## 1. What Changed in the PRD (diff summary)

Comparing the previous PRD → current PRD, the entire delta is **the addition of `markdownBareAtImports`**.
Everything else (paging, budget, image/binary handling, extension shorthand, autocomplete) is byte-identical.
Concretely, the new/modified sections are:

| § | Change | Kind |
|---|---|---|
| 1 (Value prop) | "Zero config." → "**Zero config by default.** … one opt-in setting (`markdownBareAtImports`, §4.6)" | reworded |
| 2 (Goals 3 & 6) | Goal 3: "No config required" (one opt-in). Goal 6 gains: "An opt-in setting … additionally treats a bare `@<path>` … as a markdown import." | modified |
| 2 (Non-Goals) | "No config of any kind" → "No config required to work … only setting is `markdownBareAtImports`." | modified |
| 3.3 (API table) | Two new rows: `CONFIG_DIR_NAME` + `getAgentDir()` — both ✅ exported, used for the config path. | added |
| **4.6 (NEW)** | **Optional bare-`@` markdown imports (`markdownBareAtImports`)** — config file, two locations, trust gate, `BARE_AT_RE`, scope rules, loading. | **added** |
| 5.6 step 3 | Scan additionally runs `BARE_AT_RE` when the option is on; each record carries `prefixLen` (2 for `#@`, 1 for `@`). | modified |
| 5.6 step 4 | Strip uses `prefixLen`, not a hardcoded `2`. | modified |
| 6.2 | Strip description: "strip the trigger (`#@`, or a bare `@` when … on)". | reworded |
| 7 | Imports `CONFIG_DIR_NAME`, `getAgentDir`. | added |
| 8 | Constants list gains `BARE_AT_RE`; helpers gain `readConfig`; `scanTokens` returns `{index,prefixLen,abs}[]`; factory loads cfg on `session_start`. | modified |
| 9 | Full pseudocode updated (config iface, `bareAt` in State, `session_start` load, candidate-union scan, `readConfig`). | modified |
| 10 | **8 new edge rows** (option off default; on + import; on + `#@` not double-matched; `@username` prose; top-level unaffected; `user@host`; untrusted project ignored; malformed config → false). | added |
| 11 | **4 new acceptance cases** (25–28). | added |
| 12 | Note 19 added (markdown-only, opt-in, never double-matches `#@`). | added |
| 13.4 | "Why no user-facing config" → "Why (almost) no user-facing config" (rewritten to justify the opt-in). | modified |

**Removed requirements:** none.

---

## 2. Feature Specification: `markdownBareAtImports`

### 2.1 The one setting

```json
{ "markdownBareAtImports": true }
```

- **Default:** `false`. With no config file (or `false`), behavior is **byte-for-byte identical to today**
  — only `#@<path>` triggers a markdown import. This is the non-regression guarantee.
- **Effect when `true`:** markdown import scanning (§5.6) matches **both** `#@<path>` *and* a bare
  `@<path>`. Every other rule — relative-only resolution, extension shorthand (exact → `.md`/`.markdown`),
  code-exempt, dedup on resolved abs, paging, budget — applies **identically** to both.
- **Scope: markdown-only.** The top-level user prompt is **never** affected — it is `#@`-only forever
  (Pi's normal `@` behavior at the prompt is untouched). A bare `@path` in the prompt stays Pi's
  autocomplete/literal behavior and is **never** injected by this extension.

### 2.2 The marker-stripping difference

`#@` is 2 marker chars; a bare `@` is 1. The scan must record `prefixLen` per match so the strip step
removes exactly the right number of chars (leaving the path as a readable reference, §6.2):

- `#@api.md` resolved → marker stripped to `api.md` (remove 2 chars at the match index).
- `@api.md` (option on) resolved → marker stripped to `api.md` (remove 1 char at the match index).

Failed/non-resolving/deduped/in-code markers keep their full trigger verbatim (`#@` *or* `@`).

### 2.3 Never double-match `#@file`

The bare regex must **not** match an `@` preceded by `#`, so `#@api.md` is matched **once** (by `FILE_INJECT_RE`),
never twice. The shipped `FILE_INJECT_RE` uses a Unicode-aware negative lookbehind
`(^|(?<![\p{L}\p{N}_]))`. The bare regex mirrors it **and adds `#` to the excluded set** (verified —
see §6):

```ts
const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;   // marker "@" ; not after a word char OR "#"
```

`prefixLen` for `BARE_AT_RE` matches = `1`; for `FILE_INJECT_RE` matches = `2`.

> **Why this exact form (implementer note).** The current PRD pseudocode writes
> `BARE_AT_RE = /(^|(?<=[^\w#]))@(\S+)/g` (a *positive* lookbehind for non-word-non-`#`). That is
> equivalent in **intent** but inconsistent with the **shipped** `FILE_INJECT_RE`, which uses the
> *negative* Unicode form `(?<![\p{L}\p{N}_])` with the `gu` flags. Use the negative Unicode form above
> (`(?<![\p{L}\p{N}_#])` with `gu`) so the two regexes share one boundary definition and the `u` flag is
> consistent. This is a deliberate, verified deviation from the pseudocode; behavior is identical.

### 2.4 Config file: two locations, trust gate, shallow merge

**Read on `session_start`** (which provides `ctx.cwd` and `ctx.isProjectTrusted()`); cached in a factory
closure variable; the `input` handler reads the cached value.

| Location | Path | When honored |
|---|---|---|
| **Global** | `~/.pi/agent/file-injector.json` = `path.join(getAgentDir(), "file-injector.json")` | always (when present) |
| **Project** | `<cwd>/.pi/file-injector.json` = `path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json")` | **only when `ctx.isProjectTrusted()` is true** |

- **Merge:** project overrides global, shallowly. `{ ...global, ...project }`.
- **Untrusted project:** the project file is **ignored** (security — an untrusted project cannot enable
  bare-`@` imports). Only the global value (if any) applies.
- **Missing / malformed / unreadable** file → that location contributes `{}`. A malformed JSON does **not**
  throw; `readConfig` catches and returns `{}` for it. Final fallback is `{ markdownBareAtImports: false }`.

### 2.5 `readConfig` shape & testability

```ts
export async function readConfig(ctx: { cwd: string; isProjectTrusted(): boolean }): Promise<FileInjectorConfig>
```

- It takes a **minimal structural ctx** (`cwd` + `isProjectTrusted()`) — **NOT** the `injectFiles` `Ctx`
  type (which is config-free). The real `session_start` handler's `ExtensionContext` satisfies this
  structurally; tests pass a mock `{ cwd, isProjectTrusted: () => bool }`.
- **Exported** so the merge / trust-gate logic is unit-testable directly without real config files in
  `~/.pi` (mirrors how `resolveImportPath`/`isRegularFile` were exported for the shorthand delta).

---

## 3. Architecture & Insertion Points

**Prior research (still valid — reuse, do not re-research):** `plan/004_8126bb6f1bb8/architecture/`
covers `scanTokens` / `processTokenStream` / `injectMarkdown` / the call-site audit / the test patterns.
The extension-shorthand resolution (`resolveImportPath`/`isRegularFile`, async `scanTokens` with `tryMdExt`)
shipped in plan/004 and is the **baseline** this delta builds on.

**NEW research (this session, verified against `@earendil-works/pi-coding-agent@0.80.8`):**

| Fact | Evidence |
|---|---|
| `CONFIG_DIR_NAME` exported (from `./config.ts`) | `dist/index.d.ts` line 2: `export { CONFIG_DIR_NAME, getAgentDir, … } from "./config.ts";` |
| `getAgentDir` exported (from `./config.ts`) | same line |
| `ctx.isProjectTrusted(): boolean` on `ExtensionContext` | `dist/index.d.ts` `ExtensionContext` interface |
| `session_start` event exists; fires for `startup\|reload\|new\|resume\|fork` | `SessionStartEvent`; `on(event: "session_start", handler)` |
| **A `session_start` handler ALREADY exists** at `file-injector.ts:825` (autocomplete registration) | read-verified |

### 3.1 Current code locations (read-verified, `file-injector.ts` 879 lines)

| Symbol | Location | Delta action |
|---|---|---|
| Imports (L1–3) | `import { resizeImage, formatDimensionNote, … }` | **add** `CONFIG_DIR_NAME, getAgentDir` |
| `FILE_INJECT_RE` (L8) | `/(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu` | unchanged |
| — (after L8) | — | **add** `BARE_AT_RE` constant (§2.3) |
| `interface State` (L246–253) | `{ blocks, images, injectedSet, remaining, count, paged }` | **add** `bareAt: boolean` |
| `scanTokens` (L432–458) | returns `{ index; abs }[]`; loops `FILE_INJECT_RE` only | **change** return → `{ index; prefixLen; abs }[]`; add `bareAt` to opts; build candidate union; sort by index |
| `processTokenStream` (L471–494) | opts `{ allowAbsTilde; skipCode; tryMdExt }` | **add** `bareAt` to opts (threaded; top-level = `false`) |
| `injectMarkdown` (L640–685) | scan call L645 `{ allowAbsTilde:false, skipCode:true, tryMdExt:true }`; Step-3.5 existence pre-check; Step-4 strip hardcoded `+2` | **change** scan call → add `bareAt: state.bareAt`; Step-3.5 records carry `prefixLen`; Step-4 strip by `r.prefixLen` (not `+2`) |
| `injectFiles` (L687–756) | entry; builds State L711–720; calls `processTokenStream` L748 with `{ allowAbsTilde:true, skipCode:false, tryMdExt:false }` | **add** optional 4th param `opts?: { bareAt?: boolean }` (default `false`); set `state.bareAt = opts?.bareAt === true`; pass `bareAt:false` to the top-level processTokenStream |
| Factory `default export` (L796–885) | `input` handler L797; `session_start` handler L825 (autocomplete only) | **add** `let cfg: FileInjectorConfig = {};` closure var; load cfg on `session_start`; `input` handler passes `{ bareAt: cfg.markdownBareAtImports === true }` to `injectFiles` |

### 3.2 The `injectFiles` opt-in param (key design decision)

`injectFiles` currently builds `State` internally and is called by every test via `mod.injectFiles(...)`.
The factory owns the config (read on `session_start`), but `injectFiles` is config-free and **pure**. To
keep both properties AND make the option testable without filesystem config, `injectFiles` gains an
**optional** 4th param:

```ts
export async function injectFiles(
  text: string, imagesIn: ImageContent[], ctx: Ctx,
  opts?: { bareAt?: boolean },   // NEW — default false; the factory passes cfg.markdownBareAtImports
)
```

- The factory's `input` handler: `injectFiles(event.text, event.images ?? [], ctx, { bareAt: cfg.markdownBareAtImports === true })`.
- **All existing tests** call `injectFiles(text, [], FIX)` (3 args) → `opts` is `undefined` → `bareAt`
  defaults to `false` → **byte-for-byte identical behavior**. This is the non-regression guarantee for the
  92-case suite.
- New bare-`@` tests call `injectFiles(text, [], FIX, { bareAt: true })` to exercise the ON path.
- `injectFiles` does **not** read config; `bareAt` is passed in. Config I/O lives only in `readConfig`
  + the `session_start` handler.

### 3.3 The candidate-union scan (scanTokens)

`scanTokens` builds candidates from **both** regexes when `opts.bareAt` is true, unions them, and sorts by
index (so high→low stripping stays offset-stable). Each candidate carries its `prefixLen`:

```ts
const cands: { idx: number; token: string; prefixLen: number }[] = [];
for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
cands.sort((a, b) => a.idx - b.idx);
```

The code-region filter, `cleanToken`, `isAbsoluteOrTilde`, `resolveImportPath`, and dedup
(`state.injectedSet` / `localSeen` on the **resolved** abs) all run unchanged on the union. Because
`BARE_AT_RE` forbids a preceding `#`, no index is claimed by both regexes. Dedup still keys on the
resolved abs, so `#@api.md` + `@api.md` in one file (option on) collapse to one injection.

---

## 4. Edge Cases (PRD §10 — 8 new rows)

| Case | Expected |
|---|---|
| `markdownBareAtImports` off (default); `@api.md` in `a.md` | Bare `@` **not** matched; left verbatim. Only `#@` imports. |
| option on; `@api.md` in `a.md` (file exists) | Imported (bare-`@`); marker stripped to `api.md`. Same rules as `#@`. |
| `#@api.md` with the option on | Matched **once** by `#@` (bare regex skips a `#`-preceded `@`); never double-matched. |
| `@username` in prose (option on; no `username.md`) | Not resolved → left verbatim. Prose imports only if it names a real file. |
| `@api.md` at the top level (option on) | Unaffected — top-level is `#@`-only; Pi's normal `@` behavior. |
| `user@host.com` in markdown (option on) | Not matched (`@` mid-word); left verbatim. |
| Project `markdownBareAtImports: true` in an **untrusted** project | Project file ignored; global value used (default `false` if no global). |
| Missing/malformed `file-injector.json` | Defaults to `false`; no error, no behavior change. |

---

## 5. Acceptance Criteria (PRD §11 — 4 new cases 25–28)

| # | Setup | Input | Expected |
|---|---|---|---|
| 25 | `notes.md` with `@api.md` (exists); **default (option off)** | `#@notes.md` | `api.md` **not** imported; only `notes.md`; `@api.md` left verbatim; `injected===1`. |
| 26 | config `markdownBareAtImports:true`; `notes.md` with `@api.md` (exists) | `#@notes.md` | `notes.md` block (marker→`api.md`) then `api.md` block; notify `2 whole`; `injected===2`. |
| 27 | config on; `notes.md` with `#@api.md` | `#@notes.md` | `#@api.md` matched **once**, injected once; notify `2 whole`. |
| 28 | config on; prompt `#@notes.md` (notes imports `@x.md`); **also** type `@other.md` in the prompt | (interactive) | `@other.md` at top level left as Pi's `@` behavior (not injected); only the `#@` chain runs. |

Plus **`readConfig` unit tests** (merge + trust gate): global-only; project-overrides-global; project
ignored when untrusted; missing → `{}`; malformed JSON → `{}` (no throw).

---

## 6. Documentation Impact

### Mode A — doc-with-work (rides with the implementing task)
- **JSDoc** on: `BARE_AT_RE` (the bare-`@` marker, markdown-only, never matches a `#`-preceded `@`);
  `readConfig` (two locations, trust gate, shallow merge, malformed→`{}`); `scanTokens` (now unions
  `BARE_AT_RE` when `opts.bareAt`; records carry `prefixLen`); `injectFiles` (new `opts.bareAt` param);
  `State` (`bareAt` field); the `session_start`/config-load step. These ride **with** the code in T1.
- **Test module-surface sanity list** (`file-injector.test.mjs` L113–130): add `readConfig` (it is a newly
  exported function). `BARE_AT_RE` is an internal constant (not exported) — not on the list. This is
  **required** or the suite errors at load (the completeness gate at L132–151).

### Mode B — changeset-level docs (final task)
- **`README.md`:** add a short **Configuration** subsection documenting `markdownBareAtImports` (what it
  does, the two config-file locations, the trust gate, default off). This belongs in the README near the
  markdown-imports/Syntax coverage (around L80–97) and is the only user-facing surface change. It only
  makes sense once the feature + tests land, so it is a dedicated final task depending on T1 + T2.
  The existing README bullets (relative-only imports, extension shorthand, code escape hatch, each-file-once,
  shared budget, the `#@`-vs-`@` note, Limits) stay **unchanged**.

---

## 7. Tasks

### Phase P1 — `markdownBareAtImports` opt-in bare-`@` markdown imports

**Baseline before P1:** 92/92 tests green; `npm run typecheck` 0 errors. No new Pi APIs beyond the
verified `CONFIG_DIR_NAME`/`getAgentDir`/`isProjectTrusted`/`session_start`; no new npm deps; no
structural refactor. Reuses the plan/004 scanTokens/processTokenStream/injectMarkdown machinery verbatim.

#### Milestone P1.M1 — Implement, validate & document the opt-in setting

Single milestone: the change is localized (config subsystem + scan union + prefixLen threading) and the
blast radius is the scan/strip path plus one new entry-point param.

---

##### Task P1.M1.T1 — Bare-`@` import core (config + scan union + prefixLen)

Implement the opt-in end-to-end: config loading, the `bareAt` thread through State/scan/process/inject,
the candidate-union scan, and prefix-aware stripping. Split into two subtasks (config plumbing, then
scan/strip mechanics) because they are distinct concerns, but they ship together.

**Subtask P1.M1.T1.S1 — Config subsystem + `bareAt` plumbing** (≈2 SP)
- Imports: add `CONFIG_DIR_NAME, getAgentDir` to the Pi import (L3).
- Add `interface FileInjectorConfig { markdownBareAtImports?: boolean }`.
- Add `export async function readConfig(ctx: { cwd: string; isProjectTrusted(): boolean }): Promise<FileInjectorConfig>` — try-read global (`getAgentDir()`), then project-if-trusted (`ctx.cwd`/`CONFIG_DIR_NAME`), shallow-merge; per-location try/catch → `{}`; never throws.
- `State`: add `bareAt: boolean`.
- `injectFiles`: add 4th param `opts?: { bareAt?: boolean }` (default `false`); set `state.bareAt = opts?.bareAt === true`. Pass `bareAt: false` to the **top-level** `processTokenStream` call (top-level is `#@`-only forever).
- Factory: add `let cfg: FileInjectorConfig = {};` closure; load it on `session_start` (merge into the **existing** session_start handler at L825, or add a second `pi.on("session_start", …)` — Pi allows multiple handlers per event); the `input` handler calls `injectFiles(..., { bareAt: cfg.markdownBareAtImports === true })`.
- Add `readConfig` to the test module-surface sanity list (L113–130) — **required** or the suite errors at load.
- **Gate:** the FULL existing 92-case suite stays byte-for-byte green (all existing calls are 3-arg → `bareAt` defaults false); `npm run typecheck` 0 errors.

**Subtask P1.M1.T1.S2 — `BARE_AT_RE` + candidate-union scan + prefix-aware strip** (≈2 SP; depends S1)
- Add `const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;` (the **negative Unicode form** in §2.3 — mirrors shipped `FILE_INJECT_RE` + excludes `#`; deliberately not the pseudocode's positive lookbehind).
- `scanTokens`: add `bareAt: boolean` to opts; return type → `{ index: number; prefixLen: number; abs: string }[]`. Build the candidate union (§3.3): `FILE_INJECT_RE` (prefixLen 2) always; `BARE_AT_RE` (prefixLen 1) when `opts.bareAt`. Sort by `idx`. The rest (code-region filter, cleanToken, isAbsoluteOrTilde, resolveImportPath, dedup on resolved abs) runs unchanged on the union.
- `processTokenStream`: add `bareAt` to opts (threaded to `scanTokens`); top-level call passes `bareAt:false`.
- `injectMarkdown`: scan call gains `bareAt: state.bareAt`; **Step-3.5** existence-pre-check records now carry `prefixLen` (the type widens); **Step-4** strip uses `r.prefixLen` instead of hardcoded `+2` (`stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen)`).
- **Gate:** existing 92 cases green (top-level `bareAt:false` → `BARE_AT_RE` never runs → identical); typecheck 0 errors. Verify `#@api.md` is matched once even with a `bareAt:true` markdown scan (dedup + the `#` lookbehind exclusion).

---

##### Task P1.M1.T2 — Tests: acceptance 25–28 + §10 edges + `readConfig` unit (≈1 SP; depends T1)

Mirror the existing markdown-import case template (cases 15–24, `file-injector.test.mjs` ~L1614–1718).
Real TMPDIR fixtures + `FIX` ctx (no budget → all whole). Bare-`@` cases call `injectFiles(text, [], FIX, { bareAt: true })`; default cases call `injectFiles(text, [], FIX)` (3-arg) to prove non-regression.

- **Case 25** (option off): `notes.md` with `@api.md`; `injectFiles("Review #@notes.md", [], FIX)` → `api.md` NOT imported; `@api.md` verbatim in notes block; `injected===1`.
- **Case 26** (option on): same setup, `injectFiles(..., { bareAt: true })` → `notes.md` block (marker→`api.md`) then `api.md` block; `injected===2`.
- **Case 27** (on, no double-match): `notes.md` with `#@api.md`; `injectFiles(..., { bareAt: true })` → `#@api.md` injected **once**; `injected===2`.
- **Case 28** (on, top-level unaffected): prompt with BOTH a `#@` chain and a bare `@other.md` → bare `@other.md` at top level NOT injected (Pi's `@` behavior); only the `#@` chain runs.
- **`readConfig` unit** (exported): global-only honored; project-overrides-global (shallow); project **ignored** when `isProjectTrusted()` false; missing file → `{}`; malformed JSON → `{}` (no throw). Uses a mock `{ cwd, isProjectTrusted: () => bool }` + real TMPDIR files (no writes to real `~/.pi`).
- **Regression:** existing 92 cases byte-for-byte green; `#@api.md` not double-counted.

---

##### Task P1.M1.T3 — Sync changeset-level documentation (Mode B) (≈0.5 SP; depends T1 + T2)

Add a short **Configuration** subsection to `README.md` near the markdown-imports coverage (~L80–97):
document `markdownBareAtImports` (what it does, the two locations `~/.pi/agent/file-injector.json` +
`<cwd>/.pi/file-injector.json`, trust gate, default off, example JSON). Keep tone/formatting consistent.
Do **not** edit the existing import bullets, the `#@`-vs-`@` note, the Limits section, or install/usage.
(Mode A JSDoc rode with T1; this is the whole-feature user-facing doc.)

---

## 8. Verification Gates (Definition of Done)

1. **Regression:** the FULL existing suite (92 cases) stays **byte-for-byte green** — every existing
   `injectFiles(text, [], FIX)` call is 3-arg → `bareAt` defaults `false` → `BARE_AT_RE` never runs.
2. **New cases:** 25–28 + the 8 §10 edge behaviors + `readConfig` unit tests pass. Suite reports
   `92 + new` all green, 0 failed.
3. **Typecheck:** `npm run typecheck` → 0 errors (the `readConfig` ctx shape, `scanTokens` return-type
   widening, and `prefixLen` threading must satisfy `--strict`).
4. **Module surface:** `readConfig` added to the sanity list (L113–130).
5. **Never double-match:** with `markdownBareAtImports:true`, a `#@api.md` inside a markdown file is
   injected exactly once (case 27).
6. **Default is a no-op:** no `file-injector.json` anywhere → `bareAt:false` → behavior identical to the
   92-case baseline (proven by the 3-arg default).
7. **Docs:** README Configuration subsection present; existing README sections unchanged.

---

## 9. Risk Notes

- **The negative-lookbehind `BARE_AT_RE` form is mandatory.** The PRD pseudocode's positive-lookbehind
  `(?<=[^\w#])` is equivalent in intent but uses ASCII `\w` without the `u` flag, inconsistent with the
  shipped `FILE_INJECT_RE`. Use `/`(^|(?<![\p{L}\p{N}_#]))`@`(`\S+`)/`gu`` (§2.3). Verified (§3 of this PRD).
- **`session_start` already has a handler** (autocomplete, L825). Config load may merge into it or add a
  second `pi.on("session_start", …)`. Either is fine; do not delete the autocomplete handler.
- **`readConfig` takes a different ctx shape** (`cwd` + `isProjectTrusted()`) than `injectFiles`' `Ctx`.
  Do **not** widen `injectFiles`' `Ctx` to add config — `injectFiles` stays pure; config lives only in
  `readConfig` + the factory closure. Tests pass a mock ctx to `readConfig` and `{ bareAt }` opts to
  `injectFiles`.
- **`injectFiles` 4th param is the test seam.** Without it, the option could only be tested via real
  config files under `~/.pi` — awkward and non-hermetic. The 4th param keeps tests hermetic and the
  existing 92 cases trivially non-regressed (3-arg default).
