import posthog from 'posthog-js'
import { POSTHOG_API_HOST } from './posthogHost.ts'

const key = import.meta.env.VITE_POSTHOG_KEY

/** False without a project key (dev, CI, forks): there is nothing to consent to, so no banner is shown. */
export const analyticsEnabled = Boolean(key)

/**
 * Starts PostHog. Until the visitor accepts, and after they decline, visits are counted without cookies or browser
 * storage (`cookieless_mode: 'on_reject'` with storage off by default); accepting switches to cookies. Does nothing
 * without a project key, which keeps dev servers, CI builds and forks out of the analytics.
 */
export function initAnalytics() {
  if (!key) return
  posthog.init(key, {
    api_host: POSTHOG_API_HOST,
    cookieless_mode: 'on_reject',
    opt_out_persistence_by_default: true,
    // The site is a client-routed SPA: count route changes, not just the first load.
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    capture_dead_clicks: true,
    capture_heatmaps: true,
  })
}
