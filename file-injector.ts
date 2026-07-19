import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, highlightCode, getLanguageFromPath, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { Box, Text, type Component } from "@earendil-works/pi-tui";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
/** PRD §4.6 — markdown opt-in bare-`@` imports (the wiki-style `@path` shorthand). The lookbehind forbids a
 *  preceding `#` (so `#@file` is matched ONCE by FILE_INJECT_RE and NEVER here — no double candidate) AND a
 *  preceding word char (letter/digit/underscore — so `user@host.com`, `café@x`, `日本語@x` don't match).
 *  Unicode `\p{}` classes + the `u` flag mirror the shipped FILE_INJECT_RE for consistency. NOT exported.
 *  (PRD §4.6 literal `/(^|(?<=[^\w#]))@(\S+)/g` is the ASCII-equivalent form; this Unicode form is the
 *  recommendation.) Wires into scanTokens via `opts.bareAt` (markdown-only / opt-in, P1.M2). */
const BARE_AT_RE = /(^|(?<![\p{L}\p{N}_#]))@(\S+)/gu;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};
const TRAILING_PUNCT = ".,;:!?\")]}>'";

/** §5.5 — paged-delivery budget constants (defaults pinned by PRD §5.5 "Constants (defaults to pin)"). */
const PAGED_THRESHOLD = 0.6;    // inject whole if fileCost <= PAGED_THRESHOLD * remaining
const MARGIN = 8192;            // safety bytes subtracted from remaining context
const HEAD_CHARS = 8192;        // head block size in UTF-16 code units (matches read tool DEFAULT_MAX_LINES=2000 at ~4 chars/line)
const DEFAULT_RESERVE = 8192;   // fallback for ctx.model?.maxTokens when model is absent
const READ_LIMIT = 2000;        // read tool DEFAULT_MAX_LINES — page size emitted in the directive

/** §5.6.1 — approximate-CommonMark code-region detection (the markdown import exemption, PRD §4.5 rule 3).
 *  INLINE_CODE semantics: a backtick run (the OPENER) closed by a run of the SAME length, non-greedy,
 *    not followed by another backtick. Originally a single regex `/(`+)([\s\S]*?)\1(?!`)/g` run via
 *    content.matchAll; that form is O(n²) on a long unmatched backtick run (the backreference \1 + the
 *    lazy [\s\S]*? force the engine to try every run-length split — ~8s CPU at 200k backticks, reachable
 *    via any `#@file.md`). It is now implemented by the LINEAR-TIME `inlineCodeRanges` helper below, which
 *    produces byte-for-byte identical spans to the regex (verified by 500k randomized fuzz cases) while
 *    bounding the worst case to ~O(n) regardless of run length (200k backticks → ~1ms). An opener-length
 *    cap (`INLINE_CODE_MAX_OPENER`) is applied as defense-in-depth: realistic markdown never uses a
 *    code-span opener longer than a handful of backticks, so capping at 1024 cannot affect any real input
 *    but bounds the (already-linear) opener-retry loop against a hostile file. (PRD §5.6.1 notes the parser
 *    is "approximate"; this is the same approximation, just non-pathological.)
 *  FENCE_OPEN_RE: line-anchored (use against a single line, not full text); 0-3 leading spaces then a
 *    run of >= 3 backticks or tildes. Group 1 = the fence run (char + length drive open/close matching). */
const INLINE_CODE_MAX_OPENER = 1024;               // cap on opener run length (defense-in-depth; see above)
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;      // PRD §5.6.1 (exact form); apply per-line

/** §5.6 / §4.5 — a delivered file whose lowercased ext is md/markdown is an import source (consumed by
 *  the markdown branch T2.S3 adds to injectFile). Defined here so T2.S3 does not re-declare. */
const MD_EXTS = new Set(["md", "markdown"]);

/** §5.6.2 — flat fallback image token cost when resized dimensions are unavailable (raw base64 path).
 *  Derived from the 2000×2000 resize cap worst case: max(1,⌈2000/512⌉)·max(1,⌈2000/512⌉)·170 + 85 =
 *  4·4·170 + 85 = 2805. Consumed by estimateImageTokens (T2.S2). Defined here per the constants cluster. */
const IMAGE_FALLBACK_TOKENS = 2805;

/** F3 — magic-number sniff. Routes by EXTENSION first (PRD §5.2), then validates the ACTUAL
 *  bytes match the declared image type before attaching. A mislabeled file (text body named
 *  `.png`) fails the sniff → falls through to the text/binary path instead of attaching
 *  decoded garbage labeled as an image. Returns true if `buf`'s header matches `mime`. */
export function hasValidImageMagic(buf: Buffer, mime: string): boolean {
  // Common image signatures (first bytes only; a full parser is out of scope for routing).
  if (buf.length < 12) return false;
  switch (mime) {
    case "image/png":
      return (
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
        buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
      );
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/gif":
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38; // "GIF8"
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      );
    case "image/bmp":
      return buf[0] === 0x42 && buf[1] === 0x4d; // "BM"
    default:
      return false;
  }
}

/** PRD §4.3 — trim every trailing char in TRAILING_PUNCT, repeatedly, until none remain. "" if empty. */
export function cleanToken(raw: string): string {
  let s = raw;
  while (s.length > 0 && TRAILING_PUNCT.includes(s[s.length - 1])) {
    s = s.slice(0, -1);
  }
  return s;
}

/** PRD §4.4 — expand leading ~ / ~/ via os.homedir() (resolveReadPath is internal, unexported),
 *  then resolve against cwd. No cwd restriction: absolute, ~, and ../ all allowed. */
export function expandTildeAndResolve(p: string, cwd: string): string {
  let expanded: string;
  if (p === "~") {
    expanded = os.homedir();
  } else if (p.startsWith("~/")) {
    expanded = path.join(os.homedir(), p.slice(2));
  } else {
    expanded = p;
  }
  return path.resolve(cwd, expanded);
}

/** PRD §5.4 / §5.1 — stat the path and return true iff it exists as a regular file. Mirrors the
 *  already-shipped `injectFile` stat+isFile idiom (L458-461): `await fs.stat(p)` rejects on ENOENT,
 *  so the `try/catch → false` is the correct "missing/non-existent" detection. Never throws.
 *  Used by `resolveImportPath` to test candidate paths during scan-time resolution (and, harmlessly,
 *  re-tested by `injectFile`/the markdown Step-3.5 pre-check on the already-resolved abs). */
export async function isRegularFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

/** PRD §4.5 rule 3 — resolve a `#@<token>` import path to an existing regular file's abs path, or null.
 *  Resolution ladder (exact-match ALWAYS wins):
 *    1. expand tilde + resolve(baseDir, token) → `abs` (the existing `expandTildeAndResolve`, NO stat);
 *    2. if `abs` is an existing regular file → return `abs` (exact match wins, e.g. bare `PRD` beats `PRD.md`);
 *    2b. formatting-strip fallback: if the token carries trailing markdown-emphasis GLUE (`*`/`_`) that
 *        `cleanToken` does NOT handle, strip that trailing run, re-clean (to drop a now-exposed trailing
 *        `.`), and retry the EXACT path (`@b.md.*` → `b.md`). This is a NARROWED formatting strip — it is
 *        NOT a `.md`-substring truncation, so a missing `report.md.backup`/`X.md.bak`/`X.md.txt`/`X.md.old`
 *        stays verbatim (exact-only per §4.4/§4.5). `_` inside a name (`my_file.md`) is never stripped —
 *        only a TRAILING run; the re-clean is load-bearing (without it `my_file.md.` would not stat).
 *    3. ONLY when `tryMdExt` is true AND the cleaned token is extensionless (`path.extname(token) === ""`):
 *       try `abs + ".md"`, then `abs + ".markdown"` — first existing regular file wins (`#@PRD` → `PRD.md`);
 *    4. otherwise → `null` (nothing resolved; the caller leaves the `#@` marker verbatim).
 *  `tryMdExt` is `true` for markdown imports (§4.5 shorthand) and `false` for top-level user tokens
 *  (§4.4 exact-only — top-level prompt behavior is byte-for-byte identical to today). Tokens already
 *  ending in `.md`/`.markdown` or any extension are exact-only (`#@PRD.md` never becomes `PRD.md.md`, and
 *  a missing `X.md.bak` is NEVER truncated to `X.md`).
 *  Dotfiles: `path.extname(".env") === ""` technically qualifies for the fallback, BUT exact-match-wins
 *  returns a bare `.env` before the `.md` fallback runs (follows PRD §4.5 literally — no dotfile exclusion).
 *  Pure: only stats paths, never mutates `state` (preserves the scan-then-inject separation for dedup). */
export async function resolveImportPath(
  token: string,
  baseDir: string,
  tryMdExt: boolean,
): Promise<string | null> {
  // Candidate filenames to try, in order (most-specific first). `token` is already cleanToken()'d by the
  // caller, but \S+ can still glue markdown formatting to a .md filename (an italic line like
  // "*see @ARCHITECTURE.md.*" captures "ARCHITECTURE.md.*"). cleanToken only trims TRAILING_PUNCT
  // (.,;:!?")]}>'), so it leaves the emphasis glue chars `*` and `_` untouched. PRD §4.4/§4.5 make a
  // token that already carries an extension EXACT-ONLY (a missing `report.md.backup`/`X.md.bak` must
  // stay verbatim, NEVER truncated to the base `.md`). So instead of cutting at a `.md` substring we
  // NARROW the fallback to a TRAILING run of the actual glue chars (`*`/`_`): strip that run, re-clean
  // (to drop a now-exposed trailing `.` — e.g. `my_file.md.*` → `my_file.md.` → `my_file.md`), and retry
  // the EXACT path. This preserves GROUP-4a–4g (`@b.md.*` → `b.md`) WITHOUT turning `.bak`/`.txt`/`.old`
  // into `.md`. `_` INSIDE a name is never stripped (only a trailing run). The re-clean is load-bearing.
  const candidates: string[] = [token];
  const fmtCut = token.replace(/[*_]+$/, ""); // strip a trailing run of the glue chars cleanToken omits
  if (fmtCut !== token && fmtCut !== "") candidates.push(cleanToken(fmtCut));
  for (const cand of candidates) {
    const abs = expandTildeAndResolve(cand, baseDir); // §4.4 — ~ expand + resolve(baseDir) — NO stat
    if (await isRegularFile(abs)) return abs;          // §4.5 rule 3 — EXACT MATCH ALWAYS WINS
    if (tryMdExt && path.extname(cand) === "") {      // §4.5 rule 3 — extensionless shorthand ONLY
      if (await isRegularFile(abs + ".md")) return abs + ".md";
      if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
    }
  }
  return null;                                        // nothing resolved → caller leaves marker verbatim
}

/** §4.6 — config shape. markdownBareAtImports: also match bare "@path" in markdown (opt-in). Loaded on
 *  session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports undefined → false downstream. */
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

/** §4.6 — the camelCase key under which this extension's config may live inside Pi's settings.json (a
 *  conventional JSON-settings key; distinct from the package `name`). settings.json is open-schema (Pi
 *  deep-merges and preserves unknown keys through /settings edits + flushes), so the key is stable; the
 *  extension reads it directly from disk (Pi exposes no public settings accessor to extensions). */
const SETTINGS_KEY = "fileInjector";

/** PRD §4.6 / §9 — read config from up to FOUR sources, shallow-merged in precedence order (each later source
 *  overrides the earlier; project scope overrides global; within a scope the dedicated file overrides the
 *  settings.json key):
 *    1. GLOBAL settings.json → SETTINGS_KEY object   (~/.pi/agent/settings.json via getAgentDir())
 *    2. GLOBAL file-injector.json                    (~/.pi/agent/file-injector.json — whole file)
 *    3. PROJECT settings.json → SETTINGS_KEY object  (<cwd>/.pi/settings.json) — TRUSTED ONLY
 *    4. PROJECT file-injector.json                   (<cwd>/.pi/file-injector.json) — TRUSTED ONLY
 *  Missing/malformed ANY source (or a missing/non-object SETTINGS_KEY key) → contributes {} (so the default
 *  markdownBareAtImports === undefined → false downstream). NEVER throws (every read/parse is try/caught → {}).
 *  The narrow {cwd, isProjectTrusted} ctx (only the two fields used) keeps it unit-testable with a literal
 *  mock; do NOT type it as `any` (item §3). Consumed by P1.M2.T1.S1's session_start handler. */
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  // Read a DEDICATED config file whose WHOLE content is the FileInjectorConfig; {} on missing/malformed or a
  // non-object (e.g. an array) body. JSON.parse is `any`; the object guard narrows it safely without `any`.
  const tryReadCfg = async (p: string): Promise<FileInjectorConfig> => {
    try {
      const v = JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? (v as FileInjectorConfig) : {};
    } catch {
      return {};
    }
  };
  // Read a Pi settings.json and extract the SETTINGS_KEY sub-object; {} if the file/key is missing or the
  // key value is not a plain object. Lets users co-locate the option with their other Pi settings (PRD §4.6).
  const tryReadNamespaced = async (p: string): Promise<FileInjectorConfig> => {
    try {
      const v = JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}");
      if (!v || typeof v !== "object" || Array.isArray(v)) return {};
      const sub = (v as Record<string, unknown>)[SETTINGS_KEY];
      return sub && typeof sub === "object" && !Array.isArray(sub) ? (sub as FileInjectorConfig) : {};
    } catch {
      return {};
    }
  };
  let cfg: FileInjectorConfig = {};
  // 1+2 GLOBAL: settings.json key (base), then the dedicated file (overrides the key within this scope).
  cfg = { ...cfg, ...(await tryReadNamespaced(path.join(getAgentDir(), "settings.json"))) };
  cfg = { ...cfg, ...(await tryReadCfg(path.join(getAgentDir(), "file-injector.json"))) };
  if (ctx.isProjectTrusted()) {
    // 3+4 PROJECT (trusted only): settings.json key, then the dedicated file (project overrides global).
    cfg = { ...cfg, ...(await tryReadNamespaced(path.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json"))) };
    cfg = { ...cfg, ...(await tryReadCfg(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  }
  return cfg;
}

/** PRD §5.2 — lowercase extension for MIME_BY_EXT lookup, or "" for no-dot / hidden-file (dot at 0). */
export function extOf(abs: string): string {
  const base = path.basename(abs);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ""; // -1 (no dot) OR 0 (hidden file like .bashrc / .env)
  return base.slice(dot + 1).toLowerCase();
}

/** PRD §5.1 — scan the first min(buf.length, 8000) bytes for a 0x00 NUL byte. Routes non-image
 *  binaries to the binary note. Image files skip this (classified by MIME first in injectFiles). */
export function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/** PRD §6.1 / processFileArguments line-59 parity — minus the trailing \n (assembly join owns it). */
export function formatTextFileBlock(abs: string, content: string): string {
  return '<file name="' + abs + '">\n' + content + '\n</file>';
}

/** PRD §5.2/§6.1 / processFileArguments lines 49/52 parity. Empty/undefined hint => <file name="ABS"></file>. */
export function formatImageBlock(abs: string, resized: ResizedImage | null): string {
  const hint = resized != null ? formatDimensionNote(resized) : undefined;
  return '<file name="' + abs + '">' + (hint ?? "") + '</file>';
}

/** PRD §5.3/§6.1 — em dash (U+2014) is load-bearing; no built-in equivalent (deliberate improvement
 *  over processFileArguments, which has no binary guard). */
export function formatBinaryBlock(abs: string): string {
  return '<file name="' + abs + '"><binary file \u2014 contents not injected; use the read tool if needed></file>';
}

/** F5 — a 0-byte image file attaches nothing (an empty ImageContent is rejected by providers);
 *  instead emit a note block so the path is still referenced in the prompt. Reuses the em dash
 *  (U+2014) convention from the binary note for visual consistency. */
export function formatEmptyImageBlock(abs: string): string {
  return '<file name="' + abs + '"><empty image file \u2014 0 bytes; nothing to attach></file>';
}

/** Return the UTF-16 head slice, advanced past a lone high surrogate so the head block never ends
 *  mid-surrogate-pair (a JS string is UTF-16; a naive slice(0, HEAD_CHARS) can split a pair and emit
 *  a malformed trailing char). Backs up by at most 1 code unit only when the cut lands between a
 *  high (0xD800–0xDBFF) and low (0xDC00–0xDFFF) surrogate, leaving the pair intact on the next page. */
function headSlice(content: string): string {
  let s = content.slice(0, HEAD_CHARS);
  const last = s.charCodeAt(s.length - 1);
  const next = content.charCodeAt(HEAD_CHARS);
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) {
    s = s.slice(0, -1); // drop the lone high surrogate so the pair reads whole on the next page
  }
  return s;
}

/** Count the COMPLETE lines fully contained in the head slice, so the directive can resume at the next
 *  line with ZERO data loss (Pi read offset is 1-indexed). A line is complete if it ends with '\n'
 *  within the head; the line count therefore equals the number of newlines in the head. If the head
 *  ends mid-line, that final partial line is NOT counted as complete — the directive re-reads it in
 *  full (redundant tail, never data loss). The directive resumes at (newlineCount + 1). */
function headStartLine(head: string): number {
  let n = 0;
  for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 0x0A) n++;
  return n + 1; // 1-indexed: first line AFTER the complete lines delivered in the head
}

/** Count complete lines in the head (for the directive's "first N lines injected" wording). Equals
 *  the number of newlines, since every newline terminates a complete line. */
function headCompleteLineCount(head: string): number {
  let n = 0;
  for (let i = 0; i < head.length; i++) if (head.charCodeAt(i) === 0x0A) n++;
  return n;
}

/** PRD §5.5 / §6.1 — directive block for a paged (oversize) text file. Emits a <file name="abs"> note
 *  giving the content length + complete lines already delivered in the head, and instructing the model
 *  to read the REMAINDER via the read tool. `startLine` is the 1-indexed line at which the model should
 *  resume (computed from the ACTUAL line count of the head so the directive is internally
 *  consistent for ANY line length — never the hardcoded 2001 that assumed 8192 chars = 2000 lines);
 *  Pi read offset is 1-indexed, limit is DEFAULT_MAX_LINES=READ_LIMIT=2000, and the model increments
 *  offset by READ_LIMIT until done. `injectedLines` is the count of complete lines in the head.
 *  The wording follows the PRD §6.1 template exactly: `<paged: <len> chars; head delivered <injectedLines>
 *  complete lines; read the rest …>` — `len` is the content LENGTH in UTF-16 code units (labeled
 *  "chars" per PRD §6.1, NOT "bytes"; a multibyte char is still one code unit here, so "bytes" would be
 *  a mislabel for magnitude). */
export function formatPagedDirectiveBlock(abs: string, len: number, startLine: number, injectedLines: number): string {
  return '<file name="' + abs + '"><paged: ' + len + ' chars; head delivered ' + injectedLines + ' complete lines; read the rest with the read tool at offset:' + startLine + ', limit:' + READ_LIMIT + ', incrementing offset by ' + READ_LIMIT + ' until done></file>';
}

/** §6.3 — the INNER text of a paged directive block (the `<paged: …>` resume instructions), for the expanded view.
 *  Strips the wrapping `<file name="…">` opener and `</file>` closer. `formatPagedDirectiveBlock` emits
 *  `<file name="ABS"><paged: …></file>` (no newline), so the inner is everything between the first `>` (end of the
 *  opener) and the last `</file>` (the closer). Defensive: if the markers aren't found, return the block unchanged. */
function extractDirectiveInner(block: string): string {
  const open = block.indexOf(">");        // end of '<file name="…">'
  const close = block.lastIndexOf("</file>");
  return open >= 0 && close > open ? block.slice(open + 1, close) : block;
}

/** Parse the path out of a `<file name="ABS">…</file>` block header. Returns the absolute path, or
 *  undefined if the block does not match the opener (defensive — image/binary/F5/paged-directive blocks
 *  all use the same opener, so the path is always present for real emissions). */
function blockPath(block: string): string | undefined {
  const m = /^<file name="([^"]+)">/.exec(block);
  return m ? m[1] : undefined;
}

/** §12.22 (P1.M2.T1.S1) — compute absolute `contentStart`/`contentLen` for every text/paged detail so the
 *  renderer can slice the body out of the assembled `message.content` WITHOUT duplicating file bytes into
 *  `details` (the body is renderer-only metadata; it must not be persisted in the custom message). Runs in
 *  `before_agent_start` over the FINAL `blocks` array, because the absolute offset of a detail's body within
 *  `blocks.join("\n\n")` depends on every PRIOR block's length — `emitText` cannot know it at emit time.
 *
 *  Pairing: details and blocks are NOT 1:1 — a paged detail emits TWO blocks (head + directive) but only
 *  the head block carries the body. We pair each detail to the NEXT unmatched text/head block with the same
 *  path (matching `path` keeps imports of the same file at different depths — deduped anyway — correctly
 *  paired; a path can repeat across distinct files only if two files share an abs path, which is impossible).
 *  The body lives between the opener `<file name="ABS">\\n` and the closing `\\n</file>`; its length equals
 *  `block.length - headerLen - closerLen`. Image/binary/F5 details have no displayable body and are skipped.
 *  Idempotent + defensive: a detail whose block can't be located is left untouched (renderer falls back to
 *  the regex tier). Mutates `details` in place and returns it for chaining. */
export function computeDetailOffsets(blocks: string[], details: FileDetail[]): FileDetail[] {
  const SEP = "\n\n";
  // absolute char offset of each block within blocks.join("\n\n")
  const starts: number[] = [];
  let off = 0;
  for (const b of blocks) { starts.push(off); off += b.length + SEP.length; }

  // index of the next unmatched block, keyed by path, so a paged detail (head then directive) consumes the
  // head and leaves the directive block for… nothing (directive blocks carry no body); duplicate paths at
  // distinct depths are consumed in emission order.
  const cursorByPath = new Map<string, number>();
  for (let di = 0; di < details.length; di++) {
    const d = details[di];
    if (d.kind !== "text" && d.kind !== "paged") continue; // image/binary/F5 — no displayable body
    const p = d.path;
    let bi = cursorByPath.get(p);
    if (bi === undefined) bi = 0;
    // advance to the next block at/after `bi` whose header path matches AND is a body-bearing block
    // (head/text — NOT a paged directive block, which is `<paged: …>` inner and carries no file body).
    while (bi < blocks.length) {
      const blk = blocks[bi];
      const hdr = blockPath(blk);
      if (hdr === p) {
        // is this a body-bearing block? text/head blocks end with `\n</file>`; paged directive blocks are
        // `<file name="ABS"><paged: …></file>` (no leading `\n`). The body-bearing test: the char right
        // after the opener is `\n` for text/head (formatTextFileBlock always emits `>\\n` + content).
        const openEnd = blk.indexOf(">") + 1; // end of '<file name="…">'
        if (blk.charCodeAt(openEnd) === 0x0A) { // body-bearing text/head block
          const headerLen = openEnd + 1;        // include the '\n'
          const closerLen = "\n</file>".length; // formatTextFileBlock appends '\n</file>'
          const bodyLen = blk.length - headerLen - closerLen;
          if (bodyLen >= 0) { // defensive: malformed block → leave detail untouched
            d.contentStart = starts[bi] + headerLen;
            d.contentLen = bodyLen;
          }
          cursorByPath.set(p, bi + 1); // consumed; a following paged directive block has the same path but is skipped below
          break;
        }
      }
      bi++;
    }
    if (bi >= blocks.length) {
      // no body-bearing block found for this detail — leave contentStart/contentLen unset; the renderer's
      // tier-2 (d.body) / tier-3 (regex) fallbacks handle it. (Real emission always pairs; this guards
      // old/foreign/test details.)
      cursorByPath.delete(p);
    } else {
      cursorByPath.set(p, bi + 1);
    }
  }
  return details;
}

/**
 * PRD §9 / §5.5 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read
 * each, and append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image). The
 * whole file ALWAYS reaches the model: injected inline when it fits the remaining context budget,
 * paged via the model's `read` tool when it does not (PRD §5.5). NEVER throws (each file is isolated
 * in try/catch); tokens that miss/are directories/throw are left verbatim. VERBATIM DELIVERY (PRD
 * §6.4/§13.8): the original prompt text is NOT modified — nothing is appended to it. The file BYTES
 * live only in the returned `blocks`/`details` (the caller stashes them for `before_agent_start`'s
 * custom message); the prompt carries nothing but the user's original text. (Markers are NOT stripped,
 * so cancel/fork//tree re-open re-triggers injection.) `ctx` carries the budget inputs
 * `getContextUsage()` (tokens used) and `model` (contextWindow/maxTokens); both optional so a
 * cwd-only ctx is valid. `injected` counts whole-file injections; `paged` counts files delivered via
 * the page path (PRD §5.5). Return `{injected:0, paged:0}` => caller returns {action:"continue"};
 * otherwise the input handler stashes blocks/details and returns {action:"transform", text, images}.
 *
 * Internal state is carried in ONE shared `State` object (PRD §9) — `blocks`, `images`,
 * `injectedSet` (consolidated dedup: prior `<file>` blocks ∪ within-run deliveries), `remaining`
 * (the single budget accumulator), `count`, `paged` — so a later task can thread the same state
 * through a recursive import chain. The `remaining` budget currently covers TEXT injections only
 * (inline whole + paged head); it is computed once here and forward-references a WHOLE-PROMPT budget
 * that will also span markdown imports once they land (PRD §5.6.2) — at which point image/binary
 * deliveries will likewise call `subtract`.
 */
/** PRD §6.2/§6.3 per-file metadata (one entry per delivered file). Type-only export — interfaces are
 *  erased at runtime by jiti/TS, so this never appears in the module's runtime surface (no guard impact).
 *  Consumed forward by the renderer (T2.S2) to draw collapsed `read <path>` lines; it is renderer metadata
 *  only and is NEVER sent to the model as separate text. In S1, emitText pushes `kind: "text"` (whole +
 *  sub-head) and `kind: "paged"` entries; image (`kind:"image"`, dimensionHint) and binary (`kind:"binary"`)
 *  entries are added in injectFile in S2. The kind union is forward-looking. */
export interface FileDetail {
  path: string; // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged";
  chars?: number; // text: content length; paged: FULL content length
  lines?: number; // text: total line count
  range?: string; // paged: ":<startLine>-…" resume range (read-tool style)
  pagedHeadLines?: number; // paged: complete lines delivered in the head
  dimensionHint?: string; // image: formatDimensionNote(resized) — UNUSED in S1 (image is S2)
  body?: string; // the EXACT file body embedded in the block (text/paged head), so the renderer can
                 //   display it WITHOUT re-regexing message.content (which mis-truncates when a file's
                 //   own content contains a literal </file>). Renderer-only metadata; never sent to the
                 //   model. OMITTED for image/binary (no displayable body) and by old/foreign entries.
                 //   DEPRECATED fallback (old/test entries; renderer prefers contentStart/contentLen).
                 //   Real emission does NOT set this (§12.22 — P1.M2.T1.S1 removes the body pushes).
  directive?: string; // §6.3 paged-only — the <paged: …> directive INNER text, rendered in the expanded
                      //   view after the head body (§6.3: paged files show head + directive verbatim).
                      //   Populated by emitText's paged branch (P1.M2.T2.S1); the directive block still
                      //   reaches the model via message.content (display-only fix). OMITTED for non-paged.
  contentStart?: number; // §12.22 — char offset of this file's body within message.content (text/paged
                         //   only; image/binary omit). The renderer slices message.content for BUG-1-safe
                         //   body recovery WITHOUT duplicating bytes into details (P1.M2.T1.S1). Populated
                         //   by computeDetailOffsets in before_agent_start (absolute offset within the
                         //   assembled blocks.join("\n\n"), which emitText cannot know at emit time).
  contentLen?: number; // §12.22 — char length of the body slice (text: whole content; paged: the head).
}

interface State {
  blocks: string[];
  details: FileDetail[]; // PRD §6.4 — per-file metadata, parallel to blocks (index-aligned; one detail per block emission in emitText)
  images: ImageContent[];
  injectedSet: Set<string>; // seeded with priorPaths; holds resolved abs paths → dedup
  remaining: number | null; // single budget accumulator (§5.5 / §5.6.2)
  count: number;
  paged: number;
  bareAt: boolean; // §4.6 — markdown bare-"@" imports enabled? (top-level scan ignores this; injectMarkdown reads it)
}

/** PRD §9 — subtract a cost from the shared budget, no-op when the budget is unknown (null).
 *  NOT exported (internal). Used by the text paged/inline paths now; image/binary in a later task. */
function subtract(state: State, cost: number): void {
  if (state.remaining !== null) {
    state.remaining = Math.max(0, state.remaining - cost);
  }
}

/** PRD §4.5 / §9 — markdown imports are relative-only; top-level user tokens allow absolute/tilde.
 *  scanTokens drops these when opts.allowAbsTilde is false. (No-op at top level: allowAbsTilde===true.)
 *  OWNED BY T1.S2 — T2.S1 REUSES this export (do NOT re-declare it there). */
export function isAbsoluteOrTilde(p: string): boolean {
  return p.startsWith("/") || p.startsWith("~");
}

/** Escape a char for safe interpolation into a RegExp body (fenceChar is "`" or "~"). Used by
 *  computeCodeRanges' constructed close-line regex. NOT exported (internal helper). */
function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * PRD §5.6.1 — LINEAR-TIME inline-code span detector. Computes the same non-overlapping leftmost
 * `[start, end)` spans the old regex `/(`+)([\s\S]*?)\1(?!`)/g` produced (verified byte-for-byte across
 * 500k randomized fuzz cases), but in ~O(n) time regardless of backtick-run length — the regex was O(n²)
 * on a long unmatched run (the backreference \1 + lazy [\s\S]*? forced the engine to try every
 * run-length split; ~8s CPU at 200k backticks, reachable via any `#@file.md`). This function replaces
 * it so a hostile/machine-generated markdown import can no longer freeze the event loop.
 *
 * Semantics replicated EXACTLY:
 *   • At a maximal backtick run of length R at position `pos`, the opener length L is tried from R DOWN
 *     to 1 (the regex's greedy `(`+)` capture then backtracking). The FIRST L with any valid closer wins.
 *   • For a fixed L, content starts at `pos + L`; the closer is the LEFTMOST position `c ≥ pos + L` where
 *     exactly L backticks occur and the char after them is NOT a backtick (lazy `[\s\S]*?` + `(?!`)`).
 *     An "exactly L" closer means the L backticks are the TRAILING L of a maximal run of length M ≥ L whose
 *     following char is non-backtick — so the unique closer inside a maximal run is at `runEnd − L`.
 *   • The matched span is `[pos, c + L)`; scanning resumes at `c + L` (non-overlapping).
 *   • `INLINE_CODE_MAX_OPENER` caps L (defense-in-depth; 1024 is far above any real code-span opener —
 *     capping cannot affect realistic input, verified by fuzz — but bounds the opener-retry loop against
 *     a hostile file; the closer search is already linear via whole-run skipping).
 *
 * Algorithm: one right-to-left pass precomputes `runEnd[i]` (exclusive end of the maximal backtick run
 * containing `i`, or -1 for non-backticks). Then a left-to-right pass walks opener runs; for each viable
 * L it scans content for the leftmost closer, skipping maximal runs wholesale (O(spans) amortized, not
 * O(content)) — so the whole scan is ~linear in the input length. PURE: no I/O, no state. NOT exported.
 *
 * @param content the full markdown text (UTF-16 code-unit offsets, consistent with FILE_INJECT_RE m.index)
 * @returns non-overlapping leftmost `[start, end)` inline-code spans (NOT yet filtered by fenced ranges;
 *           the caller drops any span fully inside a fenced range)
 */
function inlineCodeRanges(content: string): [number, number][] {
  const n = content.length;
  if (n === 0) return [];

  // runEnd[i] = exclusive end of the maximal backtick run containing index i (−1 for non-backticks).
  // Built in one right-to-left pass: when s[i]==='`', extend left to the run's start and stamp [start,end).
  const runEnd = new Int32Array(n).fill(-1);
  for (let i = n - 1; i >= 0; ) {
    if (content.charCodeAt(i) !== 0x60 /* '`' */) { i--; continue; } // backtick = U+0060
    let start = i;
    while (start > 0 && content.charCodeAt(start - 1) === 0x60) start--;
    const end = i + 1; // run covers [start, end) — all backticks by construction
    for (let k = start; k < end; k++) runEnd[k] = end;
    i = start - 1;
  }

  const ranges: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (content.charCodeAt(i) !== 0x60) { i++; continue; } // not an opener → advance
    const runStart = i;
    let runLen = 0;
    while (i < n && content.charCodeAt(i) === 0x60) { runLen++; i++; } // maximal opener run

    const maxL = Math.min(runLen, INLINE_CODE_MAX_OPENER);
    let matched: [number, number] | null = null;
    for (let L = maxL; L >= 1; L--) { // opener length: greedy-then-backtrack (regex semantics)
      const contentStart = runStart + L;
      let p = contentStart;
      let found = -1;
      while (p + L <= n) {
        if (content.charCodeAt(p) !== 0x60) { p++; continue; }
        const end = runEnd[p]!;                 // end of the maximal run containing p
        // An exact-L closer (L backticks not followed by a backtick) must END at `end` — anywhere
        // earlier in the run is followed by another backtick. So the unique closer start in this
        // run is `end − L`, valid iff it lies at/after both p and contentStart (within the content).
        const closerStart = end - L;
        if (closerStart >= contentStart && closerStart >= p) {
          found = closerStart; // leftmost viable closer for this run
          break;
        }
        p = end; // this run can't host a valid closer ≥ contentStart → skip it wholesale
      }
      if (found !== -1) {
        matched = [runStart, found + L];
        break; // first (largest) L with a closer wins, mirroring the regex
      }
    }
    if (matched) {
      ranges.push(matched);
      i = matched[1]; // non-overlapping: resume after this span
    }
    // (no match → i already past the opener run; continue scanning)
  }
  return ranges;
}

/**
 * PRD §5.6.1 — compute a sorted list of [start, end) character-offset ranges that are CODE (fenced
 * blocks + inline code), approximate-CommonMark. Used by scanTokens(opts.skipCode:true) to leave `#@`
 * directives inside code verbatim (the markdown escape hatch, PRD §4.5 rule 3). PURE: no I/O, no state.
 *
 * Algorithm:
 *  1. FENCED BLOCKS — walk lines with a running char offset. A line matching FENCE_OPEN_RE opens a block
 *     (fenceChar = run[0], fenceLen = run.length). From the next line, scan for a CLOSING line: after
 *     dropping 0-3 leading spaces, it must START with >= fenceLen of the SAME fenceChar AND the remainder
 *     must be whitespace-only (/^[ \t]*$/) — this is the strict-CommonMark rule (a ` ```foo ` line does
 *     NOT close; only the OPENING fence may carry an info string). The range runs from the opening
 *     fence's first char (lineStartOffset) through the end of the closing line INCLUSIVE of its trailing
 *     newline. If NO closing fence is found, the range runs to EOF (unterminated fences consume the rest,
 *     matching CommonMark). Fences of the OTHER char inside a block are literal (do not reopen).
 *  2. INLINE CODE — inlineCodeRanges(content) returns the same non-overlapping leftmost spans the
 *     original regex `/(`+)([\s\S]*?)\1(?!`)/g` produced, but in ~O(n) time (it replaced the regex,
 *     which was O(n²) on a long unmatched backtick run — see its docstring). Each span [start, end)
 *     is a code range UNLESS it is FULLY inside a fenced range (span[0]>=fr[0] && span[1]<=fr[1]) —
 *     skip those so we don't double-count. (Approximate: does not model backslash escapes. Good enough
 *     to stop the common `#@file` doc pattern from importing.)
 *  3. Sort by start. Ranges are disjoint + sorted (fenced ranges don't overlap; inline spans don't
 *     overlap each other; inside-fenced spans are filtered) — so inCode can binary-search them.
 *
 * @param content the full markdown text (UTF-16 code-unit offsets, consistent with FILE_INJECT_RE m.index)
 * @returns sorted [start, end) code ranges
 */
export function computeCodeRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  const lines = content.split("\n");

  // Precompute the char offset of the START of each line (line i starts at sum of len(lines[k])+1 for k<i).
  // The +1 accounts for the "\n" that split() removed. The final line has no trailing "\n" if content
  // doesn't end in one — content.length is the safe cap for any end offset.
  const lineStart: number[] = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStart[i] = acc;
    acc += lines[i].length + 1; // +1 for the "\n"
  }

  // 1. FENCED BLOCKS — state machine over lines.
  let i = 0;
  while (i < lines.length) {
    const open = lines[i].match(FENCE_OPEN_RE);
    if (!open) { i++; continue; }            // not a fence opener → skip
    const run = open[1];
    const fenceChar = run[0];                  // "`" or "~"
    const fenceLen = run.length;
    const openStart = lineStart[i];            // first char of the opening fence line (PRD §5.6.1)
    // strict-CommonMark close: 0-3 leading spaces, then >= fenceLen of fenceChar, then whitespace-only.
    const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*\\r?$");

    // scan forward from the NEXT line for the closing fence
    let j = i + 1;
    let closedEnd: number | null = null;
    while (j < lines.length) {
      if (closeRe.test(lines[j])) {
        // end of closing line incl. its trailing newline (cap at content.length for the final line)
        closedEnd = Math.min(lineStart[j] + lines[j].length + 1, content.length);
        break;
      }
      j++;
    }
    if (closedEnd !== null) {
      ranges.push([openStart, closedEnd]);
      i = j + 1;                              // resume AFTER the closing line
    } else {
      ranges.push([openStart, content.length]); // unterminated → EOF (CommonMark)
      break;                                  // nothing left to scan
    }
  }

  // 2. INLINE CODE — spans NOT fully inside any fenced range. (inlineCodeRanges is the LINEAR-TIME
  //    replacement for the former `/(`+)([\s\S]*?)\1(?!`)/g` regex — same spans, ~O(n) regardless of
  //    backtick-run length; see its docstring. The old regex was O(n²) on a long unmatched run.)
  for (const [spanStart, spanEnd] of inlineCodeRanges(content)) {
    const insideFenced = ranges.some((fr) => spanStart >= fr[0] && spanEnd <= fr[1]);
    if (!insideFenced) ranges.push([spanStart, spanEnd]);
  }

  // 3. sort by start (ranges are already disjoint by construction; sort for inCode's binary search).
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

