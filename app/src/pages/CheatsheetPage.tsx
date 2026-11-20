import { Link, useLoaderData } from 'react-router'
import { InlineHtml } from '@/components/question/InlineHtml'
import { DifficultyBadge } from '@/components/question/MetaRow'
import { NotFound, PageShell } from '@/components/PageShell'
import { QuestionTitle } from '@/components/QuestionTitle'
import { Button } from '@/components/ui/button'
import { questionPath, type loadCheatsheet } from '@/questions/index-data'
import { SITE_NAME } from '@/lib/site'
import { usePrintInLight } from '@/hooks/usePrintInLight'

const CODE_STYLE = '[&_code]:font-mono [&_code]:text-[0.9em]'

export function CheatsheetPage() {
  const { topic, chapter, entries } = useLoaderData<Awaited<ReturnType<typeof loadCheatsheet>>>()
  usePrintInLight()
  if (!topic || !chapter || entries.length === 0) return <NotFound what="Cheat sheet" />

  const tldrs = new Map(entries.map((entry) => [entry.id, entry.tldrHtml]))
  const questions = chapter.questions.filter((question) => tldrs.has(question.id))

  return (
    <PageShell
      crumbs={[
        { label: 'Topics', to: '/' },
        { label: topic.title, to: `/${topic.slug}` },
        { label: chapter.title, to: `/${topic.slug}/${chapter.slug}` },
      ]}
    >
      <title>{`Cheat sheet: ${chapter.title} · ${topic.title} · ${SITE_NAME}`}</title>
      <p className="text-sm text-muted-foreground">
        {topic.title} · Chapter {chapter.number}
      </p>
      <h1 className="mt-1 text-4xl font-bold tracking-[-0.03em]">
        <InlineHtml html={chapter.titleHtml} className={CODE_STYLE} />
      </h1>
      <InlineHtml
        html={chapter.summaryHtml}
        className={`mt-3 block font-reading text-lg leading-relaxed text-muted-foreground ${CODE_STYLE}`}
      />
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
        <Button asChild variant="outline">
          <Link to={`/${topic.slug}/${chapter.slug}`}>Back to the chapter</Link>
        </Button>
      </div>

      <ol className="mt-8 border-t">
        {questions.map((question) => (
          <li key={question.id} className="border-b py-4 break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-muted-foreground">{question.number}</span>
              <Link to={questionPath(question)} className="font-medium hover:text-link">
                <QuestionTitle html={question.titleHtml} />
              </Link>
              <span className="ml-auto flex items-center gap-2 text-xs">
                {question.core && <span className="rounded-full border px-2 py-0.5">Core</span>}
                <DifficultyBadge difficulty={question.difficulty} />
              </span>
            </div>
            <InlineHtml
              html={tldrs.get(question.id)!}
              className={`mt-2 block font-reading text-base leading-relaxed ${CODE_STYLE}`}
            />
          </li>
        ))}
      </ol>
    </PageShell>
  )
}
