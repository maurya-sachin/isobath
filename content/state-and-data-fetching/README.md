# State and data fetching

> **Covers:** React 19.3, Redux Toolkit 2.14, TanStack Query 5.107, Zustand 5.1, Jotai 3.0
> **Track:** Frontend
> **Status:** 🔴 planned · **Published:** 0/51 · **Last verified:** —

Where client state lives once it outgrows a component, and how server data is fetched, cached, and kept fresh on the client.
Frontend interviews use it to separate people who reach for a library from people who can say what problem it solves.

## Scope

- **In:** client state vs server state, external stores and `useSyncExternalStore`, Redux and Redux Toolkit, lightweight stores (Zustand, signals), TanStack Query and RTK Query, client-side caching and invalidation, optimistic updates, request races and cancellation, URL and form state.
- **Out:** `useState`, context, and rendering → [React](../react/) · framework caching and Server Components data → [Next.js](../nextjs/) · `fetch` and `AbortController` as Web APIs → [Browser runtime](../browser/) · the API on the other end → [HTTP and APIs](../http-and-apis/) · server-side caches → [Caching](../caching/).

## Prerequisites

[React](../react/) — especially state, effects, and context.

## Chapters

<!-- generated:chapters:start -->
| # | Chapter | Status |
|---|---|---|
| 01 | [Classifying state](01-classifying-state/) | 🔴 |
| 02 | [External stores and tearing](02-external-stores/) | 🔴 |
| 03 | [Redux and Redux Toolkit](03-redux/) | 🔴 |
| 04 | [Lightweight stores and signals](04-lightweight-stores/) | 🔴 |
| 05 | [Server state and the query cache](05-server-state/) | 🔴 |
| 06 | [Invalidation and refetching](06-invalidation/) | 🔴 |
| 07 | [Mutations and optimistic updates](07-mutations/) | 🔴 |
| 08 | [Fetching correctness](08-fetching-correctness/) | 🔴 |
| 09 | [Pagination and infinite queries](09-pagination/) | 🔴 |
| 10 | [Prefetching and hydration](10-prefetching-and-hydration/) | 🔴 |
<!-- generated:chapters:end -->

## Sources

- [React — Managing state](https://react.dev/learn/managing-state)
- [React — `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [Redux docs](https://redux.js.org/)
- [Redux Toolkit](https://redux.js.org/toolkit/) and [RTK Query](https://redux.js.org/toolkit/rtk-query/overview)
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Zustand docs](https://zustand.docs.pmnd.rs/)
