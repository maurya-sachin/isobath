import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusPage } from '@/components/StatusPage'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to: string
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
      {crumbs.map((crumb, position) => (
        <span key={crumb.to} className="flex gap-2">
          {position > 0 && <span aria-hidden="true">/</span>}
          <Link to={crumb.to} className="hover:text-foreground">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}

export function PageShell({
  crumbs,
  wide = false,
  children,
}: {
  crumbs: Crumb[]
  wide?: boolean
  children: ReactNode
}) {
  return (
    <main id="main" tabIndex={-1} className={cn('mx-auto px-6 py-8', wide ? 'max-w-5xl' : 'max-w-180')}>
      {crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
      {children}
    </main>
  )
}

export function NotFound({ what }: { what: string }) {
  return (
    <StatusPage
      eyebrow="404"
      title={`${what} not found`}
      message="This address doesn't match anything here. It may have moved, or the link has a typo."
    >
      <Link to="/" className="text-link underline underline-offset-4 hover:text-link-hover">
        Back to all topics
      </Link>
    </StatusPage>
  )
}

export function ComingSoon() {
  return (
    <span className="rounded border border-dashed border-muted-foreground/60 px-1.5 text-xs text-muted-foreground whitespace-nowrap">
      Coming soon
    </span>
  )
}
