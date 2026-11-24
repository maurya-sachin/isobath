# 07 — Mutations and optimistic updates

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

`useMutation` and its lifecycle, optimistic updates through the query cache and through the UI, rollback on failure, cancelling in-flight reads before a write, ordering and retries of overlapping mutations, and how React's `useOptimistic` fits alongside a query library.

## Learning goals

After this chapter you can:

- Implement an optimistic update with a rollback path using `useMutation`
- Explain the difference between optimistic cache writes and optimistic UI state
- Explain why in-flight queries are cancelled before an optimistic write
- Explain what overlapping or retried mutations do to the same item, and how `scope` serialises them
- Explain how React's `useOptimistic` relates to a query library's optimistic update

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- `useMutation` lifecycle and optimistic update with rollback → 010
- Optimistic cache vs optimistic UI → 020
- Cancelling in-flight queries before a write → 030
- Overlapping mutations, `scope` and retries → 040
- `useOptimistic` and query-library optimistic updates → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How do you implement an optimistic update with rollback?](010-optimistic-update-rollback.md) | hard | 🔴 planned |
| 020 | [Optimistic through the cache or through the UI: what is the difference?](020-optimistic-cache-vs-ui.md) | medium | 🔴 planned |
| 030 | [Why cancel in-flight queries before an optimistic write?](030-cancel-queries-before-write.md) | hard | 🔴 planned |
| 040 | [What happens when two mutations to the same item overlap or retry?](040-overlapping-mutations-retry.md) | hard | 🔴 planned |
| 050 | [How do `useOptimistic` and a query library's optimistic update fit together?](050-optimistic-with-query-library.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [TanStack Query — Optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query — `useMutation`](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
- [React — `useOptimistic`](https://react.dev/reference/react/useOptimistic)
