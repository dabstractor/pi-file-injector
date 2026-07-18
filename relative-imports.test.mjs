// relative-imports.test.mjs — regression suite for file-relative markdown imports + first-level bare-@.
//
// WHY THIS FILE EXISTS
//   Two classes of bug were reported against `#@file` markdown transitive imports. Both are pinned here
//   as hard regression guards so they can never come back:
//
//   BUG CLASS 1 — RELATIVE RESOLUTION. Every `[#]@path` inside a delivered `.md`/`.markdown` must resolve
//     relative to THAT file's directory (dirname(abs)), NEVER relative to ctx.cwd. So
//     `Read #@directory/otherdir/some/file.md` whose body contains `#@file2.md` must look in
//     `./directory/otherdir/some/file2.md`, NOT in `./file2.md`. (Absolute / tilde imports inside a
//     markdown are ignored and left verbatim — markdown is relative-only.)
//
//   BUG CLASS 2 — FIRST-LEVEL BARE-@. With `markdownBareAtImports: true`, a bare `@path` (no `#`) must be
//     honored in EVERY delivered markdown file — including the FIRST one (the file the top-level `#@`
//     token points at), and at every depth thereafter. The reported symptom was an asymmetry: the first
//     imported file's bare `@` was ignored while deeper files' bare `@` worked. (The top-level USER PROMPT
//     always requires full `#@` — that is NOT in dispute and is pinned as a regression guard in Group E.)
//
// LAYERS
//   A. resolveImportPath  — the resolution primitive (baseDir-relative, exact→.md→.markdown ladder).
//   B. scanTokens         — baseDir-parameterized scanning + the bare-@ union + relative-only/code guards.
//   C. injectFiles        — end-to-end relative resolution (the realistic path; BUG CLASS 1).
//   D. injectFiles+handler — first-level bare-@ at every depth (BUG CLASS 2), incl. the real input handler
//                            with a hermetic project config (proves the config→bareAt→state wiring).
//   E. regression guards  — top-level behavior is unchanged (cwd-relative, #@-only, abs/tilde allowed).
//
// RUN
//   node ./relative-imports.test.mjs      # exits 0 on success, 1 on any failure.
//
// Each case builds a FRESH tmp tree with UNIQUE content markers per file so an assertion can tell
// EXACTLY which physical file was chosen (file-relative vs cwd-relative). No case depends on the real
// `~/.pi/agent` config — the handler cases write a project-local `.pi/file-injector.json` into the tmp repo.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// ── load the REAL committed extension exactly like the main suite does ──
const PIPKG = execSync("npm root -g").toString().trim() + "/@earendil-works/pi-coding-agent";
const { createJiti } = await import(PIPKG + "/node_modules/jiti/lib/jiti.mjs");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": PIPKG + "/dist/index.js",
    "@earendil-works/pi-ai": PIPKG + "/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "@earendil-works/pi-tui": PIPKG + "/node_modules/@earendil-works/pi-tui/dist/index.js",
  },
});
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const mod = await jiti.import(path.resolve(SCRIPT_DIR, "file-injector.ts"));

// ── tiny assertion harness (zero-dep, matches the repo convention) ──
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      → ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// ── fixture + run helpers ──
// mk(root, "a/b.md", body) → writes root/a/b.md (mkdir -p), returns the absolute path.
const mk = (root, rel, body) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};
const newRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "relimp-"));
const ctxFor = (cwd, extra = {}) => ({ cwd, hasUI: false, isProjectTrusted: () => true, ui: { notify: () => {} }, ...extra });
// Direct pipeline call. bareAt defaults to false (top-level is #@-only); pass true for the bare-@ cases.
const run = async (cwd, prompt, bareAt = false) => mod.injectFiles(prompt, [], ctxFor(cwd), bareAt);
const has = (text, marker) => (text ?? "").includes(marker);
// Extract every <file name="ABS"> as a path RELATIVE to root (cwd-relative strings are easy to read).
const blocksRel = (text, root) =>
  [...(text ?? "").matchAll(/<file name="([^"]+)">/g)].map((m) => path.relative(root, m[1]));
