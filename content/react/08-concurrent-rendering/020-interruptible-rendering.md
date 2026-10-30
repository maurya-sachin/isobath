---
title: "What does concurrent rendering mean in React?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [concurrent-rendering, interruptible-rendering, time-slicing, lanes, priorities, transitions]
related:
  - react/concurrent-rendering/fiber
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/deferred-value
  - react/concurrent-rendering/scheduler
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/state/batching-and-updater-functions
  - react/reconciliation/activity
  - react/suspense/suspense-and-transitions
  - react/performance/profiling
  - browser/html-event-loop/rendering-steps
verified: 2026-10
perishable:
  - "React 19.3.1 time-slices only non-blocking lanes; sync and default render whole"
  - "Transition lanes expire after 5 s, then render without yielding"
sources:
  - https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react
  - https://react.dev/blog/2022/03/29/react-v18#gradually-adopting-concurrent-features
  - https://react.dev/blog/2022/03/29/react-v18#new-feature-transitions
  - https://github.com/reactwg/react-18/discussions/64
  - https://react.dev/reference/react/useTransition#starttransition-caveats
  - https://react.dev/reference/react/useDeferredValue#caveats
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberLane.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberRootScheduler.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/ReactDOMEventListener.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/shared/ReactFeatureFlags.js
tldr: >
  React can start rendering an update, pause so the browser can handle input and paint, resume,
  or discard the work and restart with newer state, all on one thread. DOM changes wait for the
  commit, which never pauses, so nobody sees half a render. Only non-urgent updates render this
  way, such as transitions; clicks render in one go.
---

## Answer

Concurrent rendering means **rendering is interruptible**. It isn't parallelism: React still runs on the main thread, one piece at a time. The difference is that a render no longer has to finish once started. React can:

- **pause** it every few milliseconds so the browser can handle events and paint;
- **resume** it later where it left off;
- **abandon** it and start over when a more urgent update arrives, or keep several versions of the UI in preparation.

That's safe because rendering has no visible effects. React computes the new tree off screen and touches the DOM only in the commit, which is still synchronous and uninterruptible. So the user sees either the old UI or the complete new one. The price is that components must be pure: a render may run several times, or never commit.

**Priorities decide what gets interrupted.** Each update gets a priority (a *lane*). Discrete input (click, keydown, input) is the most urgent, then continuous input (mousemove, scroll), then default updates (timers, network callbacks). Those render without yielding, as before. Transitions, `useDeferredValue` re-renders, Suspense retries and hidden `<Activity>` content are non-urgent: React renders them in slices, and a click or keystroke arriving meanwhile is handled first, after which the stale work restarts.

**It's opt-in per update.** React 18 dropped the idea of a "concurrent mode" for the whole app. Every `createRoot` root can render concurrently, but by default updates behave like React 17. Concurrent rendering is used only where you use a concurrent feature, usually through a router or framework that wraps navigations in `startTransition`.

The user-visible result: typing and clicking stay responsive while a large, non-urgent update is prepared in the background, and intermediate states that were superseded are never shown.

## Example

```jsx
let renders = 0;
const SlowItem = memo(function SlowItem({ value }) {
  renders++;
  busyWait(0.5); // 200 items: about 100 ms of rendering
  return <li>{value}</li>;
});

function App() {
  const [count, setCount] = useState(0);
  const [value, setValue] = useState(0);
  useLayoutEffect(() => console.log(`commit count=${count} value=${value}`));
  return (
    <>
      <button id="slow" onClick={() => startTransition(() => setValue(1))}>Slow</button>
      <button id="fast" onClick={() => setCount(count + 1)}>Fast</button>
      {Array.from({ length: 200 }, (_, i) => <SlowItem key={i} value={value} />)}
    </>
  );
}
// Click Slow, then Fast 30 ms later:
// → commit count=1 value=0
// → commit count=1 value=1
```

Chrome 156 and Firefox 159, production and development builds of React 19.3.1; clicks dispatched with `element.click()` from timers. When Fast was clicked, the transition had rendered 59–69 items (Chrome) or 30–35 (Firefox, whose coarser clock made each item take 1 ms). React discarded them, committed Fast, then rendered all 200 items again. `busyWait` spins on `performance.now()`.

## Pitfalls

