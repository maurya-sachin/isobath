// The distinct pages the questions cite in `sources`, for the weekly link check (lychee reads them one per line).

import type { Question } from './content.ts'

function withoutFragment(source: string): string {
  const url = new URL(source)
  url.hash = ''
  return url.href
}

/** Sorted, distinct source URLs without fragments: a page is requested once however many sections are cited. */
export function sourceUrls(questions: Question[]): string[] {
  const pages = questions.flatMap(({ meta }) => (meta && 'sources' in meta ? meta.sources : [])).map(withoutFragment)
  return [...new Set(pages)].sort()
}
