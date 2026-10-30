# 05 — Reconciliation and identity

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

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

- Reconciliation: same type at same position, different type replaces the subtree, the O(n) heuristics, the "virtual DOM" myth → 010
- Keys: identity among siblings, index keys with reordering and inserts, stable ids, keys on Fragments → 020
- Preserving and resetting state: position in the UI tree, components defined inside components, `key` to reset → 030
- Portals: `createPortal`, event bubbling through the React tree, context across portals → 040
- `<Activity>`: `visible` and `hidden` modes, preserved state, effects unmounted while hidden, pre-rendering → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does reconciliation decide what to update in the DOM?](010-diffing-heuristics.md) | hard | 🟡 draft |
| 020 | [Why does React need keys, and what goes wrong with index keys?](020-list-keys.md) | medium | 🟡 draft |
| 030 | [When does React keep a component's state, and when does it reset it?](030-preserving-and-resetting-state.md) | hard | 🟡 draft |
| 040 | [How do Portals render outside the parent DOM node, and how do their events bubble?](040-portals.md) | medium | 🟡 draft |
| 050 | [How does `<Activity>` hide UI without losing its state?](050-activity.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [React (legacy docs) — Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html)
- [react.dev — Preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state)
- [react.dev — Rendering lists](https://react.dev/learn/rendering-lists)
- [react.dev — `createPortal`](https://react.dev/reference/react-dom/createPortal)
- [react.dev — `<Activity>`](https://react.dev/reference/react/Activity)
