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

/**
 * PRD §9 — core assembly. Iterate every `#@<path>` token in `text`, resolve+stat+classify+read each,
 * append a Pi-native `<file>` block (text/binary) or attach an ImageContent (image), and return the
 * transformed prompt + merged images + count. NEVER throws (each file is isolated in try/catch);
 * tokens that miss/are directories/throw are left verbatim. The original prompt text is NOT modified —
 * blocks are appended after `\n\n---\n\n`, joined with `\n\n` (PRD §6.2). `injected` is a COUNT:
 * 0 => caller (T3.S2) returns {action:"continue"}; >0 => {action:"transform", text, images}.
 */
export async function injectFiles(
  text: string,
  imagesIn: ImageContent[],
  ctx: { cwd: string },
): Promise<{ text: string; images: ImageContent[]; injected: number }> {
  const blocks: string[] = [];
  const images = [...imagesIn]; // MERGE — runner REPLACES the array on transform; seed originals (item §3a)
  let count = 0;

  for (const m of text.matchAll(FILE_INJECT_RE)) {
    const raw = m[2]; // capture group 2 = path token after #@ (group 1 is the zero-width ^ anchor)
    const token = cleanToken(raw); // trim trailing punctuation (S2)
    if (!token) continue; // empty after trim => skip, leave verbatim

    const abs = expandTildeAndResolve(token, ctx.cwd); // ~ expand + path.resolve(cwd) (S2)

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
      if (mime) {
        // IMAGE path (PRD §5.2) — classified by MIME first; SKIPS the NUL-byte check entirely.
        const buf = await fs.readFile(abs);
        const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
        images.push({
          type: "image",
          data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
          mimeType: resized?.mimeType ?? mime, // null => original mime
        });
        blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file> (T2.S1 guards null)
      } else {
        // TEXT / BINARY path (PRD §5.1 / §5.3)
        const buf = await fs.readFile(abs);
        if (isBinary(buf)) {
          blocks.push(formatBinaryBlock(abs)); // §5.3 note — no decoded garbage (em dash U+2014)
        } else {
          blocks.push(formatTextFileBlock(abs, buf.toString("utf8"))); // ENTIRE file, no truncation (§5.1)
        }
      }
      count++;
    } catch {
      // read/resize error => leave THIS token verbatim, keep processing the rest (PRD §5.4, §12.5)
      continue;
    }
  }

  if (count === 0) return { text, images: imagesIn, injected: 0 }; // ORIGINAL ref — nothing changed (item §3i)

  const finalText = `${text}\n\n---\n\n${blocks.join("\n\n")}`; // append; original text untouched (PRD §6.2)
  return { text: finalText, images, injected: count };
}

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    return { action: "continue" };
  });
}
