import assert from 'node:assert/strict'
import { test } from 'node:test'
import { breadcrumbList, duplicates, jsonLdScript, metaDescription, techArticle } from './seo.ts'

test('keeps a short description as it is, with whitespace collapsed', () => {
  assert.equal(metaDescription('  One\n  two   three. '), 'One two three.')
})

test('cuts a long description at a word boundary and ends with an ellipsis', () => {
  const text = 'word '.repeat(60)
  const cut = metaDescription(text)
  assert.ok(cut.length <= 155)
  assert.ok(cut.endsWith('word…'))
})

test('does not leave dangling punctuation before the ellipsis', () => {
  assert.equal(metaDescription('alpha beta, gamma delta', 14), 'alpha beta…')
})

test('escapes < in JSON-LD so page text cannot close the script tag', () => {
  const script = jsonLdScript({ '@type': 'Thing', name: '</script><b>' })
  assert.ok(!script.slice(0, -'</script>'.length).includes('</script>'))
  assert.match(script, /\\u003c\/script>/)
})

test('numbers breadcrumb items from 1 and gives absolute URLs', () => {
  const list = breadcrumbList([
    { name: 'isobath', path: '/' },
    { name: 'JavaScript', path: '/javascript' },
  ]) as { itemListElement: { position: number; item: string }[] }
  assert.deepEqual(
    list.itemListElement.map((item) => item.position),
    [1, 2],
  )
  assert.equal(list.itemListElement[1].item, 'https://learn.sachinmaurya.com/javascript')
})

test('a TechArticle takes its headline without backticks and points at its social card', () => {
  const article = techArticle({ title: 'Why `typeof null`?', description: 'x', path: '/javascript/a/b' }) as {
    headline: string
    image: string
  }
  assert.equal(article.headline, 'Why typeof null?')
  assert.equal(article.image, 'https://learn.sachinmaurya.com/og/javascript/a/b.png')
})

test('finds values shared by several pages', () => {
  const found = duplicates([
    { path: '/a', value: 'same' },
    { path: '/b', value: 'same' },
    { path: '/c', value: 'other' },
  ])
  assert.deepEqual(found, [{ value: 'same', paths: ['/a', '/b'] }])
})
