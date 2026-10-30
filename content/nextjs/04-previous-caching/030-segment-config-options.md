---
title: "What do `dynamic`, `revalidate` and `fetchCache` segment configs do?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [route-segment-config, caching, isr, fetch, dynamic-rendering]
related:
  - nextjs/previous-caching/default-cache-locations
  - nextjs/previous-caching/caching-defaults-14-to-16
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/rendering/keeping-route-static
  - nextjs/cache-components/cachelife-profiles
verified: 2026-11
perishable:
  - "dynamic, revalidate, fetchCache, dynamicParams, runtime rejected with cacheComponents (16.4.5)"
  - "Explicit force-cache beats force-dynamic and force-no-store in 16.4.5"
  - "Root-layout fetchCache skipped on client navigations in 16.4.5"
sources:
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#dynamic
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#fetchcache
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#route-segment-config-revalidate
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#version-history
  - https://nextjs.org/docs/app/api-reference/functions/fetch#optionsnextrevalidate
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/patch-fetch.ts
tldr: >
  Without Cache Components they set a route's caching from a page, layout or route handler.
  `dynamic` forces the whole route static or dynamic, or errors on request reads. `revalidate` sets
  the route's ISR interval (`0` makes it dynamic). `fetchCache` changes the default `cache` option of
  its fetches. With `cacheComponents: true`, the build rejects all three.
---

## Answer

They are exports from `page.js`, `layout.js` or `route.js`, read at build time, and they only exist in the default model.

**`dynamic`** decides static versus dynamic for the whole route:
- `'auto'` (default): decided by what the render reads.
- `'force-static'`: prerender anyway; `cookies()` and `headers()` return empty values (the docs add `useSearchParams()`, not run here).
- `'force-dynamic'`: render every request; fetches without their own `cache` option aren't cached.
- `'error'`: prerender, and fail the build if anything reads the request.

**`revalidate`** sets the route's lifetime in seconds: `false` (default) keeps a static route until redeploy or on-demand revalidation, a number makes it ISR, `0` makes it dynamic. Fetches without options inherit it; per the docs, a fetch's own lower `next.revalidate` lowers the whole route's interval (not run here). Per the docs, the value must be a literal (`600`, not `60 * 10`).

**`fetchCache`** sets the default `cache` option for fetches in that segment. `'default-cache'` caches option-less fetches even after a request-time read; `'default-no-store'` stops caching them even before one; `'only-cache'`/`'only-no-store'` fail on the opposite choice; `'force-cache'`/`'force-no-store'` are documented to override it.

In 16.4.5 the explicit option wins more often than the docs say. Under `force-dynamic`, and under `fetchCache = 'force-no-store'`, a fetch with `cache: 'force-cache'` stayed cached (`fd=1` over five requests). The source sets `revalidate: false` for `force-cache` before it checks the segment's opt-out.

With `cacheComponents: true`, the build rejects each of them: `Route segment config "revalidate" is not compatible with nextConfig.cacheComponents. Please remove it.` 16.4.5 printed the same for `dynamic`, `fetchCache`, `dynamicParams` and `runtime`; `maxDuration` built. `use cache`, `cacheLife` and `instant` replace them.

## Example

```jsx
// app/seg/force-static/page.jsx
import { cookies, headers } from 'next/headers';
import { n } from '../../../lib/api';
export const dynamic = 'force-static';
export default async function Page() {
  const c = (await cookies()).get('who')?.value ?? 'none';
  const ua = (await headers()).get('user-agent') ?? 'none';
  return <p>cookie={c} ua={ua} fs={await n('/fs', { cache: 'no-store' })}</p>;
}

// app/seg/force-dynamic/page.jsx
import { n } from '../../../lib/api';
export const dynamic = 'force-dynamic';
export default async function Page() {
  return <p>fd={await n('/fd', { cache: 'force-cache' })} fd-default={await n('/fd-default')}</p>;
}

// app/seg/revalidate/page.jsx
import { n } from '../../../lib/api';
export const revalidate = 10;
export default async function Page() {
  return <p>rv={await n('/seg-rv')} t={Date.now()}</p>;
}
```

`n()` fetches a counter API and returns its count for that path. On Next.js 16.4.5 (`next build && next start`): `force-static` built as ○ and returned `cookie=none ua=none fs=1` to a request sending a cookie, every time. `force-dynamic` built as ƒ; over five requests `fd` stayed `1` and `fd-default` went `1` to `5`. `revalidate` built as `○ 10s 1y`; after 10 s one request got the old page and the next showed `rv=2`.

## Pitfalls

- Expecting `force-static` to throw on `cookies()`. It silently returns empty values; use `'error'` to fail the build.
- Putting `fetchCache = 'default-cache'` in the root layout. Full page loads used it, but client-side navigations to a dynamic page fetched again; the same export on the page worked.
- Trusting `force-dynamic` or `force-no-store` to bypass an explicit `force-cache` fetch. In 16.4.5 the fetch's own option won.
- Writing `revalidate = 60 * 10`. The docs say it must be statically analyzable (not run here).

## Follow-ups

**Q:** What does `dynamic = 'error'` print?
**A:** In 16.4.5: ``Route /dynerr with `dynamic = "error"` couldn't be rendered statically because it used `cookies()`.`` The build stops.

**Q:** What does `fetchCache = 'only-cache'` do with a `no-store` fetch?
**A:** It fails the build: `cache: 'no-store' used on fetch for http://localhost:4999/oc with 'export const fetchCache = 'only-cache'`.

**Q:** Does `revalidate = 0` stop a `force-cache` fetch from being cached?
**A:** No. The route became ƒ and option-less fetches ran per request, but the `force-cache` fetch stayed at `1`, as the docs describe.
