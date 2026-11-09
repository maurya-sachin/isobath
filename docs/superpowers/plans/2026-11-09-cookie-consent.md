# Cookie consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PostHog use cookies only after a visitor accepts, keep counting everyone cookieless otherwise, and let the visitor change the choice.

**Architecture:** `analytics.ts` configures PostHog with `cookieless_mode: 'on_reject'` and `opt_out_persistence_by_default: true`; PostHog itself stores the choice. A small browser-only store exposes whether the banner is open; a `ConsentBanner` in `Layout` renders it and a footer button reopens it. A short `/privacy` page says what is collected. The prerendered pages' CSP is widened for PostHog's EU hosts first, because today it blocks them.

**Tech Stack:** React 19, react-router 8, posthog-js 1.447.4, Tailwind with the repo's `ui/button`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-09-cookie-consent-design.md` (mockup: `docs/superpowers/specs/mockups/cookie-consent.html`).

## Global Constraints
- Prerendered pages never read `window`, `document` or storage at module load or during the first render; browser-only state goes through `useSyncExternalStore` with a server snapshot, and the banner appears only after `useHydrated()` is true. Every prerendered page renders a `<title>`.
- Analytics is off without `VITE_POSTHOG_KEY`: no banner, no footer button, no PostHog calls.
- Accept and Decline: one style, size and weight, Decline first. Colours only from theme tokens (no literals). Button borders use `border-input` (the default outline border is 1.29:1 and fails 3:1).
- Copy, verbatim. Heading: `Anonymous analytics`. Body: `Accept to let us recognise returning visitors and see where readers come from. If you decline, your visit is still counted, with no cookies and nothing stored on your device.` followed by a `Privacy` link to `/privacy`. Buttons: `Decline`, `Accept`. Footer button: `Cookie settings`.
- Prettier style (no semicolons, single quotes, 120 columns); modules shared by `src/` and `scripts/` import relatively with `.ts` extensions; commit each concern separately with conventional messages; never push.

## Review Focus
- Storage blocked (private mode, `localStorage` throws): banner still works for the visit, no crash. Test: browser, with storage blocked.
- JavaScript disabled or prerendered HTML: no banner markup in the HTML. Test: grep a built page for `Anonymous analytics`.
- Key unset (dev, CI, forks): nothing renders, no PostHog request. Test: build without the key, load a page, check network and DOM.
- Accept then reopen then Decline: PostHog stops using cookies and local storage, not just future events. Test: browser, inspect cookies and storage after Decline.
- Text at 145% and a landscape phone (667x375): the banner scrolls inside itself instead of covering the page, and it does not overlap the "Suggest a fix" selection bar at 1024 or 375 px.

---

### Task 1: Let the CSP allow PostHog

Without this the committed analytics is blocked on every prerendered page (`connect-src 'self'`, no PostHog in `script-src`).

**Files:**
- Create: `app/src/lib/posthogHost.ts`
- Modify: `app/scripts/lib/csp.ts`, `app/src/lib/analytics.ts`
- Test: `app/scripts/lib/csp.test.ts`

**Interfaces:**
- Produces: `POSTHOG_API_HOST = 'https://eu.i.posthog.com'` and `POSTHOG_ASSETS_HOST = 'https://eu-assets.i.posthog.com'` (both `string` constants) exported from `posthogHost.ts`, imported relatively with `.ts` by `csp.ts` and via `@/lib/posthogHost` by `analytics.ts`.

- [ ] **Step 1: Write the failing test** in `csp.test.ts`: `allows PostHog's EU hosts for requests and its extension scripts, and nothing else new` asserts `connect-src` contains `'self'`, `POSTHOG_API_HOST` and `POSTHOG_ASSETS_HOST`; `script-src` contains `POSTHOG_ASSETS_HOST`; `script-src` still has no `unsafe`; `default-src` is still `'self'`.
- [ ] **Step 2: Run** `cd app && node --test scripts/lib/csp.test.ts`. Expected: FAIL on the new test.
- [ ] **Step 3: Implement** `posthogHost.ts`; use both constants in `contentSecurityPolicy` (`script-src` gets the assets host, `connect-src` gets both); make `analytics.ts` use `POSTHOG_API_HOST` for `api_host`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npx tsc -b`. Expected: all pass.
- [ ] **Step 5: Verify in a browser** (production build served with `npm run preview`, a temporary `VITE_POSTHOG_KEY` in the build environment, not committed): open a page, read the console. Expected: no `Content-Security-Policy` violations and requests to both PostHog hosts succeed. If a further host is reported, add it to `posthogHost.ts` and the test.
- [ ] **Step 6: Commit** `fix(app): allow PostHog's EU hosts in the page CSP`.

### Task 2: Consent configuration and store

**Files:**
- Modify: `app/src/lib/analytics.ts`
- Create: `app/src/lib/consentStore.ts`

