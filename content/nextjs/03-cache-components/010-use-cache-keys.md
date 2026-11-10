---
title: "What does `use cache` cache, and how is its cache key built?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [cache-components, use-cache, cache-keys, serialization, caching]
related:
  - nextjs/cache-components/cached-functions-and-request-data
  - nextjs/cache-components/cachelife-profiles
  - nextjs/cache-components/private-and-remote-cache
  - nextjs/cache-components/use-cache-vs-other-caches
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/rendering/static-or-dynamic-decision
  - react/server-components/rsc-serialization
  - react/suspense/use-api
verified: 2026-11
perishable:
  - "use cache needs cacheComponents: true in Next.js 16.4.5"
  - "Cache key parts: build ID or deploymentId, function ID, arguments"
  - "Default handler is an in-memory LRU per process"
  - "A URL argument arrived as a string in 16.4.5"
sources:
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#serialization
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#pass-through-non-serializable-arguments
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#interleaving
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#runtime-caching-considerations
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers#handler-types
  - https://nextjs.org/docs/app/getting-started/caching#where-cached-content-is-stored
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents#version-history
tldr: >
  `use cache` stores the serialized return value of an async function, component or whole file. The
  key is the build ID, a hash of the function's location, and its serialized arguments, including
  values it closes over. Same inputs reuse the entry across requests and routes; any difference in
  type, value or object key order is a new entry.
---

## Answer

`'use cache'` marks an async function, an async component, or a whole file (every export) as cacheable. It needs `cacheComponents: true` in `next.config` (Next.js 16; this chapter ran 16.4.5 with it on). What's cached is the function's **return value**, serialized with React's Server Components format, so a component's entry is its rendered RSC output.

The key, per the docs, has four parts:

1. the **build ID** (or `deploymentId` if set), so a new build starts empty;
2. a **function ID**, a hash of where the function is defined;
3. the **serialized arguments**, props for a component;
4. in `next dev` only, an HMR hash.

Values the function **closes over** are bound in as hidden arguments by the compiler, so an inner cached function that reads a parent's `userId` gets one entry per user.

Consequences I observed under `next build && next start`:

- `getItem(1)` and `getItem('1')` are two entries, and so are `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }`: the key is the serialized bytes, not semantic equality.
- The same function called from two routes with the same argument ran once: entries belong to the function, not the page.
- Arguments must be serializable. Non-serializable ones become opaque references that can be passed through (as `children` or to a Client Component) but not read. A component's `children` don't join its key, so a cached layout can wrap per-request content.

Where entries live: results computed during `next build` go into the prerendered shell on disk. Results computed at request time go to the cache handler, by default an in-memory LRU per process, lost on restart and not shared between instances.

## Example

```jsx
// lib/data.js
export async function getItem(id) {
  'use cache';
  console.log('RUN getItem', JSON.stringify(id));
  const res = await fetch(`http://localhost:4999/item?id=${JSON.stringify(id)}`);
  return (await res.json()).n;
}

// app/args/page.jsx
import { Suspense } from 'react';
import { getItem } from '../../lib/data';

async function Calls({ searchParams }) {
  const { id = '1' } = await searchParams;
  await getItem(id);
  await getItem(id);
  await getItem({ a: 1, b: 2 });
  await getItem({ b: 2, a: 1 });
  await getItem(1);
  return <p>id={id}</p>;
}