/**
 * PRD §5.6.1 — true iff `index` lies inside any code range `[start, end)` (i.e. start <= index < end).
 * Binary search over the sorted disjoint ranges from computeCodeRanges. `ranges` MUST be sorted by start
 * and disjoint (computeCodeRanges guarantees both). O(log ranges.length).
 *
 * @param index the char offset to test (e.g. a FILE_INJECT_RE m.index — the position of `#`)
 * @param ranges sorted [start, end) code ranges from computeCodeRanges
 */
export function inCode(index: number, ranges: [number, number][]): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (index < s) hi = mid - 1;
    else if (index >= e) lo = mid + 1;
    else return true; // s <= index < e
  }
  return false;
}

/**
 * PRD §5.6.2 — conservative image-token estimate for budget accounting. Images consume the shared
 * `remaining` budget but are NEVER paged (§5.2: resized + attached). This estimate lets a later file's
 * inline-vs-paged decision see a budget that already reflects the image.
 *
 * Formula (Anthropic Vision guide, https://docs.claude.com/en/docs/build-with-claude/vision): an image
 * is tiled into 512×512 blocks; each tile ≈ 170 tokens; plus a flat 85-token base. So
 *   tokens = max(1, ⌈width/512⌉) · max(1, ⌈height/512⌉) · 170 + 85
 * computed on the RESIZED dimensions (resizeImage caps the longest edge to 2000, so the worst case is
 * ⌈2000/512⌉=4 tiles per side → 4·4·170+85 = 2805 = IMAGE_FALLBACK_TOKENS).
 *
 * When `resized` is null (resizeImage could not process the bytes → the raw-base64 fallback path),
 * dimensions are unavailable, so return the flat `IMAGE_FALLBACK_TOKENS` (the 2000×2000 worst case — a
 * CONSERVATIVE upper bound appropriate for a budget guard that must not under-count). ResizedImage.width
 * and .height are required numbers (pi's ResizedImage type), so no per-field null-check is needed; the
 * Math.max(1, ⌈x/512⌉) guard makes even a 0 dimension safe (→ 1 tile).
 *
 * PURE: no I/O, no state mutation. Exported for unit testing + the module-surface sanity list.
 *
 * @param resized the resizeImage result (null on the raw-base64 fallback path)
 * @returns the conservative image token cost
 */
