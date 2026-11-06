---
title: "How is `useDeferredValue` different from debouncing?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [use-deferred-value, debounce, throttle, transitions, memo, responsiveness]
related:
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/interruptible-rendering
  - react/performance/memoization
  - react/performance/profiling
  - react/suspense/suspense-and-transitions
  - javascript/closures/debounce-throttle-once
verified: 2026-10
perishable:
  - "`initialValue` parameter added in React 19"
  - "Deferred re-renders use transition lanes 11–14 in React 19.3.1"
sources:
  - https://react.dev/reference/react/useDeferredValue#usedeferredvalue
  - https://react.dev/reference/react/useDeferredValue#parameters
  - https://react.dev/reference/react/useDeferredValue#returns
  - https://react.dev/reference/react/useDeferredValue#caveats
  - https://react.dev/reference/react/useDeferredValue#how-does-deferring-a-value-work-under-the-hood
  - https://react.dev/reference/react/useDeferredValue#indicating-that-the-content-is-stale
  - https://react.dev/reference/react/useDeferredValue#deferring-re-rendering-for-a-part-of-the-ui
  - https://react.dev/reference/react/useDeferredValue#how-is-deferring-a-value-different-from-debouncing-and-throttling
  - https://react.dev/blog/2024/12/05/react-19#use-deferred-value-initial-value
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberLane.js
tldr: >
  `useDeferredValue(value)` returns the old value during the urgent render, then re-renders in the
  background with the new one. Unlike a debounce there's no fixed delay, and that background render
  is interruptible, so typing stays responsive. It only helps when the slow child is memoized, and it
  doesn't cut network requests: debounce those.
---

## Answer

`const deferredQuery = useDeferredValue(query)` gives you a copy of `query` that is allowed to lag behind. When `query` changes:

1. React renders urgently with the **old** deferred value. The input shows the new keystroke right away; a `memo` child that receives `deferredQuery` sees unchanged props and is skipped.
2. React then renders again **in the background** with the new value, at Transition priority. If another keystroke arrives first, that render is abandoned and restarted with the newest value.

Compared with debouncing:

- **No fixed delay.** A debounce waits a chosen number of milliseconds after the last call, on every device. The deferred render starts as soon as the urgent one has committed, so on a fast machine the lag is barely visible and on a slow one it grows with the work.
- **Interruptible.** A debounced update still renders in one block when it fires, and input during that render waits. The deferred render yields between components and gives way to input.
- **Different target.** `useDeferredValue` defers *rendering*. It doesn't stop work outside rendering: a fetch per keystroke still happens. Debouncing or throttling is still the tool for requests, and the two combine.

Two requirements make it work. The slow part must be a separate memoized component that receives only the deferred value; without `memo`, the urgent render re-renders it anyway. And the value should be a primitive or an object created outside rendering, since a fresh object every render always differs (by `Object.is`) and schedules a background render each time.

Use it when you don't own the setter, such as a value arriving as a prop; with the setter, `startTransition` does the same job. Show staleness by comparing `query !== deferredQuery`. React 19 added an optional `initialValue`, rendered first on mount before the real value.

## Example

```jsx
const SlowList = memo(function SlowList({ query }) {
  console.log('SlowList', JSON.stringify(query));
  busyWait(50);
  return <p>{query}</p>;
});

function Search() {
  const [query, setQuery] = useState('react');
  const deferredQuery = useDeferredValue(query, '');
  console.log(`Search query=${query} deferred=${deferredQuery}`);
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: query !== deferredQuery ? 0.5 : 1 }}>
        <SlowList query={deferredQuery} />
      </div>
    </>
  );
}
// Mount:
// → Search query=react deferred=
// → SlowList ""
// → Search query=react deferred=react
// → SlowList "react"
// Type "!":
// → Search query=react! deferred=react
// → Search query=react! deferred=react!
// → SlowList "react!"
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted keystrokes. The first render after each change skipped `SlowList`. Typing `XYZ` back to back in Chrome logged three urgent renders and a single `SlowList "reactXYZ"`.

## Pitfalls

- Leaving the slow child unmemoized. It then renders twice per change, once with each value: in the measurement below, 1,163–1,410 item renders instead of 800, with no gain in responsiveness.
- Creating the value during render, like `useDeferredValue({ query })`. A new object every render is never equal to the last, so every render schedules another background render.
- Expecting fewer requests. Data fetched for each value is still fetched for each keystroke; debounce the request or rely on a cache.
- Expecting a double render inside a Transition. When the update is already a Transition, the hook returns the new value straight away: one render, `query=b deferred=b`.

## Follow-ups

**Q:** What does `initialValue` change?
**A:** On mount the component first renders with `initialValue`, then re-renders in the background with the real value. Without it, there's no older value, so the first render isn't deferred.

**Q:** What happens if the background render suspends?
**A:** The docs say the user keeps seeing the old deferred value rather than a Suspense fallback, until the data loads. Effects of that render run only once it commits.

**Q:** Isn't this just `useTransition` for values?
**A:** Mechanically, yes: the background render gets a Transition lane. The difference is where you hook in: `startTransition` wraps the setter, `useDeferredValue` wraps a value you receive.

## Deep dive

### How it works

In React 19.3.1, when the deferred value would change during an urgent render, the Hook returns the old value and asks for a *deferred lane* (implementation detail of `ReactFiberHooks.js` and `ReactFiberWorkLoop.js`). That lane is one of the four Transition lanes reserved for deferred work, shared by every `useDeferredValue` in the same render, or the offscreen lane when the component is being pre-rendered inside hidden content. If the current render is already non-urgent, as in a Transition, the Hook returns the new value without spawning anything. The background render then follows the Transition rules: it's time-sliced and an input update interrupts it.

### Real-world scenario

Eight keystrokes 30 ms apart into an input above a list of 100 items, each taking 0.5 ms to render, production build, two runs per browser. "Key to frame" is from the input event to the next animation frame; "settled" is from the last keystroke to the list's last commit. Debounce means the list received a value updated 300 ms after the last keystroke, from a `setTimeout` in an effect.

| Strategy | Key to frame (median) | Longest frame gap | List commits | Item renders | Settled |
|---|---|---|---|---|---|
| Plain state | 51 / 100–101 ms | 50 / 101–108 ms | 8 | 800 | 50 / 100 ms |
| `useDeferredValue` + `memo` | 5–7 / 6–15 ms | 17 / 42 ms | 1 | 469–519 / 369–373 | 66–67 / 106 ms |
| `useDeferredValue`, no `memo` | 50 / 100 ms | 33–50 / 133–134 ms | 9 | 1,390–1,410 / 1,163–1,165 | 102–110 / 200–208 ms |
| 300 ms debounce + `memo` | 9–11 / 2–3 ms | 33 / 100 ms | 1 | 100 | 353 / 403 ms |

Chrome 156 first, Firefox 159 second; Firefox's coarser clock made each item take 1 ms. The deferred list kept every keystroke under a frame and finished soonest of the responsive options, at the price of abandoned renders. The debounce did the least work but showed results 300 ms later and then rendered in one block, freezing a frame.

### Trade-offs

`useDeferredValue` adapts to the device and keeps input responsive, but spends CPU on renders that get thrown away, needs memoization to pay off at all, and can't reduce I/O. A debounce is predictable and cheap, ideal for search requests, but adds a fixed delay for everyone and doesn't make the eventual render interruptible. A common combination: defer the rendering of results, debounce the request that fetches them.
