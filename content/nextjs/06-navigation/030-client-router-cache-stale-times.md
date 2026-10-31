---
title: "How long does the client router reuse a page, and what do `staleTimes` control?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [navigation, client-cache, stale-times, prefetching, revalidation, cache-life]
related:
  - nextjs/navigation/link-click-to-render
  - nextjs/navigation/prefetch-and-partial-prefetching
  - nextjs/navigation/state-retained-on-back-navigation
  - nextjs/cache-components/cachelife-profiles
  - nextjs/mutations/revalidation-apis-compared
  - browser/navigation/back-forward-cache
verified: 2026-11
perishable:
  - "staleTimes still experimental in 16.4.5"
  - "Defaults: static 300 s, dynamic 0 s (since 15.0)"
  - "x-nextjs-stale-time header carries the stale time (16.4.5)"
sources:
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes#version-history
  - https://nextjs.org/docs/app/glossary#client-cache
  - https://nextjs.org/docs/app/guides/prefetching#client-cache
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#client-cache-behavior
  - https://nextjs.org/docs/app/api-reference/functions/use-router#userouter
  - https://nextjs.org/docs/app/api-reference/functions/cookies#understanding-cookie-behavior-in-server-functions
tldr: >
  The router keeps RSC payloads in memory. A static or prefetched page is reused for 5 minutes
  (`staleTimes.static`); a dynamic page for 0 seconds (`staleTimes.dynamic`), so every `<Link>` visit
  asks the server again. Back and Forward always reuse what was shown. An action that revalidates or
  sets a cookie, or `router.refresh()`, empties the cache.
---

## Answer

The App Router's **client cache** holds the RSC payloads of prefetched and visited routes, keyed by segment, in the tab's memory. A reload empties it. How long an entry may be reused on a `<Link>` navigation is its stale time:

- **`static`, default 300 s:** prerendered pages, `loading.js` UI, and anything prefetched with `prefetch={true}` or `router.prefetch()`.
- **`dynamic`, default 0 s:** a dynamic page you visited. Every new visit fetches it again. *Legacy:* this was 30 s until Next.js 15.0.

Both are set under `experimental.staleTimes` in `next.config`; the build lists it under "Experiments (use with caution)". The server sends the value with each response (`x-nextjs-stale-time: 300`). With Cache Components, a page's `cacheLife` `stale` sets it per route: a page with `stale: 45` got `x-nextjs-stale-time: 45`.

Expiry is lazy. An expired prefetch is fetched again when the link is hovered; an expired page is fetched again when you navigate to it.

**Back and Forward ignore stale times.** They restore what was on screen from memory, even a dynamic page with `dynamic: 0`.

The cache is emptied, not just for the route touched, when a Server Action calls `revalidatePath` or `updateTag` or sets a cookie: visible links were prefetched again straight away. `router.refresh()` did the same for their page segments. The `cacheLife` docs also list an action's `refresh()`, but in the mutations chapter's test it caused no new prefetches.

I checked these on Next.js 16.4.5 under `next start`, with Cache Components on and off (the same results), in Chrome 156 and Firefox 159. Expiry timings ran in Chrome only.

## Example

```jsx
// next.config.mjs
export default {
  experimental: { staleTimes: { static: 30, dynamic: 30 } },
};

// app/d/page.jsx: dynamic
import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
async function Now() {
  await connection();
  return <p>t={Date.now()}</p>;
}
export default function Page() {
  return (
    <main>
      <Link href="/">home</Link>
      <Suspense fallback={<p>loading…</p>}><Now /></Suspense>
    </main>
  );
}
```

Going `/` → `/d` → `/` → `/d` by links: with the defaults, the second visit to `/d` made a new request and showed a new `t`. With `dynamic: 30`, it made no request and showed the same `t`; after 35 s idle, it fetched again. A static link prefetched at load was fetched again on hover after 42 s with `static: 30`, and after 312 s (not 272 s) with the default.

## Pitfalls

- Raising `staleTimes.dynamic` for speed without thinking about freshness. Every page then shows data up to that old, unless an action invalidates it.
- Expecting a stale time to refresh a page in the background. Nothing happened while idle; the refetch waited for a hover or a navigation.
- Calling `router.refresh()` on a timer. Its docs say it clears the cache for the current route, but each call also made both browsers re-prefetch every visible link's page.
- Confusing this with the browser's back/forward cache. That keeps a whole document for a cross-document Back; this is the router's memory within one document.

## Follow-ups

**Q:** Does `revalidatePath('/s')` clear only `/s`?
**A:** No. After an action called it, both browsers re-prefetched every visible link, `/d` as well as `/s`. A no-op action caused no prefetch requests at all.

**Q:** Are shared layouts fetched again when a page's entry is stale?
**A:** No. The navigation request lists the segments the client has, and the server skips the layouts above the changed page. The docs note that `staleTimes` doesn't change this.

**Q:** How does `staleTimes.static` relate to `cacheLife`?
**A:** Per the docs, not run here: setting `staleTimes.static` also changes the `stale` of the `default` cache profile, and `cacheLife` enforces a 30-second minimum `stale` so a prefetch can't expire before the click.
