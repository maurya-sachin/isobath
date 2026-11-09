# Next.js

> **Track:** Frontend
> **Status:** 🔴 planned · **Published:** 0/50 · **Last verified:** —

Next.js as a full-stack React framework: the App Router, rendering strategies, data fetching and caching, and deployment.
Interviews for React roles increasingly assume it, and the hard questions are about where code runs and what gets cached.

## Scope

- **In:** the App Router (layouts, routing, route handlers), static and dynamic rendering, streaming, data fetching and caching, Server Actions in Next.js, request interception, image/font/metadata optimization, runtimes and deployment, how the Pages Router differs.
- **Out:** React itself, including Server Components → [React](../react/) · API design → [HTTP and APIs](../http-and-apis/) · client-side data caching → [State and data fetching](../state-and-data-fetching/) · Core Web Vitals → [Web performance](../web-performance/).

## Prerequisites

[React](../react/).

## Chapters

<!-- generated:chapters:start -->
| # | Chapter | Status |
|---|---|---|
| 01 | [App Router structure](01-app-router/) | 🔴 |
| 02 | [Static, dynamic and prerendered](02-rendering/) | 🔴 |
| 03 | [Cache Components](03-cache-components/) | 🔴 |
| 04 | [Caching without Cache Components](04-previous-caching/) | 🔴 |
| 05 | [Mutations and revalidation](05-mutations/) | 🔴 |
| 06 | [Navigation and prefetching](06-navigation/) | 🔴 |
| 07 | [Route handlers, Proxy and request hooks](07-route-handlers-and-proxy/) | 🔴 |
| 08 | [Images, fonts, scripts and metadata](08-optimizations/) | 🔴 |
| 09 | [Build output, runtimes and self-hosting](09-deployment/) | 🔴 |
| 10 | [The Pages Router and migration](10-pages-router/) | 🔴 |
<!-- generated:chapters:end -->

## Not yet mapped

Areas this topic owns that have no chapter yet. Move an item into a chapter's sub-topics when the chapter exists.

- Streaming: no planned question covers it as its own topic; `loading.js` (01/030) and Partial Prerendering (02/030) touch it. React owns Suspense and streaming.

## Sources

- [Next.js docs](https://nextjs.org/docs)
- [Next.js blog](https://nextjs.org/blog) — release notes
- [vercel/next.js](https://github.com/vercel/next.js) — source and issues, for confirming edge cases
