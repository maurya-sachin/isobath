---
title: "How do ref callbacks work, and what changed with `ref` as a prop?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [ref-callback, ref-cleanup, ref-as-a-prop, forward-ref, refs]
related:
  - react/refs/refs-vs-state
  - react/refs/imperative-handle
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/jsx-and-elements
  - react/effects/layout-effects
  - react/reconciliation/list-keys
  - browser/observers/resize-observer
verified: 2026-10
perishable:
  - "Calling ref callbacks with null on detach is slated for removal"
  - "forwardRef works without a warning in React 19.3.1; deprecation planned"
sources:
  - https://react.dev/reference/react-dom/components/common#ref-callback
  - https://react.dev/reference/react-dom/components/common#react-19-added-cleanup-functions-for-ref-callbacks
  - https://react.dev/learn/manipulating-the-dom-with-refs#when-react-attaches-the-refs
  - https://react.dev/learn/manipulating-the-dom-with-refs#how-to-manage-a-list-of-refs-using-a-ref-callback
  - https://react.dev/learn/manipulating-the-dom-with-refs#accessing-another-components-dom-nodes
  - https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
  - https://react.dev/blog/2024/12/05/react-19#cleanup-functions-for-refs
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#ref-cleanup-required
  - https://react.dev/reference/react/forwardRef
  - https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-ref-callbacks-in-development
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberCommitEffects.js
tldr: >
  A ref callback is a function passed as `ref`; React calls it with the DOM node in the commit,
  before layout effects. In React 19 it may return a cleanup, called on detach instead of passing
  `null`. A new function each render reattaches on every commit. Function components now take
  `ref` as a plain prop; `forwardRef` isn't needed.
---

## Answer

**Ref callbacks.** Instead of a ref object you can pass a function: `<input ref={(node) => …} />`. React calls it during the commit, after the node is in the DOM and before layout effects run. Use it to act when a node appears: store it, observe it, measure it.

On detach (node removed, or callback changed):

- If the callback returned a function (React 19+), React calls that cleanup.
- Otherwise React calls the callback again with `null`. The docs say this fallback "will be removed in a future version".

**Identity matters.** React compares the `ref` value between renders. An inline arrow is a new function every render, so every commit detaches the old one and attaches the new one, even for the same node. Returning a cleanup doesn't prevent that; it only replaces the `null` call. A stable function (defined outside the component, or wrapped in `useCallback`) runs only on mount and unmount.

**Refs to lists.** Hooks can't run per item, so give each item a callback that stores its node in a `Map` keyed by id and deletes it in the cleanup.

**`ref` as a prop (React 19).** A function component receives `ref` in its props like any other prop and passes it to the element it wants to expose: `function MyInput({ ref }) { return <input ref={ref} />; }`. The React 19 post says new components "will no longer need `forwardRef`" and "In future versions we will deprecate and remove `forwardRef`." It still works in 19.3.1, without a warning. A component that ignores `ref` leaves the parent's ref at `null`.

Class components are unchanged: `ref` points to the instance and isn't in `this.props`.

Strict Mode runs one extra setup and cleanup on mount in development. In TypeScript, implicit returns from ref callbacks are now type errors.

## Example

```jsx
function Field({ n }) {
  return (
    <>
      <input ref={(node) => console.log('plain', n, node?.nodeName ?? null)} />
      <input
        ref={(node) => {
          console.log('attach', n, node.nodeName);
          return () => console.log('cleanup', n);
        }}
      />
    </>
  );
}

flushSync(() => root.render(<Field n={1} />));
// → plain 1 INPUT
// → attach 1 INPUT
flushSync(() => root.render(<Field n={2} />));
// → plain 1 null
// → cleanup 1
// → plain 2 INPUT
// → attach 2 INPUT
flushSync(() => root.render(null));
// → plain 2 null
// → cleanup 2
```

Production build of React 19.3.1, and development without Strict Mode, in Chrome 156 and Firefox 159. Every detach in a commit ran before any attach: React detaches while it mutates the DOM and attaches afterwards. With a module-level callback the update line logged nothing.

## Pitfalls

- An inline callback with side effects, such as `ref={(node) => node?.focus()}`. It runs on every re-render: in the test, focus jumped back to that input after the user had moved to another one.
- Keeping `if (node === null)` teardown code and also returning a cleanup. Once a function is returned, React never calls the callback with `null`.
- Expecting `<MyInput ref={ref} />` to reach the inner `<input>` automatically. The component must pass `ref` on; otherwise `ref.current` stays `null`.
- Reading `this.props.ref` in a class component or `element.ref` on an element. The first is `undefined`; the second warns in development, since `ref` lives in `element.props`.

## Follow-ups

**Q:** Why use a ref callback instead of a ref object plus `useEffect`?
**A:** The callback runs exactly when that node attaches and detaches, including a conditionally rendered child the effect knows nothing about. An effect runs when its dependencies change, which may be before the node exists or long after it was replaced.

**Q:** Is a ref object detached and reattached on every render?
**A:** No. `useRef` returns the same object each render, so React sees no change and leaves it alone. Only a different `ref` value, such as a new callback, triggers detach and attach.

**Q:** What happens when a ref callback returns something that isn't a function?
**A:** In React 19.3.1 it's ignored as a cleanup, and React falls back to calling the callback with `null` on detach. TypeScript's React 19 types reject the return, which catches accidental implicit returns like `ref={(el) => (saved = el)}`.

## Exercises

### Refs by index

```jsx
function List({ items }) {
  const nodesByIndex = useRef([]);
  return (
    <ul>
      {items.map((item, i) => (
        <li key={item} ref={(node) => { nodesByIndex.current[i] = node; }}>{item}</li>
      ))}
    </ul>
  );
}
// render ['a', 'b', 'c'], then ['c', 'a', 'b'], then ['c', 'b']
```

**Answer:** After the reorder the array is correct (`c a b`), but only because every inline callback re-ran. After removing `a` it holds `c`, `b`, `null` with length 3: all three old callbacks were called with `null`, then only two new ones wrote. A `Map` keyed by `item`, with `map.set(item, node)` and a cleanup that calls `map.delete(item)`, held exactly `c` and `b`.
