// Loading and querying the data built by content:build: a manifest for every page, then one shard per topic.

import { useRouteLoaderData } from 'react-router'
import type {
  Changelog,
  CheatsheetEntry,
  ChapterSummary,
  ContentManifest,
  SiteIndex,
  Flashcard,
  QuestionPage as QuestionData,
  QuestionSummary,
  TopicSummary,
} from './types.ts'

export const SITE_ROUTE_ID = 'root'
export const TOPIC_ROUTE_ID = 'topic'

/** Reads a JSON file produced by content:build; its shape is trusted because both sides share `types.ts`. */
export async function fetchData<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status}). Run npm run content:build.`)
  const data: unknown = await response.json()
  return data as T
}

/** The content history written by content:build. */
export function loadChangelog(): Promise<Changelog> {
  return fetchData<Changelog>('changelog.json')
}

let manifestPromise: Promise<ContentManifest> | undefined

/** One shared request: the root route, topic loaders and search all need the manifest. */
export function loadManifest(): Promise<ContentManifest> {
  manifestPromise ??= fetchData<ContentManifest>('manifest.json').catch((error: unknown) => {
    manifestPromise = undefined
    throw error
  })
  return manifestPromise
}

/** The topic list every page's header needs; the full manifest stays with the pages that read it. */
export async function loadSiteIndex(): Promise<SiteIndex> {
  const { topics } = await loadManifest()
  return { topics: topics.map(({ slug, title, track, chapterCount }) => ({ slug, title, track, chapterCount })) }
}

const topicPromises = new Map<string, Promise<TopicSummary>>()

/** A topic's chapters and questions, or `null` when the manifest has no such topic. */
export async function loadTopic(slug: string | undefined): Promise<TopicSummary | null> {
  const { topics } = await loadManifest()
  if (slug === undefined || !topics.some((topic) => topic.slug === slug)) return null
  let shard = topicPromises.get(slug)
  if (!shard) {
    shard = fetchData<TopicSummary>(`topics/${slug}/index.json`).catch((error: unknown) => {
      topicPromises.delete(slug) // allow a retry on the next navigation
      throw error
    })
    topicPromises.set(slug, shard)
  }
  return shard
}

/** The question's content, or `null` when it has no page yet (planned) or doesn't exist. */
export async function loadQuestion(id: string): Promise<QuestionData | null> {
  const topic = await loadTopic(id.split('/')[0])
  const summary = topic?.chapters.flatMap((chapter) => chapter.questions).find((question) => question.id === id)
  return summary?.hasPage ? fetchData<QuestionData>(`questions/${id}.json`) : null
}

/** A chapter's published questions in reading order, with the topic they belong to. */
export async function loadPractice(topicSlug: string | undefined, chapterSlug: string | undefined) {
  const topic = await loadTopic(topicSlug)
  const chapter = topic?.chapters.find((candidate) => candidate.slug === chapterSlug)
  const readable = chapter?.questions.filter((question) => question.hasPage) ?? []
  const questions = await Promise.all(
    readable.map((question) => fetchData<QuestionData>(`questions/${question.id}.json`)),
  )
  return { topic, questions }
}

/** A chapter's readable questions with their 30-second answers, for the cheat sheet. */
export async function loadCheatsheet(topicSlug: string | undefined, chapterSlug: string | undefined) {
  const topic = await loadTopic(topicSlug)
  const chapter = topic?.chapters.find((candidate) => candidate.slug === chapterSlug)
  const hasReadable = chapter?.questions.some((question) => question.hasPage) ?? false
  const entries =
    topic && chapter && hasReadable
      ? await fetchData<CheatsheetEntry[]>(`topics/${topic.slug}/${chapter.slug}/cheatsheet.json`)
      : []
  return { topic, chapter, entries }
}

/** One topic's flashcards, with the topic. Topics without a deck have no file to fetch. */
export async function loadFlashcards(topicSlug: string | undefined) {
  const topic = await loadTopic(topicSlug)
  const cards =
    topic && topic.flashcardCount > 0 ? await fetchData<Flashcard[]>(`topics/${topic.slug}/flashcards.json`) : []
  return { topic, cards }
}

export function useSiteIndex(): SiteIndex {
  // Route loader data is untyped in data-router mode; SITE_ROUTE_ID's loader returns loadSiteIndex().
  return useRouteLoaderData(SITE_ROUTE_ID) as SiteIndex
}

/** The topic of the current `:topic` route, or `null` when the URL names no topic. Call it only from pages under that route. */
export function useTopic(): TopicSummary | null {
  return useRouteLoaderData(TOPIC_ROUTE_ID) as TopicSummary | null
}

export function findChapter(topic: TopicSummary, slug: string | undefined): ChapterSummary | undefined {
  return topic.chapters.find((chapter) => chapter.slug === slug)
}

export function questionId(topic: TopicSummary, chapter: ChapterSummary, slug: string): string {
  return `${topic.slug}/${chapter.slug}/${slug}`
}

export function questionPath(question: Pick<QuestionSummary, 'id'>): string {
  return `/${question.id}`
}

/** The nearest questions before and after `id` in reading order that have a page. */
export function neighbours(topic: TopicSummary, id: string) {
  const questions = topic.chapters.flatMap((chapter) => chapter.questions)
  const position = questions.findIndex((question) => question.id === id)
  const readable = (question: QuestionSummary) => question.hasPage
  return {
    previous: questions.slice(0, Math.max(position, 0)).findLast(readable),
    next: questions.slice(position + 1).find(readable),
  }
}
