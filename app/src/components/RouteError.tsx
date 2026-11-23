import { useEffect } from 'react'
import { Link, useRevalidator, useRouteError } from 'react-router'
import { StatusPage } from '@/components/StatusPage'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/Wordmark'
import { describeRouteError } from '@/lib/routeError'
import { useOnline } from '@/hooks/useOnline'

/**
 * Shown in place of a page whose data failed to load. Offline, it retries by itself once the connection returns.
 * `standalone` is for the root route, where the layout (and so the header) is not available.
 */
export function RouteError({ standalone = false }: { standalone?: boolean }) {
  const error = useRouteError()
  const online = useOnline()
  const revalidator = useRevalidator()
  const view = describeRouteError(error, online)

  useEffect(() => {
    if (online && view.kind === 'offline') void revalidator.revalidate()
  }, [online, view.kind, revalidator])

  const page = (
    <StatusPage {...view}>
      {view.kind !== 'not-found' && <Button onClick={() => window.location.reload()}>Reload</Button>}
      <Link to="/" className="text-link underline underline-offset-4 hover:text-link-hover">
        Back to all topics
      </Link>
    </StatusPage>
  )
  if (!standalone) return page
  return (
    <>
      <header className="border-b px-6 py-3">
        <Link to="/" className="text-foreground">
          <Wordmark className="text-xl" />
        </Link>
      </header>
      {page}
    </>
  )
}
