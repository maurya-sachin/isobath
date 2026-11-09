import { PageShell } from '@/components/PageShell'
import { REPO_URL } from '@/lib/repo'
import { SITE_NAME } from '@/lib/site'

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
          device type. There are no accounts, and no advertising or tracking by anyone else.
        </p>

        <h2 className="mt-4 text-xl font-semibold">If you decline, or have not chosen yet</h2>
        <p>
          Your visit is still counted, anonymously. No cookie is set and nothing that identifies you is stored on your
          device; the only thing kept is one local-storage entry recording your choice, so you are not asked again. The
          server turns your address into a short-lived anonymous identifier and does not keep the address.
        </p>

        <h2 className="mt-4 text-xl font-semibold">If you accept</h2>
        <p>
          PostHog stores a cookie and local storage entry so a returning visit is recognised, and it can tell which
          country and city visits come from.
        </p>

        <h2 className="mt-4 text-xl font-semibold">Change your choice</h2>
        <p>
          Use <strong>Cookie settings</strong> in the footer at any time. Your progress and flashcard history stay in
          your browser and are never sent anywhere. Comments are loaded from giscus, which is run by GitHub.
        </p>

        <h2 className="mt-4 text-xl font-semibold">The code</h2>
        <p>
          Everything the site does is in the <a href={REPO_URL}>public repository</a>.
        </p>
      </div>
    </PageShell>
  )
}
