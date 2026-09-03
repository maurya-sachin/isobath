---
title: "What is Fiber, and why did React rewrite its reconciler?"
status: draft
difficulty: hard
frequency: 3
core: true
tags: [fiber, reconciler, work-in-progress, double-buffering, alternate, stack-reconciler, lanes]
related:
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/rules-of-hooks
  - react/reconciliation/diffing-heuristics
  - react/concurrent-rendering/interruptible-rendering
  - react/concurrent-rendering/scheduler
  - javascript/async-and-the-event-loop/event-loop
verified: 2026-10
perishable:
  - "Fiber field names and lane bits as of React 19.3.1"
sources:
  - https://github.com/acdlite/react-fiber-architecture
  - https://legacy.reactjs.org/blog/2017/09/26/react-v16.0.html#new-core-architecture
  - https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiber.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberBeginWork.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberLane.js
tldr: >
  Fiber is React's reconciler since React 16. Every component and host element gets a fiber, a
  plain object that is one unit of work, linked to its parent, first child and next sibling.
  Because the tree is data, not the call stack, React can stop between fibers, resume, restart
  or discard work. The old stack reconciler recursed and couldn't pause.
---

## Answer

**What it is.** Fiber is React's reconciler since React 16: the part that calls your components and works out what changed. Every component instance and host element (`<li>`, a text node) is represented by a *fiber*, a plain object holding:

- what it is: `tag`, `type`, `key`, and `stateNode` (the DOM node or class instance);
- where it is: `return` (parent), `child` (first child), `sibling` (next sibling);
- inputs and results: `pendingProps`, `memoizedProps`, `memoizedState` (the hook list, for function components), `updateQueue`;
- pending work: `lanes` and `childLanes` (priorities of queued updates) and `flags` (what the commit must do);
- `alternate`: its other copy.

**Why rewrite.** The stack reconciler (React 15 and earlier) rendered by recursion: rendering a component called into its children, so the work lived on the JavaScript call stack. Once an update started, it ran until the stack unwound. A large update blocked input and animation frames, and the work couldn't be paused, prioritized or abandoned. Fiber reimplements that stack as linked objects on the heap, "virtual stack frames" in Andrew Clark's 2016 design notes. React walks them with a loop, one fiber per step, so between steps it can check the clock, yield to the browser, come back later, start over with newer state, or drop the work.

**Two trees.** React keeps the *current* tree, which matches the screen, and builds a *work-in-progress* tree for the next render, reusing each fiber's `alternate` instead of allocating new objects. The commit makes the finished tree current by swapping one pointer. That double buffering is why an abandoned render leaves the screen untouched.

Fiber is the foundation, not the feature. React 16 shipped it with asynchronous rendering switched off; React 18's concurrent features were the first stable APIs to use the ability to pause.

## Example

