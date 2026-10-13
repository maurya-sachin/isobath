---
title: "How does `<Activity>` hide UI without losing its state?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [activity, hidden, offscreen, pre-rendering, effects, state]
related:
  - react/reconciliation/preserving-and-resetting-state
  - react/effects/effect-cleanup
  - react/concurrent-rendering/interruptible-rendering
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/view-transition
  - react/suspense/suspense-mechanics
  - react/server-rendering/ssr-and-hydration
  - html-and-css/box-model-and-formatting/display-outer-and-inner
verified: 2026-10
perishable:
  - "Activity supports only visible and hidden modes (React 19.2)"
  - "React 19.3.1 hides with display: none !important"
sources:
  - https://react.dev/reference/react/Activity#activity
  - https://react.dev/reference/react/Activity#props
  - https://react.dev/reference/react/Activity#caveats
  - https://react.dev/reference/react/Activity#restoring-the-state-of-hidden-components
  - https://react.dev/reference/react/Activity#restoring-the-dom-of-hidden-components
  - https://react.dev/reference/react/Activity#pre-rendering-content-thats-likely-to-become-visible
  - https://react.dev/reference/react/Activity#my-hidden-components-have-unwanted-side-effects
  - https://react.dev/reference/react/Activity#my-hidden-components-have-effects-that-arent-running
  - https://react.dev/blog/2025/10/01/react-19-2#activity
  - https://react.dev/learn/preserving-and-resetting-state#preserving-state-for-removed-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberCommitHostEffects.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
tldr: >
  `<Activity mode="hidden">` keeps its subtree mounted in React's tree, so state and DOM survive,
  but hides the children's DOM with `display: none` and cleans up their effects as if they had
  unmounted. Updates to hidden content render later, at low priority. Switching back to `visible`
  shows the same DOM and re-creates the effects.
---

## Answer

`<Activity mode={isOpen ? 'visible' : 'hidden'}>` is an alternative to `{isOpen && <Sidebar />}`. Stable since React 19.2, it has two modes:

- **`hidden`**: React keeps the subtree's fibers, so **state is preserved**, and keeps the DOM nodes, so typed text, scroll position and a `<video>`'s timecode survive. It hides the top-level DOM nodes with `display: none` (React 19.3.1 sets it as `!important` inline) and **cleans up the children's effects**, layout effects included, as if they had unmounted. Hidden children still re-render when their props change, but **at a lower priority**, after the visible content has committed.
- **`visible`** (the default): the nodes are shown again, with their previous state, and the effects are re-created.

Compare the alternatives:

- **Conditional rendering** unmounts: state and DOM are gone and come back from scratch.
- **CSS-only hiding** (`hidden`, `display: none` on a wrapper) keeps everything mounted, including effects, so subscriptions, timers and connections keep running in invisible UI, and every update renders it at full priority.

Activity sits between them: preserved like CSS hiding, quiet like unmounting.

**Pre-rendering.** A boundary that's `hidden` on its first render still renders its children, after the visible content and without running their effects. That lets a likely-next tab load its code and Suspense-based data in advance; data fetched in an effect isn't, since the effect doesn't run.

Because hidden DOM isn't destroyed, its side effects can continue. A hidden `<video>` keeps playing; pause it in an effect cleanup, preferably `useLayoutEffect` since the cleanup is tied to the UI being hidden. Effects with proper cleanup, the same ones that survive Strict Mode, already work under Activity.

## Example

```jsx
function Panel({ name }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(name, 'effect setup');
    return () => console.log(name, 'effect cleanup');
  }, [name]);
  return <button onClick={() => setCount(count + 1)}>{name}: {count}</button>;
}

function App() {
  const [show, setShow] = useState(true);
  return (
    <>
      <input type="checkbox" checked={show} onChange={() => setShow(!show)} />
      <Activity mode={show ? 'visible' : 'hidden'}>
        <Panel name="activity" />
      </Activity>
      {show && <Panel name="conditional" />}
    </>
  );
}
// Click both buttons twice, then untick:
// → conditional effect cleanup
// → activity effect cleanup
// Tick again:
// → activity effect setup
// → conditional effect setup
// Buttons now read "activity: 2" and "conditional: 0"
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, trusted clicks. While hidden, the DOM still held `<button style="display: none !important;">activity: 2</button>`; the conditional button was gone.

## Pitfalls

- Expecting hidden effects to keep running. A chat connection or polling interval inside a hidden Activity is disconnected; keep work that must continue above the boundary.
- Forgetting DOM side effects. Media keeps playing and iframes stay loaded while hidden; clean them up in an effect.
- Rendering text alone in a hidden boundary. There's no element to put `display: none` on, so React renders nothing: `<Activity mode="hidden">` around a component returning `'just text'` left no text in the DOM.
- Wrapping every hidden screen in Activity. Each keeps its whole DOM and state in memory and still re-renders on prop changes, just later; unmount what the user isn't likely to return to.

## Follow-ups

**Q:** Which effects does hiding clean up?
**A:** All of them. In the test, hiding ran the layout effect cleanup during the commit and the `useEffect` cleanup after it; showing re-ran both setups. State, refs and DOM nodes were kept.

**Q:** What happens on the first render with `mode="hidden"`?
**A:** The children render after the visible part commits, their DOM is inserted already hidden, and no effects run. In the test, `render hidden 0` came after the visible effects.

**Q:** Why prefer it over lifting state up?
**A:** Lifting up keeps data but not DOM: scroll position, uncontrolled inputs, media playback and focus are lost on remount. Activity keeps both, at the cost of memory.

## Exercises

### In what order?

```jsx
function Label({ name, count }) {
  console.log('render', name, count);
  return <p>{name}: {count}</p>;
}

function App() {
  const [count, setCount] = useState(0);
  useLayoutEffect(() => console.log('commit', count));
  return (
    <>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <Label name="shown" count={count} />
      <Activity mode="hidden">
        <Label name="hidden" count={count} />
      </Activity>
    </>
  );
}
// Click +1.
```

**Answer:** `render shown 1`, `commit 1`, `render hidden 1`. The click's update renders and commits the visible tree first; the hidden subtree is rendered afterwards, at lower priority, and its hidden `<p>` then reads `hidden: 1`. The mount logged the same pattern with `0`. Chrome 156 and Firefox 159, development and production builds.
