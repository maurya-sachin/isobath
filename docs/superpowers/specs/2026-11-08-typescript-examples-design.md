# TypeScript example check (PLAN 6.2c)

TypeScript questions make two kinds of claim in ```` ```ts ```` blocks: `// Error TSnnnn: …` under a line that must not compile (about 132) and `// →` output of a line that runs (about 47). `examples:check` skips both today. This adds a compiler check for the first and reuses the runner for the second.

## Behaviour
- **Extract** ts fences with the existing `extractExamples` (same meta: `no-run`, `continues`, `files`). Language `ts` joins `js`; the topic filter widens from `javascript` to every topic that has such fences.
- **Type check** a block that has `// Error TSnnnn` lines: compile it in memory with the `typescript` package already in `app/` (`createProgram` with a virtual host), `strict`, `target esnext`, `module esnext`, `moduleResolution bundler`, `noEmit`. A block whose header comment names other options (`// TypeScript 7.0.2 and 6.0.3, --strict`) uses them only if they are in an allow-list, as with `node=` flags; an unknown option is a build error.
- **Expected** diagnostics = each `// Error TSnnnn` comment, attached to the nearest code line above it. **Actual** = the compiler's diagnostics with their line. They match when the set of `(line, code)` pairs is equal. The message text after the code is not compared: it varies by version and the prose is hand-shortened.
- **Blocks with no `// Error`** must compile with zero diagnostics; this catches a block that quietly stopped compiling. Fragments that cannot stand alone (`declare function` stubs, exercise signatures) opt out with `no-run`, as in JS.
- **Run** a block with `// →` through Node's type stripping (`.mts`, the repo's Node 24), so it needs no build. Syntax that is not erasable (enums, namespaces, parameter properties) is a build error naming the line; those blocks are `no-run` with the reason in the question.
- **Version.** Questions cite the compiler version they were checked on. CI uses the installed one; a code that no longer reproduces is a failure to fix in its own `content:` commit, not a loosened check.

## Wiring
- `app/scripts/lib/typecheck.ts` (pure: collect expected and actual pairs; `node:test` covered) and a TS branch in `examples.ts`. Same command, same CI step; the summary line gains `type-checked N`.

## Not doing
- Multi-file projects with `tsconfig` variants (module resolution, declaration-file chapters): `no-run` until a `files`-style header is designed for them.
- Type-level assertions of inferred types (`// number[]` comments). They are not machine-readable today; a later spec can add `// ^?` markers.
- tsx/React blocks.

## Verification
- Tests: matching and mismatching `(line, code)` sets, a clean block, an unknown option, non-erasable syntax.
- Dry run before wiring: ran and skipped counts per chapter, and every failure listed. Expected: most `// Error` claims pass; failures are real findings, fixed separately.
