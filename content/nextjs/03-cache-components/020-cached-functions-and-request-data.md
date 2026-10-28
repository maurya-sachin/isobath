---
title: "Why can't a cached function read `cookies()`, and how do you pass request data into one?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [cache-components, use-cache, cookies, headers, request-time-apis, caching]
related:
  - nextjs/cache-components/use-cache-keys
  - nextjs/cache-components/private-and-remote-cache
  - nextjs/rendering/async-request-apis
  - nextjs/rendering/partial-prerendering-shell
verified: 2026-11
perishable:
  - "Error text for next-request-in-use-cache in Next.js 16.4.5"
  - "Prerender cache-fill timeout message differs from the docs' wording"
sources:
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#request-time-apis
  - https://nextjs.org/docs/app/api-reference/directives/use-cache#build-hangs-cache-timeout
  - https://nextjs.org/docs/app/getting-started/caching#passing-runtime-values-to-cached-functions
  - https://nextjs.org/docs/messages/next-request-in-use-cache
  - https://nextjs.org/docs/app/api-reference/directives/use-cache-private#request-apis-allowed-in-private-caches
tldr: >
  A `use cache` entry is shared by every request with matching arguments, and may be filled at build
  time, with no request. Request data read inside would leak between users, so Next.js throws. Read `cookies()` in an uncached component under `<Suspense>` and pass
  the value you need as an argument; it then joins the key.
---

## Answer

A `use cache` function's key is built from its build ID, its identity and its **arguments**. Its output is reused for every later call with the same key, by any user, and it may be computed during `next build`, when no request exists. If the body could call `cookies()` or `headers()`, the result would depend on something that isn't in the key: user A's cookie would decide what user B sees. So Next.js forbids it. `cookies()`, `headers()`, `searchParams` and `connection()` all throw inside a cached scope, and the rule follows the call stack: a helper that reads `headers()` fails the same way when a cached function calls it. `draftMode().isEnabled` is the documented exception.

The fix is to move the read up one level and pass the value down:

1. An uncached component reads `cookies()`. Under Cache Components it must sit inside `<Suspense>`, so it becomes a request-time hole in the static shell.
2. It extracts only what the cached work depends on (a currency, a locale, a boolean) and calls the cached function with that value.
3. The value is now an argument, so it is part of the key: one entry per currency, not one shared answer.

Pass the smallest value that decides the output. A session ID makes one entry per user; a currency gives a handful shared by everyone. Pass the resolved value, never the `cookies()` promise itself, which hangs the build.

When refactoring isn't practical, or per-user data must stay out of shared server caches, `use cache: private` allows request APIs at the cost of no server-side reuse across requests.

## Example

```jsx
// app/c-pass/page.jsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';

async function getPrices(currency) {
  'use cache';
  cacheLife('hours');
  console.log('RUN getPrices', currency);
  const res = await fetch(`http://localhost:4999/prices?c=${currency}`);
  return (await res.json()).n;
}

async function Prices() {
  const currency = (await cookies()).get('currency')?.value ?? 'USD';
  return <p>{currency} v{await getPrices(currency)}</p>;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading prices…</p>}>
      <Prices />
    </Suspense>
  );
}
```

Next.js 16.4.5, `next build && next start`: the route built as `◐ /c-pass`. Requests with `currency=USD`, `USD`, `EUR` logged `RUN getPrices USD` and `RUN getPrices EUR` only.

## Pitfalls

- Reading `cookies()` inside the cached function. On a static route the build failed: ``Route "/c-static": `cookies()` can't be read inside `"use cache"`. Read it outside the cached function and pass what you need as an argument.``
- Trusting a green build. A helper reading `headers()`, called from a cached function on a ◐ route, built fine; every request then failed in the hole with the same message, served with status 200.
- Passing `cookies()` (the promise) as a prop. The build stalled for about 50 seconds, then failed with ``A `"use cache"` function took too long during prerendering.`` (the docs still quote an older "Filling a cache during prerender timed out" message).
- Doing the read at the top of the page without `<Suspense>`. Cache Components rejects request data outside a boundary.

## Follow-ups

**Q:** Why does the request-time failure still return 200?
**A:** The shell was already sent. The error happened while resuming the postponed boundary, after headers went out, so it surfaced as an error digest in the stream for the nearest error boundary, not as a status code.

**Q:** Does passing a cookie value as an argument risk serving one user's data to another?
**A:** Not for that value: it is in the key. The risk returns if the cached function reaches other per-user state another way, such as a module-level variable set earlier in the request.

**Q:** Can a cached function read `params`?
**A:** Pass the resolved value. `params` is a promise; awaiting request-time data inside the cache is the same hang as passing `cookies()`.

## Exercises

### Which call fails, and when?

```jsx
// lib/locale.js
import { headers } from 'next/headers';
export async function readLocale() {
  return (await headers()).get('accept-language') ?? 'en';
}

// app/c-dyn/page.jsx: getGreeting is called inside <Suspense> after awaiting searchParams
async function getGreeting(q) {
  'use cache';
  return `${q} ${await readLocale()}`;
}
```

**Answer:** `readLocale()` throws because it runs inside the cached scope. The route is ◐, so `next build` passes; under `next start` each request logged ``Route "/c-dyn": `headers()` can't be read inside `"use cache"`.`` Fix: call `readLocale()` in the uncached caller and pass `locale` as a second argument.
