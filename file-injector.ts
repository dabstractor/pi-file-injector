import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const FILE_INJECT_RE = /(^|(?<![\p{L}\p{N}_]))#@(\S+)/gu;
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
const DEFAULT_WINDOW = 200000;  // fallback context window when ctx.model?.contextWindow is absent
const DEFAULT_RESERVE = 8192;   // fallback for ctx.model?.maxTokens when model is absent
const READ_LIMIT = 2000;        // read tool DEFAULT_MAX_LINES — page size emitted in the directive

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

/** PRD §5.5 — directive block for a paged (oversize) text file. Emits a <file name="abs"> note
 *  giving the full path + estimated size and instructing the model to read the REMAINDER past the
 *  injected head via the read tool. `startLine` is the 1-indexed line at which the model should
 *  resume (computed from the ACTUAL line count of the head so the directive is internally
 *  consistent for ANY line length — never the hardcoded 2001 that assumed 8192 chars = 2000 lines);
 *  Pi read offset is 1-indexed, limit is DEFAULT_MAX_LINES=READ_LIMIT=2000, and the model increments
 *  offset by READ_LIMIT until done. `injectedLines` is the count of complete lines in the head (for
 *  the wording). Reuses the em dash (U+2014) from formatBinaryBlock/formatEmptyImageBlock. */
export function formatPagedDirectiveBlock(abs: string, totalBytes: number, startLine: number, injectedLines: number): string {
  return '<file name="' + abs + '"><large file \u2014 estimated ' + totalBytes + ' bytes; first ' + injectedLines + ' lines injected above. Use the read tool to read the rest: offset:' + startLine + ', limit:' + READ_LIMIT + ', incrementing offset by ' + READ_LIMIT + ' until the entire file is read></file>';
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
}

/** PRD §9 — subtract a cost from the shared budget, no-op when the budget is unknown (null).
 *  NOT exported (internal). Used by the text paged/inline paths now; image/binary in a later task. */
function subtract(state: State, cost: number): void {
  if (state.remaining !== null) {
    state.remaining = Math.max(0, state.remaining - cost);
  }
}

