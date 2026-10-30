# 06 — Context and composition

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

Sharing data and logic between components: how context propagates and what it costs, composition patterns that avoid prop drilling, and custom hooks.

## Learning goals

After this chapter you can:

- Explain how a context value reaches consumers and why they all re-render
- Cut context re-renders by splitting contexts, memoizing values, or moving state out
- Choose between `children`, render props, compound components, and higher-order components
- Write a custom hook and say what it shares (logic) and what it doesn't (state)

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Context propagation: `createContext`, `<Context>` as provider, `useContext` and `use`, nearest provider, default values, bypassing `memo` → —
- Context performance: value identity, splitting state and dispatch, reducer plus context, when an external store fits better → —
- Composition: `children` and slot props, render props, compound components, higher-order components and why hooks replaced most of them → —
- Custom hooks: extracting logic, each call gets its own state, naming, hooks that return JSX → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [react.dev — Passing data deeply with context](https://react.dev/learn/passing-data-deeply-with-context)
- [react.dev — `useContext`](https://react.dev/reference/react/useContext)
- [react.dev — Scaling up with a reducer and context](https://react.dev/learn/scaling-up-with-reducer-and-context)
- [react.dev — Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [react.dev — Thinking in React](https://react.dev/learn/thinking-in-react)
