import { Link } from 'react-router'
import { useState } from 'react'
import { DifficultyMix } from '@/components/DifficultyMix'
import { ComingSoon, NotFound, PageShell } from '@/components/PageShell'
import { TopicCover } from '@/components/TopicCover'
import { WARNING_TEXT } from '@/components/question/MetaRow'
import { InlineHtml } from '@/components/question/InlineHtml'
import { QuestionTitle } from '@/components/QuestionTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { questionPath, useTopic } from '@/questions/index-data'
import { formatMonth } from '@/questions/freshness'
import { filterOutline } from '@/questions/outline'
import { chapterStats } from '@/questions/stats'
import type { TopicSummary } from '@/questions/types'
import { useProgress } from '@/learning/progress'
import { SITE_NAME } from '@/lib/site'
import { cn } from '@/lib/utils'

const INLINE_CODE = '[&_code]:font-mono [&_code]:text-[0.9em]'

export function TopicPage() {
  const topic = useTopic()
  if (!topic) return <NotFound what="Topic" />
  // Keyed so the filter starts empty when moving between topics.
  return <Topic key={topic.slug} topic={topic} />
}

type ChapterStats = ReturnType<typeof chapterStats>
type Chapter = TopicSummary['chapters'][number]
type Question = Chapter['questions'][number]

function Topic({ topic }: { topic: TopicSummary }) {
  return (
    <PageShell crumbs={[{ label: 'Topics', to: '/' }]} wide>
      <title>{`${topic.title} · ${SITE_NAME}`}</title>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
        <TopicHeader topic={topic} />
        <Contents topic={topic} />
      </div>
    </PageShell>
  )
}

function TopicHeader({ topic }: { topic: TopicSummary }) {
  const { read } = useProgress()
  const stats = chapterStats(topic.chapters)
  const questions = topic.chapters.flatMap((chapter) => chapter.questions)
  // Continue at the first readable question not read yet; fall back to the first readable one.
  const start =
    questions.find((question) => question.hasPage && !read.includes(question.id)) ??
    questions.find((question) => question.hasPage)
  const readCount = questions.filter((question) => read.includes(question.id)).length

  return (
    <header className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:max-h-[calc(100dvh-var(--header-height)-4rem)] lg:self-start lg:-mx-1 lg:overflow-y-auto lg:pr-3 lg:pl-1">
      <TopicCover
        slug={topic.slug}
        chapterCount={topic.chapters.length}
        hardShare={stats.total === 0 ? 0 : stats.byDifficulty.hard / stats.total}
        className="mb-6 hidden aspect-2/1 w-full rounded-lg bg-muted lg:block"
      />
      <h1 className="text-4xl font-bold tracking-[-0.03em]">{topic.title}</h1>
      <InlineHtml
        html={topic.summaryHtml}
        className={`mt-3 block font-reading text-xl leading-relaxed text-muted-foreground ${INLINE_CODE}`}
      />
      {topic.chapters.length > 0 && (
        <>
          <TopicActions topic={topic} start={start} hasRead={readCount > 0} />
          <TopicStats topic={topic} stats={stats} readCount={readCount} />
        </>
      )}
      <TopicFacts topic={topic} stats={stats} />
    </header>
  )
}

function TopicActions({ topic, start, hasRead }: { topic: TopicSummary; start?: Question; hasRead: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap gap-3 lg:flex-col">
      {start && (
        <Button asChild size="lg">
          <Link to={questionPath(start)}>{hasRead ? 'Continue reading' : 'Start reading'}</Link>
        </Button>
      )}
      {topic.flashcardCount > 0 && (
        <>
          <Button asChild variant="outline" size="lg">
            <Link to={`/flashcards/${topic.slug}`}>Study {topic.flashcardCount} flashcards</Link>
          </Button>
          <a
            href={`/data/topics/${topic.slug}/anki.txt`}
            download={`${SITE_NAME}-${topic.slug}-anki.txt`}
            className="self-start text-sm text-link hover:text-link-hover"
          >
            Download for Anki
          </a>
        </>
      )}
    </div>
  )
}

function TopicStats({ topic, stats, readCount }: { topic: TopicSummary; stats: ChapterStats; readCount: number }) {
  return (
    <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 lg:grid lg:grid-cols-2">
      <Stat value={topic.chapters.length} label="chapters" />
      <Stat value={stats.total} label="questions" />
      <Stat value={stats.core} label="core" />
      {topic.flashcardCount > 0 && <Stat value={topic.flashcardCount} label="flashcards" />}
      {readCount > 0 && <Stat value={readCount} label="read by you" />}
    </dl>
  )
}

interface Fact {
  text: string
  warning?: boolean
}

function topicFacts(topic: TopicSummary, stats: ChapterStats): Fact[] {
  // Drafts are readable but not yet reviewed by the maintainer.
  const unreviewed = stats.readable - stats.reviewed
  const facts: Fact[] = []
  if (topic.covers !== null) facts.push({ text: `Covers ${topic.covers}` })
  if (unreviewed > 0) facts.push({ text: `${unreviewed} not yet reviewed` })
  if (stats.lastVerified !== null) facts.push({ text: `Last verified ${formatMonth(stats.lastVerified)}` })
  if (stats.stale > 0) {
    facts.push({ text: stats.stale === 1 ? '1 needs re-checking' : `${stats.stale} need re-checking`, warning: true })
  }
  return facts
}