```jsx
function Item({ label }) {
  return <li>{label}</li>;
}

function List() {
  const [n, setN] = useState(0);
  return (
    <ul onClick={() => setN(n + 1)}>
      <Item label={'a' + n} />
      <Item label="b" />
    </ul>
  );
}

// After mounting <List />. React keeps each DOM node's fiber under an internal key.
const li = document.querySelector('li');
const fiber = li[Object.keys(li).find((k) => k.startsWith('__reactFiber$'))];
console.log(fiber.type, fiber.return.type.name, fiber.return.return.type);
// → li Item ul
console.log(fiber.return.sibling.memoizedProps.label); // → b
console.log(fiber.memoizedProps.children, fiber.alternate); // → a0 null

// Click the list once, then:
console.log(fiber.memoizedProps.children, fiber.alternate.memoizedProps.children);
// → a0 a1
// Click again:
console.log(fiber.memoizedProps.children, fiber.alternate.memoizedProps.children);
// → a2 a1
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1. The first update built `a1` in a new object; the second reused the original object for `a2`. Two copies of each fiber alternate between current and work-in-progress. `__reactFiber$` is an internal key: fine in a debugging console, never in app code.

## Pitfalls

- Saying Fiber made React multithreaded. Rendering still runs on the main thread; Fiber only lets that thread stop between components and resume.
- Equating Fiber with concurrent rendering. Every React since 16 uses Fiber, but most updates still render without pausing; interruption needs a concurrent feature such as a transition.
- Expecting React to pause inside a component. The unit of work is a whole fiber: one component that computes for 100 ms under a transition was still one 100 ms long task in Chrome 156.
- Building on fiber internals. Field names change between versions; the 2016 design notes describe `pendingWorkPriority` and `output` fields that React 19.3.1 no longer has.

## Follow-ups

**Q:** Why links to child, sibling and parent instead of an array of children?
**A:** So the walk can stop and resume from a single pointer. The loop keeps the next fiber in `workInProgress`; `child`, `sibling` and `return` let it go down, across and back up without recursion or a separate stack.

**Q:** What replaced the priority field from the 2016 notes?
**A:** Lanes: each update gets one bit of a 31-bit mask (sync, continuous input, default, 14 transition lanes, retry, idle, offscreen and more). Fibers store pending lanes as masks, so one render can process several priorities together and tests are bitwise `&`.

**Q:** Did Fiber enable anything besides scheduling?
**A:** Yes. React 16's release notes credit it with error boundaries and fragments, and it's the base for Suspense and `<Activity>`. Keeping frames as objects lets React unwind to a boundary or keep a hidden subtree's fibers around.

## Deep dive

### How it works

The render phase is a loop over fibers. Simplified from `ReactFiberWorkLoop.js` in React 19.3.1:

```js
function workLoopConcurrentByScheduler() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber) {
  // Render this fiber against its current copy; returns its first child, or null.
  const next = beginWork(fiber.alternate, fiber, renderLanes);
  fiber.memoizedProps = fiber.pendingProps;
  if (next === null) completeUnitOfWork(fiber); // go to the sibling, or back up
  else workInProgress = next;
}
```

`workLoopSync` is the same loop without `shouldYield()`. Whether React picks it depends on the update's lanes; that's the concurrent rendering question.

- **`beginWork`** calls the component (or updates the class instance), reconciles the returned elements against the current children, and returns the first child fiber. If neither the fiber nor any descendant has work in this render's lanes (its `lanes` and `childLanes` are checked with a bitwise test), it skips the whole subtree.
- **`completeUnitOfWork`** runs when a fiber has no children left: it creates or prepares the DOM node off screen, merges its children's `flags` into `subtreeFlags`, then moves to `sibling`, or to `return` when there is none.

Because the state of the walk is one variable, `workInProgress`, yielding is just leaving the loop; resuming is entering it again.

**Double buffering.** `createWorkInProgress` (in `ReactFiber.js`) takes a current fiber and returns its `alternate`, creating it only the first time. Its comment explains the choice: React needs at most two versions of the tree, so it pools the unused one. During the commit, `root.current = finishedWork` swaps the trees after the mutation phase and before the layout phase, so `componentWillUnmount` still sees the old tree and `componentDidMount` the new one. An interrupted render simply resets the work-in-progress copies next time; nothing on screen pointed at them.

### Edge cases

- **Text-only children.** `<li>{label}</li>` has no child fiber for the string: in the test, `fiber.child` was `null`. React sets a lone string as the element's text directly.
- **The hook list lives on the fiber.** For a function component, `memoizedState` is the first hook, and each hook links to the next. A component calling `useState(7)` then `useRef('r')` had `memoizedState.memoizedState === 7` and `memoizedState.next.memoizedState.current === 'r'`. That list is matched by call order, which is why hooks can't be called conditionally.
- **Production keeps the structure.** The production fiber had 22 fields; development adds profiler timings and `_debug*` fields. The `__reactFiber$` key was present in both.

### Real-world scenario

A data table re-rendering 5,000 rows on every filter keystroke: under the stack reconciler, the input couldn't show the typed character until the whole table had rendered, and the only fixes were rendering less or debouncing. With Fiber the same render can be split: marked as a transition, the table renders in slices with the browser handling input between them, and a newer keystroke throws the half-built tree away. The reconciler change is invisible in the code; the new capability shows up only through the APIs that opt in.

### Trade-offs

Fiber spends memory and indirection to buy control: two objects per element instead of a stack frame, about two dozen fields each, and a loop that is harder to follow than recursion. In return React gets pausing, prioritization, error recovery and kept-alive subtrees. The cost to application code is a contract, not a performance tax: because a render may now be paused, repeated or discarded, components must be pure, which Strict Mode checks by rendering twice in development.
