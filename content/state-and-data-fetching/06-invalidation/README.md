# 06 — Invalidation and refetching

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

When a cached query refetches on its own, how `invalidateQueries` treats active and inactive queries, how to choose between invalidating and updating the cache after a write, how polling interacts with focus and background tabs, and how RTK Query tags drive the same idea.

## Learning goals

After this chapter you can:

- List the automatic refetch triggers and how to turn each one off or tune it
- Explain what `invalidateQueries` does to active and inactive queries
- Choose between invalidating and writing the response into the cache after a mutation
- Explain how `refetchInterval` behaves when the tab is hidden or the window loses focus
- Explain how RTK Query tags map a mutation to the queries it should refetch

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Automatic refetch on mount, focus and reconnect → 010
- `invalidateQueries` on active and inactive queries → 020
- Invalidate or update after a mutation → 030
- Polling and background tabs → 040
- RTK Query tags and automated refetching → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [When does TanStack Query refetch on its own, and how do you control it?](010-auto-refetch-triggers.md) | medium | 🔴 planned |
| 020 | [What does `invalidateQueries` do to active and inactive queries?](020-invalidate-active-inactive.md) | medium | 🔴 planned |
| 030 | [Invalidate or update the cache after a mutation: how do you choose?](030-invalidate-or-update-after-mutation.md) | medium | 🔴 planned |
| 040 | [How do polling and `refetchInterval` interact with focus and background tabs?](040-polling-and-background-tabs.md) | medium | 🔴 planned |
| 050 | [How do RTK Query tags drive invalidation?](050-rtk-query-tags.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [TanStack Query — Window focus refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching)
- [TanStack Query — Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [TanStack Query — Invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [TanStack Query — Updates from mutation responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses)
- [Redux Toolkit — RTK Query automated refetching](https://redux.js.org/toolkit/rtk-query/usage/automated-refetching)
