---
title: "How does React's scheduler yield to the browser?"
status: draft
difficulty: hard
frequency: 2
core: false
tags: [scheduler, time-slicing, message-channel, yielding, priorities, event-loop]
related:
  - react/concurrent-rendering/interruptible-rendering
  - react/concurrent-rendering/fiber
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/deferred-value
  - browser/html-event-loop/task-priority-and-scheduler
  - browser/html-event-loop/rendering-steps
  - browser/html-event-loop/timer-accuracy
  - javascript/async-and-the-event-loop/event-loop
verified: 2026-10
perishable:
  - "`frameYieldMs` is 5 ms in scheduler 0.28.0 (React 19.3.1)"
  - "react-dom 19.3.1 uses the MessageChannel build, not postTask"
sources:
  - https://github.com/facebook/react/blob/v19.3.1/packages/scheduler/README.md
  - https://github.com/facebook/react/blob/v19.3.1/packages/scheduler/src/forks/Scheduler.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/scheduler/src/SchedulerFeatureFlags.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/scheduler/src/forks/SchedulerPostTask.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberRootScheduler.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactEventPriorities.js
  - https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timer-initialisation-steps
tldr: >
  React queues non-urgent render work in its own `scheduler` package, which runs it inside browser
  tasks it starts by posting a `MessageChannel` message. Between components React asks
  `shouldYield()`; after 5 ms the answer is yes, so the task ends and a new message continues the work,
  letting input and painting run in between. It's cooperative: a component is never interrupted.
---

## Answer

React ships its own cooperative scheduler, the `scheduler` npm package: internal to React, with no finalized public API, and unrelated to the browser's `scheduler.postTask()`.

**Queueing.** When a root has work that isn't flushed synchronously, React schedules a callback with a priority: user-blocking for input lanes, normal for default updates, Transitions and retries, idle for the idle lane. Each priority sets a timeout (250 ms, 5 s, never), and tasks wait in a min-heap ordered by expiration time.

**Running.** The scheduler doesn't run tasks directly. It asks the browser for a task by posting a message on a `MessageChannel`, and in that message handler runs queued callbacks in order. Not `setTimeout(fn, 0)`: the source comment cites the 4 ms clamp on nested timers. Not `requestAnimationFrame` either: the work doesn't need to line up with frames.

**Yielding.** React's concurrent work loop calls `shouldYield()` before every fiber. It returns `true` once 5 ms (`frameYieldMs`) have passed since the browser task started, or straight after a commit so the browser can paint it. React then stops, keeping its place in `workInProgress`, and returns a continuation. The scheduler keeps it as the same task, posts another message and returns, ending the browser task. Input and rendering run, then the message arrives and work resumes. A click that arrives meanwhile may schedule an urgent update, and React restarts with it.

What doesn't go through this path:

- **Sync-lane updates** (click, keydown, input) render in the event's own task, with no messages and no yielding.
- **Blocking lanes** that do become scheduler tasks, like a `setTimeout` update, still render without calling `shouldYield()`. Only Transitions, deferred values, retries and hidden work are sliced.
- **Expired work.** A task past its timeout runs without yielding, so starved updates finish.

It's cooperative: it stops only between components, never inside one.

## Example

```jsx
let messages = 0;
const post = MessagePort.prototype.postMessage;
MessagePort.prototype.postMessage = function (...args) {
  messages++;
  return post.apply(this, args);
};

const slices = []; // one entry per browser task that rendered items
let slice = null;
const Item = memo(function Item({ value }) {
  if (!slice) {
    const current = (slice = { start: performance.now() });
    slices.push(current);
    queueMicrotask(() => { current.end = performance.now(); slice = null; }); // task ends
  }
  busyWait(0.5); // 200 items: about 100 ms of rendering
  return <li>{value}</li>;
});

function report() {
  const ms = slices.map((s) => Math.round(s.end - s.start));
  console.log(`slices ${slices.length}, messages ${messages}, longest ${Math.max(...ms)} ms`);
}
// <App> renders 200 <Item value={value} />. Each click resets the counters, then:
startTransition(() => setValue(1)); // and setTimeout(report, 500)
// → slices 21, messages 22, longest 5 ms
setValue(2); // and setTimeout(report, 500)
// → slices 1, messages 0, longest 100 ms
```

