---
title: "How does reconciliation decide what to update in the DOM?"
status: draft
difficulty: hard
frequency: 5
core: true
tags: [reconciliation, diffing, virtual-dom, element-type, unmount]
related:
  - react/rendering-model/jsx-and-elements
  - react/rendering-model/render-and-commit
  - react/rendering-model/when-components-rerender
  - react/reconciliation/list-keys
  - react/reconciliation/preserving-and-resetting-state
  - react/effects/effect-cleanup
  - react/performance/memoization
  - react/concurrent-rendering/fiber
  - browser/the-dom/inserting-and-moving-nodes
verified: 2026-10
sources:
  - https://legacy.reactjs.org/docs/reconciliation.html#motivation
  - https://legacy.reactjs.org/docs/reconciliation.html#elements-of-different-types
  - https://legacy.reactjs.org/docs/reconciliation.html#dom-elements-of-the-same-type
  - https://legacy.reactjs.org/docs/reconciliation.html#component-elements-of-the-same-type
  - https://legacy.reactjs.org/docs/reconciliation.html#tradeoffs
  - https://legacy.reactjs.org/docs/faq-internals.html#what-is-the-virtual-dom
  - https://react.dev/learn/render-and-commit#step-3-react-commits-changes-to-the-dom
  - https://react.dev/learn/preserving-and-resetting-state#different-components-at-the-same-position-reset-state
  - https://react.dev/reference/react/Fragment#caveats
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactChildFiber.js
tldr: >
  React compares the new elements with the previous render's tree, position by position. A
  different type at a position (`div` → `section`, `Article` → `Comment`) tears the old subtree
  down: effects cleaned up, DOM removed, state lost. The same type keeps the DOM node or component
  instance and updates only what changed. Keys identify children that moved.
---

## Answer

**Reconciliation** compares a render's new elements with the tree React committed last time to find the DOM changes. An exact minimal tree diff costs O(n³); the older React docs note that 1,000 elements would need about a billion comparisons. React instead runs an **O(n) heuristic** built on two assumptions:

1. **Elements of different types produce different trees.**
2. **Keys mark which children stay the same** between renders.

It compares the element at each position:

- **Different type** (`<div>` → `<section>`, `<Article>` → `<Comment>`): React doesn't look inside. It unmounts the whole old subtree (effect cleanups run, DOM nodes are removed, state is gone) and mounts the new one from scratch.
- **Same DOM type**: React keeps the DOM node, updates only the changed attributes (only the changed `style` properties too), then recurses into the children.
- **Same component type**: the instance and its state stay; React renders it with the new props and recurses into its output.
- **Lists of children** are matched by position, or by `key` when there is one.

"Type" is compared by reference: the string `'div'`, or the component function itself. A wrapper like `memo(Field)` is a different type from `Field`.

The commit applies only those changes, so an `<input>` keeps its text when its parent re-renders.

**The "virtual DOM".** The older docs use the term for the in-memory description (elements, plus fibers) that React keeps and syncs with the real DOM. That it makes React *faster than the DOM* is a myth: the diff is extra work on top of the DOM calls you'd write by hand. What it buys is the declarative model: you describe the whole UI for each state, and React turns that into targeted DOM updates, fast enough for most UIs. The current docs simply call this render and commit.

## Example

