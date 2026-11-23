// The favicon and the touch icon, drawn from the palette (R23): the contour ring in the accent colour.

import { RING_PATH } from '../geometry/ring.ts'
import { hex } from './palette.ts'

const ring = (colour: string) =>
  `<path d="${RING_PATH}" stroke="${colour}" stroke-width="5.2"/><circle cx="16.2" cy="16.4" r="3.4" fill="${colour}" stroke="none"/>`

/** Transparent, and light or dark with the browser's colour scheme. */
export function faviconSvg(): string {
  const light = hex('light', 'link')
  const dark = hex('dark', 'link')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${light}">
  <style>@media (prefers-color-scheme: dark) { path { stroke: ${dark} } circle { fill: ${dark} } }</style>
  ${ring(light)}
</svg>
`
}

/** Opaque, for iOS home screens: the ring on the light page background, with room around it. */
export function touchIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" fill="none">
  <rect width="180" height="180" fill="${hex('light', 'background')}"/>
  <g transform="translate(30 30) scale(3.75)">${ring(hex('light', 'link'))}</g>
</svg>
`
}
