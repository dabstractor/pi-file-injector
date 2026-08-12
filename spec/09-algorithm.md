## 9. Algorithm (pseudocode)

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, highlightCode, getLanguageFromPath, CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Box, Text, type Component } from "@earendil-works/pi-tui";   // §6.3 renderer components
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;       // marker "#@"; group 2 = token
const BARE_AT_RE     = /(^|(?<=[^\w#]))@(\S+)/g;    // marker "@" (markdown opt-in, §4.6); not after "#" or a word char
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};
const MD_EXTS = new Set(["md", "markdown"]);
const TRAILING_PUNCT = ".,;:!?\")]}>'";

// §5.6.2 budget constants
const PAGED_THRESHOLD = 0.6, MARGIN = 8192, HEAD_CHARS = 8192, READ_LIMIT = 2000;
const DEFAULT_RESERVE = 8192, IMAGE_FALLBACK_TOKENS = 2805;

// §4.6 config (read on session_start, cached). markdownBareAtImports: also match bare "@path" in markdown.
interface FileInjectorConfig { markdownBareAtImports?: boolean; }

// §6.2/§6.3 per-file metadata carried in the custom message's `details` (one entry per delivered file).
// Drives the renderer's collapsed `read <path>` lines; never sent to the model as separate text.
interface FileDetail {
  path: string;                 // absolute resolved path (the <file name=…>)
  kind: "text" | "image" | "binary" | "paged";
  chars?: number;               // text: content length; paged: FULL content length
  lines?: number;               // text: total line count
  range?: string;               // paged: ":<startLine>-…" resume range (read-tool style)
  pagedHeadLines?: number;      // paged: complete lines delivered in the head
  dimensionHint?: string;       // image: formatDimensionNote(resized)
}

// Shared, mutable state carried across the whole prompt (top-level tokens + imports).
interface State {
  blocks: string[];           // <file>…</file> strings → the custom message's content (§6.2)
  details: FileDetail[];      // per-file metadata → the custom message's details (§6.3), parallel to blocks
  images: ImageContent[];     // attached to the USER message via the input transform (§6.4)
  injectedSet: Set<string>;   // claimed absolute paths → dedup across the whole prompt
  remaining: number | null;   // single budget accumulator (§5.6.2)
  count: number;              // files delivered (whole + paged + image + binary note)
  paged: number;              // subset delivered via the §5.5 page path
  bareAt: boolean;            // markdown bare-"@" imports enabled? (§4.6)
}

export default function (pi: ExtensionAPI) {
  let cfg: FileInjectorConfig = {};                       // loaded on session_start (§4.6)
  let pending: { blocks: string[]; details: FileDetail[] } | null = null;   // input → before_agent_start handoff (§6.2)

  pi.on("session_start", async (_e, ctx) => {
    cfg = await readConfig(ctx);
    // §6.3 register the chat renderer ONCE. Drawing is a no-op outside the TUI (print/json modes
    // never call renderers), so no hasUI guard is needed for registration.
    pi.registerMessageRenderer("fileInjector.injected", (message, opts, theme) =>
      renderInjectedMessage(message, opts, theme));
  });

  pi.on("input", async (event, ctx) => {
    // --- short circuits ---
    if (event.source === "extension") return { action: "continue" };        // loop prevention
    if (event.streamingBehavior === "steer") return { action: "continue" }; // latency during steering
    if (!event.text?.includes("#@")) return { action: "continue" };         // cheap pre-check

    // seed dedup with <file> blocks already present (user pasted one, or prior @file)
    const priorPaths = new Set([...event.text.matchAll(/<file name="([^"]+)">/g)].map(x => x[1]));

    // §5.6.2 budget. Window from usage.contextWindow (NOT ctx.model). O-1: if getContextUsage()
    // is undefined or usage.tokens is null → remaining = null → inject whole (fallback).
    const usage = ctx.getContextUsage?.();
    const remaining = (usage && usage.tokens !== null)
      ? Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN)
      : null;

    const state: State = {
      blocks: [], details: [], images: [...(event.images ?? [])],
      injectedSet: priorPaths, remaining, count: 0, paged: 0,
      bareAt: cfg.markdownBareAtImports === true,
    };

    // process the USER PROMPT: baseDir = cwd, absolute/tilde allowed, no code-skipping, bare-@ off.
    // The prompt text is NEVER modified (§6.4) — stripping #@ would break cancel/fork/re-open re-injection.
    await processTokenStream(
      event.text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
    if (state.count === 0) return { action: "continue" };   // nothing delivered → byte-for-byte, no stash

    // §6.2 hand the built blocks+details to before_agent_start. Do NOT append blocks to, or strip #@ from,
    // the prompt text — it is returned verbatim so a re-submitted prompt re-triggers injection.
    pending = { blocks: state.blocks, details: state.details };

    const whole = state.count - state.paged;                 // §5.5 mode-aware notify
    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${whole} whole${state.paged > 0 ? `, ${state.paged} paged` : ""}`, "info");
    return { action: "transform" as const, text: event.text, images: state.images };   // text VERBATIM (§6.4)
  });

  // §6.2 publish the stashed files as ONE custom message, appended after the user message.
  // Fires once per prompt(), after the input handler. No stash (no #@, or short-circuited) → no-op.
  pi.on("before_agent_start", async (_e, _ctx) => {
    if (!pending) return undefined;
    const { blocks, details } = pending;
    pending = null;                                         // clear regardless (one-shot per prompt)
    return {
      message: {
        customType: "fileInjector.injected",
        content: blocks.join("\n\n"),                       // every <file> block → sent to the LLM
        display: true,                                      // render via the registered MessageRenderer
        details: { files: details },                        // renderer metadata (NOT extra model text)
      },
    };
  });
}

// Scan a text (user prompt OR markdown content) for import markers that resolve, WITHOUT injecting.
// async because resolution stats candidate path(s); markdown also tries .md/.markdown (§4.5).
// opts.bareAt (markdown only, §4.6) additionally matches a bare "@path" via BARE_AT_RE.
// Per-text dedup via localSeen on the RESOLVED abs; global injectedSet skips already-claimed paths.
// Returns resolved abs paths in ENCOUNTER ORDER (depth-first recursion relies on this). Markers are
// detected here only to resolve imports — they are NEVER stripped from the text (§6.4) — so no
// index/prefixLen bookkeeping is returned.
async function scanTokens(
  text: string, baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State,
): Promise<string[]> {
  const codeRanges = opts.skipCode ? computeCodeRanges(text) : null;
  const localSeen = new Set<string>();
  const out: string[] = [];
  // candidate markers: "#@" always; bare "@" when opts.bareAt.
  // BARE_AT_RE forbids a "#" before the "@", so "#@file" matches once, not twice.
  const cands: { idx: number; token: string }[] = [];
  for (const m of text.matchAll(FILE_INJECT_RE)) cands.push({ idx: m.index!, token: m[2] });
  if (opts.bareAt) for (const m of text.matchAll(BARE_AT_RE)) cands.push({ idx: m.index!, token: m[2] });
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    if (codeRanges && inCode(c.idx, codeRanges)) continue;             // §5.6.1 — code is exempt
    const token = cleanToken(c.token);
    if (!token) continue;
    if (!opts.allowAbsTilde && isAbsoluteOrTilde(token)) continue;     // §4.5 — markdown: relative only
    const abs = await resolveImportPath(token, baseDir, opts.tryMdExt); // §4.5 — exact, then .md/.markdown
    if (!abs) continue;                                                // nothing resolved → leave verbatim
    if (state.injectedSet.has(abs) || localSeen.has(abs)) continue;    // dedup on resolved abs
    localSeen.add(abs);
    out.push(abs);
  }
  return out;
}

// Top-level processor: scan the user prompt, inject each resolved token (depth-first).
// The prompt text is NOT modified (§6.4) — this only resolves markers and injects their files.
async function processTokenStream(
  text: string, baseDir: string,
  opts: { allowAbsTilde: boolean; skipCode: boolean; tryMdExt: boolean; bareAt: boolean },
  state: State, ctx: any,
): Promise<void> {
  const absPaths = await scanTokens(text, baseDir, opts, state);   // scan once, before any injection
  for (const abs of absPaths) {
    if (state.injectedSet.has(abs)) continue;               // cross-subtree dedup since scan
    await injectFile(abs, state, ctx);                      // claims abs, emits block(s), recurses
  }
}

// stat → classify → emit block → (if markdown) scan+recurse (content delivered verbatim, §6.4). Claims abs on success.
async function injectFile(abs: string, state: State, ctx: any): Promise<boolean> {
  let st;
  try { st = await fs.stat(abs); } catch { return false; }             // missing → leave verbatim
  if (!st.isFile()) return false;                                      // dir → leave verbatim
  state.injectedSet.add(abs);                                          // CLAIM (dedup, incl. self-import)

  const ext = extOf(abs);
  const mime = MIME_BY_EXT[ext];
  try {
    const buf = await fs.readFile(abs);
    if (mime) {
      // IMAGE (§5.2) — consumes budget, never paged. Attached to the USER message; ref tag + detail in the custom message.
      const resized = await resizeImage(new Uint8Array(buf), mime);
      state.images.push({
        type: "image",
        data: resized?.data ?? buf.toString("base64"),
        mimeType: resized?.mimeType ?? mime,
      });
      state.blocks.push(formatImageBlock(abs, resized));
      state.details.push({ path: abs, kind: "image", dimensionHint: resized ? formatDimensionNote(resized) ?? undefined : undefined });
      subtract(state, estimateImageTokens(resized));                   // §5.6.2
    } else if (MD_EXTS.has(ext)) {
      // MARKDOWN (§5.6) — text block + transitive imports
      await injectMarkdown(abs, buf.toString("utf8"), state, ctx);
    } else if (isBinary(buf)) {
      // BINARY NOTE (§5.3)
      const note = formatBinaryBlock(abs);
      state.blocks.push(note);
      state.details.push({ path: abs, kind: "binary" });
      subtract(state, Math.ceil(note.length / 4));
    } else {
      // PLAIN TEXT (§5.1 + §5.5)
      emitText(abs, buf.toString("utf8"), state);
    }
    state.count++;                                                     // exactly one delivery per claimed file
    return true;
  } catch {
    return false;                                                      // read/processing error → leave verbatim
  }
}

// §5.6 markdown branch: scan for imports → emit this block (VERBATIM) → recurse imports.
// Content is delivered exactly as read from disk (import markers preserved; §6.4) — nothing is stripped.
async function injectMarkdown(abs: string, content: string, state: State, ctx: any): Promise<void> {
  const dir = path.dirname(abs);

  // Step 3: scan for imports (relative only, outside code; extension shorthand on; bare-@ per state.bareAt)
  const absPaths = await scanTokens(content, dir, { allowAbsTilde: false, skipCode: true, tryMdExt: true, bareAt: state.bareAt }, state);

  // Step 4: emit this file's block (paged decision on VERBATIM content — markers are NOT stripped, §6.4)
  emitText(abs, content, state);

  // Step 5: recurse into imports, depth-first, encounter order (pre-order)
  for (const abs2 of absPaths) {
    if (state.injectedSet.has(abs2)) continue;            // belt-and-suspenders (cross-file dedup)
    await injectFile(abs2, state, ctx);
  }
}

// §5.5 inline-vs-paged decision; pushes block(s) + a FileDetail; subtracts cost; bumps paged (NOT count).
function emitText(abs: string, content: string, state: State) {
  const fileCost = Math.ceil(content.length / 4);
  const lineCount = (content.match(/\n/g)?.length ?? 0) + 1;
  if (state.remaining === null || fileCost <= PAGED_THRESHOLD * state.remaining) {
    state.blocks.push(formatTextFileBlock(abs, content));               // whole
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });
    subtract(state, fileCost);
  } else if (content.length <= HEAD_CHARS) {
    state.blocks.push(formatTextFileBlock(abs, content));               // sub-head-sized → whole
    state.details.push({ path: abs, kind: "text", chars: content.length, lines: lineCount });
    subtract(state, fileCost);
  } else {
    const head = headSlice(content);                                   // first HEAD_CHARS, surrogate-safe
    const headLines = headCompleteLineCount(head);
    const startLine = headLines + 1;                                   // first line AFTER the head's complete lines
    state.blocks.push(formatTextFileBlock(abs, head));
    state.blocks.push(formatPagedDirectiveBlock(abs, content.length, startLine, headLines));
    state.details.push({ path: abs, kind: "paged", chars: content.length, range: `:${startLine}-`, pagedHeadLines: headLines });
    state.paged++;
    subtract(state, Math.ceil(head.length / 4));
  }
}

function subtract(state: State, cost: number) {
  if (state.remaining !== null) state.remaining = Math.max(0, state.remaining - cost);
}

// ---------- helpers ----------------------------------------------------------
function cleanToken(raw: string): string {
  let t = raw;
  while (t.length && TRAILING_PUNCT.includes(t[t.length - 1])) t = t.slice(0, -1);
  return t;
}
function isAbsoluteOrTilde(p: string): boolean {
  return p.startsWith("/") || p.startsWith("~");
}
function expandTildeAndResolve(p: string, baseDir: string): string {
  const home = os.homedir();
  const expanded = p === "~" ? home : p.startsWith("~/") ? path.join(home, p.slice(2)) : p;
  return path.resolve(baseDir, expanded);
}
// §4.5 resolution: exact path first; if markdown import + extensionless token + exact not a file,
// try <exact>.md then <exact>.markdown. Returns the first existing regular file, or null.
async function resolveImportPath(token: string, baseDir: string, tryMdExt: boolean): Promise<string | null> {
  const abs = expandTildeAndResolve(token, baseDir);
  if (await isRegularFile(abs)) return abs;                            // exact match wins
  if (tryMdExt && path.extname(token) === "") {                        // extensionless shorthand
    if (await isRegularFile(abs + ".md")) return abs + ".md";
    if (await isRegularFile(abs + ".markdown")) return abs + ".markdown";
  }
  return null;
}
async function isRegularFile(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isFile(); } catch { return false; }
}
// §4.6 — read config from settings.json (namespaced key) + file-injector.json, global then project.
// Precedence (later wins): global settings key → global file → project settings key → project file.
const SETTINGS_KEY = "fileInjector";   // the settings.json key
async function readConfig(ctx: any): Promise<FileInjectorConfig> {
  const tryRead = async (p: string) => {
    try { return JSON.parse((await fs.readFile(p, "utf8")).trim() || "{}"); } catch { return {}; }
  };
  const namespaced = (raw: any): FileInjectorConfig =>
    raw && typeof raw === "object" && raw[SETTINGS_KEY] && typeof raw[SETTINGS_KEY] === "object"
      ? raw[SETTINGS_KEY] : {};
  let cfg: FileInjectorConfig = {};
  cfg = { ...cfg, ...namespaced(await tryRead(path.join(getAgentDir(), "settings.json"))) };
  cfg = { ...cfg, ...(await tryRead(path.join(getAgentDir(), "file-injector.json"))) };
  if (ctx.isProjectTrusted()) {
    cfg = { ...cfg, ...namespaced(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json"))) };
    cfg = { ...cfg, ...(await tryRead(path.join(ctx.cwd, CONFIG_DIR_NAME, "file-injector.json"))) };
  }
  return cfg;
}
function extOf(abs: string): string {
  const base = path.basename(abs);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}
function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
function estimateImageTokens(resized: any): number {
  if (resized && typeof resized.width === "number" && typeof resized.height === "number") {
    const tiles = Math.max(1, Math.ceil(resized.width / 512)) * Math.max(1, Math.ceil(resized.height / 512));
    return tiles * 170 + 85;
  }
  return IMAGE_FALLBACK_TOKENS;
}

// §5.6.1 code-region detection (approximate CommonMark)
function computeCodeRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  // 1) fenced blocks, line by line, with running char offset
  let pos = 0;
  while (pos < content.length) {
    const nl = content.indexOf("\n", pos);
    const lineEnd = nl === -1 ? content.length : nl;
    const line = content.slice(pos, lineEnd);
    const open = FENCE_OPEN_RE.exec(line);
    if (open) {
      const fenceChar = open[1][0];
      const fenceLen = open[1].length;
      const start = pos;
      let k = lineEnd + 1;                       // first char after the opening line's newline
      let end = content.length;                  // default: unterminated → EOF
      while (k < content.length) {
        const nl2 = content.indexOf("\n", k);
        const le2 = nl2 === -1 ? content.length : nl2;
        const trimmed = content.slice(k, le2).replace(/^ {0,3}/, "");
        let r = 0;
        while (r < trimmed.length && trimmed[r] === fenceChar) r++;
        if (r >= fenceLen) { end = nl2 === -1 ? content.length : nl2 + 1; break; } // closing fence found
        if (nl2 === -1) { end = content.length; break; }
        k = nl2 + 1;
      }
      ranges.push([start, end]);
      pos = end;
      continue;
    }
    pos = nl === -1 ? content.length : nl + 1;
  }
  // 2) inline code spans not already inside a fenced range
  INLINE_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_CODE_RE.exec(content)) !== null) {
    if (!inCode(m.index, ranges)) ranges.push([m.index, m.index + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}
function inCode(index: number, ranges: [number, number][]): boolean {
  let lo = 0, hi = ranges.length - 1;            // binary search over sorted ranges
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index < ranges[mid][0]) hi = mid - 1;
    else if (index >= ranges[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}
function headSlice(content: string): string {
  let head = content.slice(0, HEAD_CHARS);       // UTF-16 code units
  if (head.length === HEAD_CHARS) {              // back up one if ending on a lone high surrogate
    const code = head.charCodeAt(head.length - 1);
    if (code >= 0xd800 && code <= 0xdbff) head = head.slice(0, -1);
  }
  return head;
}
function headStartLine(head: string): number { return (head.match(/\n/g)?.length ?? 0) + 1; }
function headCompleteLineCount(head: string): number { return head.match(/\n/g)?.length ?? 0; }
function formatTextFileBlock(abs: string, content: string): string {
  return `<file name="${abs}">\n${content}\n</file>`;
}
function formatImageBlock(abs: string, resized: any): string {
  const hint = resized ? formatDimensionNote(resized) : "";
  return `<file name="${abs}">${hint ?? ""}</file>`;
}
function formatBinaryBlock(abs: string): string {
  return `<file name="${abs}"><binary file — contents not injected; use the read tool if needed></file>`;
}
function formatPagedDirectiveBlock(abs: string, len: number, startLine: number, injectedLines: number): string {
  return `<file name="${abs}"><paged: ${len} chars; head delivered ${injectedLines} complete lines; ` +
    `read the rest with the read tool at offset:${startLine}, limit:${READ_LIMIT}, ` +
    `incrementing offset by ${READ_LIMIT} until done></file>`;
}

// ---------- §6.3 chat renderer (registered for "fileInjector.injected") ---------------------
// Replicates the read tool's completed-call look: a green (toolSuccessBg) box, one `read <path>` line
// per file when collapsed, full content when expanded. Blocks (message.content) and details.files are
// co-emitted in the same order (§6.4), so they align by index.
const FILE_BLOCK_RE = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component {
  const files: FileDetail[] = message?.details?.files ?? [];
  // pair each detail with its block body (re-parsed from content) by index
  const bodies: string[] = [];
  if (typeof message?.content === "string") {
    let m: RegExpExecArray | null;
    FILE_BLOCK_RE.lastIndex = 0;
    while ((m = FILE_BLOCK_RE.exec(message.content)) !== null) bodies.push(m[2].replace(/^\n|\n$/g, ""));
  }
  const box = new Box(1, 1, (t: string) => theme.bg("toolSuccessBg", t));   // green, like a completed read call
  if (files.length === 0) {                                               // defensive fallback (old/foreign entry)
    box.addChild(new Text(theme.fg("toolTitle", theme.bold("read")) + " " +
      theme.fg("dim", "(injected files)") + expandHint(theme), 0, 0));
    if (opts.expanded && typeof message?.content === "string")
      box.addChild(new Text(theme.fg("toolOutput", message.content), 0, 0));
    return box;
  }
  for (let i = 0; i < files.length; i++) {
    const d = files[i];
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? expandHint(theme) : ""), 0, 0));
    if (opts.expanded) {
      const body = bodies[i];
      if (body !== undefined && d.kind !== "image") {                     // images already shown via user-message attachment
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        const rendered = lang ? highlightCode(body, lang).join("\n") : body;
        box.addChild(new Text(theme.fg("toolOutput", rendered), 0, 0));
      }
    }
  }
  return box;
}
// One collapsed line per file, identical in spirit to the read tool's formatReadCall:
//   read <tildified-path><range-or-hint>
function readLine(d: FileDetail, theme: any): string {
  const title = theme.fg("toolTitle", theme.bold("read"));
  const path = theme.fg("accent", tildify(d.path));
  if (d.kind === "binary") return `${title} ${path} ${theme.fg("dim", "(binary — not injected)")}`;
  if (d.kind === "image")  return `${title} ${path}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  if (d.kind === "paged")  return `${title} ${path}${theme.fg("warning", d.range ?? "")}`;
  return `${title} ${path}`;                                              // whole text
}
// "(ctrl+o to expand)" — the default expand binding (matches the user's example). Hardcoded because
// Pi's keyText() helper is internal; ctrl+o is the default and is what the read/skill hints show.
function expandHint(theme: any): string { return " " + theme.fg("dim", "(ctrl+o to expand)"); }
function tildify(abs: string): string {
  const home = os.homedir();
  return home && abs.startsWith(home + "/") ? "~" + abs.slice(home.length) : abs;
}
```

`state.count` is the number of files delivered (≥ 0, whole + paged + image + binary note); the handler treats `0` as "nothing injected" and returns `continue`.

---

