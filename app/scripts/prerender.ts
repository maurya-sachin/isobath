// Prerender every content page into dist/ (run by `npm run build` after the client and server builds).
// Each page becomes dist/<path>.html: the built template with the page's markup and head tags filled in.
// Also writes dist/app-shell.html (client-only routes), dist/404.html, sitemap.xml and robots.txt.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chapterStats } from '../src/questions/stats.ts'
import type { ContentManifest, SearchDoc, TopicSummary } from '../src/questions/types.ts'
import { SITE_NAME, SITE_URL, TAGLINE } from '../src/lib/site.ts'
import { faviconSvg, touchIconSvg } from '../src/theme/icons.ts'
import { hex } from '../src/theme/palette.ts'
import { withContentSecurityPolicy } from './lib/csp.ts'
import { CARD_HEIGHT, CARD_WIDTH, type CardData } from './lib/ogCard.ts'
import { renderCard, svgToPng } from './lib/ogImage.ts'
import {
  breadcrumbList,
  duplicates,
  jsonLdScript,
  metaDescription,
  pageUrl,
  techArticle,
  webSite,
  type Crumb,
} from './lib/seo.ts'

interface Rendered {
  html: string
  status: number
}

interface Page {
  path: string
  description: string
  type: 'website' | 'article'
  /** Last fact check as `YYYY-MM-DD`, for the sitemap. */
  lastmod?: string
  /** Structured data for the page, one JSON-LD script each. */
  jsonLd?: object[]
  /** The social card: its URL path under `/og/` and its alt text. Rendered once per path (see `cards`). */
  image?: { path: string; alt: string }
}

const HOME_DESCRIPTION = 'Interview questions for any software engineer, from the language to the spec and the engine.'
const PATHS_DESCRIPTION = 'Ordered routes through the topics for each kind of engineer.'
const ROADMAP_DESCRIPTION = 'Every topic on isobath, written and planned.'
const CHANGELOG_DESCRIPTION = 'What changed in the questions, and when.'
const PRACTICE_DESCRIPTION = 'Practise questions and review flashcards.'
const PRIVACY_DESCRIPTION = 'What the site counts about visitors, with and without cookies, and how to change it.'

const distDir = path.resolve(import.meta.dirname, '../dist')

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(distDir, relativePath), 'utf8')) as T
}

