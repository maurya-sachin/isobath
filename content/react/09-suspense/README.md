# 09 — Suspense, `use`, and error boundaries

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Declarative loading and error states: what suspending means, how `use` reads promises and context, how Suspense interacts with transitions, code splitting with `lazy`, and what error boundaries catch.

## Learning goals

After this chapter you can:

- Explain what happens when a component suspends and when the fallback shows
- Read a promise with `use` and say why the promise must be cached
- Place Suspense boundaries so transitions keep old content instead of flashing fallbacks
- Split code with `lazy` and say where the import starts
- Say what an error boundary catches, what it doesn't, and how React 19 reports errors

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Suspense mechanics: suspending, nearest boundary, fallback, revealing together, nested boundaries, sibling pre-rendering → 010
- `use`: reading promises and context, conditional calls, promise identity and caching → 020
- Suspense with transitions: keeping already-revealed content, `useTransition` and `useDeferredValue` with Suspense, resetting with `key` → 030
- `lazy`: dynamic `import()`, default exports, where to declare it → 040
- Error boundaries: class components, `getDerivedStateFromError`, `componentDidCatch`, what they don't catch, `onCaughtError` and `onUncaughtError` → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What happens when a component suspends?](010-suspense-mechanics.md) | hard | 🟡 draft |
| 020 | [How does `use` read a promise, and why must the promise be cached?](020-use-api.md) | medium | 🟡 draft |
| 030 | [How do transitions stop Suspense from showing a fallback again?](030-suspense-and-transitions.md) | hard | 🔴 planned |
| 040 | [How does `lazy` split code, and where should you declare it?](040-lazy.md) | medium | 🔴 planned |
| 050 | [What do error boundaries catch, and what slips past them?](050-error-boundaries.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — `<Suspense>`](https://react.dev/reference/react/Suspense)
- [react.dev — `use`](https://react.dev/reference/react/use)
- [react.dev — `lazy`](https://react.dev/reference/react/lazy)
- [react.dev — `Component`: error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [react.dev — `createRoot` options](https://react.dev/reference/react-dom/client/createRoot)
- [react.dev — React 19](https://react.dev/blog/2024/12/05/react-19)