export default function Page({ searchParams }) {
  return <Suspense fallback={<p>loading</p>}><Calls searchParams={searchParams} /></Suspense>;
}
```

Two requests to `/args?id=1` logged four `RUN` lines in total, all from the first: `"1"`, `{"a":1,"b":2}`, `{"b":2,"a":1}` and `1`. `/args?id=2` added only `RUN getItem "2"`.

## Pitfalls

- Expecting `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }`, or `1` and `'1'`, to share an entry. They didn't.
- Passing a class instance and reading it. The build failed: `Cannot access id on the server. You cannot dot into a temporary client reference from a server component.`
- Calling a function argument inside the cache: `Attempted to call a temporary Client Reference from the server but it is on the client.`
- Assuming request-time entries survive `next start` restarts or are shared by a second instance. Both re-ran the function.

## Follow-ups

**Q:** Does a build-time result get reused by a request-time call with the same arguments?
**A:** Not in 16.4.5 under `next start`. `getItem('seed')` ran during the build for a static page; a dynamic page calling `getItem('seed')` ran it again. The build result lives in that page's prerendered HTML, not the in-memory handler.

**Q:** What happens to the cache on deploy?
**A:** It's unreachable. The build ID is part of every key, so entries from the old build, even in a remote handler, never match new keys.

**Q:** Can a `use cache` function return JSX?
**A:** Yes. Return values use the richer Client Component serialization, so JSX is allowed; arguments use the stricter Server Component rules, where JSX is only passed through.

## Deep dive

### How it works

The compiler turns every function under `'use cache'` into a call through a cache wrapper that knows the function's ID. Variables the function closes over are captured and bound as extra arguments (the docs' wording). The argument list is serialized with React's Server Components serialization and combined with the build ID and function ID into the key. On a hit, the stored RSC output is replayed; on a miss, the function runs in an isolated scope (its own React `cache` scope, for instance), and the serialized result goes to the cache handler as a stream, described by the `CacheEntry` type in the `cacheHandlers` docs.

Two things follow. Keys compare the serialized form, not values, so key order inside objects and the difference between `1` and `'1'` both matter, as the Example showed. And the closure rule means you can't hide an input: the docs' example of an inner `getData(filter)` that reads `userId` from its component gets one entry per `userId` and `filter` pair. I ran it with `?u=alice` twice and `?u=bob` once and saw `RUN closure alice active` and `RUN closure bob active`, nothing more.

The four directive placements behave the same way underneath:

- **Function level:** a data helper, keyed by its arguments.
- **Component level:** keyed by props; the stored value is RSC output.
- **File level:** every export is cached and must be async. `getA(x)` in a `'use cache'` module ran once for two requests with the same `x`.
- **Route segment:** `'use cache'` at the top of `page` or `layout`, the same file-level rule; the docs note each segment is its own entry.

### Edge cases

**Pass-through is a hole, not a key.** A cached `Card` received `children` that read `cookies()` inside `<Suspense>`:

```jsx
// app/comp/page.jsx
async function Card({ id, children }) {
  'use cache';
  const n = (await (await fetch(`http://localhost:4999/card?id=${id}`)).json()).n;
  return <section>card {id} n={n} {children}</section>;
}

export default function Page() {
  return <Card id="7"><Suspense fallback={<i>…</i>}><Who /></Suspense></Card>;
}
```

`Card` ran once during the build and never at request time; requests with `who=sam` and `who=kim` cookies each showed their own `who=` value inside the same cached card. The children are serialized as a reference slot, so they neither enter the key nor get frozen in the entry.

**Unsupported arguments fail late, and not always.** The docs list class instances, functions, symbols and `URL` as unsupported. In 16.4.5 a class instance or function only failed when the cached code read or called it (the errors in Pitfalls), at build time for a static route. A `URL` didn't fail at all: inside the function it was a string (`typeof url` printed `string`, `url.pathname` was `undefined`): its href, what `JSON.stringify` gives for a `URL`. The page rendered an empty paragraph with no warning.

**Request-time entries are per process.** The default handler for both `use cache` and `use cache: remote` is an in-memory LRU, sized by `cacheMaxMemorySize`. After restarting `next start` on the same build, every request-time entry re-ran (the API counter went from 1 to 2 for each argument). The `.next/cache` folder got no new files.

### Real-world scenario

A catalogue page caches `getProducts(filters)` where `filters` comes from `searchParams`. Every combination of filters, and every ordering of the same filters in the object, is a new entry, so the hit rate is close to zero and memory fills with one-off results. Normalising the input (sorted keys, or a small set of strings) and caching on the low-cardinality dimension, then filtering in memory, fixes both. The `use cache: remote` docs make the same recommendation for remote handlers, where each miss also costs a network round trip.

### Trade-offs

Automatic keys remove the hand-maintained key arrays of `unstable_cache` and can't forget a closed-over variable, but you lose control over what is *not* in the key: anything the function closes over or receives counts. Keying on build ID makes deploys safe (no old-shape data reaching new code) at the cost of a cold cache after every deploy. And the default handler's per-process memory means request-time caching is a best-effort optimisation on serverless or multi-instance hosting; for shared, durable entries you configure `cacheHandlers`.
