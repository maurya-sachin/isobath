---
title: "How do `cacheLife` profiles map to stale, revalidate and expire times?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [cache-components, cachelife, revalidation, stale-while-revalidate, cache-control]
related:
  - nextjs/cache-components/use-cache-keys
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/mutations/isr-and-on-demand-revalidation
  - nextjs/mutations/revalidation-apis-compared
verified: 2026-11
perishable:
  - "Preset profile values in Next.js 16.4.5"
  - "default profile expire: docs say never, build shows 1y"
  - "Thresholds: expire under 5 min or stale under 30 s"
  - "Built-in handler drops runtime entries at revalidate"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#cache-profile-properties
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#preset-cache-profiles
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#custom-cache-profiles
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#client-cache-behavior
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#prerendering-behavior
  - https://nextjs.org/docs/app/api-reference/functions/cacheLife#nested-caching-behavior
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#use-cache-at-runtime
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers#get
  - https://nextjs.org/docs/app/guides/upgrading/version-16#cachelife-and-cachetag
tldr: >
  A profile is three times. `stale`: how long the browser's router reuses the result without asking.
  `revalidate`: after this the server regenerates, serving prerendered pages stale meanwhile.
  `expire`: after this the old copy can't be served. `default` is 5 min / 15 min / 1 year. Short
  lifetimes turn content into request-time holes.
---

## Answer

`cacheLife(profile)` sets the lifetime of the `use cache` scope it's called in (it throws outside one). Each profile has three numbers, in seconds:

- **`stale`** (client): how long the client router may reuse the result with no request. Sent as `x-nextjs-stale-time`; the docs say the router enforces at least 30 s.
- **`revalidate`** (server): after this, the entry is due for regeneration. Like ISR, a prerendered page is served stale while it regenerates in the background.
- **`expire`** (server): after this, the old entry may not be served; the next request waits for fresh output. It must be greater than `revalidate`.

Presets in Next.js 16.4.5 (`stale` / `revalidate` / `expire`): `default` 5 min / 15 min / 1 year; `seconds` 30 s / 1 s / 1 min; `minutes` 5 min / 1 min / 1 h; `hours` 5 min / 1 h / 1 day; `days` 5 min / 1 day / 1 week; `weeks` 5 min / 1 week / 30 days; `max` 5 min / 30 days / 1 year. You can pass an inline object, define named profiles under `cacheLife` in `next.config`, or redefine the presets.

For a prerendered page, the profile becomes the HTTP header: `Cache-Control: s-maxage=<revalidate>, stale-while-revalidate=<expire − revalidate>`.

Short lifetimes change where content can live. `revalidate: 0`, `expire` under 5 minutes, or `stale` under 30 s exclude the scope from prerendering: it becomes a request-time hole that needs `<Suspense>`. Of the presets only `seconds` crosses a threshold.

Nesting: a `use cache` without its own `cacheLife` takes the shortest lifetime of the caches inside it; an explicit `cacheLife` always wins.

*Legacy:* in Next.js 15 these were `unstable_cacheLife` and `unstable_cacheTag`; 16.0 dropped the prefix.

## Example

```jsx
// app/isr/page.jsx
import { cacheLife } from 'next/cache';

async function getData() {
  'use cache';
  cacheLife({ stale: 30, revalidate: 10, expire: 300 });
  const res = await fetch('http://localhost:4999/isr?delay=2000');
  return (await res.json()).n;
}

export default async function Page() {
  return <p>isr v{await getData()}</p>;
}
```

Next.js 16.4.5, `cacheComponents: true`, `next build && next start`. The route table showed `○ /isr  10s  5m`, and responses carried `x-nextjs-stale-time: 30` and `Cache-Control: s-maxage=10, stale-while-revalidate=290`. Eleven seconds after a fresh copy, a request returned the old `v3` instantly with `x-nextjs-cache: STALE`; three seconds later the page said `v4` with `HIT`. The 2-second fetch never delayed a response.

## Pitfalls

- Expecting the same stale-while-revalidate for request-time entries. A cached function inside a `<Suspense>` hole (`revalidate: 5`, `expire: 15`) blocked for the full 2 s once past `revalidate`. The built-in handler drops entries at `revalidate`; the docs say a custom handler may serve them until `expire`.
- Using `cacheLife('seconds')`, or any `stale` under 30 s, outside `<Suspense>`. It can't be prerendered: `stale: 10` built as ◐ with its fallback in the shell.
- Believing the docs' "`default` never expires". The build printed `15m 1y`, and the header was `stale-while-revalidate=31535100`, one year minus 900 s.
- Nesting a `seconds` cache inside a `use cache` with no `cacheLife`. The build failed: ``A nested `"use cache"` with a short `expire` (under 5 minutes) is inside an outer `"use cache"` that has no `cacheLife()`.``

## Follow-ups

**Q:** What does `stale` change in the HTTP response?
**A:** Not `Cache-Control`. It travels as `x-nextjs-stale-time` and only steers the client router; `s-maxage` and `stale-while-revalidate` come from `revalidate` and `expire`.

**Q:** An outer `use cache` without `cacheLife` renders a `cacheLife('minutes')` child. What lifetime does it get?
**A:** The child's. The route built as `1m 1h`: shorter inner lifetimes pull the implicit default down; longer ones can't extend it.

**Q:** Does a Server Action's `revalidateTag` wait for `stale` to run out in the browser?
**A:** No. The docs say a revalidation call from a Server Action clears the whole client cache immediately. Chapter 05 covers the revalidation APIs.
