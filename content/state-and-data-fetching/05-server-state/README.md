# 05 — Server state and the query cache

> **Status:** 🔴 planned · **Published:** 0/6 · **Last verified:** —

Why server data is a different problem from client state, how the `QueryClient` cache is keyed, what `staleTime` and `gcTime` each control, what the status flags mean, and how structural sharing keeps re-renders small. RTK Query's cache is compared where it differs.

## Learning goals

After this chapter you can:

- Explain why server state needs staleness, deduplication and cache lifetimes that client state does not
- Explain how query keys identify cache entries and what bad keys break
- Distinguish `staleTime` from `gcTime`
- Pick the right status flag (`isPending`, `isFetching`, `isLoading`) for a spinner
- Explain structural sharing and why it reduces re-renders

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Server state vs client state → 010
- Query keys and cache entries → 020
- `staleTime` and `gcTime` → 030
- Status flags and observers in components → 040
- Structural sharing and re-renders → 050
- RTK Query cache model compared → 060

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [Why is server state a different problem from client state?](010-server-vs-client-state.md) | medium | 🔴 planned |
| 020 | [How do query keys identify cache entries, and what goes wrong with bad keys?](020-query-keys-cache-entries.md) | medium | 🔴 planned |
| 030 | [What is the difference between `staleTime` and `gcTime`?](030-staletime-vs-gctime.md) | medium | 🔴 planned |
| 040 | [What do `isPending`, `isFetching` and `isLoading` mean, and which drives a spinner?](040-pending-fetching-loading-flags.md) | medium | 🔴 planned |
| 050 | [What is structural sharing, and why does it matter for re-renders?](050-structural-sharing.md) | hard | 🔴 planned |
| 060 | [How does RTK Query's cache model differ from TanStack Query's?](060-rtk-query-vs-tanstack-cache.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [TanStack Query — Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [TanStack Query — Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [TanStack Query — Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [TanStack Query — Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching)
- [TanStack Query — Render optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations)
- [TanStack Query — `useQuery`](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
- [TanStack Query — `QueryClient`](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient)
- [`TanStack/query` at `v5.107.1` — `packages/query-core`](https://github.com/TanStack/query/tree/v5.107.1/packages/query-core)
- [Redux Toolkit — RTK Query cache behavior](https://redux.js.org/toolkit/rtk-query/usage/cache-behavior)
- [Redux Toolkit — RTK Query comparison](https://redux.js.org/toolkit/rtk-query/comparison)