export function estimateImageTokens(resized: ResizedImage | null): number {
  if (resized === null) return IMAGE_FALLBACK_TOKENS;
  const tilesW = Math.max(1, Math.ceil(resized.width / 512));
  const tilesH = Math.max(1, Math.ceil(resized.height / 512));
  return tilesW * tilesH * 170 + 85;
}

// ---------- §6.3 chat renderer (registered for "fileInjector.injected") -------------------------
// Replicates the read tool's completed-call look: a green (toolSuccessBg) Box, one `read <path>` line per
// file when collapsed, full/highlighted content when expanded. blocks (message.content) and details.files
// are co-emitted in the same pre-order emission order (PRD §6.4), so they align by index. DEFENSIVE: never
// throws (PRD §12.23) — a thrown renderer is caught by CustomMessageComponent → Pi's default purple box
// (acceptable but not the goal).
const FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;

/**
 * PRD §6.3 — the MessageRenderer for customType "fileInjector.injected". Draws a green (toolSuccessBg) Box
 * with one `read <tildified-path>` line per file (collapsible), expanding on ctrl+o to the full/highlighted
 * content.
 *
 * theme/message are `any` (item §3c) to avoid importing the full Theme/CustomMessage types and to keep the
 * test seam simple. The fg/bg discipline is therefore enforced by code review (NOT the compiler):
 * toolSuccessBg → theme.bg; toolTitle/accent/dim/warning/toolOutput → theme.fg. (To opt into compile-time
 * enforcement, import Theme from pi-coding-agent and type theme: Theme — then theme.fg("toolSuccessBg")
 * becomes a compile error.)
 *
 * DEFENSIVE (§12.23): `message?.details?.files ?? []` (old/foreign entries with no details → fallback
 * line); `bodies[i] !== undefined` guard; image expanded-view short-circuit (images already attached to
 * the user message, §6.4 — don't re-render); `typeof message?.content === "string"` guard. Never throws.
 *
 * @param message the CustomMessage (details.files: FileDetail[]; content: the joined <file> blocks string)
 * @param opts { expanded } — mirrors the global ctrl+o toggle (like [skill] blocks)
 * @param theme Pi Theme (fg/bg/bold)
 * @returns a green Box Component (one read line per file; expanded content when opts.expanded)
 */
