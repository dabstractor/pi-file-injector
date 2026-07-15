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

    // PER-TOKEN DEDUP — if a <file> block for this exact absolute path already exists in `text`
    // (injected by a prior copy of this extension in the runner's input-handler chain), skip
    // re-injecting. Cooperation-independent: works even when the prior copy was a non-sentinel
    // version (the default `pi -e` path when a global copy co-loads). Fixes Issue 1. Uses a plain
    // substring test so path chars ([ ] . ( ) …) need no escaping; matches all 4 block prefixes.
    if (text.includes('<file name="' + abs + '">')) continue;

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
        blocks.push(formatEmptyImageBlock(abs));
        count++;
        continue;
      }

      // F3 — validate the ACTUAL bytes match the declared image type before attaching.
      // A mislabeled file (e.g. text named `.png`) fails the magic-number sniff and falls
      // through to the text/binary path instead of attaching decoded garbage as an image.
      const isRealImage = mime ? hasValidImageMagic(buf, mime) : false;

      if (mime && isRealImage) {
        // IMAGE path (PRD §5.2) — classified by MIME first; SKIPS the NUL-byte check entirely.
        const resized = await resizeImage(new Uint8Array(buf), mime); // Uint8Array; async Worker; null on failure
        images.push({
          type: "image",
          data: resized?.data ?? buf.toString("base64"), // null => raw base64 of ORIGINAL bytes
          mimeType: resized?.mimeType ?? mime, // null => original mime
        });
        blocks.push(formatImageBlock(abs, resized)); // null => empty-hints <file name="ABS"></file> (T2.S1 guards null)
      } else {
        // TEXT / BINARY path (PRD §5.1 / §5.3) — also the F3 fallback for mislabeled image-ext files.
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
 * No limits, no config: the whole file is injected every time — no truncation, no word / byte cap.
 * Large files may blow the model's context; that is the documented, intended behavior. Images are
 * downscaled (2000×2000) only because providers reject oversized images; the whole image is still
 * delivered (downscaled to fit). The handler short-circuits (`continue`) when the input originated
 * from an extension (loop prevention), is a mid-stream steering nudge (latency), or simply has no `#@`
 * token — and it never throws (injectFiles isolates each file in its own try/catch).
 */
export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" }; // MANDATORY loop prevention (§12.1)
    if (event.streamingBehavior === "steer") return { action: "continue" }; // skip mid-stream steering for latency (§12.2)
    if (!event.text?.includes("#@")) return { action: "continue" }; // cheap pre-check before any regex/IO (§12.4)

    const { text, images, injected } = await injectFiles(event.text, event.images ?? [], ctx);
    if (!injected) return { action: "continue" }; // nothing injected → preserve prompt byte-for-byte (§10 row 1)

    if (ctx.hasUI) ctx.ui.notify(`#@ injected ${injected} ${injected === 1 ? "file" : "files"}`, "info"); // F4 — proper pluralization; guarded for print/json headless modes (api_verification §5)
    return { action: "transform" as const, text, images }; // rewrite prompt with injected content + merged images
  });
}
