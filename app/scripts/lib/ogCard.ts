// The element tree of a question's social card (1200×630), for satori. Plain `{ type, props }` objects:
// scripts run on Node's native TypeScript, which has no JSX. Colours are the light theme tokens in src/index.css.

import { coverRings, ringPath } from '../../src/lib/contours.ts'
import { depthStop } from '../../src/lib/depth.ts'
import { AUTHOR, SITE_NAME } from '../../src/lib/site.ts'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

const BACKGROUND = '#F9FAFC'
const FOREGROUND = '#0E1424'
const MUTED = '#4A5368'
const ACCENT = '#2F4FD8'
/** `--depth-1..4`, shallow to deep: the oklab mixes of `--depth-from` and `--depth-to`, precomputed because satori has no `color-mix`. */
const DEPTH_STOPS = ['#6e86df', '#5166b7', '#344790', '#1b2a6b']

const PADDING = 72
const MAP_SIZE = CARD_HEIGHT
/** The map runs off the right edge so the text column never meets its rings. */
const MAP_OFFSET = -150
const TEXT_WIDTH = 680
const LONG_TITLE_LENGTH = 70

export interface CardData {
  title: string
  topicTitle: string
  chapterTitle: string
  difficulty: 'easy' | 'medium' | 'hard'
  /** Seeds the contour map: the topic's slug and shape, as on its cover. */
  map: { slug: string; chapterCount: number; hardShare: number }
}

interface Element {
  type: string
  props: Record<string, unknown>
}

const element = (type: string, style: Record<string, unknown>, children?: unknown, props: Record<string, unknown> = {}): Element => ({
  type,
  props: { ...props, style, children },
})

/** The topic cover's contours as an SVG data URI, coloured down the depth ramp. */
function contourMap({ slug, chapterCount, hardShare }: CardData['map']): string {
  const { rings, levels } = coverRings(slug, chapterCount, hardShare)
  const paths = rings
    .map((ring) => {
      const stop = DEPTH_STOPS[depthStop(ring.level, levels)]
      const fill = ring.level === levels - 1 ? ` fill="${stop}" fill-opacity="0.2"` : ''
      return `<path d="${ringPath(ring.points)}" stroke="${stop}"${fill}/>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke-width="0.8" stroke-linejoin="round">${paths}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function questionCard(data: CardData): Element {
  const titleSize = data.title.length > LONG_TITLE_LENGTH ? 52 : 64
  return element(
    'div',
    { display: 'flex', width: CARD_WIDTH, height: CARD_HEIGHT, background: BACKGROUND, position: 'relative' },
    [
      element('img', { position: 'absolute', right: MAP_OFFSET, top: 0, width: MAP_SIZE, height: MAP_SIZE }, undefined, { src: contourMap(data.map), width: MAP_SIZE, height: MAP_SIZE }),
      element('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, padding: PADDING }, [
        element('div', { display: 'flex', flexDirection: 'column', width: TEXT_WIDTH }, [
          element('div', { fontFamily: 'Geist', fontWeight: 600, fontSize: 28, color: ACCENT }, `${data.topicTitle} · ${data.chapterTitle}`),
          element('div', { fontFamily: 'Newsreader', fontWeight: 500, fontSize: titleSize, lineHeight: 1.15, color: FOREGROUND, marginTop: 28 }, data.title),
        ]),
        element('div', { display: 'flex', alignItems: 'baseline', fontFamily: 'Geist', fontWeight: 600, fontSize: 30, color: FOREGROUND }, [
          element('div', {}, SITE_NAME),
          element('div', { color: MUTED, marginLeft: 20 }, `by ${AUTHOR}`),
          element('div', { color: MUTED, marginLeft: 20 }, `· ${data.difficulty}`),
        ]),
      ]),
    ],
  )
}