export function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component {
  const files: FileDetail[] = message?.details?.files ?? []; // defensive — old/foreign entries
  // BODY derivation (3 tiers, expanded view): (1) offset slice — real injected files (post-P1.M2.T1.S1) carry
  // contentStart/contentLen (char offsets into message.content), so message.content.slice(start, start+len)
  // recovers the EXACT body WITHOUT duplicating file bytes into details (§12.22); (2) stored `body` — old/
  // foreign/test entries (and pre-offset persisted messages) carry the deprecated body field; (3) the regex
  // below — last-resort fallback for entries with neither (§6.3/§12.23 defensive rendering). The regex re-parse
  // is computed UNCONDITIONALLY (cheap; needed for tier 3) but is only USED when tiers 1+2 miss. BUG-1: a file
  // whose own content contains a literal `</file>` truncates the lazy `([\s\S]*?)` at the INNER `</file>`, so
  // tiers 1+2 (length-derived offset / stored body) are the BUG-1-safe paths; tier 3 is regex-vulnerable but
  // only fires for entries without offsets/body (test-crafted / old), where BUG-1 is not a real-world risk.
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0; // module regex w/ g flag → reset before the loop
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) {
      bodies.push(m[2].replace(/^\n|\n$/g, "")); // strip the wrapping newlines from <file>\n…\n</file>
    }
  }
  // green Box — toolSuccessBg is ThemeBg → theme.bg (NOT theme.fg). paddingX/Y=1; bgFn paints every child line.
  const box = new Box(1, 1, (t: string) => theme.bg("toolSuccessBg", t));
  if (files.length === 0) { // defensive fallback (no details — old/foreign entry)
    box.addChild(new Text(theme.fg("toolTitle", theme.bold("read")) + " " +
      theme.fg("dim", "(injected files)") + expandHint(theme), 0, 0));
    if (opts.expanded && typeof message?.content === "string") {
      box.addChild(new Text(theme.fg("toolOutput", message.content), 0, 0));
    }
    return box;
  }
  for (let i = 0; i < files.length; i++) {
    const d = files[i];
    // one read line per file; expand hint ONCE per box (i===0), matching the [skill] precedent (PRD §6.3)
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? expandHint(theme) : ""), 0, 0));
    if (opts.expanded) {
      // 3-tier body resolution (§12.22 offset → stored body → regex fallback). Real emission (P1.M2.T1.S1)
      // carries contentStart/contentLen (no duplicated bytes); tier-1 slices message.content EXACTLY — BUG-1-safe
      // because the offsets are length-derived (block.length − header − footer), NOT regex: a body containing a
      // literal </file> (which truncates FILE_BLOCK_RE's lazy capture) slices whole. Tier-2 (d.body) covers
      // old/foreign/test entries still carrying the deprecated body field. Tier-3 (bodies[i]) is the last-resort
      // regex fallback for entries with neither (§6.3/§12.23 defensive rendering).
      const body = (d.contentStart != null && d.contentLen != null && typeof message?.content === "string")
        ? message.content.slice(d.contentStart, d.contentStart + d.contentLen)
        : (typeof d.body === "string" ? d.body : bodies[i]);
      if (body !== undefined && d.kind !== "image") { // images already attached to user msg (§6.4) — skip
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
      if (d.kind === "paged" && typeof d.directive === "string") { // §6.3 — paged directive after the head, expanded view only
        box.addChild(new Text(theme.fg("dim", d.directive), 0, 0));
      }
    }
  }
  return box;
}