```jsx
function Field({ label }) {
  useEffect(() => {
    console.log('mount', label);
    return () => console.log('cleanup', label);
  }, []);
  return <input aria-label={label} />;
}

function App() {
  const [step, setStep] = useState(0);
  const field = <Field label={`step ${step}`} />;
  return (
    <>
      <button onClick={() => setStep(step + 1)}>next</button>
      {step < 2
        ? <div className={`step-${step}`}>{field}</div>
        : <section>{field}</section>}
    </>
  );
}
// Mount → mount step 0
// Type "abc", click next → no logs; same <input> node, still "abc"
// Click next → cleanup step 0, mount step 2; a new, empty <input>
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, trusted typing and clicks. The first click only changed attributes (`class`, `aria-label`). The second swapped `<div>` for `<section>`, so `Field` lost its DOM and its effect even though its own type never changed.

## Pitfalls

- Conditionally wrapping a component: `{hint ? <Tooltip><Field /></Tooltip> : <Field />}`. The slot's type flips between `Tooltip` and `Field`, so `Field` remounts and loses its input every time.
- Expecting React to notice a subtree that moved to a different parent. Keys match only among siblings; anywhere else it's an unmount plus a mount.
- Saying the virtual DOM is faster than direct DOM updates. It's overhead that buys a declarative model; React's speed comes from touching only changed nodes and from skipping renders.
- Defining a component inside another component: each render creates a new function, so a new type, so a remount.

## Follow-ups

**Q:** Is reconciliation the same as re-rendering?
**A:** No. Rendering calls components to get elements; reconciliation compares those with the previous tree during the render phase; the commit applies the result. A component can re-render and reconcile to zero DOM changes.

**Q:** Does wrapping a child in a Fragment reset it?
**A:** Not one level deep: `<Child />` → `<><Child /></>` kept state in React 19.3.1. Two levels, `<><><Child /></></>`, remounted it, as the Fragment docs' caveat says.

**Q:** Is the heuristic ever wrong?
**A:** It's never incorrect, only sometimes wasteful. Two component types with nearly identical output are rebuilt rather than patched, and a moved subtree is recreated. The legacy docs suggest using one type if you alternate between similar ones.

## Deep dive

### How it works

In React 19.3.1, reconciliation happens per fiber while rendering (implementation details from `ReactChildFiber.js`). When a component returns a single element, `reconcileSingleElement` looks for an old child with the same `key` (both `null` when unkeyed), then checks `child.elementType === element.type`. A match reuses the fiber with new props; a mismatch marks the old fiber and everything below it for deletion and creates a new one. Arrays go through `reconcileChildrenArray`, which walks old and new children in step until a key differs, then falls back to a map of the remaining old children by key (or by index when unkeyed).

The render phase only records flags (placement, update, deletion). The commit performs them, which a `MutationObserver` makes visible:

```jsx
const container = document.getElementById('root');
const root = createRoot(container);
const observer = new MutationObserver(() => {});
observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });
const describe = (r) =>
  r.type === 'attributes' ? `set ${r.attributeName}`
  : r.type === 'characterData' ? 'set text'
  : r.addedNodes.length ? `insert ${r.addedNodes[0].nodeName}` : `remove ${r.removedNodes[0].nodeName}`;

function render(element) {
  flushSync(() => root.render(element));
  console.log(observer.takeRecords().map(describe).join(', '));
}

render(<div className="a"><b>{'hi'}</b></div>);  // → insert DIV
render(<div className="b"><b>{'hi'}</b></div>);  // → set class
render(<div className="b"><b>{'bye'}</b></div>); // → set text
render(<section className="b"><b>{'bye'}</b></section>); // → remove DIV, insert SECTION
```

Chrome 156 and Firefox 159, development and production builds. The `<b>` and its text in the last step were identical, but they sat under a new type, so they were rebuilt too.

### Edge cases

- **`memo` and `forwardRef`** return new types. Switching a slot between `Field` and `memo(Field)`, or between a plain component and a `forwardRef` one, remounted it.
- **Fragments.** Going between `<Child />`, `<><Child /></>` and `[<Child />]` keeps state; a second Fragment level resets it.
- **Same tag, different attributes.** `<input type="text">` → `<input type="number">` is the same type; React updated `type` on the existing node.
- **Hot reloading.** Development builds also accept a hot-reloaded version of the same component as a match (`isCompatibleFamilyForHotReloading` in the source), so state can survive an edit.
- **`null` and `false` hold positions.** `{a && <X />}<Y />` keeps `Y` in the second slot whether or not `X` renders.

### Real-world scenario

A page renders `isMobile ? <MobileLayout>{form}</MobileLayout> : <DesktopLayout>{form}</DesktopLayout>`. Rotating a tablet flips `isMobile`, and the half-filled form empties: different layout types at the same position, so the form below them was unmounted. Fixes, best first: one layout component that changes with CSS or props; lift the form's state above the switch; or render the form outside the layout-specific wrapper.

### Trade-offs

React's heuristic keeps reconciliation linear, at the price of rare rebuilds where a cleverer diff would patch. The bigger trade-off is the model itself. Re-running components and diffing their output is work that a library compiling templates to direct DOM updates avoids; in exchange, React components are plain functions of state, and the diff makes that affordable. When the diff itself is too slow, the fixes are rendering less (`memo`, the React Compiler, moving state down) rather than avoiding React's DOM updates.
