---
title: "How does `generateMetadata` interact with streaming and request dedup?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [generate-metadata, streaming, html-limited-bots, memoization, react-cache]
related:
  - nextjs/previous-caching/fetch-request-deduplication
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/app-router/loading-error-not-found-boundaries
  - nextjs/navigation/redirect-and-notfound-control-flow
verified: 2026-11
perishable:
  - "Metadata streaming since 15.2; htmlLimitedBots default list as of 16.4.5"
  - "Googlebot not in htmlLimitedBots; it gets streamed metadata"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/generate-metadata#generatemetadata-function
  - https://nextjs.org/docs/app/api-reference/functions/generate-metadata#streaming-metadata
  - https://nextjs.org/docs/app/api-reference/functions/generate-metadata#with-cache-components
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots#default-list
  - https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/shared/lib/router/utils/html-bots.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/shared/lib/router/utils/is-bot.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/streaming-metadata.ts
  - https://html.spec.whatwg.org/multipage/dom.html#the-title-element-2
  - https://react.dev/reference/react/cache
tldr: >
  On a per-request page, browsers get the shell without waiting for `generateMetadata`; its
  `<title>` and `<meta>` tags stream in later, inside `<body>`. User agents matching `htmlLimitedBots`
  (Bingbot, facebookexternalhit, but not Googlebot) wait and get them in `<head>`. A `fetch` shared
  with the page is one request; other data sources need React's `cache`.
---

## Answer

`generateMetadata` resolves as part of rendering the page, so where its tags land depends on when the page renders.

**Prerendered routes.** Metadata is resolved at build and written into `<head>`. A `force-static` page with a `no-store` fetch in `generateMetadata` had its `<title>` before `<body>`, and the API was hit once, during the build.

**Per-request routes stream it** (since 15.2). On Next.js 16.4.5, with `generateMetadata` awaiting a 2-second fetch, a browser user agent got the `200` and a shell (`charset`, `viewport`, scripts, the page's own HTML) at 74 ms. `<title>` and `<meta name="description">` arrived at 2,101 ms, appended inside `<body>`. Chrome 156 and Firefox 159 both left `<title>` in `<body>`, with JavaScript on or off; it still names the document, because HTML takes the first `<title>` in tree order.

**Bots that only read HTML wait.** Per request, Next.js tests the user agent against `htmlLimitedBots`, a regex whose default list includes Bingbot, Twitterbot, facebookexternalhit and Google's non-search crawlers. `facebookexternalhit/1.1` got its first byte at 2,061 ms, with the tags in `<head>`. Googlebot is left off on purpose because it runs JavaScript, so it got the streamed version, like `curl`.

**Dedup.** `generateMetadata` runs in the same render as the page, so the `fetch` both made was one request per page load (the rules are in the fetch memoization question). A plain function standing in for a database call ran twice per request; wrapped in React's `cache`, once.

**Cache Components.** With `cacheComponents: true`, an uncached fetch in `generateMetadata` on an otherwise static page failed the build: "Next.js encountered uncached or runtime data in `generateMetadata()`". Either add `'use cache'` (the title went into the prerendered `<head>`), or render a `connection()` marker inside `<Suspense>`: the route becomes partially prerendered and the metadata streams after the shell.

## Example

```jsx
// app/post/[id]/page.jsx
import { Suspense, cache } from 'react';

const getPost = (id) =>
  fetch(`http://localhost:4100/posts/${id}?ms=2000`, { cache: 'no-store' }).then((r) => r.json());
let calls = 0;
const query = async () => ++calls; // stands in for a database call
const cachedQuery = cache(query);

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPost(id);
  return { title: `Post ${id}, hit ${post.n}`, description: `query ${await query()}, cached ${await cachedQuery()}` };
}

async function Body({ params }) {
  const post = await getPost((await params).id);
  return <p>hit {post.n}, query {await query()}, cached {await cachedQuery()}</p>;
}

export default function Page({ params }) {
  return (
    <main>
      <h1>Shell</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}
```

The API counts hits and answers after 2 s. A browser user agent got `<h1>` and `Loading…` at 74 ms; at 2,101 ms came `<title>Post 1, hit 1</title>`, `content="query 2, cached 3"` and `hit 1, query 1, cached 3`, all in `<body>`. One fetch and one cached call per request; the plain query ran in both places. Webpack builds streamed the same way.

## Pitfalls

- Calling `notFound()` in `generateMetadata` after an `await`. A browser user agent got `200`; with JavaScript off it showed the page body with `<meta name="robots" content="noindex">`, and with it on, the 404 UI. facebookexternalhit got a real `404`.
- `redirect()` there. Browsers got `200` plus `<meta http-equiv="refresh" content="1;url=/dedup">`, then the client redirect; the bot got a real `307`.
- Checking metadata with Googlebot's user agent and expecting blocking output. It isn't on the list; Next.js treats it as a browser.
- Assuming a database or SDK call is deduplicated like `fetch`. Without `cache`, it runs once in `generateMetadata` and again in the page.

## Follow-ups

**Q:** How do you turn streaming metadata off?
**A:** `htmlLimitedBots: /.*/` in `next.config`: every user agent then waits for `generateMetadata` before the first byte. Any custom regex replaces the default list rather than extending it, per the docs.

**Q:** Does metadata in `<body>` matter to a browser?
**A:** Not for the title: the tab and `document.title` use the first `<title>` in the document, wherever it is, even without JavaScript. Tools that read only `<head>` miss it, which is why such bots get blocking metadata.

**Q:** With Cache Components and a `connection()` marker, what do bots get?
**A:** The tags in `<head>`: facebookexternalhit waited 1,571 ms for the slow fetch instead of getting the prerendered shell first.
