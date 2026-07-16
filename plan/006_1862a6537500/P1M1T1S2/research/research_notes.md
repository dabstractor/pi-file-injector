# Research Notes — P1.M1.T1.S2 (plan/006): Run tsc --strict typecheck — confirm 0 errors

> First-hand read of: the S1 PRP (parallel sibling — the 182-test verification gate; S1 explicitly defers
> typecheck to S2), `architecture/external_deps.md` (validated the full Pi API surface against v0.80.8),
> `scripts/typecheck.mjs` + `tsconfig.json` + `package.json` (the gate mechanism), `file-injector.ts` imports
> (L1-6), and a LIVE typecheck run. **Baseline: typecheck is GREEN right now** (`0 errors`, exit 0).

---

## 1. Starting state + the relationship to S1

This is a **verification gate**, NOT implementation — the v006 delta is "Verification + doc-audit (no new
implementation)". The three §1 requirement changes (A: 4-source config merge + trust gate; B: depth-uniform
markdown resolution; C: depth-uniform bare-@) are ALREADY implemented in `file-injector.ts` (1114 lines) and
the code already type-checks clean.

**S1 (parallel) runs the three TEST suites (182 passed); S2 runs TYPECHECK (0 errors).** They are independent
sibling gates under T1. Neither consumes the other's output. S1's PRP explicitly states: "typecheck
(`npm run typecheck`) is S2, a SEPARATE subtask. Do NOT run/typecheck here as part of S1's deliverable." ∴
S2's scope is typecheck ONLY — do not run the test suites (S1's gate) or touch docs (T2 subtasks).

---

## 2. The gate mechanism (scripts/typecheck.mjs) — CONFIRMED by reading the script

The gate is `npm run typecheck` (== `node ./scripts/typecheck.mjs`). It does NOT run the repo's `tsconfig.json`
(that file is **editor/LSP-hints-only** — it has no `paths`, so `tsc -p tsconfig.json` would FAIL to resolve
the pi package). The script:

1. Resolves the **globally-installed** pi package: `PIPKG = path.join(execSync("npm root -g"), "@earendil-works/pi-coding-agent")`.
   (The repo is dependency-free at the project level; pi is a GLOBAL install.)
2. Locates the shipped `.d.ts`: `PI_TYPES = PIPKG/dist/index.d.ts`; `PIAI_TYPES = PIPKG/node_modules/@earendil-works/pi-ai/dist/index.d.ts` (falls back to `compat.d.ts`).
3. Writes a TEMP tsconfig in `os.tmpdir()` with `strict:true`, `noEmit:true`, `skipLibCheck:true`, and `paths`
   mapping `@earendil-works/pi-coding-agent` → `PI_TYPES` and `@earendil-works/pi-ai` → `PIAI_TYPES`.
4. Runs `npx --yes -p typescript@5.6 tsc -p <temp-tsconfig> --listFiles` (TS version is PINNED to 5.6 — deterministic).
5. On success, prints (to **stderr**, via `console.error`): `typecheck: file-injector.ts type-checks clean
   under --strict (0 errors)` and exits 0. On a TS error, the catch sets `process.exitCode = 1`.

**Exit semantics:** 0 = clean; non-zero = TS errors. The success message is on STDERR (note: `--listFiles`
dumps the file list to stdout, but the human-readable success line is `console.error`). ∴ assert BOTH the
message text AND exit code 0.

**Environment guards (exit 1 with a clear message — NOT a code regression):**
- `file-injector.ts` not found under ROOT → `typecheck: file-injector.ts not found under …`
- `npm root -g` fails → `typecheck: could not run \`npm root -g\` to locate pi.`
- pi `.d.ts` missing → `typecheck: pi .d.ts not found at … (is pi installed globally?).`

These are environment issues (global pi package not installed), distinguishable from a real TS type regression.

---

## 3. Baseline (CONFIRMED GREEN — working tree unmodified)

