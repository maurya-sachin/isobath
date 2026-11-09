---
title: "How does ISR serve a stale page, and what does on-demand revalidation do across instances?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [isr, revalidation, stale-while-revalidate, self-hosting, cache-handler]
related:
  - nextjs/mutations/revalidation-apis-compared
  - nextjs/previous-caching/default-cache-locations
  - nextjs/previous-caching/segment-config-options
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/cache-components/cachelife-profiles
  - nextjs/deployment/multi-instance-hosting
  - nextjs/deployment/next-build-output
verified: 2026-11
perishable:
  - "Runtime ISR writes go to .next/server/route-cache in 16.4.5"
  - "In-memory cache in front of disk, 50 MB default"
  - "x-nextjs-cache values HIT, STALE, MISS, REVALIDATED"
  - "Revalidation is per instance without a shared cacheHandler"
sources:
  - https://nextjs.org/docs/app/guides/incremental-static-regeneration#time-based-revalidation
  - https://nextjs.org/docs/app/guides/incremental-static-regeneration#on-demand-revalidation-with-revalidatepath
  - https://nextjs.org/docs/app/guides/incremental-static-regeneration#caveats
  - https://nextjs.org/docs/app/guides/how-revalidation-works#multi-instance-considerations
  - https://nextjs.org/docs/app/guides/self-hosting#caching-and-isr
  - https://nextjs.org/docs/app/api-reference/functions/revalidateTag#revalidation-behavior
  - https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
tldr: >
  A prerendered page is served from cache until its `revalidate` time passes. The next request
  still gets the old page (`x-nextjs-cache: STALE`) and starts a background regeneration; later
  requests get the new one. On-demand calls mark entries stale on the instance that ran them only.
  Other instances keep serving their copies until a shared cache handler tells them.
---

## Answer

ISR is stale-while-revalidate for whole routes (shown here with `cacheComponents` off, the default). A route with `export const revalidate = 10` is prerendered by `next build` (`○ /isr 10s 1y`) and served from the server cache with `Cache-Control: s-maxage=10, stale-while-revalidate=31535990`.

Inside the window, responses are `x-nextjs-cache: HIT`. Once the entry is older than 10 seconds, nothing happens until a request arrives. That request **still gets the old page**, marked `STALE`, and starts a regeneration in the background. When it finishes, the new page replaces the entry and the next request is a `HIT` with new data. So freshness lags by one request, and nobody waits for a render. Per the docs (not run here), if regeneration throws, the last good page keeps being served and the next request retries.

**On-demand revalidation** skips the timer. A route handler (or Server Action) calls `revalidatePath('/isr')` or `revalidateTag('v', 'max')`. In my runs, after `revalidatePath` the next request was a `MISS` that rendered fresh data; after `revalidateTag(…, 'max')` the next requests were `STALE` until the background render finished.

**Across instances, it doesn't propagate.** The cache and its tag state live in each process: memory in front of the `.next` folder on disk. A call reaches only the instance that received it. I ran three `next start` processes: A and B on the same build folder, C on a copy. After `revalidatePath` on A, A served the new page; B and C kept serving the old one with `HIT`. To make revalidation global you configure a shared `cacheHandler` whose tag index lives in Redis or similar, so a call on one instance invalidates entries on all.

All of this was Next.js 16.4.5, `next build && next start`, Node 24.19.0.

## Example

```jsx
// app/isr/page.jsx
export const revalidate = 10;

export default async function Page() {
  const { v, hits } = await (await fetch('http://localhost:4999/v', { next: { tags: ['v'] } })).json();
  return <p id="out">v={v} hits={hits} rendered={new Date().toISOString()}</p>;
}

// app/api/reval/route.js
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== process.env.REVALIDATE_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const tag = searchParams.get('tag');
  if (tag) revalidateTag(tag, 'max');
  else revalidatePath(searchParams.get('path') ?? '/');
  return Response.json({ ok: true, at: Date.now() });
}
```

After the API's value changed from 20 to 21, two `curl` requests 11 seconds after the last regeneration gave `v=20 … STALE` then `v=21 … HIT`. With the interval raised to an hour, `POST /api/reval?path=/isr&secret=…` on A made A's next response `MISS` with the new value, while B and C answered `v=20` with `HIT`, still three seconds later.

## Pitfalls

- Expecting the page to change when the timer expires. Regeneration needs a request, and that request gets the old page.
- Sending on-demand revalidation through a load balancer. It lands on one instance; the others serve stale pages until their own `revalidate` time runs out.
- Assuming instances on a shared disk share the cache. B, on A's folder, kept serving its in-memory copy; only after a restart did it read the page A had written.
- Leaving the revalidation endpoint unauthenticated. Anyone could force re-renders; the secret check above returned `401` without it.

## Follow-ups

**Q:** Where did the regenerated page go on disk?
**A:** Not over the build output: `.next/server/app/isr.html` kept the build-time value. A wrote it to `.next/server/route-cache/APP_PAGE/<hash>/$/isr.html` with `.rsc`, `.meta` and segment files, which is what B read after restarting.

**Q:** Why can a CDN serve the stale page too?
**A:** The `s-maxage` and `stale-while-revalidate` directives are for shared caches. Per the docs (not run here), a CDN in front must cache the HTML and RSC responses together and respect `Vary`, or navigations can mix renders.

**Q:** What replaces this with Cache Components on?
**A:** `use cache` with `cacheLife` sets the lifetimes, and unlisted `generateStaticParams` values get the App Shell first, then a cached page. On-demand calls are the same functions with the same per-instance limit.
