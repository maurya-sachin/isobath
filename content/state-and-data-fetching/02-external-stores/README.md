# 02 — External stores and tearing

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Subscriptions to stores that live outside React, how `useSyncExternalStore` reads them, why snapshots must be cached, how concurrent rendering causes tearing, and what server snapshots solve.

## Learning goals

After this chapter you can:

- Explain the subscribe and snapshot contract that `useSyncExternalStore` requires
- Define tearing and show how concurrent rendering produces it
- Explain why `getSnapshot` must return a cached value
- Explain what `getServerSnapshot` solves and why it must match the first client render
- Explain why a store update inside a transition still renders synchronously

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- External store, subscribe and snapshot contract → 010
- Subscriptions and unsubscribe on unmount → 010
- Tearing and concurrent rendering → 020
- Snapshot caching in `getSnapshot` → 030
- Server snapshots and hydration match → 040
- Store updates inside transitions → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What is an external store, and what contract does `useSyncExternalStore` require?](010-external-store-contract.md) | hard | 🔴 planned |
| 020 | [What is tearing, and how does concurrent rendering cause it?](020-tearing-concurrent-rendering.md) | hard | 🔴 planned |
| 030 | [Why must `getSnapshot` return a cached value, and what happens if it does not?](030-get-snapshot-caching.md) | medium | 🔴 planned |
| 040 | [What does `getServerSnapshot` solve, and why must it match the first client render?](040-get-server-snapshot.md) | hard | 🔴 planned |
| 050 | [Why does a store update inside `startTransition` still render synchronously?](050-store-update-in-transition.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [React — `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [`facebook/react` at `v19.3.1` — `packages/react-reconciler`](https://github.com/facebook/react/tree/v19.3.1/packages/react-reconciler)
- [React WG — Discussion #69 (tearing)](https://github.com/reactwg/react-18/discussions/69)