/**
 * One collapsed line per file, identical in spirit to the read tool's formatReadCall:
 *   read <tildified-path><range-or-hint>
 * toolTitle+bold for "read"; accent for the path; dim/warning for the suffix depending on kind.
 */
function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const pathPart = theme.fg("accent", tildify(d.path));
  if (d.kind === "binary") {
    return `${title} ${pathPart} ${theme.fg("dim", "(binary — not injected)")}`;
  }
  if (d.kind === "image") {
    return `${title} ${pathPart}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  }
  if (d.kind === "paged") {
    return `${title} ${pathPart}${theme.fg("warning", d.range ?? "")}`;
  }
  return `${title} ${pathPart}`; // whole text (no suffix)
}

/** "(ctrl+o to expand)" — the default expand binding (PRD §12.25: keyText() is internal; ctrl+o is hardcoded). */
function expandHint(theme: any): string {
  return " " + theme.fg("dim", "(ctrl+o to expand)");
}

/** §12.25 — tildify an absolute path (leading os.homedir() → ~) for readable display (read-tool parity). */
function tildify(abs: string): string {
  const home = os.homedir();
  return home && abs.startsWith(home + "/") ? "~" + abs.slice(home.length) : abs;
}

/** Shared ctx type for injectFiles / processTokenStream / injectFile (DRY; jiti erases at runtime). */
type Ctx = {
  cwd: string;
  getContextUsage?: () =>
    { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
};

/**
 * PRD §9 / §5.6 step 3 — scan a text (user prompt OR markdown content) for `#@`/`@` import markers,
 * resolving each to an absolute path WITHOUT injecting. Pure (no I/O, no state mutation beyond the
 * per-text localSeen set). Per-text dedup via localSeen; global state.injectedSet check skips already-
 * claimed paths (prior <file> blocks OR files injected earlier this run / in a parent recursion).
 *
 * VERBATIM DELIVERY (PRD §6.4 / §12.16): markers are detected here ONLY to resolve imports — they are
 * NEVER stripped from the text, so no index/prefixLen bookkeeping is returned. The returned paths are
 * the resolved absolute file paths, in encounter order (the depth-first recursion in processTokenStream
 * relies on this ordering). Resolution logic is unchanged: cleanToken → isAbsoluteOrTilde →
 * resolveImportPath → dedup → code-region skip.
 *
 * opts.skipCode: when true, scanTokens precomputes code regions once and skips any marker whose
 *   start index lies inside a fenced block or inline code span (PRD §5.6.1). null codeRanges when false →
 *   inCode is never called → top-level (user-prompt) behavior is unchanged. Markdown imports (T2.S3)
 *   pass skipCode:true.
 * opts.allowAbsTilde: when false, tokens starting with / or ~ are dropped (markdown relative-only, §4.5).
 * opts.tryMdExt: when true, an extensionless token whose exact path is not a regular file falls back to
 *   `<exact>.md` then `<exact>.markdown` (markdown-import shorthand, PRD §4.5 rule 3). Top-level user-prompt
 *   scan passes `false` (§4.4 exact-only → top-level behavior is byte-for-byte identical to today).
 * opts.bareAt: OPTIONAL. When truthy, scanTokens ALSO matches bare `@path` markers (BARE_AT_RE, PRD §4.6)
 *   alongside the `#@` markers, returning a union of candidate paths sorted by index. Markdown-only /
 *   opt-in; the two regexes never double-match the same `#@` (BARE_AT_RE forbids a preceding `#`).
 *   When absent/false, ONLY `#@` matches run → byte-for-byte identical to the single-regex form.
 *
 * Returns string[] — the resolved absolute paths in encounter order (markers detected, never stripped:
 * PRD §6.4 / §12.16).
 */
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<string[]> {
  const localSeen = new Set<string>();
  const out: string[] = [];
  // §5.6.1 — when scanning markdown content, precompute code regions once and skip `#@` matches whose
  // start index lies inside a fenced block or inline code span (the markdown escape hatch, §4.5 rule 3).
  // null when skipCode:false (top-level user-prompt scan) → inCode is never called → no behavior change.
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  // Candidate markers: `#@` always; bare `@` only when opts.bareAt. BARE_AT_RE forbids a preceding `#`,
  // so `#@file` appears once (via FILE_INJECT_RE), never twice. When bareAt is absent/false, cands holds
  // only the FILE_INJECT_RE matches in index-ascending order (matchAll yields ascending), so the sort is
  // a no-op and the per-candidate body below is byte-for-byte identical to the prior single-loop form.
  // `idx` is retained because it is load-bearing for the code-region exemption (inCode(c.idx, …)).
  const cands: { idx: number; token: string }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2] });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2] });
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue; // §5.6.1 — skip markers inside code
    const token = cleanToken(c.token); // trim trailing punctuation (§4.3)
    if (!token) continue; // empty after trim => skip, leave verbatim
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue; // §4.5 — markdown: relative only
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // §4.5 — exact, then .md/.markdown (stats)
    if (!abs) continue; // nothing resolved → leave verbatim (missing/dir/non-regular)
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue; // dedup on RESOLVED abs → leave verbatim
    localSeen.add(abs);
    out.push(abs);
  }
  return out;
}

