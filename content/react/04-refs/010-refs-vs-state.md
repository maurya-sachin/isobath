---
title: "When should you use a ref instead of state?"
status: draft
difficulty: medium
frequency: 4
core: true
tags: [use-ref, use-state, refs, purity, escape-hatch]
related:
  - react/state/state-as-snapshot
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/render-and-commit
  - react/refs/ref-callbacks-and-ref-prop
  - react/effects/effect-events
  - react/effects/effect-cleanup
  - react/performance/react-compiler
  - react/forms-and-actions/controlled-vs-uncontrolled
verified: 2026-10
perishable:
  - "React 19.3.1: both Strict Mode calls get the same ref object"
  - "eslint-plugin-react-hooks 7.1.1 reports 'Cannot access refs during render'"
sources:
  - https://react.dev/reference/react/useRef#caveats
  - https://react.dev/reference/react/useRef#referencing-a-value-with-a-ref
  - https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
  - https://react.dev/learn/referencing-values-with-refs#differences-between-refs-and-state
  - https://react.dev/learn/referencing-values-with-refs#how-does-use-ref-work-inside
  - https://react.dev/learn/referencing-values-with-refs#best-practices-for-refs
  - https://react.dev/reference/react/useState#storing-information-from-previous-renders
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/refs
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  Use a ref for a value the component must remember but that doesn't affect what it renders: a
  timer id, a DOM node, a third-party instance. `useRef` returns the same `{ current }` object on
  every render; assigning `current` is immediate and triggers no render. If the value shows on
  screen, it's state. Don't read or write `current` during render.
---

## Answer

Both survive re-renders, and each mounted component instance has its own. The difference is what happens when the value changes.

**State** is a snapshot. Calling `setCount` doesn't change the `count` your handler can see; it queues a render, and the next call of the component receives the new value.

**A ref** is a plain mutable object. `useRef(initial)` returns `{ current: initial }` on the first render and the same object on every render after. Assigning `ref.current` takes effect immediately, React isn't told, and nothing re-renders.

The rule: **if the value affects the rendered output, it's state; if only event handlers and effects need it, it's a ref.** Typical refs:

- timeout and interval ids, so a later handler can clear them;
- DOM nodes, which React writes into `current` when you pass the ref as `ref={…}`;
- instances React doesn't manage: a map widget, a `WebSocket`, an `AbortController`;
- flags a callback checks later without needing a re-render.

**Why reading a ref during render is a bug.** A component must be a pure function of props, state and context. `ref.current` is none of those. React doesn't re-render when it changes, so JSX built from it shows whatever it held the last time something else caused a render. Writing it during render is worse: Strict Mode runs the body twice in development, and a render React discards still leaves its write behind. The `react-hooks/refs` lint, built on the React Compiler, reports both.

The one documented exception is lazy initialisation: `if (ref.current === null) ref.current = new Player()`. It runs once per instance and always produces the same result, so render stays predictable.

Refs are an escape hatch. If much of a component's logic flows through them, that data probably belongs in state.

