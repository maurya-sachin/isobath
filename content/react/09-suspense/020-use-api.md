---
title: "How does `use` read a promise, and why must the promise be cached?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [use, promises, suspense, caching, data-fetching, context]
related:
  - react/suspense/suspense-mechanics
  - react/suspense/suspense-and-transitions
  - react/suspense/error-boundaries
  - react/rendering-model/rules-of-hooks
  - react/context-and-composition/context-propagation
  - react/effects/effect-cleanup
  - react/server-components/rsc-serialization
  - javascript/promises/what-is-a-promise
  - javascript/promises/promise-error-handling
verified: 2026-10
perishable:
  - "Conditional-use warning added in React 19.3"
  - "No uncached-promise warning while the new promise is pending (19.3.1)"
sources:
  - https://react.dev/reference/react/use#use-promise
  - https://react.dev/reference/react/use#promise-caveats
  - https://react.dev/reference/react/use#use-context
  - https://react.dev/reference/react/use#promises-must-cached
  - https://react.dev/reference/react/use#why-promises-recreated
  - https://react.dev/reference/react/use#caching-promises-for-client-components
  - https://react.dev/reference/react/use#how-to-implement-a-promise-cache
  - https://react.dev/reference/react/use#conditional-use
  - https://react.dev/reference/react/use#re-fetching-data-in-client-components
  - https://react.dev/reference/react/use#displaying-an-error-with-an-error-boundary
  - https://react.dev/reference/react/use#suspense-exception-error
  - https://react.dev/reference/react/use#uncached-promise-error
  - https://react.dev/blog/2024/12/05/react-19#new-feature-use
  - https://react.dev/blog/2026/09/09/react-19-3#changelog
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks#use-hook
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberThenable.js
tldr: >
  `use(promise)` returns the value if the promise has fulfilled, throws the reason to an error boundary
  if it rejected, and suspends to the nearest `<Suspense>` while it's pending. React then retries the
  render and expects the same promise back. A promise created during render is a new, pending one each
  retry, so the component never finishes: cache it outside render.
---

## Answer

`const user = use(userPromise)` reads a promise during render:

- **Fulfilled**: `use` returns the value.
- **Rejected**: it throws the rejection reason, which the nearest error boundary displays.
- **Pending**: the component suspends and the nearest `<Suspense>` shows its fallback. React attaches handlers that record `status` and `value` on the promise; when it settles, React renders the component again, and this time `use` returns synchronously.

That retry is why the promise must be **cached**. The second render has to receive the *same* promise object to find it settled. A component that suspended before mounting has no state, so React reruns it from scratch; a promise created in render, like `use(fetch(url).then(…))`, is a new pending promise every time. The component suspends again, the new promise settles, it suspends again, and the content never appears. A mounted component that re-renders hits the same trap.

So create the promise outside render and reuse it:

- a cache keyed by input (a module-level `Map`, or a data library),
- a Suspense-enabled framework, which caches for you,
- a Server Component passing a promise prop,
- an event handler that stores the promise in state, inside `startTransition` so the old content stays while the new promise loads.

**Not quite a Hook.** `use` must be called during render of a component or Hook, but it may sit inside `if` blocks and loops. It may not sit inside `try`/`catch`: it suspends by throwing, so handle rejections with an error boundary, or give `use` a cached `promise.catch(…)` that resolves to a fallback value. Always call `use` for the promise itself rather than reading `promise.status` to skip it; React 19.3 warns about that.

`use(Context)` reads context like `useContext`, also conditionally.

## Example

```jsx
const requests = { 1: 0, 2: 0 };
function fetchUser(id) {
  requests[id]++;
  return new Promise((resolve) => setTimeout(() => resolve(`user ${id}`), 100));
}

const cache = new Map();
function fetchUserCached(id) {
  if (!cache.has(id)) cache.set(id, fetchUser(id));
  return cache.get(id);
}

const Cached = ({ id }) => <p>{use(fetchUserCached(id))}</p>;
const Uncached = ({ id }) => <p>{use(fetchUser(id))}</p>; // 🔴 new promise per render

const root = document.getElementById('root');
createRoot(root).render(
  <>
    <Suspense fallback={<p>loading</p>}><Cached id={1} /></Suspense>
    <Suspense fallback={<p>loading</p>}><Uncached id={2} /></Suspense>
  </>
);
setTimeout(() => {
  console.log(JSON.stringify([...root.children].map((p) => p.textContent)));
  // → ["user 1","loading"]
  console.log(JSON.stringify(requests));
  // → {"1":1,"2":13}
}, 1000);
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1. The uncached component re-rendered each time its latest promise settled, requesting again every time, and never left the fallback. Neither build logged a warning.

## Pitfalls

- Trusting the dev warning to catch uncached promises. "A component was suspended by an uncached promise" appeared only when the new promise was already resolved, as with `Promise.resolve(data)`; with pending ones the component never finished and nothing was logged, in a Transition too (the old content simply stayed).
- Wrapping `use` in `try`/`catch`. The `catch` receives React's internal "Suspense Exception: This is not a real error!" instead, so the error branch renders while the data is merely loading.
- Skipping `use` once `promise.status === 'fulfilled'`. React 19.3.1 logged "This library called use() to suspend in a previous render but did not call use() when it finished."
- A cache that never forgets. A plain `Map` keeps stale data and grows; real apps need invalidation, which data-fetching libraries provide.

## Follow-ups

**Q:** How do you refetch with `use`?
**A:** In an event handler, drop the cache entry, start a new request, and store the new promise in state inside `startTransition`. The component suspends on it, but the Transition keeps the old content visible until it resolves.

**Q:** Why prefer it to fetching in `useEffect`?
**A:** An Effect fetch starts after the commit and needs its own loading state, error state and race handling. `use` hands loading to Suspense and errors to error boundaries. The request still has to start before render, ideally in a handler or route loader, to avoid waterfalls.

**Q:** Why can `use` be conditional when Hooks can't?
**A:** It isn't stored in the component's Hook list, so calling it on some renders and not others doesn't shift any Hook's state.

**Q:** Where do promises from the server fit?
**A:** A Server Component can pass an unresolved promise as a prop; the Client Component reads it with `use`. Its resolved value must be serializable.

## Exercises

### What does the user see?

```jsx
const userPromise = new Promise((resolve) => setTimeout(() => resolve('Ada'), 100));

function Profile({ promise }) {
  try {
    return <p>{use(promise)}</p>;
  } catch {
    return <p>Couldn't load</p>;
  }
}

<Suspense fallback={<p>Loading…</p>}>
  <Profile promise={userPromise} />
</Suspense>
```

**Answer:** "Couldn't load", permanently, though the promise fulfils. `use` suspends by throwing; the `catch` swallowed that throw, so the component rendered its error branch instead of suspending, and nothing rendered it again. The development build also logged "`use` was called from inside a try/catch block." `eslint-plugin-react-hooks` 7.1.1 reports `React Hook "use" cannot be called in a try/catch block`.
