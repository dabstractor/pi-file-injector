# Research: readConfig & injectMarkdown Import Resolution

Source: scout subagent analysis of `file-injector.ts` (all claims confirmed with exact line numbers).

## Part 1 — `readConfig` (4-source merge)

### Location
- `SETTINGS_KEY` constant: **line 171** — `const SETTINGS_KEY = "fileInjector";`
- `readConfig` function: **lines 184–217**
- Helpers: `tryReadCfg` (lines 187–194), `tryReadNamespaced` (lines 197–206)
- `CONFIG_DIR_NAME` and `getAgentDir` imported from `@earendil-works/pi-coding-agent` (line 3)

### 4-source merge: CONFIRMED
```ts
// lines 207–216
let cfg: FileInjectorConfig = {};
cfg = { ...cfg, ...(await tryReadNamespaced(path.join(getAgentDir(), "settings.json"))) };       // src 1
cfg = { ...cfg, ...(await tryReadCfg(path.join(getAgentDir(), "file-injector.json"))) };         // src 2
if (ctx.isProjectTrusted()) {                                       // TRUST GATE (line 211)
  cfg = { ...cfg, ...(await tryReadNamespaced(path.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json"))) };   // src 3
  cfg = { ...cfg, ...(await tryReadCfg(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };     // src 4
}
```

### Precedence order: CONFIRMED
Spread-merge is sequential, so each later key overrides earlier. Effective precedence (lowest→highest):
1. Global settings.json key → 2. Global file-injector.json → 3. Project settings.json key → 4. Project file-injector.json

### Trust gate covers BOTH project sources: CONFIRMED
Both project reads (lines 213, 214) inside the single `if (ctx.isProjectTrusted())` block (line 211). Global sources (209–210) OUTSIDE the gate.

### Missing/malformed → {} without throwing: CONFIRMED
- `tryReadCfg` (187–194): try/catch → `{}` on throw; returns `{}` if not a plain object.
- `tryReadNamespaced` (197–206): try/catch → `{}` on throw; returns `{}` if root non-object or SETTINGS_KEY missing/non-object.

### Caller
`session_start` handler (line 1030): `cfg = await readConfig(ctx)`. Registered first so it is `captureHandler("session_start").all[0]`.

## Part 2 — `injectMarkdown` import resolution

### Location
- Signature: **line 838** — `async function injectMarkdown(abs, content, state, ctx): Promise<void>`
- **No `depth` parameter** exists anywhere in the file (`grep depth` finds only doc comments).
- Sole call site: **line 727** — `await injectMarkdown(abs, buf.toString("utf8"), state, ctx)`

### Resolves against `path.dirname(abs)` unconditionally: CONFIRMED
```ts
// line 842
const dir = path.dirname(abs); // §4.5 rule 2
// line 849
const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);
```
**No reference to `ctx.cwd`**, no depth check, no fallback at any depth. Depth-uniform.

### Passes `bareAt: state.bareAt` regardless of depth: CONFIRMED
The `scanTokens` opts literal (line 849) always includes `bareAt: state.bareAt`. No depth argument, no per-depth mutation. `state.bareAt` is set once in `injectFiles` from `cfg` in the input handler.

`bareAt` field declaration: **line 336** in the `State` interface.

## Summary
| Claim | Verdict | Evidence |
|---|---|---|
| 4-source merge | CONFIRMED | lines 209, 210, 213, 214 |
| Precedence (spread sequential) | CONFIRMED | lines 207–216 |
| Trust gate covers both project sources | CONFIRMED | lines 211–215 |
| Missing/malformed → {} without throwing | CONFIRMED | 187–206 |
| dirname(abs) resolution, no ctx.cwd, depth-uniform | CONFIRMED | line 842, 849 |
| bareAt: state.bareAt regardless of depth | CONFIRMED | line 849 |

No discrepancies found.
