---
title: "Why does state still hold the old value right after you set it?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [use-state, snapshot, stale-closure, event-handlers, closures]
related:
  - react/rendering-model/render-and-commit
  - react/rendering-model/when-components-rerender
  - react/rendering-model/rules-of-hooks
  - react/state/batching-and-updater-functions
  - react/state/immutable-updates
  - react/refs/refs-vs-state
  - react/effects/effect-dependencies
  - react/effects/effect-events
  - javascript/closures/what-is-a-closure
  - javascript/closures/closures-in-loops
verified: 2026-10
sources:
  - https://react.dev/learn/state-as-a-snapshot#rendering-takes-a-snapshot-in-time
  - https://react.dev/learn/state-as-a-snapshot#state-over-time
  - https://react.dev/reference/react/useState#setstate-caveats
  - https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
  - https://react.dev/reference/react/useState#is-using-an-updater-always-preferred
  - https://github.com/reactwg/react-18/discussions/21
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  Each render is a separate call of your component, and `useState` gives that call the state as a
  plain constant. Handlers and timeouts created during the render close over it. The setter can't
  change that constant; it queues an update and asks for another render, which gets its own value.
  Code from the old render keeps the old one.
---

## Answer

`const [count, setCount] = useState(0)` declares an ordinary local constant. React keeps the real state outside your component and, on every render, calls your function and hands it the value for that render. Everything the render creates, from JSX to event handlers and their timeout callbacks, is computed from that value and closes over it. The docs call this a **snapshot**.

`setCount(count + 1)` doesn't reassign `count`, and couldn't: `count` is a `const` inside a function call that already ran. The setter queues an update and asks React to render again. The next render is a new call with a new `count` binding. The running handler belongs to the old call and keeps the old value: on the next line, after an `await`, and in a timeout that fires long after the screen changed.

The usual symptoms:

- `console.log(count)` right after the setter prints the old value.
- `setCount(count + 1)` three times in one handler adds 1, since all three read the same `count`.
- A `setInterval` created once in an effect with `[]` reads the first render's value forever.

When you need the new value:

- **In the same handler:** compute it into a variable, pass that to the setter, and keep using it.
- **Based on the previous state:** pass an updater, `setCount(c => c + 1)`. It receives the latest queued state, not the snapshot.
- **From a long-lived callback:** let the effect re-subscribe when the value changes, or keep the latest value in a ref.

The snapshot is deliberate: a handler acts on what the user saw when they clicked, not on whatever state has become once an async step finishes. And for discrete events like clicks, React renders before the next one, so the next click's handler already sees the new value.

