---
title: "Why are `params`, `searchParams`, `cookies()` and `headers()` async?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [rendering, request-time-apis, params, search-params, cookies, headers, migration]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/partial-prerendering-shell
  - react/suspense/use-api
  - react/suspense/suspense-mechanics
verified: 2026-11
perishable:
  - "Synchronous access removed in Next.js 16"
  - "Reference pages still describe Next.js 15 sync compatibility"
sources:
  - https://nextjs.org/blog/next-15#async-request-apis-breaking-change
  - https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change
  - https://nextjs.org/docs/app/api-reference/file-conventions/page#params-optional
  - https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional
  - https://nextjs.org/docs/app/api-reference/file-conventions/page#reading-searchparams-and-params-in-client-components
  - https://nextjs.org/docs/app/api-reference/functions/cookies#good-to-know
  - https://nextjs.org/docs/app/getting-started/caching#maximizing-the-static-shell
tldr: >
  So Next.js can render before it has the request. Each is a promise: code that doesn't await it can be
  prerendered or sent first, and the `await` marks exactly where request data is needed, so the
  awaiting subtree alone waits. Since Next.js 16 they are async only: `cookies().get` throws a
  `TypeError` and `params.slug` is `undefined`.
---

## Answer

Request data used to be synchronous: `cookies()` returned the store and `params` was a plain object. That forces the request to exist before the component starts, so nothing in that render can happen ahead of time.

Next.js 15 changed `cookies()`, `headers()`, `draftMode()`, `params` (in layouts, pages, route handlers, `default.js` and image metadata files) and `searchParams` (in pages) to promises. The 15 release post gives the reason: Next.js wants to prepare as much as possible before a request arrives, so it needs to know *when* a component waits for the request. Next.js 16 removed the temporary synchronous access.

A promise splits "this component can receive request data" from "this component needs it now":

- A layout or page can pass `params` or `searchParams` down without awaiting. Only the child that awaits waits.
- With Cache Components, everything outside the `<Suspense>` boundary around that `await` is prerendered into the static shell, and only the awaiting subtree streams per request.
- Without Cache Components, the `await` is what makes the route dynamic: a page that receives `searchParams` but never awaits it stayed static (○) in 16.4.5.

Server Components use `await`; a Client Component page reads the same promises with React's `use(params)`.

*Legacy:* up to 14 these were synchronous; 15 kept synchronous access with warnings; 16.0 removed it.

## Example

```jsx
// app/shop/[slug]/page.jsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';

export function generateStaticParams() {
  return [{ slug: 'shoes' }];
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;
  return (
    <main>
      <h1>{slug}</h1>
      <Suspense fallback={<p>Loading filters…</p>}>
        <Filters searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Filters({ searchParams }) {
  const { sort = 'new' } = await searchParams;
  const currency = (await cookies()).get('currency')?.value ?? 'USD';
  return <p>Sorted by {sort}, prices in {currency}</p>;
}
```

Next.js 16.4.5 with Cache Components: `/shop/shoes` built as ◐, and its prerendered HTML holds `<h1>shoes</h1>` and the fallback; the filter line streams per request. With Cache Components off, the same file built as `ƒ /shop/[slug]` and `generateStaticParams` produced nothing.

## Pitfalls

- Reading synchronously. In 16.4.5 `cookies().get('theme')` failed at request time with `TypeError: … .get is not a function` (a 500), while `params.slug` and `searchParams.q` were silently `undefined`, and the page reading `searchParams.q` was even prerendered as static. TypeScript catches it: `Property 'q' does not exist on type 'Promise<…>'` (TS2339).
- Trusting the reference pages for `cookies`, `headers` and `page`: they still say synchronous access works "in Next.js 15". The version 16 upgrade guide and the 16.4.5 runtime agree it's gone.
- Awaiting `params` at the top of a layout "to get it over with". Everything under it then waits for the request; pass the promise down and await it inside `<Suspense>`.

## Follow-ups

**Q:** Why is the `params` argument of `generateStaticParams` still synchronous?
**A:** It runs during the build, not for a request, and only receives parent segments' params that a parent `generateStaticParams` already produced. The docs call this out as synchronous access.

**Q:** Is there a codemod?
**A:** Yes: `npx @next/codemod@canary next-async-request-api .`, from the Next.js 15 release. For types, `npx next typegen` generates the global `PageProps` and `LayoutProps` helpers, whose `params` and `searchParams` are promises.

**Q:** Does awaiting `params` always make a route dynamic?
**A:** No. A value listed by `generateStaticParams` is known at build time, so awaiting it still prerenders (`/shop/shoes` above). Only unlisted values are request data.
