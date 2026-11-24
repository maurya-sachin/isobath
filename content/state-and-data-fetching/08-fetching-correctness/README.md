# 08 — Fetching correctness

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Races between responses and the UI, cancellation and what it actually stops, request waterfalls and how to flatten them, deduplication in a query cache, and how retries, timeouts and error states should behave.

## Learning goals

After this chapter you can:

- Show how a fetch in an effect can display stale data, and fix the race
- Explain what cancelling a request stops and what it does not
- Find a request waterfall and flatten it
- Explain how a query cache deduplicates requests and when it does not
- Design retry, timeout and error behaviour for a query

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Effect fetch races and stale responses → 010
- `AbortController`, `signal` and cancellation → 020
- Request waterfalls → 030
- Query deduplication → 040
- Retries, timeouts and error states → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does a fetch in `useEffect` show stale data, and how do you fix the race?](010-effect-fetch-race.md) | medium | 🔴 planned |
| 020 | [How do you cancel a request, and what does cancellation actually stop?](020-cancel-request-scope.md) | medium | 🔴 planned |
| 030 | [What is a request waterfall, and how do you find and flatten one?](030-request-waterfall.md) | hard | 🔴 planned |
| 040 | [How does a query cache deduplicate requests, and when does it not?](040-query-cache-dedupe.md) | medium | 🔴 planned |
| 050 | [How should retries, timeouts and error states behave for a query?](050-retries-timeouts-errors.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [React — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React — You might not need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [TanStack Query — Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
- [TanStack Query — Query retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [TanStack Query — Request waterfalls](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls)
- [TanStack Query — Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)
- [MDN — `AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [WHATWG — Fetch Standard](https://fetch.spec.whatwg.org/)
