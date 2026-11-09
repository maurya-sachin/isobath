---
title: "How does `use cache` differ from React's `cache` and from `unstable_cache`?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [cache-components, use-cache, react-cache, unstable-cache, request-deduplication, caching]
related:
  - nextjs/cache-components/use-cache-keys
  - nextjs/cache-components/private-and-remote-cache
  - nextjs/previous-caching/default-cache-locations
  - nextjs/previous-caching/fetch-request-deduplication
  - react/server-components/rsc-vs-ssr
  - react/server-components/rsc-serialization
verified: 2026-11
perishable:
  - "unstable_cache still unstable_-prefixed in Next.js 16.4.5"
  - "unstable_cache persists across deploys; use cache does not"
  - "React.cache scope isolated inside use cache"
sources:
  - https://react.dev/reference/react/cache
  - https://nextjs.org/docs/app/api-reference/functions/unstable_cache
  - https://nextjs.org/docs/app/guides/migrating-to-cache-components#unstable_cache
  - https://nextjs.org/docs/app/guides/migrating-to-cache-components#reactcache
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#reactcache-isolation
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys
  - https://nextjs.org/blog/next-16#breaking-changes-and-other-updates
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents#version-history
tldr: >
  React's `cache` memoizes a function for one server render: calls with the same arguments share a
  result, and it's gone when the request ends. `use cache` stores a serialized result across requests
  in the cache handler, keyed automatically, per build. `unstable_cache` is the older cross-request
  cache with hand-written keys; it persists to Next's data cache and survives deploys.
---

## Answer

They differ in **how long** a result lives and **who** shares it.

**React's `cache(fn)`** is request-scoped memoization, a React API for Server Components. Within one server render, calls with the same arguments (compared with `Object.is`, so objects by reference) return the same result; React drops it all when the request ends. Its job is deduplication: three components calling `getUser(id)` cause one query. It stores live values, not serialized ones.

**`use cache`** (Next.js, with `cacheComponents: true`) is a persistent cache. The result is serialized and stored in a cache handler, by default in-process memory, and reused by later requests and other routes until its `cacheLife` runs out or a `cacheTag` is invalidated. The key is computed for you: build ID, function identity, serialized arguments and closed-over values. It also decides what goes into the prerendered static shell. Entries don't survive a new build.

**`unstable_cache(fn, keyParts, { tags, revalidate })`** is the older Next.js cross-request cache. Its key is your `keyParts` plus the arguments and the function's source text, so a closed-over variable must be added to `keyParts` by hand. It is stored in Next's data cache (on disk under `next start`) and, per the docs, persists across deployments, which `use cache` does not. It still works with Cache Components; the migration guide maps `revalidate` to `cacheLife` and `tags` to `cacheTag`.

The pieces combine rather than compete: `use cache` for what can be reused across users, React's `cache` for per-request dedup of uncached or request-specific reads, `unstable_cache` only when data must outlive a deploy.

*Legacy:* in Next.js 15, Cache Components was experimental (`experimental.dynamicIO`, later `experimental.cacheComponents`); 16.0 made `cacheComponents` a top-level option.

## Example

```jsx
// lib/data.js
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

const load = async (src, k) => {
  console.log('RUN', src, k);
  return (await (await fetch(`http://localhost:4999/${src}?k=${k}`)).json()).n;
};

export const getReact = cache((k) => load('react', k));

export const getUC = unstable_cache((k) => load('uc', k), ['get-uc'], {
  revalidate: 3600,
  tags: ['uc'],
});

export async function getUseCache(k) {
  'use cache';
  return load('usecache', k);
}
```

A page called each function twice with `k=a` (Next.js 16.4.5, `next build && next start`). It printed `react=1,1 uc=1,1 usecache=1,1`, then `react=2,2 uc=1,1 usecache=1,1` on a second request. After restarting `next start`: `react=3,3 uc=1,1 usecache=2,2`. After a fresh `next build`: `react=4,4 uc=1,1 usecache=3,3`.

## Pitfalls

- Using React's `cache` to cut database load across requests. It never reused a result between requests; the counter rose on each one.
- Assuming React's `cache` runs a body once per request. Next.js 16.4.5 ran the `getReact` body twice on most requests (apparently a second render pass with its own `cache` scope), though the one `fetch` inside was made once.
- Sharing data into a `use cache` function through React's `cache`. The scope is isolated: a store set by the parent read `null` inside the cached component.
- Migrating `unstable_cache` to `use cache` where data must survive deploys. `uc=1` outlived the rebuild; `usecache` didn't.

## Follow-ups

**Q:** Why are `unstable_cache` keys more error-prone?
**A:** Its docs say the key uses the arguments and the stringified function. A value the function closes over isn't in it, so it must go in `keyParts`. `use cache` binds closed-over values into the key automatically.

**Q:** Where did `unstable_cache` store its entry under `next start`?
**A:** In `.next/cache/fetch-cache`, one file per key. It was still there after a restart and after rebuilding in the same folder; on hosting that wipes `.next`, persistence depends on the platform's data cache.

**Q:** Does `use cache` need React's `cache` for dedup within a render?
**A:** No. The Next.js docs say `use cache` already deduplicates calls with the same arguments within a render and across requests.
