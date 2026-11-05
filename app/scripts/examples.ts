// examples:check — runs every ```js example that states its output with `// →` on Node and
// fails when the output differs. Fence meta: `no-run` opts out, `script` runs sloppy-mode CommonJS (default: strict ES module). Exits 1 on any mismatch.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadContent } from './lib/content.ts'
import { extractExamples, outputMatches, printedOutput } from './lib/examples.ts'
import { repoRelative } from './lib/paths.ts'

const TIMEOUT_MS = 10_000

const content = await loadContent()
const files = content.topics
  .filter((topic) => topic.slug === 'javascript')
  .flatMap((topic) => topic.chapters.flatMap((chapter) => chapter.questions.map((question) => question.file)))
const workDir = mkdtempSync(path.join(tmpdir(), 'isobath-examples-'))

let ran = 0
let skipped = 0
let failed = 0

try {
  for (const file of files) {
    const extracted = extractExamples(readFileSync(file, 'utf8'))
    skipped += extracted.skipped
    for (const example of extracted.examples) {
      ran++
      const script = path.join(workDir, example.mode === 'module' ? 'example.mjs' : 'example.cjs')
      writeFileSync(script, example.code)
      const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: TIMEOUT_MS, cwd: workDir })
      const actual = printedOutput(result.stdout, result.stderr, result.status)
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