- Calling it multithreading. Nothing runs in parallel; React yields between components so the browser's own tasks can run.
- Expecting `createRoot` alone to make rendering interruptible. A click or `setTimeout` update in a concurrent root rendered 200 slow items in one task (100 ms in Chrome 156), with no frames in between.
- Assuming every newer update interrupts a transition. A `setTimeout` update arriving mid-transition waited for it to commit; only input-priority updates interrupt.
- Side effects during render. An interrupted render is thrown away and run again, so render-time logging, mutation or subscriptions repeat or leak.

## Follow-ups

**Q:** Does concurrent rendering make updates faster?
**A:** No. The same render took about 100 ms either way; time slicing spreads it across tasks so input and frames get through. Interrupted work is redone, so total work can increase.

**Q:** Why can't the commit be interrupted too?
**A:** It mutates the DOM and runs layout effects. Stopping halfway would show a half-updated page, so React applies the whole finished tree in one synchronous pass.

**Q:** What did React 18 change about "concurrent mode"?
**A:** It was replaced by concurrent features. The working group found most of the value came from APIs like `startTransition`, so default updates stayed synchronous and apps adopt concurrency per update instead of per root.

## Deep dive

### How it works

Every update gets a lane from its context. React DOM reads the current browser event: `click`, `keydown` and `input` map to the sync lane, `mousemove`, `scroll` and `wheel` to the continuous lane, and anything outside an event (a timer, a resolved promise) to the default lane. `startTransition` assigns a transition lane instead, and `useDeferredValue` a deferred one.

Sync work is flushed in a microtask after the event. Everything else becomes a task in React's scheduler. When that task runs, `performWorkOnRoot` decides whether to time-slice, in React 19.3.1:

```js
const shouldTimeSlice =
  (!forceSync &&
    !includesBlockingLane(lanes) &&     // sync, continuous input, default
    !includesExpiredLane(root, lanes)) || // starved for too long
  checkIfRootIsPrerendering(root, lanes);

let exitStatus = shouldTimeSlice
  ? renderRootConcurrent(root, lanes) // loop checks shouldYield() between fibers
  : renderRootSync(root, lanes, true);
```

So blocking lanes render in one go even in a concurrent root. Measured with 200 items of 0.5 ms each, production build, counting browser tasks and animation frames during the render:

| Update | Tasks | Frames during render |
|---|---|---|
| click handler `setState` | 1 | 0 |
| `setTimeout` → `setState` | 1 | 0 |
| click handler `startTransition` | 21 (Chrome) / 40–41 (Firefox) | 6 / 9–11 |

Transition slices lasted about 5 ms each. Firefox's coarser clock made each item take 1 ms, so its renders took twice as long. When an urgent update is scheduled during a concurrent render, React compares lanes; a higher-priority one makes it drop the work-in-progress tree and render the urgent update first. The transition's update stays queued and is rebased onto the new state in the next render.

### Edge cases

**Default updates don't interrupt transitions.** `getNextLanes` keeps an in-progress transition render when the newcomer is in the default lane; the source comment says default and transition updates differ only in refresh behaviour.

```jsx
function handleClick() {
  startTransition(() => setValue(1));
  setTimeout(() => setCount(1), 30); // default lane, arrives mid-render
}
// → commit count=0 value=1
// → commit count=1 value=1
```

Chrome 156 and Firefox 159, development and production: the transition finished first.

- **Starvation.** A transition lane expires 5 s after it was scheduled; from then on the rest renders without yielding. With a 7 s transition in Chrome 156, the slicing stopped at 5,004 ms and the remaining 2 s ran as one task.
- **Prerendering.** Rendering a suspended tree's siblings in the background uses the concurrent loop even for sync lanes, so it never blocks.
- **One component is one unit.** React yields between fibers, never inside a function; split slow work across components or move it out of render.

### Real-world scenario

A search page filters 10,000 rows. With plain state, each keystroke re-renders the table in one task and the input stutters. Keeping the input's state urgent and moving the filter into a transition (or `useDeferredValue`) lets the keystroke commit immediately; the table renders in 5 ms slices and restarts on the next keystroke, so only the final query's table is ever committed. If the table becomes one giant component, slicing stops helping: keep row rendering in separate components.

### Trade-offs

Interruptible rendering trades throughput and simplicity for responsiveness. Abandoned renders are wasted CPU, slices add scheduling overhead, and code must tolerate renders that run twice or never commit. Debugging gets harder because a render you logged may never reach the screen. React 19.3.1 also has a flag, off in its builds, that would yield every 25 ms for transitions instead of every 5 ms, deliberately capping animations near 30 fps to favour finishing the render; the slice size is a tuning choice, not a law.
