# Feature: URL Web-Content Injection (`#<url>`)

> Adds a **second trigger** to the file-injector extension: `#<url>` fetches a URL at
> prompt-submit time, extracts its main content, converts to markdown, and injects it
> into the model's context — same delivery mechanism and chat rendering as `#@file`.
> This document specifies the URL half; it integrates with the spec at the points listed
> in §9. The file half (`#@`) is unchanged unless explicitly noted.

---

## 1. Overview & scope

| Trigger | Meaning | Mechanism |
|---|---|---|
| `#@<path>` | local file (unchanged) | `fs.readFile` (§5) |
| `#<url>` | **URL → fetched → extracted → markdown → injected** | `global fetch` + **defuddle** (`defuddle/node`) |

**What it does.** When the user writes `#example.com/api` (or `#https://example.com/api`)
anywhere in a prompt and submits, the extension fetches the page, runs it through
[defuddle](https://github.com/kepano/defuddle) (the Obsidian-Web-Clipper extraction
engine, MIT) which strips boilerplate/nav/scripts and converts the main content to
markdown, and delivers that markdown to the model as part of the same injected-files
custom message (`fileInjector.injected`) that `#@file` uses. It renders in the chat as a
green `read <url>` line, identical in look to a `read` tool call.

**Constraints honored (per design decisions):**
- **No hosted service, no browser.** All extraction is in-process, pure-JS. Page content
  never leaves the user's machine.
- **No caching.** Every injection fetches fresh, including on cancel/re-open/fork
  (§6.4 verbatim-prompt re-trigger → network re-fetch). Accepted tradeoff.
- **Baked-in.** One extractor (defuddle), no `urlExtractor` config. The only new knob is
  `enableUrls` (default `true`), §4.
- **Bundled, not user-installed.** defuddle et al. are hard `dependencies` of this
  package; npm fetches them transitively on `pi install`. The user installs **nothing**
  beyond the package itself — the "works out of the box, zero setup" value-prop (§1)
  is **preserved**. Only the internal aesthetic changes (the extension is no longer one
  .ts file with zero npm imports); that was an implementation note, not a user promise.

**Out of scope (this version):**
- JS-rendered SPAs (defuddle works on server-delivered HTML only; empty extraction →
  verbatim fallback, §3.4 — *no browser is introduced*).