// Count <file name="ABS"> occurrences for a given absolute path.
const countAbs = (text, abs) =>
  (text.match(new RegExp('<file name="' + abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">', "g")) || []).length;
// Join the result's blocks into one string for block-content reads (blocks left out.text in P1.M1).
const blocksText = (r) => (r?.blocks ?? []).join("\n\n");

// Capture the factory's handlers for the REAL input path (session_start loads cfg → input derives bareAt).
function captureHandlers() {
  const cbs = { input: [], session_start: [], before_agent_start: [] };
  mod.default({ on: (ev, cb) => { cbs[ev]?.push(cb); }, registerMessageRenderer: () => {} });
  return cbs;
}

// Sanity: prove we loaded the real shipped module.
assert(typeof mod.injectFiles === "function", "mod.injectFiles must be a function");
assert(typeof mod.resolveImportPath === "function", "mod.resolveImportPath must be a function");
assert(typeof mod.scanTokens === "function", "mod.scanTokens must be a function");

// ════════════════════════════════════════════════════════════════════════════
// GROUP A — resolveImportPath (the primitive): baseDir-relative resolution.
// The single invariant under test: resolution is against `baseDir`, and when baseDir is absolute
// (always true in practice — it is dirname(abs)) it is INDEPENDENT of process.cwd().
// ════════════════════════════════════════════════════════════════════════════
console.log("\nGROUP A — resolveImportPath: baseDir-relative resolution");

await test("A1: same name in baseDir AND cwd → baseDir copy wins (the core disambiguation)", async () => {
  const root = newRoot();
  mk(root, "nested/x.md", "NESTED-X");      // baseDir-relative (correct)
  mk(root, "x.md", "ROOT-X");                // cwd-relative (wrong)
  const nestedDir = path.join(root, "nested");
  const r = await mod.resolveImportPath("x.md", nestedDir, true);
  assert(r === path.join(root, "nested", "x.md"),
    `expected nested/x.md (baseDir-relative), got ${r}. THIS IS THE BUG: cwd-relative resolution.`);
  assert(!has(r ?? "", "ROOT"), "must not resolve to the cwd-root copy");
});

await test("A2: extension shorthand .md relative to baseDir (only nested/api.md exists)", async () => {
  const root = newRoot();
  mk(root, "nested/api.md", "NESTED-API");
  mk(root, "api.md", "ROOT-API");            // must NOT win
  const r = await mod.resolveImportPath("api", path.join(root, "nested"), true);
  assert(r === path.join(root, "nested", "api.md"), `expected nested/api.md via shorthand, got ${r}`);
});

await test("A3: .markdown second-tier fallback relative to baseDir", async () => {
  const root = newRoot();
  mk(root, "nested/only.markdown", "NESTED-MARKDOWN");
  const r = await mod.resolveImportPath("only", path.join(root, "nested"), true);
  assert(r === path.join(root, "nested", "only.markdown"), `expected nested/only.markdown, got ${r}`);
});

await test("A4: exact-match wins over shorthand, relative to baseDir", async () => {
  const root = newRoot();
  mk(root, "nested/guide", "NESTED-BARE");   // exact wins
  mk(root, "nested/guide.md", "NESTED-MD");  // must NOT win
  const r = await mod.resolveImportPath("guide", path.join(root, "nested"), true);
  assert(r === path.join(root, "nested", "guide"), `exact bare guide must win, got ${r}`);
});

await test("A5: ../ up-and-over resolves relative to baseDir", async () => {
  const root = newRoot();
  mk(root, "shared/s.md", "SHARED");
  const r = await mod.resolveImportPath("../shared/s.md", path.join(root, "nested"), true);
  assert(r === path.join(root, "shared", "s.md"), `../ must resolve up-and-over from baseDir, got ${r}`);
});

await test("A6: nested subpath resolves relative to baseDir", async () => {
  const root = newRoot();
  mk(root, "nested/deep/f.md", "DEEP");
  const r = await mod.resolveImportPath("deep/f.md", path.join(root, "nested"), true);
  assert(r === path.join(root, "nested", "deep", "f.md"), `subpath must resolve under baseDir, got ${r}`);
});

await test("A7: missing token → null with NO cwd fallback (a same-named root file must NOT be chosen)", async () => {
  const root = newRoot();
  mk(root, "ghost.md", "ROOT-GHOST");        // exists at cwd-root only
  const r = await mod.resolveImportPath("ghost.md", path.join(root, "nested"), true);
  assert(r === null, `missing-in-baseDir must return null, NOT fall back to cwd-root. got ${r}`);
});

await test("A8: tryMdExt:false → no shorthand (top-level exact-only contract)", async () => {
  const root = newRoot();
  mk(root, "nested/api.md", "X");
  const r = await mod.resolveImportPath("api", path.join(root, "nested"), false);
  assert(r === null, `tryMdExt:false must never fall back to .md (top-level is exact-only), got ${r}`);
});

await test("A9: resolution is independent of process.cwd() when baseDir is absolute", async () => {
  const root = newRoot();
  mk(root, "nested/f.md", "F");
  const baseDir = path.join(root, "nested");
  const beforeCwd = process.cwd();
  let fromOther, fromOrig;
  try {
    process.chdir(os.tmpdir());              // run from an UNRELATED cwd
    fromOther = await mod.resolveImportPath("f.md", baseDir, true);
  } finally {
    process.chdir(beforeCwd);
    fromOrig = await mod.resolveImportPath("f.md", baseDir, true);
  }
  assert(fromOther === path.join(baseDir, "f.md") && fromOther === fromOrig,
    `absolute baseDir resolution must not consult process.cwd(); got other=${fromOther}, orig=${fromOrig}`);
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP B — scanTokens: baseDir-parameterized scanning + guards.
// Proves the records carry abs paths resolved against `baseDir`, the relative-only + code-exempt
// guards fire, and the bare-@ union (bareAt:true) also resolves baseDir-relative.
// ════════════════════════════════════════════════════════════════════════════
console.log("\nGROUP B — scanTokens: baseDir-parameterized scan + guards");

const blankState = () => ({ blocks: [], images: [], injectedSet: new Set(), remaining: null, count: 0, paged: 0 });

await test("B1: #@b.md resolves to baseDir/b.md (record.abs is baseDir-relative)", async () => {
  const root = newRoot();
  mk(root, "dir/b.md", "B");
  mk(root, "b.md", "ROOT-B");                // must NOT win
  const recs = await mod.scanTokens("See #@b.md.", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: false }, blankState());
  assert(recs.length === 1 && recs[0].abs === path.join(root, "dir", "b.md"),
    `expected 1 record at dir/b.md, got ${JSON.stringify(recs.map((r) => r.abs))}`);
});

await test("B2: relative-only guard — #@/abs/... ignored when allowAbsTilde:false", async () => {
  const root = newRoot();
  mk(root, "abs.md", "X");
  const recs = await mod.scanTokens("See #@/abs.md.", root,
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: false }, blankState());
  assert(recs.length === 0, `absolute import must be ignored in markdown (relative-only); got ${recs.length}`);
});

await test("B3: relative-only guard — #@~/x ignored when allowAbsTilde:false", async () => {
  const recs = await mod.scanTokens("See #@~/x.md.", newRoot(),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: false }, blankState());
  assert(recs.length === 0, `tilde import must be ignored in markdown (relative-only); got ${recs.length}`);
});

await test("B4: bare @b.md (bareAt:true) resolves baseDir-relative too", async () => {
  const root = newRoot();
  mk(root, "dir/b.md", "B");
  mk(root, "b.md", "ROOT-B");
  const recs = await mod.scanTokens("See @b.md.", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: true }, blankState());
  assert(recs.length === 1 && recs[0].abs === path.join(root, "dir", "b.md"),
    `bare @ must resolve baseDir-relative; got ${JSON.stringify(recs.map((r) => r.abs))}`);
});

await test("B5: dedup within a single scan (same abs recorded once)", async () => {
  const root = newRoot();
  mk(root, "dir/b.md", "B");
  const recs = await mod.scanTokens("See #@b.md and #@b.md again.", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: false }, blankState());
  assert(recs.length === 1, `duplicate token must dedup to one record; got ${recs.length}`);
});

