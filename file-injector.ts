import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, CONFIG_DIR_NAME, getAgentDir, type ResizedImage } from "@earendil-works/pi-coding-agent";
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
 *  INLINE_CODE_RE: a backtick run closed by a run of the SAME length (backreference \1), non-greedy,
 *    not followed by another backtick. `g` flag for matchAll (matchAll clones — no lastIndex reset needed).
 *  FENCE_OPEN_RE: line-anchored (use against a single line, not full text); 0-3 leading spaces then a
 *    run of >= 3 backticks or tildes. Group 1 = the fence run (char + length drive open/close matching). */
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;   // PRD §5.6.1 (exact form)
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
 *    3. ONLY when `tryMdExt` is true AND the cleaned token is extensionless (`path.extname(token) === ""`):
 *       try `abs + ".md"`, then `abs + ".markdown"` — first existing regular file wins (`#@PRD` → `PRD.md`);
 *    4. otherwise → `null` (nothing resolved; the caller leaves the `#@` marker verbatim).
 *  `tryMdExt` is `true` for markdown imports (§4.5 shorthand) and `false` for top-level user tokens
 *  (§4.4 exact-only — top-level prompt behavior is byte-for-byte identical to today). Tokens already
 *  ending in `.md`/`.markdown` or any extension are exact-only (`#@PRD.md` never becomes `PRD.md.md`).
 *  Dotfiles: `path.extname(".env") === ""` technically qualifies for the fallback, BUT exact-match-wins
 *  returns a bare `.env` before the `.md` fallback runs (follows PRD §4.5 literally — no dotfile exclusion).
 *  Pure: only stats paths, never mutates `state` (preserves the scan-then-inject separation for dedup). */
export async function resolveImportPath(
  token: string,
  baseDir: string,
  tryMdExt: boolean,
): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir); // §4.4 — ~ expand + resolve(baseDir) — NO stat
  if (await isRegularFile(abs)) return abs;          // §4.5 rule 3 — EXACT MATCH ALWAYS WINS
  if (tryMdExt && path.extname(token) === "") {     // §4.5 rule 3 — extensionless shorthand ONLY
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;                                       // nothing resolved → caller leaves marker verbatim
}

/** §4.6 — file-injector.json config shape. markdownBareAtImports: also match bare "@path" in markdown
 *  (opt-in). Loaded on session_start (P1.M2.T1.S1); missing/malformed → {} → markdownBareAtImports
 *  undefined → treated as false downstream. */
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

/** PRD §4.6 / §9 — read file-injector.json config. GLOBAL first (~/.pi/agent/file-injector.json via
 *  getAgentDir()), then PROJECT-if-trusted (<cwd>/.pi/file-injector.json via CONFIG_DIR_NAME=".pi"),
 *  shallow-merged (project wins: `{ ...global, ...project }`). Missing or malformed EITHER file →
 *  default {} (markdownBareAtImports undefined → false downstream). NEVER throws (tryRead catches all
 *  read/parse errors → {}). The narrow `{cwd, isProjectTrusted}` ctx (only the two fields used) makes it
 *  unit-testable with a literal mock; do NOT type it as `any` (item §3). Consumed by P1.M2.T1.S1's
 *  session_start handler (`cfg = await readConfig(ctx)`). */
