# API Verification — PRD v005 additions (`markdownBareAtImports`)

Complements `plan/001_5aa8724eb506/architecture/api_verification.md` (which verified `resizeImage`,
`formatDimensionNote`, `ImageContent`, `ExtensionAPI.on("input")`, `ExtensionContext`, `getLanguageFromPath`).
This document verifies the **additional** exports §4.6 depends on. Package:
`@earendil-works/pi-coding-agent` at `/home/dustin/.local/lib/node_modules/@earendil-works/pi-coding-agent`.

All claims VERIFIED against the installed dist `.d.ts` / `.js` on 2025-07-16.

---

## 1. `CONFIG_DIR_NAME` — ✅ VERIFIED (string constant = `".pi"`)

- `dist/index.d.ts:2` → `export { CONFIG_DIR_NAME, getAgentDir, … } from "./config.ts";`
- `dist/index.js:4` → runtime re-export.
- `dist/config.d.ts:68` → `export declare const CONFIG_DIR_NAME: string;`
- `dist/config.js:394` → `export const CONFIG_DIR_NAME = pkg.piConfig?.configDir || ".pi";`
- Value is deterministically `".pi"` (from `package.json#piConfig.configDir`).

**Use (§4.6):** project-local config path = `path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json")`.

## 2. `getAgentDir` — ✅ VERIFIED (`(): string` → `~/.pi/agent`)

- Same re-export as above (`dist/index.d.ts:2`).
- `dist/config.d.ts:75-76` → `export declare function getAgentDir(): string;` ("Get the agent config directory (e.g. ~/.pi/agent/)").
- `dist/config.js:411-418` → returns `path.join(os.homedir(), CONFIG_DIR_NAME, "agent")`, overridable via env `PI_CODING_AGENT_DIR`.

**Use (§4.6):** global config path = `path.join(getAgentDir(), "file-injector.json")`.

## 3. `session_start` event + `ctx` — ✅ VERIFIED (provides `cwd` + `isProjectTrusted`)

- `dist/core/extensions/types.d.ts:842` → `on(event: "session_start", handler: ExtensionHandler<SessionStartEvent>): void;`
- `ExtensionHandler<E>` receives `(event: E, ctx: ExtensionContext)`.
- `ExtensionContext` (types.d.ts:226, 221) → `isProjectTrusted(): boolean;` and `cwd: string;`.

**Use (§4.6):** config is read on `session_start` because that event provides both `ctx.cwd` (project
config path) and `ctx.isProjectTrusted()` (the trust gate — an untrusted project cannot enable
bare-@). The existing `file-injector.ts` already registers a `session_start` handler (for the
autocomplete provider); the config load can be merged into it or added as a second `session_start`
handler (Pi appends handlers per event).

## 4. `AutocompleteProviderFactory` / `addAutocompleteProvider` — ✅ VERIFIED (unchanged by §4.6)

Confirmed for completeness (the existing autocomplete provider does not change):
- `dist/core/extensions/types.d.ts:60-61` → `export type AutocompleteProviderFactory = (current: AutocompleteProvider) => AutocompleteProvider;`
- `dist/core/extensions/types.d.ts:135-136` → `addAutocompleteProvider(factory): void;`
- Provider methods: `getSuggestions` (required), `applyCompletion` (required), `shouldTriggerFileCompletion` (optional `?`).
- `getSuggestions` returns `Promise<AutocompleteSuggestions | null>`; `AutocompleteSuggestions = { items: AutocompleteItem[]; prefix: string }`.
- `AutocompleteItem = { value: string; label: string; description?: string }`.

**Caveat (type resolution):** `AutocompleteProvider` / `AutocompleteItem` / `AutocompleteSuggestions`
are **NOT** re-exported from the main `@earendil-works/pi-coding-agent` entry — only
`AutocompleteProviderFactory` is. They live in the transitive dep `@earendil-works/pi-tui`. The
existing `file-injector.ts` avoids importing these names directly (duck-typed via the factory's
`current` param); the §4.6 work does not touch autocomplete, so this is unchanged.

## 5. `ContextUsage` — ✅ VERIFIED (already used by the paged-delivery budget)

- `dist/core/extensions/types.d.ts:192` → `export interface ContextUsage { … }`.
- `ctx.getContextUsage(): ContextUsage | undefined`.
- The existing `injectFiles` already reads `usage.contextWindow` + `usage.tokens` for the `remaining`
  budget (§5.5). Unchanged by §4.6 — bare-@ imports draw on the SAME budget via the existing `subtract`.

---

## Summary

| # | Claim (PRD §4.6 / §7) | Status | Evidence |
|---|---|---|---|
| 1 | `CONFIG_DIR_NAME` exported, = `".pi"` | **VERIFIED** | `dist/index.d.ts:2`; `dist/config.js:394` |
| 2 | `getAgentDir()` exported, → `~/.pi/agent` | **VERIFIED** | `dist/index.d.ts:2`; `dist/config.d.ts:75` |
| 3 | `session_start` ctx has `cwd` + `isProjectTrusted()` | **VERIFIED** | `types.d.ts:842,226,221` |
| 4 | autocomplete provider shape (unchanged by §4.6) | **VERIFIED** | `types.d.ts:60,135`; pi-tui `autocomplete.d.ts` |
| 5 | `ContextUsage` for budget (unchanged by §4.6) | **VERIFIED** | `types.d.ts:192,236` |

**No discrepancies.** All §4.6 API dependencies are satisfied by the installed package.
