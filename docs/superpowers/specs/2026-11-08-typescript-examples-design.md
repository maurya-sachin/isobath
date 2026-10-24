# TypeScript example check (PLAN 6.2c)

TypeScript questions make two kinds of claim in ```` ```ts ```` blocks: `// Error TSnnnn: …` under a line that must not compile (about 132) and `// →` output of a line that runs (about 47). `examples:check` skips both today. This adds a compiler check for the first and reuses the runner for the second.

## Behaviour
- **Extract** ts fences with the existing extractor (same meta: `no-run`, `continues`, `files`, `node=`, `env=`). `extractExamples` takes a language; `examples:check` runs `js` for the `javascript` topic and `ts` for the `typescript` topic.
- **Type check** only a block that claims an error with `// Error TSnnnn` (also `// Error: TSnnnn`, a version prefix `// 7.0.2 Error: …`, and several codes `TS1238 and TS1270`). It is compiled in memory with the installed `typescript`: `strict`, `target esnext`, `module esnext`, `moduleResolution bundler`, `moduleDetection force` (so top-level names cannot clash with lib globals), `skipLibCheck`, `noEmit`.
- **Match** = the set of error codes the compiler reports equals the set of codes claimed. Lines, counts and message text are not compared: a multi-line statement reports at a sub-expression, one comment can cover an error reported on two declarations, and messages vary by version. (Changed from the first draft after a dry run over all 99 blocks: line matching gave false alarms.)
- **Blocks with no `// Error`** are not compiled. (Changed from the first draft: exercise stubs and fragments such as `declare function` do not compile alone, and the dry run showed about 20 false alarms.)
- **Run** a block with `// →` through Node's type stripping (`example.mts`). A block that also claims a compiler error is type-checked, not run, and counted as skipped: its output claim describes the code without the failing line. Syntax stripping cannot erase (enums, parameter properties, namespaces) needs the fence meta `node=--experimental-transform-types`, now on the flag allow-list. Decorators run on neither; those blocks are `no-run`.
- **Opt-out** is `no-run`, which skips both checks. Used for blocks that need other compiler options (`noImplicitOverride`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, …), several files, npm packages, a `tsconfig`, or `tsc` itself.
- **Version.** Questions cite the compiler version they were checked on. CI uses the installed one (6.0.x); where the text lists a 7.x message that differs, only the code is compared.

## Wiring
- `app/scripts/lib/typecheck.ts` (pure: collect expected and actual pairs; `node:test` covered) and a TS branch in `examples.ts`. Same command, same CI step; the summary line gains `type-checked N`.

## Not doing
- Multi-file projects, compiler options per block, `tsconfig` variants (module resolution, declaration-file chapters): `no-run` until a header for them is designed. 15 blocks wait on that.
- Type-level assertions of inferred types (`// number[]` comments). They are not machine-readable today; a later spec can add `// ^?` markers.
- tsx/React blocks.

## Result (built 2026-11-08)
- 55 blocks claim an error; 40 are type-checked and pass, 15 are `no-run` (options, files, packages, tsconfig). 20 blocks in chapters 04 to 08 changed their fence line only (one commit per chapter); the rendered pages are unchanged. Nine ts blocks run for their output.
- Findings: none. Every mismatch was the block needing something the check does not provide, not a wrong claim.
