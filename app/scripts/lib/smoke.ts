// What the browser smoke test visits and how it reports. Pure: scripts/smoke.ts drives the browsers.

export const WIDTHS = [375, 768, 1024, 1440] as const
export const THEMES = ['light', 'dark'] as const
export const TEXT_SIZES = [100, 145] as const

export interface PageSpec {
  path: string
  /** The status the page is expected to answer with. */
  status: 200 | 404
}

/** One page of each kind; the last is an unknown URL, which answers with the 404 page. */
export const PAGES: PageSpec[] = [
  { path: '/', status: 200 },
  { path: '/react', status: 200 },
  { path: '/react/rendering-model', status: 200 },
  { path: '/react/rendering-model/render-and-commit', status: 200 },
  { path: '/roadmap', status: 200 },
  { path: '/paths', status: 200 },
  { path: '/paths/frontend', status: 200 },
  { path: '/practice', status: 200 },
  { path: '/practice/react', status: 200 },
  { path: '/flashcards/react', status: 200 },
  { path: '/cheatsheet/react/rendering-model', status: 200 },
  { path: '/does-not-exist', status: 404 },
]

export interface Run {
  page: PageSpec
  width: (typeof WIDTHS)[number]
  theme: (typeof THEMES)[number]
  textSize: (typeof TEXT_SIZES)[number]
}

export function runMatrix(pages: PageSpec[] = PAGES): Run[] {
  return pages.flatMap((page) =>
    WIDTHS.flatMap((width) =>
      THEMES.flatMap((theme) => TEXT_SIZES.map((textSize): Run => ({ page, width, theme, textSize }))),
    ),
  )
}

export const describeRun = ({ page, width, theme, textSize }: Run) =>
  `${page.path} · ${width}px · ${theme} · ${textSize}%`

export interface Failure {
  check: 'status' | 'overflow' | 'console' | 'axe' | 'keyboard'
  detail: string
}

export interface Finding extends Failure {
  run: Run
}

/** The failures as text, grouped by check so one cause that hits many runs reads as one line. */
export function formatReport(browser: string, runs: number, findings: Finding[]): string {
  if (findings.length === 0) return `✔ ${browser}: ${runs} runs, no problems`
  const lines = findings.map(({ run, check, detail }) => `  ✖ [${check}] ${describeRun(run)}\n      ${detail}`)
  return `${lines.join('\n')}\n✖ ${browser}: ${findings.length} problem(s) in ${runs} runs`
}