Chrome 156, production build of React 19.3.1, three runs. Firefox 159 logged `slices 40, messages 42` (once 41) and `longest 200 ms` for the urgent update, because its coarser clock made each item take 1 ms. A Chrome trace showed the same: 21 `performWorkUntilDeadline` calls of 4.9–5.1 ms, the last 2.0 ms. The spare messages started scheduler work queued after the commit; development builds posted one more.

## Pitfalls

- Confusing the `scheduler` package with the browser's `scheduler` global. Both browsers expose `scheduler.postTask`, but a spy on it counted zero calls during the Transition.
- Assuming everything scheduled is time-sliced. A `setTimeout` update becomes a normal-priority scheduler task, yet it renders in one block.
- Expecting slices to match frames. The scheduler yields every 5 ms regardless of frame timing; during the 100 ms Transition, Chrome still ran 6 animation frames, in the gaps between slices.
- Importing the `unstable_` scheduler APIs in app code. They exist for React; use `startTransition` or the browser's `scheduler.yield()` instead.

## Follow-ups

**Q:** Why `MessageChannel` and not `setTimeout(fn, 0)`?
**A:** Nested timers are clamped to at least 4 ms. With `MessageChannel` deleted before React loaded, the scheduler fell back to `setTimeout`: the same 100 ms Transition took 175 ms in Chrome and 334 ms in Firefox instead of 101 and 202.

**Q:** Does React use `scheduler.postTask()` where it exists?
**A:** Not by default. The package ships a `scheduler/unstable_post_task` build mapping priorities to `user-blocking`, `user-visible` and `background`, but `react-dom` 19.3.1 requires plain `scheduler`, the `MessageChannel` build.

**Q:** Why yield right after a commit?
**A:** React calls `requestPaint()` during the commit. The next `shouldYield()` returns `true` regardless of time left, so the browser can paint the new UI before more work runs.

## Deep dive

### How it works

Simplified from `Scheduler.js` at React 19.3.1 (implementation detail; the real code also handles delayed tasks, profiling and errors):

```js
const channel = new MessageChannel();
channel.port1.onmessage = performWorkUntilDeadline;

function performWorkUntilDeadline() {
  needsPaint = false;
  startTime = getCurrentTime();
  const hasMoreWork = workLoop(startTime);
  if (hasMoreWork) channel.port2.postMessage(null); // continue in a new browser task
}

function shouldYieldToHost() {
  if (needsPaint) return true;                    // set by requestPaint() during a commit
  return getCurrentTime() - startTime >= 5;       // frameYieldMs
}

function workLoop(currentTime) {
  let task = peek(taskQueue);                     // earliest expiration first
  while (task !== null) {
    if (task.expirationTime > currentTime && shouldYieldToHost()) break;
    const continuation = task.callback(task.expirationTime <= currentTime);
    currentTime = getCurrentTime();
    if (typeof continuation === 'function') {     // React stopped mid-render
      task.callback = continuation;
      return true;                                // yield now, keep the task
    }
    pop(taskQueue);
    task = peek(taskQueue);
  }
  return task !== null;
}
```

React's side is in `ReactFiberRootScheduler.js`: `lanesToEventPriority` maps the root's highest lane to an event priority, then to a scheduler priority. Transition lanes count as default, so they get `NormalPriority` and its 5 s timeout. The callback passed to the scheduler, `performWorkOnRootViaSchedulerTask`, receives `didTimeout`; when it's `true`, React renders synchronously. When its render loop stops on `shouldYield()` with work left at the same priority, it returns a bound copy of itself as the continuation. The scheduler's own `ImmediatePriority` goes unused for rendering: a source comment explains that sync work now goes through microtasks.

### Edge cases

- **Fallbacks.** The browser build picks `setImmediate` if it exists (Node.js, old IE), then `MessageChannel`, then `setTimeout`. Without `MessageChannel`, slices stayed at 5 ms but the gaps between them grew to 3–5 ms (three runs per browser), the timer clamp at work.
- **Back-to-back slices.** With nothing else queued, Chrome ran the next slice within 0.3 ms; the yield costs little when the browser has nothing to do.
- **Frame rate override.** `unstable_forceFrameRate(fps)` changes the 5 ms interval to `1000 / fps`; it's an unstable export, not something React calls.

### Trade-offs

A fixed 5 ms slice favours responsiveness: input waits at most one slice plus one component. The cost is overhead per yield and longer total time when the browser has other work to fit in. A `MessageChannel` message has no notion of priority, so React's priorities exist only inside its own queue; the browser can't tell React's background work from anything else. The `postTask` build would hand that to the browser, but it isn't React DOM's default.
