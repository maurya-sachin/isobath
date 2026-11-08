import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Question } from './content.ts'
import { sourceUrls } from './sourceUrls.ts'

const question = (sources: string[] | null) => ({ meta: sources && { sources } }) as unknown as Question

test('lists each page once, without fragments, sorted', () => {
  const urls = sourceUrls([
    question(['https://b.dev/x#one', 'https://a.dev/y']),
    question(['https://b.dev/x#two', 'https://b.dev/x']),
  ])
  assert.deepEqual(urls, ['https://a.dev/y', 'https://b.dev/x'])
})

test('skips questions whose frontmatter failed validation', () => {
  assert.deepEqual(sourceUrls([question(null), question(['https://a.dev/'])]), ['https://a.dev/'])
})
