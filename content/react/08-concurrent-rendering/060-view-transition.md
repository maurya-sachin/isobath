---
title: "How does `<ViewTransition>` animate React updates?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [view-transition, add-transition-type, animation, transitions, suspense, shared-element]
related:
  - browser/navigation/view-transitions
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/deferred-value
  - react/concurrent-rendering/interruptible-rendering
  - react/reconciliation/activity
  - react/reconciliation/list-keys
  - react/suspense/suspense-mechanics
  - react/suspense/suspense-and-transitions
  - react/effects/effect-timing
verified: 2026-10
perishable:
  - "`<ViewTransition>` and `addTransitionType` stable since React 19.3"
  - "Needs startViewTransition({ update, types }): Chrome 125, Firefox 147, Safari 18.2"
sources:
  - https://react.dev/reference/react/ViewTransition#viewtransition
  - https://react.dev/reference/react/ViewTransition#how-does-viewtransition-work
  - https://react.dev/reference/react/ViewTransition#props
  - https://react.dev/reference/react/ViewTransition#caveats
  - https://react.dev/reference/react/ViewTransition#animation-triggers
  - https://react.dev/reference/react/ViewTransition#view-transition-event-arguments
  - https://react.dev/reference/react/ViewTransition#always-check-prefers-reduced-motion
  - https://react.dev/reference/react/ViewTransition#animating-enter-exit-with-activity
  - https://react.dev/reference/react/ViewTransition#view-transition-values
  - https://react.dev/reference/react/ViewTransition#only-top-level-viewtransition-animates-on-exit-enter
  - https://react.dev/reference/react/ViewTransition#animating-a-shared-element
  - https://react.dev/reference/react/ViewTransition#animating-from-suspense-content
  - https://react.dev/reference/react/ViewTransition#customizing-animations-with-types
  - https://react.dev/reference/react/ViewTransition#two-viewtransition-with-same-name
  - https://react.dev/reference/react/addTransitionType#caveats
  - https://react.dev/blog/2026/09/09/react-19-3#view-transition
  - https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more#view-transitions
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
  - https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition#browser_compatibility
tldr: >
  When a Transition, a `useDeferredValue` update or a Suspense reveal changes what a `<ViewTransition>`
  wraps, React calls `document.startViewTransition()` itself and commits inside it, so the browser
  animates old to new. Boundaries animate on enter, exit, update or share (matching `name`). Urgent
  updates don't animate; classes and `addTransitionType` customize.
---

## Answer

`<ViewTransition>` (stable since React 19.3) marks part of the tree that React should animate with the browser's View Transitions API. React decides *when* and *which elements*; the browser captures and animates them.

**Which updates animate.** Only non-urgent ones: state updates inside `startTransition`, updates from `useDeferredValue`, and Suspense boundaries revealing their content. A plain `setState` from a click commits immediately with no animation, because urgent updates should show at once. When a qualifying commit touches a boundary, React calls `document.startViewTransition()` and applies the DOM mutations inside its update callback.

**How a boundary activates**, per Transition:

- **enter**: the boundary is inserted. It must come before any DOM node in the inserted subtree; one nested inside a new `<div>` doesn't count.
- **exit**: the boundary is removed, with the same rule.
- **update**: React mutates DOM inside it, or it moves or resizes because of a sibling. A nested boundary takes the update instead of its parent.
- **share**: a boundary with a `name` is removed and another with the same `name` inserted in the same Transition; the browser morphs one into the other.

**Names.** React puts `view-transition-name` inline on the boundary's nearest DOM nodes only while the transition is being set up, generating unique names, then removes them. Give `name` only for shared elements, and keep it unique among mounted boundaries.

**Styling.** Each trigger prop (`enter`, `exit`, `update`, `share`, `default`) takes `"auto"`, `"none"` or a class name, which React sets as `view-transition-class`, so CSS can target `::view-transition-new(.slide-in)`. A prop can also be an object keyed by Transition type: call `addTransitionType('navigation-back')` inside `startTransition` to record the cause, and React picks the matching class and passes the types to the browser. Event props (`onEnter`, `onExit`, `onUpdate`, `onShare`) hand you the pseudo-elements for Web Animations instead.

