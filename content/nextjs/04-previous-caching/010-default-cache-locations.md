---
title: "Without Cache Components, what does Next.js cache, and where?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [caching, data-cache, full-route-cache, router-cache, fetch, isr]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/previous-caching/caching-defaults-14-to-16
  - nextjs/previous-caching/segment-config-options
  - nextjs/previous-caching/fetch-request-deduplication
  - nextjs/cache-components/use-cache-vs-other-caches
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/mutations/isr-and-on-demand-revalidation
  - nextjs/deployment/multi-instance-hosting
verified: 2026-11
perishable:
  - "cacheComponents off by default in Next.js 16.4.5"
  - "fetch default is 'auto no cache' in 16.4.5"
  - "staleTimes still experimental: dynamic 0 s, static 300 s"
  - "16.4.5 docs no longer name Data Cache or Full Route Cache"
  - "Chapter turns legacy when Cache Components becomes default (17)"
sources:
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#caching-fetch-requests
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#unstable_cache-for-non-fetch-functions
  - https://nextjs.org/docs/app/api-reference/functions/fetch#optionscache
  - https://nextjs.org/docs/app/api-reference/functions/fetch#memoization
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
  - https://nextjs.org/docs/app/glossary#client-cache
  - https://nextjs.org/docs/14/app/building-your-application/caching
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/patch-fetch.ts
tldr: >
  Four places, named by the Next.js 14 docs. Per render, identical `GET` fetches are memoized in
  memory. The data cache keeps opted-in `fetch` responses and `unstable_cache` results in
  `.next/cache/fetch-cache`. The full route cache keeps static routes' HTML and RSC payload in
  `.next/server/app`. The browser's router cache keeps RSC payloads. In 16.4.5 data is cached only on request.
---

## Answer

With `cacheComponents` off (the Next.js 16.4.5 framework default), the cache is still the four layers the Next.js 14 docs named, though the 16.4.5 docs mostly drop the names.

1. **Request memoization** (server, one render). Identical `GET` `fetch` calls during one render share one response. It is in memory and gone when the render ends.
2. **Data cache** (server, across requests and deploys). Stores `fetch` responses that opt in with `cache: 'force-cache'` or `next.revalidate`, and `unstable_cache` results. Under `next start` it is one JSON file per entry in `.next/cache/fetch-cache`, with its `revalidate` and `tags`.
3. **Full route cache** (server, across requests). A route prerendered at build time is stored as `.html`, `.rsc` and `.meta` files under `.next/server/app` and served without rendering. Responses carry `x-nextjs-cache: HIT` and `Cache-Control: s-maxage=…`. A static GET route handler is stored the same way (`.body` and `.meta`).
4. **Router cache** (browser memory, the docs' "Client Cache"). RSC payloads of visited and prefetched routes. Since 15, dynamic pages are refetched on every `<Link>` navigation (`staleTimes.dynamic` is 0); static pages are reused for 5 minutes; back/forward always restores.

The layers are independent. A dynamic route (no full route cache) can still read a `force-cache` fetch from the data cache, and a static route keeps whatever its build-time fetches returned until it is revalidated.

What is *not* cached matters as much: since 15, a `fetch` with no `cache` option runs once at build if the route is static, and on every request if it is dynamic. GET route handlers render per request unless they opt in.

*Legacy:* in Next.js 14, `fetch` defaulted to `force-cache`, GET handlers were static by default and dynamic pages stayed in the router cache for 30 seconds.

## Example

```jsx
// lib/api.js
export async function n(path, init) {
  const r = await fetch(`http://localhost:4999${path}`, init);
  return (await r.json()).n;
}

// app/default/page.jsx
export default async function Page() {
  return <p>default={await n('/default')} t={Date.now()}</p>;
}

// app/force/page.jsx
import { cookies } from 'next/headers';
export default async function Page() {
  await cookies();
  return <p>force={await n('/force', { cache: 'force-cache' })} t={Date.now()}</p>;
}

