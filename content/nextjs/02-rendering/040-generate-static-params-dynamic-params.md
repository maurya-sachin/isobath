---
title: "How do `generateStaticParams` and `dynamicParams` handle paths unknown at build time?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [rendering, generate-static-params, dynamic-params, isr, dynamic-routes, cache-components]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/mutations/isr-and-on-demand-revalidation
  - nextjs/navigation/redirect-and-notfound-control-flow
verified: 2026-11
perishable:
  - "dynamicParams rejected at build with cacheComponents in 16.4.5"
  - "Empty generateStaticParams fails the build with Cache Components"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/generate-static-params#all-paths-at-runtime
  - https://nextjs.org/docs/app/api-reference/functions/generate-static-params#disable-rendering-for-unspecified-paths
  - https://nextjs.org/docs/app/api-reference/functions/generate-static-params#with-cache-components
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/dynamicParams
  - https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
  - https://nextjs.org/docs/messages/empty-generate-static-params
  - https://nextjs.org/docs/app/guides/streaming#status-codes
tldr: >
  `generateStaticParams` lists the param values to prerender at build. For any other value,
  `dynamicParams = true` (the default) renders the page on its first request and caches it, like ISR;
  `false` returns 404 without rendering. With Cache Components, `dynamicParams` is rejected: unlisted
  values get the App Shell, then a cached page, and `notFound()` replaces `false`.
---

## Answer

A dynamic segment such as `[id]` has no fixed URL, so `next build` can't prerender it unless told which values exist. `generateStaticParams` returns that list (`[{ id: '1' }]`); it runs once during the build, before the page renders, and is not called again on revalidation. Each listed value becomes a prerendered page (● in the route table). Without the function the route renders per request (ƒ).

Unlisted values depend on the rendering model.

**Without Cache Components**, `dynamicParams` decides:

- `true` (default): the first request renders the page, the response is cached, and later requests get the cached copy. That's ISR on demand, the App Router's version of `getStaticPaths` with `fallback: 'blocking'`.
- `false`: an unlisted value returns 404 immediately, without running the page.

Returning `[]` prerenders nothing at build time but keeps the route ●, so every path is generated on its first visit.

**With `cacheComponents: true`**, `dynamicParams` fails the build ("not compatible with `nextConfig.cacheComponents`"), and an empty array fails it too: Next.js needs at least one real value to check the route for request-time access. An unlisted value is served the route's **App Shell** (the prerender with param-dependent parts behind `<Suspense>` fallbacks), its content streams in, and the completed page is cached for the next visit. To reject unknown values you call `notFound()` when the data lookup fails.

That last step has an HTTP catch: with Cache Components the shell starts a `200` response before `notFound()` runs, so the first visit to a bad id gets `200` plus `<meta name="robots" content="noindex">`; the docs suggest Proxy for a request-time 404.

## Example

```jsx
// app/products/[id]/page.jsx
import { notFound } from 'next/navigation';
import { getProduct } from '../../data';

export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default async function Page({ params }) {
  const { id } = await params;
  const name = await getProduct(id);
  if (!name) notFound();
  return <h1>{name}</h1>;
}
```

Next.js 16.4.5, Cache Components off, `getProduct` waits 500 ms. With `true`: `/products/2` took 0.57 s with `x-nextjs-cache: MISS`, then 0.003 s with `HIT`; `/products/9` returned 404 and that 404 was cached too. With `false`: `/products/2` returned 404 in 7 ms, without calling `getProduct`.

## Pitfalls

- Using `dynamicParams = false` as authorization. It only checks the URL against the build-time list; it says nothing about who may see the page.
- Expecting a new item to appear without a rebuild when `dynamicParams` is `false`. It returns 404 until the next build lists it.
- Ignoring cache growth. Every distinct unknown value, including a bot's random slugs, became its own cached page, 404s included.
- Checking only the first response's status code with Cache Components on. The same page without the `dynamicParams` export and with `getProduct` in `use cache` returned 200 with `noindex` for an unknown id on the first request, and 404 from the cache on the second.

## Follow-ups

**Q:** How do nested segments share the work?
**A:** A child's `generateStaticParams` receives each parent's params (synchronously) and runs once per parent value. A page can also return all segments itself: `[{ category: 'a', product: 'x' }]`.

**Q:** What does the docs' placeholder trick do with Cache Components?
**A:** Returning `[{ slug: '__placeholder__' }]` satisfies "at least one result" when no real values are known, then the page calls `notFound()` for it. The docs warn it weakens build-time validation.

**Q:** Does `generateStaticParams` work in route handlers?
**A:** Yes. `route.js` can export it to generate GET responses at build time for each listed value.