await test("B6: prefixLen is correct (2 for #@, 1 for bare @)", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A"); mk(root, "dir/b.md", "B");
  const recs = await mod.scanTokens("#@a.md then @b.md", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: true }, blankState());
  const a = recs.find((r) => r.abs.endsWith("a.md"));
  const b = recs.find((r) => r.abs.endsWith("b.md"));
  assert(a && a.prefixLen === 2, `#@ must carry prefixLen 2; got ${a && a.prefixLen}`);
  assert(b && b.prefixLen === 1, `bare @ must carry prefixLen 1; got ${b && b.prefixLen}`);
});

await test("B7: code-exempt — #@b.md inside a fenced code block yields no record", async () => {
  const root = newRoot();
  mk(root, "dir/b.md", "B");
  const recs = await mod.scanTokens("```\n#@b.md\n```\n", path.join(root, "dir"),
    { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: false }, blankState());
  assert(recs.length === 0, `#@ inside a fenced block must be code-exempt; got ${recs.length}`);
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP C — injectFiles end-to-end: RELATIVE RESOLUTION (BUG CLASS 1).
// The realistic path. Every case builds a fresh tree with UNIQUE markers so we can assert WHICH
// physical file was chosen. The wrong (cwd-root) copy ALWAYS also exists to catch any cwd leak.
// ════════════════════════════════════════════════════════════════════════════
console.log("\nGROUP C — injectFiles: relative resolution (BUG CLASS 1)");

await test("C1: nested file imports same-name file → file-relative copy wins, cwd-root copy loses", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A-MARKER\n\nSee #@b.md.\n");
  mk(root, "dir/b.md", "B-FILE-RELATIVE");   // correct target (the importing file's dir)
  mk(root, "b.md", "B-CWD-ROOT");            // wrong target (cwd) — must NEVER be injected
  const out = await run(root, "Read #@dir/a.md");
  assert(has(blocksText(out), "B-FILE-RELATIVE"), `expected dir/b.md (file-relative); marker absent. injected=${out.injected}`);
  assert(!has(blocksText(out), "B-CWD-ROOT"), "BUG: resolved the cwd-root copy — that is cwd resolution, NOT file-relative");
  assert(countAbs(blocksText(out), path.join(root, "b.md")) === 0, "cwd-root b.md must have ZERO blocks");
});

await test("C2: user's exact deep scenario — #@directory/otherdir/some/file.md → #@file2.md resolves in that dir", async () => {
  const root = newRoot();
  mk(root, "directory/otherdir/some/file.md", "Parent\n\nSee #@file2.md.\n");
  mk(root, "directory/otherdir/some/file2.md", "FILE2-CORRECT");  // file-relative (correct)
  mk(root, "file2.md", "FILE2-WRONG-CWD");                        // cwd-root (wrong)
  const out = await run(root, "Read #@directory/otherdir/some/file.md");
  assert(has(blocksText(out), "FILE2-CORRECT"), `nested relative import must resolve in the importing file's dir; injected=${out.injected}`);
  assert(!has(blocksText(out), "FILE2-WRONG-CWD"), "BUG: the cwd-root file2.md was chosen instead of the file-relative one");
});

await test("C3: #@../sibling.md from a nested file resolves up-and-over (relative to the importing file)", async () => {
  const root = newRoot();
  mk(root, "dir/inner.md", "Inner\n\nSee #@../sibling.md.\n");
  mk(root, "sibling.md", "SIBLING-UP-AND-OVER");
  const out = await run(root, "Read #@dir/inner.md");
  assert(has(blocksText(out), "SIBLING-UP-AND-OVER"), `../ from the importing file's dir must resolve; injected=${out.injected}`);
});

await test("C4: multi-level chain — each level resolves relative to its OWN dir; a root same-name file never wins", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A\n\n#@b.md\n");
  mk(root, "dir/b.md", "B\n\n#@c.md\n");
  mk(root, "dir/c.md", "C-DEEP");            // correct chain target
  mk(root, "c.md", "C-ROOT");                // wrong: must never win at any level
  const out = await run(root, "Read #@dir/a.md");
  assert(has(blocksText(out), "C-DEEP"), `chain must reach dir/c.md; injected=${out.injected}`);
  assert(!has(blocksText(out), "C-ROOT"), "BUG: a root same-name file leaked into the chain — level was resolved cwd-relative");
});

