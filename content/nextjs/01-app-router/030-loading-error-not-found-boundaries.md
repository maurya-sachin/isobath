---
title: "How do `loading.js`, `error.js` and `not-found.js` map onto Suspense and error boundaries?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [app-router, loading, error-boundary, suspense, not-found, streaming, status-codes]
related:
  - nextjs/app-router/app-router-component-tree
  - react/suspense/suspense-mechanics
  - react/suspense/error-boundaries
  - nextjs/navigation/redirect-and-notfound-control-flow
  - nextjs/rendering/partial-prerendering-shell
verified: 2026-11
perishable:
  - "error.js retry prop stable since Next.js 16.3"
  - "Production Server Component errors arrive as React error #441"
sources:
  - https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy
  - https://nextjs.org/docs/app/api-reference/file-conventions/loading#instant-loading-states
  - https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes
  - https://nextjs.org/docs/app/api-reference/file-conventions/layout#interaction-with-loadingjs
  - https://nextjs.org/docs/app/api-reference/file-conventions/error#reference
  - https://nextjs.org/docs/app/api-reference/file-conventions/error#retry
  - https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
  - https://nextjs.org/docs/app/api-reference/file-conventions/not-found#not-foundjs
  - https://nextjs.org/docs/app/getting-started/error-handling#nested-error-boundaries
  - https://react.dev/errors/441
tldr: >
  `loading.js` becomes a `<Suspense>` fallback, `error.js` an error boundary and `not-found.js` a
  boundary for `notFound()`, all wrapped around the segment's page and child segments but not its
  own layout. Next.js adds what React lacks: server errors forwarded with a `digest`, a `retry`
  that refetches, and a 404 status only if streaming hasn't started.
---

## Answer

Each file is a boundary Next.js inserts for you, in this order under the segment's `layout` and `template`: `error.js` (an error boundary), then `loading.js` (a `<Suspense>` boundary whose fallback is the file), then `not-found.js`, then the page or the child segment. What the files add on top of React:

- **`loading.js`.** The fallback is part of the prefetched route, so a `<Link>` click shows it at once while the page renders on the server and streams in. On a first load it's in the initial HTML and the page streams in later. Because it sits below the segment's layout, it can't cover a slow layout in the same folder; the parent's `loading.js` can.
- **`error.js`.** Must be a Client Component. It catches errors from rendering the page and child segments, including **Server Component** errors, which Next.js forwards to the client: in production `error.message` is React's generic error #441 and `error.digest` matches the server log. `retry()` refetches and re-renders the segment; `reset()` only clears the error state. It doesn't catch its own layout's errors: the parent's `error.js` does, and `global-error.js` covers the root layout.
- **`not-found.js`.** Renders when `notFound()` is thrown in the segment or below, and for unmatched URLs at the root. Next.js adds `<meta name="robots" content="noindex">`.

The status code depends on **when** the boundary triggers. Before anything has streamed, `notFound()` yields a real `404`. Once a `loading.js` or `<Suspense>` fallback has been sent, the headers are gone, so the response stays `200` and the not-found UI streams in with `noindex`. With Cache Components, the prerendered shell is sent first, so a request-time `notFound()` also gives `200`. To return a real `404` there, check before streaming starts, for example in `proxy.ts`.

## Example

```jsx
// app/products/loading.jsx
export default function Loading() { return <p>Loading product…</p>; }

// app/products/error.jsx
'use client';
export default function Error({ error, retry }) {
  return <p>Failed ({error.digest}) <button onClick={() => retry()}>Retry</button></p>;
}

// app/products/not-found.jsx
export default function NotFound() { return <p>No such product.</p>; }

// app/products/[slug]/page.jsx
import { notFound } from 'next/navigation';
export default async function Product({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug); // uncached, ~500 ms
  if (!product) notFound();
  return <h1>{product.name}</h1>;
}
```

Next.js 16.4.5 under `next start`, Cache Components off, timed with a streaming `fetch`. `/products/mug` sent `200` headers and the fallback at 0.08 s and `<h1>Mug` at 0.57 s. `/products/nope` also answered `200`; its `noindex` tag streamed in at 0.56 s. `/products/boom` answered `200` and Chrome 156 and Firefox 159 showed `Failed (2773840547)`, the digest the server logged. Without the `loading.jsx`, `/nf/x` (same shape) answered `404`.

## Pitfalls

- Expecting `loading.js` to cover its own layout. A layout awaiting uncached data blocked a `<Link>` navigation for 1–2 seconds with the old page still showing; the same-folder fallback never appeared.
- Expecting `error.js` to catch its own layout. An error thrown in `app/err/layout-throw/layout.jsx` rendered `app/err/error.jsx`, not the sibling file.
- Relying on `notFound()` for a `404` status in a streamed page. The response was `200` with `noindex`; crawlers may count it as a soft 404.
- Showing `error.message` to users. In production a Server Component error's message is generic; log and match on `digest`.

## Follow-ups

**Q:** What's the difference between `retry()` and `reset()`?
**A:** `retry()`, stable since 16.3, re-fetches the segment from the server and re-renders it, so a transient failure can recover. `reset()` only clears the boundary's state and re-renders with what the client already has.

**Q:** Why does every page download `not-found.js`?
**A:** The docs say each `not-found.js` is sent with every route under its segment. The `No such product.` text was in the `/products/mug` response too. Keep a root `not-found.js` light.

**Q:** Do these boundaries catch errors in event handlers?
**A:** No. Like any React error boundary, they catch rendering errors; errors in event handlers or after an `await` in a callback need your own `try`/`catch`.
