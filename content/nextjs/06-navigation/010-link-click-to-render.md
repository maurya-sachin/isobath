---
title: "What happens between clicking a `<Link>` and the new page appearing?"
status: draft
difficulty: hard
frequency: 5
core: true
tags: [navigation, link, prefetching, rsc-payload, router, client-cache]
related:
  - browser/navigation/history-api-routing
  - react/concurrent-rendering/transitions
  - react/suspense/suspense-and-transitions
  - nextjs/app-router/layout-state-and-template
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/navigation/prefetch-and-partial-prefetching
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/navigation/state-retained-on-back-navigation
verified: 2026-11
perishable:
  - "RSC, Next-Router-State-Tree, Next-Url request headers in 16.4.5"
  - "_rsc query value as a header hash, 307 on mismatch (16.4.5)"
  - "Dynamic routes without loading.js prefetch metadata only (16.4.5)"
sources:
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#client-side-transitions
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#prefetching
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#dynamic-routes-without-loadingtsx
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#slow-networks
  - https://nextjs.org/docs/app/api-reference/components/link#onnavigate
  - https://nextjs.org/docs/app/api-reference/components/link#transitiontypes
  - https://nextjs.org/docs/app/guides/prefetching#prefetching-static-vs-dynamic-routes
  - https://nextjs.org/docs/app/glossary#client-cache
