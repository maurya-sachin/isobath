import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CARD_HEIGHT, CARD_WIDTH, questionCard, type CardData } from './ogCard.ts'
import { renderQuestionCard } from './ogImage.ts'

const card: CardData = {
  title: 'Why does 0.1 + 0.2 not equal 0.3?',
  topicTitle: 'JavaScript',
  chapterTitle: 'Numbers and BigInt',
  difficulty: 'medium',
  map: { slug: 'javascript', chapterCount: 28, hardShare: 0.3 },
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('|')
  const children = (node as { props?: { children?: unknown } } | null)?.props?.children
  return children === undefined ? '' : textOf(children)
}

test('the card shows the title, where it sits and how hard it is', () => {
  const text = textOf(questionCard(card))
  for (const expected of [card.title, 'JavaScript · Numbers and BigInt', 'isobath', 'medium']) assert.ok(text.includes(expected), expected)
})

test('renders a PNG of the card size', async () => {
  const png = Buffer.from(await renderQuestionCard(card))
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47])
  assert.equal(png.readUInt32BE(16), CARD_WIDTH)
  assert.equal(png.readUInt32BE(20), CARD_HEIGHT)
})

test('a title that is too long for the large size gets a smaller one', () => {
  const fontSize = (title: string) => JSON.stringify(questionCard({ ...card, title })).match(/"fontFamily":"Newsreader","fontWeight":500,"fontSize":(\d+)/)?.[1]
  assert.equal(fontSize('Short'), '64')
  assert.equal(fontSize('x'.repeat(100)), '52')
})