/** Serves the app's `/data/` requests from dist/data, so pages load their content without a server. */
function serveDataFromDisk(): void {
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input, SITE_URL)
    if (!url.pathname.startsWith('/data/')) throw new Error(`prerender: unexpected fetch of ${url.href}`)
    try {
      const body = await readFile(path.join(distDir, url.pathname))
      return new Response(body, { headers: { 'content-type': 'application/json' } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  }
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

/** Every social card to render, by the URL path of its image: shared by the pages that use it. */
const cards = new Map<string, CardData>()

function registerCard(imagePath: string, data: CardData): { path: string; alt: string } {
  cards.set(imagePath, data)
  return { path: imagePath, alt: data.title }
}

function staticPages(manifest: ContentManifest): Page[] {
  const site = registerCard('/og/site.png', {
    kicker: 'Interview questions for any software engineer',
    title: TAGLINE,
    note: '',
    map: { slug: SITE_NAME, chapterCount: 6, hardShare: 0.3 },
  })
  return [
    { path: '/', description: HOME_DESCRIPTION, type: 'website', image: site, jsonLd: webSite(HOME_DESCRIPTION) },
    { path: '/paths', description: PATHS_DESCRIPTION, type: 'website', image: site },
    ...manifest.paths.map((rolePath): Page => ({
      path: `/paths/${rolePath.slug}`,
      description: rolePath.summary || PATHS_DESCRIPTION,
      type: 'website',
      image: site,
    })),
    { path: '/roadmap', description: ROADMAP_DESCRIPTION, type: 'website', image: site },
    { path: '/changelog', description: CHANGELOG_DESCRIPTION, type: 'website', image: site },
    { path: '/practice', description: PRACTICE_DESCRIPTION, type: 'website', image: site },
    { path: '/privacy', description: PRIVACY_DESCRIPTION, type: 'website', image: site },
  ]
}

interface TopicContext {
  topic: TopicSummary
  crumbs: Crumb[]
  image: Page['image']
  map: CardData['map']
  tldrs: Map<string, string>
}

async function topicPages(overview: ContentManifest['topics'][number]): Promise<Page[]> {
  const topic = await readJson<TopicSummary>(`data/topics/${overview.slug}/index.json`)
  const { byDifficulty, total } = chapterStats(topic.chapters)
  const map = {
    slug: topic.slug,
    chapterCount: topic.chapters.length,
    hardShare: total === 0 ? 0 : byDifficulty.hard / total,
  }
  const image = registerCard(`/og/${topic.slug}.png`, {
    kicker: topic.chapters.length > 0 ? `${topic.chapters.length} chapters · ${total} questions` : 'Planned topic',
    title: topic.title,
    note: '',
    map,
  })
  const crumbs: Crumb[] = [
    { name: SITE_NAME, path: '/' },
    { name: topic.title, path: `/${topic.slug}` },
  ]
  // Topics without chapters have no search.json.
  const searchDocs =
    topic.chapters.length > 0 ? await readJson<SearchDoc[]>(`data/topics/${topic.slug}/search.json`) : []
  const context: TopicContext = {
    topic,
    crumbs,
    image,
    map,
    tldrs: new Map(searchDocs.map((doc) => [doc.id, doc.tldr])),
  }

  const pages: Page[] = []
  if (overview.stats.readable > 0) {
    pages.push({
      path: `/practice/${topic.slug}`,
      description: `Practise ${topic.title} interview questions and review its flashcards.`,
      type: 'website',
      image,
    })
  }
  pages.push({
    path: `/${topic.slug}`,
    description: topic.summaryText,
    type: 'website',
    image,
    jsonLd: [breadcrumbList(crumbs)],
  })
  return [...pages, ...topic.chapters.flatMap((chapter) => chapterPages(context, chapter))]
}

function chapterPages(context: TopicContext, chapter: TopicSummary['chapters'][number]): Page[] {
  const { topic, crumbs, image } = context
  const chapterCrumbs: Crumb[] = [...crumbs, { name: chapter.title, path: `/${topic.slug}/${chapter.slug}` }]
  const chapterPage: Page = {
    path: `/${topic.slug}/${chapter.slug}`,
    description: chapter.summaryText,
    type: 'website',
    image,
    jsonLd: [breadcrumbList(chapterCrumbs)],
  }
  const questions = chapter.questions.filter((candidate) => candidate.hasPage)
  return [chapterPage, ...questions.map((question) => questionPage(context, chapter, chapterCrumbs, question))]
}

function questionPage(
  { topic, tldrs, map }: TopicContext,
  chapter: TopicSummary['chapters'][number],
  chapterCrumbs: Crumb[],
  question: TopicSummary['chapters'][number]['questions'][number],
): Page {
  const description = tldrs.get(question.id)
  if (!description) throw new Error(`${question.id}: no TL;DR in search.json for the page description`)
  const image = registerCard(`/og/${question.id}.png`, {
    kicker: `${topic.title} · ${chapter.title}`,
    title: question.title,
    note: question.difficulty,
    map,
  })
  return {
    path: `/${question.id}`,
    description,
    type: 'article',
    image,
    lastmod: question.verified ? `${question.verified}-01` : undefined,
    jsonLd: [
      techArticle({ title: question.title, description: metaDescription(description), path: `/${question.id}` }),
      breadcrumbList([...chapterCrumbs, { name: question.title, path: `/${question.id}` }]),
    ],
  }
}

async function listPages(): Promise<Page[]> {
  const manifest = await readJson<ContentManifest>('data/manifest.json')
  const pages = staticPages(manifest)
  for (const overview of manifest.topics) pages.push(...(await topicPages(overview)))
  return pages
}

/** PNG fallbacks for browsers that ignore the SVG favicon, and the iOS home-screen icon (written below). */
const iconTags = [
  '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
]

/** The browser's address-bar and overscroll colour: the page background of each mode. */
const themeColorTags = [
  `<meta name="theme-color" content="${hex('light', 'background')}" media="(prefers-color-scheme: light)" />`,
  `<meta name="theme-color" content="${hex('dark', 'background')}" media="(prefers-color-scheme: dark)" />`,
]

function imageTags({ path: imagePath, alt }: { path: string; alt: string }): string[] {
  return [
    `<meta property="og:image" content="${SITE_URL}${imagePath}" />`,
    `<meta property="og:image:width" content="${CARD_WIDTH}" />`,
    `<meta property="og:image:height" content="${CARD_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(alt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ]
}

/** `title` is already HTML-escaped by React. */
function headTags(title: string, page: Page): string {
  const url = pageUrl(page.path)
  const description = escapeHtml(metaDescription(page.description))
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    ...fontPreloads,
    ...themeColorTags,
    ...iconTags,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${page.type}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    ...(page.image ? imageTags(page.image) : ['<meta name="twitter:card" content="summary" />']),
    ...(page.jsonLd ?? []).map(jsonLdScript),
  ].join('\n    ')
}

function appShellHeadTags(title: string, description: string): string {
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    '<meta name="robots" content="noindex" />',
    ...fontPreloads,
    ...themeColorTags,
    ...iconTags,
  ].join('\n    ')
}

/**
 * Pages render their `<title>` as a leading sibling of the markup. The title moves to the head, where
 * the browser's own copy lives, so hydration matches and the document has exactly one title.
 */
function splitTitle(pagePath: string, html: string): { title: string; markup: string } {
  const match = /^<title>(.*?)<\/title>/s.exec(html)
  if (!match) throw new Error(`${pagePath}: rendered page has no leading <title>`)
  return { title: match[1], markup: html.slice(match[0].length) }
}

function outputFile(pagePath: string): string {
  return path.join(distDir, pagePath === '/' ? 'index.html' : `${pagePath}.html`)
}

async function writePage(file: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, contents)
}

/** Preloads the two latin variable fonts every page uses (UI and prose), so they download beside the CSS instead of after it. */
async function fontPreloadTags(): Promise<string[]> {
  const files = (await readdir(path.join(distDir, 'assets'))).filter((file) =>
    /^(geist|newsreader)-latin-wght-normal-.+\.woff2$/.test(file),
  )
  if (files.length !== 2)
    throw new Error(
      `prerender: expected the Geist and Newsreader latin fonts in dist/assets, found ${files.join(', ') || 'none'}`,
    )
  return files.map((file) => `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin />`)
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8')
for (const placeholder of ['<!--app-head-->', '<!--app-html-->']) {
  if (!template.includes(placeholder))
    throw new Error(
      `dist/index.html has no ${placeholder}: prerender has already run on it. Run \`vite build\` again first.`,
    )
}
const fillTemplate = (head: string, markup: string) =>
  withContentSecurityPolicy(template.replace('<!--app-head-->', () => head).replace('<!--app-html-->', () => markup))

const fontPreloads = await fontPreloadTags()
serveDataFromDisk()
const { render } = (await import(pathToFileURL(path.resolve(distDir, '../dist-server/entry-server.js')).href)) as {
  render: (path: string) => Promise<Rendered>
}
const pages = await listPages()

const sharedDescriptions = duplicates(
  pages.map((page) => ({ path: page.path, value: metaDescription(page.description) })),
)
if (sharedDescriptions.length > 0)
  throw new Error(
    `prerender: pages share a meta description:\n${sharedDescriptions.map(({ value, paths }) => `  "${value.slice(0, 70)}" → ${paths.join(', ')}`).join('\n')}`,
  )
const titles: { path: string; value: string }[] = []

// Served for unknown URLs and client-only pages, so it must not claim to be the home page: no canonical, no og tags.
await writePage(
  path.join(distDir, 'app-shell.html'),
  fillTemplate(appShellHeadTags(`${SITE_NAME}: ${TAGLINE}`, HOME_DESCRIPTION), ''),
)

// Vercel serves this, with a 404 status, for any URL that is neither a page nor a client-only route (vercel.json).
const notFound = await render('/not-found/page/does/not-exist')
const notFoundParts = splitTitle('404', notFound.html)
await writePage(
  path.join(distDir, '404.html'),
  fillTemplate(
    [
      `<title>${notFoundParts.title}</title>`,
      '<meta name="robots" content="noindex" />',
      ...fontPreloads,
      ...themeColorTags,
      ...iconTags,
    ].join('\n    '),
    notFoundParts.markup,
  ).replace('<div id="root">', '<div id="root" data-client-render>'), // see src/main.tsx
)

for (const page of pages) {
  const { html, status } = await render(page.path)
  if (status !== 200) throw new Error(`${page.path}: rendered with status ${status}`)
  const { title, markup } = splitTitle(page.path, html)
  titles.push({ path: page.path, value: title })
  await writePage(outputFile(page.path), fillTemplate(headTags(title, page), markup))
}

for (const [imagePath, data] of cards) await writePage(path.join(distDir, imagePath), await renderCard(data))

const sharedTitles = duplicates(titles)
if (sharedTitles.length > 0)
  throw new Error(
    `prerender: pages share a title:\n${sharedTitles.map(({ value, paths }) => `  "${value}" → ${paths.join(', ')}`).join('\n')}`,
  )

const urls = pages.map(
  (page) =>
    `  <url><loc>${escapeHtml(pageUrl(page.path))}</loc>${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}</url>`,
)
await writeFile(
  path.join(distDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)
await writeFile(
  path.join(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /data/\nSitemap: ${SITE_URL}/sitemap.xml\n`,
)
await writeFile(path.join(distDir, 'favicon-32.png'), svgToPng(faviconSvg(), 32))
await writeFile(path.join(distDir, 'apple-touch-icon.png'), svgToPng(touchIconSvg(), 180))

console.log(`✔ prerendered ${pages.length} pages, ${cards.size} social cards, sitemap.xml, robots.txt and icons`)
