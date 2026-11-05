import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkReferences } from './check.ts'
import type { Chapter, Content, Question } from './content.ts'
import type { Frontmatter } from './frontmatter.ts'

const question = (
  number: string,
  slug: string,
  related: string[] = [],
  status: Frontmatter['status'] = 'draft',
): Question => ({
  id: `topic/chapter/${slug}`,
  number,
  slug,
  file: `content/topic/01-chapter/${number}-${slug}.md`,
  meta: { status, related } as Frontmatter,
  body: '',
  bodyLine: 1,
})

const content = (questions: Question[], subTopics: Chapter['subTopics']): Content => ({
  topics: [
    {
      slug: 'topic',
      title: 'Topic',
      dir: '',
      readmeFile: '',
      readme: '',
      chapters: [
        {
          number: '01',
          slug: 'chapter',
          title: 'Chapter',
          dir: '',
          readmeFile: 'content/topic/01-chapter/README.md',
          readme: '',
          subTopics,
          questions,
        },
      ],
    },
  ],
  decks: [],
  paths: [],
  problems: [],
})

const messages = (problems: { message: string }[]) => problems.map((problem) => problem.message)

test('a consistent chapter has no problems', () => {
  const questions = [question('010', 'a'), question('020', 'b')]
  assert.deepEqual(checkReferences(content(questions, [{ text: 'all', refs: ['010', '020'], line: 5 }])), [])
})

test('a repeated number or slug is reported on the later question', () => {
  const questions = [question('010', 'a'), question('010', 'a')]
  const found = messages(checkReferences(content(questions, [{ text: 'all', refs: ['010'], line: 5 }])))
  assert.deepEqual(found, [
    'number 010 is used twice in this chapter',
    "slug `a` is used twice, so the id isn't unique",
  ])
})

test('a sub-topic that points at a missing question, and an unlisted question, are reported', () => {
  const questions = [question('010', 'a'), question('020', 'b')]
  const found = messages(checkReferences(content(questions, [{ text: 'one', refs: ['010', '030'], line: 5 }])))
  assert.deepEqual(found, [
    'sub-topic points to missing question 030',
    'question 020 is not listed under any sub-topic',
  ])
})

test('related ids must name existing questions, and planned stubs are not checked', () => {
  const written = question('010', 'a', ['topic/chapter/b', 'topic/chapter/nope'])
  const planned = question('020', 'b', ['topic/chapter/also-nope'], 'planned')
  const found = messages(checkReferences(content([written, planned], [{ text: 'all', refs: ['010', '020'], line: 5 }])))
  assert.deepEqual(found, ['related: unknown id `topic/chapter/nope`'])
})
