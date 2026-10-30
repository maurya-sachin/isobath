# 08 — Fiber and concurrent rendering

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

How React renders without blocking: the Fiber architecture, interruptible rendering with priorities, transitions, deferred values, the scheduler underneath, and View Transitions driven by React updates.

## Learning goals

After this chapter you can:

- Explain what Fiber is and why React replaced the stack reconciler
- Say what "concurrent" means in React and what it doesn't
- Mark an update as a transition and say what changes for the user
- Choose between `useDeferredValue` and debouncing
- Describe how React's scheduler yields to the browser
- Animate a React update with `<ViewTransition>`

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Fiber: units of work, the work-in-progress tree, double buffering, why the stack reconciler couldn't pause → —
- Concurrent rendering: interruptible render, priorities (lanes), commit stays synchronous, opting in through features → —
- Transitions: `useTransition`, `startTransition`, `isPending`, async transitions, what can't be a transition → —
- Deferred values: `useDeferredValue`, initial value, background re-render, vs debounce and throttle → —
- Scheduling: the `scheduler` package, time slicing, yielding with `MessageChannel` → —
- `<ViewTransition>`: which updates animate, enter/exit/update/share, relation to the browser's View Transitions API → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [React Fiber architecture (Andrew Clark)](https://github.com/acdlite/react-fiber-architecture)
- [react.dev — React v18.0](https://react.dev/blog/2022/03/29/react-v18)
- [react.dev — `useTransition`](https://react.dev/reference/react/useTransition)
- [react.dev — `startTransition`](https://react.dev/reference/react/startTransition)
- [react.dev — `useDeferredValue`](https://react.dev/reference/react/useDeferredValue)
- [react.dev — `<ViewTransition>`](https://react.dev/reference/react/ViewTransition)
- [facebook/react — `scheduler` package](https://github.com/facebook/react/tree/main/packages/scheduler)
- [React 18 Working Group — concurrent features](https://github.com/reactwg/react-18/discussions/46)