export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: {
    cwd: string;
    getContextUsage?: () =>
      { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
    model?: { contextWindow: number; maxTokens: number } | undefined;
  },
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
  };

  // Issue 2 — start indices of tokens that ACTUALLY injected (pushed at each success site below).
  // Used after the loop to strip '#@' from EXACTLY those tokens (failed/dir/error and deduped
  // repeats are never pushed → they keep '#@' verbatim, PRD §6.2). Group 1 of FILE_INJECT_RE is
  // zero-width, so m.index is exactly the '#'; splicing out 2 chars drops exactly '#@'.
  const injectedIndexes: number[] = [];

  for (const m of text.matchAll(FILE_INJECT_RE)) {
    const raw = m[2]; // capture group 2 = path token after #@ (group 1 is the zero-width ^ anchor)
    const token = cleanToken(raw); // trim trailing punctuation (S2)
    if (!token) continue; // empty after trim => skip, leave verbatim

    const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

    // PER-TOKEN DEDUP — if a <file> block for this exact absolute path was already injected (by a
    // prior copy in the runner's input-handler chain, by Pi's own @file expander, OR earlier in THIS
    // run), skip re-injecting. state.injectedSet consolidates the prior-injection set with the
    // within-run set (Issue 1); a same-path repeat in one prompt (e.g. "Compare #@a.ts with #@a.ts",
    // or "#@a.ts" + "#@./a.ts") therefore injects ONCE. Cooperation-independent: works even when the
    // prior copy was a non-sentinel version. Fixes Issue 1.
    if (state.injectedSet.has(abs)) continue;

    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue; // missing file => leave token verbatim (PRD §5.4)
    }
    if (!st.isFile()) continue; // directory / socket / etc. => leave token verbatim (PRD §5.4)

    const ext = extOf(abs); // lowercase ext, "" for no-dot/hidden (S2)
    const mime = MIME_BY_EXT[ext]; // undefined => not a recognized image => text/binary path

    try {
      const buf = await fs.readFile(abs); // read ONCE; reused by image + text/binary paths

      // F5 — a 0-byte image file would attach an EMPTY ImageContent (which providers reject).
      // Align with the text path's empty-file handling: emit a note block, attach nothing.
      if (mime && buf.length === 0) {
        state.blocks.push(formatEmptyImageBlock(abs));
        state.injectedSet.add(abs); // consolidated dedup (Issue 1)
        injectedIndexes.push(m.index); // record injected-token index for precise #@ strip (Issue 2)
        state.count++;
        continue;
      }

      // F3 — validate the ACTUAL bytes match the declared image type before attaching.
      // A mislabeled file (e.g. text named `.png`) fails the magic-number sniff and falls
      // through to the text/binary path instead of attaching decoded garbage as an image.
      const isRealImage = mime ? hasValidImageMagic(buf, mime) : false;

      if (mime && isRealImage) {
        // IMAGE path (PRD §5.2) — classified by MIME first; SKIPS the NUL-byte check entirely.
        const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
        state.images.push({
          type: "image",
          data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
          mimeType: resized?.mimeType ?? mime, // null => original mime
        });
        state.blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file> (T2.S1 guards null)
      } else {
        // TEXT / BINARY path (PRD §5.1 / §5.3) — also the F3 fallback for mislabeled image-ext files.
        if (isBinary(buf)) {
          state.blocks.push(formatBinaryBlock(abs)); // §5.3 note — no decoded garbage (em dash U+2014)
        } else {
          // §5.5 INLINE-VS-PAGED — the whole file always reaches the model. Inline when it fits the
          // remaining budget (or budget unknown → O-1 fallback); else head block + paged directive.
          const content = buf.toString("utf8");
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
              // whole content fits the head slice → deliver inline, never page (FINDING 2)
              state.blocks.push(formatTextFileBlock(abs, content));
            } else {
              state.blocks.push(formatTextFileBlock(abs, head));
              state.blocks.push(formatPagedDirectiveBlock(abs, content.length, headStartLine(head), headCompleteLineCount(head)));
              state.paged++;
              subtract(state, Math.ceil(HEAD_CHARS / 4));
            }
          }
        }
      }
      state.injectedSet.add(abs); // consolidated dedup (Issue 1) — covers text-inline/paged/image/binary
      injectedIndexes.push(m.index); // record injected-token index for precise #@ strip (Issue 2)
      state.count++;
    } catch {
      // read/resize error => leave THIS token verbatim, keep processing the rest (PRD §5.4, §12.5)
      continue;
    }
  }

  if (state.count === 0) return { text, images: imagesIn, injected: 0, paged: 0 }; // ORIGINAL ref — nothing injected → byte-for-byte (§10 row 1)

  // Strip the #@ trigger from each inline marker — the PATH stays put as a readable reference. The
  // model doesn't need the #@ syntax (the appended <file name="abs"> blocks carry the data), and
  // every #@ is 2 tokens of pure noise. Reached only when count > 0, so the nothing-injected path
  // above still returns the prompt byte-for-byte (missing/dir/error tokens keep their #@ verbatim).
  // §6.2 — strip the '#@' trigger ONLY from tokens that ACTUALLY injected (Issue 2). Failed tokens
  // (missing/dir/error) and deduped repeats were never pushed, so they keep '#@' verbatim.
  // INDEX-BASED SPLICE (not substring replace): an injected match can be a prefix of another token
  // (e.g. '#@a.ts' ⊂ '#@a.ts.bak'), so a substring replace would corrupt the longer token. Group 1
  // of FILE_INJECT_RE is zero-width → m.index is exactly the '#'; removing 2 chars drops exactly
  // '#@'. Process high→low so earlier offsets stay valid.
  let strippedText = text;
  for (const i of [...injectedIndexes].sort((a, b) => b - a)) {
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
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" }; // MANDATORY loop prevention (§12.1)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // skip mid-stream steering for latency (§12.2)
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

    const { text, images, injected, paged } = await injectFiles(event.text, event.images ?? [], ctx); // §5.5 — paged count drives the mode-aware notify below
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
