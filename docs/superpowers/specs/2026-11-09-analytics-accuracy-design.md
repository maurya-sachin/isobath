# isobath analytics: trustworthy numbers, visitor interest, lean dashboard

## Context

PostHog (EU, cookieless until consent) went live on 2026-11-09. The maintainer wants exact visitor numbers, to see what visitors read, search and study, a dashboard that shows only that, all inside the free tier, without being overwhelming. Executed afterwards by a Sonnet session; this plan carries every decision.

What the data and a live check showed (measured 2026-11-09, PostHog SQL over the last 3 days, host `learn.sachinmaurya.com`):

- **Desktop data is mostly missing.** Desktop sent 57 `$pageview` and nothing else (no `$autocapture`, `$web_vitals`, `$pageleave`, `$dead_click`). Mobile sent all of them (43 autocapture, 17 web vitals, 10 dead clicks, 5 pageleave, 2 `$opt_in`).
- **Cause: ad-block filter lists.** In the maintainer's real Chrome, `fetch('https://eu.i.posthog.com/i/v0/e/')` fails with "Failed to fetch" (blocked by the client) and so does `eu-assets.i.posthog.com/static/1.447.4/dead-clicks-autocapture.js`, while `/e/` reaches the server. A clean headless Chrome gets HTTP 200 on all of them, desktop and mobile UA alike. posthog-js sends the first pageview to `/e/` and every later event (route-change pageviews, clicks, web vitals, page-leave) in batches to `/i/v0/e/`. Developers on desktop mostly run blockers, so their visits record one pageview and nothing else.
- **So today's bounce rate (89%) and session duration (26 s) are artifacts**: without `$pageleave` a one-pageview visit has no duration and counts as a bounce.
- **Bundle regression.** PostHog is ~345 KB raw / ~117 KB gzip inside the entry chunk `dist/assets/index-*.js` (802 KB, 44% of it). `vite.config.ts` documents the main chunk at 453 kB with `chunkSizeWarningLimit: 470`, so the analytics work pushed it past the warning. `consentStore.ts` imports posthog-js statically, so it ships even in key-less builds.
- **Already changed in PostHog (no code):** project timezone Asia/Kolkata (UTC+5:30), week starts Monday; session recording off; heatmaps limited to 3 URL patterns; starter dashboard filtered to the live host.

## Definitions to keep in mind (for the maintainer)

