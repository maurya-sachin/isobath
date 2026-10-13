---
title: "How does React batch state updates, and when do you need an updater function?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [batching, updater-function, set-state, flush-sync, automatic-batching]
related:
  - react/state/state-as-snapshot
  - react/state/use-reducer
  - react/rendering-model/render-and-commit
  - react/rendering-model/when-components-rerender
  - react/rendering-model/purity-and-strict-mode
  - react/concurrent-rendering/transitions
  - javascript/async-and-the-event-loop/event-loop
verified: 2026-10
perishable:
  - "React 19.3.1 runs the first updater eagerly when no update is pending"
sources:
  - https://react.dev/learn/queueing-a-series-of-state-updates#react-batches-state-updates
  - https://react.dev/learn/queueing-a-series-of-state-updates#updating-the-same-state-multiple-times-before-the-next-render
  - https://react.dev/learn/queueing-a-series-of-state-updates#what-happens-if-you-update-state-after-replacing-it
  - https://react.dev/learn/queueing-a-series-of-state-updates#what-happens-if-you-replace-state-after-updating-it
  - https://react.dev/reference/react/useState#setstate-caveats
  - https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state
  - https://react.dev/reference/react/useState#is-using-an-updater-always-preferred
  - https://react.dev/reference/react/useState#my-initializer-or-updater-function-runs-twice
  - https://react.dev/reference/react-dom/flushSync#caveats
  - https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching
  - https://github.com/reactwg/react-18/discussions/21
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-render
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberRootScheduler.js
tldr: >
  A setter doesn't render; it adds an update to a queue. React renders once after the current
  event, timeout or promise callback finishes, applying the queue in order: a value replaces the
  state, an updater function computes it from the previous one. Use an updater when the next state
  depends on the previous one and several updates may queue.
---

## Answer

**Batching.** A setter doesn't render: it appends an update to a queue and schedules a render. When the running code finishes, React renders once, applying every queued update across all state and components. Since React 18 with `createRoot`, that holds in React event handlers, `setTimeout`, promise callbacks and native `addEventListener` handlers alike. Separate user events, such as two clicks, each get their own render.

**The queue.** During the next render React processes the updates in the order they were queued:

- A **value**, `setN(n + 1)`, means "replace with this", computed from the render's snapshot.
- An **updater function**, `setN(m => m + 1)`, means "compute from the state so far": React passes it the previous update's result.

So with `n = 0`: `setN(n + 1)` twice gives `1` (both say "replace with 1"); `setN(m => m + 1)` twice gives `2`. `setN(n + 5); setN(m => m + 1)` gives `6`, and a later `setN(42)` replaces all of that with `42`.

**When to use an updater:** the next state depends on the previous one and more than one update can queue before the next render: several updates in one handler, or a timer or subscription created in an earlier render. For a single update per click both forms behave the same, since React renders before the next click.

Updaters run during rendering (React may run the first one early, as an optimization), so they must be pure: no side effects, no other setters. Strict Mode calls them twice in development.

**Opting out.** `flushSync(() => setN(1))` from `react-dom` renders and commits before returning, so the next line sees the updated DOM. It's a last resort, for code that must read the DOM immediately.

*Legacy:* before React 18, and with `ReactDOM.render` (removed in React 19), only React event handlers batched.

## Example

