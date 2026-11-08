// The comments iframe's theme, drawn from the palette (R23). giscus loads it as a stylesheet inside its iframe; it
// starts from giscus's own theme for the mode and overrides only surfaces, text, borders and the accent.

import { hex, type Mode, type Token } from './palette.ts'

/** giscus's CSS custom properties, and the palette token each takes its value from. */
const GISCUS_TOKENS: readonly (readonly [property: string, token: Token])[] = [
  ['--color-canvas-default', 'card'],
  ['--color-canvas-overlay', 'card'],
  ['--color-canvas-subtle', 'muted'],
  ['--color-canvas-inset', 'code'],
  ['--color-fg-default', 'foreground'],
  ['--color-fg-muted', 'mutedForeground'],
  ['--color-fg-subtle', 'mutedForeground'],
  ['--color-border-default', 'border'],
  ['--color-border-muted', 'border'],
  ['--color-accent-fg', 'link'],
  ['--color-accent-emphasis', 'link'],
  ['--color-btn-text', 'foreground'],
  ['--color-btn-bg', 'muted'],
  ['--color-btn-border', 'inputBorder'],
  ['--color-btn-hover-bg', 'border'],
  ['--color-btn-selected-bg', 'muted'],
  ['--color-btn-primary-text', 'background'],
  ['--color-btn-primary-bg', 'link'],
  ['--color-btn-primary-border', 'link'],
  ['--color-btn-primary-hover-bg', 'linkHover'],
  ['--color-btn-primary-selected-bg', 'link'],
  ['--color-segmented-control-button-bg', 'card'],
]

export function giscusThemeCss(mode: Mode): string {
  const properties = GISCUS_TOKENS.map(([property, token]) => `  ${property}: ${hex(mode, token)};`)
  return `@import url("https://giscus.app/themes/${mode}.css");\n\nmain {\n${properties.join('\n')}\n}\n`
}
