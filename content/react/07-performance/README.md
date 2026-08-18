# 07 — Performance and the React Compiler

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

Making React render less: when `memo`, `useMemo`, and `useCallback` help, what the React Compiler automates, and how to find out why something rendered.

## Learning goals

After this chapter you can:

- Say when memoization pays off and show a case where it silently doesn't
- Explain what the React Compiler memoizes, what it requires of your code, and how it bails out
- Find the component that rendered and why, with the Profiler and React Performance Tracks

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Memoization: `memo` and its comparison, `useMemo`, `useCallback`, unstable props that defeat `memo`, moving state down and lifting content up → —
- React Compiler: automatic memoization, the Rules of React it relies on, bail-outs, `"use no memo"`, lint rules → —
- Profiling: React DevTools Profiler, `<Profiler>` and `onRender`, Performance Tracks in browser DevTools → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [react.dev — `memo`](https://react.dev/reference/react/memo)
- [react.dev — `useMemo`](https://react.dev/reference/react/useMemo)
- [react.dev — `useCallback`](https://react.dev/reference/react/useCallback)
- [react.dev — React Compiler](https://react.dev/learn/react-compiler)
- [react.dev — React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [react.dev — `<Profiler>`](https://react.dev/reference/react/Profiler)
- [react.dev — React 19.2: Performance Tracks](https://react.dev/blog/2025/10/01/react-19-2)
