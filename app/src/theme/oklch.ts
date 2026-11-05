// OKLCH → sRGB, for contrast checks and for places that cannot use CSS colours (the social card).
// Out-of-gamut colours lose chroma at the same lightness and hue, as browsers do when they draw `oklch()`.

export type Rgb = readonly [red: number, green: number, blue: number]

/** Linear-light sRGB, not clamped: values outside 0–1 are out of gamut. */
function linearSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const EPSILON = 1e-6
const inGamut = (rgb: Rgb) => rgb.every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON)

/** Linear-light sRGB for an OKLCH colour, with chroma reduced until it fits the gamut. */
export function toLinearSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const exact = linearSrgb(lightness, chroma, hue)
  if (inGamut(exact)) return exact
  let low = 0
  let high = chroma
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (inGamut(linearSrgb(lightness, middle, hue))) low = middle
    else high = middle
  }
  return linearSrgb(lightness, low, hue)
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function relativeLuminance([red, green, blue]: Rgb): number {
  return 0.2126 * clamp(red) + 0.7152 * clamp(green) + 0.0722 * clamp(blue)
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

const encode = (channel: number) => {
  const value = clamp(channel)
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(encode(channel) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
