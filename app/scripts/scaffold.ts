// content:scaffold — creates a topic's chapter folders, chapter READMEs and `planned` question stubs from an
// approved outline. Usage: npm run content:scaffold -- <outline.yml> [--dry-run]
//
// The outline is authored elsewhere (a topic spec passed to the writer); this script invents no titles and
// overwrites nothing. After writing it syncs READMEs and runs the same checks as content:check.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { collectProblems, printProblems } from './lib/check.ts'
import { loadContent } from './lib/content.ts'
import { contentDir, repoRelative } from './lib/paths.ts'
import { writeStaleReadmes } from './lib/readme.ts'
import { parseOutline, plannedFiles, scaffoldTopic } from './lib/scaffold.ts'

const USAGE = 'Usage: npm run content:scaffold -- <outline.yml> [--dry-run]'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'dry-run': { type: 'boolean', default: false } },
})

if (positionals.length !== 1) {
  console.error(USAGE)
  process.exit(1)
}

const [outlineFile] = positionals
const outline = parseOutline(await readFile(path.resolve(outlineFile), 'utf8'), outlineFile)

// A topic README carries the scope, track and sources; the scaffold must not invent a topic.
const topicReadme = path.join(contentDir, outline.topic, 'README.md')
try {
  await readFile(topicReadme)
} catch {
  console.error(`✖ no topic README at ${repoRelative(topicReadme)} — create the topic first`)
  process.exit(1)
}

if (values['dry-run']) {
  for (const file of plannedFiles(contentDir, outline)) console.log(`would create ${repoRelative(file)}`)
  process.exit(0)
}

const files = await scaffoldTopic(contentDir, outline)
for (const file of files) console.log(`created ${repoRelative(file)}`)

const content = await loadContent()
for (const readme of await writeStaleReadmes(content.topics)) console.log(`updated ${repoRelative(readme)}`)

// Reload, because the READMEs on disk changed after the first load.
const synced = await loadContent()
const problems = collectProblems(synced)
printProblems(problems)
if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} problem(s) after scaffolding — fix them before writing content`)
  process.exitCode = 1
} else {
  console.log(
    `✔ ${outline.chapters.length} chapters and ${files.length - outline.chapters.length} questions scaffolded`,
  )
  console.log('Next: fill in real sources and open questions, then hand the stubs to the question writer.')
}
