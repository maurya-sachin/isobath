// Links into the content repository, for "Suggest a fix" and "Propose an edit as a pull request".

import { fenced } from './quote.ts'

export const REPO_URL = 'https://github.com/maurya-sachin/isobath'
const DEFAULT_BRANCH = 'main'

/** The writing guide, where a contributor starts. */
export const CONTRIBUTE_URL = `${REPO_URL}/blob/${DEFAULT_BRANCH}/templates/README.md`

/** GitHub's editor for a content file; `sourcePath` is repo-relative (e.g. `content/javascript/…/010-x.md`). */
export function editUrl(sourcePath: string): string {
  return `${REPO_URL}/edit/${DEFAULT_BRANCH}/${sourcePath}`
}

/** Text the reader selected on the page, and the section it starts in. */
export interface QuoteForFix {
  text: string
  /** The section's heading, e.g. "Answer". */
  section: string
  /** The section heading's id, for a link to that spot. */
  sectionId: string
}

/**
 * The correction issue form, pre-filled with the question and its address (query params are the form's field ids).
 * With a quote, the address points at its section and the form gets the section and the fenced quote.
 */
export function suggestFixUrl(questionId: string, title: string, pageUrl: string, quote?: QuoteForFix): string {
  const params = new URLSearchParams({
    template: 'correction.yml',
    title: `Fix: ${title}`,
    question: questionId,
    page: quote ? `${pageUrl}#${quote.sectionId}` : pageUrl,
  })
  if (quote) {
    params.set('section', quote.section)
    params.set('quote', fenced(quote.text))
  }
  return `${REPO_URL}/issues/new?${params.toString()}`
}

/** Giscus keeps each question's comments in this repository's Discussions; both ids are public (`gh api graphql`). */
export const COMMENTS = {
  repo: 'maurya-sachin/isobath',
  repoId: 'R_kgDOQNTxwg',
  category: 'Questions',
  categoryId: 'DIC_kwDOQNTxws4DKbVV',
} as const