/**
 * PRD §9 / §12.17 — top-level processor. Scan the text ONCE (before any injection), then inject each
 * resolved path depth-first via injectFile. Scan-before-inject gives cross-subtree dedup (a later token
 * whose path an earlier import claimed is left verbatim). PRIVATE — exercised indirectly via injectFiles.
 *
 * VERBATIM DELIVERY (PRD §6.4 / §12.16): the prompt text is NEVER modified here — markers are detected
 * only to resolve imports (see scanTokens); nothing is stripped, so there is no index accumulator to
 * return. This function returns Promise<void> and injects each resolved abs depth-first. The belt-and-
 * suspenders `state.injectedSet.has(abs)` re-check stays for cross-subtree dedup once injectFile recurses
 * into markdown imports.
 *
 * `opts.tryMdExt` is threaded straight through to scanTokens/resolveImportPath: the top-level user-prompt
 * call site passes `false` (§4.4 exact-only), and the markdown-import path passes `true` (§4.5 shorthand).
 */
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
  ctx: Ctx,
): Promise<void> {
  const absPaths = await scanTokens(text, baseDir, opts, state); // scan once, before any injection (opts carries tryMdExt)
  for (const abs of absPaths) {
    if (state.injectedSet.has(abs)) continue; // cross-subtree dedup since scan
    await injectFile(abs, state, ctx); // claims abs, emits block(s); never throws
  }
}

/**
 * PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims `abs` in state.injectedSet AFTER
 * stat+isFile succeed but BEFORE read, so a self-import or mid-recursion re-entry dedups to verbatim
 * (recursion-readiness for T2 markdown; behavior-neutral at top level). The pre-read claim is REVOKED on
 * the read/resize failure path (claim ⟺ delivered, PRD §12.5) so a file that fails delivery does not
 * poison dedup. NEVER throws: stat miss / !isFile / read or resize error → return false (un-claimed) +
 * token left verbatim (PRD §5.4 / §12.5).
 *
 * Classification (preserve F3/F5; NO markdown branch yet — T2.S3): (1) empty image (mime && buf.length===0)
 * → F5 note; (2) real image (mime && hasValidImageMagic) → attach ImageContent + image block; (3) binary
 * (isBinary) → binary note; (4) else → emitText. Budget: ONLY emitText subtracts (T2.S2 adds image/binary).
 * Returns true iff a block/image was emitted (state.count bumped exactly once per claimed file).
 */
export async function injectFile(abs: string, state: State, ctx: Ctx): Promise<boolean> {
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return false; // missing → leave verbatim (PRD §5.4)
  }
  if (!st.isFile()) return false; // directory / socket / etc. → leave verbatim (PRD §5.4)
  state.injectedSet.add(abs); // CLAIM — dedup incl. self-import (recursion-readiness); REVOKED on failure (claim ⟺ delivered, see catch)

  const ext = extOf(abs); // lowercase ext, "" for no-dot/hidden (S2)
  const mime = MIME_BY_EXT[ext]; // undefined → not a recognized image → text/binary path
  try {
    const buf = await fs.readFile(abs); // read ONCE; reused by image + text/binary paths
    if (mime && buf.length === 0) {
      // F5 — a 0-byte image file would attach an EMPTY ImageContent (which providers reject).
      // Align with the text path's empty-file handling: emit a note block, attach nothing.
      const f5Block = formatEmptyImageBlock(abs);
      state.blocks.push(f5Block);
      state.details.push({ path: abs, kind: "image", dimensionHint: undefined }); // §6.4 — empty-image detail (parallel to the block push)
      subtract(state, Math.ceil(f5Block.length / 4)); // §5.6.2 — note consumes budget
    } else if (mime && hasValidImageMagic(buf, mime)) {
      // F3 — validate the ACTUAL bytes match the declared image type before attaching.
      // A mislabeled file (e.g. text named `.png`) fails the magic-number sniff and falls
      // through to the text/binary path instead of attaching decoded garbage as an image.
      const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
        mimeType: resized?.mimeType ?? mime, // null => original mime
      });
      state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file>
      state.details.push({ path: abs, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined }); // §6.4 — image detail (dimensionHint from resize)
      subtract(state, estimateImageTokens(resized)); // §5.6.2 — image consumes budget (tile estimate; never paged)
    } else if (MD_EXTS.has(ext)) {
      // MARKDOWN (PRD §5.6) — text block + transitive imports. Markdown bypasses the §5.1 NUL/binary routing
      // so import scanning always runs (§5.6 step 1). injectMarkdown (§5.6 six steps): claim self → scan
      // relative-only imports outside code → strip resolved #@ markers → emit this block (paged decision on
      // the STRIPPED content) → recurse depth-first (pre-order). Recursion is dedup-bounded (each abs claimed
      // before its scan; cycles dedup to verbatim), NOT depth-limited. injectFile owns the count++ + the claim.
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
    } else if (isBinary(buf)) {
      // BINARY (PRD §5.3) — note, no decoded garbage (em dash U+2014)
      const binBlock = formatBinaryBlock(abs);
      state.blocks.push(binBlock);
      state.details.push({ path: abs, kind: "binary" }); // §6.4 — binary detail
      subtract(state, Math.ceil(binBlock.length / 4)); // §5.6.2 — note consumes budget
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      emitText(abs, buf.toString("utf8"), state);
    }
    state.count++; // exactly one delivery per claimed file
    return true;
  } catch {
    state.injectedSet.delete(abs); // failure → UN-CLAIM so the path is NOT poisoned (claim ⟺ delivered; PRD §12.5)
    return false; // read/resize error → leave THIS token verbatim (PRD §5.4, §12.5)
  }
}

/**
 * PRD §9 / §5.5 — inline-vs-paged decision for a text file. Pushes block(s) onto state.blocks and subtracts
 * the block's cost from state.remaining via subtract(). Bumps state.paged on the page path (NOT count —
 * injectFile bumps count once per file). Lifted VERBATIM from the former inline text branch of injectFiles
 * (T1.S1): whole if budget unknown or fileCost ≤ PAGED_THRESHOLD·remaining; sub-head guard (content ≤
 * HEAD_CHARS → whole, no directive, no extra subtract); else head + directive + paged++ + subtract(head cost).
 */
export function emitText(abs: string, content: string, state: State): void {
  const fileCost = Math.ceil(content.length / 4); // O-3 heuristic (no string estimator exported)
  const lineCount = (content.match(/\n/g)?.length ?? 0) + 1; // PRD §9 — total line count (for FileDetail.lines; text whole/sub-head)
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // INLINE (whole) — current behavior preserved (PRD §5.1)
    state.blocks.push(formatTextFileBlock(abs, content));
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount }); // §12.22 — contentStart/contentLen populated by computeDetailOffsets in before_agent_start (no body duplication)
    subtract(state, fileCost);
  } else {
    // PAGED — head block (first HEAD_CHARS) + directive (PRD §5.5 Page path).
    //
    // FINDING 2: if the WHOLE content already fits in the head, there is nothing to page —
    // inject it whole and do NOT emit a directive (a sub-head-sized file that tripped the
    // page threshold only because of a tight budget would otherwise get a 'read the rest'
    // directive pointing past EOF, causing a spurious read error for content already delivered).
    //
    // FINDING 1: derive the directive's resume offset from the ACTUAL line count of the head
    // (headStartLine = newlines+1; headCompleteLineCount = newlines). The old hardcoded
    // offset:2001 assumed the 8192-char head equals 2000 lines, which is only true for ~4-char
    // lines; for realistic files it silently lost the lines between the head's real end and
    // line 2000 (up to 100% for long-lined files). The directive now points exactly past the
    // COMPLETE lines the head delivered, so no content is skipped regardless of line length
    // (a head ending mid-line re-reads that partial line — redundant tail, never data loss).
    const head = headSlice(content);
    if (content.length <= HEAD_CHARS) {
      // whole content fits the head slice → deliver inline, never page (FINDING 2).
      // The file is delivered WHOLE, so its whole cost is accounted (PRD §5.6.2 "each delivered file
      // subtracts its cost at emit time"). Earlier this branch pushed the block without subtract(),
      // which let a tight-but-positive budget never deplete across a run of small files (F1).
      state.blocks.push(formatTextFileBlock(abs, content));
      state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount }); // §12.22 — offsets computed in before_agent_start (no body duplication)
      subtract(state, fileCost);
    } else {
      // PRD §9 — extract paged locals once (DRY); used by BOTH the directive block and the paged detail.
      const headLines = headCompleteLineCount(head);
      const startLine = headLines + 1; // == headStartLine(head)
      const directiveBlock = formatPagedDirectiveBlock(abs, content.length, startLine, headLines); // §6.3 — hoist; the directive block still reaches the model via content (display-only fix); its inner text is stored on the detail for the expanded view
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(directiveBlock);
      state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines, directive: extractDirectiveInner(directiveBlock) }); // §12.22 — head offsets computed in before_agent_start (no body duplication); directive is display-only text, not file bytes
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }
  }
}