await test("C5: extension shorthand from a nested dir (#@api → nested/api.md, NOT root/api.md)", async () => {
  const root = newRoot();
  mk(root, "dir/notes.md", "Notes\n\n#@api\n");
  mk(root, "dir/api.md", "API-NESTED");
  mk(root, "api.md", "API-ROOT");
  const out = await run(root, "Read #@dir/notes.md");
  assert(has(blocksText(out), "API-NESTED"), `shorthand must resolve nested/api.md; injected=${out.injected}`);
  assert(!has(blocksText(out), "API-ROOT"), "BUG: shorthand fell back to the cwd-root api.md");
});

await test("C6: .markdown fallback from a nested dir", async () => {
  const root = newRoot();
  mk(root, "dir/notes.md", "Notes\n\n#@api\n");
  mk(root, "dir/api.markdown", "API-MARKDOWN-NESTED");
  const out = await run(root, "Read #@dir/notes.md");
  assert(has(blocksText(out), "API-MARKDOWN-NESTED"), `.markdown fallback must resolve relative to the nested dir; injected=${out.injected}`);
});

await test("C7: cwd independence — absolute top-level token + nested relative import resolves file-relative", async () => {
  const root = newRoot();
  mk(root, "dir/parent.md", "Parent\n\n#@child.md\n");
  mk(root, "dir/child.md", "CHILD-FILE-RELATIVE");
  // ctx.cwd points ELSEWHERE (an unrelated dir) so the top-level token must be ABSOLUTE to resolve,
  // and the nested #@child.md must STILL resolve relative to dir/ (the importing file's dir).
  const elsewhere = newRoot();
  const out = await run(elsewhere, "Read #@" + path.join(root, "dir", "parent.md"));
  assert(has(blocksText(out), "CHILD-FILE-RELATIVE"),
    `nested import must resolve file-relative regardless of ctx.cwd; injected=${out.injected}`);
});

