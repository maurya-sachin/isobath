// The reader's appearance settings (accent hue per mode, text size, contrast, motion). Pure: parsing, validation and
// what to put on <html>. The browser store is appearanceStore.ts; the inline script in index.html applies the saved
// settings before first paint, so keep it in sync with `rootSettings`.

export const APPEARANCE_KEY = 'appearance'

export const TEXT_SIZES = [
  { percent: 100, label: 'Default' },
  { percent: 120, label: 'Large' },
  { percent: 145, label: 'Larger' },
] as const

export type TextSize = (typeof TEXT_SIZES)[number]['percent']

export interface Appearance {
  /** Accent hue in degrees; `null` keeps the palette default. */
  hueLight: number | null
  hueDark: number | null
  textSize: TextSize
  /** `auto` follows the system's contrast preference; `high` always uses the higher-contrast palette. */
  contrast: 'auto' | 'high'
  /** `auto` follows the system's motion preference; `reduce` always minimises motion. */
  motion: 'auto' | 'reduce'
  /** The face for long-form reading (question text, TL;DR, summaries); headings keep the brand serif. */
  readingFont: 'serif' | 'sans'
  spacing: 'comfortable' | 'relaxed'
}

export const DEFAULT_APPEARANCE: Appearance = {
  hueLight: null,
  hueDark: null,
  textSize: 100,
  contrast: 'auto',
  motion: 'auto',
  readingFont: 'serif',
  spacing: 'comfortable',
}

const normalizeHue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? ((Math.round(value) % 360) + 360) % 360 : null

/** Reads saved settings; anything missing or invalid falls back to the default, so a bad value never breaks the page. */
export function parseAppearance(raw: string | null): Appearance {
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (typeof parsed === 'object' && parsed !== null) saved = parsed as Record<string, unknown>
  } catch {
    // Corrupt JSON: use the defaults.
  }
  return {
    hueLight: normalizeHue(saved.hueLight),
    hueDark: normalizeHue(saved.hueDark),
    textSize: TEXT_SIZES.find((size) => size.percent === saved.textSize)?.percent ?? DEFAULT_APPEARANCE.textSize,
    contrast: saved.contrast === 'high' ? 'high' : 'auto',
    motion: saved.motion === 'reduce' ? 'reduce' : 'auto',
    readingFont: saved.readingFont === 'sans' ? 'sans' : 'serif',
    spacing: saved.spacing === 'relaxed' ? 'relaxed' : 'comfortable',
  }
}

/** The JSON to save, or `null` when everything is default (the saved entry is then removed). */
export function serializeAppearance(appearance: Appearance): string | null {
  return JSON.stringify(appearance) === JSON.stringify(DEFAULT_APPEARANCE) ? null : JSON.stringify(appearance)
}

/** What goes on <html>: custom properties, data attributes and font size; `null` removes one. */
export function rootSettings(appearance: Appearance) {
  return {
    properties: {
      '--hue-light': appearance.hueLight === null ? null : String(appearance.hueLight),
      '--hue-dark': appearance.hueDark === null ? null : String(appearance.hueDark),
    },
    attributes: {
      'data-contrast': appearance.contrast === 'high' ? 'high' : null,
      'data-motion': appearance.motion === 'reduce' ? 'reduce' : null,
      'data-reading-font': appearance.readingFont === 'sans' ? 'sans' : null,
      'data-spacing': appearance.spacing === 'relaxed' ? 'relaxed' : null,
    },
    fontSize: appearance.textSize === 100 ? null : `${appearance.textSize}%`,
  }
}
