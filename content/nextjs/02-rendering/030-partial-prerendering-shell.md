---
title: "What is Partial Prerendering, and what ends up in the static shell?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [rendering, partial-prerendering, static-shell, cache-components, streaming, suspense]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/async-request-apis
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/cache-components/cachelife-profiles
  - react/server-rendering/streaming-and-selective-hydration
  - react/server-components/rsc-vs-ssr
verified: 2026-11
perishable:
  - "PPR enabled only through cacheComponents in Next.js 16"
  - "cacheLife thresholds: expire under 5 min, stale under 30 s"
  - "HTML-limited bot list in Next.js 16.4.5"
sources:
  - https://nextjs.org/docs/app/getting-started/caching#prerendering
  - https://nextjs.org/docs/app/getting-started/caching#streaming-uncached-data
  - https://nextjs.org/docs/app/glossary#partial-prerendering-ppr
  - https://nextjs.org/docs/app/glossary#static-shell
  - https://nextjs.org/docs/app/glossary#app-shell
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#prerendering-behavior
  - https://nextjs.org/docs/app/guides/streaming#bots-and-crawlers
  - https://nextjs.org/docs/app/guides/upgrading/version-16#partial-prerendering-ppr
tldr: >
  Partial Prerendering, the rendering model of Cache Components, prerenders one HTML document per
  route at build time with holes in it. The static shell holds static markup, `use cache` results and
  the `<Suspense>` fallbacks around request-time work. A request gets the shell at once; the server
  renders only the holes and streams them into the same response.
---

## Answer

**Partial Prerendering (PPR)** splits one route into a part rendered at build time and a part rendered per request. In Next.js 16 it is what `cacheComponents: true` does; there is no separate flag.

At `next build`, Next.js renders the route's tree. Work that completes goes into HTML. When a subtree needs the request or uncached data, React renders the nearest `<Suspense>` fallback instead and **postpones** that boundary, saving where it stopped. The result is the **static shell**:

- layouts and static markup;
- results of `use cache` functions and components, unless their lifetime is short (`cacheLife('seconds')` makes a hole);
- content for `params` values listed by `generateStaticParams`;
- the fallbacks of postponed boundaries.

Not in the shell: anything that reads `cookies()`, `headers()`, `searchParams`, unlisted `params` or `connection()`, does uncached I/O, or calls `Date.now()`/`Math.random()` outside a cache. Those must be inside `<Suspense>`, or the build fails.

On a request, the server sends the stored shell immediately, then resumes the postponed boundaries with the real request and streams each result as hidden HTML plus a script that swaps it in for its fallback. It is one HTTP response (`x-nextjs-postponed: 1`), and the browser paints the shell before any request-time work finishes. The shell also exists as an RSC payload, used for client navigations and prefetches.

This differs from plain streaming server rendering: streaming alone still renders the static parts on every request, while PPR rendered them once at build.

*Legacy:* PPR was `experimental.ppr` in Next.js 15 canaries; 16.0 removed that flag in favour of `cacheComponents`.

## Example

```jsx
// app/ppr/page.jsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';

async function Prices() {
  'use cache';
  cacheLife('hours');
  const res = await fetch('http://localhost:4999/prices');
  return <p>prices v{(await res.json()).n}</p>;
}

async function Cart() {
  const id = (await cookies()).get('cart')?.value ?? 'empty';
  await new Promise((r) => setTimeout(r, 2000));
  return <p>cart {id}</p>;
}

export default function Page() {
  return (
    <main>
      <h1>Store</h1>
      <Prices />
      <Suspense fallback={<p>Loading cart…</p>}>
        <Cart />
      </Suspense>
    </main>
  );
}
```

Next.js 16.4.5, `next build && next start`: the route built as `◐ /ppr`, and the prerendered `ppr.html` held the heading, `prices v7` (fetched during the build) and `Loading cart…`. The cart arrived about 2 seconds later in the same response.

## Pitfalls