## Example

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  const clicksRef = useRef(0);
  console.log('render: count', count);

  function handleRefClick() {
    clicksRef.current += 1;
    console.log('ref is now', clicksRef.current);
  }
  function handleStateClick() {
    setCount(count + 1);
    console.log('state is still', count);
  }
  return (
    <>
      <button onClick={handleRefClick}>Ref</button>
      <button onClick={handleStateClick}>State: {count}</button>
    </>
  );
}
// mount, then click Ref, Ref, State:
// → render: count 0
// → ref is now 1
// → ref is now 2
// → state is still 0
// → render: count 1
```

Development build without Strict Mode and production build of React 19.3.1, in Chrome 156 and Firefox 159. The ref changes at once and never re-renders; the state click logs the old snapshot, then React renders with the new one.

## Pitfalls

- Rendering `{ref.current}` and expecting the screen to follow. It changes only when something else re-renders, and then shows whatever the ref holds at that moment.
- Writing during render, such as `renders.current += 1` or `latestRef.current = value` in the component body. Move the write into an effect or handler; for "latest value" reads inside effects, use `useEffectEvent`.
- Keeping a timer id in a plain `let` inside the component. Every render creates a fresh variable, so a later render's `clearTimeout` gets `null`.
- Adding a "has run" ref to stop Strict Mode's second effect run. It hides a missing cleanup instead of fixing it.

## Follow-ups

**Q:** Is `useRef` just `useState` without the setter?
**A:** Conceptually, yes: the React docs describe it as `useState({ current: initialValue })` with the setter unused. React 19.3.1 implements it as its own hook that stores the object on mount and returns that stored object on every update.

**Q:** What does a DOM ref hold during the first render?
**A:** `null`. The node doesn't exist until the commit. React sets `current` there, before layout effects run, and back to `null` when the node is removed. Read it in handlers and effects.

**Q:** Is a ref shared between instances of a component?
**A:** No. Each mounted instance gets its own object, and a remount (for example a new `key`) creates a new one. A module-level variable is the shared one, and it survives unmounts too.

## Deep dive

### How it works

On mount, React 19.3.1's `useRef` creates `{ current: initialValue }`, stores it in the component's list of hooks, and returns it. On every update it returns the stored object and ignores its argument. That's an implementation detail of `ReactFiberHooks.js`, but it explains the behaviour: every closure from every render holds the same object, so all of them see the latest `current`. There is no per-render snapshot, which is what makes a ref useful in a timeout callback and unreliable as render input.

React itself never reads `current`. It writes it in one case: when the ref is passed as `ref` to an element, React stores the DOM node during the commit and resets it to `null` when the node goes away. How and when that happens, and what ref callbacks change, is the next question.

Because the argument is ignored after mount, `useRef(new Player())` still constructs a `Player` on every render and throws it away. Lazy initialisation avoids that, and it's the one render-time access the docs allow:

```jsx
function Video() {
  const playerRef = useRef(null);
  if (playerRef.current === null) {
    playerRef.current = new Player(); // once per mounted instance
  }
  return <button onClick={() => playerRef.current.play()}>Play</button>;
}
```

`eslint-plugin-react-hooks` 7.1.1 accepts this, and reports `renders.current += 1` in a component body as "Cannot access refs during render".

### Edge cases

**Writes during render run more often than you think.** A render counter kept in a ref:

```jsx
function Renders() {
  const renders = useRef(0);
  renders.current += 1; // 🚩 write during render
  return <p>{renders.current}</p>; // 🚩 read during render
}
```

After mounting inside `<StrictMode>`, a development build showed `2`, and each update added 2; a production build showed `1` and added 1 (React 19.3.1, Chrome 156 and Firefox 159). In 19.3.1 both Strict Mode calls received the same ref object; the `useRef` reference still says each ref is created twice and one discarded. Either way the write ran twice. Production can also call a component without committing: a transition interrupted by a more urgent update, or a render that suspends. A write made in such a render stays in the ref even though no user ever saw that render.

**Objects in a ref that also feed rendering.** You may mutate `current` freely, but if it holds an object that state or props also use for rendering, mutating that object is still mutating render data. Copy it, or keep it in state.

**Remounts reset refs.** The object belongs to the mounted instance. Changing a component's `key` or moving it to another place in the tree creates a new instance and a new ref.

### Real-world scenario

"Show whether the price went up" is often solved with a `usePrevious` hook built on a ref. It has two problems: it reads the ref during render, and it returns the value from the previous *render*, not the previous *different* value. The state-based pattern from the `useState` reference stores what it needs to compare:

```jsx
function usePrevious(value) {
  const ref = useRef(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current; // 🚩 read during render
}

function Price({ price, theme }) {
  const prevFromRef = usePrevious(price);
  const [prevPrice, setPrevPrice] = useState(price);
  const [trend, setTrend] = useState(null);
  if (price !== prevPrice) {
    setPrevPrice(price);
    setTrend(price > prevPrice ? 'up' : 'down');
  }
  useEffect(() => console.log(price, theme, prevFromRef, trend));
  return null;
}

root.render(<Price price={10} theme="light" />); // → 10 light undefined null
root.render(<Price price={12} theme="light" />); // → 12 light 10 up
root.render(<Price price={12} theme="dark" />);  // → 12 dark 12 up
```

Production build of React 19.3.1, each render flushed with `flushSync`, Firefox 159 output (Chrome 156's console shows the same values). The theme change re-rendered the component, so the ref-based "previous" price became 12 and a trend computed from it would read "unchanged". The state version still says "up", because it updates only when the price actually changes. The lint flags `return ref.current` in `usePrevious`.

### Trade-offs

- **State** for anything the user sees. It costs a render per change, which is the point.
- **A ref** for values only handlers and effects use. It's invisible to React: no re-render, no snapshot, not allowed in render, and the lint is the only guard.
- **A module variable** is shared by every instance and outlives them. Fine for a true singleton, wrong for per-component data.
- **Derived values** need neither: compute them during render from props and state.
- **The latest props inside an effect** used to be a ref written in an effect. `useEffectEvent` now covers that without the ref.

## Exercises

### Debounce with a local variable

```jsx
function Search() {
  const [query, setQuery] = useState('');
  let timeoutId = null;

  function handleChange(e) {
    const text = e.target.value;
    setQuery(text);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => console.log('search', text), 300);
  }
  return <input value={query} onChange={handleChange} />;
}
// type "abc" quickly
```

**Answer:** It logs `search a`, `search ab`, `search abc`. Each keystroke sets state, so the next keystroke's handler comes from a new render whose `timeoutId` is a fresh `null`; nothing is ever cleared. Storing the id in `useRef(null)` and writing `timeoutRef.current` logs only `search abc` (Chrome 156 and Firefox 159, trusted key events).
