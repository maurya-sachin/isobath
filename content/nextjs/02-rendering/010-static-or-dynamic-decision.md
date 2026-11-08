---
title: "What decides whether a route is prerendered at build time or rendered per request?"
status: draft
difficulty: hard
frequency: 5
core: true
tags: [rendering, prerendering, dynamic-rendering, cache-components, request-time-apis, next-build]
related:
  - nextjs/rendering/async-request-apis
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/rendering/keeping-route-static
  - nextjs/previous-caching/segment-config-options
  - react/server-rendering/streaming-and-selective-hydration
  - react/server-components/rsc-vs-ssr
verified: 2026-11
perishable:
  - "cacheComponents off by default in Next.js 16.4.5"
  - "create-next-app 16.4 enables cacheComponents and partialPrefetching"
  - "Both options planned to become default in Next.js 17"
  - "Route table symbols ○ ● ◐ ƒ as printed by 16.4.5"
sources:
  - https://nextjs.org/docs/app/getting-started/caching#enabling-cache-components
  - https://nextjs.org/docs/app/getting-started/caching#prerendering
  - https://nextjs.org/docs/app/getting-started/caching#working-with-runtime-apis
  - https://nextjs.org/docs/app/getting-started/caching#random-values-and-timestamps
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#fetchcache
  - https://nextjs.org/docs/app/glossary#request-time-apis
  - https://nextjs.org/docs/app/glossary#prerendering
  - https://nextjs.org/docs/app/api-reference/functions/connection
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
tldr: >
  What the render touches, not the file. Next.js prerenders every route at build time unless rendering
  needs the request. Without Cache Components (16.4's framework default), one `cookies()`, `headers()`,
  awaited `searchParams`, `connection()` or `no-store` fetch makes the whole route dynamic. With
  `cacheComponents: true` the choice is per component: request reads go in `<Suspense>` or `use cache`.
---

## Answer

`next build` tries to render every route (a page plus its layouts) ahead of time. What decides the outcome is what that render touches, and the answer differs between the two rendering models Next.js 16.4.5 ships.

**Without Cache Components** (the framework default: `cacheComponents` is off unless set, though `create-next-app` turns it on) the decision is per route and all-or-nothing. The route renders per request (ƒ) if anything in its tree:

- calls a request-time API: `cookies()`, `headers()`, `draftMode()`, `connection()`, or awaits `searchParams`;
- fetches with `cache: 'no-store'` or `revalidate: 0`;
- sets `dynamic = 'force-dynamic'`, or has a dynamic segment with no `generateStaticParams`.

Everything else is prerendered (○, or ● with `generateStaticParams`), including `Date.now()`, `Math.random()` and a `fetch` with no options: they run once during the build and their values are frozen into the HTML. One `cookies()` in the root layout makes every route dynamic.

**With `cacheComponents: true`** the decision moves to components. Next.js prerenders down the tree until something needs the request or is uncached, which now includes any uncached `fetch`, `Date.now()` and `Math.random()`. Each such read must sit inside `<Suspense>` (its fallback joins the prerendered *static shell* and the content streams per request: Partial Prerendering, ◐) or inside `use cache` (its result joins the shell). A read with neither fails the build. `export const instant = false` accepts a blocking route (ƒ).

So "is this page static?" has a precise answer: read the route table `next build` prints, and the response's `Cache-Control`.

## Example

Next.js 16.4.5, Cache Components off. Each page does what its name says (`/now` renders `Date.now()`, `/fetch-default` calls `fetch` with no options).

```text
Route (app)         Revalidate  Expire
┌ ○ /
├   /blog/[slug]
│ ├ ● /blog/a
│ └ ● /blog/b
├ ƒ /conn
├ ƒ /cookies
├ ○ /fetch-default
├ ƒ /fetch-nostore
├ ○ /fetch-reval            1m      1y
├ ƒ /headers
├ ○ /isr                    1m      1y
├ ƒ /nogsp/[slug]
├ ○ /now
├ ○ /random
└ ƒ /search

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

## Pitfalls

- Assuming `Date.now()` makes a route dynamic. Without Cache Components, `/now` served the same build-time timestamp on every request.
- Wrapping `cookies()` in `<Suspense>` to keep a route static without Cache Components. The route stayed ƒ; only Cache Components turns the boundary into a static/dynamic split.
- Reading `cookies()` in the root layout "just for the theme". Every route below it became ƒ.
- Carrying `dynamic`, `revalidate` or `dynamicParams` exports into a Cache Components app. The 16.4.5 build rejects each: `Route segment config "dynamic" is not compatible with nextConfig.cacheComponents. Please remove it.`

## Follow-ups

**Q:** Is `generateStaticParams` output still marked ● with Cache Components on?
**A:** No. In 16.4.5 the table listed `/blog/a` and `/blog/b` as ○, plus `◐ /blog/[slug]` for the shell used by unlisted slugs. The legend shows only ○, ◐ and ƒ.

**Q:** How can you tell from outside which one you got?
**A:** Static responses carried `Cache-Control: s-maxage=31536000` and `x-nextjs-cache: HIT`; dynamic ones `private, no-cache, no-store, max-age=0, must-revalidate`. Partial ones add `x-nextjs-postponed: 1`.

**Q:** Does a `fetch` with no options make a route dynamic?
**A:** Without Cache Components, only if it runs after a request-time API; before one, it runs once at build. With Cache Components, it is uncached data and must be in `<Suspense>` or `use cache`.

## Deep dive

### How it works

**Default model.** During `next build`, Next.js renders each route's Server Component tree. A request-time API called during that render signals that the output depends on the request, and the route is marked dynamic: no HTML is stored, and every request renders it again. A `fetch` is judged by position: the docs' `fetchCache: 'auto'` rule fetches a request with no `cache` option once at build if it is reached *before* any request-time API, and on every request if reached *after* one. Nothing else is tracked. Clocks, random numbers, file reads and database drivers simply run at build time. In the experiment above, `/fetch-default` showed `fetch 1` on every request (the build's call), while `/fetch-nostore`'s counter rose by one per request.

The decision covers the whole route because the output is one HTML document plus one RSC payload, prerendered or not. Layouts count: a dynamic layout makes all its child routes dynamic.

**Cache Components model.** The same build render now treats three kinds of work as "not known at build time": request data (`cookies()`, `headers()`, `searchParams`, `params` with no `generateStaticParams` value, `connection()`), uncached I/O (`fetch` and other async work outside `use cache`), and unstable values (`Date.now()`, `Math.random()`, `crypto.randomUUID()`). Each must be **handled** where it appears:

- inside `<Suspense>`: the nearest boundary's fallback is prerendered and the subtree is rendered per request, streamed into the same response;
- inside `use cache`: the function or component runs at build time and its result is cached and placed in the shell;
- after `await connection()` (for the unstable values), inside `<Suspense>`.

Unhandled work fails the build with a message naming the route and the fixes. Two kinds of message appeared in 16.4.5, one for request data or uncached I/O and one for unstable values:

```text
Error: Route "/cookies": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.
Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route

Error: Route "/now": Next.js encountered the unstable value `Date.now()` while prerendering.
```

After moving each read into `<Suspense>` or `use cache`, the same build printed:

```text
├ ƒ /blocking
├   /blog/[slug]
│ ├ ◐ /blog/[slug]
│ ├ ○ /blog/a
│ └ ○ /blog/b
├ ◐ /cookies
└ ○ /usecache               15m      1y

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

`/blocking` reads `cookies()` with `export const instant = false`; `/usecache` fetches inside a `use cache` function and gets the default profile's 15-minute revalidation.

### Edge cases

- **Suspense alone isn't a dynamic marker.** The docs say a boundary around purely synchronous work still completes during prerendering; only what's inside it decides.
- **Sync database drivers.** `better-sqlite3` or `node:sqlite` queries complete at build time in both models. Call `connection()` first if the data must be per request.
- **Module-scope reads** (`await readFile` at the top of the module) run once and are not treated as uncached data under Cache Components.
- **`performance.now()`** is not guarded; the docs treat it as telemetry.

### Real-world scenario

A marketing site on the default model reads a `locale` cookie in the root layout. Every page turns ƒ, the CDN gets `private, no-store`, and time to first byte rises on every page. Fixes, by model: move locale into the URL (`[locale]` with `generateStaticParams`) so pages stay ●; or enable Cache Components and read the cookie inside a `<Suspense>` boundary, so only that part streams.

### Trade-offs

The default model is easy to reason about at the route level but coarse: one personalised widget costs the whole page its static HTML. Cache Components gives a static shell to nearly every route, at the price of explicitness: every uncached read needs a boundary or a cache decision, and segment configs (`dynamic`, `revalidate`, `dynamicParams`) are replaced by `use cache`, `cacheLife` and `instant`. The docs say Cache Components will be enabled everywhere in the next major release, with the option removed.
