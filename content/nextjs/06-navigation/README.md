# 06 — Navigation and prefetching

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

What happens when a `<Link>` is clicked: prefetching and Partial Prefetching, how the client router cache and `staleTimes` reuse pages, state kept on back navigation, and the control flow of `redirect()` and `notFound()`.

## Learning goals

After this chapter you can:

- Trace what happens between clicking a `<Link>` and the new page appearing
- Say what Next.js prefetches and what Partial Prefetching changed
- Explain how long the client router reuses a page and what `staleTimes` control
- Explain why a page keeps its state after back navigation with Cache Components on
- Explain why `redirect()` and `notFound()` throw, and what goes wrong inside a `try`/`catch`

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- A `<Link>` click to the rendered page → 010
- Prefetching and Partial Prefetching → 020
- Client router cache and `staleTimes` → 030
- Back navigation and state retention with `<Activity>` → 040
- `redirect()` and `notFound()` as thrown control flow → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What happens between clicking a `<Link>` and the new page appearing?](010-link-click-to-render.md) | hard | 🟡 draft |
| 020 | [What does Next.js prefetch, and what did Partial Prefetching change?](020-prefetch-and-partial-prefetching.md) | hard | 🟡 draft |
| 030 | [How long does the client router reuse a page, and what do `staleTimes` control?](030-client-router-cache-stale-times.md) | medium | 🟡 draft |
| 040 | [Why does a page keep its state after navigating back with Cache Components on?](040-state-retained-on-back-navigation.md) | medium | 🟡 draft |
| 050 | [Why do `redirect()` and `notFound()` throw, and what goes wrong in a `try`/`catch`?](050-redirect-and-notfound-control-flow.md) | medium | 🟡 draft |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Linking and navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [Next.js docs — `<Link>`](https://nextjs.org/docs/app/api-reference/components/link)
- [Next.js docs — `staleTimes`](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes)
- [Next.js docs — `partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching)
- [Next.js docs — Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching)
- [Next.js docs — Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)
- [Next.js docs — `redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [Next.js docs — `notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found)
- [Next.js docs — `unstable_rethrow`](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)
- [Next.js docs — `useLinkStatus`](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [react.dev — `<Activity>`](https://react.dev/reference/react/Activity)
