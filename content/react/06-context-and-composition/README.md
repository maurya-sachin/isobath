# 06 — Context and composition

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

Sharing data and logic between components: how context propagates and what it costs, composition patterns that avoid prop drilling, and custom hooks.

## Learning goals

After this chapter you can:

- Explain how a context value reaches consumers and why they all re-render
- Cut context re-renders by splitting contexts, memoizing values, or moving state out
- Choose between `children`, render props, compound components, and higher-order components
- Write a custom hook and say what it shares (logic) and what it doesn't (state)

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Context propagation: `createContext`, `<Context>` as provider, `useContext` and `use`, nearest provider, default values, bypassing `memo` → 010
- Context performance: value identity, splitting state and dispatch, reducer plus context, when an external store fits better → 020
- Composition: `children` and slot props, render props, compound components, higher-order components and why hooks replaced most of them → 030
- Custom hooks: extracting logic, each call gets its own state, naming, hooks that return JSX → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does context reach consumers, and why do they all re-render?](010-context-propagation.md) | medium | 🔴 planned |
| 020 | [How do you stop context changes from re-rendering too much?](020-context-performance.md) | hard | 🔴 planned |
| 030 | [How do children, render props, compound components, and HOCs compare?](030-composition-patterns.md) | medium | 🔴 planned |
| 040 | [What do custom hooks share between components, and what don't they?](040-custom-hooks.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — Passing data deeply with context](https://react.dev/learn/passing-data-deeply-with-context)
- [react.dev — `useContext`](https://react.dev/reference/react/useContext)
- [react.dev — Scaling up with a reducer and context](https://react.dev/learn/scaling-up-with-reducer-and-context)
- [react.dev — Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [react.dev — Thinking in React](https://react.dev/learn/thinking-in-react)