```
$ node ./scripts/typecheck.mjs 2>&1 | tail -1
typecheck: file-injector.ts type-checks clean under --strict (0 errors)
$ echo $?
0
```
Installed pi: **v0.80.8** at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent/`
(item says v0.80.8; PRD §7 references v0.80.7 — external_deps validates against the installed v0.80.8).
`file-injector.ts` imports (L1-6) match the validated surface EXACTLY:
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

---

## 4. The validated API surface (external_deps.md — the "no API risk" basis)

Every import, event field, return type, and ctx member used by `file-injector.ts` is CONFIRMED present + correctly typed in v0.80.8:

| Construct | file-injector.ts use site | Validated signature (external_deps.md) |
|---|---|---|
| `resizeImage` | image branch (injectFile) | `(Uint8Array, mime, opts?) => Promise<ResizedImage\|null>` |
| `formatDimensionNote` | formatImageBlock | `(ResizedImage) => string\|undefined` |
| `ResizedImage` (type) | formatImageBlock / estimateImageTokens | `{ data; mimeType; originalWidth; originalHeight; width; height; wasResized }` |
| `CONFIG_DIR_NAME` | readConfig (project settings path) | const |
| `getAgentDir` | readConfig (global settings path) | `() => string` |
| `ExtensionAPI` (type) | default factory param | exported type |
| `ImageContent` | state.images / handler return | `{ type:"image"; data:string; mimeType:string }` |
| `InputEvent` fields | handler guards | source/streamingBehavior/text/images — exact match |
| `ctx.getContextUsage` | budget computation | `(): ContextUsage\|undefined` (non-optional) |
| `ctx.isProjectTrusted` | readConfig trust gate | `(): boolean` (non-optional) |
| `ctx.hasUI` / `ctx.ui.notify` / `ctx.ui.addAutocompleteProvider` | notify + autocomplete | field / method / method |
| `ctx.cwd` / `ctx.model` | resolution + budget | fields (model has contextWindow, maxTokens) |

**Conclusion (external_deps.md):** "No API risk. … The extension will load and run against v0.80.8 without
type or runtime errors." This is why the typecheck is expected green: the API surface is fully validated.

---

## 5. Failure-diagnosis routing (ONLY if a TS error appears — NOT expected per baseline)

A TS error means EITHER (a) a type regression in `file-injector.ts` introduced since research, OR (b) a
breaking API change in the pi package (version drift). Route by the error's symbol:

| TS error mentions | Likely file-injector.ts site | First check |
|---|---|---|
| `resizeImage` / `ResizedImage` | injectFile image branch; formatImageBlock; estimateImageTokens | signature/field mismatch vs external_deps §Signatures |
| `formatDimensionNote` | formatImageBlock | arg type (must be `ResizedImage`, not `null`) |
| `CONFIG_DIR_NAME` / `getAgentDir` | readConfig | both still exported const/function |
| `ExtensionAPI` / `ImageContent` | factory + state | type-only imports intact |
| `ctx.*` (getContextUsage/isProjectTrusted/hasUI/ui/cwd/model) | handler + readConfig | member still present/non-optional |
| `InputEvent.*` (source/streamingBehavior/text/images) | handler guards | literal-union members unchanged |
| `AutocompleteProvider` (getSuggestions/applyCompletion/shouldTriggerFileCompletion) | session_start autocomplete | shape unchanged |

**Fix rule (item §3):** fix the offending CODE in `file-injector.ts`. Do NOT suppress with `@ts-ignore` /
`as any`, and do NOT loosen `strict` or remove `skipLibCheck`. If the error is a Pi API break (b), the fix
adapts the call site to the new signature (the requirement still holds; the tests must still pass — re-run
S1's three suites after any fix). If it is genuinely impossible (e.g., an API was removed with no replacement),
that is a `"result": "fail"` halt — but external_deps.md makes this astronomically unlikely for v0.80.8.

---

## 6. Scope discipline (what S2 does NOT do)

- Does NOT run the three test suites (S1's gate — 182 passed).
- Does NOT fix PRD.md "24"→"32" (T2.S1; and PRD.md is read-only).
- Does NOT audit README/JSDoc coherence (T2.S2/T2.S3).
- Does NOT modify file-injector.ts UNLESS a TS error forces a real type fix (then re-run typecheck + S1's suites).
- Does NOT touch tsconfig.json / scripts/typecheck.mjs / package.json / PRD / README / JSDoc / tasks.json / prd_snapshot.

---

## 7. Confidence: 10/10

Pure confirmation gate. The typecheck is **already verified green** during research (0 errors, exit 0, working
tree unmodified) against the installed pi v0.80.8, and `external_deps.md` confirms the entire API surface.
The executing agent runs ONE command (`npm run typecheck`), confirms the message + exit 0, and is done — no
implementation, no design risk. The only residual is the (unexpected) error branch, which the routing table +
the "fix code, don't suppress" rule make a short triage. -0 reflects that the gate is deterministic and the
command is exact.
