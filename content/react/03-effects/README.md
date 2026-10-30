# 03 — Effects

> **Status:** 🔴 planned · **Published:** 0/0 · **Last verified:** —

Effects synchronize a component with something outside React. This chapter covers when they run, how dependencies decide re-runs, cleanup, the layout variants, when an effect is the wrong tool, and Effect Events.

## Learning goals

After this chapter you can:

- Say when an effect runs relative to render, commit, and paint
- Pick dependencies correctly and fix a stale closure without silencing the linter
- Write cleanup that survives Strict Mode's extra setup and cleanup cycle
- Choose between `useEffect`, `useLayoutEffect`, and `useInsertionEffect`
- Replace an unnecessary effect with derived state, an event handler, or a key
- Read the latest props in an effect without re-running it, using `useEffectEvent`

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Effect timing: after commit, usually after paint; effects as synchronization, not lifecycle → —
- Dependencies: `Object.is` comparison, objects and functions recreated each render, the `react-hooks` lint rules → —
- Cleanup: order of cleanup and setup, Strict Mode's extra cycle in development, races in data fetching → —
- `useLayoutEffect` and `useInsertionEffect`: before paint, blocking, measuring layout, server rendering warnings → —
- You might not need an effect: derived values, event-specific logic, resetting state with a key, chains of effects → —
- Effect Events: `useEffectEvent`, reactive vs non-reactive values → —

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
<!-- generated:questions:end -->

## Sources

- [react.dev — Synchronizing with effects](https://react.dev/learn/synchronizing-with-effects)
- [react.dev — Lifecycle of reactive effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [react.dev — Removing effect dependencies](https://react.dev/learn/removing-effect-dependencies)
- [react.dev — You might not need an effect](https://react.dev/learn/you-might-not-need-an-effect)
- [react.dev — Separating events from effects](https://react.dev/learn/separating-events-from-effects)
- [react.dev — `useEffect`](https://react.dev/reference/react/useEffect)
- [react.dev — `useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect)
- [react.dev — `useInsertionEffect`](https://react.dev/reference/react/useInsertionEffect)
- [react.dev — `useEffectEvent`](https://react.dev/reference/react/useEffectEvent)