tldr: >
  `<Link>` cancels the browser's navigation and starts a router transition. The router shows what
  it already prefetched (a whole static page, or a dynamic page's shell and loading UI), pushes the
  URL, and fetches the rest as an RSC payload for only the segments below the shared layouts. With
  nothing prefetched, the old page stays until the server answers.
---

## Answer

`<Link>` renders a real `<a>`, so it works without JavaScript and opens new tabs. Once hydrated, it intercepts a plain left click: `preventDefault()`, then the App Router navigates inside a React transition. No HTML document is requested.

The router first checks its **client cache**. While the link was in the viewport it prefetched the route's tree and whatever segments it could:

- **Static route:** the whole page. The click commits from memory, no request.
- **Dynamic route with a `loading.js`, or with Cache Components:** the shared layouts plus the loading UI or static shell. The router commits that at once, pushes the URL, and requests the rest.
- **Dynamic route with neither:** only metadata. The old page stays on screen, as in any transition, until the server answers; the URL changes then too.

The request is `GET /d?_rsc=…` with `RSC: 1` and a `Next-Router-State-Tree` header listing the segments the client already holds. The server renders only the segments below the deepest shared layout and streams them back as an RSC payload (`text/x-component`); the layouts come back empty.

The router then merges that into its tree. Shared layouts aren't re-rendered on the client, so their state survives; the page segment is swapped in, Suspense boundaries fill as chunks arrive, and Next.js scrolls to the new page if it's out of view. With Cache Components the old route is hidden with `<Activity>` instead of unmounted.

I timed this in Chrome 156 with 400 ms of added latency, Next.js 16.4.5 under `next start`. Without Cache Components, a link to a dynamic page with no `loading.js` changed the URL and the screen after 410 ms; with `loading.js` the fallback appeared after 5 ms. With Cache Components the shell appeared after 6 ms.

## Example

```jsx
// app/d/page.jsx: dynamic, no loading.js
import { Suspense } from 'react';
import Link from 'next/link';
import Now from '../_c/now';
export default function Page() {
  return (
    <main>
      <h1>d</h1>
      <Link href="/">home</Link>
      <Suspense fallback={<p>loading d…</p>}><Now /></Suspense>
    </main>
  );
}

// app/_c/now.jsx: request-time, 800 ms
import { connection } from 'next/server';
export default async function Now() {
  await connection();
  await new Promise((r) => setTimeout(r, 800));
  return <p>t={Date.now()}</p>;
}

// app/dl/loading.jsx: /dl is the same page, but awaits <Now /> directly
export default function Loading() {
  return <p>loading dl (loading.js)…</p>;
}
```

From `/`, with Cache Components off and 400 ms latency in Chrome: clicking `/d` left the home page visible until 410 ms, then showed `loading d…` and `t=` at 809 ms. Clicking `/dl` showed its loading UI at 5 ms and the page at 810 ms. Each click made one non-prefetch `GET ?_rsc` request and no document request.

## Pitfalls

- Expecting `<Suspense>` inside a page to make a dynamic route feel instant. Without Cache Components only `loading.js` is prefetched; the in-page fallback arrived with the server's response.
- Testing navigation in `next dev`. Automatic prefetching only runs in production builds, so dev timings mislead.
- Calling a navigation slow when the server is. The request waits for the server render of every segment below the shared layout; slow data belongs inside a Suspense boundary.
- Using `<a href>` for internal links. It loads a new document and loses all client state.

## Follow-ups

**Q:** Why is the URL still the old one while a slow page loads?
**A:** With nothing to show, the router keeps the old UI inside a transition and commits URL and tree together. I watched `pushState` fire at 410 ms, with the response. When a shell or loading UI was cached, `pushState` fired within 7 ms.

**Q:** How do you show progress on that slow click?
**A:** `useLinkStatus()` inside the link returns `pending: true` while its navigation is in flight (per the docs, not run here). Better still, add `loading.js` or Cache Components so the click commits at once.

**Q:** Do layouts re-render on the server?
**A:** No. The navigation response for `/d` held the page segment's tree; the root layout's entry was `"r":null`. The state tree header told the server what to skip.

## Deep dive

### How it works

The prefetch and navigation requests, from a Chrome request log on `next start` (Cache Components on, trimmed):

```text
GET /d?_rsc=5CB68i4pnAekjehf  rsc=1 next-router-prefetch=1 next-router-segment-prefetch=/_tree next-url=/
GET /d?_rsc=5DLj9ndsnH3jzETe  rsc=1 next-router-prefetch=1 next-router-segment-prefetch=/d/__PAGE__ next-url=/
  (click)
GET /d?_rsc=vkeXZpkQjgg3d_yp  rsc=1 next-router-state-tree=… next-url=/
-> 200 text/x-component
   Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
   Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
```

Prefetching is per segment: the route tree first, then each segment the client lacks (here only the page; the root layout was already loaded). Per the docs, sibling routes reuse a cached parent layout. The click's request carries the state tree, URL-encoded JSON of the client's segments, with the page marked `"refetch"`. The response body (trimmed):

```text
3:[["children",{"s":"__PAGE__","d":{"r":["$","$4","c",{"children":[["$","main",null,{"children":[["$","h1",null,{"id":"h","children":"d"}],…,["$","$8",null,{"fallback":["$","p",null,{"id":"fb","children":"loading d…"}],"children":"$L9"}]]}],…
2:[["children",{"s":"d","d":{"r":null,"p":true,"v":null},"c":"$Q3"}]]
0:{…,"t":{"t":{"s":"","d":{"r":null,"p":true,"v":null},"c":"$Q2"},…},…}
```

Row 0 is the envelope; layouts the client already has are `"r":null`, and the page's tree contains `"$L9"`, a reference to a row streamed later, which fills the Suspense boundary when the server finishes.

The `_rsc` value isn't random: every link with the same router headers sent the same value, whatever its path. Sending a wrong one got `307` with a `location` carrying the right one. Together with `Vary` it keeps an RSC payload and the HTML for the same URL apart in HTTP caches.

The router commits the new tree in a transition and calls `history.pushState`. Back and Forward restore earlier trees from memory: going forward to `/d` made no request and showed the same `t`.

### Edge cases

- **Without Cache Components**, a link to a dynamic route with no `loading.js` was still "prefetched": the request carried `next-router-state-tree` ending in `"metadata-only"` and returned 832 bytes of route tree and `<head>` data, no UI. That's what the docs mean by "skipped".
- **`prefetch={false}`** made no request on viewport entry or hover; the click to a static page then waited for its round trip (413 ms at 400 ms latency).
- **Cache Components on, `partialPrefetching` on or off:** the dynamic page's shell was prefetched either way, so the fallback appeared at once. The server never ran `<Now />` for an automatic prefetch.
- **Chrome and Firefox agreed** on request order and on fallback and content timings within 20 ms. The added latency was Chrome-only: Firefox under Puppeteer's BiDi protocol has no network emulation.

### Real-world scenario

An account area built without Cache Components reads cookies in every page, so every route is dynamic and none has `loading.js`. Users click a sidebar link and nothing happens for a second, then the page jumps in; some click twice. Adding `app/account/loading.js` makes every child route prefetch the layout and skeleton: the click commits immediately and the sidebar stays interactive. Turning on Cache Components goes further, prefetching each page's own static shell.

### Trade-offs

Client-side navigation keeps shared layouts mounted and sends only the changed segments, but every dynamic visit still costs a server render, and an instant-feeling click depends on what was prefetched. Prefetching costs bandwidth and server work for links never clicked; `prefetch={false}` saves that but brings the round trip back.
