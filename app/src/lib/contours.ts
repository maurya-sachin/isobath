// Contour-map rings generated from a seed: the cover art for a topic, original by construction.
// A smooth height field (a seabed, read as depth) is sampled on a grid; marching squares finds the lines where
// it crosses evenly spaced heights, and the segments are chained into closed rings.

export type Point = readonly [x: number, y: number]

/** One closed contour line. `level` 0 is the outermost (shallowest) ring. No repeated end point. */
export interface Ring {
  level: number
  points: Point[]
}

export interface ContourOptions {
  seed: string
  /** Number of nested levels, at least 1. */
  levels: number
  /** 0 to 1: steeper terrain packs the rings closer together. Default 0. */
  steepness?: number
  /** Side of the square the rings are drawn in. Default 100. */
  size?: number
}

/** Grid cells per side; the field has GRID + 1 samples per side. */
const GRID = 64

type Edge = 'top' | 'right' | 'bottom' | 'left'

/** For each 4-bit corner pattern (top-left 8, top-right 4, bottom-right 2, bottom-left 1), the edges each segment joins. */
const SEGMENTS: Record<number, [Edge, Edge][]> = {
  1: [['left', 'bottom']],
  2: [['bottom', 'right']],
  3: [['left', 'right']],
  4: [['top', 'right']],
  6: [['top', 'bottom']],
  7: [['top', 'left']],
  8: [['top', 'left']],
  9: [['top', 'bottom']],
  11: [['top', 'right']],
  12: [['left', 'right']],
  13: [['bottom', 'right']],
  14: [['left', 'bottom']],
}

/** Saddle cells (opposite corners inside) join differently depending on whether their centre is inside. */
const SADDLE: Record<number, { centreInside: [Edge, Edge][]; centreOutside: [Edge, Edge][] }> = {
  5: {
    centreInside: [
      ['top', 'left'],
      ['bottom', 'right'],
    ],
    centreOutside: [
      ['top', 'right'],
      ['left', 'bottom'],
    ],
  },
  10: {
    centreInside: [
      ['top', 'right'],
      ['left', 'bottom'],
    ],
    centreOutside: [
      ['top', 'left'],
      ['bottom', 'right'],
    ],
  },
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32: a small seeded generator returning numbers in [0, 1). */
function seededRandom(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

type Field = (u: number, v: number) => number

const gaussian =
  (x: number, y: number, spread: number, height: number): Field =>
  (u, v) =>
    height * Math.exp(-((u - x) ** 2 + (v - y) ** 2) / (2 * spread ** 2))

/** Low waves that make the lines wander like a surveyed coast rather than a lathe. */
function ripple(random: () => number, amplitude: number): Field {
  const waves = Array.from({ length: 5 }, () => ({
    fx: 1 + random() * 3,
    fy: 1 + random() * 3,
    phase: random() * Math.PI * 2,
    amplitude: amplitude * (0.5 + random() * 0.5),
  }))
  return (u, v) =>
    waves.reduce(
      (sum, wave) => sum + wave.amplitude * Math.sin(2 * Math.PI * (wave.fx * u + wave.fy * v) + wave.phase),
      0,
    )
}

/**
 * A seabed: an off-centre trench with a steep wall on one side and a wide shelf on the other, a second
 * pool almost as deep past a saddle, and a low, broad base. Multiplying by `rim`, which is zero on the
 * border, keeps the border the shallowest part of the field. Steepness narrows the trench and the pool.
 */
function heightField(random: () => number, steepness: number): number[][] {
  const narrow = 1 - 0.35 * steepness
  const x = 0.56 + random() * 0.1
  const y = 0.44 + random() * 0.12
  const angle = random() * Math.PI * 2
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]

  const trench: Field = (u, v) => {
    const along = (u - x) * cos + (v - y) * sin
    const across = (v - y) * cos - (u - x) * sin
    const acrossSpread = across < 0 ? 0.065 : 0.17 // steep wall : shelf
    return Math.exp(-(along ** 2) / (2 * (0.16 * narrow) ** 2) - across ** 2 / (2 * (acrossSpread * narrow) ** 2))
  }
  const pool = gaussian(x - cos * 0.3 + sin * 0.06, y - sin * 0.3 - cos * 0.06, 0.075 * narrow, 0.82)
  const base = gaussian(0.5, 0.5, 0.34, 0.22)
  const wave = ripple(random, 0.025)
  const rim: Field = (u, v) => Math.sin(Math.PI * u) * Math.sin(Math.PI * v)

  return Array.from({ length: GRID + 1 }, (_, row) =>
    Array.from({ length: GRID + 1 }, (_, column) => {
      const u = column / GRID
      const v = row / GRID
      return rim(u, v) * (base(u, v) + trench(u, v) + pool(u, v) + wave(u, v))
    }),
  )
}

/** The border samples are the lowest part of the field; heights above them give rings that never touch the frame. */
function borderMaximum(field: number[][]): number {
  const last = GRID
  const border = field.flatMap((row, index) => (index === 0 || index === last ? row : [row[0], row[last]]))
  return Math.max(...border)
}

type Segment = [Edge, Edge]

/** The segments that cross one grid cell at `height`, from its four corners (the saddle cases also read the centre). */
function cellSegments(field: number[][], row: number, column: number, height: number): Segment[] {
  const topLeft = field[row][column]
  const topRight = field[row][column + 1]
  const bottomRight = field[row + 1][column + 1]
  const bottomLeft = field[row + 1][column]
  const pattern =
    Number(topLeft > height) * 8 +
    Number(topRight > height) * 4 +
    Number(bottomRight > height) * 2 +
    Number(bottomLeft > height)
  const saddle = SADDLE[pattern]
  if (!saddle) return SEGMENTS[pattern] ?? []
  const centreInside = (topLeft + topRight + bottomRight + bottomLeft) / 4 > height
  return centreInside ? saddle.centreInside : saddle.centreOutside
}

/** Where the contour crosses a grid edge, by linear interpolation between the two samples the edge joins. */
function crossing(field: number[][], height: number, row: number, column: number, horizontal: boolean): Point {
  const start = field[row][column]
  const end = horizontal ? field[row][column + 1] : field[row + 1][column]
  const along = (height - start) / (end - start)
  return horizontal ? [column + along, row] : [column, row + along]
}

/** Follows the linked crossing points from `start` back to itself. */
function walkRing(start: string, points: Map<string, Point>, neighbours: Map<string, string[]>, visited: Set<string>) {
  const ringPoints: Point[] = []
  let previous: string | undefined
  let current = start
  do {
    visited.add(current)
    ringPoints.push(points.get(current)!)
    const [first, second] = neighbours.get(current)!
    const next = first !== previous ? first : second
    previous = current
    current = next
  } while (current !== start)
  return ringPoints
}

function ringsAtHeight(field: number[][], height: number, level: number, size: number): Ring[] {
  const points = new Map<string, Point>()
  const neighbours = new Map<string, string[]>()

  /** A grid edge is named by the sample it starts at and its direction, so the two cells sharing it agree on its key. */
  function edgePoint(row: number, column: number, edge: Edge): string {
    const horizontal = edge === 'top' || edge === 'bottom'
    const edgeRow = edge === 'bottom' ? row + 1 : row
    const edgeColumn = edge === 'right' ? column + 1 : column
    const key = `${horizontal ? 'h' : 'v'}${edgeRow},${edgeColumn}`
    if (!points.has(key)) {
      const [x, y] = crossing(field, height, edgeRow, edgeColumn, horizontal)
      points.set(key, [(x / GRID) * size, (y / GRID) * size])
    }
    return key
  }

  function link(first: string, second: string) {
    neighbours.set(first, [...(neighbours.get(first) ?? []), second])
    neighbours.set(second, [...(neighbours.get(second) ?? []), first])
  }

  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      for (const [from, to] of cellSegments(field, row, column, height)) {
        link(edgePoint(row, column, from), edgePoint(row, column, to))
      }
    }
  }

  const rings: Ring[] = []
  const visited = new Set<string>()
  for (const start of neighbours.keys()) {
    if (!visited.has(start)) rings.push({ level, points: walkRing(start, points, neighbours, visited) })
  }
  return rings
}

