---
title: "What happens when a component suspends?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [suspense, fallback, use, lazy, pre-rendering, throttling]
related:
  - react/suspense/use-api
  - react/suspense/suspense-and-transitions
  - react/suspense/lazy
  - react/suspense/error-boundaries
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/view-transition
  - react/reconciliation/activity
  - react/effects/effect-cleanup
  - react/server-rendering/streaming-and-selective-hydration
  - javascript/promises/what-is-a-promise
verified: 2026-10
perishable:
  - "Siblings pre-rendered after the fallback commits, since React 19.0"
  - "Reveals throttled to 300 ms (FALLBACK_THROTTLE_MS, React 19.3.1)"
  - "A thrown promise still suspends, without a warning, in 19.3.1"
sources:
  - https://react.dev/reference/react/Suspense#props
  - https://react.dev/reference/react/Suspense#caveats
  - https://react.dev/reference/react/Suspense#what-activates-a-suspense-boundary
  - https://react.dev/reference/react/Suspense#suspense-enabled-frameworks
  - https://react.dev/reference/react/Suspense#revealing-content-together-at-once
  - https://react.dev/reference/react/Suspense#revealing-nested-content-as-it-loads
  - https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding
  - https://react.dev/reference/react/use#why-promises-recreated
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#improvements-to-suspense
  - https://react.dev/blog/2025/10/01/react-19-2#batching-suspense-boundaries-for-ssr
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberThenable.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberThrow.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
tldr: >
  A component suspends when it reads something not ready yet: a pending promise via `use`, or a `lazy`
  component still loading. React abandons that subtree, commits the nearest `<Suspense>` fallback in place
  of the whole boundary, then pre-renders the skipped siblings. When the promise settles it retries from
  scratch and reveals the content, throttled so nearby boundaries appear together.
---

## Answer

*Suspending* means a component can't finish rendering because something it needs isn't ready. The docs list what does it: reading a pending promise with `use` (directly or through a Suspense-enabled framework, which caches promises and calls `use` for you), rendering a `lazy` component whose code hasn't loaded, and a few resources React manages, such as a stylesheet rendered with `precedence`. Fetching in an Effect or event handler doesn't suspend anything; React never sees that promise.

When a component suspends, React:

1. **Stops rendering it** and walks up to the **nearest `<Suspense>` boundary**.
2. **Shows that boundary's `fallback` in place of all its children.** The boundary is one unit: siblings that rendered fine are replaced too, and everything inside appears together.
3. **Commits the fallback immediately** (since React 19.0), without rendering the remaining siblings first. It then renders those siblings in a separate pass, the *pre-render*, so their own `lazy` code and data requests start early.
4. **Retries when the promise settles.** Components that never mounted keep no state: the render starts from scratch. If the promise rejects, the nearest error boundary takes over.

Reveals are throttled: React reveals suspended content at most once every 300 ms, so boundaries that become ready close together appear at once instead of popping in one by one.

Nested boundaries make a loading sequence: an outer fallback for the page shell, inner ones for slower panels. Place them where the design wants loading states, not around every component.

If content that's already visible suspends again because of an urgent update, React hides it, cleans up its layout effects and shows the fallback again. During a Transition or a `useDeferredValue` update it keeps the old content on screen instead.

## Example

