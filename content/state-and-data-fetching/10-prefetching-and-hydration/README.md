# 10 — Prefetching and hydration

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Prefetching on intent and in loaders, hydrating a client query cache from server-rendered data with `dehydrate` and `HydrationBoundary`, why hydrated data can refetch right away and how `staleTime` prevents it, how Server Components and a client cache share data, and what persisting the cache buys and breaks.

## Learning goals

After this chapter you can:

- Decide when a prefetch is worth its cost and when it is wasteful
- Hydrate a client query cache from server-rendered data with `dehydrate` and `HydrationBoundary`
- Explain why hydrated data refetches on mount and how `staleTime` stops it
- Explain how Server Components and a client query cache can avoid fetching the same data twice
- Explain what persisting a query cache to storage gains and what it can break

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Prefetch on intent and in loaders → 010
- `dehydrate` and `HydrationBoundary` → 020
- Immediate refetch after hydration and `staleTime` → 030
- Server Components and client cache without double fetching → 040
- Persisting the query cache → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How do you prefetch data before the user needs it, and when is it wasteful?](010-prefetch-on-intent.md) | medium | 🔴 planned |
| 020 | [How do you hydrate a client query cache from server-rendered data?](020-hydrate-query-cache.md) | hard | 🔴 planned |
| 030 | [Why can hydrated data refetch immediately, and how does `staleTime` prevent it?](030-hydrated-data-refetch.md) | medium | 🔴 planned |
| 040 | [How do Server Components and a client query cache share data without double fetching?](040-rsc-and-query-cache.md) | hard | 🔴 planned |
| 050 | [What does persisting a query cache to storage buy, and what can it break?](050-persist-query-cache.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [TanStack Query — Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)
- [TanStack Query — Server rendering and hydration](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)
- [TanStack Query — Advanced server rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [TanStack Query — Hydration reference](https://tanstack.com/query/latest/docs/framework/react/reference/hydration)
- [TanStack Query — `persistQueryClient` plugin](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [React — `useSyncExternalStore` (server snapshot)](https://react.dev/reference/react/useSyncExternalStore)
