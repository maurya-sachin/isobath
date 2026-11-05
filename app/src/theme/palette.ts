// The one source of colour (R23). Each token is an OKLCH lightness and chroma per mode; the hue comes from the
// reader's setting. `npm run theme:build` turns this into src/theme/palette.css; the social card imports it directly.

import { toHex, toLinearSrgb, type Rgb } from './oklch.ts'

export type Mode = 'light' | 'dark'

export interface Step {
  l: number
  c: number
  /** Degrees added to the reader's hue: syntax colours sit around the accent instead of repeating it. */
  h: number
}

const step = (l: number, c: number, h = 0): Step => ({ l, c, h })

/** Default accent hue: the blue-indigo of the brand. */
export const DEFAULT_HUE = 265

export const HUE_PRESETS = [
  { name: 'Indigo', hue: 265 },
  { name: 'Sky', hue: 235 },
  { name: 'Teal', hue: 190 },
  { name: 'Green', hue: 150 },
  { name: 'Violet', hue: 300 },
  { name: 'Rose', hue: 355 },
] as const

export const PALETTE = {
  light: {
    background: step(0.985, 0.004),
    card: step(0.997, 0.002),
    muted: step(0.955, 0.01),
    border: step(0.9, 0.014),
    foreground: step(0.24, 0.03),
    mutedForeground: step(0.48, 0.03),
    link: step(0.48, 0.19),
    linkHover: step(0.38, 0.17),
    tldr: step(0.955, 0.03),
    tldrForeground: step(0.32, 0.09),
    code: step(0.965, 0.008),
    output: step(0.93, 0.05),
    depth1: step(0.6, 0.14),
    depth2: step(0.51, 0.15),
    depth3: step(0.42, 0.14),
    depth4: step(0.33, 0.12),
    syntaxKeyword: step(0.5, 0.17),
    syntaxFunction: step(0.45, 0.13, 60),
    syntaxConstant: step(0.45, 0.1, -70),
    syntaxString: step(0.42, 0.09, 150),
  },
  dark: {
    background: step(0.17, 0.02),
    card: step(0.205, 0.022),
    muted: step(0.245, 0.025),
    border: step(0.31, 0.03),
    foreground: step(0.935, 0.01),
    mutedForeground: step(0.72, 0.03),
    link: step(0.76, 0.12),
    linkHover: step(0.86, 0.09),
    tldr: step(0.235, 0.045),
    tldrForeground: step(0.87, 0.05),
    code: step(0.145, 0.02),
    output: step(0.27, 0.06),
    depth1: step(0.82, 0.09),
    depth2: step(0.73, 0.12),
    depth3: step(0.64, 0.14),
    depth4: step(0.56, 0.15),
    syntaxKeyword: step(0.78, 0.11),
    syntaxFunction: step(0.8, 0.09, 60),
    syntaxConstant: step(0.8, 0.08, -70),
    syntaxString: step(0.8, 0.08, 150),
  },
} as const satisfies Record<Mode, Record<string, Step>>

export type Token = keyof (typeof PALETTE)['light']

