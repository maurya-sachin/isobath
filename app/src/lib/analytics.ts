import type { PostHog } from 'posthog-js'
import { POSTHOG_API_HOST } from './posthogHost.ts'

const key = import.meta.env.VITE_POSTHOG_KEY

/** False without a project key (dev, CI, forks): there is nothing to consent to, so no banner is shown. */
export const analyticsEnabled = Boolean(key)

let instance: PostHog | null = null
const readyListeners = new Set<() => void>()

/** The PostHog client once `loadAnalytics` has finished, otherwise null. */
export function getAnalytics(): PostHog | null {
  return instance
}

/** Calls `listener` when the client becomes available. Returns the unsubscribe function. */
export function onAnalyticsReady(listener: () => void): () => void {
  readyListeners.add(listener)
  return () => {
    readyListeners.delete(listener)
  }
}

/** Safari has no `requestIdleCallback`. */
function whenIdle(callback: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(callback)
  else setTimeout(callback, 1)
}

async function start(projectKey: string): Promise<void> {
  try {
    const { default: posthog } = await import('posthog-js')
    posthog.init(projectKey, {
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
    instance = posthog
    for (const listener of readyListeners) listener()
  } catch (error) {
    console.error('Analytics failed to load', error)
  }
}

/**
 * Loads PostHog once the page is idle, so its ~117 kB (gzip) stays out of the entry chunk and the first render. Until
 * the visitor accepts, and after they decline, visits are counted without cookies or browser storage
 * (`cookieless_mode: 'on_reject'` with capturing opted out by default); accepting switches to cookies. Does nothing
 * without a project key, which keeps dev servers, CI builds and forks out of the analytics.
 */
export function loadAnalytics(): void {
  if (!key) return
  whenIdle(() => void start(key))
}
