// Renders a question card to PNG: satori turns the element tree into SVG, resvg rasterises it.

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { CARD_HEIGHT, CARD_WIDTH, questionCard, type CardData } from './ogCard.ts'

// Satori renders a variable font at its default instance only, so the cards use the static packages.
const require = createRequire(import.meta.url)
const fontFile = (pkg: string, file: string) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file)

const fonts = await Promise.all(
  [
    { name: 'Geist', weight: 600, file: fontFile('@fontsource/geist', 'geist-latin-600-normal.woff') },
    { name: 'Newsreader', weight: 500, file: fontFile('@fontsource/newsreader', 'newsreader-latin-500-normal.woff') },
  ].map(async ({ name, weight, file }) => ({
    name,
    weight: weight as 500 | 600,
    style: 'normal' as const,
    data: await readFile(file),
  })),
)

export async function renderQuestionCard(data: CardData): Promise<Uint8Array> {
  const svg = await satori(questionCard(data) as Parameters<typeof satori>[0], {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  })
  // Satori draws text as paths, so resvg needs no fonts; skipping the system font scan makes a render about 8x faster.
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng()
}