```jsx
const dataPromise = new Promise((resolve) => setTimeout(() => resolve('data'), 500));

function Item({ name }) {
  console.log('render', name);
  useLayoutEffect(() => console.log('commit', name));
  return <p>{name}</p>;
}

function Data() {
  console.log('render Data');
  const value = use(dataPromise);
  useLayoutEffect(() => console.log('commit Data'));
  return <p>{value}</p>;
}

createRoot(document.getElementById('root')).render(
  <Suspense fallback={<Item name="fallback" />}>
    <Item name="A" />
    <Data />
    <Item name="B" />
  </Suspense>
);
// → render A, render Data, render fallback
// → commit fallback
// → render A, render Data, render B
// 500 ms later:
// → render A, render Data, render B
// → commit A, commit Data, commit B
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, one log line per name. `B` wasn't rendered before the fallback committed; the second group is the pre-render. `A` rendered three times and committed once.

## Pitfalls

- Expecting a fetch in `useEffect` to show the fallback. Only `use`, `lazy` and Suspense-enabled sources suspend; an Effect's promise is invisible to React.
- Creating the promise during render. A suspended render that never mounted starts over, so the promise is created again and the component never gets past it; cache it.
- Putting one boundary near the root. Any suspension deep in the page replaces the whole layout with a spinner. Add boundaries where a loading state makes sense.
- Keeping state in a component that suspends before mounting. In the test, a `useState` initializer ran three times before the first commit; nothing was kept.

## Follow-ups

**Q:** What if there's no `<Suspense>` boundary at all?
**A:** In a `createRoot` app the render waits without committing. The first render showed an empty container for 100 ms; a later `flushSync` update that suspended left the previous screen in place until its promise resolved. No error.

**Q:** What if the fallback itself suspends?
**A:** The docs say it activates the next boundary up, so that boundary's fallback shows instead.

**Q:** Can I still throw a promise myself?
**A:** It isn't a documented API. React 19.3.1 still treats a thrown thenable as a suspension, labelled deprecated in the source, and logged no warning in either build. Use `use` instead.

**Q:** How does it work on the server?
**A:** Streaming server rendering sends fallbacks first and streams each boundary's HTML as it's ready; since 19.2 those reveals are batched like the client's.

## Deep dive

### How it works

Implementation details of React 19.3.1:

- **`use` throws.** When the promise is pending, `use` attaches handlers that write `status` and `value` (or `reason`) onto the promise itself, then throws a sentinel, `SuspenseException`. Its message, "Suspense Exception: This is not a real error!", is what you see if you catch it in a `try`/`catch`. `lazy` throws the same way while its module loads.
- **The work loop unwinds.** `handleThrow` records why the render stopped. `throwException` finds the nearest boundary from the *suspense handler stack*, marks it to capture, and attaches a listener to the promise. Rendering resumes at that boundary, now rendering its fallback.
- **Siblings are skipped, then pre-rendered.** On a normal render React skips the suspended component's siblings and schedules a retry of the boundary straight away. That retry runs as a pre-render: it renders every sibling without committing, which is when `B` logged in the example.
- **The retry commits.** When the promise settles, its listener schedules a render on a *retry lane*. The component calls `use` again; the promise's `status` is now `fulfilled`, so `use` returns `value` synchronously.
- **Throttling.** `globalMostRecentFallbackTime` is set whenever a commit switches a boundary between fallback and content. A render made only of retries that finishes earlier than 300 ms after that is held back until 300 ms have passed:

```js
// Simplified from ReactFiberWorkLoop.js
const FALLBACK_THROTTLE_MS = 300;
// … when a concurrent render finishes:
if (includesOnlyRetries(lanes) && (alwaysThrottleRetries || exitStatus === RootSuspended)) {
  const msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
  if (msUntilTimeout > 10) { /* schedule the commit for later */ }
}
```

Legacy: before React 19.0, React rendered all the siblings first and committed the fallback afterwards, so a slow sibling delayed the loading state.

### Edge cases

Measured in Chrome 156 and Firefox 159, development and production. The fallback committed at 1–7 ms each time:

| Outer data at | Inner data at | Outer revealed | Inner revealed |
|---|---|---|---|
| 100 ms | 200 ms | 302–311 ms | same commit |
| 100 ms | 450 ms | 303–311 ms, with inner fallback | 604–614 ms |

The second case shows the window restarting: the outer reveal itself counts as a switch, so the inner content waited another 300 ms. A single boundary whose data arrived at 200 ms was revealed at 303–310 ms too.

**Re-suspending visible content.** Here an urgent `flushSync` update made a mounted component read a new pending promise:

```text
<p id="item" style="display: none !important;">item 1</p><i>loading</i>
```

That's the container right after the update. The old DOM stayed, hidden, and its state was kept; the layout effect's cleanup ran, but the `useEffect` stayed set up until the dependency changed with the new data. Layout effects re-ran on reveal, 300 ms after the fallback appeared.

### Real-world scenario

A dashboard with a header, a sidebar and three charts. One boundary around the content area makes the whole area flash a spinner whenever any chart loads. One boundary per chart gives three independent skeletons, and the throttle merges charts that finish within 300 ms of each other into one reveal. Nest: a page-level fallback while the shell's data loads, then per-chart fallbacks. When the user switches dates, the charts would fall back to skeletons again; making that update a Transition keeps the old charts visible instead.

### Trade-offs

Suspense moves loading states out of components: a component reads data as if it were there, and the tree decides where waiting is shown. In return, the data source must cache promises (a framework, a library, or your own cache), a never-mounted component can't keep state across a retry, and the fallback granularity is whatever the boundaries say, so a misplaced boundary hides more UI than intended. The throttle trades up to 300 ms of extra latency for fewer layout jumps.

## Exercises

### When does each part appear?

```jsx
const outer = delay(100); // resolves after 100 ms
const inner = delay(200); // resolves after 200 ms

<Suspense fallback={<p>outer fallback</p>}>
  <Data promise={outer} />
  <Suspense fallback={<p>inner fallback</p>}>
    <Data promise={inner} />
  </Suspense>
</Suspense>
```

**Answer:** The outer fallback commits at once; the inner fallback is never shown. Both pieces of content commit together at about 300 ms, because the throttle held the 100 ms retry until 300 ms after the fallback appeared, by which time the inner data had arrived too. Chrome 156 and Firefox 159 logged 302–311 ms, development and production.
