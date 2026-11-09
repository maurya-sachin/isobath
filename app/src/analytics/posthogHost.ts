// PostHog is reached through our own origin: `vercel.json` rewrites this path to PostHog's EU hosts (and
// `vite.config.ts` does the same locally). Filter lists block PostHog's domains, not a path on the site itself.

/** Same-origin path that proxies PostHog's ingestion and extension scripts. */
export const POSTHOG_PROXY_PATH = '/soundings'
/** PostHog's real UI domain, so toolbar links point at the right place. */
export const POSTHOG_UI_HOST = 'https://eu.posthog.com'
