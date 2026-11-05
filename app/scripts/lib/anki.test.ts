import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Flashcard } from '../../src/content/types.ts'
import { ankiDeck } from './anki.ts'

const card = (overrides: Partial<Flashcard> = {}): Flashcard => ({
  id: 'javascript/engine-vs-host',
  topic: 'javascript',
  frontHtml: 'Which layer defines <code>setTimeout</code>?',
  backHtml: 'The host.',
  question: 'javascript/how-javascript-runs/ecmascript-engine-host',
  ...overrides,
})

const lines = (text: string) => text.trimEnd().split('\n')

test('starts with the import headers Anki documents', () => {
  assert.deepEqual(lines(ankiDeck('JavaScript', [card()])).slice(0, 5), ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:isobath::JavaScript', '#tags column:3'])
})

test('writes one tab-separated row per card: front, back with a source link, chapter tag', () => {
  const [row] = lines(ankiDeck('JavaScript', [card()])).slice(5)
  assert.deepEqual(row.split('\t'), [
    '"Which layer defines <code>setTimeout</code>?"',
    '"The host.<br><a href=""https://learn.sachinmaurya.com/javascript/how-javascript-runs/ecmascript-engine-host"">Read the full question</a>"',
    '"isobath::javascript::how-javascript-runs"',
  ])
})

test('escapes quotes so a field cannot end early', () => {
  const [row] = lines(ankiDeck('JavaScript', [card({ frontHtml: 'Say "hi"' })])).slice(5)
  assert.equal(row.split('\t')[0], '"Say ""hi"""')
})