export async function readConfig(ctx: { cwd: string; isProjectTrusted: () => boolean }): Promise<FileInjectorConfig> {
  const tryRead = async (p: string): Promise<FileInjectorConfig> => {
    try {
      return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}");
    } catch {
      return {};
    }
  };
  // GLOBAL first (~/.pi/agent/file-injector.json).
  let cfg: FileInjectorConfig = await tryRead(path.join(getAgentDir(), "file-injector.json"));
  // PROJECT-if-trusted (<cwd>/.pi/file-injector.json), shallow-merged (project wins).
  if (ctx.isProjectTrusted()) {
    cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
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

/**
 * PRD §9 / §5.5 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read
 * each, and append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image). The
 * whole file ALWAYS reaches the model: injected inline when it fits the remaining context budget,
 * paged via the model's `read` tool when it does not (PRD §5.5). NEVER throws (each file is isolated
 * in try/catch); tokens that miss/are directories/throw are left verbatim. The original prompt text is
 * NOT modified — blocks are appended after `\n\n---\n\n`, joined with `\n\n` (PRD §6.2). `ctx` carries
 * the budget inputs `getContextUsage()` (tokens used) and `model` (contextWindow/maxTokens); both
 * optional so a cwd-only ctx is valid. `injected` counts whole-file injections; `paged` counts files
 * delivered via the page path (PRD §5.5). Return `{injected:0, paged:0}` => caller returns
 * {action:"continue"}; otherwise {action:"transform", text, images}.
 *
 * Internal state is carried in ONE shared `State` object (PRD §9) — `blocks`, `images`,
 * `injectedSet` (consolidated dedup: prior `<file>` blocks ∪ within-run deliveries), `remaining`
 * (the single budget accumulator), `count`, `paged` — so a later task can thread the same state
 * through a recursive import chain. The `remaining` budget currently covers TEXT injections only
 * (inline whole + paged head); it is computed once here and forward-references a WHOLE-PROMPT budget
 * that will also span markdown imports once they land (PRD §5.6.2) — at which point image/binary
 * deliveries will likewise call `subtract`.
 */
interface State {
  blocks: string[];
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
 *  2. INLINE CODE — run INLINE_CODE_RE over the full text; each match's full span [index, index+len)
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
    const closeRe = new RegExp("^ {0,3}" + escapeRegex(fenceChar) + "{" + fenceLen + ",}[ \\t]*$");

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

  // 2. INLINE CODE — spans NOT fully inside any fenced range.
  for (const m of content.matchAll(INLINE_CODE_RE)) {
    const spanStart = m.index!;
    const spanEnd = spanStart + m[0].length;
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

/** Shared ctx type for injectFiles / processTokenStream / injectFile (DRY; jiti erases at runtime). */
type Ctx = {
  cwd: string;
  getContextUsage?: () =>
    { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
  model?: { contextWindow: number; maxTokens: number } | undefined;
};

/**
 * PRD §9 / §5.6 step 3 — scan a text (user prompt OR markdown content) for `#@` tokens that resolve,
 * WITHOUT injecting. Pure (no I/O, no state mutation beyond the per-text localSeen set). Per-text dedup
 * via localSeen; global state.injectedSet check skips already-claimed paths (prior <file> blocks OR files
 * injected earlier this run / in a parent recursion). Returns { index; abs }[] in text order.
 *
 * opts.skipCode: when true, scanTokens precomputes code regions once and skips any `#@` match whose
 *   start index lies inside a fenced block or inline code span (PRD §5.6.1). null codeRanges when false →
 *   inCode is never called → top-level (user-prompt) behavior is unchanged. Markdown imports (T2.S3)
 *   pass skipCode:true.
 * opts.allowAbsTilde: when false, tokens starting with / or ~ are dropped (markdown relative-only, §4.5).
 * opts.tryMdExt: when true, an extensionless token whose exact path is not a regular file falls back to
 *   `<exact>.md` then `<exact>.markdown` (markdown-import shorthand, PRD §4.5 rule 3). Top-level user-prompt
 *   scan passes `false` (§4.4 exact-only → top-level behavior is byte-for-byte identical to today).
 * opts.bareAt: OPTIONAL. When truthy, scanTokens ALSO matches bare `@path` markers (BARE_AT_RE, PRD §4.6)
 *   alongside the `#@` markers, returning a union of candidate records sorted by index. Each record carries
 *   `prefixLen` (2 for `#@`, 1 for a bare `@`) so a consumer can strip the correct marker width. Markdown-
 *   only / opt-in; the two regexes never double-match the same `#@` (BARE_AT_RE forbids a preceding `#`).
 *   When absent/false, ONLY `#@` matches run → byte-for-byte identical to the single-regex form.
 *
 * Returns { index; prefixLen; abs }[] in text order (prefixLen is the marker char width: 2 for `#@`, 1 for `@`).
 */
export async function scanTokens(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt?: boolean },
  state: State,
): Promise<{ index: number; prefixLen: number; abs: string }[]> {
  const localSeen = new Set<string>();
  const out: { index: number; prefixLen: number; abs: string }[] = [];
  // §5.6.1 — when scanning markdown content, precompute code regions once and skip `#@` matches whose
  // start index lies inside a fenced block or inline code span (the markdown escape hatch, §4.5 rule 3).
  // null when skipCode:false (top-level user-prompt scan) → inCode is never called → no behavior change.
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  // Candidate markers: `#@` always (prefixLen 2); bare `@` only when opts.bareAt (prefixLen 1). BARE_AT_RE
  // forbids a preceding `#`, so `#@file` appears once (via FILE_INJECT_RE), never twice. When bareAt is
  // absent/false, cands holds only the FILE_INJECT_RE matches in index-ascending order (matchAll yields
  // ascending), so the sort is a no-op and the per-candidate body below is byte-for-byte identical to the
  // prior single-loop form.
  const cands: { idx: number; token: string; prefixLen: number }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 2 });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2], prefixLen: 1 });
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
    out.push({ index: c.idx, prefixLen: c.prefixLen, abs });
  }
  return out;
}

