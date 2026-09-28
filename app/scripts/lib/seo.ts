// Pure helpers for the head of every prerendered page: descriptions, structured data, duplicate checks.

import { AUTHOR, AUTHOR_URL, SITE_NAME, SITE_URL, TAGLINE } from '../../src/lib/site.ts'

/** Search results cut descriptions at about 155 to 160 characters. */
export const DESCRIPTION_LIMIT = 155

/** Collapses whitespace and, when too long, cuts at a word boundary and ends with an ellipsis. */
export function metaDescription(text: string, limit: number = DESCRIPTION_LIMIT): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  const cut = flat.slice(0, limit - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.\-–—]+$/, '')}…`
}

export interface Crumb {
  name: string
  path: string
}

export const pageUrl = (path: string) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`)

const plain = (text: string) => text.replaceAll('`', '')

const AUTHOR_PERSON = { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL }

/** One `<script type="application/ld+json">`; `<` is escaped so page text can never close the tag. */
export function jsonLdScript(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...data }).replaceAll('<', '\\u003c')}</script>`
}

export function breadcrumbList(crumbs: Crumb[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: plain(crumb.name),
      item: pageUrl(crumb.path),
    })),
  }
}

export function webSite(description: string): object[] {
  return [
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: `${SITE_NAME}: ${TAGLINE}`,
      url: `${SITE_URL}/`,
      description,
      inLanguage: 'en',
    },
    AUTHOR_PERSON,
  ]
}

export function techArticle({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): object {
  return {
    '@type': 'TechArticle',
    headline: plain(title),
    description,
    inLanguage: 'en',
    author: AUTHOR_PERSON,
    publisher: AUTHOR_PERSON,
    image: `${SITE_URL}/og${path}.png`,
    mainEntityOfPage: pageUrl(path),
  }
}

/** Values that appear on more than one page, with the pages that share them. */
export function duplicates(entries: { path: string; value: string }[]): { value: string; paths: string[] }[] {
  const byValue = new Map<string, string[]>()
  for (const { path, value } of entries) byValue.set(value, [...(byValue.get(value) ?? []), path])
  return [...byValue].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }))
}
