---
title: "How does `lazy` split code, and where should you declare it?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [lazy, code-splitting, dynamic-import, suspense, default-export]
related:
  - react/suspense/suspense-mechanics
  - react/suspense/suspense-and-transitions
  - react/suspense/error-boundaries
  - react/reconciliation/preserving-and-resetting-state
  - react/reconciliation/activity
  - javascript/modules/dynamic-import
  - javascript/modules/es-module-loading
verified: 2026-10
perishable:
  - "React 19.3.1 reconciles a re-declared lazy type by its resolved component"
sources:
  - https://react.dev/reference/react/lazy#lazy
  - https://react.dev/reference/react/lazy#parameters
  - https://react.dev/reference/react/lazy#returns
  - https://react.dev/reference/react/lazy#load-returns
  - https://react.dev/reference/react/lazy#suspense-for-code-splitting
  - https://react.dev/reference/react/lazy#my-lazy-components-state-gets-reset-unexpectedly
  - https://react.dev/reference/react/Suspense#what-activates-a-suspense-boundary
  - https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding
  - https://react.dev/reference/react/Activity#pre-rendering-content-thats-likely-to-become-visible
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactChildFiber.js
tldr: >
  `lazy(() => import('./Chart.jsx'))` returns a component whose code a bundler puts in its own chunk.
  React calls the loader the first time it renders the component, not at declaration; until the
  module arrives the component suspends to the nearest `<Suspense>`. The result's `default` export is
  cached. Declare it at module top level, never inside a component.
---

## Answer

`const Chart = lazy(() => import('./Chart.jsx'))` declares a component whose code isn't loaded yet:

- **Splitting.** A dynamic `import()` gives bundlers a split point: `Chart.jsx` and whatever only it imports go into a separate chunk, so the main bundle shrinks. (Where to split is a performance and tooling question.)
- **When it loads.** Declaring does nothing. React calls the loader the **first time it renders** `<Chart />`. Until the promise settles, rendering suspends and the nearest `<Suspense>` shows its fallback.
- **What it expects.** The loader must return a promise or thenable resolving to an object whose `.default` is a component: exactly what `import()` of a module with a default export gives you. For a named export, map it: `import('./Chart.jsx').then((m) => ({ default: m.Chart }))`.
- **Caching.** React caches both the promise and the result, so the loader runs at most once per `lazy` type. Unmounting and remounting `<Chart />` renders the cached component synchronously. A rejected load goes to the nearest error boundary, and the rejection is cached too.

**Declare it at the top level of a module.** Each `lazy()` call creates a new component type with its own cache. Inside a component, every render makes a new type: React calls the loader again, the component suspends again, and its fallback replaces visible content on each re-render. The docs warn that state gets reset as well.

Two ways to avoid the loading state: render the lazy component during a Transition inside a boundary that's already showing content, so the old UI stays until the code arrives; or pre-render it hidden in `<Activity>`, which loads the code ahead of time.

## Example

```jsx
// Chart.jsx
export default function Chart() {
  return <p>chart</p>;
}

// App.jsx
const Chart = lazy(() => {
  console.log('load called');
  return import('./Chart.jsx');
});

function App() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => setShow(!show)}>Toggle</button>
      {show && (
        <Suspense fallback={<p>loading chart</p>}>
          <Chart />
        </Suspense>
      )}
    </>
  );
}
// Click Toggle three times (show, hide, show):
// → load called
```

Bundled with esbuild 0.28 (`--splitting --format=esm`) and served from `http://localhost`; Chrome 156 and Firefox 159, development and production builds of React 19.3.1. The `Chart` chunk was requested right after `load called`, not at page load. The first click showed "loading chart" until the chunk arrived; the third showed the chart at once, with no request.

## Pitfalls

- Declaring `lazy` inside a component. In the test, every parent re-render called the loader again and flashed the fallback for about 300 ms. State survived there, because React 19.3.1 compares a lazy type by the component it resolves to, but the docs say to expect resets.
- Importing a module without a default export. Development logged "lazy: Expected the result of a dynamic import() call. Instead received: [object Module]", then the error boundary got "Element type is invalid. Received a promise that resolves to: undefined."; production gave error #306.
- Expecting a retry after a failed chunk. Resetting the error boundary showed the same error and called no loader: the rejection is cached. Retry with a new `lazy` type or a page reload.
- Preloading with a bare `import()`. A preload on hover saved the request, but the click still showed the fallback for about 300 ms: the loader's promise was pending at first render, and the reveal was throttled.

## Follow-ups

**Q:** Does the loader have to call `import()`?
**A:** No. React calls it with no arguments and accepts any promise or thenable that resolves to an object with a `default` component, which is handy in tests and for adapting named exports.

**Q:** What if there's no `<Suspense>` above the lazy component?
**A:** It suspends to the nearest boundary further up. With none at all, a `createRoot` app commits nothing for that update until the code arrives.

**Q:** How is it different from `use`?
**A:** `lazy` suspends while a component's *code* loads and caches it per type; `use` suspends on a *data* promise you must cache yourself. Both use the same Suspense and error boundary machinery.