await test("C8: code-exempt — a #@file inside a fenced/inline code span in a nested md is NOT imported (no cwd leak)", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A\n\n```\n#@b.md\n```\n");
  mk(root, "dir/b.md", "B-NESTED");          // would be the file-relative target
  mk(root, "b.md", "B-ROOT");                // would be the cwd-leak target
  const out = await run(root, "Read #@dir/a.md");
  assert(!has(blocksText(out), "B-NESTED") && !has(blocksText(out), "B-ROOT"),
    `a #@ inside code must be inert — neither nested nor root copy may be injected; injected=${out.injected}`);
  assert(out.injected === 1, `only a.md itself; got injected=${out.injected}`);
});

await test("C9: missing relative import → verbatim marker, NO cwd fallback to a same-named root file", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A\n\nSee #@ghost.md.\n");
  mk(root, "ghost.md", "GHOST-ROOT");        // exists at cwd-root ONLY; must NOT be chosen as a fallback
  const out = await run(root, "Read #@dir/a.md");
  assert(has(blocksText(out), "#@ghost.md"), "the missing relative-import marker must be left VERBATIM");
  assert(!has(blocksText(out), "GHOST-ROOT"), "BUG: missing-in-dir import fell back to the cwd-root same-name file");
  assert(out.injected === 1, `only a.md; got injected=${out.injected}`);
});

