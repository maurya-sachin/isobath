---
title: "When do `memo`, `useMemo`, and `useCallback` actually help?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [memo, use-memo, use-callback, memoization, re-render, object-is, performance]
related:
  - react/rendering-model/when-components-rerender
  - react/rendering-model/purity-and-strict-mode
  - react/state/immutable-updates
  - react/effects/effect-dependencies
  - react/context-and-composition/context-performance
  - react/context-and-composition/composition-patterns
  - react/performance/react-compiler
  - react/performance/profiling
  - javascript/closures/memoization
  - javascript/coercion-and-equality/equality-algorithms
verified: 2026-10
sources:
  - https://react.dev/reference/react/memo#memo
  - https://react.dev/reference/react/memo#should-you-add-memo-everywhere
  - https://react.dev/reference/react/memo#minimizing-props-changes
  - https://react.dev/reference/react/memo#specifying-a-custom-comparison-function
  - https://react.dev/reference/react/memo#react-compiler-memo
  - https://react.dev/reference/react/useMemo#caveats
  - https://react.dev/reference/react/useMemo#how-to-tell-if-a-calculation-is-expensive
  - https://react.dev/reference/react/useMemo#should-you-add-usememo-everywhere
  - https://react.dev/reference/react/useMemo#my-calculation-runs-twice-on-every-re-render
  - https://react.dev/reference/react/useCallback#how-is-usecallback-related-to-usememo
  - https://react.dev/reference/react/useCallback#should-you-add-usecallback-everywhere
  - https://github.com/facebook/react/blob/v19.3.1/packages/shared/shallowEqual.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberBeginWork.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  `memo` skips a component's re-render when every prop is `Object.is`-equal to last time. `useMemo`
  caches a calculation and `useCallback` a function until a dependency changes. They pay off for
  slow renders or calculations, and work as a pair: one inline object, function or `children`
  element defeats `memo`. Moving state down or passing content as `children` often avoids them.
---

## Answer

All three cache something between renders, and all three compare with `Object.is`.

- **`memo(Component)`** skips re-rendering when the parent re-renders and every prop is the same as last time: same keys, each value `Object.is`-equal. A second argument, `arePropsEqual(oldProps, newProps)`, replaces that check. It only blocks renders that come from the parent; the component's own state and the contexts it reads still re-render it.
- **`useMemo(calculate, deps)`** returns the cached result until one of `deps` changes, then calls `calculate` again.
- **`useCallback(fn, deps)`** returns the cached function until a dependency changes. It's `useMemo(() => fn, deps)` with less typing; it never calls `fn`.

They help in three cases, which the docs list:

1. A component that's **slow to render** re-renders often with the same props: wrap it in `memo`.
2. A value is **passed to a `memo` component** or used as a **dependency** of another hook: keep its identity stable with `useMemo` or `useCallback`, or `memo` and the effect see a "change" every render.
3. A **calculation is noticeably slow** and its inputs rarely change: `useMemo`. The docs suggest around 1 ms, measured in a production build.

Elsewhere they are overhead. `memo` is all-or-nothing: an inline `{}` or `() => {}`, or JSX passed as `children`, is a new object every render, so the comparison fails and the work is wasted. `useCallback` on a handler for a plain `<button>` buys nothing.

Before memoizing, restructure. Move state down into the component that uses it, so its updates don't re-render the slow sibling. Or have the wrapper take the slow part as `children`: those elements come from its parent and are skipped. And none of these may be needed for correctness: they're optimizations, and React may drop a cache.

With the React Compiler on, it inserts this memoization for you.

## Example

```jsx
const Chart = memo(function Chart({ label, style, onSelect, children }) {
  console.log('Chart', label);
  return <p style={style} onClick={onSelect}>{label}{children}</p>;
});

const teal = { color: 'teal' };

function Dashboard() {
  const [count, setCount] = useState(0);
  const select = useCallback(() => console.log('selected'), []);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>count {count}</button>
      <Chart label="stable" style={teal} onSelect={select} />
      <Chart label="inline style" style={{ color: 'teal' }} />
      <Chart label="inline handler" onSelect={() => console.log('selected')} />
      <Chart label="children"><b>!</b></Chart>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Dashboard />);
// Mount → Chart stable, Chart inline style, Chart inline handler, Chart children
// Click "count 0" → Chart inline style, Chart inline handler, Chart children
// Click "count 1" → Chart inline style, Chart inline handler, Chart children
```

Same logs in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, clicks sent with `element.click()`. Only the first `Chart` gets props that are identical by reference; the other three are memoized and re-render anyway.

## Pitfalls

- Adding `memo` and still passing a fresh object, arrow function or `children` element. The comparison runs, fails, and the child renders as before.
- A `useMemo` or `useCallback` dependency that is itself rebuilt every render, such as an `options` object literal. The cache misses every time.
- A custom `arePropsEqual` that skips function props or deep-compares unbounded data. The first freezes stale handlers; the second can cost more than the render.
- Measuring in a development build or under Strict Mode. Both are slower and Strict Mode renders twice; profile a production build.

