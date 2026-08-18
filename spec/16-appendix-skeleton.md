## Appendix A — Minimal skeleton

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, highlightCode, getLanguageFromPath, CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Box, Text, type Component } from "@earendil-works/pi-tui";   // §6.3 renderer components
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const BARE_AT_RE     = /(^|(?<=[^\w#]))@(\S+)/g;    // §4.6
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1(?!`)/g;
const FENCE_OPEN_RE  = /^ {0,3}(`{3,}|~{3,})/;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};
const MD_EXTS = new Set(["md", "markdown"]);
const TRAILING_PUNCT = ".,;:!?\")]}>'";
const PAGED_THRESHOLD = 0.6, MARGIN = 8192, HEAD_CHARS = 8192, READ_LIMIT = 2000;
const DEFAULT_RESERVE = 8192, IMAGE_FALLBACK_TOKENS = 2805;

interface FileInjectorConfig { markdownBareAtImports?: boolean; }
interface FileDetail { path: string; kind: "text"|"image"|"binary"|"paged"; chars?: number; lines?: number; range?: string; pagedHeadLines?: number; dimensionHint?: string; }
interface State {
  blocks: string[]; details: FileDetail[]; images: ImageContent[];
  injectedSet: Set<string>; remaining: number | null; count: number; paged: number; bareAt: boolean;
}

export default function (pi: ExtensionAPI) {
  let cfg: FileInjectorConfig = {};
  let pending: { blocks: string[]; details: FileDetail[] } | null = null;   // input → before_agent_start handoff (§6.2)

  pi.on("session_start", async (_e, ctx) => {
    cfg = await readConfig(ctx);
    pi.registerMessageRenderer("fileInjector.injected", (m, o, t) => renderInjectedMessage(m, o, t));   // §6.3
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.streamingBehavior === "steer") return { action: "continue" };
    if (!event.text?.includes("#@")) return { action: "continue" };

    const priorPaths = new Set([...event.text.matchAll(/<file name="([^"]+)">/g)].map(x => x[1]));
    const usage = ctx.getContextUsage?.();
    const remaining = (usage && usage.tokens !== null)
      ? Math.max(0, usage.contextWindow - usage.tokens - (ctx.model?.maxTokens ?? DEFAULT_RESERVE) - MARGIN)
      : null;
    const state: State = {
      blocks: [], details: [], images: [...(event.images ?? [])],
      injectedSet: priorPaths, remaining, count: 0, paged: 0,
      bareAt: cfg.markdownBareAtImports === true,
    };

    await processTokenStream(event.text, ctx.cwd, { allowAbsTilde: true, skipCode: false, tryMdExt: false, bareAt: false }, state, ctx);
    if (state.count === 0) return { action: "continue" };
    pending = { blocks: state.blocks, details: state.details };  // hand off to before_agent_start (§6.2)
    const whole = state.count - state.paged;
    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${whole} whole${state.paged > 0 ? `, ${state.paged} paged` : ""}`, "info");
    return { action: "transform" as const, text: event.text, images: state.images };   // text VERBATIM (§6.4)
  });

  pi.on("before_agent_start", async () => {                      // publish files as ONE custom message after the user message
    if (!pending) return undefined;
    const { blocks, details } = pending; pending = null;
    return { message: { customType: "fileInjector.injected", content: blocks.join("\n\n"), display: true, details: { files: details } } };
  });
}

// §6.3 renderer: green (toolSuccessBg) box, one `read <path>` line per file, expandable.
function renderInjectedMessage(message: any, opts: { expanded: boolean }, theme: any): Component {
  const files: FileDetail[] = message?.details?.files ?? [];
  const bodiesByPath = new Map<string, string[]>();  // path → FIFO (paged = 2 blocks / 1 detail; index pairing mis-fires)
  if (typeof message?.content === "string")
    for (const m of message.content.matchAll(/<file name="([^"]+)">([\s\S]*?)<\/file>/g)) {
      const q = bodiesByPath.get(m[1]) ?? []; q.push(m[2].replace(/^\n|\n$/g, "")); bodiesByPath.set(m[1], q);
    }
  const box = new Box(1, 1, (t: string) => theme.bg("toolSuccessBg", t));
  if (!files.length) { box.addChild(new Text(theme.fg("toolTitle", theme.bold("read")) + " " + theme.fg("dim", "(injected files)") + " (ctrl+o to expand)", 0, 0)); return box; }
  files.forEach((d, i) => {
    box.addChild(new Text(readLine(d, theme) + (i === 0 ? " (ctrl+o to expand)" : ""), 0, 0));
    if (opts.expanded && d.kind !== "image") {
      const body = bodiesByPath.get(d.path)?.shift();   // path-paired pop (BUG-001); undefined → no body child
      if (body !== undefined) {
        const lang = d.kind === "binary" ? undefined : getLanguageFromPath(d.path);
        box.addChild(new Text(theme.fg("toolOutput", lang ? highlightCode(body, lang).join("\n") : body), 0, 0));
      }
    }
  });
  return box;
}
function readLine(d: FileDetail, theme: any): string {
  const t = theme.fg("toolTitle", theme.bold("read")), p = theme.fg("accent", tildify(d.path));
  if (d.kind === "binary") return `${t} ${p} ${theme.fg("dim", "(binary — not injected)")}`;
  if (d.kind === "image")  return `${t} ${p}${d.dimensionHint ? " " + theme.fg("dim", d.dimensionHint) : ""}`;
  if (d.kind === "paged")  return `${t} ${p}${theme.fg("warning", d.range ?? "")}`;
  return `${t} ${p}`;
}
function tildify(abs: string): string { const h = os.homedir(); return h && abs.startsWith(h + "/") ? "~" + abs.slice(h.length) : abs; }

// ... scanTokens (async) / processTokenStream / injectFile / injectMarkdown / emitText (pushes FileDetail) / subtract
//     + helpers (incl. resolveImportPath, isRegularFile, readConfig) + BARE_AT_RE + computeCodeRanges / inCode  per §9 ...
```

**Companion file — `package.json`:** the skeleton above is the whole extension, but the repo also
needs a `package.json` with a `"pi"` manifest so the *directory* is loadable (see §8). Without it,
`pi install .` / `-e <dir>` / a package registration all fail with `Cannot find module '<dir>'`:

```json
{ "name": "pi-file-injector", "version": "0.1.0", "private": true, "type": "module",
  "pi": { "extensions": ["file-injector.ts"] } }
```

**Done-definition:** all 42 manual test cases in §11 pass; no uncaught errors; the model receives whole-file contents with **zero** `read` tool calls for `#@`-injected files that fit remaining context (delivered as a single custom message after the prompt, §6.2); in the TUI those files render as **green `read <path>` lines — one per file — indistinguishable from the `read` tool** (§6.3), with the user bubble showing the **verbatim** prompt (`#@` preserved so cancel/fork/re-open re-trigger injection; §6.4); markdown imports resolve relative to the importing file's directory (with `.md`/`.markdown` extension shorthand for extensionless tokens), skip code blocks, terminate on cycles, and dedup across the whole prompt; the context budget accounts for the total filesize of all delivered files (top-level + imports); prompts without `#@` (including bare `@file`) are byte-for-byte unchanged; `#@` works in both interactive and initial `-p` messages; and a re-submitted prompt (cancel/re-open, fork, `/tree` navigate, queued-followUp dequeue) re-triggers injection because the stored prompt still contains `#@`.