- Paging oversized URL content (impossible — `read` can't read a URL; see §3.3).
- Handing large pages to a subagent for relevance extraction (future).

---

## 2. Grammar & detection

### 2.1 Two triggers, disjoint

```
#@<path>      → file   (§4.1, unchanged)
#<url-token>  → URL    (this spec)
```

`#@` is always a file. A bare `#` followed by a URL-shaped token is a URL. The two never
overlap: the file regex consumes `#@`, and the URL regex explicitly forbids a following
`@` (`(?!@)`).

### 2.2 Detection regexes

```ts
// Files — unchanged (§4.2)
const FILE_INJECT_RE = /(^|(?<=\W))#@(\S+)/g;

// URL candidate — a '#' (not '#@') at start-of-string or after a non-word char.
const URL_INJECT_RE  = /(^|(?<=\W))#(?!@)(\S+)/g;

// A candidate token is a URL iff it has a scheme OR a dotted host with an alpha TLD.
const URL_SHAPE_RE   =
  /^((https?|ftp):\/\/\S+                                  // explicit scheme
   |(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}        // scheme-less: label(s).alphaTLD
     (?::\d+)?                                              // optional port
     (?:\/\S*)?)$/i;                                        // optional path/query/fragment
```

Processing: run `FILE_INJECT_RE` (files) and `URL_INJECT_RE` (URL candidates) over the
prompt. For each URL candidate, test `URL_SHAPE_RE`; non-matching candidates are left
untouched (they're ordinary `#word` prose). Scheme-less matches are fetched as `https://`
(prefixed before resolution). Trailing punctuation is trimmed with the existing
`cleanToken` (§4.3).

### 2.3 Collision table (extends §3.2)

| Token | Matched? | Why |
|---|---|---|
| `#example.com/path` | ✅ URL | dotted host, alpha TLD |
| `#https://x.com/y` | ✅ URL | scheme |
| `#sub.example.co.uk/a` | ✅ URL | multi-label host |
| `#@file.txt` | ✅ file (not URL) | `#@` claimed by file regex; URL regex `(?!@)` |
| `# Heading` | ❌ none | space after `#`; "Heading" not URL-shaped |
| `#1234` (issue ref) | ❌ none | no dot/scheme |
| `#fff` (hex) / `#tag` | ❌ none | no dot/scheme |
| `C#` / `objective-C#` | ❌ none | mid-word (`#` not at boundary); no dot |
| `#v1.2` / `#3.14` | ❌ none | final label numeric → fails alpha-TLD |
| `#node.js` | ❌ none (deny-listed) | bare `word.ext` with a known code/file extension (`js`) → local-file reference, denied by the `CODE_EXTENSIONS` deny-list **before** fetch (not URL-shaped; no network egress). Use `#https://node.js` to fetch the real site. |

Bare `#word.<ext>` tokens whose final label is a known code/file extension (`#main.go`,
`#notes.md`, `#config.json`, `#node.js`, …) are **deny-listed as local-file references**
by `CODE_EXTENSIONS` in the URL scan loop — they make **no** fetch and inject nothing. The
README is authoritative for this behavior; use `#https://…` (explicit scheme) to bypass the
deny-list and force a fetch.

---

## 3. Behavior

### 3.1 Content-type dispatch

After fetching, route by response `Content-Type` (falling back to sniffing):

| Content-Type | Path |
|---|---|
| `text/html` (or sniffed HTML) | **defuddle extract → markdown** (§3.2) |
| `text/markdown`, `text/plain`, `application/json`, `text/xml`, `application/xml`, `application/rss+xml`, `application/atom+xml` | **raw text** — inject body verbatim (no extraction; JSON through defuddle would mangle it) |
| `image/*` | §5.2 image path (resize + attach) |
| anything else (PDF, octet-stream, …) | verbatim (don't inject); §3.5 |

### 3.2 The HTML pipeline (extract + markdown)

```ts
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";

const html = await readBodyCapped(res);                 // §3.3 cap applied here
const { document } = parseHTML(html, { url });          // string input is @deprecated in defuddle → parse ourselves
const result = await Defuddle(document, url, { markdown: true });
let body = (result.title ? `# ${result.title}\n\n` : "") + result.content;  // result.content is markdown
```

`defuddle/node`'s `Defuddle(doc, url, {markdown:true})` runs extraction and (via its
bundled Turndown-based `createMarkdownContent`) produces markdown with rich fidelity:
tables (colspan/rowspan, layout-table flattening), code blocks with language detection,
task lists, footnotes, GitHub callouts, srcset best-image, and math/KaTeX/MathML → LaTeX
(when `mathml-to-latex`/`temml` are installed). This meets — and in places exceeds —
trafilatura-class parity, in-process, no browser.

### 3.3 Cap, timeout, and over-budget → verbatim (NO paging)

Three guards; any of them failing leaves the `#<url>` token **verbatim** (§5.4
pattern — the model, which has web tools, can fetch it itself):

1. **Timeout — 20s.** `AbortController`; abort → verbatim.
2. **Download cap — 1 MB response body.** If `Content-Length > 1 MB`, do not download
   (verbatim). Otherwise stream-read and abort mid-stream if accumulated bytes exceed
   1 MB (verbatim). Enormous files are never pulled into context.
3. **Context budget (shared, §5.6.2).** Estimate `cost = ceil(body.length / 4)`.
   If `state.remaining !== null && cost > state.remaining` → **verbatim.**

**Why no paging (§5.5 does not apply to URLs):** the file paged-directive tells the model
to continue via the local `read` tool at `offset/limit`. `read` cannot read a remote URL,
so a URL cannot be paged. Therefore an over-budget URL is left verbatim rather than
truncated or faux-paged. This is a deliberate asymmetry vs files and the faithful reading
of "enormous files don't belong in context; just cap it."

When a URL injects successfully, it subtracts `cost` from the shared `remaining` like any
other delivered file (text/image/binary), so subsequent tokens and markdown imports see
the updated budget.

### 3.4 SPA / empty-extraction fallback

If defuddle returns fewer than `MIN_CONTENT` (200) chars of markdown — the signature of a
JS-rendered shell that delivered no server-side content — **do not inject garbage.** Leave
the token verbatim and emit a notify `#<url>: page appears JS-rendered; left as reference`.
(No browser is introduced to "fix" this; the model can use its own web tool.)

### 3.5 Failures → verbatim

Non-2xx, network error, DNS, TLS, timeout, cap-exceeded, over-budget, empty-extraction,
unhandled content-type, or any thrown error in the pipeline → token left verbatim, no
block appended. Never throw out of the handler; never lose the prompt. (Mirrors §5.4
and implementation note §12.5.)

---

## 4. Config: `enableUrls` (default `true`)

Joins `markdownBareAtImports` under the same four sources and precedence (§4.6):
`~/.pi/agent/settings.json` (`fileInjector` key) → `~/.pi/agent/file-injector.json` →
`<cwd>/.pi/settings.json` → `<cwd>/.pi/file-injector.json` (project sources honored only
when `ctx.isProjectTrusted()`).

```jsonc
{ "fileInjector": { "enableUrls": true } }   // default true; set false to disable all network egress
```

When `enableUrls === false`, `URL_INJECT_RE` tokens are ignored entirely (left verbatim)
and **no network request is made** — the network-hygiene / air-gapped opt-out. Read on
`session_start`, cached for the session alongside `markdownBareAtImports`.

---

## 5. Dependencies

defuddle and its runtime collaborators are **hard `dependencies`** of this package —
not optional, not peer. npm resolves them transitively when the package is installed, so
the end user runs `pi install` once and everything works; **nothing is installed
manually**.

```jsonc
{
  "dependencies": {
    "defuddle": "^0.19.2",          // extraction + markdown (MIT)
    "linkedom": "^0.18.12",         // DOM for Node (ISC)
    "turndown": "^7.2.0",           // defuddle's markdown engine (MIT)
    "mathml-to-latex": "^1.8.0",    // math pages → LaTeX (MIT)
    "temml": "^0.13.3"              // math (MIT)
  }
}
```

Why hard deps, not defuddle's `optionalDependencies`: optionality is defuddle's
packaging choice; from *this* package's perspective extraction-without-markdown or
extraction-without-a-DOM is a broken feature, so they are required. The Pi packages
(`@earendil-works/*`) stay **optional `peerDependencies`** — they are provided by the Pi
host runtime, not fetched by npm. (Verify on first install that `pi install .` resolves
`dependencies` via npm; expected, since the repo already ships as a standard npm package
with a `"pi"` manifest.)

---

## 6. Chat display (extends §6.3)

URLs reuse the existing `fileInjector.injected` custom message and its green
(`toolSuccessBg`) `MessageRenderer`. Each injected URL is one collapsed line:

```
read https://example.com/api (ctrl+o to expand)
```

`FileDetail` gains a `kind: "url"`:
```ts
interface FileDetail {
  path: string;                 // for URLs: the URL itself (no tildify)
  kind: "text" | "image" | "binary" | "paged" | "url";
  chars?: number;
  // ...existing fields
}
```
The renderer's `readLine()` adds a `url` branch identical to the `text` branch (title +
path, no range). Expanded view shows the extracted markdown (re-parsed from `content` like
text files). Images delivered via URL go through the existing image branch.

---

## 7. Edge cases (extends §10)

| Case | Behavior |
|---|---|
| No `#<url>` in prompt | `continue`; no fetch, no stash. |
| `#nonexistent.example` (DNS fail) | verbatim; no block. |
| `#example.com` → 404 / 500 | verbatim; no block. |
| `#example.com` → 1.5 MB page | `Content-Length` > cap → verbatim, not downloaded. |
| `#example.com` → 50 KB HTML, 8 KB markdown, fits budget | injected; green `read <url>` line. |
| `#example.com` → 400 KB markdown, over budget | verbatim (no paging — §3.3). |
| `#spa-app.example` (JS shell, <200 chars extracted) | verbatim + notify (§3.4). |
| `#example.com/data.json` | raw text path (no extraction); injected verbatim. |
| `#example.com/img.png` | image path (§5.2). |
| `#example.com/report.pdf` | verbatim (unhandled content-type). |
| `enableUrls: false` + `#example.com` | verbatim; **no request made**. |
| Timeout (slow site) | verbatim after 20s. |
| `#@file.txt` and `#example.com` in same prompt | both processed; shared budget; two green lines. |
| `#example.com` re-opened (cancel/re-open, fork) | **re-fetched** (no cache). |
| `#example.com` mid-word `foo#example.com` | not matched (`#` not at boundary). |
| `#v1.2` / `#3.14` | not URL-shaped → untouched prose. |
| `#node.js` | deny-listed as a local-file reference (code extension `js`) → no fetch, untouched prose. Use `#https://node.js` to fetch. |
| `ftp://` scheme | supported by `URL_SHAPE_RE`; fetch via `fetch` (Node supports it). |

---

## 8. Pseudocode — the URL branch

```ts
const URL_INJECT_RE = /(^|(?<=\W))#(?!@)(\S+)/g;
const URL_SHAPE_RE  = /^((https?|ftp):\/\/\S+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?)$/i;
const URL_TIMEOUT_MS = 20_000;
const URL_MAX_BYTES  = 1_000_000;   // 1 MB
const URL_MIN_CONTENT = 200;
const BROWSER_UA = "Mozilla/5.0 ...";  // browser-ish UA to avoid naive blocks

// In the input handler, after seeding state and BEFORE/AFTER the file token loop:
if (cfg.enableUrls) {
  const urls: string[] = [];
  for (const m of event.text.matchAll(URL_INJECT_RE)) {
    const tok = cleanToken(m[2]);
    if (tok && URL_SHAPE_RE.test(tok)) {
      const abs = /^https?:\/\//i.test(tok) ? tok : "https://" + tok;
      if (!state.injectedSet.has(abs)) { state.injectedSet.add(abs); urls.push(abs); }
    }
  }
  for (const u of urls) await injectUrl(u, state, ctx);
}

async function injectUrl(url: string, state: State, ctx: any): Promise<boolean> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return false;
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > URL_MAX_BYTES) return false;                  // too big → verbatim
    const html = await readBodyCapped(res, URL_MAX_BYTES);          // stream-abort on overflow
    if (html === null) return false;                                // overflowed mid-read
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    let body: string | null = null;
    if (ct.startsWith("image/")) {
      // → §5.2 image path (resize + attach to user message; ref block in custom msg)
      return injectImageFromBytes(url, Buffer.from(html, "utf8"), ct, state);  // helper
    } else if (ct.startsWith("text/html") || /^\s*</.test(html)) {
      const { document } = parseHTML(html, { url });
      const r = await Defuddle(document, url, { markdown: true });
      const md = (r.content ?? "").trim();
      if (md.length < URL_MIN_CONTENT) return false;                // SPA / empty → verbatim (§3.4)
      body = (r.title ? `# ${r.title}\n\n` : "") + md;
    } else if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("markdown")) {
      body = html;                                                   // raw text → inject verbatim
    } else {
      return false;                                                  // unhandled content-type → verbatim
    }

    const cost = Math.ceil(body.length / 4);
    if (state.remaining !== null && cost > state.remaining) return false;  // over budget → verbatim (§3.3)

    state.blocks.push(formatUrlBlock(url, body));
    state.details.push({ path: url, kind: "url", chars: body.length });
    subtract(state, cost);
    state.count++;
    return true;
  } catch {
    return false;                                                    // timeout/network/throw → verbatim
  } finally {
    clearTimeout(to);
  }
}

