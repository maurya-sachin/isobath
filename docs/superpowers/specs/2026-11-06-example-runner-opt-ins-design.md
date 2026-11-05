# Run more JS examples (PLAN 6.2b)

48 JS examples opt out with `no-run`. Running every one of them without the opt-out (scratch script, 2026-11-06) shows why:

| Why it can't run alone | Blocks | Fix |
|---|---|---|
| Needs a Node flag (`--expose-gc` 6, `--allow-natives-syntax` 5) | 11 | `node=` fence meta |
| Several files in one fence, named by `// lib.cjs`-style header lines (modules, circular imports, JSON imports, `import.meta`) | about 16 | `files` and `run=` fence meta |
| Continues an earlier block (an exercise calls `bind`, `runTasks`, `MyPromise` from the Example) | about 9 | `continues` fence meta |
| Needs an environment variable | 1 | `env=` fence meta |
| Already passes (stale opt-out) | 1 | remove `no-run` |
| Timing output (2 regex, 2 more), racy values (SharedArrayBuffer, 2), npm polyfill `@js-temporal/polyfill` (4), iterator helpers this Node lacks (1) | about 10 | stay `no-run` |

## Mechanisms
- **`node=<flag>[,<flag>]`** on the fence: extra flags for the child process. Allow-list: `--expose-gc`, `--allow-natives-syntax`; anything else is a build error, so a flag can't smuggle in behaviour.
- **`env=NAME=value`** (repeatable): sets environment variables for the child process.
- **Multi-file fences: `files` and `run=`.** With the fence meta `files`, a line `// <name>.<mjs|cjs|js|json>` at column 0 (a note may follow: `// main.mjs: ESM importing CommonJS`) starts a file, written into the run's temp directory under that name. `run=a.mjs,b.cjs` names the files to run, in order, each in its own process; their stdout is concatenated and compared with the `// →` lines. `files` without `run=`, a `run=` name that is no file, or code before the first header is a build error. Without `files`, header-like comments are ordinary comments: the existing content has single-file examples that begin `// example.mjs` and some that run today with several such lines, so detection by shape would break them. `script` and `no-run` keep their meaning.
- **`continues`** on the fence: the code of the nearest preceding `js` fence of the same question is placed before this block in the same file, with `console.log` silenced while it runs, so only this block's output is compared. If the earlier fence is itself `continues`, its prefix comes first. Limit: output from timers or promises in the earlier block is not silenced; such blocks stay `no-run`.
- Meta tokens do not change rendering (the build already checks that meta is stripped from output).

## Not doing
- Running TypeScript, browser or Temporal examples (they wait for 6.13) or installing packages.
- Changing an example's text to make it runnable; where a run exposes a wrong claim, the question is fixed in its own `content:` commit.
- Hiding timing-dependent examples by loosening comparison.

## Verification
- `scripts/lib/examples.ts` gains tests for each mechanism: flag allow-list, env, `files`/`run=` (including the errors and header-like comments without `files`), and `continues` silencing.
- `npm run examples:check`: ran and skipped counts before and after. Expected: about 38 more run, about 10 stay skipped. Each opt-out removed is a mechanical edit (add meta, drop `no-run`) in a commit per chapter; failures are listed and fixed separately.
