import type { ReactNode } from 'react'
import { PageShell } from '@/components/PageShell'
import { SITE_NAME } from '@/lib/site'

/** The shared look of the not-found and error pages: a small label, a heading, one sentence and the next steps. */
export function StatusPage({
  eyebrow,
  title,
  message,
  children,
}: {
  eyebrow: string
  title: string
  message: string
  children: ReactNode
}) {
  return (
    <PageShell crumbs={[]}>
      <title>{`${title} · ${SITE_NAME}`}</title>
      <p className="font-mono text-sm text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em]">{title}</h1>
      <p className="font-reading mt-3 max-w-prose text-xl leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>
    </PageShell>
  )
}