```jsx
function Counter() {
  const [n, setN] = useState(0);
  console.log('render', n);

  function replaceTwice() {
    setN(n + 1);
    setN(n + 1);
  }
  function updateTwice() {
    setN((m) => m + 1);
    setN((m) => m + 1);
  }
  function mixed() {
    setN(n + 5);
    setN((m) => m + 1);
  }
  // <button onClick={replaceTwice}> and so on; each click below starts from 0
}
// replaceTwice → render 1
// updateTwice  → render 2
// mixed        → render 6
// mixed, then setN(42) in the same handler → render 42
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. Each click logged exactly one render, whatever the number of setter calls.

## Pitfalls

- Writing `setCount(count + 1)` in a loop or several times in a row and expecting it to accumulate. Every call reads the same snapshot.
- Side effects inside an updater: logging, mutating the previous state, calling another setter. Updaters run during render and twice in Strict Mode development.
- Expecting the DOM to reflect a state change on the next line of a handler. It won't until React renders; use `flushSync` only when you really must.
- Reading state inside an updater instead of the argument: `setN(m => n + 1)` ignores the queue and behaves like a plain value.

## Follow-ups

**Q:** Is `setState` asynchronous?
**A:** Not in the Promise sense: it returns `undefined` and can't be awaited. It queues an update synchronously; the render happens later, after the running code finishes. For a click, React 19.3.1 renders in a microtask it queues on the first update.

**Q:** Do two `setTimeout` callbacks get batched together?
**A:** Each callback's updates are batched within it. Whether two separate callbacks share a render depends on whether React's scheduled render ran between them, so don't rely on it either way.

**Q:** What happens to `unstable_batchedUpdates` with `createRoot`?
**A:** Nothing; it's just unnecessary, because everything is already batched. The React 18 working group kept the export for libraries that call it, and `react-dom` 19.3.1 still exports it.

## Deep dive

### How it works

React 19.3.1 stores each state hook's pending updates as a circular linked list (`queue.pending`) on the hook; each update records its `action` (the value or updater) and its lane, the priority it was scheduled with (implementation details from `ReactFiberHooks.js`). The setter, `dispatchSetState`, appends an update and calls `scheduleUpdateOnFiber`. Scheduling is per root, not per update: the first update queues one microtask, and later updates find the render already scheduled. That's the whole batching mechanism, and it's why the context, whether a click, a timeout or a promise, no longer matters.

When the component renders, `useState` runs the queue through a reducer that is literally `typeof action === 'function' ? action(state) : action`. A value ignores the state it's given; an updater uses it. Updates whose lane isn't part of this render, such as a transition while an urgent update renders, are skipped and kept, then re-applied in their original order in a later render, so the final state is the same as if everything had run in order.

Render counts with two setters per callback, development and production, Chrome 156 and Firefox 159:

```jsx
function handle() {
  setA((x) => x + 1);
  setB((x) => x + 1);
}
<button onClick={handle} />;                                    // → 1 render
<button onClick={() => setTimeout(handle, 0)} />;               // → 1 render
<button onClick={() => Promise.resolve().then(handle)} />;      // → 1 render
useEffect(() => { button.current.addEventListener('click', handle); }, []); // → 1 render
```

A synthetic `button.click()` from script behaved the same as a real click: one render.

### Edge cases

**When updaters actually run.** The docs say updaters run during the next render. React 19.3.1 adds an optimization in `dispatchSetState`: when the component has no pending update, it computes the first update immediately, at the setter call, so it can drop updates that don't change the state. Later updates wait for the render:

```jsx
function handleClick() {
  setN((m) => { console.log('updater 1 gets', m); return m + 1; });
  setN((m) => { console.log('updater 2 gets', m); return m + 1; });
  console.log('handler done');
}
// First click after mount:
// → updater 1 gets 0
// → handler done
// → updater 2 gets 1
// → render 2
// Second click:
// → handler done
// → updater 1 gets 2
// → updater 2 gets 3
// → render 4
```

Chrome 156 and Firefox 159, development and production, no Strict Mode. On the second click the earlier render still left work marked on the fiber's other copy, so nothing ran early. Under Strict Mode in development each updater also ran once more during render, its result discarded. Code that is pure can't tell any of this apart, which is the point.

**`flushSync` splits a batch.**

```jsx
// The component logs 'render', a, b and renders <span ref={span} data-a={a} />
function handleClick() {
  flushSync(() => setA((x) => x + 1));
  console.log('DOM shows', span.current.dataset.a);
  setB((x) => x + 1);
}
// → render 1 0
// → DOM shows 1
// → render 1 1
```

Development and production, both browsers. Per the docs, `flushSync` may also flush other pending updates and effects first, and can force a Suspense fallback to show.

- **Render-phase updates.** Calling a setter during render is allowed only for the component that's rendering; React discards the output and re-renders immediately. That's the "store information from previous renders" pattern, not batching.
- **Same-value updates.** If the queue's result equals the current state by `Object.is`, React skips the children; see the re-render question.

### Real-world scenario

A "like" button calls `setLikes(likes + 1)` optimistically and, if the request fails, rolls back with `setLikes(likes)`. Starting from 0, the user clicks twice and then the first request fails: its rollback restores the first click's snapshot, 0, wiping out the second like too. With `setLikes(l => l + 1)` and a rollback of `setLikes(l => l - 1)`, the count ends at 1, because each change applies to the state as React finds it. The same reasoning applies to anything driven by intervals, sockets or retries, where the callback outlives the render that created it.

### Trade-offs

Batching trades immediacy for consistency and speed: one render per event instead of one per setter, and no half-updated UI where one state variable changed and another didn't yet. The cost is that nothing is observable until React renders, which surprises code written for synchronous `this.setState` behaviour and for direct DOM reads. Updaters add a little indirection; the docs treat always using them for derived updates as a reasonable style, not a requirement. When several state variables must change together by rules, a reducer usually reads better than a chain of updaters.

## Exercises

### Predict the render

```jsx
// n is 0
function handleClick() {
  setN(n + 1);
  setN((m) => m * 2);
  setN(n + 10);
  setN((m) => m + 1);
}
```

**Answer:** `render 11`. The queue is: replace with 1, double it (2), replace with 10, add 1. A second click from 11 renders 22: replace with 12, double (24), replace with 21, add 1.
