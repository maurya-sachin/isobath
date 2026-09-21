import { lazy, Suspense } from 'react'
import { useHydrated } from '@/lib/useHydrated'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { COMMENTS } from '@/lib/repo'
import { useTheme } from '@/lib/theme'

// Loaded only in the browser, after hydration, so prerendered pages and the main bundle don't carry it.
const Giscus = lazy(() => import('@giscus/react'))

/** Comments and reactions for one question: a GitHub Discussion keyed by the question id. */
export function QuestionComments({ questionId }: { questionId: string }) {
  const hydrated = useHydrated()
  const theme = useTheme()
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = theme === 'dark' || (theme === 'system' && systemDark)

  return (
    <section aria-labelledby="comments" className="mt-12">
      <h2 id="comments" className="font-serif text-2xl font-medium tracking-tight">
        Comments
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Comments are GitHub Discussions: you sign in with GitHub to post or react.</p>
      <div className="mt-4 min-h-40">
        {hydrated && (
          <Suspense fallback={null}>
            <Giscus
              {...COMMENTS}
              id="giscus"
              mapping="specific"
              term={questionId}
              reactionsEnabled="1"
              emitMetadata="0"
              inputPosition="top"
              theme={dark ? 'dark' : 'light'}
              lang="en"
              loading="lazy"
            />
          </Suspense>
        )}
      </div>
    </section>
  )
}
