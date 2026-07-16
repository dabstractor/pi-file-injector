# System Context — Delta v006 (Verification + Doc Audit)

## Project State

This is a **delta PRD (v006)**, NOT a greenfield project. The `#@file` Pi extension is already
fully implemented at `file-injector.ts` (1114 lines), with three test suites (182 tests total)
all passing green, and `tsc --strict` clean (0 errors).

### Delta type
The delta PRD classifies itself as **"Verification + doc-audit (no new implementation required)"**.
Three requirement-level changes were introduced in `PRD.md` since session-005, all localized to
§4.5/§4.6 and their downstream sync points. **All three are already implemented and tested green
in the current repo.** The legitimate work is (1) a confirmation gate and (2) a doc audit.

### Current test status (verified during research)
```
file-injector.test.mjs      → 122 passed, 0 failed
relative-imports.test.mjs   →  38 passed, 0 failed
import-behavior.test.mjs    →  22 passed, 0 failed
                                (182 passed total, 0 failed)
typecheck (tsc --strict)    →  0 errors
```

## The Three Delta Requirements (all ALREADY SATISFIED)

### A — 4-source config merge (`readConfig`, §4.6)
- `SETTINGS_KEY = "fileInjector"` at `file-injector.ts:171`
- `readConfig()` at lines 184–217 reads 4 sources in precedence order:
  1. Global `~/.pi/agent/settings.json` → `fileInjector` key (line 209)
  2. Global `~/.pi/agent/file-injector.json` (line 210)
  3. Project `<cwd>/.pi/settings.json` → `fileInjector` key, **trusted only** (line 213)
  4. Project `<cwd>/.pi/file-injector.json`, **trusted only** (line 214)
- Trust gate `ctx.isProjectTrusted()` wraps BOTH project sources (line 211)
- Missing/malformed source → `{}` without throwing (helpers at lines 187–206)
- **Tests**: `file-injector.test.mjs` T2.S1-e/-f/-g

### B — Depth-uniform markdown resolution (§4.5 rule 5 + §4.6)
- `injectMarkdown()` at line 838 — **no `depth` parameter**, resolution is unconditional
- `const dir = path.dirname(abs)` at line 842 — base dir is ALWAYS the importing file's directory
- NO reference to `ctx.cwd` in the resolution path; NO cwd fallback
- `bareAt: state.bareAt` passed identically at every depth (line 849)
- **Tests**: `relative-imports.test.mjs` A1/A7/A9/C1/C2; `import-behavior.test.mjs`

### C — Sync (§8/§9/§10/§11/§12)
- `SETTINGS_KEY` constant in constants list (line 171)
- §9 `readConfig` pseudocode matches the 4-source merge
- §10 edge rows added; §11 test matrix now #1–#32; §12 note #19 updated
- `relative-imports.test.mjs` exists and passes (38 cases)
- **All verified green**

## Known Stale Doc (the one actionable defect)

- **`PRD.md:1189`** (Done-definition, Appendix A): says "all **24** manual test cases" but §11 now
  lists **32** cases (#1–#32, no gaps). Should read "all **32**".
- This is the **only** test-count "24" in PRD.md. The other "24" at `PRD.md:971` is row #24 (a row
  index, not a count) — correct as-is.

## README + JSDoc Coherence (no drift found)

- `README.md:88–117` (`### Optional: bare-@ markdown imports`):
  - Documents BOTH config forms (dedicated file + settings.json key) ✓
  - Lists all 4 precedence locations ✓
  - States the trust gate ✓
  - States depth-uniform resolution ✓
- `readConfig` JSDoc (lines 167–183) documents all 4 sources, precedence, trust gate, SETTINGS_KEY form ✓
- `injectMarkdown` JSDoc documents `dirname(abs)` resolution + `bareAt` threading ✓

## Constraint Conflict Note

The system prompt forbids the task-breakdown agent from modifying `PRD.md`. The delta PRD §5
explicitly requests updating `PRD.md:1189`. The fix is planned as a downstream subtask; this agent
does not execute it. The delta PRD is the authoritative requirement source.
