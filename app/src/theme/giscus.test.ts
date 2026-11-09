import assert from 'node:assert/strict'
import { test } from 'node:test'
import { giscusThemeCss } from './giscus.ts'
import { contrastRatio } from './oklch.ts'
import { hex, linearRgb, type Mode, type Token } from './palette.ts'

const MODES: Mode[] = ['light', 'dark']

test("the theme starts from giscus's own theme for the mode, then sets palette colours", () => {
  for (const mode of MODES) {
    const css = giscusThemeCss(mode)
    assert.ok(css.startsWith(`@import url("https://giscus.app/themes/${mode}.css");`))
    assert.match(css, new RegExp(`--color-canvas-default: ${hex(mode, 'card')};`))
    assert.match(css, new RegExp(`--color-fg-default: ${hex(mode, 'foreground')};`))
  }
})

/** Pairs only the comments use; the shared ones are checked in palette.test.ts. Default hue: giscus gets no other. */
const GISCUS_PAIRS: readonly (readonly [Token, Token])[] = [
  ['background', 'link'],
  ['background', 'linkHover'],
  ['foreground', 'border'],
]

test('button text in the comments meets 4.5:1 in both modes', () => {
  for (const mode of MODES) {
    for (const [foreground, background] of GISCUS_PAIRS) {
      const ratio = contrastRatio(linearRgb(mode, foreground), linearRgb(mode, background))
      assert.ok(ratio >= 4.5, `${mode} ${foreground} on ${background}: ${ratio.toFixed(2)} < 4.5`)
    }
  }
})
