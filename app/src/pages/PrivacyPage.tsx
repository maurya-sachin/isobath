import { PageShell } from '@/components/PageShell'
import { analyticsEnabled } from '@/analytics/analytics'
import { setDeviceOptOut, useDeviceOptOut } from '@/analytics/analyticsOptOut'
import { REPO_URL } from '@/lib/repo'
import { SITE_NAME } from '@/lib/site'
import { useHydrated } from '@/hooks/useHydrated'

/** The checkbox's space is reserved before hydration, so the page does not jump when it appears. */
function DeviceOptOut() {
  const hydrated = useHydrated()
  const optedOut = useDeviceOptOut()
  return (
    <div className="min-h-6">
      {hydrated && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-link"
            checked={optedOut}
            onChange={(event) => setDeviceOptOut(event.target.checked)}
          />
          Don't count my visits on this device
        </label>
      )}
    </div>
  )
}

export function PrivacyPage() {
  return (
    <PageShell crumbs={[]}>
      <title>{`Privacy · ${SITE_NAME}`}</title>
      <h1 className="font-serif text-4xl font-medium tracking-tight">Privacy</h1>
      <p className="mt-2 mb-8 text-muted-foreground">What this site records about visitors, and how to change it.</p>

      <div className="content flex flex-col gap-4">
        <h2 className="mt-4 text-xl font-semibold">What is counted</h2>
        <p>
          {SITE_NAME} uses PostHog, hosted in the EU, to count visits. It records which pages are opened, where visitors
          came from, clicks, scroll positions, errors and how fast pages load, together with the browser, system and
          device type. It also counts what you study and search: the words you search for (the first 80 characters),
          flashcard ratings, practice answers and revealed exercise answers, and your display settings (theme, reading
          font, text size). None of it is tied to your name. There are no accounts, and no advertising or tracking by
          anyone else.
        </p>
        <p>
          Requests to PostHog go through this site's own <code>/soundings</code> path rather than straight to PostHog.
        </p>

        <h2 className="mt-4 text-xl font-semibold">If you decline, or have not chosen yet</h2>
        <p>
          Your visit is still counted, anonymously. No cookie is set and nothing that identifies you is stored on your
          device; the only things kept are one local-storage entry recording your choice, so you are not asked again,
          and, if you use the switch below, one entry recording that. The server turns your address into a short-lived
          anonymous identifier and does not keep the address.
        </p>

        <h2 className="mt-4 text-xl font-semibold">If you accept</h2>
        <p>
          PostHog stores a cookie and local storage entry so a returning visit is recognised, and it can tell which
          country and city visits come from.
        </p>

        <h2 className="mt-4 text-xl font-semibold">Change your choice</h2>
        <p>
          Use <strong>Cookie settings</strong> in the footer at any time (it is hidden while this device is not counted,
          see below). Your progress and flashcard history stay in your browser; only the study actions listed above are
          counted, anonymously. Comments are loaded from giscus, which is run by GitHub.
        </p>
        {analyticsEnabled && <DeviceOptOut />}
        {analyticsEnabled && (
          <p className="text-sm text-muted-foreground">Turning counting back on applies from the next page load.</p>
        )}

        <h2 className="mt-4 text-xl font-semibold">The code</h2>
        <p>
          Everything the site does is in the <a href={REPO_URL}>public repository</a>.
        </p>
      </div>
    </PageShell>
  )
}