/**
 * PRD §5.6 — markdown transitive imports (the five-step algorithm). Called by injectFile's markdown branch
 * (a delivered .md/.markdown is an import source). Recursion contract:
 *   • RELATIVE-ONLY (§4.5 rule 1): imports starting with / or ~ are ignored (left verbatim) — only relative
 *     tokens resolve. (Contrast: top-level user tokens allow / and ~.)
 *   • CODE-EXEMPT (§5.6.1 / §4.5 rule 3): a #@ inside a fenced block or inline code span is NOT an import
 *     — left verbatim, never stripped. (Detection is approximate-CommonMark, reused from scanTokens.)
 *   • DEDUP-BOUNDED, NOT depth-limited (§12.13): each abs is claimed in state.injectedSet BEFORE its scan,
 *     so a self-import or cycle (a.md→b.md→a.md) dedups to verbatim and cannot recurse infinitely. The set
 *     of injectable files is finite and each is processed at most once — termination is guaranteed without
 *     a depth counter.
 *   • PRE-ORDER depth-first: this file's block is emitted (Step 4) BEFORE recursing into imports (Step 5),
 *     so the model sees a parent's context before the detail it pulls in.
 *   • VERBATIM DELIVERY (§6.4/§12.16): markers are detected here ONLY to resolve imports — they are NEVER
 *     stripped from the delivered content. The block is emitted on the verbatim `content` exactly as read
 *     from disk (import markers stay as honest references; the bytes also live in the custom message, §6.2).
 *
 * Five steps (PRD §5.6; Step 1 read/decode is in injectFile):
 *   2. Claim self (idempotent: injectFile pre-claimed abs; included for contract self-containedness).
 *   3. scanTokens(content, dirname(abs), { allowAbsTilde:false, skipCode:true, tryMdExt:true, bareAt:state.bareAt })
 *      → absPaths: string[] (resolved import paths in encounter order). §4.6 markdown-only bare-@ opt-in:
 *      passes bareAt: state.bareAt (the seam created in injectFiles — derived from cfg.markdownBareAtImports).
 *   4. emitText(abs, content, state) — the paged decision runs on the VERBATIM content (§6.4: markers NOT
 *      stripped). emitText owns the subtract + paged bump (NOT count).
 *   5. Recurse into absPaths in ENCOUNTER order: if not already claimed, await injectFile(abs) (which claims,
 *      classifies, bumps count, and recurses again if the import is itself markdown).
 *
 * PRIVATE — exercised indirectly via injectFiles (PRD §11 cases 15-19 + 20/MD1/MD2). Does NOT bump count
 * (injectFile owns the single count++ per claimed file; imports bump count in their own injectFile).
 *
 * @param abs     the importing markdown's absolute path (already claimed by injectFile; resolution base = dirname)
 * @param content the markdown's decoded UTF-8 content (buf.toString("utf8") from injectFile) — delivered VERBATIM
 * @param state   the shared State (blocks/images/injectedSet/remaining/count/paged) threaded across the prompt
 * @param ctx     threaded to the recursive injectFile calls (cwd unused — imports resolve from dirname(abs))
 */
async function injectMarkdown(abs: string, content: string, state: State, ctx: Ctx): Promise<void> {
  // Step 2 — CLAIM SELF (idempotent: injectFile already added abs; included per PRD §5.6 step-2 contract).
  state.injectedSet.add(abs);

  const dir = path.dirname(abs); // §4.5 rule 2 — imports resolve relative to the markdown's directory, not cwd

  // Step 3 — scan for imports: relative-only (allowAbsTilde:false), outside code (skipCode:true),
  // markdown shorthand ON (tryMdExt:true → extensionless tokens try .md then .markdown, PRD §4.5 rule 3).
  // §4.6 — thread state.bareAt (set from cfg in injectFiles — the P1.M2.T1.S1 seam) so a markdown author who
  // opts into markdownBareAtImports can write a bare @api.md. scanTokens returns the resolved import paths as
  // a string[] (absPaths, in encounter order); markers are detected ONLY to resolve imports, never stripped.
  const absPaths = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 4 — emit THIS file's block. The paged decision runs on the VERBATIM content (import markers are NOT
  // stripped — §6.4/§12.16: the file is delivered exactly as read from disk). emitText owns formatTextFileBlock
  // + subtract + the paged head/directive + state.paged++.
  emitText(abs, content, state);

  // Step 5 — recurse into the resolved imports, depth-first, ENCOUNTER ORDER (pre-order). The injectedSet
  // re-check is belt-and-suspenders (cross-subtree dedup since the scan).
  for (const abs2 of absPaths) {
    if (state.injectedSet.has(abs2)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(abs2, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
}

export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false, // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number; blocks: string[]; details: FileDetail[] }> {
  // §5.5 BUDGET — remaining context, computed ONCE (best-effort; never throws out of injectFiles).
  // The input event fires BEFORE the turn, so getContextUsage() may be undefined or its tokens
  // null (right after compaction). Either → remaining = null → O-1 fallback: inject WHOLE
  // (current behavior). When available: remaining = window - used - reserve - MARGIN, clamped ≥ 0.
  let remaining: number | null;
  try {
    const usage = ctx.getContextUsage?.();
    if (usage === undefined || usage.tokens === null) {
      remaining = null; // O-1 fallback: budget unknown → inject whole (no paging)
    } else {
      const reserve = ctx.model?.maxTokens ?? DEFAULT_RESERVE;
      remaining = Math.max(0, usage.contextWindow - usage.tokens - reserve - MARGIN);
    }
  } catch {
    remaining = null; // getContextUsage threw → O-1 fallback (PRD §12.5: never throw)
  }

  // PRIOR-INJECTION SET (defense-in-depth — validator finding F-NEW-1, recommendation #2). Collect
  // EVERY `<file name="<path>">` already present in `text` — whether stamped by a prior copy of THIS
  // extension that appended to the text, by a hand-edited prompt, or by Pi's own `@file` argv expander —
  // so per-token dedup below is robust to path-string quirks (a prior copy may have resolved against a
  // different cwd, expanded `~` differently, or been a legacy build). This is a SUPERSET of
  // a single exact-path substring test and is strictly additive: it never suppresses a token whose
  // resolved path is NOT already in the set, so multi-file prompts (inject A then B) still work even
  // when a prior copy already injected A. NOTE: like any in-this-copy check, it cannot stop a LATER
  // non-cooperating (pre-dedup) copy from re-injecting — see README's single-copy guidance. This
  // prior set SEEDS state.injectedSet, which is also grown by each within-run delivery below — the
  // two were separate locals before; they collapse here into one accumulator ("paths already claimed").
  const priorPaths = new Set<string>();
  for (const m of text.matchAll(/<file name="([^"]+)">/g)) {
    priorPaths.add(m[1]);
  }

  // SHARED STATE (PRD §9) — ONE object threaded through the loop (and, later, through a recursive
  // import chain). blocks/images/count/paged were scattered locals; injectedSet consolidates the
  // prior-injection set above WITH within-run dedup (Issue 1) — a per-token check of
  // injectedSet.has(abs) is equivalent to the old (priorPaths.has || injectedThisRun.has) because the
  // set at check time == {priorPaths} ∪ {abs paths successfully delivered so far this run}, grown by
  // .add(abs) at each success site. remaining is the single budget accumulator (subtract() mutates it).
  const state: State = {
    blocks: [],
    details: [], // PRD §6.4 — parallel to blocks; populated by emitText (and, in S2, injectFile's image/binary branches)
    images: [...imagesIn], // COPY — runner REPLACES the array on transform; seed originals (item §3a)
    injectedSet: priorPaths, // consolidated dedup: priorPaths ∪ within-run (added at each success)
    remaining,
    count: 0,
    paged: 0, // §5.5 paged-delivery counter — files delivered head+directive (subset of count)
    bareAt, // §4.6 — from the param; the SEAM injectMarkdown (P1.M2.T2.S1) reads via `bareAt: state.bareAt`
  };

  // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping.
  // processTokenStream scans ONCE (before any injection) then calls injectFile per resolved abs (PRD §12.17);
  // it returns void — it does NOT report marker indices, because markers are NEVER stripped from the prompt
  // (§6.4/§13.8: the user message is returned byte-for-byte verbatim so cancel/fork//tree re-open re-triggers
  // injection). Failed tokens (missing/dir/error) and deduped repeats are never injected → they keep '#@'
  // verbatim (§6.2). scanTokens' per-text localSeen + state.injectedSet give cross-subtree dedup (a later
  // token whose path an earlier import claimed is left verbatim); processTokenStream's belt-and-suspenders
  // injectedSet re-check is a no-op at top level (each abs is already unique in absPaths) but load-bearing
  // for markdown recursion.
  await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);

  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0, blocks: [], details: [] }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)

  // §6.4 / §13.8 — the user message is the ORIGINAL `text`, byte-for-byte VERBATIM. Markers are NEVER stripped
  // (no `#@` removal, no appended blocks, no `\n\n---\n\n`): stripping discards the triggers from the STORED
  // message, and Pi re-feeds that stored text on cancel / fork / `/tree`-navigate (`navigateTree` prefills the
  // editor from `targetEntry.message.content`, with no extension hook to override), so a stripped prompt would
  // never re-trigger injection. The file BYTES live only in the returned `blocks`/`details` (the caller — the
  // input handler — stashes them for `before_agent_start`'s custom message); the prompt carries nothing but the
  // user's original text. (The count===0 path above already returns this same `text` verbatim.)
  return { text, images: state.images, injected: state.count, paged: state.paged, blocks: state.blocks, details: state.details };
}