function TopicFacts({ topic, stats }: { topic: TopicSummary; stats: ChapterStats }) {
  const facts = topicFacts(topic, stats)
  if (facts.length === 0) return null
  return (
    <ul className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
      {facts.map((fact) => (
        <li key={fact.text} className={fact.warning ? WARNING_TEXT : undefined}>
          {fact.text}
        </li>
      ))}
    </ul>
  )
}

function Contents({ topic }: { topic: TopicSummary }) {
  const { read } = useProgress()
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)

  if (topic.chapters.length === 0) {
    return (
      <section aria-label="Contents">
        <p className="rounded-xl border border-dashed p-5 text-muted-foreground">
          Chapters for this topic are planned.
        </p>
      </section>
    )
  }

  const shown = filterOutline(topic.chapters, read, { query, unreadOnly })
  const clearFilter = () => {
    setQuery('')
    setUnreadOnly(false)
  }

  return (
    <section aria-label="Contents">
      <ChapterFilter
        query={query}
        onQueryChange={setQuery}
        unreadOnly={unreadOnly}
        onToggleUnreadOnly={() => setUnreadOnly((value) => !value)}
      />
      {shown.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Nothing matches.{' '}
          <button type="button" onClick={clearFilter} className="text-link hover:text-link-hover">
            Clear the filter
          </button>
        </p>
      ) : (
        <ChapterList topicSlug={topic.slug} chapters={shown} read={read} open={query.trim() !== '' || unreadOnly} />
      )}
    </section>
  )
}

interface ChapterFilterProps {
  query: string
  onQueryChange: (query: string) => void
  unreadOnly: boolean
  onToggleUnreadOnly: () => void
}

function ChapterFilter({ query, onQueryChange, unreadOnly, onToggleUnreadOnly }: ChapterFilterProps) {
  return (
    <div className="flex gap-3">
      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Filter chapters and questions"
        aria-label="Filter chapters and questions"
        className="h-9 flex-1"
      />
      <Button
        variant="outline"
        size="lg"
        aria-pressed={unreadOnly}
        onClick={onToggleUnreadOnly}
        className={cn(unreadOnly && 'bg-tldr text-tldr-foreground')}
      >
        Unread only
      </Button>
    </div>
  )
}

interface ChapterListProps {
  topicSlug: string
  chapters: Chapter[]
  read: readonly string[]
  /** Expand every chapter, so filter matches are visible. */
  open: boolean
}

function ChapterList({ topicSlug, chapters, read, open }: ChapterListProps) {
  return (
    <ol className="mt-4 border-t">
      {chapters.map((chapter) => (
        <ChapterItem key={chapter.slug} topicSlug={topicSlug} chapter={chapter} read={read} open={open} />
      ))}
    </ol>
  )
}

function ChapterItem({ topicSlug, chapter, read, open }: Omit<ChapterListProps, 'chapters'> & { chapter: Chapter }) {
  const counts = chapterStats([chapter])
  const chapterRead = chapter.questions.filter((question) => read.includes(question.id)).length
  return (
    <li className="border-b">
      <details open={open} className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_11rem] [&::-webkit-details-marker]:hidden">
          <span className="font-mono text-sm text-muted-foreground">{chapter.number}</span>
          <InlineHtml
            html={chapter.titleHtml}
            className="text-lg font-semibold group-hover:text-link [&_code]:font-mono [&_code]:text-[0.9em]"
          />
          <span className="col-start-2 flex flex-col gap-1.5 text-sm text-muted-foreground sm:col-start-3 sm:text-right">
            <DifficultyMix counts={counts.byDifficulty} />
            <span>
              {counts.total} questions{chapterRead > 0 && `, ${chapterRead} read`}
            </span>
          </span>
        </summary>
        <div className="pb-4 pl-14">
          <InlineHtml
            html={chapter.summaryHtml}
            className={`block text-sm leading-relaxed text-muted-foreground ${INLINE_CODE}`}
          />
          <ul className="mt-3 flex flex-col">
            {chapter.questions.map((question) => (
              <li key={question.id} className="border-t border-dashed first:border-t-0">
                <QuestionRow question={question} isRead={read.includes(question.id)} />
              </li>
            ))}
          </ul>
          <Link
            to={`/${topicSlug}/${chapter.slug}`}
            className="mt-2 inline-block text-sm text-link hover:text-link-hover"
          >
            Open chapter page
          </Link>
        </div>
      </details>
    </li>
  )
}

function QuestionRow({ question, isRead }: { question: Question; isRead: boolean }) {
  if (!question.hasPage) {
    return (
      <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
        <QuestionTitle html={question.titleHtml} />
        <ComingSoon />
      </div>
    )
  }
  return (
    <Link to={questionPath(question)} className="flex items-baseline justify-between gap-4 py-2 hover:text-link">
      <span>
        <QuestionTitle html={question.titleHtml} />
        {question.legacy !== null && <span className={cn('ml-2 text-xs font-medium', WARNING_TEXT)}>Legacy</span>}
        {question.stale && <span className={cn('ml-2 text-xs', WARNING_TEXT)}>may be out of date</span>}
      </span>
      {isRead && <span className="shrink-0 text-xs text-muted-foreground">read</span>}
    </Link>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="order-first text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="text-muted-foreground">{label}</dt>
    </div>
  )
}
