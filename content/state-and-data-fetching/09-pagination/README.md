# 09 — Pagination and infinite queries

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

Offset and cursor pagination and what each breaks when data changes, keeping the previous page on screen with `placeholderData`, how `useInfiniteQuery` stores and refetches pages, and how to bound memory in a long infinite list.

## Learning goals

After this chapter you can:

- Choose offset or cursor pagination and say what breaks when data changes underneath
- Keep the previous page visible while the next one loads
- Explain how `useInfiniteQuery` stores pages and what a refetch does to them
- Bound memory in a long infinite list

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Offset vs cursor pagination → 010
- `placeholderData` and keeping the old page → 020
- `useInfiniteQuery` page storage and refetch → 030
- Bounding memory with `maxPages` → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [Offset or cursor pagination: what breaks when data changes underneath?](010-offset-vs-cursor-pagination.md) | medium | 🔴 planned |
| 020 | [How do you keep the old page on screen while the next one loads?](020-keep-old-page-on-screen.md) | medium | 🔴 planned |
| 030 | [How does `useInfiniteQuery` store pages, and what happens on refetch?](030-infinite-query-pages-refetch.md) | hard | 🔴 planned |
| 040 | [How do you bound memory in a long infinite list?](040-bound-infinite-list-memory.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [TanStack Query — Paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [TanStack Query — Infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [TanStack Query — `useInfiniteQuery`](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery)
- [Redux Toolkit — RTK Query infinite queries](https://redux.js.org/toolkit/rtk-query/usage/infinite-queries)

## Open questions

- [ ] Which RTK release added RTK Query infinite queries? The docs page does not say; check the Redux Toolkit release notes.
