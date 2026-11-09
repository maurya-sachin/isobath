---
title: "What does Next.js prefetch, and what did Partial Prefetching change?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [navigation, prefetching, partial-prefetching, app-shell, link, cache-components]
related:
  - nextjs/navigation/link-click-to-render
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/cache-components/cachelife-profiles
verified: 2026-11
perishable:
  - "partialPrefetching added in 16.3; requires cacheComponents"
  - "Docs: both flags on by default in the next major"
  - "Next-Router-Prefetch and Next-Router-Segment-Prefetch header values in 16.4.5"
sources:
  - https://nextjs.org/docs/app/guides/prefetching#what-nextjs-prefetches-automatically
  - https://nextjs.org/docs/app/guides/prefetching#prefetch-scheduling
  - https://nextjs.org/docs/app/guides/prefetching#partial-prefetching
  - https://nextjs.org/docs/app/guides/prefetching#triggering-unwanted-side-effects-during-prefetching
  - https://nextjs.org/docs/app/guides/prefetching#hover-triggered-prefetch
  - https://nextjs.org/docs/app/api-reference/components/link#prefetch
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching#how-prefetches-resolve
  - https://nextjs.org/docs/app/guides/adopting-partial-prefetching#what-changes-for-link
  - https://nextjs.org/docs/app/guides/adopting-partial-prefetching#adopting-incrementally
  - https://nextjs.org/docs/app/glossary#app-shell
tldr: >
  In production, a `<Link>` prefetches when it enters the viewport: a static route in full, a dynamic
  one only up to `loading.js` (or just metadata), or its static shell under Cache Components.
  Partial Prefetching (16.3) prefetches one URL-independent App Shell per route, shared by every link
  to it, and stops `prefetch={true}` from fetching uncached data.
---

## Answer

Prefetching runs only in production builds; under `next dev` the same page made no prefetch requests, even on hover. A `<Link>` prefetches when it enters the viewport, and again on hover if what it fetched has expired. `prefetch={false}` turns both off. What gets fetched depends on the route and the config:

- **Without Cache Components:** a static route is prefetched in full. A dynamic route gets everything down to its nearest `loading.js`; with none, only its route tree and `<head>` metadata. `prefetch={true}` renders the whole route, dynamic data included, at prefetch time.
- **Cache Components on, `partialPrefetching: false`:** a dynamic route's prerendered static shell is prefetched, so it needs no `loading.js`. `prefetch={true}` is still the full render.
- **`partialPrefetching: true`** (16.3+, requires Cache Components; `next build` fails without it): the default prefetch is the route's **App Shell**, its static and cached output that doesn't depend on `params` or `searchParams`. Every link to `/p/[id]` shares one shell. `prefetch={true}` adds that link's URL data and the cached content behind it, but no longer prefetches uncached data; that streams after the click.

Requests go per segment: first the route tree, then each segment the client lacks, marked by `Next-Router-Prefetch` and `Next-Router-Segment-Prefetch` headers.

On a page with 20 links to `/p/1`…`/p/20` (Next.js 16.4.5, `next start`, the same counts in Chrome 156 and Firefox 159), prefetch requests to `/p/*`:

- Cache Components off: 24 (4 route trees, then 20 per-link metadata requests)
- on, `partialPrefetching: false`: 8 (4 trees, 4 copies of the same page shell)
- on, `partialPrefetching: true`: 5 (4 trees, 1 shared shell)

The docs say both flags become the default, and are removed, in the next major.

## Example

```jsx
// next.config.mjs
export default { cacheComponents: true, partialPrefetching: true };

// app/many/page.jsx
import Link from 'next/link';
export default function Page() {
  const ids = Array.from({ length: 20 }, (_, i) => i + 1);
  return ids.map((i) => <Link key={i} href={`/p/${i}`}>product {i}</Link>);
}

// app/p/[id]/page.jsx
import { Suspense } from 'react';
async function Item({ params }) {
  const { id } = await params;
  return <p>item {id}</p>;
}
export default function Page({ params }) {
  return (
    <main>
      <h1>product</h1>
      <Suspense fallback={<p>loading item…</p>}><Item params={params} /></Suspense>
    </main>
  );
}
```

With both flags on, the page made one shell request, `next-router-segment-prefetch: /p/$d$id/__PAGE__`, 3,346 bytes holding the heading and `loading item…`. Clicking `/p/7` showed the fallback at once and `item 7` from one more request.

## Pitfalls

- Doing side effects in a layout or page. With `prefetch={true}` and Partial Prefetching off, the server log showed the dynamic component rendering at prefetch time, before any click.
- Expecting `prefetch={true}` to keep prefetching uncached data after turning on `partialPrefetching`. It doesn't; cache the data or let it stream.
- Using `prefetch={false}` to mean "prefetch on hover". It disables hover too. The docs' pattern starts at `false` and switches to `null` in `onMouseEnter`; with Partial Prefetching, `'auto'` before hover and `true` after.
- Judging prefetching in `next dev`, where it doesn't run at all.

## Follow-ups

**Q:** When does a prefetched route get fetched again?
**A:** When its data has expired and the link is hovered. A static page fetched at load was fetched again on hover at 312 s, not at 272 s: the 5-minute default. Invalidations such as `revalidatePath` refetch at once.

**Q:** What does `prefetch={true}` add with Partial Prefetching on?
**A:** A second request per link, `next-router-prefetch: 2` with that URL's state tree. For `/p/2` it returned `item 2` already rendered, so the click needed nothing else for that boundary.

**Q:** Can you adopt it one route at a time?
**A:** Yes, per the docs, not run here: with the global flag off, `export const prefetch = 'partial'` from a page or layout opts that route in. A codemod removes those exports once the flag is on.

**Q:** Where do cookies fit?
**A:** Per the docs, not run here: `cookies()` and `headers()` vary per session, not per link, so their output can be in the App Shell, which the client then caches per session.