/**
 * PRD §9 / §12.17 — top-level processor. Scan the text ONCE (before any injection), then inject each
 * resolved token depth-first via injectFile. Returns the start indices of markers that resolved, in scan
 * order, for `#@` stripping by injectFiles. Scan-before-inject gives cross-subtree dedup (a later token
 * whose path an earlier import claimed is left verbatim). PRIVATE — exercised indirectly via injectFiles.
 *
 * The belt-and-suspenders `state.injectedSet.has(r.abs)` re-check is a NO-OP at top level in T1.S2
 * (scanTokens' localSeen already made each abs unique in records); it becomes load-bearing in T2 when
 * injectFile recurses into markdown imports.
 *
 * `opts.tryMdExt` is threaded straight through to scanTokens/resolveImportPath: the top-level user-prompt
 * call site passes `false` (§4.4 exact-only), and the markdown-import path passes `true` (§4.5 shorthand).
 */
async function processTokenStream(
  text: string,
  baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State,
  ctx: Ctx,
): Promise<number[]> {
  const records = await scanTokens(text, baseDir, opts, state); // scan once, before any injection (opts carries tryMdExt)
  const resolved: number[] = [];
  for (const r of records) {
    if (state.injectedSet.has(r.abs)) continue; // cross-subtree dedup since scan (no-op at top level in T1.S2)
    const ok = await injectFile(r.abs, state, ctx); // claims abs, emits block(s); never throws
    if (ok) resolved.push(r.index);
  }
  return resolved;
}

