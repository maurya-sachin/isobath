# Example runner (PLAN 6.2)

Code examples with `// →` output comments are claims. CI runs them on Node and fails when the output differs.

## Scope
- v1: fenced ```` ```js ```` blocks in `content/<topic>/**` that contain a `// →` line. Other languages (`ts`, `jsx`, `html`, `css`) need a browser or a build step and are out of scope.
- Run on the repo's Node (`app/.node-version`). Browser-only or version-specific examples opt out; nothing else is skipped silently.

## Behaviour
- **Extract** with the existing Markdown parser (mdast `code` nodes: `lang`, `meta`, `position`), not a regex, so fences inside lists or quotes work.
- **Expected** = the text of every `// → …` comment in the block, in order.
- **Actual** = stdout (`console.log`, `console.error` excluded) plus the first `…Error: message` line of stderr when the process exits non-zero.
- **Compare** with all whitespace removed on both sides: the comments are hand-formatted, `util.inspect` wraps lines. An expected text containing `…` or `...` is an elision: split on it and require each part to appear, in order.
- **Module type**: a block with top-level `import`/`export` or `await` runs as `.mjs`, otherwise `.cjs` (sloppy mode, which examples about sloppy behaviour need).
- **Isolation**: each block runs in a fresh child process in a temp directory, 10 s timeout, no network assumed.
- **Opt-out**: fence meta `no-run` (```` ```js no-run ````), with the reason in the surrounding prose. Meta does not change rendering (verified by the build).
- **Report**: `file:line` of the block, expected vs actual, exit 1 on any mismatch. Summary line: ran / skipped / failed.

## Wiring
- `app/scripts/lib/examples.ts` (pure: extract, compare; `node:test` covered) and `app/scripts/examples.ts` (walk + spawn).
- `npm run examples:check` in `app/`; a separate CI step after `content:check`.

## Not doing
- No sandboxing beyond a child process and a timeout: content is reviewed in PRs.
- No auto-rewrite of expected output; the author decides whether the text or the claim is wrong.
