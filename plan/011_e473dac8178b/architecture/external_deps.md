# External Dependencies — Delta 011 (Line-Range Gap Closure)

**Zero new external dependencies.** All five gaps (LR-1…LR-5) are closed with machinery already in
`file-injector.ts` at HEAD `ef57bd0`:

| Need | Already in-repo (verified) |
|---|---|
| Budget decision on slices | `PAGED_THRESHOLD` (L88), `HEAD_CHARS` (L90), `READ_LIMIT` (L92), `subtract()`, `state.remaining` |
| Paged head + directive | `headSlice()`, `headCompleteLineCount()` (~L393), `formatPagedDirectiveBlock()` (L411), `extractDirectiveInner()` |
| Failure notifies | `ctx.hasUI` + `ctx.ui.notify(message, type)` pattern (SPA fallback L956; §5.5 notify L1700) |
| Line slicing / parsing | `splitLineRange` (L170), `sliceLines` (L183), `claimKey` (L192) |
| Test budget mocks | `FIX` / `PAGED_FIX` (L415) / `TINY_FIX` (L1127) in `file-injector.test.mjs`; notify spy pattern from `url-injection.test.mjs` L703 |

Node built-ins only (`fs`, `path`, `os`); no npm installs, no network, no new pi-extension APIs.
No external documentation research was required — the normative behavior is fully specified in
`spec/17-line-ranges.md` §3/§5/§6/§9/§10 (verified present and synced at HEAD).

**Do-not-regress surface (existing deps, awareness only):** the URL feature stack (defuddle/turndown
pipeline, `CODE_EXTENSIONS` deny-list, `onUrlFetch` spinner) is shipped and guarded by
`url-injection.test.mjs` — none of it is touched by this delta.