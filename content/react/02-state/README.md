# 02 — State and updates

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

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

- State as a snapshot: values fixed per render, closures in handlers and timeouts → —
- Queueing updates: automatic batching, updater functions, `flushSync` → —
- `useReducer`: reducers as pure functions, dispatch, when a reducer beats several `useState` calls → —
- Immutable updates: `Object.is` bail-out, spreading nested objects, array methods that copy → —
- Structuring state: lifting state up, single source of truth, derived values, redundant and duplicated state → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
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
