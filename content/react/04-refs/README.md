# 04 — Refs and the DOM

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

Refs are React's escape hatch: a mutable box that survives renders without causing them, and the way to reach DOM nodes. This chapter covers `useRef`, ref callbacks, `ref` as a prop, imperative handles, and Fragment refs.

## Learning goals

After this chapter you can:

- Choose between a ref and state, and say why reading a ref during render is a bug
- Attach refs to DOM nodes, lists of nodes, and child components with ref callbacks and `ref` as a prop
- Expose a narrow imperative API with `useImperativeHandle`
- Say what a Fragment ref gives you that a DOM ref doesn't

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- `useRef` vs state: mutable `current`, no re-render, refs read during render, storing timers and previous values → 010
- Ref callbacks and `ref` as a prop: when React sets and clears refs, cleanup functions, refs to lists, `forwardRef` no longer needed → 020
- `useImperativeHandle`: exposing methods instead of the node → 030
- Fragment refs: `<Fragment ref>`, the `FragmentInstance` API → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [When should you use a ref instead of state?](010-refs-vs-state.md) | medium | 🟡 draft |
| 020 | [How do ref callbacks work, and what changed with `ref` as a prop?](020-ref-callbacks-and-ref-prop.md) | medium | 🟡 draft |
| 030 | [How do you expose a limited imperative API with `useImperativeHandle`?](030-imperative-handle.md) | medium | 🟡 draft |
| 040 | [What can a Fragment ref do that a DOM ref can't?](040-fragment-refs.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — Referencing values with refs](https://react.dev/learn/referencing-values-with-refs)
- [react.dev — Manipulating the DOM with refs](https://react.dev/learn/manipulating-the-dom-with-refs)
- [react.dev — `useRef`](https://react.dev/reference/react/useRef)
- [react.dev — Common components: `ref` callback](https://react.dev/reference/react-dom/components/common#ref-callback)
- [react.dev — `useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle)
- [react.dev — React 19](https://react.dev/blog/2024/12/05/react-19)
- [react.dev — React 19.3](https://react.dev/blog/2026/09/09/react-19-3)
