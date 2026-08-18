// URL-injection corpus — ~60 real-world URLs a user might drop into a prompt as `#<url>`.
// Categories + expected outcome ("grade") per entry. NOT part of `npm test` (hits the real network).
// Run manually:  node tools/url-corpus.mjs
//
// Grading vocabulary (harness compares these to what the extension actually did):
//   raw      → fetched text delivered VERBATIM in the block (raw-text / JSON path)
//   extract  → text/html ran through defuddle and produced ≥ URL_MIN_CONTENT markdown
//   image    → image/* → resized + attached to images[]
//   cap      → > URL_MAX_BYTES (1 MB) → declined BEFORE/while downloading (token left verbatim)
//   decline  → expected verbatim fallback: unhandled content-type (PDF), 404, bot-blocked, JS shell
//   any      → record-only (behavior of interest, no pass/fail)

export const CORPUS = [
  // ── Raw code hosting (text/plain files — the BUG-002 class) ─────────────────────────
  { url: "https://raw.githubusercontent.com/dabstractor/stagecoach/refs/heads/main/README.md", cat: "raw-github", grade: "raw" }, // regression anchor (starts with <p align="center">)
  { url: "https://raw.githubusercontent.com/torvalds/linux/master/README", cat: "raw-github", grade: "raw" },
  { url: "https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore", cat: "raw-github", grade: "raw" },
  { url: "https://raw.githubusercontent.com/python/cpython/main/LICENSE", cat: "raw-github", grade: "raw" },
  { url: "https://raw.githubusercontent.com/rust-lang/rust/master/Cargo.toml", cat: "raw-github", grade: "raw" }, // TOML served text/plain
  { url: "https://raw.githubusercontent.com/nodejs/node/main/README.md", cat: "raw-github", grade: "raw" }, // starts with ![alt logo] (markdown img, not '<')
  { url: "https://raw.githubusercontent.com/sindresorhus/awesome/main/readme.md", cat: "raw-github", grade: "raw" }, // large markdown list
  { url: "https://raw.githubusercontent.com/torvalds/linux/master/Makefile", cat: "raw-github", grade: "raw" }, // tabs, no trailing newline — parser abuse
  { url: "https://raw.githubusercontent.com/git/git/master/Documentation/git.adoc", cat: "raw-github", grade: "raw" }, // asciidoc prose (git.txt no longer exists — 404)
  { url: "https://raw.githubusercontent.com/jlevy/the-art-of-command-line/master/README.md", cat: "raw-github", grade: "raw" }, // large markdown (OWASP master paths 404 — branch restructure)
  { url: "https://raw.githubusercontent.com/microsoft/TypeScript/main/src/compiler/checker.ts", cat: "raw-github", grade: "cap" }, // famously >1 MB source file → 1 MB cap

  // ── GitHub HTML pages (server-rendered repo views) ─────────────────────────────────
  { url: "https://github.com/torvalds/linux", cat: "github-html", grade: "extract" },
  { url: "https://github.com/nodejs/node/blob/main/README.md", cat: "github-html", grade: "extract" }, // README view page
  { url: "https://github.com/sindresorhus/awesome", cat: "github-html", grade: "extract" },

  // ── Framework docs (static-site-generator docs, heavily referenced) ────────────────
  { url: "https://react.dev/learn", cat: "docs", grade: "extract" },
  { url: "https://react.dev/reference/react/hooks", cat: "docs", grade: "extract" },
  { url: "https://vuejs.org/guide/introduction.html", cat: "docs", grade: "extract" },
  { url: "https://angular.dev/overview", cat: "docs", grade: "extract" },
  { url: "https://svelte.dev/docs/svelte", cat: "docs", grade: "any" }, // svelte.dev is SvelteKit — hydration shell risk
  { url: "https://kit.svelte.dev/docs/introduction", cat: "docs", grade: "any" },
  { url: "https://nuxt.com/docs/getting-started/introduction", cat: "docs", grade: "any" },
  { url: "https://nextjs.org/docs/app/getting-started/installation", cat: "docs", grade: "extract" },
  { url: "https://www.typescriptlang.org/docs/handbook/intro.html", cat: "docs", grade: "extract" },
  { url: "https://vitejs.dev/guide/", cat: "docs", grade: "extract" },
  { url: "https://tailwindcss.com/docs/utility-first", cat: "docs", grade: "extract" },
  { url: "https://jestjs.io/docs/getting-started", cat: "docs", grade: "extract" },
  { url: "https://vitest.dev/guide/", cat: "docs", grade: "extract" },
  { url: "https://eslint.org/docs/latest/use/getting-started", cat: "docs", grade: "extract" },
  { url: "https://prettier.io/docs/en/index.html", cat: "docs", grade: "extract" },
  { url: "https://go.dev/doc/", cat: "docs", grade: "extract" },
  { url: "https://doc.rust-lang.org/book/ch01-01-installation.html", cat: "docs", grade: "extract" },
  { url: "https://docs.python.org/3/tutorial/index.html", cat: "docs", grade: "extract" },
  { url: "https://ziglang.org/learn/", cat: "docs", grade: "extract" },
  { url: "https://docs.deno.com/runtime/fundamentals/", cat: "docs", grade: "any" }, // …/introduction/ was restructured away (404) — fundaments hub is live

  // ── Platform / cloud docs (often huge pages) ───────────────────────────────────────
  { url: "https://docs.docker.com/get-started/", cat: "docs-platform", grade: "any" }, // sparse Docusaurus hub page: defuddle legitimately extracts only ~440 chars (page's real text)
  { url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/", cat: "docs-platform", grade: "extract" },
  { url: "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html", cat: "docs-platform", grade: "extract" },
  { url: "https://learn.microsoft.com/en-us/windows/win32/apiindex/windows-api-list", cat: "docs-platform", grade: "extract" }, // giant index page
  { url: "https://developer.android.com/guide", cat: "docs-platform", grade: "any" },
  { url: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/", cat: "docs-platform", grade: "any" }, // DocC SPA — big test
  { url: "https://dev.mysql.com/doc/refman/8.0/en/select.html", cat: "docs-platform", grade: "extract" },
  { url: "https://www.postgresql.org/docs/current/tutorial.html", cat: "docs-platform", grade: "extract" },
  { url: "https://redis.io/docs/latest/develop/get-started/", cat: "docs-platform", grade: "any" },

  // ── Manuals / reference pages ──────────────────────────────────────────────────────
  { url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", cat: "manual", grade: "extract" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise", cat: "manual", grade: "extract" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/CSS/flex", cat: "manual", grade: "extract" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/API/fetch", cat: "manual", grade: "extract" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization", cat: "manual", grade: "extract" },
  { url: "https://www.rfc-editor.org/rfc/rfc9110", cat: "manual", grade: "any" }, // huge HTML RFC (~1MB? cap risk)
  { url: "https://www.rfc-editor.org/rfc/rfc6749", cat: "manual", grade: "any" },
  { url: "https://semver.org", cat: "manual", grade: "extract" },
  { url: "https://keepachangelog.com/en/1.1.0/", cat: "manual", grade: "extract" },
  { url: "https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control", cat: "manual", grade: "extract" },
  { url: "https://man7.org/linux/man-pages/man3/printf.3.html", cat: "manual", grade: "extract" }, // 1998-style minimal HTML

  // ── Dev articles / blogs ───────────────────────────────────────────────────────────
  { url: "https://medium.com/@lydiahallie/javascript-visualized-promises-async-await-a3f1aad8a943", cat: "article", grade: "any" }, // Medium paywall/consent risk
  { url: "https://javascript.info/async-await", cat: "article", grade: "extract" },
  { url: "https://www.freecodecamp.org/news/when-to-use-asyncawait-vs-promises-in-javascript/", cat: "article", grade: "extract" },
  { url: "https://www.smashingmagazine.com/guides/css-layout/", cat: "article", grade: "extract" },
  { url: "https://netflixtechblog.com/introducing-impressions-at-netflix-e2b67c88c9fb", cat: "article", grade: "any" }, // Medium-hosted
  { url: "https://web.dev/learn/", cat: "article", grade: "extract" },
  { url: "https://go.dev/blog/slices-intro", cat: "article", grade: "extract" },
  { url: "https://github.blog/changelog/", cat: "article", grade: "extract" },
  { url: "https://martinfowler.com/bliki/TechnicalDebt.html", cat: "article", grade: "extract" }, // old-school static HTML
  { url: "https://www.joelonsoftware.com/2001/12/11/back-to-basics/", cat: "article", grade: "extract" },
  { url: "https://blog.rust-lang.org/", cat: "article", grade: "extract" },

  // ── Q&A / community threads ────────────────────────────────────────────────────────
  // NOTE: Stack Overflow sits behind Cloudflare bot management — 403 even with a browser UA.
  // The extension correctly declines (§3.5 verbatim, silent, no crash). Kept as DECLINE expectations
  // to pin that behavior; users wanting SO content must paste it or use a mirror.
  { url: "https://stackoverflow.com/questions/111102/how-do-javascript-closures-work", cat: "qa", grade: "decline" }, // 403 Cloudflare
  { url: "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array", cat: "qa", grade: "decline" }, // 403 Cloudflare
  { url: "https://stackoverflow.com/questions/231767/what-does-the-yield-keyword-do-in-python", cat: "qa", grade: "decline" }, // 403 Cloudflare
  { url: "https://news.ycombinator.com/item?id=48357725", cat: "qa", grade: "extract" }, // Who is hiring (Jun 2026) — 1000+ comment table
  { url: "https://news.ycombinator.com/item?id=38103362", cat: "qa", grade: "extract" }, // Did anybody get a job via HN threads
  { url: "https://old.reddit.com/r/learnjavascript/comments/xxujtp/whats_an_async_await_and_a_promise/", cat: "qa", grade: "any" }, // old.reddit = server-rendered
  { url: "https://www.reddit.com/r/learnjavascript/comments/xxujtp/whats_an_async_await_and_a_promise/", cat: "qa", grade: "any" }, // www = bot-wall + SPA risk

  // ── Wikis / encyclopedias ──────────────────────────────────────────────────────────
  { url: "https://en.wikipedia.org/wiki/JavaScript", cat: "wiki", grade: "extract" },
  { url: "https://en.wikipedia.org/wiki/Regular_expression", cat: "wiki", grade: "extract" }, // dense math/unicode
  { url: "https://en.wikipedia.org/wiki/SHA-2", cat: "wiki", grade: "extract" }, // contains big hex pseudocode blocks
  { url: "https://wiki.archlinux.org/title/Pacman", cat: "wiki", grade: "extract" }, // MediaWiki, heavy monospace
  { url: "https://ja.wikipedia.org/wiki/JavaScript", cat: "wiki", grade: "extract" }, // CJK content — charset/budget check

  // ── Package registries (SPA risk) ──────────────────────────────────────────────────
  { url: "https://www.npmjs.com/package/express", cat: "registry", grade: "any" },
  { url: "https://pypi.org/project/requests/", cat: "registry", grade: "extract" }, // server-rendered
  { url: "https://crates.io/crates/serde", cat: "registry", grade: "any" }, // wasm SPA

  // ── JSON / data APIs ───────────────────────────────────────────────────────────────
  { url: "https://api.github.com/repos/nodejs/node", cat: "api", grade: "raw" }, // application/json
  { url: "https://api.github.com/repos/microsoft/vscode/languages", cat: "api", grade: "raw" }, // JSON array
  { url: "https://registry.npmjs.org/react/latest", cat: "api", grade: "raw" }, // big JSON
  { url: "https://jsonplaceholder.typicode.com/todos/1", cat: "api", grade: "raw" }, // application/json (httpbin.org is chronically down — 504)
  { url: "https://hnrss.org/frontpage", cat: "api", grade: "raw" }, // RSS/XML feed — xml-in-content-type route

  // ── Images ─────────────────────────────────────────────────────────────────────────
  { url: "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png", cat: "image", grade: "image" },
  { url: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png", cat: "image", grade: "image" },
  { url: "https://raw.githubusercontent.com/github/explore/main/topics/github/github.png", cat: "image", grade: "image" }, // raw serves images as image/png (httpbin.org down)

  // ── Deliberate edge cases ──────────────────────────────────────────────────────────
  { url: "https://example.com", cat: "edge", grade: "any" }, // tiny real page (~1256 bytes) — probes the 200-char floor on a NON-JS page
  { url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", cat: "edge", grade: "decline" }, // application/pdf → unhandled
  { url: "https://raw.githubusercontent.com/nonexistent-org-xyz-98765/nope/main/README.md", cat: "edge", grade: "decline" }, // 404
  { url: "http://github.com/git/git", cat: "edge", grade: "extract" }, // http→https redirect (redirect:"follow" test)
  { url: "https://x.com/jack", cat: "edge", grade: "extract" }, // SURPRISE: x.com SSRs profile metadata (bio, counts, pinned tweet) — defuddle yields a USEFUL ~2.9KB profile summary; timeline itself is absent
  { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", cat: "edge", grade: "decline" }, // multi-MB SPA page
];