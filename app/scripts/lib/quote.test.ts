import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fenced, MAX_QUOTE, toQuote } from '../../src/lib/quote.ts'
import { suggestFixUrl } from '../../src/lib/repo.ts'

test('trims the ends only and keeps inner newlines and indentation', () => {
  assert.deepEqual(toQuote('  a\n    b  \n'), { text: 'a\n    b', length: 7, truncated: false })
})

test('a selection of only whitespace is no quote', () => {
  assert.equal(toQuote(' \n\t '), null)
})

test('keeps 500 code points and cuts 501, marking the cut', () => {
  assert.equal(toQuote('a'.repeat(MAX_QUOTE))?.truncated, false)
  assert.deepEqual(toQuote('a'.repeat(MAX_QUOTE + 1)), {
    text: `${'a'.repeat(MAX_QUOTE)} […]`,
    length: MAX_QUOTE + 1,
    truncated: true,
  })
})

test('counts and cuts by code point, so an emoji is never split', () => {
  const quote = toQuote('😀'.repeat(MAX_QUOTE + 1))
  assert.equal(quote?.length, MAX_QUOTE + 1)
  assert.equal(quote?.text, `${'😀'.repeat(MAX_QUOTE)} […]`)
})

test('the fence is longer than any backtick run in the text', () => {
  assert.equal(fenced('a'), '```text\na\n```')
  assert.equal(fenced('use ```js here'), '````text\nuse ```js here\n````')
})

test('without a quote the issue URL is the plain correction form', () => {
  assert.equal(
    suggestFixUrl('react/x/y', 'Why keys?', 'https://site/react/x/y'),
    'https://github.com/maurya-sachin/isobath/issues/new?template=correction.yml&title=Fix%3A+Why+keys%3F&question=react%2Fx%2Fy&page=https%3A%2F%2Fsite%2Freact%2Fx%2Fy',
  )
})

test('with a quote the URL carries the section, the fenced quote and a link to the section', () => {
  const url = new URL(
    suggestFixUrl('react/x/y', 'T', 'https://site/react/x/y', {
      text: '<Fragment>',
      section: 'Answer',
      sectionId: 'answer',
    }),
  )
  assert.equal(url.searchParams.get('page'), 'https://site/react/x/y#answer')
  assert.equal(url.searchParams.get('section'), 'Answer')
  assert.equal(url.searchParams.get('quote'), '```text\n<Fragment>\n```')
})

test('the longest quote with a long title stays under 8000 characters', () => {
  const text = toQuote('😀'.repeat(MAX_QUOTE * 2))?.text ?? ''
  const url = suggestFixUrl('t'.repeat(80), 'T'.repeat(200), `https://learn.sachinmaurya.com/${'p'.repeat(120)}`, {
    text,
    section: 'Deep dive',
    sectionId: 'deep-dive',
  })
  assert.ok(url.length < 8000, `${url.length}`)
})
