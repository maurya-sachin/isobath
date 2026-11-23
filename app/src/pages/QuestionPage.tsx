import { useEffect } from 'react'
import { Link, useLoaderData, useLocation, useParams } from 'react-router'
import { DepthRail } from '@/components/DepthRail'
import { ChapterNav } from '@/components/question/ChapterNav'
import { Exercises } from '@/components/question/Exercises'
import { Html } from '@/components/question/Html'
import { InlineHtml } from '@/components/question/InlineHtml'
import { MetaRow } from '@/components/question/MetaRow'
import { Section } from '@/components/question/Section'
import { SuggestFix } from '@/components/question/SuggestFix'
import { Breadcrumbs, ComingSoon, NotFound } from '@/components/PageShell'
import { QuestionComments } from '@/components/QuestionComments'
import { QuestionTitle } from '@/components/QuestionTitle'
import { findChapter, neighbours, questionId, questionPath, useTopic } from '@/questions/index-data'
import type { QuestionPage as QuestionData } from '@/questions/types'
import { markRead } from '@/learning/progress'
import { editUrl } from '@/lib/repo'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const CODE_STYLE = '[&_code]:font-mono [&_code]:text-[0.9em]'

type Topic = NonNullable<ReturnType<typeof useTopic>>
type Chapter = NonNullable<ReturnType<typeof findChapter>>
type Neighbour = ReturnType<typeof neighbours>['previous']

/** The topic, chapter and question the URL names, or `undefined` for each part that doesn't exist. */
function useQuestionRoute() {
  const params = useParams()
  const topic = useTopic()
  const chapter = topic && findChapter(topic, params.chapter)
  const id = topic && chapter && params.question ? questionId(topic, chapter, params.question) : undefined
  const question = chapter?.questions.find((candidate) => candidate.id === id)
  return { topic, chapter, question }
}

/** Marks the question read once its content is on screen. */
function useMarkRead(content: QuestionData | null, id: string | undefined) {
  const readableId = content !== null ? id : undefined
  const titleHtml = content?.titleHtml
  useEffect(() => {
    if (readableId && titleHtml) markRead(readableId, titleHtml)
  }, [readableId, titleHtml])
}

/** The sections on the page, in order, for the depth rail. */
function outline(content: QuestionData | null) {
  if (content === null) return []
  return [
    { id: 'tldr', title: '30-second answer', shown: true },
    { id: 'answer', title: 'Answer', shown: true },
    { id: 'example', title: 'Example', shown: true },
    { id: 'pitfalls', title: 'Pitfalls', shown: true },
    { id: 'follow-ups', title: 'Follow-ups', shown: content.followUps.length > 0 },
    { id: 'deep-dive', title: 'Deep dive', shown: Boolean(content.deepDiveHtml) },
    { id: 'exercises', title: 'Exercises', shown: content.exercises.length > 0 },
  ].filter((section) => section.shown)
}

export function QuestionPage() {
  // The route's loader returns the question's content, or null when it has no page yet.
  const content = useLoaderData<QuestionData | null>()
  const { topic, chapter, question } = useQuestionRoute()
  useMarkRead(content, question?.id)
  if (!topic || !chapter || !question) return <NotFound what="Question" />

  const { previous, next } = neighbours(topic, question.id)

  return (
    <div className="mx-auto grid max-w-340 grid-cols-1 gap-12 px-6 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,45rem)_14rem] xl:justify-center">
      <aside aria-label="Questions in this chapter" className="hidden lg:block">
        <ChapterNav topicSlug={topic.slug} chapter={chapter} currentId={question.id} />
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <QuestionHeading topic={topic} chapter={chapter} question={question} />
        {content === null ? (
          <p className="mt-4">
            <ComingSoon />
          </p>
        ) : (
          <QuestionBody content={content} />
        )}
        <PreviousNext previous={previous} next={next} />
        {content && <QuestionComments questionId={question.id} />}
      </main>

      <OnThisPage content={content} />
    </div>
  )
}

function OnThisPage({ content }: { content: QuestionData | null }) {
  // The depth rail only fits in the xl layout; mounting it only there keeps its scroll listener off smaller screens.
  const fits = useMediaQuery('(min-width: 80rem)')
  const stops = outline(content)
  if (!fits || stops.length === 0) return null
  return (
    <aside aria-label="On this page">
      <DepthRail stops={stops} />
    </aside>
  )
}

interface QuestionHeadingProps {
  topic: Topic
  chapter: Chapter
  question: NonNullable<ReturnType<typeof useQuestionRoute>['question']>
}

