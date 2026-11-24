# 04 — Lightweight stores and signals

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Zustand stores and selectors, Jotai atoms, signals and how they skip React's re-render, and how to compare re-render cost across context, Redux, Zustand and signals.

## Learning goals

After this chapter you can:

- Explain how a Zustand store notifies components and what a selector changes
- Explain why a selector that returns a new object causes extra renders or a loop
- Explain how Jotai atoms differ from a single store and when that is better
- Explain how signals update the DOM without re-rendering the component
- Compare re-render cost across context, Redux, Zustand and signals with a render count

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Zustand store subscription and selectors → 010
- New-object selectors and `useShallow` → 020
- Jotai atoms and fine-grained subscriptions → 030
- Signals and the TC39 proposal status → 040
- Re-render cost across context, Redux, Zustand and signals → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does a Zustand store notify components, and what does a selector change?](010-zustand-selectors-notify.md) | medium | 🔴 planned |
| 020 | [Why does a selector that returns a new object cause extra renders or a loop?](020-selector-new-object-loop.md) | medium | 🔴 planned |
| 030 | [How do Jotai atoms differ from a single store, and when is that better?](030-jotai-atoms-vs-store.md) | medium | 🔴 planned |
| 040 | [What are signals, and how do they skip React's re-render?](040-signals-skip-rerender.md) | hard | 🔴 planned |
| 050 | [How do you compare re-render cost between context, Redux, Zustand and signals?](050-compare-rerender-cost.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Zustand — Prevent re-renders with `useShallow`](https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow)
- [Zustand — Migrating to v5](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5)
- [Zustand — v5.1.0 release](https://github.com/pmndrs/zustand/releases/tag/v5.1.0)
- [Jotai docs](https://jotai.org/docs)
- [`pmndrs/jotai` at `v3.0.2` — migrating to v3](https://github.com/pmndrs/jotai/blob/v3.0.2/docs/guides/migrating-to-v3.mdx)
- [Preact — Signals guide](https://preactjs.com/guide/v10/signals)
- [`preactjs/signals` README](https://github.com/preactjs/signals)
- [TC39 — Signals proposal](https://github.com/tc39/proposal-signals)
