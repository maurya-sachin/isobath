import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrastRatio, type Rgb } from './oklch.ts'
import {
  CSS_TOKENS,
  hex,
  linearRgb,
  paletteCss,
  PALETTE,
  STATUS_HUES,
  statusRgb,
  type Mode,
  type StatusName,
  type Token,
} from './palette.ts'

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
  ['inputBorder', 'background', 3],
  ['inputBorder', 'card', 3],
  ['inputBorder', 'muted', 3],
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
        assert.ok(
          ratio >= minimum,
          `${mode} ${foreground} on ${background} at hue ${hue}: ${ratio.toFixed(2)} < ${minimum}`,
        )
      }
    }
  }
})

test('the higher-contrast steps give text 7:1 and borders and graphics 3:1 at every hue, in both modes', () => {
  const pairs: readonly (readonly [Token, Token, number])[] = [
    ['foreground', 'background', 7],
    ['foreground', 'muted', 7],
    ['mutedForeground', 'background', 7],
    ['mutedForeground', 'card', 7],
    ['mutedForeground', 'muted', 7],
    ['mutedForeground', 'code', 7],
    ['link', 'background', 7],
    ['link', 'card', 7],
    ['tldrForeground', 'tldr', 7],
    ['border', 'background', 3],
    ['border', 'card', 3],
  ]
  for (const mode of MODES) {
    for (const hue of HUES) {
      for (const [foreground, background, minimum] of pairs) {
        const ratio = contrastRatio(linearRgb(mode, foreground, hue, 'high'), linearRgb(mode, background, hue, 'high'))
        assert.ok(
          ratio >= minimum,
          `high ${mode} ${foreground} on ${background} at hue ${hue}: ${ratio.toFixed(2)} < ${minimum}`,
        )
      }
    }
  }
})

/** Machado et al. (2009), severity 1: how protanopia, deuteranopia and tritanopia change linear-light sRGB. */
const COLOUR_BLIND: Record<string, readonly (readonly number[])[]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

test('neighbouring depth steps stay distinguishable by lightness under colour-blind vision, at every hue', () => {
  const simulate = (rgb: readonly number[], matrix: readonly (readonly number[])[]) =>
    matrix.map((row) => row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]) as unknown as Rgb
  const steps = ['depth1', 'depth2', 'depth3', 'depth4'] as const
  for (const mode of MODES) {
    for (const hue of HUES) {
      for (const [kind, matrix] of Object.entries(COLOUR_BLIND)) {
        for (let index = 1; index < steps.length; index++) {
          const previous = simulate(linearRgb(mode, steps[index - 1], hue), matrix)
          const next = simulate(linearRgb(mode, steps[index], hue), matrix)
          const ratio = contrastRatio(previous, next)
          assert.ok(
            ratio >= 1.25,
            `${mode} ${kind} at hue ${hue}: ${steps[index - 1]} vs ${steps[index]} is ${ratio.toFixed(2)}:1`,
          )
        }
      }
    }
  }
})

test('status text reads on its badge and on the page, card and muted surfaces at every hue, in both modes', () => {
  for (const mode of MODES) {
    for (const name of Object.keys(STATUS_HUES) as StatusName[]) {
      const text = statusRgb(mode, name, 'text')
      assert.ok(contrastRatio(text, statusRgb(mode, name, 'surface')) >= 4.5, `${mode} ${name} on its badge`)
      for (const hue of HUES) {
        for (const surface of ['background', 'card', 'muted'] as const) {
          const ratio = contrastRatio(text, linearRgb(mode, surface, hue))
          assert.ok(ratio >= 4.5, `${mode} ${name} text on ${surface} at hue ${hue}: ${ratio.toFixed(2)}`)
        }
      }
    }
  }
})

test('the depth ramp steps one way: lighter to deeper in light mode, deeper to lighter in dark mode', () => {
  const lightness = (mode: Mode) =>
    (['depth1', 'depth2', 'depth3', 'depth4'] as const).map((token) => PALETTE[mode][token].l)
  assert.deepEqual(
    lightness('light'),
    [...lightness('light')].sort((a, b) => b - a),
  )
  assert.deepEqual(
    lightness('dark'),
    [...lightness('dark')].sort((a, b) => b - a),
  )
})

test('the generated stylesheet defines every token for both modes and defaults the hue per mode', () => {
  const css = paletteCss()
  const base = css.slice(0, css.indexOf(':root[data-contrast'))
  for (const [property] of CSS_TOKENS) assert.equal(base.split(`  ${property}:`).length - 1, 2, property)
  assert.match(css, /:root \{\n {2}--hue: var\(--hue-light, 265\);/)
  assert.match(css, /\.dark \{\n {2}--hue: var\(--hue-dark, 265\);/)
  assert.match(css, /@media \(prefers-contrast: more\)/)
})

test('converts a step to a hex colour', () => {
  assert.match(hex('light', 'background'), /^#[0-9a-f]{6}$/)
})
