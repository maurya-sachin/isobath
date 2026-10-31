---
title: "What does `useTransition` change for the user?"
status: draft
difficulty: medium
frequency: 4
core: true
tags: [use-transition, start-transition, is-pending, transitions, async-transitions, lanes]
related:
  - react/concurrent-rendering/interruptible-rendering
  - react/concurrent-rendering/deferred-value
  - react/concurrent-rendering/scheduler
  - react/concurrent-rendering/view-transition
  - react/state/batching-and-updater-functions
  - react/suspense/suspense-and-transitions
  - react/forms-and-actions/actions
  - react/forms-and-actions/use-optimistic
  - react/forms-and-actions/controlled-vs-uncontrolled
verified: 2026-10
perishable:
  - "Setters after `await` need their own `startTransition` (React 19.3.1)"
  - "React currently batches all ongoing Transitions together"
sources:
  - https://react.dev/reference/react/useTransition#usetransition
  - https://react.dev/reference/react/useTransition#returns
  - https://react.dev/reference/react/useTransition#starttransition-parameters
  - https://react.dev/reference/react/useTransition#starttransition-caveats
  - https://react.dev/reference/react/useTransition#displaying-a-pending-visual-state
  - https://react.dev/reference/react/useTransition#displaying-an-error-to-users-with-error-boundary
  - https://react.dev/reference/react/useTransition#updating-an-input-in-a-transition-doesnt-work
  - https://react.dev/reference/react/useTransition#react-doesnt-treat-my-state-update-as-a-transition
  - https://react.dev/reference/react/useTransition#react-doesnt-treat-my-state-update-after-await-as-a-transition
  - https://react.dev/reference/react/useTransition#i-want-to-call-usetransition-from-outside-a-component
  - https://react.dev/reference/react/useTransition#my-state-updates-in-transitions-are-out-of-order
  - https://react.dev/reference/react/startTransition#caveats
  - https://react.dev/blog/2022/03/29/react-v18#new-feature-transitions
  - https://react.dev/blog/2024/12/05/react-19#actions
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberRootScheduler.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberLane.js
tldr: >
  It marks state updates as non-urgent. The old screen stays on display and responsive while React
  renders the new one in the background; a click or keystroke meanwhile is handled first and the
  stale render is dropped. `isPending` is `true` until the result commits, so you can show progress
  without hiding the old content. It doesn't make rendering faster.
---

## Answer

`const [isPending, startTransition] = useTransition()` gives you a way to say "this update can wait". Every setter called during `startTransition(() => setTab('posts'))` becomes a *Transition*. For the user, three things change:

- **The page stays responsive.** React renders the new UI in the background, in small slices, so clicks and typing are still handled while it works. The same update without a Transition renders in one block, and input waits for it.
- **Superseded work is dropped.** If the user clicks or types during that render, React handles the input first, discards the half-built tree and starts again with the newest state. An abandoned screen is never shown.
- **`isPending` gives feedback.** It turns `true` immediately and stays `true` until the Transition commits, so you can dim the old content or show a spinner while it remains on screen. With Suspense, a Transition also keeps already-revealed content instead of falling back to a loading state.

What it doesn't do: delay anything or speed up rendering. The callback runs immediately and synchronously; only the updates scheduled *while it runs* are marked. A setter inside a `setTimeout` in the callback is not a Transition.

Rules:

- You need the state's setter. For a prop or a value you don't own, use `useDeferredValue`.
- Transition updates can't control a text input. Keep the input's own state urgent and put the expensive state in the Transition.
- The standalone `startTransition` import works outside components, for routers and data libraries, but has no `isPending`.

**Async Transitions (React 19).** The callback may be async; such a function is called an Action. `isPending` stays `true` until it finishes, and its Transition updates commit together at the end. A setter after an `await` loses the Transition, though, and must be wrapped in another `startTransition`.

## Example