async function readBodyCapped(res: Response, cap: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) { const t = await res.text(); return t.length > cap ? null : t; }
  const chunks: Buffer[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) return null;                                     // overflow → verbatim
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function formatUrlBlock(url: string, content: string): string {
  return `<file name="${url}">\n${content}\n</file>`;   // same <file> envelope; name = URL
}
```

The file branch (`processTokenStream` / `injectFile`) is unchanged. Both branches share
`state` (blocks, details, images, injectedSet, remaining, count, paged). Dedup keys URLs
by their absolute form, so `#example.com` and `#https://example.com` collapse to one.

---

## 9. Integration with the spec (merge points)

| Section | Change |
|---|---|
| §1 / §2 value-prop | unchanged in spirit — "works out of the box, zero setup" is preserved (deps are bundled; user installs nothing extra). Optionally broaden the tagline to mention web pages. |
| §3.2 collision table | add the §2.3 URL-detection rows. |
| §4.1 grammar | add `#<url>` as second trigger (disjoint from `#@`). |
| §4.6 config | add `enableUrls` (default `true`) alongside `markdownBareAtImports`. |
| §5 | add **§5.7 URL injection** (content-type dispatch, defuddle pipeline, cap/timeout, over-budget→verbatim, SPA fallback). |
| §6.3 renderer | add `kind: "url"` branch; URL shown verbatim (no tildify). |
| §8 file structure / deps | add the 5 deps as hard `dependencies` (§5); extension is no longer "one file, zero npm imports" internally, but user-facing setup is unchanged. |
| §9 algorithm | add the URL branch pseudocode (§8 above). |
| §10 edge cases | add the §7 rows. |
| §12 impl notes | add: `defuddle/node` string-input is deprecated (parse with linkedom); URLs never page; `enableUrls:false` gates all egress; re-open re-fetches (no cache). |

**Done-definition (URL half):** `#example.com` and `#https://example.com/x` both fetch,
extract via defuddle, and inject clean markdown as part of the `fileInjector.injected`
custom message, rendered as a green `read <url>` line; raw text/JSON/XML URLs inject
verbatim (no extraction); image URLs attach as images; oversized (>1 MB), over-budget,
empty-extraction (SPA), non-2xx, timed-out, and `enableUrls:false` cases all leave the
token verbatim with no network egress when disabled; no caching (re-open re-fetches); the
`#@file` behavior is byte-for-byte unchanged.