/**
 * #@file — Whole-File Injection Extension for Pi.
 *
 * Lets a user attach an ENTIRE file to their prompt by writing `#@<path>` anywhere in the submitted
 * text. On the `input` event — which fires inside `AgentSession.prompt()` for ALL input contexts
 * (interactive TUI messages, the initial CLI / `-p` / RPC message, and RPC calls alike) — every
 * `#@<path>` token is resolved, the whole file is read, and delivered to the model in Pi-native
 * `<file name="...">...</file>` blocks via a separate custom message in `before_agent_start`. The
 * prompt text itself is returned byte-for-byte VERBATIM (markers are never stripped, so cancel/fork/
 * `/tree` re-open re-triggers injection). Image files are attached as `ImageContent` (resized to
 * provider limits) plus a reference block; non-image binaries get a clear note instead of decoded
 * garbage.
 *
 * Trigger syntax:  `#@<path>`  — e.g. `#@src/index.ts`, `#@~/notes.md`, `#@pic.png`,
 *                  `(#@a.txt and #@b.md)`. The two-char `#@` trigger is collision-free with Pi's
 *                  `@file` / `@mention`, markdown `#` headings, issue `#1234`, and `user@host` email.
 *
 * Works everywhere: interactive, `pi -p "...#@file..."`, and RPC — because the hook is the `input`
 * event inside `prompt()`, not argv parsing (unlike Pi's built-in `@file` CLI expansion).
 *
 * The whole file always reaches the model: injected inline when it fits the remaining context budget,
 * or delivered as a head block plus a paging directive (instructing the model to read the rest via the
 * read tool) when it exceeds it (PRD §5.5). The budget is derived from the active model context window
 * and current usage — no user-facing config. Images are downscaled (2000×2000) because providers reject
 * oversized images. The handler short-circuits (`continue`) when the input originated
 * from an extension (loop prevention), is a mid-stream steering nudge (latency), or simply has no `#@`
 * token — and it never throws (injectFiles isolates each file in its own try/catch).
 */
/** §4.6 — the cached file-injector.json config. MODULE-LEVEL (NOT a factory closure): the test harness's
 *  captureHandler calls the factory (mod.default(pi)) fresh per capture, so a closure cfg would reset to {}
 *  on each capture and the session_start→input flow could not share state. Module-level persists across
 *  captures (and is identical in the real single-invocation runtime). Loaded once on session_start via
 *  readConfig; read by the input handler to derive bareAt. */
let cfg: FileInjectorConfig = {};

export default function (pi: ExtensionAPI) {
  // §6.2/§12.20 — one-shot handoff stash from the input handler to before_agent_start. input produces the
  // work (file I/O + blocks/details); before_agent_start publishes it as the custom message after the user
  // message. prompt() runs input → … → before_agent_start sequentially (one awaited call), so there is no race.
  // CLOSURE var (NOT module-level like cfg above): pending is a per-prompt handoff between two handlers from
  // this same factory invocation; closure scope is correct and per-session. Cleared unconditionally in
  // before_agent_start (one-shot per prompt, §12.20) so a later no-#@ prompt never re-delivers a stale stash.
  let pending: { blocks: string[]; details: FileDetail[] } | null = null;

  // §4.6 — load file-injector.json config on session_start (provides ctx.cwd + ctx.isProjectTrusted()).
  // Registered FIRST so captureHandler("session_start").all[0] is this handler. readConfig NEVER throws
  // (tryRead → {}), so this can't break the session. A separate handler (not merged into autocomplete)
  // so the autocomplete handler + its A1 test stay byte-for-byte (A1 invokes the autocomplete handler
  // with a minimal ctx that lacks isProjectTrusted — merging would call readConfig there and throw).
  pi.on("session_start", async (_e, ctx) => {
    cfg = await readConfig(ctx);
    // §6.3 register the chat renderer ONCE (the display contract T2.S1's before_agent_start set with display:true).
    // No hasUI guard — renderers are no-ops in print/json (the renderer fn is only invoked by CustomMessageComponent
    // in TUI mode). customType MUST match before_agent_start's "fileInjector.injected" exactly (the handshake).
    pi.registerMessageRenderer("fileInjector.injected", (message, opts, theme) =>
      renderInjectedMessage(message, opts, theme));
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" }; // MANDATORY loop prevention (§12.1)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // skip mid-stream steering for latency (§12.2)
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

    const { text, images, injected, paged, blocks, details } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true); // §5.5 — paged count drives the mode-aware notify below; §4.6 — bareAt derived from cached cfg; §6.2 — blocks/details stashed for before_agent_start
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered (no stash set → before_agent_start returns undefined)

    // §6.2 hand the built blocks+details to before_agent_start (the custom message). Only stashed when
    // injected > 0 (the !injected early-return above left no stash). Cleared one-shot in before_agent_start.
    pending = { blocks, details };

    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). Unified wording: always
    // "N whole"; append ", M paged" only when paging. paged===0 → "#@ injected N whole"; paged>0 →
    // "#@ injected N whole, M paged".
    const whole = injected - paged;
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // §5.5 unified whole/paged wording; guarded for print/json headless modes (api_verification §5)
    return { action: "transform" as const, text: event.text, images }; // §6.4 — text VERBATIM (event.text, unchanged; the prompt is never modified so cancel/fork/re-open re-triggers injection; §13.8)
  });

  // §6.2 publish the stashed files as ONE custom message, appended after the user message. Fires once per
  // prompt(), after the input handler. No stash (no #@, or short-circuited, or nothing injected) → return
  // undefined (no-op). The customType "fileInjector.injected" is the handshake with the MessageRenderer T2.S2
  // registers; until then Pi renders its default [fileInjector.injected] box (delivery to the model — via
  // convertToLlm role:custom→user — works regardless of rendering). Cleared unconditionally (one-shot, §12.20).
  pi.on("before_agent_start", async (_e, _ctx) => {
    if (!pending) return undefined;
    const { blocks, details } = pending;
    pending = null; // clear regardless — one-shot per prompt (a later no-#@ prompt never re-delivers)
    computeDetailOffsets(blocks, details); // §12.22 (P1.M2.T1.S1) — absolute body offsets so the renderer slices message.content WITHOUT duplicating file bytes into details (BUG-1-safe: length-derived, not regex)
    return {
      message: {
        customType: "fileInjector.injected", // the renderer's registered customType (T2.S2 registers it)
        content: blocks.join("\n\n"),        // every <file> block → sent to the LLM (convertToLlm: custom→user)
        display: true,                       // render in the TUI (renderer registered in T2.S2; Pi's default
                                             //   [fileInjector.injected] box shows until then — acceptable interim)
        details: { files: details },         // renderer metadata (NOT extra model text; convertToLlm ignores details)
      },
    };
  });

  // ── #@ path autocomplete (TUI/RPC only) ─────────────────────────────────────
  // pi's built-in `@` completion lists files (gitignore-aware, via `fd`) but only fires when `@`
  // sits at a token boundary; `#` glued in front closes it, so `#@` gets no completion on its own
  // (verified: merely opening the shouldTriggerFileCompletion gate for `#@` yields nothing — pi's
  // @-query extraction is itself boundary-strict). So instead we REUSE pi's file engine without
  // reimplementing it: when the cursor is at `#@<partial>`, rewrite that one '#' into a space
  // (giving the built-in a clean `@<partial>` at a valid boundary), delegate getSuggestions to the
  // built-in, then remap the result back to `#@` (prefix `@<partial>` → `#@<partial>`; each item
  // value `@<path>` → `#@<path>`). applyCompletion is handled here for our `#@` prefix so insertion
  // is deterministic; everything else delegates. TUI/RPC only (headless print/json is a no-op);
  // `pi -p "...#@file..."` is unaffected.
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.ui || typeof ctx.ui.addAutocompleteProvider !== "function") return; // headless print/json guard
    ctx.ui.addAutocompleteProvider((current) => ({
      triggerCharacters: ["@"], // typing the @ in #@ (re)evaluates suggestions
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const line = lines[cursorLine] ?? "";
        const before = line.slice(0, cursorCol);
        const m = before.match(/#@([^@\s]*)$/); // our trigger ending at the cursor
        if (!m) return current.getSuggestions(lines, cursorLine, cursorCol, options); // not #@ → built-in owns it
        const partial = m[1];

        // Rewrite the '#' immediately before our '@' into a space. The '@', the partial, and the
        // cursor position are unchanged, so the built-in lists exactly the files it would for a
        // normal `@<partial>` mention — gitignore-aware, sorted, fuzzy — via `fd`.
        const hashIdx = cursorCol - partial.length - 2; // index of '#' (before '@' + partial)
        if (hashIdx < 0) return current.getSuggestions(lines, cursorLine, cursorCol, options);
        const rewrittenLine = line.slice(0, hashIdx) + " " + line.slice(hashIdx + 1);
        const rewrittenLines = lines.slice();
        rewrittenLines[cursorLine] = rewrittenLine;

        const inner = await current.getSuggestions(rewrittenLines, cursorLine, cursorCol, options);
        if (options.signal?.aborted || !inner || inner.items.length === 0) return inner; // nothing / aborted
        // Only remap built-in FILE suggestions (prefix `@…`). If the built-in somehow returned
        // non-@ items, pass them through untouched so we don't mangle slash-command suggestions.
        if (!inner.prefix.startsWith("@")) return inner;

        const items = inner.items.map((it) => {
          let v = it.value;
          if (!v.startsWith("#@")) v = v.startsWith("@") ? "#" + v : "#@" + v; // @path → #@path
          return v === it.value ? it : { ...it, value: v };
        });
        return { prefix: `#@${partial}`, items };
      },
      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        // Deterministic insert for our #@ items: replace `prefix` (which ends at the cursor) with
        // `item.value`, place the cursor just past it. Delegate anything else to the built-in.
        if (typeof prefix === "string" && prefix.startsWith("#@")) {
          const line = lines[cursorLine] ?? "";
          const before = line.slice(0, cursorCol);
          if (before.endsWith(prefix)) {
            const start = cursorCol - prefix.length;
            const value = typeof item?.value === "string" ? item.value : "";
            const newLines = lines.slice();
            newLines[cursorLine] = before.slice(0, start) + value + line.slice(cursorCol);
            return { lines: newLines, cursorLine, cursorCol: start + value.length };
          }
        }
        return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      },
      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true; // built-in decides
      },
    }));
  });
}
