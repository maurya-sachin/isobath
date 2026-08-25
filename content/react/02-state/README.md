# 02 — State and updates

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

How component state behaves: each render sees a snapshot, updates are queued and batched, objects and arrays are replaced rather than mutated, and state is structured so nothing is stored twice.

## Learning goals

After this chapter you can:

- Explain why state reads stale right after a setter call
- Predict the result of several queued updates, with and without updater functions
- Choose between `useState` and `useReducer`
- Update nested objects and arrays without mutation, and say what breaks when you mutate
- Lift state up and derive values instead of syncing copies

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- State as a snapshot: values fixed per render, closures in handlers and timeouts → 010
- Queueing updates: automatic batching, updater functions, `flushSync` → 020
- `useReducer`: reducers as pure functions, dispatch, when a reducer beats several `useState` calls → 030
- Immutable updates: `Object.is` bail-out, spreading nested objects, array methods that copy → 040
- Structuring state: lifting state up, single source of truth, derived values, redundant and duplicated state → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [Why does state still hold the old value right after you set it?](010-state-as-snapshot.md) | medium | 🟡 draft |
| 020 | [How does React batch state updates, and when do you need an updater function?](020-batching-and-updater-functions.md) | medium | 🟡 draft |
| 030 | [When should you use `useReducer` instead of `useState`?](030-use-reducer.md) | medium | 🟡 draft |
| 040 | [Why must React state be updated immutably?](040-immutable-updates.md) | medium | 🟡 draft |
| 050 | [How do you decide where state lives and what not to store?](050-structuring-state.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — State as a snapshot](https://react.dev/learn/state-as-a-snapshot)
- [react.dev — Queueing a series of state updates](https://react.dev/learn/queueing-a-series-of-state-updates)
- [react.dev — `useState`](https://react.dev/reference/react/useState)
- [react.dev — `useReducer`](https://react.dev/reference/react/useReducer)
- [react.dev — Updating objects in state](https://react.dev/learn/updating-objects-in-state)
- [react.dev — Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- [react.dev — Sharing state between components](https://react.dev/learn/sharing-state-between-components)
- [React 18 — automatic batching](https://github.com/reactwg/react-18/discussions/21)
