# 11 — Server rendering and hydration

> **Status:** 🔴 planned · **Published:** 0/3 · **Last verified:** —

React DOM's server APIs: rendering HTML on the server, hydrating it on the client, what causes hydration mismatches, and streaming with Suspense and selective hydration.

## Learning goals

After this chapter you can:

- Explain what server rendering produces and what `hydrateRoot` does with it
- Find and fix the causes of a hydration mismatch
- Explain how streaming and selective hydration use Suspense boundaries

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Server rendering and hydration: `renderToPipeableStream`, `renderToReadableStream`, `hydrateRoot`, attaching to existing DOM, effects don't run on the server → 010
- Hydration mismatches: browser-only values, dates and randomness, invalid nesting, `suppressHydrationWarning`, two-pass rendering, `useId` → 020
- Streaming and selective hydration: Suspense boundaries in HTML, out-of-order chunks, hydrating on interaction, `prerender` and partial pre-rendering → 030

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How do server rendering and hydration work in React?](010-ssr-and-hydration.md) | hard | 🟡 draft |
| 020 | [What causes hydration mismatches, and how do you fix them?](020-hydration-mismatches.md) | medium | 🟡 draft |
| 030 | [How do streaming and selective hydration use Suspense?](030-streaming-and-selective-hydration.md) | hard | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)
- [react.dev — `renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream)
- [react.dev — `renderToReadableStream`](https://react.dev/reference/react-dom/server/renderToReadableStream)
- [react.dev — Static APIs](https://react.dev/reference/react-dom/static)
- [React 18 Working Group — New Suspense SSR architecture](https://github.com/reactwg/react-18/discussions/37)
- [react.dev — React 19.2: Partial Pre-rendering](https://react.dev/blog/2025/10/01/react-19-2)
