---
title: "How do you expose a limited imperative API with `useImperativeHandle`?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [use-imperative-handle, refs, ref-as-a-prop, encapsulation]
related:
  - react/refs/ref-callbacks-and-ref-prop
  - react/refs/refs-vs-state
  - react/effects/effect-dependencies
  - react/effects/layout-effects
  - react/context-and-composition/composition-patterns
  - react/forms-and-actions/controlled-vs-uncontrolled
verified: 2026-10
sources:
  - https://react.dev/reference/react/useImperativeHandle#parameters
  - https://react.dev/reference/react/useImperativeHandle#exposing-a-custom-ref-handle-to-the-parent-component
  - https://react.dev/reference/react/useImperativeHandle#exposing-your-own-imperative-methods
  - https://react.dev/learn/manipulating-the-dom-with-refs#exposing-a-subset-of-the-api-with-an-imperative-handle
  - https://react.dev/blog/2024/12/05/react-19#cleanup-functions-for-refs
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  Take `ref` as a prop, keep the DOM node in a private ref, and call
  `useImperativeHandle(ref, () => ({ focus, clear }), deps)`. The parent's `ref.current` becomes
  that object, not the node, so it can do only what you expose. React sets it during the commit,
  like a DOM ref. Use it for actions props can't express: focus, scroll, play.
---

## Answer

Passing a parent's `ref` straight to your `<input>` hands the parent the whole DOM node. It can restyle it, read its value, or move it, and every caller now depends on your markup.

`useImperativeHandle(ref, createHandle, dependencies?)` replaces what the parent receives. The child attaches its own `useRef` to the `<input>` and gives the parent an object instead:

- **`ref`** is the ref the parent passed. Since React 19 it's an ordinary prop; earlier versions needed `forwardRef` to receive it.
- **`createHandle`** takes no arguments and returns the handle, usually an object of methods. The node stays in a private ref the parent never sees.
- **`dependencies`** work like an effect's: when one changes (by `Object.is`), or if you omit the array, React calls `createHandle` again and assigns the new handle. Methods close over the render that created them, so list every value they read.

**Timing.** React treats the handle like a layout effect. During the commit it sets `ref.current` to the handle (or calls a ref callback with it), after the child's own DOM refs are attached and before the parent's layout effects run. On unmount it sets the ref back to `null`, or runs the cleanup a ref callback returned.

**When to use it.** Only for imperative actions that props can't express: focusing, scrolling, selecting text, starting an animation, calling a third-party widget's method. The React docs' example of misuse is a `Modal` exposing `{ open, close }`; take an `isOpen` prop instead. If the parent only needs to focus a field, exposing just `focus` keeps the component free to change its markup later. Where focus should go for accessibility, and how to type the handle in TypeScript, are separate questions.

## Example

```jsx
function SearchField({ ref }) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({
    focus() { inputRef.current.focus(); },
    clear() { inputRef.current.value = ''; },
  }), []);
  return <input ref={inputRef} defaultValue="react" />;
}

function Toolbar() {
  const searchRef = useRef(null);
  useEffect(() => {
    console.log(Object.keys(searchRef.current).join(', ')); // → focus, clear
    console.log(searchRef.current instanceof HTMLElement);  // → false
    console.log(searchRef.current.value);                   // → undefined
    searchRef.current.clear();
    searchRef.current.focus();
    console.log(document.activeElement.nodeName, document.activeElement.value === ''); // → INPUT true
  }, []);
  return <SearchField ref={searchRef} />;
}
```

Development (no Strict Mode) and production builds of React 19.3.1 in Chrome 156 and Firefox 159; headless focus moved in both. The parent can focus and clear the field but can't read `value` or touch the node.

## Pitfalls

- Passing `[]` while the methods read state or props. A `read: () => count` handle kept returning `0` after the count became `1`; `react-hooks/exhaustive-deps` warns about the missing `count`.
- Omitting the dependency array. A new handle is created on every render, and a parent ref callback runs with `null`, then the new handle, on each commit.
- Exposing state transitions as methods (`open()`, `close()`, `setValue()`). That's data flow, so pass props and let the child render from them.
- Calling a handle method during the parent's render. On the first render `ref.current` is still `null`; call it from handlers and effects.

## Follow-ups

**Q:** Can the parent get the DOM node while the child keeps its own ref?
**A:** Yes: `useImperativeHandle(ref, () => inputRef.current, [])`. The child's `<input>` ref is attached before the handle is created, so the parent receives the node. Merging refs by hand isn't needed.

**Q:** Why did `createHandle` run on every render even with `[]`?
**A:** The parent passed an inline ref callback. In React 19.3.1 the hook appends `ref` to your dependencies (an implementation detail), so a new callback identity re-runs it. Use a ref object or a stable callback.

**Q:** Does a ref callback cleanup work with an imperative handle?
**A:** Yes. The React 19 post lists `useImperativeHandle` among the places ref cleanups work: React calls the callback with the handle and, on detach, runs the returned cleanup instead of calling it with `null`.

## Exercises

### What does `read()` return?

```jsx
function Counter({ ref }) {
  const [count, setCount] = useState(0);
  useImperativeHandle(ref, () => ({
    increment: () => setCount((c) => c + 1),
    read: () => count,
  }), []);
  return <p>{count}</p>;
}
// parent: flushSync(() => counterRef.current.increment());
//         console.log(counterRef.current.read());
```

**Answer:** `0`, while the screen shows `1`. With `[]`, the handle was created once, during the first commit, and `read` closes over that render's `count`. `increment` still works because the updater function doesn't read `count`. With `[count]` React rebuilds the handle after the update and `read()` returns `1`.
