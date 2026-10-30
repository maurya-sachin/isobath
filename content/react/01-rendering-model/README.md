# 01 — The rendering model

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

What a component is to React: a function from props and state to elements, what JSX compiles to, the render and commit phases, why rendering must be pure, and how hooks attach state to a component.

## Learning goals

After this chapter you can:

- Say what JSX compiles to and what a React element is
- Walk through trigger, render, and commit for one state update
- Explain why components must be pure and what Strict Mode does to catch impurity
- Explain the Rules of Hooks from how React stores hook state
- Predict which components re-render after an update

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- JSX: the automatic runtime (`jsx()` from `react/jsx-runtime`), `createElement`, elements as plain immutable objects, `$$typeof` → —
- Render and commit: triggering a render, rendering, committing to the DOM, browser paint → —
- Purity: idempotent rendering, side effects belong in handlers and effects, Strict Mode double rendering → —
- Rules of Hooks: call order, hooks stored per component in order, why no conditions or loops → —
- When a component re-renders: own state, parent render, context; props changing is not the trigger → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [react.dev — Writing markup with JSX](https://react.dev/learn/writing-markup-with-jsx)
- [react.dev — `createElement`](https://react.dev/reference/react/createElement)
- [react.dev — Render and commit](https://react.dev/learn/render-and-commit)
- [react.dev — Keeping components pure](https://react.dev/learn/keeping-components-pure)
- [react.dev — Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [react.dev — Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [react.dev — `<StrictMode>`](https://react.dev/reference/react/StrictMode)
