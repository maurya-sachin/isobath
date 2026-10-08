// examples:check — runs every ```js example that states its output with `// →` on Node and
// fails when the output differs. Fence meta: `no-run` opts out, `script` runs sloppy-mode CommonJS (default: strict ES module),
// `node=--flag` and `env=NAME=value` set the process, `continues` runs after the previous js fence. Exits 1 on any mismatch.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadContent } from './lib/content.ts'
import { extractExamples, outputMatches, printedOutput, type Example } from './lib/examples.ts'
import { repoRelative } from './lib/paths.ts'

const TIMEOUT_MS = 10_000

const content = await loadContent()
const files = content.topics
  .filter((topic) => topic.slug === 'javascript')
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

function extractExamplesFrom(file: string) {
  try {
    return extractExamples(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${repoRelative(file)}: ${(error as Error).message}`, { cause: error })
  }
}

let ran = 0
let skipped = 0
let failed = 0

try {
  for (const file of files) {
    const extracted = extractExamplesFrom(file)
    skipped += extracted.skipped
    for (const example of extracted.examples) {
      ran++
      const actual = runExample(example, ran)
      if (outputMatches(example.expected, actual)) continue
      failed++
      console.error(
        `✖ ${repoRelative(file)}:${example.line}\n  expected: ${example.expected.join(' | ')}\n  actual:   ${actual.trim().split('\n').join(' | ')}`,
      )
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

const summary = `${ran} ran, ${skipped} skipped (no-run), ${failed} failed`
if (failed > 0) {
  console.error(`\n✖ ${summary}`)
  process.exitCode = 1
} else {
  console.log(`✔ ${summary}`)
}
