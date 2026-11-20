import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  consentDecline,
  exerciseReveal,
  flashcardRate,
  flashcardSessionFinish,
  practiceAnswer,
  practiceSessionFinish,
  searchComplete,
  superProperties,
} from '../../src/lib/analyticsEvents.ts'

test('search_complete trims the query and cuts it to 80 characters', () => {
  const event = searchComplete({ query: `  ${'a'.repeat(100)}  `, results: 3, selectedId: null, rankIndex: null })
  assert.deepEqual(event?.properties, { query: 'a'.repeat(80), results: 3, selected_id: null, rank: null })
})

test('search_complete is null for an empty or whitespace query', () => {
  assert.equal(searchComplete({ query: '', results: 0, selectedId: null, rankIndex: null }), null)
  assert.equal(searchComplete({ query: '   ', results: 0, selectedId: null, rankIndex: null }), null)
})

test('search_complete reports a selection with its 1-based rank, and a dismissal with nulls', () => {
  const picked = searchComplete({ query: 'closure', results: 4, selectedId: 'js-closures', rankIndex: 2 })
  assert.deepEqual(picked, {
    name: 'search_complete',
    properties: { query: 'closure', results: 4, selected_id: 'js-closures', rank: 3 },
  })
  const dismissed = searchComplete({ query: 'zzz', results: 0, selectedId: null, rankIndex: null })
  assert.deepEqual(dismissed?.properties, { query: 'zzz', results: 0, selected_id: null, rank: null })
})

test('flashcard events carry the topic, rating and whether the card was new', () => {
  assert.deepEqual(flashcardRate('react', 'hard', true), {
    name: 'flashcard_rate',
    properties: { topic: 'react', rating: 'hard', is_new_card: true },
  })
  assert.deepEqual(flashcardSessionFinish('react', 12, 2), {
    name: 'flashcard_session_finish',
    properties: { topic: 'react', rated: 12, round: 2 },
  })
})

test('practice events carry the result and the session tally', () => {
  assert.deepEqual(practiceAnswer('js-closures', true), {
    name: 'practice_answer',
    properties: { question_id: 'js-closures', result: 'knew' },
  })
  assert.deepEqual(practiceAnswer('js-closures', false).properties, { question_id: 'js-closures', result: 'missed' })
  assert.deepEqual(practiceSessionFinish('javascript', '03-functions', 7, 3), {
    name: 'practice_session_finish',
    properties: { topic: 'javascript', chapter: '03-functions', knew: 7, missed: 3 },
  })
})

test('exercise_reveal and consent_decline', () => {
  assert.deepEqual(exerciseReveal('js-closures', 'Counter'), {
    name: 'exercise_reveal',
    properties: { question_id: 'js-closures', exercise: 'Counter' },
  })
  assert.deepEqual(consentDecline(), { name: 'consent_decline', properties: {} })
})

test('super properties map the appearance settings exactly', () => {
  assert.deepEqual(superProperties({ readingFont: 'sans', textSize: 145 }, 'dark'), {
    theme: 'dark',
    reading_font: 'sans',
    text_size: 145,
  })
})
