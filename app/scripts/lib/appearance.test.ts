import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_APPEARANCE, parseAppearance, rootSettings, serializeAppearance } from '../../src/lib/appearance.ts'

test('missing or corrupt saved settings give the defaults', () => {
  assert.deepEqual(parseAppearance(null), DEFAULT_APPEARANCE)
  assert.deepEqual(parseAppearance('not json'), DEFAULT_APPEARANCE)
  assert.deepEqual(parseAppearance('[1,2]'), DEFAULT_APPEARANCE)
})

test('keeps valid settings and wraps hues into 0–359', () => {
  const saved = JSON.stringify({
    hueLight: 190,
    hueDark: 370.4,
    textSize: 120,
    contrast: 'high',
    motion: 'reduce',
    readingFont: 'sans',
    spacing: 'relaxed',
  })
  assert.deepEqual(parseAppearance(saved), {
    hueLight: 190,
    hueDark: 10,
    textSize: 120,
    contrast: 'high',
    motion: 'reduce',
    readingFont: 'sans',
    spacing: 'relaxed',
  })
  assert.equal(parseAppearance(JSON.stringify({ hueLight: -30 })).hueLight, 330)
})

test('drops invalid values one by one', () => {
  const parsed = parseAppearance(
    JSON.stringify({ hueLight: 'blue', textSize: 130, contrast: 'max', motion: 1, readingFont: 'mono', spacing: 2 }),
  )
  assert.deepEqual(parsed, DEFAULT_APPEARANCE)
})

test('saves nothing when every setting is the default', () => {
  assert.equal(serializeAppearance(DEFAULT_APPEARANCE), null)
  assert.ok(serializeAppearance({ ...DEFAULT_APPEARANCE, textSize: 145 }))
})

test('maps settings to what goes on <html>, removing defaults', () => {
  assert.deepEqual(rootSettings(DEFAULT_APPEARANCE), {
    properties: { '--hue-light': null, '--hue-dark': null },
    attributes: { 'data-contrast': null, 'data-motion': null, 'data-reading-font': null, 'data-spacing': null },
    fontSize: null,
  })
  const custom = rootSettings({
    hueLight: 190,
    hueDark: 150,
    textSize: 145,
    contrast: 'high',
    motion: 'reduce',
    readingFont: 'sans',
    spacing: 'relaxed',
  })
  assert.deepEqual(custom.properties, { '--hue-light': '190', '--hue-dark': '150' })
  assert.deepEqual(custom.attributes, {
    'data-contrast': 'high',
    'data-motion': 'reduce',
    'data-reading-font': 'sans',
    'data-spacing': 'relaxed',
  })
  assert.equal(custom.fontSize, '145%')
})
