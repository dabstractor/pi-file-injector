# Research Notes — P1.M1.T1.S1 (package.json dependencies + npm install)

Date: collected during PRP creation. All facts below were directly verified.

## 1. Current state of package.json (verified by `read`)

- Repo-root `package.json` exists. It has **NO `dependencies` block**.
- Top-level keys present: `name`, `version` (0.1.2), `description`, `author`, `license` (MIT),
  `type` (module), `main`, `exports`, `repository`, `homepage`, `bugs`, `keywords`, `files`,
  `pi`, `scripts`, `peerDependencies`, `peerDependenciesMeta`.
- `peerDependencies`: exactly 3 entries — `@earendil-works/pi-ai`, `pi-coding-agent`, `pi-tui`, all `*`.
- `peerDependenciesMeta`: all 3 marked `optional: true`.
- `files`: `[ "file-injector.ts", "README.md", "LICENSE" ]`.
- `scripts`: `typecheck` (node ./scripts/typecheck.mjs), `test` (runs 3 .mjs harnesses),
  `prepublishOnly` (npm run typecheck).

## 2. Current install state (verified by `ls`)

- **No `package-lock.json`** at repo root → `npm install` will create it fresh.
- **No `node_modules/`** at repo root → `npm install` will populate it fresh.
- npm 11.18.0; node v26.7.0. → lockfileVersion 3 expected.

## 3. .gitignore (verified by `read`)

- Line 2: `node_modules/` → ignored (will not be staged by `npm install`). ✓
- `package-lock.json` is **NOT** ignored → SHOULD be committed (standard npm practice). ✓
- `plan/` is not in .gitignore (correct — never add plan/PRD/task files to gitignore).

## 4. Test-harness alias map — the "why real deps" rationale (verified by `read`)

`file-injector.test.mjs` lines 31–44: `createJiti(import.meta.url, { alias: { ... } })` aliases
only the 3 `@earendil-works/*` packages to absolute paths under the global pi package. There
are **NO alias entries** for defuddle, linkedom, turndown, mathml-to-latex, or temml. Therefore
those packages MUST resolve as ordinary `node_modules` lookups from the repo root → they must be
real installed deps. (Confirms item_description point 1.)

## 5. Version-range resolution (verified against npm registry via `npm view <pkg> version`)

| Package          | Specified range | Latest on registry | Resolves to (^) |
| ---------------- | --------------- | ------------------ | --------------- |
| defuddle         | ^0.19.2         | 0.19.2             | 0.19.2          |
| linkedom         | ^0.18.12        | 0.18.13            | 0.18.13         |
| turndown         | ^7.2.0          | 7.2.4              | 7.2.4           |
| mathml-to-latex  | ^1.8.0          | 1.8.0              | 1.8.0           |
| temml            | ^0.13.3         | 0.13.4             | 0.13.4          |

All 5 ranges are valid and resolve. `^` on 0.x pins the minor (e.g. `^0.18.12` → `>=0.18.12
<0.19.0`), so linkedom/temml/defuddle install their latest 0.x minor while turndown (1.x+
semver major) and mathml-to-latex install within their major. Exact installed versions are
pinned in the generated `package-lock.json`.

## 6. Why hard deps (not defuddle's optionalDependencies) — rationale sources

- PRD h2.19 "5. Dependencies": explicitly makes all 5 hard `dependencies` of THIS package.
- `plan/010_8645157f3bf5/architecture/external_deps.md` §1 ("Dependencies in defuddle's own
  package.json"): defuddle lists linkedom/turndown/mathml-to-latex/temml as ITS
  optionalDependencies. This package promotes them to hard deps for (1) explicit reliability
  and (2) the test-harness jiti alias map gap (note 4 above).

## 7. Key entrypoint files to verify after install (from external_deps.md §1 & §2)

- `node_modules/defuddle/dist/node.js` — the entrypoint for `import { Defuddle } from
  "defuddle/node"` (exports map `"./node" -> "./dist/node.js"`). `.d.ts` shipped at
  `dist/node.d.ts` (→ M1.T1.S4 shim likely unnecessary).
- `node_modules/linkedom/esm/index.js` — linkedom runtime; `parseHTML` exported from here.
  Types shipped at `types/esm/index.d.ts`.
- turndown / mathml-to-latex / temml: used only transitively by defuddle; no direct import in
  our code, so no `.d.ts` concern for us.

## 8. Scope boundaries (from plan/010 tasks.json)

- This subtask (S1): package.json deps block + npm install ONLY.
- S2: FileInjectorConfig + enableUrls. S3: URL regexes. S4: typecheck-shim decision.
- T2.S1: writes the `injectUrl` TS pipeline (the actual `import { Defuddle }`/`parseHTML`).
- M2.T2.S1: README #<url> section (the only docs change in P1).

## Subagent calls used

- 0 external subagent calls needed — this is a fully-deterministic manifest task; the
  authoritative research already exists in `architecture/external_deps.md`, the file to edit
  was read directly, the alias-map rationale was read directly, and the version ranges were
  verified against the live npm registry in one `npm view` loop. (Well under the 3–5 budget;
  over-researching a JSON-edit task would waste tokens.)