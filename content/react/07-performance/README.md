# 07 — Performance and the React Compiler

> **Status:** 🔴 planned · **Published:** 0/3 · **Last verified:** —

Making React render less: when `memo`, `useMemo`, and `useCallback` help, what the React Compiler automates, and how to find out why something rendered.

## Learning goals

After this chapter you can:

- Say when memoization pays off and show a case where it silently doesn't
- Explain what the React Compiler memoizes, what it requires of your code, and how it bails out
- Find the component that rendered and why, with the Profiler and React Performance Tracks

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Memoization: `memo` and its comparison, `useMemo`, `useCallback`, unstable props that defeat `memo`, moving state down and lifting content up → 010
- React Compiler: automatic memoization, the Rules of React it relies on, bail-outs, `"use no memo"`, lint rules → 020
- Profiling: React DevTools Profiler, `<Profiler>` and `onRender`, Performance Tracks in browser DevTools → 030

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [When do `memo`, `useMemo`, and `useCallback` actually help?](010-memoization.md) | medium | 🟡 draft |
| 020 | [What does the React Compiler do, and what does it require of your code?](020-react-compiler.md) | medium | 🔴 planned |
| 030 | [How do you find out why a component rendered?](030-profiling.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — `memo`](https://react.dev/reference/react/memo)
- [react.dev — `useMemo`](https://react.dev/reference/react/useMemo)
- [react.dev — `useCallback`](https://react.dev/reference/react/useCallback)
- [react.dev — React Compiler](https://react.dev/learn/react-compiler)
- [react.dev — React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [react.dev — `<Profiler>`](https://react.dev/reference/react/Profiler)
- [react.dev — React 19.2: Performance Tracks](https://react.dev/blog/2025/10/01/react-19-2)
