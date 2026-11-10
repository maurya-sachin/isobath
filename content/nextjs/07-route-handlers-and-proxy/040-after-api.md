---
title: "What does `after` run, and when does it run relative to the response?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [after, route-handlers, server-actions, logging, wait-until, self-hosting]
related:
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - nextjs/route-handlers-and-proxy/instrumentation-and-request-errors
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/deployment/multi-instance-hosting
verified: 2026-11
perishable:
  - "`after` stable since 15.1.0"
  - "after errors logged, not sent to onRequestError (16.4.5)"
  - "Serverless hosts need `waitUntil` via `@next/request-context`"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/after
  - https://nextjs.org/docs/app/api-reference/functions/after#duration
  - https://nextjs.org/docs/app/api-reference/functions/after#good-to-know
  - https://nextjs.org/docs/app/api-reference/functions/after#with-request-apis
  - https://nextjs.org/docs/app/api-reference/functions/after#in-server-components-pages-and-layouts
  - https://nextjs.org/docs/app/api-reference/functions/after#platform-support
  - https://nextjs.org/docs/app/guides/self-hosting#after
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#waituntil-and-nextfetchevent
tldr: >
  `after(callback)` queues work for when the response is finished: logging, analytics, cache
  warming. The client isn't kept waiting, and for a streamed body the callback waits until the stream
  closes. It works in Server Components, Server Actions, route handlers and Proxy, runs even when the
  request errored or redirected, and on a prerendered route runs at build time.
---

## Answer

`after` from `next/server` takes a callback and runs it once the response (or prerender) is done. The point is side effects the user shouldn't wait for: an audit log, analytics, a webhook to another system, warming a cache.

What I measured on Next.js 16.4.5 under `next start`, with a callback that slept one second:

- **Route handler:** `curl` finished in 7 ms; the callback started at +1 ms and ended at +1002 ms.
- **Server Action:** the action's response took 45 ms; the callback ended at +1007 ms.
- **Server Component page:** 9 ms response, callback done at +1005 ms.
- **Streamed response:** a handler streaming three chunks 500 ms apart closed its stream at +1504 ms; `after` ran at +1505 ms. "After the response" means after the last byte.
- **Proxy:** a callback scheduled there ran as well.

It also ran when the handler threw (`500`) and when a page called `redirect()` (`307`), as the docs say. It isn't a request-time API, so it doesn't make a route dynamic. With Cache Components on, a `GET` handler that only returned a constant was prerendered, and its `after` callback ran during `next build`.

Request data: in route handlers and actions, `headers()` and `cookies()` work inside the callback (it read `curl/8.7.1`). In Server Components they throw there; read them during render and close over the values.

Lifetime is the host's job. `next start` keeps running, and on `SIGTERM` it waited for a pending callback before exiting. Serverless platforms must keep the invocation alive: Next.js looks up a `waitUntil` through `globalThis[Symbol.for('@next/request-context')]`, and per the docs the callback is bounded by the route's `maxDuration` (not run here).

## Example

```js
// app/api/orders/route.js
import { after } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request) {
  const t0 = Date.now();
  const order = await request.json();

  after(async () => {
    const ua = (await headers()).get('user-agent');
    await fetch('https://analytics.example/events', {
      method: 'POST',
      body: JSON.stringify({ type: 'order', id: order.id, ua }),
    });
    console.log('[after] logged +' + (Date.now() - t0) + 'ms');
  });

  console.log('[route] returning +' + (Date.now() - t0) + 'ms');
  return Response.json({ ok: true }, { status: 201 });
}
```

With the URL pointed at a local server that answers after one second, `curl` got its `201` in 42 ms (the first request after start), and the server logged `[route] returning +2ms`, then `[after] logged +1045ms`. Awaiting the `fetch` in the handler would have made the client wait for it.

## Pitfalls

- Reading `cookies()` inside `after` in a page. It threw: "Route /after-page used `cookies()` inside `after()` while rendering. This is not supported."
- Expecting a failed callback to fail the request or reach `onRequestError`. The response was still `200`; the server only logged "An error occurred in a function passed to `after()`: Error: after boom".
- Leaving a throwing `after` in a route that gets prerendered. With Cache Components on, it ran at build and `next build` exited with "Error occurred prerendering page "/api/after-err"".
- Using it for work that must happen. `kill -9` during a pending callback lost it, and a crash would too; durable jobs belong in a queue.

## Follow-ups

**Q:** How is it different from not awaiting a promise?
**A:** A floating promise isn't tied to the request. Per the docs, serverless hosts keep an invocation alive only for promises given to `waitUntil`, as `after`'s are (not run here). Under `next start`, a pending `after` was drained on `SIGTERM`, and a throwing one was logged as an `after()` error.

**Q:** Can you call it later, from a timer?
**A:** A call inside a `setTimeout` started by the handler still worked; the request context followed the timer. Called from `register()` in `instrumentation.js`, outside any request, it threw: "`after` was called outside a request scope."

**Q:** What does Proxy offer besides `after`?
**A:** `event.waitUntil(promise)` on its second argument, a `NextFetchEvent`: per the docs, it keeps the invocation alive until the promise settles (not run here).
