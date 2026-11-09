---
title: "When do you need `use cache: private` or `use cache: remote`?"
status: draft
difficulty: hard
frequency: 2
core: false
tags: [cache-components, use-cache-private, use-cache-remote, cache-handlers, self-hosting]
related:
  - nextjs/cache-components/use-cache-keys
  - nextjs/cache-components/cached-functions-and-request-data
  - nextjs/cache-components/cachelife-profiles
  - nextjs/deployment/multi-instance-hosting
verified: 2026-11
perishable:
  - "Without cacheHandlers.remote, remote uses the in-memory default"
  - "use cache: private has no server cache in production"
  - "Nesting error text in Next.js 16.4.5"
sources:
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-private
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-private#request-apis-allowed-in-private-caches
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-remote#how-use-cache-remote-differs-from-use-cache-and-use-cache-private
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-remote#nesting-rules
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-remote#persistence-across-deploys
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers#handler-types
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#runtime-caching-considerations
tldr: >
  Rarely. `use cache: private` may read `cookies()` and `headers()`, but its result is never stored on
  the server across requests, only deduplicated within one and kept in the browser's router cache.
  `use cache: remote` stores results in a shared handler so all instances reuse them. Self-hosted,
  it is just the in-memory cache until you configure `cacheHandlers.remote`.
---

## Answer

Plain `use cache` covers most needs: it fills the static shell at build time, and at request time it keeps results in a per-process, in-memory LRU. The two variants address two of its limits.

**`use cache: private`** is for code that must read request data inside the cached scope: `cookies()`, `headers()` and `searchParams` are allowed (`connection()` is not). The price is that nothing is shared. In production the result is not stored in a server cache across requests; matching calls within one request reuse it, and the client router keeps the rendered output for its `stale` time. It runs only at request time, so it is never in the static shell, and custom handlers can't be configured for it. The docs reserve it for compliance cases or code you can't refactor to pass values as arguments.

**`use cache: remote`** keeps the same rules as `use cache` (no request APIs; pass values as arguments) but sends entries to the `remote` cache handler. Its value is at request time: content inside a `<Suspense>` hole runs on every request, and with per-instance memory, especially on serverless, hit rates are low. A shared store (Redis, a key-value service) gives every instance the same entries, protecting rate-limited or slow backends, at the cost of a network lookup per call and the storage bill. It pays off only when keys have few distinct values.

What it needs: a handler. Platforms can supply one; self-hosted, you set `cacheHandlers: { remote: … }` in `next.config`. Without one, Next.js 16.4.5 uses an in-memory LRU just like the default handler, so `remote` changes nothing.

Neither survives a deploy: every key includes the build ID.

## Example

```jsx
// app/priv/page.jsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';

async function getRecs() {
  'use cache: private';
  cacheLife({ stale: 60 });
  const user = (await cookies()).get('user')?.value ?? 'guest';
  console.log('RUN getRecs', user);
  const res = await fetch(`http://localhost:4999/recs?u=${user}`);
  return (await res.json()).n;
}

async function Recs() {
  const [a, b] = [await getRecs(), await getRecs()];
  return <p>recs {a} {b}</p>;
}

export default function Page() {
  return <Suspense fallback={<p>recs loading</p>}><Recs /></Suspense>;
}
```

Next.js 16.4.5, `next build && next start`: the route built as ◐ with `recs loading` in the shell. Requests with cookies `user=ann`, `user=ann`, `user=bo` printed `recs 1 1`, `recs 2 2`, `recs 1 1`: one run per request (two calls, one execution), and no reuse between requests.

## Pitfalls

- Reaching for `private` to "cache per user". It removes server reuse entirely; reading the cookie outside and passing the value to `use cache` gives a real, shared entry per value.
- Adding `remote` on self-hosted `next start` and expecting a shared cache. With no handler configured, ports 3041 and 3042 each ran the function once, and a restart ran it again.
- Nesting the two. A `private` function called inside a `remote` one failed at request time: `` `"use cache: private"` can't be nested inside `"use cache"` because a shared cached function can't depend on private request data. ``
- Keying a remote cache on a session ID. Each user gets an entry that's never hit again; key on low-cardinality values (locale, currency).

## Follow-ups

**Q:** How did a configured remote handler behave across instances?
**A:** With a small file-based handler as `cacheHandlers.remote`, port 3062 reused the entry port 3061 had written, and a restarted server reused it too. The plain `use cache` page on the same servers ran once per instance.

**Q:** And after a rebuild?
**A:** The same handler and store missed: the new build ID made a new key, and the store held two files. That's by design, so old-shaped data never reaches new code.

**Q:** Why does `private` take a `cacheLife`?
**A:** Its `stale` sets how long the browser's router reuses the output, and the route uses the shortest `stale` among its entries. `stale: Infinity` keeps a request-dedup-only function from lowering it.

## Exercises

### What does each instance print?

```sh
# next.config sets cacheComponents but no cacheHandlers.
# /remote awaits searchParams in <Suspense>, then calls a 'use cache: remote'
# function that returns a hit counter from an API.
next build
next start -p 3041 & next start -p 3042 &
curl 'localhost:3041/remote?k=x'; curl 'localhost:3041/remote?k=x'; curl 'localhost:3042/remote?k=x'
```

**Answer:** `remote v1`, `remote v1`, `remote v2`. The second request hit 3041's memory; 3042 has its own default in-memory handler, so it ran the function and the counter moved.
