import posthog from 'posthog-js'
import { POSTHOG_API_HOST } from './posthogHost.ts'

const key = import.meta.env.VITE_POSTHOG_KEY

/** False without a project key (dev, CI, forks): there is nothing to consent to, so no banner is shown. */
export const analyticsEnabled = Boolean(key)

/**
 * Starts PostHog. Until the visitor accepts, and after they decline, visits are counted without cookies or browser
 * storage (`cookieless_mode: 'on_reject'` with capturing opted out by default); accepting switches to cookies. Does nothing
 * without a project key, which keeps dev servers, CI builds and forks out of the analytics.
 */
export function initAnalytics() {
  if (!key) return
  posthog.init(key, {
    api_host: POSTHOG_API_HOST,
    cookieless_mode: 'on_reject',
    // Counts the visit cookieless while the choice is pending; without it nothing is captured until the visitor chooses.
    opt_out_capturing_by_default: true,
    disable_session_recording: true,
    // The site is a client-routed SPA: count route changes, not just the first load.
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    capture_dead_clicks: true,
    capture_heatmaps: true,
  })
}
