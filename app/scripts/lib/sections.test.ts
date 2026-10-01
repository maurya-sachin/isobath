import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkSection, type Section } from './sections.ts'

const section = (heading: string, lines: string[]): Section => ({ heading, line: 1, lines })
const code = (count: number) => ['```js', ...Array.from({ length: count }, () => 'x'), '```']
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ')

test('Answer allows up to 300 words of prose and ignores code', () => {
  assert.deepEqual(checkSection(section('Answer', [words(300), ...code(100)])), [])
  assert.deepEqual(checkSection(section('Answer', [words(301)])), ['must be 300 words or fewer (has 301)'])
})

test('Example needs exactly one code block of at most 30 lines', () => {
  assert.deepEqual(checkSection(section('Example', code(30))), [])
  assert.deepEqual(checkSection(section('Example', code(31))), ['code block must be 30 lines or fewer (has 31)'])
  assert.deepEqual(checkSection(section('Example', [])), ['must have exactly 1 code block (has 0)'])
})

test('Pitfalls takes one to four bullets', () => {
  assert.deepEqual(checkSection(section('Pitfalls', ['- a', '- b', '- c', '- d'])), [])
  assert.deepEqual(checkSection(section('Pitfalls', [])), ['must have 1–4 bullets (has 0)'])
  assert.deepEqual(checkSection(section('Pitfalls', ['- 1', '- 2', '- 3', '- 4', '- 5'])), [
    'must have 1–4 bullets (has 5)',
  ])
})

test('Follow-ups pair every question with an answer of at most 50 words', () => {
  assert.deepEqual(checkSection(section('Follow-ups', ['**Q:** why?', '**A:** because'])), [])
  assert.deepEqual(checkSection(section('Follow-ups', ['**Q:** why?'])), [
    'every `**Q:**` line needs one `**A:**` line',
  ])
  assert.deepEqual(checkSection(section('Follow-ups', ['**Q:** why?', `**A:** ${words(51)}`])), [
    'answers must be 50 words or fewer (one has 51)',
  ])
})

test('Deep dive limits words and code blocks, and keeps its sub-headings in order', () => {
  assert.deepEqual(checkSection(section('Deep dive', ['### How it works', words(10), '### Edge cases'])), [])
  const out = checkSection(section('Deep dive', ['### Edge cases', '### How it works']))
  assert.equal(out.length, 1)
  assert.match(out[0], /out of order or repeated/)
  assert.deepEqual(checkSection(section('Deep dive', [words(1501)])), ['must be 1,500 words or fewer (has 1501)'])
})

test('Exercises need one to three, each with one code block and an answer line', () => {
  const good = ['### First', ...code(2), '**Answer:** yes']
  assert.deepEqual(checkSection(section('Exercises', good)), [])
  assert.deepEqual(checkSection(section('Exercises', [])), ['must have 1–3 exercises (has 0)'])
  assert.deepEqual(checkSection(section('Exercises', ['### First', ...code(2)])), [
    '"First" needs an `**Answer:**` line',
  ])
  assert.deepEqual(checkSection(section('Exercises', ['### First', '**Answer:** yes'])), [
    '"First" must have exactly 1 code block',
  ])
})

test('a section with no rules has no errors', () => {
  assert.deepEqual(checkSection(section('Something else', ['anything'])), [])
})