export function contourRings({ seed, levels, steepness = 0, size = 100 }: ContourOptions): Ring[] {
  const field = heightField(seededRandom(seed), steepness)
  const floor = borderMaximum(field)
  const peak = Math.max(...field.flat())
  return Array.from({ length: levels }, (_, level) =>
    ringsAtHeight(field, floor + ((peak - floor) * (level + 0.5)) / levels, level, size),
  ).flat()
}

const MIN_COVER_LEVELS = 3
const MAX_COVER_LEVELS = 9

/**
 * A topic cover's contour map: one level per chapter, three to nine. `hardShare` is the share of the topic's
 * questions rated hard, 0 to 1: harder topics get steeper, more crowded rings. Shared by the app and the social cards.
 */
export function coverRings(slug: string, chapterCount: number, hardShare: number): { rings: Ring[]; levels: number } {
  const levels = Math.min(Math.max(chapterCount, MIN_COVER_LEVELS), MAX_COVER_LEVELS)
  return { rings: contourRings({ seed: slug, levels, steepness: hardShare }), levels }
}

export function ringPath(points: readonly Point[]): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + 'Z'
}

/** The ring with the most points at a level (a level can have several rings); `undefined` when the level has none. */
export function ringAtLevel(rings: Ring[], level: number): Ring | undefined {
  return rings
    .filter((ring) => ring.level === level)
    .reduce<Ring | undefined>(
      (best, ring) => (!best || ring.points.length > best.points.length ? ring : best),
      undefined,
    )
}

/** The point furthest in a direction: `angle` 0 is right and grows clockwise on screen (y grows downward). */
export function furthestPoint(points: readonly Point[], angle: number): Point {
  const reach = ([x, y]: Point) => x * Math.cos(angle) + y * Math.sin(angle)
  return points.reduce((best, point) => (reach(point) > reach(best) ? point : best))
}