## Follow-ups

**Q:** Is `useCallback(fn, deps)` really the same as `useMemo(() => fn, deps)`?
**A:** Yes. The `useCallback` page shows exactly that as a "simplified implementation", and in React 19.3.1 both store `[value, deps]` in the hook slot. You still create the function every render; React hands back the cached one.

**Q:** Can `useMemo` guarantee a value is computed only once?
**A:** No. The docs: "Both in development and in production, React will throw away the cache if your component suspends during the initial mount", and in development it drops caches when you edit the file. If correctness depends on keeping it, use state or a ref.

**Q:** Does `memo` stop context updates?
**A:** No. A memoized component that reads a changed context re-renders; `memo` compares props only. Context needs a stable value or split contexts instead.

**Q:** Why not wrap every component in `memo`?
**A:** The docs see "no significant harm" but less readable code, and a single always-new prop undoes it. Memoize where the Profiler shows a slow, frequently repeated render.

## Deep dive

### How it works

Implementation details from React 19.3.1:

- **`memo`.** When the parent re-renders, `updateMemoComponent` in `ReactFiberBeginWork.js` first checks whether the memoized component has its own pending update or a changed context. If not, it compares the previous and next props with `arePropsEqual`, or with `shallowEqual` by default, and checks the `ref` hasn't changed. Equal means bail out: React reuses the previous output without calling the component.
- **`shallowEqual`** (`packages/shared/shallowEqual.js`) returns `true` if the props objects are `Object.is`-equal, otherwise requires the same number of own keys and `Object.is` on every value. It never looks inside a value.
- **`useMemo` and `useCallback`** store `[value, deps]` on the hook. On the next render `areHookInputsEqual` compares the new and old dependencies pairwise with `Object.is`. All equal: return the stored value. Otherwise `useMemo` calls the function and `useCallback` stores the new function. With no dependency array, the deps are `null` and the value is recomputed every render.

### Edge cases

- **Strict Mode** calls the `useMemo` calculation twice when it runs. On mount it logged `body`, `calc 0`, `calc 0`, `body`: both calls happen during the first component call, and the second component call reuses the result. Production logged `calc 0` once.
- **`children` is a prop.** `<Chart><b>!</b></Chart>` creates a new element every render. Memoize the element with `useMemo` or restructure so the parent of `Chart` doesn't re-render.
- **Mutation defeats it silently.** A memoized child given an array the parent mutated in place sees the same reference, skips rendering, and shows old data.
- **Dependencies are compared, not read.** `useMemo(() => filter(items, query), [items])` keeps returning the result for the first `query`; lint's `exhaustive-deps` rule reports the missing dependency.

### Real-world scenario

A page has a text input and, next to it, a list of 3,000 `Row` components that don't depend on the input. Every keystroke re-renders the page component, and with it the list. Measured with `flushSync` updates in a production build (5 page loads, 100 updates each):

| | Chrome 156 | Firefox 159 |
|---|---|---|
| List re-renders | 0.59–0.60 ms per update | 1.28–1.29 ms |
| List wrapped in `memo` | 0.010–0.012 ms | 0.01–0.03 ms |

On a fast laptop, half a millisecond isn't a problem; on a slow phone with a heavier row, it can be. Three fixes, in the order to try them:

1. **Move the state down.** Put the input and its state in a `<SearchBox>` component. A keystroke re-renders `SearchBox` only.
2. **Lift the content up.** Have the stateful component take the list as `children`. It's created by the parent, so the input's updates skip it.
3. **`memo` the list**, keeping its props stable: the `rows` array from state or `useMemo`, handlers from `useCallback`.

The first two need no comparisons and can't be broken by a new prop later.

### Trade-offs

Memoization trades a comparison per render and memory for the cached values against the render it skips. That pays off for expensive subtrees that often receive the same props, and is pure cost for cheap ones or for props that change every time. It also adds dependency arrays, which can go stale. The React Compiler removes the manual part: it caches values and JSX inside each component automatically, so unchanged children receive the same elements and are skipped.

## Exercises

### What does "save" log?

```jsx
const Save = memo(function Save({ onSave }) {
  return <button onClick={onSave}>save</button>;
}, () => true);

function Editor() {
  const [text, setText] = useState('a');
  return (
    <>
      <button onClick={() => setText(text + 'b')}>type</button>
      <Save onSave={() => console.log('saving', text)} />
    </>
  );
}
// Click "type" twice, then "save".
```

**Answer:** `saving a`. `arePropsEqual` always returns `true`, so `Save` never re-renders and its button keeps the first render's `onSave`, which closed over `text === 'a'`. The docs warn that a custom comparison must compare every prop, functions included. Remove the comparator and stabilize the handler instead.