// app/nostore/page.jsx
export default async function Page() {
  return <p>nostore={await n('/nostore', { cache: 'no-store' })}</p>;
}
```

The API at port 4999 counts hits per path. On Next.js 16.4.5 (`next build && next start`), two requests each gave: `/default` `default=1` with the same build-time `t` both times (full route cache, `x-nextjs-cache: HIT`); `/force` `force=1` but a new `t` each time (dynamic route, data cache hit); `/nostore` `1`, then `2`.

## Pitfalls

- Equating "dynamic route" with "fresh data". `/force` re-rendered per request, but its `force-cache` fetch never left the data cache.
- Assuming a fetch with no options is in the data cache. In a dynamic route it hit the API on every request, even one placed before `cookies()`.
- Expecting a static page to pick up new data on its own. With no `revalidate`, `/default` served its build-time value with `s-maxage=31536000`.
- Expecting the router cache to keep dynamic pages. Every `<Link>` click to a dynamic page fetched a new payload; only back/forward reused one.

## Follow-ups

**Q:** How do you empty each layer?
**A:** Memoization ends with the render. `revalidateTag(tag, 'max')` or `revalidatePath` marks data and route entries stale: the next request was served stale and triggered a refetch, the one after showed new data. Per the docs (not run here) they also clear the router cache, as a reload does.

**Q:** Do these caches survive `next start` restarts?
**A:** The data and full route caches are files under `.next`, so yes. On several instances each has its own copy unless a shared `cacheHandler` is configured (per the docs, not run here).

**Q:** Does Draft Mode read the data cache?
**A:** No. The `fetch` docs say Draft Mode bypasses it entirely, neither reading nor writing (per the docs, not run here).

## Deep dive

### How it works

Every server-side `fetch` in the App Router goes through Next's patched `fetch` (`patch-fetch.ts`). For each call it picks a `revalidate` value from the `cache` and `next.revalidate` options, the segment configs and whether the render is a build-time prerender. A finite or `false` value means the response goes into the incremental cache's `FETCH` entries; `0` means it doesn't. Each entry is a file named by a hash of the request:

```text
{"kind":"FETCH","data":{"headers":{…},"body":"eyJuIjoxLCJrZXkiOiIvcmV2YWwifQ==","status":200,
"url":"http://localhost:4999/reval"},"revalidate":10,"tags":["r"]}
```

That entry came from `fetch(url, { next: { revalidate: 10, tags: ['r'] } })`. Per the docs (not run here), a request matches on URL, method, headers and body, and only `200` responses are stored.

Above the data cache sits the rendered output. When `next build` prerenders a route, it writes the HTML, the RSC payload and a `.meta` file with the headers it will send and the route's cache tags (implicit ones per layout and page, plus any `fetch` tags):

```text
"x-nextjs-stale-time": "300",
"x-nextjs-prerender": "1",
"x-next-cache-tags": "_N_T_/layout,_N_T_/reval/layout,_N_T_/reval/page,_N_T_/reval,r"
```

So `revalidateTag('r', 'max')` reaches both the data entry and every route that used it. The route's own lifetime is the lowest `revalidate` in it, shown by `next build` (`○ /reval 10s 1y`) and by its headers:

```text
x-nextjs-cache: STALE
Cache-Control: s-maxage=10, stale-while-revalidate=31535990
```

`STALE` means the server sent the old page and regenerated it in the background, which is how ISR works without Cache Components.

Request memoization sits beside both. Next wraps `fetch` in a dedupe layer keyed by URL, method and headers inside a React `cache` scope, so it lasts one render (see the dedup question).

In the browser, the router cache holds RSC payloads. A headless test (Chrome 156 and Firefox 159, same result) loaded a static page, clicked to a dynamic page, back to the static one and to the dynamic one again. The dynamic page was requested again with a new timestamp; the static page was served from its prefetch with no new request; `goBack` and `goForward` made no requests and showed the earlier timestamps.

### Edge cases

- **The build fetch cache isn't the data cache you think.** An option-less fetch reached during `next build` was written to `fetch-cache` with `revalidate: 31536000` even on a route that later turned dynamic. The source calls this an implicit build-time cache, shared between build workers. At request time the same fetch hit the API every time.
- **`unstable_cache`** results live in the same `fetch-cache` folder. A fetch *inside* it is treated as `force-no-store` (per the source, not run here); the wrapper's own entry does the caching.
- **Route handlers.** `export const dynamic = 'force-static'` on a GET handler produced `○ /api/static` and `.body`/`.meta` files; without it, `ƒ /api/plain` ran per request.
- **Development.** `next dev` renders pages on every request, and its HMR cache can reuse even `no-store` fetches between edits (per the docs, not run here). Test caching with `next build && next start`.

### Real-world scenario

A product page reads `cookies()` for the cart badge and fetches the catalogue with no options. The team sees the API hit on every page view and assumes Next "isn't caching". It isn't: the route is dynamic, and since 15 an option-less fetch in a dynamic render is uncached. Adding `{ next: { revalidate: 300, tags: ['catalogue'] } }` to the catalogue fetch moves it into the data cache, while the cart badge stays per request. Calling `revalidateTag('catalogue', 'max')` from the admin Server Action refreshes it on the next view.

### Trade-offs

Separate layers let you mix lifetimes: a static shell from the full route cache, a tagged data entry for minutes, and uncached per-user reads. The cost is that freshness is spread over four places with different keys and lifetimes, and the default answer to "is this cached?" depends on whether the route happens to be dynamic. Cache Components replaces the data and full route layers with explicit `use cache` scopes; the docs say it becomes the default in the next major release.
