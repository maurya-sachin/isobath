// PostHog's EU hosts, shared by the init config and the page CSP so the two cannot drift apart.

/** Where events are sent. */
export const POSTHOG_API_HOST = 'https://eu.i.posthog.com'
/** Where posthog-js loads its extension scripts (autocapture, heatmaps, web vitals) from. */
export const POSTHOG_ASSETS_HOST = 'https://eu-assets.i.posthog.com'
