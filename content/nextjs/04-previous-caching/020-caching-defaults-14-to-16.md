---
title: "How did caching defaults change from Next.js 14 to 15 to 16, and why?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [caching, fetch, route-handlers, router-cache, stale-times, upgrading]
related:
  - nextjs/previous-caching/default-cache-locations
  - nextjs/previous-caching/segment-config-options
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/cache-components/use-cache-vs-other-caches
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
verified: 2026-11
perishable:
  - "cacheComponents off by default in Next.js 16.4.5"
  - "staleTimes still under experimental in 16.4.5"
  - "Root-layout fetchCache skipped on client navigations in 16.4.5"
  - "Cache Components planned as default in Next.js 17"
sources:
  - https://nextjs.org/blog/next-15-rc#caching-updates
  - https://nextjs.org/blog/next-15#caching-semantics
  - https://nextjs.org/docs/app/guides/upgrading/version-15#fetch-requests
  - https://nextjs.org/docs/app/guides/upgrading/version-15#route-handlers
  - https://nextjs.org/docs/app/guides/upgrading/version-15#client-cache
  - https://nextjs.org/docs/app/guides/upgrading/version-16#revalidatetag
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes#version-history
  - https://nextjs.org/docs/app/api-reference/functions/fetch#optionscache
  - https://nextjs.org/docs/14/app/building-your-application/caching
tldr: >
  Next.js 14 cached by default: `fetch` used `force-cache`, GET route handlers were static and
  dynamic pages stayed in the router cache for 30 seconds. 15 flipped all three to uncached, after
  feedback that stale data surprised people. 16 kept those defaults and added opt-in Cache Components,
  where caching is explicit with `use cache`.
---

## Answer

The direction was from "cached unless you opt out" to "uncached unless you opt in".

**Next.js 14.** The docs promised to "cache as much as possible". A `fetch` with no `cache` option used `force-cache` unless the route used a dynamic function or config, so data could stay in the data cache indefinitely. GET route handlers were prerendered at build unless they read the request. The client router cache kept dynamic pages for 30 seconds and static ones for 5 minutes.

**Next.js 15** made all three uncached by default. A `fetch` with no options became `no-store`-like; the 16.4.5 docs call it `auto no cache`: run once at build if the route is static, on every request if it is dynamic. GET handlers render per request. `staleTimes.dynamic` went from 30 to 0, so `<Link>` refetches dynamic pages, though shared layouts, `loading.js` and back/forward still reuse the cache. The release post's reason: feedback on the opinionated defaults, and how they would interact with Partial Prerendering and third-party libraries using `fetch`. A library's internal `fetch` could be cached without its author or user knowing.

**Next.js 16** didn't flip anything back. It added `cacheComponents`, an opt-in model where nothing is cached unless marked `use cache`, and changed caching APIs: `revalidateTag` now takes a `cacheLife` profile as its second argument, with `updateTag` for immediate expiry from Server Actions (per the upgrade guide, not run here). With Cache Components off, 16.4.5 behaves like 15.

Opting back in is per layer: `cache: 'force-cache'` or `next.revalidate` on a fetch, `fetchCache = 'default-cache'` on a segment, `dynamic = 'force-static'` on a handler, `experimental.staleTimes` for the router cache.

The 14 behaviour above is from the 14 docs and the 15 release posts, not run here; the 15 defaults were observed on 16.4.5.

## Example

```jsx
// next.config.mjs
export default {
  experimental: { staleTimes: { dynamic: 30 } },
};

// app/layout.jsx
export const fetchCache = 'default-cache';
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}

// app/api/plain/route.js
export const dynamic = 'force-static';
export async function GET() {
  return Response.json({ t: Date.now() });
}
```

On Next.js 16.4.5 this restored 14-style caching only in part. `next build` listed `○ /api/plain`, and two `curl` calls returned the same `t`. A dynamic page under that layout showed `n=1` from its option-less fetch on every full load, but each fresh client-side navigation to it fetched again (`n=2`, then `n=3`) in Chrome 156 and Firefox 159. Within one tab, `staleTimes.dynamic: 30` made the second `<Link>` click reuse the payload with no request.

## Pitfalls

- Porting the upgrade guide's root-layout `fetchCache = 'default-cache'` and assuming every fetch is cached. Client navigations re-rendered the page without applying it; the same export on the page itself worked.
- Reading 14-era tutorials as current. "fetch is cached by default" has been false since 15.
- Assuming 16 changed the default model. Without `cacheComponents`, the 15 defaults still apply.
- Calling `revalidateTag('posts')` with one argument after upgrading to 16. The upgrade guide says that form is deprecated and a TypeScript error (not run here).

## Follow-ups

**Q:** Did anything stay cached by default in 15?
**A:** Yes. Routes with no request-time reads are still prerendered, and their option-less fetches run once at build. Per the release post, metadata files like `sitemap.ts` stay static unless they read the request (not run here).

**Q:** How does 16.4.5 tell you which model a route used?
**A:** `next build`'s route table: ○ and ● for prerendered, ƒ for per request without Cache Components; ◐ appears only with it.

**Q:** Why not just restore the old defaults with config?
**A:** There's no single switch. Each layer has its own opt-in, and a layout-level `fetchCache` didn't cover client navigations in 16.4.5.
