import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Topic } from './content.ts'
import { issueCandidates, withoutExisting } from './issueCandidates.ts'

const topics = [
  {
    slug: 'git',
    chapters: [
      {
        number: '01',
        slug: 'basics',
        readmeFile: '/repo/content/git/01-basics/README.md',
        subTopics: [
          { text: 'Rebase', refs: ['010'], line: 7 },
          { text: 'Reflog', refs: [], line: 8 },
        ],
        questions: [
          { file: '/repo/content/git/01-basics/010-a.md', meta: { status: 'draft', title: 'Done' } },
          { file: '/repo/content/git/01-basics/020-b.md', meta: { status: 'planned', title: 'What is a rebase?' } },
          { file: '/repo/content/git/01-basics/030-c.md', meta: null },
        ],
      },
    ],
  },
] as unknown as Topic[]

test('makes one candidate per planned stub and per gap, and none for written questions', () => {
  const titles = issueCandidates(topics).map((candidate) => candidate.title)
  assert.deepEqual(titles, ['Write: What is a rebase? (git/01-basics)', 'Cover: Reflog (git/01-basics)'])
})

test('names where the work is', () => {
  const [stub, gap] = issueCandidates(topics)
  assert.match(stub.body, /content\/git\/01-basics\/020-b\.md/)
  assert.match(gap.body, /README\.md` line 8/)
})

test('skips titles that already have an issue', () => {
  const candidates = issueCandidates(topics)
  assert.deepEqual(withoutExisting(candidates, [candidates[0].title]), [candidates[1]])
})
