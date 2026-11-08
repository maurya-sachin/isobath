// examples:check — runs every ```js and ```ts example that states its output with `// →` on Node (TypeScript through
// type stripping) and fails when the output differs. A ```ts block with `// Error TSnnnn` comments is compiled and
// fails when the compiler reports other errors. Fence meta: `no-run` opts out, `script` runs sloppy-mode CommonJS (default: strict ES module),
// `node=--flag` and `env=NAME=value` set the process, `continues` runs after the previous js fence. Exits 1 on any mismatch.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadContent } from './lib/content.ts'
import { extractExamples, outputMatches, printedOutput, type Example, type ExampleLanguage } from './lib/examples.ts'
import { repoRelative } from './lib/paths.ts'
import { compilerErrorCodes, extractTypeChecks, sameErrorCodes } from './lib/typecheck.ts'

const TIMEOUT_MS = 10_000

const content = await loadContent()
/** The question files of a topic. */
const filesOf = (slug: string) =>
  content.topics
    .filter((topic) => topic.slug === slug)
    .flatMap((topic) => topic.chapters.flatMap((chapter) => chapter.questions.map((question) => question.file)))
const workDir = mkdtempSync(path.join(tmpdir(), 'isobath-examples-'))

/** Writes the example's files into a fresh directory and runs each entry in turn; returns what they printed. */
function runExample(example: Example, id: number): string {
  const dir = path.join(workDir, String(id))
  mkdirSync(dir)
  for (const file of example.files) writeFileSync(path.join(dir, file.name), file.code)
  return example.entries
    .map((entry) => {
      const result = spawnSync(process.execPath, [...example.nodeFlags, entry], {
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
        cwd: dir,
        env: { ...process.env, ...example.env },
      })
      return printedOutput(result.stdout, result.stderr, result.status)
    })
    .join('')
}

/** Wraps a parse error with the file it came from. */
function inFile<T>(file: string, read: () => T): T {
  try {
    return read()
  } catch (error) {
    throw new Error(`${repoRelative(file)}: ${(error as Error).message}`, { cause: error })
  }
}

let ran = 0
let checked = 0
let skipped = 0
let failed = 0

function fail(message: string) {
  failed++
  console.error(message)
}

function runFile(file: string, lang: ExampleLanguage) {
  const extracted = inFile(file, () => extractExamples(readFileSync(file, 'utf8'), lang))
  skipped += extracted.skipped
  for (const example of extracted.examples) {
    ran++
    const actual = runExample(example, ran)
    if (outputMatches(example.expected, actual)) continue
    fail(
      `✖ ${repoRelative(file)}:${example.line}\n  expected: ${example.expected.join(' | ')}\n  actual:   ${actual.trim().split('\n').join(' | ')}`,
    )
  }
}

function typeCheckFile(file: string) {
  const extracted = inFile(file, () => extractTypeChecks(readFileSync(file, 'utf8')))
  skipped += extracted.skipped
  for (const check of extracted.checks) {
    checked++
    const actual = compilerErrorCodes(check.code)
    if (sameErrorCodes(check.expected, actual)) continue
    const codes = (list: number[]) => (list.length > 0 ? list.map((code) => `TS${code}`).join(' ') : 'none')
    fail(`✖ ${repoRelative(file)}:${check.line}\n  expected: ${codes(check.expected)}\n  compiler: ${codes(actual)}`)
  }
}

try {
  for (const file of filesOf('javascript')) runFile(file, 'js')
  for (const file of filesOf('typescript')) {
    runFile(file, 'ts')
    typeCheckFile(file)
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

const summary = `${ran} ran, ${checked} type-checked, ${skipped} skipped, ${failed} failed`
if (failed > 0) {
  console.error(`\n✖ ${summary}`)
  process.exitCode = 1
} else {
  console.log(`✔ ${summary}`)
}
