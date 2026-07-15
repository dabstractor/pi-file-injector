import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { resizeImage, formatDimensionNote, type ResizedImage } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};
const TRAILING_PUNCT = ".,;:!?\")]}>'";

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

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