Without browser support, React commits normally, without animating.

## Example

```jsx
const start = document.startViewTransition; // spy on what React asks the browser for
document.startViewTransition = function (options) {
  console.log('startViewTransition', JSON.stringify([...options.types]));
  const transition = start.call(this, options);
  transition.ready.then(() => document.getAnimations()
    .filter((a) => a.animationName?.startsWith('slide'))
    .forEach((a) => console.log(a.effect.pseudoElement, a.animationName)));
  return transition;
};

function App() {
  const [show, setShow] = useState(false);
  const toggle = () => startTransition(() => { addTransitionType('toggle'); setShow(!show); });
  return (
    <>
      <button onClick={() => setShow(!show)}>Plain</button>
      <button onClick={toggle}>Transition</button>
      {show && (
        <ViewTransition enter="slide-in" exit="slide-out">
          <p>Item</p>
        </ViewTransition>
      )}
    </>
  );
}
// Click Plain twice: nothing logged. Then click Transition twice:
// → startViewTransition ["toggle"]
// → ::view-transition-new(_t_0_) slide-from-right
// → startViewTransition ["toggle"]
// → ::view-transition-old(_t_0_) slide-to-right
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1. The CSS was `::view-transition-new(.slide-in) { animation: 300ms slide-from-right; }` and the matching `.slide-out` rule on `::view-transition-old`. `_t_0_` is a name React generated; don't depend on it.

## Pitfalls

- Expecting a plain `setState` to animate. Only Transitions, deferred values and Suspense reveals do; the Plain clicks never reached `startViewTransition`.
- Putting the boundary inside the element being inserted. With `<div><ViewTransition>…` mounted in a Transition, React didn't call `startViewTransition` at all.
- Starting your own view transitions alongside React's. The docs say React interrupts any other running view transition; let React coordinate them.
- Reusing a `name`. Two mounted boundaries with the same `name` is an error; names exist only to pair an exit with an enter.

## Follow-ups

**Q:** What happens in a browser without the API?
**A:** React calls `startViewTransition({ update, types })` in a `try` and treats a throw as no support, committing without animation. That needs the options form: Chrome 125, Firefox 147, Safari 18.2. With the method deleted before React loaded, toggles committed normally, without errors.

**Q:** What if another update arrives during an animation?
**A:** The docs say React waits for the running transition, then batches everything that arrived into one: going A→B, then C and D, animates B→D next.

**Q:** When do effects run?
**A:** Per the docs, layout effects and refs run inside the update callback, before React measures layout; `useEffect` waits until the animation's `finished` promise, unless another update needs it sooner.

**Q:** Does it work with `<Activity>`?
**A:** Yes. A boundary inside an `<Activity>` gets `enter` when it becomes visible and `exit` when hidden, while its state is kept.

## Deep dive

### How it works

The docs describe the commit as: call `getSnapshotBeforeUpdate`, set the names that may participate, call `startViewTransition`, and inside the update callback apply mutations, wait for fonts, run layout effects, wait for a pending navigation, then measure which boundaries moved. After `ready`, React removes the names and calls the event props. A `flushSync` arriving in the middle makes React skip the animation.

Spying on `document.startViewTransition` in Chrome 156 and Firefox 159 showed the bookkeeping:

- React always passed an options object, `{ update, types }`, with types from `addTransitionType` (or none).
- Inserting an item above a named `<ViewTransition name="photo">` also gave `photo` its name, because the sibling moved it: an *update*.
- Swapping `<ViewTransition name="photo"><h2>` for `<ViewTransition name="photo"><h1>` in one Transition produced a single `::view-transition-group(photo)`, the shared-element morph.
- A `useDeferredValue` update and a Suspense reveal each made one call. Showing the Suspense fallback from a plain update made none.

### Edge cases

- **Transition types are per commit.** The `addTransitionType` docs say types reset after each commit, so a fallback shown during a Transition gets its types but the later reveal doesn't.
- **Waiting.** Like any Transition, React waits for data and new stylesheets; `<ViewTransition>` also waits up to 500 ms for fonts and visible images.
- **Reduced motion.** The docs recommend checking `prefers-reduced-motion` in your animation CSS; React doesn't do it for you.
