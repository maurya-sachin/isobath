interface ImportMetaEnv {
  /** PostHog project API key (public by design). Unset in dev and CI, which disables analytics. */
  readonly VITE_POSTHOG_KEY?: string
}
