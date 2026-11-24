import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { parseOutline, plannedFiles, renderChapterReadme, renderStub, scaffoldTopic } from './scaffold.ts'

const outline = `
topic: accessibility
chapters:
  - number: "01"
    slug: wcag
    title: WCAG and the accessibility tree
    summary: What the standard requires and what the browser exposes.
    learning_goals:
      - Explain the four WCAG principles
    sources:
      - "[WCAG 2.2](https://www.w3.org/TR/WCAG22/)"
    questions:
      - slug: what-is-wcag
        title: "What is WCAG, and which success criteria do interviewers ask about?"
        difficulty: medium
        frequency: 5
        core: true
      - slug: accessibility-tree
        title: What is the accessibility tree?
        difficulty: medium
        frequency: 4
`

test('parses an outline and numbers questions in steps of ten', () => {
  const parsed = parseOutline(outline)
  assert.equal(parsed.topic, 'accessibility')
  assert.deepEqual(
    parsed.chapters[0].questions.map((question) => question.number),
    ['010', '020'],
  )
  assert.deepEqual(parsed.chapters[0].subTopics, [
    { text: 'What is WCAG, and which success criteria do interviewers ask about?', questions: ['010'] },
    { text: 'What is the accessibility tree?', questions: ['020'] },
  ])
})

test('rejects frequency 5 without core', () => {
  assert.throws(() => parseOutline(outline.replace('core: true', 'core: false')), /frequency 5 must set core: true/)
})

test('rejects a question that no sub-topic lists', () => {
  const text = outline.replace(
    '    questions:\n',
    '    sub_topics:\n      - text: WCAG\n        questions: ["010"]\n    questions:\n',
  )
  assert.throws(() => parseOutline(text), /question 020 is not listed under any sub-topic/)
})

test('rejects duplicate question numbers', () => {
  const text = outline.replace('        frequency: 4', '        number: "010"\n        frequency: 4')
  assert.throws(() => parseOutline(text), /question number 010 is used twice/)
})

test('renders a chapter README with an empty generated table for content:sync', () => {
  const parsed = parseOutline(outline)
  const readme = renderChapterReadme(parsed.chapters[0])
  assert.match(readme, /^# 01 — WCAG and the accessibility tree$/m)
  assert.match(readme, /^- What is WCAG[^\n]+ → 010$/m)
  assert.match(readme, /<!-- generated:questions:start -->\n<!-- generated:questions:end -->/)
  assert.match(readme, /^- \[WCAG 2\.2\]\(https:\/\/www\.w3\.org\/TR\/WCAG22\/\)$/m)
})

test('renders a planned stub with the same frontmatter as content:new', () => {
  const parsed = parseOutline(outline)
  assert.equal(
    renderStub(parsed.chapters[0].questions[0]),
    '---\ntitle: "What is WCAG, and which success criteria do interviewers ask about?"\nstatus: planned\ndifficulty: medium\nfrequency: 5\ncore: true\n---\n',
  )
})

test('writes the files once and refuses to overwrite', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'isobath-scaffold-'))
  try {
    const parsed = parseOutline(outline)
    const files = await scaffoldTopic(root, parsed)
    assert.equal(files.length, 3)
    assert.deepEqual(
      await readFile(files[0], 'utf8').then((text) => text.split('\n')[0]),
      '# 01 — WCAG and the accessibility tree',
    )
    assert.match(await readFile(files[1], 'utf8'), /^---\ntitle: "What is WCAG/m)
    await assert.rejects(scaffoldTopic(root, parsed), /already exists, not overwriting/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a dry run lists the files and writes nothing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'isobath-scaffold-'))
  try {
    const parsed = parseOutline(outline)
    const files = plannedFiles(root, parsed)
    assert.deepEqual(await scaffoldTopic(root, parsed, { dryRun: true }), files)
    await assert.rejects(access(files[0]))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
