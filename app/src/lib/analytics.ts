import posthog from 'posthog-js'

const key = import.meta.env.VITE_POSTHOG_KEY

/**
 * Starts PostHog without cookies or browser storage (`cookieless_mode`), so no consent banner is needed. Does nothing
 * without a project key, which keeps dev servers, CI builds and forks out of the analytics.
 */
export function initAnalytics() {
  if (!key) return
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    cookieless_mode: 'always',
    // The site is a client-routed SPA: count route changes, not just the first load.
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
  })
}
