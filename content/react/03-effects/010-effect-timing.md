---
title: "When does `useEffect` run, and what is it for?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [use-effect, effects, commit-phase, paint, synchronization]
related:
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/effects/effect-dependencies
  - react/effects/effect-cleanup
  - react/effects/layout-effects
  - react/effects/you-might-not-need-an-effect
  - react/server-rendering/ssr-and-hydration
  - browser/html-event-loop/rendering-steps
verified: 2026-10
perishable:
  - "React 19.3.1 flushes non-discrete passive effects in a separate Scheduler task"
  - "Effect versus next frame order: Chrome 156 and Firefox 159 differ"
sources:
  - https://react.dev/learn/synchronizing-with-effects#what-are-effects-and-how-are-they-different-from-events
  - https://react.dev/learn/synchronizing-with-effects#how-to-write-an-effect
  - https://react.dev/learn/synchronizing-with-effects#not-an-effect-buying-a-product
  - https://react.dev/learn/synchronizing-with-effects#putting-it-all-together
  - https://react.dev/learn/lifecycle-of-reactive-effects#thinking-from-the-effects-perspective
  - https://react.dev/reference/react/useEffect#parameters
  - https://react.dev/reference/react/useEffect#caveats
  - https://react.dev/reference/react/useLayoutEffect#caveats
  - https://react.dev/blog/2022/03/29/react-v18#changelog
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberCommitWork.js
tldr: >
  `useEffect` keeps a component synchronized with something outside React: a connection, a
  subscription, `document.title`. React runs it after the commit, never during render or
  on the server. After a timer or initial render it runs in a later task, so the browser may paint
  first; after a click it may run before paint. Dependencies decide which commits re-run it.
---

## Answer

An effect is code that runs *because the component rendered*, not because the user did something. Its job is to keep the component **synchronized with an external system** while it's on screen: a chat connection, a browser event subscription, a non-React widget, `document.title`. Logic caused by one interaction (submit, buy) belongs in its event handler; values computed from props and state belong in render.

**When it runs.** Never during rendering. React renders, commits the DOM changes, runs layout effects, and only then runs `useEffect` setups, children before parents. The effect sees the committed DOM and the props and state of the render that created it.

*Which* moment after the commit depends on what caused the update:

- **Not a discrete input** (initial `root.render`, a timer, a network response): React schedules effects in a separate task, so the browser can paint between the commit and the effect. That's the documented "usually after paint".
- **A discrete input** such as a click or key press: React runs the effects at the end of the same task, before paint, so their result is observable straight away.
- **`flushSync`, or a layout effect that sets state**: React flushes pending effects synchronously too.

So "after paint" is a tendency, not a promise: visual work that must not flicker goes in `useLayoutEffect`.

**How often.** With no dependency array, after every commit of the component; with `[]`, only after it mounts; with `[a, b]`, after commits where `a` or `b` changed by `Object.is`. Before re-running, React calls the previous cleanup.

**Not a lifecycle method.** Read an effect as "keep this in sync with these values", not "run on mount". Strict Mode tests exactly that in development with an extra setup and cleanup. Effects never run during server rendering, which makes them the place for browser-only APIs.

## Example

```jsx
function Inbox({ unread }) {
  console.log('render', unread);
  useLayoutEffect(() => {
    console.log('layout effect');
    queueMicrotask(() => console.log('microtask'));
  });
  useEffect(() => {
    document.title = `Inbox (${unread})`;
    console.log('effect:', document.title);
  }, [unread]);
  return <h1>{unread} unread</h1>;
}

const root = createRoot(document.getElementById('root'));
root.render(<Inbox unread={3} />);
// → render 3
// → layout effect
// → microtask
// → effect: Inbox (3)
setTimeout(() => root.render(<Inbox unread={3} />), 100);
// → render 3
// → layout effect
// → microtask
setTimeout(() => root.render(<Inbox unread={4} />), 200);
// → render 4
// → layout effect
// → microtask
// → effect: Inbox (4)
```

