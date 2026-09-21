import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrastRatio } from '../../src/theme/oklch.ts'
import { CSS_TOKENS, hex, linearRgb, paletteCss, PALETTE, type Mode, type Token } from '../../src/theme/palette.ts'

const MODES: Mode[] = ['light', 'dark']
const HUES = Array.from({ length: 72 }, (_, index) => index * 5)

/** [foreground, background, minimum ratio]: WCAG 2.2 AA, 4.5:1 for text and 3:1 for graphics. */
const PAIRS: readonly (readonly [Token, Token, number])[] = [
  ['foreground', 'background', 4.5],
  ['foreground', 'card', 4.5],
  ['foreground', 'muted', 4.5],
  ['foreground', 'output', 4.5],
  ['mutedForeground', 'background', 4.5],
  ['mutedForeground', 'card', 4.5],
  ['mutedForeground', 'muted', 4.5],
  ['mutedForeground', 'code', 4.5],
  ['link', 'background', 4.5],
  ['link', 'card', 4.5],
  ['link', 'muted', 4.5],
  ['link', 'tldr', 4.5],
  ['linkHover', 'background', 4.5],
  ['tldrForeground', 'tldr', 4.5],
  ['syntaxKeyword', 'code', 4.5],
  ['syntaxFunction', 'code', 4.5],
  ['syntaxConstant', 'code', 4.5],
  ['syntaxString', 'code', 4.5],
  ['link', 'code', 4.5],
  ['depth1', 'background', 3],
  ['depth1', 'card', 3],
  ['depth1', 'muted', 3],
  ['depth4', 'background', 3],
  ['depth4', 'card', 3],
  ['depth4', 'muted', 3],
]

test('every text and graphic pair meets WCAG AA at every hue, in both modes', () => {
  for (const mode of MODES) {
    for (const hue of HUES) {
      for (const [foreground, background, minimum] of PAIRS) {
        const ratio = contrastRatio(linearRgb(mode, foreground, hue), linearRgb(mode, background, hue))
        assert.ok(ratio >= minimum, `${mode} ${foreground} on ${background} at hue ${hue}: ${ratio.toFixed(2)} < ${minimum}`)
      }
    }
  }
})

test('the depth ramp steps one way: lighter to deeper in light mode, deeper to lighter in dark mode', () => {
  const lightness = (mode: Mode) => (['depth1', 'depth2', 'depth3', 'depth4'] as const).map((token) => PALETTE[mode][token].l)
  assert.deepEqual(lightness('light'), [...lightness('light')].sort((a, b) => b - a))
  assert.deepEqual(lightness('dark'), [...lightness('dark')].sort((a, b) => b - a))
})

test('the generated stylesheet defines every token for both modes and defaults the hue per mode', () => {
  const css = paletteCss()
  for (const [property] of CSS_TOKENS) assert.equal(css.split(`  ${property}:`).length - 1, 2, property)
  assert.match(css, /:root \{\n {2}--hue: var\(--hue-light, 265\);/)
  assert.match(css, /\.dark \{\n {2}--hue: var\(--hue-dark, 265\);/)
})

test('converts a step to a hex colour', () => {
  assert.match(hex('light', 'background'), /^#[0-9a-f]{6}$/)
})