/**
 * PRD §9 / §5.1-§5.3 — stat → claim → classify → emit → count. Claims `abs` in state.injectedSet AFTER
 * stat+isFile succeed but BEFORE read, so a self-import or mid-recursion re-entry dedups to verbatim
 * (recursion-readiness for T2 markdown; behavior-neutral at top level). NEVER throws: stat miss / !isFile
 * / read or resize error → return false (token left verbatim, PRD §5.4 / §12.5).
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
  state.injectedSet.add(abs); // CLAIM — dedup incl. self-import (recursion-readiness)

  const ext = extOf(abs); // lowercase ext, "" for no-dot/hidden (S2)
  const mime = MIME_BY_EXT[ext]; // undefined → not a recognized image → text/binary path
  try {
    const buf = await fs.readFile(abs); // read ONCE; reused by image + text/binary paths
    if (mime && buf.length === 0) {
      // F5 — a 0-byte image file would attach an EMPTY ImageContent (which providers reject).
      // Align with the text path's empty-file handling: emit a note block, attach nothing.
      const f5Block = formatEmptyImageBlock(abs);
      state.blocks.push(f5Block);
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
      subtract(state, Math.ceil(binBlock.length / 4)); // §5.6.2 — note consumes budget
    } else {
      // PLAIN TEXT (PRD §5.1 + §5.5) — inline-vs-paged decision (lifted verbatim into emitText)
      emitText(abs, buf.toString("utf8"), state);
    }
    state.count++; // exactly one delivery per claimed file
    return true;
  } catch {
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
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    // INLINE (whole) — current behavior preserved (PRD §5.1)
    state.blocks.push(formatTextFileBlock(abs, content));
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
      subtract(state, fileCost);
    } else {
      state.blocks.push(formatTextFileBlock(abs, head));
      state.blocks.push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head)));
      state.paged++;
      subtract(state, Math.ceil(HEAD_CHARS / 4));
    }
  }
}

/**
 * PRD §5.6 — markdown transitive imports (the six-step algorithm). Called by injectFile's markdown branch
 * (a delivered .md/.markdown is an import source). Recursion contract:
 *   • RELATIVE-ONLY (§4.5 rule 1): imports starting with / or ~ are ignored (left verbatim) — only relative
 *     tokens resolve. (Contrast: top-level user tokens allow / and ~.)
 *   • CODE-EXEMPT (§5.6.1 / §4.5 rule 3): a #@ inside a fenced block or inline code span is NOT an import
 *     — left verbatim, never stripped. (Detection is approximate-CommonMark, reused from scanTokens.)
 *   • DEDUP-BOUNDED, NOT depth-limited (§12.13): each abs is claimed in state.injectedSet BEFORE its scan,
 *     so a self-import or cycle (a.md→b.md→a.md) dedups to verbatim and cannot recurse infinitely. The set
 *     of injectable files is finite and each is processed at most once — termination is guaranteed without
 *     a depth counter.
 *   • PRE-ORDER depth-first: this file's block is emitted (Step 5) BEFORE recursing into imports (Step 6),
 *     so the model sees a parent's context before the detail it pulls in.
 *
 * Six steps (PRD §5.6):
 *   2. Claim self (idempotent: injectFile pre-claimed abs; included for contract self-containedness).
 *   3. scanTokens(content, dirname(abs), { allowAbsTilde:false, skipCode:true, bareAt:state.bareAt }) → resolved
 *      import records. §4.6 markdown-only bare-@ opt-in: passes `bareAt: state.bareAt` (the seam P1.M2.T1.S1
 *      created — state.bareAt is derived from cfg.markdownBareAtImports in injectFiles). bareAt:false (default)
 *      → BARE_AT_RE not run → byte-for-byte identical to today (all records prefixLen 2).
 *   3.5. EXISTENCE PRE-CHECK (PRD §10 / §5.4): scanTokens records a token as soon as it RESOLVES (it does
 *      NOT stat), so a markdown import resolving to a MISSING file or DIRECTORY would otherwise have its
 *      '#@' marker stripped (Step 4) even though injectFile later returns false and nothing is injected for
 *      it. PRD §10 requires such markers be left VERBATIM. Pre-order (Step 6) emits THIS file's block BEFORE
 *      recursing, so the strip decision must be made NOW — unlike the top-level path (processTokenStream),
 *      which can inject-then-strip because the user prompt is not a pre-order block. Stat each import; keep
 *      only those that stat-succeed AND are regular files (isFile also rejects directories, matching §5.4
 *      and injectFile's own check). injectFile re-stats harmlessly on recursion. `injectable ⊆ records`, and
 *      `injectable` carries `prefixLen` (forwarded from records) so Step 4 can strip the correct marker width.
 *   4. Strip the marker from each INJECTABLE record (high→low, leaving the path) by `r.index + r.prefixLen`
 *      → `stripped` = block content. prefixLen is 2 for `#@` (r.index is the '#'), 1 for bare `@` (r.index is
 *      the '@'); both regexes' lookbehinds are zero-width, so r.index is always the marker's first char.
 *      Missing/dir imports keep the marker verbatim. Unresolved/deduped/absolute/inside-code markers were never
 *      in records and keep the marker verbatim. (byte-for-byte default: every default record has prefixLen 2,
 *      so `+ r.prefixLen` == the old `+ 2`.)
 *   5. emitText(abs, stripped, state) — the paged decision runs on the STRIPPED content (so directive text
 *      the model won't see does not bias the budget). emitText owns the subtract + paged bump (NOT count).
 *   6. Recurse into INJECTABLE imports in ENCOUNTER order: if not already claimed, await injectFile(abs)
 *      (which claims, classifies, bumps count, and recurses again if the import is itself markdown).
 *
 * PRIVATE — exercised indirectly via injectFiles (PRD §11 cases 15-19 + 20/MD1/MD2). Does NOT bump count
 * (injectFile owns the single count++ per claimed file; imports bump count in their own injectFile).
 *
 * @param abs     the importing markdown's absolute path (already claimed by injectFile; resolution base = dirname)
 * @param content the markdown's decoded UTF-8 content (buf.toString("utf8") from injectFile)
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
  // opts into markdownBareAtImports can write a bare @api.md (prefixLen 1). bareAt:false (default) → BARE_AT_RE
  // is not run → records are byte-for-byte identical to today (all prefixLen 2).
  const records = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 3.5 — EXISTENCE PRE-CHECK (PRD §10 / §5.4). scanTokens records a token as soon as it RESOLVES (it
  // does NOT stat), so a markdown import resolving to a MISSING file or DIRECTORY would otherwise have its
  // '#@' marker stripped (Step 4) even though injectFile later returns false and nothing is injected for it.
  // PRD §10 requires such markers be left VERBATIM. Pre-order (§5.6 step 6) emits THIS file's block BEFORE
  // recursing, so the strip decision must be made NOW (the top-level path can inject-then-strip because the
  // user prompt is not a pre-order block; the markdown path cannot). Stat each import; keep only those that
  // stat-succeed AND are regular files (isFile also rejects directories, matching injectFile's own check and
  // §5.4: directory → verbatim). injectFile re-stats harmlessly on recursion.
  // TYPE-ONLY widening: records carry prefixLen (scanTokens P1.M1.T1.S1); widening the declared element type
  // lets Step 4 read r.prefixLen. The filter body (injectable.push(r)) forwards the WHOLE record unchanged —
  // do NOT build a new object literal here (that would DROP prefixLen, the codebase_delta §8.2 anti-pattern).
  const injectable: { index: number; prefixLen: number; abs: string }[] = [];
  for (const r of records) {
    try {
      const st = await fs.stat(r.abs);
      if (st.isFile()) injectable.push(r);
    } catch {
      /* missing/unreadable → leave verbatim (not stripped, not injected) */
    }
  }

  // Step 4 — strip the marker from each INJECTABLE import (high→low so earlier offsets stay valid), leaving
  // the path. `stripped` becomes THIS file's block content. Missing/dir imports keep the marker verbatim.
  // §4.6 — strip by the marker's width: prefixLen 2 for `#@` (r.index is the '#'), 1 for bare `@` (r.index is
  // the '@'); both regexes' lookbehinds are zero-width, so r.index is always the marker's first char.
  let stripped = content;
  for (const r of [...injectable].sort((a, b) => b.index - a.index)) {
    stripped = stripped.slice(0, r.index) + stripped.slice(r.index + r.prefixLen);
  }

  // Step 5 — emit THIS file's block. The paged decision runs on the STRIPPED content (§5.6 step 5).
  emitText(abs, stripped, state); // emitText owns formatTextFileBlock + subtract + the paged head/directive + state.paged++

  // Step 6 — recurse into INJECTABLE imports, depth-first, ENCOUNTER ORDER (pre-order). Missing/dir imports
  // are absent here (they would no-op in injectFile anyway). The injectedSet re-check is belt-and-suspenders
  // (cross-subtree dedup since the scan).
  for (const r of injectable) {
    if (state.injectedSet.has(r.abs)) continue; // already claimed (e.g. by a sibling subtree meanwhile)
    await injectFile(r.abs, state, ctx); // claims abs, classifies, bumps count, recurses again if markdown
  }
}

