# 03 — Redux and Redux Toolkit

> **Status:** 🔴 planned · **Published:** 0/6 · **Last verified:** —

The store, reducers and middleware that Redux is built on, what Redux Toolkit changes about writing them, memoized selectors with `useSelector`, normalized state with `createEntityAdapter`, and when Redux is the right choice at all.

## Learning goals

After this chapter you can:

- Explain what a reducer guarantees and what Redux Toolkit removes from hand-written Redux
- Explain how middleware wraps dispatch and where side effects belong
- Explain why `useSelector` re-renders and how memoized selectors limit it
- Explain why state is normalized and what `createEntityAdapter` provides
- Decide when Redux is the right choice and when it is not

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Store, actions and pure reducers → 010
- Redux Toolkit: `configureStore`, `createSlice`, Immer → 020
- Middleware and side effects (listener middleware) → 030
- `useSelector` re-renders and memoized selectors → 040
- Normalized state and `createEntityAdapter` → 050
- Redux vs lighter alternatives → 060

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What problem did Redux solve, and what does a reducer guarantee?](010-redux-problem-and-reducers.md) | medium | 🔴 planned |
| 020 | [What does Redux Toolkit change compared to hand-written Redux?](020-rtk-vs-hand-written-redux.md) | medium | 🔴 planned |
| 030 | [How does middleware work, and where should side effects run?](030-middleware-and-side-effects.md) | hard | 🔴 planned |
| 040 | [Why does `useSelector` re-render, and how do memoized selectors fix it?](040-useselector-rerenders-memoized.md) | hard | 🔴 planned |
| 050 | [Why normalize state, and what does `createEntityAdapter` give you?](050-normalize-state-entity-adapter.md) | medium | 🔴 planned |
| 060 | [When is Redux still the right choice, and when is it not?](060-redux-right-choice.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Redux — Thinking in Redux](https://redux.js.org/understanding/thinking-in-redux)
- [Redux — Migrating to Redux Toolkit 2](https://redux.js.org/usage/migrations/migrating-rtk-2)
- [Redux — Deriving data with selectors](https://redux.js.org/usage/deriving-data-selectors)
- [Redux — Normalizing state shape](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape)
- [Redux Toolkit — API reference](https://redux.js.org/toolkit/) (`configureStore`, `createSlice`, `createEntityAdapter`, `createListenerMiddleware`)
- [React Redux — Hooks](https://react-redux.js.org/api/hooks)
- [`reduxjs/redux-toolkit` at `v2.14.0`](https://github.com/reduxjs/redux-toolkit/tree/v2.14.0)