**Interfaces:**
- Produces from `analytics.ts`: `analyticsEnabled: boolean` (key present).
- Produces from `consentStore.ts`: `useConsentPromptOpen(): boolean` (false on the server, false when analytics is disabled, true while PostHog's explicit consent is `'pending'` or the visitor reopened it), `chooseConsent(granted: boolean): void` (calls `posthog.opt_in_capturing()` or `posthog.opt_out_capturing()`, closes the prompt, notifies subscribers), `reopenConsent(): void`.

- [ ] **Step 1: Change the init config** in `initAnalytics`: `cookieless_mode: 'on_reject'` and `opt_out_persistence_by_default: true` replace `'always'`; export `analyticsEnabled`.
- [ ] **Step 2: Implement `consentStore.ts`** as a browser-only module (no import from shared modules): module-level `reopened` flag and a listener set, `useSyncExternalStore` with `subscribe`, a snapshot that returns a boolean computed from `posthog.get_explicit_consent_status() === 'pending' || reopened`, and a server snapshot of `false`. Wrap nothing in try/catch beyond what PostHog needs; PostHog already tolerates blocked storage.
- [ ] **Step 3: Verify** `npx tsc -b && npm run lint`. Expected: pass.
- [ ] **Step 4: Commit** `feat(app): consent-aware PostHog config and prompt store`.

### Task 3: Banner and footer button

**Files:**
- Create: `app/src/components/ConsentBanner.tsx`
- Modify: `app/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `useConsentPromptOpen`, `chooseConsent`, `reopenConsent`, `analyticsEnabled`, `useHydrated`, `Button` from `@/components/ui/button`.
- Produces: `ConsentBanner(): JSX.Element | null` and `CookieSettingsButton(): JSX.Element | null`, both exported from `ConsentBanner.tsx`.

- [ ] **Step 1: Implement `ConsentBanner`**: returns `null` unless hydrated and the prompt is open; a `<section>` with `aria-labelledby`, classes `print:hidden` and, at `md` and up, `fixed bottom-4 left-4 w-[380px]`, below that `fixed inset-x-2 bottom-2`; `max-h` set so it scrolls inside (`overflow-y-auto`) in a 375px-tall viewport; tokens `bg-card text-card-foreground border rounded-xl shadow-lg p-4`; buttons `Decline` then `Accept`, each `variant="outline"` with `h-10 flex-1 border-input`. The copy is the Global Constraints copy.
- [ ] **Step 2: Focus**: when opened by `reopenConsent`, move focus to the heading (`tabIndex={-1}`); after `chooseConsent` from a reopened state, return focus to the footer button. The first-visit banner never takes focus.
- [ ] **Step 3: Implement `CookieSettingsButton`**: `null` when `!analyticsEnabled`; otherwise a `button` styled like the footer links (`text-link hover:text-link-hover underline`) that calls `reopenConsent`. Mount both in `Layout.tsx`: the banner after `<Outlet />`, the button and a `Privacy` link after the `GitHub` link in the footer.
- [ ] **Step 4: Resolve overlap with the "Suggest a fix" selection bar**: read its component, then check both at 1024 and 375 px; use the smallest change that stops the overlap and record it in a code comment.
- [ ] **Step 5: Verify** `npx tsc -b && npm run lint && npx prettier --check src`. Expected: pass.
- [ ] **Step 6: Commit** `feat(app): analytics consent banner and cookie settings button`.

### Task 4: Privacy page

**Files:**
- Create: `app/src/pages/PrivacyPage.tsx`
- Modify: `app/src/routes.tsx` (route `privacy`, lazy like `changelog`, no loader), `app/scripts/prerender.ts` (entry `{ path: '/privacy', description, type: 'website', image: site }` next to `/changelog`)

**Interfaces:**
- Produces: `PrivacyPage(): JSX.Element` rendering `<title>{`Privacy · ${SITE_NAME}`}</title>` inside `PageShell crumbs={[]}`.

- [ ] **Step 1: Write the page**, plain short sentences, no hype: what is counted (page views, clicks, scroll heatmaps, errors, page speed); that without consent nothing is stored on the device and the IP address is not kept; what accepting adds (a cookie and local storage so returning visitors are recognised, and country and city); that PostHog processes it in the EU; how to change the choice (`Cookie settings` in the footer); the repository link for the code.
- [ ] **Step 2: Verify** `npm run build`. Expected: pass, and `dist/privacy.html` exists with a `<title>`; `sitemap.xml` lists `/privacy` if the prerender builds it from this list (if it does not, say so in the commit body).
- [ ] **Step 3: Commit** `feat(app): privacy page`.

### Task 5: Verify in real browsers

- [ ] **Step 1:** Run the repo gate in `app/`: `npm test`, `npm run lint`, `npm run format:check`, `npm run content:check`, `npm run build`. Expected: all pass.
- [ ] **Step 2:** Serve the production build with a test `VITE_POSTHOG_KEY` and check, in Chrome and Firefox: before any choice, events are sent and no PostHog cookie or storage key is written; Accept writes them and a reload keeps the same visitor; Decline writes none; reopen then Decline removes what Accept wrote.
- [ ] **Step 3:** At 375, 768, 1024, 1440 px, light and dark, keyboard only, 145% text: no horizontal overflow, no console errors, axe-core clean, contrast per the spec numbers; a landscape 667x375 viewport.
- [ ] **Step 4:** Report what was and was not tested (Safari and real devices were not). Mark the spec's open question answered or changed.
- [ ] **Step 5: Commit** any fixes found, each as its own commit, and delete the finished items from `PLAN.md` Now if it lists this work.