export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: Ctx,
  bareAt = false, // §4.6 — markdown bare-@ enabled? (derived from cfg in the input handler; default false for direct unit tests)
): Promise<{ text: string; images: ImageContent[]; injected: number; paged: number }> {
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
  // extension (under the `\n\n---\n\n` separator, PRD §6.2) or by Pi's own `@file` argv expander — so
  // per-token dedup below is robust to path-string quirks (a prior copy may have resolved against a
  // different cwd, expanded `~` differently, or been a sentinel/legacy build). This is a SUPERSET of
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
    images: [...imagesIn], // COPY — runner REPLACES the array on transform; seed originals (item §3a)
    injectedSet: priorPaths, // consolidated dedup: priorPaths ∪ within-run (added at each success)
    remaining,
    count: 0,
    paged: 0, // §5.5 paged-delivery counter — files delivered head+directive (subset of count)
    bareAt, // §4.6 — from the param; the SEAM injectMarkdown (P1.M2.T2.S1) reads via `bareAt: state.bareAt`
  };

  // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping.
  // processTokenStream scans ONCE (before any injection) then calls injectFile per record (PRD §12.17),
  // returning the start indices of markers that ACTUALLY injected. Failed tokens (missing/dir/error)
  // and deduped repeats are never returned → they keep '#@' verbatim (PRD §6.2). scanTokens' per-text
  // localSeen + state.injectedSet give cross-subtree dedup (a later token whose path an earlier import
  // claimed is left verbatim); processTokenStream's belt-and-suspenders injectedSet re-check is a no-op
  // at top level in T1.S2 (each abs is already unique in records) but load-bearing for T2 recursion.
  const resolvedIdx = await processTokenStream(
    text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);

  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)

  // Strip the #@ trigger from each inline marker — the PATH stays put as a readable reference. The
  // model doesn't need the #@ syntax (the appended <file name="abs"> blocks carry the data), and
  // every #@ is 2 tokens of pure noise. Reached only when count > 0, so the nothing-injected path
  // above still returns the prompt byte-for-byte (missing/dir/error tokens keep their #@ verbatim).
  // §6.2 — strip the '#@' trigger ONLY from tokens that ACTUALLY injected. Failed tokens
  // (missing/dir/error) and deduped repeats were never returned, so they keep '#@' verbatim.
  // INDEX-BASED SPLICE (not substring replace): an injected match can be a prefix of another token
  // (e.g. '#@a.ts' ⊂ '#@a.ts.bak'), so a substring replace would corrupt the longer token. Group 1
  // of FILE_INJECT_RE is zero-width → m.index is exactly the '#'; removing 2 chars drops exactly
  // '#@'. Process high→low so earlier offsets stay valid.
  let strippedText = text;
  for (const i of [...resolvedIdx].sort((a, b) => b - a)) {
    strippedText = strippedText.slice(0, i) + strippedText.slice(i + 2);
  }
  const finalText = `${strippedText}\n\n---\n\n${state.blocks.join("\n\n")}`; // append below the stripped prompt (PRD §6.2)
  return { text: finalText, images: state.images, injected: state.count, paged: state.paged };
}

