---
title: "What is the difference between `revalidatePath`, `revalidateTag`, `updateTag` and `refresh`?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [revalidation, revalidatepath, revalidatetag, updatetag, refresh, caching]
related:
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/mutations/isr-and-on-demand-revalidation
  - nextjs/cache-components/cachelife-profiles
  - nextjs/cache-components/use-cache-keys
  - nextjs/previous-caching/default-cache-locations
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
verified: 2026-11
perishable:
  - "revalidateTag needs a profile argument since 16.0; one-arg form deprecated"
  - "updateTag and refresh: Server Actions only (16.4.5)"
  - "revalidatePath in an action refreshes all visited pages (docs: temporary)"
sources:
  - https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update
  - https://nextjs.org/docs/app/api-reference/functions/revalidatePath#usage
  - https://nextjs.org/docs/app/api-reference/functions/revalidatePath#relationship-with-revalidatetag-and-updatetag
  - https://nextjs.org/docs/app/api-reference/functions/revalidateTag#revalidation-behavior
  - https://nextjs.org/docs/app/api-reference/functions/updateTag#differences-from-revalidatetag
  - https://nextjs.org/docs/app/api-reference/functions/refresh#usage
  - https://nextjs.org/docs/app/api-reference/functions/use-router#userouter
  - https://nextjs.org/docs/app/guides/how-revalidation-works#soft-tags
tldr: >
  `revalidatePath` invalidates what one route rendered. `revalidateTag(tag, 'max')` marks tagged
  data stale everywhere: the next read gets the old value and refreshes it in the background.
  `updateTag(tag)` expires it so the next read waits. `refresh()` re-renders the page without touching
  the cache. Only the first two work in route handlers; `refresh` and `updateTag` are action-only.
---

## Answer

They answer two questions: **what** gets invalidated, and **how stale** the next read may be.

| | Invalidates | Next read | Server Action | Route handler |
|---|---|---|---|---|
| `revalidatePath(p)` | entries rendered by route `p` (its soft tags) | fresh | yes, re-renders the page | yes |
| `revalidateTag(t, 'max')` | every entry tagged `t` | stale, refreshed in background | yes, no re-render | yes |
| `updateTag(t)` | every entry tagged `t` | waits for fresh data | yes, re-renders the page | throws |
| `refresh()` | nothing | n/a | yes, re-renders the page | throws |

- **`revalidatePath`** works by path, through the `_N_T_/…` tags Next attaches to each route and layout, so it reaches the route's page entry and the data it fetched. Pass `'layout'` or `'page'` for a dynamic pattern like `/blog/[slug]`. Other routes using the same data stay cached.
- **`revalidateTag`** is stale-while-revalidate; its profile (`'max'`, another `cacheLife` profile, or `{ expire }`) caps how long stale may be served. For webhooks and CMS updates.
- **`updateTag`** is for read-your-own-writes: the user who saved sees the save.
- **`refresh`** re-renders the current route, so state outside the cache (cookies, a database read with no cache) shows its new value. Cached data stays as it was.
- **`router.refresh()`** is the client-side relative: a `GET` for the current route's payload, no server invalidation.

I checked every row on Next.js 16.4.5 under `next start`, with `cacheComponents` off (tagged `fetch`) and on (`use cache` + `cacheTag`); the behaviour matched. All four threw when called during render.

*Legacy:* before 16.0, `revalidateTag(tag)` took one argument and expired immediately. That form now fails type-checking and logs a deprecation warning, but still behaves like `updateTag`.

## Example

```jsx
// app/rt/actions.js
'use server';
import { revalidatePath, revalidateTag, updateTag, refresh } from 'next/cache';
import { bump } from '../../lib/api';

export async function path() { await bump(); revalidatePath('/rt'); return 'ret:path'; }
export async function tagMax() { await bump(); revalidateTag('v', 'max'); return 'ret:tagMax'; }
export async function upd() { await bump(); updateTag('v'); return 'ret:upd'; }
export async function ref() { await bump(); refresh(); return 'ret:ref'; }

// app/api/op/route.js
import { revalidatePath, revalidateTag, updateTag, refresh } from 'next/cache';
const ops = {
  path: () => revalidatePath('/rt'),
  tagMax: () => revalidateTag('v', 'max'),
  upd: () => updateTag('v'),
  ref: () => refresh(),
};
export async function GET(req) {
  const op = new URL(req.url).searchParams.get('op');
  try { ops[op](); return Response.json({ op, ok: true }); }
  catch (e) { return Response.json({ op, error: e.message }, { status: 500 }); }
}
```

`/rt` shows `v` from data tagged `v` and a render timestamp. From the page: `path` and `upd` showed the new `v` at once; `tagMax` left the page unchanged, the next `GET /rt` returned the old `v` with `x-nextjs-cache: STALE` and the one after it the new `v` with `HIT`; `ref` gave a new timestamp but the old `v`. From the route handler, `path` and `tagMax` returned `ok`; `upd` returned "updateTag can only be called from within a Server Action. To invalidate cache tags in Route Handlers or other contexts, use revalidateTag instead."

## Pitfalls

- Using `revalidateTag(tag, 'max')` after a user's own edit. Their re-rendered page still shows the old value; use `updateTag`.
- Expecting `refresh()` or `router.refresh()` to clear cached data. Both re-rendered with the cached `v`.
- Calling `revalidatePath('/blog')` when `/dashboard` shows the same posts. Only `/blog` is invalidated; tag the data instead.
- Trusting the render-time error's advice. `updateTag` during render said "Call it from a Server Action or Route Handler instead", but the route handler threw too.

## Follow-ups

**Q:** A CMS webhook must remove an entry right now. `updateTag` isn't available. What then?
**A:** `revalidateTag(tag, { expire: 0 })` in the route handler: per the docs, nothing stale is served and the next request blocks on a fresh render.

**Q:** What did `revalidatePath` from a route handler do to the next request?
**A:** On an ISR page, the next `GET` was a `MISS` with fresh data, not a `STALE` response; rendering happened on that request, not at the call.

**Q:** Does `revalidateTag('x')` with one argument still compile?
**A:** Not under TypeScript 5.9: `error TS2554: Expected 2 arguments, but got 1.` At runtime it worked and logged that it is deprecated.
