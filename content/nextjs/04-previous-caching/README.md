# 04 — Caching without Cache Components

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

Caching as Next.js does it today with Cache Components off: what is cached and where, how the defaults changed from 14 to 16, segment config options, and when `fetch` calls are deduplicated.

## Learning goals

After this chapter you can:

- Say what Next.js caches without Cache Components, and where
- Trace how the caching defaults changed from Next.js 14 to 15 to 16, and why
- Explain what the `dynamic`, `revalidate` and `fetchCache` segment configs do
- Predict when two `fetch` calls are deduplicated and when they are not

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- What is cached without Cache Components, and where → 010
- Caching defaults across Next.js 14, 15 and 16 → 020
- Segment config: `dynamic`, `revalidate`, `fetchCache` → 030
- `fetch` request deduplication → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [Without Cache Components, what does Next.js cache, and where?](010-default-cache-locations.md) | hard | 🟡 draft |
| 020 | [How did caching defaults change from Next.js 14 to 15 to 16, and why?](020-caching-defaults-14-to-16.md) | medium | 🔴 planned |
| 030 | [What do `dynamic`, `revalidate` and `fetchCache` segment configs do?](030-segment-config-options.md) | medium | 🔴 planned |
| 040 | [When are two `fetch` calls deduplicated, and when are they not?](040-fetch-request-deduplication.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)
- [Next.js docs — `fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch)
- [Next.js docs — `unstable_cache`](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [Next.js docs — Route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
