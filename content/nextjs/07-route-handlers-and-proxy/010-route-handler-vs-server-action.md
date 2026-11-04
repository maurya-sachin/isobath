---
title: "When do you write a route handler instead of a Server Action?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [route-handlers, server-actions, http, webhooks, caching, streaming]
related:
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/mutations/server-action-authorization
  - react/server-components/server-functions
  - nextjs/previous-caching/caching-defaults-14-to-16
  - nextjs/previous-caching/segment-config-options
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/route-handlers-and-proxy/proxy-not-enough-for-auth
  - browser/network-apis/streaming-bodies
verified: 2026-11
perishable:
  - "GET handlers uncached by default since 15.0 (observed on 16.4.5)"
  - "Cache Components prerenders a GET handler with no request reads"
  - "`dynamic` export rejected when cacheComponents is on (16.4.5)"
sources:
  - https://nextjs.org/docs/app/getting-started/route-handlers#caching
  - https://nextjs.org/docs/app/getting-started/route-handlers#with-cache-components
  - https://nextjs.org/docs/app/getting-started/route-handlers#route-resolution
  - https://nextjs.org/docs/app/api-reference/file-conventions/route#http-methods
  - https://nextjs.org/docs/app/api-reference/file-conventions/route#webhooks
  - https://nextjs.org/docs/app/api-reference/file-conventions/route#streaming
  - https://nextjs.org/docs/app/guides/backend-for-frontend#public-endpoints
  - https://nextjs.org/docs/app/guides/backend-for-frontend#server-actions
  - https://nextjs.org/docs/app/guides/backend-for-frontend#server-components
tldr: >
  When the caller isn't your own React UI, or the answer isn't a re-rendered page. A Server Action
  is a `POST` to the page's URL, keyed by a build-generated id and answered in RSC. A route handler
  is a URL you choose, any verb, a `Request` in and any `Response` out: webhooks, mobile clients,
  feeds, cacheable `GET`s, streams.
---

## Answer

They solve different problems, so the question is who calls and what comes back.

A **Server Action** is a mutation for your own React tree. Next.js calls it with a `POST` to the current page's URL, a `Next-Action` id generated at build time, and a body encoded by React. The response is an RSC stream that can carry the re-rendered page with the return value. It is the right tool for forms and buttons in your app: no URL to design, typed arguments, revalidation folded into one round trip.

A **route handler** (`app/**/route.js`) is an ordinary HTTP endpoint. You export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`, get a Web `Request` (a `NextRequest`) and return any `Response`: JSON, XML, a file, a stream, a redirect. Choose it when:

- **Someone else calls it.** A payment provider's webhook, a mobile app, a CLI or a partner can't produce an action id or React's encoding; they need a stable URL and a documented body.
- **You need HTTP itself:** other verbs, status codes, `Content-Type`, CORS headers, the raw body for signature checks.
- **You serve a read** others can cache: an RSS feed, a JSON endpoint. Actions are `POST`s and, per the docs, the client runs them one at a time, so they're a poor fit for fetching.
- **You stream** a long response, such as model output.

On Next.js 16.4.5 (`next build && next start`, Cache Components off) a `GET` handler ran per request: two `curl` calls returned different timestamps. `export const dynamic = 'force-static'` made it `○` in the build table and both calls matched.

Don't call your own route handlers from Server Components: per the docs, that's an extra HTTP hop, and it fails at build for a prerendered page (not run here). Call the data function directly.

## Example

```js
// app/api/webhooks/billing/route.js
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.BILLING_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const sig = Buffer.from(request.headers.get('x-signature') ?? '', 'hex');
  const expected = createHmac('sha256', SECRET).update(body).digest();

  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(body);
  // record event.type idempotently, keyed by the provider's event id
  return Response.json({ received: event.type });
}
```

A signed `curl` `POST` got `200` and `{"received":"invoice.paid"}`; a wrong signature got `401 bad signature`; a `GET` got `405`. Reading `request.text()` first matters: the signature covers the exact bytes, which `request.json()` would discard. A Server Action couldn't do this job: the provider can't send a `Next-Action` id, and a new build can change it.

## Pitfalls

- Assuming a `GET` handler is cached. It hasn't been since 15.0; opt in with `dynamic = 'force-static'` or `revalidate`.
- Keeping those exports after turning on `cacheComponents`. The build failed with "Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`. Please remove it."
- Expecting a handler under Cache Components to run per request. A `GET` that returned a constant was prerendered (`○`) and served from the build; one reading `Date.now()`, `Math.random()` or the `request` was `ƒ`.
- Using a Server Action to load data in a client component. Actions queue behind each other; use a Server Component or a `GET` handler.

## Follow-ups

**Q:** What happens with a verb you didn't export?
**A:** A handler exporting `GET` and `POST` answered `PUT` and `DELETE` with `405`, `HEAD` with `200`, and `OPTIONS` with `204` and `allow: GET, HEAD, OPTIONS, POST`, generated without an `OPTIONS` export.

**Q:** How do you cache part of a handler with Cache Components on?
**A:** Move the work into a `'use cache'` helper (the directive can't sit in the handler body). A handler reading `request.nextUrl` stayed `ƒ`, but its cached helper returned the same timestamp across requests and query strings.

**Q:** Does a streamed handler response really stream?
**A:** Yes. A `ReadableStream` that enqueued a chunk every 500 ms reached `curl` with a 3 ms time to first byte and a 1.5 s total; each chunk printed as it arrived.

**Q:** Can a route handler and a page share a URL?
**A:** No. Per the docs, `route.js` and `page.js` in the same segment conflict, because each takes over every verb for that URL.