- Expecting `<Suspense>` to mean "dynamic". A boundary around work that completes at build time is just prerendered; only request-time or uncached work inside it is postponed.
- Putting a short-lived cache outside `<Suspense>`. `cacheLife('seconds')` is excluded from prerenders, so in 16.4.5 it failed the build with the "uncached or runtime data" error; inside a boundary it became a hole.
- Awaiting `params` at the top of a page. For unlisted params the shell is empty: the `[slug].html` fallback shell was 0 bytes.
- Testing behind a buffering proxy. Nginx and some CDNs collect the whole response, so the shell arrives with the holes; the docs suggest `X-Accel-Buffering: no`.

## Deep dive

### How it works

The build stores three things per partial route: the shell HTML (`ppr.html`), its RSC segments for navigation, and a `.meta` file whose `postponed` field holds React's serialized resume state (`replayNodes` ending in `"Suspense",1,[],0,["Suspense Fallback"…]`). At request time, `next start` sends the shell bytes, then calls React's resume with that state and the live request. Only the postponed boundaries render; everything above them is not re-executed. The test API logged exactly two `/prices` calls across all runs: one from the build, one from a bot request (see Edge cases).

Reading the response chunk by chunk with `fetch` in Node 24 (cookie `cart=abc`):

```text
55ms status 200
62ms +966B <main><h1>Store</h1><p>prices v<!-- -->7</p><!--$?--><template id="B:0"></template><p>Loading cart…</p><!--/$--></main>
82ms +4358B
85ms +4041B
2093ms +100B
2095ms +73B
2095ms +912B <div hidden id="S:0"><p>cart <!-- -->abc</p></div>
2096ms +14B
```

The headers were `x-nextjs-prerender: 1`, `x-nextjs-postponed: 1` and `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, because the full response contains per-user content. The `B:0` template marks the hole, `S:0` carries its content, and the following `$RC("B:0","S:0")` call swaps them; that's React's streaming protocol, not something Next.js adds.

In headless Chrome 156 and Firefox 159, a MutationObserver saw `Loading cart…` at 27 ms and 16 ms, and `cart empty` at 2301 ms in both.

### Edge cases

- **Cache lifetime decides shell membership.** The `cacheLife` docs: `revalidate: 0` or `expire` under 5 minutes is excluded from prerenders (a dynamic hole); `stale` under 30 seconds is too; `stale` between 30 seconds and 5 minutes is prerendered but left out of the App Shell used for prefetching. Of the presets, only `seconds` is affected. `/short` with `cacheLife('seconds')` inside `<Suspense>` built as ◐ with `ticker loading` in the shell.
- **Unknown params get the App Shell.** For a dynamic segment, Next.js also prerenders a URL-independent shell (`◐ /blog/[slug]` in the route table) whose param-dependent parts are fallbacks. It's only useful if `params` is awaited inside `<Suspense>`, not at the top of the page.
- **HTML-limited bots skip the shell.** Next.js matches the user agent against a list (`Twitterbot`, `facebookexternalhit`, `Slackbot`, `Bingbot` and others; not `Googlebot`, which got the shell). A `Twitterbot` request carried no `x-nextjs-postponed` header and showed `prices v10`: the cached component ran again at request time. The docs warn that data the shell needs at build time must also be reachable at request time, or the page fails only for crawlers.
- **The shell's data is as old as the build** until revalidated: `prices v7` stayed while the API's counter moved on.

### Real-world scenario

A product page: name, images and description are `use cache` with `cacheTag('product-123')`; price and stock are short-lived; the cart badge and "recommended for you" read cookies. With PPR the browser paints everything but price, stock and the personalised parts from the shell, and fallbacks sized like the real content keep the swap from shifting layout. The same page without Cache Components is fully dynamic because of one cookie read.

### Trade-offs

PPR gives nearly every route instant first bytes, but the shell is only as good as the tree's structure: an `await` high in a layout empties it, so the work is pushing request reads down into small boundaries. Fallbacks are visible UI and need design. Under `next start` the combined response is `private, no-store`, so a generic CDN in front cannot cache the shell; serving it from the edge relies on a platform that stores the shell and resumes the render separately. Streaming also needs every layer between server and browser to pass chunks through unbuffered.
