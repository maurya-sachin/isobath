# Cookie consent for analytics

Approved 2026-11-09. Mockup: `mockups/cookie-consent.html`. Reference for the banner: GOV.UK's cookie banner (non-modal region, Accept and Reject of equal weight, a way to change the choice later), in isobath's own visual language.

## Problem
- Analytics (PostHog, EU) currently runs with `cookieless_mode: 'always'`: no consent needed, but no country or city (PostHog strips the IP in this mode), and returning visitors cannot be recognised.
- The maintainer wants as much visitor data as possible and accepts a banner for it.

## Behaviour
- **Before a choice.** The visit is counted in PostHog's cookieless mode: no cookies, no storage, no identifier kept on the device.
- **Accept.** PostHog switches to cookies and local storage: returning visitors are recognised and country and city appear.
- **Decline.** Stays cookieless. Nothing is stored except the choice itself.
- **Banner.** A `role="region"` card, labelled "Anonymous analytics", bottom-left at 1024px and up and a bottom sheet at 375px. Non-modal: focus is not trapped and the page stays usable. Decline comes first, Accept second, with one style, size and weight (neither is nudged). One line says what Decline still does.
- **Changing the choice.** A "Cookie settings" button in the footer reopens the banner.
- **Privacy page.** One short `/privacy` page: what is collected, with and without consent, who processes it (PostHog, EU region), how to change the choice. The banner's "Privacy" link goes there.

## How it is built (my calls, not yet agreed)
- `analytics.ts` config: `cookieless_mode: 'on_reject'` and `opt_out_persistence_by_default: true`. Both options are in `@posthog/types` 's `PostHogConfig`; the second is what keeps storage off until the visitor accepts.
- The choice is held by PostHog itself (`opt_in_capturing`, `opt_out_capturing`, `get_explicit_consent_status`), not a second store of ours. The banner reads the status with `useSyncExternalStore` and a server snapshot, so prerendered pages never read storage during the first render and the banner appears only after hydration (`useHydrated`), as the style notes require.
- Banner and footer button live in `Layout.tsx`. Buttons are the existing `ui/button`.
- It must not collide with the selection bar of "Suggest a fix" (also fixed at the bottom): decided in the plan, by checking both at 1024 and 375.

## Must be verified in a browser (not assumed)
- Before any choice: network shows events sent, and no cookie or local-storage key from PostHog is written.
- After Accept: cookies and storage appear and a returning visit keeps the same visitor.
- After Decline: still no storage beyond the choice, and events keep arriving.
- The bar's checks: Chrome and Firefox at 375, 768, 1024 and 1440 px, light and dark, keyboard only, 145% text, axe-core, contrast numbers, no console errors, a production build.

## Non-goals
- Session replay. Not verified to work without storage, and the heaviest on privacy.
- A preferences panel with categories. There is one purpose, so a two-button banner is enough.
- A legal opinion. The wording is plain and conservative; the maintainer owns the compliance call.

## Open
- Whether `on_reject` counts visits before the choice in cookieless mode, as its doc string says ("defaulted to opt-out"). Checked in the browser before the build is called done.
