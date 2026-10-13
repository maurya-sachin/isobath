---
title: "Which effects shouldn't be effects?"
status: draft
difficulty: medium
frequency: 4
core: true
tags: [use-effect, derived-state, event-handlers, key, set-state-in-effect]
related:
  - react/state/structuring-state
  - react/state/batching-and-updater-functions
  - react/rendering-model/when-components-rerender
  - react/reconciliation/preserving-and-resetting-state
  - react/performance/memoization
  - react/effects/effect-timing
  - react/effects/effect-cleanup
  - react/suspense/use-api
verified: 2026-10
perishable:
  - "eslint-plugin-react-hooks 7.1.1 enables set-state-in-effect in recommended"
sources:
  - https://react.dev/learn/you-might-not-need-an-effect#how-to-remove-unnecessary-effects
  - https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state
  - https://react.dev/learn/you-might-not-need-an-effect#caching-expensive-calculations
  - https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
  - https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  - https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers
  - https://react.dev/learn/you-might-not-need-an-effect#sending-a-post-request
  - https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations
  - https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
  - https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes
  - https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent
  - https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store
  - https://react.dev/learn/you-might-not-need-an-effect#fetching-data
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect
tldr: >
  Any effect that doesn't synchronize with something outside React. Compute values from props and
  state during render; put logic caused by an interaction in its handler; reset state with a `key`;
  update related state together instead of chaining effects; notify parents from the handler. Each
  such effect costs an extra render, often after a stale commit.
---

## Answer

Effects are for **synchronizing with an external system**: the network, a browser API, a non-React widget. When an effect only reads React state and sets other React state, it's usually in the wrong place.

The common cases:

- **Derived values.** A filtered list or a full name computed in an effect and stored in state renders once with the stale value, commits, then renders again. Compute it during render; wrap an expensive calculation in `useMemo`.
- **Resetting state when a prop changes.** Instead of `useEffect(() => setComment(''), [userId])`, render the component with `key={userId}` so React gives it fresh state. To adjust only part of the state, store an id and derive the rest.
- **Event-specific logic.** A POST on submit, a toast after "Buy": they happen because of a click, so they belong in that handler. In an effect they also fire on remount, and twice in development.
- **Chains of effects.** Effects that set state to trigger other effects re-render the tree once per link. Compute all the next state in the handler, and derive what you can.
- **Notifying a parent.** Calling `onChange` from an effect runs after the child already committed, so the parent renders in a second pass. Call it in the same handler as the child's own `setState`; React batches both. Or lift the state up.
- **Initialization once per app load**: module level, not an effect.
- **Subscribing to an external store**: `useSyncExternalStore`, rather than an effect that copies values into state.

Data fetching *is* synchronization, so it can be an effect, with cleanup for races. Frameworks and caching libraries, or `use` with a cached promise, do it better.

In eslint-plugin-react-hooks 7, the recommended `react-hooks/set-state-in-effect` rule flags the most common form: a setter called synchronously in an effect body.

## Example

```jsx
function TodosWithEffect({ todos }) {
  const [open, setOpen] = useState([]);
  useEffect(() => {
    setOpen(todos.filter((todo) => !todo.done)); // second render, after commit
  }, [todos]);
  console.log('with effect:', open.length, 'open');
  return <p>{open.length} open</p>;
}

function TodosDerived({ todos }) {
  const open = todos.filter((todo) => !todo.done); // computed in the same render
  console.log('derived:', open.length, 'open');
  return <p>{open.length} open</p>;
}

const todos = [{ done: false }, { done: true }, { done: false }];
createRoot(document.getElementById('root')).render(
  <><TodosWithEffect todos={todos} /><TodosDerived todos={todos} /></>,
);
// → with effect: 0 open
// → derived: 2 open
// → with effect: 2 open
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The effect version committed "0 open" to the DOM first, then rendered again.

## Pitfalls

- Copying a prop into state with an effect "to keep it in sync". It's always one render behind; read the prop.
- Sending a request from an effect that watches a `submitted` flag. Strict Mode sends it twice in development, and a remount re-sends it.
- Resetting state with an effect when a `key` would do: the subtree renders with stale state first, and nested state isn't reset.
- Fixing a chain of effects by adding flags. Remove the chain; compute the next state in the handler.

## Follow-ups

**Q:** When is `setState` in an effect fine?
**A:** When the value comes from outside React: a DOM measurement in a layout effect, a subscription callback, a fetch response. The `set-state-in-effect` docs accept a value read from a ref; only synchronous calls in the effect body are flagged.

**Q:** How do you tell an event from an effect?
**A:** Say why the code should run. "The user clicked Buy" names an interaction: handler. "The chat is visible, so stay connected" names a state of the screen: effect. A notification shown after connecting is an event fired from an effect: an Effect Event.

**Q:** Isn't computing during render slower than caching it in state?
**A:** Usually not: the effect version computes it too, then renders twice. If the calculation itself is expensive, `useMemo` caches it between renders without an extra pass.

## Deep dive

### How it works

An effect that sets state starts a second render after the first one committed:

1. Render with the stale value; commit it to the DOM.
2. Run the effect; `setState` schedules another update.
3. Render the component and its whole subtree again; commit again.

After a timer or initial render, step 2 runs in a later task, so the browser can paint the stale commit; after a click, React flushes it before paint, so the cost is "only" the extra render and commit.

The parent case shows it with a real click:

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);
  console.log('render Toggle', isOn);
  useEffect(() => { onChange(isOn); }, [isOn, onChange]); // notify from an effect
  return <button onClick={() => setIsOn(!isOn)}>toggle</button>;
}
// Parent: const [saved, setSaved] = useState(false); <Toggle onChange={setSaved} />
// After a click:
// → render Toggle true
// → render Settings true
// → render Toggle true
```

Calling `onChange(!isOn)` in the click handler next to `setIsOn` gave `render Settings true`, `render Toggle true`: one pass, because React batched both updates. Chrome 156 and Firefox 159, development and production builds, trusted clicks.

### Edge cases

- **Adjusting state during render.** When part of the state must change with a prop, the docs allow storing the previous prop and calling the setter during render: `if (items !== prevItems) { setPrevItems(items); setSelection(null); }`. React re-renders that component immediately, before its children or the DOM see the stale value. Prefer deriving, though: store `selectedId` and compute the selection.
- **Resetting with `key`.** A changed key remounts the subtree: state, DOM and effects start over. That's a feature for "different entity" and a cost for large trees.
- **Effects that must run once per app.** Module-level code runs once per page load, and so does a top-level `didInit` flag checked in an effect. Both are outside the component's lifecycle on purpose.

### Real-world scenario

A product page shows a toast "Added to cart" from an effect that watches `product.isInCart`. Reloading the page with the item already in the cart shows the toast again; so does navigating back. The toast belongs in the "Add to cart" handler, since the click is its cause. A "page viewed" analytics call on the same page stays an effect: it's caused by the page being displayed.

### Trade-offs

Removing these effects gives one render per update, data that can't drift out of sync, and code that reads top to bottom. The cost is restructuring: lifting state up, splitting a component to put a `key` on it, writing handlers that compute several values at once. Real synchronization, such as subscriptions, connections and widgets, still needs effects.