await test("C10: dedup across subtrees — a shared dependency imported from two nested files is injected once", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A\n\n#@shared.md\n");
  mk(root, "dir/b.md", "B\n\n#@shared.md\n");
  mk(root, "dir/shared.md", "SHARED-ONCE");
  mk(root, "index.md", "Index\n\n#@dir/a.md\n#@dir/b.md\n");
  const out = await run(root, "Read #@index.md");
  assert(countAbs(blocksText(out), path.join(root, "dir", "shared.md")) === 1,
    `shared.md must be injected exactly once across both subtrees; blocks=${blocksRel(blocksText(out), root)}`);
});

await test("C11: cycle terminates — a.md→b.md→a.md resolves file-relative and stops (dedup-bounded)", async () => {
  const root = newRoot();
  mk(root, "dir/a.md", "A\n\n#@b.md\n");
  mk(root, "dir/b.md", "B\n\n#@a.md\n");
  const out = await run(root, "Read #@dir/a.md");
  assert(countAbs(blocksText(out), path.join(root, "dir", "a.md")) === 1, "a.md injected once (cycle dedups)");
  assert(countAbs(blocksText(out), path.join(root, "dir", "b.md")) === 1, "b.md injected once");
});

await test("C12: relative import resolving OUTSIDE cwd but inside the importing file's parent (../shared) is allowed", async () => {
  const root = newRoot();
  mk(root, "sub/host.md", "Host\n\n#@../shared/lib.md\n");
  mk(root, "shared/lib.md", "LIB-OUTSIDE-CWD"); // outside cwd-relative-to-subdir, inside host's parent's sibling
  const out = await run(root, "Read #@sub/host.md");
  assert(has(blocksText(out), "LIB-OUTSIDE-CWD"), `../shared import relative to the importing file must be allowed; injected=${out.injected}`);
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP D — FIRST-LEVEL BARE-@ (BUG CLASS 2): markdownBareAtImports on.
// With the setting ON, a bare `@path` is honored in EVERY delivered markdown file — INCLUDING the
// first (the file the top-level #@ token points at). The reported asymmetry (first needs #@, deeper
// accept @) is the bug these cases pin.
// ════════════════════════════════════════════════════════════════════════════
console.log("\nGROUP D — first-level bare-@ (BUG CLASS 2): markdownBareAtImports on");

await test("D1: the user's exact case — first imported file uses bare @ → honored (full imp chain)", async () => {
  const root = newRoot();
  mk(root, "main.md", "Main imports #@imp1.md.\n");     // full #@ at the chain entry
  mk(root, "main2.md", "Main imports @imp1.md\n");      // BARE @ at the chain entry (the bug)
  mk(root, "imp1.md", "Imp1 imports @imp2.md and @imp3.md\n");
  mk(root, "imp2.md", "Imp2 no import\n");
  mk(root, "imp3.md", "Imp3 imports #@imp1.md\n");
  // main2.md (bare-@ entry) must pull in the SAME chain as main.md (#@ entry).
  const out = await run(root, "Check out #@main2.md", true);
  const got = blocksRel(blocksText(out), root).sort();
  assert(JSON.stringify(got) === JSON.stringify(["imp1.md", "imp2.md", "imp3.md", "main2.md"]),
    `bare-@ entry must import the whole chain; got [${got.join(", ")}]. injected=${out.injected}`);
});

await test("D2: bare @ works at EVERY depth (no first-level asymmetry): @→@→@", async () => {
  const root = newRoot();
  mk(root, "a.md", "A-MARKER\n\n@b.md\n");              // depth-0 file, bare @
  mk(root, "b.md", "B-MARKER\n\n@c.md\n");              // depth-1 file, bare @
  mk(root, "c.md", "C-MARKER");                         // depth-2 leaf
  const out = await run(root, "#@a.md", true);
  assert(has(blocksText(out), "A-MARKER") && has(blocksText(out), "B-MARKER") && has(blocksText(out), "C-MARKER"),
    `bare @ must work at depth 0→1 too. A=${has(blocksText(out),"A-MARKER")} B=${has(blocksText(out),"B-MARKER")} C=${has(blocksText(out),"C-MARKER")}. injected=${out.injected}`);
});

await test("D3: first-level bare-@ COMBINED with relative resolution (nested first file, bare @, relative target)", async () => {
  const root = newRoot();
  mk(root, "dir/entry.md", "Entry\n\n@nested-target.md\n"); // depth-0 file in a subdir, bare @, RELATIVE target
  mk(root, "dir/nested-target.md", "NESTED-RELATIVE");      // correct (file-relative)
  mk(root, "nested-target.md", "ROOT-RELATIVE");            // wrong (cwd) — must NOT win
  const out = await run(root, "#@dir/entry.md", true);
  assert(has(blocksText(out), "NESTED-RELATIVE"), `first-level bare @ must resolve file-relative; injected=${out.injected}`);
  assert(!has(blocksText(out), "ROOT-RELATIVE"), "BUG: first-level bare @ resolved cwd-relative instead of file-relative");
});

await test("D4: setting OFF → bare @ is inert in the first AND every imported file (only #@ imports)", async () => {
  const root = newRoot();
  mk(root, "a.md", "A-MARKER\n\n@b.md\n");              // bare @, setting OFF → must NOT import
  mk(root, "b.md", "B-MARKER");
  const out = await run(root, "#@a.md", false);
  assert(!has(blocksText(out), "B-MARKER"), `with markdownBareAtImports OFF, bare @ in markdown must be inert`);
  assert(out.injected === 1, `only a.md; got injected=${out.injected}`);
});

// D5/D6 exercise the REAL input handler with a HERMETIC project config (no reliance on ~/.pi/agent).
// This is the exact path that broke: session_start loads cfg → input derives bareAt → state.bareAt →
// the FIRST imported file's scan. Writing .pi/file-injector.json into the tmp repo makes cfg hermetic
// (project source overrides global in readConfig's merge order).
async function runViaHandler(root, prompt) {
  const cbs = captureHandlers();
  for (const cb of cbs.session_start) await cb({}, { cwd: root, isProjectTrusted: () => true });
  const out = await cbs.input[0]({ text: prompt, source: "interactive", images: [] }, ctxFor(root));
  const msg = cbs.before_agent_start ? await cbs.before_agent_start[0]({}, ctxFor(root)) : undefined;
  return { out, msg };
}

await test("D5: real handler + hermetic project config ON → first-level bare @ honored end-to-end", async () => {
  const root = newRoot();
  mk(root, "main2.md", "Main imports @imp1.md\n");      // first-level BARE @ (the bug trigger)
  mk(root, "imp1.md", "Imp1 imports @imp2.md\n");
  mk(root, "imp2.md", "Imp2 leaf\n");
  mk(root, ".pi/file-injector.json", JSON.stringify({ markdownBareAtImports: true })); // hermetic ON
  const { out, msg } = await runViaHandler(root, "Check out #@main2.md");
  assert(out.action === "transform", `handler must transform; got ${out.action}`);
  const got = blocksRel(msg.message.content, root).sort();
  assert(JSON.stringify(got) === JSON.stringify(["imp1.md", "imp2.md", "main2.md"]),
    `handler with cfg ON must honor the first-level bare @; got [${got.join(", ")}]`);
});

await test("D6: real handler counts EVERY file across a bare-@ chain in the notify message", async () => {
  const root = newRoot();
  mk(root, "main2.md", "Main imports @imp1.md\n");
  mk(root, "imp1.md", "Imp1 imports @imp2.md and @imp3.md\n");
  mk(root, "imp2.md", "Imp2\n");
  mk(root, "imp3.md", "Imp3\n");
  mk(root, ".pi/file-injector.json", JSON.stringify({ markdownBareAtImports: true }));
  let notified = null;
  const cbs = captureHandlers();
  for (const cb of cbs.session_start) await cb({}, { cwd: root, isProjectTrusted: () => true });
  await cbs.input[0]({ text: "Check out #@main2.md", source: "interactive", images: [] },
    ctxFor(root, { hasUI: true, ui: { notify: (m) => { notified = m; } } }));
  // 4 files delivered whole (main2, imp1, imp2, imp3); none paged.
  assert(notified === "#@ injected 4 whole", `notify must count all 4 files; got ${JSON.stringify(notified)}`);
});

await test("D7: real handler + hermetic project config OFF → first-level bare @ inert (only #@ imports)", async () => {
  const root = newRoot();
  mk(root, "main2.md", "Main imports @imp1.md\n");
  mk(root, "imp1.md", "Imp1\n");
  mk(root, ".pi/file-injector.json", JSON.stringify({ markdownBareAtImports: false })); // hermetic OFF
  const { out, msg } = await runViaHandler(root, "Check out #@main2.md");
  const got = blocksRel(msg.message.content, root);
  assert(JSON.stringify(got) === JSON.stringify(["main2.md"]),
    `with cfg OFF the handler must not honor bare @; got [${got.join(", ")}]`);
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP E — regression guards: top-level behavior is UNCHANGED.
// The fixes are scoped to markdown transitive imports. The TOP-LEVEL user prompt must stay:
//   cwd-relative (not file-relative — there is no file), #@-only (bare @ never injected), and must
//   still allow absolute / tilde tokens (contrast with markdown's relative-only rule).
// ════════════════════════════════════════════════════════════════════════════
console.log("\nGROUP E — regression: top-level behavior unchanged");

await test("E1: top-level user token is cwd-relative (#@a.md resolves against ctx.cwd)", async () => {
  const root = newRoot();
  mk(root, "a.md", "TOP-LEVEL-A");
  // ctx.cwd is `root`; there is no "importing file", so resolution MUST be against root (cwd).
  const out = await run(root, "Read #@a.md");
  assert(has(blocksText(out), "TOP-LEVEL-A"), `top-level #@a.md must resolve against cwd; injected=${out.injected}`);
});

await test("E2: top-level bare @ is NEVER injected even with bareAt on (prompt is #@-only forever)", async () => {
  const root = newRoot();
  mk(root, "a.md", "A-SHOULD-NOT-INJECT");
  const out = await run(root, "Read @a.md", true);   // bare @ at the PROMPT, bareAt on
  assert(!has(blocksText(out), "A-SHOULD-NOT-INJECT"), `a bare @ in the PROMPT must never be injected (markdown-only opt-in)`);
  assert(out.injected === 0, `nothing should be injected; got injected=${out.injected}`);
});

await test("E3: top-level absolute and tilde tokens ARE allowed (contrast with markdown relative-only)", async () => {
  const root = newRoot();
  mk(root, "abs.md", "ABS-OK");
  const out = await run(root, "Read #@" + path.join(root, "abs.md"));
  assert(has(blocksText(out), "ABS-OK"), `top-level absolute paths must resolve (only markdown is relative-only); injected=${out.injected}`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────\nResult: ${passed} passed, ${failed} failed\n────────────────────────────────────────`);
process.exit(failed ? 1 : 0);
