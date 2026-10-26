// Compiler check for TypeScript examples: a block that writes `// Error TSnnnn` under a line claims the compiler
// rejects it. This compiles the block in memory and compares the error codes. Pure logic apart from the compiler call.

import ts from 'typescript'
import { COMPILER_ERROR_COMMENT, fencedBlocks, isNoRun } from './examples.ts'

export interface TypeCheck {
  /** Line of the opening fence in the file. */
  line: number
  code: string
  /** The code of every `// Error TSnnnn` comment, in source order. */
  expected: number[]
}

// Every block is a module, so its top-level names cannot clash with lib globals such as `name`.
const OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  moduleDetection: ts.ModuleDetectionKind.Force,
  noEmit: true,
  skipLibCheck: true,
}
const FILE_NAME = 'example.ts'

export function expectedErrorCodes(code: string): number[] {
  return code.split('\n').flatMap((line) => {
    const codes = COMPILER_ERROR_COMMENT.exec(line)?.[1].match(/\d+/g)
    return codes ? codes.map(Number) : []
  })
}

/** The ```ts blocks of a Markdown file that claim a compiler error; blocks marked `no-run` are counted in `skipped`. */
export function extractTypeChecks(markdown: string): { checks: TypeCheck[]; skipped: number } {
  const checks: TypeCheck[] = []
  let skipped = 0
  for (const node of fencedBlocks(markdown, 'ts')) {
    const expected = expectedErrorCodes(node.value)
    if (expected.length === 0) continue
    if (isNoRun(node)) skipped++
    else checks.push({ line: node.position?.start.line ?? 0, code: node.value, expected })
  }
  return { checks, skipped }
}

const defaultHost = ts.createCompilerHost(OPTIONS)

/** The code of every diagnostic the compiler reports for the block, in source order. */
export function compilerErrorCodes(code: string): number[] {
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (name) => name === FILE_NAME || defaultHost.fileExists(name),
    readFile: (name) => (name === FILE_NAME ? code : defaultHost.readFile(name)),
    getSourceFile: (name, languageVersion) =>
      name === FILE_NAME
        ? ts.createSourceFile(name, code, languageVersion)
        : defaultHost.getSourceFile(name, languageVersion),
  }
  const program = ts.createProgram([FILE_NAME], OPTIONS, host)
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(FILE_NAME)).map((diagnostic) => diagnostic.code)
}

/**
 * Whether the compiler reported exactly the claimed kinds of error. Neither lines nor counts are compared: a
 * multi-line statement reports at a sub-expression, one comment can cover an error reported on two declarations, and
 * the message text varies by version.
 */
export function sameErrorCodes(expected: number[], actual: number[]): boolean {
  const distinct = (codes: number[]) => [...new Set(codes)].sort((a, b) => a - b).join()
  return distinct(expected) === distinct(actual)
}
