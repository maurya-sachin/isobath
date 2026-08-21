---
title: "What happens between a state update and the screen changing?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [render-phase, commit-phase, set-state, use-layout-effect, flush-sync, paint]
related:
  - react/rendering-model/jsx-and-elements
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/when-components-rerender
  - react/state/state-as-snapshot
  - react/state/batching-and-updater-functions
  - react/effects/effect-timing
  - react/effects/layout-effects
  - react/reconciliation/diffing-heuristics
  - react/concurrent-rendering/fiber
  - react/concurrent-rendering/interruptible-rendering
  - browser/html-event-loop/rendering-steps
  - browser/rendering-pipeline/pixel-pipeline
verified: 2026-10
perishable:
  - "React 19.3.1 renders click updates in a microtask queued by setState"
  - "Timer update rendered before next frame: Chrome 156 yes, Firefox 159 no"
sources:
  - https://react.dev/learn/render-and-commit#step-1-trigger-a-render
  - https://react.dev/learn/render-and-commit#step-2-react-renders-your-components
  - https://react.dev/learn/render-and-commit#step-3-react-commits-changes-to-the-dom
  - https://react.dev/learn/render-and-commit#epilogue-browser-paint
  - https://react.dev/reference/react/useLayoutEffect#uselayouteffect-blocks-the-browser-from-repainting
  - https://react.dev/reference/react/useEffect#caveats
  - https://react.dev/reference/react-dom/flushSync#flushsync
  - https://react.dev/blog/2022/03/29/react-v18#changelog
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberRootScheduler.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
tldr: >
  Three steps, then the browser. Trigger: `setState` queues an update and schedules a render;
  nothing changes yet. Render: React calls the component and its children and works out what
  differs, without touching the DOM. Commit: React applies those DOM changes in one synchronous
  pass, then runs layout effects. The browser paints after React's JavaScript returns.
---

## Answer

React splits an update into **trigger, render and commit**; painting is the browser's job afterwards.

**1. Trigger.** Calling `setCount` doesn't change `count` or the DOM. It queues an update on the component and asks React to schedule a render. Code after it in the handler still sees the old state and the old DOM; updates from the same event are batched into one render.

**2. Render.** React calls the component that owns the state, then the components it returns, recursively. Each call returns elements; React compares them with the previous render's output to work out which DOM changes are needed. Nothing is applied yet. Because this phase has no side effects, React can repeat it (Strict Mode), pause it, or throw the result away (concurrent rendering) without the user seeing anything, which is why components must be pure.

**3. Commit.** React applies the minimal DOM operations in one synchronous pass that can't be interrupted, so the page never shows half an update. Unchanged nodes are left alone, which is why an `<input>` keeps its typed text when its parent re-renders. Then React attaches refs and runs `useLayoutEffect` callbacks, which can read the new layout.

**4. Paint.** Once React's JavaScript and the microtasks after it finish, the browser runs its rendering update: style, layout, paint. `useLayoutEffect` and any updates it schedules complete before that paint. `useEffect` callbacks usually run after paint, but after a discrete input such as a click React may run them before it, and in practice does.

So "render" in React means calling your components, not drawing pixels. A render that produces the same output commits no DOM changes at all.

