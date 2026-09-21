import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fontFacesCss } from '../../src/theme/fonts.ts'

test('defines a size-adjusted fallback face for each web font, under the names index.css uses', () => {
  const css = fontFacesCss()
  for (const family of ['Geist Fallback', 'Geist Mono Fallback', 'Newsreader Fallback']) {
    assert.match(css, new RegExp(`font-family: "${family}";`), family)
  }
  assert.equal(css.split('size-adjust:').length - 1, 3)
})
