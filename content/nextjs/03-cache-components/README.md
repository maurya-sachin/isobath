# 03 — Cache Components

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

The `use cache` directive and Cache Components: how cache keys are built, what cached functions can read, `cacheLife` profiles, the private and remote variants, and how they differ from React's `cache` and `unstable_cache`.

## Learning goals

After this chapter you can:

- Say what `use cache` caches and how its key is built
- Explain why a cached function can't read `cookies()` and how to pass request data into one
- Map `cacheLife` profiles to stale, revalidate and expire times
- Say when `use cache: private` or `use cache: remote` is needed
- Distinguish `use cache` from React's `cache` and from `unstable_cache`

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- `use cache`: what is cached and how the key is built → 010
- Cached functions and request data (`cookies()`, `headers()`) → 020
- `cacheLife` profiles: stale, revalidate and expire → 030
- `use cache: private` and `use cache: remote` → 040
- `use cache` vs React's `cache` and `unstable_cache` → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What does `use cache` cache, and how is its cache key built?](010-use-cache-keys.md) | hard | 🟡 draft |
| 020 | [Why can't a cached function read `cookies()`, and how do you pass request data into one?](020-cached-functions-and-request-data.md) | hard | 🔴 planned |
| 030 | [How do `cacheLife` profiles map to stale, revalidate and expire times?](030-cachelife-profiles.md) | medium | 🔴 planned |
| 040 | [When do you need `use cache: private` or `use cache: remote`?](040-private-and-remote-cache.md) | hard | 🔴 planned |
| 050 | [How does `use cache` differ from React's `cache` and from `unstable_cache`?](050-use-cache-vs-other-caches.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Next.js docs — `use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
- [Next.js docs — `use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
- [Next.js docs — `cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)
- [Next.js docs — `cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)
- [Next.js docs — `cacheComponents` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Next.js docs — Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- [react.dev — `cache`](https://react.dev/reference/react/cache)
