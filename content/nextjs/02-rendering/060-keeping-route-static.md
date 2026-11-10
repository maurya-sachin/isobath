---
title: "How do you keep a route static, and how do you find what made it dynamic?"
status: draft
difficulty: hard
frequency: 2
core: false
tags: [rendering, static-rendering, ensure-static, debugging, next-build, cache-components]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/previous-caching/segment-config-options
  - nextjs/cache-components/cached-functions-and-request-data
verified: 2026-11
perishable:
  - "ensureStatic stable since Next.js 16.4.0, needs cacheComponents"
  - "Dev indicator menu shows Route Static or Dynamic in 16.4.5"
sources:
  - https://nextjs.org/docs/app/guides/keeping-pages-static
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic#navigation
  - https://nextjs.org/docs/app/guides/caching-without-cache-components#dynamic
  - https://nextjs.org/docs/app/guides/building#debug-prerender-errors
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/devIndicators#indicator-not-marking-a-route-as-static
  - https://nextjs.org/docs/messages/static-route-dynamic
  - https://github.com/vercel/next.js/pull/99513
tldr: >
  Move request reads where they don't count: to the client, behind `<Suspense>`, or into the URL. Then make it a build error: `dynamic = 'error'` without Cache
  Components, `ensureStatic = 'navigation'` with them. To find the cause, read the route table and
  the dev indicator, then the build error; `next build --debug-prerender` adds a code frame.
---

## Answer

**Keeping it static** starts with knowing the usual causes: `cookies()` or `headers()` in a layout (auth state, theme, locale), awaited `searchParams`, unlisted `params`, and uncached data. Then:

- per-user UI (a "Hi, name" header) moves to the client, or with Cache Components behind `<Suspense>` so only that part renders per request;
- variants that live in the URL get a segment and `generateStaticParams` (`/[locale]/pricing`);
- shared data gets a cache: `fetch` with `cache: 'force-cache'` or `next.revalidate` without Cache Components, `use cache` with them.

**Guarding it** turns a regression into a failed build:

- Without Cache Components, `export const dynamic = 'error'`. In 16.4.5 a page whose header read cookies failed with ``Route /err-cookies with `dynamic = "error"` couldn't be rendered statically because it used `cookies()` ``; a `no-store` fetch was reported as `` `revalidate: 0 fetch <url>` ``.
- With Cache Components, `export const ensureStatic = 'navigation'` (stable since 16.4.0) on a page or layout. It requires the whole server-rendered route to prerender, so request data fails the build even inside `<Suspense>`. `'shell'` and `'prefetch'` cover only the prefetch stages. Without `cacheComponents` the export itself fails the build.

**Finding the cause:** the route table says *that* a route is dynamic (ƒ, or ◐ with Cache Components), and the `next dev` indicator menu says `Route Dynamic`, but neither says *why*. The guard errors name the API. Without Cache Components that's all you get, so search for the call, layouts included. With them, the build stack for a runtime read can be component names only (`at Suspense (<anonymous>)`); `next build --debug-prerender` disables server minification and enables source maps, which gave the exact line.

## Example

```jsx
// app/lib/Header.jsx
import { cookies } from 'next/headers';

export async function Header() {
  const user = (await cookies()).get('user')?.value ?? 'guest';
  return <header>Hi {user}</header>;
}

// app/es-nav/page.jsx
import { Suspense } from 'react';
import { Header } from '../lib/Header';

export const ensureStatic = 'navigation';

export default function Page() {
  return (
    <main>
      <Suspense fallback={<header>Hi…</header>}>
        <Header />
      </Suspense>
      <h1>Pricing</h1>
    </main>
  );
}
```

Next.js 16.4.5, Cache Components on. `next build` failed with `Route "/es-nav": Next.js encountered uncached or runtime data on a route that must be fully static.` and a stack of `Suspense`, `main`, `body`, `html`. `next build --debug-prerender` printed `at Header (app/lib/Header.jsx:3:30)` with a code frame under `await cookies()`.

## Pitfalls

- "Fixing" it with `dynamic = 'force-static'`. It forces `cookies()` and `headers()` to return empty values: with a `user=sachin` cookie the forced page still said `Hi guest`.
- Expecting `dynamic = 'error'` to name the component. It names the API (`cookies()`), not where it was called.
- Taking ◐ as a failure. With Cache Components a partial route is expected; use `ensureStatic` only where per-request server work is truly unwanted.
- Deploying a `--debug-prerender` build. The docs warn it is unminified and not optimized for production.

## Follow-ups

**Q:** Does the dev indicator explain why a route is dynamic?
**A:** Not in 16.4.5. Its menu showed `Route | Dynamic` for `/cookies` and `Route | Static` for `/` in Chrome 156 and Firefox 159; Route Info listed only the segment files. With Cache Components, the dev overlay shows blocking-route insights with source.

**Q:** Can a child segment loosen a parent's `ensureStatic`?
**A:** No. A child may set a stricter level; a weaker one fails the build ("A child segment cannot override a parent segment with a less-constrained `ensureStatic`"), per the docs.

**Q:** How do you check a big app faster?
**A:** `next build --debug-build-paths=<patterns>` builds only matching routes, and combines with `--debug-prerender`.