/**
 * #@file — Whole-File Injection Extension for Pi.
 *
 * Lets a user attach an ENTIRE file to their prompt by writing `#@<path>` anywhere in the submitted
 * text. On the `input` event — which fires inside `AgentSession.prompt()` for ALL input contexts
 * (interactive TUI messages, the initial CLI / `-p` / RPC message, and RPC calls alike) — every
 * `#@<path>` token is resolved, the whole file is read, and its contents are appended to the prompt in
 * Pi-native `<file name="...">...</file>` blocks below a `---` separator. Image files are attached as
 * `ImageContent` (resized to provider limits) plus a reference block; non-image binaries get a clear
 * note instead of decoded garbage.
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
  // §4.6 — load file-injector.json config on session_start (provides ctx.cwd + ctx.isProjectTrusted()).
  // Registered FIRST so captureHandler("session_start").all[0] is this handler. readConfig NEVER throws
  // (tryRead → {}), so this can't break the session. A separate handler (not merged into autocomplete)
  // so the autocomplete handler + its A1 test stay byte-for-byte (A1 invokes the autocomplete handler
  // with a minimal ctx that lacks isProjectTrusted — merging would call readConfig there and throw).
  pi.on("session_start", async (_e, ctx) => { cfg = await readConfig(ctx); });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" }; // MANDATORY loop prevention (§12.1)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // skip mid-stream steering for latency (§12.2)
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx, cfg.markdownBareAtImports === true); // §5.5 — paged count drives the mode-aware notify below; §4.6 — bareAt derived from cached cfg
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1); injected counts whole+paged, so 0 = nothing delivered

    // §5.5 Notify — surface the mode, guarded on ctx.hasUI (PRD §5.5 Notify). Unified wording: always
    // "N whole"; append ", M paged" only when paging. paged===0 → "#@ injected N whole"; paged>0 →
    // "#@ injected N whole, M paged".
    const whole = injected - paged;
    const msg = `#@ injected ${whole} whole${paged > 0 ? `, ${paged} paged` : ""}`;
    if (ctx.hasUI) ctx.ui.notify(msg, "info"); // §5.5 unified whole/paged wording; guarded for print/json headless modes (api_verification §5)
    return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images
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