Same output in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The microtask queued in the layout effect ran before the effect: the commit's task had ended, and the effect ran in a later one. The render with the same `unread` skipped the effect.

## Pitfalls

- Reading `[]` as "on mount" and then using props inside: the effect keeps the first render's values forever. List every value it reads.
- Using an effect to compute something from props or state. That costs an extra render; compute it during render instead.
- Relying on effect timing relative to paint in either direction. Use `useLayoutEffect` to block paint, `setTimeout` to wait for it.
- Touching `window` or `document` during render "because effects don't run on the server". Render runs on the server too; browser-only code goes in the effect.

## Follow-ups

**Q:** In what order do effects run across a tree?
**A:** Children before parents, siblings in order. In the test, both children's effects logged before their parent's. A parent's effect can rely on its children's effects having already run.

**Q:** Does an effect run when the render produced no DOM change?
**A:** Yes, if its dependencies changed. Effects follow dependencies, not DOM output. A component that didn't render at all runs no effects.

**Q:** Why not just put the side effect in the component body?
**A:** Render must be pure: React can call it twice, discard it, or run it on the server. An effect runs only after a committed render, once per commit.

## Deep dive

### How it works

The rest of this subsection is React 19.3.1 implementation detail, from `ReactFiberWorkLoop.js` and `ReactFiberCommitWork.js`.

During render, `useEffect` stores the effect on the fiber and flags it as *passive* when its dependencies changed. The commit then runs its synchronous passes: DOM mutations, then layout effects and ref attachment. Passive effects aren't part of those passes. At the end of the commit React decides when to flush them:

- If the committed lanes include the sync lane (discrete events and `flushSync`), it calls `flushPendingEffects()` before returning. The source comment says this is "so that the result is immediately observable". React 18 introduced this ("Flush useEffect resulting from discrete events like clicks synchronously").
- Otherwise it schedules `flushPassiveEffects` as a normal-priority Scheduler task. Nothing runs until the current task and its microtasks finish.

`flushPassiveEffects` runs every pending cleanup in the tree first, then every setup. And before React commits another update, it flushes any effects still pending from the previous commit, so they never pile up or run out of order.

```jsx
// A layout effect that sets state: React finishes the effects first
useLayoutEffect(() => {
  queueMicrotask(() => console.log('microtask', width));
  if (width === 1) setWidth(2);
});
useEffect(() => console.log('effect', width));
// After setWidth(1) in a timeout:
// → effect 1
// → effect 2
// → microtask 1
// → microtask 2
```

Chrome 156 and Firefox 159, development and production builds. Both effects ran before the first microtask: the layout effect's update forced the pending effects through synchronously, as the `useLayoutEffect` caveats say.

### Edge cases

- **"Usually after paint" is a race.** In the separate-task case, whether the browser paints first depends on when its next frame is due. A `requestAnimationFrame` callback registered in a layout effect ran *before* the effect after a timer update in 10 of 10 headless Firefox 159 runs (both builds), but in only 2 of 10 headless Chrome 156 runs (development build; 0 of 10 in production).
- **Effects from discrete events** may run before paint, so an `alert()` in one can block the screen before it shows the update. Defer it with `setTimeout`.
- **Server rendering.** `renderToString` in Node 24 ran no effect of any kind and printed no warning.

### Real-world scenario

A page sets `document.title` and reports a page view. Both are effects: they synchronize the outside world with what's on screen, whichever interaction caused the render. Sending the order when the user presses "Buy" is not: it belongs to that click, and in an effect it would rerun on remount and be sent twice in development.

### Trade-offs

Deferring effects keeps the commit short, so the browser can show the new screen sooner. The cost is a possible frame with the effect not yet applied; for visual corrections that's a flicker, which is what `useLayoutEffect` is for. Running effects synchronously after discrete events trades that paint latency for predictability: code after a click can rely on the effect having run.
