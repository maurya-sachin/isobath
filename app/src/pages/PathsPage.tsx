import { useLoaderData } from 'react-router'
import { PageShell } from '@/components/PageShell'
import { StationLegend } from '@/components/RouteLine'
import { RoleList } from '@/components/RoleList'
import type { ContentManifest } from '@/questions/types'
import { SITE_NAME } from '@/lib/site'

const LEGEND_STATES = ['done', 'written', 'in-progress', 'planned'] as const

export function PathsPage() {
  const { paths } = useLoaderData<ContentManifest>()
  return (
    <PageShell crumbs={[]} wide>
      <title>{`Paths · ${SITE_NAME}`}</title>
      <h1 className="font-serif text-4xl font-medium tracking-tight">Paths</h1>
      <p className="mt-2 mb-4 max-w-xl text-muted-foreground">
        A route through the topics for the kind of engineer you are preparing to be. Pick one and work down the list.
      </p>
      <StationLegend states={LEGEND_STATES} className="mb-6" />
      <RoleList paths={paths} />
    </PageShell>
  )
}