- **Bounce rate**: PostHog: "a session where the user only had one pageview, no autocaptures, and spent less than 10 seconds on the page" (threshold in Settings → Web analytics). Only `$autocapture` prevents a bounce; custom events, web vitals and dead clicks don't.
- **P75 / P90 / P99**: sort all visits from best to worst; P75 is the value 75% of visits meet or beat (Google's Core Web Vitals threshold), P90 the value 90% meet, P99 the near-worst case (noise on a small site).
- **Unique visitors (cookieless)**: `hash(daily salt, team, IP, root domain, user agent)`; the salt rotates at the visitor's local midnight. Same person on two days, or after an IP change, counts twice; two people behind one IP with the same browser can count once. After Accept, a cookie id makes returning visitors visible.
- **Map/country**: cookieless events lose the IP before enrichment, so they get no GeoIP; the map only reflects visitors who accepted cookies.

## Maintainer's choices (2026-11-09)

- Named events are counted for **every visitor, anonymously** (cookieless like pageviews), not only after Accept.
- Search records the **typed words**, cut to 80 characters; the privacy page says so.
- Own visits are excluded with a **public "Don't count my visits on this device" switch on `/privacy`**.

## Decisions (made here; Sonnet does not revisit them)

1. **First-party proxy** (fixes the desktop gap). PostHog requests go through `learn.sachinmaurya.com/<neutral path>` via `vercel.json` rewrites, so filter lists that block `*.posthog.com` or `/i/v0/e/` no longer apply. The CSP then needs no PostHog host at all (`connect-src 'self'`, `script-src 'self'`). Path: `/soundings` (see Proxy facts).
2. **Load PostHog after the page is interactive** (fixes the bundle regression) with a dynamic `import('posthog-js')` scheduled after hydration. Keeps the public import path. Rejected: the "slim" build (needs `posthog-js/dist/...` deep imports and the `@internal` `__extensionClasses` option).
3. **Six named events plus three super properties**, through one typed `track()` (catalogue below). Everything else stays automatic (pageviews, clicks, scroll depth, web vitals, errors, dead clicks, heatmaps). No per-keystroke or per-slider-step events.
4. **"Don't count my visits on this device"** switch on `/privacy`. It also excludes the maintainer's own visits (anonymous visitors cannot be filtered by person). Off = PostHog never loads on that device; turning it off mid-visit drops events at once via `before_send`.
5. **Dashboard: one page, seven tiles**, built after the code is live and a few days of clean data exist; the starter dashboard is deleted only with the maintainer's OK.
6. **Not doing now:** session replay, surveys, slim build, source-map upload (no production errors yet; revisit when Error tracking shows real ones), cross-device identity, Global Privacy Control handling, giscus comment tracking (giscus gives no "comment posted" signal).

## Event catalogue (the only custom events)

Naming (PostHog best practices): lowercase `snake_case`, `object_verb` in the present tense, booleans prefixed `is_`/`has_`. Properties never hold personal data; search text is cut to 80 characters.

| Event | When | Properties | Hook |
|---|---|---|---|
| `search_complete` | once per search dialog session, when it closes with a non-empty query (selected or dismissed) | `query` (trimmed, ≤ 80 chars), `results` (0–8), `selected_id` (question id or null), `rank` (1-based or null) | `src/components/SearchDialog.tsx`: `handleOpenChange` (:89) and the inline `onSelect` (:126). Replace the shortcut's updater `setOpen((isOpen) => !isOpen)` (:82) with `handleOpenChange(!open)` (no side effect inside a state updater), and funnel all closes through one `close(selected?)`. Skip the event while the search engine has not loaded (else 0 results would be a false content gap) |
| `flashcard_rate` | each rating | `topic`, `rating` (`again`/`hard`/`good`/`easy`), `is_new_card` (bool) | `src/pages/FlashcardsPage.tsx` `rate` (:63-69); `count` label and `reviews[card.id]` are in scope |
| `flashcard_session_finish` | the last card of a round is rated | `topic`, `rated`, `round` | in `rate` (:63-69) when the queue after this rating is empty; pass `round` down from `FlashcardsPage` (it lives there, `Session` only gets `isLaterRound`). From the handler, not an effect: no ref, no StrictMode double-fire |
| `practice_answer` | Got it / Missed it | `question_id`, `result` (`knew`/`missed`) | `src/pages/PracticePage.tsx` `record(gotIt)` (:90) |
| `practice_session_finish` | the last question is marked | `topic`, `chapter`, `knew`, `missed` | in `record` when `position + 1 === questions.length`; pass `topic`/`chapter` slugs down from `PracticePage` (:167-168). Works again after "Practice again" (`restart`, :84) because it is handler-driven |
| `exercise_reveal` | an exercise answer is revealed | `question_id`, `exercise` (exercise title) | `src/components/question/Exercises.tsx` reveal (:23); pass `questionId` down from `QuestionPage` (:175) |
| `consent_decline` | Decline clicked | none | `chooseConsent(false)` in `src/lib/consentStore.ts` (Accept already sends PostHog's own `$opt_in`) |

Super properties on every event: `theme` (`light`/`dark`/`system`), `reading_font`, `text_size`. Registered at load from new exported readers `getTheme()` (`src/lib/theme.ts`) and `getAppearance()` (`src/lib/appearanceStore.ts`), and registered again from `setTheme` / `setAppearance` so a mid-visit change is reflected. They answer "what settings do readers use" without extra events. Not identifying.

Already automatic and used as-is: "Suggest a fix", "Propose an edit", Previous/Next and backup buttons are captured by autocapture (`$autocapture` with element text and href).

Free-tier budget: ~220 events/day now; with desktop restored and the events above, estimate < 1,500/day ≈ 45k/month against 1M. Check Billing → Usage after a week.

## Tasks (branch `dev`; one concern per commit; run the gate after each code task)

Gate (in `app/`): `npm test`, `npm run lint`, `npx tsc -b`, `npm run format:check`, `npm run content:check`, `npm run build`. Never push or merge without the maintainer's OK each time (global CLAUDE.md).

**T0. Record the design.** Copy this plan to `docs/superpowers/specs/2026-11-09-analytics-accuracy-design.md` (approved design) and add one line to `docs/superpowers/specs/2026-11-09-cookie-consent-design.md` saying PostHog traffic goes through the same-origin `/soundings` path. Commit `docs: analytics accuracy design`.

**T1. Load PostHog after hydration** (`src/lib/analytics.ts`, `src/lib/consentStore.ts`, `src/main.tsx`).
- `analytics.ts` becomes the only module that touches posthog-js, and only through `import('posthog-js')`; others use `import type { PostHog } from 'posthog-js'` at most (today only `analytics.ts` and `consentStore.ts` import it).
- API added here: `loadAnalytics(): void` (no key → returns; otherwise `requestIdleCallback` with a `setTimeout(…, 1)` fallback, `import()`, `init` with the existing options, notify; a failed import is caught and logged once, never an unhandled rejection), `getAnalytics(): PostHog | null`, `onAnalyticsReady(listener): () => void`. `analyticsEnabled` unchanged.
- `consentStore.ts`: no static posthog import; `isPromptOpen` is false until `getAnalytics()` is non-null; `subscribe` also listens to `onAnalyticsReady`; `chooseConsent` calls through `getAnalytics()`.
- `main.tsx`: call `loadAnalytics()` after `hydrateRoot`/`render`; replace the "before the first render" comment.
- Pass: the entry chunk named in `dist/index.html` does not contain `$lib_version` (a posthog-js-only string; `__ph_opt_in_out` stays in app code, don't grep it), another chunk does; no Vite chunk-size warning; browser checks in Verification. Commit `perf(app): load PostHog after hydration`.

**T2. First-party proxy** (`vercel.json`, `src/lib/posthogHost.ts`, `scripts/lib/csp.ts`, `scripts/lib/csp.test.ts`, `src/lib/analytics.ts`, `vite.config.ts`).
- `vercel.json`: the three rewrites from "Proxy facts", in order, before the app-shell rewrites.
- `posthogHost.ts`: replace `POSTHOG_API_HOST`/`POSTHOG_ASSETS_HOST` and the file comment with `POSTHOG_PROXY_PATH = '/soundings'` and `POSTHOG_UI_HOST = 'https://eu.posthog.com'`; `init` uses `api_host: POSTHOG_PROXY_PATH, ui_host: POSTHOG_UI_HOST`.
- CSP, TDD: first change `csp.test.ts` (drop the host imports; assert the policy contains no `posthog` substring and `connect-src 'self'` exactly), watch it fail, then remove the hosts from `csp.ts`.
- Local parity: `vite.config.ts` `server.proxy` (also used by `vite preview`) mirroring the three rewrites in the same order with `changeOrigin: true` and a `rewrite` that strips `/soundings`, so T3/T4 browser checks work locally.
- Preview proof: **ask the maintainer to approve pushing `preview/analytics-proxy`** and adding `VITE_POSTHOG_KEY` to the Vercel *Preview* environment; run T2 checks in Verification. Commit `feat(app): send analytics through a first-party path`.

**T3. Event catalogue** (`src/lib/analyticsEvents.ts` new, pure; `scripts/lib/analyticsEvents.test.ts` new; `analytics.ts`; hooks named in the catalogue; `theme.ts`, `appearanceStore.ts` readers).
- `analyticsEvents.ts`: no DOM, no posthog, no import from `theme.ts` (it would pull DOM types into `tsconfig.node.json`); define the theme union locally. Exports the `AnalyticsEvent` union, one builder per row (`searchComplete`, `flashcardRate`, `flashcardSessionFinish`, `practiceAnswer`, `practiceSessionFinish`, `exerciseReveal`, `consentDecline`; builders may return `null`, e.g. an empty query) and `superProperties(appearance, theme)`.
- `analytics.ts` gains `track(event: AnalyticsEvent | null): void`: ignores null; no-op when `!analyticsEnabled` (T4 adds the opt-out); queues until loaded, flushes on ready; `loadAnalytics` registers super properties after `init`. Export `registerDisplaySettings()` for `setTheme`/`setAppearance` to call.
- TDD: query trimmed and cut to 80 chars; empty/whitespace query → null; rank 1-based; rating 1–4 → `again`/`hard`/`good`/`easy`; super properties map the appearance shape exactly.
- Wire hooks (catalogue table), incl. `consent_decline` in `chooseConsent(false)`. Commits per area: `feat(app): analytics events for search`, `… for flashcards and practice`, `… for exercises and consent`.

**T4. Device opt-out and privacy text** (`src/lib/analyticsOptOut.ts` new browser-only store, `src/lib/analytics.ts`, `src/lib/consentStore.ts`, `src/components/ConsentBanner.tsx`, `src/pages/PrivacyPage.tsx`).
- Store: `localStorage['isobath:analytics'] = 'off'`, `useSyncExternalStore` with server snapshot `null`, try/catch like `appearanceStore.ts`; export `deviceOptedOut(): boolean` and `setDeviceOptOut(off: boolean)`.
- Effects of "off": `loadAnalytics` returns early; `init` gets `before_send: (event) => (deviceOptedOut() ? null : event)` (stops sending at once mid-visit); `track` treats `!analyticsEnabled || deviceOptedOut()` as disabled (no endless queue); `isPromptOpen` returns false (closes an open banner); `CookieSettingsButton` hides.
- `/privacy`: labelled checkbox "Don't count my visits on this device", shown when `analyticsEnabled`, after `useHydrated()` with its space reserved before hydration (style notes). Rewrite the now-false sentences: :35-36 ("progress and flashcard history … never sent anywhere": the history stays in the browser, but study actions are counted anonymously) and :23 ("the only thing kept is one local-storage entry": now the choice and, if used, this switch). Add searched words, study actions and display settings to "What is counted", and one sentence on the `/soundings` path. Keep the page's tone.
- Commit `feat(app): let visitors stop analytics on their device`.

**T5. Review and release.** Whole-branch review by a fresh reviewer (`reviewer` agent, model opus) against this plan; fix Critical/Important with a failing test first. Then the release procedure (memory `release-procedure`) **only after the maintainer says "release"**, and the live checks in Verification.

**T6. PostHog workspace (after ~3 days of post-release data; browser or PostHog MCP).**
- New dashboard "isobath — weekly", filters `Host = learn.sachinmaurya.com` and `Is bot = false` (PostHog's bot filter is opt-in), date range last 7 days, seven tiles:
  1. Visitors and pageviews per day (last 30 days).
  2. Most-read questions: `$pageview` count by `$pathname` where the path has three segments and does not start with `/practice`, `/flashcards`, `/cheatsheet`, `/paths` (top 15).
  3. Where visitors come from: unique visitors by `$referring_domain` and `utm_source`.
  4. Searches: `search_complete` by `query`, with columns for count and `results = 0` count (content gaps).
  5. Study: `flashcard_rate` by `topic` and `rating`; `practice_answer` with `result = missed` by `question_id` (most-missed questions).
  6. Exercises revealed by `question_id`.
  7. Reading settings: unique visitors by `theme`, `reading_font`, `text_size`.
- Pin it; replace the starter dashboard **only with the maintainer's OK** (deleting it is irreversible). Offer the weekly email subscription (Subscribe button; free plan allows up to 5) and annotations for past posts (free) (dates in memory `public-presence`); both need the maintainer's yes.
- Update memory `posthog-analytics` with the proxy path, events and dashboard id.

**T7. Maintainer habits (no code).** Tag share links: `?utm_source=linkedin&utm_medium=social&utm_campaign=<post-slug>` (and `devto`, `github`). Check Web analytics weekly with "Last 7 days", not "Today". Read P75 for web vitals.

## Proxy facts (PostHog docs, https://posthog.com/docs/advanced/proxy/vercel, read 2026-11-09)

- EU rewrites, in this order (static, then array, then catch-all), before the existing app-shell rewrites in `vercel.json`:
  ```json
  { "source": "/soundings/static/:path(.*)", "destination": "https://eu-assets.i.posthog.com/static/:path" },
  { "source": "/soundings/array/:path(.*)", "destination": "https://eu-assets.i.posthog.com/array/:path" },
  { "source": "/soundings/:path(.*)", "destination": "https://eu.i.posthog.com/:path" }
  ```
- Init: `api_host: '/soundings'`, `ui_host: 'https://eu.posthog.com'` ("The `ui_host` must point to PostHog's actual domain so features like the toolbar link correctly").
- Path name: the docs say not to use `/analytics`, `/tracking`, `/telemetry` or `/posthog` ("Blockers will catch them. Use something unique to your app instead"). Chosen: `/soundings` (depth soundings, fits isobath).
- Cost: proxied traffic is billed by Vercel as Fast Data Transfer and Edge Requests; session recordings are the main driver and are off here, so event volume (< 1,500/day estimated) stays small.
- Cookies: the proxy forwards request headers including cookies; this domain sets no auth cookies (only PostHog's own after Accept), so nothing sensitive is forwarded.
- Visitor IP: Vercel forwards `x-forwarded-for` / `x-real-ip` to external rewrite origins (https://vercel.com/docs/routing/rewrites, "Identifying the visitor at your origin"), and PostHog's capture service reads the leftmost forwarded IP (proxy reference: "Forward `X-Forwarded-For` to preserve client IPs"). Still confirmed end to end on the preview (Verification, T2 step 3) because cookieless ids depend on it.
- `trailingSlash: false` in `vercel.json` may answer `/soundings/e/`-style paths with a 308 before the rewrite (Vercel docs; ordering unverified). Check the Network tab on the preview: if 308s appear, events still arrive but each costs two CDN requests; report it, don't change `trailingSlash` (it governs every page URL).
- Hobby allowances (https://vercel.com/docs/plans/hobby): 1,000,000 CDN requests, 100 GB Fast Data Transfer per month; usage over the limit pauses the feature for 30 days, so check Vercel → Usage a week after release.
- Alternative not chosen: PostHog's managed reverse proxy needs a DNS record (a subdomain), and a first-party subdomain is still caught by blockers that uncloak CNAMEs; a same-origin path is not.

## Verification (evidence, not inference)

- **T1 local** (`VITE_POSTHOG_KEY=<key> npm run build`, `npx vite preview`): the entry chunk named in `dist/index.html` has no `$lib_version` (posthog-js only); Vite prints no chunk-size warning; in Chrome the first `$pageview` request leaves after hydration, the banner appears, a client-side link click sends a second pageview, Accept/Decline still write/clear storage as in the cookie-consent spec. Delete the test build afterwards (`dist/` is gitignored, but rebuild without the key before any release check).
- **T2 on the Vercel preview** (after the maintainer approves the push):
  1. In the maintainer's real Chrome (with its blocker), on the preview page run `const r = await fetch('/soundings/i/v0/e/', {method: 'POST', body: '{}'}); [r.status, r.redirected, r.url]`: expect an HTTP status (400), not "Failed to fetch". If `r.redirected` is true (the `trailingSlash: false` 308), accept only if the slash-less PostHog path answers the same and note each batch then costs two CDN requests; otherwise stop and report. Same for `/soundings/static/1.447.4/dead-clicks-autocapture.js` (200).
  2. Click two links and wait 10 s; in PostHog SQL: `select event, count() from events where properties.$host = '<preview host>' and timestamp > now() - interval 1 hour group by event` must list `$autocapture`, `$pageleave` or `$web_vitals`, not only `$pageview`.
  3. IP reaches PostHog: on the preview, click Accept, browse one page, then check that event's `$geoip_country_code` (PostHog → Activity → event properties). Expect the maintainer's country (IN). If it shows the Vercel region's country or is empty, **stop and report**: cookieless visitors would collapse into one id behind the proxy.
  4. Remove `VITE_POSTHOG_KEY` from the Preview environment afterwards if the maintainer wants preview traffic kept out.
- **T3**: `npm test` covers builders; in the browser (key build, `vite preview` with the T2 proxy) each catalogue action produces exactly one event with the listed properties (PostHog Activity → Live, or SQL on the last 15 minutes). Search: dismissing with Esc, selecting with Enter, and closing with ⌘K each send one `search_complete`.
- **T4**: switch off → no further `/soundings` requests (before_send) and the banner and Cookie settings button disappear; reload → still none; switch on → reload → requests resume. UI bar from global CLAUDE.md for the new checkbox: Chrome and Firefox at 375/768/1024/1440, light and dark, keyboard only, 145% text, axe-core clean (inject axe as in this session: strip the CSP meta from one built page in `dist/` and serve it locally).
- **After release**: re-run the Context SQL (`event, device` counts on `learn.sachinmaurya.com`): desktop now shows `$autocapture`, `$pageleave`, `$web_vitals`. Bounce rate and session duration in Web analytics should move off 89% / 26 s within a few days; report the before/after numbers, not a guess.

## Critical files

- `app/src/lib/analytics.ts`, `app/src/lib/consentStore.ts`, `app/src/main.tsx`, `app/src/lib/posthogHost.ts`
- `vercel.json`, `app/scripts/lib/csp.ts`, `app/scripts/lib/csp.test.ts`
- new: `app/src/lib/analyticsEvents.ts`, `app/scripts/lib/analyticsEvents.test.ts`, `app/src/lib/analyticsOptOut.ts`
- hooks: `app/src/components/SearchDialog.tsx`, `app/src/pages/FlashcardsPage.tsx`, `app/src/pages/PracticePage.tsx`, `app/src/components/question/Exercises.tsx`, `app/src/pages/QuestionPage.tsx`, `app/src/pages/PrivacyPage.tsx`
- reuse: `appearanceStore.ts` (try/catch storage pattern), `useHydrated.ts`, `lib/theme.ts`, `lib/appearance.ts` (settings shape), `scripts/lib/csp.ts` `contentSecurityPolicy`

## Execution notes for the Sonnet session

- Order: T0 → T1 → T2 (stops for the preview-push OK) → T3 → T4 → T5 (stops for "release") → T6 later → T7.
- A blocked step (no OK yet) does not block the next independent task: T3 and T4 can proceed while T2 waits for the preview.
- Use the `superpowers:executing-plans` skill; the final whole-branch review runs on Opus.

