---
title: "When are two `fetch` calls deduplicated, and when are they not?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [fetch, memoization, request-deduplication, server-components, route-handlers]
related:
  - nextjs/previous-caching/default-cache-locations
  - nextjs/cache-components/use-cache-vs-other-caches
  - nextjs/optimizations/generate-metadata-streaming-dedup
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - browser/network-apis/fetch-request-options
verified: 2026-11
perishable:
  - "Dedup key in 16.4.5 ignores the cache option"
  - "traceparent and tracestate headers excluded from dedup key"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/fetch#memoization
  - https://nextjs.org/docs/app/glossary#memoization
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#deduplicating-requests
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/dedupe-fetch.ts
  - https://react.dev/reference/react/cache
tldr: >
  During one server render, `GET` fetches with the same URL and request headers share one
  response, across components, layouts and `generateMetadata`. Not deduplicated: other methods, calls
  passing a `signal`, different header values, route handlers, and anything in a different request.
  It's per-render memoization, not a cache.
---

## Answer

Next.js wraps the server `fetch` in a memoization layer scoped to one React render, so the same data can be fetched where it's used instead of passed down through props.

Two calls share one network request when all of these hold:
- they run **in the same render**: Server Components, layouts, pages, `generateMetadata` and, per the docs, `generateStaticParams` and `generateViewport` in that request;
- the method is `GET` (the source also allows `HEAD`);
- no `signal` is passed (nor, per the source, `keepalive`);
- URL and headers match; the source's key also includes `mode`, `redirect`, `credentials`, `referrer`, `referrerPolicy` and `integrity`.

Per the source (the `HEAD`, `keepalive` and extra-field rules not run here), the second caller gets a clone of the first response, so each can read the body.

They are **not** deduplicated when:
- a header value differs (`x-v: 1` and `x-v: 2` made two requests, two `x-v: 1` calls one);
- the method is `POST`, even with identical bodies;
- an `AbortController` signal is passed: the documented opt-out;
- the code runs in a **route handler**, which isn't part of the component tree;
- the calls belong to different requests: memoization ends with the render.

The key ignores the `cache` option. A plain fetch and a `cache: 'no-store'` fetch of the same URL made one request in 16.4.5, and the source says whichever ran first decides the caching. The docs' wording, "the same URL and options", suggests otherwise.

Memoization is separate from the data cache: it dedupes even uncached fetches, and stores nothing between requests. For database or SDK calls, wrap the function in React's `cache` for the same per-request dedup.

## Example

```jsx
// app/dedup/page.jsx
import { connection } from 'next/server';
import { n, API } from '../../lib/api';
async function Same() { return <>same={await n('/same')} </>; }
async function Hdr({ v }) { return <>hdr{v}={await n('/hdr', { headers: { 'x-v': v } })} </>; }
async function Post() { return <>post={await n('/post', { method: 'POST' })} </>; }
async function Sig() { return <>sig={await n('/sig', { signal: new AbortController().signal })} </>; }
async function Mixed({ c }) { return <>mixed={await n('/mixed', c ? { cache: c } : undefined)} </>; }
async function Req() { return <>req={await n('/reqobj', undefined)} reqobj={(await (await fetch(new Request(`${API}/reqobj`))).json()).n} </>; }
export async function generateMetadata() {
  await connection();
  return { title: `meta ${await n('/meta')}` };
}
export default async function Page() {
  await connection();
  const m = await n('/meta');
  return (
    <p>
      <Same /><Same /><Hdr v="1" /><Hdr v="2" /><Hdr v="1" /><Post /><Post /><Sig /><Sig />
      <Mixed /><Mixed c="no-store" /><Req />page-meta={m}
    </p>
  );
}
```

`n()` fetches a counter API at `API` and returns its count for that path. On Next.js 16.4.5 (`next build && next start`) the second request rendered `same=2 same=2 hdr1=3 hdr2=4 hdr1=3 post=3 post=4 sig=3 sig=4 mixed=2 mixed=2 req=2 reqobj=2 page-meta=2` with the title `meta 2`. Per request, the API saw one hit each for `/same`, `/mixed`, `/reqobj` and `/meta`, and two each for `/hdr`, `/post` and `/sig`.

## Pitfalls

- Expecting dedup in a route handler. A GET handler fetching the same URL twice made two requests every time (`{"a":1,"b":2}`, then `{"a":3,"b":4}`).
- Treating dedup as caching across users. Every new request fetched again.
- Assuming a `no-store` call next to a plain one gets its own fresh request. They shared one.
- Adding a per-call trace or auth header that varies. Each value is a separate key; per the source, only `traceparent` and `tracestate` are ignored (not run here).

## Follow-ups

**Q:** How do you dedupe a database query?
**A:** Wrap it in React's `cache`. The Next.js guide recommends it for ORMs and database clients; it memoizes by argument identity for one request, like `fetch` memoization.

**Q:** Does a `string` URL dedupe with a `Request` object for the same URL?
**A:** Yes. `fetch(url)` and `fetch(new Request(url))` made one request; the key comes from the normalised `Request`.

**Q:** Does dedup need the route to be dynamic?
**A:** No. The docs scope it to any server render pass, so build-time prerendering too (not run here). The example used `connection()` only so the counts could be compared per request.