## Example

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  console.log('render', count);

  function handleClick() {
    setCount(count + 1);
    console.log('handler', count);
    setTimeout(() => console.log('timeout', count), 1000);
  }
  return <button onClick={handleClick}>{count}</button>;
}
// Mount → render 0
// First click:
// → handler 0
// → render 1
// → timeout 0
// Second click:
// → handler 1
// → render 2
// → timeout 1
```

Same logs in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The timeout fires a second after the button shows `1` and still logs `0`: it closed over the first render's `count`. The second click ran the handler created by the second render.

## Pitfalls

- Deciding something from state right after setting it: `setItems(next); if (items.length > 10) …` checks the old array. Use `next`.
- Stale closures in intervals, subscriptions and callbacks created once in an effect with `[]`: they read the render that created them, forever.
- Expecting `await` to refresh state. After the `await`, the handler's variables still come from the render it was created in.
- Fixing a stale read by removing the variable from an effect's dependencies, or by suppressing the lint rule. That hides the stale closure instead of fixing it.

## Follow-ups

**Q:** Do class components behave the same way?
**A:** Only partly. Right after `this.setState`, `this.state` still holds the old value. But React replaces `this.state` on the instance when it renders the update, so a timeout reading `this.state.count` logged `1` where the hook version logged `0`. Hooks have no instance for React to update.

**Q:** Is the stale value a React bug?
**A:** No. It's how closures work: each render is a function call, and callbacks keep the bindings of the call that created them. React could only "fix" it by mutating your variables, which would make one render's output disagree with its own handlers.

**Q:** How do you read the latest state inside an interval?
**A:** If you only need to compute the next state, use an updater: `setSeconds(s => s + 1)`. If you need the value for something else, such as sending it, list it as a dependency so the effect recreates the interval, or mirror it in a ref.

## Deep dive

### How it works

React 19.3.1 keeps each `useState` call's state in a hook object on the component's fiber, matched to the call by its position (implementation details from `ReactFiberHooks.js`; see the Rules of Hooks question for the ordering). The hook holds the committed value (`memoizedState`) and a queue of pending updates. `useState` returns `[hook.memoizedState, setter]`, and your destructuring copies the value into a local constant.

The setter is `dispatchSetState`, bound to that fiber and queue when the component mounted, which is why its identity never changes. It appends an update object to the queue and schedules a render. It never touches your variable. On the next render, `useState` walks the queue, applies the updates to the base state and returns the result. That is the only place a new value appears.

The rest is ordinary JavaScript. Each call of your component creates a new environment with its own `count`; functions created during that call close over that environment, exactly like callbacks created in separate calls of any function. After the commit, the new render's handlers are the ones React calls, so the next click runs code that closes over the new value.

### Edge cases

An `await` doesn't change anything, because the variable belongs to the call, not to the moment:

```jsx
function SendButton() {
  const [status, setStatus] = useState('idle');
  console.log('render', status);

  async function handleClick() {
    setStatus('sending');
    await new Promise((resolve) => setTimeout(resolve, 200));
    console.log('after await', status);
  }
  return <button onClick={handleClick}>Send</button>;
}
// After a click:
// → render sending
// → after await idle
```

Chrome 156 and Firefox 159, development and production builds. The component had rendered with `'sending'` before the `await` finished; the handler still read `'idle'`.

- **Updater functions** are the exception to the snapshot: React passes them the pending state from the queue, so they compose. That's the subject of the batching question.
- **Objects are captured by reference.** The snapshot is the reference, not a deep copy. If someone mutates the object, an old closure sees the mutation, which is one more reason state must be updated immutably.
- **Refs aren't snapshotted.** `ref.current` read in a timeout returns whatever it holds at that moment. That's why refs are the escape hatch for "latest value" reads, and why reading them during render is discouraged.

### Real-world scenario

A draft editor autosaves with `useEffect(() => { const id = setInterval(() => save(draft), 5000); … }, [])`. Every save sends the empty initial draft, because the interval closed over the first render. Listing `draft` as a dependency fixes the value but restarts the timer on every keystroke, so a fast typist never triggers a save. The usual fix keeps the interval stable and reads the current draft from a ref the component keeps updated, or from an Effect Event.

The snapshot is what you want in the opposite case. react.dev's example sends a message after a five-second delay: if the user switches the recipient during the delay, the message still goes to the person who was selected when they pressed Send.

### Trade-offs

Snapshots make each render internally consistent: its output, its handlers and its effects all agree on one set of values, and React can prepare a render with newer state, as concurrent rendering does, without changing the handlers already on screen. The cost lands on long-lived callbacks, which have to opt into fresh values explicitly through updaters, dependencies or refs. Class components chose the other side: `this.state` is always current, and so a timeout can read state that no longer matches what it was scheduled for.

## Exercises

### The timer that stops

```jsx
function Timer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(seconds + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <p>{seconds}</p>;
}
```

**Answer:** It shows `1` after a second and stays at `1`. The interval callback was created during the first render and closes over `seconds = 0`, so every tick calls `setSeconds(1)`; once the state is `1`, React finds it unchanged and bails out. `setSeconds((s) => s + 1)` doesn't read the snapshot and counts up.
