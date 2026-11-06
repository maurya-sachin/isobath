# Example runner (PLAN 6.2)

Code examples with `// →` output comments are claims. CI runs them on Node and fails when the output differs.

## Scope
- v1: fenced ```` ```js ```` blocks in `content/javascript/**` that contain a `// →` line. Other languages and topics (`browser`, `html-and-css`, `react`, `typescript`) need a browser or a build step; they wait for 6.13.
- Run on the repo's Node (`app/.node-version`). Browser-only or version-specific examples opt out; nothing else is skipped silently.

## Behaviour
- **Extract** with the existing Markdown parser (mdast `code` nodes: `lang`, `meta`, `position`), not a regex, so fences inside lists or quotes work.
- **Expected** = the text of every `// → …` comment in the block, in source order, plus indented `//   …` lines directly after one (`//   42` continues the output above).
- **Actual** = stdout (`console.log`, `console.error` excluded) plus the first `…Error: message` line of stderr when the process exits non-zero.
- **Compare** with all whitespace removed on both sides: the comments are hand-formatted, `util.inspect` wraps lines. An expected text containing `…` or `...` is an elision: split on it and require each part to appear, in order.
- **Mode**: a block runs as a strict ES module (`.mjs`; the text says "modules are strict"). Fence meta `script` runs it as sloppy-mode CommonJS (`.cjs`) for examples about sloppy semantics or `process.nextTick` ordering.
- **Isolation**: each block runs in a fresh child process in a temp directory, 10 s timeout, no network assumed.
- **Opt-out**: fence meta `no-run` (```` ```js no-run ````) for examples that need more than one self-contained file: other modules, Node flags (`--expose-gc`, `--allow-natives-syntax`), environment variables, npm packages, earlier blocks of the same question, timing-dependent output. Meta does not change rendering (checked by the build).
- **Report**: `file:line` of the block, expected vs actual, exit 1 on any mismatch. Summary line: ran / skipped / failed.

## Wiring
- `app/scripts/lib/examples.ts` (pure: extract, compare; `node:test` covered) and `app/scripts/examples.ts` (walk + spawn).
- `npm run examples:check` in `app/`; a separate CI step after `content:check`.

## Not doing
- No sandboxing beyond a child process and a timeout: content is reviewed in PRs.
- No auto-rewrite of expected output; the author decides whether the text or the claim is wrong.
