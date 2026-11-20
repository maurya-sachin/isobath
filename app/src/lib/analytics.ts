import type { PostHog } from 'posthog-js'
import { deviceOptedOut } from './analyticsOptOut.ts'
import { getAppearance } from './appearanceStore.ts'
import { superProperties, type AnalyticsEvent } from './analyticsEvents.ts'
import { getTheme } from './theme.ts'
import { POSTHOG_PROXY_PATH, POSTHOG_UI_HOST } from './posthogHost.ts'

const key = import.meta.env.VITE_POSTHOG_KEY

/** False without a project key (dev, CI, forks): there is nothing to consent to, so no banner is shown. */
export const analyticsEnabled = Boolean(key)

let instance: PostHog | null = null
/** Events recorded before PostHog finished loading; sent once it has. */
const pending: AnalyticsEvent[] = []
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

/** Registers the reader's theme and appearance settings as properties of every later event. */
export function registerDisplaySettings(): void {
  instance?.register(superProperties(getAppearance(), getTheme()))
}

/** Records a named event for every visitor, anonymously. Null (an event with nothing to say) is ignored. */
export function track(event: AnalyticsEvent | null): void {
  if (!event || !analyticsEnabled || deviceOptedOut()) return
  if (instance) instance.capture(event.name, event.properties)
  else pending.push(event)
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
      api_host: POSTHOG_PROXY_PATH,
      ui_host: POSTHOG_UI_HOST,
      // Stops sending at once when the switch is turned on mid-visit.
      before_send: (event) => (deviceOptedOut() ? null : event),
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
    registerDisplaySettings()
    for (const event of pending.splice(0)) track(event)
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
  if (!key || deviceOptedOut()) return
  whenIdle(() => void start(key))
}
