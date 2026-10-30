# 05 — Reconciliation and identity

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

How React decides what changed: comparing element trees by type and position, keys as identity, when state is kept or thrown away, Portals, and keeping hidden UI alive with `<Activity>`.

## Learning goals

After this chapter you can:

- Explain reconciliation's heuristics and what the "virtual DOM" does and doesn't buy
- Say what keys do and show the bug an index key causes
- Predict when a component keeps or loses its state, and reset it on purpose
- Explain how Portals render elsewhere in the DOM but stay in the React tree
- Hide UI with `<Activity>` without losing its state

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Reconciliation: same type at same position, different type replaces the subtree, the O(n) heuristics, the "virtual DOM" myth → —
- Keys: identity among siblings, index keys with reordering and inserts, stable ids, keys on Fragments → —
- Preserving and resetting state: position in the UI tree, components defined inside components, `key` to reset → —
- Portals: `createPortal`, event bubbling through the React tree, context across portals → —
- `<Activity>`: `visible` and `hidden` modes, preserved state, effects unmounted while hidden, pre-rendering → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [React (legacy docs) — Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html)
- [react.dev — Preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state)
- [react.dev — Rendering lists](https://react.dev/learn/rendering-lists)
- [react.dev — `createPortal`](https://react.dev/reference/react-dom/createPortal)
- [react.dev — `<Activity>`](https://react.dev/reference/react/Activity)