```jsx
const Post = memo(function Post({ i }) {
  busyWait(0.5); // 200 posts: about 100 ms of rendering
  return <li>Post {i}</li>;
});

function Tabs() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');
  useLayoutEffect(() => console.log(`commit tab=${tab} isPending=${isPending}`));
  const select = (next) => startTransition(() => setTab(next));
  return (
    <>
      <button onClick={() => select('posts')}>Posts</button>
      <button onClick={() => select('contact')}>Contact</button>
      {isPending && <p>Loading…</p>}
      {tab === 'posts' ? <ul>{posts.map((i) => <Post key={i} i={i} />)}</ul> : <p>{tab}</p>}
    </>
  );
}
// Click Posts, then Contact 30 ms later:
// → commit tab=about isPending=true
// → commit tab=contact isPending=false
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, three runs each; clicks dispatched with `element.click()` from timers. The Posts render was abandoned after 64–68 posts (Chrome) or 29–35 (Firefox). With a plain `setTab(next)`, it logged `commit tab=posts`, then `commit tab=contact`: the Contact click was handled only after 108–109 ms (Chrome) or 206–217 ms (Firefox).

## Pitfalls

- Putting a controlled input's state in a Transition. React resets the input to the old state right after the event, so the typed character vanished until the Transition committed. Six keystrokes sent back to back left just `f` in Chrome 156.
- Setting state after an `await` without a second `startTransition`. That update is urgent: it committed 100 ms in, while `isPending` was still `true`, showing a half-finished result.
- Expecting a Transition to split one slow component. React yields between components, never inside one; a single 100 ms component is still a 100 ms task.
- Scheduling the update later, as in `setTimeout` or `.then()` inside the callback. Only setters called while the callback runs are marked.

## Follow-ups

**Q:** `useTransition` or the standalone `startTransition`?
**A:** Both mark updates the same way. The Hook adds `isPending`, and an error thrown by its Action reaches the component's error boundary. The import works anywhere, with neither.

**Q:** What happens when two Transitions overlap?
**A:** The docs say React currently batches ongoing Transitions together. In the example, the Posts and Contact updates rendered as one, and only `contact` was ever committed.

**Q:** When would you use `useDeferredValue` instead?
**A:** When you don't control the setter, for example a value arriving as a prop, or when one state value feeds both the urgent input and the slow list.

## Deep dive

### How it works

`startTransition` is a flag around your callback, not a scheduler call. Simplified from React 19.3.1's `ReactFiberHooks.js` and `ReactFiberWorkLoop.js` (implementation details):

```js
function startTransition(callback) {
  setIsPending(true);                  // urgent: at least continuous-input priority
  ReactSharedInternals.T = {};         // "a Transition is running"
  try {
    const result = callback();         // your setters run now
    setIsPending(isThenable(result) ? afterActionSettles(result, false) : false);
  } finally {
    ReactSharedInternals.T = previous;
  }
}

function requestUpdateLane(fiber) {
  if (ReactSharedInternals.T !== null) return requestTransitionLane(); // one of 14 bits
  return eventPriorityToLane(resolveUpdatePriority());                 // click → sync lane
}
```

So `isPending` is ordinary state updated twice. The `true` update has input priority and commits right away: that's the first log line. The `false` update gets the Transition's lane, so it commits in the same render as your `setTab`. All Transition updates in one event share a lane, and the concurrent rendering question covers how Transition lanes render in time slices and get interrupted.

For an async callback, the `false` value is a thenable that resolves when the Action finishes; reading it suspends the render until then. React also reuses the same lane for every Transition started inside the running Action (its *entangled action lane*). That's why updates inside an Action wait for the whole Action.

### Edge cases

**State after `await`.** By the time the code after an `await` runs, `startTransition` has returned and `ReactSharedInternals.T` is cleared: React can't follow async context. The docs say this will change once JavaScript has `AsyncContext`.

```jsx
startTransition(async () => {
  await delay(100);
  setPage('unwrapped'); // not a Transition
  await delay(100);
});
// → 0 ms: page=home isPending=true
// → 100 ms: page=unwrapped isPending=true
// → 200 ms: page=unwrapped isPending=false

startTransition(async () => {
  await delay(100);
  startTransition(() => setPage('wrapped'));
  await delay(100);
});
// → 0 ms: page=unwrapped isPending=true
// → 200 ms: page=wrapped isPending=false
```

Chrome 156 and Firefox 159, development and production, times rounded to 10 ms (one Chrome run logged 210 ms). The wrapped update waited for the whole Action, so the user never saw the new page without the finished state.

- **Controlled inputs.** React restores a controlled input's DOM value to its current state after each change event. A listener on `document` already saw `""` after typing `a`; the value came back only with the commit.
- **Errors.** An error thrown in the callback, or a rejected promise from an async one, is rethrown when the component renders, so the nearest error boundary shows it.
- **Out of order.** Actions in a Transition don't guarantee execution order, so a slow earlier response can overwrite a newer one. The docs point to `useActionState` and `<form>` actions, which handle ordering.

### Real-world scenario

A search box filtering a large list. The split that works keeps two states:

```jsx
function handleChange(e) {
  setText(e.target.value);                         // urgent: the input
  startTransition(() => setQuery(e.target.value)); // non-urgent: the results
}
// Six keystrokes sent back to back; the results take 80 ms to render:
// → commit text=a query=
// … one commit per keystroke, query still empty …
// → commit text=abcdef query=
// → commit text=abcdef query=abcdef
```

That's Chrome 156, production build. The input committed on every keystroke; the results committed once, for the final query, because each newer keystroke interrupted the stale render. Firefox 159's slower automated typing let every query commit in between. Routers apply the same idea to navigation: wrap the URL state change in a Transition so the old page stays interactive and `isPending` drives a progress bar.

### Trade-offs

A Transition buys responsiveness with extra renders: one for `isPending`, possibly several abandoned ones, and the final one, so total CPU goes up. The user sees stale content for longer, which is right for navigation and filtering but wrong for anything that must reflect input instantly. It needs code structure, too: the slow part must be split into components React can yield between, and the state must be yours to set. When those don't hold, `useDeferredValue`, memoization, or plain debouncing of network requests may fit better.
