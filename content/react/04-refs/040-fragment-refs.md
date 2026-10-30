---
title: "What can a Fragment ref do that a DOM ref can't?"
status: draft
difficulty: hard
frequency: 1
core: false
tags: [fragment-refs, fragment-instance, refs, event-listeners, observers]
related:
  - react/refs/ref-callbacks-and-ref-prop
  - react/refs/imperative-handle
  - react/context-and-composition/composition-patterns
  - browser/the-dom/dom-tree-and-node-types
  - browser/events/event-delegation
  - browser/observers/intersection-observer
  - browser/observers/resize-observer
verified: 2026-10
perishable:
  - "Fragment refs stable since React 19.3"
  - "FragmentInstance.scrollIntoView accepts only the alignToTop boolean"
sources:
  - https://react.dev/blog/2026/09/09/react-19-3#fragment-refs
  - https://react.dev/reference/react/Fragment#props
  - https://react.dev/reference/react/Fragment#fragmentinstance
  - https://react.dev/reference/react/Fragment#addeventlistener
  - https://react.dev/reference/react/Fragment#focus
  - https://react.dev/reference/react/Fragment#scrollintoview
  - https://react.dev/reference/react/Fragment#fragmentinstance-caveats
  - https://react.dev/reference/react/Fragment#which-children-does-a-fragment-ref-target
  - https://react.dev/reference/react/Fragment#caching-global-intersection-observer
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/shared/ReactFeatureFlags.js
  - https://dom.spec.whatwg.org/#dom-node-comparedocumentposition
tldr: >
  A DOM ref gives you one element. `<Fragment ref>`, stable since React 19.3, gives a
  `FragmentInstance` that acts on a group of siblings with no wrapper element, including nodes
  rendered by components that don't take `ref`. It adds listeners and observers to every
  first-level DOM child, follows children added later, and moves focus depth-first. It isn't a
  DOM node.
---

## Answer

A DOM ref needs one element to point at. Two cases make that awkward: a component that renders a list of siblings with no common parent, and a child component (often from a library) that doesn't pass `ref` on. A wrapper `<div>` can break flex, grid or table layout.

**Fragment refs** solve both. Pass a ref to an explicit `<Fragment ref={ref}>` (the `<>` shorthand takes no props). The React 19.3 post announced them as stable. React gives the ref a `FragmentInstance`, attached in the commit like any ref, which works on the Fragment's **first-level DOM children**: the nearest host nodes, found by looking through components.

Its methods mirror DOM ones, applied to the group:

- **Events:** `addEventListener` and `removeEventListener` act on every first-level child; `dispatchEvent` dispatches "on the Fragment" and can bubble to its DOM parent. Children rendered later get the stored listeners, and removed children lose them.
- **Focus:** `focus()` and `focusLast()` search nested descendants depth-first for something focusable; `blur()` only acts if focus is inside.
- **Observers:** `observeUsing` and `unobserveUsing` attach an `IntersectionObserver` or `ResizeObserver` to each child, again following later children.
- **Geometry and position:** `getClientRects()` (one flat array), `getRootNode()`, `compareDocumentPosition()`, and `scrollIntoView(alignToTop)`.

**What a DOM ref still does better.** A `FragmentInstance` is neither a `Node` nor an `EventTarget`. There's no `style`, `classList`, `querySelector` or `contains`, and you can't pass it where a node is expected. It exposes this fixed set of group operations only.

So the interview answer: a Fragment ref lets a parent attach behaviour (listeners, observers, focus, scrolling) to whatever DOM a subtree produces, without changing that DOM or the child components. Each first-level child also gets a `reactFragments` set naming the instances that own it, so one shared observer can route entries.

## Example

```jsx
function Card({ id }) {
  return <div id={id}><button id={`${id}-btn`}>Open {id}</button></div>; // takes no ref
}

function ClickGroup({ children }) {
  const fragmentRef = useRef(null);
  useEffect(() => {
    const group = fragmentRef.current;
    const onClick = (e) => console.log('clicked', e.currentTarget.id, 'from', e.target.id);
    group.addEventListener('click', onClick);
    return () => group.removeEventListener('click', onClick);
  }, []);
  return <Fragment ref={fragmentRef}>{children}</Fragment>;
}

const render = (ids) =>
  flushSync(() => root.render(<ClickGroup>{ids.map((id) => <Card key={id} id={id} />)}</ClickGroup>));

render(['a', 'b']);
document.getElementById('b-btn').click(); // → clicked b from b-btn
render(['a', 'b', 'c']);
document.getElementById('c-btn').click(); // → clicked c from c-btn
```

Development and production builds of React 19.3.1 in Chrome 156 and Firefox 159. The listener sits on each card's `<div>`, the first-level child, and catches the button's click by bubbling. Card `c` didn't exist when the effect ran, yet it got the listener; no wrapper element was added.

## Pitfalls

- Listening for an event that doesn't bubble from deeper nodes. Listeners sit on first-level children only, so `focus` on a nested `<input>` never reached them in the test; `focusin` did.
- Passing an options object to `scrollIntoView`. React 19.3.1 throws "FragmentInstance.scrollIntoView() does not support scrollIntoViewOptions"; pass `true` or `false`.
- Treating the instance as a node: `instance instanceof Node` is `false`, and DOM APIs that take a node won't accept it.
- Calling `observeUsing` on a Fragment that holds only text. Observers can't watch text nodes; development builds log an error saying so.

## Follow-ups

**Q:** Which nodes count as children?
**A:** The first host nodes under the Fragment, looking through components. With `<A />`, a component rendering `<div id="B"><button id="C" /></div>`, and `<D />`, the targets are A, B and D. In 19.3.1 `getClientRects()` also included a rectangle for a bare text child.

**Q:** What does `compareDocumentPosition` return for an empty Fragment?
**A:** The usual flags plus `DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC` (32). An empty Fragment before a `<span>` returned `36`: following (4) plus 32. A Fragment with children returned `2` for a node before it and `4` for one after.

**Q:** How does `dispatchEvent` fire "on the Fragment" without a node?
**A:** In React 19.3.1's source it temporarily appends an empty text node to the parent, adds the Fragment's listeners to it, dispatches there, then removes it. That's an implementation detail; the documented behaviour is that the Fragment's listeners run and the event may bubble to the parent.

**Q:** Does `{ once: true }` fire once per child?
**A:** No. In 19.3.1 the first event on any child removed the listener from the whole group; clicking two buttons in turn called it once.