function QuestionHeading({ topic, chapter, question }: QuestionHeadingProps) {
  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: 'Topics', to: '/' },
          { label: topic.title, to: `/${topic.slug}` },
          { label: chapter.title, to: `/${topic.slug}/${chapter.slug}` },
        ]}
      />
      <title>{`${question.title} · ${SITE_NAME}`}</title>
      {/* Mono is wider and heavier than the sans at the same size: code in the title runs smaller and lighter. */}
      <h1 className="text-[2.5rem] leading-[1.1] font-bold tracking-[-0.03em] [&_code]:text-[0.84em] [&_code]:font-semibold">
        <QuestionTitle html={question.titleHtml} />
      </h1>

      {/* Keyed so the list closes when you pick another question. */}
      <details key={question.id} className="mt-6 rounded-lg border lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Questions in this chapter ({chapter.questions.length})
        </summary>
        <div className="px-4 pb-4">
          <ChapterNav topicSlug={topic.slug} chapter={chapter} currentId={question.id} />
        </div>
      </details>
    </>
  )
}

function QuestionBody({ content }: { content: QuestionData }) {
  return (
    <>
      <MetaRow
        status={content.status}
        difficulty={content.difficulty}
        frequency={content.frequency}
        verified={content.verified}
        stale={content.stale}
        legacy={content.legacy}
      />
      {/* Text selected in here can be quoted in "Suggest a fix". */}
      <div data-quotable>
        <TldrCard html={content.tldrHtml} />
        <Section id="answer" title="Answer">
          <Html html={content.answerHtml} />
        </Section>
        <Section id="example" title="Example">
          <Html html={content.exampleHtml} />
        </Section>
        <Section id="pitfalls" title="Pitfalls">
          <Html html={content.pitfallsHtml} />
        </Section>
        {content.followUps.length > 0 && <FollowUps followUps={content.followUps} />}
        {content.deepDiveHtml && (
          <div className="mt-14 border-t pt-2">
            <Section id="deep-dive" title="Deep dive">
              <Html html={content.deepDiveHtml} />
            </Section>
          </div>
        )}
        {content.exercises.length > 0 && (
          <div className="mt-14 border-t pt-2">
            <Section id="exercises" title="Exercises">
              {/* Keyed so revealed answers reset when navigating to another question. */}
              <Exercises key={content.id} questionId={content.id} exercises={content.exercises} />
            </Section>
          </div>
        )}
      </div>
      <QuestionFooter content={content} />
    </>
  )
}

function TldrCard({ html }: { html: string }) {
  return (
    <section
      aria-labelledby="tldr"
      className="mt-10 scroll-mt-8 rounded-r-xl border-l-4 border-link bg-tldr py-5 pr-6 pl-6 text-tldr-foreground"
    >
      <h2 id="tldr" className="text-sm font-medium">
        30-second answer
      </h2>
      <p className="mt-2 font-reading text-[1.375rem] leading-snug text-foreground">
        <InlineHtml html={html} className={CODE_STYLE} />
      </p>
    </section>
  )
}

function FollowUps({ followUps }: { followUps: QuestionData['followUps'] }) {
  return (
    <Section id="follow-ups" title="Follow-ups">
      <dl className="flex flex-col gap-3">
        {followUps.map((followUp) => (
          <div key={followUp.questionHtml} className="rounded-xl border px-5 py-4">
            <dt className="font-semibold">
              <InlineHtml html={followUp.questionHtml} className={CODE_STYLE} />
            </dt>
            <dd className="mt-2 text-muted-foreground">
              <InlineHtml html={followUp.answerHtml} className={CODE_STYLE} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function QuestionFooter({ content }: { content: QuestionData }) {
  const { pathname } = useLocation()
  return (
    <footer className="mt-14 flex flex-col gap-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <span>Sources:</span>
        {content.sources.map((source) => (
          <a key={source} href={source} className="text-link hover:text-link-hover">
            {new URL(source).hostname}
          </a>
        ))}
      </div>
      <SuggestFix key={content.id} questionId={content.id} title={content.title} pageUrl={SITE_URL + pathname}>
        <a
          href={editUrl(content.sourcePath)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-6 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Propose an edit as a pull request
        </a>
      </SuggestFix>
      <p className="text-xs">
        Both open GitHub in a new tab and need a GitHub account. Nothing is sent until you submit there.
      </p>
    </footer>
  )
}

function PreviousNext({ previous, next }: { previous: Neighbour; next: Neighbour }) {
  return (
    <nav aria-label="Previous and next question" className="mt-12 grid grid-cols-2 gap-3">
      {previous ? (
        <Link to={questionPath(previous)} className="rounded-xl border p-4 hover:bg-muted">
          <span className="block text-sm text-muted-foreground">← Previous · {previous.number}</span>
          <QuestionTitle html={previous.titleHtml} />
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={questionPath(next)} className="col-start-2 rounded-xl border p-4 text-right hover:bg-muted">
          <span className="block text-sm text-muted-foreground">Next · {next.number} →</span>
          <QuestionTitle html={next.titleHtml} />
        </Link>
      )}
    </nav>
  )
}