## Example

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  const button = useRef(null);
  console.log('render', count);

  useLayoutEffect(() => {
    console.log('layout effect, DOM shows', button.current.textContent);
  });
  useEffect(() => console.log('effect'));

  function handleClick() {
    setCount(count + 1);
    console.log('handler, DOM shows', button.current.textContent);
    queueMicrotask(() => console.log('microtask'));
    requestAnimationFrame(() => console.log('animation frame'));
  }
  return <button ref={button} onClick={handleClick}>{count}</button>;
}
// After a real click:
// → handler, DOM shows 0
// → render 1
// → layout effect, DOM shows 1
// → effect
// → microtask
// → animation frame
```

Same order in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The render ran before the handler's own microtask because `setCount` had already queued React's scheduling microtask, an implementation detail. The animation frame callback runs in the browser's next rendering update, just before it paints `1`.

## Pitfalls

- Reading the DOM, or state, right after `setState` and expecting the new value. The render hasn't happened yet; use the value you passed, or `flushSync` when the DOM really must update first.
- Equating a render with a DOM update. React may call a component and commit nothing; costly renders are a CPU problem, not a DOM problem.
- Putting side effects in the component body. Render can run more than once or be discarded; effects and handlers are where side effects go.
- Assuming `useEffect` always runs after paint. After a click it can run before; work that must wait for paint, such as an `alert()`, goes in a `setTimeout`.

## Follow-ups

**Q:** How do you make the DOM update before the next line of a handler?
**A:** Wrap the update in `flushSync(() => setCount(c => c + 1))` from `react-dom`. React renders and commits inside the call; in the test both effects had also run before it returned. It's a last resort: it defeats batching and can hurt performance.

**Q:** Can the render phase be interrupted?
**A:** Yes, for non-urgent updates such as transitions: React can yield to the browser between components and restart with newer state. Commit never yields. Urgent updates like typing and clicks render synchronously.

**Q:** Does a re-render recreate the DOM?
**A:** No. On the initial render React creates and appends DOM nodes; on later renders it changes only the attributes, text and nodes whose output differed.

## Deep dive

### How it works

**Trigger.** In React 19.3.1, `setState` adds an update to the component's fiber, marks a lane (a priority) on it and its ancestors, and calls `ensureRootIsScheduled`, which queues one microtask per batch. In that microtask React decides what to do with each root: work in the sync lane (from discrete events like `click` and `keydown`) is rendered and committed right there; default and transition lanes are handed to React's Scheduler as separate tasks. All of this is implementation detail; the documented contract is only that updates are queued and batched.

**Render.** React walks the fiber tree from the root. Fibers with no pending work and no changed inputs are reused; components with pending updates are called, and their returned elements are reconciled against the existing child fibers. The result is a work-in-progress tree with flags recording which DOM operations and effects the commit needs. For transition updates, the loop checks between units of work whether to yield to the browser.

**Commit.** `commitRoot` runs in three passes over the flagged fibers:

1. *Before mutation*: reads the DOM before it changes (`getSnapshotBeforeUpdate` in class components).
2. *Mutation*: inserts, updates and removes DOM nodes, detaches old refs and runs layout effect cleanups. React then makes the work-in-progress tree the current one (`root.current = finishedWork`).
3. *Layout*: attaches refs and runs `useLayoutEffect` setups, `componentDidMount` and `componentDidUpdate`.

Passive effects (`useEffect`) come last. The source flushes them synchronously at the end of a commit that included the sync lane, "so that the result is immediately observable"; otherwise they wait until after paint. React 18 introduced that rule for discrete events.

**Paint.** The browser can only paint between tasks, after the microtask checkpoint, when a rendering opportunity arrives. Everything above, layout effects included, finishes inside one task, so the next frame shows the committed DOM.

```jsx
// The Example's Counter, with this handler (flushSync from react-dom)
function handleClick() {
  flushSync(() => setCount((c) => c + 1));
  console.log('next line, DOM shows', button.current.textContent);
}
// → render 1
// → layout effect, DOM shows 1
// → effect
// → next line, DOM shows 1
```

Chrome 156 and Firefox 159, development build: `flushSync` ran the whole render and commit, effects included, before returning.

### Edge cases

- **Updates outside events.** A `setState` in a `setTimeout` callback uses the default lane. The handler's own microtask ran first, then React rendered in a Scheduler task. Chrome 156 rendered it before the next animation frame and Firefox 159 after it, so don't depend on either.
- **Layout effect that sets state.** The update is processed synchronously before paint, so a measured-then-corrected position never flashes; that's the documented use of `useLayoutEffect`, at the cost of blocking paint.
- **Same output.** If a render returns elements equal in every prop to the last render, the commit finds nothing to change and the DOM isn't touched. Effects still run if their dependencies changed.

### Real-world scenario

Adding an item to a list and scrolling to it: `setItems(next)` followed by `listRef.current.lastChild.scrollIntoView()` scrolls to the old last item, because the new `<li>` doesn't exist until commit. In the test, `lastChild` was still the old item after a plain `setItems` and the new one after `flushSync`. Either wrap the update in `flushSync`, or move the scroll into an effect that runs after the commit. The tooltip case is the reverse problem: measure in `useLayoutEffect` and set the position there, so the user never sees the first, unmeasured render.

### Trade-offs

Separating render from commit is what lets React batch updates, pre-render work in the background, retry after Suspense, and double-render in Strict Mode, all without visible half-states. The cost is a rule: render must be pure, since React may call it any number of times. And by default an update re-renders the whole subtree below the component that changed; `memo` and the React Compiler are the opt-outs, not the commit phase.