/** The CSS custom properties the app reads, and the palette token each takes its value from. */
export const CSS_TOKENS: readonly (readonly [property: string, token: Token])[] = [
  ['--background', 'background'],
  ['--foreground', 'foreground'],
  ['--card', 'card'],
  ['--card-foreground', 'foreground'],
  ['--popover', 'card'],
  ['--popover-foreground', 'foreground'],
  ['--primary', 'foreground'],
  ['--primary-foreground', 'background'],
  ['--secondary', 'muted'],
  ['--secondary-foreground', 'foreground'],
  ['--muted', 'muted'],
  ['--muted-foreground', 'mutedForeground'],
  ['--accent', 'muted'],
  ['--accent-foreground', 'foreground'],
  ['--border', 'border'],
  ['--input', 'border'],
  ['--ring', 'link'],
  ['--link', 'link'],
  ['--link-hover', 'linkHover'],
  ['--tldr', 'tldr'],
  ['--tldr-foreground', 'tldrForeground'],
  ['--code', 'code'],
  ['--output', 'output'],
  ['--sidebar', 'card'],
  ['--sidebar-foreground', 'foreground'],
  ['--sidebar-primary', 'foreground'],
  ['--sidebar-primary-foreground', 'background'],
  ['--sidebar-accent', 'muted'],
  ['--sidebar-accent-foreground', 'foreground'],
  ['--sidebar-border', 'border'],
  ['--sidebar-ring', 'link'],
  ['--depth-from', 'depth1'],
  ['--depth-to', 'depth4'],
  ['--depth-1', 'depth1'],
  ['--depth-2', 'depth2'],
  ['--depth-3', 'depth3'],
  ['--depth-4', 'depth4'],
  // Shiki's css-variables theme (scripts/lib/markdown.ts) reads these.
  ['--shiki-foreground', 'foreground'],
  ['--shiki-background', 'code'],
  ['--shiki-token-comment', 'mutedForeground'],
  ['--shiki-token-punctuation', 'mutedForeground'],
  ['--shiki-token-parameter', 'foreground'],
  ['--shiki-token-keyword', 'syntaxKeyword'],
  ['--shiki-token-function', 'syntaxFunction'],
  ['--shiki-token-constant', 'syntaxConstant'],
  ['--shiki-token-string', 'syntaxString'],
  ['--shiki-token-string-expression', 'syntaxString'],
  ['--shiki-token-link', 'link'],
]

/** Errors keep their own red in both modes: they must not change with the reader's accent. */
export const DESTRUCTIVE: Record<Mode, string> = { light: 'oklch(0.55 0.22 27)', dark: 'oklch(0.7 0.19 22)' }

/** Meaning colours keep fixed hues: difficulty and warnings must not change with the reader's accent. */
export const STATUS_HUES = { easy: 150, medium: 80, hard: 25 } as const

export type StatusName = keyof typeof STATUS_HUES

/** A tinted badge surface and the text on it; the text also reads on the page, card and muted surfaces. */
export const STATUS = {
  light: { surface: step(0.94, 0.05), text: step(0.35, 0.1) },
  dark: { surface: step(0.27, 0.06), text: step(0.84, 0.1) },
} as const

export function statusRgb(mode: Mode, name: StatusName, part: keyof (typeof STATUS)['light']): Rgb {
  const { l, c } = STATUS[mode][part]
  return toLinearSrgb(l, c, STATUS_HUES[name])
}

export function linearRgb(mode: Mode, token: Token, hue: number = DEFAULT_HUE): Rgb {
  const { l, c, h } = PALETTE[mode][token]
  return toLinearSrgb(l, c, hue + h)
}

export function hex(mode: Mode, token: Token, hue: number = DEFAULT_HUE): string {
  return toHex(linearRgb(mode, token, hue))
}

const round = (value: number) => Number(value.toFixed(3))

function oklchCss({ l, c, h }: Step): string {
  return `oklch(${round(l)} ${round(c)} ${h === 0 ? 'var(--hue)' : `calc(var(--hue) + ${h})`})`
}

/** The generated stylesheet: every token as an `oklch()` colour around `var(--hue)`, the hue defaulting per mode. */
export function paletteCss(): string {
  const block = (selector: string, mode: Mode) => {
    const status = (Object.keys(STATUS_HUES) as StatusName[]).flatMap((name) => [
      `  --${name}: oklch(${round(STATUS[mode].surface.l)} ${round(STATUS[mode].surface.c)} ${STATUS_HUES[name]});`,
      `  --${name}-foreground: oklch(${round(STATUS[mode].text.l)} ${round(STATUS[mode].text.c)} ${STATUS_HUES[name]});`,
    ])
    const lines = [`  --hue: var(--hue-${mode}, ${DEFAULT_HUE});`, ...CSS_TOKENS.map(([property, token]) => `  ${property}: ${oklchCss(PALETTE[mode][token])};`), ...status, `  --destructive: ${DESTRUCTIVE[mode]};`]
    return `${selector} {\n${lines.join('\n')}\n}`
  }
  return `/* Generated by scripts/theme.ts from src/theme/palette.ts. Do not edit. */\n${block(':root', 'light')}\n\n${block('.dark', 'dark')}\n`
}
